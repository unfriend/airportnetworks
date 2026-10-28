// A glimpse into the future of network medicine: a 3D tour of the Ludwig Boltzmann
// Institute for Network Medicine, from the parts of a protein machine to whole bodies.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/lbi/build.mjs from the kit, sets and engine parts in tools/lbi: edit those, not this file.
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
// The interactome: a big glowing human protein interaction network (the curated core of the network-medicine story
// woven into ~8,000 synthetic background proteins), with many looks driven by params: pathways, ATP synthase, the
// city map, hubs, neighbourhoods, pins and a route, disease modules, a rare disease, inborn errors of immunity with
// drugs, and network propagation for a patient.
SETS.int = function (K) {
  const { THREE, v3, smooth, clamp, lerp, prog } = K;
  const set = K.newSet('int');
  // <data>
  // generated by tools/gen_int.mjs from proteins.json (the app's network-medicine story): do not edit by hand
  // CORE: 'SYM|name (empty = symbol)|role|module|essential' per protein, ';' between proteins
  const CORE = 'PSMA1|Proteasome alpha 1|proteasome core|5|1;PSMA2|Proteasome alpha 2|proteasome core|5|1;PSMA3|Proteasome alp' +
    'ha 3|proteasome core|5|1;PSMA4|Proteasome alpha 4|proteasome core|5|1;PSMA5|Proteasome alpha 5|proteasome core' +
    '|5|1;PSMA6|Proteasome alpha 6|proteasome core|5|1;PSMA7|Proteasome alpha 7|proteasome core|5|1;PSMB1|Proteasom' +
    'e beta 1|proteasome core|5|1;PSMB2|Proteasome beta 2|proteasome core|5|1;PSMB3|Proteasome beta 3|proteasome co' +
    're|5|1;PSMB4|Proteasome beta 4|proteasome core|5|1;PSMB5|Proteasome beta 5|proteasome core|5|1;PSMB6|Proteasom' +
    'e beta 6|proteasome core|5|1;PSMB7|Proteasome beta 7|proteasome core|5|1;PSMC1|Proteasome ATPase 1|proteasome ' +
    'lid motor|5|1;PSMC2|Proteasome ATPase 2|proteasome lid motor|5|1;PSMC3|Proteasome ATPase 3|proteasome lid moto' +
    'r|5|1;PSMC4|Proteasome ATPase 4|proteasome lid motor|5|1;PSMC5|Proteasome ATPase 5|proteasome lid motor|5|1;PS' +
    'MC6|Proteasome ATPase 6|proteasome lid motor|5|1;PSMD1|Proteasome non-ATPase 1|proteasome regulator|5|1;PSMD2|' +
    'Proteasome non-ATPase 2|proteasome regulator|5|1;POLR2A|RNA polymerase II A|makes messenger RNA|9|1;POLR2B|RNA' +
    ' polymerase II B|makes messenger RNA|9|1;POLR2C|RNA polymerase II C|RNA polymerase subunit|9|1;POLR2D|RNA poly' +
    'merase II D|RNA polymerase subunit|9|1;POLR2E|RNA polymerase II E|RNA polymerase subunit|9|1;POLR2F|RNA polyme' +
    'rase II F|RNA polymerase subunit|9|1;POLR2G|RNA polymerase II G|RNA polymerase subunit|9|1;POLR2H|RNA polymera' +
    'se II H|RNA polymerase subunit|9|1;POLR2I|RNA polymerase II I|RNA polymerase subunit|9|1;POLR2J|RNA polymerase' +
    ' II J|RNA polymerase subunit|9|1;POLR2K|RNA polymerase II K|RNA polymerase subunit|9|1;POLR2L|RNA polymerase I' +
    'I L|RNA polymerase subunit|9|1;TBP|TATA-binding protein|marks where genes start|9|1;GTF2B|Transcription factor' +
    ' IIB|positions RNA polymerase|9|1;TAF1|TFIID subunit 1|promoter recognition|9|0;MED1|Mediator subunit 1|relays' +
    ' signals to RNA polymerase|2|0;MED12|Mediator subunit 12|mediator kinase module|2|0;CDK8|Cyclin-dependent kina' +
    'se 8|mediator kinase|2|0;CCNC|Cyclin C|partner of CDK8|2|0;EP300|p300 acetyltransferase|switches genes on|2|0;' +
    'CREBBP|CREB-binding protein|switches genes on|2|0;MYC|MYC proto-oncogene|drives cell growth|0|0;MAX|MYC-associ' +
    'ated factor X|partner of MYC|0|0;ELK1|ELK1 transcription factor|responds to growth signals|3|0;NCOA3|Nuclear r' +
    'eceptor coactivator 3|helps the oestrogen receptor|2|0;ESR1|Oestrogen receptor alpha|hormone-driven gene switc' +
    'h|2|0;SIRT1|Sirtuin 1|stress-response deacetylase|2|0;HIPK2|HIPK2 kinase|activates p53|2|0;CTCF|CTCF insulator' +
    ' protein|organises the genome|1|0;MCM2|MCM helicase 2|unwinds DNA for copying|6|1;MCM3|MCM helicase 3|unwinds ' +
    'DNA for copying|6|1;MCM4|MCM helicase 4|unwinds DNA for copying|6|1;MCM5|MCM helicase 5|unwinds DNA for copyin' +
    'g|6|1;MCM6|MCM helicase 6|unwinds DNA for copying|6|1;MCM7|MCM helicase 7|unwinds DNA for copying|6|1;CDC45||r' +
    'eplication helicase partner|6|1;GINS1|GINS subunit 1|replication helicase partner|6|1;GINS2|GINS subunit 2|rep' +
    'lication helicase partner|6|1;GINS3|GINS subunit 3|replication helicase partner|6|1;GINS4|GINS subunit 4|repli' +
    'cation helicase partner|6|1;PCNA|PCNA sliding clamp|holds the DNA copier on|0|1;POLD1|DNA polymerase delta|cop' +
    'ies DNA|0|1;RFC1|Replication factor C|loads the PCNA clamp|0|1;ORC1|Origin recognition 1|marks where copying s' +
    'tarts|6|0;ORC2|Origin recognition 2|marks where copying starts|6|0;ORC3|Origin recognition 3|marks where copyi' +
    'ng starts|6|0;ORC4|Origin recognition 4|marks where copying starts|6|0;ORC5|Origin recognition 5|marks where c' +
    'opying starts|6|0;ORC6|Origin recognition 6|marks where copying starts|6|0;CDC6||licenses replication origins|' +
    '6|0;CDT1||licenses replication origins|6|0;GMNN|Geminin|prevents re-copying DNA|6|0;FEN1|Flap endonuclease 1|t' +
    'rims DNA flaps|0|0;LIG1|DNA ligase 1|seals DNA|0|0;SMC1A|Cohesin SMC1A|holds sister DNA together|1|1;SMC3|Cohe' +
    'sin SMC3|holds sister DNA together|1|1;RAD21|Cohesin RAD21|holds sister DNA together|1|1;STAG1|Cohesin SA1|coh' +
    'esin subunit|1|0;STAG2|Cohesin SA2|cohesin subunit|1|0;PDS5A||cohesin regulator|1|0;WAPL||releases cohesin|1|0' +
    ';NIPBL||loads cohesin|1|0;MAU2||loads cohesin|1|0;TP53|p53 tumour suppressor|guardian of the genome|2|0;MDM2|M' +
    'DM2 ubiquitin ligase|keeps p53 in check|2|0;MDM4||keeps p53 in check|2|0;USP7|USP7 deubiquitinase|stabilises M' +
    'DM2 and p53|2|0;TP53BP1|p53-binding protein 1|guides DNA break repair|1|0;TP53BP2|p53-binding protein 2|helps ' +
    'p53 trigger cell death|2|0;BRCA1||repairs broken DNA|1|0;BARD1||partner of BRCA1|1|0;BRCA2||loads RAD51 onto D' +
    'NA|1|0;PALB2||links BRCA1 and BRCA2|1|0;RAD51|RAD51 recombinase|repairs DNA by copying|1|0;RBBP8|CtIP|trims br' +
    'oken DNA ends|1|0;BRIP1|BRIP1 helicase|partner of BRCA1|1|0;ATM|ATM kinase|senses DNA breaks|1|0;CHEK2|CHK2 ki' +
    'nase|relays DNA damage alarms|1|0;MRE11|MRE11 nuclease|grabs DNA breaks|1|0;RAD50||grabs DNA breaks|1|0;NBN|Ni' +
    'brin|grabs DNA breaks|1|0;H2AX|Histone H2AX|flags DNA breaks|1|0;MDC1||gathers repair proteins|1|0;RNF8|RNF8 u' +
    'biquitin ligase|marks DNA breaks|1|0;RNF168|RNF168 ubiquitin ligase|marks DNA breaks|1|0;PARP1||spots single-s' +
    'trand DNA breaks|0|0;XRCC1||scaffold for DNA repair|0|0;LIG3|DNA ligase 3|seals repaired DNA|0|0;POLB|DNA poly' +
    'merase beta|fills DNA gaps|0|0;MLH1||fixes copying mistakes|0|0;PMS2||fixes copying mistakes|0|0;MSH2||spots c' +
    'opying mistakes|0|0;MSH6||spots copying mistakes|0|0;FANCD2||repairs DNA cross-links|1|0;FANCI||repairs DNA cr' +
    'oss-links|1|0;ATR|ATR kinase|senses stalled DNA copying|1|1;CHEK1|CHK1 kinase|pauses the cell cycle|1|1;ATRIP|' +
    '|partner of ATR|1|0;CDK1|CDK1 kinase|starts cell division|0|1;PLK1|Polo-like kinase 1|drives mitosis|1|1;CDC20' +
    '||triggers chromosome separation|0|1;ANAPC1|APC/C subunit 1|cell-cycle ubiquitin ligase|0|1;ANAPC2|APC/C subun' +
    'it 2|cell-cycle ubiquitin ligase|0|1;ANAPC4|APC/C subunit 4|cell-cycle ubiquitin ligase|0|1;ANAPC11|APC/C subu' +
    'nit 11|cell-cycle ubiquitin ligase|0|1;CDC27|APC/C subunit CDC27|cell-cycle ubiquitin ligase|0|1;WEE1|WEE1 kin' +
    'ase|brakes cell division|0|1;AURKA|Aurora kinase A|builds the spindle|1|1;CCNA2|Cyclin A2|partner of CDK1 and ' +
    'CDK2|0|1;CDK2|CDK2 kinase|starts DNA copying|0|0;CDK4|CDK4 kinase|moves cells past G1|2|0;CDK6|CDK6 kinase|mov' +
    'es cells past G1|2|0;CCNB1|Cyclin B1|partner of CDK1|0|0;CCNE1|Cyclin E1|partner of CDK2|0|0;CCND1|Cyclin D1|p' +
    'artner of CDK4 and CDK6|2|0;CDKN1A|p21|brakes the cell cycle|0|0;CDKN1B|p27|brakes the cell cycle|0|0;CDKN2A|p' +
    '16 / ARF|brakes the cell cycle|2|0;RB1|Retinoblastoma protein|gatekeeper of cell division|2|0;E2F1||switches o' +
    'n S-phase genes|2|0;TFDP1|DP1|partner of E2F1|2|0;CDC25A|CDC25A phosphatase|activates CDKs|1|0;CDC25C|CDC25C p' +
    'hosphatase|activates CDK1|1|0;FZR1|CDH1 (FZR1)|APC/C activator|0|0;MAD2L1|MAD2|spindle checkpoint|0|0;MAD1L1|M' +
    'AD1|spindle checkpoint|0|0;BUB1B|BUBR1|spindle checkpoint|0|0;CUL1|Cullin 1|ubiquitin ligase scaffold|0|1;SKP1' +
    '||ubiquitin ligase adaptor|0|1;RBX1||ubiquitin ligase core|0|1;FBXW7||tags MYC and cyclin E for destruction|0|' +
    '0;SKP2||tags p27 for destruction|0|0;BTRC|beta-TrCP|tags beta-catenin and IkB|0|0;HSP90AA1|HSP90 chaperone|fol' +
    'ds signalling proteins|2|0;CDC37||HSP90 partner for kinases|2|0;EGFR|EGF receptor|growth-factor receptor|3|0;E' +
    'RBB2|HER2|growth-factor receptor|3|0;ERBB3|HER3|growth-factor receptor|3|0;INSR|Insulin receptor|senses insuli' +
    'n|3|0;IGF1R|IGF-1 receptor|senses growth factor IGF-1|3|0;HRAS||growth signal switch|3|0;KRAS||growth signal s' +
    'witch|3|0;NRAS||growth signal switch|3|0;CDH1|E-cadherin|glues cells together|4|0;LRP6||Wnt co-receptor|4|0;TG' +
    'FBR1|TGF-beta receptor 1|senses TGF-beta|2|0;TGFBR2|TGF-beta receptor 2|senses TGF-beta|2|0;TNFRSF1A|TNF recep' +
    'tor 1|senses TNF|8|0;LRP1||clears lipoproteins and amyloid|4|0;APP|Amyloid precursor protein|source of amyloid' +
    '-beta|4|0;PSEN1|Presenilin 1|gamma-secretase core|4|0;PSEN2|Presenilin 2|gamma-secretase core|4|0;NCSTN|Nicast' +
    'rin|gamma-secretase subunit|4|0;APH1A|APH-1A|gamma-secretase subunit|4|0;PSENEN|PEN-2|gamma-secretase subunit|' +
    '4|0;BACE1|BACE1 (beta-secretase)|cuts APP into amyloid|4|0;GRB2|GRB2 adaptor|links receptors to RAS|3|0;SOS1||' +
    'switches RAS on|3|0;SHC1|SHC1 adaptor|links receptors to GRB2|3|0;RAF1|RAF1 kinase|relays RAS signals|3|0;BRAF' +
    '|BRAF kinase|relays RAS signals|3|0;MAP2K1|MEK1|relays to ERK|3|0;MAP2K2|MEK2|relays to ERK|3|0;MAPK1|ERK2|gro' +
    'wth signal kinase|3|0;MAPK3|ERK1|growth signal kinase|3|0;PIK3CA|PI3K catalytic alpha|makes the PIP3 signal|3|' +
    '0;PIK3R1|PI3K regulatory p85|docks PI3K on receptors|3|0;PTEN|PTEN phosphatase|erases the PIP3 signal|2|0;AKT1' +
    '|AKT1 kinase|survival and growth kinase|7|0;PDPK1|PDK1 kinase|activates AKT|7|0;MTOR|mTOR kinase|growth contro' +
    'ller|7|0;RPTOR|Raptor|mTORC1 subunit|7|0;RICTOR|Rictor|mTORC2 subunit|7|0;MLST8|mLST8|mTOR subunit|7|0;TSC1|Ha' +
    'martin (TSC1)|brake on mTOR|7|0;TSC2|Tuberin (TSC2)|brake on mTOR|7|0;RHEB||switches mTOR on|7|0;RPS6KB1|S6 ki' +
    'nase 1|boosts protein synthesis|7|0;EIF4EBP1|4E-BP1|holds back protein synthesis|7|0;EIF4E|eIF4E|starts protei' +
    'n synthesis|7|0;IRS1|Insulin receptor substrate 1|relays insulin signals|3|0;SRC|SRC kinase|signalling kinase|' +
    '3|0;PTPN11|SHP2 phosphatase|boosts RAS signals|3|0;CBL|CBL ubiquitin ligase|switches receptors off|3|0;STAT3||' +
    'signal-driven gene switch|3|0;JAK2|JAK2 kinase|cytokine receptor kinase|3|0;ABL1|ABL1 kinase|signalling kinase' +
    ', target of imatinib|1|0;GSK3B|GSK3-beta kinase|brake in Wnt and insulin signalling|4|0;CTNNB1|beta-catenin|Wn' +
    't signal and cell glue|4|0;APC||destroys beta-catenin|4|0;AXIN1|Axin 1|scaffold that destroys beta-catenin|4|0' +
    ';CSNK1A1|Casein kinase 1 alpha|primes beta-catenin for destruction|4|0;DVL1|Dishevelled 1|relays Wnt signals|4' +
    '|0;CTNNA1|alpha-catenin|links cell junctions to actin|4|0;TCF7L2|TCF7L2 (TCF4)|Wnt-driven gene switch|4|0;LEF1' +
    '||Wnt-driven gene switch|4|0;TGFB1|TGF-beta 1|signal that restrains growth|2|0;SMAD2||carries TGF-beta signals' +
    '|2|0;SMAD3||carries TGF-beta signals|2|0;SMAD4||partner of SMAD2/3|2|0;SMAD7||blocks TGF-beta signalling|2|0;T' +
    'NF|Tumour necrosis factor|inflammation signal|8|0;APOE|Apolipoprotein E|carries lipids in the brain|4|0;INS|In' +
    'sulin|hormone that lowers blood sugar|3|0;TRADD||TNF receptor adaptor|8|0;TRAF2||TNF receptor adaptor|8|0;RIPK' +
    '1|RIPK1 kinase|decides survive or die|8|0;CHUK|IKK-alpha|NF-kB activating kinase|8|0;IKBKB|IKK-beta|NF-kB acti' +
    'vating kinase|8|0;IKBKG|NEMO|IKK regulator|8|0;NFKBIA|IkB-alpha|holds NF-kB in the cytoplasm|2|0;RELA|NF-kB p6' +
    '5|inflammation gene switch|2|0;NFKB1|NF-kB p50|inflammation gene switch|2|0;FADD||death-receptor adaptor|8|0;C' +
    'ASP8|Caspase 8|starts cell death|8|0;CASP9|Caspase 9|starts cell death|8|0;CASP3|Caspase 3|executes cell death' +
    '|8|0;APAF1||builds the apoptosome|8|0;CYCS|Cytochrome c|released to trigger cell death|8|0;BCL2|BCL-2|blocks c' +
    'ell death|7|0;BCL2L1|BCL-XL|blocks cell death|7|0;MCL1|MCL-1|blocks cell death|7|0;BAX||punches holes in mitoc' +
    'hondria|7|0;BAK1|BAK|punches holes in mitochondria|7|0;BID||links caspase-8 to mitochondria|7|0;BAD||sensitise' +
    's cells to death|7|0;XIAP||blocks caspases|8|0;DIABLO|SMAC|releases the caspase brake|8|0;MAPT|Tau|stabilises ' +
    'microtubules in neurons|4|0;CDK5|CDK5 kinase|neuronal kinase|4|0;CDK5R1|p35|activates CDK5|4|0;APBB1|Fe65|bind' +
    's the tail of APP|4|0';
  // the 375 curated interactions, 2+2 characters per pair (base-64 indices into CORE)
  const CORE_E = '000100060007000E01020108010F02030209020G0229021M0304030A030H0405040B040I0506050C050J060D0708070D0809090A0A0B0B' +
    '0C0C0D0E0F0E0I0E0L0F0J0F0L0G0J0G0H0H0I0H0K0K0L0M0N0M0O0M0Q0M0R0M0T0M0W0M0P0M0S0M0Y0M0Z0M0b0N0O0N0U0N0V0N0X0O0V' +
    '0O0W0P0S0Q0T0R0T0Y0Z0Y0a0b0c0b0f0b0l0c0d0c0e0d0e0f0g0f0h0f0l0f1L0f1M0f1R0f3E0f3I0f3S0f3f0g0l0g0k0g1L0g3I0g3S0g' +
    '3f0h0i0h2O0j2v0j2w0k0l0l1R0l2R0l3B0l280m1L0n1L0o1G0o1E0p0t0p0s0p0v0p170q0u0q0s0q0w0r0t0r0u0s0v0t180u1t0v0z0w0x' +
    '0w0y0w0z0x0y0x0z0y0z0_1A0_1B0_0$0_100_290_1o0_1i0_220_1811141112111712131315131614151718172218191C1D1C1E1C1J1C' +
    '1R1C1Y1D1E1E1F1E1G1E1H1G1v1H1I1J1K1L1M1L1N1L1O1L1R1L1Y1L1Z1L1s1L1P1L1Q1L2R1L1h1L3o1L2z1L2C1M1N1M1O1M2B1M2C1M2_' +
    '1P1d1R1S1R1U1R1V1R1W1R1X1R1Y1R1Z1T1U1T1V1T1p1W1a1Y1Z1Y1c1Y1d1Y3G1Z2F1a1b1a1c1b1c1c1e1d1e1e1f1f1g1h1i1i1j1i1k1l' +
    '1m1l1n1n1o1p1q1p1r1r1s1r1t1s2F1s2G1u261u221u2G1u201v2G1v211w1$1w1y1w261w2I1w2K1x1y1x1z1y1_1z1$1$2H222323272329' +
    '232A232F2428242B242C2429242S242R2528252B2729272A272O282C2A2P2C2D2D2E2I2J2L2M2L2N2M2O2M2P2M2Q2Q3I2Q3e2R2S2R2_2R' +
    '2U2R2r2T2o2T2q2T2U2T3B2T3D2T3E2U2V2U2o2V2y2W3A2W2X2W3X2X3A2Y2p2Y2r2Y2x2Z2p2Z2r2Z2s2Z2x2a2p2a2s2b3I2c3K2d2e2d3R' +
    '2d3S2d3U2e3Q2f3V2f3Y2g2h2g3W2h2i2h2n2h3W2h3z2i3I2i3H2i2k2i2l2i2m2j2k2j2l2k2l2o2q2o2p2o3A2o3C2o3D2o3G2r2s2r2t2s' +
    '2t2s2u2t2v2t2w2u2v2u2w2x2y2y3A2_2$2_352_302_3H2_3t3036303130323033303731333137313832333435353638393E3F3H3K3H3I' +
    '3H3w3I3J3I3K3I3L3I3O3I3P3I3N3J3K3K3L3K3M3R3T3R3S3S3T3Y3Z3Y3a3Y3h3Z3a3a3d3b3d3b3c3c3d3c3e3e3f3e3g3f3g3h3i3i3s3i' +
    '3k3j3k3j3l3j3u3k3u3l3m3n3q3n3t3n3s3o3q3o3r3o3t3p3r3p3s3q3s3u3v3w3x3x3y';
  // module-local 3D layouts, 3 x 2 characters per protein (12 bits each, -1.6..1.6, RMS radius 1, flattest axis y)
  const CORE_P = 'b0X9GDWUiZNzTmjHdlRTX8m5WGKgh7d8KUVGjaMbI_o6cJJ6j0miRsftm1gSeqaKpWiyN7lupcJnZctOPtNDL2QyJCKDaxJeIrdPd9DNTWfaJa' +
    'KHYRQBUxTk2dTHVb8mUnJmRjW7TCl9WSXaeQNpWQRulVVySrYFDgG_NhLFN3kjP8LsSuFdw_cBRepgKtYtVpI2VItVcFhwJ2Vij3EtWIasEIVK' +
    'vba8aLKadjfkB_eyhT5Pgkkq8GXnTATtaKRgULUaiEEuVwnXEo1rV0P0d4YmRlVSZYRSFoIfWeN3FyS7l9cjhhSGa1cfFKQYVKLrMikPKWXnYh' +
    'S6UWl5GOKldMMvd0UCEVUhLTCsa6GDHFWuEcIGbGKxIOW3b9CzYmYECnSTZiltXzYypEZzQWqoUnJYrDQsWwssOpPGoxUvBhcra2f3ZnZVo6cM' +
    'c$v6IYUThmDCWJfTWhRkedb_TciagyX8hkhvZooll3d_ceo3SNjbt1OZkEVnMKmGV1IRrhNjP8WDOPU$ajP3OhehJTPSd3Hqi_hcHyL4OwRJN0' +
    'VJNSFhVaX_KLHbWNJ3OfSfK9MgIDNKTWTRFNXYNiVDZ$SvV8T4CJS0Tg8bVrU2EjY1WWJ0dscOEYgVXADdndU2EHsyRLFilMctIdg1eLLuljeb' +
    'IniyjqM_9wZqQA6CYPKGFOazIlMnbScXP0BqeGLV6$e$XLB$fAcaIegFad6jXoTPfNmeitVDmcXCehsRQhWqpSQKbysvVgV4peKCcLqKZzYPY5' +
    'QMkupCogUrQpUgZtQ1VBRWISegUbNAmebNf7V8fqPYYAMcOFg3WQLnXAT9QSTYKxLffRb$IPZBZoA7c9g64veOklYYa6N0k4hFNhrReqV0lze6' +
    'hgl2jQjcoFWIkObKRp9sVpVhBXfROS9MTDbLF_SLSIF0UuW964LwYvQfGEegNbh4UqJOhtarPthrhyVYnmThmBqBY8jJPqaEgpNmZ8cVN7Orbv' +
    'fkUkFTqwMUaKoxWximsMerl0IhRijh7_c2PBECZNU$R7RwSyMfAQVfNfI8WqOvG$SBN5PEK76yVVZOfXStTbUDU9aWe1P0M2HGZde8GNT_axAB' +
    'XXYv9RR2WC3mUCVq7UVqReUwerfUejfYdGNCFeaLT0SWe4TVIqgoJ4XdWtHJVqMZFwgsVjG9csQRPkX$vcOoWBmzIeYGh4DrRhRyJiT3CmN8Qd' +
    '5ok9XHe8khRgC5h9JOU$lOR8NjdLZGAnZsck51JxUTgoatVWZFeJYnPQl$bgUDlPUXXDllSpPftEVqdRkGeeIOaXePHCdhjjP_tolNm6onRlfR' +
    'iDSLb5oNN4dVrPVlp$JCKeo7ANgjRIoNPRsJJsZSd1E1dCYgG$YpTAKkVuBRJlPtDNIIVPJ5ivHOIge5LSOZhSE6LSSeeLgQcIfBfso9UMW_kI' +
    'bnasn$KcVym3CkUunFPjXImVakYGtQaMMDsGUOYIpyg5REssSaR1e$Twb8owcTTfqChfMxZjXRlEYQZCuNWgat$BBifAc9';
  const MODS = [['Cell cycle & DNA copying', '#ff6b38'], ['DNA break repair', '#4d94ff'], ['p53 & gene control', '#ffd62e'],
    ['Growth-factor signalling', '#40e673'], ['Wnt & amyloid', '#cc61ff'], ['Proteasome', '#26ebeb'],
    ['DNA replication start', '#ff61ad'], ['AKT-mTOR & survival', '#9eff40'], ['TNF & cell death', '#ffb385'],
    ['RNA polymerase II', '#ebf0ff']];
  const ATP = ['ATP5A1', 'ATP5B', 'ATPAF1', 'ATPAF2', 'ATP5C1', 'ATP5D', 'ATP5E', 'ATP5F1', 'ATP5O', 'MT-ATP6', 'ATP5G1', 'ATP5G2', 'ATP5G3'];
  const ATP_E = [[0, 1], [0, 4], [1, 4], [4, 5], [4, 6], [5, 6], [4, 10], [6, 10], [5, 11], [10, 11], [11, 12], [10, 12], [12, 9], [11, 9], [9, 7], [7, 8], [8, 0], [8, 1], [7, 0], [2, 1], [3, 0]];
  const ATP_P = 'PcS0fPcPZ$fPlCfclPHDM0k$W0WpWCZ$UPOCS0YpN0jCM0VpZCOpoCkYNcF0P4Z$DPW0O0EDcxZ$Ec';
  // </data>

  // ---------------------------------------------------------------- helpers
  const R = K.rng(2026), gs = () => K.gauss(R);
  const DEG = Math.PI / 180, TAU = Math.PI * 2;
  const sph = (az, el) => [Math.cos(el * DEG) * Math.sin(az * DEG), Math.sin(el * DEG), Math.cos(el * DEG) * Math.cos(az * DEG)];
  // u (right), v (up), w (= dir) for a direction seen from outside
  const basis = w => { const u = v3.norm(v3.cross(Math.abs(w[1]) > 0.97 ? [1, 0, 0] : [0, 1, 0], w)); return [u, v3.cross(w, u), w]; };
  const inB = (o, B, x, y, z) => [o[0] + B[0][0] * x + B[1][0] * y + B[2][0] * z, o[1] + B[0][1] * x + B[1][1] * y + B[2][1] * z,
    o[2] + B[0][2] * x + B[1][2] * y + B[2][2] * z];
  const AL = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  const dec = (s, i) => AL.indexOf(s[i]) * 64 + AL.indexOf(s[i + 1]);
  // Math.hypot is slow in V8: plain square roots in the hot paths
  const dv = (a, b) => { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); };
  const vl = a => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  const css = c => '#' + c.map(x => ('0' + Math.round(clamp(x, 0, 1) * 255).toString(16)).slice(-2)).join('');
  const ROUTE = [1, 0.5, 0.16], RED = K.rgb('#ff5a4b'), AMB = K.rgb('#ffb43b'), PXB = K.rgb('#4d94ff'), TEAL = [0.16, 0.86, 0.8], GRN = K.rgb('#3ee08f');

  // ---------------------------------------------------------------- the curated core (data from proteins.json)
  const core = CORE.split(';').map(s => { const f = s.split('|'); return { sym: f[0], name: f[1] || f[0], role: f[2], module: +f[3], essential: f[4] === '1', degree: 0 }; });
  const NC = core.length;
  const CE = []; for (let i = 0; i < CORE_E.length; i += 4) CE.push([dec(CORE_E, i), dec(CORE_E, i + 2)]);
  for (const [a, b] of CE) { core[a].degree++; core[b].degree++; }
  const qpos = (s, i) => [0, 1, 2].map(c => dec(s, 6 * i + 2 * c) / 4095 * 3.2 - 1.6);
  const MCOL = MODS.map(m => K.rgb(m[1]));
  // Inborn errors of immunity: 19 molecular clusters (Guthrie et al., Science Advances 2023), counts and colours as given
  const IEI = [['c23', 'c23', '#8a8f98', 1], ['RNA remodelling and nucleotide', 'RNA|remodelling', '#9b6bd6', 19],
    ['Proteasome complex', 'Proteasome|complex', '#e0453a', 8], ['Calcium', 'Calcium', '#3fae5a', 2],
    ['NF-κB and chromatin', 'NF-κB|and chromatin', '#2f9e44', 22], ['Regulation of cell death and survival', 'Cell death|and survival', '#8c3b2e', 21],
    ['c4', 'c4', '#6d7784', 3], ['Meiosis, antigen presentation', 'Meiosis', '#c84fd0', 3], ['Vesicular traffic', 'Vesicular|traffic', '#d9c63a', 9],
    ['Actin regulation', 'Actin', '#2d8fd6', 5], ['Transcription factors, DNA binding complex', 'Transcription|factors', '#7d6b5d', 19],
    ['TCR and BCR', 'TCR and BCR', '#a855d8', 9], ['CD28 costimulation', 'CD28', '#c73fa0', 4], ['Interleukin and cytokine', 'Interleukin|and cytokine', '#1f7ac2', 7],
    ['Steroid resistant inflammation', 'Steroid|resistant inflammation', '#8a4b2a', 15], ['c19', 'c19', '#5aa86c', 1], ['c9', 'c9', '#9aa4ad', 1],
    ['Complement', 'Complement', '#d6303a', 23], ['c3', 'c3', '#c0c4c9', 1]];
  const ICOL = IEI.map(c => K.rgb(c[2]));

  // ---------------------------------------------------------------- graph store
  const MAXN = 9800, MAXE = 28000;
  const P = new Float32Array(MAXN * 3);                 // 3D layout
  const KIND = new Uint8Array(MAXN);                     // 0 background, 1 global hub, 2 curated, 3 ATP synthase, 4 IEI, 5 disease, 6 rare, 7 hair
  const GI = new Int16Array(MAXN);                       // module / cluster / disease code
  const UNIT = new Int32Array(MAXN), FLAG = new Uint8Array(MAXN);   // FLAG bits: 1 disease hood, 2 treatment hood, 4 disease gene, 8 drug target
  const ADJ = [], ND = new Int32Array(MAXN);
  const SYM = new Map();                                 // symbol -> node id (curated and ATP)
  let N = 0, E = 0;
  const units = [];                                      // neighbourhoods: { c, kind, hood, mem: [] }
  const unit = (c, kind) => { units.push({ c, kind, hood: null, mem: [] }); return units.length - 1; };
  function node(p, kind, gi, u) {
    P[3 * N] = p[0]; P[3 * N + 1] = p[1]; P[3 * N + 2] = p[2];
    KIND[N] = kind; GI[N] = gi; UNIT[N] = u; ADJ.push([]); units[u].mem.push(N);
    return N++;
  }
  const EA = new Int32Array(MAXE), EB = new Int32Array(MAXE), EK = new Set();
  function edge(a, b) {
    if (a === b || a < 0 || b < 0) return false;
    const k = a < b ? a * MAXN + b : b * MAXN + a;
    if (EK.has(k) || E >= MAXE) return false;
    EK.add(k); EA[E] = a; EB[E] = b; E++; ADJ[a].push(b); ADJ[b].push(a); ND[a]++; ND[b]++;
    return true;
  }
  const pos = i => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
  const dist = (i, j) => { const x = P[3 * i] - P[3 * j], y = P[3 * i + 1] - P[3 * j + 1], z = P[3 * i + 2] - P[3 * j + 2]; return Math.sqrt(x * x + y * y + z * z); };
  const pickOne = arr => arr[Math.floor(R() * arr.length)];
  // the k nearest of the first n ids in list to node j (small lists)
  const DD = new Float64Array(256);
  function nearest(list, n, j, k) {
    for (let q = 0; q < n; q++) DD[q] = dist(list[q], j);
    const out = [];
    for (let s = 0; s < k && s < n; s++) {
      let b = -1;
      for (let q = 0; q < n; q++) if (DD[q] >= 0 && (b < 0 || DD[q] < DD[b])) b = q;
      out.push(list[b]); DD[b] = -1;
    }
    return out;
  }
  // pick from ids with weights w(id)
  let WP = new Float64Array(64);
  function wpick(ids, w) {
    if (WP.length < ids.length) WP = new Float64Array(ids.length * 2);
    let s = 0; const c = WP;
    for (let k = 0; k < ids.length; k++) { s += w(ids[k]); c[k] = s; }
    const x = R() * s; let lo = 0, hi = ids.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < x) lo = m + 1; else hi = m; }
    return ids[lo];
  }

  // ---------------------------------------------------------------- where things go
  // Directions are chosen so each look has its own side (and camera view): immunity left-front, the rare disease
  // top-right-back, the overlapping MS / RA modules and the peroxisomal module on opposite sides (on the city map they
  // sit near-left and far-right of the story's camera at az 90-120, clear of the tall buildings downtown).
  const D_IEI = sph(-40, 6), D_MSRA = sph(37, 25), D_PX = sph(265, -30), D_RARE = sph(110, 35);
  // the blue pin's district: towards az 65 on the map, in front of the story's city cameras (az 20-120)
  const D_BLUE = [Math.sin(65 * DEG), 0, Math.cos(65 * DEG)];
  const C_ATP = v3.mul(sph(25, 12), 0.2);
  const special = [];   // { c, r } keep-out zones for background neighbourhoods
  // module directions: farthest-point choice on a Fibonacci sphere, away from the special sides
  const modDir = (() => {
    const cand = [];
    for (let i = 0; i < 64; i++) {
      const y = 1 - 2 * (i + 0.5) / 64, s = Math.sqrt(1 - y * y), th = i * 2.399963;
      if (Math.abs(y) < 0.8) cand.push([s * Math.cos(th), y, s * Math.sin(th)]);
    }
    const taken = [[D_IEI, 0.62], [D_MSRA, 0.35], [D_PX, 0.35], [D_RARE, 0.35]], out = [];
    for (let m = 0; m < 10; m++) {
      let best = null, bs = -1;
      for (const d of cand) {
        let s = 9;
        for (const [t, pad] of taken) s = Math.min(s, Math.acos(clamp(v3.dot(d, t), -1, 1)) - pad);
        if (s > bs) { bs = s; best = d; }
      }
      out.push(best); taken.push([best, 0]);
    }
    return out;
  })();

  // ---------------------------------------------------------------- curated modules (node ids 0..253 = core index)
  // one module (the one facing D_BLUE) sits out towards the rim: the blue pin's protein comes from there
  const outer = (() => {
    let b = 0, bs = -9;
    modDir.forEach((d, k) => { const s = k === 2 ? -9 : v3.dot(v3.norm([d[0], 0, d[2]]), D_BLUE) - 0.3 * Math.abs(d[1]); if (s > bs) { bs = s; b = k; } });
    return b;
  })();
  const MOD = MODS.map((m, k) => {
    const mem = core.map((c, i) => (c.module === k ? i : -1)).filter(i => i >= 0);
    const rr = R(), r = k === 2 ? 0.3 : k === outer ? 0.74 : 0.5 + 0.1 * rr, c = v3.mul(modDir[k], r), s = 0.05 + 0.0115 * Math.sqrt(mem.length);
    const B = basis(modDir[k]), a = R() * TAU, u = v3.add(v3.mul(B[0], Math.cos(a)), v3.mul(B[1], Math.sin(a)));
    const M = { mem, c, s, B: [u, v3.cross(B[2], u), B[2]], unit: unit(c, 'mod') };
    special.push({ c, r: s * 1.15 });
    return M;
  });
  for (let i = 0; i < NC; i++) {
    const M = MOD[core[i].module], l = qpos(CORE_P, i);
    // the module's flattest axis points outwards, so it spreads over the surface of its shell
    node(inB(M.c, M.B, l[0] * M.s, l[2] * M.s, l[1] * M.s), 2, core[i].module, M.unit);
    SYM.set(core[i].sym, i);
  }
  for (const [a, b] of CE) edge(a, b);

  // ---------------------------------------------------------------- ATP synthase (13 nodes near the centre)
  const atpU = unit(C_ATP, 'atp'), atpB = basis(v3.norm(C_ATP)), ATPN = [];
  special.push({ c: C_ATP, r: 0.12 });
  // drawn like the complex seen from the side (head up, c-ring down), facing the 'atp' view
  ATP.forEach((s, k) => { const l = qpos(ATP_P, k); ATPN.push(node(inB(C_ATP, atpB, l[0] * 0.13, l[2] * 0.13, l[1] * 0.13), 3, k, atpU)); SYM.set(s, ATPN[k]); });
  for (const [a, b] of ATP_E) edge(ATPN[a], ATPN[b]);

  // ---------------------------------------------------------------- inborn errors of immunity: 19 clusters packed on one side
  const ieiB = basis(D_IEI), IEIC = [];   // per cluster: { x, y, rho, c, mem, unit }
  (() => {
    const rho = n => 0.027 * Math.sqrt(n) + 0.017, order = IEI.map((c, k) => k).sort((a, b) => IEI[b][3] - IEI[a][3] || a - b);
    const placed = [];
    for (const k of order) {
      const r = rho(IEI[k][3]);
      let best = [0, 0], bd = placed.length ? 1e9 : 0;
      if (placed.length) {
        for (const q of placed) for (let s = 0; s < 36; s++) {
          const a = s / 36 * TAU, x = q.x + (q.rho + r + 0.03) * Math.cos(a), y = q.y + (q.rho + r + 0.03) * Math.sin(a);
          if (placed.some(o => Math.hypot(o.x - x, o.y - y) < o.rho + r + 0.028)) continue;
          const d = Math.hypot(x * 1.2, y);   // a little taller than wide: fewer label collisions
          if (d < bd) { bd = d; best = [x, y]; }
        }
      }
      placed.push({ k, x: best[0], y: best[1], rho: r });
    }
    for (const q of placed) IEIC[q.k] = q;
    for (let k = 0; k < 19; k++) {
      const q = IEIC[k], n = IEI[k][3];
      q.c = inB(v3.mul(D_IEI, 0.62), ieiB, q.x, q.y, -(q.x * q.x + q.y * q.y) * 0.75);
      q.unit = unit(q.c, 'iei'); q.mem = [];
      special.push({ c: q.c, r: q.rho * 1.05 });
      const qB = basis(v3.norm(q.c));
      for (let j = 0; j < n; j++) {
        const cl = x => clamp(x, -0.8, 0.8) * q.rho;   // keep members inside their disc
        const o = j === 0 ? [0, 0, 0] : [cl(gs() * 0.4), cl(gs() * 0.4), cl(gs() * 0.3)];
        q.mem.push(node(inB(q.c, qB, o[0], o[1], o[2]), 4, k, q.unit));
      }
      // connected cluster: each node joins one or two of its nearest earlier members
      for (let j = 1; j < n; j++) {
        const prev = nearest(q.mem, j, q.mem[j], 6);
        edge(q.mem[j], prev[0]);
        if (j > 2 && R() < 0.55) edge(q.mem[j], prev[1]);
        if (j > 4 && R() < 0.25) edge(q.mem[j], pickOne(prev.slice(2, 6)));
      }
    }
    // neighbouring clusters touch
    for (let a = 0; a < 19; a++) for (let b = a + 1; b < 19; b++) {
      const A = IEIC[a], B = IEIC[b];
      if (Math.hypot(A.x - B.x, A.y - B.y) < A.rho + B.rho + 0.066) { edge(pickOne(A.mem), pickOne(B.mem)); if (R() < 0.4) edge(pickOne(A.mem), pickOne(B.mem)); }
    }
  })();
  const ieiCentre = v3.mul(IEIC.reduce((s, q) => v3.add(s, v3.mul(q.c, IEI[q.k][3])), [0, 0, 0]), 1 / 173);

  // ---------------------------------------------------------------- disease modules (after Menche et al., Science 2015)
  const DIS = {};
  (() => {
    const B = basis(D_MSRA), base = v3.mul(D_MSRA, 0.56), u = unit(base, 'dis');
    // MS above RA as seen from the 'dis' view (the tangent 'up' axis), overlapping in the middle
    const add = (cy, sg, n, code) => { const out = []; for (let j = 0; j < n; j++) out.push(node(inB(base, B, gs() * sg, cy + gs() * sg * 0.8, gs() * sg * 0.6), 5, code, u)); return out; };
    const shared = add(0, 0.03, 8, 3), ms = add(0.1, 0.055, 22, 1).concat(shared), ra = add(-0.1, 0.055, 22, 2).concat(shared);
    const pxBase = v3.mul(D_PX, 0.6), pxB = basis(D_PX), pu = unit(pxBase, 'dis');
    const px = []; for (let j = 0; j < 15; j++) px.push(node(inB(pxBase, pxB, gs() * 0.055, gs() * 0.05, gs() * 0.035), 5, 4, pu));
    const wire = list => {
      const cen = list.reduce((s, i) => v3.add(s, pos(i)), [0, 0, 0]).map(x => x / list.length);
      const L = list.slice().sort((a, b) => dv(pos(a), cen) - dv(pos(b), cen));
      for (let j = 1; j < L.length; j++) {
        const prev = nearest(L, j, L[j], 2);
        edge(L[j], prev[0]); if (j > 3 && R() < 0.45) edge(L[j], prev[1]);
      }
    };
    wire(ms); wire(ra); wire(px);
    Object.assign(DIS, { ms, ra, px, shared });
    special.push({ c: base, r: 0.2 }, { c: pxBase, r: 0.12 });
  })();

  // ---------------------------------------------------------------- a rare disease gene and a drug target (slide 24)
  // two star-shaped neighbourhoods, face on to the 'rare' view but with real depth (they are walked around in a headset)
  const RARE = {};
  (() => {
    const B = basis(D_RARE), g0 = v3.mul(D_RARE, 0.56), u = unit(g0, 'rare');
    const at = (x, y, z) => inB(g0, B, x, y, z);
    const g = node(at(0, 0, 0), 6, 0, u), A = [], Bs = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5 + 0.1) * TAU, n = node(at(0.05 * Math.cos(a), 0.05 * Math.sin(a), gs() * 0.04), 6, 0, u);
      A.push(n); edge(g, n);
      for (let j = 0; j < 2 + (k % 2); j++) {
        const b = a + (j - 0.6) * 0.42, m = node(at(0.105 * Math.cos(b) + gs() * 0.008, 0.105 * Math.sin(b) + gs() * 0.008, gs() * 0.045), 6, 0, u);
        Bs.push(m); edge(n, m);
      }
    }
    // the drug target: the second-neighbour furthest along +u (towards the right of the 'rare' view)
    const T = Bs.reduce((b, i) => (v3.dot(v3.sub(pos(i), g0), B[0]) > v3.dot(v3.sub(pos(b), g0), B[0]) ? i : b), Bs[0]);
    const tp = v3.sub(pos(T), g0), tu = Math.atan2(v3.dot(tp, B[1]), v3.dot(tp, B[0])), Cs = [], Ds = [];
    for (let k = 0; k < 4; k++) {
      const a = tu + (k - 1.5) * 0.55, c = node(v3.add(pos(T), inB([0, 0, 0], B, 0.05 * Math.cos(a), 0.05 * Math.sin(a), gs() * 0.04)), 6, 0, u);
      Cs.push(c); edge(T, c);
      const d = node(v3.add(pos(T), inB([0, 0, 0], B, 0.1 * Math.cos(a + 0.2), 0.1 * Math.sin(a + 0.2), gs() * 0.045)), 6, 0, u);
      Ds.push(d); edge(c, d);
      if (k === 1) { const d2 = node(v3.add(pos(T), inB([0, 0, 0], B, 0.095 * Math.cos(a - 0.3), 0.095 * Math.sin(a - 0.3), -0.035)), 6, 0, u); Ds.push(d2); edge(c, d2); }
    }
    Object.assign(RARE, { g, A, Bs, T, Cs, Ds, c0: g0 });
    special.push({ c: v3.add(g0, v3.mul(B[0], 0.06)), r: 0.24 });
  })();

  // ---------------------------------------------------------------- global hubs near the centre
  const HUBS = [];
  for (let h = 0; h < 30; h++) {
    let p;
    do { p = v3.mul(K.unit(R), 0.04 + 0.2 * Math.sqrt(R())); } while (dv(p, C_ATP) < 0.08);
    HUBS.push(node(p, 1, h, unit(p, 'hub')));
  }

  // ---------------------------------------------------------------- background neighbourhoods
  const COMM = [];   // { c, r, u, mem }
  (() => { for (let k = 0, got = 0; got < 5700; k++) {
    let c, r, n, sg;
    for (let tries = 0; tries < 40; tries++) {
      r = 0.05 + 0.77 * Math.pow(R(), 0.8); n = 6 + Math.floor(46 * Math.pow(R(), 2.6));
      sg = (0.012 + 0.0042 * Math.sqrt(n)) * (0.7 + 0.55 * r); c = v3.mul(K.unit(R), r);
      if (special.every(s => dv(c, s.c) > s.r + sg * 1.4)) break;
    }
    const u = unit(c, 'comm'), ax = v3.norm(v3.cross(K.unit(R), c)), off = [];
    for (let j = 0; j < n; j++) {
      let o = [gs() * sg, gs() * sg, gs() * sg];
      o = v3.add(o, v3.mul(ax, v3.dot(o, ax) * 0.6));
      off.push(o);
    }
    off.sort((a, b) => vl(a) - vl(b));
    const mem = off.map(o => { let p = v3.add(c, o); const l = vl(p); if (l > 0.98) p = v3.mul(p, 0.98 / l); return node(p, 0, k, u); });
    // growth with local preferential attachment: each newcomer joins 1-3 of its nearest earlier members
    for (let j = 1; j < n; j++) {
      const near = nearest(mem, j, mem[j], 6);
      const m = 1 + (R() < 0.62) + (R() < 0.25);
      for (let q = 0; q < m && q < near.length; q++) edge(mem[j], wpick(near, i => (ND[i] + 1) * Math.sqrt(Math.sqrt(ND[i] + 1))));
    }
    // close some triangles (clustering)
    for (let rep = 0; rep < 2; rep++) for (const i of mem) if (R() < 0.6 && ADJ[i].length) { const j = pickOne(ADJ[i]); if (ADJ[j].length) edge(i, pickOne(ADJ[j])); }
    COMM.push({ c, r, u, mem }); got += n;
  } })();
  // neighbouring neighbourhoods are linked; every neighbourhood also links inwards
  (() => { for (let a = 0; a < COMM.length; a++) {
    const A = COMM[a], hubw = i => ND[i] + 1, near = [];
    // the five nearest neighbourhoods, nearest first (one pass, keeping a sorted top five)
    const nd = [];
    for (let b = 0; b < COMM.length; b++) {
      if (b === a) continue;
      const x = dv(A.c, COMM[b].c);
      if (near.length === 5 && x >= nd[4]) continue;
      let q = Math.min(near.length, 4);
      while (q > 0 && nd[q - 1] > x) { nd[q] = nd[q - 1]; near[q] = near[q - 1]; q--; }
      nd[q] = x; near[q] = b;
    }
    for (const b of near) { edge(wpick(A.mem, hubw), wpick(COMM[b].mem, hubw)); if (R() < 0.35) edge(pickOne(A.mem), pickOne(COMM[b].mem)); }
    if (R() < 0.6) edge(A.mem[0], HUBS.reduce((h, i) => (dist(i, A.mem[0]) < dist(h, A.mem[0]) ? i : h), HUBS[0]));
    else {
      const inner = COMM.filter(B => B.r < A.r - 0.05);
      if (inner.length) { const B = inner.reduce((x, y) => (dv(y.c, A.c) < dv(x.c, A.c) ? y : x)); edge(A.mem[0], wpick(B.mem, hubw)); }
    }
  } })();
  const BGN = []; for (const C of COMM) for (const i of C.mem) BGN.push(i);
  // hubs: a few proteins with hundreds of partners, mostly nearby (heavy-tailed degrees)
  (() => {
    const w = new Float64Array(BGN.length);
    HUBS.forEach((h, k) => {
      const want = Math.round(420 * Math.pow(k + 1, -0.78));
      let s = 0;
      for (let q = 0; q < BGN.length; q++) { const x = 0.07 + dist(h, BGN[q]); s += 1 / (x * x * Math.sqrt(Math.sqrt(x))); w[q] = s; }
      for (let q = 0, got = 0; q < want * 3 && got < want; q++) {
        const x = R() * s; let lo = 0, hi = BGN.length - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (w[m] < x) lo = m + 1; else hi = m; }
        if (edge(h, BGN[lo])) got++;
      }
    });
    for (let a = 0; a < HUBS.length; a++) for (let b = a + 1; b < HUBS.length; b++) if (R() < 0.3) edge(HUBS[a], HUBS[b]);
  })();
  // spatial grid over background proteins and hubs, for weaving the special nodes in
  // cells of GC (31 per axis covers the network) as offsets into one sorted list, members in insertion order
  const GC = 0.07, GW = 31, gc1 = v => clamp(Math.floor(v / GC) + 15, 0, GW - 1);
  const gIds = BGN.concat(HUBS), gKey = new Int32Array(gIds.length), gStart = new Int32Array(GW * GW * GW + 1), gList = new Int32Array(gIds.length);
  gIds.forEach((i, q) => { gKey[q] = (gc1(P[3 * i]) * GW + gc1(P[3 * i + 1])) * GW + gc1(P[3 * i + 2]); gStart[gKey[q] + 1]++; });
  for (let k = 0; k < GW * GW * GW; k++) gStart[k + 1] += gStart[k];
  (() => { const fill = gStart.slice(0, -1); gIds.forEach((i, q) => { gList[fill[gKey[q]]++] = i; }); })();
  function nearBg(p, rad) {
    const out = [], n = Math.ceil(rad / GC), r2 = rad * rad;
    const cx = Math.floor(p[0] / GC) + 15, cy = Math.floor(p[1] / GC) + 15, cz = Math.floor(p[2] / GC) + 15;
    for (let x = Math.max(0, cx - n); x <= Math.min(GW - 1, cx + n); x++) for (let y = Math.max(0, cy - n); y <= Math.min(GW - 1, cy + n); y++) {
      for (let z = Math.max(0, cz - n); z <= Math.min(GW - 1, cz + n); z++) {
        const k = (x * GW + y) * GW + z;
        for (let q = gStart[k]; q < gStart[k + 1]; q++) { const i = gList[q], dx = P[3 * i] - p[0], dy = P[3 * i + 1] - p[1], dz = P[3 * i + 2] - p[2]; if (dx * dx + dy * dy + dz * dz < r2) out.push(i); }
      }
    }
    return out;
  }
  function weave(i, n, rad, hubP) {
    let cand = nearBg(pos(i), rad);
    for (let grow = rad; cand.length < 3 && grow < 0.6; grow += 0.08) cand = nearBg(pos(i), grow + 0.08);
    for (let q = 0; q < n; q++) {
      if (R() < hubP) edge(i, wpick(HUBS, h => ND[h]));
      else if (cand.length) edge(i, wpick(cand, j => 1 / (0.03 + dist(i, j))));
    }
  }
  // the curated proteins join the background: big curated hubs (TP53 above all) get many partners
  for (let i = 0; i < NC; i++) {
    const k = core[i].degree;
    weave(i, 1 + Math.round(k * 0.8) + (k >= 7 ? 3 * k : 0) + (core[i].sym === 'TP53' ? 60 : 0), 0.14 + 0.01 * k, 0.2);
  }
  for (const i of ATPN) weave(i, 1 + (R() < 0.5), 0.12, 0.25);
  for (const q of IEIC) for (const i of q.mem) if (R() < 0.6) weave(i, 1, 0.16, 0.15);
  for (const i of DIS.ms.concat(DIS.ra.slice(0, 22), DIS.px)) if (R() < 0.7) weave(i, 1, 0.16, 0.1);
  // the rare disease's second neighbours (except the target) and the target's outer ring join the background,
  // so the two-hop neighbourhoods stay exactly as built
  for (const i of RARE.Bs) if (i !== RARE.T && !ADJ[RARE.T].some(j => ADJ[j].includes(i))) weave(i, 1 + (R() < 0.5), 0.15, 0);
  for (const i of RARE.Ds) weave(i, 1, 0.15, 0);

  // ---------------------------------------------------------------- hair: tufts and filaments towards the rim
  (() => {
    let hair = 0;
    for (const C of COMM) {
      if (C.r < 0.4) continue;
      for (const i of C.mem.slice()) {
        if (hair > 3000) break;
        const p0 = pos(i), out = v3.norm(v3.add(v3.norm(p0), v3.mul(v3.norm(v3.sub(p0, C.c)), 0.6)));
        if (R() < 0.28) {
          const n = 1 + Math.floor(5 * R() * R());
          for (let j = 0; j < n; j++) {
            let p = v3.add(p0, v3.add(v3.mul(out, 0.02 + 0.045 * R()), [gs() * 0.014, gs() * 0.014, gs() * 0.014]));
            if (vl(p) > 1.05) p = v3.mul(p, 1.05 / vl(p));
            edge(i, node(p, 7, C.u, C.u)); hair++;
          }
        } else if (R() < 0.1) {
          let prev = i, p = p0, d = out;
          const L = 2 + Math.floor(5 * R());
          for (let j = 0; j < L; j++) {
            d = v3.norm(v3.add(d, [gs() * 0.3, gs() * 0.3, gs() * 0.3]));
            p = v3.add(p, v3.mul(d, 0.028 + 0.014 * R()));
            if (vl(p) > 1.07) break;
            const n = node(p, 7, C.u, C.u); edge(prev, n); prev = n; hair++;
            if (R() < 0.15) { const m = node(v3.add(p, [gs() * 0.02, gs() * 0.02, gs() * 0.02]), 7, C.u, C.u); edge(n, m); hair++; }
          }
          if (R() < 0.15) edge(prev, pickOne(C.mem));
        }
      }
    }
  })();

  // ---------------------------------------------------------------- one connected network
  function bfs(src, limit = 1e9) {
    const d = new Int16Array(N).fill(-1), par = new Int32Array(N).fill(-1), q = new Int32Array(N);
    let h = 0, t = 0;
    for (const s of [].concat(src)) { d[s] = 0; q[t++] = s; }
    while (h < t) {
      const x = q[h++]; if (d[x] >= limit) continue;
      for (const y of ADJ[x]) if (d[y] < 0) { d[y] = d[x] + 1; par[y] = x; q[t++] = y; }
    }
    return { d, par };
  }
  (() => {
    const seen = new Uint8Array(N), q = new Int32Array(N);
    const flood = s => { let h = 0, t = 0; seen[s] = 1; q[t++] = s; while (h < t) { const x = q[h++]; for (const y of ADJ[x]) if (!seen[y]) { seen[y] = 1; q[t++] = y; } } };
    flood(HUBS[0]);
    // every stray piece joins the main network at its nearest protein
    for (let i = 0; i < N; i++) if (!seen[i]) {
      let best = -1, bd = 9;
      for (let j = 0; j < N; j++) if (seen[j] && KIND[j] !== 6) { const x = dist(i, j); if (x < bd) { bd = x; best = j; } }
      edge(i, best); flood(i);
    }
  })();

  // ---------------------------------------------------------------- the patient (slide 29): seeds, candidates, propagation
  const PAT = {};
  (() => {
    const cl = IEIC[4].mem;   // NF-kB and chromatin
    // seeds on the lower-left side of the cluster, the causal gene across on the upper right (labels apart in the 'heat' view)
    const q4 = IEIC[4], side = v3.norm(v3.add(ieiB[0], ieiB[1])), sd = i => v3.dot(v3.sub(pos(i), q4.c), side);
    const seedAt = v3.sub(q4.c, v3.mul(side, q4.rho * 0.35));
    // farthest-point choice inside the lower-left half, so the three seeds stand apart and can be counted
    const pool0 = cl.filter(i => dv(pos(i), seedAt) < 0.8 * q4.rho && sd(i) < 0.1 * q4.rho);
    const seeds = [pool0.reduce((b, i) => (dv(pos(i), seedAt) < dv(pos(b), seedAt) ? i : b))];
    const gap = i => Math.min(...seeds.map(j => dist(i, j)));
    while (seeds.length < 3) seeds.push(pool0.filter(i => !seeds.includes(i)).reduce((b, i) => (gap(i) > gap(b) ? i : b)));
    const causal = cl.filter(i => !seeds.includes(i)).sort((a, b) => sd(b) - sd(a))[0];
    edge(causal, seeds[0]); edge(causal, seeds[1]);
    const { d } = bfs(seeds);
    const cands = [causal];
    // two more variant carriers in other immunity clusters, the rest scattered over the network at 2-6 hops
    for (const k of [5, 10]) cands.push(IEIC[k].mem.slice().sort((a, b) => ND[a] - ND[b])[1]);
    const pool = [];
    for (let i = 0; i < N; i++) if ((KIND[i] === 0 || KIND[i] === 7) && ND[i] <= 4 && d[i] >= 2 && d[i] <= 6) pool.push(i);
    for (let g = 0; cands.length < 12 && g < 5000; g++) { const i = pickOne(pool); if (!cands.includes(i) && cands.every(j => dist(i, j) > (g < 4000 ? 0.25 : 0))) cands.push(i); }
    Object.assign(PAT, { seeds, causal, cands, hop: d });
  })();
  // random walk with restart (restart 0.3) from the seeds, on the whole network
  const HEAT = new Float32Array(N);
  (() => {
    let p = new Float64Array(N), nx = new Float64Array(N);
    const inv = new Float64Array(N), q = new Float64Array(N);
    for (let i = 0; i < N; i++) inv[i] = 0.7 / ND[i];
    for (const s of PAT.seeds) p[s] = 1 / 3;
    for (let it = 0; it < 50; it++) {
      nx.fill(0);
      for (let i = 0; i < N; i++) q[i] = p[i] * inv[i];
      for (let e = 0; e < E; e++) { const a = EA[e], b = EB[e]; nx[b] += q[a]; nx[a] += q[b]; }
      for (const s of PAT.seeds) nx[s] += 0.3 / 3;
      const t = p; p = nx; nx = t;
    }
    const top = Math.max(...PAT.seeds.map(s => p[s])), L1 = Math.log10(top), L0 = L1 - 5;
    for (let i = 0; i < N; i++) HEAT[i] = clamp((Math.log10(p[i] + 1e-30) - L0) / (L1 - L0), 0, 1);
    PAT.raw = p;
    PAT.rank = PAT.cands.slice().sort((a, b) => p[b] - p[a]);
  })();
  const HOPMAX = 8;

  // ---------------------------------------------------------------- rare disease neighbourhoods (two hops, from the graph)
  (() => {
    const dg = bfs(RARE.g, 2).d, dt = bfs(RARE.T, 2).d;
    RARE.dis = []; RARE.treat = [];
    for (let i = 0; i < N; i++) {
      if (dg[i] >= 0 && dg[i] <= 2) { FLAG[i] |= 1; RARE.dis.push(i); }
      if (dt[i] >= 0 && dt[i] <= 2) { FLAG[i] |= 2; RARE.treat.push(i); }
    }
    FLAG[RARE.g] |= 4; FLAG[RARE.T] |= 8;
  })();

  // ---------------------------------------------------------------- colours: rest, neighbourhoods, hubs
  const HOOD = new Float32Array(N * 3), BASE = new Float32Array(N * 3), HUBS_S = new Float32Array(N);
  (() => {
    // muted district palette for the background, greedy so that neighbours differ
    const pal = [];
    for (let k = 0; k < 14; k++) { const c = new THREE.Color().setHSL((k * 0.382 + 0.05) % 1, 0.34 + 0.1 * (k % 3) / 2, 0.5 + 0.06 * (k % 2)); pal.push([c.r, c.g, c.b]); }
    const used = new Map();
    for (const C of COMM) {
      const near = COMM.filter(B => B !== C && dv(B.c, C.c) < 0.22 && used.has(B.u)).map(B => used.get(B.u));
      let k = Math.floor(R() * 14); for (let s = 0; s < 14 && near.includes(k); s++) k = (k + 1) % 14;
      used.set(C.u, k); units[C.u].hood = pal[k];
    }
    MOD.forEach((M, k) => { units[M.unit].hood = MCOL[k]; });
    IEIC.forEach((q, k) => { units[q.unit].hood = ICOL[k]; });
    for (const u of units) if (!u.hood) u.hood = pal[Math.floor(R() * 14)];
    for (const h of HUBS) units[UNIT[h]].hood = units[COMM.reduce((b, C) => (dv(C.c, pos(h)) < dv(b.c, pos(h)) ? C : b), COMM[0]).u].hood;
    const maxD = Math.max(...Array.from(ND.subarray(0, N)));
    const stops = [[0, [1.0, 0.86, 0.62]], [0.22, [0.86, 0.9, 1.0]], [0.42, [0.5, 0.76, 1.0]], [0.68, [0.34, 0.52, 1.0]], [0.9, [0.46, 0.4, 0.98]], [1.1, [0.72, 0.36, 0.9]]];
    for (let i = 0; i < N; i++) {
      const h = units[UNIT[i]].hood;
      HOOD.set(h, 3 * i);
      let c = K.ramp(stops, vl(pos(i)));
      c = v3.lerp(c, h, 0.14);
      if (KIND[i] === 1) c = v3.mul(c, 1.15);
      BASE.set(c, 3 * i);
      let s = clamp(Math.log(ND[i]) / Math.log(maxD), 0, 1);
      if (i < NC && core[i].essential) s = Math.max(s, 0.62);
      HUBS_S[i] = s;
    }
  })();
  // reveal order: from the centre outwards
  const RV = new Float32Array(N);
  (() => { for (let i = 0; i < N; i++) RV[i] = Math.pow(clamp(vl(pos(i)) / 1.07, 0, 1), 1.15) * 0.9 + R() * 0.05; })();

  // ---------------------------------------------------------------- the city: a flat map that keeps neighbourhoods together
  const F = new Float32Array(N * 3);
  (() => {
    // each neighbourhood becomes a district disc, then the discs push apart. A district starts at its 3D direction seen
    // from above, at a map radius that grows with its 3D radius: the dense core is downtown, the sparse rim the suburbs.
    // The immunity clusters move as one patch (index U) and keep their packing inside it.
    const start = c => { const h = Math.hypot(c[0], c[2]), rho = 1.12 * Math.pow(vl(c), 0.92); return h > 1e-5 ? [c[0] / h * rho, c[2] / h * rho] : [rho, 0]; };
    const U = units.length, X = new Float64Array(U + 1), Z = new Float64Array(U + 1), X0 = new Float64Array(U + 1), Z0 = new Float64Array(U + 1), RH = new Float64Array(U + 1);
    const IS = 0.45, live = [], fixed = new Uint8Array(U + 1);
    units.forEach((u, k) => {
      let n = 0; for (const i of u.mem) n += KIND[i] === 7 ? 0.3 : 1;
      // ATP synthase gets room on the map so its 21 contacts stay readable
      RH[k] = u.kind === 'mod' ? 0.0175 * Math.sqrt(n) : u.kind === 'atp' ? 0.08 : u.kind === 'hub' ? 0.016
        : (u.kind === 'dis' ? 3 : u.kind === 'rare' ? 2 : 1) * (0.0088 * Math.sqrt(n) + 0.004);
      [X0[k], Z0[k]] = start(u.c); X[k] = X0[k]; Z[k] = Z0[k];
      // downtown: TP53's district holds the centre of the map
      if (k === MOD[2].unit) { X0[k] = X[k] = Z0[k] = Z[k] = 0; fixed[k] = 1; }
      if (u.kind !== 'iei') live.push(k);
    });
    RH[U] = IS * Math.max(...IEIC.map(q => Math.hypot(q.x, q.y) + q.rho)) + 0.01;
    [X0[U], Z0[U]] = start(ieiCentre); X[U] = X0[U]; Z[U] = Z0[U]; live.push(U);
    // big districts are checked against each other, and against the small ones through the small ones' grid
    const big = [], small = [];
    for (const a of live) (RH[a] > 0.067 ? big : small).push(a);
    const cs = 0.14, GN = 48, head = new Int32Array(GN * GN), nxt = new Int32Array(U + 1), gi = v => clamp(Math.floor(v / cs) + 24, 0, GN - 1);
    const reach = big.map(a => Math.ceil((RH[a] + 0.067 + 0.006) / cs));
    const sep = (a, b) => {
      const dx = X[b] - X[a], dz = Z[b] - Z[a], m = RH[a] + RH[b] + 0.006, d2 = dx * dx + dz * dz;
      if (d2 >= m * m) return;
      const d = Math.sqrt(d2) || 1e-4, push = (m - d) / d, wa = fixed[a] ? 0 : fixed[b] ? 1 : RH[b] * RH[b] / (RH[a] * RH[a] + RH[b] * RH[b]);
      X[a] -= dx * push * wa; Z[a] -= dz * push * wa; X[b] += dx * push * (1 - wa); Z[b] += dz * push * (1 - wa);
    };
    for (let it = 0; it < 50; it++) {
      head.fill(-1);
      for (const a of small) { const c = gi(X[a]) * GN + gi(Z[a]); nxt[a] = head[c]; head[c] = a; }
      big.forEach((a, q) => {
        for (const b of big) if (b > a) sep(a, b);
        const cx = gi(X[a]), cz = gi(Z[a]), n = reach[q];
        for (let gx = Math.max(0, cx - n); gx <= Math.min(GN - 1, cx + n); gx++) for (let gz = Math.max(0, cz - n); gz <= Math.min(GN - 1, cz + n); gz++) {
          for (let b = head[gx * GN + gz]; b >= 0; b = nxt[b]) sep(a, b);
        }
      });
      for (const a of small) {
        const cx = gi(X[a]), cz = gi(Z[a]);
        for (let gx = Math.max(0, cx - 1); gx <= Math.min(GN - 1, cx + 1); gx++) for (let gz = Math.max(0, cz - 1); gz <= Math.min(GN - 1, cz + 1); gz++) {
          for (let b = head[gx * GN + gz]; b >= 0; b = nxt[b]) if (b > a) sep(a, b);
        }
      }
      const pull = it < 34 ? 0.03 : 0.005;
      for (const a of live) if (!fixed[a]) { X[a] += (X0[a] - X[a]) * pull - X[a] * 0.004; Z[a] += (Z0[a] - Z[a]) * pull - Z[a] * 0.004; }
    }
    // patch x runs to the right of the 'iei' view; on the map it runs across the patch
    IEIC.forEach(q => { X[q.unit] = X[U] + q.x * IS; Z[q.unit] = Z[U] - q.y * IS; RH[q.unit] = q.rho * IS; });
    // members keep their place inside the district (their offset in the tangent plane; outward offsets point outwards)
    units.forEach((u, k) => {
      const c = u.c, l = vl(c), w = l > 1e-3 ? v3.mul(c, 1 / l) : [0, 1, 0], B = basis(w);
      const out = Math.hypot(X[k], Z[k]) > 1e-4 ? [X[k] / Math.hypot(X[k], Z[k]), Z[k] / Math.hypot(X[k], Z[k])] : [1, 0];
      let rms = 0;
      const loc = u.mem.map(i => {
        const o = v3.sub(pos(i), c), a = v3.dot(o, B[0]), b = v3.dot(o, B[1]), r = v3.dot(o, B[2]);
        if (KIND[i] !== 7) rms += a * a + b * b + r * r;
        return [a, b, r];
      });
      const nn = u.mem.filter(i => KIND[i] !== 7).length || 1;
      rms = Math.sqrt(rms / nn) || 0.02;
      const s = u.kind === 'mod' ? RH[k] / 1.7 / MOD.find(M => M.unit === k).s : u.kind === 'hub' ? 1 : RH[k] / ((u.kind === 'dis' ? 1.5 : 1.9) * rms);
      u.mem.forEach((i, j) => {
        const [a, b, r] = loc[j];
        F[3 * i] = X[k] + (a + r * out[0] * 0.8) * s; F[3 * i + 2] = Z[k] + (b + r * out[1] * 0.8) * s;
      });
      u.flat = [X[k], 0, Z[k]];
    });
    // curated proteins carry buildings: keep them apart
    for (const M of MOD) for (let it = 0; it < 30; it++) for (let x = 0; x < M.mem.length; x++) for (let y = x + 1; y < M.mem.length; y++) {
      const a = M.mem[x], b = M.mem[y], dx = F[3 * b] - F[3 * a], dz = F[3 * b + 2] - F[3 * a + 2], d2 = dx * dx + dz * dz, m = 0.03;
      if (d2 < m * m) { const d = Math.sqrt(d2) || 1e-4, p = (m - d) * 0.5 / d; F[3 * a] -= dx * p; F[3 * a + 2] -= dz * p; F[3 * b] += dx * p; F[3 * b + 2] += dz * p; }
    }
    // fit the disc
    let nr = 0; const rr = new Float64Array(N);
    for (let i = 0; i < N; i++) if (KIND[i] !== 7) rr[nr++] = Math.hypot(F[3 * i], F[3 * i + 2]);
    rr.subarray(0, nr).sort();
    const sc = 1.0 / rr[Math.floor(nr * 0.995)];
    // squeeze the few outliers softly inside the rim (r 1.12)
    const soft = l => (l < 0.98 ? l : 0.98 + 0.14 * Math.tanh((l - 0.98) / 0.14));
    for (let i = 0; i < N; i++) {
      let x = F[3 * i] * sc, z = F[3 * i + 2] * sc; const l = Math.hypot(x, z), m = l > 1e-6 ? soft(l) / l : 1;
      F[3 * i] = x * m; F[3 * i + 1] = 0; F[3 * i + 2] = z * m;
    }
    for (const u of units) u.flat = v3.mul(u.flat, sc);
  })();
  const fpos = i => [F[3 * i], F[3 * i + 1], F[3 * i + 2]];

  // ---------------------------------------------------------------- pins and their route
  // shortest paths (fewest steps); among the equally short ones, each step takes the partner that keeps the route
  // shortest on the map, so routes read like a drive across town. d: hop distances from b (bfs(b).d)
  const mapD = (i, j) => Math.hypot(F[3 * i] - F[3 * j], F[3 * i + 2] - F[3 * j + 2]);
  function walk(a, b, d) {
    if (d[a] < 0) return null;
    const out = [a];
    for (let x = a; x !== b;) {
      let best = -1, bs = 1e9;
      for (const y of ADJ[x]) if (d[y] === d[x] - 1) { const s = mapD(x, y) + mapD(y, b); if (s < bs) { bs = s; best = y; } }
      out.push(best); x = best;
    }
    return out;
  }
  const path = (a, b) => (a === b ? [a] : walk(a, b, bfs(b).d));
  const PIN = {};
  (() => {
    const red = SYM.get('TP53'), { d } = bfs(red);
    // the blue pin: a non-essential protein with few partners on the edge of the map (and of the 3D network), a few steps from TP53,
    // whose route runs fairly straight across the map
    let blue = -1, bs = -1;
    for (let i = 0; i < NC; i++) {
      const r = Math.hypot(F[3 * i], F[3 * i + 2]);
      if (core[i].degree > 3 || core[i].essential || r < 0.6 || d[i] < 3) continue;
      const w = walk(i, red, d); let len = 0;
      for (let k = 1; k < w.length; k++) len += mapD(w[k - 1], w[k]);
      const s = r + 0.4 * vl(pos(i)) + 0.15 * Math.min(d[i], 5) - 0.6 * (len / r - 1) + 0.25 * (F[3 * i] * D_BLUE[0] + F[3 * i + 2] * D_BLUE[2]);
      if (s > bs) { bs = s; blue = i; }
    }
    Object.assign(PIN, { red, blue, route: walk(red, blue, bfs(blue).d) });
  })();

  // ---------------------------------------------------------------- shared uniforms and GLSL
  const U = {
    uReveal: { value: 1 }, uFlat: { value: 0 }, uBuild: { value: 0 }, uEdges: { value: 1 }, uDimE: { value: 0 }, uHub: { value: 0 },
    uHood: { value: 0 }, uAtp: { value: 0 }, uDis: { value: 0 }, uRare: { value: 0 }, uIei: { value: 0 }, uHeatF: { value: 0 },
    uHeatOn: { value: 0 }, uCand: { value: 0 }, uSel: { value: 0 }, uPath: { value: new Array(10).fill(0) },
    uRouteP: { value: 0 }, uRouteL: { value: 1 },
  };
  const LOOK = `
uniform float uReveal, uFlat, uBuild, uEdges, uDimE, uHub, uHood, uAtp, uDis, uRare, uIei, uHeatF, uHeatOn, uCand, uSel;
uniform float uPath[10];
// staggered flattening: the centre lands first
float flatK(float rv) { float x = clamp((uFlat - 0.3 * rv) / 0.7, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
vec3 wob(vec3 p) { return 0.0035 * sin(uTime * vec3(0.41, 0.47, 0.37) + p.zxy * 9.0 + p.yzx * 6.0); }
float pathOf(float m) { float v = 0.0; for (int k = 0; k < 10; k++) { if (abs(m - float(k)) < 0.5) v = uPath[k]; } return v; }
float bit(float f, float b) { return mod(floor(f / b + 0.01), 2.0); }
vec3 heatRamp(float h) {
  vec3 c = mix(vec3(0.05, 0.0, 0.0), vec3(0.9, 0.1, 0.04), smoothstep(0.0, 0.4, h));
  c = mix(c, vec3(1.0, 0.62, 0.12), smoothstep(0.4, 0.75, h));
  return mix(c, vec3(1.0, 0.97, 0.9), smoothstep(0.8, 1.0, h));
}
vec3 hubRamp(float s) {
  vec3 c = mix(vec3(0.12, 0.24, 0.55), vec3(1.0, 0.66, 0.2), smoothstep(0.3, 0.6, s));
  return mix(c, vec3(1.0, 0.3, 0.2), smoothstep(0.62, 0.92, s));
}
// a node's colour in the current look; sz = size factor, hi = how highlighted (0 dims under focus)
// hg: how highlighted as a member of a lit group (pathway, ATP synthase, disease, rare, immunity cluster)
vec3 look(vec3 base, vec3 gc, vec3 hood, vec4 g, vec4 h, float fk, out float sz, out float hi, out float hg) {
  float kind = g.x, hs = g.z;
  sz = 1.0; hi = 0.0; hg = 0.0;
  float street = fk * ((kind > 1.5 && kind < 3.5) ? 0.0 : 1.0);
  vec3 c = mix(base, vec3(1.0, 0.76, 0.42), street * 0.85);
  sz *= 1.0 - 0.3 * street;
  c = mix(c, hood * 1.15, uHood);
  c = mix(c, hubRamp(hs), uHub);
  sz *= mix(1.0, 0.45 + 2.2 * hs * hs, uHub);
  hi = max(hi, uHub * smoothstep(0.4, 0.75, hs));
  float p = kind > 1.5 && kind < 2.5 ? pathOf(g.y) : 0.0;
  c = mix(c, gc, p); sz *= 1.0 + 1.5 * p; hg = max(hg, p);
  float at = kind > 2.5 && kind < 3.5 ? uAtp : 0.0;
  c = mix(c, vec3(0.3, 0.58, 1.0) * 1.15, at); sz *= 1.0 + 1.0 * at; hg = max(hg, at);
  float ds = kind > 4.5 && kind < 5.5 ? uDis : 0.0;
  c = mix(c, gc * 1.3, ds); sz *= 1.0 + 1.4 * ds; hg = max(hg, ds);
  float rd = bit(h.z, 1.0), rt = bit(h.z, 2.0), rk = bit(h.z, 4.0) + bit(h.z, 8.0), rr = uRare * max(rd, rt);
  vec3 rc = (rd > 0.5 && rt > 0.5) ? vec3(0.85, 0.55, 0.62) : (rd > 0.5 ? vec3(1.0, 0.26, 0.2) : vec3(0.16, 0.86, 0.8));
  if (bit(h.z, 4.0) > 0.5) rc = vec3(1.0, 0.16, 0.12);
  c = mix(c, rc * 1.25, rr); sz *= 1.0 + 1.1 * rr + 2.0 * uRare * rk; hg = max(hg, rr);
  float ie = kind > 3.5 && kind < 4.5 ? uIei : 0.0;
  c = mix(c, gc * 1.35, ie); sz *= 1.0 + 1.2 * ie; hg = max(hg, ie);
  float shown = h.x * smoothstep(h.y - 0.4, h.y + 0.6, uHeatF);
  c = mix(c, heatRamp(shown) * 1.2, uHeatOn) + 0.12 * base * uHeatOn * (1.0 - smoothstep(0.0, 0.15, shown));
  sz *= mix(1.0, 0.4 + 1.8 * shown * shown, uHeatOn);
  hi = max(hi, uHeatOn * smoothstep(0.25, 0.6, shown));
  return c;
}
// brighter in front, darker behind the centre of the set (depth cue)
float depthCue(vec4 mv) { vec4 o = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); float s = length(modelViewMatrix[0].xyz); return clamp(1.0 - (o.z - mv.z) / s * 0.32, 0.5, 1.3); }
`;
  const mat = (vs, fs, extra = {}) => {
    const m = new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U, extra.uniforms || {}),
      vertexShader: K.GLSL + LOOK + vs, fragmentShader: fs,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }, extra.opts || {}));
    set.mats.push(m);
    return m;
  };
  const spin = new THREE.Group();
  set.group.add(spin);
  const attr = (g, name, arr, n) => g.setAttribute(name, new THREE.BufferAttribute(arr, n));

  // ---------------------------------------------------------------- nodes
  const nodeGeo = new THREE.BufferGeometry();
  const GC4 = new Float32Array(N * 3), G4 = new Float32Array(N * 4), H4 = new Float32Array(N * 4), SZ = new Float32Array(N), SEL = new Float32Array(N);
  (() => {
    for (let i = 0; i < N; i++) {
      const k = KIND[i];
      const gc = k === 2 ? MCOL[GI[i]] : k === 4 ? ICOL[GI[i]] : k === 3 ? PXB
        : k === 5 ? (GI[i] === 1 ? RED : GI[i] === 2 ? AMB : GI[i] === 3 ? [1, 0.42, 0.25] : PXB) : [1, 1, 1];
      GC4.set(gc, 3 * i);
      G4.set([k, GI[i], HUBS_S[i], RV[i]], 4 * i);
      H4.set([HEAT[i], PAT.hop[i] < 0 ? 99 : PAT.hop[i], FLAG[i], 0], 4 * i);
      SZ[i] = Math.min(0.045, 0.0046 + 0.0038 * Math.log2(1 + ND[i])) + (k === 2 ? 0.004 : k === 3 ? 0.006 : k === 4 || k === 5 || k === 6 ? 0.003 : 0);
    }
    attr(nodeGeo, 'position', P.slice(0, 3 * N), 3); attr(nodeGeo, 'aFlat', F, 3); attr(nodeGeo, 'aCol', BASE, 3); attr(nodeGeo, 'aGc', GC4, 3);
    attr(nodeGeo, 'aHood', HOOD, 3); attr(nodeGeo, 'aG', G4, 4); attr(nodeGeo, 'aH', H4, 4); attr(nodeGeo, 'aSize', SZ, 1); attr(nodeGeo, 'aSel', SEL, 1);
    nodeGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);
  })();
  const nodeMat = mat(`
attribute vec3 aFlat, aCol, aGc, aHood; attribute vec4 aG, aH; attribute float aSize, aSel;
uniform float uA; varying vec3 vC; varying float vA, vWh;
void main() {
  float rv = aG.w, fk = flatK(rv);
  vec3 pos = mix(position + wob(position), aFlat, fk);
  float sz, hi, hg;
  vec3 c = look(aCol, aGc, aHood, aG, aH, fk, sz, hi, hg);
  hi = max(hi, hg);
  float sl = aSel * uSel;
  c = mix(c, vec3(1.0), sl * 0.45); sz *= 1.0 + 0.9 * sl; hi = max(hi, sl);
  float br = mix(1.0, 0.11, max(uDimE, uSel * 0.75) * (1.0 - hi));
  // the dense centre would burn out: tone it down unless highlighted
  br *= mix(mix(0.46, 1.0, smoothstep(0.05, 0.45, length(position))), 1.0, max(hi, fk));
  if (aG.x > 1.5 && aG.x < 2.5) sz *= 1.0 - 0.8 * uBuild * fk;
  float ap = smoothstep(rv, rv + 0.035, uReveal);
  float fl = uReveal < 0.999 ? exp(-pow((uReveal - rv - 0.03) / 0.022, 2.0)) : 0.0;
  br *= 0.86 + 0.14 * sin(uTime * 1.7 + position.x * 53.0 + position.z * 31.0);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize * sz * ap * (1.0 + 1.2 * fl), mv);
  // members of a lit group keep their own colour: no depth-cue overdrive, little white in the core
  float dc = depthCue(mv);
  vC = c * br * mix(dc, min(dc, 1.0), hg) * (1.0 + 1.5 * fl);
  vWh = 1.0 - 0.85 * hg;
  vA = uA * ap;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA, vWh;
void main() {
  vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.55, 0.2, d), halo = pow(1.0 - d, 2.4);
  vec3 col = vC * (0.7 + 0.45 * core) + vec3(0.22 * core * vWh) * min(length(vC), 1.0);
  gl_FragColor = vec4(col, vA * (core * 0.85 + halo * 0.5));
}`);
  const nodePts = new THREE.Points(nodeGeo, nodeMat);
  nodePts.renderOrder = 3;
  spin.add(nodePts);

  // ---------------------------------------------------------------- haze: big faint sprites that make the dense centre glow
  (() => {
    const n = 520, g = new THREE.BufferGeometry(), F3 = () => new Float32Array(n * 3);
    const p = F3(), f = F3(), c = F3(), h = F3(), sz = new Float32Array(n), rv = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      let i; do { i = Math.floor(R() * N); } while (KIND[i] === 7 || R() > 1.15 - vl(pos(i)));
      const o = [gs() * 0.04, gs() * 0.04, gs() * 0.04];
      p.set(v3.add(pos(i), o), 3 * k); f.set([F[3 * i] + o[0], 0, F[3 * i + 2] + o[2]], 3 * k);
      c.set(BASE.subarray(3 * i, 3 * i + 3), 3 * k); h.set(HOOD.subarray(3 * i, 3 * i + 3), 3 * k);
      sz[k] = 0.14 + 0.22 * R(); rv[k] = RV[i];
    }
    attr(g, 'position', p, 3); attr(g, 'aFlat', f, 3); attr(g, 'aCol', c, 3); attr(g, 'aHood', h, 3); attr(g, 'aSize', sz, 1); attr(g, 'aRv', rv, 1);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);
    const m = mat(`
attribute vec3 aFlat, aCol, aHood; attribute float aSize, aRv;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  float fk = flatK(aRv);
  vec3 pos = mix(position, aFlat, fk);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);
  vC = mix(mix(aCol, vec3(1.0, 0.7, 0.4), fk * 0.7), aHood, uHood);
  float off = max(max(uDimE, uHub * 0.7), max(uHeatOn * 0.95, uSel * 0.8));
  vA = uA * 0.045 * mix(0.35, 1.0, smoothstep(0.1, 0.5, length(position))) * smoothstep(aRv, aRv + 0.1, uReveal) * (1.0 - 0.9 * off) * (1.0 - 0.4 * fk);
  if (vA < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA;
void main() { vec2 q = gl_PointCoord - 0.5; float d2 = dot(q, q) * 4.0; if (d2 > 1.0) discard; gl_FragColor = vec4(vC, vA * exp(-d2 * 3.5) * (1.0 - d2)); }`);
    const pts = new THREE.Points(g, m); pts.renderOrder = 1; spin.add(pts);
  })();
  // the luminous core: two glowing balls, brightest where the eye looks through the most of them (any angle)
  const glowMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, U),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN, vW;
void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uA, uReveal, uFlat, uDimE, uHub, uHeatOn, uSel, uHood; varying vec3 vN, vW;
void main() {
  float f = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  float off = max(max(uDimE, uHub * 0.8), max(uHeatOn, uSel * 0.8));
  float a = pow(f, 3.0) * uA * smoothstep(0.0, 0.5, uReveal) * (1.0 - uFlat) * (1.0 - 0.85 * off);
  gl_FragColor = vec4(mix(vec3(0.42, 0.62, 1.0), vec3(0.85, 0.92, 1.0), f * f) * mix(1.0, 0.8, uHood), a * 0.05);
}`,
  });
  set.mats.push(glowMat);
  const glowGeo = new THREE.SphereGeometry(1, 32, 20);
  const glow = new THREE.Group();
  for (const r of [0.34, 0.62]) { const m = new THREE.Mesh(glowGeo, glowMat); m.scale.setScalar(r); m.renderOrder = 0; glow.add(m); }
  spin.add(glow);

  // ---------------------------------------------------------------- interactions (lines)
  (() => {
    const n = E, g = new THREE.BufferGeometry();
    const pa = new Float32Array(n * 6), po = new Float32Array(n * 6), fa = new Float32Array(n * 6), fo = new Float32Array(n * 6);
    const ca = new Float32Array(n * 6), gc = new Float32Array(n * 6), hd = new Float32Array(n * 6), ga = new Float32Array(n * 8), ha = new Float32Array(n * 8), ea = new Float32Array(n * 8);
    const isHub = i => KIND[i] === 1;
    for (let e = 0; e < n; e++) {
      const a = EA[e], b = EB[e], len = dist(a, b);
      let al = 0.26 / (1 + (len / 0.17) * (len / 0.17)) + 0.022;
      if (isHub(a) || isHub(b)) al *= 0.5;
      if (KIND[a] === 7 || KIND[b] === 7) al *= 1.35;
      const ka = KIND[a], inner = ka === KIND[b] && (ka === 3 || ka === 5 || ka === 6 || ((ka === 2 || ka === 4) && GI[a] === GI[b])) ? 1 : 0;
      // written out (no inner loops): this runs 44k times while the page loads
      for (let j = 0; j < 2; j++) {
        const s = j ? b : a, o = j ? a : b, q3 = 6 * e + 3 * j, v4 = 8 * e + 4 * j, s3 = 3 * s, o3 = 3 * o, s4 = 4 * s;
        pa[q3] = P[s3]; pa[q3 + 1] = P[s3 + 1]; pa[q3 + 2] = P[s3 + 2]; po[q3] = P[o3]; po[q3 + 1] = P[o3 + 1]; po[q3 + 2] = P[o3 + 2];
        fa[q3] = F[s3]; fa[q3 + 1] = F[s3 + 1]; fa[q3 + 2] = F[s3 + 2]; fo[q3] = F[o3]; fo[q3 + 1] = F[o3 + 1]; fo[q3 + 2] = F[o3 + 2];
        ca[q3] = BASE[s3]; ca[q3 + 1] = BASE[s3 + 1]; ca[q3 + 2] = BASE[s3 + 2]; gc[q3] = GC4[s3]; gc[q3 + 1] = GC4[s3 + 1]; gc[q3 + 2] = GC4[s3 + 2];
        hd[q3] = HOOD[s3]; hd[q3 + 1] = HOOD[s3 + 1]; hd[q3 + 2] = HOOD[s3 + 2];
        ga[v4] = G4[s4]; ga[v4 + 1] = G4[s4 + 1]; ga[v4 + 2] = G4[s4 + 2]; ga[v4 + 3] = G4[s4 + 3];
        ha[v4] = H4[s4]; ha[v4 + 1] = H4[s4 + 1]; ha[v4 + 2] = H4[s4 + 2]; ha[v4 + 3] = H4[s4 + 3];
        ea[v4] = al; ea[v4 + 1] = RV[o]; ea[v4 + 2] = inner; ea[v4 + 3] = HUBS_S[o];
      }
    }
    attr(g, 'position', pa, 3); attr(g, 'aOth', po, 3); attr(g, 'aFlat', fa, 3); attr(g, 'aOthF', fo, 3); attr(g, 'aCol', ca, 3);
    attr(g, 'aGc', gc, 3); attr(g, 'aHood', hd, 3); attr(g, 'aG', ga, 4); attr(g, 'aH', ha, 4); attr(g, 'aE', ea, 4);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);
    const m = mat(`
attribute vec3 aOth, aFlat, aOthF, aCol, aGc, aHood; attribute vec4 aG, aH, aE;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  float rv = aG.w, ro = aE.y, fk = flatK(rv), fo = flatK(ro);
  vec3 me = mix(position + wob(position), aFlat, fk), ot = mix(aOth + wob(aOth), aOthF, fo);
  float gr = rv > ro ? clamp((uReveal - ro) / max(rv - ro, 0.001), 0.0, 1.0) : 1.0;
  vec3 pos = mix(ot, me, gr);
  float e0 = min(rv, ro), ap = smoothstep(e0, e0 + 0.03, uReveal);
  float sz, hi, hg;
  vec3 c = look(aCol, aGc, aHood, aG, aH, fk, sz, hi, hg);
  // an interaction stays lit with its group only inside the group (those also glow as ribbons)
  hi = max(hi, hg * aE.z);
  // hubs look: an interaction takes the colour of its bigger end, so the top hubs burst out in amber and red spokes
  float hm = max(aG.z, aE.w);
  c = mix(c, hubRamp(hm), uHub); hi = max(hi, uHub * smoothstep(0.4, 0.75, hm));
  float br = mix(1.0, 0.08, max(uDimE, uSel * 0.75) * (1.0 - hi));
  float fm = 0.5 * (fk + fo), len = length(aFlat - aOthF);
  float city = mix(1.0, smoothstep(0.28, 0.05, len) * 1.25, fm);
  br *= mix(mix(0.45, 1.0, smoothstep(0.06, 0.5, 0.5 * length(position + aOth))), 1.0, max(hi, fm));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vC = c * 0.95 * depthCue(mv);
  vA = uA * ap * aE.x * uEdges * br * city * (1.0 + 0.6 * uHeatOn * hi) * (1.0 + 1.6 * uHub * smoothstep(0.72, 0.92, hm));
}`, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.002) discard; gl_FragColor = vec4(vC, vA); }`);
    const L = new THREE.LineSegments(g, m);
    L.renderOrder = 2;
    spin.add(L);
  })();

  // ---------------------------------------------------------------- glowing ribbons for highlighted interactions (with travelling pulses)
  // kinds: 1 curated (index = module of this end + 16 * module of the other end), 2 ATP synthase, 3 immunity cluster,
  // 4 disease module, 5 rare, 6 selection, 7 route (index = hop). aX.z: half width, negative at the second end;
// aX.w: the 'along' value at the second end (aR.w runs from 0 to it), so the fragment knows where the ends are.
  // All four corners of a ribbon get the same visibility and the same side vector, so a ribbon is either a clean quad
  // or wholly hidden (a corner moved off screen alone would smear it into a streak).
  const RIB_VS = `
attribute vec3 aOth, aFlat, aOthF, aCol; attribute vec4 aR, aX;
uniform float uA, uRouteP, uRouteL; varying vec3 vC; varying float vA, vS, vF, vLen, vPh, vCut;
void main() {
  float fk = flatK(aX.x), fo = flatK(aX.y);
  vec3 me = mix(position + wob(position), aFlat, fk), ot = mix(aOth + wob(aOth), aOthF, fo);
  float kind = aR.x, w = abs(aX.z), jj = aX.z < 0.0 ? -1.0 : 1.0;
  // a curated ribbon glows while the pathways at both of its ends are lit
  float vis = kind < 1.5 ? min(pathOf(mod(aR.y, 16.0)), pathOf(floor(aR.y / 16.0 + 0.01)))
    : kind < 2.5 ? uAtp : kind < 3.5 ? uIei : kind < 4.5 ? uDis : kind < 5.5 ? uRare : kind < 6.5 ? uSel : 1.0;
  vec4 a = modelViewMatrix * vec4(me, 1.0), b = modelViewMatrix * vec4(ot, 1.0);
  vec3 dir = normalize(b.xyz - a.xyz + vec3(1e-6)) * jj;   // the same way along the ribbon at both ends
  vec3 side = normalize(cross(dir, a.xyz) + vec3(1e-6));
  // the route lies flat on the map like a road; everything else faces the camera
  float gm = kind > 6.5 ? min(fk, fo) : 0.0;
  if (gm > 0.0) { vec3 up = (modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz; side = normalize(mix(side, normalize(cross(up, dir) + vec3(1e-6)), gm) + vec3(1e-6)); }
  float s = length(modelViewMatrix[0].xyz);
  // the route widens into a road on the map; the dense ATP synthase contacts get thinner there
  float wm = kind > 6.5 ? 1.0 + 0.9 * min(fk, fo) : kind > 1.5 && kind < 2.5 ? mix(1.0, 0.5, min(fk, fo)) : 1.0;
  a.xyz += side * aR.z * w * s * (0.5 + 0.5 * vis) * wm;
  gl_Position = projectionMatrix * a;
  float ap = smoothstep(max(aX.x, aX.y), max(aX.x, aX.y) + 0.03, uReveal);
  vC = aCol * min(depthCue(a), 1.1); vA = uA * vis * ap; vS = aR.z;
  // 0..1 along the ribbon, and its current length (the same at all four corners)
  vF = aR.w / max(aX.w, 1e-5); vLen = length(ot - me);
  vPh = fract(sin(dot(position + aOth, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  vCut = kind > 6.5 ? uRouteP * uRouteL - aR.y : 9.0;
  if (vA < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const RIB_FS = `
uniform float uTime; varying vec3 vC; varying float vA, vS, vF, vLen, vPh, vCut;
void main() {
  if (vF > vCut) discard;
  float prof = 1.0 - vS * vS;
  // soft, symmetric pulses that keep the ribbon's hue (a sawtooth cut off hard and burnt to white)
  float f = fract(vF * vLen / 0.14 - uTime * 0.75 + vPh), pulse = exp(-pow((f - 0.5) / 0.09, 2.0));
  // the square ends fade out inside the node sprites
  float ends = smoothstep(0.0, min(0.006, 0.3 * vLen), min(vF, 1.0 - vF) * vLen);
  gl_FragColor = vec4(vC * (0.75 + 0.8 * pulse), vA * prof * ends * (0.75 + 0.35 * pulse));
}`;
  function ribbonGeo(cap) {
    const g = new THREE.BufferGeometry(), n = cap * 4;
    for (const [nm, k] of [['position', 3], ['aOth', 3], ['aFlat', 3], ['aOthF', 3], ['aCol', 3], ['aR', 4], ['aX', 4]]) attr(g, nm, new Float32Array(n * k), k);
    const idx = new Uint32Array(cap * 6);
    for (let e = 0; e < cap; e++) idx.set([4 * e, 4 * e + 1, 4 * e + 2, 4 * e + 2, 4 * e + 1, 4 * e + 3], 6 * e);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);
    return g;
  }
  // list: [a, b, kind, index(a), index(b), colA, colB, width, alongA (0), alongB (the ribbon's length)]
  function fillRibbons(g, list) {
    const A = g.attributes;
    list.forEach((r, e) => {
      const [a, b, kind, ia, ib, ca, cb, w, la, lb] = r;
      const ends = [[a, b, ia, ca, la], [b, a, ib, cb, lb]];
      for (let j = 0; j < 2; j++) for (let s = 0; s < 2; s++) {
        const [me, ot, ix, col, al] = ends[j], v = 4 * e + 2 * j + s;
        A.position.array.set(pos(me), 3 * v); A.aOth.array.set(pos(ot), 3 * v);
        A.aFlat.array.set(fpos(me), 3 * v); A.aOthF.array.set(fpos(ot), 3 * v);
        A.aCol.array.set(col, 3 * v); A.aR.array.set([kind, kind === 1 ? ix + 16 * ends[1 - j][2] : ix, s ? 1 : -1, al], 4 * v);
        A.aX.array.set([RV[me], RV[ot], j ? -w : w, lb], 4 * v);
      }
    });
    for (const k in A) A[k].needsUpdate = true;
    g.setDrawRange(0, list.length * 6);
  }
  // double-sided: a ribbon's winding flips with the direction it is seen from
  const ribMat = mat(RIB_VS, RIB_FS, { opts: { side: THREE.DoubleSide } }), mesh = {};
  (() => {
    const list = [];
    const L = (a, b) => dist(a, b);
    for (const [a, b] of CE) list.push([a, b, 1, core[a].module, core[b].module, MCOL[core[a].module], MCOL[core[b].module], 0.0045, 0, L(a, b)]);
    for (const [a, b] of ATP_E) list.push([ATPN[a], ATPN[b], 2, 0, 0, [0.45, 0.7, 1], [0.45, 0.7, 1], 0.009, 0, L(ATPN[a], ATPN[b])]);
    for (let e = 0; e < E; e++) {
      const a = EA[e], b = EB[e];
      if (KIND[a] === 4 && KIND[b] === 4) list.push([a, b, 3, 0, 0, ICOL[GI[a]], ICOL[GI[b]], 0.004, 0, L(a, b)]);
      else if (KIND[a] === 5 && KIND[b] === 5) list.push([a, b, 4, 0, 0, GC4.slice(3 * a, 3 * a + 3), GC4.slice(3 * b, 3 * b + 3), 0.0045, 0, L(a, b)]);
      else if ((FLAG[a] & 3) && (FLAG[b] & 3) && KIND[a] === 6 && KIND[b] === 6) {
        const rc = i => ((FLAG[i] & 1) && (FLAG[i] & 2) ? [0.9, 0.55, 0.62] : FLAG[i] & 1 ? [1, 0.3, 0.24] : TEAL);
        list.push([a, b, 5, 0, 0, rc(a), rc(b), 0.0045, 0, L(a, b)]);
      }
    }
    const g = ribbonGeo(list.length);
    fillRibbons(g, list);
    const m = new THREE.Mesh(g, ribMat); m.renderOrder = 4; spin.add(m); mesh.rib = m;
  })();
  // dynamic ribbons: the selected protein's interactions, and the route
  const selGeo = ribbonGeo(520), routeGeo = ribbonGeo(40);
  mesh.sel = new THREE.Mesh(selGeo, ribMat); mesh.sel.renderOrder = 4; mesh.route = new THREE.Mesh(routeGeo, ribMat); mesh.route.renderOrder = 5;
  spin.add(mesh.sel, mesh.route);

  // ---------------------------------------------------------------- markers: candidate rings, seeds, rare gene / target, roof beacons, selection, route stops
  // kinds: 0 candidate, 1 causal gene, 2 seed, 3 rare gene, 4 drug target, 5 roof beacon, 6 selection, 7 route stop
  const MK = [];
  // candidate rings warm with their heat; the causal gene's is gold
  PAT.cands.forEach(i => {
    const c = i === PAT.causal;
    MK.push([i, c ? 1 : 0, c ? 0.11 : 0.075, c ? [1, 0.85, 0.45] : v3.lerp([0.6, 0.8, 1], [1, 0.62, 0.28], smooth(HEAT[i] * 1.3 - 0.2)), 0]);
  });
  PAT.seeds.forEach(i => MK.push([i, 2, 0.05, [1, 0.97, 0.9], 0]));
  MK.push([RARE.g, 3, 0.09, [1, 0.25, 0.2], 0], [RARE.T, 4, 0.08, TEAL, 0]);
  const BH = i => 0.03 + 0.017 * core[i].degree;   // building heights
  for (let i = 0; i < NC; i++) if (core[i].degree >= 7) MK.push([i, 5, 0.03, [1, 0.25, 0.2], BH(i) + 0.006]);
  const MK0 = MK.length, MKCAP = MK0 + 1 + 40;
  const mkGeo = new THREE.BufferGeometry();
  for (const [nm, k] of [['position', 3], ['aFlat', 3], ['aCol', 3], ['aSize', 1], ['aM', 4]]) attr(mkGeo, nm, new Float32Array(MKCAP * k), k);
  function setMarker(s, i, kind, size, col, h, extra = 0) {
    const A = mkGeo.attributes;
    A.position.array.set(pos(i), 3 * s); A.aFlat.array.set(fpos(i), 3 * s); A.aCol.array.set(col, 3 * s);
    A.aSize.array[s] = size; A.aM.array.set([kind, RV[i], kind === 7 ? extra : R(), h], 4 * s);
  }
  MK.forEach((m, s) => setMarker(s, m[0], m[1], m[2], m[3], m[4]));
  setMarker(MK0, 0, 6, 0.07, [1, 1, 1], 0);
  mkGeo.setDrawRange(0, MK0);
  mkGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);
  const mkMat = mat(`
attribute vec3 aFlat, aCol; attribute float aSize; attribute vec4 aM;
uniform float uA, uRouteP, uRouteL; varying vec3 vC; varying float vA, vK, vT;
void main() {
  float kind = aM.x, fk = flatK(aM.y);
  vec3 pos = mix(position + wob(position), aFlat + vec3(0.0, aM.w * uBuild, 0.0), fk);
  float vis = kind < 1.5 ? uCand : kind < 2.5 ? uHeatOn : kind < 4.5 ? uRare
    : kind < 5.5 ? uBuild * smoothstep(0.85, 1.0, uFlat) : kind < 6.5 ? uSel
    : step(0.001, uRouteP) * smoothstep(aM.z - 0.25, aM.z + 0.05, uRouteP * uRouteL);
  float sz = aSize;
  if (kind > 0.5 && kind < 1.5) sz *= 1.0 + 0.12 * sin(uTime * 3.0);
  if (kind > 4.5 && kind < 5.5) vis *= step(0.55, fract(uTime * 0.7 + aM.z));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(sz * (0.6 + 0.4 * vis), mv);
  vC = aCol; vA = uA * vis * smoothstep(aM.y, aM.y + 0.03, uReveal); vK = kind; vT = uTime;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA, vK, vT;
void main() {
  vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float a;
  vec3 col = vC;
  if (vK < 0.5 || (vK > 3.5 && vK < 4.5) || vK > 5.5) a = smoothstep(0.1, 0.0, abs(d - 0.72)) + 0.12 * smoothstep(0.7, 0.0, d);
  else if (vK < 1.5) { a = smoothstep(0.09, 0.0, abs(d - 0.78)) + 0.8 * smoothstep(0.07, 0.0, abs(d - 0.56)) + 0.5 * pow(1.0 - d, 2.0); col = mix(vC, vec3(1.0), 0.3 * smoothstep(0.4, 0.0, d)); }
  // seeds: a crisp white-hot core with a short halo, so three close seeds still read as three
  else if (vK < 2.5) { a = smoothstep(0.5, 0.42, d) + 0.3 * pow(1.0 - d, 2.0); col = mix(vC, vec3(1.0), smoothstep(0.5, 0.3, d)); }
  else { a = pow(1.0 - d, 1.8) * 0.9 + smoothstep(0.3, 0.0, d) * 0.6; col = mix(vC, vec3(1.0), smoothstep(0.35, 0.0, d)); }
  gl_FragColor = vec4(col, vA * a);
}`);
  const mkPts = new THREE.Points(mkGeo, mkMat);
  mkPts.renderOrder = 6;
  spin.add(mkPts);

  // ---------------------------------------------------------------- bubbles (rim-lit domes) for diseases, the rare disease and immunity clusters
  const BUB = [];   // { mem, col, a0, a1, which }
  const bub = (mem, col, a0, a1, which) => {
    const c3 = mem.reduce((s, i) => v3.add(s, pos(i)), [0, 0, 0]).map(x => x / mem.length), cf = mem.reduce((s, i) => v3.add(s, fpos(i)), [0, 0, 0]).map(x => x / mem.length);
    // radius: enclose nearly all members (a far outlier should not blow the bubble up)
    const enc = d => { d.sort((a, b) => a - b); return Math.max(0.03, d[Math.floor(0.9 * (d.length - 1))]) + 0.02; };
    const r3 = enc(mem.map(i => dv(pos(i), c3))), rf = enc(mem.map(i => dv(fpos(i), cf)));
    const rv = mem.reduce((s, i) => s + RV[i], 0) / mem.length;
    BUB.push({ c3, cf, r3, rf, col, a0, a1, which, rv });
  };
  bub(ATPN, PXB, 0.03, 0.42, 'atp');
  bub(DIS.ms, RED, 0.05, 0.75, 'dis'); bub(DIS.ra, AMB, 0.05, 0.75, 'dis'); bub(DIS.px, PXB, 0.05, 0.75, 'dis');
  bub(RARE.dis, [1, 0.25, 0.2], 0.16, 0.6, 'rare'); bub(RARE.treat, TEAL, 0.02, 0.95, 'rare');
  IEIC.forEach((q, k) => bub(q.mem, ICOL[k], 0.035, 0.45, 'iei'));
  const bubGeo = new THREE.SphereGeometry(1, 36, 24);
  const bubCol = new THREE.InstancedBufferAttribute(new Float32Array(BUB.length * 3), 3), bubA = new THREE.InstancedBufferAttribute(new Float32Array(BUB.length * 3), 3);
  BUB.forEach((b, k) => { bubCol.array.set(b.col, 3 * k); bubA.array.set([0, b.a0, b.a1], 3 * k); });
  bubGeo.setAttribute('iCol', bubCol); bubGeo.setAttribute('iA', bubA);
  const bubMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uClip: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 iCol, iA; varying vec3 vN, vW, vC, vK; varying float vY;
void main() {
  vec4 p = instanceMatrix * vec4(position, 1.0);
  vY = p.y; vC = iCol; vK = iA;
  vN = normalize(mat3(modelMatrix) * (mat3(instanceMatrix) * normal)); vec4 w = modelMatrix * p; vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  if (iA.x < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `uniform float uA, uClip; varying vec3 vN, vW, vC, vK; varying float vY;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float r = pow(1.0 - abs(dot(n, v)), 2.5);
  float clip = 1.0 - uClip * smoothstep(0.0, -0.02, vY);
  gl_FragColor = vec4(vC * (0.6 + 0.6 * r), (vK.y + vK.z * r) * vK.x * uA * clip);
}`,
  });
  set.mats.push(bubMat);
  const bubMesh = new THREE.InstancedMesh(bubGeo, bubMat, BUB.length);
  bubMesh.renderOrder = 7; bubMesh.frustumCulled = false;
  spin.add(bubMesh);

  // ---------------------------------------------------------------- the city: ground, buildings on the curated proteins
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.2, 96).rotateX(-Math.PI / 2), K.fade(set, new THREE.MeshBasicMaterial({ color: 0x0a1626 }), 0.6));
  ground.position.y = -0.004; ground.renderOrder = -2;
  const rim = new THREE.Mesh(new THREE.RingGeometry(1.175, 1.19, 160).rotateX(-Math.PI / 2), K.fade(set, new THREE.MeshBasicMaterial({ color: 0xff8a4b, side: THREE.DoubleSide }), 0.8));
  rim.position.y = -0.002; rim.renderOrder = -1;
  spin.add(ground, rim);
  const bldMat = K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.25, emissive: 0x000000 }), 1);
  // windows lit at random; in the hubs look the buildings glow by centrality, in the neighbourhoods look by district,
  // a lit pathway's district glows in its colour, and in the spread look the towers go dark and glow with their heat
  bldMat.onBeforeCompile = sh => {
    sh.uniforms.uHub = U.uHub; sh.uniforms.uHood = U.uHood; sh.uniforms.uPath = U.uPath; sh.uniforms.uHeatOn = U.uHeatOn; sh.uniforms.uHeatF = U.uHeatF;
    sh.vertexShader = 'attribute float iHub, iModK; attribute vec3 iMod; attribute vec2 iHeat; uniform float uPath[10], uHeatF;\n' +
      'varying vec3 vIP, vLN, vMod; varying vec2 vSeed; varying float vHub, vPath, vHeat;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvIP = (instanceMatrix * vec4(position, 1.0)).xyz; vSeed = instanceMatrix[3].xz;\n#endif\n' +
      'vLN = normal; vHub = iHub; vMod = iMod; vHeat = iHeat.x * smoothstep(iHeat.y - 0.4, iHeat.y + 0.6, uHeatF);\n' +
      'vPath = 0.0; for (int k = 0; k < 10; k++) { if (abs(iModK - float(k)) < 0.5) vPath = uPath[k]; }');
    sh.fragmentShader = 'uniform float uHub, uHood, uHeatOn; varying vec3 vIP, vLN, vMod; varying vec2 vSeed; varying float vHub, vPath, vHeat;\n' +
      'vec3 heatRamp(float h) { vec3 c = mix(vec3(0.05, 0.0, 0.0), vec3(0.9, 0.1, 0.04), smoothstep(0.0, 0.4, h)); c = mix(c, vec3(1.0, 0.62, 0.12), smoothstep(0.4, 0.75, h)); return mix(c, vec3(1.0, 0.97, 0.9), smoothstep(0.8, 1.0, h)); }\n' +
      sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  vec3 hot = mix(mix(vec3(0.1, 0.17, 0.34), vec3(1.0, 0.62, 0.18), smoothstep(0.3, 0.6, vHub)), vec3(1.0, 0.24, 0.16), smoothstep(0.62, 0.92, vHub));
  diffuseColor.rgb = mix(mix(mix(mix(diffuseColor.rgb, vMod * 0.85, uHood * 0.7), hot * 0.8, uHub), vMod, vPath * 0.6), vec3(0.04, 0.035, 0.04), uHeatOn * 0.9);`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ totalEmissiveRadiance += hot * uHub * smoothstep(0.35, 0.8, vHub) * 0.55 + vMod * uHood * 0.12 + vMod * vPath * 0.6;
  totalEmissiveRadiance = mix(totalEmissiveRadiance, heatRamp(vHeat) * (0.3 + 0.55 * smoothstep(0.35, 0.8, vHeat)) * smoothstep(0.02, 0.2, vHeat), uHeatOn);
  float side = 1.0 - abs(vLN.y);
  float u = abs(vLN.x) > 0.5 ? vIP.z : vIP.x;
  vec2 cell = vec2(floor(u / 0.0065), floor(vIP.y / 0.0095));
  vec2 id = cell + floor(vSeed * 500.0 + 0.5);   // exact integers: no per-pixel hash noise
  float lit = step(0.42, fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453));
  float win = step(0.3, fract(u / 0.0065)) * step(0.35, fract(vIP.y / 0.0095)) * step(0.012, vIP.y);
  totalEmissiveRadiance += (vec3(1.0, 0.8, 0.5) * win * lit * side * 0.9 + vec3(0.25, 0.4, 0.7) * (1.0 - side) * 0.15) * (1.0 - uHeatOn); }`);
  };
  const bldGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const bldHub = new Float32Array(NC), bldMod = new Float32Array(NC * 3), bldK = new Float32Array(NC), bldHeat = new Float32Array(NC * 2);
  for (let i = 0; i < NC; i++) { bldHub[i] = HUBS_S[i]; bldMod.set(MCOL[core[i].module], 3 * i); bldK[i] = core[i].module; bldHeat.set([H4[4 * i], H4[4 * i + 1]], 2 * i); }
  bldGeo.setAttribute('iHeat', new THREE.InstancedBufferAttribute(bldHeat, 2));
  bldGeo.setAttribute('iHub', new THREE.InstancedBufferAttribute(bldHub, 1));
  bldGeo.setAttribute('iModK', new THREE.InstancedBufferAttribute(bldK, 1));
  bldGeo.setAttribute('iMod', new THREE.InstancedBufferAttribute(bldMod, 3));
  const bld = new THREE.InstancedMesh(bldGeo, bldMat, NC);
  (() => {
    const m = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < NC; i++) {
      const w = 0.016 + 0.0011 * core[i].degree;
      m.makeScale(w, BH(i), w); m.setPosition(F[3 * i], 0, F[3 * i + 2]);
      bld.setMatrixAt(i, m);
      const t = v3.lerp([0.16, 0.2, 0.3], MCOL[core[i].module], 0.4);
      bld.setColorAt(i, c.setRGB(t[0], t[1], t[2]));
    }
  })();
  const city = new THREE.Group(); city.add(bld); spin.add(city);

  // ---------------------------------------------------------------- map pins
  const pinGeo = (() => {
    const H = 0.075, Rr = 0.027, phi = -Math.asin(Rr / H), pts = [new THREE.Vector2(0, 0)];
    for (let k = 0; k <= 14; k++) { const a = phi + (Math.PI / 2 - phi) * k / 14; pts.push(new THREE.Vector2(Math.max(1e-4, Rr * Math.cos(a)), H + Rr * Math.sin(a))); }
    return new THREE.LatheGeometry(pts, 28);
  })();
  // the dark dot on each face of the head sits just proud of the surface: pin and dots are one mesh (white body,
  // dark dots as vertex colours times the pin's colour; the dots take no glow)
  const pinDot = z => K.paint(new THREE.SphereGeometry(0.0105, 16, 12).scale(1, 1, 0.35).translate(0, 0.075, 0.0262 * z), '#15181f');
  const pinAll = K.merge([K.paint(pinGeo, '#ffffff'), pinDot(-1), pinDot(1)]);
  const mkPin = col => {
    const m = K.fade(set, new THREE.MeshStandardMaterial({ color: col, vertexColors: true, roughness: 0.3, metalness: 0.1, emissive: col, emissiveIntensity: 0.25 }), 1);
    m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor;'); };
    const g = new THREE.Group();
    g.add(new THREE.Mesh(pinAll, m));
    g.visible = false; spin.add(g); return g;
  };
  const pins = [mkPin(0xff3b2f), mkPin(0x2a5cff)];

  // ---------------------------------------------------------------- drug capsules (two-tone, lit)
  // Each capsule has a path in 3D and one over the map. On the map the immunity patch lies flat: its frame
  // (ieiB[0], ieiB[1], D_IEI) turns into (x, -z, up), and the paths shrink to map scale around the clusters' map positions.
  const CAPS = [], IEI_RV = IEIC.reduce((s, q) => s + q.mem.reduce((t, i) => t + RV[i], 0), 0) / 173;
  (() => {
    const mapI = v => [v3.dot(v, ieiB[0]), v3.dot(v, D_IEI), -v3.dot(v, ieiB[1])], MS = 0.6;
    const fc = mem => mem.reduce((s, i) => v3.add(s, fpos(i)), [0, 0, 0]).map(x => x / mem.length);
    const cF = fc([].concat(...IEIC.map(q => q.mem)));
    const tg = [17, 4, 13, 11, 5, 2, 14, 10, 1];
    tg.forEach((k, j) => {
      const q = IEIC[k], dock = v3.add(q.c, v3.mul(D_IEI, q.rho * 0.35 + 0.01));
      const side = v3.norm(v3.add(v3.mul(ieiB[0], R() * 2 - 1), v3.mul(ieiB[1], R() * 2 - 1)));
      const from = v3.add(dock, v3.add(v3.mul(D_IEI, 1.3 + 0.3 * R()), v3.mul(side, 0.5 + 0.3 * R())));
      const a = R() * TAU, tilt = v3.add(v3.mul(ieiB[0], Math.cos(a)), v3.mul(ieiB[1], Math.sin(a)));
      const mid = v3.add(v3.lerp(from, dock, 0.5), v3.mul(side, 0.2));
      // on the map the capsule settles just above its cluster, inside the cluster's dome
      const dockF = v3.add(fc(q.mem), [0, 0.022, 0]), tiltF = mapI(tilt), mF = p => v3.add(dockF, v3.mul(mapI(v3.sub(p, dock)), MS));
      CAPS.push({ targeted: true, k, j,
        p3: { from, mid, dock: v3.sub(dock, v3.mul(tilt, 0.012)), tilt, up: D_IEI },
        pF: { from: mF(from), mid: mF(mid), dock: v3.sub(dockF, v3.mul(tiltF, 0.009)), tilt: tiltF, up: [0, 1, 0] } });
    });
    for (let j = 0; j < 6; j++) {
      const y = (j / 5 - 0.5) * 0.7 + gs() * 0.05, z = 0.05 + 0.1 * R();
      const a = inB(ieiCentre, ieiB, -1.3, y, z), b = inB(ieiCentre, ieiB, 1.3, y + gs() * 0.2, z + 0.1);
      // over the map they drift across the patch low above the ground
      const mF = p => { const q = v3.add(cF, v3.mul(mapI(v3.sub(p, ieiCentre)), MS)); q[1] = 0.1 + 0.025 * (j % 3); return q; };
      CAPS.push({ targeted: false, from: j % 2 ? a : b, to: j % 2 ? b : a, fromF: mF(j % 2 ? a : b), toF: mF(j % 2 ? b : a), ph: j / 6 + R() * 0.1, j });
    }
  })();
  // a targeted capsule's place and axis at progress x (eased e) along one of its paths
  const capOn = (c, x, e, t, k) => {
    const A = v3.lerp(c.from, c.mid, e), B = v3.lerp(c.mid, c.dock, e), slant = v3.norm(v3.add(v3.mul(c.up, -0.55), c.tilt));
    let dir = x > 0.98 || vl(v3.sub(B, A)) < 1e-4 ? slant : v3.norm(v3.sub(B, A));
    dir = v3.norm(v3.lerp(dir, slant, smooth((x - 0.7) / 0.3)));
    return [v3.add(v3.lerp(A, B, e), v3.mul(c.up, 0.006 * Math.sin(t * 2.2 + k) * x)), dir];
  };
  const capGeo = top => {
    // half a capsule: a cylinder from 0 to +-h with a round cap
    const r = 0.015, h = 0.024, sg = top ? 1 : -1, pts = [new THREE.Vector2(r, 0)];
    for (let k = 0; k <= 8; k++) { const a = Math.PI / 2 * k / 8; pts.push(new THREE.Vector2(Math.max(1e-4, r * Math.cos(a)), sg * (h + r * Math.sin(a)))); }
    if (!top) pts.reverse();
    return new THREE.LatheGeometry(pts, 18);
  };
  const capA = new THREE.InstancedMesh(capGeo(false), K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.05 }), 1), CAPS.length);
  const capB = new THREE.InstancedMesh(capGeo(true), K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.05 }), 1), CAPS.length);
  (() => {
    const c = new THREE.Color();
    CAPS.forEach((cp, k) => {
      capA.setColorAt(k, cp.targeted ? c.setRGB(GRN[0] * 0.9, GRN[1] * 0.9, GRN[2] * 0.9) : c.setRGB(0.5, 0.53, 0.58));
      capB.setColorAt(k, cp.targeted ? c.setRGB(0.95, 0.97, 1) : c.setRGB(0.3, 0.32, 0.36));
    });
    capA.frustumCulled = capB.frustumCulled = false;
  })();
  const caps = new THREE.Group(); caps.add(capA, capB); spin.add(caps);

  // ---------------------------------------------------------------- explore state (selection, routes)
  // select() and route() only note the request; update() starts their fades at the t of the next frame (in explore
  // mode the engine's t is the wall clock), so the scene stays a function of S, t and the explore calls
  const ex = { sel: -1, selT: null, route: null, routeT: null, ends: null };
  function routeList(p) {
    const list = [];
    for (let k = 0; k + 1 < p.length; k++) list.push([p[k], p[k + 1], 7, k, k, ROUTE, ROUTE, 0.01, 0, 1]);
    return list;
  }
  let routeShown = null;
  function showRoute(p) {
    if (routeShown === p) return;
    routeShown = p;
    fillRibbons(routeGeo, routeList(p));
    p.forEach((i, k) => setMarker(MK0 + 1 + k, i, 7, 0.06, k === 0 ? [1, 0.4, 0.3] : k === p.length - 1 ? [0.45, 0.65, 1] : ROUTE, 0, k));
    for (const nm in mkGeo.attributes) mkGeo.attributes[nm].needsUpdate = true;
    mkGeo.setDrawRange(0, MK0 + 1 + p.length);
    U.uRouteL.value = Math.max(1, p.length - 1);
  }
  showRoute(PIN.route);

  // ---------------------------------------------------------------- current positions (for anchors, pins, pick)
  const cur = { flat: 0, spin: 0, tall: 0, pinS: [0, 0] };
  const fk = i => { const x = clamp((cur.flat - 0.3 * RV[i]) / 0.7, 0, 1); return x * x * (3 - 2 * x); };
  const spun = p => { const c = Math.cos(cur.spin), s = Math.sin(cur.spin); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
  const local = i => v3.lerp(pos(i), fpos(i), fk(i));
  // in the city a curated protein stands on its roof
  const lift = i => (i < NC ? BH(i) * cur.tall : 0);
  const at = i => spun(local(i));
  const centroid = mem => spun(mem.reduce((s, i) => v3.add(s, local(i)), [0, 0, 0]).map(x => x / mem.length));
  const bfk = b => { const x = clamp((cur.flat - 0.3 * b.rv) / 0.7, 0, 1); return x * x * (3 - 2 * x); };
  const bubAt = b => spun(v3.lerp(b.c3, b.cf, bfk(b)));

  // ---------------------------------------------------------------- update
  const MM = new THREE.Matrix4(), QQ = new THREE.Quaternion(), V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), SC = new THREE.Vector3();
  const YAX = new THREE.Vector3(0, 1, 0);
  function update(S, t) {
    const flat = clamp(S.int_flat, 0, 1), build = clamp(S.int_build, 0, 1);
    cur.flat = flat; cur.spin = (S.int_spin || 0) * TAU;
    spin.rotation.y = cur.spin;
    let pmax = 0;
    for (let k = 0; k < 10; k++) { const v = S['int_path' + k] || 0; U.uPath.value[k] = v; pmax = Math.max(pmax, v); }
    U.uReveal.value = S.int_reveal; U.uFlat.value = flat; U.uBuild.value = build; U.uEdges.value = S.int_edges;
    U.uHub.value = S.int_hub; U.uHood.value = S.int_hood; U.uAtp.value = S.int_atp; U.uDis.value = S.int_dis; U.uRare.value = S.int_rare;
    U.uIei.value = S.int_iei; U.uCand.value = S.int_cand;
    U.uHeatF.value = S.int_heat * (HOPMAX + 1); U.uHeatOn.value = smooth(S.int_heat * 5);
    // explore fades run from the first frame after the call (and restart if t jumps back)
    if (ex.sel >= 0 && (ex.selT === null || t < ex.selT)) ex.selT = t;
    if (ex.route && (ex.routeT === null || t < ex.routeT)) ex.routeT = t;
    U.uSel.value = ex.sel >= 0 ? smooth((t - ex.selT) / 0.5) : 0;
    // route and pins: an explore route wins over the story's pin route
    let rp = S.int_route, pp = S.int_pins, ends = [PIN.red, PIN.blue];
    if (ex.route) {
      showRoute(ex.route); ends = ex.ends;
      rp = clamp((t - ex.routeT - 0.6) / (0.35 * ex.route.length), 0, 1); pp = clamp((t - ex.routeT) / 0.7, 0, 1);
    } else showRoute(PIN.route);
    U.uRouteP.value = rp;
    U.uDimE.value = Math.max(S.int_dim, 0.78 * S.int_atp, 0.72 * S.int_dis, 0.72 * S.int_rare, 0.9 * S.int_iei, 0.7 * pmax, 0.6 * rp);
    // ground and buildings
    const gv = smooth(clamp((flat - 0.55) / 0.45, 0, 1)), a = set.uA.value;
    ground.material.opacity = 0.6 * a * gv; rim.material.opacity = 0.8 * a * gv;
    ground.visible = rim.visible = gv > 0.003;
    glow.visible = flat < 0.997 && S.int_reveal > 0.001;
    city.scale.y = Math.max(1e-3, smooth(build) * gv);
    cur.tall = build > 0.003 && gv > 0.003 ? city.scale.y : 0;
    city.visible = build > 0.003 && gv > 0.003;
    // skip draw calls for layers with nothing to show
    mesh.rib.visible = pmax + S.int_atp + S.int_iei + S.int_dis + S.int_rare > 0.002;
    mesh.sel.visible = U.uSel.value > 0.002; mesh.route.visible = rp > 0.001;
    mkPts.visible = S.int_cand + U.uHeatOn.value + S.int_rare + U.uSel.value + rp > 0.002 || (build > 0.002 && flat > 0.85);
    // bubbles (instances are only rewritten while some are shown)
    const fe = smooth(flat);
    bubMesh.visible = S.int_atp + S.int_dis + S.int_rare + S.int_iei > 0.002;
    bubMat.uniforms.uClip.value = fe;
    if (bubMesh.visible) BUB.forEach((b, k) => {
      const v = b.which === 'dis' ? prog(S.int_dis, 0.15, 0.8) : b.which === 'rare' ? prog(S.int_rare, 0.1, 0.7)
        : b.which === 'atp' ? prog(S.int_atp, 0.3, 1) : prog(S.int_iei, 0.2, 0.9);
      bubA.array[3 * k] = v * smooth((S.int_reveal - b.rv) / 0.05);
      const bf = bfk(b), c = v3.lerp(b.c3, b.cf, bf), r = lerp(b.r3, b.rf, bf);
      MM.compose(V1.set(c[0], c[1], c[2]), QQ.identity(), SC.set(r, r * lerp(1, 0.75, bf), r));
      bubMesh.setMatrixAt(k, MM);
    });
    if (bubMesh.visible) bubA.needsUpdate = bubMesh.instanceMatrix.needsUpdate = true;
    // pins drop from the sky with a small bounce
    pins.forEach((g, k) => {
      const p = clamp((pp - 0.3 * k) / 0.7, 0, 1);
      g.visible = p > 0.001;
      cur.pinS[k] = 0;
      if (!g.visible) return;
      const fall = p < 0.75 ? 1 - Math.pow(p / 0.75, 2) : -0.12 * Math.sin((p - 0.75) / 0.25 * Math.PI);
      const q = local(ends[k]);
      g.position.set(q[0], q[1] + lift(ends[k]) + 0.012 + fall * 0.7, q[2]);
      const s = smooth(p * 4) * lerp(1.1, 1.5, fe);
      g.scale.set(s, s, s); cur.pinS[k] = s;
      g.rotation.y = -cur.spin + 0.4;
    });
    // drug capsules: their 3D paths morph into the map paths as the immunity patch lands
    const dz = S.int_drugs;
    caps.visible = dz > 0.001;
    if (caps.visible) {
      const fi = smooth(clamp((flat - 0.3 * IEI_RV) / 0.7, 0, 1));
      CAPS.forEach((cp, k) => {
        let p, dir, s;
        if (cp.targeted) {
          const x = clamp((dz - 0.06 * cp.j) / 0.5, 0, 1), e = 1 - Math.pow(1 - x, 3);
          const [p3, d3] = capOn(cp.p3, x, e, t, k), [pf, df] = fi > 0 ? capOn(cp.pF, x, e, t, k) : [p3, d3];
          p = v3.lerp(p3, pf, fi); dir = v3.norm(v3.lerp(d3, df, fi));
          s = smooth(x * 3);
        } else {
          const x = (t * 0.045 + cp.ph) % 1;
          p = v3.lerp(v3.lerp(cp.from, cp.to, x), v3.lerp(cp.fromF, cp.toF, x), fi);
          dir = v3.norm([Math.sin(t * 0.7 + k), Math.cos(t * 0.5 + 2 * k), Math.sin(t * 0.6 + k * 3)]);
          s = smooth(dz * 2) * Math.sin(Math.PI * x);
        }
        s *= 1 - 0.3 * fi;
        QQ.setFromUnitVectors(YAX, V2.set(dir[0], dir[1], dir[2]));
        MM.compose(V1.set(p[0], p[1], p[2]), QQ, SC.set(s, s, s));
        capA.setMatrixAt(k, MM); capB.setMatrixAt(k, MM);
      });
      capA.instanceMatrix.needsUpdate = capB.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- explore helpers
  function select(i) {
    SEL.fill(0);
    if (i < 0 || i >= NC) { ex.sel = -1; selGeo.setDrawRange(0, 0); nodeGeo.attributes.aSel.needsUpdate = true; return; }
    ex.sel = i; ex.selT = null;
    SEL[i] = 1;
    const list = [];
    for (const j of ADJ[i].slice(0, 520)) { SEL[j] = 1; list.push([i, j, 6, 0, 0, [1, 1, 1], [0.55, 0.85, 1], 0.004, 0, dist(i, j)]); }
    fillRibbons(selGeo, list);
    nodeGeo.attributes.aSel.needsUpdate = true;
    setMarker(MK0, i, 6, 0.07, [1, 1, 1], BH(i) + 0.012);
    for (const nm in mkGeo.attributes) mkGeo.attributes[nm].needsUpdate = true;
  }
  function route(i, j) {
    if (i === undefined || i < 0 || j < 0 || i >= NC || j >= NC) { ex.route = null; return null; }
    const p = path(i, j);
    if (!p) { ex.route = null; return null; }
    ex.route = p; ex.routeT = null; ex.ends = [i, j];
    routeShown = null;
    return p.map(id => ({ id, sym: id < NC ? core[id].sym : KIND[id] === 3 ? ATP[GI[id]] : null }));
  }
  // the curated protein nearest a ray (origin, dir: arrays or THREE.Vector3, in the set's local coordinates); in the city
  // its whole building counts
  function pickRay(origin, dir) {
    const A = v => (Array.isArray(v) ? v : [v.x, v.y, v.z]), O = A(origin), D = A(dir);
    const c = Math.cos(-cur.spin), s = Math.sin(-cur.spin);
    const o = [O[0] * c + O[2] * s, O[1], -O[0] * s + O[2] * c];
    const d = v3.norm([D[0] * c + D[2] * s, D[1], -D[0] * s + D[2] * c]);
    let best = -1, bs = 1e9, solid = false;
    for (let i = 0; i < NC; i++) {
      const p0 = local(i), h = BH(i) * cur.tall, w = v3.sub(o, p0);
      // closest approach of the ray to the point, or to the building's vertical axis (u: 0 ground .. 1 roof)
      let u = 0;
      if (h > 0.01) { const b = d[1], dd = v3.dot(d, w), ee = w[1], den = 1 - b * b; u = clamp(den > 1e-6 ? (ee - b * dd) / den / h : 0, 0, 1); }
      const q = [p0[0], p0[1] + u * h, p0[2]], x = v3.sub(q, o), tt = v3.dot(x, d);
      if (tt <= 0) continue;
      const perp = vl(v3.sub(x, v3.mul(d, tt))), tol = 0.012 + 0.025 * tt;
      // a ray through a building hits it: the nearest building wins over any near miss
      if (h > 0.01 && perp < (0.016 + 0.0011 * core[i].degree) * 0.6) { if (!solid || tt < bs) { solid = true; bs = tt; best = i; } continue; }
      if (!solid && perp < tol && perp / tol < bs) { bs = perp / tol; best = i; }
    }
    return best;
  }
  // the curated proteins that bind curated protein i
  const PARTNERS = core.map(() => []);
  for (const [a, b] of CE) { PARTNERS[a].push(b); PARTNERS[b].push(a); }
  const partners = i => (i >= 0 && i < NC ? PARTNERS[i].slice().sort((a, b) => core[b].degree - core[a].degree || a - b) : []);

  // ---------------------------------------------------------------- anchors, labels, cams, controls
  // on the map, curated proteins and module names sit at roof height and a pin's anchor is its head (without the bounce)
  const up = (p, h) => { p[1] += h; return p; };
  const roofAt = i => up(at(i), lift(i));
  const pinAt = k => { const s = cur.pinS[k]; return up(roofAt(ex.route ? ex.ends[k] : k ? PIN.blue : PIN.red), (0.012 + 0.075 * s) * Math.min(1, s * 5)); };
  const modH = MOD.map(M => M.mem.reduce((s, i) => s + BH(i), 0) / M.mem.length);
  // MS and RA labels sit on the genes each module does not share; on the map each moves to the far side of its own dome,
  // so the two names stay apart from every side
  const apart = (own, other, b) => () => {
    const p = centroid(own), q = centroid(other), dx = p[0] - q[0], dz = p[2] - q[2];
    const f = smooth(cur.flat) * b.rf * 0.55 / (Math.hypot(dx, dz) || 1);
    return [p[0] + dx * f, p[1], p[2] + dz * f];
  };
  const anchors = {
    core: () => spun([0, 0, 0]),
    atp: () => centroid(ATPN),
    pinRed: () => pinAt(0), pinBlue: () => pinAt(1),
    ms: apart(DIS.ms.slice(0, 22), DIS.ra.slice(0, 22), BUB[1]), ra: apart(DIS.ra.slice(0, 22), DIS.ms.slice(0, 22), BUB[2]),
    perox: () => bubAt(BUB[3]),
    rare: () => at(RARE.g), treat: () => at(RARE.T),
    seed: () => centroid(PAT.seeds), causal: () => at(PAT.causal),
    protein: sym => (SYM.has(sym) ? roofAt(SYM.get(sym)) : null),
  };
  MOD.forEach((M, k) => { anchors['mod' + k] = () => up(centroid(M.mem), modH[k] * cur.tall); });
  IEIC.forEach((q, k) => { anchors['iei' + k] = () => centroid(q.mem); });
  for (const [sym, i] of SYM) anchors['p:' + sym] = () => roofAt(i);
  const MLBL = [['Cell cycle', '& DNA copying', 'amb'], ['DNA break repair', '', 'cyn'], ['p53', '& gene control', 'amb'], ['Growth-factor', 'signalling', 'grn'],
    ['Wnt', '& amyloid', 'mag'], ['Proteasome', '', 'cyn'], ['DNA replication', 'start', 'mag'], ['AKT-mTOR', '& survival', 'grn'], ['TNF', '& cell death', 'amb'], ['RNA polymerase II', '', '']];
  const labels = [];
  // a label shows only once the network has grown out to its group
  const grown = mem => { const rv = mem.reduce((s, i) => s + RV[i], 0) / mem.length; return S => smooth((S.int_reveal - rv) / 0.08); };
  // module names while their pathway is lit; with more than six lit at once the names step back (too many labels)
  const pathsOn = S => { let n = 0; for (let k = 0; k < 10; k++) n += S['int_path' + k] || 0; return n; };
  MLBL.forEach((l, k) => {
    const g = grown(MOD[k].mem);
    labels.push({ text: [l[0], l[1]], at: 'mod' + k, cls: l[2], alpha: S => prog(S['int_path' + k] || 0, 0.3, 0.75) * (1 - prog(pathsOn(S), 6, 7)) * g(S) });
  });
  const gd = grown(DIS.ms.concat(DIS.ra, DIS.px));
  labels.push({ text: ['Multiple sclerosis', ''], at: 'ms', cls: '', alpha: S => prog(S.int_dis, 0.5, 0.8) * gd(S) },
    { text: ['Rheumatoid arthritis', ''], at: 'ra', cls: 'amb', alpha: S => prog(S.int_dis, 0.5, 0.8) * gd(S) },
    { text: ['Peroxisomal disorders', ''], at: 'perox', cls: 'cyn', alpha: S => prog(S.int_dis, 0.5, 0.8) * gd(S) });
  // immunity clusters with 7 or more genes: the six biggest (15 or more) at int_iei 0.5-0.8, the four smaller ones at
  // 0.85-1 (so a narrow screen can hold int_iei at 0.8); the patch is small on the map, so there only the three biggest
  IEI.forEach((c, k) => {
    if (c[3] < 7) return;
    const [b, r] = c[1].split('|'), g = grown(IEIC[k].mem), small = c[3] < 20 ? 1 : 0, late = c[3] < 15;
    labels.push({ text: [b, r || ''], at: 'iei' + k, cls: '', alpha: S => (late ? prog(S.int_iei, 0.85, 1) : prog(S.int_iei, 0.5, 0.8)) * g(S) * (1 - small * prog(S.int_flat, 0.3, 0.7)) });
  });
  const toward = (c, az, el, d) => [az, el, d, +c[0].toFixed(3), +c[1].toFixed(3), +c[2].toFixed(3)];
  const rareC = v3.lerp(pos(RARE.g), pos(RARE.T), 0.5), seedC = centroid(PAT.seeds);
  const fcen = mem => mem.reduce((s, i) => v3.add(s, fpos(i)), [0, 0, 0]).map(x => x / mem.length);
  // 'paths': most modules (and the four of the opening chapter) face this side of the network
  const camNet = {
    atp: toward(centroid(ATPN), 25, 12, 1.3),
    dis: [125, 16, 3.2, 0, 0, 0],
    rare: toward(rareC, 110, 30, 1.45),
    iei: toward(v3.mul(ieiCentre, 0.95), -40, 6, 2.3),
    heat: toward(v3.lerp(seedC, [0, 0, 0], 0.45), -40, 14, 2.9),
    paths: [195, 15, 3.6, 0, 0, 0],
  };
  // the same looks over the city map, from higher up
  const camMap = {
    atp: toward(fcen(ATPN), 25, 45, 1.0),
    dis: [115, 36, 3.0, -0.05, -0.05, 0.15],
    rare: toward(v3.lerp(fpos(RARE.g), fpos(RARE.T), 0.5), 110, 42, 1.2),
    iei: toward(fcen([].concat(...IEIC.map(q => q.mem))), -40, 40, 1.7),
    heat: toward(v3.lerp(fcen(PAT.seeds), [0, 0, 0], 0.4), -40, 40, 2.6),
    paths: [195, 32, 3.1, 0, -0.08, 0],
  };
  // a named look's view is the map one while the network lies flat (explore flies to it when the look is chosen in the
  // city); the story reads its views at load, so it gets the 3D ones
  const cam = { default: [25, 12, 3.6, 0, 0, 0], city: [20, 35, 3.1, 0, -0.08, 0] };
  for (const k in camNet) Object.defineProperty(cam, k, { enumerable: true, get: () => (cur.flat > 0.5 ? camMap : camNet)[k] });
  const PATHS = {}; for (let k = 0; k < 10; k++) PATHS['int_path' + k] = 0;
  const params = Object.assign({ int_a: 1, int_reveal: 1, int_edges: 1, int_dim: 0 }, PATHS, {
    int_atp: 0, int_flat: 0, int_build: 0, int_hub: 0, int_hood: 0, int_pins: 0, int_route: 0, int_dis: 0, int_rare: 0,
    int_iei: 0, int_drugs: 0, int_heat: 0, int_cand: 0, int_spin: 0,
  });
  const controls = [
    { key: 'view', label: 'View', options: [['net', 'Network'], ['city', 'City']] },
    { key: 'colour', label: 'Colour', options: [['paths', 'Pathways'], ['hubs', 'Hubs'], ['hoods', 'Neighbourhoods'], ['dis', 'Diseases'], ['iei', 'Immunity'], ['heat', 'Spread']] },
    { key: 'show', label: 'Show', options: [['none', 'Nothing'], ['atp', 'ATP synthase'], ['route', 'Route'], ['rare', 'Rare disease']] },
  ];
  function explore(c) {
    const o = Object.assign({}, params);
    delete o.int_a; delete o.int_spin;
    const cityV = c.view === 'city';
    o.int_flat = cityV ? 1 : 0; o.int_build = cityV ? 1 : 0;
    const t = c.t || 0;
    // every pathway in its colour, and one after another flares up with its name
    if (c.colour === 'paths') for (let k = 0; k < 10; k++) o['int_path' + k] = Math.floor(t / 3.5) % 10 === k ? 1 : 0.32;
    if (c.colour === 'hubs') o.int_hub = 1;
    if (c.colour === 'hoods') o.int_hood = 1;
    if (c.colour === 'dis') o.int_dis = 1;
    // drugs fly in once the clusters are lit; the signal spreads from the patient's genes, then the candidates show
    if (c.colour === 'iei') { o.int_iei = 1; o.int_drugs = clamp((t - 1.5) / 7, 0, 1); }
    if (c.colour === 'heat') { o.int_heat = clamp(t / 7, 0, 1); o.int_cand = t > 6.5 ? 1 : 0; }
    if (c.show === 'atp') o.int_atp = 1;
    if (c.show === 'route') { o.int_pins = 1; o.int_route = 1; }
    if (c.show === 'rare') o.int_rare = 1;
    return o;
  }

  return Object.assign(set, {
    params, update, anchors, labels, cam, controls, explore,
    modules: MODS.map((m, k) => ({ name: m[0], colour: m[1], css: m[1], size: MOD[k].mem.length })),
    iei: IEI.map(c => ({ name: c[0], short: c[1].replace('|', ' '), colour: c[2], count: c[3] })),
    nodeCount: N, edgeCount: E, coreCount: NC,
    core: core.map(c => ({ sym: c.sym, name: c.name, role: c.role, module: c.module, essential: c.essential, degree: c.degree })),
    select, route, pick: pickRay, partners,
    // for the story text and tests
    info: { pins: [core[PIN.red].sym, core[PIN.blue].sym], routeLength: PIN.route.length - 1,
      causal: PAT.causal, causalRank: PAT.rank.indexOf(PAT.causal) + 1, seeds: PAT.seeds, candidates: PAT.cands,
      rareGene: RARE.g, rareTarget: RARE.T, rareHood: RARE.dis.length, treatHood: RARE.treat.length,
      shared: DIS.shared.length, maxDegree: Math.max(...Array.from(ND.subarray(0, N))), hubs: HUBS.map(h => ND[h]) },
  });
};

// mac: a classic beige all-in-one computer (no brand marks), taken apart into neat rows like
// Todd McLellan's teardown photo, its circuit wired up like a schematic, then only a network left.
SETS.mac = function (K) {
  const { THREE } = K;
  const set = K.newSet('mac');
  const R = K.rng(1984), PI = Math.PI;
  const FLOOR = -0.3;                 // table top; the computer stands on it
  const CW = 0.35, CH = 0.48, CD = 0.42, CZ = 0.12;   // case width, height, depth, front face z
  const CY0 = FLOOR + 0.006, CY1 = CY0 + CH;          // case bottom (on its feet) and top
  const SEAM = CZ - 0.1;              // where the front bezel meets the rear case
  const TW = 1.76, TD = 1.48, TABLE = 0x82807c;   // teardown table

  // ------------------------------------------------------------ helpers --
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const col = c => new THREE.Color(...K.rgb(c));
  const E = new THREE.Euler(), Q = new THREE.Quaternion(), M4 = new THREE.Matrix4(), S1 = new THREE.Vector3(1, 1, 1);
  // a transform: position, Euler rotation (radians), scale
  const mat = (p, r, s) => {
    E.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0);
    return new THREE.Matrix4().compose(V(p[0], p[1], p[2]), Q.clone().setFromEuler(E), s ? (typeof s === 'number' ? V(s, s, s) : V(s[0], s[1], s[2])) : S1);
  };
  const quat = r => new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2]));
  // points around a rounded rectangle w x h (corner radius r), counter-clockwise seen from +z
  const rrect = (w, h, r, k = 5, ox = 0, oy = 0) => {
    const out = [], cx = w / 2 - r, cy = h / 2 - r;
    [[cx, cy], [-cx, cy], [-cx, -cy], [cx, -cy]].forEach(([x, y], q) => {
      for (let i = 0; i <= k; i++) { const a = (q + i / k) * PI / 2; out.push([ox + x + r * Math.cos(a), oy + y + r * Math.sin(a)]); }
    });
    return out;
  };
  // a surface through rings of 3D points (same count each); out: winding so normals face away from the axis
  function loft(rings, closed = true, out = true) {
    const n = rings[0].length, pos = [], idx = [];
    for (const r of rings) for (const p of r) pos.push(p[0], p[1], p[2]);
    const m = closed ? n : n - 1;
    // orient the first face against the centre of its ring, so 'out' always means away from the axis
    const r0 = rings[0], ctr = r0.reduce((s, p) => K.v3.add(s, K.v3.mul(p, 1 / n)), [0, 0, 0]);
    const nrm = K.v3.cross(K.v3.sub(rings[1][1], r0[0]), K.v3.sub(r0[1], r0[0]));
    const flip = (K.v3.dot(nrm, K.v3.sub(r0[0], ctr)) > 0) !== out;
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < m; j++) {
      const a = i * n + j, b = i * n + (j + 1) % n, c = (i + 1) * n + (j + 1) % n, d = (i + 1) * n + j;
      if (!flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // a flat fan closing a ring of 2D points at depth z (facing +z or -z)
  function cap(pts, z, front) {
    const pos = [];
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p[0] / pts.length; cy += p[1] / pts.length; }
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j], b = pts[(j + 1) % pts.length];
      if (front) pos.push(cx, cy, z, a[0], a[1], z, b[0], b[1], z); else pos.push(cx, cy, z, b[0], b[1], z, a[0], a[1], z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }
  const ring3 = (pts, z) => pts.map(p => [p[0], p[1], z]);
  // a fan closing a ring of 3D points around a centre, flipped if needed so it faces up (+y)
  function fanUp(ring, c) {
    const pos = [];
    for (let j = 0; j < ring.length; j++) { const a = ring[j], b = ring[(j + 1) % ring.length]; pos.push(...c, ...b, ...a); }
    const n = K.v3.cross(K.v3.sub(ring[1], c), K.v3.sub(ring[0], c));
    if (n[1] < 0) for (let k = 0; k < pos.length; k += 9) for (let m = 0; m < 3; m++) { const t = pos[k + 3 + m]; pos[k + 3 + m] = pos[k + 6 + m]; pos[k + 6 + m] = t; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  }
  // merged geometry with vertex colours (and uvs, for the textured boards); filled into typed arrays at the end
  function Bld() {
    const list = [];
    return {
      add(g, m, c, uv) {
        g = g.index ? g.toNonIndexed() : m ? g.clone() : g;
        if (m) g.applyMatrix4(m);
        list.push([g, K.rgb(c), uv]);
        return this;
      },
      geo() {
        let n = 0;
        for (const it of list) n += it[0].attributes.position.count;
        const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), T = new Float32Array(n * 2).fill(0.004);
        let o = 0;
        for (const [g, cc, uv] of list) {
          const p = g.attributes.position.array, k = g.attributes.position.count;
          P.set(p, 3 * o); N.set(g.attributes.normal.array, 3 * o);
          for (let i = 0; i < k; i++) {
            const j = 3 * (o + i); C[j] = cc[0]; C[j + 1] = cc[1]; C[j + 2] = cc[2];
            if (uv) { const t = uv(i, p[3 * i], p[3 * i + 1], p[3 * i + 2]); T[2 * (o + i)] = t[0]; T[2 * (o + i) + 1] = t[1]; }
          }
          o += k;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
        g.setAttribute('color', new THREE.BufferAttribute(C, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(T, 2));
        g.computeBoundingSphere();
        return g;
      },
    };
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, s = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);

  // ---------------------------------------------------------- materials --
  const mPlastic = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 }));
  const mGloss = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 }));
  const mMetal = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.45 }));
  const LIT = [mPlastic, mGloss, mMetal];

  // ------------------------------------------------------------- parts --
  // A part moves as one piece from its place in the computer (home) to its place on the table (lay).
  // d: when it starts to fly (0..1 of mac_explode), w: how long it flies, arc: height of its hop,
  // spin: extra turns about a local axis on the way (screws unscrew), inner: hidden while the case is shut,
  // node: index of its network node (wired parts) or -1.
  const parts = [];
  function part(o) {
    const p = Object.assign({ d: 0.3, w: 0.4, arc: 0.12, spin: 0, axis: [0, 1, 0], inner: true, node: -1, fade: 0.1, grp: '' }, o);
    p.hq = quat(p.hr || [0, 0, 0]); p.lq = quat(p.lr || [0, 0, 0]);
    p.m = new THREE.Matrix4();
    parts.push(p);
    return parts.length - 1;
  }
  // instanced pieces: kind -> list of { part, local matrix, colour }
  const KINDS = {}, kindList = [];
  function kind(name, geo, material) { KINDS[name] = { geo, material, list: [] }; kindList.push(name); }
  const piece = (k, pi, m, c) => KINDS[k].list.push({ pi, m, c: col(c) });
  // unique meshes that follow one part
  const solos = [];
  function solo(pi, geo, material, local) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.matrixAutoUpdate = false;
    set.group.add(mesh);
    solos.push({ pi, mesh, local: local || null });
    return mesh;
  }
  // ------------------------------------------------- instanced base shapes --
  const white = g => K.paint(g, [1, 1, 1]);
  // a key cap: rounded, tapering, gently dished top (1 x 1 x 1 before scaling)
  function keycap() {
    const b = rrect(1, 1, 0.16, 3), t = rrect(0.78, 0.76, 0.18, 3, 0, 0.05), dish = rrect(0.5, 0.48, 0.18, 3, 0, 0.05);
    const g = loft([ring3(b, 0), ring3(b, 0.25), ring3(t, 1)]);
    const top = loft([ring3(t, 1), ring3(dish, 0.96)], true, false);
    const out = Bld().add(g, null, '#ffffff').add(top, null, '#ffffff').add(cap(dish, 0.96, true), null, '#ffffff').add(cap(b, 0, false), null, '#ffffff').geo();
    out.rotateX(-PI / 2);
    return out;
  }
  // a pan-head screw with a threaded shank, 1 unit head diameter, len shank length (head on top, at y 0)
  function screwGeo(len) {
    const p = [V(0, 0.42, 0), V(0.32, 0.4, 0), V(0.47, 0.3, 0), V(0.5, 0.12, 0), V(0.5, 0, 0), V(0.19, 0, 0)];
    const n = Math.round(len / 0.13);
    for (let i = 0; i < n; i++) { const y = -i * 0.13; p.push(V(0.2, y - 0.03, 0), V(0.26, y - 0.065, 0), V(0.2, y - 0.1, 0)); }
    p.push(V(0.16, -len, 0), V(0.02, -len - 0.12, 0));
    const pts = p.reverse().map(v => new THREE.Vector2(v.x, v.y));
    const g = new THREE.LatheGeometry(pts, 10);
    // a dark cross recess in the head
    const b = Bld().add(g, null, '#ffffff');
    b.add(box(0.5, 0.1, 0.1), mat([0, 0.39, 0]), '#3a3d42').add(box(0.1, 0.1, 0.5), mat([0, 0.39, 0]), '#3a3d42');
    return b.geo();
  }
  function springGeo() {
    const pts = [];
    for (let i = 0; i <= 120; i++) { const a = i / 120 * 9 * 2 * PI, y = i / 120 * 4 - 2; pts.push([Math.cos(a), y, Math.sin(a)]); }
    pts.unshift([1, -2.2, 0.0]); pts.push([1, 2.2, 0]);
    return white(K.tube(pts, 0.13, 180, 4));
  }
  kind('box', white(box(1, 1, 1)), mPlastic);
  kind('boxm', white(box(1, 1, 1)), mMetal);
  kind('cyl', white(cyl(0.5, 0.5, 1, 14)), mPlastic);
  kind('cylm', white(cyl(0.5, 0.5, 1, 12)), mMetal);
  kind('key', keycap(), mPlastic);
  kind('screw', screwGeo(1.1), mMetal);
  kind('screwL', screwGeo(4.2), mMetal);
  kind('spring', springGeo(), mMetal);
  kind('ring', white(new THREE.TorusGeometry(0.36, 0.14, 6, 16)), mMetal);
  kind('sph', white(new THREE.SphereGeometry(0.5, 16, 12)), mGloss);

  // --------------------------------------------------------- colours --
  const BEIGE = '#a69d88', BEIGE2 = '#9a927e', BEIGE3 = '#857e6d', INNER = '#3c3a36', DARK = '#1a1b1d', STEEL = '#c3c8ce';
  const GOLD = '#d8b35a', COPPER = '#b8743c', PCB = '#2a7a46';

  // ------------------------------------------------------------- shell --
  const midY = (CY0 + CY1) / 2, CR = 0.024, T = 0.004, BACK = CZ - CD;
  const outline = (w, h, r) => rrect(w, h, r, 5, 0, midY);
  // the rear case tapers a little towards the back
  const taper = (pts, f, inset) => pts.map(p => [p[0] * (1 - 0.04 * f), CY0 + inset + (p[1] - CY0 - inset) * (1 - 0.055 * f)]);
  function annulus(a, b, z, front) {
    const pos = [];
    for (let j = 0; j < a.length; j++) {
      const k = (j + 1) % a.length, A = [a[j][0], a[j][1], z], B = [a[k][0], a[k][1], z], C = [b[k][0], b[k][1], z], D = [b[j][0], b[j][1], z];
      if (front) pos.push(...A, ...B, ...C, ...A, ...C, ...D); else pos.push(...A, ...C, ...B, ...A, ...D, ...C);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }
  // rear case, built in place, then centred on its part
  const rearC = [0, midY, (SEAM + BACK) / 2];
  const rearGeo = (() => {
    const o = outline(CW, CH, CR), inn = outline(CW - 2 * T, CH - 2 * T, CR - T), b = Bld();
    const rings = [], irings = [], L = SEAM - BACK;
    for (let i = 0; i <= 3; i++) { const z = SEAM - i / 3 * (L - 0.016); rings.push(taper(o, (SEAM - z) / L, 0).map(p => [p[0], p[1], z])); }
    // a rounded back edge
    for (let i = 1; i <= 4; i++) {
      const a = i / 4 * PI / 2, z = BACK + 0.016 * (1 - Math.sin(a)), ins = 0.016 * (1 - Math.cos(a));
      const pts = taper(outline(CW - 2 * ins, CH - 2 * ins, Math.max(0.004, CR - ins)), (SEAM - z) / L, 0);
      rings.push(pts.map(p => [p[0], p[1], z]));
    }
    b.add(loft(rings), null, BEIGE);
    const last = rings[rings.length - 1];
    b.add(cap(last.map(p => [p[0], p[1]]), BACK, false), null, BEIGE);
    for (let i = 0; i <= 1; i++) { const z = SEAM - i * (L - T); irings.push(taper(inn, (SEAM - z) / L, 0).map(p => [p[0], p[1], z])); }
    b.add(loft(irings, true, false), null, INNER);
    b.add(cap(irings[1].map(p => [p[0], p[1]]), BACK + T, true), null, INNER);
    b.add(annulus(o, inn, SEAM, true), null, BEIGE2);
    return b.geo().translate(-rearC[0], -rearC[1], -rearC[2]);
  })();
  // front bezel: a plate with the screen opening and the floppy slot, short side walls and a sloping screen surround
  const SCR_Y = CY1 - 0.033 - 0.1175, OPW = 0.29, OPH = 0.235, SLOT = [0.082, CY0 + 0.1];
  const bezC = [0, midY, (CZ + SEAM) / 2];
  const bezGeo = (() => {
    const b = Bld(), th = 0.006, bs = 0.002;
    const shape = new THREE.Shape(outline(CW - 2 * bs, CH - 2 * bs, CR - bs).map(p => new THREE.Vector2(p[0], p[1])));
    shape.holes.push(new THREE.Path(rrect(OPW, OPH, 0.014, 4, 0, SCR_Y).map(p => new THREE.Vector2(p[0], p[1]))));
    shape.holes.push(new THREE.Path(rrect(0.115, 0.009, 0.0035, 2, SLOT[0], SLOT[1]).map(p => new THREE.Vector2(p[0], p[1]))));
    const plate = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: true, bevelThickness: bs, bevelSize: bs, bevelSegments: 2, curveSegments: 4 });
    plate.translate(0, 0, CZ - th - bs);
    b.add(plate, null, BEIGE);
    const o = outline(CW, CH, CR), inn = outline(CW - 2 * T, CH - 2 * T, CR - T);
    b.add(loft([ring3(o, CZ - th - bs), ring3(o, SEAM)]), null, BEIGE);
    b.add(loft([ring3(inn, CZ - th - bs), ring3(inn, SEAM)], true, false), null, BEIGE2);
    b.add(annulus(o, inn, SEAM, false), null, BEIGE2);
    // screen surround slopes in towards the glass
    const op = rrect(OPW, OPH, 0.014, 4, 0, SCR_Y), ip = rrect(0.262, 0.198, 0.012, 4, 0, SCR_Y);
    b.add(loft([ring3(op, CZ - 0.002), ring3(ip, CZ - 0.026)], true, false), null, BEIGE2);
    // the slot's dark mouth
    b.add(box(0.112, 0.007, 0.004), mat([SLOT[0], SLOT[1], CZ - th - 0.002]), '#141414');
    return b.geo().translate(-bezC[0], -bezC[1], -bezC[2]);
  })();
  // ------------------------------------------------------- CRT and screen --
  const FACE_Z = CZ - 0.03, FW = 0.3, FH = 0.245, IMW = 0.245, IMH = 0.165;
  const crtC = [0, SCR_Y, FACE_Z - 0.17];
  const crtGeo = (() => {
    const b = Bld(), face = rrect(FW, FH, 0.03, 5, 0, SCR_Y);
    // glass skirt behind the face, with a steel implosion band round it
    b.add(loft([ring3(face, FACE_Z), ring3(face, FACE_Z - 0.045)]), null, '#1d211f');
    const band = rrect(FW + 0.006, FH + 0.006, 0.032, 5, 0, SCR_Y);
    b.add(loft([ring3(band, FACE_Z - 0.008), ring3(band, FACE_Z - 0.034)]), null, STEEL);
    // mounting ears at the corners, screwed to the bezel from behind
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.add(box(0.032, 0.018, 0.003), mat([sx * (FW / 2 - 0.002), SCR_Y + sy * (FH / 2 - 0.002), FACE_Z - 0.03], [0, 0, Math.atan2(sy, sx)]), STEEL);
    // the funnel morphs from the rounded face to the round neck
    const rings = [], N = face.length;
    for (let i = 0; i <= 8; i++) {
      const f = i / 8, z = FACE_Z - 0.045 - f * 0.19, s = Math.pow(1 - f, 1.6), rn = 0.03;
      rings.push(face.map(p => {
        const x = p[0], y = p[1] - SCR_Y, a = Math.atan2(y, x);
        return [K.lerp(rn * Math.cos(a), x, s), SCR_Y + K.lerp(rn * Math.sin(a), y, s), z];
      }));
    }
    b.add(loft(rings), null, '#2b2e2c');
    const zr = FACE_Z - 0.235;
    const toZ = new THREE.Matrix4().makeRotationX(PI / 2);
    const along = (g, z, c) => { g.applyMatrix4(toZ); b.add(g, mat([0, SCR_Y, z]), c); };
    along(cyl(0.03, 0.017, 0.03, 18, true), zr - 0.012, '#2b2e2c');
    along(cyl(0.017, 0.017, 0.1, 14), zr - 0.075, '#59605b');
    along(cyl(0.02, 0.02, 0.016, 14), zr - 0.13, DARK);
    // deflection yoke: copper windings in a black collar
    along(cyl(0.052, 0.034, 0.046, 20), zr + 0.005, COPPER);
    along(new THREE.TorusGeometry(0.047, 0.007, 6, 20), zr + 0.026, DARK);
    along(cyl(0.036, 0.036, 0.012, 16), zr - 0.024, DARK);
    // neck board
    b.add(box(0.062, 0.05, 0.003), mat([0, SCR_Y, zr - 0.142]), PCB);
    b.add(box(0.012, 0.01, 0.008), mat([0.018, SCR_Y + 0.012, zr - 0.147]), '#e7d9a8');
    b.add(box(0.01, 0.014, 0.006), mat([-0.02, SCR_Y - 0.01, zr - 0.146]), DARK);
    // anode cap on the funnel
    b.add(new THREE.SphereGeometry(0.014, 12, 8, 0, 2 * PI, 0, PI / 2), mat([0, SCR_Y + 0.084, FACE_Z - 0.11], [-0.5, 0, 0], [1, 0.6, 1]), '#222222');
    return b.geo().translate(-crtC[0], -crtC[1], -crtC[2]);
  })();
  // what the screen shows: a light grey desktop, a menu bar, a window with a little network, two icons
  function screenTexture() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.scale(1, 512 / 342);
    g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, 512, 342);
    const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const text = (s, x, y, size, c, align) => { g.font = `bold ${size}px sans-serif`; g.fillStyle = c || '#000'; g.textAlign = align || 'left'; g.fillText(s, x, y); };
    // menu bar
    rect(0, 0, 512, 19, '#fff'); rect(0, 19, 512, 1, '#000');
    let x = 16;
    for (const m of ['File', 'Edit', 'View', 'Special']) { text(m, x, 14, 12); x += g.measureText(m).width + 18; }
    // window
    const wx = 64, wy = 46, ww = 330, wh = 240;
    rect(wx + 2, wy + 2, ww, wh, '#000'); rect(wx, wy, ww, wh, '#000'); rect(wx + 1, wy + 1, ww - 2, wh - 2, '#fff');
    for (let i = 0; i < 6; i++) rect(wx + 3, wy + 4 + 2 * i, ww - 6, 1, '#000');
    rect(wx + 120, wy + 2, 90, 15, '#fff'); text('Network', wx + 165, wy + 14, 12, '#000', 'center');
    rect(wx + 8, wy + 3, 13, 13, '#fff'); g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(wx + 10.5, wy + 4.5, 9, 9);
    rect(wx, wy + 18, ww, 1, '#000');
    // scroll bars
    rect(wx + ww - 16, wy + 18, 1, wh - 18, '#000'); rect(wx, wy + wh - 16, ww, 1, '#000');
    g.fillStyle = '#a0a0a0'; g.fillRect(wx + ww - 15, wy + 35, 14, wh - 68); g.fillRect(wx + 17, wy + wh - 15, ww - 50, 14);
    rect(wx + ww - 15, wy + 90, 14, 14, '#fff'); g.strokeRect(wx + ww - 15.5, wy + 89.5, 15, 15);
    // a little network in the window
    const r = K.rng(5), nodes = [];
    for (let i = 0; i < 16; i++) nodes.push([wx + 30 + r() * (ww - 76), wy + 40 + r() * (wh - 80)]);
    g.lineWidth = 1.2;
    nodes.forEach((a, i) => nodes.forEach((b2, j) => { if (j > i && Math.hypot(a[0] - b2[0], a[1] - b2[1]) < 95) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b2[0], b2[1]); g.stroke(); } }));
    nodes.forEach((a, i) => { g.beginPath(); g.arc(a[0], a[1], i % 4 ? 4 : 6, 0, 2 * PI); g.fillStyle = i % 3 ? '#000' : '#fff'; g.fill(); g.stroke(); });
    // icons: a disk and a bin
    const ix = 452;
    rect(ix, 34, 34, 22, '#fff'); g.strokeRect(ix + 0.5, 34.5, 33, 21); rect(ix + 4, 48, 8, 2, '#000');
    rect(ix - 14, 60, 62, 12, '#fff'); text('Hard Disk', ix + 17, 70, 10, '#000', 'center');
    g.strokeRect(ix + 7.5, 284.5, 19, 24); rect(ix + 5, 280, 24, 4, '#000');
    for (let i = 0; i < 3; i++) rect(ix + 12 + 5 * i, 288, 1, 18, '#000');
    rect(ix + 4, 314, 26, 12, '#fff'); text('Bin', ix + 17, 324, 10, '#000', 'center');
    // pointer
    g.save(); g.translate(300, 214); g.beginPath();
    [[0, 0], [0, 16], [4, 12], [7, 19], [9, 18], [6, 11], [11, 11]].forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath(); g.fillStyle = '#000'; g.fill(); g.strokeStyle = '#fff'; g.stroke(); g.restore();
    // the screen's own rounded corners
    g.fillStyle = '#000';
    for (const [cx, cy, a] of [[0, 0, 0], [512, 0, 1], [512, 342, 2], [0, 342, 3]]) {
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx + (a === 1 || a === 2 ? -6 : 6), cy + (a >= 2 ? -6 : 6), 6, (a + 2) * PI / 2, (a + 3) * PI / 2); g.closePath(); g.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }
  const screenMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uMap: { value: screenTexture() }, uOff: { value: 0 }, uImg: { value: new THREE.Vector2(IMW / FW, IMH / FH) } },
    transparent: true, extensions: { derivatives: true },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D uMap; uniform float uA, uOff; uniform vec2 uImg; varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5, q = abs(p) - vec2(0.4, 0.38);
  if (length(max(q, 0.0)) > 0.1) discard;
  vec3 glass = vec3(0.03, 0.04, 0.036);
  vec2 ip = p / uImg;
  // switching off: the picture squeezes to a bright line, then to a dot, then fades
  float sy = mix(1.0, 0.006, smoothstep(0.0, 0.45, uOff)), sx = mix(1.0, 0.01, smoothstep(0.42, 0.8, uOff));
  vec2 jp = ip / vec2(sx, sy);
  vec3 c = glass;
  if (abs(jp.x) < 0.5 && abs(jp.y) < 0.5) {
    // the squeezed picture burns to an even white line
    vec3 img = mix(texture2D(uMap, jp + 0.5).rgb, vec3(1.0), smoothstep(0.15, 0.4, uOff));
    // scan lines only where they are big enough on screen not to shimmer
    float ln = (jp.y + 0.5) * 342.0, scan = 1.0 - 0.06 * (0.5 + 0.5 * sin(ln * 6.28318)) * (1.0 - smoothstep(0.25, 0.5, fwidth(ln)));
    float edge = 1.0 - 0.22 * smoothstep(0.3, 0.75, length(ip));
    float boost = 1.0 + 2.0 * smoothstep(0.0, 0.45, uOff);
    c = mix(glass, min(img * scan * edge * boost, vec3(1.6)) * vec3(0.84, 0.93, 1.0), 1.0 - smoothstep(0.8, 1.0, uOff));
  }
  // halation: light scattered in the glass makes a soft glow round the picture (and round the line and dot)
  float dd = length(max(abs(p) - 0.5 * uImg * vec2(sx, sy), 0.0) * vec2(${FW.toFixed(3)}, ${FH.toFixed(3)}));
  c += vec3(0.6, 0.68, 0.76) * 0.4 * exp(-dd / 0.009) * step(1e-5, dd) * (1.0 - smoothstep(0.8, 1.0, uOff)) * (1.0 + smoothstep(0.0, 0.45, uOff));
  c += vec3(0.06, 0.07, 0.08) * smoothstep(0.7, -0.5, p.y * 1.4 - p.x) * 0.6;
  gl_FragColor = vec4(c, uA);
}`,
  });
  set.mats.push(screenMat);
  const screenGeo = new THREE.PlaneGeometry(FW, FH, 20, 16);
  {
    const p = screenGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (FW / 2), y = p.getY(i) / (FH / 2); p.setZ(i, 0.011 * (1 - x * x * 0.8) * (1 - y * y * 0.8)); }
    screenGeo.computeVertexNormals();
  }
  // light spill: the glowing screen lights the sloping surround and the bezel just round it (additive, on the bezel)
  const spillMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uOff: screenMat.uniforms.uOff },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    vertexShader: 'attribute float aG; varying float vG; void main() { vG = aG; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA, uOff; varying float vG;
void main() { gl_FragColor = vec4(vec3(0.66, 0.74, 0.84), pow(vG, 1.7) * 0.3 * uA * (1.0 - smoothstep(0.0, 0.5, uOff))); }`,
  });
  set.mats.push(spillMat);
  const spillGeo = (() => {
    // rings just in front of the surround (0.6 mm towards the opening) and of the face, with the glow at each
    const R4 = (w, h, r, z, g) => ({ pts: ring3(rrect(w, h, r, 4, 0, SCR_Y), z), g });
    const rs = [R4(0.262 - 0.0012, 0.198 - 0.0012, 0.012, CZ - 0.0256, 1), R4(OPW - 0.0012, OPH - 0.0012, 0.014, CZ - 0.0017, 0.62),
      R4(OPW - 0.001, OPH - 0.001, 0.014, CZ + 0.0007, 0.62), R4(OPW + 0.042, OPH + 0.042, 0.03, CZ + 0.0007, 0)];
    const g = loft(rs.map(r => r.pts)), aG = [];
    for (const r of rs) for (let i = 0; i < r.pts.length; i++) aG.push(r.g);
    g.setAttribute('aG', new THREE.Float32BufferAttribute(aG, 1));
    return g.translate(-bezC[0], -bezC[1], -bezC[2]);
  })();
  // --------------------------------------------------- big parts (home) --
  const P = {};   // named part indices
  P.rear = part({ grp: 'case', hp: rearC, inner: false, d: 0.05, w: 0.42, arc: 0.32, lr: [-PI / 2, 0, 0] });
  // as in a real teardown: the rear case slides off, the tube lifts out backwards, the front bezel goes last
  P.bezel = part({ grp: 'case', hp: bezC, inner: false, d: 0.38, w: 0.42, arc: 0.28, lr: [-PI / 2, 0, 0] });
  P.crt = part({ grp: 'crt', hp: crtC, inner: false, d: 0.25, w: 0.4, arc: 0.24, lr: [PI / 2, 0, 0] });
  const shell = [solo(P.rear, rearGeo, mPlastic), solo(P.bezel, bezGeo, mPlastic)];
  const crtMesh = solo(P.crt, crtGeo, mGloss);
  const spill = solo(P.bezel, spillGeo, spillMat);
  spill.renderOrder = 2;
  {
    // rear case details: a carrying handle, vents on the top and the sides, the port panel
    const L = SEAM - BACK, yTop = z => CY0 + (CY1 - CY0) * (1 - 0.055 * (SEAM - z) / L), loc = (x, y, z) => [x - rearC[0], y - rearC[1], z - rearC[2]];
    const tilt = -Math.atan(0.055 * (CY1 - CY0) / L);
    piece('box', P.rear, mat(loc(0, yTop(BACK + 0.038) + 0.0003, BACK + 0.038), [tilt, 0, 0], [0.15, 0.002, 0.026]), '#5a564d');
    for (let i = 0; i < 13; i++) piece('box', P.rear, mat(loc(-0.108 + i * 0.018, yTop(BACK + 0.125) + 0.0003, BACK + 0.125), [tilt, 0, 0], [0.0055, 0.002, 0.1]), '#3d3a34');
    for (const s of [-1, 1]) for (let i = 0; i < 9; i++) {
      const z = BACK + 0.05 + i * 0.013, f = (SEAM - z) / L;
      piece('box', P.rear, mat(loc(s * (CW / 2 * (1 - 0.04 * f) + 0.0002), midY + 0.04, z), null, [0.002, 0.11, 0.0055]), '#3d3a34');
    }
    piece('box', P.rear, mat(loc(0, CY0 + 0.05, BACK - 0.0008), null, [0.25, 0.045, 0.002]), '#4a4740');
    [[-0.095, 0.016, '#a9b0b7'], [-0.06, 0.012, '#a9b0b7'], [-0.025, 0.012, '#a9b0b7'], [0.02, 0.03, '#a9b0b7']].forEach(([x, w, c]) => piece('boxm', P.rear, mat(loc(x, CY0 + 0.05, BACK - 0.002), null, [w, 0.008, 0.003]), c));
    piece('box', P.rear, mat(loc(0.085, CY0 + 0.05, BACK - 0.003), null, [0.026, 0.02, 0.005]), '#161618');
    piece('box', P.rear, mat(loc(-0.13, CY0 + 0.1, BACK + 0.001), null, [0.012, 0.02, 0.006]), '#161618');
  }
  const LB = { w: 0.29, d: 0.29, t: 0.003 }, AB = { w: 0.27, d: 0.3, t: 0.003 };
  P.logic = part({ grp: 'board', hp: [-0.005, CY0 + 0.012, BACK + 0.165], d: 0.42, w: 0.4, arc: 0.2 });
  P.analog = part({ grp: 'board', hp: [-0.152, CY0 + 0.17, -0.13], hr: [0, 0, -PI / 2], d: 0.34, w: 0.42, arc: 0.24 });
  const homeM = pi => new THREE.Matrix4().compose(V(...parts[pi].hp), parts[pi].hq, S1);
  // place a part on a board: board-local x, z on its top side, turned ry about the board's normal
  const tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();
  function onBoard(o, board, B, lx, lz, ry, hy) {
    const m = homeM(board).multiply(mat([lx, B.t / 2 + hy, lz], [0, ry || 0, 0]));
    const q = new THREE.Quaternion();
    m.decompose(tmpP, q, tmpS);
    o.hp = [tmpP.x, tmpP.y, tmpP.z];
    const i = part(o); parts[i].hq = q;
    return i;
  }

  // ------------------------------------------------------ components --
  // sizes are a little larger than life so they read on the table
  const PITCH = 0.0045, SO = 0.0025, HB = 0.006, CHIP_HY = (SO + HB) / 2;
  const nodes = [];   // network nodes: { pi, kind, pins: [[x, z, side]], tw, td }
  function chipPieces(pi, n, wide) {
    const L = n / 2 * PITCH + 0.006, W = wide ? 0.026 : 0.0115, y0 = -CHIP_HY;
    piece('box', pi, mat([0, y0 + SO + HB / 2, 0], null, [L, HB, W]), '#17181a');
    piece('cyl', pi, mat([-L / 2 + 0.0035, y0 + SO + HB + 0.0001, 0], null, [0.004, 0.0004, 0.004]), '#2f3034');
    piece('cyl', pi, mat([-L / 2 + 0.0035, y0 + SO + HB + 0.0001, W / 2 - 0.003], null, [0.0016, 0.0005, 0.0016]), '#45474c');
    const pins = [];
    for (let k = 0; k < n / 2; k++) for (const s of [-1, 1]) {
      const x = -L / 2 + 0.003 + PITCH * (k + 0.5);
      piece('boxm', pi, mat([x, y0 + 0.0036, s * (W / 2 + 0.0011)], [s * 0.22, 0, 0], [0.0017, 0.0068, 0.0011]), '#d4d8dd');
      pins.push({ p: [x, y0 + 0.0008, s * (W / 2 + 0.0022)], d: [0, 0, s] });
    }
    return { L, W, pins };
  }
  function plccPieces(pi, n) {
    const m = n / 4, Sd = m * 0.0032 + 0.006, y0 = -CHIP_HY, pins = [];
    piece('box', pi, mat([0, y0 + SO + HB / 2, 0], null, [Sd, HB, Sd]), '#17181a');
    piece('cyl', pi, mat([-Sd / 2 + 0.004, y0 + SO + HB + 0.0001, -Sd / 2 + 0.004], null, [0.0025, 0.0004, 0.0025]), '#2f3034');
    for (let k = 0; k < m; k++) {
      const u = -Sd / 2 + 0.003 + 0.0032 * (k + 0.5);
      for (const s of [-1, 1]) {
        piece('boxm', pi, mat([u, y0 + SO + 0.002, s * (Sd / 2 + 0.0006)], null, [0.0015, 0.004, 0.0012]), '#d4d8dd');
        piece('boxm', pi, mat([s * (Sd / 2 + 0.0006), y0 + SO + 0.002, u], null, [0.0012, 0.004, 0.0015]), '#d4d8dd');
        pins.push({ p: [u, y0 + SO, s * (Sd / 2 + 0.0012)], d: [0, 0, s] });
      }
    }
    return { L: Sd, W: Sd, pins };
  }
  const RCOL = ['#1b1b1b', '#7a4a26', '#d23a2a', '#ec7a25', '#f0d33a', '#3a9a48', '#2f62c8', '#8a4fc0', '#8d8d8d', '#f2f2f2'];
  function resistorPieces(pi, v) {
    const body = v.film ? '#86b4e0' : '#d9c49a';
    piece('cyl', pi, mat([0, 0, 0], [0, 0, PI / 2], [0.0074, 0.017, 0.0074]), body);
    for (const s of [-1, 1]) {
      piece('cyl', pi, mat([s * 0.0075, 0, 0], [0, 0, PI / 2], [0.0082, 0.0026, 0.0082]), body);
      piece('cylm', pi, mat([s * 0.0155, 0, 0], [0, 0, PI / 2], [0.0012, 0.014, 0.0012]), '#c9ced4');
    }
    [v.a, v.b, v.m, -1].forEach((c, k) => piece('cyl', pi, mat([-0.0052 + k * 0.0031 + (k === 3 ? 0.0014 : 0), 0, 0], [0, 0, PI / 2], [0.0078, 0.0015, 0.0078]), c < 0 ? '#c9a23d' : RCOL[c]));
  }
  function elcoPieces(pi, r, h, sleeve) {
    piece('cyl', pi, mat([0, 0, 0], null, [2 * r, h, 2 * r]), sleeve);
    piece('cylm', pi, mat([0, h / 2 + 0.0002, 0], null, [1.86 * r, 0.0008, 1.86 * r]), '#cfd3d8');
    piece('box', pi, mat([r * 0.93, 0, 0], null, [0.0012, h * 0.94, r * 0.5]), '#cfd5dc');
    for (const s of [-1, 1]) piece('cylm', pi, mat([0, -h / 2 - 0.004, s * r * 0.4], null, [0.0011, 0.008, 0.0011]), '#c9ced4');
  }
  function discPieces(pi, c) {
    piece('cyl', pi, mat([0, 0.004, 0], [PI / 2, 0, 0], [0.011, 0.003, 0.011]), c);
    for (const s of [-1, 1]) piece('cylm', pi, mat([s * 0.0025, -0.0045, 0], null, [0.001, 0.01, 0.001]), '#c9ced4');
  }
  function crystalPieces(pi) {
    piece('boxm', pi, mat([0, 0.002, 0], null, [0.011, 0.012, 0.0048]), '#d7dce2');
    for (const s of [-1, 1]) piece('cylm', pi, mat([s * 0.0055, 0.002, 0], null, [0.0048, 0.012, 0.0048]), '#d7dce2');
    for (const s of [-1, 1]) piece('cylm', pi, mat([s * 0.0024, -0.0075, 0], null, [0.001, 0.008, 0.001]), '#c9ced4');
  }
  // the logic board: chips, resistors, decoupling capacitors, a crystal, memory modules, a battery
  const CHIPS = [[64, 1, 'cpu'], [40, 1], [40, 1], [28, 1], [28, 1], [28, 1], [44, 0, 'plcc'], [44, 0, 'plcc'],
    [20, 0], [20, 0], [20, 0], [20, 0], [16, 0], [16, 0], [16, 0], [16, 0], [16, 0], [14, 0], [14, 0], [14, 0], [14, 0], [14, 0]];
  const onLB = [], onAB = [];
  CHIPS.forEach((c, k) => {
    const pi = part({ grp: 'chip', d: 0.3 + 0.012 * k, w: 0.36, arc: 0.16 + 0.002 * k, spin: 1, axis: [0, 1, 0] });
    const g = c[2] === 'plcc' ? plccPieces(pi, c[0]) : chipPieces(pi, c[0], c[1]);
    nodes.push({ pi, kind: 'chip', pins: g.pins, L: g.L, W: g.W, n: c[0], big: c[0] >= 28 });
    onLB.push({ pi, w: g.L, d: g.W + 0.006, hy: CHIP_HY, chip: g });
  });
  const res = [];
  for (let k = 0; k < 40; k++) {
    const mm = [1, 2, 2, 3, 3, 3, 4, 4, 5][Math.floor(R() * 9)], dg = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82][Math.floor(R() * 12)];
    res.push({ a: Math.floor(dg / 10), b: dg % 10, m: mm, film: R() < 0.3, val: dg * Math.pow(10, mm) });
  }
  res.sort((a, b) => a.val - b.val);
  res.forEach((v, k) => {
    const pi = part({ grp: 'res', d: 0.24 + 0.006 * (k % 30), w: 0.36, arc: 0.14, spin: 1, axis: [1, 0, 0], ord: k });
    resistorPieces(pi, v);
    nodes.push({ pi, kind: 'res', pins: [{ p: [-0.0225, 0, 0], d: [-1, 0, 0] }, { p: [0.0225, 0, 0], d: [1, 0, 0] }] });
    (k % 3 === 2 ? onAB : onLB).push({ pi, w: 0.046, d: 0.01, hy: 0.0041 });
  });
  const elcos = [];
  for (let k = 0; k < 12; k++) elcos.push({ r: 0.0042 + 0.0035 * R(), h: 0.011 + 0.01 * R(), c: R() < 0.6 ? '#23407a' : '#202124' });
  elcos.sort((a, b) => b.r * b.h - a.r * a.h);
  elcos.forEach((e, k) => {
    const pi = part({ grp: 'elco', d: 0.26 + 0.01 * k, w: 0.36, arc: 0.16, lr: [0, 0, PI / 2], ord: k });
    elcoPieces(pi, e.r, e.h, e.c);
    nodes.push({ pi, kind: 'cap', pins: [-1, 1].map(s => ({ p: [0, -e.h / 2 - 0.008, s * e.r * 0.4], d: [0, -1, 0] })) });
    (k % 2 ? onAB : onLB).push({ pi, w: 2 * e.r, d: 2 * e.r, hy: e.h / 2 + 0.004 });
  });
  const DCOL = ['#e39a3a', '#e8c84a', '#3a74c4'];
  for (let k = 0; k < 14; k++) {
    const pi = part({ grp: 'disc', d: 0.28 + 0.008 * k, w: 0.34, arc: 0.12, lr: [PI / 2, 0, 0], ord: k });
    discPieces(pi, DCOL[Math.floor(k / 5) % 3]);
    nodes.push({ pi, kind: 'cap', pins: [-1, 1].map(s => ({ p: [s * 0.0025, -0.0095, 0], d: [0, -1, 0] })) });
    onLB.push({ pi, w: 0.012, d: 0.004, hy: 0.0095 });
  }
  for (let k = 0; k < 2; k++) {
    const pi = part({ grp: 'xtal', d: 0.33 + 0.02 * k, w: 0.34, arc: 0.14, lr: [PI / 2, 0, 0] });
    crystalPieces(pi);
    nodes.push({ pi, kind: 'xtal', pins: [-1, 1].map(s => ({ p: [s * 0.0024, -0.0115, 0], d: [0, -1, 0] })) });
    onLB.push({ pi, w: 0.017, d: 0.006, hy: 0.0115 });
  }
  // memory modules stand in their sockets at a slant
  const simms = [];
  for (let k = 0; k < 4; k++) {
    const pi = part({ grp: 'simm', d: 0.36 + 0.015 * k, w: 0.36, arc: 0.18 });
    piece('box', pi, mat([0, 0, 0], null, [0.13, 0.0022, 0.03]), '#2f8a4e');
    piece('boxm', pi, mat([0, 0, -0.0125], null, [0.124, 0.0024, 0.0045]), GOLD);
    for (let j = 0; j < 8; j++) piece('box', pi, mat([-0.0525 + j * 0.015, 0.0025, 0.004], null, [0.011, 0.003, 0.012]), '#17181a');
    simms.push(pi);
  }
  P.battery = part({ grp: 'misc', d: 0.4, w: 0.34, arc: 0.12, lr: [0, 0, PI / 2] });
  piece('cylm', P.battery, mat([0, 0, 0], null, [0.0145, 0.025, 0.0145]), '#9aa4ae');
  piece('cyl', P.battery, mat([0, 0.0005, 0], null, [0.0152, 0.018, 0.0152]), '#2a4a8c');
  // analogue board parts that are not wired: flyback transformer, heat sinks, a mains transformer, trimmers, a fuse
  P.flyback = part({ grp: 'ana', d: 0.3, w: 0.4, arc: 0.2 });
  piece('box', P.flyback, mat([0, -0.006, 0], null, [0.042, 0.03, 0.036]), '#1d1e20');
  piece('cyl', P.flyback, mat([0, 0.016, 0], null, [0.032, 0.016, 0.032]), '#26272a');
  for (let j = 0; j < 4; j++) piece('cyl', P.flyback, mat([0, 0.01 + j * 0.004, 0], null, [0.035, 0.0015, 0.035]), '#2c2d30');
  const heat = [];
  for (let k = 0; k < 2; k++) {
    const pi = part({ grp: 'ana', d: 0.32 + 0.02 * k, w: 0.38, arc: 0.18 });
    for (let j = 0; j < 6; j++) piece('boxm', pi, mat([-0.0175 + j * 0.007, 0.003, 0], null, [0.0016, 0.028, 0.03]), '#aeb6bf');
    piece('boxm', pi, mat([0, -0.012, 0], null, [0.04, 0.004, 0.03]), '#aeb6bf');
    piece('box', pi, mat([0, -0.008, 0.017], null, [0.012, 0.012, 0.004]), '#17181a');
    heat.push(pi);
  }
  P.xfmr = part({ grp: 'ana', d: 0.35, w: 0.38, arc: 0.18 });
  piece('boxm', P.xfmr, mat([0, 0, 0], null, [0.034, 0.028, 0.03]), '#6f7378');
  piece('box', P.xfmr, mat([0, 0.002, 0], null, [0.02, 0.03, 0.033]), '#e2c24a');
  piece('boxm', P.xfmr, mat([0, -0.0135, 0], null, [0.054, 0.002, 0.016]), '#8a9097');
  const trims = [];
  for (let k = 0; k < 3; k++) {
    const pi = part({ grp: 'misc', d: 0.3 + 0.01 * k, w: 0.32, arc: 0.1 });
    piece('box', pi, mat([0, 0, 0], null, [0.01, 0.006, 0.01]), '#2f62c8');
    piece('cyl', pi, mat([0, 0.0035, 0], null, [0.006, 0.0012, 0.006]), '#f2f2f2');
    trims.push(pi);
  }
  P.fuse = part({ grp: 'misc', d: 0.33, w: 0.32, arc: 0.1 });
  piece('cyl', P.fuse, mat([0, 0, 0], [0, 0, PI / 2], [0.0058, 0.016, 0.0058]), '#e9f0f2');
  for (const s of [-1, 1]) piece('cylm', P.fuse, mat([s * 0.0095, 0, 0], [0, 0, PI / 2], [0.0064, 0.005, 0.0064]), '#cfd3d8');
  [[P.flyback, 0.025, 0.07, 0.042, 0.036, 0.021], [heat[0], -0.07, 0.08, 0.04, 0.03, 0.016], [heat[1], -0.07, -0.03, 0.04, 0.03, 0.016],
    [P.xfmr, 0.06, -0.08, 0.034, 0.03, 0.014], [trims[0], 0.1, 0.1, 0.01, 0.01, 0.003], [trims[1], 0.1, 0.12, 0.01, 0.01, 0.003],
    [trims[2], 0.1, 0.08, 0.01, 0.01, 0.003], [P.fuse, -0.1, -0.12, 0.026, 0.006, 0.003]].forEach(([pi, x, z, w, d, hy]) => onAB.push({ pi, w, d, hy, at: [x, z] }));
  // mount: pack each board's parts in rows; the board texture gets their footprints
  const foot = [];
  function mount(list, board, B, v0, seed) {
    const r = K.rng(seed);
    let x = -B.w / 2 + 0.012, z = -B.d / 2 + 0.014, rowD = 0;
    for (const it of list) {
      let cx, cz;
      if (it.at) { cx = it.at[0]; cz = it.at[1]; } else {
        if (x + it.w > B.w / 2 - 0.01) { x = -B.w / 2 + 0.012; z += rowD + 0.012; rowD = 0; }
        if (z + it.d > B.d / 2 - 0.01) z = -B.d / 2 + 0.014 + r() * 0.01;
        cx = x + it.w / 2; cz = z + it.d / 2; x += it.w + 0.009 + r() * 0.004; rowD = Math.max(rowD, it.d);
      }
      const m = homeM(board).multiply(mat([cx, B.t / 2 + it.hy, cz]));
      const q = new THREE.Quaternion();
      m.decompose(tmpP, q, tmpS);
      parts[it.pi].hp = [tmpP.x, tmpP.y, tmpP.z]; parts[it.pi].hq = q;
      foot.push({ x: (cx / B.w + 0.5) * 512, y: v0 + (cz / B.d + 0.5) * 256, w: it.w / B.w * 512, h: it.d / B.d * 256, chip: it.chip });
    }
  }
  // the CPU and ROMs go first, near the back; memory modules near the front
  mount(onLB, P.logic, LB, 0, 3);
  mount(onAB, P.analog, AB, 256, 4);
  simms.forEach((pi, k) => {
    const m = homeM(P.logic).multiply(mat([0.06, 0.03, 0.09 + k * 0.012], [-1.0, 0, 0]));
    const q = new THREE.Quaternion(); m.decompose(tmpP, q, tmpS);
    parts[pi].hp = [tmpP.x, tmpP.y, tmpP.z]; parts[pi].hq = q;
  });
  {
    const m = homeM(P.logic).multiply(mat([-0.11, 0.01, 0.12], [0, 0, PI / 2])), q = new THREE.Quaternion();
    m.decompose(tmpP, q, tmpS); parts[P.battery].hp = [tmpP.x, tmpP.y, tmpP.z]; parts[P.battery].hq = q;
  }
  function pcbTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const g = cv.getContext('2d'), r = K.rng(77);
    g.fillStyle = '#1f6a3b'; g.fillRect(0, 0, 512, 512);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const half of [0, 1]) {
      const y0 = half * 256;
      for (let k = 0; k < 240; k++) {
        let x = 10 + r() * 492, y = y0 + 10 + r() * 236;
        g.strokeStyle = half ? '#3a8b55' : '#37945a'; g.lineWidth = r() < 0.12 ? 3.2 : 1.3;
        g.beginPath(); g.moveTo(x, y);
        let dir = Math.floor(r() * 4) * PI / 2;
        for (let s = 0; s < 3; s++) {
          const len = 8 + r() * 55;
          x = K.clamp(x + Math.cos(dir) * len, 8, 504); y = K.clamp(y + Math.sin(dir) * len, y0 + 8, y0 + 248);
          g.lineTo(x, y);
          dir += (r() < 0.5 ? 1 : -1) * PI / (r() < 0.5 ? 2 : 4);
        }
        g.stroke();
        g.fillStyle = '#caa54c'; g.beginPath(); g.arc(x, y, 1.9, 0, 2 * PI); g.fill();
      }
    }
    for (const f of foot) {
      g.strokeStyle = '#e4ece4'; g.lineWidth = 1;
      g.strokeRect(f.x - f.w / 2 - 1.5, f.y - f.h / 2 - 1.5, f.w + 3, f.h + 3);
      g.fillStyle = '#d0ab52';
      if (f.chip) {
        const n = f.chip.pins.length / 2;
        for (let k = 0; k < n; k++) for (const s of [-1, 1]) { const px = f.x - f.w / 2 + (k + 0.5) / n * f.w; g.fillRect(px - 1.2, f.y + s * f.h / 2 - 1.2, 2.4, 2.4); }
      } else for (const s of [-1, 1]) { g.beginPath(); g.arc(f.x + s * f.w * 0.42, f.y, 1.8, 0, 2 * PI); g.fill(); }
    }
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    return tex;
  }
  const mBoard = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, map: pcbTexture() }));
  LIT.push(mBoard);
  // the bare boards carry the texture; sockets and ports are plain plastic and metal
  const boardGeo = (B, v0) => Bld().add(box(B.w, B.t, B.d), null, '#ffffff', (i, x, y, z) => (i >= 12 && i < 24 ? [x / B.w + 0.5, v0 + (0.5 - z / B.d) * 0.5] : [0.004, 0.004])).geo();
  solo(P.logic, boardGeo(LB, 0.5), mBoard);
  solo(P.analog, boardGeo(AB, 0), mBoard);
  {
    // ports along the back edge, the memory sockets, the drive connector
    const b = Bld(), e = -LB.d / 2 + 0.006;
    b.add(box(0.034, 0.012, 0.008), mat([-0.08, 0.008, e]), '#9aa1a8').add(box(0.05, 0.012, 0.008), mat([-0.02, 0.008, e]), '#9aa1a8');
    for (let k = 0; k < 3; k++) b.add(cyl(0.006, 0.006, 0.012, 12), mat([0.04 + k * 0.024, 0.008, e], [PI / 2, 0, 0]), '#2a2b2e');
    for (let k = 0; k < 4; k++) b.add(box(0.135, 0.008, 0.006), mat([0.06, 0.0055, 0.078 + k * 0.012]), '#f0eee6');
    b.add(box(0.04, 0.006, 0.01), mat([-0.06, 0.0045, LB.d / 2 - 0.012]), '#f0eee6');
    solo(P.logic, b.geo(), mPlastic);
    const c = Bld();
    c.add(box(0.03, 0.012, 0.012), mat([0.11, 0.0075, -0.13]), '#f0eee6').add(box(0.02, 0.01, 0.01), mat([-0.1, 0.0065, 0.13]), '#f0eee6');
    solo(P.analog, c.geo(), mPlastic);
  }
  // ---------------------------------------------------------- keyboard --
  const KB = { x: 0, z: 0.36, w: 0.56, d: 0.19, h0: 0.016, h1: 0.03 }, U = 0.0268;
  const kbTop = z => KB.h0 + (KB.h1 - KB.h0) * (0.5 - z / KB.d);   // local z: + towards the front
  const KSLOPE = Math.atan((KB.h1 - KB.h0) / KB.d);
  P.kb = part({ grp: 'kb', hp: [KB.x, FLOOR, KB.z], inner: false, d: 0.36, w: 0.4, arc: 0.12 });
  {
    const b = Bld(), o = rrect(KB.w, KB.d, 0.014, 4), oi = rrect(KB.w - 0.008, KB.d - 0.008, 0.01, 4);
    const ring = (pts, yf) => pts.map(p => [p[0], yf(-p[1]), -p[1]]);
    b.add(loft([ring(o, () => 0.001), ring(o, z => kbTop(z) - 0.003), ring(oi, z => kbTop(z))]), null, BEIGE);
    b.add(fanUp(ring(oi, z => kbTop(z)), [0, kbTop(0), 0]), null, BEIGE);
    // the key well, a little darker
    b.add(box(0.535, 0.0016, 0.139), mat([0, kbTop(0.012) + 0.0004, 0.012], [KSLOPE, 0, 0]), BEIGE3);
    b.add(box(KB.w - 0.02, 0.003, KB.d - 0.03), mat([0, 0.0005, 0]), '#8f8a7e');
    solo(P.kb, b.geo(), mPlastic);
  }
  // Apple-style extended layout without function keys: 5 rows of the main block plus a numeric keypad
  const ROWS = [
    [[1, 1], ...Array(12).fill([1, 0]), [2, 1]],
    [[1.5, 1], ...Array(12).fill([1, 0]), [1.5, 0]],
    [[1.75, 1], ...Array(11).fill([1, 0]), [2.25, 1]],
    [[2.25, 1], ...Array(10).fill([1, 0]), [2.75, 1]],
    [[1.25, 1], [1.25, 1], [1.5, 1], [1, 0], [6, 0], [1, 1], [1, 1], [1, 1], [1, 1]],
  ];
  const PAD = [[[1, 1], [1, 1], [1, 1], [1, 1]], [[1, 0], [1, 0], [1, 0], [1, 1]], [[1, 0], [1, 0], [1, 0], [1, 1]], [[1, 0], [1, 0], [1, 0], [1, 1, 2]], [[2, 0], [1, 0]]];
  const keys = [];
  const kx0 = -19.5 * U / 2, kz0 = -2.5 * U + 0.012;
  ROWS.forEach((row, r) => { let x = kx0; row.forEach(([w, mod]) => { keys.push({ x: x + w * U / 2, z: kz0 + (r + 0.5) * U, w, h: 1, mod, r }); x += w * U; }); });
  PAD.forEach((row, r) => { let x = kx0 + 15.5 * U; row.forEach(([w, mod, h]) => { if (r === 4 && x > kx0 + 18 * U) return; keys.push({ x: x + w * U / 2, z: kz0 + (r + 0.5 + ((h || 1) - 1) / 2) * U, w, h: h || 1, mod, r }); x += w * U; }); });
  keys.push({ x: 0, z: kz0 - 0.55 * U, w: 1.4, h: 0.7, mod: 1, r: -1, power: true });
  keys.forEach((k, i) => {
    const y = kbTop(k.z) + 0.0012;
    k.pi = part({ grp: 'key', hp: [KB.x + k.x, FLOOR + y, KB.z + k.z], hr: [KSLOPE, 0, 0], inner: false, d: 0.08 + 0.035 * (k.r + 1) + 0.004 * (k.x / U + 10), w: 0.26, arc: 0.07 });
    piece('key', k.pi, mat([0, 0, 0], null, [k.w * U - 0.0035, 0.0105, k.h * U - 0.0035]), k.power ? '#99927f' : k.mod ? '#938c7b' : '#aca593');
  });

  // ------------------------------------------------------------- mouse --
  const MS = { x: 0.43, z: 0.35, yaw: -0.12 };
  const msAt = (lx, ly, lz) => [MS.x + lx * Math.cos(MS.yaw) + lz * Math.sin(MS.yaw), FLOOR + ly, MS.z - lx * Math.sin(MS.yaw) + lz * Math.cos(MS.yaw)];
  P.mouse = part({ grp: 'mouse', hp: msAt(0, 0, 0), hr: [0, MS.yaw, 0], inner: false, d: 0.16, w: 0.36, arc: 0.12 });
  {
    const b = Bld(), base = rrect(0.084, 0.148, 0.012, 4), mid = rrect(0.084, 0.148, 0.014, 4), top = rrect(0.076, 0.138, 0.016, 4);
    const hy = z => 0.026 + 0.006 * (0.5 + z / 0.148);   // a little higher at the back
    const ring = (pts, yf) => pts.map(p => [p[0], yf(-p[1]), -p[1]]);
    b.add(loft([ring(base, () => 0.002), ring(mid, z => hy(z) - 0.004), ring(top, z => hy(z))]), null, BEIGE);
    b.add(fanUp(ring(top, z => hy(z)), [0, hy(0), 0]), null, BEIGE);
    solo(P.mouse, b.geo(), mPlastic);
  }
  P.mbutton = part({ grp: 'mouse', hp: msAt(0, 0.0262, -0.052), hr: [-0.04, MS.yaw, 0], inner: false, d: 0.14, w: 0.34, arc: 0.1 });
  piece('box', P.mbutton, mat([0, 0, 0], null, [0.068, 0.004, 0.036]), BEIGE2);
  P.mball = part({ grp: 'mouse', hp: msAt(0, 0.012, 0.01), d: 0.22, w: 0.36, arc: 0.1, spin: 2, axis: [1, 0, 0] });
  piece('sph', P.mball, mat([0, 0, 0], null, 0.024), '#47474c');
  P.mplate = part({ grp: 'mouse', hp: msAt(0, 0.0015, 0.0), hr: [0, MS.yaw, 0], d: 0.2, w: 0.36, arc: 0.1 });
  piece('box', P.mplate, mat([0, 0, 0], null, [0.078, 0.002, 0.14]), BEIGE2);
  piece('ring', P.mplate, mat([0, 0.001, 0.01], [PI / 2, 0, 0], 0.034), '#6f6a60');
  for (let k = 0; k < 2; k++) {
    const pi = part({ grp: 'mouse', hp: msAt(k ? 0.014 : -0.014, 0.012, k ? 0.0 : 0.02), hr: [0, k ? 0 : PI / 2, 0], d: 0.23 + 0.01 * k, w: 0.32, arc: 0.08, lr: [0, 0, 0] });
    piece('cylm', pi, mat([0, 0, 0], [0, 0, PI / 2], [0.004, 0.03, 0.004]), '#b9bec4');
    piece('cyl', pi, mat([0.012, 0, 0], [0, 0, PI / 2], [0.014, 0.0012, 0.014]), '#2a2b2e');
    P['roller' + k] = pi;
  }
  // ---------------------------------------------- drive, power, speaker, fan --
  P.floppy = part({ grp: 'drive', hp: [SLOT[0], SLOT[1] - 0.006, CZ - 0.114], d: 0.26, w: 0.4, arc: 0.2 });
  {
    const b = Bld(), W = 0.15, H = 0.03, D = 0.2;
    b.add(box(W, 0.002, D), mat([0, H / 2 - 0.001, 0]), '#b9c0c7');
    b.add(box(W - 0.006, H - 0.004, D - 0.004), mat([0, -0.001, -0.002]), '#6d737a');
    b.add(box(W, 0.002, D), mat([0, -H / 2 + 0.001, 0]), '#8e959c');
    b.add(box(W + 0.002, H + 0.002, 0.008), mat([0, 0, D / 2 - 0.003]), '#232427');
    b.add(box(0.112, 0.0055, 0.002), mat([0, 0.006, D / 2 + 0.0012]), '#070708');
    b.add(cyl(0.022, 0.022, 0.004, 24), mat([0, H / 2 + 0.002, 0.01]), '#a9b0b8');
    b.add(box(0.05, 0.003, 0.03), mat([0.04, H / 2 + 0.0015, -0.06]), PCB);
    b.add(box(0.012, 0.004, 0.06), mat([-0.045, H / 2 + 0.002, -0.03]), '#2c2d30');
    solo(P.floppy, b.geo(), mMetal);
  }
  P.psu = part({ grp: 'drive', hp: [0.105, CY0 + 0.045, -0.21], d: 0.3, w: 0.4, arc: 0.22 });
  {
    const b = Bld(), W = 0.1, H = 0.06, D = 0.11;
    b.add(box(W, H, D), null, '#b3bac2');
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) b.add(box(0.008, 0.002, 0.012), mat([-0.03 + j * 0.02, H / 2 + 0.0004, -0.04 + i * 0.016]), '#3a3e44');
    b.add(box(0.028, 0.014, 0.02), mat([0.0, -0.008, D / 2 + 0.008]), DARK);
    b.add(box(0.016, 0.012, 0.004), mat([0.03, 0.01, D / 2 + 0.002]), '#c43c2e');
    solo(P.psu, b.geo(), mMetal);
  }
  P.speaker = part({ grp: 'drive', hp: [-0.105, CY0 + 0.07, CZ - 0.035], hr: [PI / 2, 0, 0], d: 0.24, w: 0.38, arc: 0.18 });
  {
    const prof = [[0.012, 0.0], [0.03, 0.002], [0.034, 0.006], [0.036, 0.0075], [0.033, 0.007], [0.012, -0.004], [0.008, -0.004], [0.0, -0.002]];
    const cone = new THREE.LatheGeometry([[0, 0.0005], [0.009, 0.0008], [0.01, -0.003], [0.031, 0.004], [0.034, 0.0045]].map(p => new THREE.Vector2(p[0], p[1])), 20);
    const b = Bld();
    b.add(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 20), null, '#9aa1a8');
    b.add(cone, null, '#2e2c2a');
    b.add(cyl(0.017, 0.017, 0.012, 18), mat([0, -0.011, 0]), '#45484d');
    b.add(cyl(0.009, 0.009, 0.0016, 14), mat([0, -0.0028, 0]), '#3a3835');
    for (const sx of [-1, 1]) b.add(box(0.012, 0.0015, 0.01), mat([sx * 0.038, 0.0066, 0]), '#9aa1a8');
    solo(P.speaker, b.geo(), mMetal);
  }
  P.fan = part({ grp: 'drive', hp: [-0.13, CY0 + 0.3, -0.24], hr: [0, 0, PI / 2], d: 0.28, w: 0.38, arc: 0.2 });
  {
    const b = Bld(), S = 0.07, Tk = 0.02;
    const sh = new THREE.Shape(rrect(S, S, 0.006, 3).map(p => new THREE.Vector2(p[0], p[1])));
    sh.holes.push(new THREE.Path(rrect(0.064, 0.064, 0.031, 5).map(p => new THREE.Vector2(p[0], p[1]))));
    const fr = new THREE.ExtrudeGeometry(sh, { depth: Tk, bevelEnabled: false, curveSegments: 4 });
    fr.translate(0, 0, -Tk / 2); fr.rotateX(PI / 2);
    b.add(fr, null, '#2b2c2f');
    b.add(cyl(0.012, 0.012, Tk * 0.8, 18), null, '#36373b');
    for (let k = 0; k < 7; k++) b.add(box(0.022, 0.0014, 0.012), mat([Math.cos(k / 7 * 2 * PI) * 0.022, 0, Math.sin(k / 7 * 2 * PI) * 0.022], [0.5, -k / 7 * 2 * PI, 0]), '#36373b');
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.add(cyl(0.0024, 0.0024, Tk + 0.0006, 8), mat([sx * 0.029, 0, sz * 0.029]), '#16171a');
    solo(P.fan, b.geo(), mPlastic);
  }
  // rubber feet, nylon standoffs, plastic clips, steel brackets, washers, springs
  const feet = [], small = [];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], k) => {
    const pi = part({ grp: 'feet', hp: [sx * 0.13, CY0 - 0.003, sz < 0 ? BACK + 0.04 : CZ - 0.04], inner: false, d: 0.07 + 0.01 * k, w: 0.3, arc: 0.1 });
    piece('cyl', pi, mat([0, 0, 0], null, [0.018, 0.006, 0.018]), '#3b3b3d');
    feet.push(pi);
  });
  const inside = () => [(R() - 0.5) * 0.28, CY0 + 0.03 + R() * 0.38, BACK + 0.03 + R() * 0.32];
  for (let k = 0; k < 6; k++) { const pi = part({ grp: 'standoff', hp: inside(), d: 0.4 + 0.01 * k, w: 0.32, arc: 0.1 }); piece('cyl', pi, mat([0, 0, 0], null, [0.006, 0.012, 0.006]), '#efece2'); small.push(pi); }
  for (let k = 0; k < 6; k++) {
    const pi = part({ grp: 'clip', hp: inside(), d: 0.38 + 0.01 * k, w: 0.32, arc: 0.1 });
    piece('box', pi, mat([0, 0, 0], null, [0.016, 0.004, 0.008]), '#e8e3d6'); piece('box', pi, mat([0.0065, 0.004, 0], null, [0.003, 0.008, 0.008]), '#e8e3d6');
    small.push(pi);
  }
  for (let k = 0; k < 5; k++) {
    const pi = part({ grp: 'bracket', hp: inside(), d: 0.42 + 0.01 * k, w: 0.34, arc: 0.12 }), L = 0.03 + 0.012 * k;
    piece('boxm', pi, mat([0, 0, 0], null, [L, 0.0015, 0.014]), '#aeb6bf'); piece('boxm', pi, mat([L / 2 - 0.0008, 0.006, 0], null, [0.0015, 0.012, 0.014]), '#aeb6bf');
    small.push(pi);
  }
  for (let k = 0; k < 10; k++) { const pi = part({ grp: 'washer', hp: inside(), d: 0.3 + 0.015 * k, w: 0.3, arc: 0.1, lr: [PI / 2, 0, 0] }); piece('ring', pi, mat([0, 0, 0], null, 0.012 + 0.002 * (k % 3)), '#c8cdd3'); small.push(pi); }
  for (let k = 0; k < 4; k++) {
    const pi = part({ grp: 'spring', hp: inside(), d: 0.33 + 0.02 * k, w: 0.32, arc: 0.12, lr: [0, 0, PI / 2] }), r = 0.0026 + 0.0008 * k;
    piece('spring', pi, mat([0, 0, 0], null, [r, 0.004 + 0.0012 * k, r]), '#c9ced4');
    small.push(pi);
  }

  // ------------------------------------------------------------ screws --
  // long case screws at the back first, then the rest of each part's screws
  const screws = [];
  function screw(hp, hr, d, long) {
    const pi = part({ grp: long ? 'screwL' : 'screw', hp, hr, d, w: 0.3, arc: 0.1, spin: long ? 4 : 3, axis: [0, 1, 0], inner: !long, lr: [-PI / 2, 0, 0] });
    const sc = long ? 0.012 : 0.0095 + 0.002 * R();
    piece(long ? 'screwL' : 'screw', pi, mat([0, 0, 0], null, sc), long ? '#cfd4da' : '#b9bfc6');
    parts[pi].len = sc * (long ? 4.7 : 1.6);
    screws.push(pi);
    return pi;
  }
  [[-0.05, CY1 - 0.065], [0.05, CY1 - 0.065], [-0.12, CY0 + 0.03], [0.12, CY0 + 0.03], [0, CY0 + 0.1]].forEach(([x, y], k) => screw([x, y, BACK - 0.002], [-PI / 2, 0, 0], 0.005 * k, true));
  // every other screw sits where it holds something, in the frame of its part: [x, y, z, head direction]
  function screwsOn(pi, list, d0) {
    list.forEach(([x, y, z, r], k) => {
      const m = homeM(pi).multiply(mat([x, y, z], r)), q = new THREE.Quaternion();
      m.decompose(tmpP, q, tmpS);
      parts[screw([tmpP.x, tmpP.y, tmpP.z], null, d0 - 0.03 + 0.006 * k)].hq = q;
    });
  }
  const UP = [0, 0, 0], DOWN = [PI, 0, 0], BACKW = [-PI / 2, 0, 0];
  const corners = (w, d, y, r, mid) => [[-1, -1], [1, -1], [1, 1], [-1, 1], ...(mid ? [[-1, 0], [1, 0]] : [])].map(([sx, sz]) => [sx * w, y, sz * d, r]);
  screwsOn(P.crt, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [sx * (FW / 2 + 0.0037), sy * (FH / 2 + 0.0037), FACE_Z - 0.0316 - crtC[2], BACKW]), 0.25);
  screwsOn(P.logic, corners(LB.w / 2 - 0.007, LB.d / 2 - 0.007, LB.t / 2, UP, true), 0.42);
  screwsOn(P.analog, corners(AB.w / 2 - 0.007, AB.d / 2 - 0.007, AB.t / 2, UP, true), 0.34);
  screwsOn(P.floppy, corners(0.06, 0.07, -0.016, DOWN), 0.26);
  screwsOn(P.psu, corners(0.042, 0.047, 0.03, UP), 0.3);
  screwsOn(P.fan, corners(0.029, 0.029, 0.0103, UP), 0.28);
  screwsOn(P.speaker, [[-0.04, 0.0074, 0, UP], [0.04, 0.0074, 0, UP]], 0.24);
  heat.forEach((pi, k) => screwsOn(pi, [[0, -0.008, 0.019, [PI / 2, 0, 0]]], 0.33 + 0.02 * k));
  screwsOn(P.xfmr, [[-0.022, -0.012, 0, UP], [0.022, -0.012, 0, UP]], 0.36);
  for (let k = 0; k < 7; k++) screw([KB.x + (k / 6 - 0.5) * 0.48, FLOOR + 0.006, KB.z + (k % 2 ? 0.05 : -0.05)], DOWN, 0.3 + 0.005 * k);
  screw(msAt(0, 0.006, 0.04), DOWN, 0.18);
  // spares for the chassis
  for (let k = 0; k < 6; k++) screw(inside(), UP, 0.32 + 0.015 * k);
  // ------------------------------------------------------------ cables --
  // each cable is one piece, built where it runs in the computer and centred on its own part;
  // the long ones also get a second shape (a neat flat coil) that they morph into as they land
  const mCable = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, morphTargets: true, morphNormals: true }));
  LIT.push(mCable);
  const coils = [];
  function cable(o, pts, r, c, extra, coil) {
    const ctr = pts.reduce((s, p) => K.v3.add(s, K.v3.mul(p, 1 / pts.length)), [0, 0, 0]);
    const loc = pts.map(p => K.v3.sub(p, ctr)), n = coil ? 110 : loc.length * 12;
    const build = l => {
      const b = Bld();
      b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(l.map(p => V(p[0], p[1], p[2]))), n, r, 6, false), null, c);
      if (extra) extra(b, l);
      return b.geo();
    };
    const g = build(loc), pi = part(Object.assign({ grp: 'cable', hp: ctr }, o));
    if (!coil) { solo(pi, g, mPlastic); return pi; }
    const gl = build(coil);
    g.morphAttributes.position = [gl.attributes.position]; g.morphAttributes.normal = [gl.attributes.normal];
    gl.computeBoundingBox(); parts[pi].layBox = gl.boundingBox;
    coils.push({ pi, mesh: solo(pi, g, mCable) });
    return pi;
  }
  // a flat spiral of the given length, lying on the table (y is the height of the plugs' centres)
  function spiral(len, r0, turns, y) {
    const k = len / (2 * PI * turns), r1 = 2 * k - r0, out = [];
    for (let i = 0; i <= 64; i++) { const f = i / 64, a = f * turns * 2 * PI, rr = r0 + (r1 - r0) * f; out.push([rr * Math.cos(a), y, rr * Math.sin(a)]); }
    const l = out[64], q = out[63], d = K.v3.norm(K.v3.sub(l, q));
    out.push(K.v3.add(l, K.v3.mul(d, 0.02)));
    return out;
  }
  const plen = pts => pts.reduce((s, p, i) => s + (i ? K.v3.dist(p, pts[i - 1]) : 0), 0);
  const plug = (b, p, q, c) => { const d = K.v3.norm(K.v3.sub(p, q)); b.add(box(0.011, 0.009, 0.016), mat(K.v3.add(p, K.v3.mul(d, 0.006)), [0, Math.atan2(d[0], d[2]), 0]), c); };
  const F = FLOOR;
  {
    const kp = [[-0.215, F + 0.012, 0.27], [-0.232, F + 0.004, 0.24], [-0.255, F + 0.003, 0.16], [-0.25, F + 0.003, 0.0],
      [-0.235, F + 0.003, -0.2], [-0.2, F + 0.003, -0.33], [-0.125, F + 0.004, -0.345], [-0.092, F + 0.022, -0.318], [-0.09, F + 0.04, -0.304]];
    P.kbCable = cable({ inner: false, d: 0.1, w: 0.36, arc: 0.12 }, kp, 0.0028, '#c4bdac',
      (b, l) => { plug(b, l[0], l[1], '#8f897c'); plug(b, l[l.length - 1], l[l.length - 2], '#8f897c'); }, spiral(plen(kp) - 0.02, 0.03, 2.25, 0.0045));
    const mp = [msAt(0, 0.009, -0.074), msAt(0, 0.003, -0.1), [0.385, F + 0.003, 0.228], [0.33, F + 0.003, 0.218], [0.296, F + 0.004, 0.25], [0.284, F + 0.012, 0.285]];
    P.msCable = cable({ inner: false, d: 0.12, w: 0.34, arc: 0.1 }, mp, 0.0024, '#c4bdac',
      (b, l) => plug(b, l[l.length - 1], l[l.length - 2], '#8f897c'), spiral(plen(mp) - 0.02, 0.022, 1.6, 0.0045));
  }
  // the floppy's flat ribbon cable, grey with a red edge
  P.ribbon = part({ grp: 'cable', hp: [0.03, CY0 + 0.03, -0.06], d: 0.3, w: 0.38, arc: 0.16 });
  {
    const curve = new THREE.CatmullRomCurve3([V(-0.1, 0, -0.04), V(-0.02, 0, -0.07), V(0.05, 0, -0.03), V(0.1, 0, 0.05)]);
    const b = Bld(), W = 0.03, pos = [], cols = [], N = 40, lanes = [[-0.5, -0.4, '#b8443a'], [-0.4, 0.5, '#9a9ea4']];
    for (let i = 0; i < N; i++) {
      const p0 = curve.getPoint(i / N), p1 = curve.getPoint((i + 1) / N), t0 = curve.getTangent(i / N), t1 = curve.getTangent((i + 1) / N);
      const s0 = V(-t0.z, 0, t0.x).normalize(), s1 = V(-t1.z, 0, t1.x).normalize();
      for (const [a, c2, cl] of lanes) for (const y of [0.0007, -0.0007]) {
        const A = p0.clone().addScaledVector(s0, a * W), B = p0.clone().addScaledVector(s0, c2 * W), C = p1.clone().addScaledVector(s1, c2 * W), D = p1.clone().addScaledVector(s1, a * W);
        const q = y > 0 ? [A, B, C, A, C, D] : [A, C, B, A, D, C];
        for (const v of q) { pos.push(v.x, v.y + y, v.z); cols.push(...K.rgb(cl)); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    if (g.attributes.normal.array[1] < 0) { const a = g.attributes.position.array; for (let k = 0; k < a.length; k += 9) for (let m = 0; m < 3; m++) { const t = a[k + 3 + m]; a[k + 3 + m] = a[k + 6 + m]; a[k + 6 + m] = t; } g.computeVertexNormals(); }
    b.add(g, null, '#ffffff');
    const gg = b.geo(); gg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    for (const u of [0, 1]) { const p = curve.getPoint(u), t = curve.getTangent(u); gg.userData.ends = gg.userData.ends || []; gg.userData.ends.push([p, t]); }
    const eb = Bld();
    for (const [p, t] of gg.userData.ends) eb.add(box(0.034, 0.007, 0.01), mat([p.x, p.y + 0.002, p.z], [0, Math.atan2(t.x, t.z) + PI / 2, 0]), '#232427');
    solo(P.ribbon, K.merge([gg, eb.geo()]), mPlastic);
  }
  P.anode = cable({ d: 0.29, w: 0.38, arc: 0.18 }, [[-0.14, SCR_Y + 0.07, -0.08], [-0.09, SCR_Y + 0.1, -0.05], [-0.03, SCR_Y + 0.1, -0.08], [0.0, SCR_Y + 0.1, -0.12]], 0.0035, '#b8322a',
    (b, l) => b.add(cyl(0.003, 0.014, 0.008, 16), mat(l[l.length - 1]), '#1c1c1e'));
  P.harness = part({ grp: 'cable', hp: [-0.06, SCR_Y - 0.04, -0.2], d: 0.31, w: 0.38, arc: 0.16 });
  {
    const b = Bld();
    ['#c8473c', '#1c1c1e', '#2f62c8', '#e0c23e'].forEach((c, k) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const x = -0.09 + i * 0.0225; pts.push([x, 0.0016 * Math.sin(i * 1.7 + k * 1.6), (k - 1.5) * 0.0032 + 0.012 * Math.sin(i * 0.8)]); }
      b.add(K.tube(pts, 0.0016, 60, 5), null, c);
    });
    b.add(box(0.016, 0.008, 0.018), mat([0.095, 0, 0.012 * Math.sin(6.4)]), '#f0eee6');
    b.add(box(0.012, 0.006, 0.016), mat([-0.093, 0, 0]), '#f0eee6');
    solo(P.harness, b.geo(), mPlastic);
  }
  // ------------------------------------------------------ the teardown --
  // every part's footprint in its lying pose, from the boxes of its pieces
  const pieceBoxes = parts.map(() => []);
  for (const k of kindList) { const g = KINDS[k].geo; g.computeBoundingBox(); for (const it of KINDS[k].list) pieceBoxes[it.pi].push([g.boundingBox, it.m]); }
  for (const s of solos) { s.mesh.geometry.computeBoundingBox(); pieceBoxes[s.pi].push([s.mesh.geometry.boundingBox, s.local || new THREE.Matrix4()]); }
  function aabb(pi, q) {
    const rm = new THREE.Matrix4().makeRotationFromQuaternion(q), bb = new THREE.Box3(), tb = new THREE.Box3();
    for (const [b, m] of pieceBoxes[pi]) bb.union(tb.copy(b).applyMatrix4(m).applyMatrix4(rm));
    return bb;
  }
  const layQ = (pi, yaw) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw || 0, 0)).multiply(quat(parts[pi].lr || [0, 0, 0]));
  // the box of a part lying with rotation q (coiled cables have their own laid shape)
  const layBox = (pi, q) => (parts[pi].layBox ? parts[pi].layBox.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)) : aabb(pi, q));
  function size(pi, yaw) { const b = layBox(pi, layQ(pi, yaw)); return [b.max.x - b.min.x, b.max.z - b.min.z]; }
  // lay a part down with its footprint centred on (x, z)
  function place(pi, x, z, yaw) {
    const p = parts[pi], q = layQ(pi, yaw), b = layBox(pi, q);
    p.lq = q; p.lp = [x - (b.min.x + b.max.x) / 2, FLOOR - b.min.y + 0.0004, z - (b.min.z + b.max.z) / 2];
    p.at = [x, z];
  }
  // neat rows: parts left to right from x0 to x1, wrapping; each row centred on its own line,
  // spread out evenly when just is set; returns the z below the last row
  function rows(list, x0, x1, z, gap, rgap, yaw, just) {
    const items = list.map(pi => ({ pi, s: size(pi, yaw) }));
    let i = 0;
    while (i < items.length) {
      const row = []; let w = 0;
      while (i < items.length && (row.length === 0 || w + gap + items[i].s[0] <= x1 - x0)) { w += (row.length ? gap : 0) + items[i].s[0]; row.push(items[i++]); }
      // justified rows spread to fill the width (a short last row keeps its gaps)
      const h = Math.max(...row.map(it => it.s[1])), g = just && row.length > 1 && (i < items.length || w > 0.6 * (x1 - x0)) ? gap + (x1 - x0 - w) / (row.length - 1) : gap;
      let x = x0;
      for (const it of row) { place(it.pi, x + it.s[0] / 2, z + h / 2, yaw); x += it.s[0] + g; }
      z += h + rgap;
    }
    return z;
  }
  const grp = g => parts.map((p, i) => (p.grp === g ? i : -1)).filter(i => i >= 0);
  // top row: the boards, the two halves of the case, the tube face down, the drive; under the tube the
  // analogue board's big parts, under the drive the power supply, the fan and the speaker
  place(P.logic, -0.695, -0.555);
  place(P.analog, -0.695, -0.24);
  place(P.rear, -0.345, -0.46);
  place(P.bezel, 0.035, -0.46);
  place(P.crt, 0.405, -0.562);
  place(P.floppy, 0.725, -0.599);
  place(P.psu, 0.66, -0.41);
  place(P.fan, 0.79, -0.44);
  place(P.speaker, 0.79, -0.335);
  rows([P.flyback, P.xfmr, ...heat], 0.255, 0.57, -0.39, 0.03, 0.02, 0, true);
  // electronics in the middle: chips by size, a long line of resistors by value, capacitors, crystals
  const chipsBy = nodes.filter(n => n.kind === 'chip').sort((a, b) => b.n - a.n || b.W - a.W).map(n => n.pi);
  // the gaps between these rows are the channels the wiring runs in (power, address, data and ground buses)
  const BUS = [-0.205], RG = 0.068;
  const MX0 = -0.5, MX1 = 0.84;
  let z = rows(chipsBy.slice(0, 8), MX0, MX1, -0.18, 0.035, RG, 0, true);
  BUS.push(z - RG / 2);
  z = rows(chipsBy.slice(8), MX0, MX1, z, 0.03, RG, 0, true);
  BUS.push(z - RG / 2);
  z = rows(grp('res').sort((a, b) => parts[a].ord - parts[b].ord), MX0, MX1, z, 0.014, RG, PI / 2, true);
  BUS.push(z - RG / 2);
  rows([...grp('elco').sort((a, b) => parts[a].ord - parts[b].ord), ...grp('xtal'), ...grp('disc'), P.fuse, P.battery, ...grp('misc').filter(i => i !== P.fuse && i !== P.battery)], MX0, MX1, z, 0.02, 0.025, 0, true);
  // left: memory modules and cables, the keyboard's coiled up
  rows(simms, -0.845, -0.545, -0.045, 0.03, 0.022, 0, true);
  place(P.ribbon, -0.695, 0.165);
  place(P.kbCable, -0.765, 0.37); place(P.anode, -0.6, 0.37, PI / 2);
  place(P.harness, -0.695, 0.555);
  // bottom: keyboard case, its key caps spread out in their own pattern, a line of screws
  place(P.kb, 0, 0.3);
  for (const k of keys) place(k.pi, k.x * 1.32, 0.565 + (k.z - 0.012) * 1.32);
  // the screws in one line across the front, longest first
  const scr = screws.slice().sort((a, b) => parts[b].len - parts[a].len);
  {
    let x = -0.66;
    for (const pi of scr) { const long = parts[pi].grp === 'screwL', w = size(pi, long ? -PI / 2 : 0)[0]; place(pi, x + w / 2, 0.705, long ? -PI / 2 : 0); x += w + (long ? 0.016 : 0.0085); }
  }
  // right: the mouse in pieces, feet, springs, washers, standoffs, clips, brackets
  place(P.mouse, 0.5, 0.29); place(P.mplate, 0.6, 0.29); place(P.mbutton, 0.7, 0.25); place(P.mball, 0.7, 0.31);
  place(P.roller0, 0.76, 0.25, PI / 2); place(P.roller1, 0.76, 0.31, PI / 2); place(P.msCable, 0.82, 0.28);
  z = rows(feet, 0.45, 0.86, 0.43, 0.02, 0.02);
  z = rows(grp('spring'), 0.45, 0.86, z, 0.02, 0.02);
  z = rows(grp('washer'), 0.45, 0.86, z, 0.012, 0.02);
  z = rows([...grp('standoff'), ...grp('clip')], 0.45, 0.86, z, 0.016, 0.02);
  rows(grp('bracket'), 0.45, 0.86, z, 0.02, 0.02);
  // parts from inside that land in front of the computer wait until the front bezel has lifted (no flying through it)
  for (const p of parts) if (p.inner && p.at[1] > CZ - 0.02) p.d = Math.max(p.d, 0.5);
  // the pale table of the teardown photo
  const table = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.02, TD), K.fade(set, new THREE.MeshStandardMaterial({ color: TABLE, roughness: 0.92 })));
  table.position.y = FLOOR - 0.0102;
  table.renderOrder = -1;
  set.group.add(table);

  // ------------------------------------------------------------ wiring --
  // A netlist over the laid-out electronics, drawn like a schematic: buses run along the gaps between
  // the rows, every chip taps some of them, resistors and capacitors hang between chips and the buses.
  const WY = FLOOR + 0.0125, BX0 = MX0 - 0.02, BX1 = MX1 + 0.02, NETY = -0.14, rw = K.rng(42);
  // each bus (power, address, data, ground) is a chain of four hub nodes in the network
  const SEG = 4, segX = s => BX0 + (s + 0.5) * (BX1 - BX0) / SEG, HUB = [];
  BUS.forEach(z => { for (let s = 0; s < SEG; s++) HUB.push({ x: segX(s), z }); });
  const hubAt = (k, x) => k * SEG + K.clamp(Math.floor((x - BX0) / (BX1 - BX0) * SEG), 0, SEG - 1);
  const pinAt = (n, k) => {
    const p = parts[n.pi], pin = n.pins[k], v = V(...pin.p).applyQuaternion(p.lq).add(p.lpV || V(...p.lp)), d = V(...pin.d).applyQuaternion(p.lq);
    const l = Math.hypot(d.x, d.z) || 1;
    return { x: v.x, z: v.z, dx: d.x / l, dz: d.z / l };
  };
  nodes.forEach(n => { n.used = new Set(); const e = parts[n.pi]; n.x = e.at[0]; n.z = e.at[1]; });
  // a free pin of node n, on the side facing dz (0: any), nearest to x
  function freePin(n, dz, x) {
    let best = -1, bd = 1e9;
    n.pins.forEach((p, k) => {
      if (n.used.has(k)) return;
      const q = pinAt(n, k);
      if (dz && Math.sign(q.dz) !== dz && n.kind === 'chip') return;
      const d = x === undefined ? rw() : Math.abs(q.x - x) + rw() * 0.004;
      if (d < bd) { bd = d; best = k; }
    });
    if (best < 0) best = Math.floor(rw() * n.pins.length);
    n.used.add(best);
    return pinAt(n, best);
  }
  const wires = [];   // { pts: [[x, z]], a: node index or hub, b: ..., order }
  const NH = nodes.length;   // hub k is network node NH + k
  const busOf = z => BUS.reduce((b, bz, k) => (Math.abs(bz - z) < Math.abs(BUS[b] - z) ? k : b), 0);
  const lane = () => (rw() < 0.5 ? -1 : 1) * (0.007 + 0.0065 * Math.floor(rw() * 4));
  function addWire(pts, a, b) {
    const out = [];
    for (const p of pts) { const l = out[out.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 1e-4) out.push(p); }
    // drop points in the middle of straight runs
    for (let i = out.length - 2; i > 0; i--) { const a0 = out[i - 1], a1 = out[i], a2 = out[i + 1]; if (Math.abs((a1[0] - a0[0]) * (a2[1] - a1[1]) - (a1[1] - a0[1]) * (a2[0] - a1[0])) < 1e-9) out.splice(i, 1); }
    if (out.length > 1) wires.push({ pts: out, a, b });
  }
  // a tap from a pin straight onto a bus, with a junction dot where it lands
  const junctions = [];
  function tap(ni, hub, dz) {
    const n = nodes[ni], p = freePin(n, dz), s = 0.004 + rw() * 0.004;
    const x1 = Math.abs(p.dx) > 0.5 ? p.x + p.dx * s : p.x;
    addWire([[p.x, p.z], [x1, p.z + (Math.abs(p.dz) > 0.5 ? p.dz * s : 0)], [x1, BUS[hub]]], ni, NH + hubAt(hub, x1));
    junctions.push({ x: x1, z: BUS[hub], w: wires.length - 1 });
  }
  // a point-to-point wire through the channel next to the first pin
  function link(ai, bi, adz, bdz) {
    const A = nodes[ai], B = nodes[bi], p = freePin(A, adz, B.x), q = freePin(B, bdz, A.x), s = 0.005 + rw() * 0.004;
    const pz = Math.abs(p.dz) > 0.5 ? p.dz : -1, ch = BUS.filter(z => (z - p.z) * pz > 0).sort((u, v) => Math.abs(u - p.z) - Math.abs(v - p.z))[0];
    const cz = (ch === undefined ? p.z + pz * 0.02 : ch) + lane();
    const p1 = [p.x + p.dx * s, p.z + p.dz * s], q1 = [q.x + q.dx * s, q.z + q.dz * s];
    addWire([[p.x, p.z], p1, [p1[0], cz], [q1[0], cz], q1, [q.x, q.z]], ai, bi);
  }
  const idx = pi => nodes.findIndex(n => n.pi === pi);
  const rowA = chipsBy.slice(0, 8).map(idx), rowB = chipsBy.slice(8).map(idx);
  const resN = grp('res').sort((a, b) => parts[a].ord - parts[b].ord).map(idx);
  const capN = nodes.map((n, k) => (n.kind === 'cap' ? k : -1)).filter(k => k >= 0), xtN = nodes.map((n, k) => (n.kind === 'xtal' ? k : -1)).filter(k => k >= 0);
  // the bus lines themselves, then the chips' taps
  BUS.forEach((z, k) => {
    const h = NH + k * SEG;
    addWire([[BX0, z], [segX(0), z]], h, h); addWire([[segX(SEG - 1), z], [BX1, z]], h + SEG - 1, h + SEG - 1);
    for (let s = 0; s < SEG - 1; s++) addWire([[segX(s), z], [segX(s + 1), z]], h + s, h + s + 1);
  });
  wires.forEach(w => { w.bus = true; });
  rowA.forEach(ni => { tap(ni, 0, -1); tap(ni, 1, 1); tap(ni, 1, 1); if (nodes[ni].n >= 40) tap(ni, 1, 1); tap(ni, 2, 1); });
  rowB.forEach((ni, k) => { tap(ni, 1, -1); if (k < 9) tap(ni, 2, 1); });
  // chips talk to their neighbours and to a few far away
  rowA.forEach((ni, k) => { if (k < rowA.length - 1) link(ni, rowA[k + 1], 1, 1); link(ni, rowB[Math.floor(rw() * rowB.length)], 1, -1); });
  rowB.forEach((ni, k) => { if (k % 2 === 0 && k < rowB.length - 1) link(ni, rowB[k + 1], 1, 1); if (k % 3 === 0) link(ni, rowA[Math.floor(rw() * rowA.length)], -1, 1); });
  // resistors: pull-ups to the data bus or a chip above, the other end to ground or to a capacitor
  resN.forEach((ni, k) => {
    if (k % 3 === 0) tap(ni, 2, 0); else link(ni, rowB[Math.min(rowB.length - 1, Math.floor((nodes[ni].x - BX0) / (BX1 - BX0) * rowB.length))], 0, 1);
    if (k % 2 === 0) tap(ni, 3, 0); else link(ni, capN[Math.floor(rw() * capN.length)], 0, 0);
  });
  capN.forEach(ni => tap(ni, 3, 0));
  // the clock crystals feed the processor and the video chip: two long lines each
  xtN.forEach((ni, k) => { link(ni, rowA[k ? 6 : 0], 0, -1); link(ni, rowA[k ? 6 : 0], 0, -1); });
  // reveal order: the buses first, then outwards from the processor
  const cpu = nodes[rowA[0]];
  wires.forEach((w, k) => { w.order = w.a >= NH ? -1 + k * 0.01 : Math.hypot(w.pts[0][0] - cpu.x, w.pts[0][1] - cpu.z) + rw() * 0.15; });
  const ord = wires.slice().sort((a, b) => a.order - b.order);
  const nb = wires.filter(w => w.a >= NH).length;
  ord.forEach((w, k) => { w.w0 = w.a >= NH ? 0.005 * k : 0.1 + 0.74 * (k - nb) / (ord.length - nb); });
  // network layout: nodes start where the parts lie and relax in 3D (springs along the wires, all nodes repel)
  const NN = NH + HUB.length, EDGES = [];
  for (const w of wires) if (w.a !== w.b) EDGES.push([w.a, w.b]);
  const P0 = [], P1 = [];
  for (let k = 0; k < NN; k++) P0.push(k < NH ? [nodes[k].x, WY, nodes[k].z] : [HUB[k - NH].x, WY, HUB[k - NH].z]);
  // a small force layout in 3D: springs along the wires, every pair repels, a weak pull to the centre
  // (its own function, so the engine optimises the hot loops)
  function relax(p, n, E, IT) {
    const f = new Float64Array(n * 3);
    for (let it = 0; it < IT; it++) {
      f.fill(0);
      for (let i = 0; i < n; i++) {
        const xi = p[3 * i], yi = p[3 * i + 1], zi = p[3 * i + 2];
        let fx = 0, fy = 0, fz = 0;
        for (let j = i + 1; j < n; j++) {
          const dx = xi - p[3 * j], dy = yi - p[3 * j + 1], dz = zi - p[3 * j + 2], d2 = dx * dx + dy * dy + dz * dz, s = 0.0011 / (d2 > 1e-4 ? d2 : 1e-4);
          fx += dx * s; fy += dy * s; fz += dz * s; f[3 * j] -= dx * s; f[3 * j + 1] -= dy * s; f[3 * j + 2] -= dz * s;
        }
        f[3 * i] += fx; f[3 * i + 1] += fy; f[3 * i + 2] += fz;
      }
      for (let k = 0; k < E.length; k += 2) {
        const a = 3 * E[k], b = 3 * E[k + 1], dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4, s = (l - 0.1) * 0.06 / l;
        f[a] += dx * s; f[a + 1] += dy * s; f[a + 2] += dz * s; f[b] -= dx * s; f[b + 1] -= dy * s; f[b + 2] -= dz * s;
      }
      const T = 0.03 * (1 - it / IT) + 0.002;
      for (let i = 0; i < 3 * n; i += 3) {
        const fx = f[i] - p[i] * 0.012, fy = f[i + 1] - p[i + 1] * 0.012, fz = f[i + 2] - p[i + 2] * 0.012, l = Math.sqrt(fx * fx + fy * fy + fz * fz), s = l > T ? T / l : 1;
        p[i] += fx * s; p[i + 1] += fy * s; p[i + 2] += fz * s;
      }
    }
  }
  {
    // start from the table positions puffed up into a ball, so neighbours on the table stay near
    const p = new Float64Array(NN * 3);
    P0.forEach((q, i) => { p[3 * i] = q[0] * 0.5 + (rw() - 0.5) * 0.1; p[3 * i + 1] = (rw() - 0.5) * 0.5; p[3 * i + 2] = (q[2] + 0.06) * 1.6 + (rw() - 0.5) * 0.1; });
    relax(p, NN, Int32Array.from(EDGES.flat()), 120);
    const c = [0, 1, 2].map(k => { let m = 0; for (let i = 0; i < NN; i++) m += p[3 * i + k]; return m / NN; });
    const rad = Array.from({ length: NN }, (_, i) => Math.hypot(p[3 * i] - c[0], p[3 * i + 1] - c[1], p[3 * i + 2] - c[2])).sort((a, b) => a - b)[Math.floor(NN * 0.9)];
    for (let i = 0; i < NN; i++) P1.push([(p[3 * i] - c[0]) * 0.6 / rad, NETY + (p[3 * i + 1] - c[1]) * 0.6 / rad, (p[3 * i + 2] - c[2]) * 0.6 / rad]);
  }
  const deg = new Array(NN).fill(0);
  for (const [a, b] of EDGES) { deg[a]++; deg[b]++; }

  // wires as glowing ribbons that face the camera; they grow along their length, then straighten and lift;
  // the lifted network sways gently about its centre (ROT is the shared angle)
  const ROT = { value: 0 }, ROTY = `uniform float uRot;
vec3 rotY(vec3 p, float y0) { float c = cos(uRot), s = sin(uRot); p.y -= y0; return vec3(c * p.x + s * p.z, p.y + y0, c * p.z - s * p.x); }`;
  let nseg = 0;
  for (const w of wires) nseg += w.pts.length - 1;
  const wg = new THREE.BufferGeometry(), NV = nseg * 4;
  const A = { position: 3, aDir: 3, aS0: 3, aS1: 3, aD0: 3, aD1: 3, aM: 3, aUL: 3 }, arr = {};
  for (const k in A) arr[k] = new Float32Array(NV * A[k]);
  const index = [];
  let vi = 0;
  for (const w of wires) {
    const L = [0];
    for (let i = 1; i < w.pts.length; i++) L.push(L[i - 1] + Math.hypot(w.pts[i][0] - w.pts[i - 1][0], w.pts[i][1] - w.pts[i - 1][1]));
    const len = L[L.length - 1] || 1e-4, a0 = P0[w.a], b0 = P0[w.b], a1 = P1[w.a], b1 = P1[w.b];
    for (let i = 0; i < w.pts.length - 1; i++) {
      const p = w.pts[i], q = w.pts[i + 1], sl = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const dir = [(q[0] - p[0]) / sl, 0, (q[1] - p[1]) / sl];
      for (const [pt, u, end] of [[p, L[i] / len, -1], [q, L[i + 1] / len, 1]]) for (const side of [-1, 1]) {
        arr.position.set([pt[0], WY, pt[1]], 3 * vi); arr.aDir.set(dir, 3 * vi);
        arr.aS0.set(K.v3.lerp(a0, b0, u), 3 * vi); arr.aS1.set(K.v3.lerp(a1, b1, u), 3 * vi);
        arr.aD0.set(K.v3.sub(b0, a0), 3 * vi); arr.aD1.set(K.v3.sub(b1, a1), 3 * vi);
        arr.aM.set([w.w0, side, end], 3 * vi); arr.aUL.set([u, len, w.bus ? 2 : 1], 3 * vi);
        vi++;
      }
      const v0 = vi - 4;
      index.push(v0, v0 + 1, v0 + 3, v0, v0 + 3, v0 + 2);
    }
  }
  for (const k in A) wg.setAttribute(k, new THREE.BufferAttribute(arr[k], A[k]));
  wg.setIndex(index);
  const wireMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uWire: { value: 0 }, uStr: { value: 0 }, uLift: { value: 0 }, uW: { value: 0.0026 }, uC: { value: new THREE.Color(...K.rgb('#46d9ff')) }, uRot: ROT },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 aDir, aS0, aS1, aD0, aD1, aM, aUL;
uniform float uA, uWire, uStr, uLift, uW;
varying float vU, vSide, vGrow, vL, vA, vE0, vE1;
${ROTY}
void main() {
  vec3 D = rotY(mix(aD0, aD1, uLift), 0.0);
  vec3 pos = rotY(mix(position, mix(aS0, aS1, uLift), uStr), ${NETY.toFixed(4)});
  float dl = length(D);
  vec3 dir = normalize(mix(rotY(aDir, 0.0), dl > 1e-5 ? D / dl : aDir, uStr) + vec3(0.0, 1e-5, 0.0));
  vGrow = clamp((uWire - aM.x) / 0.14, 0.0, 1.0);
  // distance along the wire (or along the straight edge once straightened), plus a phase of its own,
  // so the pulses keep travelling and never flash on every wire at once
  vU = aUL.x; vSide = aM.y;
  // distance to either node along the straight edge, so an edge fades softly into its nodes
  vE0 = aUL.x * dl; vE1 = (1.0 - aUL.x) * dl;
  vL = aUL.x * mix(aUL.y, dl, uStr) + fract(sin(aM.x * 91.7) * 4375.85) * 0.25;
  vA = uA * step(0.0001, vGrow) * mix(1.0, 0.75, uStr);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec3 dv = normalize((modelViewMatrix * vec4(dir, 0.0)).xyz);
  vec3 sd = cross(dv, normalize(mv.xyz));
  float sl = length(sd);
  sd = sl > 1e-4 ? sd / sl : vec3(0.0, 1.0, 0.0);
  // end caps close the corners of the schematic; a straight edge needs none (they would overlap into beads)
  // width in local units (ws: the set's world scale), a little wider when seen from further than the wiring
  // cam so the schematic still reads from above the whole table; bus lines are wider on the table, but as
  // network edges only a little wider than the rest
  float ws = length(modelViewMatrix[0].xyz), far = clamp(-mv.z / (2.6 * ws), 1.0, 1.6);
  mv.xyz += (sd * aM.y + dv * aM.z * 0.5 * (1.0 - uStr)) * uW * ws * far * mix(aUL.z, min(aUL.z, 1.3), uStr) * (1.0 + 0.4 * uLift);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform float uTime, uStr; uniform vec3 uC;
varying float vU, vSide, vGrow, vL, vA, vE0, vE1;
void main() {
  if (vA < 0.004 || vU > vGrow + 0.0001) discard;
  float x = abs(vSide), a = exp(-x * x * 2.6);
  float tip = vGrow < 1.0 ? smoothstep(vGrow - 0.05, vGrow, vU) : 0.0;
  // a comet: a soft tail and a soft head
  float f = fract(vL * 4.0 - uTime * 0.5), pulse = smoothstep(0.84, 0.98, f) * (1.0 - smoothstep(0.98, 1.0, f));
  vec3 c = uC * (0.75 + 0.9 * pulse) + vec3(1.0) * (smoothstep(0.45, 0.0, x) * 0.45 + tip * 1.5);
  a *= mix(1.0, smoothstep(0.004, 0.02, min(vE0, vE1)), uStr);
  gl_FragColor = vec4(c, a * vA);
}`,
  });
  set.mats.push(wireMat);
  const wireMesh = new THREE.Mesh(wg, wireMat);
  wireMesh.frustumCulled = false; wireMesh.renderOrder = 4;
  set.group.add(wireMesh);
  // glowing dots: the network's nodes (hubs bigger) and junctions where taps land on a bus
  const KC = { chip: '#ffb43b', res: '#46d9ff', cap: '#ff5ad9', xtal: '#3ee08f' };
  const NP = NN + junctions.length, pg = K.pointsGeo(NP), pPos = pg.attributes.position.array, pA = pg.attributes.aA.array, pSize = pg.attributes.aSize.array, pCol = pg.attributes.aCol.array;
  for (let k = 0; k < NN; k++) { pCol.set(K.rgb(k < NH ? KC[nodes[k].kind] : '#e7eef8'), 3 * k); pSize[k] = k < NH ? 0.024 + 0.0012 * Math.min(deg[k], 10) : 0.042; }
  junctions.forEach((j, k) => { pPos.set([j.x, WY, j.z], 3 * (NN + k)); pCol.set(K.rgb('#bff2ff'), 3 * (NN + k)); pSize[NN + k] = 0.011; });
  const dots = new THREE.Points(pg, K.points(set, { uniforms: { uRot: ROT, uBig: { value: 0 } }, head: ROTY.replace('uniform float uRot;', 'uniform float uRot, uBig;'), vertex: `
  mv = modelViewMatrix * vec4(rotY(pos, ${NETY.toFixed(4)}), 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize * (1.0 + 0.45 * uBig), mv);
  vA *= 0.82 + 0.18 * sin(uTime * 2.3 + position.x * 37.0 + position.z * 23.0);` }));
  dots.frustumCulled = false; dots.renderOrder = 5;
  set.group.add(dots);
  let lastW = -1, lastN = -1, wLift = 0;
  function wireUpdate(wi, nn, t) {
    const str = K.prog(nn, 0.28, 0.6), lift = K.prog(nn, 0.45, 1);
    wLift = lift;
    ROT.value = lift * 0.45 * Math.sin(t * 0.2); dots.material.uniforms.uBig.value = lift;
    wireMat.uniforms.uWire.value = wi; wireMat.uniforms.uStr.value = str; wireMat.uniforms.uLift.value = lift;
    wireMesh.visible = wi > 0.001;
    if (Math.abs(wi - lastW) < 1e-6 && Math.abs(nn - lastN) < 1e-6) return;
    lastW = wi; lastN = nn;
    const grow = K.prog(nn, 0.08, 0.36);
    for (let k = 0; k < NN; k++) {
      pPos.set(K.v3.lerp(P0[k], P1[k], lift), 3 * k);
      pA[k] = k < NH ? grow : K.prog(nn, 0.3, 0.6) * K.prog(wi, 0.2, 0.5);
    }
    // junction dots go out before the wires start to straighten, so none is left floating on its own
    const jOut = 1 - K.prog(nn, 0.12, 0.28);
    junctions.forEach((j, k) => { pA[NN + k] = K.clamp((wi - wires[j.w].w0) / 0.14 - 0.9, 0, 0.1) * 10 * jOut; });
    pg.attributes.position.needsUpdate = true; pg.attributes.aA.needsUpdate = true;
  }
  // the middle of the bus lines on the table, gliding with the lift to the network's centre
  const wiresAt = () => K.v3.lerp([(BX0 + BX1) / 2, WY, (BUS[0] + BUS[3]) / 2], [0, NETY, 0], wLift);
  // ------------------------------------------------------- meshes, update --
  const insts = kindList.filter(k => KINDS[k].list.length).map(k => {
    const { geo, material, list } = KINDS[k], m = new THREE.InstancedMesh(geo, material, list.length);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    list.forEach((it, i) => m.setColorAt(i, it.c));
    set.group.add(m);
    return { m, list };
  });
  for (const s of solos) s.mesh.frustumCulled = false;
  const screenMesh = solo(P.crt, screenGeo, screenMat, mat([0, 0, FACE_Z - crtC[2]]));
  // depth prepass for fading the computer, shut or taken apart: opaque, so it draws before every transparent
  // part; it shares the matrices of the case halves, the tube and the screen, and sits a hair behind them so
  // their own faces pass
  const preMat = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  const prepass = [[P.rear, shell[0]], [P.bezel, shell[1]], [P.crt, crtMesh], [P.crt, screenMesh]].map(([pi, s]) => {
    const m = new THREE.Mesh(s.geometry, preMat);
    m.matrixAutoUpdate = false; m.matrix = s.matrix; m.frustumCulled = false; m.visible = false;
    set.group.add(m);
    return { pi, m };
  });
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _ax = new THREE.Vector3(), _m = new THREE.Matrix4();
  parts.forEach((p, i) => { p.r = K.rng(500 + i)(); p.lpV = V(...p.lp); p.hpV = V(...p.hp); p.e = p.s = NaN; });
  const nodeOf = new Map(nodes.map((n, k) => [n.pi, k]));
  // soft contact shadows, one per part: a blurred rounded rectangle on the table under its footprint
  // (lerped from where the part stands in the computer to where it lies), fainter while it flies
  const NS = parts.length, shGeo = new THREE.PlaneGeometry(2, 2).rotateX(-PI / 2);
  const shH = new Float32Array(NS * 4);
  shGeo.setAttribute('aH', new THREE.InstancedBufferAttribute(shH, 4).setUsage(THREE.DynamicDrawUsage));
  const shMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 1 } },
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    vertexShader: `attribute vec4 aH; varying vec2 vL; varying vec4 vH;
void main() {
  vH = aH; vL = position.xz * (aH.xy + abs(aH.z));
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  if (aH.w < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `uniform float uA, uK; varying vec2 vL; varying vec4 vH;
void main() {
  // a negative blur marks a round part
  float b = abs(vH.z), r = vH.z < 0.0 ? min(vH.x, vH.y) : min(min(vH.x, vH.y) * 0.6, 0.012);
  vec2 q = abs(vL) - vH.xy + r;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  float a = vH.w * (1.0 - smoothstep(-b * 0.6, b, d));
  if (a < 0.003) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * uA * uK);
}`,
  });
  set.mats.push(shMat);
  const shadows = new THREE.InstancedMesh(shGeo, shMat, NS);
  shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shadows.frustumCulled = false; shadows.renderOrder = -1;
  set.group.add(shadows);
  const ROUND = new Set(['washer', 'feet', 'disc']);
  parts.forEach((p, i) => {
    const bh = aabb(i, p.hq), bl = layBox(i, p.lq), h = bl.max.y - bl.min.y;
    p.sh = {
      hx: p.hp[0] + (bh.min.x + bh.max.x) / 2, hz: p.hp[2] + (bh.min.z + bh.max.z) / 2, hw: (bh.max.x - bh.min.x) / 2, hd: (bh.max.z - bh.min.z) / 2,
      lw: (bl.max.x - bl.min.x) / 2, ld: (bl.max.z - bl.min.z) / 2,
      ground: !p.inner && p.hp[1] + bh.min.y < FLOOR + 0.03, blur: Math.min(0.035, 0.004 + 0.3 * h),
      // cables are too thin and open for a box of shadow
      a: p.grp === 'cable' ? 0 : 0.3 + 0.32 * Math.min(1, h / 0.04), round: ROUND.has(p.grp) || i === P.speaker || i === P.mball,
    };
  });
  const _sm = new THREE.Matrix4();
  function shadowAt(p, i, s) {
    // high in the air a shadow is faint and soft
    const S = p.sh, e = p.e, up = 4 * e * (1 - e), hw = K.lerp(S.hw, S.lw, e) * s, hd = K.lerp(S.hd, S.ld, e) * s, bl = S.blur + 0.03 * up;
    const a = K.lerp(S.ground ? S.a : 0, S.a, e) * (1 - 0.85 * up) * Math.min(1, s * 1.5);
    shH[4 * i] = hw; shH[4 * i + 1] = hd; shH[4 * i + 2] = S.round ? -bl : bl; shH[4 * i + 3] = a;
    _sm.makeScale(hw + bl, 1, hd + bl).setPosition(K.lerp(S.hx, p.at[0], e), FLOOR + 0.0002, K.lerp(S.hz, p.at[1], e));
    shadows.setMatrixAt(i, _sm);
  }
  // a part's pose for explode ex and network nn; it depends only on (e, s), so a part whose pair has not
  // changed keeps its matrix (p.moved false) and its instances are not uploaded again
  function pose(p, i, ex, nn) {
    const e = K.smooth(K.clamp((ex - p.d) / p.w, 0, 1));
    let s = p.inner && ex < 0.012 ? 0 : 1;
    // in the network look, wired parts shrink into their nodes; the rest shrink away, from the edges inwards
    if (nodeOf.has(i)) s *= 1 - K.prog(nn, 0.06, 0.36);
    else s *= 1 - K.prog(nn, 0.02 + 0.14 * p.r, 0.2 + 0.14 * p.r);
    p.moved = e !== p.e || s !== p.s;
    if (!p.moved) return;
    _p.lerpVectors(p.hpV, p.lpV, e); _p.y += p.arc * 4 * e * (1 - e);
    _q.copy(p.hq).slerp(p.lq, e);
    if (p.spin) _q.multiply(_q2.setFromAxisAngle(_ax.set(p.axis[0], p.axis[1], p.axis[2]), e * p.spin * 2 * PI));
    p.m.compose(_p, _q, _s.set(s, s, s));
    p.e = e; p.s = s;
    shadowAt(p, i, s);
  }
  let lastEx = -1, lastNn = -1;
  function layout(ex, nn) {
    if (Math.abs(ex - lastEx) < 1e-6 && Math.abs(nn - lastNn) < 1e-6) return;
    lastEx = ex; lastNn = nn;
    let any = false;
    parts.forEach((p, i) => { pose(p, i, ex, nn); any = any || p.moved; });
    if (!any) return;
    for (const { m, list } of insts) {
      let dirty = false;
      for (let i = 0; i < list.length; i++) if (parts[list[i].pi].moved) { m.setMatrixAt(i, _m.multiplyMatrices(parts[list[i].pi].m, list[i].m)); dirty = true; }
      if (dirty) m.instanceMatrix.needsUpdate = true;
    }
    for (const s of solos) {
      if (!parts[s.pi].moved) continue;
      if (s.local) s.mesh.matrix.multiplyMatrices(parts[s.pi].m, s.local); else s.mesh.matrix.copy(parts[s.pi].m);
      s.mesh.matrixWorldNeedsUpdate = true;
    }
    for (const c of coils) c.mesh.morphTargetInfluences[0] = K.smooth(K.clamp(parts[c.pi].e * 1.3 - 0.15, 0, 1));
    shadows.instanceMatrix.needsUpdate = true; shGeo.attributes.aH.needsUpdate = true;
    // parts shrunk to nothing (inside the shut case, or gone into the network) cost no draw calls
    let shown = false;
    for (const { m, list } of insts) { m.visible = list.some(it => parts[it.pi].s > 0); shown = shown || m.visible; }
    for (const s of solos) { s.mesh.visible = parts[s.pi].s > 0; shown = shown || s.mesh.visible; }
    shadows.visible = shown;
  }
  layout(0, 0);
  const tableCol = new THREE.Color(TABLE);
  function update(S, t) {
    // the wiring is drawn over the parts lying on the table (once lifted into a network it needs no table)
    // the parts are back on the table before the network lets go of them (in the story mac_net rises only
    // once mac_explode is 1, so this matters only for jumps in explore, e.g. from Network to Computer)
    const nn = K.clamp(S.mac_net, 0, 1), ex = Math.max(K.clamp(S.mac_explode, 0, 1), K.prog(nn, 0, 0.3));
    const wi = K.clamp(S.mac_wire, 0, 1) * Math.max(K.prog(ex, 0.75, 1), K.prog(nn, 0.28, 0.6));
    layout(ex, nn);
    // while the set fades (computer shut or taken apart), a depth-only copy of the case, the tube and the
    // screen is drawn first, so they fade evenly instead of showing inner walls, rims and screws through them
    const pre = nn < 0.06 && set.uA.value < 0.97;
    for (const { pi, m } of prepass) { m.visible = pre && parts[pi].s > 0; m.matrixWorldNeedsUpdate = true; }
    screenMat.uniforms.uOff.value = K.prog(ex, 0.005, 0.11);
    spill.visible = ex < 0.06 && parts[P.bezel].s > 0;
    // seen from above the lay is lit full on, so it is toned down a little; the lights go down while the wiring glows
    const dim = (1 - 0.14 * K.prog(ex, 0.3, 1)) * (1 - 0.55 * K.prog(wi, 0, 0.35));
    for (const m of LIT) m.color.setScalar(dim);
    const tm = table.material;
    tm.color.copy(tableCol).multiplyScalar(1 - 0.72 * K.prog(wi, 0, 0.35));
    tm.opacity = tm.userData.base * set.uA.value * K.prog(ex, 0, 0.3) * (1 - K.prog(nn, 0.25, 0.55));
    tm.depthWrite = tm.opacity > 0.97;
    table.visible = tm.opacity > 0.003;
    wireUpdate(wi, nn, t);
  }
  // ----------------------------------------------------------- exports --
  const meanOf = list => () => {
    let x = 0, y = 0, z = 0;
    for (const pi of list) { const e = parts[pi].m.elements; x += e[12]; y += e[13]; z += e[14]; }
    return [x / list.length, y / list.length + 0.008, z / list.length];
  };
  const resList = grp('res'), keyList = keys.map(k => k.pi);
  // in front of the glass; as the tube flies and lies face down, it moves up to the middle of the tube
  const screenAt = () => {
    const p = parts[P.crt], v = V(0, 0, FACE_Z - crtC[2] + 0.012).applyMatrix4(p.m), c = V().setFromMatrixPosition(p.m);
    c.y += 0.1; v.lerp(c, p.e || 0);
    return [v.x, v.y, v.z];
  };
  const VIEWS = { computer: [0, 0, 0], apart: [1, 0, 0], wiring: [1, 1, 0], network: [1, 1, 1] };
  const fadeLabel = S => K.prog(S.mac_explode, 0.82, 1) * (1 - K.prog(S.mac_wire, 0.05, 0.3));
  return Object.assign(set, {
    params: { mac_a: 1, mac_explode: 0, mac_wire: 0, mac_net: 0 },
    update,
    anchors: {
      screen: screenAt, board: meanOf([P.logic]), chips: meanOf(chipsBy.slice(0, 8)), resistors: meanOf(resList),
      screws: meanOf(scr.slice(5)), keys: meanOf(keyList), wires: () => wiresAt(),
      computer: [0, midY, (CZ + BACK) / 2], crt: meanOf([P.crt]), keyboard: meanOf([P.kb]), mouse: meanOf([P.mouse]),
      table: [0, FLOOR, 0], network: [0, NETY, 0],
    },
    // for the story text: what the computer is made of in this model
    counts: { parts: parts.length, screws: screws.length, resistors: resList.length, chips: chipsBy.length, keys: keys.length, wires: wires.length, nodes: NN, links: EDGES.length },
    labels: [
      { text: ['Screws', `${screws.length} of them`], at: 'screws', cls: '', alpha: fadeLabel },
      { text: ['Resistors', `${resList.length}, by value`], at: 'resistors', cls: 'cyn', alpha: fadeLabel },
      { text: ['Chips', 'transistors inside'], at: 'chips', cls: 'amb', alpha: S => K.prog(S.mac_explode, 0.82, 1) * (1 - K.prog(S.mac_net, 0, 0.25)) },
      { text: ['Keys', `${keys.length} caps`], at: 'keys', cls: 'grn', alpha: fadeLabel },
    ],
    cam: {
      default: [32, 13, 2.25, 0.06, -0.09, 0.06], computer: [32, 13, 2.25, 0.06, -0.09, 0.06],
      table: [8, 55, 3.45, 0, -0.32, 0.02], apart: [8, 55, 3.45, 0, -0.32, 0.02],
      wiring: [2, 60, 2.6, 0.17, -0.3, -0.06], network: [18, 20, 2.4, 0, NETY, 0], screen: [12, 6, 1.0, 0, SCR_Y, CZ],
    },
    controls: [{ key: 'view', label: 'View', options: [['computer', 'Computer'], ['apart', 'Taken apart'], ['wiring', 'Wiring'], ['network', 'Network']] }],
    explore(c) { const v = VIEWS[c.view] || VIEWS.computer; return { mac_explode: v[0], mac_wire: v[1], mac_net: v[2] }; },
  });
};

// web: networks are everywhere (slides 6-7). Two looks in one set:
// 1. the internet: a glowing, tree-like network grown from a few giant hubs (after the Opte Project maps),
// 2. a dark globe of city lights joined by friendship ties (after Paul Butler's Facebook map, December 2010);
//    the bright lights sit at the 3,214 airports of the airports story; the faint lights and the ties are illustrative.
SETS.web = function (K) {
  const { THREE } = K, V = K.v3, TAU = Math.PI * 2, D2R = Math.PI / 180;
  const set = K.newSet('web');
  const live = { spin: 0, scale: 1 };   // the globe's turn and size as last drawn, for the anchors and labels
  // GLSL: 0 where a sphere of radius r (model units) round the model's origin hides p from the camera, else 1.
  // The globe hides its far side with this rather than with depth alone, so it stays hidden at any fade.
  // Soft at the horizon; nothing is hidden while the camera is inside the sphere.
  const HORIZON = `
float horizon(vec3 p, float r) {
  vec3 w = (modelMatrix * vec4(p, 1.0)).xyz, c = modelMatrix[3].xyz, d = w - cameraPosition;
  float R = r * length(modelMatrix[0].xyz), s = clamp(dot(c - cameraPosition, d) / max(dot(d, d), 1e-8), 0.0, 1.0);
  return max(smoothstep(R * 0.985, R, length(cameraPosition + d * s - c)), step(length(cameraPosition - c), R));
}`;

  // ================================================================ the internet
  // A seeded branching process in which every branch carries a share of the nodes still to place (its mass).
  // Hubs split their mass over many spokes, heavy-tailed: most spokes end in a few leaves close by (the starburst),
  // a few carry hundreds of nodes far out. Each branch hops out (further the more it carries; big ones sometimes as
  // a long, gently curving filament bent by a smooth flow field, so neighbours curve together) and splits again into
  // forks, stars, dandelion tufts and brushes of leaves. Colour follows how much of the tree hangs below a node.
  const NET = (() => {
    const r = K.rng(1969), MAX = 17000;
    const P = new Float32Array(MAX * 3), par = new Int32Array(MAX).fill(-1);
    const hue = new Float32Array(MAX), boost = new Float32Array(MAX);
    const E = [];   // node pairs; tree edges [parent, child], then backbone ends and cross links
    let n = 0, cross0 = 0;
    const at = i => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
    function add3(x, y, z, from, h) {
      if (n >= MAX) return -1;
      P[3 * n] = x; P[3 * n + 1] = y; P[3 * n + 2] = z;
      par[n] = from; hue[n] = h;
      if (from >= 0) E.push(from, n);
      return n++;
    }
    const add = (p, from, h) => add3(p[0], p[1], p[2], from, h);
    const norm = (x, y, z) => { const l = Math.sqrt(x * x + y * y + z * z) || 1; return [x / l, y / l, z / l]; };
    // an irregular, lobed envelope keeps it inside radius ~1.1 without a hard spherical crust
    const lobes = new Float32Array(36);   // 9 x [direction, strength]
    for (let i = 0; i < 9; i++) { lobes.set(K.unit(r), 4 * i); lobes[4 * i + 3] = 0.08 + 0.24 * r(); }
    function inside(x, y, z) {
      const l = Math.sqrt(x * x + y * y + z * z) || 1e-6;
      let R = 0.74;
      for (let i = 0; i < 36; i += 4) {
        const c = (x * lobes[i] + y * lobes[i + 1] + z * lobes[i + 2]) / l;
        if (c > 0) R += lobes[i + 3] * c * c * c;
      }
      return Math.sqrt(x * x + y * y / 0.6724 + z * z / 0.81) < Math.min(R, 1.06);
    }
    const flow = p => [Math.sin(3.1 * p[1] + 2.3 * p[2] + 1.3), Math.sin(2.7 * p[2] + 1.7 * p[0] + 2.1),
      Math.sin(2.9 * p[0] + 2.2 * p[1] + 0.7)];
    const steer = (d, p, k, j) => {
      const f = flow(p);
      return norm(d[0] + k * f[0] + j * K.gauss(r), d[1] + k * f[1] + j * K.gauss(r), d[2] + k * f[2] + j * K.gauss(r));
    };
    // a direction at angle a from the unit vector d (random azimuth)
    function turn(d, a) {
      // u, w: two unit vectors at right angles to d
      const up = Math.abs(d[1]) < 0.9, ux0 = up ? -d[2] : 0, uy0 = up ? 0 : d[2], uz0 = up ? d[0] : -d[1];
      const ul = Math.sqrt(ux0 * ux0 + uy0 * uy0 + uz0 * uz0) || 1, ux = ux0 / ul, uy = uy0 / ul, uz = uz0 / ul;
      const wx = d[1] * uz - d[2] * uy, wy = d[2] * ux - d[0] * uz, wz = d[0] * uy - d[1] * ux;
      const f = r() * TAU, c = Math.cos(a), s = Math.sin(a), cf = Math.cos(f) * s, sf = Math.sin(f) * s;
      return norm(d[0] * c + ux * cf + wx * sf, d[1] * c + uy * cf + wy * sf, d[2] * c + uz * cf + wz * sf);
    }
    // a point len along d from p, shortened at the edge of the envelope (null if even a short hop leaves it)
    function reach(p, d, len) {
      for (let s = len; s > 0.12 * len; s *= 0.72) {
        const x = p[0] + d[0] * s, y = p[1] + d[1] * s, z = p[2] + d[2] * s;
        if (inside(x, y, z)) return [x, y, z];
      }
      return null;
    }
    // split m over k children, heavy-tailed (a few take most)
    function share(m, k, ex) {
      const w = [];
      let sum = 0;
      for (let i = 0; i < k; i++) { const x = Math.pow(r(), ex) + 0.002; w.push(x); sum += x; }
      const out = w.map(x => Math.floor(m * x / sum));
      let left = m - out.reduce((a, b) => a + b, 0);
      for (let i = 0; left > 0; i = (i + 1) % k, left--) out[i]++;
      return out.filter(x => x > 0);
    }
    // the hop length for a branch carrying m nodes
    const hop = m => (0.012 + 0.034 * Math.pow(m, 0.42)) * (0.6 + 0.8 * r());
    const Q = [];
    const grow = (from, d, m, h) => Q.push([from, d, m, h]);
    // m leaves round node 'from', within 'spread' radians of d, l0..l1 long
    function fan(from, d, h, m, spread, l0, l1) {
      const p = at(from);
      for (let k = 0; k < m; k++) {
        const u = turn(d, spread * Math.sqrt(r())), l = l0 + (l1 - l0) * r();
        const x = p[0] + u[0] * l, y = p[1] + u[1] * l, z = p[2] + u[2] * l;
        if (inside(x, y, z)) add3(x, y, z, from, h);
      }
    }
    // the hubs: two giants, four big ones and four smaller ones [x, y, z, mass, spokes]
    const HUBS = [
      [0.36, -0.02, 0.1, 5000, 270], [-0.46, 0.16, -0.08, 3600, 200], [-0.1, -0.44, 0.4, 1400, 74],
      [0.12, 0.46, -0.4, 1300, 66], [-0.34, -0.3, -0.48, 1000, 52], [0.66, 0.32, -0.26, 900, 46],
      [0.04, 0.3, 0.6, 800, 42], [0.5, -0.4, -0.42, 750, 38], [-0.8, -0.06, 0.3, 700, 36], [-0.14, 0.58, 0.12, 650, 32]];
    const hub = HUBS.map(([x, y, z]) => add3(x, y, z, -1, 0));
    hub.forEach(i => { boost[i] = 1; });
    // backbone between hubs: bundles of gently bowed strands [hub, hub, strands]
    const BACK = [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 3, 1], [1, 4, 1], [0, 5, 1], [6, 0, 1], [7, 0, 1], [8, 1, 1], [9, 1, 1]];
    for (const [a, b, m] of BACK) {
      const A = at(hub[a]), B = at(hub[b]), dir = V.norm(V.sub(B, A)), L = V.dist(A, B), steps = Math.max(3, Math.round(L / 0.09));
      for (let s = 0; s < m; s++) {
        const bow = V.mul(turn(dir, Math.PI / 2), (0.03 + 0.12 * r()) * L), h = (r() - 0.5) * 0.2;
        let last = hub[a];
        for (let k = 1; k < steps; k++) {
          const f = k / steps, q = V.add(V.lerp(A, B, f), V.mul(bow, Math.sin(Math.PI * f)));
          last = add3(q[0] + 0.008 * K.gauss(r), q[1] + 0.008 * K.gauss(r), q[2] + 0.008 * K.gauss(r), last, h);
          boost[last] = 0.5;
          if (r() < 0.3) grow(last, turn(dir, 1.1 + 0.5 * r()), 4 + Math.floor(Math.pow(r(), 3) * 60), h);
        }
        E.push(last, hub[b]);
      }
    }
    // spokes from every hub, mostly outwards; each hub's region has its own tint (the first giant burns yellow-white)
    const TINT = [0.12, 0.03, -0.05, -0.08, -0.1, -0.03, -0.1, -0.06, -0.12, -0.07];
    HUBS.forEach(([x, y, z, mass, k], hi) => {
      const out = V.norm([x, y, z]), o = 0.25 + 0.1 * hi;
      for (const m of share(mass, k, 3.2)) {
        const u = K.unit(r);
        grow(hub[hi], norm(u[0] + out[0] * o, u[1] + out[1] * o, u[2] + out[2] * o), m, TINT[hi] + (r() - 0.5) * 0.26);
      }
    });
    let tuftAt = -1, tuftN = 0;
    for (let qi = 0; qi < Q.length && n < MAX; qi++) {
      const [from, d0, m0, h] = Q[qi];
      let p = at(from), d = d0, last = from, m = m0;
      // the hop: one straight link, or for big branches now and then a long curving filament of several nodes
      const fil = m > 14 && r() < 0.4 ? 2 + Math.floor(r() * 5) : 1, sl = hop(m) * (fil > 1 ? 1.8 : 1) / fil;
      for (let s = 0; s < fil && m > 0; s++) {
        if (fil > 1) d = steer(d, p, 0.3, 0.08);
        let q = reach(p, d, sl);
        if (!q) {   // bend back in at the edge
          const o = norm(p[0], p[1], p[2]);
          d = norm(d[0] - 1.3 * o[0], d[1] - 1.3 * o[1], d[2] - 1.3 * o[2]);
          q = reach(p, d, sl);
        }
        if (!q) break;
        const j = add(q, last, h);
        if (j < 0) break;
        last = j; p = q; m--;
        // side branches along a filament (feathers)
        if (s < fil - 1 && m > 8 && r() < 0.6) {
          const k = Math.min(m - 4, 1 + Math.floor(r() * r() * m * 0.3));
          grow(last, turn(d, 0.9 + 0.5 * r()), k, h + (r() - 0.5) * 0.05);
          m -= k;
        }
      }
      if (last === from || m <= 0) continue;
      if (m <= 8) fan(last, d, h, m, 1.25, 0.008, 0.026);   // a brush of leaves
      else if (m < 110 && r() < 0.15) {
        // a dandelion: a tight ball of short spokes
        const c = at(last);
        for (let k = 0; k < m; k++) {
          const u = K.unit(r), v = norm(u[0] + 0.3 * d[0], u[1] + 0.3 * d[1], u[2] + 0.3 * d[2]), l = 0.012 + 0.03 * Math.sqrt(r());
          const x = c[0] + v[0] * l, y = c[1] + v[1] * l, z = c[2] + v[2] * l;
          if (inside(x, y, z)) add3(x, y, z, last, h + 0.04);
        }
        if (m > tuftN) { tuftN = m; tuftAt = last; }
      } else {
        // a fork or, now and then, a star
        const k = Math.min(m, 2 + Math.floor(Math.pow(r(), 3) * 18)), spread = 0.22 + 0.035 * k;
        for (const mi of share(m, k, 2.2)) grow(last, turn(d, spread * Math.sqrt(r())), mi, h + (r() - 0.5) * 0.05);
        if (k > 9) boost[last] = 0.6;
      }
    }
    // a few long cross links between routers in different branches (the internet is not quite a tree)
    cross0 = E.length / 2;
    for (let k = 0, tries = 0; k < 420 && tries < 20000; tries++) {
      const a = Math.floor(r() * n), b = Math.floor(r() * n);
      if (a === b || par[a] < 0 || par[b] < 0) continue;
      const L = V.dist(at(a), at(b));
      if (L < 0.18 || L > 0.95) continue;
      E.push(a, b); k++;
    }
    // how much hangs below each node (children are always created after their parent)
    const w = new Float32Array(n).fill(1);
    for (let i = n - 1; i >= 0; i--) if (par[i] >= 0) w[par[i]] += w[i];
    // growth time: distance from the node's hub along the tree (parents always come first; the giant starts first)
    const tau = new Float32Array(n);
    let tmax = 0;
    hub.forEach((i, k) => { tau[i] = k * 0.05; });
    for (let i = 0; i < n; i++) {
      const j = par[i];
      if (j >= 0) {
        const dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2];
        tau[i] = tau[j] + Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      if (tau[i] > tmax) tmax = tau[i];
    }
    return { n, P, E, cross0, par, hue, boost, w, tau, tmax, hub, tuftAt, at };
  })();

  // --------------------------------------------------------- internet: drawing
  const HOT = [[0, K.rgb('#6e0d06')], [0.14, K.rgb('#b8170a')], [0.32, K.rgb('#ff3812')], [0.52, K.rgb('#ff7a18')],
    [0.72, K.rgb('#ffbf35')], [0.88, K.rgb('#fff09a')], [1, [1, 1, 0.94]]];
  const LUT = new Float32Array(256 * 3);   // the colour ramp, tabulated
  for (let k = 0; k < 256; k++) LUT.set(K.ramp(HOT, k / 255), 3 * k);
  const hot = (out, o, x) => {
    const k = 3 * Math.round(K.clamp(x, 0, 1) * 255);
    out[o] = LUT[k]; out[o + 1] = LUT[k + 1]; out[o + 2] = LUT[k + 2];
  };
  const N = NET.n, NP = NET.P, netX = new Float32Array(N), netW = new Float32Array(N);   // 0 leaf .. 1 hub
  for (let i = 0; i < N; i++) {
    netW[i] = K.clamp(Math.log(NET.w[i]) / Math.log(1800), 0, 1);
    netX[i] = Math.max(NET.boost[i], K.clamp(netW[i] + NET.hue[i], 0, 1));
  }
  // growth time 0..1: part distance, part rank (so the amount on show grows evenly with web_net); rank by counting sort
  const netT = new Float32Array(N), bins = new Int32Array(4097), tq = 4095 / NET.tmax;
  for (let i = 0; i < N; i++) bins[1 + Math.floor(NET.tau[i] * tq)]++;
  for (let k = 1; k <= 4096; k++) bins[k] += bins[k - 1];
  for (let i = 0; i < N; i++) netT[i] = 0.4 * NET.tau[i] / NET.tmax + 0.6 * bins[Math.floor(NET.tau[i] * tq)] / N;
  // growth front; fade as the globe comes in; the globe's radius and how much of the network it hides
  const netU = { uF: { value: 1.06 }, uN: { value: 1 }, uR: { value: 0.1 }, uH: { value: 0 } };
  const ng = K.pointsGeo(N);
  {
    const rr = K.rng(5), col = ng.attributes.aCol.array, sz = ng.attributes.aSize.array, al = ng.attributes.aA.array;
    ng.attributes.position.array.set(NP.subarray(0, 3 * N));
    for (let i = 0; i < N; i++) {
      hot(col, 3 * i, netX[i] + (rr() - 0.5) * 0.06);
      sz[i] = 0.011 + 0.02 * Math.pow(netW[i], 2.6);
      al[i] = 0.6 + 0.35 * netX[i];
    }
    const HS = [0.13, 0.11, 0.05, 0.045, 0.04, 0.04, 0.035, 0.035, 0.03, 0.03];
    NET.hub.forEach((i, k) => { sz[i] = HS[k]; if (k < 2) col.set([1, 0.98, 0.9], 3 * i); else hot(col, 3 * i, 0.84); });
    ng.setAttribute('aT', new THREE.BufferAttribute(netT, 1));
  }
  const netPts = new THREE.Points(ng, K.points(set, {
    uniforms: netU, head: 'attribute float aT; uniform float uF, uN, uR, uH;' + HORIZON,
    vertex: `float on = step(aT, uF), fl = (1.0 - smoothstep(0.0, 0.06, uF - aT)) * on;
  vA *= on * uN; gl_PointSize *= 1.0 + 1.6 * fl; vC = mix(vC, vec3(1.0, 0.96, 0.85), fl * 0.8);
  if (uH > 0.001) vA *= 1.0 - uH * (1.0 - horizon(pos, uR));`,
  }));
  // links grow out from the end that is reached first; trunks carry slow pulses of traffic.
  // A cross link has the same time at both ends: it fades in whole once both of its routers are there.
  const NE = NET.E.length / 2, lg = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(NE * 6), oth = new Float32Array(NE * 6), col = new Float32Array(NE * 6);
    const al = new Float32Array(NE * 2), tt = new Float32Array(NE * 2), to = new Float32Array(NE * 2);
    const dd = new Float32Array(NE * 2), pu = new Float32Array(NE * 2);
    for (let k = 0; k < NE; k++) {
      const a = NET.E[2 * k], b = NET.E[2 * k + 1], cross = k >= NET.cross0, x = cross ? 0.4 * (netX[a] + netX[b]) : netX[b];
      for (let j = 0; j < 3; j++) { pos[6 * k + j] = oth[6 * k + 3 + j] = NP[3 * a + j]; pos[6 * k + 3 + j] = oth[6 * k + j] = NP[3 * b + j]; }
      hot(col, 6 * k, x); hot(col, 6 * k + 3, x);
      al[2 * k] = al[2 * k + 1] = cross ? 0.14 : 0.45 + 0.45 * x;
      if (cross) tt[2 * k] = tt[2 * k + 1] = to[2 * k] = to[2 * k + 1] = Math.max(netT[a], netT[b]);
      else { tt[2 * k] = netT[a]; tt[2 * k + 1] = netT[b]; to[2 * k] = netT[b]; to[2 * k + 1] = netT[a]; }
      dd[2 * k] = NET.tau[a]; dd[2 * k + 1] = NET.tau[b];
      pu[2 * k] = pu[2 * k + 1] = cross ? 0 : K.clamp((x - 0.42) / 0.4, 0, 1);
    }
    lg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); lg.setAttribute('aO', new THREE.BufferAttribute(oth, 3));
    lg.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); lg.setAttribute('aA', new THREE.BufferAttribute(al, 1));
    lg.setAttribute('aT', new THREE.BufferAttribute(tt, 1)); lg.setAttribute('aTO', new THREE.BufferAttribute(to, 1));
    lg.setAttribute('aD', new THREE.BufferAttribute(dd, 1)); lg.setAttribute('aP', new THREE.BufferAttribute(pu, 1));
  }
  const netLineMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, netU),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aCol, aO; attribute float aA, aT, aTO, aD, aP;
uniform float uA, uF, uN, uR, uH;
varying vec3 vC; varying float vA, vD, vP;
${HORIZON}
void main() {
  float t0 = min(aT, aTO), t1 = max(aT, aTO), far = step(aTO, aT - 1e-6), whole = 1.0 - step(1e-6, t1 - t0);
  float f = clamp((uF - t0) / max(t1 - t0, 1e-4), 0.0, 1.0), tip = far * (1.0 - smoothstep(0.0, 0.05, uF - t1));
  vec3 pos = mix(position, mix(aO, position, f), far);
  vC = mix(aCol, vec3(1.0, 0.95, 0.8), tip * 0.7);
  vA = aA * uA * uN * step(t0, uF) * (1.0 + tip) * mix(1.0, smoothstep(t0, t0 + 0.03, uF), whole);
  if (uH > 0.001) vA *= 1.0 - uH * (1.0 - horizon(pos, uR));
  vD = aD; vP = aP;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`,
    fragmentShader: `
uniform float uTime;
varying vec3 vC; varying float vA, vD, vP;
void main() {
  if (vA < 0.004) discard;
  float pu = smoothstep(0.93, 1.0, fract(vD * 3.0 - uTime * 0.22)) * vP;
  gl_FragColor = vec4(vC + vec3(0.9, 0.75, 0.45) * pu, vA * (1.0 + 1.5 * pu));
}`,
  });
  set.mats.push(netLineMat);
  const netLines = new THREE.LineSegments(lg, netLineMat);
  const netGroup = new THREE.Group();
  netGroup.add(netLines, netPts);
  set.group.add(netGroup);

  // ================================================================ the globe
  const L0 = -12;   // the longitude that faces +z (the default camera) at spin 0
  const AIR = (s => {
    const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', v = k => AL.indexOf(s[k]) * 64 + AL.indexOf(s[k + 1]);
    const n = s.length / 4, lat = new Float32Array(n), lon = new Float32Array(n);
    for (let i = 0; i < n; i++) { lat[i] = (v(4 * i) - 900) / 10; lon[i] = (v(4 * i + 2) - 1800) / 10; }
    return { n, lat, lon };
  })(airports());
  const ll = (lat, lon) => {
    const a = lat * D2R, b = (lon - L0) * D2R;
    return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
  };
  const NC = AIR.n, U3 = new Float32Array(NC * 3);
  for (let i = 0; i < NC; i++) U3.set(ll(AIR.lat[i], AIR.lon[i]), 3 * i);
  // airports are sorted by number of routes: rank -> routes, by interpolating a few quantiles of the data
  const QR = [[0, 248], [3, 233], [10, 185], [20, 153], [40, 127], [70, 94], [100, 79], [150, 58], [200, 47], [300, 33], [450, 20],
    [600, 13], [800, 9], [1000, 6], [1300, 4], [1600, 3], [2000, 2], [2800, 1], [3213, 1]];
  const size = new Float32Array(NC);
  for (let i = 0, q = 1; i < NC; i++) {
    while (QR[q][0] < i) q++;
    const [r0, d0] = QR[q - 1], [r1, d1] = QR[q];
    size[i] = d0 + (d1 - d0) * (i - r0) / (r1 - r0);
  }
  // ties: everyone knows their nearest neighbours; bigger cities have more and longer ties; a few big pairs far apart
  // (kept in flat arrays: ends ta, tb, kind tk 0 local / 1 regional / 2 long, angle th in radians)
  const TIES = (() => {
    const r = K.rng(2010), CAP = 16000, ta = new Int32Array(CAP), tb = new Int32Array(CAP), tk = new Uint8Array(CAP), th = new Float32Array(CAP);
    let n = 0;
    const dot = (a, b) => U3[3 * a] * U3[3 * b] + U3[3 * a + 1] * U3[3 * b + 1] + U3[3 * a + 2] * U3[3 * b + 2];
    // the pairs already tied, in an open-addressing hash (key a * 4096 + b + 1 with a < b; 0 is empty)
    const HS = 1 << 15, hk = new Int32Array(HS);
    const tie = (a, b, kind) => {
      if (a === b || n >= CAP) return false;
      const key = (a < b ? a * 4096 + b : b * 4096 + a) + 1;
      let h = Math.imul(key, 0x9E3779B1) >>> 17;
      while (hk[h] !== 0) { if (hk[h] === key) return false; h = (h + 1) & (HS - 1); }
      hk[h] = key; ta[n] = a; tb[n] = b; tk[n] = kind; th[n] = Math.acos(K.clamp(dot(a, b), -1, 1)); n++;
      return true;
    };
    // nearest neighbours, found through a grid of cells over the unit sphere's bounding cube
    const G = 0.07, GN = 30, cx = v => Math.min(GN - 1, Math.floor((v + 1.05) / G));
    const head = new Int32Array(GN * GN * GN).fill(-1), next = new Int32Array(NC);
    for (let i = 0; i < NC; i++) {
      const c = (cx(U3[3 * i]) * GN + cx(U3[3 * i + 1])) * GN + cx(U3[3 * i + 2]);
      next[i] = head[c]; head[c] = i;
    }
    // the k best so far (largest dot products first)
    const bd = new Float32Array(8), bi = new Int32Array(8);
    const offer = (j, d, k) => {
      if (d <= bd[k - 1]) return;
      let m = k - 1;
      while (m > 0 && bd[m - 1] < d) { bd[m] = bd[m - 1]; bi[m] = bi[m - 1]; m--; }
      bd[m] = d; bi[m] = j;
    };
    const cos = x => Math.cos(x * D2R), c12 = cos(12), c25 = cos(25);
    for (let i = 0; i < NC; i++) {
      const k = i < 300 ? 7 : i < 1200 ? 5 : 4, x = U3[3 * i], y = U3[3 * i + 1], z = U3[3 * i + 2];
      const X = cx(x), Y = cx(y), Z = cx(z);
      // widen the search box until it holds the k nearest (a box of R cells holds everything within R * G)
      for (let R = 1; R <= 3; R++) {
        bd.fill(-2); bi.fill(-1);
        const a1 = Math.min(GN - 1, X + R), b1 = Math.min(GN - 1, Y + R), c1 = Math.min(GN - 1, Z + R);
        for (let a = Math.max(0, X - R); a <= a1; a++) {
          for (let b = Math.max(0, Y - R); b <= b1; b++) {
            for (let c = Math.max(0, Z - R); c <= c1; c++) {
              for (let j = head[(a * GN + b) * GN + c]; j >= 0; j = next[j]) {
                const d = x * U3[3 * j] + y * U3[3 * j + 1] + z * U3[3 * j + 2];
                if (d > bd[k - 1] && j !== i) offer(j, d, k);
              }
            }
          }
        }
        if (bd[k - 1] >= 1 - (R * G) * (R * G) / 2) break;
      }
      // a lonely city still gets a tie to its nearest neighbour, up to 25 degrees away
      if (bi[0] < 0) for (let j = 0; j < NC; j++) if (j !== i) offer(j, x * U3[3 * j] + y * U3[3 * j + 1] + z * U3[3 * j + 2], 1);
      for (let m = 0; m < k; m++) if (bi[m] >= 0 && bd[m] > (m === 0 ? c25 : c12)) tie(i, bi[m], 0);
    }
    // regional ties: bigger cities to others a few hundred to a few thousand kilometres away
    const c4 = cos(4), c26 = cos(26);
    for (let i = 0; i < 1400; i++) {
      const m = i < 150 ? 4 : i < 500 ? 2 : 1;
      for (let c = 0, tries = 0; c < m && tries < 40; tries++) {
        const j = Math.floor(Math.pow(r(), 1.6) * 2200), d = dot(i, j);
        if (d < c4 && d > c26 && tie(i, j, 1)) c++;
      }
    }
    // long ties between big cities, across oceans
    for (let c = 0, tries = 0; c < 650 && tries < 30000; tries++) {
      const a = Math.floor(Math.pow(r(), 2.2) * 700), b = Math.floor(Math.pow(r(), 2.2) * 700);
      if (dot(a, b) < c26 && tie(a, b, 2)) c++;
    }
    return { n, ta, tb, tk, th };
  })();
  // vertices of every tie: arcs above the surface, higher the longer they are; one shared vertex between segments
  const GT = (() => {
    const r = K.rng(77), NT = TIES.n, { ta, tb, tk, th } = TIES, plan = new Uint8Array(NT);
    let segs = 0;
    for (let k = 0; k < NT; k++) { plan[k] = K.clamp(Math.ceil(th[k] / (3.5 * D2R)), 1, 20); segs += plan[k]; }
    const nv = segs + NT, pos = new Float32Array(nv * 3), tt = new Float32Array(nv), ff = new Float32Array(nv), kk = new Float32Array(nv);
    const idx = new Uint32Array(segs * 2);
    let v = 0, o = 0, tmax = 0;
    for (let k = 0; k < NT; k++) {
      const m = plan[k], a = 3 * ta[k], b = 3 * tb[k], T = th[k], sn = Math.sin(T) || 1e-6, h = 0.004 + 0.2 * Math.pow(T / Math.PI, 1.1);
      // when it starts (regional ties after all the local ones, long ties last), how long it takes to draw out,
      // the glint's phase, which end it starts from
      const s0 = 0.72 * Math.pow(T / Math.PI, 0.55) + 0.1 * r() + (tk[k] === 1 ? 0.18 : 0);
      const dur = 0.05 + 0.3 * T / Math.PI, ph = r() * 10, rev = r() < 0.5;
      for (let s = 0; s <= m; s++, v++) {
        // along the great circle (slerp), lifted into an arc
        const f = s / m, R = 1.003 + h * Math.sin(Math.PI * f), g = rev ? 1 - f : f;
        const u = T < 1e-4 ? 1 - f : Math.sin((1 - f) * T) / sn * R, w = T < 1e-4 ? f : Math.sin(f * T) / sn * R;
        pos[3 * v] = U3[a] * u + U3[b] * w; pos[3 * v + 1] = U3[a + 1] * u + U3[b + 1] * w; pos[3 * v + 2] = U3[a + 2] * u + U3[b + 2] * w;
        tt[v] = s0 + dur * g; ff[v] = g * T * 2 + ph; kk[v] = tk[k];
        if (tt[v] > tmax) tmax = tt[v];
        if (s < m) { idx[o++] = v; idx[o++] = v + 1; }
      }
    }
    for (let i = 0; i < nv; i++) tt[i] /= tmax;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
    g.setAttribute('aF', new THREE.BufferAttribute(ff, 1)); g.setAttribute('aK', new THREE.BufferAttribute(kk, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return { g, segs };
  })();
  // city lights: the airports (bright, real positions), and faint illustrative lights round them:
  // suburbs round the big cities and towns along the shortest ties
  const LIGHTS = (() => {
    const r = K.rng(31), MAXL = 26000, g = K.pointsGeo(MAXL), T = new Float32Array(MAXL), H = new Float32Array(MAXL);
    const P = g.attributes.position.array, C = g.attributes.aCol.array, Sz = g.attributes.aSize.array, A = g.attributes.aA.array;
    let n = 0;
    // a light at (x, y, z) pushed out to radius R: colour c0..c2, size s, alpha a, switch-on time t, h 1 for the glow
    const put = (x, y, z, R, c0, c1, c2, s, a, t, h) => {
      if (n >= MAXL) return;
      const l = R / Math.sqrt(x * x + y * y + z * z);
      P[3 * n] = x * l; P[3 * n + 1] = y * l; P[3 * n + 2] = z * l;
      C[3 * n] = c0; C[3 * n + 1] = c1; C[3 * n + 2] = c2;
      Sz[n] = s; A[n] = a; T[n] = t; H[n] = h; n++;
    };
    for (let i = 0; i < NC; i++) {
      const s = size[i], x = Math.min(1, Math.log(1 + s) / Math.log(250)), ux = U3[3 * i], uy = U3[3 * i + 1], uz = U3[3 * i + 2];
      // the city: bigger, brighter and earlier the more routes it has
      const t0 = 0.25 + 0.45 * (1 - x) * r() + 0.15 * (1 - x);
      put(ux, uy, uz, 1.004, 0.55 + 0.45 * x, 0.7 + 0.3 * x, 1, 0.007 + 0.015 * x * x, 0.55 + 0.45 * x, t0, 0);
      // a faint blue glow that comes up with the ties: where friendships are dense, the map glows
      put(ux, uy, uz, 1.006, 0.14, 0.3, 1, 0.04 + 0.045 * x, 0.11 + 0.15 * x, 0.3 * r(), 1);
      // suburbs, within some tens of kilometres
      const m = Math.round(Math.pow(s, 0.75) * 0.65);
      for (let k = 0; k < m; k++) {
        const sd = (0.0022 + 0.00045 * Math.sqrt(s)) * (0.4 + r());
        const px = ux + sd * K.gauss(r), py = uy + sd * K.gauss(r), pz = uz + sd * K.gauss(r);
        put(px, py, pz, 1.004, 0.62, 0.75, 1, 0.005 + 0.004 * r(), 0.35 + 0.3 * r(), 0.35 + 0.55 * r(), 0);
      }
    }
    // towns along the shortest ties (up to 3 degrees), close to the line between the two cities
    for (let t = 0; t < TIES.n; t++) {
      const a = 3 * TIES.ta[t], b = 3 * TIES.tb[t], th = TIES.th[t];
      if (TIES.tk[t] !== 0 || th > 3 * D2R) continue;
      const m = Math.floor(th / (0.5 * D2R) * r()), sd = th * 0.04;
      for (let k = 0; k < m; k++) {
        const f = r(), e = 1 - f;
        const px = U3[a] * e + U3[b] * f + sd * K.gauss(r), py = U3[a + 1] * e + U3[b + 1] * f + sd * K.gauss(r);
        const pz = U3[a + 2] * e + U3[b + 2] * f + sd * K.gauss(r);
        put(px, py, pz, 1.004, 0.5, 0.65, 1, 0.0045 + 0.003 * r(), 0.3 + 0.3 * r(), 0.45 + 0.5 * r(), 0);
      }
    }
    g.setAttribute('aT', new THREE.BufferAttribute(T, 1)); g.setAttribute('aH', new THREE.BufferAttribute(H, 1));
    g.setDrawRange(0, n);
    return g;
  })();
  const globeU = { uG: { value: 1 }, uL: { value: 1 }, uF: { value: 1 } };
  const globe = new THREE.Group();
  set.group.add(globe);
  // the dark sea: drawn first; it writes depth only when nearly opaque, to hide other sets behind the globe
  // (its own far side and the network inside are hidden by horizon() in their shaders)
  const seaMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uG: globeU.uG },
    transparent: true, depthWrite: true,
    vertexShader: `varying vec3 vN, vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float uA, uG; varying vec3 vN, vW;
void main() {
  float f = 1.0 - max(dot(normalize(vN), normalize(cameraPosition - vW)), 0.0);
  gl_FragColor = vec4(mix(vec3(0.008, 0.016, 0.04), vec3(0.035, 0.075, 0.22), pow(f, 3.0)), uA * uG);
}`,
  });
  set.mats.push(seaMat);
  const sea = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), seaMat);
  sea.renderOrder = -2;
  // the atmosphere: front faces only, so nothing changes when the sea starts or stops writing depth
  const haloMat = K.rim(set, { color: '#3d6dff', a0: 0, a1: 0.34 });
  haloMat.side = THREE.FrontSide;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.03, 72, 48), haloMat);
  halo.renderOrder = -1;
  // the lights skip the depth test: horizon() hides the far side, and glow sprites are not cut by the curved sea
  const lightMat = K.points(set, {
    uniforms: globeU, head: 'attribute float aT, aH; uniform float uL, uF;' + HORIZON,
    vertex: `float on = mix(smoothstep(aT, aT + 0.08, uL), smoothstep(aT, aT + 0.3, uF) * smoothstep(0.25, 0.4, uL), aH);
  vA *= on * (0.85 + 0.15 * sin(uTime * 1.7 + aT * 517.0) * (1.0 - aH)) * horizon(pos, 1.0); gl_PointSize *= 0.5 + 0.5 * on;`,
  });
  lightMat.depthTest = false;
  const lights = new THREE.Points(LIGHTS, lightMat);
  const tieMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uF: globeU.uF, uG: globeU.uG },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute float aT, aF, aK;
uniform float uA, uF, uG;
varying vec3 vC; varying float vA, vF, vP;
${HORIZON}
void main() {
  // kinds: 0 local, 1 regional, 2 long (these carry travelling glints)
  vC = aK < 0.5 ? vec3(0.3, 0.5, 1.0) : aK < 1.5 ? vec3(0.26, 0.45, 1.0) : vec3(0.24, 0.42, 1.0);
  vF = aF; vP = step(1.5, aK);
  vA = (aK < 0.5 ? 0.42 : aK < 1.5 ? 0.26 : 0.17) * uA * uG * smoothstep(aT - 0.03, aT, uF) * horizon(position, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
uniform float uTime;
varying vec3 vC; varying float vA, vF, vP;
void main() {
  if (vA < 0.004) discard;
  float pu = smoothstep(0.96, 1.0, fract(vF - uTime * 0.12)) * vP;
  gl_FragColor = vec4(vC + vec3(0.6, 0.7, 0.8) * pu, vA * (1.0 + 2.0 * pu));
}`,
  });
  set.mats.push(tieMat);
  const ties = new THREE.LineSegments(GT.g, tieMat);
  globe.add(sea, halo, ties, lights);
  // where the camera is, in the set's own coordinates (for labels on the far side of the globe)
  const camL = new THREE.Vector3(0, 0, 10);
  sea.onBeforeRender = (rd, sc, cam) => { camL.setFromMatrixPosition(cam.matrixWorld); set.group.worldToLocal(camL); };

  // ================================================================ anchors, views, controls
  // a point on the full-size globe, turned with it (the anchors ignore the brief growth, so camera targets stay put)
  const spun = p => { const a = live.spin * TAU, c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
  const onGlobe = (lat, lon, h = 0.01) => () => spun(V.mul(ll(lat, lon), 1 + h));
  // 0 behind the globe's horizon as seen from the camera, 1 well in front of it
  const facing = p => {
    const l = camL.length() || 1, pl = Math.hypot(p[0], p[1], p[2]) || 1;
    return K.prog((p[0] * camL.x + p[1] * camL.y + p[2] * camL.z) / (l * pl) - live.scale / l, 0.02, 0.2);
  };
  const PLACES = { europe: [50, 10], americas: [39, -90], asia: [33, 108] };
  const anchors = {
    hub: NET.at(NET.hub[0]), hub2: NET.at(NET.hub[1]), tuft: NET.at(Math.max(0, NET.tuftAt)),   // the giants and the biggest dandelion
    globe: [0, 0, 0], europe: onGlobe(...PLACES.europe), americas: onGlobe(...PLACES.americas), asia: onGlobe(...PLACES.asia),
    // the top of a tie across the North Atlantic (London to New York)
    atlantic: () => spun(V.mul(V.norm(V.add(ll(51.5, -0.1), ll(40.7, -74))), 1.06)),
  };
  const place = (k, cls) => ({ text: [k[0].toUpperCase() + k.slice(1), ''], at: k, cls,
    alpha: S => K.prog(S.web_globe, 0.6, 1) * K.prog(S.web_ties, 0.1, 0.22) * facing(anchors[k]()) });
  let local = 0;
  for (let t = 0; t < TIES.n; t++) if (TIES.th[t] < 1000 / 6371) local++;
  // explore: c.t restarts whenever a control changes. A change of Ties alone keeps the view up and only moves the
  // ties (Local only: back to the local ones; All: on from there); a change of View, or reopening, replays the growth.
  let xView = '', xTies = '', xT = 0, xKeep = false;

  return Object.assign(set, {
    params: { web_a: 1, web_net: 1, web_globe: 0, web_ties: 0, web_spin: 0 },
    update(S, t) {
      // the dark globe grows out of the internet's core and swallows what is left of it, turns opaque early,
      // lights up city by city, then the ties spread from the local ones to the long arcs
      const g = S.web_globe, ga = K.prog(g, 0, 0.2), gs = 0.1 + 0.9 * K.prog(g, 0, 0.6);
      netU.uF.value = S.web_net * 1.08 - 0.02;
      netU.uN.value = 1 - K.smooth(Math.min(1, g * 1.4));
      netU.uR.value = gs; netU.uH.value = g > 0.002 ? ga : 0;
      netGroup.visible = S.web_net > 0.001 && netU.uN.value > 0.003;
      globe.visible = g > 0.002;
      globeU.uG.value = ga; globeU.uL.value = g * 1.1 - 0.02; globeU.uF.value = S.web_ties * 1.06 - 0.03;
      seaMat.depthWrite = ga * set.uA.value > 0.97;
      haloMat.uniforms.uK.value = ga;
      live.spin = S.web_spin; live.scale = gs;
      globe.rotation.y = S.web_spin * TAU;
      globe.scale.setScalar(live.scale);
    },
    anchors,
    labels: [place('europe', 'cyn'), place('americas', 'cyn'), place('asia', 'cyn')],
    cam: {
      default: [-18, 12, 3.4, 0, 0, 0], net: [-18, 12, 3.4, 0, 0, 0],
      hub: [-30, 14, 1.5, ...NET.at(NET.hub[0]).map(x => Math.round(x * 1000) / 1000)],
      globe: [0, 24, 4.1, 0, 0, 0],
      europe: [(10 - L0) + 4, 38, 1.9, ...V.mul(ll(46, 10), 0.7)],
    },
    controls: [
      { key: 'view', label: 'View', options: [['net', 'Internet'], ['globe', 'Friendships']] },
      { key: 'ties', label: 'Ties', options: [['all', 'All'], ['local', 'Local only']] },
    ],
    explore(c) {
      if (c.view !== xView) xKeep = false;
      else if (c.t < xT) xKeep = c.ties !== xTies;
      xView = c.view; xTies = c.ties; xT = c.t;
      if (c.view !== 'globe') return { web_net: xKeep ? 1 : K.prog(c.t, 0, 6), web_globe: 0, web_ties: 0, web_spin: 0 };
      // local ties are drawn first: stopping at 0.24 shows them alone (and that most ties are local)
      const ties = c.ties === 'local' ? (xKeep ? 0.24 : Math.min(0.24, K.prog(c.t, 1, 7)))
        : xKeep ? 0.24 + 0.76 * K.prog(c.t, 0, 4) : K.prog(c.t, 1, 7);
      return { web_net: 0, web_globe: xKeep ? 1 : K.prog(c.t, 0, 1.5), web_ties: ties, web_spin: 0 };
    },
    // numbers for the story text
    netNodes: NET.n, netLinks: NET.E.length / 2, cities: NC, tieCount: TIES.n, localShare: local / TIES.n,
  });

  // lat/lon of the 3,214 airports, 4 characters each (see airports_decoder.js), in the airports story's order
  function airports() {
    return 'WPc4V4deVuciUegoTUO8UoOZUVuWVod+TNM+WuiDSBkyWHcDUTLxSwNPWEcGUhcdUmeCUaQmUZbkWBc1UbQiWLcKS7vKTXJoWabxWFdMU5PsRut1WabJW0h+TkPfVleuSGPlVfdeUqPHRjt7TtKJT7v5VFNkUJQBUQcjXZe7OSsYUTQYWweHVrcgQNr4TzbbSBkMVMdfXag3OgsBWSeNRdiQS2sYT8JAT/f3TqyEXdd3UsRCUIatSgPbR/vEVSdFUdgtSioLSJPnUDcCVLQnR/sNRGMpV5eXWBdPVfJBTSa8KaU3UcKoUJQGTSKoR4krW0bmXfgCU5dQStsyWcdsWLcEIxzwScZiTdtIRDnhU2c8Rmt6V9c1SbZuWRb3SxhCRWOjJ/gjVrdkVNdpR+jbSBkzTEhlQVvCWOfaVefJVNc7TreZVwI4UmObPeiMOzQjTox+WGbtVLeEWwh9UMQJSyu8PfPuSet0UcQlR5ulWQePScPPVCgNW9f4S8vFN3h5VgdTW7loT1g8U5dwS4t+TzcoVBd5NHszT2a4WHc+WzbcTlgEV8g9UhaxUkvbUIOAJy0DT1duWDKUVzcdUJcWVMv3VMI+SmaAUKvHWUb7TcxQSojoTLJ0Uhm9UPcDTBhwUiPWMMQFV0dGVcb4Tdt6ShZ9ThhYILywUZfuU7pzRwlPTButTvu8PwszRZDdV5fOWqpDVEfTWRdpWfb3UdeXTwghULueKeUxIS3cUmeGT7efKgVYUnckSkPcVEcBStNPWqb3TAa4Q8R0Xfc8QPr2SNs0WZbsQ+RcTtOlULO5SNj6SHu1WkfBV4dRU4cWPuRqRYsqT+tuWmgFUDgYU2oKTWhrLlUpIqTAUVhSTmkIRmtCWXdgPGcpUNNVR6iVThxgSyM3Uue/MtuISLkCUfewPMonR9kwIoS/RRL/SAtUWfggI2REUvfyQ7tOT1ucQIoRUSuUWxdkUQfPTnf6UZj9TulcSwOBUCeLTrP0UNdjRLtZSluPMreMQGoqRit4R+QBSuvHWIdFTUnjJFuQPoO+T6bNVNeCWZKYUdtmRmu8R9moUZPmU3erXRdARnp9UwyRTUwhWHcJTkwRU1brLAVQTCudUROpVGiQT9JCXWd0SrMvXoEsRyqQYEYmS/nwUDuDQ4SRTpkJWCnTTTv5UUPLUWjERqPQTxsUVLdlUddnSNPWSbvBVFSNTRKsQXZZXFeDPVrfV+cnTiOESGMfVzd3MmzIQKONTJJ2UadbUFm4SZpeXQexSKwFSbPNX/d1WDexO8cGO/uRLby6TLZgVwbyT0gXUyOZWKazLVEwWMc0Q8RPT6JFMDWJXUdvUFssRgt2XAbyWnbKPrvgU8vxTzgoWHdUW2qlQ9P9QtrJUHJIVIdVWGeCSPrzOunnTtdwJYUIXWgAT/eFVNepV9fHK4lJInxxUndgUnQxKYU1RArmU6d4SUhaWPscS1PXUTcyWTavM6twVpdUWRfXVJQTQBRMVZgpTfhNQfjCUljKODP4KFUcTNNATXd0LS32RwuVSrkWTLeMU9eiTiLePedRQvSeUudnQghOTVPzTocCSPPnR3u+UCOvWCb6NRu0VKd1T6vGV3M8SzaqXkC2IwfCM/iQUznxTgxSVSeZTmM4VfiXUxa0RsK/UofgTVJtUJeqO5bhT5gdHR3FPqoEWGbnOsdpVkduQWN/Wwj1RVDsWvbaReQ1PuSjRTLsVieKLIjjLT2bHn3cTUOlUxP1TNPoPEcgQktCMIwlTujANYeiUxOxThPSS5gxV8g5VpxQWbj+U4cwOvt8UhNJO5rzQKsWY9fFXxwaVYQ+UwQmUbe8QHS1P+RWUPtTOEhMV/bmRFPaXGd/QLywNuPpMm1JQ3QIWqf5UWnBT1QOWQewUlQ+T7QDSchgQ7R+XAmVR/vIWmk3S/u8TxsEQEjKU3iYN2UjWmbNVme0PzoALoTXVYf1OnQMTDu2WDeSYMFBVsdZNeWHR8uqLrglNmSwPCQWSRPUMzWrUzP/KfVYUifNTuNJStunTZugTjteV5NxX1KQRrneUatUWAb2OPsZUjNfVAdgNwg1TfNuLfReT+cAT9YHTYnTUufaTWJ7U7kHU2biShZlPZoJTqPAQBa5U4J+UTO+TXbWUfQnOJdmPCcVV2f4S+sfU+i3RKRGUgcUQrYjUzQPTFKzQ4sKTzbLRbtNXWe7YleYQzOVVybuW2i+TMkPTem8T0bwPuOxSpqVKBhOWfawYJCSWqnlTZJwQAb5P4sgQZYdQfOZUByJU2wyS9jwN3uZO1uFWtlvTtPpLRg/TjuoUxQ+PxSIVFeTUPJaWIcPUXQcVis0TvNZS2tjSpu4W/drTRjCU3b5QlYjJcg/TCLgT8v8SnKyP4i4M2tYOTtYUAO6TeutR2tOJq0HUangYhCuQ+Q1QnShKzkzTFPcU6e/Kje3VoOLTKu1U4PuVgT5RYtYT+fZSYs2VOLLSUk8VZdTTaJoNaehVliBSntYVhdnJvUjPaaESJqcTWuvT9M6OUsVXMHGTWJrUWQIWveOIoTYP9eeTibqOpd8VUg7K+VRQ+nrU5RJKxUqXpnmLQ4COjsAUsfJTpbNVOfdQNSnLUSRTSu6Q6izUAlQTFfTVpbcUugbUdPaRjqeUnNzTvtzUtdgJLSGUILxTvdKT0JbQWSmWNdVQenqVaeiLeUcXDbgUcQtT6gGNih7TwgHRJDwXSbrTCwjRgDPSlsmOUvpUzOLWBdCTNwbY5pxS1OgV5fkUBjWQROgVOePRqPaN3h4V4JeX4NvWVRrWZSsT2hpX2dFNfwJU4eOKITJRWMRVBQtTXPdU0cfK3TlUqutSjLkMEjNSLi+VZNASOP1UeO0VgJxXWc8WhbaQGn1WpfWUAx3SHuEVPcUMsuTTqd0UjN/NKWmYZoFV0udU4bMUbOHQnOnLp2QQby5RFMkXqf0LEzEPkrxWKs6VsjEYCRaXJRcV6RxUbQWUPQeQdiNM/s8VsI/WebqU1cqUsm/UEPYRROjNqyFVohnQgSjPLvxVEcNV+h2U9I4UjdjU4NBTNuNKl2JZHf1NKyrTcw5Vwu2RUQNV3hzTeOkWMt1K1x7THODRgr4TluUTwxcUqixNCzDSQoxQ9RXTftsNciUULgSRsLhQLceXmoFTEjEQ7ZoUenUKo2GTgb1NUd/UseWUJfYKwDKTZbFQXj2Vlb3T5PoUlOpNVkzT5NiTJnwM+tYOqdfRbidLHUmVZybU0geRENGK5V1SZukTGtrV8LxWDNeWOLdNGiQW3dyQCPXMWWVXPDqZAfyXsDNKWxDTmPPTISBLRvOUZOPRlP5SltkTiO0T2eaPkaAQcu+PsQVWbb+TkhXPCQUR6PWUyPDKOgLP8SeYGUDWXdKPjjBXmm7TwhzPwvRTojNSQn+SpucO1hEP9ddSNkkP5vQT3fkXKdZTVMOV+c+VmeWVSb8NOUdPuQ7RdrII8RYP9OqKZUAOYjNRVOHSynSTWw3RXofWTcVTgxDWIdeNnsfVTJhT5j4VIeaYemiNqVOT9gVRGRGUIX5U4vOSzmlTexQZBgyQ4NoQ1pIS4tEWtP+R1iFWfI9VrI2Ulb+T0dWRdMJLtiRS2ubVTjoU/OTPsjJNiuESVsnQJZiLgEbHpRAZNDoS2jlVOKxLWRyXViEPyoKR8LVUVt3UBfVYxevMQgbPFTCVfKuVbkOWpdbMRi5SKM4SvvQSivGVcgcKETnLwWCR4viVYwhPCsHTDwrX7dWWuHjQhOkKbUJL6haRLsGSFhPTDMKNQy6MlWiUsI7RLMWVZKTWwkRMCgnTOtuYTnfO7TgOJr+NZz8U9MBHUR7PCagRYo5Q3SURMQSYiUNQQSmSiZWWcedLwR/XhfnS0O9Sgh2UeiWUklmUEtQTzuvSksdYvHRW7KwVRSBSrlpVwdSUhRLTkMPKaRIYKifTBn0UhQTSacGPxQcROpiK+hlVERYPpSBYTeCP9RdLgWBIjzcVOcoUBP4TALgG6RlT7usWCd2UYnWYLDnRwQRULLLTvhLTxuAUmyITBdFUwqxPDozRnn+URQUVdd5SrtIM9WrPVrmV1nlWOapY9gzTMwlMevdK1uYUwO6R1K4U1a0SZkoWEfrVBwYZKgeSNQFX1t8X3dRTyJGK8fyS4suQwSWTlxhTDc+PePsREMwK4uqNptlMCidPXSUU/JNLvFDGARTPOxJTcJaObtoXtkFK0UaQxSVURmmQuklRjMXRlPpN7wpSWPPNsTkTYn0QNjBTaxELjhYNRVcUsfDLPj2TzxkSEL+SIl+YCfTPqRhSDpFWKiQLaelQsYNW9ebTnw8WHP0UxwXWKNcVWPgWyM1VqPaVqReSClkHC2fQsMjR/siUbyHL6BQLhQ8UIhrSTg+UQyCTDknRFRPTmJhVYMZZGgxLnhmV8wCOjtyUkioVGcXZJgqVCdUL9Q5S7s6MJj1SartUwduS0OuMu0zQ8SDUqQHVudHVnKRXsc6T1koVkM8TubTStPRT4biMz0pT2h/SWipWfeWPJr0VWKoSLhFUFXpYVDtUzPzTuyETbP9R8qzNNUtK3RKSPp7Y4UJM8V/UDgNS3uhTNsVUlplUdf+UbjXU0cIWqbAPDrtYTflSFLFXbb7HlzILSgKNvzKSKMyYWeMN7xFKwzcY0hQS3OWYceXMx0tOut/Tiv4R4uRX8n5V8bWI8z2Lj2SJ3UiQuNBTTwtXpmEP7ZsSEpbVDQpSWqGXHk4UzeFUvclSWkXT3QLVWcLQbsqHmQtHx3kMmVyPlusFyRERSMeWKkzSIMyUqONLdEdWfeDI7SoPYvmWIjVZCE7TJNeVHhcSZm4YYeFQ1SAQISlUjQjXKbJP0SoLB2kRjM1SbtNNiSBQqNmKsSBRoc/OlugVecPOvulXoVCV4pBYDDALPgKUqayQ/spUMfsS1OnOViZVnRCVwTKWeOFVlR5VlP+W2JRUyPdXjHBRpMFQ0MRWXNjWdqaV7lEY5epTmgYLNRJMiGaQ6SRUqOxPwvWOwfBUSmNJEyPSqnVTzc7NjgtTxNkTqdHQDtBQ9RpW4sBS1N5SlkEO0T8IUQtLh2XWsCtSWK+VwcEKjRXTzwDNHUUSaM5J8y/P8tMRcPZR1LzSXq+T/iaVYNuSFrzUxnRUWq8G52uVLczSDQJI6geTytQHXRBUAOdYBmjUGiRXxa/TiPzNnwzUPXRU6c0UMvxYeFcXbzrYjfYTIcuQtiyNHy2PIjjT7iNNzgsS0ONVBOXQkjwTIspW7eITal2RUrQVSvMIJ3hUOyLQYi2XydFK4zaUEPOLdEiR0vIWccFU3KnNeQrTLn0RtpdP4qnUTrfUFsISruOXjU8J+UgTkgNVJwoS/mbSzlCUPoATvfuYNC9VWeXR4uoVrfcYNDfVDmYWedzP8iOKayrJZRAR4rhVUJ2UTgEPL25U3O/X6D0UwjlTlbqVnMTLVEuIuyVT4ieKGg/WaNyUiRGNshRRwu0TzmoOtuEUpwEVcvfMsGOL/jrXWbwHn3MVLfEO0QTJqT9NustWY05N7u3IwgIVEdvODtOU2cEMtSJYctoRGh8Tuc9VAchUBelYFYtUds9SEhiXuC7UdP+VwdPO/ulX1e2TfdzUUu1YyeeKLR5M5tcXodPUSOHLGR7TykcUFI8TrwPKwAxR9rhO6sPVVf8RRrvUAnCTib6TXdZW4pcUkPCTxPQPwobJxz3K+UoYAkiNHyNFgRdQysMUFi5XFfALvVvOuQoYUB3Lqj5USs0NgylJ1T5WgN6VVO7WfOIVvReYHNHY3LtVPRvV2NpU0PpVLQqSat/WoRsWePzUhPhXNP7XdQDV1InXcKoYRIUXPNbYGPGPJvNRDLyR1QfR+qfVGh+S0jqYjDdRPioUeIvXGETRxs2YeESS9NrIqRcSUoUTSPUL0FRRyqmU5yZLuj/R0hQNkT+L/yRM8UmSLsrKIwmR4kpUbnbT/ijG5Q7LSgEVfJBJhgPPLQsUqQQHl3TRMiyIBSaRtoNNtgoJk0IVFe1PhPSPoRSTgdBO7rCYhEdNO0TK8gmOUg2Hqy5WXe8KKTxKrVrRMrvKfVjMWRYUNPmRaP+K1yFVluDUxLfM7WhPTQzL6yfVEOHJgUIRJPpMpygU4cfUUvjSwnJMvvvPkirR3dnVac+P6tELRx0VqbzKmTjPavZT4LTWfCHQ0jEOIhoTQNoYKCxX4CbPFdUURiTUpPmJvT9KiezUUikOOPsSshmSUaEUlRCOJgFTzLOVYTWGNQ4TXdtTcdgUEyEN9nkVALpRaRBJpTqPBvrSBQNKVzwYKCqPheOMJxgUCfeUeMxIwfoS7M2L4xdMdznSAl3HYzLNNzoSBj3LPGHXrCLTQwfYYEBZKgMUlRJKDTnW8kfKVhqN/2NSVchLH2lLBVfTqs8Mc1bMEyhV3bJUtQLRJD6RzqYS3oITZoQR9qqJ0UFYzT4V8vhYiTvPhi1T9gQT2gVUfvDKmUeLpRKSmutYHDVT7h6TUxBNJfpM70wJQvHXrDFV6eJNgxBLmwPXbCgTcjgXxCnWYmEUImbUai3YRCHOqsQUyyqNqzsXNj2Pb2VXbCoXaC2UAhOUXPuO5uJJJ0/SyNwK02QZBgCYueQSLtkTneGLl2aUdNARUDnXmghSXMlT4gUP6RLUEiHULO8O1uKLgEWOEe/KlVmTHOoXdfPITzjRYDlTJNwU7yqR8vtMLxGUIipL72VNEygTKKINkiZSCrWNixTUtlcRVZeXVbuJi2XYokbMEemH53xH+3WH/ReYLDbUVmUXxmYODh6RYq9TgQAYhDnWVvQNAUKT9jLLdx4XhCVX8eZV1e9YJd8YNgGRoaLRSM5MwQeT1KuVAMdUGXsW0fbV8oqMdUkPK02T0eAMszTXrfiXWbrPqsYJK0BOJQLUWKrWOoLQQtAMhRhMy0wYLD1JbTvUkLFKazpIH3rU7NrKkEeYMd4SgnHToLjTkJSVOf5JzRIXvCQLveQYKfbYhDkYIC8L62TLZj6Y+faLxe5Xac9LSSQVHitL1j+YuebLc4JNPyMLtE+NXxhNKyeNQskLzFeKai9UzdGOIdLTDf3L/2KNDQMIL3qOS3MOMwCKaExVDOwLdABMrGVMnGPLRh5O9QKLh2bWEkLXdmQPfrnWmkYNpyNXrCQM407USh5ZEg+PpspSaZVRxZpKohpXYeuN7r0MAAmWVOLRvthKeebScsGU7uQL0FTPiO/VrNiWGTXV4IjWGTMYqKJX+N9XnNbW0ObWIOZWnMPWcP/VeSeY6PWZIJuYyNKWNNZV9S0XkKCWES9V/JUXcRMWrS4WFPiV2QfV6SeWRNmXVRQWgMVWOKVUrPKV2NYVtTmVJR1W5PwWpSyW5QLYdOqVmP0WTNbWWOeV0KCXyNqWlICWoIQXQI+VTSRY8NgH4QtL22UWVN3QqsgR3k0LAUyIbzGVfdoV1byT9iJUDjsU+cOW3eJKGTkTkbiUpMEZGDILIDKK8DbSuiZURi2R2fxYtEbUhorXkP7RNqpInuiT6LlPAiAUfvVUXP5PCr0VHPEPSQJSfjVSshmNih2U8QQKxUQUMLbSgwZPohiZFDiVFM9U7c5LE2oUdgMOxQSRkQkLsFOQSiMWapLOpuLKYy1SNksRjnkXDa+KRx7UmP2UJieI2zhN4xZP4h9UJbEYYC9KQy2NdsHT+PdXgejMvurK/1tOCfZOKgvPDdAP0bdS2rTIzuKKfx/MLVGVUNbUcN5SHM6P1j0OXdqZBFsLTx7KBx6PevvKoSMVSr3NMeCRJQ2O2dcMHePJlUaMxUbUwMBXhFZUmIuWYbqYUFgJ4ULWqa1JV0DUju8PjPPNB0kYeFrTrnWS2NERFL8LTUiJsy4Q/NyUUOVVBLGUINuU/f3RoQiQAZhW1jiNnPyURXROYDjXeCdWNIHUgLwWtI5SoPdPYPQSlmMJCzWT+MgVffgUSOPSyoWPhvZVYMERTnNN0sUXSDXLI2iSHqyT+gxVYvrYZCsO4njTDnNUgPzYL35VhmtU2b2WvdeLvyQXeC0XKDiS2clMsvJXUbsIzvKU2tpVrI7S+anXxeYTjQGLkFXNeXEUiPpT4yEHzzQPtO6VpI6Mz1EQtOFKwgbTlNYLB2uKKjeTLwQYCBTQBh+Iuy9IB38PUovOLnmPbPIPVhiKdHDL2VdTwq8MPUdXMG7OKvVTgsKZFflPHnkQen3XyDKKQg/V6wBTMhmXceQURP/TGPhTjwJSWtRR8onKBgfXJG+XUG9TdNlRUszTNcpTvNlQos9QiNFKH0BSLtMSddoYiDEOwQZRWQnUUi/VOOXVqNiJ0LCTMKEYWFnOggcVmL8G02bYygaSCo5PmoVRLn6KtVYU4K1Q+RMK1yRSLnjXwUXRWDpUqPvPRh4XGeVRsopXdVEXlU7ZHT5UXP0YST3TygQKQR9ZcTXX0gJMeg/NbvQOJniOXnnLF3+WtplYWf+RZrsWWNoWWOFJkgAODhjQpsMXcCrLnFLXDEEW7erNngLH1ynK31zYBfvNOgWX6ClWZnATswWX7e6YqfTWvmWO61mXWeNWGdmTmgVTWJsNytUYpgBPJuYYpCaTjv8LpySTMfkNuihL/VWMvu3T2MWLf4JSxNkUSPLViwSU4Q1NaRNOmuIQIvdOluEUIjwXhVAUqJHLe2aLr2YNcPuOjhsXMelLf2WVibmU7N3N7P2J5egVQdhI3RwNLw3T/PkRJPnYKfDaTejSpq3TLPEJ60DIJTIILyxMlerILyIUQPpQAriULNBKmUVMZ0ASVmxNHf0LnjYToOPOhtpLeFrSdPiM1tvXvC0PDacWlb6TuxrUcQgLdVSMuvOK5jDKnzRLUf6P7vMF+TAWalUL9UmVUOePsOuN2hmS2j0UbyOPcQSPmSRTkcKORRKPteXLvE5XmeZIdzlRkQuXgCJUchrUMjPaLRSUIhhLQfNPOeQTFopXhCZMY1hRAr4PoOwWeptIpzBTzkLLTyLZCEiRIrKN/QGOsuHR5jEJmetUjhJMNTcXUeeUrQ5YgC+NzTaWEclU2IuT9OgPWveVjhpS5bDXqExPSvbRdnBLg2bPtRfPCRlOrRhInThUpgBV4elMGRUQdPCVIcQO2dOQsrzYlfvPZPHXjC2I5zSNut7PePFLJU3KmUGWom8K3zWHr3eQ4RuW8HXOSQDVXJ1S+m/SNsCIAQyWQIWO6dQO8dCS5ijL0RlM0UUO+sOYneBFqRjVMOJR4p+J7zYU8eGKiEQMh1cW3ehQSy0IWSFTgwEPKQ5Iyu6KVFDT1kDQ1SQUDQVXudFTFhkQ5SSJszWT2KZXXG/U4yyUDPzYbCLQzjfW/G+KcU9UHXuUKf9WhjMSEMXT2YMPzQiThJTQqYVXABiQ9q3TbK8XUbuSGqBQ3OYJtTnS7euVMNbPQQ4W6BnRXnfPmvvWTOTYBBfOaQcMIeyLf2TM0wpMQUNNHeEP0vqQYNsQHtNLQRJKx2WTlcXNps+PPz2YQCJMmuwPFQ6T5mpPlO2YUB5N5QARaLwJFz9NEfYTbwVTobTIB3pTbOQNeUXQRreXeeKTINOJIRcOJh/TXwpQdshR6nrQQtKVDhYSNiFXjuEJ6yrWjjqRGMMS+h9YYlGTowWP9u5JofdQDr6K22KX7fiQetHPbsyQzsyHrSSYiFQMjfUYKewPaQ7Q9SEYnmIUlbYQ5R6L/hpWObBIkzLXNbpKkyfVKySYLCmXjC0KGybIe3YW5HcXWbrXPDmYoCqTNlZMcspVscyWbOSNtP7R3kWRbQ9WRIjZeO2WJNyXXGTPjxtWVPQVvIxVxJwVkRxZFRbWxJWWOPXYaICVsSDV7SMW4NVWvSuX0P9U8o1ZbP8VpS/U3PkWOOZWWP0WJQPXOJ0XNJeWHOCV2SFXQKxXnRQWsJjVSSwWWI/ZvNSWiS/ZUIkYGQLXPRMTLKOY0PcXsQ5YQI2WOJEYZR3VuJAVUPuVyPPXyQTV/IOSVsWVgR3WOP3YNIgT8skQCZlWPPXWAS6HuQtWfNuV/S2WcSHVip5QmkSTIMjMXyZVLMwRkhES/O+N+Q0TAM8S7lvWLAiYVZTMhTXTulIVod1XDHGPwnaTYPHYUfJWOA6W9ECUuNsVRJpVNcKWEc1L7QrX3DGUSg5SKPWKqUnYtFYJTz0VSfdNqh9MnQAR6QTMr1SPLRFU/ROX3CZVFcgK62qIIytQWjcMBQiVhfzN6STKLz7SOp5Y3fBOaueUnL8QcsRVBRcRtnBSZpURenaSFPvSNpxT7lFVfNTOsuMN3hGUGOGRacRPaRKVFo/SwNcS9PZVwevW+a+PCQCR/roRRvMVQKjOqQGNNvSOgSpMFSvN0UQSXpKU1evNrw+SnlRKwTURoqPVVd5PgskPCSUWubPTBbxPMviMKrQT9KdJDxBT5LKT4OIPhvnXsDQUSJFL8hOVTO7NAPqNbSRM9P3PvrqZGzPUVgQTPJzVlI1LGTHMnURNIyyVcOTVAglTHL1ZHYmUIK/HzRBJixLRKN/Q7R7QBvmTJO3YOhtJmR3Q9OVPtSHRxMqRbqgVxI5P9vlVRRFYz1VQtvKP2RPM4QwPhQXUsN9LUveSprxSkouTGoDS9OyVdc7RasOU4scW5bqVycKHozAPbPELZ2bVeJWVFN1UQgWUQLbQLfpYRZ4PKQmSKh1UcKCMMxUQMgFTTdMXKG1KYzSXiEgSztPNCRNVNOhVUjDNiPoQzSSO5Q0R/k7OUQUTjKrTaPrJ+TCNJgtUKNLMv4IRrtzL1ATRNQYUcjlT/MZTsKnO/i8VbLwVCiEJkuDJa0CTINVVmLeSAdtTrnvQpOtTTN6WLbyOkfOScZcSPpLKGUFOeP9OAOBULXwTTOSUFLbLHVkSLoWMYR7TPx+ThjuUZLYRFrcVeNoMayXHZ22YWefRUDwTLMAXZEdVAMyMrhXT2onOahEMhQOVkqcUhQvVpK+WsHYYmpqPnv0XEiaPOcwLTAHYZYhVtf/XVDxTUjYTWwaWVBwZRwRUlcNXaD7Ki2TPYc1WxbJURfYOyr7ONP/UgQHJeRsUVNrOAR+T/g4NaTYLFBlTfwuTZwyQjnyTmw5RHNATqN+RlnET4NXT3gGX3gwPBvCPkdhMXSePPP6UMfzRsqET6gCPvdRYHgdYYgsIl3NPprhOQwHUlpFPAorTln7Sdo5WpCmUhhaIfxnXynxSysBTSjrSKk6WzeVIj3TTXwmWwHVNrgpPHb4Ky14QysePusUWzDQWhCOW3djVLpaUZfdOxsSOOhmXlCvX6geTDoMTrv6WrCxYnhYXkC6XEEARGqvWJq4UXfiULg1TtgwVsblTrLhQ6u9UhLnTeMwUfMZSFuYO2unKmt9MHVrVzcJUubPV5bPPWQ1RsQZNifzLOAMOuhgO0uGRxrwUVQNQysBN3RQQ7rrVHcuOCQcJk0FSydpVUrKSIKvS5oAMOfPY1CLN6vUUci/RWr+T5PwS+niQ4MKSGM5QrriQ7RpU/yiU/OqQAvcT5JTUWMaOFUJLgxZNHylN7PhKt2YTHORL/hHJPg3KpDdMLxNHdQnVzddU0OqMvyETzf9YOEmT8JkQcYgOsv7T8JPK+DfXxCjQLiTPaRAJdzjTgOcVFQcJdgcQhiSLreCUFLRWrHkJ7hBQ5NWRMDzK7DjT+OOLu2ZV1rxP+oHMdiaO2QVOpvvPFsBX6EASWMkW0C8U2pKUohnO9QDXOerPZrvT5xiOrtEOiQXYwe2PObxI2zbMRSiUvygZFYsXHt+RTsEX+fGUgKoPITDVDQVU0jGTgx6NTyGYBdoNhRXVlLoJTxhU1e7VafjLReoUWyEWDlST3OQYDE2T2gDMmWKKcuiSVrWSiMbVNJkXvheJHT9WXjKUQjnToQCKVhAS/OLUxKiNpTQXEDgNQPiY9CqSSmJUOPaSepQVMO4IqxXHYR9Uwb4N9dgLBR3L1BdOdQKVXRgJGSrTfKkQ5ryNZk1N2u/UzREJyTYKWgvW+DWIFyPXSC2UDLzPbQCI/xpQKPaUpRKY+2yQjM9TPZlO8RkRGrgJcg4O1dZSsi7RjnMJlhJP3QvK1yfUZJBJyS5WMpiUsbkJxR/MWR0UzLLUtbxU9RVMR1JWrecQlsWLeTlTRLzK+mCX2d5R9QOMH3zOjg9Mh1QU3QvLSUKYegKP4vUT/JMQCkjN7OIMZ2CJuSFTljeWtDDVhL2QZYTJHSoWqdqSFqgTVxSVELaX3DMOeQyQAvDODRqS+MbXUdoQFc8VAQiUebRUIM4XtDkRZRAX/CzRwQXQwsZOySlPeSHTYMvLp2aNFeXMbUPVhftUsNEXvgqPSQ0NCUBRor6UIx+PoO/PlvfXLgTT9NvNhPkNZRNWUinSQQCVXpJOWP1P/sHUdQjTmdZUfgfLb2eMpQRTPdFXLeEQwruaBRZHJ24O1b2LxFcTZxKX5DwSVpwPkb/N1TUJNztONsdRqu6XTDEK019YNoSW5bDPZo0MzPxPPrsShaYTnxGPsPERovDOMP/J4R9Q0vJTBiLVlNGUtKPTTNcVqfnSMv7QlOjUTN4VkbeNZiUW9spVuqLV5qfZHT/PmriXKfpJaTOU1jSWKhzSwPbJJgnP9gCK4RsLXAKSlM/SvhlXmdlXnFSUYLBQpowOOQKSMosVwgmTvJePosjS4PHLc2aPhRGWZbbLFhWQMviPsQsXkjXH03eNMynYcFGMFyTMju7IJ3xT6wILq2VYeDILij6Nbx2QMvZU8LRHj28I5xnWbdqXPR0RHsQJsymV3MhW6SfS3kMYGKTXuJMU+QKaAPLVdu3VWJTX5RNX7J0WZK7UBwPWJOtPheEY6IvWqOyWjHwV2IrV0KgYFJzY6HWTMrSYoSIVoI2IazbV4K1VzJcWZHiUyPRVvJwYmHDV6SjWgHfKau2UbuFKvky';
  }
};

// The building blocks of life (slides 9-12): a long DNA double helix coils up into the 23 chromosomes, genes on them
// give 25 protein chains that fold in the AlphaFold style, and those become a tiny patch in a field of about 20,000.
SETS.dna = function (K) {
  const { THREE, clamp, prog } = K;
  const set = K.newSet('dna');
  const PI = Math.PI, D2R = PI / 180;

  // ------------------------------------------------------------- helpers --
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const madd = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const { dot, cross } = K.v3, mix3 = K.v3.lerp;
  // (Math.hypot is slow, and these run hundreds of thousands of times at load)
  const len = a => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  const norm = a => { const l = 1 / (len(a) || 1); return [a[0] * l, a[1] * l, a[2] * l]; };
  const dist = (a, b) => { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); };
  // two unit vectors perpendicular to d, with u x v = d
  const basis = d => { const u = norm(cross(d, Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])); return [u, cross(d, u)]; };
  // rotate v about the unit axis k by angle a
  const rot = (v, k, a) => {
    const c = Math.cos(a), s = Math.sin(a), x = cross(k, v), d = dot(k, v) * (1 - c);
    return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d];
  };
  // the same rotation as a matrix (rows), for turning many points at once
  const rotM = (k, a) => [rot([1, 0, 0], k, a), rot([0, 1, 0], k, a), rot([0, 0, 1], k, a)];
  const mulM = (M, v) => [M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2], M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2], M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]];
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const X0 = [1, 0, 0], Y0 = [0, 1, 0], Z0 = [0, 0, 1];

  // A mesh under construction: typed float attributes by name (item sizes in sz) that grow as needed, and indices
  const mesh0 = (sz, nv, ni) => { const b = { sz, a: {}, cap: 0, nv: 0, idx: new Uint32Array(ni || 4096), ni: 0 }; grow(b, nv || 4096, 0); return b; };
  function grow(b, nv, ni) {
    if (b.nv + nv > b.cap) {
      let cap = Math.max(4096, b.cap * 2);
      while (cap < b.nv + nv) cap *= 2;
      for (const k in b.sz) { const a = new Float32Array(cap * b.sz[k]); if (b.a[k]) a.set(b.a[k]); b.a[k] = a; }
      b.cap = cap;
    }
    if (b.ni + ni > b.idx.length) { let c = b.idx.length * 2; while (c < b.ni + ni) c *= 2; const x = new Uint32Array(c); x.set(b.idx); b.idx = x; }
  }
  function geoOf(b) {
    const g = new THREE.BufferGeometry();
    for (const k in b.sz) g.setAttribute(k, new THREE.BufferAttribute(b.a[k].subarray(0, b.nv * b.sz[k]), b.sz[k]));
    g.setIndex(new THREE.BufferAttribute(b.nv > 65535 ? b.idx.subarray(0, b.ni) : Uint16Array.from(b.idx.subarray(0, b.ni)), 1));
    return g;
  }
  // set attribute k of vertices v0..v1-1 to the constant c
  const fill = (b, k, v0, v1, c) => { const a = b.a[k], s = b.sz[k]; for (let v = v0; v < v1; v++) for (let q = 0; q < s; q++) a[v * s + q] = c[q]; };
  const set3 = (a, v, x, y, z) => { a[3 * v] = x; a[3 * v + 1] = y; a[3 * v + 2] = z; };
  const tangents = C => C.map((p, i) => {
    const q = C[Math.min(i + 1, C.length - 1)], o = C[Math.max(i - 1, 0)], x = q[0] - o[0], y = q[1] - o[1], z = q[2] - o[2], l = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    return [x * l, y * l, z * l];
  });
  // ring normals along a curve by parallel transport, pulled towards targets G[i] with weights W[i] (for ribbons)
  function frames(C, T, G, W) {
    const N = [];
    let [nx, ny, nz] = basis(T[0])[0];
    for (let i = 0; i < C.length; i++) {
      const [tx, ty, tz] = T[i];
      let d = nx * tx + ny * ty + nz * tz;
      nx -= tx * d; ny -= ty * d; nz -= tz * d;
      let l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (l < 1e-6) [nx, ny, nz] = basis(T[i])[0]; else { nx /= l; ny /= l; nz /= l; }
      const g = G && W[i] > 0 && G[i];
      if (g) {
        d = g[0] * tx + g[1] * ty + g[2] * tz;
        let gx = g[0] - tx * d, gy = g[1] - ty * d, gz = g[2] - tz * d;
        l = Math.sqrt(gx * gx + gy * gy + gz * gz);
        if (l > 1e-6) {
          if (gx * nx + gy * ny + gz * nz < 0) l = -l;
          const w = W[i];
          gx = nx + (gx / l - nx) * w; gy = ny + (gy / l - ny) * w; gz = nz + (gz / l - nz) * w;
          l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
          nx = gx / l; ny = gy / l; nz = gz / l;
        }
      }
      N.push([nx, ny, nz]);
    }
    return N;
  }
  // sweep an elliptical ring of R vertices along centres C: half-axes AB[i] = [across (T x N), along N]; writes
  // position and normal, and put(v, i, j) the vertex's other attributes; returns the first vertex
  const RING = {};
  for (const R of [6, 8, 10]) RING[R] = [...Array(R).keys()].map(j => [Math.cos(2 * PI * j / R), Math.sin(2 * PI * j / R)]);
  function sweep(b, C, T, N, AB, R, put) {
    const m = C.length, base = b.nv, ring = RING[R];
    grow(b, m * R, (m - 1) * R * 6);
    const P = b.a.position, NN = b.a.normal, I = b.idx;
    for (let i = 0; i < m; i++) {
      const n = N[i], t = T[i], c0 = C[i], a = AB[i][0], e = AB[i][1];
      const wx = t[1] * n[2] - t[2] * n[1], wy = t[2] * n[0] - t[0] * n[2], wz = t[0] * n[1] - t[1] * n[0];
      for (let j = 0; j < R; j++) {
        const v = base + i * R + j, c = ring[j][0], s = ring[j][1];
        set3(P, v, c0[0] + (wx * a * c + n[0] * e * s), c0[1] + (wy * a * c + n[1] * e * s), c0[2] + (wz * a * c + n[2] * e * s));
        const nx = wx * e * c + n[0] * a * s, ny = wy * e * c + n[1] * a * s, nz = wz * e * c + n[2] * a * s, l = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        set3(NN, v, nx * l, ny * l, nz * l);
        if (put) put(v, i, j);
      }
    }
    let q = b.ni;
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < R; j++) {
      const a0 = base + i * R + j, a1 = base + i * R + (j + 1) % R;
      I[q++] = a0; I[q++] = a0 + R; I[q++] = a1; I[q++] = a1; I[q++] = a0 + R; I[q++] = a1 + R;
    }
    b.ni = q; b.nv += m * R;
    return base;
  }

  // A lit material whose vertices move in GLSL (onBeforeCompile on MeshStandardMaterial, so the scene's lights apply).
  // o: uniforms, head (vertex declarations), normal (replaces beginnormal: declare objectNormal and set dnaP),
  // fhead, fmain (start of the fragment main), emis (added emissive)
  function litMat(name, params, o) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.5, metalness: 0 }, params));
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, o.uniforms || {});
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + (o.head || ''))
        .replace('#include <beginnormal_vertex>', o.normal || '#include <beginnormal_vertex>\nvec3 dnaP = position;')
        .replace('#include <begin_vertex>', 'vec3 transformed = dnaP;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + (o.fhead || ''))
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + (o.fmain || ''))
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += vec3(0.12, 0.18, 0.3) * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
  ${o.emis || ''}`);
    };
    m.customProgramCacheKey = () => 'dna-' + name;
    K.fade(set, m, 1);
    return m;
  }
  const ROT_GLSL = 'vec3 dnaRot(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }\n';
  // 'chain order' colours as in structure viewers: the N-terminus blue, through green and yellow, to the C-terminus red
  const RB_GLSL = 'vec3 dnaRb(float u) { vec3 k = clamp(abs(mod(4.0 * (1.0 - u) + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return mix(vec3(1.0), k, 0.85) * 0.95; }\n';
  const uRb = { value: 0 };

  // ================================================================ DNA ====
  // B-DNA in proportion: radius 1 nm, 10.5 base pairs per turn of 3.4 nm; the strands sit 140° apart around the
  // axis, which opens the wide major and narrow minor grooves. The helix lies along x, from -3 to 3.
  const HX = { r: 0.16, rise: 0.0518, half: 3 };
  const NBP = Math.round(2 * HX.half / HX.rise), TW = 2 * PI / 10.5, GROOVE = 140 * D2R;
  const SEQ = [];
  { const r = K.rng(21); for (let i = 0; i < NBP; i++) SEQ.push(r() < 0.41 ? (r() < 0.5 ? 'G' : 'C') : (r() < 0.5 ? 'A' : 'T')); }
  const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
  const BASE = { A: K.rgb('#3ee08f'), T: K.rgb('#ff5a4b'), G: K.rgb('#ffb43b'), C: K.rgb('#4f9dff') };
  const BB = [K.rgb('#6f93cf'), K.rgb('#9180c8')];
  const bpX = i => -HX.half + (i + 0.5) * HX.rise;
  const hb = mesh0({ position: 3, normal: 3, color: 3, aS: 1, aB: 1 }, 13000, 51000);
  const hpts = K.pointsGeo(NBP * 2), hS = new Float32Array(NBP * 2);
  // the two sugar-phosphate backbones: glossy tubes
  for (let s = 0; s < 2; s++) {
    const C = [], AB = [];
    for (let k = 0; k <= NBP * 3; k++) {
      const u = k / 3, a = (u - 0.5) * TW + s * GROOVE;
      C.push([-HX.half + u * HX.rise, HX.r * Math.cos(a), HX.r * Math.sin(a)]); AB.push([0.024, 0.024]);
    }
    const T = tangents(C);
    sweep(hb, C, T, frames(C, T), AB, 10, v => { set3(hb.a.color, v, BB[s][0], BB[s][1], BB[s][2]); hb.a.aS[v] = Math.abs(hb.a.position[3 * v]) / HX.half; });
  }
  // a flat slab (a base) from p0 to p1, thickness h along up, width w; flat-shaded faces
  function slab(b, p0, p1, up, w, h, col, s) {
    const d = sub(p1, p0), side = mul(norm(cross(d, up)), w / 2), u = mul(norm(up), h / 2);
    const c = [];
    for (const e of [0, 1]) for (const y of [-1, 1]) for (const x of [-1, 1]) c.push(add(add(e ? p1 : p0, mul(side, x)), mul(u, y)));
    // faces as corner indices (counter-clockwise from outside) with normals
    const F = [[[0, 2, 3, 1], mul(norm(d), -1)], [[4, 5, 7, 6], norm(d)], [[0, 1, 5, 4], mul(norm(u), -1)], [[2, 6, 7, 3], norm(u)],
      [[0, 4, 6, 2], mul(norm(side), -1)], [[1, 3, 7, 5], norm(side)]];
    for (const [q, n] of F) {
      grow(b, 4, 6);
      const v = b.nv;
      q.forEach((k, z) => { b.a.position.set(c[k], 3 * (v + z)); b.a.normal.set(n, 3 * (v + z)); b.a.color.set(col, 3 * (v + z)); b.a.aS[v + z] = s; b.a.aB[v + z] = 1; });
      b.idx.set([v, v + 1, v + 2, v, v + 2, v + 3], b.ni);
      b.ni += 6; b.nv += 4;
    }
  }
  for (let i = 0; i < NBP; i++) {
    const x = bpX(i), a1 = i * TW, a2 = a1 + GROOVE, r = HX.r * 0.9;
    const e1 = [x, r * Math.cos(a1), r * Math.sin(a1)], e2 = [x, r * Math.cos(a2), r * Math.sin(a2)];
    const m = mix3(e1, e2, 0.5), g = mul(norm(sub(e2, e1)), 0.004), s = Math.abs(x) / HX.half;
    slab(hb, e1, sub(m, g), X0, 0.042, 0.017, BASE[SEQ[i]], s);
    slab(hb, e2, add(m, g), X0, 0.042, 0.017, BASE[PAIR[SEQ[i]]], s);
    for (let k = 0; k < 2; k++) {
      const a = k ? a2 : a1, j = 2 * i + k;
      hpts.attributes.position.array.set([x, HX.r * Math.cos(a), HX.r * Math.sin(a)], 3 * j);
      hpts.attributes.aCol.array.set(mix3(BB[k], [0.4, 0.7, 1], 0.5), 3 * j);
      hpts.attributes.aSize.array[j] = 0.11; hpts.attributes.aA.array[j] = 0.22; hS[j] = Math.abs(x) / HX.half;
    }
  }
  hpts.setAttribute('aS', new THREE.BufferAttribute(hS, 1));
  const uRev = { value: 1 }, uRead = { value: 0 }, uHv = { value: 1 };
  const hMat = litMat('helix', { roughness: 0.26, metalness: 0.05 }, {
    uniforms: { uRev, uRead, uHv },
    head: 'attribute float aS, aB; varying float vS, vX, vB;',
    normal: '#include <beginnormal_vertex>\nvec3 dnaP = position; vS = aS; vX = position.x; vB = aB;',
    fhead: 'uniform float uRev, uRead, uHv; varying float vS, vX, vB;',
    fmain: 'if (vS > uRev) discard;',
    // a soft self-glow (stronger on the thin base slabs, so the letters read by colour), a bright seam where the
    // helix is still being written (fading out as it completes), a glow that runs along it as if reading, and a
    // lift while it fades into the thread (so it goes as a light sheath, not dark smudges)
    emis: `totalEmissiveRadiance += diffuseColor.rgb * (0.12 + 0.3 * vB + 0.55 * exp(-pow((vX - uRead) / 0.35, 2.0)) + 0.6 * (1.0 - uHv))
    + vec3(0.7, 0.9, 1.0) * smoothstep(0.07, 0.0, uRev - vS) * (1.0 - smoothstep(0.93, 1.0, uRev));`,
  });
  const hg = new THREE.Group();
  const hMesh = new THREE.Mesh(geoOf(hb), hMat);
  // the halo fades with the helix (uHv)
  const hGlow = new THREE.Points(hpts, K.points(set, { uniforms: { uRev, uHv }, head: 'attribute float aS; uniform float uRev, uHv;', vertex: 'vA *= step(aS, uRev) * uHv;' }));
  // draw order of the see-through moments: the protein threads, then the chromosome thread, then the helix around it
  hMesh.renderOrder = 2; hGlow.renderOrder = 3;
  hg.add(hMesh, hGlow);
  set.group.add(hg);

  // ======================================================== chromosomes ====
  // lengths (Mb, GRCh38) and centromere position (fraction of the length from the tip of the short arm p)
  const CHR = [[248, .50], [242, .39], [198, .46], [190, .26], [181, .27], [171, .35], [159, .37], [145, .31], [138, .32],
    [134, .30], [135, .39], [133, .27], [114, .15], [107, .16], [102, .18], [90, .41], [83, .30], [80, .23], [59, .44],
    [64, .44], [47, .26], [51, .28], [156, .38]];
  const ROWS = [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9, 10, 11], [12, 13, 14, 15, 16, 17], [18, 19, 20, 21, 22]];
  const MB = 0.52 / 248, PITCH = 0.021, RC = 0.0155, RT = 0.0105, HW = 0.0275, SPACE = 0.265;
  const KAR = [];
  {
    let y = 0;
    const rows = ROWS.map(row => {
      const up = Math.max(...row.map(k => CHR[k][0] * MB * CHR[k][1])), dn = Math.max(...row.map(k => CHR[k][0] * MB * (1 - CHR[k][1])));
      y -= up; const yc = y; y -= dn + 0.1; return yc;
    });
    const top = 0, bottom = y + 0.1, shift = -(top + bottom) / 2;
    ROWS.forEach((row, rw) => row.forEach((k, j) => {
      const x = (j - (row.length - 1) / 2) * SPACE, yc = rows[rw] + shift;
      KAR[k] = { ctr: [x, yc, -0.22 * x * x], L: CHR[k][0] * MB, c: CHR[k][1] };
    }));
  }
  // spectral karyotyping paints each chromosome in its own colour
  const KCOL = CHR.map((_, k) => { const c = new THREE.Color().setHSL((0.55 + k * 0.618034) % 1, 0.62, 0.62); return [c.r, c.g, c.b]; });
  const cb = mesh0({ position: 3, normal: 3, color: 3, aP0: 3, aN0: 3, aC: 4, aPh: 1 }, 34000, 204000);
  {
    const total = 2 * CHR.reduce((s, c) => s + c[0], 0) * MB, sc = 2 * HX.half / total;
    let xc = -HX.half;
    const cr = K.rng(5);
    for (let k = 0; k < 23; k++) {
      const { ctr, L, c } = KAR[k], delay = 0.26 + 0.3 * k / 22, bow = (cr() - 0.5) * 0.04, lean = (cr() - 0.5) * 0.05;
      for (const side of [-1, 1]) {
        const seg = L * sc, x0 = xc; xc += seg;
        const turns = L / PITCH, m = Math.ceil(turns * 8) + 1, C = [], AB = [], CO = [], TR = [], lc = L * Math.max(c, 1 - c);
        for (let i = 0; i < m; i++) {
          const s = i / (m - 1), arm = Math.abs(s - c) * L, tip = Math.min(s, 1 - s) * L;
          // the sister chromatids splay apart towards their tips (in proportion to each arm, so small ones open too)
          const ax = side * (HW + (0.016 + 0.06 * L) * Math.pow(arm / lc, 1.5)) + lean * (c - s), az = bow * Math.sin(PI * s);
          const rc = RC * (1 - 0.5 * Math.exp(-((arm / 0.02) ** 2))) * Math.sqrt(clamp(tip / 0.018, 0.08, 1));
          const ph = side * 2 * PI * turns * s;
          C.push([ctr[0] + ax + rc * Math.cos(ph), ctr[1] + (c - s) * L, ctr[2] + az + rc * Math.sin(ph)]);
          const rt = RT * (0.55 + 0.45 * Math.sqrt(clamp(tip / 0.012, 0, 1)));
          AB.push([rt, rt]); TR.push(0.018 * (0.6 + 0.4 * Math.sqrt(clamp(tip / 0.01, 0, 1))));
          CO.push(mul(KCOL[k], 1 - 0.45 * Math.exp(-((arm / 0.03) ** 2))));
        }
        const T = tangents(C);
        // the uncoiled thread lies along the DNA's axis, each chromatid in its turn (a cord thick enough to read)
        const v0 = sweep(cb, C, T, frames(C, T), AB, 6, (v, i, j) => {
          const cs = RING[6][j][0], sn = RING[6][j][1];
          const co = CO[i]; set3(cb.a.color, v, co[0], co[1], co[2]); set3(cb.a.aP0, v, x0 + seg * i / (m - 1), TR[i] * sn, TR[i] * cs); set3(cb.a.aN0, v, 0, sn, cs);
        });
        fill(cb, 'aC', v0, cb.nv, [ctr[0], ctr[1], ctr[2], delay]); fill(cb, 'aPh', v0, cb.nv, [k * 1.7]);
      }
    }
  }
  const uC = { value: 0 }, uT = { value: 0 };
  const cMat = litMat('chrom', { roughness: 0.42 }, {
    uniforms: { uC, uT },
    head: 'attribute vec3 aP0, aN0; attribute vec4 aC; attribute float aPh; uniform float uC, uT;\n' +
      'vec3 dnaRotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }',
    // each chromosome coils up from the thread in its turn, flying a little towards you on the way, then sways
    normal: `float ck = smoothstep(aC.w, aC.w + 0.42, uC);
  float sw = 0.4 * sin(uT * 0.3 + aPh) * ck;
  vec3 dnaP = mix(aP0, aC.xyz + dnaRotY(position - aC.xyz, sw), ck) + vec3(0.0, 0.0, 0.35) * sin(3.14159 * ck);
  vec3 objectNormal = normalize(mix(aN0, dnaRotY(normal, sw), ck));`,
    emis: 'totalEmissiveRadiance += diffuseColor.rgb * 0.16;',
  });
  const cMesh = new THREE.Mesh(geoOf(cb), cMat);
  cMesh.frustumCulled = false; cMesh.renderOrder = 1;
  set.group.add(cMesh);
  // a point on chromosome k's axis, a fraction s from the tip of its short arm
  const onChrom = (k, s) => { const { ctr, L, c } = KAR[k]; return [ctr[0], ctr[1] + (c - s) * L, ctr[2]]; };

  // ============================================================ proteins ===
  // Chains are built as in real structures, in ångström: α-helices (3.6 residues per turn, 1.5 Å rise, Cα on a
  // 2.3 Å radius, right-handed), β-strands (3.3 Å per residue) in twisted sheets 4.8 Å apart, helices packed about
  // 10 Å from each other and from sheets, loops that bulge outwards, and floppy low-confidence tails.
  function helix(S, D, n, ph) {
    const [u, v] = basis(D), ca = [], ori = [];
    for (let i = 0; i < n; i++) {
      const a = ph + i * 100 * D2R, o = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
      ca.push(add(madd(S, D, 1.5 * i), mul(o, 2.3))); ori.push(o);
    }
    return { t: 'H', ca, ori };
  }
  const helixAt = (C, D, n, ph) => { D = norm(D); return helix(madd(C, D, -0.75 * (n - 1)), D, n, ph || 0); };
  function strandAt(C, D, n, N) {
    D = norm(D);
    const S = madd(C, D, -1.65 * (n - 1)), ca = [], ori = [];
    for (let i = 0; i < n; i++) { ca.push(madd(S, D, 3.3 * i)); ori.push(N); }
    return { t: 'E', ca, ori };
  }
  const Lp = (n, q, w) => ({ t: 'L', n, q, w });   // a loop of n residues (undefined: as many as it needs)
  const tails = (r, a, b, c, d) => [{ t: 'N', n: ri(r, a, b) }, { t: 'C', n: ri(r, c, d) }];
  const wrap = (els, tl) => [tl[0], ...els, tl[1]];
  // a twisted sheet along A with strands spaced along X: specs [{ p: position, d: ±1, n: residues }]
  // (β-sheets twist left-handed seen across the strands, about -18° per strand)
  function sheet(A, X, specs) {
    const Zs = cross(A, X);
    return specs.map(s => strandAt(mul(X, 4.8 * s.p), rot(mul(A, s.d), X, -18 * D2R * s.p), s.n || 5, rot(Zs, X, -18 * D2R * s.p)));
  }
  const moveEls = (els, f, fv) => els.map(e => (e.ca ? Object.assign({}, e, { ca: e.ca.map(f), ori: e.ori.map(fv) }) : e));
  const placeEls = (els, k, a, T) => moveEls(els, p => add(rot(p, k, a), T), v => rot(v, k, a));
  // bend elements along x around a centre Rb below (a curved helix or solenoid)
  const bendEls = (els, Rb) => els.map(e => (e.ca ? Object.assign({}, e, {
    ca: e.ca.map(p => add([0, -Rb, 0], rot([0, Rb + p[1], p[2]], Z0, -p[0] / Rb))), ori: e.ori.map((v, i) => v && rot(v, Z0, -e.ca[i][0] / Rb)) }) : e));
  const core = els => els.filter(e => e.ca);

  // α/β sheets: strands in chain order; a crossover between parallel strands runs through a helix on the face that
  // makes it right-handed (as in nearly all real proteins), neighbours with opposite directions get hairpins
  function sheetFold(r, specs, o = {}) {
    const A = Y0, X = X0, Zs = cross(A, X), sh = sheet(A, X, specs), els = [], used = { 1: [], '-1': [] };
    specs.forEach((s, k) => {
      if (k) {
        const p = specs[k - 1];
        if (s.d === p.d) {
          const face = -Math.sign(s.d * (s.p - p.p)) || 1;
          let hp = (s.p + p.p) / 2 + (r() - 0.5) * 0.3;
          for (let it = 0; it < 8 && used[face].some(u => Math.abs(u - hp) < 2.1); it++) hp += (it % 2 ? -1 : 1) * 1.1 * (it + 1);
          used[face].push(hp);
          const D = rot(mul(A, -s.d), Zs, (r() - 0.5) * 50 * D2R);
          els.push(Lp(), helixAt(add(mul(X, 4.8 * hp), mul(Zs, 10 * face)), D, ri(r, o.h0 || 10, o.h1 || 15), r() * 6), Lp());
        } else els.push(Lp(Math.abs(s.p - p.p) <= 1 ? ri(r, 2, 4) : undefined));
      }
      els.push(sh[k]);
    });
    return els;
  }
  const RECIPES = {
    // SRP9-like α-β-β-β-α: two helices packed on one face of a three-stranded antiparallel sheet
    abm(r, o = {}) {
      const Zs = cross(Y0, X0), sl = o.sl || [ri(r, 5, 7), ri(r, 6, 8), ri(r, 5, 7)];
      const sh = sheet(Y0, X0, [{ p: -1, d: 1, n: sl[0] }, { p: 0, d: -1, n: sl[1] }, { p: 1, d: 1, n: sl[2] }]);
      const h1 = helixAt(add(mul(X0, -5.3), mul(Zs, 10)), rot([0, -1, 0], Zs, 25 * D2R), o.h1 || ri(r, 12, 16), r() * 6);
      const h2 = helixAt(add(mul(X0, 5.3), mul(Zs, 10)), rot([0, -1, 0], Zs, -20 * D2R), o.h2 || ri(r, 13, 17), r() * 6);
      return wrap([h1, Lp(o.l1), sh[0], Lp(ri(r, 2, 3)), sh[1], Lp(ri(r, 2, 3)), sh[2], Lp(o.l2), h2], o.tl || tails(r, 0, 6, 0, 10));
    },
    // Rossmann-like: five parallel strands in the order 3-2-1-4-5, helices on both faces
    ross(r) {
      const n = () => ri(r, 4, 6);
      return wrap(sheetFold(r, [{ p: 0, d: 1, n: n() }, { p: -1, d: 1, n: n() }, { p: -2, d: 1, n: n() }, { p: 1, d: 1, n: n() }, { p: 2, d: 1, n: n() }]), tails(r, 0, 8, 0, 12));
    },
    // flavodoxin-like: parallel strands 2-1-3-4-5
    flav(r) {
      const n = () => ri(r, 4, 6);
      return wrap(sheetFold(r, [{ p: -1, d: 1, n: n() }, { p: -2, d: 1, n: n() }, { p: 0, d: 1, n: n() }, { p: 1, d: 1, n: n() }, { p: 2, d: 1, n: n() }]), tails(r, 2, 14, 0, 6));
    },
    // ferredoxin-like βαββαβ, antiparallel sheet 4-1-3-2, both helices on one face
    fdx(r) {
      const n = () => ri(r, 5, 7);
      return wrap(sheetFold(r, [{ p: -0.5, d: -1, n: n() }, { p: 1.5, d: -1, n: n() }, { p: 0.5, d: 1, n: n() }, { p: -1.5, d: 1, n: n() }], { h0: 11, h1: 15 }), tails(r, 0, 12, 0, 16));
    },
    // a mixed sheet: wander across 4-5 strand positions; jumps go through helices
    mix(r) {
      const m = ri(r, 4, 5), left = [...Array(m).keys()], specs = [];
      let p = left.splice(ri(r, 0, m - 1), 1)[0], d = 1;
      specs.push({ p, d, n: ri(r, 4, 7) });
      while (left.length) {
        const adj = left.filter(q => Math.abs(q - p) === 1);
        const q = adj.length && r() < 0.65 ? adj[ri(r, 0, adj.length - 1)] : left[ri(r, 0, left.length - 1)];
        left.splice(left.indexOf(q), 1);
        d = Math.abs(q - p) === 1 && r() < 0.8 ? -d : d; p = q;
        specs.push({ p, d, n: ri(r, 4, 7) });
      }
      specs.forEach(s => { s.p -= (m - 1) / 2; });
      const els = sheetFold(r, specs);
      if (r() < 0.5) els.unshift(helixAt([0, 0, -11], rot([1, 0, 0], Y0, (r() - 0.5) * 0.8), ri(r, 12, 18), 0), Lp());
      return wrap(els, tails(r, 0, 14, 0, 14));
    },
    // up-and-down helix bundles (three or four helices, slightly supercoiled)
    bun(r, o = {}) {
      const nH = o.n || ri(r, 3, 4), rad = nH === 3 ? 5.8 : 7.1, ln = o.len || ri(r, 15, 24), els = [];
      for (let k = 0; k < nH; k++) {
        const a = k * 2 * PI / nH, u = [Math.cos(a), 0, Math.sin(a)];
        if (k) els.push(Lp(ri(r, 2, 5)));
        els.push(helixAt(madd(mul(u, rad), Y0, (r() - 0.5) * 4), rot([0, k % 2 ? -1 : 1, 0], u, -14 * D2R), ln + ri(r, -3, 3), r() * 6));
      }
      return o.bare ? els : wrap(els, tails(r, 0, 14, 0, 18));
    },
    // globin-like all-α: 6-8 helices of different lengths around a core
    glob(r, o = {}) {
      const nH = o.n || ri(r, 6, 8), R = o.R || 9.5, cs = [], els = [];
      let u = K.unit(r), prevEnd = null;
      for (let k = 0; k < nH; k++) {
        if (k) {
          let best = u, bs = -1;
          for (let it = 0; it < 16; it++) {
            const c = rot(u, norm(cross(u, K.unit(r))), (62 + 25 * r()) * D2R);
            const s = Math.min(...cs.map(q => Math.acos(clamp(dot(q, c), -1, 1))));
            if (s > bs) { bs = s; best = c; }
          }
          u = best;
        }
        cs.push(u);
        const n = o.len ? ri(r, o.len[0], o.len[1]) : ri(r, 8, 19), c = mul(u, R), [t1, t2] = basis(u), a = r() * PI;
        let D = add(mul(t1, Math.cos(a)), mul(t2, Math.sin(a)));
        if (prevEnd && dist(madd(c, D, -0.75 * n), prevEnd) > dist(madd(c, D, 0.75 * n), prevEnd)) D = mul(D, -1);
        const h = helixAt(c, D, n, r() * 6);
        if (k) els.push(Lp());
        els.push(h); prevEnd = h.ca[n - 1];
      }
      return o.bare ? els : wrap(els, tails(r, 0, 10, 0, 12));
    },
    // Ig-like β-sandwich: two sheets packed face to face
    ig(r) {
      const Zs = cross(Y0, X0), A2 = rot(Y0, Zs, -30 * D2R), X2 = rot(X0, Zs, -30 * D2R);
      const seq = [[1, 1], [1, 0], [2, 0], [2, 1], [1, 2], [1, 3], [2, 2]], els = [];
      seq.forEach(([sh, p], k) => {
        const A = sh === 1 ? Y0 : A2, X = sh === 1 ? X0 : X2, ps = sh === 1 ? p - 1.5 : p - 1, z = sh === 1 ? 5 : -5;
        const d = k % 2 ? -1 : 1, n = ri(r, 6, 9), a = -18 * D2R * ps;
        if (k) els.push(Lp());
        els.push(strandAt(add(mul(X, 4.8 * ps), mul(Zs, -z)), rot(mul(A, d), X, a), n, rot(Zs, X, a)));
      });
      return wrap(els, tails(r, 0, 10, 0, 14));
    },
    // small β-barrel (SH3/OB-like): five strands on a cylinder, tilted
    bar(r) {
      const els = [];
      for (let k = 0; k < 5; k++) {
        const th = k * 72 * D2R, rad = [Math.cos(th), 0, Math.sin(th)];
        if (k) els.push(Lp(k === 3 ? undefined : ri(r, 2, 4)));
        els.push(strandAt(mul(rad, 7.5), rot([0, k % 2 ? -1 : 1, 0], rad, 40 * D2R), ri(r, 5, 8), rad));
      }
      if (r() < 0.5) els.push(Lp(), helixAt([0, -13, 2], [1, 0.2, 0.3], ri(r, 9, 13), 0));
      return wrap(els, tails(r, 0, 12, 0, 16));
    },
    // TIM barrel: eight parallel strands inside, eight helices outside, right-handed βα crossovers
    tim(r) {
      const els = [];
      for (let i = 0; i < 8; i++) {
        const th = -i * 45 * D2R, rad = [Math.cos(th), 0, Math.sin(th)], t2 = th - 22.5 * D2R, rad2 = [Math.cos(t2), 0, Math.sin(t2)];
        if (i) els.push(Lp());
        els.push(strandAt(mul(rad, 7.3), rot(Y0, rad, 36 * D2R), 5, rad), Lp(), helixAt(mul(rad2, 16.5), rot([0, -1, 0], rad2, -18 * D2R), ri(r, 11, 14), r() * 6));
      }
      return wrap(els, tails(r, 0, 8, 0, 10));
    },
    // α-solenoid (HEAT-like): stacked helix pairs, twisting and curving
    sol(r) {
      const k = ri(r, 5, 7), els = [];
      for (let j = 0; j < k; j++) {
        const x = 9.6 * (j - (k - 1) / 2), g = j * 14 * D2R, tw = p => rot(p, X0, g);
        if (j) els.push(Lp(ri(r, 3, 5)));
        els.push(helixAt(tw([x, 0, -5]), tw([0.15, 1, 0]), ri(r, 11, 14), r() * 6), Lp(ri(r, 2, 4)),
          helixAt(tw([x + 1.5, 0, 5]), tw([0.1, -1, 0]), ri(r, 11, 14), r() * 6));
      }
      return wrap(bendEls(els, 55), tails(r, 0, 10, 0, 14));
    },
    // seven transmembrane helices in a ring (receptor-like): N-terminus outside, a short helix 8 inside, then the tail
    tm7(r) {
      const els = [];
      for (let k = 0; k < 7; k++) {
        const th = (k * 360 / 7 + 10 * (r() - 0.5)) * D2R, u = [Math.cos(th), 0, Math.sin(th)];
        if (k) els.push(k === 5 ? Lp(ri(r, 10, 15), -25, 2) : Lp(ri(r, 3, 6)));
        els.push(helixAt([12 * u[0], 0, 9.5 * u[2]], rot([0, k % 2 ? 1 : -1, 0], u, (r() - 0.5) * 30 * D2R), ri(r, 21, 25), r() * 6));
      }
      const e = els[els.length - 1].ca, end = e[e.length - 1], out = norm([end[0], 0, end[2]]);
      els.push(Lp(3), helixAt(add(add(end, [0, -5, 0]), mul(cross(Y0, out), -7)), cross(Y0, out), ri(r, 9, 11), 0));
      return wrap(els, tails(r, 14, 26, 10, 22));
    },
    // C2H2 zinc fingers: β-hairpin plus helix, three or four in a row along a spiral
    znf(r) {
      const nf = ri(r, 3, 4), els = [];
      for (let j = 0; j < nf; j++) {
        const a = j * 100 * D2R, T = [10 * Math.cos(a), j * 11 - (nf - 1) * 5.5, 10 * Math.sin(a)];
        const f = [strandAt([-2.4, 2, 0], Y0, 3, Z0), Lp(2), strandAt([2.4, 2, 0], [0, -1, 0], 3, Z0), Lp(2), helixAt([1, 0, -8.5], [0.2, 1, 0.1], 12, r() * 6)];
        if (j) els.push(Lp(5, -10));
        els.push(...placeEls(f, Y0, a + PI / 2, T));
      }
      return wrap(els, tails(r, 6, 18, 4, 14));
    },
    // leucine-rich repeats: a horseshoe, parallel strands inside, helices outside
    lrr(r) {
      const n = ri(r, 9, 12), dp = 4.8 / 20, els = [];
      for (let j = 0; j < n; j++) {
        const p = (j - (n - 1) / 2) * dp, u = [Math.cos(p), Math.sin(p), 0], u2 = [Math.cos(p + dp / 2), Math.sin(p + dp / 2), 0];
        if (j) els.push(Lp(ri(r, 3, 4)));
        els.push(strandAt(mul(u, 20), Z0, 3, u), Lp(ri(r, 3, 4)), helixAt(mul(u2, 30), [0, 0, -1], ri(r, 6, 8), r() * 6));
      }
      return wrap(placeEls(els, Z0, 0, [-25, 0, 0]), tails(r, 0, 8, 0, 10));
    },
    // calmodulin-like dumbbell: two four-helix lobes joined by a long central helix
    cam(r) {
      const l1 = RECIPES.glob(r, { n: 4, R: 7, len: [9, 12], bare: true }), l2 = RECIPES.glob(r, { n: 4, R: 7, len: [9, 12], bare: true });
      const c = helixAt([0, 0, 0], [1, 0.1, 0], ri(r, 22, 28), 0);
      return wrap([...placeEls(l1, Y0, 0, [-28, -3, 0]), Lp(), c, Lp(), ...placeEls(l2, Y0, PI, [28, 3, 0])], tails(r, 0, 8, 0, 6));
    },
    // two helices in an antiparallel coiled-coil hairpin, with floppy ends
    cc(r) {
      const n = ri(r, 24, 32);
      return wrap([helixAt([-4.8, 0, 0], rot(Y0, Z0, 9 * D2R), n, 0), Lp(ri(r, 3, 5)), helixAt([4.8, 0, 0], rot([0, -1, 0], Z0, -9 * D2R), n, 1)], tails(r, 6, 20, 10, 28));
    },
    // two domains on a flexible linker
    two(r) {
      const a = RECIPES.bun(r, { n: 3, len: ri(r, 13, 17), bare: true });
      const b = r() < 0.5 ? RECIPES.abm(r).slice(1, -1) : RECIPES.bar(r).slice(1, -1);
      return wrap([...placeEls(a, K.unit(r), r() * 6, [-17, -2, 0]), Lp(ri(r, 9, 14), -30, 3), ...placeEls(b, K.unit(r), r() * 6, [17, 3, 2])], tails(r, 0, 12, 0, 12));
    },
    // mostly disordered, with a small folded core
    dis(r) {
      return wrap(RECIPES.bun(r, { n: 3, len: ri(r, 10, 13), bare: true }), tails(r, 24, 40, 20, 34));
    },
    // a single long, gently curved helix with floppy ends (GNG5-like)
    lhx(r, o = {}) {
      const n = o.n || ri(r, 30, 44);
      return wrap(bendEls([helixAt([0, 0, 0], X0, n, 0)], 70), o.tl || tails(r, 4, 12, 8, 22));
    },
  };
  // the long helix of GNG5 is surer in its middle than at its ends
  const confFns = {
    GNG5: (e, i, m) => (e.t === 'H' ? 1 - 18 * Math.pow(Math.abs(2 * i / (m - 1) - 1), 1.5) : 0),
  };

  // fill in loops and tails, and give every residue a confidence (pLDDT, 0-100) as AlphaFold would
  function loopPts(A, dA, B, dB, n, C, r, w) {
    const d = dist(A, B);
    n = Math.max(n === undefined ? Math.round(d / 3.4) + ri(r, 1, 2) : n, Math.ceil(d / 3.7) - 1, 1);
    const target = 3.8 * (n + 1), ch = norm(sub(B, A)), mid = mix3(A, B, 0.5);
    let out = sub(mid, C);
    out = sub(out, mul(ch, dot(out, ch)));
    out = len(out) < 1 ? basis(ch)[0] : norm(out);
    const h = Math.min(6, 0.25 * d + 2.5);
    // a cubic Bézier leaving A along dA and arriving at B along dB, bulged outwards until it is long enough
    const bez = (bulge, m) => {
      const P1 = madd(madd(A, dA, h), out, bulge), P2 = madd(madd(B, dB, -h), out, bulge), pts = [];
      for (let k = 0; k <= m; k++) {
        const t = k / m, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
        pts.push([a * A[0] + b * P1[0] + c * P2[0] + e * B[0], a * A[1] + b * P1[1] + c * P2[1] + e * B[1], a * A[2] + b * P1[2] + c * P2[2] + e * B[2]]);
      }
      return pts;
    };
    let bulge = 0;
    for (let it = 0; it < 16; it++) {
      const q = bez(bulge, 12);
      let L = 0; for (let k = 1; k < q.length; k++) L += dist(q[k], q[k - 1]);
      if (L >= target * 0.96) break;
      bulge += Math.max(1.2, (target - L) * 0.45);
    }
    const pts = bez(bulge, 24);
    // resample n points at equal arc length strictly between A and B
    const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + dist(pts[k], pts[k - 1]));
    const out2 = [];
    for (let k = 1, j = 1; k <= n; k++) {
      const s = cum[cum.length - 1] * k / (n + 1);
      while (cum[j] < s && j < cum.length - 1) j++;
      const f = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
      out2.push(madd(mix3(pts[j - 1], pts[j], f), K.unit(r), (0.35 + w) * r()));
    }
    return out2;
  }
  function tailPts(P, dir, n, C, Rc, r) {
    const pts = [], turn = 0.2 + 0.25 * r();
    let p = P, d = norm(add(norm(dir), norm(sub(P, C)))), ax = K.unit(r);
    for (let i = 0; i < n; i++) {
      ax = norm(madd(ax, K.unit(r), 0.7));
      d = rot(d, ax, turn);
      const o = sub(p, C), ro = len(o);
      if (ro > Rc + 11) d = norm(madd(d, o, -0.9 / ro));
      else if (ro < Rc * 0.85) d = norm(madd(d, o, 1.0 / ro));
      p = madd(p, d, 3.8); pts.push(p);
    }
    return pts;
  }
  const startDir = e => (e.t === 'H' ? norm(sub(e.ca[Math.min(4, e.ca.length - 1)], e.ca[0])) : norm(sub(e.ca[e.ca.length - 1], e.ca[0])));
  const endDir = e => (e.t === 'H' ? norm(sub(e.ca[e.ca.length - 1], e.ca[Math.max(0, e.ca.length - 5)])) : norm(sub(e.ca[e.ca.length - 1], e.ca[0])));
  function chain(els, r, o = {}) {
    const cs = core(els);
    let C = [0, 0, 0], cnt = 0, Rc = 0;
    for (const e of cs) for (const p of e.ca) { C = add(C, p); cnt++; }
    C = mul(C, 1 / cnt);
    for (const e of cs) for (const p of e.ca) Rc = Math.max(Rc, dist(p, C));
    const ca = [], ss = [], ori = [], pl = [], q0 = o.q || 0, cf = o.cf || (() => 0);
    els.forEach((e, k) => {
      if (e.ca) {
        const m = e.ca.length;
        e.ca.forEach((p, i) => { ca.push(p); ss.push(e.t); ori.push(e.ori[i]); pl.push((i === 0 || i === m - 1 ? 84 + 8 * r() : 90 + 7 * r()) + q0 + cf(e, i, m)); });
      } else if (e.t === 'L') {
        const a = els[k - 1], b = els[k + 1], pts = loopPts(a.ca[a.ca.length - 1], endDir(a), b.ca[0], startDir(b), e.n, C, r, e.w || 0), m = pts.length;
        pts.forEach((p, i) => {
          const mid = Math.sin(PI * (i + 1) / (m + 1)) * clamp((m - 4) / 9, 0, 1);
          ca.push(p); ss.push('L'); ori.push(null); pl.push(87 + 6 * r() - 26 * mid + (e.q || 0) + q0);
        });
      }
    });
    const tail = (e, P, d) => tailPts(P, d, e.n, C, Rc, r).map((p, i) => [p, 70 - 44 * Math.pow((i + 1) / e.n, 0.8) + 8 * (r() - 0.5) + q0 * 0.5]);
    const f = els[0], l = els[els.length - 1];
    if (f.t === 'N' && f.n > 0) {
      const t = tail(f, ca[0], mul(startDir(cs[0]), -1)).reverse();
      ca.unshift(...t.map(x => x[0])); pl.unshift(...t.map(x => x[1])); ss.unshift(...t.map(() => 'L')); ori.unshift(...t.map(() => null));
    }
    if (l.t === 'C' && l.n > 0) {
      const t = tail(l, ca[ca.length - 1], endDir(cs[cs.length - 1]));
      ca.push(...t.map(x => x[0])); pl.push(...t.map(x => x[1])); ss.push(...t.map(() => 'L')); ori.push(...t.map(() => null));
    }
    return { ca, ss, ori, pl: pl.map(v => clamp(v, 20, 98)) };
  }

  // the 25 chains of the grid: three real proteins (in the shape of their AlphaFold models), then 22 illustrative folds
  function srp9(r) {   // 86 residues
    return chain(RECIPES.abm(r, { sl: [7, 8, 7], h1: 17, h2: 18, l1: 4, l2: 5, tl: [{ t: 'N', n: 2 }, { t: 'C', n: 12 }] }), r);
  }
  function lenep(r) {   // 61 residues (UniProt Q9Y5L5), mostly disordered: two short helices of low confidence
    const h1 = helixAt([-6, 2, 0], [1, 0.3, 0.2], 12, 0), h2 = helixAt([6, -5, 4], [-0.2, 1, 0.4], 9, 1);
    h1.q = -28; h2.q = -22;
    return chain([{ t: 'N', n: 19 }, h1, Lp(9, -32, 2.5), h2, { t: 'C', n: 12 }], r, { cf: e => e.q || 0 });
  }
  function gng5(r) {   // 68 residues: one long helix with floppy ends
    return chain(RECIPES.lhx(r, { n: 38, tl: [{ t: 'N', n: 9 }, { t: 'C', n: 21 }] }), r, { cf: confFns.GNG5 });
  }
  const GRID_KINDS = ['tim', 'bun', 'ig', 'tm7', 'ross', 'cc', 'lrr', 'glob', 'bar', 'sol', 'fdx', 'znf', 'cam', 'mix', 'two',
    'flav', 'dis', 'glob', 'ig', 'mix', 'bar', 'bun'];
  const NAMES = ['SRP9', 'LENEP', 'GNG5'];
  const GENES = [[0, 0.907], [0, 0.622], [0, 0.34]];   // all three on chromosome 1: 1q42.12, 1q21.3, 1p22.3
  const folds = [srp9(K.rng(901)), lenep(K.rng(902)), gng5(K.rng(903))];
  GRID_KINDS.forEach((k, i) => { const r = K.rng(1000 + i * 17); folds.push(chain(RECIPES[k](r), r, { q: r() < 0.3 ? -6 : 0 })); });
  const MINI_KINDS = ['tim', 'bun', 'ig', 'tm7', 'ross', 'cc', 'lrr', 'glob', 'bar', 'sol', 'fdx', 'znf', 'cam', 'mix', 'two', 'flav', 'dis', 'abm', 'lhx'];

  // AlphaFold confidence colours: very high, confident, low, very low
  const AF = ['#0053d6', '#65cbf3', '#ffdb13', '#ff7d45'].map(K.rgb);
  const afCol = p => AF[p >= 90 ? 0 : p >= 70 ? 1 : p >= 50 ? 2 : 3];
  // centre on the confident core and size to fit; returns a copy turned by the rotation (k, a)
  function fit(ch, target, k, a) {
    if (!ch.fit) {
      let C = [0, 0, 0], n = 0;
      ch.ca.forEach((p, i) => { if (ch.pl[i] >= 70) { C = add(C, p); n++; } });
      C = mul(C, 1 / Math.max(n, 1));
      const ds = ch.ca.map(p => dist(p, C)).sort((x, y) => x - y), R90 = ds[Math.floor(ds.length * 0.9)], Rm = ds[ds.length - 1];
      ch.fit = { C, s: Math.min(1 / R90 * Math.pow(R90 / 22, 0.3), 1.25 / Rm) };
    }
    const [cx, cy, cz] = ch.fit.C, M = rotM(k, a);
    return { ca: ch.ca.map(p => mulM(M, [p[0] - cx, p[1] - cy, p[2] - cz])), ori: ch.ori.map(v => v && mulM(M, v)), ss: ch.ss, pl: ch.pl, s: ch.fit.s * target };
  }
  // the cartoon: samples along a Catmull-Rom spline through the Cα atoms with ribbon targets, half-axes and colours
  const PROF = { H: [1.5, 0.38, 1], E: [1.6, 0.38, 1], L: [0.5, 0.5, 0] };   // half-axes in Å, and ribbon or not
  const crs = (P, i, f) => {
    const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[Math.min(i + 1, P.length - 1)], p3 = P[Math.min(i + 2, P.length - 1)], f2 = f * f, f3 = f2 * f;
    const q = k => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * f3);
    return [q(0), q(1), q(2)];
  };
  function cartoon(ch, sh, so, sc) {
    const n = ch.ca.length, xs = [], ends = [];
    for (let i = 0; i < n; i++) if (ch.ss[i] === 'E' && ch.ss[i + 1] !== 'E') ends.push(i);
    for (let i = 0; i < n - 1; i++) {
      const m = ch.ss[i] === 'H' || ch.ss[i + 1] === 'H' ? sh : so;
      for (let j = 0; j < m; j++) xs.push(i + j / m);
    }
    xs.push(n - 1);
    for (const e of ends) if (e >= 1.05) xs.push(e - 1.04);   // a crisp arrow base
    xs.sort((a, b) => a - b);
    for (let i = xs.length - 1; i > 0; i--) if (xs[i] - xs[i - 1] < 0.01) xs.splice(i, 1);
    const C = [], G = [], W = [], AB = [], COL = [];
    for (const x of xs) {
      const i = Math.min(Math.floor(x), n - 2), f = x - i, a = PROF[ch.ss[i]], b = PROF[ch.ss[i + 1]], c = crs(ch.ca, i, f);
      C.push([c[0] * sc, c[1] * sc, c[2] * sc]);
      const oa = ch.ori[i], ob = ch.ori[i + 1];
      G.push(oa && ob ? mix3(oa, ob, f) : oa || ob);
      W.push((a[2] ? 1 - f : 0) + (b[2] ? f : 0));
      let ab0 = a[0] + (b[0] - a[0]) * f, ab1 = a[1] + (b[1] - a[1]) * f;
      for (const e of ends) if (x >= e - 1 && x <= e + 0.6) { const u = (x - e + 1) / 1.6; ab0 = 2.5 + (0.5 - 2.5) * u; ab1 = 0.38 + 0.12 * u; }
      AB.push([ab0 * sc, ab1 * sc]);
      COL.push(afCol(ch.pl[Math.round(x)]));
    }
    return { C, G, W, AB, COL, xs };
  }

  // ---- the 5 x 5 grid, on a gently curved wall facing +z
  const GRID = 0.42, FOLD_N = 25;
  const gridAt = k => { const x = (k % 5 - 2) * GRID, y = (2 - Math.floor(k / 5)) * GRID; return [x, y, -0.14 * (x * x + y * y)]; };
  const gb = mesh0({ position: 3, normal: 3, color: 3, aP0: 3, aN0: 3, aG: 3, aCtr: 3, aSpin: 4, aK: 2, aU: 1 }, 64000, 380000);
  const geneOf = [];
  {
    const gr = K.rng(77), tot = CHR.reduce((s, c) => s + c[0], 0);
    for (let k = 0; k < FOLD_N; k++) {
      let g = GENES[k];
      if (!g) { let x = gr() * tot, c = 0; while (x > CHR[c][0]) x -= CHR[c++][0]; g = [c, 0.05 + 0.9 * gr()]; }
      geneOf.push(onChrom(g[0], g[1]));
    }
  }
  folds.slice(0, FOLD_N).forEach((ch, k) => {
    const r = K.rng(300 + k), ctr = gridAt(k);
    // turn each chain to show its best side; the three named ones are set by hand
    const turn = [[[0, 1, 0], 0.5], [[1, 0, 0], 0.4], [[0, 0, 1], 0.6]][k] || [K.unit(r), r() * 6];
    const f = fit(ch, 0.165, turn[0], turn[1]), s = f.s, cart = cartoon(f, 3, 2, s), C = cart.C, AB = cart.AB, T = tangents(C), N = frames(C, T, cart.G, cart.W);
    const spin = norm([(r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3]), sp = (0.1 + 0.1 * r()) * (r() < 0.5 ? -1 : 1);
    // (the last chain leaves its gene before the chromosomes fade, at dna_fold 0.36)
    const delay = 0.04 + 0.3 * k / (FOLD_N - 1), ph = r() * 6;
    // the unfolded chain: a thin wavy thread at its gene, about to fold
    const n = f.ca.length, Lu = 0.12 + 0.18 * Math.sqrt(n / 120), du = norm([1, (r() - 0.5) * 0.6, (r() - 0.5) * 0.4]), [w1, w2] = basis(du), rr = 0.5 * s;
    const U0 = cart.xs.map(x => { x /= n - 1; return add(madd(mul(du, (x - 0.5) * Lu), w1, 0.012 * Math.sin(x * 19 + k)), mul(w2, 0.01 * Math.cos(x * 13 + k))); });
    const O = RING[8].map(([cs, sn]) => add(mul(w1, cs), mul(w2, sn)));
    const v0 = sweep(gb, C, T, N, AB, 8, (v, i, j) => {
      const u = U0[i], o = O[j];
      const co = cart.COL[i]; set3(gb.a.color, v, co[0], co[1], co[2]); set3(gb.a.aP0, v, u[0] + o[0] * rr, u[1] + o[1] * rr, u[2] + o[2] * rr); set3(gb.a.aN0, v, o[0], o[1], o[2]);
      gb.a.aU[v] = cart.xs[i] / (n - 1);
    });
    fill(gb, 'aG', v0, gb.nv, geneOf[k]); fill(gb, 'aCtr', v0, gb.nv, ctr); fill(gb, 'aSpin', v0, gb.nv, [...spin, sp]); fill(gb, 'aK', v0, gb.nv, [delay, ph]);
  });
  const uF = { value: 0 }, uFld = { value: 0 };
  const fMat = litMat('fold', { roughness: 0.48 }, {
    uniforms: { uF, uT, uFld, uRb },
    head: 'attribute vec3 aP0, aN0, aG, aCtr; attribute vec4 aSpin; attribute vec2 aK; attribute float aU; uniform float uF, uT, uRb;\n' + ROT_GLSL + RB_GLSL,
    // threads grow out of their genes, fly to their places and fold, slowly turning
    normal: `float fk = smoothstep(aK.x, aK.x + 0.5, uF);
  float gr = smoothstep(aK.x * 0.3, aK.x * 0.3 + 0.08, uF);
  float ang = aK.y + uT * aSpin.w;
  vec3 dnaP = mix(aG + aP0 * gr, aCtr + dnaRot(position, aSpin.xyz, ang), fk) + vec3(0.0, 0.0, 0.3) * sin(3.14159 * fk);
  vec3 objectNormal = normalize(mix(aN0, dnaRot(normal, aSpin.xyz, ang), fk));
  #ifdef USE_COLOR
  vColor = mix(vec3(0.85, 0.9, 1.0), mix(vColor, dnaRb(aU), uRb), smoothstep(0.35, 0.9, fk));
  #endif`,
    fhead: 'uniform float uFld;',
    emis: 'totalEmissiveRadiance += diffuseColor.rgb * (0.22 + 0.5 * uFld);',
  });
  const fMesh = new THREE.Mesh(geoOf(gb), fMat);
  fMesh.frustumCulled = false;
  set.group.add(fMesh);

  // ================================================================ field ==
  // About 20,000 proteins: the 25, 40 more as small cartoons near the camera's path, 200 as chains of Cα beads,
  // and the rest as points, further and further out. A tunnel along the field views keeps the grid in sight.
  const FAZ = 12, FEL = 8;
  const fdir = az => [Math.cos(FEL * D2R) * Math.sin(az * D2R), Math.sin(FEL * D2R), Math.cos(FEL * D2R) * Math.cos(az * D2R)];
  const inTunnel = (p, rad) => {
    const az = clamp(Math.atan2(p[0], p[2]) / D2R, FAZ - 8, FAZ + 24), d = fdir(az), al = dot(p, d);
    if (al <= 0) return false;
    const x = p[0] - d[0] * al, y = p[1] - d[1] * al, z = p[2] - d[2] * al, q = rad + 0.05 * al;
    return x * x + y * y + z * z < q * q;
  };
  const inGrid = p => Math.abs(p[0]) < 1.45 && Math.abs(p[1]) < 1.45 && Math.abs(p[2]) < 0.75;
  const reveal = rad => 0.92 * Math.pow(clamp((rad - 1.5) / 13, 0, 1), 0.75);
  const fr = K.rng(4242), placed = [];
  function spot(r0, r1, pw, tun, gap) {
    for (let it = 0; it < 400; it++) {
      const p = mul(K.unit(fr), r0 + (r1 - r0) * Math.pow(fr(), pw));
      if (inGrid(p) || inTunnel(p, tun) || placed.some(q => dist(p, q) < gap)) continue;
      placed.push(p); return p;
    }
    return mul(K.unit(fr), r1 + 2);
  }
  // mini cartoons (merged into one mesh; each one a different fold)
  const MINI_N = 32, BEAD_N = 200, FIELD_N = 20000;
  const mb = mesh0({ position: 3, normal: 3, color: 3, aCtr: 3, aSpin: 4, aK: 2, aU: 1 }, 48000, 280000);
  const traces = folds.slice(0, FOLD_N);
  for (let k = 0; k < MINI_N; k++) {
    const r = K.rng(5000 + k * 31), kind = MINI_KINDS[ri(r, 0, MINI_KINDS.length - 1)], ch = chain(RECIPES[kind](r), r, { q: r() < 0.3 ? -8 : 0 });
    traces.push(ch);
    const f = fit(ch, 0.165, K.unit(r), r() * 6), cart = cartoon(f, 2, 1, f.s), C = cart.C, AB = cart.AB, T = tangents(C), N = frames(C, T, cart.G, cart.W);
    const ctr = spot(1.75, 3.9, 0.8, 1.6, 0.55), spin = K.unit(r), sp = (0.08 + 0.1 * r()) * (r() < 0.5 ? -1 : 1), th = reveal(len(ctr)), ph = r() * 6;
    const v0 = sweep(mb, C, T, N, AB, 6, (v, i) => { const co = cart.COL[i]; set3(mb.a.color, v, co[0], co[1], co[2]); mb.a.aU[v] = cart.xs[i] / (f.ca.length - 1); });
    fill(mb, 'aCtr', v0, mb.nv, ctr); fill(mb, 'aSpin', v0, mb.nv, [...spin, sp]); fill(mb, 'aK', v0, mb.nv, [th, ph]);
  }
  const mMat = litMat('mini', { roughness: 0.5 }, {
    uniforms: { uFld, uT, uRb },
    head: 'attribute vec3 aCtr; attribute vec4 aSpin; attribute vec2 aK; attribute float aU; uniform float uFld, uT, uRb;\n' + ROT_GLSL + RB_GLSL,
    normal: `float ang = aK.y + uT * aSpin.w, gv = smoothstep(aK.x, aK.x + 0.07, uFld);
  vec3 dnaP = aCtr + dnaRot(position, aSpin.xyz, ang) * gv;
  vec3 objectNormal = dnaRot(normal, aSpin.xyz, ang);
  #ifdef USE_COLOR
  vColor = mix(vColor, dnaRb(aU), uRb);
  #endif`,
    emis: 'totalEmissiveRadiance += diffuseColor.rgb * 0.22;',
  });
  const mMesh = new THREE.Mesh(geoOf(mb), mMat);
  mMesh.frustumCulled = false;
  set.group.add(mMesh);
  // Cα bead chains, then single points
  const beadOf = k => traces[(k * 7) % traces.length];
  const nBeads = (() => { let s = 0; for (let k = 0; k < BEAD_N; k++) s += beadOf(k).ca.length; return s; })();
  const FAR_N = FIELD_N - FOLD_N - MINI_N - BEAD_N;
  const pg = K.pointsGeo(nBeads + FAR_N);
  const pCtr = new Float32Array((nBeads + FAR_N) * 3), pSpin = new Float32Array((nBeads + FAR_N) * 4), pK = new Float32Array((nBeads + FAR_N) * 2);
  const pU = new Float32Array(nBeads + FAR_N).fill(-1);   // place along the chain (beads), -1 for single points
  {
    const P = pg.attributes.position.array, Cc = pg.attributes.aCol.array, Sz = pg.attributes.aSize.array, Aa = pg.attributes.aA.array;
    let o = 0;
    for (let k = 0; k < BEAD_N; k++) {
      const r = K.rng(7000 + k), ch = beadOf(k), f = fit(ch, 0.165, K.unit(r), r() * 6);
      const ctr = spot(2.6, 7.5, 0.9, 1.6, 0.45), spin = K.unit(r), sp = (0.08 + 0.1 * r()) * (r() < 0.5 ? -1 : 1), th = reveal(len(ctr)), ph = r() * 6;
      f.ca.forEach((p, i) => {
        set3(P, o, p[0] * f.s, p[1] * f.s, p[2] * f.s); Cc.set(afCol(f.pl[i]), 3 * o); Sz[o] = 0.034; Aa[o] = 0.75;
        pCtr.set(ctr, 3 * o); pSpin.set(spin, 4 * o); pSpin[4 * o + 3] = sp; pK[2 * o] = th; pK[2 * o + 1] = ph; pU[o] = i / (f.ca.length - 1); o++;
      });
    }
    // the rest: one point each, coloured by the share of confident structure
    for (let k = 0; k < FAR_N; k++, o++) {
      let p, rad;
      for (let it = 0; it < 30; it++) { rad = 3.4 + 11.5 * Math.pow(fr(), 1.25); p = mul(K.unit(fr), rad); if (!inTunnel(p, 1.5) && !inGrid(p)) break; }
      const u = fr(), c = AF[u < 0.5 ? 0 : u < 0.8 ? 1 : u < 0.92 ? 2 : 3], b = 0.65 + 0.35 * fr();
      set3(pCtr, o, p[0], p[1], p[2]); set3(Cc, o, c[0] * b, c[1] * b, c[2] * b); Sz[o] = 0.06 + 0.08 * fr(); Aa[o] = 0.6;
      pSpin[4 * o + 1] = 1; pK[2 * o] = reveal(rad);
    }
  }
  pg.setAttribute('aCtr', new THREE.BufferAttribute(pCtr, 3));
  pg.setAttribute('aSpin', new THREE.BufferAttribute(pSpin, 4));
  pg.setAttribute('aK', new THREE.BufferAttribute(pK, 2));
  pg.setAttribute('aU', new THREE.BufferAttribute(pU, 1));
  const pMat = K.points(set, {
    uniforms: { uFld, uT, uRb },
    head: 'attribute vec3 aCtr; attribute vec4 aSpin; attribute vec2 aK; attribute float aU; uniform float uFld, uT, uRb;\n' + ROT_GLSL + RB_GLSL,
    // appear outwards with the zoom, and fade where they would pass right by the eye
    vertex: `if (aU >= 0.0) vC = mix(vC, dnaRb(aU), uRb);
  pos = aCtr + dnaRot(position, aSpin.xyz, aK.y + uT * aSpin.w);
  mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);
  vA *= smoothstep(aK.x, aK.x + 0.07, uFld) * smoothstep(1.0, 4.0, -mv.z);`,
  });
  const pts = new THREE.Points(pg, pMat);
  pts.frustumCulled = false; pts.renderOrder = 2;
  set.group.add(pts);

  // a glowing frame marks the 25 as a patch in the field
  const FR = 2 * GRID + 0.27, frg = K.linesGeo(40);
  {
    const zc = (x, y) => -0.14 * (x * x + y * y) + 0.02, P = frg.attributes.position.array, Cl = frg.attributes.aCol.array;
    let o = 0;
    for (let e = 0; e < 4; e++) for (let k = 0; k < 10; k++) {
      const q = [k / 10, (k + 1) / 10].map(u => { const a = -FR + 2 * FR * u; return [[a, -FR], [FR, a], [-a, FR], [-FR, -a]][e]; });
      for (const [x, y] of q) { set3(P, o, x, y, zc(x, y)); set3(Cl, o, 0.27, 0.85, 1); frg.attributes.aT.array[o] = (e * 10 + k + 1) / 40; frg.attributes.aA.array[o] = 0.7; o++; }
    }
  }
  const frm = K.lines(set);
  const frame = new THREE.LineSegments(frg, frm);
  frame.renderOrder = 2;
  set.group.add(frame);

  // =============================================================== update ==
  const cur = { rot: 0, sq: 1 };   // the helix's turn and squeeze, for the base-pair anchor
  function update(S, t) {
    // the proteins count as folded in the field look too (explore can ease params in any order)
    const f = Math.max(S.dna_fold, S.dna_field), a = set.uA.value;
    uT.value = t; uC.value = S.dna_chrom; uF.value = f; uFld.value = S.dna_field;
    // the helix writes itself from the middle outwards, turns slowly, and thins into a thread as it coils up
    const hv = S.dna_helix > 0.001 ? (1 - prog(S.dna_chrom, 0.17, 0.3)) * (1 - prog(f, 0, 0.12)) : 0;
    // the chromosomes stay until the last protein thread has left its gene
    const cv = prog(S.dna_chrom, 0.1, 0.24) * (1 - prog(f, 0.36, 0.7));
    uRev.value = S.dna_helix * 1.03; uRead.value = (t * 0.7) % 9 - 4.5; uHv.value = hv; uRb.value = S.dna_rainbow || 0;
    // (squeezed onto the chromosome thread, which it hands over to)
    cur.rot = -t * 0.22; cur.sq = 1 - 0.84 * prog(S.dna_chrom, 0, 0.3);
    hg.rotation.x = cur.rot; hg.scale.set(1, cur.sq, cur.sq);
    hg.visible = hv > 0.003;
    hMat.opacity = a * hv;
    cMesh.visible = cv > 0.003; cMat.opacity = a * cv;
    fMesh.visible = f > 0.001;
    mMesh.visible = pts.visible = S.dna_field > 0.001;
    frame.visible = S.dna_field > 0.15; frm.uniforms.uReveal.value = prog(S.dna_field, 0.15, 0.6);
    // solid shapes write depth (so they never show their insides) unless they are fading out on their own, when
    // they would cut what lies inside them (the thread in the helix, the protein threads in the chromosomes)
    fMat.depthWrite = mMat.depthWrite = a > 0.3;
    hMat.depthWrite = a > 0.3 && hv > 0.7;
    cMat.depthWrite = a > 0.3 && cv > 0.7;
  }

  // ============================================================== exports ==
  const top = k => { const { ctr, L, c } = KAR[k]; return [ctr[0] + 0.04, ctr[1] + c * L + 0.01, ctr[2]]; };
  const cell = k => { const c = gridAt(k); return [c[0] - 0.15, c[1] + 0.19, c[2]]; };
  const anchors = {
    helix: [0.6, 0.2, 0],
    // a base pair near the middle, as the helix turns
    bp: () => {
      const i = Math.round(NBP / 2) + 4, x = bpX(i), a1 = i * TW, r = HX.r * 0.9 * cur.sq;
      const y = r * (Math.cos(a1) + Math.cos(a1 + GROOVE)) / 2, z = r * (Math.sin(a1) + Math.sin(a1 + GROOVE)) / 2, c = Math.cos(cur.rot), s = Math.sin(cur.rot);
      return [x, y * c - z * s, y * s + z * c];
    },
    // chromosome 21's label floats above it, clear of X's long short arm, so it covers neither 22 nor X
    chrom1: top(0), chrom21: [KAR[20].ctr[0] - 0.03, KAR[22].ctr[1] + KAR[22].c * KAR[22].L + 0.085, KAR[20].ctr[2]], chromX: top(22),
    fold0: cell(0), fold1: cell(1), fold2: cell(2),
    karyotype: [0, 0, 0], grid: [0, 0, 0],
    field: [3.4, 2.4, 0.5],
  };
  for (let k = 0; k < 23; k++) anchors['chr' + (k < 22 ? k + 1 : 'X')] = KAR[k].ctr.slice();
  for (let k = 0; k < FOLD_N; k++) anchors['p' + k] = gridAt(k);
  const inFold = S => K.prog(Math.max(S.dna_fold, S.dna_field), 0.85, 1) * (1 - K.prog(S.dna_field, 0, 0.25));
  const inChrom = S => K.prog(S.dna_chrom, 0.85, 1) * (1 - K.prog(Math.max(S.dna_fold, S.dna_field), 0, 0.1));
  return Object.assign(set, {
    params: { dna_a: 1, dna_helix: 1, dna_chrom: 0, dna_fold: 0, dna_field: 0, dna_rainbow: 0 },
    update,
    anchors,
    labels: [
      { text: ['Base pair', 'A–T or G–C'], at: 'bp', cls: 'amb', alpha: S => K.prog(S.dna_helix, 0.9, 1) * (1 - K.prog(S.dna_chrom, 0, 0.1)) },
      { text: ['Chromosome 1', '248 million base pairs'], at: 'chrom1', cls: 'cyn', alpha: inChrom },
      { text: ['Chromosome 21', 'smallest, 47 million'], at: 'chrom21', cls: 'cyn', alpha: inChrom },
      { text: ['SRP9', ''], at: 'fold0', cls: 'cyn', alpha: inFold },
      { text: ['LENEP', ''], at: 'fold1', cls: 'cyn', alpha: inFold },
      { text: ['GNG5', ''], at: 'fold2', cls: 'cyn', alpha: inFold },
      { text: ['About 20,000', 'kinds of human protein'], at: 'field', cls: 'amb', alpha: S => K.prog(S.dna_field, 0.8, 1) },
    ],
    cam: {
      default: [35, 12, 3.9, 0, 0, 0],
      helix: [40, 8, 2.6, 0.3, 0, 0],
      chrom: [0, 4, 4.4, 0, -0.02, 0],
      fold: [0, 3, 4.6, 0, 0.03, 0],
      field: [FAZ, FEL, 17, 0, 0, 0],
    },
    controls: [
      { key: 'view', label: 'Show', options: [['helix', 'DNA'], ['chrom', 'Chromosomes'], ['fold', 'Proteins'], ['field', 'All proteins']] },
      { key: 'colour', label: 'Colour', options: [['conf', 'Confidence'], ['chain', 'Chain order']] },
    ],
    explore(c) {
      const i = ['helix', 'chrom', 'fold', 'field'].indexOf(c.view);
      return { dna_helix: 1, dna_chrom: i >= 1 ? 1 : 0, dna_fold: i >= 2 ? 1 : 0, dna_field: i >= 3 ? 1 : 0, dna_rainbow: c.colour === 'chain' ? 1 : 0 };
    },
    proteins: NAMES.map((n, k) => ({ sym: n, residues: folds[k].ca.length })),
    counts: { chromosomes: 23, basePairs: 3e9, genes: 20000, proteins: FIELD_N },
  });
};

// ATP synthase (slides 13-16): the 13 parts as folded chains, the assembled rotary motor in the inner
// mitochondrial membrane, protons turning the rotor while the head makes ATP, and the complex as a network.
SETS.atp = function (K) {
  const { THREE, v3, prog, lerp, clamp } = K;
  const set = K.newSet('atp');
  const D = Math.PI / 180, TAU = 2 * Math.PI;
  // azimuth phi around the rotor axis (y); phi grows the way the rotor turns when it makes ATP
  // (anticlockwise seen from the matrix, i.e. from above), which is a positive rotation about +y
  const az = (r, phi, y) => [r * Math.cos(phi), y, -r * Math.sin(phi)];
  const er = phi => [Math.cos(phi), 0, -Math.sin(phi)], et = phi => [-Math.sin(phi), 0, -Math.cos(phi)], EY = [0, 1, 0];
  const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]]; };
  const V = p => new THREE.Vector3(p[0], p[1], p[2]);
  const C3 = c => new THREE.Color(...K.rgb(c));
  // quadratic Bezier from a to c with control point b
  const bez = (a, b, c, u) => {
    const p = (1 - u) * (1 - u), q = 2 * u * (1 - u), s = u * u;
    return [p * a[0] + q * b[0] + s * c[0], p * a[1] + q * b[1] + s * c[1], p * a[2] + q * b[2] + s * c[2]];
  };
  // the complex is laid out in its own frame (about 25 nm = 1.06 units), then scaled to 1.2 units and centred
  const Z = 1.13, OY = 0.075, toSet = p => [Z * p[0], Z * p[1] + OY, Z * p[2]];
  // membrane mid-plane, head centre, azimuths of subunit a and of the rotor's bulge, membrane radius
  const YM = -0.4, YH = 0.17, PA = -15 * D, PG = -100 * D, MR = 0.86;
  const cx = new THREE.Group();
  cx.scale.setScalar(Z); cx.position.y = OY;
  set.group.add(cx);

  // ------------------------------------------------------------------ the 13 parts
  // symbol (old, as on the slides), short role, colour group (slide 14), colour in the assembled complex, fold recipe
  // (b brown and a dark brown at the colour step, as on slide 14)
  const GRP = { f1: '#36c8b9', af: '#e2b179', b: '#a8625b', oscp: '#9283d0', a: '#5e3027', c: '#efa3af' };
  const GREY = C3('#5aaca7');
  const COMP = [
    ['ATP5A1', 'α', 'f1', '#1db0a2', 'T26 D0,30,0,12 E6 L3 E6 L3 E6 L3 E6 L3 E6 D0,2,0,17 L5 H12 L4 E5 L3 H14 L4 E5 L3 H12 L4 ' +
      'E6 L3 H15 L4 E5 L3 H11 L5 E5 L4 H12 D2,-28,0,13 L6 H17 L4 H15 L4 H19 L4 H14 L4 H12 T10'],
    ['ATP5B', 'β', 'f1', '#3184dc', 'T32 D0,29,0,12 E6 L3 E6 L3 E6 L3 E5 L3 E6 D0,1,0,17 L5 H13 L4 E5 L3 H12 L4 E6 L3 H14 L4 ' +
      'E5 L3 H12 L4 E5 L4 H13 D-2,-27,0,12 L6 H16 L4 H18 L4 H14 L4 H15 T8'],
    ['ATPAF1', 'helper', 'af', '#d9a066', 'T22 D0,0,0,15 H10 L4 E5 L3 E5 L3 H12 L4 H14 L4 E6 L3 E6 L4 H10 L4 H16 ' +
      'D12,8,0,9 L6 H12 L4 H10 T18'],
    ['ATPAF2', 'helper', 'af', '#d9a066', 'T18 D0,0,0,14 H14 L4 H12 L4 E5 L3 E5 L3 E5 L4 H16 L4 H10 L4 H12 L5 H11 T14'],
    ['ATP5C1', 'γ', 'f1', '#5adcc7', 'T14 P0,40,0 X44:0,-1,0 D7,-14,0,10 L4 H10 L4 E5 L3 E5 L3 H12 L4 E5 L4 H10 G9,-12,3:5 X52:0,1,0 T6'],
    ['ATP5D', 'δ', 'f1', '#3ebfaf', 'T14 D0,0,0,11 E5 L3 E5 L3 E5 L3 E5 L3 E5 L3 E5 D0,-14,0,9 L5 H16 L4 H16 T5'],
    ['ATP5E', 'ε', 'f1', '#86e8d6', 'T3 D0,0,0,7 H12 L5 H10 L4 E4 L3 E4 T5'],
    ['ATP5F1', 'b', 'b', '#a33d4b', 'T24 P0,-40,0 X18:0.15,1,0 G4,-12,0:4 X18:-0.15,-1,0 G6,-34,4:5 X92:0,1,0.06 D8,108,6,7 L4 H12 T8'],
    ['ATP5O', 'OSCP', 'oscp', '#9283d0', 'T14 D0,10,0,11 H14 L4 H12 L4 H14 L4 H12 L4 H10 D4,-14,0,9 L6 E5 L3 E5 L3 H12 L4 E5 L3 H10 T7'],
    ['MT-ATP6', 'a', 'a', '#7e4a3c', 'T3 D0,0,0,13 H22 L5 H20 L5 H24 L5 H22 L5 H20 L5 H18 T5'],
    ['ATP5G1', 'c', 'c', '#ec8396', 'T30 P0,-22,0 X30:0,1,0 G9,24,0:5 X31:0,-1,0 T3'],
    ['ATP5G2', 'c', 'c', '#ec8396', 'T34 P0,-22,0 X30:0,1,0 G9,24,0:5 X31:0,-1,0 T3'],
    ['ATP5G3', 'c', 'c', '#ec8396', 'T32 P0,-22,0 X31:0,1,0 G9,25,0:5 X31:0,-1,0 T3'],
  ].map(([s, role, g, cc, recipe], i) => ({ s, role, g, gcol: C3(GRP[g]), ccol: C3(cc), recipe, i, copies: [] }));
  const SYM = COMP.map(c => c.s), ci = s => SYM.indexOf(s);
  // the grid of slide 13: four rows, labels above each chain
  [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]].forEach((row, i) => row.forEach((c, j) => {
    COMP[c].grid = [(j - (row.length - 1) / 2) * 0.5, 0.7 - 0.47 * i, 0];
  }));

  // An AlphaFold-like chain: a C-alpha trace in Å from a recipe. D x,y,z,R domain; H n helix across the domain;
  // E n strand (a strand after a loop joins the current sheet, antiparallel after a hairpin, parallel after a
  // helix); L n loop; X n:dx,dy,dz straight helix along a direction; P x,y,z jump; G x,y,z:n loop to a point;
  // T n floppy tail (a leading T is the N-terminal tail, grown backwards from the first residue).
  function fold(recipe, seed) {
    const rr = K.rng(seed), tok = recipe.split(' '), pts = [], typ = [];
    let C = [0, 0, 0], R = 12, p = null, sheet = null, pend = null, prev = '', nTail = 0;
    const put = (q, k) => { pts.push(q); typ.push(k); };
    const perp = d => { const e = v3.norm(v3.cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])); return [e, v3.cross(d, e)]; };
    const start = () => { if (!p) p = v3.add(C, v3.mul(K.unit(rr), R * 0.8)); };
    const across = () => {
      const q = v3.add(C, v3.mul(v3.norm(v3.add(v3.norm(v3.sub(C, p)), v3.mul(K.unit(rr), 0.8))), R * 0.7));
      return v3.norm(v3.sub(q, p));
    };
    const loop = (q, n) => {
      const m = v3.lerp(p, q, 0.5), ctrl = v3.add(v3.add(m, v3.mul(v3.sub(m, C), 0.45)), v3.mul(K.unit(rr), 2.5));
      for (let i = 1; i <= n; i++) put(bez(p, ctrl, q, i / (n + 1)), 'L');
      p = q;
    };
    const walk = (from, n, out) => {
      let q = from, d = v3.norm(v3.add(out, v3.mul(K.unit(rr), 0.6)));
      const l = [];
      for (let i = 0; i < n; i++) {
        d = v3.norm(v3.add(v3.add(v3.mul(d, 0.6), v3.mul(K.unit(rr), 0.62)), v3.mul(out, 0.12)));
        q = v3.add(q, v3.mul(d, 3.8)); l.push(q);
      }
      return l;
    };
    for (let ti = 0; ti < tok.length; ti++) {
      const s = tok[ti], ty = s[0], [a, b] = s.slice(1).split(':'), n = parseInt(a, 10);
      if (ty === 'D') { const v = a.split(',').map(Number); C = v.slice(0, 3); R = v[3]; sheet = null; }
      else if (ty === 'P') p = a.split(',').map(Number);
      else if (ty === 'T') {
        if (!pts.length) { nTail = n; continue; }
        for (const q of walk(p, n, v3.norm(v3.sub(p, C)))) put(q, 'T');
        p = pts[pts.length - 1];
      } else if (ty === 'H' || ty === 'X') {
        start();
        const d = ty === 'X' ? v3.norm(b.split(',').map(Number)) : across(), [e1, e2] = perp(d), ph = rr() * TAU;
        for (let i = 0; i < n; i++) {
          const w = ph + i * 100 * D;
          put(v3.add(v3.add(p, v3.mul(d, 1.5 * i)), v3.add(v3.mul(e1, 2.3 * Math.cos(w)), v3.mul(e2, 2.3 * Math.sin(w)))), 'H');
        }
        p = v3.add(p, v3.mul(d, 1.5 * n));
      } else if (ty === 'E') {
        start();
        let d;
        if (pend) d = pend; else { d = across(); sheet = { d0: d, e: perp(d)[0] }; }
        pend = null;
        const nn = v3.cross(d, sheet.e), a0 = p;
        for (let i = 0; i < n; i++) put(v3.add(v3.add(p, v3.mul(d, 3.3 * i)), v3.mul(nn, i % 2 ? 0.9 : -0.9)), 'E');
        const b0 = v3.add(p, v3.mul(d, 3.3 * (n - 1)));
        sheet.last = { a: a0, b: b0, d };
        p = v3.add(b0, v3.mul(d, 1.6));
      } else if (ty === 'L' || ty === 'G') {
        start();
        let q;
        if (ty === 'G') q = a.split(',').map(Number);
        else if (sheet && sheet.last && tok[ti + 1] && tok[ti + 1][0] === 'E') {
          const L = sheet.last;
          if (prev === 'E') { pend = v3.mul(L.d, -1); q = v3.add(L.b, v3.mul(sheet.e, 4.8)); }
          else { pend = sheet.d0; q = v3.add(v3.dot(L.d, sheet.d0) > 0 ? L.a : L.b, v3.mul(sheet.e, 4.8)); }
        } else {
          let best = 1e9;
          for (let k = 0; k < 6; k++) {
            const c = v3.add(C, v3.mul(K.unit(rr), R * 0.75)), e = Math.abs(v3.dist(c, p) - n * 2.6);
            if (e < best) { best = e; q = c; }
          }
        }
        loop(q, ty === 'G' ? parseInt(b, 10) : n);
      }
      prev = ty;
    }
    if (nTail) {
      let c = [0, 0, 0];
      for (const q of pts) c = v3.add(c, v3.mul(q, 1 / pts.length));
      const l = walk(pts[0], nTail, v3.norm(v3.sub(pts[0], c))).reverse();
      pts.unshift(...l); typ.unshift(...l.map(() => 'T'));
    }
    return { pts, typ };
  }
  // principal axes of a point set
  function pca(P) {
    const n = P.length, c = [0, 0, 0], M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const p of P) { c[0] += p[0] / n; c[1] += p[1] / n; c[2] += p[2] / n; }
    for (const p of P) { const d = v3.sub(p, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[3 * i + j] += d[i] * d[j]; }
    const mul = v => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
      M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
    let e1 = v3.norm([1, 0.31, 0.17]), e2 = [0, 1, 0];
    for (let i = 0; i < 40; i++) e1 = v3.norm(mul(e1));
    e2 = v3.norm(v3.cross(e1, [0.13, 0.29, 1]));
    for (let i = 0; i < 40; i++) { e2 = mul(e2); e2 = v3.norm(v3.sub(e2, v3.mul(e1, v3.dot(e2, e1)))); }
    return { c, e: [e1, e2, v3.cross(e1, e2)] };
  }
  const basisQ = e => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(e[0]), V(e[1]), V(e[2])));
  const _v = new THREE.Vector3();
  for (const C of COMP) {
    const f = fold(C.recipe, 101 + 17 * C.i);
    const core = f.pts.filter((p, i) => f.typ[i] !== 'T'), pc = pca(core), pa = pca(f.pts);
    // in the grid the chain's long axis lies across its cell, turned a little so it reads as 3D
    const qg = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.45, 0.3, C.i % 2 ? 0.14 : -0.12)).multiply(basisQ(pa.e).invert());
    const loc = f.pts.map(p => v3.sub(p, pc.c)), rot = loc.map(p => _v.set(p[0], p[1], p[2]).applyQuaternion(qg).toArray());
    const box = only => {
      const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      rot.forEach((p, i) => {
        if (!only || f.typ[i] !== 'T') for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
      });
      return [lo, hi];
    };
    const [lo, hi] = box(false), [cl, ch] = box(true);
    // fill the cell with the folded core; floppy ends may reach to its edges
    const s = Math.min(0.3 / (ch[0] - cl[0]), 0.24 / (ch[1] - cl[1]), 0.46 / (hi[0] - lo[0]), 0.36 / (hi[1] - lo[1]), 0.012);
    // buried residues (many neighbours within 10 Å) are shaded darker, so the folded cores read dark as on slide 13
    const n = f.pts.length, nb = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      const a = f.pts[i];
      for (let j = i + 1; j < n; j++) {
        const b = f.pts[j], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
        if (dx * dx + dy * dy + dz * dz < 100) { nb[i]++; nb[j]++; }
      }
    }
    C.ao = Array.from(nb, k => clamp(1.15 - 0.016 * (k - 8), 0.42, 1.12));
    C.res = loc.map(p => v3.mul(p, s));
    C.typ = f.typ;
    C.q0 = qg;
    C.p0 = v3.sub(C.grid, v3.mul(v3.lerp(lo, hi, 0.5), s));
    C.axes = pc.e;
    C.tubeR = clamp(3.1 * s, 0.008, 0.013);
    C.label = [C.grid[0] - 0.19, C.grid[1] + 0.17, 0];
  }

  // a tube along a chain (radius in grid units): a Catmull-Rom curve through the residues, two rings per residue,
  // parallel-transported frames (same layout and winding as THREE.TubeGeometry, but much cheaper to build);
  // aU = position along the chain for the reveal
  function chainGeo(C) {
    const P = C.res, n = P.length, per = 2, rad = 5, R = C.tubeR, S = [];
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      for (let k = 0; k < per; k++) {
        const u = k / per, u2 = u * u, u3 = u2 * u, q = [0, 0, 0];
        for (let j = 0; j < 3; j++) {
          q[j] = 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 +
            (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * u3);
        }
        S.push(q);
      }
    }
    S.push(P[n - 1]);
    const m = S.length, nv = m * (rad + 1), pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
    const uu = new Float32Array(nv), tl = new Float32Array(nv), col = new Float32Array(nv * 3);
    // shade by structure (helices bright, loops dark) and by burial
    const rr = K.rng(C.i + 3), shade = { H: 1.05, E: 0.95, L: 0.7, T: 0.85 }, rs = P.map(() => 0.92 + 0.16 * rr());
    let N = null;
    for (let i = 0; i < m; i++) {
      const T = v3.norm(v3.sub(S[Math.min(i + 1, m - 1)], S[Math.max(i - 1, 0)]));
      N = N ? v3.sub(N, v3.mul(T, v3.dot(N, T))) : v3.cross(T, Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
      N = v3.norm(N);
      const B = v3.cross(T, N), ri = Math.min(n - 1, Math.round(i / per)), k = shade[C.typ[ri]] * rs[ri] * C.ao[ri];
      for (let j = 0; j <= rad; j++) {
        const v = j / rad * TAU, c = -Math.cos(v), sn = Math.sin(v), o = i * (rad + 1) + j;
        const nx = c * N[0] + sn * B[0], ny = c * N[1] + sn * B[1], nz = c * N[2] + sn * B[2];
        nor[3 * o] = nx; nor[3 * o + 1] = ny; nor[3 * o + 2] = nz;
        pos[3 * o] = S[i][0] + R * nx; pos[3 * o + 1] = S[i][1] + R * ny; pos[3 * o + 2] = S[i][2] + R * nz;
        uu[o] = i / (m - 1); tl[o] = C.typ[ri] === 'T' ? 1 : 0; col[3 * o] = col[3 * o + 1] = col[3 * o + 2] = k;
      }
    }
    const idx = new Uint32Array((m - 1) * rad * 6);
    let w = 0;
    for (let i = 1; i < m; i++) for (let j = 1; j <= rad; j++) {
      const a = (rad + 1) * (i - 1) + (j - 1), b = (rad + 1) * i + (j - 1), c = (rad + 1) * i + j, d = (rad + 1) * (i - 1) + j;
      idx[w++] = a; idx[w++] = b; idx[w++] = d; idx[w++] = b; idx[w++] = c; idx[w++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aU', new THREE.BufferAttribute(uu, 1)); g.setAttribute('aK', new THREE.BufferAttribute(tl, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }
  // chains: lit tubes that draw themselves along their length (uRev) and thin away once the surface has formed
  // (uThin; the floppy ends, aK = 1, go first, uThinT, right after the chain has docked)
  const chainCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aU, aK; varying float vU; uniform float uThin, uThinT;')
      .replace('#include <begin_vertex>', 'vec3 transformed = position - normal * max(uThin, aK * uThinT); vU = aU;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vU; uniform float uRev;')
      .replace('#include <clipping_planes_fragment>', 'if (vU > uRev) discard;\n#include <clipping_planes_fragment>');
  };

  // ------------------------------------------------------------------ the assembled complex
  // Every copy of every part becomes a cluster of overlapping spheres (a molecular surface). Domains are
  // ellipsoids sampled on their surface; helices are rods of spheres. Spheres buried in another domain of the
  // same body (stator, rotor or helper) are dropped.
  const COPIES = [], DOM = [], RAW = [];
  const addCopy = (c, o) => {
    const cp = Object.assign({ comp: c, i: COPIES.length, rotor: false, body: 's', s0: 0 }, o);
    COPIES.push(cp); COMP[c].copies.push(cp);
    return cp;
  };
  const H = 0.036;
  const fib = (n, i) => {
    const y = 1 - 2 * (i + 0.5) / n, s = Math.sqrt(1 - y * y), t = i * 2.399963;
    return [s * Math.cos(t), y, s * Math.sin(t)];
  };
  const srng = K.rng(4242);
  function ell(cp, c, ax, rad, tint) {
    const [a, b, d] = rad, k = 1.6;
    const area = 4 * Math.PI * Math.pow((Math.pow(a * b, k) + Math.pow(a * d, k) + Math.pow(b * d, k)) / 3, 1 / k);
    const n = Math.max(8, Math.round(area / (H * H * 0.92))), dom = { c, ax, rad, cp, i: DOM.length };
    DOM.push(dom);
    for (let i = 0; i < n; i++) {
      const u = fib(n, i), s = 1 + (srng() - 0.62) * 0.4 * H / Math.min(a, b, d);
      const q = v3.add(c, v3.add(v3.add(v3.mul(ax[0], a * u[0] * s), v3.mul(ax[1], b * u[1] * s)), v3.mul(ax[2], d * u[2] * s)));
      RAW.push({ p: q, r: H * (0.8 + 0.32 * srng()), cp, dom: dom.i, tint: tint || 1 });
    }
  }
  // a helix as a rod of spheres along an axis through points; off = helix radius, rise per residue
  function rod(cp, axis, o = {}) {
    const curve = new THREE.CatmullRomCurve3(axis.map(V)), L = curve.getLength(), rise = o.rise || 0.0115;
    const n = Math.max(2, Math.round(L / rise)), off = o.off || 0.016, ph = srng() * TAU;
    for (let i = 0; i <= n; i++) {
      const u = i / n, A = curve.getPointAt(u).toArray(), T = curve.getTangentAt(u).toArray();
      const N = v3.norm(v3.cross(T, Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), B = v3.cross(T, N), w = ph + i * 100 * D;
      const p = v3.add(A, v3.add(v3.mul(N, off * Math.cos(w)), v3.mul(B, off * Math.sin(w))));
      RAW.push({ p, r: (o.r || 0.029) * (0.88 + 0.24 * srng()), cp, dom: -1, tint: o.tint || 1 });
    }
  }
  const arc = (r, p0, p1, y0, y1, n = 7) =>
    Array.from({ length: n }, (x, i) => az(r, lerp(p0, p1, i / (n - 1)), lerp(y0, y1, i / (n - 1))));

  // head: alpha3beta3, alternating around the central shaft; each subunit has a crown, a nucleotide-binding
  // domain and a helical C-terminal domain
  for (let k = 0; k < 6; k++) {
    const phi = PA + (30 + 60 * k) * D, beta = k % 2 === 1, tw = (beta ? 6 : -6) * D;
    const cp = addCopy(beta ? 1 : 0, { k, phi, t1: EY, t2: er(phi), s0: 0.012 * k, beta });
    const at = (r, y) => az(r, phi, y), ax = [er(phi + tw), EY, et(phi + tw)];
    ell(cp, at(0.135, YH + 0.15), ax, [0.064, 0.068, 0.062], 1.08);
    ell(cp, at(0.168, YH + 0.025), ax, [0.094, 0.1, 0.086], 1);
    ell(cp, at(0.15, YH - 0.115), ax, beta ? [0.076, 0.08, 0.072] : [0.072, 0.078, 0.074], 0.94);
  }
  const ALPHA_F = COPIES[4], BETA_F = COPIES[5];   // the front alpha and beta (the helpers dock on these)
  // assembly factors dock on the outside of a beta (ATPAF1) and an alpha (ATPAF2), then leave
  const af = (c, host, s0) => {
    const phi = host.phi, drift = v3.add(v3.mul(er(phi + 10 * D), 0.42), [0, 0.3, 0]);
    const cp = addCopy(c, { phi, t1: EY, t2: er(phi), s0, body: 'h', drift });
    ell(cp, az(0.34, phi, YH + 0.03), [er(phi), EY, et(phi)], [0.058, 0.078, 0.072]);
    ell(cp, az(0.37, phi + 12 * D, YH + 0.11), [er(phi), EY, et(phi)], [0.04, 0.04, 0.04]);
    return cp;
  };
  const AF1 = af(2, BETA_F, 0.0), AF2 = af(3, ALPHA_F, 0.02);
  // central stalk (rotor): gamma's coiled coil and foot, delta and epsilon, an asymmetric mass on the c-ring
  const G = addCopy(4, { rotor: true, body: 'r', t1: EY, t2: er(PG), s0: 0.07 });
  rod(G, [[0.018, -0.13, 0.004], [0.02, -0.04, 0.012], [0.016, 0.06, 0.02]], { off: 0.014, r: 0.024 });
  rod(G, [[-0.016, -0.12, -0.012], [-0.02, -0.03, -0.004], [-0.018, 0.05, 0.008]], { off: 0.014, r: 0.024 });
  ell(G, az(0.04, PG, -0.125), [er(PG), EY, et(PG)], [0.07, 0.045, 0.062]);
  const DL = addCopy(5, { rotor: true, body: 'r', t1: EY, t2: er(PG + 115 * D), s0: 0.08 });
  ell(DL, az(0.075, PG + 115 * D, -0.165), [er(PG + 115 * D), EY, et(PG + 115 * D)], [0.06, 0.045, 0.055]);
  ell(DL, az(0.055, PG + 165 * D, -0.11), [er(PG + 165 * D), EY, et(PG + 165 * D)], [0.042, 0.04, 0.04]);
  const EP = addCopy(6, { rotor: true, body: 'r', t1: et(PG - 70 * D), t2: EY, s0: 0.09 });
  ell(EP, az(0.07, PG - 70 * D, -0.205), [er(PG - 70 * D), EY, et(PG - 70 * D)], [0.042, 0.032, 0.042]);
  // c-ring: 8 hairpins of two helices, inner (N-terminal) and outer (C-terminal, carries the proton site);
  // the three genes make the same mature subunit, so the ring mixes them
  const CPHI = j => (-135 + 45 * j) * D, RIN = 0.088, ROUT = 0.148;
  for (let j = 0; j < 8; j++) {
    const c = 10 + (j % 3), phi = CPHI(j), po = phi + 22.5 * D;
    const cp = addCopy(c, { j, phi, rotor: true, body: 'r', t1: EY, t2: er(phi), s0: 0.12 + 0.008 * j, shade: j % 2 ? 0.76 : 1 });
    rod(cp, [az(RIN, phi, YM - 0.155), az(RIN, phi + 4 * D, YM), az(RIN, phi, YM + 0.15)], { off: 0.014, r: 0.03, rise: 0.016 });
    rod(cp, [az(ROUT, po, YM + 0.15), az(ROUT, po - 3 * D, YM), az(ROUT, po, YM - 0.155)], { off: 0.016, r: 0.029 });
    rod(cp, [az(RIN, phi, YM + 0.165), az((RIN + ROUT) / 2, phi + 11 * D, YM + 0.19), az(ROUT, po, YM + 0.165)],
      { off: 0.008, r: 0.026, rise: 0.016 });
  }
  // subunit a: long, nearly horizontal helices wrapped around the c-ring
  const AS = addCopy(9, { t1: et(PA), t2: EY, s0: 0.17 }), AR = { rise: 0.0135, r: 0.031 };
  rod(AS, arc(0.236, PA - 50 * D, PA + 46 * D, YM + 0.075, YM + 0.095), AR);
  rod(AS, arc(0.236, PA + 48 * D, PA - 48 * D, YM - 0.01, YM + 0.01), AR);
  rod(AS, arc(0.236, PA - 46 * D, PA + 50 * D, YM - 0.1, YM - 0.085), AR);
  rod(AS, arc(0.29, PA + 40 * D, PA - 40 * D, YM + 0.06, YM + 0.035), AR);
  rod(AS, arc(0.29, PA - 38 * D, PA + 36 * D, YM - 0.065, YM - 0.04), AR);
  rod(AS, [az(0.3, PA + 44 * D, YM - 0.13), az(0.3, PA + 46 * D, YM), az(0.29, PA + 42 * D, YM + 0.13)], AR);
  // peripheral stalk, subunit b: two helices in the membrane beside a, then one long helix up the side of the head
  const BS = addCopy(7, { t1: v3.norm([0, 1, 0]), t2: er(PA), s0: 0.19 });
  rod(BS, [az(0.355, PA + 8 * D, YM - 0.13), az(0.35, PA + 7 * D, YM + 0.13)], AR);
  rod(BS, [az(0.36, PA - 6 * D, YM + 0.12), az(0.355, PA - 5 * D, YM - 0.12)], AR);
  // the long helix with its partners in the stalk (d and F6, not among the 13) as a twisted bundle
  const stalk = [az(0.36, PA, YM + 0.13), az(0.36, PA - 2 * D, -0.12), az(0.335, PA - 4 * D, 0.05), az(0.31, PA - 5 * D, 0.2),
    az(0.27, PA - 4 * D, 0.33), az(0.2, PA - 2 * D, 0.405)];
  const twist = (k, w) => stalk.map((p, i) =>
    v3.add(p, v3.mul(v3.add(v3.mul(er(PA), Math.cos(i * 1.3 + k)), v3.mul(et(PA), Math.sin(i * 1.3 + k))), w)));
  rod(BS, twist(0, 0.018), { off: 0.016, r: 0.03, rise: 0.013 });
  rod(BS, twist(Math.PI, 0.018), { off: 0.016, r: 0.028, rise: 0.016 });
  ell(BS, az(0.37, PA + 3 * D, -0.17), [er(PA), EY, et(PA)], [0.045, 0.075, 0.048]);
  // OSCP caps the peripheral stalk on top of the head
  const OS = addCopy(8, { t1: er(PA), t2: EY, s0: 0.21 });
  ell(OS, az(0.05, PA, YH + 0.245), [er(PA), EY, et(PA)], [0.072, 0.048, 0.062]);
  ell(OS, az(0.17, PA, YH + 0.23), [er(PA), EY, et(PA)], [0.055, 0.05, 0.05]);

  // drop buried spheres (inside another domain of the same body; helpers never bury anything)
  const inside = (d, p) => {
    const q = v3.sub(p, d.c);
    let s = 0;
    for (let k = 0; k < 3; k++) { const x = v3.dot(q, d.ax[k]) / d.rad[k]; s += x * x; }
    return s < 0.9;
  };
  const SPH = RAW.filter(s => !DOM.some(d => d.i !== s.dom && d.cp.body === s.cp.body && d.cp.body !== 'h' && inside(d, s.p)) &&
    !(s.cp.body === 'h' && DOM.some(d => d.cp.body === 's' && inside(d, s.p))));
  // ambient occlusion from the number of near neighbours: spheres in grooves are darker
  const occ = new Float32Array(SPH.length);
  {
    const cell = 0.075, c2 = cell * cell, hash = new Map(), xyz = new Float32Array(SPH.length * 3);
    const key = (a, b, c) => (a + 64) * 16384 + (b + 64) * 128 + (c + 64), fl = x => Math.floor(x / cell);
    SPH.forEach((s, i) => {
      xyz.set(s.p, 3 * i);
      const k = key(fl(s.p[0]), fl(s.p[1]), fl(s.p[2]));
      (hash.get(k) || hash.set(k, []).get(k)).push(i);
    });
    for (let i = 0; i < SPH.length; i++) {
      const x = xyz[3 * i], y = xyz[3 * i + 1], z = xyz[3 * i + 2], gx = fl(x), gy = fl(y), gz = fl(z);
      let n = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const l = hash.get(key(gx + a, gy + b, gz + c));
        if (l) for (let q = 0; q < l.length; q++) {
          const j = 3 * l[q], dx = xyz[j] - x, dy = xyz[j + 1] - y, dz = xyz[j + 2] - z;
          if (dx * dx + dy * dy + dz * dz < c2) n++;
        }
      }
      occ[i] = n;
    }
  }
  // dock each chain copy on its cluster: centre, scale along the main axis, and which residue each sphere grows from
  for (const cp of COPIES) {
    cp.sph = SPH.filter(s => s.cp === cp);
    let c = [0, 0, 0];
    for (const s of cp.sph) c = v3.add(c, v3.mul(s.p, 1 / cp.sph.length));
    const C = COMP[cp.comp], t1 = v3.norm(cp.t1), t2 = v3.norm(v3.sub(cp.t2, v3.mul(t1, v3.dot(cp.t2, t1))));
    const t3 = v3.cross(t1, t2), pr = cp.sph.map(s => v3.dot(v3.sub(s.p, c), t1)), rp = C.res.map(p => v3.dot(p, C.axes[0]));
    const span = a => Math.max(...a) - Math.min(...a);
    cp.P1 = c; cp.s1 = 0.92 * span(pr) / span(rp.filter((x, i) => C.typ[i] !== 'T'));
    cp.q1 = basisQ([t1, t2, t3]).multiply(basisQ(C.axes).invert());
    // spheres grow out of the folded core, in order along the main axis; never from the floppy ends, which
    // thin away first (spheres starting out there would spray around the complex mid-build)
    const ord = cp.sph.map((s, i) => i).sort((a, b) => pr[a] - pr[b]);
    const ro = C.res.map((p, i) => i).filter(i => C.typ[i] !== 'T').sort((a, b) => rp[a] - rp[b]);
    ord.forEach((si, rank) => {
      const s = cp.sph[si], ri = ro[Math.floor(rank / ord.length * ro.length)];
      s.from = v3.add(c, V(C.res[ri]).multiplyScalar(cp.s1).applyQuaternion(cp.q1).toArray());
      s.t0 = cp.s0 + 0.3 + 0.14 * rank / ord.length + 0.05 * srng();
    });
    cp.r0 = 0.6 * C.tubeR * cp.s1;
  }
  // in order of growth, so that only the spheres that have started are drawn (instanceCount)
  SPH.forEach((s, i) => { s.occ = occ[i]; });
  SPH.sort((a, b) => a.t0 - b.t0);
  const T0 = Float32Array.from(SPH, s => s.t0);
  const started = b => {
    let lo = 0, hi = T0.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (T0[m] <= b) lo = m + 1; else hi = m; }
    return lo;
  };

  // ------------------------------------------------------------------ sphere surface (one instanced draw)
  const NS = SPH.length, NC = COPIES.length;
  // an indexed icosphere (42 vertices instead of 240, so the vertex shader runs far less often)
  function icosphere(detail, scale) {
    const src = new THREE.IcosahedronGeometry(1, detail).attributes.position, map = new Map(), pos = [], idx = [];
    for (let i = 0; i < src.count; i++) {
      const x = src.getX(i), y = src.getY(i), z = src.getZ(i), k = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
      if (!map.has(k)) { map.set(k, pos.length / 3); pos.push(x, y, z); }
      idx.push(map.get(k));
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos).map(v => v * scale), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    return g;
  }
  const sg = icosphere(1, 1), pg = icosphere(0, 0.9);
  sg.instanceCount = pg.instanceCount = NS;
  const aTo = new Float32Array(NS * 4), aFrom = new Float32Array(NS * 4), aMeta = new Float32Array(NS * 4);
  const aC0 = new Float32Array(NS * 3), aC1 = new Float32Array(NS * 3);
  SPH.forEach((s, i) => {
    const cp = s.cp, C = COMP[cp.comp];
    aTo.set([...s.p, s.r], 4 * i); aFrom.set([...s.from, cp.r0], 4 * i);
    // weight of the copy offset: beta subunits hinge at the top (the lower half swings), helpers move whole
    const w = cp.beta ? clamp((YH + 0.12 - s.p[1]) / 0.3, 0, 1) : 1;
    aMeta.set([cp.i, cp.rotor ? 1 : 0, w, s.t0], 4 * i);
    const ao = clamp(1.42 - 0.021 * s.occ, 0.5, 1.12), j = 0.93 + 0.14 * srng(), k = ao * j * s.tint * (cp.shade || 1);
    const k0 = j * (0.75 + 0.25 * ao);
    aC0.set([C.gcol.r * k0, C.gcol.g * k0, C.gcol.b * k0], 3 * i);
    aC1.set([C.ccol.r * k, C.ccol.g * k, C.ccol.b * k], 3 * i);
  });
  sg.setAttribute('aTo', new THREE.InstancedBufferAttribute(aTo, 4));
  sg.setAttribute('aFrom', new THREE.InstancedBufferAttribute(aFrom, 4));
  sg.setAttribute('aMeta', new THREE.InstancedBufferAttribute(aMeta, 4));
  sg.setAttribute('aC0', new THREE.InstancedBufferAttribute(aC0, 3));
  sg.setAttribute('aC1', new THREE.InstancedBufferAttribute(aC1, 3));
  for (const k of ['aTo', 'aFrom', 'aMeta', 'aC0', 'aC1']) pg.setAttribute(k, sg.attributes[k]);
  const SU = {
    uBuild: { value: 0 }, uColour: { value: 0 }, uAng: { value: 0 }, uGrey: { value: GREY }, uRim: { value: 0.32 },
    uCp: { value: COPIES.map(() => new THREE.Vector4(0, 0, 0, 1)) },
  };
  const sphVert = `
attribute vec4 aTo, aFrom, aMeta; attribute vec3 aC0, aC1;
uniform float uBuild, uColour, uAng; uniform vec4 uCp[${NC}]; uniform vec3 uGrey;
varying vec3 vCol;`;
  const sphBegin = `
float m = clamp((uBuild - aMeta.w) / 0.22, 0.0, 1.0); m = m * m * (3.0 - 2.0 * m);
vec4 cp = uCp[int(aMeta.x + 0.5)];
vec3 ctr = mix(aFrom.xyz, aTo.xyz, m) + vec3(0.0, 0.05, 0.0) * m * (1.0 - m) + cp.xyz * aMeta.z;
float an = aMeta.y * uAng, ca = cos(an), sa = sin(an);
ctr = vec3(ca * ctr.x + sa * ctr.z, ctr.y, -sa * ctr.x + ca * ctr.z);
float rad = mix(aFrom.w, aTo.w, m) * cp.w * step(aMeta.w, uBuild - 0.0001);
vec3 transformed = ctr + position * rad;
vCol = mix(mix(uGrey, aC0, uColour), aC1, m);`;
  const sphMat = K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.66, metalness: 0 }), 1);
  sphMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, SU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + sphVert)
      .replace('#include <begin_vertex>', sphBegin);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCol; uniform float uRim;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vCol;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' +
        'totalEmissiveRadiance += vCol * uRim * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.2);');
  };
  const sph = new THREE.Mesh(sg, sphMat);
  sph.frustumCulled = false; sph.renderOrder = 2;
  cx.add(sph);
  // depth-only pre-pass (low-poly spheres just inside the real ones), so the faint ghost of the network view
  // shows only the outer surface. It also cuts a complex-shaped hole into whatever other sets draw later, so
  // it runs only while the set is (nearly) fully in and not shrinking; the ghost fades out before it stops
  // (shrink 0..0.12, set fade 1..0.7), so neither a hole nor a pop shows in the hand-over or in explore.
  const preMat = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  preMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, SU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + sphVert)
      .replace('#include <begin_vertex>', sphBegin);
  };
  const pre = new THREE.Mesh(pg, preMat);
  pre.frustumCulled = false; pre.renderOrder = 1;
  cx.add(pre);

  // ------------------------------------------------------------------ chain meshes (one per part, one instance per copy)
  for (const C of COMP) {
    const mat = K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, vertexColors: true }), 1);
    const uRev = { value: 0 }, uThin = { value: 0 }, uThinT = { value: 0 };
    mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, { uRev, uThin, uThinT }); chainCompile(sh); };
    const mesh = new THREE.InstancedMesh(chainGeo(C), mat, C.copies.length);
    mesh.frustumCulled = false;
    set.group.add(mesh);
    const s0 = Math.min(...C.copies.map(cp => cp.s0)), s1 = Math.max(...C.copies.map(cp => cp.s0));
    Object.assign(C, { mat, mesh, uRev, uThin, uThinT, s0, s1, d0: 0.04 * C.i });
  }

  // ------------------------------------------------------------------ membrane: two leaflets of lipid heads, a dim core between
  const memA = { value: 0 };
  let mem, haze;
  {
    const rr = K.rng(77), heads = [], fill = [], sp = 0.032;
    // how strongly lipids show at (x, z): none inside the complex, fainter right next to it (so the ring and
    // subunit a show through the bilayer) and towards the rim
    const lipid = (x, z) => {
      const r = Math.hypot(x, z);
      if (r > MR || r < 0.205) return 0;
      const phi = Math.atan2(-z, x), dp = Math.abs(((phi - PA) / D + 540) % 360 - 180);
      if (dp < 56 && r < 0.335) return 0;                                                   // subunit a
      if (Math.hypot(x - 0.355 * Math.cos(PA), z + 0.355 * Math.sin(PA)) < 0.06) return 0;  // b's helices
      return (1 - K.smooth((r - 0.55) / (MR - 0.55))) * (0.3 + 0.7 * K.smooth((r - 0.24) / 0.22));
    };
    for (const side of [1, -1]) for (let i = -30; i <= 30; i++) for (let j = -30; j <= 30; j++) {
      const x = (i + (j & 1) * 0.5) * sp + (rr() - 0.5) * 0.02, z = j * sp * 0.866 + (rr() - 0.5) * 0.02, w = lipid(x, z);
      if (w > 0) heads.push([x, YM + side * (0.093 + (rr() - 0.5) * 0.012), z, w, rr()]);
    }
    // the hydrophobic core between the leaflets: a sparse, dim, warm fill, so that from the side the bilayer
    // reads as one sheet rather than two bands with a gap
    for (let i = 0; i < 2600; i++) {
      const r = Math.sqrt(lerp(0.04, MR * MR, rr())), ph = rr() * TAU, x = r * Math.cos(ph), z = -r * Math.sin(ph), w = lipid(x, z);
      if (w > 0) fill.push([x, YM + (rr() * 2 - 1) * 0.07, z, w, rr()]);
    }
    const g = K.pointsGeo(heads.length + fill.length), A = g.attributes;
    heads.concat(fill).forEach((h, i) => {
      const core = i >= heads.length;
      A.position.array.set(h.slice(0, 3), 3 * i);
      A.aCol.array.set(core ? [0.66, 0.52, 0.36] : h[4] > 0.5 ? [0.84, 0.74, 0.52] : [0.76, 0.68, 0.54], 3 * i);
      A.aSize.array[i] = core ? 0.05 + 0.02 * h[4] : 0.03;
      A.aA.array[i] = (core ? 0.13 : 0.6) * h[3];
    });
    mem = new THREE.Points(g, K.points(set, { additive: false, uniforms: { uM: memA }, head: 'uniform float uM;', vertex: 'vA *= uM;' }));
    mem.renderOrder = 3;
    cx.add(mem);
  }

  // ------------------------------------------------------------------ protons and ATP
  // protons: a dim haze on both sides (more in the intermembrane space below), and the bright stream through
  // subunit a, which must stand out from it
  const hazeA = { value: 0 };
  {
    const rr = K.rng(9), n = 260, g = K.pointsGeo(n), mouth = az(0.3, PA + 12 * D, YM - 0.24);
    for (let i = 0; i < n; i++) {
      const low = i < 230, r = (low ? 0.15 : 0.36) + rr() * (low ? 0.68 : 0.46), ph = rr() * TAU;
      const p = az(r, ph, low ? YM - 0.15 - rr() * 0.33 : YM + 0.15 + rr() * 0.5);
      g.attributes.position.array.set(p, 3 * i);
      g.attributes.aCol.array.set([0.4, 0.68, 1], 3 * i);
      g.attributes.aSize.array[i] = 0.022;
      // dimmer still where the stream enters, under subunit a
      g.attributes.aA.array[i] = 0.3 * (1 - K.smooth((r - 0.6) / 0.25)) * (0.3 + 0.7 * K.smooth(v3.dist(p, mouth) / 0.3));
    }
    const m = K.points(set, { uniforms: { uF: hazeA }, head: 'uniform float uF;', vertex: `vA *= uF;
  vec3 q = pos + 0.025 * vec3(sin(uTime * 0.9 + pos.x * 41.0 + pos.y * 13.0), sin(uTime * 0.7 + pos.z * 37.0),
    sin(uTime * 0.8 + pos.y * 43.0 + pos.x * 7.0));
  mv = modelViewMatrix * vec4(q, 1.0); gl_Position = projectionMatrix * mv;` });
    haze = new THREE.Points(g, m);
    haze.renderOrder = 3;
    cx.add(haze);
  }
  // the stream: NPR protons, each a white-hot head with a fading trail of NTR points behind it (the same closed
  // form a little earlier on its path), then the ATP: 4 points each
  const NPR = 16, NTR = 3, NP = NPR * (1 + NTR), NATP = 6, TRD = 0.021, TRA = [1, 0.55, 0.32, 0.16], NM = NP + NATP * 4;
  const dynG = K.pointsGeo(NM + 2), dyn = new THREE.Points(dynG, K.points(set));
  dyn.frustumCulled = false; dyn.renderOrder = 4; cx.add(dyn);
  for (let k = 0; k <= NTR; k++) for (let i = 0; i < NPR; i++) {
    dynG.attributes.aCol.array.set(k ? [0.5, 0.9, 1] : [0.92, 1, 1], 3 * (k * NPR + i));
    dynG.attributes.aSize.array[k * NPR + i] = k ? 0.058 - 0.008 * k : 0.066;
  }
  for (let i = 0; i < NATP * 4; i++) dynG.attributes.aCol.array.set(i % 4 ? [1, 0.82, 0.4] : [1, 0.62, 0.16], 3 * (NP + i));
  // protons enter from the intermembrane side through a's lower half-channel and bind a c subunit at PIN, ride
  // the ring almost a full turn and leave through a's upper half-channel at POUT: 8 protons per turn
  const PIN = PA + 20 * D, POUT = PA - 20 * D, RIDE = 1 - 40 / 360, APP = 0.4, EXI = 0.32, RPR = 0.205;
  // the mouths of the two half-channels glow faintly while protons flow, and flash as each proton passes
  // (u at which a proton passes the mouth: into a from below, out of a at the top)
  const MOUTH = [[az(0.25, PA + 16 * D, YM - 0.17), -0.4 * APP], [az(0.275, POUT - 6 * D, YM + 0.17), RIDE + 0.4 * EXI]];
  MOUTH.forEach(([p], i) => {
    dynG.attributes.position.array.set(p, 3 * (NM + i)); dynG.attributes.aCol.array.set([0.45, 0.85, 1], 3 * (NM + i));
    dynG.attributes.aSize.array[NM + i] = 0.13;
  });
  const TAU0 = ((((PIN - CPHI(0) - 22.5 * D) / TAU) % 0.125) + 0.125) % 0.125;
  // ATP leaves each beta once per turn, when the bulge of the rotating central stalk faces it: 3 per turn
  const BETAS = COPIES.filter(cp => cp.beta), BBASE = BETAS.map(cp => ((((cp.phi - PG) / TAU) % 1) + 1) % 1);
  const hash = (m, k) => { const r = K.rng(m * 7919 + k * 104729 + 17); r(); return r(); };
  // proton m, u turns after it binds the ring (negative: still on its way in): [position, alpha] or null
  const proton = (m, u) => {
    if (u < -APP || u > RIDE + EXI) return null;
    if (u < 0) {
      const s = (u + APP) / APP, from = az(0.3 + 0.3 * hash(m, 1), PA + (hash(m, 2) * 100 - 40) * D, YM - 0.36 - 0.1 * hash(m, 5));
      return [bez(from, az(0.3, PA + 12 * D, YM - 0.24), az(RPR, PIN, YM), K.smooth(s)), K.smooth(s / 0.3)];
    }
    if (u < RIDE) return [az(RPR, PIN + TAU * u, YM + 0.006 * Math.sin(u * 40)), 1];
    const s = (u - RIDE) / EXI, h2 = hash(m, 4), to = az(0.38 + 0.18 * hash(m, 3), POUT - (10 + 40 * h2) * D, YM + 0.45 + 0.1 * h2);
    return [bez(az(RPR, POUT, YM), az(0.29, POUT - 4 * D, YM + 0.2), to, K.smooth(s)), 1 - K.smooth((s - 0.45) / 0.55)];
  };
  const ZERO = [0, 0, 0];
  function protons(T, flow) {
    const P = dynG.attributes.position.array, A = dynG.attributes.aA.array, SZ = dynG.attributes.aSize.array;
    let slot = 0;
    const m0 = Math.ceil((T - RIDE - EXI - TAU0) * 8), m1 = Math.floor((T + APP - TAU0) * 8);
    for (let m = m0; m <= m1 && slot < NPR; m++, slot++) {
      const u = T - (TAU0 + m / 8);
      for (let k = 0; k <= NTR; k++) {
        const q = proton(m, u - TRD * k), o = k * NPR + slot;
        P.set(q ? q[0] : ZERO, 3 * o);
        A[o] = q ? q[1] * flow * TRA[k] : 0;
      }
    }
    for (; slot < NPR; slot++) for (let k = 0; k <= NTR; k++) { P.set(ZERO, 3 * (k * NPR + slot)); A[k * NPR + slot] = 0; }
    // ATP: an adenosine dot with its three phosphates, drifting out into the matrix
    let n = 0;
    BETAS.forEach((cp, b) => {
      for (let k = Math.floor(T - BBASE[b]); k >= Math.ceil(T - BBASE[b] - 1.25) && n < NATP; k--) {
        const age = T - BBASE[b] - k, g = 1 - Math.pow(1 - Math.min(age, 1), 2), i0 = NP + 4 * n;
        const c = az(0.24 + 0.4 * g, cp.phi - (24 + 12 * age) * D, YH - 0.05 + 0.1 * g + 0.06 * age);
        const al = K.smooth(age / 0.04) * (1 - K.smooth((age - 0.8) / 0.45)) * flow;
        const w = age * 4 + k * 1.7 + b, dir = v3.norm([Math.cos(w), 0.6 * Math.sin(w * 0.7), Math.sin(w)]);
        P.set(c, 3 * i0); A[i0] = al; SZ[i0] = 0.065 * (1 + 1.6 * Math.exp(-age * 10));
        for (let q = 1; q < 4; q++) { P.set(v3.add(c, v3.mul(dir, 0.02 + 0.02 * q)), 3 * (i0 + q)); A[i0 + q] = al; SZ[i0 + q] = 0.03; }
        n++;
      }
    });
    for (; n < NATP; n++) for (let q = 0; q < 4; q++) { P.set(ZERO, 3 * (NP + 4 * n + q)); A[NP + 4 * n + q] = 0; }
    MOUTH.forEach(([p, u], i) => {
      const ph = ((((T - TAU0 - u) * 8) % 1) + 1) % 1;
      A[NM + i] = flow * (0.22 + 0.35 * Math.exp(-ph * 5));
    });
    dynG.attributes.position.needsUpdate = dynG.attributes.aA.needsUpdate = dynG.attributes.aSize.needsUpdate = true;
  }

  // ------------------------------------------------------------------ network of contacts (slide 15)
  const EDGES = ('ATP5A1-ATP5B ATP5A1-ATP5C1 ATP5B-ATP5C1 ATP5C1-ATP5D ATP5C1-ATP5E ATP5D-ATP5E ATP5C1-ATP5G1 ATP5E-ATP5G1 ' +
    'ATP5D-ATP5G2 ATP5G1-ATP5G2 ATP5G2-ATP5G3 ATP5G1-ATP5G3 ATP5G3-MT-ATP6 ATP5G2-MT-ATP6 MT-ATP6-ATP5F1 ' +
    'ATP5F1-ATP5O ATP5O-ATP5A1 ATP5O-ATP5B ATP5F1-ATP5A1 ATPAF1-ATP5B ATPAF2-ATP5A1').split(' ').map(e => {
    const a = SYM.find(s => e.startsWith(s + '-') && SYM.includes(e.slice(s.length + 1)));
    return [ci(a), ci(e.slice(a.length + 1))];
  });
  const centre = cp => cp.P1;
  // where each part's node sits (rest pose; rotor nodes turn with the rotor, c nodes stay at the front of the ring)
  const NODE = COMP.map(() => null);
  NODE[0] = v3.add(centre(ALPHA_F), v3.mul(er(ALPHA_F.phi), 0.05));
  NODE[1] = v3.add(centre(BETA_F), v3.mul(er(BETA_F.phi), 0.05));
  NODE[2] = v3.add(centre(AF1), v3.mul(AF1.drift, 0.45));
  NODE[3] = v3.add(centre(AF2), v3.mul(AF2.drift, 0.45));
  NODE[4] = az(0.05, PG, -0.1); NODE[5] = centre(DL); NODE[6] = centre(EP);
  NODE[7] = az(0.36, PA - 2 * D, -0.1); NODE[8] = centre(OS); NODE[9] = az(0.27, PA, YM);
  NODE[10] = az(0.2, -122 * D, YM + 0.02); NODE[11] = az(0.2, -90 * D, YM - 0.03); NODE[12] = az(0.2, -58 * D, YM + 0.02);
  const ROTN = [4, 5, 6], HOME = [0, -OY / Z, 0];
  // nodes and edges draw without depth test and after everything else in the set (surface 2, membrane and
  // haze 3, protons 4), so they sit on top of the ghost and fade in evenly with atp_net
  const netA = { value: 0 }, netOpts = { uniforms: { uN: netA }, head: 'uniform float uN;', vertex: 'vA *= uN;' };
  const npG = K.pointsGeo(26 + 42), npM = K.points(set, netOpts), NA = npG.attributes;
  npM.depthTest = false;
  for (let i = 0; i < 13; i++) {
    NA.aCol.array.set([0.3, 0.58, 1], 6 * i); NA.aSize.array[2 * i] = 0.085; NA.aA.array[2 * i] = 0.95;
    NA.aCol.array.set([0.85, 0.93, 1], 6 * i + 3); NA.aSize.array[2 * i + 1] = 0.03;
  }
  for (let i = 26; i < 68; i++) { NA.aCol.array.set([0.6, 0.8, 1], 3 * i); NA.aSize.array[i] = 0.026; }
  const netPts = new THREE.Points(npG, npM);
  netPts.frustumCulled = false;
  const elG = K.linesGeo(21), elM = K.lines(set, netOpts);
  elM.depthTest = false;
  for (let i = 0; i < 21; i++) {
    elG.attributes.aCol.array.set([0.36, 0.62, 1, 0.36, 0.62, 1], 6 * i); elG.attributes.aA.array.set([0.85, 0.85], 2 * i);
  }
  const netLines = new THREE.LineSegments(elG, elM);
  netLines.frustumCulled = false;
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uN: netA, uC: { value: C3('#4d94ff') } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN, vV;
void main() {
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform float uA, uN; uniform vec3 uC; varying vec3 vN, vV;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV))); f *= f;
  gl_FragColor = vec4(uC * (0.5 + 0.8 * f), uA * uN * 0.55 * f);
}`,
  });
  set.mats.push(glowMat);
  const glow = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), glowMat, 21);
  glow.frustumCulled = false;
  netLines.renderOrder = glow.renderOrder = netPts.renderOrder = 6;
  cx.add(netLines, glow, netPts);

  // ------------------------------------------------------------------ update
  const cur = { build: 0, net: 0, shrink: 0, ang: 0, f: COMP.map(() => 0) };
  const nodePos = i => {
    let p = ROTN.includes(i) ? rotY(NODE[i], cur.ang) : NODE[i];
    return v3.lerp(p, HOME, prog(cur.shrink, 0, 0.8));
  };
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Qa = new THREE.Quaternion(), Qs = new THREE.Quaternion();
  const YAX = new THREE.Vector3(0, 1, 0), PV = new THREE.Vector3(), SV = new THREE.Vector3();
  function update(S, t) {
    const parts = S.atp_parts, colour = S.atp_colour, build = S.atp_build, turns = S.atp_turns, flow = S.atp_flow;
    const net = S.atp_net, shrink = S.atp_shrink, ang = TAU * turns;
    Object.assign(cur, { build, net, shrink, ang });
    // chains: draw themselves in the grid, float, fly to their places, thin away as the surface grows
    for (const C of COMP) {
      const rev = Math.max(prog(parts, C.d0, C.d0 + 0.45), prog(build, 0, 0.06)), thin = prog(build, C.s1 + 0.32, C.s1 + 0.6);
      cur.f[C.i] = prog(build, C.s0, C.s0 + 0.32);
      // (hidden once thinned to an eighth of its radius: sub-pixel, and under the surface by then)
      C.mesh.visible = rev > 0.002 && thin < 0.88;
      if (!C.mesh.visible) continue;
      // thinning by exactly the tube radius collapses a ring to its centre line (zero-area triangles, nothing drawn)
      C.uRev.value = rev * 1.01; C.uThin.value = thin * C.tubeR;
      C.uThinT.value = prog(build, C.s1 + 0.24, C.s1 + 0.42) * C.tubeR;
      C.mat.color.copy(GREY).lerp(C.gcol, colour).lerp(C.ccol, 0.85 * cur.f[C.i]);
      const n = build > 0 ? C.copies.length : 1;
      C.mesh.count = n;
      for (let k = 0; k < n; k++) {
        const cp = C.copies[k], f = prog(build, cp.s0, cp.s0 + 0.32), fl = 1 - f;
        const sw = Math.sin(t * 0.4 + C.i * 1.3) * 0.35 * fl, bob = Math.sin(t * 0.7 + C.i) * 0.012 * fl;
        const P0 = v3.add(C.p0, [0, bob, 0]), P1 = toSet(cp.rotor ? rotY(cp.P1, ang) : cp.P1);
        const ctrl = v3.add(v3.lerp(P0, P1, 0.5), [(k - (n - 1) / 2) * 0.3, 0.18, 0.5]);
        PV.set(...bez(P0, ctrl, P1, f));
        Qs.setFromAxisAngle(YAX, sw).multiply(C.q0);
        Q.copy(cp.q1);
        if (cp.rotor) Q.premultiply(Qa.setFromAxisAngle(YAX, ang));
        Qs.slerp(Q, f);
        SV.setScalar(lerp(1, Z * cp.s1, f) * (0.8 + 0.2 * rev));
        C.mesh.setMatrixAt(k, M4.compose(PV, Qs, SV));
      }
      C.mesh.instanceMatrix.needsUpdate = true;
    }
    // surface: grows from the docked chains; beta subunits breathe as the rotor's bulge passes; helpers leave
    // (only the spheres that have started growing are drawn)
    const a = set.uA.value, ns = started(build - 0.0001);
    const sOp = (1 - 0.86 * net) * (1 - prog(shrink, 0, 0.12)) * (1 - net * (1 - prog(a, 0.7, 1)));
    sg.instanceCount = pg.instanceCount = Math.max(1, ns);
    sph.visible = ns > 0 && sOp > 0.002;
    sphMat.opacity = a * sOp;
    sphMat.depthWrite = sphMat.opacity > 0.97;
    pre.visible = sph.visible && sOp < 0.97 && shrink < 0.12 && a > 0.7;
    SU.uBuild.value = build; SU.uColour.value = colour; SU.uAng.value = ang;
    SU.uRim.value = 0.32 + 0.4 * net;
    for (const cp of BETAS) {
      const o = Math.pow(Math.max(0, Math.cos(PG + ang - cp.phi)), 3);
      SU.uCp.value[cp.i].set(...v3.mul(er(cp.phi - 25 * D), 0.018 * o), 1);
    }
    for (const cp of [AF1, AF2]) {
      const d = prog(build, 0.7, 0.96);
      SU.uCp.value[cp.i].set(...v3.mul(cp.drift, d), 1 - prog(build, 0.78, 0.99));
    }
    // membrane, protons, ATP
    memA.value = prog(build, 0.5, 0.92) * (1 - 0.9 * net) * (1 - prog(shrink, 0, 0.45));
    mem.visible = memA.value > 0.002;
    hazeA.value = flow * (1 - net);
    haze.visible = hazeA.value > 0.002;
    dyn.visible = flow * (1 - net) > 0.002 && build > 0.5;
    if (dyn.visible) protons(turns, flow * (1 - net) * prog(build, 0.85, 1));
    // network
    netA.value = net * (1 - prog(shrink, 0.35, 0.7));
    netPts.visible = netLines.visible = glow.visible = netA.value > 0.002;
    if (netPts.visible) {
      const P = npG.attributes.position.array, E = elG.attributes.position.array, A = npG.attributes.aA.array;
      const nodes = COMP.map((c, i) => nodePos(i)), hot = 1 + 0.8 * prog(shrink, 0.4, 0.9);
      nodes.forEach((p, i) => { P.set(p, 6 * i); P.set(p, 6 * i + 3); A[2 * i + 1] = Math.min(1, 0.9 * hot); });
      EDGES.forEach(([a, b], i) => {
        const pa = nodes[a], pb = nodes[b], l = v3.dist(pa, pb);
        E.set([...pa, ...pb], 6 * i);
        PV.set(...v3.lerp(pa, pb, 0.5));
        Q.setFromUnitVectors(YAX, _v.set(...v3.sub(pb, pa)).normalize());
        glow.setMatrixAt(i, M4.compose(PV, Q, SV.set(0.011, Math.max(l, 1e-4), 0.011)));
        for (let h = 0; h < 2; h++) {
          const u = (t * 0.32 + i * 0.137 + h * 0.5) % 1, k = 26 + 2 * i + h;
          P.set(v3.lerp(pa, pb, u), 3 * k); A[k] = Math.sin(Math.PI * u) * 0.8 * (1 - prog(shrink, 0, 0.5));
        }
      });
      npG.attributes.position.needsUpdate = npG.attributes.aA.needsUpdate = elG.attributes.position.needsUpdate = true;
      glow.instanceMatrix.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ anchors, labels, views, explore
  // a part's anchor: above its chain in the grid, then on its node in the complex
  const partAt = i => () => {
    const c = toSet(nodePos(i)), g = COMP[i].label;
    return v3.lerp(g, c, Math.max(cur.f[i], prog(cur.build, 0, 0.3)));
  };
  const anchors = {
    head: toSet(az(0.27, -150 * D, YH + 0.1)), rotor: toSet(az(0.21, -150 * D, YM + 0.06)),
    membrane: toSet(az(0.72, -165 * D, YM)), stalk: toSet(az(0.36, PA - 3 * D, -0.05)), shaft: toSet(az(0.07, -90 * D, -0.15)),
    ring: toSet(az(0.2, -90 * D, YM)), matrix: toSet(az(0.62, -140 * D, YH)), ims: toSet(az(0.55, -135 * D, YM - 0.22)),
    atpOut: toSet(az(0.5, BETA_F.phi - 32 * D, YH + 0.1)), protonsIn: toSet(az(0.36, PIN, YM - 0.25)), centre: [0, 0, 0],
  };
  COMP.forEach((c, i) => { anchors[c.s] = partAt(i); });
  const built = S => K.prog(S.atp_build, 0.86, 1) * (1 - S.atp_net);
  const labels = COMP.map(c => ({ text: [c.s, c.role], at: c.s, cls: '', alpha: S => S.atp_parts * (1 - K.prog(S.atp_build, 0, 0.1)) }))
    .concat([
      { text: ['Head', '(makes ATP)'], at: 'head', cls: 'cyn', alpha: built },
      { text: ['Rotor', ''], at: 'rotor', cls: 'mag', alpha: built },
      { text: ['Membrane', ''], at: 'membrane', cls: '', alpha: built },
      { text: ['Protons', 'flow in'], at: 'protonsIn', cls: 'cyn', alpha: S => K.prog(S.atp_flow, 0.5, 1) * built(S) },
      { text: ['ATP', 'out'], at: 'atpOut', cls: 'amb', alpha: S => K.prog(S.atp_flow, 0.5, 1) * built(S) },
    ]);
  // explore: while running the rotor keeps turning from wherever it was; on leaving it coasts a little and
  // stops (rather than easing back to 0, which would spin it backwards). Only this mapping keeps memory;
  // update() itself stays a pure function of the params. The base angle is taken from the first update()
  // after a change of view (or a reopening): until then S0 may be stale (the set was not drawn while the
  // story or another scene changed atp_turns), so the target simply holds the last known angle.
  const S0 = { turns: 0, fresh: false };
  let base = 0, lastView = '', lastT = 0, coast = 0, pending = true;
  function explore(c) {
    const v = c.view;
    if (v !== lastView || c.t < lastT) { coast = lastView === 'running' ? 0.1 : 0; pending = true; S0.fresh = false; }
    if (pending && S0.fresh) { base = S0.turns; pending = false; }
    lastView = v; lastT = c.t;
    return {
      atp_parts: 1, atp_colour: 1, atp_build: v === 'parts' ? 0 : 1, atp_flow: v === 'running' ? 1 : 0,
      atp_turns: pending ? S0.turns : v === 'running' ? base + c.t * 0.35 : base + coast,
      atp_net: v === 'network' ? 1 : 0, atp_shrink: 0,
    };
  }
  const upd = (S, t, dt) => { S0.turns = S.atp_turns; S0.fresh = true; update(S, t, dt); };
  // for panel text and explore: the parts with their current HGNC symbols, what they are and how many copies
  const INFO = {
    ATP5A1: ['ATP5F1A', 'subunit alpha (head)'], ATP5B: ['ATP5F1B', 'subunit beta (head, makes ATP)'],
    ATPAF1: ['ATPAF1', 'assembly factor, binds beta'], ATPAF2: ['ATPAF2', 'assembly factor, binds alpha'],
    ATP5C1: ['ATP5F1C', 'subunit gamma (central stalk)'], ATP5D: ['ATP5F1D', 'subunit delta (central stalk)'],
    ATP5E: ['ATP5F1E', 'subunit epsilon (central stalk)'], ATP5F1: ['ATP5PB', 'subunit b (peripheral stalk)'],
    ATP5O: ['ATP5PO', 'OSCP (caps the peripheral stalk)'], 'MT-ATP6': ['MT-ATP6', 'subunit a (mitochondrial DNA)'],
    ATP5G1: ['ATP5MC1', 'subunit c (rotor ring)'], ATP5G2: ['ATP5MC2', 'subunit c (rotor ring)'],
    ATP5G3: ['ATP5MC3', 'subunit c (rotor ring)'],
  };
  const parts = COMP.map(c => ({ sym: c.s, hgnc: INFO[c.s][0], name: INFO[c.s][1], copies: c.copies.length }));
  return Object.assign(set, {
    parts, contacts: EDGES.map(([a, b]) => [SYM[a], SYM[b]]),
    params: { atp_a: 1, atp_parts: 1, atp_colour: 0, atp_build: 0, atp_turns: 0, atp_flow: 0, atp_net: 0, atp_shrink: 0 },
    update: upd, anchors, labels,
    cam: {
      default: [0, 4, 3.5, 0, 0, 0], parts: [0, 4, 3.5, 0, 0, 0], complex: [-10, -8, 2.9, 0, 0.02, 0],
      top: [-25, 40, 2.8, 0, -0.05, 0], running: [-28, -4, 2.4, 0, -0.12, 0], network: [15, 8, 2.9, 0, 0.02, 0],
    },
    controls: [{
      key: 'view', label: 'View', options: [['parts', 'Parts'], ['complex', 'Complex'], ['running', 'Running'], ['network', 'Network']],
    }],
    explore,
  });
};

// Rare diseases (slides 24-27): a crowd of people with one patient picked out in red, and a 3D Sankey diagram of the
// inborn errors of immunity (clinical categories against interactome clusters, Guthrie et al., Science Advances 2023).

// ------------------------------------------------------------------------------------------------ the crowd
SETS.crowd = function (K) {
  const { THREE, smooth, clamp, lerp } = K;
  const set = K.newSet('crowd');
  const r = K.rng(24);
  // People stand on arcs around a point in front of the crowd, so the rows bend gently towards the viewer.
  // The crowd is the middle of the first rows (about 400 people); crowd_grow fills in the people around and behind
  // it, outwards, into a sea of 6,000 that reaches the horizon.
  const R0 = 2.3, DR = 0.09, SP = 0.095, PHI = 0.28, PHW = 0.8, BASE = 400, ALL = 6000, PS = 0.9;
  const P = [];
  let nBase = 0, Rb = 0, R = R0;
  for (let row = 0; P.length < ALL; row++) {
    // further back people stand a little further apart
    const e = smooth((R - 4) / 7), sp = SP * (1 + 0.3 * e), inBase = !Rb;
    let n = Math.round(2 * PHW * R / sp);
    if ((n + row) % 2) n++;   // alternate odd and even rows so each row stands in the gaps of the one in front
    let rowP = [];
    for (let i = 0; i < n; i++) {
      // looser outside the first crowd, so the sea does not look like a grid
      const a0 = (i - (n - 1) / 2) * sp / R, loose = !inBase || Math.abs(a0) > PHI + 0.02, jit = loose ? 0.55 + 0.25 * e : 0.3;
      const a = a0 + (r() - 0.5) * jit * sp / R, rr = R + (r() - 0.5) * (jit + 0.1) * DR;
      const base = inBase && Math.abs(a) <= PHI;
      if (base) nBase++;
      rowP.push({ x: rr * Math.sin(a), z: -rr * Math.cos(a), a, R, row, h: PS * (0.9 + 0.18 * r()), w: PS * (0.92 + 0.14 * r()),
        rot: r() * 6.283, g: 0.27 + 0.08 * r(), s: r(), base });
    }
    if (P.length + n > ALL) rowP = rowP.sort((p, q) => Math.abs(p.a) - Math.abs(q.a)).slice(0, ALL - P.length);
    P.push(...rowP);
    R += DR * (1 + 0.3 * e);
    if (inBase && nBase >= BASE) Rb = R;
  }
  const Rmax = P[P.length - 1].R;
  // centre the first crowd on the origin (the rows bend around (0, CZ))
  const bz = P.filter(p => p.base).map(p => p.z), CZ = -(Math.min(...bz) + Math.max(...bz)) / 2;
  for (const p of P) p.z += CZ;
  const RAD = Math.max(...P.filter(p => p.base).map(p => Math.hypot(p.x, p.z))) + 0.04;
  // order in which the others appear (0..1): their distance from the first crowd
  const gd = p => Math.hypot(Math.max(0, p.R - Rb), Math.max(0, Math.abs(p.a) - PHI) * p.R);
  const others = P.filter(p => !p.base).sort((p, q) => gd(p) - gd(q));
  others.forEach((p, i) => { p.gr = i / (others.length - 1); });   // by rank, so they appear at an even rate
  for (const p of P) if (p.base) p.gr = -1;
  // the patient: a little left of centre, a few rows back (as on the slide)
  const red = P.filter(p => p.row === 3 && p.base).sort((p, q) => Math.abs(p.x + 0.22) - Math.abs(q.x + 0.22))[0];

  // A person like the icons on slide 24: a robe-like body with round shoulders, a short neck and a ball head.
  // Three levels of detail (see the tiers below), since the far rows are only a few pixels tall; even the coarsest
  // keeps shoulders, a neck and a blunt head, so it never reads as a spike.
  function person(seg, lod) {
    const pts = [], add = (x, y) => pts.push([x, y]);
    const head = (n, a0) => { for (let k = 0; k <= n; k++) { const a = a0 + k / n * (Math.PI / 2 - a0); add(0.023 * Math.cos(a), 0.123 + 0.023 * Math.sin(a)); } };
    add(0.04, 0);
    if (lod === 0) {
      add(0.0403, 0.03); add(0.037, 0.066);
      for (let k = 1; k <= 3; k++) { const a = k / 3 * Math.PI / 2; add(0.019 + 0.018 * Math.cos(a), 0.066 + 0.026 * Math.sin(a)); }
      add(0.0095, 0.098); head(5, -Math.PI / 3);
    } else if (lod === 1) {
      add(0.037, 0.066); add(0.025, 0.09); add(0.0095, 0.098); head(3, -Math.PI / 3);
    } else {
      // shoulders, a pinched neck and a blunt head: still a person at a few pixels
      add(0.035, 0.072); add(0.012, 0.099); add(0.022, 0.126); add(0, 0.146);
    }
    // a lathe whose crown is a fan on one vertex (LatheGeometry would spend a degenerate triangle per segment there)
    const n = pts.length - 1, pos = [], idx = [];
    for (let k = 0; k < n; k++) for (let s = 0; s < seg; s++) { const a = s / seg * 2 * Math.PI; pos.push(pts[k][0] * Math.sin(a), pts[k][1], pts[k][0] * Math.cos(a)); }
    pos.push(0, pts[n][1], 0);
    for (let k = 0; k < n - 1; k++) for (let s = 0; s < seg; s++) {
      const a = k * seg + s, b = k * seg + (s + 1) % seg;
      idx.push(a, b, b + seg, a, b + seg, a + seg);
    }
    for (let s = 0; s < seg; s++) idx.push((n - 1) * seg + s, (n - 1) * seg + (s + 1) % seg, n * seg);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const G = { value: 0 };   // crowd_grow, shared by every crowd shader
  const LP = { value: new THREE.Vector3(red.x, 0.08, red.z) };   // where the patient's glow comes from
  // lit people: grow-in (scale up from the floor), a slight sway, and a cool rim so they read against the dark
  // (rk: rim strength; weaker on the coarser tiers, where a strong rim would trace their facets)
  function crowdMat(rk) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.0 });
    const u = { uRim: { value: new THREE.Color(0.1, 0.15, 0.24) }, uSpill: { value: 0 } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uGrow: G, uTime: K.U.uTime, uRim: u.uRim, uSpill: u.uSpill, uLP: LP });
      sh.vertexShader = 'attribute float aR, aS;\nuniform float uGrow, uTime;\nuniform vec3 uLP;\nvarying vec3 vLP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
  vec3 transformed = vec3(position);
  float gv = aR < 0.0 ? 1.0 : clamp((uGrow * 1.3 - aR) / 0.3, 0.0, 1.0);
  float hh = transformed.y / 0.146;
  transformed.x += sin(uTime * 0.9 + aS * 6.283) * 0.006 * hh * hh;
  transformed *= gv * gv * (3.0 - 2.0 * gv);
  vLP = (viewMatrix * modelMatrix * vec4(uLP, 1.0)).xyz;`);
      // the patient's red glow lights the people around them
      sh.fragmentShader = 'uniform vec3 uRim;\nuniform float uSpill;\nvarying vec3 vLP;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += uRim * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
  vec3 ld = vLP + vViewPosition; float ll = length(ld);
  totalEmissiveRadiance += vec3(1.0, 0.3, 0.22) * uSpill * max(dot(normal, ld / ll), 0.0) * 0.006 / (0.004 + ll * ll);`);
    };
    m.userData.u = u; m.userData.rk = rk;
    return K.fade(set, m, 1);
  }
  const mat = crowdMat(1), midMat = crowdMat(0.7), farMat = crowdMat(0.45), redMat = crowdMat(1);
  const greys = [mat, midMat, farMat];
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  const place = p => M4.compose(V.set(p.x, 0, p.z), Q.setFromAxisAngle(Y, p.rot), Sc.set(p.w, p.h, p.w));
  function tier(list, seg, lod, m) {
    const g = person(seg, lod), n = list.length;
    const aR = new Float32Array(n), aS = new Float32Array(n);
    const mesh = new THREE.InstancedMesh(g, m, n);
    list.forEach((p, i) => {
      mesh.setMatrixAt(i, place(p));
      // further rows fade towards the background colour (air between us and them)
      const k = 1 - 0.6 * smooth((Math.hypot(p.x, p.z) - 1.2) / 7);
      if (m === redMat) mesh.setColorAt(i, new THREE.Color(1, 1, 1));
      else mesh.setColorAt(i, new THREE.Color(p.g * k + 0.016 * (1 - k), p.g * k + 0.035 * (1 - k), p.g * 1.03 * k + 0.07 * (1 - k)));
      aR[i] = p.gr; aS[i] = p.s;
    });
    g.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 1));
    g.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 1));
    mesh.frustumCulled = false;
    mesh.userData.gr = aR;
    set.group.add(mesh);
    return mesh;
  }
  // the first crowd back to front (correct overlaps while the set fades); the others by gr (so count trims them),
  // in less detail the further they stand from the usual views (all frontal: the grown crowd is only in the story):
  // 8, 6, 5 and 3 sides (184, 78, 35 and 21 triangles)
  const dC = p => Math.hypot(p.x, p.z - 0.6), D1 = 2.1, D2 = 3;
  const byGr = (p, q) => p.gr - q.gr;
  const near = tier(P.filter(p => p.base && p !== red).sort((p, q) => p.z - q.z), 8, 0, mat);
  const mid = tier(P.filter(p => !p.base && dC(p) < D1).sort(byGr), 6, 1, midMat);
  const far = tier(P.filter(p => !p.base && dC(p) >= D1 && dC(p) < D2).sort(byGr), 5, 2, farMat);
  const far2 = tier(P.filter(p => !p.base && dC(p) >= D2).sort(byGr), 3, 2, farMat);
  const redMesh = tier([red], 14, 0, redMat);
  far2.renderOrder = 0; far.renderOrder = 1; mid.renderOrder = 2; near.renderOrder = 3; redMesh.renderOrder = 3;
  // how many grown people are up for a given crowd_grow (they are sorted by gr)
  const upTo = (arr, g) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < g) lo = m + 1; else hi = m; } return lo; };

  // soft contact shadows under the nearer rows (instanced flat quads)
  const shP = P.filter(p => p.base || dC(p) < D1).sort(byGr);
  const shG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shR = new Float32Array(shP.length);
  shP.forEach((p, i) => { shR[i] = p.gr; });
  shG.setAttribute('aR', new THREE.InstancedBufferAttribute(shR, 1));
  const shMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uGrow: G },
    transparent: true, depthWrite: false,
    vertexShader: `attribute float aR; uniform float uGrow; varying vec2 vUv;
void main() {
  vUv = uv;
  float gv = aR < 0.0 ? 1.0 : clamp((uGrow * 1.3 - aR) / 0.3, 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position * gv, 1.0);
}`,
    fragmentShader: `uniform float uA; varying vec2 vUv;
void main() { float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.0, 0.004, 0.012, (1.0 - smoothstep(0.25, 1.0, d)) * 0.6 * uA); }`,
  });
  set.mats.push(shMat);
  const shadows = new THREE.InstancedMesh(shG, shMat, shP.length);
  shP.forEach((p, i) => shadows.setMatrixAt(i, M4.compose(V.set(p.x, 0.0015, p.z), Q.set(0, 0, 0, 1), Sc.set(0.1 * p.w, 1, 0.085 * p.w))));
  shadows.frustumCulled = false; shadows.renderOrder = -1;
  set.group.add(shadows);
  const nShBase = shP.filter(p => p.base).length, shRest = shR.subarray(nShBase);

  // the floor: a dark disc that fades out at its edge and widens as the crowd grows; a pool of light under the patient
  // (uC: centre z, then the x and z radii of the disc)
  const flMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uRed: { value: 0 }, uRP: { value: new THREE.Vector2(red.x, red.z) }, uC: { value: new THREE.Vector3(0, 1.45, 1.45) } },
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA, uRed; uniform vec2 uRP; uniform vec3 uC; varying vec3 vP;
void main() {
  float d = length(vec2(vP.x / uC.y, (vP.z - uC.x) / uC.z));
  vec3 col = mix(vec3(0.075, 0.105, 0.16), vec3(0.03, 0.045, 0.075), smoothstep(0.0, 0.9, d));
  float pr = length(vP.xz - uRP);
  col *= 1.0 - 0.45 * uRed;
  col += uRed * (vec3(1.0, 0.3, 0.25) * 0.5 * exp(-pr * pr / 0.02) + vec3(1.0, 0.86, 0.8) * 0.3 * (1.0 - smoothstep(0.075, 0.11, pr)));
  gl_FragColor = vec4(col, (1.0 - smoothstep(0.5, 1.0, d)) * 0.92 * uA);
}`,
  });
  set.mats.push(flMat);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2).translate(0, 0, -8), flMat);
  floor.renderOrder = -2; floor.frustumCulled = false;
  set.group.add(floor);

  // a soft beam of light from above onto the patient: brighter face-on, fading at its edges and towards the top
  const BH = 1.6, BR = 0.11;
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uRed: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN, vW; varying float vY;
void main() {
  vY = position.y / ${BH.toFixed(2)};
  vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float uA, uRed; varying vec3 vN, vW; varying float vY;
void main() {
  float f = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  float a = pow(f, 1.5) * (1.0 - vY) * (1.0 - vY) * smoothstep(0.06, 0.3, vY) * 0.55 * uRed * uA;
  gl_FragColor = vec4(vec3(1.0, 0.82, 0.76) * a, a);
}`,
  });
  set.mats.push(beamMat);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(BR, BH, 40, 1, true).translate(0, BH / 2, 0), beamMat);
  beam.position.set(red.x, 0, red.z); beam.renderOrder = 4;
  set.group.add(beam);
  // dust in the beam, drifting down; and a red glow around the patient
  const NM = 70, mg = K.pointsGeo(NM + 1);
  for (let i = 0; i < NM; i++) {
    mg.attributes.position.array.set([r() * 6.283, Math.sqrt(r()) * 0.9, r()], 3 * i);
    mg.attributes.aCol.array.set([1, 0.9, 0.82], 3 * i);
    mg.attributes.aSize.array[i] = 0.006 + 0.006 * r();
    mg.attributes.aA.array[i] = 0.5 + 0.5 * r();
  }
  mg.attributes.position.array.set([0, 0, -1], 3 * NM);   // the glow (z < 0 marks it)
  mg.attributes.aCol.array.set(K.rgb('#ff5a4b'), 3 * NM);
  mg.attributes.aSize.array[NM] = 0.42;
  mg.attributes.aA.array[NM] = 0.42;
  const moteMat = K.points(set, {
    uniforms: { uRed: { value: 0 }, uC: { value: new THREE.Vector3(red.x, 0, red.z) } },
    head: 'uniform float uRed; uniform vec3 uC;',
    vertex: `
  if (position.z < 0.0) {
    pos = uC + vec3(0.0, 0.075 * ${red.h.toFixed(3)}, 0.0);
    vA *= uRed * (0.85 + 0.15 * sin(uTime * 2.2));
  } else {
    float yy = fract(position.z - uTime * 0.035) * 1.35;
    float rr = position.y * ${BR} * (1.0 - yy / ${BH.toFixed(2)});
    pos = uC + vec3(cos(position.x + uTime * 0.1) * rr, yy, sin(position.x + uTime * 0.1) * rr);
    vA *= uRed * smoothstep(0.0, 0.2, yy) * (1.0 - smoothstep(0.9, 1.35, yy)) * (0.6 + 0.4 * sin(uTime * 1.7 + position.x * 9.0));
  }
  mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);`,
  });
  const motes = new THREE.Points(mg, moteMat);
  motes.frustumCulled = false; motes.renderOrder = 5;
  set.group.add(motes);

  const GREY = new THREE.Color(red.g, red.g, red.g * 1.03), RED = new THREE.Color('#ff5a4b'), DEEP = new THREE.Color(0.72, 0.1, 0.07);
  const zB = CZ - Rb, zMax = CZ - Rmax;
  return Object.assign(set, {
    params: { crowd_a: 1, crowd_red: 0, crowd_grow: 0 },
    update(S, t) {
      const rd = clamp(S.crowd_red, 0, 1), gw = clamp(S.crowd_grow, 0, 1);
      G.value = gw;
      // people write depth even while fading, so the crowd stays solid instead of turning to glass
      for (const m of greys) {
        m.depthWrite = true;
        m.color.setScalar(1 - 0.66 * rd);
        m.userData.u.uSpill.value = rd;
        m.userData.u.uRim.value.setRGB(0.1, 0.15, 0.24).multiplyScalar((1 - 0.6 * rd) * m.userData.rk);
      }
      redMat.depthWrite = true;
      redMat.color.copy(GREY).lerp(DEEP, rd);
      redMat.emissive.copy(RED).multiplyScalar(rd * (0.3 + 0.06 * Math.sin(t * 2.2)));
      redMat.userData.u.uRim.value.setRGB(0.1, 0.15, 0.24).lerp(RED, rd);
      flMat.uniforms.uRed.value = beamMat.uniforms.uRed.value = moteMat.uniforms.uRed.value = rd;
      beam.visible = motes.visible = rd > 0.002;
      // grown rows: only draw the ones that have started to rise
      const g = gw * 1.3;
      for (const m of [mid, far, far2]) { m.count = upTo(m.userData.gr, g); m.visible = m.count > 0; }
      shadows.count = nShBase + upTo(shRest, g);
      // the floor follows the crowd back
      const e = smooth(gw);
      flMat.uniforms.uC.value.set(lerp(0, (zB + zMax) / 2 - 0.6, e), lerp(1.45, 7.5, e), lerp(1.45, 6.2, e));
    },
    anchors: {
      red: [red.x, 0.165 * red.h, red.z], crowd: [0, 0.07, 0], front: [0, 0.07, CZ - R0], back: [0, 0.07, zB],
      far: [0, 0.07, (zB + zMax) / 2], horizon: [0, 0.07, zMax],
    },
    labels: [],
    cam: {
      default: [0, 20, 3.6, 0, 0.04, 0],
      close: [12, 22, 0.95, red.x, 0.085, red.z],
      wide: [0, 24, 5.6, 0, 0, -1.4],
    },
    controls: [],
    explore() { return {}; },
    // the first crowd is about 2.3 wide and 2 deep: wider than the usual radius 1.1, so it says how far it reaches
    radius: +RAD.toFixed(2), count: ALL, baseCount: nBase,
  });
};

// ------------------------------------------------------------------------------------------------ the Sankey
SETS.sankey = function (K) {
  const { THREE, smooth, clamp, prog } = K;
  const set = K.newSet('sankey');
  // [name, short name, genes, colour]; counts and colours from Guthrie et al. (2023), slide 27
  const CL = [
    ['Autoinflammatory disorders', 'Autoinflammatory', 40, '#4bb8d6'],
    ['Combined immunodeficiencies with associated or syndromic features', 'Combined, syndromic', 19, '#f39a3c'],
    ['Immunodeficiencies affecting cellular and humoral immunity', 'Cellular and humoral', 27, '#e3534c'],
    ['Phenocopies of inborn errors of immunity', 'Phenocopies', 4, '#b07fd9'],
    ['Diseases of immune dysregulation', 'Immune dysregulation', 33, '#43b6c6'],
    ['Predominantly antibody deficiencies', 'Antibody deficiencies', 10, '#a2544f'],
    ['Congenital defects of phagocyte number or function', 'Phagocyte defects', 9, '#8d8d8d'],
    ['Defects in intrinsic and innate immunity', 'Intrinsic and innate', 3, '#e2c64a'],
    ['Complement deficiencies', 'Complement deficiencies', 28, '#e0535b'],
  ];
  const MO = [
    ['c23', 'c23', 1, '#8a8f98'],
    ['RNA remodelling and nucleotide', 'RNA and nucleotide', 19, '#9b6bd6'],
    ['Proteasome complex', 'Proteasome', 8, '#e0453a'],
    ['Calcium', 'Calcium', 2, '#3fae5a'],
    ['NF-κB and chromatin', 'NF-κB and chromatin', 22, '#2f9e44'],
    ['Regulation of cell death and survival', 'Cell death', 21, '#8c3b2e'],
    ['c4', 'c4', 3, '#6d7784'],
    ['Meiosis, antigen presentation', 'Meiosis, antigen presentation', 3, '#c84fd0'],
    ['Vesicular traffic', 'Vesicular traffic', 9, '#d9c63a'],
    ['Actin regulation', 'Actin regulation', 5, '#2d8fd6'],
    ['Transcription factors, DNA binding complex', 'Transcription factors', 19, '#7d6b5d'],
    ['TCR and BCR', 'TCR and BCR', 9, '#a855d8'],
    ['CD28 costimulation', 'CD28 costimulation', 4, '#c73fa0'],
    ['Interleukin and cytokine', 'Interleukin, cytokine', 7, '#1f7ac2'],
    ['Steroid resistant inflammation', 'Steroid resistant', 15, '#8a4b2a'],
    ['c19', 'c19', 1, '#5aa86c'],
    ['c9', 'c9', 1, '#9aa4ad'],
    ['Complement', 'Complement', 23, '#d6303a'],
    ['c3', 'c3', 1, '#c0c4c9'],
  ];
  // genes from clinical category (row) to molecular cluster (column). Illustrative: only the row and column
  // totals come from the paper (they are checked below).
  //       c23 RNA Prot Ca NFkB death c4 meio ves actin TF TCR CD28 IL ster c19 c9 C' c3
  const M = [
    [1, 8, 7, 0, 8, 4, 0, 0, 0, 0, 0, 0, 0, 2, 9, 0, 0, 1, 0],
    [0, 6, 0, 1, 2, 0, 1, 1, 1, 1, 5, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 2, 0, 1, 3, 0, 1, 2, 0, 1, 5, 6, 3, 3, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 2, 10, 1, 0, 7, 1, 6, 0, 1, 1, 3, 0, 1, 0, 0],
    [0, 1, 0, 0, 4, 1, 0, 0, 0, 0, 1, 3, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 3, 0, 0, 1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 22, 1],
  ];
  // one-word names for the explore buttons (the labels keep the longer short names)
  const BTN = ['Autoinflammatory', 'Syndromic', 'Cellular', 'Phenocopies', 'Dysregulation', 'Antibody', 'Phagocyte', 'Innate', 'Complement'];
  const nL = CL.length, nR = MO.length;
  const rowSum = M.map(row => row.reduce((s, v) => s + v, 0));
  const colSum = MO.map((_, j) => M.reduce((s, row) => s + row[j], 0));
  const total = rowSum.reduce((s, v) => s + v, 0);
  CL.forEach((c, i) => { if (rowSum[i] !== c[2]) throw new Error('sankey: row ' + c[0] + ' sums to ' + rowSum[i]); });
  MO.forEach((c, j) => { if (colSum[j] !== c[2]) throw new Error('sankey: column ' + c[0] + ' sums to ' + colSum[j]); });

  // layout: genes stack at U per gene; the 19 clusters with small gaps, the 9 categories spread to the same height
  const U = 0.0072, GR = 0.0125, H = total * U + (nR - 1) * GR, GL = (H - total * U) / (nL - 1);
  const XL = -0.95, XR = 0.5, BW = 0.07, BD = 0.16, TH = 0.012, XA = XL + BW / 2, XB = XR - BW / 2;
  const lTop = [], rTop = [];
  for (let i = 0, y = H / 2; i < nL; i++) { lTop.push(y); y -= rowSum[i] * U + GL; }
  for (let j = 0, y = H / 2; j < nR; j++) { rTop.push(y); y -= colSum[j] * U + GR; }
  const lMid = lTop.map((y, i) => y - rowSum[i] * U / 2), rMid = rTop.map((y, j) => y - colSum[j] * U / 2);
  // each category's ribbons run in their own depth layer (first category in front), so crossings read in 3D;
  // they ease into it and back out over the outer 35% of the span, so no ribbon bends sharply near a column
  const zP = CL.map((_, i) => ((nL - 1) / 2 - i) * 0.06), ZF = zP[0] + 0.1, RMP = 0.35;
  const DMAX = 0.36, delay = (i, j) => 0.3 * i / (nL - 1) + 0.06 * j / (nR - 1);
  const plateau = s => smooth(s / RMP) * smooth((1 - s) / RMP);

  // ---- ribbons: one mesh per category (so they sort by layer), each a thin band with four faces
  const FLOW = { value: 1 };
  function ribbonMat(col) {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.7), emissive: col, emissiveIntensity: 0.15, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide });
    const u = { uPop: { value: 0 }, uEdge: { value: new THREE.Color(col) } };
    m.onBeforeCompile = sh => {
      sh.uniforms.uFlow = FLOW; sh.uniforms.uPop = u.uPop; sh.uniforms.uEdge = u.uEdge;
      sh.vertexShader = 'attribute float aS, aD;\nvarying float vS, vF;\nuniform float uFlow, uPop;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vS = aS; vF = clamp((uFlow - aD) / ${(1 - DMAX).toFixed(3)}, 0.0, 1.0);
  transformed.z += uPop * smoothstep(0.0, ${RMP}, aS) * smoothstep(0.0, ${RMP}, 1.0 - aS);`);
      sh.fragmentShader = 'varying float vS, vF;\nuniform vec3 uEdge;\n' + sh.fragmentShader
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (vF < 0.002 || vS > vF) discard;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uEdge * 0.9 * (1.0 - smoothstep(0.0, 0.06, vF - vS)) * (1.0 - smoothstep(0.9, 1.0, vF));');
    };
    m.userData.u = u;
    return K.fade(set, m, 0.86);
  }
  const NS = 48;
  const xs = [[XL, 0]];
  for (let k = 0; k <= NS; k++) xs.push([XA + (XB - XA) * k / NS, k / NS]);
  xs.push([XR, 1]);
  const offL = new Array(nL).fill(0), offR = new Array(nR).fill(0);
  const ribbons = [], lanes = [];   // lanes: one per gene, for the travelling dots
  for (let i = 0; i < nL; i++) {
    const pos = [], aS = [], aD = [], idx = [];
    for (let j = 0; j < nR; j++) {
      const c = M[i][j];
      if (!c) continue;
      const y0 = lTop[i] - offL[i] * U, y1 = rTop[j] - offR[j] * U, d = delay(i, j), ins = Math.min(0.0007, c * U * 0.1);
      for (let l = 0; l < c; l++) lanes.push([y0 - (l + 0.5) * U, y1 - (l + 0.5) * U, i, d]);
      offL[i] += c; offR[j] += c;
      // four strips: front, back, top, bottom; each with its own vertices so the edges stay crisp
      for (let f = 0; f < 4; f++) {
        const v0 = pos.length / 3;
        for (const [x, s] of xs) {
          const sm = smooth(s), yT = y0 + (y1 - y0) * sm - ins, yB = yT - c * U + 2 * ins, z = zP[i] * plateau(s) - zP[i];
          const zf = z + TH / 2, zb = z - TH / 2;
          if (f === 0) pos.push(x, yT, zf, x, yB, zf);
          else if (f === 1) pos.push(x, yB, zb, x, yT, zb);
          else if (f === 2) pos.push(x, yT, zb, x, yT, zf);
          else pos.push(x, yB, zf, x, yB, zb);
          aS.push(s, s); aD.push(d, d);
        }
        for (let k = 0; k < xs.length - 1; k++) {
          const a = v0 + 2 * k, b = a + 2;
          idx.push(a, a + 1, b + 1, a, b + 1, b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
    g.setAttribute('aD', new THREE.Float32BufferAttribute(aD, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, ribbonMat(CL[i][3]));
    mesh.position.z = zP[i];   // sorts the translucent layers back to front from any side
    mesh.renderOrder = 1; mesh.frustumCulled = false;
    set.group.add(mesh);
    ribbons.push(mesh);
  }

  // ---- blocks: 9 + 19 lit boxes in one instanced mesh, glowing in their own colour
  const BG = { value: 0.2 };
  const bm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
  bm.onBeforeCompile = sh => {
    sh.uniforms.uGlow = BG;
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor * uGlow;');
  };
  K.fade(set, bm, 1);
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bm, nL + nR);
  blocks.frustumCulled = false;
  const bCol = [...CL, ...MO].map(c => new THREE.Color(c[3]));
  bCol.forEach((c, k) => blocks.setColorAt(k, c));
  set.group.add(blocks);
  const M4 = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), Sc = new THREE.Vector3(), C = new THREE.Color();

  // ---- one travelling dot per gene and lap: genes flowing from their clinical category to their cluster
  const NDOT = 3, dr = K.rng(27), dg = K.pointsGeo(lanes.length * NDOT);
  const dCat = new Float32Array(lanes.length * NDOT), dPh = new Float32Array(lanes.length * NDOT), dDl = new Float32Array(lanes.length * NDOT);
  lanes.forEach(([y0, y1, i, d], l) => {
    const col = K.v3.lerp(K.rgb(CL[i][3]), [1, 1, 1], 0.55);
    for (let k = 0; k < NDOT; k++) {
      const n = l * NDOT + k;
      dg.attributes.position.array.set([y0, y1, zP[i]], 3 * n);
      dg.attributes.aCol.array.set(col, 3 * n);
      dg.attributes.aSize.array[n] = 0.011;
      dg.attributes.aA.array[n] = 0.75;
      dCat[n] = i; dPh[n] = (k + dr() * 0.8) / NDOT; dDl[n] = d;
    }
  });
  dg.setAttribute('aCat', new THREE.BufferAttribute(dCat, 1));
  dg.setAttribute('aPh', new THREE.BufferAttribute(dPh, 1));
  dg.setAttribute('aD', new THREE.BufferAttribute(dDl, 1));
  const uK = new Array(nL).fill(1), uPop = new Array(nL).fill(0);
  const dm = K.points(set, {
    uniforms: { uFlow: FLOW, uOn: { value: 1 }, uK: { value: uK }, uPop: { value: uPop } },
    head: `attribute float aCat, aPh, aD; uniform float uFlow, uOn; uniform float uK[${nL}], uPop[${nL}];`,
    vertex: `
  float f = clamp((uFlow - aD) / ${(1 - DMAX).toFixed(3)}, 0.0, 1.0);
  float s = fract(aPh + uTime * 0.075);
  float sm = s * s * (3.0 - 2.0 * s), pl = smoothstep(0.0, ${RMP}, s) * smoothstep(0.0, ${RMP}, 1.0 - s);
  int c = int(aCat + 0.5);
  pos = vec3(mix(${XA.toFixed(4)}, ${XB.toFixed(4)}, s), mix(position.x, position.y, sm), (position.z + uPop[c]) * pl);
  mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);
  vA *= uOn * uK[c] * smoothstep(0.0, 0.05, f - s) * smoothstep(0.0, 0.05, s) * smoothstep(0.0, 0.05, 1.0 - s);`,
  });
  const dots = new THREE.Points(dg, dm);
  dots.frustumCulled = false; dots.renderOrder = 2;
  set.group.add(dots);

  // ---- labels: the molecular ones are spread apart where small clusters crowd together, with leader lines
  const MINS = 0.064, yLab = rMid.slice();
  for (let it = 0; it < 80; it++) {
    for (let j = 1; j < nR; j++) {
      const gap = yLab[j - 1] - yLab[j];
      if (gap < MINS) { const d = (MINS - gap) / 2; yLab[j - 1] += d; yLab[j] -= d; }
    }
  }
  const XLAB = XR + BW / 2 + 0.055, ZLAB = BD / 2;
  const lg = K.linesGeo(2 * nR);
  for (let j = 0; j < nR; j++) {
    const x0 = XR + BW / 2 + 0.004, x1 = x0 + 0.022;
    lg.attributes.position.array.set([x0, rMid[j], ZLAB, x1, rMid[j], ZLAB, x1, rMid[j], ZLAB, XLAB - 0.004, yLab[j], ZLAB], 12 * j);
    for (let k = 0; k < 4; k++) lg.attributes.aCol.array.set([0.58, 0.65, 0.74], 12 * j + 3 * k);
    lg.attributes.aA.array.set([0.55, 0.55, 0.55, 0.55], 4 * j);
    lg.attributes.aT.array.set([j / (nR - 1), j / (nR - 1), j / (nR - 1), j / (nR - 1)], 4 * j);
  }
  const lm = K.lines(set);
  const leaders = new THREE.LineSegments(lg, lm);
  leaders.renderOrder = 2;
  set.group.add(leaders);

  // ---- state shared by update and the labels
  const SPR = 0.7, rv = (p, k, n) => clamp(p * (1 + SPR) - SPR * k / (n - 1), 0, 1);
  // Highlight weights: w[i] for each category, D how much the rest dims. Two ways in: sankey_hi (the story keys it
  // in jumps; in-between values blend neighbouring categories) and sankey_h1..h9 (explore: one weight per category,
  // so when the engine eases them the old highlight fades out while the new one fades in, skipping none between)
  const st = { D: 0, w: new Array(nL).fill(0), rel: new Array(nR).fill(0) };
  function hilite(S) {
    const hi = S.sankey_hi || 0;
    let D = clamp(hi, 0, 1);
    for (let i = 0; i < nL; i++) {
      const h = clamp(S['sankey_h' + (i + 1)] || 0, 0, 1);
      st.w[i] = Math.max(0, 1 - Math.abs(hi - (i + 1)), h);
      D += h;
    }
    st.D = Math.min(1, D);
    for (let j = 0; j < nR; j++) { let s = 0; for (let i = 0; i < nL; i++) if (M[i][j]) s += st.w[i]; st.rel[j] = Math.min(1, s); }
  }
  // the highlighted stay bright all the way (even while the highlight itself is fading in), the rest dim with D
  const keepL = i => clamp(1 - st.D + st.w[i], 0, 1), keepR = j => clamp(1 - st.D + st.rel[j], 0, 1);
  function setBlock(k, x, y, h, g, keep, glow) {
    if (g < 0.002) Sc.set(0, 0, 0); else Sc.set(BW * (0.3 + 0.7 * g), h * g, BD * (0.3 + 0.7 * g));
    blocks.setMatrixAt(k, M4.compose(V.set(x, y, 0), Q, Sc));
    blocks.setColorAt(k, C.copy(bCol[k]).multiplyScalar(0.8 * (0.2 + 0.8 * keep) * (1 + 0.3 * glow)));
  }

  const labels = [
    { text: ['Clinical', `${nL} categories`], at: 'clinical', cls: 'amb', alpha: S => prog(S.sankey_left, 0.1, 0.5) },
    { text: ['Molecular', `${nR} clusters`], at: 'molecular', cls: 'cyn', alpha: S => prog(S.sankey_right, 0.1, 0.5) },
    ...CL.map((c, i) => ({ text: [c[1], String(c[2])], at: 'leftLabel' + i, cls: '',
      alpha: S => { hilite(S); return prog(rv(S.sankey_left, i, nL), 0.5, 1) * (1 - 0.75 * (1 - keepL(i))); } })),
    // minor: clusters of 3 genes or fewer, which the engine may drop on narrow screens and in the headset
    ...MO.map((c, j) => ({ text: [c[1], String(c[2])], at: 'rightLabel' + j, cls: '', minor: c[2] <= 3,
      alpha: S => { hilite(S); return prog(rv(S.sankey_right, j, nR), 0.5, 1) * (1 - 0.75 * (1 - keepR(j))); } })),
  ];
  const anchors = {
    mid: [(XL + XR) / 2, 0, 0], clinical: [XL - 0.02, H / 2 + 0.075, ZLAB], molecular: [XR - 0.02, H / 2 + 0.075, ZLAB],
    top: [(XL + XR) / 2, H / 2, 0], bottom: [(XL + XR) / 2, -H / 2, 0],
  };
  // left<i> and right<j>: the front face of each block; leftLabel<i> and rightLabel<j>: where the set's labels sit
  CL.forEach((_, i) => { anchors['left' + i] = [XL, lMid[i], BD / 2]; anchors['leftLabel' + i] = [XL + BW / 2 + 0.012, lMid[i], ZLAB]; });
  MO.forEach((_, j) => { anchors['right' + j] = [XR, rMid[j], BD / 2]; anchors['rightLabel' + j] = [XLAB, yLab[j], ZLAB]; });

  return Object.assign(set, {
    params: Object.assign({ sankey_a: 1, sankey_left: 1, sankey_right: 1, sankey_flow: 1, sankey_hi: 0 },
      ...CL.map((_, i) => ({ ['sankey_h' + (i + 1)]: 0 }))),
    update(S) {
      const left = clamp(S.sankey_left, 0, 1), right = clamp(S.sankey_right, 0, 1), a = set.uA.value;
      hilite(S);
      FLOW.value = clamp(S.sankey_flow, 0, 1);
      for (let i = 0; i < nL; i++) setBlock(i, XL, lMid[i], rowSum[i] * U, smooth(rv(left, i, nL)), keepL(i), st.w[i]);
      for (let j = 0; j < nR; j++) setBlock(nL + j, XR, rMid[j], colSum[j] * U, smooth(rv(right, j, nR)), keepR(j), st.rel[j]);
      blocks.instanceMatrix.needsUpdate = true; blocks.instanceColor.needsUpdate = true;
      blocks.visible = left > 0.001 || right > 0.001;
      // the highlighted category's ribbons glow and come forward in front of every other layer
      for (let i = 0; i < nL; i++) {
        const m = ribbons[i].material, w = st.w[i], keep = keepL(i);
        m.opacity = 0.86 * a * (0.1 + 0.9 * keep);
        m.emissiveIntensity = 0.15 + 0.3 * w;
        m.userData.u.uPop.value = uPop[i] = (ZF - zP[i]) * w;
        uK[i] = 0.08 + 0.92 * keep;
        ribbons[i].visible = FLOW.value > 0.002;
      }
      dm.uniforms.uOn.value = prog(FLOW.value, 0.5, 1);
      dots.visible = FLOW.value > 0.5;
      lm.uniforms.uReveal.value = (right * (1 + SPR) - 0.5) / SPR;
      leaders.visible = right > 0.01;
    },
    anchors,
    labels,
    cam: {
      default: [-8, 7, 3.75, 0.18, 0, 0],
      oblique: [-42, 14, 3.5, 0.1, 0, 0],
      molecular: [-16, 4, 2.4, 0.6, 0, 0],
      // for narrow portrait screens (w/h < 1): turned a little, so the diagram is narrower and shows its depth
      portrait: [-26, 9, 3.4, -0.12, 0, 0],
    },
    controls: [{ key: 'hi', label: 'Highlight', options: [['0', 'None'], ...BTN.map((b, i) => [String(i + 1), b])] }],
    // explore highlights through sankey_h1..h9, never sankey_hi (easing that would sweep through the categories between)
    explore(c) {
      const k = parseInt(c.hi, 10) || 0, o = { sankey_left: 1, sankey_right: 1, sankey_flow: 1, sankey_hi: 0 };
      for (let i = 1; i <= nL; i++) o['sankey_h' + i] = i === k ? 1 : 0;
      return o;
    },
    left: CL.map(c => c[0]), right: MO.map(c => c[0]), total,
    leftShort: CL.map(c => c[1]), rightShort: MO.map(c => c[1]),
    leftColours: CL.map(c => c[3]), rightColours: MO.map(c => c[3]), matrix: M.map(row => row.slice()),
  });
};

// Networks across scales, and the institute (slides 30-33 and 42). A glowing tower of eight length scales, from DNA
// bases (1 nm) to the body (1 m), each floor a holographic disc with a small 3D emblem; a spiral time axis from a
// microsecond to a lifetime; small live networks at four scales; medicine feeding in at the top and the bottom; the four
// research groups as rings at their scales, joined by synergy arcs; and the team as a slowly turning constellation.
SETS.scale = function (K) {
  const { THREE, v3, smooth, clamp, lerp, prog } = K;
  const set = K.newSet('scale');
  const TAU = Math.PI * 2, D2R = Math.PI / 180, C = K.rgb;
  // a point at radius r to the right of the tower as seen from azimuth az (degrees), at height y
  const right = (az, r, y) => [r * Math.cos(az * D2R), y, -r * Math.sin(az * D2R)];

  // ------------------------------------------------------------------ layout
  const NF = 8, FY0 = -1.15, FDY = 0.3, FR = 0.4;          // floors: count, lowest height, spacing, disc radius
  const fy = k => FY0 + FDY * k;
  const FLOORS = [['DNA bases', '1 nm'], ['Proteins', '10 nm'], ['Complexes', '100 nm'], ['Organelles', '1 µm'],
    ['Cells', '10 µm'], ['Tissues', '1 mm'], ['Organs', '10 cm'], ['Body', '1 m']];
  const FCOL = Array.from({ length: NF }, (_, k) => v3.lerp(C('#19c6bd'), C('#4a86ff'), k / (NF - 1)));
  const FLAZ = 10;                                         // floor labels sit on the right as seen from the tower views
  // time: log10 seconds mapped up a spiral around the tower
  const TL0 = -6.6, TL1 = 9.9, TH = { r: 0.56, turns: 1.75, th0: -82 * D2R, y0: -1.2, y1: 1.16 };
  const tu = L => (L - TL0) / (TL1 - TL0);
  const helix = (u, h = TH, r = h.r) => { const a = h.th0 + TAU * h.turns * u; return [r * Math.sin(a), lerp(h.y0, h.y1, u), r * Math.cos(a)]; };
  const TIMES = [['Electron transfer', '1 µs, in cytochromes', -6], ['Neurons fire', '1 ms', -3], ['Enzyme turnover', '~10 ms', -2],
    ['Protein folding', '~1 s', 0], ['Protein translation', '~1 min', 1.78], ['Protein half-life', 'hours to days', 4.4],
    ['Circadian clock', '1 day', 4.94], ['Red blood cell', 'life span 4 months', 7.02], ['Human life span', '80 years', 9.4]];
  const TU = TIMES.map(m => tu(m[2]));
  // networks at four scales
  const NETS = [
    { f: 1, col: '#46d9ff', cls: 'cyn', text: ['Protein-protein', 'interactions'], n: 16 },
    { f: 4, col: '#3ee08f', cls: 'grn', text: ['Signalling', 'between cells'], n: 15 },
    { f: 6, col: '#ff5ad9', cls: 'mag', text: ['Inter-organ', 'communication'], n: 13 },
    { f: 7, col: '#ffb43b', cls: 'amb', text: ['Contagion', 'from person to person'], n: 18 },
  ];
  const NAZ = 50;
  NETS.forEach(N => { N.c = C(N.col); });
  // medicine: a column of three bubbles beside the tower, arrows into the top and bottom floors
  const MAZ = 50, MRHO = 0.9, MY = [0.42, 0, -0.42], MBR = 0.12;
  const MED = [['Diagnosis', ''], ['Treatment', ''], ['Prevention', 'nutrition and lifestyle']];
  const mp = (rho, y) => right(MAZ, rho, y);
  // the four research groups: bands at their scales (RG4 spans the whole tower)
  const RG = [
    { text: ['RG1', 'Molecular networks'], col: '#46d9ff', cls: 'cyn', y: [-0.93, -0.37], r: 0.5, floors: [1, 2] },
    { text: ['RG2', 'Cellular networks'], col: '#3ee08f', cls: 'grn', y: [-0.03, 0.56], r: 0.5, floors: [4, 5] },
    { text: ['RG3', 'Population health'], col: '#ffb43b', cls: 'amb', y: [0.88, 1.25], r: 0.5, floors: [7] },
    { text: ['RG4', 'DataDiVR'], col: '#ff5ad9', cls: 'mag', y: [-1.24, 1.27], r: 0.64, floors: [] },
  ];
  const RGAZ = 100;
  RG.forEach(R => { R.c = C(R.col); });
  // element groups: each has a visibility uV[g] and a reveal uR[g], set every frame in update()
  const G = { time: 8, net: 9, med: 13, rg: 14, syn: 18, link: 19, halo: 20, dust: 21, motes: 22, shell: 23, star: 24, spark: 25 };
  const NG = 26;
  const uV = { value: new Float32Array(NG) }, uR = { value: new Float32Array(NG) };

  // ---------------------------------------------------------------- helpers
  const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
  const _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  // a cylinder from a to b
  function rod(a, b, rad, seg, open, rad2) {
    const d = v3.sub(b, a), L = v3.len(d) || 1e-6;
    const g = new THREE.CylinderGeometry(rad2 === undefined ? rad : rad2, rad, L, seg || 6, 1, !!open);
    _q.setFromUnitVectors(_up, _d.set(d[0] / L, d[1] / L, d[2] / L));
    return g.applyMatrix4(_m.compose(_p.set(...v3.lerp(a, b, 0.5)), _q, _s));
  }
  const ball = (p, rad, w = 12) => new THREE.SphereGeometry(rad, w, Math.max(6, Math.round(w * 0.7))).translate(p[0], p[1], p[2]);
  const P = (geo, c) => K.paint(geo, c);
  const lathe = (pts, seg, p0, pl) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg, p0 || 0, pl || TAU);
  // a tube along a dense polyline (frames carried along the line; much cheaper than a curve-based TubeGeometry);
  // uv.x is the arc-length fraction
  function ptube(pts, rad, radial) {
    const n = pts.length, R = radial || 5, W = R + 1, pos = new Float32Array(n * W * 3), nor = new Float32Array(n * W * 3), uv = new Float32Array(n * W * 2);
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + v3.dist(pts[i - 1], pts[i]));
    const L = cum[n - 1] || 1;
    let N = null;
    for (let i = 0; i < n; i++) {
      const T = v3.norm(v3.sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
      if (!N) { const ax = Math.abs(T[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; N = v3.norm(v3.cross(T, ax)); } else N = v3.norm(v3.sub(N, v3.mul(T, v3.dot(N, T))));
      const B = v3.cross(T, N), p = pts[i];
      for (let j = 0; j <= R; j++) {
        const a = j / R * TAU, c = Math.cos(a), sn = Math.sin(a), k = i * W + j;
        const dx = N[0] * c + B[0] * sn, dy = N[1] * c + B[1] * sn, dz = N[2] * c + B[2] * sn;
        pos[3 * k] = p[0] + dx * rad; pos[3 * k + 1] = p[1] + dy * rad; pos[3 * k + 2] = p[2] + dz * rad;
        nor[3 * k] = dx; nor[3 * k + 1] = dy; nor[3 * k + 2] = dz; uv[2 * k] = cum[i] / L; uv[2 * k + 1] = j / R;
      }
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < R; j++) { const a = i * W + j, b = a + W; idx.push(a, a + 1, b, b, a + 1, b + 1); }   // counter-clockwise from outside
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  // m points on a smooth curve through a few points
  const smoothPts = (pts, m) => new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))).getPoints(m - 1).map(v => [v.x, v.y, v.z]);

  // one merged mesh for glowing tubes, rings and glassy shells, drawn by a single shader
  // tubes use front faces only (so near and far tubes match); glassy shells show both walls
  const glowMat = side => new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uV, uR },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side,
    vertexShader: `
uniform float uV[${NG}], uR[${NG}];
attribute vec3 aCol; attribute float aA, aF, aU, aK; attribute vec2 aD, aQ;
varying vec3 vC, vN, vW; varying float vA, vU, vK, vRev; varying vec2 vQ;
void main() {
  int g = int(aF + 0.5);
  float rev = clamp((uR[g] - aD.x) * aD.y, 0.0, 1.0);
  vRev = rev; vU = aU; vK = aK; vQ = aQ; vC = aCol;
  vA = aA * uV[g] * min(1.0, rev * 4.0);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
  if (vA < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA, uTime;
varying vec3 vC, vN, vW; varying float vA, vU, vK, vRev; varying vec2 vQ;
void main() {
  if (vU > vRev) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float ndv = abs(dot(n, v));
  // tubes glow at their core (vK 0), shells at their rim (vK 1)
  float f = mix(0.3 + 0.7 * pow(ndv, 0.8), 0.03 + 0.97 * pow(1.0 - ndv, 2.5), vK);
  // a bright front while drawing, and pulses running along
  float head = vRev < 0.999 ? smoothstep(0.05, 0.0, vRev - vU) : 0.0;
  float p = vQ.x > 0.0 ? pow(max(0.0, sin((vU * vQ.x - uTime * vQ.y) * 6.2832)), 16.0) : 0.0;
  float e = (head + p) * (1.0 - 0.7 * vK), soft = mix(1.0, smoothstep(0.0, 0.06, vRev - vU), vK);   // shells fade out at a rising edge
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.35 * e) * (f + e), vA * uA * soft);
}`,
  });
  // merge indexed or plain geometries into one indexed geometry (keeps shared vertices: far less work than toNonIndexed)
  function mergeIndexed(list, names) {
    let nv = 0, ni = 0;
    for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const out = new THREE.BufferGeometry(), idx = new Uint32Array(ni);
    for (const nm of names) {
      const sz = list[0].attributes[nm].itemSize, arr = new Float32Array(nv * sz);
      let o = 0;
      for (const g of list) { arr.set(g.attributes[nm].array, o); o += g.attributes.position.count * sz; }
      out.setAttribute(nm, new THREE.BufferAttribute(arr, sz));
    }
    let v = 0, i = 0;
    for (const g of list) {
      const n = g.attributes.position.count;
      if (g.index) { const ix = g.index.array; for (let j = 0; j < ix.length; j++) idx[i++] = ix[j] + v; } else for (let j = 0; j < n; j++) idx[i++] = v + j;
      v += n;
    }
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }
  // one merged mesh for glowing tubes, rings and glassy shells
  function glowBuilder(mat) {
    const parts = [];
    set.mats.push(mat);
    // o: g (group), col [r,g,b] (and col2: blend to it along u), a, u (fn(x,y,z,uvx) or number), d [delay, 1/width], k (rim), q [pulses, speed]
    const add = (geo, o) => parts.push([geo, o]);
    // a straight glowing rod from a to b that draws from a
    function seg(a, b, rad, o) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L2 = dx * dx + dy * dy + dz * dz || 1;
      add(rod(a, b, rad, 4, true), Object.assign({ u: (x, y, z) => clamp(((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / L2, 0, 1) }, o));
    }
    function mesh() {
      const geo = mergeIndexed(parts.map(p => p[0]), ['position', 'normal']), nv = geo.attributes.position.count;
      const P = geo.attributes.position.array, col = new Float32Array(nv * 3), aA = new Float32Array(nv), aF = new Float32Array(nv),
        aU = new Float32Array(nv), aK = new Float32Array(nv), aD = new Float32Array(nv * 2), aQ = new Float32Array(nv * 2);
      let v = 0;
      for (const [g, o] of parts) {
        const n = g.attributes.position.count, uv = g.attributes.uv ? g.attributes.uv.array : null, v0 = v;
        const d = o.d || [0, 1], q = o.q || [0, 0], c0 = o.col, c1 = o.col2 || o.col, fu = typeof o.u === 'function' ? o.u : null, cu = typeof o.u === 'number' ? o.u : -1;
        for (let j = 0; j < n; j++, v++) {
          const u = fu ? fu(P[3 * v], P[3 * v + 1], P[3 * v + 2]) : cu >= 0 ? cu : uv ? uv[2 * j] : 0;
          aU[v] = u;
          col[3 * v] = c0[0] + (c1[0] - c0[0]) * u; col[3 * v + 1] = c0[1] + (c1[1] - c0[1]) * u; col[3 * v + 2] = c0[2] + (c1[2] - c0[2]) * u;
          aD[2 * v] = d[0]; aD[2 * v + 1] = d[1]; aQ[2 * v] = q[0]; aQ[2 * v + 1] = q[1];
        }
        aA.fill(o.a === undefined ? 1 : o.a, v0, v); aF.fill(o.g, v0, v); aK.fill(o.k || 0, v0, v);
      }
      for (const [nm, arr, sz] of [['aCol', col, 3], ['aA', aA, 1], ['aF', aF, 1], ['aU', aU, 1], ['aK', aK, 1], ['aD', aD, 2], ['aQ', aQ, 2]]) geo.setAttribute(nm, new THREE.BufferAttribute(arr, sz));
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      return m;
    }
    return { add, seg, mesh };
  }

  // glowing points; position is computed in the shader for moving kinds (aM): 0 node, 1 pulse along a link,
  // 2 flow up a helix, 3 circling a ring, 4 dissolving dust, 5 contagion node, 6 rising mote, 7 head of a growing helix,
  // 8 pulse along a curved link (quadratic Bezier through the control point aC)
  const ptMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime, uV, uR, uDust: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + `
uniform float uA, uDust, uV[${NG}], uR[${NG}];
attribute vec3 aCol, aB, aC; attribute float aSize, aA, aF, aM; attribute vec2 aP, aD;
varying vec3 vC; varying float vA;
vec3 helix(float u, vec3 h, vec2 y) { float th = h.z + 6.2832 * h.y * u; return vec3(h.x * sin(th), mix(y.x, y.y, u), h.x * cos(th)); }
void main() {
  int g = int(aF + 0.5);
  float rv = uR[g], rev = clamp((rv - aD.x) * aD.y, 0.0, 1.0);
  vec3 pos = position, c = aCol; float a = aA * uV[g], s = aSize;
  if (aM < 0.5) {
    a *= rev * (0.8 + 0.2 * sin(uTime * aP.y + aP.x * 6.2832)); s *= 0.3 + 0.7 * rev + 1.2 * rev * (1.0 - rev);
  } else if (aM < 1.5) {
    float x = fract(aP.x + uTime * aP.y); pos = mix(position, aB, x); a *= rev * sin(3.1416 * x);
  } else if (aM < 2.5) {
    float u = fract(aP.x + uTime * aP.y); pos = helix(u, aB, position.xy); a *= smoothstep(0.0, 0.02, rv - u);
  } else if (aM < 3.5) {
    float th = aP.x * 6.2832 + uTime * aP.y; pos = vec3(aB.x * sin(th), position.y, aB.x * cos(th)); a *= rev;
  } else if (aM < 4.5) {
    float e = clamp((uDust - aP.x) / 0.6, 0.0, 1.0), se = e * e * (3.0 - 2.0 * e), w = se * aP.y;
    pos = position + aB * se; pos.xz = mat2(cos(w), -sin(w), sin(w), cos(w)) * pos.xz;
    a *= smoothstep(0.0, 0.08, e) * (1.0 - smoothstep(0.4, 1.0, e));
  } else if (aM < 5.5) {
    float ph = fract(uTime / aP.y) * 1.5, inf = smoothstep(aB.x - 0.08, aB.x, ph) * (1.0 - smoothstep(1.3, 1.5, ph));
    c = mix(c, vec3(1.0, 0.24, 0.16), inf); s *= (0.3 + 0.7 * rev) * (1.0 + 0.45 * inf); a *= rev;
  } else if (aM < 6.5) {
    pos.y = -1.2 + mod(position.y + 1.2 + uTime * aP.y, 2.44); a *= smoothstep(0.0, 0.1, rv - pos.y);
  } else if (aM < 7.5) {
    pos = helix(min(rv, 0.999), aB, position.xy); a *= step(0.002, rv) * (1.0 - smoothstep(0.96, 1.0, rv));
  } else {
    float x = fract(aP.x + uTime * aP.y); pos = mix(mix(position, aC, x), mix(aC, aB, x), x); a *= rev * sin(3.1416 * x);
  }
  vC = c; vA = a * uA;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(s, mv);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
varying vec3 vC; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.18, d), glow = pow(1.0 - d * 2.0, 1.6), a = max(core * 0.85, glow * 0.6);
  gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.22, 0.0, d) * 0.35), vA * a);
}`,
  });
  set.mats.push(ptMat);
  function pointBuilder() {
    const A = { position: [], aCol: [], aSize: [], aA: [], aF: [], aM: [], aB: [], aC: [], aP: [], aD: [] };
    // o: g, col, s (size), a, m (kind), b ([x,y,z]), c (control point), p ([phase, speed]), d ([delay, 1/width])
    const add = (p, o) => {
      const c = o.col, b = o.b || [0, 0, 0], cc = o.c || [0, 0, 0], q = o.p || [0, 0], d = o.d || [0, 1];
      A.position.push(p[0], p[1], p[2]); A.aCol.push(c[0], c[1], c[2]); A.aSize.push(o.s); A.aA.push(o.a === undefined ? 1 : o.a);
      A.aF.push(o.g); A.aM.push(o.m || 0); A.aB.push(b[0], b[1], b[2]); A.aC.push(cc[0], cc[1], cc[2]); A.aP.push(q[0], q[1]); A.aD.push(d[0], d[1]);
    };
    const points = () => {
      const g = new THREE.BufferGeometry(), sz = { position: 3, aCol: 3, aSize: 1, aA: 1, aF: 1, aM: 1, aB: 3, aC: 3, aP: 2, aD: 2 };
      for (const k in A) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(A[k]), sz[k]));
      const o = new THREE.Points(g, ptMat);
      o.frustumCulled = false;
      return o;
    };
    return { add, points };
  }
  const GB = glowBuilder(glowMat(THREE.FrontSide)), GS = glowBuilder(glowMat(THREE.DoubleSide)), PB = pointBuilder();

  // ----------------------------------------------------------------- floors
  // holographic discs: one merged mesh; each floor spreads out from its centre as it appears
  let discs;
  const uFR = { value: new Float32Array(NF) }, uFH = { value: new Float32Array(NF) }, uFC = { value: new Float32Array(NF * 3) }, uTF = { value: 1 };
  const discMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uFR, uFH, uFC, uTF },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `
uniform float uFR[${NF}], uFH[${NF}]; uniform vec3 uFC[${NF}];
attribute float aF;
varying vec2 vP; varying float vF, vRv, vHi; varying vec3 vC;
void main() {
  int k = int(aF + 0.5);
  vRv = uFR[k]; vHi = uFH[k]; vC = uFC[k]; vF = aF; vP = position.xz / ${FR.toFixed(3)};
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  if (vRv <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA, uTime, uTF;
varying vec2 vP; varying float vF, vRv, vHi; varying vec3 vC;
void main() {
  float r = length(vP), front = vRv * 1.05;
  if (r > min(front, 1.0)) discard;
  float ang = atan(vP.y, vP.x);
  float rings = pow(1.0 - abs(fract(r * 4.0 + 0.5) - 0.5) * 2.0, 28.0) * 0.45;
  float spokes = pow(abs(cos(ang * 6.0)), 80.0) * 0.12 * smoothstep(0.2, 0.6, r);
  float edge = smoothstep(0.86, 1.0, r) * 0.45;
  float sweep = pow(fract(ang / 6.2832 - uTime * 0.05 + vF * 0.37), 10.0) * 0.4 * smoothstep(0.15, 0.7, r);
  float fill = 0.06 + 0.16 * (1.0 - smoothstep(0.0, 0.45, r));
  float wave = smoothstep(0.12, 0.0, front - r) * (1.0 - vRv) * 2.0;
  float a = (fill + rings + spokes + edge + sweep) * (1.0 + 1.3 * vHi) + wave;
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.25 * wave), a * uA * uTF);
}`,
  });
  set.mats.push(discMat);
  {
    const pos = [], af = [], SEG = 72;
    for (let k = 0; k < NF; k++) for (let i = 0; i < SEG; i++) {
      const a0 = i / SEG * TAU, a1 = (i + 1) / SEG * TAU;
      pos.push(0, fy(k), 0, FR * Math.sin(a1), fy(k), FR * Math.cos(a1), FR * Math.sin(a0), fy(k), FR * Math.cos(a0));
      af.push(k, k, k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aF', new THREE.BufferAttribute(new Float32Array(af), 1));
    discs = new THREE.Mesh(g, discMat);
    discs.frustumCulled = false;
    set.group.add(discs);
  }
  // glowing rims (drawn around as the floor appears) and a glassy shell that rises with the floors
  for (let k = 0; k < NF; k++) {
    GB.add(new THREE.TorusGeometry(FR, 0.006, 4, 96).rotateX(Math.PI / 2).translate(0, fy(k), 0), { g: k, col: v3.lerp(FCOL[k], [1, 1, 1], 0.25), a: 0.9 });
  }
  {
    const y0 = -1.2, y1 = 1.24;
    GS.add(new THREE.CylinderGeometry(0.425, 0.425, y1 - y0, 48, 6, true).translate(0, (y0 + y1) / 2, 0),
      { g: G.shell, col: C('#3f8fe0'), a: 0.32, k: 1, u: (x, y) => (y - y0) / (y1 - y0) });
  }

  // ----------------------------------------------------------------- emblems
  const mergeLit = list => { const g = mergeIndexed(list, ['position', 'normal', 'color']); g.computeBoundingSphere(); return g; };
  // a bit of B-DNA: two backbones and coloured base pairs (A-T, G-C), as in the dna set.
  // Right-handed: seen from above, the strands turn anticlockwise as they rise ([cos a, y, -sin a] with a rising)
  function emDNA() {
    const parts = [], H = 0.2, R = 0.042, NB = 12, turns = NB / 10.5, OFF = 2.4;
    const at = (a, y) => [R * Math.cos(a), y, -R * Math.sin(a)];
    const strand = off => Array.from({ length: 61 }, (_, i) => { const u = i / 60; return at(off + TAU * turns * u, 0.012 + H * u); });
    for (const off of [0, OFF]) { const s = strand(off); parts.push(P(ptube(s, 0.0075, 8), '#d4e4ff'), P(ball(s[0], 0.0075, 10), '#d4e4ff'), P(ball(s[60], 0.0075, 10), '#d4e4ff')); }
    const q = K.rng(5), BASE = { A: '#3ee08f', T: '#ff5a4b', G: '#ffb43b', C: '#4f9dff' };
    const PAIRS = [['A', 'T'], ['T', 'A'], ['G', 'C'], ['C', 'G']];
    for (let i = 0; i < NB; i++) {
      const u = (i + 0.5) / NB, a = TAU * turns * u, y = 0.012 + H * u;
      const pa = at(a, y), pb = at(a + OFF, y), m = v3.lerp(pa, pb, 0.5), [ba, bb] = PAIRS[Math.floor(q() * 4)];
      parts.push(P(rod(pa, m, 0.0045, 6), BASE[ba]), P(rod(m, pb, 0.0045, 6), BASE[bb]));
    }
    return mergeLit(parts);
  }
  // a folded protein chain, AlphaFold style: four helices with loops and floppy ends, coloured by confidence
  function emProtein() {
    const q = K.rng(21), pts = [], conf = [];
    const push = (p, c) => { pts.push(p); conf.push(c); };
    const ax = [[-0.028, -0.016], [0.026, -0.026], [0.03, 0.022], [-0.02, 0.03]];
    // floppy N-terminal tail
    for (let i = 0; i < 6; i++) push([-0.05 + 0.006 * i + 0.006 * Math.sin(i * 1.7), 0.02 + 0.004 * i, -0.04 + 0.004 * i], i < 3 ? 3 : 2);
    for (let h = 0; h < 4; h++) {
      const up = h % 2 === 0, [cx, cz] = ax[h], n = 24, len = 0.085, y0 = 0.025;   // 3.6 residues per turn, pitch drawn a little open
      // alpha helices are right-handed whichever way the chain runs: the turn sense flips with the direction
      for (let i = 0; i <= n; i++) {
        const u = i / n, a = i * TAU / 3.6 + h, y = up ? y0 + len * u : y0 + len * (1 - u);
        push([cx + 0.0095 * Math.cos(a), y, cz + (up ? -1 : 1) * 0.0095 * Math.sin(a)], h === 1 || h === 2 ? 1 : 0);
      }
      if (h < 3) { // loop over to the next helix
        const a = pts[pts.length - 1], [nx, nz] = ax[h + 1], yb = up ? y0 + len + 0.016 : y0 - 0.014;
        push([(a[0] + nx) / 2 + (q() - 0.5) * 0.01, yb, (a[2] + nz) / 2 + (q() - 0.5) * 0.01], 1);
      }
    }
    // floppy C-terminal tail
    const e = pts[pts.length - 1];
    for (let i = 1; i <= 7; i++) push([e[0] + 0.007 * i, e[1] + 0.01 * Math.sin(i * 1.3) - 0.003 * i, e[2] + 0.006 * i + 0.006 * Math.cos(i * 1.9)], i > 4 ? 3 : 2);
    // a smooth chain, three samples per residue, each ring coloured by its residue's confidence
    const M = pts.length * 4, geo = ptube(smoothPts(pts, M), 0.0042, 6), W = 7;
    const CC = ['#0053d6', '#65cbf3', '#ffdb13', '#ff7d45'].map(C), cols = new Float32Array(M * W * 3);
    for (let i = 0; i < M; i++) for (let j = 0; j < W; j++) cols.set(CC[conf[Math.round(i / (M - 1) * (pts.length - 1))]], 3 * (i * W + j));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ends = [pts[0], pts[pts.length - 1]].map(p => P(ball(p, 0.0042, 8), CC[3]));   // round caps on the open tube ends
    return mergeLit([geo, ...ends].map(g => g.scale(1.3, 1.3, 1.3)));   // drawn a little larger than the others: a single chain is thin
  }
  // a complex (ATP synthase, met earlier in the story): c-ring, central stalk, alpha3beta3 head, peripheral stalk
  function emComplex() {
    const parts = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; parts.push(P(ball([0.032 * Math.cos(a), 0.03, 0.032 * Math.sin(a)], 0.015, 10), '#ff8fc8')); }
    parts.push(P(rod([0, 0.03, 0], [0, 0.13, 0], 0.009, 8), '#9fe6e0'));
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; parts.push(P(ball([0.04 * Math.cos(a), 0.155, 0.04 * Math.sin(a)], 0.029, 14), i % 2 ? '#3d7fe0' : '#1fc8c0')); }
    parts.push(P(ball([0.064, 0.028, 0], 0.018, 10), '#7a4a2c'));
    parts.push(P(ptube(smoothPts([[0.068, 0.045, 0], [0.074, 0.1, 0], [0.062, 0.175, 0], [0.028, 0.2, 0]], 20), 0.0055, 6), '#b07a4a'), P(ball([0.028, 0.2, 0], 0.0055, 8), '#b07a4a'));
    parts.push(P(ball([0, 0.198, 0], 0.017, 12), '#a77be0'));
    return mergeLit(parts);
  }
  // a mitochondrion: the outer membrane is a glassy capsule (a separate rim-lit mesh); inside it, the inner membrane is
  // shown cut open lengthwise, textbook style: a half shell whose folds (cristae) reach in from alternating sides
  const capProf = (L, R) => {
    const prof = [];
    for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; prof.push([R * Math.cos(a) + 1e-4, -(L / 2 - R) + R * Math.sin(a)]); }
    for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; prof.push([R * Math.cos(a) + 1e-4, (L / 2 - R) + R * Math.sin(a)]); }
    return prof;
  };
  const capsule = (L, R, seg) => lathe(capProf(L, R), seg || 24);
  // a shell seen from both sides: the geometry plus a copy with flipped faces and normals, coloured separately
  function twoSided(g, cOut, cIn) {
    const f = g.clone(), n = f.attributes.normal.array, ix = f.index.array;
    for (let i = 0; i < n.length; i++) n[i] = -n[i];
    for (let i = 0; i < ix.length; i += 3) { const s = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = s; }
    return [P(g, cOut), P(f, cIn)];
  }
  function emMito() {
    const parts = [], cy = 0.072, L = 0.2, RI = 0.045, N = 7, cyl = L / 2 - RI;
    // the inner membrane's lower half: lathe about y, turned to lie along x (lathe angle pi..2pi is the half below the axis)
    const shell = lathe(capProf(L, RI), 18, Math.PI, Math.PI).rotateZ(Math.PI / 2).translate(0, cy, 0);
    { // make sure the normals point outwards before pairing
      const p = shell.attributes.position, nn = shell.attributes.normal;
      let s = 0;
      for (let i = 0; i < p.count; i++) s += nn.getY(i) * (p.getY(i) - cy) + nn.getZ(i) * p.getZ(i);
      if (s < 0) { for (let i = 0; i < nn.array.length; i++) nn.array[i] = -nn.array[i]; const ix = shell.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
    }
    parts.push(...twoSided(shell, '#ff8a50', '#ffae7e'));
    // its cut edge, a thin rounded rim
    const rho = x => (Math.abs(x) <= cyl ? RI : Math.sqrt(Math.max(0, RI * RI - (Math.abs(x) - cyl) ** 2)));
    const edge = [];
    for (let i = 0; i <= 40; i++) { const x = -L / 2 + L * i / 40; edge.push([x, cy, rho(x)]); }
    for (let i = 39; i >= 0; i--) { const x = -L / 2 + L * i / 40; edge.push([x, cy, -rho(x)]); }
    parts.push(P(ptube(edge, 0.0028, 5), '#ffc9a3'));
    // cristae: folds of the inner membrane, joined to its wall on one side, reaching 70% of the way across
    for (let i = 0; i < N; i++) {
      const x = -0.074 + 0.148 * i / (N - 1), r = rho(x) - 0.0016, s = i % 2 ? 1 : -1, zr = -0.4 * s * r, a0 = Math.acos(clamp(zr / r, -1, 1));
      const sh = new THREE.Shape();
      sh.moveTo(s * r, -0.0015);
      if (s > 0) sh.absarc(0, 0, r, -0.0015 / r, -a0, true); else sh.absarc(0, 0, r, Math.PI + 0.0015 / r, Math.PI + (Math.PI - a0), false);
      sh.lineTo(zr, -0.0015);
      sh.lineTo(s * r, -0.0015);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0014, bevelSegments: 2, curveSegments: 10 });
      g.rotateY(Math.PI / 2).translate(x - 0.001, cy, 0);
      parts.push(P(g, '#ff7d45'));
    }
    // a few granules in the matrix
    const q = K.rng(31);
    for (let i = 0; i < N - 1; i++) parts.push(P(ball([-0.062 + 0.148 * i / (N - 1), cy - 0.018 - 0.01 * q(), (q() - 0.5) * 0.03], 0.0042, 8), '#ffd36a'));
    return mergeLit(parts);
  }
  // a cell: nucleus, mitochondria, Golgi and vesicles inside a glassy membrane (separate mesh)
  function emCell() {
    const q = K.rng(41), parts = [], cy = 0.09;
    parts.push(P(ball([0.006, cy, -0.004], 0.034, 20), '#7a62e8'), P(ball([0.016, cy + 0.012, 0.018], 0.011, 10), '#4b2fb0'));
    for (let i = 0; i < 7; i++) {
      const u = K.unit(q), p = v3.add([0, cy, 0], v3.mul([u[0], u[1] * 0.7, u[2]], 0.054 + 0.01 * q())), w = v3.mul(K.unit(q), 0.011);
      parts.push(P(rod(v3.add(p, w), v3.sub(p, w), 0.0065, 6), '#ff8a50'));
    }
    for (let i = 0; i < 3; i++) parts.push(P(new THREE.TorusGeometry(0.03 + i * 0.006, 0.0032, 6, 20, 1.6).rotateY(0.9).translate(-0.03, cy - 0.01 + i * 0.008, 0.02), '#ffd36a'));
    for (let i = 0; i < 10; i++) { const u = K.unit(q); parts.push(P(ball(v3.add([0, cy, 0], v3.mul([u[0], u[1] * 0.7, u[2]], 0.045 + 0.022 * q())), 0.0055, 8), '#3ee08f')); }
    return mergeLit(parts);
  }
  // a sheet of tissue: columnar cells (hexagonal prisms) with nuclei, gently curved
  function emTissue() {
    const q = K.rng(51), parts = [], rc = 0.0185, w = Math.sqrt(3) * rc;
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      const x = w * (i + j / 2), z = 1.5 * rc * j;
      if (x * x + z * z > 0.125 * 0.125) continue;
      const h = 0.036 + 0.008 * q(), yb = 0.045 - 1.4 * (x * x + z * z);
      const nrm = v3.norm([2.8 * x, 1, 2.8 * z]), top = v3.add([x, yb, z], v3.mul(nrm, h));
      const g = new THREE.CylinderGeometry(rc * 0.94, rc * 0.94, h, 6, 1);
      _q.setFromUnitVectors(_up, _d.set(...nrm));
      g.applyMatrix4(_m.compose(_p.set(...v3.lerp([x, yb, z], top, 0.5)), _q, _s));
      parts.push(P(g, v3.lerp(C('#f29fbf'), C('#e3779f'), q())));
      parts.push(P(ball(v3.add(top, v3.mul(nrm, -0.004)), 0.0085, 8), '#5b3b9a'));
    }
    return mergeLit(parts);
  }
  // a brain: two folded hemispheres, cerebellum and brainstem
  function emBrain() {
    const parts = [], pink = C('#f4a9b6'), groove = C('#a24f63');
    const fold = (g, amp, f) => {
      const A = g.attributes.position.array, n = A.length / 3, col = new Float32Array(n * 3);
      for (let i = 0; i < 3 * n; i += 3) {
        const d = f(A[i], A[i + 1], A[i + 2]), w = 1 - amp * d;
        A[i] *= w; A[i + 1] *= w; A[i + 2] *= w;
        for (let c = 0; c < 3; c++) col[i + c] = pink[c] + (groove[c] - pink[c]) * d;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    };
    // meandering grooves: a domain-warped stripe pattern
    const gyri = (x, y, z) => { const s = Math.sin(15 * (0.6 * x + z) + 3 * Math.sin(9 * y + 6 * x) + 2.2 * Math.sin(11 * z - 4 * y)); return Math.pow(1 - Math.abs(s), 3); };
    for (const side of [-1, 1]) {
      const g = fold(new THREE.SphereGeometry(1, 36, 24), 0.09, gyri), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { // flatten the inner face and the base
        let x = p.getX(i) * side, y = p.getY(i);
        if (x < -0.55) x = -0.55 - (x + 0.55) * 0.15;
        if (y < -0.5) y = -0.5 - (y + 0.5) * 0.3;
        p.setXY(i, x * side, y);
      }
      g.scale(0.046, 0.052, 0.084).translate(side * 0.0275, 0.098, 0.006);
      g.computeVertexNormals();
      parts.push(g);
    }
    const cb = fold(new THREE.SphereGeometry(1, 22, 14), 0.07, (x, y) => Math.pow(Math.abs(Math.sin(y * 14)), 0.5));
    cb.scale(0.056, 0.026, 0.032).translate(0, 0.06, -0.056);
    cb.computeVertexNormals();
    parts.push(cb, P(rod([0, 0.08, -0.022], [0, 0.03, -0.04], 0.012, 8, false, 0.008), '#e08a99'));
    return mergeLit(parts);
  }
  // a human figure, stylised
  function emBody() {
    const parts = [], c = '#e2eaf6';
    const limb = (pts, r) => { parts.push(P(ptube(smoothPts(pts, 12), r, 8), c), P(ball(pts[0], r, 8), c), P(ball(pts[pts.length - 1], r, 8), c)); };
    parts.push(P(ball([0, 0.228, 0], 0.02, 16), c), P(rod([0, 0.19, 0], [0, 0.212, 0], 0.008, 8), c));
    const torso = lathe([[0, 0.104], [0.024, 0.106], [0.027, 0.12], [0.023, 0.145], [0.027, 0.172], [0.031, 0.186], [0.022, 0.197], [0, 0.2]], 20);
    parts.push(P(torso.scale(1, 1, 0.62), c));
    for (const s of [-1, 1]) {
      limb([[s * 0.013, 0.11, 0], [s * 0.016, 0.062, 0.002], [s * 0.016, 0.014, -0.002]], 0.0105);
      limb([[s * 0.034, 0.184, 0], [s * 0.046, 0.142, -0.004], [s * 0.052, 0.104, 0.004]], 0.0078);
      parts.push(P(new THREE.SphereGeometry(1, 10, 8).scale(0.011, 0.006, 0.017).translate(s * 0.016, 0.005, 0.006), c));   // a foot
    }
    return mergeLit(parts);
  }
  const EMS = 1.2;   // emblems are modelled about 0.2 tall, shown a little larger
  const emMat = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.06, emissive: 0x0e1a2e }));
  const cellRim = K.rim(set, { color: '#7fe3ff', a0: 0.05, a1: 0.75 }), mitoRim = K.rim(set, { color: '#ffa36b', a0: 0.05, a1: 0.8 });
  // the lit meshes are 'transparent' only so that they can fade: draw them before every additive glow, so that the depth
  // they write hides the glow behind them and never the glow in front (three.js would otherwise sort them by distance)
  const EM = [emDNA(), emProtein(), emComplex(), emMito(), emCell(), emTissue(), emBrain(), emBody()].map((g, k) => {
    const m = new THREE.Mesh(g, emMat);
    m.position.set(0, fy(k), 0);
    m.renderOrder = -1;
    set.group.add(m);
    return m;
  });
  {
    const mito = new THREE.Mesh(capsule(0.22, 0.054, 28).rotateZ(Math.PI / 2).translate(0, 0.072, 0), mitoRim);
    EM[3].add(mito);
    const g = new THREE.SphereGeometry(0.085, 24, 16), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { // a slightly irregular, flattened membrane
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), w = 1 + 0.06 * Math.sin(40 * x + 10 * z) * Math.cos(30 * y);
      p.setXYZ(i, x * w, y * w * 0.82, z * w);
    }
    g.computeVertexNormals();
    EM[4].add(new THREE.Mesh(g.translate(0, 0.09, 0), cellRim));
  }

  // ----------------------------------------------------------------- time spiral
  {
    const N = 320, pts = Array.from({ length: N + 1 }, (_, i) => helix(i / N));
    GB.add(ptube(pts, 0.0055, 5), { g: G.time, col: C('#ffb43b'), a: 0.85, q: [14, 0.12] });
    for (let L = -6; L <= 9; L++) { // a tick per decade
      const u = tu(L);
      GB.seg(helix(u, TH, TH.r - 0.012), helix(u, TH, TH.r + 0.03), 0.0035, { g: G.time, col: C('#ffcf80'), a: 0.7, u, d: [0, 1] });
    }
    TU.forEach(u => { // the marked events: a bead and a flag
      GB.add(ball(helix(u), 0.014, 12), { g: G.time, col: C('#fff0d0'), a: 1, u });
      GB.add(rod(helix(u, TH, TH.r + 0.01), helix(u, TH, TH.r + 0.085), 0.004, 5, true), { g: G.time, col: C('#ffd38a'), a: 0.9, u });
      PB.add(helix(u), { g: G.time, col: C('#ffc060'), s: 0.075, a: 0.8, d: [u, 25], p: [u * 7, 2.2] });
    });
    const q = K.rng(61);
    for (let i = 0; i < 160; i++) PB.add([TH.y0, TH.y1, 0], { g: G.time, m: 2, col: C('#ffd890'), s: 0.016 + 0.01 * q(), a: 0.8, b: [TH.r, TH.turns, TH.th0], p: [q(), 0.012 + 0.012 * q()] });
    PB.add([TH.y0, TH.y1, 0], { g: G.time, m: 7, col: C('#fff1cf'), s: 0.11, a: 1, b: [TH.r, TH.turns, TH.th0] });
  }

  // ----------------------------------------------------------------- networks at four scales
  NETS.forEach((N, i) => {
    const q = K.rng(70 + i), P0 = [], y0 = fy(N.f), g = G.net + i, col = C(N.col);
    let tries = 0;
    while (P0.length < N.n && tries++ < 4000) {
      const a = q() * TAU, rr = Math.sqrt(lerp(0.2 * 0.2, 0.37 * 0.37, q())), p = [rr * Math.sin(a), y0 + 0.03 + q() * 0.13, rr * Math.cos(a)];
      if (P0.every(o => v3.dist(o, p) > 0.085)) P0.push(p);
    }
    const n = P0.length, E = new Map(), key = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
    const near = a => P0.map((p, b) => [v3.dist(P0[a], p), b]).filter(x => x[1] !== a).sort((x, y) => x[0] - y[0]);
    for (let a = 0; a < n; a++) near(a).slice(0, 2).forEach(([, b]) => E.set(key(a, b), [a, b]));
    for (let e = 0; e < 5; e++) { const a = Math.floor(q() * n), b = near(a)[2 + Math.floor(q() * 3)][1]; E.set(key(a, b), [a, b]); }
    // join components so every node can be reached
    const comp = Array.from({ length: n }, (_, a) => a), find = a => (comp[a] === a ? a : (comp[a] = find(comp[a])));
    for (const [a, b] of E.values()) comp[find(a)] = find(b);
    for (let a = 0; a < n; a++) for (const [, b] of near(a)) if (find(a) !== find(b)) { E.set(key(a, b), [a, b]); comp[find(a)] = find(b); break; }
    const adj = Array.from({ length: n }, () => []);
    for (const [a, b] of E.values()) { adj[a].push(b); adj[b].push(a); }
    // hop distances from the best-connected node: the network grows out from it
    const root = adj.reduce((best, l, a) => (l.length > adj[best].length ? a : best), 0), hop = new Array(n).fill(-1), Q = [root];
    hop[root] = 0;
    while (Q.length) { const a = Q.shift(); for (const b of adj[a]) if (hop[b] < 0) { hop[b] = hop[a] + 1; Q.push(b); } }
    const H = Math.max(...hop) || 1;
    N.hop = hop; N.H = H;
    for (const [a, b0] of E.values()) {
      const [s, e] = hop[a] <= hop[b0] ? [a, b0] : [b0, a], dl = hop[s] / (H + 1) * 0.6;
      GB.seg(P0[s], P0[e], 0.0032, { g, col: v3.lerp(col, [1, 1, 1], 0.2), a: 0.95, d: [dl, 2.6] });
      if (i === 1 || (i === 2 && q() < 0.8) || (i === 0 && q() < 0.25)) {
        const speed = i === 1 ? 0.55 + 0.4 * q() : 0.3 + 0.2 * q();
        PB.add(P0[s], { g, m: 1, col: v3.lerp(col, [1, 1, 1], 0.5), s: 0.03, b: P0[e], p: [q(), speed], d: [dl + 0.3, 2.6] });
        if (i === 2) PB.add(P0[e], { g, m: 1, col: v3.lerp(col, [1, 1, 1], 0.5), s: 0.026, b: P0[s], p: [q(), speed * 0.8], d: [dl + 0.3, 2.6] });
      }
    }
    P0.forEach((p, a) => PB.add(p, { g, m: i === 3 ? 5 : 0, col, s: a === root ? 0.06 : 0.04 + 0.01 * q(), a: 1,
      b: [hop[a] / (H + 1), 0, 0], p: [q(), i === 3 ? 7 : 1.5 + 2 * q()], d: [hop[a] / (H + 1) * 0.6, 2.6] }));
    N.anchor = right(NAZ, FR + 0.02, y0 + 0.1);
  });

  // ----------------------------------------------------------------- medicine
  const MEDCOL = C('#3ee08f');
  MY.forEach((y, i) => {
    GS.add(ball(mp(MRHO, y), MBR, 24), { g: G.med, col: MEDCOL, a: 0.75, k: 1, u: 0, d: [i * 0.12, 4] });
    GB.add(new THREE.TorusGeometry(MBR * 1.02, 0.004, 6, 64).rotateY(Math.PI / 2 - MAZ * D2R).translate(...mp(MRHO, y)), { g: G.med, col: MEDCOL, a: 0.6, d: [i * 0.12, 4] });
  });
  for (let i = 0; i < 2; i++) GB.seg(mp(MRHO, MY[i] - MBR - 0.005), mp(MRHO, MY[i + 1] + MBR + 0.005), 0.005, { g: G.med, col: MEDCOL, a: 0.8, d: [0.3, 5] });
  for (const [yb, yf] of [[MY[0] + MBR, fy(NF - 1)], [MY[2] - MBR, fy(0)]]) {
    const s = Math.sign(yf - yb), cr = 0.08, pts = [];
    for (let y = yb; s * (yf - s * cr - y) > 0; y += s * 0.03) pts.push(mp(MRHO, y));
    for (let j = 0; j <= 8; j++) { const a = j / 8 * Math.PI / 2; pts.push(mp(MRHO - cr + cr * Math.cos(a), yf - s * cr + s * cr * Math.sin(a))); }
    for (let r = MRHO - cr - 0.03; r > FR + 0.07; r -= 0.03) pts.push(mp(r, yf));
    pts.push(mp(FR + 0.07, yf));
    GB.add(ptube(pts, 0.006, 6), { g: G.med, col: MEDCOL, a: 0.9, d: [0.45, 2.6], q: [6, 0.5] });
    GB.add(new THREE.ConeGeometry(0.026, 0.06, 14).rotateZ(Math.PI / 2).translate(FR + 0.04, 0, 0).rotateY(MAZ * D2R).translate(0, yf, 0),
      { g: G.med, col: v3.lerp(MEDCOL, [1, 1, 1], 0.3), a: 1, u: 0, d: [0.86, 8] });
  }
  // the icons: a clipboard with a tick, a pill bottle and capsule, an apple
  function icClipboard() {
    const parts = [P(new THREE.BoxGeometry(0.09, 0.12, 0.008), '#2f6fd6'), P(new THREE.BoxGeometry(0.074, 0.096, 0.003).translate(0, -0.006, 0.0055), '#f4f7fb')];
    for (let i = 0; i < 3; i++) parts.push(P(new THREE.BoxGeometry(i === 2 ? 0.026 : 0.05, 0.005, 0.002).translate(i === 2 ? -0.018 : -0.006, 0.026 - i * 0.017, 0.0075), '#8aa0bf'));
    parts.push(P(new THREE.BoxGeometry(0.036, 0.016, 0.014).translate(0, 0.058, 0.002), '#c9d3df'));
    const t0 = [0.002, -0.026, 0.009], t1 = [0.012, -0.036, 0.009], t2 = [0.03, -0.012, 0.009];
    parts.push(P(rod(t0, t1, 0.0042, 8), '#2fbf6f'), P(rod(t1, t2, 0.0042, 8), '#2fbf6f'), P(ball(t1, 0.0042, 8), '#2fbf6f'));
    return mergeLit(parts);
  }
  function icPills() {
    const parts = [P(new THREE.CylinderGeometry(0.027, 0.027, 0.07, 24).translate(-0.014, 0, 0), '#14a3a3'),
      P(new THREE.CylinderGeometry(0.0278, 0.0278, 0.03, 24).translate(-0.014, -0.004, 0), '#f4f7fb'),
      P(new THREE.CylinderGeometry(0.03, 0.03, 0.018, 24).translate(-0.014, 0.044, 0), '#f4f7fb')];
    parts.push(P(new THREE.BoxGeometry(0.016, 0.005, 0.004).translate(-0.014, -0.004, 0.028), '#ff5a4b'), P(new THREE.BoxGeometry(0.005, 0.016, 0.004).translate(-0.014, -0.004, 0.028), '#ff5a4b'));
    const half = (c, s) => mergeLit([new THREE.CylinderGeometry(0.012, 0.012, 0.022, 16, 1, true).translate(0, s * 0.011, 0),
      new THREE.SphereGeometry(0.012, 16, 8, 0, TAU, s > 0 ? 0 : Math.PI / 2, Math.PI / 2).translate(0, s * 0.022, 0)].map(g => P(g, c)));
    for (const [c, s] of [['#ff5a4b', 1], ['#f4f7fb', -1]]) parts.push(half(c, s).rotateZ(-1.0).rotateY(0.4).translate(0.03, -0.022, 0.012));
    return mergeLit(parts);
  }
  function icApple() {
    const prof = [[0, -0.032], [0.012, -0.037], [0.027, -0.033], [0.039, -0.019], [0.043, 0], [0.041, 0.016], [0.034, 0.029], [0.022, 0.036], [0.011, 0.033], [0.004, 0.027], [0, 0.025]];
    return mergeLit([P(lathe(prof, 32), '#e0453a'), P(rod([0, 0.024, 0], [0.004, 0.05, 0], 0.0028, 6), '#6b4a2a'),
      P(new THREE.SphereGeometry(1, 12, 8).scale(0.017, 0.0035, 0.008).rotateZ(0.5).translate(0.016, 0.045, 0), '#3fae5a')]);
  }
  const icMat = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05, emissive: 0x0a1424 }));
  const IC = [icClipboard(), icPills(), icApple()].map((g, i) => {
    const m = new THREE.Mesh(g, icMat);
    m.position.set(...mp(MRHO, MY[i]));
    m.renderOrder = -1;
    set.group.add(m);
    return m;
  });

  // ----------------------------------------------------------------- research groups
  RG.forEach((R, i) => {
    const g = G.rg + i, col = C(R.col), [y0, y1] = R.y, au = (x, y, z) => Math.atan2(x, z) / TAU + 0.5;
    if (i < 3) {
      for (const y of [y0, y1]) GB.add(new THREE.TorusGeometry(R.r, 0.008, 4, 96).rotateX(Math.PI / 2).translate(0, y, 0), { g, col, a: 1, q: [3, 0.15] });
      GS.add(new THREE.CylinderGeometry(R.r, R.r, y1 - y0, 72, 1, true).translate(0, (y0 + y1) / 2, 0), { g, col, a: 0.4, k: 1, u: au });
      const q = K.rng(80 + i);
      for (const y of [y0, y1]) for (let j = 0; j < 7; j++) PB.add([0, y, 0], { g, m: 3, col: v3.lerp(col, [1, 1, 1], 0.4), s: 0.03, b: [R.r, 0, 0], p: [q(), 0.25 + 0.1 * q()], d: [0, 1] });
    } else {
      // DataDiVR spans every scale: a lattice of crossing helices around the whole tower, with data flowing up
      const S = 5, turns = 0.6, q = K.rng(90);
      for (let s = 0; s < S; s++) for (const dir of [1, -1]) {
        const h = { r: R.r, turns: dir * turns, th0: s / S * TAU, y0, y1 };
        GB.add(ptube(Array.from({ length: 81 }, (_, j) => helix(j / 80, h)), 0.0038, 4), { g, col, a: 0.55, q: [3, 0.15] });
        for (let j = 0; j < 8; j++) PB.add([y0, y1, 0], { g, m: 2, col: v3.lerp(col, [1, 1, 1], 0.45), s: 0.026, b: [R.r, dir * turns, s / S * TAU], p: [q(), 0.04 + 0.03 * q()] });
      }
      for (const y of [y0, y1]) GB.add(new THREE.TorusGeometry(R.r, 0.007, 4, 112).rotateX(Math.PI / 2).translate(0, y, 0), { g, col, a: 1 });
    }
    R.anchor = i < 3 ? right(RGAZ, R.r + 0.02, (y0 + y1) / 2) : right(RGAZ, R.r + 0.02, -0.2);
  });
  // synergy arcs between the groups: a fan of nested arcs on the side away from the group labels (as on slide 33)
  {
    const PAIRS = [[0, 1, 5], [1, 2, 4], [0, 2, 4], [3, 0, 3], [3, 1, 3], [3, 2, 3]], q = K.rng(95), arcs = [];
    for (const [A, B, n] of PAIRS) for (let j = 0; j < n; j++) arcs.push([A, B]);
    const end = (R, j) => { const y = lerp(R.y[0] + 0.04, R.y[1] - 0.04, q()); return [R.r, R === RG[3] ? lerp(-1.0, 1.0, q()) : y]; };
    arcs.forEach(([A, B], j) => {
      const phi = (RGAZ - 90 + lerp(-45, 40, ((j * 0.618) % 1)) + (q() - 0.5) * 8) * D2R, twist = (q() - 0.5) * 0.25;
      const [ra, ya] = end(RG[A], j), [rb, yb] = end(RG[B], j), bul = 0.18 + 0.28 * Math.abs(ya - yb);
      const at = (rho, y, f) => { const a = phi + twist * f; return [rho * Math.sin(a), y, rho * Math.cos(a)]; };
      const pts = [];
      for (let s = 0; s <= 40; s++) { // a cubic Bezier in the (radius, height) plane
        const u = s / 40, w = [(1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3];
        pts.push(at(w[0] * ra + w[1] * (ra + bul) + w[2] * (rb + bul) + w[3] * rb, w[0] * ya + w[1] * ya + w[2] * yb + w[3] * yb, u));
      }
      const ca = C(RG[A].col), cb = C(RG[B].col);
      GB.add(ptube(pts, 0.0045, 4), { g: G.syn, col: ca, col2: cb, a: 0.9, d: [j / arcs.length * 0.6, 2.5], q: [2, j % 2 ? 0.25 : -0.25] });
    });
  }

  // ----------------------------------------------------------------- motes and dust
  {
    const q = K.rng(99);
    for (let i = 0; i < 260; i++) { // motes drifting up inside the tower
      const a = q() * TAU, rr = 0.38 * Math.sqrt(q());
      PB.add([rr * Math.sin(a), q() * 2.44 - 1.2, rr * Math.cos(a)], { g: G.motes, m: 6, col: v3.lerp(C('#7fd8ff'), [1, 1, 1], q() * 0.5), s: 0.01 + 0.008 * q(), a: 0.5, p: [0, 0.015 + 0.02 * q()] });
    }
    for (let i = 0; i < 1500; i++) { // dust the tower dissolves into
      const k = Math.floor(q() * NF), onRim = q() < 0.5, a = q() * TAU, rr = onRim ? FR : FR * Math.sqrt(q()) * (q() < 0.4 ? 0.35 : 1);
      const p = [rr * Math.sin(a), fy(k) + (rr < 0.15 ? q() * 0.18 : 0.004), rr * Math.cos(a)];
      const out = v3.add(v3.mul([Math.sin(a), 0, Math.cos(a)], 0.25 + 0.6 * q()), [0, (q() - 0.4) * 0.5, 0]);
      PB.add(p, { g: G.dust, m: 4, col: v3.lerp(FCOL[k], [1, 1, 1], 0.3 * q()), s: 0.014 + 0.012 * q(), a: 0.8, b: out, p: [q() * 0.3, (q() - 0.5) * 1.6] });
    }
  }

  // ----------------------------------------------------------------- the team
  const TEAMN = [12, 11, 9, 10], TCOL = ['#3d7fe6', '#17c2b8', '#a8c8ff', '#5ad1ff'].map(C), WARM = C('#ffcf7a');
  const PEOPLE = [], LINKS = [], TCEN = [];
  {
    const q = K.rng(120), dirs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    TEAMN.forEach((n, gi) => {
      const c = v3.mul(v3.norm(dirs[gi]), 0.6);
      c[1] *= 0.7;
      TCEN.push(c);
      for (let j = 0; j < n; j++) {
        const p = j === 0 ? c.slice() : v3.add(c, [K.gauss(q) * 0.16, K.gauss(q) * 0.13, K.gauss(q) * 0.16]);
        // where this person starts: a floor of the group's scales (RG4: any floor)
        const fl = gi === 0 ? 1 + (j % 2) : gi === 1 ? 4 + (j % 2) : gi === 2 ? 7 : j % NF, a = q() * TAU, rr = 0.12 + 0.22 * q();
        PEOPLE.push({ g: gi, p, lead: j === 0, start: [rr * Math.sin(a), fy(fl) + 0.03, rr * Math.cos(a)], dl: 0.04 + 0.32 * q(), ph: q() * TAU });
      }
    });
    // relax: keep people apart, and near their group
    for (let it = 0; it < 50; it++) {
      for (let a = 0; a < PEOPLE.length; a++) for (let b = a + 1; b < PEOPLE.length; b++) {
        const A = PEOPLE[a].p, B = PEOPLE[b].p, dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz) || 1e-3;
        const want = PEOPLE[a].g === PEOPLE[b].g ? 0.13 : 0.2;
        if (L >= want) continue;
        const s = (want - L) / L * 0.5;
        if (!PEOPLE[a].lead) { A[0] -= dx * s; A[1] -= dy * s; A[2] -= dz * s; }
        if (!PEOPLE[b].lead) { B[0] += dx * s; B[1] += dy * s; B[2] += dz * s; }
      }
      for (const A of PEOPLE) if (!A.lead) { const d = v3.sub(A.p, TCEN[A.g]), L = v3.len(d); if (L > 0.3) A.p = v3.add(TCEN[A.g], v3.mul(d, 0.3 / L)); }
    }
    const has = new Set(), link = (a, b, inter) => { const k = a < b ? a + ',' + b : b + ',' + a; if (a !== b && !has.has(k)) { has.add(k); LINKS.push([a, b, inter]); } };
    PEOPLE.forEach((A, a) => {
      PEOPLE.map((B, b) => [B.g === A.g && b !== a ? v3.dist(A.p, B.p) : 9, b]).sort((x, y) => x[0] - y[0]).slice(0, 2).forEach(([, b]) => link(a, b, false));
    });
    let base = 0;
    TEAMN.forEach((n, gi) => { for (let j = 0; j < 3; j++) link(base, base + 1 + Math.floor(q() * (n - 1)), false); base += n; });
    for (let gA = 0; gA < 4; gA++) for (let gB = gA + 1; gB < 4; gB++) for (let j = 0; j < 2; j++) {
      const ia = PEOPLE.map((P, i) => i).filter(i => PEOPLE[i].g === gA), ib = PEOPLE.map((P, i) => i).filter(i => PEOPLE[i].g === gB);
      const a = ia[Math.floor(q() * ia.length)], b = ib.map(i => [v3.dist(PEOPLE[i].p, PEOPLE[a].p) + q() * 0.25, i]).sort((x, y) => x[0] - y[0])[0][1];
      link(a, b, true);
    }
  }
  const team = new THREE.Group();
  set.group.add(team);
  {
    const TB = glowBuilder(glowMat(THREE.FrontSide)), TP = pointBuilder(), q = K.rng(130);
    LINKS.forEach(([a, b, inter]) => {
      const A = PEOPLE[a].p, B = PEOPLE[b].p, ca = TCOL[PEOPLE[a].g], cb = TCOL[PEOPLE[b].g];
      // a link draws in (on scale_team) only once both its people have landed (person i lands at dl + 0.45)
      const l0 = Math.max(PEOPLE[a].dl, PEOPLE[b].dl) + 0.45 + 0.04 * q(), dur = Math.min(0.24, 0.985 - l0), s0 = l0 + 0.6 * dur;
      const dl = [l0, 1 / dur], ds = [s0, 1 / (1 - s0)];
      if (!inter) {
        TB.seg(A, B, 0.0026, { g: G.link, col: v3.lerp(v3.lerp(ca, cb, 0.5), [1, 1, 1], 0.2), a: 0.5, d: dl });
        TP.add(A, { g: G.spark, m: 1, col: v3.lerp(ca, [1, 0.95, 0.85], 0.6), s: 0.022, b: B, p: [q(), 0.12 + 0.2 * q()], d: ds });
        return;
      }
      // collaborations between groups: warm arcs, bowed away from the centre, with sparks running both ways
      const m = v3.lerp(A, B, 0.5), cp = v3.add(m, v3.mul(v3.norm(v3.add(m, [0, 0.05, 0])), 0.05 + 0.1 * v3.dist(A, B)));
      const pts = Array.from({ length: 13 }, (_, i) => { const x = i / 12; return v3.lerp(v3.lerp(A, cp, x), v3.lerp(cp, B, x), x); });
      TB.add(ptube(pts, 0.0032, 4), { g: G.link, col: v3.lerp(WARM, ca, 0.25), col2: v3.lerp(WARM, cb, 0.25), a: 0.75, d: dl });
      for (let s = 0; s < 2; s++) TP.add(s ? B : A, { g: G.spark, m: 8, col: WARM, s: 0.036, b: s ? A : B, c: cp, p: [q(), 0.1 + 0.12 * q()], d: ds });
    });
    TCEN.forEach((c, i) => TP.add(c, { g: G.star, col: v3.lerp(TCOL[i], WARM, 0.35), s: 0.75, a: 0.11, p: [q(), 0.5], d: [0, 1] }));
    TP.add([0, 0, 0], { g: G.star, col: WARM, s: 1.1, a: 0.06, p: [0, 0.3], d: [0, 1] });
    for (let i = 0; i < 420; i++) { // warm stardust around the team
      const u = K.unit(q), p = v3.mul(u, 0.25 + 0.95 * Math.cbrt(q()));
      p[1] *= 0.8;
      TP.add(p, { g: G.star, col: q() < 0.55 ? v3.lerp(WARM, [1, 1, 1], 0.4) : v3.lerp(TCOL[i % 4], [1, 1, 1], 0.3), s: 0.008 + 0.01 * q(), a: 0.35 + 0.3 * q(), p: [q(), 0.6 + 2 * q()], d: [q() * 0.5, 2] });
    }
    team.add(TB.mesh(), TP.points());
  }
  // people: a rounded body and a warm head, lit in the shader so each group keeps its colour
  const NP = PEOPLE.length;
  const personGeo = (() => {
    const body = lathe([[0, 0], [0.024, 0], [0.027, 0.008], [0.026, 0.03], [0.022, 0.045], [0.013, 0.053], [0, 0.055]], 18);
    const g = mergeIndexed([body, new THREE.SphereGeometry(0.0165, 18, 12).translate(0, 0.075, 0)], ['position', 'normal']);
    const p = g.attributes.position, part = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) part[i] = p.getY(i) > 0.0565 ? 1 : 0;
    g.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
    g.translate(0, -0.04, 0);
    const ic = new Float32Array(NP * 3);
    PEOPLE.forEach((P, i) => ic.set(TCOL[P.g], 3 * i));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(ic, 3));
    return g;
  })();
  const pplMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 1 } },
    transparent: true,
    vertexShader: `
attribute vec3 iCol; attribute float aPart;
varying vec3 vN, vV, vC; varying float vPart;
void main() {
  vec4 p = vec4(position, 1.0); vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
  vec4 mv = modelViewMatrix * p;
  vN = normalize(normalMatrix * n); vV = -mv.xyz; vC = iCol; vPart = aPart;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform float uA, uK;
varying vec3 vN, vV, vC; varying float vPart;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.45, 0.6, 0.65));
  float d = max(dot(n, L), 0.0), rim = pow(1.0 - max(dot(n, v), 0.0), 2.0);
  vec3 base = mix(vC, vec3(1.0, 0.88, 0.72), vPart);
  vec3 c = base * (0.28 + 0.8 * d) + mix(vC, vec3(1.0, 0.8, 0.55), 0.35) * rim * 0.9 + base * 0.12;
  gl_FragColor = vec4(c, uA * uK);
}`,
  });
  set.mats.push(pplMat);
  const ppl = new THREE.InstancedMesh(personGeo, pplMat, NP);
  ppl.frustumCulled = false; ppl.renderOrder = -1;
  set.group.add(ppl);
  // a soft halo behind each person (positions follow them every frame)
  const HB = pointBuilder();
  PEOPLE.forEach(P => HB.add([0, 0, 0], { g: G.halo, col: v3.lerp(TCOL[P.g], WARM, 0.25), s: P.lead ? 0.17 : 0.13, a: 0 }));
  const halos = HB.points();
  set.group.add(halos);

  const shells = GS.mesh(), glows = GB.mesh(), pts = PB.points();
  set.group.add(shells, glows, pts);

  // ----------------------------------------------------------------- update
  const hide = x => 1 - prog(x, 0, 0.1);   // a layer's labels give way as soon as the next layer starts
  const floorRev = (S, k) => prog(S.scale_len, k * 0.11, k * 0.11 + 0.23);
  const netRev = (S, i) => prog(S.scale_net, i * 0.17, i * 0.17 + 0.49);
  const rgRev = (S, i) => prog(S.scale_rg, i * 0.22, i * 0.22 + 0.34);
  const medRev = (S, i) => prog(S.scale_med, i * 0.12 + 0.05, i * 0.12 + 0.3);
  const towerOf = S => 1 - prog(S.scale_team, 0.05, 0.55);
  const fadeMat = (m, x) => { const o = m.userData.base * set.uA.value * x; m.opacity = o; m.depthWrite = o > 0.97; };
  const _o = new THREE.Object3D();
  let spin = 0;
  const rotY = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
  function update(S, t) {
    const tf = towerOf(S), len = S.scale_len, V = uV.value, R = uR.value;
    uTF.value = tf;
    // skip draw calls for whatever is gone
    const any = len + S.scale_time + S.scale_net + S.scale_med + S.scale_rg + S.scale_syn > 0;
    discs.visible = tf > 0.001 && len > 0;
    shells.visible = glows.visible = tf > 0.001 && any;
    pts.visible = any && S.scale_team < 1;
    // floors and their emblems
    let top = -1.3;
    const hiC = Array.from({ length: NF }, (_, k) => FCOL[k].slice()), hi = new Float32Array(NF);
    NETS.forEach((N, i) => { const x = netRev(S, i) * (1 - S.scale_rg); hi[N.f] = Math.max(hi[N.f], x); hiC[N.f] = v3.lerp(hiC[N.f], N.c, x * 0.7); });
    RG.forEach((G_, i) => { const x = rgRev(S, i); for (const f of G_.floors) { hi[f] = Math.max(hi[f], x * 0.8); hiC[f] = v3.lerp(hiC[f], G_.c, x * 0.7); } });
    for (let k = 0; k < NF; k++) {
      const rv = floorRev(S, k), e = EM[k];
      uFR.value[k] = rv; uFH.value[k] = hi[k]; uFC.value.set(hiC[k], 3 * k);
      V[k] = rv > 0 ? tf : 0; R[k] = rv;
      e.visible = rv > 0.001 && tf > 0.003;
      const sc = EMS * smooth(rv) * (1 + 0.2 * Math.sin(Math.PI * rv));
      e.scale.setScalar(Math.max(sc, 1e-4));
      e.position.y = fy(k) + 0.004 - 0.05 * (1 - rv);
      e.rotation.y = t * 0.22 + k * 0.9;
      if (rv > 0) top = Math.max(top, fy(k) + 0.27 * rv);
    }
    cellRim.uniforms.uK.value = floorRev(S, 4) * tf; mitoRim.uniforms.uK.value = floorRev(S, 3) * tf;
    fadeMat(emMat, tf);
    V[G.shell] = len > 0 ? tf : 0; R[G.shell] = clamp((top + 1.2) / 2.44, 0, 1);
    V[G.motes] = smooth(len) * tf; R[G.motes] = top;
    // time
    V[G.time] = prog(S.scale_time, 0, 0.04) * tf; R[G.time] = S.scale_time;
    // networks
    NETS.forEach((N, i) => { const x = netRev(S, i); V[G.net + i] = x > 0 ? tf : 0; R[G.net + i] = x; });
    // medicine
    V[G.med] = S.scale_med > 0 ? tf : 0; R[G.med] = S.scale_med;
    fadeMat(icMat, tf);
    IC.forEach((m, i) => {
      const x = medRev(S, i);
      m.visible = x > 0.001 && tf > 0.003;
      m.scale.setScalar(Math.max(1e-4, 1.45 * smooth(x) * (1 + 0.2 * Math.sin(Math.PI * x))));
      m.rotation.set(0.12 * Math.sin(t * 0.7 + i), t * 0.5 + i * 2.1, 0);
      m.position.y = MY[i] + 0.008 * Math.sin(t * 1.1 + i * 2);
    });
    // research groups and synergies
    RG.forEach((G_, i) => { const x = rgRev(S, i); V[G.rg + i] = x > 0 ? tf : 0; R[G.rg + i] = x; });
    V[G.syn] = S.scale_syn > 0 ? tf : 0; R[G.syn] = S.scale_syn;
    // the tower dissolves into dust; the team gathers into a slowly turning constellation
    ptMat.uniforms.uDust.value = S.scale_team;
    V[G.dust] = smooth(len); R[G.dust] = 1;
    const tm = S.scale_team;
    spin = t * 0.07;
    team.rotation.y = spin;
    team.visible = ppl.visible = halos.visible = tm > 0.001;
    pplMat.depthWrite = set.uA.value > 0.97;
    V[G.link] = 1; R[G.link] = tm; V[G.spark] = 1; R[G.spark] = tm; V[G.star] = prog(tm, 0.2, 0.9); R[G.star] = prog(tm, 0.2, 1);
    V[G.halo] = 1; R[G.halo] = 1;
    if (tm > 0.001) {
      const hp = halos.geometry.attributes.position, ha = halos.geometry.attributes.aA;
      PEOPLE.forEach((P, i) => {
        const s = prog(tm, P.dl, P.dl + 0.45), born = prog(tm, P.dl * 0.4, P.dl * 0.4 + 0.08);
        const end = rotY(P.p, spin), out = v3.norm([end[0], 0, end[2]]);
        let p = v3.lerp(v3.mul(P.start, lerp(0.35, 1, len)), end, smooth(s));   // without the tower they gather from near the centre
        p = v3.add(p, v3.add(v3.mul(out, 0.22 * Math.sin(Math.PI * s)), [0, 0.12 * Math.sin(Math.PI * s), 0]));
        p[1] += 0.005 * Math.sin(t * 1.3 + P.ph) * s;
        const sc = born * lerp(0.55, 1, s) * (P.lead ? 1.5 : 1.2);
        _o.position.set(p[0], p[1], p[2]);
        _o.rotation.set(0, Math.atan2(p[0], p[2]) + 0.3 * Math.sin(t * 0.4 + P.ph), 0);
        _o.scale.setScalar(Math.max(sc, 1e-4));
        _o.updateMatrix();
        ppl.setMatrixAt(i, _o.matrix);
        hp.setXYZ(i, p[0], p[1] + 0.008, p[2]);
        ha.setX(i, born * (0.55 + 0.25 * s) * (0.85 + 0.15 * Math.sin(t * 1.7 + P.ph)));
      });
      ppl.instanceMatrix.needsUpdate = true; hp.needsUpdate = true; ha.needsUpdate = true;
    }
  }

  // ----------------------------------------------------------------- labels, anchors, views
  const anchors = {
    top: [0, fy(NF - 1) + 0.27, 0], bottom: [0, fy(0) - 0.03, 0], team: [0, 0, 0],
  };
  for (let k = 0; k < NF; k++) anchors['floor' + k] = right(FLAZ, FR + 0.03, fy(k) + 0.01);
  TU.forEach((u, i) => { anchors['time' + i] = helix(u, TH, TH.r + 0.09); });
  NETS.forEach((N, i) => { anchors['net' + i] = N.anchor; });
  MY.forEach((y, i) => { anchors['med' + i] = mp(MRHO + MBR * 0.8, y + MBR * 0.4); });
  RG.forEach((R, i) => { anchors['rg' + (i + 1)] = R.anchor; });
  TCEN.forEach((c, i) => { anchors['team' + (i + 1)] = () => rotY(c, spin); });
  const tIn = (x, u) => prog(x, u, Math.min(u + 0.05, 1));   // a time label fades in as the head passes u (fully in at the top)
  const labels = [
    ...FLOORS.map((f, k) => ({ text: f, at: 'floor' + k, cls: 'cyn',
      alpha: S => prog(S.scale_len, k * 0.11 + 0.1, k * 0.11 + 0.23) * hide(Math.max(S.scale_time, S.scale_net, S.scale_med, S.scale_rg, S.scale_team)) })),
    ...TIMES.map((m, i) => ({ text: [m[0], m[1]], at: 'time' + i, cls: 'amb',
      alpha: S => tIn(S.scale_time, TU[i]) * (i + 6 < TU.length ? 1 - tIn(S.scale_time, TU[i + 6] - 0.02) : 1)   // six at most: the oldest gives way
        * hide(Math.max(S.scale_net, S.scale_med, S.scale_rg, S.scale_team)) })),
    ...NETS.map((N, i) => ({ text: N.text, at: 'net' + i, cls: N.cls,
      alpha: S => prog(netRev(S, i), 0.3, 0.8) * hide(Math.max(S.scale_med, S.scale_rg, S.scale_team)) })),
    ...MED.map((m, i) => ({ text: m, at: 'med' + i, cls: 'grn', alpha: S => medRev(S, i) * hide(Math.max(S.scale_rg, S.scale_team)) })),
    ...RG.map((R, i) => ({ text: R.text, at: 'rg' + (i + 1), cls: R.cls, alpha: S => prog(rgRev(S, i), 0.3, 0.8) * hide(S.scale_team) })),
  ];
  const tower = [15, 18, 5.4, 0, 0.02, 0];
  return Object.assign(set, {
    params: { scale_a: 1, scale_len: 1, scale_time: 0, scale_net: 0, scale_med: 0, scale_rg: 0, scale_syn: 0, scale_team: 0 },
    update, anchors, labels,
    cam: { default: tower, tower, low: [-8, 3, 2.7, 0, -0.6, 0], high: [12, 24, 3.0, 0, 0.42, 0], groups: [RGAZ, 18, 5.4, 0, 0.02, 0], time: [20, 16, 5.3, 0, 0, 0], team: [0, 12, 3.1, 0, 0, 0] },
    controls: [
      { key: 'view', label: 'View', options: [['tower', 'Scales'], ['groups', 'Groups'], ['team', 'Team']] },
      { key: 'time', label: 'Time', options: [['off', 'Off'], ['on', 'On']] },
      { key: 'nets', label: 'Networks', options: [['off', 'Off'], ['on', 'On']] },
      { key: 'med', label: 'Medicine', options: [['off', 'Off'], ['on', 'On']] },
    ],
    explore(c) {
      const tm = c.view === 'team', gr = c.view === 'groups', on = k => (c.view === 'tower' && c[k] === 'on' ? 1 : 0);
      return { scale_len: 1, scale_time: on('time'), scale_net: on('nets'), scale_med: on('med'), scale_rg: gr ? 1 : 0, scale_syn: gr ? 1 : 0, scale_team: tm ? 1 : 0 };
    },
  });
};

// Whole-body networks (slides 34-35): a standing figure, arms raised, as a total-body PET scan (a dense point
// cloud drawn as a maximum-intensity projection in the 'hot iron' colour map), the tracer sugar arriving through
// the blood and settling in the organs, then a network of 12 organs whose links rewire in disease.
SETS.body = function (K) {
  const { THREE, clamp, rng, v3 } = K;
  const set = K.newSet('body');
  const R = rng(34);
  const PI = Math.PI;

  // ------------------------------------------------------------ helpers --
  // smooth value noise (deterministic) for tissue texture
  const hash = (i, j, k) => {
    let h = (i * 374761393 + j * 668265263 + k * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fade3 = x => x * x * (3 - 2 * x);
  function noise(x, y, z) {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    const u = fade3(x - i), v = fade3(y - j), w = fade3(z - k);
    const a = (di, dj) => hash(i + di, j + dj, k) * (1 - w) + hash(i + di, j + dj, k + 1) * w;
    return (a(0, 0) * (1 - v) + a(0, 1) * v) * (1 - u) + (a(1, 0) * (1 - v) + a(1, 1) * v) * u;
  }
  // organ edges fall off smoothly (white core, yellow and orange rim), as the scanner's blur does
  const soft = (fn, k) => (p, q, a) => fn(p, q, a) * (1 - k * K.smooth((q - 0.78) / 0.22));
  // smooth union of two distances
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  // distance to a tapered capsule from a to b (radii ra, rb)
  function cone(x, y, z, c) {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    let h = (px * c[3] + py * c[4] + pz * c[5]) * c[6];
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = px - c[3] * h, dy = py - c[4] * h, dz = pz - c[5] * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (c[7] + (c[8] - c[7]) * h);
  }
  const mkCone = (a, b, ra, rb) => { const d = v3.sub(b, a); return [a[0], a[1], a[2], d[0], d[1], d[2], 1 / v3.dot(d, d), ra, rb]; };
  // approximate distance to an ellipsoid
  function ell(x, y, z, c, r) {
    const a = (x - c[0]) / r[0], b = (y - c[1]) / r[1], d = (z - c[2]) / r[2];
    return (Math.sqrt(a * a + b * b + d * d) - 1) * Math.min(r[0], r[1], r[2]);
  }

  // ------------------------------------------------------ the body shape --
  // y up, the figure faces +z, the person's left is +x; feet at y -0.95, hands at about +0.95
  const SIDES = [1, -1];
  const torsoRings = [   // y, half width, half depth, z centre
    [-0.135, 0.145, 0.092, -0.012], [-0.08, 0.158, 0.104, -0.012], [-0.01, 0.160, 0.102, -0.002], [0.08, 0.142, 0.097, 0.008],
    [0.18, 0.140, 0.100, 0.010], [0.30, 0.153, 0.108, 0.006], [0.40, 0.160, 0.104, 0.0], [0.47, 0.150, 0.088, -0.010],
    [0.53, 0.090, 0.060, -0.016],
  ];
  function torso(x, y, z) {
    const T = torsoRings, y0 = T[0][0], y1 = T[T.length - 1][0], yy = clamp(y, y0, y1);
    let i = 0;
    while (i < T.length - 2 && yy > T[i + 1][0]) i++;
    const f = fade3((yy - T[i][0]) / (T[i + 1][0] - T[i][0]));
    const at = c => T[i][c] + (T[i + 1][c] - T[i][c]) * f, w = at(1), d = at(2), zc = at(3);
    const q = Math.hypot(x / w, (z - zc) / d), e = (q - 1) * Math.min(w, d);
    const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
    return dy > 0 ? Math.hypot(Math.max(e, 0), dy) : e;
  }
  // joints of the pose (left side; the right side mirrors x)
  const J = {
    shoulder: [0.172, 0.468, -0.012], elbow: [0.33, 0.79, -0.002],
    hip: [0.086, -0.07, 0.0], knee: [0.094, -0.47, 0.012], ankle: [0.100, -0.872, -0.014],
    heel: [0.100, -0.918, -0.036], toe: [0.126, -0.93, 0.165],
  };
  const mir = (p, s) => [p[0] * s, p[1], p[2]];
  // hands rest crossed above the head: the left hand a little in front of the right
  const tips = { 1: [-0.045, 0.93, 0.038], [-1]: [0.045, 0.925, 0.004] };
  const wrists = { 1: [0.108, 0.902, 0.026], [-1]: [-0.108, 0.898, 0.006] };
  // limbs: [cone, blend radius, bounding sphere x, y, z, r]
  const limbs = [];
  const limb = (a, b, ra, rb, k) => {
    const m = v3.lerp(a, b, 0.5);
    limbs.push([mkCone(a, b, ra, rb), k, m[0], m[1], m[2], v3.dist(a, b) / 2 + Math.max(ra, rb)]);
  };
  for (const s of SIDES) {
    limb(mir(J.shoulder, s), mir(J.elbow, s), 0.048, 0.037, 0.05);
    limb(mir(J.elbow, s), wrists[s], 0.035, 0.024, 0.025);
    limb(wrists[s], v3.lerp(wrists[s], tips[s], 0.82), 0.024, 0.02, 0.012);
    limb(mir(J.hip, s), mir(J.knee, s), 0.084, 0.049, 0.06);
    limb(mir(J.knee, s), mir(J.ankle, s), 0.047, 0.027, 0.025);
    limb(mir(J.heel, s), mir(J.toe, s), 0.032, 0.022, 0.025);
  }
  const neck = mkCone([0, 0.49, -0.014], [0, 0.645, -0.004], 0.05, 0.046);
  function bodySDF(x, y, z) {
    let d = torso(x, y, z);
    if (y > 0.4) {
      d = smin(d, cone(x, y, z, neck), 0.04);
      d = smin(d, ell(x, y, z, [0, 0.712, 0.002], [0.077, 0.112, 0.097]), 0.03);
      d = smin(d, ell(x, y, z, [0, 0.632, 0.03], [0.058, 0.045, 0.066]), 0.02);
    }
    for (let i = 0; i < limbs.length; i++) {
      // skip a limb when even its bounding sphere is too far to change the blend
      const L = limbs[i], dx = x - L[2], dy = y - L[3], dz = z - L[4], m = Math.max(0, d + L[1] + L[5]);
      if (dx * dx + dy * dy + dz * dz > m * m) continue;
      d = smin(d, cone(x, y, z, L[0]), L[1]);
    }
    if (y < -0.4) d = smin(d, ell(Math.abs(x), y, z, [0.097, -0.59, -0.022], [0.046, 0.11, 0.05]), 0.03);   // calves
    return d;
  }

  // ------------------------------------------------------ point storage --
  // every point: position, steady intensity aI, uptake window aU (tracer progress), blood transient aB
  // (amplitude, arrival), size, and its response aK (see RESP)
  const MAX = 60000, XS = 0.9;   // XS: the figure is modelled a little broad, then slimmed across
  const P = new Float32Array(MAX * 3), AI = new Float32Array(MAX), AU = new Float32Array(MAX * 2);
  const AB = new Float32Array(MAX * 2), AS = new Float32Array(MAX), AK = new Float32Array(MAX * 3);
  let N = 0, resp = [0, 0, 0];
  function put(p, I, up, size, bAmp, bArr) {
    if (N >= MAX) return;
    P[3 * N] = p[0] * XS; P[3 * N + 1] = p[1]; P[3 * N + 2] = p[2];
    AI[N] = I; AU[2 * N] = up[0]; AU[2 * N + 1] = up[1];
    AB[2 * N] = bAmp || 0; AB[2 * N + 1] = bArr || 0; AS[N] = size;
    AK.set(resp, 3 * N);
    N++;
  }
  // how a kind of tissue responds: [early floor (soft tissue shows faintly from the first seconds, while the
  // blood spreads the tracer), relative change in disease, extra uptake in disease]. The disease scan (slide 35)
  // has more diffuse uptake in tissue and muscle and less in the heart and the urinary tract.
  const RESP = { none: [0, 0, 0], heart: [0, -0.45, 0], urine: [0, -0.18, 0] };
  const tissueResp = m => [0.25, 0, 0.02 + 0.08 * m];
  // when the tracer reaches each kind of tissue: [start, end] of uptake in body_pet units (0 injection, 1 steady scan)
  const UP = {
    tissue: [0.14, 0.6], bone: [0.2, 0.7], brain: [0.16, 0.72], heart: [0.12, 0.5], liver: [0.08, 0.32], spleen: [0.1, 0.38],
    kidney: [0.1, 0.3], pelvis: [0.26, 0.55], ureter: [0.42, 0.8], bladder: [0.5, 0.96], gut: [0.24, 0.78], gland: [0.18, 0.66],
  };
  const jit = a => 1 + (R() * 2 - 1) * a;
  // n points uniformly inside an ellipsoid (optionally on rotated axes); fn(p, q, a) gives the intensity (q radius 0..1)
  function ellFill(c, r, n, fn, up, size, axes, bA, bT) {
    for (let k = 0, guard = 0; k < n && guard < n * 4; guard++) {
      const a = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1], q = Math.hypot(a[0], a[1], a[2]);
      if (q > 1) continue;
      let o = [a[0] * r[0], a[1] * r[1], a[2] * r[2]];
      if (axes) o = v3.add(v3.add(v3.mul(axes[0], o[0]), v3.mul(axes[1], o[1])), v3.mul(axes[2], o[2]));
      const p = v3.add(c, o), I = fn(p, q, a);
      if (I <= 0) continue;
      put(p, I, up, size, bA, bT);
      k++;
    }
  }
  // an orthonormal frame whose first axis points along d
  function frame(d) {
    const u = v3.norm(d), ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const w = v3.norm(v3.cross(u, ref)), v = v3.cross(w, u);
    return [u, v, w];
  }
  // axes for an ellipsoid whose second (y) radius lies along d
  const along = d => { const f = frame(d); return [f[1], f[0], f[2]]; };
  // a smooth curve through points; returns { at(s), len }
  function curve(pts) {
    const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
    const len = c.getLength(), tmp = new THREE.Vector3();
    return { len, at: s => { c.getPointAt(clamp(s, 0, 1), tmp); return [tmp.x, tmp.y, tmp.z]; } };
  }
  // n points inside a tube of radius rad(s) along a curve; fn(s, p) gives the intensity
  function tubeFill(pts, rad, n, fn, up, size) {
    const c = curve(pts);
    for (let k = 0; k < n; k++) {
      const s = R(), u = K.unit(R), rr = (typeof rad === 'function' ? rad(s) : rad) * Math.cbrt(R());
      const p = v3.add(c.at(s), v3.mul(u, rr)), I = fn(s, p);
      if (I > 0) put(p, I, up, size);
    }
  }

  // ------------------------------------------------------ soft tissue --
  // uniform fill of the body: sample cells of a coarse grid that touch the body, keep points inside
  const lungs = [[-0.088, 0.365, -0.01, 0.068, 0.135, 0.088], [0.09, 0.375, -0.016, 0.058, 0.125, 0.083]];
  const inLung = p => lungs.some(L => ell(p[0], p[1], p[2], L, [L[3], L[4], L[5]]) < 0);
  // the body part a point belongs to: [muscle pattern 0..1, thickness of the part]. The pattern is low-frequency
  // and drawn out along the limb (or the trunk), so muscles show as long faint bundles.
  function part(p) {
    let best = torso(p[0], p[1], p[2]), ax = [0, 1, 0], th = 0.2;
    if (p[1] > 0.5 && Math.abs(p[0]) < 0.1) th = 0.17;   // neck and head
    for (const L of limbs) {
      const d = cone(p[0], p[1], p[2], L[0]);
      if (d < best) { best = d; ax = [L[0][3], L[0][4], L[0][5]]; th = L[0][7] + L[0][8]; }
    }
    const u = v3.norm(ax), a = v3.dot(p, u), q = v3.sub(p, v3.mul(u, a));
    return [noise(a * 5 + 11, (q[0] + 0.6 * q[2]) * 22, (q[1] - 0.6 * q[2] + 0.3 * q[0]) * 22 + 5), th];
  }
  {
    const G = 0.05, X0 = -0.425, Y0 = -0.975, Z0 = -0.175, NX = 17, NY = 39, NZ = 8, cells = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) {
      const dc = bodySDF(X0 + (i + 0.5) * G, Y0 + (j + 0.5) * G, Z0 + (k + 0.5) * G);
      // cells wholly inside need no test per point (their centre's depth stands in for the depth term)
      if (dc < G * 0.9) cells.push([X0 + i * G, Y0 + j * G, Z0 + k * G, dc < -G * 0.88 ? dc : 0]);
    }
    const NT = 24000;
    for (let k = 0, guard = 0; k < NT && guard < NT * 8; guard++) {
      const c = cells[Math.floor(R() * cells.length)], p = [c[0] + R() * G, c[1] + R() * G, c[2] + R() * G];
      const d = c[3] || bodySDF(p[0], p[1], p[2]);
      if (d > 0) continue;
      // Under max blending, tissue deeper than 0.045 adds little that shallower tissue does not (it is no brighter):
      // keep a third of it. That thins the thick trunk, so the limbs get relatively more points and every part
      // ends up with a similar number of points along a ray (smooth projection at a low fill cost).
      if (d < -0.045 && R() < 0.67) continue;
      k++;
      // deeper tissue (muscle) takes up a little more than skin and fat; the chest is darker (air in the lungs)
      const [m, th] = part(p);
      let I = 0.13 + 0.045 * K.smooth(-d / 0.03) + 0.04 * (noise(p[0] * 14, p[1] * 14, p[2] * 14) - 0.5) + 0.06 * (m - 0.5);
      if (inLung(p)) I *= 0.6;
      else if (p[1] > -0.12 && p[1] < 0.2 && Math.abs(p[0]) < 0.12) I += 0.015;
      resp = tissueResp(m);
      // thin parts (forearms, hands, feet) have fewer points along each ray: larger sprites keep them as smooth as the trunk
      put(p, I, UP.tissue, 0.021 * clamp(Math.sqrt(0.09 / th), 0.9, 1.4));
      // a soft glow just under the skin, so the outline fades like a real scan rather than ending in dots
      if (d > -0.008 && R() < 0.5) put(p, 0.05 * jit(0.05), UP.tissue, 0.03);
    }
    resp = RESP.none;
  }

  // ------------------------------------------------------------ skeleton --
  const BONE = 0.22, LONG = 0.26, MARROW = 0.26, bs = 0.013;   // LONG: the long bones of the limbs read as faint lines
  const bone = (I, j) => () => I * jit(j || 0.08);
  // spine: vertebral bodies with discs between them (marrow lights them up), and spinous processes behind
  const spine = curve([[0, 0.63, -0.026], [0, 0.55, -0.026], [0, 0.48, -0.046], [0, 0.38, -0.066], [0, 0.27, -0.066],
    [0, 0.18, -0.052], [0, 0.08, -0.034], [0, 0.0, -0.04]]);
  for (let v = 0; v < 24; v++) {
    const s = (v + 0.5) / 24, c = spine.at(s), r = 0.011 + 0.012 * s;
    ellFill(c, [r * 1.15, 0.0085 + 0.006 * s, r], 34 + Math.round(30 * s), bone(MARROW), UP.bone, bs);
    ellFill(v3.add(c, [0, -0.004, -0.03 - 0.008 * s]), [0.005, 0.006, 0.014], 8, bone(BONE), UP.bone, bs);
  }
  // sacrum and pelvis (iliac wings as curved plates, pubic and ischial rami)
  tubeFill([[0, -0.01, -0.05], [0, -0.06, -0.072], [0, -0.11, -0.082], [0, -0.135, -0.07]], s => 0.03 * (1 - s) + 0.008, 260,
    bone(MARROW), UP.bone, bs);
  for (const s of SIDES) {
    const c = [0.072 * s, -0.012, -0.02];
    for (let k = 0, g = 0; k < 420 && g < 4000; g++) {
      const u = K.unit(R);
      if (u[1] < -0.15 || u[0] * s < -0.25 || u[2] > 0.75) continue;
      const p = v3.add(c, [u[0] * 0.07, u[1] * 0.07, u[2] * 0.055]);
      put(p, (p[1] > 0.035 ? MARROW + 0.03 : MARROW) * jit(0.15), UP.bone, bs);
      k++;
    }
    tubeFill([[0.02 * s, -0.095, 0.055], [0.06 * s, -0.09, 0.035], [0.088 * s, -0.068, 0.006]], 0.008, 70, bone(BONE), UP.bone, bs);
    tubeFill([[0.025 * s, -0.11, 0.045], [0.06 * s, -0.13, 0.0], [0.09 * s, -0.08, -0.01]], 0.009, 70, bone(BONE), UP.bone, bs);
  }
  // ribs: 12 pairs curving forward and down from the spine; the upper seven reach the sternum
  for (let i = 0; i < 12; i++) {
    const yb = 0.488 - i * 0.0245, f = Math.min(1, (i + 1) / 8);
    const W = 0.07 + 0.075 * Math.sin(f * PI / 2) - (i > 8 ? 0.012 * (i - 8) : 0);
    const D = 0.07 + 0.03 * f, tmax = i < 7 ? 0.9 : i < 10 ? 0.82 - 0.04 * (i - 7) : 0.5 - 0.1 * (i - 10);
    for (const s of SIDES) {
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const th = 0.12 + (tmax * PI - 0.12) * k / 8;
        pts.push([s * (0.018 + W * Math.sin(th)), yb - 0.085 * (th / PI) - 0.02 * Math.sin(th), 0.004 - D * Math.cos(th)]);
      }
      tubeFill(pts, 0.0045, 140, bone(BONE + 0.02, 0.08), UP.bone, bs);
    }
  }
  tubeFill([[0, 0.475, 0.092], [0, 0.4, 0.103], [0, 0.31, 0.104]], 0.011, 160, bone(MARROW), UP.bone, bs);   // sternum
  for (const s of SIDES) {
    // clavicle
    tubeFill([[0.016 * s, 0.488, 0.075], [0.09 * s, 0.505, 0.058], [0.16 * s, 0.52, -0.002]], 0.0065, 80, bone(BONE), UP.bone, bs);
    // scapula: a thin triangle on the back, turned up with the raised arm
    const A = [0.055 * s, 0.45, -0.095], B = [0.155 * s, 0.505, -0.06], C = [0.125 * s, 0.32, -0.088];
    for (let k = 0; k < 200; k++) {
      let a = R(), b = R();
      if (a + b > 1) { a = 1 - a; b = 1 - b; }
      put(v3.add(A, v3.add(v3.mul(v3.sub(B, A), a), v3.mul(v3.sub(C, A), b))), BONE * 0.9 * jit(0.15), UP.bone, bs);
    }
    // arm: humerus, radius and ulna, and the bones of the hand fanning out to the fingers
    const sh = mir(J.shoulder, s), el = mir(J.elbow, s), wr = wrists[s], tp = tips[s];
    ellFill(sh, [0.02, 0.02, 0.02], 40, bone(MARROW), UP.bone, bs);
    tubeFill([sh, el], 0.0095, 210, bone(LONG), UP.bone, bs);
    const fw = frame(v3.sub(wr, el));
    for (const o of [-0.008, 0.008]) {
      tubeFill([v3.add(el, v3.mul(fw[2], o)), v3.add(wr, v3.mul(fw[2], o * 1.4))], 0.0055, 90, bone(BONE), UP.bone, bs);
    }
    const fh = frame(v3.sub(tp, wr));
    for (let f = 0; f < 5; f++) {
      const o = (f - 2) * 0.016, a = v3.add(wr, v3.mul(fh[2], o * 0.4));
      const b = v3.add(tp, v3.add(v3.mul(fh[2], o), v3.mul(fh[0], f === 2 ? 0.012 : -Math.abs(f - 2) * 0.01)));
      tubeFill([a, b], 0.0035, 28, bone(BONE), UP.bone, 0.012);
    }
    // leg: femoral head and neck, femur, knee, patella, tibia, fibula, foot
    const hp = mir(J.hip, s), kn = mir(J.knee, s), an = mir(J.ankle, s);
    ellFill(v3.add(hp, [0.002 * s, 0.002, 0]), [0.022, 0.022, 0.022], 50, bone(MARROW), UP.bone, bs);
    tubeFill([hp, [0.135 * s, -0.09, -0.004], [0.13 * s, -0.12, 0.0]], 0.012, 70, bone(MARROW), UP.bone, bs);
    tubeFill([[0.13 * s, -0.11, 0.0], [0.115 * s, -0.3, 0.008], kn], 0.011, 360, bone(LONG), UP.bone, bs);
    // the knee joint: a soft glow (the joint takes up a little more than the shafts), not a cluster of beads
    ellFill(v3.add(kn, [0, 0.002, -0.004]), [0.038, 0.024, 0.032], 110, soft(() => 0.27 * jit(0.06), 0.4), UP.bone, 0.018);
    ellFill(v3.add(kn, [0, 0.008, 0.045]), [0.016, 0.02, 0.008], 30, bone(BONE + 0.04), UP.bone, bs);
    tubeFill([v3.add(kn, [0, -0.02, 0.0]), v3.add(an, [0, 0.01, 0.004])], s2 => 0.013 - 0.004 * s2, 320, bone(LONG), UP.bone, bs);
    tubeFill([v3.add(kn, [0.032 * s, -0.03, -0.018]), v3.add(an, [0.024 * s, 0.0, -0.01])], 0.0055, 110, bone(BONE * 0.95), UP.bone,
      bs);
    ellFill(v3.add(an, [0, -0.02, -0.004]), [0.022, 0.016, 0.026], 50, bone(BONE + 0.04), UP.bone, bs);
    const hl = mir(J.heel, s), to = mir(J.toe, s);
    for (let f = 0; f < 5; f++) {
      const a = v3.add(hl, [0.004 * s * (f - 2), 0.012, 0.03]), b = v3.add(to, [0.011 * s * (f - 2), 0.002, -0.004 * Math.abs(f - 2)]);
      tubeFill([a, b], 0.004, 30, bone(BONE), UP.bone, 0.012);
    }
  }
  // skull (faint behind the bright brain) and jaw
  ellFill([0, 0.722, -0.004], [0.074, 0.105, 0.094], 450, (p, q) => (q > 0.88 ? 0.24 * jit(0.15) : 0), UP.bone, bs);
  tubeFill([[-0.055, 0.66, -0.01], [-0.045, 0.6, 0.04], [0, 0.585, 0.075], [0.045, 0.6, 0.04], [0.055, 0.66, -0.01]], 0.006, 140,
    bone(0.26), UP.bone, bs);

  // -------------------------------------------------------------- organs --
  const os = 0.021;
  // brain: grey matter (cortex, deep nuclei) brightest of all; cerebellum just below
  ellFill([0, 0.738, -0.008], [0.066, 0.06, 0.084], 1500, soft((p, q) => {
    const folds = noise(p[0] * 70, p[1] * 70, p[2] * 70);
    if (q > 0.72) return 1.0 + 0.12 * folds;
    return Math.hypot(Math.abs(p[0]) - 0.02, p[1] - 0.728, p[2] + 0.004) < 0.02 ? 0.95 : 0.62 + 0.1 * folds;
  }, 0.4), UP.brain, 0.02);
  ellFill([0, 0.668, -0.058], [0.05, 0.027, 0.032], 260, soft(() => 0.8, 0.3), UP.brain, 0.02);
  // glands and muscles of the head and neck: eyes' muscles, tonsils, salivary glands, larynx, thyroid
  for (const s of SIDES) {
    ellFill([0.03 * s, 0.705, 0.072], [0.011, 0.009, 0.012], 24, soft(() => 0.42, 0.5), UP.gland, 0.014);
    ellFill([0.017 * s, 0.618, 0.02], [0.01, 0.012, 0.01], 30, soft(() => 0.62, 0.5), UP.gland, 0.014);
    ellFill([0.06 * s, 0.645, -0.002], [0.012, 0.024, 0.018], 40, soft(() => 0.38, 0.5), UP.gland, 0.014);
    ellFill([0.035 * s, 0.6, 0.03], [0.011, 0.01, 0.011], 24, soft(() => 0.45, 0.5), UP.gland, 0.014);
    ellFill([0.017 * s, 0.548, 0.042], [0.009, 0.019, 0.009], 40, soft(() => 0.42, 0.5), UP.gland, 0.014);
  }
  ellFill([0, 0.57, 0.04], [0.012, 0.012, 0.01], 24, soft(() => 0.48, 0.5), UP.gland, 0.014);
  // heart: the left ventricle's thick wall burns white-hot, the right ventricle less; blood in the chambers flashes early
  const lvAxes = frame([0.646, -0.57, 0.494]), rvAxes = frame([0.5, -0.6, 0.62]);
  resp = RESP.heart;
  ellFill([0.042, 0.293, 0.052], [0.062, 0.041, 0.041], 750, soft((p, q) => (q > 0.6 ? 1.05 : 0.3), 0.4), UP.heart, os, lvAxes);
  ellFill([-0.004, 0.285, 0.074], [0.05, 0.036, 0.022], 260, (p, q) => (q > 0.72 ? 0.55 : 0), UP.heart, os, rvAxes);
  resp = RESP.none;
  ellFill([0.042, 0.293, 0.052], [0.04, 0.024, 0.024], 220, () => 0.26, [0.08, 0.14], os, lvAxes, 0.85, 0.08);
  ellFill([-0.004, 0.285, 0.074], [0.04, 0.028, 0.016], 160, () => 0.24, [0.05, 0.1], os, rvAxes, 0.95, 0.04);
  ellFill([-0.036, 0.315, 0.03], [0.026, 0.03, 0.024], 140, () => 0.22, [0.04, 0.1], os, null, 0.95, 0.03);   // right atrium
  ellFill([0.018, 0.335, -0.002], [0.026, 0.022, 0.02], 120, () => 0.22, [0.08, 0.14], os, null, 0.8, 0.075);   // left atrium
  // lungs: little uptake, but the blood passes through them early
  for (const L of lungs) ellFill(L, [L[3], L[4], L[5]], 480, () => 0.05, [0.06, 0.12], 0.022, null, 0.36, 0.055);
  // liver: a big wedge under the right diaphragm, medium (orange); spleen beside the stomach
  const liverI = p => 0.44 + 0.08 * (noise(p[0] * 30, p[1] * 30, p[2] * 30) - 0.5);
  ellFill([-0.082, 0.205, 0.012], [0.082, 0.088, 0.085], 1050, (p, q, a) => (a[1] < -0.55 + 0.5 * a[0] ? 0 : liverI(p)), UP.liver,
    0.022, null, 0.22, 0.12);
  ellFill([0.005, 0.232, 0.035], [0.075, 0.042, 0.055], 430, (p, q, a) => (a[1] < -0.3 - 0.5 * a[0] ? 0 : liverI(p)), UP.liver,
    0.022, null, 0.22, 0.12);
  const n40 = p => noise(p[0] * 40, p[1] * 40, p[2] * 40);
  ellFill([0.12, 0.2, -0.056], [0.03, 0.056, 0.03], 300, soft(p => 0.46 + 0.04 * n40(p), 0.15), UP.spleen, os, along([0.35, 1, -0.2]));
  // stomach (with the gullet) and pancreas
  tubeFill([[0.004, 0.56, 0.0], [0.006, 0.42, -0.035], [0.02, 0.33, -0.03], [0.055, 0.29, -0.005]], 0.006, 140, () => 0.3 * jit(0.1),
    UP.gut, 0.016);
  tubeFill([[0.06, 0.29, -0.004], [0.104, 0.24, 0.02], [0.1, 0.17, 0.05], [0.05, 0.13, 0.07], [0.0, 0.142, 0.062],
    [-0.026, 0.162, 0.046]], s => 0.034 - 0.018 * s, 460, (s, p) => 0.27 + 0.06 * n40(p), UP.gut, os);
  tubeFill([[-0.036, 0.116, 0.02], [0.02, 0.135, -0.006], [0.07, 0.15, -0.026], [0.106, 0.166, -0.04]], s => 0.016 - 0.006 * s, 240,
    (s, p) => 0.3 + 0.06 * n40(p), UP.liver, os);
  // kidneys (bright cortex, white-hot collecting system as the tracer is cleared into the urine), ureters, bladder
  resp = RESP.urine;
  for (const s of SIDES) {
    const c = [0.072 * s, s > 0 ? 0.115 : 0.098, -0.066], ax = along([-0.24 * s, 1, 0.12]);
    ellFill(c, [0.026, 0.052, 0.022], 400, soft(p => 0.72 + 0.18 * noise(p[0] * 110, p[1] * 110, p[2] * 110), 0.3), UP.kidney, os, ax,
      0.3, 0.12);
    // calyces collecting the urine, and the renal pelvis
    for (let k = 0; k < 5; k++) {
      const u = (k - 2) / 2.2, cc = v3.add(c, [(-0.004 - 0.006 * (1 - u * u)) * s, u * 0.034, 0.003]);
      ellFill(cc, [0.007, 0.007, 0.006], 26, () => 0.98, UP.pelvis, 0.014);
    }
    ellFill(v3.add(c, [-0.016 * s, -0.004, 0.003]), [0.007, 0.012, 0.006], 40, () => 1.0, UP.pelvis, 0.015);
    const ureter = [[0.06 * s, c[1] - 0.008, -0.058], [0.05 * s, 0.03, -0.046], [0.056 * s, -0.04, -0.03], [0.046 * s, -0.094, 0.0],
      [0.024 * s, -0.11, 0.03]];
    // urine moves down the ureters in waves (peristalsis), so they show in segments
    tubeFill(ureter, 0.0045, 170, u => 0.82 * (0.45 + 0.55 * Math.pow(Math.sin(u * 9 + s), 2)), UP.ureter, 0.015);
  }
  ellFill([0, -0.112, 0.045], [0.048, 0.036, 0.04], 400, soft(() => 1.0, 0.4), UP.bladder, 0.022);
  resp = RESP.none;
  // bowel: small intestine coiled in the middle, the colon framing it; uptake patchy
  {
    const pts = [], r = rng(5);
    let p = [0, 0.03, 0.03], dir = [1, 0, 0];
    for (let k = 0; k < 46; k++) {
      dir = v3.norm(v3.add(v3.mul(dir, 0.55), v3.add(K.unit(r), v3.mul(v3.sub([0, 0.02, 0.035], p), 6))));
      p = v3.add(p, v3.mul(dir, 0.026));
      pts.push([clamp(p[0], -0.085, 0.085), clamp(p[1], -0.05, 0.1), clamp(p[2], -0.02, 0.08)]);
    }
    tubeFill(pts, 0.011, 1050, (s, q) => 0.22 + 0.14 * Math.pow(noise(q[0] * 30, q[1] * 30, q[2] * 30), 2), UP.gut, 0.018);
    const colon = [[-0.104, -0.065, 0.024], [-0.11, 0.04, 0.004], [-0.098, 0.13, 0.02], [-0.03, 0.104, 0.074],
      [0.04, 0.104, 0.074], [0.11, 0.152, 0.004], [0.116, 0.05, -0.012], [0.104, -0.04, 0.004], [0.06, -0.085, 0.034],
      [0.0, -0.08, -0.03], [0.0, -0.13, -0.064]];
    tubeFill(colon, 0.019, 820, (s, q) => 0.24 + 0.5 * Math.pow(noise(q[0] * 18 + 3, q[1] * 18, q[2] * 18), 3), UP.gut, 0.02);
  }

  // ------------------------------------------------------- blood vessels --
  // the tracer is injected into a vein of the right arm, passes the right heart and the lungs, then the arteries
  const BLOOD = 0.23, vs = 0.014;
  // the tracer shows in a vessel once the bolus arrives (a bright flash), then settles to the blood level
  const flow = (pts, rad, n, arrive, amp) => {
    const c = curve(pts);
    for (let k = 0; k < n; k++) {
      const s = R(), p = v3.add(c.at(s), v3.mul(K.unit(R), rad * Math.cbrt(R()))), arr = Math.min(0.62, arrive(s, c.len));
      put(p, BLOOD * jit(0.1), [arr, arr + 0.06], vs, amp, arr);
    }
    return c.len;
  };
  const vessel = (pts, rad, n, a0, amp, speed) => flow(pts, rad, n, (s, len) => a0 + s * len * speed, amp);
  const vein = (pts, rad, n, a0, a1) => flow(pts, rad, n, s => a0 + (a1 - a0) * s, 1.0);
  const INJ = [-0.21, 0.83, 0.03];   // the injection site, in a vein of the right forearm
  vein([INJ, mir(J.elbow, -1), [-0.24, 0.62, 0.01], [-0.17, 0.48, 0.0], [-0.08, 0.465, 0.03], [-0.026, 0.42, 0.024],
    [-0.034, 0.33, 0.03]], 0.006, 600, 0.0, 0.045);
  vein([[-0.026, -0.02, -0.02], [-0.024, 0.15, -0.02], [-0.03, 0.29, 0.02]], 0.008, 160, 0.28, 0.32);
  const sp = 0.22;
  const aorta = [[0.03, 0.31, 0.04], [0.015, 0.4, 0.035], [0.0, 0.43, 0.0], [0.016, 0.4, -0.04], [0.016, 0.25, -0.04],
    [0.01, 0.1, -0.022], [0.0, -0.01, -0.016]];
  const aLen = vessel(aorta, 0.009, 420, 0.09, 0.9, sp);
  for (const s of SIDES) {
    const kn = mir(J.knee, s), an = mir(J.ankle, s), el = mir(J.elbow, s), sh = mir(J.shoulder, s);
    // leg, neck and arm arteries
    vessel([[0.004 * s, -0.01, -0.016], [0.045 * s, -0.07, 0.01], [0.08 * s, -0.12, 0.04], [0.088 * s, -0.3, 0.02],
      v3.add(kn, [0, 0, -0.03]), v3.add(an, [0, 0.03, -0.005]), mir(J.toe, s)], 0.005, 520, 0.09 + aLen * sp, 0.75, sp);
    vessel([[0.008 * s, 0.43, 0.0], [0.025 * s, 0.55, 0.022], [0.03 * s, 0.66, 0.0], [0.03 * s, 0.72, -0.02]], 0.0042, 120,
      0.11, 0.8, sp);
    vessel([[0.01 * s, 0.43, 0.0], [0.09 * s, 0.48, 0.0], v3.add(sh, [0, 0.01, 0.01]), v3.add(el, [-0.012 * s, -0.01, 0.012]),
      v3.add(wrists[s], [0, -0.006, 0])], 0.0042, 380, 0.11, 0.75, sp);
    vessel([[0.01 * s, 0.11, -0.022], [0.06 * s, 0.1, -0.05]], 0.004, 40, 0.13, 0.7, sp);   // renal arteries
  }
  const NB = N;

  // ----------------------------------------------- the scan, as a MIP --
  // Each point glows in the hot-iron map; blending keeps the maximum (not the sum) of what lies along each ray,
  // which is exactly how PET scans are shown as maximum-intensity projections.
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P.slice(0, 3 * NB), 3));
  geo.setAttribute('aI', new THREE.BufferAttribute(AI.slice(0, NB), 1));
  geo.setAttribute('aU', new THREE.BufferAttribute(AU.slice(0, 2 * NB), 2));
  geo.setAttribute('aB', new THREE.BufferAttribute(AB.slice(0, 2 * NB), 2));
  geo.setAttribute('aSz', new THREE.BufferAttribute(AS.slice(0, NB), 1));
  geo.setAttribute('aK', new THREE.BufferAttribute(AK.slice(0, 3 * NB), 3));
  const scanMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime, uP: { value: 1 }, uS: { value: 0 }, uK: { value: 1 },
      uDim: { value: 1 } },
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    vertexShader: K.GLSL + `
attribute float aI, aSz; attribute vec2 aU, aB; attribute vec3 aK;
uniform float uA, uP, uS;
varying float vI, vSoft;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // steady uptake rises over the tissue's window (soft tissue shows faintly from the start); in disease some
  // organs take up less and tissue more; blood glows as the bolus passes, then settles
  float up = max(smoothstep(aU.x, aU.y, uP), aK.x * smoothstep(0.0, 0.05, uP));
  float I = (aI * (1.0 + aK.y * uS) + aK.z * uS) * up
    + aB.x * smoothstep(aB.y, aB.y + 0.04, uP) * (1.0 - smoothstep(aB.y + 0.06, aB.y + 0.38, uP));
  vI = I;
  // Fill rate: sprites are sized in local units, so up close (as in a headset) they would grow into huge
  // overlapping discs. Below 1.6 units they shrink with distance (down to half their size), and never
  // exceed about 1.4 degrees on screen.
  float sc = length(modelViewMatrix[0].xyz), dl = -mv.z / sc;
  gl_PointSize = min(pointPx(aSz * clamp(dl / 1.6, 0.5, 1.0), mv), 0.025 * uPx * projectionMatrix[1][1] / sc);
  // big sprites (seen up close) get a soft, peaked footprint, so they merge into a mottled glow, not discs
  vSoft = smoothstep(7.0, 15.0, gl_PointSize);
  if (I < 0.01 || uA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA, uK, uDim;
varying float vI, vSoft;
// hot iron: black, dark red, red, orange, yellow, white
// (each channel rises with intensity, so the max blend stays on the map)
vec3 hot(float x) {
  return vec3(pow(clamp(x * 2.0, 0.0, 1.0), 0.9), pow(clamp((x - 0.15) / 0.8, 0.0, 1.0), 1.5),
    clamp((x - 0.76) * 4.2, 0.0, 1.0) * 0.95);
}
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  // small sprites: a flat top and a soft edge, so overlapping points of similar intensity merge into smooth
  // regions; big ones (up close) fade from the middle, so they read as soft grains rather than flat discs
  float f = 1.0 - smoothstep(mix(0.45, 0.15, vSoft), 1.0, d);
  vec3 c = hot(vI * f * uK) * uA * uDim;
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
}`,
  });
  set.mats.push(scanMat);
  const scan = new THREE.Points(geo, scanMat);
  scan.frustumCulled = false;
  set.group.add(scan);

  // ------------------------------------------------------ organ network --
  // Each organ's node rises out of the organ (a thin tether stays) onto a cage around the body near the organ's
  // side and height, so all 12 stay apart and readable from any side; bands wind around the body between them.
  // Angles, heights and radii come from a search (tools/body_cage.cjs) that projects the label boxes from the
  // story's usual views (front half, both sides, back) so no label covers another or another node.
  // [key, label, organ position, angle around the body (degrees, 0 = front, +90 = the person's left),
  //  cage height, cage radius]
  const ORG = [
    ['brain', 'Brain', [0, 0.745, 0.0], 0, 0.8, 0.3], ['thyroid', 'Thyroid', [0, 0.548, 0.045], -36, 0.68, 0.42],
    ['lungs', 'Lungs', [-0.09, 0.375, -0.005], -60, 0.43, 0.42], ['heart', 'Heart', [0.045, 0.29, 0.06], 38, 0.55, 0.34],
    ['liver', 'Liver', [-0.085, 0.215, 0.025], -60, 0.34, 0.46], ['stomach', 'Stomach', [0.085, 0.2, 0.05], 110, 0.26, 0.4],
    ['spleen', 'Spleen', [0.12, 0.2, -0.056], 120, -0.08, 0.46], ['pancreas', 'Pancreas', [0.03, 0.14, -0.008], -10, 0.2, 0.46],
    ['kidneys', 'Kidneys', [-0.072, 0.098, -0.066], -129, -0.07, 0.46],
    ['intestine', 'Intestine', [-0.01, 0.02, 0.05], -39, -0.09, 0.46],
    ['marrow', 'Bone marrow', [0.09, -0.005, -0.045], 99, -0.42, 0.45], ['bladder', 'Bladder', [0, -0.112, 0.045], 2, -0.38, 0.46],
  ];
  const NO = ORG.length, oi = {};
  const cageAt = (th, y, r) => [r * Math.sin(th), y, r * Math.cos(th)];
  const CAGE = ORG.map(o => cageAt(o[3] * PI / 180, o[4], o[5]));
  ORG.forEach((o, i) => { oi[o[0]] = i; o[2][0] *= XS; });
  // links: [a, b, healthy strength, disease strength]
  // (illustrative, after slide 35: the disease network is sparser and rewired)
  const LINKS = [
    ['thyroid', 'heart', 0.85, 0], ['heart', 'lungs', 0.6, 0.25], ['thyroid', 'brain', 0.4, 0], ['brain', 'heart', 0.45, 0],
    ['liver', 'pancreas', 0.95, 0], ['stomach', 'pancreas', 0.55, 0], ['kidneys', 'intestine', 0.8, 0], ['kidneys', 'liver', 0.55, 0],
    ['thyroid', 'pancreas', 0.5, 0], ['heart', 'liver', 0.5, 0], ['marrow', 'spleen', 0.4, 0.75], ['kidneys', 'bladder', 0.7, 0.35],
    ['stomach', 'intestine', 0.5, 0], ['pancreas', 'marrow', 0.3, 0],
    ['pancreas', 'intestine', 0, 1.0], ['brain', 'marrow', 0, 0.5], ['spleen', 'kidneys', 0, 0.3], ['kidneys', 'marrow', 0, 0.65],
    ['liver', 'lungs', 0, 0.4],
  ].map(([a, b, h, d]) => [oi[a], oi[b], h, d]);
  // bands: glowing tubes that wind around the body (angle, height and radius interpolated, bulging outwards),
  // built with unit radius; the shader scales them by the link's strength in the current state
  const SEG = 40, RAD = 8, vpb = (SEG + 1) * (RAD + 1), NL = LINKS.length;
  const bp = new Float32Array(NL * vpb * 3), bc = new Float32Array(NL * vpb * 3), bn = new Float32Array(NL * vpb * 3);
  const bS = new Float32Array(NL * vpb), bE = new Float32Array(NL * vpb * 4), bIdx = [];
  LINKS.forEach(([a, b, h, d], e) => {
    const A = ORG[a], B = ORG[b], ta = A[3] * PI / 180;
    let dt = (B[3] - A[3]) * PI / 180;
    if (dt > PI) dt -= 2 * PI;
    if (dt < -PI) dt += 2 * PI;
    const bulge = 0.03 + 0.06 * Math.abs(dt) / PI + 0.08 * Math.abs(B[4] - A[4]);
    const at = u => cageAt(ta + dt * u, K.lerp(A[4], B[4], u), K.lerp(A[5], B[5], u) + bulge * Math.sin(PI * u));
    const seed = R();
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG, c = at(u), F = frame(v3.sub(at(Math.min(1, u + 0.01)), at(Math.max(0, u - 0.01))));
      for (let j = 0; j <= RAD; j++) {
        const th = j / RAD * 2 * PI, k = e * vpb + i * (RAD + 1) + j;
        const n = v3.add(v3.mul(F[1], Math.cos(th)), v3.mul(F[2], Math.sin(th)));
        bp.set(v3.add(c, n), 3 * k); bc.set(c, 3 * k); bn.set(n, 3 * k);
        bS[k] = u; bE.set([h, d, e / NL, seed], 4 * k);
      }
    }
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) {
      const k = e * vpb + i * (RAD + 1) + j;
      bIdx.push(k, k + RAD + 1, k + 1, k + 1, k + RAD + 1, k + RAD + 2);
    }
  });
  const bgeo = new THREE.BufferGeometry();
  bgeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  bgeo.setAttribute('aC', new THREE.BufferAttribute(bc, 3));
  bgeo.setAttribute('normal', new THREE.BufferAttribute(bn, 3));
  bgeo.setAttribute('aS', new THREE.BufferAttribute(bS, 1));
  bgeo.setAttribute('aE', new THREE.BufferAttribute(bE, 4));
  bgeo.setIndex(bIdx);
  const bandMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uNet: { value: 0 }, uState: { value: 0 } },
    // premultiplied additive (One, One): the fragment's brightness is exactly its alpha times its colour
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    vertexShader: `
attribute vec3 aC; attribute float aS; attribute vec4 aE;
uniform float uNet, uState, uTime;
varying float vS, vG, vW, vK, w; varying vec3 vN, vV, vCol;
void main() {
  w = mix(aE.x, aE.y, uState);
  // links that exist in only one state draw on (or retract) along their length as the state changes
  float ext = aE.x > 0.0 && aE.y > 0.0 ? 1.0
    : aE.x > 0.0 ? 1.0 - smoothstep(0.0, 0.85, uState) : smoothstep(0.15, 1.0, uState);
  vG = min(clamp((uNet - 0.42) * 2.7 - aE.z * 0.55, 0.0, 1.0), ext);
  vW = smoothstep(0.0, 0.12, w);
  float r = (0.0014 + 0.0105 * w * w) * vW;
  vec3 p = aC + (position - aC) * r;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz;
  vS = aS;
  // bright pulses travel along each band
  vK = pow(0.5 + 0.5 * cos(6.2832 * (aS * 2.0 - uTime * 0.3 + aE.w)), 12.0);
  vCol = mix(vec3(1.0, 0.95, 0.88), vec3(1.0, 0.7, 0.36), aE.x == 0.0 ? 0.75 * uState : 0.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `
uniform float uA;
varying float vS, vG, vW, vK, w; varying vec3 vN, vV, vCol;
void main() {
  if (vS > vG || vW < 0.01) discard;
  float f = abs(dot(normalize(vN), normalize(vV)));
  // bright along the axis, faint at the silhouette (a glowing tube); pulses, strength and the drawing front scale it
  float a = (0.06 + 0.42 * pow(f, 1.5)) * (0.75 + 0.9 * vK) * (0.5 + 0.5 * w) * vW * smoothstep(vG, vG - 0.03, vS) * uA;
  gl_FragColor = vec4(vCol * a, a);
}`,
  });
  set.mats.push(bandMat);
  const bands = new THREE.Mesh(bgeo, bandMat);
  bands.renderOrder = 2; bands.frustumCulled = false;
  set.group.add(bands);
  // nodes: a warm halo and a white-hot core per organ; tethers back to the organ
  const ng = K.pointsGeo(NO * 2);
  for (let i = 0; i < NO; i++) {
    ng.attributes.aCol.array.set([1, 0.5, 0.16], 6 * i);
    ng.attributes.aCol.array.set([1, 0.97, 0.9], 6 * i + 3);
  }
  const nodes = new THREE.Points(ng, K.points(set));
  nodes.renderOrder = 3; nodes.frustumCulled = false;
  set.group.add(nodes);
  const tg = K.linesGeo(NO);
  for (let i = 0; i < NO; i++) {
    tg.attributes.aCol.array.set([1, 0.62, 0.3, 1, 0.85, 0.65], 6 * i);
    tg.attributes.aA.array.set([0.25, 0.5], 2 * i);
  }
  const tethers = new THREE.LineSegments(tg, K.lines(set));
  tethers.renderOrder = 2; tethers.frustumCulled = false;
  set.group.add(tethers);
  // weighted degree of each organ in each state (node size)
  const deg = ORG.map(() => [0, 0]);
  for (const [a, b, h, d] of LINKS) { deg[a][0] += h; deg[b][0] += h; deg[a][1] += d; deg[b][1] += d; }
  // where node i is when the network is at net (the anchors follow it)
  const lift = (i, net) => K.prog(net, 0.02 * i, 0.2 + 0.02 * i);
  const nodePos = (i, net) => v3.lerp(ORG[i][2], CAGE[i], lift(i, net));
  let netNow = 0;

  // ------------------------------------------------------------- update --
  const sizeA = ng.attributes.aSize, alphaA = ng.attributes.aA, posA = ng.attributes.position;
  const tpos = tg.attributes.position, ta = tg.attributes.aA;
  function update(S, t) {
    const net = clamp(S.body_net, 0, 1), st = clamp(S.body_state, 0, 1), sn = K.smooth(net);
    netNow = net;
    scanMat.uniforms.uP.value = clamp(S.body_pet, 0, 1);
    scanMat.uniforms.uS.value = K.smooth(st);
    // the scan cools and dims to a ghost while the network is up
    scanMat.uniforms.uK.value = 1 - 0.42 * sn;
    scanMat.uniforms.uDim.value = (1 - 0.25 * sn) * (1 - clamp(S.body_blank || 0, 0, 1));
    bandMat.uniforms.uNet.value = net; bandMat.uniforms.uState.value = st;
    const on = net > 0.001;
    bands.visible = on; nodes.visible = on; tethers.visible = on;
    if (!on) return;
    for (let i = 0; i < NO; i++) {
      const pop = K.prog(net, 0.02 * i, 0.08 + 0.02 * i), w = K.lerp(deg[i][0], deg[i][1], st), p = nodePos(i, net);
      const beat = 1 + 0.07 * Math.sin(t * 2.2 + i * 1.7);
      posA.array.set(p, 6 * i); posA.array.set(p, 6 * i + 3);
      sizeA.array[2 * i] = (0.06 + 0.035 * Math.sqrt(w)) * pop * beat;
      sizeA.array[2 * i + 1] = (0.02 + 0.01 * Math.sqrt(w)) * pop;
      alphaA.array[2 * i] = 0.4 * (0.45 + 0.55 * Math.min(1, w)) * pop;
      alphaA.array[2 * i + 1] = (0.6 + 0.4 * Math.min(1, w)) * pop;
      tpos.array.set(ORG[i][2], 6 * i); tpos.array.set(p, 6 * i + 3);
      ta.array[2 * i] = 0.3 * pop; ta.array[2 * i + 1] = 0.55 * pop;
    }
    posA.needsUpdate = true; sizeA.needsUpdate = true; alphaA.needsUpdate = true; tpos.needsUpdate = true; ta.needsUpdate = true;
  }

  // ------------------------------------------------------------ exports --
  // organ anchors sit on the organ during the scan and follow the node once the network is up
  // injection: where the tracer goes in (right forearm); aorta: its arch above the heart (arteries light up from here)
  const anchors = { head: [0, 0.745, 0.04], feet: [0, -0.93, 0.05], injection: [INJ[0] * XS, INJ[1], INJ[2]], aorta: [0, 0.43, 0] };
  ORG.forEach((o, i) => { anchors[o[0]] = () => nodePos(i, netNow); });
  const labels = ORG.map(o => ({ text: [o[1], ''], at: o[0], cls: '', alpha: S => K.prog(S.body_net, 0.5, 0.8) }));
  return Object.assign(set, {
    params: { body_a: 1, body_pet: 1, body_net: 0, body_state: 0, body_blank: 0 },
    update,
    anchors,
    labels,
    organs: ORG.map(o => ({ key: o[0], name: o[1] })),
    // the cage with its labels is about 1.3 units wide: netTall frames it on a portrait screen (phone)
    cam: { default: [0, 4, 3.75, 0, 0, 0], front: [0, 4, 3.75, 0, 0, 0], side: [90, 4, 3.75, 0, 0, 0],
      net: [14, 6, 3.0, 0, 0.17, 0], netTall: [14, 6, 5.8, 0.1, 0.17, 0] },
    controls: [
      { key: 'view', label: 'View', options: [['scan', 'Scan'], ['net', 'Network']] },
      { key: 'state', label: 'State', options: [['healthy', 'Healthy'], ['disease', 'Disease']] },
      { key: 'tracer', label: 'Tracer', options: [['up', 'Taken up'], ['live', 'Arriving']] },
    ],
    // Arriving loops every 12 s: 7 s of arrival, a hold on the steady scan, then the scan blanks out while the
    // tracer clock rewinds (the engine eases the jump back, which would otherwise play the arrival backwards)
    explore(c) {
      const u = (c.t || 0) % 12, live = c.tracer === 'live';
      return {
        body_pet: live ? clamp((u - 1) / 7, 0, 1) : 1, body_blank: live && (u < 1 || u > 11.2) ? 1 : 0,
        body_net: c.view === 'net' ? 1 : 0, body_state: c.state === 'disease' ? 1 : 0,
      };
    },
  });
};

// From tissue to cells (slides 36-41; Rendeiro et al., Nature 2021; Abila et al., Nature Medicine 2026): an
// H&E-stained section of stomach wall built from about 18,600 cells, the network of neighbouring cells, multiplexed
// imaging (cells coloured by type) and tissue regions lifting off into a low-dimensional embedding.
// The section is a thin curved slab. Its colour comes from stain maps made at load: the extracellular matrix
// (collagen, muscle, lumens, fat) and a pre-averaged copy of the cells for far views. Every cell is a splat that
// lies on the slab (an ellipse that turns with it) with its own nucleus, so close views stay sharp.
SETS.tissue = function (K) {
  const { THREE, v3, smooth, clamp, prog } = K;
  const set = K.newSet('tissue');
  const R = K.rng(4036), rr = (a, b) => a + (b - a) * R(), PI = Math.PI;

  // ------------------------------------------------------------- the section
  // Strip coordinates: s along the section (0..L), d depth below the lumen surface. In its own plane the strip
  // follows a gentle arc (lumen side outside) and is tilted a little; both ends bend towards the viewer (z = BK x^2).
  const L = 2.1, TH = 0.008, BK = 0.1, RA = 2.7, TILT = -0.15;
  // stain maps cover s in [MS0, MS0 + MSL], d in [MD0, MD0 + MDL]: matrix MW x MH texels, cell averages CW x CH
  const MS0 = -0.03, MSL = 2.16, MD0 = -0.03, MDL = 0.66, MW = 1024, MH = 512, CW = 512, CH = 256;
  const TS = MSL / MW, TD = MDL / MH;
  // seeded smooth noise in [-1, 1]
  function noise1(seed) {
    const r = K.rng(seed), v = new Float32Array(256);
    for (let i = 0; i < 256; i++) v[i] = r() * 2 - 1;
    return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = v[i & 255]; return a + (v[(i + 1) & 255] - a) * u; };
  }
  function noise2(seed) {
    const r = K.rng(seed), v = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) v[i] = r() * 2 - 1;
    return (x, y) => {
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
      const a = v[(i & 63) | ((j & 63) << 6)], b = v[((i + 1) & 63) | ((j & 63) << 6)];
      const c = v[(i & 63) | (((j + 1) & 63) << 6)], e = v[((i + 1) & 63) | (((j + 1) & 63) << 6)];
      return a + (b - a) * u + (c - a) * w + (a - b - c + e) * u * w;
    };
  }
  const gs = (x, m, w) => Math.exp(-((x - m) / w) * ((x - m) / w));
  const nM = noise1(11), nS = noise1(12), nP = noise1(13), nT = noise1(14), nW = noise1(15);
  // layer boundaries at s: lumen surface, mucosa / submucosa (b1), submucosa / muscle (b2), inner / outer muscle (bm),
  // serosa; the cut ends are rounded
  function layers(s) {
    const top0 = 0.005 * nT(s * 7);
    const b1 = top0 + 0.158 + 0.012 * nM(s * 4) + 0.006 * nM(s * 13 + 40);
    const b2 = b1 + 0.12 + 0.09 * gs(s, 0.8, 0.55) + 0.03 * nS(s * 3) + 0.03 * gs(s, 1.9, 0.2);
    const bot0 = b2 + (0.17 + 0.08 * gs(s, 1.25, 0.6) + 0.03 * nP(s * 3.3)) * smooth((1.97 - s) / 0.3);
    const mid = (top0 + bot0) / 2, cl = 0.15, cr = 0.11;
    let e = 1;
    if (s < cl) e = Math.sqrt(Math.max(0, 1 - ((cl - s) / cl) ** 2));
    else if (s > L - cr) e = Math.sqrt(Math.max(0, 1 - ((s - L + cr) / cr) ** 2));
    return { top: mid - (mid - top0) * e, bot: mid + (bot0 - mid) * e, top0, b1, b2, bm: b2 + 0.42 * (bot0 - b2), e };
  }
  const cT = Math.cos(TILT), sT = Math.sin(TILT);
  let CX = 0, CY = 0, CZ = 0;
  function plane(s, d) {
    const a = (s - L / 2) / RA, q = RA - d, x = q * Math.sin(a), y = q * Math.cos(a) - RA;
    return [x * cT - y * sT - CX, x * sT + y * cT - CY];
  }
  const P3 = (s, d) => { const p = plane(s, d); return [p[0], p[1], BK * p[0] * p[0] - CZ]; };
  const nrm = x => v3.norm([-2 * BK * x, 0, 1]);
  // centre the section on the origin
  {
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (let k = 0; k <= 200; k++) {
      const s = L * k / 200, ly = layers(s);
      for (const d of [ly.top, ly.bot]) { const p = plane(s, d); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    }
    CX = (x0 + x1) / 2; CY = (y0 + y1) / 2;
    CZ = BK * ((x1 - x0) / 2) ** 2 / 2;
  }
  // gastric pits (foveolae) open on the surface; between them the surface rises in small rounded tips
  const pits = [];
  for (let s = 0.025; s < L - 0.02; s += 0.0145 + 0.006 * R()) pits.push(s);
  function notch(s) {
    let lo = 0, hi = pits.length - 1;
    if (s <= pits[0] || s >= pits[hi]) return 0;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pits[m] <= s) lo = m; else hi = m; }
    return 0.0075 * Math.pow(1 - Math.sin(PI * (s - pits[lo]) / (pits[hi] - pits[lo])), 3);
  }

  // ------------------------------------------------- the matrix (stain map)
  // one RGBA byte map, used as the texture as it is: R eosin (pink; 204 = 1), G empty space (lumens, fat, clefts),
  // B and A the fibre direction (doubled angle, 0.5 = 0) times its strength
  const MAT = new Uint8ClampedArray(MW * MH * 4), EB = 204;
  const ti = s => (s - MS0) / MSL * MW - 0.5, tj = d => (d - MD0) / MDL * MH - 0.5;
  const vAt = (s, d) => MAT[4 * (clamp(Math.round(ti(s)), 0, MW - 1) + MW * clamp(Math.round(tj(d)), 0, MH - 1)) + 1] / 255;
  const setV = (k, v) => { if (v * 255 > MAT[4 * k + 1]) MAT[4 * k + 1] = v * 255; };
  const nB = noise2(22);
  const fibreAng = (s, d) => 0.9 * nB(s * 9, d * 9);
  const LY = [];
  for (let i = 0; i < MW; i++) LY.push(layers(clamp(MS0 + (i + 0.5) * TS, 0, L)));
  // the collagen direction in the submucosa varies slowly: evaluate it every 4 texels and interpolate
  const FW = MW / 4 + 1, FH = MH / 4 + 1, FC = new Float32Array(FW * FH), FS = new Float32Array(FW * FH);
  function fibreField() {
    for (let i = 0; i < FW; i++) for (let j = 0; j < FH; j++) {
      const th = 2 * fibreAng(MS0 + 4 * i * TS, MD0 + 4 * j * TD);
      FC[i * FH + j] = Math.cos(th); FS[i * FH + j] = Math.sin(th);
    }
  }
  fibreField();
  // (hot loops live in small functions so the engine can optimise them)
  function fillColumn(i) {
    const s = MS0 + (i + 0.5) * TS, ly = LY[i], wav = 0.25 * nW(s * 9), top = ly.top, bot = ly.bot, mm = ly.b1 - 0.012, b1 = ly.b1, b2 = ly.b2, bm = ly.bm;
    const cw = 127.5 + 108 * Math.cos(2 * wav), sw = 127.5 + 108 * Math.sin(2 * wav), co = 127.5 + 108 * Math.cos(1.2 * wav), so = 127.5 + 108 * Math.sin(1.2 * wav);
    const fi = i / 4, i0 = Math.min(FW - 2, Math.floor(fi)), u = fi - i0;
    for (let j = 0; j < MH; j++) {
      let d = MD0 + (j + 0.5) * TD;
      if (d < top) d = top; else if (d > bot) d = bot;
      const k = 4 * (i + MW * j);
      if (d < mm) { MAT[k] = 0.4 * EB; MAT[k + 2] = 112; MAT[k + 3] = 128; }               // lamina propria between the glands
      else if (d < b1) { MAT[k] = 0.98 * EB; MAT[k + 2] = cw; MAT[k + 3] = sw; }           // muscularis mucosae
      else if (d < b2) {                                                                   // loose submucosa
        const fj = j / 4, j0 = Math.min(FH - 2, Math.floor(fj)), w = fj - j0, n0 = i0 * FH + j0, n1 = n0 + FH;
        const c = (FC[n0] * (1 - u) + FC[n1] * u) * (1 - w) + (FC[n0 + 1] * (1 - u) + FC[n1 + 1] * u) * w;
        const sn = (FS[n0] * (1 - u) + FS[n1] * u) * (1 - w) + (FS[n0 + 1] * (1 - u) + FS[n1 + 1] * u) * w;
        const l = 95 / (Math.sqrt(c * c + sn * sn) + 1e-6);
        MAT[k] = 0.36 * EB; MAT[k + 2] = 127.5 + c * l; MAT[k + 3] = 127.5 + sn * l;
      } else if (d < bm) { MAT[k] = 0.95 * EB; MAT[k + 2] = 102; MAT[k + 3] = 128; }      // inner muscle, fibres cut across
      else { MAT[k] = 0.97 * EB; MAT[k + 2] = co; MAT[k + 3] = so; }                       // outer muscle, fibres along the cut
    }
  }
  for (let i = 0; i < MW; i++) fillColumn(i);
  const layerAt = s => LY[clamp(Math.round(ti(s)), 0, MW - 1)];
  // paint an ellipse (centre s, d; semi-axes a, b; angle): fn(texel, rho) wherever rho (1 at the rim) < lim
  function paintEll(s, d, a, b, ang, lim, fn) {
    const ext = Math.max(a, b) * lim + 0.002, c = Math.cos(ang), sn = Math.sin(ang);
    const i0 = Math.max(0, Math.floor(ti(s - ext))), i1 = Math.min(MW - 1, Math.ceil(ti(s + ext)));
    const j0 = Math.max(0, Math.floor(tj(d - ext))), j1 = Math.min(MH - 1, Math.ceil(tj(d + ext)));
    for (let j = j0; j <= j1; j++) {
      const dd = MD0 + (j + 0.5) * TD - d;
      for (let i = i0; i <= i1; i++) {
        const ds = MS0 + (i + 0.5) * TS - s, u = (ds * c + dd * sn) / a, w = (dd * c - ds * sn) / b, rho = Math.sqrt(u * u + w * w);
        if (rho < lim) fn(i + MW * j, rho);
      }
    }
  }
  const SOFT = 0.0016;   // soft edges of painted shapes, in local units
  const voidEll = (s, d, a, b, ang, str = 1) => {
    const ew = SOFT / Math.min(a, b);
    paintEll(s, d, a, b, ang, 1 + ew, (k, rho) => setV(k, str * clamp((1 - rho) / ew + 0.5, 0, 1)));
  };
  // a vertical slit (a pit or gland lumen) from d0 to d1 around the axis sx(d), half-width hw(d)
  function voidSlit(sx, d0, d1, hw, str = 1) {
    for (let j = Math.max(0, Math.floor(tj(d0))); j <= Math.min(MH - 1, Math.ceil(tj(d1))); j++) {
      const d = MD0 + (j + 0.5) * TD, c = sx(d), w = hw(d), f = clamp((d - d0) / 0.002, 0, 1) * clamp((d1 - d) / 0.002, 0, 1);
      for (let i = Math.max(0, Math.floor(ti(c - w - 0.003))); i <= Math.min(MW - 1, Math.ceil(ti(c + w + 0.003))); i++) {
        setV(i + MW * j, str * f * clamp(0.5 - (Math.abs(MS0 + (i + 0.5) * TS - c) - w) / SOFT, 0, 1));
      }
    }
  }

  // ------------------------------------------------------------------ cells
  // cell: [s, d, angle, a, b, nucleus a, nucleus b, nucleus offset (along a, in units of a), cytoplasm rgb, alpha,
  //        nucleus rgb, type, foam]; types: 0 epithelial, 1 immune, 2 stromal, 3 endothelial, 4 smooth muscle, 5 red blood
  //        cell; foam (0..1): pale, bubbly cytoplasm, as in the mucus-filled gland cells
  const cells = [];
  const OG = 0.006, OW = Math.ceil(MSL / OG) + 2, OH = Math.ceil(MDL / OG) + 2;
  const occHead = new Int32Array(OW * OH).fill(-1), occNext = [];
  const oc = (s, d) => clamp(Math.floor((s - MS0) / OG), 0, OW - 1) + OW * clamp(Math.floor((d - MD0) / OG), 0, OH - 1);
  function free(s, d, rm) {
    const i0 = clamp(Math.floor((s - MS0) / OG), 1, OW - 2), j0 = clamp(Math.floor((d - MD0) / OG), 1, OH - 2);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      for (let k = occHead[i + OW * j]; k >= 0; k = occNext[k]) {
        const c = cells[k];
        if ((c[0] - s) ** 2 + (c[1] - d) ** 2 < rm * rm) return false;
      }
    }
    return true;
  }
  // Beer-Lambert stain colours: optical densities of haematoxylin (purple) and eosin (pink)
  // (haematoxylin OD 1.31, 1.37, 0.62; eosin OD 0.16, 1.05, 0.6, fitted to the slides)
  const he = (H, Eo) => [Math.exp(-(H * 1.31 + Eo * 0.16)), Math.exp(-(H * 1.37 + Eo * 1.05)), Math.exp(-(H * 0.62 + Eo * 0.6))];
  const inside = (s, d) => { if (s < 0.004 || s > L - 0.004) return false; const ly = layerAt(s); return d > ly.top + 0.0015 && d < ly.bot - 0.0015; };
  function addCell(s, d, ang, a, b, na, nb, no, cyt, ca, nuc, type, foam = 0) {
    if (!inside(s, d)) return null;
    const c = [s, d, ang, a, b, na, nb, no, cyt[0], cyt[1], cyt[2], ca, nuc[0], nuc[1], nuc[2], type, foam];
    const o = oc(s, d);
    occNext.push(occHead[o]); occHead[o] = cells.length; cells.push(c);
    return c;
  }
  // gland bodies: one splat per acinus drawn under its cells (its 'nucleus' is the white lumen); not a cell
  const fills = [];
  const addFill = (s, d, ang, a, b, na, nb, col) => { if (inside(s, d)) fills.push([s, d, ang, a, b, na, nb, 0, ...col, 0.9, 0.96, 0.94, 0.96, 6, 0]); };
  const vary = x => x * rr(0.88, 1.12);
  const NUC = () => he(vary(1.3), 0.35);
  // the kinds of cell, as they look in H&E
  const foveolar = (s, d, ang) => addCell(s, d, ang, 0.0035, 0.0019, 0.0012, 0.0008, 0.5, he(vary(0.36), vary(0.3)), 0.85, NUC(), 0, 0.5);
  const neck = (s, d, ang) => addCell(s, d, ang, 0.0032, 0.0021, 0.0011, 0.0009, 0.45, he(vary(0.5), vary(0.44)), 0.82, NUC(), 0, 0.7);
  const chief = (s, d, ang) => addCell(s, d, ang, 0.0033, 0.0025, 0.0012, 0.0011, 0.5, he(vary(0.58), vary(0.44)), 0.8, NUC(), 0, 1);
  const parietal = (s, d, ang) => addCell(s, d, ang, 0.0034, 0.003, 0.0011, 0.0011, 0.05, he(vary(0.08), vary(0.62)), 0.85, NUC(), 0);
  const smc = (s, d, ang, a = 0.0066, b = 0.0015) => addCell(s, d, ang, a, b, a * 0.42, 0.00075, rr(-0.25, 0.25), he(0.04, vary(0.85)), 0.8, NUC(), 4);
  const lympho = (s, d) => addCell(s, d, R() * PI, 0.0019, 0.0018, 0.00165, 0.0016, 0, he(0.3, 0.3), 0.7, he(vary(1.35), 0.35), 1);
  const plasma = (s, d) => addCell(s, d, R() * 2 * PI, 0.0025, 0.0019, 0.0013, 0.0013, 0.35, he(0.42, 0.3), 0.8, he(vary(1.25), 0.3), 1);
  const fibro = (s, d, ang) => addCell(s, d, ang, 0.0048, 0.0011, 0.0034, 0.0008, 0, he(0.04, 0.5), 0.35, he(vary(1.15), 0.3), 2);
  const endo = (s, d, ang) => addCell(s, d, ang, 0.0034, 0.0009, 0.0026, 0.0007, 0, he(0.05, 0.5), 0.6, he(vary(1.1), 0.3), 3);
  const rbc = (s, d) => addCell(s, d, 0, 0.0017, 0.0017, 0, 0, 0, [rr(0.82, 0.9), rr(0.2, 0.28), rr(0.22, 0.28)], 0.9, [0, 0, 0], 5);

  // a lymphoid aggregate at the base of the mucosa (glands give way to it)
  const AG = { s: 0.6, d: layerAt(0.6).b1 - 0.008, a: 0.046, b: 0.032 };
  const inAgg = (s, d, m = 0) => ((s - AG.s) / (AG.a + m)) ** 2 + ((d - AG.d) / (AG.b + m)) ** 2 < 1;
  // the packed lymphocytes push the muscularis mucosae and the collagen aside: loose, fibre-free matrix under it
  paintEll(AG.s, AG.d, AG.a, AG.b, 0, 1.1, (k, rho) => {
    const w = clamp((1.1 - rho) / 0.15, 0, 1);
    MAT[4 * k] += (0.4 * EB - MAT[4 * k]) * w; MAT[4 * k + 2] += (127.5 - MAT[4 * k + 2]) * w; MAT[4 * k + 3] += (127.5 - MAT[4 * k + 3]) * w;
  });
  // the zoom patch: deep glands above, the muscularis mucosae, loose tissue with an artery and a vein below
  const sZ = 1.27, dZ = layerAt(sZ).b1 + 0.004, DM = 1.3;   // DM: about the farthest any cell is from it

  // mucosa: pits lined by pale mucous cells, then straight gland necks with pink parietal cells, then the coiled
  // gland bases cut across as round acini of purple chief cells
  // an acinus: the coiled base of a gland cut across, a ring of chief cells (a few parietal cells) round a tiny lumen
  function acinus(cs, cd, ra, base) {
    if (cd + ra > base || inAgg(cs, cd, ra)) return;
    voidEll(cs, cd, 0.0011, 0.0011, 0, 0.9);
    addFill(cs, cd, 0, ra - 0.0006, (ra - 0.0006) * rr(0.9, 1), 0.0011, 0.0011, he(rr(0.48, 0.56), rr(0.4, 0.48)));
    const rc = ra - 0.0031, n = Math.round(2 * PI * rc / 0.0041), p0 = R() * 6.28;
    for (let k = 0; k < n; k++) {
      const t = p0 + 2 * PI * k / n, x = cs + Math.cos(t) * rc, y = cd + Math.sin(t) * rc;
      if (!free(x, y, 0.0031)) continue;
      if (R() < 0.1) parietal(x, y, t); else chief(x, y, t);
    }
  }
  // a straight stretch of gland (pit or neck) along ax(d) from d0 to d1: its body, with the lumen as a slit
  // (in short overlapping pieces, so it can bend)
  const tubeFill = (ax, d0, d1, b, lw, col) => {
    const n = Math.max(1, Math.round((d1 - d0) / 0.011)), h = (d1 - d0) / n;
    for (let q = 0; q < n; q++) {
      const da = d0 + q * h, db = da + h, a = Math.hypot(h, ax(db) - ax(da)) / 2 + 0.0028;
      addFill((ax(da) + ax(db)) / 2, (da + db) / 2, Math.atan2(h, ax(db) - ax(da)), a, b, a * 0.97, lw, col);
    }
  };
  function glands() {
    for (let k = 0; k < pits.length; k++) {
      const s0 = pits[k], ly = layerAt(s0);
      const top = ly.top0, base = ly.b1 - 0.013, M = base - top;
      const pd = top + M * rr(0.27, 0.36), nd = top + M * rr(0.55, 0.62), sl = rr(-0.06, 0.06);
      const am = rr(0.0008, 0.0022), fq = rr(60, 120), ph = R() * 6.28;
      const ax = d => s0 + sl * (d - top) + am * Math.sin((d - top) * fq + ph);
      const across = d => Math.atan2(-(sl + am * fq * Math.cos((d - top) * fq + ph)), 1);   // perpendicular to the gland
      const pw = d => 0.0008 + 0.0005 * clamp(1 - (d - top) / (pd - top), 0, 1);
      voidSlit(ax, top - 0.012, pd, pw, 0.85);
      tubeFill(ax, top, pd, 0.0076, 0.0009, he(rr(0.42, 0.52), rr(0.32, 0.4)));
      for (let d = top + 0.0025; d < pd; d += 0.0041) {
        const w = pw(d) + 0.0035, t = across(d);
        foveolar(ax(d) - w, d, t + PI); foveolar(ax(d) + w, d, t);
      }
      if (inAgg(s0, nd, 0.004)) continue;
      voidSlit(ax, pd, nd, () => 0.0006);
      tubeFill(ax, pd, nd, 0.0074, 0.0007, he(rr(0.46, 0.54), rr(0.42, 0.5)));
      for (let d = pd + 0.002; d < nd; d += 0.0042 + 0.0008 * R()) {
        const t = across(d);
        for (const sd of [-1, 1]) {
          if (inAgg(ax(d), d, 0.004)) continue;
          if (R() < 0.3) parietal(ax(d) + sd * 0.0043, d + rr(-0.001, 0.001), t + (sd > 0 ? 0 : PI));
          else neck(ax(d) + sd * 0.004, d, t + (sd > 0 ? 0 : PI));
        }
      }
      // gland bases: acini under this pit and, staggered, between it and the next
      for (let d = nd; d < base;) { const ra = rr(0.0074, 0.0096); acinus(ax(nd) + rr(-0.002, 0.002), d + ra, ra, base); d += 2 * ra * rr(0.9, 1); }
      if (k + 1 < pits.length) {
        const sm = (s0 + pits[k + 1]) / 2;
        for (let d = nd + rr(0.006, 0.01); d < base;) { const ra = rr(0.007, 0.009); if (R() < 0.55) acinus(sm + rr(-0.001, 0.001), d + ra, ra, base); d += 2 * ra * rr(1, 1.15); }
      }
    }
  }
  glands();
  function mucosaMuscle() {
    // muscularis mucosae: three rows of smooth muscle along the section
    for (let r = 0; r < 3; r++) {
      for (let s = 0.01 + r * 0.0045 + R() * 0.004; s < L; s += 0.0135 + R() * 0.002) {
        const ly = layerAt(s), d = ly.b1 - 0.0022 - r * 0.0034 + rr(-0.0006, 0.0006);
        if (inAgg(s, d)) continue;
        smc(s, d, 0.25 * nW(s * 9) + rr(-0.08, 0.08));
      }
    }
  }
  mucosaMuscle();

  // submucosa: vessels (artery, vein, lymphatic) with their wall cells and a pale shrinkage halo, red cells in some
  const vessels = [];
  const lyZ = layerAt(sZ);
  vessels.push({ s: sZ + 0.034, d: lyZ.b1 + 0.031, r: 0.0165, asp: 1.15, ang: 0.3, kind: 0 });
  vessels.push({ s: sZ - 0.05, d: lyZ.b1 + 0.044, r: 0.013, asp: 2.3, ang: -0.25, kind: 1 });
  function placeVessels() {
    for (let n = 0; n < 900 && vessels.length < 30; n++) {
      const s = rr(0.22, 1.92), ly = layerAt(s), r = rr(0.006, 0.012) + 0.012 * R() * R(), asp = rr(1, 2.6);
      const d = rr(ly.b1 + r + 0.012, ly.b2 - r - 0.01);
      if (!(d > ly.b1) || inAgg(s, d, 1.6 * r + 0.004) || vessels.some(v => Math.hypot(v.s - s, v.d - d) < v.r * 1.4 + r * 1.4 + 0.02)) continue;
      vessels.push({ s, d, r, asp, ang: rr(-0.6, 0.6), kind: R() < 0.4 ? 0 : R() < 0.8 ? 1 : 2 });
    }
  }
  placeVessels();
  const ellPt = (v, rho, t) => {   // a point on the vessel's ellipse scaled by rho, at parameter t
    const A = v.r * Math.sqrt(v.asp), B = v.r / Math.sqrt(v.asp), x = A * rho * Math.cos(t), y = B * rho * Math.sin(t);
    const c = Math.cos(v.ang), sn = Math.sin(v.ang);
    return [v.s + x * c - y * sn, v.d + x * sn + y * c, Math.atan2(-A * Math.sin(t) * sn + B * Math.cos(t) * c, -A * Math.sin(t) * c - B * Math.cos(t) * sn)];
  };
  function vesselParts(v) {
    const A = v.r * Math.sqrt(v.asp), B = v.r / Math.sqrt(v.asp), lr = [0.42, 0.72, 0.88][v.kind];
    // matrix: lumen empty, wall deep pink, a thin shrinkage gap around it
    paintEll(v.s, v.d, A, B, v.ang, 1 + 0.0042 / B, (k, rho) => {
      if (rho > 1) setV(k, 0.5 * clamp((rho - 1) / (0.001 / B), 0, 1) * clamp((1 + 0.0042 / B - rho) / (0.0016 / B), 0, 1));
      else MAT[4 * k] = Math.max(MAT[4 * k], 1.05 * EB * clamp((1 - rho) / (0.0008 / B), 0, 1));
    });
    voidEll(v.s, v.d, A * lr, B * lr, v.ang, 1);
    const per = rho => PI * (A + B) * rho;   // rough circumference
    // endothelium lines the lumen
    for (let n = Math.max(5, Math.round(per(lr) / 0.0062)), k = 0; k < n; k++) {
      const p = ellPt(v, lr + 0.0011 / B, 2 * PI * (k + R() * 0.3) / n);
      endo(p[0], p[1], p[2]);
    }
    // smooth muscle rings (several in arteries, one in veins, none in lymphatics)
    if (v.kind < 2) {
      for (let rho = lr + 0.0035 / B; rho < 1 - 0.0012 / B; rho += 0.0034 / B) {
        const n = Math.max(5, Math.round(per(rho) / 0.0092)), o = R();
        for (let k = 0; k < n; k++) { const p = ellPt(v, rho, 2 * PI * (k + o) / n); smc(p[0], p[1], p[2], 0.0045, 0.0015); }
        if (v.kind === 1) break;
      }
    }
    // red blood cells left in some lumens
    const fill = R() < 0.6 ? rr(0.05, 0.35) : 0, nr = Math.round(fill * PI * A * B * lr * lr / (PI * 0.0018 * 0.0018));
    for (let k = 0; k < nr; k++) {
      const t = R() * 2 * PI, rho = Math.sqrt(R()) * lr * 0.85, p = ellPt(v, rho, t);
      if (free(p[0], p[1], 0.0026)) rbc(p[0], p[1]);
    }
  }
  vessels.forEach(vesselParts);
  const nearVessel = (s, d, m) => vessels.some(v => Math.hypot(v.s - s, v.d - d) < v.r * Math.sqrt(v.asp) + m);
  function fat() {
    // fat: lobules of large empty adipocytes with thin pink walls
    const fatCells = [];
    for (const F of [{ s: 1.0, a: 0.075, b: 0.04 }, { s: 0.36, a: 0.05, b: 0.03 }]) {
      const ly = layerAt(F.s); F.d = (ly.b1 + ly.b2) / 2 + 0.01;
      for (let n = 0; n < 700; n++) {
        const s = F.s + rr(-1, 1) * F.a, d = F.d + rr(-1, 1) * F.b, r = rr(0.0052, 0.0075);
        if (((s - F.s) / F.a) ** 2 + ((d - F.d) / F.b) ** 2 > 1 || nearVessel(s, d, r + 0.004)) continue;
        if (fatCells.some(f => Math.hypot(f[0] - s, f[1] - d) < f[2] + r + 0.0011)) continue;
        fatCells.push([s, d, r]);
      }
    }
    for (const [s, d, r] of fatCells) {
      voidEll(s, d, r, r * rr(0.85, 1), R() * PI, 1);
      if (R() < 0.3) { const t = R() * 2 * PI; fibro(s + Math.cos(t) * (r + 0.0006), d + Math.sin(t) * (r + 0.0006), t + PI / 2); }
    }
  }
  fat();
  function holes() {
    // loose tissue: many small clefts and spaces between the collagen bundles
    for (let n = 0, made = 0; n < 4000 && made < 320; n++) {
      const s = rr(0.05, L - 0.05), ly = layerAt(s), a = 0.0025 + 0.016 * Math.pow(R(), 2.4), asp = rr(1.3, 3.5) + (R() < 0.15 ? 5 : 0);
      const d = rr(ly.b1 + 0.004, ly.b2 - 0.004);
      if (d - a / asp < ly.b1 + 0.003 || d + a / asp > ly.b2 - 0.002 || nearVessel(s, d, a + 0.006) || inAgg(s, d, a + 0.004)) continue;
      voidEll(s, d, a, a / asp, fibreAng(s, d) + rr(-0.3, 0.3), rr(0.75, 1));
      made++;
    }
  }
  holes();
  function tears() {
    // tears along the submucosa / muscle boundary
    for (let k = 0; k < 7; k++) {
      const s0 = rr(0.15, 1.7), len = rr(0.06, 0.22);
      for (let s = s0; s < s0 + len; s += TS) {
        const ly = layerAt(s), w = 0.0018 * Math.sin(PI * (s - s0) / len);
        for (let j = Math.floor(tj(ly.b2 - 0.004)); j <= Math.ceil(tj(ly.b2 + 0.004)); j++) {
          const i = Math.round(ti(s)), x = Math.abs(MD0 + (j + 0.5) * TD - ly.b2 - 0.001) - w;
          if (i >= 0 && i < MW && j >= 0 && j < MH) setV(i + MW * j, 0.9 * clamp(0.5 - x / SOFT, 0, 1));
        }
      }
    }
  }
  tears();
  // muscle: thin pale septa between the fascicles (polygons where the fibres are cut across, long streaks where
  // they run along the section) and a septum between the two layers
  const SG = 0.03, SA = 2.4, SGW = Math.ceil(L / SA / SG) + 2, SGH = Math.ceil(MDL / SG) + 1, SX = new Float32Array(SGW * SGH), SY = new Float32Array(SGW * SGH);
  for (let i = 0; i < SGW; i++) for (let j = 0; j < SGH; j++) { SX[i * SGH + j] = (i + 0.15 + 0.7 * R()) * SG; SY[i * SGH + j] = MD0 + (j + 0.15 + 0.7 * R()) * SG; }
  const nG = noise1(31), nG2 = noise1(32);
  function septaColumn(i) {
    const s = MS0 + (i + 0.5) * TS, ly = LY[i], s2 = s / SA, gi = Math.floor(s2 / SG);
    for (let j = Math.max(0, Math.floor(tj(ly.b2))); j < MH; j++) {
      const d = MD0 + (j + 0.5) * TD, k = i + MW * j;
      if (d > ly.bot + 0.003) break;
      if (d < ly.b2 - 0.003) continue;
      let x;
      if (d < ly.bm) {   // distance to the nearest Voronoi border of the fascicle seeds
        let d1 = 9, d2 = 9, k1 = -1, k2 = -1;
        const gj = Math.floor((d - MD0) / SG);
        for (let a = Math.max(0, gi - 1); a <= Math.min(SGW - 1, gi + 1); a++) {
          for (let b = Math.max(0, gj - 1); b <= Math.min(SGH - 1, gj + 1); b++) {
            const n = a * SGH + b, q = (SX[n] - s2) * (SX[n] - s2) + (SY[n] - d) * (SY[n] - d);
            if (q < d1) { d2 = d1; k2 = k1; d1 = q; k1 = n; } else if (q < d2) { d2 = q; k2 = n; }
          }
        }
        x = k2 >= 0 && (k1 * 7 + k2 * 13) % 5 > 1 ? (d2 - d1) / (2 * Math.hypot(SX[k2] - SX[k1], SY[k2] - SY[k1])) - 0.0005 : 1;
      } else {
        // clefts between bundles cut along: rows about 0.024 apart, each wandering on its own and broken into
        // staggered streaks that taper at their ends and vary in width (not unbroken parallel lines)
        const e = d - ly.bm + 0.012 * nG2(s * 6) + 0.004 * nG2(s * 23 + 9), r0 = Math.round(e / 0.024);
        x = 1;
        for (let rf = r0 - 1; rf <= r0 + 1; rf++) {
          const g = nG(s * 6.5 + 17 * rf), tp = clamp((g + 0.05) / 0.3, 0, 1);
          if (tp <= 0) continue;
          const c = rf * 0.024 + 0.0055 * nG2(s * 2.6 + 7.1 * rf + 3), hw = 0.0011 * (0.25 + 0.75 * (0.5 + 0.5 * nG(s * 17 + 5 * rf))) * tp;
          x = Math.min(x, Math.abs(e - c) - hw + (1 - tp) * 0.0016);
        }
      }
      x = Math.min(x, Math.abs(d - ly.bm) - 0.0012);
      const sv = clamp(0.5 - x / SOFT, 0, 1);
      if (sv > 0) { const inner = d < ly.bm; setV(k, (inner ? 0.3 : 0.75) * sv); MAT[4 * k] *= 1 - (inner ? 0.25 : 0.5) * sv; }
    }
  }
  for (let i = 0; i < MW; i++) septaColumn(i);
  function muscleCells() {
    // muscle cells: round profiles where cut across, long spindles where cut along
    for (let s = 0.004; s < L; s += 0.0056 * 0.866) {
      const ly = layerAt(s), off = (Math.round(s / (0.0056 * 0.866)) & 1) * 0.0028;
      for (let d = ly.b2 + 0.003 + off; d < ly.bm - 0.0015; d += 0.0056) {
        const x = s + rr(-0.0017, 0.0017), y = d + rr(-0.0017, 0.0017);
        if (R() < 0.25 || vAt(x, y) > 0.3) continue;
        // only some of the cut fibres show their nucleus
        const a = rr(0.0024, 0.0031), nu = R() < 0.55 ? rr(0.0008, 0.0011) : 0;
        addCell(x, y, R() * PI, a, a * rr(0.7, 1), nu, nu * rr(0.8, 1), 0, he(0.04, vary(0.95)), 0.4, NUC(), 4);
      }
    }
    for (let row = 0; row < 200; row++) {
      let any = false;
      for (let s = R() * 0.0165; s < L; s += 0.0165 + rr(-0.002, 0.002)) {
        const ly = layerAt(s), d = ly.bm + 0.0024 + row * 0.0042 + rr(-0.0005, 0.0005);
        if (d > ly.bot - 0.002) continue;
        any = true;
        if (vAt(s, d) > 0.3) continue;
        smc(s, d, 0.15 * nW(s * 9) + rr(-0.06, 0.06), 0.0072, 0.0016);
      }
      if (!any && row > 10) break;
    }
  }
  muscleCells();
  function fillers() {
    // the lymphoid aggregate: lymphocytes packed densely and irregularly (random positions, nuclei almost touching),
    // thinning out towards a lumpy edge
    const nAg = noise2(42);
    for (let n = 0; n < 4500; n++) {
      const x = AG.s + rr(-1.1, 1.1) * AG.a, y = AG.d + rr(-1.1, 1.1) * AG.b, u = (x - AG.s) / AG.a, w = (y - AG.d) / AG.b, h = Math.hypot(u, w);
      const rho = h / (1 + 0.16 * nAg(1.3 * u / (h + 1e-6) + 20, 1.3 * w / (h + 1e-6) + 20));
      if (rho < 1.06 && vAt(x, y) < 0.3 && free(x, y, 0.0029 + 0.0032 * smooth((rho - 0.62) / 0.44))) lympho(x, y);
    }
    // lamina propria: immune cells and a few fibroblasts between the glands
    for (let n = 0; n < 9000; n++) {
      const s = rr(0.02, L - 0.02), ly = layerAt(s), d = rr(ly.top0 + 0.004, ly.b1 - 0.013);
      if (vAt(s, d) > 0.3 || !free(s, d, 0.0036)) continue;
      const u = R();
      if (u < 0.62) lympho(s, d); else if (u < 0.82) plasma(s, d); else fibro(s, d, PI / 2 + rr(-0.4, 0.4));
    }
    // submucosa: spindle fibroblasts along the collagen, a few immune cells and capillaries
    for (let n = 0; n < 9000; n++) {
      const s = rr(0.02, L - 0.02), ly = layerAt(s), d = rr(ly.b1 + 0.002, ly.b2 - 0.002);
      if (vAt(s, d) > 0.25 || !free(s, d, 0.0085)) continue;
      const u = R();
      if (u < 0.84) fibro(s, d, fibreAng(s, d) + rr(-0.25, 0.25)); else if (u < 0.94) lympho(s, d); else endo(s, d, fibreAng(s, d));
    }
  }
  fillers();

  // --------------------------------------------------------- the stain maps
  const TYPE_COL = ['#ffd84a', '#ff5a4b', '#3ee08f', '#ff5ad9', '#4d94ff', '#ff5a4b', '#5a4c1a'].map(K.rgb);
  cells.unshift(...fills);   // gland bodies first, so their cells draw over them
  const TYPE_NAME = ['Epithelial', 'Immune', 'Stromal', 'Endothelial', 'Smooth muscle'];
  // the cells, pre-averaged for far views (premultiplied colour and coverage), in stain and in fluorescence
  const cHE = new Float32Array(CW * CH * 4), cMK = new Float32Array(CW * CH * 4), tArea = (MSL / CW) * (MDL / CH);
  const FOOT = [0.25, 0.5, 0.25];   // a 3x3 footprint, about the size of a cell
  function rasterCell(c) {
    const ac = PI * c[3] * c[4], an = PI * c[5] * c[6], wc = c[11] * (ac - an) / tArea, wn = 0.95 * an / tArea, tc = TYPE_COL[c[15]];
    const wm = c[15] === 5 ? 0 : (0.64 * (ac - an) + 0.27 * an) / tArea, i = Math.round((c[0] - MS0) / MSL * CW - 0.5), j = Math.round((c[1] - MD0) / MDL * CH - 0.5);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
      const k = 4 * (x + CW * y), wt = FOOT[dx + 1] * FOOT[dy + 1];
      cHE[k] += (c[8] * wc + c[12] * wn) * wt; cHE[k + 1] += (c[9] * wc + c[13] * wn) * wt; cHE[k + 2] += (c[10] * wc + c[14] * wn) * wt;
      cHE[k + 3] += (wc + wn) * wt;
      if (wm) { cMK[k] += tc[0] * wm * wt; cMK[k + 1] += tc[1] * wm * wt; cMK[k + 2] += tc[2] * wm * wt; cMK[k + 3] += (wc + wn) * wt; }
    }
  }
  for (const c of cells) rasterCell(c);
  function pack(f) {   // premultiplied colour and coverage, coverage capped at 1, to bytes
    const out = new Uint8Array(f.length);
    for (let k = 0; k < f.length; k += 4) {
      const n = f[k + 3] > 1 ? 255 / f[k + 3] : 255;
      out[k] = Math.min(255, f[k] * n); out[k + 1] = Math.min(255, f[k + 1] * n); out[k + 2] = Math.min(255, f[k + 2] * n); out[k + 3] = Math.min(255, f[k + 3] * n);
    }
    return out;
  }
  const dataTex = (arr, w, h) => {
    const t = new THREE.DataTexture(arr, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };
  const texM = dataTex(MAT, MW, MH), texHE = dataTex(pack(cHE), CW, CH), texMK = dataTex(pack(cMK), CW, CH);

  // --------------------------------------------------------------- the slab
  const NC = 840, NR = 12, NV = (NC + 1) * (NR + 1);
  const nVert = NV * 2 + (NC + 1) * 4, sPos = new Float32Array(nVert * 3), sUv = new Float32Array(nVert * 2), sWall = new Float32Array(nVert);
  const idx = new Uint32Array(NC * NR * 12 + NC * 12);
  let vi = 0, ii = 0;
  function put(s, d, side, w) {
    const a = (s - L / 2) / RA, q = RA - d, x0 = q * Math.sin(a), y0 = q * Math.cos(a) - RA;
    const x = x0 * cT - y0 * sT - CX, y = x0 * sT + y0 * cT - CY, nx = -2 * BK * x, nl = Math.sqrt(nx * nx + 1), o = side * TH / 2 / nl;
    sPos[3 * vi] = x + nx * o; sPos[3 * vi + 1] = y; sPos[3 * vi + 2] = BK * x * x - CZ + o;
    sUv[2 * vi] = (s - MS0) / MSL; sUv[2 * vi + 1] = (d - MD0) / MDL; sWall[vi] = w;
    return vi++;
  }
  const tri = (a, b, c) => { idx[ii++] = a; idx[ii++] = b; idx[ii++] = c; };
  function buildSlab() {
    const tops = new Float32Array(NC + 1), bots = new Float32Array(NC + 1);
    for (let c = 0; c <= NC; c++) { const s = L * c / NC, ly = layers(s); tops[c] = ly.top + notch(s) * ly.e ** 4; bots[c] = ly.bot; }
    for (const side of [1, -1]) for (let c = 0; c <= NC; c++) for (let r = 0; r <= NR; r++) put(L * c / NC, tops[c] + (bots[c] - tops[c]) * r / NR, side, 0);
    for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
      const a = c * (NR + 1) + r, b = a + NR + 1;
      tri(a, a + 1, b + 1); tri(a, b + 1, b);                             // front (faces +z)
      tri(NV + a, NV + b + 1, NV + a + 1); tri(NV + a, NV + b, NV + b + 1); // back
    }
    for (const r of [0, NR]) {   // the cut edges of the slab: lumen side and serosa side
      const base = vi;
      for (let c = 0; c <= NC; c++) { const s = L * c / NC, d = r ? bots[c] : tops[c]; put(s, d, 1, 1); put(s, d, -1, 1); }
      for (let c = 0; c < NC; c++) {
        const f0 = base + 2 * c, b0 = f0 + 1, f1 = f0 + 2, b1 = f0 + 3;
        if (r === 0) { tri(f0, f1, b1); tri(f0, b1, b0); } else { tri(f0, b1, f1); tri(f0, b0, b1); }
      }
    }
  }
  buildSlab();
  const slabGeo = new THREE.BufferGeometry();
  slabGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  slabGeo.setAttribute('uv', new THREE.BufferAttribute(sUv, 2));
  slabGeo.setAttribute('aWall', new THREE.BufferAttribute(sWall, 1));
  slabGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  slabGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.2);
  const slabU = { uA: set.uA, tM: { value: texM }, tC: { value: texHE }, tK: { value: texMK }, uMark: { value: 0 }, uCells: { value: 1 },
    uGhost: { value: 0 }, uSz: { value: new THREE.Vector2(MSL, MDL) }, uZ: { value: new THREE.Vector2(sZ - MS0, dZ - MD0) },
    uAg: { value: new THREE.Vector4(AG.s - MS0, AG.d - MD0, AG.a, AG.b) } };
  // premultiplied blending: opaque as a section, a faint glassy glow as a ghost (never a dark pane, also in AR)
  const slabMat = new THREE.ShaderMaterial({
    uniforms: slabU, transparent: true, extensions: { derivatives: true },
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `attribute float aWall; varying vec2 vUv; varying float vWall;
void main() { vUv = uv; vWall = aWall; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tM, tC, tK; uniform float uA, uMark, uCells, uGhost; uniform vec2 uSz, uZ; uniform vec4 uAg;
varying vec2 vUv; varying float vWall;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
// wavy fibres: noise stretched along three fixed directions, blended by the local fibre direction fv (doubled
// angle), so the pattern stays continuous wherever the direction turns
float fibres(vec2 p, vec2 fv, float fa, float fc) {
  float acc = 0.0, ws = 0.0;
  for (int k = 0; k < 3; k++) {
    float a = float(k) * 1.0472, w = dot(fv, vec2(cos(2.0 * a), sin(2.0 * a))) + 0.15;
    if (w <= 0.0) continue;
    vec2 d = vec2(cos(a), sin(a)), q = vec2(dot(p, d), dot(p, vec2(-d.y, d.x)));
    acc += w * vn(vec2(q.x * fa, q.y * fc + 2.5 * vn(q * fa * 1.7)));
    ws += w;
  }
  return acc / ws;
}
void main() {
  vec2 sd = vUv * uSz, fw = fwidth(sd);
  float px = max(max(fw.x, fw.y), 1e-6);                // local units per pixel
  vec4 m = texture2D(tM, vUv);
  float E = m.r * 1.25, V = m.g;
  vec2 fv = m.ba * 2.0 - 1.0; float fs = length(fv);
  E *= 0.9 + 0.2 * vn(sd * 26.0);                         // uneven staining
  // collagen bundles and muscle fibres, faded out where they would be finer than a pixel
  float kb = fs * smoothstep(0.5, 0.2, px * 420.0);
  if (kb > 0.01) {
    float b = fibres(sd, fv / max(fs, 1e-3), 40.0, 420.0);
    E *= 1.0 + kb * (b - 0.5) * 0.9;
    V = max(V, kb * smoothstep(0.34, 0.12, b) * smoothstep(0.8, 0.45, E));   // white gaps in loose tissue
  }
  float kg = smoothstep(0.6, 0.25, px * 1200.0);
  if (kg > 0.01) E *= 1.0 + kg * (vn(sd * 1200.0) - 0.5) * 0.3;
  // the edges of empty spaces sharpen as you come close
  float sw = clamp(px / 0.0016, 0.06, 0.5);
  V = smoothstep(0.5 - sw, 0.5 + sw, V);
  // the lymphoid aggregate: nuclei packed above and below the cut add a diffuse haematoxylin density
  float ag = smoothstep(1.05, 0.7, length((sd - uAg.xy) / uAg.zw) + 0.3 * (vn(sd * 150.0) - 0.5));
  vec3 he = exp(-E * vec3(0.16, 1.05, 0.60) - ag * 0.6 * vec3(1.31, 1.37, 0.62));
  he = mix(he, vec3(0.96, 0.94, 0.96), V);
  // far away the cells come from their pre-averaged map; close up they are drawn one by one
  float lod = smoothstep(1.0, 2.6, 0.005 / px);
  vec4 c = texture2D(tC, vUv) * (uCells * (1.0 - lod));
  he = he * (1.0 - c.a) + c.rgb;
  vec4 k = texture2D(tK, vUv) * (uCells * (1.0 - lod));
  vec3 fl = vec3(0.012, 0.016, 0.03) + vec3(0.02, 0.06, 0.05) * E * (1.0 - V) + vec3(0.05, 0.01, 0.008) * ag;   // faint stroma
  fl = fl * (1.0 - k.a) + k.rgb;
  float mk = smoothstep(0.0, 1.0, clamp((uMark * 1.4 - 0.7 * sqrt(min(length(sd - uZ) / ${DM.toFixed(2)}, 1.0)) - 0.15) / 0.4, 0.0, 1.0));
  vec3 col = mix(he, fl, mk) * mix(1.0, 0.62, vWall);
  // the ghost: mostly see-through, keeping a dim tint of its look and a faint cool sheen so its outline reads
  col = col * (1.0 - 0.75 * uGhost) + vec3(0.025, 0.04, 0.07) * uGhost * (1.0 + 2.0 * vWall);
  gl_FragColor = vec4(col * uA, uA * (1.0 - 0.85 * uGhost));
}`,
  });
  set.mats.push(slabMat);
  const slab = new THREE.Mesh(slabGeo, slabMat);
  set.group.add(slab);

  // ---------------------------------------------- regions and the embedding
  // 300 regions (patches of tissue); each is described by its mix of cell types (centred log-ratios), and a PCA
  // places it in 3D; loading arrows show where each cell type pulls
  const N = cells.length, PX = new Float32Array(N), PY = new Float32Array(N);
  function toPlane(i) {
    const c = cells[i], a = (c[0] - L / 2) / RA, q = RA - c[1], x = q * Math.sin(a), y = q * Math.cos(a) - RA;
    PX[i] = x * cT - y * sT - CX; PY[i] = x * sT + y * cT - CY;
  }
  for (let i = 0; i < N; i++) toPlane(i);
  const zp = plane(sZ, dZ);
  const typed = cells.map((c, i) => (c[15] < 5 ? i : -1)).filter(i => i >= 0);
  // regions: seeds spread like a Poisson disc over the section, each cell belongs to its nearest seed
  const RS = 0.043, G = 0.05, gx0 = -1.3, gy0 = -0.8, gw = Math.ceil(2.6 / G), gh = Math.ceil(1.6 / G), grid = Array.from({ length: gw * gh }, () => []);
  const gcell = (x, y) => clamp(Math.floor((x - gx0) / G), 0, gw - 1) + gw * clamp(Math.floor((y - gy0) / G), 0, gh - 1);
  const seedsR = [];
  function nearSeed(x, y, rad) {   // nearest seed within rad (grid rings), or -1
    const a = clamp(Math.floor((x - gx0) / G), 0, gw - 1), b = clamp(Math.floor((y - gy0) / G), 0, gh - 1), w = Math.ceil(rad / G);
    let best = -1, bd = rad * rad;
    for (let u = Math.max(0, a - w); u <= Math.min(gw - 1, a + w); u++) for (let v = Math.max(0, b - w); v <= Math.min(gh - 1, b + w); v++) {
      for (const r of grid[u + gw * v]) { const j = seedsR[r], q = (PX[j] - x) * (PX[j] - x) + (PY[j] - y) * (PY[j] - y); if (q < bd) { bd = q; best = r; } }
    }
    return best;
  }
  function seedRegions() {
    for (let n = 0; n < 20000 && seedsR.length < 300; n++) {
      const i = typed[Math.floor(R() * typed.length)];
      if (nearSeed(PX[i], PY[i], RS) < 0) { grid[gcell(PX[i], PY[i])].push(seedsR.length); seedsR.push(i); }
    }
  }
  seedRegions();
  const NRg = seedsR.length, region = new Int32Array(N).fill(-1), comp = Array.from({ length: NRg }, () => [0, 0, 0, 0, 0]);
  function assignRegions() {
    for (const i of typed) {
      let r = nearSeed(PX[i], PY[i], 0.07);
      if (r < 0) r = nearSeed(PX[i], PY[i], 0.4);
      region[i] = r; comp[r][cells[i][15]]++;
    }
  }
  assignRegions();
  const clr = comp.map(c => { const n = c.reduce((x, y) => x + y, 0), l = c.map(x => Math.log((x + 0.5) / (n + 2.5))), m = l.reduce((x, y) => x + y, 0) / 5; return l.map(x => x - m); });
  const mean = [0, 1, 2, 3, 4].map(t => clr.reduce((x, c) => x + c[t], 0) / NRg);
  const X = clr.map(c => c.map((x, t) => x - mean[t]));
  const C = [0, 1, 2, 3, 4].map(a => [0, 1, 2, 3, 4].map(b => X.reduce((x, r) => x + r[a] * r[b], 0) / (NRg - 1)));
  function eig(A) {   // Jacobi rotations for a small symmetric matrix: [values], [vectors]
    const n = A.length, a = A.map(r => r.slice()), v = a.map((r, i) => r.map((_, j) => +(i === j)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-16) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-14) continue;
        const t = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(t), s = Math.sin(t);
        for (let k = 0; k < n; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - s * y; v[k][q] = s * x + c * y; }
      }
    }
    const ord = a.map((r, i) => i).sort((i, j) => a[j][j] - a[i][i]);
    return [ord.map(i => a[i][i]), ord.map(i => { const e = v.map(r => r[i]), m = e.reduce((x, y) => (Math.abs(y) > Math.abs(x) ? y : x), 0); return e.map(x => x * Math.sign(m)); })];
  }
  const [lam, vec] = eig(C);
  // axis scales: each component a little closer to equal spread, so the cloud reads in 3D
  const ax = [0, 1, 2].map(k => Math.pow(Math.max(lam[k], 1e-6), -0.5) * Math.pow(Math.max(lam[k], 1e-6) / lam[0], 0.2));
  const Z = X.map(r => [0, 1, 2].map(k => r.reduce((x, y, t) => x + y * vec[k][t], 0) * ax[k]));
  const rad = Z.map(z => Math.hypot(z[0], z[1], z[2])).sort((a, b) => a - b)[Math.floor(NRg * 0.95)];
  const O = [0, 0.03, 0.6], ES = 0.45 / rad;
  // (plus a little scatter: real samples differ in more ways than their mix of five cell types)
  const regPos = Z.map(z => [O[0] + z[0] * ES + 0.045 * K.gauss(R), O[1] + z[1] * ES + 0.045 * K.gauss(R), O[2] + (z[2] * ES + 0.045 * K.gauss(R)) * 0.85]);
  const regType = comp.map(c => c.indexOf(Math.max(...c)));
  const regDelay = seedsR.map(i => Math.hypot(PX[i] - zp[0], PY[i] - zp[1]));
  const maxDel = Math.max(...regDelay);
  for (let r = 0; r < NRg; r++) regDelay[r] /= maxDel;
  const load = [0, 1, 2, 3, 4].map(t => [0, 1, 2].map(k => vec[k][t] * Math.sqrt(lam[k]) * ax[k] * (k === 2 ? 0.85 : 1)));
  const lmax = Math.max(...load.map(l => Math.hypot(...l)));
  const tips = load.map(l => { const n = Math.hypot(...l); return l.map(x => x / n * 0.52 * Math.pow(n / lmax, 0.35)); });

  // -------------------------------------------------------------- the cells
  const cGeo = new THREE.BufferGeometry();
  const aP = new Float32Array(N * 3), aDir = new Float32Array(N * 3), aShape = new Float32Array(N * 4), aCyt = new Float32Array(N * 4),
    aNuc = new Float32Array(N * 3), aInfo = new Float32Array(N * 4), aEmb = new Float32Array(N * 3);
  function cellAttrs(i) {
    const c = cells[i], x = PX[i], y = PY[i], r = region[i];
    // the cell's long axis in the plane: d/ds and d/dd of the strip mapping, turned by the tilt
    const a = (c[0] - L / 2) / RA, sa = Math.sin(a), ca = Math.cos(a), k = (RA - c[1]) / RA, cg = Math.cos(c[2]), sg = Math.sin(c[2]);
    const ux = cg * k * ca - sg * sa, uy = -cg * k * sa - sg * ca, dx = ux * cT - uy * sT, dy = ux * sT + uy * cT, dl = Math.hypot(dx, dy);
    aP[3 * i] = x; aP[3 * i + 1] = y; aP[3 * i + 2] = BK * x * x - CZ; aDir[3 * i] = dx / dl; aDir[3 * i + 1] = dy / dl;
    // when the cell switches to its fluorescence colour: outwards from the zoom patch, each cell on its own
    aDir[3 * i + 2] = 0.7 * Math.sqrt(Math.min(1, Math.hypot(x - zp[0], y - zp[1]) / DM)) + 0.3 * R();
    aShape[4 * i] = c[3]; aShape[4 * i + 1] = c[4]; aShape[4 * i + 2] = c[5] / c[3]; aShape[4 * i + 3] = c[6] / c[4];
    for (let q = 0; q < 4; q++) aCyt[4 * i + q] = c[8 + q];
    for (let q = 0; q < 3; q++) aNuc[3 * i + q] = c[12 + q];
    aInfo[4 * i] = c[7]; aInfo[4 * i + 1] = c[15] + 0.4 * c[16];   // (foam rides on the type: int(type + 0.5) still finds it)
    if (r >= 0) {
      const z = R() * 2 - 1, t = R() * 2 * PI, j = 0.012 * Math.cbrt(R()), w = Math.sqrt(1 - z * z) * j, p = regPos[r];
      aInfo[4 * i + 2] = regType[r]; aInfo[4 * i + 3] = 0.55 * regDelay[r] + 0.03 * R();
      aEmb[3 * i] = p[0] + w * Math.cos(t); aEmb[3 * i + 1] = p[1] + z * j; aEmb[3 * i + 2] = p[2] + w * Math.sin(t);
    } else { aInfo[4 * i + 2] = 5; aInfo[4 * i + 3] = 0.55 * Math.min(1, Math.hypot(x - zp[0], y - zp[1]) / maxDel); }   // (stays: fades as its patch lifts)
  }
  for (let i = 0; i < N; i++) cellAttrs(i);
  cGeo.setAttribute('position', new THREE.BufferAttribute(aP, 3));
  cGeo.setAttribute('aDir', new THREE.BufferAttribute(aDir, 3));
  cGeo.setAttribute('aShape', new THREE.BufferAttribute(aShape, 4));
  cGeo.setAttribute('aCyt', new THREE.BufferAttribute(aCyt, 4));
  cGeo.setAttribute('aNuc', new THREE.BufferAttribute(aNuc, 3));
  cGeo.setAttribute('aInfo', new THREE.BufferAttribute(aInfo, 4));
  cGeo.setAttribute('aEmb', new THREE.BufferAttribute(aEmb, 3));
  const common = { uBK: { value: BK }, uTH: { value: TH }, uMark: { value: 0 }, uEmbed: { value: 0 } };
  const cellMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime, uTC: { value: TYPE_COL.map(c => new THREE.Color(...c)) } }, common),
    transparent: true, depthWrite: false,
    vertexShader: K.GLSL + `
attribute vec3 aDir, aNuc, aEmb; attribute vec4 aShape, aCyt, aInfo;
uniform float uA, uMark, uEmbed, uBK, uTH; uniform vec3 uTC[7];
varying vec4 vM, vN; varying vec3 vCy, vNu, vFo; varying float vCa, vA, vPS, vMk;
void main() {
  int ty = int(aInfo.y + 0.5), rt = int(aInfo.z + 0.5);
  float foam = aInfo.y - float(ty);
  vec3 n = normalize(vec3(-2.0 * uBK * position.x, 0.0, 1.0));
  vec4 mv0 = modelViewMatrix * vec4(position, 1.0);
  // lie on whichever face of the slab the camera sees
  float side = dot(normalMatrix * n, -mv0.xyz) >= 0.0 ? 1.0 : -1.0;
  vec3 p0 = position + n * side * (uTH * 0.5 + 0.0012);
  // lift off into the embedding along a curve that rises a little from the slab and heads off sideways towards its
  // place at once (not straight out of the slab, where the close-up cameras are)
  float f = ty >= 5 ? 0.0 : smoothstep(0.0, 1.0, clamp((uEmbed - aInfo.w) / 0.42, 0.0, 1.0));
  vec3 pos = (1.0 - f) * (1.0 - f) * p0 + 2.0 * f * (1.0 - f) * (mix(position, aEmb, 0.35) + n * 0.1) + f * f * aEmb;
  // once lifted, each cell drifts gently round its place, so the cloud feels alive
  float ph = aDir.z * 41.0;
  pos += f * 0.005 * vec3(sin(uTime * 0.8 + ph), sin(uTime * 0.67 + 1.7 * ph), cos(uTime * 0.73 + 2.3 * ph));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float iz = 1.0 / max(-mv.z, 1e-4), k = uPx * projectionMatrix[1][1] * iz;
  // the cell's ellipse, projected: its two axes in pixels
  vec2 w = mv.xy * iz;
  vec3 d3 = normalize(vec3(aDir.xy, 2.0 * uBK * position.x * aDir.x));
  vec3 e1 = normalize(mat3(modelViewMatrix) * d3), e2 = normalize(mat3(modelViewMatrix) * cross(n, d3));
  vec2 A1 = (e1.xy + w * e1.z) * aShape.x * k, A2 = (e2.xy + w * e2.z) * aShape.y * k;
  // (a lifted cell is a small round spark: capped in size, so one passing near the eye never fills the view)
  float q = smoothstep(0.0, 0.35, f), rd = min(0.0042 * k, 9.0);
  A1 = mix(A1, vec2(rd, 0.0), q); A2 = mix(A2, vec2(0.0, rd), q);
  float det = A1.x * A2.y - A2.x * A1.y;
  vPS = 2.0 * max(length(vec2(A1.x, A2.x)), length(vec2(A1.y, A2.y))) + 2.0;
  gl_PointSize = vPS;
  vM = vec4(A2.y, -A2.x, -A1.y, A1.x) / (abs(det) < 1e-6 ? 1e-6 : det);
  vN = vec4(mix(max(aShape.zw, vec2(0.001)), vec2(0.001), q), aInfo.x, clamp(1.3 / max(min(length(A1), length(A2)), 0.01), 0.02, 1.0));
  // stain colours, then fluorescence by cell type (switching cell by cell), then the colour of the region once lifted
  float mk = smoothstep(0.0, 1.0, clamp((uMark * 1.4 - aDir.z) / 0.4, 0.0, 1.0));
  vec3 tc = uTC[ty];
  vCy = mix(mix(aCyt.rgb, tc, mk), uTC[rt] * 0.85, q);
  vNu = mix(aNuc, tc * 0.28, mk);
  vCa = mix(mix(aCyt.a, 0.92, mk), 1.0, q);
  vMk = mk * (1.0 - q);
  // (the foam only shows once its bubbles are a few pixels across: at low power the gland cells read deep purple)
  vFo = vec3(foam * (1.0 - mk) * (1.0 - q) * 2.5 * smoothstep(14.0, 34.0, vPS), aDir.z * 41.0, aDir.z * 73.0);
  float lod = mix(smoothstep(1.0, 2.6, 0.005 * k), 1.0, q);
  // red blood cells and gland bodies are not cells of the network: they stay behind (red cells carry no markers)
  vA = uA * lod * (ty >= 5 ? (1.0 - smoothstep(aInfo.w, aInfo.w + 0.12, uEmbed)) * (ty == 5 ? 1.0 - mk : 1.0) : 1.0);
  // a flat ellipse is a good stand-in only while the cell's depth range is small against its distance: close and
  // edge-on it would smear into a huge streak, so fade it there; also fade splats that grow huge, and cull very near
  float g = (abs(e1.z) * aShape.x + abs(e2.z) * aShape.y) * iz * (1.0 - q);
  vA *= (1.0 - smoothstep(0.08, 0.2, g)) * (1.0 - smoothstep(250.0, 400.0, vPS));
  if (-mv.z < 3.0 * aShape.x * (1.0 - q)) vA = 0.0;
  // in flight, cells fade out near the camera: the swarm never flies through the viewer's head
  vA *= mix(1.0, smoothstep(0.06, 0.22, -mv.z), smoothstep(0.0, 0.08, f));
  // a small depth bias towards the camera so splats never sink into the slab
  gl_Position = projectionMatrix * vec4(mv.xyz * (1.0 - (1.0 - q) * 0.004 * iz), 1.0);
  if (vA < 0.004 || abs(det) < 0.05) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec4 vM, vN; varying vec3 vCy, vNu, vFo; varying float vCa, vA, vPS, vMk;
void main() {
  vec2 q = (gl_PointCoord - 0.5) * vPS; q.y = -q.y;
  vec2 e = vec2(dot(vM.xy, q), dot(vM.zw, q));      // in the cell's own frame (unit circle = membrane)
  float r = length(e);
  if (r > 1.0) discard;
  float cm = smoothstep(1.0, 1.0 - vN.w, r);
  float rn = length(vec2((e.x - vN.z) / vN.x, e.y / vN.y));
  float nm = smoothstep(1.0, 1.0 - vN.w / min(vN.x, vN.y), rn);
  vec3 cy = mix(vCy * (1.0 - 0.18 * vCa * vCa * smoothstep(0.55, 1.0, r)), vCy * (0.42 + 0.8 * smoothstep(0.5, 0.95, r)), vMk);
  float ca = vCa;
  if (vFo.x > 0.01) {
    // mucus-filled gland cells: pale bubbles in a fine lilac mesh (slide 39); the mesh is where the two nearest of a
    // few jittered points are about equally near
    vec2 g = e * 2.3 + vFo.yz, b0 = floor(g - 0.5);
    float f1 = 9.0, f2 = 9.0;
    for (int u = 0; u < 2; u++) for (int v = 0; v < 2; v++) {
      vec2 c = b0 + vec2(float(u), float(v));
      float h = fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.55);
      float d = length(g - c - 0.5 - (vec2(h, fract(h * 7.31)) - 0.5) * 0.6);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    float b = smoothstep(0.04, 0.16, f2 - f1) * smoothstep(0.95, 0.72, r);
    cy = mix(cy, vec3(0.91, 0.87, 0.94), vFo.x * (0.3 + 0.4 * b));
    ca = mix(ca, 1.0, 0.4 * vFo.x * b);
  }
  gl_FragColor = vec4(mix(cy, vNu, nm), max(ca * cm, 0.95 * nm) * vA);
}`,
  });
  set.mats.push(cellMat);
  const cellPts = new THREE.Points(cGeo, cellMat);
  cellPts.frustumCulled = false; cellPts.renderOrder = 1;
  set.group.add(cellPts);

  // ------------------------------------------- the network of neighbouring cells
  // nuclei near the zoom patch joined into a Delaunay triangulation (as on slide 40, right across the glands), drawn
  // outwards from the centre. Candidates are each nucleus's nearest neighbours; an edge a-b passes the Delaunay test
  // when some circle through a and b holds no other nucleus nearby, which is when the largest angles it subtends on its
  // two sides add up to at most pi. The ring of cells round an acinus lies on one circle, so every chord across it
  // passes; the shortest that cross no edge already taken are kept, which triangulates the gland.
  // (the vertices are the nuclei, as on the slide: nucleus centres in strip coordinates, mapped onto the plane)
  const NX = new Float32Array(N), NY = new Float32Array(N);
  for (let i = 0; i < N; i++) { const c = cells[i], p = plane(c[0] + Math.cos(c[2]) * c[7] * c[3], c[1] + Math.sin(c[2]) * c[7] * c[3]); NX[i] = p[0]; NY[i] = p[1]; }
  const RG = 0.16, gN = typed.filter(i => (NX[i] - zp[0]) ** 2 + (NY[i] - zp[1]) ** 2 < RG * RG);
  function neighbourEdges(ids) {
    const n = ids.length, KN = 12, G = 0.028, x0 = zp[0] - RG - G, y0 = zp[1] - RG - G, gw2 = Math.ceil((2 * RG) / G) + 3;
    const head = new Int32Array(gw2 * gw2).fill(-1), next = new Int32Array(n), nb = new Int32Array(n * KN).fill(-1), nd = new Float32Array(KN);
    const X = new Float32Array(n), Y = new Float32Array(n), gx = new Int32Array(n), gy = new Int32Array(n);
    for (let a = 0; a < n; a++) {
      X[a] = NX[ids[a]]; Y[a] = NY[ids[a]]; gx[a] = Math.floor((X[a] - x0) / G); gy[a] = Math.floor((Y[a] - y0) / G);
      const c = gx[a] + gw2 * gy[a]; next[a] = head[c]; head[c] = a;
    }
    for (let a = 0; a < n; a++) {   // the KN nearest within G, by insertion
      nd.fill(G * G);
      for (let u = gx[a] - 1; u <= gx[a] + 1; u++) for (let v = gy[a] - 1; v <= gy[a] + 1; v++) {
        for (let b = head[u + gw2 * v]; b >= 0; b = next[b]) {
          if (b === a) continue;
          const q = (X[b] - X[a]) * (X[b] - X[a]) + (Y[b] - Y[a]) * (Y[b] - Y[a]);
          if (q >= nd[KN - 1]) continue;
          let m = KN - 1;
          while (m > 0 && nd[m - 1] > q) { nd[m] = nd[m - 1]; nb[a * KN + m] = nb[a * KN + m - 1]; m--; }
          nd[m] = q; nb[a * KN + m] = b;
        }
      }
    }
    // the Delaunay test over the nuclei both ends know: with alpha and beta the largest angles a-r-b on either side,
    // alpha + beta <= pi exactly when cot(alpha) + cot(beta) >= 0 (with a little slack for nearly round rings)
    function delaunayOk(a, b) {
      let kL = 1e9, kR = 1e9;   // the smallest cotangent (largest angle) on the left and on the right of a-b
      for (let h = 0; h < 2 * KN; h++) {
        const r = nb[(h < KN ? a : b) * KN + h % KN];
        if (r < 0 || r === a || r === b) continue;
        const ax = X[a] - X[r], ay = Y[a] - Y[r], bx = X[b] - X[r], by = Y[b] - Y[r], cr = ax * by - ay * bx, dt = ax * bx + ay * by;
        const ct = Math.abs(cr) > 1e-14 ? dt / Math.abs(cr) : dt > 0 ? 1e9 : -1e9;
        if (cr > 0) { if (ct < kL) kL = ct; } else if (ct < kR) kR = ct;
      }
      return kL + kR > -0.2;
    }
    const cA = [], cB = [], cL = [];
    for (let a = 0; a < n; a++) for (let m = 0; m < KN; m++) {
      const b = nb[a * KN + m];
      if (b < 0) continue;
      // each pair once: from the smaller index, or from the only side that lists the other
      let mutual = false;
      for (let q = 0; q < KN; q++) if (nb[b * KN + q] === a) mutual = true;
      if (mutual && b < a) continue;
      if (delaunayOk(a, b)) { cA.push(a); cB.push(b); cL.push(Math.sqrt((X[b] - X[a]) * (X[b] - X[a]) + (Y[b] - Y[a]) * (Y[b] - Y[a]))); }
    }
    // shortest first, skipping any edge that crosses one already kept: a planar triangulation
    const ord = cA.map((_, i) => i).sort((i, j) => cL[i] - cL[j]), MD = 24;
    const deg = new Int32Array(n), adj = new Int32Array(n * MD), out = [];
    const side = (p, q, r) => (X[q] - X[p]) * (Y[r] - Y[p]) - (Y[q] - Y[p]) * (X[r] - X[p]);
    function noCross(a, b, l) {
      // an edge that crosses a-b and is no longer has both ends within 1.5 l of its midpoint
      const mx = (X[a] + X[b]) / 2, my = (Y[a] + Y[b]) / 2, rq = 1.5 * l, r2 = rq * rq;
      const u0 = Math.max(0, Math.floor((mx - rq - x0) / G)), u1 = Math.min(gw2 - 1, Math.floor((mx + rq - x0) / G));
      const v0 = Math.max(0, Math.floor((my - rq - y0) / G)), v1 = Math.min(gw2 - 1, Math.floor((my + rq - y0) / G));
      for (let u = u0; u <= u1; u++) for (let v = v0; v <= v1; v++) {
        for (let c = head[u + gw2 * v]; c >= 0; c = next[c]) {
          if (c === a || c === b || (X[c] - mx) * (X[c] - mx) + (Y[c] - my) * (Y[c] - my) > r2) continue;
          const sc = side(a, b, c);
          for (let k = 0; k < deg[c]; k++) {
            const d = adj[c * MD + k];
            if (d === a || d === b) continue;
            if (sc * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return false;
          }
        }
      }
      return true;
    }
    for (const e of ord) {
      const a = cA[e], b = cB[e];
      if (deg[a] >= MD || deg[b] >= MD || !noCross(a, b, cL[e])) continue;
      adj[a * MD + deg[a]++] = b; adj[b * MD + deg[b]++] = a;
      out.push([ids[a], ids[b]]);
    }
    return out;
  }
  const edges = neighbourEdges(gN);
  const lGeo = K.linesGeo(edges.length);
  const lP = lGeo.attributes.position.array, lA = lGeo.attributes.aA.array, lT = lGeo.attributes.aT.array;
  let eLen = 0;
  edges.forEach(([i, j], k) => {
    const dm = Math.hypot((NX[i] + NX[j]) / 2 - zp[0], (NY[i] + NY[j]) / 2 - zp[1]) / RG;
    lP.set([NX[i], NY[i], BK * NX[i] * NX[i] - CZ, NX[j], NY[j], BK * NX[j] * NX[j] - CZ], 6 * k);
    eLen += Math.hypot(NX[i] - NX[j], NY[i] - NY[j]) / edges.length;
    lA[2 * k] = lA[2 * k + 1] = 1 - smooth((dm - 0.7) / 0.3); lT[2 * k] = lT[2 * k + 1] = dm;
  });
  const lineU = { uBK: common.uBK, uTH: common.uTH, uMark: common.uMark, uLA: { value: 0 } };
  const lineMat = K.lines(set, {
    additive: false, uniforms: lineU, head: 'uniform float uBK, uTH, uMark, uLA;',
    vertex: `vec3 nn = normalize(vec3(-2.0 * uBK * position.x, 0.0, 1.0));
  float sd = dot(normalMatrix * nn, -mv.xyz) >= 0.0 ? 1.0 : -1.0;
  mv = modelViewMatrix * vec4(position + nn * sd * (uTH * 0.5 + 0.0016), 1.0);
  gl_Position = projectionMatrix * vec4(mv.xyz * (1.0 - 0.003 / length(mv.xyz)), 1.0);
  float mk = smoothstep(0.0, 1.0, clamp((uMark * 1.4 - 0.7 * sqrt(aT * ${(RG / DM).toFixed(4)}) - 0.15) / 0.4, 0.0, 1.0));
  // faint pulses run outwards through the network, edge by edge
  float pu = pow(0.5 + 0.5 * cos(6.2832 * (aT * 1.6 - uTime * 0.22)), 14.0) * smoothstep(0.0, 0.15, aT);
  vC = mix(mix(vec3(0.1, 0.04, 0.15), vec3(0.85, 0.9, 1.0), mk), mix(vec3(0.3, 0.2, 0.75), vec3(0.45, 0.95, 1.0), mk), 0.7 * pu);
  vA *= uLA * mix(0.85, 0.5, mk) * (1.0 + 0.6 * pu * mk);
  // lines fade before they crowd together at a distance (an edge under a few pixels long), the cells carry the look
  vA *= smoothstep(2.0, 6.0, ${eLen.toFixed(4)} * uPx * projectionMatrix[1][1] / max(-mv.z, 1e-3));`,
  });
  const graph = new THREE.LineSegments(lGeo, lineMat);
  graph.frustumCulled = false; graph.renderOrder = 2;
  set.group.add(graph);

  // ------------------------------------------------ the embedding's furniture
  const glowGeo = K.pointsGeo(NRg), del = new Float32Array(NRg);
  for (let r = 0; r < NRg; r++) {
    glowGeo.attributes.position.array.set(regPos[r], 3 * r);
    glowGeo.attributes.aCol.array.set(TYPE_COL[regType[r]], 3 * r);
    glowGeo.attributes.aSize.array[r] = 0.035 + 0.02 * Math.sqrt(comp[r].reduce((x, y) => x + y, 0) / 120);
    glowGeo.attributes.aA.array[r] = 0.22;
    del[r] = 0.55 * regDelay[r] + 0.03;
  }
  glowGeo.setAttribute('aDel', new THREE.BufferAttribute(del, 1));
  const glowMat = K.points(set, { uniforms: { uEm: common.uEmbed }, head: 'attribute float aDel; uniform float uEm;',
    vertex: 'vA *= smoothstep(0.85, 1.0, (uEm - aDel) / 0.42) * (0.75 + 0.25 * sin(uTime * 1.3 + aDel * 47.0));' });   // once its cells have arrived; breathing
  const glow = new THREE.Points(glowGeo, glowMat);
  glow.frustumCulled = false; glow.renderOrder = 3;
  set.group.add(glow);
  // axes through the origin of the embedding
  const axGeo = K.linesGeo(3);
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((a, k) => {
    axGeo.attributes.position.array.set([...v3.add(O, v3.mul(a, -0.55)), ...v3.add(O, v3.mul(a, 0.55))], 6 * k);
    axGeo.attributes.aCol.array.set([0.55, 0.65, 0.8, 0.55, 0.65, 0.8], 6 * k);
    axGeo.attributes.aA.array.set([0.4, 0.4], 2 * k);
  });
  const axU = { uK: { value: 0 } };
  const axMat = K.lines(set, { uniforms: axU, head: 'uniform float uK;', vertex: 'vA *= uK;' });
  const axes = new THREE.LineSegments(axGeo, axMat);
  axes.frustumCulled = false;
  set.group.add(axes);
  // loading arrows, one per cell type
  const arrowParts = [];
  tips.forEach((tp, t) => {
    const l = Math.hypot(...tp), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...tp).normalize());
    const shaft = new THREE.CylinderGeometry(0.0032, 0.0032, l - 0.035, 8, 1, true).translate(0, (l - 0.035) / 2, 0);
    const head = new THREE.ConeGeometry(0.011, 0.035, 12, 1).translate(0, l - 0.0175, 0);
    for (const g of [shaft, head]) { g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); arrowParts.push(K.paint(g, TYPE_COL[t])); }
  });
  // (base just under 0.97: additive glow never writes depth, so it cannot hide other sets' see-through parts)
  const arrowMat = K.fade(set, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending }), 0.96);
  const arrows = new THREE.Mesh(K.merge(arrowParts), arrowMat);
  arrows.position.set(...O); arrows.renderOrder = 4;
  set.group.add(arrows);

  // ------------------------------------------------------- anchors and views
  const front = (s, d, o = 0.003) => { const p = P3(s, d), n = nrm(p[0]); return v3.add(p, v3.mul(n, TH / 2 + o)); };
  const lyA = layerAt(0.5), lyB = layerAt(0.95), lyC = layerAt(1.42);
  const bigV = vessels.slice(2).sort((a, b) => b.r - a.r)[0];
  const nearest = (t, ds, dd) => {
    let best = -1, bd = 1e9;
    for (let i = 0; i < N; i++) { if (cells[i][15] !== t) continue; const q = (cells[i][0] - sZ - ds) ** 2 + (cells[i][1] - dZ - dd) ** 2; if (q < bd) { bd = q; best = i; } }
    return front(cells[best][0], cells[best][1]);
  };
  const anchors = {
    mucosa: front(0.5, lyA.top0 + 0.06), submucosa: front(0.95, (lyB.b1 + lyB.b2) / 2), muscle: front(1.42, (lyC.b2 + lyC.bot) / 2),
    vessel: front(bigV.s, bigV.d), zoom: front(sZ, dZ, 0), embed: O.slice(),
    // (spread over the zoom view's corners, so the labels stay apart; the labels run to the right of their anchors)
    epi: nearest(0, -0.08, -0.043), imm: nearest(1, 0.045, -0.047), str: nearest(2, -0.085, 0.05), endo: nearest(3, 0.034, 0.027),
    smc: nearest(4, -0.02, -0.009),
  };
  tips.forEach((tp, t) => { anchors['load' + t] = v3.add(O, v3.mul(tp, 1.08)); });
  const zn = nrm(anchors.zoom[0]), azN = Math.atan2(zn[0], zn[2]) * 180 / PI, Zm = anchors.zoom;
  // The five cell-type labels only make sense while their cells are spread over the view (close to the zoom patch).
  // How far apart their anchors are on screen is measured at each render, in units of the view's tangent (so it
  // means the same in a headset), and the labels fade out before they would pile up in a wider view: in the story
  // as the camera pulls back, in explore while it flies in, and whenever someone zooms out.
  const LA = ['epi', 'imm', 'str', 'endo', 'smc'].map(k => anchors[k]), _m = new THREE.Matrix4();
  let near = 0;
  cellPts.onBeforeRender = (r, sc, cam) => {
    const e = _m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).multiply(cellPts.matrixWorld).elements, P = cam.projectionMatrix.elements;
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of LA) {
      const w = e[3] * p[0] + e[7] * p[1] + e[11] * p[2] + e[15];
      if (w < 1e-3) { near = 0; return; }
      const x = (e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12]) / (w * P[0]), y = (e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13]) / (w * P[5]);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    near = prog(Math.hypot(x1 - x0, y1 - y0), 0.2, 0.3);
  };
  const mkA = S => near * prog(S.tissue_mark, 0.5, 1) * (1 - prog(S.tissue_embed, 0, 0.04));
  const emA = S => prog(S.tissue_embed, 0.75, 1);
  const CLS = ['amb', '', 'grn', 'mag', 'cyn'];

  return Object.assign(set, {
    params: { tissue_a: 1, tissue_graph: 0, tissue_mark: 0, tissue_embed: 0 },
    update(S) {
      const mk = S.tissue_mark, em = S.tissue_embed, gr = S.tissue_graph;
      common.uMark.value = mk; common.uEmbed.value = em;
      slabU.uMark.value = mk;
      slabU.uCells.value = 1 - prog(em, 0.05, 0.6);
      slabU.uGhost.value = prog(em, 0, 0.7);
      // a see-through ghost must not hide what lies behind it
      slabMat.depthWrite = slabU.uGhost.value < 0.02 && S.tissue_a > 0.97;   // (nor while it fades with the set)
      lineMat.uniforms.uReveal.value = gr * 1.02;
      lineU.uLA.value = smooth(gr * 4) * (1 - prog(em, 0, 0.3));
      axU.uK.value = prog(em, 0.35, 0.85);
      const ga = prog(em, 0.5, 0.95);
      arrows.visible = ga > 0.01; arrows.scale.setScalar(Math.max(0.01, ga));
      // hidden parts are not drawn at all
      graph.visible = lineU.uLA.value > 0.003; glow.visible = em > 0.3; axes.visible = axU.uK.value > 0.003;
    },
    anchors,
    labels: [
      { text: ['Epithelial', 'gland cells'], at: 'epi', cls: CLS[0], alpha: mkA },
      { text: ['Immune', 'cells'], at: 'imm', cls: CLS[1], alpha: mkA },
      { text: ['Stromal', 'fibroblasts'], at: 'str', cls: CLS[2], alpha: mkA },
      { text: ['Endothelial', 'vessel lining'], at: 'endo', cls: CLS[3], alpha: mkA },
      { text: ['Smooth muscle', ''], at: 'smc', cls: CLS[4], alpha: mkA },
      ...TYPE_NAME.map((nm, t) => ({ text: [nm, ''], at: 'load' + t, cls: CLS[t], alpha: emA })),
    ],
    cam: {
      default: [0, 6, 3.2, 0, 0, 0], section: [0, 6, 3.2, 0, 0, 0],
      zoom: [azN, 3, 0.25, ...Zm], graph: [azN + 8, 5, 0.28, ...Zm], mark: [azN - 8, 5, 0.42, ...Zm],
      embed: [-18, 14, 2.4, ...O],
    },
    controls: [{ key: 'view', label: 'View', options: [['section', 'Tissue'], ['graph', 'Cell network'], ['mark', 'Markers'], ['embed', 'Embedding']] }],
    explore(c) {
      const v = c.view;
      // (the lift-off waits a moment, so the camera is already pulling back from the close-up when the cells fly)
      return { tissue_graph: v === 'graph' || v === 'mark' ? 1 : 0, tissue_mark: v === 'mark' || v === 'embed' ? 1 : 0, tissue_embed: v === 'embed' && !(c.t < 0.4) ? 1 : 0 };
    },
    // the stain maps live in uniforms, which K.dispose does not reach: free them here too
    textures: [texM, texHE, texMK],
    dispose() { K.dispose(set); texM.dispose(); texHE.dispose(); texMK.dispose(); },
    cellCount: typed.length, regionCount: NRg, types: TYPE_NAME.map((n, t) => ({ name: n, css: ['#ffd84a', '#ff5a4b', '#3ee08f', '#ff5ad9', '#4d94ff'][t] })),
  });
};


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
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [1.3, 1.2], [2.9, 2.4], [4.2, 3.6], [11.9, 8], [12.6, 8.6], [23.5, 13],  // Intro
  [33.4, 22], [34.7, 23.18], [36.3, 23.2], [62.5, 47], [66.3, 49],  // Parts
  [72.1, 54], [72.7, 54.6], [73.7, 55.2], [91.1, 71], [94.6, 73],  // Networks
  [100.7, 78], [102, 79.18], [103, 79.2], [103.6, 79.8], [108.1, 81], [133.4, 104], [138.2, 108],  // Life
  [145.6, 114], [146.2, 114.6], [147.5, 115.2], [156.1, 123], [166.4, 132], [189, 152.6],
  [193.8, 154],                                       // Complexes
  [202.6, 162], [203.9, 163.18], [204.9, 163.2], [219.6, 176.6], [221.8, 177], [236.1, 190],
  [238.1, 191], [257.9, 209], [265.2, 214],           // Map
  [274, 222], [274.7, 222.6], [275.7, 223.2], [284.3, 228], [293.1, 236], [300.5, 240],  // Disease
  [309.3, 248], [310, 248.6], [311.2, 249.2], [312.6, 250.4], [314.5, 251.6],  // Immunity
  [356.7, 290], [357.4, 290.6], [358.7, 291.2], [383.7, 314], [392.1, 318],  // Treatment
  [396.5, 322], [397.1, 322.6], [398.1, 323.2],       // Scales
  [434.2, 356], [434.8, 356.6], [436.4, 358], [437.1, 358.6], [442.5, 360], [445.7, 362],
  [449.6, 364],                                       // Institute
  [471.6, 384], [472.9, 385.2], [484.8, 394],         // Body
  [502.4, 410], [503, 410.6], [504.3, 411.2],         // Tissue
  [536, 440], [538, 441.8], [543.4, 443], [546.9, 445], [549.5, 447], [553.4, 449], [574.3, 468],  // Mission
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
      <p data-at="8">Each dot stands for a human protein, each line for a physical interaction between two of them. This illustrative map has ${fmt(I.nodeCount)} dots and ${fmt(I.edgeCount)} lines; real maps of the human interactome hold more than 13,000 proteins and 140,000 interactions.</p>
      <p class="note" data-at="13">The lights are groups of proteins that work together: the proteasome, growth-factor signalling, cell death and DNA repair.</p>`,
    whole: `<h2 data-at="0.6">More than the sum of its parts</h2>
      <p data-at="1.2">A computer is built from a few hundred parts: chips full of transistors, resistors, screws.</p>
      <div style="display:grid">
        <p data-at="7" data-out="15.5" style="grid-area:1/1">Take it apart and lay out every piece, and you have the complete parts list. It still does not tell you how the computer works.</p>
        <p data-at="16" class="amber" style="grid-area:1/1">What makes it work is how the parts are wired together.</p>
      </div>
      <p data-at="25">Parts joined by wires: a network. Life is built the same way.</p>
      <p class="credits" data-at="27">After Todd McLellan, Things Come Apart (2013), and the Apple I schematic (Apple Computer Company, 1976), designed by Steve Wozniak.</p>`,
    everywhere: `<h2 data-at="0.6">Networks are everywhere</h2>
      <p data-at="1.2">Once you look for the wiring, you find it everywhere. The internet is a network of computers and cables, held together by a few giant hubs.</p>
      <p data-at="11">Friendships form a network too. Each bright light is a city; most ties join nearby cities, a few cross oceans.</p>
      <p class="note" data-at="17">The first story in this app follows the world's airline network.</p>
      <p class="credits" data-at="19">Friendship map after Paul Butler, Facebook (December 2010). Bright city lights from the airports story; fainter lights and ties illustrative.</p>`,
    blocks: `<h2 data-at="0.6">The building blocks of life</h2>
      <p data-at="1.2">In 2001 a first draft of the human genome was published. One copy of our DNA holds</p>
      <div class="facts"><div data-at="3"><b>23</b><small>chromosomes</small></div><div data-at="5.5"><b>3 billion</b><small>letters (base pairs)</small></div><div data-at="9"><b>20,000</b><small>protein-coding genes</small></div></div>
      <p data-at="16">Each of these genes is the recipe for a protein. In 2021 AlphaFold predicted the shape of nearly every human protein.</p>
      <p data-at="26">Here are 25 of them. There are about 20,000 kinds, each with its own shape and job.</p>
      <p class="credits" data-at="30">International Human Genome Sequencing Consortium, Nature (2001, 2004); Jumper et al. and Tunyasuvunakool et al., Nature (2021). Shapes in the AlphaFold style, coloured by confidence; illustrative.</p>`,
    complex: `<h2 data-at="0.6">Putting the pieces together</h2>
      <p data-at="1.2">Proteins rarely work alone. Here are 13 of the proteins that build ATP synthase, the machine that makes most of the cell's energy currency, ATP.</p>
      <div style="display:grid">
        <p data-at="9" data-out="17.5" style="grid-area:1/1">Assembled, they form a rotary motor in the inner membrane of mitochondria. Two helpers, ATPAF1 and ATPAF2, keep the alpha and beta parts from clumping until they join the head, then leave.</p>
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
        <p class="note" data-at="29" data-out="41.5" style="grid-area:1/1">In yeast, map which genes depend on which, and the cell's jobs fall into districts.</p>
        <p class="note" data-at="47" style="grid-area:1/1">Diseases whose modules overlap, like multiple sclerosis and rheumatoid arthritis, tend to share symptoms and to occur together. Peroxisomal disorders lie far away.</p>
      </div>
      <p class="credits" data-at="52">Köberlin et al., Cell (2015); Jeong et al., Nature (2001); Costanzo et al., Science (2016); Menche et al., Science (2015). Disease modules illustrative.</p>`,
    rare: `<h2 data-at="0.6">Understand, diagnose, treat</h2>
      <p data-at="1.2">More than 6,000 rare diseases have a known genetic cause; about four in five rare diseases are genetic. Each is rare, but together they affect some 300 million people.</p>
      <p data-at="6">For every patient the same questions: which gene is broken? What does that do to the cell? How can we treat it?</p>
      <p data-at="14" class="amber">A broken gene sits in a neighbourhood of the interactome. Drugs act on neighbourhoods too: where the two overlap, a drug may help.</p>
      <p class="credits" data-at="18">Nguengang Wakap et al., European Journal of Human Genetics (2020). Disease and drug neighbourhoods illustrative.</p>`,
    iei: `<h2 data-at="0.6">Inborn errors of immunity</h2>
      <div class="facts"><div data-at="1.2"><b>430</b><small>rare diseases</small></div><div data-at="2.4"><b>1 in 1,000</b><small>to 1 in 5,000 people, all together</small></div><div data-at="3.6"><b>95%</b><small>of patients get non-specific treatment</small></div></div>
      <p data-at="6">Diagnosis is often missing or late, and the diseases are poorly understood.</p>
      <div style="display:grid">
        <p data-at="12" data-out="20" style="grid-area:1/1">On the interactome, the genes of those that mainly cause autoimmunity or autoinflammation fall into clusters. Each cluster is a shared mechanism: an endotype.</p>
        <p data-at="21" style="grid-area:1/1">The ${SANKEY_N[0]} clinical categories doctors use cut across their ${SANKEY_N[1]} molecular clusters. Endotypes define diseases by their mechanism.</p>
      </div>
      <p class="credits" data-at="34">Guthrie et al., Science Advances (2023): ${SANKEY_N[2]} genes of inborn errors with mainly autoimmunity or autoinflammation; flows between categories illustrative. Zhang et al. 2017; Picard et al. 2017; Bousfiha et al. 2018.</p>`,
    treat: `<h2 data-at="0.6">Better treatments, faster diagnoses</h2>
      <p data-at="1.2">Drugs already used for a cluster sit closer to it in the network than other drugs. That points to old drugs worth repurposing, and to new targeted ones.</p>
      <p data-at="12">Diagnosis: a patient's genome holds many rare variants. Let a signal spread through the network from genes that match the patient's symptoms, and it ranks the candidate genes.</p>
      <p data-at="24" class="amber">Here the broken gene comes out on top. In 139 patients with rare neurological disorders, informed network propagation ranked the right gene better than any single clue.</p>
      <p class="credits" data-at="28">Guthrie et al., Science Advances (2023); Buphamalai et al., Nature Communications (2021). Patient illustrative.</p>`,
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
      <p data-at="1.2">A total-body PET scan follows a tracer sugar through every organ at once. The brain takes up the most, and often the heart; the kidneys and bladder glow because the tracer leaves the body in the urine.</p>
      <p data-at="10">Organs that rise and fall together form a network of organs.</p>
      <p data-at="17" class="amber">Disease rewires it.</p>
      <p class="credits" data-at="21">Reed et al., NeuroImage (2023); Geist et al., Med (2025). Organ network illustrative.</p>`,
    tissue: `<h2 data-at="0.6">From tissue to cells</h2>
      <p data-at="1.2">A slice of stomach wall, stained pink and purple: glands at the surface, loose tissue with blood vessels, muscle below.</p>
      <p data-at="9">Zoom in and it is made of cells. Join each cell to its neighbours, and the tissue becomes a network.</p>
      <p data-at="16">Imaging dozens of proteins at once tells the cell types apart, and every sample becomes a point we can compare with the others.</p>
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
    wp.push([t, ...v, ease, k]);
  };
  let a, b;
  // Intro: the interactome grows, pathways light up one after another
  a = C.title.a; b = C.title.b;
  show('int', 0.2, 2.5, b - 1.5, b + 0.5);
  ramp('int_reveal', 0.5, 7, 0, 1);
  [[5, 7], [3, 10], [8, 13], [1, 16]].forEach(([m, t]) => ramp('int_path' + m, t, t + 1.5, 0, 1));
  [5, 3, 8, 1].forEach(m => ramp('int_path' + m, b - 1, b + 0.5, 1, 0));
  cam(a, 'int', 'paths', -35, null, [0, 0, 0.5]);
  cam(b - 1, 'int', 'paths', 40, 'spin');
  // Parts: the computer comes apart, its circuit is wired, a network remains
  a = C.whole.a; b = C.whole.b;
  show('mac', a - 0.5, a + 2, b - 1.5, b + 0.5);
  ramp('mac_explode', a + 7, a + 12.5, 0, 1);
  ramp('mac_wire', a + 16, a + 23, 0, 1);
  ramp('mac_net', a + 25, a + 29.5, 0, 1);
  cam(a + 1.5, 'mac', 'default', -25);
  cam(a + 7, 'mac', 'default', 5, 'spin');
  cam(a + 13, 'mac', 'table', -10);
  cam(a + 16, 'mac', 'table', -5, 'spin');
  cam(a + 22, 'mac', 'wiring', 5);
  cam(a + 25, 'mac', 'wiring', 10, 'spin');
  cam(a + 30, 'mac', 'network', 0);
  cam(b - 1, 'mac', 'network', 25, 'spin');
  // Networks are everywhere: the internet, then friendships around the world
  a = C.everywhere.a; b = C.everywhere.b;
  show('web', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('web_net', a + 0.5, a + 8, 0, 1); ramp('web_net', a + 9.5, a + 12, 1, 0);
  ramp('web_globe', a + 10, a + 12.5, 0, 1); ramp('web_ties', a + 12, a + 20, 0, 1);
  ramp('web_spin', a + 10, b + 1, 0, 0.12);
  cam(a + 1, 'web', 'net', -30);
  cam(a + 10, 'web', 'net', 30, 'spin');
  cam(a + 12.5, 'web', 'globe', -10);
  cam(b - 1, 'web', 'globe', 10, 'spin');
  // Building blocks: DNA, chromosomes, protein shapes, all the proteins
  a = C.blocks.a; b = C.blocks.b;
  show('dna', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('dna_helix', a, a + 3, 0, 1);
  ramp('dna_chrom', a + 8, a + 13, 0, 1);
  ramp('dna_fold', a + 16, a + 21, 0, 1);
  ramp('dna_field', a + 25, a + 32, 0, 1);
  cam(a + 1, 'dna', 'helix', -15);
  cam(a + 8, 'dna', 'helix', 15, 'spin');
  cam(a + 13, 'dna', 'chrom');
  cam(a + 16, 'dna', 'chrom', 8, 'spin');
  cam(a + 21, 'dna', 'fold');
  cam(a + 25, 'dna', 'fold', 10, 'spin');
  cam(a + 32, 'dna', 'field');
  cam(b - 1, 'dna', 'field', 15, 'spin');
  // Complexes: the parts of ATP synthase, assembled, running, as a network, inside the interactome
  a = C.complex.a; b = C.complex.b;
  show('atp', a - 0.5, a + 1.5, a + 39, a + 41.5);
  ramp('atp_parts', a, a + 2, 0, 1);
  ramp('atp_colour', a + 5, a + 7, 0, 1);
  ramp('atp_build', a + 9, a + 16.5, 0, 1);
  ramp('atp_flow', a + 18, a + 20, 0, 1); ramp('atp_flow', a + 29, a + 31, 1, 0);
  key('atp_turns', a + 18, 0); key('atp_turns', a + 30, 4.5);
  ramp('atp_net', a + 30, a + 33, 0, 1);
  ramp('atp_shrink', a + 36, a + 40, 0, 1);
  show('int', a + 38, a + 41);
  key('int_atp', a + 36.9, 0); key('int_atp', a + 37, 1);
  cam(a + 1, 'atp', 'parts', 0, null, [0, 0, 0.4, -0.05]);
  cam(a + 7, 'atp', 'parts', 10, 'spin', [0, 0, 0.4, -0.05]);
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
  cam(a + 9, 'int', 'city');
  cam(a + 27, 'int', 'city', 15, 'spin');
  cam(a + 41, 'int', 'city', 30, 'spin');
  cam(b - 1.5, 'int', 'city', 50, 'spin');
  // reset the map while the interactome is hidden
  for (const n of ['int_flat', 'int_build', 'int_pins', 'int_route', 'int_dis']) ramp(n, b + 0.6, b + 1.2, 1, 0);
  // Rare diseases: one patient among many, a disease neighbourhood and a drug's
  a = C.rare.a; b = C.rare.b;
  show('crowd', a - 0.5, a + 1.5, a + 11, a + 13);
  ramp('crowd_red', a + 3, a + 5, 0, 1);
  ramp('crowd_grow', a + 5, a + 10, 0, 1);
  ramp('int_a', a + 11.5, a + 13.5, 0, 1);
  ramp('int_rare', a + 13, a + 17, 0, 1);
  cam(a + 1.5, 'crowd', 'default');
  cam(a + 5, 'crowd', 'close');
  cam(a + 11, 'crowd', 'default', 0, null, [0, 8, 1.5]);
  cam(a + 13.5, 'int', 'rare', -20);
  cam(b - 4, 'int', 'rare', -40, 'spin');
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
  cam(a + 5, 'int', 'iei', -15);
  cam(a + 20, 'int', 'iei', 25, 'spin');
  // the diagram is wide: a little further back, and on wide screens shifted clear of the side panel
  cam(a + 21.5, 'sankey', 'default', -12, null, [0, 0, 1.0, GL.wide ? -0.45 : 0]);
  cam(b - 1.5, 'sankey', 'default', 12, 'spin', [0, 0, 1.0, GL.wide ? -0.45 : 0]);
  // Treatments and diagnosis: drugs dock on clusters, a signal spreads from the patient's genes
  a = C.treat.a; b = C.treat.b;
  ramp('int_a', a - 1, a + 1, 0, 1);
  ramp('int_drugs', a + 2, a + 10, 0, 1); ramp('int_drugs', a + 11, a + 13, 1, 0);
  ramp('int_iei', a + 12, a + 14, 1, 0);
  ramp('int_heat', a + 11, a + 21, 0, 1);
  ramp('int_cand', a + 20, a + 24, 0, 1);
  ramp('int_a', b - 1.5, b + 0.5, 1, 0);
  for (const n of ['int_heat', 'int_cand']) ramp(n, b + 0.6, b + 1.2, 1, 0);
  cam(a + 1, 'int', 'iei', 25);
  cam(a + 11, 'int', 'iei', 5, 'spin');
  cam(a + 14, 'int', 'heat', -15);
  cam(b - 1.5, 'int', 'heat', 20, 'spin');
  // Scales: the tower of length scales, time, networks, medicine
  a = C.scales.a; b = C.scales.b;
  show('scale', a - 0.5, a + 1.5);
  ramp('scale_len', a, a + 9, 0, 1);
  ramp('scale_time', a + 9, a + 15, 0, 1);
  ramp('scale_net', a + 15, a + 22, 0, 1);
  ramp('scale_med', a + 24, a + 29, 0, 1);
  cam(a + 1, 'scale', 'low', -20);
  cam(a + 9, 'scale', 'time', 2);
  cam(a + 15, 'scale', 'tower', 20);
  cam(b, 'scale', 'tower', 50, 'spin');
  // The institute: four research groups across the scales, and the links between them
  a = C.lbi.a; b = C.lbi.b;
  ramp('scale_time', a, a + 2, 1, 0); ramp('scale_med', a, a + 2, 1, 0); ramp('scale_net', a, a + 2, 1, 0);
  ramp('scale_rg', a + 2, a + 10, 0, 1);
  ramp('scale_syn', a + 13, a + 21, 0, 1);
  ramp('scale_a', b - 1.5, b + 0.5, 1, 0);
  for (const n of ['scale_len', 'scale_rg', 'scale_syn']) ramp(n, b + 0.6, b + 1.2, 1, 0);
  cam(a + 1, 'scale', 'tower', 60, null, [0, 0, 0.9]);
  cam(b - 1.5, 'scale', 'tower', 110, 'spin', [0, 0, 0.9]);
  // The whole body: a PET scan and the network of organs
  a = C.body.a; b = C.body.b;
  show('body', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('body_pet', a + 0.5, a + 6, 0, 1);
  ramp('body_net', a + 10, a + 13, 0, 1);
  ramp('body_state', a + 17, a + 20, 0, 1);
  cam(a + 1, 'body', 'front', -25, null, [0, 0, 0.35]);
  cam(a + 10, 'body', 'front', 25, 'spin', [0, 0, 0.35]);
  cam(a + 12, 'body', 'net', -10, null, [0, 0, 0.2]);
  cam(b - 1.5, 'body', 'net', 20, 'spin', [0, 0, 0.2]);
  // Tissue: a stained section, cells, a network of neighbours, many markers, an embedding
  a = C.tissue.a; b = C.tissue.b;
  show('tissue', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('tissue_graph', a + 11, a + 16, 0, 1);
  ramp('tissue_mark', a + 16, a + 19, 0, 1);
  ramp('tissue_embed', a + 22, a + 26.5, 0, 1);
  // the section is long: further back, and on wide screens shifted clear of the side panel
  cam(a + 1, 'tissue', 'section', -10, null, [0, 0, 0.8, GL.wide ? -0.2 : 0]);
  cam(a + 5, 'tissue', 'section', 10, 'spin', [0, 0, 0.8, GL.wide ? -0.2 : 0]);
  cam(a + 10, 'tissue', 'zoom');
  cam(a + 16, 'tissue', 'zoom', 8, 'spin');
  cam(a + 19, 'tissue', 'mark');
  cam(a + 22, 'tissue', 'mark', 10, 'spin');
  cam(a + 24.5, 'tissue', 'embed', -10);
  cam(b - 1.5, 'tissue', 'embed', 10, 'spin');
  // Mission: the team, then the interactome with every pathway alight
  a = C.mission.a; b = C.mission.b;
  ramp('scale_team', a - 0.5, a + 3, 0, 1);
  show('scale', a - 0.5, a + 1.5, a + 12, a + 14);
  show('int', a + 12.5, a + 14.5);
  for (let m = 0; m < 10; m++) ramp('int_path' + m, a + 14 + 0.6 * m, a + 15.5 + 0.6 * m, 0, 1);
  cam(a + 1, 'scale', 'team', -20);
  cam(a + 12.5, 'scale', 'team', 30, 'spin');
  cam(a + 14.5, 'int', 'paths', 0, null, [0, 0, 0.6]);
  cam(b, 'int', 'paths', 120, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  label('web', 'hub', '<b>A hub</b>of the internet', C.everywhere.a + 4, C.everywhere.a + 9.5, 'amb');
  label('int', 'atp', '<b>ATP synthase</b>in the interactome', C.complex.a + 41, C.complex.b - 0.5, 'cyn');
  const pins = I.info && I.info.pins ? I.info.pins : ['A hub', 'A protein'];
  label('int', 'pinRed', `<b>${esc(pins[0])}</b>a hub in the centre`, C.map.a + 18, C.map.a + 27, 'mag');
  label('int', 'pinBlue', `<b>${esc(pins[1])}</b>out on the edge`, C.map.a + 18.5, C.map.a + 27, 'cyn');
  label('crowd', 'red', '<b>One patient</b>', C.rare.a + 4, C.rare.a + 11, 'mag');
  label('int', 'rare', '<b>Disease gene</b>and its neighbours', C.rare.a + 16, C.rare.b - 0.5, 'mag');
  label('int', 'treat', '<b>Drug target</b>and its neighbours', C.rare.a + 17, C.rare.b - 0.5, 'grn');
  label('int', 'seed', '<b>Symptom genes</b>where the signal starts', C.treat.a + 15.5, C.treat.b - 1, 'amb');
  label('int', 'causal', '<b>Top candidate</b>the broken gene', C.treat.a + 22, C.treat.b - 1, 'mag');
  label('tissue', 'mucosa', '<b>Glands</b>', C.tissue.a + 2, C.tissue.a + 9, 'mag');
  label('tissue', 'submucosa', '<b>Loose tissue</b>with vessels', C.tissue.a + 2.6, C.tissue.a + 9, 'mag');
  label('tissue', 'muscle', '<b>Muscle</b>', C.tissue.a + 3.2, C.tissue.a + 9, 'mag');
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
// Explore mode: open any scene of the tour and play with it, or search the
// curated proteins of the interactome and trace routes between them.
const SCENES = [
  ['int', 'Interactome', 'Human proteins and their interactions. Light up groups that work together, flatten it into a city map, follow diseases and a signal spreading from a patient\'s genes.'],
  ['mac', 'Computer', 'A classic computer, its parts and its wiring: the parts list alone does not tell you how it works.'],
  ['web', 'Internet and friends', 'A map of the internet and the ties between cities around the world: networks are everywhere.'],
  ['dna', 'Genome and proteins', 'DNA, the 23 chromosomes, the shapes of proteins and how many kinds there are.'],
  ['atp', 'ATP synthase', 'A rotary motor and 13 of the proteins that build it: its parts, the machine, how it runs and its network.'],
  ['crowd', 'Rare diseases', 'More than 6,000 rare diseases have a known genetic cause. Each patient asks: which gene, what mechanism, which treatment?'],
  ['sankey', 'Immunity', 'Inborn errors of immunity that mainly cause autoimmunity or autoinflammation: the clinical categories doctors use, against the clusters their genes form in the interactome.'],
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
  // a gently swaying scene (about 25 degrees either way, so flat ones never turn edge-on), unless you are steering it
  if (X.turn === 'on' && !orbit.to && !orbit.held && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (!same && k !== 'int') { selectProtein(-1, false); clearRoute(); }
  if (fly && !same) flyTo(exploreView(k, 'default'));
  renderScenes();
}
// a view for explore mode: wide scenes stand clear of the side panel on wide screens
function exploreView(k, name) {
  const v = view(k, name);
  if (GL.wide && (k === 'sankey' || (k === 'tissue' && (name === 'default' || name === 'section')))) { v[2] += k === 'sankey' ? 1.0 : 0.8; v[3] += k === 'sankey' ? -0.45 : -0.2; }
  return v;
}
function setCtl(k, key, v) {
  const s = GL.sets[k], c = (s.controls || []).find(x => x.key === key), was = c ? ctlValue(k, c) : null;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // some views have their own best camera (cam views named like the option); leaving one goes back to the scene's own view
  if (s.cam && s.cam[v]) flyTo(exploreView(k, v));
  else if (s.cam && was && s.cam[was]) flyTo(exploreView(k, 'default'));
  if (c) renderScenes();
}
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

// ------------------------------------------------------- proteins (curated) --
const INT = () => GL.sets.int;
function matches(q, limit) {
  q = String(q == null ? '' : q).trim().toLowerCase();
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
  X.pathErr = null; X.path = null; X.pathEnds = null;
  if (INT().route) INT().route(-1, -1); // drop any earlier route, even if this query fails
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
// shared rooms: what everyone at the station sees alike: the tab, the scene and its controls, the selected protein
// and the route's two ends (the camera, its turning, the search box and the headset keyboard stay each person's own)
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
  const s = GL.sets[X.scene];
  return { tab: X.tab, scene: X.scene, ctl: Object.fromEntries((s.controls || []).map(c => [c.key, ctlValue(X.scene, c)])),
    sel: X.sel, route: X.pathEnds ? X.pathEnds.slice() : null };
}
// shows a shared state with the story's own setters, the scene first; ignores what is not valid
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const N = INT().core.length, int = x => Number.isInteger(x) && x >= -1 && x < N;
  if (SCENES.some(([k]) => k === v.scene) && GL.sets[v.scene] && X.scene !== v.scene) openScene(v.scene);
  const ctl = v.ctl && typeof v.ctl === 'object' ? v.ctl : {};
  for (const c of GL.sets[X.scene].controls || []) {
    const x = ctl[c.key];
    if (c.options.some(o => o[0] === x) && ctlValue(X.scene, c) !== x) setCtl(X.scene, c.key, x);
  }
  if (int(v.sel) && X.sel !== v.sel) {
    selectProtein(v.sel, false);
    if (v.sel >= 0 && document.activeElement !== $('#q')) $('#q').value = INT().core[v.sel].sym;
  }
  const r = v.route, cur = X.pathEnds;
  if (r === null && cur) xrClearPath();
  else if (Array.isArray(r) && r.length === 2 && r.every(x => int(x) && x >= 0) && r[0] !== r[1] && !(cur && cur[0] === r[0] && cur[1] === r[1])) xrPathPreset(r[0], r[1]);
  if (TABS.some(([k]) => k === v.tab) && X.tab !== v.tab) showTab(v.tab);
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
    pane.innerHTML = `${i === -2 ? `<p class="empty">No protein matches “${esc(q)}”. Try a gene symbol like TP53, or a name like kinase.</p>` : `<p class="empty">Search above, or click a protein in the interactome. The ${fmt(C0.length)} named proteins come from the network-medicine story; the others are drawn to suggest the rest of the map.</p>`}
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
// point at, and labels become sprites on top or signs in the scene. Controllers: point and pull the trigger
// to click, drag the scene with the trigger or grip, thumbstick spins and zooms,
// A/X plays and pauses the story. Hand tracking: point and pinch.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), size: 1, globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  rot: new THREE.Quaternion(), free: false, lm: 'face', signL: new THREE.Quaternion(), signH: new THREE.Vector3(),
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
const xrSig = () => (HOST.xr && HOST.xr.sig ? HOST.xr.sig() : '');
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
  } else { c.press = Object.assign(startDrag(c), { kind: 'globe', i: h.i }); orbit.held = true; }
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
  } else if (!p.moved && p.i >= 0) { buzz(c); xrClickProtein(p.i); }
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
  if (HOST.anchor.locked(G.target === 'panel' ? 'panel' : 'globe')) { c.grab = null; return; }   // locked meanwhile (a shared room's layout lock)
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
  else if (hs.length) {
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
    // labels hidden: no story panel at all, in story and explore mode (the Stories screen, the shell's menu and its
    // clock stay, and A or X still plays); labels in 3D: the panels stand in the scene, as the labels' signs do
    XR.main.mesh.visible = XR.foot.mesh.visible = !land && XR.lm !== 'hidden';
    panelDepth(XR.main, XR.lm === 'fixed'); panelDepth(XR.foot, XR.lm === 'fixed');
  }
  GL.world.visible = !land;
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
  if (X.pathEnds) { XR.pf = X.pathEnds[0]; XR.pt = X.pathEnds[1]; }
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
    XR.globeOff.copy(p.off); XR.size = p.s || 1; xrSceneRot(p.rot || p.q);
    xrPanelPose(p.pp, p.pr, p.pq);
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
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) { hideLabelXR(L); L.o = -1; }
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
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl[X.scene] || {}), X.sel, X.path ? routeNames(X.path).join(',') : '', X.pathErr || '',
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
  const head = makePanel(1400, 300, 1.02, drawLandHead, () => 'h' + XR.inStory + audioLabel() + HOST.repeat + XR.soundCheck + HOST.audio.muted + HOST.anchor.status());
  head.mesh.position.set(0, 0.36, -1.22);
  XR.landGroup.add(head.mesh); XR.land.push(head);
  HOST.list.forEach((s, k) => {
    // cards 0.36 m wide on an arc: seven 0.31 rad apart at 1.25 m (neighbours 0.386 m apart, the outer ones 53° to the
    // side), eight 0.272 rad apart at 1.4 m (0.379 m apart, the outer ones 55° to the side), nine 0.245 rad apart at
    // 1.55 m (0.379 m apart, the outer ones 56° to the side), ten 0.225 rad
    // apart at 1.7 m (0.382 m apart, the outer ones 58° to the side), eleven 0.206 rad apart at 1.85 m (0.381 m apart,
    // the outer ones 59° to the side), twelve 0.19 rad apart at 2 m (0.38 m apart, the outer ones 60° to the side),
    // thirteen 0.177 rad apart at 2.15 m (0.381 m apart, the outer ones 61° to the side), fourteen 0.166 rad apart at
    // 2.3 m (0.381 m apart, the outer ones 62° to the side)
    const n = HOST.list.length, a = (k - (n - 1) / 2) * (n > 13 ? 0.166 : n > 12 ? 0.177 : n > 11 ? 0.19 : n > 10 ? 0.206 : n > 9 ? 0.225 : n > 8 ? 0.245 : n > 7 ? 0.272 : 0.31), d = n > 13 ? 2.3 : n > 12 ? 2.15 : n > 11 ? 2 : n > 10 ? 1.85 : n > 9 ? 1.7 : n > 8 ? 1.55 : n > 7 ? 1.4 : 1.25;
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
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
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
  // at a shared room's station each station keeps its story: another story is another station, so no Stories button
  if (!(HOST.room && HOST.room.placing())) hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  // the story's name, smaller when the buttons leave it less room
  fitTitle(ctx, 'LBI NetMed tour', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
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
    y += textBlock(ctx, `Point at a named protein in the interactome and pull the trigger (or pinch). The ${fmt(C0.length)} named proteins come from the network-medicine story; the others suggest the rest of the map.`, x, y, W, 27, 40, VC.muted) + 22;
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
// Optional voice-over: put an MP3 at audio/narration-lbi.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-lbi.mp3', {
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
    let best = 'int', ba = 0;
    for (const k of SET_ORDER) if (S[k + '_a'] > ba + 0.01) { ba = S[k + '_a']; best = k; }
    // the story's view, taken back into the set's own frame (explore shows sets unturned)
    const v = storyCam(ts).slice(), r = -setYaw(best, ts) * D2R, x = v[3], z = v[5];
    v[0] += r / D2R; v[3] = x * Math.cos(r) + z * Math.sin(r); v[5] = -x * Math.sin(r) + z * Math.cos(r);
    orbit.cur = v; orbit.to = null;
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
    clearRoute();
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
    if (ev.key === '/' && APP.mode === 'explore') { showTab('protein'); $('#q').focus(); ev.preventDefault(); }
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
    // #lbi&explore&scene=atp&view=complex (any control of the scene by its key), or &q=TP53, &route=TP53,BRCA1
    if (hp.get('scene')) openScene(hp.get('scene'), false);
    orbit.cur = view(X.scene, 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    const s = GL.sets[X.scene];
    for (const c of s.controls || []) if (hp.get(c.key)) setCtl(X.scene, c.key, hp.get(c.key));
    if (hp.get('tab')) showTab(hp.get('tab'));
    if (hp.get('q')) { $('#q').value = hp.get('q'); runQuery(hp.get('q')); }
    if (hp.get('route')) {
      const [a = '', b = ''] = hp.get('route').split(',').map(x => x.trim()), s = findProtein(a), t = findProtein(b);
      showTab('protein');
      $('#pf').value = s >= 0 ? INT().core[s].sym : a; $('#pt').value = t >= 0 ? INT().core[t].sym : b;
      runRoute(s, t);
    }
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
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
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the scene, its controls and the proteins (no one-shot effects)
  collab: {
    APP, scene: () => GL.scene, state: collabState, apply: collabApply, view: collabView, setView: collabSetView,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
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
