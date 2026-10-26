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
//                     the printed matrices; the others are read off the figures; approx: weights scaled) }: full and
//                     vena (Figure 2A), A_low, A_high, B_low, B_high, C_low, C_mid, C_high (Figure 3), FDG_healthy, HK2,
//                     GLUT (Figure 4), dose_standard, dose_ultra, dose_virtual (Figure 2B, approx)
//   table2[]          every comparison of the paper's Table 2: { what, cohort, part ('test' or 'health'), groups [{ label,
//                     n, density, disorder }], pD, pO (p values as printed), sigD, sigO (significant), note (when the
//                     row needs a word: an oddity of the printed table) }
//   table3[]          the protein networks of Table 3: { name, kind, density, p, r (weight-matrix correlation with FDG), similar }
//   strength          Figure 3D's strength distributions (high and low density) and Figure 2C's (test-retest), read off
//   synth             a stand-in cohort of 658 people with Figure 2A's partial correlations: rows (values in organ-bar
//                     units, f2 order), cor and pcor (its correlations and partial correlations), pairs (for the
//                     explainer: { a, b, paper, r, pr, xy: per person [a, b, a's residual, b's residual] in z units })
const PET_DATA = {"source":{"paper":"Geist BK, Guthrie J, Kertesz H, Kiefer FW, Kulterer OC, Nakuz T, Nics L, Patronas E-M, Rendeiro A, Vraka C, Yu J, Grünert S, Hacker M. The metabolic organ connectome: A novel approach to measure allostatic load during health-to-disease transition. Med 6, 100881 (2025). doi:10.1016/j.medj.2025.100881 (CC BY 4.0)","poster":"Geist BK, Grentner A, Fischer J, Yu J, Tsomaia D, Smajlovic A, Grünert S, Hacker M. Shaping a New Era in Nuclear Medicine. Division of Nuclear Medicine, Medical University of Vienna; LBI for Network Medicine."},"organs":[{"id":"brain","name":"Brain","short":"Brain","measure":"mean of the whole brain","col":"#a78bfa","pos":[0,0.738,-0.008],"suv":4.4},{"id":"thyroid","name":"Thyroid","short":"Thyroid","measure":"mean of the whole gland","col":"#22d3ee","pos":[0,0.548,0.042],"suv":0.95},{"id":"lungs","name":"Lungs","short":"Lungs","measure":"maximum (left and right averaged)","col":"#60a5fa","pos":[-0.079,0.365,-0.01],"suv":0.55},{"id":"heart","name":"Heart","short":"Heart","measure":"mean of the whole heart","col":"#f43f5e","pos":[0.038,0.293,0.052],"suv":1.8},{"id":"liver","name":"Liver","short":"Liver","measure":"mean of the whole liver","col":"#f97316","pos":[-0.074,0.205,0.012],"suv":1.35},{"id":"spleen","name":"Spleen","short":"Spleen","measure":"mean of the whole spleen","col":"#d946ef","pos":[0.108,0.2,-0.056],"suv":1.1},{"id":"pancreas","name":"Pancreas","short":"Pancreas","measure":"mean of the whole pancreas","col":"#facc15","pos":[0.032,0.14,-0.01],"suv":0.95},{"id":"kidneys","name":"Kidneys","short":"Kidneys","measure":"mean (left and right averaged)","col":"#fb7185","pos":[-0.065,0.098,-0.066],"suv":1.6},{"id":"adrenal","name":"Adrenal glands","short":"Adrenals","measure":"maximum","col":"#a3e635","pos":[-0.054,0.152,-0.06],"suv":1.2},{"id":"intestine","name":"Intestine","short":"Intestine","measure":"mean of the whole intestine","col":"#f9a8d4","pos":[-0.009,0.02,0.05],"suv":1},{"id":"muscle","name":"Muscle","short":"Muscle","measure":"mean of the gluteus maximus","col":"#4ade80","pos":[-0.072,-0.13,-0.085],"suv":0.47},{"id":"marrow","name":"Bone marrow","short":"Marrow","measure":"maximum between the vertebrae L1 and L5","col":"#e7e5e4","pos":[0,0.06,-0.036],"suv":1.3},{"id":"fat","name":"Subcutaneous fat","short":"Fat","measure":"mean between the vertebrae L1 and L5","col":"#fdba74","pos":[0,0.06,0.1],"suv":0.2},{"id":"aorta","name":"Aorta (blood pool)","short":"Aorta","measure":"the reference: every organ is divided by it","col":"#94a3b8","pos":[0.014,0.25,-0.04],"suv":1}],"cohort":{"scans":658,"subjects":548,"healthy":241,"cancer":417,"lung":165,"hnscc":252,"retest6w":47,"cold2w":63,"dose":21,"norepi":40,"gtex":946,"gtexSamples":17382,"gtexProteins":13,"table1":{"cols":["Full FDG cohort","Healthy FDG cohort","Cancer FDG cohort","GTEx cohort"],"rows":[["Subjects","658","241","417","946"],["Male (%)","63","53","69","67"],["Blood glucose (mg/dL)","105 ± 34","83 ± 6","115 ± 38","–"],["BMI (kg/m²)","26 ± 6","25 ± 5","27 ± 6","27 ± 4"],["Age (years)","54 ± 17","34 ± 12","61 ± 11","53 ± 13"],["Leukocytes (10⁹/L)","8.2 ± 2.9","6 ± 2","9.1 ± 2.8","–"],["CRP (mg/dL)","1.7 ± 3.8","0.2 ± 0.5","3.1 ± 4.8","–"],["Norepinephrine (ng/L)","–","271 ± 114 (40 people)","–","–"],["Tumour load, TLG (SUV × mL)","–","–","265 ± 677","–"],["Tumour stage","–","–","4 (3–4)","–"],["Survival (months)","–","–","42 ± 32","–"]]}},"protocol":{"fasting":6,"dose":[250,300],"rest":60,"segmentation":"MOOSE (nnU-Net)","software":"JASP 0.19.0","p":0.05,"hub":1.7},"f2":{"organs":["adrenal","marrow","heart","intestine","kidneys","liver","lungs","muscle","pancreas","spleen","thyroid"],"aorta":[[0,0,-0.19,0,0,0,0.3,0,0,0,0],[0,0,-0.19,0.37,0,0,0.15,0,0,0,0],[-0.19,-0.19,0,0.27,0.23,0.31,0.73,0.17,0.22,-0.16,0],[0,0.37,0.27,0,-0.19,0,-0.31,0.23,0,0,0],[0,0,0.23,-0.19,0,0,-0.21,0,0.15,0.2,0],[0,0,0.31,0,0,0,-0.42,0.17,0,0.42,0],[0.3,0.15,0.73,-0.31,-0.21,-0.42,0,0,-0.16,0.2,0.25],[0,0,0.17,0.23,0,0.17,0,0,0,0.18,0],[0,0,0.22,0,0.15,0,-0.16,0,0,0,0],[0,0,-0.16,0,0.2,0.42,0.2,0.18,0,0,0],[0,0,0,0,0,0,0.25,0,0,0,0]],"vena":[[0,0,-0.2,0,0,0,0.35,0.15,0,0,0],[0,0,0,0.28,-0.16,0,0,0,0.19,0,0],[-0.2,0,0,0.28,0.24,0,0.69,0.15,0,-0.2,-0.22],[0,0.28,0.28,0,-0.21,0,-0.36,0.24,0,0.17,0.19],[0,-0.16,0.24,-0.21,0,0.3,-0.27,0,0.28,0.19,0],[0,0,0,0,0.3,0,0,0,0,0.45,0],[0.35,0,0.69,-0.36,-0.27,0,0,0,0,0.27,0.38],[0.15,0,0.15,0.24,0,0,0,0,0,0,0],[0,0.19,0,0,0.28,0,0,0,0,0,0],[0,0,-0.2,0.17,0.19,0.45,0.27,0,0,0,0],[0,0,-0.22,0.19,0,0,0.38,0,0,0,0]]},"nets":[{"id":"full","title":"All 658 scans (normalised to the aorta)","fig":"2A","n":658,"density":12,"disorder":0.17,"organs":["adrenal","marrow","heart","intestine","kidneys","liver","lungs","muscle","pancreas","spleen","thyroid"],"isolated":[],"hubs":[],"edges":[["adrenal","heart",-0.19],["adrenal","lungs",0.3],["marrow","heart",-0.19],["marrow","intestine",0.37],["marrow","lungs",0.15],["heart","intestine",0.27],["heart","kidneys",0.23],["heart","liver",0.31],["heart","lungs",0.73],["heart","muscle",0.17],["heart","pancreas",0.22],["heart","spleen",-0.16],["intestine","kidneys",-0.19],["intestine","lungs",-0.31],["intestine","muscle",0.23],["kidneys","lungs",-0.21],["kidneys","pancreas",0.15],["kidneys","spleen",0.2],["liver","lungs",-0.42],["liver","muscle",0.17],["liver","spleen",0.42],["lungs","pancreas",-0.16],["lungs","spleen",0.2],["lungs","thyroid",0.25],["muscle","spleen",0.18]],"layout":{"marrow":[0.187,0.128],"kidneys":[0.579,0.173],"pancreas":[0.925,0.059],"intestine":[0.248,0.373],"heart":[0.493,0.397],"spleen":[0.941,0.421],"lungs":[0.424,0.512],"liver":[0.827,0.56],"thyroid":[0.059,0.605],"adrenal":[0.344,0.837],"muscle":[0.728,0.92]},"computed":{"density":0.116,"disorder":0.217,"fitA":2.719,"strength":{"adrenal":0.49,"marrow":0.71,"heart":2.47,"intestine":1.37,"kidneys":0.98,"liver":1.32,"lungs":2.73,"muscle":0.75,"pancreas":0.53,"spleen":1.16,"thyroid":0.25},"hubs":["heart","lungs"]},"exact":true},{"id":"vena","title":"All 658 scans (normalised to the vena cava)","fig":"2A","n":658,"density":12,"disorder":0.21,"organs":["adrenal","marrow","heart","intestine","kidneys","liver","lungs","muscle","pancreas","spleen","thyroid"],"isolated":[],"hubs":[],"edges":[["adrenal","heart",-0.2],["adrenal","lungs",0.35],["adrenal","muscle",0.15],["marrow","intestine",0.28],["marrow","kidneys",-0.16],["marrow","pancreas",0.19],["heart","intestine",0.28],["heart","kidneys",0.24],["heart","lungs",0.69],["heart","muscle",0.15],["heart","spleen",-0.2],["heart","thyroid",-0.22],["intestine","kidneys",-0.21],["intestine","lungs",-0.36],["intestine","muscle",0.24],["intestine","spleen",0.17],["intestine","thyroid",0.19],["kidneys","liver",0.3],["kidneys","lungs",-0.27],["kidneys","pancreas",0.28],["kidneys","spleen",0.19],["liver","spleen",0.45],["lungs","spleen",0.27],["lungs","thyroid",0.38]],"layout":{"marrow":[0.187,0.131],"kidneys":[0.579,0.173],"pancreas":[0.925,0.059],"intestine":[0.248,0.373],"heart":[0.491,0.397],"spleen":[0.941,0.421],"lungs":[0.421,0.512],"liver":[0.824,0.56],"thyroid":[0.059,0.605],"adrenal":[0.344,0.837],"muscle":[0.728,0.928]},"computed":{"density":0.117,"disorder":0.171,"fitA":2.378,"strength":{"adrenal":0.7,"marrow":0.63,"heart":1.98,"intestine":1.73,"kidneys":1.65,"liver":0.75,"lungs":2.32,"muscle":0.54,"pancreas":0.47,"spleen":1.28,"thyroid":0.79},"hubs":["lungs"]},"exact":true},{"id":"A_low","title":"BMI healthy <= 24.4 kg/m2","n":241,"density":27,"organs":["muscle","thyroid","fat","pancreas","adrenal","brain","kidneys","liver","spleen","intestine","marrow"],"isolated":[],"hubs":[],"edges":[["muscle","thyroid",0.33],["muscle","fat",0.3],["muscle","adrenal",0.34],["muscle","kidneys",-0.26],["thyroid","fat",-0.36],["thyroid","pancreas",0.38],["thyroid","kidneys",0.33],["fat","pancreas",0.75],["fat","adrenal",-0.7],["fat","brain",-0.58],["fat","kidneys",0.52],["fat","liver",0.3],["fat","intestine",0.53],["pancreas","adrenal",0.62],["pancreas","intestine",-0.59],["pancreas","brain",0.5],["pancreas","kidneys",-0.34],["adrenal","brain",-0.61],["adrenal","intestine",0.4],["adrenal","liver",0.41],["adrenal","kidneys",0.51],["adrenal","marrow",0.29],["brain","kidneys",0.59],["brain","liver",0.46],["brain","intestine",0.52],["brain","marrow",0.39],["kidneys","liver",-0.35],["kidneys","marrow",-0.38],["kidneys","intestine",-0.33],["liver","spleen",0.45],["liver","intestine",-0.32],["spleen","marrow",0.38],["spleen","intestine",-0.29],["intestine","marrow",0.36]],"layout":{"muscle":[0.311,0.081],"thyroid":[0.786,0.147],"fat":[0.392,0.328],"pancreas":[0.142,0.403],"adrenal":[0.079,0.54],"brain":[0.317,0.511],"kidneys":[0.53,0.618],"liver":[0.865,0.542],"spleen":[0.921,0.74],"intestine":[0.234,0.769],"marrow":[0.459,0.919]},"computed":{"density":0.269,"disorder":0.115,"fitA":4.5,"strength":{"muscle":1.23,"thyroid":1.4,"fat":4.04,"pancreas":3.18,"adrenal":3.88,"brain":3.65,"kidneys":3.61,"liver":2.29,"spleen":1.12,"intestine":3.34,"marrow":1.8},"hubs":[]},"fig":"3A"},{"id":"A_high","title":"BMI healthy > 24.4 kg/m2","n":241,"density":7,"organs":["muscle","thyroid","fat","pancreas","adrenal","brain","kidneys","liver","spleen","intestine","marrow"],"isolated":["thyroid"],"hubs":["brain"],"edges":[["muscle","fat",0.28],["muscle","brain",-0.34],["pancreas","adrenal",0.52],["pancreas","brain",0.55],["adrenal","brain",-0.43],["brain","kidneys",0.28],["pancreas","spleen",0.25],["kidneys","marrow",-0.26],["intestine","marrow",0.43],["liver","spleen",0.48]],"layout":{"muscle":[0.311,0.081],"thyroid":[0.786,0.147],"fat":[0.392,0.328],"pancreas":[0.142,0.403],"adrenal":[0.079,0.54],"brain":[0.317,0.511],"kidneys":[0.53,0.618],"liver":[0.865,0.542],"spleen":[0.921,0.74],"intestine":[0.234,0.769],"marrow":[0.459,0.919]},"computed":{"density":0.069,"disorder":0.2,"fitA":1.559,"strength":{"muscle":0.62,"thyroid":0,"fat":0.28,"pancreas":1.32,"adrenal":0.95,"brain":1.6,"kidneys":0.54,"liver":0.48,"spleen":0.73,"intestine":0.43,"marrow":0.69},"hubs":["brain"]},"fig":"3A"},{"id":"B_low","title":"low tumor load","n":417,"density":18,"organs":["spleen","liver","thyroid","fat","pancreas","kidneys","muscle","heart","brain","adrenal","intestine"],"isolated":[],"hubs":[],"edges":[["spleen","intestine",0.22],["spleen","kidneys",0.24],["liver","thyroid",0.45],["liver","fat",0.27],["liver","brain",0.29],["liver","heart",-0.27],["liver","kidneys",-0.23],["thyroid","fat",-0.43],["thyroid","kidneys",0.3],["thyroid","muscle",0.3],["thyroid","heart",0.42],["thyroid","brain",-0.23],["fat","pancreas",0.4],["fat","kidneys",0.27],["fat","heart",0.24],["fat","muscle",0.44],["fat","brain",-0.41],["pancreas","intestine",0.27],["kidneys","heart",-0.34],["kidneys","brain",0.44],["kidneys","muscle",-0.24],["kidneys","adrenal",-0.24],["muscle","brain",0.42],["muscle","intestine",0.21],["muscle","adrenal",-0.21],["heart","brain",0.47],["heart","adrenal",-0.35],["heart","intestine",0.27],["brain","adrenal",0.53],["brain","intestine",-0.25],["adrenal","intestine",0.32]],"layout":{"spleen":[0.709,0.085],"liver":[0.333,0.242],"thyroid":[0.084,0.311],"fat":[0.54,0.386],"pancreas":[0.916,0.439],"kidneys":[0.281,0.486],"muscle":[0.495,0.514],"heart":[0.104,0.652],"brain":[0.378,0.646],"adrenal":[0.344,0.915],"intestine":[0.726,0.841]},"computed":{"density":0.181,"disorder":0.116,"fitA":3.047,"strength":{"spleen":0.46,"liver":1.51,"thyroid":2.13,"fat":2.46,"pancreas":0.67,"kidneys":2.3,"muscle":1.82,"heart":2.36,"brain":3.04,"adrenal":1.65,"intestine":1.54},"hubs":[]},"fig":"3B"},{"id":"B_high","title":"high tumor load","n":417,"density":8,"organs":["spleen","liver","thyroid","fat","pancreas","kidneys","muscle","heart","brain","adrenal","intestine"],"isolated":["thyroid"],"hubs":["muscle"],"edges":[["spleen","liver",0.3],["spleen","muscle",0.26],["spleen","fat",-0.18],["liver","fat",-0.3],["liver","kidneys",0.32],["liver","muscle",0.36],["fat","pancreas",0.21],["fat","muscle",0.46],["fat","brain",-0.24],["pancreas","kidneys",0.22],["kidneys","muscle",-0.23],["kidneys","heart",0.21],["kidneys","brain",0.29],["kidneys","intestine",0.2],["muscle","brain",0.35],["muscle","adrenal",0.23]],"layout":{"spleen":[0.709,0.085],"liver":[0.333,0.242],"thyroid":[0.084,0.311],"fat":[0.54,0.386],"pancreas":[0.916,0.439],"kidneys":[0.281,0.486],"muscle":[0.495,0.514],"heart":[0.104,0.652],"brain":[0.378,0.646],"adrenal":[0.344,0.915],"intestine":[0.726,0.841]},"computed":{"density":0.079,"disorder":0.228,"fitA":1.986,"strength":{"spleen":0.74,"liver":1.28,"thyroid":0,"fat":1.39,"pancreas":0.43,"kidneys":1.47,"muscle":1.89,"heart":0.21,"brain":0.88,"adrenal":0.23,"intestine":0.2},"hubs":["muscle"]},"fig":"3B"},{"id":"C_low","title":"Lower Tertile: CRP < 0.11 mg/dl","n":658,"density":11,"organs":["liver","spleen","kidneys","heart","muscle","thyroid","adrenal","fat","pancreas","marrow","intestine"],"isolated":[],"hubs":[],"edges":[["liver","spleen",0.37],["liver","kidneys",0.36],["liver","heart",-0.28],["kidneys","heart",0.32],["heart","thyroid",0.4],["kidneys","muscle",-0.29],["muscle","thyroid",0.4],["muscle","adrenal",0.27],["muscle","fat",0.27],["kidneys","fat",0.29],["kidneys","marrow",-0.27],["spleen","pancreas",0.28],["spleen","marrow",0.25],["adrenal","fat",-0.37],["thyroid","fat",-0.42],["adrenal","pancreas",0.33],["fat","pancreas",0.51],["marrow","intestine",0.41]],"layout":{"liver":[0.375,0.101],"spleen":[0.228,0.216],"kidneys":[0.636,0.249],"heart":[0.902,0.196],"muscle":[0.452,0.385],"thyroid":[0.781,0.52],"adrenal":[0.098,0.608],"fat":[0.497,0.61],"pancreas":[0.32,0.726],"marrow":[0.557,0.899],"intestine":[0.776,0.861]},"computed":{"density":0.111,"disorder":0.096,"fitA":1.705,"strength":{"liver":1.01,"spleen":0.9,"kidneys":1.53,"heart":1,"muscle":1.23,"thyroid":1.22,"adrenal":0.97,"fat":1.86,"pancreas":1.12,"marrow":0.93,"intestine":0.41},"hubs":["fat"]},"fig":"3C"},{"id":"C_mid","title":"Middle Tertile: CRP 0.11 - 0.74 mg/dl","n":658,"density":7,"organs":["liver","spleen","kidneys","heart","muscle","thyroid","adrenal","fat","pancreas","marrow","intestine"],"isolated":["heart","adrenal"],"hubs":[],"edges":[["liver","spleen",0.58],["liver","fat",-0.33],["kidneys","pancreas",0.34],["kidneys","fat",0.28],["muscle","thyroid",0.28],["thyroid","fat",-0.41],["fat","pancreas",0.4],["fat","intestine",0.46],["marrow","intestine",0.48],["muscle","marrow",0.31]],"layout":{"liver":[0.375,0.101],"spleen":[0.228,0.216],"kidneys":[0.636,0.249],"heart":[0.902,0.196],"muscle":[0.452,0.385],"thyroid":[0.781,0.52],"adrenal":[0.098,0.608],"fat":[0.497,0.61],"pancreas":[0.32,0.726],"marrow":[0.557,0.899],"intestine":[0.776,0.861]},"computed":{"density":0.07,"disorder":0.2,"fitA":1.578,"strength":{"liver":0.91,"spleen":0.58,"kidneys":0.62,"heart":0,"muscle":0.59,"thyroid":0.69,"adrenal":0,"fat":1.88,"pancreas":0.74,"marrow":0.79,"intestine":0.94},"hubs":["fat"]},"fig":"3C"},{"id":"C_high","title":"Upper Tertile: CRP 0.74 - 40.1 mg/dl","n":658,"density":3,"organs":["liver","spleen","kidneys","heart","muscle","thyroid","adrenal","fat","pancreas","marrow","intestine"],"isolated":["kidneys","heart","thyroid","adrenal","intestine"],"hubs":["muscle"],"edges":[["liver","spleen",0.34],["liver","muscle",0.33],["spleen","muscle",0.28],["muscle","fat",0.27],["fat","pancreas",0.21],["pancreas","marrow",0.21]],"layout":{"liver":[0.375,0.101],"spleen":[0.228,0.216],"kidneys":[0.636,0.249],"heart":[0.902,0.196],"muscle":[0.452,0.385],"thyroid":[0.781,0.52],"adrenal":[0.098,0.608],"fat":[0.497,0.61],"pancreas":[0.32,0.726],"marrow":[0.557,0.899],"intestine":[0.776,0.861]},"computed":{"density":0.03,"disorder":0.301,"fitA":0.943,"strength":{"liver":0.67,"spleen":0.62,"kidneys":0,"heart":0,"muscle":0.88,"thyroid":0,"adrenal":0,"fat":0.48,"pancreas":0.42,"marrow":0.21,"intestine":0},"hubs":["muscle"]},"fig":"3C"},{"id":"FDG_healthy","title":"FDG (N = 241)","n":241,"density":9,"organs":["adrenal","fat","intestine","liver","lungs","muscle","pancreas","spleen","thyroid"],"isolated":[],"hubs":[],"edges":[["liver","spleen",0.47],["fat","pancreas",0.44],["fat","muscle",0.28],["fat","thyroid",-0.28],["adrenal","pancreas",0.27],["intestine","liver",-0.27],["liver","lungs",-0.27],["pancreas","thyroid",0.26],["lungs","muscle",0.25],["muscle","thyroid",0.23],["fat","spleen",0.22]],"layout":{"intestine":[0.342,0.086],"fat":[0.737,0.143],"lungs":[0.085,0.277],"adrenal":[0.469,0.311],"spleen":[0.2,0.574],"liver":[0.517,0.596],"muscle":[0.915,0.565],"pancreas":[0.244,0.884],"thyroid":[0.531,0.914]},"computed":{"density":0.09,"disorder":0.156,"fitA":1.247,"strength":{"adrenal":0.27,"fat":1.22,"intestine":0.27,"liver":1.01,"lungs":0.52,"muscle":0.76,"pancreas":0.97,"spleen":0.69,"thyroid":0.77},"hubs":[]},"fig":"4"},{"id":"HK2","title":"Hexokinase 2 (N = 946)","n":946,"density":7,"organs":["adrenal","fat","intestine","liver","lungs","muscle","pancreas","spleen","thyroid"],"isolated":[],"hubs":[],"edges":[["intestine","muscle",0.2],["liver","spleen",0.17],["intestine","lungs",0.17],["spleen","thyroid",0.17],["fat","liver",0.17],["fat","pancreas",0.17],["adrenal","pancreas",0.16],["adrenal","muscle",0.16],["adrenal","liver",0.15],["pancreas","thyroid",0.13],["intestine","liver",-0.13],["liver","thyroid",-0.13],["lungs","thyroid",0.13],["adrenal","intestine",0.13],["fat","muscle",0.12],["muscle","spleen",0.12],["intestine","thyroid",-0.11]],"layout":{"intestine":[0.342,0.086],"fat":[0.737,0.143],"lungs":[0.085,0.277],"adrenal":[0.469,0.311],"spleen":[0.2,0.574],"liver":[0.517,0.596],"muscle":[0.915,0.565],"pancreas":[0.244,0.884],"thyroid":[0.531,0.914]},"computed":{"density":0.07,"disorder":0.093,"fitA":0.79,"strength":{"adrenal":0.6,"fat":0.46,"intestine":0.74,"liver":0.75,"lungs":0.3,"muscle":0.6,"pancreas":0.46,"spleen":0.46,"thyroid":0.67},"hubs":[]},"fig":"4"},{"id":"GLUT","title":"Cumulated GLUT1 – GLUT4 (N = 946)","n":946,"density":16,"organs":["adrenal","fat","intestine","liver","lungs","muscle","pancreas","spleen","thyroid"],"isolated":[],"hubs":[],"edges":[["spleen","thyroid",0.61],["fat","pancreas",0.41],["intestine","lungs",0.4],["adrenal","thyroid",0.38],["fat","intestine",0.35],["liver","thyroid",0.33],["liver","spleen",-0.3],["lungs","pancreas",0.27],["fat","lungs",-0.23],["adrenal","lungs",0.21],["lungs","spleen",-0.21],["fat","spleen",-0.21],["lungs","thyroid",0.21],["intestine","pancreas",-0.2],["liver","muscle",-0.2],["intestine","spleen",0.2],["liver","pancreas",-0.2],["fat","thyroid",0.18],["adrenal","spleen",-0.17],["adrenal","fat",0.17],["intestine","liver",-0.14],["pancreas","spleen",0.12],["adrenal","pancreas",-0.1]],"layout":{"intestine":[0.342,0.086],"fat":[0.737,0.143],"lungs":[0.085,0.277],"adrenal":[0.469,0.311],"spleen":[0.2,0.574],"liver":[0.517,0.596],"muscle":[0.915,0.565],"pancreas":[0.244,0.884],"thyroid":[0.531,0.914]},"computed":{"density":0.161,"disorder":0.112,"fitA":1.944,"strength":{"adrenal":1.03,"fat":1.55,"intestine":1.29,"liver":1.17,"lungs":1.53,"muscle":0.2,"pancreas":1.3,"spleen":1.82,"thyroid":1.71},"hubs":[]},"fig":"4"},{"id":"dose_standard","title":"Standard dose (21 people)","fig":"2B","n":21,"density":20,"organs":["heart","spleen","pancreas","kidneys","brain","adrenal","liver","thyroid"],"isolated":[],"hubs":[],"edges":[["heart","pancreas",-0.22],["heart","kidneys",0.21],["heart","adrenal",0.22],["spleen","pancreas",0.48],["spleen","kidneys",0.47],["spleen","adrenal",-0.41],["pancreas","adrenal",0.62],["pancreas","thyroid",-0.2],["pancreas","liver",-0.24],["kidneys","brain",0.41],["kidneys","adrenal",0.21],["kidneys","liver",0.37],["kidneys","thyroid",0.38],["adrenal","liver",0.3],["adrenal","thyroid",0.34],["liver","thyroid",-0.56]],"layout":{"heart":[0.333,0.059],"spleen":[0.753,0.111],"pancreas":[0.371,0.371],"kidneys":[0.669,0.525],"brain":[0.059,0.64],"adrenal":[0.445,0.703],"liver":[0.941,0.755],"thyroid":[0.707,0.941]},"computed":{"density":0.201,"disorder":0.155,"fitA":2.295,"strength":{"heart":0.65,"spleen":1.36,"pancreas":1.76,"kidneys":2.05,"brain":0.41,"adrenal":2.1,"liver":1.47,"thyroid":1.48},"hubs":[]},"approx":true},{"id":"dose_ultralow","title":"Ultra low dose (21 people)","fig":"2B","n":21,"density":24,"organs":["heart","spleen","pancreas","kidneys","brain","adrenal","liver","thyroid"],"isolated":[],"hubs":[],"edges":[["heart","spleen",0.4],["heart","pancreas",-0.43],["heart","kidneys",0.49],["heart","adrenal",0.51],["heart","liver",-0.22],["spleen","pancreas",0.35],["spleen","kidneys",-0.3],["spleen","liver",0.21],["pancreas","brain",0.47],["pancreas","adrenal",0.53],["kidneys","brain",0.34],["kidneys","liver",0.29],["kidneys","thyroid",0.36],["brain","adrenal",-0.43],["adrenal","liver",0.47],["adrenal","thyroid",0.45],["liver","thyroid",-0.48]],"layout":{"heart":[0.333,0.059],"spleen":[0.753,0.111],"pancreas":[0.371,0.371],"kidneys":[0.669,0.525],"brain":[0.059,0.64],"adrenal":[0.445,0.703],"liver":[0.941,0.755],"thyroid":[0.707,0.941]},"computed":{"density":0.24,"disorder":0.099,"fitA":2.315,"strength":{"heart":2.05,"spleen":1.26,"pancreas":1.78,"kidneys":1.78,"brain":1.24,"adrenal":2.39,"liver":1.67,"thyroid":1.29},"hubs":["adrenal"]},"approx":true},{"id":"dose_virtual","title":"Virtual ultra low dose (21 people)","fig":"2B","n":21,"density":23,"organs":["heart","spleen","pancreas","kidneys","brain","adrenal","liver","thyroid"],"isolated":[],"hubs":[],"edges":[["heart","spleen",0.36],["heart","pancreas",-0.27],["heart","brain",0.36],["spleen","pancreas",0.37],["spleen","kidneys",0.24],["spleen","thyroid",-0.26],["pancreas","kidneys",0.28],["pancreas","brain",0.25],["pancreas","adrenal",0.5],["pancreas","thyroid",-0.27],["pancreas","liver",-0.2],["kidneys","brain",0.36],["kidneys","adrenal",-0.24],["kidneys","liver",0.4],["kidneys","thyroid",0.56],["brain","adrenal",-0.23],["adrenal","liver",0.39],["adrenal","thyroid",0.48],["liver","thyroid",-0.45]],"layout":{"heart":[0.333,0.059],"spleen":[0.753,0.111],"pancreas":[0.371,0.371],"kidneys":[0.669,0.525],"brain":[0.059,0.64],"adrenal":[0.445,0.703],"liver":[0.941,0.755],"thyroid":[0.707,0.941]},"computed":{"density":0.231,"disorder":0.109,"fitA":2.296,"strength":{"heart":0.99,"spleen":1.23,"pancreas":2.14,"kidneys":2.08,"brain":1.2,"adrenal":1.84,"liver":1.44,"thyroid":2.02},"hubs":[]},"approx":true}],"table2":[{"what":"Test-retest","cohort":"2 scans within 6 weeks, no intervention","part":"test","groups":[{"label":"first scan","n":47,"density":14,"disorder":0.06},{"label":"second scan","n":47,"density":16,"disorder":0.04}],"pD":"p = 0.12","pO":"p = 0.2","sigD":false,"sigO":false},{"what":"Cold exposure","cohort":"2 scans within 2 weeks, cold exposure at the second","part":"test","groups":[{"label":"first scan","n":63,"density":7,"disorder":0.15},{"label":"second scan","n":63,"density":8,"disorder":0.2}],"pD":"p = 0.3","pO":"p = 0.2","sigD":false,"sigO":false},{"what":"Dose","cohort":"2 consecutive scans, 3 doses","part":"test","groups":[{"label":"standard dose","n":21,"density":20,"disorder":0.09},{"label":"ultra-low dose","n":21,"density":24,"disorder":0.07},{"label":"virtual low dose","n":21,"density":23,"disorder":0.08}],"pD":"all p > 0.5","pO":"all p > 0.2","sigD":false,"sigO":false},{"what":"Blood pool","cohort":"full cohort, normalised to","part":"test","groups":[{"label":"aorta","n":658,"density":12,"disorder":0.17},{"label":"vena cava","n":658,"density":12,"disorder":0.21}],"pD":"p = 0.97","pO":"p = 0.97","sigD":false,"sigO":false},{"what":"Scanner","cohort":"2 PET/CT systems","part":"test","groups":[{"label":"Biograph TruePoint 64","n":61,"density":8,"disorder":0.17},{"label":"Biograph Vision","n":61,"density":11,"disorder":0.15}],"pD":"p = 0.3","pO":"p = 0.4","sigD":false,"sigO":false},{"what":"Sex","cohort":"55 people each, matched health","part":"test","groups":[{"label":"male","n":55,"density":27,"disorder":0.21},{"label":"female","n":55,"density":21,"disorder":0.29}],"pD":"p = 0.4","pO":"p = 0.4","sigD":false,"sigO":false},{"what":"Age","cohort":"full cohort, split at the median","part":"test","groups":[{"label":"under 56 years","n":302,"density":17,"disorder":0.13},{"label":"56 or older","n":283,"density":13,"disorder":0.16}],"pD":"p = 0.8","pO":"p = 1.0","sigD":false,"sigO":false},{"what":"Cancer","cohort":"full cohort","part":"health","groups":[{"label":"healthy","n":241,"density":30,"disorder":0.19},{"label":"cancer","n":417,"density":7,"disorder":0.29}],"pD":"p < 0.001","pO":"p = 0.014","sigD":true,"sigO":true},{"what":"BMI","cohort":"full cohort, split at the median","part":"health","groups":[{"label":"BMI under 25.3","n":303,"density":33,"disorder":0.14},{"label":"BMI 25.3 or more","n":303,"density":14,"disorder":0.27}],"pD":"p = 0.024","pO":"p = 0.04","sigD":true,"sigO":true},{"what":"BMI","cohort":"healthy people, split at the median","part":"health","groups":[{"label":"BMI under 24.4","n":94,"density":27,"disorder":0.13},{"label":"BMI 24.4 or more","n":95,"density":7,"disorder":0.17}],"pD":"p < 0.001","pO":"p = 0.02","sigD":true,"sigO":true},{"what":"BMI","cohort":"people with cancer, split at the median","part":"health","groups":[{"label":"BMI under 26.0","n":203,"density":15,"disorder":0.18},{"label":"BMI 26.0 or more","n":214,"density":11,"disorder":0.2}],"pD":"p = 0.3","pO":"p = 0.4","sigD":false,"sigO":false},{"what":"Leukocytes","cohort":"full cohort, split at the median","part":"health","groups":[{"label":"under 7.9 × 10⁹/L","n":117,"density":10,"disorder":0.12},{"label":"7.9 × 10⁹/L or more","n":118,"density":6,"disorder":0.16}],"pD":"p = 0.12","pO":"p = 0.12","sigD":false,"sigO":false,"note":"As printed in Table 2; the paper's text gives p = 0.012 for this split."},{"what":"Leukocytes","cohort":"healthy people, split at the median","part":"health","groups":[{"label":"under 6.5 × 10⁹/L","n":36,"density":5,"disorder":0.09},{"label":"6.5 × 10⁹/L or more","n":37,"density":3,"disorder":0.17}],"pD":"p = 0.3","pO":"p = 0.07","sigD":false,"sigO":false},{"what":"Leukocytes","cohort":"people with cancer, split at the median","part":"health","groups":[{"label":"under 9.3 × 10⁹/L","n":63,"density":11,"disorder":0.12},{"label":"9.3 × 10⁹/L or more","n":63,"density":6,"disorder":0.21}],"pD":"p = 0.03","pO":"p = 0.07","sigD":true,"sigO":false},{"what":"CRP","cohort":"full cohort, split at the median","part":"health","groups":[{"label":"under 0.5 mg/dL","n":190,"density":12,"disorder":0.11},{"label":"0.5 mg/dL or more","n":115,"density":6,"disorder":0.19}],"pD":"p = 0.018","pO":"p = 0.018","sigD":true,"sigO":true},{"what":"CRP","cohort":"healthy people, split at the median","part":"health","groups":[{"label":"under 0.08 mg/dL","n":75,"density":10,"disorder":0.11},{"label":"0.08 mg/dL or more","n":69,"density":10,"disorder":0.12}],"pD":"p = 0.9","pO":"p = 0.8","sigD":false,"sigO":false},{"what":"CRP","cohort":"people with cancer, split at the median","part":"health","groups":[{"label":"under 1.25 mg/dL","n":81,"density":6,"disorder":0.23},{"label":"1.25 mg/dL or more","n":80,"density":3,"disorder":0.43}],"pD":"p = 0.16","pO":"p = 0.2","sigD":false,"sigO":false},{"what":"CRP","cohort":"full cohort, in thirds","part":"health","groups":[{"label":"under 0.11 mg/dL","n":95,"density":11,"disorder":0.1},{"label":"0.11 to 0.74 mg/dL","n":108,"density":7,"disorder":0.17},{"label":"0.74 to 40.1 mg/dL","n":102,"density":3,"disorder":0.27}],"pD":"p = 0.02, then p = 0.09","pO":"p = 0.01, then p = 0.13","sigD":true,"sigO":true},{"what":"Blood glucose","cohort":"full cohort, split at the median","part":"health","groups":[{"label":"under 93 mg/dL","n":104,"density":16,"disorder":0.12},{"label":"93 mg/dL or more","n":114,"density":8,"disorder":0.14}],"pD":"p = 0.025","pO":"p = 0.08","sigD":true,"sigO":false},{"what":"Norepinephrine","cohort":"healthy people, split at the median","part":"health","groups":[{"label":"under 270 ng/L","n":20,"density":14,"disorder":0.11},{"label":"270 ng/L or more","n":20,"density":4,"disorder":0.21}],"pD":"p = 0.04","pO":"p = 0.12","sigD":true,"sigO":false},{"what":"Tumour load","cohort":"people with cancer, split at the median TLG","part":"health","groups":[{"label":"TLG under 23","n":174,"density":18,"disorder":0.17},{"label":"TLG 23 or more","n":174,"density":8,"disorder":0.3}],"pD":"p = 0.028","pO":"p = 0.04","sigD":true,"sigO":true},{"what":"Tumour stage","cohort":"people with cancer","part":"health","groups":[{"label":"stage below III","n":99,"density":20,"disorder":0.16},{"label":"stage IV","n":98,"density":13,"disorder":0.19}],"pD":"p = 0.1","pO":"p = 0.2","sigD":false,"sigO":false},{"what":"Survival","cohort":"people with cancer, split at the median","part":"health","groups":[{"label":"under 34 months","n":208,"density":23,"disorder":0.14},{"label":"34 months or more","n":208,"density":7,"disorder":0.23}],"pD":"p < 0.001","pO":"p = 0.005","sigD":true,"sigO":true,"note":"As printed in Table 2: here the shorter survivors' network is the denser one, unlike the paper's other results; the paper does not discuss it."}],"table3":[{"name":"FDG (the 241 scans of healthy volunteers)","kind":"fdg","density":9,"p":"","r":null,"similar":""},{"name":"Glucose-6-phosphatase 2 (G6PC2)","kind":"metabolism","density":9,"p":"p = 1.0","r":-0.2,"similar":"very different"},{"name":"Glucose-6-phosphatase 3 (G6PC3)","kind":"metabolism","density":12,"p":"p = 0.9","r":-0.1,"similar":"very different"},{"name":"Glucose-6-phosphate dehydrogenase (G6PD)","kind":"metabolism","density":11,"p":"p = 1.0","r":0,"similar":"very different"},{"name":"Glucose transporters GLUT1 to 4 (together)","kind":"metabolism","density":16,"p":"p = 0.1","r":-0.1,"similar":"very different"},{"name":"Glucose-6-phosphate isomerase (GPI)","kind":"metabolism","density":12,"p":"p = 0.8","r":-0.1,"similar":"very different"},{"name":"Hexose-6-phosphate dehydrogenase (H6PD)","kind":"metabolism","density":13,"p":"p = 1.0","r":-0.4,"similar":"very different"},{"name":"Hexokinase 2 (HK2)","kind":"metabolism","density":7,"p":"p = 1.0","r":0.42,"similar":"similar (p = 0.01)"},{"name":"Glucose-6-phosphate exchanger 1 (SLC37A1)","kind":"metabolism","density":7,"p":"p = 1.0","r":0,"similar":"very different"},{"name":"Glucose-6-phosphate exchanger 2 (SLC37A2)","kind":"metabolism","density":8,"p":"p = 0.8","r":-0.2,"similar":"very different"},{"name":"Glucose-6-phosphate exchanger 4 (SLC37A4)","kind":"metabolism","density":12,"p":"p = 0.7","r":-0.1,"similar":"very different"},{"name":"Interleukin-6 (IL-6)","kind":"inflammation","density":14,"p":"p = 0.12","r":0.1,"similar":"very different"},{"name":"Interleukin-1β (IL-1β)","kind":"inflammation","density":13,"p":"p = 0.15","r":0.22,"similar":"very different"},{"name":"Tumour necrosis factor α (TNF-α)","kind":"inflammation","density":10,"p":"p = 0.8","r":0.2,"similar":"very different"},{"name":"C-reactive protein (CRP)","kind":"inflammation","density":10,"p":"p = 0.4","r":0,"similar":"very different"},{"name":"COX4I1","kind":"ageing","density":7,"p":"p = 0.8","r":-0.1,"similar":"very different"},{"name":"CDKN1A","kind":"ageing","density":18,"p":"p = 0.004","r":-0.3,"similar":"very different"},{"name":"HSP90AA1","kind":"ageing","density":17,"p":"p = 0.06","r":0.1,"similar":"very different"},{"name":"EGR1","kind":"ageing","density":10,"p":"p = 0.5","r":0.22,"similar":"very different"}],"strength":{"high":{"disorder":0.09,"bars":[{"organ":"fat","value":3.58},{"organ":"adrenal","value":2.88},{"organ":"muscle","value":2.8},{"organ":"pancreas","value":2.73},{"organ":"brain","value":2.58},{"organ":"marrow","value":2.54},{"organ":"thyroid","value":2.32},{"organ":"intestine","value":2.27},{"organ":"heart","value":2.2},{"organ":"kidneys","value":1.46},{"organ":"liver","value":1.39},{"organ":"spleen","value":0.99}],"fitFirst":3.65,"fitLast":1.31},"low":{"disorder":0.22,"bars":[{"organ":"muscle","value":1.5},{"organ":"fat","value":1.48},{"organ":"brain","value":1.06},{"organ":"kidneys","value":0.884},{"organ":"liver","value":0.84},{"organ":"spleen","value":0.833},{"organ":"pancreas","value":0.51},{"organ":"intestine","value":0.38},{"organ":"heart","value":0.35},{"organ":"adrenal","value":0.33},{"organ":"marrow","value":0.17},{"organ":"thyroid","value":0.13}],"fitFirst":1.8,"fitLast":0.167},"retest_a":{"disorder":0.04,"values":[1.77,1.75,1.6,1.46,1.395,1.36,1.35,1.33,1.29,1.284,1.06],"fitFirst":1.74,"fitLast":1.14},"retest_b":{"disorder":0.06,"values":[2.24,2.16,2.05,1.61,1.58,1.56,1.44,1.42,1.38,1.3,1.17],"fitFirst":2.17,"fitLast":1.17}},"synth":{"n":658,"organs":["adrenal","marrow","heart","intestine","kidneys","liver","lungs","muscle","pancreas","spleen","thyroid"],"shrink":1,"rows":[[1.4,1.2,2.24,1.17,2.13,1.51,0.63,0.52,1.05,1.45,1.15],[1.2,1.32,1.9,1.11,2.19,1.24,0.55,0.53,1.02,1.2,0.85],[0.72,1.38,1.59,1.1,1.81,1.49,0.46,0.55,1.07,1.16,0.82],[1.09,1.22,1.3,0.96,1.67,1.35,0.4,0.47,0.85,1.01,0.89],[1.21,0.76,2.07,1.31,1.76,1.36,0.48,0.44,1.18,0.62,0.45],[1.07,1.19,2.02,1.12,1.37,1.25,0.61,0.49,0.81,1.08,1.26],[0.89,1.29,2.31,1.01,2.16,1.6,0.6,0.52,0.92,1.23,0.95],[1.09,1.28,1.43,1.04,1.35,0.98,0.52,0.31,1.16,1.13,0.94],[1.23,1.36,2.42,1.01,1.85,1.53,0.64,0.47,0.96,1.03,1.05],[1.01,0.9,1.95,1.08,1.36,1.75,0.45,0.61,0.91,1.17,1.04],[1.3,1.51,1.31,1,1.56,1.99,0.4,0.53,0.8,1.33,0.4],[0.8,0.98,1.81,0.94,1.65,1.58,0.51,0.47,0.83,1.15,1.15],[1.42,1.2,1.43,1.16,1.09,1.56,0.49,0.56,0.89,1.12,0.64],[1.25,1.2,2.03,0.7,2.28,1.22,0.55,0.47,1.06,1.23,0.87],[1.28,1.12,1.47,1.04,1.97,1.73,0.49,0.46,1.17,1.2,0.94],[1.16,1.3,1.71,1,1.57,1.43,0.67,0.47,0.89,0.97,1.14],[1.25,1.5,2.12,0.9,1.78,1.35,0.6,0.38,0.93,1.1,0.91],[1.04,1.24,1.98,0.99,2.26,1.73,0.45,0.57,1.39,1.35,0.79],[1.14,1.31,2,1.02,1.62,1.42,0.56,0.48,0.79,1.43,0.81],[1.16,1.57,1.77,1.21,1.67,1.42,0.62,0.49,1.08,1.03,0.89],[1.16,1.43,1.79,1.32,1.31,1.24,0.59,0.37,0.97,0.95,0.92],[1.16,1.11,2.02,1.13,2.03,1.53,0.57,0.52,1,1.43,1],[1.28,1.59,1.14,0.98,1.11,1.05,0.54,0.43,0.69,1.12,0.82],[1.09,1.3,1.47,0.88,1.41,1.34,0.55,0.36,1.01,1.06,0.92],[1.46,1.35,1.79,1.29,1.42,1.22,0.44,0.47,1.26,0.97,0.76],[0.98,1.29,1.89,0.97,2.16,1.49,0.42,0.46,1,1.01,0.82],[0.94,1.18,2.59,0.7,2.01,1.24,0.73,0.36,1.11,1.04,0.85],[1.25,1.29,1.95,0.73,1.54,1.3,0.68,0.47,0.95,1.38,1.12],[1.36,1.43,1.55,0.89,1.53,1.33,0.5,0.31,0.86,1.01,0.72],[0.73,1.53,1.98,0.98,1.81,1.52,0.49,0.44,1.29,1,0.76],[1.17,1.48,1.8,1.05,1.78,1.22,0.6,0.45,1.09,1.1,0.94],[1.29,0.94,1.73,0.95,1.79,1.31,0.45,0.33,0.95,0.94,1.14],[0.57,0.81,1.68,0.92,1.57,1.27,0.38,0.35,0.61,0.6,0.94],[1.32,1.47,1.11,0.96,1.6,1.45,0.44,0.41,0.62,0.99,0.87],[0.86,1.61,1.79,1.27,1.41,1.22,0.49,0.62,0.61,1.08,0.89],[1.38,1.05,1.53,0.96,1.48,1.02,0.6,0.39,0.92,1.33,0.78],[1.26,1.12,1.43,0.9,1.74,1.34,0.47,0.44,0.85,1.33,0.87],[1.12,1.28,2.06,0.68,1.79,1.53,0.58,0.5,0.88,1.33,0.92],[1.41,0.97,2.44,0.86,2.63,1.48,0.75,0.57,0.92,1.75,1.54],[0.84,1.26,1.9,0.85,2.24,1.79,0.5,0.67,1.14,1.13,0.81],[1.1,1.23,2.04,1.29,1.15,1.65,0.57,0.54,1.03,1.22,0.73],[0.91,1.18,1.75,0.87,1.62,1.63,0.47,0.62,1.26,1.3,0.97],[0.89,0.92,1.95,1.23,1.75,1.52,0.43,0.55,1.22,1.21,0.84],[1.22,1.53,1.65,1.15,1.34,1.49,0.57,0.54,0.86,1.26,0.95],[1.03,1.43,2.11,1.02,2.41,1.67,0.59,0.66,1.13,1.39,1.01],[1.56,1.29,1.66,1,1.78,1.22,0.56,0.35,1.05,0.96,0.76],[1.45,1.08,1.16,1.02,1.72,1.52,0.41,0.27,0.74,1.22,0.69],[1.3,1.59,1.78,0.98,1.48,1,0.6,0.48,0.91,0.65,0.97],[1.38,1.34,1.92,1.02,1.67,1.13,0.6,0.53,0.87,1.15,0.85],[1.33,1.25,2.25,0.86,1.99,1.51,0.69,0.55,0.93,1.28,1.01],[1.26,1.45,1.68,1.03,1.8,1.32,0.47,0.46,1.3,1.14,0.7],[0.96,1.24,1.57,1.21,1.89,1.98,0.4,0.62,0.99,1.53,0.75],[1.04,1.75,2.09,1.02,1.32,1.24,0.63,0.43,0.94,1.09,0.84],[0.89,1.24,1.35,1.18,1.41,1.59,0.38,0.54,1.36,1.13,1.05],[1.4,1.57,1.5,1.2,2.18,1.23,0.42,0.49,1.14,1.09,0.81],[1.32,1.52,1.27,1.08,0.99,1.25,0.5,0.47,0.67,0.88,0.8],[1.08,0.88,1.75,0.78,1.85,1.09,0.45,0.55,1.22,1.15,0.59],[1.37,1,2.1,0.85,1.53,1.07,0.61,0.39,0.86,1,1.26],[1.21,1.06,1.82,1.28,1.34,2,0.4,0.81,1.09,1.3,0.82],[1.24,1.12,1.97,0.92,1.89,1.48,0.59,0.38,1.06,1.1,1.01],[1.18,1.43,1.54,1.07,1.56,1.35,0.48,0.34,1,1.03,1.1],[1.35,1.54,1.94,1.19,1.36,1.43,0.58,0.45,0.96,1.12,1.05],[1.1,1.42,1.31,1.22,2,1.04,0.42,0.36,1.06,1.13,0.93],[1.1,1.23,1.68,0.97,1.62,1.19,0.52,0.55,0.59,0.99,0.9],[0.81,1.29,2.2,0.97,1.9,1.42,0.63,0.37,1,1.24,1.13],[1.04,1.05,1.96,0.67,1.95,1.05,0.63,0.49,1.29,0.86,0.94],[1.08,1.42,2.08,1.03,1.61,1.26,0.6,0.5,0.95,0.93,0.88],[1.26,1.44,2.02,1.13,1.33,1.27,0.56,0.48,0.66,0.83,0.81],[1.01,1.24,1.8,0.86,1.76,1.32,0.57,0.29,1.15,1.21,0.79],[1.24,1.63,1.84,1.04,1.44,1.38,0.57,0.53,0.62,1.21,0.88],[1.25,1.05,1.82,0.76,1.74,1.28,0.58,0.46,0.6,1.2,0.98],[1.3,1.58,1.73,1.28,1.48,1.32,0.52,0.46,1.07,1.04,0.98],[1.32,1.54,1.41,1.24,1.58,1.17,0.44,0.29,1.13,0.9,0.72],[1.54,0.81,2.31,1.01,1.03,1.47,0.64,0.61,0.79,1.23,0.98],[1.54,1.27,2.64,0.96,2.25,1.33,0.72,0.51,0.86,1.12,0.74],[1.09,1.6,2.22,1.17,1.84,1.76,0.59,0.63,0.76,1.17,0.67],[1.3,1.17,2.02,1.04,1.83,1.66,0.44,0.42,0.87,1.12,0.94],[1.53,1.43,2.22,0.75,1.48,1.26,0.78,0.34,1.2,1.12,0.92],[1.04,1.52,1.45,0.89,1.15,1.3,0.48,0.44,0.81,0.88,0.73],[0.81,0.94,1.96,0.75,1.79,0.98,0.55,0.35,0.96,0.89,0.96],[1.34,1.36,0.97,1.21,1.49,1.22,0.38,0.4,1,0.79,0.73],[1.14,1.31,1.86,1.02,1.32,1.44,0.44,0.48,1.35,1.02,0.92],[1.43,1.23,2.16,0.84,1.41,0.85,0.67,0.37,0.89,1.14,1],[1.33,1.18,1.35,0.7,2.1,1.24,0.51,0.37,1.22,1.04,0.72],[0.98,1.38,2.23,1.17,1.5,1.53,0.52,0.66,0.93,0.98,0.83],[1.22,1.05,1.94,0.79,2.01,1.42,0.63,0.37,1.09,1.19,0.78],[1.1,1,1.96,0.65,1.57,1.17,0.59,0.42,0.92,1.03,1.03],[1.28,1.38,1.73,0.91,1.44,1.06,0.62,0.44,0.81,0.93,1.2],[0.79,1.22,1.66,1.03,1.48,1.6,0.43,0.52,1.07,1.17,0.99],[1.34,1.16,1.71,1.09,1.73,1.23,0.55,0.52,0.77,1.03,1],[0.94,1.4,1.87,1.26,2.04,2.21,0.47,0.56,1.12,1.54,0.76],[1.1,1.14,1.69,0.91,1.77,1.43,0.4,0.39,1.33,1.08,0.62],[1.67,1.32,1.98,1.22,1.1,1.52,0.6,0.53,1.26,1.28,1.13],[0.94,1.01,2.49,1.09,1.82,0.9,0.66,0.5,1.01,0.81,1.22],[1.24,1.59,1.8,0.94,1.15,1.13,0.6,0.43,0.95,0.93,1.12],[1.24,1.2,1.6,0.99,1.04,1.46,0.55,0.45,0.91,1.15,1.19],[0.84,1.31,1.97,1.2,1.7,1.83,0.47,0.67,1,1.51,0.85],[0.84,1.39,1.75,1.28,1.16,1.22,0.52,0.52,0.94,1.24,0.93],[1.13,0.85,1.32,1.01,1,1.12,0.57,0.32,0.72,1.03,0.97],[1.25,1.11,2.3,0.84,1.51,1.15,0.76,0.32,1,1.21,1.01],[1.05,1.15,1.78,1.37,1.67,1.65,0.39,0.56,1.08,1.07,1],[1.25,1.16,1.81,0.91,1.74,1.64,0.55,0.48,0.72,1.47,0.84],[1.38,1.25,1.12,0.95,1.42,1.1,0.45,0.31,0.73,1.04,0.79],[1.15,1.32,1.85,1.28,1.52,1.06,0.5,0.5,1.16,0.95,0.97],[1.43,1.88,1.4,1.01,1.25,1.32,0.59,0.4,0.73,1.1,1.13],[1.18,0.92,1.71,0.97,1.41,1.2,0.5,0.39,1.02,1.16,0.66],[1.08,1.43,1.6,0.89,1.9,1.62,0.48,0.48,0.64,1.25,1.01],[1.15,1.51,1.86,1.13,1.55,1.23,0.62,0.65,0.98,1.25,1.17],[1.41,1.23,1.65,0.69,1.68,1.29,0.47,0.44,1.04,0.78,0.8],[1.19,1.48,1.78,0.85,1.62,1.54,0.46,0.57,0.84,1.01,0.94],[1.39,1.23,1.78,0.99,1.89,0.97,0.62,0.62,0.75,1.09,0.98],[1.3,1.15,1.84,0.85,1.61,1.02,0.66,0.46,0.78,0.5,1.12],[1.37,0.82,2.54,1.09,2.59,1.27,0.6,0.53,1.25,1.14,0.98],[1.22,1.37,1.96,0.86,1.88,1.2,0.57,0.52,0.97,1.15,0.94],[1.34,0.9,1.6,0.63,1.97,1.15,0.56,0.41,1.11,1.07,0.76],[1.08,1.2,2.05,0.78,1.42,1.22,0.79,0.44,0.99,0.98,0.96],[1.46,1.36,1.5,1.15,1.19,0.95,0.61,0.41,0.74,0.45,1.07],[1.43,1.7,2.44,1.24,1.25,1.29,0.7,0.67,1.28,1.07,0.88],[1.65,1.43,1.5,0.91,1.54,1.48,0.55,0.49,0.9,1.29,0.88],[0.88,1.54,2.14,1.01,1.64,1.68,0.57,0.5,1.24,1.08,1.3],[1.09,1.5,2.37,1.06,1.85,1.71,0.51,0.55,0.84,1.06,0.65],[0.96,1.48,1.57,0.96,1.47,1.45,0.6,0.44,0.97,0.96,1],[1.46,1.74,1.69,1.16,1.13,1.49,0.52,0.47,0.87,1.19,0.73],[1.09,0.96,1.6,1.01,1.72,1.51,0.48,0.44,0.77,1.31,0.87],[1.22,1.47,1.8,0.89,1.85,1.11,0.72,0.59,0.83,1.16,1.3],[1.49,1.06,1.83,0.98,1.14,1.24,0.66,0.41,1,1.07,1.15],[1,1.26,1.58,0.76,0.74,1.22,0.57,0.36,0.83,1.11,0.85],[1.17,1.52,2.17,1.29,1.76,1.5,0.54,0.6,1,1.06,0.86],[1.11,1.63,2.06,1.21,1.8,1.65,0.47,0.46,0.8,1.3,0.65],[1.22,1.17,1.69,1.08,1.38,1.31,0.58,0.45,0.76,1.09,1.06],[1.25,1.36,1.51,0.83,1.76,1.7,0.43,0.48,0.71,1.12,0.8],[1.08,1.18,1.87,1.17,1.79,1.51,0.4,0.41,0.89,0.91,1.02],[1.06,1.28,1.84,0.9,1.46,1.89,0.56,0.7,0.94,1.46,0.96],[1.31,1.15,2.36,0.89,1.54,1.3,0.7,0.48,1.04,1.37,0.91],[1.25,1.46,2.21,0.94,1.57,1.33,0.66,0.55,0.91,0.97,0.97],[0.92,1.07,1.95,0.7,2.1,1.17,0.53,0.45,1.06,0.9,1.01],[1.33,0.81,2.31,0.6,1.59,1.12,0.57,0.35,1.09,0.62,0.89],[1.35,1.26,1.53,0.95,1.36,1.41,0.6,0.55,0.75,0.94,0.94],[1.49,1.49,1.45,1.02,1.18,1.63,0.52,0.42,0.97,0.93,1.03],[0.89,1.3,1.81,0.82,1.98,1.88,0.36,0.46,0.8,0.93,0.9],[1.37,1.03,1.9,0.89,1.95,1.13,0.63,0.55,0.98,0.68,1.07],[1.37,0.84,1.35,1.09,1,1.09,0.54,0.43,0.59,1.03,0.92],[1.46,1.14,2.23,1.05,1.34,0.81,0.66,0.6,1.1,0.94,1.03],[0.87,1.39,1.74,0.91,1.81,1.27,0.53,0.64,1.07,0.94,0.95],[1.04,1.17,1.67,1.14,1.25,1.17,0.61,0.57,0.97,0.92,0.89],[1.03,1.3,2.03,0.95,1.77,1.66,0.49,0.46,1.25,0.99,0.95],[1.43,1.32,1.9,1.05,1.73,1,0.63,0.43,0.94,0.95,0.55],[1.53,1.53,2.11,1.15,1.22,1.22,0.66,0.36,0.72,1.21,1.15],[0.99,1.75,1.84,1.19,1.8,1.57,0.53,0.52,0.91,1.29,1.07],[0.99,1.27,1.6,0.97,1.32,1.39,0.48,0.46,0.97,0.94,0.8],[1.56,1.63,2.13,1.14,1.61,1.23,0.67,0.41,1.05,1.09,1.02],[1.26,1.01,1.7,0.81,1.54,1.31,0.49,0.39,0.89,1.32,0.96],[0.9,1.48,2.06,0.91,1.65,1.33,0.54,0.65,1.05,1.36,0.9],[1.2,1.49,1.15,0.71,2.2,0.54,0.49,0.39,0.7,0.94,1.18],[0.72,1.41,1.76,1.16,1.96,1.54,0.41,0.45,1.12,1.36,0.55],[1.41,1.33,1.94,1.1,1.63,1.62,0.55,0.46,1.03,1.45,1.06],[1.22,1.44,1.7,0.83,1.83,1.38,0.5,0.43,1.01,1.37,1.21],[1.27,1.15,1.77,1.44,2.29,1.96,0.36,0.6,0.92,1.42,0.77],[1.32,1.29,1.46,1.07,1.16,1.09,0.55,0.47,0.71,1.12,0.79],[1.13,1.32,1.91,1.02,1.98,1.83,0.47,0.43,1.26,0.83,0.98],[1.53,1.33,1.77,0.95,1.08,1.38,0.68,0.45,0.77,1.13,0.94],[1.39,1.3,1.74,1.31,1.85,1.26,0.53,0.54,0.97,1.13,0.86],[1.3,1.09,1.89,0.88,1.54,1.32,0.71,0.42,0.8,0.86,1.11],[0.89,0.99,1.29,0.95,1.32,1.7,0.4,0.42,1.04,1.11,0.73],[0.79,1.52,1.58,1.24,1.84,1.47,0.37,0.4,0.7,1.34,1.11],[1.42,1.08,2.17,1.11,1.42,1.37,0.61,0.49,0.98,1.06,0.95],[1.22,1.27,1.53,0.77,2.28,1.59,0.47,0.45,1.26,1.39,1.16],[1.06,1.48,2.3,0.65,2.09,1.27,0.69,0.4,1.08,1.14,0.99],[1.7,1.2,2.14,1.12,1.75,1.03,0.62,0.52,0.98,1.19,1.4],[1.38,1.47,2.19,0.93,1.41,1.33,0.8,0.47,1.04,1.1,1.05],[1.44,1.12,1.83,0.97,1.52,1.2,0.7,0.53,0.95,1.06,1.17],[0.78,1.18,2.02,0.65,1.71,1.4,0.64,0.56,1.16,1.14,0.95],[1.26,1.05,1.41,0.82,1.31,1,0.52,0.51,0.81,1.12,0.97],[1.39,1.19,1.89,1.18,1.43,1.16,0.58,0.41,1.09,1.14,0.81],[1.37,1.22,1.4,0.74,1.15,1.24,0.63,0.45,0.58,1.03,1.01],[1.39,1.33,2.03,0.98,1.26,1.21,0.67,0.41,0.86,0.91,1.01],[1.51,1.47,2.33,1.33,1.5,1.61,0.6,0.62,1.14,0.91,1.2],[1.45,1.04,1.9,0.86,1.55,1.06,0.57,0.39,0.93,0.96,1.26],[1.54,1.22,1.67,1.21,1.34,1.47,0.55,0.39,0.97,0.92,1.03],[0.7,1.03,2.09,1.1,1.86,1.26,0.56,0.55,0.75,0.89,0.99],[1.3,1.13,2.28,0.81,1.58,1.65,0.7,0.57,0.84,1.13,1.16],[0.99,1.08,1.42,0.88,1.27,0.92,0.47,0.39,1.01,1.03,1.12],[0.98,1.19,1.72,0.77,1.71,1.23,0.58,0.49,1.04,1.1,1.18],[0.82,1.46,2.15,1.25,1.96,1.6,0.54,0.63,1,1.05,0.97],[1.23,1.77,1.41,0.75,1.73,1.01,0.49,0.33,0.77,0.99,1.14],[1.17,1.5,1.46,0.8,1.28,1.43,0.47,0.37,0.78,0.84,0.87],[1.35,1.06,2.15,0.92,1.64,1.48,0.57,0.38,0.84,1.43,1.36],[0.95,1.42,1.79,1.19,1.92,1.46,0.39,0.4,1.24,1.3,0.35],[0.9,1.17,2.1,0.92,1.66,1.83,0.61,0.58,1.16,1.3,1.05],[1.04,1.35,2.11,1.1,1.84,1.11,0.61,0.5,1.15,1.18,1.14],[1.22,1.66,1.6,1.31,1.35,1.48,0.45,0.48,0.71,0.93,0.88],[0.9,1.07,2.01,1.09,1.91,1.77,0.55,0.54,0.69,1.46,1.1],[1.1,1.49,2.08,1.17,1.78,1.64,0.57,0.52,0.94,0.97,1.04],[1.35,1.26,2.21,1.08,1.76,1.31,0.63,0.59,1.13,1.17,0.98],[1.37,1.52,1.58,0.91,1.3,1.01,0.51,0.49,0.8,1.06,1.04],[1.19,1.4,1.94,0.78,1.64,1.51,0.59,0.47,1.01,0.98,1.14],[0.93,1.37,1.67,0.94,1.88,1.66,0.46,0.51,0.79,1.39,0.8],[1.2,1.4,2.12,0.85,1.76,1.19,0.71,0.52,0.92,1.2,1.09],[1.21,1.36,1.52,0.71,1.46,1.25,0.58,0.37,0.67,1.24,1.05],[1.15,1.33,1.84,0.86,1.95,1.08,0.54,0.32,0.95,0.94,0.66],[0.93,1.16,1.87,1.02,1.71,1.04,0.52,0.59,0.99,0.9,1],[1.19,1.51,1.99,0.82,1.94,1.62,0.63,0.57,0.95,1.4,1.02],[0.82,1.28,1.61,0.96,1.45,1.39,0.49,0.4,0.96,1.15,1.14],[1.08,1.28,1.59,1.08,1.28,1.18,0.46,0.47,0.82,1.04,0.96],[1.61,1.07,2.3,0.85,1.34,1.38,0.69,0.51,0.85,1.03,1.22],[1,1.27,1.69,0.87,2.17,1.43,0.61,0.49,1.04,0.84,1.22],[0.82,1.57,2.33,1.32,1.86,1.57,0.48,0.52,1.23,1.22,1.09],[1.28,0.99,1.62,0.67,1.9,1.39,0.48,0.39,1,1.03,0.76],[1.14,1.02,1.3,1.05,1.56,1.42,0.54,0.51,0.72,1.3,1.14],[1.23,1.17,1.77,1.22,1.37,1.23,0.54,0.52,0.88,0.96,0.64],[1.15,1.25,1.55,1.18,2.09,1.11,0.52,0.46,1.16,1.43,1.15],[1.18,1.49,2.19,1.22,1.48,1.41,0.59,0.55,1.04,0.98,0.82],[1.15,1.21,1.59,0.82,1.51,1.08,0.55,0.44,0.9,1,0.97],[1.37,1.5,1.99,1.15,1.69,1.11,0.69,0.37,0.67,0.9,1.02],[1.26,1.33,1.97,0.97,1.39,1.39,0.61,0.4,1.03,1.08,0.94],[1.04,1.34,2.34,1.27,1.42,1.32,0.65,0.62,0.77,1.18,0.92],[1.14,1.69,1.46,1.19,1.7,1.1,0.55,0.38,0.9,1.32,0.77],[1.45,1.21,1.85,1.15,1.63,1.56,0.52,0.47,1.33,1.13,1.14],[1.43,1.14,1.32,0.42,1.14,0.86,0.61,0.4,0.69,0.92,1.12],[1.14,1.4,1.87,1.14,1.2,1.49,0.53,0.52,1.01,1.35,1.15],[0.85,0.93,1.82,0.99,1.15,1.22,0.58,0.39,1.11,1,1.14],[1.31,1.27,1.37,1.07,1.69,1.45,0.6,0.38,0.93,1.17,0.96],[1.13,1.3,1.82,1.02,1.85,1.47,0.56,0.54,1.14,1.18,1.07],[1.36,1.01,2.11,1.05,1.59,1,0.59,0.41,0.87,0.85,1.17],[1.27,1.06,1.4,1.06,1.59,1.05,0.45,0.36,0.99,1.16,1.03],[1.11,1.37,1.97,1.28,1.4,1.24,0.56,0.51,0.82,0.78,0.85],[1.15,1.57,1.65,1.04,1.44,1.23,0.55,0.38,0.69,0.95,0.71],[1.07,1.31,2.01,1.06,1.75,1.24,0.54,0.55,0.83,1.03,1.07],[1.09,1.06,2.11,0.53,1.53,1.06,0.67,0.45,0.97,1.14,0.72],[1.39,1.34,1.42,0.98,0.89,1.43,0.45,0.46,0.85,1.13,0.65],[1.14,1.74,2.01,1.3,1.61,1.49,0.58,0.63,0.93,1.03,1.36],[1.29,1.55,2.08,1.24,1.78,1.41,0.6,0.39,1.14,1.15,0.97],[1.48,0.92,1.7,0.78,2.08,1.13,0.53,0.4,0.91,1.02,0.83],[1.04,1.24,2.19,0.95,1.77,1.46,0.46,0.53,1.01,1.39,0.95],[1.15,1.36,1.48,1.13,1.41,1.29,0.45,0.42,0.9,0.86,0.81],[1.29,1.57,1.17,1.3,1.38,1.65,0.34,0.44,0.88,0.89,0.92],[1.25,1.2,1.87,0.92,1.6,1.25,0.59,0.43,0.97,1.12,0.58],[1.41,1.74,1.49,1.32,1.22,1.66,0.48,0.54,0.91,1.13,1],[1.04,1.25,2.07,1.14,2.04,1.92,0.48,0.62,0.97,1.02,0.87],[1.49,1.63,1.74,0.88,1.65,0.98,0.57,0.54,0.86,0.63,1.09],[1.26,1.35,2.14,0.77,1.73,1.65,0.69,0.58,1.03,1.1,1.09],[0.94,1.35,2.06,0.99,1.54,1.29,0.63,0.48,1.15,1.03,0.91],[1.02,1.37,1.7,0.92,1.84,1.14,0.47,0.38,1.34,0.98,0.81],[1.28,1.45,1.53,0.87,2.07,1.38,0.46,0.48,0.87,0.89,0.8],[1.42,0.86,2.57,0.9,1.6,1.45,0.74,0.41,1.05,1.13,1.08],[1.09,1.6,2.04,0.86,1.93,1.36,0.56,0.58,1.02,0.88,1.16],[0.72,1.25,1.58,0.7,1.26,1.3,0.52,0.33,1.09,0.86,0.9],[1.14,1.17,1.79,1.31,1.47,1.25,0.43,0.57,0.88,1.28,0.88],[1.14,0.98,2.14,0.89,1.26,1.21,0.62,0.42,0.9,1.32,1.02],[1.24,1.21,2.02,0.95,1.57,1.15,0.45,0.34,1.19,1.06,0.69],[1.21,0.92,1.77,0.93,1.14,1.01,0.53,0.39,1.07,0.63,1.09],[1.07,0.94,2.28,0.93,2.41,1.85,0.49,0.63,1.14,1.29,1.11],[1.04,1.08,2.17,1.07,1.4,1.41,0.62,0.63,0.98,1.2,0.98],[1.59,1.19,1.49,0.88,1.79,1.19,0.62,0.34,0.66,1.24,0.9],[1.6,1.28,1.65,0.64,1.57,1.23,0.62,0.43,0.86,1.22,0.71],[1.03,1.39,1.39,0.94,1.61,1.27,0.47,0.37,0.92,1,0.79],[1.02,1.17,2.13,1.04,1.67,1.75,0.57,0.62,1.19,1.35,1.05],[1.68,1.06,1.33,1.34,1.26,1.28,0.59,0.58,1,1.08,1.03],[0.87,1.27,1.93,1.16,1.54,1.24,0.69,0.42,0.74,1.01,1.18],[1.39,1.39,1.85,1.07,1.42,1.44,0.66,0.52,0.78,1.3,1.08],[1.55,1.31,2.08,1.03,2.03,1.38,0.7,0.55,0.9,1.74,1.1],[1.54,1.52,2.14,1.04,1.63,1.67,0.68,0.53,1.01,1.35,1],[1.09,1.36,1.59,0.89,1.31,1.29,0.5,0.43,0.94,1.11,0.99],[1.34,1.5,1.37,0.95,1.35,0.86,0.62,0.44,1.03,0.95,0.9],[1.21,1.4,1.82,1,1.24,1.13,0.62,0.5,0.94,1.11,1.19],[1.78,1.16,2.15,1.25,1.29,1.54,0.75,0.63,0.8,1.49,1.17],[1.29,1.42,1.97,0.9,1.94,1.72,0.63,0.68,1.12,1.52,1.08],[1.05,1.29,1.8,0.94,1.08,1.19,0.51,0.49,0.85,1.05,0.66],[1.26,1.12,1.39,0.96,1.61,1.72,0.48,0.51,0.92,1.45,0.9],[0.97,0.9,1.84,1.23,1.56,1.48,0.47,0.64,1.18,1.26,0.78],[1.28,1.42,2.57,1.39,1.67,1.16,0.8,0.55,1.36,1.09,1.08],[1.04,1.57,2.12,1,1.68,1.62,0.58,0.37,1.22,1.04,0.84],[1.29,1.25,2.25,0.97,1.56,1.72,0.66,0.6,0.63,1.25,0.73],[1.28,1.01,1.38,0.77,1.82,1.63,0.46,0.57,0.83,1.14,0.87],[1.12,1.35,2.3,0.85,1.82,1.34,0.66,0.47,1,1.36,0.96],[0.87,1.25,1.73,1.03,1.98,1.69,0.41,0.42,0.86,1.19,0.64],[1.17,1.62,1.81,1.28,1.91,1.63,0.4,0.61,1.2,1.14,0.66],[1.22,1.61,1.89,1.42,1.8,1.78,0.47,0.54,1.15,1.22,1.17],[1.6,1.4,0.85,0.77,1.56,1.33,0.51,0.26,0.63,1.09,0.94],[1.18,1.78,1.78,0.89,1.7,1.54,0.57,0.54,0.84,0.95,1.11],[1.23,1.37,2.1,0.9,1.86,1.41,0.5,0.51,1.04,1.18,0.87],[1.46,1.33,1.92,0.93,1.9,1.23,0.54,0.42,1.13,1.12,0.72],[0.95,1.12,1.54,1.07,1.53,1.81,0.45,0.6,0.9,1.41,0.97],[1.05,0.97,1.72,0.9,1.61,1,0.57,0.43,0.96,0.99,1.17],[0.99,1.34,1.39,1.06,1.96,1.39,0.43,0.39,0.77,0.99,0.87],[1.2,1.5,2.06,1.29,1.37,1.43,0.62,0.47,1.16,1.17,0.98],[1.2,0.98,2.04,1.06,2.08,1.84,0.49,0.63,1.07,1.24,0.94],[1.25,1.18,2.05,0.94,1.68,1.03,0.68,0.31,0.82,0.94,1.18],[1.19,1.08,1.83,0.92,1.99,1.24,0.65,0.49,1.12,1.09,1.03],[1.57,1.23,2.05,1.02,1.48,1.34,0.49,0.46,1.2,0.97,0.85],[1.23,1.3,1.4,0.83,1.79,1.55,0.35,0.37,1.07,1.45,0.77],[1.47,0.9,1.84,1.03,1.76,1.63,0.57,0.57,1.12,1.11,1.19],[1.31,1.11,1.83,1.16,2.34,1.4,0.55,0.66,0.82,1.35,0.67],[1.42,1.71,1.8,0.99,1.88,1.55,0.66,0.38,1.25,1.29,0.96],[0.77,1.93,2.02,1.24,1.17,1.39,0.57,0.62,1,1.04,1.06],[1.01,1,2.31,0.91,1.67,1.51,0.59,0.56,0.98,1.23,1.13],[1.14,0.9,2.43,0.99,2.12,1.25,0.62,0.43,0.91,1.02,0.67],[0.43,1.49,1.72,0.97,1.25,1.15,0.49,0.41,0.78,0.78,0.91],[0.64,1.53,1.67,0.96,1.1,1.81,0.56,0.61,0.74,1.13,0.92],[1.43,1.46,1.61,1.03,1.56,1.11,0.43,0.34,0.93,0.89,0.66],[1.44,1.49,1.49,0.97,1.64,1.17,0.5,0.55,0.98,1.21,0.99],[1.23,1.14,2.26,1.34,2.03,1.65,0.51,0.56,1.05,1.1,1],[1.12,1.49,1.8,1.06,1.61,1.08,0.66,0.44,0.81,1.04,0.95],[0.78,1.26,1.58,0.78,1.52,1.55,0.51,0.53,0.89,1.06,0.93],[0.89,0.96,2,0.97,1.71,1.42,0.67,0.46,0.78,1.09,1.05],[0.9,1.63,1.63,1.04,1.34,1.53,0.48,0.62,0.79,1.32,0.88],[0.87,1.39,1.6,1.07,1.41,1.39,0.47,0.56,0.88,0.99,0.95],[1.29,0.86,1.84,0.69,1.59,1.31,0.62,0.3,0.98,0.99,1.02],[1.26,0.76,1.91,0.97,1.33,1.07,0.61,0.47,1.07,0.94,1.09],[1.46,1.02,2.05,0.76,2.09,0.74,0.66,0.4,0.78,0.96,1.03],[1,1.45,1.83,1.01,1.55,1.09,0.59,0.38,0.89,1.15,1],[1.36,1.24,1.37,0.68,0.99,1.01,0.46,0.32,0.98,0.7,0.83],[1.23,1.08,2.26,0.81,1.68,0.93,0.63,0.47,1.18,0.68,1.2],[1.04,1.45,2.32,0.82,1.85,1.06,0.67,0.45,1.21,1.18,1.31],[1.08,1.58,2.07,1.46,1.24,1.62,0.49,0.44,1.05,0.91,1.03],[1.11,1.23,2.08,1.04,1.6,1.29,0.58,0.51,0.97,1.2,0.92],[1.33,1.41,1.97,1.27,1.82,1.87,0.52,0.49,0.97,1.19,0.81],[1.18,1.06,1.92,1.04,2.11,1.45,0.53,0.51,1.04,0.88,0.85],[1.09,1.51,2.11,1.1,1.72,1.67,0.5,0.56,1.36,1.05,0.93],[1.04,1.47,1.31,0.79,1.85,1.21,0.53,0.32,0.72,1.23,0.86],[1.3,1.72,1.59,1.17,1.89,1.68,0.48,0.56,1.32,1.41,0.89],[1.44,1.71,1.95,1.17,1.32,1.15,0.68,0.46,0.88,1.2,0.99],[1.18,1.35,1.89,1,1.72,1.2,0.57,0.44,1.01,1.02,0.98],[0.83,1.22,1.62,1.15,1.86,1.31,0.38,0.38,0.88,0.82,0.7],[1.19,1.31,1.85,1.01,2.04,1.43,0.6,0.54,1.21,1.32,0.88],[1.1,1.17,1.93,1,1.92,1.36,0.57,0.39,0.9,1.36,1.26],[1,1.22,2.07,1.03,1.46,1.47,0.53,0.51,0.83,1.01,1.07],[1.21,0.93,2.13,0.8,1.39,1.63,0.69,0.5,1,1.17,0.92],[1.31,1.17,1.51,1.05,1.52,1.11,0.49,0.32,0.83,0.97,1.23],[1.08,1.38,1.13,0.97,1.62,1.4,0.3,0.39,1.18,1.13,0.66],[1.13,1.23,2.1,0.74,1.93,1.46,0.67,0.52,0.83,1.03,0.93],[1.12,1.31,2.38,1.14,1.68,1.33,0.69,0.5,1.42,1.34,1.19],[0.66,1.46,1.37,1.11,1.74,1.16,0.31,0.54,0.8,0.88,0.81],[1.31,1.16,1.73,1.1,1.57,1.61,0.41,0.44,1.12,1.02,0.65],[1.3,1.25,1.64,0.87,1.84,1.45,0.57,0.49,1.27,1.2,1.18],[1.1,1.42,1.94,1.07,1.88,1.43,0.59,0.44,0.91,1.37,0.86],[0.98,1.48,1.61,1.15,1.61,1.38,0.48,0.4,0.81,1.23,1.35],[1.43,1.79,1.79,1.27,1.36,1.2,0.58,0.29,1.1,0.73,0.97],[1.15,1.11,1.99,0.82,1.49,1.41,0.57,0.4,0.47,0.79,0.9],[1.43,0.95,1.46,0.92,1.46,1.04,0.45,0.43,0.94,0.92,0.94],[0.96,1.18,1.66,1.02,1.6,1.31,0.57,0.54,0.97,1.29,1.1],[1.32,1.35,1.82,1.18,1.53,1.42,0.52,0.4,0.86,0.94,1.01],[1.31,1.36,2.06,0.94,1.57,1.66,0.65,0.55,0.93,1.53,0.91],[1.28,1.31,2.04,1.19,1.18,1.34,0.53,0.43,1.01,1.34,1.01],[1.41,0.98,2.01,0.92,1.83,1.28,0.69,0.46,0.86,1.22,0.9],[0.86,1.63,1.51,1.06,1.41,1.38,0.48,0.45,0.75,0.91,0.86],[1.15,1.02,1.93,0.77,1.86,1.62,0.59,0.37,1.15,1.01,0.9],[1.48,1.28,1.45,0.76,1.39,1.36,0.46,0.35,0.88,1.07,0.87],[1.18,1.85,1.48,0.94,1.51,1.28,0.57,0.33,0.73,0.9,0.96],[1.52,1.41,2.11,0.97,1.18,1.19,0.6,0.57,0.86,1.1,1.03],[0.86,1.75,1.9,1.32,1.51,1.22,0.54,0.57,0.84,1.2,0.98],[1.27,1.55,1.47,1.11,1.6,1.18,0.56,0.59,0.81,1.22,0.74],[1.23,1.78,1.58,1.25,1.4,1.34,0.46,0.5,0.98,1.01,1.02],[1.27,1.14,2.04,1.06,1.42,1.45,0.61,0.45,1.03,1.21,0.99],[1.36,1.38,1.93,0.87,1.34,1.34,0.7,0.56,0.89,1.02,1.18],[0.93,1.36,1.86,0.68,1.93,1.64,0.56,0.44,1.17,1.53,0.92],[1.23,1.3,1.79,0.84,1.69,1.15,0.54,0.47,1.01,1.14,0.95],[1.47,1.15,1.84,1.02,1.66,1.46,0.55,0.62,1.14,1.1,1.12],[1.23,1.38,1.73,0.91,1.94,1.37,0.41,0.28,0.93,1.04,0.58],[1.35,0.77,1.42,0.76,1.91,1.1,0.45,0.28,0.88,1.13,0.82],[1.35,1.2,1.81,0.64,1.89,1.59,0.49,0.39,1.11,1.23,0.92],[1.03,1.46,1.1,1.05,1.54,1.18,0.47,0.51,0.67,1.11,0.87],[1.03,1.24,2.15,0.92,1.27,1.82,0.55,0.64,1.01,1.32,0.86],[0.86,1.44,2.41,1.15,2.25,1.48,0.55,0.56,1.44,1.09,1.06],[1.2,1.44,2.07,0.98,1.82,1.42,0.63,0.59,0.97,1.24,0.99],[1.31,1.22,1.52,0.99,1.08,1.17,0.59,0.34,0.72,0.98,0.74],[0.65,1.25,1.61,0.86,1.62,1.29,0.51,0.39,1,1.07,0.8],[1.15,1.36,2.46,1.21,1.76,1.64,0.48,0.43,0.8,0.93,1.1],[1.3,1.13,1.68,1.08,1.32,1.28,0.65,0.41,0.93,0.93,0.93],[0.96,1.17,1.66,1.14,1.48,1.12,0.52,0.35,0.94,1.23,0.97],[1.13,1.24,2.12,0.95,1.42,1.09,0.75,0.45,0.85,1.25,1.06],[1.62,1.43,1.45,1,1.43,1.14,0.45,0.46,0.87,0.82,0.85],[1.22,1.06,1.92,1.06,1.76,1.52,0.61,0.58,0.68,1.27,0.8],[1.45,1.4,1.62,0.87,1.71,1.53,0.5,0.44,1.38,0.98,1.07],[1.52,1.53,1.8,1.06,1.47,1.24,0.71,0.62,1.02,1.24,0.96],[1.11,1.4,1.8,1.06,1.69,1.55,0.6,0.49,0.77,1.23,0.97],[1.28,1.33,1.52,0.45,1.46,1.02,0.62,0.37,0.7,1.04,1.1],[1.03,1.46,1.8,0.74,1.54,1.64,0.53,0.53,0.99,1.3,0.7],[0.93,1.79,1.77,1.23,2.36,1.83,0.35,0.63,1.17,1.09,0.6],[1.06,1.32,1.47,1.01,1.42,1.68,0.38,0.49,1.14,0.84,0.88],[1.2,1.26,1.7,0.79,1.34,1.4,0.55,0.4,0.76,1.02,0.85],[1.22,0.98,1.44,0.82,1.55,0.83,0.43,0.34,0.85,0.53,0.8],[1.16,1.57,1.59,0.76,1.67,1.41,0.55,0.42,1.1,0.84,0.64],[1.19,1.2,1.72,0.89,1.74,1.15,0.66,0.5,1.03,1.27,1.14],[1.06,1.26,1.03,1.13,1.58,1.23,0.31,0.5,1.06,0.44,0.62],[0.93,1.41,1.25,1.04,1.35,1.37,0.5,0.42,0.83,1.31,0.93],[1.11,1.3,1.81,1.23,1.68,1.89,0.43,0.62,1.03,1.5,0.82],[1.34,1.31,2.07,1.18,1.52,1.14,0.61,0.44,0.97,1.21,1.2],[0.72,1.31,1.93,1.15,2.08,1.77,0.5,0.52,1.04,0.98,0.89],[1.19,1.28,1.52,1.08,1.71,1.02,0.54,0.49,0.98,0.73,0.88],[1.19,1.47,2.63,1.14,1.7,1.39,0.72,0.51,1.04,1.14,0.87],[1.05,1.06,1.44,0.77,1.88,1.16,0.46,0.49,1.11,1.04,1.02],[1.48,1.33,1.39,0.74,1.45,1.14,0.5,0.48,0.87,0.73,0.88],[1.28,1.31,2.4,0.76,1.35,1.53,0.7,0.44,1.3,1.1,1.13],[1.25,1.4,1.41,1.04,1.71,1.8,0.47,0.53,0.8,1.31,0.84],[1.54,1.15,1.4,1.02,0.99,0.96,0.61,0.44,0.93,1.22,1.13],[1.01,1.03,1.33,0.74,1.6,0.87,0.5,0.42,1.19,0.72,0.84],[1.41,1.15,1.11,0.97,1.19,0.99,0.45,0.4,0.9,1.07,1.03],[1.23,1.31,2.03,0.95,0.8,1.1,0.7,0.29,1.1,0.9,1.27],[0.91,1.32,1.45,0.92,1.66,1.67,0.41,0.53,0.98,0.91,1.02],[1.15,1.03,2.24,1.05,2.22,1.52,0.52,0.53,0.99,1.21,1.12],[1.02,1.3,1.34,1.11,1.74,1.3,0.4,0.47,1.06,1.05,0.82],[0.94,1.6,1.51,1,1.42,1.46,0.42,0.6,1.04,1.17,0.73],[1.21,1.16,2.54,0.89,1.87,1.22,0.69,0.65,1.2,1.13,1.11],[1.19,0.85,1.92,0.61,1.25,1,0.61,0.35,1.07,0.88,1.15],[1.4,1.27,1.87,1.04,2,1.65,0.54,0.56,1.09,1.12,1.07],[0.92,1.87,1.56,0.97,1.45,0.92,0.58,0.49,1.06,0.88,0.69],[1.09,0.83,2.16,1.07,1.94,1.69,0.43,0.64,0.94,1.11,0.74],[1.05,1.22,1.29,1.12,1.41,1.26,0.43,0.63,0.84,1.14,0.95],[1.3,1.3,1.78,1.02,1.18,1.7,0.48,0.53,0.77,1.37,1.08],[1.41,1.44,1.73,0.77,1.42,1.36,0.59,0.43,1.12,1.04,1.04],[1.57,1.47,1.91,0.87,1.91,1.35,0.69,0.4,1.07,1.43,1.01],[1.07,1.18,2.25,1.09,1.48,1.19,0.71,0.58,0.92,1.18,1.18],[1.2,1.15,2.13,0.96,1.3,1.63,0.64,0.47,0.93,1.06,0.95],[1.1,1.36,1.89,0.87,1.42,1.03,0.57,0.43,1.06,0.9,0.89],[1.21,1.06,1.22,0.51,1.41,1.12,0.41,0.28,1.16,0.87,0.79],[1.13,1.6,1.91,1.3,1.3,1.28,0.53,0.5,0.89,1.05,1.1],[1.04,1.26,1.61,0.93,1.6,1.22,0.58,0.48,1.03,1.02,1.19],[1.39,1.25,2.03,1,1.57,1.4,0.52,0.46,1.03,1.09,0.96],[1.61,1.48,1.7,1.06,1.22,0.9,0.59,0.43,0.95,0.77,1.17],[1.49,1.17,1.4,0.91,1.91,1.51,0.47,0.39,0.9,1.15,0.71],[1,1.27,2.15,0.93,1.78,1.82,0.55,0.62,0.9,1.24,0.97],[1.03,0.98,1.69,1.06,1.38,1.6,0.4,0.39,0.83,1.27,1.08],[1.44,1.45,1.59,0.99,1.6,1.08,0.6,0.45,0.84,1.11,0.83],[0.96,1.21,1.42,1.12,1.93,1.77,0.31,0.47,1.08,1.11,0.61],[1.45,1.93,1.29,0.95,0.77,1.28,0.54,0.53,0.83,1,1.47],[0.94,1.15,1.91,0.94,1.8,1.56,0.5,0.3,1.11,1.02,0.75],[1.29,0.88,1.7,0.68,1.87,1.19,0.59,0.54,0.99,0.96,1.11],[1.55,0.96,2.15,0.99,1.54,1.24,0.69,0.44,1.06,1.23,1.07],[1.24,1.17,1.63,0.51,1.56,0.98,0.66,0.36,0.81,0.87,1.24],[1.36,1.27,1.74,1.07,1.96,1.72,0.32,0.58,0.96,1.29,0.71],[1.36,1.3,1.61,1.15,1.55,1.27,0.42,0.49,0.9,1.01,1.01],[1.39,1.39,1.72,0.79,1.74,0.86,0.64,0.28,1.17,0.81,1.22],[1.28,1.34,1.96,0.84,1.95,1.33,0.65,0.4,1.06,1.16,0.99],[0.88,1.37,1.52,1.08,1.4,1.17,0.51,0.46,0.69,1.29,1.23],[1.32,1.37,1.72,1.11,1.52,1.18,0.63,0.45,0.79,1.23,0.94],[0.55,1.18,1.57,1.16,2.09,1.38,0.4,0.51,0.95,0.85,0.83],[1.03,1.13,1.83,1.29,1.89,1.61,0.59,0.53,1.01,1.37,0.9],[1.49,1.17,2.03,0.9,1.43,1.4,0.71,0.5,0.9,1.4,1.13],[1.06,1.29,1.81,1.18,1.52,1.5,0.55,0.48,0.86,1.12,0.75],[0.87,1.15,1.1,1.17,1.83,1.44,0.31,0.42,1.01,1.55,0.62],[1.29,1.14,1.54,0.82,1.93,1.32,0.4,0.46,0.99,1,1.06],[1.37,1.2,2.7,1.32,1.64,1.75,0.63,0.64,1.03,0.96,0.93],[1.29,1.09,2.04,0.91,1.48,1.68,0.48,0.47,1.11,0.79,1.12],[1.27,1.25,2.23,0.85,1.76,1.44,0.67,0.47,0.79,1.28,1.5],[0.92,1.56,2.03,1.12,1.45,1.65,0.51,0.48,1.03,1.33,0.82],[1.54,0.99,1.98,0.7,2.11,1.46,0.56,0.56,1.03,1.34,0.96],[1.25,1.62,1.29,1.11,1.45,1.4,0.46,0.38,0.72,1.09,0.89],[1.06,1.04,1.79,0.82,1.83,0.97,0.67,0.33,0.81,1.11,0.97],[1.78,1.11,1.86,0.86,1.21,1.19,0.67,0.39,1.03,1.14,1.05],[1.34,1.47,1.86,1.31,2.01,1.08,0.6,0.56,1.19,1.14,1.08],[1,1.39,2.17,1.08,1.44,1.47,0.56,0.53,1.09,1.03,1.09],[1.35,1.06,2.2,1.12,1.14,1.39,0.71,0.52,0.86,1.3,1.02],[1.04,1.46,1.38,1.17,1.47,1.38,0.37,0.47,0.78,1.04,0.78],[1.4,1.15,1.8,1.17,1.35,1.73,0.42,0.55,1.07,1.11,0.97],[1.21,1.48,2.1,1.03,1.51,1.65,0.56,0.49,0.94,1.13,0.93],[0.99,0.8,0.85,0.68,1.8,1.41,0.32,0.42,0.87,0.87,0.81],[1.46,1.53,1.72,0.88,0.77,1.39,0.59,0.44,0.93,1.27,0.99],[1.15,1.35,1.99,0.89,1.69,1.32,0.67,0.51,0.9,1.23,1.05],[1.2,1.27,1.79,1.06,1.56,1.23,0.67,0.52,0.83,1,1.28],[1.31,1.31,1.95,1.09,1.41,1.3,0.47,0.43,1.04,1.12,0.63],[1.28,1.15,2.23,1.15,1.8,1.4,0.67,0.49,1.06,0.91,1.14],[1.15,1.15,2.45,1.12,1.53,1.21,0.58,0.54,0.93,1.32,1.14],[1.5,1.96,1.78,1.31,0.94,1.61,0.53,0.49,1.06,1.51,1],[0.98,1.52,1.86,0.91,1.47,1.25,0.62,0.57,0.99,1.22,1.22],[1.34,1.16,1.94,0.95,1.74,1.33,0.63,0.55,1,1.11,0.87],[1.08,1.26,2.07,1.1,1.43,1.23,0.57,0.47,0.82,1.17,1.17],[1.39,1.46,1.79,1.13,1.74,1.38,0.48,0.48,0.83,0.81,0.92],[1.11,1.21,2.31,1.01,1.54,1.7,0.61,0.57,1.03,1.19,1.17],[1.12,1.51,1.66,1.09,1.85,1.48,0.47,0.43,0.93,0.84,0.84],[1.43,0.99,2.07,1.11,1.72,1.42,0.54,0.55,1.31,1.4,0.51],[1.48,1.3,1.72,1.01,1.79,1.58,0.5,0.42,0.78,1.29,0.86],[1.32,1.15,2.05,0.97,1.66,1.19,0.66,0.53,0.74,0.69,1.1],[1.19,1.68,1.59,1.03,1.44,1.56,0.57,0.42,0.95,1.45,0.88],[1.37,1.33,2.01,1.03,1.58,1.38,0.62,0.49,1.08,1.02,1],[1.31,0.97,1.44,0.88,0.84,1.26,0.45,0.51,0.94,1.09,1.02],[0.83,1.56,1.86,1.1,1.21,1.15,0.58,0.45,1.16,1.14,0.99],[1.35,1.35,2.36,0.89,0.73,1.06,0.79,0.49,1.1,1.22,1.06],[0.91,1.1,2.65,0.91,2.18,1.65,0.6,0.53,1.18,1.21,1.09],[1.42,1.54,2.11,1.13,1.8,1.6,0.57,0.56,1.08,1.4,0.69],[1.17,0.96,1.81,0.96,1.92,0.98,0.68,0.55,0.75,0.88,0.9],[1.26,0.87,2.03,1.22,1.49,1.34,0.62,0.46,1.25,1.14,0.88],[0.91,1.02,1.79,1.04,1.69,1.63,0.56,0.44,0.69,1.3,0.89],[1.57,1.43,2.1,1.06,2.05,1.21,0.64,0.43,0.91,1,0.93],[1.35,0.98,1.58,1.11,1.52,1.34,0.52,0.53,1.01,1.04,0.84],[1.21,1.03,1.61,0.87,1.31,1.15,0.5,0.49,0.7,1.02,0.87],[1.25,1.33,2.03,1.06,2.36,1.67,0.48,0.52,0.92,1,1.02],[1.1,1.48,2.19,1.34,1.85,1.65,0.6,0.69,1.14,1.21,1],[1.27,1.45,1.53,1.17,1.09,1.58,0.47,0.54,0.7,0.8,0.68],[1.08,1.43,1.33,1.07,1.63,1.44,0.36,0.42,1,1.03,0.51],[1.46,1.28,1.93,1.01,1.56,1.65,0.61,0.41,1.07,1.31,1.08],[1.19,1.35,1.62,1.21,1.34,1.48,0.48,0.39,1.12,1.07,0.93],[1.47,1.69,1.79,1.07,2.05,1.69,0.56,0.46,0.94,1.38,0.88],[1.32,1.34,2.08,1.13,2.32,1.7,0.65,0.55,0.94,1.57,1.05],[1.19,1.16,2.04,1.13,2,1.52,0.61,0.45,1.03,1.27,1.17],[1.17,1.38,2.18,1.17,1.77,1.57,0.45,0.44,1.09,1.12,0.69],[0.98,1.68,1.84,1.05,1.55,0.86,0.61,0.52,1.04,0.93,0.99],[0.98,0.96,1.15,0.74,1.08,0.86,0.48,0.32,0.75,0.73,1.06],[1.53,1.68,1.99,1.02,1.27,1.42,0.63,0.5,1.02,1.4,0.89],[1.21,1.36,1.74,1.02,1.33,1.32,0.54,0.46,0.81,1.14,1.24],[1.35,1.69,1.88,0.9,1.29,0.99,0.66,0.38,0.97,1.35,0.96],[1.05,0.79,1.39,1.06,1.42,1.13,0.47,0.44,1.05,0.79,1.05],[1.41,1.62,1.99,1.01,1.79,1.54,0.62,0.6,0.76,1.39,0.99],[0.94,1.09,2.5,1.13,1.59,0.99,0.63,0.45,1.02,1.08,0.96],[1.51,1.32,1.21,0.85,1.93,1.64,0.46,0.42,0.82,1.34,0.95],[1.45,1.43,1.3,1.06,1.64,1.34,0.49,0.43,0.41,1.51,1.02],[1.37,1.62,1.84,0.87,1.8,1.29,0.63,0.33,0.93,0.81,1.11],[1.24,1.46,1.98,1.18,1.12,1.45,0.6,0.46,0.71,0.97,1.03],[1.42,1.28,2.05,0.93,1.36,1.28,0.68,0.45,0.94,1.11,1.27],[1.13,1.55,1.57,0.97,1.28,1.25,0.56,0.48,0.76,1.03,0.98],[1.2,1.12,1.59,0.98,1.41,1.17,0.59,0.41,0.73,1.23,0.92],[1.36,1.67,1.65,0.85,1.89,0.89,0.6,0.44,0.86,0.91,0.85],[0.83,1.22,1.59,1.04,1.44,1.69,0.37,0.56,0.97,1.23,0.99],[1.37,1.25,1.86,0.88,1.58,1,0.58,0.37,1.09,0.76,0.97],[0.99,1.32,2.8,1.11,1.67,1.68,0.67,0.69,1.06,1.27,1.21],[1.39,1.4,2.19,1.13,1.84,1.44,0.51,0.55,1.17,1.4,0.92],[1.11,1.18,1.81,0.98,1.54,1.29,0.59,0.44,1.09,1.08,1],[1.3,1.71,1.55,1.18,1.31,1.36,0.5,0.47,0.84,0.91,1.03],[1.19,1.37,2.21,1.11,1.43,1.73,0.62,0.52,1.23,1.31,0.97],[1.59,1.28,2.08,1.07,1.65,1.42,0.69,0.53,1.07,1.4,0.91],[1.37,0.93,1.69,0.69,1.59,0.87,0.71,0.33,0.88,1.36,1.19],[1.24,1.57,2.28,1.05,1.78,1.27,0.68,0.62,1.05,1.09,0.98],[1.38,1.34,2.13,0.82,1.56,1.05,0.74,0.51,1.04,1.22,1.26],[1.18,1.44,1.7,1.06,1.9,1.83,0.43,0.44,0.98,1.37,0.57],[1.29,1.35,1.81,0.64,1.72,1.35,0.5,0.45,1.01,0.99,0.88],[1.27,0.8,1.9,0.93,2.09,1.15,0.57,0.51,1.04,1.08,0.95],[1.17,1.32,2.19,1.13,1.89,1.56,0.62,0.52,1.09,1.24,1.08],[1.52,1.24,1.56,1.01,1.36,1.61,0.53,0.53,0.82,1.09,1.11],[1.36,1.15,1.64,0.73,1.65,0.68,0.67,0.34,1.1,0.77,1.1],[1.25,1.58,1.63,1.11,1.36,1.35,0.5,0.53,1.11,1.16,1.14],[0.98,1.06,2.34,0.76,1.24,1.68,0.65,0.59,0.93,1.2,0.72],[0.91,1.52,1.32,0.92,1.79,0.97,0.44,0.48,0.91,1.06,0.9],[1.55,1.58,2,0.91,1.54,1.35,0.67,0.52,1.02,1.33,1.12],[1.15,1.49,1.8,1.09,1.89,1.28,0.53,0.56,1.06,1.08,0.95],[1.18,1.02,1.97,0.91,1.61,1.34,0.46,0.49,0.96,1.13,0.88],[0.93,1.09,2,0.97,1.58,1.47,0.49,0.55,1.03,1.37,0.55],[1.11,0.91,2.18,0.69,1.71,1.42,0.64,0.51,0.97,1.2,1.07],[0.83,1.11,2.1,1.08,1.88,1.63,0.49,0.53,1.15,1,0.87],[1.52,1.23,1.52,0.79,1.74,1.02,0.51,0.38,1.04,1.01,1.03],[0.9,1.29,2.3,0.93,1.78,1.39,0.58,0.51,1.05,1,1.11],[1.31,1.04,2.05,0.97,1.53,1.24,0.58,0.38,0.9,0.98,0.97],[0.95,1.19,1.98,1.15,1.78,1.1,0.49,0.53,0.69,0.97,1.02],[1.27,1.12,1.77,1.13,1,0.93,0.57,0.35,1.09,1.17,0.77],[1.04,1.28,1.56,0.74,1.6,1.14,0.53,0.39,1.3,0.83,1.08],[1.65,1.08,1.29,1.03,1.87,1.16,0.54,0.54,1,0.88,0.97],[1.04,0.95,1.78,0.97,1.66,1.58,0.52,0.54,1.23,1.29,1.04],[1,1.34,2.06,1.06,1.79,1.7,0.49,0.51,0.83,1.14,0.94],[0.82,0.71,1.66,0.86,1.49,1.55,0.4,0.31,1.02,0.98,0.64],[1.31,1.1,1.98,0.51,1.75,1.12,0.6,0.41,0.88,0.95,1.26],[0.96,1.47,2.48,0.92,2.11,1.59,0.61,0.55,1.29,1.05,1.12],[1,1.36,1.81,1.23,1.61,1.31,0.49,0.54,0.97,0.9,0.9],[0.56,1.43,1.96,1.04,1.19,1.13,0.61,0.45,0.78,0.89,0.94],[0.81,0.97,2.11,1.27,2.26,1.59,0.54,0.51,1.23,1.25,0.99],[1.2,1.03,1.63,1.07,1.89,1.51,0.51,0.44,1.06,1.44,1.15],[1.07,1.65,1.62,1.14,2.23,1.7,0.38,0.46,1.27,1.26,0.67],[1.2,1.3,2.23,1.13,1.77,1.05,0.65,0.43,1.05,0.89,0.89],[1.07,1.32,2.02,1.14,1.85,1.49,0.47,0.46,1.15,1.23,0.73],[1.63,1.11,2.11,0.88,1.59,1.26,0.67,0.46,1.07,1.05,1],[1.6,1.32,1.62,1.06,1.75,1.44,0.45,0.49,1.21,1.09,1.17],[0.92,0.85,2.27,1.23,1.63,1.65,0.56,0.54,0.99,1.48,0.99],[1.18,1.59,1.7,1.16,1.4,1.38,0.54,0.55,0.89,1.46,0.71],[1.03,1.25,1.31,0.76,1.71,1.32,0.43,0.47,0.87,1.24,0.84],[1.36,1.34,2.06,0.95,1.59,1.33,0.6,0.47,0.97,1.3,1.14],[1.53,1.01,2.09,1.1,1.8,1.4,0.52,0.42,0.89,1.46,0.9],[1.01,1.37,1.52,1.07,1.64,1.65,0.35,0.4,0.88,0.65,0.82],[1.67,1.24,1.21,1.05,1.66,1.08,0.49,0.52,1.14,1.17,0.92],[1.16,1.27,2.02,0.9,1.62,1.15,0.64,0.55,0.81,1.28,1.21],[1.54,1.47,1.89,1.15,1.62,1.5,0.55,0.48,0.94,0.91,0.79],[1.47,1.4,1.77,1.18,1.55,1.71,0.49,0.41,0.73,1.26,1],[0.83,1.2,1.33,1.1,1.8,2.01,0.27,0.5,0.95,1.42,0.69],[1.14,0.76,1.89,1.19,1.76,1.36,0.43,0.51,0.97,0.83,0.73],[0.94,0.98,1.2,0.95,1.65,1.63,0.3,0.44,1.15,1.06,0.74],[1.09,1.18,1.94,0.85,1.51,1.04,0.61,0.4,0.99,1.02,0.91],[1.03,1.49,2.09,1.01,1.69,1.27,0.59,0.56,0.77,1.03,0.91],[1.18,1.53,2.05,1.52,1.57,1.07,0.65,0.67,1.04,1.15,0.94],[1,1.61,2.23,1.25,1.55,1.68,0.5,0.56,0.93,1.43,1.12],[1.65,1.62,2.45,1.09,1.78,1.49,0.81,0.37,0.89,1.5,0.96],[1.45,1.16,2.09,0.78,1.21,1.45,0.68,0.48,1.05,1.23,0.75],[1.44,1.45,1.35,1.15,1.48,1.12,0.45,0.46,1.04,1.07,0.89],[0.96,1.61,1.54,0.93,1.65,1.35,0.5,0.51,0.9,1.05,0.84],[1.1,1.77,1.43,0.94,1.77,1.5,0.45,0.44,0.76,0.69,0.8],[1.37,1.46,2.19,0.76,1.06,1.38,0.71,0.4,0.84,0.97,0.98],[1.22,1.01,2.23,0.97,2.24,1.29,0.55,0.47,1.04,0.94,0.83],[1.14,1.28,1.83,1.3,1.38,1.22,0.47,0.51,1.04,1.09,0.66],[1.37,1.11,1.88,1.04,1.49,1.73,0.47,0.5,0.96,1.16,0.98],[1.09,1.26,1.69,1.15,1.81,1.26,0.61,0.49,0.99,1.44,0.94],[1.05,1,2.01,1.1,1.76,1.85,0.57,0.59,0.89,1.22,1.01],[1.47,1.58,2.39,0.98,1.36,1.25,0.72,0.45,0.74,0.85,0.81],[1.1,1.51,2.12,1.21,1.36,1.34,0.54,0.55,1.06,1,1.05],[0.74,1.34,2.28,0.83,1.42,1.2,0.65,0.46,0.74,0.93,0.95],[1.03,1.35,1.52,1.04,1.21,1.12,0.59,0.45,0.8,0.85,0.98],[0.69,1.33,1.84,0.94,1.85,1.76,0.45,0.58,1,1.45,0.95],[1.61,1.14,1.69,0.71,1.81,1.51,0.58,0.51,1,1.26,0.97],[1.41,1.24,1.84,1.05,0.85,0.97,0.67,0.44,0.71,0.72,1.19],[1.59,1.29,1.94,1.11,1.45,1.52,0.43,0.58,0.84,1.04,0.93],[1,1.58,1.42,0.91,1.69,0.83,0.46,0.42,0.73,0.99,0.52],[1.32,1.23,1.8,0.72,1.82,1.03,0.58,0.49,1.04,1.01,0.88],[1.2,1.61,1.41,1.09,1.51,1.51,0.4,0.45,1.04,1.12,0.77],[1.29,1.29,2.1,0.92,2.39,1.29,0.59,0.47,1.07,1.03,1.24],[1.2,1.38,1.63,0.97,1.35,1.26,0.5,0.48,1,0.88,0.67],[1.37,1.35,1.93,1.03,1.76,1.66,0.61,0.53,0.85,1.3,0.94],[1.67,1.21,1.67,0.99,1.66,1.01,0.63,0.43,1,1.16,0.74],[1.46,1.07,2.04,0.93,1.66,1.15,0.63,0.39,1.07,1.22,0.96],[1.27,1.1,1.84,1.2,1.69,1.19,0.53,0.45,0.91,0.72,1.06],[1.36,1.53,1.79,1.22,1.47,1.11,0.55,0.42,1.06,1.07,0.88],[1.1,1.07,1.92,1.31,1.51,1.72,0.4,0.55,0.97,1.07,0.89],[1.44,1.6,1.6,0.86,1.57,1.03,0.64,0.28,1.01,1.22,1.04],[1.6,1.32,1.7,0.72,1.33,1.25,0.69,0.46,0.81,1.16,1.06],[0.99,1.38,1.65,1.19,1.78,1.36,0.52,0.44,1.2,1.13,0.99],[1.37,1.69,1.97,0.92,1.82,1.39,0.54,0.42,1,0.94,1.2],[1.29,1.04,2.12,1.34,1.77,1.48,0.54,0.56,0.91,1.03,1.08],[1.05,1.46,1.9,1.25,1.84,1.59,0.49,0.56,0.7,1.32,0.98],[0.92,1.81,1.93,1.2,1.98,1.91,0.42,0.68,1.23,1.51,0.94],[1.27,1.34,0.99,0.88,1.31,1.4,0.41,0.19,1.09,0.9,0.73],[1.33,1.22,2.18,1.07,1.95,2.21,0.45,0.71,1.14,1.47,0.75],[1.31,1.4,2.25,1.34,1.7,1.7,0.47,0.55,1.09,1.27,0.7],[1.17,1.52,1.64,1.1,1.59,1.59,0.63,0.47,0.7,1.23,1.21],[1.21,1.31,1.55,0.86,1.85,1.36,0.57,0.5,0.92,0.97,0.83],[1.27,1.48,1.71,1.02,1.57,1.2,0.52,0.4,0.71,1.12,0.81],[0.94,1.14,2,0.81,1.9,1.41,0.52,0.41,1.19,1.26,1.17],[0.9,1.51,1.41,1.22,1.51,1.52,0.47,0.35,1.36,1.13,0.9],[1.11,1.29,1.99,1.12,1.93,1.35,0.53,0.48,1.15,1.14,0.87],[0.81,1.33,1.86,1.1,1.76,1.58,0.54,0.53,1.05,1.29,0.88],[1.38,1.27,1.5,1.1,1.41,1.33,0.43,0.38,0.59,1.19,0.77],[1.06,1.05,1.94,0.89,1.56,1.31,0.52,0.45,1.14,1.01,0.7],[1.01,1.55,1.33,0.83,1.9,1.38,0.38,0.59,0.67,1.29,0.76],[1.14,1.69,1.55,1.01,1.52,1.36,0.62,0.35,0.57,1.09,0.9],[1.3,1.28,2.32,0.92,1.76,1.42,0.74,0.61,1.18,1.1,1.04],[0.75,1.3,1.7,0.96,0.88,0.99,0.63,0.36,1.07,1.02,1.19],[1.04,1.22,2.27,1.29,1.47,1.24,0.55,0.49,1.18,1.1,1.16],[0.88,1.51,1.84,1.22,1.97,1.81,0.46,0.56,1.22,1.3,0.87],[1.42,1.42,1.22,0.81,1.35,1,0.5,0.16,0.81,0.64,1.07],[1.07,1.02,1.73,1.06,1.77,1.59,0.37,0.45,0.99,1.29,0.78],[1.18,1.23,1.56,1.14,2.06,1.59,0.48,0.46,1.19,1.3,1.15],[0.98,1.06,1.9,1.3,1.61,1.31,0.43,0.64,0.97,1.36,0.86],[1.17,1.28,1.6,0.79,1.7,1.05,0.49,0.39,1.28,0.98,0.74],[0.91,1.32,1.97,0.8,1.52,1.33,0.47,0.59,1.02,1.45,1.07],[1.15,1.49,1.58,0.91,1.47,1.3,0.54,0.47,1.04,0.79,0.75],[1.19,1.1,1.93,0.72,2.17,1.09,0.63,0.5,0.92,1.01,0.92],[1.27,1.13,1.48,0.74,1.86,0.98,0.51,0.45,1.09,0.92,1.02],[1.03,1.47,1.44,1.15,1.5,0.84,0.49,0.31,0.9,0.96,0.63],[1.45,1.6,2.49,1.26,1.4,1.3,0.8,0.41,1.05,1.37,1.36],[0.75,1.46,1.95,1.12,2.12,1.86,0.41,0.61,0.79,1.32,0.79],[1.42,1.26,1.85,1.06,1.55,1.66,0.44,0.55,0.83,1.35,0.7],[0.98,1.03,1.43,0.87,2.02,1.64,0.36,0.53,0.98,1.27,0.75],[1.08,1.3,2.01,1.17,1.88,1.21,0.52,0.42,1.08,1.02,1.07],[1.11,1.23,2.21,0.83,1.6,1.58,0.64,0.37,1.1,1.39,1.01],[1.59,1.3,2.23,0.86,1.31,0.95,0.72,0.41,0.81,1.01,1.04],[1.62,1.45,1.77,1.04,1.24,1.1,0.71,0.36,0.97,1.07,1.11],[1.26,1.17,1.45,0.88,1.58,0.99,0.52,0.52,0.69,1.25,0.95],[1.06,1.66,2.32,1.31,1.97,1.7,0.47,0.69,0.97,1.52,0.72],[1.35,1.05,1.94,1.09,2.29,1.79,0.51,0.68,1.22,1.44,1.02],[1.04,1.6,2.14,1.16,1.87,1.57,0.52,0.36,0.97,1.03,0.9],[1.23,1.23,2.04,0.91,1.2,1.66,0.63,0.47,1.08,0.77,0.96],[1.23,1.49,1.73,0.84,1.18,1.12,0.7,0.39,0.84,0.97,1.1],[1.16,1.05,1.67,0.97,1.39,1.3,0.49,0.43,0.97,0.71,0.74],[1.12,0.86,1.59,0.78,1.24,1.44,0.46,0.38,1.06,0.98,1.37],[0.82,1.25,1.99,1.13,1.48,1.88,0.56,0.49,0.55,0.87,0.96]],"pcor":[[1,-0.05,-0.2,0.09,-0.02,0,0.33,-0.09,0.03,0.05,-0.03],[-0.05,1,-0.19,0.3,-0.03,0.09,0.19,0,-0.02,-0.02,-0.06],[-0.2,-0.19,1,0.26,0.24,0.3,0.7,0.17,0.24,-0.12,-0.03],[0.09,0.3,0.26,1,-0.19,0,-0.31,0.23,0.02,0.06,0],[-0.02,-0.03,0.24,-0.19,1,0.01,-0.22,0.07,0.16,0.16,-0.03],[0,0.09,0.3,0,0.01,1,-0.41,0.23,-0.01,0.4,-0.02],[0.33,0.19,0.7,-0.31,-0.22,-0.41,1,0,-0.14,0.21,0.3],[-0.09,0,0.17,0.23,0.07,0.23,0,1,-0.04,0.13,0.06],[0.03,-0.02,0.24,0.02,0.16,-0.01,-0.14,-0.04,1,0.01,0],[0.05,-0.02,-0.12,0.06,0.16,0.4,0.21,0.13,0.01,1,0],[-0.03,-0.06,-0.03,0,-0.03,-0.02,0.3,0.06,0,0,1]],"cor":[[1,0.01,0,-0.08,-0.14,-0.2,0.33,-0.15,-0.06,0.01,0.13],[0.01,1,-0.07,0.28,-0.11,0.07,0.01,0.07,-0.06,0.04,-0.04],[0,-0.07,1,0.13,0.21,0.18,0.57,0.34,0.25,0.19,0.25],[-0.08,0.28,0.13,1,-0.03,0.29,-0.2,0.34,0.08,0.15,-0.1],[-0.14,-0.11,0.21,-0.03,1,0.26,-0.13,0.19,0.26,0.22,-0.09],[-0.2,0.07,0.18,0.29,0.26,1,-0.31,0.44,0.14,0.44,-0.16],[0.33,0.01,0.57,-0.2,-0.13,-0.31,1,0.01,-0.03,0.06,0.46],[-0.15,0.07,0.34,0.34,0.19,0.44,0.01,1,0.11,0.33,0.04],[-0.06,-0.06,0.25,0.08,0.26,0.14,-0.03,0.11,1,0.08,-0.02],[0.01,0.04,0.19,0.15,0.22,0.44,0.06,0.33,0.08,1,0.02],[0.13,-0.04,0.25,-0.1,-0.09,-0.16,0.46,0.04,-0.02,0.02,1]],"pairs":[{"a":"liver","b":"spleen","paper":0.42,"r":0.44,"pr":0.4,"xy":[0.66,1.76,0.29,1.09,-0.45,0.49,-0.97,-0.14,0.59,0.29,0.02,0.06,0.02,-0.48,-0.18,-0.34,0.03,-2.43,-0.5,-2.51,-0.41,-0.11,-0.3,-0.06,1.04,0.65,0.47,0.18,-1.51,0.16,-0.64,0.82,0.76,-0.38,0.44,-0.62,1.66,0.37,0.71,0.23,2.63,1.16,2.02,1.04,0.95,0.25,0.91,0.42,0.88,0.09,0.74,0.05,-0.52,0.66,-0.89,0.34,1.55,0.5,1.61,0.31,0.33,-0.65,1.1,-0.74,0.02,0.01,0.14,0.13,1.57,1.27,0.35,0.65,0.29,1.64,0.07,1.6,0.28,-0.33,0.47,-0.63,-0.44,-0.77,0.12,-0.47,0.74,1.68,0.38,1.21,-1.25,0.12,-0.44,0.49,-0.04,-0.19,0.8,0.32,-0.53,-0.68,-1.16,-0.71,0.57,-0.44,-0.32,-0.6,-0.44,-0.32,-0.01,-0.21,-0.2,1.4,0.42,1.44,-0.06,-0.46,0.47,0.1,0.72,-0.52,0.21,-0.43,-0.54,-0.02,-0.32,-0.15,-0.18,-0.79,-0.07,-0.36,-0.34,-2.52,-0.47,-1.73,0.39,-0.57,0.73,-0.32,-0.52,-0.11,-1.45,-0.48,-1.35,1.16,-0.41,1.4,-0.04,1.15,0.08,1.26,0.74,1.18,0.5,1.09,0.55,3.28,0.5,2.22,1.81,0.16,0.62,-0.67,1.22,0.62,0.91,0.54,1.16,1.03,0.37,0.74,0.7,0.57,-0.28,0.33,0.6,0.82,0.59,0.64,1.33,1.48,0.32,0.37,-0.53,-0.72,0.01,-0.6,0.68,0.62,1.34,1.2,-1.45,-2.28,-1.26,-2.33,-0.89,0.25,-1.07,-0.1,0.65,0.93,0.51,0.35,-0.11,0.19,-0.52,0.08,2.58,2.17,1.43,1.61,-0.44,-0.07,-0.3,0.14,1,0.16,0.47,0.22,-0.51,-0.07,-1.22,-0.58,-0.43,-1.1,-0.05,-0.77,-1.07,0.25,-1.73,0.05,-1.14,-0.52,-0.73,-0.23,2.68,1.01,0.8,0.14,0.53,0,0.86,0.07,-0.01,-0.34,0.35,0.09,0.32,0.08,0.36,0.12,-1.26,0.15,-1.18,0.23,-0.68,-0.54,-1,-0.72,0.3,0.7,0.63,0.86,-1.23,-1.22,-1,-1.38,-0.35,-0.85,-0.55,-1,-0.34,-1.38,-0.61,-1.37,-0.13,0.55,0.61,1.07,0.11,0.56,-0.16,0.39,-0.29,0.5,-0.05,0.52,-0.13,-0.28,-0.26,-0.34,-0.72,-1.02,-0.43,-0.56,0.49,0.64,0.15,0.42,-0.1,0.1,-0.52,-0.67,1.68,0.35,0.64,-0.4,1.29,0.1,0.59,0.15,-0.37,0.09,0.83,0.35,-0.2,-1.12,-0.03,-0.66,-1.54,-1.08,-1.17,-0.61,-0.55,-1.55,-0.34,-1.27,0.38,-0.39,-0.23,-0.19,-2.07,0.21,-1.39,0.54,-0.46,-0.31,0.08,-0.22,0.73,-0.62,-0.64,-1.16,0.27,0.43,0.9,0.49,-0.74,-0.33,-0.37,-0.01,-1.2,-0.87,-0.62,-0.72,1.02,0.34,0.46,0.46,-0.51,-0.36,-0.58,-0.65,3.53,2.21,2.51,1.66,0.32,-0.09,-0.04,0.2,0.68,0.93,0.59,0.76,-1.87,-1.49,-2.06,-1.77,-0.93,-0.87,-0.49,-0.53,0.47,0.26,0.97,0.66,1.99,2.09,0.64,1.46,-0.52,0.71,-0.71,0.82,-0.93,-0.33,0.56,0.54,-0.81,0.56,0.39,0.97,1.25,-0.16,0.1,-0.46,1.18,1.86,1.11,1.79,-1.02,-0.3,-0.17,0.37,-1.21,-0.78,-1.62,-0.9,-0.1,0,0.69,0.29,-0.63,0.3,-0.33,0.74,1.13,0.76,0.85,0.67,-0.48,0.77,-0.89,0.11,-0.26,-1.6,-0.41,-1.42,0.79,-0.44,-0.05,-0.64,-1.54,-0.08,-1.75,-0.81,-1.34,-3.05,-0.66,-3.07,-0.33,0.22,-1.22,-0.69,-0.62,0.23,-0.96,-0.09,-0.84,-0.14,-0.26,-0.05,-0.52,-0.6,0.72,-0.47,-1.64,-3.31,-0.71,-3.05,-0.24,-0.14,-0.97,-0.88,0.54,0.98,0.72,0.82,1.37,-0.11,0.97,-0.18,1.5,-0.22,0.16,-0.63,0.42,-0.7,1.03,-0.52,0.58,0.47,0.41,0.57,0.65,1.07,0.7,1.2,-0.98,0.3,-0.59,-0.34,-0.44,-0.16,0.55,0.17,-0.55,0.07,0.43,1.06,0.6,-0.18,-0.53,-0.84,1.24,0.99,0.3,0.84,-0.16,-0.03,0.3,0.11,1.43,0.09,0.99,0.1,0.67,-0.96,-0.06,-0.81,2.21,1.83,1.47,1.28,-0.2,1.37,-0.01,1.27,-0.06,-0.65,-0.29,-0.98,-0.75,-1,-0.9,-1.02,-0.93,-2.44,-0.76,-1.93,0.24,-0.79,0.57,-0.94,1.15,-0.84,1.6,-0.51,2.16,-0.87,1.11,-0.78,-0.91,-2.1,-0.89,-2.61,-1.06,-0.37,-0.2,0.1,-2.22,-0.8,-2.46,-1.2,-0.33,-0.8,-1,-1.34,-0.73,-0.89,-0.5,-1.05,1.29,-0.54,0.7,-0.53,-1.46,-0.77,-1.14,-0.9,-0.55,0.58,0.05,0.9,0.92,0.96,0.42,0.64,0.18,-0.83,0.18,-0.51,-0.5,-0.08,-0.22,-0.21,-0.16,1.13,0.07,1.56,-0.1,1.32,-1.1,0.83,-3.34,-0.82,-2.83,-0.79,0.78,1.32,-0.02,1.29,1.13,1.79,0.96,1.68,0.11,1.34,0,1.41,2.5,1.6,0.87,0.71,-1.05,0.11,-0.61,0.31,1.98,-1.36,1.49,-1.4,0.13,0.15,1.03,0.35,-0.37,0.13,-0.8,-0.43,-0.12,-1.19,0.94,-1.09,1.44,0.05,1.58,0.62,0.49,1.19,-0.12,1.4,0.09,-0.21,0.03,-0.3,0.97,1.45,0.86,1.25,-0.35,0.21,-0.03,0.18,-1.33,0.45,-1.52,-0.04,-0.07,-0.01,0.83,-0.16,-0.6,-0.22,0.04,-0.52,0.22,0.22,0.27,0.06,-1.45,0.1,-1.11,0.25,-0.77,0.22,-0.47,0.35,-0.43,-0.35,0.65,-0.01,-0.59,-0.94,0.08,-0.7,1.06,-0.97,0.13,-1.68,-1.19,-0.69,-0.81,-0.4,0.5,-0.9,1,-0.69,-0.35,-1.05,-0.85,-1.34,1.24,0.15,1.29,-0.19,-1.76,-0.35,-1.25,0.3,-0.49,-0.01,-0.19,-0.01,1.04,-0.24,-0.1,-0.98,-1.42,-0.56,-0.98,-0.12,0.31,-1.34,0.62,-0.69,0.52,1.65,0.66,1.9,0.45,1.03,-0.32,1.09,1.97,1.03,1.62,0.71,-0.98,0.4,-1.16,0.08,0.55,-0.86,0.06,-0.85,1.75,1.81,1.29,1.47,1.18,-0.64,0.68,-0.98,-0.14,0.38,-0.63,-0.25,-1.39,-0.18,-1.42,-0.04,0.64,-0.61,0.68,-0.59,1.29,1.45,0.7,1.3,-0.65,0.51,-0.36,0.17,-0.39,0.69,0.47,1.19,-1.09,-0.79,-0.77,-0.5,-1.27,-1.01,-1.87,-1.35,1.1,1.53,0.84,0.98,0.18,0.23,0.45,0.71,-0.68,-0.3,-0.83,-0.03,0.12,-0.36,0.33,-0.46,0.33,-1.32,0.66,-1.7,0.89,0.61,-0.41,0.29,0.16,-0.34,0.35,-0.09,0.3,1.02,0.8,0.95,-0.49,-0.7,-0.68,-0.83,-1,1.67,-0.96,1.35,0.24,-0.59,-0.37,-0.94,-1.11,-0.5,-0.68,-0.25,-0.98,-1.03,-0.26,-1.03,0.18,-0.11,0.58,0.17,-0.13,0.4,-0.76,-0.12,-1.03,1.13,-0.55,1.23,0.84,0.14,0.68,0,-2.03,-0.93,-0.67,-0.29,0.56,1.28,0.3,1.32,-0.55,-0.51,0.18,0.11,0.41,0.34,1.46,0.45,0.5,0.4,0.25,0.02,-1.44,-1.26,-1.25,-1.13,-1.23,0.29,-0.81,0.7,-0.44,-1.63,-0.76,-1.75,-0.49,-0.76,-0.1,-0.42,-0.43,-0.33,-1.02,-0.64,-1.2,0.21,-0.74,0.43,0.34,0.13,0.37,0.61,0.56,-0.37,-0.24,-1.05,0.24,0.27,0.29,0.19,-0.89,-0.41,-0.65,-0.44,0.44,1.44,-0.69,1.27,-0.26,-1.2,-0.26,-0.89,1.25,-1.04,0.84,-0.83,-0.42,0.11,-0.15,0.19,1.26,0.16,0.89,-0.02,2.35,-0.41,1.03,-1.13,-1.52,-2.4,-1.72,-2.72,1.22,0.02,1.15,-0.46,-0.26,-0.34,-0.12,-0.37,-0.85,-0.62,-0.9,-0.39,0.11,-1.08,-0.27,-1.32,0.42,0.16,0.91,0.21,0.04,-1.11,-0.68,-1.59,-0.21,-1.2,0.56,-0.27,-0.43,0.89,-1.36,0.65,-0.58,1.12,-0.19,1.52,-0.82,-0.22,-1.16,0.26,-1.4,-2.36,-0.91,-1.77,2.05,0.97,0.58,0.11,0.24,0.51,-0.21,0.1,-0.65,0.69,0.44,0.85,-0.5,0.61,0.15,0.72,-0.35,-0.52,0.01,-0.11,1.63,1.24,0.91,0.74,-0.3,-0.1,0.16,-0.51,-0.46,-0.44,0.35,-0.34,0.39,1.03,0.73,0.81,0.13,3.23,0.21,2.49,1.32,1.28,1.31,0.84,-0.24,0.05,-0.06,0.44,-2.01,-0.75,-1.08,-0.61,-0.9,0.05,-0.54,0.12,0.8,1.95,0.97,1.24,1.53,2.14,0.94,1.2,-0.66,-0.25,-0.83,0.09,1.54,1.74,1.55,1.68,0.55,0.79,-0.36,0.34,-0.77,-0.07,-0.68,-0.79,1.1,-0.3,1.12,-0.06,1.51,0.78,1.13,0.29,1.14,0.22,0.83,-0.06,-0.03,1.3,-0.03,1.12,1.4,0.46,0.79,0.54,1.16,0.19,-0.38,-0.49,1.79,0.62,0.86,0.14,-0.08,-0.06,1.48,0.61,0.77,-0.74,0.5,-1.05,0.23,0.41,-0.64,0.17,-0.49,0.11,-0.66,0,1.88,1.55,1.29,1.33,-1.43,-0.55,-0.88,-0.34,0.17,-0.54,0.18,-0.4,0.35,0.35,0.39,0.29,2.01,0.69,0.88,-0.06,-1.32,-0.79,-0.29,-0.44,-0.47,-0.05,-0.01,-0.38,-0.04,-0.67,-0.62,-0.65,0.84,1.77,0.53,2.15,1.16,0.06,1.02,-0.41,0.19,1.27,-0.68,0.11,0.83,0.94,1.48,0.84,0.15,-0.32,-0.61,-0.57,0.65,0.64,0.13,0.4,-0.43,-0.41,-0.65,-0.62,-0.84,-1.6,-0.78,-0.96,1.89,0.17,1.67,0.16,-1,-1.05,-1.08,-0.65,-0.76,0.54,-1.07,0.22,1.25,-0.01,0.07,-0.68,-1.1,-0.3,-0.48,-0.33,0.81,-0.21,0.76,-0.11,0.28,-0.07,0.87,-0.08,0.75,1.13,-0.04,0.91,0.18,-0.54,-0.34,-0.61,-0.15,-0.57,0.99,0.04,-1.17,-0.83,-0.69,-0.66,-2.51,-0.73,-1.99,-0.86,-1.05,0.28,-0.59,0.58,-1.41,-2,-0.7,-0.99,-1.71,-2.11,-1.68,-2.15,-1.19,0.4,-1.1,0.3,1.11,-0.96,0.54,-0.8,-0.26,0.52,-0.56,0.38,2.13,0.47,1.56,0.11,0.39,-1.13,-0.04,-1.56,1.32,-0.24,0.28,-0.62,-0.59,0.67,0.3,1.09,1.35,1.55,0.64,0.98,-0.82,0.51,-0.38,0.4,-0.61,-0.39,-0.55,-0.4,-0.16,-1.4,-0.64,-1.12,0.31,1.11,0.14,0.55,0.04,1.34,0.29,1.39,0.5,-0.47,0.02,-0.46,1.16,0.37,1.62,0.39,-1.01,-0.65,-0.38,-0.12,0.22,0.16,-0.15,0.6,0.45,-0.33,0.57,-0.66,-0.07,1.21,-0.05,0.9,-0.78,-1.1,-1.87,-1.13,1.07,-0.41,0.52,-0.25,0.41,0.49,0.62,0.29,0.31,1.36,0.31,1.21,0.11,0.64,0.17,0.88,-0.6,-1.85,0.02,-1.41,0.25,-1.57,0.45,-1.2,-1.3,-0.9,-1.15,-0.63,-0.16,0.95,-0.07,0.77,0.27,-0.83,0.3,-0.65,1.26,2.18,1.21,1.85,-0.03,1.2,-0.22,1.48,-0.3,0.61,0.27,0.38,0.12,-0.98,0.08,-0.74,1.13,-0.44,1.63,-0.21,0.04,-0.13,0.41,0.45,-0.27,-0.99,0.51,-0.54,-0.66,0.02,-1.04,-0.15,-0.55,0.5,-1.22,0.14,-0.68,0.63,-0.83,0.15,-0.05,-0.44,-0.53,-0.5,0.41,0.54,0.64,0.63,-0.03,-0.39,0.37,-0.62,1.19,2.17,1.23,2.23,-0.81,0.21,-0.88,0.2,0.46,0,-0.05,-0.57,0.06,-0.32,-0.11,0.18,-1.02,0.14,-0.33,0.72,0.97,0.68,0.9,0.92,-0.72,0.06,-0.57,0.05,1.92,1.1,1.04,0.85,0.55,-0.07,-0.6,-0.77,0.29,0.7,-0.11,0.1,-0.73,-0.61,0.39,0.04,-0.23,-0.16,0.11,0.3,1.2,-0.86,0.13,-0.85,-0.27,-0.86,0.72,-0.66,-0.93,0.65,-0.46,1.12,-1.07,0.73,-0.2,0.79,-0.86,-1.4,-1.02,-1.32,0.71,0.88,0.51,0.37,0.74,-0.61,0.77,-0.57,-0.47,0.68,-0.24,0.01,0.81,0.64,0.91,0.47,-1.36,-0.29,-0.2,0.26,1.19,1.03,0.84,1.02,1.96,-0.07,-0.03,-0.99,1.37,-1.34,0.8,-1.15,0.21,-0.4,0.64,0.05,-2.15,-2.88,-1.79,-2.27,0.24,-1.29,0.55,-1.12,-0.82,0.87,-0.2,0.64,-0.49,-3.34,-1.04,-3.27,0.07,1.08,0.66,1.47,2.24,2.02,0.97,1.51,-0.87,0.57,-0.73,0.54,1.74,-0.6,1.02,-0.95,-1.36,-1.87,-1.22,-2.03,0.16,0.21,-0.1,-0.21,-0.77,-0.29,-0.86,-0.31,-0.86,-1.85,-0.66,-1.72,0.75,-0.02,1.08,0.16,1.87,1.07,1.55,0.82,-1.6,0.61,-0.51,0.95,-1.96,-1.93,-1.34,-1.57,-1.49,-0.18,-0.82,0.35,-1.04,-1.03,0.39,-0.09,1.32,-0.96,0.79,-0.98,0.68,0.58,-0.22,0.03,-0.22,-0.24,-0.54,-0.22,0.44,0.34,-0.44,0.18,-0.54,0.16,-1.21,-0.62,-1.43,-1.11,-0.49,-0.35,1.23,0.12,0.67,-0.48,-1.78,-1.12,-1.59,-1.1,1.4,0.06,-0.17,-0.54,-0.35,0.22,-0.9,-0.06,1.43,1.36,0.97,1.46,0.04,-0.3,0.53,-0.08,0.01,1.67,0.73,1.51,-0.68,0.42,-0.61,0.02,1.15,-0.23,1.41,-0.1,-1.3,-1.02,-1.12,-0.76,-0.94,-1.17,-0.15,-0.14,-0.27,-0.23,-0.66,-0.27,-0.55,-0.41,-0.1,-0.38,0.19,-0.07,-0.18,-0.06,-1.87,-1.66,-1.39,-1.49,0.66,0.23,0.88,0.3,1.93,0.71,1.03,0.22,1.01,0.84,0.82,1.4,-1.13,0.05,-0.65,-0.03,1.71,0.04,0.78,0.03,-0.28,-0.48,0.08,-0.23,0.87,-0.41,1.06,0.1,-0.68,-0.73,-0.44,-1.01,-0.46,0.65,0.08,0.58,-1.53,-1.14,-0.22,-0.64,1.51,0.94,-0.19,0.48,-0.33,-0.47,-0.9,-0.53,-2.02,-1.46,-0.78,-1.02,-0.08,0.29,0.46,0.23,-0.75,0.96,-0.56,1.19,-0.7,0.68,-0.16,0.64,0.1,-1.24,-0.62,-1.43,1.05,1.37,0.98,0.91,0.19,1.53,0.78,1.38,0.63,0.09,0.61,0.06,0.36,2.26,0.02,2.47,-0.14,-0.49,-0.59,-0.48,1.64,-0.7,0.45,-1.5,1.38,-1.57,0.86,-1.41,0.36,0.88,0.52,0.76,1.23,1.15,0.66,1.24,0.46,1.22,0.02,0.68,0.22,-0.05,0.53,0.31,-1.58,0.04,-0.36,0.35,-0.67,0.22,0.32,0.52,-1.11,0.19,-1.42,-0.58,0.48,-0.37,-0.04,-0.46,0.16,1.01,0.53,0.93,0.12,-0.31,-0.44,-0.14,1.58,0.07,0.7,-0.03,1.24,0.13,0.83,0.08,0.27,-1.19,0.46,-0.72,0.18,0.84,0.71,1.36,-0.11,0.68,0.16,0.45,-0.48,-0.51,0.02,-0.77,-0.23,0.1,-0.73,0.31,0.21,-0.94,0.32,-1.3,-0.58,1.09,-1.3,0.87,1.07,2.08,0.82,2.17,-0.42,0.61,-0.45,0.41,-0.07,0.06,-0.07,-0.34,-0.51,0.37,-0.65,0.45,0.14,-1.48,-0.41,-1.68,1.45,0.45,0.91,0.16,0.54,-1.32,0.28,-1.34,0.28,1.52,-0.33,1.09,0.97,0.96,0.87,0.94,-0.64,-2.05,-0.51,-2.38,0.88,1.78,1.29,1.95,0.11,-0.42,0.14,-0.62,-0.36,-0.07,-0.29,0.39,-0.84,0.21,-0.62,0.49,-1.21,0.62,-0.39,0.9,1.22,0.53,0.32,0.08,1.03,1.51,0.23,0.91,-1.53,-1.12,-1.08,-1.61,-0.04,0.2,0.27,0.13,1.15,1.01,1.41,1.13,-0.57,-0.53,-0.5,-0.9,-0.04,-0.28,-0.05,-0.48,-0.81,-0.41,-0.75,-0.17,1.32,-0.5,0.3,-1.12,1.22,0.56,0.11,-0.46,0.94,-1.52,0.57,-1.48,0.38,-0.36,-0.02,-0.13,1.25,1.06,1.62,1.13,0.53,-0.14,0.67,0.23,1.39,1.43,1.2,1.01,1.44,2.37,1.16,1.51,0.71,0.86,0.82,0.57,0.91,0.09,-0.08,0.05,-2.01,-0.86,-2,-1.06,-2.03,-1.86,-0.79,-0.81,0.3,1.53,0.31,1.42,-0.13,0.2,-0.03,0.4,-1.47,1.26,-0.72,1.6,-0.89,-1.58,-0.48,-1.27,0.8,1.46,0.32,0.78,-1.49,-0.09,-1.68,-0.07,1.19,1.22,1.48,1.22,-0.05,2.05,0.2,2.09,-0.26,-1.46,0.42,-1.25,0.4,-0.67,0.56,-0.49,-0.28,0.06,0.3,0.13,-0.43,-0.37,-0.16,-0.2,-0.74,0.63,0.02,0.93,-1.89,-0.97,-1.53,-1.13,1.41,0.64,0.46,0.69,-1.46,-1.7,-0.99,-1.43,1.35,0.86,0.12,0.05,0.36,1.51,-0.71,1.01,-0.26,-0.1,0.16,0.02,0.03,-0.95,-0.07,-0.88,1.54,1.04,1.29,0.85,0.27,1.53,0.45,1.03,-1.97,1.33,-0.36,1.74,-0.33,-0.06,-0.86,-0.82,-1.25,0.61,-0.74,0.36,2,1.38,1.38,1.32,-0.01,-0.58,-0.23,-0.43,-0.81,-0.1,-0.89,-0.5,0.86,0.7,0.54,0.24,1.07,-0.07,1.11,-0.18,-2.75,-1.68,-1.4,-1.35,0.02,0.29,-0.31,0.2,1.35,0.48,1.07,0.41,-1.56,-0.21,-1.72,-0.2,0.02,1.15,0.15,0.85,-0.3,-0.11,-0.85,-0.62,-0.02,0.16,-0.66,0.23,0.51,1.38,-0.25,1.27,0.28,0.49,0.36,0.42,1.16,-0.49,0.36,-0.73,-1.36,-0.44,-0.95,-0.24,0.18,-0.53,-0.35,-0.67,-0.47,-0.59,-0.17,-0.28,-1.02,-0.67,-1.77,-0.88,-1.72,0.37,-0.99,1,-0.87,-1.36,-0.3,-0.96,-0.79,-1.13,-0.53,-1.63,0.94,0.96,0.76,0.81,1.46,0.22,0.61,0.04,0.82,-0.58,0.97,0.29,-0.94,-0.78,-0.53,-0.53,0.97,-0.28,0.14,-0.83,-0.14,-0.99,-0.78,-1.24,-0.9,-1.07,-0.62,-0.67,0.99,0.75,0.42,0.23,0.67,1.7,0.78,1.62,1.42,0.81,0.44,0.5,-1.24,-1.04,-1.09,-1.17,0.56,0.64,-0.19,0.54,-0.38,-0.26,0.01,-0.38,0.36,-0.04,-0.07,-0.24,1.22,1.92,0.65,1.67,0.14,1.8,-0.18,1.56,-0.11,0.72,-0.2,0.88,-0.1,1.03,-0.13,0.96,0.22,1.81,-0.12,1.75,1.22,-2.27,0.67,-1.9,-1.1,0.37,-0.94,0.07,-0.81,0.89,-0.84,0.62,0.6,-0.94,0.34,-1.16,1.49,0.82,1.31,0.91,2.73,1.63,1.63,1.68,0.05,-1.35,-0.7,-1.5,1.17,-0.22,0.76,0.16,-1.27,-0.4,-0.78,-0.09,-0.33,-0.34,-0.87,-0.7,-1.14,0.25,-1.73,-0.66,1.36,1.66,0.2,1.35,0.58,2,1.33,1.78,0.43,0.68,0.86,0.79,-0.94,-0.17,-1.02,-0.15,0.02,-0.25,-0.2,-0.31,0.6,-2.08,0.35,-2.02,0.11,-0.65,0.85,-0.18,-0.25,-0.79,-0.79,-1.18,-0.53,-0.04,-1.15,-0.1,1.58,0.29,1.02,0.26,-0.35,1.73,-0.03,1.45,2.06,0.62,1.61,0.15,-0.41,-1.28,-0.19,-1.32,-0.06,-0.53,-0.77,-0.7,-0.61,-0.85,-0.48,-0.61,-0.93,-1.24,-0.23,-0.94,1.69,1.78,0.72,1.53,0.66,0.81,0.81,0.55,-1.58,-1.93,-0.67,-1.54,0.72,-0.33,-0.52,-0.63,-2.13,-0.55,-2.16,-0.32,-1.3,-0.44,-1.22,-0.6,0.67,0.09,0.24,0.25,-0.23,-0.37,-0.54,-0.9,-0.36,-1.09,-0.43,-0.94,1.27,1.01,1.12,0.6,-1.4,0.3,-0.74,0.19,-0.83,0.63,-0.37,0.73,-0.65,-1.94,-0.71,-2.03,-0.99,-0.15,-0.93,-0.1,1.51,-0.16,0.37,-0.33,-1.3,0.61,-0.04,1.1,-0.42,0.32,0.59,0.41,0.04,0.13,0.1,0.08,0.18,-0.79,-0.06,-0.81,0.53,-0.34,-0.17,-0.87,0.98,1.11,0.06,0.64,2.32,2.08,0.49,1.22,0.21,-0.99,1.38,0.17,3.55,1.85,1.67,0.89,1.43,0.84,0.05,0.4,0.98,0.64,1.52,0.53,0.05,-0.64,0.26,-0.86,-0.62,0.09,-0.52,0.29,0.25,0.81,0.13,1,0.71,0.13,1.11,0.56,0.01,0.22,-0.46,-0.06,0.94,0.95,0.57,0.71,-0.08,0.45,-0.1,0.85,-0.15,-0.46,-0.29,-0.25,0.14,0.95,-0.82,0.61,0.06,-0.07,1,0.25,0.3,0.01,0.25,-0.7,-1.47,-0.43,-0.27,0.44,-0.43,-0.01,-0.98,-0.06,1.89,1.02,0.91,0.53,-1.45,-2.3,0.08,-1.13,0.99,0.95,0.22,1.07,0.97,1.01,0.82,0.75,-0.16,1.34,-1.43,0.84,-1.22,-0.62,-1.05,-0.31,-0.09,1.79,-1.06,1.69,-0.2,-1.57,-0.06,-1.47,-1.06,-0.46,-0.9,-0.85,-1.54,-0.91,-1.26,-0.87,-2.1,-0.71,-1.55,-0.18,-0.19,1.34,0.52,1.24,2.1,1.11,0.5,0.53,1.27,1.28,0.29,1.07,1.18,0.85,0.39,0.7,-0.57,-0.38,-0.89,-0.44,0.93,1.49,1.37,1.8,-1.66,-0.43,-0.99,-0.25,-1.03,-0.14,0.23,0.14,-1.49,0.76,-1.37,0.69,1.43,2.14,-0.63,1.14,1.81,1.74,0.65,0.63,0.89,-0.33,0.5,-0.22,1.26,-1.66,1.54,-1.44,-0.94,-0.64,0.29,-0.24,-0.22,-1.98,-0.1,-1.65,0.35,-0.61,0.75,0.12,2.19,-1.14,1.98,-1.09]},{"a":"heart","b":"lungs","paper":0.73,"r":0.57,"pr":0.7,"xy":[1.35,0.79,0.36,0.29,0.3,0,-0.1,0.09,-0.66,-0.94,-0.89,-0.13,-1.56,-1.51,-1.38,-1.18,0.84,-0.72,1.09,1.13,0.68,0.56,0.35,0.08,1.56,0.54,1.22,1.09,-1.14,-0.34,-0.8,-0.4,1.92,0.86,1.64,0.95,0.47,-1,-0.15,-0.68,-1.5,-1.5,-0.79,-0.1,0.03,-0.37,-0.23,-0.08,-1.13,-0.65,-0.86,-0.09,0.69,-0.01,0.46,-0.28,-1.03,-0.63,-1.57,-0.2,-0.27,1.22,-0.48,1.08,1,0.55,1.33,0.64,0.55,-1.02,-0.36,-0.43,0.61,0.11,0.87,0.33,-0.11,0.7,-0.25,1.07,-0.04,0.39,0.32,0.88,0.68,0.2,0.04,0.26,-2.02,-0.08,-1.16,-0.34,-1.01,0.03,-0.61,0.23,-0.04,-1.11,-0.18,-0.89,0.29,-1.28,0.25,-0.48,2.43,1.81,2.65,2.19,0.45,1.32,0.24,0.41,-0.78,-0.47,0.19,0.05,0.54,-0.61,0.58,0.46,0.01,0.47,-0.09,0.43,-0.21,-1.05,-0.28,-1.11,-0.38,-1.76,0.43,-0.45,-2.12,-1.09,-1.43,-0.76,-0.03,-0.59,0.13,-0.33,-0.82,0.54,-0.41,0.31,-1.13,-0.8,-0.97,-0.81,0.81,0.32,0.81,0.2,1.97,2.06,0.21,0.33,0.31,-0.55,-0.49,0.17,0.73,0.25,0.72,1.08,-0.15,-0.8,-1,-0.81,0.46,-1.19,-0.2,-0.4,-0.46,0.22,-0.52,0.15,0.96,0.41,-0.23,0.37,-0.43,0.14,-0.06,0.35,-1.98,-1.4,-1.04,-0.54,-0.07,0.52,0.16,0.21,0.38,0.46,0.36,0.13,1.37,1.36,0.86,0.97,-0.38,-0.83,-0.47,-0.48,-0.72,-1.52,-1.25,-0.52,0.9,0.81,1.46,1,-1.38,-1.75,-2.19,-1.45,-0.93,-1.29,-1.25,-1.2,-1.65,-0.51,-0.84,-0.33,-0.16,-0.98,-0.31,-0.72,0.93,0.62,0.77,-0.32,0.05,-1.5,-1.11,-1.02,0.53,0.43,0.37,0.59,-0.8,-0.67,-0.69,-0.66,0.42,0.31,0.36,0.13,-1.51,-1.3,-1.48,-1.12,-0.38,-0.35,-0.13,-0.33,1.24,0.85,1.11,1.06,0.5,0.76,0.06,0.51,0.88,0.52,0.95,0.75,0.69,0.15,1.3,0.55,-0.01,0.2,0.47,0.8,0.13,0.19,0.52,0.11,0.06,0.32,0.32,0.01,-0.21,-0.26,-0.36,-0.27,-1.19,-1.16,-0.55,-0.43,1.58,0.88,1.21,0.33,2.61,1.72,2.54,1.79,1.29,0.4,1.34,1.34,0.67,-1.1,0.66,-0.62,1.3,2.35,1.53,1.87,-1.09,-0.68,-0.2,-0.13,0.51,0,0.83,0.22,-2.55,-1.75,-2.08,-1.09,0.18,-1.1,-0.19,-0.96,1.1,1.26,1.49,0.36,-1.4,-0.45,-1.23,-0.22,1.33,-0.35,1,0.17,0.44,0.85,0.59,1.29,0.49,0.41,0.59,0.04,-0.22,0.67,-0.21,-0.18,-0.44,-1.23,-0.76,-0.75,-0.28,-0.01,-0.45,-0.23,0.22,-0.85,-0.35,0.52,-0.35,-1.47,-0.18,-0.54,0.56,0.5,-0.28,-0.37,2.12,1.16,1.48,0.73,-0.01,0.5,0.16,-0.15,-0.61,0.02,-0.75,-0.45,0.53,-0.79,-0.16,-0.16,-0.16,-0.3,-0.14,-0.09,-1.49,0.2,-0.73,0.36,1.55,2.13,1.82,1.8,-0.06,-1.65,-0.78,-1.02,0.04,-0.04,0.23,0.18,-2.11,-0.97,-1.11,-0.8,0.14,-0.47,-0.22,-0.52,-1.23,0.41,-0.77,-0.25,-0.29,-0.46,0.23,0.11,-0.63,-0.7,-0.5,-0.52,0.19,0.66,-0.69,-0.26,-0.46,-0.84,-0.2,-0.78,-0.05,-0.87,-0.12,-0.89,-0.06,0.67,-0.45,-0.14,0.11,1.15,0.19,0.78,2.27,0.51,1.07,0.39,0.48,0.21,0.27,-0.18,-0.62,0.1,-0.51,0.06,0.76,2.41,0.94,2.3,-0.92,0.62,-0.47,0.38,1.96,1.47,1.25,0.95,-0.94,0,-0.92,-0.48,1.04,0.15,0.18,0.02,1.77,-0.42,2,0.67,-0.72,0.47,-0.58,0.77,-0.33,-0.3,0.24,-0.08,-0.62,-0.69,-0.45,-0.18,-0.01,1.68,-0.76,0.33,0.08,1.14,-0.05,0.42,-0.69,0.18,0.31,0.26,1.15,-0.12,0.72,0.27,0.81,-0.81,1.31,0.27,-0.34,0.32,-0.24,0.2,-0.9,-1.22,-0.51,-0.71,0.22,-1.56,0.19,-0.88,0.14,0.06,-0.58,-0.01,1.72,1.49,1.58,1.1,1.25,1.07,1.1,0.81,0.47,-0.16,0.23,-0.15,1.59,0.24,1.89,0.3,-0.82,0.46,-0.75,0.34,-1.09,-0.29,-0.95,-0.32,0.04,-1.88,0.2,-0.8,0.32,0.76,-0.26,0.31,-1.4,-0.13,-0.83,-0.24,1.31,1.08,0.72,-0.04,-0.18,-0.21,-0.75,-0.24,-0.41,0.57,-0.54,0.68,0.72,-0.65,0.32,-0.11,0.32,0.76,0.98,1.2,0.97,1.13,1.33,0.41,0.12,-0.17,-0.2,-0.07,-0.61,-0.66,-0.24,-0.04,1.02,1.19,0.94,0.68,-0.32,-0.59,-0.11,-0.82,0.82,-0.07,0.32,-0.37,-2.02,-0.65,-1.81,-1.9,-0.11,-1.45,0.17,0.04,0.43,0.01,-0.01,-0.31,-0.3,-0.55,-0.7,-1.36,-0.09,-1.9,-0.81,-0.79,-1.06,0,-0.44,-0.08,0.33,-0.82,-0.11,0.05,-0.09,1.34,0.31,0.96,-0.17,-0.19,-0.55,-0.13,0.27,1.65,0.33,1.44,-1.59,-1.56,-1.22,-0.38,-0.68,-1.84,-0.55,-1.41,1.15,0.63,0.95,0.56,-0.85,-0.78,-1.73,-1.27,1.55,1.43,1.55,1.19,1.05,0.75,-0.03,-1.02,1.21,2.55,1.05,1.99,0.08,1.5,-0.49,0.58,0.69,0.93,0.28,0.91,-1.2,-0.27,-1.1,-0.97,0.27,0.29,0.41,0.38,-1.24,0.8,-0.68,0.23,0.71,1.26,1.02,0.97,1.63,0.53,0.5,0.09,0.32,0.17,0.07,-0.84,-0.41,0.05,-0.42,0.12,0.9,0.07,0.74,0.69,1.47,1.56,0.92,1.06,-1.17,-0.82,-1.08,-1.36,-0.26,0.34,-0.72,-0.24,1.07,-0.08,0.36,0.56,-1.19,-0.58,-0.65,-1.34,-1.06,-0.84,-0.2,-0.46,1.07,0.23,0.63,-0.67,-0.03,-1.57,0.55,0.13,0.92,0.56,0.1,0.77,0.95,0.63,0.26,0.1,-0.63,-1.02,-0.22,-0.45,0.64,-0.01,0.18,0.33,0.85,0.19,0.51,0.58,1.28,0.85,0.52,0.41,-0.68,-0.43,-0.49,-1.34,0.42,0.36,0.14,0.02,-0.4,-0.93,-0.25,-0.3,0.97,1.63,0.66,0.89,-0.87,0.26,-0.27,-0.23,0.13,-0.06,0.95,0.59,0.22,-0.3,-0.24,-0.47,0.59,0.85,0.09,0.45,-0.59,-0.59,-0.58,-0.5,-0.65,-0.91,-0.4,-0.89,1.55,1.44,1.14,0.41,-0.34,0.65,-1.04,0.54,1.62,-0.75,0.83,-0.37,-0.55,-0.66,-0.23,-0.28,-1.55,-0.09,-1.85,-0.39,-0.09,-0.11,0.26,0.57,-0.77,-0.35,-1.59,-0.97,1.19,0.4,1.05,0.79,-0.64,-0.01,-0.42,-0.31,0.58,1.39,1.05,1.32,0.51,0.57,0.7,0.63,1.67,0.97,1.46,1.06,-1.04,-0.04,-0.45,0.2,0.16,-0.26,-0.75,-0.59,-1.48,0.63,-0.9,-0.77,0.2,-0.15,-0.26,-0.64,0.06,0.3,-0.05,0.32,-1.33,0.52,-1.22,0.71,0.07,0.1,-0.68,-0.1,0.97,0.42,0.83,-0.12,-1.24,-0.99,-1.19,-1.28,0.51,0.07,0.73,0.64,-0.45,0.01,0.6,0.67,0.65,-0.11,0.32,-0.33,0.97,1.16,1.47,1.01,-1.17,-1.02,-0.38,-0.67,0.66,0.3,-0.38,-0.39,0.85,0.49,0.69,0.67,-0.3,-0.2,-0.16,-0.29,1.19,-0.9,0.81,-0.95,-1,-1.04,-0.51,-0.42,-1.95,-2.14,-1.73,-1.44,0.2,0.4,0.79,0.99,-0.95,-0.66,-1.13,-0.68,0.83,-0.69,0.2,0.29,-0.19,0.2,-0.31,-0.72,1.05,1.37,0.39,0.94,0.81,0.86,0.7,1.08,-0.31,-0.79,-0.28,-0.42,-0.84,-0.9,-0.64,-0.54,2.38,1.87,2.04,1.59,0.73,0.1,0.1,-0.38,-0.69,-0.33,-0.02,0.28,-0.02,-1.18,-0.26,-1.09,1.04,0.69,1.17,0.31,0.68,-1.04,1.14,-0.6,-0.09,-0.19,-0.05,-0.44,1.47,-0.65,0.06,-0.55,1.15,0.74,0.56,0.62,-0.95,0.67,-0.38,0.33,-0.45,0.66,0.14,0.28,-1.26,-0.79,-0.64,-0.21,1.03,0.24,0.02,0.24,-1.44,0.38,-2.1,-0.22,0.4,1.37,0.45,1.47,0.16,1.09,-0.03,0.54,0.85,1.5,0.1,0.39,1.06,1.31,0.64,0.91,-0.64,-0.49,-0.42,-0.65,-1.33,0.66,-1.04,0.08,0.05,0.73,-0.2,-0.16,1.07,1.99,0.23,0.85,0.54,0.84,-0.66,0.11,0.01,-0.41,0.73,0.01,-1.27,-0.72,-1.48,-0.56,0.12,-0.8,-0.6,-0.22,2.38,2.52,1.36,2.1,0.99,0.26,1.17,1.05,1.38,1.15,1.57,1.6,-1.31,-0.91,-1.54,-0.8,1.54,1.16,1.4,0.9,-0.22,-1.43,0.27,0.05,0.05,-1.48,-0.39,-0.65,0.29,-0.78,-0.68,-0.65,-2.93,-0.36,-1.93,-0.57,-0.07,0.23,-0.25,-0.07,0.91,-0.55,0.72,-0.57,0.36,-0.14,0.49,-0.05,-0.79,-1.03,-1.28,-0.65,-0.24,0.25,-0.47,-0.26,-1.28,-1.18,-0.86,-0.38,0.79,0.68,0.52,0.8,0.75,-0.56,-0.25,-0.16,0.76,1.36,1,0.93,0.09,1.01,-0.47,0.74,0.77,-0.62,0.6,-0.72,-1.22,-1.98,-0.94,-1.65,0.11,0.24,-1.04,-0.24,0.1,0.04,-0.41,0.37,-0.01,1.07,-0.19,0.94,0.67,0.17,0.38,0.15,1.57,0.43,0.88,0.18,1.96,0.7,2.2,1.56,-0.24,-0.6,0.58,0.26,-0.39,0.09,-0.24,0.78,-0.59,-1.16,0.27,-0.73,-0.97,-0.52,-1.31,-1.36,1.42,-0.44,0.54,0.03,-0.01,1.11,0.3,1.03,-0.68,-0.37,-0.62,0.05,0.63,1.23,0.57,1.57,-0.51,-0.76,-0.51,-0.63,-0.6,-0.84,-0.68,-0.53,0.12,0.74,0.4,0.68,0.34,0.58,-0.04,0.09,0.76,1.11,0.86,0.23,0.1,0.39,0.45,0.29,-1.34,-0.95,-0.39,-1.1,1.41,0.81,0.83,-0.01,1.6,1.23,0.87,0.09,0.85,-0.58,0.75,0.14,0.88,0.26,0.72,0.24,0.53,-0.27,0.36,0.61,0.36,-0.22,0.02,0.4,0.96,-0.51,0.2,-0.16,-1.53,-0.16,-0.68,0.04,-0.66,-0.73,-1.42,-0.73,0.47,1.36,0.62,0.75,0.28,0.19,0.24,0.1,-0.57,-1.76,0.04,-0.33,0.14,0.47,-0.5,0.45,0.4,0.23,-0.01,-0.24,0.84,-0.18,0.7,-0.04,1,1.37,0.85,1.49,-0.9,-0.58,-0.76,-1.05,-2.07,-2.55,-1.68,-1.78,0.92,1.23,0.86,1.29,1.79,1.43,0.7,0.82,-1.34,-2.38,-1.08,-1.62,-0.22,-1.43,-0.02,-0.43,-0.48,0.15,-1.38,-0.54,0.43,0.36,0.53,0.67,-0.6,-0.67,-0.87,-1.09,-0.02,0.3,0.46,0.5,0.58,0.18,1.45,0.73,-1.06,-0.98,-0.99,-1.35,-0.43,0.19,-0.95,-0.15,0.06,-0.31,0.21,-0.07,0.81,1.03,0.56,0.8,0.74,-0.23,0.69,-0.48,0.66,1.4,0.62,1.23,-0.91,-0.67,-0.29,0.03,0.41,0.44,0.39,1.02,-1.08,-0.92,-0.46,-1.04,-0.98,0.2,-0.06,0.36,0.94,0.5,0.78,-0.46,0.3,-0.08,0.18,-0.04,-1.03,0.07,-0.9,-0.02,-0.68,-0.92,-0.77,-1.04,0.74,0.61,0.58,0.59,0.42,1.52,0.02,0.6,0.17,0.08,-0.03,0.15,-0.04,-0.13,-0.1,-0.55,0.11,0.01,-0.95,-0.72,-0.2,-1.44,0.82,-0.34,-1.19,-1.02,-0.61,-0.86,0.03,-0.65,0,-0.71,-2.15,-0.84,-1.75,-0.74,1.08,-0.03,0.7,0.24,1.89,0.05,0.68,0.3,0.83,0.8,0.3,0.46,-0.87,0.45,0.24,0.85,-0.59,-0.44,-0.09,0.39,2.03,-0.7,1.95,-0.18,-0.39,1.01,-0.17,1.19,-0.42,-0.35,-0.14,-0.14,0.99,2,1.06,1.45,-1.08,-1,-0.73,-1.29,0.36,0.6,0.31,0.94,-0.57,-0.52,-1.17,-0.87,0,1.59,-0.52,0.69,0,0.46,0.04,0.68,-0.86,0.75,-0.24,-0.27,0.01,-0.23,0.27,0.2,-0.09,-1.98,-0.54,-0.58,-1.02,-1.73,-1.13,-0.98,-0.31,-0.01,0.39,0.25,-1.12,-1.16,-0.32,-0.87,-0.65,0,-0.05,0.7,-0.26,1.13,-0.8,0.27,-2.37,-2.44,-2.02,-1.22,-1.71,-0.48,-1.3,-0.24,0.04,-1.26,-0.55,-0.66,0.84,0.64,0.46,-0.12,0.41,-0.56,0.05,0.73,-0.86,-0.12,-0.85,0,2.57,1.76,2.39,1.95,-1.12,-0.94,-1.54,-1.26,-1.25,-0.48,-0.91,-0.86,1.85,1.49,1.4,0.96,-1.2,-0.83,-1.2,-0.36,-1.24,0.63,-1.28,-0.61,-1.45,-0.46,-1.28,-0.41,-2.13,-0.97,-1.88,-1.66,0.72,1.54,0.97,0.83,-1.08,-1.38,-1.37,-0.9,1.35,-0.26,0.46,-0.32,-1.42,-1.51,-1.43,-0.98,-0.9,-1.35,-0.88,-0.94,2.27,1.42,1.12,0.54,0.37,0.59,0.46,-0.13,0.2,-0.11,-0.69,-0.31,-0.73,0.27,-0.15,0.48,1.12,-1.2,0.59,-0.33,-1.57,-1.22,-1.89,-1.36,-0.07,-0.72,-0.22,-1.03,-0.23,0.43,-0.29,-0.14,0.34,1.39,0.14,0.65,1.4,1.64,0.74,0.96,1.02,0.95,1.06,1.25,0.28,0.2,0.55,0.1,-1.79,-1.38,-1.03,-1.27,0.34,-0.17,0.19,-0.36,-0.6,0.33,-1.01,-0.14,0.7,-0.29,0.55,-0.42,-0.32,0.4,-0.34,-0.7,-1.24,-0.82,-0.85,-0.31,1.08,0.04,0.56,0.35,-0.35,-1.5,-0.29,-1.17,-0.64,0.52,-0.28,0.21,-1.19,-2.44,-1.06,-0.87,-1.57,-0.08,-1.87,-1.84,0.32,-0.54,0.82,0.72,-0.31,0.44,-0.93,-0.3,1.09,1.39,0.67,0.67,-0.52,1.09,-0.27,0.03,-0.17,-2.35,-0.45,-1.8,-0.6,-1.3,-0.76,-1.49,-0.25,0.95,-0.25,-0.01,0.49,1.06,0.38,0.84,-0.88,-0.41,-0.89,-0.92,-0.24,0.77,-0.02,0.53,-0.7,-1.51,-0.77,-0.17,0.08,0.36,-0.44,0.96,0.72,1.63,0.35,0.67,0.02,0.04,0.34,0.91,-2.16,-2.42,-1.87,-1.36,-0.8,-1.5,-1.12,-1.82,2.78,0.85,1.99,1.29,0.74,-0.72,0.28,-0.61,1.33,1.16,0.59,-0.11,0.71,-0.44,0.83,0.24,0.57,0.13,-0.12,-0.55,-1.59,-0.92,-0.9,-0.58,-0.03,1.24,0.43,1.14,0.19,1.19,0.18,0.15,0.19,0.5,-0.77,-0.12,1.14,0.12,0.66,0.09,1.23,1.58,1.03,1.18,-1.28,-1.82,-0.8,-1.11,-0.01,-1.32,-0.54,-1.14,0.94,0.11,0.95,0.39,-2.93,-2.36,-2.57,-1.63,-0.25,0.42,0.13,-0.27,0.59,1.2,0.37,0.75,-0.03,1.19,-0.55,0.46,0.46,-0.84,0.93,-0.31,1.32,1.24,0.67,1.15,1.99,0.33,1.43,-0.3,-0.06,-0.17,-0.13,-0.68,0.19,0.69,-0.38,-0.21,0.42,0.8,0.12,0.65,0.84,0.2,0.66,-0.23,-0.03,-0.69,0.05,-0.45,1.56,0.58,0.78,0.38,-0.43,-0.76,-0.17,0.05,0.84,-0.07,0.54,0.42,-0.23,-0.47,0,-0.3,0.78,1.13,0.59,0.81,-0.64,0.22,-0.33,0.33,0.65,0.71,0.31,0.48,-1.12,-0.99,-1.16,-1.58,0.17,0.34,0.18,0.3,1.72,2.43,1.69,1.3,2.62,0.52,1.7,0.7,0.96,0.17,0.73,0.43,0.05,1.31,-0.05,1.2,0.71,0.76,0.26,1.04,-0.02,0.12,0.26,0.93,0.92,0.89,0.9,0.68,-0.69,-0.27,-0.93,-0.11,-0.57,-0.48,-0.15,-0.58,0.72,-0.69,0.13,-0.34,1.2,0.47,0.06,0.6,-0.82,-0.79,-0.19,0.11,-1.44,-1.87,-0.73,-0.61,0.4,0.58,0.09,0.32,-0.57,-0.73,-0.49,-0.27,-0.04,0.11,-0.14,0.2,0.86,0.99,0.02,0.82,0.75,0.66,0.05,0.55,1.16,-1.01,1.31,-0.04,0.11,0.62,0.04,0.18,-2.02,-0.67,-1.22,-0.88,0.6,0.81,0.62,0.23,-0.18,-0.14,-0.33,-0.8,0.24,1.1,0.71,0.23,-1.28,-0.79,-1.5,-0.64,0.57,0.72,0.23,0.19,2.15,0.84,2.06,0.88,-1.84,-0.88,-1.77,-1,-1.54,-0.62,-1.08,-1.14,0.13,0.76,0.39,0.51,0.54,0.55,0.88,0.66,0.77,1.33,0.41,0.32,-0.72,0.08,-0.36,-0.12,-0.65,0.37,-0.2,0.28,-0.48,0.55,-0.04,0.11,-0.64,-1.84,-1,-1.4,0.2,0.35,0.36,0.04,3.09,1.24,1.85,0.87,1.19,-0.41,0.53,-0.72,0.02,0.45,-0.14,0.41,-0.77,-0.51,-0.6,-0.6,1.27,0.7,0.73,0.84,0.88,1.46,0.41,0.93,-0.33,1.57,-0.29,0.24,1.5,1.32,0.89,0.86,1.03,1.88,0.39,0.36,-0.3,-1.22,0.08,0.01,0.04,-0.51,0.21,-0.67,0.31,0.2,-0.25,0.02,1.19,0.71,0.46,0.65,-0.74,-0.16,-1.06,-0.61,-0.48,1.21,-0.4,0.24,-0.53,-0.54,-1.06,-1.18,1.66,1.05,1.77,1.58,-1.47,-1.09,-1.27,-1.19,0.61,1.17,0.15,0.03,0.01,-0.17,-0.47,-0.28,0.52,-0.91,0.46,-0.83,0.62,-0.61,0.79,0.26,1.16,0.88,0.74,0.51,0.92,-0.56,0.48,0.42,-0.85,-0.37,-0.86,-1.17,1.55,0.28,1.08,0.28,0.76,0.3,0.99,0.32,0.55,-0.65,0.48,-0.55,-0.09,0.21,0.47,0.22,-0.74,-0.16,-0.93,-0.46,-1.58,-0.12,-2.11,-0.65,-0.07,-0.26,-0.89,-0.25,0.8,-0.64,0.7,-0.02,-0.43,-1.54,0.32,0.06,0.56,0.54,0.42,-0.59,2.11,0.65,1.13,0.63,0.03,-0.63,-0.16,-0.16,0.48,0.56,1.07,1.14,0.94,-0.11,-0.02,0.71,-0.52,-0.41,-1.19,-0.66,-0.56,-1.72,-0.74,-0.65,1.33,1.04,1.35,1.2,0.68,-0.85,0.65,-0.05,0.95,1.22,0.67,0.56,-0.56,-0.99,-1.41,-1.73,1.45,0.13,0.81,0.58,-0.32,-0.07,-0.11,0.08,-1.5,-1.24,-1.27,-1.17,0.8,0.52,0.44,-0.27,0.91,-0.32,0.82,-0.45,-0.88,-2.03,-0.37,-0.7,-1.81,-0.58,-2.28,-1.4,0.69,0.86,0.21,-0.18,0.29,0.01,0.44,0.39,-0.1,-0.63,0.07,-0.43,-1.46,-2.84,-1.42,-1.34,0.27,-1.17,0.18,-0.17,-1.84,-2.51,-1.78,-1.41,0.42,0.61,0.72,0.51,0.88,0.39,0.92,0.45,0.78,0.97,0.04,0.71,1.34,-0.46,0.79,-0.5,2.01,2.59,2.16,2.2,0.9,1.27,1.12,1.15,-1.39,-1.02,-1.37,-1.3,-0.81,-0.51,-0.58,-0.21,-1.14,-1.01,-0.48,-0.2,1.19,1.57,1.8,1.25,1.33,0.05,1.07,0.48,0.08,-0.83,0.24,-0.19,0.25,-0.79,-0.07,-0.64,-0.35,0.56,-0.65,0.48,0.64,0.24,-0.01,0.76,1.81,1.75,2.48,1.77,0.98,-0.12,0.59,-0.23,1.49,1.06,1.99,1.34,-0.88,0.4,-0.46,0.46,0.13,-1.01,-0.35,-0.52,-0.34,0.27,-0.7,-0.37,0.11,1.21,0.41,0.4,0.45,-1.25,0.17,-1.47,-1.17,-0.92,0.04,-0.36,-0.01,0.32,-0.08,-0.21,-1.21,-1.55,-0.92,-1.01,0.92,0.39,0.04,-0.24,-0.51,-0.46,-0.04,0.04,0.4,0.57,0.15,0.56,-0.4,0.77,-0.17,0.38,0.74,0.78,0.65,0.29,0.13,-0.17,-0.07,-0.04,-0.03,-0.02,0.09,-0.12,0.38,-1.48,-0.01,-0.66,-0.62,0.86,-0.15,0.1,-0.32,1.46,-0.17,0.4,-0.47,-0.28,-0.83,0.04,0.52,-0.11,0.27,-0.68,0.99,-0.07,0.26,0.05,0.32,-0.62,0.09,-0.31,0.4,-1.27,-0.67,-0.99,-2.51,-1.45,-1.4,-0.59,1.17,-0.97,0.15,-0.31,1.39,-0.85,1.13,-0.05,-0.5,0.82,-0.64,0.57,-0.78,0.16,-0.71,0.38,-0.27,-0.28,0.44,-0.12,0.62,-0.35,0.09,-0.59,-1.19,-0.81,-1.21,0.02,0.58,-0.23,0.23,0.1,0.2,-0.1,-0.08,0.53,-0.92,-1.24,-0.06,-0.86,0.42,-0.34,0.63,0.3,-1.46,-1.71,-1.23,-1.58,-0.77,0.73,0.2,1.09,1.6,1.96,0.69,1.41,-0.32,0.79,-0.07,0.43,1.46,-0.04,0.79,-0.21,0.13,-0.86,-0.52,-0.01,-1.79,-0.47,-0.65,-0.64,-0.22,-1.82,-0.2,-1.04,-0.73,-0.72,-1.61,-0.78,0.32,-1.17,-0.27,-0.96,-0.61,-0.64,-0.38,-0.54,0.51,-0.85,-0.02,-1.54,-0.69,-0.12,-0.31,0.33,0.39,0.85,0.22,0.57,-0.97,-0.39,-1.2,-1.02,-1.11,-0.62,-0.01,0.1,2.14,2.55,1.58,1.44,0.47,-1.44,0.25,-0.3,0.16,-1.16,0.26,-0.77,-1.14,-1.95,-1.31,-1.21,0.63,-0.35,0.3,-0.29,1.25,0.94,1.22,0.94,1.33,1.68,1.65,0.66,-0.09,1.6,0.07,0.71,-1.07,-0.28,-0.95,-0.98,1.61,-0.78,1.04,-0.25,0.44,-0.37,-1.1,-0.56,1.06,-0.31,1.34,0.54,0.74,0.76,0.74,1.15,-0.21,1.54,0.19,0.92,-0.41,-0.57,0.06,0.21,-0.66,-0.93,-1.08,-1.52,0.6,0.08,0.96,1.37]},{"a":"lungs","b":"liver","paper":-0.42,"r":-0.31,"pr":-0.41,"xy":[0.79,0.66,0.11,-0.15,0,-0.45,0.5,-1.2,-0.94,0.59,0.51,-0.29,-1.51,0.02,-0.37,0.14,-0.72,0.03,0.4,0.15,0.56,-0.41,-0.07,-0.24,0.54,1.04,0.25,0.27,-0.34,-1.51,0.44,-1.17,0.86,0.76,-0.31,0.83,-1,1.66,-0.93,1.15,-1.5,2.63,-0.12,1.73,-0.37,0.95,-0.19,0.87,-0.65,0.88,0.28,0.57,-0.01,-0.52,-0.32,-0.84,-0.63,1.55,0.4,1.28,1.22,0.33,1.18,0.69,0.55,0.02,-0.26,0.24,-1.02,1.57,-0.29,0.28,0.11,0.29,-0.09,-0.44,0.7,0.28,1.23,0.01,0.39,-0.44,0.72,-0.12,0.2,0.74,0.29,-0.2,-0.08,-1.25,0.67,-0.99,0.03,-0.04,0.5,0.4,-1.11,-0.53,-0.61,-0.57,-1.28,0.57,-0.72,0.29,1.81,-0.44,0.63,-0.29,1.32,-0.2,0.34,-0.28,-0.47,-0.06,-0.23,0.57,-0.61,0.72,0,0.36,0.47,-0.54,0.67,-0.64,-1.05,-0.18,-1.14,0.69,-1.76,-0.34,-0.91,0.64,-1.09,0.39,-0.13,0.91,-0.59,-0.52,-0.04,-1.26,0.54,-1.35,0.99,-1.45,-0.8,-0.04,-0.13,-0.28,0.32,0.74,-0.4,0.35,2.06,0.55,0.34,-0.46,-0.55,1.81,0.27,0.7,0.25,1.22,0.5,0.44,-0.8,1.16,-0.26,0.26,-1.19,0.7,-0.19,-0.28,0.22,0.6,0.44,0.12,0.41,1.33,0.55,-0.12,0.14,-0.53,0.39,0.01,-1.4,0.68,-0.19,1.03,0.52,-1.45,0.29,-0.61,0.46,-0.89,0.25,-1.18,1.36,0.65,0.38,0.18,-0.83,-0.11,-0.03,-0.53,-1.52,2.58,0,0.87,0.81,-0.44,0.23,-0.48,-1.75,1,-0.24,0.53,-1.29,-0.51,-0.14,-0.94,-0.51,-0.43,0.15,0.13,-0.98,-1.07,-0.02,-1.73,0.62,-1.14,-0.73,-0.24,-1.5,2.68,-0.66,1.13,0.43,0.53,0.13,0.77,-0.67,-0.01,-0.38,0.54,0.31,0.32,-0.23,0.44,-1.3,-1.26,0.21,-1.38,-0.35,-0.68,-0.04,-0.72,0.85,0.3,0.33,0.14,0.76,-1.23,0.75,-0.94,0.52,-0.35,0.26,-0.35,0.15,-0.34,-0.27,0.02,0.2,-0.13,0.52,-0.06,0.19,0.11,-0.15,-0.21,0.32,-0.29,-0.15,-0.15,-0.26,-0.13,-0.01,-0.13,-1.16,-0.72,-0.03,-0.22,0.88,0.49,-0.51,0.29,1.72,-0.1,0.35,-0.48,0.4,1.68,0.33,0.59,-1.1,1.29,-1.42,1.33,2.35,-0.37,0.84,0.24,-0.68,-0.2,-0.08,0.24,0,-1.54,-0.02,-0.95,-1.75,-0.55,0.21,-0.01,-1.1,0.38,-0.95,0.36,1.26,-2.07,-0.12,-1.51,-0.45,-0.46,0.59,-0.18,-0.35,0.73,-0.45,0.02,0.85,0.27,0.84,0.25,0.41,-0.74,-0.26,-0.22,0.67,-1.2,0.07,-0.41,-1.23,1.02,-0.44,0.54,-0.01,-0.51,0.19,-0.46,-0.85,3.53,0.2,1.82,-1.47,0.32,-0.47,0.15,0.5,0.68,-0.35,0.52,1.16,-1.87,0.28,-1.6,0.5,-0.93,-0.2,-0.19,0.02,0.47,-0.25,0.87,-0.79,1.99,-0.12,0.2,-0.3,-0.52,0.34,-1.18,0.2,-0.93,0.85,-0.1,2.13,-0.81,0.78,-0.38,-1.65,1.25,-0.74,0.67,-0.04,1.18,-0.12,0.56,-0.97,-1.02,-0.02,-0.29,-0.47,-1.21,0,-1.3,0.41,-0.1,0.08,0.54,-0.46,-0.63,0.16,-0.67,-0.7,1.13,-0.47,0.88,0.66,-0.48,0.52,-1.21,-0.84,-0.26,-0.82,0.55,-0.87,0.79,-1.03,0.75,0.67,-1.54,0.68,-1.85,1.15,-1.34,0.64,0.05,0.51,-0.33,0.01,-0.98,0.21,-0.62,-0.09,-0.87,0.1,-0.84,0.53,-0.54,2.41,-0.52,1.74,-0.1,0.62,-1.64,0.69,-0.03,1.47,-0.24,0.44,-0.91,0,0.54,-0.04,0.46,0.15,1.37,-0.47,1.3,-0.42,1.5,-0.82,0.84,0.47,0.42,0.93,0.69,-0.3,0.58,-0.35,0.41,-0.69,0.65,0.02,0.27,1.68,-0.98,1.13,-1.11,1.14,-0.44,0.36,0.29,0.18,-0.55,0.05,0.03,-0.12,0.6,-0.13,-0.16,-0.81,1.24,-0.66,0.38,0.32,-0.16,0.33,0.08,-1.22,1.43,-0.8,1.41,-1.56,0.67,-1.28,0.94,0.06,2.21,0.06,1,1.49,-0.2,0.3,-0.62,1.07,-0.06,0.14,-0.03,-0.16,-0.75,-0.17,-0.45,0.24,-0.93,-1.02,0.48,0.46,0.24,0.65,0.54,-0.29,1.15,-0.3,1.94,-1.88,2.16,-1.59,2.27,0.76,-0.91,0.56,-0.28,-0.13,-1.06,0.42,-0.47,1.08,-2.22,0.13,-2.11,-0.21,-0.33,0.46,-0.79,0.57,-0.73,1.27,-0.85,-0.65,1.29,-0.69,1.27,0.76,-1.46,1,-1.38,1.13,-0.55,-0.41,-0.03,-0.17,0.92,-0.01,0.2,-0.66,0.18,0.01,0.35,1.19,-0.5,0.16,-0.23,-0.59,-0.16,-0.74,-0.05,-0.07,-0.1,-0.19,-1.29,-0.65,-3.34,-0.02,-2.54,-1.45,0.78,0.09,-0.52,0.01,1.13,-0.49,0.65,-0.55,0.11,-0.93,0.03,-1.9,2.5,-0.56,0.93,0,-1.05,0.49,-0.99,-0.82,1.98,-0.56,2.29,1.34,0.13,0.61,0.57,-0.19,-0.37,0.48,-0.92,1.65,-0.12,1.01,0.75,-1.56,1.44,-0.01,1.37,-1.84,0.49,-1.06,-0.02,0.63,0.09,-0.08,0.18,-0.78,0.97,-0.37,0.63,1.43,-0.35,0.29,-0.25,0.75,-1.33,-0.68,-1.13,2.55,-0.07,1.29,0.16,1.5,-0.6,0.98,-0.32,0.93,0.22,0.79,-0.19,-0.27,-1.45,0.08,-1.24,0.29,-0.77,0.37,-0.8,0.8,-0.43,0.55,0.35,1.26,-0.59,0.29,0.16,0.53,1.06,-0.52,1.01,0.17,-1.19,-0.83,-0.2,0.05,0.5,0.02,1.22,0.07,-0.35,0.41,-0.62,1.56,1.24,0.11,1.3,-0.82,-1.76,-0.34,-1.16,0.34,-0.49,0.31,-0.36,-0.08,1.04,0.31,0.08,-0.58,-1.42,-0.8,-0.49,-0.84,0.31,-0.7,1.26,0.23,0.52,-1.27,0.71,-1.57,0.45,-0.01,-0.7,0.56,1.97,0.37,1.17,0.63,-0.98,0.34,-1.38,-1.02,0.55,-0.5,0.63,-0.01,1.75,-0.01,0.78,0.19,1.18,-0.04,1.04,0.85,-0.14,0.29,-0.7,-0.43,-1.39,-0.75,-0.99,0.36,0.64,-0.4,1.11,-0.93,1.29,-0.25,0.38,1.63,-0.65,0.72,-0.83,0.26,-0.39,-0.1,0.1,-0.06,-1.09,0.21,-0.72,-0.3,-1.27,0.1,-1.45,0.85,1.1,0.29,0.34,-0.59,0.18,-0.24,0.33,-0.91,-0.68,-0.48,-0.55,1.44,0.12,-0.53,0.79,0.65,0.33,0.99,0.7,-0.75,0.89,-0.88,-0.02,-0.66,0.16,-0.3,0.55,-0.09,0.3,0.76,0.04,-0.11,-0.49,0.63,-0.74,-0.35,-1,0.53,-1.73,0.4,0.24,0.17,-0.14,-0.01,-1.11,0.15,-0.68,1.39,-0.98,0.76,-0.32,0.57,0.18,0.05,0.49,0.97,-0.13,0.44,-0.97,-0.04,-1.03,0.92,-1.5,-0.26,0.84,-0.38,0.89,0.63,-2.03,-0.05,-0.55,-0.15,0.56,-0.51,0.12,0.3,-0.55,0.37,-0.07,0.52,0.41,1.3,0.57,0.1,0.5,0.3,0.08,0.42,-1.44,-0.45,-0.6,-0.99,-1.23,-0.28,-0.9,0.07,-0.44,0.27,-0.3,0.01,-0.49,0.34,-0.14,-0.11,-0.43,-0.35,-0.61,1.16,-1.2,0.43,-1.13,-1.02,0.34,-0.57,0.47,0.3,0.56,-0.22,0.25,0.49,0.24,0.21,0.11,-0.2,-0.89,-0.06,-0.46,-0.9,0.44,-1.34,-0.38,-1.04,-0.26,-0.14,0.13,-2.14,1.25,-0.83,1.6,0.4,-0.42,0.66,-0.59,-0.66,1.26,-0.28,1.06,-0.69,2.35,-0.3,1.59,0.2,-1.52,-0.36,-0.57,1.37,1.22,0.37,1.11,0.86,-0.26,0.78,-0.43,-0.79,-0.85,-0.03,-0.74,-0.9,0.11,-0.24,0.33,1.87,0.42,0.09,0.79,0.1,0.04,-0.49,0.15,-0.33,-0.21,0.12,0.59,-1.18,-0.43,-0.55,-1.28,0.69,-0.58,-0.24,-0.59,-1.04,-0.82,-1.13,-0.62,-0.19,-1.4,-0.38,-0.08,-0.65,2.05,-0.89,1.04,0.74,0.24,0.41,-0.48,0.67,-0.65,0.62,-0.21,0.66,-0.5,0.26,-0.25,-0.79,-0.35,0.21,-0.06,0.24,1.63,0.05,0.63,0.38,-0.3,1.18,-0.32,1.37,-0.46,1.25,-0.23,1.09,0.39,0.51,0.16,1.5,0.13,0.62,-1.01,1.31,1.32,0.25,0.87,-0.49,-0.24,-0.38,0,0.66,-2.01,1.16,-1.52,0.73,-0.9,0.16,-0.67,1.99,0.8,0.66,0.16,0.84,1.53,0.44,0.27,-0.41,-0.66,-0.23,-0.74,-0.72,1.54,0.09,0.91,-0.8,0.55,0.34,-0.67,2.52,-0.77,1.64,-1.32,0.26,1.1,-0.01,1.15,1.15,1.51,0.38,0.82,-0.91,1.14,-0.11,0.92,1.16,-0.03,0.18,-0.53,-1.43,1.4,-0.35,0.8,-1.48,1.16,-0.41,0.02,-0.78,1.79,-0.56,1.12,-0.36,-0.08,0.32,1.09,0.23,0.77,-0.2,0.97,-0.55,0.23,-0.97,-0.16,-0.14,-0.49,-0.19,-0.56,-1.03,1.88,-0.12,0.89,0.25,-1.43,0.3,-0.93,-1.18,0.17,0.07,0.28,0.68,0.35,0.47,0.02,-0.56,2.01,-0.33,1.08,1.36,-1.32,0.41,-0.36,1.01,-0.47,1.19,-0.55,-0.62,-0.04,-1.17,0.27,-1.98,0.84,-1.19,0.45,0.24,1.16,0.08,1.12,0.04,0.19,1,-1.28,1.07,0.83,0.86,0.71,0.17,0.15,0.04,-0.43,0.43,0.65,-0.44,0.24,0.7,-0.43,0.37,-0.64,-0.6,-0.84,0.03,-0.47,0.09,1.89,0.54,1.31,-1.16,-1,-0.77,-0.41,-0.52,-0.76,-0.25,-1,-0.44,1.25,-0.48,0.58,1.11,-1.1,1.14,-1,-0.37,0.81,0.24,0.66,1.23,0.28,1.14,0.26,-0.76,0.75,-0.25,-0.22,-0.84,0.18,-0.08,-0.08,0.74,-0.15,0.17,0.88,0.58,-1.17,0.3,-0.63,1.11,-2.51,0.22,-1.82,0.39,-1.05,0.29,-0.96,-0.95,-1.41,-0.9,0.14,0.81,-1.71,-0.31,-0.76,1.23,-1.19,-0.12,-1.13,-0.58,1.11,-0.68,1.2,0.26,-0.26,-0.01,-0.69,-0.27,2.13,-0.08,1.57,-0.22,0.39,0.29,0.34,-0.51,1.32,-0.51,0.78,-0.16,-0.59,0.58,-0.41,-0.73,1.35,0.08,0.26,1.36,-0.82,0.62,-0.87,0.19,-0.61,0.09,-0.46,-1.76,-0.16,-0.34,-0.06,0.47,0.31,0.93,-0.57,0.23,0.04,-0.2,-0.08,-0.18,0.5,-0.63,0.53,1.37,1.16,0.63,1.13,-0.58,-1.01,-0.57,-0.01,-2.55,0.22,-0.75,0.07,1.23,0.45,0.62,0.45,1.43,-0.07,0.59,-0.69,-2.38,-0.78,-0.62,-1.13,-1.43,1.07,-0.72,1.02,0.15,0.41,0.2,0.4,0.36,0.31,0.45,-0.37,-0.67,0.11,-0.61,0.2,0.3,-0.6,0.08,0.47,0.18,0.25,-0.51,1.16,-0.98,-1.3,-0.56,-0.62,0.19,-0.16,0.65,-0.7,-0.31,0.27,-0.42,0.77,1.03,1.26,0.35,0.37,-0.23,-0.03,-0.83,-0.27,1.4,-0.3,0.97,-0.4,-0.67,0.12,0.13,0.27,0.44,1.13,0.34,1.52,-0.92,0.04,-0.99,0.81,0.2,-0.27,0.24,0.57,0.5,-0.66,-0.79,-0.54,-0.08,-0.55,0.26,-1.41,0.07,-0.68,0.96,-1.41,-0.92,-0.05,-0.54,-0.05,0.61,0.41,0.13,0.35,1.52,-0.03,0.5,0.31,0.08,1.19,0.04,0.43,-0.13,-0.81,-0.26,-0.8,0.01,0.46,-0.21,0.27,-1.44,0.06,-0.96,0.36,-1.02,-1.02,-0.36,-0.38,-0.65,0.97,-1.06,1.18,-0.84,-0.72,0.63,-0.94,-0.03,1.92,-0.49,1.02,0.05,0.55,-0.03,-0.32,0.8,0.29,0.37,-0.35,0.45,-0.73,0.71,-0.02,-0.44,-0.23,0.53,-0.29,-0.7,1.2,-1.82,1.45,1.01,-0.27,1.21,0.27,-0.35,-0.93,0.23,-0.98,2,-1.07,1.12,-1.11,-1,-0.86,-0.8,-0.11,0.6,0.71,0.77,-0.05,-0.52,0.74,-0.51,1.25,1.59,-0.47,1.3,-0.97,0.46,0.81,0.52,0.46,0.75,-1.36,-0.04,-0.27,-0.23,1.19,-0.13,0.56,-1.98,1.96,-0.4,0.54,-1.73,1.37,-0.75,1.62,-0.01,0.21,-0.21,0.74,-1.16,-2.15,-0.45,-0.74,0,0.24,0.55,0.64,1.13,-0.82,1.07,-1.02,-2.44,-0.49,0.02,0.09,-0.48,0.07,0.63,-0.21,-1.26,2.24,-0.53,0.74,0.64,-0.87,-0.16,-0.82,-0.56,1.74,0.36,1.15,-0.12,-1.36,0.8,-0.96,1.76,0.16,0.56,-0.35,-0.94,-0.77,-0.09,-0.7,-0.48,-0.86,-0.33,0.13,1.49,0.75,-0.25,1.16,-0.83,1.87,0.02,1.26,0.63,-1.6,0.52,-1.13,-0.46,-1.96,0.74,-1.2,-0.97,-1.49,-0.25,-0.8,1.54,-1.04,0.13,0.35,-1.38,1.32,-0.45,1.39,-0.26,0.68,-0.65,0.13,-1.51,-0.22,0.06,-0.49,-1.35,0.44,-0.3,-0.33,1.42,-0.54,0.16,-1.08,0.59,-1.43,-0.38,-0.15,-0.11,1.23,-0.16,0.93,0.27,-1.78,1.11,-1.83,-1.2,1.4,-0.84,0.49,-1.22,-0.35,0.09,-0.93,-0.72,1.43,-1.23,1.14,0.43,0.04,-0.15,0.64,1.39,0.01,0.59,-0.13,1.64,-0.68,0.82,-1.07,0.95,1.15,0.2,1.33,0.2,-1.3,0.01,-0.86,-1.38,-0.94,-0.71,0.3,-0.17,-0.27,-0.38,-0.35,0.33,-0.55,0.57,-0.29,-0.29,0.19,-0.86,0.33,0.4,-1.87,-0.29,-0.71,-0.82,0.66,-0.01,0.79,0.04,1.93,-0.33,1.14,-1.5,1.01,-1.29,1.06,0.52,-1.13,0.68,-1.02,-2.44,1.71,-0.52,1.06,-0.08,-0.28,-0.87,0.65,-0.54,0.87,-0.1,1.08,0.44,-0.68,0.36,-0.29,1.39,-0.46,0.34,-0.31,1.09,-1.53,0.24,-0.13,-2.35,1.51,-1.7,0.6,-1.3,-0.33,-0.96,-0.18,0.95,-2.02,0.32,-0.61,1.06,-0.08,0.59,0.05,-0.41,-0.75,-0.09,-0.93,0.77,-0.7,0.78,-0.82,-1.51,0.1,0.41,-0.35,0.36,1.05,1.24,-0.03,1.63,0.19,0.44,0.05,0.04,0.63,0.63,0.23,-2.42,0.36,0.07,-0.88,-1.5,-0.14,-1.19,0.25,0.85,1.64,-0.28,1.13,-0.72,1.38,-1.41,2.15,1.16,0.36,-0.66,0.63,-0.44,1.23,-0.42,0.46,0.13,0.46,-0.49,0.05,-0.92,0.22,-0.18,0.52,1.24,-1.58,1.22,-1.16,1.19,-0.67,0,0.14,0.5,-1.11,0.85,-1.7,0.12,0.48,-0.42,0.36,1.58,0.16,0.57,-0.12,-1.82,0.12,-0.6,-0.05,-1.32,1.58,-1.22,1.4,0.11,1.24,-0.52,1.09,-2.36,0.27,-0.29,0.87,0.42,0.18,-0.51,0.52,1.2,-0.11,0.63,-0.35,1.19,-0.48,0.86,-0.2,-0.84,-0.23,-0.76,-0.41,1.24,0.21,0.61,0.43,0.33,-0.58,-0.86,-1.13,-0.17,1.07,-0.74,0.48,0.69,-0.42,0.24,-0.73,0.8,-0.07,0.67,-0.33,0.2,-0.51,-0.49,-0.53,-0.69,0.14,-0.63,0.53,0.58,1.45,-0.43,1.09,-0.76,0.54,-0.08,0.8,-0.07,0.28,0.35,-0.9,-0.47,0.97,-0.54,0.85,1.13,-0.64,0.42,0.09,0.22,0.88,0.42,0.37,0.71,0.11,0.21,0.24,-0.99,-0.36,-0.87,0.06,0.34,-0.84,0.5,-1.07,2.43,-1.21,0.54,-1.01,0.52,1.22,-0.53,0.59,0.17,1.03,-0.01,-0.08,1.31,-1.53,1.66,-1.45,0.76,-0.04,0.98,-0.32,0.12,1.15,0.56,0.7,0.89,-0.57,0.21,-0.31,-0.27,-0.04,0.52,-0.18,-0.48,-0.81,-0.34,-0.51,-0.69,1.32,-0.74,1.1,0.47,1.22,0.58,-0.05,-0.79,0.94,-0.11,1.15,-1.87,0.38,-0.2,0.13,0.58,1.25,-0.11,1.28,-0.73,0.53,-0.16,0.68,0.11,1.39,0.05,0.81,0.99,1.44,0.74,0.22,0.66,0.71,0.4,0.39,-1.01,0.91,-0.99,0.45,0.62,-2.01,0.75,-2.05,-0.67,-2.03,0.03,-0.52,0.81,0.3,-0.12,-0.12,-0.14,-0.13,-0.64,0.19,1.1,-1.47,0.19,-1.39,-0.79,-0.89,0.36,-0.24,0.72,0.8,0.04,0.03,0.84,-1.49,0.1,-1.71,-0.88,1.19,-0.25,1.19,-0.62,-0.05,-0.37,-0.33,0.76,-0.26,0.02,0.85,0.55,0.4,-0.12,0.8,1.33,-0.28,-0.02,0.27,0.08,-0.43,0.16,-0.18,0.37,-0.74,0.58,-0.64,0.55,-1.89,0.55,-1.44,-1.84,1.41,-1.01,0.79,0.35,-1.46,-0.05,-0.46,1.24,1.35,-0.36,0.31,-0.41,0.36,-0.88,-0.57,0.45,-0.26,0.54,-0.15,-0.51,0.03,-0.36,0.44,0.7,1.54,0.12,0.92,1.46,0.27,0.78,-0.35,1.57,-1.97,0.84,-1.44,1.32,-0.33,0.57,-0.89,1.88,-1.25,0.44,-1.11,-1.22,2,-0.37,1.12,-0.51,-0.01,-0.93,0.44,0.2,-0.81,0.46,-0.97,0.71,0.86,0.27,0.31,-0.16,1.07,-0.35,1.37,1.21,-2.75,0.91,-1.45,-0.54,0.02,-0.48,-0.11,1.05,1.35,0.24,0.8,-1.09,-1.56,0.11,-1.72,1.17,0.02,-0.02,-0.14,-0.17,-0.3,0.23,-0.77,-0.91,-0.02,-1.07,-0.14,-0.61,0.51,-0.03,-0.68,0.88,0.28,-0.02,0.23,-0.56,1.16,-0.07,0.65,-0.37,-1.36,-0.46,-0.61,0.28,0.18,-0.44,0.13,0.3,-0.47,-0.33,0.12,-0.65,-1.02,-0.51,-1.17,0.21,-1.72,0.38,-1.55,-0.16,-0.87,0.13,-0.04,-0.12,-0.79,0.78,-0.4,-0.26,0.94,0.19,0.37,-0.64,1.46,-0.75,1.02,-1.54,0.82,-0.47,1.14,0.54,-0.94,-0.89,0.15,0.65,0.97,-0.24,0.56,-0.63,-0.14,0.05,-0.37,0.56,-0.9,0.7,-0.78,-0.11,0.99,0.74,-0.08,-0.41,0.67,0.02,0.2,-1.72,1.42,-0.32,0.45,1.04,-1.24,0.66,-1.05,-0.85,0.56,-0.41,-0.15,1.22,-0.38,0.13,0.07,-0.99,0.36,-1.03,0.59,0.13,1.22,0.07,0.03,-0.07,0.14,0.43,-0.97,-1.24,-0.11,-0.28,-0.35,0.52,-0.1,-0.49,-0.19,-0.32,0.22,-0.89,-0.23,-2.03,1.22,-1.03,1.91,-0.58,-1.1,0.36,-1.17,0.86,-0.81,0,-1.06,0.01,0.6,-0.12,0.81,-0.63,1.49,-0.91,1.5,-2.84,2.73,-0.91,1.55,-1.17,0.05,-0.27,-0.02,-2.51,1.17,-0.6,1.04,0.61,-1.27,0.33,-0.93,0.39,-0.33,0.07,-0.66,0.97,-1.14,1.34,-2.25,-0.46,1.36,-1.09,0.34,2.59,0.58,0.78,0.27,1.27,0.43,0.34,0.39,-1.02,-0.94,-0.2,-0.86,-0.51,0.02,0.21,-0.21,-1.01,0.6,-0.26,1.2,1.57,0.11,-0.16,1,0.05,-0.25,-0.09,-0.33,-0.83,-0.53,-0.02,-1.11,-0.79,1.58,-1.04,1.51,0.56,-0.35,1.24,-1.24,0.24,2.06,0.36,1.35,1.75,-0.41,0.17,0.18,-0.12,-0.06,-0.53,-0.23,1.06,-0.61,0.21,-0.39,0.4,-0.93,0.86,-0.38,-1.01,1.69,-0.43,0.43,0.27,0.66,-0.14,0.69,1.21,-1.58,0.23,-0.26,-1.25,0.72,-1.79,0.7,-0.92,-2.13,0.26,-2.19,0.32,-1.3,0.16,-1.1,-1.55,0.67,-0.58,0.48,0.39,-0.23,-0.24,-0.09,-0.46,-0.36,0.11,-0.17,0.57,1.27,0.25,0.77,0.77,-1.4,0.86,-1.29,0.78,-0.83,0.08,-0.67,-0.17,-0.65,0.01,-0.01,-0.02,-0.99,0.1,-0.95,-1.48,1.51,-0.95,1.01,0.86,-1.3,0.39,-0.64,1.46,-0.42,0.45,0.19,-0.28,0.04,0.64,-0.29,-0.11,0.18,-1.09,0.83,-0.07,0.53,-0.17,0.23,-0.62,0.98,-0.37,0.04,-1.27,2.32,-0.7,0.45,-1.45,0.21,-0.12,1.39,-0.97,3.55,-0.97,1.91,-0.85,1.43,-0.87,0.4,0.82,0.98,0.69,0.95,0.16,0.05,0.79,0.12,-0.28,-0.62,-0.25,-0.49,-0.35,0.25,-0.69,0.17,-0.81,0.71,0.61,0.57,-0.23,0.01,0.1,-0.5,-0.1,0.94,0.59,-0.01,-1.24,-0.08,-0.85,0.08,-0.34,-0.15,-0.03,-0.18,-1.71,0.14,-0.61,-0.69,0.73,0.06,0.83,0.44,1.96,0.3,1,-0.07,0.79,-1.47,0.71,-0.82,-0.04,-0.43,-0.51,-0.67,-0.86,1.89,0.13,0.65,-0.47,-1.45,-0.45,0.73,-1.82,0.99,-1.04,0.43,-0.72,0.97,0.08,0.51,-1.17,-0.16,-0.34,-1.54,-0.64,-1.22,-0.02,-0.93,-0.85,-0.09,-1.25,-0.95,-0.12,-0.2,0.47,0.2,0.85,-1.06,0.74,-1.01,-0.39,-1.54,0.01,-0.96,-0.62,-2.1,0.65,-1.85,2.55,-0.19,0.51,-0.2,-1.44,2.1,-0.65,0.68,-1.16,1.27,-1.09,0.53,-1.95,1.18,-0.52,0.44,-0.35,-0.57,-0.31,-0.56,0.94,0.93,-0.05,0.77,1.68,-1.66,-0.12,-0.84,1.6,-1.03,0.73,-0.22,-0.28,-1.49,0.1,-1.66,-0.78,1.43,-0.71,-0.63,-0.37,1.81,0,0.43,-0.31,0.89,-0.55,0.89,0.76,1.26,0.11,1.99,1.54,-0.94,0.83,-0.09,-0.57,-0.22,0.04,0.45,-0.93,0.35,-1.26,1.41,0.08,2.19,0.09,2.3]},{"a":"intestine","b":"marrow","paper":0.37,"r":0.28,"pr":0.3,"xy":[0.96,-0.43,0.94,-0.17,0.59,0.11,0.71,0.32,0.56,0.35,0.42,0.24,-0.23,-0.33,-0.25,-0.35,1.72,-2.31,1.46,-2.1,0.69,-0.49,0.63,-0.4,0.03,-0.06,0.09,0.12,0.24,-0.09,0.77,0.02,0.08,0.25,0.07,0.5,0.45,-1.7,-0.62,-1.82,0,0.9,-0.57,0.32,-0.31,-1.38,-0.3,-1.36,0.91,-0.44,0.28,-0.97,-1.65,-0.41,-1.43,0,0.24,-0.76,0.46,-0.86,0.02,0.01,0.66,-0.23,-0.56,0.85,-0.25,1.08,-0.06,-0.26,-0.57,-0.09,0.1,0.03,-0.11,0.03,1.19,1.14,1.52,0.97,1.79,0.56,2.13,0.55,0.73,-0.79,0.68,-0.67,-0.11,1.22,0.25,0.85,-0.68,0.01,-0.15,-0.13,1.6,0.23,0.96,0.41,-0.18,-0.04,-0.31,0.3,-1.64,-0.53,-0.92,-0.15,-1.5,-0.05,-1.18,-0.11,-0.59,0.54,-0.17,0.56,-0.09,0.98,-0.14,1.13,0.26,0.76,0.67,0.84,-0.3,-1.52,-0.09,-1.06,-0.42,-2.1,-0.29,-1.78,-0.23,0.72,0.14,0.52,1.49,1.33,0.87,1.21,-0.21,-1.06,0.3,-1.15,-0.54,-0.77,-0.42,-0.77,-1.76,-0.06,-1.87,-0.04,-0.79,-1.42,-0.31,-1.02,-0.81,-0.19,-1.2,-0.3,1.6,-0.3,0.93,-0.64,-0.7,-0.5,-1.4,-0.66,1.27,-1.6,0.55,-1.47,0.83,0.99,0.63,0.65,0.12,0.55,-0.03,0.61,0.01,-0.03,0.58,0.1,0.12,-0.95,0.64,-0.97,-0.1,1.26,0.19,1.31,0.14,0.17,0.06,0.22,-0.8,-0.2,-0.7,-0.17,0.19,0.65,0.05,0.77,1.14,-0.24,0.36,-0.55,0.12,1.92,0.18,1.89,1.01,-0.25,0.44,-0.4,1.12,1.17,1.13,1.45,0.45,0.95,0.39,0.55,-1.25,-1.77,-1.66,-1.62,-0.86,-1.3,-0.65,-0.91,1.57,-1.04,-0.33,-1.53,-0.44,-0.76,0,-0.58,0.4,0.57,0.75,0.72,1.06,1.03,0.93,1.03,1.22,0.51,1.76,0.86,-0.16,-0.28,-0.28,-0.31,-0.18,-0.05,0.39,0.22,-1.85,-1.08,-1.35,-0.86,0.16,0.53,0.15,0.59,0.7,0.61,0.44,0.6,-0.76,-0.25,-0.05,-0.1,0.23,1.43,-0.02,1.26,-1.35,-1.08,-1.12,-1.03,1.55,1.2,1.45,1.24,1.35,1.05,1.73,1.24,0.08,-2.1,-0.95,-2.31,-0.25,-0.14,-0.1,0.17,0.93,1.3,0.41,1.08,0.25,-0.58,-0.17,-0.28,-1.37,0.57,-0.62,0.57,-0.62,0.95,-0.67,0.68,-1.4,-1.55,-0.85,-1.11,1.16,0.27,1.38,0.17,0.13,0.02,-0.59,0.12,-0.89,-0.28,-0.54,0.03,-1.66,-0.49,-0.87,-0.4,0.93,0.35,-0.13,0.29,-1.15,-1.05,-0.42,-0.96,-1.92,-1.28,-1.69,-1.11,-0.52,0.36,-0.1,0.42,0.16,-0.35,-0.34,-0.42,0.48,-0.61,0.54,-0.57,1.45,0.42,0.92,0.17,-0.49,-0.68,-0.67,-0.49,1.2,0.1,0.5,-0.05,0.48,-1.22,0.65,-0.69,-0.32,1.24,-0.21,1.23,-0.03,-0.43,-0.18,-0.66,1.14,0.06,0.1,-0.17,1.56,0.38,1.15,0.25,0.08,-1.91,0.73,-2.15,-0.9,-0.81,-0.11,-0.64,2.05,-0.63,1.22,-0.54,-0.51,-0.58,-0.6,-0.7,-0.3,-0.2,0.26,-0.23,1.57,0.1,1.29,0.32,0.08,2.48,0.56,2.24,-0.14,-1.63,-0.15,-1.6,-0.6,0.56,-0.51,0.52,0.73,0.9,0.41,0.76,-1.72,-0.3,-1.76,-0.16,-0.86,0.75,-1.43,0.71,-0.03,-0.31,0.06,-0.28,-0.86,-0.62,-0.15,-0.55,0.51,-2.06,0.47,-1.38,-0.79,0.3,-0.79,0.48,-2.06,-1.69,-1.43,-1.57,-1.23,-0.42,-0.38,-0.66,0.84,0.25,1.47,0.17,1.34,1.7,0.51,1.56,-0.47,0.57,-0.52,0.31,0.07,1.03,-0.12,1.14,0.36,0.84,-0.39,0.95,-0.24,0.79,0.29,0.52,0.9,1.87,0.42,1.59,0.06,-1.47,0.1,-1.51,-0.62,0.71,-0.05,0.62,-0.13,-1.03,0.13,-1.14,-1.31,-0.18,-1.21,-0.49,1.63,0.93,0.97,0.99,1.15,1.39,0.67,1.49,0.43,-0.57,0.62,-0.68,-0.92,0.26,-1.12,0.13,0.95,-0.52,0.64,-0.14,-0.53,-0.08,-1.38,-0.6,-0.6,-0.65,-0.67,-0.59,-0.35,0.7,-0.48,0.68,-1.65,-0.97,-1.27,-0.56,-2.24,-2.09,-2.15,-1.6,-0.29,-0.16,-0.22,-0.56,0.13,0.81,0.15,0.52,-1.01,0.01,-1.4,0.18,-0.62,-1.14,-0.27,-0.99,0.52,-1.97,0.62,-2.23,0.26,-0.7,-0.18,-0.52,-0.48,0.36,-0.68,0.29,0.77,-0.54,0.74,-0.86,-0.29,-0.01,-0.58,0.17,0.3,0.09,0.73,0.17,0.83,0.96,1,1.1,1.08,1.93,1.01,1.93,-0.18,-0.15,-0.32,-0.3,0.78,1.41,1.05,1.59,-1.07,-1.23,-1.09,-1.09,-0.48,0.76,-1.2,0.74,-1.59,0.81,-0.43,1.31,0.9,0.46,0.66,0.57,0.55,0.11,0.28,0.14,-0.95,0.61,-0.89,0.86,2.43,-0.66,1.59,-0.59,0.4,-0.03,0.41,-0.29,0.09,0.08,0.07,0.26,-0.28,0.13,-0.09,-0.26,1.7,-0.01,1.59,0.04,-0.64,-0.89,0.15,-1.01,-0.3,-1.34,-0.47,-1.66,1.33,0.95,1.23,1.25,0.61,-0.94,0.32,-0.89,-1.27,-0.13,-0.94,0.08,-1.94,0.77,-1.22,1.09,0.68,-0.44,0.53,0,-0.37,0.73,0.17,0.52,-0.14,-0.78,0.2,-0.93,-1.95,-0.51,-1.82,-0.64,-0.98,-1.08,-1,-1.19,1.03,-0.49,1.06,-0.41,-1.46,-0.36,-1,-0.77,-0.1,0.11,0.18,0.08,1.85,0.71,1.04,0.75,-0.76,-1.11,-0.55,-0.73,1.17,-0.36,1.3,-0.44,0.55,-1.16,0.55,-0.98,-1.05,-0.75,-1.16,-0.91,-0.68,-0.96,-0.5,-0.78,-1.3,-0.45,-0.95,-0.41,1.4,0.69,0.98,0.72,-1.41,2.01,-0.72,2.31,-1.11,0.84,-0.99,0.73,-0.47,-1.01,-0.51,-0.65,1.04,0.51,0.76,0.69,-0.44,-0.56,-0.77,-0.79,0.53,0.21,0.65,0.51,1.73,1.54,1.35,1.42,0.51,-1,0.32,-1.04,0.92,0.83,0.8,0.86,0.46,-0.16,0.14,-0.08,-0.52,0.92,-0.71,0.98,-1.24,0.43,-1.14,0.47,-0.31,0.3,-0.53,0.21,-0.82,0.45,-0.44,0.48,-1.59,0.27,-1.02,0.2,-0.79,0.14,-0.12,0.47,0.1,-0.61,-0.14,-0.44,-1.03,0.92,-1.01,0.79,-0.2,-0.09,-0.02,-0.05,0.46,-0.09,0.17,-0.07,-0.83,-0.99,-1.04,-0.95,-0.72,-0.11,0.14,-0.06,1.77,1.14,1.1,1.54,-1.84,-1.33,-1.53,-1.19,0.28,-1.22,0.56,-1.52,1.25,-0.54,0.96,-0.71,1.02,-0.23,1.41,0.07,1.25,0.83,0.78,0.8,-0.98,-0.4,-0.67,-0.36,0.84,0.85,1.66,1,-0.16,0.12,-0.03,0.11,1.52,0.19,0.95,0.11,1.07,1.67,1.68,1.67,0.82,-0.39,0.57,-0.28,-3.23,-0.7,-2.57,-0.84,0.77,0.43,0.18,0.32,-0.07,-1.58,0.14,-1.57,0.39,-0.14,1.26,-0.37,0.09,-0.01,0.09,0,0.29,-1.24,0.46,-0.8,0.32,-1.01,0.6,-0.76,1.57,0.29,1.36,0.28,0.24,1.13,0.62,1.06,0.31,0.06,0.07,0.26,-2.6,-1.03,-2.36,-1,-0.13,0.19,-0.75,-0.19,1.68,1.9,1.24,1.89,1.36,1.09,1.61,1.31,-1.24,-1.64,-0.75,-1.34,-0.29,-0.27,-1.11,0.04,0.71,0.25,0.71,0.23,1.65,1.13,1.29,0.97,-0.43,-0.44,-0.25,-0.5,1.8,1.89,1.26,1.54,0.79,-0.21,0.14,-0.25,-0.69,1.39,-0.59,1.54,-1.26,0.2,-1.27,0.01,-0.07,0.21,0.08,0.19,-0.43,0.3,-0.15,0.62,-0.71,0.66,-0.49,0.76,-0.57,-1.86,-0.4,-1.66,-0.77,1.27,-0.89,1.46,-1.66,-0.22,-1.18,-0.27,1.7,-0.58,0.84,-0.49,-0.63,-1.39,-0.74,-1.28,-0.29,-0.38,-0.58,0.08,-0.37,-1.64,-0.32,-1.45,-0.4,-1.55,-1.06,-1.25,0.41,-0.93,-0.17,-1.09,-0.69,-0.46,0.24,-0.47,-1.98,-0.08,-1.63,-0.23,-0.31,0.39,0.12,0.38,0.21,-0.56,-0.43,-0.69,1.9,-1.01,1.81,-1.43,0.89,-0.13,1.65,-0.16,0.41,0.38,0.46,0.13,0.15,0.04,0.32,0.06,0.21,0.95,0.08,0.77,-0.62,0.25,-0.67,0.2,-0.25,0.86,0.39,0.71,-0.02,0.43,0,0.37,1.37,-0.59,0.93,-0.96,-0.57,0.51,-0.93,0.25,-0.31,-0.03,-0.8,-0.17,-0.2,-0.76,-0.37,-1.08,1.26,-1.69,0.4,-1.83,2.17,0.53,2.33,0.65,0,1.15,0.18,1.26,-0.16,-0.22,-0.58,-0.56,-1.28,-1.24,-1.47,-1.49,-0.81,0.21,-0.68,0.37,0.17,-0.23,0.07,-0.14,1.56,1.38,0.69,1.4,2.33,1.34,1.81,1.43,-1.28,0.45,-0.1,0.21,-0.64,2.04,-0.59,1.92,-0.55,0.31,-1.03,0.58,-0.41,0.14,-0.33,0.4,0.39,-0.78,-0.24,-1.13,-0.58,-1.41,-0.11,-1.2,0.31,0.16,0.78,0.26,1.61,0.85,1.48,0.79,0.32,-1.35,-0.34,-1.33,-0.31,-0.5,0.65,-0.17,-0.45,-0.92,0.19,-0.86,0.11,-0.29,-0.53,-0.03,-0.95,0,-1.16,0.13,0.18,-1.72,-0.02,-1.78,0.87,-0.82,0.7,-0.86,-0.07,1.74,0.65,1.68,1.34,2.71,0.69,2.51,-0.51,-1.27,-0.95,-1.14,-0.04,-1.73,0.21,-1.32,-0.19,0.83,-0.04,0.85,-0.24,0.97,-0.68,0.29,0.15,0.66,0.17,0.92,-0.15,0.83,-0.36,0.82,1.88,-0.69,1.27,-0.42,0.35,0.79,1.02,0.76,-1.24,-0.16,-1.26,-0.44,-0.16,-1.47,0.41,-1.55,0.25,1.39,-0.48,1.06,0.4,0.38,0,0.22,-1.75,-1.9,-0.98,-1.78,-0.17,-2.3,-0.12,-2.2,-1.33,-1.18,-0.52,-0.65,0.07,0.65,0.52,0.81,-1.78,-0.25,-1.66,-0.21,-1.06,-0.94,-0.9,-0.47,-1.01,0.64,-0.67,1.1,2.55,1.18,1.97,1.25,0.2,-0.29,-0.04,-0.19,1.49,0.46,1.19,0.38,0.22,-1.03,0.32,-0.86,0.58,0.91,-0.09,0.99,-1.17,0.73,-0.14,0.72,0.96,1.81,0.6,1.68,0.96,1.76,1.15,1.67,0,0.22,0.22,0.4,0.82,-0.32,0.9,-0.04,0.07,0.06,0.23,0.04,0,-0.57,0.41,-0.25,0.14,-0.33,-0.28,-0.26,-1.13,-1.59,-1.14,-1.88,0.27,-0.55,0.75,-0.25,-0.15,0.35,-0.37,0.39,-1.43,-0.3,-1.05,-0.35,0.78,0.04,0.78,0.24,0.6,0.68,0.18,0.83,0.54,-0.6,0.02,-0.56,-0.72,-0.23,-0.47,-0.21,0.41,0.53,0.65,0.59,0.82,0.78,1.01,0.98,1.49,2.1,2.02,2.27,-1.02,-0.81,-0.84,-0.78,-0.42,-1.51,-0.49,-1.36,0.12,-0.52,0.17,-0.64,0.99,0.19,1.03,0.32,-0.34,0.24,-0.58,-0.02,1.07,0.03,0.49,0.15,-0.42,-1.36,0.07,-1.36,0.35,1.39,0.45,1.22,-1.27,-1.19,-0.74,-1.13,-1.33,-0.09,-1.26,-0.07,-0.32,2.36,0.5,2.3,-0.17,0.48,-0.85,0.48,1.77,1.94,1.43,1.93,0.62,1.05,0.58,0.75,1.36,2.03,1.01,2.03,0.35,-0.69,0.28,-0.71,-0.75,0.32,-0.66,0.07,-1.78,0.27,-1.58,0.27,-0.86,0,-0.84,0.16,0.09,-0.63,-0.39,-0.67,-0.49,0.36,-0.26,0.75,-1.34,-2.27,-0.67,-1.92,-1.99,-0.41,-1.95,-0.21,0.27,0.66,0.5,0.39,-0.44,-0.24,-1.52,-0.58,0.83,0.58,0.56,1.02,-0.1,0.58,-0.24,0.54,-0.05,-0.35,0.44,-0.6,-0.78,-0.2,-0.34,-0.21,1.15,0.27,0.56,0.77,0.47,-0.74,1.02,-0.97,0.79,-0.57,1.11,-0.4,-0.25,-0.26,0.27,-0.31,-0.03,0.56,-0.23,0.61,0.31,-1.03,0.2,-1.26,-0.73,0.43,-0.68,0.51,0.36,1,0.38,0.64,0.32,0.42,0.51,0.25,-3.05,0.15,-2.21,0.13,-1.45,0.67,-1.8,0.4,1.29,2.09,0.57,2.15,0.07,0.07,-0.45,-0.07,-1.16,-0.17,-1.01,-0.31,-0.97,-1.35,-0.56,-1.02,-1.34,1.13,-0.9,0.97,-0.62,-0.42,-0.07,-0.47,0.71,-0.18,0.52,-0.26,0.22,0.47,0.54,0.18,1.25,-0.02,0.19,-0.22,0.98,0.03,1.01,0.29,0.82,0.06,0.82,0.09,0.44,-0.09,0.81,-0.05,0.78,0.73,0.7,0.85,-1.26,-1.01,-1.1,-0.86,-1.46,0.13,-1.35,0.05,-1.33,0.05,-1.39,0.1,0.23,0.44,0.02,0.08,0.1,-0.63,0.33,-0.84,-1.43,-1.17,-0.83,-1.09,-0.15,-0.64,0,-0.68,-0.28,0.03,0.23,0.08,-0.42,0.08,-0.67,-0.06,0.27,-1.13,0,-0.72,0.61,-0.01,0.58,0.02,0.01,1.3,-0.71,1.05,-0.62,-0.61,-1.01,-0.38,-2.14,-1.93,-1.76,-1.69,0.21,-0.14,0.01,-0.11,-0.17,2.43,0.19,2.3,0.36,-2.02,-0.7,-1.9,0.67,-0.34,0.12,-0.59,0.11,0.02,-0.73,-0.18,-1.26,0.61,-1.05,0.55,-0.7,0.71,-0.02,0.77,0.52,-0.5,0.48,-0.52,-0.23,-0.64,-0.34,-0.84,-0.7,0.25,-0.58,0.39,-2.71,-1.04,-2.25,-0.91,1.68,1.29,1.3,1.34,-0.37,-0.16,0.05,-0.18,0.01,-0.21,-0.36,-0.01,0.33,0.75,0.5,0.89,-0.5,-0.57,-0.17,-0.59,-0.37,-0.11,-0.97,-0.24,0.36,-1.35,-0.06,-1.23,-0.07,0.63,0.34,0.56,0.65,-0.38,0.22,-0.39,-0.26,2.68,-0.53,2.34,-0.32,-0.65,0.04,-0.44,-1.76,-1.8,-1.45,-1.75,-0.05,-1.43,0.1,-1.32,-2.74,-0.57,-1.69,-0.46,0.38,-0.12,-0.75,0.03,0.86,0.02,0.4,0.18,-1.19,0.37,0.01,0.78,-0.86,0.17,-0.17,0.31,0.46,0.3,0.56,0.31,0.61,0.3,0.98,0.21,0.88,-0.51,0.99,-0.35,1.61,-0.74,1.72,-0.9,-0.55,-0.57,-0.45,-0.74,1,-0.06,0.97,-0.25,0.96,-0.66,0.83,-0.69,-1,-0.7,-1.1,-0.38,1.78,-0.43,0.82,-0.39,-0.51,-0.89,-1.06,-0.73,-0.83,-0.21,-0.64,0.05,0.64,1.09,0.12,1.04,-1.68,-1.34,-1.87,-1.18,0.63,1.38,0.89,1.25,-1,-1.13,0.19,-0.95,-0.78,-0.83,-0.56,-0.86,1.75,0.73,1.9,0.94,0.44,0.39,-0.04,0.46,0.64,-1.02,0.38,-1.25,0.93,0.68,0.55,0.63,0.97,-0.63,-0.06,-0.7,0.17,0.79,-0.21,0.75,-1.8,-2.13,-1.48,-2.22,-0.66,0.99,-1.02,0.65,-0.63,0.2,-0.35,0.15,0.36,-0.12,0.77,-0.22,0.5,0.06,-0.07,0.21,0.83,-0.65,1.08,-0.51,0.69,-0.65,0,-0.29,1.73,2.82,0.94,2.54,-0.49,0.93,-0.55,0.85,-0.29,-0.6,-0.24,-0.68,0.55,-0.18,0.35,0.02,0.71,0.69,0.53,0.84,0.03,-0.4,-0.52,-0.42,0.48,0.89,0.68,0.97,0.58,-1.35,-0.06,-1.35,0.04,0,0.02,0.04,-0.15,-0.63,0.1,-0.58,0.18,1.64,0.37,1.36,0.17,0.14,0.17,0.14,-0.68,-1.43,-1.39,-1.66,0.54,1.12,0.55,1.09,-0.59,0.21,-0.77,0.01,-0.53,-0.86,-0.81,-0.43,0.75,1.05,0.19,0.99,-0.24,-1.45,0.43,-1.48,1.23,-1.83,1.23,-1.85,0.22,-1.2,0.46,-1.35,0.36,0.58,0.83,0.89,0.63,-1.37,0.46,-1.54,-0.74,-1.14,-0.94,-1.2,0.32,0.12,0.19,0.45,1.87,0.75,1.23,0.64,0.96,0.63,0.39,0.18,0.38,0.55,0.21,0.48,0.04,-0.08,0.12,-0.13,1.14,0.21,1.07,0.19,0.38,1.69,0.57,1.66,0.72,0.17,0.94,0.19,0.73,-0.61,1.07,-0.43,0.95,0.36,0.34,0.65,0.3,1.62,0.54,1.72,-1.45,-1.46,-0.77,-1.46,0.12,1.61,-0.24,1.42,0.1,0.26,-0.01,0.3,-0.57,1.67,-0.21,1.72,0.35,-2.17,0.55,-2.14,0.07,1.38,-0.19,1.23,0.72,-0.91,0.62,-0.48,-0.82,0.1,-0.45,-0.03,0.32,0.55,0.5,0.45,-0.75,1.38,0.12,1.59,1,0.69,0.83,0.53,-0.39,-0.1,-0.19,-0.07,-0.17,1.06,-0.09,0.85,-0.13,-0.76,0.28,-0.87,-0.86,1.59,-0.14,1.74,0.22,-0.34,-0.65,-0.45,-0.66,-0.22,-0.23,0.07,0.6,0.07,-0.35,0.15,0.73,0.43,-0.02,0.71,-0.13,-0.51,0.15,-0.51,1.01,1.77,0.87,1.66,0.61,0.29,0.16,0.14,0.37,-0.09,0.34,-0.22,-1.71,-1.6,-0.63,-1.46,0.26,1.15,0.07,1.17,-0.99,0.19,-0.7,0.28,0.32,0.6,0.04,0.53,-2,0.2,-2.07,0.36,-0.37,-2.14,-0.14,-1.87,0.71,0.06,0.65,0.16,0.05,-0.27,-0.22,-0.54,-1.48,-0.62,-0.31,-0.36,0.6,1.19,0.18,1.14,-1.34,-1.01,-1.97,-1.38,-0.43,0.92,-0.17,1.05,-0.49,1.2,-0.53,1.15,0.48,0.81,0.39,0.9,-0.5,-1.22,-1.07,-0.98,-0.15,-0.9,-0.85,-0.98,-1.72,-1.66,-1.71,-1.59,0.45,-0.83,0.09,-0.7,-1.17,-0.29,-0.76,-0.01,-0.37,-0.05,-0.54,0.24,-0.18,-1.11,-0.03,-0.87,0.83,-0.46,0.56,-0.12,0.75,-0.75,0.78,-0.72,-1.47,-0.09,-0.93,0.06,0.19,-0.93,0.55,-1.01,-0.16,-1.5,-0.41,-1.58,0.31,0.19,-0.13,0.27,-0.76,-2.54,-0.78,-2.45,-2.74,-0.84,-2.32,-0.48,-0.43,0.74,-0.59,1.06,1.27,0.25,0.95,0.3,0.24,0.56,0.44,0.48,1.5,-1.4,1.57,-1.14,0.38,-1.14,0.54,-1.03,0.8,1.48,0.63,1.65,0.72,-0.01,1.1,0.29,0.76,0.08,0.39,0.31,-0.66,-0.79,-0.52,-0.7,0.31,0.09,-0.01,0.3,1.3,-1.9,0.7,-1.87,0.87,1.23,0.45,0.94,-1.31,-0.21,-1.29,-0.27,-0.25,0.19,-0.37,0.35,0.53,-1.23,0.2,-0.9,0.36,0.28,0.19,0.37,0.29,-0.24,0.34,-0.31,-0.56,-0.13,-0.59,-0.05,0.85,0.74,0.69,0.71,1.01,0.41,0.76,0.4,0.58,-0.43,-0.18,-0.61,1.03,-2.31,0.56,-2.12,-0.25,-1.35,-0.57,-1.41,-0.83,-0.53,-0.47,-0.38,0.08,0.82,-0.1,0.87,2.89,1,2.52,0.91,1.38,1.31,0.46,1.41,0.52,1.37,1.13,1.42,-1.22,-0.6,-1.4,-0.87,0.84,0.65,0.73,0.68,-0.38,1.32,-0.33,1.19,-0.33,1.99,-0.07,1.92,-1.34,0.69,-1.2,0.55,-0.15,-1.24,-0.04,-0.79,1.65,-0.09,1.04,-0.07,0.23,-0.79,-0.44,-0.82,0.84,-0.16,1.22,-0.23,0.55,-1.29,0.21,-1.52,-0.13,1.21,-0.04,1.2,1.17,0.9,0.54,1,-0.95,0.17,-0.79,0.24,0.22,0.23,0.63,0,-0.32,0.14,-0.87,0.09,-1.6,-0.66,-1.54,-0.76,0.29,-0.24,0.49,-0.35,0.6,-0.05,-0.58,0.05,-0.49,1.2,-0.16,1.31,-1.56,-0.31,-1.32,-0.16,0.49,1.35,0.17,1.26,-0.46,-0.05,-0.02,0.47,-0.16,0.33,-0.33,0.19,0.14,0.2,0.06,0.03,-0.06,-0.4,0.39,-0.39,-0.39,-1,-0.12,-0.75,1.13,-0.87,1.26,-0.63,1.24,0.96,1.26,1.09,1.7,-0.98,0.68,-0.96,-0.8,1.29,0.2,1.43,-1.58,0.09,-1.14,-0.17,1.05,0.33,1.34,0.4,-0.45,1.65,-0.33,1.99,1.9,-1.09,1.45,-0.93,1.37,0.69,0.91,0.72,1.09,2.2,-0.01,2.13,-0.67,0.19,0.08,0.1,0.4,-0.36,-1.05,-0.55,1.91,0.41,0.85,0.54,0.53,0.92,1.01,0.66,-0.75,0.03,-0.33,-0.12,0.11,0.76,0.27,0.85,-1.07,-0.69,-0.96,-0.31,1.24,0.89,1.59,0.81,0.68,-0.06,0.61,0.17,0.54,0.12,0.42,0.01,0.54,-0.13,0.37,-0.1,-0.59,-1.06,-0.75,-0.97,-0.93,1.05,-1.32,0.95,0.03,1.65,0.9,1.43,-0.45,-0.07,-0.43,-0.18,-0.23,0.01,0.27,-0.07,1.64,-0.36,1.14,-0.01,1.24,0.9,0.82,0.85,-1.06,0.5,0.13,0.73,0.31,-1.18,-0.25,-1,0.79,-0.31,0.97,-0.18,1.69,-1.03,0.65,-0.95,-1.18,-0.08,-0.92,0.14,-1.11,0.07,-2,0.2,-0.5,0.82,-0.33,0.64,-1.53,-0.87,-0.91,-0.67,-1.46,-0.73,-1,-0.49,0.84,0.71,1.43,0.87,1.44,1.3,1.79,1.45,0.69,0.71,-0.03,0.73,0.36,-0.18,-0.6,-0.25,-0.73,-1.17,-1.09,-1.18,0.96,0.01,1.05,0.45,-0.97,-0.31,-0.76,-0.23,-0.77,0.02,-0.51,0.21,0.22,0.64,0.9,0.57,-0.65,-0.57,-0.59,-0.59,1.71,1.53,0.42,1.61,0.48,-1.08,-0.12,-1.06,0.89,1.27,0.99,1.6,-0.53,-0.3,-0.63,-0.54,-0.87,0.8,-0.15,0.61,-0.17,-1.06,-0.17,-1.09,-1.23,-1.86,-1.31,-1.73,0.74,-0.2,0.64,-0.47]}]}};

// Organ icons for the PET story: a clean single-weight line icon per organ in the style of the legend of the paper's
// Figure 2 (Geist et al., Med 2025), neon on request (the vision slide's organ network). Vector paths on a 2D canvas.
// PET_ICONS.ids, PET_ICONS.draw(ctx, id, cx, cy, size, opts), PET_ICONS.atlas(THREE, px, opts) -> { texture, canvas, uv(id) }
// Every icon is drawn in a 100 x 100 box (y down); see icons.md.
const PET_ICONS = (function () {
  const ids = PET_DATA.organs.map(o => o.id), short = new Map(PET_DATA.organs.map(o => [o.id, o.short || o.id]));
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x), r2 = v => Math.round(v * 100) / 100;
  const pt = p => r2(p[0]) + ' ' + r2(p[1]), nums = d => d.match(/-?\d*\.?\d+/g).map(Number);

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
  // a symmetric closed outline from its left half: 'M x y C ...' (cubics only) from a point on x = 50 to another
  function sym(d) {
    const c = nums(d); let out = d;
    for (let b = c.length - 8; b >= 0; b -= 6) out += ` C ${pt([100 - c[b + 4], c[b + 5]])} ${pt([100 - c[b + 2], c[b + 3]])} ${pt([100 - c[b], c[b + 1]])}`;
    return out + ' Z';
  }
  // turn a path of M L C Q commands by deg (clockwise on screen) about (cx, cy), then move it by (dx, dy)
  function rot(d, deg, cx, cy, dx, dy) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), tk = d.match(/[A-Za-z]|-?\d*\.?\d+/g), out = [];
    for (let i = 0; i < tk.length; i++) {
      if (/[A-Za-z]/.test(tk[i])) { out.push(tk[i]); continue; }
      const x = +tk[i] - cx, y = +tk[++i] - cy;
      out.push(pt([cx + x * c - y * s + (dx || 0), cy + x * s + y * c + (dy || 0)]));
    }
    return out.join(' ');
  }
  const ell = (x, y, rx, ry) => `M ${r2(x - rx)} ${r2(y)} A ${rx} ${ry} 0 1 0 ${r2(x + rx)} ${r2(y)} A ${rx} ${ry} 0 1 0 ${r2(x - rx)} ${r2(y)} Z`;
  // points along a chain of cubic Béziers c = [x0, y0, (c1x, c1y, c2x, c2y, x, y)...] (or 'M x y C ...'), 20 per curve
  function bez(c) {
    if (typeof c === 'string') c = nums(c);
    const P = [];
    for (let b = 0; b + 7 < c.length; b += 6) for (let s = b ? 1 : 0; s <= 20; s++) {
      const u = s / 20, v = 1 - u, A = v * v * v, B = 3 * v * v * u, C = 3 * v * u * u, D = u * u * u;
      P.push([A * c[b] + B * c[b + 2] + C * c[b + 4] + D * c[b + 6], A * c[b + 1] + B * c[b + 3] + C * c[b + 5] + D * c[b + 7]]);
    }
    return P;
  }
  // the polyline P (from its first point on) redrawn as small lobes about step long and amp deep, bulging to the side
  // (-ty, tx) of the way it runs when sg = 1 (the other side when -1)
  function wave(P, step, amp, sg) {
    let len = 0; const S = [0];
    for (let k = 1; k < P.length; k++) S.push(len += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    const n = Math.max(1, Math.round(len / step)), Q = [];
    for (let i = 0, k = 0; i <= n; i++) { while (k < P.length - 1 && S[k] < len * i / n) k++; Q.push(P[k]); }
    let out = '';
    for (let i = 1; i < Q.length; i++) {
      const a = Q[i - 1], b = Q[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      out += ` Q ${pt([(a[0] + b[0]) / 2 - sg * (b[1] - a[1]) / l * amp * 2, (a[1] + b[1]) / 2 + sg * (b[0] - a[0]) / l * amp * 2])} ${pt(b)}`;
    }
    return out;
  }

  // a tube along a chain of cubic Béziers (as for bez); w its width, or a function (u 0..1 along it, side +1 / -1) ->
  // width; caps 'round', 'flat' or 'cut' (a cut vessel: an ellipse); bump [step, amp] makes both sides lumpy (scallop).
  // Returns { shape, open, rim, L, R, P } (outline, the outline left open at a flat start, cut rims, both edges, centre).
  function tube(c, w, cap0, cap1, bump) {
    const P = bez(c), wf = typeof w === 'function' ? w : () => w;
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
    const n = P.length - 1, Rr = R.slice().reverse();
    const edge = E => (bump ? pt(E[0]) + wave(E, bump[0], bump[1], 1) : E.map(pt).join(' L '));
    const open = 'M ' + edge(L) + cap(P[n], T[n], L[n], cap1 || 'round') + ' L ' + edge(Rr) + cap(P[0], [-T[0][0], -T[0][1]], R[0], cap0 || 'round');
    return { shape: open + ' Z', open, rim, L, R, P };
  }
  // a closed cubic outline ('M x y C ...') redrawn as small outward lobes about step long, amp deep
  function scallop(d, step, amp) {
    const P = bez(d); let A = 0;
    for (let k = 1; k < P.length; k++) A += P[k - 1][0] * P[k][1] - P[k][0] * P[k - 1][1];
    return 'M ' + pt(P[0]) + wave(P, step, amp, A > 0 ? -1 : 1) + ' Z';
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
  // the renal pelvis inside a bean: a funnel from the hilum (where the ureter leaves) widening into the kidney, its wide
  // end a hollow between two calyces (a closed, crescent-like wedge)
  function pelvis(x, y, w, h, side) {
    const p = (a, b) => pt([x + a * w * side, y + b * h]);
    return `M ${p(0.21, -0.035)} C ${p(0.08, -0.05)} ${p(-0.04, -0.12)} ${p(-0.11, -0.21)} C ${p(-0.14, -0.25)} ${p(-0.2, -0.22)} ${p(-0.17, -0.16)}` +
      ` C ${p(-0.1, -0.06)} ${p(-0.1, 0.08)} ${p(-0.17, 0.19)} C ${p(-0.2, 0.25)} ${p(-0.14, 0.28)} ${p(-0.11, 0.24)}` +
      ` C ${p(-0.04, 0.15)} ${p(0.08, 0.06)} ${p(0.21, 0.045)}`;
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
  // style; hi: true (only with detail: from 40 pixels up; a number: from that many) or lo: true (only below 40; a
  // number: below that many), w (line width factor), clip (a path the part is clipped to).
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
      // the butterfly (bow tie): two lobes tapering to their upper poles, joined low down by a narrow isthmus
      const d = sym('M 50 64 C 46 64, 43 60, 41.5 52 C 40 42, 37 24, 32 12 C 30.5 8.5, 27.5 9, 26 12.5 C 20 25, 12.5 44, 12.5 62' +
        ' C 12.5 76, 18 88, 29 89 C 37 89.5, 42 82, 45 77 C 46.5 75, 48 74.5, 50 74.5');
      return [{ s: d }, { l: comb(10, 8, 90, 92, 5.6), hi: 56, w: 0.45, clip: d }, { l: comb(4, 16, 96, 92, 12), lo: 56, w: 0.55, clip: d }];
    },
    lungs() {
      const lung = 'M 39 22 C 30 22, 22 32, 18 45 C 14 57, 12 70, 12.5 80 C 13 87, 18 89, 24 86.5 C 30 84, 37 82.5, 42 84.5 C 44.5 85.5, 45.5 83, 45.5 79 L 45.5 36 C 45.5 27, 43 22, 39 22 Z';
      const right = 'M 61 22 C 70 22, 78 32, 82 45 C 86 57, 88 70, 87.5 80 C 87 87, 82 89, 76 86.5 C 70 84, 63 82.5, 58 84.5 C 55.5 85.5, 54.5 83, 54.5 79' +
        ' L 54.5 71 C 60 68, 61 60, 54.5 56 L 54.5 36 C 54.5 27, 57 22, 61 22 Z';
      // the windpipe: a narrow tube with its cartilage rings (a single line when small), the main bronchi from its foot
      const pipe = 'M 46.5 33 L 46.5 6 L 53.5 6 L 53.5 33', bron = 'M 46.5 33 C 45 37, 43 40, 40 44 M 53.5 33 C 55 37, 57 40, 60 44';
      const rings = 'M 46.5 12 Q 50 14.5, 53.5 12 M 46.5 19 Q 50 21.5, 53.5 19 M 46.5 26 Q 50 28.5, 53.5 26';
      const fine = both('M 40 44 C 35 48, 32 54, 30 62 M 36 49 C 32 47, 28 46, 25 47 M 32 56 C 34 61, 36 65, 37 70 M 30 62 C 27 66, 24 70, 22 75');
      return [{ s: lung }, { s: right }, { l: 'M 50 6 L 50 36 M 50 36 C 48 39, 44 41, 40 44 M 50 36 C 52 39, 56 41, 60 44', lo: true },
        { l: pipe + ' ' + bron, hi: true }, { l: rings, hi: true, w: 0.55 }, { l: fine, hi: true, w: 0.8 }];
    },
    heart() {
      const d = 'M 50 87 C 34 76, 10 60, 10 37 C 10 22, 20 13, 32 13 C 41 13, 47 18.5, 50 25 C 53 18.5, 59 13, 68 13 C 80 13, 90 22, 90 37 C 90 60, 66 76, 50 87 Z';
      return [{ s: d }, { l: 'M 12.5 50 L 31 50 L 37 39 L 45 64 L 53 30 L 60 57 L 64.5 50 L 87.5 50' }];
    },
    liver() {
      const d = 'M 11 33 C 17 22, 38 19, 60 20 C 75 21, 87 24, 93 30 C 91 36, 78 43, 64 50.5 C 59 53.5, 56.5 57, 53 61 C 45 69.5, 34 79, 24 82' +
        ' C 16 84, 11.5 78, 10 67 C 8.5 55, 8 42, 11 33 Z';
      // the vena cava passing through the top (its walls run on into the liver); the gall bladder tucked under the lower
      // edge, only its tip showing
      const ivc = tube('M 42 28 C 42 21, 42 15, 42 10', 8, 'flat', 'cut');
      const gall = 'M 47.9 66.2 C 51 69, 52 73.5, 49 75 C 46 76.5, 42.5 74, 42.2 71.2';
      return [{ s: d }, { l: 'M 63 20.5 C 61 31, 59 41, 57 54' }, { l: ivc.open, hi: true }, { l: ivc.rim, hi: true }, { l: gall, hi: true }];
    },
    spleen() {
      // an upright bean leaning to the midline: the convex outer border, the hilum a hollow in the inner face with the
      // splenic vessels coming in from the left and branching up into it
      const d = 'M 53 8 C 71 8, 82 28, 82 51 C 82 75, 70 92, 52 92 C 37 92, 28 84, 28 75 C 28 67, 35 64, 39 57 C 43 49, 32 43, 32 31' +
        ' C 32 17, 40 8, 53 8 Z';
      const T = s => rot(s, -12, 55, 50, -4.5, 0);
      return [{ s: T(d) }, { l: T('M 28 66 C 32 63.5, 36 61, 41 59 M 41 59 C 44 53, 46 46, 46 38 M 41 59 C 46 55.5, 51 53, 57 52'), w: 0.85 },
        { l: T('M 44 56.5 C 49 58, 53 60.5, 56 64.5 M 44.5 50.5 C 47 48, 49 46.5, 52 45.5'), hi: true, w: 0.75 }, { l: T('M 63 15 C 72 20, 76 31, 77 43'), hi: true, w: 0.8 }];
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
      // (drawn about (45, 64), moved by (4, -4) to sit in the middle of its square)
      const M = s => rot(s, 0, 0, 0, 4, -4), k = bean(49, 60, 38, 56, 1);
      const capD = M('M 26 46.5 C 23.5 35, 31.5 21, 45 18.5 C 58.5 16.5, 69 29, 68 41.5 C 61.5 35.5, 55 32.5, 47 32.5 C 38 32.5, 30.5 37.5, 26 46.5 Z'), lump = scallop(capD, 7.2, 1.25);
      return [{ s: k }, { s: capD, lo: true }, { s: lump, hi: true }, { f: capD, o: 0.7, lo: true }, { f: lump, o: 0.4, hi: true }, { l: M('M 53 66 C 61 72, 64 82, 64 95') },
        { l: pelvis(49, 60, 38, 56, 1), hi: true, w: 0.8 }];
    },
    intestine() {
      // the colon as a lumpy frame (its haustra), cut at the rectum; inside, the small intestine winding
      const fr = [23, 84, 23, 66, 23, 48, 23, 31, 23, 25, 27, 21, 32, 21, 46, 21, 56, 21, 69, 21, 74, 21, 78, 25, 78, 30,
        78, 44, 78, 58, 78, 70, 78, 77, 74, 80, 66, 81.5, 59, 83, 55.5, 86, 55.5, 93];
      const c = tube(fr, 13, 'round', 'cut', [8.5, 1.4]);
      const s = 'M 36 34 C 42 31, 46 37, 52 34 C 58 31, 62 37, 66 34 C 70 32, 71 41, 66 42.5 C 61 44, 57 39, 51 42 C 45 45, 41 39, 36.5 43' +
        ' C 32 46.5, 35 52, 39 51 C 45 49.5, 48 55, 54 52 C 60 49, 64 54, 66 53 C 71 52, 71 61, 66 62.5 C 61 64, 57 59, 51 62' +
        ' C 45 65, 42 59, 37.5 63 C 33.5 66.5, 34 71, 29.5 72';
      // small: three bold upright runs (horizontal ones read as lines of text)
      const sl = 'M 40 69 L 40 40 C 40 33, 51 33, 51 40 L 51 61 C 51 68, 62 68, 62 61 L 62 33';
      return [{ s: c.shape }, { l: c.rim, hi: true }, { l: sl, lo: true }, { s: tube(s, 5.2, 'round', 'flat').shape, hi: true, w: 0.8 }];
    },
    muscle() {
      // a flexed arm as in the paper's legend: the fist on top, the forearm a band down to the elbow on the left, the
      // upper arm along the bottom to the shoulder, the biceps bulging above it
      const d = 'M 30 27 L 15 66 C 11 76, 14 86, 25 86.5 C 42 87.5, 66 89, 83 86.5 C 92 85, 95 74, 94 62 C 93 47, 83 35, 69.5 35' +
        ' C 56.5 35, 47.5 45, 43.5 58 L 52.5 32.5 C 58.5 32, 63 28, 62 22.5 C 65 18.5, 64 11, 58 8.5 C 52 6, 41 5.5, 35 8.5 C 28.5 12, 26.5 21, 30 27 Z';
      const curl = 'M 45 13 C 51 10.5, 57.5 12.5, 57.5 17.5 C 57.5 22, 52 24, 47.5 21.5';
      return [{ s: d }, { l: curl, hi: true, w: 0.8 }, { l: 'M 43.5 58 C 44 64, 48 68, 54 69.5', hi: true, w: 0.8 }];
    },
    marrow() {
      const d = 'M 38 41 C 29 37.5, 20.5 30, 24 19.5 C 27.5 9.5, 43 8.5, 50 17 C 57 8.5, 72.5 9.5, 76 19.5 C 79.5 30, 71 37.5, 62 41 L 62 86 A 12 4.2 0 0 1 38 86 Z';
      const cav = 'M 44 44 L 44 84 M 56 44 L 56 84';
      return [{ s: d }, { l: 'M 38 86 A 12 4.2 0 0 1 62 86' }, { f: ell(50, 86, 6.5, 2.2), o: 1 },
        { f: 'M 45 44 L 55 44 L 55 84 L 45 84 Z', o: 0.5, lo: true },
        { l: cav, hi: true, w: 0.7 }, { l: comb(42, 42, 58, 86, 3.4), hi: 64, w: 0.45, clip: 'M 44 44 L 56 44 L 56 84 L 44 84 Z' },
        { l: 'M 34 22 C 36 18, 40 16, 44 17', hi: true, w: 0.7 }];
    },
    fat() {
      // a belly: the waist, the belly bulging out below the navel, the waistband of the briefs and the legs below
      const side = 'M 28 6 C 28 16, 24.5 23, 22 31 C 19.5 39, 13.5 48, 13.5 60 C 13.5 68, 18 71, 20 75 C 21.5 79, 20.5 87, 19.5 95';
      const brief = 'M 20 74 C 34 77, 66 77, 80 74 M 20.5 79 C 33 82, 43 86, 46 93 L 54 93 C 57 86, 67 82, 79.5 79';
      const area = 'M 28 6 C 28 16, 24.5 23, 22 31 C 19.5 39, 13.5 48, 13.5 60 C 13.5 68, 18 71, 20 74 C 34 77, 66 77, 80 74' +
        ' C 82 71, 86.5 68, 86.5 60 C 86.5 48, 80.5 39, 78 31 C 75.5 23, 72 16, 72 6 Z';
      return [{ a: area, fade: [8, 40] }, { l: both(side) + ' ' + brief }, { f: ell(50, 53, 2.6, 3.6), o: 1, lo: true }, { l: ell(50, 53, 2.2, 3.4), hi: true }];
    },
    aorta() {
      // the arch as a cut vessel: the ascending aorta rising from its bulging root, the descending aorta running on
      // down; the three branches on top
      const root = u => 14 + 4 * Math.exp(-Math.pow((u - 0.04) / 0.035, 2));
      const c = tube('M 33 72 C 33 58, 29 42, 39 31 C 48 21, 64 21, 68 35 C 69.5 43, 69 52, 69 60 C 69 70, 69 82, 69 94', root, 'cut', 'cut');
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

  // per id: { parts (paths built once, on first use), th (the pixel thresholds of its parts), memo (parts in use) }
  const cache = new Map();
  function icon(id) {
    if (cache.has(id)) return cache.get(id);
    if (!own(DEF, id) || typeof Path2D === 'undefined') { cache.set(id, null); return null; }
    const th = new Set(), parts = DEF[id]().map(p => {
      const q = Object.assign({}, p, {
        s: p.s && new Path2D(p.s), l: p.l && new Path2D(p.l), a: p.a && new Path2D(p.a),
        f: p.f && new Path2D(p.f), clip: p.clip && new Path2D(p.clip),
        hi: p.hi === true ? 40 : p.hi || 0, lo: p.lo === true ? 40 : p.lo || 0,
      });
      if (q.hi) th.add(q.hi); if (q.lo) th.add(q.lo);
      return q;
    });
    const I = { parts, th: [...th].sort((a, b) => a - b), memo: {} };
    cache.set(id, I);
    return I;
  }
  // the parts shown for a forced detail (true / false) or at vis pixels
  function pick(I, det, vis) {
    const key = det != null ? (det ? 'T' : 'F') : I.th.filter(t => vis >= t).length;
    if (I.memo[key]) return I.memo[key];
    const on = t => (det != null ? !!det : vis >= t);
    return (I.memo[key] = I.parts.filter(p => (p.lo ? !on(p.lo) : !p.hi || on(p.hi))));
  }
  const hex = c => { const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(c).trim()); if (!m) return null; let h = m[1]; if (h.length === 3) h = h.replace(/./g, x => x + x); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  // a colour's rgb (hex colours only) and its neon core (70 % towards white), kept per colour
  const cols = new Map();
  function colour(col) {
    let v = cols.get(col);
    if (v) return v;
    const c3 = hex(col);
    v = { c3, core: c3 ? rgba(c3.map(x => Math.round(x + (255 - x) * 0.7)), 1) : '#ffffff' };
    if (cols.size > 64) cols.clear();
    cols.set(col, v);
    return v;
  }

  // the stand-in for an id without an icon: a circle with its initials
  function stub(ctx, id, cx, cy, size, o) {
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = o.color || '#ffffff';
    ctx.lineWidth = o.width || Math.max(1, size * 0.05);
    if (o.glow) { ctx.shadowColor = o.color || '#ffffff'; ctx.shadowBlur = size * 0.12; }
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `600 ${Math.round(size * 0.26)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((short.get(id) || String(id)).slice(0, 2), cx, cy);
    ctx.restore();
  }
  function strokes(ctx, use, lw, style, alpha) {
    ctx.strokeStyle = style; ctx.globalAlpha = alpha;
    for (const p of use) {
      const path = p.s || p.l; if (!path) continue;
      if (p.clip) { ctx.save(); ctx.clip(p.clip); }
      ctx.lineWidth = lw * (p.w || 1);
      ctx.stroke(path);
      if (p.clip) ctx.restore();
    }
  }

  // draw one icon centred at (cx, cy) in a square of side size (in the context's units). opts: color (CSS colour,
  // white), width (line width in the context's units; by default bolder at small sizes), glow (neon: a coloured blur,
  // a translucent fill and a light core), fill (0..1 alpha of the outlines' fill; 0, or 0.4 with glow),
  // detail (true/false: inner lines; by default from 40 pixels up), alpha (0..1). Sizes in pixels count a device
  // pixel ratio of up to 1.25 (an icon small on a phone's screen stays simple), the thinnest line is 1.15 device pixels.
  function draw(ctx, id, cx, cy, size, opts) {
    const o = opts || {}, I = icon(id);
    if (!I) return stub(ctx, id, cx, cy, size, o);
    const m = ctx.getTransform ? ctx.getTransform() : null, dpr = m ? Math.hypot(m.a, m.b) || 1 : 1;
    const px = size * dpr, vis = size * Math.min(dpr, 1.25), k = size / 100;
    const w = (o.width || Math.max(1.15 / dpr, size * (0.068 - 0.028 * clamp((vis - 24) / 56, 0, 1)))) / k;
    const col = o.color || '#ffffff', C = colour(col), c3 = C.c3, fill = o.fill != null ? o.fill : o.glow ? 0.4 : 0;
    const a0 = ctx.globalAlpha * (o.alpha != null ? o.alpha : 1), use = pick(I, o.detail, vis);
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(k, k);
    ctx.lineCap = ctx.lineJoin = 'round';
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
      ctx.shadowBlur = px * 0.16; strokes(ctx, use, w * 1.5, col, a0 * 0.55);
      ctx.shadowBlur = px * 0.05; strokes(ctx, use, w, col, a0);
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      strokes(ctx, use, w * 0.42, C.core, a0 * 0.9);
    } else strokes(ctx, use, w, col, a0);
    ctx.restore();
  }

  // all icons white on transparent in one CanvasTexture, a 4 x 4 grid of px-pixel cells (tint them in the shader);
  // px is rounded to a power of two from 16 to 512 (mipmaps on WebGL 1 too), the icons fill 86 % of a cell, the last
  // cell stays empty. Made for small sprites by default: bold lines (opts.width, a fraction of the icon: 0.075), the
  // simple shapes (opts.detail: false); { detail: true } bakes the inner lines with thin lines (0.04) for close views.
  const atlases = new Map();
  function atlas(THREE, px, opts) {
    const o = opts || {}, s = Math.pow(2, Math.round(Math.log2(clamp(px || 128, 16, 512))));
    const det = !!o.detail, wf = o.width > 0 ? o.width : det ? 0.04 : 0.075, key = s + ' ' + det + ' ' + wf;
    if (atlases.has(key)) return atlases.get(key);
    const G = ids.length < 16 ? 4 : Math.pow(2, Math.ceil(Math.log2(Math.sqrt(ids.length + 1)))), cv = document.createElement('canvas');
    cv.width = cv.height = s * G;
    const ctx = cv.getContext('2d');
    ids.forEach((id, i) => draw(ctx, id, (i % G + 0.5) * s, (Math.floor(i / G) + 0.5) * s, s * 0.86, { detail: det, width: s * 0.86 * wf }));
    const texture = new THREE.CanvasTexture(cv);
    texture.anisotropy = 4;
    // unknown ids get the last (empty) cell
    const uv = id => { let i = ids.indexOf(id); if (i < 0) i = G * G - 1; const x = i % G, y = Math.floor(i / G); return [x / G, 1 - (y + 1) / G, (x + 1) / G, 1 - y / G]; };
    const A = { texture, canvas: cv, uv };
    atlases.set(key, A);
    return A;
  }
  return { ids, draw, atlas };
})();

// The PET story's opening set: a modern PET/CT scanner (after the one on the vision slide), the detector ring and how
// PET sees (a positron, its annihilation, two 511 keV photons, a coincidence, lines of response), the patient's image
// forming from the counts, and the vision row of the slide (scanner -> glowing body -> network of organs -> prognosis
// and medication). 1 unit = 1 m; the origin is the centre of the bore, its axis is z, the couch comes out towards +z
// and the floor is at y = -1.05.
SETS.scan = function (K) {
  const { THREE, clamp, lerp, smooth, prog, rng, v3 } = K;
  const set = K.newSet('scan');
  const PI = Math.PI, TAU = 2 * PI, FLOOR = -1.05;
  const D = typeof PET_DATA !== 'undefined' ? PET_DATA : null;
  const ocol = (id, f) => { const o = D && D.organs.find(q => q.id === id); return K.rgb(o ? o.col : f); };
  // deterministic hashes (events are functions of their index, so seeking works)
  const hash = i => { let h = Math.imul((i | 0) ^ 0x2c1b3c6d, 0x297a2d39); h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const hk = (i, k) => hash(Math.imul(i | 0, 0x9e3779b1) + Math.imul(k + 1, 0x632be5ab));

  // ------------------------------------------------------------------ the studio material --
  // Clinical glossy plastic lit like a product shot: a soft key over the viewer's left shoulder, a fill from the
  // right, sky and floor, a clear coat reflecting a studio (a softbox overhead, strip lights), fresnel and a cool rim.
  // Vertex attributes: color, aM (gloss, glow, cut flag, ambient occlusion), aE (vision element: 0 the scanner).
  // The cut: surfaces flagged for it vanish above uCut (scanner frame) with a glowing edge; their insides (back
  // faces) show as the dark inside of the housing. uMir draws the mirrored copy (the floor's reflection). o.cry: the
// crystals, each with its own glow (aG, per instance: a crystal struck by a photon flashes). While the set fades,
// back faces are dropped: the dark inside showed through the housing itself (a muddy charcoal ghost).
  const SU = { uCut: { value: 9 }, uWin: { value: 0 }, uDim: { value: 1 }, uFloor: { value: FLOOR }, uE: { value: new THREE.Vector4(1, 1, 1, 1) } };
  function studio(o = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uMir: { value: o.mir ? 1 : 0 }, uK: { value: 1 } }, SU), defines: o.cry ? { CRY: '' } : {},
      transparent: true, depthWrite: !o.mir && !o.vis, side: THREE.DoubleSide, extensions: { derivatives: true },
      vertexShader: `
attribute vec3 color; attribute vec4 aM; attribute float aE;
uniform vec4 uE;
varying vec3 vC, vN, vW, vL, vLN; varying vec4 vM; varying float vE;
#ifdef CRY
attribute float aG; varying float vG;
#endif
void main() {
#ifdef CRY
  vG = aG;
#endif
  vec4 p = vec4(position, 1.0); vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
  vL = p.xyz; vLN = n;
  vec4 w = modelMatrix * p; vW = w.xyz; vN = mat3(modelMatrix) * n;
  vC = color; vM = aM;
  vE = aE < 0.5 ? 1.0 : dot(vec4(equal(vec4(aE), vec4(1.0, 2.0, 3.0, 4.0))), uE);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
      fragmentShader: `
uniform float uA, uCut, uWin, uDim, uMir, uFloor, uK;
varying vec3 vC, vN, vW, vL, vLN; varying vec4 vM; varying float vE;
#ifdef CRY
varying float vG;
#endif
vec3 env(vec3 r) {
  float top = smoothstep(0.2, 0.92, r.y) * 1.15;
  float hor = exp(-pow((r.y - 0.06) / 0.2, 2.0)) * 0.2;
  float sl = pow(max(dot(r, normalize(vec3(-0.85, 0.3, 0.45))), 0.0), 14.0) * 1.3;
  float sr = pow(max(dot(r, normalize(vec3(0.9, 0.2, -0.25))), 0.0), 20.0) * 0.55;
  return vec3(0.9, 0.95, 1.0) * (top + hor + sl + sr) + vec3(0.015, 0.02, 0.03);
}
void main() {
  if (vM.z > 0.5 && vL.y > uCut) discard;
  if (vM.z > 1.5 && abs(vL.z) < uWin) discard;   // the bore's cover opens over the detector ring
  bool inside = !gl_FrontFacing;
  if (inside && uA < 0.97) discard;
  float a = uA * vE * uK;
  // the reflection fades with the height above the floor (and costs nothing where it has gone)
  if (uMir > 0.5) { a *= 0.32 * exp(-max(vL.y - uFloor, 0.0) * 3.0); if (a < 0.004) discard; }
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  if (inside) n = -n;
  if (uMir > 0.5) { n.y = -n.y; v.y = -v.y; }
  vec3 L = normalize((vec4(-0.45, 0.65, 0.75, 0.0) * viewMatrix).xyz), F = normalize((vec4(0.9, 0.1, 0.45, 0.0) * viewMatrix).xyz);
  float wr = clamp((dot(n, L) + 0.25) / 1.25, 0.0, 1.0), nv = max(dot(n, v), 0.0), g = vM.x;
  vec3 col = vC * (0.31 + 0.2 * (0.5 + 0.5 * n.y) + 0.55 * wr * wr + 0.22 * max(dot(n, F), 0.0)) * vM.w;
  float fr = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  col += env(reflect(-v, n)) * g * mix(0.07, 0.9, fr) * mix(0.5, 1.0, vM.w);
  col += pow(max(dot(n, normalize(L + v)), 0.0), mix(18.0, 150.0, g)) * g * 0.45;
  col += vec3(0.55, 0.72, 1.0) * pow(1.0 - nv, 3.0) * 0.16 * g;
  // panel seams: vertical grooves on the rear housing's sides
  if (vM.z > 0.5 && abs(vLN.x) > 0.8 && vL.z < 0.16 && vL.z > -0.72 && vL.y > -0.62 && vL.y < 0.7) {
    float dz = min(min(abs(vL.z + 0.06), abs(vL.z + 0.3)), abs(vL.z + 0.54)), fw = fwidth(vL.z) + 0.0005;
    col *= 1.0 - 0.45 * (1.0 - smoothstep(0.0022, 0.0022 + fw, dz));
  }
  col *= uDim;
  if (inside) col = vec3(0.075, 0.09, 0.12) * (0.55 + 0.45 * wr) * mix(1.0, uDim, 0.5);
  col += vC * vM.y;
  // a glowing edge where the cut goes through the housing (softer on the bore's cover, which runs through the bore)
  if (vM.z > 0.5) col += vec3(0.4, 0.82, 1.0) * (1.0 - smoothstep(0.0, 0.011, uCut - vL.y)) * (vM.z > 1.5 ? 0.5 : 1.5);
#ifdef CRY
  col += vec3(0.45, 0.85, 1.0) * vG * 2.6;
#endif
  gl_FragColor = vec4(col, a);
}`,
    });
    set.mats.push(m);
    return m;
  }
  const solidMat = studio(), mirMat = studio({ mir: true }), visMat = studio({ vis: true }), cryMat = studio({ cry: true });

  // ------------------------------------------------------------------ geometry builder --
  // Everything the studio material lights goes through a builder (one indexed geometry per mesh).
  function Builder() {
    const P = [], N = [], C = [], M = [], E = [], I = [];
    return {
      n: () => P.length / 3,
      vert(p, n, c, m, e) { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); C.push(c[0], c[1], c[2]); M.push(m[0], m[1], m[2], m[3]); E.push(e || 0); },
      tri(a, b, c) { I.push(a, b, c); },
      geo() {
        const g = new THREE.BufferGeometry(), at = (k, a, s) => g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(a), s));
        at('position', P, 3); at('normal', N, 3); at('color', C, 3); at('aM', M, 4); at('aE', E, 1);
        g.setIndex(new THREE.BufferAttribute(P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I), 1));
        g.computeBoundingSphere();
        return g;
      },
    };
  }
  const xp = (m, p) => { if (!m) return p; const e = m.elements; return [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]]; };
  const xn = (m, n) => { if (!m) return n; const e = m.elements; return v3.norm([e[0] * n[0] + e[4] * n[1] + e[8] * n[2], e[1] * n[0] + e[5] * n[1] + e[9] * n[2], e[2] * n[0] + e[6] * n[1] + e[10] * n[2]]); };
  // a look: col ([r, g, b] or f(p, n, i, j)), m ([gloss, glow, cut, ao] or f(p, n, i, j)), e (vision element)
  const paint = (L, p, n, i, j) => [typeof L.col === 'function' ? L.col(p, n, i, j) : L.col, typeof L.m === 'function' ? L.m(p, n, i, j) : L.m];
  // a grid of ni x nj points at(i, j); normals analytic (o.nrm) or from the neighbours; o.wrapI / o.wrapJ close it
  function grid(B, ni, nj, at, L, o = {}) {
    const W = [], base = B.n();
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) W.push(at(i, j));
    const g = (i, j) => W[i * nj + j];
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
      let n;
      if (o.nrm) n = o.nrm(i, j);
      else {
        const i0 = o.wrapI ? (i - 1 + ni) % ni : Math.max(i - 1, 0), i1 = o.wrapI ? (i + 1) % ni : Math.min(i + 1, ni - 1);
        const j0 = o.wrapJ ? (j - 1 + nj) % nj : Math.max(j - 1, 0), j1 = o.wrapJ ? (j + 1) % nj : Math.min(j + 1, nj - 1);
        n = v3.cross(v3.sub(g(i1, j), g(i0, j)), v3.sub(g(i, j1), g(i, j0)));
        if (v3.len(n) < 1e-14) n = o.fallback || [0, 1, 0];
      }
      n = v3.norm(o.flip ? v3.mul(n, -1) : n);
      const p = xp(o.mat, g(i, j)), nn = xn(o.mat, n), [c, m] = paint(L, p, nn, i, j);
      B.vert(p, nn, c, m, L.e);
    }
    const I1 = o.wrapI ? ni : ni - 1, J1 = o.wrapJ ? nj : nj - 1;
    for (let i = 0; i < I1; i++) for (let j = 0; j < J1; j++) {
      const a = base + i * nj + j, b = base + ((i + 1) % ni) * nj + j, c = base + ((i + 1) % ni) * nj + (j + 1) % nj, d = base + i * nj + (j + 1) % nj;
      if (o.flip) { B.tri(a, c, b); B.tri(a, d, c); } else { B.tri(a, b, c); B.tri(a, c, d); }
    }
  }
  // a rounded rectangle outline (counter-clockwise)
  function rrect(cx, cy, hx, hy, r, seg = 6) {
    r = Math.min(r, hx, hy);
    const out = [], C = [[hx - r, hy - r, 0], [-hx + r, hy - r, 1], [-hx + r, -hy + r, 2], [hx - r, -hy + r, 3]];
    for (const [x, y, q] of C) for (let k = 0; k <= seg; k++) { const a = (q + k / seg) * PI / 2; out.push([cx + x + r * Math.cos(a), cy + y + r * Math.sin(a)]); }
    return out;
  }
  // round a polygon's corners (quadratic arcs of about radius rad)
  function roundPoly(poly, rad, seg = 6) {
    const out = [], n = poly.length;
    for (let k = 0; k < n; k++) {
      const p = poly[k], a = poly[(k - 1 + n) % n], b = poly[(k + 1) % n];
      const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const ua = [(a[0] - p[0]) / la, (a[1] - p[1]) / la], ub = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb];
      const half = Math.acos(clamp(ua[0] * ub[0] + ua[1] * ub[1], -1, 1)) / 2, t = Math.min(rad / Math.tan(half || 1e-3), la * 0.48, lb * 0.48);
      const T1 = [p[0] + ua[0] * t, p[1] + ua[1] * t], T2 = [p[0] + ub[0] * t, p[1] + ub[1] * t];
      for (let s = 0; s <= seg; s++) { const u = s / seg, w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u; out.push([w0 * T1[0] + w1 * p[0] + w2 * T2[0], w0 * T1[1] + w1 * p[1] + w2 * T2[1]]); }
    }
    return out;
  }
  // A slab: the smooth closed outline core ([x, y]) grown by r, from z = 0 back to z = -d, every edge rounded with
  // radius r (exact normals), both caps flat; built in its own frame and placed by the matrix m.
  function slab(B, core, d, r, L, m, nf = 4) {
    if (THREE.ShapeUtils.isClockWise(core.map(p => new THREE.Vector2(p[0], p[1])))) core = core.slice().reverse();
    const n = core.length, nr = core.map((p, k) => {
      const a = core[(k - 1 + n) % n], b = core[(k + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [dy / l, -dx / l];
    });
    r = Math.min(r, d / 2);
    const rows = [];
    for (let k = 0; k <= nf; k++) { const a = k / nf * PI / 2; rows.push([r * Math.sin(a), -r + r * Math.cos(a), Math.sin(a), Math.cos(a)]); }
    for (let k = d - 2 * r > 1e-4 ? 0 : 1; k <= nf; k++) { const a = PI / 2 + k / nf * PI / 2; rows.push([r * Math.sin(a), -(d - r) + r * Math.cos(a), Math.sin(a), Math.cos(a)]); }
    grid(B, rows.length, n, (i, j) => [core[j][0] + nr[j][0] * rows[i][0], core[j][1] + nr[j][1] * rows[i][0], rows[i][1]], L,
      { wrapJ: true, mat: m, nrm: (i, j) => [nr[j][0] * rows[i][2], nr[j][1] * rows[i][2], rows[i][3]] });
    const tris = THREE.ShapeUtils.triangulateShape(core.map(p => new THREE.Vector2(p[0], p[1])), []);
    for (const [z, nz] of [[0, 1], [-d, -1]]) {
      const base = B.n(), nn = xn(m, [0, 0, nz]);
      for (const q of core) { const p = xp(m, [q[0], q[1], z]), [c, mm] = paint(L, p, nn, -1, -1); B.vert(p, nn, c, mm, L.e); }
      for (const [a, b, c] of tris) {
        const ar = (core[b][0] - core[a][0]) * (core[c][1] - core[a][1]) - (core[b][1] - core[a][1]) * (core[c][0] - core[a][0]);
        if ((ar > 0) === (nz > 0)) B.tri(base + a, base + b, base + c); else B.tri(base + a, base + c, base + b);
      }
    }
  }
  // a matrix from a basis (columns X, Y, Z) and an origin
  const basis = (X, Y, Z, o) => new THREE.Matrix4().set(X[0], Y[0], Z[0], o[0], X[1], Y[1], Z[1], o[1], X[2], Y[2], Z[2], o[2], 0, 0, 0, 1);
  // a rounded box centred at c with half sizes h
  const rbox = (B, c, h, r, L) => slab(B, rrect(0, 0, h[0] - r, h[1] - r, 0.0001, 1), 2 * h[2], r, L, basis([1, 0, 0], [0, 1, 0], [0, 0, 1], [c[0], c[1], c[2] + h[2]]));
  // a slab lying flat (outline in x, z seen from above), top at y0, thickness d
  const flat = (B, core, y0, d, r, L, nf) => slab(B, core, d, r, L, basis([1, 0, 0], [0, 0, -1], [0, 1, 0], [0, y0, 0]), nf);
  // a solid of revolution about the bore's axis (z): profile [[r, z], ...] clockwise in (r, z), closed
  function lathe(B, prof, nt, L) {
    grid(B, prof.length, nt, (i, j) => { const a = j / nt * TAU; return [prof[i][0] * Math.cos(a), prof[i][0] * Math.sin(a), prof[i][1]]; }, L, { wrapI: true, wrapJ: true });
  }
  const rprof = (r0, r1, z0, z1, rad) => rrect((r0 + r1) / 2, (z0 + z1) / 2, (r1 - r0) / 2, (z1 - z0) / 2, rad, 4).reverse();

  // colours and looks
  const WHITE = [0.885, 0.9, 0.92], BLUE = [0.47, 0.62, 0.86], GREY = [0.36, 0.39, 0.44];
  const floorAO = y => 0.6 + 0.4 * K.smooth((y + 1.02) / 0.22);

  // ------------------------------------------------------------------ the gantry --
  // One closed surface: the tunnel, the front lip, the blue band with its two pods, the white face, a generous fillet,
  // the front cover, a seam, the deeper rear housing, the back face and the back lip, swept round the bore (columns
  // by angle about the bore's centre). The face is a softly rounded square: straight sides, a domed top, tight
  // bottom corners; core = the outline before the fillet.
  const RB = 0.39, RF = 0.1, RF2 = 0.12, GA = 0.9, GT = 0.95, GBo = -0.89, GYS = 0.02, GYB = -0.6;
  function gIn(x, y) {
    const ax = Math.abs(x) / GA;
    if (y > GYS) { const b = (y - GYS) / (GT - GYS); return Math.pow(Math.pow(ax, 2.9) + Math.pow(b, 2.9), 1 / 2.9); }
    if (y < GYB) { const b = (GYB - y) / (GYB - GBo); return Math.pow(Math.pow(ax, 7) + Math.pow(b, 7), 1 / 7); }
    return ax;
  }
  // the rear housing (the PET part) is a little larger and boxier than the front cover
  function gIn2(x, y) {
    const ax = Math.abs(x) / (GA + 0.03);
    if (y > 0.2) { const b = (y - 0.2) / (GT + 0.035 - 0.2); return Math.pow(Math.pow(ax, 3.6) + Math.pow(b, 3.6), 1 / 3.6); }
    if (y < GYB) { const b = (GYB - y) / (GYB - GBo); return Math.pow(Math.pow(ax, 7) + Math.pow(b, 7), 1 / 7); }
    return ax;
  }
  const along = (f, a, lo, hi) => { const c = Math.cos(a), s = Math.sin(a); for (let k = 0; k < 36; k++) { const m = (lo + hi) / 2; if (f(c * m, s * m)) lo = m; else hi = m; } return lo; };
  // the blue band's outline: the ring smoothly joined to two lens-shaped pods at its sides
  const smin2 = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const blueSD = (x, y) => { const e = (Math.hypot((Math.abs(x) - 0.69) / 0.155, y / 0.3) - 1) * 0.155; return smin2(Math.hypot(x, y) - 0.665, e, 0.09); };
  const NT = 200, COL = [];
  for (let j = 0; j < NT; j++) {
    const a = j / NT * TAU, c = Math.cos(a), s = Math.sin(a), rho = along((x, y) => gIn(x, y) < 1, a, 0, 2), x = c * rho, y = s * rho, e = 1e-4;
    const gx = gIn(x + e, y) - gIn(x - e, y), gy = gIn(x, y + e) - gIn(x, y - e), gl = Math.hypot(gx, gy) || 1;
    const rho2 = along((x, y) => gIn2(x, y) < 1, a, 0, 2), x2 = c * rho2, y2 = s * rho2;
    const hx = gIn2(x2 + e, y2) - gIn2(x2 - e, y2), hy = gIn2(x2, y2 + e) - gIn2(x2, y2 - e), hl = Math.hypot(hx, hy) || 1;
    COL.push({ c, s, rho, nx: gx / gl, ny: gy / gl, rho2, nx2: hx / hl, ny2: hy / hl, rb: along((x, y) => blueSD(x, y) < 0, a, 0.4, 1.2) });
  }
  const ROWS = [];
  const Rr = (r, z, tag) => ROWS.push({ k: 'r', r, z, tag }), Rs = (off, z, tag) => ROWS.push({ k: 's', off, z, tag }), R2 = (off, z, tag) => ROWS.push({ k: 's2', off, z, tag });
  for (let k = 0; k <= 14; k++) Rr(RB, -0.7 + 1.415 * k / 14, 'tunnel');
  for (let k = 1; k <= 6; k++) { const a = k / 6 * PI / 2; Rr(RB + 0.06 * (1 - Math.cos(a)), 0.715 + 0.06 * Math.sin(a), 'lip'); }
  Rr(0.462, 0.775, 'lip');
  for (let k = 1; k <= 3; k++) { const s = k / 3; Rr(0.462 + 0.014 * s, 0.775 - 0.013 * smooth(s), k < 3 ? 'lip' : 'blue'); }
  for (let k = 1; k <= 6; k++) { const s = k / 6; Rr(c => lerp(0.476, c.rb - 0.012, s), 0.762 + 0.005 * Math.sin(PI * s), 'blue'); }
  for (let k = 1; k <= 5; k++) { const s = k / 5; Rr(c => c.rb - 0.012 + 0.032 * s, 0.762 + 0.038 * smooth(s), s < 0.5 ? 'blue' : 'face'); }
  for (let k = 1; k <= 6; k++) { const s = k / 6; Rr(c => lerp(c.rb + 0.02, c.rho, s), 0.8, 'face'); }
  for (let k = 1; k <= 7; k++) { const a = k / 7 * PI / 2; Rs(RF * Math.sin(a), 0.8 - RF * (1 - Math.cos(a)), 'skin'); }
  Rs(RF, 0.48, 'skin'); Rs(RF, 0.29, 'skin');
  Rs(RF - 0.005, 0.27, 'seam'); Rs(RF - 0.014, 0.256, 'seam'); Rs(RF - 0.004, 0.242, 'seam');
  R2(RF - 0.03, 0.238, 'seam'); R2(RF - 0.012, 0.234, 'skin'); R2(RF - 0.003, 0.226, 'skin');
  for (let k = 0; k <= 4; k++) R2(RF, 0.214 - (0.214 - (-0.8 + RF2)) * k / 4, 'skin');
  for (let k = 1; k <= 7; k++) { const a = PI / 2 + k / 7 * PI / 2; R2(RF - RF2 + RF2 * Math.sin(a), -0.8 + RF2 + RF2 * Math.cos(a), 'skin'); }
  for (let k = 1; k <= 5; k++) ROWS.push({ k: 'b', s: k / 5, z: -0.8, tag: 'back' });
  for (let k = 1; k <= 5; k++) { const a = PI / 2 - k / 6 * PI / 2; Rr(RB + 0.1 * (1 - Math.cos(a)), -0.7 - 0.1 * Math.sin(a), 'lip'); }
  const LOOK = {
    tunnel: (p) => [[0.8, 0.82, 0.86], [0.45, 0, 2, 1 - 0.5 * (1 - K.smooth((Math.abs(p[2]) - 0.05) / 0.6))]],
    lip: (p) => [WHITE, [0.85, 0, 1, 1]], blue: (p) => [BLUE, [0.42, 0.13, 1, 1]], face: (p) => [WHITE, [0.85, 0, 1, floorAO(p[1])]],
    skin: (p) => [WHITE, [0.85, 0, 1, floorAO(p[1])]], seam: (p) => [[0.55, 0.58, 0.62], [0.3, 0, 1, 0.7 * floorAO(p[1])]],
    back: (p) => [[0.86, 0.87, 0.89], [0.7, 0, 1, floorAO(p[1])]],
  };
  const outer = Builder();
  {
    let tag = null;
    grid(outer, ROWS.length, NT, (i, j) => {
      const R = ROWS[i], c = COL[j];
      if (R.k === 'r') { const r = typeof R.r === 'function' ? R.r(c) : R.r; return [c.c * r, c.s * r, R.z]; }
      if (R.k === 's') return [c.c * c.rho + c.nx * R.off, c.s * c.rho + c.ny * R.off, R.z];
      if (R.k === 's2') return [c.c * c.rho2 + c.nx2 * R.off, c.s * c.rho2 + c.ny2 * R.off, R.z];
      const q0 = [c.c * c.rho2 + c.nx2 * (RF - RF2), c.s * c.rho2 + c.ny2 * (RF - RF2)];
      return [lerp(q0[0], c.c * 0.49, R.s), lerp(q0[1], c.s * 0.49, R.s), R.z];
    }, { col: (p, n, i) => (tag = LOOK[ROWS[i].tag](p))[0], m: () => tag[1] }, { wrapI: true, wrapJ: true });
  }
  // the pods' control panels (a small screen, buttons, a status light) and the dark status panel high on the face
  const cutL = (col, g, glow) => ({ col, m: p => [g, glow || 0, 1, 1] });
  for (const sx of [-1, 1]) {
    const x = 0.735 * sx, at = (y, z) => basis([1, 0, 0], [0, 1, 0], [0, 0, 1], [x, y, z]);
    slab(outer, rrect(0, 0, 0.034, 0.135, 0.03, 6), 0.024, 0.012, cutL([0.74, 0.77, 0.82], 0.7), at(0, 0.786));
    slab(outer, rrect(0, 0, 0.018, 0.013, 0.003, 2), 0.006, 0.003, cutL([0.04, 0.06, 0.09], 0.9, 0.06), at(0.062, 0.79));
    for (let k = 0; k < 6; k++) slab(outer, rrect(0, 0, 0.002, 0.002, 0.002, 3), 0.005, 0.004, cutL([0.95, 0.96, 0.97], 0.6), at(-0.032 * (k >> 1), 0.79).multiply(new THREE.Matrix4().makeTranslation((k & 1 ? 0.014 : -0.014), 0, 0)));
    slab(outer, rrect(0, 0, 0.002, 0.002, 0.002, 3), 0.005, 0.004, cutL([1.0, 0.25, 0.12], 0.5, 0.9), at(0.112, 0.79));
  }
  {
    const arc = [], a0 = PI / 2 - 0.56, a1 = PI / 2 + 0.56;
    for (let k = 0; k <= 24; k++) { const a = lerp(a0, a1, k / 24); arc.push([0.872 * Math.cos(a), 0.872 * Math.sin(a)]); }
    for (let k = 24; k >= 0; k--) { const a = lerp(a0, a1, k / 24); arc.push([0.792 * Math.cos(a), 0.792 * Math.sin(a)]); }
    slab(outer, roundPoly(arc.filter((p, k) => k % 6 === 0 || k === 24 || k === 25 || k === 49), 0.022, 5), 0.014, 0.006, cutL([0.06, 0.07, 0.09], 0.95), basis([1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0.812]));
    for (const a of [PI / 2 - 0.3, PI / 2, PI / 2 + 0.3]) {
      const c = Math.cos(a), s = Math.sin(a);
      slab(outer, rrect(0, 0, 0.03, 0.004, 0.004, 3), 0.004, 0.0018, cutL([1.0, 0.42, 0.16], 0.4, 0.95), basis([-s, c, 0], [-c, -s, 0], [0, 0, 1], [0.832 * c, 0.832 * s, 0.815]));
    }
  }
  // the slim grey plinth, and the couch's base, pedestal (a curved skirt) and carriage
  flat(outer, rrect(0, 0, 0.92, 0.68, 0.1, 6), -0.99, 0.06, 0.02, { col: GREY, m: [0.5, 0, 0, 0.8] });
  flat(outer, rrect(0, -1.9, 0.27, 0.92, 0.1, 6), -0.955, 0.095, 0.035, { col: [0.84, 0.86, 0.89], m: p => [0.75, 0, 0, floorAO(p[1] + 0.03)] });
  {
    const KEY = [[-0.96, 0.22, 0.62], [-0.9, 0.19, 0.56], [-0.8, 0.14, 0.46], [-0.66, 0.13, 0.42], [-0.54, 0.16, 0.5], [-0.46, 0.2, 0.66]];
    const cr = (y) => { let k = 0; while (k < KEY.length - 2 && y > KEY[k + 1][0]) k++; const f = smooth((y - KEY[k][0]) / (KEY[k + 1][0] - KEY[k][0])); return [lerp(KEY[k][1], KEY[k + 1][1], f), lerp(KEY[k][2], KEY[k + 1][2], f)]; };
    const NR = 14, sec = [];
    for (let i = 0; i <= NR; i++) { const y = lerp(-0.96, -0.45, i / NR), [hx, hz] = cr(y); sec.push(rrect(0, -1.82, hx, hz, Math.min(0.12, hx * 0.8), 7).map(q => [q[0], y, -q[1]])); }
    grid(outer, sec.length, sec[0].length, (i, j) => sec[i][j], { col: [0.86, 0.88, 0.9], m: p => [0.75, 0, 0, 0.7 + 0.3 * K.smooth((p[1] + 0.95) / 0.45)] }, { wrapJ: true, flip: true });
  }
  flat(outer, rrect(0, -1.81, 0.22, 0.86, 0.1, 6), -0.345, 0.11, 0.04, { col: [0.8, 0.82, 0.86], m: [0.8, 0, 0, 0.9] });
  const outerGeo = outer.geo();

  // the couch's table top (it slides): a thick white board with a blue stripe along its sides, and a soft pad
  const TL = 2.3, TOP = -0.215;
  const table = Builder();
  const stripe = (p, n) => Math.abs(n[1]) < 0.7 && p[1] < TOP - 0.045 && p[1] > TOP - 0.1;
  flat(table, rrect(0, -TL / 2, 0.26 - 0.035, TL / 2 - 0.035, 0.1, 6), TOP - 0.025, 0.105, 0.035, {
    col: (p, n) => (stripe(p, n) ? [0.45, 0.62, 0.88] : WHITE), m: (p, n) => (stripe(p, n) ? [0.5, 0.12, 0, 1] : [0.85, 0, 0, 1]) }, 6);
  flat(table, rrect(0, -TL / 2, 0.2, TL / 2 - 0.07, 0.09, 6), TOP, 0.028, 0.013, { col: [0.7, 0.76, 0.85], m: [0.25, 0, 0, 1] });
  // a head rest: a shallow cradle at the head end
  flat(table, rrect(0, -0.2, 0.12, 0.11, 0.08, 6), TOP + 0.016, 0.02, 0.009, { col: [0.68, 0.74, 0.83], m: [0.25, 0, 0, 1] });
  const tableGeo = table.geo();

  // ------------------------------------------------------------------ inside the housing --
  // the CT ring in front (a drum with its X-ray tube) and the PET detector behind: two support rings, 48 detector
  // modules (the electronics behind the crystals) and the crystals themselves (instanced, below)
  const ZH = 0.165, RC0 = 0.41, RC1 = 0.44, NA = 192, NZ = 24, RDET = (RC0 + RC1) / 2;
  const inner = Builder();
  lathe(inner, rprof(0.43, 0.72, 0.4, 0.64, 0.02), 120, { col: [0.5, 0.53, 0.58], m: [0.75, 0, 1, 1] });
  rbox(inner, [0, 0.8, 0.52], [0.14, 0.075, 0.1], 0.03, { col: [0.25, 0.27, 0.31], m: [0.7, 0, 1, 1] });
  for (const z of [-ZH - 0.004, ZH + 0.02]) lathe(inner, rprof(0.445, 0.53, z - 0.016, z, 0.006), 120, { col: [0.62, 0.65, 0.7], m: [0.8, 0, 0, 1] });
  for (let b = 0; b < 48; b++) {
    const a = (b + 0.5) / 48 * TAU, c = Math.cos(a), s = Math.sin(a);
    slab(inner, rrect(0, 0.4725, 0.0225, 0.03, 0.008, 3), 2 * ZH, 0.008, { col: [0.13, 0.15, 0.19], m: [0.6, 0, 1, 1] }, basis([-s, c, 0], [c, s, 0], [0, 0, -1], [0, 0, ZH]));
  }
  const innerGeo = inner.geo();
  // the crystals: 192 around x 24 deep (48 blocks of 4 x 4 around, 6 blocks deep), dark glass, their faces to the bore;
  // each can flash (aG, set for the few struck crystals). Face and sides close in tone and only moderately glossy, so
  // the band does not shimmer into a moire from afar
  const cryPitchA = TAU / NA, cryPitchZ = 2 * ZH / NZ;
  const cryZ = k => -ZH + (k + 0.5) * cryPitchZ, cryA = k => (k + 0.5) * cryPitchA;
  const cg = new THREE.BoxGeometry(RDET * cryPitchA * 0.86, cryPitchZ * 0.86, RC1 - RC0);
  const CG = new Float32Array(NA * NZ);
  {
    const nv = cg.attributes.position.count, nrm = cg.attributes.normal.array, C = new Float32Array(nv * 3), M = new Float32Array(nv * 4);
    for (let v = 0; v < nv; v++) {
      const face = nrm[3 * v + 2] < -0.5;   // the face towards the axis
      C.set(face ? [0.17, 0.36, 0.5] : [0.12, 0.26, 0.37], 3 * v); M.set([0.7, face ? 0.18 : 0.13, 0, 1], 4 * v);
    }
    cg.setAttribute('color', new THREE.BufferAttribute(C, 3)); cg.setAttribute('aM', new THREE.BufferAttribute(M, 4));
    cg.setAttribute('aE', new THREE.BufferAttribute(new Float32Array(nv), 1));
    cg.setAttribute('aG', new THREE.InstancedBufferAttribute(CG, 1));
  }
  const crystals = new THREE.InstancedMesh(cg, cryMat, NA * NZ);
  for (let ia = 0; ia < NA; ia++) for (let iz = 0; iz < NZ; iz++) {
    const a = cryA(ia), c = Math.cos(a), s = Math.sin(a);
    crystals.setMatrixAt(ia * NZ + iz, basis([-s, c, 0], [0, 0, 1], [c, s, 0], [RDET * c, RDET * s, cryZ(iz)]));
  }
  crystals.instanceMatrix.needsUpdate = true;

  // ------------------------------------------------------------------ floor --
  // a glossy dark floor: a soft pool with contact shadows under the gantry and the couch (the reflection is drawn on it)
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uF: { value: 1 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA, uF; varying vec2 vP;
float sdB(vec2 p, vec2 c, vec2 b, float r) { vec2 q = abs(p - c) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  float rr = length(vec2(vP.x * 0.85, (vP.y - 0.7) * 0.62)) / 2.5;
  float a = 0.92 * (1.0 - smoothstep(0.25, 1.0, rr));
  float sh = max(1.0 - smoothstep(0.0, 0.3, sdB(vP, vec2(0.0, 0.0), vec2(1.0, 0.8), 0.12)), 0.8 * (1.0 - smoothstep(0.0, 0.18, sdB(vP, vec2(0.0, 1.9), vec2(0.3, 0.95), 0.1))));
  vec3 col = mix(vec3(0.045, 0.06, 0.085), vec3(0.008, 0.01, 0.016), sh * 0.85);
  gl_FragColor = vec4(col, a * uA * uF);
}`,
  });
  set.mats.push(floorMat);
  const floorG = new THREE.PlaneGeometry(7, 7).rotateX(-PI / 2).translate(0, FLOOR + 0.0005, 0.7);

  // ------------------------------------------------------------------ the scanner's group --
  const scanG = new THREE.Group();
  set.group.add(scanG);
  const mk = (geo, mat, order) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; m.frustumCulled = false; scanG.add(m); return m; };
  const floorMesh = mk(floorG, floorMat, -3);
  const outerRefl = mk(outerGeo, mirMat, -2), tableRefl = mk(tableGeo, mirMat, -2);
  for (const m of [outerRefl, tableRefl]) { m.scale.y = -1; m.position.y = 2 * FLOOR; }
  const outerMesh = mk(outerGeo, solidMat, 0), tableMesh = mk(tableGeo, solidMat, 0), innerMesh = mk(innerGeo, solidMat, 0);
  crystals.renderOrder = 0; crystals.frustumCulled = false; scanG.add(crystals);

  // ------------------------------------------------------------------ the patient --
  // The tour's PET body (its own set, unchanged) lies on the couch inside a soft glass shell of the same figure. The
  // shell is the body set's own shape (its numbers, copied: tools/lbi/sets/body.js) polygonised once by surface nets.
  const fade3 = x => x * x * (3 - 2 * x);
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  function cone(x, y, z, c) {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    let h = (px * c[3] + py * c[4] + pz * c[5]) * c[6];
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = px - c[3] * h, dy = py - c[4] * h, dz = pz - c[5] * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (c[7] + (c[8] - c[7]) * h);
  }
  const mkCone = (a, b, ra, rb) => { const d = v3.sub(b, a); return [a[0], a[1], a[2], d[0], d[1], d[2], 1 / v3.dot(d, d), ra, rb]; };
  const ell = (x, y, z, c, r) => { const a = (x - c[0]) / r[0], b = (y - c[1]) / r[1], d = (z - c[2]) / r[2]; return (Math.sqrt(a * a + b * b + d * d) - 1) * Math.min(r[0], r[1], r[2]); };
  const TR = [[-0.135, 0.145, 0.092, -0.012], [-0.08, 0.158, 0.104, -0.012], [-0.01, 0.160, 0.102, -0.002], [0.08, 0.142, 0.097, 0.008],
    [0.18, 0.140, 0.100, 0.010], [0.30, 0.153, 0.108, 0.006], [0.40, 0.160, 0.104, 0.0], [0.47, 0.150, 0.088, -0.010], [0.53, 0.090, 0.060, -0.016]];
  function torso(x, y, z) {
    const y0 = TR[0][0], y1 = TR[TR.length - 1][0], yy = clamp(y, y0, y1);
    let i = 0;
    while (i < TR.length - 2 && yy > TR[i + 1][0]) i++;
    const f = fade3((yy - TR[i][0]) / (TR[i + 1][0] - TR[i][0])), at = c => TR[i][c] + (TR[i + 1][c] - TR[i][c]) * f, w = at(1), d = at(2), zc = at(3);
    const e = (Math.hypot(x / w, (z - zc) / d) - 1) * Math.min(w, d), dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
    return dy > 0 ? Math.hypot(Math.max(e, 0), dy) : e;
  }
  const J = { shoulder: [0.172, 0.468, -0.012], elbow: [0.33, 0.79, -0.002], hip: [0.086, -0.07, 0.0], knee: [0.094, -0.47, 0.012],
    ankle: [0.100, -0.872, -0.014], heel: [0.100, -0.918, -0.036], toe: [0.126, -0.93, 0.165] };
  const mir = (p, s) => [p[0] * s, p[1], p[2]];
  const tips = { 1: [-0.045, 0.93, 0.038], [-1]: [0.045, 0.925, 0.004] }, wrists = { 1: [0.108, 0.902, 0.026], [-1]: [-0.108, 0.898, 0.006] };
  const limbs = [];
  const limb = (a, b, ra, rb, k) => { const m = v3.lerp(a, b, 0.5); limbs.push([mkCone(a, b, ra, rb), k, m[0], m[1], m[2], v3.dist(a, b) / 2 + Math.max(ra, rb)]); };
  for (const s of [1, -1]) {
    limb(mir(J.shoulder, s), mir(J.elbow, s), 0.048, 0.037, 0.05); limb(mir(J.elbow, s), wrists[s], 0.035, 0.024, 0.025);
    limb(wrists[s], v3.lerp(wrists[s], tips[s], 0.82), 0.024, 0.02, 0.012); limb(mir(J.hip, s), mir(J.knee, s), 0.084, 0.049, 0.06);
    limb(mir(J.knee, s), mir(J.ankle, s), 0.047, 0.027, 0.025); limb(mir(J.heel, s), mir(J.toe, s), 0.032, 0.022, 0.025);
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
      const L = limbs[i], dx = x - L[2], dy = y - L[3], dz = z - L[4], m = Math.max(0, d + L[1] + L[5]);
      if (dx * dx + dy * dy + dz * dz > m * m) continue;
      d = smin(d, cone(x, y, z, L[0]), L[1]);
    }
    if (y < -0.4) d = smin(d, ell(Math.abs(x), y, z, [0.097, -0.59, -0.022], [0.046, 0.11, 0.05]), 0.03);
    return d;
  }
  const XS = 0.9, SHELL = 0.011;
  // surface nets over the figure (modelling coordinates; x slimmed by XS afterwards, as the body set does)
  const shellGeo = (function () {
    const h = 0.0165, lo = [-0.42, -0.985, -0.18], nx = Math.ceil(0.84 / h) + 1, ny = Math.ceil(1.97 / h) + 1, nz = Math.ceil(0.4 / h) + 1;
    const f = (x, y, z) => bodySDF(x, y, z) - SHELL, F = new Float32Array(nx * ny * nz), id = (i, j, k) => (i * ny + j) * nz + k;
    // blocks of 4 cells: only those the surface can reach (judged from the field at the block's centre) are sampled;
    // the others take the centre's sign, and the cells are visited only in sampled blocks
    const BK = 4, rb = 1.05 * Math.sqrt(3) * BK * h / 2, done = new Uint8Array(nx * ny * nz), near = [], far = [];
    for (let bi = 0; bi < nx - 1; bi += BK) for (let bj = 0; bj < ny - 1; bj += BK) for (let bl = 0; bl < nz - 1; bl += BK) {
      const b = [bi, bj, bl, Math.min(bi + BK, nx - 1), Math.min(bj + BK, ny - 1), Math.min(bl + BK, nz - 1)];
      const fc = f(lo[0] + (b[0] + b[3]) / 2 * h, lo[1] + (b[1] + b[4]) / 2 * h, lo[2] + (b[2] + b[5]) / 2 * h);
      if (Math.abs(fc) > rb) { b.push(fc > 0 ? 1 : -1); far.push(b); } else near.push(b);
    }
    for (const [bi, bj, bl, i1, j1, k1] of near) for (let i = bi; i <= i1; i++) for (let j = bj; j <= j1; j++) for (let k = bl; k <= k1; k++) {
      const q = id(i, j, k); if (!done[q]) { F[q] = f(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h); done[q] = 1; }
    }
    for (const [bi, bj, bl, i1, j1, k1, sg] of far) for (let i = bi; i <= i1; i++) for (let j = bj; j <= j1; j++) for (let k = bl; k <= k1; k++) { const q = id(i, j, k); if (!done[q]) F[q] = sg; }
    const VI = new Int32Array(nx * ny * nz).fill(-1), P = [], N = [], cv = new Float64Array(8);
    const EG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [bi, bj, bl] of near) for (let i = bi; i < Math.min(bi + BK, nx - 1); i++) for (let j = bj; j < Math.min(bj + BK, ny - 1); j++) for (let k = bl; k < Math.min(bl + BK, nz - 1); k++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) { cv[c] = F[id(i + (c & 1), j + (c >> 1 & 1), k + (c >> 2 & 1))]; if (cv[c] < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, ne = 0;
      for (const [a, b] of EG) {
        if ((cv[a] < 0) === (cv[b] < 0)) continue;
        const t = cv[a] / (cv[a] - cv[b]);
        sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; ne++;
      }
      // the normal from the cell's corners (the field's gradient across the cell)
      const gx = cv[1] + cv[3] + cv[5] + cv[7] - cv[0] - cv[2] - cv[4] - cv[6], gy = cv[2] + cv[3] + cv[6] + cv[7] - cv[0] - cv[1] - cv[4] - cv[5];
      const gz = cv[4] + cv[5] + cv[6] + cv[7] - cv[0] - cv[1] - cv[2] - cv[3], nn = v3.norm([gx / XS, gy, gz]);
      VI[id(i, j, k)] = P.length / 3;
      P.push((lo[0] + (i + sx / ne) * h) * XS, lo[1] + (j + sy / ne) * h, lo[2] + (k + sz / ne) * h); N.push(nn[0], nn[1], nn[2]);
    }
    const I = [];
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I.push(a, c, b, a, d, c); else I.push(a, b, c, a, c, d); };
    for (const [bi, bj, bl] of near) for (let i = bi; i < Math.min(bi + BK, nx - 1); i++) for (let j = bj; j < Math.min(bj + BK, ny - 1); j++) for (let k = bl; k < Math.min(bl + BK, nz - 1); k++) {
      const v0 = F[id(i, j, k)] < 0;
      if (j > 0 && k > 0 && v0 !== F[id(i + 1, j, k)] < 0) quad(VI[id(i, j - 1, k - 1)], VI[id(i, j, k - 1)], VI[id(i, j, k)], VI[id(i, j - 1, k)], !v0);
      if (i > 0 && k > 0 && v0 !== F[id(i, j + 1, k)] < 0) quad(VI[id(i - 1, j, k - 1)], VI[id(i - 1, j, k)], VI[id(i, j, k)], VI[id(i, j, k - 1)], !v0);
      if (i > 0 && j > 0 && v0 !== F[id(i, j, k + 1)] < 0) quad(VI[id(i - 1, j - 1, k)], VI[id(i, j - 1, k)], VI[id(i, j, k)], VI[id(i - 1, j, k)], !v0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
    g.setIndex(new THREE.BufferAttribute(P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I), 1));
    g.computeBoundingSphere();
    return g;
  })();
  // the shell: a dark glass body pass (it also gives the image a dark ground: the body set blends by maximum), then
  // the patient's image (renderOrder 2), then a rim of light over both
  const shellU = { uA: set.uA, uSC: { value: new THREE.Color(0.36, 0.45, 0.58) }, uSA: { value: 0.45 }, uSR: { value: 1 }, uRC: { value: new THREE.Color(0.5, 0.7, 0.95) } };
  const shellV = 'varying vec3 vN, vW; void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const shellDark = new THREE.ShaderMaterial({
    uniforms: shellU, transparent: true, depthWrite: false, vertexShader: shellV,
    fragmentShader: `uniform float uA, uSA; uniform vec3 uSC; varying vec3 vN, vW;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW), L = normalize((vec4(-0.45, 0.65, 0.75, 0.0) * viewMatrix).xyz);
  float k = 0.62 + 0.38 * clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0), nv = abs(dot(n, v));
  gl_FragColor = vec4(uSC * k, uSA * uA * (0.75 + 0.25 * (1.0 - nv)));
}`,
  });
  const shellRim = new THREE.ShaderMaterial({
    uniforms: shellU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: shellV,
    fragmentShader: `uniform float uA, uSR; uniform vec3 uRC; varying vec3 vN, vW;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW), L = normalize((vec4(-0.45, 0.65, 0.75, 0.0) * viewMatrix).xyz);
  float r = pow(1.0 - abs(dot(n, v)), 2.4), s = pow(max(dot(n, normalize(L + v)), 0.0), 36.0);
  gl_FragColor = vec4(uRC * (r * 0.75 + s * 0.22) * uSR * uA, 1.0);
}`,
  });
  set.mats.push(shellDark, shellRim);
  const patientG = new THREE.Group();
  patientG.matrixAutoUpdate = false;
  set.group.add(patientG);
  const shellD = new THREE.Mesh(shellGeo, shellDark), shellR = new THREE.Mesh(shellGeo, shellRim);
  shellD.renderOrder = 1; shellR.renderOrder = 3; shellD.frustumCulled = shellR.frustumCulled = false;
  patientG.add(shellD, shellR);
  const body = SETS.body ? SETS.body(K) : null;
  const BP = body ? Object.assign({}, body.params, { body_pet: 1, body_net: 0, body_state: 0, body_blank: 0 }) : null;
  if (body) {
    body.group.traverse(o => { if (o.isPoints) o.renderOrder = 2; });
    patientG.add(body.group);
  }

  // ------------------------------------------------------------------ where the sugar is --
  // Events are drawn from a pool of points in the body's frame weighted by FDG uptake: brain, heart muscle, kidneys
  // and bladder (FDG leaves in the urine), a tumour in the right lung, the liver, and faint tissue everywhere.
  const atX = p => [p[0] * XS, p[1], p[2]];
  const TUMOUR = atX([-0.1, 0.415, 0.012]);
  const SRC = [
    [atX([0, 0.745, 0.0]), [0.058, 0.072, 0.075], 20, 1.0], [atX([0.045, 0.29, 0.06]), [0.036, 0.042, 0.036], 8, 0.82],
    [atX([0.072, 0.115, -0.066]), [0.02, 0.042, 0.018], 4.5, 0.8], [atX([-0.072, 0.098, -0.066]), [0.02, 0.042, 0.018], 4.5, 0.8],
    [atX([0, -0.112, 0.045]), [0.036, 0.028, 0.03], 7, 1.0], [TUMOUR, [0.013, 0.013, 0.013], 3.2, 1.0],
    [atX([-0.08, 0.205, 0.012]), [0.06, 0.06, 0.06], 5, 0.45],
  ];
  const POOL = 4096, PX = new Float32Array(POOL), PY = new Float32Array(POOL), PZ = new Float32Array(POOL), PU = new Float32Array(POOL);
  {
    const R = rng(511), wsum = SRC.reduce((s, q) => s + q[2], 0) + 70, tmp = [];
    for (const [c, r, w, I] of SRC) {
      const n = Math.round(POOL * w / wsum);
      for (let k = 0; k < n; k++) { let p; do { p = [K.gauss(R) * 0.6, K.gauss(R) * 0.6, K.gauss(R) * 0.6]; } while (v3.len(p) > 1.2); tmp.push([c[0] + p[0] * r[0], c[1] + p[1] * r[1], c[2] + p[2] * r[2], I * (0.85 + 0.15 * R())]); }
    }
    while (tmp.length < POOL) {
      const x = (R() - 0.5) * 0.8, y = R() * 1.9 - 0.95, z = (R() - 0.5) * 0.34;
      if (bodySDF(x, y, z) < -0.008) tmp.push([x * XS, y, z, 0.18 + 0.1 * R()]);
    }
    tmp.length = POOL;
    tmp.sort((a, b) => a[1] - b[1]);
    tmp.forEach((q, k) => { PX[k] = q[0]; PY[k] = q[1]; PZ[k] = q[2]; PU[k] = q[3]; });
  }

  // the counts: as the image forms, the pool's points light up one by one in hot iron (a grainy first image), only
  // where the patient has passed through the ring (body height above the ring's trailing edge, uLow), then give way
  // to the smooth image; a tumour glows in the right lung (the body set has none)
  const hotC = x => [Math.pow(clamp(x * 2, 0, 1), 0.9), Math.pow(clamp((x - 0.15) / 0.8, 0, 1), 1.5), clamp((x - 0.76) * 4.2, 0, 1) * 0.95];
  const dotG = K.pointsGeo(POOL + 260);
  {
    const p = dotG.attributes.position.array, c = dotG.attributes.aCol.array, s = dotG.attributes.aSize.array, sd = new Float32Array(POOL + 260), R = rng(7);
    for (let k = 0; k < POOL; k++) { p.set([PX[k], PY[k], PZ[k]], 3 * k); c.set(hotC(PU[k] * (0.7 + 0.4 * hash(k))), 3 * k); s[k] = 0.011; sd[k] = hash(k + 99); }
    for (let k = POOL; k < POOL + 260; k++) { const q = v3.mul(K.unit(R), 0.012 * Math.cbrt(R())); p.set(v3.add(TUMOUR, q), 3 * k); c.set(hotC(0.75 + 0.25 * R()), 3 * k); s[k] = 0.012; sd[k] = -1; }
    dotG.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  }
  // up close (in a headset, or the inside view) sprites shrink with distance, so they stay grains, not discs
  const CLOSE = ' gl_PointSize *= clamp(-mv.z / length(modelViewMatrix[0].xyz) / 1.6, 0.35, 1.0);';
  const dotU = { uImg: { value: 0 }, uLow: { value: -9 } };
  const dotMat = K.points(set, { uniforms: dotU, head: 'attribute float aSeed; uniform float uImg, uLow;',
    vertex: 'vA *= (aSeed < 0.0 ? smoothstep(0.45, 0.8, uImg) : smoothstep(aSeed * 0.55, aSeed * 0.55 + 0.04, uImg) * (1.0 - smoothstep(0.62, 0.95, uImg))) * smoothstep(uLow - 0.004, uLow + 0.012, position.y);' + CLOSE });
  const dots = new THREE.Points(dotG, dotMat);
  dots.renderOrder = 4; dots.frustumCulled = false;
  patientG.add(dots);

  // ------------------------------------------------------------------ events and lines of response --
  // A positron travels about a millimetre (drawn larger), meets an electron: both turn into two 511 keV photons flying
  // apart in exactly opposite directions; each hits a crystal, which flashes; the coincidence gives a line of response
  // between the two crystals, through the point where the sugar was. Animated events come at 25 a second (each shown
  // when its hash is below a level set by scan_events); the web of lines comes from a faster stream (200 a second), as
  // a real scan records millions, and every 8th line of the web is one of the animated events (the same event), so a
  // line you saw drawn stays in the web. Everything is a function of the event's index and of where the couch is now
  // (seeking works). An event's annihilation point is fixed in the body's frame, so its line moves with the patient;
  // only points inside the ring's slice give events. The featured events (one every 2 s, which the labels follow)
  // come from the hottest source inside the slice, fly slowly and roughly sideways, rising a little to the right.
  const EV_RATE = 25, WEB_RATE = 200, WEB_N = 3000, COPY = WEB_RATE / EV_RATE, V_PH = 2.2, V_F = 1.1, TP = 0.24, WIN = 2.7;
  const NC = 20, ZE = ZH - 0.006, FEAT = 50, S0 = 0.97;
  const pose = { ty: TOP + 0.116 * S0, tz: 0.3, s: S0 };   // the body's frame in the scanner's: x' = s x, y' = ty + s z, z' = tz - s y
  const mod = (a, n) => ((a % n) + n) % n;
  const inSlice = yb => Math.abs(pose.tz - pose.s * yb) < ZE;   // a body-frame height inside the ring's slice
  const SRC_BY_W = SRC.map((q, k) => k).sort((a, b) => SRC[b][2] - SRC[a][2]);
  let featSrc = -1;
  // an event's fixed part, from its index: direction, the positron's path (6 steps, scanner frame) and its sum
  const SP = { dx: 0, dy: 0, dz: 0, ox: 0, oy: 0, oz: 0, feat: false }, STEP = new Float64Array(18);
  function spec(n, anim) {
    const feat = anim && mod(n, FEAT) === 0, kd = anim ? 0 : 1000;
    const phi = feat ? 0.04 + 0.16 * hk(n, 3) : hk(n, 3 + kd) * TAU, dz = feat ? (hk(n, 4) - 0.5) * 0.1 : (hk(n, 4 + kd) - 0.5) * 0.3, l = Math.sqrt(1 + dz * dz);
    SP.dx = Math.cos(phi) / l; SP.dy = Math.sin(phi) / l; SP.dz = dz / l; SP.feat = feat;
    SP.ox = SP.oy = SP.oz = 0;
    if (anim) for (let s = 0; s < 6; s++) {
      const ux = hk(n, 11 + s) - 0.5, uy = hk(n, 21 + s) - 0.5, uz = (hk(n, 31 + s) - 0.5) * 0.5, ul = 0.0065 / (Math.sqrt(ux * ux + uy * uy + uz * uz) || 1);
      STEP[3 * s] = ux * ul; STEP[3 * s + 1] = uy * ul; STEP[3 * s + 2] = uz * ul;
      SP.ox += ux * ul; SP.oy += uy * ul; SP.oz += uz * ul;
    }
    return SP;
  }
  // where event n's annihilation is (body frame, into CHP): a featured one at its source (jittered by a centimetre),
  // else the first of NC pool points (by hash) that, moved by the positron's path, lies inside the slice. Returns a
  // code (the candidate r, NC + the source, or -1: none)
  const CHP = [0, 0, 0];
  function choose(n, anim, feat, obx, oby, obz) {
    if (feat && featSrc >= 0) {
      const c = SRC[featSrc][0];
      CHP[0] = c[0] + (hk(n, 60) - 0.5) * 0.016; CHP[1] = c[1] + (hk(n, 61) - 0.5) * 0.016; CHP[2] = c[2] + (hk(n, 62) - 0.5) * 0.016;
      return NC + featSrc;
    }
    const kb = anim ? 7000 : 100;
    for (let r = 0; r < NC; r++) {
      const c = (hk(n, kb + r) * POOL) | 0;
      if (inSlice(PY[c] + oby)) { CHP[0] = PX[c] + obx; CHP[1] = PY[c] + oby; CHP[2] = PZ[c] + obz; return r; }
    }
    return -1;
  }
  // the positive distance along (dx, dy) from (px, py) to the circle of radius R about the axis
  const ringS = (px, py, dx, dy, R) => { const a = dx * dx + dy * dy, b = 2 * (px * dx + py * dy), c = px * px + py * py - R * R; return (-b + Math.sqrt(Math.max(b * b - 4 * a * c, 0))) / (2 * a); };
  // An animated event, worked out in full (no allocation): EV holds its annihilation point P and emission point in
  // the scanner's frame, its direction, both crystals (centres, instance index), how far each photon flies before it
  // shows its hit (the crystal's face where the bore's cover is open, else the cover) and the flash points there.
  const EV = { px: 0, py: 0, pz: 0, ex: 0, ey: 0, ez: 0, dx: 0, dy: 0, dz: 0, A: [0, 0, 0], B: [0, 0, 0], FA: [0, 0, 0], FB: [0, 0, 0], iA: 0, iB: 0, tA: 0, tB: 0, feat: false, V: V_PH };
  // a line's end on the ring: snapped to its crystal's centre round the ring, but not along the axis, so a line
  // glides with the couch instead of stepping from one row of crystals to the next
  function crystalAt(qx, qy, qz, out, fo, rf) {
    const ia = mod(Math.floor(Math.atan2(qy, qx) / cryPitchA), NA), iz = clamp(Math.floor((qz + ZH) / cryPitchZ), 0, NZ - 1), an = cryA(ia), c = Math.cos(an), s = Math.sin(an);
    out[0] = RDET * c; out[1] = RDET * s; out[2] = qz;
    fo[0] = rf * c; fo[1] = rf * s; fo[2] = qz;
    return ia * NZ + iz;
  }
  function place(j) {
    spec(j, true);
    const s = pose.s, code = choose(j, true, SP.feat, SP.ox / s, -SP.oz / s, SP.oy / s);
    if (code < 0) return false;
    const px = s * CHP[0], py = pose.ty + s * CHP[2], pz = pose.tz - s * CHP[1];
    EV.px = px; EV.py = py; EV.pz = pz; EV.ex = px - SP.ox; EV.ey = py - SP.oy; EV.ez = pz - SP.oz; EV.feat = SP.feat; EV.V = SP.feat ? V_F : V_PH;
    // both photons must reach the ring inside its length; if not, the event flies flat (as the web's shader does)
    let dx = SP.dx, dy = SP.dy, dz = SP.dz, s1 = ringS(px, py, dx, dy, RDET), s2 = ringS(px, py, -dx, -dy, RDET);
    if (Math.abs(pz + dz * s1) > ZH || Math.abs(pz - dz * s2) > ZH) { const l = Math.hypot(dx, dy); dx /= l; dy /= l; dz = 0; s1 = ringS(px, py, dx, dy, RDET); s2 = ringS(px, py, -dx, -dy, RDET); }
    EV.dx = dx; EV.dy = dy; EV.dz = dz;
    // the cover over the ring is gone above the cut and inside the opened window
    const cy = SU.uCut.value, cw = SU.uWin.value;
    for (let e = 0; e < 2; e++) {
      const sg = e ? -1 : 1, sd = e ? s2 : s1, qx = px + sg * dx * sd, qy = py + sg * dy * sd, qz = pz + sg * dz * sd;
      // (a point sprite has one depth: the flash stands 2 cm in front of the face, or the crystals beside it cut it)
      const open = qy > cy || Math.abs(qz) < cw, rs = open ? RC0 - 0.004 : RB - 0.004, rf = open ? RC0 - 0.02 : RB - 0.01;
      const idx = crystalAt(qx, qy, qz, e ? EV.B : EV.A, e ? EV.FB : EV.FA, rf), st = ringS(px, py, sg * dx, sg * dy, rs);
      if (e) { EV.iB = idx; EV.tB = st; } else { EV.iA = idx; EV.tA = st; }
    }
    return true;
  }
  // the featured events' state for the labels: the latest one's annihilation point and how far it has got, and the
  // left-hand end of the latest featured line of response
  const featured = { on: false, p: [0, 0, 0], lor: [0, 0, 0], env: 0, lorOn: 0 };
  function featState(t) {
    featured.on = false; featured.env = 0; featured.lorOn = 0;
    let jf = Math.floor(t * EV_RATE / FEAT) * FEAT;
    if ((jf + 0.8 * hk(jf, 50)) / EV_RATE > t) jf -= FEAT;
    let got = false;
    for (let q = 0; q < 2; q++) {
      const j = jf - q * FEAT, age = t - (j + 0.8 * hk(j, 50)) / EV_RATE;
      if (!place(j)) continue;
      const tc = TP + Math.max(EV.tA, EV.tB) / EV.V;
      if (j === jf) {
        featured.on = true;
        featured.p[0] = EV.px; featured.p[1] = EV.py + 0.15; featured.p[2] = EV.pz;
        featured.env = smooth(age / 0.15) * (1 - smooth((age - tc - 0.6) / 0.4));
      }
      if (!got && age >= tc && age < tc + 2.05) {
        got = true; featured.on = true; featured.lorOn = 1;
        const L = EV.A[0] < EV.B[0] ? EV.A : EV.B;
        featured.lor[0] = L[0] + 0.03; featured.lor[1] = L[1] - 0.08; featured.lor[2] = L[2];
      }
    }
    if (!got && featured.on) { featured.lor[0] = featured.p[0] - 0.39; featured.lor[1] = featured.p[1] - 0.2; featured.lor[2] = featured.p[2]; }
  }

  // The web: one buffer of 3000 reusable slots (slot = index mod 3000). A slot keeps its event's annihilation point
  // in the body's frame (position) and direction (aD: + at one end, - at the other); the shader puts the line in
  // the scanner from the couch's pose (uPose), meets the ring and snaps both ends to crystals round the ring, so a moving
  // couch only changes a uniform. The CPU picks each slot's point (the first of its candidates inside the slice),
  // and rewrites only the slots whose pick changes, plus the few newest each frame.
  const webG = K.linesGeo(WEB_N);
  webG.setAttribute('aD', new THREE.BufferAttribute(new Float32Array(WEB_N * 6), 3));
  webG.setAttribute('aIdx', new THREE.BufferAttribute(new Float32Array(WEB_N * 2).fill(-1e9), 1));
  webG.setAttribute('aTim', new THREE.BufferAttribute(new Float32Array(WEB_N * 2).fill(-1e9), 1));
  {
    const c = webG.attributes.aCol.array, p = webG.attributes.position.array;
    for (let k = 0; k < WEB_N; k++) { const v = 0.8 + 0.2 * hash(k + 7); c.set([1.0 * v, 0.42 * v, 0.12 * v, 1.0 * v, 0.42 * v, 0.12 * v], 6 * k); p[6 * k + 1] = p[6 * k + 4] = 99; }
  }
  const f6 = x => x.toFixed(6);
  const webU = { uHead: { value: 0 }, uCap: { value: 0 }, uNow: { value: 0 }, uLin: { value: 0 }, uPose: { value: new THREE.Vector3(pose.ty, pose.tz, pose.s) } };
  const webMat = K.lines(set, { uniforms: webU,
    head: `attribute float aIdx, aTim; attribute vec3 aD; uniform float uHead, uCap, uNow, uLin; uniform vec3 uPose;
const float RD = ${f6(RDET)}, ZH_ = ${f6(ZH)}, ZE_ = ${f6(ZE)}, PA = ${f6(cryPitchA)};
float ringS(vec2 p, vec2 d) { float a = dot(d, d), b = 2.0 * dot(p, d), c = dot(p, p) - RD * RD; return (-b + sqrt(max(b * b - 4.0 * a * c, 0.0))) / (2.0 * a); }`,
    vertex: `
  float kk = uHead - aIdx, age = uNow - aTim;
  vA *= uLin * smoothstep(0.0, 0.3, age) * step(-0.5, kk) * (1.0 - smoothstep(uCap * 0.7, uCap + 0.5, kk));
  vec3 P = vec3(uPose.z * position.x, uPose.x + uPose.z * position.z, uPose.y - uPose.z * position.y), d = aD;
  vA *= 1.0 - smoothstep(ZE_ - 0.02, ZE_, abs(P.z));   // fainter at the slice's edges (as a ring's sensitivity is)
  float s1 = ringS(P.xy, d.xy), s2 = ringS(P.xy, -d.xy);
  if (abs(P.z + d.z * s1) > ZH_ || abs(P.z - d.z * s2) > ZH_) { d = vec3(normalize(d.xy), 0.0); s1 = ringS(P.xy, d.xy); }
  vec3 q = P + d * s1;
  float an = (floor(atan(q.y, q.x) / PA) + 0.5) * PA;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(RD * cos(an), RD * sin(an), q.z, 1.0);` });
  const web = new THREE.LineSegments(webG, webMat);
  web.renderOrder = 5; web.frustumCulled = false; scanG.add(web);
  // per slot: its event's index, candidates (pool index and body height), the positron's offset (body frame),
  // whether featured, its current pick, and the pose version it was picked for
  const slotIdx = new Float64Array(WEB_N).fill(NaN), CI = new Int32Array(WEB_N * NC), CY = new Float32Array(WEB_N * NC);
  const OB = new Float32Array(WEB_N * 3), FJ = new Float32Array(WEB_N * 3), WF = new Uint8Array(WEB_N), pick = new Int16Array(WEB_N).fill(-2), stamp = new Int32Array(WEB_N).fill(-1);
  let poseVer = 0, lastTz = NaN, lastSrc = -2;
  function writeSlot(slot, i) {
    const anim = mod(i, COPY) === 0, n = anim ? i / COPY : i, A = webG.attributes;
    spec(n, anim);
    const obx = SP.ox / S0, oby = -SP.oz / S0, obz = SP.oy / S0, kb = anim ? 7000 : 100, b = slot * NC;
    OB[3 * slot] = obx; OB[3 * slot + 1] = oby; OB[3 * slot + 2] = obz; WF[slot] = SP.feat ? 1 : 0;
    if (SP.feat) { FJ[3 * slot] = (hk(n, 60) - 0.5) * 0.016; FJ[3 * slot + 1] = (hk(n, 61) - 0.5) * 0.016; FJ[3 * slot + 2] = (hk(n, 62) - 0.5) * 0.016; }
    for (let r = 0; r < NC; r++) { const c = (hk(n, kb + r) * POOL) | 0; CI[b + r] = c; CY[b + r] = PY[c] + oby; }
    const D = A.aD.array;
    D[6 * slot] = SP.dx; D[6 * slot + 1] = SP.dy; D[6 * slot + 2] = SP.dz; D[6 * slot + 3] = -SP.dx; D[6 * slot + 4] = -SP.dy; D[6 * slot + 5] = -SP.dz;
    A.aIdx.array[2 * slot] = A.aIdx.array[2 * slot + 1] = i;
    // an animated event's line joins the web as its coincidence comes (about when the second photon arrives)
    A.aTim.array[2 * slot] = A.aTim.array[2 * slot + 1] = anim ? (n + 0.8 * hk(n, 50)) / EV_RATE + TP + 0.42 / (SP.feat ? V_F : V_PH) : i / WEB_RATE;
    pick[slot] = -2; stamp[slot] = -1;
  }
  function pickSlot(slot) {
    let code = -1;
    const b = slot * NC;
    if (WF[slot] && featSrc >= 0) code = NC + featSrc;
    else for (let r = 0; r < NC; r++) if (Math.abs(pose.tz - pose.s * CY[b + r]) < ZE) { code = r; break; }
    if (code === pick[slot]) return false;
    pick[slot] = code;
    let x = 0, y = 99, z = 0;
    if (code >= NC) { const c = SRC[code - NC][0]; x = c[0] + FJ[3 * slot]; y = c[1] + FJ[3 * slot + 1]; z = c[2] + FJ[3 * slot + 2]; }
    else if (code >= 0) { const c = CI[b + code]; x = PX[c] + OB[3 * slot]; y = PY[c] + OB[3 * slot + 1]; z = PZ[c] + OB[3 * slot + 2]; }
    const p = webG.attributes.position.array;
    p[6 * slot] = p[6 * slot + 3] = x; p[6 * slot + 1] = p[6 * slot + 4] = y; p[6 * slot + 2] = p[6 * slot + 5] = z;
    return true;
  }
  const upload = (at, lo, hi, per) => {
    if (hi < lo) return;
    const full = hi - lo > 1200;
    at.updateRange.offset = full ? 0 : lo * per; at.updateRange.count = full ? -1 : (hi - lo + 1) * per; at.needsUpdate = true;
  };
  function webStep(cap, head) {
    if (pose.tz !== lastTz || featSrc !== lastSrc) { poseVer++; lastTz = pose.tz; lastSrc = featSrc; }
    let loM = WEB_N, hiM = -1, loP = WEB_N, hiP = -1;
    for (let k = 0; k < cap; k++) {
      const i = head - k, slot = mod(i, WEB_N);
      if (slotIdx[slot] !== i) { slotIdx[slot] = i; writeSlot(slot, i); if (slot < loM) loM = slot; if (slot > hiM) hiM = slot; }
      if (stamp[slot] !== poseVer) { stamp[slot] = poseVer; if (pickSlot(slot)) { if (slot < loP) loP = slot; if (slot > hiP) hiP = slot; } }
    }
    const A = webG.attributes;
    upload(A.aD, loM, hiM, 6); upload(A.aIdx, loM, hiM, 2); upload(A.aTim, loM, hiM, 2); upload(A.position, loP, hiP, 6);
  }

  // the animated events: positron paths, photon streaks and lines of response (lines), flashes, photons' comets and
  // heads (points), the featured line of response as a soft glowing beam (two quads at most), crystals' glow
  const FXL = 1000, FXP = 640;
  const fxG = K.linesGeo(FXL), fxPG = K.pointsGeo(FXP);
  const fxL = new THREE.LineSegments(fxG, K.lines(set)), fxP = new THREE.Points(fxPG, K.points(set, { vertex: CLOSE }));
  fxL.renderOrder = 6; fxP.renderOrder = 7; fxL.frustumCulled = fxP.frustumCulled = false;
  scanG.add(fxL, fxP);
  const beamG = new THREE.BufferGeometry();
  {
    const at = (k, n) => beamG.setAttribute(k, new THREE.BufferAttribute(new Float32Array(8 * n), n));
    at('position', 3); at('aB', 3); at('aS', 1); at('aF', 1); at('aA', 1);
    for (let q = 0; q < 2; q++) [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sd, f], v) => { beamG.attributes.aS.array[4 * q + v] = sd; beamG.attributes.aF.array[4 * q + v] = f; });
    beamG.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  }
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uW: { value: 0.009 }, uC: { value: new THREE.Color(1.0, 0.62, 0.3) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 aB; attribute float aS, aF, aA; uniform float uA, uW; varying float vS, vA;
void main() {
  vec4 a = modelViewMatrix * vec4(position, 1.0); vec3 b = (modelViewMatrix * vec4(aB, 1.0)).xyz;
  vec3 sd = normalize(cross(b - a.xyz, a.xyz));   // across the line, square to the view
  a.xyz += sd * aS * aF * uW * length(modelViewMatrix[0].xyz);
  vS = aS; vA = aA * uA;
  gl_Position = projectionMatrix * a;
}`,
    fragmentShader: `uniform vec3 uC; varying float vS, vA;
void main() { float f = 1.0 - abs(vS); gl_FragColor = vec4((uC * 0.6 * f * f + vec3(1.0, 0.9, 0.75) * 0.75 * pow(f, 10.0)) * vA, 1.0); }`,
  });
  set.mats.push(beamMat);
  const beam = new THREE.Mesh(beamG, beamMat);
  beam.renderOrder = 6; beam.frustumCulled = false; scanG.add(beam);
  const LIT = new Int32Array(256);
  let nLit = 0;

  // ------------------------------------------------------------------ the vision row --
  // the scanner moves to the left; to its right, linked by flowing light: the glowing body standing (the same
  // body, risen from the couch), a neon network of organs, and prognosis (three bars) above medication (a bar chart)
  const visG = new THREE.Group();
  set.group.add(visG);
  const VX = { body: -0.62, net: 0.68, prog: 2.36 }, CHEV = [-1.15, -0.06, 1.46];
  // between the stages, a glowing line in a shallow arc with pulses of light running along it, left to right: soft
  // points packed along each arc (aS: how far along, aG: which gap); the pulses move with the clock (uFlow), so a seek
  // shows them where they would be
  const FLOW_N = 60, FLOW_W = 0.3, flowG = K.pointsGeo(3 * FLOW_N), flowS = new Float32Array(3 * FLOW_N), flowGi = new Float32Array(3 * FLOW_N);
  CHEV.forEach((cx, k) => {
    for (let i = 0; i < FLOW_N; i++) {
      const s = i / (FLOW_N - 1), n = k * FLOW_N + i, x = cx + (s * 2 - 1) * FLOW_W, y = -0.04 + 0.05 * Math.sin(PI * s);
      flowG.attributes.position.array.set([x, y, 0.035], 3 * n);
      flowG.attributes.aCol.array.set(v3.lerp([0.22, 0.62, 1.0], [0.45, 0.9, 1.0], s), 3 * n);
      flowG.attributes.aSize.array[n] = 0.042; flowG.attributes.aA.array[n] = 0.45 * Math.pow(Math.sin(PI * s), 0.35);   // (soft at the ends)
      flowS[n] = s; flowGi[n] = k;
    }
  });
  flowG.setAttribute('aS', new THREE.BufferAttribute(flowS, 1)); flowG.setAttribute('aG', new THREE.BufferAttribute(flowGi, 1));
  const flowU = { uFlow: { value: 0 }, uGap: { value: new THREE.Vector3() } };
  const flow = new THREE.Points(flowG, K.points(set, { uniforms: flowU, head: 'attribute float aS, aG; uniform float uFlow; uniform vec3 uGap;',
    // two pulses a gap, each a bright head with a fading tail behind it; the gaps a little out of step
    vertex: `float h = fract(uFlow * 0.42 + aG * 0.31), p = 0.0;
  for (int j = 0; j < 2; j++) { float d = fract(h + float(j) * 0.5 - aS); p = max(p, exp(-d * 9.0) * smoothstep(0.0, 0.03, 1.0 - d)); }
  float e = aG < 0.5 ? uGap.x : aG < 1.5 ? uGap.y : uGap.z, edge = smoothstep(0.0, 0.08, aS) * smoothstep(1.0, 0.9, aS);
  vA = (vA + 0.95 * p * edge * uA) * e;
  vC = mix(vC, vec3(0.92, 0.98, 1.0), p * 0.75);
  gl_PointSize *= 1.0 + 1.4 * p * edge;` }));
  flow.renderOrder = 8; flow.frustumCulled = false; visG.add(flow);
  // the neon organs (icons from PET_ICONS, drawn glowing in each organ's colour on one canvas)
  const NET_ORG = [['brain', '#a78bfa', [0.06, 0.47, 0.04], 0.36], ['lungs', '#60a5fa', [0.0, 0.08, -0.05], 0.36], ['heart', '#f43f5e', [-0.37, -0.22, 0.1], 0.3],
    ['liver', '#f97316', [0.37, -0.2, 0.08], 0.31], ['kidneys', '#fb7185', [0.02, -0.56, 0.0], 0.27]];
  // the other organs once each, and three more nodes in a neutral white (as on the slide, more than the organs drawn)
  const NET_NODE = [['thyroid', [-0.43, 0.43, -0.1]], ['muscle', [-0.6, 0.12, 0.12]], ['adrenal', [-0.2, 0.26, 0.18]], ['spleen', [0.3, 0.3, -0.12]],
    ['pancreas', [0.58, 0.1, 0.1]], ['intestine', [0.6, -0.46, -0.06]], ['fat', [-0.52, -0.52, -0.12]], ['marrow', [0.32, -0.66, 0.12]], ['aorta', [-0.13, -0.36, -0.15]],
    [null, [-0.22, 0.64, 0.0]], [null, [0.42, 0.6, 0.06]], [null, [-0.66, -0.2, -0.05]]];
  let iconTex = null;
  {
    const S = 256, cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (cv) {
      cv.width = 4 * S; cv.height = 2 * S;   // four icons to a row (a power of two: no resizing on WebGL1)
      const ctx = cv.getContext('2d');
      NET_ORG.forEach(([id, f], k) => {
        const col = (D && (D.organs.find(o => o.id === id) || {}).col) || f, cx = (k % 4 + 0.5) * S, cy = ((k >> 2) + 0.5) * S;
        if (typeof PET_ICONS !== 'undefined') {
          ctx.globalAlpha = 0.22; PET_ICONS.draw(ctx, id, cx, cy, S * 0.8, { color: col, width: S * 0.09 });
          ctx.globalAlpha = 1; PET_ICONS.draw(ctx, id, cx, cy, S * 0.8, { color: col, width: S * 0.03, glow: true });
          ctx.globalAlpha = 0.8; PET_ICONS.draw(ctx, id, cx, cy, S * 0.8, { color: '#ffffff', width: S * 0.008 });
        } else { ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, S * 0.35, 0, TAU); ctx.stroke(); }
      });
      ctx.globalAlpha = 1;
      iconTex = new THREE.CanvasTexture(cv);
      iconTex.anisotropy = 4;
    }
  }
  const iconU = { uMap: { value: iconTex }, uF: { value: 0 } };
  const iconMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, iconU), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D uMap; uniform float uA, uF; varying vec2 vUv; void main() { vec4 c = texture2D(uMap, vUv); gl_FragColor = vec4(c.rgb * c.a * 1.35 * uA * uF, 1.0); }',
  });
  set.mats.push(iconMat);
  const netC = [VX.net, 0.02, 0];
  {
    const quads = NET_ORG.map(([id, f, p, s], k) => {
      const g = new THREE.PlaneGeometry(s, s), uv = g.attributes.uv.array;
      for (let v = 0; v < uv.length; v += 2) { uv[v] = (k % 4 + uv[v]) / 4; uv[v + 1] = 1 - ((k >> 2) + 1 - uv[v + 1]) / 2; }
      return g.translate(netC[0] + p[0], netC[1] + p[1], p[2]);
    });
    const icons = new THREE.Mesh(K.merge(quads), iconMat);
    icons.renderOrder = 9; icons.frustumCulled = false; visG.add(icons);
  }
  // the network's nodes (the other organs, small coloured discs) and glowing links (each in its two nodes' colours)
  const NODES = [...NET_ORG.map(([id, f, p]) => ({ p: v3.add(netC, p), c: ocol(id, f), big: true })), ...NET_NODE.map(([id, p]) => ({ p: v3.add(netC, p), c: id ? ocol(id, '#99aaaa') : [0.84, 0.88, 0.95], big: false }))];
  const LINKS = [];
  {
    const seen = new Set();
    NODES.forEach((a, i) => {
      const near = NODES.map((b, j) => [v3.dist(a.p, b.p), j]).filter(q => q[1] !== i).sort((x, y) => x[0] - y[0]).slice(0, 3);
      for (const [, j] of near) { const key = Math.min(i, j) + ',' + Math.max(i, j); if (!seen.has(key)) { seen.add(key); LINKS.push([i, j]); } }
    });
  }
  const nlG = K.linesGeo(LINKS.length), nnG = K.pointsGeo(NODES.length * 2);
  LINKS.forEach(([i, j], k) => {
    const a = NODES[i], b = NODES[j], u = v3.norm(v3.sub(b.p, a.p)), ra = a.big ? 0.1 : 0.02, rb = b.big ? 0.1 : 0.02;
    nlG.attributes.position.array.set([...v3.add(a.p, v3.mul(u, ra)), ...v3.sub(b.p, v3.mul(u, rb))], 6 * k);
    nlG.attributes.aCol.array.set([...a.c, ...b.c], 6 * k);
    nlG.attributes.aA.array.set([0.75, 0.75], 2 * k);
  });
  NODES.forEach((n, k) => {
    const A = nnG.attributes;
    A.position.array.set(n.p, 6 * k); A.position.array.set(n.p, 6 * k + 3);
    A.aCol.array.set(n.c, 6 * k); A.aCol.array.set(v3.lerp(n.c, [1, 1, 1], 0.55), 6 * k + 3);
    A.aSize.array[2 * k] = n.big ? 0.0 : 0.075; A.aSize.array[2 * k + 1] = n.big ? 0.0 : 0.032;
    A.aA.array[2 * k] = 0.55; A.aA.array[2 * k + 1] = 1;
  });
  const netU = { uF: { value: 0 } };
  const netL = new THREE.LineSegments(nlG, K.lines(set, { uniforms: netU, head: 'uniform float uF;', vertex: 'vA *= uF;' }));
  const netN = new THREE.Points(nnG, K.points(set, { uniforms: netU, head: 'uniform float uF;', vertex: 'vA *= uF;' }));
  netL.renderOrder = 8; netN.renderOrder = 9; netL.frustumCulled = netN.frustumCulled = false;
  visG.add(netL, netN);
  // prognosis and medication: neon rectangles drawn from their distance fields (frames, filled bars, a panel, bars
  // rising from an axis); aE groups them for the left-to-right fade (1-3 the prognosis bars, 4 medication)
  const neonU = { uG: { value: new THREE.Vector4() } };
  const neonMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, neonU), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec2 aQ, aH; attribute vec4 aR; attribute vec3 aC0, aC1; attribute float aE;
uniform vec4 uG; uniform float uA;
varying vec2 vQ, vH; varying vec4 vR; varying vec3 vC0, vC1; varying float vF;
void main() {
  vQ = aQ; vH = aH; vR = aR; vC0 = aC0; vC1 = aC1;
  vF = dot(vec4(equal(vec4(aE), vec4(1.0, 2.0, 3.0, 4.0))), uG);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `uniform float uA; varying vec2 vQ, vH; varying vec4 vR; varying vec3 vC0, vC1; varying float vF;
float sdB(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  float mode = vR.y, r = vR.x, w = vR.w, g = clamp((vF - vR.z) / max(1.0 - vR.z, 0.01), 0.0, 1.0);
  vec3 col = vec3(0.0);
  if (mode < 0.5) {
    float d = sdB(vQ, vH, r), ad = abs(d);
    col = mix(vC0, vec3(1.0), 0.45) * exp(-ad * ad / (w * w)) + vC0 * 0.28 * exp(-ad / (w * 5.0)) + vC1 * 0.1 * smoothstep(0.004, -0.004, d);
    g = smoothstep(0.0, 0.4, g);
  } else if (mode < 1.5) {
    float f = g, x0 = -vH.x, x1 = -vH.x + 2.0 * vH.x * vR.w * f;
    vec2 hb = vec2(max((x1 - x0) * 0.5, 0.0005), vH.y);
    float d = sdB(vQ - vec2((x0 + x1) * 0.5, 0.0), hb, min(r, hb.x)), s = clamp((vQ.x - x0) / max(x1 - x0, 0.001), 0.0, 1.0);
    vec3 cc = mix(vC0, vC1, s);
    col = cc * (smoothstep(0.003, -0.003, d) * (0.55 + 0.75 * s * s) + 0.5 * exp(-max(d, 0.0) / 0.018)) * step(0.001, f);
    g = smoothstep(0.0, 0.25, g);
  } else if (mode < 2.5) {
    float d = sdB(vQ, vH, r);
    col = vC0 * (smoothstep(0.004, -0.004, d) * 0.07 + exp(-d * d / (w * w)) * 0.35);
    g = smoothstep(0.0, 0.5, g);
  } else {
    float hh = max(vH.y * g, 0.0005), d = sdB(vQ - vec2(0.0, -vH.y + hh), vec2(vH.x, hh), min(r, hh)), ad = abs(d);
    col = (mix(vC0, vec3(1.0), 0.3) * exp(-ad * ad / (w * w)) + vC0 * (0.3 * exp(-ad / (w * 5.0)) + 0.1 * smoothstep(0.003, -0.003, d))) * step(0.002, g);
    g = smoothstep(0.0, 0.2, g);
  }
  gl_FragColor = vec4(col * g * uA, 1.0);
}`,
  });
  set.mats.push(neonMat);
  {
    const R = [];   // [cx, cy, hx, hy, radius, mode, delay or fraction, width, c0, c1, element]
    const PB = [[0.64, 0.8, '#ff6a1a', '#ffc27a', 1], [0.42, 0.4, '#e0103c', '#ff3a50', 2], [0.2, 0.9, '#ffb000', '#fff08a', 3]];
    for (const [y, f, c0, c1, e] of PB) {
      R.push([VX.prog, y, 0.55, 0.068, 0.066, 0, 0.0, 0.006, [0.92, 0.94, 1.0], [0.1, 0.11, 0.14], e]);
      R.push([VX.prog, y, 0.53, 0.05, 0.05, 1, 0.0, f, K.rgb(c0), K.rgb(c1), e]);
    }
    const my = -0.41, mh = 0.35, ORANGE = K.rgb('#ff7a1a');
    R.push([VX.prog, my, 0.56, mh, 0.03, 2, 0.0, 0.008, [0.32, 0.36, 0.5], [0, 0, 0], 4]);
    R.push([VX.prog - 0.46, my, 0.004, mh - 0.06, 0.004, 0, 0.0, 0.0045, [1.0, 0.86, 0.7], [0, 0, 0], 4]);
    R.push([VX.prog + 0.02, my - mh + 0.06, 0.48, 0.004, 0.004, 0, 0.0, 0.0045, [1.0, 0.86, 0.7], [0, 0, 0], 4]);
    [0.42, 0.78, 0.3, 0.55, 0.68].forEach((hgt, k) => {
      const h2 = (2 * mh - 0.16) * hgt / 2, x = VX.prog - 0.31 + k * 0.16;
      R.push([x, my - mh + 0.075 + h2, 0.045, h2, 0.008, 3, 0.15 + 0.12 * k, 0.005, ORANGE, [0, 0, 0], 4]);
    });
    const n = R.length, PAD = 0.07, pos = new Float32Array(n * 12), aQ = new Float32Array(n * 8), aH = new Float32Array(n * 8), aR = new Float32Array(n * 16);
    const c0 = new Float32Array(n * 12), c1 = new Float32Array(n * 12), aE = new Float32Array(n * 4), idx = [];
    R.forEach(([cx, cy, hx, hy, rad, mode, del, wf, C0, C1, e], k) => {
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], v) => {
        const qx = sx * (hx + PAD), qy = sy * (hy + PAD), o = k * 4 + v;
        pos.set([cx + qx, cy + qy, 0.02 * mode], 3 * o); aQ.set([qx, qy], 2 * o); aH.set([hx, hy], 2 * o);
        aR.set(mode === 1 ? [rad, mode, 0, wf] : [rad, mode, del, wf], 4 * o); c0.set(C0, 3 * o); c1.set(C1, 3 * o); aE[o] = e;
      });
      idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
    });
    const g = new THREE.BufferGeometry(), at = (key, a, s) => g.setAttribute(key, new THREE.BufferAttribute(a, s));
    at('position', pos, 3); at('aQ', aQ, 2); at('aH', aH, 2); at('aR', aR, 4); at('aC0', c0, 3); at('aC1', c1, 3); at('aE', aE, 1);
    g.setIndex(idx);
    const neon = new THREE.Mesh(g, neonMat);
    neon.renderOrder = 9; neon.frustumCulled = false; visG.add(neon);
  }

  // ------------------------------------------------------------------ update --
  const mS = new THREE.Matrix4(), mL = new THREE.Matrix4(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), sa = new THREE.Vector3(), sb = new THREE.Vector3();
  const LIE = new THREE.Matrix4().makeRotationX(-PI / 2), STAND = new THREE.Vector3(VX.body, 0.0, 0), SSTAND = 0.8;
  const BED_IN = 1.15, PASS = 0.85, TZ0 = 0.85;   // the table's head end at bed 0; its travel in; the travel of the pass
  let tableZ = TZ0;
  const live = { vis: 0, img: 0, ev: 0 };
  const sp = p => xp(scanG.matrix, p), pp = p => xp(patientG.matrix, p);
  function writeLine(k, ax, ay, az, bx, by, bz, col, al) {
    const A = fxG.attributes, P = A.position.array, C = A.aCol.array, k6 = 6 * k;
    P[k6] = ax; P[k6 + 1] = ay; P[k6 + 2] = az; P[k6 + 3] = bx; P[k6 + 4] = by; P[k6 + 5] = bz;
    C[k6] = C[k6 + 3] = col[0]; C[k6 + 1] = C[k6 + 4] = col[1]; C[k6 + 2] = C[k6 + 5] = col[2];
    A.aA.array[2 * k] = A.aA.array[2 * k + 1] = al;
  }
  function writePoint(k, x, y, z, col, size, al) {
    const A = fxPG.attributes, P = A.position.array, C = A.aCol.array, k3 = 3 * k;
    P[k3] = x; P[k3 + 1] = y; P[k3 + 2] = z; C[k3] = col[0]; C[k3 + 1] = col[1]; C[k3 + 2] = col[2]; A.aSize.array[k] = size; A.aA.array[k] = al;
  }
  function writeBeam(q, a, b, al) {
    const A = beamG.attributes, P = A.position.array, B = A.aB.array;
    for (let v = 0; v < 4; v++) {
      const o = 3 * (4 * q + v), s = v < 2 ? a : b, e = v < 2 ? b : a;
      P[o] = s[0]; P[o + 1] = s[1]; P[o + 2] = s[2]; B[o] = e[0]; B[o + 1] = e[1]; B[o + 2] = e[2]; A.aA.array[4 * q + v] = al;
    }
  }
  const lightCrystal = (idx, g) => { if (CG[idx] === 0 && nLit < LIT.length) LIT[nLit++] = idx; if (g > CG[idx]) CG[idx] = g; };
  const C_POS = [1.0, 0.36, 0.86], C_PH = [1.0, 0.9, 0.6], C_FL = [1.0, 0.96, 0.85], C_CR = [0.55, 0.9, 1.0], C_LOR = [1.0, 0.68, 0.36], C_WH = [1, 1, 1];

  function update(S, t) {
    const g = k => clamp(S[k] || 0, 0, 1);
    const vision = g('scan_vision'), bed = g('scan_bed'), cut = g('scan_cut') * (1 - prog(vision, 0, 0.3)), evs = g('scan_events'), lin = g('scan_lines'), img = g('scan_image');
    // as the image forms, the couch carries the patient on through the ring to the thighs (the counts come in behind it)
    const pass = g('scan_pass') + (1 - g('scan_pass')) * prog(img, 0, 0.6);
    const flo = S.scan_floor === undefined ? 1 : g('scan_floor');
    live.vis = vision; live.img = img; live.ev = evs;
    // the scanner moves to the left, shrinks a little and turns to show its side (as on the slide)
    const fs = smooth(prog(vision, 0, 0.45));
    scanG.position.set(lerp(0, -2.12, fs), lerp(0, -0.1, fs), lerp(0, -0.6, fs));
    scanG.rotation.y = lerp(0, -0.55, fs);
    scanG.scale.setScalar(lerp(1, 0.55, fs));
    scanG.updateMatrix(); scanG.matrixWorldNeedsUpdate = true;
    // the couch slides in, then on through the ring (the pass: from the head to the pelvis)
    tableZ = TZ0 - BED_IN * smooth(bed) - PASS * smooth(pass);
    tableMesh.position.z = tableZ; tableRefl.position.z = tableZ;
    pose.tz = tableZ + 0.3 + 0.712 * pose.s;
    // the patient: lying on the couch (in the scanner's frame), or standing up in the vision row
    mL.makeTranslation(0, pose.ty, pose.tz).multiply(LIE).multiply(mS.makeScale(pose.s, pose.s, pose.s));
    mL.premultiply(scanG.matrix);
    const fb = smooth(prog(vision, 0.08, 0.5));
    if (fb <= 0) patientG.matrix.copy(mL);
    else {
      mL.decompose(pa, qa, sa);
      qb.identity(); pb.copy(STAND); sb.setScalar(SSTAND);
      pa.lerp(pb, fb); pa.y += Math.sin(PI * fb) * 0.35; qa.slerp(qb, fb); sa.lerp(sb, fb);
      patientG.matrix.compose(pa, qa, sa);
    }
    patientG.matrixWorldNeedsUpdate = true;
    // the cut: the housing's upper half goes (a plane sweeping down to just above the bore's centre); lights down
    SU.uCut.value = lerp(1.12, 0.015, smooth(cut));
    SU.uWin.value = (ZH + 0.012) * smooth(prog(cut, 0.5, 1));
    innerMesh.visible = crystals.visible = cut > 0.002;   // hidden by the housing until it opens
    SU.uDim.value = 1 - 0.38 * smooth(Math.max(cut, evs)) * (1 - vision);
    const a = set.uA.value, solid = a > 0.97;
    solidMat.depthWrite = cryMat.depthWrite = solid;
    floorMesh.visible = outerRefl.visible = tableRefl.visible = flo > 0.003;
    floorMat.uniforms.uF.value = flo * (1 - 0.4 * fs);
    // the image: the counts light up behind the ring as the patient passes through it, then the smooth image (the
    // body set at steady state) glows inside the shell once the pass is done
    const standA = prog(vision, 0.1, 0.42), imgA = smooth(prog(img, 0.5, 0.95));
    const bodyA = Math.max(imgA * (1 - fb), standA);
    if (body) {
      body.setAlpha(a * bodyA);
      if (bodyA > 0.003) body.update(BP, t);
    }
    dotU.uImg.value = img * (1 - fb);
    dotU.uLow.value = (pose.tz - ZH) / pose.s;
    dots.visible = img > 0.003 && fb < 1;
    const dark = Math.max(smooth(prog(img, 0, 0.5)), 0.55 * smooth(Math.max(cut, evs)));
    // standing in the row, the shell turns into the slide's warm orange glow under the image (the image blends by
    // maximum, so its hot organs still show above it), with a bright rim round its outline
    shellU.uSC.value.setRGB(lerp(lerp(0.36, 0.02, dark), 0.85, fb), lerp(lerp(0.45, 0.03, dark), 0.25, fb), lerp(lerp(0.58, 0.05, dark), 0.04, fb));
    shellU.uSA.value = lerp(0.45, 0.84, dark) * (1 - smooth(prog(vision, 0.04, 0.25))) + 0.9 * standA * fb;
    shellU.uSR.value = lerp(1 - 0.35 * dark, 1.2, fb);
    shellU.uRC.value.setRGB(lerp(0.5, 1.0, fb), lerp(0.7, 0.55, fb), lerp(0.95, 0.2, fb));
    shellD.visible = shellU.uSA.value > 0.003; shellR.visible = shellU.uSR.value * standA + (1 - fb) > 0.003;
    // the hottest source inside the ring's slice gives the featured events
    featSrc = -1;
    for (const k of SRC_BY_W) if (Math.abs(pose.tz - pose.s * SRC[k][0][1]) < ZH - 0.025) { featSrc = k; break; }
    // the web of lines
    const cap = Math.round(lin * WEB_N), head = Math.floor(t * WEB_RATE);
    webU.uHead.value = head; webU.uCap.value = cap; webU.uNow.value = t; webU.uPose.value.set(pose.ty, pose.tz, pose.s);
    webU.uLin.value = (0.022 + 0.05 * (1 - lin)) * (1 - smooth(prog(img, 0.05, 0.55))) * (1 - fs);
    web.visible = cap > 0 && webU.uLin.value > 0.001;
    if (web.visible) webStep(cap, head);
    // the animated events
    let nl = 0, np = 0, nb = 0;
    for (let k = 0; k < nLit; k++) CG[LIT[k]] = 0;
    const litBefore = nLit;
    nLit = 0;
    const fxA = (1 - smooth(prog(img, 0.1, 0.5))) * (1 - fs);
    if (evs > 0.001 && fxA > 0.002) featState(t); else featured.on = false;
    if (evs > 0.001 && fxA > 0.002) {
      // beyond the featured events, the share of events shown grows with the square of scan_events (a few at 0.3)
      const q = evs > 0.08 ? Math.pow((evs - 0.08) / 0.92, 2) : -1;
      const j0 = Math.floor((t - WIN) * EV_RATE), j1 = Math.floor(t * EV_RATE);
      for (let j = j0; j <= j1; j++) {
        const tj = (j + 0.8 * hk(j, 50)) / EV_RATE, age = t - tj;
        if (age < 0) continue;
        const feat = mod(j, FEAT) === 0, w = (feat ? clamp(evs * 30, 0, 1) : clamp((q - hk(j, 51)) * 8, 0, 1)) * fxA;
        if (w <= 0.002 || nl > FXL - 12 || np > FXP - 24) continue;
        if (!place(j)) continue;
        const V = EV.V, big = feat ? 1.5 : 1;
        // the positron's short zigzag, then the flash where it meets an electron
        if (age < TP + 0.3) {
          const f = clamp(age / TP, 0, 1) * 6, fa = w * (1 - clamp((age - TP) / 0.3, 0, 1));
          let x = EV.ex, y = EV.ey, z = EV.ez;
          for (let s = 0; s < 6 && s < f; s++) {
            const u = Math.min(1, f - s), nx = x + STEP[3 * s] * u, ny = y + STEP[3 * s + 1] * u, nz = z + STEP[3 * s + 2] * u;
            writeLine(nl++, x, y, z, nx, ny, nz, C_POS, 0.95 * fa);
            x = nx; y = ny; z = nz;
          }
          if (age < TP) writePoint(np++, x, y, z, C_POS, 0.022 * big, w);
        }
        if (age >= TP && age < TP + 0.32) { const x = (age - TP) / 0.32; writePoint(np++, EV.px, EV.py, EV.pz, C_FL, big * (0.03 + 0.04 * Math.sqrt(x)), w * (1 - x) * (1 - x)); }
        if (age < TP) continue;
        // the two photons, back to back at a visible speed (the featured ones slower, as comets)
        const run = (age - TP) * V;
        for (let e = 0; e < 2; e++) {
          const sg = e ? -1 : 1, lim = e ? EV.tB : EV.tA, dx = sg * EV.dx, dy = sg * EV.dy, dz = sg * EV.dz;
          if (run < lim) {
            if (feat) {
              for (let c = 0; c < 7; c++) {
                const r = run - c * 0.025;
                if (r < 0) break;
                writePoint(np++, EV.px + dx * r, EV.py + dy * r, EV.pz + dz * r, C_PH, 0.036 - 0.0042 * c, w * Math.pow(1 - c / 7, 1.3));
              }
            }
            const r0 = Math.max(0, run - 0.075);
            writeLine(nl++, EV.px + dx * r0, EV.py + dy * r0, EV.pz + dz * r0, EV.px + dx * run, EV.py + dy * run, EV.pz + dz * run, C_PH, w);
            if (!feat) writePoint(np++, EV.px + dx * run, EV.py + dy * run, EV.pz + dz * run, C_PH, 0.02, w);
          } else {
            // scintillation: the struck crystal glows, and a flash on its face (or on the bore's cover over it)
            const x = (run - lim) / (0.45 * V), F = e ? EV.FB : EV.FA;
            if (x < 1) {
              lightCrystal(e ? EV.iB : EV.iA, w * Math.pow(1 - x, 1.5) * (feat ? 1 : 0.75));
              writePoint(np++, F[0], F[1], F[2], C_CR, big * (0.024 + 0.024 * (1 - x)), w * Math.pow(1 - x, 1.5));
              if (x < 0.4) writePoint(np++, F[0], F[1], F[2], C_WH, 0.015 * big, w * (1 - x / 0.4));
            }
          }
        }
        // the coincidence: a line of response joins the two crystals, then fades (the web keeps it while lines stay);
        // a featured line stays faintly until the next featured one is drawn
        const tc = TP + Math.max(EV.tA, EV.tB) / V, lt = feat ? 2.05 : 1.8;
        if (age >= tc && age < tc + lt) {
          const x = age - tc, la = w * (feat ? 0.16 + 0.8 * Math.exp(-x * 2.6) : 0.1 + 0.5 * Math.exp(-x * 2.6)) * (1 - smooth((x - lt + 0.4) / 0.4));
          writeLine(nl++, EV.A[0], EV.A[1], EV.A[2], EV.B[0], EV.B[1], EV.B[2], C_LOR, la);
          if (feat && nb < 2) writeBeam(nb++, EV.A, EV.B, la * 1.1);
        }
      }
    }
    fxL.visible = nl > 0; fxP.visible = np > 0; beam.visible = nb > 0;
    fxG.setDrawRange(0, nl * 2); fxPG.setDrawRange(0, np); beamG.setDrawRange(0, nb * 6);
    send(fxG, nl * 2, FXL_AT); send(fxPG, np, FXP_AT); send(beamG, nb * 4, BEAM_AT);
    if (nLit || litBefore) cg.attributes.aG.needsUpdate = true;
    // the vision row fades in left to right
    const e = k => smooth(prog(vision, k, k + 0.2));
    SU.uE.value.set(e(0.12), e(0.36), e(0.62), 0);
    flowU.uGap.value.set(e(0.12), e(0.36), e(0.62)); flowU.uFlow.value = t;
    visG.visible = vision > 0.003;
    netU.uF.value = e(0.44); iconU.uF.value = e(0.48);
    neonU.uG.value.set(prog(vision, 0.7, 0.86), prog(vision, 0.74, 0.9), prog(vision, 0.78, 0.94), prog(vision, 0.8, 1.0));
  }
  const FXL_AT = { position: 3, aCol: 3, aA: 1 }, FXP_AT = { position: 3, aCol: 3, aSize: 1, aA: 1 }, BEAM_AT = { position: 3, aB: 3, aA: 1 };
  // upload only the part of a packed buffer that is drawn
  function send(geo, n, sz) {
    if (!n) return;
    for (const k in sz) { const at = geo.attributes[k]; at.updateRange.offset = 0; at.updateRange.count = n * sz[k]; at.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ exports --
  const anchors = {
    centre: () => sp([0, 0, 0]), bore: () => sp([0, 0, 0.8]), ring: () => sp([0, RC1 + 0.12, 0]), gantry: () => sp([0.62, 0.98, 0.55]),
    couch: () => sp([0.27, TOP - 0.03, tableZ + 1.95]), patient: () => pp([0, 0.32, 0.1]), head: () => pp([0, 0.76, 0.08]),
    tumour: () => pp(TUMOUR), event: () => (featured.on ? sp(featured.p) : sp([0, 0.1, 0])), lor: () => (featured.on ? sp(featured.lor) : sp([-0.36, -0.2, 0])),
    floor: () => sp([0, FLOOR, 0]), vision_scan: () => sp([-0.2, 1.12, 0.2]), vision_body: [VX.body - 0.15, 0.84, 0], vision_net: [VX.net - 0.3, 0.84, 0],
    vision_prog: [VX.prog - 0.55, 0.8, 0], vision_med: [VX.prog - 0.55, 0.0, 0],
  };
  const rowA = (S, k) => prog(S.scan_vision || 0, k, k + 0.15);
  const notRow = S => 1 - prog(S.scan_vision || 0, 0, 0.2);
  const evLab = S => notRow(S) * (1 - prog(S.scan_image || 0, 0, 0.3)) * (featured.on ? 1 : 0);
  return Object.assign(set, {
    params: { scan_a: 1, scan_bed: 0, scan_pass: 0, scan_cut: 0, scan_events: 0, scan_lines: 0, scan_image: 0, scan_vision: 0, scan_floor: 1 },
    floorY: FLOOR,
    update,
    anchors,
    labels: [
      { text: ['PET/CT scanner', ''], at: 'gantry', cls: 'cyn', alpha: S => notRow(S) * (1 - prog(S.scan_cut || 0, 0, 0.4)) * (1 - prog(S.scan_image || 0, 0, 0.3)) },
      { text: ['Detector ring', ''], at: 'ring', cls: 'cyn', alpha: S => notRow(S) * prog(S.scan_cut || 0, 0.6, 1) * (1 - prog(S.scan_image || 0, 0, 0.3)) },
      // the featured event's labels: the photons' brighter while they fly, the line's once a line has been drawn
      // (in the story each comes as the panel's text names it: the photons once the lines begin, the line of response
      // once they are under way; with the events on in explore, scan_events is 1 and both show at once)
      { text: ['Two gamma photons', '· 511 keV each'], at: 'event', cls: 'amb', alpha: S => evLab(S) * prog(S.scan_events || 0, 0.005, 0.04) * Math.max(prog(S.scan_lines || 0, 0.04, 0.06), prog(S.scan_events || 0, 0.9, 1)) * (1 - prog(S.scan_lines || 0, 0.45, 0.65)) * (0.45 + 0.55 * featured.env) },
      { text: ['Line of response', ''], at: 'lor', cls: 'amb', alpha: S => evLab(S) * featured.lorOn * prog(S.scan_events || 0, 0.01, 0.05) * Math.max(prog(S.scan_lines || 0, 0.41, 0.45), prog(S.scan_events || 0, 0.9, 1)) * (1 - prog(S.scan_lines || 0, 0.72, 0.9)) },
      { text: ['FDG', 'in the patient'], at: 'patient', cls: 'amb', alpha: S => notRow(S) * prog(S.scan_image || 0, 0.5, 0.9) },
      // (the row's names give way on narrow screens, where they covered the pictures: minor)
      { text: ['PET scan', ''], at: 'vision_scan', minor: true, alpha: S => rowA(S, 0.3) },
      { text: ['One body', ''], at: 'vision_body', minor: true, alpha: S => rowA(S, 0.4) },
      { text: ['One network', ''], at: 'vision_net', minor: true, alpha: S => rowA(S, 0.6) },
      { text: ['Prognosis', ''], at: 'vision_prog', minor: true, alpha: S => rowA(S, 0.74) },
      { text: ['Medication', ''], at: 'vision_med', minor: true, alpha: S => rowA(S, 0.8) },
    ],
    cam: {
      default: [34, 13, 7.2, 0, -0.25, 0.95], front: [0, 4, 6.4, 0, -0.1, 0.4], ring: [28, 22, 2.4, 0, -0.02, 0], side: [90, 6, 7.6, 0, -0.25, 0.9],
      inside: [0, 18, 1.1, 0, -0.08, -0.35], vision: [0, 3, 8.2, 0, -0.02, 0], life: [20, 12.4, 2.56, 0, 0, 0.8],
    },
    controls: [
      { key: 'view', label: 'View', options: [['scanner', 'Scanner'], ['ring', 'Ring'], ['inside', 'Inside'], ['vision', 'Vision']] },
      // (the vision row shows neither: when says which views they apply to)
      { key: 'events', label: 'Events', options: [['off', 'Off'], ['on', 'On']], when: c => c.view !== 'vision' },
      { key: 'image', label: 'Image', options: [['lines', 'Lines'], ['image', 'Image']], when: c => c.view !== 'vision' },
    ],
    // every view but Vision: the couch in with the chest in the ring (switching views never moves it); the housing
    // opens in Ring, and in Scanner while events or the image show (closed, it hid them)
    explore(c) {
      const row = c.view === 'vision', on = c.events === 'on' && !row, im = c.image === 'image' && !row;
      return {
        scan_bed: row ? 0 : 1, scan_pass: row ? 0 : 0.4, scan_cut: c.view === 'ring' || (c.view === 'scanner' && (on || im)) ? 1 : 0, scan_vision: row ? 1 : 0,
        scan_events: on ? 1 : 0, scan_lines: on && !im ? 1 : 0, scan_image: im ? 1 : 0,
      };
    },
    // for the engine: the latest featured event (a point in the set's frame) and whether events are showing
    api() { return { floorY: FLOOR, event: () => (featured.on ? anchors.event() : null), live }; },
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

// Organs, uptake and the network of the cohort (Geist et al., Med 2025). Drawn in the frame of the tour's PET body
// set (feet at y -0.95, faces +z, the person's left +x, its figure slimmed across by 0.9), so the two show together.
// A scan plane sweeps down and outlines 13 organs and the aorta as smooth shells (signed distance fields fitted to
// where the body set puts each organ, polygonised once by surface nets); each organ's uptake as a glowing bar; the
// bars collapse into one person's row and 658 rows stack into a slab; 658 stand-in people show what a partial
// correlation is; the organs' nodes rise onto a shallow dome in front of the body and the paper's networks draw on
// (blue positive, red negative, hubs orange-yellow), with the strength distribution and its exponential fit beside.
SETS.organs = function (K) {
  const { THREE, smooth, clamp, lerp, prog, v3 } = K;
  const set = K.newSet('organs');
  const D = PET_DATA, ORG = D.organs, NO = ORG.length, PI = Math.PI, SY = D.synth || {};
  const OI = {}; ORG.forEach((o, i) => { OI[o.id] = i; });
  const COL = ORG.map(o => K.rgb(o.col)), HUBC = K.rgb('#ffb020'), POSC = K.rgb('#4c7cff'), NEGC = K.rgb('#ff4d4d');
  const SHELLK = { fat: 0.5, marrow: 0.55, intestine: 0.85 };   // how strongly each shell glows (the wrapping band less)
  // the sweep names fat a little after the marrow (both start at L1: named together, their names would collide)
  const SEGO = ORG.map(o => ({ fat: 0.11 })[o.id] || 0);
  const XS = 0.9;   // the body set models its figure a little broad, then slims x by 0.9: the shells do the same
  const AORTA = OI.aorta === undefined ? -1 : OI.aorta;
  // a signed number for labels (no minus sign on a value that rounds to zero)
  const num = (x, d = 2) => { const s = Math.abs(x).toFixed(d); return (x < 0 && +s !== 0 ? '−' : '') + s; };
  const own = f => { const o = [0, 0, 0]; return () => f(o); };
  const set3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };

  // ================================================================ organ shells: signed distance fields
  // Everything here is in the body set's modelling coordinates (before x is slimmed); the vertices are slimmed after.
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  // an orthonormal frame whose first axis points along d (as the body set builds its organs' axes)
  function frame(d) {
    const u = v3.norm(d), ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const w = v3.norm(v3.cross(u, ref)), v = v3.cross(w, u);
    return [u, v, w];
  }
  const along = d => { const f = frame(d); return [f[1], f[0], f[2]]; };
  // an ellipsoid: centre c, radii r along axes ax (or x, y, z); a close bound of its distance (Quilez's)
  function ell(c, r, ax) {
    const r0 = r[0], r1 = r[1], r2 = r[2], mr = Math.min(r0, r1, r2);
    return (x, y, z) => {
      let a = x - c[0], b = y - c[1], d = z - c[2];
      if (ax) {
        const p = a, q = b, s = d;
        a = p * ax[0][0] + q * ax[0][1] + s * ax[0][2]; b = p * ax[1][0] + q * ax[1][1] + s * ax[1][2]; d = p * ax[2][0] + q * ax[2][1] + s * ax[2][2];
      }
      const u = a / r0, v = b / r1, w = d / r2, k0 = Math.sqrt(u * u + v * v + w * w);
      const u1 = u / r0, v1 = v / r1, w1 = w / r2, k1 = Math.sqrt(u1 * u1 + v1 * v1 + w1 * w1);
      return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -mr;
    };
  }
  // a tapered capsule from a to b (radii ra, rb), as in the body set
  const mkCone = (a, b, ra, rb) => { const d = v3.sub(b, a); return [a[0], a[1], a[2], d[0], d[1], d[2], 1 / (v3.dot(d, d) || 1e-9), ra, rb]; };
  function cone(x, y, z, c) {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    let h = (px * c[3] + py * c[4] + pz * c[5]) * c[6];
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = px - c[3] * h, dy = py - c[4] * h, dz = pz - c[5] * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (c[7] + (c[8] - c[7]) * h);
  }
  // the body set's trunk and thighs (to keep muscle and fat under the skin)
  const RINGS = [[-0.135, 0.145, 0.092, -0.012], [-0.08, 0.158, 0.104, -0.012], [-0.01, 0.160, 0.102, -0.002], [0.08, 0.142, 0.097, 0.008],
    [0.18, 0.140, 0.100, 0.010], [0.30, 0.153, 0.108, 0.006], [0.40, 0.160, 0.104, 0.0], [0.47, 0.150, 0.088, -0.010], [0.53, 0.090, 0.060, -0.016]];
  const fade3 = x => x * x * (3 - 2 * x);
  function ring(y, o = [0, 0, 0]) {   // the trunk's half width, half depth and middle at height y
    const T = RINGS, yy = clamp(y, T[0][0], T[T.length - 1][0]);
    let i = 0;
    while (i < T.length - 2 && yy > T[i + 1][0]) i++;
    const f = fade3((yy - T[i][0]) / (T[i + 1][0] - T[i][0]));
    for (let k = 0; k < 3; k++) o[k] = T[i][k + 1] + (T[i + 1][k + 1] - T[i][k + 1]) * f;
    return o;
  }
  function torso(x, y, z) {
    const T = RINGS, y0 = T[0][0], y1 = T[T.length - 1][0], [w, d, zc] = ring(y);
    const q = Math.sqrt((x / w) * (x / w) + ((z - zc) / d) * ((z - zc) / d)), e = (q - 1) * Math.min(w, d);
    const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
    return dy > 0 ? Math.hypot(Math.max(e, 0), dy) : e;
  }
  const HIP = [0.086, -0.07, 0.0], KNEE = [0.094, -0.47, 0.012];
  const THIGH = [1, -1].map(s => mkCone([HIP[0] * s, HIP[1], HIP[2]], [KNEE[0] * s, KNEE[1], KNEE[2]], 0.084, 0.049));
  const lower = (x, y, z) => smin(smin(torso(x, y, z), cone(x, y, z, THIGH[0]), 0.06), cone(x, y, z, THIGH[1]), 0.06);
  // the spine as the body set draws it; L1 to L5 are its vertebrae 20 to 24 (of 24, C1 to L5)
  const SPINE = new THREE.CatmullRomCurve3([[0, 0.63, -0.026], [0, 0.55, -0.026], [0, 0.48, -0.046], [0, 0.38, -0.066], [0, 0.27, -0.066],
    [0, 0.18, -0.052], [0, 0.08, -0.034], [0, 0.0, -0.04]].map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const LUMBAR = [19, 20, 21, 22, 23].map(v => {
    const s = (v + 0.5) / 24, c = SPINE.getPointAt(s);
    return { c: [c.x, c.y, c.z], r: 0.011 + 0.012 * s, h: 0.0085 + 0.006 * s };
  });
  const KID = s => ({ c: [0.072 * s, s > 0 ? 0.115 : 0.098, -0.066], ax: along([-0.24 * s, 1, 0.12]) });
  const IN = 0.004, inf = r => r.map(x => x + IN);   // shells sit a few millimetres outside each organ's glow
  const LV = { c: [0.042, 0.293, 0.052], r: [0.062, 0.041, 0.041], ax: frame([0.646, -0.57, 0.494]) };
  const RV = { c: [-0.004, 0.285, 0.074], r: [0.05, 0.036, 0.022], ax: frame([0.5, -0.6, 0.62]) };
  const LUNG = [[-0.088, 0.365, -0.01, 0.068, 0.135, 0.088], [0.09, 0.375, -0.016, 0.058, 0.125, 0.083]];
  const LIV = [{ c: [-0.082, 0.205, 0.012], r: [0.082, 0.088, 0.085], g: 0.5, o: -0.55 },
    { c: [0.005, 0.232, 0.035], r: [0.075, 0.042, 0.055], g: -0.5, o: -0.3 }];
  const SPL = { c: [0.12, 0.2, -0.056], r: [0.03, 0.056, 0.03], ax: along([0.35, 1, -0.2]) };
  const PANC = [[-0.036, 0.116, 0.02], [0.02, 0.135, -0.006], [0.07, 0.15, -0.026], [0.106, 0.166, -0.04]];
  const GLUT = s => ({ c: [0.078 * s, -0.112, -0.066], r: [0.062, 0.084, 0.04], ax: along([-0.3 * s, 1, 0.15]) });
  // Each shape: a list of [field, box low, box high, grid step] (several boxes for paired organs)
  const SHAPES = {
    brain: () => {
      const a = ell([0, 0.738, -0.008], inf([0.066, 0.06, 0.084])), b = ell([0, 0.668, -0.058], inf([0.05, 0.027, 0.032]));
      // the cerebellum below, and the cleft between the hemispheres on top
      const f = (x, y, z) => smin(a(x, y, z), b(x, y, z), 0.02) + 0.008 * Math.exp(-x * x / 0.00005) * smooth((y - 0.69) / 0.07);
      return [[f, [-0.085, 0.62, -0.105], [0.085, 0.815, 0.095], 0.0062]];
    },
    thyroid: () => {
      const L = ell([-0.017, 0.548, 0.042], [0.011, 0.021, 0.011]), R = ell([0.017, 0.548, 0.042], [0.011, 0.021, 0.011]);
      const I = mkCone([-0.014, 0.538, 0.05], [0.014, 0.538, 0.05], 0.006, 0.006);   // the isthmus in front of the windpipe
      return [[(x, y, z) => smin(Math.min(L(x, y, z), R(x, y, z)), cone(x, y, z, I), 0.008), [-0.037, 0.517, 0.022], [0.037, 0.578, 0.066], 0.003]];
    },
    lungs: () => {
      const hrt = ell(LV.c, LV.r.map(x => x + 0.012), LV.ax), L = LUNG.map(l => ell([l[0], l[1], l[2]], inf([l[3], l[4], l[5]])));
      // the heart makes its notch in the left lung
      return [[(x, y, z) => smax(Math.min(L[0](x, y, z), L[1](x, y, z)), -hrt(x, y, z), 0.02), [-0.172, 0.215, -0.112], [0.162, 0.515, 0.09], 0.0078]];
    },
    heart: () => {
      const lv = ell(LV.c, inf(LV.r), LV.ax), rv = ell(RV.c, inf(RV.r), RV.ax);
      const ra = ell([-0.036, 0.315, 0.03], inf([0.026, 0.03, 0.024])), la = ell([0.018, 0.335, -0.002], inf([0.026, 0.022, 0.02]));
      const f = (x, y, z) => smin(smin(lv(x, y, z), rv(x, y, z), 0.015), smin(ra(x, y, z), la(x, y, z), 0.012), 0.016);
      return [[f, [-0.078, 0.212, -0.035], [0.12, 0.372, 0.13], 0.0058]];
    },
    liver: () => {
      // the body set keeps a[1] >= o + g a[0] (a: the point in the ellipsoid's unit coordinates): a plane cut on each lobe
      const P = LIV.map(l => {
        const r = inf(l.r), E = ell(l.c, r), gx = l.g / l.r[0], gy = -1 / l.r[1], gl = Math.hypot(gx, gy);
        return (x, y, z) => smax(E(x, y, z), (l.o + gx * (x - l.c[0]) + gy * (y - l.c[1])) / gl - IN, 0.012);
      });
      return [[(x, y, z) => smin(P[0](x, y, z), P[1](x, y, z), 0.025), [-0.178, 0.104, -0.086], [0.092, 0.306, 0.108], 0.0072]];
    },
    spleen: () => [[ell(SPL.c, inf(SPL.r), SPL.ax), [0.058, 0.128, -0.122], [0.182, 0.272, 0.012], 0.0052]],
    kidneys: () => [1, -1].map(s => {
      const { c, ax } = KID(s), k = ell(c, inf([0.026, 0.052, 0.022]), ax), hc = [c[0] - 0.03 * s, c[1] - 0.004, c[2] + 0.004];
      // the hilum: the dent on the inner side where the vessels and the ureter leave
      return [(x, y, z) => smax(k(x, y, z), 0.013 - Math.sqrt((x - hc[0]) * (x - hc[0]) + (y - hc[1]) * (y - hc[1]) + (z - hc[2]) * (z - hc[2])), 0.008),
        [c[0] - 0.05, c[1] - 0.075, c[2] - 0.045], [c[0] + 0.05, c[1] + 0.075, c[2] + 0.045], 0.0052];
    }),
    adrenal: () => [1, -1].map(s => {
      const { c, ax } = KID(s), k = ell(c, [0.028, 0.054, 0.024], ax), top = v3.add(c, v3.mul(ax[1], 0.054));
      const cc = v3.add(top, [-0.006 * s, 0.004, 0.002]), a = ell(cc, [0.016, 0.011, 0.012], ax);
      // a cap on the kidney
      return [(x, y, z) => smax(a(x, y, z), -k(x, y, z), 0.004), v3.sub(cc, [0.03, 0.03, 0.03]), v3.add(cc, [0.03, 0.03, 0.03]), 0.0029];
    }),
    muscle: () => {
      const g = [1, -1].map(s => { const q = GLUT(s); return ell(q.c, q.r, q.ax); });
      return [[(x, y, z) => smax(Math.min(g[0](x, y, z), g[1](x, y, z)), lower(x, y, z) + 0.007, 0.012), [-0.168, -0.232, -0.13], [0.168, 0.0, 0.0], 0.0068]];
    },
  };
  // tubes, drums and a band: built directly (smooth unions add nothing to them)
  function mesh(P, N, I, oi) {
    const b = NV;
    for (let v = 0; v < P.length / 3; v++) vert(oi, P[3 * v], P[3 * v + 1], P[3 * v + 2], N[3 * v], N[3 * v + 1], N[3 * v + 2]);
    for (let q = 0; q < I.length; q += 3) tri(b + I[q], b + I[q + 1], b + I[q + 2]);
  }
  // a closed tube along a smooth curve (as the body set's), its radius rad(u) changing along it, the ends rounded
  function taper(pts, rad, n, m, oi) {
    const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal'), fr = c.computeFrenetFrames(n, false);
    const P = [], N = [], I = [], q = new THREE.Vector3(), rings = [];
    const ring = (p, t, nn, bn, r, ca, sa) => {   // a ring of radius r * ca, pushed sa * r along the tangent; normals tilt with it
      rings.push(P.length / 3);
      for (let j = 0; j <= m; j++) {
        const co = Math.cos(j / m * 2 * PI), si = Math.sin(j / m * 2 * PI);
        const d = [nn.x * co + bn.x * si, nn.y * co + bn.y * si, nn.z * co + bn.z * si];
        P.push(p.x + d[0] * r * ca + t.x * r * sa, p.y + d[1] * r * ca + t.y * r * sa, p.z + d[2] * r * ca + t.z * r * sa);
        N.push(d[0] * ca + t.x * sa, d[1] * ca + t.y * sa, d[2] * ca + t.z * sa);
      }
    };
    const cap = (i, sg, rev) => {   // quarter circles of rings from the tip (sg: which way it points) to the full ring, or back
      const p = c.getPointAt(i / n, q.clone()), r = rad(i / n), t = fr.tangents[i].clone().multiplyScalar(sg);
      for (let k = rev ? 1 : 4; rev ? k <= 4 : k >= 1; k += rev ? 1 : -1) {
        const a = k / 4 * PI / 2;
        ring(p, t, fr.normals[i], fr.binormals[i], r, Math.cos(a), Math.sin(a));
      }
    };
    cap(0, -1, false);
    for (let i = 0; i <= n; i++) ring(c.getPointAt(i / n, q.clone()), fr.tangents[i], fr.normals[i], fr.binormals[i], rad(i / n), 1, 0);
    cap(n, 1, true);
    for (let k = 0; k < rings.length - 1; k++) {
      for (let j = 0; j < m; j++) { const a = rings[k] + j, b = rings[k + 1] + j; I.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    mesh(P, N, I, oi);
  }
  const BUILD = {
    pancreas: oi => taper(PANC, u => 0.0195 - 0.0065 * u, 36, 14, oi),   // the head (by the duodenum) thicker than the tail (by the spleen)
    intestine: oi => {
      // the small intestine coiled exactly as the body set draws it (the same seeded walk), the colon framing it
      const pts = [], r = K.rng(5);
      let p = [0, 0.03, 0.03], dir = [1, 0, 0];
      for (let k = 0; k < 46; k++) {
        dir = v3.norm(v3.add(v3.mul(dir, 0.55), v3.add(K.unit(r), v3.mul(v3.sub([0, 0.02, 0.035], p), 6))));
        p = v3.add(p, v3.mul(dir, 0.026));
        pts.push([clamp(p[0], -0.085, 0.085), clamp(p[1], -0.05, 0.1), clamp(p[2], -0.02, 0.08)]);
      }
      const colon = [[-0.104, -0.065, 0.024], [-0.11, 0.04, 0.004], [-0.098, 0.13, 0.02], [-0.03, 0.104, 0.074], [0.04, 0.104, 0.074],
        [0.11, 0.152, 0.004], [0.116, 0.05, -0.012], [0.104, -0.04, 0.004], [0.06, -0.085, 0.034], [0.0, -0.08, -0.03], [0.0, -0.13, -0.064]];
      addGeo(K.tube(pts, 0.0128, 230, 8), oi);
      addGeo(K.tube(colon, 0.0215, 96, 10), oi);
    },
    aorta: oi => {
      // from the heart up over the arch and down the back to where it splits into the two iliac arteries
      addGeo(K.tube([[0.03, 0.31, 0.04], [0.015, 0.4, 0.035], [0.0, 0.43, 0.0], [0.016, 0.4, -0.04], [0.016, 0.25, -0.04], [0.01, 0.1, -0.022],
        [0.0, -0.01, -0.016]], 0.0115, 90, 10), oi);
      for (const s of [1, -1]) addGeo(K.tube([[0.0, -0.002, -0.016], [0.022 * s, -0.04, -0.004], [0.045 * s, -0.07, 0.01]], 0.0072, 14, 8), oi);
    },
    marrow: oi => {
      // the vertebral bodies L1 to L5 as rounded drums (the discs between them stay dark)
      for (const v of LUMBAR) {
        const R = v.r + 0.002, H = v.h + 0.0008, rr = Math.min(0.003, H * 0.6), pr = [new THREE.Vector2(0, -H)];
        for (let k = 0; k <= 4; k++) { const a = -PI / 2 + k / 4 * PI / 2; pr.push(new THREE.Vector2(R - rr + rr * Math.cos(a), -H + rr + rr * Math.sin(a))); }
        for (let k = 0; k <= 4; k++) { const a = k / 4 * PI / 2; pr.push(new THREE.Vector2(R - rr + rr * Math.cos(a), H - rr + rr * Math.sin(a))); }
        pr.push(new THREE.Vector2(0, H));
        addGeo(new THREE.LatheGeometry(pr, 28), oi, v.c, [1.15, 1, 1]);
      }
    },
    fat: oi => {
      // a band just under the skin of the belly, flanks and back, between L1 and L5: outer and inner surface, rims
      const ys = LUMBAR.map(v => v.c[1]), y0 = Math.min(...ys) - 0.016, y1 = Math.max(...ys) + 0.016, NY = 10, NT = 72, D0 = 0.005, D1 = 0.017;
      const P = [], N = [], I = [];
      const pt = (y, t, dep) => {
        const [w, d, zc] = ring(y), th = t / NT * 2 * PI, c = Math.cos(th), s = Math.sin(th), nl = Math.hypot(c / w, s / d), nx = c / w / nl, nz = s / d / nl;
        return [w * c - nx * dep, zc + d * s - nz * dep, nx, nz];
      };
      const grid = (rows, f) => {   // rows x (NT + 1) vertices from f(j, t) -> [x, y, z, nx, ny, nz]
        const b = P.length / 3;
        for (let j = 0; j <= rows; j++) for (let t = 0; t <= NT; t++) { const q = f(j, t); P.push(q[0], q[1], q[2]); N.push(q[3], q[4], q[5]); }
        for (let j = 0; j < rows; j++) for (let t = 0; t < NT; t++) { const a = b + j * (NT + 1) + t, c = a + NT + 1; I.push(a, c, a + 1, a + 1, c, c + 1); }
      };
      for (const [dep, sg] of [[D0, 1], [D1, -1]]) {
        grid(NY, (j, t) => { const y = lerp(y0, y1, j / NY), q = pt(y, t, dep); return [q[0], y, q[1], q[2] * sg, 0, q[3] * sg]; });
      }
      for (const [y, sg] of [[y0, -1], [y1, 1]]) grid(1, (j, t) => { const q = pt(y, t, j ? D1 : D0); return [q[0], y, q[1], 0, sg, 0]; });
      mesh(P, N, I, oi);
    },
  };
  // picking: rough ellipsoids per organ [centre, radii, axes] (modelling coordinates)
  const PICKS = {
    brain: [[[0, 0.73, -0.01], [0.07, 0.07, 0.09]]], thyroid: [[[0, 0.548, 0.045], [0.034, 0.024, 0.016]]],
    lungs: LUNG.map(l => [[l[0], l[1], l[2]], [l[3], l[4], l[5]]]), heart: [[LV.c, LV.r, LV.ax], [RV.c, RV.r, RV.ax]],
    liver: LIV.map(l => [l.c, l.r]), spleen: [[SPL.c, SPL.r, SPL.ax]], pancreas: [[[0.035, 0.14, -0.01], [0.085, 0.02, 0.02], frame([0.142, 0.05, -0.06])]],
    kidneys: [1, -1].map(s => [KID(s).c, [0.028, 0.054, 0.024], KID(s).ax]),
    adrenal: [1, -1].map(s => [v3.add(KID(s).c, v3.mul(KID(s).ax[1], 0.058)), [0.018, 0.013, 0.014]]),
    intestine: [[[0, 0.01, 0.03], [0.12, 0.13, 0.07]]], muscle: [1, -1].map(s => [GLUT(s).c, GLUT(s).r, GLUT(s).ax]),
    marrow: [[[0, 0.055, -0.04], [0.03, 0.065, 0.03]]], fat: [[[0, 0.055, 0.003], [0.162, 0.07, 0.106]]], aorta: [[[0.01, 0.2, -0.03], [0.022, 0.22, 0.03]]],
  };

  // ---------------------------------------------------------------- surface nets
  // Sample the field on a grid (blocks of 4 cells far from the surface are filled from their centre alone) and place
  // one vertex per cell the surface crosses; its normal is the field's gradient, from the grid (central differences at
  // the cell's corners, blended), so no extra evaluations are needed.
  // output buffers, grown as needed: positions, normals, colours, organ index; triangle indices
  let CAPV = 40000, CAPI = 240000, NV = 0, NI3 = 0;
  let SP = new Float32Array(CAPV * 3), SN = new Float32Array(CAPV * 3), SCL = new Float32Array(CAPV * 3), SO = new Float32Array(CAPV);
  let SI = new Uint32Array(CAPI);
  const grow = (a, n) => { const b = new a.constructor(n); b.set(a); return b; };
  const tri = (a, b, c) => { if (NI3 + 3 > CAPI) { CAPI *= 2; SI = grow(SI, CAPI); } SI[NI3++] = a; SI[NI3++] = b; SI[NI3++] = c; };
  const YR = ORG.map(() => [Infinity, -Infinity]);   // each shell's height range (for the sweep's labels)
  const EGF = new Int8Array([0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7]);
  function vert(oi, x, y, z, nx, ny, nz) {   // one vertex in modelling coordinates: slim it (and carry its normal)
    if (NV >= CAPV) { CAPV *= 2; SP = grow(SP, CAPV * 3); SN = grow(SN, CAPV * 3); SCL = grow(SCL, CAPV * 3); SO = grow(SO, CAPV); }
    const nX = nx / XS, nl = Math.sqrt(nX * nX + ny * ny + nz * nz) || 1, col = COL[oi], yr = YR[oi], q = 3 * NV, g = SHELLK[ORG[oi].id] || 1;
    SP[q] = x * XS; SP[q + 1] = y; SP[q + 2] = z; SN[q] = nX / nl; SN[q + 1] = ny / nl; SN[q + 2] = nz / nl;
    SCL[q] = col[0] * g; SCL[q + 1] = col[1] * g; SCL[q + 2] = col[2] * g; SO[NV] = oi;
    if (y < yr[0]) yr[0] = y;
    if (y > yr[1]) yr[1] = y;
    return NV++;
  }
  const JB = { until: Infinity }, late = () => performance.now() > JB.until;
  function* polygonise(f, lo, hi, h, oi) {
    const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1, sy = nz, sx = ny * nz;
    const F = new Float32Array(nx * ny * nz), done = new Uint8Array(nx * ny * nz);
    const B = 4, far = 1.8 * 0.87 * B * h;
    for (let I = 0; I < nx - 1; I += B) for (let J = 0; J < ny - 1; J += B) for (let L = 0; L < nz - 1; L += B) {
      if (L === 0 && late()) yield;
      const i1 = Math.min(I + B, nx - 1), j1 = Math.min(J + B, ny - 1), k1 = Math.min(L + B, nz - 1);
      const fc = f(lo[0] + (I + i1) * 0.5 * h, lo[1] + (J + j1) * 0.5 * h, lo[2] + (L + k1) * 0.5 * h), out = Math.abs(fc) > far;
      for (let i = I; i <= i1; i++) for (let j = J; j <= j1; j++) {
        const x = lo[0] + i * h, y = lo[1] + j * h;
        for (let k = L, q = i * sx + j * sy + L; k <= k1; k++, q++) {
          if (done[q]) continue;
          if (out) F[q] = fc; else { F[q] = f(x, y, lo[2] + k * h); done[q] = 1; }
        }
      }
    }
    const ny1 = ny - 1, nz1 = nz - 1, VI = new Int32Array((nx - 1) * ny1 * nz1).fill(-1), cy = nz1, cx = ny1 * nz1;
    const cv = new Float32Array(8), G = new Float32Array(24), OFF = [0, sx, sy, sx + sy, 1, sx + 1, sy + 1, sx + sy + 1];
    const at = (i, j, k) => F[(i < 0 ? 0 : i >= nx ? nx - 1 : i) * sx + (j < 0 ? 0 : j >= ny ? ny - 1 : j) * sy + (k < 0 ? 0 : k >= nz ? nz - 1 : k)];
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny1; j++) for (let k = 0; k < nz1; k++) {
      if (k === 0 && j === 0 && late()) yield;
      const q0 = i * sx + j * sy + k;
      let neg = 0;
      for (let c = 0; c < 8; c++) { const v = F[q0 + OFF[c]]; cv[c] = v; if (v < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let ux = 0, uy = 0, uz = 0, ne = 0;
      for (let e = 0; e < 24; e += 2) {
        const a = EGF[e], b = EGF[e + 1];
        if ((cv[a] < 0) === (cv[b] < 0)) continue;
        const t = cv[a] / (cv[a] - cv[b]);
        ux += (a & 1) + ((b & 1) - (a & 1)) * t; uy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t;
        uz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; ne++;
      }
      const u = ux / ne, v = uy / ne, w = uz / ne;
      let gx = 0, gy = 0, gz = 0;
      for (let c = 0; c < 8; c++) {
        const a = i + (c & 1), b = j + (c >> 1 & 1), d = k + (c >> 2 & 1), wt = (c & 1 ? u : 1 - u) * (c & 2 ? v : 1 - v) * (c & 4 ? w : 1 - w);
        gx += (at(a + 1, b, d) - at(a - 1, b, d)) * wt; gy += (at(a, b + 1, d) - at(a, b - 1, d)) * wt; gz += (at(a, b, d + 1) - at(a, b, d - 1)) * wt;
      }
      VI[i * cx + j * cy + k] = vert(oi, lo[0] + (i + u) * h, lo[1] + (j + v) * h, lo[2] + (k + w) * h, gx, gy, gz);
    }
    const quad = (a, b, c, d, flip) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      if (flip) { tri(a, c, b); tri(a, d, c); } else { tri(a, b, c); tri(a, c, d); }
    };
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny1; j++) for (let k = 0; k < nz1; k++) {
      if (k === 0 && j === 0 && late()) yield;
      const q = i * sx + j * sy + k, v0 = F[q] < 0, c = i * cx + j * cy + k;
      if (j > 0 && k > 0 && v0 !== F[q + sx] < 0) quad(VI[c - cy - 1], VI[c - 1], VI[c], VI[c - cy], !v0);
      if (i > 0 && k > 0 && v0 !== F[q + sy] < 0) quad(VI[c - cx - 1], VI[c - cx], VI[c], VI[c - 1], !v0);
      if (i > 0 && j > 0 && v0 !== F[q + 1] < 0) quad(VI[c - cx - cy], VI[c - cy], VI[c], VI[c - cx], !v0);
    }
  }
  // a ready-made geometry (tubes, lathes, bands) in modelling coordinates, optionally scaled per axis about a centre
  function addGeo(g, oi, c, sc) {
    const P = g.attributes.position.array, N = g.attributes.normal.array, base = NV, s = sc || [1, 1, 1], o = c || [0, 0, 0], n = P.length / 3;
    for (let v = 0; v < n; v++) {
      vert(oi, o[0] + P[3 * v] * s[0], o[1] + P[3 * v + 1] * s[1], o[2] + P[3 * v + 2] * s[2], N[3 * v] / s[0], N[3 * v + 1] / s[1], N[3 * v + 2] / s[2]);
    }
    const X = g.index ? g.index.array : null;
    if (X) for (let q = 0; q < X.length; q += 3) tri(base + X[q], base + X[q + 1], base + X[q + 2]);
    else for (let v = 0; v < n; v += 3) tri(base + v, base + v + 1, base + v + 2);
    g.dispose();
  }
  // The shells are a job: run in short slices between frames while the set is hidden (idle), in longer ones once it is
  // wanted (update), or at once (finish: the harness and tests). Load costs nothing; the shells show once built.
  const PER = {}, shellGeo = new THREE.BufferGeometry();
  let jobMs = 0;
  function* shellJob() {
    for (let oi = 0; oi < NO; oi++) {
      const o = ORG[oi];
      if (!SHAPES[o.id] && !BUILD[o.id]) continue;
      const v0 = NV;
      if (BUILD[o.id]) BUILD[o.id](oi);
      else for (const [f, lo, hi, h] of SHAPES[o.id]()) yield* polygonise(f, lo, hi, h, oi);
      PER[o.id] = NV - v0;
      yield;
    }
    shellGeo.setAttribute('position', new THREE.BufferAttribute(SP.slice(0, 3 * NV), 3));
    shellGeo.setAttribute('normal', new THREE.BufferAttribute(SN.slice(0, 3 * NV), 3));
    shellGeo.setAttribute('aCol', new THREE.BufferAttribute(SCL.slice(0, 3 * NV), 3));
    shellGeo.setAttribute('aOrg', new THREE.BufferAttribute(SO.slice(0, NV), 1));
    shellGeo.setIndex(new THREE.BufferAttribute(SI.slice(0, NI3), 1));
    shellGeo.computeBoundingSphere();
    SP = SN = SCL = SO = SI = null;   // the working buffers go
  }
  let job = shellJob(), builtAt = -Infinity;   // (when they were finished while on show: they fade in; else long ago)
  function jobStep(ms, shown) {
    if (!job) return;
    const t0 = performance.now();
    JB.until = t0 + ms;
    while (job && performance.now() <= JB.until) if (job.next().done) job = null;
    JB.until = Infinity;
    jobMs += performance.now() - t0;
    if (!job && shown) builtAt = performance.now();
  }

  // Drawn premultiplied: each shell adds its glow and also dims a little what lies behind it (its rim most), so the
  // outlines still read over the PET body's own bright glow (with plain additive blending they washed out there)
  const shellMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPlane: { value: 10 }, uCut: { value: 0 }, uK: { value: 1 }, uFoc: { value: new Array(NO).fill(0) }, uDim: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `
attribute vec3 aCol; attribute float aOrg;
uniform float uFoc[${NO}]; uniform float uDim;
varying vec3 vN, vW, vC; varying float vY, vK, vF;
void main() {
  float f = uFoc[int(aOrg + 0.5)];
  vF = f; vK = (1.0 + 1.6 * f) * (1.0 - 0.82 * uDim * (1.0 - f));
  vC = aCol; vY = position.y;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `
uniform float uA, uPlane, uCut, uK;
varying vec3 vN, vW, vC; varying float vY, vK, vF;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float ndv = dot(n, v); if (ndv < 0.0) { n = -n; ndv = -ndv; }
  float fr = pow(1.0 - ndv, 2.0);
  // scanned: everything above the plane (a focused organ always shows)
  float shown = max(smoothstep(uPlane - 0.002, uPlane + 0.012, vY), vF);
  float fresh = exp(-max(vY - uPlane, 0.0) / 0.05) * uCut * shown;
  float cut = (1.0 - smoothstep(0.0012, 0.0045, abs(vY - uPlane))) * uCut;
  float band = pow(abs(fract(vY * 70.0) * 2.0 - 1.0), 10.0);   // slices, as a segmentation mask is drawn
  float lit = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.4, 0.75, 0.55))), 0.0);
  vec3 col = vC * (0.3 + 1.3 * fr) * lit + vC * band * 0.35 + mix(vC, vec3(1.0), 0.4) * fresh * 0.5;
  float a = (0.07 + 0.5 * fr + 0.05 * band) * shown * vK * uK;
  gl_FragColor = vec4((col * a + mix(vC, vec3(1.0), 0.5) * cut * 1.4) * uA, min(0.8, a * 1.1) * uA);
}`,
  });
  set.mats.push(shellMat);
  const shells = new THREE.Mesh(shellGeo, shellMat);
  shells.visible = false;
  shells.renderOrder = 1;
  set.group.add(shells);

  // ---------------------------------------------------------------- the scan plane (segmentation)
  // a horizontal sheet that sweeps down from the head to the thighs; on it the body's outline at that height
  const PLW = 0.86, PLD = 0.54;
  const planeMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 0 }, uE: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
      uC: { value: new THREE.Color(...K.rgb('#46d9ff')) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
uniform float uA, uK; uniform vec4 uE[6]; uniform vec3 uC;
varying vec2 vP;
void main() {
  vec2 g = abs(fract(vP / 0.03) - 0.5);
  float grid = 1.0 - smoothstep(0.03, 0.07, min(g.x, g.y));
  vec2 e = vec2(${(PLW / 2).toFixed(3)}, ${(PLD / 2).toFixed(3)}) - abs(vP);
  float m = min(e.x, e.y), edge = 1.0 - smoothstep(0.0, 0.006, m), fall = smoothstep(0.0, 0.12, m);
  float o = 0.0, inside = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 E = uE[i];
    if (E.z > 0.0) {
      vec2 q = (vP - E.xy) / E.zw; float r = length(q);
      o = max(o, 1.0 - smoothstep(0.0015, 0.0045, abs(r - 1.0) * min(E.z, E.w)));
      inside = max(inside, 1.0 - smoothstep(0.9, 1.0, r));
    }
  }
  float a = (0.03 + 0.1 * grid * (1.0 - 0.6 * inside)) * fall + 0.75 * edge + 0.9 * o + 0.08 * inside;
  vec3 col = mix(uC, vec3(1.0), 0.45 * o);
  gl_FragColor = vec4(col, a * uK * uA);
}`,
  });
  set.mats.push(planeMat);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(PLW, PLD).rotateX(-PI / 2), planeMat);
  plane.renderOrder = 2;
  set.group.add(plane);
  // the body's cross-section at height y (set frame): trunk or head, thighs, arms -> ellipses [x, z, rx, rz]
  // (upper and lower arm on each side: ends, radii, and how steeply each rises: a cut across a slanted limb is longer)
  const ARMS = [];
  for (const s of [1, -1]) {
    for (const [a, b, ra, rb] of [[[0.172 * s, 0.468, -0.012], [0.33 * s, 0.79, -0.002], 0.048, 0.037],
      [[0.33 * s, 0.79, -0.002], [0.108 * s, 0.902, 0.026], 0.035, 0.024]]) ARMS.push({ a, b, ra, rb, cv: Math.max(Math.abs(v3.norm(v3.sub(b, a))[1]), 0.35) });
  }
  const SEC = { n: 0, out: null }, RG = [0, 0, 0];   // (runs every frame while the plane shows: nothing allocated)
  function secPut(x, z, rx, rz) { if (SEC.n < SEC.out.length) SEC.out[SEC.n++].set(x * XS, z, rx * XS, rz); }
  function section(y, out) {
    for (let k = 0; k < out.length; k++) out[k].set(0, 0, 0, 0);
    SEC.n = 0; SEC.out = out;
    if (y >= -0.115 && y <= 0.53) { ring(y, RG); secPut(0, RG[2], RG[0], RG[1]); }
    else if (y > 0.53 && y < 0.62) secPut(0, -0.01, 0.05, 0.048);
    if (y >= 0.6 && y < 0.823) { const k = Math.sqrt(Math.max(0, 1 - ((y - 0.712) / 0.112) ** 2)); if (k > 0.05) secPut(0, 0.002, 0.077 * k, 0.097 * k); }
    if (y < -0.105 && y > -0.47) {
      const t = (y - HIP[1]) / (KNEE[1] - HIP[1]), r = lerp(0.084, 0.049, t);
      for (let s = 1; s >= -1; s -= 2) secPut(lerp(HIP[0], KNEE[0], t) * s, lerp(HIP[2], KNEE[2], t), r, r);
    }
    for (const { a, b, ra, rb, cv } of ARMS) {
      if (y < Math.min(a[1], b[1]) || y > Math.max(a[1], b[1])) continue;
      const t = (y - a[1]) / (b[1] - a[1]), r = lerp(ra, rb, t);
      secPut(lerp(a[0], b[0], t), lerp(a[2], b[2], t), r / cv, r);
    }
  }

  // ---------------------------------------------------------------- layout beside and in front of the body
  const BAR = { x0: 0.4, xb: 0.448, k: 0.15, top: 0.8, dy: 0.083, z: 0.06, r: 0.02 };
  const F2 = SY.organs || (D.f2 && D.f2.organs) || [], NF = F2.length;
  const MAT = { x0: 0.47, cw: 0.06, y: 0.1, z0: 0.17, d0: 0.03, rd: 0.0016 };   // the slab: f2's columns, people going back
  const SCP = { x0: 0.46, y0: 0.24, s: 0.62, z: 0.2 };                          // the partial-correlation panel
  const CHT = { x0: 0.95, y0: -0.24, w: 0.68, h: 0.64, z: 0.3 };                   // the strength distribution
  const NETZ = 0.46, NETY = 0.27;
  // where each organ's node sits on the dome (x, y): near its organ's height, apart enough for labels on their right
  const LAY = { brain: [0, 0.85], thyroid: [0.3, 0.68], lungs: [-0.4, 0.56], heart: [0.17, 0.46], liver: [-0.52, 0.3], spleen: [0.5, 0.3],
    adrenal: [-0.23, 0.17], pancreas: [0.33, 0.13], kidneys: [-0.44, 0.03], marrow: [0.1, 0.01], fat: [0.5, -0.14], intestine: [-0.18, -0.16],
    muscle: [0.16, -0.32] };
  const domeZ = (x, y) => NETZ - 0.3 * (x * x + (y - NETY) * (y - NETY));

  // organ points: the anchor (the data's home point), and for leaders the left one of a pair (nearer the bars)
  const HOME = ORG.map(o => o.pos.slice());
  const PAIRED = { lungs: 1, kidneys: 1, adrenal: 1, muscle: 1 };
  const LEAD = ORG.map((o, i) => (PAIRED[o.id] ? [Math.abs(HOME[i][0]), HOME[i][1], HOME[i][2]] : HOME[i]));
  // bars: the organs from head to toe, the aorta (the unit) last
  const BORD = ORG.map((o, i) => i).filter(i => i !== AORTA).sort((a, b) => HOME[b][1] - HOME[a][1]);
  if (AORTA >= 0) BORD.push(AORTA);
  const BRANK = new Array(NO); BORD.forEach((i, r) => { BRANK[i] = r; });
  const barY = r => (r < NO - 1 || AORTA < 0 ? BAR.top - r * BAR.dy : BAR.top - (NO - 2) * BAR.dy - 0.115);
  const F2COL = ORG.map(o => F2.indexOf(o.id));   // the organ's column in the slab, or -1
  const cellX = c => MAT.x0 + (c + 0.5) * MAT.cw;

  // ---------------------------------------------------------------- uptake bars (neon tubes)
  const barGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false).rotateZ(-PI / 2).translate(0.5, 0, 0);
  barGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(NO * 3), 3));
  barGeo.setAttribute('aK', new THREE.InstancedBufferAttribute(new Float32Array(NO), 1));
  const tubeFrag = `
uniform float uA;
varying vec3 vN, vW, vC; varying float vK, vX;
void main() {
  if (vK < 0.003) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float c = abs(dot(n, v));
  vec3 col = vC * (0.45 + 0.85 * c) + vec3(1.0) * 0.45 * pow(c, 6.0) * (0.5 + 0.5 * vX);
  gl_FragColor = vec4(col, (0.45 + 0.55 * c) * vK * uA);
}`;
  const barMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aCol; attribute float aK;
varying vec3 vN, vW, vC; varying float vK, vX;
void main() {
  vC = aCol; vK = aK; vX = position.x;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: tubeFrag,
  });
  set.mats.push(barMat);
  const bars = new THREE.InstancedMesh(barGeo, barMat, NO);
  bars.frustumCulled = false; bars.renderOrder = 3;
  set.group.add(bars);

  // ---------------------------------------------------------------- the cohort slab: 658 people x the organs of Figure 2A
  const ROWS = SY.rows || [], NR = ROWS.length;
  const cellGeo = new THREE.InstancedBufferGeometry();
  {
    const bx = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    cellGeo.setIndex(bx.index); cellGeo.setAttribute('position', bx.attributes.position); cellGeo.setAttribute('normal', bx.attributes.normal);
    const a = new Float32Array(NR * NF * 3);
    let n = 0;
    for (let r = 0; r < NR; r++) for (let c = 0; c < NF; c++) { a[n++] = r; a[n++] = c; a[n++] = ROWS[r][c]; }
    cellGeo.setAttribute('aI', new THREE.InstancedBufferAttribute(a, 3));
    cellGeo.instanceCount = NR * NF;
  }
  const cellMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uRow0: { value: 0 }, uRows: { value: 0 }, uK: { value: 1 } },
    transparent: true, depthWrite: true,
    vertexShader: `
attribute vec3 aI;
uniform float uRow0, uRows;
varying vec3 vC; varying float vL, vS;
vec3 hot(float x) { return clamp(vec3(x * 2.4 - 0.05, x * 2.2 - 0.85, x * 3.0 - 2.1), 0.0, 1.0); }
void main() {
  float r = aI.x, c = aI.y, val = aI.z;
  // the first row (one person) forms from the bars; the others stack behind it, front to back
  float app = r < 0.5 ? uRow0 : clamp((uRows - (0.36 + 0.56 * r / ${Math.max(1, NR - 1)}.0)) / 0.06, 0.0, 1.0);
  app = app * app * (3.0 - 2.0 * app);
  vS = app;
  float h = (0.005 + 0.042 * val / 2.8) * (r < 0.5 ? 1.25 : 1.0);
  float d = r < 0.5 ? ${MAT.d0.toFixed(4)} : ${(MAT.rd * 0.92).toFixed(5)};
  float z = r < 0.5 ? ${MAT.z0.toFixed(4)} : ${(MAT.z0 - MAT.d0 / 2 - 0.006).toFixed(4)} - (r - 0.5) * ${MAT.rd.toFixed(5)};
  vec3 p = vec3(${MAT.x0.toFixed(4)} + (c + 0.5) * ${MAT.cw.toFixed(4)}, ${MAT.y.toFixed(4)} + (1.0 - app) * 0.07, z)
    + position * vec3(${(MAT.cw * 0.84).toFixed(4)}, h * app, d);
  vC = max(hot(clamp(val / 2.6, 0.0, 1.0)), vec3(0.16, 0.02, 0.03)) * (r < 0.5 ? 1.15 : 1.0);
  vL = normal.y > 0.5 ? 1.0 : normal.z > 0.5 ? 0.62 : 0.42;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: `
uniform float uA, uK;
varying vec3 vC; varying float vL, vS;
void main() { if (vS < 0.01) discard; gl_FragColor = vec4(vC * vL, vS * uA * uK); }`,
  });
  set.mats.push(cellMat);
  const cells = new THREE.Mesh(cellGeo, cellMat);
  cells.frustumCulled = false;
  set.group.add(cells);

  // ---------------------------------------------------------------- the partial-correlation explainer
  // The data's pairs (direct links of Figure 2A), then one more found here in the stand-in cohort, unless the data has
  // one: the pair with no link in Figure 2A whose plain correlation is largest while its partial correlation is about 0
  // (a link that only passes through other organs, which the partial correlation drops)
  const PAIRS = (SY.pairs || []).filter(p => p && p.xy && p.xy.length >= 4 * NR).slice(0, 4);
  function solve(A, y) {   // A x = y by Gaussian elimination (A is m x m, small; copies are made)
    const m = y.length, M = A.map((r, i) => [...r, y[i]]);
    for (let c = 0; c < m; c++) {
      let p = c;
      for (let r = c + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      const t = M[c]; M[c] = M[p]; M[p] = t;
      const d = M[c][c] || 1e-12;
      for (let r = 0; r < m; r++) if (r !== c) { const f = M[r][c] / d; if (f) for (let j = c; j <= m; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map((r, i) => r[m] / (r[i] || 1e-12));
  }
  function indirectPair() {
    const C = SY.cor, Pc = SY.pcor, full = (D.nets || []).find(x => x.id === 'full');
    if (!C || !Pc || NR < 20 || NF < 4 || PAIRS.some(p => p.paper === null || Math.abs(p.pr) < 0.05)) return null;
    const key = (a, b) => (a < b ? a + ' ' + b : b + ' ' + a), linked = new Set(((full && full.edges) || []).map(e => key(e[0], e[1])));
    let best = null, bc = 0.15;   // (a plain correlation too weak to see is no use here)
    for (let i = 0; i < NF; i++) for (let j = i + 1; j < NF; j++) {
      if (linked.has(key(F2[i], F2[j])) || !C[i] || !Pc[i] || Math.abs(Pc[i][j]) >= 0.05 || Math.abs(C[i][j]) <= bc) continue;
      best = [i, j]; bc = Math.abs(C[i][j]);
    }
    if (!best) return null;
    // the residuals of each after regressing it on the other organs (least squares, with an intercept)
    const [ia, ib] = best, oth = F2.map((_, k) => k).filter(k => k !== ia && k !== ib), m = oth.length + 1;
    const XtX = Array.from({ length: m }, () => new Array(m).fill(0)), Ya = new Array(m).fill(0), Yb = new Array(m).fill(0), x = new Array(m);
    for (const row of ROWS) {
      x[0] = 1; for (let q = 1; q < m; q++) x[q] = row[oth[q - 1]];
      for (let p = 0; p < m; p++) { Ya[p] += x[p] * row[ia]; Yb[p] += x[p] * row[ib]; for (let q = 0; q < m; q++) XtX[p][q] += x[p] * x[q]; }
    }
    const ba = solve(XtX, Ya), bb = solve(XtX, Yb), xy = new Float32Array(4 * NR);
    let sxy = 0, sxx = 0, syy = 0;
    ROWS.forEach((row, r) => {
      let fa = ba[0], fb = bb[0];
      for (let q = 1; q < m; q++) { fa += ba[q] * row[oth[q - 1]]; fb += bb[q] * row[oth[q - 1]]; }
      const ra = row[ia] - fa, rb = row[ib] - fb;   // (with an intercept, the residuals' means are 0)
      xy[4 * r] = row[ia]; xy[4 * r + 1] = row[ib]; xy[4 * r + 2] = ra; xy[4 * r + 3] = rb;
      sxy += ra * rb; sxx += ra * ra; syy += rb * rb;
    });
    const r2 = x => Math.round(x * 100) / 100 || 0;   // (two decimals, as the data's pairs; never -0)
    return { a: F2[ia], b: F2[ib], r: r2(C[ia][ib]), pr: r2(sxy / Math.sqrt(sxx * syy || 1)), paper: null, xy, indirect: true };
  }
  { const q = indirectPair(); if (q) PAIRS.push(q); }
  const NPR = PAIRS.length, PSH = PAIRS.map(() => [1, 1]);   // per pair: how much of each organ's spread is left
  const dotGeo = K.pointsGeo(NR);
  {
    const P = dotGeo.attributes.position.array, Cc = dotGeo.attributes.aCol.array, Sz = dotGeo.attributes.aSize.array;
    const tint = K.rgb('#d6ecff');
    const pa = [0, 1, 2, 3, 4].map(() => new Float32Array(NR * 4));
    PAIRS.forEach((p, k) => {
      // each axis in standard units, so the fitted line's slope is the correlation itself
      const st = [0, 1, 2, 3].map(j => {
        let m = 0, s = 0;
        for (let r = 0; r < NR; r++) m += p.xy[4 * r + j];
        m /= NR;
        for (let r = 0; r < NR; r++) s += (p.xy[4 * r + j] - m) ** 2;
        return [m, Math.sqrt(s / NR) || 1];
      });
      for (let r = 0; r < NR; r++) for (let j = 0; j < 4; j++) pa[k][4 * r + j] = (p.xy[4 * r + j] - st[j][0]) / st[j][1];
      PSH[k] = [Math.min(1, st[2][1] / st[0][1]), Math.min(1, st[3][1] / st[1][1])];
    });
    for (let r = 0; r < NR; r++) { P[3 * r + 2] = MAT.z0 - MAT.d0 / 2 - 0.006 - (r - 0.5) * MAT.rd; P[3 * r] = r; Cc.set(tint, 3 * r); Sz[r] = 0.0115; }
    pa.forEach((a, k) => dotGeo.setAttribute('aP' + k, new THREE.BufferAttribute(a, 4)));
  }
  // The dots: raw values (standard units); then what the other organs explain is taken out, so the cloud shrinks to
  // the residuals (uP1); then the residuals are scaled to standard units again, so the line's slope is the partial r (uP2)
  const dotMat = K.points(set, {
    uniforms: { uW: { value: new THREE.Vector4() }, uW4: { value: 0 }, uSh: { value: new THREE.Vector2(1, 1) }, uP1: { value: 0 }, uP2: { value: 0 },
      uRise: { value: 0 }, uSX: { value: 0.7 }, uK: { value: 0 } },
    head: 'attribute vec4 aP0, aP1, aP2, aP3, aP4; uniform vec4 uW; uniform vec2 uSh; uniform float uW4, uP1, uP2, uRise, uSX, uK;',
    vertex: `
  vec4 P = aP0 * uW.x + aP1 * uW.y + aP2 * uW.z + aP3 * uW.w + aP4 * uW4;
  vec2 q = mix(mix(P.xy, P.zw * uSh, uP1), P.zw, uP2);
  vec2 uv = clamp(0.5 + q / 6.4, 0.015, 0.985);
  vec3 e = vec3(${SCP.x0.toFixed(3)} + uv.x * ${SCP.s.toFixed(3)}, ${SCP.y0.toFixed(3)} + uv.y * ${SCP.s.toFixed(3)}, ${(SCP.z + 0.012).toFixed(3)});
  float k = clamp((uRise - position.x / ${Math.max(1, NR - 1)}.0 * 0.5) / 0.5, 0.0, 1.0); k = k * k * (3.0 - 2.0 * k);
  vec3 s = vec3(uSX, ${(MAT.y + 0.04).toFixed(3)}, position.z);
  vec3 p = mix(s, e, k) + vec3(0.0, 0.16, 0.1) * sin(3.14159 * k);
  mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);
  vA *= uK * (0.2 + 0.8 * k);`,
  });
  const dots = new THREE.Points(dotGeo, dotMat);
  dots.frustumCulled = false; dots.renderOrder = 4;
  set.group.add(dots);
  // backdrops of the panel and the chart (dark glass, so what is behind does not clutter them)
  const backMat = new THREE.MeshBasicMaterial({ color: 0x050b16, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const backMat2 = backMat.clone();
  const scBack = new THREE.Mesh(new THREE.PlaneGeometry(SCP.s + 0.05, SCP.s + 0.05).translate(SCP.x0 + SCP.s / 2, SCP.y0 + SCP.s / 2, SCP.z - 0.004),
    backMat);
  // (the chart's icons sit in two staggered rows under it)
  const chBack = new THREE.Mesh(new THREE.PlaneGeometry(CHT.w + 0.08, CHT.h + 0.24).translate(CHT.x0 + CHT.w / 2, CHT.y0 + CHT.h / 2 - 0.07, CHT.z - 0.012),
    backMat2);
  scBack.renderOrder = chBack.renderOrder = 2;
  set.group.add(scBack, chBack);
  // the fitted line (its slope is r, then the partial r): blue positive, red negative, as the network's links; pale near 0
  const fitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const fitLine = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 1, 8, 1).rotateZ(-PI / 2), fitMat);
  fitLine.renderOrder = 5;
  set.group.add(fitLine);

  // ---------------------------------------------------------------- the networks
  // the eleven of the story and the controls, then extras the explore tabs may show: the vena cava and the three doses
  const NET_IDS = ['full', 'FDG_healthy', 'A_low', 'A_high', 'B_low', 'B_high', 'C_low', 'C_mid', 'C_high', 'HK2', 'GLUT',
    'vena', 'dose_standard', 'dose_ultralow', 'dose_virtual'];
  const netOf = id => (D.nets || []).find(x => x.id === id) || null;
  // (Figure 4's FDG network has only the organs GTEx has too: it is not the healthy network of Table 2)
  const FDGN = ((netOf('FDG_healthy') || {}).organs || []).length;
  const NET_SHORT = ['All scans', FDGN ? `FDG, ${FDGN} organs` : 'FDG', 'BMI low', 'BMI high', 'Tumour low', 'Tumour high', 'CRP low',
    'CRP mid', 'CRP high', 'HK2', 'GLUT', 'Vena cava', 'Standard dose', 'Ultra-low dose', 'Virtual dose'];
  const NET_TITLE = { full: 'All {n} scans', vena: 'All {n} scans', FDG_healthy: 'FDG, {k} organs', A_low: 'Healthy, lower BMI',
    A_high: 'Healthy, higher BMI', B_low: 'Low tumour load', B_high: 'High tumour load', C_low: 'Inflammation, lowest third',
    C_mid: 'Inflammation, middle third', C_high: 'Inflammation, highest third', HK2: 'Hexokinase 2', GLUT: 'GLUT1 to 4',
    dose_standard: 'Standard dose', dose_ultralow: 'Ultra-low dose', dose_virtual: 'Virtual ultra-low dose' };
  const NET_SUB = { full: 'normalised to the aorta', vena: 'normalised to the vena cava', FDG_healthy: 'Figure 4 · {n} scans of healthy volunteers',
    B_low: 'tumour uptake below the median', B_high: 'tumour uptake above the median',
    HK2: 'tissue of {n} people (GTEx)', GLUT: 'tissue of {n} people (GTEx)', dose_standard: '{n} people · Figure 2B, read off',
    dose_ultralow: '{n} people · Figure 2B, read off', dose_virtual: '{n} people · Figure 2B, read off' };
  const NN = ORG.map((o, i) => i).filter(i => LAY[ORG[i].id]);   // the organs that can be nodes (not the aorta)
  const NPOS = ORG.map(o => { const l = LAY[o.id]; return l ? [l[0], l[1], domeZ(l[0], l[1])] : null; });
  const RORD = NN.slice().sort((a, b) => HOME[b][1] - HOME[a][1]), RRANK = new Array(NO).fill(0);
  RORD.forEach((i, r) => { RRANK[i] = r; });
  const LINKS = [], LIDX = new Map();
  for (let a = 0; a < NN.length; a++) {
    for (let b = a + 1; b < NN.length; b++) {
      LIDX.set(NN[a] * NO + NN[b], LINKS.length); LIDX.set(NN[b] * NO + NN[a], LINKS.length); LINKS.push([NN[a], NN[b]]);
    }
  }
  const NL = LINKS.length;
  // the paper's measures (as the data generator computes them), for networks the data gives without them
  function measures(ids, edges) {
    const s = {}; ids.forEach(i => { s[i] = 0; });
    for (const [a, b, w] of edges) { if (a in s) s[a] += Math.abs(w); if (b in s) s[b] += Math.abs(w); }
    const v = ids.map(i => s[i]).sort((x, y) => y - x), N = ids.length || 1;
    let best = [Infinity, 0, 0];
    for (let b = 0; b <= 2; b += 0.002) {
      let nu = 0, de = 0;
      v.forEach((y, x) => { const e = Math.exp(-b * x); nu += y * e; de += e * e; });
      const a = nu / (de || 1), err = v.reduce((q, y, x) => q + (y - a * Math.exp(-b * x)) ** 2, 0);
      if (err < best[0]) best = [err, b, a];
    }
    return { density: v.reduce((x, y) => x + y, 0) / (N * (N - 1) || 1), disorder: best[1], fitA: best[2], strength: s };
  }
  // the disorder of each group as printed in Table 2, for networks whose own record lacks it
  const T2 = { full: ['Blood pool', 'aorta', 0], vena: ['Blood pool', 'vena', 1], A_low: ['BMI', 'healthy', 0], A_high: ['BMI', 'healthy', 1],
    B_low: ['Tumour load', '', 0], B_high: ['Tumour load', '', 1], C_low: ['CRP', 'thirds', 0], C_mid: ['CRP', 'thirds', 1], C_high: ['CRP', 'thirds', 2],
    dose_standard: ['Dose', '', 0], dose_ultralow: ['Dose', '', 1], dose_virtual: ['Dose', '', 2] };
  const t2g = id => {
    const q = T2[id];
    if (!q) return null;
    const r = (D.table2 || []).find(x => x.what === q[0] && (x.cohort + ' ' + (x.groups || []).map(g => g.label).join(' ')).indexOf(q[1]) >= 0);
    return (r && r.groups && r.groups[q[2]]) || null;
  };
  const NETS = NET_IDS.map((id, k) => {
    const n = netOf(id);
    const ids = n && n.organs && n.organs.length ? n.organs.filter(o => OI[o] !== undefined && LAY[o]) : NN.map(i => ORG[i].id);
    const edges = n ? (n.edges || []).filter(e => OI[e[0]] !== undefined && OI[e[1]] !== undefined && LIDX.has(OI[e[0]] * NO + OI[e[1]])) : [];
    const cmp = n && n.computed && n.computed.strength ? n.computed : edges.length ? measures(ids, edges) : { strength: {}, fitA: 0, disorder: 0 };
    const W = new Float32Array(NL), pres = new Float32Array(NO), str = new Float32Array(NO), hub = new Float32Array(NO);
    for (const [a, b, w] of edges) W[LIDX.get(OI[a] * NO + OI[b])] = w;
    for (const o of ids) { pres[OI[o]] = 1; str[OI[o]] = (cmp.strength && cmp.strength[o]) || 0; }
    // hubs: only those the paper colours (none in the network of all scans); never computed ones
    for (const o of (n && edges.length ? n.hubs || [] : [])) if (OI[o] !== undefined && pres[OI[o]]) hub[OI[o]] = 1;
    // sorted strengths (for the chart) and which nodes carry a label: hubs, then the strongest, eight at most
    const order = ids.map(o => OI[o]).sort((a, b) => str[b] - str[a] || RRANK[a] - RRANK[b]), rank = new Float32Array(NO).fill(-1);
    order.forEach((i, r) => { rank[i] = r; });
    const lab = new Float32Array(NO);
    let nl = 0;
    for (const i of order) if (hub[i] && nl < 8) { lab[i] = 1; nl++; }
    for (const i of order) if (!lab[i] && nl < 6 && (str[i] > 0 || !edges.length)) { lab[i] = 1; nl++; }
    // the disorder as printed; the chart's curve decays at that rate (its height fitted to the bars), so the curve and
    // its label agree. Networks with nothing printed (Figure 4's) get the curve fitted to their bars, without a number.
    const g2 = t2g(id), dis = n && typeof n.disorder === 'number' ? n.disorder : g2 && typeof g2.disorder === 'number' ? g2.disorder : null;
    let A = cmp.fitA || 0, b = cmp.disorder || 0;
    if (dis !== null && edges.length) {
      let nu = 0, de = 0;
      order.forEach((i, r) => { const e = Math.exp(-dis * r); nu += str[i] * e; de += e * e; });
      A = nu / (de || 1); b = dis;
    }
    const fill = t => t.replace('{n}', n && n.n ? n.n : '').replace('{k}', ids.length);
    const title = fill(NET_TITLE[id] || (n && n.title) || NET_SHORT[k]);
    const sub = NET_SUB[id] ? fill(NET_SUB[id]) : /^C_/.test(id) && g2 ? `CRP ${g2.label}` : g2 ? g2.label : n && n.n ? `${n.n} people` : '';
    return { id, n, has: !!(n && edges.length), W, pres, str, hub, order, rank, lab, N: ids.length, A, b, title, sub,
      density: n && n.density !== undefined ? n.density : null, disorder: dis !== null && edges.length ? num(dis) : null };
  });
  const NNET = NETS.length;
  let SMAX = 2;
  for (const q of NETS) for (const i of NN) SMAX = Math.max(SMAX, q.str[i]);
  SMAX = Math.ceil(SMAX * 2) / 2;
  // The networks on show: organs_prev crossfades to organs_which by organs_mix, and a fractional organs_which itself
  // crossfades its two neighbours, so up to three networks with weights. A pure function of the params (labels ask too).
  const NWI = [0, 0, 0], NWW = [1, 0, 0];
  function netMix(S) {
    const which = clamp(S.organs_which || 0, 0, NNET - 1), lo = Math.floor(which), hi = Math.min(NNET - 1, lo + 1), f = which - lo;
    const m = S.organs_mix === undefined ? 1 : clamp(S.organs_mix, 0, 1);
    NWI[0] = clamp(Math.round(S.organs_prev || 0), 0, NNET - 1); NWW[0] = 1 - m;
    NWI[1] = lo; NWW[1] = m * (1 - f); NWI[2] = hi; NWW[2] = m * f;
  }
  const netW = (S, k) => { netMix(S); return (NWI[0] === k ? NWW[0] : 0) + (NWI[1] === k ? NWW[1] : 0) + (NWI[2] === k ? NWW[2] : 0); };
  const bl = (key, i) => NETS[NWI[0]][key][i] * NWW[0] + NETS[NWI[1]][key][i] * NWW[1] + NETS[NWI[2]][key][i] * NWW[2];

  // links: one tube per possible pair, drawn as an arc bowing out towards you; width and weight set per frame
  const TS = 22, TR = 6;
  const linkGeo = new THREE.BufferGeometry();
  {
    const nv = NL * (TS + 1) * (TR + 1), C = new Float32Array(nv * 3), Nr = new Float32Array(nv * 3), T = new Float32Array(nv), Li = new Float32Array(nv);
    const idx = [];
    let v = 0;
    LINKS.forEach(([a, b], l) => {
      const A = NPOS[a], Bp = NPOS[b], len = v3.dist(A, Bp), M = v3.lerp(A, Bp, 0.5), side = v3.norm([-(Bp[1] - A[1]), Bp[0] - A[0], 0]);
      const Cp = v3.add(M, v3.add([0, 0, 0.05 + 0.1 * len], v3.mul(side, 0.025 * len)));
      const v0 = v;
      for (let s = 0; s <= TS; s++) {
        const u = s / TS, w = 1 - u, p = [0, 1, 2].map(i => w * w * A[i] + 2 * u * w * Cp[i] + u * u * Bp[i]);
        const t = v3.norm([0, 1, 2].map(i => 2 * w * (Cp[i] - A[i]) + 2 * u * (Bp[i] - Cp[i])));
        let n1 = v3.cross(t, [0, 0, 1]); if (v3.len(n1) < 1e-4) n1 = [1, 0, 0]; n1 = v3.norm(n1);
        const n2 = v3.norm(v3.cross(t, n1));
        for (let q = 0; q <= TR; q++) {
          const th = q / TR * 2 * PI, d = v3.add(v3.mul(n1, Math.cos(th)), v3.mul(n2, Math.sin(th)));
          C.set(p, 3 * v); Nr.set(d, 3 * v); T[v] = u; Li[v] = l; v++;
        }
      }
      for (let s = 0; s < TS; s++) for (let q = 0; q < TR; q++) {
        const a0 = v0 + s * (TR + 1) + q, b0 = a0 + TR + 1;
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
    });
    linkGeo.setAttribute('position', new THREE.BufferAttribute(C, 3));
    linkGeo.setAttribute('aNrm', new THREE.BufferAttribute(Nr, 3));
    linkGeo.setAttribute('aT', new THREE.BufferAttribute(T, 1));
    linkGeo.setAttribute('aL', new THREE.BufferAttribute(Li, 1));
    linkGeo.setIndex(idx);
  }
  const UL = Array.from({ length: NL }, () => new THREE.Vector4());
  const linkMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uL: { value: UL }, uPos: { value: new THREE.Color(...POSC) }, uNeg: { value: new THREE.Color(...NEGC) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aNrm; attribute float aT, aL;
uniform vec4 uL[${NL}];
varying vec3 vN, vW; varying float vS, vB;
void main() {
  vec4 L = uL[int(aL + 0.5)];
  float w = abs(L.x), t = L.w > 0.5 ? 1.0 - aT : aT;
  // drawn on from the organ that appears first; the growing end tapers
  float on = step(t, L.y + 0.0001), tip = L.y > 0.999 ? 1.0 : smoothstep(L.y, L.y - 0.15, t);
  float r = (0.0022 + 0.012 * w) * smoothstep(0.0, 0.04, w) * on * mix(0.3, 1.0, tip);
  vS = L.x; vB = L.z * on;
  vN = normalize(mat3(modelMatrix) * aNrm);
  vec4 wp = modelMatrix * vec4(position + aNrm * r, 1.0); vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `
uniform float uA; uniform vec3 uPos, uNeg;
varying vec3 vN, vW; varying float vS, vB;
void main() {
  if (vB < 0.003) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float c = abs(dot(n, v)), w = abs(vS);
  vec3 col = (vS > 0.0 ? uPos : uNeg) * (0.5 + 0.8 * c) + vec3(1.0) * 0.12 * pow(c, 6.0) * smoothstep(0.2, 0.6, w);
  gl_FragColor = vec4(col, (0.22 + 0.68 * smoothstep(0.05, 0.5, w)) * (0.35 + 0.65 * c) * vB * uA);
}`,
  });
  set.mats.push(linkMat);
  const links = new THREE.Mesh(linkGeo, linkMat);
  links.frustumCulled = false; links.renderOrder = 3;
  set.group.add(links);
  // Camera-facing quads, one per instance, sized in local units: point sprites stop growing at 160 px, these do not, so
  // the nodes and their halos stay true to size as you lean in (in a headset). Instance attributes: aP (the centre),
  // aCol, aSize (across, local units), aA (alpha), and extras [name, size, fill]; the vertex code gives vPC as
  // gl_PointCoord would be.
  function quadGeo(n, extra) {
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    for (const [name, k, v] of [['aP', 3, 0], ['aCol', 3, 0], ['aSize', 1, 0], ['aA', 1, 1]].concat(extra || [])) {
      const at = new THREE.InstancedBufferAttribute(new Float32Array(n * k).fill(v), k);
      at.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(name, at);
    }
    g.instanceCount = n;
    return g;
  }
  const QUAD_VS = `
  vPC = vec2(0.5 + 0.5 * position.x, 0.5 - 0.5 * position.y);
  vec4 mv = modelViewMatrix * vec4(aP, 1.0);
  mv.xy += position.xy * 0.5 * aSize * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`;
  const QUAD_ATTRS = ['aP', 'aCol', 'aSize', 'aA'];
  // halos round hubs (orange-yellow, pulsing) and round a focused node (its colour): soft glows, as the kit's points
  const haloGeo = quadGeo(NO);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aP, aCol; attribute float aSize, aA;
uniform float uA;
varying vec3 vC; varying float vA; varying vec2 vPC;
void main() {
  vC = aCol; vA = aA * uA;${QUAD_VS}
}`,
    fragmentShader: `
varying vec3 vC; varying float vA; varying vec2 vPC;
void main() {
  float d = length(vPC - 0.5);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.18, d), glow = pow(1.0 - d * 2.0, 1.6), a = max(core * 0.85, glow * 0.6);
  gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.22, 0.0, d) * 0.35), vA * a);
}`,
  });
  set.mats.push(haloMat);
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.frustumCulled = false; halo.renderOrder = 5;
  halo.raycast = () => {};   // (its geometry is one quad at the origin: a generic raycast would hit nonsense; pick() knows the nodes)
  set.group.add(halo);

  // ---------------------------------------------------------------- the strength distribution
  const sbGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  sbGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(NO * 3), 3));
  sbGeo.setAttribute('aK', new THREE.InstancedBufferAttribute(new Float32Array(NO), 1));
  sbGeo.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(NO * 3), 3));
  const sbMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aCol, aS; attribute float aK;
varying vec3 vC, vP, vS, vNl; varying float vK;
void main() {
  vC = aCol; vK = aK; vP = position - vec3(0.0, 0.5, 0.0); vS = aS; vNl = normal;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vC, vP, vS, vNl; varying float vK;
void main() {
  if (vK < 0.003) discard;
  // an outlined bar, as in the paper's figure: a bright rim on each face, a soft glow inside
  vec3 e = (0.5 - abs(vP)) * vS + step(0.5, abs(vNl)) * 9.0;
  float m = min(min(e.x, e.y), e.z), rim = 1.0 - smoothstep(0.0018, 0.0042, m);
  float face = vNl.z > 0.5 ? 1.0 : 0.55;
  vec3 col = vC * (0.22 + 1.1 * rim) * face + vec3(1.0) * rim * 0.18;
  gl_FragColor = vec4(col, (0.3 + 0.7 * rim) * vK * uA);
}`,
  });
  set.mats.push(sbMat);
  const sbars = new THREE.InstancedMesh(sbGeo, sbMat, NO);
  sbars.frustumCulled = false; sbars.renderOrder = 3;
  set.group.add(sbars);
  const SB_ATTRS = ['aCol', 'aK', 'aS'].map(k => sbGeo.attributes[k]);
  // the exponential fit: a glowing ribbon in the chart's plane
  const FS = 60, fitGeo = new THREE.BufferGeometry(), FPTS = new Float32Array(2 * (FS + 1));
  {
    fitGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((FS + 1) * 6), 3));
    const ix = []; for (let i = 0; i < FS; i++) ix.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 2, 2 * i + 1, 2 * i + 3);
    fitGeo.setIndex(ix);
  }
  const curveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...K.rgb('#ffd27a')), transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const fitCurve = new THREE.Mesh(fitGeo, curveMat);
  fitCurve.frustumCulled = false; fitCurve.renderOrder = 4;
  set.group.add(fitCurve);

  // ---------------------------------------------------------------- the lesion: a tumour in the right lung
  const LES = [-0.11 * XS, 0.42, 0.03];
  const lesGeo = K.pointsGeo(61);
  {
    const r = K.rng(77), P = lesGeo.attributes.position.array, C = lesGeo.attributes.aCol.array, S = lesGeo.attributes.aSize.array;
    for (let i = 0; i < 60; i++) {
      const u = K.unit(r), q = 0.011 * Math.cbrt(r());
      P.set([LES[0] + u[0] * q, LES[1] + u[1] * q * 0.9, LES[2] + u[2] * q], 3 * i);
      C.set(K.ramp([[0, [1, 1, 1]], [0.6, [1, 0.92, 0.5]], [1, [1, 0.6, 0.15]]], q / 0.011), 3 * i);
      S[i] = 0.01 + 0.008 * r();
    }
    P.set(LES, 180); C.set(K.rgb('#ff9a3c'), 180); S[60] = 0.1;
  }
  const lesMat = K.points(set, { uniforms: { uK: { value: 0 } }, head: 'uniform float uK;',
    vertex: 'vA *= uK; if (aSize > 0.05) { vA *= 0.5; gl_PointSize *= 0.92 + 0.1 * sin(uTime * 3.0); }' });
  const lesion = new THREE.Points(lesGeo, lesMat);
  lesion.renderOrder = 5;
  set.group.add(lesion);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...K.rgb('#ffb43b')), transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending });
  const marker = new THREE.Mesh(K.merge([new THREE.TorusGeometry(0.042, 0.0016, 6, 56), new THREE.TorusGeometry(0.042, 0.0016, 6, 56).rotateY(PI / 2)]),
    ringMat);
  marker.position.set(LES[0], LES[1], LES[2]); marker.renderOrder = 5;
  set.group.add(marker);

  // ---------------------------------------------------------------- icons: bars, column heads, nodes, chart, axes
  // one quad each: a dark disc, a ring in the organ's colour and its line icon (hubs: filled orange-yellow)
  const IB = 0, IN0 = NO, IC = 2 * NO, IX = 3 * NO, NI = 3 * NO + 2 * Math.max(1, NPR);
  const icoGeo = quadGeo(NI, [['aUV', 4, 0], ['aHub', 1, 0], ['aDisc', 1, 1]]);
  const ATL = PET_ICONS.atlas(THREE, 128);
  {
    const uv = icoGeo.attributes.aUV.array, col = icoGeo.attributes.aCol.array;
    const put = (k, oi) => { uv.set(ATL.uv(ORG[oi].id), 4 * k); col.set(COL[oi], 3 * k); };
    for (let i = 0; i < NO; i++) { put(IB + i, i); put(IN0 + i, i); put(IC + i, i); }
    PAIRS.forEach((p, k) => { put(IX + 2 * k, OI[p.a] || 0); put(IX + 2 * k + 1, OI[p.b] || 0); });
  }
  const icoMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uMap: { value: ATL.texture }, uHub: { value: new THREE.Color(...HUBC) } },
    transparent: true, depthWrite: false,
    vertexShader: `
attribute vec3 aP, aCol; attribute float aSize, aA, aHub, aDisc; attribute vec4 aUV;
uniform float uA;
varying vec3 vC; varying float vA, vHub, vDisc; varying vec4 vUV; varying vec2 vPC;
void main() {
  vC = aCol; vA = aA * uA; vHub = aHub; vDisc = aDisc; vUV = aUV;${QUAD_VS}
}`,
    fragmentShader: `
uniform sampler2D uMap; uniform vec3 uHub;
varying vec3 vC; varying float vA, vHub, vDisc; varying vec4 vUV; varying vec2 vPC;
void main() {
  float d = length(vPC - 0.5) * 2.0;
  if (d > 1.0) discard;
  vec2 q = (vPC - 0.5) / mix(0.92, 0.68, vDisc) + 0.5;
  float ic = 0.0;
  if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) ic = texture2D(uMap, vec2(mix(vUV.x, vUV.z, q.x), mix(vUV.w, vUV.y, q.y))).a;
  float ring = (smoothstep(0.74, 0.8, d) - smoothstep(0.93, 1.0, d)) * vDisc;
  float disc = (1.0 - smoothstep(0.94, 1.0, d)) * vDisc;
  vec3 fill = mix(vec3(0.025, 0.045, 0.085), uHub, vHub);
  vec3 ink = mix(mix(vec3(0.95, 0.97, 1.0), vC, 0.3 + 0.5 * (1.0 - vDisc)), vec3(0.16, 0.08, 0.0), vHub);
  vec3 col = mix(mix(fill, ink, ic), mix(vC, vec3(1.0, 0.86, 0.5), vHub * 0.7), ring);
  gl_FragColor = vec4(col, max(disc * 0.92, max(ic, ring)) * vA);
}`,
  });
  set.mats.push(icoMat);
  const icons = new THREE.Mesh(icoGeo, icoMat);
  icons.frustumCulled = false; icons.renderOrder = 7;
  icons.raycast = () => {};
  set.group.add(icons);
  const ICO_ATTRS = QUAD_ATTRS.concat(['aHub', 'aDisc']).map(k => icoGeo.attributes[k]), HALO_ATTRS = QUAD_ATTRS.map(k => haloGeo.attributes[k]);

  // ---------------------------------------------------------------- lines: static (unit, panel, chart) and moving (leaders, tethers)
  // static lines carry a group per vertex (aT) whose alpha is set per frame
  const SL = [];   // [a, b, colour, alpha, group]
  const GU = 0, GS = 1, GC = 2, GM = 3;
  {
    const ux = BAR.xb + BAR.k, y0 = barY(NO - 1) - 0.05, y1 = BAR.top + 0.06;
    for (let y = y1; y > y0; y -= 0.032) SL.push([[ux, y, BAR.z], [ux, Math.max(y0, y - 0.018), BAR.z], [0.85, 0.9, 1], 0.7, GU]);
    for (let v = 0; v <= 4; v++) {
      SL.push([[BAR.xb + v * BAR.k, barY(NO - 1) - 0.055, BAR.z], [BAR.xb + v * BAR.k, barY(NO - 1) - 0.07, BAR.z], [0.6, 0.68, 0.8], 0.6, GU]);
    }
    SL.push([[BAR.xb, barY(NO - 1) - 0.055, BAR.z], [BAR.xb + 4.6 * BAR.k, barY(NO - 1) - 0.055, BAR.z], [0.6, 0.68, 0.8], 0.45, GU]);
    const s = SCP, z = s.z + 0.002, ink = [0.75, 0.82, 0.92];
    SL.push([[s.x0, s.y0, z], [s.x0 + s.s, s.y0, z], ink, 0.9, GS], [[s.x0, s.y0, z], [s.x0, s.y0 + s.s, z], ink, 0.9, GS]);
    SL.push([[s.x0 + s.s, s.y0, z], [s.x0 + s.s, s.y0 + s.s, z], ink, 0.25, GS], [[s.x0, s.y0 + s.s, z], [s.x0 + s.s, s.y0 + s.s, z], ink, 0.25, GS]);
    for (const g of [-2, -1, 1, 2]) {
      const u = 0.5 + g / 6.4;
      SL.push([[s.x0 + u * s.s, s.y0, z], [s.x0 + u * s.s, s.y0 + s.s, z], ink, 0.08, GS]);
      SL.push([[s.x0, s.y0 + u * s.s, z], [s.x0 + s.s, s.y0 + u * s.s, z], ink, 0.08, GS]);
    }
    SL.push([[s.x0 + s.s / 2, s.y0, z], [s.x0 + s.s / 2, s.y0 + s.s, z], ink, 0.16, GS]);
    SL.push([[s.x0, s.y0 + s.s / 2, z], [s.x0 + s.s, s.y0 + s.s / 2, z], ink, 0.16, GS]);
    const c = CHT, cz = c.z;
    SL.push([[c.x0 - 0.02, c.y0, cz], [c.x0 + c.w + 0.02, c.y0, cz], ink, 0.85, GC], [[c.x0 - 0.02, c.y0, cz], [c.x0 - 0.02, c.y0 + c.h, cz], ink, 0.85, GC]);
    for (let v = 1; v <= SMAX; v++) {
      const y = c.y0 + v / SMAX * c.h;
      SL.push([[c.x0 - 0.035, y, cz], [c.x0 - 0.02, y, cz], ink, 0.8, GC], [[c.x0 - 0.02, y, cz], [c.x0 + c.w + 0.02, y, cz], ink, 0.08, GC]);
    }
    // the slab's frame: its front edge and sides on the table
    const mx0 = MAT.x0, mx1 = MAT.x0 + NF * MAT.cw, zf = MAT.z0 + MAT.d0 / 2 + 0.004, zb = MAT.z0 - MAT.d0 / 2 - 0.006 - NR * MAT.rd - 0.004;
    const my = MAT.y - 0.002, mc = [0.95, 0.6, 0.3];
    SL.push([[mx0, my, zf], [mx1, my, zf], mc, 0.5, GM], [[mx0, my, zf], [mx0, my, zb], mc, 0.35, GM]);
    SL.push([[mx1, my, zf], [mx1, my, zb], mc, 0.35, GM], [[mx0, my, zb], [mx1, my, zb], mc, 0.2, GM]);
  }
  const slGeo = K.linesGeo(SL.length), slBase = new Float32Array(SL.length * 2), slGrp = new Uint8Array(SL.length * 2);
  SL.forEach(([a, b, c, al, g], i) => {
    slGeo.attributes.position.array.set(a, 6 * i); slGeo.attributes.position.array.set(b, 6 * i + 3);
    slGeo.attributes.aCol.array.set(c, 6 * i); slGeo.attributes.aCol.array.set(c, 6 * i + 3);
    slBase[2 * i] = slBase[2 * i + 1] = al; slGrp[2 * i] = slGrp[2 * i + 1] = g;
  });
  const SLG = [0, 0, 0, 0];   // each group's alpha this frame
  const sLines = new THREE.LineSegments(slGeo, K.lines(set, {}));
  sLines.frustumCulled = false; sLines.renderOrder = 4;
  set.group.add(sLines);
  // moving lines: each organ's leader to its bar (two segments: out of the body, then to the bar) and its tether to its node
  const NML = 3 * NO, mlGeo = K.linesGeo(NML);
  for (let i = 0; i < NO; i++) {
    for (let s = 0; s < 3; s++) { mlGeo.attributes.aCol.array.set(COL[i], 6 * (3 * i + s)); mlGeo.attributes.aCol.array.set(COL[i], 6 * (3 * i + s) + 3); }
  }
  const mLines = new THREE.LineSegments(mlGeo, K.lines(set, {}));
  mLines.frustumCulled = false; mLines.renderOrder = 4;
  set.group.add(mLines);

  // ---------------------------------------------------------------- the ghost body (harness only: organs_ghost)
  let ghost = null;
  const GHOST_S = { body_a: 1, body_pet: 1, body_net: 0, body_state: 0, body_blank: 0 };

  // ---------------------------------------------------------------- update
  const cur = { net: 0, plane: 10, fw: new Float32Array(NO), apiW: new Float32Array(NO), dim: 0,
    node: ORG.map(() => [0, 0, 0]), nodeA: new Float32Array(NO), nodeS: new Float32Array(NO), hubW: new Float32Array(NO), labW: new Float32Array(NO),
    pres: new Float32Array(NO), str: new Float32Array(NO), barLen: new Float32Array(NO), barA: new Float32Array(NO),
    pairW: new Float32Array(Math.max(1, NPR)), fitEnd: [0, 0, 0], hub: -1, chartX: new Float32Array(NO), chartR: new Float32Array(NO),
    segA: new Float32Array(NO) };
  let apiFocus = 0;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const lift = (i, net) => smooth((net - 0.028 * RRANK[i]) / 0.13);
  function nodeAt(i, net, o) {
    if (!NPOS[i]) return set3(o, HOME[i][0], HOME[i][1], HOME[i][2]);
    const u = lift(i, net), a = HOME[i], b = NPOS[i];
    return set3(o, lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u) + 0.12 * Math.sin(PI * u));
  }
  // the explainer's rise (the dots fly out of the slab, the panel shows): organs_pair up to 1 times organs_scatter
  const rise = S => clamp(S.organs_pair || 0, 0, 1) * (S.organs_scatter === undefined ? 1 : clamp(S.organs_scatter, 0, 1));
  // which pair, as weights: organs_pair 1..NPR, fractional values glide to the next, and past the last back to the first
  function pairMix(S, out) {
    out.fill(0);
    if (!NPR) return out;
    const q = clamp((S.organs_pair || 0) - 1, 0, NPR), b = Math.floor(q), f = q - b;
    out[b % NPR] += 1 - f; out[(b + 1) % NPR] += f;
    return out;
  }
  const PWL = new Float32Array(Math.max(1, NPR));   // (for the labels)
  function update(S, t, dt) {
    const seg = clamp(S.organs_seg, 0, 1), suv = clamp(S.organs_suv, 0, 1), rows = clamp(S.organs_rows, 0, 1), net = clamp(S.organs_net, 0, 1);
    const part = clamp(S.organs_partial, 0, 1), strg = clamp(S.organs_strength, 0, 1), les = clamp(S.organs_lesion, 0, 1), pairIn = rise(S);
    netMix(S);
    cur.net = net;
    const netOut = 1 - prog(net, 0, 0.35);   // bars, slab and panel make way for the network

    // focus: from the param (fractional values pass from one organ to the next), or from the explore API (eased)
    const fp = clamp(S.organs_focus || 0, 0, NO), ke = 1 - Math.exp(-6 * Math.min(0.1, dt || 0));
    let dim = Math.min(fp, 1);
    for (let i = 0; i < NO; i++) {
      cur.apiW[i] += ((apiFocus === i + 1 ? 1 : 0) - cur.apiW[i]) * (dt === undefined ? 1 : ke);
      cur.fw[i] = Math.max(clamp(1 - Math.abs(fp - (i + 1)), 0, 1) * Math.min(fp, 1), cur.apiW[i]);
      dim = Math.max(dim, cur.apiW[i]);
    }
    cur.dim = dim;
    shellMat.uniforms.uFoc.value = cur.fw; shellMat.uniforms.uDim.value = dim;

    // segmentation: the plane sweeps from above the head to the thighs; shells show above it
    const sw = prog(seg, 0, 0.94), py = lerp(0.86, -0.24, sw);
    cur.plane = seg <= 0.0005 ? 10 : seg >= 0.9995 ? -10 : py;
    shellMat.uniforms.uPlane.value = cur.plane;
    const pk = prog(seg, 0, 0.04) * (1 - prog(seg, 0.9, 1));
    shellMat.uniforms.uCut.value = pk;
    if (job) jobStep(5, true);   // wanted now: build in short slices (a headset's frame is 11 to 14 ms), then fade in
    shells.visible = !job;
    shellMat.uniforms.uK.value = (1 - 0.5 * prog(net, 0, 0.5)) * clamp((performance.now() - builtAt) / 500, 0, 1);
    plane.visible = pk > 0.003;
    if (plane.visible) { plane.position.y = py; planeMat.uniforms.uK.value = pk; section(py, planeMat.uniforms.uE.value); }
    for (let i = 0; i < NO; i++) {
      const yr = YR[i], top = yr[1] - SEGO[i];
      // a name shows for a short stretch once the plane reaches the organ's top (so a few at a time, not all at once)
      const win = Math.min(yr[1] - yr[0], 0.05);
      cur.segA[i] = yr[0] < yr[1] && pk > 0 ? prog(py, top + 0.03, top - 0.005) * (1 - prog(py, top - win, top - win - 0.04)) * pk : 0;
    }

    // uptake bars, then their collapse into the slab's first row
    const coll = prog(rows, 0, 0.28), barsOut = prog(rows, 0.22, 0.32);
    const ac = bars.geometry.attributes.aCol.array, ak = bars.geometry.attributes.aK.array;
    for (let i = 0; i < NO; i++) {
      const r = BRANK[i], a = prog(suv, 0.03 * r, 0.03 * r + 0.36), L = (ORG[i].suv || 0) * BAR.k * a, c = F2COL[i];
      const fw = cur.fw[i], foc = (1 + 1.3 * fw) * (1 - 0.75 * dim * (1 - fw));
      let x = BAR.xb, y = barY(r), z = BAR.z, len = Math.max(L, 1e-4), rad = BAR.r, k = suv > 0 ? Math.min(1, a * 4) : 0;
      if (c >= 0) {
        const u = coll;
        x = lerp(x, cellX(c) - MAT.cw * 0.42, u); y = lerp(y, MAT.y + 0.02, u); z = lerp(z, MAT.z0, u); len = lerp(len, MAT.cw * 0.84, u);
        rad = lerp(rad, 0.013, u);
        k *= 1 - barsOut;
      } else k *= 1 - coll;
      k *= netOut;
      cur.barLen[i] = L; cur.barA[i] = k;
      _p.set(x, y, z); _s.set(len, rad, rad); _m.compose(_p, _q, _s); bars.setMatrixAt(i, _m);
      ac[3 * i] = COL[i][0]; ac[3 * i + 1] = COL[i][1]; ac[3 * i + 2] = COL[i][2]; ak[i] = k * foc;
    }
    bars.instanceMatrix.needsUpdate = true; bars.geometry.attributes.aCol.needsUpdate = true; bars.geometry.attributes.aK.needsUpdate = true;
    bars.visible = suv > 0.003 && netOut > 0.003 && barsOut < 0.999;

    // the slab
    cellMat.uniforms.uRow0.value = prog(rows, 0.2, 0.32);
    cellMat.uniforms.uRows.value = rows;
    cellMat.uniforms.uK.value = netOut * (1 - 0.35 * pairIn);
    cellMat.depthWrite = set.uA.value * cellMat.uniforms.uK.value > 0.97;   // (a fading slab must not hide what is behind it)
    cells.visible = rows > 0.2 && netOut > 0.003;

    // the partial-correlation panel: raw values, the cloud shrinking to what is left (p1), rescaled (p2)
    const pw = pairMix(S, cur.pairW), scA = pairIn * netOut, p1 = smooth(part / 0.55), p2 = smooth((part - 0.55) / 0.45);
    dotMat.uniforms.uW.value.set(pw[0] || 0, pw[1] || 0, pw[2] || 0, pw[3] || 0); dotMat.uniforms.uW4.value = pw[4] || 0;
    dotMat.uniforms.uP1.value = p1; dotMat.uniforms.uP2.value = p2; dotMat.uniforms.uRise.value = prog(pairIn, 0, 1); dotMat.uniforms.uK.value = scA;
    let sx = 0, slope = 0, shx = NPR ? 0 : 1, shy = NPR ? 0 : 1;
    for (let k = 0; k < NPR; k++) {
      const p = PAIRS[k], w = pw[k], sh = PSH[k], ca = F2.indexOf(p.a), cb = F2.indexOf(p.b);
      sx += w * (ca >= 0 && cb >= 0 ? (cellX(ca) + cellX(cb)) / 2 : MAT.x0 + 0.3);
      slope += w * lerp(lerp(p.r, p.pr * sh[1] / sh[0], p1), p.pr, p2);   // (in the shrunk cloud's units, then in standard units)
      shx += w * sh[0]; shy += w * sh[1];
    }
    dotMat.uniforms.uSX.value = sx; dotMat.uniforms.uSh.value.set(shx, shy);
    dots.visible = scA > 0.003 && NPR > 0;
    backMat.opacity = 0.62 * prog(pairIn, 0.25, 0.7) * netOut * set.uA.value;   // (with the dots, not before them: an empty box)
    scBack.visible = backMat.opacity > 0.003;
    {
      const ang = Math.atan(slope), shm = 1 + ((shx + shy) / 2 - 1) * p1 * (1 - p2), fa = prog(pairIn, 0.55, 1) * netOut;
      const hl = 0.47 * SCP.s * shm / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
      const sg = slope >= 0 ? POSC : NEGC, u = smooth(Math.abs(slope) / 0.12);   // (no correlation: a pale grey line)
      fitLine.position.set(SCP.x0 + SCP.s / 2, SCP.y0 + SCP.s / 2, SCP.z + 0.016);
      fitLine.rotation.set(0, 0, ang); fitLine.scale.set(2 * hl * prog(pairIn, 0.55, 1), 1, 1);
      fitMat.color.setRGB(lerp(0.72, sg[0], u), lerp(0.76, sg[1], u), lerp(0.84, sg[2], u));
      fitMat.opacity = fa * set.uA.value; fitLine.visible = fa > 0.003;
      set3(cur.fitEnd, SCP.x0 + SCP.s / 2 + Math.cos(ang) * hl, SCP.y0 + SCP.s / 2 + Math.sin(ang) * hl, SCP.z + 0.016);
    }

    // the network: weights, presence, strengths and hubs blend between the networks on show (netMix)
    const N0 = NETS[NWI[0]], N1 = NETS[NWI[1]], N2 = NETS[NWI[2]], w0 = NWW[0], w1 = NWW[1], w2 = NWW[2];
    for (let i = 0; i < NO; i++) cur.pres[i] = bl('pres', i);
    for (let l = 0; l < NL; l++) {
      const a = LINKS[l][0], b = LINKS[l][1], w = N0.W[l] * w0 + N1.W[l] * w1 + N2.W[l] * w2, first = RRANK[a] <= RRANK[b] ? a : b;
      const st = 0.46 + 0.36 * RRANK[first] / Math.max(1, NN.length - 1), g = clamp((net - st) / 0.16, 0, 1), fm = Math.max(cur.fw[a], cur.fw[b]);
      UL[l].set(w, g, cur.pres[a] * cur.pres[b] * (1 + 1.1 * fm) * (1 - 0.8 * dim * (1 - fm)) * (net > 0.003 ? 1 : 0), first === a ? 0 : 1);
    }
    links.visible = net > 0.4;
    const hp = haloGeo.attributes.aP.array, hc = haloGeo.attributes.aCol.array, hs = haloGeo.attributes.aSize.array, ha = haloGeo.attributes.aA.array;
    let best = -1, bs = -1;
    for (let i = 0; i < NO; i++) {
      const pres = cur.pres[i], str = bl('str', i), hub = bl('hub', i), fw = cur.fw[i];
      const u = NPOS[i] ? lift(i, net) : 0, p = nodeAt(i, net, cur.node[i]);
      cur.str[i] = str; cur.hubW[i] = hub;
      // a name shows while the networks that name it hold most of the weight (so never two networks' names at once)
      cur.labW[i] = clamp((bl('lab', i) - 0.5) / 0.12, 0, 1);
      cur.nodeA[i] = NPOS[i] ? pres * smooth(u * 3) * (1 - 0.7 * dim * (1 - fw)) : 0;
      cur.nodeS[i] = 0.088 + 0.06 * Math.sqrt(Math.min(1, str / 3));
      if (hub * pres > 0.5 && str > bs) { bs = str; best = i; }
      hp[3 * i] = p[0]; hp[3 * i + 1] = p[1]; hp[3 * i + 2] = p[2] - 0.004;
      const pul = 0.8 + 0.2 * Math.sin(t * 1.6 + i), hb = hub > fw;
      hs[i] = cur.nodeS[i] * (1.9 + 0.35 * pul * hub);
      hc[3 * i] = hb ? HUBC[0] : COL[i][0]; hc[3 * i + 1] = hb ? HUBC[1] : COL[i][1]; hc[3 * i + 2] = hb ? HUBC[2] : COL[i][2];
      ha[i] = cur.nodeA[i] * Math.max(hub * 0.75 * pul, fw * 0.6) * prog(net, 0.3, 0.6);
    }
    cur.hub = best;
    for (const at of HALO_ATTRS) at.needsUpdate = true;
    halo.visible = net > 0.3;

    // the strength distribution: bars sorted high to low (they slide to their new places), the exponential fit
    const chA = prog(strg, 0, 0.5), grow = prog(strg, 0.15, 0.75), bw = CHT.w / 13 * 0.62, hsc = CHT.h / SMAX;
    const sc = sbars.geometry.attributes.aCol.array, sk = sbars.geometry.attributes.aK.array, ss = sbars.geometry.attributes.aS.array;
    for (let i = 0; i < NO; i++) {
      let xs = 0, rs = 0, ws = 0;
      for (let s = 0; s < 3; s++) {
        const q = NETS[NWI[s]], w = NWW[s], r = q.rank[i];
        if (w > 0 && r >= 0) { xs += w * (CHT.x0 + (r + 0.5) * CHT.w / Math.max(1, q.N)); rs += w * (r % 2); ws += w; }
      }
      const x = ws > 0 ? xs / ws : CHT.x0, h = Math.max(1e-4, cur.str[i] * hsc * grow), hk = cur.hubW[i] * 0.85, fw = cur.fw[i];
      cur.chartX[i] = x; cur.chartR[i] = ws > 0 ? rs / ws : 0;
      _p.set(x, CHT.y0, CHT.z); _s.set(bw, h, 0.02); _m.compose(_p, _q, _s); sbars.setMatrixAt(i, _m);
      sc[3 * i] = lerp(COL[i][0], HUBC[0], hk); sc[3 * i + 1] = lerp(COL[i][1], HUBC[1], hk); sc[3 * i + 2] = lerp(COL[i][2], HUBC[2], hk);
      sk[i] = cur.pres[i] * chA * (1 + 0.8 * fw) * (1 - 0.6 * dim * (1 - fw));
      ss[3 * i] = bw; ss[3 * i + 1] = h; ss[3 * i + 2] = 0.02;
    }
    sbars.instanceMatrix.needsUpdate = true;
    for (const at of SB_ATTRS) at.needsUpdate = true;
    sbars.visible = chA > 0.003;
    backMat2.opacity = 0.55 * chA * set.uA.value; chBack.visible = chA > 0.003;
    {
      const fp2 = fitGeo.attributes.position.array, draw = prog(strg, 0.5, 1), wd = 0.0042, P = FPTS;
      for (let s = 0; s <= FS; s++) {
        const u = s / FS * draw;
        let x = 0, y = 0;
        for (let k = 0; k < 3; k++) {
          const q = NETS[NWI[k]], w = NWW[k], r = u * Math.max(0, q.N - 1);
          if (!w) continue;
          x += w * (CHT.x0 + (r + 0.5) * CHT.w / Math.max(1, q.N)); y += w * (CHT.y0 + Math.min(SMAX, q.A * Math.exp(-q.b * r)) * hsc * grow);
        }
        P[2 * s] = x; P[2 * s + 1] = y;
      }
      for (let s = 0; s <= FS; s++) {
        const s0 = Math.max(0, s - 1), s1 = Math.min(FS, s + 1), dx = P[2 * s1] - P[2 * s0], dy = P[2 * s1 + 1] - P[2 * s0 + 1], l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l * wd, ny = dx / l * wd, x = P[2 * s], y = P[2 * s + 1], q = 6 * s;
        fp2[q] = x + nx; fp2[q + 1] = y + ny; fp2[q + 2] = CHT.z + 0.016; fp2[q + 3] = x - nx; fp2[q + 4] = y - ny; fp2[q + 5] = CHT.z + 0.016;
      }
      fitGeo.attributes.position.needsUpdate = true;
      const fitOn = (N0.has ? w0 : 0) + (N1.has ? w1 : 0) + (N2.has ? w2 : 0);
      curveMat.opacity = draw * chA * fitOn * set.uA.value; fitCurve.visible = curveMat.opacity > 0.003;
    }

    // icons: bar icons (moving to head the slab's columns), node discs, chart icons, the panel's axes
    const ia = icoGeo.attributes, ip = ia.aP.array, iA = ia.aA.array, is = ia.aSize.array, ih = ia.aHub.array, id = ia.aDisc.array;
    const headA = prog(rows, 0.2, 0.35) * netOut * (1 - 0.5 * pairIn);
    for (let i = 0; i < NO; i++) {
      const r = BRANK[i], c = F2COL[i], fw = cur.fw[i], foc = 1 - 0.6 * dim * (1 - fw);
      const ai = prog(suv, 0.03 * r, 0.03 * r + 0.12) * netOut * foc;
      let x = BAR.x0, y = barY(r), z = BAR.z + 0.002, a = ai * (c >= 0 ? 1 : 1 - coll), s = 0.066;
      if (c >= 0) {
        x = lerp(x, cellX(c), coll); y = lerp(y, MAT.y + 0.075, coll); z = lerp(z, MAT.z0 + 0.03, coll); s = lerp(s, 0.054, coll);
        a = lerp(a, headA * foc, coll);
      }
      ip[3 * i] = x; ip[3 * i + 1] = y; ip[3 * i + 2] = z; iA[i] = a; is[i] = s * (1 + 0.3 * fw); ih[i] = 0;
      const k = IN0 + i, p = cur.node[i];
      ip[3 * k] = p[0]; ip[3 * k + 1] = p[1]; ip[3 * k + 2] = p[2]; iA[k] = cur.nodeA[i]; is[k] = cur.nodeS[i] * (1 + 0.25 * fw);
      ih[k] = cur.hubW[i] * prog(net, 0.5, 0.8);
      // under the chart, in two staggered rows (so they can be larger than a bar's slot)
      const q = IC + i;
      ip[3 * q] = cur.chartX[i]; ip[3 * q + 1] = CHT.y0 - 0.048 - 0.075 * cur.chartR[i]; ip[3 * q + 2] = CHT.z + 0.01;
      iA[q] = cur.pres[i] * chA * foc; is[q] = 0.072; ih[q] = 0; id[q] = 0;
    }
    for (let k = 0; k < NPR; k++) {
      const a = IX + 2 * k, b = a + 1, al = pw[k] * prog(pairIn, 0.4, 0.9) * netOut;
      ip[3 * a] = SCP.x0 + SCP.s + 0.045; ip[3 * a + 1] = SCP.y0; ip[3 * a + 2] = SCP.z + 0.01;
      ip[3 * b] = SCP.x0; ip[3 * b + 1] = SCP.y0 + SCP.s + 0.045; ip[3 * b + 2] = SCP.z + 0.01;
      iA[a] = iA[b] = al; is[a] = is[b] = 0.052;
    }
    for (const at of ICO_ATTRS) at.needsUpdate = true;

    // lines
    const sa = slGeo.attributes.aA.array, ga = SLG;
    ga[0] = suv * netOut * (1 - coll); ga[1] = prog(pairIn, 0.25, 0.75) * netOut; ga[2] = chA; ga[3] = prog(rows, 0.35, 0.6) * netOut;
    for (let v = 0; v < sa.length; v++) sa[v] = slBase[v] * ga[slGrp[v]];
    slGeo.attributes.aA.needsUpdate = true;
    const mp = mlGeo.attributes.position.array, ma = mlGeo.attributes.aA.array;
    for (let i = 0; i < NO; i++) {
      const r = BRANK[i], L = LEAD[i], ex = 0.27, yb = barY(r), fw = cur.fw[i], foc = (1 + fw) * (1 - 0.7 * dim * (1 - fw)), o = 18 * i;
      const la = prog(suv, 0.03 * r + 0.05, 0.03 * r + 0.25) * netOut * (1 - coll) * 0.45 * foc;
      // the leader: out of the body at the organ's height, then across to its bar
      mp[o] = L[0]; mp[o + 1] = L[1]; mp[o + 2] = L[2]; mp[o + 3] = ex; mp[o + 4] = L[1]; mp[o + 5] = BAR.z;
      mp[o + 6] = ex; mp[o + 7] = L[1]; mp[o + 8] = BAR.z; mp[o + 9] = BAR.x0 - 0.03; mp[o + 10] = yb; mp[o + 11] = BAR.z;
      ma[6 * i] = ma[6 * i + 1] = ma[6 * i + 2] = ma[6 * i + 3] = la;
      const p = cur.node[i], ta = NPOS[i] ? cur.nodeA[i] * 0.4 * (1 - 0.5 * prog(net, 0.6, 1)) : 0;
      mp[o + 12] = HOME[i][0]; mp[o + 13] = HOME[i][1]; mp[o + 14] = HOME[i][2]; mp[o + 15] = p[0]; mp[o + 16] = p[1]; mp[o + 17] = p[2];
      ma[6 * i + 4] = ma[6 * i + 5] = ta;
    }
    mlGeo.attributes.position.needsUpdate = true; mlGeo.attributes.aA.needsUpdate = true;

    // the lesion: a white-hot blob, its halo, two rings closing in on it
    lesMat.uniforms.uK.value = les;
    lesion.visible = les > 0.003;
    marker.visible = les > 0.003;
    if (marker.visible) {
      const k = prog(les, 0.2, 1);
      marker.scale.setScalar(1 + 1.4 * (1 - k)); marker.rotation.set(0.3, t * 0.7, 0);
      ringMat.opacity = k * (0.75 + 0.25 * Math.sin(t * 3)) * set.uA.value;
    }

    // the ghost body under the shells (only for checking the fit in the harness)
    const gh = clamp(S.organs_ghost || 0, 0, 1);
    if (gh > 0.003 && !ghost && typeof SETS !== 'undefined' && SETS.body) { ghost = SETS.body(K); set.group.add(ghost.group); }
    if (ghost) { ghost.setAlpha(gh * set.uA.value); if (gh > 0.003) ghost.update(GHOST_S, t, dt); }
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const anchors = {
    bars: [BAR.xb + 0.06, BAR.top + 0.07, BAR.z],
    unit: [BAR.xb + BAR.k, barY(NO - 1) - 0.13, BAR.z],   // (at the foot of the unit line, under the axis: clear of the bars' names)
    matrix: [MAT.x0 + NF * MAT.cw + 0.01, MAT.y + 0.03, MAT.z0],
    scatter: [SCP.x0, SCP.y0 + SCP.s + 0.115, SCP.z],
    axisX: [SCP.x0 + SCP.s + 0.075, SCP.y0, SCP.z],
    axisY: [SCP.x0 + 0.03, SCP.y0 + SCP.s + 0.045, SCP.z],
    fit: own(o => set3(o, cur.fitEnd[0] + 0.01, cur.fitEnd[1] + 0.02, cur.fitEnd[2])),
    net: [0, NETY, NETZ],
    title: [-0.62, 0.985, NETZ - 0.12],
    strength: [CHT.x0 - 0.03, CHT.y0 + CHT.h + 0.15, CHT.z],
    chartAxis: [CHT.x0 - 0.03, CHT.y0 + CHT.h + 0.03, CHT.z],
    lesion: LES.slice(),
    plane: own(o => set3(o, PLW * 0.3, cur.plane, PLD / 2)),   // (its front corner: below the organs' names at the plane)
    hub: own(o => (cur.hub >= 0 ? set3(o, cur.node[cur.hub][0], cur.node[cur.hub][1], cur.node[cur.hub][2]) : set3(o, 0, NETY, NETZ))),
  };
  // where the sweep names an organ: on it, but never below the plane (where nothing is outlined yet); fat on the flank
  // (its home point is the body's middle, where the marrow is too)
  const SEGAT = { fat: [0.135, 0.0] };
  ORG.forEach((og, i) => {
    anchors[og.id] = own(o => { nodeAt(i, cur.net, o); if (NPOS[i]) o[0] += 0.5 * cur.nodeS[i] * lift(i, cur.net); return o; });
    anchors['bar_' + og.id] = own(o => set3(o, BAR.xb + Math.max(cur.barLen[i], 0.01) + 0.012, barY(BRANK[i]) + 0.004, BAR.z));
    const at = SEGAT[og.id];
    anchors['seg_' + og.id] = own(o => set3(o, at ? at[0] : HOME[i][0], Math.abs(cur.plane) < 9 ? Math.max(HOME[i][1], cur.plane + 0.012) : HOME[i][1],
      at ? at[1] : HOME[i][2]));
  });
  // names at the bars: the longest, the shortest and a few between, never two neighbours (and a focused organ)
  const BAR_LBL = { brain: 1, heart: 1, liver: 1, kidneys: 1, muscle: 1, fat: 1, aorta: 1 };   // (the three the text names, among them)
  const netOn = S => prog(clamp(S.organs_net, 0, 1), 0.5, 0.8);
  const quietRight = S => 1 - prog(clamp(S.organs_net, 0, 1), 0, 0.3);   // the right-hand panels make way for the network
  const rowsOff = S => 1 - prog(clamp(S.organs_rows, 0, 1), 0, 0.2);
  const near = (S, k) => clamp(2.2 * netW(S, k) - 1.2, 0, 1);   // a network's own labels: only while it holds most weight
  const pairNear = (S, k) => clamp(2 * pairMix(S, PWL)[k] - 1, 0, 1);
  const sfx = x => `${Math.round(x * 100) / 100}×`;
  const labels = [];
  ORG.forEach((og, i) => {
    const name = og.name, isNode = !!NPOS[i], short = og.short || name, focus = S => cur.fw[i] * (1 - clamp(S.organs_suv, 0, 1));
    // the sweep names each organ as the plane outlines it (not the aorta: it lay on the heart's name, and the story names
    // it as the text comes to it, focused); a focused organ is named on it
    if (og.id !== 'aorta') labels.push({ text: [name, ''], at: 'seg_' + og.id, cls: '', minor: og.id === 'adrenal' || og.id === 'pancreas',
      alpha: S => cur.segA[i] * (1 - focus(S)) * (1 - netOn(S)) * rowsOff(S) });
    labels.push({ text: [name, ''], at: og.id, cls: '', alpha: S => focus(S) * (1 - netOn(S)) * rowsOff(S) });
    // on its node (short name) in the network; a hub says so (one label or the other, never both)
    if (isNode) {
      labels.push({ text: [short, ''], at: og.id, cls: '', minor: true,   // (on a narrow screen only the hubs are named)
        alpha: S => netOn(S) * cur.pres[i] * Math.max(cur.labW[i], cur.fw[i]) * clamp(1 - 2 * cur.hubW[i], 0, 1) });
    }
    if (isNode) labels.push({ text: [short, ' · hub'], at: og.id, cls: 'amb', alpha: S => netOn(S) * cur.pres[i] * clamp(2 * cur.hubW[i] - 1, 0, 1) });
    labels.push({ text: [short, ` · ${sfx(og.suv || 0)}`], at: 'bar_' + og.id, cls: '', minor: !BAR_LBL[og.id], alpha: S => {
      const k = cur.barA[i] * prog(clamp(S.organs_suv, 0, 1), 0.3, 0.7) * (1 - prog(clamp(S.organs_rows, 0, 1), 0, 0.15));
      return k * Math.max(BAR_LBL[og.id] ? 1 - cur.dim * (1 - cur.fw[i]) : 0, cur.fw[i]);
    } });
  });
  labels.push({ text: ['÷ aorta', ' · blood pool = 1 · typical values'], at: 'unit', cls: 'cyn',
    alpha: S => prog(clamp(S.organs_suv, 0, 1), 0.4, 0.8) * (1 - prog(clamp(S.organs_rows, 0, 1), 0, 0.15)) * quietRight(S) });
  // (named while the plane passes the head and chest; then the organs' names have the plane)
  labels.push({ text: ['AI segmentation', ' · slice by slice'], at: 'plane', cls: 'cyn',
    alpha: S => { const s = clamp(S.organs_seg, 0, 1); return prog(s, 0.02, 0.08) * (1 - prog(s, 0.36, 0.44)); } });
  labels.push({ text: [`${NR} scans × ${NF} organs`, ' · stand-in values'], at: 'matrix', cls: 'amb',
    alpha: S => prog(clamp(S.organs_rows, 0, 1), 0.7, 0.95) * (1 - prog(rise(S), 0, 0.3)) * quietRight(S) });
  labels.push({ text: [`${NR} scans`, ' · stand-ins'], at: 'scatter', cls: '', alpha: S => prog(rise(S), 0.5, 0.9) * quietRight(S) });
  labels.push({ text: ['Tumour', ' · a hot spot'], at: 'lesion', cls: 'amb', alpha: S => prog(clamp(S.organs_lesion, 0, 1), 0.4, 0.8) * (1 - netOn(S)) });
  PAIRS.forEach((p, k) => {
    const w = S => pairNear(S, k) * prog(rise(S), 0.5, 0.9) * quietRight(S), part = S => clamp(S.organs_partial, 0, 1);
    const na = ORG[OI[p.a]] ? ORG[OI[p.a]].name : p.a, nb = ORG[OI[p.b]] ? ORG[OI[p.b]].name : p.b;
    const paper = typeof p.paper === 'number' ? ` (paper: ${num(p.paper)})` : ' (paper: no link)';
    labels.push({ text: [na, ' →'], at: 'axisX', cls: '', alpha: w });
    labels.push({ text: [nb, ' ↑'], at: 'axisY', cls: '', alpha: w });
    labels.push({ text: [`r = ${num(p.r)}`, ''], at: 'fit', cls: 'cyn', alpha: S => w(S) * (1 - prog(part(S), 0.1, 0.4)) });
    labels.push({ text: [`partial r = ${num(p.pr)}`, paper], at: 'fit', cls: 'amb', alpha: S => w(S) * prog(part(S), 0.65, 0.95) });
  });
  NETS.forEach((q, k) => {
    labels.push({ text: [q.title, q.sub ? ` · ${q.sub}` : ''], at: 'title', cls: '', alpha: S => netOn(S) * near(S, k) });
    if (q.density !== null) {
      labels.push({ text: [`density ${q.density} %`, q.disorder ? ` · disorder ${q.disorder}` : ''], at: 'strength', cls: 'amb',
        alpha: S => prog(clamp(S.organs_strength, 0, 1), 0.4, 0.8) * near(S, k) });
    }
  });
  labels.push({ text: ['Strength', ' · the same scale in every network'], at: 'chartAxis', cls: '', minor: true,
    alpha: S => prog(clamp(S.organs_strength, 0, 1), 0.3, 0.7) });
  const cam = {
    default: [0, 4, 3.75, 0, 0, 0],
    seg: [18, 16, 2.4, 0, 0.28, 0],
    bars: [-6, 4, 3.0, 0.42, 0.2, 0],
    matrix: [32, 30, 2.5, 0.76, 0.1, -0.32],
    scatter: [8, 6, 2.1, 0.76, 0.52, 0.2],
    net: [8, 6, 3.1, 0.05, 0.37, 0.4],
    strength: [-6, 4, 3.4, 0.56, 0.24, 0.36],
    lesion: [-24, 8, 1.15, LES[0], LES[1], LES[2]],
  };
  const VIEWS = [['organs', 'Organs'], ['uptake', 'Uptake'], ['matrix', 'Matrix'], ['partial', 'Partial'], ['network', 'Network'], ['strength', 'Strength']];
  const controls = [
    { key: 'view', label: 'View', options: VIEWS },
    { key: 'network', label: 'Network', options: NET_IDS.slice(0, 11).map((id, k) => [id, NET_SHORT[k]]) },
  ];
  // A change of network crossfades from the one before (organs_prev, organs_mix by c.t: the engine restarts c.t when a
  // control changes); the engine must snap organs_which (and organs_prev) instead of easing them through the networks
  // between. This is the only state explore keeps: which network it was last asked for, and the one before it.
  const EX = { last: -1, prev: 0 };
  function explore(c) {
    const v = c.view || 'organs', w = Math.max(0, NET_IDS.indexOf(c.network || 'full')), tt = Math.max(0, c.t || 0);
    if (EX.last < 0) EX.prev = w;
    else if (w !== EX.last) EX.prev = EX.last;
    else if (tt > 1.4) EX.prev = w;   // (done: a later restart of c.t must not cross again)
    EX.last = w;
    const o = { organs_seg: 1, organs_suv: 0, organs_rows: 0, organs_pair: 0, organs_scatter: 0, organs_partial: 0, organs_net: 0, organs_strength: 0,
      organs_which: w, organs_prev: EX.prev, organs_mix: EX.prev === w ? 1 : smooth(tt / 1.2), organs_lesion: 0 };
    if (v === 'uptake') o.organs_suv = 1;
    if (v === 'matrix' || v === 'partial') o.organs_rows = 1;
    // The explainer loops through the pairs: each raw for 4 s, its residuals for 5 s, then it glides to the next (and
    // from the last back to the first). organs_pair changes smoothly in time, so the engine may pass it on unchanged.
    if ((v === 'matrix' || v === 'partial') && NPR) {
      const k = Math.floor(tt / 10), u = tt - 10 * k;
      o.organs_pair = 1 + (k % NPR) + smooth(u - 9);
      o.organs_partial = u >= 4 && u < 9 ? 1 : 0;
      o.organs_scatter = v === 'partial' ? 1 : 0;
    }
    if (v === 'network') o.organs_net = 1;
    if (v === 'strength') { o.organs_net = 1; o.organs_strength = 1; }
    return o;
  }

  // ---------------------------------------------------------------- explore API
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
  function hitEll(o, d, c, r, ax) {   // ray (modelling coordinates) against an ellipsoid -> distance or Infinity
    let ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2], dx = d[0], dy = d[1], dz = d[2];
    if (ax) {
      const P = [ox, oy, oz], Q = [dx, dy, dz];
      ox = v3.dot(P, ax[0]); oy = v3.dot(P, ax[1]); oz = v3.dot(P, ax[2]); dx = v3.dot(Q, ax[0]); dy = v3.dot(Q, ax[1]); dz = v3.dot(Q, ax[2]);
    }
    ox /= r[0]; oy /= r[1]; oz /= r[2]; dx /= r[0]; dy /= r[1]; dz /= r[2];
    const a = dx * dx + dy * dy + dz * dz, b = 2 * (ox * dx + oy * dy + oz * dz), cc = ox * ox + oy * oy + oz * oz - 1, disc = b * b - 4 * a * cc;
    if (disc < 0) return Infinity;
    const t0 = (-b - Math.sqrt(disc)) / (2 * a), t1 = (-b + Math.sqrt(disc)) / (2 * a);
    return t0 > 0 ? t0 : t1 > 0 ? 0 : Infinity;
  }
  function pick(raycaster) {
    set.group.updateMatrixWorld();
    _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    const o = _ray.origin, d = _ray.direction;
    // the network's nodes first, then the bars, then the shells (the fat band last: it wraps the others)
    if (cur.net > 0.4) {
      let best = null, bd = Infinity;
      for (const i of NN) {
        if (cur.nodeA[i] < 0.2) continue;
        const p = cur.node[i], x = p[0] - o.x, y = p[1] - o.y, z = p[2] - o.z, al = x * d.x + y * d.y + z * d.z;
        if (al <= 0) continue;
        const off = Math.sqrt(Math.max(0, x * x + y * y + z * z - al * al));
        if (off < cur.nodeS[i] * 0.65 && al < bd) { bd = al; best = ORG[i].id; }
      }
      if (best) return best;
    }
    for (let i = 0; i < NO; i++) {
      if (cur.barA[i] < 0.3) continue;
      const y = barY(BRANK[i]), x0 = BAR.x0 - 0.03, x1 = BAR.xb + cur.barLen[i] + 0.01;
      if (Math.abs(d.z) < 1e-6) continue;
      const tz = (BAR.z - o.z) / d.z, hx = o.x + d.x * tz, hy = o.y + d.y * tz;
      if (tz > 0 && hx >= x0 && hx <= x1 && Math.abs(hy - y) < BAR.dy * 0.45) return ORG[i].id;
    }
    if (shellMat.uniforms.uPlane.value < 9) {
      const om = [o.x / XS, o.y, o.z], dm = [d.x / XS, d.y, d.z];
      let best = null, bd = Infinity, fat = Infinity;
      for (const og of ORG) for (const [c, r, ax] of (PICKS[og.id] || [])) {
        const t = hitEll(om, dm, c, r, ax);
        if (og.id === 'fat') { fat = Math.min(fat, t); continue; }
        if (c[1] < cur.plane - 0.02 && cur.plane > -9) continue;   // not yet outlined
        if (t < bd) { bd = t; best = og.id; }
      }
      return best || (fat < Infinity ? 'fat' : null);
    }
    return null;
  }
  const API = {
    netIds: NET_IDS.slice(0, 11),
    extraNetIds: NET_IDS.slice(11),          // organs_which 11.. shows these (vena cava, the three doses)
    // the explainer's pairs (organs_pair k + 1): r, partial r and the paper's weight (null: no link in Figure 2A);
    // indirect: found here in the stand-in cohort, a link that only passes through other organs
    pairs: PAIRS.map(p => ({ a: p.a, b: p.b, r: p.r, pr: p.pr, paper: typeof p.paper === 'number' ? p.paper : null, indirect: !!p.indirect })),
    pick,
    setFocus: id => { apiFocus = id && OI[id] !== undefined ? OI[id] + 1 : 0; },
    stats: () => ({ built: !job, jobMs: Math.round(jobMs), verts: NV, tris: NI3 / 3, per: PER, yr: YR.map(r => r.map(y => Math.round(y * 1000) / 1000)) }),
  };
  return Object.assign(set, {
    params: { organs_a: 1, organs_seg: 1, organs_suv: 0, organs_focus: 0, organs_lesion: 0, organs_rows: 0, organs_pair: 0, organs_scatter: 1,
      organs_partial: 0, organs_net: 0, organs_which: 0, organs_prev: 0, organs_mix: 1, organs_strength: 0, organs_ghost: 0 },
    update, anchors, labels, cam, controls, explore, api: () => API,
    idle: () => jobStep(4),            // while the set is hidden, the shells go on building
    finish: () => jobStep(Infinity),   // for screenshots and tests: build them now
  });
};

// `liver`: an organ is a network too (the PET story). The authors' VR viewer also shows one organ as a network of
// small patches; this is an illustrative stand-in built from scratch (no patient data). A liver as one smooth surface
// (a signed distance field: the big right lobe, the smaller left lobe, the notches of the gallbladder and the round
// ligament, the gallbladder in its bed underneath, the falciform ligament on the front) is filled with about 3,000
// patches on a regular grid, each with a stand-in uptake (smooth noise, a cooler and a warmer patch, a little noise
// per patch as in any scan). Two patches a few grid steps apart are linked when one outshines the other by more than
// a threshold (the poster's rule for organs, applied to patches): about 20,000 links. The best-connected 5 % stand out
// (each keeps its own colour, in an amber ring). Everything is built once at load; update only sets uniforms (and hides
// what is not drawn), so the picture follows the params and the time alone.
// Frame: x the patient's left (so the right lobe is on your left when you face it), y up, z forward; about 1.6 wide.
SETS.liver = function (K) {
  const { THREE, smooth, clamp, lerp, prog, v3 } = K;
  const set = K.newSet('liver');
  const R = K.rng(1606);
  const ORG = typeof PET_DATA !== 'undefined' && (PET_DATA.organs || []).find(o => o.id === 'liver');
  const COL = K.rgb(ORG ? ORG.col : '#f97316'), HUBC = K.rgb('#ffb020'), LINKC = K.rgb('#4c7cff'), FRONTC = K.rgb('#46d9ff');
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
  const capsule = (a, b, r1, r2) => ({ a, b, r1, r2, ba: v3.sub(b, a), l2: v3.dot(v3.sub(b, a), v3.sub(b, a)),
    lo: a.map((v, i) => Math.min(v, b[i])), hi: a.map((v, i) => Math.max(v, b[i])), rm: Math.max(r1, r2) });
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
  // smax(f, s - capD, k) is exactly f where capD >= s + k - f; the distance to the segment's box less the largest
  // radius never exceeds capD, so far from a cut (most of the organ) it is skipped
  function carve(f, c, s, k, x, y, z) {
    const m = s + k - f + c.rm;
    if (m <= 0) return f;
    const dx = Math.max(c.lo[0] - x, 0, x - c.hi[0]), dy = Math.max(c.lo[1] - y, 0, y - c.hi[1]), dz = Math.max(c.lo[2] - z, 0, z - c.hi[2]);
    return dx * dx + dy * dy + dz * dz >= m * m ? f : smax(f, s - capD(c, x, y, z), k);
  }
  function cut(f, x, y, z) {
    if (f > 0.06) return f;
    f = carve(f, GB, 0.008, 0.035, x, y, z);
    f = carve(f, TERES, 0, 0.02, x, y, z);
    return carve(f, IVC, 0, 0.04, x, y, z);
  }
  function field(x, y, z) { column(x, y); return cut(Math.max(cD, z - cF, cB - z), x, y, z); }
  const grad = (p, e = 0.004) => [field(p[0] + e, p[1], p[2]) - field(p[0] - e, p[1], p[2]),
    field(p[0], p[1] + e, p[2]) - field(p[0], p[1] - e, p[2]), field(p[0], p[1], p[2] + e) - field(p[0], p[1], p[2] - e)].map(g => g / (2 * e));

  // the surface: surface nets on a grid, each vertex pulled onto the surface; smooth normals from the faces
  const surf = (function () {
    const h = 0.018, lo = [-0.93, -0.6, -0.52], n = [101, 64, 52], F = new Float32Array(n[0] * n[1] * n[2]);
    const id = (i, j, k) => (i * n[1] + j) * n[2] + k, OC = new Uint8Array(n[0] * n[1]);   // OC: columns all outside
    for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) {
      const x = lo[0] + i * h, y = lo[1] + j * h, o = id(i, j, 0);
      column(x, y);
      if (cD > 0.06) { F.fill(cD, o, o + n[2]); OC[i * n[1] + j] = 1; continue; }
      for (let k = 0; k < n[2]; k++) { const z = lo[2] + k * h; F[o + k] = cut(Math.max(cD, z - cF, cB - z), x, y, z); }
    }
    const VI = new Int32Array(n[0] * n[1] * n[2]).fill(-1), P = [], cv = new Float64Array(8);
    const EG = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7], si = n[1] * n[2], sj = n[2];
    const CO = [0, si, sj, si + sj, 1, si + 1, sj + 1, si + sj + 1];   // the corners' offsets (bit 0 i, bit 1 j, bit 2 k)
    const oc = (i, j) => OC[i * n[1] + j];
    for (let i = 0; i < n[0] - 1; i++) for (let j = 0; j < n[1] - 1; j++) {
      if (oc(i, j) & oc(i + 1, j) & oc(i, j + 1) & oc(i + 1, j + 1)) continue;
      for (let k = 0; k < n[2] - 1; k++) {
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
    }
    const I3 = [], quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I3.push(a, c, b, a, d, c); else I3.push(a, b, c, a, c, d); };
    for (let i = 0; i < n[0] - 1; i++) for (let j = 0; j < n[1] - 1; j++) {
      if (oc(i, j) & oc(i + 1, j) & oc(i, j + 1)) continue;
      for (let k = 0; k < n[2] - 1; k++) {
        const in0 = F[id(i, j, k)] < 0;
        if (j > 0 && k > 0 && in0 !== F[id(i + 1, j, k)] < 0) quad(VI[id(i, j - 1, k - 1)], VI[id(i, j, k - 1)], VI[id(i, j, k)], VI[id(i, j - 1, k)], !in0);
        if (i > 0 && k > 0 && in0 !== F[id(i, j + 1, k)] < 0) quad(VI[id(i - 1, j, k - 1)], VI[id(i - 1, j, k)], VI[id(i, j, k)], VI[id(i, j, k - 1)], !in0);
        if (i > 0 && j > 0 && in0 !== F[id(i, j, k + 1)] < 0) quad(VI[id(i - 1, j - 1, k)], VI[id(i, j - 1, k)], VI[id(i, j, k)], VI[id(i - 1, j, k)], !in0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    g.setIndex(I3);   // three.js picks 16-bit indices when they fit
    g.computeVertexNormals();
    g.computeBoundingBox();
    let vin = 0; for (let q = 0; q < F.length; q++) if (F[q] < 0) vin++;
    g.userData.vol = vin * h * h * h;   // the organ's volume, for the patches' first step
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
  // the coarsest step that still leaves at least 3,000 inside (from the volume, then corrected by the count's cube
  // root; within 0.5 % above is enough); then the few nearest the surface go, so exactly 3,000 stay
  let LAT = null;
  { let hp = Math.cbrt(surf.userData.vol / TARGET);
    for (let it = 0; it < 12 && !(LAT && LAT.cells.length / 3 <= TARGET * 1.005); it++) {
      const L = lattice(hp), n = L.cells.length / 3;
      if (n >= TARGET && (!LAT || n < LAT.cells.length / 3)) LAT = L;
      hp *= n >= TARGET ? Math.cbrt(n / TARGET) * 0.9995 : Math.min(Math.cbrt(n / TARGET), 0.998);
    }
    while (!LAT) { hp *= 0.98; const L = lattice(hp); if (L.cells.length / 3 >= TARGET) LAT = L; }
    const keep = [...LAT.fv.keys()].sort((p, q) => LAT.fv[p] - LAT.fv[q]).slice(0, TARGET).sort((p, q) => p - q);
    LAT.cells = keep.flatMap(c => LAT.cells.slice(3 * c, 3 * c + 3)); }
  const HP = LAT.hp, N = LAT.cells.length / 3, PP = new Float32Array(3 * N);
  const DIMS = LAT.hi.map((v, c) => v - LAT.lo[c] + 1), IDX = new Int32Array(DIMS[0] * DIMS[1] * DIMS[2]).fill(-1);
  const lid = (i, j, k) => ((i - LAT.lo[0]) * DIMS[1] + (j - LAT.lo[1])) * DIMS[2] + (k - LAT.lo[2]);
  // each node is drawn somewhere inside its own grid cell, not at the grid point: one per cell keeps them evenly
  // spread, and no rows of nodes line up from any side. Near the surface the shift is halved (up to three times,
  // then none) until the node is as far inside as its grid point had to be
  for (let n = 0; n < N; n++) {
    const i = LAT.cells[3 * n], j = LAT.cells[3 * n + 1], k = LAT.cells[3 * n + 2];
    const di = 0.7 * (R() - 0.5), dj = 0.7 * (R() - 0.5), dk = 0.7 * (R() - 0.5);
    let p = null;
    for (let s = 1; s >= 0.1 && !p; s *= 0.5) { const q = gp(i + s * di, j + s * dj, k + s * dk, HP); if (field(q[0], q[1], q[2]) < -0.3 * HP) p = q; }
    PP.set(p || gp(i, j, k, HP), 3 * n); IDX[lid(i, j, k)] = n;
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
    uLinkC: { value: new THREE.Color(...LINKC) }, uFrontC: { value: new THREE.Color(...FRONTC) } };
  const LOOK = `
uniform float uA, uGrow, uLinks, uTop; uniform vec3 uHubC, uLinkC, uFrontC;
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
      transparent: true, depthWrite: false, side: o.side || THREE.DoubleSide, blending: THREE.AdditiveBlending,
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
  // its near side, and its far side fainter (drawn double sided at one strength, from below it looked hollow)
  const SHELL = { face: 0.025, rim: 0.5, dif: 0.12, band: 0.05 };
  const shellMat = glass(COL, Object.assign({ side: THREE.FrontSide }, SHELL)), backMat = glass(COL, Object.assign({ side: THREE.BackSide }, SHELL));
  const shell = new THREE.Mesh(surf, shellMat), back = new THREE.Mesh(surf, backMat);
  shell.renderOrder = back.renderOrder = 1;
  body.add(back, shell);
  // the gallbladder in its bed (bile green, faint): a pear from the fundus to the neck, and the cystic duct
  const gbMat = glass(K.rgb('#9ad66a'), { face: 0.03, rim: 0.45, dif: 0.08, fade: [0.02, 0.16, 0.3] });   // its body and neck, up under the liver, stay faint
  {
    const prof = [];
    for (let s = 0; s <= 24; s++) {
      const u = s / 24, r = u < 0.25 ? 0.074 * Math.sin(Math.acos(1 - u / 0.25)) : lerp(0.074, 0.036, smooth((u - 0.25) / 0.75));
      prof.push(new THREE.Vector2(Math.max(r, 0.0001), -0.074 + u * (v3.dist(GB_F, GB_N) + 0.074)));
    }
    prof.push(new THREE.Vector2(0.012, v3.dist(GB_F, GB_N) + 0.03), new THREE.Vector2(0.011, v3.dist(GB_F, GB_N) + 0.09), new THREE.Vector2(0.0001, v3.dist(GB_F, GB_N) + 0.092));
    const g = new THREE.LatheGeometry(prof, 20);
    const m = new THREE.Mesh(g, gbMat);
    m.position.set(...GB_F);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...v3.norm(v3.sub(GB_N, GB_F))));
    body.add(m);
  }
  // the falciform ligament: up the front from the round ligament's notch and over the dome, where it fades; traced on
  // the surface in a plane that leans a little to the right (the patient's right)
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
varying vec3 vC; varying float vA, vHub, vRing;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float g = uGrow * 1.1, ap = smoothstep(aI.y, aI.y + 0.05, g), fl = uGrow < 0.999 ? exp(-pow((g - aI.y - 0.035) / 0.045, 2.0)) : 0.0;
  float hub = aI.z * uTop, rest = uTop * (1.0 - aI.z), pulse = 0.75 + 0.25 * sin(uTime * 1.6 + aI.w * 6.2832);
  vec3 c = hot(aI.x) * (1.0 - 0.3 * uLinks) * (0.9 + 0.1 * sin(uTime * 1.1 + aI.w * 40.0));
  // with the hubs shown the rest turn grey and dim; a hub keeps its own colour (its uptake) and gets an amber ring
  c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), 0.7 * rest);
  c = mix(c, uFrontC * 0.7, fl * 0.85);   // the growing front: cyan (not white), so it never reads as the hottest tissue
  float br = mix(1.0, 0.28, rest) * (1.0 + 0.3 * hub) * (1.0 + 0.25 * fl);
  float sz = uSz * (1.0 + 0.6 * hub) * (1.0 - 0.3 * rest) * (1.0 + 0.5 * fl) * ap;
  // up close (as in a headset) points shrink with distance and never grow beyond about two degrees
  float sc = length(modelViewMatrix[0].xyz), dl = -mv.z / sc;
  gl_PointSize = min(pointPx(sz * clamp(dl / 1.4, 0.5, 1.0), mv), 0.035 * (1.0 + 0.6 * hub) * uPx * projectionMatrix[1][1] / sc);
  vC = c * br * depthCue(mv); vHub = hub; vRing = hub * pulse; vA = uA * ap;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform vec3 uHubC;
varying vec3 vC; varying float vA, vHub, vRing;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  // a hub's disc is larger: its own colour fills the inner part (as large as any patch), the ring the outer part
  float e = d * (1.0 + 0.6 * vHub), core = smoothstep(0.65, 0.1, e), halo = pow(max(1.0 - e, 0.0), 2.0);
  float ring = vRing * smoothstep(0.58, 0.72, d) * smoothstep(1.0, 0.86, d);
  gl_FragColor = vec4(vC * (0.65 + 0.5 * core) * (1.0 - ring) + uHubC * 1.2 * ring, vA * (core * 0.6 + halo * 0.35 + ring * 0.85));
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
  vC = c * br * depthCue(mv); vS = aL.x; vPh = ph; vA = uA * on;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // hidden: both ends share 'on', so the whole line goes
  // up close each line covers fewer others: the strong ones grow brighter, the weak ones step back
  float near = clamp((2.6 * length(modelViewMatrix[0].xyz) / -mv.z - 1.0) / 1.5, 0.0, 1.0);
  vA *= mix(1.0, mix(0.7, 1.6, aL.y), near);
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
  // an anchor turns with the spin; it returns the same array each time (the engine copies it)
  const at = p => { const x = p[0] - C0[0], z = p[2] - C0[2], o = [x, p[1] - C0[1], z];
    return () => { const c = Math.cos(ang), s = Math.sin(ang); o[0] = x * c + z * s; o[2] = -x * s + z * c; return o; }; };
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
    web: at(surfAt(WARM, [0.1, -0.2, 1])),                          // where the links crowd, on the front
  };
  const labels = [
    { text: [fmt(N) + ' patches', ''], at: 'right', alpha: S => prog(S.liver_grow, 0.55, 0.85) * (1 - prog(S.liver_links, 0.1, 0.35)) },
    { text: ['Links:', 'uptake ratio above the threshold'], at: 'web', cls: 'cyn', alpha: S => prog(S.liver_links, 0.35, 0.65) * prog(S.liver_grow, 0.7, 0.95) * (1 - prog(S.liver_top, 0.1, 0.4)) },
    { text: ['Best connected', 'the top 5 % of patches'], at: 'top', cls: 'amb', alpha: S => prog(S.liver_top, 0.45, 0.8) * prog(S.liver_grow, 0.7, 0.95) },
  ];
  const API = Object.freeze({ patches: N, links: NL, theta: THETA, hubs: NH, step: Math.round(HP * 1e5) / 1e5, pairs: NP,
    meanLinks: Math.round(20 * NL / N) / 10, maxLinks: DEG[ORDER[0]] });
  const num = (v, d) => (v === undefined ? d : v);
  return Object.assign(set, {
    params: { liver_a: 1, liver_grow: 1, liver_links: 1, liver_top: 0, liver_spin: 0 },
    update(S) {
      ang = num(S.liver_spin, 0) * Math.PI * 2;
      spin.rotation.y = ang;
      const g = sat(num(S.liver_grow, 1)), l = sat(num(S.liver_links, 1)), tp = sat(num(S.liver_top, 0));
      U.uGrow.value = g; U.uLinks.value = l; U.uTop.value = tp;
      // the organ steps back for the links and the hubs, and stands out a little while it is empty
      const k = (1 - 0.35 * l - 0.25 * tp) * (1 + 0.4 * (1 - g));
      shellMat.uniforms.uK.value = k; backMat.uniforms.uK.value = 0.45 * k;
      gbMat.uniforms.uK.value = ligMat.uniforms.uK.value = 1 - 0.5 * l - 0.3 * tp;
      pts.visible = g > 0.001; lns.visible = g > 0.001 && l > 0.001;   // nothing to draw: no draw call
    },
    anchors,
    labels,
    cam: {
      default: [-16, 9, 3.4, 0, -0.02, 0],   // (back a little: the right lobe reached the screen's edge)
      front: [0, 3, 3.1, 0, 0, 0],
      close: [-34, 12, 1.7, ...at(WARM)()],   // for liver_spin 0
      below: [-12, -52, 3.1, 0, -0.05, 0],
      side: [-90, 6, 3.0, 0, 0, 0],
    },
    controls: [{ key: 'view', label: 'View', options: [['patches', 'Patches'], ['links', 'Links'], ['hubs', 'Hubs']] }],
    explore(c) { return { liver_grow: 1, liver_links: c.view === 'patches' ? 0 : 1, liver_top: c.view === 'hubs' ? 1 : 0, liver_spin: 0 }; },
    api() { return API; },
  });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['scan', 'body', 'organs', 'liver'];
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
  // lit sets (the scanner, the tour's body, the organs' shells ...) share one sky light and a light from over your shoulder
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
// on a screen narrower than square (a phone held upright) a wide view stands further back: GL.nf is the view's own
// factor (NARROW in the story; 1 for most views), taken in full at half as wide as tall
GL.nf = 1;
const narrowK = () => (GL.wide || !(GL.nf > 1) ? 1 : 1 + (GL.nf - 1) * clamp((1 - (GL.aspect || 1)) / 0.5, 0, 1));
// (v[7..9]: the target's shift clear of the side panel, FIT in the story; on a screen without a side panel it goes back)
function applyCamera(v) {
  const u = GL.wide ? 0 : 1;
  viewDir(v, _vd); _vt.set(v[3] - u * (v[7] || 0), v[4] - u * (v[8] || 0), v[5] - u * (v[9] || 0));
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * (GL.fit || 1) * narrowK());
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
  GL.wide = wide; GL.aspect = w / h;
  if (wide) camera.setViewOffset(w, h, -0.14 * w, 0, w, h);
  else camera.setViewOffset(w, h, 0, 0.21 * h, w, h);
  // (on a narrow screen held sideways the panel leaves only a strip above it, about 0.56 h - 122 px tall: the scene
  // stands back far enough to fit that strip, in full from 1.2 : 1 on; upright screens keep their own framing)
  const strip = Math.max(0.12, (0.56 * h - 122) / h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1.5 / (w / h) * 0.62, 0.9 / strip * clamp((w / h - 0.6) / 0.6, 0, 1));
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
  [0, 0], [1.3, 1.2], [3.1, 2.4], [5.8, 4], [12.9, 9],  // Intro
  [23.6, 16], [24.2, 16.6], [25.1, 17.2], [25.8, 17.8], [33.6, 20.5], [46.9, 29], [47.6, 29.6],
  [51.8, 30.5], [52.5, 31.1], [60.3, 33.5], [60.9, 34.1], [68.7, 37], [69.4, 37.6], [83.4, 43],
  [90.5, 47], [91.2, 47.6],                           // Scanner
  [108.4, 52], [109.7, 53.18], [110.8, 53.2], [120.5, 62], [139.6, 72],  // Sugar
  [159.4, 90], [160.7, 91.18], [161.4, 91.2], [199.2, 125.6], [201.3, 126], [201.9, 126.6],  // Organs
  [205.7, 128], [207, 129.2], [215, 133], [215.7, 133.6], [236, 139], [242.2, 142],  // Network
  [246.6, 146], [247.9, 147.18], [249, 147.2], [259.3, 153], [267.7, 157], [274.8, 162],
  [275.5, 162.6], [286.9, 167], [302.9, 177], [310, 181], [310.7, 181.6], [325.6, 185],
  [326.2, 185.6], [335.8, 188], [336.5, 188.6],       // Health
  [352.7, 192], [354, 193.18], [355.2, 193.2], [364.5, 198], [365.2, 198.6], [381, 204],
  [390.8, 209.5], [391.4, 210.1], [405.5, 212], [408.3, 214.6], [422.4, 217],  // Vision
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
  { key: 'cohort', name: 'Network', a: 128, b: 146 },
  { key: 'health', name: 'Health', a: 146, b: 192 },
  { key: 'vision', name: 'Vision', a: 192, b: 217 },
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
// (with the story's own framing on top: FIT)
const view = (k, name) => {
  const c = GL.sets[k].cam, v = (c[name] || c.default).slice(), f = c[name] && FIT[k] && FIT[k][name];
  if (f) for (let i = 0; i < f.length; i++) v[i] += f[i];
  return v;
};
// the part of a view's FIT that moves its target clear of the side panel: on a screen without one (a phone, a narrow
// window) applyCamera takes it back, so the view stays centred there
const fitShift = (k, name) => { const f = GL.sets[k].cam[name] && FIT[k] && FIT[k][name]; return f ? [f[3] || 0, f[4] || 0, f[5] || 0] : [0, 0, 0]; };
// views whose parts reach under the side panel or off the right edge on a landscape screen: a little further back,
// or their target moved, so they fit beside the panel (added to the set's own view, in story and explore mode alike)
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline)
const FIT = { scan: { vision: [0, 0, 3.3, -0.75] }, body: { default: [0, 0, 0.55] }, organs: { default: [0, 0, 0.55], strength: [0, 0, 0.9, -0.25] },
  liver: { default: [0, 0, 0.15, -0.22] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen (the vision row; the network with its chart)
const NARROW = { scan: { vision: 1.32 }, body: { front: 1.1 }, organs: { net: 1.3, strength: 1.45, matrix: 1.15, bars: 1.1 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The paper's numbers (PET_DATA), looked up once for the story and the panels. The networks read off
// the figures may still be empty (no links yet): everything here works with any subset of organs and any number of links.
const PD = (() => {
  const D = PET_DATA, byId = {};
  D.organs.forEach((o, i) => { byId[o.id] = Object.assign({ i }, o); });
  return { D, byId, ids: D.organs.map(o => o.id), nets: Object.fromEntries((D.nets || []).map(n => [n.id, n])) };
})();
const netOf = id => PD.nets[id] || null;
const edgesOf = id => { const n = netOf(id); return n && Array.isArray(n.edges) ? n.edges : []; };
const hasNet = id => edgesOf(id).length > 0;
// a network's hubs, as the organs set draws them: only those the paper marks (its orange nodes); never ones computed
// from the links (they differ: the paper marks none in the network of all scans)
const hubsOf = id => { const n = netOf(id); return n && Array.isArray(n.hubs) ? n.hubs : []; };
const organName = id => (PD.byId[id] ? PD.byId[id].name : String(id));
const organLow = id => { const s = organName(id); return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; };
const organCol = id => (PD.byId[id] ? PD.byId[id].col : '#9aa3b5');
// the networks the organs set can show (organs_which: an index into this list), with their short names: the eleven of
// its Network control, then the robustness tests' (the vena cava as the reference, the three doses), which only the
// Networks tab's rows show
const NET_IDS = ['full', 'FDG_healthy', 'A_low', 'A_high', 'B_low', 'B_high', 'C_low', 'C_mid', 'C_high', 'HK2', 'GLUT'];
const NET_EXTRA = ['vena', 'dose_standard', 'dose_ultralow', 'dose_virtual'];
const NET_ALL = NET_IDS.concat(NET_EXTRA);
const NET_SHORT = ['All scans', `FDG, ${((netOf('FDG_healthy') || {}).organs || []).length} organs`, 'BMI low', 'BMI high', 'Tumour low', 'Tumour high', 'CRP low', 'CRP mid', 'CRP high', 'HK2', 'GLUT',
  'Vena cava', 'Standard dose', 'Ultra-low dose', 'Virtual low dose'];
const netShort = id => NET_SHORT[NET_ALL.indexOf(id)] || String(id);
// Table 2's comparisons whose groups the paper drew as networks (Figures 2A and 3): one network per group, or null.
// (Figure 4's healthy FDG network uses only the organs GTEx has too, so it belongs with the protein networks, Table 3.)
function rowNets(r) {
  if (!r) return [];
  const m = r.what === 'BMI' && /healthy/.test(r.cohort) ? ['A_low', 'A_high'] : r.what === 'Tumour load' ? ['B_low', 'B_high']
    : r.what === 'CRP' && /thirds/.test(r.cohort) ? ['C_low', 'C_mid', 'C_high'] : r.what === 'Blood pool' ? ['full', 'vena']
    : r.what === 'Dose' ? ['dose_standard', 'dose_ultralow', 'dose_virtual'] : [];
  return r.groups.map((g, i) => m[i] || null);
}
const rowOfNet = id => PD.D.table2.findIndex(r => rowNets(r).includes(id));
// the comparison a network stands for (none for the network of all scans: it is no comparison, only the reference of the
// blood-pool test)
const cmpOfNet = id => (id === 'full' ? -1 : rowOfNet(id));
// a network in a line: its group of Table 2, or what Figure 4 drew
function netTitle(id) {
  const n = netOf(id), ri = rowOfNet(id), r = PD.D.table2[ri];
  if (!n) return '';
  if (id === 'full' || id === 'vena') return `All ${fmt(PD.D.cohort.scans)} scans, every organ divided by the ${id === 'vena' ? 'vena cava' : 'aorta'} (Figure 2A, printed)`;
  if (r) { const g = r.groups[rowNets(r).indexOf(id)]; return `${r.what}, ${r.cohort.replace(/, split at the median.*$/, '')}: ${g.label} (${g.n} ${r.what === 'Dose' ? 'people' : 'scans'}; Figure ${n.fig}, read off, approximate)`; }
  if (id === 'FDG_healthy') return `FDG in the ${PD.D.cohort.healthy} scans of healthy volunteers, on the ${(n.organs || []).length} organs GTEx has too (Figure 4, read off, approximate)`;
  const t3 = PD.D.table3.find(x => PROT_NET(x) === id);
  return t3 ? `${t3.name}: from its gene's activity in the tissues of ${fmt(PD.D.cohort.gtex)} people (GTEx; Figure 4, read off, approximate)` : n.title || id;
}
// Table 3's protein networks drawn in Figure 4
const PROT_NET = r => (r.kind === 'fdg' ? 'FDG_healthy' : /HK2/.test(r.name) ? 'HK2' : /GLUT/.test(r.name) ? 'GLUT' : null);

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
    weeks: retest ? num((/(\d+)\s*weeks/.exec(retest.cohort) || [])[1]) : null,
    robust: D.table2.filter(r => r.part === 'test'), hk2: D.table3.find(r => /HK2/.test(r.name)) || null, tested: D.table3.filter(r => r.kind !== 'fdg').length,
    year: num((/\((\d{4})\)/.exec(D.source.paper) || [])[1]),
  };
})();
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'][n] || String(n);
const Word = n => { const w = word(n); return w.charAt(0).toUpperCase() + w.slice(1); };
const dis = v => (Number.isFinite(+v) ? (+v).toFixed(2) : '–');
// 'MOOSE (nnU-Net)' -> 'MOOSE, an nnU-Net model'
const segName = s => { const m = /^(.*?)\s*\((.*)\)\s*$/.exec(s || ''); return m ? `${m[1]}, an ${m[2]} model` : String(s || ''); };
// colours as text on the HTML panel, which is light in the light theme: an organ's or a group's colour mixed with the
// panel's ink (darker on a light panel, lighter on a dark one); the poster's light grey (its black, on our dark ground)
// is the ink itself. The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => (/^#d9dde6$/i.test(c) ? 'var(--ink)' : `color-mix(in srgb, ${c} 55%, var(--ink))`);
const swCol = c => (/^#d9dde6$/i.test(c) ? 'var(--ink)' : c);   // a swatch or a bar in the same colour
const pct = v => (Number.isFinite(+v) ? `${+v}%` : '–');

// the story's own networks, in the order it shows them (one that has no links yet is skipped: the network stays)
function buildStory() {
  const F = FACTS, R = F.row;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // jump an index param (an organ, a pair, a group) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const oi = id => (PD.byId[id] ? PD.byId[id].i + 1 : 0);   // organs_focus for an organ
  const wi = id => NET_ALL.indexOf(id);                      // organs_which for a network
  const gD = (r, i) => (r && r.groups[i] ? pct(r.groups[i].density) : '–'), gO = (r, i) => (r && r.groups[i] ? dis(r.groups[i].disorder) : '–');
  const step = (id, at, text) => `<li data-at="${at}" data-col="${organCol(id)}" style="border-left-color:${swCol(organCol(id))}"><b style="color:${inkCol(organCol(id))}">${esc(organName(id))}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">One scan, one system</h1>
      <p class="lede" data-at="2.4">the body as a metabolic network</p>
      <p data-at="4">From one PET scan to a network of organs: what it says about health and disease.</p>
      <p class="note" data-at="9">After a paper in Med${F.year ? ` (${F.year})` : ''} and a poster from the Division of Nuclear Medicine, Medical University of Vienna, and the LBI for Network Medicine.</p>`,
    scanner: `<h2 data-at="0.6">Seeing sugar</h2>
      ${turns(`<p data-at="1.2" data-out="12.5">A PET scan (positron emission tomography) starts with a sugar. FDG (fluorodeoxyglucose) is a glucose look-alike carrying radioactive fluorine-18.</p>
        <p data-at="4.5" data-out="12.5">After at least ${F.fasting} hours without food, it goes into a vein. For about ${F.rest} minutes the person rests: cells take it up like glucose, and an enzyme, hexokinase, traps it inside.</p>`,
      `<p data-at="13">Then the scan. Around the tunnel sits a ring of detectors.</p>
        <ul class="steps">
          <li data-at="14.5"><b>A positron</b>fluorine-18 decays and sends one out (the electron's antimatter twin); it travels about a millimetre (drawn larger here)</li>
          <li data-at="17.5"><b>Two photons</b>it meets an electron and both vanish: two gamma photons of 511 keV (kiloelectronvolts) fly off in opposite directions</li>
          <li data-at="21"><b>A coincidence</b>two detectors on opposite sides of the ring register both within a few billionths of a second; the line between them, the line of response, passes close to where the sugar is</li>
        </ul>`)}
      <p data-at="27" class="amber">Millions of such lines make the image: a map of where the body takes up sugar.</p>
      <p class="credits" data-at="31">The uptake is measured as the SUV, the standardised uptake value: the tracer in a tissue divided by the dose per kilogram of body weight (1 would be an even spread). Protocol as in the paper: ${F.dose[0]} to ${F.dose[1]} MBq (megabecquerels) of FDG.</p>`,
    body: `<h2 data-at="0.6">Where the sugar goes</h2>
      <p data-at="1.2">The tracer arrives with the blood, and within the hour it settles where cells use sugar.</p>
      <p data-at="10">The brain takes up the most, and the heart often does too (how much varies from person to person). The kidneys and the bladder glow too: FDG is filtered into the urine and not taken back, so it leaves the body that way.</p>
      <p data-at="20">A tumour shows as a hot spot. Such spots are mostly what a scan is read for.</p>
      <p data-at="29" class="amber">Yet the scan holds every organ's metabolism at once.</p>`,
    organs: `<h2 data-at="0.6">Every organ, measured</h2>
      ${turns(`<p data-at="1.2" data-out="22.5">An AI (${esc(segName(F.seg))}) outlines up to ${F.organs} organs in each scan, in 3D, and a doctor checks them (not every organ is in every scan).</p>
        <p data-at="14" data-out="22.5">Each organ's uptake is divided by that of the aorta: the blood pool, the same reference in every scan.</p>`,
      `<ul class="steps">
          ${step('brain', 23, `${esc(PD.byId.brain.measure)}: it lives on sugar`)}
          ${step('liver', 27, esc(PD.byId.liver.measure))}
          ${step('muscle', 31, `${esc(PD.byId.muscle.measure)}${/gluteus/i.test(PD.byId.muscle.measure) ? ' (the buttock muscle)' : ''}`)}
        </ul>`)}
      <p data-at="35" class="amber">One scan, one row of numbers.</p>
      <p class="credits" data-at="36">The organs' values shown here are typical uptakes, for illustration.</p>`,
    cohort: `<h2 data-at="0.6">${fmt(F.scans)} scans</h2>
      ${turns(`<p data-at="1.2" data-out="4.5">The paper used ${fmt(F.scans)} scans of ${fmt(F.subjects)} people: ${F.healthy} of healthy volunteers and ${F.cancer} of people with cancer (${F.lung} lung, ${F.hnscc} head and neck).</p>`,
      `<p data-at="5">Which organs rise and fall together across people? Two are linked when they still do once all the others are taken into account (a partial correlation), and that is unlikely to be chance (p &lt; ${F.p}): blue where they rise together, red where one rises as the other falls.</p>
        <p data-at="11" class="amber">The network of all ${fmt(F.scans)} scans: ${F.f2n} organs, ${F.links} links${Number.isFinite(+F.density) ? `, a density of ${pct(F.density)} (more on that next)` : ''}.</p>
        <p class="credits" data-at="14">Figure 2A of the paper.</p>`)}`,
    health: `<h2 data-at="0.6">From health to disease</h2>
      ${turns(`<p data-at="1.2" data-out="15.5">Split the scans into groups, and give each group its own network.${R.cancer ? ` Healthy people's is dense: ${gD(R.cancer, 0)} of the most possible, against ${gD(R.cancer, 1)} with cancer.` : ''}</p>
        ${R.bmi ? `<p data-at="7" data-out="15.5">Weight, in healthy people: a density of ${gD(R.bmi, 0)} below the median BMI (body mass index: weight for height), ${gD(R.bmi, 1)} above it.</p>
        ${hubsOf('A_high').includes('brain') ? '<p data-at="11" data-out="15.5">Above it, the brain becomes a hub: an organ with far stronger links than the rest.</p>' : ''}` : ''}`,
      `<p data-at="16" data-out="34.5">Two measures. Density: all links' strength together, as a share of the most possible. Disorder: how unevenly that strength is spread, from 0 (even) up (a few hubs).</p>
        ${R.crp ? `<p data-at="21" data-out="34.5" class="amber">Inflammation (CRP, C-reactive protein, a marker of it in the blood; in thirds): density ${listOf(R.crp.groups.map(g => pct(g.density)))}; disorder ${listOf(R.crp.groups.map(g => dis(g.disorder)))}. In the sparse networks of the less healthy groups, muscle and subcutaneous fat dominate${hubsOf('C_high').includes('muscle') ? '; here muscle becomes a hub' : ''}.</p>` : ''}
        ${R.norepi && R.tumour ? `<p data-at="31" data-out="34.5">Stress (norepinephrine, a stress hormone, in ${R.norepi.groups.reduce((s, g) => s + g.n, 0)} healthy people: ${gD(R.norepi, 0)} against ${gD(R.norepi, 1)}) and tumour load (${gD(R.tumour, 0)} against ${gD(R.tumour, 1)}) thin it too.</p>` : ''}`,
      `${F.robust.every(r => !r.sigD && !r.sigO) ? `<p data-at="35">And it holds: ${F.weeks ? `two scans within ${F.weeks} weeks, ` : ''}an ultra-low dose, another scanner, men and women, the aorta or the vena cava as the reference: none made a significant difference, though some groups were small (${Math.min(...F.robust.flatMap(r => r.groups.map(g => g.n)))} people).</p>` : ''}
        ${F.hk2 ? `<p data-at="39">Of ${F.tested} networks built from genes' activity in the tissues of ${fmt(F.gtex)} people, only that of hexokinase 2, an enzyme that traps FDG, resembles FDG's (r = ${F.hk2.r}).</p>` : ''}
        <p class="credits" data-at="42">Table 2 and Figures 3 and 4 of the paper; networks other than that of all scans read off its figures.${R.cancer ? ` Disorder: ${gO(R.cancer, 0)} healthy, ${gO(R.cancer, 1)} with cancer.` : ''} A hub: an organ whose strength is more than ${F.hubZ} standard deviations above the network's average (z-score).</p>`)}`,
    vision: `<h2 data-at="0.6">One scan, one system</h2>
      ${turns(`<p data-at="1.2" data-out="17">One day, one routine scan might show how a whole body is doing: what lies ahead, and which medication might help.</p>
        <p data-at="6" data-out="17">Muscle and fat could become targets for treatment (they respond to GLP-1 drugs, for blood sugar and weight), and the networks a way to follow how drugs such as metformin, statins and SGLT2 inhibitors act on metabolism.</p>
        <p data-at="12" data-out="17" class="amber">A measure of health, not only of disease. It still has to be proven in larger studies that follow people over time.</p>`,
      `<p data-at="17.5">Poster: Barbara K Geist, Alexander Grentner, Joel Fischer, Josef Yu, Dato Tsomaia, Adna Smajlovic, Stefan Grünert and Marcus Hacker: Division of Nuclear Medicine, Medical University of Vienna, and the LBI for Network Medicine.</p>
        <p data-at="20"><button class="btn primary" id="btnGoExplore" type="button">Explore the networks</button></p>
        <p class="credits" data-at="22">Geist et al., The metabolic organ connectome, Med${F.year ? ` (${F.year})` : ''}; poster: Shaping a New Era in Nuclear Medicine. Networks of all ${fmt(F.scans)} scans: printed in the paper; other networks read off its figures. Organ values: illustrative.</p>`)}`,
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
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  start({ scan_vision: 1, scan_bed: 0, scan_pass: 0, scan_cut: 0, scan_events: 0, scan_lines: 0, scan_image: 0,
    body_pet: 0, body_net: 0, body_state: 0, body_blank: 0,
    organs_seg: 0, organs_suv: 0, organs_focus: 0, organs_lesion: 0, organs_rows: 0, organs_pair: 0, organs_partial: 0, organs_net: 0, organs_which: 0, organs_prev: 0, organs_mix: 1, organs_strength: 0 });
  let a, b;
  // Intro: the vision row (scanner, body, network, prognosis, medication), then it draws back into the scanner
  a = C.title.a; b = C.title.b;
  show('scan', 0.2, 2.5, C.body.a + 0.3, C.body.a + 2.3);
  ramp('scan_vision', a + 10, a + 15, 1, 0);
  cam(a, 'scan', 'vision', -8);
  cam(a + 9.5, 'scan', 'vision', 4, 'spin');
  cam(b - 0.5, 'scan', 'default', -12);
  // Seeing sugar: the couch slides in, the skin opens on the ring, events, lines of response, then the image
  a = C.scanner.a; b = C.scanner.b;
  ramp('scan_bed', a + 1, a + 7, 0, 1);
  ramp('scan_cut', a + 9, a + 12, 0, 1);
  ramp('scan_events', a + 12, a + 13.5, 0, 0.3); ramp('scan_events', a + 21, a + 24, 0.3, 1);
  ramp('scan_lines', a + 16, a + 27, 0, 1);
  ramp('scan_pass', a + 14, a + 32, 0, 0.6);   // the couch moves on through the ring as the counts come in
  ramp('scan_image', a + 27, a + 33, 0, 1);
  ramp('scan_events', a + 30, a + 34, 1, 0.4);
  cam(a + 1, 'scan', 'default', -4);
  cam(a + 8, 'scan', 'default', 10, 'spin');
  cam(a + 12.5, 'scan', 'ring');   // (once the skin is off: the ring view is inside the housing)
  cam(a + 20, 'scan', 'ring', 14, 'spin');
  cam(a + 24, 'scan', 'front', 0, null, [0, 4, -2.6]);
  cam(a + 28, 'scan', 'ring', 35);
  // (the image from above the couch: from inside the bore the body set's image is coarse)
  cam(a + 32, 'scan', 'ring', 2, null, [0, 6, 0.8, 0, -0.08, 0.4]);
  cam(b - 0.5, 'scan', 'ring', 14, 'spin', [0, 6, 0.8, 0, -0.08, 0.4]);
  // Where the sugar goes: the standing body, the tracer arriving, the hot organs, then a tumour
  a = C.body.a; b = C.body.b;
  show('body', a + 0.3, a + 2.3);
  ramp('body_a', C.vision.a, C.vision.a + 2, 0.55, 0);   // (dimmed under the organs from their chapter on)
  ramp('body_pet', a + 1.5, a + 10, 0, 1);
  show('organs', a + 18, a + 20, C.vision.a, C.vision.a + 2);
  ramp('organs_lesion', a + 19, a + 21, 0, 1);
  cam(a + 2.5, 'body', 'front', -12, null, [0, 0, 0.55]);   // (a slow turn from the scanner as it fades)
  cam(a + 9.5, 'body', 'front', 6, 'spin', [0, 0, 0.55]);
  cam(a + 12, 'body', 'front', 10, null, [0, 0, -0.55, 0, 0.22, 0]);   // (not so close that the arms reach the top bar)
  cam(a + 18, 'body', 'front', 18, 'spin', [0, 0, -0.55, 0, 0.22, 0]);
  cam(a + 21, 'organs', 'lesion');
  cam(a + 28, 'organs', 'lesion', 10, 'spin');
  cam(b - 1, 'organs', 'default', -6);
  ramp('organs_lesion', b - 3, b, 1, 0);
  // Every organ, measured: the AI's outlines, slice by slice; each organ's uptake as a bar; three organs in turn
  a = C.organs.a; b = C.organs.b;
  ramp('body_a', a + 1, a + 4, 1, 0.55);
  ramp('organs_seg', a + 1, a + 12, 0, 1);
  ramp('organs_suv', a + 15, a + 21, 0, 1);
  // (the aorta glows, named, while the text divides every organ by it)
  jump('organs_focus', a + 14, 0, oi('aorta')); jump('organs_focus', a + 22, oi('aorta'), 0);
  [['brain', 23], ['liver', 27], ['muscle', 31]].reduce((f0, [id, t]) => { jump('organs_focus', a + t, f0, oi(id)); return oi(id); }, 0);
  jump('organs_focus', a + 35, oi('muscle'), 0);
  cam(a + 1, 'organs', 'seg');
  cam(a + 12, 'organs', 'seg', 12, 'spin');
  cam(a + 15, 'organs', 'bars');
  cam(a + 22, 'organs', 'bars', 6, 'spin');
  cam(b - 0.5, 'organs', 'bars', -6, 'spin');
  // 658 scans: the bars make way, and the network of all scans grows on the body
  a = C.cohort.a; b = C.cohort.b;
  ramp('organs_suv', a + 1, a + 3, 1, 0);
  ramp('organs_net', a + 3, a + 8, 0, 1);
  cam(a + 3, 'organs', 'net');
  cam(b - 0.5, 'organs', 'net', 18, 'spin');
  // From health to disease: BMI, the strength distribution, CRP thirds; robust; hexokinase 2 like FDG
  a = C.health.a; b = C.health.b;
  // the networks in turn, each from the one before (a network not read off its figure yet is skipped)
  let w = wi('full');
  // (a direct crossfade over 2 s from the network before, organs_prev, to the new one: easing organs_which would pass
  // through the networks between them in the list)
  const goNet = (id, t) => {
    if (!hasNet(id)) return;
    const n = wi(id);
    key('organs_prev', t - 0.01, w); key('organs_prev', t + 2.05, w);
    jump('organs_which', t, w, n);
    jump('organs_mix', t, 1, 0); key('organs_mix', t + 2, 1);
    w = n;
  };
  goNet('A_low', a + 7); goNet('A_high', a + 10);
  ramp('organs_strength', a + 16, a + 19, 0, 1);
  ramp('organs_strength', a + 35, a + 37, 1, 0);   // (robustness and hexokinase 2: the network alone)
  goNet('C_low', a + 21); goNet('C_mid', a + 25); goNet('C_high', a + 29);
  goNet('FDG_healthy', a + 36); goNet('HK2', a + 41.5);
  cam(a + 1, 'organs', 'net', 18);
  cam(a + 14, 'organs', 'net', 34, 'spin');
  cam(a + 17, 'organs', 'strength');
  cam(a + 34, 'organs', 'strength', 10, 'spin');
  cam(a + 37, 'organs', 'net', 20);
  cam(b - 0.5, 'organs', 'net', 34, 'spin');
  // One scan, one system: the vision row again
  a = C.vision.a; b = C.vision.b;
  show('scan', a + 1.3, a + 3.3);
  // (the scanner comes back as it was at the start: couch out, closed, no events; and as the row, after the network
  // has gone: a big scanner fading in through it showed its insides)
  for (const n of ['scan_bed', 'scan_cut', 'scan_lines', 'scan_image']) jump(n, a, 1, 0);
  jump('scan_pass', a, 0.6, 0);
  jump('scan_events', a, 0.4, 0);
  jump('scan_vision', a, 0, 1);
  cam(a + 1.5, 'scan', 'vision', -10);
  cam(b, 'scan', 'vision', 6, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts, the hubs among them; the story adds what the scene alone does not say; the body
  // set labels its organs only with its own network, so its anchors are passed as points)
  const at = (k, n) => () => anchorOf(k, n);
  a = C.body.a;
  label('body', at('body', 'brain'), '<b>Brain</b>the most sugar', a + 11, a + 18, 'amb');
  label('body', at('body', 'heart'), '<b>Heart</b>', a + 12, a + 18, 'amb');
  label('body', at('body', 'kidneys'), '<b>Kidneys</b>into the urine', a + 13.5, a + 18, 'amb');
  label('body', at('body', 'bladder'), '<b>Bladder</b>', a + 14.5, a + 18, 'amb');
  label('organs', 'lesion', '<b>A tumour</b>a hot spot', a + 21, a + 30, 'amb');
  // (the health chapter opens on the network of all scans: the paper drew none for healthy against cancer, so the two
  // densities the text quotes stand by its title)
  if (R.cancer) label('organs', at('organs', 'title'), `<b>Healthy ${gD(R.cancer, 0)} · cancer ${gD(R.cancer, 1)}</b>density; no network drawn for them`, C.health.a + 1.5, C.health.a + 7, 'amb');
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set, narrow factor, FIT's target shift]; 'spin' segments turn at
// a steady pace.
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
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[9] || 1, w[10]];
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
    const [b, r] = L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${sfxSpan(r)}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1 });
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
// Explore mode: the paper's comparisons and networks, its organs; or any scene with its own controls (the liver, an
// organ as a network of patches, only here).
const SCENES = [
  ['scan', 'Scanner', 'A PET/CT scanner, cut open: the ring of detectors, the events (a positron, two gamma photons, a line of response) and the image they build. Life size stands it in front of you.'],
  ['body', 'Body', 'A whole-body PET scan: the tracer arriving with the blood, settling where cells use sugar and leaving in the urine (the PET body of the tour).'],
  ['organs', 'Organs', `The paper's organs in the scan: their outlines, their uptakes, the matrix of ${fmt(FACTS.scans)} scans (stand-in values), a partial correlation, the networks and how their strength is spread.`],
  ['liver', 'Liver', 'An organ is a network too: an illustrative liver in a few thousand patches, linked where one patch\'s uptake is more than a set number of times another\'s (the poster\'s rule); the best connected glow.'],
];
const TABS = [['networks', 'Networks'], ['organs', 'Organs'], ['scenes', 'Scenes']];
// the tour's body set: its network and its disease scan are the tour's illustration, so this story leaves them out
const HIDE_CTL = { body: ['view', 'state'] };
const ctlsOf = k => (GL.sets[k].controls || []).filter(c => !(HIDE_CTL[k] || []).includes(c.key));
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries(ctlsOf(k).map(x => [x.key, ctlValue(k, x)])));
const X = { tab: 'networks', scene: 'organs', ctl: {}, t0: 0, turn: 'on', cmp: -1, netX: null, organ: null, life: false };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between; the
// organs' network and its crossfade (organs_prev to organs_which by organs_mix) and the explainer's pair change smoothly
// in the set's own time (explore(c)), so they pass unchanged
const STEP = new Set(['organs_focus', 'organs_pair', 'organs_which', 'organs_prev', 'organs_mix']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a control's option whose key or name matches re (the sets name their own options)
const optKey = (k, key, re) => { const c = ctlOf(k, key), o = c && c.options.find(([v, n]) => re.test(v) || re.test(n)); return o ? o[0] : null; };
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
// a view option's camera: the cam view of the same name, or the one its name stands for
const CAM_ALIAS = { organs: { organs: 'default', uptake: 'bars', partial: 'scatter', network: 'net' }, scan: { scanner: 'default' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {}, vc = ctlOf(k, 'view'), o = vc && vc.options.find(x => x[0] === v), n = o ? String(o[1]).toLowerCase() : '';
  for (const x of [al[v], v, al[n], n]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the network on show: the organs set's Network control holds it (its options are the ids), so the Scenes tab and the
// panes agree; a robustness test's network, which that control does not offer, is X.netX
const curNet = () => X.netX || ctlValue('organs', ctlOf('organs', 'network'));
// whether a set's view on show matches re (by its key or its name)
const viewIs = (k, re) => { const c = ctlOf(k, 'view'); if (!c) return false; const v = ctlValue(k, c), o = c.options.find(x => x[0] === v); return re.test(v) || (o && re.test(o[1])); };
const netView = () => viewIs('organs', /net|strength/i);
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
const afterUpdate = f => { NEXT.push(f); };

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  // the organs lie in the PET body: wherever they show, the body shows too, its tracer settled
  if (k === 'organs') Object.assign(tg, GL.sets.body.params, { body_a: 1, body_pet: 1 });
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(k, ct);
  if (k === 'organs') c.network = curNet();   // (a robustness test's network too: the set crossfades to it from the one before)
  if (s.explore) Object.assign(tg, s.explore(c));
  tg.body_net = 0; tg.body_state = 0;   // never the tour's own network or disease scan
  // (a comparison with no network of its own: the network last shown dims, with the set's labels, and the strength chart goes)
  if (k === 'organs' && noNet()) { tg.organs_a = 0.5; tg.organs_strength = 0; }
  if (k === 'organs') {
    tg.organs_focus = X.organ && PD.byId[X.organ] ? PD.byId[X.organ].i + 1 : 0;
    // the body dims under the network, the matrix and the scatter plot
    if ((tg.organs_net || 0) > 0.5 || (tg.organs_rows || 0) > 0.5 || (tg.organs_pair || 0) > 0.5) tg.body_a = 0.55;
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
  if (X.life && k !== 'scan') setLife(false);   // (life size is the scanner's)
  if (fly && !same) flyTo(view(k, X.life && k === 'scan' ? 'life' : viewCam(k) || 'default'));
  lifeCtl();
  renderScenes(); renderNets(); updateExtraLabels();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  if (k === 'organs' && key === 'network') X.netX = null;   // a network of the control's own
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
  if (ui && i >= 0) { const id = rowNets(PD.D.table2[i]).find(n => n && NET_ALL.includes(n)); if (id) showNet(id); }
  renderNets();
}
// the network on show in the organs set: one of its Network control's, or a robustness test's (X.netX)
function setNet(id) {
  if (!NET_ALL.includes(id)) return;
  if (NET_IDS.includes(id)) { (X.ctl.organs = X.ctl.organs || {}).network = id; X.netX = null; } else X.netX = id;
  X.t0 = performance.now();
  renderNets(); renderOrgans(); renderScenes();
}
// a network picked by hand (its chip, a link): the comparison it belongs to comes with it
function pickNet(id) { if (!NET_ALL.includes(id)) return; X.cmp = cmpOfNet(id); showNet(id); }
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
// Life size: on screen the scanner from a couple of metres at eye height; in the headset life size on your floor
function setLife(on) {
  X.life = on;
  if (XR.on) xrRoom(on);
  if (on && X.scene !== 'scan') openScene('scan', false);
  if (on) showTab('scenes');   // (the Scenes tab holds the scanner's controls and the Life size button)
  if (X.scene === 'scan') flyTo(view('scan', on ? 'life' : viewCam('scan') || 'default'));
  document.querySelectorAll('[data-ctl="life"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === (on ? 'on' : 'off'))));
  renderScenes();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls (they hold the
// network on show), the comparison and the organ.
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
  return { tab: X.tab, scene: X.scene, ctl, cmp: X.cmp, net: curNet(), organ: X.organ };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n < hi;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if ((v.cmp === -1 || int(v.cmp, 0, PD.D.table2.length)) && v.cmp !== X.cmp) selectCmp(v.cmp, false);
  if ((v.organ === null || (typeof v.organ === 'string' && PD.byId[v.organ])) && v.organ !== X.organ) selectOrgan(v.organ, false);
  // the scene and its controls; a view flies to its own camera as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  // then the network (also held by a control: should the two ever disagree, this wins)
  if (NET_ALL.includes(v.net) && v.net !== curNet()) setNet(v.net);
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
// the organ icons (PET_ICONS) as small pictures for the HTML panes: in the organ's colour on a dark disc, as the
// network's nodes are (light organ colours would vanish on the light theme's panel); drawn at 64 px, shown at 18 to 26
const ICON = {};
function iconUrl(id) {
  if (ICON[id] === undefined) {
    try {
      const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
      cv.width = cv.height = 64;
      ctx.beginPath(); ctx.arc(32, 32, 31, 0, 7); ctx.fillStyle = '#0a1322'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = organCol(id); ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
      PET_ICONS.draw(ctx, id, 32, 32, 42, { color: organCol(id), width: 42 * 0.085, detail: false });
      ICON[id] = cv.toDataURL();
    } catch (e) { ICON[id] = ''; }
  }
  return ICON[id];
}
const iconImg = (id, px) => (iconUrl(id) ? `<img src="${iconUrl(id)}" alt="" width="${px || 20}" height="${px || 20}" style="vertical-align:-5px;margin-right:6px">` : '');
// a network in words: organs, links, density and disorder (as printed), hubs (printed, or computed from its links)
function netInfo(id) {
  const n = netOf(id), e = edgesOf(id), h = hubsOf(id).filter(x => x !== 'aorta');
  if (!n) return { ok: false, text: 'This network is not in the data yet.' };
  const d = Number.isFinite(+n.density) ? `density ${pct(n.density)}` : '', o = Number.isFinite(+n.disorder) ? `disorder ${dis(n.disorder)}` : '';
  return { ok: e.length > 0, n, e, hubs: h,
    text: e.length ? `${(n.organs || []).length} organs, ${e.length} links${d || o ? `; ${[d, o].filter(Boolean).join(', ')} as printed` : ''}.` : 'Its links are not read off the figure yet: only its organs show.',
    hubText: !e.length ? '' : h.length ? `${h.length > 1 ? 'Hubs' : 'Hub'} marked in the paper: ${listOf(h.map(organLow))}.` : 'No hub marked in the paper.' };
}
// a network's strength per organ, sorted from high to low (as printed in the data, else summed from its links)
function strengths(id) {
  const n = netOf(id);
  if (!n) return [];
  let s = n.computed && n.computed.strength;
  if (!s) { s = {}; for (const [a, b, w] of edgesOf(id)) { s[a] = (s[a] || 0) + Math.abs(w); s[b] = (s[b] || 0) + Math.abs(w); } }
  return Object.entries(s).filter(([k]) => PD.byId[k]).sort((a, b) => b[1] - a[1]);
}
// what a comparison measured, in plain words (Table 2's names)
const WHAT_GLOSS = { Leukocytes: 'white blood cells', CRP: 'C-reactive protein, a marker of inflammation', Norepinephrine: 'a stress hormone',
  'Tumour load': 'TLG, total tumour glycolysis: the tumours\' volume times their uptake', BMI: 'body mass index: weight for height' };
// a comparison the paper drew no network for, picked while a network shows: that network dims (exploreTargets) and the
// scene and the panes say so, so the picture never seems to show the comparison
const noNet = () => { const r = PD.D.table2[X.cmp]; return !!r && X.scene === 'organs' && netView() && !rowNets(r).some(n => n && NET_ALL.includes(n)); };
const NO_NET = 'The paper drew no network for this comparison: the network last shown is dimmed.';
const sigWord = (sig, p) => `${esc(p)}${sig ? ' (significant)' : ' (no significant difference)'}`;
const rowName = r => `${r.what} · ${r.cohort.replace(/, split at the median.*$/, '').replace(/, normalised to$/, '').replace(/^full cohort$/, 'all scans')}`;
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    <div class="pane" id="pane-networks" role="tabpanel"></div>
    <div class="pane" id="pane-organs" role="tabpanel"></div>
    <div class="pane" id="pane-scenes" role="tabpanel"></div>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v, n = v !== undefined && v !== '' && !isNaN(+v) ? +v : v;
    ({
      cmp: () => selectCmp(n === X.cmp ? -1 : n), net: () => pickNet(v), cnet: () => showNet(v), organ: () => selectOrgan(v === X.organ ? null : v),
      scene: () => openScene(v), ctl: () => setCtl(b.dataset.scene || X.scene, b.dataset.ctl, v), life: () => setLife(!X.life),
    }[b.dataset.act] || (() => {}))();
  });
  renderAll();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>
    <div class="grp"><span>Life size</span><div class="seg" data-ctl="life" role="group" aria-label="The scanner life size">${[['off', 'Off'], ['on', 'On']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${(X.life ? 'on' : 'off') === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (!seg) return;
    if (seg.dataset.ctl === 'turn') setTurn(b.dataset.v); else setLife(b.dataset.v === 'on');
  });
  lifeCtl();
  showTab(X.tab);
}
// the bottom bar's Life size: the scanner's only
function lifeCtl() { const g = document.querySelector('#viewctl [data-ctl="life"]'); if (g && g.closest('.grp')) g.closest('.grp').style.display = X.scene === 'scan' ? '' : 'none'; }
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
function showTab(k) {
  X.tab = k;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
  // (should the tabs overflow a phone's panel: the row scrolls so the chosen one shows)
  const tb = $('#explore .tabs'), on = tb && tb.querySelector(`[data-tab="${k}"]`);
  if (on) { const r = on.getBoundingClientRect(), q = tb.getBoundingClientRect(); if (r.width && (r.left < q.left || r.right > q.right)) tb.scrollLeft += r.left - q.left - 8; }
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  updateExtraLabels();
}
// a tab picked by hand brings up the scene it talks about (a shared room's tab arriving does not: its scene comes with it)
function pickTab(k) {
  showTab(k);
  if (k === 'networks' && (X.scene !== 'organs' || !netView())) showNet(curNet());
  if (k === 'organs' && X.scene !== 'organs') openScene('organs');
}
function renderAll() { renderNets(); renderOrgans(); renderScenes(); }
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
    h += `<h3>${esc(r.what)}${WHAT_GLOSS[r.what] ? ` <small style="font-weight:400;font-size:15px;color:var(--muted)">${esc(WHAT_GLOSS[r.what])}</small>` : ''}</h3><p class="sub">${esc(r.cohort)}</p>
      <dl class="stats">${r.groups.map((g, i) => `<dt>${esc(g.label)}</dt><dd>${pct(g.density)}<small>density · disorder ${dis(g.disorder)} · ${g.n} scans${nets[i] && NET_ALL.includes(nets[i]) ? ` · <button type="button" data-act="cnet" data-v="${nets[i]}" style="border:0;background:none;padding:0;font:inherit;color:var(--cyan);text-decoration:underline;cursor:pointer">${nets[i] === id && X.scene === 'organs' ? 'on show' : 'show its network'}</button>` : ''}</small></dd>`).join('')}</dl>
      <p class="sub">Density: ${sigWord(r.sigD, r.pD)}. Disorder: ${sigWord(r.sigO, r.pO)}.</p>${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}${noNet() ? `<p class="note">${esc(NO_NET)}</p>` : ''}`;
  }
  h += `<p class="grp-h">Networks drawn in the paper</p><div class="chips">${NET_IDS.map((n, i) => chip(`data-act="net" data-v="${n}"`, esc(NET_SHORT[i]) + (hasNet(n) ? '' : ' <small>(not read yet)</small>'), n === id && X.scene === 'organs')).join('')}</div>
    <h3 style="font-size:20px">${esc(netShort(id))}</h3><p class="sub">${esc(netTitle(id))}. ${esc(ni.text)} ${esc(ni.hubText || '')}</p>`;
  const st = strengths(id);
  if (ni.ok && st.length) {
    const mx = st[0][1] || 1;
    h += `<p class="grp-h">Strength of each organ: the sum of its links' weights</p><div class="bars">${st.map(([o, v]) => `<div class="bar${(ni.hubs || []).includes(o) ? ' hl' : ''}"><span class="v">${v.toFixed(1)}</span><div class="fill" style="height:${(100 * v / mx).toFixed(0)}%;background:${organCol(o)}${(ni.hubs || []).includes(o) ? ';box-shadow:0 0 0 2px #ffb020' : ''}"></div><span class="k" title="${esc(organName(o))}">${iconImg(o, 18).replace('margin-right:6px', 'margin:2px 0 0')}</span></div>`).join('')}</div>`;
  }
  h += `<p class="grp-h">Gene-activity networks (Table 3, GTEx: tissues of ${fmt(FACTS.gtex)} people)</p>
    <dl class="stats">${PD.D.table3.filter(x => x.kind !== 'fdg').map(x => `<dt>${esc(x.name.replace(/ \(.*\)$/, ''))}</dt><dd>${pct(x.density)}<small>${x.r !== null ? `r = ${x.r} with FDG's network · ` : ''}${esc(x.similar)}</small></dd>`).join('')}</dl>
    <div class="chips">${PD.D.table3.filter(PROT_NET).map(x => chip(`data-act="net" data-v="${PROT_NET(x)}"`, `${esc(netShort(PROT_NET(x)))} network`, PROT_NET(x) === id && X.scene === 'organs')).join('')}</div>`;
  pane.innerHTML = h;
  updateExtraLabels();
}
function renderOrgans() {
  const pane = $('#pane-organs');
  if (!pane) return;
  const id = X.organ, O = PD.byId[id];
  let h = `<p class="sub">The ${FACTS.organs} organs of the paper and the aorta, the reference every organ is divided by. Pick one.</p>
    <div class="chips">${PD.D.organs.map(o => chip(`data-act="organ" data-v="${o.id}"`, iconImg(o.id) + esc(o.name), id === o.id)).join('')}</div>`;
  if (O) {
    const inF2 = PD.D.f2.organs.includes(id), e = edgesOf('full').filter(x => x[0] === id || x[1] === id).sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
    const hubIn = NET_ALL.filter(n => hasNet(n) && hubsOf(n).includes(id));
    h += `<h3>${iconImg(id, 26)}${esc(O.name)}</h3>
      <dl class="stats"><dt>Measured</dt><dd style="font-size:15px">${esc(O.measure)}</dd>
      <dt>Typical uptake</dt><dd>${id === 'aorta' ? '1' : O.suv}<small>${id === 'aorta' ? 'the unit' : 'times the aorta\'s'} (illustrative)</small></dd>
      ${inF2 && strengths('full').length ? `<dt>Strength</dt><dd>${(strengths('full').find(s => s[0] === id) || [0, 0])[1].toFixed(2)}<small>in the network of all ${fmt(FACTS.scans)} scans</small></dd>` : ''}
      <dt>Hub in</dt><dd style="font-size:15px">${hubIn.length ? esc(listOf(hubIn.map(netShort))) : 'none of the networks drawn'}</dd></dl>`;
    h += inF2 ? `<p class="grp-h">Its links in the network of all ${fmt(FACTS.scans)} scans (Figure 2A; blue together, red opposite)</p>
      <div class="chips">${e.length ? e.map(x => { const o = x[0] === id ? x[1] : x[0]; return `<button type="button" data-act="organ" data-v="${o}">${iconImg(o)}${esc(organName(o))} <b style="color:${inkCol(x[2] > 0 ? '#4c7cff' : '#ff4d4d')}">${x[2] > 0 ? '+' : '−'}${Math.abs(x[2]).toFixed(2)}</b></button>`; }).join('') : '<span class="empty">none</span>'}</div>`
      : `<p class="sub">${id === 'aorta' ? 'Not a node: the blood pool every organ is divided by.' : `Not in the network of all scans (Figure 2A has ${FACTS.f2n} organs); it appears in some of Figure 3's networks.`}</p>`;
  } else h += `<p class="empty">Colours and icons are the same in every scene. Point at an organ in the scan, a bar or a node to pick it there.</p>`;
  pane.innerHTML = h;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlLit(X.scene, c, v))).join('')}</div>`).join('')}
    ${X.scene === 'scan' ? `<div class="actions">${chip('data-act="life"', 'Life size', X.life)}</div>` : ''}
    ${X.scene === 'organs' && X.organ ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(organName(X.organ))} (Organs tab).</p>` : ''}`;
}
// a control's option is lit when it holds that value (the Network control's none while a robustness test's network shows)
const ctlLit = (k, c, v) => ctlValue(k, c) === v && !(k === 'organs' && c.key === 'network' && X.netX);
// labels the panes add (the sets label their own picks)
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  const s = GL.sets[X.scene], id = X.organ;
  if (X.scene === 'organs' && id && s.anchors[id] && !(s.labels || []).some(L => L.at === id)) {
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(organName(id))}</b>`, 'cyn'), set: 'organs', at: id, o: -1, txt: [organName(id), '', 'cyn'] });
  }
  // a comparison the paper drew no network for: its densities where the network's title would be
  if (noNet()) {
    const r = PD.D.table2[X.cmp], b = rowName(r), rest = `density ${r.groups.map(g => pct(g.density)).join(' against ')} · no network drawn in the paper`;
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(b)}</b>${esc(rest)}`, 'amb'), set: 'organs', at: 'title', o: -1, txt: [b, rest, 'amb'] });
  }
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { organ }, or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || X.scene !== 'organs') return null;
  const A = setApi(X.scene);
  if (!A || !A.pick) return null;
  const r = A.pick(rc);
  if (typeof r === 'string') return PD.byId[r] ? { organ: r } : null;
  return r && r.organ && PD.byId[r.organ] ? { organ: r.organ } : null;
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
  const s = GL.sets[X.scene], at = p.organ;
  if (!s.anchors || !s.anchors[at]) return null;
  const q = anchorOf(X.scene, at);
  return q && Number.isFinite(q[0]) ? [q[0], q[1], q[2]] : null;
}
const pickText = p => [organName(p.organ), p.organ === 'aorta' ? 'the reference' : PD.byId[p.organ].measure];
function choosePick(p) {
  if (!p) return;
  if (p.organ && X.scene === 'organs') { if (X.tab !== 'organs' && X.tab !== 'networks') showTab('organs'); selectOrgan(p.organ === X.organ ? null : p.organ, false); }
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
    XR.R = 1; XR.hitR = 1.4; XR.target.set(lv[3], lv[4], lv[5]);
    GL.world.quaternion.setFromAxisAngle(_xY, -(v[0] - lv[0]) * D2R);
    GL.world.scale.setScalar(1);
    // the life view's target that far ahead of you; the rig is at your eyes
    _xb.set(lv[3], 0, lv[5]).applyQuaternion(GL.world.quaternion);
    GL.world.position.set(-_xb.x, -1.6 - scanFloorY(), -d - _xb.z);
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
  const hm = (XR.room && APP.mode === 'explore' && X.scene === 'scan' ? 0.036 : 0.021) / XR.R;   // (life size: the labels are further away)
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
// The organ a ray points at (explore mode, the organs on show): { organ }, or null
const _prc = new THREE.Raycaster();
function pickRay(o, d) {
  if (APP.mode !== 'explore' || X.scene !== 'organs') return null;
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
// where the scanner's floor is in its own frame (the bore's centre is its origin); in passthrough the scanner's floor
// and its reflection are hidden by its param scan_floor (set in frame()), so the room's own floor shows
const scanFloorY = () => GL.sets.scan.floorY;
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
  document.body.classList.add('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  XR.clear = !(XR.session.environmentBlendMode && XR.session.environmentBlendMode !== 'opaque') && XR.mode !== 'immersive-ar';
  applyTheme();
  GL.stars.visible = XR.clear;
  GL.stars.material.size = 2.2;
  for (const P of XR.panels) { P.mesh.visible = true; P.last = ''; }
  XR.kbd.open = false;
  XR.room = !!X.life;
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
  return ['x', audioLabel(), X.tab, X.scene, JSON.stringify(X.ctl), X.cmp, X.netX, X.organ, X.life].join('|');
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
      const col = li.dataset.col || cssColor(li.style.borderLeftColor) || VC.amber;   // an organ's point in its own colour (the HTML's is mixed for a light panel)
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


// explore: tabs and panes mirroring the HTML ones
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
  const bottom = P.h - 34;
  ({ networks: drawNetsPane, organs: drawOrgansPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
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
  for (const [part, name] of [['health', 'From health to disease'], ['test', 'Is it robust?']]) {
    ctx.font = vfont(20, 700); ctx.fillStyle = VC.ink; ctx.fillText(name, x, y); y += 30;
    y += flow(ctx, P, T.map((t, i) => [t, i]).filter(([t]) => t.part === part).map(([t, i]) => ({ id: 'cmp:' + i, label: rowName(t), col: t.sigD || t.sigO ? VC.amber : null, on: X.cmp === i, fn: () => selectCmp(X.cmp === i ? -1 : i) })), x, y, W, bottom - 430, { px: 18, h: 36 }) + 10;
  }
  y += 4;
  if (r) {
    const nets = rowNets(r);
    y += textBlock(ctx, `${r.what}: ${r.cohort}`, x, y, W, 25, 34, VC.ink, 700, 1) + 4;
    r.groups.forEach((g, i) => {
      const n = nets[i] && NET_ALL.includes(nets[i]) ? nets[i] : null, on = n === id && X.scene === 'organs';
      // a group the paper drew as a network: a button that shows it (as the HTML pane's link)
      if (n) vButton(ctx, P, 'gnet:' + n, x + W - 130, y - 4, 130, 36, on ? 'On show' : 'Show', () => showNet(n), { on, r: 6, px: 19 });
      y += textBlock(ctx, `${g.label}: density ${pct(g.density)}, disorder ${dis(g.disorder)}, ${g.n} scans`, x, y, n ? W - 140 : W, 22, 30, VC.muted, 400, 1) + (n ? 8 : 0);
    });
    y += textBlock(ctx, `Density ${r.pD}${r.sigD ? ', significant' : ''}. Disorder ${r.pO}${r.sigO ? ', significant' : ''}.`, x, y, W, 22, 30, r.sigD || r.sigO ? VC.amber : VC.muted, 400, 1) + 4;
    // (what was measured in plain words, the row's own note, and a comparison with no network of its own)
    const nb = [WHAT_GLOSS[r.what] ? `${r.what}: ${WHAT_GLOSS[r.what]}.` : '', r.note, noNet() ? NO_NET : ''].filter(Boolean).join(' ');
    y += (nb ? textBlock(ctx, nb, x, y, W, 20, 27, VC.faint, 400, 3) : 0) + 8;
  }
  y += head(ctx, x, y, 'Networks drawn in the paper (· not read off the figure yet)');
  y += flow(ctx, P, NET_IDS.map((n, i) => ({ id: 'net:' + n, label: NET_SHORT[i] + (hasNet(n) ? '' : ' ·'), on: n === id && X.scene === 'organs', fn: () => pickNet(n) })), x, y, W, bottom, { px: 20, h: 40 }) + 12;
  y += textBlock(ctx, `${netShort(id)}: ${netTitle(id)}.`, x, y, W, 22, 30, VC.ink, 400, 2);
  y += textBlock(ctx, `${ni.text} ${ni.hubText || ''}`, x, y, W, 22, 30, VC.muted, 400, 3) + 10;
  if (ni.ok && y + 170 < bottom - 64) y += drawStrength(ctx, x, y, W, id, ni.hubs || []) + 6;
  if (FACTS.hk2 && y + 64 < bottom) textBlock(ctx, `Gene-activity networks (Table 3): of ${FACTS.tested}, only hexokinase 2's network resembles FDG's (r = ${FACTS.hk2.r}): the HK2 and GLUT networks above.`, x, y, W, 21, 29, VC.faint, 400, 2);
}
function drawOrgansPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, PD.D.organs.map(o => ({ id: 'org:' + o.id, label: o.short, icon: o.id, col: o.col, on: X.organ === o.id, fn: () => selectOrgan(X.organ === o.id ? null : o.id) })), x, y, W, bottom, { px: 21, h: 48 }) + 18;
  const id = X.organ, O = PD.byId[id];
  if (!O) { textBlock(ctx, `The ${FACTS.organs} organs of the paper and the aorta, the reference every organ is divided by. Pick one, or point at an organ, a bar or a node and pull the trigger (or pinch).`, x, y, W, 26, 38, VC.muted); return; }
  PET_ICONS.draw(ctx, id, x + 22, y + 22, 44, { color: O.col, width: 3, glow: true });
  y += textBlock(ctx, O.name, x + 60, y + 2, W - 60, 38, 46, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, `Measured: ${O.measure}.`, x, y, W, 24, 33, VC.muted, 400, 2) + 2;
  y += textBlock(ctx, id === 'aorta' ? 'The unit: every organ\'s uptake is divided by the aorta\'s.' : `Typical uptake: ${O.suv} times the aorta's (illustrative).`, x, y, W, 24, 33, VC.muted, 400, 2) + 2;
  const hubIn = NET_ALL.filter(n => hasNet(n) && hubsOf(n).includes(id));
  const sv = PD.D.f2.organs.includes(id) && strengths('full').find(q => q[0] === id);
  if (sv) y += textBlock(ctx, `Strength: ${sv[1].toFixed(2)} in the network of all ${fmt(FACTS.scans)} scans.`, x, y, W, 24, 33, VC.muted, 400, 1) + 2;
  y += textBlock(ctx, `Hub in: ${hubIn.length ? listOf(hubIn.map(netShort)) : 'none of the networks drawn'}.`, x, y, W, 24, 33, hubIn.length ? VC.amber : VC.muted, 400, 2) + 14;
  if (!PD.D.f2.organs.includes(id)) { textBlock(ctx, id === 'aorta' ? 'Not a node: the blood pool.' : `Not in the network of all scans (Figure 2A has ${FACTS.f2n} organs); it appears in some of Figure 3's networks.`, x, y, W, 24, 33, VC.muted, 400, 2); return; }
  const e = edgesOf('full').filter(q => q[0] === id || q[1] === id).sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
  y += head(ctx, x, y, `Its links among all ${fmt(FACTS.scans)} scans (Figure 2A; blue together, red opposite)`);
  flow(ctx, P, e.map(q => { const o = q[0] === id ? q[1] : q[0]; return { id: 'ol:' + o, label: `${PD.byId[o].short} ${q[2] > 0 ? '+' : '−'}${Math.abs(q[2]).toFixed(2)}`, icon: o, col: q[2] > 0 ? '#4c7cff' : '#ff4d4d', fn: () => selectOrgan(o) }; }), x, y, W, bottom, { px: 21, h: 46 });
}
// the scenes, and the chosen scene's own controls
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene);
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlLit(X.scene, c, v), fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  if (X.scene === 'scan' && y + 70 < bottom) vButton(ctx, P, 'life', x, y, 300, 60, 'Life size', () => setLife(!X.life), { on: X.life, px: 24 });
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
    let best = 'organs', ba = 0;
    for (const k of SET_ORDER) if (S[k + '_a'] > ba + 0.01) { ba = S[k + '_a']; best = k; }
    if (best === 'body' && S.organs_a > 0.3) best = 'organs';   // (the organs lie in the body)
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
    // (the search tried every option on the set: a set that remembers what it showed last, as the organs do for their
    // network's crossfade, is told the chosen ones, long settled, twice)
    if (s.explore) { const c = { t: 1e3 }; for (const c2 of s.controls || []) c[c2.key] = ctlValue(best, c2); s.explore(c); s.explore(c); }
    // the story's network and organ carry over to the panels (the controls hold the network: the closest one was picked
    // above)
    X.organ = null; X.cmp = -1; X.netX = null;
    if (best === 'organs' && S.organs_focus > 0.5) X.organ = PD.ids[Math.round(S.organs_focus) - 1] || null;
    if (best === 'organs' && S.organs_net > 0.5) { const w = NET_ALL[Math.round(S.organs_which)]; if (w) { if (NET_EXTRA.includes(w)) X.netX = w; X.cmp = cmpOfNet(w); } }
    X.tab = best === 'organs' ? (S.organs_net > 0.5 ? 'networks' : 'organs') : 'scenes';
    // from the last chapter (the story's end, or its Explore button): the networks of the paper
    if (ts >= C.vision.a) openNetworks();
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
    X.organ = null; NEXT.length = 0; pushState();
    LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); }); LBL.extra = [];
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start: the network of all scans with its strength, in the Networks tab
function openNetworks() {
  openScene('organs', false);
  const v = optKey('organs', 'view', /strength/i) || optKey('organs', 'view', /net/i);
  if (v) (X.ctl.organs = X.ctl.organs || {}).view = v;
  setNet('full'); X.tab = 'networks'; showTab('networks');
  orbit.cur = view('organs', viewCam('organs') || 'default'); orbit.to = null;
}

let lastNow = 0;
const EXV = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0];   // explore's view for applyCamera: orbit.cur, then FIT's eased shift
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
    const vn = viewCam(X.scene) || 'default', life = X.life && X.scene === 'scan', fs = life ? [0, 0, 0] : fitShift(X.scene, vn), ke = 1 - Math.exp(-dt * 3);
    GL.nf += ((life ? 1 : narrowOf(X.scene, vn)) - GL.nf) * ke;
    for (let i = 0; i < 3; i++) EXV[7 + i] += (fs[i] - EXV[7 + i]) * ke;
    orbitStep(xr ? pn : now);
    for (let i = 0; i < 6; i++) EXV[i] = orbit.cur[i];
    if (xr) xrPlace(orbit.cur); else { applyCamera(EXV); keepCamera(S, null); }
  }
  if (XR.on && !XR.clear && 'scan_floor' in S) S.scan_floor = 0;   // passthrough: the room's own floor, not the scanner's
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
    // #pet&explore&scene=scan&view=ring (any control of a scene by its key), &tab=networks|organs|scenes,
    // &cmp=7 (a row of Table 2), &net=C_high (or vena, dose_ultralow ...), &organ=muscle, &life (the scanner life size)
    const sc = hp.get('scene');
    if (sc && GL.sets[sc]) { openScene(sc, false); showTab('scenes'); }
    else if (!hp.has('t')) openNetworks();   // straight in: the network of all scans, with its strength
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    for (const c of ctlsOf(X.scene)) if (hp.get(c.key) && c.options.some(o => o[0] === hp.get(c.key))) setCtl(X.scene, c.key, hp.get(c.key));
    if (hp.get('cmp') !== null && hp.get('cmp') !== '') { const i = parseInt(hp.get('cmp'), 10); if (i >= 0 && i < PD.D.table2.length) { showTab('networks'); selectCmp(i); } }
    if (NET_ALL.includes(hp.get('net'))) { showTab('networks'); pickNet(hp.get('net')); }
    if (PD.byId[hp.get('organ')]) { showTab('organs'); selectOrgan(hp.get('organ')); }
    if (hp.has('life')) setLife(true);   // (it opens the Scenes tab: a tab asked for comes after)
    if (hp.get('tab') && TABS.some(t => t[0] === hp.get('tab'))) showTab(hp.get('tab'));
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
