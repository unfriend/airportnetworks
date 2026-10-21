// One scan, one system: the body as a metabolic network. A PET scanner and how it sees sugar, the organs of 658
// whole-body FDG-PET scans and their partial-correlation network, how it thins and tips towards a few hubs from health
// to disease, and the next step: one network per scan, and an index that may tell how a body is doing. After Geist
// et al., "The metabolic organ connectome: A novel approach to measure allostatic load during health-to-disease
// transition", Med (2025) (CC BY 4.0), and the poster "Shaping a New Era in Nuclear Medicine" by Barbara K Geist,
// Alexander Grentner, Joel Fischer, Josef Yu, Dato Tsomaia, Adna Smajlovic, Stefan Grünert and Marcus Hacker (Division
// of Nuclear Medicine, Medical University of Vienna; LBI for Network Medicine).
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/pet/build.mjs from the tour's kit, the tour's PET body set and the data, organ icons, sets and engine
// parts in tools/pet: edit those, not this file.
HOST.register('pet', function (HOST) {
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
// PET_DATA (the paper's and the poster's numbers, tools/pet/sets/data.js) comes first, then the organ icons (PET_ICONS);
// the tour's PET body set (SETS.body) is used unchanged.
const SETS = {};
// PET_DATA: generated by tools/pet/data/gen_data.mjs; never edit by hand.
// Sources: the paper (Geist BK, Guthrie J, Kertesz H, Kiefer FW, Kulterer OC, Nakuz T, Nics L, Patronas E-M, Rendeiro A, Vraka C, Yu J, Grünert S, Hacker M. The metabolic organ connectome: A novel approach to measure allostatic load during health-to-disease transition. Med 6, 100881 (2025). doi:10.1016/j.medj.2025.100881 (CC BY 4.0)) and the poster (Geist BK, Grentner A, Fischer J, Yu J, Tsomaia D, Smajlovic A, Grünert S, Hacker M. Shaping a New Era in Nuclear Medicine. Division of Nuclear Medicine, Medical University of Vienna; LBI for Network Medicine.).
// Fields:
//   source            citations
//   organs[]          { id, name, short, measure (how the paper measures it), col (its colour everywhere), pos (a home
//                     point in the frame of the tour's PET body set), suv (typical uptake / aorta, illustrative) }; 13
//                     organs, then the aorta (the reference)
//   cohort, protocol  the paper's cohorts (table1: its Table 1) and scan protocol
//   f2                Figure 2A's two 11 x 11 partial-correlation matrices (organs in f2.organs order)
//   nets[]            networks: { id, title, fig, n, density (%, as printed), disorder (as printed, if any), organs (ids
//                     drawn), isolated, hubs, edges [[a, b, signed weight]], layout { organ: [x, y] in the figure, 0..1,
//                     y down }, computed (density, disorder, strengths and hubs computed from the edges), exact (true for
//                     the printed matrices; the others are read off the figures) }: full and vena (Figure 2A), A_low,
//                     A_high, B_low, B_high, C_low, C_mid, C_high (Figure 3), FDG_healthy, HK2, GLUT (Figure 4)
//   table2[]          every comparison of the paper's Table 2: { what, cohort, part ('test' or 'health'), groups [{ label,
//                     n, density, disorder }], pD, pO (p values as printed), sigD, sigO (significant) }
//   table3[]          the protein networks of Table 3: { name, kind, density, p, r (weight-matrix correlation with FDG), similar }
//   strength          Figure 3D's strength distributions (high and low density) and Figure 2C's (test-retest), read off
//   synth             a stand-in cohort of 658 people with Figure 2A's partial correlations: rows (values in organ-bar
//                     units, f2 order), cor and pcor (its correlations and partial correlations), pairs (for the
//                     explainer: { a, b, paper, r, pr, xy: per person [a, b, a's residual, b's residual] in z units })
//   single            the poster's one-scan network, stand-in maths (see the generator): organs, theta, soft, proj
//                     (MDI = m + a C + b H), profiles { healthy, cancer, both, dys: { u (mean SUVs), C, H, mdi } }
//   poster            the poster's numbers: cohort (baseline and follow-up scans), mdi (group summaries), km (survival
//                     by tertile), prognosis (the immunotherapy test: response groups and AUCs), creation (its figure)
const PET_DATA = {"source":{"paper":"Geist BK, Guthrie J, Kertesz H, Kiefer FW, Kulterer OC, Nakuz T, Nics L, Patronas E-M, Rendeiro A, Vraka C, Yu J, Grünert S, Hacker M. The metabolic organ connectome: A novel approach to measure allostatic load during health-to-disease transition. Med 6, 100881 (2025). doi:10.1016/j.medj.2025.100881 (CC BY 4.0)","poster":"Geist BK, Grentner A, Fischer J, Yu J, Tsomaia D, Smajlovic A, Grünert S, Hacker M. Shaping a New Era in Nuclear Medicine. Division of Nuclear Medicine, Medical University of Vienna; LBI for Network Medicine."},"organs":[{"id":"brain","name":"Brain","short":"Brain","measure":"mean of the whole brain","col":"#a78bfa","pos":[0,0.738,-0.008],"suv":4.4},{"id":"thyroid","name":"Thyroid","short":"Thyroid","measure":"mean of the whole gland","col":"#22d3ee","pos":[0,0.548,0.042],"suv":0.95},{"id":"lungs","name":"Lungs","short":"Lungs","measure":"maximum (left and right averaged)","col":"#60a5fa","pos":[-0.079,0.365,-0.01],"suv":0.55},{"id":"heart","name":"Heart","short":"Heart","measure":"mean of the whole heart","col":"#f43f5e","pos":[0.038,0.293,0.052],"suv":1.8},{"id":"liver","name":"Liver","short":"Liver","measure":"mean of the whole liver","col":"#f97316","pos":[-0.074,0.205,0.012],"suv":1.35},{"id":"spleen","name":"Spleen","short":"Spleen","measure":"mean of the whole spleen","col":"#d946ef","pos":[0.108,0.2,-0.056],"suv":1.1},{"id":"pancreas","name":"Pancreas","short":"Pancreas","measure":"mean of the whole pancreas","col":"#facc15","pos":[0.032,0.14,-0.01],"suv":0.95},{"id":"kidneys","name":"Kidneys","short":"Kidneys","measure":"mean (left and right averaged)","col":"#fb7185","pos":[-0.065,0.098,-0.066],"suv":1.6},{"id":"adrenal","name":"Adrenal glands","short":"Adrenals","measure":"maximum","col":"#a3e635","pos":[-0.054,0.152,-0.06],"suv":1.2},{"id":"intestine","name":"Intestine","short":"Intestine","measure":"mean of the whole intestine","col":"#f9a8d4","pos":[-0.009,0.02,0.05],"suv":1},{"id":"muscle","name":"Muscle","short":"Muscle","measure":"mean of the gluteus maximus","col":"#4ade80","pos":[-0.072,-0.13,-0.085],"suv":0.47},{"id":"marrow","name":"Bone marrow","short":"Marrow","measure":"maximum between the vertebrae L1 and L5","col":"#e7e5e4","pos":[0,0.06,-0.036],"suv":1.3},{"id":"fat","name":"Subcutaneous fat","short":"Fat","measure":"mean between the vertebrae L1 and L5","col":"#fdba74","pos":[0,0.06,0.1],"suv":0.2},{"id":"aorta","name":"Aorta (blood pool)","short":"Aorta","measure":"the reference: every organ is divided by it","col":"#94a3b8","pos":[0.014,0.25,-0.04],"suv":1}],"cohort":{"scans":658,"subjects":548,"healthy":241,"cancer":417,"lung":165,"hnscc":252,"retest6w":47,"cold2w":63,"dose":21,"norepi":40,"gtex":946,"gtexSamples":17382,"gtexProteins":13,"table1":{"cols":["Full FDG cohort","Healthy FDG cohort","Cancer FDG cohort","GTEx cohort"],"rows":[["Subjects","658","241","417","946"],["Male (%)","63","53","69","67"],["Blood glucose (mg/dL)","105 ± 34","83 ± 6","115 ± 38","–"],["BMI (kg/m²)","26 ± 6","25 ± 5","27 ± 6","27 ± 4"],["Age (years)","54 ± 17","34 ± 12","61 ± 11","53 ± 13"],["Leukocytes (10⁹/L)","8.2 ± 2.9","6 ± 2","9.1 ± 2.8","–"],["CRP (mg/dL)","1.7 ± 3.8","0.2 ± 0.5","3.1 ± 4.8","–"],["Norepinephrine (ng/L)","–","271 ± 114 (40 people)","–","–"],["Tumour load, TLG (SUV × mL)","–","–","265 ± 677","–"],["Tumour stage","–","–","4 (3–4)","–"],["Survival (months)","–","–","42 ± 32","–"]]}},"protocol":{"fasting":6,"dose":[250,300],"rest":60,"segmentation":"MOOSE (nnU-Net)","software":"JASP 0.19.0","p":0.05,"hub":1.7},"f2":{"organs":["adrenal","marrow","heart","intestine","kidneys","liver","lungs","muscle","pancreas","spleen","thyroid"],"aorta":[[0,0,-0.19,0,0,0,0.3,0,0,0,0],[0,0,-0.19,0.37,0,0,0.15,0,0,0,0],[-0.19,-0.19,0,0.27,0.23,0.31,0.73,0.17,0.22,-0.16,0],[0,0.37,0.27,0,-0.19,0,-0.31,0.23,0,0,0],[0,0,0.23,-0.19,0,0,-0.21,0,0.15,0.2,0],[0,0,0.31,0,0,0,-0.42,0.17,0,0.42,0],[0.3,0.15,0.73,-0.31,-0.21,-0.42,0,0,-0.16,0.2,0.25],[0,0,0.17,0.23,0,0.17,0,0,0,0.18,0],[0,0,0.22,0,0.15,0,-0.16,0,0,0,0],[0,0,-0.16,0,0.2,0.42,0.2,0.18,0,0,0],[0,0,0,0,0,0,0.25,0,0,0,0]],"vena":[[0,0,-0.2,0,0,0,0.35,0.15,0,0,0],[0,0,0,0.28,-0.16,0,0,0,0.19,0,0],[-0.2,0,0,0.28,0.24,0,0.69,0.15,0,-0.2,-0.22],[0,0.28,0.28,0,-0.21,0,-0.36,0.24,0,0.17,0.19],[0,-0.16,0.24,-0.21,0,0.3,-0.27,0,0.28,0.19,0],[0,0,0,0,0.3,0,0,0,0,0.45,0],[0.35,0,0.69,-0.36,-0.27,0,0,0,0,0.27,0.38],[0.15,0,0.15,0.24,0,0,0,0,0,0,0],[0,0.19,0,0,0.28,0,0,0,0,0,0],[0,0,-0.2,0.17,0.19,0.45,0.27,0,0,0,0],[0,0,-0.22,0.19,0,0,0.38,0,0,0,0]]},"nets":[{"id":"full","title":"All 658 scans (normalised to the aorta)","fig":"2A","n":658,"density":12,"disorder":0.17,"organs":["adrenal","marrow","heart","intestine","kidneys","liver","lungs","muscle","pancreas","spleen","thyroid"],"isolated":[],"hubs":[],"edges":[["adrenal","heart",-0.19],["adrenal","lungs",0.3],["marrow","heart",-0.19],["marrow","intestine",0.37],["marrow","lungs",0.15],["heart","intestine",0.27],["heart","kidneys",0.23],["heart","liver",0.31],["heart","lungs",0.73],["heart","muscle",0.17],["heart","pancreas",0.22],["heart","spleen",-0.16],["intestine","kidneys",-0.19],["intestine","lungs",-0.31],["intestine","muscle",0.23],["kidneys","lungs",-0.21],["kidneys","pancreas",0.15],["kidneys","spleen",0.2],["liver","lungs",-0.42],["liver","muscle",0.17],["liver","spleen",0.42],["lungs","pancreas",-0.16],["lungs","spleen",0.2],["lungs","thyroid",0.25],["muscle","spleen",0.18]],"layout":{},"computed":{"density":0.116,"disorder":0.217,"fitA":2.719,"strength":{"adrenal":0.49,"marrow":0.71,"heart":2.47,"intestine":1.37,"kidneys":0.98,"liver":1.32,"lungs":2.73,"muscle":0.75,"pancreas":0.53,"spleen":1.16,"thyroid":0.25},"hubs":["heart","lungs"]},"exact":true},{"id":"vena","title":"All 658 scans (normalised to the vena cava)","fig":"2A","n":658,"density":12,"disorder":0.21,"organs":["adrenal","marrow","heart","intestine","kidneys","liver","lungs","muscle","pancreas","spleen","thyroid"],"isolated":[],"hubs":[],"edges":[["adrenal","heart",-0.2],["adrenal","lungs",0.35],["adrenal","muscle",0.15],["marrow","intestine",0.28],["marrow","kidneys",-0.16],["marrow","pancreas",0.19],["heart","intestine",0.28],["heart","kidneys",0.24],["heart","lungs",0.69],["heart","muscle",0.15],["heart","spleen",-0.2],["heart","thyroid",-0.22],["intestine","kidneys",-0.21],["intestine","lungs",-0.36],["intestine","muscle",0.24],["intestine","spleen",0.17],["intestine","thyroid",0.19],["kidneys","liver",0.3],["kidneys","lungs",-0.27],["kidneys","pancreas",0.28],["kidneys","spleen",0.19],["liver","spleen",0.45],["lungs","spleen",0.27],["lungs","thyroid",0.38]],"layout":{},"computed":{"density":0.117,"disorder":0.171,"fitA":2.378,"strength":{"adrenal":0.7,"marrow":0.63,"heart":1.98,"intestine":1.73,"kidneys":1.65,"liver":0.75,"lungs":2.32,"muscle":0.54,"pancreas":0.47,"spleen":1.28,"thyroid":0.79},"hubs":["lungs"]},"exact":true}],"table2":[{"what":"Test-retest","cohort":"2 scans within 6 weeks, no intervention","part":"test","groups":[{"label":"first scan","n":47,"density":14,"disorder":0.06},{"label":"second scan","n":47,"density":16,"disorder":0.04}],"pD":"p = 0.12","pO":"p = 0.2","sigD":false,"sigO":false},{"what":"Cold exposure","cohort":"2 scans within 2 weeks, cold exposure at the second","part":"test","groups":[{"label":"first scan","n":63,"density":7,"disorder":0.15},{"label":"second scan","n":63,"density":8,"disorder":0.2}],"pD":"p = 0.3","pO":"p = 0.2","sigD":false,"sigO":false},{"what":"Dose","cohort":"2 consecutive scans, 3 doses","part":"test","groups":[{"label":"standard dose","n":21,"density":20,"disorder":0.09},{"label":"ultra-low dose","n":21,"density":24,"disorder":0.07},{"label":"virtual low dose","n":21,"density":23,"disorder":0.08}],"pD":"all p > 0.5","pO":"all p > 0.2","sigD":false,"sigO":false},{"what":"Blood pool","cohort":"full cohort, normalised to","part":"test","groups":[{"label":"aorta","n":658,"density":12,"disorder":0.17},{"label":"vena cava","n":658,"density":12,"disorder":0.21}],"pD":"p = 0.97","pO":"p = 0.97","sigD":false,"sigO":false},{"what":"Scanner","cohort":"2 PET/CT systems","part":"test","groups":[{"label":"Biograph TruePoint 64","n":61,"density":8,"disorder":0.17},{"label":"Biograph Vision","n":61,"density":11,"disorder":0.15}],"pD":"p = 0.3","pO":"p = 0.4","sigD":false,"sigO":false},{"what":"Sex","cohort":"55 people each, matched health","part":"test","groups":[{"label":"male","n":55,"density":27,"disorder":0.21},{"label":"female","n":55,"density":21,"disorder":0.29}],"pD":"p = 0.4","pO":"p = 0.4","sigD":false,"sigO":false},{"what":"Age","cohort":"full cohort, split at the median","part":"test","groups":[{"label":"under 56 years","n":302,"density":17,"disorder":0.13},{"label":"56 or older","n":283,"density":13,"disorder":0.16}],"pD":"p = 0.8","pO":"p = 1.0","sigD":false,"sigO":false},{"what":"Cancer","cohort":"full cohort","part":"health","groups":[{"label":"healthy","n":241,"density":30,"disorder":0.19},{"label":"cancer","n":417,"density":7,"disorder":0.29}],"pD":"p < 0.001","pO":"p = 0.014","sigD":true,"sigO":true},{"what":"BMI","cohort":"full cohort, split at the median","part":"health","groups":[{"label":"BMI under 25.3","n":303,"density":33,"disorder":0.14},{"label":"BMI 25.3 or more","n":303,"density":14,"disorder":0.27}],"pD":"p = 0.024","pO":"p = 0.04","sigD":true,"sigO":true},{"what":"BMI","cohort":"healthy people, split at the median","part":"health","groups":[{"label":"BMI under 24.4","n":94,"density":27,"disorder":0.13},{"label":"BMI 24.4 or more","n":95,"density":7,"disorder":0.17}],"pD":"p < 0.001","pO":"p = 0.02","sigD":true,"sigO":true},{"what":"BMI","cohort":"people with cancer, split at the median","part":"health","groups":[{"label":"BMI under 26.0","n":203,"density":15,"disorder":0.18},{"label":"BMI 26.0 or more","n":214,"density":11,"disorder":0.2}],"pD":"p = 0.3","pO":"p = 0.4","sigD":false,"sigO":false},{"what":"Leukocytes","cohort":"full cohort, split at the median","part":"health","groups":[{"label":"under 7.9 × 10⁹/L","n":117,"density":10,"disorder":0.12},{"label":"7.9 × 10⁹/L or more","n":118,"density":6,"disorder":0.16}],"pD":"p = 0.12","pO":"p = 0.12","sigD":false,"sigO":false},{"what":"Leukocytes","cohort":"healthy people, split at the median","part":"health","groups":[{"label":"under 6.5 × 10⁹/L","n":36,"density":5,"disorder":0.09},{"label":"6.5 × 10⁹/L or more","n":37,"density":3,"disorder":0.17}],"pD":"p = 0.3","pO":"p = 0.07","sigD":false,"sigO":false},{"what":"Leukocytes","cohort":"people with cancer, split at the median","part":"health","groups":[{"label":"under 9.3 × 10⁹/L","n":63,"density":11,"disorder":0.12},{"label":"9.3 × 10⁹/L or more","n":63,"density":6,"disorder":0.21}],"pD":"p = 0.03","pO":"p = 0.07","sigD":true,"sigO":false},{"what":"CRP","cohort":"full cohort, split at the median","part":"health","groups":[{"label":"under 0.5 mg/dL","n":190,"density":12,"disorder":0.11},{"label":"0.5 mg/dL or more","n":115,"density":6,"disorder":0.19}],"pD":"p = 0.018","pO":"p = 0.018","sigD":true,"sigO":true},{"what":"CRP","cohort":"healthy people, split at the median","part":"health","groups":[{"label":"under 0.08 mg/dL","n":75,"density":10,"disorder":0.11},{"label":"0.08 mg/dL or more","n":69,"density":10,"disorder":0.12}],"pD":"p = 0.9","pO":"p = 0.8","sigD":false,"sigO":false},{"what":"CRP","cohort":"people with cancer, split at the median","part":"health","groups":[{"label":"under 1.25 mg/dL","n":81,"density":6,"disorder":0.23},{"label":"1.25 mg/dL or more","n":80,"density":3,"disorder":0.43}],"pD":"p = 0.16","pO":"p = 0.2","sigD":false,"sigO":false},{"what":"CRP","cohort":"full cohort, in thirds","part":"health","groups":[{"label":"under 0.11 mg/dL","n":95,"density":11,"disorder":0.1},{"label":"0.11 to 0.74 mg/dL","n":108,"density":7,"disorder":0.17},{"label":"0.74 to 40.1 mg/dL","n":102,"density":3,"disorder":0.27}],"pD":"p = 0.02, then p = 0.09","pO":"p = 0.01, then p = 0.13","sigD":true,"sigO":true},{"what":"Blood glucose","cohort":"full cohort, split at the median","part":"health","groups":[{"label":"under 93 mg/dL","n":104,"density":16,"disorder":0.12},{"label":"93 mg/dL or more","n":114,"density":8,"disorder":0.14}],"pD":"p = 0.025","pO":"p = 0.08","sigD":true,"sigO":false},{"what":"Norepinephrine","cohort":"healthy people, split at the median","part":"health","groups":[{"label":"under 270 ng/L","n":20,"density":14,"disorder":0.11},{"label":"270 ng/L or more","n":20,"density":4,"disorder":0.21}],"pD":"p = 0.04","pO":"p = 0.12","sigD":true,"sigO":false},{"what":"Tumour load","cohort":"people with cancer, split at the median TLG","part":"health","groups":[{"label":"TLG under 23","n":174,"density":18,"disorder":0.17},{"label":"TLG 23 or more","n":174,"density":8,"disorder":0.3}],"pD":"p = 0.028","pO":"p = 0.04","sigD":true,"sigO":true},{"what":"Tumour stage","cohort":"people with cancer","part":"health","groups":[{"label":"stage below III","n":99,"density":20,"disorder":0.16},{"label":"stage IV","n":98,"density":13,"disorder":0.19}],"pD":"p = 0.1","pO":"p = 0.2","sigD":false,"sigO":false},{"what":"Survival","cohort":"people with cancer, split at the median","part":"health","groups":[{"label":"under 34 months","n":208,"density":23,"disorder":0.14},{"label":"34 months or more","n":208,"density":7,"disorder":0.23}],"pD":"p < 0.001","pO":"p = 0.005","sigD":true,"sigO":true}],"table3":[{"name":"FDG (the 241 healthy people)","kind":"fdg","density":9,"p":"","r":null,"similar":""},{"name":"Glucose-6-phosphatase 2 (G6PC2)","kind":"metabolism","density":9,"p":"p = 1.0","r":-0.2,"similar":"very different"},{"name":"Glucose-6-phosphatase 3 (G6PC3)","kind":"metabolism","density":12,"p":"p = 0.9","r":-0.1,"similar":"very different"},{"name":"Glucose-6-phosphate dehydrogenase (G6PD)","kind":"metabolism","density":11,"p":"p = 1.0","r":0,"similar":"very different"},{"name":"Glucose transporters GLUT1 to 4 (together)","kind":"metabolism","density":16,"p":"p = 0.1","r":-0.1,"similar":"very different"},{"name":"Glucose-6-phosphate isomerase (GPI)","kind":"metabolism","density":12,"p":"p = 0.8","r":-0.1,"similar":"very different"},{"name":"Hexose-6-phosphate dehydrogenase (H6PD)","kind":"metabolism","density":13,"p":"p = 1.0","r":-0.4,"similar":"very different"},{"name":"Hexokinase 2 (HK2)","kind":"metabolism","density":7,"p":"p = 1.0","r":0.42,"similar":"similar (p = 0.01)"},{"name":"Glucose-6-phosphate exchanger 1 (SLC37A1)","kind":"metabolism","density":7,"p":"p = 1.0","r":0,"similar":"very different"},{"name":"Glucose-6-phosphate exchanger 2 (SLC37A2)","kind":"metabolism","density":8,"p":"p = 0.8","r":-0.2,"similar":"very different"},{"name":"Glucose-6-phosphate exchanger 4 (SLC37A4)","kind":"metabolism","density":12,"p":"p = 0.7","r":-0.1,"similar":"very different"},{"name":"Interleukin-6 (IL-6)","kind":"inflammation","density":14,"p":"p = 0.12","r":0.1,"similar":"very different"},{"name":"Interleukin-1β (IL-1β)","kind":"inflammation","density":13,"p":"p = 0.15","r":0.22,"similar":"very different"},{"name":"Tumour necrosis factor α (TNF-α)","kind":"inflammation","density":10,"p":"p = 0.8","r":0.2,"similar":"very different"},{"name":"C-reactive protein (CRP)","kind":"inflammation","density":10,"p":"p = 0.4","r":0,"similar":"very different"},{"name":"COX4I1","kind":"ageing","density":7,"p":"p = 0.8","r":-0.1,"similar":"very different"},{"name":"CDKN1A","kind":"ageing","density":18,"p":"p = 0.004","r":-0.3,"similar":"very different"},{"name":"HSP90AA1","kind":"ageing","density":17,"p":"p = 0.06","r":0.1,"similar":"very different"},{"name":"EGR1","kind":"ageing","density":10,"p":"p = 0.5","r":0.22,"similar":"very different"}],"strength":null,"synth":{"n":658,"organs":["adrenal","marrow","heart","intestine","kidneys","liver","lungs","muscle","pancreas","spleen","thyroid"],"shrink":1,"rows":[[1.4,1.2,2.24,1.17,2.13,1.51,0.63,0.52,1.05,1.45,1.15],[1.2,1.32,1.9,1.11,2.19,1.24,0.55,0.53,1.02,1.2,0.85],[0.72,1.38,1.59,1.1,1.81,1.49,0.46,0.55,1.07,1.16,0.82],[1.09,1.22,1.3,0.96,1.67,1.35,0.4,0.47,0.85,1.01,0.89],[1.21,0.76,2.07,1.31,1.76,1.36,0.48,0.44,1.18,0.62,0.45],[1.07,1.19,2.02,1.12,1.37,1.25,0.61,0.49,0.81,1.08,1.26],[0.89,1.29,2.31,1.01,2.16,1.6,0.6,0.52,0.92,1.23,0.95],[1.09,1.28,1.43,1.04,1.35,0.98,0.52,0.31,1.16,1.13,0.94],[1.23,1.36,2.42,1.01,1.85,1.53,0.64,0.47,0.96,1.03,1.05],[1.01,0.9,1.95,1.08,1.36,1.75,0.45,0.61,0.91,1.17,1.04],[1.3,1.51,1.31,1,1.56,1.99,0.4,0.53,0.8,1.33,0.4],[0.8,0.98,1.81,0.94,1.65,1.58,0.51,0.47,0.83,1.15,1.15],[1.42,1.2,1.43,1.16,1.09,1.56,0.49,0.56,0.89,1.12,0.64],[1.25,1.2,2.03,0.7,2.28,1.22,0.55,0.47,1.06,1.23,0.87],[1.28,1.12,1.47,1.04,1.97,1.73,0.49,0.46,1.17,1.2,0.94],[1.16,1.3,1.71,1,1.57,1.43,0.67,0.47,0.89,0.97,1.14],[1.25,1.5,2.12,0.9,1.78,1.35,0.6,0.38,0.93,1.1,0.91],[1.04,1.24,1.98,0.99,2.26,1.73,0.45,0.57,1.39,1.35,0.79],[1.14,1.31,2,1.02,1.62,1.42,0.56,0.48,0.79,1.43,0.81],[1.16,1.57,1.77,1.21,1.67,1.42,0.62,0.49,1.08,1.03,0.89],[1.16,1.43,1.79,1.32,1.31,1.24,0.59,0.37,0.97,0.95,0.92],[1.16,1.11,2.02,1.13,2.03,1.53,0.57,0.52,1,1.43,1],[1.28,1.59,1.14,0.98,1.11,1.05,0.54,0.43,0.69,1.12,0.82],[1.09,1.3,1.47,0.88,1.41,1.34,0.55,0.36,1.01,1.06,0.92],[1.46,1.35,1.79,1.29,1.42,1.22,0.44,0.47,1.26,0.97,0.76],[0.98,1.29,1.89,0.97,2.16,1.49,0.42,0.46,1,1.01,0.82],[0.94,1.18,2.59,0.7,2.01,1.24,0.73,0.36,1.11,1.04,0.85],[1.25,1.29,1.95,0.73,1.54,1.3,0.68,0.47,0.95,1.38,1.12],[1.36,1.43,1.55,0.89,1.53,1.33,0.5,0.31,0.86,1.01,0.72],[0.73,1.53,1.98,0.98,1.81,1.52,0.49,0.44,1.29,1,0.76],[1.17,1.48,1.8,1.05,1.78,1.22,0.6,0.45,1.09,1.1,0.94],[1.29,0.94,1.73,0.95,1.79,1.31,0.45,0.33,0.95,0.94,1.14],[0.57,0.81,1.68,0.92,1.57,1.27,0.38,0.35,0.61,0.6,0.94],[1.32,1.47,1.11,0.96,1.6,1.45,0.44,0.41,0.62,0.99,0.87],[0.86,1.61,1.79,1.27,1.41,1.22,0.49,0.62,0.61,1.08,0.89],[1.38,1.05,1.53,0.96,1.48,1.02,0.6,0.39,0.92,1.33,0.78],[1.26,1.12,1.43,0.9,1.74,1.34,0.47,0.44,0.85,1.33,0.87],[1.12,1.28,2.06,0.68,1.79,1.53,0.58,0.5,0.88,1.33,0.92],[1.41,0.97,2.44,0.86,2.63,1.48,0.75,0.57,0.92,1.75,1.54],[0.84,1.26,1.9,0.85,2.24,1.79,0.5,0.67,1.14,1.13,0.81],[1.1,1.23,2.04,1.29,1.15,1.65,0.57,0.54,1.03,1.22,0.73],[0.91,1.18,1.75,0.87,1.62,1.63,0.47,0.62,1.26,1.3,0.97],[0.89,0.92,1.95,1.23,1.75,1.52,0.43,0.55,1.22,1.21,0.84],[1.22,1.53,1.65,1.15,1.34,1.49,0.57,0.54,0.86,1.26,0.95],[1.03,1.43,2.11,1.02,2.41,1.67,0.59,0.66,1.13,1.39,1.01],[1.56,1.29,1.66,1,1.78,1.22,0.56,0.35,1.05,0.96,0.76],[1.45,1.08,1.16,1.02,1.72,1.52,0.41,0.27,0.74,1.22,0.69],[1.3,1.59,1.78,0.98,1.48,1,0.6,0.48,0.91,0.65,0.97],[1.38,1.34,1.92,1.02,1.67,1.13,0.6,0.53,0.87,1.15,0.85],[1.33,1.25,2.25,0.86,1.99,1.51,0.69,0.55,0.93,1.28,1.01],[1.26,1.45,1.68,1.03,1.8,1.32,0.47,0.46,1.3,1.14,0.7],[0.96,1.24,1.57,1.21,1.89,1.98,0.4,0.62,0.99,1.53,0.75],[1.04,1.75,2.09,1.02,1.32,1.24,0.63,0.43,0.94,1.09,0.84],[0.89,1.24,1.35,1.18,1.41,1.59,0.38,0.54,1.36,1.13,1.05],[1.4,1.57,1.5,1.2,2.18,1.23,0.42,0.49,1.14,1.09,0.81],[1.32,1.52,1.27,1.08,0.99,1.25,0.5,0.47,0.67,0.88,0.8],[1.08,0.88,1.75,0.78,1.85,1.09,0.45,0.55,1.22,1.15,0.59],[1.37,1,2.1,0.85,1.53,1.07,0.61,0.39,0.86,1,1.26],[1.21,1.06,1.82,1.28,1.34,2,0.4,0.81,1.09,1.3,0.82],[1.24,1.12,1.97,0.92,1.89,1.48,0.59,0.38,1.06,1.1,1.01],[1.18,1.43,1.54,1.07,1.56,1.35,0.48,0.34,1,1.03,1.1],[1.35,1.54,1.94,1.19,1.36,1.43,0.58,0.45,0.96,1.12,1.05],[1.1,1.42,1.31,1.22,2,1.04,0.42,0.36,1.06,1.13,0.93],[1.1,1.23,1.68,0.97,1.62,1.19,0.52,0.55,0.59,0.99,0.9],[0.81,1.29,2.2,0.97,1.9,1.42,0.63,0.37,1,1.24,1.13],[1.04,1.05,1.96,0.67,1.95,1.05,0.63,0.49,1.29,0.86,0.94],[1.08,1.42,2.08,1.03,1.61,1.26,0.6,0.5,0.95,0.93,0.88],[1.26,1.44,2.02,1.13,1.33,1.27,0.56,0.48,0.66,0.83,0.81],[1.01,1.24,1.8,0.86,1.76,1.32,0.57,0.29,1.15,1.21,0.79],[1.24,1.63,1.84,1.04,1.44,1.38,0.57,0.53,0.62,1.21,0.88],[1.25,1.05,1.82,0.76,1.74,1.28,0.58,0.46,0.6,1.2,0.98],[1.3,1.58,1.73,1.28,1.48,1.32,0.52,0.46,1.07,1.04,0.98],[1.32,1.54,1.41,1.24,1.58,1.17,0.44,0.29,1.13,0.9,0.72],[1.54,0.81,2.31,1.01,1.03,1.47,0.64,0.61,0.79,1.23,0.98],[1.54,1.27,2.64,0.96,2.25,1.33,0.72,0.51,0.86,1.12,0.74],[1.09,1.6,2.22,1.17,1.84,1.76,0.59,0.63,0.76,1.17,0.67],[1.3,1.17,2.02,1.04,1.83,1.66,0.44,0.42,0.87,1.12,0.94],[1.53,1.43,2.22,0.75,1.48,1.26,0.78,0.34,1.2,1.12,0.92],[1.04,1.52,1.45,0.89,1.15,1.3,0.48,0.44,0.81,0.88,0.73],[0.81,0.94,1.96,0.75,1.79,0.98,0.55,0.35,0.96,0.89,0.96],[1.34,1.36,0.97,1.21,1.49,1.22,0.38,0.4,1,0.79,0.73],[1.14,1.31,1.86,1.02,1.32,1.44,0.44,0.48,1.35,1.02,0.92],[1.43,1.23,2.16,0.84,1.41,0.85,0.67,0.37,0.89,1.14,1],[1.33,1.18,1.35,0.7,2.1,1.24,0.51,0.37,1.22,1.04,0.72],[0.98,1.38,2.23,1.17,1.5,1.53,0.52,0.66,0.93,0.98,0.83],[1.22,1.05,1.94,0.79,2.01,1.42,0.63,0.37,1.09,1.19,0.78],[1.1,1,1.96,0.65,1.57,1.17,0.59,0.42,0.92,1.03,1.03],[1.28,1.38,1.73,0.91,1.44,1.06,0.62,0.44,0.81,0.93,1.2],[0.79,1.22,1.66,1.03,1.48,1.6,0.43,0.52,1.07,1.17,0.99],[1.34,1.16,1.71,1.09,1.73,1.23,0.55,0.52,0.77,1.03,1],[0.94,1.4,1.87,1.26,2.04,2.21,0.47,0.56,1.12,1.54,0.76],[1.1,1.14,1.69,0.91,1.77,1.43,0.4,0.39,1.33,1.08,0.62],[1.67,1.32,1.98,1.22,1.1,1.52,0.6,0.53,1.26,1.28,1.13],[0.94,1.01,2.49,1.09,1.82,0.9,0.66,0.5,1.01,0.81,1.22],[1.24,1.59,1.8,0.94,1.15,1.13,0.6,0.43,0.95,0.93,1.12],[1.24,1.2,1.6,0.99,1.04,1.46,0.55,0.45,0.91,1.15,1.19],[0.84,1.31,1.97,1.2,1.7,1.83,0.47,0.67,1,1.51,0.85],[0.84,1.39,1.75,1.28,1.16,1.22,0.52,0.52,0.94,1.24,0.93],[1.13,0.85,1.32,1.01,1,1.12,0.57,0.32,0.72,1.03,0.97],[1.25,1.11,2.3,0.84,1.51,1.15,0.76,0.32,1,1.21,1.01],[1.05,1.15,1.78,1.37,1.67,1.65,0.39,0.56,1.08,1.07,1],[1.25,1.16,1.81,0.91,1.74,1.64,0.55,0.48,0.72,1.47,0.84],[1.38,1.25,1.12,0.95,1.42,1.1,0.45,0.31,0.73,1.04,0.79],[1.15,1.32,1.85,1.28,1.52,1.06,0.5,0.5,1.16,0.95,0.97],[1.43,1.88,1.4,1.01,1.25,1.32,0.59,0.4,0.73,1.1,1.13],[1.18,0.92,1.71,0.97,1.41,1.2,0.5,0.39,1.02,1.16,0.66],[1.08,1.43,1.6,0.89,1.9,1.62,0.48,0.48,0.64,1.25,1.01],[1.15,1.51,1.86,1.13,1.55,1.23,0.62,0.65,0.98,1.25,1.17],[1.41,1.23,1.65,0.69,1.68,1.29,0.47,0.44,1.04,0.78,0.8],[1.19,1.48,1.78,0.85,1.62,1.54,0.46,0.57,0.84,1.01,0.94],[1.39,1.23,1.78,0.99,1.89,0.97,0.62,0.62,0.75,1.09,0.98],[1.3,1.15,1.84,0.85,1.61,1.02,0.66,0.46,0.78,0.5,1.12],[1.37,0.82,2.54,1.09,2.59,1.27,0.6,0.53,1.25,1.14,0.98],[1.22,1.37,1.96,0.86,1.88,1.2,0.57,0.52,0.97,1.15,0.94],[1.34,0.9,1.6,0.63,1.97,1.15,0.56,0.41,1.11,1.07,0.76],[1.08,1.2,2.05,0.78,1.42,1.22,0.79,0.44,0.99,0.98,0.96],[1.46,1.36,1.5,1.15,1.19,0.95,0.61,0.41,0.74,0.45,1.07],[1.43,1.7,2.44,1.24,1.25,1.29,0.7,0.67,1.28,1.07,0.88],[1.65,1.43,1.5,0.91,1.54,1.48,0.55,0.49,0.9,1.29,0.88],[0.88,1.54,2.14,1.01,1.64,1.68,0.57,0.5,1.24,1.08,1.3],[1.09,1.5,2.37,1.06,1.85,1.71,0.51,0.55,0.84,1.06,0.65],[0.96,1.48,1.57,0.96,1.47,1.45,0.6,0.44,0.97,0.96,1],[1.46,1.74,1.69,1.16,1.13,1.49,0.52,0.47,0.87,1.19,0.73],[1.09,0.96,1.6,1.01,1.72,1.51,0.48,0.44,0.77,1.31,0.87],[1.22,1.47,1.8,0.89,1.85,1.11,0.72,0.59,0.83,1.16,1.3],[1.49,1.06,1.83,0.98,1.14,1.24,0.66,0.41,1,1.07,1.15],[1,1.26,1.58,0.76,0.74,1.22,0.57,0.36,0.83,1.11,0.85],[1.17,1.52,2.17,1.29,1.76,1.5,0.54,0.6,1,1.06,0.86],[1.11,1.63,2.06,1.21,1.8,1.65,0.47,0.46,0.8,1.3,0.65],[1.22,1.17,1.69,1.08,1.38,1.31,0.58,0.45,0.76,1.09,1.06],[1.25,1.36,1.51,0.83,1.76,1.7,0.43,0.48,0.71,1.12,0.8],[1.08,1.18,1.87,1.17,1.79,1.51,0.4,0.41,0.89,0.91,1.02],[1.06,1.28,1.84,0.9,1.46,1.89,0.56,0.7,0.94,1.46,0.96],[1.31,1.15,2.36,0.89,1.54,1.3,0.7,0.48,1.04,1.37,0.91],[1.25,1.46,2.21,0.94,1.57,1.33,0.66,0.55,0.91,0.97,0.97],[0.92,1.07,1.95,0.7,2.1,1.17,0.53,0.45,1.06,0.9,1.01],[1.33,0.81,2.31,0.6,1.59,1.12,0.57,0.35,1.09,0.62,0.89],[1.35,1.26,1.53,0.95,1.36,1.41,0.6,0.55,0.75,0.94,0.94],[1.49,1.49,1.45,1.02,1.18,1.63,0.52,0.42,0.97,0.93,1.03],[0.89,1.3,1.81,0.82,1.98,1.88,0.36,0.46,0.8,0.93,0.9],[1.37,1.03,1.9,0.89,1.95,1.13,0.63,0.55,0.98,0.68,1.07],[1.37,0.84,1.35,1.09,1,1.09,0.54,0.43,0.59,1.03,0.92],[1.46,1.14,2.23,1.05,1.34,0.81,0.66,0.6,1.1,0.94,1.03],[0.87,1.39,1.74,0.91,1.81,1.27,0.53,0.64,1.07,0.94,0.95],[1.04,1.17,1.67,1.14,1.25,1.17,0.61,0.57,0.97,0.92,0.89],[1.03,1.3,2.03,0.95,1.77,1.66,0.49,0.46,1.25,0.99,0.95],[1.43,1.32,1.9,1.05,1.73,1,0.63,0.43,0.94,0.95,0.55],[1.53,1.53,2.11,1.15,1.22,1.22,0.66,0.36,0.72,1.21,1.15],[0.99,1.75,1.84,1.19,1.8,1.57,0.53,0.52,0.91,1.29,1.07],[0.99,1.27,1.6,0.97,1.32,1.39,0.48,0.46,0.97,0.94,0.8],[1.56,1.63,2.13,1.14,1.61,1.23,0.67,0.41,1.05,1.09,1.02],[1.26,1.01,1.7,0.81,1.54,1.31,0.49,0.39,0.89,1.32,0.96],[0.9,1.48,2.06,0.91,1.65,1.33,0.54,0.65,1.05,1.36,0.9],[1.2,1.49,1.15,0.71,2.2,0.54,0.49,0.39,0.7,0.94,1.18],[0.72,1.41,1.76,1.16,1.96,1.54,0.41,0.45,1.12,1.36,0.55],[1.41,1.33,1.94,1.1,1.63,1.62,0.55,0.46,1.03,1.45,1.06],[1.22,1.44,1.7,0.83,1.83,1.38,0.5,0.43,1.01,1.37,1.21],[1.27,1.15,1.77,1.44,2.29,1.96,0.36,0.6,0.92,1.42,0.77],[1.32,1.29,1.46,1.07,1.16,1.09,0.55,0.47,0.71,1.12,0.79],[1.13,1.32,1.91,1.02,1.98,1.83,0.47,0.43,1.26,0.83,0.98],[1.53,1.33,1.77,0.95,1.08,1.38,0.68,0.45,0.77,1.13,0.94],[1.39,1.3,1.74,1.31,1.85,1.26,0.53,0.54,0.97,1.13,0.86],[1.3,1.09,1.89,0.88,1.54,1.32,0.71,0.42,0.8,0.86,1.11],[0.89,0.99,1.29,0.95,1.32,1.7,0.4,0.42,1.04,1.11,0.73],[0.79,1.52,1.58,1.24,1.84,1.47,0.37,0.4,0.7,1.34,1.11],[1.42,1.08,2.17,1.11,1.42,1.37,0.61,0.49,0.98,1.06,0.95],[1.22,1.27,1.53,0.77,2.28,1.59,0.47,0.45,1.26,1.39,1.16],[1.06,1.48,2.3,0.65,2.09,1.27,0.69,0.4,1.08,1.14,0.99],[1.7,1.2,2.14,1.12,1.75,1.03,0.62,0.52,0.98,1.19,1.4],[1.38,1.47,2.19,0.93,1.41,1.33,0.8,0.47,1.04,1.1,1.05],[1.44,1.12,1.83,0.97,1.52,1.2,0.7,0.53,0.95,1.06,1.17],[0.78,1.18,2.02,0.65,1.71,1.4,0.64,0.56,1.16,1.14,0.95],[1.26,1.05,1.41,0.82,1.31,1,0.52,0.51,0.81,1.12,0.97],[1.39,1.19,1.89,1.18,1.43,1.16,0.58,0.41,1.09,1.14,0.81],[1.37,1.22,1.4,0.74,1.15,1.24,0.63,0.45,0.58,1.03,1.01],[1.39,1.33,2.03,0.98,1.26,1.21,0.67,0.41,0.86,0.91,1.01],[1.51,1.47,2.33,1.33,1.5,1.61,0.6,0.62,1.14,0.91,1.2],[1.45,1.04,1.9,0.86,1.55,1.06,0.57,0.39,0.93,0.96,1.26],[1.54,1.22,1.67,1.21,1.34,1.47,0.55,0.39,0.97,0.92,1.03],[0.7,1.03,2.09,1.1,1.86,1.26,0.56,0.55,0.75,0.89,0.99],[1.3,1.13,2.28,0.81,1.58,1.65,0.7,0.57,0.84,1.13,1.16],[0.99,1.08,1.42,0.88,1.27,0.92,0.47,0.39,1.01,1.03,1.12],[0.98,1.19,1.72,0.77,1.71,1.23,0.58,0.49,1.04,1.1,1.18],[0.82,1.46,2.15,1.25,1.96,1.6,0.54,0.63,1,1.05,0.97],[1.23,1.77,1.41,0.75,1.73,1.01,0.49,0.33,0.77,0.99,1.14],[1.17,1.5,1.46,0.8,1.28,1.43,0.47,0.37,0.78,0.84,0.87],[1.35,1.06,2.15,0.92,1.64,1.48,0.57,0.38,0.84,1.43,1.36],[0.95,1.42,1.79,1.19,1.92,1.46,0.39,0.4,1.24,1.3,0.35],[0.9,1.17,2.1,0.92,1.66,1.83,0.61,0.58,1.16,1.3,1.05],[1.04,1.35,2.11,1.1,1.84,1.11,0.61,0.5,1.15,1.18,1.14],[1.22,1.66,1.6,1.31,1.35,1.48,0.45,0.48,0.71,0.93,0.88],[0.9,1.07,2.01,1.09,1.91,1.77,0.55,0.54,0.69,1.46,1.1],[1.1,1.49,2.08,1.17,1.78,1.64,0.57,0.52,0.94,0.97,1.04],[1.35,1.26,2.21,1.08,1.76,1.31,0.63,0.59,1.13,1.17,0.98],[1.37,1.52,1.58,0.91,1.3,1.01,0.51,0.49,0.8,1.06,1.04],[1.19,1.4,1.94,0.78,1.64,1.51,0.59,0.47,1.01,0.98,1.14],[0.93,1.37,1.67,0.94,1.88,1.66,0.46,0.51,0.79,1.39,0.8],[1.2,1.4,2.12,0.85,1.76,1.19,0.71,0.52,0.92,1.2,1.09],[1.21,1.36,1.52,0.71,1.46,1.25,0.58,0.37,0.67,1.24,1.05],[1.15,1.33,1.84,0.86,1.95,1.08,0.54,0.32,0.95,0.94,0.66],[0.93,1.16,1.87,1.02,1.71,1.04,0.52,0.59,0.99,0.9,1],[1.19,1.51,1.99,0.82,1.94,1.62,0.63,0.57,0.95,1.4,1.02],[0.82,1.28,1.61,0.96,1.45,1.39,0.49,0.4,0.96,1.15,1.14],[1.08,1.28,1.59,1.08,1.28,1.18,0.46,0.47,0.82,1.04,0.96],[1.61,1.07,2.3,0.85,1.34,1.38,0.69,0.51,0.85,1.03,1.22],[1,1.27,1.69,0.87,2.17,1.43,0.61,0.49,1.04,0.84,1.22],[0.82,1.57,2.33,1.32,1.86,1.57,0.48,0.52,1.23,1.22,1.09],[1.28,0.99,1.62,0.67,1.9,1.39,0.48,0.39,1,1.03,0.76],[1.14,1.02,1.3,1.05,1.56,1.42,0.54,0.51,0.72,1.3,1.14],[1.23,1.17,1.77,1.22,1.37,1.23,0.54,0.52,0.88,0.96,0.64],[1.15,1.25,1.55,1.18,2.09,1.11,0.52,0.46,1.16,1.43,1.15],[1.18,1.49,2.19,1.22,1.48,1.41,0.59,0.55,1.04,0.98,0.82],[1.15,1.21,1.59,0.82,1.51,1.08,0.55,0.44,0.9,1,0.97],[1.37,1.5,1.99,1.15,1.69,1.11,0.69,0.37,0.67,0.9,1.02],[1.26,1.33,1.97,0.97,1.39,1.39,0.61,0.4,1.03,1.08,0.94],[1.04,1.34,2.34,1.27,1.42,1.32,0.65,0.62,0.77,1.18,0.92],[1.14,1.69,1.46,1.19,1.7,1.1,0.55,0.38,0.9,1.32,0.77],[1.45,1.21,1.85,1.15,1.63,1.56,0.52,0.47,1.33,1.13,1.14],[1.43,1.14,1.32,0.42,1.14,0.86,0.61,0.4,0.69,0.92,1.12],[1.14,1.4,1.87,1.14,1.2,1.49,0.53,0.52,1.01,1.35,1.15],[0.85,0.93,1.82,0.99,1.15,1.22,0.58,0.39,1.11,1,1.14],[1.31,1.27,1.37,1.07,1.69,1.45,0.6,0.38,0.93,1.17,0.96],[1.13,1.3,1.82,1.02,1.85,1.47,0.56,0.54,1.14,1.18,1.07],[1.36,1.01,2.11,1.05,1.59,1,0.59,0.41,0.87,0.85,1.17],[1.27,1.06,1.4,1.06,1.59,1.05,0.45,0.36,0.99,1.16,1.03],[1.11,1.37,1.97,1.28,1.4,1.24,0.56,0.51,0.82,0.78,0.85],[1.15,1.57,1.65,1.04,1.44,1.23,0.55,0.38,0.69,0.95,0.71],[1.07,1.31,2.01,1.06,1.75,1.24,0.54,0.55,0.83,1.03,1.07],[1.09,1.06,2.11,0.53,1.53,1.06,0.67,0.45,0.97,1.14,0.72],[1.39,1.34,1.42,0.98,0.89,1.43,0.45,0.46,0.85,1.13,0.65],[1.14,1.74,2.01,1.3,1.61,1.49,0.58,0.63,0.93,1.03,1.36],[1.29,1.55,2.08,1.24,1.78,1.41,0.6,0.39,1.14,1.15,0.97],[1.48,0.92,1.7,0.78,2.08,1.13,0.53,0.4,0.91,1.02,0.83],[1.04,1.24,2.19,0.95,1.77,1.46,0.46,0.53,1.01,1.39,0.95],[1.15,1.36,1.48,1.13,1.41,1.29,0.45,0.42,0.9,0.86,0.81],[1.29,1.57,1.17,1.3,1.38,1.65,0.34,0.44,0.88,0.89,0.92],[1.25,1.2,1.87,0.92,1.6,1.25,0.59,0.43,0.97,1.12,0.58],[1.41,1.74,1.49,1.32,1.22,1.66,0.48,0.54,0.91,1.13,1],[1.04,1.25,2.07,1.14,2.04,1.92,0.48,0.62,0.97,1.02,0.87],[1.49,1.63,1.74,0.88,1.65,0.98,0.57,0.54,0.86,0.63,1.09],[1.26,1.35,2.14,0.77,1.73,1.65,0.69,0.58,1.03,1.1,1.09],[0.94,1.35,2.06,0.99,1.54,1.29,0.63,0.48,1.15,1.03,0.91],[1.02,1.37,1.7,0.92,1.84,1.14,0.47,0.38,1.34,0.98,0.81],[1.28,1.45,1.53,0.87,2.07,1.38,0.46,0.48,0.87,0.89,0.8],[1.42,0.86,2.57,0.9,1.6,1.45,0.74,0.41,1.05,1.13,1.08],[1.09,1.6,2.04,0.86,1.93,1.36,0.56,0.58,1.02,0.88,1.16],[0.72,1.25,1.58,0.7,1.26,1.3,0.52,0.33,1.09,0.86,0.9],[1.14,1.17,1.79,1.31,1.47,1.25,0.43,0.57,0.88,1.28,0.88],[1.14,0.98,2.14,0.89,1.26,1.21,0.62,0.42,0.9,1.32,1.02],[1.24,1.21,2.02,0.95,1.57,1.15,0.45,0.34,1.19,1.06,0.69],[1.21,0.92,1.77,0.93,1.14,1.01,0.53,0.39,1.07,0.63,1.09],[1.07,0.94,2.28,0.93,2.41,1.85,0.49,0.63,1.14,1.29,1.11],[1.04,1.08,2.17,1.07,1.4,1.41,0.62,0.63,0.98,1.2,0.98],[1.59,1.19,1.49,0.88,1.79,1.19,0.62,0.34,0.66,1.24,0.9],[1.6,1.28,1.65,0.64,1.57,1.23,0.62,0.43,0.86,1.22,0.71],[1.03,1.39,1.39,0.94,1.61,1.27,0.47,0.37,0.92,1,0.79],[1.02,1.17,2.13,1.04,1.67,1.75,0.57,0.62,1.19,1.35,1.05],[1.68,1.06,1.33,1.34,1.26,1.28,0.59,0.58,1,1.08,1.03],[0.87,1.27,1.93,1.16,1.54,1.24,0.69,0.42,0.74,1.01,1.18],[1.39,1.39,1.85,1.07,1.42,1.44,0.66,0.52,0.78,1.3,1.08],[1.55,1.31,2.08,1.03,2.03,1.38,0.7,0.55,0.9,1.74,1.1],[1.54,1.52,2.14,1.04,1.63,1.67,0.68,0.53,1.01,1.35,1],[1.09,1.36,1.59,0.89,1.31,1.29,0.5,0.43,0.94,1.11,0.99],[1.34,1.5,1.37,0.95,1.35,0.86,0.62,0.44,1.03,0.95,0.9],[1.21,1.4,1.82,1,1.24,1.13,0.62,0.5,0.94,1.11,1.19],[1.78,1.16,2.15,1.25,1.29,1.54,0.75,0.63,0.8,1.49,1.17],[1.29,1.42,1.97,0.9,1.94,1.72,0.63,0.68,1.12,1.52,1.08],[1.05,1.29,1.8,0.94,1.08,1.19,0.51,0.49,0.85,1.05,0.66],[1.26,1.12,1.39,0.96,1.61,1.72,0.48,0.51,0.92,1.45,0.9],[0.97,0.9,1.84,1.23,1.56,1.48,0.47,0.64,1.18,1.26,0.78],[1.28,1.42,2.57,1.39,1.67,1.16,0.8,0.55,1.36,1.09,1.08],[1.04,1.57,2.12,1,1.68,1.62,0.58,0.37,1.22,1.04,0.84],[1.29,1.25,2.25,0.97,1.56,1.72,0.66,0.6,0.63,1.25,0.73],[1.28,1.01,1.38,0.77,1.82,1.63,0.46,0.57,0.83,1.14,0.87],[1.12,1.35,2.3,0.85,1.82,1.34,0.66,0.47,1,1.36,0.96],[0.87,1.25,1.73,1.03,1.98,1.69,0.41,0.42,0.86,1.19,0.64],[1.17,1.62,1.81,1.28,1.91,1.63,0.4,0.61,1.2,1.14,0.66],[1.22,1.61,1.89,1.42,1.8,1.78,0.47,0.54,1.15,1.22,1.17],[1.6,1.4,0.85,0.77,1.56,1.33,0.51,0.26,0.63,1.09,0.94],[1.18,1.78,1.78,0.89,1.7,1.54,0.57,0.54,0.84,0.95,1.11],[1.23,1.37,2.1,0.9,1.86,1.41,0.5,0.51,1.04,1.18,0.87],[1.46,1.33,1.92,0.93,1.9,1.23,0.54,0.42,1.13,1.12,0.72],[0.95,1.12,1.54,1.07,1.53,1.81,0.45,0.6,0.9,1.41,0.97],[1.05,0.97,1.72,0.9,1.61,1,0.57,0.43,0.96,0.99,1.17],[0.99,1.34,1.39,1.06,1.96,1.39,0.43,0.39,0.77,0.99,0.87],[1.2,1.5,2.06,1.29,1.37,1.43,0.62,0.47,1.16,1.17,0.98],[1.2,0.98,2.04,1.06,2.08,1.84,0.49,0.63,1.07,1.24,0.94],[1.25,1.18,2.05,0.94,1.68,1.03,0.68,0.31,0.82,0.94,1.18],[1.19,1.08,1.83,0.92,1.99,1.24,0.65,0.49,1.12,1.09,1.03],[1.57,1.23,2.05,1.02,1.48,1.34,0.49,0.46,1.2,0.97,0.85],[1.23,1.3,1.4,0.83,1.79,1.55,0.35,0.37,1.07,1.45,0.77],[1.47,0.9,1.84,1.03,1.76,1.63,0.57,0.57,1.12,1.11,1.19],[1.31,1.11,1.83,1.16,2.34,1.4,0.55,0.66,0.82,1.35,0.67],[1.42,1.71,1.8,0.99,1.88,1.55,0.66,0.38,1.25,1.29,0.96],[0.77,1.93,2.02,1.24,1.17,1.39,0.57,0.62,1,1.04,1.06],[1.01,1,2.31,0.91,1.67,1.51,0.59,0.56,0.98,1.23,1.13],[1.14,0.9,2.43,0.99,2.12,1.25,0.62,0.43,0.91,1.02,0.67],[0.43,1.49,1.72,0.97,1.25,1.15,0.49,0.41,0.78,0.78,0.91],[0.64,1.53,1.67,0.96,1.1,1.81,0.56,0.61,0.74,1.13,0.92],[1.43,1.46,1.61,1.03,1.56,1.11,0.43,0.34,0.93,0.89,0.66],[1.44,1.49,1.49,0.97,1.64,1.17,0.5,0.55,0.98,1.21,0.99],[1.23,1.14,2.26,1.34,2.03,1.65,0.51,0.56,1.05,1.1,1],[1.12,1.49,1.8,1.06,1.61,1.08,0.66,0.44,0.81,1.04,0.95],[0.78,1.26,1.58,0.78,1.52,1.55,0.51,0.53,0.89,1.06,0.93],[0.89,0.96,2,0.97,1.71,1.42,0.67,0.46,0.78,1.09,1.05],[0.9,1.63,1.63,1.04,1.34,1.53,0.48,0.62,0.79,1.32,0.88],[0.87,1.39,1.6,1.07,1.41,1.39,0.47,0.56,0.88,0.99,0.95],[1.29,0.86,1.84,0.69,1.59,1.31,0.62,0.3,0.98,0.99,1.02],[1.26,0.76,1.91,0.97,1.33,1.07,0.61,0.47,1.07,0.94,1.09],[1.46,1.02,2.05,0.76,2.09,0.74,0.66,0.4,0.78,0.96,1.03],[1,1.45,1.83,1.01,1.55,1.09,0.59,0.38,0.89,1.15,1],[1.36,1.24,1.37,0.68,0.99,1.01,0.46,0.32,0.98,0.7,0.83],[1.23,1.08,2.26,0.81,1.68,0.93,0.63,0.47,1.18,0.68,1.2],[1.04,1.45,2.32,0.82,1.85,1.06,0.67,0.45,1.21,1.18,1.31],[1.08,1.58,2.07,1.46,1.24,1.62,0.49,0.44,1.05,0.91,1.03],[1.11,1.23,2.08,1.04,1.6,1.29,0.58,0.51,0.97,1.2,0.92],[1.33,1.41,1.97,1.27,1.82,1.87,0.52,0.49,0.97,1.19,0.81],[1.18,1.06,1.92,1.04,2.11,1.45,0.53,0.51,1.04,0.88,0.85],[1.09,1.51,2.11,1.1,1.72,1.67,0.5,0.56,1.36,1.05,0.93],[1.04,1.47,1.31,0.79,1.85,1.21,0.53,0.32,0.72,1.23,0.86],[1.3,1.72,1.59,1.17,1.89,1.68,0.48,0.56,1.32,1.41,0.89],[1.44,1.71,1.95,1.17,1.32,1.15,0.68,0.46,0.88,1.2,0.99],[1.18,1.35,1.89,1,1.72,1.2,0.57,0.44,1.01,1.02,0.98],[0.83,1.22,1.62,1.15,1.86,1.31,0.38,0.38,0.88,0.82,0.7],[1.19,1.31,1.85,1.01,2.04,1.43,0.6,0.54,1.21,1.32,0.88],[1.1,1.17,1.93,1,1.92,1.36,0.57,0.39,0.9,1.36,1.26],[1,1.22,2.07,1.03,1.46,1.47,0.53,0.51,0.83,1.01,1.07],[1.21,0.93,2.13,0.8,1.39,1.63,0.69,0.5,1,1.17,0.92],[1.31,1.17,1.51,1.05,1.52,1.11,0.49,0.32,0.83,0.97,1.23],[1.08,1.38,1.13,0.97,1.62,1.4,0.3,0.39,1.18,1.13,0.66],[1.13,1.23,2.1,0.74,1.93,1.46,0.67,0.52,0.83,1.03,0.93],[1.12,1.31,2.38,1.14,1.68,1.33,0.69,0.5,1.42,1.34,1.19],[0.66,1.46,1.37,1.11,1.74,1.16,0.31,0.54,0.8,0.88,0.81],[1.31,1.16,1.73,1.1,1.57,1.61,0.41,0.44,1.12,1.02,0.65],[1.3,1.25,1.64,0.87,1.84,1.45,0.57,0.49,1.27,1.2,1.18],[1.1,1.42,1.94,1.07,1.88,1.43,0.59,0.44,0.91,1.37,0.86],[0.98,1.48,1.61,1.15,1.61,1.38,0.48,0.4,0.81,1.23,1.35],[1.43,1.79,1.79,1.27,1.36,1.2,0.58,0.29,1.1,0.73,0.97],[1.15,1.11,1.99,0.82,1.49,1.41,0.57,0.4,0.47,0.79,0.9],[1.43,0.95,1.46,0.92,1.46,1.04,0.45,0.43,0.94,0.92,0.94],[0.96,1.18,1.66,1.02,1.6,1.31,0.57,0.54,0.97,1.29,1.1],[1.32,1.35,1.82,1.18,1.53,1.42,0.52,0.4,0.86,0.94,1.01],[1.31,1.36,2.06,0.94,1.57,1.66,0.65,0.55,0.93,1.53,0.91],[1.28,1.31,2.04,1.19,1.18,1.34,0.53,0.43,1.01,1.34,1.01],[1.41,0.98,2.01,0.92,1.83,1.28,0.69,0.46,0.86,1.22,0.9],[0.86,1.63,1.51,1.06,1.41,1.38,0.48,0.45,0.75,0.91,0.86],[1.15,1.02,1.93,0.77,1.86,1.62,0.59,0.37,1.15,1.01,0.9],[1.48,1.28,1.45,0.76,1.39,1.36,0.46,0.35,0.88,1.07,0.87],[1.18,1.85,1.48,0.94,1.51,1.28,0.57,0.33,0.73,0.9,0.96],[1.52,1.41,2.11,0.97,1.18,1.19,0.6,0.57,0.86,1.1,1.03],[0.86,1.75,1.9,1.32,1.51,1.22,0.54,0.57,0.84,1.2,0.98],[1.27,1.55,1.47,1.11,1.6,1.18,0.56,0.59,0.81,1.22,0.74],[1.23,1.78,1.58,1.25,1.4,1.34,0.46,0.5,0.98,1.01,1.02],[1.27,1.14,2.04,1.06,1.42,1.45,0.61,0.45,1.03,1.21,0.99],[1.36,1.38,1.93,0.87,1.34,1.34,0.7,0.56,0.89,1.02,1.18],[0.93,1.36,1.86,0.68,1.93,1.64,0.56,0.44,1.17,1.53,0.92],[1.23,1.3,1.79,0.84,1.69,1.15,0.54,0.47,1.01,1.14,0.95],[1.47,1.15,1.84,1.02,1.66,1.46,0.55,0.62,1.14,1.1,1.12],[1.23,1.38,1.73,0.91,1.94,1.37,0.41,0.28,0.93,1.04,0.58],[1.35,0.77,1.42,0.76,1.91,1.1,0.45,0.28,0.88,1.13,0.82],[1.35,1.2,1.81,0.64,1.89,1.59,0.49,0.39,1.11,1.23,0.92],[1.03,1.46,1.1,1.05,1.54,1.18,0.47,0.51,0.67,1.11,0.87],[1.03,1.24,2.15,0.92,1.27,1.82,0.55,0.64,1.01,1.32,0.86],[0.86,1.44,2.41,1.15,2.25,1.48,0.55,0.56,1.44,1.09,1.06],[1.2,1.44,2.07,0.98,1.82,1.42,0.63,0.59,0.97,1.24,0.99],[1.31,1.22,1.52,0.99,1.08,1.17,0.59,0.34,0.72,0.98,0.74],[0.65,1.25,1.61,0.86,1.62,1.29,0.51,0.39,1,1.07,0.8],[1.15,1.36,2.46,1.21,1.76,1.64,0.48,0.43,0.8,0.93,1.1],[1.3,1.13,1.68,1.08,1.32,1.28,0.65,0.41,0.93,0.93,0.93],[0.96,1.17,1.66,1.14,1.48,1.12,0.52,0.35,0.94,1.23,0.97],[1.13,1.24,2.12,0.95,1.42,1.09,0.75,0.45,0.85,1.25,1.06],[1.62,1.43,1.45,1,1.43,1.14,0.45,0.46,0.87,0.82,0.85],[1.22,1.06,1.92,1.06,1.76,1.52,0.61,0.58,0.68,1.27,0.8],[1.45,1.4,1.62,0.87,1.71,1.53,0.5,0.44,1.38,0.98,1.07],[1.52,1.53,1.8,1.06,1.47,1.24,0.71,0.62,1.02,1.24,0.96],[1.11,1.4,1.8,1.06,1.69,1.55,0.6,0.49,0.77,1.23,0.97],[1.28,1.33,1.52,0.45,1.46,1.02,0.62,0.37,0.7,1.04,1.1],[1.03,1.46,1.8,0.74,1.54,1.64,0.53,0.53,0.99,1.3,0.7],[0.93,1.79,1.77,1.23,2.36,1.83,0.35,0.63,1.17,1.09,0.6],[1.06,1.32,1.47,1.01,1.42,1.68,0.38,0.49,1.14,0.84,0.88],[1.2,1.26,1.7,0.79,1.34,1.4,0.55,0.4,0.76,1.02,0.85],[1.22,0.98,1.44,0.82,1.55,0.83,0.43,0.34,0.85,0.53,0.8],[1.16,1.57,1.59,0.76,1.67,1.41,0.55,0.42,1.1,0.84,0.64],[1.19,1.2,1.72,0.89,1.74,1.15,0.66,0.5,1.03,1.27,1.14],[1.06,1.26,1.03,1.13,1.58,1.23,0.31,0.5,1.06,0.44,0.62],[0.93,1.41,1.25,1.04,1.35,1.37,0.5,0.42,0.83,1.31,0.93],[1.11,1.3,1.81,1.23,1.68,1.89,0.43,0.62,1.03,1.5,0.82],[1.34,1.31,2.07,1.18,1.52,1.14,0.61,0.44,0.97,1.21,1.2],[0.72,1.31,1.93,1.15,2.08,1.77,0.5,0.52,1.04,0.98,0.89],[1.19,1.28,1.52,1.08,1.71,1.02,0.54,0.49,0.98,0.73,0.88],[1.19,1.47,2.63,1.14,1.7,1.39,0.72,0.51,1.04,1.14,0.87],[1.05,1.06,1.44,0.77,1.88,1.16,0.46,0.49,1.11,1.04,1.02],[1.48,1.33,1.39,0.74,1.45,1.14,0.5,0.48,0.87,0.73,0.88],[1.28,1.31,2.4,0.76,1.35,1.53,0.7,0.44,1.3,1.1,1.13],[1.25,1.4,1.41,1.04,1.71,1.8,0.47,0.53,0.8,1.31,0.84],[1.54,1.15,1.4,1.02,0.99,0.96,0.61,0.44,0.93,1.22,1.13],[1.01,1.03,1.33,0.74,1.6,0.87,0.5,0.42,1.19,0.72,0.84],[1.41,1.15,1.11,0.97,1.19,0.99,0.45,0.4,0.9,1.07,1.03],[1.23,1.31,2.03,0.95,0.8,1.1,0.7,0.29,1.1,0.9,1.27],[0.91,1.32,1.45,0.92,1.66,1.67,0.41,0.53,0.98,0.91,1.02],[1.15,1.03,2.24,1.05,2.22,1.52,0.52,0.53,0.99,1.21,1.12],[1.02,1.3,1.34,1.11,1.74,1.3,0.4,0.47,1.06,1.05,0.82],[0.94,1.6,1.51,1,1.42,1.46,0.42,0.6,1.04,1.17,0.73],[1.21,1.16,2.54,0.89,1.87,1.22,0.69,0.65,1.2,1.13,1.11],[1.19,0.85,1.92,0.61,1.25,1,0.61,0.35,1.07,0.88,1.15],[1.4,1.27,1.87,1.04,2,1.65,0.54,0.56,1.09,1.12,1.07],[0.92,1.87,1.56,0.97,1.45,0.92,0.58,0.49,1.06,0.88,0.69],[1.09,0.83,2.16,1.07,1.94,1.69,0.43,0.64,0.94,1.11,0.74],[1.05,1.22,1.29,1.12,1.41,1.26,0.43,0.63,0.84,1.14,0.95],[1.3,1.3,1.78,1.02,1.18,1.7,0.48,0.53,0.77,1.37,1.08],[1.41,1.44,1.73,0.77,1.42,1.36,0.59,0.43,1.12,1.04,1.04],[1.57,1.47,1.91,0.87,1.91,1.35,0.69,0.4,1.07,1.43,1.01],[1.07,1.18,2.25,1.09,1.48,1.19,0.71,0.58,0.92,1.18,1.18],[1.2,1.15,2.13,0.96,1.3,1.63,0.64,0.47,0.93,1.06,0.95],[1.1,1.36,1.89,0.87,1.42,1.03,0.57,0.43,1.06,0.9,0.89],[1.21,1.06,1.22,0.51,1.41,1.12,0.41,0.28,1.16,0.87,0.79],[1.13,1.6,1.91,1.3,1.3,1.28,0.53,0.5,0.89,1.05,1.1],[1.04,1.26,1.61,0.93,1.6,1.22,0.58,0.48,1.03,1.02,1.19],[1.39,1.25,2.03,1,1.57,1.4,0.52,0.46,1.03,1.09,0.96],[1.61,1.48,1.7,1.06,1.22,0.9,0.59,0.43,0.95,0.77,1.17],[1.49,1.17,1.4,0.91,1.91,1.51,0.47,0.39,0.9,1.15,0.71],[1,1.27,2.15,0.93,1.78,1.82,0.55,0.62,0.9,1.24,0.97],[1.03,0.98,1.69,1.06,1.38,1.6,0.4,0.39,0.83,1.27,1.08],[1.44,1.45,1.59,0.99,1.6,1.08,0.6,0.45,0.84,1.11,0.83],[0.96,1.21,1.42,1.12,1.93,1.77,0.31,0.47,1.08,1.11,0.61],[1.45,1.93,1.29,0.95,0.77,1.28,0.54,0.53,0.83,1,1.47],[0.94,1.15,1.91,0.94,1.8,1.56,0.5,0.3,1.11,1.02,0.75],[1.29,0.88,1.7,0.68,1.87,1.19,0.59,0.54,0.99,0.96,1.11],[1.55,0.96,2.15,0.99,1.54,1.24,0.69,0.44,1.06,1.23,1.07],[1.24,1.17,1.63,0.51,1.56,0.98,0.66,0.36,0.81,0.87,1.24],[1.36,1.27,1.74,1.07,1.96,1.72,0.32,0.58,0.96,1.29,0.71],[1.36,1.3,1.61,1.15,1.55,1.27,0.42,0.49,0.9,1.01,1.01],[1.39,1.39,1.72,0.79,1.74,0.86,0.64,0.28,1.17,0.81,1.22],[1.28,1.34,1.96,0.84,1.95,1.33,0.65,0.4,1.06,1.16,0.99],[0.88,1.37,1.52,1.08,1.4,1.17,0.51,0.46,0.69,1.29,1.23],[1.32,1.37,1.72,1.11,1.52,1.18,0.63,0.45,0.79,1.23,0.94],[0.55,1.18,1.57,1.16,2.09,1.38,0.4,0.51,0.95,0.85,0.83],[1.03,1.13,1.83,1.29,1.89,1.61,0.59,0.53,1.01,1.37,0.9],[1.49,1.17,2.03,0.9,1.43,1.4,0.71,0.5,0.9,1.4,1.13],[1.06,1.29,1.81,1.18,1.52,1.5,0.55,0.48,0.86,1.12,0.75],[0.87,1.15,1.1,1.17,1.83,1.44,0.31,0.42,1.01,1.55,0.62],[1.29,1.14,1.54,0.82,1.93,1.32,0.4,0.46,0.99,1,1.06],[1.37,1.2,2.7,1.32,1.64,1.75,0.63,0.64,1.03,0.96,0.93],[1.29,1.09,2.04,0.91,1.48,1.68,0.48,0.47,1.11,0.79,1.12],[1.27,1.25,2.23,0.85,1.76,1.44,0.67,0.47,0.79,1.28,1.5],[0.92,1.56,2.03,1.12,1.45,1.65,0.51,0.48,1.03,1.33,0.82],[1.54,0.99,1.98,0.7,2.11,1.46,0.56,0.56,1.03,1.34,0.96],[1.25,1.62,1.29,1.11,1.45,1.4,0.46,0.38,0.72,1.09,0.89],[1.06,1.04,1.79,0.82,1.83,0.97,0.67,0.33,0.81,1.11,0.97],[1.78,1.11,1.86,0.86,1.21,1.19,0.67,0.39,1.03,1.14,1.05],[1.34,1.47,1.86,1.31,2.01,1.08,0.6,0.56,1.19,1.14,1.08],[1,1.39,2.17,1.08,1.44,1.47,0.56,0.53,1.09,1.03,1.09],[1.35,1.06,2.2,1.12,1.14,1.39,0.71,0.52,0.86,1.3,1.02],[1.04,1.46,1.38,1.17,1.47,1.38,0.37,0.47,0.78,1.04,0.78],[1.4,1.15,1.8,1.17,1.35,1.73,0.42,0.55,1.07,1.11,0.97],[1.21,1.48,2.1,1.03,1.51,1.65,0.56,0.49,0.94,1.13,0.93],[0.99,0.8,0.85,0.68,1.8,1.41,0.32,0.42,0.87,0.87,0.81],[1.46,1.53,1.72,0.88,0.77,1.39,0.59,0.44,0.93,1.27,0.99],[1.15,1.35,1.99,0.89,1.69,1.32,0.67,0.51,0.9,1.23,1.05],[1.2,1.27,1.79,1.06,1.56,1.23,0.67,0.52,0.83,1,1.28],[1.31,1.31,1.95,1.09,1.41,1.3,0.47,0.43,1.04,1.12,0.63],[1.28,1.15,2.23,1.15,1.8,1.4,0.67,0.49,1.06,0.91,1.14],[1.15,1.15,2.45,1.12,1.53,1.21,0.58,0.54,0.93,1.32,1.14],[1.5,1.96,1.78,1.31,0.94,1.61,0.53,0.49,1.06,1.51,1],[0.98,1.52,1.86,0.91,1.47,1.25,0.62,0.57,0.99,1.22,1.22],[1.34,1.16,1.94,0.95,1.74,1.33,0.63,0.55,1,1.11,0.87],[1.08,1.26,2.07,1.1,1.43,1.23,0.57,0.47,0.82,1.17,1.17],[1.39,1.46,1.79,1.13,1.74,1.38,0.48,0.48,0.83,0.81,0.92],[1.11,1.21,2.31,1.01,1.54,1.7,0.61,0.57,1.03,1.19,1.17],[1.12,1.51,1.66,1.09,1.85,1.48,0.47,0.43,0.93,0.84,0.84],[1.43,0.99,2.07,1.11,1.72,1.42,0.54,0.55,1.31,1.4,0.51],[1.48,1.3,1.72,1.01,1.79,1.58,0.5,0.42,0.78,1.29,0.86],[1.32,1.15,2.05,0.97,1.66,1.19,0.66,0.53,0.74,0.69,1.1],[1.19,1.68,1.59,1.03,1.44,1.56,0.57,0.42,0.95,1.45,0.88],[1.37,1.33,2.01,1.03,1.58,1.38,0.62,0.49,1.08,1.02,1],[1.31,0.97,1.44,0.88,0.84,1.26,0.45,0.51,0.94,1.09,1.02],[0.83,1.56,1.86,1.1,1.21,1.15,0.58,0.45,1.16,1.14,0.99],[1.35,1.35,2.36,0.89,0.73,1.06,0.79,0.49,1.1,1.22,1.06],[0.91,1.1,2.65,0.91,2.18,1.65,0.6,0.53,1.18,1.21,1.09],[1.42,1.54,2.11,1.13,1.8,1.6,0.57,0.56,1.08,1.4,0.69],[1.17,0.96,1.81,0.96,1.92,0.98,0.68,0.55,0.75,0.88,0.9],[1.26,0.87,2.03,1.22,1.49,1.34,0.62,0.46,1.25,1.14,0.88],[0.91,1.02,1.79,1.04,1.69,1.63,0.56,0.44,0.69,1.3,0.89],[1.57,1.43,2.1,1.06,2.05,1.21,0.64,0.43,0.91,1,0.93],[1.35,0.98,1.58,1.11,1.52,1.34,0.52,0.53,1.01,1.04,0.84],[1.21,1.03,1.61,0.87,1.31,1.15,0.5,0.49,0.7,1.02,0.87],[1.25,1.33,2.03,1.06,2.36,1.67,0.48,0.52,0.92,1,1.02],[1.1,1.48,2.19,1.34,1.85,1.65,0.6,0.69,1.14,1.21,1],[1.27,1.45,1.53,1.17,1.09,1.58,0.47,0.54,0.7,0.8,0.68],[1.08,1.43,1.33,1.07,1.63,1.44,0.36,0.42,1,1.03,0.51],[1.46,1.28,1.93,1.01,1.56,1.65,0.61,0.41,1.07,1.31,1.08],[1.19,1.35,1.62,1.21,1.34,1.48,0.48,0.39,1.12,1.07,0.93],[1.47,1.69,1.79,1.07,2.05,1.69,0.56,0.46,0.94,1.38,0.88],[1.32,1.34,2.08,1.13,2.32,1.7,0.65,0.55,0.94,1.57,1.05],[1.19,1.16,2.04,1.13,2,1.52,0.61,0.45,1.03,1.27,1.17],[1.17,1.38,2.18,1.17,1.77,1.57,0.45,0.44,1.09,1.12,0.69],[0.98,1.68,1.84,1.05,1.55,0.86,0.61,0.52,1.04,0.93,0.99],[0.98,0.96,1.15,0.74,1.08,0.86,0.48,0.32,0.75,0.73,1.06],[1.53,1.68,1.99,1.02,1.27,1.42,0.63,0.5,1.02,1.4,0.89],[1.21,1.36,1.74,1.02,1.33,1.32,0.54,0.46,0.81,1.14,1.24],[1.35,1.69,1.88,0.9,1.29,0.99,0.66,0.38,0.97,1.35,0.96],[1.05,0.79,1.39,1.06,1.42,1.13,0.47,0.44,1.05,0.79,1.05],[1.41,1.62,1.99,1.01,1.79,1.54,0.62,0.6,0.76,1.39,0.99],[0.94,1.09,2.5,1.13,1.59,0.99,0.63,0.45,1.02,1.08,0.96],[1.51,1.32,1.21,0.85,1.93,1.64,0.46,0.42,0.82,1.34,0.95],[1.45,1.43,1.3,1.06,1.64,1.34,0.49,0.43,0.41,1.51,1.02],[1.37,1.62,1.84,0.87,1.8,1.29,0.63,0.33,0.93,0.81,1.11],[1.24,1.46,1.98,1.18,1.12,1.45,0.6,0.46,0.71,0.97,1.03],[1.42,1.28,2.05,0.93,1.36,1.28,0.68,0.45,0.94,1.11,1.27],[1.13,1.55,1.57,0.97,1.28,1.25,0.56,0.48,0.76,1.03,0.98],[1.2,1.12,1.59,0.98,1.41,1.17,0.59,0.41,0.73,1.23,0.92],[1.36,1.67,1.65,0.85,1.89,0.89,0.6,0.44,0.86,0.91,0.85],[0.83,1.22,1.59,1.04,1.44,1.69,0.37,0.56,0.97,1.23,0.99],[1.37,1.25,1.86,0.88,1.58,1,0.58,0.37,1.09,0.76,0.97],[0.99,1.32,2.8,1.11,1.67,1.68,0.67,0.69,1.06,1.27,1.21],[1.39,1.4,2.19,1.13,1.84,1.44,0.51,0.55,1.17,1.4,0.92],[1.11,1.18,1.81,0.98,1.54,1.29,0.59,0.44,1.09,1.08,1],[1.3,1.71,1.55,1.18,1.31,1.36,0.5,0.47,0.84,0.91,1.03],[1.19,1.37,2.21,1.11,1.43,1.73,0.62,0.52,1.23,1.31,0.97],[1.59,1.28,2.08,1.07,1.65,1.42,0.69,0.53,1.07,1.4,0.91],[1.37,0.93,1.69,0.69,1.59,0.87,0.71,0.33,0.88,1.36,1.19],[1.24,1.57,2.28,1.05,1.78,1.27,0.68,0.62,1.05,1.09,0.98],[1.38,1.34,2.13,0.82,1.56,1.05,0.74,0.51,1.04,1.22,1.26],[1.18,1.44,1.7,1.06,1.9,1.83,0.43,0.44,0.98,1.37,0.57],[1.29,1.35,1.81,0.64,1.72,1.35,0.5,0.45,1.01,0.99,0.88],[1.27,0.8,1.9,0.93,2.09,1.15,0.57,0.51,1.04,1.08,0.95],[1.17,1.32,2.19,1.13,1.89,1.56,0.62,0.52,1.09,1.24,1.08],[1.52,1.24,1.56,1.01,1.36,1.61,0.53,0.53,0.82,1.09,1.11],[1.36,1.15,1.64,0.73,1.65,0.68,0.67,0.34,1.1,0.77,1.1],[1.25,1.58,1.63,1.11,1.36,1.35,0.5,0.53,1.11,1.16,1.14],[0.98,1.06,2.34,0.76,1.24,1.68,0.65,0.59,0.93,1.2,0.72],[0.91,1.52,1.32,0.92,1.79,0.97,0.44,0.48,0.91,1.06,0.9],[1.55,1.58,2,0.91,1.54,1.35,0.67,0.52,1.02,1.33,1.12],[1.15,1.49,1.8,1.09,1.89,1.28,0.53,0.56,1.06,1.08,0.95],[1.18,1.02,1.97,0.91,1.61,1.34,0.46,0.49,0.96,1.13,0.88],[0.93,1.09,2,0.97,1.58,1.47,0.49,0.55,1.03,1.37,0.55],[1.11,0.91,2.18,0.69,1.71,1.42,0.64,0.51,0.97,1.2,1.07],[0.83,1.11,2.1,1.08,1.88,1.63,0.49,0.53,1.15,1,0.87],[1.52,1.23,1.52,0.79,1.74,1.02,0.51,0.38,1.04,1.01,1.03],[0.9,1.29,2.3,0.93,1.78,1.39,0.58,0.51,1.05,1,1.11],[1.31,1.04,2.05,0.97,1.53,1.24,0.58,0.38,0.9,0.98,0.97],[0.95,1.19,1.98,1.15,1.78,1.1,0.49,0.53,0.69,0.97,1.02],[1.27,1.12,1.77,1.13,1,0.93,0.57,0.35,1.09,1.17,0.77],[1.04,1.28,1.56,0.74,1.6,1.14,0.53,0.39,1.3,0.83,1.08],[1.65,1.08,1.29,1.03,1.87,1.16,0.54,0.54,1,0.88,0.97],[1.04,0.95,1.78,0.97,1.66,1.58,0.52,0.54,1.23,1.29,1.04],[1,1.34,2.06,1.06,1.79,1.7,0.49,0.51,0.83,1.14,0.94],[0.82,0.71,1.66,0.86,1.49,1.55,0.4,0.31,1.02,0.98,0.64],[1.31,1.1,1.98,0.51,1.75,1.12,0.6,0.41,0.88,0.95,1.26],[0.96,1.47,2.48,0.92,2.11,1.59,0.61,0.55,1.29,1.05,1.12],[1,1.36,1.81,1.23,1.61,1.31,0.49,0.54,0.97,0.9,0.9],[0.56,1.43,1.96,1.04,1.19,1.13,0.61,0.45,0.78,0.89,0.94],[0.81,0.97,2.11,1.27,2.26,1.59,0.54,0.51,1.23,1.25,0.99],[1.2,1.03,1.63,1.07,1.89,1.51,0.51,0.44,1.06,1.44,1.15],[1.07,1.65,1.62,1.14,2.23,1.7,0.38,0.46,1.27,1.26,0.67],[1.2,1.3,2.23,1.13,1.77,1.05,0.65,0.43,1.05,0.89,0.89],[1.07,1.32,2.02,1.14,1.85,1.49,0.47,0.46,1.15,1.23,0.73],[1.63,1.11,2.11,0.88,1.59,1.26,0.67,0.46,1.07,1.05,1],[1.6,1.32,1.62,1.06,1.75,1.44,0.45,0.49,1.21,1.09,1.17],[0.92,0.85,2.27,1.23,1.63,1.65,0.56,0.54,0.99,1.48,0.99],[1.18,1.59,1.7,1.16,1.4,1.38,0.54,0.55,0.89,1.46,0.71],[1.03,1.25,1.31,0.76,1.71,1.32,0.43,0.47,0.87,1.24,0.84],[1.36,1.34,2.06,0.95,1.59,1.33,0.6,0.47,0.97,1.3,1.14],[1.53,1.01,2.09,1.1,1.8,1.4,0.52,0.42,0.89,1.46,0.9],[1.01,1.37,1.52,1.07,1.64,1.65,0.35,0.4,0.88,0.65,0.82],[1.67,1.24,1.21,1.05,1.66,1.08,0.49,0.52,1.14,1.17,0.92],[1.16,1.27,2.02,0.9,1.62,1.15,0.64,0.55,0.81,1.28,1.21],[1.54,1.47,1.89,1.15,1.62,1.5,0.55,0.48,0.94,0.91,0.79],[1.47,1.4,1.77,1.18,1.55,1.71,0.49,0.41,0.73,1.26,1],[0.83,1.2,1.33,1.1,1.8,2.01,0.27,0.5,0.95,1.42,0.69],[1.14,0.76,1.89,1.19,1.76,1.36,0.43,0.51,0.97,0.83,0.73],[0.94,0.98,1.2,0.95,1.65,1.63,0.3,0.44,1.15,1.06,0.74],[1.09,1.18,1.94,0.85,1.51,1.04,0.61,0.4,0.99,1.02,0.91],[1.03,1.49,2.09,1.01,1.69,1.27,0.59,0.56,0.77,1.03,0.91],[1.18,1.53,2.05,1.52,1.57,1.07,0.65,0.67,1.04,1.15,0.94],[1,1.61,2.23,1.25,1.55,1.68,0.5,0.56,0.93,1.43,1.12],[1.65,1.62,2.45,1.09,1.78,1.49,0.81,0.37,0.89,1.5,0.96],[1.45,1.16,2.09,0.78,1.21,1.45,0.68,0.48,1.05,1.23,0.75],[1.44,1.45,1.35,1.15,1.48,1.12,0.45,0.46,1.04,1.07,0.89],[0.96,1.61,1.54,0.93,1.65,1.35,0.5,0.51,0.9,1.05,0.84],[1.1,1.77,1.43,0.94,1.77,1.5,0.45,0.44,0.76,0.69,0.8],[1.37,1.46,2.19,0.76,1.06,1.38,0.71,0.4,0.84,0.97,0.98],[1.22,1.01,2.23,0.97,2.24,1.29,0.55,0.47,1.04,0.94,0.83],[1.14,1.28,1.83,1.3,1.38,1.22,0.47,0.51,1.04,1.09,0.66],[1.37,1.11,1.88,1.04,1.49,1.73,0.47,0.5,0.96,1.16,0.98],[1.09,1.26,1.69,1.15,1.81,1.26,0.61,0.49,0.99,1.44,0.94],[1.05,1,2.01,1.1,1.76,1.85,0.57,0.59,0.89,1.22,1.01],[1.47,1.58,2.39,0.98,1.36,1.25,0.72,0.45,0.74,0.85,0.81],[1.1,1.51,2.12,1.21,1.36,1.34,0.54,0.55,1.06,1,1.05],[0.74,1.34,2.28,0.83,1.42,1.2,0.65,0.46,0.74,0.93,0.95],[1.03,1.35,1.52,1.04,1.21,1.12,0.59,0.45,0.8,0.85,0.98],[0.69,1.33,1.84,0.94,1.85,1.76,0.45,0.58,1,1.45,0.95],[1.61,1.14,1.69,0.71,1.81,1.51,0.58,0.51,1,1.26,0.97],[1.41,1.24,1.84,1.05,0.85,0.97,0.67,0.44,0.71,0.72,1.19],[1.59,1.29,1.94,1.11,1.45,1.52,0.43,0.58,0.84,1.04,0.93],[1,1.58,1.42,0.91,1.69,0.83,0.46,0.42,0.73,0.99,0.52],[1.32,1.23,1.8,0.72,1.82,1.03,0.58,0.49,1.04,1.01,0.88],[1.2,1.61,1.41,1.09,1.51,1.51,0.4,0.45,1.04,1.12,0.77],[1.29,1.29,2.1,0.92,2.39,1.29,0.59,0.47,1.07,1.03,1.24],[1.2,1.38,1.63,0.97,1.35,1.26,0.5,0.48,1,0.88,0.67],[1.37,1.35,1.93,1.03,1.76,1.66,0.61,0.53,0.85,1.3,0.94],[1.67,1.21,1.67,0.99,1.66,1.01,0.63,0.43,1,1.16,0.74],[1.46,1.07,2.04,0.93,1.66,1.15,0.63,0.39,1.07,1.22,0.96],[1.27,1.1,1.84,1.2,1.69,1.19,0.53,0.45,0.91,0.72,1.06],[1.36,1.53,1.79,1.22,1.47,1.11,0.55,0.42,1.06,1.07,0.88],[1.1,1.07,1.92,1.31,1.51,1.72,0.4,0.55,0.97,1.07,0.89],[1.44,1.6,1.6,0.86,1.57,1.03,0.64,0.28,1.01,1.22,1.04],[1.6,1.32,1.7,0.72,1.33,1.25,0.69,0.46,0.81,1.16,1.06],[0.99,1.38,1.65,1.19,1.78,1.36,0.52,0.44,1.2,1.13,0.99],[1.37,1.69,1.97,0.92,1.82,1.39,0.54,0.42,1,0.94,1.2],[1.29,1.04,2.12,1.34,1.77,1.48,0.54,0.56,0.91,1.03,1.08],[1.05,1.46,1.9,1.25,1.84,1.59,0.49,0.56,0.7,1.32,0.98],[0.92,1.81,1.93,1.2,1.98,1.91,0.42,0.68,1.23,1.51,0.94],[1.27,1.34,0.99,0.88,1.31,1.4,0.41,0.19,1.09,0.9,0.73],[1.33,1.22,2.18,1.07,1.95,2.21,0.45,0.71,1.14,1.47,0.75],[1.31,1.4,2.25,1.34,1.7,1.7,0.47,0.55,1.09,1.27,0.7],[1.17,1.52,1.64,1.1,1.59,1.59,0.63,0.47,0.7,1.23,1.21],[1.21,1.31,1.55,0.86,1.85,1.36,0.57,0.5,0.92,0.97,0.83],[1.27,1.48,1.71,1.02,1.57,1.2,0.52,0.4,0.71,1.12,0.81],[0.94,1.14,2,0.81,1.9,1.41,0.52,0.41,1.19,1.26,1.17],[0.9,1.51,1.41,1.22,1.51,1.52,0.47,0.35,1.36,1.13,0.9],[1.11,1.29,1.99,1.12,1.93,1.35,0.53,0.48,1.15,1.14,0.87],[0.81,1.33,1.86,1.1,1.76,1.58,0.54,0.53,1.05,1.29,0.88],[1.38,1.27,1.5,1.1,1.41,1.33,0.43,0.38,0.59,1.19,0.77],[1.06,1.05,1.94,0.89,1.56,1.31,0.52,0.45,1.14,1.01,0.7],[1.01,1.55,1.33,0.83,1.9,1.38,0.38,0.59,0.67,1.29,0.76],[1.14,1.69,1.55,1.01,1.52,1.36,0.62,0.35,0.57,1.09,0.9],[1.3,1.28,2.32,0.92,1.76,1.42,0.74,0.61,1.18,1.1,1.04],[0.75,1.3,1.7,0.96,0.88,0.99,0.63,0.36,1.07,1.02,1.19],[1.04,1.22,2.27,1.29,1.47,1.24,0.55,0.49,1.18,1.1,1.16],[0.88,1.51,1.84,1.22,1.97,1.81,0.46,0.56,1.22,1.3,0.87],[1.42,1.42,1.22,0.81,1.35,1,0.5,0.16,0.81,0.64,1.07],[1.07,1.02,1.73,1.06,1.77,1.59,0.37,0.45,0.99,1.29,0.78],[1.18,1.23,1.56,1.14,2.06,1.59,0.48,0.46,1.19,1.3,1.15],[0.98,1.06,1.9,1.3,1.61,1.31,0.43,0.64,0.97,1.36,0.86],[1.17,1.28,1.6,0.79,1.7,1.05,0.49,0.39,1.28,0.98,0.74],[0.91,1.32,1.97,0.8,1.52,1.33,0.47,0.59,1.02,1.45,1.07],[1.15,1.49,1.58,0.91,1.47,1.3,0.54,0.47,1.04,0.79,0.75],[1.19,1.1,1.93,0.72,2.17,1.09,0.63,0.5,0.92,1.01,0.92],[1.27,1.13,1.48,0.74,1.86,0.98,0.51,0.45,1.09,0.92,1.02],[1.03,1.47,1.44,1.15,1.5,0.84,0.49,0.31,0.9,0.96,0.63],[1.45,1.6,2.49,1.26,1.4,1.3,0.8,0.41,1.05,1.37,1.36],[0.75,1.46,1.95,1.12,2.12,1.86,0.41,0.61,0.79,1.32,0.79],[1.42,1.26,1.85,1.06,1.55,1.66,0.44,0.55,0.83,1.35,0.7],[0.98,1.03,1.43,0.87,2.02,1.64,0.36,0.53,0.98,1.27,0.75],[1.08,1.3,2.01,1.17,1.88,1.21,0.52,0.42,1.08,1.02,1.07],[1.11,1.23,2.21,0.83,1.6,1.58,0.64,0.37,1.1,1.39,1.01],[1.59,1.3,2.23,0.86,1.31,0.95,0.72,0.41,0.81,1.01,1.04],[1.62,1.45,1.77,1.04,1.24,1.1,0.71,0.36,0.97,1.07,1.11],[1.26,1.17,1.45,0.88,1.58,0.99,0.52,0.52,0.69,1.25,0.95],[1.06,1.66,2.32,1.31,1.97,1.7,0.47,0.69,0.97,1.52,0.72],[1.35,1.05,1.94,1.09,2.29,1.79,0.51,0.68,1.22,1.44,1.02],[1.04,1.6,2.14,1.16,1.87,1.57,0.52,0.36,0.97,1.03,0.9],[1.23,1.23,2.04,0.91,1.2,1.66,0.63,0.47,1.08,0.77,0.96],[1.23,1.49,1.73,0.84,1.18,1.12,0.7,0.39,0.84,0.97,1.1],[1.16,1.05,1.67,0.97,1.39,1.3,0.49,0.43,0.97,0.71,0.74],[1.12,0.86,1.59,0.78,1.24,1.44,0.46,0.38,1.06,0.98,1.37],[0.82,1.25,1.99,1.13,1.48,1.88,0.56,0.49,0.55,0.87,0.96]],"pcor":[[1,-0.05,-0.2,0.09,-0.02,0,0.33,-0.09,0.03,0.05,-0.03],[-0.05,1,-0.19,0.3,-0.03,0.09,0.19,0,-0.02,-0.02,-0.06],[-0.2,-0.19,1,0.26,0.24,0.3,0.7,0.17,0.24,-0.12,-0.03],[0.09,0.3,0.26,1,-0.19,0,-0.31,0.23,0.02,0.06,0],[-0.02,-0.03,0.24,-0.19,1,0.01,-0.22,0.07,0.16,0.16,-0.03],[0,0.09,0.3,0,0.01,1,-0.41,0.23,-0.01,0.4,-0.02],[0.33,0.19,0.7,-0.31,-0.22,-0.41,1,0,-0.14,0.21,0.3],[-0.09,0,0.17,0.23,0.07,0.23,0,1,-0.04,0.13,0.06],[0.03,-0.02,0.24,0.02,0.16,-0.01,-0.14,-0.04,1,0.01,0],[0.05,-0.02,-0.12,0.06,0.16,0.4,0.21,0.13,0.01,1,0],[-0.03,-0.06,-0.03,0,-0.03,-0.02,0.3,0.06,0,0,1]],"cor":[[1,0.01,0,-0.08,-0.14,-0.2,0.33,-0.15,-0.06,0.01,0.13],[0.01,1,-0.07,0.28,-0.11,0.07,0.01,0.07,-0.06,0.04,-0.04],[0,-0.07,1,0.13,0.21,0.18,0.57,0.34,0.25,0.19,0.25],[-0.08,0.28,0.13,1,-0.03,0.29,-0.2,0.34,0.08,0.15,-0.1],[-0.14,-0.11,0.21,-0.03,1,0.26,-0.13,0.19,0.26,0.22,-0.09],[-0.2,0.07,0.18,0.29,0.26,1,-0.31,0.44,0.14,0.44,-0.16],[0.33,0.01,0.57,-0.2,-0.13,-0.31,1,0.01,-0.03,0.06,0.46],[-0.15,0.07,0.34,0.34,0.19,0.44,0.01,1,0.11,0.33,0.04],[-0.06,-0.06,0.25,0.08,0.26,0.14,-0.03,0.11,1,0.08,-0.02],[0.01,0.04,0.19,0.15,0.22,0.44,0.06,0.33,0.08,1,0.02],[0.13,-0.04,0.25,-0.1,-0.09,-0.16,0.46,0.04,-0.02,0.02,1]],"pairs":[{"a":"liver","b":"spleen","paper":0.42,"r":0.44,"pr":0.4,"xy":[0.66,1.76,0.29,1.09,-0.45,0.49,-0.97,-0.14,0.59,0.29,0.02,0.06,0.02,-0.48,-0.18,-0.34,0.03,-2.43,-0.5,-2.51,-0.41,-0.11,-0.3,-0.06,1.04,0.65,0.47,0.18,-1.51,0.16,-0.64,0.82,0.76,-0.38,0.44,-0.62,1.66,0.37,0.71,0.23,2.63,1.16,2.02,1.04,0.95,0.25,0.91,0.42,0.88,0.09,0.74,0.05,-0.52,0.66,-0.89,0.34,1.55,0.5,1.61,0.31,0.33,-0.65,1.1,-0.74,0.02,0.01,0.14,0.13,1.57,1.27,0.35,0.65,0.29,1.64,0.07,1.6,0.28,-0.33,0.47,-0.63,-0.44,-0.77,0.12,-0.47,0.74,1.68,0.38,1.21,-1.25,0.12,-0.44,0.49,-0.04,-0.19,0.8,0.32,-0.53,-0.68,-1.16,-0.71,0.57,-0.44,-0.32,-0.6,-0.44,-0.32,-0.01,-0.21,-0.2,1.4,0.42,1.44,-0.06,-0.46,0.47,0.1,0.72,-0.52,0.21,-0.43,-0.54,-0.02,-0.32,-0.15,-0.18,-0.79,-0.07,-0.36,-0.34,-2.52,-0.47,-1.73,0.39,-0.57,0.73,-0.32,-0.52,-0.11,-1.45,-0.48,-1.35,1.16,-0.41,1.4,-0.04,1.15,0.08,1.26,0.74,1.18,0.5,1.09,0.55,3.28,0.5,2.22,1.81,0.16,0.62,-0.67,1.22,0.62,0.91,0.54,1.16,1.03,0.37,0.74,0.7,0.57,-0.28,0.33,0.6,0.82,0.59,0.64,1.33,1.48,0.32,0.37,-0.53,-0.72,0.01,-0.6,0.68,0.62,1.34,1.2,-1.45,-2.28,-1.26,-2.33,-0.89,0.25,-1.07,-0.1,0.65,0.93,0.51,0.35,-0.11,0.19,-0.52,0.08,2.58,2.17,1.43,1.61,-0.44,-0.07,-0.3,0.14,1,0.16,0.47,0.22,-0.51,-0.07,-1.22,-0.58,-0.43,-1.1,-0.05,-0.77,-1.07,0.25,-1.73,0.05,-1.14,-0.52,-0.73,-0.23,2.68,1.01,0.8,0.14,0.53,0,0.86,0.07,-0.01,-0.34,0.35,0.09,0.32,0.08,0.36,0.12,-1.26,0.15,-1.18,0.23,-0.68,-0.54,-1,-0.72,0.3,0.7,0.63,0.86,-1.23,-1.22,-1,-1.38,-0.35,-0.85,-0.55,-1,-0.34,-1.38,-0.61,-1.37,-0.13,0.55,0.61,1.07,0.11,0.56,-0.16,0.39,-0.29,0.5,-0.05,0.52,-0.13,-0.28,-0.26,-0.34,-0.72,-1.02,-0.43,-0.56,0.49,0.64,0.15,0.42,-0.1,0.1,-0.52,-0.67,1.68,0.35,0.64,-0.4,1.29,0.1,0.59,0.15,-0.37,0.09,0.83,0.35,-0.2,-1.12,-0.03,-0.66,-1.54,-1.08,-1.17,-0.61,-0.55,-1.55,-0.34,-1.27,0.38,-0.39,-0.23,-0.19,-2.07,0.21,-1.39,0.54,-0.46,-0.31,0.08,-0.22,0.73,-0.62,-0.64,-1.16,0.27,0.43,0.9,0.49,-0.74,-0.33,-0.37,-0.01,-1.2,-0.87,-0.62,-0.72,1.02,0.34,0.46,0.46,-0.51,-0.36,-0.58,-0.65,3.53,2.21,2.51,1.66,0.32,-0.09,-0.04,0.2,0.68,0.93,0.59,0.76,-1.87,-1.49,-2.06,-1.77,-0.93,-0.87,-0.49,-0.53,0.47,0.26,0.97,0.66,1.99,2.09,0.64,1.46,-0.52,0.71,-0.71,0.82,-0.93,-0.33,0.56,0.54,-0.81,0.56,0.39,0.97,1.25,-0.16,0.1,-0.46,1.18,1.86,1.11,1.79,-1.02,-0.3,-0.17,0.37,-1.21,-0.78,-1.62,-0.9,-0.1,0,0.69,0.29,-0.63,0.3,-0.33,0.74,1.13,0.76,0.85,0.67,-0.48,0.77,-0.89,0.11,-0.26,-1.6,-0.41,-1.42,0.79,-0.44,-0.05,-0.64,-1.54,-0.08,-1.75,-0.81,-1.34,-3.05,-0.66,-3.07,-0.33,0.22,-1.22,-0.69,-0.62,0.23,-0.96,-0.09,-0.84,-0.14,-0.26,-0.05,-0.52,-0.6,0.72,-0.47,-1.64,-3.31,-0.71,-3.05,-0.24,-0.14,-0.97,-0.88,0.54,0.98,0.72,0.82,1.37,-0.11,0.97,-0.18,1.5,-0.22,0.16,-0.63,0.42,-0.7,1.03,-0.52,0.58,0.47,0.41,0.57,0.65,1.07,0.7,1.2,-0.98,0.3,-0.59,-0.34,-0.44,-0.16,0.55,0.17,-0.55,0.07,0.43,1.06,0.6,-0.18,-0.53,-0.84,1.24,0.99,0.3,0.84,-0.16,-0.03,0.3,0.11,1.43,0.09,0.99,0.1,0.67,-0.96,-0.06,-0.81,2.21,1.83,1.47,1.28,-0.2,1.37,-0.01,1.27,-0.06,-0.65,-0.29,-0.98,-0.75,-1,-0.9,-1.02,-0.93,-2.44,-0.76,-1.93,0.24,-0.79,0.57,-0.94,1.15,-0.84,1.6,-0.51,2.16,-0.87,1.11,-0.78,-0.91,-2.1,-0.89,-2.61,-1.06,-0.37,-0.2,0.1,-2.22,-0.8,-2.46,-1.2,-0.33,-0.8,-1,-1.34,-0.73,-0.89,-0.5,-1.05,1.29,-0.54,0.7,-0.53,-1.46,-0.77,-1.14,-0.9,-0.55,0.58,0.05,0.9,0.92,0.96,0.42,0.64,0.18,-0.83,0.18,-0.51,-0.5,-0.08,-0.22,-0.21,-0.16,1.13,0.07,1.56,-0.1,1.32,-1.1,0.83,-3.34,-0.82,-2.83,-0.79,0.78,1.32,-0.02,1.29,1.13,1.79,0.96,1.68,0.11,1.34,0,1.41,2.5,1.6,0.87,0.71,-1.05,0.11,-0.61,0.31,1.98,-1.36,1.49,-1.4,0.13,0.15,1.03,0.35,-0.37,0.13,-0.8,-0.43,-0.12,-1.19,0.94,-1.09,1.44,0.05,1.58,0.62,0.49,1.19,-0.12,1.4,0.09,-0.21,0.03,-0.3,0.97,1.45,0.86,1.25,-0.35,0.21,-0.03,0.18,-1.33,0.45,-1.52,-0.04,-0.07,-0.01,0.83,-0.16,-0.6,-0.22,0.04,-0.52,0.22,0.22,0.27,0.06,-1.45,0.1,-1.11,0.25,-0.77,0.22,-0.47,0.35,-0.43,-0.35,0.65,-0.01,-0.59,-0.94,0.08,-0.7,1.06,-0.97,0.13,-1.68,-1.19,-0.69,-0.81,-0.4,0.5,-0.9,1,-0.69,-0.35,-1.05,-0.85,-1.34,1.24,0.15,1.29,-0.19,-1.76,-0.35,-1.25,0.3,-0.49,-0.01,-0.19,-0.01,1.04,-0.24,-0.1,-0.98,-1.42,-0.56,-0.98,-0.12,0.31,-1.34,0.62,-0.69,0.52,1.65,0.66,1.9,0.45,1.03,-0.32,1.09,1.97,1.03,1.62,0.71,-0.98,0.4,-1.16,0.08,0.55,-0.86,0.06,-0.85,1.75,1.81,1.29,1.47,1.18,-0.64,0.68,-0.98,-0.14,0.38,-0.63,-0.25,-1.39,-0.18,-1.42,-0.04,0.64,-0.61,0.68,-0.59,1.29,1.45,0.7,1.3,-0.65,0.51,-0.36,0.17,-0.39,0.69,0.47,1.19,-1.09,-0.79,-0.77,-0.5,-1.27,-1.01,-1.87,-1.35,1.1,1.53,0.84,0.98,0.18,0.23,0.45,0.71,-0.68,-0.3,-0.83,-0.03,0.12,-0.36,0.33,-0.46,0.33,-1.32,0.66,-1.7,0.89,0.61,-0.41,0.29,0.16,-0.34,0.35,-0.09,0.3,1.02,0.8,0.95,-0.49,-0.7,-0.68,-0.83,-1,1.67,-0.96,1.35,0.24,-0.59,-0.37,-0.94,-1.11,-0.5,-0.68,-0.25,-0.98,-1.03,-0.26,-1.03,0.18,-0.11,0.58,0.17,-0.13,0.4,-0.76,-0.12,-1.03,1.13,-0.55,1.23,0.84,0.14,0.68,0,-2.03,-0.93,-0.67,-0.29,0.56,1.28,0.3,1.32,-0.55,-0.51,0.18,0.11,0.41,0.34,1.46,0.45,0.5,0.4,0.25,0.02,-1.44,-1.26,-1.25,-1.13,-1.23,0.29,-0.81,0.7,-0.44,-1.63,-0.76,-1.75,-0.49,-0.76,-0.1,-0.42,-0.43,-0.33,-1.02,-0.64,-1.2,0.21,-0.74,0.43,0.34,0.13,0.37,0.61,0.56,-0.37,-0.24,-1.05,0.24,0.27,0.29,0.19,-0.89,-0.41,-0.65,-0.44,0.44,1.44,-0.69,1.27,-0.26,-1.2,-0.26,-0.89,1.25,-1.04,0.84,-0.83,-0.42,0.11,-0.15,0.19,1.26,0.16,0.89,-0.02,2.35,-0.41,1.03,-1.13,-1.52,-2.4,-1.72,-2.72,1.22,0.02,1.15,-0.46,-0.26,-0.34,-0.12,-0.37,-0.85,-0.62,-0.9,-0.39,0.11,-1.08,-0.27,-1.32,0.42,0.16,0.91,0.21,0.04,-1.11,-0.68,-1.59,-0.21,-1.2,0.56,-0.27,-0.43,0.89,-1.36,0.65,-0.58,1.12,-0.19,1.52,-0.82,-0.22,-1.16,0.26,-1.4,-2.36,-0.91,-1.77,2.05,0.97,0.58,0.11,0.24,0.51,-0.21,0.1,-0.65,0.69,0.44,0.85,-0.5,0.61,0.15,0.72,-0.35,-0.52,0.01,-0.11,1.63,1.24,0.91,0.74,-0.3,-0.1,0.16,-0.51,-0.46,-0.44,0.35,-0.34,0.39,1.03,0.73,0.81,0.13,3.23,0.21,2.49,1.32,1.28,1.31,0.84,-0.24,0.05,-0.06,0.44,-2.01,-0.75,-1.08,-0.61,-0.9,0.05,-0.54,0.12,0.8,1.95,0.97,1.24,1.53,2.14,0.94,1.2,-0.66,-0.25,-0.83,0.09,1.54,1.74,1.55,1.68,0.55,0.79,-0.36,0.34,-0.77,-0.07,-0.68,-0.79,1.1,-0.3,1.12,-0.06,1.51,0.78,1.13,0.29,1.14,0.22,0.83,-0.06,-0.03,1.3,-0.03,1.12,1.4,0.46,0.79,0.54,1.16,0.19,-0.38,-0.49,1.79,0.62,0.86,0.14,-0.08,-0.06,1.48,0.61,0.77,-0.74,0.5,-1.05,0.23,0.41,-0.64,0.17,-0.49,0.11,-0.66,0,1.88,1.55,1.29,1.33,-1.43,-0.55,-0.88,-0.34,0.17,-0.54,0.18,-0.4,0.35,0.35,0.39,0.29,2.01,0.69,0.88,-0.06,-1.32,-0.79,-0.29,-0.44,-0.47,-0.05,-0.01,-0.38,-0.04,-0.67,-0.62,-0.65,0.84,1.77,0.53,2.15,1.16,0.06,1.02,-0.41,0.19,1.27,-0.68,0.11,0.83,0.94,1.48,0.84,0.15,-0.32,-0.61,-0.57,0.65,0.64,0.13,0.4,-0.43,-0.41,-0.65,-0.62,-0.84,-1.6,-0.78,-0.96,1.89,0.17,1.67,0.16,-1,-1.05,-1.08,-0.65,-0.76,0.54,-1.07,0.22,1.25,-0.01,0.07,-0.68,-1.1,-0.3,-0.48,-0.33,0.81,-0.21,0.76,-0.11,0.28,-0.07,0.87,-0.08,0.75,1.13,-0.04,0.91,0.18,-0.54,-0.34,-0.61,-0.15,-0.57,0.99,0.04,-1.17,-0.83,-0.69,-0.66,-2.51,-0.73,-1.99,-0.86,-1.05,0.28,-0.59,0.58,-1.41,-2,-0.7,-0.99,-1.71,-2.11,-1.68,-2.15,-1.19,0.4,-1.1,0.3,1.11,-0.96,0.54,-0.8,-0.26,0.52,-0.56,0.38,2.13,0.47,1.56,0.11,0.39,-1.13,-0.04,-1.56,1.32,-0.24,0.28,-0.62,-0.59,0.67,0.3,1.09,1.35,1.55,0.64,0.98,-0.82,0.51,-0.38,0.4,-0.61,-0.39,-0.55,-0.4,-0.16,-1.4,-0.64,-1.12,0.31,1.11,0.14,0.55,0.04,1.34,0.29,1.39,0.5,-0.47,0.02,-0.46,1.16,0.37,1.62,0.39,-1.01,-0.65,-0.38,-0.12,0.22,0.16,-0.15,0.6,0.45,-0.33,0.57,-0.66,-0.07,1.21,-0.05,0.9,-0.78,-1.1,-1.87,-1.13,1.07,-0.41,0.52,-0.25,0.41,0.49,0.62,0.29,0.31,1.36,0.31,1.21,0.11,0.64,0.17,0.88,-0.6,-1.85,0.02,-1.41,0.25,-1.57,0.45,-1.2,-1.3,-0.9,-1.15,-0.63,-0.16,0.95,-0.07,0.77,0.27,-0.83,0.3,-0.65,1.26,2.18,1.21,1.85,-0.03,1.2,-0.22,1.48,-0.3,0.61,0.27,0.38,0.12,-0.98,0.08,-0.74,1.13,-0.44,1.63,-0.21,0.04,-0.13,0.41,0.45,-0.27,-0.99,0.51,-0.54,-0.66,0.02,-1.04,-0.15,-0.55,0.5,-1.22,0.14,-0.68,0.63,-0.83,0.15,-0.05,-0.44,-0.53,-0.5,0.41,0.54,0.64,0.63,-0.03,-0.39,0.37,-0.62,1.19,2.17,1.23,2.23,-0.81,0.21,-0.88,0.2,0.46,0,-0.05,-0.57,0.06,-0.32,-0.11,0.18,-1.02,0.14,-0.33,0.72,0.97,0.68,0.9,0.92,-0.72,0.06,-0.57,0.05,1.92,1.1,1.04,0.85,0.55,-0.07,-0.6,-0.77,0.29,0.7,-0.11,0.1,-0.73,-0.61,0.39,0.04,-0.23,-0.16,0.11,0.3,1.2,-0.86,0.13,-0.85,-0.27,-0.86,0.72,-0.66,-0.93,0.65,-0.46,1.12,-1.07,0.73,-0.2,0.79,-0.86,-1.4,-1.02,-1.32,0.71,0.88,0.51,0.37,0.74,-0.61,0.77,-0.57,-0.47,0.68,-0.24,0.01,0.81,0.64,0.91,0.47,-1.36,-0.29,-0.2,0.26,1.19,1.03,0.84,1.02,1.96,-0.07,-0.03,-0.99,1.37,-1.34,0.8,-1.15,0.21,-0.4,0.64,0.05,-2.15,-2.88,-1.79,-2.27,0.24,-1.29,0.55,-1.12,-0.82,0.87,-0.2,0.64,-0.49,-3.34,-1.04,-3.27,0.07,1.08,0.66,1.47,2.24,2.02,0.97,1.51,-0.87,0.57,-0.73,0.54,1.74,-0.6,1.02,-0.95,-1.36,-1.87,-1.22,-2.03,0.16,0.21,-0.1,-0.21,-0.77,-0.29,-0.86,-0.31,-0.86,-1.85,-0.66,-1.72,0.75,-0.02,1.08,0.16,1.87,1.07,1.55,0.82,-1.6,0.61,-0.51,0.95,-1.96,-1.93,-1.34,-1.57,-1.49,-0.18,-0.82,0.35,-1.04,-1.03,0.39,-0.09,1.32,-0.96,0.79,-0.98,0.68,0.58,-0.22,0.03,-0.22,-0.24,-0.54,-0.22,0.44,0.34,-0.44,0.18,-0.54,0.16,-1.21,-0.62,-1.43,-1.11,-0.49,-0.35,1.23,0.12,0.67,-0.48,-1.78,-1.12,-1.59,-1.1,1.4,0.06,-0.17,-0.54,-0.35,0.22,-0.9,-0.06,1.43,1.36,0.97,1.46,0.04,-0.3,0.53,-0.08,0.01,1.67,0.73,1.51,-0.68,0.42,-0.61,0.02,1.15,-0.23,1.41,-0.1,-1.3,-1.02,-1.12,-0.76,-0.94,-1.17,-0.15,-0.14,-0.27,-0.23,-0.66,-0.27,-0.55,-0.41,-0.1,-0.38,0.19,-0.07,-0.18,-0.06,-1.87,-1.66,-1.39,-1.49,0.66,0.23,0.88,0.3,1.93,0.71,1.03,0.22,1.01,0.84,0.82,1.4,-1.13,0.05,-0.65,-0.03,1.71,0.04,0.78,0.03,-0.28,-0.48,0.08,-0.23,0.87,-0.41,1.06,0.1,-0.68,-0.73,-0.44,-1.01,-0.46,0.65,0.08,0.58,-1.53,-1.14,-0.22,-0.64,1.51,0.94,-0.19,0.48,-0.33,-0.47,-0.9,-0.53,-2.02,-1.46,-0.78,-1.02,-0.08,0.29,0.46,0.23,-0.75,0.96,-0.56,1.19,-0.7,0.68,-0.16,0.64,0.1,-1.24,-0.62,-1.43,1.05,1.37,0.98,0.91,0.19,1.53,0.78,1.38,0.63,0.09,0.61,0.06,0.36,2.26,0.02,2.47,-0.14,-0.49,-0.59,-0.48,1.64,-0.7,0.45,-1.5,1.38,-1.57,0.86,-1.41,0.36,0.88,0.52,0.76,1.23,1.15,0.66,1.24,0.46,1.22,0.02,0.68,0.22,-0.05,0.53,0.31,-1.58,0.04,-0.36,0.35,-0.67,0.22,0.32,0.52,-1.11,0.19,-1.42,-0.58,0.48,-0.37,-0.04,-0.46,0.16,1.01,0.53,0.93,0.12,-0.31,-0.44,-0.14,1.58,0.07,0.7,-0.03,1.24,0.13,0.83,0.08,0.27,-1.19,0.46,-0.72,0.18,0.84,0.71,1.36,-0.11,0.68,0.16,0.45,-0.48,-0.51,0.02,-0.77,-0.23,0.1,-0.73,0.31,0.21,-0.94,0.32,-1.3,-0.58,1.09,-1.3,0.87,1.07,2.08,0.82,2.17,-0.42,0.61,-0.45,0.41,-0.07,0.06,-0.07,-0.34,-0.51,0.37,-0.65,0.45,0.14,-1.48,-0.41,-1.68,1.45,0.45,0.91,0.16,0.54,-1.32,0.28,-1.34,0.28,1.52,-0.33,1.09,0.97,0.96,0.87,0.94,-0.64,-2.05,-0.51,-2.38,0.88,1.78,1.29,1.95,0.11,-0.42,0.14,-0.62,-0.36,-0.07,-0.29,0.39,-0.84,0.21,-0.62,0.49,-1.21,0.62,-0.39,0.9,1.22,0.53,0.32,0.08,1.03,1.51,0.23,0.91,-1.53,-1.12,-1.08,-1.61,-0.04,0.2,0.27,0.13,1.15,1.01,1.41,1.13,-0.57,-0.53,-0.5,-0.9,-0.04,-0.28,-0.05,-0.48,-0.81,-0.41,-0.75,-0.17,1.32,-0.5,0.3,-1.12,1.22,0.56,0.11,-0.46,0.94,-1.52,0.57,-1.48,0.38,-0.36,-0.02,-0.13,1.25,1.06,1.62,1.13,0.53,-0.14,0.67,0.23,1.39,1.43,1.2,1.01,1.44,2.37,1.16,1.51,0.71,0.86,0.82,0.57,0.91,0.09,-0.08,0.05,-2.01,-0.86,-2,-1.06,-2.03,-1.86,-0.79,-0.81,0.3,1.53,0.31,1.42,-0.13,0.2,-0.03,0.4,-1.47,1.26,-0.72,1.6,-0.89,-1.58,-0.48,-1.27,0.8,1.46,0.32,0.78,-1.49,-0.09,-1.68,-0.07,1.19,1.22,1.48,1.22,-0.05,2.05,0.2,2.09,-0.26,-1.46,0.42,-1.25,0.4,-0.67,0.56,-0.49,-0.28,0.06,0.3,0.13,-0.43,-0.37,-0.16,-0.2,-0.74,0.63,0.02,0.93,-1.89,-0.97,-1.53,-1.13,1.41,0.64,0.46,0.69,-1.46,-1.7,-0.99,-1.43,1.35,0.86,0.12,0.05,0.36,1.51,-0.71,1.01,-0.26,-0.1,0.16,0.02,0.03,-0.95,-0.07,-0.88,1.54,1.04,1.29,0.85,0.27,1.53,0.45,1.03,-1.97,1.33,-0.36,1.74,-0.33,-0.06,-0.86,-0.82,-1.25,0.61,-0.74,0.36,2,1.38,1.38,1.32,-0.01,-0.58,-0.23,-0.43,-0.81,-0.1,-0.89,-0.5,0.86,0.7,0.54,0.24,1.07,-0.07,1.11,-0.18,-2.75,-1.68,-1.4,-1.35,0.02,0.29,-0.31,0.2,1.35,0.48,1.07,0.41,-1.56,-0.21,-1.72,-0.2,0.02,1.15,0.15,0.85,-0.3,-0.11,-0.85,-0.62,-0.02,0.16,-0.66,0.23,0.51,1.38,-0.25,1.27,0.28,0.49,0.36,0.42,1.16,-0.49,0.36,-0.73,-1.36,-0.44,-0.95,-0.24,0.18,-0.53,-0.35,-0.67,-0.47,-0.59,-0.17,-0.28,-1.02,-0.67,-1.77,-0.88,-1.72,0.37,-0.99,1,-0.87,-1.36,-0.3,-0.96,-0.79,-1.13,-0.53,-1.63,0.94,0.96,0.76,0.81,1.46,0.22,0.61,0.04,0.82,-0.58,0.97,0.29,-0.94,-0.78,-0.53,-0.53,0.97,-0.28,0.14,-0.83,-0.14,-0.99,-0.78,-1.24,-0.9,-1.07,-0.62,-0.67,0.99,0.75,0.42,0.23,0.67,1.7,0.78,1.62,1.42,0.81,0.44,0.5,-1.24,-1.04,-1.09,-1.17,0.56,0.64,-0.19,0.54,-0.38,-0.26,0.01,-0.38,0.36,-0.04,-0.07,-0.24,1.22,1.92,0.65,1.67,0.14,1.8,-0.18,1.56,-0.11,0.72,-0.2,0.88,-0.1,1.03,-0.13,0.96,0.22,1.81,-0.12,1.75,1.22,-2.27,0.67,-1.9,-1.1,0.37,-0.94,0.07,-0.81,0.89,-0.84,0.62,0.6,-0.94,0.34,-1.16,1.49,0.82,1.31,0.91,2.73,1.63,1.63,1.68,0.05,-1.35,-0.7,-1.5,1.17,-0.22,0.76,0.16,-1.27,-0.4,-0.78,-0.09,-0.33,-0.34,-0.87,-0.7,-1.14,0.25,-1.73,-0.66,1.36,1.66,0.2,1.35,0.58,2,1.33,1.78,0.43,0.68,0.86,0.79,-0.94,-0.17,-1.02,-0.15,0.02,-0.25,-0.2,-0.31,0.6,-2.08,0.35,-2.02,0.11,-0.65,0.85,-0.18,-0.25,-0.79,-0.79,-1.18,-0.53,-0.04,-1.15,-0.1,1.58,0.29,1.02,0.26,-0.35,1.73,-0.03,1.45,2.06,0.62,1.61,0.15,-0.41,-1.28,-0.19,-1.32,-0.06,-0.53,-0.77,-0.7,-0.61,-0.85,-0.48,-0.61,-0.93,-1.24,-0.23,-0.94,1.69,1.78,0.72,1.53,0.66,0.81,0.81,0.55,-1.58,-1.93,-0.67,-1.54,0.72,-0.33,-0.52,-0.63,-2.13,-0.55,-2.16,-0.32,-1.3,-0.44,-1.22,-0.6,0.67,0.09,0.24,0.25,-0.23,-0.37,-0.54,-0.9,-0.36,-1.09,-0.43,-0.94,1.27,1.01,1.12,0.6,-1.4,0.3,-0.74,0.19,-0.83,0.63,-0.37,0.73,-0.65,-1.94,-0.71,-2.03,-0.99,-0.15,-0.93,-0.1,1.51,-0.16,0.37,-0.33,-1.3,0.61,-0.04,1.1,-0.42,0.32,0.59,0.41,0.04,0.13,0.1,0.08,0.18,-0.79,-0.06,-0.81,0.53,-0.34,-0.17,-0.87,0.98,1.11,0.06,0.64,2.32,2.08,0.49,1.22,0.21,-0.99,1.38,0.17,3.55,1.85,1.67,0.89,1.43,0.84,0.05,0.4,0.98,0.64,1.52,0.53,0.05,-0.64,0.26,-0.86,-0.62,0.09,-0.52,0.29,0.25,0.81,0.13,1,0.71,0.13,1.11,0.56,0.01,0.22,-0.46,-0.06,0.94,0.95,0.57,0.71,-0.08,0.45,-0.1,0.85,-0.15,-0.46,-0.29,-0.25,0.14,0.95,-0.82,0.61,0.06,-0.07,1,0.25,0.3,0.01,0.25,-0.7,-1.47,-0.43,-0.27,0.44,-0.43,-0.01,-0.98,-0.06,1.89,1.02,0.91,0.53,-1.45,-2.3,0.08,-1.13,0.99,0.95,0.22,1.07,0.97,1.01,0.82,0.75,-0.16,1.34,-1.43,0.84,-1.22,-0.62,-1.05,-0.31,-0.09,1.79,-1.06,1.69,-0.2,-1.57,-0.06,-1.47,-1.06,-0.46,-0.9,-0.85,-1.54,-0.91,-1.26,-0.87,-2.1,-0.71,-1.55,-0.18,-0.19,1.34,0.52,1.24,2.1,1.11,0.5,0.53,1.27,1.28,0.29,1.07,1.18,0.85,0.39,0.7,-0.57,-0.38,-0.89,-0.44,0.93,1.49,1.37,1.8,-1.66,-0.43,-0.99,-0.25,-1.03,-0.14,0.23,0.14,-1.49,0.76,-1.37,0.69,1.43,2.14,-0.63,1.14,1.81,1.74,0.65,0.63,0.89,-0.33,0.5,-0.22,1.26,-1.66,1.54,-1.44,-0.94,-0.64,0.29,-0.24,-0.22,-1.98,-0.1,-1.65,0.35,-0.61,0.75,0.12,2.19,-1.14,1.98,-1.09]},{"a":"heart","b":"lungs","paper":0.73,"r":0.57,"pr":0.7,"xy":[1.35,0.79,0.36,0.29,0.3,0,-0.1,0.09,-0.66,-0.94,-0.89,-0.13,-1.56,-1.51,-1.38,-1.18,0.84,-0.72,1.09,1.13,0.68,0.56,0.35,0.08,1.56,0.54,1.22,1.09,-1.14,-0.34,-0.8,-0.4,1.92,0.86,1.64,0.95,0.47,-1,-0.15,-0.68,-1.5,-1.5,-0.79,-0.1,0.03,-0.37,-0.23,-0.08,-1.13,-0.65,-0.86,-0.09,0.69,-0.01,0.46,-0.28,-1.03,-0.63,-1.57,-0.2,-0.27,1.22,-0.48,1.08,1,0.55,1.33,0.64,0.55,-1.02,-0.36,-0.43,0.61,0.11,0.87,0.33,-0.11,0.7,-0.25,1.07,-0.04,0.39,0.32,0.88,0.68,0.2,0.04,0.26,-2.02,-0.08,-1.16,-0.34,-1.01,0.03,-0.61,0.23,-0.04,-1.11,-0.18,-0.89,0.29,-1.28,0.25,-0.48,2.43,1.81,2.65,2.19,0.45,1.32,0.24,0.41,-0.78,-0.47,0.19,0.05,0.54,-0.61,0.58,0.46,0.01,0.47,-0.09,0.43,-0.21,-1.05,-0.28,-1.11,-0.38,-1.76,0.43,-0.45,-2.12,-1.09,-1.43,-0.76,-0.03,-0.59,0.13,-0.33,-0.82,0.54,-0.41,0.31,-1.13,-0.8,-0.97,-0.81,0.81,0.32,0.81,0.2,1.97,2.06,0.21,0.33,0.31,-0.55,-0.49,0.17,0.73,0.25,0.72,1.08,-0.15,-0.8,-1,-0.81,0.46,-1.19,-0.2,-0.4,-0.46,0.22,-0.52,0.15,0.96,0.41,-0.23,0.37,-0.43,0.14,-0.06,0.35,-1.98,-1.4,-1.04,-0.54,-0.07,0.52,0.16,0.21,0.38,0.46,0.36,0.13,1.37,1.36,0.86,0.97,-0.38,-0.83,-0.47,-0.48,-0.72,-1.52,-1.25,-0.52,0.9,0.81,1.46,1,-1.38,-1.75,-2.19,-1.45,-0.93,-1.29,-1.25,-1.2,-1.65,-0.51,-0.84,-0.33,-0.16,-0.98,-0.31,-0.72,0.93,0.62,0.77,-0.32,0.05,-1.5,-1.11,-1.02,0.53,0.43,0.37,0.59,-0.8,-0.67,-0.69,-0.66,0.42,0.31,0.36,0.13,-1.51,-1.3,-1.48,-1.12,-0.38,-0.35,-0.13,-0.33,1.24,0.85,1.11,1.06,0.5,0.76,0.06,0.51,0.88,0.52,0.95,0.75,0.69,0.15,1.3,0.55,-0.01,0.2,0.47,0.8,0.13,0.19,0.52,0.11,0.06,0.32,0.32,0.01,-0.21,-0.26,-0.36,-0.27,-1.19,-1.16,-0.55,-0.43,1.58,0.88,1.21,0.33,2.61,1.72,2.54,1.79,1.29,0.4,1.34,1.34,0.67,-1.1,0.66,-0.62,1.3,2.35,1.53,1.87,-1.09,-0.68,-0.2,-0.13,0.51,0,0.83,0.22,-2.55,-1.75,-2.08,-1.09,0.18,-1.1,-0.19,-0.96,1.1,1.26,1.49,0.36,-1.4,-0.45,-1.23,-0.22,1.33,-0.35,1,0.17,0.44,0.85,0.59,1.29,0.49,0.41,0.59,0.04,-0.22,0.67,-0.21,-0.18,-0.44,-1.23,-0.76,-0.75,-0.28,-0.01,-0.45,-0.23,0.22,-0.85,-0.35,0.52,-0.35,-1.47,-0.18,-0.54,0.56,0.5,-0.28,-0.37,2.12,1.16,1.48,0.73,-0.01,0.5,0.16,-0.15,-0.61,0.02,-0.75,-0.45,0.53,-0.79,-0.16,-0.16,-0.16,-0.3,-0.14,-0.09,-1.49,0.2,-0.73,0.36,1.55,2.13,1.82,1.8,-0.06,-1.65,-0.78,-1.02,0.04,-0.04,0.23,0.18,-2.11,-0.97,-1.11,-0.8,0.14,-0.47,-0.22,-0.52,-1.23,0.41,-0.77,-0.25,-0.29,-0.46,0.23,0.11,-0.63,-0.7,-0.5,-0.52,0.19,0.66,-0.69,-0.26,-0.46,-0.84,-0.2,-0.78,-0.05,-0.87,-0.12,-0.89,-0.06,0.67,-0.45,-0.14,0.11,1.15,0.19,0.78,2.27,0.51,1.07,0.39,0.48,0.21,0.27,-0.18,-0.62,0.1,-0.51,0.06,0.76,2.41,0.94,2.3,-0.92,0.62,-0.47,0.38,1.96,1.47,1.25,0.95,-0.94,0,-0.92,-0.48,1.04,0.15,0.18,0.02,1.77,-0.42,2,0.67,-0.72,0.47,-0.58,0.77,-0.33,-0.3,0.24,-0.08,-0.62,-0.69,-0.45,-0.18,-0.01,1.68,-0.76,0.33,0.08,1.14,-0.05,0.42,-0.69,0.18,0.31,0.26,1.15,-0.12,0.72,0.27,0.81,-0.81,1.31,0.27,-0.34,0.32,-0.24,0.2,-0.9,-1.22,-0.51,-0.71,0.22,-1.56,0.19,-0.88,0.14,0.06,-0.58,-0.01,1.72,1.49,1.58,1.1,1.25,1.07,1.1,0.81,0.47,-0.16,0.23,-0.15,1.59,0.24,1.89,0.3,-0.82,0.46,-0.75,0.34,-1.09,-0.29,-0.95,-0.32,0.04,-1.88,0.2,-0.8,0.32,0.76,-0.26,0.31,-1.4,-0.13,-0.83,-0.24,1.31,1.08,0.72,-0.04,-0.18,-0.21,-0.75,-0.24,-0.41,0.57,-0.54,0.68,0.72,-0.65,0.32,-0.11,0.32,0.76,0.98,1.2,0.97,1.13,1.33,0.41,0.12,-0.17,-0.2,-0.07,-0.61,-0.66,-0.24,-0.04,1.02,1.19,0.94,0.68,-0.32,-0.59,-0.11,-0.82,0.82,-0.07,0.32,-0.37,-2.02,-0.65,-1.81,-1.9,-0.11,-1.45,0.17,0.04,0.43,0.01,-0.01,-0.31,-0.3,-0.55,-0.7,-1.36,-0.09,-1.9,-0.81,-0.79,-1.06,0,-0.44,-0.08,0.33,-0.82,-0.11,0.05,-0.09,1.34,0.31,0.96,-0.17,-0.19,-0.55,-0.13,0.27,1.65,0.33,1.44,-1.59,-1.56,-1.22,-0.38,-0.68,-1.84,-0.55,-1.41,1.15,0.63,0.95,0.56,-0.85,-0.78,-1.73,-1.27,1.55,1.43,1.55,1.19,1.05,0.75,-0.03,-1.02,1.21,2.55,1.05,1.99,0.08,1.5,-0.49,0.58,0.69,0.93,0.28,0.91,-1.2,-0.27,-1.1,-0.97,0.27,0.29,0.41,0.38,-1.24,0.8,-0.68,0.23,0.71,1.26,1.02,0.97,1.63,0.53,0.5,0.09,0.32,0.17,0.07,-0.84,-0.41,0.05,-0.42,0.12,0.9,0.07,0.74,0.69,1.47,1.56,0.92,1.06,-1.17,-0.82,-1.08,-1.36,-0.26,0.34,-0.72,-0.24,1.07,-0.08,0.36,0.56,-1.19,-0.58,-0.65,-1.34,-1.06,-0.84,-0.2,-0.46,1.07,0.23,0.63,-0.67,-0.03,-1.57,0.55,0.13,0.92,0.56,0.1,0.77,0.95,0.63,0.26,0.1,-0.63,-1.02,-0.22,-0.45,0.64,-0.01,0.18,0.33,0.85,0.19,0.51,0.58,1.28,0.85,0.52,0.41,-0.68,-0.43,-0.49,-1.34,0.42,0.36,0.14,0.02,-0.4,-0.93,-0.25,-0.3,0.97,1.63,0.66,0.89,-0.87,0.26,-0.27,-0.23,0.13,-0.06,0.95,0.59,0.22,-0.3,-0.24,-0.47,0.59,0.85,0.09,0.45,-0.59,-0.59,-0.58,-0.5,-0.65,-0.91,-0.4,-0.89,1.55,1.44,1.14,0.41,-0.34,0.65,-1.04,0.54,1.62,-0.75,0.83,-0.37,-0.55,-0.66,-0.23,-0.28,-1.55,-0.09,-1.85,-0.39,-0.09,-0.11,0.26,0.57,-0.77,-0.35,-1.59,-0.97,1.19,0.4,1.05,0.79,-0.64,-0.01,-0.42,-0.31,0.58,1.39,1.05,1.32,0.51,0.57,0.7,0.63,1.67,0.97,1.46,1.06,-1.04,-0.04,-0.45,0.2,0.16,-0.26,-0.75,-0.59,-1.48,0.63,-0.9,-0.77,0.2,-0.15,-0.26,-0.64,0.06,0.3,-0.05,0.32,-1.33,0.52,-1.22,0.71,0.07,0.1,-0.68,-0.1,0.97,0.42,0.83,-0.12,-1.24,-0.99,-1.19,-1.28,0.51,0.07,0.73,0.64,-0.45,0.01,0.6,0.67,0.65,-0.11,0.32,-0.33,0.97,1.16,1.47,1.01,-1.17,-1.02,-0.38,-0.67,0.66,0.3,-0.38,-0.39,0.85,0.49,0.69,0.67,-0.3,-0.2,-0.16,-0.29,1.19,-0.9,0.81,-0.95,-1,-1.04,-0.51,-0.42,-1.95,-2.14,-1.73,-1.44,0.2,0.4,0.79,0.99,-0.95,-0.66,-1.13,-0.68,0.83,-0.69,0.2,0.29,-0.19,0.2,-0.31,-0.72,1.05,1.37,0.39,0.94,0.81,0.86,0.7,1.08,-0.31,-0.79,-0.28,-0.42,-0.84,-0.9,-0.64,-0.54,2.38,1.87,2.04,1.59,0.73,0.1,0.1,-0.38,-0.69,-0.33,-0.02,0.28,-0.02,-1.18,-0.26,-1.09,1.04,0.69,1.17,0.31,0.68,-1.04,1.14,-0.6,-0.09,-0.19,-0.05,-0.44,1.47,-0.65,0.06,-0.55,1.15,0.74,0.56,0.62,-0.95,0.67,-0.38,0.33,-0.45,0.66,0.14,0.28,-1.26,-0.79,-0.64,-0.21,1.03,0.24,0.02,0.24,-1.44,0.38,-2.1,-0.22,0.4,1.37,0.45,1.47,0.16,1.09,-0.03,0.54,0.85,1.5,0.1,0.39,1.06,1.31,0.64,0.91,-0.64,-0.49,-0.42,-0.65,-1.33,0.66,-1.04,0.08,0.05,0.73,-0.2,-0.16,1.07,1.99,0.23,0.85,0.54,0.84,-0.66,0.11,0.01,-0.41,0.73,0.01,-1.27,-0.72,-1.48,-0.56,0.12,-0.8,-0.6,-0.22,2.38,2.52,1.36,2.1,0.99,0.26,1.17,1.05,1.38,1.15,1.57,1.6,-1.31,-0.91,-1.54,-0.8,1.54,1.16,1.4,0.9,-0.22,-1.43,0.27,0.05,0.05,-1.48,-0.39,-0.65,0.29,-0.78,-0.68,-0.65,-2.93,-0.36,-1.93,-0.57,-0.07,0.23,-0.25,-0.07,0.91,-0.55,0.72,-0.57,0.36,-0.14,0.49,-0.05,-0.79,-1.03,-1.28,-0.65,-0.24,0.25,-0.47,-0.26,-1.28,-1.18,-0.86,-0.38,0.79,0.68,0.52,0.8,0.75,-0.56,-0.25,-0.16,0.76,1.36,1,0.93,0.09,1.01,-0.47,0.74,0.77,-0.62,0.6,-0.72,-1.22,-1.98,-0.94,-1.65,0.11,0.24,-1.04,-0.24,0.1,0.04,-0.41,0.37,-0.01,1.07,-0.19,0.94,0.67,0.17,0.38,0.15,1.57,0.43,0.88,0.18,1.96,0.7,2.2,1.56,-0.24,-0.6,0.58,0.26,-0.39,0.09,-0.24,0.78,-0.59,-1.16,0.27,-0.73,-0.97,-0.52,-1.31,-1.36,1.42,-0.44,0.54,0.03,-0.01,1.11,0.3,1.03,-0.68,-0.37,-0.62,0.05,0.63,1.23,0.57,1.57,-0.51,-0.76,-0.51,-0.63,-0.6,-0.84,-0.68,-0.53,0.12,0.74,0.4,0.68,0.34,0.58,-0.04,0.09,0.76,1.11,0.86,0.23,0.1,0.39,0.45,0.29,-1.34,-0.95,-0.39,-1.1,1.41,0.81,0.83,-0.01,1.6,1.23,0.87,0.09,0.85,-0.58,0.75,0.14,0.88,0.26,0.72,0.24,0.53,-0.27,0.36,0.61,0.36,-0.22,0.02,0.4,0.96,-0.51,0.2,-0.16,-1.53,-0.16,-0.68,0.04,-0.66,-0.73,-1.42,-0.73,0.47,1.36,0.62,0.75,0.28,0.19,0.24,0.1,-0.57,-1.76,0.04,-0.33,0.14,0.47,-0.5,0.45,0.4,0.23,-0.01,-0.24,0.84,-0.18,0.7,-0.04,1,1.37,0.85,1.49,-0.9,-0.58,-0.76,-1.05,-2.07,-2.55,-1.68,-1.78,0.92,1.23,0.86,1.29,1.79,1.43,0.7,0.82,-1.34,-2.38,-1.08,-1.62,-0.22,-1.43,-0.02,-0.43,-0.48,0.15,-1.38,-0.54,0.43,0.36,0.53,0.67,-0.6,-0.67,-0.87,-1.09,-0.02,0.3,0.46,0.5,0.58,0.18,1.45,0.73,-1.06,-0.98,-0.99,-1.35,-0.43,0.19,-0.95,-0.15,0.06,-0.31,0.21,-0.07,0.81,1.03,0.56,0.8,0.74,-0.23,0.69,-0.48,0.66,1.4,0.62,1.23,-0.91,-0.67,-0.29,0.03,0.41,0.44,0.39,1.02,-1.08,-0.92,-0.46,-1.04,-0.98,0.2,-0.06,0.36,0.94,0.5,0.78,-0.46,0.3,-0.08,0.18,-0.04,-1.03,0.07,-0.9,-0.02,-0.68,-0.92,-0.77,-1.04,0.74,0.61,0.58,0.59,0.42,1.52,0.02,0.6,0.17,0.08,-0.03,0.15,-0.04,-0.13,-0.1,-0.55,0.11,0.01,-0.95,-0.72,-0.2,-1.44,0.82,-0.34,-1.19,-1.02,-0.61,-0.86,0.03,-0.65,0,-0.71,-2.15,-0.84,-1.75,-0.74,1.08,-0.03,0.7,0.24,1.89,0.05,0.68,0.3,0.83,0.8,0.3,0.46,-0.87,0.45,0.24,0.85,-0.59,-0.44,-0.09,0.39,2.03,-0.7,1.95,-0.18,-0.39,1.01,-0.17,1.19,-0.42,-0.35,-0.14,-0.14,0.99,2,1.06,1.45,-1.08,-1,-0.73,-1.29,0.36,0.6,0.31,0.94,-0.57,-0.52,-1.17,-0.87,0,1.59,-0.52,0.69,0,0.46,0.04,0.68,-0.86,0.75,-0.24,-0.27,0.01,-0.23,0.27,0.2,-0.09,-1.98,-0.54,-0.58,-1.02,-1.73,-1.13,-0.98,-0.31,-0.01,0.39,0.25,-1.12,-1.16,-0.32,-0.87,-0.65,0,-0.05,0.7,-0.26,1.13,-0.8,0.27,-2.37,-2.44,-2.02,-1.22,-1.71,-0.48,-1.3,-0.24,0.04,-1.26,-0.55,-0.66,0.84,0.64,0.46,-0.12,0.41,-0.56,0.05,0.73,-0.86,-0.12,-0.85,0,2.57,1.76,2.39,1.95,-1.12,-0.94,-1.54,-1.26,-1.25,-0.48,-0.91,-0.86,1.85,1.49,1.4,0.96,-1.2,-0.83,-1.2,-0.36,-1.24,0.63,-1.28,-0.61,-1.45,-0.46,-1.28,-0.41,-2.13,-0.97,-1.88,-1.66,0.72,1.54,0.97,0.83,-1.08,-1.38,-1.37,-0.9,1.35,-0.26,0.46,-0.32,-1.42,-1.51,-1.43,-0.98,-0.9,-1.35,-0.88,-0.94,2.27,1.42,1.12,0.54,0.37,0.59,0.46,-0.13,0.2,-0.11,-0.69,-0.31,-0.73,0.27,-0.15,0.48,1.12,-1.2,0.59,-0.33,-1.57,-1.22,-1.89,-1.36,-0.07,-0.72,-0.22,-1.03,-0.23,0.43,-0.29,-0.14,0.34,1.39,0.14,0.65,1.4,1.64,0.74,0.96,1.02,0.95,1.06,1.25,0.28,0.2,0.55,0.1,-1.79,-1.38,-1.03,-1.27,0.34,-0.17,0.19,-0.36,-0.6,0.33,-1.01,-0.14,0.7,-0.29,0.55,-0.42,-0.32,0.4,-0.34,-0.7,-1.24,-0.82,-0.85,-0.31,1.08,0.04,0.56,0.35,-0.35,-1.5,-0.29,-1.17,-0.64,0.52,-0.28,0.21,-1.19,-2.44,-1.06,-0.87,-1.57,-0.08,-1.87,-1.84,0.32,-0.54,0.82,0.72,-0.31,0.44,-0.93,-0.3,1.09,1.39,0.67,0.67,-0.52,1.09,-0.27,0.03,-0.17,-2.35,-0.45,-1.8,-0.6,-1.3,-0.76,-1.49,-0.25,0.95,-0.25,-0.01,0.49,1.06,0.38,0.84,-0.88,-0.41,-0.89,-0.92,-0.24,0.77,-0.02,0.53,-0.7,-1.51,-0.77,-0.17,0.08,0.36,-0.44,0.96,0.72,1.63,0.35,0.67,0.02,0.04,0.34,0.91,-2.16,-2.42,-1.87,-1.36,-0.8,-1.5,-1.12,-1.82,2.78,0.85,1.99,1.29,0.74,-0.72,0.28,-0.61,1.33,1.16,0.59,-0.11,0.71,-0.44,0.83,0.24,0.57,0.13,-0.12,-0.55,-1.59,-0.92,-0.9,-0.58,-0.03,1.24,0.43,1.14,0.19,1.19,0.18,0.15,0.19,0.5,-0.77,-0.12,1.14,0.12,0.66,0.09,1.23,1.58,1.03,1.18,-1.28,-1.82,-0.8,-1.11,-0.01,-1.32,-0.54,-1.14,0.94,0.11,0.95,0.39,-2.93,-2.36,-2.57,-1.63,-0.25,0.42,0.13,-0.27,0.59,1.2,0.37,0.75,-0.03,1.19,-0.55,0.46,0.46,-0.84,0.93,-0.31,1.32,1.24,0.67,1.15,1.99,0.33,1.43,-0.3,-0.06,-0.17,-0.13,-0.68,0.19,0.69,-0.38,-0.21,0.42,0.8,0.12,0.65,0.84,0.2,0.66,-0.23,-0.03,-0.69,0.05,-0.45,1.56,0.58,0.78,0.38,-0.43,-0.76,-0.17,0.05,0.84,-0.07,0.54,0.42,-0.23,-0.47,0,-0.3,0.78,1.13,0.59,0.81,-0.64,0.22,-0.33,0.33,0.65,0.71,0.31,0.48,-1.12,-0.99,-1.16,-1.58,0.17,0.34,0.18,0.3,1.72,2.43,1.69,1.3,2.62,0.52,1.7,0.7,0.96,0.17,0.73,0.43,0.05,1.31,-0.05,1.2,0.71,0.76,0.26,1.04,-0.02,0.12,0.26,0.93,0.92,0.89,0.9,0.68,-0.69,-0.27,-0.93,-0.11,-0.57,-0.48,-0.15,-0.58,0.72,-0.69,0.13,-0.34,1.2,0.47,0.06,0.6,-0.82,-0.79,-0.19,0.11,-1.44,-1.87,-0.73,-0.61,0.4,0.58,0.09,0.32,-0.57,-0.73,-0.49,-0.27,-0.04,0.11,-0.14,0.2,0.86,0.99,0.02,0.82,0.75,0.66,0.05,0.55,1.16,-1.01,1.31,-0.04,0.11,0.62,0.04,0.18,-2.02,-0.67,-1.22,-0.88,0.6,0.81,0.62,0.23,-0.18,-0.14,-0.33,-0.8,0.24,1.1,0.71,0.23,-1.28,-0.79,-1.5,-0.64,0.57,0.72,0.23,0.19,2.15,0.84,2.06,0.88,-1.84,-0.88,-1.77,-1,-1.54,-0.62,-1.08,-1.14,0.13,0.76,0.39,0.51,0.54,0.55,0.88,0.66,0.77,1.33,0.41,0.32,-0.72,0.08,-0.36,-0.12,-0.65,0.37,-0.2,0.28,-0.48,0.55,-0.04,0.11,-0.64,-1.84,-1,-1.4,0.2,0.35,0.36,0.04,3.09,1.24,1.85,0.87,1.19,-0.41,0.53,-0.72,0.02,0.45,-0.14,0.41,-0.77,-0.51,-0.6,-0.6,1.27,0.7,0.73,0.84,0.88,1.46,0.41,0.93,-0.33,1.57,-0.29,0.24,1.5,1.32,0.89,0.86,1.03,1.88,0.39,0.36,-0.3,-1.22,0.08,0.01,0.04,-0.51,0.21,-0.67,0.31,0.2,-0.25,0.02,1.19,0.71,0.46,0.65,-0.74,-0.16,-1.06,-0.61,-0.48,1.21,-0.4,0.24,-0.53,-0.54,-1.06,-1.18,1.66,1.05,1.77,1.58,-1.47,-1.09,-1.27,-1.19,0.61,1.17,0.15,0.03,0.01,-0.17,-0.47,-0.28,0.52,-0.91,0.46,-0.83,0.62,-0.61,0.79,0.26,1.16,0.88,0.74,0.51,0.92,-0.56,0.48,0.42,-0.85,-0.37,-0.86,-1.17,1.55,0.28,1.08,0.28,0.76,0.3,0.99,0.32,0.55,-0.65,0.48,-0.55,-0.09,0.21,0.47,0.22,-0.74,-0.16,-0.93,-0.46,-1.58,-0.12,-2.11,-0.65,-0.07,-0.26,-0.89,-0.25,0.8,-0.64,0.7,-0.02,-0.43,-1.54,0.32,0.06,0.56,0.54,0.42,-0.59,2.11,0.65,1.13,0.63,0.03,-0.63,-0.16,-0.16,0.48,0.56,1.07,1.14,0.94,-0.11,-0.02,0.71,-0.52,-0.41,-1.19,-0.66,-0.56,-1.72,-0.74,-0.65,1.33,1.04,1.35,1.2,0.68,-0.85,0.65,-0.05,0.95,1.22,0.67,0.56,-0.56,-0.99,-1.41,-1.73,1.45,0.13,0.81,0.58,-0.32,-0.07,-0.11,0.08,-1.5,-1.24,-1.27,-1.17,0.8,0.52,0.44,-0.27,0.91,-0.32,0.82,-0.45,-0.88,-2.03,-0.37,-0.7,-1.81,-0.58,-2.28,-1.4,0.69,0.86,0.21,-0.18,0.29,0.01,0.44,0.39,-0.1,-0.63,0.07,-0.43,-1.46,-2.84,-1.42,-1.34,0.27,-1.17,0.18,-0.17,-1.84,-2.51,-1.78,-1.41,0.42,0.61,0.72,0.51,0.88,0.39,0.92,0.45,0.78,0.97,0.04,0.71,1.34,-0.46,0.79,-0.5,2.01,2.59,2.16,2.2,0.9,1.27,1.12,1.15,-1.39,-1.02,-1.37,-1.3,-0.81,-0.51,-0.58,-0.21,-1.14,-1.01,-0.48,-0.2,1.19,1.57,1.8,1.25,1.33,0.05,1.07,0.48,0.08,-0.83,0.24,-0.19,0.25,-0.79,-0.07,-0.64,-0.35,0.56,-0.65,0.48,0.64,0.24,-0.01,0.76,1.81,1.75,2.48,1.77,0.98,-0.12,0.59,-0.23,1.49,1.06,1.99,1.34,-0.88,0.4,-0.46,0.46,0.13,-1.01,-0.35,-0.52,-0.34,0.27,-0.7,-0.37,0.11,1.21,0.41,0.4,0.45,-1.25,0.17,-1.47,-1.17,-0.92,0.04,-0.36,-0.01,0.32,-0.08,-0.21,-1.21,-1.55,-0.92,-1.01,0.92,0.39,0.04,-0.24,-0.51,-0.46,-0.04,0.04,0.4,0.57,0.15,0.56,-0.4,0.77,-0.17,0.38,0.74,0.78,0.65,0.29,0.13,-0.17,-0.07,-0.04,-0.03,-0.02,0.09,-0.12,0.38,-1.48,-0.01,-0.66,-0.62,0.86,-0.15,0.1,-0.32,1.46,-0.17,0.4,-0.47,-0.28,-0.83,0.04,0.52,-0.11,0.27,-0.68,0.99,-0.07,0.26,0.05,0.32,-0.62,0.09,-0.31,0.4,-1.27,-0.67,-0.99,-2.51,-1.45,-1.4,-0.59,1.17,-0.97,0.15,-0.31,1.39,-0.85,1.13,-0.05,-0.5,0.82,-0.64,0.57,-0.78,0.16,-0.71,0.38,-0.27,-0.28,0.44,-0.12,0.62,-0.35,0.09,-0.59,-1.19,-0.81,-1.21,0.02,0.58,-0.23,0.23,0.1,0.2,-0.1,-0.08,0.53,-0.92,-1.24,-0.06,-0.86,0.42,-0.34,0.63,0.3,-1.46,-1.71,-1.23,-1.58,-0.77,0.73,0.2,1.09,1.6,1.96,0.69,1.41,-0.32,0.79,-0.07,0.43,1.46,-0.04,0.79,-0.21,0.13,-0.86,-0.52,-0.01,-1.79,-0.47,-0.65,-0.64,-0.22,-1.82,-0.2,-1.04,-0.73,-0.72,-1.61,-0.78,0.32,-1.17,-0.27,-0.96,-0.61,-0.64,-0.38,-0.54,0.51,-0.85,-0.02,-1.54,-0.69,-0.12,-0.31,0.33,0.39,0.85,0.22,0.57,-0.97,-0.39,-1.2,-1.02,-1.11,-0.62,-0.01,0.1,2.14,2.55,1.58,1.44,0.47,-1.44,0.25,-0.3,0.16,-1.16,0.26,-0.77,-1.14,-1.95,-1.31,-1.21,0.63,-0.35,0.3,-0.29,1.25,0.94,1.22,0.94,1.33,1.68,1.65,0.66,-0.09,1.6,0.07,0.71,-1.07,-0.28,-0.95,-0.98,1.61,-0.78,1.04,-0.25,0.44,-0.37,-1.1,-0.56,1.06,-0.31,1.34,0.54,0.74,0.76,0.74,1.15,-0.21,1.54,0.19,0.92,-0.41,-0.57,0.06,0.21,-0.66,-0.93,-1.08,-1.52,0.6,0.08,0.96,1.37]},{"a":"lungs","b":"liver","paper":-0.42,"r":-0.31,"pr":-0.41,"xy":[0.79,0.66,0.11,-0.15,0,-0.45,0.5,-1.2,-0.94,0.59,0.51,-0.29,-1.51,0.02,-0.37,0.14,-0.72,0.03,0.4,0.15,0.56,-0.41,-0.07,-0.24,0.54,1.04,0.25,0.27,-0.34,-1.51,0.44,-1.17,0.86,0.76,-0.31,0.83,-1,1.66,-0.93,1.15,-1.5,2.63,-0.12,1.73,-0.37,0.95,-0.19,0.87,-0.65,0.88,0.28,0.57,-0.01,-0.52,-0.32,-0.84,-0.63,1.55,0.4,1.28,1.22,0.33,1.18,0.69,0.55,0.02,-0.26,0.24,-1.02,1.57,-0.29,0.28,0.11,0.29,-0.09,-0.44,0.7,0.28,1.23,0.01,0.39,-0.44,0.72,-0.12,0.2,0.74,0.29,-0.2,-0.08,-1.25,0.67,-0.99,0.03,-0.04,0.5,0.4,-1.11,-0.53,-0.61,-0.57,-1.28,0.57,-0.72,0.29,1.81,-0.44,0.63,-0.29,1.32,-0.2,0.34,-0.28,-0.47,-0.06,-0.23,0.57,-0.61,0.72,0,0.36,0.47,-0.54,0.67,-0.64,-1.05,-0.18,-1.14,0.69,-1.76,-0.34,-0.91,0.64,-1.09,0.39,-0.13,0.91,-0.59,-0.52,-0.04,-1.26,0.54,-1.35,0.99,-1.45,-0.8,-0.04,-0.13,-0.28,0.32,0.74,-0.4,0.35,2.06,0.55,0.34,-0.46,-0.55,1.81,0.27,0.7,0.25,1.22,0.5,0.44,-0.8,1.16,-0.26,0.26,-1.19,0.7,-0.19,-0.28,0.22,0.6,0.44,0.12,0.41,1.33,0.55,-0.12,0.14,-0.53,0.39,0.01,-1.4,0.68,-0.19,1.03,0.52,-1.45,0.29,-0.61,0.46,-0.89,0.25,-1.18,1.36,0.65,0.38,0.18,-0.83,-0.11,-0.03,-0.53,-1.52,2.58,0,0.87,0.81,-0.44,0.23,-0.48,-1.75,1,-0.24,0.53,-1.29,-0.51,-0.14,-0.94,-0.51,-0.43,0.15,0.13,-0.98,-1.07,-0.02,-1.73,0.62,-1.14,-0.73,-0.24,-1.5,2.68,-0.66,1.13,0.43,0.53,0.13,0.77,-0.67,-0.01,-0.38,0.54,0.31,0.32,-0.23,0.44,-1.3,-1.26,0.21,-1.38,-0.35,-0.68,-0.04,-0.72,0.85,0.3,0.33,0.14,0.76,-1.23,0.75,-0.94,0.52,-0.35,0.26,-0.35,0.15,-0.34,-0.27,0.02,0.2,-0.13,0.52,-0.06,0.19,0.11,-0.15,-0.21,0.32,-0.29,-0.15,-0.15,-0.26,-0.13,-0.01,-0.13,-1.16,-0.72,-0.03,-0.22,0.88,0.49,-0.51,0.29,1.72,-0.1,0.35,-0.48,0.4,1.68,0.33,0.59,-1.1,1.29,-1.42,1.33,2.35,-0.37,0.84,0.24,-0.68,-0.2,-0.08,0.24,0,-1.54,-0.02,-0.95,-1.75,-0.55,0.21,-0.01,-1.1,0.38,-0.95,0.36,1.26,-2.07,-0.12,-1.51,-0.45,-0.46,0.59,-0.18,-0.35,0.73,-0.45,0.02,0.85,0.27,0.84,0.25,0.41,-0.74,-0.26,-0.22,0.67,-1.2,0.07,-0.41,-1.23,1.02,-0.44,0.54,-0.01,-0.51,0.19,-0.46,-0.85,3.53,0.2,1.82,-1.47,0.32,-0.47,0.15,0.5,0.68,-0.35,0.52,1.16,-1.87,0.28,-1.6,0.5,-0.93,-0.2,-0.19,0.02,0.47,-0.25,0.87,-0.79,1.99,-0.12,0.2,-0.3,-0.52,0.34,-1.18,0.2,-0.93,0.85,-0.1,2.13,-0.81,0.78,-0.38,-1.65,1.25,-0.74,0.67,-0.04,1.18,-0.12,0.56,-0.97,-1.02,-0.02,-0.29,-0.47,-1.21,0,-1.3,0.41,-0.1,0.08,0.54,-0.46,-0.63,0.16,-0.67,-0.7,1.13,-0.47,0.88,0.66,-0.48,0.52,-1.21,-0.84,-0.26,-0.82,0.55,-0.87,0.79,-1.03,0.75,0.67,-1.54,0.68,-1.85,1.15,-1.34,0.64,0.05,0.51,-0.33,0.01,-0.98,0.21,-0.62,-0.09,-0.87,0.1,-0.84,0.53,-0.54,2.41,-0.52,1.74,-0.1,0.62,-1.64,0.69,-0.03,1.47,-0.24,0.44,-0.91,0,0.54,-0.04,0.46,0.15,1.37,-0.47,1.3,-0.42,1.5,-0.82,0.84,0.47,0.42,0.93,0.69,-0.3,0.58,-0.35,0.41,-0.69,0.65,0.02,0.27,1.68,-0.98,1.13,-1.11,1.14,-0.44,0.36,0.29,0.18,-0.55,0.05,0.03,-0.12,0.6,-0.13,-0.16,-0.81,1.24,-0.66,0.38,0.32,-0.16,0.33,0.08,-1.22,1.43,-0.8,1.41,-1.56,0.67,-1.28,0.94,0.06,2.21,0.06,1,1.49,-0.2,0.3,-0.62,1.07,-0.06,0.14,-0.03,-0.16,-0.75,-0.17,-0.45,0.24,-0.93,-1.02,0.48,0.46,0.24,0.65,0.54,-0.29,1.15,-0.3,1.94,-1.88,2.16,-1.59,2.27,0.76,-0.91,0.56,-0.28,-0.13,-1.06,0.42,-0.47,1.08,-2.22,0.13,-2.11,-0.21,-0.33,0.46,-0.79,0.57,-0.73,1.27,-0.85,-0.65,1.29,-0.69,1.27,0.76,-1.46,1,-1.38,1.13,-0.55,-0.41,-0.03,-0.17,0.92,-0.01,0.2,-0.66,0.18,0.01,0.35,1.19,-0.5,0.16,-0.23,-0.59,-0.16,-0.74,-0.05,-0.07,-0.1,-0.19,-1.29,-0.65,-3.34,-0.02,-2.54,-1.45,0.78,0.09,-0.52,0.01,1.13,-0.49,0.65,-0.55,0.11,-0.93,0.03,-1.9,2.5,-0.56,0.93,0,-1.05,0.49,-0.99,-0.82,1.98,-0.56,2.29,1.34,0.13,0.61,0.57,-0.19,-0.37,0.48,-0.92,1.65,-0.12,1.01,0.75,-1.56,1.44,-0.01,1.37,-1.84,0.49,-1.06,-0.02,0.63,0.09,-0.08,0.18,-0.78,0.97,-0.37,0.63,1.43,-0.35,0.29,-0.25,0.75,-1.33,-0.68,-1.13,2.55,-0.07,1.29,0.16,1.5,-0.6,0.98,-0.32,0.93,0.22,0.79,-0.19,-0.27,-1.45,0.08,-1.24,0.29,-0.77,0.37,-0.8,0.8,-0.43,0.55,0.35,1.26,-0.59,0.29,0.16,0.53,1.06,-0.52,1.01,0.17,-1.19,-0.83,-0.2,0.05,0.5,0.02,1.22,0.07,-0.35,0.41,-0.62,1.56,1.24,0.11,1.3,-0.82,-1.76,-0.34,-1.16,0.34,-0.49,0.31,-0.36,-0.08,1.04,0.31,0.08,-0.58,-1.42,-0.8,-0.49,-0.84,0.31,-0.7,1.26,0.23,0.52,-1.27,0.71,-1.57,0.45,-0.01,-0.7,0.56,1.97,0.37,1.17,0.63,-0.98,0.34,-1.38,-1.02,0.55,-0.5,0.63,-0.01,1.75,-0.01,0.78,0.19,1.18,-0.04,1.04,0.85,-0.14,0.29,-0.7,-0.43,-1.39,-0.75,-0.99,0.36,0.64,-0.4,1.11,-0.93,1.29,-0.25,0.38,1.63,-0.65,0.72,-0.83,0.26,-0.39,-0.1,0.1,-0.06,-1.09,0.21,-0.72,-0.3,-1.27,0.1,-1.45,0.85,1.1,0.29,0.34,-0.59,0.18,-0.24,0.33,-0.91,-0.68,-0.48,-0.55,1.44,0.12,-0.53,0.79,0.65,0.33,0.99,0.7,-0.75,0.89,-0.88,-0.02,-0.66,0.16,-0.3,0.55,-0.09,0.3,0.76,0.04,-0.11,-0.49,0.63,-0.74,-0.35,-1,0.53,-1.73,0.4,0.24,0.17,-0.14,-0.01,-1.11,0.15,-0.68,1.39,-0.98,0.76,-0.32,0.57,0.18,0.05,0.49,0.97,-0.13,0.44,-0.97,-0.04,-1.03,0.92,-1.5,-0.26,0.84,-0.38,0.89,0.63,-2.03,-0.05,-0.55,-0.15,0.56,-0.51,0.12,0.3,-0.55,0.37,-0.07,0.52,0.41,1.3,0.57,0.1,0.5,0.3,0.08,0.42,-1.44,-0.45,-0.6,-0.99,-1.23,-0.28,-0.9,0.07,-0.44,0.27,-0.3,0.01,-0.49,0.34,-0.14,-0.11,-0.43,-0.35,-0.61,1.16,-1.2,0.43,-1.13,-1.02,0.34,-0.57,0.47,0.3,0.56,-0.22,0.25,0.49,0.24,0.21,0.11,-0.2,-0.89,-0.06,-0.46,-0.9,0.44,-1.34,-0.38,-1.04,-0.26,-0.14,0.13,-2.14,1.25,-0.83,1.6,0.4,-0.42,0.66,-0.59,-0.66,1.26,-0.28,1.06,-0.69,2.35,-0.3,1.59,0.2,-1.52,-0.36,-0.57,1.37,1.22,0.37,1.11,0.86,-0.26,0.78,-0.43,-0.79,-0.85,-0.03,-0.74,-0.9,0.11,-0.24,0.33,1.87,0.42,0.09,0.79,0.1,0.04,-0.49,0.15,-0.33,-0.21,0.12,0.59,-1.18,-0.43,-0.55,-1.28,0.69,-0.58,-0.24,-0.59,-1.04,-0.82,-1.13,-0.62,-0.19,-1.4,-0.38,-0.08,-0.65,2.05,-0.89,1.04,0.74,0.24,0.41,-0.48,0.67,-0.65,0.62,-0.21,0.66,-0.5,0.26,-0.25,-0.79,-0.35,0.21,-0.06,0.24,1.63,0.05,0.63,0.38,-0.3,1.18,-0.32,1.37,-0.46,1.25,-0.23,1.09,0.39,0.51,0.16,1.5,0.13,0.62,-1.01,1.31,1.32,0.25,0.87,-0.49,-0.24,-0.38,0,0.66,-2.01,1.16,-1.52,0.73,-0.9,0.16,-0.67,1.99,0.8,0.66,0.16,0.84,1.53,0.44,0.27,-0.41,-0.66,-0.23,-0.74,-0.72,1.54,0.09,0.91,-0.8,0.55,0.34,-0.67,2.52,-0.77,1.64,-1.32,0.26,1.1,-0.01,1.15,1.15,1.51,0.38,0.82,-0.91,1.14,-0.11,0.92,1.16,-0.03,0.18,-0.53,-1.43,1.4,-0.35,0.8,-1.48,1.16,-0.41,0.02,-0.78,1.79,-0.56,1.12,-0.36,-0.08,0.32,1.09,0.23,0.77,-0.2,0.97,-0.55,0.23,-0.97,-0.16,-0.14,-0.49,-0.19,-0.56,-1.03,1.88,-0.12,0.89,0.25,-1.43,0.3,-0.93,-1.18,0.17,0.07,0.28,0.68,0.35,0.47,0.02,-0.56,2.01,-0.33,1.08,1.36,-1.32,0.41,-0.36,1.01,-0.47,1.19,-0.55,-0.62,-0.04,-1.17,0.27,-1.98,0.84,-1.19,0.45,0.24,1.16,0.08,1.12,0.04,0.19,1,-1.28,1.07,0.83,0.86,0.71,0.17,0.15,0.04,-0.43,0.43,0.65,-0.44,0.24,0.7,-0.43,0.37,-0.64,-0.6,-0.84,0.03,-0.47,0.09,1.89,0.54,1.31,-1.16,-1,-0.77,-0.41,-0.52,-0.76,-0.25,-1,-0.44,1.25,-0.48,0.58,1.11,-1.1,1.14,-1,-0.37,0.81,0.24,0.66,1.23,0.28,1.14,0.26,-0.76,0.75,-0.25,-0.22,-0.84,0.18,-0.08,-0.08,0.74,-0.15,0.17,0.88,0.58,-1.17,0.3,-0.63,1.11,-2.51,0.22,-1.82,0.39,-1.05,0.29,-0.96,-0.95,-1.41,-0.9,0.14,0.81,-1.71,-0.31,-0.76,1.23,-1.19,-0.12,-1.13,-0.58,1.11,-0.68,1.2,0.26,-0.26,-0.01,-0.69,-0.27,2.13,-0.08,1.57,-0.22,0.39,0.29,0.34,-0.51,1.32,-0.51,0.78,-0.16,-0.59,0.58,-0.41,-0.73,1.35,0.08,0.26,1.36,-0.82,0.62,-0.87,0.19,-0.61,0.09,-0.46,-1.76,-0.16,-0.34,-0.06,0.47,0.31,0.93,-0.57,0.23,0.04,-0.2,-0.08,-0.18,0.5,-0.63,0.53,1.37,1.16,0.63,1.13,-0.58,-1.01,-0.57,-0.01,-2.55,0.22,-0.75,0.07,1.23,0.45,0.62,0.45,1.43,-0.07,0.59,-0.69,-2.38,-0.78,-0.62,-1.13,-1.43,1.07,-0.72,1.02,0.15,0.41,0.2,0.4,0.36,0.31,0.45,-0.37,-0.67,0.11,-0.61,0.2,0.3,-0.6,0.08,0.47,0.18,0.25,-0.51,1.16,-0.98,-1.3,-0.56,-0.62,0.19,-0.16,0.65,-0.7,-0.31,0.27,-0.42,0.77,1.03,1.26,0.35,0.37,-0.23,-0.03,-0.83,-0.27,1.4,-0.3,0.97,-0.4,-0.67,0.12,0.13,0.27,0.44,1.13,0.34,1.52,-0.92,0.04,-0.99,0.81,0.2,-0.27,0.24,0.57,0.5,-0.66,-0.79,-0.54,-0.08,-0.55,0.26,-1.41,0.07,-0.68,0.96,-1.41,-0.92,-0.05,-0.54,-0.05,0.61,0.41,0.13,0.35,1.52,-0.03,0.5,0.31,0.08,1.19,0.04,0.43,-0.13,-0.81,-0.26,-0.8,0.01,0.46,-0.21,0.27,-1.44,0.06,-0.96,0.36,-1.02,-1.02,-0.36,-0.38,-0.65,0.97,-1.06,1.18,-0.84,-0.72,0.63,-0.94,-0.03,1.92,-0.49,1.02,0.05,0.55,-0.03,-0.32,0.8,0.29,0.37,-0.35,0.45,-0.73,0.71,-0.02,-0.44,-0.23,0.53,-0.29,-0.7,1.2,-1.82,1.45,1.01,-0.27,1.21,0.27,-0.35,-0.93,0.23,-0.98,2,-1.07,1.12,-1.11,-1,-0.86,-0.8,-0.11,0.6,0.71,0.77,-0.05,-0.52,0.74,-0.51,1.25,1.59,-0.47,1.3,-0.97,0.46,0.81,0.52,0.46,0.75,-1.36,-0.04,-0.27,-0.23,1.19,-0.13,0.56,-1.98,1.96,-0.4,0.54,-1.73,1.37,-0.75,1.62,-0.01,0.21,-0.21,0.74,-1.16,-2.15,-0.45,-0.74,0,0.24,0.55,0.64,1.13,-0.82,1.07,-1.02,-2.44,-0.49,0.02,0.09,-0.48,0.07,0.63,-0.21,-1.26,2.24,-0.53,0.74,0.64,-0.87,-0.16,-0.82,-0.56,1.74,0.36,1.15,-0.12,-1.36,0.8,-0.96,1.76,0.16,0.56,-0.35,-0.94,-0.77,-0.09,-0.7,-0.48,-0.86,-0.33,0.13,1.49,0.75,-0.25,1.16,-0.83,1.87,0.02,1.26,0.63,-1.6,0.52,-1.13,-0.46,-1.96,0.74,-1.2,-0.97,-1.49,-0.25,-0.8,1.54,-1.04,0.13,0.35,-1.38,1.32,-0.45,1.39,-0.26,0.68,-0.65,0.13,-1.51,-0.22,0.06,-0.49,-1.35,0.44,-0.3,-0.33,1.42,-0.54,0.16,-1.08,0.59,-1.43,-0.38,-0.15,-0.11,1.23,-0.16,0.93,0.27,-1.78,1.11,-1.83,-1.2,1.4,-0.84,0.49,-1.22,-0.35,0.09,-0.93,-0.72,1.43,-1.23,1.14,0.43,0.04,-0.15,0.64,1.39,0.01,0.59,-0.13,1.64,-0.68,0.82,-1.07,0.95,1.15,0.2,1.33,0.2,-1.3,0.01,-0.86,-1.38,-0.94,-0.71,0.3,-0.17,-0.27,-0.38,-0.35,0.33,-0.55,0.57,-0.29,-0.29,0.19,-0.86,0.33,0.4,-1.87,-0.29,-0.71,-0.82,0.66,-0.01,0.79,0.04,1.93,-0.33,1.14,-1.5,1.01,-1.29,1.06,0.52,-1.13,0.68,-1.02,-2.44,1.71,-0.52,1.06,-0.08,-0.28,-0.87,0.65,-0.54,0.87,-0.1,1.08,0.44,-0.68,0.36,-0.29,1.39,-0.46,0.34,-0.31,1.09,-1.53,0.24,-0.13,-2.35,1.51,-1.7,0.6,-1.3,-0.33,-0.96,-0.18,0.95,-2.02,0.32,-0.61,1.06,-0.08,0.59,0.05,-0.41,-0.75,-0.09,-0.93,0.77,-0.7,0.78,-0.82,-1.51,0.1,0.41,-0.35,0.36,1.05,1.24,-0.03,1.63,0.19,0.44,0.05,0.04,0.63,0.63,0.23,-2.42,0.36,0.07,-0.88,-1.5,-0.14,-1.19,0.25,0.85,1.64,-0.28,1.13,-0.72,1.38,-1.41,2.15,1.16,0.36,-0.66,0.63,-0.44,1.23,-0.42,0.46,0.13,0.46,-0.49,0.05,-0.92,0.22,-0.18,0.52,1.24,-1.58,1.22,-1.16,1.19,-0.67,0,0.14,0.5,-1.11,0.85,-1.7,0.12,0.48,-0.42,0.36,1.58,0.16,0.57,-0.12,-1.82,0.12,-0.6,-0.05,-1.32,1.58,-1.22,1.4,0.11,1.24,-0.52,1.09,-2.36,0.27,-0.29,0.87,0.42,0.18,-0.51,0.52,1.2,-0.11,0.63,-0.35,1.19,-0.48,0.86,-0.2,-0.84,-0.23,-0.76,-0.41,1.24,0.21,0.61,0.43,0.33,-0.58,-0.86,-1.13,-0.17,1.07,-0.74,0.48,0.69,-0.42,0.24,-0.73,0.8,-0.07,0.67,-0.33,0.2,-0.51,-0.49,-0.53,-0.69,0.14,-0.63,0.53,0.58,1.45,-0.43,1.09,-0.76,0.54,-0.08,0.8,-0.07,0.28,0.35,-0.9,-0.47,0.97,-0.54,0.85,1.13,-0.64,0.42,0.09,0.22,0.88,0.42,0.37,0.71,0.11,0.21,0.24,-0.99,-0.36,-0.87,0.06,0.34,-0.84,0.5,-1.07,2.43,-1.21,0.54,-1.01,0.52,1.22,-0.53,0.59,0.17,1.03,-0.01,-0.08,1.31,-1.53,1.66,-1.45,0.76,-0.04,0.98,-0.32,0.12,1.15,0.56,0.7,0.89,-0.57,0.21,-0.31,-0.27,-0.04,0.52,-0.18,-0.48,-0.81,-0.34,-0.51,-0.69,1.32,-0.74,1.1,0.47,1.22,0.58,-0.05,-0.79,0.94,-0.11,1.15,-1.87,0.38,-0.2,0.13,0.58,1.25,-0.11,1.28,-0.73,0.53,-0.16,0.68,0.11,1.39,0.05,0.81,0.99,1.44,0.74,0.22,0.66,0.71,0.4,0.39,-1.01,0.91,-0.99,0.45,0.62,-2.01,0.75,-2.05,-0.67,-2.03,0.03,-0.52,0.81,0.3,-0.12,-0.12,-0.14,-0.13,-0.64,0.19,1.1,-1.47,0.19,-1.39,-0.79,-0.89,0.36,-0.24,0.72,0.8,0.04,0.03,0.84,-1.49,0.1,-1.71,-0.88,1.19,-0.25,1.19,-0.62,-0.05,-0.37,-0.33,0.76,-0.26,0.02,0.85,0.55,0.4,-0.12,0.8,1.33,-0.28,-0.02,0.27,0.08,-0.43,0.16,-0.18,0.37,-0.74,0.58,-0.64,0.55,-1.89,0.55,-1.44,-1.84,1.41,-1.01,0.79,0.35,-1.46,-0.05,-0.46,1.24,1.35,-0.36,0.31,-0.41,0.36,-0.88,-0.57,0.45,-0.26,0.54,-0.15,-0.51,0.03,-0.36,0.44,0.7,1.54,0.12,0.92,1.46,0.27,0.78,-0.35,1.57,-1.97,0.84,-1.44,1.32,-0.33,0.57,-0.89,1.88,-1.25,0.44,-1.11,-1.22,2,-0.37,1.12,-0.51,-0.01,-0.93,0.44,0.2,-0.81,0.46,-0.97,0.71,0.86,0.27,0.31,-0.16,1.07,-0.35,1.37,1.21,-2.75,0.91,-1.45,-0.54,0.02,-0.48,-0.11,1.05,1.35,0.24,0.8,-1.09,-1.56,0.11,-1.72,1.17,0.02,-0.02,-0.14,-0.17,-0.3,0.23,-0.77,-0.91,-0.02,-1.07,-0.14,-0.61,0.51,-0.03,-0.68,0.88,0.28,-0.02,0.23,-0.56,1.16,-0.07,0.65,-0.37,-1.36,-0.46,-0.61,0.28,0.18,-0.44,0.13,0.3,-0.47,-0.33,0.12,-0.65,-1.02,-0.51,-1.17,0.21,-1.72,0.38,-1.55,-0.16,-0.87,0.13,-0.04,-0.12,-0.79,0.78,-0.4,-0.26,0.94,0.19,0.37,-0.64,1.46,-0.75,1.02,-1.54,0.82,-0.47,1.14,0.54,-0.94,-0.89,0.15,0.65,0.97,-0.24,0.56,-0.63,-0.14,0.05,-0.37,0.56,-0.9,0.7,-0.78,-0.11,0.99,0.74,-0.08,-0.41,0.67,0.02,0.2,-1.72,1.42,-0.32,0.45,1.04,-1.24,0.66,-1.05,-0.85,0.56,-0.41,-0.15,1.22,-0.38,0.13,0.07,-0.99,0.36,-1.03,0.59,0.13,1.22,0.07,0.03,-0.07,0.14,0.43,-0.97,-1.24,-0.11,-0.28,-0.35,0.52,-0.1,-0.49,-0.19,-0.32,0.22,-0.89,-0.23,-2.03,1.22,-1.03,1.91,-0.58,-1.1,0.36,-1.17,0.86,-0.81,0,-1.06,0.01,0.6,-0.12,0.81,-0.63,1.49,-0.91,1.5,-2.84,2.73,-0.91,1.55,-1.17,0.05,-0.27,-0.02,-2.51,1.17,-0.6,1.04,0.61,-1.27,0.33,-0.93,0.39,-0.33,0.07,-0.66,0.97,-1.14,1.34,-2.25,-0.46,1.36,-1.09,0.34,2.59,0.58,0.78,0.27,1.27,0.43,0.34,0.39,-1.02,-0.94,-0.2,-0.86,-0.51,0.02,0.21,-0.21,-1.01,0.6,-0.26,1.2,1.57,0.11,-0.16,1,0.05,-0.25,-0.09,-0.33,-0.83,-0.53,-0.02,-1.11,-0.79,1.58,-1.04,1.51,0.56,-0.35,1.24,-1.24,0.24,2.06,0.36,1.35,1.75,-0.41,0.17,0.18,-0.12,-0.06,-0.53,-0.23,1.06,-0.61,0.21,-0.39,0.4,-0.93,0.86,-0.38,-1.01,1.69,-0.43,0.43,0.27,0.66,-0.14,0.69,1.21,-1.58,0.23,-0.26,-1.25,0.72,-1.79,0.7,-0.92,-2.13,0.26,-2.19,0.32,-1.3,0.16,-1.1,-1.55,0.67,-0.58,0.48,0.39,-0.23,-0.24,-0.09,-0.46,-0.36,0.11,-0.17,0.57,1.27,0.25,0.77,0.77,-1.4,0.86,-1.29,0.78,-0.83,0.08,-0.67,-0.17,-0.65,0.01,-0.01,-0.02,-0.99,0.1,-0.95,-1.48,1.51,-0.95,1.01,0.86,-1.3,0.39,-0.64,1.46,-0.42,0.45,0.19,-0.28,0.04,0.64,-0.29,-0.11,0.18,-1.09,0.83,-0.07,0.53,-0.17,0.23,-0.62,0.98,-0.37,0.04,-1.27,2.32,-0.7,0.45,-1.45,0.21,-0.12,1.39,-0.97,3.55,-0.97,1.91,-0.85,1.43,-0.87,0.4,0.82,0.98,0.69,0.95,0.16,0.05,0.79,0.12,-0.28,-0.62,-0.25,-0.49,-0.35,0.25,-0.69,0.17,-0.81,0.71,0.61,0.57,-0.23,0.01,0.1,-0.5,-0.1,0.94,0.59,-0.01,-1.24,-0.08,-0.85,0.08,-0.34,-0.15,-0.03,-0.18,-1.71,0.14,-0.61,-0.69,0.73,0.06,0.83,0.44,1.96,0.3,1,-0.07,0.79,-1.47,0.71,-0.82,-0.04,-0.43,-0.51,-0.67,-0.86,1.89,0.13,0.65,-0.47,-1.45,-0.45,0.73,-1.82,0.99,-1.04,0.43,-0.72,0.97,0.08,0.51,-1.17,-0.16,-0.34,-1.54,-0.64,-1.22,-0.02,-0.93,-0.85,-0.09,-1.25,-0.95,-0.12,-0.2,0.47,0.2,0.85,-1.06,0.74,-1.01,-0.39,-1.54,0.01,-0.96,-0.62,-2.1,0.65,-1.85,2.55,-0.19,0.51,-0.2,-1.44,2.1,-0.65,0.68,-1.16,1.27,-1.09,0.53,-1.95,1.18,-0.52,0.44,-0.35,-0.57,-0.31,-0.56,0.94,0.93,-0.05,0.77,1.68,-1.66,-0.12,-0.84,1.6,-1.03,0.73,-0.22,-0.28,-1.49,0.1,-1.66,-0.78,1.43,-0.71,-0.63,-0.37,1.81,0,0.43,-0.31,0.89,-0.55,0.89,0.76,1.26,0.11,1.99,1.54,-0.94,0.83,-0.09,-0.57,-0.22,0.04,0.45,-0.93,0.35,-1.26,1.41,0.08,2.19,0.09,2.3]},{"a":"intestine","b":"marrow","paper":0.37,"r":0.28,"pr":0.3,"xy":[0.96,-0.43,0.94,-0.17,0.59,0.11,0.71,0.32,0.56,0.35,0.42,0.24,-0.23,-0.33,-0.25,-0.35,1.72,-2.31,1.46,-2.1,0.69,-0.49,0.63,-0.4,0.03,-0.06,0.09,0.12,0.24,-0.09,0.77,0.02,0.08,0.25,0.07,0.5,0.45,-1.7,-0.62,-1.82,0,0.9,-0.57,0.32,-0.31,-1.38,-0.3,-1.36,0.91,-0.44,0.28,-0.97,-1.65,-0.41,-1.43,0,0.24,-0.76,0.46,-0.86,0.02,0.01,0.66,-0.23,-0.56,0.85,-0.25,1.08,-0.06,-0.26,-0.57,-0.09,0.1,0.03,-0.11,0.03,1.19,1.14,1.52,0.97,1.79,0.56,2.13,0.55,0.73,-0.79,0.68,-0.67,-0.11,1.22,0.25,0.85,-0.68,0.01,-0.15,-0.13,1.6,0.23,0.96,0.41,-0.18,-0.04,-0.31,0.3,-1.64,-0.53,-0.92,-0.15,-1.5,-0.05,-1.18,-0.11,-0.59,0.54,-0.17,0.56,-0.09,0.98,-0.14,1.13,0.26,0.76,0.67,0.84,-0.3,-1.52,-0.09,-1.06,-0.42,-2.1,-0.29,-1.78,-0.23,0.72,0.14,0.52,1.49,1.33,0.87,1.21,-0.21,-1.06,0.3,-1.15,-0.54,-0.77,-0.42,-0.77,-1.76,-0.06,-1.87,-0.04,-0.79,-1.42,-0.31,-1.02,-0.81,-0.19,-1.2,-0.3,1.6,-0.3,0.93,-0.64,-0.7,-0.5,-1.4,-0.66,1.27,-1.6,0.55,-1.47,0.83,0.99,0.63,0.65,0.12,0.55,-0.03,0.61,0.01,-0.03,0.58,0.1,0.12,-0.95,0.64,-0.97,-0.1,1.26,0.19,1.31,0.14,0.17,0.06,0.22,-0.8,-0.2,-0.7,-0.17,0.19,0.65,0.05,0.77,1.14,-0.24,0.36,-0.55,0.12,1.92,0.18,1.89,1.01,-0.25,0.44,-0.4,1.12,1.17,1.13,1.45,0.45,0.95,0.39,0.55,-1.25,-1.77,-1.66,-1.62,-0.86,-1.3,-0.65,-0.91,1.57,-1.04,-0.33,-1.53,-0.44,-0.76,0,-0.58,0.4,0.57,0.75,0.72,1.06,1.03,0.93,1.03,1.22,0.51,1.76,0.86,-0.16,-0.28,-0.28,-0.31,-0.18,-0.05,0.39,0.22,-1.85,-1.08,-1.35,-0.86,0.16,0.53,0.15,0.59,0.7,0.61,0.44,0.6,-0.76,-0.25,-0.05,-0.1,0.23,1.43,-0.02,1.26,-1.35,-1.08,-1.12,-1.03,1.55,1.2,1.45,1.24,1.35,1.05,1.73,1.24,0.08,-2.1,-0.95,-2.31,-0.25,-0.14,-0.1,0.17,0.93,1.3,0.41,1.08,0.25,-0.58,-0.17,-0.28,-1.37,0.57,-0.62,0.57,-0.62,0.95,-0.67,0.68,-1.4,-1.55,-0.85,-1.11,1.16,0.27,1.38,0.17,0.13,0.02,-0.59,0.12,-0.89,-0.28,-0.54,0.03,-1.66,-0.49,-0.87,-0.4,0.93,0.35,-0.13,0.29,-1.15,-1.05,-0.42,-0.96,-1.92,-1.28,-1.69,-1.11,-0.52,0.36,-0.1,0.42,0.16,-0.35,-0.34,-0.42,0.48,-0.61,0.54,-0.57,1.45,0.42,0.92,0.17,-0.49,-0.68,-0.67,-0.49,1.2,0.1,0.5,-0.05,0.48,-1.22,0.65,-0.69,-0.32,1.24,-0.21,1.23,-0.03,-0.43,-0.18,-0.66,1.14,0.06,0.1,-0.17,1.56,0.38,1.15,0.25,0.08,-1.91,0.73,-2.15,-0.9,-0.81,-0.11,-0.64,2.05,-0.63,1.22,-0.54,-0.51,-0.58,-0.6,-0.7,-0.3,-0.2,0.26,-0.23,1.57,0.1,1.29,0.32,0.08,2.48,0.56,2.24,-0.14,-1.63,-0.15,-1.6,-0.6,0.56,-0.51,0.52,0.73,0.9,0.41,0.76,-1.72,-0.3,-1.76,-0.16,-0.86,0.75,-1.43,0.71,-0.03,-0.31,0.06,-0.28,-0.86,-0.62,-0.15,-0.55,0.51,-2.06,0.47,-1.38,-0.79,0.3,-0.79,0.48,-2.06,-1.69,-1.43,-1.57,-1.23,-0.42,-0.38,-0.66,0.84,0.25,1.47,0.17,1.34,1.7,0.51,1.56,-0.47,0.57,-0.52,0.31,0.07,1.03,-0.12,1.14,0.36,0.84,-0.39,0.95,-0.24,0.79,0.29,0.52,0.9,1.87,0.42,1.59,0.06,-1.47,0.1,-1.51,-0.62,0.71,-0.05,0.62,-0.13,-1.03,0.13,-1.14,-1.31,-0.18,-1.21,-0.49,1.63,0.93,0.97,0.99,1.15,1.39,0.67,1.49,0.43,-0.57,0.62,-0.68,-0.92,0.26,-1.12,0.13,0.95,-0.52,0.64,-0.14,-0.53,-0.08,-1.38,-0.6,-0.6,-0.65,-0.67,-0.59,-0.35,0.7,-0.48,0.68,-1.65,-0.97,-1.27,-0.56,-2.24,-2.09,-2.15,-1.6,-0.29,-0.16,-0.22,-0.56,0.13,0.81,0.15,0.52,-1.01,0.01,-1.4,0.18,-0.62,-1.14,-0.27,-0.99,0.52,-1.97,0.62,-2.23,0.26,-0.7,-0.18,-0.52,-0.48,0.36,-0.68,0.29,0.77,-0.54,0.74,-0.86,-0.29,-0.01,-0.58,0.17,0.3,0.09,0.73,0.17,0.83,0.96,1,1.1,1.08,1.93,1.01,1.93,-0.18,-0.15,-0.32,-0.3,0.78,1.41,1.05,1.59,-1.07,-1.23,-1.09,-1.09,-0.48,0.76,-1.2,0.74,-1.59,0.81,-0.43,1.31,0.9,0.46,0.66,0.57,0.55,0.11,0.28,0.14,-0.95,0.61,-0.89,0.86,2.43,-0.66,1.59,-0.59,0.4,-0.03,0.41,-0.29,0.09,0.08,0.07,0.26,-0.28,0.13,-0.09,-0.26,1.7,-0.01,1.59,0.04,-0.64,-0.89,0.15,-1.01,-0.3,-1.34,-0.47,-1.66,1.33,0.95,1.23,1.25,0.61,-0.94,0.32,-0.89,-1.27,-0.13,-0.94,0.08,-1.94,0.77,-1.22,1.09,0.68,-0.44,0.53,0,-0.37,0.73,0.17,0.52,-0.14,-0.78,0.2,-0.93,-1.95,-0.51,-1.82,-0.64,-0.98,-1.08,-1,-1.19,1.03,-0.49,1.06,-0.41,-1.46,-0.36,-1,-0.77,-0.1,0.11,0.18,0.08,1.85,0.71,1.04,0.75,-0.76,-1.11,-0.55,-0.73,1.17,-0.36,1.3,-0.44,0.55,-1.16,0.55,-0.98,-1.05,-0.75,-1.16,-0.91,-0.68,-0.96,-0.5,-0.78,-1.3,-0.45,-0.95,-0.41,1.4,0.69,0.98,0.72,-1.41,2.01,-0.72,2.31,-1.11,0.84,-0.99,0.73,-0.47,-1.01,-0.51,-0.65,1.04,0.51,0.76,0.69,-0.44,-0.56,-0.77,-0.79,0.53,0.21,0.65,0.51,1.73,1.54,1.35,1.42,0.51,-1,0.32,-1.04,0.92,0.83,0.8,0.86,0.46,-0.16,0.14,-0.08,-0.52,0.92,-0.71,0.98,-1.24,0.43,-1.14,0.47,-0.31,0.3,-0.53,0.21,-0.82,0.45,-0.44,0.48,-1.59,0.27,-1.02,0.2,-0.79,0.14,-0.12,0.47,0.1,-0.61,-0.14,-0.44,-1.03,0.92,-1.01,0.79,-0.2,-0.09,-0.02,-0.05,0.46,-0.09,0.17,-0.07,-0.83,-0.99,-1.04,-0.95,-0.72,-0.11,0.14,-0.06,1.77,1.14,1.1,1.54,-1.84,-1.33,-1.53,-1.19,0.28,-1.22,0.56,-1.52,1.25,-0.54,0.96,-0.71,1.02,-0.23,1.41,0.07,1.25,0.83,0.78,0.8,-0.98,-0.4,-0.67,-0.36,0.84,0.85,1.66,1,-0.16,0.12,-0.03,0.11,1.52,0.19,0.95,0.11,1.07,1.67,1.68,1.67,0.82,-0.39,0.57,-0.28,-3.23,-0.7,-2.57,-0.84,0.77,0.43,0.18,0.32,-0.07,-1.58,0.14,-1.57,0.39,-0.14,1.26,-0.37,0.09,-0.01,0.09,0,0.29,-1.24,0.46,-0.8,0.32,-1.01,0.6,-0.76,1.57,0.29,1.36,0.28,0.24,1.13,0.62,1.06,0.31,0.06,0.07,0.26,-2.6,-1.03,-2.36,-1,-0.13,0.19,-0.75,-0.19,1.68,1.9,1.24,1.89,1.36,1.09,1.61,1.31,-1.24,-1.64,-0.75,-1.34,-0.29,-0.27,-1.11,0.04,0.71,0.25,0.71,0.23,1.65,1.13,1.29,0.97,-0.43,-0.44,-0.25,-0.5,1.8,1.89,1.26,1.54,0.79,-0.21,0.14,-0.25,-0.69,1.39,-0.59,1.54,-1.26,0.2,-1.27,0.01,-0.07,0.21,0.08,0.19,-0.43,0.3,-0.15,0.62,-0.71,0.66,-0.49,0.76,-0.57,-1.86,-0.4,-1.66,-0.77,1.27,-0.89,1.46,-1.66,-0.22,-1.18,-0.27,1.7,-0.58,0.84,-0.49,-0.63,-1.39,-0.74,-1.28,-0.29,-0.38,-0.58,0.08,-0.37,-1.64,-0.32,-1.45,-0.4,-1.55,-1.06,-1.25,0.41,-0.93,-0.17,-1.09,-0.69,-0.46,0.24,-0.47,-1.98,-0.08,-1.63,-0.23,-0.31,0.39,0.12,0.38,0.21,-0.56,-0.43,-0.69,1.9,-1.01,1.81,-1.43,0.89,-0.13,1.65,-0.16,0.41,0.38,0.46,0.13,0.15,0.04,0.32,0.06,0.21,0.95,0.08,0.77,-0.62,0.25,-0.67,0.2,-0.25,0.86,0.39,0.71,-0.02,0.43,0,0.37,1.37,-0.59,0.93,-0.96,-0.57,0.51,-0.93,0.25,-0.31,-0.03,-0.8,-0.17,-0.2,-0.76,-0.37,-1.08,1.26,-1.69,0.4,-1.83,2.17,0.53,2.33,0.65,0,1.15,0.18,1.26,-0.16,-0.22,-0.58,-0.56,-1.28,-1.24,-1.47,-1.49,-0.81,0.21,-0.68,0.37,0.17,-0.23,0.07,-0.14,1.56,1.38,0.69,1.4,2.33,1.34,1.81,1.43,-1.28,0.45,-0.1,0.21,-0.64,2.04,-0.59,1.92,-0.55,0.31,-1.03,0.58,-0.41,0.14,-0.33,0.4,0.39,-0.78,-0.24,-1.13,-0.58,-1.41,-0.11,-1.2,0.31,0.16,0.78,0.26,1.61,0.85,1.48,0.79,0.32,-1.35,-0.34,-1.33,-0.31,-0.5,0.65,-0.17,-0.45,-0.92,0.19,-0.86,0.11,-0.29,-0.53,-0.03,-0.95,0,-1.16,0.13,0.18,-1.72,-0.02,-1.78,0.87,-0.82,0.7,-0.86,-0.07,1.74,0.65,1.68,1.34,2.71,0.69,2.51,-0.51,-1.27,-0.95,-1.14,-0.04,-1.73,0.21,-1.32,-0.19,0.83,-0.04,0.85,-0.24,0.97,-0.68,0.29,0.15,0.66,0.17,0.92,-0.15,0.83,-0.36,0.82,1.88,-0.69,1.27,-0.42,0.35,0.79,1.02,0.76,-1.24,-0.16,-1.26,-0.44,-0.16,-1.47,0.41,-1.55,0.25,1.39,-0.48,1.06,0.4,0.38,0,0.22,-1.75,-1.9,-0.98,-1.78,-0.17,-2.3,-0.12,-2.2,-1.33,-1.18,-0.52,-0.65,0.07,0.65,0.52,0.81,-1.78,-0.25,-1.66,-0.21,-1.06,-0.94,-0.9,-0.47,-1.01,0.64,-0.67,1.1,2.55,1.18,1.97,1.25,0.2,-0.29,-0.04,-0.19,1.49,0.46,1.19,0.38,0.22,-1.03,0.32,-0.86,0.58,0.91,-0.09,0.99,-1.17,0.73,-0.14,0.72,0.96,1.81,0.6,1.68,0.96,1.76,1.15,1.67,0,0.22,0.22,0.4,0.82,-0.32,0.9,-0.04,0.07,0.06,0.23,0.04,0,-0.57,0.41,-0.25,0.14,-0.33,-0.28,-0.26,-1.13,-1.59,-1.14,-1.88,0.27,-0.55,0.75,-0.25,-0.15,0.35,-0.37,0.39,-1.43,-0.3,-1.05,-0.35,0.78,0.04,0.78,0.24,0.6,0.68,0.18,0.83,0.54,-0.6,0.02,-0.56,-0.72,-0.23,-0.47,-0.21,0.41,0.53,0.65,0.59,0.82,0.78,1.01,0.98,1.49,2.1,2.02,2.27,-1.02,-0.81,-0.84,-0.78,-0.42,-1.51,-0.49,-1.36,0.12,-0.52,0.17,-0.64,0.99,0.19,1.03,0.32,-0.34,0.24,-0.58,-0.02,1.07,0.03,0.49,0.15,-0.42,-1.36,0.07,-1.36,0.35,1.39,0.45,1.22,-1.27,-1.19,-0.74,-1.13,-1.33,-0.09,-1.26,-0.07,-0.32,2.36,0.5,2.3,-0.17,0.48,-0.85,0.48,1.77,1.94,1.43,1.93,0.62,1.05,0.58,0.75,1.36,2.03,1.01,2.03,0.35,-0.69,0.28,-0.71,-0.75,0.32,-0.66,0.07,-1.78,0.27,-1.58,0.27,-0.86,0,-0.84,0.16,0.09,-0.63,-0.39,-0.67,-0.49,0.36,-0.26,0.75,-1.34,-2.27,-0.67,-1.92,-1.99,-0.41,-1.95,-0.21,0.27,0.66,0.5,0.39,-0.44,-0.24,-1.52,-0.58,0.83,0.58,0.56,1.02,-0.1,0.58,-0.24,0.54,-0.05,-0.35,0.44,-0.6,-0.78,-0.2,-0.34,-0.21,1.15,0.27,0.56,0.77,0.47,-0.74,1.02,-0.97,0.79,-0.57,1.11,-0.4,-0.25,-0.26,0.27,-0.31,-0.03,0.56,-0.23,0.61,0.31,-1.03,0.2,-1.26,-0.73,0.43,-0.68,0.51,0.36,1,0.38,0.64,0.32,0.42,0.51,0.25,-3.05,0.15,-2.21,0.13,-1.45,0.67,-1.8,0.4,1.29,2.09,0.57,2.15,0.07,0.07,-0.45,-0.07,-1.16,-0.17,-1.01,-0.31,-0.97,-1.35,-0.56,-1.02,-1.34,1.13,-0.9,0.97,-0.62,-0.42,-0.07,-0.47,0.71,-0.18,0.52,-0.26,0.22,0.47,0.54,0.18,1.25,-0.02,0.19,-0.22,0.98,0.03,1.01,0.29,0.82,0.06,0.82,0.09,0.44,-0.09,0.81,-0.05,0.78,0.73,0.7,0.85,-1.26,-1.01,-1.1,-0.86,-1.46,0.13,-1.35,0.05,-1.33,0.05,-1.39,0.1,0.23,0.44,0.02,0.08,0.1,-0.63,0.33,-0.84,-1.43,-1.17,-0.83,-1.09,-0.15,-0.64,0,-0.68,-0.28,0.03,0.23,0.08,-0.42,0.08,-0.67,-0.06,0.27,-1.13,0,-0.72,0.61,-0.01,0.58,0.02,0.01,1.3,-0.71,1.05,-0.62,-0.61,-1.01,-0.38,-2.14,-1.93,-1.76,-1.69,0.21,-0.14,0.01,-0.11,-0.17,2.43,0.19,2.3,0.36,-2.02,-0.7,-1.9,0.67,-0.34,0.12,-0.59,0.11,0.02,-0.73,-0.18,-1.26,0.61,-1.05,0.55,-0.7,0.71,-0.02,0.77,0.52,-0.5,0.48,-0.52,-0.23,-0.64,-0.34,-0.84,-0.7,0.25,-0.58,0.39,-2.71,-1.04,-2.25,-0.91,1.68,1.29,1.3,1.34,-0.37,-0.16,0.05,-0.18,0.01,-0.21,-0.36,-0.01,0.33,0.75,0.5,0.89,-0.5,-0.57,-0.17,-0.59,-0.37,-0.11,-0.97,-0.24,0.36,-1.35,-0.06,-1.23,-0.07,0.63,0.34,0.56,0.65,-0.38,0.22,-0.39,-0.26,2.68,-0.53,2.34,-0.32,-0.65,0.04,-0.44,-1.76,-1.8,-1.45,-1.75,-0.05,-1.43,0.1,-1.32,-2.74,-0.57,-1.69,-0.46,0.38,-0.12,-0.75,0.03,0.86,0.02,0.4,0.18,-1.19,0.37,0.01,0.78,-0.86,0.17,-0.17,0.31,0.46,0.3,0.56,0.31,0.61,0.3,0.98,0.21,0.88,-0.51,0.99,-0.35,1.61,-0.74,1.72,-0.9,-0.55,-0.57,-0.45,-0.74,1,-0.06,0.97,-0.25,0.96,-0.66,0.83,-0.69,-1,-0.7,-1.1,-0.38,1.78,-0.43,0.82,-0.39,-0.51,-0.89,-1.06,-0.73,-0.83,-0.21,-0.64,0.05,0.64,1.09,0.12,1.04,-1.68,-1.34,-1.87,-1.18,0.63,1.38,0.89,1.25,-1,-1.13,0.19,-0.95,-0.78,-0.83,-0.56,-0.86,1.75,0.73,1.9,0.94,0.44,0.39,-0.04,0.46,0.64,-1.02,0.38,-1.25,0.93,0.68,0.55,0.63,0.97,-0.63,-0.06,-0.7,0.17,0.79,-0.21,0.75,-1.8,-2.13,-1.48,-2.22,-0.66,0.99,-1.02,0.65,-0.63,0.2,-0.35,0.15,0.36,-0.12,0.77,-0.22,0.5,0.06,-0.07,0.21,0.83,-0.65,1.08,-0.51,0.69,-0.65,0,-0.29,1.73,2.82,0.94,2.54,-0.49,0.93,-0.55,0.85,-0.29,-0.6,-0.24,-0.68,0.55,-0.18,0.35,0.02,0.71,0.69,0.53,0.84,0.03,-0.4,-0.52,-0.42,0.48,0.89,0.68,0.97,0.58,-1.35,-0.06,-1.35,0.04,0,0.02,0.04,-0.15,-0.63,0.1,-0.58,0.18,1.64,0.37,1.36,0.17,0.14,0.17,0.14,-0.68,-1.43,-1.39,-1.66,0.54,1.12,0.55,1.09,-0.59,0.21,-0.77,0.01,-0.53,-0.86,-0.81,-0.43,0.75,1.05,0.19,0.99,-0.24,-1.45,0.43,-1.48,1.23,-1.83,1.23,-1.85,0.22,-1.2,0.46,-1.35,0.36,0.58,0.83,0.89,0.63,-1.37,0.46,-1.54,-0.74,-1.14,-0.94,-1.2,0.32,0.12,0.19,0.45,1.87,0.75,1.23,0.64,0.96,0.63,0.39,0.18,0.38,0.55,0.21,0.48,0.04,-0.08,0.12,-0.13,1.14,0.21,1.07,0.19,0.38,1.69,0.57,1.66,0.72,0.17,0.94,0.19,0.73,-0.61,1.07,-0.43,0.95,0.36,0.34,0.65,0.3,1.62,0.54,1.72,-1.45,-1.46,-0.77,-1.46,0.12,1.61,-0.24,1.42,0.1,0.26,-0.01,0.3,-0.57,1.67,-0.21,1.72,0.35,-2.17,0.55,-2.14,0.07,1.38,-0.19,1.23,0.72,-0.91,0.62,-0.48,-0.82,0.1,-0.45,-0.03,0.32,0.55,0.5,0.45,-0.75,1.38,0.12,1.59,1,0.69,0.83,0.53,-0.39,-0.1,-0.19,-0.07,-0.17,1.06,-0.09,0.85,-0.13,-0.76,0.28,-0.87,-0.86,1.59,-0.14,1.74,0.22,-0.34,-0.65,-0.45,-0.66,-0.22,-0.23,0.07,0.6,0.07,-0.35,0.15,0.73,0.43,-0.02,0.71,-0.13,-0.51,0.15,-0.51,1.01,1.77,0.87,1.66,0.61,0.29,0.16,0.14,0.37,-0.09,0.34,-0.22,-1.71,-1.6,-0.63,-1.46,0.26,1.15,0.07,1.17,-0.99,0.19,-0.7,0.28,0.32,0.6,0.04,0.53,-2,0.2,-2.07,0.36,-0.37,-2.14,-0.14,-1.87,0.71,0.06,0.65,0.16,0.05,-0.27,-0.22,-0.54,-1.48,-0.62,-0.31,-0.36,0.6,1.19,0.18,1.14,-1.34,-1.01,-1.97,-1.38,-0.43,0.92,-0.17,1.05,-0.49,1.2,-0.53,1.15,0.48,0.81,0.39,0.9,-0.5,-1.22,-1.07,-0.98,-0.15,-0.9,-0.85,-0.98,-1.72,-1.66,-1.71,-1.59,0.45,-0.83,0.09,-0.7,-1.17,-0.29,-0.76,-0.01,-0.37,-0.05,-0.54,0.24,-0.18,-1.11,-0.03,-0.87,0.83,-0.46,0.56,-0.12,0.75,-0.75,0.78,-0.72,-1.47,-0.09,-0.93,0.06,0.19,-0.93,0.55,-1.01,-0.16,-1.5,-0.41,-1.58,0.31,0.19,-0.13,0.27,-0.76,-2.54,-0.78,-2.45,-2.74,-0.84,-2.32,-0.48,-0.43,0.74,-0.59,1.06,1.27,0.25,0.95,0.3,0.24,0.56,0.44,0.48,1.5,-1.4,1.57,-1.14,0.38,-1.14,0.54,-1.03,0.8,1.48,0.63,1.65,0.72,-0.01,1.1,0.29,0.76,0.08,0.39,0.31,-0.66,-0.79,-0.52,-0.7,0.31,0.09,-0.01,0.3,1.3,-1.9,0.7,-1.87,0.87,1.23,0.45,0.94,-1.31,-0.21,-1.29,-0.27,-0.25,0.19,-0.37,0.35,0.53,-1.23,0.2,-0.9,0.36,0.28,0.19,0.37,0.29,-0.24,0.34,-0.31,-0.56,-0.13,-0.59,-0.05,0.85,0.74,0.69,0.71,1.01,0.41,0.76,0.4,0.58,-0.43,-0.18,-0.61,1.03,-2.31,0.56,-2.12,-0.25,-1.35,-0.57,-1.41,-0.83,-0.53,-0.47,-0.38,0.08,0.82,-0.1,0.87,2.89,1,2.52,0.91,1.38,1.31,0.46,1.41,0.52,1.37,1.13,1.42,-1.22,-0.6,-1.4,-0.87,0.84,0.65,0.73,0.68,-0.38,1.32,-0.33,1.19,-0.33,1.99,-0.07,1.92,-1.34,0.69,-1.2,0.55,-0.15,-1.24,-0.04,-0.79,1.65,-0.09,1.04,-0.07,0.23,-0.79,-0.44,-0.82,0.84,-0.16,1.22,-0.23,0.55,-1.29,0.21,-1.52,-0.13,1.21,-0.04,1.2,1.17,0.9,0.54,1,-0.95,0.17,-0.79,0.24,0.22,0.23,0.63,0,-0.32,0.14,-0.87,0.09,-1.6,-0.66,-1.54,-0.76,0.29,-0.24,0.49,-0.35,0.6,-0.05,-0.58,0.05,-0.49,1.2,-0.16,1.31,-1.56,-0.31,-1.32,-0.16,0.49,1.35,0.17,1.26,-0.46,-0.05,-0.02,0.47,-0.16,0.33,-0.33,0.19,0.14,0.2,0.06,0.03,-0.06,-0.4,0.39,-0.39,-0.39,-1,-0.12,-0.75,1.13,-0.87,1.26,-0.63,1.24,0.96,1.26,1.09,1.7,-0.98,0.68,-0.96,-0.8,1.29,0.2,1.43,-1.58,0.09,-1.14,-0.17,1.05,0.33,1.34,0.4,-0.45,1.65,-0.33,1.99,1.9,-1.09,1.45,-0.93,1.37,0.69,0.91,0.72,1.09,2.2,-0.01,2.13,-0.67,0.19,0.08,0.1,0.4,-0.36,-1.05,-0.55,1.91,0.41,0.85,0.54,0.53,0.92,1.01,0.66,-0.75,0.03,-0.33,-0.12,0.11,0.76,0.27,0.85,-1.07,-0.69,-0.96,-0.31,1.24,0.89,1.59,0.81,0.68,-0.06,0.61,0.17,0.54,0.12,0.42,0.01,0.54,-0.13,0.37,-0.1,-0.59,-1.06,-0.75,-0.97,-0.93,1.05,-1.32,0.95,0.03,1.65,0.9,1.43,-0.45,-0.07,-0.43,-0.18,-0.23,0.01,0.27,-0.07,1.64,-0.36,1.14,-0.01,1.24,0.9,0.82,0.85,-1.06,0.5,0.13,0.73,0.31,-1.18,-0.25,-1,0.79,-0.31,0.97,-0.18,1.69,-1.03,0.65,-0.95,-1.18,-0.08,-0.92,0.14,-1.11,0.07,-2,0.2,-0.5,0.82,-0.33,0.64,-1.53,-0.87,-0.91,-0.67,-1.46,-0.73,-1,-0.49,0.84,0.71,1.43,0.87,1.44,1.3,1.79,1.45,0.69,0.71,-0.03,0.73,0.36,-0.18,-0.6,-0.25,-0.73,-1.17,-1.09,-1.18,0.96,0.01,1.05,0.45,-0.97,-0.31,-0.76,-0.23,-0.77,0.02,-0.51,0.21,0.22,0.64,0.9,0.57,-0.65,-0.57,-0.59,-0.59,1.71,1.53,0.42,1.61,0.48,-1.08,-0.12,-1.06,0.89,1.27,0.99,1.6,-0.53,-0.3,-0.63,-0.54,-0.87,0.8,-0.15,0.61,-0.17,-1.06,-0.17,-1.09,-1.23,-1.86,-1.31,-1.73,0.74,-0.2,0.64,-0.47]}]},"single":{"organs":["liver","aorta","spleen","pancreas","kidneys","fat","muscle"],"theta":1.5,"soft":0.08,"proj":{"m":-0.575,"a":6.362,"b":4.276},"profiles":{"healthy":{"u":[2.2,1.7,1.9,1.5,2.8,0.35,0.75],"C":0.71,"H":0.183,"mdi":4.72},"cancer":{"u":[2.1,1.75,2.2,1.5,2.3,0.5,1.05],"C":0.458,"H":0.208,"mdi":3.23},"both":{"u":[2.2,1.8,2.1,1.5,2.6,0.42,0.85],"C":0.562,"H":0.198,"mdi":3.85},"dys":{"u":[2.3,1.8,1.9,1.5,3.1,0.28,0.6],"C":0.797,"H":0.165,"mdi":5.2}},"note":"Stand-ins: the poster names Clearance, Heterogeneity and the index but its formulas are not published yet."},"poster":{"mdi":{"axis":[0,10],"groups":[{"key":"cancer","name":"Cancer","n":282,"centre":3.2,"err":[2.6,4]},{"key":"both","name":"Cancer + dyslipidaemia","n":187,"centre":3.9,"err":[3.3,4.7]},{"key":"dys","name":"Dyslipidaemia","n":89,"centre":5.2,"err":[4.4,6]},{"key":"healthy","name":"Healthy","n":35,"centre":4.7,"err":[4.3,5]}]}}};

// Organ icons for the PET story: a clean single-weight line icon per organ in the style of the legend of the paper's
// Figure 2 (Geist et al., Med 2025), neon on request (the vision slide's organ network). Vector paths on a 2D canvas.
// PET_ICONS.ids, PET_ICONS.draw(ctx, id, cx, cy, size, opts), PET_ICONS.atlas(THREE, px) -> { texture, canvas, uv(id) }
// Every icon is drawn in a 100 x 100 box (y down); see icons.md.
const PET_ICONS = (function () {
  const ids = PET_DATA.organs.map(o => o.id), short = Object.fromEntries(PET_DATA.organs.map(o => [o.id, o.short || o.id]));
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x), r2 = v => Math.round(v * 100) / 100;
  const pt = p => r2(p[0]) + ' ' + r2(p[1]);

  // mirror an absolute SVG path (M L C Q A H V Z) about x = 50
  function mir(d) {
    const tk = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g); let cmd = '', k = 0;
    return tk.map(s => {
      if (/[A-Za-z]/.test(s)) { cmd = s; k = 0; return s; }
      const v = +s, i = k++;
      if (cmd === 'A') { const j = i % 7; return j === 5 ? r2(100 - v) : j === 4 ? 1 - v : v; }
      if (cmd === 'H') return r2(100 - v);
      if (cmd === 'V') return v;
      return i % 2 === 0 ? r2(100 - v) : v;
    }).join(' ');
  }
  const both = d => d + ' ' + mir(d);
  const ell = (x, y, rx, ry) => `M ${r2(x - rx)} ${r2(y)} A ${rx} ${ry} 0 1 0 ${r2(x + rx)} ${r2(y)} A ${rx} ${ry} 0 1 0 ${r2(x - rx)} ${r2(y)} Z`;

  // a tube along a chain of cubic Béziers c = [x0, y0, (c1x, c1y, c2x, c2y, x, y)...] (or 'M x y C ...'); w its width,
  // or a function (u 0..1 along it, side +1 / -1) -> width; caps 'round', 'flat' or 'cut' (a cut vessel: an ellipse).
  // Returns { shape, rim, L, R, P } (outline, cut rims, both edges and the centre line as points).
  function tube(c, w, cap0, cap1) {
    if (typeof c === 'string') c = c.match(/-?\d*\.?\d+/g).map(Number);
    const P = [], N = 20, wf = typeof w === 'function' ? w : () => w;
    for (let b = 0; b + 7 < c.length; b += 6) {
      for (let s = b ? 1 : 0; s <= N; s++) {
        const u = s / N, v = 1 - u, A = v * v * v, B = 3 * v * v * u, C = 3 * v * u * u, D = u * u * u;
        P.push([A * c[b] + B * c[b + 2] + C * c[b + 4] + D * c[b + 6], A * c[b + 1] + B * c[b + 3] + C * c[b + 5] + D * c[b + 7]]);
      }
    }
    const S = [0];
    for (let k = 1; k < P.length; k++) S.push(S[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    const L = [], R = [], T = [];
    P.forEach((p, k) => {
      const a = P[Math.max(0, k - 1)], e = P[Math.min(P.length - 1, k + 1)], l = Math.hypot(e[0] - a[0], e[1] - a[1]) || 1;
      const tx = (e[0] - a[0]) / l, ty = (e[1] - a[1]) / l, u = S[k] / S[S.length - 1], hl = wf(u, 1) / 2, hr = wf(u, -1) / 2;
      T.push([tx, ty]); L.push([p[0] - ty * hl, p[1] + tx * hl]); R.push([p[0] + ty * hr, p[1] - tx * hr]);
    });
    let rim = '';
    // a cap from the edge point 'side' round the centre p, bulging along t, to the other edge
    const cap = (p, t, side, kind) => {
      if (kind === 'flat') return '';
      const nx = side[0] - p[0], ny = side[1] - p[1], h = Math.hypot(nx, ny), f = kind === 'cut' ? 0.32 : 1; let s = '';
      for (let i = 1; i < 12; i++) { const ph = Math.PI * i / 12; s += ` L ${pt([p[0] + nx * Math.cos(ph) + t[0] * h * f * Math.sin(ph), p[1] + ny * Math.cos(ph) + t[1] * h * f * Math.sin(ph)])}`; }
      if (kind === 'cut') {
        rim += ` M ${pt(side)}`;
        for (let i = 1; i <= 12; i++) { const ph = Math.PI * i / 12; rim += ` L ${pt([p[0] + nx * Math.cos(ph) - t[0] * h * f * Math.sin(ph), p[1] + ny * Math.cos(ph) - t[1] * h * f * Math.sin(ph)])}`; }
      }
      return s;
    };
    const n = P.length - 1;
    let d = 'M ' + L.map(pt).join(' L ');
    d += cap(P[n], T[n], L[n], cap1 || 'round') + ' L ' + R.slice().reverse().map(pt).join(' L ');
    d += cap(P[0], [-T[0][0], -T[0][1]], R[0], cap0 || 'round') + ' Z';
    return { shape: d, rim, L, R, P };
  }
  // a closed cubic outline ('M x y C ...') redrawn as small outward lobes about step long, amp deep
  function scallop(d, step, amp) {
    const c = d.match(/-?\d*\.?\d+/g).map(Number), P = [];
    for (let b = 0; b + 7 < c.length; b += 6) for (let s = b ? 1 : 0; s <= 20; s++) {
      const u = s / 20, v = 1 - u;
      P.push([v * v * v * c[b] + 3 * v * v * u * c[b + 2] + 3 * v * u * u * c[b + 4] + u * u * u * c[b + 6], v * v * v * c[b + 1] + 3 * v * v * u * c[b + 3] + 3 * v * u * u * c[b + 5] + u * u * u * c[b + 7]]);
    }
    let A = 0, len = 0; const S = [0];
    for (let k = 1; k < P.length; k++) { A += P[k - 1][0] * P[k][1] - P[k][0] * P[k - 1][1]; S.push(len += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1])); }
    const n = Math.max(3, Math.round(len / step)), Q = [];
    for (let i = 0, k = 0; i <= n; i++) { while (k < P.length - 1 && S[k] < len * i / n) k++; Q.push(P[k]); }
    let out = 'M ' + pt(Q[0]); const sg = A > 0 ? 1 : -1;
    for (let i = 1; i < Q.length; i++) {
      const a = Q[i - 1], b = Q[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
      out += ` Q ${pt([(a[0] + b[0]) / 2 + sg * ty * amp * 2, (a[1] + b[1]) / 2 - sg * tx * amp * 2])} ${pt(b)}`;
    }
    return out + ' Z';
  }

  // a kidney bean centred at (x, y), h tall, w wide, its hilum facing side (+1 right, -1 left)
  function bean(x, y, w, h, side) {
    const q = [[0.08, -0.5], [-0.3, -0.52], [-0.52, -0.28], [-0.5, 0], [-0.48, 0.3], [-0.28, 0.52], [0.06, 0.5], [0.36, 0.49],
      [0.5, 0.34], [0.38, 0.18], [0.27, 0.07], [0.21, 0.03], [0.21, 0], [0.21, -0.03], [0.27, -0.07], [0.38, -0.18],
      [0.5, -0.34], [0.36, -0.49], [0.08, -0.5]].map(p => pt([x + p[0] * w * side, y + p[1] * h]));
    let d = 'M ' + q[0];
    for (let i = 1; i < q.length; i += 3) d += ` C ${q[i]} ${q[i + 1]} ${q[i + 2]}`;
    return d + ' Z';
  }
  // the renal pelvis and its calyces inside a bean, opening into the hilum
  function pelvis(x, y, w, h, side) {
    const p = (a, b) => pt([x + a * w * side, y + b * h]);
    return `M ${p(0.25, 0.02)} C ${p(0.14, 0.02)} ${p(0.08, 0)} ${p(0.02, -0.04)} M ${p(0.02, -0.04)} L ${p(-0.2, -0.24)} M ${p(0.02, -0.04)} L ${p(-0.24, 0)}` +
      ` M ${p(0.02, -0.04)} C ${p(-0.06, 0.06)} ${p(-0.12, 0.14)} ${p(-0.2, 0.22)}`;
  }
  // a cobblestone of irregular cells (a honeycomb whose shared corners are nudged by a hash of where they are), to be clipped
  function comb(x0, y0, x1, y1, R) {
    const hx = Math.sqrt(3) * R, hy = 1.5 * R, j = R * 0.22;
    const nud = (x, y) => { const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, g = Math.sin(x * 39.346 + y * 11.135) * 24634.6345; return [x + (h - Math.floor(h) - 0.5) * 2 * j, y + (g - Math.floor(g) - 0.5) * 2 * j]; };
    let d = '';
    for (let r = 0, y = y0; y <= y1 + hy; r++, y += hy) for (let x = x0 - (r % 2 ? hx / 2 : 0); x <= x1 + hx; x += hx) {
      d += ' M';
      for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k - Math.PI / 2, v = nud(r2(x + R * Math.cos(a)), r2(y + R * Math.sin(a))); d += (k ? ' L ' : ' ') + pt(v); }
      d += ' Z';
    }
    return d;
  }
  // The icons. Each returns a list of parts: { s: path } a closed outline (stroked; filled with opts.fill), { l: path } a
  // line, { a: path } a fill-only area (fade: [y0, y1] fades it in downwards), { f: path, o: alpha } a solid fill in every
  // style; hi: true (only with detail: from 40 device pixels up; a number: from that many) or lo: true (only below 40),
  // w (line width factor), clip (a path the part is clipped to).
  const DEF = {
    brain() {
      // the left hemisphere: a scalloped outline from the top of the midline round to its bottom, then up the midline
      const n = 7, q = [];
      for (let i = 0; i <= n; i++) { const th = 0.13 + (Math.PI - 0.27) * i / n; q.push([50 - 40 * Math.sin(th), 51 - 37 * Math.cos(th)]); }
      let d = 'M ' + pt(q[0]);
      for (let i = 0; i < n; i++) {
        const a = q[i], b = q[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, l = Math.hypot(mx - 50, my - 51);
        d += ` Q ${pt([mx + (mx - 50) / l * 7.5, my + (my - 51) / l * 7.5])} ${pt(b)}`;
      }
      d += ` C 47 76, 48.5 64, 47.5 51 C 46.5 38, 48 26, ${pt(q[0])} Z`;
      const g = 'M 26 24 C 31 23, 36 27, 35 33 M 15 42 C 21 39, 28 41, 29 47 M 38 41 C 33 45, 34 52, 40 55' +
        ' M 20 60 C 26 56, 33 59, 32 66 M 38 66 C 42 70, 42 76, 38 80 M 22 74 C 26 76, 28 79, 27 83';
      return [{ s: both(d) }, { l: both(g), hi: true }, { l: both('M 22 48 C 27 47, 31 51, 30 56 M 31 26 C 35 27, 38 31, 37 35'), lo: true }];
    },
    thyroid() {
      const d = 'M 50 47 C 45 47, 42.5 42, 41.5 35 C 40.5 27, 38 15, 33 13 C 26 11, 20 22, 16.5 34 C 12.5 47, 11 63, 15 75 C 18.5 85, 29 90, 37 86' +
        ' C 42 83.5, 45 78, 50 78 C 55 78, 58 83.5, 63 86 C 71 90, 81.5 85, 85 75 C 89 63, 87.5 47, 83.5 34 C 80 22, 74 11, 67 13' +
        ' C 62 15, 59.5 27, 58.5 35 C 57.5 42, 55 47, 50 47 Z';
      return [{ s: d }, { l: comb(10, 12, 90, 92, 5.6), hi: 56, w: 0.45, clip: d }, { l: 'M 24 42 C 22 52, 22 62, 25 70 M 76 42 C 78 52, 78 62, 75 70', lo: true }];
    },
    lungs() {
      const lung = 'M 39 22 C 30 22, 22 32, 18 45 C 14 57, 12 70, 12.5 80 C 13 87, 18 89, 24 86.5 C 30 84, 37 82.5, 42 84.5 C 44.5 85.5, 45.5 83, 45.5 79 L 45.5 36 C 45.5 27, 43 22, 39 22 Z';
      const right = 'M 61 22 C 70 22, 78 32, 82 45 C 86 57, 88 70, 87.5 80 C 87 87, 82 89, 76 86.5 C 70 84, 63 82.5, 58 84.5 C 55.5 85.5, 54.5 83, 54.5 79' +
        ' L 54.5 71 C 60 68, 61 60, 54.5 56 L 54.5 36 C 54.5 27, 57 22, 61 22 Z';
      const tree = 'M 50 6 L 50 36 M 50 36 C 48 39, 44 41, 40 44 M 50 36 C 52 39, 56 41, 60 44';
      const fine = both('M 40 44 C 35 48, 32 54, 30 62 M 36 49 C 32 47, 28 46, 25 47 M 32 56 C 34 61, 36 65, 37 70 M 30 62 C 27 66, 24 70, 22 75');
      return [{ s: lung }, { s: right }, { l: tree }, { l: fine, hi: true, w: 0.8 }, { l: 'M 46 12 L 54 12 M 46 19 L 54 19 M 46 26 L 54 26', hi: true, w: 0.55 }];
    },
    heart() {
      const d = 'M 50 87 C 34 76, 10 60, 10 37 C 10 22, 20 13, 32 13 C 41 13, 47 18.5, 50 25 C 53 18.5, 59 13, 68 13 C 80 13, 90 22, 90 37 C 90 60, 66 76, 50 87 Z';
      return [{ s: d }, { l: 'M 12.5 50 L 31 50 L 37 39 L 45 64 L 53 30 L 60 57 L 64.5 50 L 87.5 50' }];
    },
    liver() {
      const d = 'M 11 33 C 17 22, 38 19, 60 20 C 75 21, 87 24, 93 30 C 91 36, 78 43, 64 50.5 C 59 53.5, 56.5 57, 53 61 C 45 69.5, 34 79, 24 82' +
        ' C 16 84, 11.5 78, 10 67 C 8.5 55, 8 42, 11 33 Z';
      const ivc = tube('M 44 20.5 C 44 16, 44 12, 44 7', 9, 'flat', 'cut');
      const gall = 'M 46.5 67.4 C 44 73, 45 80.5, 50 80.5 C 55 80.5, 56 73.5, 50.5 63.6';
      return [{ s: d }, { l: 'M 63 20.5 C 61 31, 59 41, 57 54' }, { s: ivc.shape, hi: true }, { l: ivc.rim, hi: true }, { l: gall, hi: true }];
    },
    spleen() {
      // the visceral face: convex outer border, the hilum with its vessels, a notch in the upper border
      const d = 'M 53 10 C 75 11, 91 33, 87 57 C 83 79, 65 92, 47 90 C 37 89, 32.5 82, 36 76.5 C 39 72, 45 68.5, 45 60 C 45 52, 38 47, 32 43' +
        ' C 26 39, 22.5 32, 24.5 25 C 27.5 25.5, 31 24.5, 32.5 22 C 31 19, 28.5 17.5, 27.5 16.5 C 32 11.5, 42 9.5, 53 10 Z';
      const v = 'M 11 67 C 17 65, 23 62, 28 61 M 28 61 C 32 64, 35 68, 37.5 73 M 28 61 L 44.6 60.5 M 28 61 C 31 57, 34 53, 37.5 48';
      return [{ s: d }, { l: v }, { l: 'M 58 18 C 71 22, 79 34, 80 50', hi: true, w: 0.8 }];
    },
    pancreas() {
      // head on the left (in the curve of the duodenum), body and tail rising to the right; lobulated when detailed
      const d = 'M 12 53 C 9.5 41, 18 33, 29 34 C 36 34.5, 41 32.5, 47 30 C 55 26.5, 63 27.5, 71 24.5 C 79 21.5, 89 20, 92.5 27' +
        ' C 95 33.5, 88.5 38.5, 80 40.5 C 71 42.5, 63 44.5, 56 47.5 C 48.5 51, 44 56, 42 64 C 40 72.5, 33 79, 24.5 77 C 15.5 75, 13.5 63, 12 53 Z';
      return [{ s: d, lo: true }, { s: scallop(d, 8.2, 1.5), hi: true }, { l: 'M 22.5 64 C 28 55, 40 47.5, 54 42 C 66 37.5, 78 34, 87 30', hi: true, w: 0.7 }];
    },
    kidneys() {
      const L = bean(26, 43, 33, 52, 1), R = bean(74, 43, 33, 52, -1);
      const ur = 'M 33 45 C 41 52, 44 70, 45 92 M 67 45 C 59 52, 56 70, 55 92';
      return [{ s: L }, { s: R }, { l: ur }, { l: pelvis(26, 43, 33, 52, 1) + ' ' + pelvis(74, 43, 33, 52, -1), hi: true, w: 0.8 }];
    },
    adrenal() {
      // a kidney with the adrenal gland on its upper pole (cortex filled, the medulla as an inner line)
      const k = bean(45, 64, 38, 56, 1);
      const capD = 'M 26 46.5 C 23.5 35, 31.5 21, 45 18.5 C 58.5 16.5, 69 29, 68 41.5 C 61.5 35.5, 55 32.5, 47 32.5 C 38 32.5, 30.5 37.5, 26 46.5 Z', lump = scallop(capD, 7.2, 1.25);
      return [{ s: k }, { s: capD, lo: true }, { s: lump, hi: true }, { f: capD, o: 0.7, lo: true }, { f: lump, o: 0.4, hi: true }, { l: 'M 53 66 C 61 72, 64 82, 64 95' },
        { l: pelvis(45, 64, 38, 56, 1), hi: true, w: 0.8 }];
    },
    intestine() {
      const c = tube([23, 83, 23, 62, 23, 44, 23, 30, 23, 24, 25.5, 21, 31, 21, 45, 21, 57, 21, 70, 21, 75, 21, 78, 24, 78, 30,
        78, 42, 78, 54, 78, 64, 78, 74, 73, 78.5, 65, 80.5, 58, 82, 55.5, 86, 55.5, 94], 13, 'round', 'cut');
      // the small intestine: a meander inside the frame, joining the colon low on the left
      const s = 'M 36 34 C 42 31, 46 37, 52 34 C 58 31, 62 37, 66 34 C 70 32, 71 41, 66 42.5 C 61 44, 57 39, 51 42 C 45 45, 41 39, 36.5 43' +
        ' C 32 46.5, 35 52, 39 51 C 45 49.5, 48 55, 54 52 C 60 49, 64 54, 66 53 C 71 52, 71 61, 66 62.5 C 61 64, 57 59, 51 62' +
        ' C 45 65, 42 59, 37.5 63 C 33.5 66.5, 34 71, 29.5 72';
      let hau = '';
      for (let k = 6; k < c.L.length - 4; k += 9) {
        const a = c.L[k], b = c.R[k];
        hau += ` M ${pt(a)} L ${pt([a[0] + (b[0] - a[0]) * 0.28, a[1] + (b[1] - a[1]) * 0.28])} M ${pt(b)} L ${pt([b[0] + (a[0] - b[0]) * 0.28, b[1] + (a[1] - b[1]) * 0.28])}`;
      }
      return [{ s: c.shape }, { l: c.rim, hi: true }, { l: s, lo: true }, { s: tube(s, 5.2, 'round', 'flat').shape, hi: true, w: 0.8 }, { l: hau, hi: 48, w: 0.7 }];
    },
    muscle() {
      // a flexed arm as in the paper's legend: elbow on the left, the forearm rising to a small fist, the biceps, the shoulder
      const d = 'M 6.5 63 C 9 49, 22 28, 37 17.5 C 36.5 10, 41 4.5, 48.5 4.5 L 54 4.5 C 59.5 4.5, 63 7.5, 62 11.5 C 65.5 13, 65.5 18.5, 62.5 20' +
        ' C 64.5 23, 62 28, 57 28.5 L 52.5 29 C 48.5 35.5, 43 44, 39.5 53.5 C 45 44, 57 35.5, 69.5 36 C 82 36.5, 91 45, 92.5 56' +
        ' C 94 67, 89.5 77, 80 81.5 C 64 88.5, 38 88, 20 84 C 10 81.5, 5.5 74, 6.5 63 Z';
      const fine = 'M 41 19.5 C 45.5 21.5, 51 21.5, 56 19.5 M 39.5 53.5 C 41 60, 45 64.5, 51 67';
      return [{ s: d }, { l: fine, hi: true, w: 0.8 }, { l: 'M 39.5 53.5 C 41 60, 45 64.5, 51 67', lo: true }];
    },
    marrow() {
      const d = 'M 38 41 C 29 37.5, 20.5 30, 24 19.5 C 27.5 9.5, 42 8.5, 50 15.5 C 58 8.5, 72.5 9.5, 76 19.5 C 79.5 30, 71 37.5, 62 41 L 62 86 A 12 4.2 0 0 1 38 86 Z';
      const cav = 'M 44 44 L 44 84 M 56 44 L 56 84';
      return [{ s: d }, { l: 'M 38 86 A 12 4.2 0 0 1 62 86' }, { f: ell(50, 86, 6.5, 2.2), o: 1 },
        { l: cav, hi: true, w: 0.7 }, { l: comb(42, 42, 58, 86, 3.4), hi: 64, w: 0.45, clip: 'M 44 44 L 56 44 L 56 84 L 44 84 Z' },
        { l: 'M 34 22 C 36 18, 40 16, 44 17', hi: true, w: 0.7 }];
    },
    fat() {
      const side = 'M 27 6 C 27 18, 22.5 24, 18.5 32 C 13 43, 13.5 55, 20 61 C 24 65, 24.5 71, 22 78';
      const brief = 'M 22 78 C 34 80, 44 84.5, 50 92 C 56 84.5, 66 80, 78 78';
      const area = side + ' C 34 80, 44 84.5, 50 92 C 56 84.5, 66 80, 78 78 C 75.5 71, 76 65, 80 61 C 86.5 55, 87 43, 81.5 32 C 77.5 24, 73 18, 73 6 Z';
      return [{ a: area, fade: [8, 36] }, { l: both(side) + ' ' + brief }, { l: ell(50, 50, 2.2, 3.4) }, { l: 'M 31 67 C 40 73, 60 73, 69 67' }];
    },
    aorta() {
      // the arch as a cut vessel rising from the heart and descending behind it, its three branches on top
      const c = tube('M 33 86 C 33 66, 29 42, 39 31 C 48 21, 64 21, 68 35 C 69.5 43, 69 52, 69 60 C 69 72, 69 84, 69 96', 14, 'cut', 'cut');
      const out = [{ s: c.shape }, { l: c.rim }];
      [[42, -0.45], [51, 0.04], [59.5, 0.42]].forEach(([x, lean]) => {
        let b = c.R[0];
        for (const q of c.R) if (q[1] < 30 && Math.abs(q[0] - x) < Math.abs(b[0] - x)) b = q;
        const top = [b[0] + lean * 9, b[1] - 12.5];
        const t = tube([b[0], b[1] + 2, b[0], b[1] - 4, top[0], top[1] + 5, top[0], top[1]], 5.2, 'flat', 'cut');
        out.push({ s: t.shape, w: 0.8 }, { l: t.rim, w: 0.8 });
      });
      return out;
    },
  };

  const cache = {};
  function parts(id) {
    if (id in cache) return cache[id];
    if (!DEF[id] || typeof Path2D === 'undefined') return (cache[id] = null);
    return (cache[id] = DEF[id]().map(p => Object.assign({}, p, {
      s: p.s && new Path2D(p.s), l: p.l && new Path2D(p.l), a: p.a && new Path2D(p.a),
      f: p.f && new Path2D(p.f), clip: p.clip && new Path2D(p.clip),
    })));
  }
  const hex = c => { const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(c).trim()); if (!m) return null; let h = m[1]; if (h.length === 3) h = h.replace(/./g, x => x + x); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // the stand-in for an id without an icon: a circle with its initials
  function stub(ctx, id, cx, cy, size, o) {
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = o.color || '#ffffff';
    ctx.lineWidth = o.width || Math.max(1, size * 0.05);
    if (o.glow) { ctx.shadowColor = o.color || '#ffffff'; ctx.shadowBlur = size * 0.12; }
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `600 ${Math.round(size * 0.26)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((short[id] || String(id)).slice(0, 2), cx, cy);
    ctx.restore();
  }

  // draw one icon centred at (cx, cy) in a square of side size (in the context's units). opts: color (CSS colour,
  // white), width (line width in the context's units; by default bolder at small sizes), glow (neon: a coloured blur,
  // a translucent fill and a light core), fill (0..1 alpha of the outlines' fill; 0, or 0.28 with glow),
  // detail (true/false: inner lines; by default from 40 device pixels up), alpha (0..1).
  function draw(ctx, id, cx, cy, size, opts) {
    const o = opts || {}, list = parts(id);
    if (!list) return stub(ctx, id, cx, cy, size, o);
    const m = ctx.getTransform ? ctx.getTransform() : null, dpr = m ? Math.hypot(m.a, m.b) || 1 : 1, px = size * dpr;
    const hi = o.detail != null ? !!o.detail : px >= 40, k = size / 100;
    const w = (o.width || Math.max(1.15 / dpr, size * (0.068 - 0.028 * clamp((px - 24) / 56, 0, 1)))) / k;
    const col = o.color || '#ffffff', c3 = hex(col), fill = o.fill != null ? o.fill : o.glow ? 0.28 : 0;
    const a0 = ctx.globalAlpha * (o.alpha != null ? o.alpha : 1);
    const use = list.filter(p => (p.lo ? !hi : !p.hi || (o.detail != null ? !!o.detail : px >= (p.hi === true ? 40 : p.hi))));
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(k, k);
    ctx.lineCap = ctx.lineJoin = 'round';
    const strokes = (lw, style, alpha) => {
      ctx.strokeStyle = style; ctx.globalAlpha = a0 * alpha;
      for (const p of use) {
        const path = p.s || p.l; if (!path) continue;
        if (p.clip) { ctx.save(); ctx.clip(p.clip); }
        ctx.lineWidth = lw * (p.w || 1);
        ctx.stroke(path);
        if (p.clip) ctx.restore();
      }
    };
    // translucent fill of the outlines (a soft top-to-bottom gradient) and the parts that are always filled
    if (fill > 0) {
      const g = c3 ? ctx.createLinearGradient(0, 0, 0, 100) : null;
      if (g) { g.addColorStop(0, rgba(c3, Math.min(1, fill * 1.5))); g.addColorStop(1, rgba(c3, fill * 0.55)); }
      ctx.fillStyle = g || col; ctx.globalAlpha = a0 * (g ? 1 : fill);
      for (const p of use) {
        if (!(p.a || p.s)) continue;
        if (p.fade && c3) { const h = ctx.createLinearGradient(0, p.fade[0], 0, p.fade[1]); h.addColorStop(0, rgba(c3, 0)); h.addColorStop(1, rgba(c3, fill)); ctx.fillStyle = h; }
        ctx.fill(p.a || p.s);
        ctx.fillStyle = g || col;
      }
    }
    ctx.fillStyle = col;
    for (const p of use) if (p.f) { ctx.globalAlpha = a0 * p.o * (o.glow ? 0.85 : 1); ctx.fill(p.f); }
    if (o.glow) {
      ctx.shadowColor = col;
      ctx.shadowBlur = px * 0.16; strokes(w * 1.5, col, 0.55);
      ctx.shadowBlur = px * 0.05; strokes(w, col, 1);
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      strokes(w * 0.42, c3 ? rgba(c3.map(v => Math.round(v + (255 - v) * 0.7)), 1) : '#ffffff', 0.9);
    } else strokes(w, col, 1);
    ctx.restore();
  }

  // all icons white on transparent in one CanvasTexture, a 4 x 4 grid of px-pixel cells (tint them in the shader);
  // px is rounded to a power of two (mipmaps on WebGL 1 too), the icons fill 86 % of a cell, the last cell stays empty
  const atlases = {};
  function atlas(THREE, px) {
    const s = Math.pow(2, Math.round(Math.log2(clamp(px || 128, 16, 1024))));
    if (atlases[s]) return atlases[s];
    const G = ids.length < 16 ? 4 : Math.pow(2, Math.ceil(Math.log2(Math.sqrt(ids.length + 1)))), cv = document.createElement('canvas');
    cv.width = cv.height = s * G;
    const ctx = cv.getContext('2d');
    ids.forEach((id, i) => draw(ctx, id, (i % G + 0.5) * s, (Math.floor(i / G) + 0.5) * s, s * 0.86));
    const texture = new THREE.CanvasTexture(cv);
    texture.anisotropy = 4;
    // unknown ids get the last (empty) cell
    const uv = id => { let i = ids.indexOf(id); if (i < 0) i = G * G - 1; const x = i % G, y = Math.floor(i / G); return [x / G, 1 - (y + 1) / G, (x + 1) / G, 1 - y / G]; };
    return (atlases[s] = { texture, canvas: cv, uv });
  }
  return { ids, draw, atlas };
})();

// STUB of the scan set (tools/pet/SPEC.md), for engine work before the real set exists: the spec's params, anchors,
// labels, cam views, controls and api, drawn with a few plain meshes. The build uses sets/scan.js once it is there.
SETS.scan = function (K) {
  const { THREE } = K, set = K.newSet('scan'), D2 = Math.PI / 2;
  const mat = (c, o) => K.fade(set, new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.05 }), o || 1);
  const scanner = new THREE.Group(); set.group.add(scanner);
  const add = (geo, m, p, r) => { const o = new THREE.Mesh(geo, m); if (p) o.position.set(...p); if (r) o.rotation.set(...r); scanner.add(o); return o; };
  const gantry = add(new THREE.TorusGeometry(0.72, 0.32, 16, 48), mat(0xeef2f6), [0, 0.02, 0]); gantry.scale.z = 2.4;
  const ring = add(new THREE.TorusGeometry(0.41, 0.025, 8, 48), mat(0x7fb2ff), [0, 0, 0.8]);
  const det = add(new THREE.TorusGeometry(0.45, 0.05, 8, 48), mat(0x1a2638, 0.9), [0, 0, 0]);
  const couch = add(new THREE.BoxGeometry(0.55, 0.07, 2.2), mat(0xf4f6f8), [0, -0.22, 1.5]);
  add(new THREE.BoxGeometry(0.42, 0.75, 1.0), mat(0x8a929c), [0, -0.66, 1.9]);
  const patient = add(new THREE.CylinderGeometry(0.15, 0.15, 1.75, 16), mat(0x8fb4ff, 0.35), [0, -0.08, 1.5], [D2, 0, 0]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), mat(0x0b1018)); floor.rotation.x = -D2; floor.position.y = -1.05; floor.name = 'floor'; set.group.add(floor);
  // events: points at hashed places, a few per second
  const N = 300, g = K.pointsGeo(N), P = g.attributes.position.array, Cc = g.attributes.aCol.array, Sz = g.attributes.aSize.array, A = g.attributes.aA.array;
  for (let i = 0; i < N; i++) { Cc.set([1, 0.85, 0.4], 3 * i); Sz[i] = 0.03; }
  set.group.add(new THREE.Points(g, K.points(set)));
  // the vision row: four glowing boxes to the scanner's right
  const row = new THREE.Group(); set.group.add(row);
  const rowM = [['#ffb43b', 0.4], ['#46d9ff', 1.4], ['#ff5a4b', 2.3], ['#ffe066', 3.0]].map(([c, x]) => { const m = K.fade(set, new THREE.MeshBasicMaterial({ color: c }), 1); const o = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.05), m); o.position.set(x - 1, 0, 0); row.add(o); return m; });
  const h = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  let S0 = { scan_bed: 0, scan_vision: 0 }, last = [0, 0, 0];
  const bedZ = () => 1.5 - 1.3 * S0.scan_bed;
  return Object.assign(set, {
    floorY: -1.05,
    params: { scan_a: 1, scan_bed: 0, scan_cut: 0, scan_events: 0, scan_lines: 0, scan_image: 0, scan_vision: 0 },
    update(S, t) {
      S0 = S;
      scanner.position.x = -2.2 * S.scan_vision; scanner.scale.setScalar(1 - 0.25 * S.scan_vision);
      couch.position.z = bedZ(); patient.position.z = bedZ();
      gantry.visible = S.scan_cut < 0.95; det.visible = S.scan_cut > 0.05;
      patient.material.color.setRGB(0.55 + 0.45 * S.scan_image, 0.7, 1 - 0.6 * S.scan_image);
      const k = Math.floor(t * 25);
      for (let i = 0; i < N; i++) {
        const j = k - i, on = S.scan_events > 0.02 && i < 30 * S.scan_events + S.scan_lines * 200;
        P.set([(h(j) - 0.5) * 0.25, -0.08 + (h(j + 7) - 0.5) * 0.2, bedZ() - 0.8 + h(j + 3) * 1.6], 3 * i); A[i] = on ? 1 - i / N : 0;
        if (i === 0) last = [P[0], P[1], P[2]];
      }
      g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true;
      row.visible = S.scan_vision > 0.02; rowM.forEach((m, i) => { m.opacity = K.smooth(S.scan_vision * 4 - i) * set.uA.value; });
    },
    anchors: { centre: [0, 0, 0], bore: [0, 0, 0.8], ring: [0, 0.5, 0], couch: () => [0, -0.22, bedZ()], patient: () => [0, -0.05, bedZ() - 0.45], head: () => [0, -0.05, bedZ() - 0.8],
      tumour: () => [-0.08, -0.02, bedZ() - 0.5], event: () => last, vision_scan: [-2.2, 0, 0], vision_body: [-0.6, 0, 0], vision_net: [0.4, 0, 0], vision_prog: [1.3, 0.3, 0], vision_med: [2, -0.3, 0], floor: [0, -1.05, 0] },
    labels: [
      { text: ['PET/CT scanner', ''], at: 'bore', alpha: S => (1 - S.scan_cut) * (1 - S.scan_vision) * (S.scan_events < 0.1 ? 1 : 0) },
      { text: ['Detector ring', ''], at: 'ring', cls: 'cyn', alpha: S => K.prog(S.scan_cut, 0.5, 1) * (1 - S.scan_image) },
      { text: ['Two gamma photons', '511 keV'], at: 'event', cls: 'amb', alpha: S => K.prog(S.scan_events, 0.05, 0.2) * (1 - S.scan_lines) },
      { text: ['Line of response', ''], at: 'patient', cls: 'cyn', alpha: S => K.prog(S.scan_lines, 0.1, 0.4) * (1 - S.scan_image) },
      { text: ['FDG in the patient', ''], at: 'patient', cls: 'amb', alpha: S => K.prog(S.scan_image, 0.5, 1) * (1 - S.scan_vision) },
      { text: ['PET scan', ''], at: 'vision_scan', alpha: S => K.prog(S.scan_vision, 0.7, 1) },
      { text: ['One network', ''], at: 'vision_net', alpha: S => K.prog(S.scan_vision, 0.8, 1) },
    ],
    cam: { default: [35, 14, 7.5, 0, -0.2, 0.6], front: [0, 5, 6, 0, 0, 0], ring: [20, 24, 3.4, 0, 0.1, 0], side: [90, 8, 6.2, 0, -0.2, 0.7],
      inside: [180, 4, 1.1, 0, -0.05, 0.9], vision: [0, 4, 12, -0.4, 0, 0], life: [25, 12.7, 2.5, 0, 0, 0] },
    controls: [{ key: 'view', label: 'View', options: [['scanner', 'Scanner'], ['ring', 'Ring'], ['inside', 'Inside'], ['vision', 'Vision']] },
      { key: 'events', label: 'Events', options: [['off', 'Off'], ['on', 'On']] }, { key: 'image', label: 'Image', options: [['lines', 'Lines'], ['image', 'Image']] }],
    explore(c) {
      const ev = c.events === 'on' ? 1 : 0;
      return { scan_bed: c.view === 'vision' ? 0 : 1, scan_cut: c.view === 'ring' || c.view === 'inside' ? 1 : 0, scan_events: ev, scan_lines: ev, scan_image: c.image === 'image' ? 1 : 0, scan_vision: c.view === 'vision' ? 1 : 0 };
    },
    api() { return { floorY: -1.05, setFloor(on) { floor.visible = on; } }; },
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

// STUB of the organs set (tools/pet/SPEC.md), for engine work before the real set exists: the spec's params, anchors,
// labels, cam views, controls and api, drawn with plain spheres, boxes and lines in the body set's frame.
SETS.organs = function (K) {
  const { THREE } = K, set = K.newSet('organs'), D = PET_DATA, O = D.organs;
  const NETS = ['full', 'FDG_healthy', 'A_low', 'A_high', 'B_low', 'B_high', 'C_low', 'C_mid', 'C_high', 'HK2', 'GLUT'];
  const SHORT = ['All scans', 'Healthy', 'BMI low', 'BMI high', 'Tumour low', 'Tumour high', 'CRP low', 'CRP mid', 'CRP high', 'HK2', 'GLUT'];
  const netOf = i => D.nets.find(n => n.id === NETS[Math.max(0, Math.min(NETS.length - 1, Math.round(i)))]) || null;
  // each organ: a shell on the organ, a bar to the body's right, a node on a shallow dome in front of the torso
  const shells = [], bars = [], nodes = [], home = O.map(o => o.pos), node = O.map((o, i) => [o.pos[0] * 2.6 + (i % 2 ? 0.08 : -0.08), 0.1 + o.pos[1] * 0.75, 0.5 - Math.abs(o.pos[0])]);
  O.forEach((o, i) => {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(o.id === 'fat' ? 0.14 : 0.045, 16, 12), K.rim(set, { color: o.col, a0: 0.12, a1: 0.8 }));
    sh.position.set(...o.pos); sh.userData.id = o.id; set.group.add(sh); shells.push(sh);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 0.035, 0.03), K.fade(set, new THREE.MeshBasicMaterial({ color: o.col }), 1));
    b.position.set(0.45, 0.75 - i * 0.075, 0); b.userData.id = o.id; set.group.add(b); bars.push(b);
    const nd = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), K.fade(set, new THREE.MeshBasicMaterial({ color: o.col }), 1));
    nd.userData.id = o.id; set.group.add(nd); nodes.push(nd);
  });
  const lesion = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), K.fade(set, new THREE.MeshBasicMaterial({ color: 0xffffff }), 1));
  lesion.position.set(-0.09, 0.37, 0.03); set.group.add(lesion);
  const matrix = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.02), K.fade(set, new THREE.MeshBasicMaterial({ color: 0xff7a2a }), 0.8));
  matrix.position.set(0.95, 0.1, 0); set.group.add(matrix);
  // the scatter plot of a pair (synth.pairs): raw values gliding to residuals
  const NP = D.synth.n, sg = K.pointsGeo(NP), sp = sg.attributes.position.array;
  for (let i = 0; i < NP; i++) { sg.attributes.aCol.array.set([0.9, 0.95, 1], 3 * i); sg.attributes.aSize.array[i] = 0.012; }
  const scatter = new THREE.Points(sg, K.points(set)); scatter.position.set(1.0, 0.3, 0.2); set.group.add(scatter);
  // links of the current network
  const lg = K.linesGeo(80), links = new THREE.LineSegments(lg, K.lines(set)); set.group.add(links);
  let built = -1, S0 = {};
  const nodePos = i => K.v3.lerp(home[i], node[i], S0.organs_net || 0);
  function buildLinks(w) {
    const n = netOf(w), e = n ? n.edges : [], P = lg.attributes.position.array, C = lg.attributes.aCol.array, A = lg.attributes.aA.array;
    A.fill(0);
    e.slice(0, 80).forEach(([a, b, x], k) => {
      const ia = O.findIndex(o => o.id === a), ib = O.findIndex(o => o.id === b);
      if (ia < 0 || ib < 0) return;
      P.set([...node[ia], ...node[ib]], 6 * k);
      const c = x > 0 ? [0.3, 0.49, 1] : [1, 0.3, 0.3]; C.set([...c, ...c], 6 * k); A[2 * k] = A[2 * k + 1] = Math.min(1, Math.abs(x) * 2);
    });
    lg.attributes.position.needsUpdate = lg.attributes.aCol.needsUpdate = lg.attributes.aA.needsUpdate = true;
    built = w;
  }
  const strengthBars = O.map(o => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.02), K.fade(set, new THREE.MeshBasicMaterial({ color: o.col }), 1)); set.group.add(b); return b; });
  const hubOf = () => { const n = netOf(S0.organs_which || 0); const h = n ? (n.hubs && n.hubs.length ? n.hubs : (n.computed && n.computed.hubs) || []) : []; return h[0] || null; };
  const A = { bars: [0.6, 0.3, 0], matrix: [0.95, 0.1, 0], scatter: [1.0, 0.3, 0.2], net: [0, 0.25, 0.4], strength: [0, -0.5, 0.4], lesion: [-0.09, 0.37, 0.03],
    hub: () => { const h = hubOf(), i = O.findIndex(o => o.id === h); return i >= 0 ? nodePos(i) : A.net; } };
  O.forEach((o, i) => { A[o.id] = () => nodePos(i); });
  return Object.assign(set, {
    params: { organs_a: 1, organs_seg: 0, organs_suv: 0, organs_focus: 0, organs_lesion: 0, organs_rows: 0, organs_pair: 0, organs_partial: 0, organs_net: 0, organs_which: 0, organs_strength: 0 },
    update(S, t) {
      S0 = S;
      const f = Math.round(S.organs_focus), w = Math.round(S.organs_which);
      if (w !== built) buildLinks(w);
      const n = netOf(w), drawn = new Set(n ? n.organs : []);
      O.forEach((o, i) => {
        const dim = f && f !== i + 1 ? 0.3 : 1;
        shells[i].visible = S.organs_seg > (0.95 - o.pos[1]) / 1.9 && S.organs_net < 0.9;
        bars[i].scale.x = Math.max(1e-3, S.organs_suv * o.suv * 0.12); bars[i].position.x = 0.4 + bars[i].scale.x / 2; bars[i].visible = S.organs_suv > 0.01 && S.organs_rows < 0.5;
        nodes[i].position.set(...nodePos(i)); nodes[i].visible = S.organs_net > 0.05 && (drawn.has(o.id) || !n); nodes[i].scale.setScalar(dim * (f === i + 1 ? 1.6 : 1));
        const st = n && n.computed && n.computed.strength[o.id] || 0;
        strengthBars[i].visible = S.organs_strength > 0.05 && st > 0; strengthBars[i].scale.y = Math.max(1e-3, st * 0.12 * S.organs_strength);
        strengthBars[i].position.set(-0.45 + i * 0.07, -0.55 + strengthBars[i].scale.y / 2, 0.4);
      });
      links.visible = S.organs_net > 0.3; lesion.visible = S.organs_lesion > 0.02; lesion.scale.setScalar(0.5 + S.organs_lesion);
      matrix.visible = S.organs_rows > 0.02; matrix.scale.set(1, Math.max(0.02, S.organs_rows), 1);
      const pr = D.synth.pairs[Math.round(S.organs_pair) - 1];
      scatter.visible = !!pr;
      if (pr) { for (let i = 0; i < NP; i++) sp.set([K.lerp(pr.xy[4 * i], pr.xy[4 * i + 2], S.organs_partial) * 0.12, K.lerp(pr.xy[4 * i + 1], pr.xy[4 * i + 3], S.organs_partial) * 0.12, 0], 3 * i); sg.attributes.position.needsUpdate = true; }
    },
    anchors: A,
    labels: O.map((o, i) => ({ text: [o.name, ''], at: o.id, alpha: S => (Math.round(S.organs_focus) === i + 1 ? 1 : 0) }))
      .concat([{ text: ['658 scans × 11 organs', ''], at: 'matrix', cls: 'amb', alpha: S => K.prog(S.organs_rows, 0.8, 1) },
        { text: ['partial r', ''], at: 'scatter', cls: 'cyn', alpha: S => (S.organs_pair >= 0.5 ? 1 : 0) }]),
    cam: { default: [0, 4, 3.75, 0, 0, 0], seg: [10, 6, 3.2, 0, 0.2, 0], bars: [-25, 6, 3.3, 0.35, 0.2, 0], matrix: [-35, 22, 3.4, 0.95, 0, 0],
      scatter: [-15, 4, 2.4, 1.0, 0.25, 0.2], net: [12, 6, 3.0, 0, 0.2, 0.3], strength: [5, 2, 2.8, 0, -0.3, 0.3], lesion: [-15, 4, 1.4, -0.09, 0.36, 0.02] },
    controls: [{ key: 'view', label: 'View', options: [['organs', 'Organs'], ['uptake', 'Uptake'], ['matrix', 'Matrix'], ['partial', 'Partial'], ['network', 'Network'], ['strength', 'Strength']] },
      { key: 'net', label: 'Network', options: NETS.map((n, i) => [n, SHORT[i]]) }],
    explore(c) {
      const v = c.view;
      return { organs_seg: 1, organs_suv: v === 'uptake' || v === 'matrix' ? 1 : 0, organs_rows: v === 'matrix' ? 1 : 0, organs_pair: v === 'partial' ? 1 : 0,
        organs_partial: v === 'partial' ? K.smooth((c.t % 8) / 3) : 0, organs_net: v === 'network' || v === 'strength' ? 1 : 0, organs_strength: v === 'strength' ? 1 : 0,
        organs_which: Math.max(0, NETS.indexOf(c.net)) };
    },
    api() {
      return { netIds: NETS, setFocus() {},
        pick(rc) { const hit = rc.intersectObjects(nodes.concat(shells, bars).filter(m => m.visible), false)[0]; return hit ? hit.object.userData.id : null; } };
    },
  });
};

// STUB of the people set (tools/pet/SPEC.md), for engine work before the real set exists: the spec's params, anchors,
// labels, cam views, controls and api (with the same stand-in maths), drawn with plain meshes and points.
SETS.people = function (K) {
  const { THREE } = K, set = K.newSet('people'), S1 = PET_DATA.single, ON = S1.organs, N = ON.length, PK = ['healthy', 'cancer', 'both', 'dys'];
  const G = (PET_DATA.poster && PET_DATA.poster.mdi && PET_DATA.poster.mdi.groups) || [], GC = { cancer: '#d9dde6', both: '#9b5de5', dys: '#ff4fd8', healthy: '#38bdf8' };
  const col = id => (PET_DATA.organs.find(o => o.id === id) || { col: '#ffffff' }).col;
  function measure(u, theta) {
    const lt = Math.log(theta), e = u.map(() => new Array(N).fill(0)), s = new Array(N).fill(0);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) { e[i][j] = 1 / (1 + Math.exp(-(Math.log(u[i] / u[j]) - lt) / S1.soft)); s[i] += e[i][j]; s[j] += e[i][j]; }
    const k = ON.indexOf('kidneys'), C = e[k].reduce((a, v, j) => a + (j === k ? 0 : v), 0) / (N - 1), m = s.reduce((a, v) => a + v, 0) / N;
    let g = 0; for (const a of s) for (const b of s) g += Math.abs(a - b);
    const H = m > 0 ? g / (2 * N * N * m) : 0;
    return { e, s, C, H, mdi: Math.max(0, Math.min(10, S1.proj.m + S1.proj.a * C + S1.proj.b * H)) };
  }
  const ring = ON.map((o, i) => { const a = i / N * Math.PI * 2; return [Math.sin(a) * 0.55, 0.75 + Math.cos(a) * 0.3, Math.cos(a) * 0.2]; });
  const nodes = ON.map((o, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), K.fade(set, new THREE.MeshBasicMaterial({ color: col(o) }), 1)); m.position.set(...ring[i]); m.userData.organ = o; set.group.add(m); return m; });
  const bars = ON.map((o, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.03), K.fade(set, new THREE.MeshBasicMaterial({ color: col(o) }), 1)); set.group.add(m); return m; });
  const field = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 1, 0.08), K.fade(set, new THREE.MeshBasicMaterial({ color: 0xffb43b }), 0.9), N * N); set.group.add(field);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), K.fade(set, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, side: THREE.DoubleSide }), 0.25)); plane.rotation.x = -Math.PI / 2; set.group.add(plane);
  const lg = K.linesGeo(N * N), links = new THREE.LineSegments(lg, K.lines(set)); set.group.add(links);
  const gauge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06), K.fade(set, new THREE.MeshBasicMaterial({ color: 0xffb43b }), 1)); set.group.add(gauge);
  // the population: dots by group (stand-ins), and the group centres
  const NP = G.reduce((a, g) => a + g.n, 0), pg = K.pointsGeo(NP || 1), PP = pg.attributes.position.array, r = K.rng(5), grp = [], mx = [];
  G.forEach((g, gi) => { const c = K.rgb(GC[g.key] || '#ffffff'); for (let k = 0; k < g.n; k++) { const i = grp.length; grp.push(gi); mx.push(g.centre + K.gauss(r) * (g.err[1] - g.err[0]) * 0.6); pg.attributes.aCol.array.set(c, 3 * i); pg.attributes.aSize.array[i] = 0.018; } });
  const dots = new THREE.Points(pg, K.points(set)); set.group.add(dots);
  const cent = G.map((g, gi) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), K.fade(set, new THREE.MeshBasicMaterial({ color: GC[g.key] || '#fff' }), 1)); m.userData.group = gi + 1; set.group.add(m); return m; });
  const km = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.02), K.fade(set, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), 0.3)); km.position.set(0, -1.4, 0); set.group.add(km);
  const auc = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.02), K.fade(set, new THREE.MeshBasicMaterial({ color: 0xffb43b }), 0.3)); auc.position.set(1.8, -1.4, 0); set.group.add(auc);
  let S0 = {};
  const uOf = S => { if (S.people_custom > 0.5) return ON.map((o, i) => S['people_u' + i]); const p = S.people_profile, a = Math.floor(p), b = Math.min(3, a + 1), f = p - a; return S1.profiles[PK[a]].u.map((v, i) => K.lerp(v, S1.profiles[PK[b]].u[i], f)); };
  const strip = gi => [(G[gi] ? G[gi].centre : 5) * 0.2 - 1, -0.45 - gi * 0.12, 0];
  const A = { one: [0, 0.75, 0], bars: [-1.1, 0.4, 0], field: [0, 0, 0], plane: () => [0, 0.05 + Math.log(S0.people_theta || 1.5) * 0.5, 0], metrics: [0.9, 0.5, 0],
    map: [0, -0.6, 0], strip: [0, -0.6, 0], km: [0, -1.4, 0], auc: [1.8, -1.4, 0] };
  ON.forEach((o, i) => { A[o] = ring[i]; });
  G.forEach((g, gi) => { A['g' + (gi + 1)] = () => cent[gi].position.toArray(); });
  const params = { people_a: 1, people_bars: 0, people_ratio: 0, people_thresh: 0, people_one: 0, people_metrics: 0, people_profile: 0, people_custom: 0, people_theta: S1.theta,
    people_map: 0, people_mdi: 0, people_group: 0, people_km: 0, people_response: 0, people_follow: 0 };
  ON.forEach((o, i) => { params['people_u' + i] = S1.profiles.healthy.u[i]; });
  const _m = new THREE.Matrix4();
  return Object.assign(set, {
    params,
    update(S, t) {
      S0 = S;
      const u = uOf(S), th = S.people_theta, R = measure(u, th), lt = Math.log(th);
      bars.forEach((b, i) => { b.visible = S.people_bars > 0.02; b.scale.x = Math.max(1e-3, u[i] * 0.15 * S.people_bars); b.position.set(-1.4 + b.scale.x / 2, 0.75 - i * 0.08, 0); });
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = i === j ? 0 : Math.max(0, Math.log(u[i] / u[j])) * S.people_ratio; _m.makeScale(1, Math.max(1e-3, v * 0.5), 1).setPosition((j - 3) * 0.12, v * 0.25, (i - 3) * 0.12); field.setMatrixAt(i * N + j, _m); }
      field.instanceMatrix.needsUpdate = true; field.visible = S.people_ratio > 0.02;
      plane.visible = S.people_thresh > 0.02; plane.position.y = lt * 0.5 * S.people_thresh;
      const P = lg.attributes.position.array, Al = lg.attributes.aA.array, Cl = lg.attributes.aCol.array;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const k = i * N + j; P.set([...ring[i], ...ring[j]], 6 * k); Cl.set([1, 0.7, 0.3, 0.3, 0.6, 1], 6 * k); Al[2 * k] = Al[2 * k + 1] = R.e[i][j] * S.people_one; }
      lg.attributes.position.needsUpdate = lg.attributes.aA.needsUpdate = lg.attributes.aCol.needsUpdate = true; links.visible = S.people_one > 0.02;
      nodes.forEach((n, i) => { n.visible = S.people_one > 0.02 || S.people_bars > 0.5; n.scale.setScalar(0.6 + R.s[i] * 0.15 * (S.people_metrics > 0.5 ? 1 : 0.4)); });
      gauge.visible = S.people_metrics > 0.02; gauge.scale.y = Math.max(1e-3, R.mdi / 10); gauge.position.set(0.9, 0.3 + gauge.scale.y / 2, 0);
      dots.visible = S.people_map > 0.02;
      const g0 = Math.round(S.people_group);
      for (let i = 0; i < NP; i++) {
        const gi = grp[i], m = [(((i * 0.618) % 1) - 0.5) * 1.6, -0.6 + (((i * 0.377) % 1) - 0.5) * 0.6, 0], s = [mx[i] * 0.2 - 1, strip(gi)[1] + (((i * 0.21) % 1) - 0.5) * 0.06, 0];
        PP.set(K.v3.lerp(m, s, S.people_mdi), 3 * i); pg.attributes.aA.array[i] = S.people_map * (g0 && g0 !== gi + 1 ? 0.2 : 1);
      }
      pg.attributes.position.needsUpdate = pg.attributes.aA.needsUpdate = true;
      cent.forEach((c, gi) => { c.visible = S.people_mdi > 0.3; c.position.set(...strip(gi)); c.scale.setScalar(g0 === gi + 1 ? 1.6 : 1); });
      km.visible = S.people_km > 0.02; auc.visible = S.people_response > 0.02;
    },
    anchors: A,
    labels: ON.map((o, i) => ({ text: [PET_DATA.organs.find(x => x.id === o).short, ''], at: o, alpha: S => K.prog(S.people_one, 0.5, 1) * (1 - S.people_map) }))
      .concat([{ text: ['threshold', ''], at: 'plane', cls: 'cyn', alpha: S => K.prog(S.people_thresh, 0.5, 1) * (1 - S.people_one) },
        { text: ['displacement index', 'illustrative maths'], at: 'metrics', cls: 'amb', alpha: S => K.prog(S.people_metrics, 0.5, 1) * (1 - S.people_map) }],
      G.map((g, gi) => ({ text: [g.name, 'n = ' + g.n], at: 'g' + (gi + 1), alpha: S => K.prog(S.people_mdi, 0.6, 1) * (1 - S.people_km) }))),
    cam: { default: [0, 10, 3.6, 0, 0.4, 0], one: [-10, 12, 3.0, -0.3, 0.6, 0], field: [20, 35, 2.2, 0, 0.1, 0], metrics: [0, 8, 3.0, 0.2, 0.55, 0],
      map: [0, 4, 3.0, 0, -0.6, 0], strip: [0, 2, 2.8, 0, -0.65, 0], km: [0, 0, 2.4, 0, -1.4, 0], auc: [0, 0, 2.2, 1.8, -1.4, 0] },
    controls: [{ key: 'view', label: 'View', options: [['one', 'One scan'], ['ratios', 'Ratios'], ['people', 'People'], ['index', 'Index'], ['survival', 'Survival'], ['immunotherapy', 'Immunotherapy']] },
      { key: 'profile', label: 'Profile', options: [['healthy', 'Healthy'], ['cancer', 'Cancer'], ['both', 'Cancer + dyslipidaemia'], ['dys', 'Dyslipidaemia']] }],
    explore(c) {
      const v = c.view, one = v === 'one' || v === 'ratios';
      return { people_bars: v === 'one' ? 1 : 0, people_ratio: v === 'ratios' ? 1 : 0, people_thresh: one ? 1 : 0, people_one: v === 'one' ? 1 : 0, people_metrics: v === 'one' ? 1 : 0,
        people_profile: Math.max(0, PK.indexOf(c.profile)), people_map: one ? 0 : 1, people_mdi: v === 'index' ? 1 : 0, people_km: v === 'survival' ? 1 : 0, people_response: v === 'immunotherapy' ? 1 : 0 };
    },
    api() {
      return { measure, organs: ON,
        pick(rc) { const hit = rc.intersectObjects(nodes.concat(cent).filter(m => m.visible), false)[0]; return !hit ? null : hit.object.userData.organ ? { organ: hit.object.userData.organ } : { group: hit.object.userData.group }; } };
    },
  });
};

// `liver`: an organ is a network too (the PET story). The authors' VR viewer also shows one organ as a network of
// small patches; this is an illustrative stand-in built from scratch (no patient data). A liver as one smooth surface
// (a signed distance field: the big right lobe, the smaller left lobe, the notches of the gallbladder and the round
// ligament, the gallbladder in its bed underneath, the falciform ligament on the front) is filled with about 3,000
// patches on a regular grid, each with a stand-in uptake (smooth noise, a cooler and a warmer patch, a little noise
// per patch as in any scan). Two patches a few grid steps apart are linked when one outshines the other by more than
// a threshold (the poster's rule for organs, applied to patches): about 20,000 links. The best-connected 5 % glow.
// Everything is built once at load; update only sets uniforms, so the picture follows the params and the time alone.
// Frame: x the patient's left (so the right lobe is on your left when you face it), y up, z forward; about 1.6 wide.
SETS.liver = function (K) {
  const { THREE, smooth, clamp, lerp, prog, v3 } = K;
  const set = K.newSet('liver');
  const R = K.rng(1606);
  const ORG = typeof PET_DATA !== 'undefined' && (PET_DATA.organs || []).find(o => o.id === 'liver');
  const COL = K.rgb(ORG ? ORG.col : '#f97316'), HUBC = K.rgb('#ffb020'), LINKC = K.rgb('#3d6bff');
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const sat = x => clamp(x, 0, 1);
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // ------------------------------------------------------------------ the shape
  // The outline seen from the front, as an anatomy atlas draws it: the dome over the right lobe, its rounded right
  // border, the sharp inferior border rising to the tip of the left lobe, with two notches in it: the gallbladder's
  // (its fundus shows below it) and the round ligament's, where the falciform ligament divides the lobes. A flag 1
  // marks the notches' points, left out of the smooth outline that sets each column's height.
  const OUT = [
    [0.785, 0.125], [0.72, 0.205], [0.49, 0.29], [0.31, 0.335], [0.15, 0.352], [0.03, 0.362],
    [-0.13, 0.41], [-0.33, 0.455], [-0.53, 0.458], [-0.70, 0.40], [-0.81, 0.28], [-0.865, 0.10],
    [-0.862, -0.10], [-0.805, -0.29], [-0.705, -0.425], [-0.575, -0.50], [-0.445, -0.508], [-0.34, -0.474],
    [-0.285, -0.448], [-0.238, -0.405, 1], [-0.19, -0.418], [-0.10, -0.372], [0.0, -0.315], [0.034, -0.294],
    [0.058, -0.24, 1], [0.083, -0.268], [0.18, -0.212], [0.33, -0.122], [0.50, -0.032], [0.64, 0.035], [0.74, 0.07],
  ];
  const loop = (pts, n) => new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], 0)), true, 'centripetal')
    .getSpacedPoints(n).slice(0, n).map(p => [p.x, p.y]);
  const POLY = loop(OUT, 200), SMOOTH = loop(OUT.filter(p => !p[2]), 200);
  // signed distance to a closed polygon, negative inside (after Inigo Quilez)
  function sdPoly(V, x, y) {
    let d = Infinity, s = 1;
    for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
      const ex = V[j][0] - V[i][0], ey = V[j][1] - V[i][1], wx = x - V[i][0], wy = y - V[i][1];
      const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1), bx = wx - ex * t, by = wy - ey * t;
      d = Math.min(d, bx * bx + by * by);
      const c1 = y >= V[i][1], c2 = y < V[j][1], c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  }
  // Depth: the front (diaphragmatic) surface bulges forward; the back sits deep behind the right lobe and shallow
  // behind the left. Over the lower part of each column the back (visceral) surface slopes forward to meet the front,
  // so the inferior border is a thin, sharp edge at the front; the top is a broad dome. Both surfaces round off
  // towards the outline (an ellipse's quarter over a width W: tight at the inferior border, wide at the dome).
  const zF0 = x => 0.30 - 0.17 * smooth((x + 0.1) / 0.9);
  const zB0 = x => -0.44 + 0.30 * smooth((x + 0.3) / 0.9);
  const G = 0.012, X0 = -0.96, Y0 = -0.62, NX = 156, NY = 99;
  const D2 = new Float32Array(NX * NY), FR = new Float32Array(NX * NY), BK = new Float32Array(NX * NY);
  // each column's extent in the smooth outline (held constant beyond the right border's middle and the left lobe's
  // tip, where a column's extent shrinks to nothing), lightly smoothed along x
  const ext = x => { let yb = Infinity, yt = -Infinity;
    for (let a = 0, b = SMOOTH.length - 1; a < SMOOTH.length; b = a++) {
      const p = SMOOTH[a], q = SMOOTH[b];
      if ((p[0] <= x) !== (q[0] <= x)) { const y = p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]); yb = Math.min(yb, y); yt = Math.max(yt, y); }
    }
    return [yb, yt]; };
  const EXT = [];
  for (let i = 0; i < NX; i++) { const e = [0, 0]; for (let w = -3; w <= 3; w++) { const r = ext(clamp(X0 + (i + w) * G, -0.74, 0.7)); e[0] += r[0] / 7; e[1] += r[1] / 7; } EXT.push(e); }
  for (let i = 0; i < NX; i++) {
    const x = X0 + i * G, yb = EXT[i][0], yt = EXT[i][1];
    const zf0 = zF0(x), zb0 = zB0(x), vs = lerp(0.4, 0.62, smooth((x + 0.55) / 0.6));
    for (let j = 0; j < NY; j++) {
      const y = Y0 + j * G, q = j * NX + i, d = sdPoly(POLY, x, y);
      const v = sat((y - yb) / (yt - yb));
      const zf = zf0 + 0.035 * (1 - (2 * v - 1) * (2 * v - 1)) * (1 - 0.6 * smooth((x + 0.1) / 0.8));
      const zb = lerp(zf - 0.085, zb0, smooth(v / vs)), zc = 0.5 * (zf + zb);
      const wf = lerp(0.045, 0.26, smooth(v / 0.55)), wb = lerp(0.09, 0.26, smooth(v / 0.55));
      const sf = sat(-d / wf), sb = sat(-d / wb), ef = Math.sqrt(sf * (2 - sf)), eb = Math.sqrt(sb * (2 - sb));
      D2[q] = d; FR[q] = zc + (zf - zc) * ef; BK[q] = zc - (zc - zb) * eb;
    }
  }
  // round cones (after Inigo Quilez's capsule) for the cuts and the gallbladder
  const capsule = (a, b, r1, r2) => ({ a, b, r1, r2, ba: v3.sub(b, a), l2: v3.dot(v3.sub(b, a), v3.sub(b, a)) });
  function capD(c, x, y, z) {
    const px = x - c.a[0], py = y - c.a[1], pz = z - c.a[2], t = clamp((px * c.ba[0] + py * c.ba[1] + pz * c.ba[2]) / c.l2, 0, 1);
    const dx = px - c.ba[0] * t, dy = py - c.ba[1] * t, dz = pz - c.ba[2] * t;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - lerp(c.r1, c.r2, t);
  }
  // the gallbladder lies in its bed under the right lobe, its fundus at the notch; the round ligament's fissure runs
  // back from its notch; the vena cava lies in a groove at the back
  const GB_F = [-0.238, -0.398, 0.165], GB_N = [-0.075, -0.2, -0.14];
  const GB = capsule(GB_F, GB_N, 0.072, 0.04);
  const TERES = capsule([0.058, -0.25, 0.3], [0.045, -0.1, -0.2], 0.02, 0.026);
  const IVC = capsule([-0.03, -0.7, -0.43], [-0.02, 0.7, -0.4], 0.075, 0.075);
  // the field: the outline and the two surfaces (bilinear in the table), then the cuts, which only add to the outside
  let cD = 0, cF = 0, cB = 0;
  function column(x, y) {
    const u = (x - X0) / G, w = (y - Y0) / G;
    if (u < 0 || w < 0 || u >= NX - 1 || w >= NY - 1) { cD = 1; cF = cB = 0; return; }
    const i = Math.floor(u), j = Math.floor(w), a = u - i, b = w - j, q = j * NX + i, a1 = 1 - a, b1 = 1 - b;
    cD = (D2[q] * a1 + D2[q + 1] * a) * b1 + (D2[q + NX] * a1 + D2[q + NX + 1] * a) * b;
    cF = (FR[q] * a1 + FR[q + 1] * a) * b1 + (FR[q + NX] * a1 + FR[q + NX + 1] * a) * b;
    cB = (BK[q] * a1 + BK[q + 1] * a) * b1 + (BK[q + NX] * a1 + BK[q + NX + 1] * a) * b;
  }
  function cut(f, x, y, z) {
    if (f > 0.06) return f;
    f = smax(f, 0.008 - capD(GB, x, y, z), 0.035);
    f = smax(f, -capD(TERES, x, y, z), 0.02);
    return smax(f, -capD(IVC, x, y, z), 0.04);
  }
  function field(x, y, z) { column(x, y); return cut(Math.max(cD, z - cF, cB - z), x, y, z); }
  const grad = (p, e = 0.004) => [field(p[0] + e, p[1], p[2]) - field(p[0] - e, p[1], p[2]),
    field(p[0], p[1] + e, p[2]) - field(p[0], p[1] - e, p[2]), field(p[0], p[1], p[2] + e) - field(p[0], p[1], p[2] - e)].map(g => g / (2 * e));

  // the surface: surface nets on a grid, each vertex pulled onto the surface; smooth normals from the faces
  const surf = (function () {
    const h = 0.018, lo = [-0.93, -0.6, -0.52], n = [101, 64, 52], F = new Float32Array(n[0] * n[1] * n[2]);
    const id = (i, j, k) => (i * n[1] + j) * n[2] + k;
    for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) {
      const x = lo[0] + i * h, y = lo[1] + j * h, o = id(i, j, 0);
      column(x, y);
      if (cD > 0.06) { F.fill(cD, o, o + n[2]); continue; }
      for (let k = 0; k < n[2]; k++) { const z = lo[2] + k * h; F[o + k] = cut(Math.max(cD, z - cF, cB - z), x, y, z); }
    }
    const VI = new Int32Array(n[0] * n[1] * n[2]).fill(-1), P = [], cv = new Float64Array(8);
    const EG = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7], si = n[1] * n[2], sj = n[2];
    const CO = [0, si, sj, si + sj, 1, si + 1, sj + 1, si + sj + 1];   // the corners' offsets (bit 0 i, bit 1 j, bit 2 k)
    for (let i = 0; i < n[0] - 1; i++) for (let j = 0; j < n[1] - 1; j++) for (let k = 0; k < n[2] - 1; k++) {
      const o = id(i, j, k);
      let neg = 0;
      for (let c = 0; c < 8; c++) { const v = cv[c] = F[o + CO[c]]; if (v < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, ne = 0;
      for (let e = 0; e < 24; e += 2) {
        const a = EG[e], b = EG[e + 1];
        if ((cv[a] < 0) === (cv[b] < 0)) continue;
        const t = cv[a] / (cv[a] - cv[b]);
        sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; ne++;
      }
      // one Newton step onto the surface, along the cell's own gradient
      const gx = (cv[1] - cv[0] + cv[3] - cv[2] + cv[5] - cv[4] + cv[7] - cv[6]) / (4 * h);
      const gy = (cv[2] - cv[0] + cv[3] - cv[1] + cv[6] - cv[4] + cv[7] - cv[5]) / (4 * h);
      const gz = (cv[4] - cv[0] + cv[5] - cv[1] + cv[6] - cv[2] + cv[7] - cv[3]) / (4 * h);
      const x = lo[0] + (i + sx / ne) * h, y = lo[1] + (j + sy / ne) * h, z = lo[2] + (k + sz / ne) * h;
      const st = clamp(field(x, y, z) / (gx * gx + gy * gy + gz * gz || 1), -0.5 * h, 0.5 * h);
      VI[o] = P.length / 3; P.push(x - gx * st, y - gy * st, z - gz * st);
    }
    const I3 = [], quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I3.push(a, c, b, a, d, c); else I3.push(a, b, c, a, c, d); };
    for (let i = 0; i < n[0] - 1; i++) for (let j = 0; j < n[1] - 1; j++) for (let k = 0; k < n[2] - 1; k++) {
      const in0 = F[id(i, j, k)] < 0;
      if (j > 0 && k > 0 && in0 !== F[id(i + 1, j, k)] < 0) quad(VI[id(i, j - 1, k - 1)], VI[id(i, j, k - 1)], VI[id(i, j, k)], VI[id(i, j - 1, k)], !in0);
      if (i > 0 && k > 0 && in0 !== F[id(i, j + 1, k)] < 0) quad(VI[id(i - 1, j, k - 1)], VI[id(i - 1, j, k)], VI[id(i, j, k)], VI[id(i, j, k - 1)], !in0);
      if (i > 0 && j > 0 && in0 !== F[id(i, j, k + 1)] < 0) quad(VI[id(i - 1, j - 1, k)], VI[id(i, j - 1, k)], VI[id(i, j, k)], VI[id(i - 1, j, k)], !in0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(I3), 1));
    g.computeVertexNormals();
    g.computeBoundingBox();
    return g;
  })();
  const BB = surf.boundingBox, C0 = [(BB.min.x + BB.max.x) / 2, (BB.min.y + BB.max.y) / 2, (BB.min.z + BB.max.z) / 2];
  const spin = new THREE.Group(), body = new THREE.Group();
  set.group.add(spin); spin.add(body);
  body.position.set(-C0[0], -C0[1], -C0[2]);   // centred on the origin; the spin turns it about its own middle

  // ------------------------------------------------------------------ the patches
  // a regular grid (the scan's voxels, coarsened) with its step chosen so that about 3,000 patches lie inside. The
  // organ lies obliquely in the body, so the grid is turned against the liver's own axes (and no row of patches
  // lines up with the usual views)
  const TARGET = 3000;
  const MR = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.27, 0.417, 1.374, 'YXZ')).elements;   // columns: the grid's axes
  const gp = (i, j, k, hp) => [(MR[0] * i + MR[4] * j + MR[8] * k) * hp, (MR[1] * i + MR[5] * j + MR[9] * k) * hp, (MR[2] * i + MR[6] * j + MR[10] * k) * hp];
  const lattice = hp => {
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let c = 0; c < 8; c++) {
      const p = [c & 1 ? BB.max.x : BB.min.x, c & 2 ? BB.max.y : BB.min.y, c & 4 ? BB.max.z : BB.min.z];
      for (let a = 0; a < 3; a++) { const q = (MR[4 * a] * p[0] + MR[4 * a + 1] * p[1] + MR[4 * a + 2] * p[2]) / hp; lo[a] = Math.min(lo[a], Math.floor(q) - 1); hi[a] = Math.max(hi[a], Math.ceil(q) + 1); }
    }
    const out = [], fv = [];
    for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
      const p = gp(i, j, k, hp), f = field(p[0], p[1], p[2]);
      if (f < -0.3 * hp) { out.push(i, j, k); fv.push(f); }
    }
    return { hp, lo, hi, cells: out, fv };
  };
  // the finest step that still leaves at least 3,000 inside; then the few nearest the surface go, so exactly 3,000 stay
  let LAT = null;
  { let a = 0.04, b = 0.058;
    for (let it = 0; it < 9; it++) {
      const m = 0.5 * (a + b), L = lattice(m), n = L.cells.length / 3;
      if (n >= TARGET && (!LAT || n < LAT.cells.length / 3)) LAT = L;
      if (n > TARGET) a = m; else b = m;
    }
    const keep = [...LAT.fv.keys()].sort((p, q) => LAT.fv[p] - LAT.fv[q]).slice(0, TARGET).sort((p, q) => p - q);
    LAT.cells = keep.flatMap(c => LAT.cells.slice(3 * c, 3 * c + 3)); }
  const HP = LAT.hp, N = LAT.cells.length / 3, PP = new Float32Array(3 * N);
  const DIMS = LAT.hi.map((v, c) => v - LAT.lo[c] + 1), IDX = new Int32Array(DIMS[0] * DIMS[1] * DIMS[2]).fill(-1);
  const lid = (i, j, k) => ((i - LAT.lo[0]) * DIMS[1] + (j - LAT.lo[1])) * DIMS[2] + (k - LAT.lo[2]);
  // each node is drawn somewhere inside its own grid cell, not at the grid point: one per cell keeps them evenly
  // spread, and no rows of nodes line up from any side
  for (let n = 0; n < N; n++) {
    const i = LAT.cells[3 * n], j = LAT.cells[3 * n + 1], k = LAT.cells[3 * n + 2];
    PP.set(gp(i + 0.7 * (R() - 0.5), j + 0.7 * (R() - 0.5), k + 0.7 * (R() - 0.5), HP), 3 * n); IDX[lid(i, j, k)] = n;
  }
  // stand-in uptake (log scale, 0 the liver's usual): smooth noise in three octaves, a warmer patch high in the right
  // lobe, a cooler one where the lobes meet, and a little noise per patch
  const WARM = [-0.47, 0.13, 0.02], COOL = [0.2, 0.08, 0.0];
  const WAVES = [];
  const RU = K.rng(2025);
  [[0.95, 0.07], [0.5, 0.045], [0.27, 0.024]].forEach(([lam, amp]) => { for (let w = 0; w < 5; w++) WAVES.push([K.unit(RU), 2 * Math.PI / lam, amp, RU() * 6.2832]); });
  const LU = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const p = [PP[3 * n], PP[3 * n + 1], PP[3 * n + 2]];
    let L = 0;
    for (const [d, k, a, ph] of WAVES) L += a * Math.sin(k * v3.dot(d, p) + ph);
    const dw = v3.dist(p, WARM), dc = v3.dist(p, COOL);
    L += 0.36 * Math.exp(-dw * dw / (2 * 0.15 * 0.15)) - 0.28 * Math.exp(-dc * dc / (2 * 0.13 * 0.13)) + 0.038 * K.gauss(RU);
    LU[n] = L;
  }
  // links: every pair within 2.45 grid steps whose uptake ratio exceeds the threshold, from the brighter to the
  // dimmer; the threshold is the round ratio (two decimals) that leaves about 20,000 links
  const OFF = [];
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) {
    const r2 = a * a + b * b + c * c;
    if (r2 > 0 && r2 <= 6 && (a > 0 || (a === 0 && (b > 0 || (b === 0 && c > 0))))) OFF.push([a, b, c]);
  }
  const PA = new Int32Array(N * OFF.length), PB = new Int32Array(N * OFF.length), PD = new Float32Array(N * OFF.length);
  let NP = 0;
  for (let n = 0; n < N; n++) {
    const i = LAT.cells[3 * n], j = LAT.cells[3 * n + 1], k = LAT.cells[3 * n + 2];
    for (let q = 0; q < OFF.length; q++) {
      const o = OFF[q], ii = i + o[0], jj = j + o[1], kk = k + o[2];
      if (ii > LAT.hi[0] || jj < LAT.lo[1] || jj > LAT.hi[1] || kk < LAT.lo[2] || kk > LAT.hi[2]) continue;
      const m = IDX[lid(ii, jj, kk)];
      if (m >= 0) { PA[NP] = n; PB[NP] = m; PD[NP++] = LU[n] - LU[m]; }
    }
  }
  const LINKS_WANTED = 20000, SD = new Float32Array(NP);
  for (let e = 0; e < NP; e++) SD[e] = Math.abs(PD[e]);
  SD.sort();
  const above = th => { const l = Math.log(th); let a = 0, b = NP; while (a < b) { const m = (a + b) >> 1; if (SD[m] <= l) a = m + 1; else b = m; } return NP - a; };
  const q0 = Math.exp(SD[Math.max(0, NP - LINKS_WANTED)]) * 100;
  const THETA = [Math.floor(q0) / 100, Math.ceil(q0) / 100].sort((a, b) => Math.abs(above(a) - LINKS_WANTED) - Math.abs(above(b) - LINKS_WANTED))[0], LT = Math.log(THETA);
  const EA = [], EB = [], EW = [];
  for (let e = 0; e < NP; e++) {
    const d = PD[e] < 0 ? -PD[e] : PD[e];
    if (d <= LT) continue;
    const hot = PD[e] > 0;
    EA.push(hot ? PA[e] : PB[e]); EB.push(hot ? PB[e] : PA[e]); EW.push(d - LT);
  }
  const NL = EA.length, DEG = new Int32Array(N);
  for (let e = 0; e < NL; e++) { DEG[EA[e]]++; DEG[EB[e]]++; }
  // the best connected: the top 5 % by number of links
  const NH = Math.round(0.05 * N), ORDER = [...Array(N).keys()].sort((a, b) => DEG[b] - DEG[a] || a - b), HUB = new Uint8Array(N);
  for (let r = 0; r < NH; r++) HUB[ORDER[r]] = 1;
  const wMax = EW.reduce((m, w) => Math.max(m, w), 0) || 1;
  // where the hubs crowd most (the anchor 'top'): the hub with the most hubs within 0.15
  let TOP = [0, 0, 0];
  { let best = -1;
    for (let r = 0; r < NH; r++) {
      const a = ORDER[r]; let c = 0;
      for (let s = 0; s < NH; s++) { const b = ORDER[s], dx = PP[3 * a] - PP[3 * b], dy = PP[3 * a + 1] - PP[3 * b + 1], dz = PP[3 * a + 2] - PP[3 * b + 2]; if (dx * dx + dy * dy + dz * dz < 0.0225) c++; }
      if (c > best) { best = c; TOP = [PP[3 * a], PP[3 * a + 1], PP[3 * a + 2]]; }
    } }
  // patches appear from the middle out (by distance from their centroid)
  const CEN = [0, 0, 0];
  for (let n = 0; n < N; n++) for (let c = 0; c < 3; c++) CEN[c] += PP[3 * n + c] / N;
  const RV = new Float32Array(N);
  { let m = 0; for (let n = 0; n < N; n++) { RV[n] = Math.hypot(PP[3 * n] - CEN[0], PP[3 * n + 1] - CEN[1], PP[3 * n + 2] - CEN[2]); m = Math.max(m, RV[n]); }
    for (let n = 0; n < N; n++) RV[n] /= m; }

  // ------------------------------------------------------------------ materials
  const U = { uGrow: { value: 1 }, uLinks: { value: 1 }, uTop: { value: 0 }, uHubC: { value: new THREE.Color(...HUBC) },
    uLinkC: { value: new THREE.Color(...LINKC) } };
  const LOOK = `
uniform float uA, uGrow, uLinks, uTop; uniform vec3 uHubC, uLinkC;
// hot iron, as the body set draws the scan: black, dark red, red, orange, yellow, white
vec3 hot(float x) { return vec3(pow(clamp(x * 2.0, 0.0, 1.0), 0.9), pow(clamp((x - 0.15) / 0.8, 0.0, 1.0), 1.5), clamp((x - 0.76) * 4.2, 0.0, 1.0) * 0.95); }
// brighter in front of the set's middle, darker behind
float depthCue(vec4 mv) { vec4 o = modelViewMatrix * vec4(${C0.map(v => v.toFixed(4)).join(', ')}, 1.0); float s = length(modelViewMatrix[0].xyz); return clamp(1.0 - (o.z - mv.z) / s * 0.75, 0.45, 1.3); }
`;
  const mat = (vs, fs, extra) => {
    const m = new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U),
      vertexShader: K.GLSL + LOOK + vs, fragmentShader: fs,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }, extra || {}));
    set.mats.push(m);
    return m;
  };
  // a glassy surface lit like an organ in a dark room: a glowing rim, a soft key light, faint contour bands
  const glass = (col, o) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uC: { value: new THREE.Color(...col) }, uK: { value: 1 }, uF: { value: o.face }, uR: { value: o.rim },
        uD: { value: o.dif }, uB: { value: o.band || 0 }, uY: { value: new THREE.Vector3(...(o.fade || [-9, -8, 1])) } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN, vV; varying float vY;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vY = position.y; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uA, uK, uF, uR, uD, uB; uniform vec3 uC, uY; varying vec3 vN, vV; varying float vY;
void main() {
  vec3 n = normalize(vN), v = normalize(vV); float nv = dot(n, v); n *= sign(nv);
  float r = pow(1.0 - abs(nv), 2.4);
  vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
  float dif = max(dot(n, L), 0.0), sp = pow(max(dot(reflect(-L, n), v), 0.0), 18.0);
  float bw = fwidth(vY * 18.0), band = uB * (1.0 - smoothstep(0.0, 1.5 * bw, abs(fract(vY * 18.0) - 0.5) - 0.5 + 1.5 * bw)) * (1.0 - r);
  float a = (uF + uR * r + uD * dif + band) * uA * uK * mix(1.0, uY.z, smoothstep(uY.x, uY.y, vY));   // uY: fades along local y
  gl_FragColor = vec4(uC * (0.6 + 0.6 * r) + vec3(1.0, 0.92, 0.85) * sp * 0.5, a + sp * 0.1 * uA * uK);
}`,
      extensions: { derivatives: true },
    });
    set.mats.push(m);
    return m;
  };

  // ------------------------------------------------------------------ the organ
  const shellMat = glass(COL, { face: 0.025, rim: 0.5, dif: 0.12, band: 0.05 });
  const shell = new THREE.Mesh(surf, shellMat);
  shell.renderOrder = 1;
  body.add(shell);
  // the gallbladder in its bed (bile green, faint): a pear from the fundus to the neck, and the cystic duct
  {
    const prof = [];
    for (let s = 0; s <= 24; s++) {
      const u = s / 24, r = u < 0.25 ? 0.074 * Math.sin(Math.acos(1 - u / 0.25 * 1)) : lerp(0.074, 0.036, smooth((u - 0.25) / 0.75));
      prof.push(new THREE.Vector2(Math.max(r, 0.0001), -0.074 + u * (v3.dist(GB_F, GB_N) + 0.074)));
    }
    prof.push(new THREE.Vector2(0.012, v3.dist(GB_F, GB_N) + 0.03), new THREE.Vector2(0.011, v3.dist(GB_F, GB_N) + 0.09), new THREE.Vector2(0.0001, v3.dist(GB_F, GB_N) + 0.092));
    const g = new THREE.LatheGeometry(prof, 20);
    const m = new THREE.Mesh(g, glass(K.rgb('#9ad66a'), { face: 0.03, rim: 0.45, dif: 0.08, fade: [0.02, 0.16, 0.3] }));   // its body and neck, up under the liver, stay faint
    m.position.set(...GB_F);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...v3.norm(v3.sub(GB_N, GB_F))));
    body.add(m);
  }
  // the falciform ligament: over the front from the round ligament's notch, across the dome towards the back,
  // traced on the surface in a plane that leans a little to the right; the round ligament leaves the notch below
  const LIG = [];
  {
    const cx = y => 0.055 - 0.07 * sat((y + 0.24) / 0.6), C = [0, -0.02, -0.08];
    const onSurf = (dy, dz) => { let a = 0, b = 1.2;
      for (let it = 0; it < 30; it++) { const m = 0.5 * (a + b), y = C[1] + m * dy, z = C[2] + m * dz; if (field(cx(y), y, z) < 0) a = m; else b = m; }
      const y = C[1] + a * dy, z = C[2] + a * dz, p = [cx(y), y, z], g = v3.norm(grad(p)); return v3.add(p, v3.mul(g, 0.004)); };
    const t0 = Math.atan2(-0.24 - C[1], 0.26 - C[2]);
    for (let s = 0; s <= 36; s++) { const t = lerp(t0, 1.95, s / 36); LIG.push(onSurf(Math.sin(t), Math.cos(t))); }
  }
  const ligMat = glass(K.rgb('#ffd2a8'), { face: 0.07, rim: 0.4, dif: 0.12, fade: [0.28, 0.4, 0.1] });   // it fades over the dome
  body.add(new THREE.Mesh(K.tube(LIG, 0.0055, 120, 6), ligMat));

  // ------------------------------------------------------------------ the patches, drawn
  const ptGeo = new THREE.BufferGeometry();
  {
    const A = new Float32Array(4 * N);
    for (let n = 0; n < N; n++) { A[4 * n] = clamp(0.5 + 0.95 * LU[n], 0.16, 1); A[4 * n + 1] = RV[n]; A[4 * n + 2] = HUB[n]; A[4 * n + 3] = R(); }
    ptGeo.setAttribute('position', new THREE.BufferAttribute(PP, 3));
    ptGeo.setAttribute('aI', new THREE.BufferAttribute(A, 4));
    ptGeo.computeBoundingSphere();
  }
  const ptMat = mat(`
attribute vec4 aI;
uniform float uSz;
varying vec3 vC; varying float vA, vHot;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float g = uGrow * 1.1, ap = smoothstep(aI.y, aI.y + 0.05, g), fl = uGrow < 0.999 ? exp(-pow((g - aI.y - 0.035) / 0.045, 2.0)) : 0.0;
  float hub = aI.z * uTop, pulse = 0.8 + 0.2 * sin(uTime * 1.6 + aI.w * 6.2832);
  vec3 c = hot(aI.x) * (1.0 - 0.3 * uLinks) * (0.9 + 0.1 * sin(uTime * 1.1 + aI.w * 40.0));
  c = mix(c, uHubC * 1.3 * pulse, hub);
  c = mix(c, vec3(1.0, 0.93, 0.8), fl * 0.6);   // the growing front glows white
  float br = mix(1.0, 0.28, uTop * (1.0 - aI.z)) * (1.0 + 2.2 * fl);
  float sz = uSz * (1.0 + 1.0 * hub) * (1.0 - 0.3 * uTop * (1.0 - aI.z)) * (1.0 + 0.5 * fl) * ap;
  // up close (as in a headset) points shrink with distance and never grow beyond about two degrees
  float sc = length(modelViewMatrix[0].xyz), dl = -mv.z / sc;
  gl_PointSize = min(pointPx(sz * clamp(dl / 1.4, 0.5, 1.0), mv), 0.035 * uPx * projectionMatrix[1][1] / sc);
  vC = c * br * depthCue(mv); vHot = hub; vA = uA * ap;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA, vHot;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.65, 0.1, d), halo = pow(1.0 - d, 2.0);
  vec3 c = vC * (0.65 + 0.5 * core) + vec3(1.0, 0.95, 0.85) * vHot * smoothstep(0.4, 0.0, d) * 0.6;
  gl_FragColor = vec4(c, vA * (core * 0.6 + halo * 0.35));
}`);
  ptMat.uniforms.uSz = { value: HP * 0.62 };
  const pts = new THREE.Points(ptGeo, ptMat);
  pts.renderOrder = 3;
  body.add(pts);

  // ------------------------------------------------------------------ the links, drawn
  const lnGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(6 * NL), A = new Float32Array(8 * NL), B = new Float32Array(4 * NL);
    for (let e = 0; e < NL; e++) {
      const a = EA[e], b = EB[e], w = Math.sqrt(EW[e] / wMax), hub = HUB[a] | HUB[b], rv = Math.max(RV[a], RV[b]);
      const ord = 0.72 * rv + 0.28 * R(), ph = R();
      for (let s = 0; s < 2; s++) {
        const n = s ? b : a, v = 2 * e + s;
        pos[3 * v] = PP[3 * n]; pos[3 * v + 1] = PP[3 * n + 1]; pos[3 * v + 2] = PP[3 * n + 2];
        A[4 * v] = s; A[4 * v + 1] = w; A[4 * v + 2] = ord; A[4 * v + 3] = ph; B[2 * v] = rv; B[2 * v + 1] = hub;
      }
    }
    lnGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lnGeo.setAttribute('aL', new THREE.BufferAttribute(A, 4));
    lnGeo.setAttribute('aR', new THREE.BufferAttribute(B, 2));
    lnGeo.computeBoundingSphere();
  }
  const lnMat = mat(`
attribute vec4 aL; attribute vec2 aR;
varying vec3 vC; varying float vA, vS, vPh;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float hub = aR.y, ord = aL.z, ph = aL.w;
  float on = smoothstep(ord, ord + 0.06, uLinks * 1.06) * smoothstep(aR.x, aR.x + 0.05, uGrow * 1.1);
  float hl = hub * uTop;
  vec3 c = mix(uLinkC, vec3(0.5, 0.72, 1.0), aL.y * 0.4);
  c = mix(c, uHubC, hl * 0.9);
  float br = (0.35 + 0.65 * aL.y) * mix(1.0, 0.16, uTop * (1.0 - hub)) * (1.0 + 0.7 * hl);
  // up close each line covers fewer others, so it may be brighter
  vC = c * br * depthCue(mv); vS = aL.x; vPh = ph; vA = uA * on * clamp(2.6 * length(modelViewMatrix[0].xyz) / -mv.z, 1.0, 2.5);
}`, `
uniform float uTime;
varying vec3 vC; varying float vA, vS, vPh;
void main() {
  if (vA < 0.004) discard;
  float w = fract(vPh + uTime * 0.3) * 1.5 - 0.25, g = exp(-pow((vS - w) / 0.13, 2.0));
  gl_FragColor = vec4(vC * (1.0 + 1.6 * g), vA * (0.024 + 0.07 * g));
}`);
  const lns = new THREE.LineSegments(lnGeo, lnMat);
  lns.renderOrder = 2;
  body.add(lns);

  // ------------------------------------------------------------------ anchors, labels
  let ang = 0;
  const at = p => () => { const x = p[0] - C0[0], y = p[1] - C0[1], z = p[2] - C0[2], c = Math.cos(ang), s = Math.sin(ang); return [x * c + z * s, y, -x * s + z * c]; };
  // a point on the surface: from the inside point p outwards along d
  const surfAt = (p, d) => { let a = 0, b = 1; d = v3.norm(d);
    for (let it = 0; it < 30; it++) { const m = 0.5 * (a + b), q = v3.add(p, v3.mul(d, m)); if (field(q[0], q[1], q[2]) < 0) a = m; else b = m; }
    return v3.add(p, v3.mul(d, a)); };
  const anchors = {
    centre: [0, 0, 0],                                               // the middle of the organ (of its box)
    core: at(CEN),                                                   // the middle of its patches, where they start to grow
    top: at(TOP),
    right: at(surfAt([-0.45, 0.05, -0.05], [-0.55, 0.6, 0.6])),   // the right lobe, its upper outer front
    left: at(surfAt([0.5, 0.1, 0.0], [0.3, 0.25, 1])),            // the left lobe
    dome: at(surfAt([-0.4, 0.1, -0.08], [0, 1, 0.15])),           // the top of the dome
    notch: at(v3.add(GB_F, [0, -0.08, 0.02])),                     // the gallbladder's notch, its fundus below the edge
    teres: at(LIG[0]),                                               // the round ligament's notch
    warm: at(WARM), cool: at(COOL),
    web: at(surfAt(WARM, [0.3, -0.5, 1])),                          // where the links crowd, on the front
  };
  const labels = [
    { text: [fmt(N) + ' patches', ''], at: 'right', alpha: S => prog(S.liver_grow, 0.55, 0.85) * (1 - prog(S.liver_links, 0.1, 0.35)) },
    { text: ['Links:', 'uptake ratio above the threshold'], at: 'web', cls: 'cyn', alpha: S => prog(S.liver_links, 0.35, 0.65) * prog(S.liver_grow, 0.7, 0.95) * (1 - prog(S.liver_top, 0.1, 0.4)) },
    { text: ['Best connected', 'the top 5 % of patches'], at: 'top', cls: 'amb', alpha: S => prog(S.liver_top, 0.45, 0.8) * prog(S.liver_grow, 0.7, 0.95) },
  ];
  return Object.assign(set, {
    params: { liver_a: 1, liver_grow: 1, liver_links: 1, liver_top: 0, liver_spin: 0 },
    update(S) {
      const p = k => (S[k] === undefined ? set.params[k] : S[k]);
      ang = p('liver_spin') * Math.PI * 2;
      spin.rotation.y = ang;
      U.uGrow.value = sat(p('liver_grow')); U.uLinks.value = sat(p('liver_links')); U.uTop.value = sat(p('liver_top'));
      shellMat.uniforms.uK.value = 1 - 0.35 * U.uLinks.value - 0.25 * U.uTop.value;
    },
    anchors,
    labels,
    cam: {
      default: [-16, 9, 3.1, 0, -0.02, 0],
      front: [0, 3, 3.1, 0, 0, 0],
      close: [-34, 12, 1.5, ...at(WARM)()],
      below: [-12, -52, 3.1, 0, -0.05, 0],
      side: [-90, 6, 3.0, 0, 0, 0],
    },
    controls: [{ key: 'view', label: 'View', options: [['patches', 'Patches'], ['links', 'Links'], ['hubs', 'Hubs']] }],
    explore(c) { return { liver_grow: 1, liver_links: c.view === 'patches' ? 0 : 1, liver_top: c.view === 'hubs' ? 1 : 0, liver_spin: 0 }; },
    api() { return { patches: N, links: NL, theta: THETA, hubs: NH, step: HP, meanLinks: 2 * NL / N, maxLinks: DEG[ORDER[0]] }; },
  });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['scan', 'body', 'organs', 'people', 'liver'];
// sets drawn in another set's frame: the organs lie in the PET body, so the two always turn together
const FRAME = { body: 'organs' };
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
function applyCamera(v) {
  viewDir(v, _vd); _vt.set(v[3], v[4], v[5]);
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * (GL.fit || 1));
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
  [0, 0], [330, 330],
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
  { key: 'title', name: 'Intro', a: 0, b: 16 },
  { key: 'scanner', name: 'Scanner', a: 16, b: 52 },
  { key: 'body', name: 'Sugar', a: 52, b: 90 },
  { key: 'organs', name: 'Organs', a: 90, b: 128 },
  { key: 'cohort', name: 'Network', a: 128, b: 172 },
  { key: 'health', name: 'Health', a: 172, b: 218 },
  { key: 'one', name: 'One scan', a: 218, b: 258 },
  { key: 'people', name: 'People', a: 258, b: 305 },
  { key: 'vision', name: 'Vision', a: 305, b: 330 },
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

// ------------------------------------------------------------------- data --
// The paper's and the poster's numbers (PET_DATA), looked up once for the story and the panels. The networks read off
// the figures may still be empty (no links yet): everything here works with any subset of organs and any number of links.
const PD = (() => {
  const D = PET_DATA, byId = {};
  D.organs.forEach((o, i) => { byId[o.id] = Object.assign({ i }, o); });
  return { D, byId, ids: D.organs.map(o => o.id), nets: Object.fromEntries((D.nets || []).map(n => [n.id, n])) };
})();
const netOf = id => PD.nets[id] || null;
const edgesOf = id => { const n = netOf(id); return n && Array.isArray(n.edges) ? n.edges : []; };
const hasNet = id => edgesOf(id).length > 0;
// a network's hubs: as printed (the paper's orange nodes), else computed from its links (strength z-score above 1.7)
const hubsPrinted = id => { const n = netOf(id); return !!(n && n.hubs && n.hubs.length); };
const hubsOf = id => { const n = netOf(id); return !n ? [] : hubsPrinted(id) ? n.hubs : (n.computed && n.computed.hubs) || []; };
const organName = id => (PD.byId[id] ? PD.byId[id].name : String(id));
const organLow = id => { const s = organName(id); return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; };
const organCol = id => (PD.byId[id] ? PD.byId[id].col : '#9aa3b5');
// the networks the organs set can show (organs_which: an index into this list), with their short names
const NET_IDS = ['full', 'FDG_healthy', 'A_low', 'A_high', 'B_low', 'B_high', 'C_low', 'C_mid', 'C_high', 'HK2', 'GLUT'];
const NET_SHORT = ['All scans', 'Healthy', 'BMI low', 'BMI high', 'Tumour low', 'Tumour high', 'CRP low', 'CRP mid', 'CRP high', 'HK2', 'GLUT'];
const netShort = id => NET_SHORT[NET_IDS.indexOf(id)] || String(id);
// Table 2's comparisons whose groups the paper drew as networks (Figures 2A and 3): one network per group, or null.
// (Figure 4's healthy FDG network uses only the organs GTEx has too, so it belongs with the protein networks, Table 3.)
function rowNets(r) {
  if (!r) return [];
  const m = r.what === 'BMI' && /healthy/.test(r.cohort) ? ['A_low', 'A_high'] : r.what === 'Tumour load' ? ['B_low', 'B_high']
    : r.what === 'CRP' && /thirds/.test(r.cohort) ? ['C_low', 'C_mid', 'C_high'] : r.what === 'Blood pool' ? ['full', null] : [];
  return r.groups.map((g, i) => m[i] || null);
}
const rowOfNet = id => PD.D.table2.findIndex(r => rowNets(r).includes(id));
// Table 3's protein networks drawn in Figure 4
const PROT_NET = r => (r.kind === 'fdg' ? 'FDG_healthy' : /HK2/.test(r.name) ? 'HK2' : /GLUT/.test(r.name) ? 'GLUT' : null);
// the four profiles of the one-scan network, in the order of people_profile, and the poster's groups' colours
const PROFILES = [['healthy', 'Healthy'], ['cancer', 'Cancer'], ['both', 'Cancer + dyslipidaemia'], ['dys', 'Dyslipidaemia']];
const GROUP_COL = { cancer: '#d9dde6', both: '#9b5de5', dys: '#ff4fd8', healthy: '#38bdf8' };
const THIRD_COL = ['#38bdf8', '#a78bfa', '#d9dde6'];
// The poster's numbers. Its survival curves, the immunotherapy test and its cohort may arrive later, and in more than
// one shape: lists of { name or label or key, n, ... } or objects keyed by group. Whatever is missing is left unsaid.
const POSTER = (() => {
  const P = PET_DATA.poster || {};
  const list = x => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.entries(x).map(([k, v]) => (v && typeof v === 'object' ? Object.assign({ key: k }, v) : { key: k, n: v })) : []);
  const name = g => String(g.name || g.label || g.key || '');
  const sum = l => l.reduce((a, g) => a + (Number.isFinite(+g.n) ? +g.n : 0), 0);
  const groups = ((P.mdi && P.mdi.groups) || []).map((g, i) => Object.assign({ i, col: GROUP_COL[g.key] || '#9aa3b5' }, g, { name: name(g) }));
  const co = P.cohort || {}, base = list(co.baseline || co.base), follow = list(co.followup || co.followUp || co.follow);
  // survival by the index's thirds: median in months (null or a word: not reached) and survival after one year (a share)
  const km = P.km || {}, thirds = list(Array.isArray(km) ? km : km.groups || km.thirds || km.tertiles).map((g, i) => {
    const mk = ['median', 'medianMonths', 'med'].find(k => k in g), yk = ['y1', 'oneYear', 'surv1', 's1', 'year1'].find(k => k in g);
    const md = mk ? g[mk] : undefined, y = yk ? +g[yk] : NaN;
    return { name: name(g), n: +g.n || null, col: THIRD_COL[i] || '#9aa3b5', median: md === undefined ? undefined : Number.isFinite(+md) && md !== null ? +md : null,
      y1: Number.isFinite(y) ? Math.round(y <= 1 ? y * 100 : y) : null };
  });
  // the immunotherapy test: response groups and the AUC of each measure (the network's own in the set's colour)
  const pr = P.prognosis || {}, resp = list(pr.groups || pr.response || pr.responders);
  const auc = list(pr.auc || pr.aucs || pr.measures).filter(a => Number.isFinite(+a.auc)).map(a => ({ name: name(a), auc: +a.auc, p: a.p !== undefined ? String(a.p) : '',
    net: a.kind ? /net|metab|index|pet/i.test(a.kind) : a.network !== undefined ? !!a.network : /index|clearance|heterogen|network|displacement/i.test(name(a)) }));
  const ici = follow.find(g => /immun|ici|checkpoint/i.test(name(g)));
  const respN = +pr.n || sum(resp) || (ici ? +ici.n : 0) || null;
  return { groups, mdiN: sum(groups), base, follow, baseN: sum(base), followN: sum(follow), thirds, resp, respN, auc, name,
    bestNet: auc.filter(a => a.net).sort((a, b) => b.auc - a.auc)[0] || null, bestClin: auc.filter(a => !a.net).sort((a, b) => b.auc - a.auc)[0] || null };
})();

// ------------------------------------------------------------------ facts --
// Numbers the story quotes, all from PET_DATA (a comparison or a reading not there yet leaves its sentence out)
const FACTS = (() => {
  const D = PET_DATA, c = D.cohort, p = D.protocol, full = netOf('full') || { edges: [], density: 0, disorder: 0 };
  const row = (what, re) => D.table2.find(r => r.what === what && (!re || re.test(r.cohort))) || null;
  const num = s => { const m = /(\d+(?:\.\d+)?)/.exec(s || ''); return m ? +m[1] : null; };
  const retest = row('Test-retest');
  return {
    scans: c.scans, subjects: c.subjects, healthy: c.healthy, cancer: c.cancer, lung: c.lung, hnscc: c.hnscc, gtex: c.gtex,
    fasting: p.fasting, dose: p.dose, rest: p.rest, hubZ: p.hub, p: p.p, seg: p.segmentation,
    organs: D.organs.length - 1, f2n: D.f2.organs.length, density: full.density, disorder: full.disorder, links: full.edges.length,
    row: { cancer: row('Cancer'), bmi: row('BMI', /healthy/), crp: row('CRP', /thirds/), tumour: row('Tumour load'), norepi: row('Norepinephrine') },
    weeks: retest ? num(retest.cohort) : null,
    robust: D.table2.filter(r => r.part === 'test'), hk2: D.table3.find(r => /HK2/.test(r.name)) || null, tested: D.table3.filter(r => r.kind !== 'fdg').length,
    pair: (D.synth && D.synth.pairs && D.synth.pairs[0]) || null, single: D.single, poster: POSTER,
    year: num((/\((\d{4})\)/.exec(D.source.paper) || [])[1]),
  };
})();
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'][n] || String(n);
const Word = n => { const w = word(n); return w.charAt(0).toUpperCase() + w.slice(1); };
const dis = v => (Number.isFinite(+v) ? (+v).toFixed(2) : '–');
const pct = v => (Number.isFinite(+v) ? `${+v}%` : '–');

// the story's own networks, in the order it shows them (one that has no links yet is skipped: the network stays)
function buildStory() {
  const F = FACTS, R = F.row, P = F.poster, S1 = F.single, prof = k => (S1 && S1.profiles && S1.profiles[k]) || null;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // jump an index param (an organ, a pair, a group) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const oi = id => (PD.byId[id] ? PD.byId[id].i + 1 : 0);   // organs_focus for an organ
  const wi = id => NET_IDS.indexOf(id);                      // organs_which for a network
  const gD = (r, i) => (r && r.groups[i] ? pct(r.groups[i].density) : '–'), gO = (r, i) => (r && r.groups[i] ? dis(r.groups[i].disorder) : '–');
  const step = (id, at, text) => `<li data-at="${at}" style="border-left-color:${organCol(id)}"><b style="color:${organCol(id)}">${esc(organName(id))}</b>${text}</li>`;
  const ones = (S1 && S1.organs) || [], hub3 = hubsOf('C_high').filter(h => h !== 'aorta');
  const hubName = hub3.length ? listOf(hub3.map(organName)) : '';
  const thirds = P.thirds.filter(g => g.median !== undefined || g.y1 !== null);
  const med = g => (g.median === null ? 'not reached' : `${g.median} months`);
  const bar = P.follow.find(g => /bariatric/i.test(P.name(g)));
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">One scan, one system</h1>
      <p class="lede" data-at="2.4">the body as a metabolic network</p>
      <p data-at="4">From one PET scan to a network of organs: what it says about health, disease and survival.</p>
      <p class="note" data-at="9">After a paper in Med${F.year ? ` (${F.year})` : ''} and a poster from the Division of Nuclear Medicine, Medical University of Vienna, and the LBI for Network Medicine.</p>`,
    scanner: `<h2 data-at="0.6">Seeing sugar</h2>
      <p data-at="1.2">A PET scan starts with a sugar. FDG (fluorodeoxyglucose) is glucose carrying radioactive fluorine-18.</p>
      <p data-at="5">After at least ${F.fasting} hours without food, ${F.dose[0]} to ${F.dose[1]} MBq of FDG go into a vein. For about ${F.rest} minutes the person rests, and cells take the sugar up as if it were glucose: hexokinase traps it inside.</p>
      <p data-at="11">Then the scan. Around the tunnel sits a ring of detectors.</p>
      <ul class="steps">
        <li data-at="13"><b>A positron</b>fluorine-18 decays and sends one out; it travels about a millimetre</li>
        <li data-at="17"><b>Two photons</b>it meets an electron, and both turn into two gamma photons of 511 keV, flying off in opposite directions</li>
        <li data-at="21"><b>A coincidence</b>two detectors on opposite sides register them at once: the line between them passes through where the sugar was</li>
      </ul>
      <p data-at="27" class="amber">Millions of such lines make the image: a map of where the body takes up sugar.</p>
      <p class="credits" data-at="31">The uptake is measured as the SUV, the standardised uptake value. Protocol as in the paper.</p>`,
    body: `<h2 data-at="0.6">Where the sugar goes</h2>
      <p data-at="1.2">The tracer arrives with the blood, and within the hour it settles where cells use sugar.</p>
      <p data-at="10">The brain and the heart take up the most. The kidneys and the bladder glow too: FDG is filtered into the urine and not taken back, so it leaves the body that way.</p>
      <p data-at="20">A tumour shows as a hot spot. Usually that is all a scan is read for.</p>
      <p data-at="29" class="amber">Yet the scan holds every organ's metabolism at once.</p>`,
    organs: `<h2 data-at="0.6">Every organ, measured</h2>
      <p data-at="1.2">An AI (${esc(F.seg)}) outlines ${F.organs} organs in every scan, slice by slice, and a doctor checks them.</p>
      <p data-at="14">Each organ's uptake is divided by that of the aorta: the blood pool, the same reference in every scan.</p>
      <ul class="steps">
        ${step('brain', 23, `${esc(PD.byId.brain.measure)}: it lives on sugar`)}
        ${step('liver', 27, esc(PD.byId.liver.measure))}
        ${step('muscle', 31, esc(PD.byId.muscle.measure))}
      </ul>
      <p data-at="35" class="amber">One scan, one row of numbers.</p>
      <p class="credits" data-at="36">The organs' values shown here are typical uptakes, for illustration.</p>`,
    cohort: `<h2 data-at="0.6">${fmt(F.scans)} scans</h2>
      <p data-at="1.2">The paper took ${fmt(F.scans)} scans of ${fmt(F.subjects)} people: ${F.healthy} of healthy volunteers and ${F.cancer} of people with cancer (${F.lung} lung, ${F.hnscc} head and neck).</p>
      <div class="facts"><div data-at="7"><b>${fmt(F.scans)}</b><small>scans</small></div><div data-at="8.5"><b>${F.f2n}</b><small>organs in the network</small></div><div data-at="10"><b>${fmt(F.scans * F.f2n)}</b><small>values</small></div></div>
      ${F.pair ? `<p data-at="15">Which organs rise and fall together across people? Take the ${esc(organLow(F.pair.a))} and the ${esc(organLow(F.pair.b))}.</p>
      <p data-at="19">A plain correlation mixes direct links with links that only pass through other organs.</p>
      <p data-at="23" class="amber">A partial correlation first takes out what all the other organs explain, then correlates what is left: here r = ${F.pair.r} becomes ${F.pair.pr} (the paper: ${F.pair.paper}).</p>` : ''}
      <p data-at="31">Keep the significant ones (p &lt; ${F.p}) and draw them: blue where two organs rise together, red where one rises as the other falls.</p>
      <p data-at="36">The network of all ${fmt(F.scans)} scans: ${F.f2n} organs, ${F.links} links.</p>
      <p class="credits" data-at="39">Figure 2A of the paper. The people in the scatter plot are ${fmt(F.scans)} stand-ins with the paper's partial correlations.</p>`,
    health: `<h2 data-at="0.6">From health to disease</h2>
      <p data-at="1.2">Split the scans into groups, and give each group its own network.${R.cancer ? ` Healthy people's is dense: ${gD(R.cancer, 0)} of the most possible, against ${gD(R.cancer, 1)} with cancer.` : ''}</p>
      ${R.bmi ? `<p data-at="7">Body weight, in healthy people: ${gD(R.bmi, 0)} below the median BMI, ${gD(R.bmi, 1)} above it. The brain becomes a hub.</p>` : ''}
      <p data-at="16">Two measures. Density: all links' strength together, as a share of the most possible. Disorder: how unevenly that strength is spread, from 0 (even) up (a few hubs).</p>
      ${R.crp ? `<p data-at="21" class="amber">Inflammation (CRP, in thirds): density ${listOf(R.crp.groups.map(g => pct(g.density)))}; disorder ${listOf(R.crp.groups.map(g => dis(g.disorder)))}. As health erodes, muscle and subcutaneous fat take over as hubs.</p>` : ''}
      ${R.norepi && R.tumour ? `<p data-at="31">Stress (norepinephrine, ${gD(R.norepi, 0)} against ${gD(R.norepi, 1)}) and tumour load (${gD(R.tumour, 0)} against ${gD(R.tumour, 1)}) thin it too.</p>` : ''}
      <p data-at="35">${F.robust.every(r => !r.sigD && !r.sigO) ? `And it holds: ${F.weeks ? `scans ${F.weeks} weeks apart, ` : ''}an ultra-low dose, another scanner, men and women, the aorta or the vena cava as the reference: no significant difference.` : ''}</p>
      ${F.hk2 ? `<p data-at="39">Of ${F.tested} proteins whose networks came from the tissues of ${fmt(F.gtex)} people, only hexokinase 2, the enzyme that traps FDG, has a network like FDG's (r = ${F.hk2.r}).</p>` : ''}
      <p class="credits" data-at="42">Table 2 and Figures 3 and 4 of the paper (networks other than the full cohort's read off its figures). Disorder: ${R.cancer ? `${gO(R.cancer, 0)} healthy, ${gO(R.cancer, 1)} with cancer; ` : ''}a hub has a strength z-score above ${F.hubZ}.</p>`,
    one: `<h2 data-at="0.6">One scan, one network</h2>
      <p data-at="1.2">So far, one network for a whole group. The next step: a network for every scan, from ${word(ones.length)} organs.</p>
      <p data-at="6">Compare every organ with every other: how much more sugar does it take up?</p>
      <p data-at="12">Where one outshines another by more than a threshold, draw a link. The links make this person's network.</p>
      <ul class="steps">
        <li data-at="24"><b>Clearance</b>how the kidneys handle the tracer</li>
        <li data-at="27"><b>Heterogeneity</b>how unevenly the uptake is spread over the organs</li>
      </ul>
      ${prof('healthy') && prof('cancer') && prof('dys') ? `<p data-at="30" class="amber">Together they give a metabolic displacement index. It moves with health: ${prof('healthy').mdi.toFixed(1)} for a healthy profile, ${prof('cancer').mdi.toFixed(1)} with cancer, ${prof('dys').mdi.toFixed(1)} with dyslipidaemia (unhealthy blood fats).</p>` : ''}
      <p class="note" data-at="34">Illustrative maths: the poster names Clearance, Heterogeneity and the index, but its formulas are not published yet. These are stand-ins, and so are the profiles.</p>`,
    people: `<h2 data-at="0.6">${P.mdiN ? `${fmt(P.mdiN)} people, one index` : 'People on one index'}</h2>
      <p data-at="1.2">Every scan becomes one point.${P.groups.length ? ` In the poster's results: ${listOf(P.groups.map(g => `${esc(g.name.toLowerCase())} (${g.n})`))}.` : ''}</p>
      <p data-at="9">On the index, cancer sits low and dyslipidaemia high, with healthy people in between.</p>
      ${P.groups.length ? `<div class="facts">${P.groups.map((g, j) => `<div data-at="${14 + 2.5 * j}"><b style="color:${g.col}">${g.centre}</b><small>${esc(g.name)}</small></div>`).join('')}</div>` : ''}
      ${thirds.length ? `<p data-at="28" class="amber">Split by the index into thirds, people with cancer${thirds.length === 3 ? ' near the healthy range lived longest' : ''}: median survival ${listOf(thirds.map(g => `${med(g)} (${esc(g.name)})`))}${thirds.every(g => g.y1 !== null) ? `; after one year ${listOf(thirds.map(g => g.y1 + '%'))} were alive` : ''}.</p>` : '<p data-at="28" class="amber">Split by the index into thirds, people with cancer near the healthy range lived longest.</p>'}
      <p data-at="36">${P.respN ? `In ${P.respN}` : 'In a small group of'} people with lung cancer given immunotherapy before surgery, the index told good from poor responders better than CRP, tumour stage or age${P.bestNet && P.bestClin ? ` (AUC ${P.bestNet.auc} against ${P.bestClin.auc} at best)` : ''}. A first test, in few people.</p>
      <p data-at="42">After ${bar ? 'bariatric surgery' : 'surgery'} and immunotherapy, the index moved towards the healthy range${P.follow.length ? `: ${P.followN} follow-up scans` : ''}.</p>
      <p class="credits" data-at="45">The poster's results, as group summaries. The dots are stand-ins drawn to match them, not patients.</p>`,
    vision: `<h2 data-at="0.6">One scan, one system</h2>
      <p data-at="1.2">One routine scan could show how a whole body is doing: what lies ahead, and which medication might help.</p>
      <p data-at="7">Organs like muscle and fat could become targets: the paper names GLP-1 drugs, metformin, statins and SGLT2 inhibitors.</p>
      <p data-at="12" class="amber">A measure of health, not only of disease. It still has to be tested in larger studies.</p>
      <p data-at="15">Barbara K Geist, Alexander Grentner, Joel Fischer, Josef Yu, Dato Tsomaia, Adna Smajlovic, Stefan Grünert and Marcus Hacker: Division of Nuclear Medicine, Medical University of Vienna, and the LBI for Network Medicine.</p>
      <p data-at="18"><button class="btn primary" id="btnGoExplore" type="button">Explore the networks</button></p>
      <p class="credits" data-at="20">Geist et al., The metabolic organ connectome, Med${F.year ? ` (${F.year})` : ''}; poster: Shaping a New Era in Nuclear Medicine. Networks of all ${fmt(F.scans)} scans: printed in the paper; other networks read off its figures. One-scan maths, organ values and the population dots: illustrative stand-ins.</p>`,
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
  // (body and organs share one frame, so their waypoints turn them together)
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k)]);
  };
  start({ scan_vision: 1, scan_bed: 0, scan_cut: 0, scan_events: 0, scan_lines: 0, scan_image: 0,
    body_pet: 0, body_net: 0, body_state: 0, body_blank: 0,
    organs_seg: 0, organs_suv: 0, organs_focus: 0, organs_lesion: 0, organs_rows: 0, organs_pair: 0, organs_partial: 0, organs_net: 0, organs_which: 0, organs_strength: 0,
    people_bars: 0, people_ratio: 0, people_thresh: 0, people_one: 0, people_metrics: 0, people_profile: 0, people_custom: 0, people_map: 0, people_mdi: 0,
    people_group: 0, people_km: 0, people_response: 0, people_follow: 0 });
  let a, b;
  // Intro: the vision row (scanner, body, network, prognosis, medication), then it draws back into the scanner
  a = C.title.a; b = C.title.b;
  show('scan', 0.2, 2.5, C.body.a + 0.3, C.body.a + 2.3);
  ramp('scan_vision', a + 10, a + 15, 1, 0);
  cam(a, 'scan', 'vision', -8, null, [0, 0, 0.8]);
  cam(a + 9.5, 'scan', 'vision', 4, 'spin');
  cam(b - 0.5, 'scan', 'default', -12);
  // Seeing sugar: the couch slides in, the skin opens on the ring, events, lines of response, then the image
  a = C.scanner.a; b = C.scanner.b;
  ramp('scan_bed', a + 1, a + 7, 0, 1);
  ramp('scan_cut', a + 9, a + 12, 0, 1);
  ramp('scan_events', a + 12, a + 13.5, 0, 0.3); ramp('scan_events', a + 21, a + 24, 0.3, 1);
  ramp('scan_lines', a + 16, a + 27, 0, 1);
  ramp('scan_image', a + 27, a + 33, 0, 1);
  ramp('scan_events', a + 30, a + 34, 1, 0.4);
  cam(a + 1, 'scan', 'default', -4);
  cam(a + 8, 'scan', 'default', 10, 'spin');
  cam(a + 11.5, 'scan', 'ring');
  cam(a + 20, 'scan', 'ring', 14, 'spin');
  cam(a + 24, 'scan', 'front');
  cam(a + 28, 'scan', 'side');
  cam(b - 0.5, 'scan', 'side', 14, 'spin');
  // Where the sugar goes: the standing body, the tracer arriving, the hot organs, then a tumour
  a = C.body.a; b = C.body.b;
  show('body', a + 0.3, a + 2.3);
  ramp('body_a', C.one.a, C.one.a + 2, 0.55, 0);   // (dimmed under the organs from their chapter on)
  ramp('body_pet', a + 1.5, a + 10, 0, 1);
  show('organs', a + 18, a + 20, C.one.a, C.one.a + 2);
  ramp('organs_lesion', a + 19, a + 21, 0, 1);
  cam(a + 0.5, 'body', 'front', -12, null, [0, 0, 0.4]);
  cam(a + 9.5, 'body', 'front', 6, 'spin');
  cam(a + 12, 'body', 'front', 10, null, [0, 0, -1.1, 0, 0.3, 0]);
  cam(a + 18, 'body', 'front', 18, 'spin', [0, 0, -1.1, 0, 0.3, 0]);
  cam(a + 21, 'organs', 'lesion');
  cam(a + 28, 'organs', 'lesion', 10, 'spin');
  cam(b - 1, 'organs', 'default', -6);
  ramp('organs_lesion', b - 3, b, 1, 0);
  // Every organ, measured: the AI's outlines, slice by slice; each organ's uptake as a bar; three organs in turn
  a = C.organs.a; b = C.organs.b;
  ramp('body_a', a + 1, a + 4, 1, 0.55);
  ramp('organs_seg', a + 1, a + 12, 0, 1);
  ramp('organs_suv', a + 15, a + 21, 0, 1);
  [['brain', 23], ['liver', 27], ['muscle', 31]].reduce((f0, [id, t]) => { jump('organs_focus', a + t, f0, oi(id)); return oi(id); }, 0);
  jump('organs_focus', a + 35, oi('muscle'), 0);
  cam(a + 1, 'organs', 'seg');
  cam(a + 12, 'organs', 'seg', 12, 'spin');
  cam(a + 15, 'organs', 'bars');
  cam(a + 22, 'organs', 'bars', 6, 'spin');
  cam(b - 0.5, 'organs', 'bars', -6, 'spin');
  // 658 scans: one row, then all of them; the partial correlation of two organs; the network of all scans
  a = C.cohort.a; b = C.cohort.b;
  key('organs_rows', a + 1, 0); key('organs_rows', a + 5, 0.35); key('organs_rows', a + 7, 0.35); key('organs_rows', a + 12, 1);
  if (F.pair) { jump('organs_pair', a + 15, 0, 1); ramp('organs_partial', a + 23, a + 29, 0, 1); jump('organs_pair', a + 33, 1, 0); }
  ramp('organs_net', a + 32, a + 41, 0, 1);
  ramp('organs_rows', a + 31, a + 34, 1, 0); ramp('organs_suv', a + 31, a + 34, 1, 0);
  cam(a + 1, 'organs', 'matrix');
  cam(a + 13, 'organs', 'matrix', 10, 'spin');
  if (F.pair) { cam(a + 16, 'organs', 'scatter'); cam(a + 30, 'organs', 'scatter', 4, 'spin'); }
  cam(a + 34, 'organs', 'net');
  cam(b - 0.5, 'organs', 'net', 18, 'spin');
  // From health to disease: BMI, the strength distribution, CRP thirds; robust; hexokinase 2 like FDG
  a = C.health.a; b = C.health.b;
  // the networks in turn, each from the one before (a network not read off its figure yet is skipped)
  let w = wi('full');
  const goNet = (id, t) => { if (!hasNet(id)) return; ramp('organs_which', t, t + 2, w, wi(id)); w = wi(id); };
  goNet('A_low', a + 7); goNet('A_high', a + 12);
  ramp('organs_strength', a + 16, a + 19, 0, 1);
  goNet('C_low', a + 21); goNet('C_mid', a + 25); goNet('C_high', a + 29);
  goNet('FDG_healthy', a + 38); goNet('HK2', a + 41);
  cam(a + 1, 'organs', 'net', 18);
  cam(a + 14, 'organs', 'net', 34, 'spin');
  cam(a + 17, 'organs', 'strength');
  cam(a + 34, 'organs', 'strength', 10, 'spin');
  cam(a + 37, 'organs', 'net', 20);
  cam(b - 0.5, 'organs', 'net', 34, 'spin');
  // One scan, one network: bars, ratios, the threshold, the network, the two measures, three profiles in turn
  a = C.one.a; b = C.one.b;
  show('people', a + 0.5, a + 2.5, C.vision.a, C.vision.a + 2);
  ramp('people_bars', a + 2, a + 5, 0, 1);
  ramp('people_ratio', a + 7, a + 11, 0, 1);
  ramp('people_thresh', a + 12, a + 15, 0, 1);
  ramp('people_one', a + 17, a + 22, 0, 1);
  ramp('people_metrics', a + 24, a + 28, 0, 1);
  key('people_profile', a + 31, 0); key('people_profile', a + 33, 1); key('people_profile', a + 35, 1); key('people_profile', a + 38, 3);
  cam(a + 1, 'people', 'one', -14);
  cam(a + 7, 'people', 'field');
  cam(a + 15, 'people', 'field', 12, 'spin');
  cam(a + 18, 'people', 'one');
  cam(a + 24, 'people', 'metrics');
  cam(b - 0.5, 'people', 'metrics', 8, 'spin');
  // People: the population by its two measures, the index strip, the groups in turn, survival, immunotherapy, follow-up
  a = C.people.a; b = C.people.b;
  ramp('people_map', a + 1, a + 6, 0, 1);
  for (const n of ['people_bars', 'people_ratio', 'people_thresh', 'people_one', 'people_metrics']) ramp(n, a + 2, a + 6, 1, 0);
  ramp('people_mdi', a + 9, a + 14, 0, 1);
  // each group glows in turn as its number appears in the panel
  P.groups.slice(0, 4).reduce((g0, g, j) => { jump('people_group', a + 14 + 2.5 * j, g0, j + 1); return j + 1; }, 0);
  if (P.groups.length) jump('people_group', a + 25, Math.min(4, P.groups.length), 0);
  ramp('people_km', a + 28, a + 32, 0, 1);
  ramp('people_km', a + 35, a + 37, 1, 0);
  ramp('people_response', a + 36, a + 40, 0, 1);
  ramp('people_response', a + 41, a + 43, 1, 0);
  ramp('people_follow', a + 42, a + 46, 0, 1);
  cam(a + 2, 'people', 'map');
  cam(a + 8, 'people', 'map', 8, 'spin');
  cam(a + 10.5, 'people', 'strip');
  cam(a + 26, 'people', 'strip', 5, 'spin');
  cam(a + 29, 'people', 'km');
  cam(a + 35, 'people', 'km', 4, 'spin');
  cam(a + 37, 'people', 'auc');
  cam(a + 41, 'people', 'auc', 4, 'spin');
  cam(a + 43, 'people', 'strip');
  cam(b - 0.5, 'people', 'strip', 6, 'spin');
  // One scan, one system: the vision row again
  a = C.vision.a; b = C.vision.b;
  show('scan', a + 0.5, a + 2.5);
  // (the scanner comes back as it was at the start: couch out, closed, no events)
  for (const n of ['scan_bed', 'scan_cut', 'scan_lines', 'scan_image']) jump(n, a, 1, 0);
  jump('scan_events', a, 0.4, 0);
  ramp('scan_vision', a + 1, a + 9, 0, 1);
  cam(a + 1.5, 'scan', 'vision', -10, null, [0, 0, 0.8]);
  cam(b, 'scan', 'vision', 6, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say; the body set labels its
  // organs only with its own network, so its anchors are passed as points)
  const at = (k, n) => () => anchorOf(k, n);
  a = C.body.a;
  label('body', at('body', 'brain'), '<b>Brain</b>the most sugar', a + 11, a + 18, 'amb');
  label('body', at('body', 'heart'), '<b>Heart</b>', a + 12, a + 18, 'amb');
  label('body', at('body', 'kidneys'), '<b>Kidneys</b>into the urine', a + 13.5, a + 18, 'amb');
  label('body', at('body', 'bladder'), '<b>Bladder</b>', a + 14.5, a + 18, 'amb');
  label('organs', 'lesion', '<b>A tumour</b>a hot spot', a + 21, a + 30, 'amb');
  a = C.health.a;
  if (hubName && hasNet('C_high')) label('organs', 'hub', `<b>${esc(hubName)}</b>${hub3.length > 1 ? 'hubs' : 'a hub'} at high CRP`, a + 31, a + 36, 'amb');
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
// (body and organs share the organs' turn: one frame)
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
// Explore mode: the paper's comparisons and networks, its organs, the poster's one-scan network with your own uptakes
// and the people on its index; or any scene with its own controls.
const SCENES = [
  ['scan', 'Scanner', 'A PET/CT scanner, cut open: the ring of detectors, the events (a positron, two gamma photons, a line of response) and the image they build. Life size stands it in front of you.'],
  ['body', 'Body', 'A whole-body PET scan: the tracer arriving with the blood, settling where cells use sugar and leaving in the urine (the PET body of the tour).'],
  ['organs', 'Organs', `The paper's organs in the scan: their outlines, their uptakes, the matrix of ${fmt(FACTS.scans)} scans, a partial correlation, the networks and how their strength is spread.`],
  ['people', 'One scan and people', 'The poster\'s next step: one network per scan, its two measures and the index; then the people on it, survival and the immunotherapy test. Illustrative maths; the dots are stand-ins.'],
  ['liver', 'Liver', 'An organ is a network too: an illustrative liver in a few thousand patches, linked where their uptakes differ by more than a threshold; the best connected glow.'],
];
const TABS = [['networks', 'Networks'], ['organs', 'Organs'], ['one', 'One scan'], ['people', 'People'], ['scenes', 'Scenes']];
// the tour's body set: its network and its disease scan are the tour's illustration, so this story leaves them out
const HIDE_CTL = { body: ['view', 'state'] };
const ctlsOf = k => (GL.sets[k].controls || []).filter(c => !(HIDE_CTL[k] || []).includes(c.key));
const S1 = PET_DATA.single, ONE_N = S1.organs.length;
const X = { tab: 'networks', scene: 'organs', ctl: {}, t0: 0, turn: 'on', cmp: -1, net: 'full', organ: null, profile: 'healthy', u: null, theta: S1.theta, group: 0, life: false };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['organs_focus', 'organs_pair', 'people_group']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a control's option whose key or name matches re (the sets name their own options)
const optKey = (k, key, re) => { const c = ctlOf(k, key), o = c && c.options.find(([v, n]) => re.test(v) || re.test(n)); return o ? o[0] : null; };
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
// a view option's camera: the cam view of the same name, or the one its name stands for
const CAM_ALIAS = { organs: { organs: 'default', uptake: 'bars', partial: 'scatter', network: 'net' }, scan: { scanner: 'default' },
  people: { 'one scan': 'one', ratios: 'field', people: 'map', index: 'strip', survival: 'km', immunotherapy: 'auc' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {}, vc = ctlOf(k, 'view'), o = vc && vc.options.find(x => x[0] === v), n = o ? String(o[1]).toLowerCase() : '';
  for (const x of [v, al[v], n, al[n]]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the organs set's Network control and the people set's Profile control (found by key, or by their number of options)
const netCtl = () => ctlOf('organs', 'net') || ctlOf('organs', 'network') || ctlOf('organs', 'which') || ctlsOf('organs').find(c => c.key !== 'view' && c.options.length === NET_IDS.length) || null;
const profCtl = () => ctlOf('people', 'profile') || ctlsOf('people').find(c => c.key !== 'view' && c.options.length === PROFILES.length) || null;
// option <-> network id, option <-> profile key: by value when the set uses the ids, else by position
const netOfOpt = (c, v) => (NET_IDS.includes(v) ? v : NET_IDS[c.options.findIndex(o => o[0] === v)] || null);
const optOfNet = (c, id) => c.options.find(o => o[0] === id) || c.options[NET_IDS.indexOf(id)] || null;
const profOfOpt = (c, v) => (PROFILES.some(p => p[0] === v) ? v : (PROFILES[c.options.findIndex(o => o[0] === v)] || PROFILES[0])[0]);
const optOfProf = (c, p) => c.options.find(o => o[0] === p) || c.options[PROFILES.findIndex(x => x[0] === p)] || null;
// the network and the profile on show: the controls hold them (so the Scenes tab and the panes agree)
const curNet = () => { const c = netCtl(); return c ? netOfOpt(c, ctlValue('organs', c)) : X.net; };
const curProfile = () => { const c = profCtl(); return c ? profOfOpt(c, ctlValue('people', c)) : X.profile; };
// the people set's views: the one-scan network (and its ratios) or the population
const viewIs = (k, re) => { const c = ctlOf(k, 'view'); if (!c) return false; const v = ctlValue(k, c), o = c.options.find(x => x[0] === v); return re.test(v) || (o && re.test(o[1])); };
const oneView = () => viewIs('people', /one|ratio|field/i);
const netView = () => viewIs('organs', /net|strength/i);
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
const afterUpdate = f => { NEXT.push(f); };
const round2 = v => Math.round(v * 100) / 100;
const profU = p => { const q = S1.profiles[p] || S1.profiles.healthy; return q.u.slice(); };
const curU = () => X.u || profU(curProfile());

// the one-scan network's maths (the people set's own when it has it; the same stand-in formulas otherwise):
// link i -> j = sigmoid((ln(u_i / u_j) - ln theta) / soft); Clearance = mean of the kidneys' outgoing links;
// Heterogeneity = Gini coefficient of the strengths; index = m + a C + b H, between 0 and 10
function measureOne(u, theta) {
  const A = setApi('people');
  if (A && A.measure) { try { const r = A.measure(u, theta); if (r && Number.isFinite(r.C) && Number.isFinite(r.H)) return r; } catch (e) { /* the engine's own copy below */ } }
  const N = u.length, lt = Math.log(theta), e = u.map(() => new Array(N).fill(0)), s = new Array(N).fill(0);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) { e[i][j] = 1 / (1 + Math.exp(-(Math.log(u[i] / u[j]) - lt) / S1.soft)); s[i] += e[i][j]; s[j] += e[i][j]; }
  const k = S1.organs.indexOf('kidneys'), C = k < 0 ? 0 : e[k].reduce((a, v, j) => a + (j === k ? 0 : v), 0) / (N - 1);
  const m = s.reduce((a, v) => a + v, 0) / N;
  let g = 0;
  for (const a of s) for (const b of s) g += Math.abs(a - b);
  const H = m > 0 ? g / (2 * N * N * m) : 0;
  return { e, s, C, H, mdi: clamp(S1.proj.m + S1.proj.a * C + S1.proj.b * H, 0, 10) };
}
const linksOf = r => r.e.reduce((a, row) => a + row.filter(v => v > 0.5).length, 0);

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  // the organs lie in the PET body: wherever they show, the body shows too, its tracer settled
  if (k === 'organs') Object.assign(tg, GL.sets.body.params, { body_a: 1, body_pet: 1 });
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  tg.body_net = 0; tg.body_state = 0;   // never the tour's own network or disease scan
  if (k === 'organs') {
    const w = NET_IDS.indexOf(curNet());
    if (w >= 0) tg.organs_which = w;
    tg.organs_focus = X.organ && PD.byId[X.organ] ? PD.byId[X.organ].i + 1 : 0;
    // the body dims under the network, the matrix and the scatter plot
    if ((tg.organs_net || 0) > 0.5 || (tg.organs_rows || 0) > 0.5 || (tg.organs_pair || 0) > 0.5) tg.body_a = 0.55;
  }
  if (k === 'people') {
    const p = curProfile(), u = curU();
    tg.people_profile = Math.max(0, PROFILES.findIndex(x => x[0] === p));
    tg.people_custom = X.u ? 1 : 0;
    for (let i = 0; i < ONE_N; i++) tg['people_u' + i] = u[i];
    tg.people_theta = X.theta;
    tg.people_group = X.group;
  }
  // life size: the scanner at work, the couch in, no vision row
  if (k === 'scan' && X.life) Object.assign(tg, { scan_vision: 0, scan_bed: 1, scan_events: Math.max(tg.scan_events || 0, 0.7), scan_lines: Math.max(tg.scan_lines || 0, 0.6) });
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it, standing by the scanner life size, or a set asks for stillness
  if (X.turn === 'on' && !(X.life && X.scene === 'scan') && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets); here only the labels follow
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) flyTo(view(k, X.life && k === 'scan' ? 'life' : viewCam(k) || 'default'));
  renderScenes();
  updateExtraLabels();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  if (c === profCtl()) X.u = null;   // a profile picked: its own uptakes
  // a view has its own best camera
  if (key === 'view' && k === X.scene && !(X.life && k === 'scan')) { const n = camFor(k, v); flyTo(view(k, n || 'default')); }
  renderAll();
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
// fly to a point of the scene on show, keeping the direction you look from
function flyNear(p, d) { if (p && !(X.life && X.scene === 'scan')) flyTo([orbit.cur[0], orbit.cur[1], d, p[0], p[1], p[2]]); }

// --------------------------------------------------------------- actions --
// Each setter changes its own field only when called with ui false (a shared room's state arriving); picked by
// hand (ui true) it also brings up the scene and the view that show it.
// a comparison of Table 2 (-1 none): its first network, when the paper drew one
function selectCmp(i, ui = true) {
  X.cmp = i;
  if (ui && i >= 0) { const id = rowNets(PD.D.table2[i]).find(n => n && NET_IDS.includes(n)); if (id) showNet(id); }
  renderNets();
}
// the network on show in the organs set
function setNet(id) {
  if (!NET_IDS.includes(id)) return;
  const c = netCtl();
  if (c) { const o = optOfNet(c, id); if (o) (X.ctl.organs = X.ctl.organs || {})[c.key] = o[0]; } else X.net = id;
  X.t0 = performance.now();
  renderNets(); renderOrgans(); renderScenes();
}
function showNet(id) {
  setNet(id);
  if (X.scene !== 'organs') openScene('organs');
  if (!netView()) { const v = optKey('organs', 'view', /strength/i) || optKey('organs', 'view', /net/i); if (v) setCtl('organs', 'view', v); }
}
// an organ (null none): it glows in the organs set, its bar and links brighter
function selectOrgan(id, ui = true) {
  X.organ = id && PD.byId[id] ? id : null;
  if (ui && X.organ && X.scene !== 'organs') openScene('organs');
  if (ui && X.organ && X.scene === 'organs' && !viewIs('organs', /net|strength|matrix|partial|scatter/i)) afterUpdate(() => { if (X.organ === id) flyNear(anchorOf('organs', id), Math.min(orbit.cur[2], 2.6)); });
  pushState(); renderOrgans(); renderNets();
}
// a profile of the one-scan network (its uptakes; custom ones are dropped)
function selectProfile(p, ui = true) {
  if (!PROFILES.some(x => x[0] === p)) return;
  const c = profCtl();
  if (c) { const o = optOfProf(c, p); if (o) (X.ctl.people = X.ctl.people || {})[c.key] = o[0]; } else X.profile = p;
  X.u = null;
  if (ui) showOne();
  renderOne(); renderScenes();
}
function showOne() {
  if (X.scene !== 'people') openScene('people');
  if (!oneView()) { const v = optKey('people', 'view', /one/i); if (v) setCtl('people', 'view', v); }
}
// the seven uptakes (null: the profile's own); one moved by hand makes them custom
function setUs(u) { X.u = u ? u.map(v => round2(clamp(+v, 0.1, 5))) : null; syncOne(); }
function setU(i, v) { const u = curU(); u[i] = v; setUs(u); }
function setTheta(v) { X.theta = round2(clamp(+v, 1.1, 3)); syncOne(); }
// a group of the poster's population (0 none, 1..4): it glows, the others dim
function selectGroup(g, ui = true) {
  X.group = clamp(g | 0, 0, 4);
  if (ui && X.group) { if (X.scene !== 'people') openScene('people'); if (oneView()) { const v = optKey('people', 'view', /index|strip/i) || optKey('people', 'view', /people|map/i); if (v) setCtl('people', 'view', v); } }
  renderPeople();
}
// a view of the people set (People, Index, Survival, Immunotherapy)
function showPeople(re) { if (X.scene !== 'people') openScene('people'); const v = optKey('people', 'view', re); if (v) setCtl('people', 'view', v); }
// Life size: on screen the scanner from a couple of metres at eye height; in the headset life size on your floor
function setLife(on) {
  X.life = on;
  if (XR.on) xrRoom(on);
  if (on && X.scene !== 'scan') openScene('scan', false);
  if (X.scene === 'scan') flyTo(view('scan', on ? 'life' : viewCam('scan') || 'default'));
  document.querySelectorAll('[data-ctl="life"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === (on ? 'on' : 'off'))));
  renderScenes();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls (they hold the
// network and the profile on show), the comparison, the organ, the custom uptakes, the threshold and the group.
// Turning and standing by the scanner life size are each person's own view.
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
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  return { tab: X.tab, scene: X.scene, ctl, cmp: X.cmp, net: curNet(), organ: X.organ, profile: curProfile(), u: X.u ? X.u.slice() : null, theta: X.theta, group: X.group };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n < hi;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if ((v.cmp === -1 || int(v.cmp, 0, PD.D.table2.length)) && v.cmp !== X.cmp) selectCmp(v.cmp, false);
  if ((v.organ === null || (typeof v.organ === 'string' && PD.byId[v.organ])) && v.organ !== X.organ) selectOrgan(v.organ, false);
  if (Number.isFinite(v.theta) && v.theta !== X.theta) setTheta(v.theta);
  if (int(v.group, 0, 5) && v.group !== X.group) selectGroup(v.group, false);
  // the scene and its controls; a view flies to its own camera as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  // then the network and the profile (also held by controls: should the two ever disagree, these win) and the custom
  // uptakes (a profile arriving drops them, as it does here: the room's own come back after it)
  if (NET_IDS.includes(v.net) && v.net !== curNet()) setNet(v.net);
  if (PROFILES.some(p => p[0] === v.profile) && v.profile !== curProfile()) selectProfile(v.profile, false);
  if ((v.u === null || (Array.isArray(v.u) && v.u.length === ONE_N && v.u.every(Number.isFinite))) && JSON.stringify(v.u) !== JSON.stringify(X.u)) setUs(v.u);
  renderAll();
}

// ------------------------------------------------------------------ panes --
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:#04131c"' : ''}>${col ? `<span class="sw" style="background:${col}"></span>` : ''}${label}</button>`;
// the organ icons (PET_ICONS) as small pictures for the HTML panes, in the organ's colour
const ICON = {};
function iconUrl(id) {
  if (ICON[id] === undefined) {
    try {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 48;
      PET_ICONS.draw(cv.getContext('2d'), id, 24, 24, 44, { color: organCol(id), width: 2.6 });
      ICON[id] = cv.toDataURL();
    } catch (e) { ICON[id] = ''; }
  }
  return ICON[id];
}
const iconImg = (id, px) => (iconUrl(id) ? `<img src="${iconUrl(id)}" alt="" width="${px || 18}" height="${px || 18}" style="vertical-align:-4px;margin-right:5px">` : '');
// a network in words: organs, links, density and disorder (as printed), hubs (printed, or computed from its links)
function netInfo(id) {
  const n = netOf(id), e = edgesOf(id), h = hubsOf(id).filter(x => x !== 'aorta');
  if (!n) return { ok: false, text: 'This network is not in the data yet.' };
  const d = Number.isFinite(+n.density) ? `density ${pct(n.density)}` : '', o = Number.isFinite(+n.disorder) ? `disorder ${dis(n.disorder)}` : '';
  return { ok: e.length > 0, n, e, hubs: h,
    text: e.length ? `${(n.organs || []).length} organs, ${e.length} links${d || o ? `; ${[d, o].filter(Boolean).join(', ')} as printed` : ''}.` : 'Its links are not read off the figure yet: only its organs show.',
    hubText: e.length ? (h.length ? `Hubs: ${listOf(h.map(organLow))}${hubsPrinted(id) ? ' (marked in the paper)' : ` (computed: strength z-score above ${FACTS.hubZ})`}.` : 'No hub: the strength is spread evenly.') : '' };
}
// a network's strength per organ, sorted from high to low (as printed in the data, else summed from its links)
function strengths(id) {
  const n = netOf(id);
  if (!n) return [];
  let s = n.computed && n.computed.strength;
  if (!s) { s = {}; for (const [a, b, w] of edgesOf(id)) { s[a] = (s[a] || 0) + Math.abs(w); s[b] = (s[b] || 0) + Math.abs(w); } }
  return Object.entries(s).filter(([k]) => PD.byId[k]).sort((a, b) => b[1] - a[1]);
}
const sigWord = (sig, p) => `${esc(p)}${sig ? ' (significant)' : ' (no significant difference)'}`;
const rowName = r => `${r.what} · ${r.cohort.replace(/, split at the median.*$/, '').replace(/^full cohort$/, 'all scans')}`;
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    <div class="pane" id="pane-networks" role="tabpanel"></div>
    <div class="pane" id="pane-organs" role="tabpanel"></div>
    <div class="pane" id="pane-one" role="tabpanel"></div>
    <div class="pane" id="pane-people" role="tabpanel"></div>
    <div class="pane" id="pane-scenes" role="tabpanel"></div>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v, n = v !== undefined && v !== '' && !isNaN(+v) ? +v : v;
    ({
      cmp: () => selectCmp(n === X.cmp ? -1 : n), net: () => showNet(v), organ: () => selectOrgan(v === X.organ ? null : v),
      profile: () => selectProfile(v), group: () => selectGroup(n === X.group ? 0 : n), pview: () => showPeople(new RegExp('^' + v + '$', 'i')),
      one: showOne, scene: () => openScene(v), ctl: () => setCtl(b.dataset.scene || X.scene, b.dataset.ctl, v), life: () => setLife(!X.life),
    }[b.dataset.act] || (() => {}))();
  });
  // the sliders of the one-scan network: values change in place, so a drag is not cut short by a redraw
  $('#explore').addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.u !== undefined) { setU(+el.dataset.u, +el.value); if (X.scene !== 'people' || !oneView()) showOne(); }
    else if (el.id === 'theta') { setTheta(+el.value); if (X.scene !== 'people' || !oneView()) showOne(); }
  });
  renderAll();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>
    <div class="grp"><span>Life size</span><div class="seg" data-ctl="life" role="group" aria-label="The scanner life size">${[['off', 'Off'], ['on', 'On']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${(X.life ? 'on' : 'off') === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (!seg) return;
    if (seg.dataset.ctl === 'turn') setTurn(b.dataset.v); else setLife(b.dataset.v === 'on');
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
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  updateExtraLabels();
}
function renderAll() { renderNets(); renderOrgans(); renderOne(); renderPeople(); renderScenes(); }
function renderNets() {
  const pane = $('#pane-networks');
  if (!pane) return;
  const T = PD.D.table2, r = T[X.cmp], id = curNet(), ni = netInfo(id);
  const rows = part => T.map((x, i) => [x, i]).filter(([x]) => x.part === part).map(([x, i]) => chip(`data-act="cmp" data-v="${i}"`, esc(rowName(x)), X.cmp === i, x.sigD || x.sigO ? '#ffb43b' : null)).join('');
  let h = `<p class="sub">The paper compared the networks of groups of scans (Table 2; amber: a significant difference). Pick a comparison.</p>
    <p class="grp-h">From health to disease</p><div class="chips">${rows('health')}</div>
    <p class="grp-h">Is it robust?</p><div class="chips">${rows('test')}</div>`;
  if (r) {
    const nets = rowNets(r);
    h += `<h3>${esc(r.what)}</h3><p class="sub">${esc(r.cohort)}</p>
      <dl class="stats">${r.groups.map((g, i) => `<dt>${esc(g.label)}</dt><dd>${pct(g.density)}<small>density · disorder ${dis(g.disorder)} · ${g.n} scans${nets[i] && NET_IDS.includes(nets[i]) ? ` · <a href="#" data-act="net" data-v="${nets[i]}">show its network</a>` : ''}</small></dd>`).join('')}</dl>
      <p class="sub">Density: ${sigWord(r.sigD, r.pD)}. Disorder: ${sigWord(r.sigO, r.pO)}.</p>`;
  }
  h += `<p class="grp-h">Networks drawn in the paper</p><div class="chips">${NET_IDS.map((n, i) => chip(`data-act="net" data-v="${n}"`, esc(NET_SHORT[i]) + (hasNet(n) ? '' : ' <small>(not read yet)</small>'), n === id && X.scene === 'organs')).join('')}</div>
    <h3 style="font-size:20px">${esc(netShort(id))}</h3><p class="sub">${esc((netOf(id) || {}).title || '')}. ${esc(ni.text)} ${esc(ni.hubText || '')}</p>`;
  const st = strengths(id);
  if (ni.ok && st.length) {
    const mx = st[0][1] || 1;
    h += `<p class="grp-h">Strength of each organ: the sum of its links' weights</p><div class="bars">${st.map(([o, v]) => `<div class="bar${(ni.hubs || []).includes(o) ? ' hl' : ''}"><span class="v">${v.toFixed(1)}</span><div class="fill" style="height:${(100 * v / mx).toFixed(0)}%;background:${organCol(o)}"></div><span class="k">${esc(PD.byId[o].short.slice(0, 5))}</span></div>`).join('')}</div>`;
  }
  h += `<p class="grp-h">Protein networks (Table 3: tissues of ${fmt(FACTS.gtex)} people)</p>
    <dl class="stats">${PD.D.table3.filter(x => x.kind !== 'fdg').map(x => `<dt>${esc(x.name.replace(/ \(.*\)$/, ''))}</dt><dd>${pct(x.density)}<small>${x.r !== null ? `r = ${x.r} with FDG's · ` : ''}${esc(x.similar)}</small></dd>`).join('')}</dl>
    <div class="chips">${PD.D.table3.filter(PROT_NET).map(x => chip(`data-act="net" data-v="${PROT_NET(x)}"`, `${esc(netShort(PROT_NET(x)))} network`, PROT_NET(x) === id && X.scene === 'organs')).join('')}</div>`;
  pane.innerHTML = h;
}
function renderOrgans() {
  const pane = $('#pane-organs');
  if (!pane) return;
  const id = X.organ, O = PD.byId[id];
  let h = `<p class="sub">The ${FACTS.organs} organs of the paper and the aorta, the reference every organ is divided by. Pick one.</p>
    <div class="chips">${PD.D.organs.map(o => chip(`data-act="organ" data-v="${o.id}"`, iconImg(o.id) + esc(o.name), id === o.id)).join('')}</div>`;
  if (O) {
    const inF2 = PD.D.f2.organs.includes(id), e = edgesOf('full').filter(x => x[0] === id || x[1] === id).sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
    const hubIn = NET_IDS.filter(n => hasNet(n) && hubsOf(n).includes(id));
    h += `<h3>${iconImg(id, 26)}${esc(O.name)}</h3>
      <dl class="stats"><dt>Measured</dt><dd style="font-size:15px">${esc(O.measure)}</dd>
      <dt>Typical uptake</dt><dd>${id === 'aorta' ? '1' : O.suv}<small>${id === 'aorta' ? 'the unit' : 'times the aorta\'s'} (illustrative)</small></dd>
      ${inF2 && strengths('full').length ? `<dt>Strength</dt><dd>${(strengths('full').find(s => s[0] === id) || [0, 0])[1].toFixed(2)}<small>in the network of all ${fmt(FACTS.scans)} scans</small></dd>` : ''}
      <dt>Hub in</dt><dd style="font-size:15px">${hubIn.length ? esc(listOf(hubIn.map(netShort))) : 'no network drawn so far'}</dd></dl>`;
    h += inF2 ? `<p class="grp-h">Its links in the network of all ${fmt(FACTS.scans)} scans (Figure 2A; blue together, red opposite)</p>
      <div class="chips">${e.length ? e.map(x => { const o = x[0] === id ? x[1] : x[0]; return `<button type="button" data-act="organ" data-v="${o}">${iconImg(o)}${esc(organName(o))} <b style="color:${x[2] > 0 ? '#4c7cff' : '#ff4d4d'}">${x[2] > 0 ? '+' : '−'}${Math.abs(x[2]).toFixed(2)}</b></button>`; }).join('') : '<span class="empty">none</span>'}</div>`
      : `<p class="sub">${id === 'aorta' ? 'Not a node: the blood pool every organ is divided by.' : `Not in the network of all scans (Figure 2A has ${FACTS.f2n} organs); it appears in the networks of Figure 3.`}</p>`;
  } else h += `<p class="empty">Colours and icons are the same in every scene. Point at an organ in the scan, a bar or a node to pick it there.</p>`;
  pane.innerHTML = h;
}
// the one-scan pane: built once per profile or custom change of structure; values change in place (syncOne)
function renderOne() {
  const pane = $('#pane-one');
  if (!pane) return;
  const u = curU(), p = curProfile();
  pane.innerHTML = `<p class="sub">The poster's next step: one network per scan, from ${word(ONE_N)} organs' uptakes (mean SUV). Pick a profile, or move the uptakes yourself.</p>
    <div class="chips" id="oneProf">${PROFILES.map(([k, n]) => chip(`data-act="profile" data-v="${k}"`, esc(n), !X.u && p === k, GROUP_COL[k])).join('')}${X.u ? chip('data-act="one"', 'Custom', true) : ''}</div>
    ${S1.organs.map((o, i) => `<p class="grp-h">${iconImg(o, 16)}${esc(organName(o))} <b data-uv="${i}" style="margin-left:auto;color:var(--ink)">${u[i].toFixed(2)}</b></p><input type="range" data-u="${i}" min="0.1" max="5" step="0.05" value="${u[i]}" aria-label="Uptake of the ${esc(organLow(o))}">`).join('')}
    <p class="grp-h">Threshold: one organ outshines another by <b id="thv" style="margin-left:auto;color:var(--ink)">${X.theta.toFixed(2)}</b></p><input type="range" id="theta" min="1.1" max="3" step="0.05" value="${X.theta}" aria-label="Threshold">
    <dl class="stats" id="oneOut" style="margin-top:14px"></dl>
    <p class="note">${esc(S1.note)} The profiles are illustrative too.</p>`;
  syncOne(true);
}
function syncOne(fresh) {
  const pane = $('#pane-one');
  if (!pane || !$('#oneOut')) return;
  // a switch between a profile and custom uptakes changes the chips: draw the pane again
  if (!fresh && !!pane.querySelector('#oneProf [data-act="one"]') !== !!X.u) { renderOne(); return; }
  const u = curU(), r = measureOne(u, X.theta);
  pane.querySelectorAll('input[data-u]').forEach(el => { const i = +el.dataset.u; if (document.activeElement !== el) el.value = u[i]; });
  pane.querySelectorAll('[data-uv]').forEach(el => { el.textContent = u[+el.dataset.uv].toFixed(2); });
  const th = $('#theta'); if (th && document.activeElement !== th) th.value = X.theta;
  $('#thv').textContent = X.theta.toFixed(2);
  $('#oneOut').innerHTML = `<dt>Links</dt><dd>${linksOf(r)}<small>of ${ONE_N * (ONE_N - 1)} possible</small></dd>
    <dt>Clearance</dt><dd>${r.C.toFixed(2)}<small>the kidneys' links out</small></dd>
    <dt>Heterogeneity</dt><dd>${r.H.toFixed(2)}<small>0 even, higher: one organ dominates</small></dd>
    <dt>Index</dt><dd style="color:var(--amber)">${r.mdi.toFixed(1)}<small>metabolic displacement, 0 to 10</small></dd>`;
}
function renderPeople() {
  const pane = $('#pane-people');
  if (!pane) return;
  const P = POSTER, g = P.groups[X.group - 1];
  const views = [['people', 'People'], ['index', 'Index'], ['survival', 'Survival'], ['immunotherapy', 'Immunotherapy']].filter(([k]) => optKey('people', 'view', new RegExp('^' + k + '$', 'i')));
  let h = `<p class="sub">The poster's results: ${P.mdiN ? `${fmt(P.mdiN)} people` : 'people'} by their index. Pick a group.</p>
    <div class="chips">${P.groups.map((x, i) => chip(`data-act="group" data-v="${i + 1}"`, `${esc(x.name)} <small>${x.n}</small>`, X.group === i + 1, x.col)).join('')}</div>`;
  if (g) h += `<h3><span class="sw" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${g.col};margin-right:8px"></span>${esc(g.name)}</h3>
    <dl class="stats"><dt>People</dt><dd>${g.n}</dd><dt>Index</dt><dd>${g.centre}<small>${Array.isArray(g.err) ? `the poster's bar: ${g.err[0]} to ${g.err[1]}` : ''}</small></dd></dl>`;
  if (views.length) h += `<p class="grp-h">View</p><div class="chips">${views.map(([k, n]) => chip(`data-act="pview" data-v="${k}"`, n, X.scene === 'people' && viewIs('people', new RegExp('^' + k + '$', 'i')))).join('')}</div>`;
  if (P.thirds.length) h += `<p class="grp-h">Survival with cancer, by the index's thirds</p>
    <dl class="stats">${P.thirds.map(t => `<dt><span class="sw" style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${t.col};margin-right:6px"></span>${esc(t.name)}${t.n ? ` (${t.n})` : ''}</dt><dd>${t.median === undefined ? '–' : t.median === null ? 'not reached' : t.median + ' months'}<small>median${t.y1 !== null ? ` · ${t.y1}% after one year` : ''}</small></dd>`).join('')}</dl>`;
  if (P.auc.length) h += `<p class="grp-h">The immunotherapy test${P.respN ? ` (${P.respN} people with lung cancer)` : ''}: good from poor responders</p>
    <dl class="stats">${P.auc.slice().sort((a, b) => b.auc - a.auc).map(a => `<dt>${esc(a.name)}</dt><dd style="color:${a.net ? 'var(--amber)' : 'var(--muted)'}">${a.auc}<small>AUC${a.p ? ' · ' + esc(a.p) : ''}</small></dd>`).join('')}</dl>
    <p class="sub">0.5 is chance. A first test, in few people.</p>`;
  h += `<p class="note">Group summaries from the poster. The dots are stand-ins drawn to match them, not patients.</p>`;
  pane.innerHTML = h;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${X.scene === 'scan' ? `<div class="actions">${chip('data-act="life"', 'Life size', X.life)}</div>` : ''}
    ${X.scene === 'organs' && X.organ ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(organName(X.organ))} (Organs tab).</p>` : ''}`;
}
// labels the panes add (the sets label their own picks)
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  const s = GL.sets[X.scene], id = X.organ;
  if (X.scene === 'organs' && id && s.anchors[id] && !(s.labels || []).some(L => L.at === id)) {
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(organName(id))}</b>`, 'cyn'), set: 'organs', at: id, o: -1, txt: [organName(id), '', 'cyn'] });
  }
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { organ } or { group }, or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || !(X.scene === 'organs' || X.scene === 'people')) return null;
  const A = setApi(X.scene);
  if (!A || !A.pick) return null;
  const r = A.pick(rc);
  if (typeof r === 'string') return PD.byId[r] ? { organ: r } : null;
  if (r && r.organ && PD.byId[r.organ]) return { organ: r.organ };
  return r && r.group >= 1 && r.group <= POSTER.groups.length ? { group: r.group } : null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null
function pickPos(p) {
  if (!p) return null;
  const s = GL.sets[X.scene], at = p.organ ? p.organ : 'g' + p.group;
  if (!s.anchors || !s.anchors[at]) return null;
  const q = anchorOf(X.scene, at);
  return q && Number.isFinite(q[0]) ? [q[0], q[1], q[2]] : null;
}
const pickText = p => (p.organ ? [organName(p.organ), p.organ === 'aorta' ? 'the reference' : PD.byId[p.organ].measure]
  : [POSTER.groups[p.group - 1].name, `${POSTER.groups[p.group - 1].n} people, index ${POSTER.groups[p.group - 1].centre}`]);
function choosePick(p) {
  if (!p) return;
  if (p.organ && X.scene === 'organs') { if (X.tab !== 'organs' && X.tab !== 'networks') showTab('organs'); selectOrgan(p.organ === X.organ ? null : p.organ, false); }
  else if (p.organ) showTab('one');   // an organ of the one-scan network: its slider
  else { showTab('people'); selectGroup(p.group === X.group ? 0 : p.group, false); }
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
    cv.style.cursor = p ? 'pointer' : 'grab';
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
// point at, and labels become sprites. Controllers: point and pull the trigger
// to click, drag the scene with the trigger or grip, thumbstick spins and zooms,
// A/X plays and pauses the story. Hand tracking: point and pinch.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), size: 1, globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  baseR: 0.36, R: 0.36, viewH: 1600, hitR: 1, target: new THREE.Vector3(),
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' }, room: false,
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
  // life size: the scanner (1 unit = 1 m) standing on your floor, its floor 1.6 m below your eyes (the reference space
  // is 'local': the floor is unknown, as for the flock's land), the bore as far ahead as the set's life view, the couch
  // towards you; the thumbstick turns it on its spot
  if (XR.room && APP.mode === 'explore' && X.scene === 'scan') {
    const lv = view('scan', 'life'), d = clamp(lv[2], 1.8, 4);
    XR.R = 1; XR.hitR = 1.4; XR.target.set(0, 0, 0);
    GL.world.quaternion.setFromAxisAngle(_xY, -(v[0] - lv[0]) * D2R);
    GL.world.scale.setScalar(1);
    GL.world.position.set(0, -1.6 - scanFloorY(), -d);   // the rig is at your eyes
    return;
  }
  const d = Math.max(v[2], 0.05);
  _xq.setFromAxisAngle(_xX, clamp(v[1], -85, 85) * D2R).multiply(_xq2.setFromAxisAngle(_xY, -v[0] * D2R));
  XR.R = XR.baseR * clamp(Math.pow(3.6 / d, 0.85), 0.12, 10) * XR.size;   // (times the size your hands or the room gave it)
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
  const hm = (XR.room ? 0.036 : 0.021) / XR.R;   // (life size: the labels are further away)
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
}
// the organ or group a controller points at, labelled where the ray meets it
function xrTip(S) {
  let h = null;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.pk) { h = c.hover; break; }
  const id = h ? (h.pk.organ ? 'o' + h.pk.organ : 'g' + h.pk.group) + X.scene : '';
  if (id !== XR.tipI) {
    XR.tipI = id;
    if (XR.tip) dropSprite(XR.tip);
    XR.tip = h ? { set: X.scene, at: [0, 0, 0], txt: [...pickText(h.pk), 'tip'] } : null;
  }
  if (XR.tip) { GL.sets[XR.tip.set].group.worldToLocal(_xp.copy(h.point)); XR.tip.at = [_xp.x, _xp.y, _xp.z]; placeLabelXR(XR.tip, 1, S); }
}

// ---------------------------------------------------- picking an organ --
// The organ or group a ray points at (explore mode, the organs or the people on show): { organ } or { group }, or null
const _prc = new THREE.Raycaster();
function pickRay(o, d) {
  if (APP.mode !== 'explore' || !(X.scene === 'organs' || X.scene === 'people')) return null;
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
      if (r && r.id === p.id && r.fn) { buzz(c); r.fn(); }
    }
  } else if (!p.moved && p.pk) { buzz(c); xrClickPick(p.pk); }
}
function xrGrab(c, on) {
  c.grab = null;
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  if (h.kind !== 'panel' && XR.room && APP.mode === 'explore' && X.scene === 'scan') return;   // life size: the scanner stands on your floor
  // the scene is held by its placement point (where the view's target sits), so a still hand moves nothing
  const p0 = h.kind === 'panel' ? XR.panelGroup.getWorldPosition(new THREE.Vector3()) : GL.rig.localToWorld(XR.globeBase.clone().add(XR.globeOff));
  c.grab = { target: h.kind === 'panel' ? 'panel' : 'globe', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
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
  } else if (!XR.stories) {
    // the scene counts as a ball around the view's target; an organ or a group counts if the ray passes close
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    _xc.copy(oL).sub(XR.target);
    const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const pk = pickRay(c.o, c.d);
    if (t > 0 || pk) {
      // an organ or a group is marked where it is; else the ball's surface
      const q = pk ? pickPos(pk) : null;
      if (q) _xp.set(q[0], q[1], q[2]).applyMatrix4(GL.sets[X.scene].group.matrixWorld);
      else _xp.copy(dL).multiplyScalar(t > 0 ? t : Math.max(0, _xc.copy(XR.target).sub(oL).dot(dL))).add(oL).applyMatrix4(GL.world.matrixWorld);
      hit = { kind: 'globe', i: -1, pk, point: _xp.clone() };
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

// ---------------------------------------------------------- explore glue --
function xrClickPick(pk) {
  if (APP.mode !== 'explore') return;
  XR.kbd.open = false;
  choosePick(pk);
}
// Life size: in the headset the scanner stands on your floor in front of you
function xrRoom(on) { XR.room = on; }
// where the scanner's floor is in its own frame (it exports floorY; the bore's centre is its origin)
function scanFloorY() { const s = GL.sets.scan, A = setApi('scan'); return Number.isFinite(s.floorY) ? s.floorY : A && Number.isFinite(A.floorY) ? A.floorY : -1.05; }
// in passthrough the room's own floor shows: the scanner's dark floor and its reflection are hidden
function scanFloor(on) {
  const A = setApi('scan');
  if (A && A.setFloor) A.setFloor(on);
  else { const f = GL.sets.scan.group.getObjectByName('floor'); if (f) f.visible = on; }
}
// how close the headset may zoom: as close as the scene's own closest view, else 0.9 (closer, the scene would surround your head)
const xrMinD = () => (XR.room && X.scene === 'scan' ? 0.05 : Math.min(0.9, ...Object.values(GL.sets[X.scene].cam || {}).map(v => +v[2] || 9)));
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
  GL.stars.visible = XR.clear;
  GL.stars.material.size = 2.2;
  for (const P of XR.panels) { P.mesh.visible = true; P.last = ''; }
  XR.kbd.open = false;
  XR.room = !!X.life;
  scanFloor(XR.clear);
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
  scanFloor(true);
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
    let s = 's' + audioLabel() + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '');
    if (it) {
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'title') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
    }
    return s;
  }
  return ['x', audioLabel(), X.tab, X.scene, JSON.stringify(X.ctl), X.cmp, X.net, X.organ, X.u ? X.u.join(',') : '', X.theta, X.group, X.life].join('|');
}
const XR_HERE = 'pet';
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
    // side), eight 0.272 rad apart at 1.4 m (0.379 m apart, the outer ones 55° to the side)
    const n = HOST.list.length, a = (k - (n - 1) / 2) * (n > 7 ? 0.272 : 0.31), d = n > 7 ? 1.4 : 1.25;
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
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
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
  ctx.fillText(fitText(ctx, 'One scan, one system', x - 40), 40, 36);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. A or X: play and pause. Anchored: to move things, use Place again on the Stories screen.' : 'Trigger (or pinch): use buttons. Grip: move the scene or this panel; both grips on the scene resize it. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
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
      ctx.font = vfont(50, 700); ctx.fillStyle = b && b.style.color ? b.style.color : VC.amber; ctx.fillText(fitText(ctx, b ? b.textContent : '', cw - 16), x + k * cw, y);
      if (sm) textBlock(ctx, sm.textContent, x + k * cw, y + 68, cw - 16, 25, 32, VC.muted, 400, 2);
    });
    h = 68 + 64 + 18;
  } else if (tag === 'UL' && cl.contains('steps')) {
    // points with a bold name over a line of text, each fading in on its own
    let yy = y;
    for (const li of el.children) {
      ctx.globalAlpha = a * storyOpacity(li);
      const b = li.querySelector('b'), bold = b ? b.textContent : '', rest = li.textContent.slice(bold.length).trim();
      const col = li.style.borderLeftColor || VC.amber;   // an organ's point in its own colour
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
    ctx.font = vfont(24, on ? 700 : 400); ctx.fillStyle = on ? VC.ink : VC.muted;
    ctx.textAlign = 'center'; ctx.fillText(n, tx + tw / 2, y + 18); ctx.textAlign = 'left';
    if (on) { ctx.fillStyle = VC.cyan; ctx.fillRect(tx + 10, y + 58, tw - 20, 4); }
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => showTab(k) });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 88;
  const bottom = P.h - 34;
  ({ networks: drawNetsPane, organs: drawOrgansPane, one: drawOnePane, people: drawPeoplePane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// buttons that wrap like the HTML chips: items -> { id, label, on, col, icon (an organ id), fn }
function flow(ctx, P, items, x, y, W, maxY, o = {}) {
  const px = o.px || 22, h = o.h || 44, gap = 8;
  let cx = x, cy = y;
  ctx.font = vfont(px);
  for (const it of items) {
    ctx.font = vfont(px, it.on ? 700 : 400);   // (a lit chip's bold label is wider)
    const sw = it.icon ? h - 10 : it.col ? 22 : 0, w = Math.min(W, ctx.measureText(it.label).width + 26 + sw);
    if (cx + w > x + W) { cx = x; cy += h + gap; }
    if (cy + h > maxY) break;
    vButton(ctx, P, it.id, cx, cy, w, h, '', it.fn, { r: 6, on: it.on });
    if (it.icon) PET_ICONS.draw(ctx, it.icon, cx + 8 + (h - 16) / 2, cy + h / 2, h - 14, { color: it.col || VC.ink, width: 2 });
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
// a network's strength per organ as bars, sorted from high to low, the hubs marked
function drawStrength(ctx, x, y, W, id, hubs) {
  const st = strengths(id), n = st.length, gap = 6, bw = (W - gap * (n - 1)) / Math.max(1, n), bh = 110, mx = n ? st[0][1] || 1 : 1;
  st.forEach(([o, v], k) => {
    const bx = x + k * (bw + gap), hgt = bh * v / mx;
    ctx.fillStyle = organCol(o); ctx.fillRect(bx, y + bh - hgt, bw, hgt);
    if (hubs.includes(o)) { ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 3; ctx.strokeRect(bx - 1.5, y + bh - hgt - 1.5, bw + 3, hgt + 3); }
    PET_ICONS.draw(ctx, o, bx + bw / 2, y + bh + 22, Math.min(36, bw), { color: hubs.includes(o) ? '#ffb020' : VC.muted, width: 2 });
  });
  return bh + 48;
}
function drawNetsPane(ctx, P, x, y, W, bottom) {
  const T = PD.D.table2, r = T[X.cmp], id = curNet(), ni = netInfo(id);
  y += head(ctx, x, y, 'Table 2: groups of scans compared (amber: a significant difference)');
  y += flow(ctx, P, T.map((t, i) => ({ id: 'cmp:' + i, label: rowName(t), col: t.sigD || t.sigO ? VC.amber : null, on: X.cmp === i, fn: () => selectCmp(X.cmp === i ? -1 : i) })), x, y, W, bottom - 470, { px: 18, h: 36 }) + 14;
  if (r) {
    const nets = rowNets(r);
    y += textBlock(ctx, `${r.what}: ${r.cohort}`, x, y, W, 25, 34, VC.ink, 700, 1) + 4;
    r.groups.forEach((g, i) => { y += textBlock(ctx, `${g.label}: density ${pct(g.density)}, disorder ${dis(g.disorder)}, ${g.n} scans${nets[i] && NET_IDS.includes(nets[i]) ? ' (network below)' : ''}`, x, y, W, 22, 30, VC.muted, 400, 1); });
    y += textBlock(ctx, `Density ${r.pD}${r.sigD ? ', significant' : ''}. Disorder ${r.pO}${r.sigO ? ', significant' : ''}.`, x, y, W, 22, 30, r.sigD || r.sigO ? VC.amber : VC.muted, 400, 1) + 12;
  }
  y += head(ctx, x, y, 'Networks drawn in the paper (· not read off the figure yet)');
  y += flow(ctx, P, NET_IDS.map((n, i) => ({ id: 'net:' + n, label: NET_SHORT[i] + (hasNet(n) ? '' : ' ·'), on: n === id && X.scene === 'organs', fn: () => showNet(n) })), x, y, W, bottom, { px: 20, h: 40 }) + 12;
  y += textBlock(ctx, `${netShort(id)}: ${ni.text} ${ni.hubText || ''}`, x, y, W, 22, 30, VC.muted, 400, 3) + 10;
  if (ni.ok && y + 170 < bottom - 64) y += drawStrength(ctx, x, y, W, id, ni.hubs || []) + 6;
  if (FACTS.hk2 && y + 64 < bottom) textBlock(ctx, `Protein networks (Table 3): of ${FACTS.tested} proteins, only hexokinase 2's network resembles FDG's (r = ${FACTS.hk2.r}): the HK2 and GLUT networks above.`, x, y, W, 21, 29, VC.faint, 400, 2);
}
function drawOrgansPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, PD.D.organs.map(o => ({ id: 'org:' + o.id, label: o.short, icon: o.id, col: o.col, on: X.organ === o.id, fn: () => selectOrgan(X.organ === o.id ? null : o.id) })), x, y, W, bottom, { px: 21, h: 48 }) + 18;
  const id = X.organ, O = PD.byId[id];
  if (!O) { textBlock(ctx, `The ${FACTS.organs} organs of the paper and the aorta, the reference every organ is divided by. Pick one, or point at an organ, a bar or a node and pull the trigger (or pinch).`, x, y, W, 26, 38, VC.muted); return; }
  PET_ICONS.draw(ctx, id, x + 22, y + 22, 44, { color: O.col, width: 3, glow: true });
  y += textBlock(ctx, O.name, x + 60, y + 2, W - 60, 38, 46, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, `Measured: ${O.measure}.`, x, y, W, 24, 33, VC.muted, 400, 2) + 2;
  y += textBlock(ctx, id === 'aorta' ? 'The unit: every organ\'s uptake is divided by the aorta\'s.' : `Typical uptake: ${O.suv} times the aorta's (illustrative).`, x, y, W, 24, 33, VC.muted, 400, 2) + 2;
  const hubIn = NET_IDS.filter(n => hasNet(n) && hubsOf(n).includes(id));
  y += textBlock(ctx, `Hub in: ${hubIn.length ? listOf(hubIn.map(netShort)) : 'no network drawn so far'}.`, x, y, W, 24, 33, hubIn.length ? VC.amber : VC.muted, 400, 2) + 14;
  if (!PD.D.f2.organs.includes(id)) { textBlock(ctx, id === 'aorta' ? 'Not a node: the blood pool.' : `Not in the network of all scans (Figure 2A has ${FACTS.f2n} organs); it appears in Figure 3's.`, x, y, W, 24, 33, VC.muted, 400, 2); return; }
  const e = edgesOf('full').filter(q => q[0] === id || q[1] === id).sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
  y += head(ctx, x, y, `Its links among all ${fmt(FACTS.scans)} scans (Figure 2A; blue together, red opposite)`);
  flow(ctx, P, e.map(q => { const o = q[0] === id ? q[1] : q[0]; return { id: 'ol:' + o, label: `${PD.byId[o].short} ${q[2] > 0 ? '+' : '−'}${Math.abs(q[2]).toFixed(2)}`, icon: o, col: q[2] > 0 ? '#4c7cff' : '#ff4d4d', fn: () => selectOrgan(o) }; }), x, y, W, bottom, { px: 21, h: 46 });
}
function drawOnePane(ctx, P, x, y, W, bottom) {
  const p = curProfile(), u = curU(), r = measureOne(u, X.theta);
  y += flow(ctx, P, PROFILES.map(([k, n]) => ({ id: 'prof:' + k, label: n, col: GROUP_COL[k], on: !X.u && p === k, fn: () => selectProfile(k) })).concat(X.u ? [{ id: 'prof:custom', label: 'Custom', on: true, fn: showOne }] : []), x, y, W, bottom, { px: 22, h: 48 }) + 16;
  const lw = 250, vw = 90, sx = x + lw, sw = W - lw - vw - 20;
  S1.organs.forEach((o, i) => {
    PET_ICONS.draw(ctx, o, x + 16, y + 24, 30, { color: organCol(o), width: 2 });
    ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle'; ctx.fillText(fitText(ctx, organName(o).replace(/ \(.*\)$/, ''), lw - 50), x + 42, y + 25);
    ctx.textAlign = 'right'; ctx.fillText(u[i].toFixed(2), x + W, y + 25); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    vSlider(ctx, P, 'u:' + i, sx, y, sw, u[i], 0.1, 5, organCol(o), v => { setU(i, v); if (X.scene !== 'people' || !oneView()) showOne(); });
    y += 54;
  });
  ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle'; ctx.fillText('Threshold', x + 4, y + 25);
  ctx.textAlign = 'right'; ctx.fillText(X.theta.toFixed(2), x + W, y + 25); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  vSlider(ctx, P, 'theta', sx, y, sw, X.theta, 1.1, 3, VC.cyan, v => { setTheta(v); if (X.scene !== 'people' || !oneView()) showOne(); });
  y += 70;
  const cells = [['Links', String(linksOf(r))], ['Clearance', r.C.toFixed(2)], ['Heterogeneity', r.H.toFixed(2)], ['Index', r.mdi.toFixed(1)]], cw = W / 4;
  cells.forEach(([k, v], j) => {
    ctx.font = vfont(52, 700); ctx.fillStyle = j === 3 ? VC.amber : VC.ink; ctx.fillText(v, x + j * cw, y);
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(k, x + j * cw, y + 62);
  });
  y += 110;
  if (y + 90 < bottom) textBlock(ctx, `${S1.note} The profiles are illustrative too.`, x, y, W, 21, 29, VC.faint, 400, 3);
}
function drawPeoplePane(ctx, P, x, y, W, bottom) {
  const PO = POSTER, g = PO.groups[X.group - 1];
  y += textBlock(ctx, `The poster's results: ${PO.mdiN ? fmt(PO.mdiN) + ' people' : 'people'} by their index. Pick a group.`, x, y, W, 24, 33, VC.muted, 400, 2) + 10;
  y += flow(ctx, P, PO.groups.map((q, i) => ({ id: 'grp:' + (i + 1), label: `${q.name} · ${q.n}`, col: q.col, on: X.group === i + 1, fn: () => selectGroup(X.group === i + 1 ? 0 : i + 1) })), x, y, W, bottom, { px: 22, h: 48 }) + 14;
  if (g) y += textBlock(ctx, `${g.name}: ${g.n} people, index ${g.centre}${Array.isArray(g.err) ? ` (the poster's bar: ${g.err[0]} to ${g.err[1]})` : ''}.`, x, y, W, 24, 33, VC.ink, 400, 2) + 12;
  const views = [['people', 'People'], ['index', 'Index'], ['survival', 'Survival'], ['immunotherapy', 'Immunotherapy']].filter(([k]) => optKey('people', 'view', new RegExp('^' + k + '$', 'i')));
  if (views.length) { y += head(ctx, x, y, 'View'); y += flow(ctx, P, views.map(([k, n]) => ({ id: 'pv:' + k, label: n, on: X.scene === 'people' && viewIs('people', new RegExp('^' + k + '$', 'i')), fn: () => showPeople(new RegExp('^' + k + '$', 'i')) })), x, y, W, bottom, { px: 23, h: 52 }) + 16; }
  if (PO.thirds.length) {
    y += head(ctx, x, y, 'Survival with cancer, by the index\'s thirds (median; after one year)');
    for (const t of PO.thirds) {
      swatch(ctx, x, y + 6, 18, t.col);
      y += textBlock(ctx, `${t.name}${t.n ? ` (${t.n})` : ''}: ${t.median === undefined ? '–' : t.median === null ? 'not reached' : t.median + ' months'}${t.y1 !== null ? `; ${t.y1}%` : ''}`, x + 30, y, W - 30, 23, 32, VC.ink, 400, 1) + 2;
    }
    y += 12;
  }
  if (PO.auc.length && y + 80 < bottom) {
    y += head(ctx, x, y, `The immunotherapy test${PO.respN ? ` (${PO.respN} people)` : ''}: AUC, 0.5 is chance`);
    for (const a of PO.auc.slice().sort((p, q) => q.auc - p.auc)) {
      if (y + 34 > bottom - 70) break;
      y += textBlock(ctx, `${a.name}: ${a.auc}${a.p ? ' · ' + a.p : ''}`, x, y, W, 23, 32, a.net ? VC.amber : VC.muted, a.net ? 700 : 400, 1) + 2;
    }
  }
  if (y + 40 < bottom) textBlock(ctx, 'Group summaries from the poster; the dots are stand-ins drawn to match them, not patients.', x, bottom - 60, W, 21, 29, VC.faint, 400, 2);
}
// the five scenes, and the chosen scene's own controls
const SCENE_SHORT = { people: 'People' };
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, SCENE_SHORT[k] || n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene);
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene)) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  if (X.scene === 'scan' && y + 70 < bottom) vButton(ctx, P, 'life', x, y, 300, 60, 'Life size', () => setLife(!X.life), { on: X.life, px: 24 });
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
// Optional voice-over: put an MP3 at audio/narration-pet.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-pet.mp3', {
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
    let best = 'organs', ba = 0;
    for (const k of SET_ORDER) if (S[k + '_a'] > ba + 0.01) { ba = S[k + '_a']; best = k; }
    if (best === 'body' && S.organs_a > 0.3) best = 'organs';   // (the organs lie in the body)
    // the story's view, taken back into the set's own frame (explore shows sets unturned)
    const v = storyCam(ts).slice(), r = -setYaw(best, ts) * D2R, x = v[3], z = v[5];
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
    // the story's network, organ, profile and group carry over to the panels (the controls hold the network and the
    // profile: the closest ones were picked above)
    X.organ = null; X.u = null; X.group = 0; X.cmp = -1; X.theta = Number.isFinite(S.people_theta) ? round2(clamp(S.people_theta, 1.1, 3)) : S1.theta;
    if (best === 'organs' && S.organs_focus > 0.5) X.organ = PD.ids[Math.round(S.organs_focus) - 1] || null;
    if (best === 'organs' && S.organs_net > 0.5) { const w = NET_IDS[Math.round(S.organs_which)]; if (w) { if (!netCtl()) X.net = w; X.cmp = rowOfNet(w); } }
    if (best === 'people' && !netCtl()) X.profile = (PROFILES[Math.round(S.people_profile)] || PROFILES[0])[0];
    if (best === 'people' && S.people_group > 0.5) X.group = clamp(Math.round(S.people_group), 0, POSTER.groups.length);
    X.tab = best === 'organs' ? (S.organs_net > 0.5 ? 'networks' : 'organs') : best === 'people' ? (S.people_map > 0.5 ? 'people' : 'one') : 'scenes';
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: no picked organ or group, the scanner not life size
    if (X.life) setLife(false);
    X.organ = null; X.group = 0; NEXT.length = 0; pushState();
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
    // the end: Repeat (shell) starts this story or the next one again, else explore mode opens
    if (APP.t >= T_END) { APP.t = T_END; if (HOST.ended()) APP.playing = false; else APP.enterExplore(); }
  }
  audioSync();
  const ts = storyT(APP.t); // original story time for this point in the narration
  if (APP.mode === 'story') {
    S = storyState(ts); tSet = ts;
    if (xr) xrPlace(storyCam(ts)); else { applyCamera(storyCam(ts)); keepCamera(S, ts); }
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    const pn = performance.now();
    S = exploreStep(dt, pn); tSet = pn / 1000;
    orbitStep(xr ? pn : now);
    if (xr) xrPlace(orbit.cur); else { applyCamera(orbit.cur); keepCamera(S, null); }
  }
  K.U.uTime.value = tSet;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  updateSets(S, tSet, dt, APP.mode === 'story');
  // what explore mode asked to do once the sets show its pick (a flight to an organ)
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
    // #pet&explore&scene=scan&view=ring (any control of a scene by its key), &tab=networks|organs|one|people|scenes,
    // &cmp=7 (a row of Table 2), &net=C_high, &organ=muscle, &profile=cancer, &theta=2, &u=2.2,1.7,... (custom
    // uptakes), &group=3, &life (the scanner life size)
    const sc = hp.get('scene');
    if (sc && GL.sets[sc]) { openScene(sc, false); showTab('scenes'); }
    else if (!hp.has('t')) {   // straight in: the network of all scans, with its strength
      openScene('organs', false);
      const v = optKey('organs', 'view', /strength/i) || optKey('organs', 'view', /net/i);
      if (v) (X.ctl.organs = X.ctl.organs || {}).view = v;
      setNet('full'); showTab('networks');
    }
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    for (const c of ctlsOf(X.scene)) if (hp.get(c.key) && c.options.some(o => o[0] === hp.get(c.key))) setCtl(X.scene, c.key, hp.get(c.key));
    if (hp.get('cmp') !== null && hp.get('cmp') !== '') { const i = parseInt(hp.get('cmp'), 10); if (i >= 0 && i < PD.D.table2.length) { showTab('networks'); selectCmp(i); } }
    if (NET_IDS.includes(hp.get('net'))) { showTab('networks'); showNet(hp.get('net')); }
    if (PD.byId[hp.get('organ')]) { showTab('organs'); selectOrgan(hp.get('organ')); }
    if (PROFILES.some(p => p[0] === hp.get('profile'))) { showTab('one'); selectProfile(hp.get('profile')); }
    if (hp.get('u')) { const u = hp.get('u').split(',').map(Number); if (u.length === ONE_N && u.every(Number.isFinite)) { showTab('one'); setUs(u); showOne(); } }
    if (hp.get('theta') && Number.isFinite(+hp.get('theta'))) { showTab('one'); setTheta(+hp.get('theta')); showOne(); }
    if (hp.get('group')) { const g = parseInt(hp.get('group'), 10); if (g >= 1 && g <= POSTER.groups.length) { showTab('people'); selectGroup(g); } }
    if (hp.get('tab') && TABS.some(t => t[0] === hp.get('tab'))) {
      showTab(hp.get('tab'));
      if (hp.get('tab') === 'one') showOne();
      if (hp.get('tab') === 'people' && X.scene !== 'people') showPeople(/^index$/i);
    }
    if (hp.has('life')) { setLife(true); if (!hp.get('tab')) showTab('scenes'); }
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
    pp: XR.panelGroup.position.clone(), pr: XR.panelGroup.rotation.y } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the explore panes, and there are no effects
  collab: {
    APP, scene: () => GL.scene, state: collabState, apply: collabApply, view: collabView, setView: collabSetView,
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
