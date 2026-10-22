// Hidden connections in rare diseases of nerves and muscles: the motor unit, a multiplex network of
// 71 layers, a random walk, disease modules and endotypes, and what muscle and heart share. After the
// ISMB 2026 talk by Iker Núñez-Carpintero and Philipp Friedrich (LBI Network Medicine), on their data.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/nmd/build.mjs from the tour's kit and the data, sets and engine parts in tools/nmd: edit those, not this file.
HOST.register('nmd', function (HOST) {
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
// NMD_DATA (the analysis data, tools/nmd/sets/data.js) comes first.
const SETS = {};
// Data of the muscle story, made by tools/nmd/data/gen_data.mjs from ikerdata/ (do not edit by hand).
// groups: name, short name, colour, where in the body (neuron, nerve, junction, muscle, heart), seed and added gene
//   counts, z (layer z-score per protein layer, in the order of ppi), endo (endotypes: number c, size n, GO-based name)
// layers: the tower from top to bottom: key, name, category (pheno, path, drug, ess, coex, ppi), data ('all', 'overlap' or '')
// genes: 'SYMBOL|endotype per group (0 none)|seed group bits|added group bits|GO terms|HPO terms|KEGG|in protein layers'
//   (terms index into terms)
// edges: base64 Uint32 pairs [i << 16 | j, protein-layer bits (bit p = layer ppi[p])]
// extra: base64 Uint16 triples [i, j, tower layer] for the overlap's other layers
// pos: base64 Int16 x, y per gene in the unit disc (x 32000); heat: per group, base64 bytes per gene (walk visits)
const NMD_DATA = {"groups":[{"name":"Motor Neuron Diseases","short":"Motor neuron","col":"#ff5a4b","site":"neuron","seeds":93,"added":1,"z":[1.28,0.72,1.24,2.56,0.66,0.65,2.36,0.73,1.15,2.19,2.1,1.39,1.17,1.35,0.56,0.52,1.23,1.66,0.27,1.19,2.36,1.73,0.52,1.52,0.36,0.38,2.54],"endo":[{"c":1,"n":30,"name":"rRNA metabolic process","terms":[["rRNA metabolic process",4],["RNA catabolic process",4],["rRNA processing",3]]},{"c":2,"n":16,"name":"Cellular response to heat","terms":[["Cellular response to heat",3],["Regulation of intracellular signal transduction",4],["Protein polymerization",3]]},{"c":3,"n":19,"name":"Vitamin transport","terms":[["Vitamin transport",2],["Respiratory chain complex IV assembly",2],["Organic anion transport",2]]},{"c":4,"n":10,"name":"Retrograde axonal transport","terms":[["Retrograde axonal transport",2],["Response to unfolded protein",2],["Chemical synaptic transmission",2]]},{"c":5,"n":14,"name":"Placenta development","terms":[["Placenta development",2],["Negative regulation of receptor internalization",2],["Membraneless organelle assembly",3]]},{"c":6,"n":5,"name":"Negative regulation of cellular process","terms":[["Negative regulation of cellular process",3],["Epidermal growth factor receptor signaling pathway",2],["ERBB signaling pathway",2]]}]},{"name":"Hereditary Motor and Sensory Neuropathies","short":"Motor & sensory nerve","col":"#ff8a3d","site":"nerve","seeds":110,"added":200,"z":[1.87,-0.46,-0.4,1.37,-0.6,-0.61,1.59,3.97,-0.41,1.5,0.26,-0.19,-0.43,-0.84,-0.82,-0.9,-0.01,0.55,-0.27,0.37,-0.56,-0.28,-0.82,-0.53,-0.51,-0.1,0.29],"endo":[{"c":1,"n":15,"name":"Negative regulation of neuron projection development","terms":[["Negative regulation of neuron projection development",2],["Negative regulation of cell projection organization",2],["Regulation of neuron projection development",2]]},{"c":2,"n":18,"name":"Organophosphate biosynthetic process","terms":[["Organophosphate biosynthetic process",2],["DNA replication",2],["DNA damage response",3]]},{"c":3,"n":13,"name":"Positive regulation of transcription by RNA polymerase II","terms":[["Positive regulation of transcription by RNA polymerase II",7],["Regulation of transcription by RNA polymerase II",8],["Positive regulation of DNA-templated transcription",7]]},{"c":4,"n":33,"name":"Cytosolic transport","terms":[["Cytosolic transport",3],["Post-Translational protein targeting to endoplasmic reticulum membrane",2],["Protein targeting to ER",2]]},{"c":5,"n":16,"name":"Axonogenesis","terms":[["Axonogenesis",3],["Neuronal action potential",2],["Cell morphogenesis involved in neuron differentiation",2]]},{"c":6,"n":23,"name":"Sensory perception of pain","terms":[["Sensory perception of pain",3],["Sensory perception",3],["Regulation of anatomical structure morphogenesis",3]]},{"c":7,"n":33,"name":"Response to unfolded protein","terms":[["Response to unfolded protein",4],["Regulation of intracellular signal transduction",5],["Regulation of small GTPase mediated signal transduction",4]]},{"c":8,"n":14,"name":"Neuron projection morphogenesis","terms":[["Neuron projection morphogenesis",4],["Plasma membrane bounded cell projection morphogenesis",3],["Neuron projection development",4]]},{"c":9,"n":22,"name":"Positive regulation of interferon-beta production","terms":[["Positive regulation of interferon-beta production",3],["Positive regulation of type i interferon production",3],["Regulation of interferon-beta production",3]]},{"c":10,"n":12,"name":"Hexose biosynthetic process","terms":[["Hexose biosynthetic process",3],["tRNA aminoacylation for protein translation",3],["Glucose metabolic process",3]]},{"c":11,"n":11,"name":"Mitochondrial cytochrome c oxidase assembly","terms":[["Mitochondrial cytochrome c oxidase assembly",2],["Mitochondrial genome maintenance",2],["Respiratory chain complex IV assembly",2]]},{"c":12,"n":14,"name":"Protein localization to organelle","terms":[["Protein localization to organelle",2],["Positive regulation of canonical NF-kappaB signal transduction",2],["Modification-Dependent protein catabolic process",2]]},{"c":13,"n":13,"name":"Cellular response to oxidative stress","terms":[["Cellular response to oxidative stress",4],["Amyloid fibril formation",3],["Regulation of mitochondrial membrane potential",3]]},{"c":14,"n":18,"name":"Wound healing","terms":[["Wound healing",4],["+ regulation of phosphatidylinositol 3-kinase/prot kinase b signal transduction",4],["Regulation of phosphatidylinositol 3-kinase/protein kinase b signal transduction",4]]},{"c":15,"n":11,"name":"Positive regulation of cytokine production involved in immune response","terms":[["Positive regulation of cytokine production involved in immune response",2],["Negative regulation of immune effector process",2],["Negative regulation of tumor necrosis factor production",2]]},{"c":16,"n":15,"name":"Protein modification process","terms":[["Protein modification process",3],["Positive regulation of cell population proliferation",2],["DNA damage response",2]]},{"c":17,"n":16,"name":"Regulation of apoptotic process","terms":[["Regulation of apoptotic process",6],["Negative regulation of apoptotic process",5],["ERBB2-EGFR signaling pathway",2]]},{"c":18,"n":7,"name":"Anterograde trans-synaptic signaling","terms":[["Anterograde trans-synaptic signaling",2],["Chemical synaptic transmission",2]]},{"c":19,"n":6,"name":"Intermediate filament bundle assembly","terms":[["Intermediate filament bundle assembly",2],["Neuron projection development",3],["Axon development",2]]}]},{"name":"Hereditary Ataxias","short":"Ataxias","col":"#ffb43b","site":"neuron","seeds":87,"added":200,"z":[0.92,-0.83,-0.85,-0.02,-0.78,-0.78,-0.07,-0.82,-0.8,0.2,-0.72,-0.61,-0.67,-0.49,-0.85,-0.58,-0.67,-0.77,-0.62,-0.78,-0.48,-0.64,-1.37,-0.55,-0.64,-0.75,-0.36],"endo":[{"c":1,"n":10,"name":"Lipid metabolic process","terms":[["Lipid metabolic process",3],["Import into cell",2],["Regulation of miRNA transcription",2]]},{"c":2,"n":50,"name":"Protein maturation","terms":[["Protein maturation",4],["mRNA processing",3],["Endosomal vesicle fusion",2]]},{"c":3,"n":21,"name":"Aerobic respiration","terms":[["Aerobic respiration",7],["Proton motive force-driven ATP synthesis",5],["Proton motive force-driven mitochondrial ATP synthesis",5]]},{"c":4,"n":19,"name":"Cellular respiration","terms":[["Cellular respiration",3],["Dicarboxylic acid metabolic process",2],["Fatty acid oxidation",2]]},{"c":5,"n":26,"name":"Copper ion homeostasis","terms":[["Copper ion homeostasis",2],["Intracellular copper ion homeostasis",2],["Regulation of amyloid precursor protein catabolic process",2]]},{"c":6,"n":12,"name":"Calcium ion transmembrane import into cytosol","terms":[["Calcium ion transmembrane import into cytosol",3],["Regulation of protein serine/threonine kinase activity",2],["Calcium ion transport",3]]},{"c":7,"n":11,"name":"Positive regulation of DNA-binding transcription factor activity","terms":[["Positive regulation of DNA-binding transcription factor activity",2],["Organelle organization",2]]},{"c":8,"n":18,"name":"Double-Strand break repair","terms":[["Double-Strand break repair",4],["DNA damage response",5],["Double-Strand break repair via nonhomologous end joining",3]]},{"c":9,"n":16,"name":"Postreplication repair","terms":[["Postreplication repair",2],["Translesion synthesis",2],["DNA synthesis involved in DNA repair",2]]},{"c":10,"n":16,"name":"Proteasomal protein catabolic process","terms":[["Proteasomal protein catabolic process",5],["Ubiquitin-Dependent protein catabolic process",5],["Protein polyubiquitination",4]]},{"c":11,"n":12,"name":"Metal ion transport","terms":[["Metal ion transport",4],["Axon guidance",3],["Neuron projection guidance",3]]},{"c":12,"n":7,"name":"Autophagosome assembly","terms":[["Autophagosome assembly",2],["Macroautophagy",2],["Membrane organization",2]]},{"c":13,"n":17,"name":"Protein quality control for misfolded or incompletely synthesized proteins","terms":[["Protein quality control for misfolded or incompletely synthesized proteins",2],["Positive regulation of DNA repair",2],["Gene expression",3]]},{"c":14,"n":15,"name":"Regulation of autophagy of mitochondrion","terms":[["Regulation of autophagy of mitochondrion",2],["Negative regulation of neuron apoptotic process",3],["Astrocyte activation",2]]},{"c":15,"n":13,"name":"Endosome organization","terms":[["Endosome organization",2],["Negative regulation of catabolic process",2],["Positive regulation of ubiquitin-dependent protein catabolic process",2]]},{"c":16,"n":8,"name":"Vacuole organization","terms":[["Vacuole organization",2],["Lysosome organization",2],["Lytic vacuole organization",2]]},{"c":17,"n":5,"name":"","terms":[]},{"c":18,"n":5,"name":"Action potential","terms":[["Action potential",4],["Monoatomic cation transmembrane transport",4],["Inorganic cation transmembrane transport",4]]},{"c":19,"n":3,"name":"Positive regulation of transcription by RNA polymerase II","terms":[["Positive regulation of transcription by RNA polymerase II",2],["Positive regulation of DNA-templated transcription",2],["Regulation of transcription by RNA polymerase II",2]]},{"c":20,"n":3,"name":"","terms":[]}]},{"name":"Hereditary Paraplegias","short":"Paraplegias","col":"#e6d23c","site":"neuron","seeds":74,"added":1,"z":[0.46,0.65,0.94,0.71,1.64,1.62,0.29,0.8,0.84,2.73,1.04,0.3,1.26,1.33,1.64,1.48,1.03,2.8,1.76,2.62,1.11,1.33,1.08,2.1,0.87,2.7,1.74],"endo":[{"c":1,"n":22,"name":"SREBP signaling pathway","terms":[["SREBP signaling pathway",2],["Cellular response to sterol depletion",2],["Negative regulation of alcohol biosynthetic process",2]]},{"c":2,"n":22,"name":"Endoplasmic reticulum tubular network organization","terms":[["Endoplasmic reticulum tubular network organization",4],["Endoplasmic reticulum tubular network formation",2],["Vesicle transport along microtubule",2]]},{"c":3,"n":8,"name":"Protein targeting","terms":[["Protein targeting",4],["Protein localization",4],["Intracellular protein transport",2]]},{"c":4,"n":15,"name":"Vacuole organization","terms":[["Vacuole organization",2],["Autophagosome organization",3],["Protein metabolic process",4]]},{"c":5,"n":3,"name":"","terms":[]},{"c":6,"n":5,"name":"Substantia nigra development","terms":[["Substantia nigra development",2]]}]},{"name":"Congenital Myasthenic Syndromes","short":"Myasthenic syndromes","col":"#3ee08f","site":"junction","seeds":35,"added":37,"z":[2.31,-0.53,1.97,2.13,1.07,1.06,1.64,1.34,3.69,2.1,2.08,1.43,1.3,2.5,3.16,1.32,1.72,3.38,1.3,-0.34,2.47,8.27,1.63,-0.4,-0.54,2.39,1.04],"endo":[{"c":1,"n":20,"name":"Golgi to plasma membrane protein transport","terms":[["Golgi to plasma membrane protein transport",2],["Golgi to plasma membrane transport",2],["Establishment of protein localization to plasma membrane",2]]},{"c":2,"n":12,"name":"Protein N-linked glycosylation","terms":[["Protein N-linked glycosylation",4],["Protein glycosylation",4],["Dolichol-Linked oligosaccharide biosynthetic process",3]]},{"c":3,"n":11,"name":"Synaptic vesicle exocytosis","terms":[["Synaptic vesicle exocytosis",2],["Cellular response to lipid",2],["Negative regulation of cellular process",2]]},{"c":4,"n":8,"name":"Unsaturated fatty acid biosynthetic process","terms":[["Unsaturated fatty acid biosynthetic process",2],["Regulation of neuromuscular junction development",2],["Anterograde trans-synaptic signaling",3]]},{"c":5,"n":9,"name":"Muscle contraction","terms":[["Muscle contraction",5],["Striated muscle contraction",4],["Skeletal muscle tissue development",3]]},{"c":6,"n":5,"name":"Cellular response to acetylcholine","terms":[["Cellular response to acetylcholine",2],["Acetylcholine receptor signaling pathway",2],["Synaptic transmission. cholinergic",2]]},{"c":7,"n":7,"name":"Actin filament organization","terms":[["Actin filament organization",4],["Muscle contraction",3],["Supramolecular fiber organization",2]]}]},{"name":"Congenital Myopathies","short":"Congenital myopathies","col":"#46d9ff","site":"muscle","seeds":40,"added":200,"z":[2.32,1.73,6.36,1.46,5.18,5.38,4.96,3.47,5.06,5.94,-0.25,2.05,5.17,2.16,2.84,4.47,3.89,7.37,1.46,6.1,5.79,4.54,5.72,1.56,2.44,4.03,6.31],"endo":[{"c":1,"n":27,"name":"Regulation of programmed cell death","terms":[["Regulation of programmed cell death",4],["Protein N-linked glycosylation",3],["Postreplication repair",2]]},{"c":2,"n":28,"name":"Female meiotic nuclear division","terms":[["Female meiotic nuclear division",2],["Muscle organ development",4],["Positive regulation of DNA-templated transcription",6]]},{"c":3,"n":16,"name":"Positive regulation of cell population proliferation","terms":[["Positive regulation of cell population proliferation",5],["Regulation of cell cycle process",4],["Regulation of cell population proliferation",5]]},{"c":4,"n":11,"name":"Cell surface receptor protein tyrosine kinase signaling pathway","terms":[["Cell surface receptor protein tyrosine kinase signaling pathway",6],["Ephrin receptor signaling pathway",3],["Intracellular signaling cassette",4]]},{"c":5,"n":29,"name":"Defense response to virus","terms":[["Defense response to virus",3],["Endoplasmic reticulum unfolded protein response",2],["Negative regulation of response to endoplasmic reticulum stress",2]]},{"c":6,"n":16,"name":"Axonogenesis","terms":[["Axonogenesis",5],["Synaptic vesicle endocytosis",3],["Receptor-Mediated endocytosis",3]]},{"c":7,"n":18,"name":"Regulation of cardiac muscle contraction by regulation of the release of sequestered calcium ion","terms":[["Regulation of cardiac muscle contraction by regulation of the release of sequestered calcium ion",3],["Regulation of cardiac muscle contraction by calcium ion signaling",3],["Regulation of release of sequestered calcium ion into cytosol by sarcoplasmic reticulum",3]]},{"c":8,"n":14,"name":"Myofibril assembly","terms":[["Myofibril assembly",7],["Actomyosin structure organization",6],["Sarcomere organization",5]]},{"c":9,"n":17,"name":"Negative regulation of DNA-templated transcription","terms":[["Negative regulation of DNA-templated transcription",7],["Regulation of transcription by RNA polymerase II",8],["Negative regulation of transcription by RNA polymerase II",6]]},{"c":10,"n":10,"name":"Negative regulation of cell-substrate adhesion","terms":[["Negative regulation of cell-substrate adhesion",2],["Cellular component assembly",3],["Actin filament organization",3]]},{"c":11,"n":19,"name":"Muscle contraction","terms":[["Muscle contraction",8],["Actomyosin structure organization",6],["Sarcomere organization",5]]},{"c":12,"n":16,"name":"Skeletal muscle tissue development","terms":[["Skeletal muscle tissue development",6],["Striated muscle contraction",7],["Skeletal muscle contraction",5]]},{"c":13,"n":14,"name":"Sarcomere organization","terms":[["Sarcomere organization",4],["Myofibril assembly",4],["Actomyosin structure organization",4]]},{"c":14,"n":5,"name":"Protein localization","terms":[["Protein localization",5],["Negative regulation of protein localization to nucleus",2],["Negative regulation of TORC1 signaling",2]]}]},{"name":"Distal Myopathies","short":"Distal myopathies","col":"#4d94ff","site":"muscle","seeds":21,"added":1,"z":[2.76,3.93,5.75,5.07,2.4,2.47,8.65,5.58,9.76,10.23,3.08,4.18,3.68,4.2,3.38,3.31,-0.02,8.57,3.51,5.3,5.03,8.5,6.57,3.8,3.03,8.87,2.51],"endo":[{"c":1,"n":6,"name":"Positive regulation of protein localization to plasma membrane","terms":[["Positive regulation of protein localization to plasma membrane",2],["Positive regulation of protein localization to cell periphery",2],["Positive regulation of protein localization to membrane",2]]},{"c":2,"n":8,"name":"Regulation of protein localization to cell surface","terms":[["Regulation of protein localization to cell surface",2],["Muscle cell development",2],["Protein localization to cell periphery",2]]},{"c":3,"n":8,"name":"Negative regulation of cellular component organization","terms":[["Negative regulation of cellular component organization",2],["Actomyosin structure organization",2]]}]},{"name":"Metabolic Myopathies","short":"Metabolic myopathies","col":"#2fc4b2","site":"muscle","seeds":29,"added":1,"z":[7.77,3.69,5.76,2.98,5.67,5.76,3.62,3.89,3.51,4.1,4.3,4.28,2.57,5.13,4.32,6.27,2.94,3.99,-0.21,4.46,4.75,3.91,3.08,5.42,3.98,5.67,3.26],"endo":[{"c":1,"n":15,"name":"Glycogen metabolic process","terms":[["Glycogen metabolic process",4],["ATP metabolic process",4],["ADP catabolic process",3]]},{"c":2,"n":11,"name":"Fatty acid beta-oxidation","terms":[["Fatty acid beta-oxidation",6],["Fatty acid beta-oxidation using acyl-coa dehydrogenase",4],["Electron transport chain",3]]},{"c":3,"n":4,"name":"Canonical glycolysis","terms":[["Canonical glycolysis",2],["Glucose catabolic process to pyruvate",2],["Glycolytic process through glucose-6-phosphate",2]]}]},{"name":"Other Myopathies","short":"Other myopathies","col":"#8fa8ff","site":"muscle","seeds":49,"added":6,"z":[1.26,0.83,0.56,2.93,0.88,0.88,2.17,0.27,1.43,1.31,1.13,1.51,1.04,1.22,0.65,0.6,-0.15,0.77,0.81,1.72,0.22,3.81,1.98,1.6,0.65,1.47,2.48],"endo":[{"c":1,"n":26,"name":"Calcium ion transport","terms":[["Calcium ion transport",5],["Positive regulation of cyclase activity",2],["Positive regulation of adenylate cyclase activity",2]]},{"c":2,"n":22,"name":"Intracellular calcium ion homeostasis","terms":[["Intracellular calcium ion homeostasis",4],["Muscle contraction",5],["Regulation of heart contraction",4]]},{"c":3,"n":7,"name":"mRNA splicing. via spliceosome","terms":[["mRNA splicing. via spliceosome",3],["Cellular response to arsenic-containing substance",2],["RNA splicing. via transesterification reactions with bulged adenosine as nucleophile",2]]}]},{"name":"Muscular Dystrophies","short":"Muscular dystrophies","col":"#b07bff","site":"muscle","seeds":53,"added":46,"z":[4.02,5.89,4.27,3.09,2.37,2.38,2.53,0.29,19.31,2.03,-1.03,1.58,5.52,1.66,5.37,3.03,1.95,2.56,0.35,1.23,1.05,11.35,2.48,1.85,1.08,1.82,2.81],"endo":[{"c":1,"n":22,"name":"Negative regulation of gene expression. epigenetic","terms":[["Negative regulation of gene expression. epigenetic",4],["Negative regulation of fibroblast proliferation",3],["Negative regulation of cell population proliferation",5]]},{"c":2,"n":24,"name":"Positive regulation of signal transduction","terms":[["Positive regulation of signal transduction",5],["Positive regulation of integrin-mediated signaling pathway",3],["Positive regulation of cell motility",4]]},{"c":3,"n":28,"name":"Muscle organ development","terms":[["Muscle organ development",7],["Sarcomere organization",5],["Striated muscle tissue development",4]]},{"c":4,"n":15,"name":"Negative regulation of cell differentiation","terms":[["Negative regulation of cell differentiation",4],["Cytokine-Mediated signaling pathway",3],["Negative regulation of intracellular signal transduction",4]]},{"c":5,"n":7,"name":"Protein O-linked glycosylation","terms":[["Protein O-linked glycosylation",6],["Protein O-linked mannosylation",4],["Protein mannosylation",4]]},{"c":6,"n":3,"name":"","terms":[]}]},{"name":"Congenital Muscular Dystrophies","short":"Congenital dystrophies","col":"#d77bff","site":"muscle","seeds":37,"added":48,"z":[3.36,2.15,-0.59,-0.69,2.43,2.42,2.77,0.98,2.37,2.16,-0.76,-0.55,1.29,2.14,2.66,-0.78,0.74,2.59,1.5,2.37,-0.85,2.23,-0.93,2.29,2.27,0.69,2.53],"endo":[{"c":1,"n":11,"name":"Regulation of t cell activation","terms":[["Regulation of t cell activation",2],["External encapsulating structure organization",2],["Extracellular structure organization",2]]},{"c":2,"n":21,"name":"Endoderm formation","terms":[["Endoderm formation",3],["Endodermal cell differentiation",3],["Regulation of muscle cell differentiation",2]]},{"c":3,"n":15,"name":"Protein O-linked glycosylation","terms":[["Protein O-linked glycosylation",10],["Protein glycosylation",7],["Protein O-linked mannosylation",6]]},{"c":4,"n":14,"name":"Endoplasmic reticulum to Golgi vesicle-mediated transport","terms":[["Endoplasmic reticulum to Golgi vesicle-mediated transport",5],["GPI anchor biosynthetic process",3],["GPI anchor metabolic process",3]]},{"c":5,"n":13,"name":"Protein glycosylation","terms":[["Protein glycosylation",3],["Regulation of gene expression",4],["Organelle disassembly",2]]},{"c":6,"n":8,"name":"Muscle contraction","terms":[["Muscle contraction",6],["Adult heart development",2],["Actin filament organization",3]]},{"c":7,"n":3,"name":"","terms":[]}]},{"name":"Hereditary Cardiomyopathies","short":"Cardiomyopathies","col":"#ff5ad9","site":"heart","seeds":115,"added":1,"z":[1.48,7.79,4.12,2.39,6.95,6.95,3.34,1.11,6.45,3.4,4.51,8.92,0.94,3.27,4.09,2.4,3.65,6.55,7.14,8.51,3.98,4.65,3.82,7.52,4.7,5.52,4.28],"endo":[{"c":1,"n":15,"name":"Mitochondrial translation","terms":[["Mitochondrial translation",3],["Translation",3],["Translational elongation",2]]},{"c":2,"n":22,"name":"Heart contraction","terms":[["Heart contraction",6],["Cardiac muscle contraction",5],["Cardiac muscle tissue morphogenesis",4]]},{"c":3,"n":14,"name":"Regulation of heart rate by cardiac conduction","terms":[["Regulation of heart rate by cardiac conduction",6],["Bundle of his cell to Purkinje myocyte communication",4],["Cardiac conduction",6]]},{"c":4,"n":18,"name":"Endomembrane system organization","terms":[["Endomembrane system organization",4],["Nucleus organization",3],["Protein localization to nuclear envelope",2]]},{"c":5,"n":22,"name":"Regulation of heart rate by cardiac conduction","terms":[["Regulation of heart rate by cardiac conduction",14],["Cardiac conduction",14],["Cardiac muscle cell action potential involved in contraction",13]]},{"c":6,"n":10,"name":"Regulation of calcium ion transmembrane transporter activity","terms":[["Regulation of calcium ion transmembrane transporter activity",3],["Regulation of release of sequestered calcium ion into cytosol",3],["Negative regulation of ion transmembrane transporter activity",2]]},{"c":7,"n":15,"name":"Sarcomere organization","terms":[["Sarcomere organization",8],["Myofibril assembly",8],["Actomyosin structure organization",8]]}]},{"name":"Other Neuromuscular Disorders","short":"Other disorders","col":"#9aa8bb","site":"muscle","seeds":81,"added":1,"z":[5.85,3.11,3.32,2.21,0.84,0.83,0.32,1.36,2.56,1.27,2.28,0.57,3.27,2.36,2.03,2.57,3.89,2.01,1.13,2.06,4.26,0.79,0.89,2.94,2.32,2.16,4.06],"endo":[{"c":1,"n":11,"name":"Potassium ion transmembrane transport","terms":[["Potassium ion transmembrane transport",3],["Membrane repolarization",2],["Membrane repolarization during action potential",2]]},{"c":2,"n":19,"name":"Ubiquinone metabolic process","terms":[["Ubiquinone metabolic process",4],["Quinone biosynthetic process",3],["Ubiquinone biosynthetic process",3]]},{"c":3,"n":16,"name":"DNA conformation change","terms":[["DNA conformation change",2],["DNA repair",3],["Regulation of microtubule-based process",2]]},{"c":4,"n":16,"name":"Mitochondrial DNA replication","terms":[["Mitochondrial DNA replication",3],["Mitochondrial DNA metabolic process",3],["DNA-templated DNA replication",3]]},{"c":5,"n":11,"name":"Muscle contraction","terms":[["Muscle contraction",6],["Cellular response to alkaloid",2],["Metal ion transport",3]]},{"c":6,"n":9,"name":"Skeletal muscle contraction","terms":[["Skeletal muscle contraction",3],["Sarcomere organization",3],["Myofibril assembly",3]]}]}],"layers":[{"key":"HP","name":"Human phenotypes (HPO)","cat":"pheno","data":"overlap"},{"key":"MP","name":"Mouse phenotypes (MPO)","cat":"pheno","data":"overlap"},{"key":"reactome_copathway","name":"Shared pathways (Reactome)","cat":"path","data":""},{"key":"drugs_NedRex","name":"Shared drug targets (NeDRex)","cat":"drug","data":""},{"key":"co-essential","name":"Essential together (CRISPR screens)","cat":"ess","data":""},{"key":"coex_core","name":"Core (in many tissues)","cat":"coex","data":""},{"key":"coex_ADS","name":"Adipose, subcutaneous","cat":"coex","data":""},{"key":"coex_ADV","name":"Adipose, visceral","cat":"coex","data":""},{"key":"coex_ARG","name":"Adrenal gland","cat":"coex","data":""},{"key":"coex_ATA","name":"Artery, aorta","cat":"coex","data":""},{"key":"coex_ATC","name":"Artery, coronary","cat":"coex","data":""},{"key":"coex_ATT","name":"Artery, tibial","cat":"coex","data":"overlap"},{"key":"coex_BRB","name":"Brain, basal ganglia","cat":"coex","data":""},{"key":"coex_BRC","name":"Brain, cerebellum","cat":"coex","data":""},{"key":"coex_BRO","name":"Brain, other regions","cat":"coex","data":""},{"key":"coex_BST","name":"Breast","cat":"coex","data":""},{"key":"coex_CLS","name":"Colon, sigmoid","cat":"coex","data":""},{"key":"coex_CLT","name":"Colon, transverse","cat":"coex","data":"overlap"},{"key":"coex_EMC","name":"Oesophagus, mucosa","cat":"coex","data":""},{"key":"coex_EMS","name":"Oesophagus, muscle","cat":"coex","data":""},{"key":"coex_FIB","name":"Fibroblasts","cat":"coex","data":""},{"key":"coex_GEJ","name":"Gastro-oesophageal junction","cat":"coex","data":""},{"key":"coex_HRA","name":"Heart, atrium","cat":"coex","data":"overlap"},{"key":"coex_HRV","name":"Heart, left ventricle","cat":"coex","data":"overlap"},{"key":"coex_ITI","name":"Small intestine, ileum","cat":"coex","data":"overlap"},{"key":"coex_KDN","name":"Kidney cortex","cat":"coex","data":""},{"key":"coex_LCL","name":"Lymphoblastoid cells","cat":"coex","data":""},{"key":"coex_LNG","name":"Lung","cat":"coex","data":""},{"key":"coex_LVR","name":"Liver","cat":"coex","data":""},{"key":"coex_MSG","name":"Minor salivary gland","cat":"coex","data":""},{"key":"coex_OVR","name":"Ovary","cat":"coex","data":""},{"key":"coex_PIT","name":"Pituitary","cat":"coex","data":""},{"key":"coex_PNC","name":"Pancreas","cat":"coex","data":""},{"key":"coex_PRS","name":"Prostate","cat":"coex","data":""},{"key":"coex_SKN","name":"Skin","cat":"coex","data":""},{"key":"coex_SMU","name":"Skeletal muscle","cat":"coex","data":""},{"key":"coex_SPL","name":"Spleen","cat":"coex","data":""},{"key":"coex_STM","name":"Stomach","cat":"coex","data":"overlap"},{"key":"coex_THY","name":"Thyroid","cat":"coex","data":"overlap"},{"key":"coex_TNV","name":"Tibial nerve","cat":"coex","data":""},{"key":"coex_TST","name":"Testis","cat":"coex","data":""},{"key":"coex_UTR","name":"Uterus","cat":"coex","data":""},{"key":"coex_VGN","name":"Vagina","cat":"coex","data":"overlap"},{"key":"coex_WBL","name":"Whole blood","cat":"coex","data":"overlap"},{"key":"ppi_core","name":"Core (in more than 24 tissues)","cat":"ppi","data":"all"},{"key":"ppi_adipose_tissue","name":"Adipose tissue","cat":"ppi","data":"all"},{"key":"ppi_adrenal_gland","name":"Adrenal gland","cat":"ppi","data":"all"},{"key":"ppi_amygdala","name":"Amygdala","cat":"ppi","data":"all"},{"key":"ppi_bone","name":"Bone","cat":"ppi","data":"all"},{"key":"ppi_bone_marrow","name":"Bone marrow","cat":"ppi","data":"all"},{"key":"ppi_brain","name":"Brain","cat":"ppi","data":"all"},{"key":"ppi_dorsal_root_ganglia","name":"Dorsal root ganglia","cat":"ppi","data":"all"},{"key":"ppi_heart","name":"Heart","cat":"ppi","data":"all"},{"key":"ppi_hypothalamus","name":"Hypothalamus","cat":"ppi","data":"all"},{"key":"ppi_kidney","name":"Kidney","cat":"ppi","data":"all"},{"key":"ppi_liver","name":"Liver","cat":"ppi","data":"all"},{"key":"ppi_lung","name":"Lung","cat":"ppi","data":"all"},{"key":"ppi_lymph_nodes","name":"Lymph nodes","cat":"ppi","data":"all"},{"key":"ppi_mammary_gland","name":"Mammary gland","cat":"ppi","data":"all"},{"key":"ppi_ovary","name":"Ovary","cat":"ppi","data":"all"},{"key":"ppi_pancreas","name":"Pancreas","cat":"ppi","data":"all"},{"key":"ppi_pituitary_gland","name":"Pituitary gland","cat":"ppi","data":"all"},{"key":"ppi_placenta","name":"Placenta","cat":"ppi","data":"all"},{"key":"ppi_prostate","name":"Prostate","cat":"ppi","data":"all"},{"key":"ppi_salivary_gland","name":"Salivary gland","cat":"ppi","data":"all"},{"key":"ppi_skeletal_muscle","name":"Skeletal muscle","cat":"ppi","data":"all"},{"key":"ppi_small_intestine","name":"Small intestine","cat":"ppi","data":"all"},{"key":"ppi_spleen","name":"Spleen","cat":"ppi","data":"all"},{"key":"ppi_stomach","name":"Stomach","cat":"ppi","data":"all"},{"key":"ppi_testes","name":"Testes","cat":"ppi","data":"all"},{"key":"ppi_uterus","name":"Uterus","cat":"ppi","data":"all"}],"ppi":[44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70],"genes":["RBM7|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|0.1.2|||1","MYH14|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|3.4.5|6.7|8|1","SETX|1.0.16.0.0.0.0.0.0.0.0.0.0|5|0|9.10.11|12.13|14|1","MATR3|1.13.0.0.0.0.1.0.0.4.0.0.0|65|514|15.16.17|12.14|14|1","IGHMBP2|1.2.0.0.0.0.0.0.0.0.0.0.0|3|0||13.18||1","UBA1|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|19.20.21|13.22|23|1","LAS1L|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|24.25.26|||1","GARS1|1.10.0.0.0.0.0.0.0.0.0.0.0|3|0|27.28.29||30|1","EXOSC9|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|31.32.33||34|1","EXOSC3|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|31.32.33|35.36|34|1","EXOSC8|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|31.32.33||34|1","VRK1|1.9.0.0.0.0.0.0.0.0.0.0.0|3|0|37.38.39|13.18||1","FBXO38|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|40.41.42|43.44||1","GBF1|1.2.0.0.0.0.0.0.0.0.0.0.0|3|0||||1","MCM3AP|1.2.0.0.0.0.0.0.0.0.0.0.0|3|0|45.46.47|||1","NEK1|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|48.49.50|51.52||1","NEK9|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|53.54|||1","FIG4|1.3.0.0.0.0.0.0.0.0.0.0.0|3|0|55.56.57|58.14|59|1","PRUNE1|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|60.61.62||63|1","TRIP4|1.0.0.0.0.0.0.0.0.0.5.0.0|1025|0|64.65.66|||1","ASCC1|1.0.0.0.0.0.0.0.0.0.0.0.3|4097|0|67.68.69|70.71||1","LRP10|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0||||1","C9orf72|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0||||1","GLE1|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|47.72.73|74.75|76|1","ALS2|1.0.15.4.0.0.0.0.0.0.0.0.0|9|4|77.78.79|12.80|14|1","ATP7A|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|81.82.83|18.84|85|1","CHMP2B|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|86.87.88|89.90|91|1","HEXB|1.0.0.0.0.0.0.0.0.0.0.0.0|1|0|92.93.94|95.96|97|1","SPG11|1.4.16.4.0.0.0.0.0.0.0.0.0|11|4|98.99.100|80.101|14|1","SPTLC1|1.7.0.0.0.0.0.0.0.0.0.0.0|3|0|102.103.104|105.106|107|1","REEP1|4.0.0.2.0.0.0.0.0.0.0.0.0|9|0|108.109.110|111.112||1","SIGMAR1|4.7.0.0.0.0.0.0.0.0.0.0.0|1|2|113.114.115|12.116|14|1","SYT2|4.7.0.0.2.0.0.0.0.0.0.0.0|17|2|117.118.119|||1","PLEKHG5|4.7.0.0.0.0.0.0.0.0.0.0.0|3|0|120.121.122|12.18|123|1","DYNC1H1|4.7.0.0.0.0.0.0.0.0.0.0.0|3|0|124.125.126|18.43|127|1","HSPB8|4.7.0.0.0.0.3.0.0.0.0.0.0|67|0|128.129.130|105.131||1","HSPB3|4.7.0.0.0.0.0.0.0.0.0.0.0|1|2|132|131.133||1","SLC5A7|4.0.0.0.2.0.0.0.0.0.0.0.0|17|0|134.135.136|137.138|139|1","AARS|4.18.0.0.0.0.0.0.0.0.0.0.0|3|0||||0","KIF5A|4.18.0.2.0.0.0.0.0.0.0.0.0|11|0|140.141.142|111.143|144|1","ASAH1|3.0.0.0.0.0.0.0.0.0.0.0.0|1|0|102.103.94|13.18|107|1","LRP12|3.0.0.0.0.0.0.0.1.0.0.0.0|257|0|145.146.147|||1","ADCY6|3.1.0.0.0.0.0.0.0.0.0.0.0|1|2|148.149.150||127|1","SLC52A3|3.0.0.0.0.0.0.0.0.0.0.0.0|1|0|151.152.153|80.154|155|1","SLC52A2|3.0.0.0.0.0.0.0.0.0.0.0.0|1|0|151.152.156|154.157||1","SMN1|3.0.0.0.0.0.0.0.0.0.0.0.0|1|0||||0","BICD2|3.0.0.0.0.0.0.0.0.0.0.0.3|4097|0|158.159.160|43.161|162|1","SLC25A46|3.0.0.0.0.0.0.0.0.0.0.0.0|1|0|163.164.165|||1","ADPRHL2|3.0.0.0.0.0.0.0.0.0.0.0.0|1|0||||0","BSCL2|3.0.0.1.0.0.0.0.0.0.0.0.0|9|0||||0","ZBTB42|3.0.0.0.0.0.0.0.0.0.0.0.0|1|0|166.167.168|||1","DNAJB2|3.7.0.0.0.0.0.0.0.0.0.0.0|3|0|169.170.171|172.173|174|1","HINT1|3.4.0.0.0.0.0.0.0.0.0.0.0|3|0|175.176.177|178.179||1","SORD|3.10.0.0.0.0.0.0.0.0.0.0.0|3|0|180.181.182||183|1","CAPN1|3.0.5.1.0.5.0.0.0.0.0.0.0|9|36|184.185.186||91|1","ANXA11|3.0.0.0.0.0.0.0.0.0.0.0.0|1|0|187.188||14|1","COX20|3.0.0.0.0.0.0.0.0.0.0.0.0|1|0|189.190.191|192.193|194|1","COQ7|3.0.0.0.0.0.0.0.0.0.0.0.2|4097|0|195.196.197||198|1","CHCHD10|3.0.0.0.0.0.0.0.0.0.0.0.2|4097|0|199.200.201|202.203|14|1","HNRNPA1|5.0.0.0.0.0.0.0.3.0.0.0.0|257|0|204.205.206||207|1","FUS|5.0.0.0.0.0.0.0.0.0.0.0.0|1|0|208.209.210|211.212|76|1","TARDBP|5.0.0.0.0.0.0.0.0.0.0.0.0|1|0|213.214.215|216.217|76|1","ATXN2|5.0.9.0.0.0.0.0.0.0.0.0.0|5|0|126.218.219|220.221|222|1","TBK1|5.0.0.0.0.0.0.0.0.0.0.0.0|1|0|223.224.225||226|1","VAPB|5.0.0.0.0.5.0.0.0.0.0.0.0|1|32|227.228.229|230.212|231|1","OPTN|5.0.0.0.0.0.0.0.0.0.0.0.0|1|0|232.233.234|154.157|235|1","DCTN1|5.0.0.0.0.0.0.0.0.0.0.0.0|1|0|98.236.200|12.80|127|1","PFN1|5.0.0.0.0.0.0.0.0.0.0.0.0|1|0|237.238.239|14.240|241|1","ANG|5.0.0.0.0.0.0.0.0.0.0.0.0|1|0|242.243.244|245|14|1","NEFH|5.19.0.0.0.0.0.0.0.0.0.0.0|3|0|246.247.248||14|1","PRPH|5.0.0.0.0.0.0.0.0.0.0.0.0|1|0||||1","SOD1|5.13.0.0.0.0.0.0.0.0.0.0.0|1|2|249.250.251|13.22|252|1","UBQLN2|5.0.0.0.0.0.0.0.0.0.0.0.0|1|0|253.218.254|14.240|174|1","ESR2|6.17.0.0.3.9.0.0.3.4.0.4.0|0|2867|65.255.256||257|1","AR|6.14.0.0.0.0.0.0.0.0.0.0.0|1|2||258.259||1","CNTNAP1|6.8.0.0.0.0.0.0.0.0.0.0.0|3|0|260.261.262||263|1","ERBB4|6.0.0.0.0.0.0.0.0.0.0.0.0|1|0|264.265.266|267.268|269|1","ERBB3|6.14.0.0.0.0.0.0.0.0.0.0.0|1|2|270.271.272|273.274|269|1","TUBA4A|2.0.0.0.0.0.0.0.0.0.0.0.0|1|0|||275|1","MAPT|2.13.14.0.0.0.0.0.0.0.0.0.0|1|6|98.276.277|278.14|279|1","HSPB1|2.7.0.0.0.0.0.0.0.0.0.0.0|3|0|280.281.282|283.131|284|1","VCP|2.13.9.0.0.1.1.0.3.4.0.0.0|835|36|285.286.287|288.289|290|1","SQSTM1|2.0.0.0.0.0.1.0.0.0.0.0.0|65|0|291.292.293|294.295|235|1","MYBPC1|2.0.0.0.0.11.0.0.0.3.0.0.6|4129|512|296.297.298|299.300|301|1","TTN|2.0.0.0.0.13.2.0.2.3.2.2.0|2913|1024||302.303||1","EMILIN1|2.0.0.0.0.0.0.0.0.0.0.0.0|1|0|304.305.306|||1","GLDN|2.0.0.0.0.0.0.0.0.0.0.0.0|1|0|||307|1","SPTAN1|2.8.0.0.0.0.0.0.0.0.0.0.0|1|2||308.36|309|1","DNM2|2.8.0.0.2.5.3.0.0.0.2.0.0|1123|16|310.311.312|313.314|315|1","PIP5K1C|2.0.0.0.0.0.0.0.0.0.0.0.0|1|0|316.317.318|319.320|59|1","KIF26B|2.0.0.0.0.0.0.0.0.0.0.0.0|1|0|||321|1","ADGRG6|2.0.0.0.0.0.0.0.0.0.0.0.0|1|0|322.323.324|||1","TRPV4|2.1.0.0.0.0.0.0.0.0.0.0.0|3|0|325.326.327|328.80|329|1","VWA1|2.0.0.0.0.0.0.0.0.0.0.0.0|1|0||||1","SH2D3C|0.16.0.0.0.0.0.0.0.0.0.0.0|0|2|136.330.331||332|1","GJB1|0.16.5.0.0.0.0.0.0.0.0.0.0|2|4|333.334.335|161.336||1","BID|0.16.0.0.0.0.0.0.0.0.0.0.0|0|2|337.338.339||340|1","UTRN|0.16.0.0.3.0.0.0.0.0.0.0.0|0|18|341.342.343|||1","ITPR3|0.16.0.0.0.0.0.0.0.0.0.0.0|2|0|344.345.346||347|1","EGLN3|0.16.0.0.1.9.0.0.0.4.0.0.0|0|562|348.349.115||350|1","PSAT1|0.16.0.0.0.0.0.0.0.0.0.0.0|2|0|351.352|353.354|355|1","ST8SIA4|0.16.0.0.0.0.0.0.0.0.0.0.0|0|2|356.357.358|||1","FBLN5|0.16.0.0.0.0.0.0.0.0.0.0.0|2|0|359.306.360|361.362||1","LIFR|0.16.0.0.0.0.0.0.0.0.0.0.0|0|2|363.364.365|366.367|368|1","PTPRB|0.16.0.0.0.0.0.0.0.0.0.0.0|0|2|369.370.371||372|1","YAP1|0.16.0.0.0.0.0.0.0.0.0.0.0|0|2|373.374.375|376.377|378|1","SLC9A3R1|0.16.0.0.0.0.0.0.0.0.0.0.0|2|0||379.380||1","NT5E|0.16.0.0.0.0.0.0.0.0.0.0.0|0|2|381.382.383|384.385|386|1","PCDHGC3|0.16.0.0.0.0.0.0.0.0.0.0.0|0|2|387.388|||1","OTULINL|0.15.0.0.0.0.0.0.0.2.0.0.0|0|514|389.390|||1","TMEM17|0.15.0.0.0.0.0.0.0.0.0.0.0|0|2|391.392.48|||1","DGAT2|0.15.0.0.0.0.0.0.0.0.0.0.0|2|0|393.394.395||396|1","LGALS8|0.15.0.0.0.0.0.0.0.0.0.0.0|0|2|121.397.398|||1","CD55|0.15.0.0.0.0.0.0.0.0.0.0.0|0|2|399.400.401||402|1","ADAMTSL4|0.15.0.0.0.0.0.0.0.0.0.0.0|0|2|403.404.405|406.407||1","MYC|0.15.0.0.3.3.0.0.0.1.0.0.0|0|562|408.409.45|410|411|1","THBS1|0.15.0.0.0.0.0.0.0.0.0.0.0|0|2|412.413.414||415|1","LACC1|0.15.0.0.0.0.0.0.0.0.0.0.0|0|2|416.417.418||419|1","FGD3|0.15.0.0.0.0.0.0.0.0.0.0.0|0|2|420.421.422||423|1","HAVCR2|0.15.0.0.0.0.0.0.0.0.0.0.0|0|2|424.425.426||427|1","E2F3|0.14.0.0.0.0.0.0.0.0.0.0.0|0|2|428.429.430||415|1","PRC1|0.14.0.0.0.3.0.0.0.0.0.0.0|0|34|431.432.433|||1","MYH10|0.14.0.0.0.0.0.0.0.0.0.0.0|0|2|434.435.436||8|1","MACF1|0.14.0.0.0.0.0.0.0.0.0.0.3|4096|2|437.438.439|||1","DST|0.14.0.0.0.0.0.0.0.0.0.0.0|2|0|440.441.442|443.444|445|1","CCDC88A|0.14.0.0.0.0.0.0.0.0.0.0.0|0|2|446.447.448|||1","WNK1|0.14.0.0.0.0.0.0.0.0.0.0.0|2|0|449.450.451|106.452|453|1","TPM3|0.14.0.0.7.9.0.0.0.0.2.0.0|32|1042|454.455.456|457.458|411|1","TPM1|0.14.0.0.0.9.0.0.0.0.0.3.0|2048|34|459.460.461|462.463|464|1","SPRED1|0.14.0.0.0.0.0.0.0.4.0.0.0|0|514|465.466.467|468.469||1","NEDD4L|0.14.0.0.0.6.0.0.0.0.0.0.0|0|34|470.451.471||472|1","SOCS6|0.14.0.0.0.0.0.0.0.0.0.0.0|0|2|473.474.475||476|1","CCND1|0.14.0.0.0.0.0.0.0.0.0.0.0|0|2|477.478.479|480.481|411|1","SRC|0.14.0.0.0.9.0.0.0.4.0.0.0|0|546|482.483.484||415|1","PRKD1|0.14.0.0.0.0.0.0.0.0.0.0.0|0|2|485.280.281||486|1","KSR2|0.14.0.0.0.0.0.0.0.0.0.0.0|0|2|487.488.489||490|1","ANK1|0.3.0.0.0.7.0.0.0.0.0.0.0|0|34|422.491.492|493.494|495|1","JAG1|0.3.0.0.0.0.0.0.0.0.0.0.0|2|0|496.497.498|499.500|501|1","SOX2|0.3.0.0.0.0.0.0.0.4.0.0.0|0|514|502.503.504|505.506|368|1","ARNT2|0.3.0.0.0.0.0.0.0.0.0.0.0|0|2|507.508.509|510.511|350|1","FOXG1|0.3.0.0.0.0.0.0.0.0.0.0.0|0|2|509.512.513|514.515|516|1","FOXC2|0.3.0.0.0.0.0.0.0.0.0.0.0|0|2|517.518.519|520.521||1","SMAD9|0.3.0.0.0.0.0.0.0.0.0.0.0|0|2|522.523.524|525.526|527|1","FHL3|0.3.0.0.0.3.0.0.0.0.0.0.0|0|34||||1","CCNDBP1|0.3.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","RNF4|0.3.10.0.0.0.0.0.0.0.0.0.0|0|6|285.39.528|||1","SP100|0.3.0.0.0.0.0.0.0.0.0.0.0|0|2|529.530.531||532|1","RASSF5|0.3.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","EGFR|0.17.1.0.0.4.1.0.0.4.0.0.0|0|614|533.534.535|536.537|415|1","ERBB2|0.17.0.0.0.0.0.0.0.0.0.0.0|0|2|533.538.539|540.541|415|1","RND1|0.17.0.0.0.0.0.0.0.0.0.0.0|0|2|542.543.544||545|1","HSP90AA1|0.17.0.0.0.0.0.0.0.0.0.0.0|0|2|276.546.205||547|1","UBB|0.17.0.0.0.0.0.0.0.0.0.0.0|0|2|548.549.550|551.552|235|1","UBC|0.17.0.0.0.1.0.0.0.0.0.0.0|0|34|550.475.19||553|1","ART3|0.17.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","HSPB2|0.17.0.0.0.7.0.0.2.0.0.0.0|0|290|132.554.555||495|1","NGF|0.17.0.0.0.0.0.0.0.0.0.0.0|2|0|556.557.558|106.559|329|1","HOXD10|0.17.0.0.0.0.0.0.0.0.0.0.0|2|0|560.54.561|562.563|564|1","PATJ|0.17.0.0.0.0.0.0.0.0.0.0.0|0|2|565.566.567||568|1","POLR1F|0.17.0.0.0.0.0.0.0.0.0.0.0|0|2|569.570||571|1","BIRC3|0.17.0.0.0.4.0.0.0.4.0.0.0|0|546|572.573.574|575.576|340|1","CDK15|0.17.0.0.0.0.0.0.0.0.0.0.0|0|2|577.578|||1","CD177|0.17.0.0.0.0.0.0.0.0.0.0.0|0|2|579.580.581|||1","ATP13A2|0.13.0.4.0.0.0.0.0.0.0.0.0|8|2|582.583.584|273.585||1","SNCA|0.13.0.0.0.0.0.0.0.0.0.0.0|0|2|586.587.588|58.589|279|1","PRKN|0.13.0.0.0.0.0.0.0.0.0.0.0|0|2|276.590.591||235|1","JPH3|0.13.0.0.0.0.0.0.0.0.0.0.0|0|2|592.593.594|595.217||1","UBE2O|0.13.0.0.0.0.0.0.0.0.0.0.0|0|2|596.597.598||23|1","LNX1|0.13.0.0.0.0.0.0.1.0.0.0.0|0|258|565.599.334||600|1","NEFL|0.13.0.0.0.0.0.0.0.0.0.0.0|2|0|246.601.602|283.314|14|1","HTT|0.13.0.0.3.5.0.0.0.0.0.0.0|0|50||603.604||1","DNMT1|0.13.8.0.0.0.0.0.0.0.0.0.0|2|4|605.606.607|608.609|419|1","ANLN|0.5.0.0.0.3.0.0.0.0.0.0.0|0|34|434.610.611|||1","FA2H|0.5.1.6.0.0.0.0.0.0.0.0.0|8|6|612.613.614|111.615|616|1","SH3TC2|0.5.0.0.0.0.0.0.0.0.0.0.0|2|0||||0","KCNA2|0.5.0.0.0.0.0.0.0.0.0.0.0|0|2|3.617.618||307|1","KCNA1|0.5.0.0.0.0.0.0.0.0.0.0.1|4096|2|619.620.621|179.622|307|1","CAMK2B|0.5.0.0.0.0.0.0.0.0.0.0.0|0|2|623.624.625||626|1","DRP2|0.5.0.0.0.0.0.0.0.0.0.0.0|2|0|341|||1","SPTBN4|0.5.0.0.0.0.0.0.0.0.0.0.0|2|0|627.628.629||301|1","PLEKHB1|0.5.0.0.0.0.0.0.0.0.0.0.0|0|2|630|||1","CADM3|0.5.0.0.0.0.0.0.0.0.0.0.0|2|0|631.632.388||263|1","PLEKHA4|0.5.0.0.0.0.0.0.0.0.0.0.0|0|2|633.634.635|||1","MME|0.5.6.0.0.0.0.0.0.0.0.0.0|6|0||||1","S100B|0.5.0.0.0.0.0.0.0.0.0.0.0|0|2|636.637.638|||1","PMP2|0.5.0.0.0.0.0.0.0.0.0.0.0|2|0|639.640.641||307|1","NFASC|0.5.0.0.0.0.0.0.0.0.0.0.0|0|2|322.323.642||263|1","LIMCH1|0.5.0.0.0.0.0.0.0.0.0.0.0|0|2|643.644.645|||1","DTNA|0.8.0.0.0.0.0.0.0.3.0.6.0|2560|2|341.136.646|647.648|402|1","BAG3|0.8.0.0.0.0.0.0.2.0.0.4.0|2306|0|649.650.100|651.652||1","CRYAB|0.8.0.0.0.0.0.0.2.0.0.2.0|2306|0|653.654.655|656.133|252|1","APP|0.8.5.0.0.6.0.0.0.0.1.0.0|0|1062|98.253.657|84.278|658|1","PRNP|0.8.5.0.0.0.0.0.0.0.0.0.0|0|6|659.660.661|278.662|663|1","NYAP1|0.8.0.0.0.0.0.0.0.0.0.0.0|0|2|664.665.666|||1","DAG1|0.8.0.0.0.0.0.0.0.2.1.0.0|1536|2|158.667.668|669.670|8|1","DNM1|0.8.18.0.0.6.0.0.0.0.0.0.0|0|38|312.671.672||315|1","ATP1A1|0.8.0.0.0.0.0.0.0.0.0.0.0|2|0||||1","HK1|0.8.0.0.0.0.0.0.0.0.0.0.0|2|0||105.673||1","ACTA1|0.8.0.0.7.9.0.0.0.4.6.0.0|32|1554|455.674.675|457.676|321|1","NEURL1|0.19.0.0.0.0.0.0.0.0.0.0.0|0|2|677.623.625|||1","NTRK1|0.19.0.0.0.0.0.0.0.0.0.0.0|2|0|678.556.535|679.106|411|1","NMNAT2|0.19.0.0.0.0.0.0.0.0.0.0.0|2|0|680.681.682||386|1","NEFM|0.19.0.0.0.0.0.0.0.0.0.0.0|0|2|246||14|1","RTN1|0.19.0.0.0.0.0.0.0.0.0.0.0|0|2|683.684.685|||1","TNIK|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2|686.687.688|||1","LONRF2|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","PCLO|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2|689.690.691||692|1","KIF1A|0.6.0.2.0.0.0.0.0.0.0.0.0|10|0|440.693.694|695.111|321|1","KIF5C|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2|140.141.142|74.696|144|1","KLC1|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2|287.697.698||321|1","PAK5|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","ITM2B|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2|699.700.701|702.703||1","LIN7A|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2|704.705.706|||1","SLC12A6|0.6.0.0.0.0.0.0.0.0.0.0.0|2|0|326.707.708|709.710||1","TRIM2|0.6.0.0.0.0.0.0.0.0.0.0.0|2|0|115.711.712|713.714||1","RETREG1|0.6.0.0.0.0.0.0.0.0.0.0.0|2|0|715.716.717|||1","DISC1|0.6.0.0.0.5.0.0.0.2.0.0.0|0|546|718.719.720|||1","LRRC4C|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2|721.722.723||263|1","RND2|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2|724.725.726|||1","B4GALNT1|0.6.0.5.0.0.0.0.0.0.0.0.0|10|0|357.727.358|728.112|729|1","SCN9A|0.6.0.0.0.0.0.0.0.0.0.0.0|2|0|3.716.730|731.732|347|1","KIF17|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2|733||321|1","SCN11A|0.6.0.0.0.0.0.0.0.0.0.0.0|2|0|734.716.730|735.736||1","SUSD4|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2|737.738.739|||1","ARNTL2|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","SYT12|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2|740.741.742|||1","MAS1|0.6.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","YARS|0.18.0.0.0.0.0.0.0.0.0.0.0|2|0||||0","KARS|0.18.0.0.0.0.0.0.0.0.0.0.0|2|0||||0","ATXN3|0.18.15.0.0.0.0.0.0.0.0.0.0|4|2|743.744.745|220.221|222|1","GAN|0.18.0.0.0.0.0.0.0.0.0.0.0|0|2||||0","SACS|0.18.16.4.0.0.0.0.0.0.0.0.0|14|0|169.170.746|747.105||1","EGR2|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|748.749.322|283.750|751|1","PMP22|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|167.168|752.753||1","MPZ|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|754.755.323|752.753|263|1","PRX|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|756.757.758|105.283||1","LITAF|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|759.760.761|314.762|763|1","GNB4|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|764|765.762|766|1","INF2|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|767.768.769|458.651|301|1","ARHGEF10|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|260.262.757|762.770||1","NDRG1|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|771.772.348|773.651||1","SBF2|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|323|283.314||1","GDAP1|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|165.774.775|105.283||1","FGD4|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|420.421.422|458.131||1","COX6A1|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|776.777.778||464|1","JPH1|0.7.0.0.0.7.0.0.0.0.0.0.0|0|34|592.593.594|||1","MTMR2|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|779.780.659|781.782|59|1","ATL1|0.7.0.2.0.0.0.0.0.0.0.0.0|10|0|783.784.785|752.101|786|1","PRPS1|0.7.12.0.0.0.0.0.0.0.0.0.0|2|4||787.314||1","MFN2|0.7.12.0.0.0.0.0.0.0.0.0.0|2|4|429.430.788|789.220|235|1","TFG|0.7.0.2.0.0.0.0.0.0.0.0.0|10|0|790.760.761|13.22|411|1","RAB7A|0.7.12.0.0.0.0.0.0.0.0.0.0|2|4|791.792.793|106.765|235|1","LRSAM1|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|794.795.796|797.172||1","DCAF8|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0||798.765||1","KRTAP8-1|0.7.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","KIF1B|0.7.0.0.0.0.0.0.0.0.0.0.0|2|0|799.800.801|802.803|321|1","POLR3A|0.9.13.0.0.0.0.0.0.0.0.0.0|0|6|804.805.806|116.212|571|1","POLR3B|0.9.9.0.0.0.0.0.0.0.0.0.0|2|4|807.808.806|809.810|571|1","RPAP2|0.9.0.0.0.0.0.0.0.0.0.0.0|0|2|811.808.0|||1","CTDP1|0.9.0.0.0.0.0.0.0.0.0.0.0|2|0|812.813.570|750.814||1","DNAJB6|0.9.0.0.0.3.3.0.0.1.0.0.0|576|34|169.170.815|656.289||1","CWC15|0.9.0.0.0.0.0.0.0.0.0.0.0|0|2|816.817.818||207|1","ATG16L1|0.9.0.0.0.5.0.0.0.0.0.0.0|0|34|819.820.821||822|1","NARS1|0.9.0.0.0.0.0.0.0.0.0.0.0|2|0|28.29.823||30|1","MARS1|0.9.0.1.0.0.0.0.0.0.0.0.0|10|0|824.825.826||827|1","ELP1|0.9.0.0.0.0.0.0.0.0.0.0.3|4098|0||||1","DHX9|0.9.0.0.0.0.0.0.0.0.0.0.0|2|0|828.829.830|||1","INO80B|0.9.0.0.0.0.0.0.0.0.0.0.0|0|2|831.832.833||834|1","BOP1|0.9.0.0.0.0.0.0.0.0.0.0.0|0|2|26.835.836|||1","NCBP1|0.9.0.0.0.0.0.0.0.0.0.0.0|0|2|837.838.839||76|1","CRY2|0.9.0.0.0.0.0.0.0.0.0.0.0|0|2|840.841.842||843|1","RNF31|0.9.0.0.0.0.0.0.0.0.0.0.0|0|2|844.845.846||91|1","RFC2|0.9.0.0.0.0.0.0.0.0.0.0.0|0|2|847.848.849|850.851|852|1","RFC1|0.9.0.0.0.0.0.0.0.0.0.0.0|2|0||||1","UBE2S|0.9.0.0.0.0.0.0.0.4.0.0.0|0|514|853.854.812||23|1","HSPA4L|0.9.0.0.0.0.0.0.0.0.0.0.0|0|2|132||174|1","BAG2|0.9.0.0.0.0.0.0.0.0.0.0.0|0|2|855.856.857||174|1","SLC25A24|0.11.0.0.0.0.0.0.0.0.0.0.0|0|2|858.859.860|||1","CHCHD6|0.11.0.0.0.0.0.0.0.0.0.0.0|0|2|164.861.862|||1","SCO2|0.11.0.0.0.0.0.0.0.0.0.4.0|2050|0|863.864.865|866.604|415|1","SURF1|0.11.0.0.0.0.0.0.0.0.0.0.0|2|0|163.189.190|867.868||1","MPV17|0.11.0.0.0.0.0.0.0.0.0.0.0|2|0|869.870.871|872.106|873|1","P2RY6|0.11.0.0.0.0.0.0.0.0.0.0.0|0|2|874.875.607||427|1","PTPMT1|0.11.0.0.0.0.0.0.0.0.0.0.0|0|2|876.877.878|||1","RPL13|0.11.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","GADD45GIP1|0.11.0.0.0.0.0.0.0.0.0.0.0|0|2|879.880.823|||1","MMAB|0.11.0.0.0.0.0.0.0.0.0.0.0|0|2|881.882.883|884.885|886|1","DHTKD1|0.11.0.0.0.0.0.0.0.0.0.0.0|2|0||887.888|889|1","G6PD|0.10.0.0.0.0.0.0.0.0.0.0.0|0|2||890.493||1","SARS1|0.10.0.0.0.0.0.0.0.0.0.0.0|2|0|891.892.893||30|1","AKR1B1|0.10.0.0.0.0.0.0.0.0.0.0.0|0|2|894.895.896||183|1","TAGLN2|0.10.0.0.0.0.0.0.0.0.0.0.0|0|2|897.898.455|||1","ENO2|0.10.0.0.0.0.0.0.0.0.0.0.0|0|2|899.900.901||902|1","ENO1|0.10.0.0.0.0.0.0.0.0.0.0.0|0|2|903.904.905||902|1","CCT5|0.10.12.0.0.0.0.0.0.0.0.0.0|2|4|906.907.908|909.106||1","STIP1|0.10.0.0.0.0.0.0.0.0.0.0.0|0|2|||910|1","AIFM1|0.10.3.0.0.0.0.0.0.0.0.0.2|4102|0|911.912.191|913.914|91|1","IARS2|0.10.0.0.0.0.0.0.0.0.0.0.0|0|2|28.29.879||30|1","AMFR|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|915.916.917||235|1","SEC11C|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|918.919||920|1","YKT6|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|921.922.790||923|1","LXN|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","ICK|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2||||0","FNDC3A|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|924|||1","LIG4|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|925.926.927|928.929|930|1","RABGAP1L|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|931.932|||1","MTM1|0.4.0.0.0.5.0.0.0.0.0.0.0|32|2|933.934.935|936.937|59|1","LGALS9|0.4.0.0.0.0.0.0.0.2.0.0.0|0|514|938.424.939|||1","SLC15A3|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|940.941.942|||1","PDK3|0.4.0.0.0.0.0.0.0.0.0.0.0|2|0|943.944.945|765.946|947|1","SGPL1|0.4.0.0.0.0.0.0.0.0.0.0.0|2|0|948.949.950||107|1","UNC93B1|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|951.952.953|954.888||1","NAGLU|0.4.0.0.0.0.0.0.0.0.0.0.0|2|0|955.956.957|958.959|960|1","GRN|0.4.14.0.0.0.0.0.0.0.0.0.0|0|6|740.483.961|52.89||1","SORT1|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|678.962.963||231|1","SGTB|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|964.965.966|||1","SPTLC2|0.4.0.0.0.0.0.0.0.0.0.0.0|2|0|102.103.967|106.559|107|1","ATL3|0.4.0.0.0.0.0.0.0.0.0.0.0|2|0|110.968.790|178.133||1","FAM83H|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|969.970.971|972.973||1","CLTCL1|0.4.0.0.0.0.0.0.0.0.0.0.0|2|0|974.975.976||315|1","CHMP4B|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|977.978.86|979.980|981|1","AHNAK2|0.4.0.0.0.0.0.0.0.0.0.0.0|2|0|758.982.983||984|1","PRDM12|0.4.0.0.0.0.0.0.0.0.0.0.0|2|0|985.986.620|||1","GOLM1|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","RPRM|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|53.54||987|1","BCAR1|0.4.0.0.2.0.0.0.0.2.0.0.0|0|530|988.989.990||991|1","VAC14|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|56.57.992||993|1","SFXN3|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2|994.995.996|||1","PC|0.4.0.0.0.0.0.0.0.0.0.0.0|0|2||913.997||1","FLVCR1|0.2.0.0.0.0.0.0.0.0.0.0.0|2|0|998.999.1000|1001.1002||1","ZNF596|0.2.0.0.0.0.0.0.0.0.0.0.0|0|2|167.168|||1","TIGD1|0.2.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","SBF1|0.2.0.0.0.0.0.0.0.0.0.0.0|2|0|369.370.1003|762.1004||1","MYO9B|0.2.0.0.0.0.0.0.0.0.0.0.0|2|0|1005.122.665||321|1","MORC2|0.2.0.0.0.0.0.0.0.0.0.0.0|2|0|1006.1007.1008|||1","PNKP|0.2.8.0.0.0.0.0.0.0.0.0.0|2|4|1009.1010.1011|36.1012|1013|1","PIEZO1|0.2.0.0.0.0.0.0.0.0.0.0.0|0|2|1014.1015.1016|1017.493||1","MLF1|0.2.0.0.0.0.0.0.0.0.0.0.0|0|2|1018.577.835|1019.245|1020|1","STIL|0.2.0.0.0.0.0.0.0.0.0.0.0|0|2|125.1021.1022|888||1","CNTRL|0.2.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","SCLT1|0.2.0.0.0.0.0.0.0.0.0.0.0|0|2|48.49.50|||1","RECQL4|0.2.0.0.0.0.0.0.0.1.0.0.0|0|514|1023.1024.1025|1026.1027||1","NEURL4|0.2.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","PPIP5K1|0.2.0.0.0.0.0.0.0.0.0.0.0|0|2|1028.1029.1030||59|1","ZNRF4|0.12.0.0.0.0.0.0.0.0.0.0.0|0|2|940.560.19|||1","BDKRB1|0.12.0.0.0.0.0.0.0.0.0.0.0|0|2|||1031|1","HSPD1|0.12.8.1.0.0.0.0.0.0.0.0.0|8|6|1032.1033.40|143.1034|1035|1","ELAVL1|0.12.0.0.0.0.0.0.0.0.0.0.0|0|2|1036.1037.214||1038|1","LMNA|0.12.0.0.0.2.0.0.0.1.1.4.0|3586|32|1039.1040.1041|458.1042|1043|1","TRIM25|0.12.10.0.0.6.0.0.0.0.5.0.0|0|1062|1044.1045.1046||226|1","HNRNPL|0.12.2.0.0.0.0.0.0.0.5.0.0|0|1030|1.1047.758|||1","VIRMA|0.12.2.0.0.0.0.0.0.0.5.0.0|0|1030|1048.1049.1050|||1","UNC5CL|0.12.0.0.0.0.0.0.0.0.0.0.0|0|2|1051.1052.760|||1","PASK|0.12.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","RIMKLA|0.12.0.0.0.0.0.0.0.0.0.0.0|0|2|1053.1054.1055||1056|1","TDRKH|0.12.0.0.0.0.0.0.0.0.0.0.0|0|2|1057.1058.1059|||1","LRRK2|0.12.0.0.0.1.0.0.0.0.0.0.0|0|34|277.779.1060|585.1061|279|1","TMOD2|0.12.0.0.0.0.0.0.0.0.0.0.0|0|2|1062.297.298||301|1","RHO|0.1.0.0.0.0.0.0.0.0.0.0.0|0|2||1063.1064||1","HARS|0.1.0.0.0.0.0.0.0.0.0.0.0|2|0||||0","CDH1|0.1.0.0.0.0.0.0.0.0.0.0.0|0|2||1065.1066||1","GJB3|0.1.0.0.0.0.0.0.0.0.0.0.0|2|0||1067.1068||1","CRELD1|0.1.0.0.0.0.0.0.0.0.0.0.0|0|2|1069.1070.1071|1072.1073||1","ZFHX2|0.1.0.0.0.0.0.0.0.0.0.0.0|2|0|1074.1075.1076|||1","TCTN2|0.1.0.0.0.0.0.0.0.0.1.0.0|0|1026|1077.391.1078|1079.1080||1","MOV10|0.1.0.0.0.5.0.0.1.0.0.0.0|0|290|1081.1082.437|||1","ABAT|0.1.0.0.0.2.0.0.0.0.0.0.0|0|34|1083.1084|1085.1086|1087|1","PLEKHA7|0.1.0.0.0.0.0.0.0.0.0.0.0|0|2|1088.1089.1090|||1","DTNB|0.1.0.0.0.0.0.0.0.0.0.0.0|0|2|341.1091.1092|||1","FAM131B|0.1.0.0.0.0.0.0.0.0.0.0.0|0|2||||1","TRO|0.1.0.0.0.0.0.0.0.0.0.0.0|0|2|632.388.1093|||1","SCN8A|0.0.18.0.0.0.0.0.0.0.0.0.0|0|4|322.730.1094|1095.1096|307|1","SCN2A|0.0.18.0.0.0.0.0.0.0.0.0.0|4|0|3.339.730|1097.1098|347|1","SCN1A|0.0.18.0.0.0.0.0.0.0.0.0.0|0|4|620.1099.734|1097.732|1100|1","KCNQ2|0.0.18.0.0.0.0.0.0.0.0.0.0|0|4|1101.1102.1103|1097.179|1104|1","CACNB4|0.0.11.0.0.0.0.0.0.0.0.0.0|4|0|1105.594.1106|1107.1108|464|1","KCNC1|0.0.11.0.0.0.0.0.0.0.0.0.0|0|4|1101.1109.1102|||1","FGF14|0.0.11.0.0.0.0.0.0.0.0.0.0|4|0|331.1110.1111|178.220|222|1","KCNC3|0.0.11.0.0.0.0.0.0.0.0.0.0|4|0|1112.1113.1101|1114.1115|222|1","ATP1A3|0.0.11.0.0.0.0.0.0.0.0.0.0|0|4|1116.1117.1118|89.1119|1120|1","ATCAY|0.0.11.0.0.0.0.0.0.0.0.0.0|0|4|934.1121.931|713.1122||1","TUSC3|0.0.11.0.0.0.0.0.0.0.0.0.0|0|4|1123.1124.1125|888|1126|1","MAP2|0.0.11.0.0.0.0.0.0.0.0.0.0|0|4||||1","ELOVL4|0.0.11.0.0.0.0.0.0.0.0.0.0|4|0|1127.1128.1129|407.1130|1131|1","NRXN1|0.0.11.0.0.0.0.0.0.0.0.0.0|0|4|1132.1133.1134|1135.1136|263|1","L1CAM|0.0.11.5.0.0.0.0.0.0.0.0.0|8|4|439.1137.1138|1139.710|263|1","NRXN3|0.0.11.0.0.0.0.0.0.0.0.0.0|0|4|1140.1141.642||263|1","DIRAS3|0.0.6.0.0.0.0.0.0.0.0.0.0|0|4|1142.1143.1144|||1","FAT2|0.0.6.0.0.0.0.0.0.0.0.0.0|4|0|1145.1146.632|||1","CACNA1G|0.0.6.0.0.0.0.0.0.0.0.0.0|4|0|1147.1148.1149||1150|1","ITPR1|0.0.6.0.0.0.0.0.0.0.0.0.0|4|0|1151.1152.1153|747.220|1154|1","SLC9A7|0.0.6.0.0.0.0.0.0.0.0.0.0|0|4||||0","SLC8A2|0.0.6.0.0.0.0.0.0.0.0.0.0|0|4|865.1155.1156||315|1","NPTX1|0.0.6.0.0.0.0.0.0.0.0.0.0|4|0|1157.1158.512|||1","TPPP|0.0.6.0.0.0.0.0.0.0.0.0.0|0|4|1159.1160.1161|||1","ADGRL1|0.0.6.0.0.0.0.0.0.0.0.0.0|0|4|324.1162|||1","CCDC88C|0.0.6.0.0.0.0.0.0.0.0.0.0|4|0|1163.447.1164|1165.1166|1167|1","SLC35D3|0.0.6.0.0.0.0.0.0.0.0.0.0|0|4|1168.1169.1170|||1","TBP|0.0.14.0.0.0.0.0.0.0.0.0.0|4|0|806.1171.1172|89.1173|1174|1","CTSF|0.0.14.0.0.0.0.0.0.0.0.0.0|0|4|1175.1176.1177|1178.203|763|1","SNORD118|0.0.14.0.0.0.0.0.0.0.0.0.0|0|4||||0","TGM6|0.0.14.0.0.0.0.0.0.0.0.0.0|4|0||1122.1179||1","DNAJC6|0.0.14.0.0.0.0.0.0.0.0.0.0|0|4|318.1180.1181|1182.1183|1184|1","FBXO7|0.0.14.0.0.0.0.0.0.0.0.0.0|0|4|1185.1186.1187|585.1188||1","TRPC3|0.0.14.0.0.0.0.0.0.0.0.0.0|4|0|1041.1189.383||222|1","GCH1|0.0.14.0.0.0.0.0.0.0.0.0.0|0|4|586.359.1190|585.1191|1192|1","CACNA1B|0.0.14.0.0.0.0.0.0.0.0.0.0|0|4|1193.1194.1195||1196|1","HPCA|0.0.14.0.0.0.0.0.0.0.0.0.0|0|4|1105.594.1106|||1","PPP2R2B|0.0.14.0.0.0.0.0.0.0.0.0.0|4|0||595.179|76|1","PANK2|0.0.14.0.0.0.0.0.0.0.0.0.0|0|4|1197.1198.1199|909.273|1200|1","PARK7|0.0.14.0.0.0.0.0.0.0.0.0.0|0|4|1201.1202.1203|1061.212|279|1","GBA2|0.0.16.4.0.0.0.0.0.0.0.0.0|8|4|1204.1205.1206|111.143|1207|1","SPG7|0.0.16.4.0.0.0.0.0.0.0.0.0|8|4|1208.201.1209|101.1210||1","ZFYVE26|0.0.16.4.0.0.0.0.0.0.0.0.0|8|4|99.1211.1212|1034.112||1","ABHD12|0.0.16.0.0.0.0.0.0.0.0.0.0|0|4|1213.1214.1215|161.980||1","APTX|0.0.16.0.0.0.0.0.0.0.0.0.0|4|0|1216.68|105.1217|1013|1","VLDLR|0.0.17.0.0.0.0.0.0.0.0.0.0|0|4|1218.1219.941|1220.713|222|1","KCTD7|0.0.17.0.0.0.0.0.0.0.0.0.0|0|4||||0","UCHL1|0.0.17.4.0.0.0.0.0.0.0.0.0|8|4|1221.1222.1223|179.1224|279|1","ATP8A2|0.0.17.0.0.0.0.0.0.0.0.0.0|0|4|1225.1226.1227|268.1228|427|1","GRM1|0.0.17.0.0.0.0.0.0.0.0.0.0|4|0|341.1229.1230|810.1130|347|1","SLC19A3|0.0.15.0.0.0.0.0.0.0.0.0.0|0|4|1231.1232.1233|89.1234|155|1","ATXN8|0.0.15.0.0.0.0.0.0.0.0.0.0|0|4||||0","ATXN8OS|0.0.15.0.0.0.0.0.0.0.0.0.0|4|0||||0","RARS|0.0.15.0.0.0.0.0.0.0.0.0.0|0|4||||0","GRID2|0.0.15.0.0.0.0.0.0.0.0.0.0|4|0|1132.1133.1235||1236|1","PIK3R5|0.0.15.0.0.0.0.0.0.0.0.0.0|0|4|664.1237.1238|1188.728|1239|1","ATXN10|0.0.15.0.0.0.0.0.0.0.0.0.0|4|0|1240.1241.1242|747.221|222|1","PRICKLE1|0.0.15.0.0.0.0.0.0.0.0.0.0|0|4|1243.1244.1245|178.732|1246|1","RUBCN|0.0.15.0.0.0.0.0.0.0.0.0.0|4|0|1247.1248.1249||1250|1","VAMP1|0.0.15.4.3.0.0.0.0.0.0.0.0|24|4|1251.1252|1253.1188|923|1","SYNJ1|0.0.15.0.0.6.0.0.0.0.0.0.0|0|36|1254.317.935|1253.1182|59|1","OPA3|0.0.13.0.0.0.0.0.0.0.0.0.0|0|4|1255.1256.1257|1258.1108||1","AFG3L2|0.0.13.4.0.0.0.0.0.0.0.0.0|12|0|1259.1260.1261|220.1262|222|1","ELOVL5|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0|1127.1128.1129|1188.1183|1131|1","STUB1|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0|1263.1264.605|111.1265|23|1","ANO10|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0|1266.1267.1268|1183.1269||1","PRKCG|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0|1270.1271.1272|179.1114|1273|1","PDYN|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0|717.1274.1157|1188.1275|1276|1","SYT14|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0||||0","SPTBN2|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0||179.1277|222|1","KCND3|0.0.13.0.0.0.0.0.0.0.0.3.0|2052|0|1278.1279.1280|1114.810|222|1","BEAN1|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0||1281.810|222|1","EEF2|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0|1282.1283.1284|220.1277|1285|1","TTBK2|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0|1286.1287.1288|1114.1289||1","NOP56|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0||||0","MRE11|0.0.13.0.0.0.0.0.0.0.0.0.0|0|4|1290.1291.1292||930|1","ATXN1|0.0.13.0.0.0.0.0.0.0.0.0.0|4|0|1293.1141.73|747.220|501|1","KLC2|0.0.12.2.0.0.0.0.0.0.0.0.0|8|4||||1","SPART|0.0.12.0.0.0.0.0.0.0.0.0.0|0|4|1294.1295.1296||1184|1","TDP1|0.0.12.0.0.0.0.0.0.0.0.0.0|4|0|1216.1297.1298|765.1299|1013|1","TMEM240|0.0.9.0.0.0.0.0.0.0.0.0.0|4|0||||0","PRICKLE2|0.0.9.0.0.0.0.0.0.0.0.0.0|0|4|1300.1301|1302.1303|1167|1","CACNA1A|0.0.9.0.0.0.0.0.0.0.0.0.1|4100|0|1193.1194.1195|58.221|1196|1","SYNE1|0.0.9.0.0.0.0.0.0.2.0.4.3|6660|0|1304.1305.1306|1307.1308|301|1","SLC9A1|0.0.9.0.0.0.0.0.0.0.0.0.0|4|0|1309.1310.1311||1312|1","ATN1|0.0.9.0.0.0.0.0.0.0.0.0.0|0|4|339.1313.512|221.1314||1","ATXN7|0.0.9.0.0.0.0.0.0.0.0.0.0|4|0|1287.1288.1315|221.1316||1","SIL1|0.0.9.0.0.0.0.0.0.0.0.0.0|4|0|1317.966.1318|313.230|174|1","PCNA|0.0.9.0.0.1.0.0.0.0.0.0.0|4|32|847.1319.1320|1321.1322|852|1","TTC19|0.0.9.0.0.0.0.0.0.0.0.0.0|0|4|1323.1324.434|1325.1326||1","SPG21|0.0.9.4.0.0.0.0.0.0.0.0.0|8|4|1327.1328|609.1325|1184|1","GOSR2|0.0.9.0.0.0.0.0.0.0.4.0.0|1024|4|1329.790|732.1330|923|1","ATP6AP2|0.0.9.0.0.0.0.0.0.0.0.0.0|0|4|1331.1332.1333|1061.1334|1335|1","C1QBP|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4|1336.1337.1338|||1","MDH2|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4|1339.1340.1341||1342|1","ANAPC15|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4|1343.1344.1345||1346|1","UQCRQ|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4|1347.777.778|1348.1349|464|1","NME2|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4||||0","PEX7|0.0.4.0.0.0.0.0.0.0.0.0.0|4|0|1350.1351.1352|1353.1354|873|1","PLGRKT|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4|904.1355.856|||1","C11orf1|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4||||1","CRADD|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4|771.1356.878|888||1","HADHA|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4|877.1357.1358|1354.1359|1087|1","PHYH|0.0.4.0.0.0.0.0.0.0.0.0.0|4|0|1360.1361.1362|1363.1354|873|1","MRPL47|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4|879.880.823||1364|1","DAP3|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4||||1","MRPL9|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4|879.880.1284||1364|1","SPR|0.0.4.0.0.0.0.0.0.0.0.0.0|0|4||1365.1366||1","PGM1|0.0.4.0.0.0.0.2.0.0.0.0.0|128|4|1367.1368.1369|1370.1371|1372|1","UBA5|0.0.4.0.0.0.0.0.0.0.0.0.0|4|0|1373.1374.1375|||1","ETFA|0.0.4.0.0.0.0.2.0.0.0.0.0|128|4|1376.1377.1378|1379.1380||1","PRDX3|0.0.4.0.0.0.0.0.0.0.0.0.0|4|0|1381.1382.1383|||1","TWNK|0.0.3.0.0.0.0.0.0.0.0.0.4|4100|0|1384.1385.1386||222|1","MTPAP|0.0.3.2.0.0.0.0.0.0.0.0.0|8|4|1387.1388.1389|1325.1390||1","C12orf65|0.0.3.2.0.0.0.0.0.0.0.0.0|8|4||||1","PMPCA|0.0.3.0.0.0.0.0.0.0.0.0.0|4|0|1209.912|||1","DARS2|0.0.3.0.0.0.0.0.0.0.0.0.0|0|4|27.28.1391|1392.1258|30|1","DLAT|0.0.3.0.0.0.0.0.0.0.0.0.0|0|4|1393.1341.1394|1395.1396|889|1","OPA1|0.0.3.0.0.0.0.0.0.0.0.0.4|4096|4||1397.752||1","FXN|0.0.3.0.0.0.0.0.0.0.0.0.0|4|0|1398.1399.1323|1400.1173|1401|1","NDUFS7|0.0.3.0.0.0.0.0.0.0.0.0.0|0|4|1402.1403.1404|867.868|1405|1","AUH|0.0.3.0.0.0.0.0.0.0.0.0.0|0|4|1357.1358.1406|1407.1348|1408|1","COX15|0.0.3.0.0.0.0.0.0.0.0.1.0|2048|4|163.998.999|867.868|1401|1","NDUFA9|0.0.3.0.0.0.0.0.0.0.0.0.0|0|4|195.196.197|867.868|1405|1","ISCA2|0.0.3.0.0.0.0.0.0.0.0.0.0|0|4|1409.1410.1411|||1","NARS2|0.0.3.0.0.0.0.0.0.0.0.0.0|0|4|29||30|1","POLG|0.0.3.0.0.0.0.0.0.0.0.0.4|4100|0||1397.178||1","COQ5|0.0.3.0.0.0.0.0.0.0.0.0.0|4|0|195.196.197||198|1","NDUFS3|0.0.3.0.0.0.0.0.0.0.0.0.0|0|4|1402.1403.1404|867.1412|1405|1","NDUFS2|0.0.3.0.0.0.0.0.0.0.0.0.0|0|4|1413.1414.1415|1412.1416|1405|1","SUCLA2|0.0.3.0.0.0.0.0.0.0.0.0.2|4096|4|1417.1418.1419|709.267|1420|1","SDHA|0.0.3.0.0.0.0.0.0.0.0.1.0|2048|4|1421.1378.1341|1422.1423|1420|1","GPR135|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4||||1","VWA3B|0.0.2.0.0.0.0.0.0.0.0.0.0|4|0||||1","CWF19L1|0.0.2.0.0.0.0.0.0.0.0.0.0|4|0|817.818.1049|||1","XPO1|0.0.2.0.0.1.0.0.0.0.0.0.0|0|36|1424.1425.1426||162|1","ZNF562|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|69.983.167|||1","GDAP2|0.0.2.0.0.0.0.0.0.0.0.0.0|4|0||||1","APEX1|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1009.1427.1428||1013|1","POLR2G|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1429.1430.1431||571|1","DCTN5|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|||127|1","INTS9|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1432.1433.0|||1","SRBD1|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1284.823.1434|||1","OSBPL8|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1435.1436.1437|||1","NR2C2AP|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4||||1","GEMIN7|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1438.1439.817|||1","THG1L|0.0.2.0.0.0.0.0.0.0.0.0.0|4|0|774.1391.1440|||1","IER3IP1|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1441.1442.1443|1302.1444||1","PDCD5|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1445.1446.1447|||1","TBCA|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1252|||1","C19orf12|0.0.2.4.0.0.0.0.0.0.0.0.0|8|4||||1","PLD3|0.0.2.0.0.0.0.0.0.0.0.0.0|4|0|1448.1449.1450||1451|1","SCYL1|0.0.2.0.0.0.0.0.0.0.0.0.0|4|0|1452|||1","SLC33A1|0.0.2.2.0.0.0.0.0.0.0.0.0|8|4||336.308|729|1","NCSTN|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1453.1454.1455|245|501|1","RNF123|0.0.2.0.0.2.0.0.1.0.0.0.0|0|292|475.1456.1411|||1","CANX|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|317.318.1180||547|1","PITRM1|0.0.2.0.0.0.0.0.0.0.0.0.0|4|0|1457.912.919||1335|1","PDZD11|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|704.705.1090|||1","COA7|0.0.2.0.0.0.0.0.0.0.0.0.0|4|0|163.190||194|1","FAM49B|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4||||0","GABARAPL1|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1458.1459.1460||822|1","VPS39|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|582.1461.1462||427|1","VPS41|0.0.2.0.0.0.0.0.0.0.0.0.0|4|0|1461.1462.1463||427|1","GABARAPL2|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1458.1459.1464||822|1","YPEL5|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4||||1","TDP2|0.0.2.0.0.0.0.0.0.0.0.0.0|4|0|1465.1091.1297|||1","PEX10|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1466.1467.1468|1469.1470|873|1","CRYL1|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|||183|1","PCBD2|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1471.1472.167||1192|1","TK2|0.0.2.0.0.0.0.0.0.0.0.0.4|4100|0|1473.1474|709.267|1475|1","FMO4|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1476.1477.1478||1479|1","MSTO1|0.0.2.0.0.0.0.0.0.0.5.0.3|5124|0|590.934.1480|||1","MMS19|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1411.1434.1481|||1","POLRMT|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1482.1483.1484|||1","KBTBD6|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1485.1486.1487|||1","CLK1|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4||||1","BRAT1|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|182.1488.1489|735.1490||1","PLA2G6|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|1491.877.1492|278.608|1493|1","PIAS4|0.0.2.0.0.0.0.0.0.0.0.0.0|0|4|285.1494.1495||1496|1","NBAS|0.0.10.0.0.0.0.0.0.0.0.0.0|0|4|1497.1498.1499|1500.1501||1","VPS13D|0.0.10.0.0.0.0.0.0.0.0.0.0|4|0|1187.1502.1503|||1","WIPF2|0.0.10.0.0.0.0.0.0.0.0.0.0|0|4|||1504|1","N4BP1|0.0.10.0.0.0.0.0.0.0.0.0.0|0|4|1505.1506.1507|||1","FBXW11|0.0.10.0.0.0.0.0.0.0.0.0.0|0|4|1508.1509.440||843|1","FAM193A|0.0.10.0.0.0.0.0.0.0.0.0.0|0|4||||1","PUM1|0.0.10.0.0.0.0.0.0.0.0.0.0|4|0|1510.1511.1037||222|1","ADAR|0.0.10.0.0.0.0.0.0.0.0.0.0|0|4|1512.1513.1514|267.90|226|1","RBM4|0.0.10.0.0.0.0.0.0.0.0.0.0|0|4|1515.1516.1517|||1","NXF1|0.0.10.0.0.0.0.0.0.0.0.0.0|0|4|47.1518.1519||1520|1","TRIM28|0.0.10.0.0.0.0.0.0.0.0.0.0|0|4|1521.1522.1523|||1","RNF216|0.0.10.0.0.0.0.0.0.0.0.0.0|4|0|1524.1525.1526|1527.1265||1","MARK2|0.0.10.0.0.0.0.0.0.0.0.0.0|0|4|1286.567.1528|||1","BRD4|0.0.10.0.0.0.0.0.0.0.0.0.0|0|4|1529.1530.1531|||1","PIAS1|0.0.8.0.0.0.0.0.0.0.0.0.0|0|4|1532.1533.473||23|1","TOPBP1|0.0.8.0.0.0.0.0.0.0.0.0.0|0|4|1534.927.1535||1535|1","DAXX|0.0.8.0.0.0.0.0.0.0.0.0.0|0|4|1536.1537.1538||309|1","ATM|0.0.8.0.0.0.0.0.0.0.0.0.0|4|0|1539.1540.1541|1542.1543|1535|1","SMARCA2|0.0.8.0.0.0.0.0.0.0.0.0.0|0|4|1544.1545.1546|1547.1548|834|1","MED23|0.0.8.0.0.0.0.0.0.0.0.0.0|0|4|1549.1550.1551|888||1","IFRD1|0.0.8.0.0.0.0.0.0.0.0.0.0|4|0||||1","PTGES3|0.0.8.0.0.0.0.0.0.0.0.0.0|0|4|1552.1553.1554||1555|1","CRY1|0.0.8.0.0.0.0.0.0.0.0.0.0|0|4|840.1556.841||843|1","XRCC1|0.0.8.0.0.0.0.0.0.0.0.0.0|4|0|1557.485.1216||1013|1","ATG7|0.0.8.0.0.0.0.0.0.0.0.0.0|4|0|1558.1458.1459||822|1","UBR4|0.0.8.0.0.0.0.0.0.0.0.0.0|0|4|1559.1560.743||993|1","PSMD10|0.0.8.0.0.0.0.0.0.0.0.0.0|0|4|1561.1562.1563|||1","GTF2A1|0.0.8.0.0.0.0.0.0.0.0.0.0|0|4|1550.1551.1564||1174|1","ATG5|0.0.8.0.0.0.0.0.0.0.0.0.0|4|0|293.1337.1248||822|1","CYP2C19|0.0.20.0.0.0.0.0.0.0.7.0.0|0|1028|1565.1477.1566|888|1567|1","KHDC3L|0.0.20.0.0.0.0.0.0.0.7.0.0|0|1028|1219.1568.1569|888||1","CYP26C1|0.0.20.0.0.0.0.0.0.0.7.0.0|0|1028||||0","ZP1|0.0.19.0.0.0.0.0.0.0.0.0.0|0|4||1570.888||1","ESR1|0.0.19.0.0.0.0.0.0.0.0.0.0|0|4|605.1190.1571|1572.1573|315|1","WWOX|0.0.19.0.0.0.0.0.0.0.0.0.0|4|0|1445.1574.1575|1576.1577||1","DNAJC11|0.0.7.0.0.0.0.0.0.0.0.0.0|0|4|164.861.862|||1","YIPF5|0.0.7.0.0.0.0.0.0.0.0.0.0|0|4|1578.1579.1580|||1","LRP6|0.0.7.0.0.0.0.0.0.0.0.0.0|0|4|1581.605.1582||453|1","DAZAP2|0.0.7.0.0.0.0.0.0.0.0.0.0|0|4|1583.1584.1585|||1","ARFGEF2|0.0.7.0.0.0.0.0.0.0.0.0.0|0|4|78.1586.1587|294.514|1184|1","RNF220|0.0.7.0.0.0.0.0.0.0.0.0.0|4|0|1588.1589.597|||1","CDKL5|0.0.7.0.0.0.0.0.0.0.0.0.0|0|4||||0","SNX14|0.0.7.0.0.0.0.0.0.0.0.0.0|4|0|1590.1591.398|||1","PEX19|0.0.7.0.0.0.0.0.0.0.0.0.0|0|4|1592.1593.1594|1354.1469|873|1","PNPLA6|0.0.7.3.0.0.0.0.0.0.0.0.0|8|4|1595.1596.1597|747.116|332|1","WDR73|0.0.7.0.0.0.0.0.0.0.0.0.0|4|0|1598.1306.456|||1","PIGK|0.0.5.0.0.0.0.0.0.0.0.0.0|4|0|1599.1600.1411||1601|1","EEA1|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4|1244.1602.1603||1246|1","KRAS|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4||1604.1605||1","ERLIN2|0.0.5.1.0.0.0.0.0.0.0.0.0|8|4|1606.1607.1608|211.1609||1","TOMM70|0.0.5.0.0.0.0.0.0.0.0.0.0|4|0|1610.1611.1612||235|1","TECR|0.0.5.0.0.1.0.0.0.0.0.0.0|0|36|1613.1131.104|888|1131|1","TPP1|0.0.5.0.0.0.0.0.0.0.0.0.0|4|0||773.1614||1","APBB1|0.0.5.0.0.6.0.0.0.0.0.0.0|0|36|1615.1616.435||1617|1","EFHD2|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4||||1","ACTN1|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4|1618.1619.455|1620.1621|1622|1","RIT1|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4||1605.1623||1","ALOX15B|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4|1624.1625.1626||1555|1","SAMD9L|0.0.5.0.0.0.0.0.0.0.0.0.0|4|0||||1","CMTM3|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4||||1","FTL|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4||1627.89|1401|1","FKBP9|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4||||1","KIF1C|0.0.5.4.0.0.0.0.0.0.0.0.0|8|4|799.440.1628|728.810|321|1","CDH11|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4|1629.1630.441|||1","GLT8D2|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4||||1","SBSPON|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4||||1","KIAA1671|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4||||1","LRP1B|0.0.5.0.0.0.0.0.0.0.0.0.0|0|4|1631.1632.1318|||1","PLP1|0.0.1.6.0.0.0.0.0.0.0.0.0|8|4|261.1633.1634|101.1210||1","GJC2|0.0.1.6.0.0.0.0.0.0.0.0.0|8|4||178.809||1","HEPACAM|0.0.1.0.0.0.0.0.0.0.0.0.0|0|4||||0","ATP1A2|0.0.1.0.0.0.0.0.0.0.0.0.1|4096|4|1635.1636.1637|1638.1639|1120|1","TTPA|0.0.1.0.0.0.0.0.0.0.0.0.0|4|0|1640.1641.151|1642.1643||1","PPARA|0.0.1.0.0.0.0.0.0.0.0.0.0|0|4|1644.1645.1646||1647|1","EIF4EBP2|0.0.1.0.0.0.0.0.0.0.0.0.0|0|4|1517.1648.723||252|1","SLC1A3|0.0.1.0.0.0.0.0.0.0.0.0.0|4|0|1649.1650.1651|1119.1652|1653|1","NKX6-2|0.0.0.6.0.0.0.0.0.0.0.0.0|8|0||||0","MAG|0.0.0.6.0.0.0.0.0.0.0.0.0|8|0|1654.1655.1656||263|1","SPAST|0.0.0.4.0.0.0.0.0.0.0.0.0|8|0|1385.601.1657|752.101||1","CYP2U1|0.0.0.4.0.0.0.0.0.0.0.0.0|8|0|1658.1477.1566|336.1659|1660|1","ZFYVE27|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0|683.678.558|111.1661|1184|1","CPT1C|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0||||0","RTN2|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0|683.1662.684|111.143||1","CYP7B1|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0|1663.1664.1665|1666.1173|1667|1","NIPA1|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0|1123.1668|752.101||1","REEP2|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0|108.110|1034.1669||1","AP5Z1|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0|1670.1671.1297|622.1609||1","RNF170|0.0.0.2.0.2.0.0.0.0.0.0.0|8|32||1173.1672||1","ARL6IP1|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0|1673.966.1674|||1","DDHD1|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0|1675.768.968|1676.1609||1","ENTPD1|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0|1419.1618.1619||1475|1","NT5C2|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0|1677.381.1678|622.1679|386|1","DDHD2|0.0.0.2.0.0.0.0.0.0.0.0.0|8|0||1680.1681||1","TMEM63C|0.0.0.5.0.0.0.0.0.0.0.0.0|8|0|1682.1683.1684|||1","TECPR2|0.0.0.3.0.0.0.0.0.0.0.0.0|8|0|1685.1686|622.1687||1","AP4E1|0.0.0.3.0.0.0.0.0.0.0.0.0|8|0|1688.1689|1690.714|763|1","AP4B1|0.0.0.3.0.0.0.0.0.0.0.0.0|8|0|1688.1689|1691.1680|763|1","AP4M1|0.0.0.3.0.0.0.0.0.0.0.0.0|8|0|962.1692.1693|211.1694|763|1","AP4S1|0.0.0.3.0.0.0.0.0.0.0.0.0|8|0|1688.1689|267.268|763|1","ALDH18A1|0.0.0.3.0.0.0.0.0.0.0.0.0|8|0|1695.1055.1696|1697.1348|1698|1","MARS2|0.0.0.3.0.0.0.0.0.0.0.0.0|8|0|28.29.823|810.112|827|1","HPDL|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0||||1","CHP1|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0||||1","IBA57|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|1409.1410|1085.1699||1","FARS2|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|28.1391.29|1700.1701|30|1","PCYT2|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|1702.1703.1704||1705|1","ALDH3A2|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|322.1706.1707|1708.1709|1710|1","ERLIN1|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|1606.1607.1608|||1","KIDINS220|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|556.1711.558||558|1","SELENOI|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|1350.1702.1351||1705|1","HACE1|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|1712.1713.1486|||1","UBAP1|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|1714.1503.1715|||1","KPNA3|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|882.1716.1717||73|1","VPS37A|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|1714.1503.1715|1661.1718|1184|1","AMPD2|0.0.0.1.0.0.0.0.0.0.4.0.0|8|1024|1719.1720.382|1721.1661|63|1","ABHD16A|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|395.1722.1436||1723|1","EIF4G1|0.0.0.1.0.0.0.0.0.0.0.0.0|0|8|839.1724.1725|752.753|402|1","PI4KA|0.0.0.1.0.0.0.0.0.0.0.0.0|8|0|1602.1726.1727||59|1","UNC13A|0.0.0.0.3.0.0.0.0.0.0.0.0|16|0|1728.119.1729||1653|1","PLEC|0.0.0.0.3.0.0.0.1.2.0.0.0|784|0|441.1730|1731.1732|445|1","NFKBIB|0.0.0.0.3.0.0.0.0.0.0.0.0|0|16|1733.1734.1735||226|1","RPH3A|0.0.0.0.3.0.0.0.0.0.0.0.0|16|0|1736.117.118|||1","FADS3|0.0.0.0.3.0.0.0.0.0.0.0.0|0|16||||1","CD79B|0.0.0.0.3.0.0.0.0.0.0.0.0|0|16|1737.1738.1739|1740.1741|1737|1","COLQ|0.0.0.0.2.0.0.0.0.0.0.0.0|16|0|135.146.147|1742.1743||1","AGRN|0.0.0.0.2.2.0.0.0.0.2.0.5|4112|1056|1744.1745.1746|1747.1748|1749|1","VMA21|0.0.0.0.2.0.0.0.1.0.2.0.0|256|1040|1750|||1","GMPPB|0.0.0.0.2.0.0.0.0.5.4.0.0|1552|0||||0","DPAGT1|0.0.0.0.2.0.0.0.0.0.0.0.0|16|0|1751.1124.1752|1371.1753|1754|1","ALG2|0.0.0.0.2.0.0.0.0.0.0.0.0|16|0|1751.1124.1752|1755|1126|1","ALG14|0.0.0.0.2.0.0.0.0.0.0.0.0|16|0|1751.1124.1752||1126|1","GFPT1|0.0.0.0.2.0.0.0.0.0.5.0.0|16|1024|1756.1757.1758|1759.1760|1761|1","MADD|0.0.0.0.1.0.0.0.0.0.0.0.0|0|16|1762.1763.878|||1","CHD8|0.0.0.0.1.0.0.0.0.0.0.0.0|16|0|1764.1765.1766||1167|1","NPM3|0.0.0.0.1.0.0.0.0.0.0.0.0|0|16|1767.1768|||1","PUS1|0.0.0.0.1.0.0.0.0.0.0.0.4|4096|16|1769.1770.1771|1772.1773||1","RER1|0.0.0.0.1.0.0.0.0.0.0.0.0|0|16|1774.1775.1452|||1","SLC25A1|0.0.0.0.1.0.0.0.0.0.0.0.0|16|0|942|1776.514||1","TRIM45|0.0.0.0.1.0.0.0.0.0.0.0.0|0|16|1486.1777.1778|||1","MYO9A|0.0.0.0.1.0.0.0.0.0.0.0.0|16|0|1779.566.1780||321|1","CAMTA1|0.0.0.0.1.0.0.0.0.0.0.0.0|0|16|1781.1782.1783|1784.1672||1","TOR1AIP1|0.0.0.0.1.0.0.0.0.2.0.0.0|528|0|1785.1786.1787|||1","VAMP2|0.0.0.0.1.0.0.0.0.0.0.0.0|0|16|1788.1789.1251||923|1","PREPL|0.0.0.0.1.0.0.0.0.0.0.0.0|16|0|1790.1791.1792|1793.1794||1","CLIP3|0.0.0.0.1.0.0.0.0.0.0.0.0|0|16|1592.1795.1662|||1","LAMB2|0.0.0.0.1.0.0.0.0.0.0.0.0|16|0||1796.1753||1","RHOB|0.0.0.0.1.0.0.0.0.0.0.0.0|0|16|1797.1798.1799||984|1","LAMA5|0.0.0.0.1.0.0.0.0.0.0.0.0|16|0|1800.1575.1801||1749|1","SLC3A1|0.0.0.0.1.0.0.0.0.0.0.0.0|0|16|1802.1803|1804.1805|1806|1","CAMKMT|0.0.0.0.1.0.0.0.0.0.0.0.0|0|16|1807.1808|1794.1809|1810|1","PPM1B|0.0.0.0.1.0.0.0.0.0.0.0.0|0|16|1811.1812.1337|1794.1809|1813|1","ECEL1|0.0.0.0.4.0.0.0.0.0.0.0.6|4096|16|1274.919.1411|562.563||1","CHRNG|0.0.0.0.4.0.0.0.0.0.0.0.0|16|0|1814.1815.1816|328.1817|1818|1","FGFR2|0.0.0.0.4.0.0.0.0.0.0.0.0|0|16|1819.1820.1060|1821.1822|1823|1","LRP4|0.0.0.0.4.0.0.0.0.0.0.0.0|16|0||1824.1825||1","DOK7|0.0.0.0.4.0.0.0.0.0.0.0.5|4112|0|1826.1553.1827|1828.1759||1","MUSK|0.0.0.0.4.0.0.0.0.0.0.0.6|4112|0|704.705.1829|1742.1743|1830|1","RAPSN|0.0.0.0.4.0.0.0.0.0.0.0.6|4112|0|135.1831.1157|1817.75||1","SLC18A3|0.0.0.0.4.0.0.0.0.0.0.0.0|16|0|1832.1833.705||1653|1","CHRNA1|0.0.0.0.6.12.0.0.0.0.0.0.0|16|32|3.1375.135|328.1817|1834|1","CHRNB1|0.0.0.0.6.0.0.0.0.0.0.0.0|16|0|1835.1836.1837|1742.1743|1818|1","CHRND|0.0.0.0.6.0.0.0.0.0.0.0.0|16|0||||0","RYR1|0.0.0.0.6.11.0.0.2.0.6.0.5|5408|16|1838.1839.1840|457.1841|1154|1","SNAP25|0.0.0.0.6.0.0.0.0.0.0.0.0|16|0|1842.1728.1843||1653|1","COL13A1|0.0.0.0.7.0.0.0.0.0.0.0.0|16|0|1844.1845.146||1806|1","CHRNE|0.0.0.0.7.0.0.0.0.0.0.0.0|16|0|135.1814.1815|1742.1743|1818|1","CHAT|0.0.0.0.7.0.0.0.0.0.0.0.0|16|0||1742.1743||1","TPM2|0.0.0.0.7.9.0.0.0.0.2.0.5|4128|1040|454.455.456|457.1846|464|1","NEB|0.0.0.0.7.11.2.0.0.0.6.0.0|96|1040|1847.1848.1849|457.676|301|1","STAC3|0.0.0.0.5.12.0.0.0.0.0.0.0|32|16|1850.1105.1851|1852.1853||1","KLHL41|0.0.0.0.5.12.0.0.0.0.0.0.0|32|16|1854.1855.1062|74.1856||1","SCN4A|0.0.0.0.5.11.0.0.0.0.6.0.5|4144|1024|1857.730.1094|1776.1224||1","MYH7|0.0.0.0.5.13.2.0.0.0.6.7.0|2144|1040|1858.461.1859|1860.1861|402|1","DES|0.0.0.0.5.8.0.0.2.3.0.2.0|2320|544|1785.5.1862|1863.133|1043|1","ITGA7|0.0.0.0.5.0.0.0.0.0.2.0.0|1024|16|1864.1865.1866|1867.1868|1043|1","LMOD3|0.0.0.0.5.12.0.0.0.0.0.0.0|32|16|1869.1870.1871||301|1","BIN1|0.0.0.0.5.7.0.0.0.0.2.0.0|32|1040|1872.1873.1874|313.1326|1875|1","SELENON|0.0.0.0.5.0.0.0.1.0.2.0.0|1280|16|1876.1877.593|||1","KIF20A|0.0.0.0.0.3.0.0.0.0.0.4.0|2048|32|1294.1295.1878||321|1","MAB21L2|0.0.0.0.0.3.0.0.0.0.0.0.0|0|32|1879.1880.1881|||1","KIF14|0.0.0.0.0.3.0.0.0.0.0.0.0|0|32|1882.1883.1884||321|1","TLE3|0.0.0.0.0.3.0.0.0.0.0.0.0|0|32|1885.1886.1887||501|1","GNB1|0.0.0.0.0.3.0.0.0.0.0.0.0|0|32|1888.1889.1890||1891|1","PPP2R2A|0.0.0.0.0.3.0.0.0.0.0.0.0|0|32|1892.369.370||76|1","CSNK2A1|0.0.0.0.0.3.0.0.0.0.0.0.0|0|32||||1","RAF1|0.0.0.0.0.3.0.0.0.0.0.4.0|2048|32||1605.1893||1","HIF1A|0.0.0.0.0.3.0.0.0.0.0.0.0|0|32|1894.1895.1896||350|1","PRMT1|0.0.0.0.0.3.0.0.0.0.0.0.0|0|32|1897.1898.1899||1900|1","ASH2L|0.0.0.0.0.3.0.0.0.0.0.0.0|0|32|1901.1902.1903||1904|1","RPN1|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1124.1905.1906||1126|1","RPN2|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1905.1907.1906||1126|1","PHB|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32||245||1","UGGT1|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1908.1909.1910||174|1","PHB2|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|400.1911.1912||235|1","PSMC5|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1913.1914.1915||1916|1","CCT7|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|906.907.908|||1","CSE1L|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1426.1293.1716||73|1","MCM2|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32||||1","CUL1|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|41.1917.1918||843|1","CUL3|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1919.1920.1921|1922.1923|1924|1","OBSL1|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1925.1848.1926|1927.1928||1","PIR|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1929.1930.1931|||1","CRIP1|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32||||1","ACTN3|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1932.1933.1837||1043|1","LUZP4|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32||||1","VIM|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1934.1935.1936|1627.1937|564|1","ACTB|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32||1938.1784||1","MYH9|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1939.1940.1929|1941.6|8|1","PPP1CA|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1942.1943.1515||1944|1","DNAAF3|0.0.0.0.0.1.0.0.0.0.0.0.0|0|32|1218.1945.1946|1947.1948|222|1","BCL2L1|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1949.1950.272||340|1","PRKAA2|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1951.1159.1952||843|1","MAP3K20|0.0.0.0.0.5.0.0.0.0.0.0.0|32|0|1953.1954.1955||1813|1","FBXO32|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|20.21||516|1","CLIP4|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1598.456|||1","USP25|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1956.1957.1958||1038|1","ACO1|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1959.1960.1961||1342|1","TBC1D1|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1962.1963.1964||1285|1","PDLIM5|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1965.1966.1967||301|1","PARD3|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1968.1724.260||372|1","NUDT3|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1969.286.176|||1","ZNF71|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|167.168|||1","FKBP1A|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1970.593.1971|||1","EDEM2|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1972.1973.1974||174|1","TULP3|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1975.1078.1976|||1","TMEM260|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1411.1434.1481|||1","TNKS2|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1977.1978.1540|||1","HOMER3|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1979.1980.1981||1982|1","PYROXD1|0.0.0.0.0.5.0.0.1.2.0.0.0|800|0|1983.1984|||1","NOSIP|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1985.1986.1987|||1","SRI|0.0.0.0.0.5.0.0.0.0.0.0.0|0|32|1988.627.1989|||1","CCDC78|0.0.0.0.0.2.0.0.0.0.0.0.0|32|0|646|245||1","OBSCN|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|296.297.298||301|1","CAPN3|0.0.0.0.0.2.0.0.0.3.0.0.0|512|32|184.1990.1062|1991.1992|301|1","FDXR|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|1478.1993.1994|||1","SPATA20|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32||||1","MYMX|0.0.0.0.0.2.0.0.0.0.0.0.0|32|0||||0","ALDH4A1|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|1995.1996.1722|295.1997|1056|1","TMEM106C|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32||||1","IL10RA|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|1998.1999.2000|2001.2002|2003|1","HSF2BP|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|2004.2005.2006|||1","SPEG|0.0.0.0.0.2.0.0.0.0.0.0.0|32|0|1305.166.2007|2008.2009||1","PTEN|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|2010.2011.779|2012.2013|2014|1","ATP2B1|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|1919.1156.2015||315|1","PICK1|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|2016.1836.659|||1","MEOX2|0.0.0.0.0.2.0.0.0.2.0.0.0|0|544|2017.2018.2019|||1","REL|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|1811.2020.2021||1020|1","SMURF2|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|1336.2022.2023||1924|1","FXR1|0.0.0.0.0.2.0.0.0.0.0.0.0|32|0|677.1510.2024|||1","UNC119|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|1826.2025.2026|2027.2028||1","LMO2|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|2029.1472.168||1020|1","PDE4DIP|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|236.1160.2030|||1","C12orf75|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32||||0","CFTR|0.0.0.0.0.2.0.0.0.0.0.0.0|0|32|2031.2032.149|2033.2034|2035|1","EEF1A2|0.0.0.0.0.9.0.0.0.0.0.0.0|0|32|2036.2037.1282||290|1","AMOT|0.0.0.0.0.9.0.0.0.0.0.0.0|0|32|1146.2038.644||568|1","IRS4|0.0.0.0.0.9.0.0.0.0.0.0.0|0|32|2039.2040.2041||1150|1","MCM5|0.0.0.0.0.9.0.0.0.0.0.0.0|0|32|2042.2043.2044||2045|1","PLK1|0.0.0.0.0.9.0.0.0.0.0.0.0|0|32|2046.2047.1534||1346|1","E2F1|0.0.0.0.0.9.0.0.0.0.0.0.0|0|32|2048.2049.2050||415|1","MYOD1|0.0.0.0.0.9.0.0.0.0.0.0.0|32|0|1870.2051.2052||222|1","HEY1|0.0.0.0.0.9.0.0.0.0.0.0.0|0|32|2053.2054.2055||501|1","HNF1A|0.0.0.0.0.9.0.0.0.0.0.0.0|0|32|2056.2057.963|2058.2059|2060|1","CAMK2A|0.0.0.0.0.9.0.0.0.0.0.0.0|0|32|2061.2062.2063||626|1","YWHAZ|0.0.0.0.0.14.0.0.0.0.0.0.0|0|32|2064.2065.625||2066|1","YWHAQ|0.0.0.0.0.14.0.0.0.0.0.0.0|0|32|764.1689.513||2066|1","YWHAB|0.0.0.0.0.14.0.0.0.0.0.0.0|0|32|2067.2068.2069||2066|1","YWHAH|0.0.0.0.0.14.0.0.0.0.0.0.0|0|32|2070.2071.734||2066|1","YWHAG|0.0.0.0.0.14.0.0.0.0.0.0.0|0|32|1032.1033.40||2066|1","FCGR2A|0.0.0.0.0.4.0.0.0.0.0.0.0|0|32|2072.2073.2074||1622|1","KCNAB2|0.0.0.0.0.4.0.0.0.0.0.0.0|0|32|1476.1478.2075|1026.2076||1","PAX7|0.0.0.0.0.4.0.0.0.0.0.0.0|32|0|1855.554.335|2077.2078|1020|1","FYN|0.0.0.0.0.4.0.0.0.0.0.0.0|0|32|660.1218.2079||402|1","CRK|0.0.0.0.0.4.0.0.0.0.0.0.0|0|32|2080.2081.2082||350|1","NCK1|0.0.0.0.0.4.0.0.0.0.0.0.0|0|32|482.2083.1725||269|1","PIK3R3|0.0.0.0.0.4.0.0.0.0.0.0.0|0|32|2084.2085.2086||472|1","VAV2|0.0.0.0.0.4.0.0.0.0.0.0.0|0|32|2087.2088.2089||2090|1","NTRK3|0.0.0.0.0.4.0.0.0.0.0.0.0|0|32|2091.1711.2092||1823|1","CORO1C|0.0.0.0.0.10.0.0.0.0.0.0.0|0|32|484.2093.2094|||1","CAPZA2|0.0.0.0.0.10.0.0.0.0.0.0.0|0|32|2095.2096.2097||321|1","FHL2|0.0.0.0.0.10.0.0.0.0.0.0.0|0|32|1980.1981.1783|463.2098|2099|1","ATP2A2|0.0.0.0.0.10.0.0.0.0.0.0.0|0|32|2100.2101.2102|2103.2104|464|1","ACTN4|0.0.0.0.0.10.0.0.0.0.0.0.0|0|32|1837.1305.2105|2106.2107|1622|1","TPM4|0.0.0.0.0.10.0.0.0.0.0.0.0|0|32|454.455.456||464|1","MYO1B|0.0.0.0.0.10.0.0.0.0.0.0.0|0|32|2108.2109.2110||321|1","IQGAP1|0.0.0.0.0.10.0.0.0.0.0.0.0|0|32|496.2111.1146||372|1","RTN4|0.0.0.0.0.10.0.0.0.0.0.0.0|0|32|683.1060.2112||1617|1","ITGA3|0.0.0.0.0.10.0.0.0.0.0.0.0|0|32|659.2113.2114|2027.2106|1043|1","PPP1R3F|0.0.0.0.0.6.0.0.0.0.0.0.0|0|32|2115.2116.2117||2118|1","PTGER4|0.0.0.0.0.6.0.0.0.0.0.0.0|0|32|2119.2120.2121||2122|1","ZNF227|0.0.0.0.0.6.0.0.0.0.0.0.0|0|32|167.168|||1","RYR3|0.0.0.0.0.6.0.0.0.0.0.0.0|32|0|1838.1839.1840||2123|1","MEGF10|0.0.0.0.0.6.0.0.0.0.2.0.0|32|1024|412.2124.2125|43.652|427|1","NUFIP1|0.0.0.0.0.6.0.0.0.0.0.0.0|0|32|2126.2127.1735|||1","AMPH|0.0.0.0.0.6.0.0.0.0.0.0.0|0|32|1157.1158||1875|1","SCN1B|0.0.0.0.0.6.0.0.0.0.0.3.0|2048|32|2128.2129.2130|732.2131|2132|1","CNTN1|0.0.0.0.0.6.0.0.0.0.0.0.0|32|0|642.545.509|74.273|263|1","NLGN3|0.0.0.0.0.6.0.0.0.0.0.0.0|0|32|2133.2134.2135||263|1","TRDN|0.0.0.0.0.13.0.0.0.0.0.7.0|2048|32|1989.1309.1839|2136.2137|464|1","MB|0.0.0.0.0.13.0.0.2.0.0.0.0|256|32|2138.2139.2140|||1","LMOD2|0.0.0.0.0.13.0.0.0.0.0.7.0|2048|32|2141.1062.296||301|1","C10orf71|0.0.0.0.0.13.0.0.0.0.0.0.0|0|32||||0","CKM|0.0.0.0.0.13.0.0.0.0.0.0.0|0|32|||1698|1","TNNC1|0.0.0.0.0.13.0.0.0.0.0.7.0|2048|32|2142.2143.2144|463.2145|1749|1","NRAP|0.0.0.0.0.13.0.0.0.0.0.0.0|0|32||||1","SMYD1|0.0.0.0.0.13.0.0.0.0.0.0.0|0|32|1015.2146.2147||1810|1","CSRP3|0.0.0.0.0.13.0.0.0.0.0.7.0|2048|32|2148.2149.2150|462.2151|301|1","MYPN|0.0.0.0.0.13.0.0.0.0.0.7.0|2080|0|2152.296.297|463.2098|301|1","SRL|0.0.0.0.0.13.0.0.0.0.0.0.0|0|32|2153.2154|||1","MYOZ2|0.0.0.0.0.13.0.0.0.0.0.7.0|2048|32|1980.1981.1783|2155.958|301|1","MYF5|0.0.0.0.0.12.0.0.0.0.0.0.0|0|32|1870.2052.2156||368|1","MYOG|0.0.0.0.0.12.0.0.0.0.0.0.0|0|32|2157.1015.1870|||1","ANKRD2|0.0.0.0.0.12.0.0.0.0.0.0.0|0|32|2158.454.2159||301|1","KLHL40|0.0.0.0.0.12.0.0.0.0.0.0.0|32|0|1876.1855.1877|||1","MYBPC2|0.0.0.0.0.12.0.0.0.0.0.0.0|0|32|296.297.298||301|1","XIRP2|0.0.0.0.0.12.0.0.0.0.0.0.0|0|32|2160.61.725||301|1","TNNI2|0.0.0.0.0.12.0.0.0.0.0.0.6|4096|32|4.464.2161|1846.2162|321|1","TNNI1|0.0.0.0.0.12.0.0.0.0.0.0.0|0|32|4.2163.2164||321|1","CMYA5|0.0.0.0.0.12.0.0.0.0.0.0.0|0|32||||1","TNNT3|0.0.0.0.0.12.0.0.0.0.0.0.6|4128|0|4.2163.2164|1846.2162|321|1","MYOZ1|0.0.0.0.0.12.0.0.0.0.0.0.0|0|32|1980.1981.1062||301|1","TRIM72|0.0.0.0.0.12.0.0.0.0.0.0.0|0|32|2165.166.2166|||1","MYH1|0.0.0.0.0.11.0.0.0.0.0.0.0|0|32|454||321|1","MYH2|0.0.0.0.0.11.0.0.0.0.0.0.0|32|0|1859.454|2167.888|321|1","TNNC2|0.0.0.0.0.11.0.0.0.0.0.0.0|32|0|459.4.2164||321|1","MYLPF|0.0.0.0.0.11.0.0.0.0.0.0.5|4096|32||||1","XIRP1|0.0.0.0.0.11.0.0.0.0.0.0.0|0|32|2168.2169.2170||301|1","TCAP|0.0.0.0.0.11.0.0.0.3.6.7.0|3584|32|1869.2171.1858|302.458|301|1","TNNT1|0.0.0.0.0.11.0.0.0.0.0.0.0|32|0|4.2164.296|457.676|321|1","MYO18B|0.0.0.0.0.11.0.0.0.0.0.0.0|32|0|298||321|1","RPL3L|0.0.0.0.0.11.0.0.0.0.0.2.0|2048|32|1284.823.1434||1364|1","MYL1|0.0.0.0.0.11.0.0.0.0.0.0.0|32|0|461.1859.454||321|1","CACNA1S|0.0.0.0.0.11.0.0.0.3.0.0.5|4640|0|2172.2173.1193|2174.2175|2176|1","MYOM2|0.0.0.0.0.11.0.0.0.0.0.0.0|0|32|296.297.298||301|1","ANKRD1|0.0.0.0.0.11.0.0.0.0.0.7.0|2048|32|2177.2178.2179||301|1","ATP2A1|0.0.0.0.0.11.0.0.2.0.0.0.0|256|32|2180.2181.2182|888|464|1","PYGM|0.0.0.0.0.11.0.3.0.3.0.0.0|128|544|2183.2184.2185|2186.1841|2187|1","TRIM63|0.0.0.0.0.8.0.0.2.3.0.0.0|256|544|2188.2189.2190||301|1","TRIM55|0.0.0.0.0.8.0.0.0.3.0.0.0|0|544|2191.2192.1486||301|1","TNNI3|0.0.0.0.0.8.0.0.0.0.0.7.0|2048|32|459.461.1859|2151.2193|464|1","MYBPC3|0.0.0.0.0.8.0.0.0.0.0.2.0|2080|0|2194.2163.2195|463.2145|2196|1","TNNT2|0.0.0.0.0.8.0.0.0.0.0.7.0|2048|32|461.1859.2197|1359.2151|464|1","MYL2|0.0.0.0.0.8.0.0.0.0.0.2.0|2048|32|2052.1848.2198|462.2199|464|1","PDLIM3|0.0.0.0.0.8.0.0.0.0.0.0.0|0|32|2200.1071||301|1","MYOM1|0.0.0.0.0.8.0.0.0.3.0.0.0|0|544|2201.296.297||301|1","ACTC1|0.0.0.0.0.8.0.0.0.0.0.2.0|2048|32|1869.1871.2198|2202.2203|464|1","CASQ1|0.0.0.0.0.8.0.0.2.0.0.0.0|256|32|2204.1851.2205||2206|1","FLNC|0.0.0.0.0.8.3.0.2.3.0.2.0|2368|544|296.297.298|458.656|301|1","TRIM54|0.0.0.0.0.8.0.0.2.0.0.0.0|256|32|1287.1288.1315||301|1","ACTN2|0.0.0.0.0.8.2.0.0.0.0.2.0|2144|0|2061.1837.1629|2207.463|1043|1","SVIL|0.0.0.0.0.7.0.0.2.0.0.0.0|256|32|2095.2096.2208|||1","CNN1|0.0.0.0.0.7.0.0.0.0.0.0.0|0|32|2209.2210.2164|||1","HACD1|0.0.0.0.0.7.0.0.0.0.0.2.0|2080|0|2211.1613.1131||1131|1","SNTA1|0.0.0.0.0.7.0.0.0.0.0.5.0|2048|32|2212.2213.2214|2215.2216|402|1","CAMK2G|0.0.0.0.0.7.0.0.0.0.0.0.0|0|32|692.2217.2218||626|1","RYR2|0.0.0.0.0.7.0.0.0.0.0.5.0|2048|32|2219.2220.2171|1863.1359|464|1","CACNA1C|0.0.0.0.0.7.0.0.0.0.0.5.0|2048|32|2221.2222.1118|1359.2215|1150|1","ENO3|0.0.0.0.0.7.0.3.0.0.0.0.0|128|32|899.900.901|2223.888|902|1","FKBP1B|0.0.0.0.0.7.0.0.0.0.0.0.0|0|32|627.2224.2225|||1","CFL2|0.0.0.0.0.7.0.0.0.0.2.0.0|32|1024|2226.2227.2228|457.2229|2230|1","DYSF|0.0.0.0.0.7.3.0.0.3.2.0.0|576|1056|2231.2232.2233|157.656||1","KBTBD13|0.0.0.0.0.7.0.0.0.0.0.0.0|32|0||||0","FHL1|0.0.0.0.0.7.0.0.1.3.2.0.0|768|1056||288.2234||1","DNAJB5|0.0.0.0.0.7.0.0.0.0.0.0.0|0|32|2235.1910.132|||1","ANO5|0.0.0.0.0.0.1.0.0.3.0.0.0|576|0|1266.1267.2166|302.2236|427|1","KLHL9|0.0.0.0.0.0.1.0.0.0.0.0.0|64|0|1240.1241.578||23|1","TIA1|0.0.0.0.0.0.3.0.0.0.2.0.0|64|1024|829.1583.2237|2234.7||1","MYOT|0.0.0.0.0.0.3.0.2.3.6.0.0|320|1536|632.2238.454|656.2229|301|1","GNE|0.0.0.0.0.0.3.0.0.0.0.0.0|64|0|2239.2240.2241|2234.2242|2243|1","PLIN4|0.0.0.0.0.0.2.0.0.0.0.0.0|64|0|1123.1668||553|1","SMPX|0.0.0.0.0.0.2.0.0.0.0.0.0|64|0|646.454|2244.946||1","CAV3|0.0.0.0.0.0.2.0.2.3.0.5.0|2880|0|2011.2245.2246|302.2186|402|1","LDB3|0.0.0.0.0.0.2.0.2.0.0.7.0|2368|0|2200.1071|656.230|301|1","PHKA1|0.0.0.0.0.0.0.3.0.0.0.0.0|128|0|2247.2248|1841.1669|1900|1","PGAM2|0.0.0.0.0.0.0.3.0.0.0.0.0|128|0|899.900.901|2186.1841|2249|1","CPT2|0.0.0.0.0.0.0.2.0.0.0.0.0|128|0|2250.2251.2252|193.1354|1660|1","SLC25A20|0.0.0.0.0.0.0.2.0.0.0.0.0|128|0|2251.2252.2253|2254.462|194|1","ACAD9|0.0.0.0.0.0.0.2.0.0.0.0.0|128|0|2255.2256.2257|872.2258||1","ETFB|0.0.0.0.0.0.0.2.0.0.0.0.0|128|0|1376.1421.1377|1379.1380||1","GYS1|0.0.0.0.0.0.0.2.0.0.0.0.0|128|0|2259.2260.2261|1334.2203|2187|1","ETFDH|0.0.0.0.0.0.0.2.0.0.0.0.0|128|0|1376.1421.1378|1379.1380||1","ACADVL|0.0.0.0.0.0.0.2.0.0.0.0.0|128|0|2262.1376.1560|1841.1669|1660|1","HADH|0.0.0.0.0.0.0.2.0.0.0.0.0|0|128|1357.2263.1358|2264.2265|1087|1","SLC16A1|0.0.0.0.0.0.0.2.0.0.0.0.0|128|0|2266.2267.640|2186.2264|427|1","PGK1|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|944.2268.899|2186.2269|902|1","LDHA|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|2270.2271.2272|913.2273|2274|1","GBE1|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|2184.2261.2275|294.116|2187|1","ABHD5|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|2276.2277.2278|2279.980|2280|1","GAA|0.0.0.0.0.0.0.1.0.0.0.1.0|2176|0|2183.2185.2261|2281.652|1372|1","SLC22A5|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|2282.2283.784|1234.2284|139|1","RBCK1|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|2285.2286.2287|2145.2288|91|1","PNPLA2|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|2289.2276.2290|43.2291|2280|1","PRKAG2|0.0.0.0.0.0.0.1.0.0.0.4.0|2176|0|1270.2184.2292|2293.2155|843|1","PFKM|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|2294.1758.899|2186.787|1372|1","AGL|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0||2295.2296|2187|1","GYG1|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|2259.2260.2261|2155.2297|2187|1","PNPLA8|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|2298.2299.877|||1","LPIN1|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|38.2300.2301|1923.2269|1723|1","FLAD1|0.0.0.0.0.0.0.1.0.0.0.0.0|128|0|152||2302|1","UNC45B|0.0.0.0.0.0.0.0.2.0.0.0.0|256|0||||1","MLIP|0.0.0.0.0.0.0.0.2.0.0.0.0|256|0|1039.1040.2303|||1","CLCN1|0.0.0.0.0.0.0.0.2.0.0.0.5|4352|0|2304.2305.1266|303.1224||1","FILIP1|0.0.0.0.0.0.0.0.2.0.0.0.0|256|0||||1","RILPL1|0.0.0.0.0.0.0.0.2.0.0.0.0|256|0|2306.1164.2307|||1","DMPK|0.0.0.0.0.0.0.0.2.0.0.0.0|256|0|1857.1785.2146|258.709||1","HNRNPA2B1|0.0.0.0.0.0.0.0.3.0.0.0.0|256|0|2308.2309.2310||14|1","PABPN1|0.0.0.0.0.0.0.0.3.0.0.0.0|256|0|47.848.1518|2311.1308|76|1","GEMIN4|0.0.0.0.0.0.0.0.3.0.0.0.0|0|256|1438.1439.818|||1","CNBP|0.0.0.0.0.0.0.0.3.0.5.0.0|256|1024|2312.2313.2314|979.2315||1","ORAI1|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|1398.2316.2153|2317.1363|2318|1","ISCU|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|1399.2319.1409|1423.2320||1","MICU1|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|2321.1152.2322|||1","CLN3|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|614.2323.2324|773.1614|763|1","MCOLN1|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|310.2325.2326|95.96|763|1","HSPG2|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|654.2327.2328|2329.2330|981|1","ACVR1|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|2331.2332.2333|2334.2335|527|1","MSTN|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|2336.2124.2157|888|2337|1","DNAJB4|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|2235.1910.132|||1","STIM1|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|2338.1398.2204|1363.1841|2339|1","GIPC1|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|82.83.2340|||1","TRIM32|0.0.0.0.0.0.0.0.1.1.0.0.0|768|0|853.2341.2342|1841.313|23|1","KY|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|2143.166.2343|||1","CACNA1H|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|2344.2345.2346||2176|1","HRAS|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|2347.237.655|2348.1604|411|1","LAMP2|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|2349.2350.2351|2186.937|8|1","ZC4H2|0.0.0.0.0.0.0.0.1.0.0.0.0|256|0|2352.1588.2143|936.2353||1","COL6A3|0.0.0.0.0.0.0.0.0.6.2.0.0|1536|0|166|2354.669|1749|1","COL6A1|0.0.0.0.0.0.0.0.0.6.2.0.0|1536|0|1865.1866|2354.669|1749|1","COL6A2|0.0.0.0.0.0.0.0.0.6.2.0.0|1536|0||2354.669|1749|1","SGCA|0.0.0.0.0.0.0.0.0.3.6.0.0|512|1024|166.454|302.303|402|1","DUX4|0.0.0.0.0.0.0.0.0.3.0.0.0|512|0||||0","SGCB|0.0.0.0.0.0.0.0.0.3.1.0.0|512|1024||2355.2242|402|1","SYNC|0.0.0.0.0.0.0.0.0.3.0.0.0|0|512||||1","DMD|0.0.0.0.0.0.0.0.0.3.0.6.0|2560|0|1857.2129.459|2356.2357|402|1","LAMA4|0.0.0.0.0.0.0.0.0.3.0.2.0|2048|512|1865.1866.1885|463.2145|1273|1","SGCD|0.0.0.0.0.0.0.0.0.3.0.6.0|2560|0|2198.2358.2161|1307.2359|402|1","TMEM43|0.0.0.0.0.0.0.0.0.3.0.5.0|2560|0|1785.1786.2360|1863.2361|301|1","SGCG|0.0.0.0.0.0.0.0.0.3.0.0.0|512|0|2198.2358.2161|2362.2357|402|1","POPDC3|0.0.0.0.0.0.0.0.0.3.0.0.0|512|0|1448.1305.5||2132|1","BVES|0.0.0.0.0.0.0.0.0.3.0.0.0|512|0||||1","POMK|0.0.0.0.0.0.0.0.0.5.3.0.0|1536|0|2363.2364.1906|2365.35|2366|1","POMGNT1|0.0.0.0.0.0.0.0.0.5.3.0.0|1536|0|2367.2364.1906|2368.2369|2366|1","FKRP|0.0.0.0.0.0.0.0.0.5.3.0.0|1536|0|2370.2371.1109|2368.2369|2366|1","POMGNT2|0.0.0.0.0.0.0.0.0.5.3.0.0|1536|0|2370.2371.145|2368.2372|2366|1","POMT1|0.0.0.0.0.0.0.0.0.5.3.0.0|1536|0|2370.2371.2364|499.2368|2366|1","POMT2|0.0.0.0.0.0.0.0.0.5.3.0.0|1536|0|2370.2371.2364|499.2368|2366|1","HMGCR|0.0.0.0.0.0.0.0.0.2.0.0.0|512|0|2373.2374.1361||2375|1","BOK|0.0.0.0.0.0.0.0.0.2.0.0.0|0|512|2376.199.201||340|1","CAVIN1|0.0.0.0.0.0.0.0.0.2.0.0.0|512|0|2377.2378.1484|||1","SCRN1|0.0.0.0.0.0.0.0.0.2.0.0.0|0|512||||1","LAMB1|0.0.0.0.0.0.0.0.0.2.3.0.0|0|1536|2379.2380.2381|2382.2383|1749|1","SYNE2|0.0.0.0.0.0.0.0.0.2.0.0.0|512|0|2384.2385.970|1307.2386|301|1","SYNE4|0.0.0.0.0.0.0.0.0.2.0.0.0|0|512|1779.566.1780|6.2387||1","CHRNA9|0.0.0.0.0.0.0.0.0.2.0.0.0|0|512|1157.1158||2388|1","LAMA2|0.0.0.0.0.0.0.0.0.2.2.0.0|1536|0|2379.2380.2381|2386.2389|402|1","LIMS2|0.0.0.0.0.0.0.0.0.2.0.0.0|512|0|2380.2390.2391||2392|1","ATP1B4|0.0.0.0.0.0.0.0.0.2.0.0.0|0|512|2393.69.983||1120|1","UPK1A|0.0.0.0.0.0.0.0.0.2.0.0.0|0|512|897.898|||1","TMEM30B|0.0.0.0.0.0.0.0.0.2.0.0.0|0|512|1225.1972.2394||427|1","JAG2|0.0.0.0.0.0.0.0.0.2.0.0.0|512|0|2395.501.2396||501|1","TP63|0.0.0.0.0.0.0.0.0.4.0.0.0|0|512|2397.1442.2398|2399.2400|564|1","COL5A1|0.0.0.0.0.0.0.0.0.4.0.0.0|0|512|2401.2402.2403|2404.2405|1806|1","AIM2|0.0.0.0.0.0.0.0.0.4.0.0.0|0|512|2406.2407.2408||2409|1","SMCHD1|0.0.0.0.0.0.0.0.0.4.0.0.0|512|0|2410.2411.2412|2413.2355||1","KAT2B|0.0.0.0.0.0.0.0.0.1.0.0.0|0|512|2414.2415.2416||501|1","CRPPA|0.0.0.0.0.0.0.0.0.1.0.0.0|512|0||||0","RACGAP1|0.0.0.0.0.0.0.0.0.1.0.0.0|0|512|2417.431.432|||1","CCDC85C|0.0.0.0.0.0.0.0.0.1.0.0.0|0|512||||1","CEP63|0.0.0.0.0.0.0.0.0.1.0.0.0|0|512|2418.2419.2420|888||1","FRG1|0.0.0.0.0.0.0.0.0.1.0.0.0|0|512||||0","GGPS1|0.0.0.0.0.0.0.0.0.1.0.0.0|512|0|2373.1994.2421||2375|1","HNRNPDL|0.0.0.0.0.0.0.0.0.1.0.0.0|512|0|1735.2422.1050|289.2413||1","LRIF1|0.0.0.0.0.0.0.0.0.1.0.0.0|512|0|2423.2411.2412||368|1","TRAPPC11|0.0.0.0.0.0.0.0.0.1.4.0.0|1536|0|2424.2425.2426|2427.1348||1","RPSA|0.0.0.0.0.0.0.0.0.1.0.0.0|0|512|2428.2429.2430|2431.2432|1364|1","DPM3|0.0.0.0.0.0.0.0.0.1.4.0.0|1536|0|2433.2434.2370|2234.1868|1754|1","EMD|0.0.0.0.0.0.0.0.0.1.0.0.0|512|0|649.2435.1785|1743.161|1043|1","IFI16|0.0.0.0.0.0.0.0.0.1.0.0.0|0|512|1929.2436.2407||2409|1","POGLUT1|0.0.0.0.0.0.0.0.0.1.0.0.0|512|0|2437.668.2150|245|2438|1","TMEM92|0.0.0.0.0.0.0.0.0.1.0.0.0|0|512||||1","TNPO3|0.0.0.0.0.0.0.0.0.1.0.0.0|512|0|1716.1717.2439|313.914|162|1","COL12A1|0.0.0.0.0.0.0.0.0.0.2.0.0|1024|0|1865.1866.2440|2441|1806|1","TAZ|0.0.0.0.0.0.0.0.0.0.2.1.0|2048|1024||1370.1852||1","CHKB|0.0.0.0.0.0.0.0.0.0.2.0.0|1024|0|1702.330.1703|1396.2442|332|1","ADAT3|0.0.0.0.0.0.0.0.0.0.3.0.0|0|1024||||0","FKTN|0.0.0.0.0.0.0.0.0.0.3.4.0|3072|0|2443.2444.2370|2368.302|2366|1","TUBA8|0.0.0.0.0.0.0.0.0.0.3.0.0|0|1024||52.2445|275|1","ISPD|0.0.0.0.0.0.0.0.0.0.3.0.0|0|1024||||0","LARGE1|0.0.0.0.0.0.0.0.0.0.3.0.0|1024|0|2168.2446.2447||2366|1","B3GALNT2|0.0.0.0.0.0.0.0.0.0.3.0.0|1024|0|2448.2449.2364|2368.2369|2366|1","TUBA1A|0.0.0.0.0.0.0.0.0.0.3.0.0|0|1024|447|2450.2451|275|1","B4GAT1|0.0.0.0.0.0.0.0.0.0.3.0.0|1024|0|2452.2453.2454||2366|1","TNFAIP8L2|0.0.0.0.0.0.0.0.0.0.1.0.0|0|1024|2455.2456.2457|||1","LST1|0.0.0.0.0.0.0.0.0.0.1.0.0|0|1024||||1","HLA-DPA1|0.0.0.0.0.0.0.0.0.0.1.0.0|0|1024|2458.2459.2460||2461|1","OS9|0.0.0.0.0.0.0.0.0.0.1.0.0|0|1024|1774.2462.2463||174|1","WLS|0.0.0.0.0.0.0.0.0.0.1.0.0|0|1024|2464.2465.2466|||1","MMP2|0.0.0.0.0.0.0.0.0.0.1.0.0|0|1024|2467.477.607|2468.2329|415|1","SETDB1|0.0.0.0.0.0.0.0.0.0.5.0.0|0|1024|2469.1006.1522||1810|1","DPM1|0.0.0.0.0.0.0.0.0.0.5.0.0|1024|0|2433.2434.2370|669.1371|1754|1","GOLGA2|0.0.0.0.0.0.0.0.0.0.5.0.0|1024|0|37.2010.2443|||1","COPB2|0.0.0.0.0.0.0.0.0.0.5.0.0|0|1024|1329.1452.790|||1","PITPNA|0.0.0.0.0.0.0.0.0.0.5.0.0|0|1024|1437.2470.1256|||1","INPP5K|0.0.0.0.0.0.0.0.0.0.5.0.0|1024|0|2471.2472.2473||59|1","TRAPPC2L|0.0.0.0.0.0.0.0.0.0.4.0.0|1024|0|2424.2425.2426|||1","BET1|0.0.0.0.0.0.0.0.0.0.4.0.0|1024|0|790.2474||923|1","RAB3D|0.0.0.0.0.0.0.0.0.0.4.0.0|0|1024|2475.2476.1792||2477|1","OR51I2|0.0.0.0.0.0.0.0.0.0.4.0.0|0|1024||||0","MPPE1|0.0.0.0.0.0.0.0.0.0.4.0.0|0|1024|2478.2479.1600||1601|1","RXYLT1|0.0.0.0.0.0.0.0.0.0.4.0.0|1024|0|2370.2371.2364||2366|1","FBXO6|0.0.0.0.0.0.0.0.0.0.4.0.0|0|1024|1974.1369.2480||174|1","MPDU1|0.0.0.0.0.0.0.0.0.0.4.0.0|1024|0|1751.2481.2482|||1","DPM2|0.0.0.0.0.0.0.0.0.0.4.0.0|1024|0|2433.2434.2370|609.1852|1601|1","PLN|0.0.0.0.0.0.0.0.0.0.0.6.0|2048|0|2483.1988.627|2151.2193|2145|1","CALM1|0.0.0.0.0.0.0.0.0.0.0.6.0|2048|0||||0","CALM3|0.0.0.0.0.0.0.0.0.0.0.6.0|2048|0||||0","FHOD3|0.0.0.0.0.0.0.0.0.0.0.6.0|2048|0||||1","CAP2|0.0.0.0.0.0.0.0.0.0.0.6.0|2048|0||||1","JPH2|0.0.0.0.0.0.0.0.0.0.0.6.0|2048|0|592.593.1851|2361.462||1","CASQ2|0.0.0.0.0.0.0.0.0.0.0.6.0|2048|0|1838.1989.1840|1359.2216|464|1","KCNE2|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2484.2485.2486|2131.2215|1312|1","CACNB2|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|1147.2222.1874|2216.2487|464|1","CTNNA3|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2221.2488.2489|2155.462|2014|1","KCNA5|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|1148.2490.2491|2361.2215||1","HCN4|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2220.1148.2102|462.1490|347|1","SCN2B|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2128.2130.2492|||1","SCN4B|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|1147.3.2130|2254.2215|2132|1","CALM2|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0||||0","AKAP9|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2493.2494.2495|2215.2487||1","NPPA|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2180.2496.2490|1490.2151|1273|1","SCN5A|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2497.1147.1148|2131.2155|2132|1","GPD1L|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2497.1340.2498|2131.2155|332|1","DSC2|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0||1863.2499||1","ANK2|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2493.1837.594|2215.1490|495|1","KCNH2|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2484.2500.1278|2131.2361||1","KCNQ1|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2484.2485.2180|2501.2131|2502|1","KCNE1|0.0.0.0.0.0.0.0.0.0.0.5.0|2048|0|2484.2485.2486|2131.2215|2132|1","TECRL|0.0.0.0.0.0.0.0.0.0.0.7.0|2048|0|1613.2503.2504|||1","RBM20|0.0.0.0.0.0.0.0.0.0.0.7.0|2048|0|1338.2505.2506|463.2145||1","MYH6|0.0.0.0.0.0.0.0.0.0.0.7.0|2048|0|1858.2507.2508|463.2145|402|1","KCNJ5|0.0.0.0.0.0.0.0.0.0.0.2.0|2048|0|1278.1279.2222|2509.2254|257|1","EYA4|0.0.0.0.0.0.0.0.0.0.0.2.0|2048|0|2510.2511.2512|2145.2137||1","CALR3|0.0.0.0.0.0.0.0.0.0.0.2.0|2048|0|916.2513.2514|958.245||1","MYLK2|0.0.0.0.0.0.0.0.0.0.0.2.0|2048|0|2194.1855.2177|1860.1861|1312|1","ALPK3|0.0.0.0.0.0.0.0.0.0.0.2.0|2048|0|2508.1965.2515|||1","MYL4|0.0.0.0.0.0.0.0.0.0.0.2.0|2048|0|1787.464.2161||464|1","MYL3|0.0.0.0.0.0.0.0.0.0.0.2.0|2048|0|2163.2195.2516|2207.245|464|1","NEXN|0.0.0.0.0.0.0.0.0.0.0.2.0|2048|0|2152.632.1674|2151.2193||1","GATAD1|0.0.0.0.0.0.0.0.0.0.0.2.0|2048|0|1767.1768|2151.2193||1","TMPO|0.0.0.0.0.0.0.0.0.0.0.2.0|2048|0||463.2145||1","VCL|0.0.0.0.0.0.0.0.0.0.0.2.0|2048|0|2517.316.1089|463.2145|991|1","ILK|0.0.0.0.0.0.0.0.0.0.0.4.0|2048|0|2466.2518.1618||2014|1","FLNA|0.0.0.0.0.0.0.0.0.0.0.4.0|2048|0|2519.2490.2520|2521.2236|2392|1","VEZF1|0.0.0.0.0.0.0.0.0.0.0.4.0|2048|0|2522.2523.2524|||1","GET3|0.0.0.0.0.0.0.0.0.0.0.4.0|2048|0|2525.109.2526||920|1","BAG5|0.0.0.0.0.0.0.0.0.0.0.4.0|2048|0|2527.2528.1383|||1","NUP155|0.0.0.0.0.0.0.0.0.0.0.4.0|2048|0|2529.2530.1785|2151.2193|73|1","KCNE3|0.0.0.0.0.0.0.0.0.0.0.4.1|6144|0|2485.2500.471|2131.2487|1806|1","MIB1|0.0.0.0.0.0.0.0.0.0.0.4.0|2048|0|501.19.20|245|2531|1","PRDM16|0.0.0.0.0.0.0.0.0.0.0.4.0|2048|0|2532.2533.2534|1026.2076|1810|1","PSEN1|0.0.0.0.0.0.0.0.0.0.0.3.0|2048|0|2535.1453.1454|2536.278|501|1","PSEN2|0.0.0.0.0.0.0.0.0.0.0.3.0|2048|0|2101.1208.1453|2537.2216|501|1","DSP|0.0.0.0.0.0.0.0.0.0.0.3.0|2048|0||1863.2131||1","JUP|0.0.0.0.0.0.0.0.0.0.0.3.0|2048|0|2538.2539.2540|1863.1605|1019|1","DSG2|0.0.0.0.0.0.0.0.0.0.0.3.0|2048|0|2538.2539.2541|1863.2361|1043|1","PKP2|0.0.0.0.0.0.0.0.0.0.0.3.0|2048|0|2538.2539.2540|1863.2361|1043|1","CDH2|0.0.0.0.0.0.0.0.0.0.0.3.0|2048|0|2542.2148.2543||1043|1","ABCC9|0.0.0.0.0.0.0.0.0.0.0.3.0|2048|0|2544.2545.2546|2547.2548|2035|1","KCNJ2|0.0.0.0.0.0.0.0.0.0.0.3.0|2048|0|1857.2549.1279|2550.2551|2122|1","TGFB3|0.0.0.0.0.0.0.0.0.0.0.3.0|2048|0|1820.2552.498|1863.714|2553|1","GJA5|0.0.0.0.0.0.0.0.0.0.0.3.0|2048|0|333.2497.2554|2254.2297||1","NDUFAF1|0.0.0.0.0.0.0.0.0.0.0.1.0|2048|0|546.1402.1403|1412.1416|194|1","PPCS|0.0.0.0.0.0.0.0.0.0.0.1.0|2048|0|2555.1393.2556||1200|1","MRPL3|0.0.0.0.0.0.0.0.0.0.0.1.0|2048|0|879.880.1284|997.2557|1364|1","TSFM|0.0.0.0.0.0.0.0.0.0.0.1.0|2048|0|2558.2559.2560|2561.1423||1","AARS2|0.0.0.0.0.0.0.0.0.0.0.1.0|2048|0|29|90.2562|30|1","MRPL44|0.0.0.0.0.0.0.0.0.0.0.1.0|2048|0|1282.879.880|872.1349|1364|1","KLHL24|0.0.0.0.0.0.0.0.0.0.0.1.0|2048|0|2563.2564.712|||1","MTO1|0.0.0.0.0.0.0.0.0.0.0.1.0|2048|0|1769.2565.2566|997.2557||1","SCN3B|0.0.0.0.0.0.0.0.0.0.0.1.0|2048|0|2497.1148.2128|2487.2193||1","DOLK|0.0.0.0.0.0.0.0.0.0.0.1.0|2048|0|2433.2434.2371|2567.2568|1754|1","TMEM168|0.0.0.0.0.0.0.0.0.0.0.1.0|2048|0||||1","COL25A1|0.0.0.0.0.0.0.0.0.0.0.0.6|4096|0|||1806|1","MYH3|0.0.0.0.0.0.0.0.0.0.0.0.6|4096|0|2569.461.1859|1846.2162|321|1","PIEZO2|0.0.0.0.0.0.0.0.0.0.0.0.6|4096|0|1099.2570.1684|1042.2571||1","ENDOG|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|2572.2573.1386||309|1","COQ9|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|195.196.197|2574.2575||1","APOO|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|862|||1","COQ6|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|195.196.197|1796.2106|198|1","POLG2|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|2576.1384.847|1217.1543|1013|1","TMEM126B|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|1402.1403.191|||1","YARS2|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|27.28.1391|230.2577|30|1","FASTKD2|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|2578.2579.1388|192.193||1","MRPS25|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|879.880.823||1364|1","COQ2|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|2580.2581.197|747.230|198|1","KIF21A|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|327.60.61|2582.2583|321|1","SUCLG1|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|1417.1418.1419|1135.2584|1420|1","FDX2|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|1399.1378.1409|||1","DGUOK|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0||1379.731|63|1","SLC25A4|0.0.0.0.0.0.0.0.0.0.0.0.2|4096|0|858.572.1949|1217.1422|2585|1","RNASEH1|0.0.0.0.0.0.0.0.0.0.0.0.4|4096|0|2586.2587.2588||2045|1","RRM2B|0.0.0.0.0.0.0.0.0.0.0.0.4|4096|0|2589.1384.1386|1217.2590|2591|1","FBXL4|0.0.0.0.0.0.0.0.0.0.0.0.4|4096|0|1249.2592.41|997.2557||1","TMEM65|0.0.0.0.0.0.0.0.0.0.0.0.4|4096|0|15.1156.2593|||1","SLC25A42|0.0.0.0.0.0.0.0.0.0.0.0.4|4096|0|1197.858.859|||1","NSUN3|0.0.0.0.0.0.0.0.0.0.0.0.4|4096|0|2558.2594.2595|||1","SLC25A26|0.0.0.0.0.0.0.0.0.0.0.0.4|4096|0|1233.2596.2597|||1","MGME1|0.0.0.0.0.0.0.0.0.0.0.0.4|4096|0|1384.1386.869|1217.2598||1","GFER|0.0.0.0.0.0.0.0.0.0.0.0.4|4096|0|2599.2600.2601|1423.2320||1","COQ4|0.0.0.0.0.0.0.0.0.0.0.0.4|4096|0|195.196.197||198|1","COX16|0.0.0.0.0.0.0.0.0.0.0.0.4|4096|0|189.190.191||194|1","DNA2|0.0.0.0.0.0.0.0.0.0.0.0.3|4096|0|2308.2602.2603|2604.2605|2045|1","FAM111B|0.0.0.0.0.0.0.0.0.0.0.0.3|4096|0||||0","SMC4|0.0.0.0.0.0.0.0.0.0.0.0.3|0|4096|2606.2607.2608|||1","TUBB3|0.0.0.0.0.0.0.0.0.0.0.0.3|4096|0|2609.642.545|2329.1095|275|1","SMPD4|0.0.0.0.0.0.0.0.0.0.0.0.3|4096|0||||0","TIMM22|0.0.0.0.0.0.0.0.0.0.0.0.3|4096|0|1612.2610.862|||1","LIG3|0.0.0.0.0.0.0.0.0.0.0.0.3|4096|0||||1","PTRH2|0.0.0.0.0.0.0.0.0.0.0.0.3|4096|0|588.874.2475||315|1","NUP88|0.0.0.0.0.0.0.0.0.0.0.0.3|4096|0|1424.1425.72||73|1","TOP3A|0.0.0.0.0.0.0.0.0.0.0.0.3|4096|0|2611.2612.1386||1535|1","MYH8|0.0.0.0.0.0.0.0.0.0.0.0.5|4096|0|461.1859.4|2613.299|321|1","KCNJ18|0.0.0.0.0.0.0.0.0.0.0.0.5|4096|0||||0","COX6A2|0.0.0.0.0.0.0.0.0.0.0.0.5|4096|0|776.778.2614||464|1","TTR|0.0.0.0.0.0.0.0.0.0.0.0.1|4096|0|1869.2171.2148|2615.1652|2616|1","TOR1A|0.0.0.0.0.0.0.0.0.0.0.0.1|4096|0|587.2617.2618|1179.2619||1","SGCE|0.0.0.0.0.0.0.0.0.0.0.0.1|4096|0|166.2620|1179.2619|402|1","ADAMTS15|0.0.0.0.0.0.0.0.0.0.0.0.1|4096|0|2621.1449.2622|||1","MET|0.0.0.0.0.0.0.0.0.0.0.0.1|4096|0||2623.2624||1","TYMP|0.0.0.0.0.0.0.0.0.0.0.0.1|4096|0||2625.1217||1","PHOX2A|0.0.0.0.0.0.0.0.0.0.0.0.1|4096|0|2626.2627.1091|1095.2582||1"],"terms":["snRNA metabolic process","Regulation of alternative mRNA splicing. via spliceosome","RNA catabolic process","Neuronal action potential","Skeletal muscle contraction","Skeletal muscle organ development","Progressive sensorineural hearing impairment","Mildly elevated creatine phosphokinase","Virion - lassa virus and sfts virus","Termination of RNA polymerase II transcription","Regulation of DNA-templated transcription initiation","Positive regulation of protein-containing complex disassembly","Abnormality of the lower motor neuron","Degeneration of anterior horn cells","Amyotrophic lateral sclerosis","Cardiac ventricle development","Ventricular septum development","Post-Transcriptional regulation of gene expression","Spinal muscular atrophy","Modification-Dependent protein catabolic process","Protein modification by small protein conjugation","Protein ubiquitination","Abnormality of the anterior horn cell","Ubiquitin mediated proteolysis","Maturation of 5.8S rRNA","Maturation of LSU-rRNA","Ribosomal large subunit biogenesis","tRNA aminoacylation for mitochondrial protein translation","tRNA aminoacylation","tRNA aminoacylation for protein translation","Aminoacyl-trna biosynthesis","TRAMP-dependent tRNA surveillance pathway","Exonucleolytic trimming to generate mature 3'-end of 5.8S rRNA from tricistronic rRNA transcript","Nuclear polyadenylation-dependent rRNA catabolic process","Rna degradation","Poor head control","Progressive microcephaly","Golgi disassembly","Mitotic nuclear membrane disassembly","Regulation of protein localization to chromatin","Regulation of t cell mediated immune response to tumor cell","SCF-dependent proteasomal ubiquitin-dependent protein catabolic process","Positive regulation of t cell mediated immunity","Difficulty running","Abnormality of the musculature of the hand","protein-DNA complex organization","Somatic hypermutation of immunoglobulin genes","poly(A)+ mRNA export from nucleus","Cilium organization","Cilium assembly","Plasma membrane bounded cell projection assembly","Metaphyseal dysplasia","Abnormality of lateral ventricle","Regulation of mitotic cell cycle","Regulation of cell cycle","Phospholipid dephosphorylation","Phosphatidylinositol metabolic process","Phosphatidylinositol biosynthetic process","Visual hallucinations","Inositol phosphate metabolism","Regulation of microtubule polymerization or depolymerization","Regulation of supramolecular fiber organization","Regulation of protein polymerization","Purine metabolism","Ribosome-Associated ubiquitin-dependent protein catabolic process","Estrogen receptor signaling pathway","Rescue of stalled ribosome","DNA alkylation repair","DNA repair","Regulation of RNA biosynthetic process","Esophageal neoplasm","Neoplasm of head and neck","Nuclear transport","Nucleocytoplasmic transport","Fetal akinesia sequence","Abnormality of placental membranes","Mrna surveillance pathway","Positive regulation of kinase activity","Endosome organization","Positive regulation of small GTPase mediated signal transduction","Hand muscle atrophy","Peptidyl-Amino acid modification","Positive regulation of melanin biosynthetic process","Positive regulation of secondary metabolite biosynthetic process","Arterial tortuosity","Mineral absorption","Multivesicular body-lysosome fusion","Vesicle fusion with vacuole","ESCRT III complex disassembly","Mutism","Loss of speech","Necroptosis","Ganglioside catabolic process","Aminoglycan metabolic process","Ceramide catabolic process","Abnormality of liposaccharide metabolism","Abnormality of glycolipid metabolism","Glycosphingolipid biosynthesis - globo and isoglobo series","Axo-Dendritic transport","Vacuole organization","Transport along microtubule","Atrophy/Degeneration involving the corticospinal tracts","Sphingoid biosynthetic process","Sphingosine biosynthetic process","Membrane lipid metabolic process","Decreased number of large peripheral myelinated nerve fibers","Autoamputation","Sphingolipid metabolism","Endoplasmic reticulum tubular network organization","Protein insertion into membrane","Endoplasmic reticulum organization","Ankle clonus","Urinary urgency","Protein homotrimerization","Protein trimerization","Regulation of neuron apoptotic process","Upper motor neuron abnormality","Calcium-Dependent activation of synaptic vesicle fusion","Positive regulation of synaptic vesicle fusion to presynaptic active zone membrane","Positive regulation of dendrite extension","Endothelial cell chemotaxis","Endothelial cell migration","Rho protein signal transduction","Pathways in cancer","Regulation of metaphase plate congression","Positive regulation of spindle assembly","P-body assembly","Vasopressin-regulated water reabsorption","Positive regulation of aggrephagy","Regulation of aggrephagy","Cellular response to topologically incorrect protein","Distal lower limb muscle weakness","Response to unfolded protein","Hyporeflexia of lower limbs","Choline transport","Synaptic transmission. cholinergic","Neuromuscular synaptic transmission","Abnormality of the vocal cords","Difficulty walking","Choline metabolism in cancer","Anterograde dendritic transport of neurotransmitter receptor complex","Anterograde axonal protein transport","Anterograde dendritic transport","Impaired vibration sensation in the lower limbs","Non-small cell lung cancer","Neuron migration","External encapsulating structure organization","Extracellular structure organization","cAMP biosynthetic process","Cellular response to forskolin","Response to forskolin","Vitamin transport","Water-Soluble vitamin metabolic process","Sensory perception of mechanical stimulus","Tongue fasciculations","Vitamin digestion and absorption","Organic anion transport","Muscle fibrillation","Microtubule anchoring","Microtubule anchoring at microtubule organizing center","Protein localization to Golgi apparatus","Achilles tendon contracture","Viral life cycle - hiv-1","Cytochrome complex assembly","Cristae formation","Mitochondrial fission","Muscle organ development","Regulation of DNA-templated transcription","Regulation of transcription by RNA polymerase II","Negative regulation of inclusion body assembly","Regulation of inclusion body assembly","Regulation of protein modification by small protein conjugation or removal","Foot dorsiflexor weakness","Abnormality of the foot musculature","Protein processing in endoplasmic reticulum","Purine nucleotide catabolic process","Purine ribonucleotide catabolic process","Intrinsic apoptotic signaling pathway by P53 class mediator","Sensory axonal neuropathy","Myokymia","Fructose metabolic process","Hexose biosynthetic process","Hexose metabolic process","Pentose and glucuronate interconversions","Self proteolysis","Ionotropic glutamate receptor signaling pathway","Regulation of macroautophagy","Phagocytosis","Response to calcium ion","Mitochondrial cytochrome c oxidase assembly","Respiratory chain complex IV assembly","Mitochondrial respiratory chain complex assembly","Increased hepatocellular lipid droplets","Lipid accumulation in hepatocytes","Thermogenesis","Quinone biosynthetic process","Ubiquinone biosynthetic process","Ubiquinone metabolic process","Ubiquinone and other terpenoid-quinone biosynthesis","+ regulation of mt outer membrane permeabilization inv in apoptotic sgnlng pway","Maintenance of synapse structure","Positive regulation of mitochondrial membrane permeability","Bulbar palsy","Dementia","Cellular response to arsenic-containing substance","Positive regulation of telomere maintenance via telomerase","Negative regulation of telomere maintenance via telomerase","Spliceosome","Amyloid fibril formation","RNA stabilization","Positive regulation of double-strand break repair via homologous recombination","Pseudobulbar signs","Postural tremor","Negative regulation by host of viral transcription","3'-UTR-mediated mRNA stabilization","3'-UTR-mediated mRNA destabilization","Disinhibition","Apathy","Negative regulation of receptor internalization","Nucleic acid metabolic process","Dysmetric saccades","Genetic anticipation","Spinocerebellar ataxia","T follicular helper cell differentiation","Positive regulation of TORC2 signaling","Regulation of TORC2 signaling","Rig-i-like receptor signaling pathway","IRE1-mediated unfolded protein response","Positive regulation by host of viral genome replication","Endoplasmic reticulum membrane organization","Progressive muscle weakness","Cholesterol metabolism","Golgi ribbon formation","Negative regulation of macromolecule metabolic process","Regulation of receptor recycling","Mitophagy - animal","Positive regulation of microtubule nucleation","Positive regulation of ruffle assembly","Negative regulation of actin filament polymerization","Regulation of ruffle assembly","Atrophy/Degeneration involving motor neurons","Rap1 signaling pathway","Response to yeast","Antifungal humoral response","Placenta development","Autosomal dominant inheritance","Intermediate filament bundle assembly","Regulation of microtubule-based movement","Cell projection assembly","Hydrogen peroxide biosynthetic process","Auditory receptor cell stereocilium organization","Regulation of organ growth","Longevity regulating pathway - multiple species","Regulation of g protein-coupled receptor internalization","Regulation of clathrin-dependent endocytosis","Cellular response to estradiol stimulus","Response to estradiol","Gnrh secretion","Testicular atrophy","Prostate neoplasm","Schwann cell development","Axon ensheathment in central nervous system","Peripheral nervous system axon ensheathment","Cell adhesion molecule (cam) interaction","ERBB4 signaling pathway","Mammary gland epithelial cell differentiation","Mitochondrial fragmentation involved in apoptotic process","Progressive inability to walk","Inability to walk","Erbb signaling pathway","Cranial nerve development","Negative regulation of secretion","Extrinsic apoptotic signaling pathway in absence of ligand","Akinesia","Diminished movement","Gap junction","Inclusion body assembly","Intracellular distribution of mitochondria","Neurofibrillary tangles","Parkinson disease","Positive regulation of endothelial cell chemotaxis","Regulation of endothelial cell chemotaxis","Regulation of oxidative stress-induced intrinsic apoptotic signaling pathway","Ulnar claw","Vegf signaling pathway","Negative regulation of protein localization to chromatin","Nucleotide catabolic process","Stress granule disassembly","Back pain","Shoulder girdle muscle weakness","Legionellosis","Protein localization to perinuclear region of cytoplasm","Negative regulation of ferroptosis","Aggrephagy","Tetraparesis","Abnormality of proline metabolism","Sarcomere organization","Myofibril assembly","Actomyosin structure organization","Distal arthrogryposis","Ulnar deviation of finger","Cytoskeleton in muscle cells","Calf muscle hypertrophy","Muscle hypertrophy of the lower extremities","Negative regulation of macrophage migration","Regulation of collagen fibril organization","Elastic fiber assembly","Igsf cam signaling","CNS hypomyelination","Apoptosis","Transferrin transport","Regulation of extent of cell growth","Synaptic vesicle budding from presynaptic endocytic zone membrane","Centrally nucleated skeletal muscle fibers","Segmental peripheral demyelination/remyelination","Endocrine and other factor-regulated calcium reabsorption","Adherens junction assembly","Presynaptic endocytosis","Synaptic vesicle endocytosis","Neonatal death","Arthrogryposis multiplex congenita","Motor proteins","Peripheral nervous system development","Myelination","Adenylate cyclase-activating g protein-coupled receptor signaling pathway","Delamination","Cellular hypotonic response","Cortical microtubule organization","Aplasia of the musculature","Inflammatory mediator regulation of trp channels","Phosphatidylcholine biosynthetic process","JNK cascade","Glycerophospholipid metabolism","Gap junction assembly","Cell-Cell junction assembly","Nervous system development","Lower limb hyperreflexia","Release of cytochrome c from mitochondria","Positive regulation of release of cytochrome c from mitochondria","Neuron apoptotic process","Apoptosis - multiple species","Synaptic signaling","Regulation of sodium ion transmembrane transporter activity","Regulation of sodium ion transmembrane transport","Sensory perception of taste","Sensory perception of chemical stimulus","Negative regulation of sequestering of calcium ion","Taste transduction","Cellular response to hypoxia","Cellular response to decreased oxygen levels","Renal cell carcinoma","L-serine metabolic process","Serine family amino acid biosynthetic process","Pterygium","Abnormality of serine family amino acid metabolism","Vitamin b6 metabolism","Sialylation","Ganglioside biosynthetic process","Ganglioside metabolic process","Regulation of superoxide metabolic process","Regulation of cellular response to oxidative stress","Vascular tortuosity","Premature skin wrinkling","Enzyme-Linked receptor protein signaling pathway","Response to cytokine","Cytokine-Mediated signaling pathway","Abnormality of the ischium","Short tibia","Signaling pathways regulating pluripotency of stem cells","Protein dephosphorylation","Dephosphorylation","Phosphate-Containing compound metabolic process","Adherens junction","Regulation of epithelial cell apoptotic process","Morphogenesis of a polarized epithelium","Negative regulation of epithelial cell apoptotic process","Posterior embryotoxon","Abnormality of the line of Schwalbe","Hippo signaling pathway - multiple species","Hyperphosphaturia","Abnormal urine phosphate concentration","Purine ribonucleoside monophosphate catabolic process","AMP metabolic process","Response to ATP","Vascular calcification","Cardiovascular calcification","Nicotinate and nicotinamide metabolism","Calcium-Dependent cell-cell adhesion via plasma membrane cell adhesion molecules","Cell-Cell adhesion via plasma-membrane adhesion molecules","Protein deubiquitination","Protein modification by small protein removal","Smoothened signaling pathway","Non-Motile cilium assembly","Monoacylglycerol biosynthetic process","Intracellular triglyceride homeostasis","Monoacylglycerol metabolic process","Fat digestion and absorption","Cellular response to virus","Macroautophagy","Regulation of CD4-positive. alpha-beta t cell proliferation","Regulation of complement activation","Negative regulation of complement activation","Viral myocarditis","Positive regulation of programmed cell death","Positive regulation of apoptotic process","Regulation of apoptotic process","Flat cornea","Severe Myopia","Positive regulation of kidney development","Negative regulation of stress-activated MAPK cascade","Lymphoma","Thyroid cancer","Engulfment of apoptotic cell","- regulation of blood vessel endothelial cell proliferation inv in sprouting angiogenesis","Regulation of long-chain fatty acid import across plasma membrane","Bladder cancer","Nucleotide-Binding oligomerization domain containing 2 signaling pathway","Nucleotide-Binding domain. leucine rich repeat containing receptor signaling pathway","Innate immune response-activating signaling pathway","Cysteine and methionine metabolism","Filopodium assembly","Regulation of hydrolase activity","Cytoskeleton organization","Regulation of actin cytoskeleton","Regulation of t cell act via t cell rec contact with ag bound to MHC mol on ag presenting cell","- regulation of adaptive imm resp based on som recomb of imm rcptrs built from IgSF domains","Regulation of T-helper 1 type immune response","Efferocytosis","Regulation of fat cell proliferation","Regulation of vascular associated smooth muscle cell apoptotic process","Positive regulation of smooth muscle cell apoptotic process","Mitotic spindle elongation","Mitotic spindle midzone assembly","Mitotic spindle assembly","Mitotic cytokinesis","Positive regulation of secretion by cell","Positive regulation of protein secretion","Regulation of cell projection organization","Regulation of neuron projection arborization","Positive regulation of axon extension","Retrograde axonal transport","Cell-Substrate junction assembly","Axonal transport","Alacrima","Decreased lacrimation","Cornified envelope formation","Regulation of protein localization to cilium","Cytoskeleton-Dependent intracellular transport","Positive regulation of epidermal growth factor receptor signaling pathway","Lymphocyte migration into lymphoid organs","Regulation of mitotic cytokinesis","Negative regulation of sodium ion transport","Osteolytic defects of the phalanges of the hand","Parathyroid hormone synthesis. secretion and action","Muscle contraction","Actin filament organization","Supramolecular fiber organization","Nemaline bodies","Distal lower limb amyotrophy","Regulation of muscle system process","Positive regulation of heart rate","Muscle filament sliding","Ventricular tachycardia","Lipoatrophy","Cardiac muscle contraction","Negative regulation of lens fiber cell differentiation","Regulation of lens fiber cell differentiation","Coronary vasculature morphogenesis","Neoplasm of the peripheral nervous system","Multiple lipomas","Negative regulation of sodium ion transmembrane transporter activity","Negative regulation of potassium ion transmembrane transporter activity","Aldosterone-regulated sodium reabsorption","Cell surface receptor signaling pathway via JAK-STAT","Cell surface receptor signaling pathway via STAT","Proteolysis involved in protein catabolic process","Prolactin signaling pathway","Response to UV-A","Positive regulation of G2/M transition of mitotic cell cycle","Positive regulation of cell cycle G2/M phase transition","Anorexia","Weight loss","Signal complex assembly","Negative regulation of neutrophil activation","Positive regulation of lamellipodium morphogenesis","Response to hydroperoxide","Aldosterone synthesis and secretion","Ras protein signal transduction","Calcium-Mediated signaling","Positive regulation of cold-induced thermogenesis","Ras signaling pathway","Protein localization to plasma membrane","Protein localization to cell periphery","Reticulocytosis","Poikilocytosis","Proteoglycans in cancer","Glomerular epithelial cell development","Podocyte development","Regulation of cardiac epithelial to mesenchymal transition","Anterior segment dysgenesis","Vertebral arch anomaly","Notch signaling pathway","Pituitary gland development","Endodermal cell fate commitment","Negative regulation of cell cycle phase transition","Rib fusion","Septo-optic dysplasia","in utero embryonic development","Chordate embryonic development","Brain development","Abnormality of sodium homeostasis","Growth hormone deficiency","Central nervous system development","Negative regulation of RNA biosynthetic process","Poor eye contact","Tented upper lip vermilion","Foxo signaling pathway","Regulation of vascular wound healing","Positive regulation of cell adhesion mediated by integrin","Positive regulation of cell migration involved in sprouting angiogenesis","Recurrent corneal erosions","Renal duplication","SMAD protein signal transduction","Response to BMP","Cell surface receptor protein serine/threonine kinase signaling pathway","Incomplete penetrance","Pulmonary hypertension","Tgf-beta signaling pathway","Protein K6-linked ubiquitination","Response to type i interferon","Type II interferon-mediated signaling pathway","Negative regulation of viral transcription","Herpes simplex virus 1 infection","ERBB2-EGFR signaling pathway","Negative regulation of cardiocyte differentiation","Peptidyl-Tyrosine autophosphorylation","Alveolar cell carcinoma","Neoplasm of the tracheobronchial system","ERBB2 signaling pathway","Positive regulation of protein targeting to membrane","Ependymoma","Stomach cancer","Neuron remodeling","Neuron maturation","Negative regulation of cell adhesion","Axon guidance","Chaperone-Mediated protein complex assembly","Antigen processing and presentation","Establishment of mitochondrion localization. microtubule-mediated","Regulation of intrinsic apoptotic signaling pathway by P53 class mediator","Modification-Dependent macromolecule catabolic process","Intellectual disability. profound","Gingival overgrowth","Ppar signaling pathway","Negative regulation of programmed cell death","Negative regulation of apoptotic process","Nerve growth factor signaling pathway","Positive regulation of Ras protein signal transduction","Neurotrophin signaling pathway","Anhidrosis","Negative regulation of cell cycle","Negative regulation of cellular process","Calcaneovalgus deformity","Deformed tarsal bones","Micrornas in cancer","Tight junction organization","Establishment of apical/basal cell polarity","Establishment or maintenance of apical/basal cell polarity","Hippo signaling pathway","Nucleolar large rRNA transcription by RNA polymerase i","DNA-templated transcription elongation","Rna polymerase","Negative regulation of necroptotic process","Negative regulation of programmed necrotic cell death","Regulation of programmed necrotic cell death","Mediastinal lymphadenopathy","Pulmonary infiltrates","Regulation of cell cycle phase transition","Regulation of cell cycle process","Granulocyte migration","Positive regulation of myeloid leukocyte mediated immunity","Positive regulation of leukocyte degranulation","Autophagosome-Lysosome fusion","Regulation of peptidase activity","Regulation of protein transport","Parkinsonism with favorable response to dopaminergic medication","Dopamine biosynthetic process","Regulation of dopamine uptake involved in synaptic transmission","Regulation of inositol phosphate biosynthetic process","Cerebral inclusion bodies","Positive regulation of mitochondrial fusion","Positive regulation of neurotransmitter transport","Calcium ion transport into cytosol","Regulation of ryanodine-sensitive calcium-release channel activity","Regulation of calcium ion transmembrane transporter activity","Action tremor","Positive regulation of BMP signaling pathway","Protein monoubiquitination","Protein K63-linked ubiquitination","Tight junction assembly","Tight junction","Axonal transport of mitochondrion","Mitochondrion transport along microtubule","Personality changes","Neuronal loss in central nervous system","Negative regulation of smooth muscle cell apoptotic process","Negative regulation of gene expression via chromosomal cpg island methylation","Positive regulation of vascular associated smooth muscle cell proliferation","Impulsivity","Primitive reflexes (palmomental. snout. glabellar)","Cytoskeleton-Dependent cytokinesis","Regulation of mitotic cell cycle phase transition","Galactolipid biosynthetic process","Galactosylceramide biosynthetic process","Plasma membrane raft organization","Spastic tetraparesis","Retrograde endocannabinoid signaling","Regulation of dopamine secretion","Regulation of catecholamine secretion","Response to magnesium ion","Detection of stimulus involved in sensory perception of pain","Magnesium ion homeostasis","Spastic gait","Positive regulation of synapse maturation","Positive regulation of dendritic spine morphogenesis","Regulation of synapse maturation","Olfactory transduction","Negative regulation of heart rate","Neuronal ion channel clustering","Central nervous system neuron axonogenesis","Regulation of cell differentiation","Heterophilic cell-cell adhesion via plasma membrane cell adhesion molecules","Homophilic cell adhesion via plasma membrane adhesion molecules","Positive regulation of Wnt signaling pathway. planar cell polarity pathway","Regulation of Wnt signaling pathway. planar cell polarity pathway","Positive regulation of non-canonical Wnt signaling pathway","Sympathetic neuron projection extension","Neuron projection extension","Cell morphogenesis involved in neuron differentiation","Fatty acid transport","Monocarboxylic acid transport","Lipid transport","Neuron projection guidance","Regulation of cell-substrate junction assembly","Positive regulation of stress fiber assembly","Positive regulation of actin filament bundle assembly","Striated muscle contraction","Hypoplastic left heart","Hypoplastic heart","Positive regulation of protein export from nucleus","Negative regulation of muscle cell apoptotic process","Axonal loss","Diaphragmatic weakness","Negative regulation of intracellular transport","Negative regulation of amyloid fibril formation","Cellular response to gamma radiation","Muscle fiber splitting","Lipoprotein metabolic process","Serotonergic synapse","Dendritic spine maintenance","Regulation of glutamate receptor signaling pathway","Negative regulation of protein maturation","Global brain atrophy","Ferroptosis","Phosphatidylinositol 3-kinase/protein kinase b signal transduction","Plasma membrane bounded cell projection morphogenesis","Neuron projection morphogenesis","Positive regulation of extracellular matrix assembly","Regulation of gastrulation","Ankle contracture","Limb-girdle muscle weakness","Clathrin coat assembly","Regulation of vesicle size","Cholecystitis","Positive regulation of macromolecule biosynthetic process","Positive regulation of gene expression","Type 1 muscle fiber predominance","Positive regulation of long-term neuronal synaptic plasticity","Neurotrophin TRK receptor signaling pathway","Arthropathy","NAD biosynthetic process","Nicotinamide nucleotide biosynthetic process","Negative regulation of cytoplasmic translation","Endoplasmic reticulum tubular network formation","Negative regulation of amyloid-beta formation","Negative regulation of amyloid precursor protein catabolic process","Microvillus organization","Microvillus assembly","Regulation of dendrite morphogenesis","Presynapse assembly","Protein localization to synapse","Protein localization to cell junction","Insulin secretion","Regulation of dendritic spine development","Vesicle cytoskeletal trafficking","Lower limb amyotrophy","Spastic tetraplegia","protein-RNA complex disassembly","Organelle disassembly","Negative regulation of amyloid precursor protein biosynthetic process","Negative regulation of glycoprotein biosynthetic process","Regulation of amyloid precursor protein biosynthetic process","Progressive neurologic deterioration","Polar cataract","Regulation of synaptic assembly at neuromuscular junction","Regulation of neuromuscular junction development","Signal release from synapse","Hypotonic response","Chloride ion homeostasis","Facial diplegia","Aqueductal stenosis","Protein polyubiquitination","Proteasome-Mediated ubiquitin-dependent protein catabolic process","Broad-based gait","Decreased muscle mass","Reticulophagy","Sensory perception of pain","Sensory perception","Positive regulation of neuroblast proliferation","Regulation of neuroblast proliferation","Positive regulation of neural precursor cell proliferation","Synaptic membrane adhesion","Regulation of axonogenesis","Regulation of trans-synaptic signaling","Regulation of actin filament-based process","Regulation of actin cytoskeleton organization","Regulation of cytoskeleton organization","Glycolipid metabolic process","Frequent falls","Glycosphingolipid biosynthesis - ganglio series","Cardiac muscle cell contraction","Hypothermia","Atonic seizures","Cell projection organization","Membrane depolarization during action potential","Dysautonomia","Abnormality of pain sensation","Negative regulation of complement activation. classical pathway","Regulation of complement activation. classical pathway","Negative regulation of humoral immune response mediated by circulating immunoglobulin","Negative regulation of microglial cell activation","Negative regulation of catecholamine secretion","Establishment of vesicle localization","Cellular response to misfolded protein","Protein K63-linked deubiquitination","Regulation of ERAD pathway","Negative regulation of cellular component organization","Scanning speech","Positive regulation of myelination","Positive regulation of glial cell differentiation","Peripheral hypomyelination","C-type lectin receptor signaling pathway","Insidious onset","Termporal pattern","Protein geranylgeranylation","Protein prenylation","Myelin maintenance","Myelination in peripheral nervous system","Regulation of RNA splicing","Regulation of cytokine production","Positive regulation of canonical NF-kappaB signal transduction","Regulation of canonical NF-kappaB signal transduction","Onion bulb formation","Lysosome","Substantia nigra development","Steppage gait","Morphine addiction","Actin filament polymerization","Regulation of mitochondrial fission","Regulation of mitochondrion organization","Peripheral demyelination","DNA damage response. signal transduction by P53 class mediator","Signal transduction by P53 class mediator","Intracellular accumulation of autofluorescent lipopigment storage material","Mitochondrial fusion","Organelle fission","Mitochondrial electron transport. cytochrome c to oxygen","Energy derivation by oxidation of organic compounds","Aerobic electron transport chain","Negative regulation of excitatory postsynaptic potential","Regulation of receptor catabolic process","Abnormal auditory evoked potentials","Decreased motor nerve conduction velocity","Cellular response to type II interferon","Response to type II interferon","Cellular response to interleukin-1","Nod-like receptor signaling pathway","Gout","Negative regulation of Ras protein signal transduction","Central scotoma","Endoplasmic reticulum to Golgi vesicle-mediated transport","Phagosome acidification","Negative regulation of exocytosis","Phagosome-Lysosome fusion","Positive regulation of autophagosome assembly","Positive regulation of vacuole organization","Negative regulation of endocytosis","Hammertoe","EMG: neuropathic changes","Dense core granule cytoskeletal transport","Anterograde synaptic vesicle transport","Synaptic vesicle transport along microtubule","Pheochromocytoma","Neuroendocrine neoplasm","tRNA transcription by RNA polymerase III","tRNA transcription","Transcription by RNA polymerase III","snRNA transcription by RNA polymerase III","snRNA transcription","Cerebral hypomyelination","Horizontal nystagmus","PERK-mediated unfolded protein response","Exit from mitosis","Positive regulation by host of viral transcription","Rhabdomyolysis","Regulation of cellular response to heat","mRNA cis splicing. via spliceosome","RNA splicing. via transesterification reactions with bulged adenosine as nucleophile","mRNA splicing. via spliceosome","C-terminal protein amino acid modification","Microautophagy","Protein lipidation","Autophagy - other","Translation","Cellular response to platelet-derived growth factor stimulus","Positive regulation of transcription of nucleolar large rRNA by RNA polymerase i","Response to platelet-derived growth factor","Selenocompound metabolism","Positive regulation of interleukin-18 production","Protein localization to cytoplasmic stress granule","RISC complex assembly","Positive regulation of telomere maintenance in response to DNA damage","Regulation of telomere maintenance in response to DNA damage","Regulation of DNA strand elongation","Atp-dependent chromatin remodeling","Regulation of signal transduction by P53 class mediator","Ribonucleoprotein complex biogenesis","7-Methylguanosine RNA capping","7-Methylguanosine mRNA capping","Cap-Dependent translational initiation","Regulation of nuclear receptor-mediated glucocorticoid signaling pathway","Negative regulation of circadian rhythm","Entrainment of circadian clock by photoperiod","Circadian rhythm","CD40 signaling pathway","Positive regulation of protein targeting to mitochondrion","Positive regulation of establishment of protein localization to mitochondrion","Positive regulation of DNA-directed DNA polymerase activity","Positive regulation of transferase activity","Positive regulation of DNA biosynthetic process","Hyperacusis","Overriding aorta","Mismatch repair","Free ubiquitin chain polymerization","Positive regulation of ubiquitin protein ligase activity","Positive regulation of protein maturation","Positive regulation of protein processing","Regulation of protein processing","ADP transport","ATP transport","Purine ribonucleotide transport","Mitochondrial membrane organization","Inner mitochondrial membrane organization","Regulation of transmission of nerve impulse","Regulation of digestive system process","Regulation of nervous system process","Respiratory difficulties","Hepatocellular necrosis","Hepatic necrosis","Mitochondrial genome maintenance","Regulation of metabolic process","Regulation of reactive oxygen species metabolic process","Microvesicular hepatic steatosis","Peroxisome","Positive regulation of inositol phosphate biosynthetic process","Cellular response to purine-containing compound","Phosphatidylglycerol biosynthetic process","Cardiolipin metabolic process","Regulation of apoptotic signaling pathway","Mitochondrial translation","Mitochondrial gene expression","Cobalamin metabolic process","NLS-bearing protein import into nucleus","Regulation of platelet-derived growth factor receptor signaling pathway","Hyperglycinemia","Methylmalonic acidemia","Cobalamin transport and metabolism","Intellectual disability. mild","Autosomal recessive inheritance","Lipoic acid metabolism","Prolonged neonatal jaundice","Selenocysteine incorporation","Translational readthrough","Regulation of vascular endothelial growth factor production","Aminoglycoside antibiotic metabolic process","Daunorubicin metabolic process","Doxorubicin metabolic process","Epithelial cell differentiation","Epithelium development","Canonical glycolysis","Glucose catabolic process to pyruvate","Glycolytic process through glucose-6-phosphate","Glycolysis / gluconeogenesis","Negative regulation of cellular response to hypoxia","Positive regulation of plasminogen activation","Regulation of ATP biosynthetic process","Chaperone mediated protein folding independent of cofactor","Positive regulation of telomerase RNA localization to cajal body","Positive regulation of protein localization to cajal body","Hypobetalipoproteinemia","Prion disease","Regulation of necroptotic process","Protein targeting to mitochondrion","Increased serum pyruvate","Increased connective tissue","Cellular response to unfolded protein","ERAD pathway","Regulation of cellular response to stress","Signal peptide processing","Protein processing","Protein export","Retrograde transport. endosome to Golgi","Cytosolic transport","Snare interactions in vesicular transport","Spermatid development","Lymphoid progenitor cell differentiation","Somatic recombination of immunoglobulin gene segments","Double-Strand break repair via classical nonhomologous end joining","Severe combined immunodeficiency","Sparse lateral eyebrow","Non-homologous end-joining","Regulation of cellular localization","Regulation of protein localization","Negative regulation of autophagosome assembly","Mitochondrion distribution","Phosphatidylinositol dephosphorylation","Neonatal respiratory distress","Hypokinesia","Negative regulation of myeloid leukocyte mediated immunity","Toll-Like receptor 2 signaling pathway","Regulation of nucleotide-binding oligomerization domain containing 2 signaling pathway","Carbohydrate derivative transport","Monoatomic ion transport","Regulation of acyl-coa biosynthetic process","Regulation of acetyl-coa biosynthetic process from pyruvate","Peroxisome proliferator activated receptor signaling pathway","X-linked dominant inheritance","Diabetic cardiomyopathy","Membrane lipid catabolic process","Sphingolipid catabolic process","Ceramide metabolic process","Toll-Like receptor 9 signaling pathway","Toll-Like receptor 3 signaling pathway","Endolysosomal toll-like receptor signaling pathway","Recurrent viral infections","Heparan sulfate proteoglycan catabolic process","Proteoglycan catabolic process","Heparan sulfate proteoglycan metabolic process","Asymmetric septal hypertrophy","Urinary glycosaminoglycan excretion","Glycosaminoglycan degradation","Regulation of defense response to bacterium","Golgi to lysosome transport","D-glucose import","Post-Translational protein targeting to endoplasmic reticulum membrane","Protein targeting to ER","Protein targeting to membrane","Adipose tissue development","Positive regulation of organelle organization","Protein localization to organelle","Positive regulation of cell motility","Positive regulation of cell migration","Amelogenesis imperfecta","Dental malocclusion","Positive regulation of D-glucose import","Positive regulation of D-glucose transmembrane transport","Regulation of D-glucose import","Maintenance of lens transparency","Membrane invagination","Posterior subcapsular cataract","Subcapsular cataract","Virion - hepatitis viruses","Regulation of primary metabolic process","Regulation of gene expression","Salmonella infection","Detection of temperature stimulus involved in sensory perception","Detection of temperature stimulus involved in sensory perception of pain","P53 signaling pathway","Cellular response to hepatocyte growth factor stimulus","Response to hepatocyte growth factor","Platelet-Derived growth factor receptor signaling pathway","Bacterial invasion of epithelial cells","Glycerophospholipid biosynthetic process","Viral carcinogenesis","Serine transport","One-Carbon metabolic process","Import into the mitochondrion","Abnormality of alanine metabolism","Heme biosynthetic process","Porphyrin-Containing compound biosynthetic process","Pigment biosynthetic process","Scotoma","Bony spicule pigmentary retinopathy","Protein modification process","Distal sensory impairment","Lamellipodium organization","Transposable element silencing by heterochromatin formation","Transposable element silencing","Constitutive heterochromatin formation","Base-Excision repair. gap-filling","Positive regulation of double-strand break repair via nonhomologous end joining","Regulation of double-strand break repair via nonhomologous end joining","Intellectual disability. severe","Base excision repair","Positive regulation of cell-cell adhesion mediated by integrin","Positive regulation of myotube differentiation","Regulation of cell-cell adhesion mediated by integrin","Increased serum ferritin","Hematopoietic progenitor cell differentiation","Acute myeloid leukemia","Transcriptional misregulation in cancer","Positive regulation of centriole replication","Embryonic axis specification","Telomeric D-loop disassembly","Telomeric loop disassembly","Telomere organization","Annular pancreas","Rectovaginal fistula","Inositol metabolic process","Inositol phosphate biosynthetic process","Polyol biosynthetic process","Complement and coagulation cascades","Positive regulation of t cell mediated immune response to tumor cell","Positive regulation of immune response to tumor cell","Urinary bladder sphincter dysfunction","Type i diabetes mellitus","Negative regulation of miRNA-mediated gene silencing","Regulation of miRNA-mediated gene silencing","Il-17 signaling pathway","Negative regulation of cardiac muscle adaptation","Negative regulation of cardiac muscle hypertrophy in response to stress","Regulation of cardiac muscle hypertrophy in response to stress","Submucous cleft hard palate","Arrhythmogenic right ventricular cardiomyopathy","Modulation by symbiont of entry into host","Regulation of viral life cycle","Regulation of viral entry into host cell","Regulation of mRNA splicing. via spliceosome","mRNA metabolic process","mRNA processing","RNA processing","Positive regulation of JNK cascade","Regulation of JNK cascade","Proteinogenic amino acid metabolic process","L-amino acid metabolic process","Glutamine family amino acid metabolic process","Alanine. aspartate and glutamate metabolism","P granule organization","Pole plasm assembly","piRNA processing","Regulation of morphogenesis of a branching structure","Resting tremor","Striated muscle cell development","Congenital stationary night blindness","Decreased electroretinogram (ERG) amplitude","Germ cell neoplasia","Breast carcinoma","Erythema","Multifactorial inheritance","Mesenchyme development","Endocardial cushion development","Heart development","Abnormality of the aortic arch","Atrioventricular canal defect","Regulation of sensory perception","Regulation of sensory perception of pain","Regulation of neuron differentiation","Protein localization to ciliary transition zone","Protein localization to cilium","Pancreatic fibrosis","True hermaphroditism","miRNA-mediated gene silencing by mRNA destabilization","Positive regulation of mRNA metabolic process","Non-Proteinogenic amino acid metabolic process","Monocarboxylic acid metabolic process","Severe muscular hypotonia","Death in childhood","Butanoate metabolism","Adherens junction maintenance","Epithelial cell-cell adhesion","Pore complex assembly","Neuron differentiation","Generation of neurons","Negative regulation of transcription by RNA polymerase II","Cardiac muscle cell action potential","Amblyopia","Epileptic encephalopathy","Focal motor seizures","Dialeptic seizures","Detection of mechanical stimulus involved in sensory perception","Dopaminergic synapse","Action potential","Potassium ion transport","Potassium ion transmembrane transport","Cholinergic synapse","Regulation of voltage-gated calcium channel activity","Regulation of cation channel activity","Gaze-evoked nystagmus","Dysarthria","Protein tetramerization","Fibroblast growth factor receptor signaling pathway","Cellular response to fibroblast growth factor stimulus","Cortical actin cytoskeleton organization","Cortical cytoskeleton organization","Progressive cerebellar ataxia","Morphological abnormality of the pyramidal tract","Neuron projection maintenance","Sodium ion export across plasma membrane","Cell communication by electrical coupling involved in cardiac conduction","Hemiplegia","Proximal tubule bicarbonate reclamation","Negative regulation of small molecule metabolic process","Intention tremor","Magnesium ion transport","Protein N-linked glycosylation via asparagine","Cognition","Various types of n-glycan biosynthesis","Fatty acid elongation. monounsaturated fatty acid","Fatty acid elongation. polyunsaturated fatty acid","Fatty acid elongation. unsaturated fatty acid","Dysdiadochokinesis","Fatty acid elongation","Cerebellar granule cell differentiation","Glutamatergic neuron differentiation","Imitative learning","Hyperventilation","Protruding tongue","Positive regulation of axonogenesis","Regulation of axon extension","Abnormality of the corticospinal tract","Neuron cell-cell adhesion","Learning","Genomic imprinting","Epigenetic programming of gene expression","Regulation of cyclin-dependent protein serine/threonine kinase activity","Epithelial cell migration","Ameboidal-Type cell migration","AV node cell action potential","SA node cell action potential","Sinoatrial node development","Type ii diabetes mellitus","Release of sequestered calcium ion into cytosol by endoplasmic reticulum","Calcium import into the mitochondrion","Mitochondrial calcium ion transmembrane transport","Long-term depression","Regulation of short-term neuronal synaptic plasticity","Regulation of cardiac conduction","Anterograde trans-synaptic signaling","Chemical synaptic transmission","Regulation of tubulin deacetylation","Astral microtubule organization","Myelin assembly","Adenylate cyclase-modulating g protein-coupled receptor signaling pathway","Actin-Mediated cell contraction","Epithelial cell morphogenesis","Congenital onset","Hydrocephalus","Wnt signaling pathway","Pyrimidine nucleotide-sugar transmembrane transport","Platelet dense granule organization","Secretory granule organization","mRNA transcription by RNA polymerase II","mRNA transcription","Impaired proprioception","Basal transcription factors","Antigen processing and presentation of exogenous peptide antigen via MHC class II","Antigen processing and presentation of peptide antigen via MHC class II","Antigen processing and presentation of exogenous peptide antigen","Emotional lability","Torticollis","Clathrin-Dependent endocytosis","Synaptic vesicle recycling","Postural instability","Abnormality of saccadic eye movements","Endocytosis","- regulation of oxidative stress-induced neuron intrinsic apoptotic sgnlng pway","Regulation of oxidative stress-induced neuron intrinsic apoptotic signaling pathway","Positive regulation of autophagy of mitochondrion","Slow saccadic eye movements","Positive regulation of calcium ion transport into cytosol","Positive regulation of nitric-oxide synthase activity","Limb hypertonia","Folate biosynthesis","Calcium ion import across plasma membrane","Calcium ion import into cytosol","Calcium ion import","Nicotine addiction","Pantothenate metabolic process","Regulation of bile acid metabolic process","Regulation of triglyceride metabolic process","Pantothenate and coa biosynthesis","Protein repair","Lactate metabolic process","Regulation of protein acetylation","Glycolipid catabolic process","Central nervous system neuron development","Glycoside metabolic process","Other glycan degradation","Regulation of calcium import into the mitochondrion","Mitochondrial protein processing","Degeneration of the lateral corticospinal tracts","Lytic vacuole organization","Lysosome organization","Unsaturated fatty acid metabolic process","Icosanoid metabolic process","Glycerophospholipid metabolic process","Single strand break repair","Progressive external ophthalmoplegia","Reelin-Mediated signaling pathway","Positive regulation of dendrite development","Nonprogressive disorder","Positive regulation of glycolytic process","Positive regulation of purine nucleotide catabolic process","Positive regulation of ATP metabolic process","Myotonia","Aminophospholipid transport","Lipid translocation","Phospholipid translocation","Truncal ataxia","G protein-coupled glutamate receptor signaling pathway","Glutamate receptor signaling pathway","Thiamine transmembrane transport","Thiamine-Containing compound metabolic process","Sulfur compound transport","Confusion","Dicarboxylic acid biosynthetic process","Nitrogen metabolism","Positive regulation of MAP kinase activity","Regulation of MAP kinase activity","Toxoplasmosis","Regulation of cytokinesis","Regulation of cell division","Plasma membrane bounded cell projection organization","Negative regulation of myoblast differentiation","Early endosome to late endosome transport","Endosome transport via multivesicular body sorting pathway","Phagosome","Negative regulation of protein-containing complex disassembly","Regulation of autophagosome maturation","Negative regulation of macroautophagy","Autophagy - animal","SNARE complex assembly","Protein-Containing complex assembly","Supranuclear gaze palsy","Polyol metabolic process","Regulation of lipid metabolic process","Sensory perception of light stimulus","Visual perception","Babinski sign","Protein quality control for misfolded or incompletely synthesized proteins","Membrane protein proteolysis","Macromolecule catabolic process","Increased intramyocellular lipid droplets","Negative regulation of peroxisome proliferator activated receptor signaling pathway","Positive regulation of muscle cell apoptotic process","Supernumerary nipples","Chloride transmembrane transport","Monoatomic anion transmembrane transport","Inorganic anion transmembrane transport","Limb ataxia","Regulation of response to nutrient levels","Negative regulation of proteolysis involved in protein catabolic process","Negative regulation of proteasomal protein catabolic process","African trypanosomiasis","Neuropeptide signaling pathway","Sensorimotor neuropathy","Cocaine addiction","Impaired smooth pursuit","Ventricular cardiac muscle cell membrane repolarization","Cardiac muscle cell membrane repolarization","Potassium ion export across plasma membrane","Late onset","Translational elongation","Positive regulation of translation","Macromolecule biosynthetic process","Ampk signaling pathway","Regulation of microtubule binding","Negative regulation of microtubule depolymerization","Negative regulation of protein depolymerization","Cerebellar atrophy","Meiotic DNA double-strand break formation","Negative regulation of double-strand break repair via nonhomologous end joining","DNA strand resection involved in replication fork processing","Nuclear export","Midbody abscission","Mitotic cytokinetic process","Regulation of mitochondrial membrane potential","Double-Strand break repair","DNA metabolic process","Pes cavus","Wnt signaling pathway. planar cell polarity pathway","Non-Canonical Wnt signaling pathway","Generalized myoclonic seizures","Dysmetria","Maintenance of protein location in nucleus","Muscle cell differentiation","Nucleus organization","Proximal amyotrophy","Neck muscle weakness","Regulation of cardiac muscle cell membrane potential","Cellular response to epinephrine stimulus","Cellular response to acidic ph","Gastric acid secretion","Apoptotic process","Cystic hygroma","Regulation of microtubule depolymerization","Pigmentary retinal degeneration","Cotranslational protein targeting to membrane","Protein transport","DNA strand elongation involved in DNA replication","Postreplication repair","Conjunctival telangiectasia","Abnormality of the vasculature of the conjunctiva","Mitochondrial respiratory chain complex III assembly","Respiratory chain complex III assembly","Spastic paraparesis","Dysphonia","Immune response-activating cell surface receptor signaling pathway","Antigen receptor-mediated signaling pathway","intra-Golgi vesicle-mediated transport","Absence seizures","Angiotensin maturation","Regulation of angiotensin levels in blood","Golgi lumen acidification","Generalized tonic-clonic seizures","Renin-angiotensin system","Positive regulation of trophoblast cell migration","Negative regulation of defense response to virus","Negative regulation of mRNA splicing. via spliceosome","Malate-Aspartate shuttle","NADH oxidation","Tricarboxylic acid cycle","Glyoxylate and dicarboxylate metabolism","Protein branched polyubiquitination","Regulation of meiotic cell cycle","Anaphase-Promoting complex-dependent catabolic process","Progesterone-mediated oocyte maturation","Mitochondrial electron transport. ubiquinol to cytochrome c","Athetosis","Increased serum lactate","Glycerol ether biosynthetic process","Ether lipid biosynthetic process","Ether lipid metabolic process","Delayed CNS myelination","Abnormality of long-chain fatty-acid metabolism","Regulation of plasminogen activation","Extrinsic apoptotic signaling pathway via death domain receptors","Fatty acid beta-oxidation","Fatty acid oxidation","Sudden death","Fatty acid alpha-oxidation","Isoprenoid metabolic process","2-Oxoglutarate metabolic process","Abnormal pupillary function","Ribosome","Abnormality of aromatic amino acid family metabolism","Choreoathetosis","Galactose catabolic process","Organophosphate catabolic process","Carbohydrate derivative catabolic process","Fatigue","Reduced antithrombin III activity","Galactose metabolism","Protein ufmylation","Megakaryocyte differentiation","Neuromuscular process","Fatty acid beta-oxidation using acyl-coa dehydrogenase","Amino acid catabolic process","Electron transport chain","Generalized aminoaciduria","Hypoglycemic coma","Protein oxidation","Hydrogen peroxide catabolic process","Negative regulation of transferase activity","Mitochondrial DNA replication","Protein hexamerization","Mitochondrial DNA metabolic process","Mitochondrial RNA 3'-end processing","Mitochondrial RNA processing","Histone mRNA catabolic process","Paraparesis","tRNA metabolic process","Slow progression","acetyl-CoA biosynthetic process","Pyruvate metabolic process","Delayed gross motor development","Poor speech","Dyschromatopsia","Positive regulation of lyase activity","[2Fe-2S] cluster assembly","Areflexia of lower limbs","Porphyrin metabolism","NADH dehydrogenase complex assembly","Mitochondrial respiratory chain complex i assembly","Mitochondrial electron transport. NADH to ubiquinone","Oxidative phosphorylation","Fatty acid catabolic process","Febrile seizures","Valine. leucine and isoleucine degradation","Iron-Sulfur cluster assembly","Metallo-Sulfur cluster assembly","Protein maturation","Acute necrotizing encephalopathy","ATP synthesis coupled electron transport","Cellular response to oxygen levels","Gliogenesis","Abnormal mitochondria in muscle tissue","succinyl-CoA metabolic process","Purine-Containing compound catabolic process","Nucleoside phosphate catabolic process","Citrate cycle (tca cycle)","Respiratory electron transport chain","Ragged-red muscle fibers","Abnormal activity of mitochondrial respiratory chain","Ribosomal large subunit export from nucleus","Ribosomal small subunit export from nucleus","Protein export from nucleus","Positive regulation of gene expression via chromosomal cpg island demethylation","Telomere maintenance in response to DNA damage","Positive regulation of nuclear-transcribed mRNA poly(a) tail shortening","Regulation of nuclear-transcribed mRNA poly(a) tail shortening","Positive regulation of translational initiation","snRNA processing","snRNA 3'-end processing","Gene expression","Phosphatidylserine acyl-chain remodeling","Phosphatidylserine metabolic process","Organophosphate ester transport","Spliceosomal snRNP assembly","protein-RNA complex assembly","Organelle fusion","Regulation of extracellular matrix constituent secretion","Regulation of fibroblast apoptotic process","Positive regulation of extracellular matrix organization","Hypsarrhythmia","Response to transforming growth factor beta","Cellular response to transforming growth factor beta stimulus","Cellular response to growth factor stimulus","Striated muscle cell differentiation","Myotube differentiation","Regulation of cytokine production involved in inflammatory response","Ether lipid metabolism","Retrograde vesicle-mediated transport. Golgi to endoplasmic reticulum","Notch receptor processing","Amyloid-Beta formation","Membrane protein intracellular domain proteolysis","Protein catabolic process","Establishment of protein localization to mitochondrion","Cellular response to nitrogen levels","Cellular response to nitrogen starvation","Mitophagy","Regulation of SNARE complex assembly","Endosomal vesicle fusion","Late endosome to lysosome transport","Protein localization to endoplasmic reticulum","Neuron development","Establishment of protein localization to peroxisome","Receptor recycling","Peroxisomal membrane transport","Brushfield spots","Epiphyseal stippling","Positive regulation of RNA biosynthetic process","Positive regulation of DNA-templated transcription","Nucleoside salvage","Nucleobase-Containing compound metabolic process","Pyrimidine metabolism","NADPH oxidation","Organic acid metabolic process","NADP metabolic process","Taurine and hypotaurine metabolism","Regulation of mitochondrial fusion","Protein metabolic process","Mitochondrial transcription","Mitochondrial RNA metabolic process","DNA-templated transcription initiation","Regulation of Rac protein signal transduction","Protein K48-linked ubiquitination","Regulation of small GTPase mediated signal transduction","Glucose metabolic process","Response to ionizing radiation","Bradycardia","Platelet activating factor metabolic process","Phosphatidylcholine catabolic process","Alpha-linolenic acid metabolism","Regulation of keratinocyte apoptotic process","Positive regulation of epithelial cell apoptotic process","Nf-kappa b signaling pathway","- regulation of nuclear-transcribed mRNA cat proc. nonsense-mediated decay","Regulation of nuclear-transcribed mRNA catabolic process. nonsense-mediated decay","Negative regulation of mRNA catabolic process","Sandal gap","Fine hair","Positive regulation of mitophagy","Establishment of protein localization to vacuole","Yersinia infection","Negative regulation of proteasomal ubiquitin-dependent protein catabolic process","Regulation of response to biotic stimulus","Negative regulation of ubiquitin-dependent protein catabolic process","Brain morphogenesis","Positive regulation of circadian rhythm","Positive regulation of post-transcriptional gene silencing by RNA","Positive regulation of miRNA-mediated gene silencing","Adenosine to inosine editing","Base conversion or substitution editing","RNA modification","Regulation of translation in response to stress","miRNA-mediated gene silencing by inhibition of translation","Negative regulation of translational initiation","mRNA export from nucleus","mRNA transport","Ribosome biogenesis in eukaryotes","Suppression of viral release by host","DNA methylation-dependent constitutive heterochromatin formation","Positive regulation of protein import into nucleus","Regulation of defense response to virus","Regulation of defense response to virus by host","Negative regulation of type i interferon production","Oligomenorrhea","Establishment or maintenance of epithelial cell apical/basal polarity","Positive regulation of T-helper 17 cell lineage commitment","Positive regulation of cell fate commitment","Positive regulation of T-helper 17 cell differentiation","Positive regulation of protein sumoylation","Regulation of protein sumoylation","Double-Strand break repair via alternative nonhomologous end joining","Homologous recombination","Cellular response to cadmium ion","Cellular response to copper ion","Intrinsic apoptotic signaling pathway in response to oxidative stress","Negative regulation of telomere capping","Regulation of telomere capping","Positive regulation of DNA damage response. signal transduction by P53 class mediator","Hypoplasia of the thymus","Glucose intolerance","Regulation of nucleotide-excision repair","Regulation of G0 to G1 transition","Regulation of metaphase/anaphase transition of cell cycle","Narrow nasal bridge","Sparse scalp hair","Positive regulation of transcription elongation by RNA polymerase II","RNA polymerase II preinitiation complex assembly","Transcription preinitiation complex assembly","Prostaglandin biosynthetic process","Unsaturated fatty acid biosynthetic process","Prostanoid biosynthetic process","Arachidonic acid metabolism","Response to glucagon","Regulation of protein ADP-ribosylation","Lipoprotein biosynthetic process","Protein K27-linked ubiquitination","Negative regulation of fatty acid biosynthetic process","Positive regulation of cyclin-dependent protein serine/threonine kinase activity","Positive regulation of cyclin-dependent protein kinase activity","Proteasome assembly","Positive regulation of transcription initiation by RNA polymerase II","Terpenoid metabolic process","Omega-Hydroxylase P450 pathway","Linoleic acid metabolism","Positive regulation of embryonic development","Positive regulation of cell development","Infertility","Steroid hormone receptor signaling pathway","Primary amenorrhea","Osteopenia","Positive regulation of extrinsic apoptotic signaling pathway","Skeletal system morphogenesis","Gonadal dysgenesis","Testicular neoplasm","Insulin processing","Insulin metabolic process","Regulation of ER to Golgi vesicle-mediated transport","Midbrain dopaminergic neuron differentiation","Cellular response to cholesterol","Stress granule assembly","Protein destabilization","Membraneless organelle assembly","Golgi to plasma membrane transport","Vesicle organization","Regulation of transcription regulatory region DNA binding","Regulation of DNA binding","Autophagosome maturation","Protein-Containing complex disassembly","Membrane biogenesis","Protein targeting to peroxisome","Peroxisome fission","Glycerolipid catabolic process","Glycerophospholipid catabolic process","Phospholipid catabolic process","Cytoplasmic microtubule organization","Attachment of GPI anchor to protein","GPI anchored protein biosynthesis","Glycosylphosphatidylinositol (gpi)-anchor biosynthesis","Modulation by host of viral process","Vesicle-Mediated transport between endosomal compartments","Hypophosphatemic rickets","Curly hair","SREBP signaling pathway","Cellular response to sterol depletion","Regulation of sterol biosynthetic process","Lower limb muscle weakness","Outer mitochondrial membrane organization","Protein insertion into mitochondrial outer membrane","Protein insertion into mitochondrial inner membrane","Very long-chain fatty acid biosynthetic process","Increased neuronal autofluorescent lipopigment","Smooth muscle contraction","Negative regulation of cell cycle G1/S phase transition","Alzheimer disease","Platelet aggregation","Homotypic cell-cell adhesion","Increased mean platelet volume","Abnormal platelet volume","Systemic lupus erythematosus","Relative macrocephaly","Hepoxilin biosynthetic process","Hepoxilin metabolic process","Lipoxygenase pathway","Nuclear cataract","Vesicle transport along microtubule","Focal adhesion assembly","Cell-Cell adhesion mediated by cadherin","Receptor-Mediated endocytosis","Nitrogen compound transport","Central nervous system myelination","Oligodendrocyte development","Positive regulation of blood circulation","Response to auditory stimulus","Negative regulation of heart contraction","Diplopia","Abnormality of binocular vision","Intermembrane lipid transfer","Fat-Soluble vitamin metabolic process","Epidermoid cyst","Hyperlipoproteinemia","Negative regulation of response to food","Positive regulation of ATP biosynthetic process","Positive regulation of fatty acid beta-oxidation","Adipocytokine signaling pathway","TOR signaling","L-aspartate import across plasma membrane","L-aspartate transmembrane transport","Acidic amino acid transport","Hemiparesis","Synaptic vesicle cycle","Negative regulation of axon extension","Negative regulation of axonogenesis","Negative regulation of developmental growth","Mitotic nuclear membrane organization","Cytochrome metabolic process","Basal ganglia calcification","Fatty acid degradation","Clonus","Regulation of D-glucose transmembrane transport","B cell chemotaxis","Lymphocyte chemotaxis","Bile acid biosynthetic process","Intrahepatic cholestasis","Primary bile acid biosynthesis","Metal ion transport","Muscle stiffness","Recombinational repair","Double-Strand break repair via homologous recombination","Unsteady gait","Positive regulation of transmembrane transport","Regulation of organelle organization","Positive regulation of mitochondrial fission","Spastic paraplegia","Purine ribonucleoside metabolic process","GMP metabolic process","Hypoplasia of the corpus callosum","Abnormality of the periventricular white matter","Bowel incontinence","Glomerular filtration","Renal filtration","Monoatomic cation transport","Protein exit from endoplasmic reticulum","Intracellular protein transport","Low anterior hairline","Protein targeting","Protein localization","Long nose","Genu recurvatum","Golgi to endosome transport","Golgi to vacuole transport","Excessive salivation","Glutamate metabolic process","Dicarboxylic acid metabolic process","Wide cranial sutures","Arginine and proline metabolism","Wide intermamillary distance","Death in infancy","Gliosis","Phosphatidylethanolamine biosynthetic process","Phosphatidylethanolamine metabolic process","Phospholipid biosynthetic process","Phosphonate and phosphinate metabolism","Diterpenoid metabolic process","Primary alcohol metabolic process","Thoracic kyphosis","Abnormality of the thoracic spine","Ascorbate and aldarate metabolism","Response to nerve growth factor","Rac protein signal transduction","Membrane fusion","Prot transport to vacuole inv in ub-dep prot cat proc via multivsiclr bdy sorting pway","Late endosome to vacuole transport via multivesicular body sorting pathway","Protein import into nucleus","Import into nucleus","Pectus carinatum","IMP biosynthetic process","IMP metabolic process","Cortical visual impairment","Modified amino acid catabolic process","Glycerolipid metabolism","Negative regulation of peptidyl-threonine phosphorylation","Positive regulation of translation in response to stress","Phosphatidylinositol-Mediated signaling","Phosphatidylinositol phosphate biosynthetic process","Synaptic vesicle docking","Regulation of dendrite extension","Wound healing","Urethral obstruction","Alopecia of scalp","Cellular response to molecule of bacterial origin","Cellular response to lipopolysaccharide","RNA biosynthetic process","Positive regulation of calcium ion-dependent exocytosis","B cell receptor signaling pathway","B cell differentiation","Lymphocyte differentiation","Chronic sinusitis","Agammaglobulinemia","Type 2 muscle fiber atrophy","Muscle fiber atrophy","Regulation of filopodium assembly","Positive regulation of developmental growth","Positive regulation of plasma membrane bounded cell projection assembly","Easy fatigability","Narrow chest","Ecm-receptor interaction","Proton-Transporting V-type ATPase complex assembly","Dolichol-Linked oligosaccharide biosynthetic process","Carbohydrate derivative biosynthetic process","Hypoproteinemia","N-glycan biosynthesis","Iris coloboma","UDP-N-acetylglucosamine biosynthetic process","Amino sugar metabolic process","Fructose 6-phosphate metabolic process","Abnormality of the neuromuscular junction","Fatigable weakness","Amino sugar and nucleotide sugar metabolism","Regulation of rab protein signal transduction","Regulation of extrinsic apoptotic signaling pathway via death domain receptors","Digestive system development","Positive regulation of transcription by RNA polymerase III","Regulation of transcription by RNA polymerase III","Chromatin remodeling","Chromatin organization","Mitochondrial tRNA modification","mRNA pseudouridine synthesis","Pseudouridine synthesis","Abnormal number of erythroid precursors","Abnormality of cells of the erythroid lineage","Protein retention in ER lumen","Maintenance of protein localization in endoplasmic reticulum","Stridor","Negative regulation of defense response","Negative regulation of inflammatory response","Establishment of epithelial cell apical/basal polarity","Polarized epithelial cell differentiation","Positive regulation of calcineurin-NFAT signaling cascade","Positive regulation of calcineurin-mediated signaling","Regulation of calcineurin-NFAT signaling cascade","Palpebral edema","Nuclear envelope organization","Nuclear membrane organization","Positive regulation of ATP-dependent activity","Neutrophil degranulation","Regulation of histamine secretion by mast cell","Regulation of synaptic vesicle exocytosis","Golgi to plasma membrane protein transport","Regulation of regulated secretory pathway","Abnormal eating behavior","Hypocalcemia","Negative regulation of microtubule polymerization","Mesangial abnormality","Morphogenesis of an endothelium","Endothelial tube morphogenesis","Epithelial tube morphogenesis","Substrate adhesion-dependent cell spreading","Integrin-Mediated signaling pathway","Basic amino acid transport","Amino acid transport","Abnormality of glutamine family amino acid metabolism","Abnormality of aspartate family amino acid metabolism","Protein digestion and absorption","Regulation of g protein-coupled receptor signaling pathway","Regulation of response to external stimulus","Nephrolithiasis","Lysine degradation","Negative regulation of interferon-beta production","Peptidyl-Threonine dephosphorylation","Mapk signaling pathway","Cellular response to acetylcholine","Acetylcholine receptor signaling pathway","Membrane depolarization","Popliteal pterygium","Neuroactive ligand-receptor interaction","Epithelial tube branching involved in lung morphogenesis","Gland morphogenesis","Stenosis of the external auditory canal","Chronic otitis media","Central carbon metabolism in cancer","Split foot","Cutaneous finger syndactyly","Positive regulation of protein tyrosine kinase activity","Regulation of protein tyrosine kinase activity","Depressed nasal tip","Alpha-Linolenic acid metabolic process","Biosynthesis of unsaturated fatty acids","Positive regulation of synaptic transmission","Positive regulation of amine transport","Positive regulation of neurotransmitter secretion","Virion - ebolavirus. lyssavirus and morbillivirus","Behavioral response to nicotine","Postsynapse organization","Muscle cell development","Cellular response to caffeine","Release of sequestered calcium ion into cytosol by sarcoplasmic reticulum","Response to caffeine","Exercise-induced myalgia","Synaptic vesicle fusion to presynaptic active zone membrane","Neurotransmitter uptake","Endochondral ossification","Endochondral bone morphogenesis","Round ear","Regulation of actin filament length","Cardiac myofibril assembly","Regulation of cellular component size","Positive regulation of voltage-gated calcium channel activity","Positive regulation of calcium ion transmembrane transporter activity","Myopathic facies","Malignant hyperthermia","Regulation of skeletal muscle cell differentiation","Skeletal muscle cell differentiation","Breech presentation","Regulation of skeletal muscle contraction","Adult heart development","Actin-Myosin filament sliding","Abnormality of the left ventricular outflow tract","Subaortic stenosis","Regulation of blood circulation","Right ventricular cardiomyopathy","Heterotypic cell-cell adhesion","Endodermal cell differentiation","Endoderm formation","Infantile muscular hypotonia","Increased variability in muscle fiber diameter","Skeletal muscle thin filament assembly","Regulation of skeletal muscle fiber development","Skeletal myofibril assembly","Negative regulation of potassium ion transmembrane transport","Negative regulation of potassium ion transport","Regulation of calcium ion transmembrane transport via high voltage-gated calcium channel","Fc gamma r-mediated phagocytosis","Skeletal muscle fiber development","Myotube cell development","Microtubule bundle formation","Visual system development","Eye development","Sensory organ development","Cell proliferation in forebrain","Regulation of integrin activation","Microtubule depolymerization","Negative regulation of cold-induced thermogenesis","Negative regulation of metabolic process","Negative regulation of canonical Wnt signaling pathway","Adenylate cyclase-activating dopamine receptor signaling pathway","Response to catecholamine","Cellular response to monoamine stimulus","Phototransduction","Regulation of chromosome segregation","Complete atrioventricular canal defect","Intracellular oxygen homeostasis","Regulation of transforming growth factor beta2 production","Positive regulation of hormone metabolic process","Positive regulation of hemoglobin biosynthetic process","Regulation of hemoglobin biosynthetic process","Cellular response to nutrient","Glucagon signaling pathway","Response to estrogen","Positive regulation of gene expression. epigenetic","Transcription initiation-coupled chromatin remodeling","Cushing syndrome","Protein N-linked glycosylation","Protein glycosylation","Macromolecule modification","Endoplasmic reticulum mannose trimming","Protein alpha-1.2-demannosylation","De novo' post-translational protein folding","Regulation of phospholipid metabolic process","Regulation of humoral immune response","Positive regulation of proteolysis involved in protein catabolic process","Regulation of proteasomal protein catabolic process","Positive regulation of proteasomal protein catabolic process","Proteasome","G1/S transition of mitotic cell cycle","Cell cycle G1/S phase transition","Regulation of cellular response to insulin stimulus","Positive regulation of metaphase/anaphase transition of cell cycle","Positive regulation of mitotic metaphase/anaphase transition","Abnormality of chloride homeostasis","Hyperkalemia","Hedgehog signaling pathway","Positive regulation of cell morphogenesis","Positive regulation of dendrite morphogenesis","Slender long bone","Sprengel anomaly","Monocyte differentiation","Mononuclear cell differentiation","Myeloid leukocyte differentiation","Regulation of aerobic respiration","Regulation of oxidative phosphorylation","Cellular response to muramyl dipeptide","Response to muramyl dipeptide","Positive regulation of collagen biosynthetic process","Zonular cataract","Heterochromia iridis","Prevention of polyspermy","Regulation of plasma membrane repair","Bilateral sensorineural hearing impairment","Regulation of translational initiation in response to stress","Response to lead ion","Long-term potentiation","Motile cilium assembly","Axonemal dynein complex assembly","Absent/shortened dynein arms","Dynein arm defect of respiratory motile cilia","Negative regulation of mitochondrial membrane permeability","- regulation of mt outer membrane permeabilization inv in apoptotic sgnlng pway","Regulation of peptidyl-lysine acetylation","Lipid droplet disassembly","Negative regulation of stress-activated protein kinase signaling cascade","Regulation of stress-activated protein kinase signaling cascade","Regulation of translation in response to endoplasmic reticulum stress","Negative regulation of response to oxidative stress","Negative regulation of ERAD pathway","Regulation of response to oxidative stress","Tricarboxylic acid metabolic process","Intracellular iron ion homeostasis","Intracellular monoatomic cation homeostasis","Regulation of plasma membrane bounded cell projection assembly","Regulation of cilium assembly","Regulation of organelle assembly","Cardiac muscle cell development","Regulation of cell junction assembly","Regulation of dendritic spine morphogenesis","Melanin metabolic process","RNA decapping","Heart trabecula formation","Negative regulation of activin receptor signaling pathway","Positive regulation of protein exit from endoplasmic reticulum","Regulation of retrograde protein transport. ER to cytosol","Glycoprotein catabolic process","Negative regulation of smoothened signaling pathway","Regulation of smoothened signaling pathway","Protein poly-ADP-ribosylation","Protein auto-ADP-ribosylation","Regulation of store-operated calcium entry","Negative regulation of calcineurin-NFAT signaling cascade","Negative regulation of calcineurin-mediated signaling","Glutamatergic synapse","Cellular response to chemical stress","Cellular response to oxidative stress","Regulation of nitric oxide metabolic process","Regulation of nitric-oxide synthase activity","Regulation of biosynthetic process","Regulation of relaxation of muscle","Negative regulation of ryanodine-sensitive calcium-release channel activity","Positive regulation of cell activation","Clumsiness","Eosinophilia","Steroid biosynthetic process","Lipid biosynthetic process","Proline metabolic process","Non-Proteinogenic amino acid catabolic process","Hydroxyprolinuria","Interleukin-10-Mediated signaling pathway","Maintenance of gastrointestinal epithelium","Positive regulation of receptor signaling pathway via JAK-STAT","Hematochezia","Colitis","Viral protein interaction with cytokine and cytokine receptor","Female meiotic nuclear division","Male meiosis i","Meiosis i","Negative regulation of cell population proliferation","Hip contracture","Limited hip movement","Meiotic spindle assembly","Negative regulation of cell size","Asymmetry of the thorax","Hyperthyroidism","Endometrial cancer","Positive regulation of calcium ion transport","Negative regulation of arp2/3 complex-mediated actin nucleation","Somite development","Negative regulation of cell migration involved in sprouting angiogenesis","Regulation of cell migration involved in sprouting angiogenesis","Non-Canonical NF-kappaB signal transduction","Canonical NF-kappaB signal transduction","Regulation of trophoblast cell migration","Regulation of cellular response to transforming growth factor beta stimulus","Regulation of circadian sleep/wake cycle. sleep","Lipoprotein transport","Lipoprotein localization","Interstitial pulmonary disease","Recurrent sinusitis","Positive regulation of transcription by RNA polymerase II","Regulation of Golgi organization","Regulation of enamel mineralization","Positive regulation of tooth mineralization","Ileus","Rectal prolapse","Abc transporters","Regulation of chaperone-mediated autophagy","Positive regulation of lipid metabolic process","Regulation of cell size","Insulin receptor signaling pathway","Cellular response to insulin stimulus","Cell surface receptor protein tyrosine kinase signaling pathway","Double-Strand break repair via break-induced replication","Regulation of DNA-templated DNA replication initiation","Regulation of DNA-templated DNA replication","Dna replication","Metaphase/Anaphase transition of mitotic cell cycle","Metaphase/Anaphase transition of cell cycle","Negative regulation of DNA binding","Positive regulation of fibroblast proliferation","Negative regulation of fat cell differentiation","Positive regulation of myoblast fusion","Muscle cell fate commitment","Placenta blood vessel development","Atrioventricular valve formation","Dorsal aorta development","Regulation of growth hormone receptor signaling pathway","Phospholipid homeostasis","Type I diabetes mellitus","Hyperglycemia","Maturity onset diabetes of the young","Angiotensin-Activated signaling pathway","Regulation of cardiac muscle cell apoptotic process","Cellular response to angiotensin","Establishment of Golgi localization","Golgi inheritance","Oocyte meiosis","Negative regulation of protein import into nucleus","Negative regulation of intracellular protein transport","Negative regulation of nucleocytoplasmic transport","Glucocorticoid metabolic process","Steroid catabolic process","Positive regulation of phagocytosis","Regulation of phagocytosis","Positive regulation of tumor necrosis factor production","Regulation of protein localization to cell surface","Lower limb asymmetry","Rhabdomyosarcoma","Neoplasm of striated muscle","Regulation of calcium ion import across plasma membrane","Regulation of response to wounding","Negative regulation of locomotion","Negative regulation of response to wounding","Positive regulation of cytoplasmic translational initiation","Negative regulation of anoikis","Cell migration involved in sprouting angiogenesis","Regulation of anoikis","Immune response-regulating cell surface receptor signaling pathway","Fc-epsilon receptor signaling pathway","Fc-gamma receptor signaling pathway involved in phagocytosis","Fc epsilon ri signaling pathway","Regulation of positive chemotaxis","Positive regulation of positive chemotaxis","Regulation of lamellipodium morphogenesis","Negative regulation of substrate adhesion-dependent cell spreading","Actin filament capping","Barbed-End actin filament capping","Protein-Containing complex organization","Palmoplantar keratoderma","Osteoclast differentiation","Autophagosome membrane docking","Mitochondrion-Endoplasmic reticulum membrane tethering","Regulation of cardiac muscle cell action potential inv in regulation of contraction","Ridged nail","Skin nodule","Negative regulation of cell-substrate adhesion","Focal segmental glomerulosclerosis","Abnormal albumin level","Actin filament bundle assembly","Actin filament bundle organization","post-Golgi vesicle-mediated transport","Podocyte differentiation","Positive regulation of Rac protein signal transduction","Mesodermal cell differentiation","Cellular component maintenance","Regulation of glucan biosynthetic process","Regulation of glycogen metabolic process","Regulation of transferase activity","Insulin signaling pathway","Negative regulation of cellular extravasation","Cellular response to prostaglandin e stimulus","Response to prostaglandin","Renin secretion","Salivary secretion","Myoblast migration","Regulation of striated muscle tissue development","Box c/d snoRNP assembly","Small nucleolar ribonucleoprotein complex assembly","Regulation of atrial cardiac muscle cell membrane depolarization","Positive regulation of sodium ion transmembrane transporter activity","Positive regulation of sodium ion transport","Ventricular fibrillation","Adrenergic signaling in cardiomyocytes","Postsynaptic membrane assembly","Regulation of respiratory system process","Postsynapse assembly","Vertigo","Sudden cardiac death","Oxygen transport","Gas transport","Cellular response to superoxide","Actin nucleation","Axon regeneration","Neuromuscular junction development","Morphogenesis of an epithelium","Dilated cardiomyopathy","Regulation of myotube differentiation","Positive regulation of striated muscle cell differentiation","Detection of muscle stretch","Cardiac muscle hypertrophy","Muscle tissue development","Atrial fibrillation","Dendrite self-avoidance","Store-Operated calcium entry","Calcium ion transport","Bundle branch block","Positive regulation of skeletal muscle tissue development","Regulation of skeletal muscle satellite cell proliferation","Regulation of myoblast differentiation","Negative regulation of cell differentiation","Regulation of actin filament organization","Heart contraction","Ulnar deviation of the wrist","Regulation of striated muscle contraction","Regulation of muscle contraction","Plasma membrane repair","Plasma membrane organization","Muscle fiber inclusion bodies","Skeletal muscle tissue regeneration","Myoblast differentiation","Negative regulation of protein binding","Striated muscle hypertrophy","Cellular response to alkaloid","Positive regulation of muscle contraction","Paralysis","Hypokalemia","Cortisol synthesis and secretion","Muscle tissue morphogenesis","Negative regulation of DNA biosynthetic process","Regulation of DNA biosynthetic process","Positive regulation of striated muscle contraction","Sarcoplasmic reticulum calcium ion transport","Relaxation of muscle","Glucan catabolic process","Glucan metabolic process","Glycogen catabolic process","Exercise-induced muscle cramps","Starch and sucrose metabolism","Negative regulation of glycolytic process","Negative regulation of purine nucleotide catabolic process","Negative regulation of ATP metabolic process","Positive regulation of non-canonical NF-kappaB signal transduction","Regulation of non-canonical NF-kappaB signal transduction","Primary atrial arrhythmia","Regulation of actin filament-based movement","Ventricular cardiac muscle tissue development","Hypertrophic cardiomyopathy","Negative regulation of ATP-dependent activity","Heart process","Pectus excavatum","Circulatory system development","Protein kinase a signaling","Ventricular arrhythmia","Left ventricular hypertrophy","Positive regulation of store-operated calcium channel activity","Regulation of release of sequestered calcium ion into cytosol by sarcoplasmic reticulum","Calcium signaling pathway","Abnormality of the endocardium","Positive regulation of cytokinesis","Negative regulation of vascular associated smooth muscle cell proliferation","Regulation of smooth muscle contraction","Tooth mineralization","Regulation of ventricular cardiac muscle cell membrane repolarization","Ventricular cardiac muscle cell action potential","Regulation of cardiac muscle cell membrane repolarization","Prolonged QT interval","Syncope","Long-Term synaptic potentiation","Peptide hormone secretion","Epithelial cell apoptotic process","Regulation of SA node cell action potential","Regulation of ventricular cardiac muscle cell action potential","Atrial cardiac muscle cell action potential","Exercise intolerance","Negative regulation of release of sequestered calcium ion into cytosol","Regulation of sequestering of calcium ion","Positive regulation of actin filament depolymerization","Positive regulation of protein depolymerization","Regulation of actin filament depolymerization","Muscle fiber cytoplasmatic inclusion bodies","Pertussis","Monocyte activation","Macrophage activation involved in immune response","Negative regulation of phagocytosis","Rimmed vacuoles","Chaperone cofactor-dependent protein refolding","Increased density of long bones","Regulation of mRNA processing","Cell junction organization","N-acetylneuraminate metabolic process","Amino sugar biosynthetic process","Carboxylic acid biosynthetic process","Limb-girdle muscle atrophy","Biosynthesis of various nucleotide sugars","Childhood onset","Plasma membrane raft assembly","Regulation of sarcomere organization","Positive regulation of glycogen metabolic process","Positive regulation of catabolic process","Glycine. serine and threonine metabolism","Carnitine metabolic process","Fatty acid transmembrane transport","Intracellular lipid transport","Long-Chain fatty acid transport","Atrioventricular block","Medium-Chain fatty acid metabolic process","Long-Chain fatty acid metabolic process","Fatty acid metabolic process","Cerebral edema","Glucan biosynthetic process","Glycogen biosynthetic process","Glycogen metabolic process","Negative regulation of fatty acid oxidation","Regulation of peptide hormone secretion","Hypoglycemic seizures","Hyperinsulinemic hypoglycemia","Carboxylic acid transport","Carboxylic acid transmembrane transport","Plasminogen activation","Myoglobinuria","ADP catabolic process","Glycolytic process","Pyridine nucleotide catabolic process","Abnormality of glycolysis","Propanoate metabolism","Energy reserve metabolic process","Positive regulation of triglyceride catabolic process","Regulation of triglyceride catabolic process","Positive regulation of triglyceride metabolic process","Congenital nonbullous ichthyosiform erythroderma","Regulation of lipolysis in adipocytes","Cerebral aneurysm","Quaternary ammonium group transport","Amino-Acid betaine transport","Hyperammonemia","Negative regulation of NF-kappaB transcription factor activity","T cell receptor signaling pathway","Positive regulation of NF-kappaB transcription factor activity","Elevated hepatic transaminases","Diacylglycerol biosynthetic process","Regulation of triglyceride storage","Increased muscle lipid content","Positive regulation of gluconeogenesis","Neonatal hypoglycemia","Fructose 1.6-bisphosphate metabolic process","Broad nasal tip","Thin upper lip vermilion","Heart block","Arachidonate secretion","Arachidonate transport","Nuclear membrane disassembly","Triglyceride biosynthetic process","Riboflavin metabolism","Negative regulation of muscle hypertrophy","Monoatomic anion transport","Inorganic anion transport","Nitric oxide mediated signal transduction","Epithelial cell development","DNA geometric change","Nucleic acid transport","Primary miRNA processing","Mask-like facies","Regulation of cytoplasmic translation","Cholesterol homeostasis","Sterol homeostasis","Gonadotropin excess","Positive regulation of cyclase activity","Stomatitis","Primary immunodeficiency","Positive regulation of cellular respiration","Decreased activity of mitochondrial respiratory chain","Positive regulation of mitochondrial calcium ion concentration","Mitochondrial calcium ion homeostasis","Intracellular ph elevation","Positive regulation of pinocytosis","Regulation of lysosome organization","Iron ion transmembrane transport","Regulation of amyloid fibril formation","Negative regulation of supramolecular fiber organization","Wrist flexion contracture","Protrusio acetabuli","Heart morphogenesis","Regulation of extrinsic apoptotic signaling pathway","Negative regulation of apoptotic signaling pathway","Short 1st metacarpal","Aplasia/Hypoplasia of the 1st metacarpal","Negative regulation of skeletal muscle cell differentiation","Cytokine-cytokine receptor interaction","Enamel mineralization","Platelet activation","Regulation of melanin biosynthetic process","Positive regulation of tumor necrosis factor-mediated signaling pathway","Negative regulation of toll-like receptor 4 signaling pathway","Synapse organization","C21-steroid hormone biosynthetic process","Olefinic compound biosynthetic process","Ketone biosynthetic process","Regulation of miRNA metabolic process","Concave nail","Protein import","Protein catabolic process in the vacuole","Negative regulation of NLRP3 inflammasome complex assembly","Cell differentiation in spinal cord","High anterior hairline","Follicular hyperkeratosis","Abnormality of the hip-girdle musculature","Hypoventilation","Abnormality of the calf musculature","Striated muscle tissue development","Scapular winging","Membrane organization","Palpitations","Abnormality of the right ventricle","Carbohydrate metabolic process","Protein O-linked glycosylation","Large eyes","Mannose type o-glycan biosynthesis","O-glycan processing","Type II lissencephaly","Cerebellar dysplasia","Protein O-linked mannosylation","Protein mannosylation","Retinal dysplasia","Isoprenoid biosynthetic process","Negative regulation of amyloid-beta clearance","Terpenoid backbone biosynthesis","+ regulation of endoplasmic reticulum stress-induced intrinsic apoptotic sgnlng pway","rRNA transcription","Positive regulation of locomotion","Regulation of basement membrane organization","Positive regulation of integrin-mediated signaling pathway","Positive regulation of muscle cell differentiation","Occipital encephalocele","Hypoplasia of the brainstem","Actin filament-based transport","Nuclear migration","Muscular dystrophy","Progressive hearing impairment","Chemical carcinogenesis - receptor activation","Respiratory insufficiency due to muscle weakness","Regulation of integrin-mediated signaling pathway","Positive regulation of substrate adhesion-dependent cell spreading","Integrin signaling","Inorganic cation transmembrane transport","Regulation of protein exit from endoplasmic reticulum","Positive regulation of Notch signaling pathway","T cell differentiation","Positive regulation of fibroblast apoptotic process","Negative regulation of cellular senescence","Duplicated collecting system","Septate vagina","Collagen biosynthetic process","Wound healing. spreading of epidermal cells","Eye morphogenesis","Peritonitis","Premature rupture of membranes","Regulation of behavior","Cellular response to interferon-beta","Response to interferon-beta","Cytosolic dna-sensing pathway","Nose development","Sex-Chromosome dosage compensation","Dosage compensation by inactivation of x chromosome","Pelvic girdle muscle weakness","Internal peptidyl-lysine acetylation","Negative regulation of centriole replication","Internal protein amino acid acetylation","Neuroblast proliferation","De novo centriole assembly","Multi-Ciliated epithelial cell differentiation","Regulation of protein K63-linked ubiquitination","Lipid metabolic process","Regulation of macromolecule biosynthetic process","Subtelomeric heterochromatin formation","COPII vesicle coating","Vesicle targeting. rough ER to cis-golgi","Vesicle coating","Hip dysplasia","Ribosomal small subunit assembly","Ribosome assembly","Antiviral innate immune response","Thrombocytosis","Asplenia","Polyprenol metabolic process","Dolichol metabolic process","Negative regulation of fibroblast proliferation","Negative regulation of inflammasome-mediated signaling pathway","Protein O-linked glycosylation via serine","Other types of o-glycan biosynthesis","Establishment of protein localization to organelle","Collagen fibril organization","Camptodactyly of finger","Gowers sign","Regulation of protein glycosylation","Regulation of glycoprotein biosynthetic process","Optic nerve hypoplasia","Glucosamine-Containing compound metabolic process","N-acetylglucosamine metabolic process","Macromolecule glycosylation","Glycoprotein biosynthetic process","Heterotopia","Lissencephaly","poly-N-acetyllactosamine biosynthetic process","poly-N-acetyllactosamine metabolic process","Keratan sulfate proteoglycan biosynthetic process","Negative regulation of leukocyte cell-cell adhesion","Negative regulation of lymphocyte activation","Negative regulation of t cell activation","MHC class II protein complex assembly","Peptide antigen assembly with MHC class II protein complex","Peptide antigen assembly with MHC protein complex","Asthma","Negative regulation of retrograde protein transport. ER to cytosol","Negative regulation of protein exit from endoplasmic reticulum","Signal release","Anterior/Posterior axis specification","Positive regulation of cell communication","Cellular response to UV-A","Cervical subluxation","Heterochromatin organization","Phospholipid transport","Positive regulation of urine volume","Ruffle assembly","Negative regulation of glycogen biosynthetic process","Golgi organization","Bone resorption","Positive regulation of regulated secretory pathway","Pancreatic secretion","GPI anchor biosynthetic process","GPI anchor metabolic process","DNA damage checkpoint signaling","Oligosaccharide biosynthetic process","Carbohydrate biosynthetic process","Regulation of relaxation of cardiac muscle","Membrane repolarization during ventricular cardiac muscle cell action potential","Negative regulation of delayed rectifier potassium channel activity","Negative regulation of voltage-gated potassium channel activity","Abnormal EKG","Regulation of cardiac muscle cell action potential","Regulation of cardiac muscle cell contraction","Regulation of atrial cardiac muscle cell membrane repolarization","Atrial cardiac muscle cell to AV node cell signaling","Membrane depolarization during cardiac muscle cell action potential","Regulation of potassium ion transmembrane transporter activity","Positive regulation of potassium ion transmembrane transport","Positive regulation of ion transmembrane transporter activity","Receptor guanylyl cyclase signaling pathway","Regulation of ventricular cardiac muscle cell membrane depolarization","Positive regulation of protein localization to cell surface","Woolly hair","Regulation of potassium ion export across plasma membrane","Congenital sensorineural hearing impairment","Vibrio cholerae infection","Very long-chain fatty acid metabolic process","Fatty acid biosynthetic process","Negative regulation of mRNA processing","Negative regulation of RNA splicing","Atrial cardiac muscle tissue development","Cardiac cell development","Decreased circulating renin level","Negative regulation of extrinsic apoptotic signaling pathway in absence of ligand","Negative regulation of signal transduction in absence of ligand","Regulation of extrinsic apoptotic signaling pathway in absence of ligand","Response to endoplasmic reticulum stress","Proteasomal protein catabolic process","Cardiac muscle cell differentiation","Cardiac muscle tissue morphogenesis","Regulation of endothelial cell development","Positive regulation of signaling","Blood coagulation. intrinsic pathway","Negative regulation of transcription by RNA polymerase i","Long foot","Regulation of endothelial cell differentiation","Positive regulation of epithelial cell differentiation","Cellular defense response","Tail-Anchored membrane protein insertion into ER membrane","Protein insertion into ER membrane","Negative regulation of ubiquitin-protein transferase activity","Regulation of ubiquitin-protein transferase activity","Transcription-Dependent tethering of RNA polymerase II gene DNA at nuclear periphery","Protein localization to nuclear envelope","Lipid and atherosclerosis","Negative regulation of granulocyte differentiation","Brown fat cell differentiation","Regulation of granulocyte differentiation","Negative regulation of transcription regulatory region DNA binding","Agnosia","Amyloidosis","Bundle of his cell-purkinje myocyte adhesion involved in cell communication","Cardiac muscle cell-cardiac muscle cell adhesion","Desmosome assembly","Bundle of his cell to Purkinje myocyte communication","Type b pancreatic cell development","Type b pancreatic cell differentiation","Potassium ion import across plasma membrane","Vascular transport","Transport across blood-brain barrier","Hypoplastic ischia","Congenital. generalized hypertrichosis","Regulation of resting membrane potential","Persistence of primary teeth","Abnormality of the frontal sinuses","Regulation of epithelial to mesenchymal transition inv in endocardial cushion formation","Malaria","Cardiac atrium development","Coenzyme a biosynthetic process","acyl-CoA biosynthetic process","Abnormality of pyruvate family amino acid metabolism","Regulation of mitochondrial gene expression","Regulation of mitochondrial translation","Regulation of DNA-templated transcription elongation","Patent foramen ovale","Premature ovarian failure","Intermediate filament organization","Protein autoubiquitination","tRNA wobble uridine modification","tRNA methylation","Adactyly","Abnormal isoelectric focusing of serum transferrin","Embryonic appendage morphogenesis","Detection of mechanical stimulus","Overlapping toe","Apoptotic DNA fragmentation","Positive regulation of DNA-templated DNA replication","Weak cry","Postnatal microcephaly","Nucleotide-Excision repair. DNA gap filling","Generalized amyotrophy","Mitochondrial large ribosomal subunit assembly","Regulation of mitochondrial mRNA stability","Alditol metabolic process","Glycerol metabolic process","Exotropia","External ophthalmoplegia","Methylmalonic aciduria","Neutrophil extracellular trap formation","Regulation of actin nucleation","Regulation of arp2/3 complex-mediated actin nucleation","Regulation of vasculature development","Nucleoside diphosphate metabolic process","Proximal tubulopathy","Glutathione metabolism","Regulation of mitophagy","Cardiac conduction","rRNA modification","rRNA methylation","Macromolecule methylation","Organic cation transport","Nausea","Hepaticobiliary system development","Liver development","Gland development","Formation of extrachromosomal circular DNA","T-Circle formation","Obstructive sleep apnea","Slender build","Positive regulation of chromosome condensation","Regulation of chromosome condensation","Regulation of chromosome separation","Ganglion development","Establishment of protein localization to mitochondrial membrane","Resolution of DNA recombination intermediates","DNA topological change","Neoplasm of the heart","Mitochondrial ATP synthesis coupled electron transport","Orthostatic hypotension","Thyroid hormone synthesis","Protein deneddylation","Synaptic vesicle membrane organization","Craniofacial dystonia","Cell-Matrix adhesion","Myoblast fusion","Extracellular matrix disassembly","Subacute progressive viral hepatitis","Viral hepatitis","Malnutrition","Noradrenergic neuron differentiation","Dopaminergic neuron differentiation"],"edges":"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WwF/AMgDaAZkAX8AyANoBGUBfwDIA2gAbQF/AIgBSAaaAX8AyANoBqIBfwDIA2gGvwF/AMgDaAbIAX8AyANoBukBfwDIA2gG7QF/AMgDaAYwAn8AyANoBjkCfwDIA2gGSAJ/AMgDaAZcAn8AyANoBl4CfwDIA2gGpAJ/AMgDaAbOAn8AwAFoAtkCfwAAAUAC2wJ/AAAAQALpAn8AyANoBuwCfwDIA2gG7gJ/AMgDaAbvAn8AyANoBvUCfwDIA2gG9gJ/AMgDaAYkA38AAABAAD4DfwDIA2gGQQN/AMgDaAZCA38AyANoBkQDfwDIA2gGZAN/AAAAYABvA38AAAFoAoQDfwBAA2AAhgN/AIADaAYbBIAAzud7B0IEgAAEAWIATASAAM7newdPBIAAzud7B3AEgADMp3sDlASAAIAEYACUAIAAzud7B5gAgADO53sHpQCAAMyncgasAIAASIIAA7YAgACAAAAAVAGAAM7jSwNbAYAAzud7B2QBgADO53sFZQGAAM7jegFvAYAAgsdQA5oBgADO53sHswGAAM7newfhAYAAzud7B+MBgADG5XkH6QGAAM7newftAYAAzud7B/0BgADO53sHSAKAAM7newdeAoAAzud7B84CgADEwWgCzwKAAMQDegLbAoAAAIBAA+kCgADO53sH9QKAAM7newf2AoAAzud7B/0CgADO53oHJAOAAAAAUQAvA4AAzud7BzADgADO53sHPgOAAM7newdBA4AAzud7B0IDgADO53sHRAOAAM7newdkA4AAAABgAGkDgAAAAGAAagOAAEABcQZvA4AAAAFoAnwDgADERSIAgAOAAM7neweEA4AAQANiAIYDgACG53kH7gOBAM733wX3A4EAzvffBaUAgQDMp1IEpgCBAMgCAgCoAIEAzvdfAc0AgQDO51sFzwCBAMyjSwXYAIEAxpMXBfcAgQDO998F/QCBAM733wU5AYEAzvffBVsBgQDO998FXAGBAM733wVdAYEAzvffBWgBgQCCdN8FswGBAM733wXMAYEAzvffBc0BgQDO998F7wGBAM733wUSAoEAzvffBTUCgQDO998FNwKBAM733wVAAoEAzvffBUkCgQDO998FcAKBAM732wGYAoEAzvffBZ8CgQDCd98F9wKBAM733wUXA4EAzrffBRwDgQCCcUQBNwOBAM733wUbBA0AAQAAACAEDQABAAAATQQNAAEAAABaBA0AAQAAAFsEDQAC3X8BeQANAPrjxQOMAA0ASAICApEADQABAAAAlAANAAEAAACYAA0AAQAAAJkADQABAAAAtgANAIAAAAC7AA0Azv//A70ADQABAAAAxgANAHYTegbIAA0AgAAAANEADQABAAAAAwENAPp2vwcjAQ0AAQAAACkBDQABAAAAQQENAMr7fwdfAQ0AAQAAAJMBDQABAAAAvgENADLwjAPAAQ0AAQAAAMEBDQABAAAABwINAAEAAAArAg0AAQAAAF0CDQABAAAAQgANAAEAAACbAg0AAQAAAJ4CDQABAAAArQINAAEAAADbAg0AMIBAA98CDQABAAAA4QINAAEAAADiAg0AAQAAAPYCDQABAAAAAQMNAIb9/gUnAw0A/uf3B1EADQABAAAALwMNAAEAAAAxAw0AAQAAADMDDQABAAAAUgANAAEAAAA4Aw0AAQAAAD0DDQABAAAAQQMNAAEAAABaAw0AAAFiBK4DDQABAAAAYwANAMi/dQUGBIIAzl/7ATkEggCOxXECPQSCAM7f/wM+BIIABFXZAZkAggDO3/8DpACCAM7X/wO2AIIAgAAAAL4AggDO3/8DyACCAIAAAADsAIIAzt//AycBggDO3/8DWwGCAM7f/wNdAYIAzt//A14BggDO3/8DXwGCAM7f/wNtAYIAjt3eA34BggDO33sD+gGCAM7f/wMzAoIASEOeAU0CggDO3/8DXAKCAM7f/wO5AoIAzt//A9sCggAAgEAD4AKCAM7f/wP7AoIAzt//AyQDggAAAFEAJgOCAMRdcwIvA4IAzt//AzADggDO3/8DMQOCAM7f/wMyA4IAzt//AzMDggDO3/8DNQOCAM7f9wOaA4IATJlrAhEEgwDO/38HmwSDAM7/fweUAIMAzv9/B5UAgwDO/38HlwCDAM7/fwelAIMAzKdyBqgAgwDO/38DIQGDAM7/fwcpAYMAzv9/Bz4BgwDO/F8HqwGDAM7/fwexAYMAzv9/B0oCgwDO/38HngKDAM7/fweqAoMAzv9/B6sCgwDO/38HAQODAIb9fgUFA4MAzv9/Bx4DgwDO/38HJgODAMRdcwYnA4MAzud3BzADgwDO/38HMgODAM7/fwczA4MAzv9/BzgDgwDO/38HOgODAM7/fwetA4MAzv9/B8YDgwDO/38H9wOEAM7//wVMBIQAzv//BYUAhABO//sFkACEAM7//wWVAIQAzv//BZcAhADO//8FmACEAM7//wWZAIQAzv//BaUAhADMp3IEqwCEAM7//wW7AIQAzv//Ab4AhADO//8FBAGEAM7//gUQAYQAzvr/AREBhADO//8FFAGEAM6fbwUmAYQAzv//BVoBhADO//8FWwGEAM7//wVcAYQAzv//BV0BhADO//8FXgGEAM7//wVoAYQAgnzfBZMBhADO//8FqwGEAM7//wXLAYQAzv//BdkBhADO//8F+gGEAM7//wUwAoQAzv//BTEChADO//8FSAKEAM7//wWRAoQAzv/7BeoChADO//8F6wKEAM7//wXsAoQAzv//Be0ChADO//8F7gKEAM7//wX0AoQAzv//BRoDhADO//8FAwSFAE7/+wcyBIUAAAMAAEwEhQBO//sHTQSFAE7/+wdPBIUATv/7B1oEhQBO//sHkASFAEy/+webBIUATv/7B4YAhQBO9/sHlACFAE7/+weVAIUATv/7B5cAhQBO//sHmQCFAE7/+wekAIUATvf7B6gAhQBO/3sDrACFAEiCAAO4AIUASnJaAb8AhQBO//sHwgCFAE7/+wfDAIUASn97B8QAhQBO//sHxQCFAE7/+wfGAIUARhN6BhwBhQBIJqMGJQGFAE7/+wdFAYUATr/7B10BhQBO//sHXgGFAE7/+wdoAYUAAnzbBW8BhQAC31ADfgGFAE7/ewOkAYUASAcAALMBhQBO//sHuQGFAE7/+wfZAYUATv/7B/4BhQBO//sHDQKFAE7/+wcxAoUATv/7B0gChQBO//sHSQKFAE7/+wdXAoUATv/7B14ChQBO//sHwAKFAE7eWwfYAoUATv/7B9sChQAAgEAD3wKFAE7/+wfgAoUATv/7B+EChQBO//sH9QKFAE7/+wctA4UATo/zATEDhQBO//sHMgOFAE7/+wczA4UATv/7BzYDhQBIAmMANwOFAE7/+wc4A4UATv/7BzoDhQBO//sHQQOFAE7/+wdCA4UATv/7B0QDhQBO//sHRQOFAE7/+wdIA4UADn35B5EDhQBO//sHtAOFAE7/+wfOA4UATv/7B/4DhgDO9/8HWQSGAM73/wdbBIYAAtV/AZQAhgDO9/8HlwCGAM73/we2AIYAgAAAAMAAhgDO9/8H+ACGAM73/wchAYYA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HQOTAAEAAACCA5MAAQAAALEDkwABAAAAzgOTAAEAAAADBJQAAQAAAAQElAABAAAABwSUAAEAAAARBJQAAQAAABYElAABAAAAGgSUAAEAAAAdBJQAAQAAACUElADO//sHLASUAM7/fwc+BJQABHXZAVIElAABAAAAWgSUAAEAAABbBJQAAt1/AVwElACCzX8DXQSUAMyvygeNBJQAAQAAAJsElAABAAAAlQCUAAEAAACXAJQAAQAAAJgAlAABAAAAmQCUAAEAAACgAJQAgvnZA6QAlADO9/8HpQCUAMyncgaqAJQAzuv+A6wAlABIggQDvwCUAAEAAADEAJQAAQAAAMUAlAABAAAAxgCUAEYTegbIAJQAgAAAAMwAlADM//8HzwCUAMyjSwXiAJQAzptnB/sAlAABAAAA/ACUAMyuiwQIAZQAAQAAAAkBlAABAAAACgGUAAEAAAASAZQAzvvrBxQBlADOn28HGQGUAM73/wUnAZQAAQAAACgBlAABAAAANQGUAAEAAAA2AZQAAQAAADkBlAABAAAAPAGUAAEAAAA/AZQAxKtjBkMBlADO59sFRQGUAM6//wdGAZQAzP76A0cBlAABAAAASAGUAM5uHwZSAZQAyuf+B1oBlAABAAAAXAGUAAEAAABeAZQAAQAAAF8BlAABAAAAaAGUAIJ83wVvAZQAgt9UA4EBlADOr98FogGUAAEAAACrAZQAAQAAAKwBlAABAAAArQGUAAEAAACxAZQAAQAAALMBlAABAAAAywGUAAEAAADdAZQAAQAAAOkBlAABAAAA7gGUAAEAAADzAZQAAQAAAPUBlAABAAAA+gGUAAEAAAD9AZQAAQAAAAoClAABAAAACwKUAAEAAAAPApQAAQAAABcClAABAAAAIAKUAAEAAAAtApQAAQAAAC4ClAABAAAAMQKUAAEAAAA8ApQAAQAAAEAClAABAAAASAKUAAEAAABKApQAAQAAAFIClAABAAAAVgKUAAEAAABXApQAAQAAAFkClAABAAAAWgKUAAEAAABbApQAAQAAAFwClAABAAAAkQKUAM7/+weeApQAAQAAAK4ClABO/voHrwKUAAEAAACyApQAAQAAALQClAABAAAAuwKUAEiOaQa9ApQAAQAAAMoClADM/38H2wKUAACAQAPeApQAAQAAAN8ClAABAAAA4AKUAAEAAADkApQA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JwGgALL52QMoAaAAsvnZAykBoACy+dkDQAGgALL52QNHAaAAgvnZA0gBoACCaBkCWgGgALL52QNbAaAAsvnZA1wBoACy+dkDXgGgALL52QNvAaAAgtlQA5oBoACy+dkDogGgALL52QOrAaAAsvnZA7sBoACy+dkDvgGgADLwiAPGAaAAsvnZA8sBoACy+dkD0AGgALL52QPRAaAAsvnZA9kBoACy+dkD3AGgALL52QPhAaAAsvnZA+IBoACy+dkD5gGgALL52QPnAaAAsvnZA+gBoACy+dkD8wGgALL52QP0AaAAsvnZA/UBoACy+dkD9gGgALL52QP6AaAAsvnZAw8CoACy+dkDEAKgALL52QMhAqAAsvnZAy0CoACy+dkDLgKgALL52QMvAqAAsvnZAzACoACy+dkDMQKgALL52QM8AqAAsvnZA0ACoACy+dkDSgKgALL52QNWAqAAsvnZA1gCoACy+dkDWQKgALL52QOKAqAAsvnZA5ECoACy+dkDmwKgALL52QOqAqAAsvnZA60CoACy+dkDrgKgADL42AO0AqAAsvnZA90CoACy+dkD3gKgALL52QPfAqAAsvnZA+ACoACy+dkD4gKgALL52QPkAqAAsvnZA+UCoACy+dkD5gKgALL52QPnAqAAsvnZA+gCoACy+dkD6QKgALL52QPqAqAAsvnZA+sCoACy+dkD7AKgALL52QP0AqAAsvnZA/YCoACy+dkD9wKgALL52QMaA6AAsvnZAx0DoACy+dkDHwOgALL52QMmA6AAsFlRAicDoACy4dEDKAOgALL42AMqA6AAsLlRAz0DoACy+dkDPgOgALL52QNAA6AAsvnZA0EDoACy+dkDQwOgALL52QNEA6AAsvnZA0UDoACy+dkDZQOgALL52AORA6AAsvnZA6ADoACy+dkDoQOgALL52QOmA6AAsvnZA6cDoACy+dkDqAOgALL52QOtA6AAsvnZA7ADoACy+dkDswOgALL52QO8A6AAsvnZA70DoACy+dkDvgOgADL52APLA6AAsvnZA9sDoACy+dkDWQShAPqSYwZaBKEA+pJjBpwEoQD6kmMG8AChAPqSYwYHAaEA+pJjBl0BoQD6kmMGMwKhAHgCAgBEA6EA+pJjBiEEogC4xz4EWQSiALjHPgS3AKIAsEQsAMQAogC4xz4E7QCiALjHPgT7AKIAuMc+BD8BogCwgyIEWAKiALjHPgSSAqIAuMc+BN0CogC4xz4E5gKiALjHPgToAqIAuMc+BPQCogC4xz4ERAOiALjHPgSPA6IAuMc+BKQDogC4xz4EFQSjAPp23wFqBKMAyCICAPsAowD6dt8BPQGjAPp23wFYAaMA+lJDAYABowDIAloB/QGjAPp23wFMAqMA+nbfAVICowD6dt8BfgKjAPp23wGiAqMAsmDTAbUCowD6dt8B9QKjAPp23wH2AqMA+nbfAREEpAABAAAAUgSkAAEAAABZBKQAAQAAAG0EpAA6AxMGfQSkAAEAAACYBKQAAQAAAKUApADMp3IGqACkAM73fwOqAKQA/uP+A74ApAABAAAAvwCkAAEAAADFAKQAAQAAAMYApAB2E3oG0QCkAAEAAAANAaQA/vH/AxMBpADMh1oCXwGkAAEAAABkAaQA/vf7BYoBpAABAAAAmgGkAAEAAACzAaQAAQAAAL8BpAABAAAA4gGkAAEAAAAUAqQAAQAAADUCpAABAAAAQwKkAAEAAABjAqQAAQAAALUCpAABAAAAxAKkAAAAYADKAqQA/Pd/B98CpAABAAAA9AKkAAEAAAD1AqQAAQAAAPkCpAABAAAABQOkAAEAAAANA6QAAQAAAB4DpAABAAAAHwOkAAEAAAAiA6QAzhNnASgDpACy9NwHKQOkALihdwIvA6QAAQAAADADpAABAAAAMQOkAAEAAAAyA6QAAQAAADcDpAABAAAATAOkAPz3ewfPA6QAAQAAAP4DpQDMp3IGAQSlAASBIAQRBKUAzKdyBk0EpQDMp3IGUgSlAMyncgZ+BKUAzKdyBqcApQDMpzIGqAClAMyncgKpAKUAyAYCAr4ApQDMp3IGvwClAMyncgbFAKUAzKdyBsYApQBEA3IGygClAMwiAgblAKUAzKdyBvgApQDMp3IG+QClAMyncgb7AKUAzKdyBv0ApQDMp3IGDwGlAEgGYgISAaUAzKNiBhQBpQDMh2IGFQGlAMSncgYcAaUASCYiBiUBpQDMp3IGJgGlAMyncgYoAaUAzKdyBloBpQDMp3IGWwGlAMyncgZcAaUAzKdyBl4BpQDMp3IGYQGlAMimUgJkAaUAzKdyBJMBpQDMp3IGmgGlAMyncgaiAaUAzKdyBrMBpQDMp3IGuwGlAMyncga/AaUAzKdyBssBpQDMp3IG0AGlAMyncgbRAaUAzKdyBtwBpQDMp3IG6QGlAMyncgbzAaUAzKdyBvQBpQDMp3IG/QGlAMyncgY4AqUAzKdyBkECpQDMp3IGWQKlAMyncgaQAqUAzKdyBrACpQDMp3IG4QKlAMyncgboAqUAzKdyBukCpQDMp3IG6gKlAMyncgbrAqUAzKdyBu0CpQDMp3IG9AKlAMyncgb1AqUAzKdyBvkCpQDMp3IG+gKlAMyncgYZA6UAzKdyBhoDpQDMp3IGGwOlAMyncgYcA6UAgCFgAB0DpQDMp3IGJQOlAMwjcgYmA6UAxAVyBikDpQCIoXICLgOlAMiHcgYvA6UAzKdyBjIDpQDMp3IGQgOlAMyncgaAA6UAzKdyBqcDpQDMp3IGqAOlAMyncgatA6UAzKdyBrwDpQDMp3IGwgOlAMyncgaoAKYAyAICAM0ApgDIAgIA6QCmAMgCAgD3AKYAyAICAP0ApgDIAgIAagGmAMgCAgDMAaYAyAICAOsBpgDIAgIASQKmAMgCAgBwAqYAyAICAJgCpgDIAgIA1AKmAMAAAAD3AqYAyAICAAEDpgCAAAIANwOmAMgCAgC0A6YAyAICALYApwCAAAAAyACnAIAAAAAPAacAeB6iAk8BpwD+/7oHVQGnAPrRmAdWAacA/v+6B10BpwD+/7oHXwGnAP7/ugdkAacA/v+6BRcCpwD+/7oHMAKnAP7/ugfbAqcAMIAAA/oCpwDO97oHdQOnAAABIACAA6cA/v+6B+cDpwD+/7oHGwSoAM7/fwMeBKgAzv9/A0EEqAAABXUAjASoAM7/fwOqAKgAzut+A7gAqADKcloBvwCoAM7/fwPSAKgATIICAAgBqADO/38DCQGoAM7/fwNUAagAzvtLA78BqADO/38DzQGoAM7/fwMFAqgAzv9/AyMCqADO/38DXgKoAM7/fwPbAqgAAIBAA/ICqADOmWsD8wKoAMi6NAL2AqgAzv9/A/cCqADO/38DAAOoAM7/fwMKA6gAzv9/AxcDqADOv38DHAOoAIJxZAEdA6gAzv97Ax8DqADO/38DLwOoAM7/fwNBA6gAzv9/A0IDqADO/38DRAOoAM7/fwODA6gAAAFiAK0DqADO/38DwQOoAM7/fwPgA6gAzv9/AxsEqQDIBgoCqgCpAMgCCgKsAKkASAIAAr0AqQDIBgoCvgCpAMgGCgK/AKkAyAYKAsAAqQDIBgoCygCpAMgCCgLMAKkAyAYKAtIAqQBIAgIA2ACpAMACAgLzAKkAyAYKAvYAqQDIBgoC+ACpAMgGCgL9AKkAyAYKAv4AqQDIBgIC/wCpAMgGCgIEAakAyAYKAhgBqQDIBgoCPgGpAMgECgJAAakAyAYKAkUBqQDIBgoCZAGpAMgGCgB+AakAyAYKAu0BqQDIBgoCJgKpAMgGCgLUAqkAwAQIAtkCqQAAAAAC2wKpAAAAAALvAqkAyAYKAvQCqQDIBgoCGwOpAMgGCgIfA6kAyAYKAiIDqQDIAgIAMwOpAMgGCgJ5A6kAAAAAAq8DqQDIBgoC1wOpAMgCCAKIABEA+ANiAJ8AEQD+//gFvwARAAEAAABGAREAzP76A9kCEQAwAUAD6AOqAP7r/gP3A6oA/uv+AfsDqgB+6/oDEQSqAP7r/gMZBKoA/uv+AxsEqgD+6/4DkASqAPyr/gO2AKoAgAAAAL0AqgD+6/4DvwCqAP7r/gPAAKoA/uv+A8MAqgD6a3oDxgCqAHYDegLKAKoAzCIKAssAqgDOYsoBzQCqAM7jegPSAKoATIICAOEAqgDOSzYA5QCqAP7r/gP0AKoA/uv+A/cAqgD+6/4D+gCqAP7r/gP+AKoA/mv2AwMBqgD6Yr4DBAGqAP7r/gMGAaoA9Or4AwkBqgD+6/4DDwGqAHgK5gIUAaoAzotuAxwBqgB4IqICIwGqAP7r/gMlAaoA/uv+AyYBqgD+6/4DJwGqAP7r/gMqAaoA/uv+A0ABqgD+6/4DRQGqAM6r/gNGAaoAzOr6A0cBqgDO6/4DSwGqAHzj6gNPAaoA/uv+A1QBqgD+68oDWQGqAP6DPgNaAaoA/uv+A14BqgD+6/4DXwGqAP7r/gNiAaoAyAMAAGQBqgD+6/oBjgGqAP7r/gOaAaoA/uv+A6QBqgBIAwAAsQGqAP7r/gOzAaoA/uv+A7sBqgD+6/4DvgGqADLgjAPBAaoA/uv+A8wBqgD+6/4D2QGqAP7r/gPuAaoA/uv+A/MBqgD+6/4DAwKqAP7r/gMEAqoA/uv+AxsCqgD+6/4DJgKqAPyqvgM1AqoA/uv+AzcCqgD+6/4DQwKqAP7r/gNKAqoA/uv+A00CqgD+6/4DWwKqAP7r/gNeAqoA/uv+A2MCqgD+6/4DawKqAM6regNwAqoA/uv6AZcCqgD+6/4D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qwNJAPb99wOzA0kA9v33A7wDSQD2/fcDvgNJADb59AO/A0kA9v33A8IDSQD2/fcDxQNJAIb99wPIA0kA9v33A8kDSQD2/fcDYQBJAPb99wPKA0kA9v33A2IASQCG/fUD2wNJAPb99wPmA0kAxv3VA/kD2gL4q3wFGwTaAvyrfgVKBNoC9Kt+BUwE2gL8q34FUwTaArChfAUcA9oCgCFkASgD2gKwqFwFMAPaAvyrfgUzA9oC/Kt+BY4D2gL8q34F5wPaAvyrfgX0A9sCMIBAA/kD2wIwgEAD+wPbAjCAQAP+A9sCMIBAAwEE2wIAgAAABATbAjCAQAMRBNsCMIBAAxoE2wIwgEADGwTbAjCAQAMcBNsCMIBAAx4E2wIwgEADIQTbAjCAQAE3BNsCMIBAA0oE2wIwgEADTATbAjCAQANNBNsCMIBAA04E2wIwgEADTwTbAjCAQANRBNsCMIBAA1ME2wIwgEADVQTbAjCAQANZBNsCMIBAA1oE2wIwgEADWwTbAgCAQAFcBNsCMIBAA2cE2wIwgEADewTbAjCAQAOQBNsCMIBAA5IE2wIwgEAD3QLbAjCAQAPkAtsCMIBAA+YC2wIwgEAD5wLbAjCAQAPoAtsCMIBAA+kC2wIwgEAD6gLbAjCAQAPrAtsCMIBAA+wC2wIwgEAD7gLbAjCAQAPvAtsCAIBAA/IC2wIwgEAD9ALbAjCAQAP2AtsCMIBAA/cC2wIwgEADEQPbAgCAAAMaA9sCMIBAAx8D2wIwgEADIgPbAgAAQAEnA9sCMIBAAygD2wIwgEADMQPbAjCAQAMzA9sCMIBAAzcD2wIwgEADPQPbAjCAQAM+A9sCMIBAA0AD2wIwgEADQQPbAjCAQANDA9sCMIBAA0QD2wIwgEADWgPbAgAAQABlA9sCMIBAA2sD2wIwAEACbQPbAjCAQABxA9sCMABAAHID2wIwAEACdgPbAjCAQAKAA9sCMIBAA4ID2wIwgEADhAPbAgAAQACFA9sCMIBAA44D2wIwgEADlAPbAjCAQAOhA9sCMIBAA6QD2wIwgEADpQPbAjCAQAO0A9sCMIBAA7wD2wIwgEADvQPbAjCAQAO+A9sCMIBAA8oD2wIwgEADywPbAjCAQAPYA9sCMIBAA9sD2wIwgEAD5wPbAjCAQAMbBNwCAQAAAG4E3AIAACAClATcAoAEYAAlA9wC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2gPUAwABYADaA9YDAQAAANwD1gMCUWAAPATYAwEAAADnA9gDAQAAAP8D2QPO/38D3APaAwJRYAADBNsDAQAAAAQE2wMBAAAAVwTbAwEAAADoA90DzANnB/UD3QPEA2cHBATdA8wDZwf5A2MAyL91BfoDYwBIP3UFAgRjAMi/dQUDBGMAyL91BRYEYwDIv3UFaQBjAMi/dQUaBGMAyL91BR4EYwDIv3UFQQRjAAAFdQREBGMAQAVgBEwEYwDIv3UFTgRjAMi/dQVRBGMAyL91BVUEYwDIv3UFWwRjAACddQFcBGMAgI11AXsEYwDIv3UFhwRjAAA4dQWMBGMAyL91BY0EYwDIv3UFkQRjAMi/dQWTBGMAyL91BX0AYwDIs2AFoABjAIC5UQGoAGMAyL91AcQAYwDIv3UF+QBjAMi/dQX9AGMAyL91BQABYwDIvnQFAgFjAMi/cQEEAWMAyL90BQkBYwDIv3UFCwFjAMixdQQVAWMAwL91BRcBYwDIv3UFIAFjAMi3UQUmAWMAyL91BScBYwDIv3UFKAFjAMi/dQU6AWMAyL91BT4BYwDIvFUFRgFjAMi+cAFMAWMAyL91BVIBYwDIp3QFWgFjAMi/dQVdAWMAyL91BWEBYwDIvlEBmgFjAMi/dQWeAWMAyL91BasBYwDIv3UFsQFjAMi/dQWzAWMAyL91BbsBYwDIv3UFvgFjAACwBAHLAWMAyL91BdMBYwDIv3UF2QFjAMi/dQXiAWMAyL91BekBYwDIv3UF6wFjAMi/dQXuAWMAyL91BfIBYwDIv3UF8wFjAMi/dQX0AWMAyL91BfUBYwDIv3UF9gFjAMi/dQX6AWMAyL91BQICYwDIv3UFDwJjAMi/dQURAmMAyL91BRICYwDIv3UFGAJjAMi/dQUfAmMAyL91BSACYwDIv3UFLAJjAMi/dQUtAmMAyL91BS8CYwDIv3UFNAJjAMi/dQU2AmMAyL91BUACYwDIv3UFSgJjAMi/dQVLAmMAyL91BVMCYwDIv3UFWQJjAMi/dQVaAmMAyL91BVsCYwDIv3UFXAJjAMi/dQVpAmMAyL91BYACYwDIv3UFigJjAMi/dQWTAmMAyL91BZcCYwDIv3UFnAJjAMi/dQWqAmMAyL91BawCYwDIv3UFsAJjAMi/dQW0AmMAyL91Bb0CYwDIv3UF2wJjAACAQAHdAmMAyL91Bd4CYwDIv3UF3wJjAMi/dQXgAmMAyL91BeECYwDIv3UF4gJjAMi/dQXkAmMAyL91BecCYwDIv3UF6QJjAMi/dQXqAmMAyL91BesCYwDIv3UF7wJjAMi/dQX3AmMAyL91BQIDYwDIv3UFDANjAMi/dQUNA2MAyL91BR0DYwDIv3EFJANjAAAAUQAmA2MAwB1xBCcDYwDIp3UFKANjAIC8VAUpA2MAiKF1AC8DYwDIv3UFMANjAMi/dQUxA2MAyL91BToDYwDIv3UFPgNjAMi/dQU/A2MAyL11BUADYwDIv3UFQwNjAMi/dQVyA2MAQAFwAKYDYwDIv3UFqANjAMi/dQWwA2MAyL91BbQDYwDIv3UFvgNjAAi5dAXJA2MAyL91BeAD3wPyc68H4wPfA/JzqgckBOADAQAAAOsD4QPEX34FEgThAwEAAAAVBOEDAQAAACME4QMBAAAA7APiA/zLPwQlBOIDAQAAAOsD4wPEX3oF7wPjAwABYADwA+MD+hU6BgYE4wP+f/oBEgTjAwEAAAAjBOMDAQAAAOQD4wMBAAAA7wPkAwABYADwA+QD+hU7BgYE5AP+f/sBIwTkAwEAAADsA+UD/Ms/BIoE5QMwRHoH","extra":"MgELAyoAYQNUAysAYANUAysAYANhAysAbANUAysAbANgAysAaQNUAysAaQNgAysAaQNsAysAYwNhAwsAYwNsAyYAKwNoAwEAZANUAysAZANhAysAZANgAysAZANsAysAZANpAysASwPSAgAArAAoAxEAawNUAysAawNhAysAawNgAysAawNpAysAawNjAyYAawNjAwsAawNkAysATwMyAQAATwNLAwAATwNLAxgATwNLAxEAUANLAxEAUANPAxEASgNLAxgASgNPAxgAyQJUAysAyQJhAysAyQLSAgAAyQJsAysAyQJLAwAA1gJUAxYA1gIyAQAA1gIyAQEA1gJgAwEA1gJPAwAA1gLJAgAAWwNUAxYAWwNUAysAWwNhAysAWwNgAysAWwNsAysAWwNpAysAWwNkAysAWwNrAysAWwNKAyoAWwPWAhYAWwPWAhcAUwNpAysAUwNkAysAUwNbAysAZQNhAysAZQNpAysAZQNLAxgAZQNLAxEAZQNPAyUAZQNPAxgAZQNKAyUAZQNKAxgAZQNKAxEAZQPJAgsAZQPWAhYAZQPWAhcAZQNbAxYAZQNbAxcAZQNbAysAZQNTAxcAZQNTAysAfgIoAxYADAMRAxEA+wJPAxgA+wJKAyUA+wJKAxgA+wJKAxEA+wLWAhYA+wJlAxYA+wJlAxgA4wIoAxYAFgMoAxgAFgMGASsA6ALjAiUAEANoAwEAEAPWAgEATgMKAxgATgMKAxEAcANUAysAcANgAysAcANpAysAcANkAysAcANbAxYAcANbAxcAcANbAysAcANlAxcAXANUAxYAXAPWAhYAXAPWAhcAXANbAxYAXANbAxcAXANTAxYAXANTAxcAXANlAxYAXANlAxcAXANwAxYAXANwAxcAZwNUAysAZwNhAysAZwNoAwEAZwNgAysAZwNsAysAZwNpAysAZwNkAysAZwNrAysAZwPJAisAZwPWAgEAZwNbAysAZwNTAysAZwNlAysAZwMQAwEAZwNwAysAfwNUAxYAfwNLAxgAfwNPAxgAfwNKAyUAfwNKAxgAfwNKAxEAfwPWAhYAfwPWAhcAfwNbAxYAfwNbAxcAfwNTAxYAfwNTAxcAfwNlAxYAfwNlAxcAfwNlAyUAfwNlAxgAfwNlAxEAfwP7AhgAfwP7AhEAfwNwAxcAfwNcAxYAfwNcAxcAcwNUAysAcwNhAysAcwNgAysAcwPSAgAAcwNsAysAcwNpAysAcwNkAysAcwNrAysAcwNbAysAcwNwAysAcwNnAysAAANPAxgAAANKAyUAAANKAyoAAANKAxgAAANKAxEAAANbAyoAAANlAxgAAAN/AxgAAAN/AxEA2gJLAxgA2gJPAxgA2gJKAxgA2gJKAxEA2gJlAxgA2gL7AhgA2gL7AhEA2gJ/AxgA2gJ/AxEA2gIAAxgA2gIAAxEAjgOQAwAAjgPSAgAAjgNLAwAAjgNLAxgAjgNPAxgAjgNKAyUAjgNKAxgAjgNKAxEAjgPJAgAAjgPWAgEAjgNbAyoAjgNlAxgAjgPaAhgAjgPaAhEAgQOQAwAAgQMOAwAAgQPSAgAAgQNsAysAgQPWAgEAgQNbAxcAgQMQAwEAgQNcAxcAgQNzAysA/AJKAxEA/AJlAxgA/AL7AiUA/AL7AhEA/AJ/AxEA/AIAAyUA/AIAAxEA/ALaAhgA/ALaAhEA/AKOAyUAhwNKAyoAhwNKAxgAhwNKAxEAhwNbAxYAhwNbAxcAhwNbAyoAhwNlAxgAhwP7AhgAhwP7AhEAhwNcAxYAhwN/AxYAhwN/AxgAhwN/AxEAhwPaAhgAhwPaAhEAUQNUAxYAUQNUAxcAUQNUAysAUQNhAysAUQNoAwEAUQNpAysAUQNkAysAUQPWAhYAUQPWAgEAUQNbAxYAUQNbAysAUQNTAxcAUQNTAysAUQNlAxYAUQNlAysAUQNcAxYAUQNnAysAUQNnAwEAUQN/AxYAUQNzAysAHwMDAyYAHwMDAxgAHwP7AhYABAMGASoABAMAAxEABAMfAxgAUgNUAxcAUgNUAysAUgNhAysAUgNgAyYAUgNgAysAUgNsAysAUgNkAysAUgNkAwsAUgNrAysAUgNbAxYAUgNbAysAUgNwAyYAUgNwAysAUgNcAxYAUgNcAxcAUgNnAysAUgNzAysACAN+AiUACAN+AhEACAP7AisACAMeAxYABgMGASoABgPjAisABgMKAwsA9QBoAwEA9QBbAwEA9QBwAxcA9QCOAxYA9QBRAwEAPQNKAxgAPQN/AxgAPQN/AxEAPQPaAhgAPQP8AiUAPQOHAxgAPQOHAxEAfgNUAysAfgNhAysAfgNgAysAfgNsAysAfgNpAysAfgNkAysAfgNLAxgAfgNrAysAfgNPAxgAfgNKAyUAfgNKAyoAfgNKAxgAfgNKAxEAfgNbAysAfgNbAyoAfgNTAysAfgNlAysAfgNlAxgAfgNnAysAfgNzAysAfgPaAhgAfgPaAhEAfgP8AiUAfgNRAysAfgNSAysA/wL7AioA/wKHAyoADgILAxgADgIGASUADgLjAioADgLjAhEADgIAAxYADgL/AhYADgL/AiUApALSAgAApAJLAwAApALJAgAApAIKAyYApAKOAwAABwNlAyoABwP7AiUABwMAAyUABwOOAyUABwP8AiUA/QJQAxgA/QJKAyUA/QJKAxEA/QJlAyUA/QL7AiUA/QL7AhEA/QJ/AxEA/QIAAyUA/QIAAxEA/QKOAyUA/QKOAxEA/QL8AiUA/QIfAxYA/QIfAxgA/QI9AyUA/QJ+AyUA/QJ+AxEA/QIHAyUA/QIHAxgA/QIHAxEAGAMjAyYAGANLAwAAGANPAyUAGANKAyUAGANKAyoAGANKAxgAGANKAxEAGAPJAgAAGANbAyoAGANlAxgAGAP7AiUAGAP7AhgAGAP7AhEAGAPaAhgAGAPaAhEAGAOOAwAAGAP8AisAGAP8AiUAGAP8AhgAGAP8AhEAGAM9AxgAGAOkAgAAGAP9AiUAGAP9AhEAbQNgAysAbQNgAwEAbQPWAgEAbQNbAysAbQNTAysAbQNlAysAbQNfAxcAbQNwAxYAbQNcAwEAbQNSAysAGgMJAxYAGgMJAxgAGgMeAxYAGgPcAhgAkgNKAyUAkgNKAxgAkgNKAxEAkgNlAxgAkgN/AxgAkgN/AxEAkgPaAhgAkgPaAhEAkgP8AiUAkgP9AiUAkgNtAxYAWgIRAyoAWgIRAxEAWgIOAysAWgIMAxEAWgIGAxEAWgIUAwAARwNQAxgARwNKAxEARwNbAxYARwNlAxYARwP7AhEARwNcAxYARwMVAxYARwN/AyUARwN/AxEARwMAAxEARwOOAxEARwOHAxYARwOHAxEARwMfAxgARwN+AxEARwMHAxEARwP9AhgARwP9AhEARwMYAxEAEgNQAyoARQMyASsARQP7AiUARQMAAyUARQOOAyUARQPnAhYARQMIAysARQN+AyUARQOSAyUAWANUAxYAWANUAxcAWANKAxEAWAPWAhYAWAPWAhcAWANbAxYAWANbAxcAWANlAxYAWANlAxcAWAP7AiUAWANcAxYAWANcAxcAWAN/AxYAWAN/AxcAWAN/AxgAWAPaAhgAWAPaAhEAWAOBAxcAWAP8AhgAWAP8AhEAWAOHAxYAWAOHAxgAWAOHAxEAWANRAxYAWANRAxcAWAN+AyUAWAN+AxgAWAN+AxEAWAMYAyUAWAMYAxgAWAMYAxEAWAOSAyUAWAOSAxgAWAOSAxEA4gIoAysA4gLrAhgA4gLrAhEAXAHJAgAAXAF+AwsAXAEYAwAAAQNlAxYAAQNwAxYAAQN/AxYAAQMAAxYAAQOOAyYAAQOOAxYAAQOHAxYAAQP1ABYAAQM9AyUAAQOSAxYAAQNFAyUAAQNFAxEAXQEyARgAXQEIAysAXQEGAxgAXQEHAxcAcgNUAysAcgNgAyYAcgNgAysAcgNjAwsAcgNrAysAcgNbAysAcgNTAysAcgNlAysAcgNwAysAcgNnAysAcgNzAysAcgNRAyYAcgNRAysAcgN+AysAgwNUAxYAgwNUAxcAgwNUAysAgwNhAysAgwNgAysAgwNsAysAgwNpAysAgwNkAysAgwNrAysAgwPWAhYAgwNbAxYAgwNbAxcAgwNbAysAgwNTAxYAgwNTAxcAgwNTAysAgwNTAwEAgwNlAxYAgwNlAxcAgwNlAysAgwNwAxYAgwNwAxcAgwNwAysAgwNcAxYAgwNcAxcAgwNcAwEAgwNnAysAgwN/AxYAgwN/AxcAgwNzAysAgwNRAxYAgwNRAxcAgwNRAysAgwNSAxYAgwNSAxcAgwNSAysAgwN+AysAgwNtAysAgwNYAxYAgwNYAxcAgwMBAwEAgwNyAysAeQNbAxcAeQNTAxcAeQNlAxcAeQNwAxYAeQNwAxcAeQNcAxYAeQNcAxcAeQNcAwEAeQN/AxcAeQOOAxYAeQOBAxcAeQP1ABYAeQNtAxYAeQNtAxcAeQNYAxcAeQODAxYAeQODAxcAPgP7AhYAPgMIAysAPgM9AyUAPgMBAyUAPgMBAxgAPgMBAxEAZAFQAxgAZAFlAyUAZAEIAysAZAEHAxEAZAH9AiUAZAH9AhgAZAH9AhEAZAFHAxgAZAE+AysAGwMRAxEAGwMMAxYA7wJjAwAA7wJKAyoA7wJKAxEA7wJlAxgA7wJlAxEA7wJwAwAA7wJ/AxgA7wJ/AxEA7wIAAyoA7wKOAxgA7wKHAxgA7wKHAxEA7wJHAxEA7wISAyoA7wIbAxYA7wIbAwsASAMaAysA9QJwAwAA9QIAAyUA9QKHAwsA9QLcAhcA9QJ+AyUA9QJFAyUA9QIBAyUAgANUAxcAgANPAyUAgAPWAhcAgANbAxYAgANbAxcAgANTAxYAgANTAxcAgANlAxcAgANwAxYAgANcAxYAgANcAxcAgANcAwAAgAN/AxYAgAN/AxcAgAOHAxYAgAOHAyoAgANSAxYAgANSAxcAgANYAxYAgANYAxcAgANYAyUAgAODAxYAgAODAxcAgAN5AxYAgAN5AxcA5QIoAysA5QJFAxYAOwMyARgAOwNKAyoAOwMWAysAOwNOAyoAOwMAAyoAOwMHAxcAOwMYAyoAOwNdARgAOwPvAioAOwP1AhcAfANUAxYAfANUAxcAfAPWAhYAfANbAxYAfANTAxYAfANTAxcAfANlAxYAfANlAxcAfANwAxYAfANcAxYAfANcAxcAfANcAwAAfAN/AxYAfANRAxYAfANRAxcAfANSAxYAfANSAxcAfANtAxcAfANYAxYAfANYAxcAfAODAxYAfAODAxcAfAN5AxcAfAOAAxYAfAOAAxcAfAOAAysAfAOAAwAANQMoAxgANQMOAxgANQNcAQAANQP1AgAAiQMoAxYAiQNKAyUAiQNKAxEAiQNbAyoAiQN+AhYAiQMAAyUAiQMAAxEAiQOOAyUAiQP8AiUAiQP8AhEAiQOHAyoAiQN+AyUAiQP/AioAiQMHAyUAiQP9AiUAiQOSAyUAiQNHAyUAiQNHAyoAOgMsAxgASQMeAxYASQMeAxEAkQOQAwAAkQNPAyUAkQNKAyUAkQNKAyoAkQNKAxgAkQNKAxEAkQPJAgAAkQPWAgEAkQNbAyoAkQNlAyUAkQNlAxgAkQNOAyoAkQOOAwAAkQP8AiUAkQM9AyUAkQM9AxgAkQM9AxEAkQP9AiUAkQP9AhEAkQNFAyUAkQNcAQAAkQPvAioAkQPvAhgAkQPvAhEAkQM7AyoAkQOJAwsAkQOJAyUA3QLjAhgA3QLjAhEA3QIAAysA3QJFAxEA3QIBAyUA3QIBAxEAIgNUAxYAIgPWAhYAIgPWAhcAIgNbAxYAIgNbAxcAIgNlAxYAIgNlAxcAIgP7AiUAIgNcAxYAIgNcAxcAIgN/AxYAIgN/AxcAIgMAAxYAIgMAAyUAIgOOAyUAIgP8AiUAIgOHAxYAIgNRAxYAIgP/AisAIgMHAyUAIgMYAxYAIgMYAyUAIgNHAxYAIgNHAxcAIgNHAyUAIgNYAxYAIgMBAxYAIgODAxYAIgN8AxYAIgOJAyUAIgORAyUAGQNcAQAAGQNdASsAGQP1AgAAGQM1AwAAUQDoAhYAUQAAAxYAUQD/AhYAUQD/AhEAUQAOAhYAUQDiAiUAUQDiAhEAUQDdAisAdANUAxYAdANUAxcAdAPWAhYAdAPWAhcAdANbAxYAdANTAxYAdANTAxcAdANlAxYAdANlAxcAdANcAxYAdANcAxcAdANRAxYAdANRAxcAdANSAxYAdANSAxcAdANYAxYAdANYAxcAdAODAxYAdAODAxcAdAOAAxYAdAOAAxcAdAN8AxYAdAN8AxcAdAMiAxYATAMGASoATAPjAioATAPnAioALgNUAxcALgNPAyUALgNKAyUALgNKAwEALgPWAhcALgNTAxcALgNlAyUALgNSAxcALgN+AyUALgNYAxcALgNYAyUALgODAxcALgOAAxcALgOAAyUALgN8AxcALgN0AxYALgN0AxcAJQNUAxcAJQNUAysAJQNhAysAJQNgAysAJQNsAysAJQNpAysAJQNkAysAJQNLAxgAJQNLAxEAJQNrAysAJQNQAxEAJQPJAisAJQNbAxYAJQNbAxcAJQNbAysAJQNTAxcAJQNlAxYAJQNlAxcAJQNfAxcAJQNwAxYAJQNwAysAJQNcAxYAJQNcAxcAJQNnAysAJQNzAysAJQPaAhgAJQNRAxYAJQNRAxcAJQMYAxgAJQNtAxcAJQNHAxYAJQNYAxYAJQNYAxcAJQNYAxgAJQNyAysAJQODAxYAJQODAxcAJQODAysAJQN5AxcAJQOAAxYAJQOAAxcAJQN8AxYAJQN8AxcAJQMiAxYAJQN0AxYAJQN0AxcAJQMuAxcAVgNUAxcAVgNUAysAVgNhAysAVgNgAysAVgNsAysAVgNpAysAVgNrAysAVgPJAisAVgNbAxYAVgNbAxcAVgNbAysAVgNlAxYAVgNlAxcAVgNlAysAVgNwAxYAVgNwAysAVgNcAxYAVgNcAxcAVgNnAysAVgN/AxYAVgN/AxcAVgNzAysAVgOHAxYAVgN+AysAVgNtAysAVgNYAxYAVgNYAxcAVgNyAysAVgODAxYAVgODAxcAVgODAysAVgN5AxcAVgOAAxYAVgOAAxcAVgOAAwAAVgN8AxYAVgN8AxcAVgN8AwAAVgMiAxYAVgN0AxYAVgN0AxcAVgMuAxcAVgMlAxYAVgMlAxcAVgMlAysAVwNUAysAVwNgAyYAVwNgAysAVwNsAysAVwNrAysAVwNbAxcAVwNbAysAVwNlAxcAVwNlAysAVwNcAxYAVwNcAxcAVwNnAysAVwN/AxcAVwNzAysAVwN+AysAVwNtAxYAVwNtAxcAVwNtAysAVwODAxYAVwODAxcAVwODAysAVwN5AxYAVwN5AxcAVwOAAxYAVwOAAxcAVwN8AxYAVwN8AxcAVwN0AxcAZgNjAwAAZgPJAiUAZgPvAgAA0QJhAysA0QJhAwsA0QJpAysA0QJpAwsA0QJkAwsA0QJLAwAA0QLJAgAA0QLWAhYA0QLWAhcA0QJbAxYA0QJbAxcA0QJbAysA0QJTAysA0QJlAxYA0QJlAxcA0QJlAysA0QL7AhYA0QJwAxcA0QJcAxYA0QJcAxcA0QJnAysA0QJ/AxYA0QJ/AxcA0QJRAysA0QJSAysA0QJSAwsA0QJ+AysA0QKkAgAA0QIYAwAA0QJYAxYA0QJYAxcA0QJyAysA0QJyAwsA0QJ5AxcA0QIiAxYA0QIlAwsAQgM9AyYAQgPhAgsAYgNhAwsAYgNgAyYAYgNkAwsAYgNbAxcAYgNbAysAYgNlAysAYgNcAxcAYgOBAxcAYgNRAysAYgN+AysAYgNtAxcAYgNYAyYAYgNYAxcAYgN5AxcAYgMlAxcAYgMlAwsA+gJLAxgA+gJPAxgA+gJKAxgA+gJKAxEA+gLWAhcA+gJbAxcA+gJlAxYA+gJlAxcA+gJlAxgA+gL7AhgA+gL7AhEA+gJcAxcA+gJ/AxYA+gJ/AxcA+gJ/AxgA+gJ/AxEA+gLaAhgA+gLaAhEA+gKOAxgA+gKOAxEA+gKHAxcA+gKHAxgA+gKHAxEA+gIEAxEA+gI9AxgA+gI9AxEA+gL9AhYA+gL9AhEA+gIYAxgA+gIYAxEA+gKSAxgA+gJHAxEA+gJYAxgA+gIBAxYA+gJkAREA+gKRAxgA+gKRAxEA+gIiAxYA+gIiAxcA+gIlAxgA6QIbAxYAUwBUAysAUwBhAysAUwBhAwsAUwBgAyYAUwBgAysAUwBsAyYAUwBsAysAUwBjAwAAUwBrAysAUwBbAysAUwBTAysAUwBlAysAUwBwAysAUwBnAysAUwBzAysAUwBRAyYAUwBRAysAUwB+AysAUwBYAwsAUwCDAysAUwAlAysAUwAlAwsAUwBWAysAUwBmAwAAUwBiAyYAUwBiAysAUwBiAwsABAGQAwAABAEDAxEABAGBAwAABAEEAxgABAE9AyUABAEHAyUABAEHAxgABAFHAxgABAFFAyUABAGRAwAAXAJQAxgAXAJKAxEAXAL7AiUAXAL7AhEAXAJ/AxEAXAKOAyUAXAKOAyoAXAKOAxEAXAL8AiUAXAKHAxEAXAIfAxgAXAJ+AyUAXAJ+AxEAXAIOAhYAXAL9AiUAXAL9AhgAXAL9AhEAXALiAisAXAJkARgAXALvAioAXALvAhEAXAI7AyoAXAKJAyUAXAKRAyUAXAKRAyoAXAKRAxEAXAL6AhEAXAIEAQsA7gJ+AisA7gL7AhYA7gIfAxYA7gIIAysA7gIGAysA7gL/AhYA7gJFAysA7gI+AxYA7gI+AysA7gJkASsA5ALrAioA5AJFAxYA5ALiAgsA5ALdAisA5ALhAhYAWAALAxgAWAAyAREAWADSAgAAWABkAxgAWABLAwAAWADJAgAAWADWAgAAWADoAhYAWAAAAxYAWAD1AAAAWAAOAhYAWACkAgAAWAAYAwAAWABcAQAAWAAbAyUAWAA7AxgAWAA1AysAWADdAisAWABRABYAWABRACsAWADpAhYAWABcAhYAJgNQAxYAJgMZAyoARAMeAxYARAMIAxYARAMIAysARAMaAxYARANFAysARAMBAyUARAPuAhEAcQNUAxcAcQNTAxcAcQNlAxcAcQNcAxcAcQNRAxcAcQNSAxcAcQNYAxcAcQODAxcAcQOAAxcAcQN8AxcAcQN0AxcAcQMuAxcAcQMlAxcAcQNWAxcAcQNXAxcA/gIJAysA/gIJAxEA/gIeAysA/gIeAxEA/gL9AhYA/gIBAxEA/gLdAhEA/gIZAxEA/gLuAhYAagOQAwAAagNUAysAagNgAysAagNkAysAagNkAwsAagNrAysAagPJAgAAagNbAysAagNTAysAagNlAysAagNnAysAagNzAysAagOOAwAAagNRAysAagN+AysAagOkAgAAagODAysAagORAwAAagNWAysAagPRAisAagPRAgsAagPRAgAAmQBCAyUAjANUAxcAjAPJAgAAjANTAxcAjAOBAwAAjANSAxcAjANYAxcAjAODAxcAjAOAAxcAjAN8AxcAjAN0AxcAjAMuAxcAjAMlAxcAjANWAxcAjANXAxcAjAMEAQAAjANxAxcAggALAxgAggDWAhYAggDWAhcAggBbAxYAggBlAxYAggBlAxcAggD7AhYAggAVAxgAggAiAxYAggAiAxcAggDRAhYAggD6AhcA7ALbAhgA7AKsACsA7AKsACUA7AKsABEA7AJdARgAjwOQAwAAjwNoAwEAjwPJAgAAjwNbAyoAjwMQAwAAjwMQAwEAjwNnAwEAjwMAAxYAjwMAAyoAjwOOAwAAjwOOAxgAjwOBAwAAjwOHAyoAjwOHAxgAjwNRAwEAjwP1AAAAjwM9AxEAjwN+AyoAjwN+AxEAjwP/AioAjwMHAxgAjwMYAyoAjwPvAhgAjwP1AhEAjwORAwAAjwNRABYAjwMEAQAAjwNYAAAAjwOMAwAAeANgAysAeANpAysAeANbAxYAeANbAxcAeANbAysAeANTAxcAeANTAysAeANlAxYAeANlAxcAeANlAysAeANwAxYAeANwAxcAeANwAysAeANcAxYAeANcAxcAeANcAwEAeANnAysAeANRAysAeANSAxYAeANSAxcAeANSAysAeAN+AysAeANtAxcAeANYAxcAeAODAxYAeAODAxcAeAODAysAeAN5AxcAeAN5AwEAeAOAAxcAeAN8AxYAeAN8AxcAeAN0AxYAeAN0AxcAeAMlAxYAeAMlAxcAeANWAxYAeANWAxcAeANWAysAeANXAxcAeANXAysAeANXAwsAeAPRAisAeAPRAgsAeANiAysAeANTACsAeANTAAsAeANxAxcAeAOMAxcAVQNUAxcAVQNUAysAVQNgAyYAVQNgAysAVQNjAwsAVQNrAysAVQPWAhYAVQNbAxYAVQNbAysAVQNlAxYAVQNlAysAVQNwAyYAVQNwAxYAVQNwAysAVQNcAxYAVQNcAwEAVQNnAysAVQNzAysAVQN+AysAVQNtAysAVQODAxYAVQODAxcAVQODAysAVQOAAxYAVQN8AxYAVQN8AxcAVQMiAxYAVQN0AxYAVQN0AxcAVQNxAxcAVQOMAxcAPwNUAxcAPwNYAxcAPwP1AiUAPwOAAxcAPwOAAwAAPwN8AwAAPwN0AxcAPwMuAxcAPwNWAxcAPwNWAwAAPwNCAyUAPwNxAxcAPwOZACUAPwOMAxcAHQMJAxgAHQMaAxgAHQPhAisAMgP/AioAMgOSAyoAMgNFAxEAMgM+AyoAMgPdAhEAMgNRACUAMgPhAiYAMgPhAiUAMgNEAxYAMgM/AyUAiANbAyoAiANOAyoAiAMVAxYAiAMAAyoAiAOOAyoAiAOHAwsAiAOHAyoAiAOHAxgAiAOHAxEAiAN+AyoAiAMHAxEAiAMYAyoAiAMUAxYAiANHAxYAiANHAwsAiANHAxEAiAODAxcAiAPvAioAiAPvAhgAiAPvAhEAiAOJAyoAiAORAyoAiAORAxgAiAORAxEAiAMiAyoAiAMuAxcAiANWAxcAiANxAxcAiAOMAxcAiAOMAysAiANVAxYA+gEIAyUAfQNUAxcAfQNUAysAfQNhAysAfQNgAysAfQNpAysAfQNrAysAfQNbAysAfQNTAwEAfQNlAysAfQNfAxcAfQNwAysAfQNcAwEAfQNnAysAfQNzAysAfQOHAwAAfQNRAxcAfQNRAysAfQN+AysAfQN+AwEAfQNtAxcAfQNtAysAfQNYAyYAfQNYAxcAfQODAxcAfQODAysAfQODAwEAfQN5AxcAfQN8AxcAfQORAwAAfQN0AxcAfQMlAxcAfQMlAysAfQPRAisAfQNxAxcAfQOMAxcAfQN4AxcAfQN4AysADwNUAxYADwNUAxcADwNbAxYADwNbAxcADwNTAxcADwNwAxcADwNcAxYADwNcAxcADwN/AxYADwN/AxcADwOHAxYADwNRAxYADwNRAxcADwNSAxcADwMYAxYADwMYAysADwNHAxYADwNYAxYADwNYAxcADwODAxYADwODAxcADwN5AxcADwOAAxcADwN8AxYADwN8AxcADwMiAxYADwN0AxYADwN0AxcADwMuAxcADwMlAxYADwMlAxcADwNWAxYADwNWAxcADwNXAxcADwNiAxcADwP6AhYADwNxAxcADwOMAxcADwOMAysADwN4AxcADwNVAxYADwNVAxcADwOIAxYADwOIAxcADwOIAysADwN9AxcAjQMjAyUAjQNVAwEAzgIyAQAAzgJsAysAzgJjAwAAzgJLAwAAzgJLAxgAzgJPAwAAzgJKAyUAzgJKAyoAzgJKAxgAzgJKAxEAzgLJAisAzgLJAgAAzgLWAgAAzgJbAyoAzgJlAxgAzgLaAhgAzgLaAhEAzgKOAwAAzgL8AiUAzgI9AyUAzgI9AxgAzgI9AxEAzgKkAgAAzgIHAyUAzgL9AiUAzgL9AhEAzgIYAwAAzgJHAxEAzgJFAyUAzgJYAyUAzgJYAxgAzgJYAxEAzgJcAQAAzgKAAyUAzgKRAwAAzgIiAyUAzgIuAyUAzgIlAxgAzgJmAwAAzgLRAgAAzgJTAAAAzgJYAAAAzgJqAwAAzgKMAysAzgKPAyoAzgKIAysAzgKIAyoAzgIPAysAPAMjAyYAPANbAyUAPANbAyoAPANbAxEAPAN/AyoAPAN+AyoAPAPOAiYAhgNLAxgAhgNPAyUAhgNPAxgAhgNKAyUAhgNKAyoAhgNKAxgAhgNKAxEAhgNbAyoAhgNlAxgAhgP7AiUAhgP7AhgAhgP7AhEAhgPaAhgAhgPaAhEAhgP8AiUAhgP8AhgAhgM9AyUAhgM9AxgAhgM9AxEAhgP9AiUAhgNYAyUAhgNYAxgAhgNYAxEAhgP1AgsAhgOAAyUAhgOAAyoAhgMuAyUAhgMlAxgAhgP6AhgAhgP6AhEAhgNcAhEAhgOPAyoAhgM8AyYA6gIAAxYA6gLnAhYA6gLnAioA6gL/AhYA6gL/AhEA6gIOAhYA6gIUAxgA6gJMAxgA6gJcAhYA6gLuAhYA6gJYABYAAgP7AiUAAgMAAxYAAgMAAyUAAgOOAyUAAgP8AiUAAgP8AhgAAgP8AhEAAgM9AyUAAgN+AyUAAgOSAyUAAgNFAyUAAgM+AxgAAgOJAyUAAgOJAxgAAgOJAxEAAgMiAyUAAgMEARYAAgMEASUAAgNcAiUAAgPuAioAAgPOAiUAAgPqAhYA2QLsAisA2QLsAiUA2QLsAhgA2QLsAhEAggOQAwAAggNUAysAggNhAysAggNoAwEAggNgAysAggNsAysAggNpAysAggNkAysAggNLAxgAggNrAysAggNPAxgAggNKAyUAggNKAyoAggNKAxgAggNKAxEAggPJAgAAggNbAysAggNbAyoAggNTAysAggNlAysAggNlAxgAggP7AiUAggP7AhgAggP7AhEAggMQAwEAggNwAxYAggNwAxcAggNwAysAggNnAysAggN/AxgAggN/AxEAggNzAysAggPaAhgAggPaAhEAggOOAwAAggOBAxcAggOBAwAAggNRAysAggNRAwEAggNSAysAggP1ABcAggP1AAEAggNtAxYAggNtAysAggNFAyUAggNYAyUAggNYAxgAggNYAxEAggNyAysAggODAysAggN5AxYAggN5AxcAggOAAyUAggOAAyoAggORAwAAggMuAyUAggMlAysAggMlAxgAggNWAysAggNXAxYAggNXAxcAggNXAysAggPRAisAggNiAxcAggNiAysAggP6AhgAggNTACsAggMEAQAAggNYAAAAggNqAysAggOMAwAAggOPAwAAggOPAwEAggOPAyoAggOPAxEAggN4AysAggNVAysAggN9AysABQPnAioABQN+AwEABQNaAhEABQP1AisABQNRACUABQNCAxYABQPqAioA3gJCAyUA3gI/AyUA3gIyAyUA3gIFAyUAoAA7AxgAhQNLAxgAhQNKAyUAhQNKAxgAhQNKAxEAhQNbAxYAhQNlAxYAhQNlAxgAhQN/AxYAhQN/AxgAhQN/AxEAhQPaAhgAhQPaAhEAhQOHAxYAhQOHAxgAhQOHAxEAhQMIAysAhQP1ABYAhQMHAyUAhQP9AiUAhQMYAyUAhQMYAxgAhQMYAxEAhQNFAysAhQNYAxYAhQNYAyUAhQNYAxgAhQNYAxEAhQMBAxYAhQNdASsAhQNkASsAhQORAyUAhQORAxgAhQORAxEAhQMiAxYAhQMiAyUAhQMZAysAhQMlAxgAhQNcAiUAhQNcAhEAhQNEAysAhQMPAxYAhQMCAyUAhQMCAxgAhQMCAxEAiwNPAxgAiwNKAyUAiwNKAyoAiwNKAxgAiwNKAxEAiwNbAyoAiwNlAxgAiwN/AxgAiwN/AxEAiwPaAhgAiwPaAhEAiwP8AiUAiwP8AhgAiwP8AhEAiwOHAyoAiwOHAxgAiwOHAxEAiwNRAwAAiwM9AyYAiwM9AxgAiwM9AxEAiwP9AiUAiwP9AhEAiwNHAxEAiwNYAyUAiwNYAxgAiwNYAxEAiwM7AyoAiwOJAyUAiwORAyUAiwORAyoAiwORAxgAiwORAxEAiwOPAyoAiwOIAwAAiwOIAyoAiwMCAyUAywHbAhgAywGsABEAywF+AhYAywEVAysAywHnAiUAywHnAhgAywHnAhEAywEGAxEAywFaAhEAywHlAiUAywHlAhEAywHkAhEAywHZAiUAywHZAhgADQMkAxEADQMjAxEADQMyAREADQMVAxgADQM+AyYADQNYABEADQOCABgADQMFAyUAOQMDAxgAOQMeAxYAOQMeAysAOQPrAhgAOQNEAxYAxgLSAgAAxgIrAwAAxgJLAwAAxgJPAwAAxgLJAgAAxgLWAgAAxgKkAgAAxgIYAwAAxgJcAQAAxgLRAgAAxgJYAAAAxgJqAwAAxgLOAgAAewNUAxYAewNUAxcAewNbAxYAewNTAxYAewNTAxcAewNlAxYAewNlAxcAewNOAysAewNwAxYAewNcAxYAewNcAxcAewNcAwEAewN/AxYAewNRAxYAewNRAxcAewNSAxYAewNSAxcAewN+AwEAewNtAwEAewNYAxYAewNYAxcAewODAxYAewODAxcAewODAwEAewOAAxYAewOAAxcAewOAAwAAewN8AyYAewN8AxYAewN8AxcAewN8AwAAewMiAxYAewN0AxYAewN0AxcAewMuAxcAewMlAxYAewMlAxcAewNWAxYAewNWAxcAewNWAwAAewNXAxcAewNxAxcAewOMAxcAewOPAysAewN4AxYAewN4AxcAewNVAxYAewNVAxcAewNVAwEAewM/AxcAewM/AwAAewOIAxYAewN9AxcAewN9AwEAewMPAxYAewMPAxcAewONAwEANAMIAysANANdASsANAOPAysANAMFAysANAN7AysATQNOAyoATQNOAxEATQMAAyoATQN+AyoATQNkASUATQM7AyoATQORAyoATQOPAxgATQPOAioATQOGAyoATQOCAyoATQOLAyoAWQNgAwEAWQNbAxYAWQNbAysAWQNTAwEAWQNlAxcAWQNfAxcAWQNwAxYAWQNcAxYAWQNcAxcAWQNcAwEAWQNRAxcAWQN+AwEAWQNtAwEAWQNYAyYAWQNYAxcAWQODAxYAWQODAxcAWQODAwEAWQN5AxYAWQN5AxcAWQOAAxYAWQOAAwAAWQN8AxYAWQN8AxcAWQN8AwAAWQN0AxcAWQMlAxYAWQMlAxcAWQNWAwAAWQNiAyYAWQNiAxcAWQNxAxcAWQOMAxcAWQN4AxYAWQN4AxcAWQM/AwAAWQN9AwEAWQMPAxcAWQOCAysAWQN7AxYAWQN7AxcAWQN7AwAAWQN7AwEAdgNUAysAdgNhAysAdgNhAwsAdgNgAysAdgPSAgAAdgNsAysAdgNpAxYAdgNpAysAdgNjAwsAdgNkAysAdgM2AwAAdgNbAysAdgNnAysAdgNzAysAdgOBAysAdgOBAwAAdgN+AysAdgNyAysAdgNyAwsAdgODAysAdgNWAysAdgPRAgsAdgNxAysAdgNqAysAdgOMAysAdgOMAwAAdgNVAysAdgNVAwsAdgOCAwEAvwD7AioAvwA9AyUAvwD/AioAvwBFAyUAvwBFAxgAvwABAyUAvwA+AyUAvwA+AxgAvwAyAyoAvwACAxgA1AJUAysA1AJhAysA1AJgAysA1AJsAysA1AJpAysA1AJkAysA1AJLAxgA1AJrAysA1AJPAxgA1AJKAyUA1AJKAyoA1AJKAxgA1AJKAxEA1ALJAgAA1AJbAxYA1AJbAxcA1AJbAysA1AJbAwEA1AJTAxcA1AJTAysA1AJTAwEA1AJlAxcA1AJlAxgA1AL7AiUA1AL7AhgA1AL7AhEA1AIQAwAA1AJwAxYA1AJwAxcA1AJwAysA1AJcAxYA1AJcAxcA1AJcAwEA1AJnAysA1AJ/AxgA1AJ/AxEA1AJzAysA1AIAAyUA1AIAAyoA1AIAAxgA1AIAAxEA1ALaAhgA1ALaAhEA1AKBAxcA1AL8AiUA1AL8AhgA1AJRAxcA1AJRAysA1AJSAxYA1AJSAxcA1AJSAysA1AI9AyUA1AI9AxgA1AI9AxEA1AL9AiUA1AJtAxcA1AJtAysA1AJtAwEA1AJcAQAA1AJyAysA1AKDAxYA1AKDAxcA1AKDAysA1AKDAwEA1AJ5AxcA1AJ5AwEA1AKAAxYA1AKAAxcA1AKAAyUA1AKAAwAA1AKAAyoA1AJ8AxYA1AJ8AxcA1AJ8AwAA1AKJAyUA1AKRAwAA1AIiAxYA1AIiAyUA1AJ0AxcA1AIuAyUA1AJWAxYA1AJWAxcA1AJWAysA1AJWAwAA1AJXAxYA1AJXAxcA1AJXAysA1AJiAxcA1AL6AhgA1AL6AhEA1AJTACsA1AJcAiUA1AJcAhEA1AJxAxcA1AJqAysA1AKMAxcA1AKPAwAA1AKPAwEA1AKPAyoA1AJ4AxYA1AJ4AxcA1AJ4AysA1AJ4AwEA1AJVAxYA1AJVAxcA1AJVAysA1AJVAwEA1AI/AwAA1AKIAxcA1AJ9AxcA1AJ9AysA1AJ9AwEA1AIPAxYA1AIPAxcA1AKNAwEA1ALOAgAA1AKCAwAA1AKFAyUA1AKFAxgA1AKFAxEA1AJ7AxYA1AJ7AxcA1AJ7AwAA1AJ7AwEA1AJNAyoA1AJZAxYA1AJZAxcA1AJZAysA1AJZAwAA1AJZAwEA1AJ2AysA8QKMAxgA9gL7AioA9gL/AioA9gJFAxcA9gJFAyUA9gIBAyUA9gIBAxEA9gLdAiUA9gJRACsA9gJEAyUA9gJEAxgA9gK/ACUA9gK/ACoA9AIKAxEA9AIVAwsA9AIIAxYA9AIHAxcA9AIHAxgA9AJkASUA9AL1AhcA9AL1AisA9AI7AxYA9AI7AxcA9AKRAwsA9AKRAyoA9AJCAxcA9AJcAioA9ALkAisA9AJEAxYA9AKIAyoA9AIFAysA9AJNAyUA9AJNAyoA9AJNAxEAIAMOAxgAIANdASYAIANdASoAigNUAxYAigNLAxgAigNPAxgAigNKAxgAigNKAxEAigPWAhYAigPWAhcAigNbAxYAigNbAxcAigNlAxYAigNlAxcAigNlAxgAigNlAxEAigP7AhYAigP7AhgAigP7AhEAigNOAyoAigNcAxYAigNcAxcAigNcAwAAigMAAxgAigMAAxEAigPaAhgAigPaAhEAigOOAxgAigOOAxEAigOHAxgAigOHAxEAigNRAxYAigNRAwAAigM9AxgAigM9AxEAigOSAxgAigOSAxEAigNYAxYAigNYAxcAigNYAyUAigNYAxgAigODAxYAigODAxcAigOAAxYAigOAAxcAigOAAyUAigN8AxYAigN8AwAAigOJAwsAigORAxgAigORAxEAigMiAxYAigMiAxcAigN0AxYAigN0AxcAigMuAxcAigMlAxgAigNXAxcAigPRAhYAigPRAhcAigOCABYAigNVAxYAigOIAwAAigMPAxYAigPOAhgAigPOAhEAigOCAxgAigOCAxEAigOFAxYAigOFAwsAigOFAxgAigOFAxEAigOLAwAAigN7AxYAigPUAhgAigPUAhEA3wILAyUA3wIGASUA3wLjAhgA3wLjAhEA3wIJAyoA3wIfAxYA3wL/AhYA3wI+AxYA3wLkAiUA3wJEAxEA3wL+AhYA3wICAxYASQAWAxgA8AJaAgsAQAAGASoAQAAEAyoAQABRAAAAQADpAiUAQADuAhYAQADqAiUAQAPWAhYAQAPWAhcAQANbAxYAQANlAxYAQANlAxcAQAP7AhYAQANcAxYAQAN/AxYAQAOHAxYAQANHAxYAQANFAyoAQANYAxYAQAMBAxcAQAMiAxYAQAMiAxcAQAPhAiUAQAPRAhYAQAPRAhcAQANCAyUAQAPkAiYAQAOCABYAQAM/AyUAQAMyAyUAQAPeAiUAQAOFAxYAQAOKAxYAQAOKAxcA2ABQAyoA2AD7AisA2AAIAysA2ABdASsA2ABdAQsA2ABkASsA2AA1AwsA2ABEAysA2AA5AxgA2AA0AysArwEGARYArwEJAxEArwFaAgAArwEZAxEArwFRAAAArwHhAisArwHLAQAArwG/ACoAKQMVAxEAKQPLARgAhANUAyYAhANUAysAhANhAysAhANgAysAhANsAysAhANpAysAhANkAysAhANrAysAhANPAyUAhAPWAhcAhANbAxYAhANbAxcAhANbAysAhANlAxYAhANlAxcAhANlAysAhANlAyUAhANwAyYAhANwAxYAhANwAxcAhANwAysAhANcAyYAhANcAxYAhANcAxcAhANcAwAAhANnAysAhAN/AxYAhAN/AxcAhANzAysAhAOOAxYAhAOBAxcAhAOHAxYAhAOHAxcAhANRAyYAhANRAysAhANRAyoAhAN+AysAhANtAysAhANYAyYAhANYAxYAhANYAxcAhANYAyUAhAMBAxYAhANyAysAhANyAyoAhAODAxYAhAODAxcAhAODAysAhAN5AxYAhAN5AxcAhAOAAxYAhAOAAxcAhAOAAyUAhAOAAwAAhAN8AxYAhAN8AxcAhAN8AwAAhAMiAxYAhAN0AxYAhAN0AxcAhAMuAyUAhAMlAxYAhAMlAxcAhAMlAysAhANWAwAAhANmAyUAhAPRAhcAhAPRAisAhANiAyYAhANiAxcAhANiAysAhAP6AhcAhANTACsAhANxAxcAhANqAysAhAOMAxcAhAN4AxYAhAN4AxcAhAN4AysAhAM/AwAAhAMPAxYAhAMPAxcAhAPOAiUAhAOGAyUAhAOCAysAhAOCAyUAhAOFAxYAhAN7AxYAhAN7AwAAhANZAxYAhANZAxcAhANZAysAhANZAwAAhAPUAhYAhAPUAhcAhAPUAisAhAPUAiUAhAPUAgAAhAOKAxYAhAOKAxcAhAOKAyUAVACQAwAAVABUAxYAVADJAiUAVADJAgAAVADWAhYAVADWAhcAVABbAxYAVABbAxcAVABTAxYAVABTAxcAVABwAxYAVABwAxcAVABcAxYAVABcAxcAVAB/AxYAVAB/AxcAVACOAwAAVACHAxYAVABRAxYAVABSAxYAVABSAxcAVABHAxYAVABYAxYAVABYAxcAVABcAQAAVAABAxYAVACDAxYAVACDAxcAVAB5AxYAVAB5AxcAVABkARgAVACAAxYAVACAAxcAVACAAwAAVAB8AxYAVAB8AxcAVAB8AwAAVACRAwAAVAAiAxYAVAAiAxcAVAB0AxYAVAB0AxcAVAAuAxcAVAAlAxYAVAAlAxcAVABWAxYAVABWAxcAVABWAwAAVABXAxYAVABXAxcAVABiAxcAVAD6AhYAVAD6AhcAVAAEAQAAVABYAAAAVABxAxcAVABqAwAAVACMAwAAVACCABcAVACPAwAAVAB4AxYAVAB4AxcAVABVAxYAVAA/AwAAVAAPAxYAVAAPAxcAVACCAwAAVACFAxYAVAB7AxYAVAB7AxcAVAB7AwAAVABZAxYAVABZAxcAVABZAwAAVADUAhYAVADUAhcAVADUAgAAVACKAxYAVACKAxcAVABAAxYAVACEAxYAVACEAxcAVACEAwAAWgNgAyYAWgPWAhcAWgNbAxYAWgNbAxcAWgNlAxYAWgNlAxcAWgNwAxYAWgNwAxcAWgNcAxYAWgNcAxcAWgNcAwAAWgN/AxYAWgN/AxcAWgOOAxYAWgOBAxcAWgNSAyYAWgP1ABYAWgP1ABcAWgNtAxYAWgNtAxcAWgNYAyYAWgNYAxcAWgMBAxYAWgODAxYAWgODAxcAWgN5AxYAWgN5AxcAWgOAAxYAWgOAAxcAWgOAAwAAWgN8AxYAWgN8AxcAWgN8AwAAWgMlAxYAWgMlAxcAWgNWAxYAWgNWAxcAWgNWAwAAWgPRAhcAWgNTACYAWgNxAxcAWgN4AxYAWgN4AxcAWgNVAyYAWgM/AwAAWgN9AxcAWgMPAxcAWgOCAxYAWgOCAxcAWgN7AxcAWgN7AwAAWgNZAxYAWgNZAxcAWgNZAwAAWgPUAhYAWgPUAhcAWgPUAgAAWgOKAxcAWgOEAyYAWgOEAxYAWgOEAxcAWgOEAwAAWgNUABYAWgNUABcAWgNUAAAAdQNTAxYAdQNTAxcAdQNwAxYAdQNwAxcAdQNcAxYAdQOOAxYAdQODAxYAdQN5AxYAdQN5AxcAdQOAAxYAdQOAAwAAdQN8AwAAdQMlAxYAdQMlAxcAdQNWAwAAdQNXAxYAdQNXAxcAdQNiAxcAdQN4AxcAdQM/AwAAdQOCAxYAdQOCAxcAdQN7AwAAdQNZAyYAdQNZAxYAdQNZAxcAdQNZAwAAdQPUAhYAdQPUAhcAdQPUAgAAdQOEAxYAdQOEAxcAdQOEAwAAdQNUAAAAdQNaAxYAdQNaAxcAdQNaAwAAmwBOAyoAmwCRAyoAmwAiAyoAmwDOAioAmwBNAyoAmwDUAhcAmwD0AgsAmwD0AioAmwCKAyoA5gIGASUA5gLoAisA5gIVAxEA5gIAAxYA5gL/AhYA5gL/AiUA5gJcAhYA5gJYABYA5gLsAhEA5gIFAyoANwMKAxEANwMJAxgANwNOAyoANwNOAxEANwMIAxYANwMHAxcANwPiAisANwNkAREANwM7AxYANwM7AxcANwM7AyoANwORAyoANwPdAhYANwNcAisANwNcAioANwNEAxYANwOLAyoANwNNAyoANwNNAxEANwPYABgANwObACoAwwBQAyUAwwBOAyUAwwBOAxEAwwBRAAAAwwD0AhEA4AILAyoA4AIAAxYA4AIfAxYA4AIOAhYA4AIOAiUA4AJcAQAA4AI+AxEA4AI1AwAA4AKJAysA4ALdAhEA4AIZAwAA4ALpAhEA4AJcAhYA4ALuAhgA4AJYABYA4AL+AhYA4AL+AhEA4ALqAhYA4AKFAysA4ALfAiUAxgCQAwAAxgBUAysAxgAyAQAAxgBhAysAxgBgAyYAxgBgAysAxgBgAwAAxgDSAgAAxgBLAwAAxgBrAysAxgBPAwAAxgDJAgAAxgDWAgAAxgDWAgEAxgBbAysAxgBTAysAxgBlAysAxgBfAxcAxgAQAwAAxgBwAysAxgBnAysAxgBzAysAxgCOAwAAxgCBAxcAxgCHAwAAxgBRAyYAxgBRAysAxgB+AysAxgCkAgAAxgAYAwAAxgBtAysAxgBYAyYAxgBcAQAAxgCDAysAxgCRAwAAxgAlAysAxgBWAysAxgDRAisAxgDRAgAAxgAEAQAAxgBYAAAAxgBqAwAAxgCPAwAAxgB4AysAxgDOAgAAxgCCAysAxgCCAwAAxgDGAgAAxgBZAysAxgB2AysAxgDUAisAxgDUAgAAxgCEAyYAxgCEAysAxgCEAyoAxgBUAAAAxgBaAyYAlAAWAwAAlAC/ABgAOAMLAyoAOAMyASoAOAPnAhYAOAMBAxgAOAMBAxEAOAMZAxEAOANEAyUAOANEAxEAOAP+AhEAOAOFAysAOAM5AxEAOAO/ABgAOAPgAhEAQwMGAxEAQwNdAREAQwM7AxcAQwNCAxcAQwMFAxYAQwM3AxcAbQGkAiUAbQFdARcAbQFdAQsAbQEbAyYAbQFcAisA0wJUAxcA0wJUAysA0wJhAysA0wJgAysA0wLSAgAA0wJpAysA0wJrAysA0wLJAgAA0wLWAgAA0wJbAysA0wJlAxcA0wJlAysA0wJcAxcA0wJnAysA0wJzAysA0wJRAxcA0wJRAysA0wJtAysA0wJcAQAA0wKDAxcA0wKDAysA0wKAAxcA0wKAAwAA0wJ8AxcA0wJ8AwAA0wKRAwAA0wJ0AxcA0wIuAxcA0wIlAxcA0wIlAysA0wJWAwAA0wLRAisA0wLRAgsA0wJYAAAA0wJxAxcA0wJqAwAA0wKMAxcA0wJ4AxcA0wJ4AysA0wI/AwAA0wIPAxcA0wLOAgAA0wKCAysA0wKCAwAA0wLGAgAA0wJ7AxcA0wJ7AwAA0wJZAwAA0wLUAhcA0wLUAisA0wLUAgAA0wKEAwAA0wJUABcA0wJUAAAA0wJaAyYA0wJaAwAA0wJ1AwAA0wLGAAAALQMkAxgALQMkAxEALQMVAxgALQNYABEALQOCACUAMAPnAhYAMAM9AxgAMAMBAxEAMAP1AhgAMAPpAhEAMAMyAxgAMAO/ABgAMANAAyoAMAPmAioAMAPgAhEALwMLAxEALwOsACoALwPjAhgALwMJAxYALwMeAxYALwPnAhEALwM9AxYALwMaAxYALwMaAxEALwNFAwsALwPlAhEALwNRACUALwPhAioALwNCAyUALwPuAioALwPuAhgALwPkAhEALwMyAyUALwMFAxEALwMNAyYALwMNAxYALwNAAyUAdwNUAxcAdwNPAyUAdwNKAyUAdwNKAyoAdwNKAxEAdwNbAyoAdwNlAyUAdwNlAxgAdwNlAxEAdwP7AhEAdwMAAyoAdwMAAxgAdwMAAxEAdwPaAhEAdwOOAyoAdwOOAxgAdwOOAxEAdwOBAwAAdwOHAyoAdwOHAxgAdwOHAxEAdwM9AxEAdwP9AhgAdwMYAyUAdwMYAyoAdwMYAxEAdwOSAxEAdwNHAxgAdwNYAyUAdwNYAxEAdwPvAhYAdwPvAioAdwOAAxcAdwORAyUAdwORAyoAdwORAxEAdwN0AxcAdwMuAxYAdwMuAxcAdwMuAyUAdwP6AhEAdwNcAioAdwNcAhgAdwNcAhEAdwNxAxcAdwOMAxcAdwOMAwAAdwOPAwEAdwOPAyoAdwOPAxEAdwOIAxYAdwOIAxcAdwOIAyoAdwOIAxgAdwM8AyoAdwOGAyUAdwOGAyoAdwOGAxEAdwOCAyUAdwOCAyoAdwOCAxEAdwOFAyUAdwOFAxEAdwOLAyoAdwOLAxgAdwOLAxEAdwN2AwAAdwPUAiUAdwPUAioAdwPUAhEAdwOKAxcAdwOKAxEAdwOEAyUAMwP7AhYAMwMAAxYAMwM9AyUAMwMBAysAMwMBAyUAMwMBAxEAMwP1AiUAMwNCAxgAMwNCAxEAMwPuAhYAMwNEAyUAMwP2AiUAMwMwAyUAMQMLAxEAMQMyASUAMQPjAisAMQPjAhgAMQMGAysAMQP1AisAMQMyAyUAMQMNAyYA7QIyASoA7QIGASoA7QIEAxgA7QJMAxgA7QIEARgA7QL+AhYA7QJAABYAcwBcASUA0ALJAgsA0ALOAgAAeQAoAyYAeQDLARgAeQDLAREAHANLAxEAHANPAyUAHANPAxEAHANQAyUAHANOAyoAHAMmAxcAHAOCAwEAHAObACoAHAN3AyoAQQN/AwsAQQOJAwsAQQORAwsAQQNRACsAQQNRACUAQQM/AyUAQQMyAyUAQQPOAgsAQQOGAwsAQQPeAiUAQQOKAwsAQQNAAyUAQQNAAxgAQQMvAyUAQQMvAxEAQQMxAyUAfwDbAhgAfwAjAxEAfwAyAQAAfwBgAwAAfwDSAgAAfwBLAwAAfwDJAgAAfwDWAgAAfwCOAwAAfwCHAwAAfwDnAhgAfwAGAxgAfwAGAxEAfwCkAgAAfwAYAwAAfwDrAioAfwBcAQAAfwBdASUAfwBdARgAfwBdAREAfwD1AisAfwDlAioAfwA7AxgAfwA1AwsAfwCRAwAAfwDRAgAAfwDkAioAfwBYACsAfwBYACUAfwBYAAAAfwBqAwAAfwDOAgAAfwDLARgAfwANAysAfwDGAgAAfwDUAgAAfwDfAioAfwApAxgAfwBUAAAAfwDGAAAAfwBDAxEAfwDTAgAAfwB5ABgAgABbAxYAgABbAxcAgABbAyoAgABlAxgAgABwAxYAgABwAxcAgABcAxYAgABcAxcAgADaAhgAgADaAhEAgAD8AiUAgAD8AhgAgAD8AhEAgAAHAyUAgAD9AiUAgABFAyUAgABYAyUAgABYAxgAgABYAxEAgADvAhgAgADvAhEAgACAAxYAgACAAxcAgACAAwAAgAA7AyoAgAB8AxYAgAB8AwAAgAAiAxYAgAAiAxcAgAAiAyUAgAAlAxYAgAAlAxgAgABWAxYAgABWAxcAgABWAwAAgABcAiUAgABcAhEAgACPAyoAgABVAxYAgAA/AyYAgAA/AwAAgACIAxYAgACIAyoAgAAPAxYAgAACAyUAgAACAxgAgAB7AwAAgABNAyoAgABZAwAAgADUAgAAgACKAxgAgACKAxEAgACEAxYAgACEAxcAgACEAwAAgABUABYAgABUABcAgABUAAAAgABaAxYAgABaAwAAgAB1AwAAgADTAgAAgAB3AyUAgAB3AyoAgAB3AxEAgABBAwsAjwBKAxgAjwBKAxEAjwBlAxgAjwD7AioAjwD7AhgAjwD7AhEAjwAAAyoAjwAAAxgAjwAAAxEAjwDaAhgAjwCOAyoAjwCOAxgAjwCOAxEAjwCHAyoAjwCHAxEAjwDcAhcAjwA9AyoAjwA9AxgAjwA9AxEAjwB+AyoAjwB+AxgAjwB+AxEAjwAHAxgAjwD9AhgAjwD9AhEAjwAYAyoAjwAYAxgAjwAYAxEAjwCSAxgAjwCSAxEAjwBHAxEAjwD1AhcAjwD1AhEAjwCRAyoAjwBCAxcAjwD6AhEAjwBcAhEAjwCPAyoAjwCPAxgAjwCPAxEAjwDOAioAjwDOAhgAjwDOAhEAjwCGAyoAjwCGAxEAjwCCAyoAjwCCAxgAjwCCAxEAjwCFAxEAjwCLAyoAjwCLAxgAjwCLAxEAjwDUAioAjwDUAhEAjwD2AhcAjwCKAxEAjwB3AxEAjwCAACoAjwCAABEAIQMKAxgAIQNOAxgAIQNOAxEAIQNIAxcAIQM5AxgAIQPYABgAIQPDACUAIQPDABEAIQNtARcAegNTAxcAegNTAwEAegNcAwAAegNRAxcAegNSAxYAegNSAxcAegODAxYAegODAxcAegODAwEAegOAAwAAegN8AyYAegN8AxYAegN8AxcAegN8AysAegN8AwAAegMlAxYAegMlAxcAegNWAxYAegNWAxcAegNWAwAAegNxAxcAegNVAxYAegNVAxcAegM/AwAAegN9AxcAegN7AxYAegN7AxcAegN7AwAAegNZAxcAegNZAwAAegPUAhYAegPUAgAAegOEAxYAegOEAwAAegNUAAAAegNaAwAAegN1AwAAegPTAhcAegPTAgAAegOAAAAA9wIVAxEA9wIUAyoA9wJaAhgA9wJdARgA9wL1AisA9wLlAiYA9wLlAiUA9wLkAisA9wJYACUA9wIFAysA9wINAxEA9wIpAyUA9wIpAxgA9wIvAyoA9wIxAysARgMOAysARgMVAxgARgMVAxEARgOkAiYARgOkAisARgP1AgsARgOCABgARgMPAysARgP2AhcARgNBAyUARgP3AhEA1wLSAgAA1wJLAwAA1wLJAgAA1wJTAwEA1wL7AioA1wJOAwsA1wIAAyoA1wKOAwAA1wKOAyoA1wL1AAAA1wL1AAEA1wJ+AyoA1wKkAgAA1wIYAwAA1wIYAyoA1wJHAyYA1wLiAisA1wLiAhgA1wKDAwEA1wI7AxYA1wI7AyoA1wKRAwAA1wKRAyoA1wJcAisA1wJcAioA1wJYAAAA1wJqAwAA1wKPAyoA1wLOAgAA1wLOAioA1wKGAyoA1wKCAyoA1wKLAyoA1wI5AxgA1wLGAgAA1wJ7AwEA1wJNAyoA1wLUAgEA1wLUAioA1wKvAQAA1wI3AxYA1wI3AysA1wI3AyoA1wLGAAAA1wJtASsA1wLTAgAA1wJ3AyoA1wJ/AAAA1wKAACoA1wKPACoA1wJ6AwEA+QJBAxgA8gJsAysA8gJnAwEAbwP4AhYAbwP4AhcAbwNhAwsAbwNgAyYAbwNsAyYAbwNpAyYAbwNpAwsAbwOOAwAAbwMlAwsAbwPRAgsAbwNqAyYAbwNqAwsAbwPOAgAAbwPGAAAAbwN/AAAAbwN6AxcAhQAHAxcAhQA7AxYAhQA7AxcAhQBcAiYAhQBYACUAhQCCABgAhQA3AxYAhQBGAxgAKgOsACUAKgOsABEAbgOQAwAAbgNhAysAbgNoAwEAbgNgAysAbgNsAysAbgNkAysAbgNrAysAbgPWAhYAbgNbAxYAbgNbAysAbgNTAxcAbgNlAxYAbgNlAxcAbgNfAxcAbgNfAysAbgMQAwAAbgMQAwEAbgNcAxYAbgNcAxcAbgNcAwEAbgNnAysAbgN/AxYAbgNzAysAbgOBAwAAbgNRAxYAbgNRAxcAbgNRAwEAbgNtAwEAbgNHAxYAbgNYAxYAbgNYAxcAbgNcAQAAbgNyAysAbgODAxYAbgODAxcAbgODAysAbgODAwEAbgN5AxcAbgN5AwEAbgOAAxYAbgOAAxcAbgOAAwAAbgN8AxYAbgN8AxcAbgN8AwAAbgORAwAAbgORAwEAbgMiAxYAbgN0AxYAbgN0AxcAbgMuAxcAbgMlAxYAbgMlAxcAbgMlAysAbgNWAwAAbgNXAxcAbgMEAQAAbgOMAxcAbgOMAysAbgOPAwAAbgOPAwEAbgN4AxYAbgN4AxcAbgN4AwEAbgNVAxYAbgNVAxcAbgNVAysAbgNVAwEAbgM/AwAAbgMPAxYAbgMPAxcAbgPOAisAbgOCAwAAbgN7AxYAbgN7AxcAbgN7AwAAbgN7AwEAbgNZAxcAbgNZAwAAbgNZAwEAbgN2AysAbgPUAhYAbgPUAhcAbgPUAisAbgPUAgAAbgPUAgEAbgOKAxYAbgOEAxYAbgOEAxcAbgOEAwAAbgNUAAAAbgNaAxcAbgNaAwAAbgN1AwAAbgPGACsAbgPGAAAAbgPTAhcAbgPTAgAAbgOAAAAAbgN6AxYAbgN6AxcAbgN6AwAAiABUAxcAiAAuAxcAiACCACsAiACIAxYAiADTAhcAiAB3AxcAiAD5AisAzwKQAwAAzwJUAysAzwIyAQAAzwJhAysAzwJhAwsAzwJgAysAzwJgAwAAzwJgAwEAzwLSAgAAzwJpAysAzwJpAwsAzwJkAysAzwJkAwsAzwJLAwAAzwJPAwAAzwLJAisAzwLJAgsAzwLJAgAAzwLWAgAAzwLWAgEAzwJbAysAzwJTAysAzwJTAwsAzwJlAysAzwJlAwsAzwJnAysAzwJzAysAzwKOAwAAzwKOAwEAzwJRAysAzwJ+AysAzwKkAgAAzwIYAwAAzwKDAysAzwKRAwAAzwIlAwsAzwJWAysAzwLRAgAAzwJYAAAAzwJqAysAzwJqAwsAzwJqAwAAzwKPAwAAzwJ4AysAzwJ9AwsAzwLOAgAAzwKCAysAzwKCAwAAzwLGAgAAzwJ2AwsAzwKEAysAzwLGAAAAzwLGAAEAzwLTAisAzwLTAgsAzwLTAgAAzwJ/AAAAzwLXAgAAzwJvAwsAzwJvAwAAqgAyASUAqgAGARYAqgAGASUAqgAGARgAqgAJAxgAqgAaAxgAqgDlAisAqgA1AxgAqgAdAxgAqgDfAhEAqgCvAQAAqgDDAAAANgARAyoANgALAxgANgAoAyUANgAMAxYANgAVAxgANgAVAxEANgAAAysA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YQQtBCoAYQQwBCoAYQSHAyoAYQRKBCoAYQQ9BCoAYQSbAyoAYQQoBCoAYQQuBCoAYQSCAyoAYQTUAioAYQROBCoAgAApBAsAgABFBAAAgADaAwAAgADaAyoAgADaAxgAgAArBBYAgAArBBcAgAArBAsAgAArBCoAgABHBBcAgABHBBgAgABHBBEAgAAwBCUAgAAwBCoAgABBBAAAgABBBBEAgAA5BAAAgAAxBCUAgAAxBBgAgAAxBBEAgABEBAAAgABEBCoAgABeBCUAgABeBBgAgABCBAAAgAA0BBgAgAA8BCUAgAAJBAAAgABLBAAAgABcBBcAgABKBAAAgAD2ARYAgACbAwAAgAC9AAAAgAC9ABgAgABMBAAAgAAoBAAAgAC+ABYAgAC+ABcAgAC+ACUAgAC+AAAAgAC+ABgAgABYBAAAgADZAwAAgABbBAAAgADYAwAAgABdBBgAgAA+BBYAgABhBCoATQQ2BCUATQTaAwAATQTaAxgATQRrBAAATQSvAyoATQQrBAsATQQrBCoATQRHBBgATQRHBBEATQQwBCUATQQwBCoATQTbAyUATQRBBAAATQQ5BAAATQQxBBgATQReBCUATQReBBgATQReBBEATQRCBAAATQQ8BBgATQQJBAAATQRLBAAATQRKBAAATQQ9BCUATQQ9BCoATQQ9BBgATQQ9BBEATQSAAwAATQSbAwAATQSbAxgATQSbAxEATQR8AwAATQRWAwAATQS9AAAATQS9ABgATQRMBAAATQQoBAAATQQuBAsATQQuBCoATQQuBBgATQQuBBEATQSIAyoATQS+AAAATQS+ABgATQS+ABEATQR7AwAATQRZAwAATQRYBAAATQTUAiUATQTUAgAATQTUAioATQTUAhgATQTUAhEATQTZAyUATQTZAwAATQTZAxgATQTZAxEATQSKAxgATQSKAxEATQRbBAAATQTGAQsATQTGAREATQSEAwAATQRUAAAATQRaAwAATQR1AwAATQTYAwAATQTTAgAATQRhBCoATQSAAAAAegPaAwAAegNBBAAAegM5BAAAegNEBAAAegNCBAAAegNLBAAAegNKBAAAegNIBBYAegObAwAAegNJBBcAegNJBAAAegO9AAAAegNMBAAAegMoBAAAegNXBAAAegO+AAAAegM4BAAAegNYBAAAegPZAwAAegNbBAAAegNTBAAAegPYAwAAegOaAwAAegNNBAAAXwRUBCsAXwRoBBcAXwQ7BCsAXwR7AysATwQqBAsATwRWBAAATwTaAyoATwTaAxgATwRgBAAATwQrBAsATwQrBCoATwQrBBgATwRHBBgATwRHBBEATwQwBCUATwQwBCoATwQxBCUATwQxBBgATwQxBBEATwReBCUATwReBAAATwReBBgATwReBBEATwQ8BCUATwQ8BBgATwQ8BBEATwRcAQAATwS9ABgATwSIAyoATwS+ACUATwS+ABgATwS+ABEATwTGAREATwTgAgAATwRhBCoATwRfBAAAbgNGBCsAbgPaAwAAbgO8AAEAbgMrBBYAbgNBBAAAbgNABBYAbgNABBcAbgM5BBYAbgM5BBcAbgM5BAAAbgNCBBYAbgNCBAAAbgM0BBcAbgNLBAAAbgNKBAAAbgNIBBYAbgOrAwEAbgM9BBYAbgM9BBcAbgObAxYAbgObAxcAbgObAysAbgObAwAAbgNJBBcAbgNJBCsAbgO9AAAAbgNMBAAAbgMoBAAAbgMuBBYAbgO+AAAAbgNYBAAAbgPZAwAAbgNbBAAAbgPYAwAAbgNdBBYAbgM+BBYAbgOaAxYAbgOaAxcAbgOaAwEAbgNNBAAA","pos":"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","heat":["//////////////////////////////////////////////////////////////////////////////////////////////////7//////////////////////////xYKSw1Isg8VCgRGZQ0OV1lXDlEGEcQMBwc1G3QSDA00Ih5ALRxNRJdJEGEDWzMkDWAsDh5DA0gvVSYZIwtlAwdhcD8PEg49khUbnUlzCl8xADY/XgMfFgIADxgvQy0JGA5JHgYMigwOTwUAFDZDDDwKDzg7EAoMCA8DnwtNBwAHASIFCQ4AAGwAIwcqAAIOCwYREwUcBQM6DgQVCQsNKwklHRILIXtSBl0JDRQXHkpVV0IZCSdOOAlJBwoFTnBDJh8EMAkQFGEWGxMTDwwGKgoABjQOCoYzBQ0yBxkNFw0LUg8cLgAiDYFuDB8JAAQGCAUJNFJFPDjADghSCTImHy56ih8+AytgD1AAawUJFzO3OFY4BkoEBAMDCgYKAQwIECUfHBUHBgEDGgADEgEOIwENBgAAExYMF0MGEgUSAwYIBgYDABMDGAMAAAAEAhUDBgonBwsEGAMfAwAoBQIPAQAAIQoGBwAADgcQFQc1NgkcDAgZCgkIAANDCgQUCwQOBgYLBA0OFhgGBgcIEAsIBQ0IAwcEDwwLBw4AAgUbAQEdDAUFBwwCBQUKAg0ACQwKCzs2BAYHABcFBRcHBAMHCAAABQwJBBMMGzAGBAIDGQYPDhEbIwYwIREJDw8OCgQVEAcODwQGCgEAAAAmFQsHBw8KBQAHBwwEBg8bCgkLFg8JEgYDBCIIBh0EBQIKDxwGAAoGGQMIAAYGAgUACAMDYQIHCwMABBgEAAcFCgQUAwQLDggECwsLAwYDDAQEABwlBBIZBgYYBDAGAAIDAQgIDgsPDwwBBQUICwkVCQQHAgkPBwQTBgMFCgIBBAAiFAkBCxwtFhgCHT8NAQ8HABQADhEPGTIWFDARCRcKEA8aDhsuHk8kHyMbGR0cHQIROgUKPS4uCDQPCAoVEA4DCQ0CBgkBGS4LDQANCQIiIyALFhUUDRM8DxUAUz88Pj9pJQUJFj8gIBwhHA4KCzceHRQqBQ0UOw8RDAoZFhEBDQUTCSIrCQ8LFgsAABEDAwQEJAEEAwQKChIDAgUJBwkEBAgEAwMhBQIHBwQkEg8yLxwHMwQFCRseBQ4U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"],"overlap":{"groups":[5,11],"genes":[785,731,779,804,306,808,865,852,864,876,873,867,862,811,872,868,843,722,172,875,847,822,848,842,771,713,262,726,859,851,869,638,812,782,780,763,739,778,790,744,777,784,846,798,880,860,871,895,883,768,791,755,730,910,912,897,764,903,789,849,732,799,743,772,850,776,774,245,829,894,767,526,676,775,765,792,803,877,863,366,794,914,788,747,602,839,786,837,856,738,348,769,349,882,899,889,830,356,795,751,840,757,896,741,827,892,821,905,826,841,913,733,802,793,81,884,844,814,805,854,737,855,870,721,834,866,762,745,83,260,604,750,740,88,806,836,881,766,874,153,908,130,748,911,888,853,831,797,818,904,506,760,893,783,909,718,828,902,746,770,729,898,773,734,160,901,807,907,459,781,825,710,891,820,845,857,886,191,724,753,758,756,800,906,735,861,73,752,64,832,216,431,809,900,84,858,885,155,742,823,195,736,198,148,824,835,365,723,813,816,815,887,819,817,749,115,720,121,796,833,127,128,143,801,890,759,838,727,761,754,879,133,810,878,136,719,170,54,1066,1065,1078,1130,1123,1071,1110,1094,1093,986,1077,1131,1132,1129,1122,441,1108,943,188,1127,1106,1068,1075,1120,1069,1067,1095,1072,987,1036,1104,1089,1088,1081,493,1124,1073,1092,1109,1118,1082,1090,1076,1084,1033,1126,1099,1116,1098,1125,1096,279,939,1085,502,923,1105,1079,1097,189,1100,1064,1070,1111,1087,190,1083,1113,1080,1091,1112,985,1115,454,1074,1114,1107,984,1117,1086,1102,922,1121,1101,1119,1128,1103]},"walk":{"restart":0.7,"switch":0.5,"zMin":1.645,"runs":1000}};

// The multiplex network of the muscle story (slide 8 of the talk): 71 layers of gene links stacked into a tower, the
// same genes at the same spot in every layer, threads joining a gene's copies. The hero of the story and the base of
// its explore mode. Everything is read from NMD_DATA; looks are decided in the shaders from two small textures (one
// per gene, rewritten only when the selection changes; one per layer, 71 texels), so no big buffer is ever rebuilt.
SETS.tower = function (K) {
  const { THREE, smooth, clamp, lerp, prog, rng, rgb } = K;
  const set = K.newSet('tower');
  const D = NMD_DATA, GR = D.groups, LAY = D.layers, GN = GR.length, LN = LAY.length, PN = D.ppi.length;
  const W = D.walk || {}, ZMIN = W.zMin || 1.645, RESTART = W.restart || 0.7, SWITCH = W.switch || 0.5;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- decode the data
  const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const termList = ids => (ids ? ids.split('.').map(k => D.terms[+k]) : []);
  const genes = D.genes.map(row => {
    const f = row.split('|'), seed = +f[2], added = +f[3];
    return { sym: f[0], endo: f[1].split('.').map(Number), seed, added, groups: seed | added,
      go: termList(f[4]), hpo: termList(f[5]), kegg: termList(f[6]), ppi: f[7] === '1' };
  });
  const N = genes.length;
  const inG = (i, g) => g >= 0 && (genes[i].groups >> g & 1) === 1, isSeed = (i, g) => g >= 0 && (genes[i].seed >> g & 1) === 1;
  const nGroups = i => { let c = 0; for (let x = genes[i].groups; x; x &= x - 1) c++; return c; };
  const PB = new Int16Array(bytes(D.pos).buffer), BX = new Float32Array(N), BZ = new Float32Array(N);
  for (let i = 0; i < N; i++) { BX[i] = PB[2 * i] / 32000; BZ[i] = -PB[2 * i + 1] / 32000; }
  const HEAT = D.heat.map(s => Float32Array.from(bytes(s), v => v / 255));
  const MEM = GR.map((_, g) => genes.map((G, i) => i).filter(i => inG(i, g)));
  const SEEDS = GR.map((_, g) => MEM[g].filter(i => isSeed(i, g)));
  // endotype members: ENDO[g][c] = gene indices
  const ENDO = GR.map((G, g) => { const o = {}; for (const e of G.endo) o[e.c] = []; for (const i of MEM[g]) { const c = genes[i].endo[g]; if (c) (o[c] = o[c] || []).push(i); } return o; });

  // links of every layer, whatever its category: protein layers from edges (a bit per protein layer), the rest from
  // extra (one tower layer each). A layer that gets links later just shows them.
  const PPI_OF = new Int16Array(LN).fill(-1); D.ppi.forEach((l, p) => { PPI_OF[l] = p; });
  const EB = bytes(D.edges), EW = new Uint32Array(EB.buffer, 0, EB.length >> 2);
  const XB = bytes(D.extra), XW = new Uint16Array(XB.buffer, 0, XB.length >> 1);
  const LC = new Int32Array(LN);
  for (let k = 0; k < EW.length; k += 2) for (let m = EW[k + 1], p = 0; m; m >>>= 1, p++) if (m & 1) LC[D.ppi[p]]++;
  for (let k = 0; k < XW.length; k += 3) LC[XW[k + 2]]++;
  const LL = Array.from(LC, n => new Uint16Array(2 * n)), LF = new Int32Array(LN);
  for (let k = 0; k < EW.length; k += 2) {
    const a = EW[k] >>> 16, b = EW[k] & 65535;
    for (let m = EW[k + 1], p = 0; m; m >>>= 1, p++) if (m & 1) { const l = D.ppi[p]; LL[l][LF[l]++] = a; LL[l][LF[l]++] = b; }
  }
  for (let k = 0; k < XW.length; k += 3) { const l = XW[k + 2]; LL[l][LF[l]++] = XW[k]; LL[l][LF[l]++] = XW[k + 1]; }
  // neighbours per layer (CSR)
  const ADJ = LL.map(arr => {
    const off = new Int32Array(N + 1);
    for (let k = 0; k < arr.length; k++) off[arr[k] + 1]++;
    for (let i = 0; i < N; i++) off[i + 1] += off[i];
    const nb = new Uint16Array(arr.length), f = off.slice(0, N);
    for (let k = 0; k < arr.length; k += 2) { const a = arr[k], b = arr[k + 1]; nb[f[a]++] = b; nb[f[b]++] = a; }
    return { off, nb };
  });
  const deg = (i, l) => ADJ[l].off[i + 1] - ADJ[l].off[i];
  const edgeCount = LC.reduce((s, n) => s + n, 0);
  const hasData = Array.from(LC, n => n > 0);
  // layer-links inside each group's module
  const MODL = GR.map((_, g) => { let n = 0; for (let l = 0; l < LN; l++) { const a = LL[l]; for (let k = 0; k < a.length; k += 2) if ((genes[a[k]].groups & genes[a[k + 1]].groups) >> g & 1) n++; } return n; });

  // ---------------------------------------------------------------- geometry of the tower
  const CATN = { pheno: 'Phenotypes', path: 'Pathways', drug: 'Drug targets', ess: 'Essential genes', coex: 'Co-expression', ppi: 'Protein interactions' };
  const CATC = { ppi: '#46d9ff', coex: '#3ee08f', pheno: '#ff5ad9', path: '#ffb43b', drug: '#ff5a4b', ess: '#b07bff' };
  const CATL = { ppi: 'cyn', coex: 'grn', pheno: 'mag', path: 'amb', drug: '', ess: '' };
  const H = 2.2, GAP = 0.08;
  let nGap = 0; for (let l = 1; l < LN; l++) if (LAY[l].cat !== LAY[l - 1].cat) nGap++;
  const SP = (H - nGap * GAP) / (LN - 1), LY = new Float32Array(LN);
  for (let l = 0, y = H / 2; l < LN; l++) { if (l && LAY[l].cat !== LAY[l - 1].cat) y -= GAP; LY[l] = y; y -= SP; }
  const LI = {}; LAY.forEach((L, l) => { LI[L.key] = l; });
  const cats = []; LAY.forEach((L, l) => { const c = cats.find(x => x.cat === L.cat); if (c) c.ls.push(l); else cats.push({ cat: L.cat, ls: [l] }); });
  for (const c of cats) c.y = (LY[c.ls[0]] + LY[c.ls[c.ls.length - 1]]) / 2;
  const blockMid = cat => { const c = cats.find(x => x.cat === cat); return c ? c.y : 0; };
  const PPI_TOP = D.ppi.length ? Math.max(...D.ppi.map(l => LY[l])) : 0;
  // directions: bars stick out to the left of the default view, category labels sit on its right rim
  const CAM_AZ = 24 * Math.PI / 180, RIGHT = [Math.cos(CAM_AZ), -Math.sin(CAM_AZ)], BAR = [-Math.cos(CAM_AZ), Math.sin(CAM_AZ)];
  const BARS = 0.065;                 // bar length per unit of z
  const PCX = 0.62, PR = 0.44;        // pair mode: tower centres at x = -PCX / +PCX, radius PR
  const ROOM = 0.45;                  // room mode: inner radius of the annulus
  // grid mode: the stack squashes around the protein block, so the endotype blocks read as a grid and not as long
  // columns that perspective splays into a funnel
  const FLAT = 0.1, FLAT_Y = () => blockMid('ppi'), flatY = l => FLAT_Y() + (LY[l] - FLAT_Y()) * FLAT;
  const PRES = new Uint8Array(N * LN);
  for (let l = 0; l < LN; l++) for (let i = 0; i < N; i++) if (deg(i, l)) PRES[i * LN + l] = 1;

  // ---------------------------------------------------------------- colours
  const ENDO_PAL = ['#46d9ff', '#ff5ad9', '#ffb43b', '#3ee08f', '#ff5a4b', '#b07bff', '#4d94ff', '#e6d23c', '#2fc4b2', '#ff8a3d',
    '#9be15d', '#ff8fb8', '#7f8cff', '#7ff0f0', '#d77bff', '#c9a66b', '#b5f5c8', '#ffb199', '#a8c8ff', '#f2e394'];
  const endoColour = c => ENDO_PAL[((Math.max(1, c | 0) - 1) % ENDO_PAL.length + ENDO_PAL.length) % ENDO_PAL.length];
  const GOLD = rgb('#ffe2a0'), MUTED = rgb('#56657d'), AMBER = rgb('#ffb43b'), NEUTRAL = rgb('#8396b3');
  const GC = GR.map(G => rgb(G.col));

  // ---------------------------------------------------------------- layouts: grid (per group) and pair
  const GRID = [], GRIDC = [];
  function gridLayout(g) {
    if (GRID[g]) return GRID[g];
    const out = new Float32Array(2 * N), E = GR[g].endo.slice().sort((a, b) => a.c - b.c), ne = Math.max(1, E.length);
    const cols = Math.ceil(Math.sqrt(ne)), rows = Math.ceil(ne / cols), cell = 1.5 / cols, hv = HEAT[g];
    const maxN = Math.max(1, ...E.map(e => (ENDO[g][e.c] || []).length));
    const sp = Math.min(0.05, cell * 0.6 / Math.ceil(Math.sqrt(maxN)));
    const centres = {};
    E.forEach((e, k) => {
      const row = Math.floor(k / cols), inRow = Math.min(cols, ne - row * cols), col = k % cols;
      const cx = (col - (inRow - 1) / 2) * cell, cz = (row - (rows - 1) / 2) * cell;
      centres[e.c] = [cx, cz, row, cell];
      const mem = (ENDO[g][e.c] || []).slice().sort((a, b) => hv[b] - hv[a] || a - b), m = Math.ceil(Math.sqrt(mem.length)) + 1;
      const slots = [];
      for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) slots.push([a - (m - 1) / 2, b - (m - 1) / 2]);
      slots.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]) || p[1] - q[1] || p[0] - q[0]);
      mem.forEach((i, j) => { out[2 * i] = cx + slots[j][0] * sp; out[2 * i + 1] = cz + slots[j][1] * sp; });
    });
    // everyone else waits on a faint ring at the rim
    const r = rng(500 + g);
    for (let i = 0; i < N; i++) if (!inG(i, g) || !genes[i].endo[g]) {
      const a = Math.atan2(BZ[i], BX[i]), rr = 0.955 + 0.03 * r();
      out[2 * i] = rr * Math.cos(a); out[2 * i + 1] = rr * Math.sin(a);
    }
    GRIDC[g] = centres;
    return (GRID[g] = out);
  }
  const BASE = new Float32Array(2 * N); for (let i = 0; i < N; i++) { BASE[2 * i] = BX[i]; BASE[2 * i + 1] = BZ[i]; }

  // pair: Congenital Myopathies left, Hereditary Cardiomyopathies right, genes in both in a narrow column between
  const PG = (D.overlap && D.overlap.groups) || [5, 11], PGL = PG[0], PGR = PG[1];
  const PCLS = new Uint8Array(N), PPOS = new Float32Array(2 * N), PFLAG = new Uint8Array(N);
  for (let i = 0; i < N; i++) PCLS[i] = (inG(i, PGL) ? 1 : 0) | (inG(i, PGR) ? 2 : 0);
  for (const side of [1, 2]) {
    const mem = [...Array(N).keys()].filter(i => PCLS[i] === side), cx = side === 1 ? -PCX : PCX;
    let mx = 0, mz = 0; for (const i of mem) { mx += BX[i]; mz += BZ[i]; } mx /= mem.length || 1; mz /= mem.length || 1;
    mem.sort((a, b) => Math.hypot(BX[a] - mx, BZ[a] - mz) - Math.hypot(BX[b] - mx, BZ[b] - mz));
    mem.forEach((i, k) => {
      const r = Math.sqrt((k + 0.5) / mem.length) * PR * 0.97, a = Math.atan2(BZ[i] - mz, BX[i] - mx);
      PPOS[2 * i] = cx + r * Math.cos(a); PPOS[2 * i + 1] = r * Math.sin(a);
    });
  }
  const BOTH = [...Array(N).keys()].filter(i => PCLS[i] === 3).sort((a, b) => BZ[a] - BZ[b] || a - b);
  const bRows = Math.ceil(BOTH.length / 2), bStep = Math.min(0.05, 0.76 / Math.max(1, bRows));
  BOTH.forEach((i, k) => { PPOS[2 * i] = ((k % 2) - 0.5) * 0.045; PPOS[2 * i + 1] = (Math.floor(k / 2) - (bRows - 1) / 2) * bStep; });
  for (let i = 0; i < N; i++) if (!PCLS[i]) { PPOS[2 * i] = BX[i] * 1.06; PPOS[2 * i + 1] = BZ[i] * 1.06; }
  // shared endotypes: pairs of endotypes (one per group) that share at least SHARE_MIN genes
  const SHARE_MIN = 3, pairCount = new Map();
  for (const i of BOTH) { const a = genes[i].endo[PGL], b = genes[i].endo[PGR]; if (a && b) pairCount.set(a + ',' + b, (pairCount.get(a + ',' + b) || 0) + 1); }
  const pairEndo = [...pairCount].map(([k, n]) => { const [a, b] = k.split(',').map(Number); return { left: a, right: b, genes: n, shared: n >= SHARE_MIN }; })
    .sort((x, y) => y.genes - x.genes || x.left - y.left || x.right - y.right);
  const shL = new Set(pairEndo.filter(p => p.shared).map(p => p.left)), shR = new Set(pairEndo.filter(p => p.shared).map(p => p.right));
  for (let i = 0; i < N; i++) {
    const c = PCLS[i]; if (!c) continue;
    const sd = ((c & 1) && isSeed(i, PGL)) || ((c & 2) && isSeed(i, PGR));
    const sh = ((c & 1) && shL.has(genes[i].endo[PGL])) || ((c & 2) && shR.has(genes[i].endo[PGR]));
    PFLAG[i] = (sd ? 1 : 0) + (sh ? 2 : 0);
  }
  // links in pair mode: both modules squeezed into small discs, so each is drawn fainter
  const PKF = Math.round(0.55 * clamp(Math.sqrt(2500 / Math.max(1, (MODL[PGL] || 0) + (MODL[PGR] || 0))), 0.3, 1) * 1000) / 1000;
  const GLOW_KEYS = ['HP', 'coex_HRA', 'coex_HRV', 'ppi_skeletal_muscle'].filter(k => LI[k] !== undefined);
  const PAIR_GLOW = new Uint8Array(LN); for (const k of GLOW_KEYS) PAIR_GLOW[LI[k]] = 1;

  // ---------------------------------------------------------------- gene texture
  // rows per slot s (0 = the previous selection, 1 = the current one; the looks cross-fade): 4s+0 grid x, z, pick mask,
  // gene ring; 4s+1 colour, member; 4s+2 endotype colour, seed; 4s+3 heat, join rank. Row 8: pair x, z, class, flags.
  // Row 9: layout x, z.
  const GT_ROWS = 10, gtd = new Float32Array(N * GT_ROWS * 4);
  const GT = new THREE.DataTexture(gtd, N, GT_ROWS, THREE.RGBAFormat, THREE.FloatType);
  GT.magFilter = GT.minFilter = THREE.NearestFilter; GT.generateMipmaps = false;
  const gset = (i, r, a, b, c, d) => { const o = (r * N + i) * 4; gtd[o] = a; gtd[o + 1] = b; gtd[o + 2] = c; gtd[o + 3] = d; };
  const gget = (i, r, k) => gtd[(r * N + i) * 4 + k];
  for (let i = 0; i < N; i++) { gset(i, 8, PPOS[2 * i], PPOS[2 * i + 1], PCLS[i], PFLAG[i]); gset(i, 9, BX[i], BZ[i], 0, 0); }
  const SL = [new THREE.Vector4(), new THREE.Vector4()];   // per slot: selected, pick on, gene on, heat on
  const PICKC = Array.from({ length: 8 }, () => new THREE.Color(1, 1, 1));
  const slotInfo = [null, null];
  function writeSlot(s, eff) {
    const g = eff.group, grid = g >= 0 ? gridLayout(g) : BASE, hv = eff.heat || (g >= 0 ? HEAT[g] : null);
    const picks = (eff.pick || []).slice(0, 8);
    // module join order: the group's added genes by heat
    const rank = new Float32Array(N).fill(2);
    if (g >= 0) {
      const add = MEM[g].filter(i => !isSeed(i, g)).sort((a, b) => (hv ? hv[b] - hv[a] : 0) || a - b);
      add.forEach((i, k) => { rank[i] = (k + 1) / add.length; });
      for (const i of SEEDS[g]) rank[i] = 0;
    }
    for (let i = 0; i < N; i++) {
      let mask = 0; picks.forEach(([pg, pc], k) => { if (pg >= 0 && pg < GN && genes[i].endo[pg] === pc) mask += 1 << k; });
      gset(i, 4 * s, grid[2 * i], grid[2 * i + 1], mask, i === eff.gene ? 1 : 0);
      let col, mem, seed, ec;
      if (g >= 0) {
        mem = inG(i, g) ? 1 : 0; seed = isSeed(i, g) ? 1 : 0;
        col = mem ? GC[g] : MUTED; ec = mem && genes[i].endo[g] ? rgb(endoColour(genes[i].endo[g])) : col;
      } else {
        mem = 1; seed = genes[i].seed ? 1 : 0;
        col = nGroups(i) > 1 ? GOLD : GC[Math.max(0, 31 - Math.clz32(genes[i].groups))]; ec = col;
      }
      gset(i, 4 * s + 1, col[0], col[1], col[2], mem);
      gset(i, 4 * s + 2, ec[0], ec[1], ec[2], seed);
      gset(i, 4 * s + 3, hv ? hv[i] : 0, rank[i], 0, 0);
    }
    SL[s].set(g >= 0 ? 1 : 0, picks.length ? 1 : 0, eff.gene >= 0 ? 1 : 0, hv ? 1 : 0);
    // big modules have thousands of links per layer: each is drawn fainter
    TU.uMK.value.setComponent(s, g >= 0 ? clamp(Math.sqrt(2500 / Math.max(1, MODL[g])), 0.3, 1) : 1);
    if (s === 1) picks.forEach(([, pc], k) => PICKC[k].set(endoColour(pc)));
    slotInfo[s] = eff;
    GT.needsUpdate = true;
  }
  function shiftSlots() {
    gtd.copyWithin(0, 4 * N * 4, 8 * N * 4);
    SL[0].copy(SL[1]); slotInfo[0] = slotInfo[1]; TU.uMK.value.x = TU.uMK.value.y;
  }

  // ---------------------------------------------------------------- layer texture (71 texels x 4 rows, per frame)
  // row 0: y, content alpha, rim alpha, fill alpha; row 1: rim colour, link weight; row 2: bar length, bar alpha, rest y,
  // rise; row 3: dashed, informative
  const ltd = new Float32Array(LN * 4 * 4), ltn = new Float32Array(LN * 4 * 4);
  const LT = new THREE.DataTexture(ltd, LN, 4, THREE.RGBAFormat, THREE.FloatType);
  LT.magFilter = LT.minFilter = THREE.NearestFilter; LT.generateMipmaps = false;
  const LYC = new Float32Array(LN), LCONT = new Float32Array(LN), LFr = new Float32Array(3 * LN);   // current y and content alpha (for the CPU side)

  // ---------------------------------------------------------------- shared shader code
  const TU = {
    uGT: { value: GT }, uLT: { value: LT }, uX: { value: 1 }, uSl0: { value: SL[0] }, uSl1: { value: SL[1] },
    uSeeds: { value: 0 }, uHeat: { value: 0 }, uModule: { value: 0 }, uEndo: { value: 0 }, uGrid: { value: 0 },
    uPair: { value: 0 }, uSeedOnly: { value: 0 }, uRoom: { value: 0 }, uDrop: { value: 0 }, uZ: { value: 0 },
    uPL: { value: new THREE.Color(GR[PGL] ? GR[PGL].col : '#46d9ff') }, uPR: { value: new THREE.Color(GR[PGR] ? GR[PGR].col : '#ff5ad9') },
    uPickC: { value: PICKC }, uMK: { value: new THREE.Vector2(1, 1) }, uWalk: { value: 0 },
  };
  const uni = extra => Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, TU, extra || {});
  const f1 = x => (Number.isInteger(x) ? x.toFixed(1) : String(x));
  const LOOK = `
uniform sampler2D uGT, uLT;
uniform float uA, uX, uSeeds, uHeat, uModule, uEndo, uGrid, uPair, uSeedOnly, uRoom, uDrop, uZ, uWalk;
uniform vec4 uSl0, uSl1;
uniform vec2 uMK;
uniform vec3 uPL, uPR, uPickC[8];
vec4 gt(float g, float r) { return texture2D(uGT, vec2((g + 0.5) / ${f1(N)}, (r + 0.5) / ${f1(GT_ROWS)})); }
vec4 lt(float l, float r) { return texture2D(uLT, vec2((l + 0.5) / ${f1(LN)}, (r + 0.5) / 4.0)); }
float bit(float m, float k) { return mod(floor(m / pow(2.0, k) + 0.001), 2.0); }
vec3 pickCol(float m) {
  vec3 c = vec3(1.0); float found = 0.0;
  for (int k = 0; k < 8; k++) { float b = bit(m, float(k)) * (1.0 - found); c = mix(c, uPickC[k], b); found = max(found, b); }
  return c;
}
vec3 heatCol(float h) { return h < 0.5 ? mix(vec3(0.05, 0.12, 0.42), vec3(0.27, 0.85, 1.0), h * 2.0) : mix(vec3(0.27, 0.85, 1.0), vec3(1.0), h * 2.0 - 1.0); }
// one slot's look of gene g: colour; q = (dot alpha, link part, thread, seed); xz; m = (pick mask, ringed)
void slotLook(float g, float s, vec4 sl, vec2 base, out vec3 col, out vec4 q, out vec2 xz, out vec2 m) {
  vec4 a = gt(g, s * 4.0), b = gt(g, s * 4.0 + 1.0), c = gt(g, s * 4.0 + 2.0), d = gt(g, s * 4.0 + 3.0);
  float member = b.w, seed = c.w * member, heat = d.x, rank = d.y, sel = sl.x;
  float joined = smoothstep(rank, rank + 0.025, uModule * 1.03);
  float mv = member * (seed > 0.5 ? 1.0 : 1.0 - uSeeds * (1.0 - joined));
  float flash = (1.0 - seed) * member * joined * (1.0 - smoothstep(0.0, 0.06, uModule * 1.03 - rank)) * step(0.001, uModule) * uSeeds;
  col = mix(b.rgb, c.rgb, uEndo * sel);
  float hv = uHeat * sl.w;
  col = mix(col, heatCol(heat), hv);
  float vis = sel > 0.5 ? mix(0.09, 1.0, mv) : 0.3;
  vis = mix(vis, max(vis * 0.35, heat * (0.25 + 0.75 * mv)), hv) + flash;
  col = mix(col, vec3(1.0), flash * 0.6);
  float lk = sel > 0.5 ? mv : 1.0;
  float hi = sel * mv * (0.07 + 0.4 * uDrop + 0.35 * seed * uSeeds);
  if (sl.y > 0.5) {
    if (a.z > 0.5) { col = pickCol(a.z); vis = 1.0; lk = 1.0; hi = 0.7; }
    else { vis *= 0.25; lk = 0.0; hi = 0.0; col = mix(col, vec3(0.42, 0.5, 0.62), 0.6); }
  }
  if (sl.z > 0.5 && a.w > 0.5) { col = mix(col, vec3(1.0), 0.5); vis = 1.0; hi = 1.0; }
  q = vec4(vis, lk, hi, seed);
  xz = mix(base, a.xy, uGrid);
  m = a.zw;
}
void look(float g, out vec3 col, out vec4 q, out vec2 xz, out vec2 m) {
  vec2 base = gt(g, 9.0).xy; float r = length(base);
  base *= mix(1.0, (${f1(ROOM)} + ${f1(1 - ROOM)} * r) / max(r, 0.0001), uRoom);
  slotLook(g, 1.0, uSl1, base, col, q, xz, m);
  if (uX < 0.999) {
    vec3 c0; vec4 q0; vec2 x0, m0;
    slotLook(g, 0.0, uSl0, base, c0, q0, x0, m0);
    col = mix(c0, col, uX); q = mix(q0, q, uX); xz = mix(x0, xz, uX); m = uX > 0.5 ? m : m0;
  }
  if (uPair > 0.001) {
    vec4 p = gt(g, 8.0);
    float cls = p.z, inP = step(0.5, cls), ps = mod(p.w, 2.0), sh = step(1.5, p.w), both = step(2.5, cls);
    vec3 pc = cls < 1.5 ? uPL : cls < 2.5 ? uPR : vec3(1.0, 0.94, 0.84);
    pc = mix(pc, vec3(1.0, 0.71, 0.23), sh);
    float pv = inP * (ps > 0.5 ? 1.0 : 1.0 - uSeedOnly * 0.9);
    col = mix(col, pc, uPair);
    q = mix(q, vec4(pv, inP * (ps > 0.5 ? 1.0 : 1.0 - uSeedOnly), inP * max(sh * 0.45, both * 0.7) * (ps > 0.5 ? 1.0 : 1.0 - uSeedOnly), ps * inP), uPair);
    xz = mix(xz, p.xy, uPair);
  }
}
`;

  // ---------------------------------------------------------------- layer discs: rims and fills
  // vertex position = (angle 0..1, layer, copy): copy 0 the main disc (the left tower in pair mode), 1 the right tower,
  // 2 the narrow middle column, 3 the inner rim of the room annulus
  const RING_GLSL = `
vec3 ringPos(float u, float l, float cp, float rr, float y) {
  float a = u * 6.2831853, ca = cos(a), sa = sin(a);
  vec2 c = vec2(0.0); float r = 1.0;
  if (cp < 0.5) { c = vec2(-${f1(PCX)} * uPair, 0.0); r = mix(mix(rr, ${f1(ROOM)} + ${f1(1 - ROOM)} * rr, uRoom), ${f1(PR + 0.03)} * rr, uPair); }
  else if (cp < 1.5) { c = vec2(${f1(PCX)}, 0.0); r = ${f1(PR + 0.03)} * rr; }
  else if (cp < 2.5) { return vec3(0.055 * sign(ca) * pow(abs(ca), 0.35), y, 0.43 * sign(sa) * pow(abs(sa), 0.35)); }
  else { r = ${f1(ROOM - 0.02)}; }
  return vec3(c.x + r * ca, y, c.y + r * sa);
}
float copyA(float cp) { return cp < 0.5 ? 1.0 : cp < 2.5 ? uPair : uRoom * (1.0 - uPair); }
`;
  const RSEG = [96, 96, 40, 64];
  let nRing = 0; for (const n of RSEG) nRing += n * LN;
  const ringGeo = new THREE.BufferGeometry(), rp = new Float32Array(nRing * 6);
  { let o = 0; for (let l = 0; l < LN; l++) RSEG.forEach((n, cp) => { for (let k = 0; k < n; k++) { rp.set([k / n, l, cp, (k + 1) / n, l, cp], o); o += 6; } }); }
  ringGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const ringMat = new THREE.ShaderMaterial({
    uniforms: uni(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: LOOK + RING_GLSL + `
varying vec3 vC; varying float vA, vU, vDash;
void main() {
  float u = position.x, l = position.y, cp = position.z;
  vec4 L0 = lt(l, 0.0), L1 = lt(l, 1.0), L3 = lt(l, 3.0);
  vec3 p = ringPos(u, l, cp, 1.0, L0.x);
  vC = L1.rgb; vA = L0.z * copyA(cp) * uA * (cp > 2.5 ? 0.6 : 1.0); vU = u * (cp > 0.5 && cp < 1.5 ? 0.5 : 1.0) * (cp > 1.5 && cp < 2.5 ? 0.3 : 1.0); vDash = L3.x;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC; varying float vA, vU, vDash;
void main() { if (vDash > 0.5 && fract(vU * 72.0) > 0.42) discard; gl_FragColor = vec4(vC, vA); }`,
  });
  set.mats.push(ringMat);
  const rings = new THREE.LineSegments(ringGeo, ringMat); rings.frustumCulled = false; rings.renderOrder = 1;

  // fills: two rings of vertices per disc (centre, rim); copies 0 (main/left) and 1 (right)
  const FSEG = 48, fp = new Float32Array(LN * 2 * FSEG * 6 * 3), fr = new Float32Array(LN * 2 * FSEG * 6);
  { let o = 0, q = 0; for (let l = 0; l < LN; l++) for (let cp = 0; cp < 2; cp++) for (let k = 0; k < FSEG; k++) {
    const a = k / FSEG, b = (k + 1) / FSEG;
    for (const [u, r] of [[a, 0], [a, 1], [b, 1], [a, 0], [b, 1], [b, 0]]) { fp.set([u, l, cp], o); o += 3; fr[q++] = r; }
  } }
  const fillGeo = new THREE.BufferGeometry();
  fillGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fillGeo.setAttribute('aR', new THREE.BufferAttribute(fr, 1));
  const fillMat = new THREE.ShaderMaterial({
    uniforms: uni(), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: LOOK + RING_GLSL + `
attribute float aR;
varying vec3 vC; varying float vA, vR;
void main() {
  float l = position.y, cp = position.z;
  vec4 L0 = lt(l, 0.0), L1 = lt(l, 1.0);
  vec3 p = ringPos(position.x, l, cp, max(aR, 0.001), L0.x);
  vC = L1.rgb; vA = L0.w * copyA(cp) * uA; vR = aR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  if (vA < 0.0005) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC; varying float vA, vR;
void main() { gl_FragColor = vec4(vC, vA * (0.25 + 0.75 * vR * vR)); }`,
  });
  set.mats.push(fillMat);
  const fills = new THREE.Mesh(fillGeo, fillMat); fills.frustumCulled = false; fills.renderOrder = 0;

  // ---------------------------------------------------------------- genes: a point per gene and layer it has links in
  let nPts = 0; for (let k = 0; k < PRES.length; k++) nPts += PRES[k];
  const pp = new Float32Array(nPts * 3);
  { let o = 0; for (let l = 0; l < LN; l++) for (let i = 0; i < N; i++) if (PRES[i * LN + l]) { pp[o++] = i; pp[o++] = l; pp[o++] = 0; } }
  const ptGeo = new THREE.BufferGeometry(); ptGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const ptMat = new THREE.ShaderMaterial({
    uniforms: uni(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + LOOK + `
varying vec3 vC; varying float vA, vS;
void main() {
  float g = position.x, l = position.y;
  vec3 col; vec4 q; vec2 xz, m; look(g, col, q, xz, m);
  vec4 L0 = lt(l, 0.0), L3 = lt(l, 3.0);
  float pulse = 0.5 + 0.5 * sin(uTime * 3.1 + g * 1.7);
  vC = col; vS = q.w; vA = (1.0 - 0.4 * uWalk) * clamp(q.x, 0.0, 1.4) * L0.y * uA * mix(L3.z, 1.0, max(q.w, m.y)) * (1.0 + 0.5 * q.w * uSeeds * pulse);
  vec4 mv = modelViewMatrix * vec4(xz.x, L0.x, xz.y, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = 0.0125 * (0.75 + 0.4 * min(q.x, 1.0)) * (1.0 + 0.45 * q.w + q.w * uSeeds * (0.35 + 0.3 * pulse)) * (1.0 + 0.6 * m.y);
  gl_PointSize = pointPx(sz, mv);
  if (vA < 0.006) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC; varying float vA, vS;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.2, d), glow = pow(1.0 - d * 2.0, 1.6);
  float a = max(core * 0.8, glow * 0.6);
  vec3 col = mix(vC, vec3(1.0), smoothstep(0.24, 0.0, d) * (0.25 + 0.65 * vS));
  gl_FragColor = vec4(col, vA * a);
}`,
  });
  set.mats.push(ptMat);
  const pts = new THREE.Points(ptGeo, ptMat); pts.frustumCulled = false; pts.renderOrder = 3;

  // ---------------------------------------------------------------- links: every layer's links in one geometry
  // vertex position = (gene, layer, partner + 0.9 * rank): the rank (0..1, seeded) thins the faint context links
  const lp = new Float32Array(edgeCount * 6);
  { const R = rng(71); let o = 0;
    for (let l = 0; l < LN; l++) { const arr = LL[l]; for (let k = 0; k < arr.length; k += 2) {
      const a = arr[k], b = arr[k + 1], rk = R() * 0.9;
      lp[o++] = a; lp[o++] = l; lp[o++] = b + rk; lp[o++] = b; lp[o++] = l; lp[o++] = a + rk;
    } } }
  const lnGeo = new THREE.BufferGeometry(); lnGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lnMat = new THREE.ShaderMaterial({
    uniforms: uni(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: LOOK + `
varying vec3 vC; varying float vA;
void main() {
  float g = position.x, l = position.y, o = floor(position.z), rk = fract(position.z) / 0.9;
  vec4 L0 = lt(l, 0.0), L1 = lt(l, 1.0);
  float w = L0.y * L1.w * uA;
  vA = 0.0; vC = vec3(0.0);
  vec3 p = vec3(0.0);
  if (w > 0.002) {
    vec3 ca, cb; vec4 qa, qb; vec2 xa, xb, ma, mb;
    look(g, ca, qa, xa, ma); look(o, cb, qb, xb, mb);
    float sel = mix(uSl0.x, uSl1.x, uX), pk = mix(uSl0.y, uSl1.y, uX), gn = mix(uSl0.z, uSl1.z, uX);
    // long links cross the whole disc: they are dimmed, the short ones (neighbourhoods) carry the picture
    float len = distance(xa, xb), near = mix(1.0, 0.16, smoothstep(0.18, 0.8, len)), nearM = mix(1.0, 0.6, smoothstep(0.3, 1.1, len));
    float ctx = step(rk, mix(0.26, 0.13, sel) * (1.0 - uPair) * (1.0 - 0.6 * pk)) * mix(0.066, 0.045, sel) * near;
    float both = qa.y * qb.y, sb = qa.w * qb.w;
    float mod_ = both * (0.55 * mix(uMK.x, uMK.y, uX) + 0.9 * sb * max(uSeeds, uSeedOnly * uPair)) * nearM * (1.0 - 0.5 * uWalk);
    float al = max(ctx, sel * mod_ * (1.0 - uPair) + uPair * both * ${f1(PKF)} * nearM);
    vec3 col = ca;
    // picked endotypes: links within one in its colour, links between two in amber
    if (pk > 0.001) {
      float within = 0.0, any_a = step(0.5, ma.x), any_b = step(0.5, mb.x);
      for (int k = 0; k < 8; k++) within = max(within, bit(ma.x, float(k)) * bit(mb.x, float(k)));
      float betw = any_a * any_b * (1.0 - within);
      al = mix(al, ctx * 0.6 + within * 0.5 + betw * 0.42, pk);
      col = mix(col, vec3(1.0, 0.71, 0.23), betw * pk);
    }
    float gq = max(ma.y, mb.y) * gn;
    al = max(al, gq * 0.4); col = mix(col, mix(ca, vec3(1.0), 0.45), gq);
    vA = al * w; vC = col;
    p = vec3(xa.x, L0.x, xa.y);
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  if (vA < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC; varying float vA;
void main() { if (vA < 0.003) discard; gl_FragColor = vec4(vC, vA); }`,
  });
  set.mats.push(lnMat);
  const links = new THREE.LineSegments(lnGeo, lnMat); links.frustumCulled = false; links.renderOrder = 2;

  // ---------------------------------------------------------------- threads: one vertical line per gene, top to bottom copy
  const TOPL = new Int16Array(N).fill(-1), BOTL = new Int16Array(N).fill(-1);
  for (let i = 0; i < N; i++) for (let l = 0; l < LN; l++) if (PRES[i * LN + l]) { if (TOPL[i] < 0) TOPL[i] = l; BOTL[i] = l; }
  const thr = [...Array(N).keys()].filter(i => TOPL[i] >= 0 && BOTL[i] > TOPL[i]);
  const tp = new Float32Array(thr.length * 6);
  thr.forEach((i, k) => tp.set([i, TOPL[i], 0, i, BOTL[i], 1], 6 * k));
  const thGeo = new THREE.BufferGeometry(); thGeo.setAttribute('position', new THREE.BufferAttribute(tp, 3));
  const thMat = new THREE.ShaderMaterial({
    uniforms: uni(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: LOOK + `
varying vec3 vC; varying float vA;
void main() {
  float g = position.x, l = position.y;
  vec3 col; vec4 q; vec2 xz, m; look(g, col, q, xz, m);
  vec4 L2 = lt(l, 2.0);
  vC = col; vA = q.z * 0.55 * L2.w * uA;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(xz.x, L2.z, xz.y, 1.0);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(vC, vA); }`,
  });
  set.mats.push(thMat);
  const threads = new THREE.LineSegments(thGeo, thMat); threads.frustumCulled = false; threads.renderOrder = 2;

  // ---------------------------------------------------------------- z bars: a box sticking out of the rim of each protein layer
  const zLayers = D.ppi.slice();
  const bv = [], bn = [], bl = [];
  { const C = [[0, -1, -1], [1, -1, -1], [1, 1, -1], [0, 1, -1], [0, -1, 1], [1, -1, 1], [1, 1, 1], [0, 1, 1]];
    const F = [[0, 1, 2, 3, [0, 0, -1]], [5, 4, 7, 6, [0, 0, 1]], [4, 0, 3, 7, [-1, 0, 0]], [1, 5, 6, 2, [1, 0, 0]], [3, 2, 6, 7, [0, 1, 0]], [4, 5, 1, 0, [0, -1, 0]]];
    for (const l of zLayers) for (const [a, b, c, d, n] of F) for (const v of [a, b, c, a, c, d]) { bv.push(...C[v]); bn.push(...n); bl.push(l); } }
  const barGeo = new THREE.BufferGeometry();
  barGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bv), 3));
  barGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bn), 3));
  barGeo.setAttribute('aL', new THREE.BufferAttribute(new Float32Array(bl), 1));
  const barMat = new THREE.ShaderMaterial({
    uniforms: uni({ uC: { value: new THREE.Color(1, 1, 1) } }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: LOOK + `
attribute float aL;
uniform vec3 uC;
varying vec3 vC; varying float vA;
void main() {
  vec4 L0 = lt(aL, 0.0), L2 = lt(aL, 2.0), L3 = lt(aL, 3.0);
  vec2 d = vec2(${f1(BAR[0])}, ${f1(BAR[1])}), s = vec2(-d.y, d.x);
  float r = 1.015 + position.x * L2.x;
  vec2 xz = d * r + s * position.z * 0.012;
  float hgt = ${f1(SP * 0.36)};
  vec3 n = normalize(vec3(d.x * normal.x + s.x * normal.z, normal.y, d.y * normal.x + s.y * normal.z));
  float sh = 0.55 + 0.45 * max(0.0, dot(n, normalize(vec3(-0.4, 0.7, 0.6))));
  vC = mix(vec3(0.45, 0.52, 0.64), uC, L3.y) * sh * (0.6 + 0.4 * position.x);
  vA = L2.y * mix(0.35, 0.95, L3.y) * uA;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(xz.x, L0.x + position.y * hgt, xz.y, 1.0);
  if (vA < 0.004 || L2.x < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC; varying float vA;
void main() { gl_FragColor = vec4(vC, vA); }`,
  });
  set.mats.push(barMat);
  const bars = new THREE.Mesh(barGeo, barMat); bars.frustumCulled = false; bars.renderOrder = 4;
  // the significance threshold: a dashed vertical line where the bars pass z = 1.645
  const zr = 1.015 + ZMIN * BARS, zTop = PPI_TOP + SP, zBot = D.ppi.length ? Math.min(...D.ppi.map(l => LY[l])) - SP : 0, zp = [];
  for (let k = 0, n = 24; k < n; k++) { const y0 = lerp(zBot, zTop, k / n), y1 = lerp(zBot, zTop, (k + 0.55) / n); zp.push(BAR[0] * zr, y0, BAR[1] * zr, BAR[0] * zr, y1, BAR[1] * zr); }
  const zlGeo = new THREE.BufferGeometry(); zlGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(zp), 3));
  const zlMat = K.fade(set, new THREE.LineBasicMaterial({ color: 0xffb43b, depthWrite: false, blending: THREE.AdditiveBlending }), 0.6);
  const zline = new THREE.LineSegments(zlGeo, zlMat); zline.renderOrder = 4;

  // ---------------------------------------------------------------- walkers and the gene ring (small, rewritten per frame)
  const NW = 20, TR = 7, wGeo = K.pointsGeo(NW * TR), wMat = K.points(set);
  const walkers = new THREE.Points(wGeo, wMat); walkers.frustumCulled = false; walkers.renderOrder = 5;
  const ringPts = K.pointsGeo(LN);
  const ringPMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + `
attribute vec3 aCol; attribute float aSize, aA; uniform float uA; varying vec3 vC; varying float vA;
void main() { vC = aCol; vA = aA * uA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv); if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`,
    fragmentShader: `varying vec3 vC; varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.42, d) * smoothstep(0.28, 0.36, d); if (a < 0.01) discard; gl_FragColor = vec4(vC, vA * a); }`,
  });
  set.mats.push(ringPMat);
  const geneRing = new THREE.Points(ringPts, ringPMat); geneRing.frustumCulled = false; geneRing.renderOrder = 5;
  set.group.add(fills, rings, links, threads, pts, bars, zline, walkers, geneRing);

  // ---------------------------------------------------------------- CPU mirror of the shader (anchors, pick, walkers)
  const U = n => TU[n].value;
  function slotPos(i, s, bx, bz) {
    const g = U('uGrid'), o = (4 * s * N + i) * 4;
    return [lerp(bx, gtd[o], g), lerp(bz, gtd[o + 1], g)];
  }
  // a gene's current spot (x, z) in every layer
  function genePos(i) {
    let bx = BX[i], bz = BZ[i]; const r = Math.hypot(bx, bz), f = lerp(1, (ROOM + (1 - ROOM) * r) / Math.max(r, 1e-4), U('uRoom'));
    bx *= f; bz *= f;
    let p = slotPos(i, 1, bx, bz); const X = U('uX');
    if (X < 0.999) { const p0 = slotPos(i, 0, bx, bz); p = [lerp(p0[0], p[0], X), lerp(p0[1], p[1], X)]; }
    const P = U('uPair');
    return P > 0.001 ? [lerp(p[0], PPOS[2 * i], P), lerp(p[1], PPOS[2 * i + 1], P)] : p;
  }
  function slotVis(i, s) {
    const sl = SL[s], member = gget(i, 4 * s + 1, 3), seed = gget(i, 4 * s + 2, 3) * member, heat = gget(i, 4 * s + 3, 0), rank = gget(i, 4 * s + 3, 1);
    const joined = smooth((U('uModule') * 1.03 - rank) / 0.025), mv = member * (seed > 0.5 ? 1 : 1 - U('uSeeds') * (1 - joined));
    let vis = sl.x > 0.5 ? lerp(0.09, 1, mv) : 0.42;
    const hv = U('uHeat') * sl.w; vis = lerp(vis, Math.max(vis * 0.35, heat * (0.25 + 0.75 * mv)), hv);
    if (sl.y > 0.5) vis = gget(i, 4 * s, 2) > 0.5 ? 1 : vis * 0.25;
    if (sl.z > 0.5 && gget(i, 4 * s, 3) > 0.5) vis = 1;
    return vis;
  }
  function geneVis(i) {
    let v = slotVis(i, 1); const X = U('uX'); if (X < 0.999) v = lerp(slotVis(i, 0), v, X);
    const P = U('uPair');
    if (P > 0.001) { const pv = PCLS[i] ? ((PFLAG[i] & 1) ? 1 : 1 - U('uSeedOnly') * 0.9) : 0; v = lerp(v, pv, P); }
    return v;
  }

  // ---------------------------------------------------------------- the random walk with restart (explore)
  function defaultWeights(g, on) {
    const w = new Float64Array(LN);
    if (g >= 0) for (let p = 0; p < PN; p++) { const z = GR[g].z[p]; if (z >= ZMIN) w[D.ppi[p]] = z; }
    if (!w.some(x => x > 0)) for (const l of D.ppi) w[l] = 1;
    for (let l = 0; l < LN; l++) if ((on && !on[l]) || !hasData[l]) w[l] = 0;
    return w;
  }
  const effGroup = () => (slotInfo[1] ? slotInfo[1].group : -1);
  function walk(seeds, opts = {}) {
    seeds = [...new Set((seeds || []).filter(i => i >= 0 && i < N))];
    const on = opts.on || Array.from({ length: LN }, (_, l) => !state.off.has(l));
    let w;
    if (opts.weights) { w = Float64Array.from({ length: LN }, (_, l) => (on[l] && hasData[l] ? Math.max(0, +opts.weights[l] || 0) : 0)); }
    else w = defaultWeights(opts.group !== undefined ? opts.group : effGroup(), on);
    const act = []; for (let l = 0; l < LN; l++) if (w[l] > 0) act.push(l);
    const heat = new Float32Array(N), top = [];
    if (!seeds.length || !act.length) return { heat, top, weights: Array.from(w) };
    const WS = w.reduce((s, x) => s + x, 0); for (const l of act) w[l] /= WS;
    const A = act.length, p0 = new Float64Array(A * N);
    let s0 = 0;
    for (const s of seeds) {
      let t = 0; act.forEach(l => { if (deg(s, l)) t += w[l]; });
      if (t > 0) act.forEach((l, a) => { if (deg(s, l)) { p0[a * N + s] += w[l] / t; s0 += w[l] / t; } });
    }
    if (s0 > 0) for (let k = 0; k < p0.length; k++) p0[k] /= s0;
    // at each gene: the summed weight of the active layers it has links in (where a switch can go)
    const wsum = new Float64Array(N);
    for (let i = 0; i < N; i++) act.forEach(l => { if (deg(i, l)) wsum[i] += w[l]; });
    let x = p0.slice(), nx = new Float64Array(A * N); const sw = new Float64Array(N);
    for (let it = 0; it < 80; it++) {
      nx.fill(0); sw.fill(0); let lost = 0;
      for (let a = 0; a < A; a++) {
        const l = act[a], { off, nb } = ADJ[l];
        for (let i = 0; i < N; i++) {
          const m = x[a * N + i]; if (!m) continue;
          const move = m * (1 - RESTART);
          if (wsum[i] <= 0) { lost += move; continue; }
          sw[i] += move * SWITCH;
          const st = move * (1 - SWITCH), d0 = off[i], d1 = off[i + 1];
          if (d1 === d0) { lost += st; continue; }
          const dv = st / (d1 - d0); for (let k = d0; k < d1; k++) nx[a * N + nb[k]] += dv;
        }
      }
      // the switched mass moves to the layers of its gene by weight, then steps to a neighbour there
      for (let i = 0; i < N; i++) {
        if (!sw[i]) continue;
        for (let a = 0; a < A; a++) {
          const l = act[a]; if (!deg(i, l)) continue;
          const { off, nb } = ADJ[l], d0 = off[i], d1 = off[i + 1], dv = sw[i] * w[l] / wsum[i] / (d1 - d0);
          for (let k = d0; k < d1; k++) nx[a * N + nb[k]] += dv;
        }
      }
      let diff = 0;
      for (let k = 0; k < nx.length; k++) { const v = nx[k] + (RESTART + lost) * p0[k]; diff += Math.abs(v - x[k]); nx[k] = v; }
      const tmp = x; x = nx; nx = tmp;
      if (diff < 1e-9) break;
    }
    const score = new Float64Array(N);
    for (let a = 0; a < A; a++) for (let i = 0; i < N; i++) score[i] += x[a * N + i];
    const seedSet = new Set(seeds); let mx = 0;
    for (let i = 0; i < N; i++) if (!seedSet.has(i)) mx = Math.max(mx, score[i]);
    for (let i = 0; i < N; i++) heat[i] = seedSet.has(i) ? 1 : mx > 0 ? Math.min(254 / 255, (254 / 255) * Math.sqrt(score[i] / mx)) : 0;
    for (let i = 0; i < N; i++) if (!seedSet.has(i) && score[i] > 1e-12) top.push(i);
    top.sort((a, b) => heat[b] - heat[a] || a - b);
    lastWalk = { seeds, w: Array.from(w), id: ++walkId };
    return { heat, top, weights: Array.from(w) };
  }
  let lastWalk = null, walkId = 0;

  // walkers: ~20 sparks with planned, seeded paths. Events: 0 hop along a link, 1 switch layer along the thread,
  // 2 restart (flash back to a seed)
  let plan = null, planKey = '';
  function makePlan(seeds, w, member, key) {
    const R = rng(9001 + key.length * 131 + seeds.length * 7 + (seeds[0] || 0));
    const pickL = i => { let t = 0; for (let l = 0; l < LN; l++) if (w[l] > 0 && deg(i, l)) t += w[l]; if (t <= 0) return -1;
      let x = R() * t; for (let l = 0; l < LN; l++) if (w[l] > 0 && deg(i, l)) { x -= w[l]; if (x <= 0) return l; } return -1; };
    const nbrs = (i, l) => { const { off, nb } = ADJ[l], o = []; for (let k = off[i]; k < off[i + 1]; k++) if (!member || member[nb[k]]) o.push(nb[k]); return o; };
    const starts = seeds.filter(s => pickL(s) >= 0);
    if (!starts.length) return null;
    const out = [];
    for (let k = 0; k < NW; k++) {
      let a = starts[Math.floor(R() * starts.length)], la = pickL(a), t = 0;
      const ev = [];
      for (let n = 0; n < 48; n++) {
        if (n > 0 && R() < RESTART) {
          const b = starts[Math.floor(R() * starts.length)], lb = pickL(b);
          ev.push([a, la, b, lb, 2, t, 0.32]); t += 0.32; a = b; la = lb; continue;
        }
        if (R() < SWITCH) { const lb = pickL(a); if (lb >= 0 && lb !== la) { ev.push([a, la, a, lb, 1, t, 0.38]); t += 0.38; la = lb; } }
        const nb = nbrs(a, la);
        if (!nb.length) { const b = starts[Math.floor(R() * starts.length)], lb = pickL(b); ev.push([a, la, b, lb, 2, t, 0.32]); t += 0.32; a = b; la = lb; continue; }
        const b = nb[Math.floor(R() * nb.length)];
        ev.push([a, la, b, la, 0, t, 0.55]); t += 0.55; a = b;
      }
      out.push({ ev, T: t, ph: R() * t });
    }
    return out;
  }
  function ensurePlan(g, live) {
    const key = live && lastWalk ? 'w' + lastWalk.id : 'g' + g;
    if (key === planKey) return plan;
    planKey = key;
    if (live && lastWalk) plan = makePlan(lastWalk.seeds, lastWalk.w, null, key);
    else if (g >= 0) { const m = new Uint8Array(N); for (const i of MEM[g]) m[i] = 1; plan = makePlan(SEEDS[g], defaultWeights(g, null), m, key); }
    else plan = null;
    return plan;
  }
  function walkerAt(wk, tt) {
    const T = wk.T; tt = ((tt % T) + T) % T;
    let lo = 0, hi = wk.ev.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (wk.ev[m][5] <= tt) lo = m; else hi = m - 1; }
    const [a, la, b, lb, kind, t0, du] = wk.ev[lo], f = clamp((tt - t0) / du, 0, 1);
    const pa = genePos(a), pb = genePos(b);
    if (kind === 2) return { p: f < 0.5 ? [pa[0], LYC[la], pa[1]] : [pb[0], LYC[lb], pb[1]], kind, f, ev: lo };
    const e = smooth(f);
    return { p: [lerp(pa[0], pb[0], e), lerp(LYC[la], LYC[lb], e), lerp(pa[1], pb[1], e)], kind, f, ev: lo };
  }

  // ---------------------------------------------------------------- explore state
  const state = { group: -1, gene: -1, pick: [], off: new Set(), heat: null, walk: false };
  let pending = null, heatId = 0;
  function setState(p) {
    pending = Object.assign(pending || {}, p || {});
    if (p && 'heat' in p) pending.heatId = ++heatId;
  }
  const offT = new Float64Array(LN).fill(-1e9), offOn = new Uint8Array(LN);
  let sig = null, tChange = 0, lastT = 0;
  // drop order: a fixed random order, the last five are protein layers (so the module has somewhere to stay lit)
  const DROP = (() => {
    const R = rng(1645), sh = a => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
    const keep = sh(D.ppi.slice()).slice(0, 5), rest = sh([...Array(LN).keys()].filter(l => !keep.includes(l)));
    const o = new Int16Array(LN); rest.concat(keep).forEach((l, k) => { o[l] = k; }); return o;
  })();
  const zOf = (g, l) => (g >= 0 && PPI_OF[l] >= 0 && GR[g].z ? GR[g].z[PPI_OF[l]] : undefined);
  const cur = { group: -1, t: 0, S: null };

  // ---------------------------------------------------------------- update
  const NEU = NEUTRAL, CC = {}; for (const c in CATC) CC[c] = rgb(CATC[c]);
  function update(S, t) {
    if (pending) {
      const p = pending; pending = null;
      if ('group' in p) state.group = p.group === null || p.group === undefined ? -1 : p.group | 0;
      if ('gene' in p) state.gene = p.gene === null || p.gene === undefined ? -1 : p.gene | 0;
      if ('pick' in p) state.pick = (p.pick || []).map(x => [x[0] | 0, x[1] | 0]);
      if ('heat' in p) { state.heat = p.heat || null; state.heatId = p.heatId; }
      if ('walk' in p) state.walk = !!p.walk;
      if ('off' in p) {
        const nu = new Set(p.off ? [...p.off].map(Number) : []);
        for (let l = 0; l < LN; l++) { const v = nu.has(l) ? 1 : 0; if (v !== offOn[l]) { offOn[l] = v; offT[l] = t; } }
        state.off = nu;
      }
    }
    if (t < lastT - 0.5) { tChange = Math.min(tChange, t - 10); for (let l = 0; l < LN; l++) offT[l] = Math.min(offT[l], t - 10); }
    lastT = t;
    // the selection: explore state wins over the params
    const g = state.group >= 0 && state.group < GN ? state.group : clamp(Math.round(S.tower_group || 0), 0, GN) - 1;
    const eff = { group: g, gene: state.gene, pick: state.pick, heat: state.heat };
    const s2 = [g, state.gene, JSON.stringify(state.pick), state.heat ? state.heatId : 0].join('|');
    if (sig === null) { writeSlot(1, eff); shiftSlots(); sig = s2; tChange = t - 10; }
    else if (s2 !== sig) { shiftSlots(); writeSlot(1, eff); sig = s2; tChange = t; }
    const X = clamp((t - tChange) / 0.7, 0, 1);
    TU.uX.value = smooth(X);
    const P = smooth(clamp(S.tower_pair, 0, 1)), Z = clamp(S.tower_z, 0, 1) * (1 - P);
    TU.uSeeds.value = clamp(S.tower_seeds, 0, 1); TU.uHeat.value = clamp(S.tower_heat, 0, 1); TU.uModule.value = clamp(S.tower_module, 0, 1);
    TU.uEndo.value = clamp(S.tower_endo, 0, 1); TU.uGrid.value = smooth(clamp(S.tower_grid, 0, 1)) * (1 - P); TU.uPair.value = P;
    TU.uSeedOnly.value = clamp(S.tower_seedonly, 0, 1); TU.uRoom.value = smooth(clamp(S.tower_room, 0, 1)); TU.uDrop.value = clamp(S.tower_drop, 0, 1);
    TU.uZ.value = Z; TU.uWalk.value = Math.max(clamp(S.tower_walk, 0, 1), state.walk ? 1 : 0) * (1 - P);
    const g0 = slotInfo[0] ? slotInfo[0].group : -1, g1 = g, XX = TU.uX.value;
    // layers
    const rise = clamp(S.tower_rise === undefined ? 1 : S.tower_rise, 0, 1), catsT = clamp(S.tower_cats, 0, 1), drop = TU.uDrop.value;
    const gcol = g1 >= 0 ? GC[g1] : [1, 1, 1], Gr = TU.uGrid.value;
    // a block's layers lie on top of each other on screen: links are weighted by the live layers of their block, so
    // the stack never burns out (and the few layers left at the end of the drop shine brighter)
    const LF0 = LFr, liveCat = {};
    for (let l = 0; l < LN; l++) {
      const fb = (LN - 1 - l) / LN, f = smooth(clamp((rise * 1.12 - fb) / 0.12, 0, 1));
      const df = smooth(clamp(drop * (LN - 5) - DROP[l], 0, 1));
      const ofF = offOn[l] ? smooth((t - offT[l]) / 0.5) : 1 - smooth((t - offT[l]) / 0.5);
      LF0[3 * l] = f; LF0[3 * l + 1] = df; LF0[3 * l + 2] = ofF;
      if (hasData[l]) liveCat[LAY[l].cat] = (liveCat[LAY[l].cat] || 0) + f * (1 - df) * (1 - ofF);
    }
    for (let l = 0; l < LN; l++) {
      const fb = (LN - 1 - l) / LN, f = LF0[3 * l], df = LF0[3 * l + 1], ofF = LF0[3 * l + 2];
      // z: cross-fades with the selection
      const z0 = zOf(g0, l), z1 = zOf(g1, l), zv = lerp(z0 === undefined ? 0 : z0, z1 === undefined ? 0 : z1, XX);
      const has0 = z0 !== undefined, has1 = z1 !== undefined, hasZ = lerp(has0 ? 1 : 0, has1 ? 1 : 0, XX);
      const zn = clamp(zv / 8, 0, 1), inf = zv >= ZMIN ? 1 : 0;
      const pg = PAIR_GLOW[l] * P;
      const ry = lerp(LY[l], flatY(l), Gr), y = ry - 0.13 * df * (1 - 0.8 * Gr) - 0.1 * (1 - f);
      const live = f * (1 - df);
      const content = live * (1 - ofF);
      let rimA = live * (hasData[l] ? 0.3 : 0.2) * (1 - 0.55 * ofF);
      rimA *= 1 + Z * hasZ * (inf ? 0.2 + 1.6 * zn : -0.5);
      rimA *= 1 + pg * 2.2 - P * (1 - PAIR_GLOW[l]) * 0.25;
      rimA *= 1 - 0.82 * Gr;          // squashed together, 71 rims would make one glaring ring
      let fillA = live * (1 - ofF) * (hasData[l] ? 0.011 : 0.004) * (1 + 0.6 * catsT);
      fillA += live * (Z * hasZ * inf * zn * 0.007 + pg * 0.03);
      fillA *= 1 - 0.85 * Gr;
      const tint = CC[LAY[l].cat] || NEU, cm = 0.25 + 0.75 * catsT;
      let c = [lerp(NEU[0], tint[0], cm), lerp(NEU[1], tint[1], cm), lerp(NEU[2], tint[2], cm)];
      const zc = Z * hasZ * inf * (0.25 + 0.6 * zn); c = [lerp(c[0], gcol[0], zc), lerp(c[1], gcol[1], zc), lerp(c[2], gcol[2], zc)];
      if (pg > 0) c = [lerp(c[0], 1, pg * 0.35), lerp(c[1], 1, pg * 0.35), lerp(c[2], 1, pg * 0.35)];
      let lw = lerp(1, hasZ > 0.5 ? (inf ? 0.55 + 0.45 * zn / 0.6 : 0.3) : 1, Z);
      lw *= 1 + pg * 0.8 - P * (1 - PAIR_GLOW[l]) * 0.15;
      lw *= clamp(4 / Math.max(1, liveCat[LAY[l].cat] || 1), 0.18, 1);
      // bars rise up the tower one after another
      const grow = smooth(clamp((Z * 1.4 - fb * 0.4) / 1.0, 0, 1)) * hasZ;
      const o = l * 4;
      ltn.set([y, content, rimA, fillA], o);
      ltn.set([c[0], c[1], c[2], lw], LN * 4 + o);
      ltn.set([zv * BARS * grow, grow * live, ry, f], 2 * LN * 4 + o);
      ltn.set([hasData[l] ? 0 : 1, inf, clamp(9 / Math.max(1, liveCat[LAY[l].cat] || 1), 0.35, 1), 0], 3 * LN * 4 + o);
      LYC[l] = y; LCONT[l] = content;
    }
    let ch = false; for (let k = 0; k < ltn.length; k++) if (ltn[k] !== ltd[k]) { ch = true; break; }
    if (ch) { ltd.set(ltn); LT.needsUpdate = true; }
    barMat.uniforms.uC.value.setRGB(gcol[0], gcol[1], gcol[2]);
    bars.visible = Z > 0.003 && g1 >= 0;
    zline.visible = bars.visible; zlMat.opacity = 0.55 * Z * set.uA.value;
    threads.visible = true;
    // walkers
    const liveW = state.walk && lastWalk, wv = Math.max(clamp(S.tower_walk, 0, 1), state.walk ? 1 : 0) * (1 - P);
    walkers.visible = false;
    if (wv > 0.003 && (liveW || g1 >= 0)) {
      const pl = ensurePlan(g1, liveW);
      if (pl) {
        walkers.visible = true;
        const pa = wGeo.attributes.position.array, ca = wGeo.attributes.aCol.array, sa = wGeo.attributes.aSize.array, aa = wGeo.attributes.aA.array;
        const tint = liveW ? [0.6, 0.95, 1] : gcol;
        pl.forEach((wk, k) => {
          const h = walkerAt(wk, t + wk.ph);
          for (let j = 0; j < TR; j++) {
            const q = j ? walkerAt(wk, t + wk.ph - j * 0.045) : h, n = k * TR + j;
            // a trail never spans a restart
            const ok = j === 0 || (q.ev === h.ev && h.kind !== 2) || (q.ev === h.ev - 1 && q.kind !== 2 && h.kind !== 2);
            pa[3 * n] = q.p[0]; pa[3 * n + 1] = q.p[1] + 0.004; pa[3 * n + 2] = q.p[2];
            const fl = h.kind === 2 && h.f >= 0.5 && j === 0 ? 1 - (h.f - 0.5) * 2 : 0;
            const fade = h.kind === 2 && h.f < 0.5 && j === 0 ? 1 - h.f * 2 : 1;
            const cl = j === 0 ? [1, 0.97, 0.88] : tint;
            ca.set(cl, 3 * n);
            sa[n] = j === 0 ? 0.05 + 0.07 * fl : 0.036 * (1 - 0.7 * j / TR);
            aa[n] = (ok ? (j === 0 ? 1 : 0.75 * (1 - j / TR)) : 0) * wv * fade;
          }
        });
        for (const a of ['position', 'aCol', 'aSize', 'aA']) wGeo.attributes[a].needsUpdate = true;
      }
    }
    // the ringed gene in every layer
    geneRing.visible = state.gene >= 0 && state.gene < N;
    if (geneRing.visible) {
      const xz = genePos(state.gene), pa = ringPts.attributes.position.array;
      for (let l = 0; l < LN; l++) {
        pa[3 * l] = xz[0]; pa[3 * l + 1] = LYC[l]; pa[3 * l + 2] = xz[1];
        ringPts.attributes.aCol.array.set([1, 0.93, 0.75], 3 * l);
        ringPts.attributes.aSize.array[l] = PRES[state.gene * LN + l] ? 0.055 : 0.035;
        ringPts.attributes.aA.array[l] = LCONT[l] * (PRES[state.gene * LN + l] ? 1 : 0.35) * TU.uX.value;
      }
      for (const a of ['position', 'aCol', 'aSize', 'aA']) ringPts.attributes[a].needsUpdate = true;
    }
    cur.group = g1; cur.t = t; cur.S = S;
  }

  // ---------------------------------------------------------------- explore API helpers
  function pick(origin, dir) {
    const A = v => (Array.isArray(v) ? v : [v.x, v.y, v.z]), o = A(origin), d0 = A(dir), dl = Math.hypot(d0[0], d0[1], d0[2]) || 1;
    const d = [d0[0] / dl, d0[1] / dl, d0[2] / dl];
    let best = -1, bs = 1e9;
    const vis = new Float32Array(N), xz = new Float32Array(2 * N);
    for (let i = 0; i < N; i++) { vis[i] = geneVis(i); const p = genePos(i); xz[2 * i] = p[0]; xz[2 * i + 1] = p[1]; }
    for (let l = 0; l < LN; l++) {
      if (LCONT[l] < 0.2) continue;
      const y = LYC[l];
      for (let i = 0; i < N; i++) {
        if (!PRES[i * LN + l] || vis[i] * LCONT[l] < 0.2) continue;
        const wx = xz[2 * i] - o[0], wy = y - o[1], wz = xz[2 * i + 1] - o[2], tt = wx * d[0] + wy * d[1] + wz * d[2];
        if (tt <= 0) continue;
        const px = wx - d[0] * tt, py = wy - d[1] * tt, pz = wz - d[2] * tt, perp = Math.hypot(px, py, pz), tol = 0.008 + 0.012 * tt;
        if (perp > tol) continue;
        const sc = perp / tol + tt * 0.02 - vis[i] * 0.2;
        if (sc < bs) { bs = sc; best = i; }
      }
    }
    return best;
  }
  function linksOf(i) {
    const out = [];
    if (!(i >= 0 && i < N)) return out;
    for (let l = 0; l < LN; l++) {
      const { off, nb } = ADJ[l]; if (off[i + 1] === off[i]) continue;
      out.push({ layer: l, key: LAY[l].key, name: LAY[l].name, cat: LAY[l].cat, partners: Array.from(nb.subarray(off[i], off[i + 1])).sort((a, b) => a - b) });
    }
    return out;
  }
  function linkStats(pk) {
    pk = (pk || state.pick || []).slice(0, 8);
    const n = pk.length, mask = new Uint16Array(N);
    for (let i = 0; i < N; i++) pk.forEach(([g, c], k) => { if (g >= 0 && g < GN && genes[i].endo[g] === c) mask[i] |= 1 << k; });
    const sizes = pk.map((_, k) => { let s = 0; for (let i = 0; i < N; i++) if (mask[i] >> k & 1) s++; return s; });
    const layers = [];
    const tw = new Array(n).fill(0), tb = {};
    for (let l = 0; l < LN; l++) {
      const arr = LL[l], within = new Array(n).fill(0), bt = {};
      for (let k = 0; k < arr.length; k += 2) {
        const ma = mask[arr[k]], mb = mask[arr[k + 1]];
        if (!ma || !mb) continue;
        for (let p = 0; p < n; p++) {
          if ((ma >> p & 1) && (mb >> p & 1)) within[p]++;
          for (let q = p + 1; q < n; q++) if (((ma >> p & 1) && (mb >> q & 1)) || ((ma >> q & 1) && (mb >> p & 1))) bt[p + ',' + q] = (bt[p + ',' + q] || 0) + 1;
        }
      }
      const between = Object.keys(bt).map(k => { const [p, q] = k.split(',').map(Number); tb[k] = (tb[k] || 0) + bt[k]; return [p, q, bt[k]]; });
      within.forEach((v, p) => { tw[p] += v; });
      layers.push({ layer: l, key: LAY[l].key, name: LAY[l].name, cat: LAY[l].cat, within, between });
    }
    return { pick: pk, sizes, layers, total: { within: tw, between: Object.keys(tb).map(k => { const [p, q] = k.split(',').map(Number); return [p, q, tb[k]]; }) } };
  }

  // ---------------------------------------------------------------- anchors
  const centroid = (mem, y) => {
    if (!mem || !mem.length) return [0, y, 0];
    let x = 0, z = 0; for (const i of mem) { const p = genePos(i); x += p[0]; z += p[1]; }
    return [x / mem.length, y, z / mem.length];
  };
  const layerIdx = k => (typeof k === 'number' ? clamp(k | 0, 0, LN - 1) : LI[k] !== undefined ? LI[k] : 0);
  const rimAt = (l, dir, r = 1.02) => {
    const P = U('uPair'), R = lerp(r, (PR + 0.03) * r, P);
    return [-PCX * P + R * dir[0], LYC[l] || LY[l], R * dir[1]];
  };
  const ppiY = () => (D.ppi.length ? LYC[D.ppi[0]] || PPI_TOP : 0) + 0.03;
  const anchors = {
    top: () => [0, LY[0] + 0.06, 0],
    bottom: () => [0, LY[LN - 1] - 0.04, 0],
    mid: [0, 0, 0],
    ppi: () => [0, blockMid('ppi'), 0],
    coex: () => [0, blockMid('coex'), 0],
    pheno: () => [0, blockMid('pheno'), 0],
    layer: k => rimAt(layerIdx(k), RIGHT),
    zbar: k => { const l = layerIdx(k), z = zOf(cur.group, l) || 0; const r = 1.015 + z * BARS; return [BAR[0] * r, LYC[l] || LY[l], BAR[1] * r]; },
    zline: () => [BAR[0] * zr, zTop + 0.02, BAR[1] * zr],
    group: g => centroid(MEM[g], blockMid('ppi')),
    endo: (g, c) => centroid(ENDO[g] && ENDO[g][c], ppiY()),
    gene: (i, layer) => { const p = genePos(i), l = layer === undefined ? (TOPL[i] >= 0 ? TOPL[i] : 0) : layerIdx(layer); return [p[0], LYC[l] || LY[l], p[1]]; },
    pairLeft: [-PCX, 0, 0], pairRight: [PCX, 0, 0], pairMid: [0, 0, 0],
  };

  // ---------------------------------------------------------------- labels
  const labels = [];
  const trunc = (s, n) => { if (s.length <= n) return s; const c = s.slice(0, n), k = c.lastIndexOf(' '); return (k > 8 ? c.slice(0, k) : c).replace(/[ ,.]+$/, '') + '…'; };
  const endoOn = S => Math.max(prog(S.tower_endo, 0.5, 0.7), prog(S.tower_grid, 0.5, 0.7));
  // category names on the right rim, spread so the small blocks at the top do not overlap
  { const ys = cats.map(c => c.y), lab = ys.slice();
    for (let k = lab.length - 2; k >= 0; k--) lab[k] = Math.max(lab[k], lab[k + 1] + 0.15);
    cats.forEach((c, k) => {
      const n = c.ls.length;
      labels.push({ text: [CATN[c.cat] || c.cat, `${n} layer${n === 1 ? '' : 's'}`], cls: CATL[c.cat] || '',
        at: () => { const p = rimAt(c.ls[Math.floor(n / 2)], RIGHT, 1.05); p[1] = lab[k] + (LYC[c.ls[0]] - LY[c.ls[0]]); return p; },
        alpha: S => prog(S.tower_cats, 0.5, 0.7) * (1 - prog(S.tower_pair, 0.1, 0.4)) * (1 - prog(S.tower_z, 0.1, 0.4)) * (1 - endoOn(S)) * prog(S.tower_rise === undefined ? 1 : S.tower_rise, 0.85, 1) });
    }); }
  const selOf = () => cur.group;
  GR.forEach((G, g) => {
    labels.push({ text: [G.short, `${MEM[g].length} genes, ${SEEDS[g].length} seeds`], cls: '', at: () => [0, LY[0] + 0.12, 0],
      alpha: S => (selOf() === g ? TU.uX.value : 0) * (1 - prog(S.tower_pair, 0.05, 0.3)) * (1 - prog(S.tower_room, 0.2, 0.5)) });
    const big = G.endo.slice().sort((a, b) => b.n - a.n || a.c - b.c).slice(0, 6);
    // in the tower the endotypes overlap on screen: their names stack up the right rim as a legend
    const endoA = S => (selOf() === g ? TU.uX.value : 0) * endoOn(S) * (1 - prog(S.tower_pair, 0.05, 0.3)) * (state.pick.length ? 0.4 : 1);
    big.forEach((e, k) => labels.push({ text: [String(e.c), '· ' + trunc(e.name || 'Endotype', 28)], cls: '',
      at: () => { const r = rimAt(D.ppi[0] || 0, RIGHT, 1.06); return [r[0], PPI_TOP + 0.08 + (big.length - 1 - k) * 0.13, r[2]]; },
      alpha: S => endoA(S) * (1 - prog(U('uGrid'), 0.2, 0.6)) }));
    // in the grid they sit just behind their blocks (above them on screen); blocks named in the same row step down a
    // little one after another, so neighbouring names do not run into each other
    big.forEach((e, k) => labels.push({ text: [String(e.c), '· ' + trunc(e.name || 'Endotype', 17)], cls: '',
      at: () => { const a = anchors.endo(g, e.c), C = GRIDC[g] && GRIDC[g][e.c];
        if (!C) return a;
        const j = big.filter(b => GRIDC[g][b.c] && GRIDC[g][b.c][2] === C[2] && GRIDC[g][b.c][0] < C[0]).length;
        return [a[0] - 0.4 * C[3], (LYC[0] || LY[0]) + 0.02, a[2] - C[3] * (0.48 - 0.3 * j)]; },
      alpha: S => endoA(S) * prog(U('uGrid'), 0.6, 0.9) }));
  });
  const pairA = S => prog(S.tower_pair, 0.7, 0.95);
  if (GR[PGL] && GR[PGR]) labels.push(
    { text: [GR[PGL].short, `${MEM[PGL].length} genes`], cls: 'cyn', at: () => [-PCX - PR - 0.04, LY[0] + 0.15, 0], alpha: pairA },
    { text: [GR[PGR].short, `${MEM[PGR].length} genes`], cls: 'mag', at: () => [PCX - PR * 0.55, LY[0] + 0.15, 0], alpha: pairA },
    { text: ['In both', `${BOTH.length} genes`], cls: 'amb', at: () => [0.03, LY[LN - 1] - 0.1, 0.45], alpha: pairA });
  // the glowing layers' names on the right of the right tower, spread apart where layers sit close together
  { const ly = GLOW_KEYS.map(k => LY[LI[k]]), lab = ly.slice();
    for (let k = 1; k < lab.length; k++) lab[k] = Math.min(lab[k], lab[k - 1] - 0.17);
    GLOW_KEYS.forEach((k, j) => {
      const L = LAY[LI[k]], m = /^(.*?)\s*\((.*)\)$/.exec(L.name);
      const rest = m ? m[2] : L.cat === 'coex' ? 'co-expression' : L.cat === 'ppi' ? 'interactions' : '';
      labels.push({ text: [m ? m[1] : L.name, rest], cls: CATL[L.cat] || '',
        at: () => [PCX + PR + 0.06, lab[j] + (LYC[LI[k]] - LY[LI[k]]), 0], alpha: pairA });
    }); }

  // ---------------------------------------------------------------- views, params, controls
  const cam = {
    default: [24, 16, 5.6, 0, -0.03, 0],
    ppi: [30, 20, 2.9, 0, blockMid('ppi'), 0],
    top: [24, 86, 3.7, 0, 0, 0],
    side: [90, 1, 4.6, 0, 0, 0],
    grid: [15, 64, 3.8, 0, blockMid('ppi') + 0.05, 0],
    z: [-20, 10, 3.6, BAR[0] * 0.55, blockMid('ppi') + 0.05, BAR[1] * 0.55],
    pair: [0, 12, 5.4, 0.18, 0, 0],
    inside: [0, 30, 0.95, 0, -0.75, -0.8],
  };
  const params = { tower_a: 1, tower_rise: 1, tower_cats: 0.4, tower_group: 0, tower_seeds: 0, tower_walk: 0, tower_heat: 0,
    tower_module: 0, tower_z: 0, tower_endo: 0, tower_grid: 0, tower_pair: 0, tower_seedonly: 0, tower_drop: 0, tower_room: 0 };
  const controls = [
    { key: 'view', label: 'View', options: [['tower', 'Tower'], ['grid', 'Endotype grid'], ['pair', 'Two groups'], ['room', 'Room']] },
    { key: 'colour', label: 'Colour', options: [['groups', 'Groups'], ['endo', 'Endotypes'], ['heat', 'Walk heat']] },
    { key: 'show', label: 'Show', options: [['module', 'Module'], ['seeds', 'Seeds'], ['walk', 'Walk'], ['z', 'Layer scores'], ['drop', 'Robustness']] },
  ];
  function explore(c) {
    const o = Object.assign({}, params), t = c.t || 0;
    delete o.tower_a;
    o.tower_cats = c.view === 'tower' ? 0.6 : 0.4;
    if (c.view === 'grid') o.tower_grid = 1;
    if (c.view === 'pair') o.tower_pair = 1;
    if (c.view === 'room') o.tower_room = 1;
    if (c.colour === 'endo') o.tower_endo = 1;
    if (c.colour === 'heat') o.tower_heat = 1;
    // seeds first, then the walk's genes join the module one by one
    if (c.show === 'seeds') { o.tower_seeds = 1; o.tower_module = clamp((t - 2) / 10, 0, 1); if (c.view === 'pair') o.tower_seedonly = 1; }
    if (c.show === 'walk') { o.tower_walk = 1; o.tower_heat = Math.max(o.tower_heat, clamp((t - 3) / 6, 0, 1)); }
    if (c.show === 'z') o.tower_z = 1;
    if (c.show === 'drop') o.tower_drop = clamp((t - 1) / 14, 0, 1);
    return o;
  }

  // first frame state so that the API works before any update
  writeSlot(1, { group: -1, gene: -1, pick: [], heat: null }); shiftSlots();
  for (let l = 0; l < LN; l++) { LYC[l] = LY[l]; LCONT[l] = 1; }

  const groups = GR.map((G, g) => Object.assign({}, G, { index: g, members: MEM[g].length, seedGenes: SEEDS[g].slice(),
    informative: G.z.filter(z => z >= ZMIN).length }));
  const layers = LAY.map((L, l) => Object.assign({}, L, { index: l, links: LC[l], genes: (() => { let s = 0; for (let i = 0; i < N; i++) s += PRES[i * LN + l]; return s; })(), y: LY[l] }));
  return Object.assign(set, {
    params, update, anchors, labels, cam, controls, explore,
    genes, groups, layers, ppi: D.ppi.slice(), N, edgeCount, pairs: EW.length / 2,
    endoCount: GR.reduce((s, G) => s + G.endo.length, 0), endoColour, state, setState, walk, pick, links: linksOf, linkStats,
    members: g => (MEM[g] || []).slice(), seeds: g => (SEEDS[g] || []).slice(), endoGenes: (g, c) => ((ENDO[g] && ENDO[g][c]) || []).slice(),
    heatOf: g => (HEAT[g] ? HEAT[g].slice() : null), genePos,
    pair: { left: PGL, right: PGR, both: BOTH.slice(), endo: pairEndo, glow: GLOW_KEYS.slice(), shareMin: SHARE_MIN },
    zMin: ZMIN, drop: Array.from(DROP),
  });
};

// The motor unit (slide 2 of the talk), from nerve to sarcomere, and the heart. Read from left to right: a short
// section of spinal cord (its axis along z, the cut face towards you; ventral points right, lateral points down)
// with a motor neuron in the anterior horn and a sensory neuron in a dorsal root ganglion; the ventral and dorsal
// roots join into the spinal nerve, whose myelinated axons (nodes of Ranvier between the sleeves) reach a fascicle
// of 20 striated muscle fibres; the motor axon branches to six neuromuscular junctions (its motor unit) and the
// sensory axon coils round a muscle spindle. One fibre opens to its myofibrils, and one myofibril's last sarcomere
// magnifies into a hexagonal lattice of actin, myosin (with heads) and titin between Z-discs, the M-band in the
// middle. Above floats a beating heart whose window shows the same striated muscle.
SETS.motor = function (K) {
  const { THREE, clamp, lerp, prog, smooth, rng, v3 } = K;
  const set = K.newSet('motor');
  const PI = Math.PI, TAU = 2 * PI;
  const R = rng(2026);

  // ------------------------------------------------------------------ disease groups by site (from the data)
  const GR = NMD_DATA.groups;
  const SITES = ['neuron', 'nerve', 'junction', 'muscle', 'heart'];   // motor_site 1..5
  const SCOL = SITES.map(s => GR.filter(g => g.site === s).map(g => K.rgb(g.col)));
  const sc = (k, i) => { const L = SCOL[k - 1]; return L.length ? L[i % L.length] : [0.9, 0.9, 0.9]; };
  const ncol = k => Math.max(1, SCOL[k - 1].length);

  // ------------------------------------------------------------------ shared uniforms
  // site slots: 1..5 the five sites; 6 and 7 the sarcomere's thin and thick parts (glow as muscle and heart,
  // dim only when neither is chosen, since skeletal and heart muscle share the sarcomere)
  const SU = {
    uTime: K.U.uTime, uBuildX: { value: 10 }, uSiteG: { value: [0, 0, 0, 0, 0, 0, 0, 0] }, uSiteD: { value: [1, 1, 1, 1, 1, 1, 1, 1] },
    uTw: { value: 0 }, uOpen: { value: 0 }, uOpenDir: { value: new THREE.Vector3(0, 0, 1) },
    uPh: { value: 0 }, uP: { value: 1.7 }, uSig: { value: 0 },
  };
  const VH = `
attribute float aSite; attribute vec3 aGC;
uniform float uSiteG[8], uSiteD[8], uBuildX, uTime;
varying float vGlow, vDim, vBX; varying vec3 vGC;`;
  const VT = `
{ int si = int(aSite + 0.5); vGlow = uSiteG[si]; vDim = uSiteD[si]; vGC = aGC; vBX = uBuildX - position.x; }`;
  const FH = `
uniform float uSelf, uRimK, uTint; uniform vec3 uRimC;
varying float vGlow, vDim, vBX; varying vec3 vGC;`;
  const FC = `
#ifdef BUILD
if (vBX < 0.0) discard;
#endif`;
  const FE = `
float rimF = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
totalEmissiveRadiance += diffuseColor.rgb * uSelf + uRimC * (uRimK * rimF * vDim) + vGC * (vGlow * (0.1 * uTint + 0.55 * rimF));
#ifdef BUILD
totalEmissiveRadiance += vec3(0.55, 0.9, 1.0) * smoothstep(0.035, 0.0, vBX) * 1.4;
#endif`;
  // the twitch of the motor unit's fibres (and what sits on them): shorter about the fascicle's middle, thicker
  const TWV = `
attribute vec4 aTwA; uniform float uTw, uOpen;`;
  // an impulse passing: the membrane lights up (aPT = 20 + the time it passes)
  const PLV = `
attribute float aPT; uniform float uPh, uP, uSig; varying float vPulse;`;
  const PLB = `
{ float d = uPh - (aPT - 20.0); d -= uP * floor(d / uP + 0.5); vPulse = aPT > 1.0 ? uSig * exp(-d * d / 0.0025) : 0.0; }`;
  const PLF = `varying float vPulse;`, PLE = `totalEmissiveRadiance += (diffuseColor.rgb * 1.3 + 0.22) * vPulse;`;
  const TWB = `
vec3 ax = aTwA.xyz; float tw = uTw * aTwA.w; vec3 rd = transformed - ax;`;
  const TWE = `
ax.x = 0.15 + (ax.x - 0.15) * (1.0 - 0.03 * tw);
transformed = ax + rd * (1.0 + 0.1 * tw);`;
  // a lit surface material with the set's hooks: build reveal along x, site glow (coloured light) and dimming, rim
  function lit(key, o = {}) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough === undefined ? 0.55 : o.rough, metalness: 0, side: o.side || THREE.FrontSide });
    K.fade(set, m, o.base === undefined ? 1 : o.base);
    if (o.build !== false) m.defines = { BUILD: '' };
    m.extensions = { derivatives: true };
    const un = Object.assign({ uSelf: { value: o.self === undefined ? 0.15 : o.self }, uRimK: { value: o.rimK === undefined ? 0.25 : o.rimK }, uTint: { value: o.tint === undefined ? 1 : o.tint },
      uRimC: { value: new THREE.Color(...(o.rimC || [0.6, 0.8, 1])) } }, o.uniforms || {});
    m.userData.u = un;
    m.customProgramCacheKey = () => 'motor-' + key;
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, SU, un);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + VH + (o.vh || ''))
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);\n' + (o.vb || '') + '\n' + VT);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + FH + (o.fh || ''))
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + FC + '\n' + (o.fc || ''))
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (o.fcol || '') + '\ndiffuseColor.rgb *= vDim;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vGC * (0.35 + 0.65 * vDim), clamp(0.45 * vGlow * uTint, 0.0, 0.55));')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + FE + '\n' + (o.fe || ''));
    };
    return m;
  }
  // opacity on top of the set's fade (setAlpha runs before update every frame)
  function show(mat, mesh, k) {
    const b = mat.userData.base, o = b * set.uA.value * k;
    mat.opacity = o; mat.depthWrite = o > 0.97 && b > 0.97; mesh.visible = k > 0.003;
  }

  // ------------------------------------------------------------------ geometry helpers
  const V = a => new THREE.Vector3(a[0], a[1], a[2]);
  // a tube through pts (CatmullRom) whose radius r(u) varies; adds aAxis (ring centre) and aU (0..1 along)
  function tubeR(pts, seg, rad, r, closed) {
    const curve = new THREE.CatmullRomCurve3(pts.map(V), !!closed);
    const fr = curve.computeFrenetFrames(seg, !!closed);
    const nv = (seg + 1) * (rad + 1), P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), A = new Float32Array(nv * 3), U = new Float32Array(nv);
    const c = new THREE.Vector3(), idx = [];
    let o = 0;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg; curve.getPointAt(closed && i === seg ? 0 : u, c);
      const rr = typeof r === 'function' ? r(u) : r, nn = fr.normals[i % (closed ? seg : seg + 1)], bb = fr.binormals[i % (closed ? seg : seg + 1)];
      for (let j = 0; j <= rad; j++) {
        const a = j / rad * TAU, cs = -Math.cos(a), sn = Math.sin(a);
        const nx = cs * nn.x + sn * bb.x, ny = cs * nn.y + sn * bb.y, nz = cs * nn.z + sn * bb.z;
        P[o * 3] = c.x + rr * nx; P[o * 3 + 1] = c.y + rr * ny; P[o * 3 + 2] = c.z + rr * nz;
        N[o * 3] = nx; N[o * 3 + 1] = ny; N[o * 3 + 2] = nz;
        A[o * 3] = c.x; A[o * 3 + 1] = c.y; A[o * 3 + 2] = c.z; U[o] = u; o++;
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = (i + 1) * (rad + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('aAxis', new THREE.BufferAttribute(A, 3)); g.setAttribute('aU', new THREE.BufferAttribute(U, 1));
    g.setIndex(idx); g.userData.curve = curve;
    return g;
  }
  // a closed surface f(u, v) -> [x, y, z], u 0..1 pole to pole, v 0..1 around; smooth normals across the seam
  function surf(nu, nv, f) {
    const P = [], idx = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) P.push(...f(i / nu, (j % nv) / nv));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setIndex(idx); g.computeVertexNormals();
    const n = g.attributes.normal.array, avg = list => { const s = [0, 0, 0]; for (const k of list) for (let c = 0; c < 3; c++) s[c] += n[k * 3 + c]; const l = Math.hypot(...s) || 1; for (const k of list) for (let c = 0; c < 3; c++) n[k * 3 + c] = s[c] / l; };
    for (let i = 0; i <= nu; i++) avg([i * (nv + 1), i * (nv + 1) + nv]);
    avg([...Array(nv + 1).keys()]); avg([...Array(nv + 1).keys()].map(j => nu * (nv + 1) + j));
    return g;
  }
  // collects many geometries into one indexed geometry with the attributes in spec ({ name: size });
  // vals give each attribute a constant, a function (x, y, z, i) of the (transformed) vertex, or nothing (then the
  // geometry's own attribute of that name, or zeros); m an optional Matrix4 applied on the way
  function Builder(spec) {
    // adds are queued and written into typed arrays once, in geo()
    const B = { items: [], n: 0, ni: 0 }, keys = Object.keys(spec), nm = new THREE.Matrix3();
    B.add = (geo, vals = {}, m) => { B.items.push([geo, vals, m]); B.n += geo.attributes.position.count; B.ni += geo.index ? geo.index.array.length : geo.attributes.position.count; };
    B.geo = () => {
      const PP = new Float32Array(B.n * 3), NN = new Float32Array(B.n * 3), II = B.n > 65535 ? new Uint32Array(B.ni) : new Uint16Array(B.ni);
      const AA = keys.map(k => new Float32Array(B.n * spec[k]));
      let o = 0, oi = 0;
      for (const [geo, vals, m] of B.items) {
        const P = geo.attributes.position.array, N = geo.attributes.normal.array, cnt = geo.attributes.position.count, base = o;
        const hs = keys.map((k, h) => {
          const v = vals[k], sz = spec[k], ga = geo.attributes[k];
          if (typeof v === 'function') return [1, v, sz, AA[h]];
          if (v === undefined) return ga && ga.itemSize === sz ? [2, ga.array, sz, AA[h]] : [0, null, sz, AA[h]];
          return [3, typeof v === 'number' ? [v] : v, sz, AA[h]];
        });
        const e = m ? m.elements : null, q = m ? nm.getNormalMatrix(m).elements : null;
        for (let i = 0; i < cnt; i++, o++) {
          let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
          if (e) {
            const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14];
            x = X; y = Y; z = Z;
            const a = q[0] * nx + q[3] * ny + q[6] * nz, b = q[1] * nx + q[4] * ny + q[7] * nz, c = q[2] * nx + q[5] * ny + q[8] * nz, l = Math.hypot(a, b, c) || 1;
            nx = a / l; ny = b / l; nz = c / l;
          }
          PP[o * 3] = x; PP[o * 3 + 1] = y; PP[o * 3 + 2] = z; NN[o * 3] = nx; NN[o * 3 + 1] = ny; NN[o * 3 + 2] = nz;
          for (let h = 0; h < hs.length; h++) {
            const H = hs[h], kind = H[0], v = H[1], sz = H[2], arr = H[3], w = o * sz;
            if (kind === 3) for (let c = 0; c < sz; c++) arr[w + c] = v[c];
            else if (kind === 2) for (let c = 0; c < sz; c++) arr[w + c] = v[i * sz + c];
            else if (kind === 1) { const r = v(x, y, z, i); if (sz === 1) arr[w] = +r; else for (let c = 0; c < sz; c++) arr[w + c] = r[c]; }
          }
        }
        if (geo.index) { const ix = geo.index.array; for (let i = 0; i < ix.length; i++) II[oi++] = ix[i] + base; }
        else for (let i = 0; i < cnt; i++) II[oi++] = base + i;
      }
      B.items = null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(PP, 3)); g.setAttribute('normal', new THREE.BufferAttribute(NN, 3));
      keys.forEach((k, h) => g.setAttribute(k, new THREE.BufferAttribute(AA[h], spec[k])));
      g.setIndex(new THREE.BufferAttribute(II, 1));
      g.computeBoundingSphere();
      return g;
    };
    return B;
  }
  // a fast tube along an explicit centre line f(u), u 0..1 (frames by parallel transport), radius r(u) or r(u, angle);
  // returns a plain geometry-like object for Builder.add
  function tubeFn(f, seg, rad, r) {
    const nv = (seg + 1) * (rad + 1), P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), A = new Float32Array(nv * 3), U = new Float32Array(nv);
    const idx = new Uint32Array(seg * rad * 6), cs = [], sn = [];
    for (let j = 0; j <= rad; j++) { cs.push(-Math.cos(j / rad * TAU)); sn.push(Math.sin(j / rad * TAU)); }
    let nr = null, o = 0;
    const C = []; for (let i = 0; i <= seg; i++) C.push(f(i / seg));
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, c = C[i], t = v3.norm(v3.sub(C[Math.min(seg, i + 1)], C[Math.max(0, i - 1)]));
      if (!nr) nr = v3.norm(v3.cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      else nr = v3.norm(v3.sub(nr, v3.mul(t, v3.dot(nr, t))));
      const bn = v3.cross(t, nr), r2 = typeof r === 'function' && r.length > 1, r1 = r2 ? 0 : typeof r === 'function' ? r(u) : r;
      for (let j = 0; j <= rad; j++) {
        const rr = r2 ? r(u, j / rad * TAU) : r1;
        const nx = cs[j] * nr[0] + sn[j] * bn[0], ny = cs[j] * nr[1] + sn[j] * bn[1], nz = cs[j] * nr[2] + sn[j] * bn[2];
        P[o * 3] = c[0] + rr * nx; P[o * 3 + 1] = c[1] + rr * ny; P[o * 3 + 2] = c[2] + rr * nz;
        N[o * 3] = nx; N[o * 3 + 1] = ny; N[o * 3 + 2] = nz;
        A[o * 3] = c[0]; A[o * 3 + 1] = c[1]; A[o * 3 + 2] = c[2]; U[o] = u; o++;
      }
    }
    let k = 0;
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx[k++] = a; idx[k++] = b; idx[k++] = a + 1; idx[k++] = b; idx[k++] = b + 1; idx[k++] = a + 1; }
    const at = (array, itemSize) => ({ array, itemSize, count: array.length / itemSize });
    return { attributes: { position: at(P, 3), normal: at(N, 3), aAxis: at(A, 3), aU: at(U, 1) }, index: { array: idx } };
  }
  // matrix mapping the unit cylinder (y -0.5..0.5, radius 1) onto a strut from a to b of radius r
  function strutM(a, b, r) {
    const d = v3.sub(b, a), L = v3.len(d), y = v3.norm(d);
    const x = v3.norm(Math.abs(y[0]) < 0.9 ? v3.cross(y, [1, 0, 0]) : v3.cross(y, [0, 1, 0])), z = v3.cross(x, y);
    const m = new THREE.Matrix4();
    m.makeBasis(V(v3.mul(x, r)), V(v3.mul(y, L)), V(v3.mul(z, r)));
    m.setPosition(...v3.mul(v3.add(a, b), 0.5));
    return m;
  }
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true), CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  // a smooth octahedron (6 vertices): stretched, it makes a myosin head
  const OCT = (() => { const d = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].flat(), A = a => ({ array: new Float32Array(a), itemSize: 3, count: 6 });
    return { attributes: { position: A(d), normal: A(d) }, index: { array: [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 4, 2, 1, 3, 4, 1, 5, 3, 1, 2, 5] } }; })();
  const sphere = (c, r, w, h) => new THREE.SphereGeometry(r, w || 14, h || 10).translate(c[0], c[1], c[2]);
  // samples of a curve every ds: [{ p, s }] with s the arc length
  function sampleCurve(curve, ds, from = 0, to) {
    const L = curve.getLength(), e = to === undefined ? L : to, out = [];
    for (let s = from; s <= e + 1e-9; s += ds) out.push({ p: curve.getPointAt(clamp(s / L, 0, 1)).toArray(), s });
    return out;
  }
  const NOTW = [0, 0, 0, 0];

  // ------------------------------------------------------------------ layout (local units)
  const CC = [-1.0, 0.0, 0.0], CRX = 0.18, CRY = 0.22, CHL = 0.085;   // cord centre, semi-axes (ventral, lateral), half length
  const MS = [-0.90, -0.085, 0.0];                                     // motor neuron soma, in the anterior horn
  const SG = [-1.10, -0.36, 0.0];                                      // dorsal root ganglion
  const FCN = [0.15, -0.30, 0.0], FX0 = -0.25, FX1 = 0.55, RF = 0.034; // fascicle centre, fibre ends, fibre radius
  const HC = [0.30, 0.29, -0.12];                                      // heart
  const SC = [1.0, -0.05, 0.0];                                        // magnified sarcomere
  const PER = 0.018;                                                   // sarcomere length in the fibres
  const IL = 0.066, NG = 0.0085;                                       // internode length, node gap
  const TM0 = 0.5, vM = 3.35, vS = 5.8, vC = 6.9, P_ = 1.7;             // motor neuron fires; conduction speeds; reflex period

  // ------------------------------------------------------------------ builders and materials
  const LITS = { color: 3, aSite: 1, aGC: 3 }, LITT = Object.assign({ aTwA: 4, aPT: 1 }, LITS);   // aPT: 20 + the time an impulse passes (0: never)
  const glass = Builder({ color: 3, aSite: 1, aGC: 3, aGA: 1 });
  const greyB = Builder(LITS), somaB = Builder(LITT), nucB = Builder(LITS), neuB = Builder(LITT), myeB = Builder(LITS);
  const fibB = Builder(Object.assign({ aF: 3 }, LITT));
  const rings = Builder({ aGC: 3, aR: 3 });
  const PTS = [];   // { p, c, s (size), a, q: [kind, time, site] }; kinds: 0 pulse, 1 vesicle, 2 transmitter, 3 halo, 4 heart glow
  const pt = (p, c, s, a, q) => PTS.push({ p, c, s, a, q });
  const ring = (ctr, nrm, rad, tr, col, site, speed, seg) => {
    const n = v3.norm(nrm), a = v3.norm(Math.abs(n[1]) < 0.9 ? v3.cross(n, [0, 1, 0]) : v3.cross(n, [1, 0, 0])), b = v3.cross(n, a), pts = [];
    for (let i = 0; i < 24; i++) { const t = i / 24 * TAU; pts.push(v3.add(ctr, v3.add(v3.mul(a, rad * Math.cos(t)), v3.mul(b, rad * Math.sin(t))))); }
    const g = tubeR(pts, seg || 64, 4, tr, true);
    rings.add(g, { aGC: col, aR: (x, y, z, i) => [site, g.attributes.aU.array[i], speed] });
  };

  // ------------------------------------------------------------------ spinal cord: white matter (glass) and the grey butterfly
  {
    // half outline (ventral is +u, lateral |v|): anterior horn, lateral horn, posterior horn reaching the surface
    const HALF = [[0.015, 0], [0.02, 0.025], [0.06, 0.03], [0.11, 0.04], [0.145, 0.065], [0.15, 0.10], [0.12, 0.125], [0.075, 0.12],
      [0.04, 0.127], [0.015, 0.115], [-0.015, 0.085], [-0.05, 0.07], [-0.095, 0.08], [-0.14, 0.10], [-0.16, 0.112], [-0.163, 0.098],
      [-0.13, 0.072], [-0.08, 0.045], [-0.04, 0.022], [-0.02, 0]];
    const loop = HALF.concat(HALF.slice(1, -1).reverse().map(p => [p[0], -p[1]]));
    const shp = new THREE.Shape();
    shp.moveTo(loop[0][0], loop[0][1]);
    shp.splineThru(loop.slice(1).concat([loop[0]]).map(p => new THREE.Vector2(p[0], p[1])));
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.006, 0, TAU, true); shp.holes.push(hole);   // central canal
    const gg = new THREE.ExtrudeGeometry(shp, { depth: 2 * CHL - 0.034, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2, curveSegments: 3 });
    gg.translate(CC[0], CC[1], -(CHL - 0.017));
    greyB.add(gg, { color: K.rgb('#c99ac4'), aSite: 1, aGC: sc(1, 0) });
  }

  // ------------------------------------------------------------------ motor neuron: soma, nucleus, dendrites
  const GOLD = K.rgb('#ffc35a'), TEAL = K.rgb('#5ee0d2'), PLATE = K.rgb('#ff8fb0');
  {
    const dirs = [];
    for (let k = 0; k < 7; k++) {
      const a = 1.2 + k / 7 * TAU * 0.86 + (R() - 0.5) * 0.4;   // around, leaving the axon's side (towards +x, -y) free
      dirs.push(v3.norm([Math.cos(a), Math.sin(a), (R() - 0.5) * 0.5]));
    }
    const sg = new THREE.SphereGeometry(1, 28, 20), P = sg.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const n = [P.getX(i), P.getY(i), P.getZ(i)];
      let r = 0.036;
      for (const d of dirs) r += 0.008 * Math.pow(Math.max(0, v3.dot(n, d)), 8);
      r += 0.007 * Math.pow(Math.max(0, v3.dot(n, v3.norm([0.86, -0.5, 0]))), 6);
      P.setXYZ(i, MS[0] + n[0] * r, MS[1] + n[1] * r * 0.92, MS[2] + n[2] * r * 0.9);
    }
    sg.computeVertexNormals();
    somaB.add(sg, { color: GOLD, aSite: 1, aGC: sc(1, 0), aTwA: NOTW, aPT: 20 + TM0 - 0.01 });
    nucB.add(sphere(v3.add(MS, [-0.004, 0.003, 0.004]), 0.0135, 18, 12), { color: K.rgb('#7f8cff'), aSite: 1, aGC: sc(1, 0) });
    nucB.add(sphere(v3.add(MS, [-0.001, 0.006, 0.0145]), 0.0045, 10, 8), { color: [0.95, 0.96, 1], aSite: 1, aGC: sc(1, 0) });
    const dend = (p, d, len, r, depth, k) => {
      const pts = [p]; let q = p, dd = d;
      for (let i = 0; i < 3; i++) { dd = v3.norm(v3.add(dd, v3.mul(K.unit(R), 0.3))); dd[2] *= 0.5; dd = v3.norm(dd); q = v3.add(q, v3.mul(dd, len / 3)); pts.push(q); }
      neuB.add(tubeR(pts, 9, 6, u => r * (depth ? 1 - 0.4 * u : 1 - 0.85 * u)), { color: GOLD, aSite: 1, aGC: sc(1, k), aTwA: NOTW });
      if (depth > 0) for (let s = 0; s < 2; s++) dend(q, v3.norm(v3.add(dd, v3.mul(K.unit(R), 0.85))), len * 0.68, r * 0.58, depth - 1, k);
    };
    dirs.forEach((d, k) => dend(v3.add(MS, v3.mul(d, 0.024)), d, 0.055 + R() * 0.02, 0.0095, 2, k));
  }

  // ------------------------------------------------------------------ axons, myelin, nodes of Ranvier
  const nodes = [];   // { p, time } of every node (pulse flashes)
  function myelinate(curve, s0, s1, rAx, rMy, site, list) {
    const L = curve.getLength();
    let s = s0;
    while (s + 0.025 < s1) {
      const e = Math.min(s + IL, s1), pts = [];
      for (let i = 0; i <= 6; i++) pts.push(curve.getPointAt((s + (e - s) * i / 6) / L).toArray());
      myeB.add(tubeR(pts, 16, 12, u => { const w = Math.min(u, 1 - u) * (e - s); return rAx * 1.06 + (rMy - rAx) * Math.sqrt(smooth(w / 0.01)); }),
        { color: [0.9, 0.94, 1.0], aSite: typeof site === 'function' ? site : site, aGC: sc(2, 0) });
      list.push((s + e) / 2);
      s = e + NG;
      if (s < s1) nodes.push({ s: s - NG / 2, curve });
    }
  }
  const midSheath = [];   // centres of internodes (for anchors)
  // motor axon: soma, hillock, ventral root, spinal nerve, to the branch point in front of the fascicle
  const MP = [MS, [-0.875, -0.10, 0.0], [-0.855, -0.125, 0.0], [-0.845, -0.15, 0.002], [-0.828, -0.24, 0.006], [-0.81, -0.33, 0.01],
    [-0.78, -0.41, 0.014], [-0.70, -0.45, 0.02], [-0.58, -0.46, 0.04], [-0.45, -0.45, 0.07], [-0.33, -0.415, 0.12], [-0.22, -0.37, 0.225],
    [-0.12, -0.30, 0.25], [-0.05, -0.26, 0.255]];
  const axM = tubeR(MP, 300, 7, u => 0.0085 + 0.0075 * (1 - smooth(u / 0.04)));
  const cM = axM.userData.curve, LM = cM.getLength();
  neuB.add(axM, { color: GOLD, aSite: (x) => (x < -0.83 ? 1 : 2), aGC: (x) => (x < -0.83 ? sc(1, 0) : sc(2, 0)), aTwA: NOTW, aPT: (x, y, z, i) => 20 + TM0 + axM.attributes.aU.array[i] * LM / vM });
  const nodeM0 = nodes.length;
  myelinate(cM, 0.07, LM - 0.006, 0.0085, 0.0148, x => (x < -0.83 ? 1 : 2), midSheath);
  const nodeM1 = nodes.length;

  // sensory neuron: soma in the ganglion, stem to a T, central branch to the dorsal horn and on to the motor neuron
  // (the stretch reflex), peripheral branch along the nerve to an annulospiral ending round a muscle spindle
  const SS = v3.add(SG, [-0.014, 0.004, 0.006]), TJ = v3.add(SG, [0.012, -0.004, 0]);
  somaB.add(sphere(SS, 0.019, 20, 14), { color: TEAL, aSite: 1, aGC: sc(1, 1), aTwA: NOTW });
  nucB.add(sphere(v3.add(SS, [-0.002, 0.002, 0.004]), 0.0075, 14, 10), { color: K.rgb('#7f8cff'), aSite: 1, aGC: sc(1, 1) });
  neuB.add(tubeR([v3.add(SS, [0.012, -0.006, 0.004]), v3.add(SG, [0.006, -0.014, 0.008]), v3.add(SG, [0.012, -0.012, 0.004]), TJ], 12, 6, 0.0042),
    { color: TEAL, aSite: 1, aGC: sc(1, 1), aTwA: NOTW });
  const SPA = x => [x, FCN[1] - 0.205 * 0.6, FCN[2] + 0.205 * 0.8];   // spindle axis
  const SOD = [0, -0.6, 0.8], SE = v3.cross([1, 0, 0], SOD);
  const PP = [TJ, [-1.09, -0.42, 0.0], [-1.04, -0.47, 0.0], [-0.95, -0.495, 0.0], [-0.86, -0.50, 0.0], [-0.70, -0.478, 0.008],
    [-0.58, -0.487, 0.028], [-0.45, -0.477, 0.058], [-0.33, -0.447, 0.112], [-0.22, -0.412, 0.212], [-0.10, -0.44, 0.205],
    [0.03, -0.443, 0.193], [0.10, -0.437, 0.181]];
  const axP = tubeR(PP, 280, 6, 0.0055), cP = axP.userData.curve, LP = cP.getLength();
  const nodeP0 = nodes.length;
  myelinate(cP, 0.02, LP - 0.07, 0.0055, 0.0115, 2, []);
  const nodeP1 = nodes.length;
  const COIL = [PP[PP.length - 1]];
  for (let i = 0; i <= 44; i++) { const u = i / 44, a = TAU * 5 * u; COIL.push(v3.add(SPA(0.13 + 0.08 * u), v3.add(v3.mul(SOD, 0.0115 * Math.cos(a)), v3.mul(SE, 0.0115 * Math.sin(a))))); }
  const axK = tubeR(COIL, 220, 5, 0.0026), cK = axK.userData.curve, LK = cK.getLength();
  neuB.add(axP, { color: TEAL, aSite: 2, aGC: sc(2, 0), aTwA: NOTW, aPT: (x, y, z, i) => 20 + ((1 - axP.attributes.aU.array[i]) * LP + LK) / vS });
  neuB.add(axK, { color: TEAL, aSite: 2, aGC: sc(2, 0), aTwA: NOTW, aPT: (x, y, z, i) => 20 + (1 - axK.attributes.aU.array[i]) * LK / vS });

  const TS1 = (LP + LK) / vS;   // the sensory impulse reaches the T (it bypasses the cell body)
  const CP = [TJ, [-1.105, -0.30, 0.0], [-1.13, -0.22, 0.0], [-1.152, -0.15, 0.0], [-1.15, -0.118, 0.0], [-1.10, -0.095, 0.004],
    [-1.03, -0.078, 0.008], [-0.965, -0.076, 0.012], [-0.93, -0.08, 0.014]];
  const axC = tubeR(CP, 90, 6, 0.0055), cC = axC.userData.curve, LC = cC.getLength();
  neuB.add(axC, { color: TEAL, aSite: x => (x < -1.14 ? 2 : 1), aGC: x => (x < -1.14 ? sc(2, 0) : sc(1, 1)), aTwA: NOTW, aPT: (x, y, z, i) => 20 + TS1 + axC.attributes.aU.array[i] * LC / vC });
  const nodeC0 = nodes.length;
  myelinate(cC, 0.025, 0.2, 0.0055, 0.0115, 2, []);
  const nodeC1 = nodes.length;
  somaB.add(sphere([-0.927, -0.081, 0.015], 0.0068, 10, 8), { color: TEAL, aSite: 1, aGC: sc(1, 1), aTwA: NOTW, aPT: 20 + TS1 + LC / vC });

  // glass: white matter of the cord, ganglion capsule, spinal nerve sheath (epineurium), fascicle sheath (perimysium), spindle capsule
  {
    const prof = [], rr = 0.16, hr = 0.035;
    prof.push(new THREE.Vector2(0.0001, -CHL));
    for (let i = 0; i <= 6; i++) { const a = -PI / 2 + i / 6 * PI / 2; prof.push(new THREE.Vector2(1 - rr + rr * Math.cos(a), -CHL + hr + hr * Math.sin(a))); }
    for (let i = 0; i <= 6; i++) { const a = i / 6 * PI / 2; prof.push(new THREE.Vector2(1 - rr + rr * Math.cos(a), CHL - hr + hr * Math.sin(a))); }
    prof.push(new THREE.Vector2(0.0001, CHL));
    const g = new THREE.LatheGeometry(prof, 48);
    g.rotateX(PI / 2); g.scale(CRX, CRY, 1); g.translate(CC[0], CC[1], CC[2]);
    glass.add(g, { color: [0.62, 0.78, 1.0], aSite: 1, aGC: sc(1, 2), aGA: 1 });
    glass.add(new THREE.SphereGeometry(1, 22, 16).scale(0.044, 0.062, 0.044).translate(SG[0], SG[1], SG[2]), { color: [0.55, 0.95, 0.95], aSite: 1, aGC: sc(1, 1), aGA: 1.2 });
    const NS = [[-0.79, -0.44, 0.004], [-0.70, -0.465, 0.014], [-0.58, -0.474, 0.034], [-0.45, -0.464, 0.064], [-0.33, -0.431, 0.116], [-0.235, -0.393, 0.205]];
    glass.add(tubeR(NS, 48, 20, u => 0.04 * (0.55 + 0.45 * Math.sqrt(smooth(Math.min(u, 1 - u) / 0.08)))), { color: [0.75, 0.85, 1.0], aSite: 2, aGC: sc(2, 0), aGA: 0.8 });
    const fs = new THREE.CylinderGeometry(0.199, 0.199, FX1 - FX0 + 0.02, 56, 1, true);
    fs.rotateZ(PI / 2); fs.translate((FX0 + FX1) / 2, FCN[1], FCN[2]);
    glass.add(fs, { color: [1.0, 0.7, 0.78], aSite: 4, aGC: sc(4, 0), aGA: 0.55 });
    glass.add(tubeR([SPA(0.02), SPA(0.17), SPA(0.32)], 30, 14, u => 0.0035 + 0.0145 * Math.pow(Math.sin(PI * u), 0.8)), { color: [0.7, 0.95, 1.0], aSite: 4, aGC: sc(4, 1), aGA: 1.1 });
  }

  // ------------------------------------------------------------------ the fascicle: 20 striated fibres
  const fib = [];
  {
    const add = (rho, a) => fib.push({ dy: Math.cos(a), dz: Math.sin(a), y: FCN[1] + rho * Math.cos(a), z: FCN[2] + rho * Math.sin(a),
      r: RF * (0.93 + 0.09 * R()), p1: R() * TAU, p2: R() * TAU, x1: FX1 + (R() - 0.5) * 0.03, outer: rho > 0.12 });
    add(0.004, 0.3);
    for (let k = 0; k < 7; k++) add(0.0807 + (R() - 0.5) * 0.004, k / 7 * TAU + 0.2);
    for (let k = 0; k < 12; k++) add(0.152 + (R() - 0.5) * 0.005, k / 12 * TAU + 0.05);
  }
  const fAx = (f, x) => [x, f.y + 0.003 * Math.sin(x * 7 + f.p1), f.z + 0.003 * Math.cos(x * 5 + f.p2)];
  const outerIdx = fib.map((f, i) => i).filter(i => fib[i].outer);
  const byDot = (d) => outerIdx.slice().sort((a, b) => (fib[b].dy * d[0] + fib[b].dz * d[1]) - (fib[a].dy * d[0] + fib[a].dz * d[1]));
  const IO = byDot(v3.norm([0.3, 0.95, 0]))[0];                 // the fibre that opens (front, a little up)
  fib[IO].x1 = 0.585;
  const JF = byDot([0.62, 0.78]).slice(0, 6);                     // the motor unit's fibres (upper front)
  const isJ = new Set(JF);
  fib.forEach((f, k) => {
    const pts = []; for (let i = 0; i <= 8; i++) pts.push(fAx(f, lerp(FX0, f.x1, i / 8)));
    const role = k === IO ? 1 : 0, tw = isJ.has(k) ? 1 : 0, col = v3.mul(K.rgb('#d65a6f'), 0.92 + 0.12 * R());
    const t = tubeR(pts, 22, 20, f.r);
    fibB.add(t, { color: col, aSite: 4, aGC: sc(4, k), aF: x => [x, 0, role], aTwA: (x, y, z, i) => [t.attributes.aAxis.array[i * 3], t.attributes.aAxis.array[i * 3 + 1], t.attributes.aAxis.array[i * 3 + 2], tw] });
    for (const end of [0, 1]) {
      const c = fAx(f, end ? f.x1 : FX0), cap = new THREE.CircleGeometry(f.r, 20).rotateY(end ? PI / 2 : -PI / 2).translate(c[0], c[1], c[2]);
      fibB.add(cap, { color: v3.mul(col, 0.85), aSite: 4, aGC: sc(4, k), aF: x => [x, 0, role && end ? 2 : role], aTwA: [c[0], c[1], c[2], tw] });
    }
  });
  // myofibrils of the opened fibre (hex packed, in register), protruding from its cut end; one ends in the sarcomere
  const FO = fib[IO], ODIR = v3.norm([0, FO.dy + 0.25, FO.dz + 0.7]);
  SU.uOpenDir.value.set(ODIR[0], ODIR[1], ODIR[2]);
  const MY = [];
  {
    const e2 = [0, 0, 1], e3 = [0, 1, 0];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i + j) <= 2) MY.push([0.0125 * (i + j / 2), 0.0125 * j * Math.sqrt(3) / 2]);
    let hi = 0, best = -1;
    MY.forEach((m, k) => { const d = m[0] * ODIR[1] + m[1] * ODIR[2]; if (Math.hypot(m[0], m[1]) < 0.02 && d > best) { best = d; hi = k; } });
    MY.forEach((m, k) => {
      const x1 = k === hi ? 0.706 : 0.615 + R() * 0.06;
      const pts = []; for (let i = 0; i <= 6; i++) { const x = lerp(0.24, x1, i / 6), a = fAx(FO, x); pts.push([x, a[1] + m[0] * e3[1], a[2] + m[1] * e2[2]]); }
      const t = tubeR(pts, 16, 8, 0.0056), tw = isJ.has(IO) ? 1 : 0;
      const aT = (x, y, z, i) => [t.attributes.aAxis.array[i * 3], t.attributes.aAxis.array[i * 3 + 1], t.attributes.aAxis.array[i * 3 + 2], tw];
      fibB.add(t, { color: K.rgb('#ef7b8f'), aSite: 4, aGC: sc(4, IO), aF: x => [x, 0, 3], aTwA: aT });
      const c = pts[pts.length - 1];
      fibB.add(new THREE.CircleGeometry(0.0056, 10).rotateY(PI / 2).translate(c[0], c[1], c[2]), { color: K.rgb('#ef7b8f'), aSite: 4, aGC: sc(4, IO), aF: [c[0], 0, 3], aTwA: [c[0], c[1], c[2], tw] });
      if (k === hi) MY.hi = { y: c[1], z: c[2] };
    });
  }
  // intrafusal fibres of the spindle (thin, striated)
  for (const o of [-0.005, 0.005]) {
    const pts = [0.025, 0.17, 0.315].map(x => v3.add(SPA(x), v3.mul(SE, o)));
    fibB.add(tubeR(pts, 24, 8, u => 0.0045 * (0.6 + 0.4 * Math.sin(PI * u))), { color: K.rgb('#f08aa0'), aSite: 4, aGC: sc(4, 1), aF: x => [x, 2, 0], aTwA: NOTW });
  }

  // ------------------------------------------------------------------ the motor axon's terminal branches and junctions
  const JX = [0.0, 0.045, 0.09, 0.13, 0.17, 0.21];
  const JN = JF.map((fi, j) => {
    const f = fib[fi], n = v3.norm([0, f.dy, f.dz + 0.25]), t1 = [1, 0, 0], t2 = v3.cross(n, t1), x = JX[j] + (R() - 0.5) * 0.02;
    const A = fAx(f, x);
    // a point on the fibre surface: a along the fibre, b around it, h above the surface
    const J = (a, b, h) => { const ang = b / f.r, rd = v3.add(v3.mul(n, Math.cos(ang)), v3.mul(t2, Math.sin(ang))); return v3.add(v3.add(A, [a, 0, 0]), v3.mul(rd, f.r + h)); };
    return { fi, f, n, t2, A, J, x, rot: (R() - 0.5) * 0.8, flip: R() < 0.5 ? -1 : 1 };
  });
  const B0 = MP[MP.length - 1];
  // push a point out of the fascicle (radially from its axis) to at least radius rm
  const outside = (p, rm) => { const dy = p[1] - FCN[1], dz = p[2] - FCN[2], r = Math.hypot(dy, dz); return r >= rm ? p : [p[0], FCN[1] + dy / r * rm, FCN[2] + dz / r * rm]; };
  // pairs of junctions share a primary branch
  const BR = [];
  for (let k = 0; k < 3; k++) {
    const a = JN[2 * k], b = JN[2 * k + 1], qa = a.J(-0.03, 0, 0.012), qb = b.J(-0.03, 0, 0.012);
    const Pk = v3.add(v3.mul(v3.add(qa, qb), 0.5), v3.add(v3.mul(v3.norm(v3.add(a.n, b.n)), 0.035), [-0.025, 0, 0]));
    const pts = [B0, outside(v3.add(v3.lerp(B0, Pk, 0.5), [0, 0.01, 0.012]), 0.25), outside(Pk, 0.235)];
    const t = tubeR(pts, 30, 6, 0.0052), c = t.userData.curve, L = c.getLength();
    neuB.add(t, { color: GOLD, aSite: 3, aGC: sc(3, 0), aTwA: NOTW, aPT: (x, y, z, i) => 20 + TM0 + LM / vM + t.attributes.aU.array[i] * L / 2.2 });
    const n0 = nodes.length;
    if (L > 0.06) myelinate(c, 0.006, L - 0.008, 0.0052, 0.0098, 3, []);
    BR.push({ c, L, Pk: pts[2], n0, n1: nodes.length });
  }
  const plateB = new THREE.LatheGeometry([[0.0005, 0.0012], [0.010, 0.0014], [0.015, 0.0024], [0.0185, 0.0048], [0.0205, 0.0062], [0.0228, 0.0056],
    [0.0245, 0.003], [0.0255, -0.0012], [0.02, -0.003], [0.0005, -0.003]].map(p => new THREE.Vector2(p[0], p[1])), 28);
  JN.forEach((jn, j) => {
    const { J, n, f } = jn, axT = x => { const a = fAx(f, x); return [a[0], a[1], a[2], 1]; };
    // end plate: a shallow cup with junctional folds, wrapped onto the fibre
    const g = plateB.clone(), P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), rho = Math.hypot(x, z), ph = Math.atan2(z, x);
      const h = y + (rho < 0.016 && y > 0 ? 0.0007 * Math.cos(ph * 14) : 0);
      const p = J(x, z * 0.72, h); P.setXYZ(i, p[0], p[1], p[2]);
      const ang = z * 0.72 / f.r, nr = v3.add(v3.mul(n, Math.cos(ang)), v3.mul(jn.t2, Math.sin(ang))), tb = v3.cross([1, 0, 0], nr);
      const nn = v3.norm(v3.add(v3.add(v3.mul([1, 0, 0], N.getX(i)), v3.mul(nr, N.getY(i))), v3.mul(tb, -N.getZ(i))));
      N.setXYZ(i, nn[0], nn[1], nn[2]);
    }
    neuB.add(g, { color: PLATE, aSite: 3, aGC: sc(3, j), aTwA: x => axT(x) });
    // terminal: from the branch point to the edge of the cup, then branches over it (en plaque) with swellings
    const br = BR[j >> 1], q0 = J(-0.03, 0, 0.012), q1 = J(-0.02, 0, 0.0052);
    const qo = J(-0.045, 0, 0.03), tt = tubeR([br.Pk, outside(v3.lerp(br.Pk, qo, 0.5), 0.228), qo, q0, q1], 30, 6, 0.0038);
    jn.tpath = [br.Pk, outside(v3.lerp(br.Pk, qo, 0.5), 0.228), qo, q0, q1];
    const twW = (x, y, z) => { const a = fAx(f, x); return [a[0], a[1], a[2], clamp(1 - (Math.hypot(y - a[1], z - a[2]) - f.r) / 0.02, 0, 1)]; };
    const Lt = tt.userData.curve.getLength(), tb = TM0 + LM / vM + br.L / 2.2;
    neuB.add(tt, { color: GOLD, aSite: 3, aGC: sc(3, j), aTwA: twW, aPT: (x, y, z, i) => 20 + tb + tt.attributes.aU.array[i] * Lt / 1.4 });
    const cs = Math.cos(jn.rot), sn = Math.sin(jn.rot) * jn.flip, rot = (a, b) => [a * cs - b * sn, (a * sn + b * cs) * jn.flip];
    const lobes = [[[-0.02, 0], [-0.008, 0.004], [0.004, 0.009], [0.013, 0.006]], [[-0.02, 0], [-0.006, -0.004], [0.008, -0.007], [0.017, -0.002]], [[-0.008, 0.004], [-0.002, -0.0005], [0.006, 0.0005]]];
    for (const lb of lobes) {
      const pts = lb.map(([a, b]) => { const r = rot(a + 0.02, b); return J(r[0] - 0.02, r[1], 0.0048); });
      somaB.add(tubeR(pts, 12, 8, u => 0.0031 * (1 + 0.22 * Math.sin(PI * u * 3))), { color: GOLD, aSite: 3, aGC: sc(3, j), aTwA: x => axT(x), aPT: 20 + tb + Lt / 1.4 });
      const e = pts[pts.length - 1];
      somaB.add(sphere(e, 0.0041, 10, 8), { color: GOLD, aSite: 3, aGC: sc(3, j), aTwA: axT(e[0]), aPT: 20 + tb + Lt / 1.4 });
      jn.lobes = (jn.lobes || []).concat([lb.map(([a, b]) => rot(a + 0.02, b))]);
    }
    ring(J(0.002, 0, 0.004), n, 0.032, 0.0018, sc(3, j), 3, 0.35, 48);
  });

  // ------------------------------------------------------------------ impulses, vesicles, transmitter (points)
  const TM1 = TM0 + LM / vM;
  const PCM = [1, 0.85, 0.45], PCS = [0.55, 0.95, 1];
  const nearNode = (s, list) => list.some(q => Math.abs(q - s) < NG * 0.7);
  const nodeS = (a, b) => nodes.slice(a, b).map(q => q.s);
  {
    const nm = nodeS(nodeM0, nodeM1);
    for (const { p, s } of sampleCurve(cM, 0.006)) pt(p, PCM, 0.03, nearNode(s, nm) ? 1 : 0.4, [0, TM0 + s / vM, p[0] < -0.83 ? 1 : 2]);
    for (const q of nm) pt(cM.getPointAt(q / LM).toArray(), PCM, 0.085, 1, [0, TM0 + q / vM, 2]);
    pt(MS, PCM, 0.11, 0.7, [0, TM0 - 0.01, 1]);
    const ns = nodeS(nodeP0, nodeP1);
    for (const { p, s } of sampleCurve(cK, 0.006)) pt(p, PCS, 0.018, 0.6, [0, (LK - s) / vS, 2]);
    for (const { p, s } of sampleCurve(cP, 0.006)) pt(p, PCS, 0.026, nearNode(s, ns) ? 1 : 0.4, [0, (LP - s + LK) / vS, 2]);
    for (const q of ns) pt(cP.getPointAt(q / LP).toArray(), PCS, 0.075, 1, [0, (LP - q + LK) / vS, 2]);
    const nc = nodeS(nodeC0, nodeC1);
    for (const { p, s } of sampleCurve(cC, 0.006)) pt(p, PCS, 0.024, nearNode(s, nc) ? 1 : 0.4, [0, TS1 + s / vC, p[0] < -1.14 ? 2 : 1]);
    JN.forEach((jn, j) => {
      const br = BR[j >> 1], tb = TM1 + br.L / 2.2;
      if (j % 2 === 0) for (const { p, s } of sampleCurve(br.c, 0.006)) pt(p, PCM, 0.014, 0.5, [0, TM1 + s / 2.2, 3]);
      const tc = new THREE.CatmullRomCurve3(jn.tpath.map(V)), Lt = tc.getLength();
      for (const { p, s } of sampleCurve(tc, 0.006)) pt(p, PCM, 0.008, 0.45, [0, tb + s / 1.4, 3]);
      jn.time = tb + Lt / 1.4;
      // vesicles in the swellings, near the membrane that faces the muscle; transmitter in the cleft
      for (const lb of jn.lobes) for (let k = 0; k < 11; k++) {
        const u = R() * (lb.length - 1), i0 = Math.floor(u), f = u - i0, a = lerp(lb[i0][0], lb[Math.min(i0 + 1, lb.length - 1)][0], f), b = lerp(lb[i0][1], lb[Math.min(i0 + 1, lb.length - 1)][1], f);
        pt(jn.J(a - 0.02 + (R() - 0.5) * 0.003, b + (R() - 0.5) * 0.003, 0.0036 + (R() - 0.5) * 0.0016), [1, 0.95, 0.78], 0.0021, 0.9, [1, jn.time + 0.015, 3]);
        if (k < 7) pt(jn.J(a - 0.02 + (R() - 0.5) * 0.005, b + (R() - 0.5) * 0.005, 0.0016), [0.7, 1, 0.8], 0.0017, 0.9, [2, jn.time + 0.03, 3]);
      }
    });
  }
  const TJm = JN.reduce((s, j) => s + j.time, 0) / JN.length;

  // ------------------------------------------------------------------ disease halos and rings
  {
    for (let i = 0; i < ncol(1); i++) {
      const a = i / ncol(1) * TAU;
      pt(v3.add(MS, [0.02 * Math.cos(a), 0.02 * Math.sin(a), 0.03]), sc(1, i), 0.2, 0.32, [3, 0, 1]);
      ring(MS, [[0.3, 1, 0.4], [1, -0.2, 0.6], [-0.5, 0.4, 1]][i % 3], 0.052 + 0.009 * i, 0.003, sc(1, i), 1, 0.25 + 0.08 * i);
    }
    ring(SG, [0, 1, 0], 0.056, 0.003, sc(1, 1), 1, 0.3);
    pt(SG, sc(1, 1), 0.15, 0.3, [3, 0, 1]);
    const NSc = new THREE.CatmullRomCurve3([[-0.79, -0.44, 0.004], [-0.58, -0.474, 0.034], [-0.33, -0.431, 0.116], [-0.235, -0.393, 0.205]].map(V));
    for (let i = 0; i < 3; i++) {
      const u = 0.2 + 0.28 * i, p = NSc.getPointAt(u).toArray(), tg = NSc.getTangentAt(u).toArray();
      ring(p, tg, 0.05, 0.0035, sc(2, i), 2, 0.45);
      if (i < ncol(2) || i === 1) pt(p, sc(2, i), 0.22, 0.28, [3, 0, 2]);
    }
    const jc = v3.mul(JN.reduce((s, j) => v3.add(s, j.J(0, 0, 0.03)), [0, 0, 0]), 1 / JN.length);
    for (let i = 0; i < ncol(3); i++) pt(v3.add(jc, [0.03 * i, 0, 0.02]), sc(3, i), 0.2, 0.3, [3, 0, 3]);
    const nmu = ncol(4);
    for (let i = 0; i < nmu; i++) {
      const x = lerp(FX0 + 0.05, FX1 - 0.05, nmu > 1 ? i / (nmu - 1) : 0.5);
      ring([x, FCN[1], FCN[2]], [1, 0, 0], 0.214, 0.0042, sc(4, i), 4, 0.15 + 0.05 * (i % 3));
      pt([x, FCN[1] + 0.13, FCN[2] + 0.17], sc(4, i), 0.15, 0.22, [3, 0, 4]);
    }
    for (let i = 0; i < Math.max(2, ncol(5)); i++) ring(HC, [[0.2, 1, 0.25], [-0.25, 1, -0.1]][i % 2], 0.31 + 0.035 * i, 0.005, sc(5, i), 5, 0.2 + 0.1 * i, 96);
    for (let i = 0; i < ncol(5); i++) pt(v3.add(HC, [0, 0.03 * i, 0]), sc(5, i), 0.6, 0.25, [3, 0, 5]);
    pt(HC, [1, 0.45, 0.8], 0.9, 0.8, [4, 0, 5]);   // the glow the heart appears from
  }

  // ------------------------------------------------------------------ the heart
  // One smooth surface: a signed distance field, polygonised by surface nets, so the ventricles, atria, auricles and
  // great vessels merge with soft grooves instead of meeting as separate shapes. The coronary vessels are tubes laid
  // into those grooves; a window cut into the right ventricle's front wall shows branched, striated heart muscle
  // cells lying on its floor. Local frame: x the patient's left, y up, z forward. The field is defined here; the
  // heavy part (polygonising, the coronaries) is a job run in short slices between frames (heartStep), while the set
  // is hidden or the heart not yet wanted, and in longer ones once it is; the heart fades in when it is ready.
  const hg = new THREE.Group(); hg.position.set(HC[0], HC[1], HC[2]);
  const heartB = Builder(Object.assign({ aM: 3 }, LITS)), hfB = Builder(Object.assign({ aF: 3 }, LITT));
  const V0 = [0, -0.03, 0], AX = v3.norm([0.42, -0.85, 0.32]);    // the ventricles' centre of the beat, and their axis (base to apex)
  const E1 = v3.norm(v3.sub([0, 0, 1], v3.mul(AX, AX[2]))), EL = v3.cross(E1, AX);   // across the axis: forward, and to the left
  const vp = (t, f, l) => [0, 1, 2].map(c => V0[c] + AX[c] * t + E1[c] * f + EL[c] * l);
  const MYO = K.rgb('#8f2430'), ATR = K.rgb('#86283f'), AOR = K.rgb('#d0404a'), PUL = K.rgb('#5a5fd4'), VEN = K.rgb('#4a66d8'), PVN = K.rgb('#b3334a');
  const H5 = { aSite: 5, aGC: sc(5, 0) };
  // primitives: k 0 a cone with round ends (from a to b, radii r1 to r2), 1 an ellipsoid (centre c, axes u v w,
  // radii r); g the tissue for the beat (0 ventricles, 1 atria, 2 vessels), col its colour, cuts its open ends
  const HP = [];
  const rcone = (a, b, r1, r2, g, col) => { const ba = v3.sub(b, a), l2 = v3.dot(ba, ba), rr = r1 - r2;
    HP.push({ k: 0, a, b, ba, r1, r2, l2, rr, a2: l2 - rr * rr, il2: 1 / l2, g, col, cuts: null }); return HP.length - 1; };
  const ellip = (c, u, v, r, g, col) => { u = v3.norm(u); const w = v3.norm(v3.cross(u, v)); v = v3.cross(w, u);
    HP.push({ k: 1, c, u, v, w, r, g, col, cuts: null }); return HP.length - 1; };
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  function hd(q, x, y, z) {
    let d;
    if (q.k === 0) {   // round cone (after Inigo Quilez)
      const px = x - q.a[0], py = y - q.a[1], pz = z - q.a[2], b = q.ba, l2 = q.l2, yy = px * b[0] + py * b[1] + pz * b[2], zz = yy - l2;
      const qx = px * l2 - b[0] * yy, qy = py * l2 - b[1] * yy, qz = pz * l2 - b[2] * yy, x2 = qx * qx + qy * qy + qz * qz;
      const kk = Math.sign(q.rr) * q.rr * q.rr * x2;
      if (Math.sign(zz) * q.a2 * zz * zz * l2 > kk) d = Math.sqrt(x2 + zz * zz * l2) * q.il2 - q.r2;
      else if (Math.sign(yy) * q.a2 * yy * yy * l2 < kk) d = Math.sqrt(x2 + yy * yy * l2) * q.il2 - q.r1;
      else d = (Math.sqrt(x2 * q.a2 * q.il2) + yy * q.rr) * q.il2 - q.r1;
    } else {           // ellipsoid (a close bound)
      const px = x - q.c[0], py = y - q.c[1], pz = z - q.c[2], r = q.r;
      const a = (px * q.u[0] + py * q.u[1] + pz * q.u[2]) / r[0], b = (px * q.v[0] + py * q.v[1] + pz * q.v[2]) / r[1], c = (px * q.w[0] + py * q.w[1] + pz * q.w[2]) / r[2];
      const k0 = Math.sqrt(a * a + b * b + c * c), k1 = Math.sqrt(a * a / (r[0] * r[0]) + b * b / (r[1] * r[1]) + c * c / (r[2] * r[2]));
      d = k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(r[0], r[1], r[2]);
    }
    if (q.cuts) for (const c of q.cuts) {   // a flat open end (the plane through e across the vessel) with its lumen, rims a little rounded
      d = smax(d, (x - c.e[0]) * c.n[0] + (y - c.e[1]) * c.n[1] + (z - c.e[2]) * c.n[2], 0.004);
      if (c.rl) {
        const px = x - c.l0[0], py = y - c.l0[1], pz = z - c.l0[2], s = clamp((px * c.n[0] + py * c.n[1] + pz * c.n[2]) / c.ll, 0, 1) * c.ll;
        d = smax(d, c.rl - Math.hypot(px - c.n[0] * s, py - c.n[1] * s, pz - c.n[2] * s), 0.004);
      }
    }
    return d;
  }
  const VES = [];
  // a vessel through control points [x, y, z, r], sampled into round cones; kj how softly it joins what it meets,
  // open lists its cut ends (0 start, 1 end); the wider ones show their lumen
  function vessel(ctrl, col, kj, open) {
    const cv = new THREE.CatmullRomCurve3(ctrl.map(q => V(q)), false, 'centripetal'), m = ctrl.length - 1;
    const at = t => { const s = t * m, j = Math.min(m - 1, Math.floor(s)); return [cv.getPoint(t).toArray(), lerp(ctrl[j][3], ctrl[j + 1][3], s - j)]; };
    const n = Math.max(2, Math.ceil(cv.getLength() / 0.03)), i0 = HP.length, ends = [];
    for (let i = 0; i < n; i++) { const [a, r1] = at(i / n), [b, r2] = at((i + 1) / n); rcone(a, b, r1, r2, 2, col); }
    for (const e of open || []) {
      const [p, r] = at(e), tn = v3.norm(v3.sub(p, at(e ? 1 - 0.5 / n : 0.5 / n)[0]));   // outward along the vessel
      const c = { e: p, n: tn, r };
      if (r >= 0.022) Object.assign(c, { l0: v3.sub(p, v3.mul(tn, 1.3 * r)), ll: 2.3 * r, rl: 0.64 * r });
      ends.push(c);
      // cutting the cones near the end is enough (the cut distributes over the vessel's minimum)
      for (let i = i0; i < HP.length; i++) { const q = HP[i]; if (Math.min(v3.dist(q.a, p), v3.dist(q.b, p)) < 1.6 * r + 0.03) (q.cuts = q.cuts || []).push(c); }
    }
    // a bounding sphere, so blocks far from the vessel skip its cones
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], rm = 0;
    for (let i = i0; i < HP.length; i++) for (const p of [HP[i].a, HP[i].b]) { lo = lo.map((v, c) => Math.min(v, p[c])); hi = hi.map((v, c) => Math.max(v, p[c])); rm = Math.max(rm, HP[i].r1, HP[i].r2); }
    VES.push({ i0, i1: HP.length, k: kj, ends, col, bc: v3.lerp(lo, hi, 0.5), br: v3.dist(lo, hi) / 2 + rm });
  }
  // the ventricles: the left a blunt cone ending in the apex, rounded at its left border; the right wrapped round its
  // front (where they meet, the interventricular grooves); a plane across the axis is their base, on which the
  // atria sit; the right ventricle's outflow tract rises to the pulmonary valve
  const TB = -0.068;
  const LV = rcone(vp(-0.05, -0.03, 0.035), vp(0.205, -0.01, 0.02), 0.11, 0.032, 0, MYO);
  const LVB = ellip(vp(0.05, -0.02, 0.045), AX, E1, [0.12, 0.085, 0.095], 0, MYO);
  const RV = ellip(vp(0.035, 0.068, -0.04), AX, E1, [0.15, 0.072, 0.105], 0, MYO);
  const CON = rcone(vp(-0.02, 0.075, 0.015), [0.03, 0.125, 0.07], 0.055, 0.036, 0, MYO);
  // the atria: the right between the venae cavae, the left at the back; each with its auricle, a flat curved flap
  // (flattened ellipsoids), the right one over the aortic root, the left beside the pulmonary trunk
  const RA = ellip([-0.125, 0.065, -0.03], [0.1, 1, 0.1], [1, 0, 0], [0.08, 0.062, 0.066], 1, ATR);
  const LAT = ellip([0.025, 0.095, -0.115], [1, 0, 0], [0, 1, 0], [0.095, 0.055, 0.055], 1, ATR);
  const RAU = [ellip([-0.095, 0.105, 0.04], [0.7, 0.2, 0.68], [0, 1, 0], [0.048, 0.036, 0.014], 1, ATR),
    ellip([-0.055, 0.115, 0.072], [0.88, 0.12, 0.45], [0, 1, 0], [0.032, 0.026, 0.011], 1, ATR),
    ellip([-0.028, 0.12, 0.085], [1, 0.05, 0.25], [0, 1, 0], [0.018, 0.014, 0.008], 1, ATR)];
  const LAU = [ellip([0.11, 0.115, -0.035], [0.15, 0.05, 1], [0, 1, 0], [0.048, 0.03, 0.02], 1, ATR),
    ellip([0.105, 0.112, 0.01], [-0.25, -0.05, 1], [0, 1, 0], [0.042, 0.026, 0.017], 1, ATR),
    ellip([0.085, 0.105, 0.045], [-0.6, -0.15, 0.78], [0, 1, 0], [0.03, 0.02, 0.013], 1, ATR)];
  const BODY = [LV, LVB, RV, CON, RA, LAT, ...RAU, ...LAU], NBD = HP.length;
  // aorta (ascending, arch, descending) and the arch's three branches; pulmonary trunk and arteries (the right one
  // passes behind the aorta and the superior vena cava); venae cavae; four pulmonary veins into the left atrium
  vessel([[-0.005, 0.06, -0.02, 0.037], [-0.012, 0.13, 0, 0.04], [-0.022, 0.19, 0.01, 0.035], [-0.012, 0.245, 0, 0.034], [0.025, 0.28, -0.035, 0.032],
    [0.075, 0.28, -0.09, 0.03], [0.1, 0.24, -0.15, 0.028], [0.108, 0.15, -0.2, 0.027], [0.105, 0.04, -0.215, 0.026], [0.1, -0.07, -0.215, 0.026]], AOR, 0.014, [1]);
  vessel([[0, 0.275, -0.02, 0.015], [-0.018, 0.33, -0.02, 0.0145], [-0.04, 0.38, -0.015, 0.0135]], AOR, 0.008, [1]);
  vessel([[0.038, 0.29, -0.05, 0.0095], [0.042, 0.34, -0.055, 0.0092], [0.046, 0.385, -0.055, 0.009]], AOR, 0.007, [1]);
  vessel([[0.07, 0.285, -0.085, 0.0108], [0.09, 0.33, -0.095, 0.0105], [0.115, 0.37, -0.1, 0.0102]], AOR, 0.007, [1]);
  vessel([[0.025, 0.105, 0.065, 0.034], [0.04, 0.155, 0.055, 0.033], [0.05, 0.19, 0.02, 0.031], [0.045, 0.2, -0.03, 0.028]], PUL, 0.012);
  vessel([[0.045, 0.2, -0.03, 0.024], [0.08, 0.212, -0.06, 0.022], [0.108, 0.205, -0.095, 0.02], [0.135, 0.19, -0.115, 0.019]], PUL, 0.01, [1]);
  vessel([[0.045, 0.2, -0.03, 0.024], [0, 0.192, -0.07, 0.022], [-0.06, 0.185, -0.085, 0.021], [-0.115, 0.172, -0.1, 0.019]], PUL, 0.01, [1]);
  vessel([[-0.105, 0.36, -0.015, 0.026], [-0.11, 0.28, -0.012, 0.027], [-0.12, 0.2, -0.02, 0.028], [-0.125, 0.12, -0.025, 0.029]], VEN, 0.016, [0]);
  vessel([[-0.125, 0.02, -0.06, 0.028], [-0.12, -0.05, -0.085, 0.028], [-0.115, -0.13, -0.1, 0.027]], VEN, 0.016, [1]);
  for (const [x0, s, y] of [[-0.02, -1, 0.13], [-0.02, -1, 0.075], [0.09, 1, 0.13], [0.09, 1, 0.075]])
    vessel([[x0, y, -0.13, 0.013], [x0 + s * 0.045, y + 0.003, -0.155, 0.0122], [x0 + s * 0.085, y + 0.006, -0.185, 0.011]], PVN, 0.01, [1]);
  const NP = HP.length, HDS = new Float64Array(NP), HDV = new Float64Array(VES.length);
  const ALL = { b: BODY, v: VES.map((q, j) => [j, [...Array(q.i1 - q.i0).keys()].map(i => q.i0 + i)]) };
  let WIN = null;   // the window, once placed: centre c on the surface, normal n, radius r, depth dep
  const winD = (x, y, z) => { const W = WIN, px = x - W.c[0], py = y - W.c[1], pz = z - W.c[2], s = px * W.n[0] + py * W.n[1] + pz * W.n[2];
    const dr = Math.sqrt(Math.max(0, px * px + py * py + pz * pz - s * s)) - W.r, da = -W.dep - s;
    return Math.hypot(Math.max(dr, 0), Math.max(da, 0)) + Math.min(Math.max(dr, da), 0); };
  const baseD = (x, y, z) => TB - ((x - V0[0]) * AX[0] + (y - V0[1]) * AX[1] + (z - V0[2]) * AX[2]);
  // the field at a point, from the primitives in act ({ b: body ids, v: [vessel, its cones], w: the window matters };
  // the rest are too far to matter); fills HDS (body) and HDV (vessels), and out (if given) with the ventricles and
  // atria alone
  function field(x, y, z, act, out) {
    for (let i = 0; i < NBD; i++) HDS[i] = 1e9;
    for (let j = 0; j < act.b.length; j++) { const i = act.b[j]; HDS[i] = hd(HP[i], x, y, z); }
    // the groove between the ventricles fades out towards the apex, so the apex is one rounded tip
    const kv = 0.03 + 0.07 * clamp((TB - baseD(x, y, z) - 0.08) / 0.09, 0, 1);
    const v0 = smin(smax(smin(smin(HDS[LV], HDS[LVB], 0.05), HDS[RV], kv), baseD(x, y, z), 0.05), HDS[CON], 0.035);
    const v = WIN && act.w !== false ? smax(v0, -winD(x, y, z), 0.007) : v0;   // the window cuts the ventricles only
    const ra = smin(smin(smin(HDS[RAU[0]], HDS[RAU[1]], 0.025), HDS[RAU[2]], 0.012), HDS[RA], 0.03);
    const la = smin(smin(smin(HDS[LAU[0]], HDS[LAU[1]], 0.02), HDS[LAU[2]], 0.015), HDS[LAT], 0.022);
    const a = smin(ra, la, 0.03);
    let f = smin(v, a, 0.02);
    if (out) { out.v = v0; out.a = a; }
    HDV.fill(1e9);
    for (let j = 0; j < act.v.length; j++) {
      const vi = act.v[j][0], segs = act.v[j][1]; let m = 1e9;
      for (let s = 0; s < segs.length; s++) { const d = hd(HP[segs[s]], x, y, z); if (d < m) m = d; }
      HDV[vi] = m; f = smin(f, m, VES[vi].k);
    }
    return f;
  }
  // the gradient (tetrahedral differences) of f(x, y, z), not normalised; a Newton step onto f = 0
  const grad = (f, p, e = 0.0012) => { const a = f(p[0] + e, p[1] - e, p[2] - e), b = f(p[0] - e, p[1] - e, p[2] + e), c = f(p[0] - e, p[1] + e, p[2] - e), d = f(p[0] + e, p[1] + e, p[2] + e);
    return [(a - b - c + d) / (4 * e), (-a - b + c + d) / (4 * e), (-a + b - c + d) / (4 * e)]; };
  const newton = (f, p, lim = 0.02) => { const d = f(p[0], p[1], p[2]), g = grad(f, p), l2 = v3.dot(g, g) || 1, s = clamp(d / l2, -lim, lim); return v3.sub(p, v3.mul(g, s)); };
  // the window: on the right ventricle's front, its axis along the surface normal there
  {
    const fAll = (x, y, z) => field(x, y, z, ALL);
    let p = vp(0.06, 0.2, -0.035);
    for (let it = 0; it < 10; it++) p = newton(fAll, p);
    WIN = { c: p, n: v3.norm(grad(fAll, p)), r: 0.05, dep: 0.03 };
  }
  // a vertex's colour and tissue weights for the beat ([r, g, b, ventricles, atria]), from the distances field()
  // left in HDS and HDV: a soft blend of the nearest parts, cut ends with a dark lumen, the window's walls and floor,
  // and a faint mottle
  function heartVertex(p, act, out) {
    const x = p[0], y = p[1], z = p[2], bd = baseD(x, y, z), cand = [];
    for (const i of act.b) cand.push([i === LV || i === LVB || i === RV ? Math.max(HDS[i], bd) : HDS[i], HP[i]]);
    for (const [vi] of act.v) cand.push([HDV[vi] - 0.005, HP[VES[vi].i0]]);   // vessels win where they meet the body
    let dm = 1e9; for (const c of cand) dm = Math.min(dm, c[0]);
    let sw = 0; const col = [0, 0, 0], wt = [0, 0, 0];
    for (const [d, q] of cand) { const w = Math.exp(-(d - dm) / 0.0018); if (w < 1e-4) continue; sw += w; wt[q.g] += w; for (let c = 0; c < 3; c++) col[c] += q.col[c] * w; }
    for (let c = 0; c < 3; c++) { col[c] /= sw; wt[c] /= sw; }
    let k = 1 + 0.07 * Math.sin(71 * x + 1.3) * Math.sin(63 * y + 0.7) * Math.sin(57 * z + 2.1) + 0.04 * Math.sin(173 * x + 2 * y) * Math.sin(151 * z - 3 * y);
    for (const [vi] of act.v) for (const e of VES[vi].ends) {
      const px = x - e.e[0], py = y - e.e[1], pz = z - e.e[2], s = px * e.n[0] + py * e.n[1] + pz * e.n[2];
      if (s < -1.5 * e.r - 0.005 || s > 0.006) continue;
      const rho = Math.sqrt(Math.max(0, px * px + py * py + pz * pz - s * s));
      if (e.rl && rho < e.rl + 0.003) k = 0.22;                                                    // inside the lumen
      else if (s > -0.003 && rho < e.r + 0.003) k = e.rl ? 1.25 : rho < 0.6 * e.r ? 0.25 : 1.25;   // the cut face
    }
    if (WIN && act.w !== false && Math.abs(winD(x, y, z)) < 0.005 && out.v < -0.0015) {   // the window's walls (cut muscle) and floor
      const s = v3.dot(v3.sub(p, WIN.c), WIN.n);
      if (s < -WIN.dep + 0.003) col.splice(0, 3, 0.2, 0.025, 0.05); else col.splice(0, 3, 0.66, 0.2, 0.26);
      wt[0] = 1; wt[1] = wt[2] = 0;
    }
    return [col[0] * k, col[1] * k, col[2] * k, wt[0], wt[1]];
  }
  let HAT = () => ALL, HSURF = null;   // the primitives that matter near a point (once polygonised); the surface's geometry
  // polygonise: blocks of 4 cells are classified from their centres (outside, inside, or near the surface with the
  // primitives that can matter there), and only blocks near the surface are sampled; then surface nets, each vertex
  // pulled onto the surface, with the field's gradient as its normal, darkened in the grooves
  const HJ = { until: 0 }, late = () => performance.now() > HJ.until;
  function* polygonise() {
    const h = 0.0065, lo = [-0.24, -0.275, -0.265], hi = [0.245, 0.46, 0.175], BS = 4;
    const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
    const F = new Float32Array(nx * ny * nz).fill(1), done = new Uint8Array(nx * ny * nz), id = (i, j, k) => (i * ny + j) * nz + k;
    const bx = Math.ceil((nx - 1) / BS), by = Math.ceil((ny - 1) / BS), bz = Math.ceil((nz - 1) / BS), bid = (i, j, k) => (i * by + j) * bz + k;
    const ACT = new Array(bx * by * bz).fill(null), rb = Math.sqrt(3) * BS * h / 2, dc = new Float64Array(NP), hot = [];
    for (let I = 0; I < bx; I++) for (let J = 0; J < by; J++) {
      for (let L = 0; L < bz; L++) {
        if (late()) yield;
        const cx = lo[0] + (I + 0.5) * BS * h, cy = lo[1] + (J + 0.5) * BS * h, cz = lo[2] + (L + 0.5) * BS * h, bd = baseD(cx, cy, cz);
        let low = 1e9, up = 1e9;
        for (let j = 0; j < NBD; j++) {
          const d = dc[j] = hd(HP[j], cx, cy, cz); if (d < low) low = d;
          const u = j === LV || j === LVB || j === RV ? Math.max(d, bd) + 0.013 : d; if (u < up) up = u;   // the base cuts the ventricles
        }
        const near = [];
        for (let j = 0; j < VES.length; j++) {
          const q = VES[j], c = q.bc; if (Math.hypot(cx - c[0], cy - c[1], cz - c[2]) - q.br - rb > up + rb + q.k) continue;
          for (let i = q.i0; i < q.i1; i++) { const d = dc[i] = hd(HP[i], cx, cy, cz); if (d < low) low = d; if (d < up) up = d; }
          near.push(j);
        }
        if (low - rb > 0.045) continue;   // outside, beyond what any blend can pull in
        const lim = up + rb, act = { b: BODY.filter(i => dc[i] - rb <= lim + 0.05), v: [], w: winD(cx, cy, cz) < rb + 0.01 };
        for (const j of near) { const q = VES[j], segs = []; for (let i = q.i0; i < q.i1; i++) if (dc[i] - rb <= lim + q.k) segs.push(i); if (segs.length) act.v.push([j, segs]); }
        // the field changes no faster than the distance (a little faster near flat ellipsoids): no surface in the
        // block unless its centre is within reach
        const fc = field(cx, cy, cz, act);
        if (fc > 1.5 * rb) continue;
        const i1 = Math.min(I * BS + BS, nx - 1), j1 = Math.min(J * BS + BS, ny - 1), k1 = Math.min(L * BS + BS, nz - 1);
        if (fc < -1.5 * rb) {   // inside: mark what no sampled block has written
          for (let i = I * BS; i <= i1; i++) for (let j = J * BS; j <= j1; j++) for (let k = L * BS; k <= k1; k++) if (F[id(i, j, k)] === 1) F[id(i, j, k)] = -1;
          continue;
        }
        ACT[bid(I, J, L)] = act; hot.push([I, J, L]);
        for (let i = I * BS; i <= i1; i++) for (let j = J * BS; j <= j1; j++) for (let k = L * BS; k <= k1; k++) {
          const q = id(i, j, k); if (!done[q]) { F[q] = field(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h, act); done[q] = 1; }
        }
      }
    }
    HAT = p => { const I = Math.floor((p[0] - lo[0]) / (BS * h)), J = Math.floor((p[1] - lo[1]) / (BS * h)), L = Math.floor((p[2] - lo[2]) / (BS * h));
      return (I < 0 || J < 0 || L < 0 || I >= bx || J >= by || L >= bz ? null : ACT[bid(I, J, L)]) || ALL; };
    const gridAt = (x, y, z, open) => {   // trilinear, from sampled values only (outside the sampled shell: open, inside: shut)
      const u = (x - lo[0]) / h, v = (y - lo[1]) / h, w = (z - lo[2]) / h, i = Math.floor(u), j = Math.floor(v), k = Math.floor(w);
      if (i < 0 || j < 0 || k < 0 || i >= nx - 1 || j >= ny - 1 || k >= nz - 1) return open;
      const a = u - i, b = v - j, c = w - k; let s = 0;
      for (let q = 0; q < 8; q++) { const val = F[id(i + (q & 1), j + (q >> 1 & 1), k + (q >> 2 & 1))]; if (val === 1) return open; if (val === -1) return -0.01; s += val * (q & 1 ? a : 1 - a) * (q & 2 ? b : 1 - b) * (q & 4 ? c : 1 - c); }
      return s;
    };
    const ny1 = ny - 1, nz1 = nz - 1, VI = new Int32Array((nx - 1) * ny1 * nz1).fill(-1), cid = (i, j, k) => (i * ny1 + j) * nz1 + k;
    const P = [], N = [], C = [], M = [], out = {}, cv = new Float64Array(8);
    const EG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (let b = 0; b < hot.length; b++) {
      if (late()) yield;
      const [I, J, L] = hot[b], act = ACT[bid(I, J, L)], f = (x, y, z) => field(x, y, z, act);
      for (let i = I * BS; i < Math.min(I * BS + BS, nx - 1); i++) for (let j = J * BS; j < Math.min(J * BS + BS, ny - 1); j++) for (let k = L * BS; k < Math.min(L * BS + BS, nz - 1); k++) {
        let neg = 0;
        for (let c = 0; c < 8; c++) { cv[c] = F[id(i + (c & 1), j + (c >> 1 & 1), k + (c >> 2 & 1))]; if (cv[c] < 0) neg++; }
        if (neg === 0 || neg === 8) continue;
        let sx = 0, sy = 0, sz = 0, ne = 0;
        for (const [a, b] of EG) {
          if ((cv[a] < 0) === (cv[b] < 0)) continue;
          const t = cv[a] / (cv[a] - cv[b]);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; ne++;
        }
        const p0 = [lo[0] + (i + sx / ne) * h, lo[1] + (j + sy / ne) * h, lo[2] + (k + sz / ne) * h];
        const d = field(p0[0], p0[1], p0[2], act, out), col = heartVertex(p0, act, out);
        const g = grad(f, p0), l2 = v3.dot(g, g) || 1, p = v3.sub(p0, v3.mul(g, clamp(d / l2, -h, h))), n = v3.norm(g);
        let occ = 0, w0 = 1;   // occlusion: how far the field stays below the distance along the normal
        for (let s = 1; s <= 3; s++) { const dd = 0.013 * s; occ += Math.max(0, dd - gridAt(p[0] + n[0] * dd, p[1] + n[1] * dd, p[2] + n[2] * dd, dd)) * w0; w0 *= 0.6; }
        const ko = clamp(1 - 10 * occ, 0.4, 1);
        VI[cid(i, j, k)] = P.length / 3; P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); C.push(col[0] * ko, col[1] * ko, col[2] * ko); M.push(col[3], col[4], 0);
      }
    }
    // faces: one quad round every grid edge the surface crosses, wound to face out
    const I3 = [];
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I3.push(a, c, b, a, d, c); else I3.push(a, b, c, a, c, d); };
    for (let b = 0; b < hot.length; b++) {
      if (late()) yield;
      const [I, J, L] = hot[b];
      for (let i = I * BS; i < Math.min(I * BS + BS, nx - 1); i++) for (let j = J * BS; j < Math.min(J * BS + BS, ny - 1); j++) for (let k = L * BS; k < Math.min(L * BS + BS, nz - 1); k++) {
      const v0 = F[id(i, j, k)] < 0;
      if (j > 0 && k > 0 && v0 !== F[id(i + 1, j, k)] < 0) quad(VI[cid(i, j - 1, k - 1)], VI[cid(i, j, k - 1)], VI[cid(i, j, k)], VI[cid(i, j - 1, k)], !v0);
      if (i > 0 && k > 0 && v0 !== F[id(i, j + 1, k)] < 0) quad(VI[cid(i - 1, j, k - 1)], VI[cid(i - 1, j, k)], VI[cid(i, j, k)], VI[cid(i, j, k - 1)], !v0);
      if (i > 0 && j > 0 && v0 !== F[id(i, j, k + 1)] < 0) quad(VI[cid(i - 1, j - 1, k)], VI[cid(i, j - 1, k)], VI[cid(i, j, k)], VI[cid(i - 1, j, k)], !v0);
      }
    }
    // the surface's own geometry, written a few arrays per slice
    const g = HSURF = new THREE.BufferGeometry(), put = (k, a, n) => g.setAttribute(k, new THREE.BufferAttribute(a, n)), nv = P.length / 3;
    put('position', new Float32Array(P), 3); yield 'slice';
    put('normal', new Float32Array(N), 3); put('color', new Float32Array(C), 3); yield 'slice';
    put('aM', new Float32Array(M), 3); put('aSite', new Float32Array(nv).fill(H5.aSite), 1);
    const gc = new Float32Array(nv * 3); for (let i = 0; i < nv; i++) gc.set(H5.aGC, i * 3); put('aGC', gc, 3); yield 'slice';
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(I3), 1)); g.computeBoundingSphere(); yield 'slice';
  }
  // coronary vessels in their grooves: guesses pulled onto the crease between two parts, then onto the surface; each
  // tapers at its ends and sinks into the surface there
  const PO = {}, fNear = (x, y, z) => field(x, y, z, HAT([x, y, z]));
  const creaseIV = (x, y, z) => { field(x, y, z, HAT([x, y, z])); return HDS[RV] - smin(HDS[LV], HDS[LVB], 0.05); };   // between the ventricles
  const creaseAV = (x, y, z) => { field(x, y, z, HAT([x, y, z]), PO); return PO.a - PO.v; };                         // between atria and ventricles
  function groove(guess, crease, n) {
    const cv = new THREE.CatmullRomCurve3(guess.map(V)), out = [];
    for (let i = 0; i <= n; i++) {
      let p = cv.getPoint(i / n).toArray();
      for (let it = 0; it < 6; it++) { if (crease) p = newton(crease, p, 0.01); p = newton(fNear, p, 0.01); }
      out.push(p);
    }
    return out;
  }
  const wts = p => { field(p[0], p[1], p[2], HAT(p), PO); const m = Math.min(PO.a, PO.v), a = Math.exp(-(PO.a - m) / 0.006), v = Math.exp(-(PO.v - m) / 0.006); return [v / (a + v), a / (a + v), 0]; };
  const CA = K.rgb('#ee5a48'), CV = K.rgb('#8a7cf0');
  const taper = u => Math.sqrt(clamp(Math.min(u, 1 - u) / 0.06, 0, 1));
  const cor = (pts, r, col) => {
    const lifted = pts.map((p, i) => { const tp = taper(i / (pts.length - 1)); return v3.add(p, v3.mul(v3.norm(grad(fNear, p)), r * (0.45 * tp - 0.8 * (1 - tp)))); });
    const t = tubeR(lifted, Math.max(12, pts.length * 3), 8, u => r * (1 - 0.45 * u) * Math.max(0.15, taper(u))), P = t.attributes.position.array, A = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) A.set(wts([P[i], P[i + 1], P[i + 2]]), i);
    t.setAttribute('aM', new THREE.BufferAttribute(A, 3));
    heartB.add(t, Object.assign({ color: col }, H5));
    return pts;
  };
  function* coronaries() {
    const LAD = cor([...groove([vp(-0.04, 0.13, 0.07), vp(0.02, 0.13, 0.06), vp(0.08, 0.12, 0.05), vp(0.14, 0.1, 0.04)], creaseIV, 12),
      ...groove([vp(0.175, 0.07, 0.03), vp(0.21, 0.03, 0.01)], null, 3)], 0.0062, CA);
    yield 'slice';
    cor(groove([vp(0.0, 0.11, 0.08), vp(0.06, 0.09, 0.11), vp(0.12, 0.05, 0.12)], null, 8), 0.0045, CA);                            // a diagonal branch
    yield 'slice';
    cor(groove([[0.085, 0.085, 0.045], [0.135, 0.06, -0.02], [0.145, 0.04, -0.09], [0.1, 0.02, -0.15]], creaseAV, 10), 0.0052, CA);   // circumflex
    yield 'slice';
    cor(groove([[-0.05, 0.085, 0.085], [-0.11, 0.035, 0.08], [-0.16, -0.005, 0.02], [-0.15, -0.03, -0.06], [-0.09, -0.06, -0.11]], creaseAV, 14), 0.0056, CA);   // right coronary
    yield 'slice';
    cor(LAD.slice(0, 13).map(p => newton(fNear, newton(fNear, v3.add(p, v3.mul(EL, 0.012)), 0.01), 0.01)), 0.0042, CV);         // anterior interventricular vein
    yield 'slice';
  }
  // the window's cells: branched, striated heart muscle cells side by side on its floor, running on into its walls
  {
    const W = WIN, ua = v3.norm(v3.cross(W.n, Math.abs(W.n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), ub = v3.cross(W.n, ua);
    const e = v3.add(v3.mul(ua, Math.cos(0.5)), v3.mul(ub, Math.sin(0.5))), side = v3.cross(W.n, e), rc = 0.0068;
    const mid = v3.sub(W.c, v3.mul(W.n, W.dep - rc - 0.0005)), CELL = K.rgb('#d4566a'), rows = [];
    const band = (o, d, s0) => (x, y, z) => [v3.dot(v3.sub([x, y, z], o), d) + s0, 1, 0];
    for (let o = -W.r + 0.008, n = 0; o <= W.r - 0.008; o += 0.0172, n++) {
      const hl = Math.sqrt(Math.max(0, (W.r + 0.005) ** 2 - o * o)), c = v3.add(mid, v3.mul(side, o));
      hfB.add(tubeR([v3.sub(c, v3.mul(e, hl)), c, v3.add(c, v3.mul(e, hl))], 24, 10, rc), { color: CELL, aSite: 5, aGC: sc(5, 0), aF: band(c, e, n * 0.031), aTwA: NOTW });
      rows.push({ c, hl: Math.sqrt(Math.max(0, (W.r - 0.006) ** 2 - o * o)) });
    }
    for (let k = 0; k + 1 < rows.length; k++) {   // branches joining neighbouring cells
      const s0 = ((k * 3) % 5 - 2) * 0.008, lim = Math.min(rows[k].hl, rows[k + 1].hl) - 0.012;
      if (Math.abs(s0) > lim) continue;
      const a = v3.add(rows[k].c, v3.mul(e, s0 - 0.009)), b = v3.add(rows[k + 1].c, v3.mul(e, s0 + 0.009));
      hfB.add(tubeR([a, v3.lerp(a, b, 0.5), b], 8, 8, rc * 0.62), { color: CELL, aSite: 5, aGC: sc(5, 0), aF: band(a, v3.norm(v3.sub(b, a)), 0), aTwA: NOTW });
    }
  }
  // the job: polygonise, then the coronaries, then let go of the grids. heartStep(ms) runs it for about ms, ending a
  // slice early where a step asks for one ('slice'); when it is done, the meshes take their geometry (heartDone)
  let heartJob = (function* () { yield* polygonise(); yield* coronaries(); HAT = () => ALL; })(), heartDone = null, heartIn = 0;
  function heartStep(ms) {
    if (!heartJob) return;
    HJ.until = performance.now() + ms;
    try {
      for (let r = heartJob.next(); !r.done; r = heartJob.next()) if (r.value === 'slice' || late()) return;
    } catch (e) { console.error('motor: the heart could not be built', e); heartJob = null; return; }
    heartJob = null;
    if (heartDone) heartDone();
  }
  const sliceMs = dt => clamp((dt || 0.016) * 120, 1, 2.5);   // about an eighth of a frame

  // ------------------------------------------------------------------ the sarcomere (hexagonal lattice)
  const LA = 0.054, SL = 0.27, TL = 0.20, BZ = 0.024, THN = 0.17;
  const sarB = Builder(Object.assign({ aM: 3 }, LITS));
  const sgp = new THREE.Group();
  const thick = [], thin = [], has = new Set(), key = (i, j) => i + ',' + j, axl = (i, j) => [LA * (i + j / 2), LA * j * Math.sqrt(3) / 2];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (Math.abs(i + j) <= 3) { thick.push(axl(i, j)); has.add(key(i, j)); }
  for (const k of has) {
    const [i, j] = k.split(',').map(Number), c3 = l => l.reduce((s, q) => [s[0] + axl(...q)[0] / 3, s[1] + axl(...q)[1] / 3], [0, 0]);
    if (has.has(key(i + 1, j)) && has.has(key(i, j + 1))) thin.push(c3([[i, j], [i + 1, j], [i, j + 1]]));
    if (has.has(key(i + 1, j)) && has.has(key(i, j + 1)) && has.has(key(i + 1, j + 1))) thin.push(c3([[i + 1, j], [i, j + 1], [i + 1, j + 1]]));
  }
  const ACT = K.rgb('#4cc7ff'), MYS = K.rgb('#ffb43b'), HEAD = K.rgb('#ff9c52'), TTN = K.rgb('#3ee08f'), ZD = K.rgb('#b07bff'), MB = K.rgb('#c9b8ff');
  const S6 = { aSite: 6, aGC: sc(4, 0) }, S7 = { aSite: 7, aGC: sc(5, 0) };
  const HD = { P: [], N: [], M: [], I: [] };
  // head half-sizes: long axis and the two short ones (kept small so the inside-lattice camera sees a corridor, not blobs)
  const HA = 0.0036, HB = 0.0024, HC_ = 0.0021;
  // thick filaments (myosin): backbone, bare zone in the middle, heads in a three-stranded helix pointing to the Z-discs
  thick.forEach(([y, z], fi) => {
    sarB.add(tubeFn(u => [lerp(-TL, TL, u), y, z], 20, 6, u => 0.0062 * (1 - 0.5 * smooth((Math.abs(2 * u - 1) - 0.9) / 0.1))), Object.assign({ color: MYS, aM: [0, 0, 0] }, S7));
    // (all heads go into one plain geometry, written directly: 3,108 small adds would be slow)
    const a0 = R() * TAU, OP = OCT.attributes.position.array;
    for (const sx of [-1, 1]) for (let k = 0; k < 14; k++) for (let h = 0; h < 3; h++) {
      const a = a0 + k * 0.698 + h * TAU / 3, rr = [0, Math.cos(a), Math.sin(a)], x = sx * (BZ + 0.004 + k * 0.0125);
      const dir = v3.norm(v3.add(v3.mul(rr, Math.cos(0.6)), [sx * Math.sin(0.6), 0, 0])), p1 = v3.norm(v3.cross(dir, [1, 0, 0])), p2 = v3.cross(dir, p1);
      const c = v3.add(v3.add([x, y, z], v3.mul(rr, 0.0064)), v3.mul(dir, 0.0046)), ph = R(), base = HD.P.length / 3;
      for (let q = 0; q < 6; q++) {
        const ox = OP[q * 3], oy = OP[q * 3 + 1], oz = OP[q * 3 + 2];
        const px = c[0] + dir[0] * ox * HA + p1[0] * oy * HB + p2[0] * oz * HC_, py = c[1] + dir[1] * ox * HA + p1[1] * oy * HB + p2[1] * oz * HC_,
          pz = c[2] + dir[2] * ox * HA + p1[2] * oy * HB + p2[2] * oz * HC_;
        const nx = dir[0] * ox / HA + p1[0] * oy / HB + p2[0] * oz / HC_, ny = dir[1] * ox / HA + p1[1] * oy / HB + p2[1] * oz / HC_,
          nz = dir[2] * ox / HA + p1[2] * oy / HB + p2[2] * oz / HC_, nl = Math.hypot(nx, ny, nz);
        HD.P.push(px, py, pz); HD.N.push(nx / nl, ny / nl, nz / nl);
        HD.M.push(0, clamp((Math.hypot(py - y, pz - z) - 0.006) / 0.009, 0, 1), ph);
      }
      for (const ix of OCT.index.array) HD.I.push(base + ix);
    }
    // titin: from the Z-disc, a spring through the I-band, then along the thick filament to the M-band
    for (const sx of [-1, 1]) {
      const a = R() * TAU, rd = [0, Math.cos(a), Math.sin(a)], t2 = [0, -Math.sin(a), Math.cos(a)], UC = 0.62;
      const tf = u => {
        if (u < UC) { const v = u / UC, x = sx * lerp(SL, TL, v), rho = lerp(0.013, 0.0085, v), w = TAU * 5 * v;
          return v3.add([x, y, z], v3.add(v3.mul(rd, rho + 0.0028 * Math.cos(w)), v3.mul(t2, 0.0028 * Math.sin(w)))); }
        const v = (u - UC) / (1 - UC), e0 = v3.add([sx * TL, y, z], v3.mul(rd, 0.0113));
        return v3.lerp(e0, v3.add([sx * 0.012, y, z], v3.mul(rd, 0.0078)), smooth(Math.min(1, v * 1.15)) * 0.98 + v * 0.02);
      };
      sarB.add(tubeFn(tf, 56, 3, 0.0013), Object.assign({ color: TTN, aM: x => [clamp((Math.abs(x) - TL) / (SL - TL), 0, 1), 0, 0] }, S6));
    }
  });
  {
    const at = (arr, n) => ({ array: new Float32Array(arr), itemSize: n, count: arr.length / n });
    sarB.add({ attributes: { position: at(HD.P, 3), normal: at(HD.N, 3), aM: at(HD.M, 3) }, index: { array: HD.I } }, Object.assign({ color: HEAD }, S7));
  }
  // thin filaments (actin): two beaded strands twisting round each other (one tube with a two-lobed, beaded
  // cross-section), from each Z-disc towards the middle
  thin.forEach(([y, z]) => {
    for (const sx of [-1, 1]) {
      const ph = R() * TAU, NB = 23;
      const ar = (u, a) => {
        const tw = TAU * u * THN / 0.075 + ph, tip = 1 - 0.6 * smooth((u - 0.965) / 0.035);
        let best = 0;
        for (let s = 0; s < 2; s++) {
          const rb = (0.002 + 0.0004 * Math.cos(TAU * (u * NB + s * 0.5))) * tip, dp = a - tw - s * PI, d = 0.0017 * tip, sn = d * Math.sin(dp);
          best = Math.max(best, d * Math.cos(dp) + Math.sqrt(Math.max(0, rb * rb - sn * sn)));
        }
        return best;
      };
      sarB.add(tubeFn(u => [sx * (SL - u * THN), y, z], NB * 2, 8, ar), Object.assign({ color: ACT, aM: [1, 0, 0] }, S6));
    }
  });
  // Z-discs: two zigzag layers of struts joining the thin filaments' ends, posts between them, a hexagonal frame
  const near = (list, d0) => { const out = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (Math.hypot(list[i][0] - list[j][0], list[i][1] - list[j][1]) < d0) out.push([list[i], list[j]]); return out; };
  const zE = near(thin, LA / Math.sqrt(3) * 1.15), mE = near(thick, LA * 1.1);
  for (const sx of [-1, 1]) {
    for (const [lay, off] of [[0, -0.0035], [1, 0.0035]]) zE.forEach(([a, b], k) => {
      if ((k + lay) % 2) sarB.add(CYL, Object.assign({ color: ZD, aM: [1, 0, 0] }, S6), strutM([sx * (SL + off), a[0], a[1]], [sx * (SL + off), b[0], b[1]], 0.0017));
      else sarB.add(CYL, Object.assign({ color: ZD, aM: [1, 0, 0] }, S6), strutM([sx * (SL + off), a[0], a[1]], [sx * (SL - off), b[0], b[1]], 0.0015));
    });
    thin.forEach(([y, z]) => sarB.add(CYL, Object.assign({ color: ZD, aM: [1, 0, 0] }, S6), strutM([sx * (SL - 0.005), y, z], [sx * (SL + 0.005), y, z], 0.0026)));
    const cr = [[3, 0], [0, 3], [-3, 3], [-3, 0], [0, -3], [3, -3]].map(q => v3.mul(axl(...q), (3 * LA + 0.024) / (3 * LA)));
    for (let k = 0; k < 6; k++) { const a = cr[k], b = cr[(k + 1) % 6]; sarB.add(CYL6, Object.assign({ color: ZD, aM: [1, 0, 0] }, S6), strutM([sx * SL, a[0], a[1]], [sx * SL, b[0], b[1]], 0.0032)); }
    for (let k = 0; k < 6; k++) { const a = cr[k], c = thin.reduce((best, q) => (Math.hypot(q[0] - a[0], q[1] - a[1]) < Math.hypot(best[0] - a[0], best[1] - a[1]) ? q : best), thin[0]);
      sarB.add(CYL, Object.assign({ color: ZD, aM: [1, 0, 0] }, S6), strutM([sx * SL, a[0], a[1]], [sx * SL, c[0], c[1]], 0.0017)); }
  }
  // M-band: cross-links between neighbouring thick filaments, three layers
  for (const x of [-0.006, 0.006]) mE.forEach(([a, b], k) => sarB.add(CYL, Object.assign({ color: MB, aM: [0, 0, 0] }, S7), strutM([x, a[0], a[1]], [-x, b[0], b[1]], 0.0012)));

  // ------------------------------------------------------------------ meshes
  const greyMat = lit('grey', { base: 0.5, self: 0.32, rimK: 0.2, rimC: [0.95, 0.7, 0.95] });
  const somaMat = lit('soma', { base: 0.66, self: 0.32, rimK: 0.75, rimC: [1, 0.85, 0.5], vh: TWV + PLV, vb: TWB + TWE + PLB, fh: PLF, fe: PLE });
  const nucMat = lit('nuc', { self: 0.35, rimK: 0.4 });
  const neuMat = lit('neu', { self: 0.28, rimK: 0.45, rimC: [1, 0.85, 0.55], vh: TWV + PLV, vb: TWB + TWE + PLB, fh: PLF, fe: PLE });
  const myeMat = lit('mye', { base: 0.5, rough: 0.2, self: 0.1, rimK: 0.75, rimC: [0.75, 0.88, 1] });
  const STRI = `
float bb = vBand / 0.018; float fw = fwidth(bb); float fr = fract(bb); float dz = min(fr, 1.0 - fr);
float aB = smoothstep(0.2 - fw, 0.2 + fw, dz), hB = smoothstep(0.37 - fw, 0.37 + fw, dz), mB = smoothstep(0.465 - fw, 0.465 + fw, dz);
float zB = 1.0 - smoothstep(0.03, 0.03 + 1.5 * fw, dz);
float shd = mix(1.14, 0.7, aB) + 0.1 * hB - 0.1 * mB - 0.38 * zB;
if (vKind > 0.5 && vKind < 1.5) { float q = fract(bb / 7.0); float qd = min(q, 1.0 - q) * 7.0; shd += 0.55 * (1.0 - smoothstep(0.05, 0.05 + 1.5 * fw, qd)); }
shd = mix(0.88, shd, 1.0 - smoothstep(0.2, 0.42, fw));
diffuseColor.rgb *= shd;
if (!gl_FrontFacing) diffuseColor.rgb *= 0.4;`;
  const fibreMat = (key, build) => lit(key, { build, self: 0.13, rimK: 0.3, rimC: [1, 0.6, 0.7], side: THREE.DoubleSide, rough: 0.6,
    vh: TWV + `attribute vec3 aF; varying vec3 vRad; varying float vBand, vKind, vRole, vXo, vTw;`,
    vb: TWB + `if (aF.z > 2.5) rd *= smoothstep(0.05, 0.5, uOpen);` + TWE + `vRad = rd; vBand = aF.x; vKind = aF.y; vRole = aF.z; vXo = position.x; vTw = tw;`,
    fh: `uniform float uOpen; uniform vec3 uOpenDir; varying vec3 vRad; varying float vBand, vKind, vRole, vXo, vTw;`,
    fc: `
float oS = smoothstep(0.0, 0.5, uOpen);
if (vRole > 0.5 && vRole < 1.5 && vXo > 0.27 && dot(normalize(vRad), uOpenDir) > 1.0 - 1.5 * oS) discard;
if (vRole > 1.5 && vRole < 2.5 && oS > 0.3) discard;`,
    fcol: STRI, fe: `totalEmissiveRadiance += diffuseColor.rgb * 0.5 * vTw;` });
  const fibMat = fibreMat('fib', true), hfMat = fibreMat('hfib', false);
  const sarU = { uShift: { value: 0 }, uStroke: { value: 0 } };
  const sarMat = lit('sar', { build: false, self: 0.26, rimK: 0.45, rimC: [0.7, 0.85, 1], uniforms: sarU,
    vh: `attribute vec3 aM; uniform float uShift, uStroke;`,
    vb: `float sx = position.x < 0.0 ? -1.0 : 1.0;
transformed.x -= sx * aM.x * uShift;
transformed.x -= sx * aM.y * uStroke * (0.5 + 0.5 * sin(uTime * 7.0 + aM.z * 6.2832)) * 0.006;` });
  // the beat: aM weighs each vertex between ventricles (x) and atria (y); vessels stay still
  const heartU = { uSys: { value: 0 }, uAtr: { value: 0 }, uV0: { value: V(V0) }, uAc: { value: V([-0.05, 0.09, -0.07]) } };
  const heartMat = lit('heart', { build: false, self: 0.06, rimK: 0.3, rimC: K.rgb('#ff6d8f'), side: THREE.DoubleSide, rough: 0.48, tint: 0.3, uniforms: heartU,   // the disease colour mostly at the rim, so the anatomy stays
    vh: `attribute vec3 aM; uniform float uSys, uAtr; uniform vec3 uV0, uAc;`,
    vb: `transformed += aM.x * (uV0 - transformed) * (0.065 * uSys) + aM.y * (uAc - transformed) * (0.07 * uAtr);`,
    fcol: `if (!gl_FrontFacing) diffuseColor.rgb *= 0.3;` });
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uBuildX: SU.uBuildX, uSiteG: SU.uSiteG, uSiteD: SU.uSiteD },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 color, aGC; attribute float aSite, aGA;
uniform float uSiteG[8], uSiteD[8], uBuildX;
varying vec3 vN, vW, vC, vGC; varying float vGl, vDm, vBX, vGA;
void main() { int si = int(aSite + 0.5); vGl = uSiteG[si]; vDm = uSiteD[si]; vC = color; vGC = aGC; vGA = aGA; vBX = uBuildX - position.x;
  vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uA; varying vec3 vN, vW, vC, vGC; varying float vGl, vDm, vBX, vGA;
void main() { if (vBX < 0.0) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW); float r = pow(1.0 - abs(dot(n, v)), 2.2);
  vec3 col = vC * (0.5 + 0.8 * r) * vDm + vGC * vGl * (0.12 + 0.6 * r) + vec3(0.55, 0.9, 1.0) * smoothstep(0.035, 0.0, vBX);
  gl_FragColor = vec4(col, (0.03 + 0.42 * r) * vGA * uA); }`,
  });
  set.mats.push(glassMat);
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uSiteG: SU.uSiteG, uBuildX: SU.uBuildX },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aGC, aR; uniform float uSiteG[8], uBuildX; varying vec3 vC; varying float vG, vU, vS, vBX;
void main() { vC = aGC; vG = uSiteG[int(aR.x + 0.5)]; vU = aR.y; vS = aR.z; vBX = uBuildX - position.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA, uTime; varying vec3 vC; varying float vG, vU, vS, vBX;
void main() { if (vBX < 0.0 || vG < 0.003) discard; float c = pow(fract(vU - uTime * vS), 6.0);
  gl_FragColor = vec4(vC * (0.8 + 0.9 * c) + c * 0.2, (0.28 + 0.6 * c) * vG * uA); }`,
  });
  set.mats.push(ringMat);
  const PU = { uPh: SU.uPh, uP: SU.uP, uSig: SU.uSig, uHeartG: { value: 0 }, uBuildX: SU.uBuildX, uSiteG: SU.uSiteG, uSiteD: SU.uSiteD };
  const ptMat = K.points(set, { uniforms: PU,
    head: `attribute vec3 aQ; uniform float uPh, uP, uSig, uHeartG, uBuildX; uniform float uSiteG[8], uSiteD[8];`,
    vertex: `
float k = aQ.x, g = 1.0; int si = int(aQ.z + 0.5);
float d = uPh - aQ.y; d -= uP * floor(d / uP + 0.5);
if (k < 0.5) { g = uSig * exp(-d * d / 0.0022) * 1.6; gl_PointSize *= 0.6 + 0.6 * min(g, 1.0);
  mv.xyz += normalize(-mv.xyz) * 0.022 * length(modelViewMatrix[0].xyz); gl_Position = projectionMatrix * mv; }
else if (k < 1.5) g = 0.55 + 2.4 * uSig * exp(-d * d / 0.0025);
else if (k < 2.5) { float e = d > 0.0 ? d : 10.0; g = uSig * 1.6 * exp(-e / 0.06) * smoothstep(0.0, 0.012, e); }
else if (k < 3.5) g = uSiteG[si];
else g = uHeartG;
vA *= g * (k < 3.5 && k > 2.5 ? 1.0 : uSiteD[si]);
if (position.x > uBuildX) vA = 0.0;` });
  const ptGeo = K.pointsGeo(PTS.length), aQ = new Float32Array(PTS.length * 3);
  PTS.forEach((q, i) => {
    ptGeo.attributes.position.array.set(q.p, i * 3); ptGeo.attributes.aCol.array.set(q.c, i * 3);
    ptGeo.attributes.aSize.array[i] = q.s; ptGeo.attributes.aA.array[i] = q.a; aQ.set(q.q, i * 3);
  });
  ptGeo.setAttribute('aQ', new THREE.BufferAttribute(aQ, 3));
  ptGeo.computeBoundingSphere();
  const mesh = (B, mat, order, parent) => { const m = new THREE.Mesh(B.geo(), mat); m.frustumCulled = false; m.renderOrder = order; (parent || set.group).add(m); return m; };
  mesh(neuB, neuMat, 1); mesh(nucB, nucMat, 1); mesh(fibB, fibMat, 1);
  const sarMesh = mesh(sarB, sarMat, 2, sgp); set.group.add(sgp);
  // the heart's surface and its coronary vessels take their geometry when the job is done; the window's cells are ready now
  const heartMesh = new THREE.Mesh(new THREE.BufferGeometry(), heartMat), corMesh = new THREE.Mesh(new THREE.BufferGeometry(), heartMat), hfMesh = mesh(hfB, hfMat, 2, hg);
  for (const o of [heartMesh, corMesh]) { o.frustumCulled = false; o.renderOrder = 2; hg.add(o); }
  set.group.add(hg);
  heartDone = () => { heartMesh.geometry.dispose(); heartMesh.geometry = HSURF; corMesh.geometry.dispose(); corMesh.geometry = heartB.geo(); HSURF = null; };
  mesh(greyB, greyMat, 4); mesh(somaB, somaMat, 5); mesh(myeB, myeMat, 6);
  const glassMesh = new THREE.Mesh(glass.geo(), glassMat); glassMesh.renderOrder = 7; glassMesh.frustumCulled = false; set.group.add(glassMesh);
  const ringMesh = new THREE.Mesh(rings.geo(), ringMat); ringMesh.renderOrder = 8; ringMesh.frustumCulled = false; set.group.add(ringMesh);
  const ptsObj = new THREE.Points(ptGeo, ptMat); ptsObj.renderOrder = 9; ptsObj.frustumCulled = false; set.group.add(ptsObj);
  // magnifier lines from the myofibril's last sarcomere to the big one
  const NL = 28, lnGeo = K.linesGeo(NL), lnMat = K.lines(set);
  for (let i = 0; i < NL * 2; i++) lnGeo.attributes.aCol.array.set([0.6, 0.9, 1.0], i * 3);
  const lnObj = new THREE.LineSegments(lnGeo, lnMat); lnObj.renderOrder = 9; lnObj.frustumCulled = false; set.group.add(lnObj);
  const SRC = [0.693, MY.hi.y, MY.hi.z], SRCS = PER / (2 * SL);

  // ------------------------------------------------------------------ update
  const G = SU.uSiteG.value, D = SU.uSiteD.value;
  const bump = (x, a, b) => (x < a || x > b ? 0 : Math.pow(Math.sin(PI * (x - a) / (b - a)), 2));
  let cur = { e: 0, s: SRCS, shift: 0, hv: 0 };
  function update(S, t, dt) {
    const b = clamp(S.motor_build, 0, 1);
    SU.uBuildX.value = b >= 0.999 ? 10 : lerp(-1.32, 1.36, b);
    // disease sites: chosen one glows, the rest dims
    const s = clamp(S.motor_site, 0, 5), g = clamp(S.motor_groups, 0, 1), w0 = clamp(1 - s, 0, 1), breath = 0.88 + 0.12 * Math.sin(t * 2.2);
    // the heart builds faster once it is wanted, and fades in when it is ready
    heartStep(S.motor_heart > 0.001 ? 12 : sliceMs(dt));
    if (!heartJob) heartIn = Math.min(1, heartIn + clamp(dt || 0, 0, 0.1) / 0.5);
    const hv = prog(S.motor_heart, 0.2, 0.75) * prog(b, 0.75, 1) * heartIn;
    for (let k = 1; k <= 5; k++) {
      const wk = clamp(1 - Math.abs(s - k), 0, 1);
      G[k] = g * (0.6 * w0 + 1.1 * wk) * breath * (k === 5 ? hv : 1);
      D[k] = 1 - 0.7 * (1 - w0 - wk);
    }
    G[6] = G[4]; G[7] = g * (0.6 * w0 + 1.1 * clamp(1 - Math.abs(s - 5), 0, 1)) * breath;   // the sarcomere glows for the heart even without it
    D[6] = D[7] = Math.max(D[4], D[5]);
    // impulses: the spindle fires, the motor neuron answers (a stretch reflex), the junctions release, the fibres twitch
    const sig = clamp(S.motor_signal, 0, 1), ph = ((t % P_) + P_) % P_;
    PU.uPh.value = ph; PU.uSig.value = sig;
    const dd = (((ph - TJm - 0.04) % P_) + P_) % P_, tw0 = (dd / 0.11) * Math.exp(1 - dd / 0.11);
    SU.uTw.value = sig * tw0;
    const c = clamp(S.motor_contract, 0, 1), amt = c * lerp(1, 0.2 + 0.8 * tw0, prog(sig, 0.5, 0.7));
    sarU.uShift.value = 0.055 * amt; sarU.uStroke.value = c;
    // the opened fibre and the magnified sarcomere
    const o = clamp(S.motor_open, 0, 1), e = prog(o, 0.35, 1), sz = Math.exp(lerp(Math.log(SRCS), 0, e));
    SU.uOpen.value = o;
    sgp.position.set(lerp(SRC[0], SC[0], e), lerp(SRC[1], SC[1], e), lerp(SRC[2], SC[2], e)); sgp.scale.setScalar(sz);
    show(sarMat, sarMesh, prog(o, 0.3, 0.55) * prog(b, 0.85, 1));
    // the heart, from a glow, beating
    const hs = 0.55 + 0.45 * prog(S.motor_heart, 0.1, 1);
    hg.scale.setScalar(hs);
    show(heartMat, heartMesh, hv); show(hfMat, hfMesh, hv); corMesh.visible = heartMesh.visible;
    PU.uHeartG.value = prog(S.motor_heart, 0, 0.3) * (1 - 0.75 * hv) * prog(b, 0.75, 1);
    const bp = ((t * 1.15) % 1 + 1) % 1, sys = bump(bp, 0.18, 0.52) * hv, atr = bump(bp, 0, 0.16) * hv;
    heartU.uSys.value = sys; heartU.uAtr.value = atr;
    const vs = 1 - 0.065 * sys; hfMesh.scale.setScalar(vs); hfMesh.position.set(V0[0] * (1 - vs), V0[1] * (1 - vs), V0[2] * (1 - vs));
    heartMat.userData.u.uRimK.value = 0.3 + 1.6 * (1 - hv);
    // magnifier lines
    const la = prog(o, 0.4, 0.75), P = lnGeo.attributes.position.array, A = lnGeo.attributes.aA.array;
    let n = 0;
    const seg = (p, q, a) => { P.set(p, n * 6); P.set(q, n * 6 + 3); A[n * 2] = A[n * 2 + 1] = a; n++; };
    const zx = [SRC[0] - PER / 2, SRC[0] + PER / 2], r0 = 0.009, big = (sx, a) => [sgp.position.x + sx * (SL - 0.055 * amt) * sz, sgp.position.y + Math.cos(a) * 0.16 * sz, sgp.position.z + Math.sin(a) * 0.16 * sz];
    for (const x of zx) for (let k = 0; k < 12; k++) { const a0 = k / 12 * TAU, a1 = (k + 1) / 12 * TAU; seg([x, SRC[1] + r0 * Math.cos(a0), SRC[2] + r0 * Math.sin(a0)], [x, SRC[1] + r0 * Math.cos(a1), SRC[2] + r0 * Math.sin(a1)], la * 0.9); }
    for (const [k, a] of [[0, PI / 2], [0, -PI / 2], [1, PI / 2], [1, -PI / 2]]) seg([zx[k], SRC[1] + r0 * Math.cos(a), SRC[2] + r0 * Math.sin(a)], big(k ? 1 : -1, a), la * 0.45 * e);
    lnGeo.attributes.position.needsUpdate = true; lnGeo.attributes.aA.needsUpdate = true;
    cur = { e, s: sz, shift: 0.055 * amt, hv, o };
  }

  // ------------------------------------------------------------------ anchors, labels, views, explore
  const sAt = (p) => [sgp.position.x + p[0] * cur.s, sgp.position.y + p[1] * cur.s, sgp.position.z + p[2] * cur.s];
  const nodeMid = nodes[nodeM0 + Math.floor((nodeM1 - nodeM0) * 0.55)];
  const ms = midSheath[Math.floor(midSheath.length * 0.62)];
  const anchors = {
    cord: [CC[0] - 0.03, CC[1] + CRY + 0.01, 0.06],
    soma: [MS[0], MS[1] + 0.035, MS[2] + 0.01],
    ganglion: [SG[0] - 0.01, SG[1] - 0.05, SG[2] + 0.03],
    axon: cM.getPointAt(nodeMid.s / LM).toArray(),
    myelin: cM.getPointAt(ms / LM).toArray(),
    nerve: [-0.5, -0.47, 0.06],
    junction: JN[2].J(0, 0, 0.008),
    spindle: SPA(0.17),
    fibre: [0.42, FCN[1] + 0.2, 0.05],
    myofibril: [0.66, MY.hi.y, MY.hi.z],
    sarcomere: () => sAt([0, 0.17, 0]),
    zdisc: () => sAt([SL - cur.shift, 0.15, 0]),
    mband: () => sAt([0, 0.16, 0]),
    heart: [HC[0] + 0.04, HC[1] + 0.27, HC[2]],
  };
  // which labels show: at most five; by motor_site (0 = overview), motor_open and motor_heart
  const SHOW = {
    cord: [x => (1 - x.o) * (1 - x.h), 1, 0, 0, 0, 0], soma: [1, 1, 1, 0, 0, 0], ganglion: [0, 1, 1, 0, 0, 0],
    axon: [x => 1 - x.o, 0, 1, 0, 0, 0], junction: [1, 0, 0, 1, 0, 0], fibre: [1, 0, 0, 1, 1, 0],
    sarcomere: [x => x.o, 0, 0, 0, x => x.o, x => x.o], heart: [x => x.h, 0, 0, 0, 0, x => x.h],
  };
  const lab = (name, at, xb) => S => {
    const x = { o: prog(S.motor_open, 0.3, 0.6), h: prog(S.motor_heart, 0.5, 0.8) }, s = clamp(S.motor_site, 0, 5);
    let a = 0;
    for (let k = 0; k <= 5; k++) { const w = clamp(1 - Math.abs(s - k), 0, 1), r = SHOW[name][k]; if (w > 0) a += w * (typeof r === 'function' ? r(x) : r); }
    const bx = clamp(S.motor_build, 0, 1) >= 0.999 ? 10 : lerp(-1.32, 1.36, S.motor_build);
    return a * clamp((bx - xb) / 0.15, 0, 1);
  };
  const labels = [
    { text: ['Spinal cord', 'grey matter inside'], at: 'cord', cls: '', alpha: lab('cord', 'cord', -1.0) },
    { text: ['Motor neuron', 'in the anterior horn'], at: 'soma', cls: 'amb', alpha: lab('soma', 'soma', -0.88) },
    { text: ['Sensory neuron', 'dorsal root ganglion'], at: 'ganglion', cls: 'cyn', alpha: lab('ganglion', 'ganglion', -1.08) },
    { text: ['Axon', 'in its myelin sheath'], at: 'myelin', cls: '', alpha: lab('axon', 'myelin', -0.5) },
    { text: ['Neuromuscular junction', ''], at: 'junction', cls: 'grn', alpha: lab('junction', 'junction', 0.1) },
    { text: ['Muscle fibre', 'striated'], at: 'fibre', cls: '', alpha: lab('fibre', 'fibre', 0.45) },
    { text: ['Sarcomere', 'actin, myosin, titin'], at: 'sarcomere', cls: 'cyn', alpha: lab('sarcomere', 'sarcomere', 0.9) },
    { text: ['Heart', 'the same sarcomere'], at: 'heart', cls: 'mag', alpha: lab('heart', 'heart', 0.8) },
  ];
  // a view from a camera position to a target, as [az, el, dist, tx, ty, tz]
  const look = (from, to) => { const d = v3.sub(from, to), L = v3.len(d); return [Math.atan2(d[0], d[2]) * 180 / PI, Math.asin(d[1] / L) * 180 / PI, L, to[0], to[1], to[2]]; };
  const edge = [LA / 2, 0];   // midway between two thick filaments: a corridor with no filament ahead (x 0.012: past the
  // M-band struts, which cross this point at x 0, and 0.016 before the first heads)
  const cam = {
    default: [-20, 14, 3.35, 0.05, 0.05, 0],
    cord: [-24, 12, 0.95, -0.95, -0.15, 0],
    junction: [20, 26, 0.42, ...JN[2].J(0.01, 0, 0.004)],
    fibre: [32, 16, 1.0, 0.5, -0.2, 0.08],
    sarcomere: look([SC[0] + 0.012, SC[1] + edge[0], SC[2] + edge[1]], [SC[0] + 0.27, SC[1] + edge[0] + 0.012, SC[2] + edge[1] + 0.01]),
    heart: [-10, 8, 1.35, HC[0], HC[1] + 0.05, HC[2]],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['default', 'Motor unit'], ['junction', 'Junction'], ['sarcomere', 'Sarcomere'], ['heart', 'Heart']] },
    { key: 'show', label: 'Show', options: [['off', 'Diseases off'], ['on', 'Diseases on']] },
    { key: 'motion', label: 'Motion', options: [['still', 'Still'], ['impulses', 'Impulses'], ['contraction', 'Contraction']] },
  ];
  function explore(c) {
    const v = c.view, on = c.show === 'on';
    return {
      motor_build: 1, motor_open: v === 'junction' ? 0 : 1, motor_heart: v === 'default' || v === 'heart' ? 1 : 0,
      motor_groups: on ? 1 : 0, motor_site: on ? { default: 0, junction: 3, sarcomere: 4, heart: 5 }[v] : 0,
      motor_signal: c.motion === 'still' ? 0 : 1, motor_contract: c.motion === 'contraction' ? 1 : 0,
    };
  }
  return Object.assign(set, {
    params: { motor_a: 1, motor_build: 1, motor_signal: 0, motor_open: 0, motor_contract: 0, motor_heart: 0, motor_groups: 0, motor_site: 0 },
    update, anchors, labels, cam, controls, explore,
    idle: dt => { heartStep(sliceMs(dt)); if (!heartJob) heartIn = 1; },   // while the set is hidden, the heart goes on building
    finish: () => { while (heartJob) heartStep(Infinity); heartIn = 1; },     // for screenshots and tests: build it now
  });
};

// The stress test (slides 9-10 of the talk): an aisle of supercomputer racks, and the sea of tiny towers they
// compute, each a stack of thin glowing discs (the multiplex in miniature) with a bright core thread (the disease
// module). hpc_remove sweeps a wave across the field: discs vanish, the core thread stays. No data is read here;
// every look is decided in the shaders from three shared uniforms, so no buffer changes after the build.
SETS.hpc = function (K) {
  const { THREE, smooth, clamp, prog, rng, rgb } = K;
  const set = K.newSet('hpc');
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- dimensions (1 unit is about 4 m)
  const FLOOR = -0.3, RH = 0.5, TOP = FLOOR + RH;      // racks are 2 m tall, 60 cm wide, 1.1 m deep
  const RW = 0.12, RD = 0.22, NR = 14, Z0 = -NR * RW / 2;
  const ROWS = [[-0.25, 1], [0.25, -1], [-0.73, -1], [0.73, 1]];   // [x of the row, the side its fronts face]
  const CELL = 0.12, FC = 0.24;                        // floor tiles; the field's grid (two tiles)
  const HALL = 0.96;                                   // no towers inside |x|, |z| < HALL
  const DMIN = 1.0, RFAR = 22, NEAR_R = 8.8;           // field: towers up to about NEAR_R, points to the horizon
  const DISCS = 20, KEEP = 5, TR = 0.05, TH = 0.2;    // a tower: 20 discs, 5 survive, radius, height
  const BF = 0.22, BR = 0.3;                           // widths of the field and removal waves (in wave units)
  // the near tower, and the wave exponent that puts it halfway through the waves at 0.5
  const NX = (Math.floor(1.75 / FC) + 0.5) * FC, NZ = (Math.floor(3.03 / FC) + 0.5) * FC;
  const ND = Math.hypot(NX, NZ), WP = Math.log(0.5) / Math.log((ND - DMIN) / (RFAR - DMIN));
  const wave = d => Math.pow(clamp((d - DMIN) / (RFAR - DMIN), 0, 1), WP);

  const U = { uRacks: { value: 1 }, uField: { value: 0 }, uRemove: { value: 0 } };
  const uni = extra => Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U, extra || {});
  const HASH = 'float h1(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }\n';
  const WAVES = `uniform float uRacks, uField, uRemove;
float fieldAt(float w) { return clamp((uField * ${(1 + BF).toFixed(3)} - w) / ${BF.toFixed(3)}, 0.0, 1.0); }
float removeAt(float w) { return clamp((uRemove * ${(1 + BR).toFixed(3)} - w) / ${BR.toFixed(3)}, 0.0, 1.0); }
`;
  const mat = (o, order) => { const m = new THREE.ShaderMaterial(o); set.mats.push(m); m.userData.order = order; return m; };

  // ---------------------------------------------------------------- the floor: tiles, cold aisle, the field's grid
  {
    const g = new THREE.PlaneGeometry(2 * RFAR, 2 * RFAR); g.rotateX(-Math.PI / 2);
    const m = mat({
      uniforms: uni({ uP: { value: WP } }), transparent: true, depthWrite: false, extensions: { derivatives: true },
      vertexShader: 'varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uA, uTime, uP; varying vec2 vP;
${WAVES}
float grid(vec2 p, float s, float wd) {
  vec2 fw = max(fwidth(p), vec2(1e-5)), g = abs(fract(p / s + 0.5) - 0.5) * s;
  vec2 l = 1.0 - smoothstep(fw * 0.5, fw * (0.5 + wd), g);
  return max(l.x, l.y) * (1.0 - smoothstep(0.06, 0.3, max(fw.x, fw.y) / s));
}
void main() {
  float d = length(vP), w = pow(clamp((d - ${DMIN.toFixed(2)}) / ${(RFAR - DMIN).toFixed(2)}, 0.0, 1.0), uP);
  vec2 ah = abs(vP);
  float hall = 1.0 - smoothstep(0.86, 0.92, max(ah.x, ah.y)), fl = fieldAt(w), rm = removeAt(w);
  float out_ = 1.0 - smoothstep(${(RFAR * 0.5).toFixed(1)}, ${RFAR.toFixed(1)}, d);
  vec3 c = vec3(0.0);
  float gr = grid(vP, ${CELL.toFixed(2)}, 0.8), gf = grid(vP, ${FC.toFixed(2)}, 0.8);
  c += vec3(0.22, 0.5, 0.78) * (gr * 0.16 * hall * uRacks + gf * (0.035 + 0.2 * fl) * (1.0 - hall));
  // the cold aisle: perforated tiles breathing cool air, glowing
  float cold = step(ah.x, 0.135) * step(ah.y, 0.84), aisle = exp(-vP.x * vP.x / 0.004) * (1.0 - smoothstep(0.8, 1.1, ah.y));
  vec2 pf = fract(vP / 0.012) - 0.5; vec2 fw = fwidth(vP / 0.012);
  float dots = smoothstep(0.32, 0.18, length(pf)) * (1.0 - smoothstep(0.25, 0.6, max(fw.x, fw.y)));
  c += uRacks * (vec3(0.1, 0.42, 0.68) * aisle * 0.55 + vec3(0.25, 0.7, 1.0) * dots * cold * 0.12);
  c += uRacks * vec3(0.03, 0.12, 0.22) * exp(-max(max(ah.x, ah.y) - 0.84, 0.0) * 2.2) * 0.5;
  // the field glows faintly under its towers; the two wave fronts run across it as rings
  c += vec3(0.02, 0.06, 0.1) * fl * (1.0 - hall) * (1.0 - 0.4 * rm);
  float wf = uField * ${(1 + BF).toFixed(3)} - 0.5 * ${BF.toFixed(3)};
  c += vec3(0.3, 0.8, 1.0) * exp(-pow((w - wf) / 0.01, 2.0)) * sin(3.14159 * clamp(uField, 0.0, 1.0)) * 0.6 * (1.0 - hall);
  float wr = uRemove * ${(1 + BR).toFixed(3)} - 0.12 * ${BR.toFixed(3)};
  c += vec3(1.0, 0.62, 0.18) * exp(-pow((w - wr) / 0.012, 2.0)) * sin(3.14159 * clamp(uRemove, 0.0, 1.0)) * 0.55 * fl;
  float a = clamp(0.9 * out_ + dot(c, vec3(0.5)), 0.0, 1.0);
  gl_FragColor = vec4(vec3(0.007, 0.014, 0.028) * out_ + c * out_, a * uA);
}`,
    }, -2);
    const mesh = new THREE.Mesh(g, m); mesh.position.y = FLOOR; mesh.renderOrder = -2; mesh.frustumCulled = false;
    set.group.add(mesh);
  }

  // ---------------------------------------------------------------- racks: dark cabinets with lit fronts and backs
  const racks = [];   // { x, z, face, ord }
  for (const [x, face] of ROWS) for (let k = 0; k < NR; k++) {
    const z = Z0 + (k + 0.5) * RW;
    racks.push({ x, z, face, ord: (-Z0 - z) / (-2 * Z0) * 0.8 + Math.abs(x) * 0.25 });
  }
  const bodyMat = K.fade(set, new THREE.MeshStandardMaterial({ color: 0x0b111b, metalness: 0.6, roughness: 0.55 }), 1);
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(RD, RH, RW - 0.003), bodyMat, racks.length);
  body.renderOrder = 0; set.group.add(body);
  // fronts (lights, vents) and backs (cable side, sparse lights) as one instanced plane
  const PW = RW - 0.014, PH = RH - 0.03;
  const pGeo = new THREE.PlaneGeometry(PW, PH);
  const pn = racks.length * 2, aId = new Float32Array(pn), aBack = new Float32Array(pn), aOrd = new Float32Array(pn);
  const pr = rng(901);
  for (let i = 0; i < pn; i++) { aId[i] = Math.floor(pr() * 997); aBack[i] = i % 2; aOrd[i] = racks[i >> 1].ord; }
  pGeo.setAttribute('aId', new THREE.InstancedBufferAttribute(aId, 1));
  pGeo.setAttribute('aBack', new THREE.InstancedBufferAttribute(aBack, 1));
  pGeo.setAttribute('aOrd', new THREE.InstancedBufferAttribute(aOrd, 1));
  const panelMat = mat({
    uniforms: uni(), transparent: true,
    vertexShader: `attribute float aId, aBack, aOrd; varying vec2 vUv; varying float vId, vBack, vPw;
uniform float uRacks;
void main() {
  vUv = uv; vId = aId; vBack = aBack;
  vPw = clamp((uRacks * 1.6 - aOrd * 0.6 - 0.75) / 0.25, 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `uniform float uA, uTime; varying vec2 vUv; varying float vId, vBack, vPw;
${HASH}
vec3 led(vec2 q, vec2 c, float r, vec3 col) { float d = length(q - c); return col * (smoothstep(r, r * 0.4, d) * 1.6 + exp(-d / (r * 1.6)) * 0.35); }
void main() {
  vec2 q = vUv, m = q * vec2(${PW.toFixed(3)}, ${PH.toFixed(3)});   // metres-ish, for round LEDs
  vec3 c = vec3(0.016, 0.022, 0.034);
  float door = step(0.035, q.x) * step(q.x, 0.965) * step(0.015, q.y) * step(q.y, 0.95);
  float rows = 18.0, ry = (q.y - 0.015) / 0.935 * rows, row = floor(ry), fy = fract(ry);
  float face = door * step(0.12, fy) * step(fy, 0.88);
  float kind = h1(vec3(vId, row, 1.0)), rh = ${PH.toFixed(3)} * 0.935 / rows;
  vec2 lq = vec2(m.x, (row + 0.5) * rh + 0.015 * ${PH.toFixed(3)});
  vec3 L = vec3(0.0);
  if (vBack < 0.5) {
    c += vec3(0.022, 0.03, 0.044) * face;
    // vents: fine slots on the right of each unit
    float vent = face * step(0.42, q.x) * step(q.x, 0.93) * step(0.5, fract(fy * 6.0));
    c -= vec3(0.012, 0.015, 0.02) * vent;
    if (kind < 0.55) {
      // a server: power light, health light, two activity lights
      L += led(m, vec2(0.08 * ${PW.toFixed(3)}, lq.y), 0.0017, vec3(0.2, 1.0, 0.45) * 0.7);
      for (int i = 0; i < 3; i++) {
        float fi = float(i), rate = 2.0 + 5.0 * h1(vec3(vId, row, fi + 7.0));
        float on = step(0.45, h1(vec3(vId + fi * 13.0, row, floor(uTime * rate + h1(vec3(row, fi, vId)) * 9.0))));
        vec3 lc = i == 0 ? vec3(0.25, 1.0, 0.5) : vec3(0.3, 0.6, 1.0);
        L += led(m, vec2((0.15 + 0.065 * fi) * ${PW.toFixed(3)}, lq.y), 0.0016, lc * on);
      }
    } else if (kind < 0.85) {
      // a blade chassis: a row of node lights
      for (int i = 0; i < 9; i++) {
        float fi = float(i), rate = 1.5 + 6.0 * h1(vec3(vId, row, fi));
        float on = step(0.35, h1(vec3(vId + fi * 3.0, row + 50.0, floor(uTime * rate + fi * 0.37))));
        vec3 lc = mod(fi, 3.0) < 1.0 ? vec3(0.25, 1.0, 0.55) : vec3(0.28, 0.55, 1.0);
        L += led(m, vec2((0.1 + 0.095 * fi) * ${PW.toFixed(3)}, lq.y), 0.0013, lc * (0.25 + 0.75 * on));
      }
    } else {
      // a switch: dense blinking port lights
      for (int i = 0; i < 12; i++) {
        float fi = float(i), on = step(0.5, h1(vec3(vId + fi, row + 90.0, floor(uTime * 9.0 + fi * 1.7))));
        L += led(m, vec2((0.08 + 0.077 * fi) * ${PW.toFixed(3)}, lq.y + rh * 0.18), 0.0009, vec3(0.3, 0.95, 0.6) * on);
      }
    }
    // the status strip at the top of the door
    float strip = smoothstep(0.958, 0.962, q.y) * (1.0 - smoothstep(0.978, 0.982, q.y)) * step(0.08, q.x) * step(q.x, 0.92);
    L += vec3(0.15, 0.7, 1.0) * strip * (0.85 + 0.15 * sin(uTime * 1.3 + vId));
    // a faint sheen on the glass door
    c += vec3(0.02, 0.035, 0.06) * smoothstep(0.25, 0.0, abs(q.x - q.y * 0.35 - 0.2)) * door;
  } else {
    // the back: cable bundles in shadow, a few link lights
    float cab = step(0.5, fract(q.x * 14.0 + h1(vec3(vId, 2.0, 3.0)))) * door;
    c += vec3(0.012, 0.016, 0.024) * cab;
    for (int i = 0; i < 2; i++) {
      float fi = float(i), on = step(0.6, h1(vec3(vId, row + fi * 40.0, floor(uTime * 3.0 + fi))));
      L += led(m, vec2((0.2 + 0.6 * fi) * ${PW.toFixed(3)}, lq.y), 0.0012, vec3(0.3, 0.9, 0.5) * on * 0.6);
    }
  }
  gl_FragColor = vec4(c + L * vPw, uA);
}`,
  }, 1);
  const panels = new THREE.InstancedMesh(pGeo, panelMat, pn);
  panels.renderOrder = 1; set.group.add(panels);
  // cable trays, cables, drops, door frames: one merged lit mesh
  const hallMats = [];
  {
    const parts = [];
    const box = (w, h, d, x, y, z, c) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); parts.push(K.paint(b, c)); };
    const metal = '#3a4658', dark = '#1a2230';
    const TY = TOP + 0.07, L = -2 * Z0 + 0.08;
    for (const [x] of ROWS) {
      box(0.1, 0.004, L, x, TY, 0, metal);
      box(0.004, 0.022, L, x - 0.05, TY + 0.009, 0, metal); box(0.004, 0.022, L, x + 0.05, TY + 0.009, 0, metal);
      for (let k = 0; k <= NR; k++) box(0.1, 0.005, 0.006, x, TY + 0.002, Z0 + k * RW, metal);
      for (let k = 1; k < NR; k += 4) box(0.004, 0.25, 0.004, x, TY + 0.13, Z0 + k * RW, dark);   // hangers to the ceiling
      // cables in the tray and drops into every other rack
      const cr = rng(Math.round(x * 100) + 50);
      [['#e8c23a', -0.025], ['#2a7fe0', 0.0], ['#20283a', 0.025]].forEach(([col, dx], j) => {
        const pts = [];
        for (let k = 0; k <= 12; k++) pts.push([x + dx + (cr() - 0.5) * 0.012, TY + 0.009 + j * 0.002, Z0 - 0.04 + k * L / 12]);
        parts.push(K.paint(K.tube(pts, 0.006, 40, 5), col));
      });
      for (let k = 0; k < NR; k += 2) {
        const z = Z0 + (k + 0.5) * RW, col = k % 4 ? '#2a7fe0' : '#e8c23a';
        parts.push(K.paint(K.tube([[x + 0.02, TY + 0.01, z], [x + 0.03, TY - 0.03, z + 0.01], [x + 0.035, TOP + 0.002, z + 0.012]], 0.004, 6, 5), col));
      }
    }
    // bridges over the aisles, and the frames of the aisle doors
    for (let k = 1; k < NR; k += 4) { box(0.42, 0.004, 0.08, 0, TY, Z0 + k * RW, metal); box(0.42, 0.004, 0.08, 0.49, TY, Z0 + k * RW, metal); box(0.42, 0.004, 0.08, -0.49, TY, Z0 + k * RW, metal); }
    for (const z of [Z0 - 0.004, -Z0 + 0.004]) {
      box(0.012, RH, 0.012, -0.138, FLOOR + RH / 2, z, metal); box(0.012, RH, 0.012, 0.138, FLOOR + RH / 2, z, metal);
      box(0.288, 0.014, 0.012, 0, TOP - 0.007, z, metal);
    }
    const tm = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.5 }), 1);
    hallMats.push(tm);
    const trays = new THREE.Mesh(K.merge(parts), tm); trays.renderOrder = 0; set.group.add(trays);
    // light bars over the cold aisle, and the glass door at its far end
    const lp = [];
    for (let k = 0; k < 5; k++) { const b = new THREE.BoxGeometry(0.018, 0.006, 0.26); b.translate(0, TOP + 0.2, Z0 + 0.17 + k * 0.335); lp.push(b); }
    const lm = K.fade(set, new THREE.MeshBasicMaterial({ color: 0xd8ecff }), 0.95);
    hallMats.push(lm);
    const lights = new THREE.Mesh(K.merge(lp), lm); lights.renderOrder = 0; set.group.add(lights);
    const gm = K.fade(set, new THREE.MeshBasicMaterial({ color: 0x3aa6ff, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0.09);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.264, RH - 0.014), gm);
    hallMats.push(gm);
    glass.position.set(0, FLOOR + (RH - 0.014) / 2, Z0 - 0.004); glass.renderOrder = 1; set.group.add(glass);
  }
  let racksDone = -1;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
  function placeRacks(v) {
    racks.forEach((r, i) => {
      const s = Math.max(smooth(clamp(v * 1.6 - r.ord * 0.6, 0, 1)), 1e-4), h = RH * s;
      _m.compose(_p.set(r.x, FLOOR + h / 2, r.z), _q.set(0, 0, 0, 1), _s.set(1, s, 1)); body.setMatrixAt(i, _m);
      for (let b = 0; b < 2; b++) {
        const dir = b ? -r.face : r.face;
        _q.setFromAxisAngle(_y, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        _m.compose(_p.set(r.x + dir * (RD / 2 + 0.0012), FLOOR + h / 2, r.z), _q, _s.set(1, s, 1));
        panels.setMatrixAt(2 * i + b, _m);
      }
    });
    body.instanceMatrix.needsUpdate = true; panels.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the field: towers near, points to the horizon
  const fr = rng(2207), near = [], far = [];
  const G = Math.ceil(RFAR / FC);
  let nearIdx = -1;
  for (let i = -G; i < G; i++) for (let j = -G; j < G; j++) {
    const x = (i + 0.5) * FC, z = (j + 0.5) * FC, d = Math.hypot(x, z), jit = fr();
    if ((Math.abs(x) < HALL && Math.abs(z) < HALL) || d > RFAR) continue;
    if (Math.abs(x - NX) < 1e-6 && Math.abs(z - NZ) < 1e-6) nearIdx = near.length;
    if (d < NEAR_R + (jit - 0.5) * 1.6) near.push([x, z, wave(d), fr()]); else far.push([x, z, wave(d), fr()]);
  }
  // one tower: 20 horizontal quads (a disc each, drawn in the fragment shader), instanced over the near cells
  const NT = near.length;
  const tg = new THREE.InstancedBufferGeometry();
  {
    const P = new Float32Array(DISCS * 12), DI = new Float32Array(DISCS * 4), I = [];
    for (let k = 0; k < DISCS; k++) {
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], c) => { P.set([u, 0, v], (4 * k + c) * 3); DI[4 * k + c] = k; });
      I.push(4 * k, 4 * k + 2, 4 * k + 1, 4 * k, 4 * k + 3, 4 * k + 2);
    }
    tg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    tg.setAttribute('aDisc', new THREE.BufferAttribute(DI, 1));
    tg.setIndex(I);
    // per tower: base position, and (step, offset) of its own removal order (a permutation of the 20 discs), wave, jitter
    const OFF = new Float32Array(NT * 3), SEED = new Float32Array(NT * 4), STEPS = [1, 3, 7, 9, 11, 13, 17, 19];
    near.forEach(([x, z, w, r], n) => {
      OFF.set([x, FLOOR, z], 3 * n);
      SEED.set([STEPS[Math.floor(r * 8)], Math.floor(fr() * DISCS), w, fr()], 4 * n);
    });
    tg.setAttribute('aOff', new THREE.InstancedBufferAttribute(OFF, 3));
    tg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(SEED, 4));
    tg.instanceCount = NT;
  }
  const towerMat = mat({
    uniforms: uni(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aDisc; attribute vec3 aOff; attribute vec4 aSeed;
uniform float uA, uTime; ${WAVES}
varying vec2 vC; varying vec3 vCol; varying float vAl, vFlash;
vec3 discCol(float i) {   // the tower's categories in miniature: proteins at the bottom, co-expression, then the rest
  if (i < 7.5) return vec3(0.27, 0.85, 1.0);
  if (i < 16.5) return vec3(0.24, 0.88, 0.56);
  if (i < 17.5) return vec3(0.69, 0.48, 1.0);
  if (i < 18.5) return vec3(1.0, 0.7, 0.23);
  return vec3(1.0, 0.35, 0.85);
}
void main() {
  float w = aSeed.z, fl = fieldAt(w), rm = removeAt(w);
  float da = clamp((fl * ${DISCS + 5}.0 - aDisc) / 5.0, 0.0, 1.0);
  float rank = mod(aDisc * aSeed.x + aSeed.y, ${DISCS}.0);
  float f = clamp(rm * ${DISCS - KEEP}.0 - rank, 0.0, 1.0);
  float sc = ${TR.toFixed(3)} * (0.55 + 0.45 * da) * (1.0 + 0.9 * f);
  vec3 p = aOff + vec3(position.x * sc, 0.006 + aDisc * ${(TH / (DISCS - 1)).toFixed(5)} * (0.94 + 0.12 * aSeed.w) - 0.03 * f * f - 0.02 * (1.0 - da), position.z * sc);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vAl = da * (1.0 - smoothstep(0.25, 1.0, f)) * uA * mix(0.85, 0.3, smoothstep(0.8, 8.0, -mv.z)) * smoothstep(0.3, 0.55, -mv.z);
  vFlash = smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.06, 0.45, f));
  vCol = discCol(aDisc); vC = position.xz;
  gl_Position = projectionMatrix * mv;
  if (vAl < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec2 vC; varying vec3 vCol; varying float vAl, vFlash;
void main() {
  float r = length(vC); if (r > 1.0) discard;
  float rim = smoothstep(1.0, 0.84, r) * smoothstep(0.55, 0.9, r), fill = 0.12 * smoothstep(1.0, 0.7, r), core = smoothstep(0.3, 0.0, r);
  vec3 col = vCol * (rim + fill) + vec3(1.0, 0.85, 0.5) * core * 1.3 + vec3(1.0, 0.9, 0.75) * vFlash * (rim + 0.2) * 0.6;
  gl_FragColor = vec4(col, (rim * 0.7 + fill * 0.7 + core * 0.9 + vFlash * 0.6) * vAl);
}`,
  }, 2);
  const towers = new THREE.Mesh(tg, towerMat); towers.frustumCulled = false; towers.renderOrder = 2; set.group.add(towers);
  // core threads: one vertical line per tower, gold-white, growing with the field and staying bright to the end
  {
    const g = new THREE.BufferGeometry(), P = new Float32Array(NT * 6), W2 = new Float32Array(NT * 2), T2 = new Float32Array(NT * 2);
    near.forEach(([x, z, w], n) => { P.set([x, FLOOR + 0.002, z, x, FLOOR + 0.002, z], 6 * n); W2[2 * n] = W2[2 * n + 1] = w; T2[2 * n + 1] = 1; });
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('aW', new THREE.BufferAttribute(W2, 1));
    g.setAttribute('aTop', new THREE.BufferAttribute(T2, 1));
    const m = mat({
      uniforms: uni(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aW, aTop; uniform float uA; ${WAVES}
varying float vAl, vY;
void main() {
  float fl = fieldAt(aW), rm = removeAt(aW), g = clamp(fl * 1.25, 0.0, 1.0);
  vec3 p = position; p.y += aTop * ${(TH + 0.012).toFixed(3)} * g; vY = aTop * g;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vAl = smoothstep(0.0, 0.25, fl) * (0.75 + 0.25 * rm) * uA * mix(1.0, 0.55, smoothstep(2.0, 8.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `uniform float uTime; varying float vAl, vY;
void main() { if (vAl < 0.004) discard; float pulse = 0.8 + 0.2 * sin(vY * 18.0 - uTime * 3.0); gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * pulse, vAl); }`,
    }, 3);
    const th = new THREE.LineSegments(g, m); th.frustumCulled = false; th.renderOrder = 3; set.group.add(th);
  }
  // far towers: one point each, cyan-green while full, shrinking to their gold core as the wave passes
  {
    const n = far.length, g = K.pointsGeo(n), P = g.attributes.position.array, C = g.attributes.aCol.array, S = g.attributes.aSize.array, A = g.attributes.aA.array;
    const W1 = new Float32Array(n);
    far.forEach(([x, z, w, r], k) => {
      P.set([x, FLOOR + 0.07, z], 3 * k); C.set(r < 0.4 ? [0.27, 0.85, 1.0] : [0.3, 0.9, 0.62], 3 * k);
      const d = Math.hypot(x, z); S[k] = 0.07; A[k] = 0.5 * (1 - smooth((d - RFAR * 0.55) / (RFAR * 0.45))) * (0.85 + 0.3 * r); W1[k] = w;
    });
    g.setAttribute('aW', new THREE.BufferAttribute(W1, 1));
    const m = K.points(set, {
      uniforms: U, head: 'attribute float aW;\n' + WAVES,
      vertex: `float fl = fieldAt(aW), rm = removeAt(aW);
  vC = mix(vC, vec3(1.0, 0.8, 0.45), rm * 0.85);
  vA *= smoothstep(0.0, 0.6, fl) * (1.0 - 0.35 * rm);
  vec4 mv2 = modelViewMatrix * vec4(pos + vec3(0.0, -0.05 * (1.0 - fl) - 0.03 * rm, 0.0), 1.0);
  vA *= mix(1.0, 0.3, smoothstep(2.0, 11.0, -mv2.z));
  gl_Position = projectionMatrix * mv2;
  gl_PointSize = pointPx(aSize * (0.5 + 0.5 * fl) * (1.0 - 0.45 * rm), mv2);`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3; set.group.add(pts);
  }
  // the stream: sparks flowing out of the hall to the field's front while it spreads
  {
    const n = 2600, g = K.pointsGeo(n), P = g.attributes.position.array, C = g.attributes.aCol.array, S = g.attributes.aSize.array;
    const PS = new Float32Array(n * 2), sr = rng(77);
    for (let k = 0; k < n; k++) {
      const a = sr() * TAU, sp = 0.15 + sr() * 0.35;
      P.set([Math.sin(a), sr(), Math.cos(a)], 3 * k);   // direction, start height
      C.set(sr() < 0.7 ? [0.5, 0.9, 1.0] : [1.0, 0.85, 0.55], 3 * k); S[k] = 0.012 + sr() * 0.014;
      PS[2 * k] = sp; PS[2 * k + 1] = sr();
    }
    g.setAttribute('aPh', new THREE.BufferAttribute(PS, 2));
    const m = K.points(set, {
      uniforms: Object.assign({ uFront: { value: 1 } }, U), head: 'attribute vec2 aPh; uniform float uFront, uField;',
      vertex: `float u = fract(uTime * aPh.x * 0.35 + aPh.y), r = mix(0.95, max(uFront, 1.0), u);
  vec3 q = vec3(position.x * r, ${FLOOR.toFixed(2)} + 0.015 + (0.04 + 0.3 * position.y) * exp(-(r - 0.95) * 2.0), position.z * r);
  vA *= smoothstep(0.0, 0.08, uField) * (1.0 - smoothstep(0.85, 1.0, uField) * 0.85) * smoothstep(0.0, 0.1, u) * (1.0 - smoothstep(0.75, 1.0, u));
  vec4 mv2 = modelViewMatrix * vec4(q, 1.0);
  gl_Position = projectionMatrix * mv2;
  gl_PointSize = pointPx(aSize, mv2);`,
    });
    set.streamMat = m;
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3; set.group.add(pts);
  }
  // dust in the cold aisle, catching the light
  {
    const n = 420, g = K.pointsGeo(n), P = g.attributes.position.array, C = g.attributes.aCol.array, S = g.attributes.aSize.array, A = g.attributes.aA.array, dr = rng(31);
    for (let k = 0; k < n; k++) {
      P.set([(dr() - 0.5) * 0.26, FLOOR + 0.02 + dr() * (RH + 0.15), Z0 + dr() * (-2 * Z0)], 3 * k);
      C.set([0.6, 0.85, 1.0], 3 * k); S[k] = 0.0025 + dr() * 0.003; A[k] = 0.25 + dr() * 0.35;
    }
    const m = K.points(set, {
      uniforms: U, head: 'uniform float uRacks;',
      vertex: `vec3 q = pos + vec3(sin(uTime * 0.21 + pos.z * 9.0) * 0.012, sin(uTime * 0.13 + pos.x * 31.0) * 0.02, cos(uTime * 0.17 + pos.y * 13.0) * 0.015);
  vec4 mv2 = modelViewMatrix * vec4(q, 1.0);
  vA *= uRacks * (0.6 + 0.4 * sin(uTime * 0.7 + pos.x * 80.0)) * smoothstep(0.15, 0.45, -mv2.z);
  gl_Position = projectionMatrix * mv2;
  gl_PointSize = pointPx(aSize, mv2);`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3; set.group.add(pts);
  }

  // ---------------------------------------------------------------- params, update, exports
  const params = { hpc_a: 1, hpc_racks: 1, hpc_field: 0, hpc_remove: 0 };
  function update(S) {
    const r = clamp(S.hpc_racks, 0, 1), f = clamp(S.hpc_field, 0, 1), m = clamp(S.hpc_remove, 0, 1);
    U.uRacks.value = r; U.uField.value = f; U.uRemove.value = m;
    if (r !== racksDone) { placeRacks(r); racksDone = r; }
    // trays, lights and glass come in once the racks stand (after setAlpha, which set their opacity)
    const hk = prog(r, 0.55, 1);
    for (const m of hallMats) { m.opacity *= hk; m.depthWrite = m.depthWrite && hk > 0.97; m.visible = m.opacity > 0.003; }
    // the stream reaches the field's front (the distance where its wave is halfway)
    const wf = clamp(f * (1 + BF) - 0.5 * BF, 0, 1);
    set.streamMat.uniforms.uFront.value = DMIN + (RFAR - DMIN) * Math.pow(wf, 1 / WP);
  }
  const NEARP = [NX, FLOOR + TH * 0.55, NZ];
  const anchors = { racks: [0, TOP + 0.04, 0], field: [NX * 0.7, FLOOR + 0.3, NZ * 0.7], near: NEARP };
  const labels = [
    { text: ['MareNostrum 5', 'Barcelona Supercomputing Center'], at: 'racks', cls: 'cyn', alpha: S => prog(S.hpc_racks, 0.6, 1) * (1 - prog(S.hpc_field, 0.35, 0.7)) },
    { text: ['680,000 networks', ''], at: 'field', cls: 'amb', alpha: S => prog(S.hpc_field, 0.55, 0.9) },
  ];
  const naz = Math.atan2(NX, NZ) * 180 / Math.PI;
  const cam = {
    default: [38, 24, 3.6, 0, -0.12, 0],
    racks: [0, 4, 1.4, 0, -0.03, -0.62],   // in the cold aisle, on its centre line, looking down it
    aisle: [0, 6, 2.1, 0, -0.03, -0.62],   // on the same line, just outside its open end (the way in and out)
    field: [24, 19, 7.5, 0, -0.3, -1.0],
    near: [Math.round(naz + 22), 18, 1.0, NEARP[0], NEARP[1], NEARP[2]],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['racks', 'Racks'], ['field', 'Field']] },
    { key: 'removed', label: 'Removed', options: [['none', 'None'], ['half', 'Half'], ['most', 'Most']] },
  ];
  function explore(c) {
    const rm = { none: 0, half: 0.5, most: 1 }[c.removed] || 0;
    return { hpc_racks: 1, hpc_field: c.view === 'field' || rm > 0 ? 1 : 0, hpc_remove: rm };
  }
  // the camera never enters a rack: over a row (or the glass door at the cold aisle's far end) it is lifted well above
  // the cable trays, and close to one it rises smoothly, so a free orbit glides over them. The engine hands keepOut the
  // camera's position in the set's frame and uses what it returns; still tells explore mode to stop swaying the
  // view while the camera is in the hall, where a sway would swing it at the racks.
  const SOLID = ROWS.map(([x]) => [x - RD / 2, x + RD / 2, Z0, -Z0]).concat([[-0.14, 0.14, Z0 - 0.012, Z0 + 0.004]]);
  const LIFT = TOP + 0.2, MARGIN = 0.02, SLOPE = 6;
  function keepOut(p) {
    const r = U.uRacks.value;
    if (r < 0.02) return p;
    let h = -1e9;
    for (const [x0, x1, z0, z1] of SOLID) {
      const dx = Math.max(x0 - MARGIN - p[0], 0, p[0] - x1 - MARGIN), dz = Math.max(z0 - MARGIN - p[2], 0, p[2] - z1 - MARGIN);
      h = Math.max(h, FLOOR + (LIFT - FLOOR) * r - SLOPE * Math.hypot(dx, dz));
    }
    return p[1] < h ? [p[0], h, p[2]] : p;
  }
  const still = p => U.uRacks.value > 0.02 && Math.abs(p[0]) < 0.9 && Math.abs(p[2]) < 0.9 && p[1] < TOP + 0.3;
  return Object.assign(set, { params, update, anchors, labels, cam, controls, explore, keepOut, still,
    towerCount: NT, pointCount: far.length, nearTower: nearIdx });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['tower', 'motor', 'hpc'];
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
// sets on show may keep the camera out of their solid parts (the supercomputer's racks): keepOut takes the camera's
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
  [0, 0], [410, 410],
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
  { key: 'title', name: 'Intro', a: 0, b: 20 },
  { key: 'motor', name: 'Motor unit', a: 20, b: 72 },
  { key: 'why', name: 'Causes', a: 72, b: 96 },
  { key: 'tower', name: 'Layers', a: 96, b: 142 },
  { key: 'walk', name: 'Walker', a: 142, b: 195 },
  { key: 'layers', name: 'Contexts', a: 195, b: 232 },
  { key: 'endo', name: 'Endotypes', a: 232, b: 278 },
  { key: 'overlap', name: 'Heart and muscle', a: 278, b: 340 },
  { key: 'stress', name: 'Stress test', a: 340, b: 375 },
  { key: 'next', name: 'Next', a: 375, b: 410 },
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

// ------------------------------------------------------------------ facts --
// Numbers the story quotes, counted from the analysis data (NMD_DATA) when the story loads
const FACTS = (() => {
  const D = NMD_DATA, genes = D.genes.map(r => r.split('|')), G = D.groups.length;
  const inG = (r, g) => ((+r[2] | +r[3]) >> g & 1) === 1, isSeed = (r, g) => (+r[2] >> g & 1) === 1;
  const bin = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const E = new Uint32Array(bin(D.edges).buffer);
  const links = test => { let n = 0; for (let k = 0; k < E.length; k += 2) if (test(genes[E[k] >>> 16], genes[E[k] & 65535])) n++; return n; };
  const CM = 5, HC = 11;
  const both = genes.filter(r => inG(r, CM) && inG(r, HC));
  // pairs of endotypes (one of each group) that share genes, most shared first
  const share = new Map();
  for (const r of both) { const e = r[1].split('.'); const k = e[CM] + '-' + e[HC]; share.set(k, (share.get(k) || 0) + 1); }
  const pairs = [...share].sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [c1, c2] = k.split('-').map(Number); return { c1, c2, n }; });
  const endoName = (g, c) => { const e = D.groups[g].endo.find(x => x.c === c); return e ? e.name : ''; };
  const topLayer = g => { let b = 0; D.groups[g].z.forEach((z, p) => { if (z > D.groups[g].z[b]) b = p; }); return D.layers[D.ppi[b]].name; };
  const cats = {}; for (const l of D.layers) cats[l.cat] = (cats[l.cat] || 0) + 1;
  return {
    genes: genes.length, links: E.length / 2, layers: D.layers.length, cats, groups: G,
    endotypes: D.groups.reduce((a, g) => a + g.endo.length, 0),
    cm: { seeds: D.groups[CM].seeds, added: D.groups[CM].added, n: genes.filter(r => inG(r, CM)).length, endo: D.groups[CM].endo.length },
    hc: { n: genes.filter(r => inG(r, HC)).length }, shared: both.length, pairs, endoName, topLayer,
    seedLinks: links((a, b) => (isSeed(a, CM) || isSeed(a, HC)) && (isSeed(b, CM) || isSeed(b, HC))),
    moduleLinks: links((a, b) => (inG(a, CM) || inG(a, HC)) && (inG(b, CM) || inG(b, HC))),
  };
})();

function buildStory() {
  const F = FACTS, D = NMD_DATA, T = GL.sets.tower;
  const lc = s => s.charAt(0).toLowerCase() + s.slice(1);
  // the biggest endotypes of congenital myopathies, by name, for the text
  const named = D.groups[5].endo.filter(e => e.name).sort((a, b) => b.n - a.n);
  const muscle = named.filter(e => /muscle|sarcomere|myofibril|contraction|actin|myosin/i.test(e.name) && e.name.length <= 45);
  const cmEndo = (muscle.length >= 2 ? muscle : named).slice(0, 3).map(e => `${e.c}, ${lc(e.name)}`);
  const shared = F.pairs.slice(0, 2).map(p => `endotype ${p.c1} of congenital myopathies (${lc(F.endoName(5, p.c1) || 'unnamed')}) and ${p.c2} of cardiomyopathies (${lc(F.endoName(11, p.c2) || 'unnamed')}), ${p.n} genes`);
  const capped = F.cm.added >= 200;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // jump an index param (a disease group, a site) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Hidden connections</h1>
      <p class="lede" data-at="2.4">in rare diseases of nerves and muscles</p>
      <p data-at="4">${F.layers} layers of data, one network: how rare muscle diseases share their machinery, and what muscle and heart have in common.</p>
      <p class="note" data-at="11">Each dot is a gene, the same gene on every level. Each level links the genes by a different kind of evidence.</p>`,
    motor: `<h2 data-at="0.6">From nerve to muscle</h2>
      <p data-at="1.2">Every movement starts in a motor neuron in the spinal cord. Its long axon, wrapped in myelin, carries the signal to the muscle.</p>
      <p data-at="12">At the neuromuscular junction the nerve passes the signal to the muscle fibre. Inside, chains of sarcomeres pull: thin actin filaments slide along thick myosin filaments.</p>
      <p data-at="30" class="amber">Neuromuscular disorders are rare genetic diseases of this motor unit.</p>
      <div class="facts"><div data-at="31"><b>16</b><small>disease groups</small></div><div data-at="32"><b>1,200+</b><small>diseases</small></div><div data-at="33"><b>~700</b><small>causal genes</small></div><div data-at="34"><b>3.7-4.99</b><small>in 10,000 people</small></div></div>
      <p data-at="36">They strike the nerve cells, the nerves, the junction or the muscle, with weakness and low muscle tone.</p>
      <p data-at="40">The heart muscle is built from the same sarcomeres: inherited cardiomyopathies belong here too.</p>
      <p class="credits" data-at="44">Gene Table of Neuromuscular Disorders (2024). Motor unit illustrative.</p>`,
    why: `<h2 data-at="0.6">Same weakness, different causes</h2>
      <p data-at="1.2">Patients share weakness, but the causes are many: about 700 genes. There are no molecular subtypes for these diseases yet.</p>
      <p data-at="9">A shared mechanism is called an endotype. Diseases that share one may share a treatment: a drug for one could be repurposed for another.</p>
      <ul class="steps">
        <li data-at="15"><b>Define</b>the endotypes of each disease group</li>
        <li data-at="17"><b>Overlap</b>find the endotypes different diseases share</li>
        <li data-at="19"><b>Point</b>to genes and drugs worth a closer look</li>
      </ul>`,
    tower: `<h2 data-at="0.6">${F.layers} layers, one network</h2>
      <p data-at="1.2">To see mechanisms, look at the genes from every side at once. The multiplex network stacks ${F.layers} layers; in each, the same genes are linked by a different kind of evidence.</p>
      <ul class="steps">
        <li data-at="8"><b>Proteins</b>that bind each other: a core of links found in more than 24 tissues, and ${F.cats.ppi - 1} tissue layers with their own links (IID)</li>
        <li data-at="14"><b>Genes</b>switched on together, in ${F.cats.coex - 1} tissues and a core (GTEx)</li>
        <li data-at="20"><b>Symptoms</b>shared in people and in mice (HPO, MPO)</li>
        <li data-at="25"><b>Pathways, drugs</b>shared pathways (Reactome) and drug targets (NeDRex)</li>
        <li data-at="30"><b>Essential</b>genes that cells need together (CRISPR screens)</li>
      </ul>
      <p class="note" data-at="35">In this map: ${fmt(F.genes)} genes (the known genes of the ${F.groups} disease groups and the genes the walk added) and ${fmt(F.links)} protein links. The Gene Table's 16 groups, small ones joined to their closest. Layers still waiting for their data show as dotted rims.</p>
      <p class="credits" data-at="38">Kotlyar et al. (IID); GTEx, with the co-expression core of Buphamalai et al., Nature Communications (2021); HPO; MPO; Reactome; NeDRex.</p>`,
    walk: `<h2 data-at="0.6">A walker that keeps coming home</h2>
      <p data-at="1.2">Start from the genes known to cause one group of diseases: here the ${F.cm.seeds} genes of congenital myopathies in the Gene Table.</p>
      <p data-at="8">A random walker sets off from them. At every step it jumps back to a known gene seven times in ten; otherwise it follows a link. At a gene found in several layers it changes layer half the time, preferring the layers where the disease's genes cluster most.</p>
      <p data-at="24" class="amber">Genes the walker visits again and again are close to the disease, from many sides at once.</p>
      <p data-at="34">The most visited join the disease module one by one, until the module holds together, or 200 genes have joined. ${capped ? 'For congenital myopathies the walk stopped at the limit of 200.' : `For congenital myopathies, ${F.cm.added} joined.`} Other groups held together sooner: for some a single gene was enough.</p>
      <p class="credits" data-at="44">Random walk with restart on the multiplex: restart 0.7, layer switch 0.5, layers weighted by z-score. After Buphamalai et al. (2021).</p>`,
    layers: `<h2 data-at="0.6">Different diseases, different layers</h2>
      <p data-at="1.2">Not every layer matters for every disease. A protein layer counts when a group's known genes link up in it more than chance would allow (a z-score of at least 1.645).</p>
      <ul class="steps">
        <li data-at="7"><b>Motor and sensory neuropathies</b>strongest in the ${lc(F.topLayer(1))} protein layer</li>
        <li data-at="16"><b>Myasthenic syndromes</b>strongest in the ${lc(F.topLayer(4))} protein layer</li>
        <li data-at="25"><b>Muscular dystrophies</b>strongest in the ${lc(F.topLayer(9))} protein layer</li>
      </ul>
      <p class="credits" data-at="30">Z-scores computed in this map over the protein layers: the largest linked group of a disease's known genes against ${fmt(D.walk.runs)} random gene sets with the same numbers of links.</p>`,
    endo: `<h2 data-at="0.6">Endotypes</h2>
      <p data-at="1.2">Inside a module, genes that do the same job sit together. Grouping them by the functions around them (Gene Ontology terms) splits each module into endotypes.</p>
      <p data-at="12">Congenital myopathies fall into ${F.cm.endo} endotypes, among them ${cmEndo.join('; ')}.</p>
      <p data-at="26" class="amber">Across the ${F.groups} groups: ${F.endotypes} endotypes, candidates for shared mechanisms.</p>
      <p class="note" data-at="32">Endotypes are numbered within each group; names are the most typical GO process of their genes.</p>`,
    overlap: `<h2 data-at="0.6">Heart and muscle</h2>
      <p data-at="1.2">Congenital myopathies and inherited cardiomyopathies often come together. Do they share machinery?</p>
      <p data-at="8">Side by side: ${F.cm.n} genes for congenital myopathies, ${F.hc.n} for cardiomyopathies, ${F.shared} in both. The endotypes that share the most genes: ${shared.join('; ')}.</p>
      <p data-at="22">The overlap shows in shared symptoms, in the co-expression of heart atrium and ventricle, and in the proteins of skeletal muscle.</p>
      <p data-at="34" class="amber">Their known genes alone share ${fmt(F.seedLinks)} protein links in this map. With the genes the walk found, ${fmt(F.moduleLinks)} links tie them together: without the walk, much of what they share is missed.</p>
      <p class="credits" data-at="46">Congenital myopathies (endotypes CM 1-${F.cm.endo}) and hereditary cardiomyopathies (HC); layers after netviz-iactive by Philipp Friedrich.</p>`,
    stress: `<h2 data-at="0.6">A stress test</h2>
      <p data-at="1.2">How much does the result hang on any one layer? Layers were removed at random, again and again: 10,000 networks for every number of removed layers, 680,000 in all.</p>
      <p data-at="14">About 45 hours on MareNostrum 5 at the Barcelona Supercomputing Center, in jobs of 25 nodes with 112 cores each.</p>
      <p data-at="22" class="amber">The modules keep their originally detected genes until most layers are gone; with fewer layers the walk has to search wider. The full multiplex finds the smallest sets of genes that define the disease modules (the authors' result; the picture is illustrative).</p>
      <p class="credits" data-at="28">With Alfonso Valencia and Davide Cirillo, Barcelona Supercomputing Center.</p>`,
    next: `<h2 data-at="0.6">What comes next</h2>
      <p data-at="1.2">Genes shared by the endotypes of different diseases are candidates: for diagnosis, and for drugs that might be repurposed from one disease to another.</p>
      <p data-at="9">The same approach now turns to inborn errors of immunity (Pauline Staiber).</p>
      <p data-at="14">Iker Núñez-Carpintero and Philipp Friedrich, with Julia Guthrie and Jörg Menche: Guthrie Lab and Menche Lab, Ludwig Boltzmann Institute for Network Medicine, Vienna.</p>
      <p data-at="20"><button class="btn primary" id="btnGoExplore" type="button">Explore the network</button></p>
      <p class="credits" data-at="22">ISMB 2026 (NetBio). Earlier multilayer work: Núñez-Carpintero et al., Nature Communications (2024). Data: Gene Table of Neuromuscular Disorders 2024, IID, GTEx, HPO, MPO, Reactome, NeDRex.</p>`,
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
  const CMg = 6, HCg = 12; // tower_group values: group index + 1
  let a, b;
  // Intro: the tower rises, layer by layer, every disease group in its colour
  a = C.title.a; b = C.title.b;
  show('tower', 0.2, 2.5, b - 1.5, b + 0.5);
  ramp('tower_rise', 0.5, 10, 0, 1);
  cam(a, 'tower', 'default', -40, null, [0, -6, 0.8]);
  cam(b - 1, 'tower', 'default', 25, 'spin');
  // The motor unit: nerve, junction, muscle, sarcomere, and the diseases on it
  a = C.motor.a; b = C.motor.b;
  show('motor', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('motor_build', a, a + 6, 0, 1);
  ramp('motor_signal', a + 7, a + 9, 0, 1); ramp('motor_signal', a + 30, a + 32, 1, 0);
  ramp('motor_open', a + 17, a + 21, 0, 1);
  ramp('motor_contract', a + 23, a + 26, 0, 1); ramp('motor_contract', a + 30, a + 32, 1, 0);
  ramp('motor_groups', a + 31, a + 34, 0, 1);
  // the heart lights as the camera reaches it
  [[a + 37, 1], [a + 39, 2], [a + 40.5, 3], [a + 42, 4], [a + 44, 5]].reduce((v0, [t, v]) => { jump('motor_site', t, v0, v); return v; }, 0);
  jump('motor_site', b - 3, 5, 0);
  ramp('motor_heart', a + 40, a + 44, 0, 1);
  cam(a + 1, 'motor', 'default', -20);
  cam(a + 6, 'motor', 'cord');
  cam(a + 11, 'motor', 'junction');
  cam(a + 16, 'motor', 'fibre');
  // the magnified sarcomere from just outside its lattice: down the filaments, then from the side
  cam(a + 22, 'motor', 'sarcomere', 0, null, [0, 8.66, 0.49]);
  cam(a + 29, 'motor', 'sarcomere', 22, 'spin', [0, 16.66, 0.24]);
  cam(a + 34, 'motor', 'default', -10);
  cam(a + 44, 'motor', 'heart');
  cam(b - 1, 'motor', 'default', 15, 'spin');
  // Same weakness, different causes: the genes of all groups, seen from above
  a = C.why.a; b = C.why.b;
  show('tower', a - 0.5, a + 2);
  cam(a + 1, 'tower', 'top', -10);
  cam(b, 'tower', 'top', 30, 'spin');
  // The layers: the categories come up, the camera rises along the tower
  a = C.tower.a; b = C.tower.b;
  ramp('tower_cats', a + 2, a + 5, 0.4, 1);
  cam(a + 3, 'tower', 'side', -20);
  cam(a + 14, 'tower', 'ppi', 0, 'spin');
  cam(a + 24, 'tower', 'side', 15, 'spin', [0, 0, 0, 0, 0.5]);
  cam(b - 1, 'tower', 'default', 30, 'spin');
  ramp('tower_cats', b - 3, b, 1, 0.4);
  // The walker: seeds of congenital myopathies, walkers, heat, the module grows
  a = C.walk.a; b = C.walk.b;
  jump('tower_group', a, 0, CMg);
  ramp('tower_seeds', a + 1, a + 3, 0, 1);
  ramp('tower_walk', a + 8, a + 10, 0, 1); ramp('tower_walk', a + 36, a + 38, 1, 0);
  ramp('tower_heat', a + 18, a + 30, 0, 1);
  ramp('tower_module', a + 34, a + 46, 0, 1);
  ramp('tower_heat', a + 44, a + 47, 1, 0);
  cam(a + 1, 'tower', 'ppi', -25);
  cam(a + 18, 'tower', 'ppi', 10, 'spin');
  cam(a + 34, 'tower', 'default', 25);
  cam(b - 1, 'tower', 'default', 45, 'spin');
  // Different layers: each group's z-scores as bars up the tower
  a = C.layers.a; b = C.layers.b;
  ramp('tower_seeds', a, a + 2, 1, 0); ramp('tower_module', a, a + 2, 1, 0);
  ramp('tower_z', a + 2, a + 4, 0, 1);
  jump('tower_group', a + 3, CMg, 2); jump('tower_group', a + 15, 2, 5); jump('tower_group', a + 24, 5, 10);
  ramp('tower_z', b - 2, b, 1, 0);
  cam(a + 2, 'tower', 'ppi', 40);
  cam(b - 1, 'tower', 'ppi', 80, 'spin');
  // Endotypes: congenital myopathies in colour, then gathered on a grid
  a = C.endo.a; b = C.endo.b;
  jump('tower_group', a, 10, CMg);
  ramp('tower_seeds', a + 1, a + 2, 0, 1); ramp('tower_module', a + 1, a + 3, 0, 1);
  ramp('tower_endo', a + 2, a + 6, 0, 1);
  ramp('tower_grid', a + 12, a + 18, 0, 1);
  ramp('tower_grid', b - 3, b, 1, 0);
  cam(a + 2, 'tower', 'default', 60);
  cam(a + 12, 'tower', 'default', 75, 'spin');
  cam(a + 18, 'tower', 'grid', 0);
  cam(b - 1, 'tower', 'grid', 25, 'spin');
  // Heart and muscle: two towers and what they share; seeds alone, then the module again
  a = C.overlap.a; b = C.overlap.b;
  ramp('tower_endo', a, a + 2, 1, 0);
  ramp('tower_pair', a + 2, a + 7, 0, 1);
  ramp('tower_seedonly', a + 34, a + 37, 0, 1); ramp('tower_seedonly', a + 44, a + 47, 1, 0);
  ramp('tower_pair', b - 3, b, 1, 0);
  cam(a + 3, 'tower', 'default', 0);
  cam(a + 8, 'tower', 'pair', 0);
  cam(a + 22, 'tower', 'pair', 20, 'spin');
  cam(a + 34, 'tower', 'pair', -10);
  cam(b - 1, 'tower', 'pair', 10, 'spin');
  // A stress test: layers fall away, the module holds; then the supercomputer and its sea of towers
  a = C.stress.a; b = C.stress.b;
  ramp('tower_drop', a + 1, a + 12, 0, 0.85);
  show('hpc', a + 12.5, a + 14.5, b - 1.5, b + 0.5);
  ramp('tower_a', a + 12, a + 14, 1, 0);
  ramp('hpc_racks', a + 13, a + 15, 0, 1);
  ramp('hpc_field', a + 18, a + 23, 0, 1);
  ramp('hpc_remove', a + 23, b - 2, 0, 0.9);
  for (const n of ['tower_drop', 'tower_seeds', 'tower_module']) ramp(n, a + 14.5, a + 15.5, n === 'tower_drop' ? 0.85 : 1, 0);
  jump('tower_group', a + 15, CMg, 0);
  cam(a + 1, 'tower', 'default', 15);
  cam(a + 12, 'tower', 'default', 45, 'spin');
  // over the hall, then in along the cold aisle's centre line (so the camera never meets a rack), a slow walk down
  // it, back out the same way, and up and out over the sea of towers
  cam(a + 14, 'hpc', 'default');
  cam(a + 16.5, 'hpc', 'aisle');
  cam(a + 18, 'hpc', 'racks');
  cam(a + 21, 'hpc', 'racks', 0, 'spin', [0, 0, 0, 0, 0, -0.24]);
  cam(a + 23, 'hpc', 'aisle');
  cam(a + 25.5, 'hpc', 'default', 20);
  cam(a + 28, 'hpc', 'field');
  cam(b - 1, 'hpc', 'field', 15, 'spin');
  // What comes next: the whole tower once more, opened up around the viewer
  a = C.next.a; b = C.next.b;
  ramp('tower_a', a - 1, a + 1, 0, 1);
  ramp('tower_room', a + 2, a + 8, 0, 1);
  ramp('tower_cats', a + 2, a + 6, 0.4, 1);
  cam(a, 'tower', 'default', 10, null, [0, 0, 0.6]);
  cam(a + 10, 'tower', 'default', 60, 'spin', [0, 0, 0.3]);
  cam(b, 'tower', 'default', 140, 'spin', [0, 0, 0.3]);
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  label('tower', () => T.anchors.group(5), `<b>Congenital myopathies</b>${F.cm.seeds} known genes`, C.walk.a + 2, C.walk.a + 16, 'cyn');
  label('tower', 'pairMid', `<b>In both</b>${F.shared} genes`, C.overlap.a + 10, C.overlap.a + 30, 'amb');
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
// Explore mode: the multiplex tower with the analysis data. Pick a disease group, search a gene, run
// your own random walk, knock layers out, and pick endotypes to see how they connect layer by layer;
// or open the motor unit and the stress test with their own controls.
const SCENES = [
  ['tower', 'Multiplex network', 'The genes of 13 groups of neuromuscular disorders in up to 71 layers of evidence: modules, the walk, endotypes and the overlap of muscle and heart.'],
  ['motor', 'Motor unit', 'Nerve cell, myelinated axon, neuromuscular junction, muscle fibre, sarcomere and heart, with the disease groups where they strike.'],
  ['hpc', 'Stress test', 'The supercomputer and 680,000 networks with layers removed at random: the disease modules keep their originally detected genes until most layers are gone (the authors\' result; the picture is illustrative).'],
];
const TABS = [['groups', 'Diseases'], ['genes', 'Genes'], ['walk', 'Walk'], ['layers', 'Layers'], ['endo', 'Endotypes'], ['scenes', 'Scenes']];
const X = { tab: 'groups', scene: 'tower', ctl: {}, t0: 0, turn: 'on', group: -1, gene: -1, pick: [], off: new Set(), egroup: 5,
  walk: null, walkFrom: 5, mine: [], walkers: true, showZ: false, colour: 'group', grid: false, room: false, err: '' };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['tower_group', 'motor_site']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);

// ------------------------------------------------------------------ data --
// the analysis data, decoded once for the panels (the tower decodes its own copy for drawing)
const ND = (() => {
  const D = NMD_DATA, b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const term = s => (s ? s.split('.').map(i => D.terms[+i]) : []);
  const genes = D.genes.map(r => {
    const c = r.split('|');
    return { sym: c[0], endo: c[1].split('.').map(Number), seed: +c[2], added: +c[3], go: term(c[4]), hpo: term(c[5]), kegg: term(c[6]), ppi: c[7] === '1' };
  });
  const N = genes.length, L = D.layers.length;
  // links per layer, and each gene's partners per layer
  const E = new Uint32Array(b64(D.edges).buffer), XE = new Uint16Array(b64(D.extra).buffer);
  const count = new Int32Array(L), nb = genes.map(() => new Map());
  const add = (i, j, l) => { count[l]++; for (const [a, b] of [[i, j], [j, i]]) { let s = nb[a].get(l); if (!s) nb[a].set(l, s = []); s.push(b); } };
  for (let k = 0; k < E.length; k += 2) { const i = E[k] >>> 16, j = E[k] & 65535; for (let m = E[k + 1], p = 0; m; m >>>= 1, p++) if (m & 1) add(i, j, D.ppi[p]); }
  for (let k = 0; k < XE.length; k += 3) add(XE[k], XE[k + 1], XE[k + 2]);
  const bySym = new Map(genes.map((g, i) => [g.sym.toUpperCase(), i]));
  return { D, genes, N, L, count, nb, bySym, groups: D.groups, layers: D.layers };
})();
const TW = () => GL.sets.tower;
const inGroup = (i, g) => (((ND.genes[i].seed | ND.genes[i].added) >> g) & 1) === 1;
const isSeed = (i, g) => ((ND.genes[i].seed >> g) & 1) === 1;
const endoOf = (g, c) => ND.groups[g].endo.find(e => e.c === c) || { c, n: 0, name: '', terms: [] };
const endoLabel = (g, c) => { const e = endoOf(g, c); return `${c}${e.name ? ' · ' + e.name : ''}`; };
const ENDO_FALLBACK = ['#46d9ff', '#ff5ad9', '#ffb43b', '#3ee08f', '#ff5a4b', '#b07bff', '#4d94ff', '#e6d23c', '#2fc4b2', '#ff8a3d',
  '#8fa8ff', '#d77bff', '#7be0ff', '#ffd27b', '#9ef07b', '#ff9ec4', '#c4b5fd', '#5eead4', '#fca5a5', '#e7eef8'];
const endoCss = c => (TW() && TW().endoColour ? TW().endoColour(c) : ENDO_FALLBACK[(c - 1) % ENDO_FALLBACK.length]);
const CAT = { ppi: ['Protein interactions', '#46d9ff'], coex: ['Co-expression', '#3ee08f'], pheno: ['Phenotypes', '#ff5ad9'],
  path: ['Pathways', '#ffb43b'], drug: ['Drug targets', '#ff5a4b'], ess: ['Essential genes', '#b07bff'] };
const CAT_ORDER = ['ppi', 'coex', 'pheno', 'path', 'drug', 'ess'];
// a group's z-score in a layer (protein layers only; null where none was computed)
const zOf = (g, l) => { const p = ND.D.ppi.indexOf(l); return p >= 0 ? ND.groups[g].z[p] : null; };
const layersOn = () => ND.layers.map((_, l) => !X.off.has(l));

// what the chosen scene and its controls ask for: that set fully in, every other set out
function exploreTargets(now = performance.now()) {
  const s = GL.sets[X.scene], tg = Object.assign({}, s.params);
  tg[X.scene + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(X.scene, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  // the tower follows the panels on top of its own controls (Scenes tab): the picked group, its colours and
  // grid, a walk's heat and walkers, the room view
  if (X.scene === 'tower') {
    const g = X.group;
    tg.tower_group = g + 1;
    if (g >= 0 && (c.show === 'module' || c.show === undefined)) { tg.tower_seeds = 1; tg.tower_module = 1; }
    if (g >= 0 && X.showZ) tg.tower_z = 1;
    if (g >= 0 && X.colour === 'endo') tg.tower_endo = 1;
    if (g >= 0 && X.grid) tg.tower_grid = 1;
    if (X.walk) { tg.tower_heat = 1; if (X.walkers) tg.tower_walk = 1; }
    if (X.room) tg.tower_room = 1;
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it, standing inside, or among the supercomputer's racks
  if (X.turn === 'on' && !(X.room && X.scene === 'tower') && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// the tower's own display state: the picked gene, endotypes, knocked-out layers and a walk's result
function pushState() {
  const T = TW();
  if (T && T.setState) T.setState({ group: X.group, gene: X.gene, pick: X.pick.slice(), off: new Set(X.off), heat: X.walk ? X.walk.heat : null, walk: !!(X.walk && X.walkers) });
  updateExtraLabels();
}
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) flyTo(view(k, X.room && k === 'tower' ? 'inside' : 'default'));
  renderScenes();
  updateExtraLabels();
}
const needTower = () => { if (X.scene !== 'tower') openScene('tower'); };
function setCtl(k, key, v) {
  const s = GL.sets[k], c = (s.controls || []).find(x => x.key === key), was = c ? ctlValue(k, c) : null;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  if (k === 'tower' && key === 'view' && (v === 'room') !== X.room) { setRoom(v === 'room'); if (v === 'room') { renderScenes(); return; } }
  X.t0 = performance.now();
  // some views have their own best camera (cam views named like the option); leaving one goes back to the scene's own view
  if (s.cam && s.cam[v]) flyTo(view(k, v));
  else if (s.cam && was && s.cam[was]) flyTo(view(k, 'default'));
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

// --------------------------------------------------------------- actions --
function selectGroup(g) {
  X.group = g;
  if (g >= 0) X.egroup = X.walkFrom = g;
  needTower(); pushState(); renderAll();
}
function selectGene(i, fly = true) {
  X.gene = i;
  if (i >= 0) {
    needTower();
    const a = TW() && TW().anchors && TW().anchors.gene ? TW().anchors.gene(i) : null;
    if (fly && a && !X.room) flyTo([orbit.cur[0], 14, 2.6, a[0], a[1], a[2]]);
  }
  pushState(); renderGene(i); renderWalk();
}
function togglePick(g, c) {
  const k = X.pick.findIndex(([a, b]) => a === g && b === c);
  if (k >= 0) X.pick.splice(k, 1); else if (X.pick.length < 8) X.pick.push([g, c]);
  needTower(); pushState(); renderEndo();
}
function clearPick() { X.pick = []; pushState(); renderEndo(); }
function setLayer(l, on) {
  if (on) X.off.delete(l); else X.off.add(l);
  pushState(); if (X.walk) runWalk(X.walk.from, true); renderLayers();
}
function setLayers(fn) {
  X.off = new Set(ND.layers.map((L, l) => l).filter(l => !fn(ND.layers[l], l)));
  pushState(); if (X.walk) runWalk(X.walk.from, true); renderLayers();
}
// knock out k more layers that still have links, in a fixed shuffled order (the same each time)
function knockRandom(k) {
  const live = ND.layers.map((_, l) => l).filter(l => !X.off.has(l) && ND.count[l] > 0);
  let s = 7 + X.off.size;
  for (let n = 0; n < k && live.length > 1; n++) { s = (s * 9301 + 49297) % 233280; X.off.add(live.splice(Math.floor(s / 233280 * live.length), 1)[0]); }
  pushState(); if (X.walk) runWalk(X.walk.from, true); renderLayers();
}
// a random walk from a group's seeds (from = group index) or from your own genes (from = 'mine'; own: those genes
// instead of the list, as when another person in a shared room ran it)
function runWalk(from, quiet, own) {
  const T = TW();
  const seeds = from === 'mine' ? (own || X.mine).slice() : ND.genes.map((_, i) => i).filter(i => isSeed(i, from));
  X.err = '';
  if (!seeds.length) { X.walk = null; X.err = 'Add at least one gene to walk from (search a gene, then press Walk from here).'; }
  else if (!T || !T.walk) { X.walk = null; X.err = 'The walk is not available.'; }
  else {
    const weights = from === 'mine' ? null : ND.layers.map((_, l) => { const z = zOf(from, l); return z !== null && z >= 1.645 ? z : 0; });
    const r = T.walk(seeds, { on: layersOn(), weights: weights && weights.some(w => w > 0) ? weights : null, group: from === 'mine' ? -1 : from });
    X.walk = { from, seeds, heat: r.heat, top: r.top.slice(0, 15) };
  }
  if (!quiet) needTower();
  pushState(); renderWalk();
}
function clearWalk() { X.walk = null; X.err = ''; pushState(); renderWalk(); }
function addMine(i) { if (i >= 0 && !X.mine.includes(i) && X.mine.length < 12) X.mine.push(i); X.walkFrom = 'mine'; renderWalk(); }
function setRoom(on) {
  X.room = on;
  if (XR.on) xrRoom(on);
  // on screen the camera goes into the middle; in the headset the tower comes round you, and leaving it the usual view returns
  if (X.scene === 'tower') flyTo(view('tower', on ? 'inside' : 'default'));
  if (X.ctl.tower && (X.ctl.tower.view === 'room') !== on) X.ctl.tower.view = on ? 'room' : 'tower';
  document.querySelectorAll('[data-ctl="room"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === (on ? 'on' : 'off'))));
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and its controls, the picked group,
// gene and endotypes, the knocked-out layers, your genes, the walk and its settings. Turning and standing inside
// are each person's own view (a tower view of Room counts as Tower). The walk is worked out the same way on every
// device, so it travels as where it started: a group, or the genes it started from.
const ctlShared = (k, c) => { const v = ctlValue(k, c); return k === 'tower' && c.key === 'view' && v === 'room' ? 'tower' : v; };
const walkShared = () => (X.walk ? (X.walk.from === 'mine' ? X.walk.seeds.slice() : X.walk.from) : null);
const offShared = () => [...X.off].sort((a, b) => a - b);
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
  for (const [k] of SCENES) ctl[k] = Object.fromEntries((GL.sets[k].controls || []).map(c => [c.key, ctlShared(k, c)]));
  return { tab: X.tab, scene: X.scene, ctl, group: X.group, gene: X.gene, pick: X.pick.map(p => p.slice()), egroup: X.egroup,
    off: offShared(), mine: X.mine.slice(), from: X.walkFrom, walk: walkShared(), walkers: X.walkers,
    colour: X.colour, grid: X.grid, z: X.showZ };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const NG = ND.groups.length, J = JSON.stringify, int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n < hi;
  const genes = a => (Array.isArray(a) && a.length <= 12 && a.every(i => int(i, 0, ND.N)) && new Set(a).size === a.length ? a : null);
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if ((v.group === -1 || int(v.group, 0, NG)) && v.group !== X.group) selectGroup(v.group);
  if (int(v.egroup, 0, NG) && v.egroup !== X.egroup) { X.egroup = v.egroup; renderEndo(); }
  if (['group', 'endo'].includes(v.colour) && v.colour !== X.colour) { X.colour = v.colour; renderGroups(); }
  if (typeof v.grid === 'boolean' && v.grid !== X.grid) { X.grid = v.grid; renderGroups(); }
  if (typeof v.z === 'boolean' && v.z !== X.showZ) { X.showZ = v.z; renderGroups(); }
  if ((v.gene === -1 || int(v.gene, 0, ND.N)) && v.gene !== X.gene) { $('#q').value = v.gene >= 0 ? ND.genes[v.gene].sym : ''; selectGene(v.gene, false); }
  if (Array.isArray(v.pick) && v.pick.length <= 8 && v.pick.every(p => Array.isArray(p) && int(p[0], 0, NG) && endoOf(p[0], p[1]).n) && J(v.pick) !== J(X.pick)) {
    X.pick = v.pick.map(p => [p[0], p[1]]); pushState(); renderGroups(); renderEndo();
  }
  const mine = genes(v.mine);
  if (mine && J(mine) !== J(X.mine)) { X.mine = mine.slice(); renderWalk(); }
  if ((v.from === 'mine' || int(v.from, 0, NG)) && v.from !== X.walkFrom) { X.walkFrom = v.from; renderWalk(); }
  if (Array.isArray(v.off) && v.off.every(l => int(l, 0, ND.L)) && J([...new Set(v.off)].sort((a, b) => a - b)) !== J(offShared())) {
    const off = new Set(v.off); setLayers((L, l) => !off.has(l)); renderWalk(); renderEndo();
  }
  if (typeof v.walkers === 'boolean' && v.walkers !== X.walkers) { X.walkers = v.walkers; pushState(); renderWalk(); }
  if (J(v.walk) !== J(walkShared())) {
    if (v.walk === null) clearWalk();
    else if (int(v.walk, 0, NG)) runWalk(v.walk, true);
    else if (genes(v.walk) && v.walk.length) runWalk('mine', true, v.walk);
  }
  // the scene and its controls last: the panes above bring the tower back; a control flies to its own view as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of GL.sets[k].controls || []) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (x === 'room' || !c.options.some(o => o[0] === x) || ctlShared(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
}

// ------------------------------------------------------------- search --
// genes by symbol first, then by a GO process, phenotype or pathway they carry
function matches(q, limit) {
  q = String(q == null ? '' : q).trim().toUpperCase();
  if (!q) return [];
  const res = [];
  ND.genes.forEach((g, i) => {
    const s = g.sym.toUpperCase();
    let r = -1;
    if (s === q) r = 0; else if (s.startsWith(q)) r = 1;
    else if (q.length >= 4 && [...g.go, ...g.hpo, ...g.kegg].some(t => t.toUpperCase().includes(q))) r = 3;
    if (r >= 0) res.push([r, i]);
  });
  return res.sort((a, b) => a[0] - b[0] || ND.genes[a[1]].sym.localeCompare(ND.genes[b[1]].sym)).slice(0, limit || 8).map(r => r[1]);
}
const findGene = s => { const i = ND.bySym.get(String(s || '').trim().toUpperCase()); return i === undefined ? (matches(s, 1)[0] ?? -1) : i; };
const groupsOf = i => ND.groups.map((G, g) => g).filter(g => inGroup(i, g));
function attachSuggest(input, list, onPick) {
  let items = [], hi = -1;
  const close = () => { list.classList.remove('on'); input.setAttribute('aria-expanded', 'false'); hi = -1; };
  const render = () => {
    items = matches(input.value, 8);
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === hi}"><b>${esc(ND.genes[i].sym)}</b><span>${esc(ND.genes[i].go[0] || '')}</span><em>${esc(groupsOf(i).map(g => ND.groups[g].short).join(', '))}</em></li>`).join('');
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
  showTab('genes');
  const i = findGene(q);
  if (i >= 0) { $('#q').value = ND.genes[i].sym; selectGene(i); } else { X.gene = -1; pushState(); renderGene(-2, q); }
}

// ------------------------------------------------------------------ panes --
const QUICK = ['TTN', 'MYH7', 'DES', 'RYR1', 'DMD', 'SCN4A', 'CHRNE', 'SOD1'];
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:#04131c"' : ''}>${col ? `<span class="sw" style="background:${col}"></span>` : ''}${label}</button>`;
const hbar = (label, v, max, col, attrs) => `<div ${attrs || ''} style="display:grid;grid-template-columns:minmax(0,1fr) 46%;gap:8px;align-items:center;font-size:13px;margin:3px 0;${attrs ? 'cursor:pointer' : ''}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span><span style="display:block;height:9px;border-radius:2px;background:${col};width:${Math.max(2, Math.round(100 * Math.max(0, v) / (max || 1)))}%"></span></div>`;
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    <div class="pane" id="pane-groups" role="tabpanel"></div>
    <div class="pane" id="pane-genes" role="tabpanel">
      <div class="search"><input id="q" type="search" placeholder="Search a gene, or a process like sarcomere" autocomplete="off" spellcheck="false" aria-label="Search genes" role="combobox" aria-expanded="false" aria-controls="qs"><ul class="sugg" id="qs" role="listbox"></ul></div>
      <div id="ginfo"></div>
    </div>
    <div class="pane" id="pane-walk" role="tabpanel"></div>
    <div class="pane" id="pane-layers" role="tabpanel"></div>
    <div class="pane" id="pane-endo" role="tabpanel"></div>
    <div class="pane" id="pane-scenes" role="tabpanel"></div>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  attachSuggest($('#q'), $('#qs'), (i, text) => { if (i !== null && i !== undefined) { $('#q').value = ND.genes[i].sym; selectGene(i); } else runQuery(text); });
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v, n = v !== undefined && v !== '' && !isNaN(+v) ? +v : v;
    ({
      group: () => selectGroup(n), z: () => { X.showZ = !X.showZ; renderGroups(); }, colour: () => { X.colour = v; renderGroups(); },
      grid: () => { X.grid = !X.grid; renderGroups(); }, gene: () => { $('#q').value = ND.genes[n].sym; showTab('genes'); selectGene(n); },
      pick: () => { const [g, c] = v.split(':').map(Number); togglePick(g, c); }, egroup: () => { X.egroup = n; renderEndo(); },
      clearpick: clearPick, layer: () => setLayer(n, X.off.has(n)), layers: () => setLayers({ all: () => true, ppi: L => L.cat === 'ppi', data: (L, l) => ND.count[l] > 0, cores: L => /_core$/.test(L.key) || !/^(ppi|coex)_/.test(L.key) }[v]),
      knock: () => knockRandom(n), from: () => { X.walkFrom = n; renderWalk(); }, run: () => runWalk(X.walkFrom), clearwalk: clearWalk,
      walkers: () => { X.walkers = !X.walkers; pushState(); renderWalk(); }, mine: () => { addMine(n); showTab('walk'); },
      unmine: () => { X.mine = X.mine.filter(i => i !== n); renderWalk(); }, scene: () => openScene(v), ctl: () => setCtl(X.scene, b.dataset.ctl, v),
      quick: () => { $('#q').value = ND.genes[n].sym; selectGene(n); },
    }[b.dataset.act] || (() => {}))();
  });
  renderAll(); renderGene(-1);
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>
    <div class="grp"><span>Stand inside</span><div class="seg" data-ctl="room" role="group" aria-label="Stand inside the tower">${[['off', 'Off'], ['on', 'On']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${(X.room ? 'on' : 'off') === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (!seg) return;
    if (seg.dataset.ctl === 'turn') setTurn(b.dataset.v); else { needTower(); setRoom(b.dataset.v === 'on'); }
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
  if (k !== 'scenes') needTower();
  updateExtraLabels();
}
function renderAll() { renderGroups(); renderWalk(); renderLayers(); renderEndo(); renderScenes(); }
function renderGroups() {
  const pane = $('#pane-groups');
  if (!pane) return;
  const g = X.group, G = ND.groups[g];
  let h = `<p class="sub">The ${ND.groups.length} groups of the Gene Table of Neuromuscular Disorders (2024), each with its disease module in the tower.</p>
    <div class="chips">${chip('data-act="group" data-v="-1"', 'All groups', g < 0)}${ND.groups.map((G, k) => chip(`data-act="group" data-v="${k}"`, esc(G.short), g === k, G.col)).join('')}</div>`;
  if (G) {
    const zs = ND.D.ppi.map((l, p) => [G.z[p], l]).sort((a, b) => b[0] - a[0]), zmax = Math.max(1.645, zs[0][0]);
    h += `<h3>${esc(G.name)}</h3><p class="sub">Strikes the ${esc({ neuron: 'nerve cells', nerve: 'nerves', junction: 'neuromuscular junction', muscle: 'muscle fibres', heart: 'heart muscle' }[G.site] || G.site)}.</p>
      <dl class="stats"><dt>Known genes</dt><dd>${G.seeds}<small>seeds, from the Gene Table</small></dd>
      <dt>Added</dt><dd>${G.added}<small>${G.added >= 200 ? 'by the walk (stopped at 200)' : 'by the walk, until the module held together'}</small></dd>
      <dt>Endotypes</dt><dd>${G.endo.length}</dd></dl>
      <div class="chips">${chip('data-act="colour" data-v="group"', 'Group colour', X.colour === 'group')}${chip('data-act="colour" data-v="endo"', 'Endotype colours', X.colour === 'endo')}${chip('data-act="grid"', 'Grid by endotype', X.grid)}${chip('data-act="z"', 'Layer scores', X.showZ)}</div>
      <p class="grp-h">Endotypes (press one to pick it)</p>
      <div class="chips">${G.endo.map(e => chip(`data-act="pick" data-v="${g}:${e.c}"`, `${e.c}${e.name ? ' · ' + esc(e.name) : ''} <small>${e.n}</small>`, X.pick.some(([a, b]) => a === g && b === e.c), endoCss(e.c))).join('')}</div>
      <p class="grp-h">Protein layers where its known genes cluster most (z-score, in this map)</p>
      ${zs.slice(0, 8).map(([z, l]) => hbar(`${esc(ND.layers[l].name)} <b>${z.toFixed(1)}</b>`, z, zmax, z >= 1.645 ? G.col : 'var(--line)')).join('')}`;
  } else h += `<p class="empty">Pick a group to light up its module: its known genes (the seeds), the genes the walk added, and its endotypes.</p>`;
  pane.innerHTML = h;
}
function renderGene(i, q) {
  const pane = $('#ginfo');
  if (!pane) return;
  if (i < 0) {
    pane.innerHTML = `${i === -2 ? `<p class="empty">No gene matches “${esc(q)}”. Try a symbol like TTN, or a process like sarcomere.</p>` : `<p class="empty">Search above, or click a gene in the tower. The ${fmt(ND.N)} genes are those of the ${ND.groups.length} disease modules: their known genes and the genes the walk added.</p>`}
      <div class="quick">${QUICK.map(s => findGene(s)).filter(k => k >= 0).map(k => `<button type="button" data-act="quick" data-v="${k}">${esc(ND.genes[k].sym)}</button>`).join('')}</div>`;
    return;
  }
  const G = ND.genes[i], gs = groupsOf(i);
  const per = [...ND.nb[i]].map(([l, s]) => [l, s.length]).sort((a, b) => b[1] - a[1]);
  const cnt = new Map();
  for (const [, s] of ND.nb[i]) for (const j of s) cnt.set(j, (cnt.get(j) || 0) + 1);
  const partners = [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 18);
  const byCat = {};
  for (const [l] of per) byCat[ND.layers[l].cat] = (byCat[ND.layers[l].cat] || 0) + 1;
  pane.innerHTML = `<h3>${esc(G.sym)}</h3><p class="sub">${esc(G.go.slice(0, 2).join(', ') || 'No GO process listed')}</p>
    <p class="grp-h">In ${gs.length} disease ${gs.length === 1 ? 'module' : 'modules'}</p>
    ${gs.map(g => `<div style="display:flex;gap:8px;align-items:baseline;margin:4px 0;font-size:14px"><span class="sw" style="background:${ND.groups[g].col}"></span><span style="flex:1">${esc(ND.groups[g].short)} <small style="color:var(--muted)">${isSeed(i, g) ? 'known gene' : 'added by the walk'}</small></span>
      <button class="btn" type="button" data-act="pick" data-v="${g}:${G.endo[g]}" style="padding:3px 8px;font-size:12px">${esc(endoLabel(g, G.endo[g]))}</button></div>`).join('')}
    <dl class="stats" style="margin-top:12px"><dt>Linked in</dt><dd>${per.length}<small>layers${Object.keys(byCat).length ? ': ' + CAT_ORDER.filter(c => byCat[c]).map(c => `${byCat[c]} ${CAT[c][0].toLowerCase()}`).join(', ') : ''}</small></dd>
    <dt>Partners</dt><dd>${cnt.size}<small>module genes, in any layer</small></dd></dl>
    ${per.slice(0, 6).map(([l, n]) => hbar(`${esc(ND.layers[l].name)} <b>${n}</b>`, n, per[0][1], CAT[ND.layers[l].cat][1])).join('')}
    <p class="grp-h">Partners (most layers first)</p>
    <div class="chips">${partners.map(([j]) => `<button type="button" data-act="gene" data-v="${j}">${esc(ND.genes[j].sym)}</button>`).join('')}</div>
    ${G.hpo.length ? `<p class="grp-h">Phenotypes</p><p class="sub" style="margin:0 0 8px">${esc(G.hpo.join(', '))}</p>` : ''}
    ${G.kegg.length ? `<p class="grp-h">Pathway</p><p class="sub" style="margin:0 0 8px">${esc(G.kegg.join(', '))}</p>` : ''}
    <div class="actions"><button class="btn" type="button" data-act="mine" data-v="${i}">Walk from here</button></div>`;
}
function renderWalk() {
  const pane = $('#pane-walk');
  if (!pane) return;
  const W = X.walk, off = X.off.size;
  let h = `<p class="sub">A walker starts at the chosen genes. At every step it jumps back to one of them seven times in ten, otherwise it follows a link; at a gene in several layers it changes layer half the time, preferring the layers where a disease group's genes cluster (from your own genes, all layers count the same). The genes it visits most are the most closely linked to the start genes, in this map.</p>
    <p class="grp-h">Start from</p>
    <div class="chips">${ND.groups.map((G, k) => chip(`data-act="from" data-v="${k}"`, esc(G.short), X.walkFrom === k, G.col)).join('')}${chip('data-act="from" data-v="mine"', `Your genes (${X.mine.length})`, X.walkFrom === 'mine')}</div>
    ${X.walkFrom === 'mine' ? `<div class="chips">${X.mine.length ? X.mine.map(i => `<button type="button" data-act="unmine" data-v="${i}" title="Remove">${esc(ND.genes[i].sym)} ×</button>`).join('') : '<span class="empty">Search a gene in Genes, then press Walk from here.</span>'}</div>` : ''}
    <div class="actions"><button class="btn primary" type="button" data-act="run">Run the walk</button>${W ? '<button class="btn" type="button" data-act="clearwalk">Clear</button>' : ''}${chip('data-act="walkers"', 'Show walkers', X.walkers)}</div>
    <p class="sub" style="margin-top:8px">${off ? `${off} ${off === 1 ? 'layer is' : 'layers are'} knocked out (Layers tab); the walk avoids them.` : 'All layers are on (knock some out in Layers).'}</p>`;
  if (X.err) h += `<p class="empty">${esc(X.err)}</p>`;
  if (W) {
    const mx = W.top.length ? W.heat[W.top[0]] : 1;
    h += `<p class="grp-h">Most visited genes (not counting the start genes)</p>${W.top.map(i => hbar(`<b>${esc(ND.genes[i].sym)}</b> ${esc(groupsOf(i).map(g => ND.groups[g].short).slice(0, 2).join(', '))}`, W.heat[i], mx, 'var(--cyan)', `data-act="gene" data-v="${i}"`)).join('')}`;
  }
  pane.innerHTML = h;
}
function renderLayers() {
  const pane = $('#pane-layers');
  if (!pane) return;
  const g = X.group;
  let h = `<p class="sub">Switch layers off: the tower drops them and a walk you run avoids them. (The modules are not computed again; the stress test is in the story.) Layers whose data is still to come are dotted in the tower.</p>
    <div class="chips"><button type="button" data-act="layers" data-v="all">All on</button><button type="button" data-act="layers" data-v="ppi">Proteins only</button><button type="button" data-act="layers" data-v="cores">Only the cores</button><button type="button" data-act="knock" data-v="10">Knock out 10 at random</button></div>
    <p class="sub">${ND.L - X.off.size} of ${ND.L} layers on.</p>`;
  for (const c of CAT_ORDER) {
    const ls = ND.layers.map((L, l) => [L, l]).filter(([L]) => L.cat === c);
    h += `<p class="grp-h"><span class="sw" style="background:${CAT[c][1]}"></span>${CAT[c][0]} · ${ls.length}</p><div class="chips">${ls.map(([L, l]) => {
      const z = g >= 0 ? zOf(g, l) : null, n = ND.count[l];
      return chip(`data-act="layer" data-v="${l}"`, `${esc(L.name)} <small>${n ? fmt(n) : 'to come'}${z !== null ? ` · z ${z.toFixed(1)}` : ''}</small>`, !X.off.has(l));
    }).join('')}</div>`;
  }
  pane.innerHTML = h;
}
function renderEndo() {
  const pane = $('#pane-endo');
  if (!pane) return;
  const eg = X.egroup, G = ND.groups[eg];
  let h = `<p class="sub">Pick endotypes, from one group or several, to see their genes through every layer and where they link to each other.</p>
    <div class="chips">${ND.groups.map((G, k) => chip(`data-act="egroup" data-v="${k}"`, esc(G.short), eg === k, G.col)).join('')}</div>
    <div class="chips">${G.endo.map(e => chip(`data-act="pick" data-v="${eg}:${e.c}"`, `${e.c}${e.name ? ' · ' + esc(e.name) : ''} <small>${e.n}</small>`, X.pick.some(([a, b]) => a === eg && b === e.c), endoCss(e.c))).join('')}</div>`;
  if (X.pick.length) {
    h += `<p class="grp-h">Picked (${X.pick.length}) <button class="btn" type="button" data-act="clearpick" style="padding:2px 8px;font-size:12px">Clear</button></p>
      <div class="chips">${X.pick.map(([g, c]) => chip(`data-act="pick" data-v="${g}:${c}"`, `${esc(ND.groups[g].short)} ${esc(endoLabel(g, c))}`, true, endoCss(c))).join('')}</div>`;
    const st = endoStats();
    if (st.rows.length) {
      const mx = Math.max(1, ...st.rows.map(r => r.n));
      h += `<p class="grp-h">${X.pick.length > 1 ? 'Links between the picked endotypes, by layer' : 'Links inside the endotype, by layer'}</p>
        ${st.rows.slice(0, 10).map(r => hbar(`${esc(ND.layers[r.l].name)} <b>${r.n}</b>`, r.n, mx, X.pick.length > 1 ? 'var(--amber)' : endoCss(X.pick[0][1]))).join('')}
        <p class="sub" style="margin-top:6px">${st.genes} genes; ${st.shared ? `${st.shared} of them in more than one picked endotype.` : 'none shared.'}</p>`;
    } else h += `<p class="empty">No links ${X.pick.length > 1 ? 'between them' : 'inside it'} in the layers that are on.</p>`;
  } else h += `<p class="empty">Nothing picked yet.</p>`;
  pane.innerHTML = h;
}
// per layer: links between picked endotypes (or inside the one picked), counted on the panel's own copy of the data
function endoStats() {
  const mem = ND.genes.map((G, i) => X.pick.map(([g, c]) => G.endo[g] === c));
  const any = mem.map(m => m.some(Boolean));
  const per = new Map();
  for (let i = 0; i < ND.N; i++) {
    if (!any[i]) continue;
    for (const [l, s] of ND.nb[i]) {
      if (X.off.has(l)) continue;
      for (const j of s) {
        if (j <= i || !any[j]) continue;
        let ok;
        if (X.pick.length === 1) ok = true;
        else ok = mem[i].some((a, p) => a && mem[j].some((b, q) => b && q !== p));
        if (ok) per.set(l, (per.get(l) || 0) + 1);
      }
    }
  }
  return { rows: [...per].map(([l, n]) => ({ l, n })).sort((a, b) => b.n - a.n), genes: any.filter(Boolean).length, shared: mem.filter(m => m.filter(Boolean).length > 1).length };
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${X.scene === 'tower' ? '' : (s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${X.scene === 'tower' ? `<p class="sub">The tower answers to the other tabs: Diseases, Genes, Walk, Layers and Endotypes.</p>${(s.controls || []).filter(c => c.key !== 'colour').map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}` : ''}`;
}
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  const T = TW();
  if (X.scene !== 'tower' || !T || !T.anchors) return;
  if (X.gene >= 0 && T.anchors.gene) {
    const i = X.gene, sym = ND.genes[i].sym, rest = groupsOf(i).map(g => ND.groups[g].short).slice(0, 2).join(', ');
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(sym)}</b>${esc(rest)}`, 'cyn'), set: 'tower', at: () => T.anchors.gene(i), o: -1, txt: [sym, rest, 'cyn'] });
  }
  if (T.anchors.endo) for (const [g, c] of X.pick.slice(0, 6)) {
    const b = `${ND.groups[g].short} ${c}`, rest = endoOf(g, c).name;
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(b)}</b>${esc(rest)}`, 'amb'), set: 'tower', at: () => T.anchors.endo(g, c), o: -1, txt: [b, rest, 'amb'] });
  }
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3(), _inv = new THREE.Matrix4();
// the gene under the mouse, in explore mode with the tower on show
function pickAt(mx, my) {
  if (X.scene !== 'tower' || !TW().pick) return -1;
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  _inv.copy(TW().group.matrixWorld).invert();
  _ro.copy(_rc.ray.origin).applyMatrix4(_inv); _rd.copy(_rc.ray.direction).transformDirection(_inv);
  return TW().pick(_ro, _rd);
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
    const i = pickAt(ev.clientX, ev.clientY);
    cv.style.cursor = i >= 0 ? 'pointer' : 'grab';
    if (i >= 0) {
      tip.innerHTML = `<b>${esc(ND.genes[i].sym)}</b>${esc(groupsOf(i).map(g => ND.groups[g].short).slice(0, 2).join(', '))}`;
      tip.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`;
      tip.style.opacity = 1;
    } else tip.style.opacity = 0;
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') {
      const i = pickAt(ev.clientX, ev.clientY);
      if (i >= 0) { $('#q').value = ND.genes[i].sym; showTab('genes'); selectGene(i, false); }
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
  // standing inside the tower: life size, its middle where you stand, turned by the thumbstick
  if (XR.room && APP.mode === 'explore' && X.scene === 'tower') {
    XR.R = 1; XR.hitR = 1.3; XR.target.set(0, 0, 0);
    GL.world.quaternion.setFromAxisAngle(_xY, -v[0] * D2R);
    GL.world.scale.setScalar(1);
    GL.world.position.set(0, -0.2, 0);
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
  const hm = 0.021 / XR.R;
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
}
function xrTip(S) {
  let i = -1;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.i >= 0) { i = c.hover.i; break; }
  if (i !== XR.tipI) {
    XR.tipI = i;
    if (XR.tip) dropSprite(XR.tip);
    const g = i >= 0 ? ND.genes[i] : null;
    XR.tip = g ? { set: 'tower', at: () => TW().anchors.gene(i), txt: [g.sym, groupsOf(i).map(k => ND.groups[k].short).slice(0, 2).join(', '), 'tip'] } : null;
  }
  if (XR.tip) placeLabelXR(XR.tip, 1, S);
}

// ------------------------------------------------------ picking a gene --
// The gene nearest a ray given in the world's own coordinates (explore mode, tower on show)
const _pinv = new THREE.Matrix4(), _po = new THREE.Vector3(), _pd = new THREE.Vector3();
function pickRay(o, d) {
  if (APP.mode !== 'explore' || X.scene !== 'tower' || !TW().pick) return -1;
  _pinv.copy(TW().group.matrix).invert();
  return TW().pick(_po.copy(o).applyMatrix4(_pinv), _pd.copy(d).transformDirection(_pinv));
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
  } else if (!p.moved && p.i >= 0) { buzz(c); xrClickGene(p.i); }
}
function xrGrab(c, on) {
  c.grab = null;
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  if (h.kind !== 'panel' && XR.room && APP.mode === 'explore' && X.scene === 'tower') return;   // standing inside the tower: life size round you
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
    // the scene counts as a ball around the view's target; a curated protein counts if the ray passes close
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    _xc.copy(oL).sub(XR.target);
    const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const i = pickRay(oL, dL);
    if (t > 0 || i >= 0) {
      if (i >= 0) { const q = TW().anchors.gene(i); _xp.set(q[0], q[1], q[2]).applyMatrix4(TW().group.matrix); }
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
function xrClickGene(i) {
  if (APP.mode !== 'explore') return;
  XR.kbd.open = false;
  $('#q').value = ND.genes[i].sym; showTab('genes'); selectGene(i, false);
}
function xrPickSuggestion(i) {
  XR.kbd.open = false; XR.kbd.q = '';
  $('#q').value = ND.genes[i].sym; showTab('genes'); selectGene(i);
}
// Stand inside: in the headset the tower is shown at about life size around you, centred where you stand
function xrRoom(on) { XR.room = on; }
// how close the headset may zoom: as close as the scene's own closest view, else 0.9 (closer, the scene would surround your head)
const xrMinD = () => (XR.room ? 0.05 : Math.min(0.9, ...Object.values(GL.sets[X.scene].cam || {}).map(v => +v[2] || 9)));
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
  XR.room = !!X.room;
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
  return ['x', audioLabel(), X.tab, X.scene, JSON.stringify(X.ctl[X.scene] || {}), X.group, X.gene, JSON.stringify(X.pick), [...X.off].join(','),
    X.walk ? X.walk.from + ':' + X.walk.top.join(',') : '', X.walkFrom, X.mine.join(','), X.walkers, X.showZ, X.colour, X.grid, X.room, X.egroup, X.err,
    XR.kbd.open, XR.kbd.q].join('|');
}
const XR_HERE = 'nmd';
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
    // apart at 1.7 m (0.382 m apart, the outer ones 58° to the side)
    const n = HOST.list.length, a = (k - (n - 1) / 2) * (n > 9 ? 0.225 : n > 8 ? 0.245 : n > 7 ? 0.272 : 0.31), d = n > 9 ? 1.7 : n > 8 ? 1.55 : n > 7 ? 1.4 : 1.25;
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
  ctx.fillText(fitText(ctx, 'Muscle and heart', x - 40), 40, 36);
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
    ctx.font = vfont(24, on ? 700 : 400); ctx.fillStyle = on ? VC.ink : VC.muted;
    ctx.textAlign = 'center'; ctx.fillText(n, tx + tw / 2, y + 18); ctx.textAlign = 'left';
    if (on) { ctx.fillStyle = VC.cyan; ctx.fillRect(tx + 10, y + 58, tw - 20, 4); }
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => { XR.kbd.open = false; showTab(k); } });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 88;
  const bottom = P.h - 34;
  if (XR.kbd.open && X.tab === 'genes') return drawKeyboard(ctx, P, x, y, W);
  ({ groups: drawGroupsPane, genes: drawGenePane, walk: drawWalkPane, layers: drawLayersPane, endo: drawEndoPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
function searchField(ctx, P, x, y, W, text) {
  vButton(ctx, P, 'search', x, y, W, 66, '', () => { XR.kbd.open = true; XR.kbd.q = ''; }, { r: 10 });
  ctx.strokeStyle = VC.muted; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x + 32, y + 30, 11, 0, 7); ctx.moveTo(x + 40, y + 38); ctx.lineTo(x + 49, y + 47); ctx.stroke();
  ctx.font = vfont(25); ctx.fillStyle = VC.faint; ctx.fillText(text, x + 66, y + 20);
}
// buttons that wrap like the HTML chips: items -> { id, label, on, col, fn }
function flow(ctx, P, items, x, y, W, maxY, o = {}) {
  const px = o.px || 22, h = o.h || 44, gap = 8;
  let cx = x, cy = y;
  ctx.font = vfont(px);
  for (const it of items) {
    const sw = it.col ? 22 : 0, w = Math.min(W, ctx.measureText(it.label).width + 26 + sw);
    if (cx + w > x + W) { cx = x; cy += h + gap; }
    if (cy + h > maxY) break;
    vButton(ctx, P, it.id, cx, cy, w, h, '', it.fn, { r: 6, on: it.on });
    if (it.col) swatch(ctx, cx + 12, cy + h / 2 - 7, 14, it.col);
    ctx.font = vfont(px, it.on ? 700 : 400); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, it.label, w - 26 - sw), cx + 13 + sw, cy + h / 2 + 1); ctx.textBaseline = 'top';
    cx += w + gap;
  }
  return cy + h - y;
}
// a labelled bar, for z-scores, walk visits and link counts
function bar(ctx, x, y, W, label, v, max, col) {
  ctx.font = vfont(22); ctx.fillStyle = VC.ink;
  ctx.fillText(fitText(ctx, label, W * 0.52), x, y);
  rr(ctx, x + W * 0.55, y + 6, Math.max(4, W * 0.45 * Math.max(0, v) / (max || 1)), 14, 3); ctx.fillStyle = col; ctx.fill();
  return 34;
}
const head = (ctx, x, y, t) => { ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(t, x, y); return 34; };
const groupItems = (cur, fn, idp) => ND.groups.map((G, k) => ({ id: idp + k, label: G.short, on: cur === k, col: G.col, fn: () => fn(k) }));
const endoItems = (g, idp) => ND.groups[g].endo.map(e => ({ id: idp + g + ':' + e.c, label: `${e.c}${e.name ? ' · ' + e.name : ''}`, col: endoCss(e.c),
  on: X.pick.some(([a, b]) => a === g && b === e.c), fn: () => togglePick(g, e.c) }));
function drawGroupsPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, [{ id: 'g:-1', label: 'All groups', on: X.group < 0, fn: () => selectGroup(-1) }, ...groupItems(X.group, selectGroup, 'g:')], x, y, W, bottom) + 18;
  const g = X.group, G = ND.groups[g];
  if (!G) { textBlock(ctx, 'Pick a group to light up its module: its known genes (the seeds), the genes the walk added, and its endotypes.', x, y, W, 26, 38, VC.muted); return; }
  y += textBlock(ctx, G.name, x, y, W, 34, 42, VC.ink, 700, 2) + 4;
  y += textBlock(ctx, `${G.seeds} known genes, ${G.added} added by the walk${G.added >= 200 ? ' (stopped at 200)' : ''}, ${G.endo.length} endotypes.`, x, y, W, 23, 32, VC.muted, 400, 2) + 12;
  y += flow(ctx, P, [{ id: 'col:endo', label: 'Endotype colours', on: X.colour === 'endo', fn: () => { X.colour = X.colour === 'endo' ? 'group' : 'endo'; renderGroups(); } },
    { id: 'grid', label: 'Grid by endotype', on: X.grid, fn: () => { X.grid = !X.grid; renderGroups(); } },
    { id: 'zs', label: 'Layer scores', on: X.showZ, fn: () => { X.showZ = !X.showZ; renderGroups(); } }], x, y, W, bottom, { px: 23, h: 52 }) + 16;
  y += head(ctx, x, y, 'Endotypes (press to pick)');
  y += flow(ctx, P, endoItems(g, 'pe:'), x, y, W, bottom - 150, { px: 21, h: 40 }) + 16;
  if (y + 80 > bottom) return;
  y += head(ctx, x, y, 'Where its known genes cluster most (z-score)');
  const zs = ND.D.ppi.map((l, p) => [G.z[p], l]).sort((a, b) => b[0] - a[0]), zmax = Math.max(1.645, zs[0][0]);
  for (const [z, l] of zs) { if (y + 34 > bottom) break; y += bar(ctx, x, y, W, `${ND.layers[l].name} ${z.toFixed(1)}`, z, zmax, z >= 1.645 ? G.col : VC.line); }
}
function drawGenePane(ctx, P, x, y, W, bottom) {
  searchField(ctx, P, x, y, W, 'Search a gene');
  y += 90;
  const i = X.gene;
  if (i < 0) {
    y += textBlock(ctx, `Point at a gene in the tower and pull the trigger (or pinch). The ${fmt(ND.N)} genes are those of the ${ND.groups.length} disease modules.`, x, y, W, 26, 38, VC.muted) + 20;
    flow(ctx, P, QUICK.map(findGene).filter(k => k >= 0).map(k => ({ id: 'qk:' + k, label: ND.genes[k].sym, fn: () => selectGene(k) })), x, y, W, bottom, { px: 24, h: 52 });
    return;
  }
  const G = ND.genes[i], gs = groupsOf(i), cnt = new Map();
  for (const [, s] of ND.nb[i]) for (const j of s) cnt.set(j, (cnt.get(j) || 0) + 1);
  y += textBlock(ctx, G.sym, x, y, W, 42, 48, VC.ink, 700, 1) + 2;
  y += textBlock(ctx, G.go.slice(0, 2).join(', ') || 'No GO process listed', x, y, W, 23, 32, VC.muted, 400, 2) + 14;
  for (const g of gs) {
    if (y + 52 > bottom - 200) break;
    swatch(ctx, x, y + 14, 18, ND.groups[g].col);
    ctx.font = vfont(24); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, `${ND.groups[g].short} · ${isSeed(i, g) ? 'known' : 'added'}`, W * 0.46), x + 30, y + 10);
    const bw = W * 0.5;
    vButton(ctx, P, 'gp:' + g, x + W - bw, y, bw, 46, '', () => togglePick(g, G.endo[g]), { r: 6, on: X.pick.some(([a, b]) => a === g && b === G.endo[g]) });
    ctx.font = vfont(21); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, endoLabel(g, G.endo[g]), bw - 24), x + W - bw + 12, y + 12);
    y += 54;
  }
  y += 6 + textBlock(ctx, `Linked in ${ND.nb[i].size} layers to ${cnt.size} module genes.`, x, y, W, 24, 34, VC.muted, 400, 2);
  vButton(ctx, P, 'mine', x, y + 8, 280, 56, 'Walk from here', () => { addMine(i); showTab('walk'); }, { px: 23 });
  y += 84;
  y += head(ctx, x, y, 'Partners (most layers first)');
  flow(ctx, P, [...cnt].sort((a, b) => b[1] - a[1]).map(([j]) => ({ id: 'nb:' + j, label: ND.genes[j].sym, fn: () => selectGene(j) })), x, y, W, bottom, { px: 22, h: 42 });
}
function drawWalkPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, 'The walker jumps back to its start genes seven times in ten, follows links otherwise, and changes layer half the time where it can.', x, y, W, 23, 32, VC.muted, 400, 3) + 12;
  y += head(ctx, x, y, 'Start from');
  y += flow(ctx, P, [...groupItems(X.walkFrom, k => { X.walkFrom = k; renderWalk(); }, 'wf:'),
    { id: 'wf:mine', label: `Your genes (${X.mine.length})`, on: X.walkFrom === 'mine', fn: () => { X.walkFrom = 'mine'; renderWalk(); } }], x, y, W, bottom, { px: 21, h: 40 }) + 12;
  if (X.walkFrom === 'mine') y += flow(ctx, P, X.mine.map(i => ({ id: 'um:' + i, label: ND.genes[i].sym + ' ×', fn: () => { X.mine = X.mine.filter(k => k !== i); renderWalk(); } })), x, y, W, bottom, { px: 22, h: 42 }) + 10;
  vButton(ctx, P, 'run', x, y, 300, 60, 'Run the walk', () => runWalk(X.walkFrom), { primary: true, px: 25 });
  if (X.walk) vButton(ctx, P, 'wclear', x + 312, y, 150, 60, 'Clear', clearWalk, { px: 24 });
  vButton(ctx, P, 'walkers', x + W - 260, y, 260, 60, 'Show walkers', () => { X.walkers = !X.walkers; pushState(); renderWalk(); }, { on: X.walkers, px: 24 });
  y += 76;
  y += textBlock(ctx, X.err || (X.off.size ? `${X.off.size} layers knocked out: the walk avoids them.` : 'All layers on.'), x, y, W, 23, 32, X.err ? VC.amber : VC.faint, 400, 2) + 12;
  const R = X.walk;
  if (!R) return;
  y += head(ctx, x, y, 'Most visited genes');
  const mx = R.top.length ? R.heat[R.top[0]] : 1;
  for (const i of R.top) {
    if (y + 40 > bottom) break;
    vButton(ctx, P, 'wt:' + i, x - 6, y - 4, W + 12, 38, '', () => selectGene(i), { r: 6 });
    y += bar(ctx, x, y, W, `${ND.genes[i].sym}  ${groupsOf(i).map(g => ND.groups[g].short).slice(0, 1).join('')}`, R.heat[i], mx, VC.cyan) + 4;
  }
}
function drawLayersPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, [['all', 'All on', () => true], ['ppi', 'Proteins only', L => L.cat === 'ppi'], ['cores', 'Only the cores', L => /_core$/.test(L.key) || !/^(ppi|coex)_/.test(L.key)]]
    .map(([k, n, fn]) => ({ id: 'ls:' + k, label: n, fn: () => setLayers(fn) })).concat([{ id: 'ko', label: 'Knock out 10', fn: () => knockRandom(10) }]), x, y, W, bottom, { px: 23, h: 52 }) + 12;
  y += textBlock(ctx, `${ND.L - X.off.size} of ${ND.L} layers on. Lit buttons are on; press one to knock it out.`, x, y, W, 22, 30, VC.muted, 400, 2) + 8;
  for (const c of CAT_ORDER) {
    const ls = ND.layers.map((L, l) => [L, l]).filter(([L]) => L.cat === c);
    if (y + 70 > bottom) break;
    swatch(ctx, x, y + 6, 16, CAT[c][1]); ctx.font = vfont(21, 700); ctx.fillStyle = VC.muted; ctx.fillText(`${CAT[c][0]} · ${ls.length}`, x + 26, y + 2);
    y += 30;
    y += flow(ctx, P, ls.map(([L, l]) => ({ id: 'ly:' + l, label: L.name.replace(/ \((IID|GTEx|HPO|MPO|Reactome|NeDRex|CRISPR screens)\)$/, ''), on: !X.off.has(l), fn: () => setLayer(l, X.off.has(l)) })), x, y, W, bottom, { px: 16, h: 30 }) + 8;
  }
}
function drawEndoPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, groupItems(X.egroup, k => { X.egroup = k; renderEndo(); }, 'eg:'), x, y, W, bottom, { px: 21, h: 40 }) + 14;
  y += flow(ctx, P, endoItems(X.egroup, 'ep:'), x, y, W, bottom - 220, { px: 21, h: 42 }) + 16;
  if (!X.pick.length) { textBlock(ctx, 'Pick endotypes, from one group or several, to see their genes through every layer and where they link.', x, y, W, 24, 34, VC.muted); return; }
  y += head(ctx, x, y, `Picked (${X.pick.length})`);
  y += flow(ctx, P, X.pick.map(([g, c]) => ({ id: 'pk:' + g + ':' + c, label: `${ND.groups[g].short} ${c}`, col: endoCss(c), on: true, fn: () => togglePick(g, c) }))
    .concat([{ id: 'pclear', label: 'Clear', fn: clearPick }]), x, y, W, bottom, { px: 21, h: 40 }) + 14;
  const st = endoStats();
  if (!st.rows.length) { textBlock(ctx, `No links ${X.pick.length > 1 ? 'between them' : 'inside it'} in the layers that are on.`, x, y, W, 24, 34, VC.muted); return; }
  y += head(ctx, x, y, X.pick.length > 1 ? 'Links between them, by layer' : 'Links inside it, by layer');
  const mx = st.rows[0].n;
  for (const r of st.rows) { if (y + 34 > bottom) break; y += bar(ctx, x, y, W, `${ND.layers[r.l].name} ${r.n}`, r.n, mx, X.pick.length > 1 ? VC.amber : endoCss(X.pick[0][1])); }
}
// the three scenes, and the chosen scene's own controls
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 24) / 3;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  if (X.scene === 'tower') y += textBlock(ctx, 'The tower answers to the other tabs: Diseases, Genes, Walk, Layers and Endotypes.', x, y, W, 23, 32, VC.faint, 400, 2) + 14;
  for (const c of (s.controls || []).filter(c => X.scene !== 'tower' || c.key !== 'colour')) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  if (X.scene === 'tower' && y + 70 < bottom) vButton(ctx, P, 'room', x, y, 360, 60, 'Stand inside the tower', () => setRoom(!X.room), { on: X.room, px: 24 });
}
// on-panel keyboard for searching genes
const KROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
function drawKeyboard(ctx, P, x, y, W) {
  const kb = XR.kbd;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted;
  ctx.fillText('Search a gene by its symbol, or a process like SARCOMERE', x, y);
  y += 36;
  rr(ctx, x, y, W, 70, 10); ctx.fillStyle = 'rgba(149,166,189,0.10)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = VC.cyan; ctx.stroke();
  ctx.font = vfont(32); ctx.fillStyle = kb.q ? VC.ink : VC.faint;
  ctx.fillText(kb.q || 'Type with the keys below', x + 20, y + 18);
  if (kb.q) { const w = ctx.measureText(kb.q).width; ctx.fillStyle = VC.cyan; ctx.fillRect(x + 24 + w, y + 16, 3, 38); }
  y += 88;
  const sug = matches(kb.q, 5);
  if (kb.q && !sug.length) textBlock(ctx, `No gene matches “${kb.q}”.`, x, y, W, 25, 36, VC.muted);
  sug.forEach((i, k) => {
    const yy = y + k * 60;
    vButton(ctx, P, 'sug:' + i, x, yy, W, 54, '', () => xrPickSuggestion(i), { r: 8 });
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(ND.genes[i].sym, x + 16, yy + 14);
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, ND.genes[i].go[0] || '', W - 420), x + 170, yy + 15);
    ctx.fillStyle = VC.faint; ctx.textAlign = 'right'; ctx.fillText(fitText(ctx, groupsOf(i).map(g => ND.groups[g].short).slice(0, 1).join(''), 220), x + W - 16, yy + 15); ctx.textAlign = 'left';
  });
  const kw = 84, kh = 70, g = 9, ky0 = P.h - 34 - 4 * kh - 3 * g;
  KROWS.forEach((row, r) => {
    const rw = row.length * kw + (row.length - 1) * g, rx = x + (W - rw) / 2 - (r === 2 ? 50 : 0);
    [...row].forEach((ch, k) => vButton(ctx, P, 'key:' + ch, rx + k * (kw + g), ky0 + r * (kh + g), kw, kh, ch,
      () => { kb.q = (kb.q + ch).slice(0, 24); }, { px: 28 }));
    if (r === 2) vButton(ctx, P, 'key:back', rx + rw + g, ky0 + r * (kh + g), 2 * kw, kh, '⌫ Delete', () => { kb.q = kb.q.slice(0, -1); }, { px: 24 });
  });
  // gene symbols have digits (MYH7, TNNT2): a row of them above the letters
  const rw0 = 10 * kw + 9 * g, rx0 = x + (W - rw0) / 2;
  [...'1234567890'].forEach((ch, k) => vButton(ctx, P, 'key:' + ch, rx0 + k * (kw + g), ky0 - kh - g, kw, kh, ch, () => { kb.q = (kb.q + ch).slice(0, 24); }, { px: 28 }));
  const by = ky0 + 3 * (kh + g);
  vButton(ctx, P, 'key:dash', x + 40, by, 380, kh, '- (dash)', () => { kb.q = (kb.q + '-').slice(0, 24); }, { px: 24 });
  vButton(ctx, P, 'key:clear', x + 432, by, 170, kh, 'Clear', () => { kb.q = ''; }, { px: 24 });
  vButton(ctx, P, 'key:done', x + 614, by, 290, kh, sug.length ? 'Choose ' + ND.genes[sug[0]].sym : 'Close', () => {
    if (sug.length) xrPickSuggestion(sug[0]); else kb.open = false;
  }, { px: 24, primary: !!sug.length });
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
// Optional voice-over: put an MP3 at audio/narration-nmd.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-nmd.mp3', {
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
  if (p !== null) t = p;
  SLIDE.tail = e > t || p !== null ? { s: slideStop(i), v: Math.max(e, t), t, at: performance.now() } : null;
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
    let best = 'tower', ba = 0;
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
    // the story's disease group carries over to the panels
    if (best === 'tower') { X.group = Math.round(S.tower_group || 0) - 1; X.colour = S.tower_endo > 0.5 ? 'endo' : 'group'; X.grid = S.tower_grid > 0.5; }
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows the tower as it tells it: no picked gene, endotypes, knocked-out layers or walks
    if (X.room) setRoom(false);
    X.group = -1; X.gene = -1; X.pick = []; X.off = new Set(); X.walk = null; X.err = ''; X.showZ = false; pushState();
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
    if (ev.key === '/' && APP.mode === 'explore') { showTab('genes'); $('#q').focus(); ev.preventDefault(); }
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
    // #nmd&explore&scene=motor&view=heart (any control of a scene by its key), &group=5 or &group=Cardiomyopathies,
    // &q=TTN, &pick=5:13,11:7 (group:endotype), &walk=5 (a group, or genes: &walk=TTN,DES), &off=10 (layers knocked out)
    if (hp.get('scene')) openScene(hp.get('scene'), false);
    orbit.cur = view(X.scene, 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    const s = GL.sets[X.scene];
    for (const c of s.controls || []) if (hp.get(c.key)) setCtl(X.scene, c.key, hp.get(c.key));
    const grp = v => { const n = parseInt(v, 10); if (!isNaN(n)) return n >= 0 && n < ND.groups.length ? n : -1; return ND.groups.findIndex(G => [G.name, G.short].some(x => x.toLowerCase().startsWith(String(v).toLowerCase()))); };
    if (hp.get('group') && grp(hp.get('group')) >= 0) selectGroup(grp(hp.get('group')));
    if (hp.get('pick')) { for (const pc of hp.get('pick').split(',')) { const [g, c] = pc.split(':').map(Number); if (ND.groups[g] && endoOf(g, c).n) togglePick(g, c); } showTab('endo'); }
    if (hp.get('off')) knockRandom(parseInt(hp.get('off'), 10) || 0);
    if (hp.get('walk')) {
      const w = hp.get('walk'), g = grp(w);
      if (/,/.test(w) || g < 0) { X.mine = w.split(',').map(findGene).filter(i => i >= 0); X.walkFrom = 'mine'; runWalk('mine'); } else { X.walkFrom = g; runWalk(g); }
      showTab('walk');
    }
    if (hp.get('tab')) showTab(hp.get('tab'));
    if (hp.get('q')) { $('#q').value = hp.get('q'); runQuery(hp.get('q')); }
    if (hp.has('inside')) { needTower(); setRoom(true); }
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
  // shared rooms (shared.js): the clock is APP's, the shared state the explore panes (a walk is state: it comes out
  // the same everywhere), so there are no effects
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
