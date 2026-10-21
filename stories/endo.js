// Endotypes: one disease, many mechanisms. Congenital myasthenic syndromes, from the junction between nerve and
// muscle to the protein network: seed genes, a random walk with restart, each gene's neighbourhood, a tree that
// splits only when the data say so, and the 12 endotypes it finds. After the ISMB 2026 poster "Introducing
// EndotypY: a Python package for network-based disease endotyping" by Chloé Bûcheron, Iker Núñez-Carpintero, Enes
// Sakalli, Mathilde Meyenberg, Julia Guthrie and Jörg Menche (LBI Network Medicine, University of Vienna), on their
// run of EndotypY (github.com/menchelab/EndotypY).
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/endo/build.mjs from the tour's kit, the muscle story's motor set and the data, sets and engine parts
// in tools/endo: edit those, not this file.
HOST.register('endo', function (HOST) {
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
// ENDO_DATA (the analysis data, tools/endo/sets/data.js) comes first, then the muscle story's disease groups
// (NMD_DATA, only for its motor set).
const SETS = {};
// the muscle story's disease groups, for its motor set
const NMD_DATA = {"groups":[{"name":"Motor Neuron Diseases","short":"Motor neuron","col":"#ff5a4b","site":"neuron"},{"name":"Hereditary Motor and Sensory Neuropathies","short":"Motor & sensory nerve","col":"#ff8a3d","site":"nerve"},{"name":"Hereditary Ataxias","short":"Ataxias","col":"#ffb43b","site":"neuron"},{"name":"Hereditary Paraplegias","short":"Paraplegias","col":"#e6d23c","site":"neuron"},{"name":"Congenital Myasthenic Syndromes","short":"Myasthenic syndromes","col":"#3ee08f","site":"junction"},{"name":"Congenital Myopathies","short":"Congenital myopathies","col":"#46d9ff","site":"muscle"},{"name":"Distal Myopathies","short":"Distal myopathies","col":"#4d94ff","site":"muscle"},{"name":"Metabolic Myopathies","short":"Metabolic myopathies","col":"#2fc4b2","site":"muscle"},{"name":"Other Myopathies","short":"Other myopathies","col":"#8fa8ff","site":"muscle"},{"name":"Muscular Dystrophies","short":"Muscular dystrophies","col":"#b07bff","site":"muscle"},{"name":"Congenital Muscular Dystrophies","short":"Congenital dystrophies","col":"#d77bff","site":"muscle"},{"name":"Hereditary Cardiomyopathies","short":"Cardiomyopathies","col":"#ff5ad9","site":"heart"},{"name":"Other Neuromuscular Disorders","short":"Other disorders","col":"#9aa8bb","site":"muscle"}]};

// ENDO_DATA: the EndotypY run on congenital myasthenic syndromes for the endotype story. Generated by
// tools/endo/data/gen_data.py from the authors' files; never edit by hand. Typed arrays are base64 (little-endian).
// facts: counts and settings: genes and links of the protein network, seeds, module (393 genes), found (module genes
//   that are not seeds), endotypes, hood (neighbourhood size: the top pct % of the network by each gene's own walk),
//   r (the walk's restart probability), terms (columns of the feature matrix, from featLib), annotated (genes with
//   at least one term), nameLib (the library that names the endotypes)
// seeds: [symbol, protein, Gene Table item] for the 35 seed genes, in the Gene Table's order
// endo: per endotype { id, n, name, term (its strongest Jensen_COMPARTMENTS term), p (adjusted), strong (2 clear, 1 weak,
//   0 none), col, place (where it acts in the synapse: mito, lamina, golgi, channels, er, endosome, vesicles,
//   scaffold, junction, or '' for none), seeds (its seed genes) }
// nodes: every gene of the network is a point; the first `core` have names and a layout, the first `mod` of those
//   are the module genes in tree order (each endotype a run); names: the core's names, '|'-separated
// gene: Uint8 per module gene, its endotype id; seedOf: Uint8 per module gene, 1 + its index in seeds, or 0
// pos: Int16 x, y, z per node (/10000; the module near the middle, unit radius for most of the core)
// heat: Uint8 per node, the walk from all seeds (log scale; seeds 255)
// links: Uint16 pairs of node indices among the core: the first modLinks are the module's own links, then
//   module-to-core links, then a sample of the rest (nLinks in all)
// groups: k (neighbourhood sizes) and g: Uint8 [k][seed] the seed's group at that k (0 = largest group)
// hood: Uint16 x hood per module gene, the node indices of its neighbourhood
// terms: the feature matrix's terms; featN: Uint16 per module gene, its number of terms; featI: Uint16, their indices
// tree: mod - 1 merges in scipy order (index < mod a leaf, mod + i merge i): ab Uint16 pairs, h Uint8 height (/255),
//   cut Uint8 1 where the merge joins two endotypes (the test accepts that split), 0 inside an endotype
const ENDO_DATA = {"facts":{"genes":18306,"links":316613,"seeds":35,"module":393,"found":358,"endotypes":12,"hood":184,"pct":1,"r":0.8,"terms":457,"annotated":389,"featLib":"GO_Cellular_Component_2026","nameLib":"Jensen_COMPARTMENTS"},"seeds":[["CHRNA1","Cholinergic receptor, nicotinic, alpha polypeptide 1","11.1"],["CHRNB1","Cholinergic receptor, nicotinic, beta 1 muscle","11.2"],["CHRND","Cholinergic receptor, nicotinic, delta","11.3"],["CHRNE","Cholinergic receptor, nicotinic, epsilon","11.4"],["COLQ","Acetylcholinesterase collagen-like tail subunit","11.12"],["CHAT","Choline acetyltransferase isoform","11.13"],["SYT2","Synaptotagmin II","11.14"],["AGRN","Agrin","11.16"],["MUSK","Muscle, skeletal, receptor tyrosine kinase","11.17"],["DOK7","Docking protein 7","11.18"],["RAPSN","Rapsyn","11.19"],["GFPT1","Glutamine-fructose-6-phosphate transaminase 1","11.20"],["DPAGT1","Dolichyl-phosphate (UDP-N-acetylglucosamine) N-acetylglucosaminephosphotransferase 1 (GlcNAc-1-P transferase)","11.21"],["ALG2","Alpha-1,3/1,6-mannosyltransferase","11.22"],["ALG14","UDP-N-acetylglucosaminyltransferase","11.23"],["SCN4A","Sodium channel, voltage-gated, type IV, alpha","11.24"],["LRP4","LDL receptor related protein 4","11.25"],["SNAP25","Synaptosome associated protein 25","11.26"],["COL13A1","Collagen type XIII alpha 1 chain","11.27"],["SLC5A7","Solute carrier family 5 (sodium/choline cotransporter), member 7","11.28"],["SLC18A3","Solute Carrier Family 18 (Vesicular Acetylcholine), Member 3","11.29"],["PREPL","Prolyl endopeptidase-like","11.30"],["SLC25A1","Solute carrier family 25 (mitochondrial carrier, citrate transporter), member 1","11.31"],["MYO9A","Myosin IXA","11.32"],["VAMP1","Vesicle associated membrane protein (synaptobrevin 1)","11.33"],["LAMB2","Laminin, beta 2 (laminin S)","11.34"],["CHRNG","Cholinergic receptor, nicotinic, gamma polypeptide","11.35"],["PLEC","Plectin","11.36"],["GMPPB","GDP-mannose pyrophosphorylase B","11.37"],["LAMA5","Laminin, Alpha 5","11.38"],["UNC13A","Unc-13 homolog A (C. elegans)","11.39"],["RPH3A","Rabphilin 3A","11.40"],["TOR1AIP1","Torsin A interacting protein 1","11.41"],["CHD8","Chromodomain Helicase DNA-Binding Protein 8","11.42"],["DES","Desmin","11.44"]],"endo":[{"id":0,"n":9,"name":"No shared place","term":"Translocon complex","p":0.12,"strong":0,"col":"#9aa3b5","place":"","seeds":["RAPSN"]},{"id":1,"n":29,"name":"Mitochondria","term":"Mitochondrial part","p":2.3e-11,"strong":2,"col":"#a98bea","place":"mito","seeds":["PREPL","SLC25A1"]},{"id":2,"n":47,"name":"Basement membrane","term":"Extracellular matrix component","p":4.8e-14,"strong":2,"col":"#3cc4e6","place":"lamina","seeds":["COLQ","AGRN","COL13A1","LAMB2","LAMA5"]},{"id":3,"n":26,"name":"Golgi","term":"Golgi membrane","p":0.0002,"strong":2,"col":"#34d1a8","place":"golgi","seeds":["CHRNE","DPAGT1","ALG14"]},{"id":4,"n":12,"name":"No shared place","term":"AP-2 adaptor complex","p":0.089,"strong":0,"col":"#c7d65a","place":"","seeds":["SLC18A3"]},{"id":5,"n":35,"name":"Ion channels","term":"Sodium channel complex","p":0.00081,"strong":2,"col":"#e3a03c","place":"channels","seeds":["CHRNB1","CHRND","SCN4A","TOR1AIP1"]},{"id":6,"n":13,"name":"Organelle membranes","term":"Bounding membrane of organelle","p":0.0015,"strong":2,"col":"#e2557a","place":"er","seeds":["VAMP1"]},{"id":7,"n":17,"name":"No shared place","term":"ATPase complex","p":0.2,"strong":0,"col":"#8f9bb0","place":"","seeds":["CHRNA1"]},{"id":8,"n":15,"name":"Endosomes","term":"Endosome","p":6.6e-10,"strong":2,"col":"#58d06a","place":"endosome","seeds":[]},{"id":9,"n":25,"name":"Vesicles","term":"Cytoplasmic vesicle","p":3.5e-06,"strong":2,"col":"#5d86f0","place":"vesicles","seeds":["SYT2","MUSK","ALG2","SNAP25","RPH3A"]},{"id":10,"n":34,"name":"Muscle scaffold","term":"Costamere","p":0.04,"strong":1,"col":"#f07b5a","place":"scaffold","seeds":["DOK7","SLC5A7","PLEC"]},{"id":11,"n":131,"name":"The junction","term":"Neuromuscular junction","p":0.053,"strong":1,"col":"#e070d0","place":"junction","seeds":["CHAT","GFPT1","LRP4","MYO9A","CHRNG","GMPPB","UNC13A","CHD8","DES"]}],"nodes":18306,"core":2000,"mod":393,"names":"DHRSX|C14ORF156|MRPL27|ZNF274|CKMT2|LBX2|ACSM3|GLDC|SLC25A1|AK2|PREPL|C13ORF27|PDHX|C4ORF26|ZNF556|DHODH|GFPT2|COQ4|C9ORF170|MTG2|PMPCA|UQCC2|TFAM|METTL20|SUCLA2|CRYZ|METTL2A|CARS2|DHRS4L2|IGSF5|GDF10|SMOC2|ZNF224|MMP19|SGTA|ADAMTS1|ELANE|FBLN5|LEPREL1|ZNF778|KRTAP5-3|ZNF563|COL7A1|FN1|ALG13|GLT25D1|VWA1|PLOD1|PLOD2|PLOD3|LAIR2|COLQ|COL13A1|GLT25D2|PARP4|CCL3L1|IGFL3|ADAMTSL4|TEX15|CCL3|TXNDC5|C1QTNF7|FAM55C|NID2|FGF4|BCAN|AGRN|PI15|CFC1|EDN3|LAMA5|LAMB2|C1ORF54|CBLN4|CRP|ELSPBP1|SNX20|HTT|MUSK|APPL1|CHP1|EHD3|ZFYVE20|MANSC1|RPH3A|SNAP25|STX19|SYT1|SYT2|C8ORF47|NCOA7|PLXDC2|TNFRSF10C|SLC29A4|TMEM184C|PDCD6IP|ALG2|PTPN23|SLC5A1|CD63|CD9|TSPAN1|TBC1D15|SGMS2|BNIP1|VAMP1|CNNM1|C9ORF167|LOC100507703|HLA-C|DNAJC16|SCNN1A|ADAM30|ROR2|RAB3A|RAB8B|RAB27A|RAB27B|RAB8A|LAMTOR1|CPLX1|VPS45|STX4|VAMP2|DNAJC13|SNX1|EHD1|EHD4|RAP1GDS1|ELOVL7|RNF24|MTCH2|SLC27A1|TLCD2|TSPAN31|MFSD1|TMEM186|C20ORF108|SLC18A3|MFF|SLC38A10|SCGB1C1|ITPRIP|S1PR5|ALG14|SAR1B|EEF1AKMT4-ECE2|SUN1|GPR126|MANEA|DPAGT1|TPST2|FZD6|ICAM4|UGT3A2|GALNT2|SCD5|CHST11|ST3GAL2|CSGALNACT2|EXTL2|METTL7B|MBTPS2|TMEM219|TUSC3|CHRNE|SGCB|GMPPA|PCDHA4|OLFML3|GML|CHRNA1|ADPGK|CD1E|ALG11|SLC5A9|RGS4|TNFSF18|ACPL2|ZDHHC7|ATP1B2|PI4K2B|OCA2|WLS|ZNF177|RAPSN|C10ORF35|LRP12|TMEM18|UBE2J1|ZDHHC6|FAM63A|FNDC3A|CYP2A13|EMD|TMEM80|FAM134C|SLC19A2|TMEM63B|DPY19L4|LPPR3|ABCC4|LRRC8A|PPM1L|RETSAT|FAM8A1|SLC27A3|PDZD8|CYB5R1|DNAJC18|ITPRIPL2|C1ORF43|FAM189B|CHRNB1|CHRND|SCN1B|SCN4A|SCN8A|HERPUD2|ASB11|TOR1AIP1|APOL2|SNX13|SYVN1|CCDC167|SEC11C|FADS3|POMT2|SLC9A5|ACRBP|KIAA1549|ITGB1BP1|FLT3|CSF1R|PIK3R2|BCAR1|CRK|DOK7|HSPA1B|SRCIN1|SYNM|MYLK3|SPRY2|TEK|PLEC|TRIM67|MYH7|AVIL|DQX1|RABEP2|KPTN|SLC5A7|SYT5|DRC9|CALM3|KCNN1|CDC37|EPHA10|EPHA5|MERTK|BLK|FOXA3|GALK1|BHMT2|WBP5|ZNF383|ZNF214|AGGF1|PRUNE|NEK10|EIF2D|HAUS7|GPSM2|WHRN|CHRNG|SRP9|SELPLG|CHAT|VWFP1|ALS2CR11|DIRAS2|DOC2A|UNC13B|DIRAS1|UNC13A|OSBPL2|SYNPR|CHP|SUN2|SEC14L1|SPPL2B|MFAP3|SMO|MVP|PPT1|LMTK3|ROS1|FAM169B|SHISA5|CD53|RAC2|ANXA7|C19ORF26|PODXL|FLT1|LRP4|TRIM68|DAG1|COL17A1|ERBB2IP|OBP2A|BVES|EPHA6|MYH1|C12ORF10|NOTCH2NL|PLEKHA6|SELS|DEFB123|HEMGN|COPS7A|UBE2F|GATA2|TBC1D4|GSDMC|AKR1C1|AKR1B10|ALOX12B|ALOX15B|MPP5|SPATA13|ZNF280A|MYO9A|PDCL2|POTEF|IFT57|ARHGAP36|SPATA17|ADSSL1|WHAMML1|DES|PPP1R13B|IFFO1|DUX1|KRT31|KRT34|PDDC1|CCT4|PEX7|GBA3|PDCL|ARHGEF38|TBCE|HSP90AB1|CCNB2|GMPPB|ANXA11|RBPMS|SYDE1|AKD1|IL20RA|TPMT|AKR1D1|GEMIN5|RG9MTD2|AFF3|DOC2B|CRY2|WT1|PHF15|INO80|LRTM2|HSF2|MAD2L1BP|TP63|ACHE|RPL21|RASGEF1A|CHD7|CHD8|CHP2|DUX4L9|SBK3|ZNF816|SIRT6|GFPT1|SYNE1|BRWD1|ENOSF1|ZNF296|ZNF423|ARL4C|ATG4C|ARMCX4|KRTAP10-3|ZNF34|ZNF621|CSN3|SPATS1|ZNF187|KRTAP5-1|MRAP|MSANTD3|ZNF248|ZNF584|PRMT3|SLC47A1|TMUB2|DKK3|ANKRD36B|IL37|SOCS6|TEP1|SHPK|GUSBP1|FAM69A|SH3GLB2|ZNF354C|FGD5|FZD8|TMEM59L|ZBTB33|ELAPOR1|PDE6H|C3ORF58|GPX8|LONRF3|TMEM101|COL18A1|KCMF1|CRYBA2|SERPINH1|OIT3|PUSL1|CCDC68|PAN2|EFEMP2|CWC27|TMEM62|XIRP1|ARHGAP10|RHOB|NEFM|LEPREL4|FNDC8|FBXO2|IMMP2L|CASK|CRB3|TMOD4|DNAJC30|RHOA|KRT8|TRIM9|EEF1DP3|WHSC1L1|CAMKV|FST|MNAT1|PID1|CRTAP|STX1A|ST3GAL4|PCNXL3|ATXN7|PREB|CISD2|AP3B1|TUSC2|LTBP1|NTN5|TMPO|LAPTM5|SDF2L1|TBCC|EIF2B5|STX1B|ZBBX|MDH2|RPS29|GHDC|LEMD2|DHRS2|CRYL1|PDGFRA|ATF6|C7ORF34|DST|KRT23|AAK1|GFI1B|CIMAP1D|SMG5|PLEKHS1|ABCA3|C4BPB|SIRPD|RBM46|SDHB|CCDC141|PAAT|ITGA6|GLT8D1|KLHL8|ABTB2|COL6A2|DPPA4|EMX2|TMEM35A|TGOLN2|DGUOK|OS9|FEZF1|ALG12|M1AP|MTM1|ITSN1|ESYT2|GOLPH3|COL6A1|ZZEF1|PRPF39|HID1|SLC30A8|GOLM1|KHDRBS1|LRRTM4|ST7|STAT3|KIAA1383|SQLE|CORO1A|CAND1|RAPGEF5|TMTC3|EPHA7|ZDHHC9|SAMD3|DNAJB9|BEX1|GLYCTK|HMGCL|TBL2|TTC17|SLC27A4|BCHE|AP3B2|GALNTL1|FAM98C|EPHA8|SLC30A7|CCNF|HERC1|CA10|NUP88|NACA|LEPRE1|ZNF74|ABCC10|LEPREL2|SNCA|PARP16|ATXN1|UBE4A|DPYS|PDE3A|ACAA2|PIGW|UNKL|RNF214|DYSF|C19ORF28|ZBTB7A|KRTAP8-1|WDR70|VEGFB|GPATCH2|C14ORF104|C17ORF62|CARM1|LRPAP1|ACADL|SIDT2|KRT73|TUBB2B|WASHC3|RFPL4B|SH3KBP1|CTNND1|SOST|FBLN1|TRIM7|MACF1|VLDLR|NME4|IL5RA|PYHIN1|SCGB2A2|NCR3|ST7L|LOC100507680|HSPA13|MAD2L1|ISLR|DNASE1L1|ZNF398|ABLIM2|MECOM|BPNT1|ZNF17|BOLL|UBR4|WDR20|NFATC2IP|TMEM131|MRM1|TAP2|P4HA1|HMOX2|SCGN|C1ORF52|RDH11|DFNA5|ZNF121|UNC45A|BCAM|HSPA8|TMEM66|TSR2|TMEM111|ROR1|ZMYM5|MFSD5|MFAP4|GPIHBP1|CD48|EDA|TMEM39A|LBX1|PRNP|KIAA1161|EPB41L5|STX3|CARD8|SLC44A1|MYC|RUSC1-AS1|ACOT7|PDIA5|TACSTD2|INS|PDPK1|ZNF331|ASB6|GALNT12|UBAC2|CRKL|KRT33B|TXN|CXORF66|FSTL4|TSG101|LILRA5|MSTN|BTLA|C8ORF48|SDCCAG8|KRTAP19-6|CHMP7|KRT78|SLURP1|CLDN4|CLCN3|KIF5B|BMPR2|CUX1|NMU|TMEM30A|PRKAR2A|MAGT1|FAM162A|TMEM63A|MAP1A|ZNF330|SPATA22|KANK1|SLC27A2|ZFP41|PARK2|KIF1C|TYW3|DNAJC10|SLC12A9|SLC15A4|FBLN2|LYPD6B|TMEM57|AMBRA1|SCAPER|CHD9|STON2|EPHX1|VSIG4|NOL4|ALDH18A1|TMEM201|YBEY|KLHL15|GTPBP5|CHRNA5|GGH|USF1|NUFIP1|PNPLA6|CSPG5|WDR55|UBE2R2|ANK3|ATP5IF1|SNAPIN|FAM210B|KPNA5|DYRK1A|AQP10|TGFBR2|KRT222|P4HB|MFAP5|ZNF707|TAP1|CRISP2|SLC22A4|SELT|BRPF3|GXYLT1|ID1|ZNF669|SKAP1|GOLGA8G|TUFM|LEMD3|ODF2|HMGCR|KIAA1429|ZDHHC17|NIPSNAP3A|HSPB2|PPP2R2B|CHCHD4|EIF2AK3|BET1|CAPN2|FCER1G|HADHA|CEP76|RGR|BRPF1|CUL3|GBF1|IKZF5|ALG9|CTSS|PARP11|UBE2Q1|UBE3A|NAP1L3|CAPN3|PLD6|CT55|LY86|POM121|KIAA0528|EXTL3|KRT2|SPPL3|CD274|DHRS7|IGF2BP2|SLC25A48|RSPH6A|C16ORF79|ATP1A3|GLRB|ERC1|WNK1|KPNA6|MRPL21|SGTB|FIBP|GPM6A|MRPL41|RTF1|EDDM3B|ERGIC2|GFOD1|KRT14|CMTM3|LPHN1|TOR1A|VASP|PMPCB|PKD2|NBL1|MNS1|SREBF2|MAD2L2|MCAT|FTSJ2|SLC35A4|GP1BB|RNF208|TCP1|IFT46|C10ORF58|NCF1|SIN3B|C2CD4B|MAX|PIGO|THSD7B|NFKBIL1|ZSCAN21|MGAT5|RAF1|B4GALT7|C1QB|APBA2|CT45A5|NAT14|TRGV3|PRG2|CA6|SLC12A4|HSD17B12|NXPH3|DUX4|GPATCH8|KCNA2|CYB5R3|ARGLU1|IGF2BP1|AK4|MRPL10|PIGU|SPATA24|SMG7|SPATA12|CDC42|DNAJC1|KRTAP9-3|SOAT1|MTHFR|SNAP29|LIPG|CCDC92|TSHR|STX11|MIER1|NES|TUBB2A|EAF2|NAA15|NDUFS6|CST9L|ASH2L|ANTXR1|INA|HSPD1|KIAA2013|VIM|ZNF829|FAM83A|KRT39|ITGB4|CTDP1|POLR1C|PPP4R1L|GATA3|NSF|PSME1|AGTRAP|FAM24B|C15ORF24|EXOG|ELOVL4|TMEM85|UGT8|BOD1|OPTN|RETREG3|SBDS|LEO1|BRD2|FZD2|FAM124B|EGFR|TSPAN6|RBBP5|KRT20|TP53BP1|TERF2IP|SLC29A1|SPTAN1|DACH1|RHBDD1|KRTAP12-3|NEUROG3|STAM|GAN|SQSTM1|MIIP|SLMAP|RPN2|RPN1|SULF2|PLPP4|ACE2|PIGN|KASH5|UBL4A|FIBIN|C1ORF190|GPRC5B|DSP|MRPS34|CDHR4|SLC7A1|RNF5|ELL2|VAMP5|BEND7|DIEXF|MAGED1|LYZL2|MRPS17|MAOB|BTN2A2|GPAA1|REEP4|IL12RB1|KRT18|CDC34|FITM2|PLCD3|RPL34|TEPSIN|VAMP3|PLAUR|NAPB|FCGRT|AGPAT4|YAF2|CST11|CFTR|SLC35A1|RTN1|CENPB|KRTAP1-3|TMEM229B|EZH2|CCT2|MRFAP1L1|CLGN|UQCRFS1|NCAPH2|UXS1|SELENBP1|SYNC|ARL13B|TMPPE|C6ORF141|NDUFS7|TOP3B|HSPA2|PTPRK|BRD3|KRT13|KIF14|GJA1|MRPS25|MLLT1|FOSL1|SGK196|EIF2B3|DCAF16|VPS11|MAP4K4|UBE2A|AIFM1|IGLL5|KRT16|AFF4|YIF1A|CWC22|TSPAN33|FA2H|DPF1|KRTAP1-1|CDC16|MADD|CEACAM8|SPRY4|RCOR1|ZNF408|ORMDL3|PPP1R16A|ASCL4|TRIM52|ALPP|KRTAP5-9|SMC3|ITGAM|CDC73|MRPS24|C22ORF39|CUL7|BRCA2|KRTAP10-9|RLN1|FAHD1|TCAP|NOTCH2NLC|ESRP1|SCN3B|TTYH1|GPR89A|TMX2|IGF2BP3|STK4|GPR152|ACTG1|MIP|ADNP|SETD1A|NAF1|ZNF655|SLC31A1|SF3B3|PRPH|MLLT3|BNIP2|EIF2B1|DCAF8|PPM1G|YARS2|PSMC3|PTCH1|ISCA2|ISG15|CTR9|JUNB|ATG9A|H2AFZ|ZNF444|MRPL12|TMEM25|ERN1|CLEC11A|PIH1D2|LYPD4|FBXO6|POLR2G|C18ORF25|EBP|IDS|LDLRAD1|TMEM107|ELAVL2|PAF1|SEC62|KRTAP10-7|PNKP|GABPB1|CBX4|TADA3|SPRED2|NOLC1|KLHL22|CHST8|KRT38|EIF2B2|BOP1|CREB3L1|PPP1R18|YY1|SSSCA1|PIP4K2C|KPNA2|TMEM87A|GPBP1L1|CENPH|DCAF5|FXR1|TSNAX|CEBPA|FAM9A|PPP1CA|ACTC1|PTDSS1|UBXN7|ANKRD17|CTCF|CDS2|CDK9|RBM25|LMNA|FUNDC2|PPP1CC|ERGIC3|EIF2B4|COPS4|C1ORF216|AP2M1|C1QBP|BAHD1|KLC3|BAIAP2|LASS2|TSPO2|NOTCH2NLA|PFDN5|TFPT|COPS7B|MRPS5|KRT37|RANBP10|FAM120A|THAP3|PSMD14|KEAP1|BAG5|LGALS1|PMP22|CREB3|PTPN1|CD97|CYLD|PIAS2|CHEK2|BTNL2|TSC22D4|LENG1|MLH1|PSME3|VAMP4|TENT5B|ERMP1|PPL|TMEM14B|KLK15|RAD18|PNMA2|NEFL|KRTAP10-8|LATS1|TRIM69|SYCE1|KPNA1|HDGFRP2|AQP6|AHCYL2|SNW1|YIPF3|KRT19|KMO|CWF19L2|OR2A4|DDX39B|IQUB|TF|MDFI|TCEA2|CSNK2B|AURKB|RALBP1|CANX|ZC2HC1C|LASS6|LMO4|FBXW11|U2AF2|VTI1B|COPS2|LAT|ARIH1|KRT75|FUS|UBQLN2|MAP1LC3B|UBXN6|NOTCH2|YES1|LZTS2|GOT1|LENG8|JMJD6|CYSRT1|KRT15|SPANXN2|NDEL1|SFN|ACTA2|NEK6|EHHADH|ARRB2|RAC1|COPS6|TSPAN15|KCTD17|DDX6|UBE2O|AHCYL1|STX17|PDE4DIP|RPL10|WDR5|AR|MEOX2|COPS3|HSPA4|GFAP|KRT40|FGFR1|LASP1|RNF4|DVL2|RPS10|JPH3|CTNNB1|MALL|ACTB|CUL4A|HSPA5|AGR2|GOLGA6L9|COPS5|CUL4B|RELA|TFIP11|SIRT1|PRPF40A|NPM1|STUB1|RPL31|BRD4|TRAF2|APP|OR6A2|YWHAQ|ANLN|HSP90AA1|CDH13|FGFR3|CHRNA4|MAP7D2|CHRNB2|KIAA0586|MIPEP|HTR3A|OR51E1|NKAIN1|C2CD2|GPR98|MOBKL1B|CHRNA3|COL23A1|SORL1|COL4A4|PRKACB|DUX3|GSN|HTR3C|C3ORF52|KLK6|DKFZP686O24166|MC2R|CHRNB4|ZDHHC12|HFE|COL21A1|COL5A2|COL6A3|EMID2|CX3CR1|KIAA1598|ZNF559|LAMA1|GPR182|COL9A3|C12ORF52|OR6B1|COL4A2|COL4A1|OR10H2|OR10A4|OR7A5|SYTL3|RXFP1|COL8A2|SYTL1|UBQLN1|OR2G6|COL4A6|GRIN2C|ADAMTS7|TDRD10|COL16A1|GABRA3|LRP1B|SRI|CLEC12B|METRNL|C1QTNF1|GALNTL4|MYRIP|ARSK|MPPE1|GP9|ZNF786|IL17RA|HTR3B|FCN1|CLRN2|ST14|KLRC2|MARCH4|BMP1|PIGH|SEMA3B|PCSK6|LAMP3|DHRS4L1|ZNRF4|C1QTNF9B|MCOLN3|JAG2|SEMA3C|LDLR|MTIF2|COL12A1|TMEM169|CD70|SLC39A4|TCTN2|LGALS9|LAMB1|GUSB|MMUT|PCSK9|LOXL2|LTBP4|SCARA3|COLEC11|LRRC55|GBA|IDUA|FZD1|SLC22A9|VWDE|ZBED2|HCST|SYTL2|NCEH1|TMEM59|SLC4A8|LAMB3|MAN2B1|SPRED1|MAN2B2|ITGA7|KLRC3|CNTNAP3B|LAMC1|ZNF507|TRIM28|LGALS3|GPR114|SYTL4|FGFR4|FGF14|CNTNAP3|PIP4K2A|SCAP|TRIM39|TRMT12|FRAS1|SV2B|FSHR|CCNDBP1|C14ORF80|HRAS|CADM3|SLC39A12|MIA3|CILP2|NAGLU|TMPRSS12|PCDHB1|TMEM106A|ZFPL1|NRSN1|GPR21|CHRNA9|LGALS8|OLFM2|CRELD1|SLC23A2|COLEC10|NOTCH3|APOM|CASP6|LNPK|LRP5|HLA-F|ZNF365|THBS1|ENO1|DPM2|POGLUT1|ACCN4|LRP6|PLPP6|CNGA4|RAN|CHPF2|MYCBP2|LRP2|C1QTNF8|MUT|CRELD2|ZACN|LY6G5C|EDEM3|GDF11|HLA-DQA1|TVP23B|COL9A2|CEP70|HPN|NUDT8|KCNK16|PCDHGC4|RACK1|DGCR2|MARCO|GALNT15|COL14A1|TRIP13|APLP2|TOR3A|C3ORF64|KCNS3|TMEM9B|SYTL5|NAAA|PLXNA1|STXBP1|SLC7A14|MS4A15|PLEKHM3|PLTP|GABRD|C5ORF34|PON2|COL1A1|THSD4|CD3D|TUBB8|GRN|PSCA|KRIT1|TP53|PBXIP1|NPTN|SNAP23|TOR1B|CHRNA10|NIPAL1|WNT5A|CERCAM|LAMA4|CLEC4E|MMP2|FCER1A|TRPC4AP|KIF1B|PCDHB3|TMEM132A|COL2A1|ZNF432|TMEM2|PTCHD3|PRSS23|OR1D4|SFTPC|ATRN|VNN2|GNPTG|CHST12|QSOX1|MEGF8|ADAM9|OAF|MRAP2|GGPS1|CSPG4|GALNS|SLC2A2|C22ORF32|ART5|KLHDC2|MLPH|LRRC52|DARS2|STX12|PRF1|HSPG2|LRP3|CHRD|CRTC3|FBN2|TTC13|METRN|MAN2A2|COL5A1|CELSR1|ATF6B|DOLK|KIAA1715|MYO5C|CDH5|CTBS|TSPAN17|PCDHGA5|PCDHGC5|KREMEN2|KIR2DS3|SPAG9|PCDHB11|BTNL3|CHM|NMRK2|PCDHB7|COL25A1|KDELC1|ACP5|HLA-DRA|LPPR1|LPAR2|CNTNAP1|ATP2B2|EFEMP1|H6PD|TMEM95|FUT11|CHML|HLA-G|TIMP3|C6ORF154|GGT7|ANKS3|PCDHGB4|C1QTNF3|SLC17A2|SNX16|CACNA2D2|PLXNA3|LAMP2|VAPB|GJA8|ECEL1|ENTPD2|TMED6|GYPB|GRB2|MTHFS|VAPA|ADIPOQ|KCNE3|MESDC1|GPR37L1|HYAL2|LCTL|CNPY3|EXT2|CXCL6|ST8SIA6|SERPINC1|APBB2|CNIH1|PTPRU|KLRD1|PDIA4|CLEC2B|KLF11|CHST5|NUDT19|ITM2C|VCP|SLC22A15|CHID1|PTGIR|ABCA2|ABHD14A|GPR56|FOXRED2|EMR4P|HARS2|C1QTNF9|LPAR1|ARLN|CACNA1C|LARS2|KIAA0090|STX7|RNF11|NOTCH1|CD79A|POLG|BMP8A|LYG2|LAMA3|HSPA1A|FFAR1|LRFN3|CLEC2D|LY6G5B|IQGAP3|MBTPS1|C11ORF87|SDHC|HSPB1|FAM209A|CD3E|FAM189A2|TMPRSS13|PCDHB6|PCDHAC1|COL4A5|PLAU|KLRC4|HS3ST1|ITGB1|COTL1|GABRA6|VIPAR|ADSS|TGFB1|CD1A|WFS1|MANBA|ATP2A3|RTP2|ADRB2|SCGB1D4|DPYSL3|C1QL1|SYN3|ZNF740|LRP1|KTN1|C1QTNF2|SPOCK2|CD79B|EXT1|MATN2|ALX3|ARMC1|KCNMB3|RBM8A|TMEM254|P4HTM|BSCL2|NIPA1|BTC|ADAMTS2|CTSA|BORCS7|ZNF22-AS1|CMTM5|CHST6|C3ORF32|ARSB|LPAR3|COL10A1|TNFRSF6B|SERF1B|PROS1|CPLX2|CACNA2D1|B4GALT3|KBTBD2|TP53BP2|GALNT10|SAAL1|FGF12|UQCC1|FADS2|PLXNA2|LRRTM1|CRYAA|GAS6|GPC3|CHST14|EIF2AK4|IL17RB|PAM|SEMA4B|SEL1L|RFWD2|IL22RA1|C1QA|EDEM2|PALM2|KRBA1|CPS1|OR10H1|TMEM176A|OR4N2|DLD|CHST3|C9ORF91|NUP58|DISC1|SRC|TSPAN18|EMILIN2|B4GALT4|CRIP3|SEMA6B|GOLGA2|MMAB|UNC13D|TAS1R2|BAG6|GDF15|GEN1|KLRC1|AIM1|MFI2|VMA22|NID1|ACYP2|CHST10|TMPRSS3|RYK|ADAM21|LOC81691|HLA-DPA1|IL13RA2|TMEM14C|SLC28A2|ADAM10|LMX1B|C21ORF63|STX2|CYP19A1|BMP4|TUBA4A|SCN9A|PEAK1|VAC14|ADAM33|GOLPH3L|TMEM67|MAP7|TUBB|PRKAB2|WWOX|C3AR1|PGRMC2|PPOX|CACNB4|DNAJB6|APPBP2|MCCC1|PXDN|SEL1L3|LRRC23|GALNT7|NARS2|B3GNT1|NAGA|IL17RC|CRLF1|TLR9|STXBP5|TUBA1A|UGT1A7|C15ORF32|PILRA|PLCD4|TARDBP|CX3CL1|NTN1|BAG2|C16ORF55|KLHL2|HLA-DRB1|TTN|TRMT2A|RPH3AL|ANKRD46|PCDHAC2|EIF2S3|CREB5|CLSTN1|UBC|ADCY9|CD1D|TNFSF8|NEB|CRYGS|SLC22A2|IGF1R|MYO9B|CGREF1|KDELC2|DESI1|CBX5|ARL6IP1|NOMO1|INSR|SDHD|SPINT2|SGCA|TMEM31|SEMA6A|EPPK1|MAGEA9|PIK3R3|PRR14L|KIAA1199|GPC4|PCDHB16|FATE1|KRTAP10-5|HS6ST2|SLC1A1|PTPRN|PCSK5|C19ORF46|UGGT2|ERLEC1|SEPN1|SYP|TRIM27|EPB41L3|IPPK|TMEM42|RAMP3|CTSF|ACAD10|ARHGEF18|NEDD4|TLL2|AQP9|AP3S1|GYLTL1B|ZNF195|MYST2|SDC2|RNF14|CLSTN3|TEX264|EXOC8|FYN|KCNA5|TOP3A|NAGPA|COL3A1|PCDHGB5|SEMA4G|RPL23|SLC39A8|BCL2L13|CST8|GDI2|COL8A1|LYZL1|VWCE|TMEM86B|CEP55|ACRV1|HSP90B1|EAF1|DNALI1|FBXW5|SYT12|SOD1|SMCO4|TMEM179B|KCNK18|DBT|ASPH|LMAN2L|SRPRB|LTBP2|GIPC1|YAP1|TMEM63C|KCNA10|TRARG1|NTM|LMF2|PRPS2|UPK2|CAV1|PTCH2|HRG|TMEM243|BMP8B|STX8|AQP3|MTHFD2|SULF1|CSK|PRPS1|ADAMTS13|GLG1|MDK|CBWD1|YWHAG|BDNF|CMYA5|CHSY3|YIPF6|PIK3R1|MGRN1|ACOT9|SGSH|TMPRSS11B|SNAPC5|VAMP8|NPTX1|STX5|BTNL8|DPP4|PLXNB2|SERBP1|GABRE|STX6|TACR1|TMEM237|KIF1A|C1GALT1C1|HNRNPH2|PUS1|MGST3|VCAN|RUFY3|FKBP14|EPHB4|MYOM2|NPPA|TAF2|MAN1A1|ADAD2|HEPACAM2|DALRD3|HLA-E|SERPINA12|ASPHD2|ZNF521|COLEC12|SRR|TAZ|ACSF3|TCEANC2|STIM1|ATP2A1|MRPS36|ESR1|NXPH4|UBIAD1|GOSR2|CCK|MET|SGPL1|CCR6|BGLAP|TRDN|CTAGE5|PSG9|MTO1|TMED7|TM4SF19|CYP26B1|PDCD6|AVPR2|DNM2|LGR4|TMEM116|CYCS|IPO13|YWHAE|TMLHE|SLC30A2|PRRC2B|STXBP2","gene":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkGBgYGBgYGBgYGBgYGCAgICAgICAgICAgICAgIBAQEBAQEBAQEBAQEAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMHBwcHBwcHBwcHBwcHBwcHBwAAAAAAAAAAAAUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsL","seedOf":"AAAAAAAAAAAXABYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABRMAAAAAAAAAAAAAAAAACAAAAB4aAAAAAAAACQAAAAAAIBIAAAcAAAAAAAAADgAAAAAAAAAAGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFQAAAAAADwAAAAAADQAAAAAAAAAAAAAAAAAABAAAAAAAAQAAAAAAAAAAAAAAAAALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgMAEAAAACEAAAAAAAAAAAAAAAAAAAAACgAAAAAAABwAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAABsAAAYAAAAAAAAfAAAAAAAAAAAAAAAAAAAAAAAAAAARAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAACMAAAAAAAAAAAAAAAAAAB0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAACIAAAAAAAwAAAAAAAAA","pos":"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","heat":"X6NQeWSuqV//o/+4pKerrbBfpqWoqmWlba6oQaqqs3Okb5SlXaSqq1qqr6Nsrqi0prO5//+1rquvkrCjpaWmsKqr/6mmp///pKatqXGq/7E1bLZu//+qp/9mc2ClXV2l/6Zap2e0mK6l/65bV52mqaljqKuqsqelsWmmqamZZmlqqKVnpG2qY2lo/6qnpqWm/2NWaK2v/6eqqqlxrKq2bGpVZLCr/6WpbcWk/7KwY12oaqZbYKOyqaj/YK2lcaCjZVhtamVipKeqbaOmpaeap6erq6ij//+k/7JhRv+naKi3sbKrcaS/slZZqaqj/6GspFSaVf+lZ2WmbqT/plqnV5hgW1pqqUkucKOppqu4tqlksv+tLv+3UXd2fMX/r7o4cc6mraWlplZbxLSkb7dhpGT/o7J3p1lWV2thpzaqpGWQNqRZsjxSp66ndlH/NaNnqVKrXv9pcbKOmalcYHxZpXCYpv+tka6tb1x3U7Wmt1yZpm67oKeluaWwo/8zqF2mpv+1pzKksW6jxbaurKurq6qqqqqqpqampqWlpKSko6Ojo6Ojo6OioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoJ+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2cnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5qampqampqampqampqampqampqampqampqampqampqampqampmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pjo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6OjY2NjY2NjY2NjY2NjY2NjY2NjY2MjIyMjIyMjIyMjIyMjIyMjIyMi4uLi4uLi4uLi4uLi4uLioqKioqKioqKiYmJiYmJiIiIiIiHh4eHh4aGhoaGhYWEhIOCgoKCgoCAgH9+fn59fHx7e3t7e3p6enl5eXh4eHh4eHh3d3d3d3d3dnZ2dnZ2dnZ2dnZ2dXV1dXV1dHR0dHR0dHR0dHRzc3Nzc3Nzc3Nzc3Nzc3NycnJycnJycnJycnJycnJxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFwcHBwcHBwcHBwcHBwcHBwcHBvb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbWxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2trampqampqampqampqampqampqampqampqampqampqampqampqampqampqampqamlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGdnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2ZmZmZm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","links":"AADiAAEACgACAAMAAwAbAQQAagEEAOAABQAKAAYAMQEHABIABwBKAQgAJgEJACIBCQAmAQkA3AAKAFABCgALAAoADQAKABIACgAZAAoAHAAKABcACgAaAAoAEwAKAFoBCgAMAAoAFAAKALAADQAUAA0AXgEOADEBDwBIAA8AYwEQAIABEACBARMAFAATABkAFABUARUAVQAWAGUAGAAbARsACAEdADEBHgAxASAAMQEhAIIBIgASASIA0AAiADIAIgCoACIAKgEiAPIAIgBcACMAOwAjAD0AIwA3ACMAewEjADUBIwAxASQAOwElAHsBJQAyASUAOAAlAEIAJQAsACUARgAmADMAJwAxASgAOQApADUBKQAxASoAKwAqAEYAKwBUASsAMwArADIALABjACwAcQAsAOIALAAvAC0AMwAtADUALQAxAC4ASAAuADUALgAyAC4A1QAvADMALwAwAC8AMQAvADQAMAAzADAASQAwADUAMAAxADEAMwAxADQBMQA1ADEAMgAxADQAMgA0ATIANQAyAEIAMgA0ADIARgAzAE4BMwB3ATMANQAzACUBMwA2ADMAOgAzADIBNAA1ADQAHgE1AD0ANgAlATcAQgA3AEYAOAC7ADgAMQE4AEIAOAA+ADgARgA4AEcAOQDyADkAEgE5AEIBOwCyADsAQgA7ADMBOwCgADsAMAE7AJsAOwCZADsARgA7AEcAPADyADwAYwE9AOMAPQAyAT0AQgA9AD4APQCZAD0ARgA+AEgAPgClAD4ASgA/AEIAPwBAAD8AlQA/AEYAPwBHAEAAQgBAAEYAQQBGAEEARwBCAEgAQgBLAEIARABCAEUAQgBJAEIASgBCAEMAQgCVAEMAIAFDAK4AQwBGAEMARwBEAE4BRABGAEQARwBEACABRQBOAUUAIAFFAEYARQBHAEYAqgBGAEgARgBLAEYASQBGAEoARgCVAEYAjQBHAKoARwBIAEcASwBHADIBRwBJAEcASgBHAJUASACyAEgA0ABIADMBSACgAEgAMAFIAIwASADfAEgAlwBIAJoASQAgAUkAMwFJAJEASgCnAEsAcQBLACABTAAbAUwAhAFMABQBTQD0AE0AYABNAIgBTQDsAE0AVAFNAJYATQAPAU0ATwFNALkATQBlAU0AVQBNAFgATQDfAE4AbQBOAO4ATgAAAU4ANQFOAGEBTgBwAE4A/gBOAHwATgCCAU4AUgBPAIMBTwDtAE8AVABQAOQAUQB+AFEAfwBRAFIAUgA5AVIAfgBSAPYAUgD3AFIAqABSAFYBUgB5AFIAfwBTAOoAUwAbAVMAfABTAL8AUwC1AFQASQFUAHQAVABIAVQAbgFUAHUAVAByAFQAdgBUAHMAVABmAVQAdgFVAFYAVQB6AFUAHQFVAHsAVQBXAFUA7wBVALgAVQB4AFYAFQFWAHsAVwBjAFcAWABXAJ8AVwBcAFcA/ABYAG0BWADgAFgAQAFYAGwBWAD8AFkA4gBaABsBWwBqAVsAiAFcAMMAXACQAFwAgwBcAF0AXABeAFwAiABfAGAAXwBhAF8AkQBgAE4BYAB4AWAAZAFgAC0BYAB3AGAAYQBgACoBYgBjAGMAvgBjAMkAYwCuAGMAkABjALoAYwCJAGMAZABjAMEAYwDEAGMArwBjAMMAYwCGAGMAvQBjALcAZABlAGUAxABlAJ8AZQDDAGUAugBlAMUAZQCDAGUAkABlAIkAZQCgAGUA3gBlAIUAZQCIAGYAcwFmAEwBZwBpAGgA1gBoANUAaABPAWkAegBpAIIAaQDhAGkAQgFpAIEAaQB7AGoAbQBqANYAagClAGoAqABqANgAawBwAGwAbQBsAHAAbQBwAG0ArABtAG4AbQABAW0AlABtAHEAbgBwAG4AqwBuANgAbwDWAG8AcABvAKsAcAAgAXAAcQBwAKIAcAChAHAA4QBwAKYAcQDuAHEAAAFxAMIAcQD+AHEAYQFxAGUBcwB2AHQAdQB1AFQBdwAVAXcAgwB4AHsAegDCAHoAhgB6AHsAfABDAX0AEgF+AH8AgADkAIAALAGAAPkAgAAbAYAAhwGAABgBgABdAYMAIgGDAIsAgwCGAIQAqwCGAMQAhgCuAIYAkACGALQAhgCHAIYAswCIACIBiAArAYgA4gCIALMAiQArAYoAiwCKAOAAigAhAYsA4QCLAN0AjADYAIwAqwCOAKUAjwDYAJAAcwGQACsBkAAPAZAA4gCRAOIAkgArAZMAsQCTAMIAkwCfAJMAggGUANgAlACrAJUAnwCWAK0AlgBHAZYArACWAKkAlgCeAJcA1gCXAJ8AlwClAJcArACXANgAmADYAJgAqwCZAFgBmQBZAZkApQCZANgAmgClAJsAcwGcAKsAnQDYAJ4ABQGfALEAnwAgAZ8ArACfAKAAoAAiAaIAzQCjAKUAowDYAKQA1gCkAKUApQAiAaUAuwClAOMApQCyAKUA0AClADMBpQAvAaUA4QClAKYApgDWAKYArQCnAGMBqgBOAasAvgCrANYAqwDNAKsA3wCrAMwAqwDSAKsAxgCsANwArQDAAK4ADwGxAMQAsQDFALEAIAGxAIIBtQBaAbUAYwG2ANYAtwDWALcA1QC5ADMBugDEALsA1QC8ANYAvQDfAL0A4QC9ABsBvgBzAb8A1QDAAOIAwgAgAcIAggHCAMMAwwDgAMQAKwHFACIBxQDGAMYAIgHGANgAxwDWAMcA2ADIANYAyQBzAcoA1QDKAOIAywDYAMwA1gDMAFwBzQDWAM0A3wDOANYAzgBzAc4A3wDPANMAzwDVAM8A1gDQANgA0ABoAdEA1QDRANYA0wDWANMA1QDUANYA1AD5ANQA2ADVACIB1QAzAdUA3QDVACMB1gDdANYAIwHWAOMA1gDhANYAIgHWAN8A1wDYANgAIgHYAN8A2AAjAdgA2QDYAD0B2AAkAdsAGAHcAAsB3ACIAdwAgwHcAHUB3ACFAd8A+QDiAFwB4gAuAeIAIwHkAB8B5AB8AeQAGwHlAEwB5gD7AOcAWAHnAO0A6ADuAOgA/gDpAO4A6QD+AOoA7ADqAO0A6wDsAOsA7QDrAO8A7ADtAO4AAQHuAAIB7gA4Ae4AMAHuACcB7gADAe4AKAHuAPMA8ABUAfEA/gDyABIB8wD+APQAWQH0APUA+ABMAfkATwH5ABsB+gBjAfoAIQH7ACEB/QD+AP4ANwH+AAEB/gACAf4AOAH+ADAB/gD/AP4AJwH+AAMB/gAoAf4AUQH+AEMB/gBLAQABBAEAAQIBAAFhAQABAwEEAVkBBAFhAQQBcwEFARUBBgFKAQcBYAEIARsBCAE8AQkBMQEKATEBCwEVAQwBYwENAUwBDgFjARABEQERATEBEQE0AREBEgERAT8BEgFYARIBWQESAXQBEgETARIBZQESATsBEwF7ARMBQAEVAV8BFQGDARUBQgEVARYBFQFwARcBGgEYARsBGAEaARgBQQEZARoBGQFuARoBTQEaARsBGgFuARsBVQEbASwBGwFqARsBhwEbAV0BGwFoARsBSgEbAWABGwEcASABTgEgAYIBKQGBATEBPgExAX8BMgFbATUBNgE6ATsBOwFpAUIBZQFEAUwBRQFqAUYBTgFGAWoBTAFxAUwBZwFMAVoBTAF5AU4BbgFPAYIBTwFTAVIBVAFTAVYBUwGCAVQBVwFUAX0BVAF1AVUBVgFVAXYBWQF1AVoBWwFaAWsBWwFcAVsBXQFcAV4BXQFeAWIBYwFqAWsBbwF+AXIBcwF6AXsBgAGBAYEBhgHCAGAGbQDQBBUBMwTWAA8CGgHNATkAkwTfAKwF9ADKA4sANQZWAVEESgDOAcwADAQiAX0FQgCrAnoA7gI+AHoCxwCeBaoAxwYxAFQGQgFfBNAA/QV+AcgDIgBtByIBPgWLAF4ENQBIBqwAOQaAATYHmQBtBNwAhAOLAJ4DoADkASIBTgSUAAwDCADDAVgASwSJALcEWwCOBy8AzQWTAFEE3wCaBpcAnwNGAY4EpgC9BbEAowLRAKsF3wD9BFcAzQGAADQGTQA+BsIANQJwAGkD0AD4BEQAqAVhAYgFHQCABcIAzAS/ALQHFwGqAosAhgZwAY8FowA6B8cAYAXYAHMCZgDqBYABhQI1ACkGRAAwBsIAhgNGAIoCwgCwAtMARgLDAN8FzgAgB4wAOgfJAA4GPgHkBlgAUAQjACsFIgC0AZgAFAbfAL8FSACQBXEAmgUYAfABpgAMA1UATALFAJoGTgFmB2EBTwS5AAgCSAC7BQABsAIeAc0BSACuBdMA5QRIADQH0AATA5cA1wMLAXgD0ACyB+wA0AQrAEAFowAABL0AqgNDAEQFrACgB60ApAG7AFoF2QBjBeQAtARuAGEGMQBHBQkAMgKDAKYCAAGgBzAA8QRYAUUEYAANA4AAdAR9AaIEYwDYATMBAwbFAHkFWQEjA1wAtQL0AKIEiwDWBjQBaQNUAdADKwBrBOMAjgVhAVAGQAAGBUkBmQOGABwH1QDhAe0AEAIBAKMFPgD+BT0AtQc9ABAGVgBXBRYAEwQiAcUDqgAfAmEAeAUiAGgEmADlBGoA/QR6AHgFbQAMA0kA3AU5AV8COQDxA7EAWAJJAM8FqwDZAtwAiAJvAFkGYwAgApoAKAWxAEkGYQE3AxIAXwdDAaUEMwGOB7gAAAO+AOkGiAE1BGYB5gX+AOQERwAlAvQASQTWAGQDTwDnAUkBfgfhAKgDKwC9ASgBIAZ1AAkHTgEjBEkAMQW9AHQDOQBxBhgA7wYRAOcBLwEBBkcAswO3AIYHRwBTAt8ARgJqAAoGlAC6BeoAwgYaAYkDmgD+BEYAVgIiAEcFRQCmBDEANQTYADsCpgD8BUwBpQSDARACRADkBEgAtgExAJoHKwBOAs8AawWZANAEpgD1BtMARQPqAAEH5ABQBMkAewVNANQC2AB2A3cA9gRFADkFxACuAggA1wHIAOoECACwAiIB5QFLANcFPQAVBpcA2wHCAG8DbwDGAhQAUgJHAesC0QBsB8IAkQOEAPgEggA1BhUBNgRlAYAELwFfBUgAdgNJAFMFCwAEBZUAxQZIAFgFZgDuAmEBYgVFAFgFXABJBnEABgeIAJ4DYwHKAVgA9AJHAZEGTQB6AmwA0QZTAJIFTQAaBnMABAagAG0HSQDiBXwAvQExABYFFQFmA1QASwL0ABgERQD7BiIB/gN7AU0EdwBPA6sABQJDAI4CuwAkBWEAlQJqAJAHMgA4BiIB6gR1ABAF1ADsBCMBfwbpACYGzQAYAi8ALwIjAC4FSQDzBdoAngO/AGwHcAGBBKwALQOgAFUC6gDhAtgAegROAaUDdgABBp8AHgWXAJ4GAAHiBKAABgesAAcFewHMBLEAOAOYAL0FFQG/A7UAswPgAMIHmwArBdEARgIVAZ4BLwDzBMAA/QVDAcsH3QBhB0kAIQW9AAIETQCjBEMAygGVAH8G3ACjBMQA1gO+AL4CPACjBFwBYATRAGUG2AB9AyAAHAWuAJ4DgwB4BZoAvQUiANQBMAAgBZUAcAUAAbwGQwCYBTIBdQQgATUCfACsBfQA3QRNACYHOwCOB3sAqwGIAMQETwBmAzABPwIEAawCbQAwBkcAeQIxAMgGsgD+BKMA6AW8AJ4FfAAvBTkAbAVcAJYBIAHwAVUBlgSbAOcCYgB/A0UARAWYAPAB4wAkBiIBfQfhAFIECQD1AskAXwUVAfMCAAFaB8cA5QRLAOQGqAAUBZwAcwY5AB8G3ADCA9AANgV8ACkFewDcAdAARQPmAO8FoABJBsYADgZFALAGegC6B1gAbARwADkF3AAeAxwAYARPAegCaAB5A+4AYgUwADkDewF8AygAvQNIADgDAgD7A30AQAS3AI4GegAFBBMAUgYoAP0DiwB5A6sAwQJkAegGFQEjA3QABAbFALsHoQApBMwAUAVNABoDMgD5ASMBZAf4ANMGxgARBUkBCwcxAL0BwgDNAeYAKQUNACADLQDxBL8AIge7AN8F6wBKB/QAjgRUASADOAAYBecAMgIVAVoEEQGnBdwAjgG7AP4EVAEOBE8BmQNnAKkBFQF5BFMAtAKVAAAEWQGVAngBsAJKABUGOwCdB3UBjAY1AAwFWAEtBjMAaQIpAe4EKwCHBU4BYQPhADkHMgENArIA5wS7ACQGOQC8BSQAiAOmAL0GzgDsBFMBTARnAXMDTgEEBDgAaQXCAMECpAArBfUAxQEiAfIEIAE0BUkA5ARhAcME8AAHB5UARgIKAMICSABkBUoAXAVBAJ0H7wAVA60AlwTqAH8DhAA+BW8AgQUYAEcG9ADrAkwAcgJwAEcH3AA1Am0AyQVVAYIDYQG/BWMB+gF6AJ0EPgH5AaQANgVEAMcGPQCsAU0A/gObAJgDOACSA9MAoQVIAFkFVAGyBBUBzgJcAdoEYwHyAr4A1gPYAHIDOQD9A/IAPgeCAVEEgQCWBt8ATQUrALgFagClAg8BDgRdAcADegAgBuYAewVbAVYG3wBtBFgABwRUAcQBgQDWBqYAbAQ1AfUCFQGaAkYA3QPMABkGCgDjAscAtwQrAPQFcgAVA0sA3gV4AM0BsACtARAAegKqAFwGFQH8A98ArgUvAXUF9ADfARMAHgQlAO4GOwCaBrUAywXQAPwEPQDwBjgAPARnAfIGYAFWBtMAEAdtALUEHgFiB00AZgcuAYIHFwDMB8IAkwJsAAwD6gA3BBMATAbmADEGzAAgB0cAqwMxAaEBTQD2A00ADQR7Ab8EYQA+BqMA5QQ+AWAEagAMA6AAeAVgAXICMwEmBpcAFgTmAA4FQwDyBBEAYwMxAZkBTQCkBpMAIgY7ANUBagA/BXABnASfAEkGIgFfBioAhwWuAAAEdgDGBr8AFQXuALkHzwDDB1MApAItAPkBTQD7BhoATAczACEClQD/AxoAYwLAAJcErgDKAlgBDgR+ALACJgB8Ai0BHQX0ALwEcQB2BWEAAwdtALsFTgFJBAQBxQdDAIwFSQD2Bi0AFwJDAGIFKgHoBikA8gRUAL8BjAC+AnMAYQUoAbEHrgA1BzkA7gXjAOUEEgCfBcMAKgQ5AFEDMQCcBXsA2wY9ACMFYQGnBCYAggZJAJgFQAGNAm0AOQZ6AI0H5wBqBk8A3QQ4AB4H0wAGBkUAlQYiAUQGewCCAksALgUiABIFNAEEBFgAnQTsAKQDbQDbBTsAhQdlAQIDYQHdBFYAhASuALcEJQCZBSIB1AOXAOEG5wBhBwABfwPHANgF4ACxBb8AeAUuAD4DzwDaBlkBLAfRAPkGaABFA0QAUwbCAMQDMwCcAUgAMgebAOMGtQAaA0kAxwXCAPUCmwAeBZUAQQUkARYEVAGMA2YBywdoAP8DDAGTAsMAjwYQAJkDWAALAmsAdgXhAKEDDgFdBnoAawJUAUMDWACBAiUAcQbUAB4FIgFGAkgAuQe5AK8BmABwBjsAqgUSAf0DOAAhBSUApwVDACMFRACqBWoA5wRZAW8G0QCOBVsB9QI1AC8GbQBcAmoAywV1AOcF2ADcAloBJwdDAIoHVgD6BngAcgJLAB8FTQBHBEUAYgV7AMgDaAAvBVgBHgciAFkCFQHzAXIBPASJAH0FWACrBFsBKwNYAAkEIgFNBTMBPQU+AGAHmADJBlgAKgTiAEcGiABFBzAAJASLAAoHjAAKBjgATgVFAPYGFQFHBFgAYgSVAD4F3wA/BjAAGgZPADoCYAGwAncAXQSMAFsCbQC3BcwARQPsAIQDqgBkBTEAFwJXABAEHQCVBTkAigJjAF8FAAFcB54Aiwe3AMYFbgHwBEAArAFYAGwC3wBZBswArAVGAHECVAGNBEcAxgLYALgCRwDwARwAhwLCACAGdwGiBa0AqAXYAI8DQwDQBMYAXwWoANIBFQHbBEQAXAXnACsGTABlA0wBTwP0ABADWAFtBTcAgAfqAKYHrAAvB4sAAwdEACcFQwHgBEcAVwM7ADgFAAEGBDgAoga7ACwFVAF1BJMAGgJGAYQDFQGmASIA2QGXAD8FTQBOBM0AMwdZAV0GtQBsA0MA7gV1AacF8gCSBCAB3gJFAPkBRAC5BW0AkQckAeUEmAAiBkUA3gYiAckGUwACAxwAOgVpACcEuQAwAk0AwgbCADcDNgB9BkMA8gU/AEAFbQAWBEkARAVNAOMGMgHDBksA2wXQAKYHJQDrA8cAWgWmAAoG6gC8BU0AoAEiAJcB3QBgBvQAHQJNAOIEFgAcB1gAoAQ5AKsCVQE9BMYAbAfcAMMCTQC7AzgAmQaaAFUCLwF7BfIA5wabAHcGmwB2BcoAfQVjAGoGCgDpAsQASQZFAKsGMgAWBS0ANQVjAWsDIAFwBj0A0gXJALkGAAGdBUYAUwJKANQFOwCjBE0AVAOGAFADOwACA8QAmQQ+AF8DwgCWA+4AagRrAVoCfQA6BJMA1gVtAKcGRABGBWoA8AQTAXoHVAGCA00ALgNAATsDbQAkBkgApwaeANUGfAB7BTUB6wOfAOUESAAGBbkA9wHYALYBnABNBcwAVwYdATQGpgD3BEgAqgVJAMAFtwDJBUgANgOMAPcE9ADVAtwA3gKXAHYFVgBuBfQA9wOlAJcBMQHJAcQAYQb5AAwCagCoB0sAlQVjAa4BRACmBDUBbgVKAOEFWQFdB3wAiAZCAFQCagAGB8gARgIOAdsCJwAuBMcADQVuACMGwgDBBEgApQaZAOcEHQFGB5MALwXUAA0F2ABYAicADwZYAEACbQBnB6MA/gRNAGUDRgC5A3oA2wbfAMkFLgDZASAB7QWxAMkDbwDLBecAtwbCAAQEWwESBM8AZQYWAHADSwASBsoAYQYiAWQDCAFlBJgAEQYWAJMEkwCIBtgAigQ2ABIFxAC3BEIA8QJNAMoB0wB4BXAAowVhARMHSAAjBWoARgJfAJQD5wB7BpEA7QaDAHIC4QClAkYA1wJKAIgCWAC7BLgASQfKAA0FzABmBdAASQXhAFwCagB5BYABZQOYAMkFRwBWAg8A4QZxALkBzAAnBdMASAcaAO8GKwCIA3UArQUtAC8GewHZBDUBzARcADoEIgDRBJMAjwbTAI4FdgB4AxUB6QOhAFkG4QDqBTwALAfHACUFlwDJBkQAYgVEAB8F3gBJBo8A2AWIAPcEOwDUBU0AggUaAdwBWADUA04BewLGAEUDrQBDBtgANwLUANMFIAGdAyABJAWXAAYC5gBABTkAuAciATIDPQCZBTAANQU1AJwFcAHFBOYA6ANUAX4CQwCQBUQAmAURAGUEBQDEBHoAngP0AG4CcAHJBJMAXQVoAG0ECAA3A/QAygQsACsEVQCQAhUBlwF7ACgGAgBnBOEA5QREAEIFHwG3BIABUQQEAUEHSACKBdMA7AQ1ASoGQwCuBc0AigREAHMFcQDWBTIBuAcXADwHpgA5BlgAngRuAGQFRAByBcMAegSfADEH+QDmAzYA5AVlAcIGewCxBUkAeAY8AC4EfAD4BCsAygVNANMBCAAnAh4BLgeOAP4FKwH9AcAATwMVAccElQDtBVkBoQSjAMID0AC3BHABvwVGALYCagAWBHABigFlAC0EiwBAByYBIAa+AOIGNQHWASIBZwfFALcEcQDnBpcALQRYANoD3QARBScAagXcAFsDSQBYAogBAQa3APcEgABPAxUBxgErAdsGBgGwAtAANAUVAe4D9ADoAW8ABgciAcID8AAmBkIAVQLyAN0EwADNB0QAQQW7AKIFwwCbBSsBnwRYAb0EgwCwAjsA8gWfAD8F9ACwBCIAfAbIAOwEQAApB+8AxQT8ALEGgwD/AuoAHgfiAE0HWAB4BCUAbwYiACIH7gDaBJMAvQFtAEcHWAAUAzIAuAXgAFkHXgH5BNgAqAI5AGMCqgBYAkQARwduAPwGMwHGAjEBtQOkAEYCegDIBEQA8gS5ACgCbQArBSMBcAayACwFcgAEBvIAxwRtAEEDnwDOAXsAWAM+ATkFMgACBTkATwYuAcsHpQD1AQABuQdvANYFeAHUBGgAZgcgAVwC0wAqBlQBYgPRAEIGSABFBRMA6QVMAYUCTAF/BHABLgR2AC4H4AADBVgAqgSTAFYCRABQBsUAigRhAZMHZwGjB88A/QW7AFMFJQHrAqQA7QLrALQHTQC4BF8ADwdYANsBWAAzA5cAAQZYACgDFQEvBH8BXgVJAFgF1ADlBAABCgTRAGwGaQA9ArsAHgUxAH8F7ADgBoUBfQdVAMgCsQBYBiIAdwQrAWAGOgBVAkcAlAIzAUAFewALAssAGQVxAFcHIwDQBG0AqAfMAE8HSQDlBSMBKgZYASQHpgCWBS4BWgdvAZABQgE9Av4A7gbjACQFKADxA9MA3wUVAdsDMwDWAiYBZgPcAJADVgDkBEoAgAbKAHsFjgB1BYYBYQIvAKwBOwDiBfQAaQMQALACSwDdBUABzwRNAGgEQgG8BaQAFwYoATgGJQDSAqwA1AaeAC4GMwF7BcQAUAVhAbwGWABdA4sA4gOMAFkGnwCKBXIBKQIlAHIFwgAWB1gALAM5AXoDUwCABWYApARbAdEEgQB0Bk0A2gQPAcUHMQGMAksAlwaCAbsGtwDlBEgAXAbuAAMH1wAIA0sAVgVIAZsGWQGyBH0A7QamAFoF2AAjAjgApgTAAJ4FbQC6B1MAJgfrAGAEbgCoB0QAKwVmAagFIgHFBWEAfwMgAPIEbwBzBIgAPgVMAX8DmAB0BVQBAgIgAN4EAAGiA6sA9gKTALUERwC9AVUBOwSDAV8GHAAzBUsAIwZLAJ8HVgCyA2QAFQd7AFQDiABJBkwAiARIAG8GSwBQBjUBxwb0ALEEfADNAwgABARJAB8CzACjBm8BXwQjABgFcQABA1cAhgZHAHQC5wCSBW8BmwInABwGWAAQBOEA4AExAZMBGwCwAsMAbATGAAAEWQFuB2YAYgaIALcEVQChAs8AqwV7ARUESQCFBW0A8wZpAMgDmgDqBDwAkQdIAA0GEACwASABcwRhAVwHJQArBUkAOAZhAZQDSADPBc4A/AWGAFMHiwC2A8YASQUlADEEAwFrBMoAiAarAI4C0wAvBVgBigZ3AB8GLAA+A1gBmgTrAIcH5QCpBWEBfwNEALsBaQCWAz4AKAVYANMCYQGPBJoAUgXdAOoEpwAAB70AVARhAA8H2AAtBBUB4gRYADkETQCIBXcA6AZwAd4EQwAYBd0ANAZqAOoEIwF7BUUACAYeAW4HWAAcAwAAhwSGAI8G8gDuBTEBuQEzAecC0AAABCoBEwNJAOEFhABRBm0BTwQ5AKoEOAA4BS8A5QJEAA0GAAHUBMwAKgVFAOQETgFvBEkAaQZVAXYEcQCoBysAPwR7AP8D1wDfBnEAIgYVAd0CZQFfBFgAvALcAEgEkwCWBdMAPgVOAc4FIAEUBj0AuAZyAdwESwAhBasAqQEgAXkCMwH7BhUBlgTcAFEEJQG0B9MAegVEAFsF/gAXAkEAqAXsAOQBSgAGBewAuQRYADQE0QAtBVQBmgRZARsCgwC0BwsBMAP0ALkDbQC6Bd8ACgZIAEIFaQCDAyMBQQZvAHAGdQBRBYQAPQbYAG4EAgGgB84ARQPUAGsHgwFxBtAA2wIlAKUB5QBbBu4A5AF7AUgDkwDqBDEAbQZDATQGewHPA0oAkAalAB8CVwDbAUEAHwVbANUERQAhBaYA/AQ3ADsHRgA/A3AARwVYABME1gAhAw8BSgeuAEkGiAAtBc8A3AbTACcFRgCwAYABQwdPAN8CVgDPB5gAlAdLAOIFTwFCBHYAYQVhAeYGzAAtBaMA8AQxAWECSADOAUQA3gTgANACQwDiBeMAtwVcAIcERwCeAncA1AFuADkGFQH0AUUAqAUvACQEyQDNB54AqgdNALcGMwEMA0QAWQUDASoGCgAbAgoASQNEAPEG1gDtAmMB2wGUAPwGAAHEBHYBSwKXAPcE7QC0AWYBNAZNADoGbwBfA00ALQaAAdoEGQCUBfQAswFYAXUEOABZBXoBgQNsAK4F0wCjBlgATQPcAJcEegBYAzUAkwV1AEoFrgA6B0oApwZFACMFbwGBBGMBsQH2AH4DVAFnAzsA8AYEAWwFsgDkAewAvAZIAIsGIgFoBk0AXgfjALIFPQCSA4QATQV7AE4GpwAGApMAowY7ABAGPQBVBjUBaQMuABgHgAFsBVcAFQNyAMgCWABqA6UAZgI3AJIGLwDQBUUA7AV1AVoCnwCPB30AjwYgASIG0AAtBd0AVARfACYGrQBSBWYAIAc8AIEEDQCfBTUAZgZYANgD7gC5A2kA3AE4ADcFOwC0BQ0AzAVjAF0EzgDOBXsAlgNXAFcD8gAlBVwAeARUASIEIgCXA9MASwcVAWcEbQA3BnkAZgdFAPIFiQC6BVYAlQE+AOcEIgDiBC4AUwJJAN4ENQG5ASIAKQZOAUgCKwG9BewAJgZYAJMDVQG/Bb0ANgTrAEsCVQCCAlcAagIxAOEEvQBkBRMBfAXqAFcFoAA6B0QA9QUQAAEDSAD1BU0AZweHAbsFIAH8BuQA5wYgAT8ETQA5BpgAxgINACEFzgC5BjoAlwVFAJcGOwAhBXIAJQJYAK4EJQBmBHEAFgSyAJ0GXwH2BG8AyQWTAO0FQAC8BSsAJgYgAfADoAA+BSABOQYAARYHjQBNBjEBywFlAVwDygBGAo0AIweqAMIDPQBYBuAAAgS7AHIHbwCLBXAAhAXgAJYHfQCLAyIBHgPuAH4EIwHUAtYAVwLiAAcFpgCPBkUAhAV6AM0BewBUBJMATwM/AAEDeAFrByUAswIjAWcHWAB3AwkBXgUlALQBrQDPBqQA5wQ5AF8HmADWBSkAHAVYAWIDbgCrA4YAXwVtAHMEmAD8BjkB0AMAAOoGSwCrBmUAdwWYAD0GbgCnAkcB+gErAW4HyQABB5EAFANLAOUF8gCBBC8AuAVNAIIDEABXBiUATgIJAUMHQwBcBXoAtwTTAGYFcQAUBosAYAbQABEFRQBvBlQBVgMyAEoFaQALBIkA/AU5AcUEPAA3BDIAFAdpANAC5gAWBjsAmQU4AFECXACyA3UAEwa1AFAFVAGnBE4BxgVvAbwFsgCKAi8AFgVKAN0FrAB2A7kAwAOVAOUE4gChBu4AHgdpAFQDOwA2A1QB4gMVAWcCsgAWBG8BWARPAL8F1AAnBTEApAVGABoCOwCLBkUAgQfqAAwEcAA3BaQAMQdYAMIElAA3BlgBGgPqAK0EBACCBDUArwbaAI0BMwC7AQQBGAQ4AIQFAAAiByIBGQNvAOQBVQFTBEQAqgbWABYCRQDeBQEBFwKAAdUEJwE4Bs8A+QYPASMEIgFPBq0AnwFXAMgCMAGQAgIAHgQ5ALQBEQGiA1QB4AThACgGRwGAA3sBOwPrAJACFQGXA4wA9QZtAFMCTQCGAlQBrQRvANkBRwA/AsYAoQUjAdYFkwCWA20AmgVlAecGQADdBjoAfgZ6AWADKwFZB4YA0gNTAZwGMQD1AuUA6AIzAWoGiwBUBMQAqgNtAOEEDwG6BngAsgOMAMkFiACPBhUB2QNDAMcGoAD/AwUA4AVEAKwBiAAABM0AWQYjAGMGaADqBVwARgOuAPgEwgDOBKAAywRGAFwCcAArBUoAMgabAFMFEwF8AusAlQJUAV8CWACjA1QBTANuAJ0DbwA9BkUA1wV6AHcF/gBbBs0A6AJYAcQBSwCpBVoAtAfWACQDVQB/Ay8BdgXnACYHOwF6Ay8BuQHEAHkFzwB8BlgACgTNAKwGHgH4BaAAxARIAEIG2AA4A3YA6wJYAN8DTQC/BUQAjAVUATUEMQHdAXYBvwUyANAFzAAvBdMAYgZEAbwESQCMBTsABgVoAP0EiAFlBXEANwbfAOoEWAG6AUkBVgZLAPsFdQFsAjIADAWgAGMGzgAzB+sApwQ9AKYF4QB4BOMAKgcKABQExgBBBm8AFAaVAFkCOADdBRIBigFIADsHAAGSBCMBXwVLADEFOQANBx4AkQW/AA8HzwDOBUkAvQFhAc8EWAHrBTAA/wSaAIkFPAHMBEoAWwXyAPED3wC6BVMAtAR1ABMFbQBWAoUBageOACgFRgC9AUMAxQNhAfsG4QBHBuMAvQFoAPwECQG/AtgADgNhASQEuwB1BXsAeAdlAY0BjQByA1QBdgTHABsGdABKBWgAAATjAGQGxgB7BRUBFwTuAAQERQCMBTABhwebAMoChADaBnEAwgNIAO4FFQG4BBUB5AM1AecBIgH6Ak0AwANvAf0D8gC8BWIBKAa7APcGWAAXA3oAZgfUAEIG4wBYB9AApQLCALkDsQBuBGEB9QJYAIgEgAB/A20AWAJvAPwGXADqBUIATwKDAG8EWAEbAlsBlANoAHQDYABqAjMAEwLWAO4BMAApBj8AQQU7AJIGbwAlBVgBsgRyAP4B4QDnBFwAVAQgASgE3ABZAgAAeQPnADACoAAtBPQABgRpAIcE6gDUAkgArwW9ACcEVwCoAxUBWwSUAAEDRQC7Ac8AQgZxAHMEZgCdBHQAUQUTAEcGYQGVBJMARwWVAFYF9ACyAWMAqgP0AGgDTAEABAoAnAPWAEYCRgGpBE0AZgPhAHQG0wCrBc0AfwbGAKwFngDjBVQBVwRNAK4BIgDfBVsBxwVLAO4FLwETAz4ADAOnACcCOwBABiABUwL0ALAC9ADeASUAHQRwAeQETwC6BE0AIQSGAK4DegCPB70ArAZTAbsGRQBCBVgATAQwATkFQQB/AscA5wRUAdIE6wBuBGEBSgesALACiwC3B0UA3gQ1AUgETQCVBYgA6gQ/AA4CVAFSAvQAqgJLAE4CTQAWBAQBEAI6AFoGhQGkBkUA5gbYADADVAGzBFgAEQRvAHYFOAGgB0YA/wHyAMEEcgBhBXgAmAZHAJgD3AApAs0AiAOmAHYFAAGnBD8AXAVUAawCsgBGBk4B2QZ+ALwESACABisA1QEvAPEEcAGNA28BlAQ/ABcCIgCHBDIAeAZ8AGUFTQC6BscAdAWeANAEFQG6AmEBGATGAEAFRwDQBEABngRDAbACiADkBEIBlgPDAC8HRQDFA0cAWwKmAM4FbQCFBdMAdAcpALoEOwAvAncA5wZJATADbgCLBSIBDQNHAPoDRACwBisBqQFlAQ0HYQE1BDUB2ALfACAEIAF2BW8B3QREAMUDeQBOBs8ANAVfAJUCOwBBBXYBawciAYoEdgFRA2UBkwTYAB0DewGFBFwAYAZ1AXQENQAaBrsAIAdVAMUBpADqBEgA8QYaADoFwABZBlgBggOqADwHqwDkAosA7gLsAHICzgC+AjAAKQXcAG8DxQBNBV8AvwOsAHAFMQHiAmkAzQHYADECZwB3BUAApgYWABIF4wB9BdYA0gGOAD8FQQBCBZoAJAVGAHoCAAE3AyUAAgMKAFkEWQE7BE0AzAQyAfAFSwD/BU0AeQRVAM0BMwEeBX8AiAUVAU4D6gDgBEYAXwPOAEYCTgFKAnsBRAQbAZwGtgDqBGMBDAM9AM8GLwGjBEMANgaIAMsERAAhBS8B+gRxAIsFRwBABOAA7gY5AMwDnAAHBa4AmgWBADUGzwCuBkgA8QVYAH4EGAA6BYsAhwRYAFECcAD2AZ8AwwGmAD8FkwAUBqgApAIxAW8C3QC9BVQBagRUAZYBRAGRBk0ApwcrAb4DMgBfAjUBFwUeAF0FHQA5BW4A2QE7AIgCxgBGAggA9QIsAO8D1ABGAvUAvwXWAPgCpgD6BbsADAM/AAYFSgApBfgAFwejAJ8BLwBmBkQA/wXOAC8F8gAsB3oAwgVvACIGcAHUAiUB4QQdAXcFbQA2BW0ACgecALUGCgBKA0wBwQNWAMUBOgHDBkwBqAQSAV8ETwCwAkQAcgaLAAUEewAPB/AAWgPYAEMCOQGCBKAAawJhAdQErABjBuwAwgcAAGYHbwC9BtgAnwFMAT0EYwEcAnsAJwQvAd8FXwDEB3UBvAECAEoDewE/BCIBzQVkANgGbwG9A1kBjgMeAY0FRgAXAsUAjwaGAKgCWAFjA3AAJwU1AKwBwADDAW8BLgR6AKEDwgACBBIBLgRIAC0GygBQBdYAGwQgAWUFWABCAlMBWgcOABgGuwAtBUsAWAZtAPUB4wDnBKAAkgQPAJMHwgCQA04BWgafAKMEOACRBU0A6AIxAKwBOwHDBpcATgYvAAsF8wBzB2YBNQRNAOEGVAGEBAAAjwZ9ADUHNQAIBS8AOwUXAOkFPQDaBfQAugFhAWsHowAqBXcAwwFLAOsFxAAtBNgAlQPuABcCOAAxBEsAJwVEAPEFWQGxA3sAWQfSAFQFSAC0BZcA9gJOAYMEEAB7BmoARgZ3AHMDiQAABGUBxwRVAM8CSAHMBjMBcwR8AAUHBAF0A88ABgZ0Ab8E3ACJBEMAWAUWAAQEgAHZBNEADQWiAOwEWwGwAlgBtAF7ACIHpwDmBkUAQwcyAKwBQgDmARAA5gY5AQsDFQHfAqQAHgV2AekCVQBYAzkAiQNHAY4EpgDVBcIAhQJMAbkBWADXBA4AaAVOARwGDgC6BJEAMgPRALUFXwBLAsoA/QThAAAEQwBFBVoBuwUlAOYFCgDyASEBBwUiAAMHwgC5BzEBNQPaACIHAAFKB20AagKXADwFMQEtAjUAfwU/AJ4CuQAyAlQBuwOLAMECRQAwBkYAeQLQAOwEMQERAtQA/QS7ADQFIgC8BQoANgKeAKMFYACVApcAngObAFMHgAB4A8wAoQVHAKYEBAG7AwsB9gRUAZUEMwFrBDUAvwdYAZ0FRACXBlgBgARIAEAGqgAHAjEAkwVEAFMFRABxBSMAgQRDAC8C9QA+BjIBPwIgAT4HWAAmBFcAUQLQAJ4DzgBmBXUAIgWlANUBmwCWAwIAvgR9ALACVwC2B3wAcgKjALcFMQH7ARUBnAJFAMcFIAEaAgABoQTHAMQFWwAIA2EBwQFUAW4DcgBBApgAYQYiAXID7gCFAloBnQFtAAYH9ABPBCIB9wQAAcYEPgDkAXAAVQUAAFkHIAHZARUBrwQ3AKoFMwESB5cAVQI2AOUG7wC8BuMAnwF7ATwCBQHkBBUBmQIiAakDTwBqB1gB5wYGADwGIADwBZgAMQdUAWME6wDLB2kAdAM9AAYFfABqBGoA/ASfAMgDMgFIBU0AiwSJAM0HmAAvB1gAtAQWAFkEbwBhBlgAtQHMABEFIwCmBH4A5Qa5AFICzAD9BDsAkAV3AA8HJQDlBtEANQIlAa0G0wD4BOkAFwKoAA4HSQAdB2cBwwFhAScCRQBzBewAfwOMADUHyQBABfYA4gMrAOsCYwGgAYYBBQdHACgEZQHJBMIAogPYAMkD1gAGA0cAfQRZAegGRgDoA3AAsQemAOUEmgArBTsAFQZ7Ab8COACpBZcA6gR0AMQGSwArBdAAKAV/AEkHMwD5AVgAXgRYAMgBLwH+BEwA1ALsAIcHFQFcBOYADwVDAbAEQAHCBN8AQwZfAGEHcACMBYMBHwa8AHkDhgE2B98AXAcrAcgDYwCKBDEBkwKbAP4EsAB/A8wAcgI1AfgBxgBUBU0AQwW1AF8HRwDwA74AnwTMAAYGrQDQBMUAWQaBAbACewGmAp8APQUxAAkFMwEYBzgAkgXHAD8GWAFpA+wAsQVEAOUFIwCYAUIA0AFHAH8CzAD/A7IAKAVFAP8F0QDEBSUBaATQAEsHVwB3BdgAhQM1AFYHKwGhA0MALgVMAW0ETQAPBgYA+QR6AJUHCQBlA/QAzgR9AP0BmQBMB1QBsQKTACQFpQCfAVgAAwPgAEAHTQCPBVgAOASqAKMFZwABB5gA/QRUAfgBvQBtBDwAPgbYALcBsACNA1gBuQPOADQF0QAABG0B1ANyAWEESQDdBeMAKAU0AecBgwHPBD0AOweDAF8G1QBwA1kBYwPPAGYFTQAwAjAAmgd0AVYGegE0A2MAQAXYAG8ENQHDARUBGgThANQFIgHkAUQAhQVsAPwGSAA4BeMAAARIADAFMAASBTcAEAZLAAgGWADNBEYB6wKqAMoHTAGZA3YABwPfAJ8D9QCYBzgA8AbhAOADqgDeBncAzwKgAAoGVAEPA0cBDwLPACgGKACBBNEAQQatALUDlgCJAZUARgZ7AYUCMwHoA1kBXwciAMMEWAEbBFsB3ASuACkE1AAqBVgAXAPMAKAFSwAfAr0ABwVxAJcEDgFxB6sAaAJYAVEDsgBoBr0A8AIxAAcCSAC4Bu8AyAJeAdYGBAHIBHgB0AR/AOUGNAGRAzkAaQNWAMYHjACwBrcARgKVAE0FOwAuBTUAGgUPAZ0ELQHvBEkACAY+AP4EdwGIBRoApwfTAAAESQBCBfgAmAfGAP0EzgCgBVgAtgQ9AKEHWADUBE0A5gZlAX4DTAHEA/YAxQRBAHIFMgBUBtQA/gQVAZoBFwDrBjEBHwMCABYDVAHWBFwABQRGAA4CNwA4BVMBKAIsAHEHSQDeBU8AmwFeAQoDJQHlBpQAgQVYAEMEIgEGA3sB3ATMAPgEMAHsBUgALQc4AFAGVAESBFoBBAJZAXkEnwCaA8sAEQVGAM4DSAC/BnoACwYyAPMEtwAVA0gA8wW7AGMGqgBpBTMB1gVtAHAGPgA/BVsBvwU9ACMHRACEBTcAxgWrAB4C6QCHB30AcgImAC0CVgHFBLsA+ARJAIgH7gDiBDIB/gZTAc8CYQHkBEkArAY1AOwGJQBpB40AfQOTAN4CCgEYBqAAIwY/APEC1gDFApMAzgXUAKEFDwHKA5kAwwKnAMYGWAENB8IAJQJ+AZABTgFgAh0BIAZIAHwF+AAnB0gAhQcVAY4ByAALBhMAmwdFAEcHFQHaAU0AFQQTAYUChwGBB8oAwgMKAGcCWAC6AwoA4gFoAFQDygC3BJ8AkgMjAMUEPgHyBG4APQaLAI8GRwAkBE4BGgKUAM4FTQDBBQEBOAYdAKYEzADaBjsA2wVIAJoGVAFDAlgACATYAIQCIAHWBVgBfgNFAAcCmgDlBEUApQbfALQFfAGSBEwBigMmALIGIAEvBeoAEALKAGQHQgFPBiUA5ATqACoGQADsBZ4AlwR7AIcESADrBVQBxwPHAIkFcgB/A+AAeQOBAZsBwgAFBGMBSAL0APgDTwETAjEBogNEAGQFMgABBYEBcgKTAPgEIgHoBSIADwY5AF8GTQCYBNgAxQNVAP4BMgAHAuYAuQE7AL4GnwA4ByMBQAWFATACugAMBjEA8QRDAOQErACeBQwBdgZoAPgECAHHBmEBVgY7AKgBeAEEBJUAXAXWAH0CIAFHBZUAFwZlAagE1gCaAw4BFQS8AMMGvQB8BEEAMAVCAa0GWwHrAsoA9wRDACcDVQBrAo4A6gTTAAMGKwFsBN8ArAZYAOEDOQDNBVYBRwIAAeYGwgAxAk0AJgYlALIGnwC3B3sBfgNYAK0CVQFxB2oALAVDADAFEgAgA6sAIALYAMoCRQDyBE8BLAPYAAECegAKB5UARwUXAEwGAgAIAkgASwWnALAC1QClAXAAWAIUACADYQA2By8AhQIKAMQCRwG8BF8BVwVZAZIEewBrAk8AfwKYANUFdACtBTAApAekALAF2ABSA0kAfAVJAEsFrADOAaYAswQAAcIGWAGVAmABkwdpAPwB6gAmBvQA5wLsAJwGbQAUBhMBfgRCAcUE9ADhBE0A7gNtAIgGVwCDBp8AqQObAGMG2AC2A7sA7QVKANsFIwG3BGMAQwZKAFEHIAFABMIAHgdfAH8DSABQB1gA+wImALwHDgBnBTIACwUiAbcFSQCnBi8ABwZFAK4FQwDsBSMAZQTQAK4FRACKBd8AxAXqAIcHVAGCBHYB5gNBAFsFZQESBFQBuQRYACAE7AC5Bw8AEQZDAJ0GWABTA34AkwdZAYIDYwCuA4QAKQSwACcGSABRB20ApAKcAL4ClwCaBSwAzgfEADwF0wA0BUAB0wQrAHsFOQAmBisAVQICAV8DIwGQB34AcwLUAKsF1ABiBmoA7AQ+AFUCNwCBB0QAbQLNAMkFCQFnBS8A+QFrAHMETwG3A8wAqQbsAJsBTQA9AmYADAZUAPwCzADQBk0ATgM/AM0GrADzBr8AEQemAFIFiAANBacAOgadAOcEVAGqAXsBgQOOAHMEdwC1BEkAWwVBANAELwA9B0sAVQXdAL8HTgHmAeMAwgPjAIsFRAFtBaQAtQVAANsFPQBOAhUBIgP2AAsDOABBBQsBtwNMAeECRwDvAQAB4ATVAHMCIQE9BYwArgVNAH8C7ADCBrcA6gQxAAgFKwAgBUYAOQNtAD0GoAD4BGUBmgS9AGAGIgF/B3sB0wE1AEgFmwDkAZQAEgctAAkFUwCgB88AAwZYAFkDQwHKA80ASQZJADgFSwC5BTAArwZHACMEmwD9AUEA3gQ5AKwEQwC7ASEBnQWHAfsGRgBbAsYA/wNwAOsFTAHrAuEAbwWTAGQF6wCCB2UB9gN7AJEGgwF4A0gAFwdtABsFmQD+BEMAIQVHAGEDTAEZAoQA/QREAMMFawCKAyMA5AFvAAoGSwBCBW0ALQOIAFAFkQBtBCUA4AJNAAYERQDFAnYAVQf6AMMCRwBVA1wAcAMiAJEDMwH+BGMA4AEAAd0EOQCDB/QAUAIXAK8HMQCvBk4BAwKFAI8GjABFA1gAZQQlAGYHIgEjBs0AmgaXADMHQwC5BSIBCQLJAPgE9QATAsUAngNWAYwC7gB2AsUAYAVNAIsCVgANB5kA5AGmAFkGVwH1BG0AvQUhAe0EyQBUBdYAlgFDAHMFzgAqBU0AzgTPAGgHOAAGBVsBawdNAO0GSgBLBf4AYgUjAZYF9ADEAZMAqwUwAEgFdAF7BOoAxgTCAJcEEgG9A6kAjARLAI4CWAEFA6UApAJwAIcGlQAGBTMBvQFAARoEdAFyAjsAZgSLADkHNQFTBFQAFAKxAPMFvQBPA0sAxQNoAAIEwgBPA50AUwVyAIEEWAC+AwgAuQLNANMFiAAkBeYAhgVAAKkFPgAkBdEA5wTmAIUFIwHLBdgANgNYAbED3QDbBoUBFAUiAecEIwHfBd8A0ARTAfkFhQFbBr0A3gIVAZAEZADnBFgAmQRYABkEzAAqBzsAvwY3ALsFRABpBVwAawS5ACsDsQCWAWkAqwE5AH4DpgBkBY0ATAXjAEYCTAHvAiIBNwJCANkB1QDgAdQAhAasALQFXAANA7kA1AJZAUkHcABmApsAxQVNAN4EOwAtAz0AIQIiAVkG7gAlAmEBqAJAAVYEJgGXBEAApAc9AIgCOQBXBQABzgREAFUF0wBUBa0Aogb6AL0BAAFvA0cAHwQTABQEvQAiB1gB0QRmAA8HHgErBzUAuAU5AMsBcgHPA9IA5QTGADgHdAATBjMBSgczABMDuwDiBrkADQKkAMEHWACfAlgAUgRFAVcFMQGSA0MAhAWeAHAHrgC6BUoAUwXYAHgCWQElAwQBZQNIAFgGjQCABowA/gTsAEsCTADWBHUAkQYvAIwDdAH1AjUByweDAckHFQAmBtEARQNLACMFTQCJBGkA8AI9AC0H7gBWBuQAcgLfAD4GmQBpBYQAxwclANUBWAFJB0QAKAfgAAUEewHABCEBbAXVAO4C3QBgAlQBdwLCANIBZQGnBRAAmAGLAHgHGAFwAkMAJwXTAKwFTAE3BBUBhgIzAXwHqgDkBtEA0AaIAfQGXAFhBDsA8wYeASwGqwDnAcwAaAeEAC8FrADeAjkAbwaDAdMEnAASB08BjgUvAAwFngAeBUYAPgNLAGIFAAF/BHsBlARNAAcFFQFCBPQA9QIvASkFYQHMBDMALAKaAPcEHgF8BlQBkQLOAIQGhABXBtQA/AVIAJIDQQAYBY4AiwUiAZcEwgBWBqwAFQZIANoFaQD/A+AAdANlAT0CbgB/A2EBywdWAKsCrACZB9EAawVYAEUCQQAuBdgAowFVAQMH0wD+BDUA0AVuAM4FVQDoAnUAcwdqAJ0GzwBIB6QAiQVUAfQD0ACxBdQAAARwALcFIgGZBHoATgZMAQUDhQClAo8ALAVhAXICRwA+A3EATQWOAFIFQwCkAjEA+QHdAJoFcABpBdAArgZNAKwDVAFHAjsArAFIAMcGWADMApkA5QR2AXIEgwEXBU0AVgY7ABQFOwDaA84A1QWtAL4HRACrBkYBvAQyAbkFSADSBeEAdgcvAP8EOABvBhQAsAIgAWIEpQDOAXYAMAJ6AX4DvwAvBUgABAPhABcG0ACwAt8AKQRSAYEGiwB3BQkArwEhATIFrADpBJUAiAa7ALQGrgAvBzsAIwIAAQsERgBVAmwAcAbYAAEE3QClAhUB1QRNAHICWQG8BVkBxAEvAbsH2AAPAnsBmQHmAOsEfgBUAyYBZQciAUsDWQBdBBkAxAI/AMgFeQCsBUcAYQQAASUCKwFeBKEAVwZHALgDmAAlBTkA5AQVAYsEWAGdArsAxQYxAb4EgAC5AVgA2ARlAcUEdwDkBMAAxQc+AAoGHgEBBmkAoQNTAbAFyQARBeQAsQQrAD4GXwCwAnkAeARTALwGqwCPAskAAAQgAU8DBAF/A0cB/AJAAEUHNQASBXgBlAO3AAcFpwBeBwwBVgb5AA8HKwDsBR0AUAYgAIAFQgH5AyIA0gbGACUFiwCTBiQB+AQyAcADiwBmBkYAxgJYAM8EwAD4AToAMwZHALMCzADOBesA4AbYALcEvAA7BnsBhwLNAE0FaQB5A70AOQbOAOIGRwD1AkMBggfDAHYHYQFoBAAB0gTYACkDHwCQAawAfQTPAIQGIgGuA7IAKQTyACYGpADPB5EATwYAAdEGlwAOBlgAdgJGAOYBeQC5AQsB5AQ8APkDOAByBtAA5AFAAKgE2ADCAfQAXQSrADMCEwA6BUwBcAJ1Aa0EgwFjAjIBLAKLAAcEPwFyAgoA9QMiAbgESwDLBpwANwa5AHgDXADIA3AAlwRCAZIETQBgBMoAnwEmATMHegB4BIIAgwYVAU4E1gCgAsYADAY/AVYEIgDGBi4BuQHuAKMExQBdBsYAzQd0AfICiwBuB4sANgNxAPwGwgB/A4gBPgRFAFkF4wBTBYYBqwfgAFQEEgH5A1gBOwRFAPsFnwABB8wABwU+ABgDSwBgBDIB2gRWALoGbQCpAWQBsAJ4AYUClwCGB3IAVQfsAJUCtAANA0QA3AVOAU0GSQDyBCMBqQYmAAACOwB7B8wAzQMlAEMH3wABAwABFwJtAPsG4wAbBUgAZgJHAD0DVQENAiABcwfCALQHVwDhA3kAsALGAKkGegCWB2UBUAc9AFEHXwBKBw4A9QO9ADMHOABFBVQBogK1AAwEHAC7BRsApARtAP4EEgHBBHsBgwL0AI8E2AB1AkYAFgRMAWwDRgGRBiMB0QZEABgFxQDWA60A2AZHAJcCIQHjBPQA0QRHALcCWAD9ApsAFgRYAEEEJgBnBGMAwgNqAdcEEgHxA1MBYgNWAPYElAByB1gArQOgAHMGWAGhBN8AMwcjAfAExgCpAnEA9QZZAawEpADXBtMADQUIAI0DZgD2BWUBXQbNABEFxgBvBEsAlQZtALkBcgAwAi4AAgZ7ALID+AC5Aj0Aqga3AMsF0AB2BQgAcgK7AJ8BRAAfAiUAwQQpAEYF1QCNAmkACwJVAUgEIgHlBBUBjgNOASkFWAB7A4ABHATQAOcE/gC0BHsB0QKMAB4FRwAXAjkAjwVFAFUFpgBwBlkBgQRTALIDVQAEAsIA+wbGALIFJgHGBZgA3gIHADAFVgEFA6wAcgdbAT4GRABOBXIA+ASLAFkHAgHdBOoAkAJEAPYBNwCSA78AbQdoALEFPwDmAVMAJwMzAWMGWAAiAoEBJwKOAAAGgAH8AmYBSwJ7AWUCKwBFBU8ABQcGAOkEBQBPBC8ATwVFAHwFVwAqBu4AvwVNACMG4QBgBUsApgRFAEUFwgD6AU0AsAVDAIoF3ABPA6AAVwW7AHgFIgGnA0QALwJ7AK0HiwCfBL0AUQZ+AJ4CTgH2BDMBCwdrAWMFVQGVAi0BvwXHADYFwgBRBD8AXwUrAFUHbgAvB4sAUQarAKgBvQA+BiIAowT0APID3AD5AhEBvwHHAP0GRQDDBXoAtwd+ALkBMgGmBm0AzwXKAOwEKwD2BCgAkAFpADoEvACqA4QANQdtAIsFtQAqBjkA5waDAJ4DEwGgBJ4ADAQuAP8BewHqATEBAAJuAEYCMQFkAjsACwX2AF8CIwHnBEQA5AZJAIMHAAG4AWQBCgOxAKQBNQAgBWkAVARJAIcGRQDuBVEAHAf0AM0CPQAZB7cATQVYAMYETQC6Ar4AKQRZAS0GSQDxBTIAygZvAfEDxQDbAscAKwVTAWsHPADQBEAB9QJEABIGaAAiB9gA/wJKAGQFjADUBoMBdQZ7AZwETQCMBF8AXwVYAawEOABVBsMAXgQvACAFMAB/BUgAqwZ7AVgEFQGLA4sAdALVANIB2AB1A7sAyQaEAAwGawHnAqoA+wYCAb0BSADVAWEAJgasAE0GJQDgBhUBwwS5AK0BVAHEBP4AFge9AMIHNQD/BAUAzAVIAEQFWAA+AjkA4gLYAEYCzQBtBEkAJwVpAMABjQAhAuoAuQE5AIEEzwARBaoAuwULAWsCSQAZBzMBcwejANUGbwCaBWkAsgMzAbwGwwDuAkQAjgIlALwFRAAWAmUBWgYiACEHzwD4BFgAvANXAEUHFQFeAtYAqAOOAOoGRQByBkIApANDADkFVAE6AlsBhQJpAHwEmwDWBQoAJgN9AVkEuQDNA2EBaQSxAPgEIwA+A1QBCgMVAZIBTQDxAuoAJgeGADgDpgAqBRAAzgYVAeUCqgD2AjUAswekAJ4FNAGjBIYAzQdpAAIElwDnBDkB+AGIABEGwgCdBRIBiQNKADgDRAAEA6sADAJmAMYHbQDHBxgAHAdbAcADbQFlBVsBcgKAAMMBegDNBDsAgAb0ABUCIAFjBvQA3gNlAdQB/gB/A9MAbQdgAQMHIgDOBNQAawVNAM0DIgGeA2EBuQNIANQFRABZAowAAQNxAHYCcAGsBE0AYAdLAEQFhQFPBu4A5AQiATACBgH1AgABjQOXAEkFlwDwBIgAsQW4AHYENwAVBgoAvgHCAG0E9ACpBJQAvQGGAd4ECQDUAt8AigQVATAEmwAGAkQASwU5APYEAQHZAS0AIAUxADUFDgBjBHsATwOyAB4FKwASBUkArwVfALwGtQA9BDIBJQSHASwExgD8BfQAcQMeAfcFJAHCAyoBGgeuAIQGewErBJMANAVcAcADPgEcBWoAAAY4ABwFSAAhAtUAAgNaAKQEFQHrAYgAOAdYAHIE1gASAqMASQXQAAMGZQE/BFMAxwdFAA0GxwDCA7kAJALsAF8GXgFfBxAAXwM5AF8EMgBHBYMBggUUAMMGvQDQAlgAnwSCAb8DrAA4A1QBoQQIACUDqgBVBgsBkwUBAMwEJQAnB9gAUAMZAWsC0gAlBRUByQTWAMkCMgGxA2QAawRIAC8CDwHtBksAqAVCAIsC/gDRBgIBeAVNAJ0FJQDNBW4AoAVEAK8FRgG9BDUBhQKMADwF3AC1BCIBvQVEAMUCYACJAkgBogdUAboBmQDyBAoA0wNZAVcELwFABQoBvAOYAFEGxQDFB80ArgXmALMFkQBoB0sARAZFADcFgwBuBGMAZwfGAC0FiAD9BKwAqgbfAP8BTQDEBFkBnQJ2AOUC1AA+B7IA2QVrAfUCFQH2A0oB4ARJAP8BRACVBXsBxgMNAegEMwDMATUA+QH6AKECxgAVB1UAQQLhABsFUgE8BCUBEgXMAOwEWAC0A3oAsgPyAPkDhAAHBb8A8QanANsBmQAkBbgAjAcPAeYDcQFEAlsB+waLAHgDjAC6BaAAngakAPwEqwCuAmEBsAIyAKYFjABSBWEBhQKeAAcF6wC8BnoAtAMPAeEB3QCTA6gA7QLMAMcHLwC7AX0AAweMAPwFRwAhBDEAIAU7AJIDRwCYAiIB/QZqAAAEbgAUBkgAtQd2AdoEXwCRBzUBHQQhAVAFewDCBQQBRAREAN0GWwFPBFkBHAIKAPsDTACvATkAawOTAGMGCADSAlcAOAQiABoDkQAMBFsADASMAFcGFQGnA90A5gHWAAgDEAC+AvQABARJAPgGYADbAgEAZQclANYBYwC3BDIATgcAAdoElAAqBS8A9QLPAKMGiwCXB9EAEAeaAPwEiQBQBXoAVANiASAGpgAiBsYAigQ5ABcFbQDkBqQA7ARYAIYEAAFwAi8A2QVmAI8CSQDOAwQB4gR/AbwDOAAHAtEASwfDAGIHfABWBvQA0QMIAbIG0wD3BmUB/gPgACEG7gDGBGUBVgdEADgFggACBFIA2QZIAGIFtwCbBVcABwSxAI0DbQBTBSABnwdKALgGhwHOA8oAJQWPAD4F5gCpB80AOQYVASoD9ACGA5cAUwUkAT4HRQCVBfAAxwODAKQEbAByB08B+AHKAI8GpgC0BUQA3QVYAD4ESwAdBw8AHwciAH8GbgCQBzEB4AJJAMEGTgFzBD0AOAXFAMUFTQAPBzEAGgUlAC0CAAHkBK4AJwVHAOoDZABqBlkBZwNIACkHfgDkAXIBvwTyAL0CRABCB5cAeAWIAKYGygAlBi8ARwWNAM4BbwAaAigAUQP0AIUCOQDiBFkB7gVkAVoHfABVA3wA9QLQAOsCRwB7ArEAPAPUAHkFMwHRBLsABQa1AKcFCwF+B1QBwALQAHkHyQB9BRUBkQIVAdUDxgAZBiMAuwJPACUH1gDmAiIBAARvAeUDKwBKB1wALAamAKwEbgAiBkwBDQQlAVYGaADnBHIAgwaLALEFwwD3BcQAjwbmAGsEFQE9Ak4B5gZHAAEDfABABegAzAQPAF4G4ABjB0cAegJWAMIFrgBQBYQAtwReAcADpAAbBTkAVgf2AIIE5gBLBv4AuQciASYCSAFKBBUBYwO3AFcGOwAhAv4A5AElAHUHkwA1AoUB5AR0ACIFTQCsAiIAAQaTAB4FzQAKBkMAhwUeAYMFVwDXA28BxQQmAT4GrQBZBTkALAcUAKIHmwAkBWgA7gKsAOoFSQBiBU0AUgJuANAEFQGDBAwAcAPWALQCIAFVA4MB1ARDADIHXAAMBlgA0wTqAMEDsQBmBTEBlAFjAHsFKgEcB5QASQbrALAETQAdBHgB9QKVAH0FSACSBkIA/wFhAeIE2AAvAwoAHgQHACcC4wD3BCABxgK5AGMCzgD4BDMALwIVAXQEzwAZBjIAOwVuAYUGRwBzBCEBwQVPAH8DVAHLBFUB5wZXAOwGSwCIB20AqAEiAIoGRAAtBioAcQVFAIgHIwCeBXQBggcjAaYHSQDFAnsB9wKDAbgHWADXAwgAuQFYAXAHewA1B2QBxAdmAEMGpADlBCkB6QQJALcGdQFeAzkAGwQxAU0CFgBUAu4A0QYXAGMDAAFyAisBOgSXAOMGSQCkBxUBMgSIABQFxAAcB8YAtwQEAUwCwwBZBqwArAFNAMYHWADnA0MAVQVEAKMFiwB4BHgBvgRlAWICMwE/BUMAxwVCAawETgFxAyABVgJYAUwDVQBJAmEB2gSDAFAFJQGpBFsBuQNKAJkFvQCfA7sAEQWfAEYDyQAvBX0Bygc/AL0BjgATA2kBggeTAH0FIgEYA2oA/gQiARYETQDCBOYAFQVDAHIGWwG/BJgANAWmAFMCGABwA88ADQVWAI0HyQCPBtwAWAJ9AM0DzwALB/cAbQVNAKUCSQA2BmcBtgVEAIcFsgAQB4MBSwQ+AR0GWADTAesAlgRDADAHPQDUBUoAmgZLANwFrABOBnsBzAOqAAgGvwCOBUwB5gPWAKkBTQALBPIAfARvAJ4CPwBrBEkAwwU5ADAHWAFXBJcAbgI7AMgFSwDHBYIAeAVPAGsFagC3Bc8A/QQ4APAFVAEkAjUBCAcKAKYDMgBrBzsAcgWGALcExgANBTAAlAZEAEUFFQH+A0IAsQNyAK0FlACuBTwAcgJhAQQEIwE2BR4BSgZFADEFGACPBmYB3gTsAMYE9ACsA0QANgPDAAsCtwA3AuMAPwWfAHkDKwEFBKwAiAIAAbsG2gAKBNwAwwGIAH0FTQBKBxIBkAE1AG0GMQAkBMYALwUzAVQHdwC5Aa0A8wXIAOUEqwAYAtEAegXTAP0EIgEEA00ASARHAaIHVAFxBIsAeQcjAIEHQAGNAeAAXQdxAM4FVAB/AkwB4wFrAcEFWwEYBDgAgAUxAUQCMwEhB7YA5wRqAHYGxABdBEQALgVwAIsGjwAABD8B2QQuAVMENwDbBWgAjwdbAXAESwBLBcMAbgclAbwERwDZAYsAKwf3APkFIgFUBEcAQgNFAC8ChQG8BVUBrweuACEHxwC2BlgAVQRYAIcDewFGBGwA1gV6AHgH7AAyAmUBpAMAASsH9AC/A9MANQJtAK4FCQDcAzgALQZoAKwFZwCMBu8AfAdoAH0FWADjA0QArQFLAE4FhQDFBVgBWgNPAEAHMwBOAkcApQPYANIDWABEA8AA+AQ7AAoEBgEfBLIAVQKTAFsEOADGBUgA5QV7AVoCgABuBXwA5QYrABQFQwBFBjsAQgc7AIoFSgANBisBIQbGAPkGbQBCBpgA2AV7AZsEiwACBFQBsAMPAVcHFQHaBB4BpQVHAJ0DSACsBj0AEgZwANgGVAFlA2EB0QRFAE4F7gAwArcAuQFNAC8EbQCLBxMAYwOpAOYEbQClAqQAkAOrAG0ClQC9B1UBggTDAE4GPwDBB3EAngJYALgBVgCwBU0AFQMzAdUGSAAhBVQBmwO6AJ4DCACFAuwA4QYAAZUEPQGeBrEAXQSyAAED1ADtBT8Argf0ABoDvgCKBqAAOQZbALcCSQAwBVsBuQLgACcEbgAgBzMB+gV5AJUHuwBJBUgA+AY/AFQG7AD8AzkA5QOEAD8DewAwAnMAEwbmAAoFSABVBlgAOgPMAK4G3QDwBCgB2QFYACwExAA4B1kBmgTUADQFRQASBtwAWgJIAP8BOQD5A8IAUgPWAC0DbQDcA2EBxgRJAUkHJQCvAkoArAclAZwBSQD5AUcA5AF1AGEFbwC3BTsA0gWTAH0EogD9BkQA+QEyABQFZgCjBTwAmAXHABUF0AChBcUAKQRFAKkFbQA8BzMBuQFMAQwEJQCMAu4AfwPYAIADxgDlBMIAlAR8AAMHegBJBtEA5QQzAKwBYQBfBEwB+AHDAM0E1QDlAWUBMgJ9ABwHEgGSBGcAsgNIADAH+ADAB6YAcwQrAboDIgGVAwkAYQeoANUBLgFIBNgAqQNYATgDmAD4BFsBaATRALQGVwB/AjkAHAJhASYGawD4BBUBpwGGAAEEMQHrAxUB7QMvAKYFIgEdBDMBAgZvAawEXAErA8sAxQUEAOIDkwB2BbQAwgOxAJkEiQC7AyIADwdcAIQCPgCdBjEA/wQKACcDagAVB1wAUQOrANEBQwEnArcAjQbSAAAENQA1BZ0AeAXRANMFsAC+BboAYQZuANYFagC6BdYAGQMVATQCwgBeBbUA5gYrAbYHewEDBFYAOgb0ABsD2ABLA6QA9wQVAZEBiACWBRUBCQJpAEYDGgBeAzoAPQOlAKUCTQAuBA8BKQMiAfwEJgB0BEUANAesAGoCxQDpBsYAuQZoAHgHWQEbBAoAXgMAAU8EiwDBBE0AlwEjAVQEQwAwBjcA8gK+AKABdAHNA0gAVQVFAHEFYQC8Bk0A4wFlAbQBpgAkBggAlAPpAEoHQgDkASsAagbVAMIBJQDOBzIBfQVZAaQCQwCqBYsAKQYiAakBKwBfBfkAoAE7AKoGRgBrBEkALgVkAHUG3wDiBFUAMAIVAW0DLwAXAswAtwQrAbIDxwDqBHoA+gZ7AbcDagDRBksARQXOAE8HBgD1AzwAxQTYAAwC3ACpAUQAMQVxAOIEzwCgBSABfQRlAfEBzwAvBTEBjAFJAFAHzwCsBWEAVgaPAHkFIAE+BEsAhQU+AfsFhADABT4A/wHDAJ8ExgD4BGgAaAcgAT4DaAChA0cBcwJ6AYUCwADFBU0AeAMoADoHegCCAjABvQE8AMMEIAGWA20AeQfUAP0F0AAUBe4AMgKZAF8EOADkBiUAkgOXADgEYAD9ARYAlAPTAC0FmQCRBUcAXAIVAYUCUwGtBnsAPgYKAGMDMQAMBeMAiQVOAdQGTgFABE8Ahwf1APUCmADsBDoA9gVKAKwB0wBlBmEAzQPPACoHAAF2AuwA+gFIACMHVAHeBDsAAgf0AGkEpAD/A4ABXgV0AZkDcgD9AdgA1gNoAJUHTQAZAioBmwUrAG0CSQBkBa4AHgXIAGAFWAGMA24ANgQPAVcF0wBSByIB/wLdAIYHJgFbB4MBzQXOAAAEZQE5B5kArAQRAJABkwA5BtgArgPdAMEFXwBDAuIADAZJALsBxgA+BU0A2wRDABIGdAAQBXEBRAd7Aa8DYQHhBCIB6gYSAVED5gBfBXgB4QRFADAFOwANBmUBHALVAHwCfgBJB8IAKwc1AAkFLwDOB7gA5wZhAFoHsQBvBMwAAAR5AD4FIgDHBEQAZwYEAQ4CFQGkBEkBNwfcANwDmwABA04BZwbpAJsERADiBTEBrwKfAFMFMQGdAXAAcQVOAa4FxgDsBDEAygWYAEkFXACAAq0A1gNSAW4GVwC8AnYBogTeADgHLAGcBFMAjwdUAZMEVgGdAtgAtQLEAAAExAD8BdgAgAKRAHwEeQCdBNIA+AQQAIkH6gCCA3EAYQY7AFEH9ABKBEkACgfOANoGkQC6B1sBQwQPAa4C0gCsBQQBJgdJAWsHxgB5BTkB4gNyAc4EIABeBRYA4QQiAXgCGQBDBWUBlQIiARoDRAAwBb0A2AFNAJECYQCLA0gAewdPAWYG4ACHBHoAOAfjACoFSQFLAm0AVQNDAZsErACBBWMBgQI7AHYDQAHUBAoAEgNJABgFSABFBmAAMgIvAecClQDjBqoAhQWqANIGOAAwB3IAEwbgAFEGuQDUAVMBwgZHALABMQDOB3cAZQN6AZkBeAAlBt0AYwfUAC0F1ABZBk4B3QNoAE4GEgBlB6AAVgLfABsEbwApBL0AEwM+AB4FxwAABFcA1gZhAHED9wC7Be4A3AM4AE4ClQDXBX0AcAM8AF8EpgDUBigArARtAIoCDwE6Bk0A3QQgAYgGXABSBSIBJAUlAFcFQwDABUwBmAGVAMgFQQDGBJcAPgXJAA0FRQAKB8MAZgbuAKAHLgHgBBUB8QExAEgF3QDSAYYAsgPcAJICAAFiBU4BVwNLAJgFTAHvA90AsQVbAa0GqwCjAj0AZAVGAJgBQQA3BUkARAZFAMsGZwGoBhMASQOnAIoGsQClAk0AwQMjAfwETwCcBmsBPQQQAW4FgwA5BkkAkgdYAMsCPQBABigAXwQVAQoCbwC4A0IAYgIRAWkEogCIBkQAfAV0AGEFWwAaAm0AHQNbAGYCRABYBkUAcgWXAHMGegDqBS8BBANEAKkBRACpBVwAUANpAAUEBAGWAwoAYAQ4AA0GbQCVBMAAAwY+AZkGUACXBGkAngNxAE8GfQDDAUgAHgbUAH8GygCOBVYB3QFoASYHgwFPBpkA/QNFALkF0AAMBAMBvQE1AMoFSQDLBlgBxQQvAAcCXwCFAs0AQwZIAJIHewDNAXIAVwZNAFoHfAAEBG0A4gY7ADAHRQAnBcoAAARDAFYFPwCBBqwApQLRAJAGzACrBSIAjwdbAd4GLwCaB9oAKAN+AJEG3ABTBDgA8gTjALsHSwCKBboAtwRjAZUB9ABlA8wA/QU7AB8FKADBBBIBrAQSAYEEewFgA0UALgWuACUFoAC3BFgADwRtAA8HWAHEBCIAwAUVAEkHcQH5BUIBwgaVAFgFrQCxB0gAogYyAWkHpgAjBjgAQgdMAcMBewFKAjkA5QRJAHMFnwAFBDMABwJIAJkF9ABwBFQBWgOZAAgC+ADgBiAAkgUlAEYFNwEABDgAiAfMAMgHWAFfB0QAMAdJACgHqwAmAkkAWQJ7AXcETAFFA90AnAeDAOEGywAABFQBewS1AAMHrQBnBwUBEwLjAAAGTgG7BVgA7APUAOgGfwCwAs0AQQZNACsDQwCpBcIAbgSfACQFWwB3AzMB9wRaAd4GJwG0BxUBQQPMAC8HIAG1BEQAhwbAACAHzQD9BDIAAAXhAIYGvQCaBvIADQc5APADaQCqA1QBAAN6ADoHCgDLAzkAggWsAPwDcQDZAUkAHgbcAJED5wC+BYcBhANJAJoGWwFgBFYA5wZMAcEBJQC+BMoA5QRYAOwBMgErA2gAwgciABMDcwD0BkUA3AWyAMkGTgEMA+oApQRJAB0GSgGCB40ApgVLAOQEVAE7BEIAyAG1AG8DeQDDAUkAHwU7AKAHIgAgBT8AHwQWAIUCwgChA00A2AQvAWsEVAEqAngBogXuAM0DPQHJB/kAjwP0AEcDfgBRBm0A6gTUACAHcQFtBRUAoAY7AOUGmgAWBDQBTAJqAD8GewE8BPQAaASLAKEEWADzA2gBEALrACYGPQHmBRIB5QNfAYwHWQG0AXsBEQNNAOADowCaBc8AoQVYAYEEfAARAkQAwAVCAXEGAAHNAUcAlgIAAQUHQgAxAxgAsAJFAPUFTQApBmkA2AHQAFUCOAC8BUkAqgY4ADkFTgFTAt8AOQbDACwGTACDB0oAQQUHAE0CPADABCUADQd2AGgHRgCeAuwAxwQgAVEEzQCyBaMANgVhAT4GMgCsBwIAEgPPANAGgAC1BP4ABATCACcC+QCaArwAWgVFAdEE1QCIAzMBGQZ7AeoCbQByBGUBkgSTAKwFSwCwBroAOAefAJYDPQC0BSABAQMxAbwBFQH6AlcAtAMrAZMGxgCPBuUA+QUTAZQDNQALBWgAeATOAHkHDAA6BTEAOwWTACUFdAAJByQBDQUzAScFWABWBNYA4ANrAaIEQwCvBdwApwIKAMMDwABeBZkA/ATNAMYEQAFiBG0AJQNEAO4FvQDDAXsBNAPfAGUDSAAfAs8A1wFGAB0EIgGcB00AMwSeAJ8HjAAhB1kBuQTCAKsBhAAgAuAAyAPMALkG0QCjBeIAVwZJAcMBFQFFBM4A/QTJALIFDAGeB2gANAVmAHgD4gDqBjEBiwFjAQYCLwAIBcAAEAe+AOgFAAB8BMcAlgVYAUcCKwDiBCIBcwZ5AFQDvQAPB2gASQeLAPACVAEDAokA2wHYADwDwgC1BDgA1wVvAD4HhwHeBXsAlQfUAP4FMQHWATIBWwe7AD8FJQHdBKwAwwVFAJkFLwD5AlsAyQLmAN8ETAEpBFUAFQODAeQEewHHAVQBJQS3AIkFqwAEA20A0gEVAb0E7gAWB44ABgZMAcUEbQD5Bj0AigXUAPgESACsAdEANAVEAMcFJAEABCUA9wNUAcgEDAC3BjIAowTQAJEGMwH9BRIBjQFKANoFOAH6A2EBtAdGAOQBTQAMB88AbAYvABoF0ABzBjkAmgQ0AawD4QD3BPQA6QFPAHgFCwGtBiIBAQQ8AA8GkwCSBHQBAweUAFQHBAGHB0sAjgeFAc0DIgE9BUkBwAHCACgGxACRBJ8AZANmAbICagCLBX4AHwRjAJoDpgAUBnkBDQNkAKkEkwDZATEACwXCAO0GnwA6BHAA8QWDAY8FFQHtAdUAqQJHANoCOwA4AwkBjAUrADkDfgDtBnkAoQPhAEQFZgCJAnsBCQN7AccCMQHYAgABDgR7ARwEVAE5AsIAXQJ7AOoF3ADnAksA2QX0AHoDZQEKA2gAxQVJANoF2AAyA3kAeAdDAEAGTgHCBEgAvgZaAbYFSQBZBaMA7ASDANoEQAG2BFgBoQbPAAAEzwDIBxYA3ATdAM0BWACRBDIA9AVNADUHRACVBlwAUQZTABoCugBJBkIABwMdASgGRgABAzMB1AZhAfQEMQGPAWgASQYvAPQFaAGHB70AsQefAPgEYQDEB7oAUAVJAT4H2wCRA2AAvgI0AS8EOwCyBnAAwAU3AAIH0QDtBeAAlwfhAI0FTAFgAn8BQwRrANYFswCfBHsAXwU7AT8DTADNA/oAWAciAYYHaAHuAosATgYlAL4GvQCwAgABywc7AEQHSQDZBTMBfwJNACIEpAAABCEB+gRwADAGRABjAvIA6AJjAPcFRgDwATIAiALEAGYHzwACBjUAlAZIAPAGSgDSBTMB0QZ0AOcFVAFkBJcAVQQtAX8CfABfBQUABAdDAHIF4ACJBg8ADAQjAWAH3ADsAsAA/QRNAI0DPQAvAhUBoANnAJMG+AD5BXUABAYrAVMHQQC5BVgAugR6ANwBSgC/BksAGAWIAFcGhgA7Ao8AIQaMALcEdAATBSsBZgYKADgCFgCcB3wA2gRGABgDbQEPBNwA9gFAAGkGCQGEBdYAQANLAHwF9AArAgAB5AFwAIUFlwDlBAoAFgOkAP4E0gD9BD0AXAeCAIYGQgAaAk0A4wRuAHYFTQBcBPkAeAXJALQG1gC9AhkApwXUACQFxwD8BIMBagKtAHgGpgDqBG0AqwNoAM0B0ADlBFsBBATKACEGVAELA5MABwU1ATAD8QACBkIAvQFHAakESQDdBiUAuwalAKQBQwBTBkYA2QFmAZkDEQHCBnEADAP0AKIB8gBLAiIBfAYrAIUCiwBIBysBlwcVATEEZgCwAp8AOwZfAeQEIgCfBFYAtANfAFoHbgCaBbUABwXjAOoEGAB4A4wAmgXRAGAF9ACdAoMBFAW/ANMFbAA5BkQABwKsACsFSwDyBUsAuwVJAC8ChgDWAysBNQY9AAIHlwANA0gACAa7AIsF7AAmB0MA4QVYALsCjADlBFQBgAQxAWYE0gAvBRUB/gI3AL4GNQAHAnkBfgW3ACcEhgBuBEUAUAYzAXYFMAE+BwMAXgVqAJ8BiwDQAjYArQY7AFwFfADGBDIBuwYiAJgBMAAXAnABbgVNAHsEMQGyAkoAaQY/AP4G4QCBBXUB9gZEAGYCMQD5AlcAVQTLAEUDNQA7BVgAcwNJANIF1gCfAysBqAM3AKwBlwAeBVcAQQLqABYHXwFuBXsAOgTuAPUC1gAuAnkAsgOmAE0FIwC7Bd8A3gQAAYUClAA2BEQANAciAHICSgHLB0MAHwXCAP0B1ACsBW0AcgciAJYDzgAHBWMBmwKTALcEagCEBlwAugcsAbUEVQEOBEgAgwd3ABQFFACfBdIAeQcgAZ4FMQDABiIBuwfMAMMHSABBBUkARwcgAd0D7wB/Ap8ALQM1AYIHPgBZBisBsQUgAZsEawDLBfQAXwJtALkHTQD1AtwAvQGcACUFQgHkBFYBmAEVAZgEuwDqBEUAGAXOAMMHCwFlAyABKgYEAZACOACLBnMAVQfVAM8BbwBWAuIADQUEAPcCVwD+AU0AhwdcAIUDiwC+A9EAEQVOAVYCmgAeBTEBXQJbAT0CJwBpB+MAHgUVAS4DSQBpBeUAVgWhA7cH4AScBk4EWQYgBdAF5AGWA6YDPAc8AzoHbQTuBm4HhgcWA0oD8wN8BKYDcQbCAxEGBARMBwEDNgZFBcsGyAMKBxoCSwWhA8QDSQZOBjIDDga+AToFpANsBUUESAanBMQEeQLWAhYEzwVSAlYH8AHFAr0FQgc8A3AFpALlA48CKgXTAuoGoAGRBrQCKgWsA4QESQPrBn8DHgdVBDkGxgLzBVYCYAZbBdYFqwQQB4EEMAWqArsGFQM2A3gElQepA4IHVgIhBdkC2wJkBT0GSwUYB6kBGAO0AxwHIwW9BU4G2wbTA/UDuQO/BQ4CKQdVAusGkQJXBPUD6QVOBmwH2QEwB/wCRgSUAkUGcgKwBb8F6Aa3AhgFeQNKBlgC/AawAvQDpAH8BD8FWgX2ASMGpgL0BHMEqAXmA20FvgHXBMQBxQSFAj4GagaHB+ADLgQ8A7cEBwRUBIQD2AR5AnIFvQMNB5gC3gVcAggG2wJABJkESQZbAlUEtwO8BVMCNAfmAUIGRgKxBIYC5ASoA/4F9AbFBwgCvQSuAgAExAGCB0YFWAfbAVcGdwRdB+QBmgagArkD4AEbBAEEDgYmBrQH2QHyBAEDOAWCAu4CsQQnBmcHcgddBCQHJwRUBIUCSAMXAi8CtQOEBc0DCATgAXoFRwTIBCQChwcBA0QGmAPABVgCYQYBAjsG0wF8ArABTgWhArAEFAYjBuQBhwfFA3YFkgMKBFYDnAayBIgG9QLOBLcFBge9AUIFFAZCB6gDGQb8Ae4CDwbGBqUGqAd4A4IHMwL4BB0ExASsBOcG7QOyBCkGlwc1BOUGHgXlBX0EcwV8BMEEZwJwAwQEvwRaAl4DHwQ8B6kEyga9AhkGGgK4A6kDJQXUAsYEgQIPBLcEAQYZBJQEiQNdBrACVQdNAtcEQgawBkkEzgRDAm4FbgWcB+cCfwO7Ap8GzAF1Bw8CCweGA5QDLwJVA+0BIATyAsQEGwKsBIgEZQXGAusFJAOyBdkBJwWJAw0HwQNXBG4ExgSSA5IFxQaqB4EEXQa4BTgG1gFGBQQEuQT1AagH8AVYB1sFCgawAhME1wHLB70B8QUaAr4HRgIqBU4CsgJUBGIH5AHeAu8DQwe1BOoGfgPdBNcC3gasA6EEUgOQA3QDngONA9oEiAUDB5YE9gRrBH8HcAUdB5gD8gUyAlYG3gQOB+8DGQQ9AqwEnQKxBCUDxQflA28GcAbkBg0DWQaoBTkGZwVPBigGPQfMASwCTAI1BF8CXwY2A3YFeAe3B8MB4AbvAycHaAKPBvsGawc2A9YFrgGnBaEDjweLAoIH2AWfB2AFwQcVA3oEagS/BZED0ATeAisF2wJzBwwEJgdyAqcElwefB0sCqATDA+8GegRJBRcCRAZrAyUEvgIkA+4GMgfiAtADwQQsB8YC0gbAAWoCJwKNA5YFeAYnBI0FZAXYBqEDjQeQBN0EHAThBP8BVwMxAwEGXwSnB5wCzQOmBC8FXgObBywC8gXYAvUDRQW9BYYD0ATaA7sGFASUBeMDuwXMBPoFLQI3BX4EiQRyAuYGsgTWBFYCmAUoBJUFVwNYBcMBUAaJAy4EAQQuB+MCqwPIAUQDjQPpBWcCkwbwAR8FqQGCAvABxwV/A9YFEAKOBCsDNwMTA68GHQRpBToCzQXgAyIHmwG5AiMFdgUjBKkFpwKKBR4COgfkAlkGdwWeBrQDwgXkAScFBASnBcUCfQTSBVcHvQIqBVUDOQUEA7cEvQN8BUAEUwagAioGsgOcBxgFVwcMAmYF5QEkAz0FSAfoA64HOgdRBwgDuQYBAgAElAJnBqwFSAe5A1UFBgY2BoMDHwa+BPIEQAZXBx8E8wW+BGkH1wJbA70BewcXBjoHVgPZA8kEQAfrA/AFJAQdB4UC3wLyAlYDLgSsBHMESwW2BA8H8wOcBzYERwecAo8FmANbBUMCtAeBBR4GjgP2BB8C/ATcAWAG0ASpBbICTQcABEIG2gQDB9cE2QRRBh0HOgSNBXoE9wRNA8oDzwGjBj0C5AQIAy0FMQNlBTAC+gLnA2AHMAKPBbACRgMnAg8HjAVzB2oEAwdIBNEE6gR4BsgEXgXGAnwF9gJ/A9oCZAW+A7MELwY0B3gDIwa4A3wFPQKkBrACSAN6BJoFLQPFBVgEyQTmAdoFxgLZBZkD0wYkAl8GNgSkB4sHkgd7BmoHhwSPBp8BtAXWBfEFogauBx0E+QSXBKcG9QI+BngD7gN5AygGXwS9BNMCLAZeB4IHEANIBNkB8wUpAzgHsAJlAzcGgwdTAvAGigQHBeYCDAY2BLAG3ASFBugCkgRSBfMGagJuBUAETQWLBbcFHwZKB7AC2gRfA4sGjQKeBAMGogapAXkCHwSZBTACggUnBHgE0gFFA98CVwXrBagHzgPdBXICAAfKBdAF3QMdB70BpgUBA+IFfgOoBJkEYAV5A7cHPQJnA94GXwe7AfoDdgN9BVoCCARfBToHPwPbBeoF2wahBVEHJwObBwECJAUuAoQG9AOdBV0ESge3BJwHfwNrB/UC7QbgBGsFLgLNB/wCVgMBA0EFwQJzBigESwW9BPQEfAQ5B7QCNgUvA8AExwJgA8kDyQbuA7wFPgRdB6MCmgWEBVcHygKZB3UEgQSFBZYF0gEqBs4CVwUqBoYH/QPuBeMCYwMJBQsFcQaYB+YBwwXlBHcFeQIdB3EGRQe/BQ8HEAIWBwUE1gbbA34EKAK+BOUEHQftAzQGPQMjBbACnAQgBNAEiwWjBaMEgAf2AzwFAQOXBIUCLwMaAoQFPgbGByUF+wbmAVYFRwRxBnMCygbWBVwGvQW1B2sE8gRfBV0GKwWdB70FCgdDAs4EVAOyA54CBAM7AsUF4QT5BbwGRQdaA4AEyAG7BHoCzgMNBN4GngJVBj8CowVyAswERwKtBJYB7AQpBCIGcwJFA6MEuAeWAXAFBASiBAkEPwSvA0MEeAPHBA0Dcgd/AxYErwJ+BJAFrgWWBQoGXwOsBJ4CiwYcAqQDxwRKB9cEawfPAQ4GjQTCBgsEMAffA4AHPAK/BZ8CyAO9A6wEIgSSBHEC5QM+A4sGDAZzBmEENgcXAhIGagKJBJAF1gU0BWYFrwIcBZkCVwXkBOcG3AGDBj4DsAb5AUIDUwLdBk4GnAf+BIsF8wIUBX0EIwbYA7YE0gMHBUYCAQTQBHsGGAP2BcgBXQcxA08G+QJBAyIEkARaAmkE3Ab8BlUD3QZQBd4GVgK7BfABEgZHBNgEOwNlBEcG7QZAA3kFlwQ7BiIEkwbFAS4DpQNFBRoCfwVGAnQF4AJeBQcEnAfgArwDdgOeBVMCaQanArACuQPNA08DBAQLBKcFiAOQB3YFkAUeBc8GUwJZAu0CwQdcB6EHcwQyBx8EtwUXA9wEtAQ+B3oCMAc+A+EFwAGGB30F3wZ6AscF8wJeB30EHQfmBjoHfQPiBt4CsQc6BIYH1AX4BlYCxQPGArAGoAL4BB8CFgRAA9wGbQLOBZADPwU/A+sGHgXzBoUClARyAm0FzwapB7sF5gZjBikHGAKeA70BcQawA00E8gUpBsYC5ARXAgYGVgJpBdsBfweMAzcEkQSpBOgCKQQ5BqcGfwNqBJ8BugXJA1EGdgXaBZ4CVgWuBVwG+gOXBuYBTgXRA1MEPQLHBMkE0ASyA8IHWwPAA/IBrwfWArQHlQMRBXMErgXBA3EG3wL2BGsEOQVPA40HcwIKBvUGZwe6AYwDfwINA0AFcwX1ApADpQPkBlEE1wTlBVcHcgJ2BAQE5gaKBWMG9QKgBKYCsAL4AsIDugJXBWIEzwRVAosGawN0BAYHHQchBEEFWwJZBc4FtQeYA0IFvQGmBLkDWge4A1UFSAJwBn0E4gVyAs4EbAIDB4UDuwd+A4sEjwSFBnsDLARaAuYDxgJFBj0CFAVRAisFJAQZB5EDtAcBA4oHJAREBn8DqARSAugCxQJABHkCQAbGAkIFPwO7BboDyAM3A38D0QNEBN4CWQXSAXYF6AMyB6wExwVXBHEG0QEpBDoEWAWQAV8DqQU7BgEEcwa0BOAEeASHBH0C5QQRBUMGJAPnBCEFVwd3BSgG0wGpAh0DwQcHAsYFhQJYBG0EnwTiA6EHfwLSAwEDrwWzA/AGwAIUBFcDgQfDAcIFMAJMAoUFcgdWAsYGNgOlA4sFMwdaAkME0gEHBFUDxQOQBKEE9QJmB1EGUQflAhcFcwTYBqEEJAe5AW4DHgOeBYoFMgdpAvUCOwMKBNkBmAPZAzoGuAOVBggEAwdfA7UHOAJqB2YCtQVyAmMDtwRJBkYCfAKRAyQEnwG9BYEEDQc6A9UE8AGBB3MEuwWTAsoG5QL3AgUDrQTbAfkENQU7B1wEnAYrBcYFxQMHBdkClwSfBL0FuAMYBcYC3QUXAywE5AFLBX0E+wb/AVMCTQTZBEgEUQVpBAUHugNgBlMCOAahA7IDvQHOA4gDdQfnAuEEeAecB6UGpAd0AnEEqgVjBv4BtAO4A9cFZAV2Bs4EcwegA9gEGgJmAsIBqgPnAqwG9QLyA6wBrgeTB8YHOwIABMYCuQU1A8UE4AEABMQESgfkAYoF/wMpBugDVQZ2BQYHGgJEBsgBgwZ7BcgF4AOIBjIDbwTTAsgDTwRWBuYBzwWFBRQGPwWvBggE3ARFB3sHHQTSBKoDAgRWAhgFtAF+AxEEdQYjBrEHhQIMB3ACNwMABGYFvQE4BTEDswMMApUCUQRoBG4EYwc2AjwHvQEhA+QCFAaSBJ0ExAMIBCMFrgWvA6AEhQI0BHkCcAdVAi4FeQPNBDkGMwdsBMkGsALgBAEEsQVwA8ME7gKWA6UEgQelA5cGxQW3B70B7AUpBngGiQTkBDACyQepAs0H5AEyB1sC8gVLB3MHvQF/B40Dfwe5AT4EPgNnBrMCHgflBJUF2gS8BsYCMAUeBS0GFgQeBqECsALkAd4FkwYiB7AC3QQ7BMEEzwEbBkIDQgX7A7MGqQElBYkC0QMEBcsHrANJByEEPAdkA+UE6wMPBgQEewRuA3gEwgTTBFUCUgVxBugGGwRUBVQEOQfoAx4GkwO6B4UC4QQ9BGYEuQMgBooCpgXbAXgH+gPiBWkFrgfdA1sFgQO/BNkEfAaYAcYGFAY2BjsE4QSUBOcGwgOLBzEDmwSKBC4H9QXRBmECnQWdA1kF4wOHBK8DCgTnAlwHDAKfAs0CtQQkBEIFUgLBAzgHrAcoBDIHYQL1A/4CHwb/ARYEWwJ8BdsBJwIKBqQHQgVXB1UCGAUYA88G7gK0A/sDmweUAooF8AGvBXIGrwYfBVcH2AF0BrAC3gTNAXgHmwFkAqICKgZtAj0G2gX1Bg8CSQW4BVwHHwLGAsYCEwO3BEIGtgPpBswDBAT3AX4HuQMoBtcBlwSFBfwGvwYYBxcEWwajA1gEWgP7BtcCcgbNBcYGAQPyBe4CbgPjAwUEKASLBtIBfQXtA+QE6wLdAxYEgAa3B8IH7QEmB+IDnAeUAi4FhwSGB88EPgZLAnEGlAHyBNwEZQWhAwUE3AQ+BmYC5QTmAQQDKwWLBSYDvgTtAtYFzQKxBjoEXgRSAuMGDgShBEADLwVMA24FxgKQBU4CQAUpA+UEmgUeBsYCDgfQBLwHPgMQBoUC4wKpAeoEUQQ+BoEE7gX3AR0E0AQPBkkDOgW2AboFPALiBCsDSgWnBFMF5gGYBd0C5ATDAXwGZQOhBA8CxQdzBq4GfwO8BoEEwQRiBF8G1QTcBDoHZweqAqQEngMFBAgCYgQwBhUHPQNZBbcFpwYeBfEFhQTDBPQD0gR/AsEFyANeBOgDcgZKBpcHsAINBEYCZgLFAZsEzgFVAtkEJgaoAQcFZgLiBkQFOAY4A2MG1wM4BHgCuwdGAn0DBAK8AigERQakAWEGkgOmBE8E3ASVAg8HPQJrA9gG/AYPAxoD2QHhBb0BxgTqAl8G0wMEBNYF2gWYBOcGDQRhB20CuQbiAloH+QEgBQoGFAYDBCsExgKuBWoGAQeRApoEjwatBuAEkQXNBVAH8gIsB0IDlwavASQEsQVuB6kBKgSXBIoFHwR8BXoCkAVYBPoGaATBBPUBkAdkBF8H0QQPB40DyQQ+A8kETwIlA6EDWAYnAlEHsAOTB7kBhwf1AqQDgQIJBAsCUQZqAkoH2gJVBRYCdQVVAiMF3QRzB54CxwaLAoEDBQIoBj8DRQWkA+cGYwLCBtMCVATFAUwDYwPFBIUDGwbkAi8HqwKBBDADfgewArEHAQMhBdIC7wLOA8YF1QVEBhUEIgciAxcFMAP1BSsHYweHBIYGUQbCB+wCCAclA2gHcAN8BAAE6AaWARsGuAPQBKQB+gWjBK8G2QReBZEDTwTbBo0HOAVFB6wB2QFJA5MHogH0BOEF0QbxAy4E3APpBSEGdgduBAwGKwJWBlwCZAXCAzYEegKEBUcDyQfWA8UHfwM4BCkGUwcoAjADegJCBwwDuQfuATQF/APYBNkE+QTVAxcFyAHUA3kEzQWUA8ADIQTlBuQERQezBMgEVQI2A2EF+wbWAhYHLAZZB4gDTwc0BJ8GYgTUBNcCvgY7AikE6wFXBX0EuwX9BLEHswOKBesDWgQBA4MHfQTeBq4Fige+AlgGiwIMBI4CigZnAjUGyQUkBx4FqQWnAw4GOQP1BakDSQboAocHEALrAm0EnQRsBogGGgJiBZAE5AQOBLgE5AFmAgUElwfCAWAGfwO5B/8CAAS3B70HMgI+BuAB+ARrAzYHpQJTBaQCdgXyAmADMAWnBe4BUwUwAqQEfQVwB1IEhwRxBQYHhwSVB9cB0ASeAqAHcwLnBPUCpwU3A0oHewa1BxADAwevAmkFEgNMBs0BeQfnBIAGbgSHBIoDvgTgAfAEsAIABwEEbAceAu0CBgNgBWsEtQTsA30FrAPgBNkBPwd6BLcE9QLDBAQEmgf9Ai0E9gG+AmQFmgWyA6QGKgN2BFYCnQcnBLMERQOIAx8GPAckBXAHPwRTBAwEhwdOAp4C2gTtBpwE4QR5BE8GQwLTBC4FVwf2BNAF2QHABUcCLgfrA1cFngNuByMElQVSAsIEPwPmBh8EuwV2A3YFPAbhBs8EXwfAAbYHVwIbBikDHgVzAngFVgKgB3oE5QTFAkIDHwQtBtAEVgYUAvUCXAJYBUsFrgX/ATMHdwIUBZQBXgV2BIkGZQOUA5UBYwM2B18HFgT1BTQDiAQiBpcG9AQVBhcCYgV7AuYG3gRnBuQBmwQnBG0EWAIGB6cDPgV/BTwHLwb5BjACwwTtA8sESwOPBqsDRAVUBPcF4gS8BjwFcwdkAoIHgwPtBhYEWwXZAVkFugRWBlMHbgevBTcG0gF4BNEGuQd4A4kEeARXBWUEVAd5Au4FKATiBVcD0AQ2AvQGPwMfBQIDGQa7BaMGagICBAgDdAdoBFYGZgI+A6MEnAUmBLAH+gMeB2sEkgeaA28EuQTdBCkDPAWwAlsDIAeRB3MEHQb5AcYCtQNsBLsBNQU8BTQH2gH2BJIDtwXZAa4FvQXGBYcEdgfeBCgG0gFYBdEGTwcBBHkH8AE4Bb0D+QMMA0UFhQaTBx4DwgRrAwsE+wY6B6QBGQZJAoQEfQRHBQoGPQbcA1YGUwJFBsQBzQMcAocE/wOTBp0D5QU6BE4GQAQnBYIClQeGAoIFGAOiBm4D6gUqA3UGDwQ3B80BhgbWBYcGfwNzBCgD/wOkA4EEswOSBjQDRAOGAo8F+gOqBZIEwAUMAx8FZgN9B/UCvgTGAsMFsAIXAwoGIwcoAycEnQY7B7YDOgfbBngHqAOHBGADgwMqBEcHWQb7BkkFgAalA90FWAIBB5cC7ga3BdoFkAReBw8HGgcDBNkENgQzBy0ESQYEBDQEugGsA/wCDwfRAZcEvQV2B7sBhQd3A4ED1QQfBjgD5QScBJMHZASeB9wBVAOPAQkG8ANzBfkFngbwAagFWAICBsAE7gbbAS0EWwLeBgwDqwbeBDoGDQNmB+8BfAVMA4EEjAOpBNkBkQdSAsIC2wP2BMAEAAcABEkGhQIZBK4FHQdWAlYFegLkBI8DxwO9ASsF2QHaBTICnASVBJMHegK1B4gGIQejAuUErwFLAnwCuwQdA1MF6gSZB30C/ASXApkFcwQKB6wEJgXrAzkFpQFxB8QBJgbZARgF2QGxB3ICQAN+A8IGkgTFBJUF4gVEA2UF+gaVB7cEKgV6BJcHsAJ8BzcEWgfeAv8FWQRhBCwCaQY3A+kDogEfBnwCCQS5AQUClwH2BGkCGgVGBikHpQLBBwQEXASWAfcEuQGvBUgEwASoBLUEvQWiBtEEVQd/A/sG4AFPB5gBAgMyAsEDJwLvArUCQAU6BJwHFAbYBqgE3QS5AYICZwM2B0ADtgYQAi4EJAR8BQwDLQY+A8wFlwFUBLACugR3BA8H2QFCBTcD5gbdAnUGowQ+BrQEKgYAArwDxgIwBmAEwgYnApICigKLBicEiAYgBIsFmARPBlIHYweJAfkE8AGVBScEhwSLBZIHcwRbBf0FvAbyAyQE+QHKBT8DrwX9AqIDZwLpBNoBbwfNBCIHRwOcBJAChwdpBRUGOwPfAxoCsAbSAakCegT4BCoEnAc+A7cFlwSQBpMD2wbhAUUDGgQmBOYBkgN2BfEFDQQyBA0EogTEAtkEFwLeAhsE3AaaBtQGDgMqBY8CTwZSAosCLAIIBp4CuwUBAxgFrwGRB58DqwSOARcFbAMmB3sGwAf4AvwEFgTSBbUEzAQEBFkEkwRdB+AEswVYBFYG5AZyBwUCFAUkArwFNwKKBJwE2ATjAu8GHwMGBE8ElATVAp4HgAbjBvkF+gXQBNYFXgS9BVkHeAfJBHwFXAO/BXwDqwSNAw8HHwM+BtYC8QOIAsYCcwQfBeADGQZvBHYFGwS1BWsDpAa/AowHmQTqBIUCRAPlBBwFcwJCBr4DKAaRAp0C/QRQBioFyQa9AVgFxwQXBQMHzwdXBi4HKwWqBhcGWQb8AswElAJRB+EB6gSmAbwFfQN5BR0GBgcwAqECzgEMBBgCSQXwBlQHlwQ4BsIBXgPoAYAEYAXdBVMFrAe3BP0EJgbYBrMDEgawAVEH9QLmBhQFwAXGBRcGNAQ+BC8CdQdYBosHoANJB3MGqQbgA7wFuANFBbgBwwHkA48FVQLHBTkGsQc2A/gENQPyBJQEqgTmA/kFvQFBBWsErwVTAscFAALFBLMC0AQvApgDyQN0Bi8FsQdZAhgHMQLlBGcHvQewAoIHzQV9B8YExgfGA+wDNwRCBFEGYgfWBSMGMgMHBdUBWAcNA4sHtAOnBTACQQJsAp8GcwK2BqMEAAdwAq4CegQlBTcDPgYeB4cHBQSHBBoC0ARuBLkHkAMkBNgCZwUjBIcFHgWFB9kBRAXGAlwFfAKWBd4CxwU8A0UDjwVWBvAD4QVJA/QGQQOLByEGYgcCA6MEDQOuBX0DAAStAdsDJgS0BKUC1AawAWcGNwUiBpcCiwawAloHVgIjBToESAepAXYFEgTUBFUGrgcaApgFlAO+BKMExgYkBBgFYgJ8AhwC0AOXBJoFIQPCA+EB8ARQA3AD3AHbBvkBSAa9AXUCbQR4B8IB7QW9BgoHXQTCBfgEcwYaAhYHNQL3BcEFPAckBBAGAQNHB/QEIAaBArQExQP4BOIDsgc2BJgFnAJtBP0EkgdrBF8FPgNCBdIC3QRuBNEE7AN5BzICjQPeBD4GyQW6B+QCUQTBArcEcgKdAkYEogSxBNEGUQYrB0AEPgUeBYAGxgPRBnMEBgcBAycFYgSeBLgDLgVbAuIFkANcBzkCrgQqBscHrwKVBagDbQRUA7QDNAZKB9AEuQfcBFYGeQK5BY4CDAOIBhwHOASKBvwBjAakATYFKwUpB+8CjwUBA+QG/wGsBj4FVwZaAosH9wMFB6UBTAL3AjIEEgRxBq8DPQTBBd4GzAGlBwUEeQcNAoUCmAUzB5cDxgZfBRAHbwSKBNAC4ANWBL8FfQOyBe0CkQPZATgG8AH1BcECPgWYAX8HagQ2B1MF3QUdBFcFJwJ/BKMFIgYjBEQF5AGOAjIDjgXkAwAHkQLEBN0FfQazBDYHBQR0BrsFzgWqBCoGegTJBmUHswf/AZgFiwMDB+8CuQM4AqQGKAS7BTcDJwTqBY0HAQPuBfkELwZABPwFxAIeBDcHggc+A/EFqQFCBMkC/gWXBGMH5QMbBEAEcwblATwEmAN3B+YCqwXjAhwH4AJ/BFwEpAYpBHcF0gaoB+oFIQa1BL4FIAX0BakBkwYlA5ADcgJhB1sCRAWaA74HdwRWBisFMAdmB6gH/QPrBcwBcQXwAl4EKAY1B84DkgYhBjkHhwRKBkYCigQvBUgHAQY+BiQFIgaFAgAHRgNwA9sCTgYUBRYHkAPQBHkEjwXWBRYHDwSAB9AE3gQQAl4FjgTbBX0G7gYNAjwCqQXyBVUCLQe0ArYGQARFBUoEVAaXAk4F5QLkBJUE2QTaAhgFbwO7Az8DRAUyBIUEkAQ6Bh4DeAOJBM0F9QLUBA0DbwSXBLEHDANzBb0E4QZgBnEG4gPYBo0DPAdKBMoGGQRPBLwG/AZOBDoHDgVWBkEFXAXYAroEWARdB9MEPgbfAcoEtANOBooDGQQCBJwH0AEyBDACDwfkAZAFlgEbBVwD1gTGAiEFCwKqA5EDyQUVAzoGeQSsBMQDtgfSAQwEfQTLBucCVgYfBMcF0QPhBNADWwRBA+QEwgOZBsEDOATGAnIGvAUNB2MDWQSwARgFOQaSB2UDjAPBAYwD4QQAByADwwaQBHEGhQVwBiQE4gQeBZAFIgYGB1AEyQdGAmAFfAL3BZEDiwerAroEZANvBDkE4QTnBC0HHAKtBPYEUAeLBOQEWgSkBhkDNgQaBGIE5wYNB3ICagRMA18E/ARwB78FAwfMBJMH/wFcB5QDkwdbAvgGwAP7Bn0E7gUSAjoESQOzBnYFRAaEAuwEawRdBioG5QbJAqEFrwJ7BscCCQTZAXEFBQRIB88EzAUtBFUEUQPHBf8BHgRzBhIHMgK+BGsEgAUqBGMHegLYBrME5QYFAskFJwLYBMQCYASjAxoEpQOuB7IE1QaTAyEGawLCBcIGWgdVAnMFgwPYBBkDVwY5BosGngKXBqoGyQYwApYGfwM0BoIEsgc3A8MEGAKhBR0HeQdpAtYCVASTBqQGfQceAqwFAgO3BKoDJQZJA8AHngJnBv0ETgZBBJ8GgwSPBYoFFQZjA94EHwPOBEYCqANXBegGqAEBA6gBJQWFAjkEhgLJB48GnAddBDcH8gHsAkkDnwbuAlQDBQKwAo0DVgYvAugDywPLBK4COgfcBI8FUwVDBrEFhgfKBRUGXgPLA7oBxAEXA2UFRASPBH0DLAXkA/YEeAOfA64BYQcEBDkEBQSDB38CgAS/AzwEsQH4BD4DGQeGA10EiQP5A3IDwQeIAigExAGsA6sEZQXEApsHTQN5B84DEgZ6BKAFWAI5BnQGKwe/A1YG3gLsAkgEXgU3BkIG2QHPBQUEEgWPA9oD6wPsBe4EqQdnA6wEiwLoAlMDKgenAp8EVwStBLwG2AZGBXUHewUuB9sCigQQAgIDEQNRBDYEDQa5AYYDQAOyBaMCtwQBBE0FagLaBqkBoQP6BNQG1gWSBxoDpAbsA4cEXAdhB5oC+QTZBJMHzwHqBKEB1wTJAzwF2AJpB5AEwgaWAzsEtAQSB6kBcwQ5A1gG2QIMBhgCeAUHBUwGwgH4BI8E2ARcBHEGUwReBQwCBwVKBPYEqAVKB9YC4QK9A+4FHgXABZ8BlgUwBPYEjQLSBKMBawXMAT4DFAQeBLsFBgdRBOEEvQU5B4ECugQSAi0FfQTxBtsCBgPnASoGSwQ+BtUEnAZ8Ag8EmwFrB8QDwAfPBf0FjAEjBT4FlQdfA94GlwKjA9UEDwfKBNEEegS7B6oDqwXaAtAE0gG2AzgEOQZjAtsDcwSlBj0GcgflBNoFbgKuAugDMAcxBFgH5gIvBeYBlwaiBq8GVQLzBvkBfQaYA3wFSAKwAtkBnQOeAh4GAgR0BocEjwdOA+0G5AF/A1EEUwTMA78FJwSGB0IDywaBBF8H9wGeBF8D+QO8BZgHNAL2BDUEAAcABIgGUQbNBwsENQaVA0EG4QacB2oCfAR5AxwHiAO2BpwGywduB7oHSAKFAucCBATEAp4HzgNBBaYEOQbBBQ4GsQN1BDcFFAYSBIUE+gMjB2AEXgXOAVMCNwOAB4EDvwXJAk8HrwEyAlkGcwYOBHEEBwKlA80BhwRgAjwGOgObBAIEJwX2AzAH2wHmBEYCQwaAA6MGZAJ/BGUD0ATQAlkHVARSB6IE0AQhA44FGAJGAooEcQbcA4cGtAFvB/YGVwdiApMEtwJOBUkGtwfbAdcDmgN6BLcFyQZVApkFjgLiBq4D6QZTAh8F3wNdBxQGCgcwAr0EiwLgBEgEPga1AZ0EAARjB2MCtwI7A34EQgM0B8QBGwNWA8IGVgNoBA0D/gOxA84FJAO6BWAGdgd6BAwGHgOHBz8FRgaUA8sHdgVYBrwGtAfoAqMFbQJPB64CBwUrBTcFvALhBHYF2AYwBLUEMAS6BiwCLwI6BLcHYgKzBDcGiwa9AywHWASjBDoEeAd4BpQGagJRBHkCHwXXBZAHUAPQBEYC2AVAAwwEagKDBEYC3ALXAbQHoAPUA58EhwfwA7AG3gRHBTAD7gQWBOsFBAS+BKQCpAcHArcCwQS8BeADHwZ6ApUFqgPgA3oCuQdzBDYG5AGDBwIEKAYHBXEG7wE1BDQCOgbBBcoH1wEEBCkD/ASqA8sHkgTHBL4DVATXAy0EKgZOBooBBQV4A48DTwbnBlICUQZ0BCcGWgTEBGgCFQdyAlgEpwTGBFICawNfBTgHyAQaBxkD4QbKAqwH3AS/BQUEhgbSAisEKwXdBZkEcAbDAh0EUATCBgwDgweZAVECZwQ6BtoEvAUkAykENgdJB3YF0gWLA1IFZgI2Bc8BRQNGAlcCrgUIBj4DqQV5AnYDigWRBd8DnwbZAfUFtwNXBQwDowXIAQoEeQJnBisF1wW9AdsFhQKcA9sBIwZvBFkGjwTcBHIC3gTWBLsGwwUSB6UDFwaQAx4H5AE2A9IB2gSwArAD3gTYBq8C8AVWBiQHQQWpB4YD4QRZBO0FYwPcBJIDewc5BuQGJARGBesBagK1A3IHtQQ+ByAENAUxAz4E5AHlBVYCXwUWBGQFcwSvBVUCQgeaA48HlALFAzkGwQZyApQDVQIjB/4EVwdcA8IGRARfBj8ExQSAAgwDiAb1BnAGRwewAsACqwMwBScEtwfwAUIFeQJYBZgDQAZhA+sG4AOcBzgD6QaYBMIGPAOeBkcFQwZ8At8DAQNbBTUGUQZRA6wEKQS8Be8D6ASfAZoFTwKOB8wBsAJVAhkHXgQXBm4DwQRRBIIGjgKLBaYC5wbeBGoGiQLXA2UDRQXbAVUEugJuBdYDeQcyAj0CcgLRBPIBgwPyAwcHDwJPBzoG7gbNAQcEuQG/AX4EvwXWAogFHgPDBYEHogdEBEsG1wGRA1ICHgNSBTQHkQLCAmMD+wOXA2gHjQPRBDcEQwfbArcE3gJxBeQBLwJrA4sEqQaxBwQEnATHBvgGlgVNBr0CEQU+A4AFUQR4BIsHvgeCAvoGlQLWBBcCUAePAkUD4wYcB2AGhgfeAdEEsgJrBOADjwbFApcExgQqBuQBBgXtAisF3AJJBnwCCwe7AfABvQL4BLACvQL/AvgEwwFKBCsF3gbeAzsEXQRuBWMClQSwArsEkAImBi8FbAdbA78FpAJUB9oCcwXQAT4GNwNpBHkC+AbABBsHoQLgBLACuQQhBNAE7gIFBJoB9gSlAmED4QLTBrACvgSGBpcH/gKPBdEB/QRpAmYGyQRuBQgCFQYyAsoDmATkBOkCPAdjApQDsAIEBLcGZQfuAo8HHwQdB1ICQwVlA5MEegKSA0kCzwKvA6UEsAGVBB8E3gawApcEXgUbB3kEcQbaAjAFPgKwAjoEvAWIA5EEsgQVB70FHQZ1BLsGPgN2A+4DHwapAd4CRgJ5Bc0FYQcnAvYC8QKkBHME9gXWBYgHUAOmBuEBwAXAAZ0EmQTPBykECgeNBMQEkQIOBAwDqAcVBN4EBgPqBIgDnwPnApwECAPnBNoEYQcWBCEFrAHKBc0DxgYjBOIFegRQBSgELwZxB30HcgKLA+YBkgaPArUFvQFLBfwCFQSsBLwFDwPhBMYCRQWKBOkGAQc8B+cEqge+AycEsgNmB9QDDwQ4Au0DQATVBaQEzASpAfcFKAMXBqwByAFZBf0F/wKwBDUFSwU8BEYEBAMuBxQGsQdaB8YHnwS4BeUEZwfZAYUFVAR2B+0GxgcwBN0EwgbBB78EtAdUAlwFvgKVBKQBUwXPAlwFggOJA/wD2gRcAtsFuwW/BVcGPAfZAcMFAAeTB5ICywT5AaUDBwIgBcUDIgZ0BOQEVga9B1cCGQbUA7QEUQTMBMgBDwS1A4cFWwSTBy4CLQXtAvwEggMOBDYEhQUPA2QEswNFBXAGBgd/A/4E0gGTA5UEvgSJAzwEgQTHBNIDbQT5A18HOQVjBm8DywT+A/kEvgQ2BrIDyAOxA6wEggNJB4UCawNOBFcFqAMnBFoFsQfMBIwFxAG5A7QCYgaIAr0HKgOjBBYCvQWUAjEFVARmBoME5AT2AVMFsAIJAwgDAAR5A1YHaQJ1B6UC0QbxBRQGMARGBMYBFwUKB4gHeAN5Ax4HXAeABLIEpwI+Bb0Fhgc7BLQHBAOoBWUC9gPTAUcEqQFqAhoCwAX/BCAFbwS3BBgCegUeA2MGZgKiBeoDwAS0BKgGcASTB54FpgbxA8EEiwXrBV4D+wNSAlEEcgL5BdcC8AVLApwGJwQ5B58BBgKuBRcGsAG+BKEExQQCBGYHBgR2BOYC3AZkA1cGzwNlBakDvQUkBFYFVQQHBXwDGwfvAz4HJAM+BcgDLAbWATcFFAIHBZ4GeAf4AqAF+QE+AwYDVwb4AuoEzgOIB/4DggX1Ak8DngStBk4EFAXyBS8H1QQUBWIF3wU8AtUEegKFBdkBoAdgBDMF2AaLB5sBAAebBLsELAXJBpgEuAelBKgGkwHBBAsC8ALwAWkDYwPhBDcCSQb7A4AE2AYvB1MCVgVRBMIE0gPlBD4DWAXXAUkEPgeCB9IBTwN6BPwE6QO8BX8CpgJiAgID8gVXB/gCYAUkAy8F/gKzBF8CvwWrAUoG+gOmBmQDiAbUBMwFqwKsBDUFpQZ0A/0EGwTBBEYCowKvBLsGgwRuBdUEtAfkASEC0gFXBJwD9QOBAkMEsAU6BlkFiwWnA7oG4wLcBNoE4gQyBL8FwgZJB5gDNwXYAWoCCAP9BOADIAY/AvEGvgK6B9gCrwQlA2MDeAMdBJYBPwWfASMEnwKHBB8ECAcNA18DUwIwB+sCKwP+A6QGIQSABKYEZgeqBq4HYARMBrgCAASeApIH/QQQB5gBJAMZAssE7QQHBb4CLgdUA3gEswIcBVAFxgfOAm4FCAPQBh4FHgaLBp0GWQZHBzsCfQXpARAD6AJcBIkEggUXAtAE0AKNBXAE4AQjBN4FqAMqB1sD+wZHBcAFXQIPBsMDTAcMBhIHIQLGBkIDRAYsApAFTQTeBG8DwQOwAZUGPwN8BWsDjQWlBWMHegSUB6kBfARWAkAGcwRRB8wE0QaoAZYF8AHyBGAEOgaBAtMDrQOwB0AEYgWLBEkHmQKABM8F/gXoAokEYwO5A0IGZwc0AzQEBgKABiUDjwX7A0cGxwIUBXgCxQeNA9ED2wKtB6UDMgcvBvwG0wHNAroDhwRBAxQF4gHvBq4COARyAuAEjwM/BdIBZQbmBmEH4gNUBN8FSgcrAxIE9QIHB2MHlweXBlcHYwNfBHcEnAS9BR0HWwLZAkoE+wUCA0UD1wLQBOcBuwbSAT4FngIIByYGggelA6UG0gGAAiAC/QRgAjwHwQJGA+wClQW/BMAEOgOoBQ8HPgczB1wH4QM7BsAFtAc3A4IFPwWaBfEC+wZ0BF8GJAK/BW4DngO/A+QEhQK+BEMCvwWFApsDwgOSBnsFrAeeAt4FUwLeBR4F3QVRA70DyATOBHMDngY8BK4EmgWyB8MBQASXBFIF+wLaBFQESQZ2BYgHDAMhBXcE5wasBMEFWQKBBe0FvgayBN0ExwWuB98DwgZxAngFtgIPBrMDgAb1BX4H+gJ1Bk4EbgVYA5ME8gKCB1EGdAbSBOcGegIjBTICeQRGAnEFFAU+BmQCqQZcAjIHpgRGBQ0DKQTGAvEFeQLDBZkD+QXqBg0HDQdTB4cDnwYlAyQHhgN2BIMCMgR/A60DaQTeBM4DXwWPAo4EzQPmBpgBkgPgApIEEgU7BbACfAOpA9gFSwN0BtcDYwURA6QDzgPMBFMC0AQNBNEE2QGzA7AB4QbcBGsHkAORB8oE2QTJAioHywFfBJ4CHwXQBFwFCgMuBPABRQUGApAGrAE5A9kBEwMaAjsGDgMVB3gEwgfCASsHjQXVBkEDowTDAdIF4gIsB64DPgXOBFQGBATLB5IC3QRdBp4G4ANUBKwB8AO3A10HagLeBCEDrATsA1QEvQVZB1MC5QVVAooFcwRcBkYD1gZDA8oH1AJzBqkC6gSuBDcHzQQXBuIDYAY+BpMH1QPgBcMBKQOWA48HKgMXBaMDdwTnBIgGWAJHBbkBVAMnBFIE3QLQBOIEVgYaAvMFlgN3BcMB4QSdA7sFNANlBZ4DWwSaA3EFKAN8BF8GcQeEAgAEiANuBBQFxgbfA90EowKVB1YCowUZAnEGvQWmBhwCoQQ+A4UFfQM+Bc4DOwcrA+EEuQKNA4gFYQewAhUEGAOZBhAD4ASuATICnQZCB/QFVgcMAzkFVQOuBboBZQNWAp0GhQLAArIDjQd8BIYGyANSBN4E+QRYAj0DHwQfBQwCSwcXAu4FlgHqBKoEywQYAv0FyQInBb0BuQfGBZcGggI6BLcEDAY2Az4DggS0B/kBUQfdA3wFgQSsBLQCAQdtA7QHpQGwBKkBYQZZB5wHdAMKB70B7gRSAmAEAAKBBCMEQwdWAoMHQAMVBdAEGQf3A78FIQQIB6gDNAXnAkEFywOzBlwCLgXGAvEGdgWaBv8BKATABEYHdgOaBX4EXgVqAqEDCANFA6EE6AYuB2MHJAKIBV4Dlgd2BbEFPgPzBT0CcQb6AxwFJANQBRYEEgYpBC4HFAIPBzACHgMCA84FJgSfBkAEQgWwBY8HzQHNBJ4EtgQoBB0HTwM+BqcDbwR2BTYG9QLeBLoB1QLGAeQEBAPqBPADRQawAmMD/wEKBgcD3AMSBzwHUwWRB/sCvwUdA9gF/wH6A2UD4QYyAnIC6AMjBWADIAQ7A2oDzwKtBC0D5wQ1A/kDxAGLBIoEfAaaBYsG7gR2BjoEEgX1AQwDBANHBZcEXAebA6wDAQNTBqgBNwb9AaYE9gEGAuQD2ATdAvQCvwFPAw8DyQQUBSUGUAX7BmoCUAdTBOEE6gT3BHkCGAWsBKcH8AMfBX0DYAV/AnAE9wVLB7ACYwTmAYUDMQR/BD4DlwZZBXUFfgTCBv4CgwQeBdgGbgTpBvAB8QV9BfcF3QQrB/ADXwRoBOIEVgIfBbsBAQP8BEMGUAMABJ4CpgQ5A68FywPvBkcDqwRLAtYC1wEnBF8EXwfXAl0FfwN2BqkC+ATDAzoFHgOcB5YEnAbZARAGQwL1AtYDdgV5At4FjgHYBMYCkQXkAfgGAQMjBdoDKgZ7ArsFnwElBV8GtAe/BMEEagKYBHYFQAa6BN0GzQTqBvMF8wbRBI8F5AGVBWwEfAT1AegDrAKiBPoD9gaqAawEjAYiBzYCrwczAgAEOgR6BIICUQb2AdYFnAK6BtQBwwSuA+oEJwQgBlgCbAYpBN0FqANRBlYCRAUWBPgGAwejB5kBiAQoAooDWwK7BRoC2AZLA1cGXwMdB1kCVAcwAnICogQAB1MEvwWqA1IEsgMiB3ICiAVIAnICBQM3BFUCgAYtB1QHwgM6B+4DjwXxAjcD2AOfBoIFHwZoAp8DHgUjBzICgwTYA9QEjgL7BqUCdgUNB4wHUQQ0BSQEVQWkBlAHzQP5BSYEVgZABa8FUwKQBbUDGwfDBNEEAga+BisF8QZCBSIGagK6B/ECDwe8A5QEeQJzBcYEzATtBn0HnANNBOUGggf6AyIGbAPpBEYE4QS0A2AG9QNlBMUEcAfYA90GzAWiB4UCiAWXBN0F4QG3BCgEkAXaBQoG4QM3B30CowbaAusFugSAB9sBcwMuAvgEBANNBVUCMAbiA+kF/gMUBZ4DmQSsBdcFzgGMBWEDxgXKAU8GiwXkBokCgQfaBHEGDwQqBv4D5AQFBBAEYQMSBxACJwIdBHEFQgNpBbIDeAfbAuYFYQIbB5UBIgQEA9gGWwQ6BqkBvQZ5AhIGqQN0BpgD2gXQBMMFCwRXBVQEswRpA18E6wOBBHICHwOkASsFxgZKB2wEbQRaBPYEGwQOBqQBIQdGAygGsQQYB/kBzgOoA5cHnQPABXkEpwXoA+4E8AQqBfkBNQVYA40ESwOWA5gDpwa5A5cEfQSYBfADCgdlA8QEEQQtBMQDqAQyAuAE9QLKBNcEvwUNA+4DgAUDBr0BaQUFArkD7gHqBNkCrAUNBFsGwgEiB5sBfwMfBSkGFgREBt4Egwc4BhYH0QPLB4UCZgcABJMG4wZ/B9sBIAJ5AtkG2QEjBXkDeAc7BN0EaQLMA0YCQQefAfcGoQNgBpUDmQTiAcwH6wOABcQEhwcHAkgFVQSKBqYEKwXEAgoGRwKMA8ID8ARqBFYG+gPaBcEC+AS/A3UGYwa/BpAEbgV7BJEGbwP2BPUClwToAsIF1QNPBpwGPgcOBKQG8AFmArABBwLuAucEqAReB8YBggVpBNAFXAL4BuIEewbIArQDewIWBwgD+ASXBLQFfgWPBlIChweHBI0FGQJjA/wCtAdQBcoHfQQxBc8E0ATbAYkCVQLEAlUCxgVxBWgHLQXHB7sEZQUrBdgGqQHiAy0GnQZgA8AE+QOKBFICXAQSBWAGpAL+BMYCMQW9Ad0FAQNbAykEzQRjA8YF8gS8BlMCRwVtBHwEjgL8BI0DyAR6Au4EDwJkBqkDEQbnAw8HowVXB6YBgAS5AtQEsAJRBLkBRQdhBPsGmAQfBoUCzAQWBO4FYAZIB+sFCgZjAw8HfALKBaQC6AN1BNIEegT9BJADyQXdA88FrQPBBHQD8wPAAukF2QGrBhYEPAeFAlwH5AFRBwkEAwfxA24H6gWPB5cBywQ3Ak0FxwPNBbMEYwUJAvkE2wMPB7kDiAUPBGUF3wP/BvABdwd2BQgGOAN2BUADYgbZATQHxQNuBf4EiwYqBj8GJwROBmECZwXDAigEDAYhB6UCOQbCAyMFrwJGBYUC4AS0BHUG2gI/B8IDyQa5AeEEEAIdBZsDygORAjsEFwLGBc8BYgYtBkYGHgUwByAChQJmAyAEVAJNBOsCJAd6BLEFnAKCBZkDnAYHAkgGagOfBuICgQSCA6wE3QZUB6YE0ARRBoYHfQJ6BUsEzwTOASgEywNHBj8FlwYUBsEGLAJ1ByQESwVzBB4HaQOsBDUEgQZABFUFvQHBBlsC+wYeAosCpwI/Be4DTwYBBLIHGQMHBfEC4QT7AzwHfwN8B/EDvAUHAp4C7gKdBI8C+AS4AmQGtAPbBioC9QLNAagD5QOBBBIEkgRVBGMFfQRCBdMEzAVTAhgFJQJKB5QEyQSkBAcHZgP2BPUCHgSYAjEF+QH4BskGIwfkAbQFAQLlBFoCkwedA7kFEALHBDICFQSWAXQFjgT2BHICaAUoBnMGFwVQBw0EJwduBYcHjAJGBWIGxwdEAmYHAANbBMMDPAYBAz8HEAJPBJcEcwWeAu4FFgLnBNkBjgK9AXIFgQXkBsEF4QawAogFwgOXBBICcAXKAowGTgP2BNUE1wSaBT0GngINBo0DAAcMAx4GlAPsBSwEXwYPAkYCngKgBFkGyQZyAvUCdwR+BLAFIQaCAlQDWwM1B94BYQeSAxwFpAEbBScC4wJCBnIHGgIrBWMD0QQsBbcFLgTnBuAD/wNMAvoFbwNoBFMEpARTApgFEALGBFQDnQSMAV4FmQNEB+YBLgXwAfYGAgbgBm0C1gX3BbsHowW6Bz8EcgT/AWYC9QJpBNwC/ATuAngH/APEBHoCDgcnBHwEggfHB5QCOQUXAiUC+gMSBn8D9gTHBKQG2QHcBYEEBQWoA+wEMgS6BigExwXgAtIEPgNEBsEEnAU4B3gHJAP3BlcCnwP9A6wENwU/BXgFuQd4ApYHlwE0BvoEnAe3BFIHnANjBOQDDAcCBBAEZgJ6ApoGVAdjAn8CNwPaBBcCUQeUA4gFRAKSBbkBgQJtBHYHgwNeBe4BdAUmBrkHFAaIBjID0wUCAnoGpQTCBmIE0wS7AVMCSQLCBowCXgWZAhcFvwWtBr0DigSvBAQFFwIMA88G9wYaAh8FCgeuB18FbAebAeAEQQRYBHUExAShAssH4QInB30C9wS0Av0EQwb4BvsGEgdJBAUHPQOSB1YFVwcHBa4H3gLcA3QCDQekAoUHFwIYBeoFeAeiAt8FCQRxB8ABgQIhBM4HWAKWBXMCZgUXArsF/AJiBCAHqgfzBTkG0AJ4BIMEggXfAz4EKwV/B2UDDgQuAv0EwgNCBgIEfAQWBFUF1QLGBiACeQRSAnYE2gRXBSQC6AKDA1cF9QGaA9IDEQVeB2EHrwNlBQIDxARtA+QEbwJpBNYFRwdeBIcEhQU9BhYHuQdzBtoGsAKbAwkEvwQlBe4GsQEMBHcEJwedA0cHkQRfBbwBrQeJBMkHqQOWBb4CygcrBdYFywSuBisC9QIgBCkGnQPSBnMCdQdKBHoEvQHaBT4DxwV4BagFTgRtBCEENQTmBvsGkgHkBDkDHwUgBNoElgPNB2AE+wbOBaAHXQTPB+gDsAZ3BZwHDAOZBk0CkgX1AlEEWANXBVUDDge1A9EDzwMDB84FQAZXAlQFxgLiBegD4gXiBPQEbwMhBukDXwYDBLsF6gXCBroDAgTRA8EHqQKyBZoG0gZGA4cExgQ1BakBEgVYAt0DtQa6Bz4CtAQMA5oGXgVdB38GwQezA/YEoAKsBd0DMAWpA6AFGASIBX8DiAWPAwQE3Qb4BpYFRAaFBXkHqQFNBSgErAb4BFEHOQOjBJsBtwYCA3AFWAJzBAoGiAc2BKkFUAO5AzgC4AWwAhAD4QRzByMEqAWCA/kDSgZTB9IB+AR/Aw8HHQKzB0gCWwPABJgHqAE+A3gFhAWjBLoGcgLjAiECzgP5AT8C9QVXBzkHlweVA4oEywP0BrAC9QLuBVcHQAROBbYE1ASPAqkC1wGQAzcDywd4AogGYwNfBmMCsAJ9BcMHggKPA/YBBwV6Ap8HzgLtBk4CKwVTA/kGQAOEBgsCIQZUBHkHUwWkB54CvwY+AwgGzQHCBdwEmgdmAqMGtQF8AlkFyQbBAgIEYAS7BYUCggfjAgQEXgThBh8FVAeeAhUG3wO0BKwGMwfyBRgHRgOQA7UEWwaOAY8FwwHtBEcGkwdmAvwEdwaDBr0CaAefAmAGWAOkBr0B+Ab5AVYC+gMhBacCuwXZAUcH9QKeBIkEjQTcAScE2wMfBsEELQaEAg0FzAIPB3AHlAcwBIIFwwFSA4gDPgYlA2YEYgS2BLMDewZSAwAEUgOXBHMDcwZSA+IGRgKFA9kBvwZ1AnUDBgNTBU8D0QSFAhsHsAaxB1UCkgYMAlMF1gUNBpIC3AN8BJ0ESwK5Bz4DRQW9AdYDzwGyBe0EOgfIA0gHyQQmBv8BRQWuAt4GkATFBLIGNgeoAxEFqAPFBh4FQAY1BLYEQAQfBTAC+QR0AucGJARCBtgCRgWXBC8HtgLNBvMF1AYSAg4GAgSuBhoCZAWfAeUENAK6BvIGwAeFAtsEFwLeBWoDpQRvBPwEwQThBvgDvwWgAtwGGwPHAz4DYgUBA1kFkAbjBtAEvwXIAacEoASvBFgCqAeFAssHYwaABsgB3wO6AsYGBATZBIoC/QOQBF8G5ANFB1wCXAdtBDMH+ALnBJAEVAbBA+UGnwRTB30DJAXSAaEFmAHaBeEBNQJ2Bd0FHgWuByQCQwU2BPYE5QPnBnkDkwRXA5UFcwM8BVUCvwZRB4EHJAKjBOsDkgWaBSMGFgQKB8YCwAXjAh4EGgI/B/UDPAYfBBIGWwKKBa4FuwUkBOQE0wNmBGQC5AQ2BFMFvgS8Bp8BOwaOAj4DzgGuBUwD4AUzAj0FNQRyBewDiAadBa0FqQWuBzYENAeABIkE/gSiBlwCEgbbBpUHzQGTA1ICowTABbEHDAOgB9YCuAXFA34GEARgBsUCxgJzAi0FOwafB/8DbAQoBFsFfQIsBV8GpAZWBm4GdAR7BHwCkwbJA/AEQgMYBQwDRwXMAu4G2gJEBdwFFAbJBMwEJARiBEYDtgeOAnYF+QPuBUsEDwcZAz8GHgadBvoCAAeWBWcH1QKCBa8FVwcnA8wHCgLkBH8DnwTIAcgCiQLEA9QCFQMEAykEpgQCB6sD5gZyAmsHUQP5A3ICHwbQBMYFlALeBVEGeAcEBD8EnANmBMkC/gSpAaAF+gU2BssDwAcBA64FZwP2BCkDlAfOAagD5AECB2cC2ASvA7oEhQUGB1kC3gKJAfQE+wN9B8IDKQSXBB4HbARTB1gCLwdeAlcFwwE+Bi4CDQUMAuUEmAMYBWsE+AbOAeQBLwZxBnoCaQVLBb0F7gJOBh8E3QVdBJYHegKwBpgFcgeyAzgEDgIvBiEGLwdCAn8GbgQiB1cFlQUxAqYGzwEqBjIEbgX6AlcFdAPgA8sEzAQXAiUFAgRZB/8EpgWFBakGcwYgB6kCAAT5BH0HhwKjBKgB2QGaBKMEzQGcBCUFiAabBSIHTgINB9cDJQZmAwwHcgINBJoFLQZABOEF2QHiBWoCSAd2BS0HyAEVAzkDkQU/AisFSgTRBBsDYgO9AdcFXwMjBY0DNgdWAkUGLwKzA6kFFQbbA08ExwKBA4sDowS9Bd0FhQK/BCMFrgf9AzAHdwXCBtkBkAUqA+QELgRiB30DZgUBA8cFMgRXBb4E2QTkA2kETwTVBNEEUQehAuYEIgZZBpcEYgXQBOIFjQGNBeUDvAURBDkGZwJlBzsDhwOzBOEGLgRXBU8GPgdTAlgCGQIOBN4GMgcNA+EG1APgA0gDvwXkAW8GtAL4BDYExwZkA84FggXQBXoCTgWgBA0H+gJPBj8EjwXdA1kFXAJiBdsD2AREAjkFWgKnBXwElgbWAt4CyQUgB5ECOgZlA7kDigKzAk8E4gSgAw8E8wWuB/ECugTXAxEE3gTmBsQEnAZYAj4DvQHcBZgCdwfgBIIH2wMgBHwFGAckBPIElANqBiwCcwXBBfsGygSTB/MFRga9AWoGYQLSBDkG+wY3A6wD7gFgBTwEAwdUA5UHrQKvAxkCXwZmAhYEGwOABO0CCgbgAeUEXALkBAAHYQdzBa4F5QFPAyIGZweJA+UDVQMhBbgD3QWVAt0C1gOaBiQEoARzBAoGMAJzB6gD0wWnAk8DeAU7B7AC6wb0BC4FKgRZB3ME8gVcAvIF0AQmBikERgWjBa4FMALaBAEDeAaKAr0DcgMHBUIEIAdWAjkFawOhBHYDFgQwBIkEVAOtBj4D3QVcAq8FpwNXBWQDHgVPBrwGgQJlB+EC7gbEA1sGpgFfBrQBHgRqBKUH+AWeBuQCcwaxAacFLQdXB4gHkAc+AsADtwXlBe0DVwTmAZkFtAGBBP4CngdVAi0DggKyA3cGuwbdA0QFcQQUBYAFKgakAvgG8wXJBg4GQQZUBHIHdgUOB9YBxwfPBNME0QR4BTcC2wJ/A+EErwPMBYUC3ASJBBcFuwXLBgwEewXTARsElwRmBREDBAQyAtQCOARjBQgHOgfGAlgFHQRRBCQF2AajAv0EnwEXBnsEjgTGAtAEKwO/BHwDNATBAn0FhQPqBB0HsgfZAWkFvwG1BFgGLwcfAhsFmQQ8BQUCTwPZAi8FcwP4BOYCAwa2Az4FsAKiBPwDggXkBWYH5AJPA9oCkAUXAkQFBAO3BQACkgQfAhEF/wObBZACpwSlA2QFVwKhBRoC6AMrArACGgKaBqMEGgewAsMErAOtBLgCSQU9AscFUAfJB/MF/AZKBVwH6gHqA+YCYAWoBSEHQwb7Bv0DfAVPBF4FpAP5A7kCpATXA50EhwL1AgMEogRqArcEuAVDBuACnQW/BM4EiwRxBs4DcwQ2AsMDaQJ0BFQE4QY8A+UEeQOGB7cFWQYSAs0H4wKPBrQF8QawAsYHPQTGB+YBSwXSA9AGVAN5BK8GjgfJBOQE3gZ5B88BMgOwBosHHAKnBU4CJATrAcQEvwLeA7ABiAJUBHQGRgaLBpQEvwVCA+EFcgJGA1YCuQV1AtcGJARFBZcBcQamBL4GuQFOBq0BYwLWA10EtwS7B4MEzQW/BSYHzAN/BB4CtAf8BKwFvQGsB9ACUwd2BcMFrgWuB+8DbQXyBPgGigKSAzgEDgYfBJAFvQGiBgACHAXiBAAH/gQ2BoUCvwP1AXsF1gIvBxoCUAcfBjUHwQVoB+gCFQMLAuoG+gP+BCIGHgfLAkEHPQNcBoQC5QRiBmMHpAPHBa4DSQYhBKMESAdPBxkDigTeBN4GJwLZBC0DdgVVA8cFYAPMBJYBWgXDAusC/AZnBz4D/wUcA3kDVgJcBncECQeJAkEHAQNCBfoDOwd9A5YFLwJIBt8BBATbATgEvQEjBX0DQQYrA+YGqQMHBb8DZgRrA8EEDQNNBQwDQgawAiwE6ALpAyUD4gQEAocHmAG3B54C3AU+A1wGrwO7BEkE9gQkA78FAgMpBLoC7QabASYHLQOKBEMEYATZAYgHmgYzB8UDFAZ/A1UETgQhB50D5gbCA1IFXATGBzICxwSPAk0FQgPmBicClQQbBP0EDAVWB9oEggWwAokHhwe0B+kD2AQwAtICvwLBBPIExwb/AokHiQX5BTkDpwbMBFAGAQIXBqUCCANyBfgGBAOaBfAB3AW7BXsGYwLnAmsDPgfMAUAEzwH4BCcCvgQBA0UFXgPDA8cDgATkAS0G1QN7BBUEngSFAmUDPgNOBVMHWQehAs0DWwIvBkADDQUwBmMGfQSHBdgC4AX8BC0HagTDBD4EuwTPBNQEtALsBCcEdgRPA90EcQQ2B6kHvgdoAroFRgK0Au4BJAXyA5cEngHQBEAEDgdABD8HvwQPB2QEnQRmB7QHHALCBvMB5AQiBjAGJAJcBB4F2gWWAUkFJwOvB9IDUwX/AUUGawSiBgwG6gY9BcYH8AH5AUoEbQS0ArkGTgPGB9QChwcwBBQF1ARcBz8FrwXCBO4GSALmBoYEowfmAfAGGgJBBcQCHwYTAhUD2QHdBYsFwQaFA+0GWwIhBd0E5walA2YH9QJjA8ICOgW/BI8FDgK8A64FMgdtAi8FDAP/BSEDtAb8AbID0gLZBCMEJwW9AZkGHgXzBakDAARVAiEF9QGLBeIEtAdVAh8D2gLBBtAG2AYHBR0HWAOhBLMCFge5BNIE/gEwAr0BGQdXA2cHfgMuBK8G3gaSBF8HEQQ4BIcEIAZXAgIGDwIFBiQEOwU6BA0HjQLCBOcDRQaIAi4E8wWoB64F5QX8AxsHGgJFBbsGNgdqBKMH2QEwBVsDqwNuBCYG+AL9BjYCsAITBHIETwS/BeIG5AZTBWIFHgNYA9AEOQX6A7cFfQNwBSIEVwVhBbAFuQFMAlsC8QWeApUFUwKfB+ABLQXmAaAHggLPB/wB4AU/BfMG5gGSB0AFQQW7BXkHRQS6BpQCqgUaBK0G2wPkBD4DJwXQBDIHIwQtBo0DtAdyAucC/wFSBeQBdgMMA4UFpAMsB9kBjAWJBMAEsAauB6IDnAQHAooC7AOXB4UCwAOTBMUEJwJVBHIDJATkAWIFlAPKBL0EtAb/A7YHBQS3B7ACJAeoBMcEqQGPBlwEywf4ARMH+gPHBWgHvgeCAqEDngH2BJwBfQbHAuQEngIjBtwBtAO5AUAEmQJ9B/0C/wY+A+UGlwRoBv4CFAW8BCQHGgLDBdkB9gbWBS0HlwQ5BvYCOQbXAVEEmASvBL0BHwRoBOYGSQS0B6QDDwY5BoEH4AKBBDcDsAQ+AzQHbAQeBUsDxAVABVwFsQW2B9AEDwf2A3EG1QOtBhADsATqBGYF7gJgBm8EmQQOBJMEogSjBKwFjweCAo8HJgI1AlgCmgWGA7kDJQN2BdAEXwaoAf4EpwNjBc0BdAbiAToFAwMUA2MGDgeaBbcFaASjBGoCMQRwA0cGXwKDA/ED7gV9BDQHMgL8A/UCuASkAUMGoALIB3ACMQNyAs0F4gVXB3YFWQewAoUGuwKvA1gCHgWYA1YFKgSHBIsFrAarA5AFxAHLByACDAaqA50EMAJ0BT0GpwacAeUGQAMbBhIEXwbBA4QECAOuBnMGBgfBBAgH+ARCBl8D8gPFAw4GmQJ4AxQEpQSmBHsHkATtBuAB7ARvBE0HKwWuBzkDgweqBFsGLAI+A00DhQahAjEH8APiBfYDVgfOAR8ElwQWBxsDJAeDBoYGYAM/BKUCzgX9AkcEvwU2B5cD5AQoBEIHdwLdBL0BcgbpA4IFAAROBo0DVAdUA5kDWwSCB84E4ARyAxEGNAJeB9ACKgR5AuEFegIOA2YC5wT9BCIGVARKBrwFRgdeBDkHaALcBtAEtwWdAtADvQFGBVgClAe7BV8H4AGOBdkB+QIEA3YFMAQ6BgMGTQaYAzYGqQHuAtAEZAW0AVYHnwMcB4EDlATOBUIGmwNrBzIC2gQUArACTwIpBp4DtwR5AqIGgQQmBTgDLQSYBMUE7AMuB0wD5ASeBeQG8wKPBcYE4gQyAt4EggPFBOsCkQS9AS4FIQOSBBgCsQWiA4UE+QMsB6oCFQOTA1MHPQPzBVsCbQIWBNoFQANfBb4BswYcAosEOgZaB+ABDga7AXUH2gOmB2ECxQR5AiMFTgVXB6wBIAVYAqEDIAIvBVQCVAY3A4IHeQKSBj4DZQSdBV0HWQI+A1ACywdUBAcFZgd4BzYGIQcpBOsFtAFsBRoEoAQhBFwFlgJkBewCcwMhBDAFEgTNBVIDfQVGAwUEBAPlBFcEVwVuA6QG1QS4B5wDpgN6BA0F5ASxB54BVwWyA04GVQSdBKMCDAbOAxwF5gFCB3kCuwWZBHAFfwOXBEYDdAPoAyIGFAKTB2MDaAROBsIGJwSGBlkFvQU3AwMH7wUWBrAB7gXGAlwGPgOoB8cE9gSpBVcHzASDB6cB5wZlBogG5gG0BYsD5AQUBtIGBwXKB7gDWwWFAwEHsAJMBtwEywewAvQGfAJ5BfgClAf1AbcFcQW+By4EnQSNA78FNwO8BicCAwS9AVcGggTPBL0F4gVWAvACNQW7BSIGXAbrApwDVAQMBp4CmQVrBDcFoAIOBkcEVwUaAqcGegJiBd0FVwcNArwGTANXBXMEMAUFArUECwJqAtkBRAYkBDYGBAT2BCEEvAWeAwcFmAMdBkMCPwR5AkQGPQXkBrcFTQZ2BaMFbQTTBFsC2wVYA2oHmAIuBXYDJAUmBssHcgKDBjUDaQV9BKkF7gJRBj4DfAWFB6QHmANHBdkBvgeXBMEFhwQYB6kBkQRuA48HJwJyAoEEbwYMA6IGlgNuB1MEzgT5AfoD2wIyA/oCpwXuA8kHpQMdB+QBOAXiBL8FPgNpBtwD+wauBZcG6wIzBiMFZwcEBIgFpwTdBBMDlAb8BJ8HjQOXBfoDIwVOBo0HggKNByACtwRZAt4ElwQfBvUCwgPeBjoH8AOuBRgCqwU5BNwEQQVRBt8BhQL5A+cGfASGB4UCmgcUBPQGOwPXBEwECAfkBCYGwAU9BigEXAewBlcH5AEfAvcBtgQcBNcExQKuB2IDsARIAn0HiwMPB8EElQciBg4HnwOgBfEDpwftBN4G2gWsBt0D8QWpAVgFtQIOBuQBrwUNA4MDoQVIBzsD4QOHBEkHkAWFB+4B7ARfB88HAgQRBccFkwZcAqwG5AKyB/UDTAa9AqEFCgYYBxoC/ASsBEkHpATkBH8DBAQwA5IHdgUKBy0DewTeBOIE/gM6BggHgQfNA+QDKwUtBwUDbQUZAn8CMwL9BEIDYgXBBEoHTgaVB9YBOQU7A9wE7gKqA3IEvwVzBOQGcwSnBuEERwaNAqUE4QQkB6MEFAWCAocEoQIOBxIEVwVoA1cEeAWABskCAgZnAvMDtwQlBpIDCQQ+A4oFyAJ3BocFbwY2B68HMwTEBJkBHAUHBGAGwQVMBokEqAQoAlsGLwJyAlADHwaMAhwFMwRXBScDDAQzAywGQAWsB1QEgAZOA8YGPQP2BsAEPgaXAU8GZgPNA6QCXwTwA0sFPQIbBJcE0gZ/A5gH3QPkBJ4FfwdfBcgFtAS7BA8C6QbhAWYHxgIeA64EYQXIA7cHJgVsBRQCsAP3BWAGTgQfBnoEngWWAvsGPwWQB1gDdQQJA2YENwNBAzUDiQMSA0oDngNTBy0EUgXhAy0E9gPkBGMDgwMNAqcE5gR4B7kBiATBAv0EowI9BlADWQYMAykHYAJMBrACzgT2A6wE1QQDB4UCDQS4AsUHnAK4B1MCsQe0AV8HEgavBuEDggfWA38GcQVmBy0CaQf9AZgF9wagB04E9gTwAVgFOwTCBlgCnQMNAyEHcwKRBI4B9gRqAgUEVgMVBGAFcQVRAusDjQJiBEYC/wI8BSMHPQNzBcABjweLBTYGtQS7BHIE1wSsBb0HeQLHBQED5gY2BbsHKAWIBjkDRQUpA7cEBAM4BzAEDAfJBscHQQPMAwQDEQYdAukE1gFpBaUDQQUhAu0GXgUlB4EDtAfcBF4FkQLNBQED5wOoA1IFLgTFBM0B+gbAAjAD4wH4A2QGUQc2A1MFPASSBOADcQaGArgHIARPB3oCUwZfBIEE1wM5Bu0EVwZuBFkHegJ7B3kEpAYZAk8CJwJeBfIBUga4BA4HzQFPA0UETAe4AxIG5wMvB8oDqAaxBFoGWAZXB84FUQc+A8cGpwRKB+gDigV9A5QHeQSCBX0DiweWAbcEvwVcBx4GqAe5AwMEQARzBVcD1gNlA10EzATVBIMD0wTkASMGGwSBBOICtweCAk4GKAJfBygEwwVnA6QDIgdIB3YDUgVGAmIGkgK3Bp4FoAfiAr0EoAJ7BQUEnwRoAiAGfwN7BhEEVQTWAr8DKQekB1ACqQShAkQE4QGeAwED6wUaAjIHzASCBQYChQc/BLUErQI7A6EDtAMDBAwHyAKwBdAErgU4BD0FoQN4B9cBnAQxAjMCJgOmA5MDnAdBA8kFHgVCB54DuQaPAkMGMgLdBJwC5ATeBE8GsAHyBboBFweeA7EHRgI8Aw0ClANGAvcE1gXxBiQGBgfqBVkHsAGRBUsCrARVA8MF2wSiBR8CFAboAukGSATOBKcDFAUHBFgE6wU5BlMCSwXZBL8FhwQ1Bj4DbwaSAmsHvQIvBTACuQSNAysFlQNABC4EVgdzBHIFdwT5BO0DbgUBBI8GAQPBBtkBfwcuB2YHRQTEBCoGwgb2AW8EfgQPB1AFUgVOBK4FuQOPBXwCbASXAyAGxQPXA0UHZgdYBtIGxgLXBccE4QZRA8EEDAN/Aw0EggUUBi0HMAJ9B/UDZwR9AvUGYQKvBAoEOwY+Aw4HPgNTBtUEUAYKBKsEWQRjBOQBCAc1BUQGOwM+BNsB6gUGBLME1wHhBBkDDAaLBPYEjAbbBt8BogWiBNwE2AbiBqkByQVVBD0FVQJLBREEigbxAikHoANPBIUDQAVJBqwHIgNFB3cFngX2AX0E5AEjBWQFkAcYA40DmQS3BMkF6wZWBv8GLwKTBQAEbgS0AkUDIwRVBXgFxwerA4EH+AFNA0AE9gbaBT0GvQK5A8ECUQStAT4GkwNUBKYDvAWOAQwH9QG9BX0ELQabA9AEHwICBt0EzAWIBWsH4gRKB7kCzwTRAUgH5gInBRcDewOWAk4F8AEGB+sFFAb1A68HdgNTBTIEvwQEBIUGhQN5BZUC0APeAlUFWwL1BR8GHQeWA3UEUAIEBFwCHQaUA9AEIwRYBcMB3gSZAZsFpwKVBakC7AQEBL4FvwFFBycC/AJVAyMFXwbeBlgDwQQLAnwEwAV4B7cFOQYIA/0F4AQkB+4D5ATlAf4FvQGAAg0CXgUMAucEdgW3BS8CKAQNAwIEcwVRBvoDQgdcA2EEKAQwBr0D8QMcAlcFuQG8AlQEYAWaBKEEuQHCBZYC+wUnBN4E7wJFBQIDpAM7BjQHXwYDB6wCYQfGAhIENQTTBNkBowVDBM8EQgRuBdsC9wXoBoIHcgLNA/oDQgXRAS8FqwTYBA8CAASWARUHvARmB/UCDwdoAuoEhQKwA2sD1gR2BfEGZAXzBdUD9gQtA5YHIwQwB38E2gY5BtIGGgKWBYMDCQSOA7wFAgM0BbYDtwQBBM0ExgKVBcECaAMYA2QFRgLlBDME5AStA08EhgMEBIkEXwbtAeQESwLGB9YFmgaRBYIHQQPcA40D4QT/Ad4CbgStBokE0AR5AwoHVAVzBoYGUwc+BGUF9gS0B2oCnAeLBLUEkwO6A8IDcQYXBXIGmgWxBzEFNQWjBQ4G5AHSBfUBAwYHBUQG6gPUBOIESgUEBMoGIARaBCoGjwekAtQGZQPIBNYF3AUEBNAEfQS1BykDKQTCAzYGzwEqBRcCzQRwAxQEuwbmBjACSgf8A90EFgQtBrgD3gX2BFsG5AHeBHwCOQdkBd4GYQK8A1UCOwcMA+wFTwKkBsEDRQSvAfkCeAMTB3gC6gZ3BcAF6gX6BksD/AUBA88F8AGIB3QDLAbbBo8HGARRBH8D3gTkAnYFVwVbBmIHnAeCA9YEGAMNBrABPwezBZgHHwRLBZ4E1ARrBOEFSgQkBygEIQXFBOcGXwNCB1UD2gWiA64ErgHhBrEFKwfwAi4H/wH2BVMF9QaFAlAE0AQSBR8CIwToAx0HbQIMA+cGCQeIAzkHqANjBzAFrgWnAwcFOwMTBAwD4gWSA9wEwgTPBOEEjwVmBMoE2AQzB84D6AO5A1EE+AIbBkIDVQXgAWYF+gOuBQwCDgbAAe4C4gImBM0DWgRXAkUDIgOSBEUExgbCBD4GFgRgBkwChQLNAdYGoQJbBLAC7wKWA/MD6QL0BggDKgV2BacG2QSIBf8BHAV2A3gHXgRRBl8ExQQcBL8EugFaAxYEuAamBHIFKwWoBbkCkQM7BMUEuwU6B2kDOQbDBD4G2QHdBhYHkQdEAvkChgSUBMgCrgToA0IHQASuBfcEHQdhA6UDRQLeBFcFjwWpAmQDVwNZBY4DggfkAdQFqgVXB04CtwKqA48G5AHPBTsGkAbwAesF3AOVBK8DCQTPAQAEfwLQBCcEOgTMBNMEZAO3BPUCXgV5BRAH0wE0A8AD9wOpAlQFwwIJBmACUgbhAwUHCAZXBy0CXgVRBNYEuQL3A+YFggfgAqwExQHFBLAC5gYNB1YHlgPNBIUCFAUqBCEGiAMpBO4BLAWfAUIG9QE+AwIEjgX9AcoHNAS0BOEEAwf5Ab0FVwN1BjEE2AQVA4MGjgNuBdAE0wSVA7cEAQQ4B+0D5wZuBJ8EXALXBQ8CmgX9AQ0D9AK0BPgCYwbJAu0FtQRqBrsFRQZABMEFCwdRB4oDWQSaAyEGHQNZBsQBkQeqBMQEVwSWBDMEfQcOBn8GpAPBBBACJgdABM8F2QHWA+ABPwY3An0FXwImByECngJbAroHqAMkBlYEiwQwA2kF0gL0BNIBrgJ4BUcHQQMSB8kEVgYeAtoGqQNGBgwCAAR8AuEDVwK4AmUDjQOuAd0EvQHIBQsEuwYkBZAFeAP9BuMDbQSaBqwGngEMB8gDDASNAx4HDwPgBJYDagQXBHEGuAOjBeYGawfRAggEDAPSBvUCcASEAr0FfgU+Bx8EQgXxAvoFkQORB38G3gZ2BR4GcQaHBywCsgbkAjQFfwO1BNQCVwQjBC4FuwE5A3YFpAeYAzEFwwObB8kCAASXAakBqQEQBBQGLQb7AS8EsAHHBqQDowTTApwHUQZuB2YCxgIHAvoDegJ3BxcGhQd4BeoFfwPVBn8DJgYNA8cDwgZAB+4BPwVjAwQEzwS/BT8E4wXeBKgFxgWlBtoC7gWwAjgGJQNRB0kGagfYAl4FXwVqBtIDxQbxA/0DnwMuBzUFmQV1BrwGbgQjBpIDYwSCAtsGTwK3AlIFVQUNA8kFvQGvBa8E5AQ4BrkHDAMvBvkDlQZTAv8FiwWIBtkBHgb/A24HUAIwAz4D+wUnAqcF+AIkBqwBaQIeBWQFjQOjBNYCbwfdBGsHJQMbB48EXgWFAvsGPwRrB3MCtAZXBZ0FpAEKBoUCkQTnBHgGpQJZBssBewZEAnsGKwUdB7ABOwViAgoEJwRuBxsE4AThBG4FEwNmB7YDWQYgBPgEIQJVAjYCmwcPAmYFWAVXB30EtwWMAvIEVgLhBaYE8AaLBsUGRgZCB3kCNgN9AuoEawRqBg4D8AREAlECqAN8BOQDNAZjB2QHZAOWBeUD8APNAcgDBQIOBqYEvgSCAngEugHHA2YEmwSDA4IFlwEyAqkBDAOfBaIHbwMXBc8BEQXQBNoFmASPBQEDMAVVBXYFJgPTA64DxQfCAxAHPgP2Bi0GrgfqBIgGrwUUBpAEywTtBgMHmgKkBnIDvQfABSIGSwTuBiAGPwYkBCMFBARQBHECQQUiAjQDfwK6BCECvgfQBBAGwwNMBjACoAOUA/oFNALkBHwCPgVEBOEERgOqAzQFcgejBckGDANpA1gCEgfiBMsHGwQvBQUELwdTAq4F7wGsBhgD2gVfA44HsAKPBQgDZgUnA/sDjAacB2MCcgKvASEHngL4Bp4CFgdbA38DDgSJBHwDzwPRAw4ElwRCBs4EvwXmAsUHjAL1Az4FnAceBUcHigKsBKABwwGBBHAHvQGLBwEE/ARVAtIFlwFXBWIF0QYyBQgHZgJnB+EBUQQMA5UFwQToBcYCbgS9AUQH/wGlA6gDYAb1Am4DuAQUBRoCcwXeBOUEnQROBn8COQXQBCkGmQQ4ByEDLwWfAX8GYwI+BqcClwQyAqMEAAImBDkGUAZvA9kDsAQ+B84BNwaqA28GCwKXB4sFFwbQBDgGGQThBPwD5ASeAj8HjAPiBBMDnwRNAogELgPVBNcBDAJWAnEFBAR8Bn8CZQMCAyoGkAMHBc4E1AUWB4cHqwTcBDMDBQQqBFEGvgfEB1cDVQbbA7oGtAHBBOgCBwW/BcsHuAJ6BXoCjgI+A8AFiQTLBLQE3AQfBPgGPgZzBz4GDwdlA4IHbQTWBn8GrAfgAlgHiQTXBLEFIgeLAV4FsALGAwgGrgdYBqgHpQKFBT0EUQcaAscFsAJJBCEGeAd9BBIGAQMeBq4CngYTAykGnwSXB+EDZQUgBTsFeQIuBRYEUQauAwAEdQNNBnUFogZRA/EDNwbJBksCjQP1AisDpQL/A38CDgd4A+0GZQM7BLIDdgRGAr0CQAMLBJIC1ASIAy0FJwWPB80BTgajA7UD5gFDBvoBXQeNA+oE7QL/A9IF1gU2BPEFqgOMBukCUgYmAsYFfwO9BcMDRwbJAvgEBgVfBf4DxgZtA+oDmASyBP8C7QX4AcAH7QEXBYADiwWFBagHrARWB0gEUwTjAzoEowG3BD4D7AVcAnwFqQIOBuEEWgc2BskGLwTkBMIDqQWaBUIHqQH8Bn0EQAYeBaoG+gNOBakC6QapAVkH7QOTBqQEPgfSAXYHoANdB6QCvQMQA3QEHgVYBs4EPgZjBqAHuQPaBJgDRAURAvICogVRB9kCBwVyAlsD5wLQBFsDlQQwBB8G0gKWBPwEoQX1BQoGZAWvBjcDkQNVBlQHGgPFBL8FtAfuBSwHngO9BYgDOgSHBLwFOAJrA94C+QI5A3MFVwIABFMC4gUMAhoHsAKvBy0ExQVRA2kDDQKHB9ACYgcpA+wEgAOpB6wCsQSGB5cH3gTgBCQEXAVXAhEFwgRfBlMC7gX4BGYFUAW7BToCEwfJBjwHDAJ4Bb0FNAc8BNUEcwSwBvwBjwY2Az4F8wF9B+0ELwXwA0IF0gGoAx4FkwZ/AuIEKQJ0BHgD2wONA1AGqQHCAT4GVgZVAsAH7AMFBAEDlwZuBXMH3gScBoUC2gSRAygGJwSPBz4DIQXkAUEF0gaFBxAC4gR8BRQGYQPVBuUEtwdrBFAGXwR8Bb0F8wUmAm8EzgLGB7MFywckA9wGSQThBP0CxATkAXsHXAS1BHYFHQc7BcoFlQQ6B70BVQVzBPgGngLrBfsE3wWqAs4EFgfLB9MEbAWNBWAG2ARQB9kBpQJYArUDKwdABwwGngYfAmMG9QIkB1EDPASZAbsEwQKaBZkDawewAvsGUwKSB50FOgabBKAEBwVSBjICAwdGAtIDhQJaAzQDqwTFA30EiAeuBysFqgWBBKMEEALXBL0BFgfZAR0GSwNmB8oBmQWwAngDWgIkBE4DOgYHBXMG7wKoBiYEKgY7A7oEdgN9BJwE4gQ+Ax0HJwNlBOABPAXJAyAFvQGlBsIF6gXjAh8EQAKEBcgCFQMBA6oFBgPnBAYEsQT1AtwDHwT7BdIDKgXGApgFpwRXBhgDUQYbBF8FswO9BXMEuQVyApsDQAUMBs8DvwV4A+oFzgU2BrEDwgbTBL8FQAP4BHMCqQcUBZQGfwJlBWYD2ATzAvkESwIPB0wC3gTqBHAHEALVBHICzwTNAUEC6ALjBkIDNgb+AkkHuQP2BHYDyQWTAaAEjwV1BsADcASCAn8HtAM6BKMC9QbCA+QGYgV4BbACjwRhB88HLgKyBbkBsgOWBMIGawMiBFsCcgXgAf0E+gL2BNsBDAeZAk8GHQRYB3MCBgeaBaIG1gLyApcBfwYGBFME3QQNB5gD0ATNAXgEIAJRBoECzAUmAioGUATcBL8FxAfhBEoHqQOKBDEDcQYZBNwEWAJcApgCCAewBL8FAQMWB60BXwd4BGAGyQKKAxoC2gVzAwcF+AJoBqcCkQO2AQAE8AKeA4EDCQScAWoEpgUpBlgElgSVAbACTALhBKMFPgdPBogGzQEVA54CZAVVAq4FhQWLB0YCjwKeAt4GTwIpBaUB6AZwAysH1gUdB+oFUwc6A7AFngLXBUIHVwd3BXMGvwHfAmcCjwY4A9AEpwLJBV0CeAP+A3EGjgH5BPUCnAS/An0GYAZ5B/8B8gSoBDoGYwPLA70BZgUSBAAHdAOPBvEDkwTDBF8GGAQ+BiUDMgXmBlEH5wKbA30DKgTIAewFYwKRB5IDsAYKArMExANKBn8C5wMOBIsEVAMWB2kDuAMnAkMCGgL1BV4FvwVjAl8HCgR5BJYCJwWwAlAEggOBBNAFVgdTB2EHawKCAtID9wSwAtICgQJlBUAEhAV5BH0HNwM9BE8DFwfvAsAFGgKHBc4BGAN+BCoGkAPoBkYCMgNfA6IGIgItBL0D8ANwBN0EFgSDBzsEqASzApEH8QMLBAQEpATkAaAHHQdmBz4DIwZjA+QEQQUGBi4EJgXzAfYEyAPzAwcCPgOVBL8FnQTJBjQHrgdBBawHIQJmBKMElAYkA/gEWwJMBsQBcgIoBnUGXwXhBT4D+AZDAqsEcATMBOYB0gUuAhEFOAOKBLsFyQY3A+AEywTDB3kDjQUrA78FWAPnBpoFZwejAdUFPwThBA4C/gbYBJMHuwUABpgCVQVxApIEXwRdBrwFcQe5AdoDFwIqBtwCxQeFAlEHmAPcBVkErwaOA8sHWAKLBaoBXwSVA+UEZAS7BvkBKQJZBXAGZgXHBr0FLQawAbUHTwS8BZ0EngY5A2QF2QIMA6oDSgYrA0MEqwF2B9gDsAcNAgQEqwINB4IEjwZgBnQGtgJOBfADDQfqA8MEBAMQB6cD9gQfAlMCdAOhA6MEVge4A5IHiQRuBaIG0gYaAi4FJAUwBh0EggcaAt4E8gFeBt4DVwRmAhQGowTRBP0DGwTrArAEngKZBvUD6waeAlAHHgIUBmoClAbdA6kEpQLFAr0F0gW5AaYE0AJGA3sCzgOZBMUHegLxBfEDmgQyA24FLgUpBmMD4gTKAQAHaAIbBo0ESQevBh4HtQGvAwED+AYuAhsGHgKwAhQEZgQAAvIEGAIxBy0DYAWMA94DlQI+B9ACkwbEAlIGzwMxBL0BKAd2AysFAANXBLoDVARRBPQE5AGrBsME0AS2AR4FawS5B7kBvAayBmkH2gTkBP8BrgePAvwFxgFaAvkDrATZAewFxgL4BosFDgZ9Aw0FVQLzBdkCIAaZAUQC/wLwBOgCUgfDAXMHxATWBNkBQge3BQoHWAJjBhcCRQUZAsQEcgM4Bq8DzwOpAf4EFwMDB1MCrwWRBEAH5AFEBXYFhwZABOQEOATqBcQBkQLuAo0H+wNlB7oEDwdzAqkCdgWSB3EFdgU+BIYEOwVXB6QGeAeIA+gDuQScBo0DAwfCAUUDTQZjBn0ERAZbAscFnQNOBUwCzAT+AzQG6AJJBnsEqQRZBZoF4AEHBVwCvAXEAusGpQOLBpcCkAVEBL8F9QLLB74CKwfNA6UH0QTgBPMBcQaUA7ADIAIlBRcCxQLpAaMDLQT1BqgCngY0A9gE2QQPB6sCCwShAyEGvQKuBroEvgRQA2IGrAIAB38CiARiA4wD5AIuBr8FUQcnBEoGvAYfB5sB5wF8AjwFNwULBqIE1QT/AXsCMgXpBbQBvwUnA0wG5AHuBVMC2AYSBE8GHwQxBZECfQeHBCkGjgEgBDsFSAY/A6IGKwWABT8DIQXZAdcFTgLYArgCzgVjApcFZAWvBQID1AagAacEsgMCBPID+wanARQF8AHdBQEEUwXVAf0FNwI+BZcE3gRnBOQEzQGhA2YDFAXJAqsFPgNHB2MDHgTmAtMFtwETB8MEAAcoBDEFbAQiB90GGAdfBA0HwQTJBwgD2gZ/A9AEdgNoBsAE3AQWBAgHDQcwB6ADFwWzArwFsgPNBAwCsgcTAh4EsQTvBsEEDwZwA1QEoAeoB4UC7QZ7BDYHbAO2BVYG7QbBBFgHkQJxBvwCwQSJA18EyQUGBw4C3wMMAgoGswTdBKgBFAaNAwQE3AGHBHkDeAS9AW8GxAGhBA8C1ATVAnEGpQItAz4D3gQmBGUFKQLHBegDTgWwAfUFBwIVBuIEFgfeBHsHrAO5Ay0EBwXABXAG/gU2Br0DXwewA9kEEgdnBwUDYgOnBM0EFwLeBp4CuQeeBXsHxgQhBlYC4gXWBMIG6QKzBhwDqgNtBM0HlwEUBRgCFwb+A7gHNwRXBKkCcAPVAxUEAQMNBiMElwRWBgMHVQL7Bl8EJgUWB7QHYQNxBqkC9wVgAwkEGwOMA/8DOQclBeQGVQPLBocFewa5AmMDogGCBZoDWwYFA/gDoQKCB2EElgTCA5EHTgIeBFsDuwaaBMIGkQO5A6MBRgKdA5gFywOBBzICAgM7A7sEmAPPBXwDAwdiAscEqgRlBaYE8AX5ARIFCAKSA8sCOQTRAdwGrAESBWEEsgZ8AnUFNwV2Bd4EsAX2BvgGnQR4B70BRAY3BLIGBQRBBdIBMwNSAjUHOAYvBwYDfQUIAvUDAgRUBeYBmQYMBMcHegLiBb0B2gRxBsYG1ATXBDkGZgc+A74HWgTdBLAFYQf2AeMGFAZQB7cCfQcTBBwEYQOvBcICUgb+BIEFJwLaBIUC5gZeBQ8H9wK6BAoGIwa9BUAG8QFuBWoCdgPZAfAGGAIABBYCpQP4BBAHowL4BP8BmQUEBGsEZgWPBqQCVQPQBCIGBARJBB4FOwfuA80FEgTTBoEFHQa9AfUB7ANgBiUDtwWuAvgETwOPBx4FmQU0BOEE2wE9BUUE5ARbAh0GLQMUBsEDOgZqAqADaAIfBJICxAR0AyAGGgNXBZ0EwAWcB7YHBQSWBskDeAfxAuQEdwKnBd4EXge3AjAFSQSxBPUCxAc3BjwHPgM3BfUCkQP+BEIGPgOrBtkB8QaYAocFvAUvBgIElgYnApwE4QRfBgQEUwSxAs0FVwacB7QCQQbOAXoCsQLLBxQGBgfkAkUHbAPeBlUDNwVdBXwFoQPqBZcFqgVABeEFpASnBYIErgcFA8UEDga7B00CuwSRAowDGgNfBl8EcQf2BBcF3QUGB68EXwd5AsUDGwXxBfsDFATlAk8GnAHvA04ENAZXBCIFTASCB1kGMwe7AZgDLAU3BjIC/gOPBJwEqQE5BxgCNAUCAyAHaQKmBZ8B9wTZAYQF2QFTBv8C/ASuBdIFJAUpB/sDwAeFAscELgIvBTkDUwZ8Av0E5gFkBfoDFQZaAh4HtgOcB0wCsAL2A1sE1wGFAu4DNAavBMUEmATWBCQD1AZRBMYGiwSRB9cC4AUVBJgH2QEEA9gC8gSBBCwHTwMPBysFVwfvAm0FXAJEBYUCvwWkARIHHwU3Bp0GogYGA8UHOQVXBkAFHgfZAR8CmwJRA9IDxQerASAGQQORB70FjwawAo0DVgLDBeoFlQf7Bi4HcwacBycC6QWaA7IDtQP4BHsC0ASvATwEmgJqB6MFOQZ1Bj4HHgW4BqIBuQePAvwCfwKIBY8CPgZ1A6YG2QQDBxUCKAJOBrcH8QJrBMAD5gUyA7IF4AGuBhkDUgcNAkoHWgTCBrQEPAXVAQIGcgK0AnkCdwdEBJMEowU3Bi8GTwbOBCYGJAX2BWEDtQNYBe4G1AKUAxgCOAdVBCUG0QMgBx8ErgdXBKEEZge8Bw8GOAbIAc8DzgXPBb8FHwYtBUIG5wNlBSYCqQLEBC0GOQd5B0sCWwTrAVEEQARUBFoEugYgBB4FPwLSBsYCQAboASQHlwIYBSgDRgNzAmAFnwFSBV0EmQZXA94FqQGGBoUChQZcA5MEqAN0B+sBggXDAZIFzAF8Al8EVgdmBTgHVgLFAhsEQAW0AqAF3wNHBF8DRAapAwYHkQPqBtkBRQWlAsIDtgOPBvkEoAbNAbQD4QF9BTkDNgaWASwF+gOuB+MCOgUjBN4E2QTgBDkDWQSpATUG2AFGAyQDxwfeBDUHLQOeBSsD0QSaBfMGpQN7B0kGOAf1AmsD8QKeBmAErweVAogHggSjBOABEQWwAQ4HMASaBJgCYgXGAq8FlgONBMUEVgeqBHEGswMhBfAB5ASfBLgEAwNABTEElATCAkwGfwMoBmsEHwY+BssHbAJWBsAE2gTbAzoGOge6B3IG+AZgBaoHpQFYB0gC+AQVBKgG3QOBBuwCEAMiBqsGTQU8B1EGgQe9AQYFuAXkBb8D1ASOAYIFsQKYB+gDzwXNA2sHpQQPByoElwfaBG8GBgTdBHADhwRMA5IERgRPBMUBzQWwA6IFhQKSAr0BqwNEAvIE7gGsBd4Eggd6BCEGfQQrBdAEWActBuEGPgU0BwcF6wZFAwIE2gL1BdQCbwbmAkEGawIaBFgCAQORAqwEBgLzBkwCSgcbBLQGWwPmBscEXwaMA2QEKQP3BDICzgdnBNcEKgO8BdoESgdYAjcG7gH4BDUDLgR4BL0FeQd/B0ID+wUNBWMHhgYiB6MFFQasBS4H5AEVBgkEvwV1AnID9QLbBBgHOwfkAb8GqQO3BIQE1gShAyIHdgO9B1UFVwenA9gEXATLBBwFFQYfAlcHDAPxBWkE+gXwArEFAgMvBc4D4gVZBZ0GwAWwBtMBxgZ7Ag4HIgY0B18FeQefAZ4FRwTdBOgCDAb1Al8GkgSYBMgDbATEBFcFvwLWAqwDJAf5BHgF2gUiBs4D1wX8AiIH8wIXBZQCQAYmA2MEqQEUBrkDPgc/BKgEAQMfBVAEqwQUAtkE2wOCBb8F5gbLA0wGvQG8BaUDjgeCAk8DsgTEBLkDuwRTAqkFGgTkBPkBUwIvAlYCKARiBVsCQgXrAnsEhQLJB5gDZAUrBfAFuQPiBJUCoQRPBsYGIgbzBvADLQZnAjkHiQSCBy8CHwSqBb0FXAIoB+AEtAe7ASkGvQE/BUIDDQYJA0gD8APxA40C0wTLA+sG9ga1ByYCIAfbAtwCswIPBoUCXwbyAUcGBwNqBr0BOwWJA7gEiAN4BdAEkQd2A4kFyAPWBuUCzQWNA2kEggQTB1ADKQRRA+4FdATFBHMEKwUSA1kEfwLGBqUCYQa7BssHAQPOAxQGiAdmBUkGAQeZBysD+wbBAioGTwOxB2UDvwWJAwUHlwR8BvgDaQS9Aa4F9QErBfABMQX7A/QGDAT6BLQBCgPSBZ0GgQS5BBUDrgMnAtsEbQSPBhACwgdCBlkGcwaEBnMEmgb/AVUGYwOvB2ADtAd1A9cGVASPBnAElQRYBKwH6QRFBgECfQWpAWYHAQQtBNgDfQeoAXYFOgQwBzgEnQT2AdUG6wHkBM8BywU9A+EF3gRxBnYFhQU+AzAFXgNlBzEEywf2Aj0FrgW1B2sE1wWBBKcFXwPBBh4FpgaJA+sDZgUdB/wDagdpBBQFMATkBHYFzwXTBNwEDAOmBP4DXwZ0A+wDegQVBb8Fiwf9AsYH+gF7BD4DlQYYArcE5wGKA5oEvQR9AzwFFwKLB2ED4QUhA/gEaQILBdIBegXQBJkFaQMuBNQEGwegAzQGlQKwAqwFxge/A7QHIgTEBMMFZwcrA8ADegQOBo8EtwaaBa8FDAPFA4cElgb6A3MFegO1A7ACgQNVAncH9gLBBb4C9gIyA3YFBAQ2BycEtgfGA6cFJwOzBtcFiAeLBG4F9wLgBbgFPgaXBNAEDgUWBnoCfAVdBKcEQwLOBmUDewRTAvYGmAMWB3IC+wbNA9UEeAWkB8ADQwQBA4cFCwTdBN4G8gbUAjwEJAT/BYYEOAV8ApoFHQSmBGAEmATOAx0GzgGZB0sEcwc9A0IFjQO4A/UBcwRuA50EuwYmB8gBNASzAn8D6ANpBQEDMAfDBmUHxgJLBQ4D/gQrA60GVwaGB9UBGQZGAsUD4AEtBEQEWATFBQ4GwAUjBkECtAPZAUIGAQNvBuAEzQWeAi4F2QG1B6kBdgcpBC0H9AGPBR4CIAf+AuQEygHCBhYEHQb1AQYG5wIkB3QEvAWwBIIHJwPpBGAGOQcFA1sG5gK2BwQEewV5A14EjAUqBj4DPweRAuQE1gOMBSsC3gSaBqoHfwTOB+oFtwdfAzAHRQRXBaEDTga/BZMHTwPqBp0GIwfwAaMFqwNFBQwCtQYUBOsGawRWBkAEpQZvBlcHpwIZAzgDbwQBB48HBgNNBXECzQP3BFgGBARIBEIGtgZsBMIHuQPDBCsF5AafAXIHZQNoBK8CkgW9AfIEawTIBV8E7gUfAwMHVALKBg4DiQW9AR8CywLEA4kD8QPkAUAG0QHOBXkCRQWjAoQE1gNjBgID+gU3AxIEAQP1BcECJQVPA7UEaALTBb0CwwfxBvwGVQZFBzkHYwe7BZoGtAGWBNYDmQRjAj0D4gLyBK4FMAe2BM8EkAMoBhQC1QYnAm4EvgOHBIMEugYJBDsG3gRzB6wBNQX6A1sFqQX4BjQHVwcGBNAE0wVzBlEGCAdwBUMGVQMdBy0DHgV/A1gEewThBKwBvQGwAqcFeQNSBLQDlQc2AswH3QUhB24FvAZ+A8UESwIeBCoFcwalAiUFhQX4BpgDRQY6B5wHoQNUBOcCkAOwAl4FqwM8B0UDqgPWAhQFDAItBMYCVgV/A1YG8wNRBmoCKQSeAi8GrwR8Bj8DmAXdAhQFcQOyA3wEYAYXApAFEgNHBg4HVAf6A6IG+AKWBYEEkwR9BE4FTQN9BPYFJAb5ApEDzQPaBF0G6AawAc4DQgNEBd4EBwZYAiEHFgTBBh0DKQTSAgME0gTGBloCuwK5AwwGowQiB5MCxgPoA5oGKARCBasDlQWoBMwEOwNMBGYCZAZ8BmMHzARABeQCtQToAscESgZRBj8FpQaSBMEESwTUBMgEAAeRBsoGegJcBgcEswRjAxQEfAJIB6kDfQUqArACtwEfA2EE1gR7AtIGYAS+BE4CpgT6A6QHnQbUBigE+wUUBbYG1gUwBoUFLwf4AiwFaQVXB28DFQQaA30HOQUiBo0BowTwA4gHIwV2Br0DgQQgBNMEHQRPBrACbgS9BW4HngK8BYkExARmAnYFWwPRBDcGmgayA+EEZAM5BqwEXwcyAqADugK6BsAFqAdyAisDJwRZByMEWAbkAeIFuwVaBgwD/gTGBFMFHAKdBQoDrARJBngHUwLkBNkB+QFJA0wGOgIHBy8CPwMrBaQHDAb1BooD2gNEBKcExwLdBPkE6Ab+BFEHSQPpBC8CUwLEAXAEagLZArwGSweCBb8FKQZRBv8C5QSoAyIH6QMUBc8D3ATgAmcF4AFFA4oFVwc+A4cG/QFqBkYCegQ9A5AFFQL0BIUC4gQuArYGiwIDB8MCygVcBM0FCwInBHkCHgY0A10HsQT2BAQEmwQmB4cHHgZXB6UBzASdBNsG9QLQBPABjAV/A+AEUQRDB30EDgfBAs4FhAMTBF8D3QXZAXwFtQSHB7AC1gKLBd4FfwKUA/kCtwXjAtwDZgOCBeEE9gQYAuUEKQPqBJ4COAX1AWsEtAJgBaEDWQdUA44F2QJ5B08CvAa1BK8GyQL6BYUCkQX1AtkEsgPbBnIC/AO8BVAHVwPhBZAErAQ3BJoEBwX0Bs8E4gRGAxAEDQM6ByUDpgfVA3EG1wTiBAQEIQTjA1QEyAHhAwwD0AQKBhYHDQPLBnoCZAXcA7cG+AM3BIEC4QNpA5IEsgNgBhYHXAfZAogGvQEhAsgBfAOkAwoEegQkBeoEQwaYAfkF2QHeBT4DQAZcAtAEFAMqBlwC1ALmAakFvwLTBpcE8QY8AsAE5QHDBzgDfARPA7cH5ATQBT0F9AY0BJQE9QaUB6gEZQUlBsYH9QJIA14EyQZmBNsErgXHBekD7AOJAogDrATuBeYCuQagArYGDAOvBQ4DiwVCA94FqAMkBVcG6gZuBbEHqAFSBTYDFgTSARsEMgNzBnADIgexAQoG8QMNB70BNwX6A4oFGAQ+B8IDyQXwAdIGJgZ1Bj8EogTmAcYFvgS0B6MC6QbZBOEEUwVyBw4DKAXABfMFJASeBFQEdwUEBOIENQQuBckD/wPkAdsFEAK/AxwEfgTNA/wDyAHTAXgHjQfsAcoD2gIeBpUDpwNTAlkFlQLABPwCEQUWBPMFJwVUB54DhwRTAlwFBwS6BzcDbgW3Ba4HsAPcBPEDXwSYBTkGMgWJBwwD+AavAw8EVgK+ByECKwVgBUMGAgN6BUwCfwPnAeEEqQKFA70B3QY+BEEEHgbJBgEDRQZ9AykEcgSlBFsCIwVOAwwHNAPhAwUFLAc+BiYH9wM+BpoFpwZmB2kH5gK7B54DOgTlBGMH3AI4BNUBbwZ2BTAGVwTFBEsDtwQzA+kFWwTLB0UEOgbSAWoCbwQSB3kDhgYgBaYFzQEKB2QDdgWXBKMEMwRRBMMD6waEBTkGaQR0BLkBtQQjBrIHRAP+AzsDqwSpAS4HFwKvBXoCHgbbBBQFHwJWAh8EQAb1AmMErwM+BBQETAawBqYHigSPBgEDDgftAv4EFwW8BfkBmAIkA3AFcwaABk0DVgZcBIIHuAJ9BcAC4QRlA5sDNgRnB3wDgAckA7kG5gO7BmID3gTPA9gE3gQUBQAELQSdBjQH8wUiBlwCRQb1AWoHRgLnBHoEUwcOBegFsAYyB6oDggeQBPIEVQJZBccCbgXDA68HwgWVB4MDDQcgAikEJASKBW0CyQVEBFkERAIoBJcEPgZVAjgD7QSBB4UChgMyArMEmASwBFQCEwS+BSsGtAQWBzMDyAOHA0YHcwRQB3ME3QXmA1sGHgXDBVYCRQW2AwAEngTABC0DkQaOAaQG+QRmBxgEFAWdA7cFPQINB9ICDwN/Ar0EJwR3BbACXQPSA1kHygTbBKAEsAf+AvYESQPpBfYCggfnAz4EOwZ4BlMCRAa9AZIHkALgBhYEOAW0BGUFWwS6BjQDCQTZAcUDuQO+BH0D1QXdA7wEBgLFB0kETwR2BR0G+QFcAq0BiQdaBIEE8gZaBxgCKgZ6Ah4HOQbYBpICaAT8A/YEPQL5BJkE2wbxA1YHEQTqBTYECgayA1QElwTJBr8BgQK4BPYE8gMNBBYEXAbHAokEjQOHBysFQAY1BCkFJAI9AlkFkAdtBC8GuQPpBdwBFQMKAysDuQGeAzEFMAd+AqECRwV2BRgDmQW+BMoGjwRcB6EDqgNCA1kFQAUfBtkBLwKdA5UG3QQPB9kB8gXmASMFlgKvBXME/wUDBGME/QTqBWkCuAWFAgMHpgP1A34DrATwA5AFHgY5BlsCSwWmA4EHWgIlAwwCRQOIA2wHQwbVBooDLAQtAoAFjQM+BqQB/gTZAVAHXwWsBz8DpQbOBR4GugGABJoDPQUGA+kGHAOHBCEDxQRzBPMF9AH2BGsC0QObAc0D5wLgBC4CiQWJBE8G+QJcB4UCiQS7BLwFrwGUA5cDvAZUA24DPgN/B84CvAVYA40HHwSBB70DVgeGArwFjgO0BAAEuge9AVgG8QVwBtsDDAcEA3MEugHEBJ0D9QUzBEUEBAMHBeYBDQbKAvMGHwXWBWgC2QKmA2YE","modLinks":710,"nLinks":15000,"groups":{"k":[1,2,3,4,5,10,20,30,50,75,100,150,200],"g":"AQIDBAUGBwgJCgsMDQ4PEBESEwAAFBUWFxgZGhscHR4fICEBAgMEBQYHCAkKCwwNDg8QERITAAAUFRYXGBkaGxwdHh8gIQECAwQFBgcICQoLDA0ODxAREhMAABQVFhcYGRobHB0eHyAhAgMEBQYHCAkKCwwNDg8QERITFAAAFRYXGAEZGhsBHB0eHyACAwQFBgcICQoLDA0ODxAREhMUAAAVFhcYARkaGwEcHR4fIAMEBQYHCAkACgsMDQ4PEBESEwABARQVFhcAAhgBABkaGwIcAAAAAAEABgEHAgAFAAAAAAMAAQQEAgUBAAEDCAQBCQIAAwIAAAAAAAACAAMAAAAAAAAAAQAAAAAAAAAAAAEEAAAAAAABAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="},"hood":"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","terms":["9+0 Non-Motile Cilium","9+2 Motile Cilium","AP-1 Adaptor Complex","AP-2 Adaptor Complex","AP-3 Adaptor Complex","ATAC Complex","ATP-binding Cassette (ABC) Transporter Complex","ATPase Dependent Transmembrane Transport Complex","Acetylcholine-gated Channel Complex","Acetyltransferase Complex","Acrosomal Membrane","Acrosomal Vesicle","Actin Cytoskeleton","Actin Filament","Actin-based Cell Projection","Activin Receptor Complex","Adherens Junction","Aggresome","Alpha-beta T Cell Receptor Complex","Alpha-ketoacid Dehydrogenase Complex","Alveolar Lamellar Body","Amphisome","Amphisome Membrane","Anaphase-promoting Complex","Apical Dendrite","Apical Junction Complex","Apicolateral Plasma Membrane","Astrocyte End-Foot","Astrocyte Projection","Asymmetric Synapse","Asymmetric, Glutamatergic, Excitatory Synapse","Autolysosome","Autophagosome","Autophagosome Membrane","Axon","Axonal Growth Cone","Azurophil Granule","Azurophil Granule Lumen","Azurophil Granule Membrane","BLOC-1 Complex","Basement Membrane","Basolateral Plasma Membrane","Beta-catenin-TCF Complex","Bicellular Tight Junction","Bounding Membrane of Organelle","Brush Border Membrane","CD40 Receptor Complex","CD95 Death-Inducing Signaling Complex","CMG Complex","COPI Vesicle Coat","COPI-coated Vesicle","COPI-coated Vesicle Membrane","COPII Vesicle Coat","COPII-coated ER to Golgi Transport Vesicle","Cajal Body","Calcium Channel Complex","Cardiac Myofibril","Catenin Complex","Cation Channel Complex","Cation-transporting ATPase Complex","Caveola","Cdc73/Paf1 Complex","Cell Cortex Region","Cell Projection Membrane","Cell-cell Contact Zone","Cell-cell Junction","Cell-substrate Junction","Chicken-wire-like Collagen Network","Chitosome","Chloride Channel Complex","Chromaffin Granule","Chromosome","Chylomicron","Ciliary Membrane","Cilium","Cis-Golgi Network","Cis-Golgi Network Membrane","Clathrin Adaptor Complex","Clathrin Coat","Clathrin Coat of Coated Pit","Clathrin Coat of Endocytic Vesicle","Clathrin Coat of trans-Golgi Network Vesicle","Clathrin Vesicle Coat","Clathrin-coated Endocytic Vesicle","Clathrin-coated Endocytic Vesicle Membrane","Clathrin-coated Vesicle","Clathrin-coated Vesicle Membrane","Clathrin-sculpted Gamma-Aminobutyric Acid Transport Vesicle","Clathrin-sculpted Gamma-Aminobutyric Acid Transport Vesicle Membrane","Coated Vesicle","Coated Vesicle Membrane","Collagen Type IV Trimer","Collagen Type XI Trimer","Condensed Chromosome","Condensed Chromosome, Centromeric Region","Connexin Complex","Core Mediator Complex","Cornified Envelope","Cortical Actin Cytoskeleton","Cortical Cytoskeleton","Cortical Endoplasmic Reticulum","Cul2-RING Ubiquitin Ligase Complex","Cul3-RING Ubiquitin Ligase Complex","Cul4-RING E3 Ubiquitin Ligase Complex","Cul4A-RING E3 Ubiquitin Ligase Complex","Cul4B-RING E3 Ubiquitin Ligase Complex","Cul5-RING Ubiquitin Ligase Complex","Cul7-RING Ubiquitin Ligase Complex","Cullin-RING Ubiquitin Ligase Complex","Cyclin-dependent Protein Kinase Holoenzyme Complex","Cyclin/CDK Positive Transcription Elongation Factor Complex","Cytolytic Granule","Cytoplasmic Dynein Complex","Cytoplasmic Side of Endoplasmic Reticulum Membrane","Cytoplasmic Side of Endosome Membrane","Cytoplasmic Side of Lysosomal Membrane","Cytoplasmic Side of Plasma Membrane","Cytoplasmic Side of Rough Endoplasmic Reticulum Membrane","Cytoplasmic Stress Granule","Cytoplasmic Vesicle Lumen","Cytoplasmic Vesicle Membrane","Cytoskeleton","Cytosolic Large Ribosomal Subunit","Cytosolic Small Ribosomal Subunit","Death-inducing Signaling Complex","Dendrite","Dendrite Cytoplasm","Dendrite Membrane","Dense Core Granule","Desmosome","Deuterosome","Dystroglycan Complex","EKC/KEOPS Complex","ER to Golgi Transport Vesicle Membrane","ESC/E(Z) Complex","Early Endosome","Early Endosome Membrane","Early Phagosome","Elastic Fiber","Endocytic Vesicle","Endocytic Vesicle Lumen","Endocytic Vesicle Membrane","Endodeoxyribonuclease Complex","Endolysosome","Endolysosome Lumen","Endolysosome Membrane","Endoplasmic Reticulum Lumen","Endoplasmic Reticulum Membrane","Endoplasmic Reticulum Tubular Network","Endoplasmic Reticulum Tubular Network Membrane","Endoplasmic reticulum-Golgi Intermediate Compartment Membrane","Endosomal Intralumenal Vesicle","Endosome Lumen","Endosome Membrane","Eukaryotic 43S Preinitiation Complex","Excitatory Synapse","Exocytic Vesicle","Exocytic Vesicle Membrane","External Side of Apical Plasma Membrane","Extracellular Membrane-Bounded Organelle","Extrinsic Component of Cytoplasmic Side of Plasma Membrane","FNIP-folliculin RagC/D GAP","Ficolin-1-rich Granule","Ficolin-1-rich Granule Lumen","Ficolin-1-rich Granule Membrane","Filopodium","Filopodium Membrane","Filtration Diaphragm","Flotillin Complex","Focal Adhesion","G Protein-Coupled Receptor Dimeric Complex","GABA-A Receptor Complex","GABA-ergic Synapse","GID Complex","Gap Junction","Gemini of Cajal Bodies","Germ Cell Nucleus","Glial Cell Projection","Glutamatergic Synapse","Golgi Cisterna","Golgi Lumen","Golgi Medial Cisterna","Golgi Membrane","Golgi Stack","Golgi Trans Cisterna","Golgi-associated Vesicle","Golgi-associated Vesicle Membrane","H3 Histone Acetyltransferase Complex","H4/H2A Histone Acetyltransferase Complex","HFE-transferrin Receptor Complex","Hemidesmosome","Heterotrimeric G-protein Complex","High-density Lipoprotein Particle","Histone Locus Body","Hrd1p Ubiquitin Ligase Complex","INO80-type Complex","ISWI-type Complex","Inhibitory Synapse","Ino80 Complex","Insulin-responsive Compartment","Intercalated Disc","Intermediate Filament","Intermediate Filament Cytoskeleton","Intermediate-density Lipoprotein Particle","Intracellular Cyclic Nucleotide Activated Cation Channel Complex","Intracellular Membraneless Organelle","Intracellular Organelle Lumen","Intracellular Vesicle","Ionotropic Glutamate Receptor Complex","Junctional Sarcoplasmic Reticulum Membrane","Keratin Filament","Kinetochore Microtubule","Lamellar Body","Large Ribosomal Subunit","Late Endosome","Late Endosome Lumen","Late Endosome Membrane","Lewy Body","Lipid Droplet","Low-density Lipoprotein Particle","Lumenal Side of Endoplasmic Reticulum Membrane","Lysosomal Lumen","Lysosomal Membrane","Lysosomal Proton-Transporting V-type ATPase Complex","Lysosome","Lytic Vacuole","Lytic Vacuole Membrane","MHC Class I Protein Complex","MHC Class II Protein Complex","MHC Protein Complex","MIB Complex","MICOS Complex","MLL1 Complex","MLL1/2 Complex","MLL3/4 Complex","MOZ/MORF Histone Acetyltransferase Complex","MPP7-DLG1-LIN7 Complex","MRNA Cleavage and Polyadenylation Specificity Factor Complex","Macropinosome","Male Germ Cell Nucleus","Matrix Side of Mitochondrial Inner Membrane","Meiotic Spindle","Melanosome","Melanosome Membrane","Membrane Raft","Microbody Lumen","Microbody Membrane","Microfibril","Microtubule","Microtubule Cytoskeleton","Microvillus","Microvillus Membrane","Mitochondrial Complex I Intermediate Assembly Complex","Mitochondrial Inner Membrane","Mitochondrial Intermembrane Space","Mitochondrial Matrix","Mitochondrial Membrane","Mitochondrial Outer Membrane","Mitochondrial Outer Membrane Translocase Complex","Mitochondrial Ribosome","Mitotic Spindle","Mitotic Spindle Microtubule","Mon1-Ccz1 Complex","Monoatomic Ion Channel Complex","Motile Cilium","Multivesicular Body","Multivesicular Body Lumen","Multivesicular Body Membrane","Multivesicular Body, Internal Vesicle","Muscle Myosin Complex","Myofibril","Myosin Filament","NADPH Oxidase Complex","NBAF Complex","NMDA Selective Glutamate Receptor Complex","NSL Complex","NURF Complex","NatA Complex","Neuromuscular Junction","Neuron Projection","Neuron Spine","Neuron to Neuron Synapse","Neuronal Dense Core Vesicle","Neurotransmitter Receptor Complex","Non-motile Cilium","Non-motile Cilium Membrane","NpBAF Complex","NuA4 Histone Acetyltransferase Complex","Nuclear Chromosome","Nuclear Envelope Lumen","Nuclear Inclusion Body","Nuclear Inner Membrane","Nuclear Lumen","Nuclear Membrane","Nuclear Outer Membrane","Nuclear Ribonucleoprotein Granule","Nuclear Speck","Nucleolus","Oligosaccharyltransferase Complex A","Oligosaccharyltransferase Complex B","Outer Dynein Arm","Oxoglutarate Dehydrogenase Complex","P-body","PAM Complex, Tim23 Associated Import Motor","PML Body","PRC1 Complex","PTW/PP1 Phosphatase Complex","Palmitoyltransferase Complex","Paraspeckles","Pericentric Heterochromatin","Perineuronal Net","Perisynaptic Extracellular Matrix","Peroxisomal Matrix","Peroxisomal Membrane","Peroxisome","Phagocytic Vesicle","Phagocytic Vesicle Lumen","Phagocytic Vesicle Membrane","Phagolysosome","Phosphatidylinositol 3-Kinase Complex, Class I","Phosphatidylinositol 3-Kinase Complex, Class IA","Phosphatidylinositol 3-Kinase Complex, Class III","PiP-body","Pigment Granule","Pigment Granule Membrane","Pinosome","Plasma Membrane Raft","Platelet Alpha Granule","Platelet Alpha Granule Lumen","Platelet Alpha Granule Membrane","Platelet Dense Granule","Platelet Dense Granule Lumen","Platelet Dense Granule Membrane","Platelet Dense Tubular Network","Platelet Dense Tubular Network Membrane","Podosome","Polymeric Cytoskeletal Fiber","Post-mRNA Release Spliceosomal Complex","Postsynaptic Actin Cytoskeleton","Postsynaptic Density","Postsynaptic Density Membrane","Postsynaptic Specialization Membrane","Potassium Channel Complex","Precatalytic Spliceosome","Preribosome, Large Subunit Precursor","Prespliceosome","Primary Lysosome","Protein Kinase Complex","Protein Phosphatase 4 Complex","Protein Phosphatase Type 2A Complex","Protein Serine/Threonine Phosphatase Complex","Proton-transporting V-type ATPase Complex","Proton-transporting V-type ATPase, V0 Domain","Proton-transporting V-type ATPase, V1 Domain","Pseudopodium","Pyruvate Dehydrogenase Complex","RISC-loading Complex","RNA N6-methyladenosine Methyltransferase Complex","RNA Polymerase II, Core Complex","RNA Polymerase II, Holoenzyme","Recycling Endosome","Recycling Endosome Membrane","Ribosome","Rough Endoplasmic Reticulum","Rough Endoplasmic Reticulum Membrane","SAGA Complex","SAGA-type Complex","SAM Complex","SCF Ubiquitin Ligase Complex","SUMO Ligase Complex","SWI/SNF Complex","Sarcoglycan Complex","Sarcolemma","Sarcoplasmic Reticulum","Sarcoplasmic Reticulum Lumen","Sarcoplasmic Reticulum Membrane","Schaffer Collateral - CA1 Synapse","Secondary Lysosome","Secretory Granule Lumen","Secretory Granule Membrane","Secretory Vesicle","Serine Palmitoyltransferase Complex","Serine/threonine Protein Kinase Complex","Set1C/COMPASS Complex","Signal Recognition Particle, Endoplasmic Reticulum Targeting","Slit Diaphragm","Small Ribosomal Subunit","Smc5-Smc6 Complex","Smooth Endoplasmic Reticulum","Smooth Endoplasmic Reticulum Membrane","Sodium Channel Complex","Sodium:potassium-exchanging ATPase Complex","Sorting Endosome","Specific Granule","Specific Granule Lumen","Specific Granule Membrane","Sperm Flagellum","Spherical High-Density Lipoprotein Particle","Spindle","Spindle Microtubule","Spliceosomal snRNP Complex","Spliceosomal tri-snRNP Complex","Supramolecular Fiber","Swr1 Complex","Symmetric Synapse","Synaptic Membrane","Synaptic Vesicle Membrane","T Cell Receptor Complex","THO Complex Part of Transcription Export Complex","TIM22 Mitochondrial Import Inner Membrane Insertion Complex","TIM23 Mitochondrial Import Inner Membrane Translocase Complex","TORC1 Complex","TRNA Methyltransferase Complex","Tertiary Granule","Tertiary Granule Lumen","Tertiary Granule Membrane","Tight Junction","Trans-Golgi Network","Trans-Golgi Network Membrane","Trans-Golgi Network Transport Vesicle","Transcription Factor AP-1 Complex","Transcription Factor TFIID Complex","Transcription Factor TFIIH Core Complex","Transcription Factor TFIIH Holo Complex","Transcription Factor TFIIIC Complex","Transcription Factor TFTC Complex","Transferase Complex, Transferring Phosphorus-Containing Groups","Transport Vesicle Membrane","Triglyceride-rich Plasma Lipoprotein Particle","U1 snRNP","U12-type Spliceosomal Complex","U2 snRNP","U2-type Catalytic Step 1 Spliceosome","U2-type Catalytic Step 2 Spliceosome","U2-type Precatalytic Spliceosome","U2-type Prespliceosome","U2-type Spliceosomal Complex","U4 snRNP","U4/U6 X U5 tri-snRNP Complex","U5 snRNP","U6 snRNP","U7 snRNP","Vacuolar Lumen","Vacuolar Membrane","Vacuolar Proton-Transporting V-type ATPase Complex","Vacuolar Proton-Transporting V-type ATPase, V0 Domain","Vacuolar Proton-Transporting V-type ATPase, V1 Domain","Very-low-density Lipoprotein Particle","Vesicle","Vesicle Coat","Vesicle Membrane","Voltage-gated Calcium Channel Complex","Voltage-gated Potassium Channel Complex","Voltage-gated Sodium Channel Complex","Zonula Adherens","Zymogen Granule","Zymogen Granule Membrane"],"featN":"CQAGAA4ADgAGAA8ACQAJAAsACQAKAAcACQALAAIAAgACAAcABgAFAAYABQAFAAUABAAEAAQABwAHAAMAAQACAAMAAQACAAcAFAAGAAYABAACAAIAEwAWAAoAEAAMAAsADQANAAsACgAKAAwACgAKAAkABAAFAA8ACAAJAAoADwAJABgADwAOABMAEgATABAADAALAAwADgADAAgADgASAA0AEwAPABEAGAApACQAEwAOABAAGQATABIAEgASACQAIAAvABEAGQATAA8ACAAQADcAIgAdABUAHgAqACAAJQAiAB4ALQAtACgAIQApADMAGwAzADQAMgANAAgAFAANAAsACgAIAAoACQAMABAADgANAAgADgAPABAADwAPAAIADQAKAAwACwAMAAkABwAFAAYACAAGAAcAAwAFAAMAAwADAA0ADgAQABAAFQAWAAIABAAEABYAHAAhABwADgAMAAgADQAEAAMAFwAQABQAFAABAAIACAADAAMAAgABAAEAAQAIAAwACgAIAAcAEAALAA4ADQAJAAsABgAHAAYACgAVABMADAARAAwAEQATAAYADQAMAAYABwAFAAcAAwADAAEAAgADAAQACAAGAAUACQARAA0ACQAVAAoAEAAQABMAIgADAAQADQATAAwACgAHAAUADAAHAA4AEwAXAAoAEAAFAAkABQAGAAAAAAACAAQAAwABAAMAAgADAAUAAwADAAQABAAEAAEABgAJAAgACwADAAEABQAHAAoACAAHAAYACwADAB0ADgAbAB0AEQARAA4AAgAHAAsAGwASAAYACwAIAA0ACAATABwAEQAKAAMABQAQAAYAAwAFAAUABAAEAAsADQAEAAQABQAJAA8ACgARAA0ABgAGAAkAEAALAAoAAgAFABcAEwATAAkACgAGAAYABQAFAA8ADAAGAAgABgAFAAgABgAHABAAAQAHAAUACQADABMAFwAFAAsABwAFAAMACgANAAkABAAMAAoAFwARAAoACgAaAA0ADAAJAAkACAAIAAsABQAEAAEAAQAAAAAA","featI":"cQCTAM0A2gDnAP0AAAEzAX0BEAA5AEEAqADOAP8AQgB2AHoAewCpANUA/QD/AAABAwEkASkBagGCAUIAegB7AKkAzQDVAP0A/wAAAQMBJAEpAWoBggH9AAABDQEOAQ8BkgECAE0AUQBnAGgAaQBuAHQAzgD9AP8AAAGhAaIBwgFnAGoAbADOAPUA/QD/ADgBOgEJABMAzgDfAP8AYQFjAbwBvgEJABMAdwCiAKMAzgD9AAABAQFjAXoBCQATACIAzgD0AP4A/wAAAWMBCQATAHkAzQDOAP0A/wAAAWMBoQEJABMAzgD9AP8AAAFjAQkAEwDOAP0A/wAAAQMBLQFjAWcAoAC/AM4A+AD5AP0A/wAAAVABXAH9AAAB/QAAAf0AAAGtAL4AzgD9AP8AAAGeAc4A/QD/AAABXAFeAc4A/QD/AAABAwHOAPwA/QD/AAABAwHOAP0A/gD/AAABXADOAP0A/wAAAaoAzgD9AP8AAAHOAP0A/wAAAc4A/QD/AAABzgD9AP8AAAEgAK0AzgD9AP8AAAEDAc4A/QD/AAABAwE6AWoBGQArAKAB9wAoAK0AkgAhASUBkgCSAM4AkgCtAM4A7ABHAUgBegEkACUAfACMAJIAogC0AMAAzgA8AUcBSAFaAXoBiQGKAZ0BngGfAboBKABrAIoA9wAxAZIBawCKAJIA9wB2AZIBigDZAPcAkgGKAJIBigCSASgALAA1AEIAWQCKAJIAlgCpALQAzgD3ADcBRwFIAXoBiQGSAboBKABCAEMAWwBcAIoAkgCjAKUAqQC0AM4A9wAWATcBRwFIAUkBSgFLAXoBkgEoAEMAWwBxAHYAigCSAJMAzgCSASgAQwBbAFwAigCPAJIAnwCjALQAzgDdAPcARwGSAboBKABDAFsAXACKAJIAnwDOAN0A9wCSAboBKABDAFsAXACKAJIAkwDOAPcAkgGeASgAQwBbAFwAigCSAJMAvADOAN0A9wAfAZIBKABDAFsAXABmAIoAkACSAJMAvgDOAPcAkgEoAEMAWwBcAIoAkgC+AM4A9wBHAZIBKABDAFsAXACKAJIAzgD3ABYBkgEoAEMAWwBcAGYAigCSAM4A9wCSARMAKABDAFsAXABmAIoAkgDOAPcALQGSASgAXACKAJIAzgD4AAQBjgGPAZIBKABTAFQAigCSAJgAtADOAHoBkgEoACwAigCSALQAtgDOAPcAkgGKAJIAzgCSASgAigCSAM4AkgEoACwAYACBAIoAkgCfALYAuADdAAYBNgE3AZIBugEkACUAkgDOAN0A4AB6AboBKAAsAJIAtgDOAN0A4QCKAboBKAAsAIMAkgCTALYA3QDhABYBugEoADIANQBZAIoAkgCWALQAzgDdAOAAkgG6AccByAEoAIsAkgC0AM4A3QBHAUgBugEoAIoAkgCiAKMAtADOANsA3QDgAOEA9AD3ADYBNwFHAUgBegGKAZIBngGsAboBvwEoAEMAWwCKAJIAnwC0ALYAzgDdAOAA4QD3AJIBugEoAIoAkgC0ALYAzgDdAOAA4QD3AJIBpgGnAboBKAAsAIgAigCSAJMAtAC2AM4A3QDgAPcAIQFHAUgBegGJAZIBugEkACUAKACKAJIAmAC0AM4A3QDgAOEA9wAhAUcBSAF6AZIBugEkACUAKACKAJIAnwC0ALYAzgDdAOAA4QD3ADYBNwFIAXoBkgG6ASgAigCSALQAzgDdAOAA4QD3ADYBNwFHAUgBegGSAboBKAAsAIoAkgC0ALYAwgDOAN0A4ADhALoBKACSAKwAtADCAM4A3QDgAOEAIQG6ASgALACSALQAtgDOAN0AegGJAYoBngG6ASgAigCSALQAzgDdAOAA4QB6AYkBigGSAZ4BugGHAIgAmQAgACIAeAB9AIcA1gAXAcIBIgBkAHgAfQCHAIgAmQC+AOMA5QAWARcBaAFpASwAVQB4AIcAiQCZAKkAsgC5AM8A7gA7AT8BQAFFAaMBwAHCASkALABCAHgAeQCTAJkAqQC2ANwA+QBpAXsBDAANABAALABCAEoAYgBjAHIAeAB5AIcAiwCZAKkAxwAPAWgBaQEsADgAcgB4AHkAhwCZAMkA0gANAQ4BDwFoAWkBogEPADwAfQCZAJsAxQDWAOAA4QDyAPQAFwE/AUABQwFGAX4BEABBAEoAVQCHAJwAnQC3ALkAxwDZAOwA8gAXAUMBSQFmAWcBaAFpAXwBlgGgAaMBEAAgACEAIgAkACYAJwA5AEIAUwBUAFYAVwBYAHkAfQCHAI0AnACdAKkAzQDWANgA3gDgABcBOwE9AVYBWgFoAXsBiQGLAZYBnQGfAaEBwAHEASAAIQAkACcAUwBUAFUAVgBXAFgAWQB4AI0AnQCyANYA2ADeABABFwE7AT0BRwFaAWgBaQF7AYkBlgGdAZ8BoQGiAasBuwHAASIAUwBUAFYAVwBYAH0AgACNAJsAnACdABcBVgF8AZYBqwHAAcQBIgA9AFMAVABWAGcAgACNAJwAnQAXASgBfAGWAXgAmQCmAKgA3gDgAOIAFQExATsBPQFfAWEBuwG8Ab4BIAAhACwAeACNAJkAnQChAKIApADeAN8A4ADiADsBPQFfAWABYQF7AZ0BuwG8Ab0BvgEsAHgAjQCZAKQA3gDfAOAA4gA7AT0BSAFfAWABYQG7AbwBvQG+ASYAKQAvAHwAlwCZANYA3gDgAOIAAQEJAQwBewGJAYsBnQHAASYAKQAvAHwAlwCZANYA3gDgAOIAAQEJAQwBewGJAYsBnQHAASYAKQAvAHwAlwCZANYA3gDgAOIAAQEJAQwBewGJAYsBnQHAARUAFgAgACEAJAAmACwANAA8AEIAdAB4AH0AfgCFAIcAiACLAI0AmQCfAKkA0wDWANgA3gDgAOIA9AAJAQsBRgGPAbsBwAHBARUAFgBGAE4AUwBUAFUAVgBxAHgAhQCHAIsAjQCTAJkAnwChANMA1gDYAN4A4ADhAOIA9AAFAQkBCwGPAcABwQECAAMAEQAVABYAIAAhACQAJgA0AE0ATgBPAFAAUQBSAFMAVABVAFYAWQB0AHgAhQCHAIsAjQCPAJEAmQDTANYA2ADeAOAA4gAFAQkBCwEyATwBWgGPAZwBuwHAAcEBLQA/AFMAVABWAHEAeACHAI0AkwDPAPQADAFKAUwBewHAASQAJgAsAFMAVABWAHgAgACNAJMAlwCYAJkAzgDWANgA3gDgAOIACQELAQwBSgFMAXsBBwAsAEIAUwBUAFYAeACLAI0AkwCXAJ8AqQAJAQwBRwFJAXsBwAESACwAcQB4AIcAjQCUAJkApQDfAGABewGXAb0BwAEgACEALACLALYAaAFpAbsBKQAsAJMAnQC2ANYA3QDeAOIAewGWAaEBogGrAccByAEIACAAIQAkACYAJwAsADUAUwBUAFYAWQBaAGQAcACFAI0AkwCUAJYAmQCdALAAtgC3ANYA2ADeAOAA4gDvAAABAQEHATsBPQFWAVoBYQFoAWkBewGJAYsBlgGdAZ8BoQGiAasBuwG8Ab4BwAHEASAAIQAkACYALAA1AFQAWQBaAIUAjQCTAJYAnQC2AN4AAAEBATMBOwE9AVoBaAF7AX0BiQGLAZYBnQGfAaEBqwG7AcABCAAsADUAPwBFAEkAUwBUAFYAWgCFAIsAjQCTALYA3ADeAOIA4wDkAOUABwEWARsBHQE7AT0BaQGrASwANQBaAGQAhQCHAIgAjQCSAJMAmQC2ANYA3ADjAOUAOwE9AWgBaQGrASIALAA1AEAAUwBUAFoAgwCFAIcAiACNAJIAkwCZALUAtgDYANwA4wDkAOUAOwE9AVQBVQFoAWkBlAGrASwANQBTAFQAVgBaAF4AeACFAIcAiACLAI0AjwCTAJgAmQCkALUAtgC9ANYA2ADcAN4A4ADhAOIA4wDkAOUAGQE7AT0BaAFpAXsBhwGUAaEBogGrASwANQBJAFMAVABWAFoAhQCHAIgAiwCNAJIAkwCZALUAtgDWANgA3ADeAOAA4gDjAOQA5QA7AT0BaAFpAaIBqwELACwANQA6AD8ASQBKAFMAVABWAFoAeACFAIcAiACLAI0AkwCZALYA1gDYANwA3gDgAOIA4wDkAOUACAE7AT0BaAFpAYYBogGrARQALAA1AFMAVABWAFoAeACFAIcAiACLAI0AkwCZALYA1ADXANgA3ADgAOMA5ADlAAoBOwE9AWgBaQGJAYoBnQGrAboBIgAjACoALAA1AEkAUwBUAFYAWgBvAHgAhQCIAIsAjQCTAJkAtgDYANwA4wDkAOUAFwE7AT0BaQGrAboBIAAhACIAIwAsAEwAUwBUAFUAVgBXAFgAcgB4AH0AhwCIAIkAiwCNAJkAnACdAJ8AtgC3ALkAxwDWAOEA8gAXATsBPQFDAWgBaQF7AXwBlgGhAaIBowGrAcABHwAsAEIASgBMAFUAYgBjAHIAeACDAIcAiACJAIsAmQCcAJ0AqQC2ALcAuQDHANYA4QDyAPYAOQE6ATsBQwFHAUgBYgFoAWkBcwF7AXwBlgGhAaIBowHAAcIBLABCAEQAVQByAHgAfQCHAIgAiQCLAJkAnACpALYAuQDHANYA2ADgAOEA8gDzAAkBCwEXATsBQwFEAWgBaQF6AXsBfAGJAYoBoQGiAaMBwAEsAFUAcgB4AIcAiACJAIsAmQCcAJ0AtgC3ALkAxwDWANgA8gAJAQsBOwFDAUoBTAFoAWkBewF8AZYBoQGiAaMBwAEfACAAIQAsAEQASgBVAHIAeACHAIgAiQCLAJkAnACdALYAtwC5AMcA1gDZAOAA8gDzAAkBHAE7AUMBRAFoAWkBewF8AZYBoQGiAaMBuwHAAcIBHwAgACEAJAAmACcAKQAsAEIAUwBUAFYAYgBjAG8AcwB4AIcAiACLAI0AmQChAKIApACoAKkAuQDWANgA3gDfAOAA4QDiAPQAOwE9AV8BYAFhAXsBiQGLAZsBnQGfAbsBvAG9Ab4BJAAmACcAKQAsAFMAVABWAFcAWABZAIcAjQCdAN4A4ADiABcBPQFaAWgBewGJAYsBlgGiAcABDQAgACEAJAAmACwANQBCAFMAVABVAFYAWQBaAG8AeACFAIcAiACLAI0AlgCZAJ0ApACpALYA1gDYANoA3gDgAOEA4gAJATsBPQFHAVoBaAFpAXsBiQGLAZYBnQGhAaIBqwG7AcABHwAgACEAJAAmACcAKQAsADUAUwBUAFUAVgBXAFgAWQBaAGQAeACFAIcAjQCTAJQAlgCZAJ0AsgC2ANYA2ADeAOAA4QDiADsBPQFaAWgBaQF7AYkBiwGWAZ0BnwGhAaIBqwG7AcABwgEgACEAJAAmACcALAA1AFMAVABVAFYAVwBYAFkAWgB4AIUAjQCTAJYAmQCdALYA1gDYAN4A4ADhAOIAFwE7AT0BVgFaAWgBaQF7AYkBiwGWAZ0BnwGhAaIBqwG7AcABxAHHAcgBJAAmACwAeACHAIgAmQCiAKQA3gDgAOIAewEsAHgAhwCIAJkA4ADhAMABLABKAFUAcgB4AIQAhwCIAIsAmQDNANoAOwE+AU0BTgFoAWkBwAHCARAALABBAEIAeACHAIsAmQCcAKkAFQFoAWkBLABCAHgAhwCZAKkAEAE7AWgBaQF7AVcAWABfAJMAlACdAK4A2gB7AZYBVwBYAJMAnQDaAAABlgGfAeYA5wD2AAABAQECATkBOgFCAW8BBwAsAJMAtgDCAPYAOQE6AYsBLABxAJMA9gD9AAABIwE5AWsBewGLAaEBJgApAHEAjQCTAJQAlwDeAAkBCwEMARkBPQFgAXsBvQFTAFQAVgBxAJMAlACVAJcA3gDgAOEA4gAMAXsBUwBUAFYAkwDeAOAA4gD8AP0AAAFoAXsBoQFTAFQAVgCDAI0AkwBMAXMBAgADACwATQBPAFAAUQBTAFQAVgCNAJMAAQGrASwANQBaAGQAhQCNAJMAlgC2AAABAQE6AWABqwG9ASwANQBUAIMAjQCTALYA3ADeAOQA5QD9AAABFgFzAYYBLAAyADUASABZAJIAlgC0ALYAuQDOAHsBjQHHAcgBHgCDAJMAmwCsALYAxQAWARsBJQEmAVQBVQGUAZUBkwDFASwAcQCTAJcA3gDiAAQBBQEMAUwBewGPAasBNAA1AFoAhQCTAN4A4ADiAKsBwQEsADQANQBvAHgAhQCTALYA8AAlAS8BqwEUACwAWgBkAIUAkwC2ACUBJgF1AasBLAA1AIgAjQCTALYAwgDcAOUAOwE9AYYBKAAsAJMAtgDQANwAEgEbAXYBLACSAJMAtgDcAOMA5QAIACwAswC2AAcBFAAsAJMAtgDcAAcBCAAsAIMAkwC2ANwA5QAHAQgALACTALYA3AAHASwAkwCzALUAtgC3ALgALACTAAEBLACTALYASQHFASwAkwC2ACwAkwC2ACwAkwC2AAcALAA7AG8AgwCIAJMAlQC2AN4A9ABzAYcBFAAsAEUAZACTAJQAtgDCANwA3gDgAOIABwEWAQgAFAAsAEUAeACDAJMAtgC6ANwA3gDgAOIA4wDlAAcBCAA7AEAAgwCTAKsAtgDcAN4A4wAHARYBKgErAXQBhwEIACwANQBTAFoAgwCFAIsAjQCTALYA3ADeAOQA5QAHARYBFwEbAXMBqwEIACwANQA7AFQAWgCDAIUAjQCTALYA3ADeAOIA5ADlAAcBFgFzAXQBhwGrAagBqgEIAOMA5QBpAZIAnwC2AMABFAAoACwANQBKAFoAhQCHAIgAjQC2AM4A1ADcAOMA5QA7AT0BaAFpAZ0BqwEIABIAFAAsADUAUwBUAFYAWgCFAI0AkwCWALYAvgDCANwA5ADlAAcBFgEXATsBPQFWAYYBqwHEAQgAJAAmACwANQBaAHgAhQCNAJIAkwC2ALgAwADWANgA2gDbANwA3QDeAOAA4gDjAOQA5QAHAXsBjQGrAawBvwHAAQgALAA1AFMAVABWAFoAhQCNAJIAkwC2AL0A1gDYANwA3gDiAOMA5ADlAAcBPQFpAY0BnQGfAasBLABTAFQAVgBaAIUAkwC5ALoA2ADeAOAA4gCiAVMAVABWAI0AkwCUAJUAmQDYAAkBJQFMASwAMQAzAHQAoAC2AL8AwQEdAB4AJgAsAIsAkwCbAKwAtgDFABYBJQGUASwAkwC2ANwALACTALYAGwAcACwAOwA/AJMAlACVAJcAmQCfAKQAsQC2AN0A3gDgAOIADAEZAR0BewGHASwAPwBJAEoAhwCIAJMAmQC2APgA+QAEAQUBUAGhAaoBCAAsAEQAcQB4AJMAmQC2AMIA3ADeAOAA4gDyAPMABwEmAUQBVQF7AQgALAB4AIcAiACLAI0AkgCTAJkAswC0ALUAtgC4AN4AAgEHARYBoQEnAM4AFgEsAIMAkwCUAJUAtgD8AHMBLACTALYAkwCUACUBkwDCAJMAkwCTAJMA/gA8AUwBegGJAYoBmQFUAGQAkwCUAKUAzQD5ACMBJQEmASsBjgEZACsALACTAJQAIwElASYBewGgASYAkwCUAJUA/AB7AYkBiwEsAHEAkwCUAJUAtgBpAQwAFAApAEUAeQCHAIgAkwCZAKgA3gDgAOIABwFfAXsBCABFAJMA1gDcAN4A4ADiAAcBewGJAQgAFAA6AEUAkwC6AMIA3ADeAOAA4gAHARsBiQEpAD8ARQCTAJ4A1gDeAOAA4gAHAUoBTAF7ASkALABFAIMAkwDeAOAA4gAHASwARQCTAN4A4ADiAAcBVgGGAcQBxQFkAJMA3gDiACUBJgEGAJMAwgDeAOAA4gDyAAYAZACTAN4A4ADiAAYABwBkAH8AkwCUAN4A4gBWAcQBBgAHAAgAFAA6AEUAZACTAN4A4ADiAAcBRwFJAU0BTgFWAXUBdwF7AcQBBgAHAAgAFAB/AIQAkwCrAMIA3gDgAOIABwEcAR0BVQFWAZUBxAEGAAcACAAUACwAZACTAMIA3gDgAOIABwEGAAcACAAPABQAOgBkAJMAzADeAOAA4gAHARcBHQFWAcQBBgAHAAgAFACTAL0A3gDiAAcBVgGGAcQBCAA6AH0AfwCTAKsArAC6AMwABwEWARcBRgFVAVYBlQHEAQgALAA1ADoASQBxAH8AkwCrAKwAugDCANwA3gDiAAcBFgEXAR0BQACTAMgAFwGGAcUBCACNAJMAugDcAAcBFwEbAR0BRgGEAYYBxQEIACIAkwCvALkAugABAQcBFwGEAYYBxQFFAF8AkwCuADMBfQFlAGoAbACTACoBKwEwAZIAkwAlASoBKwEIACwAXQCTAAEBcQGDASwAhwCTAJMAwgCEAZMACACTAAgAkwAHAQgAkwDcAAcBQgCSAJkAqQAXARgBaAFpAQoACwAXAEIAqQB7AUIAhwCpAN4AewEJABMAQgB5AKkAzQA/AUABYwEiACwAOQA8AEEAQgBqAHQAeAB9AJkAoACpAPQAFwFGAVsBIgA8AEIAfQCHAKkA9AAXAT8BQAFGAVsBeAEPADwAQgCpAPQAPwFAAUYBWwEMAA0APABBAEIAdAB5AKcAqACpALIA7gD0AD8BQAFFAUYBTwGBAcABxgEMAEIAeQCpAM8A9AASAT8BQAFPAQwAIgApAEIAeAB5AIcAqQDPAO4A9AA/AUABRQFbAZIBEQAiAEIAfQCHAIwAogCjAKkAzgAXASIBJwEoAVsBwAEMAB0AIgAnAEIAVwBYAHMAeQB9AJ0AqQCyAPQAFwFTAXQBlgHAAQIAAwAEAAwAIgBNAE4ATwBQAFEAUgBTAFQAVQBWAHQAeQCLAI8AkQClAKYAyQDKANYA3gDhAPgA+QAOARYBFwFQAXQBDAB5ABYBDAB5AM0A+QAMAA0ADgApAEEAQgCpAM8A9AD6AFABiAHAAQwADQAiAEIAeQB7AIEAqQC+AMkAygDNANIABQEXAU8BUAF0AYIBDAANAFUAeQDJAMoA+AD5AFABcAGPAcABDAANADgAeQANAQ4BDwFOAVABkgEMAA0AQgB5AKkAFwFQAQwADQBnAHkAUAEAAIIAxwD4APkABAEXARgBUAFdAV4BjgEMAN4A4ADiAFIBmAG7ASIATwB4AH0AhwCIAJkAnQDeAOAA4gAWARcBlgEiAD0AVwBYAIAAnACdAN4A3wDgAOIAFwFfAWEBfAGWAbsBvAG+AQEADAANAA4AGAAiADcAOgBKAFMAeAB5AH0AjgCQAJkAxwDRAPoACAEXARoBjAE3ADoAfQD0APgA+gAXAY4BjwHAAQwALAA3ADoAeAB9AI0AkACTAJkA9AAXAVYBhAHAAcQBIgBtAMoAFwF+AQ4AIgB9AI8AkACYAPoAFwFbASIAfQDHABcBawEiACwAeAB9AJkAFwGWAC4BLgBEAPMARAEEAC4ArQAlAScAMAGoAScAcwAnAHMAoQAFAVsBhQGqAcABcQAEAaoBBAEFAY8BPgB0AKAAvwA+AEoAvgAyAQgABwEXAYABgAEgACEApQD0AEYBuwEgACEAYgBjALsA6wAXAT4BeQEgACEAYgBjALsA6wA+AXkBIgAxADMAjgCyAPUAFwEYATgBlgHBAWoAawCWAZYBnQAIARYBFwGWASEArQBhAZYBuwG8Ab4BIQCdAK0AFgEXAWEBlgG7AbwBvgF0AJ0AsgDNANoAlgGhAcABeACTAJ0AVgF7AZYBxAEsAJMAtgACAaEBogEsAIcAiACTALYA3QDgACUBJgFwAboB3gDgAOIACAAsADIAMwA1ADsASwBZAFoAcQB4AJMAlgCZAJ8AtgC5ALoA3ADeAOAA4gD9AAABBwEWAXQBewGHAQgADwAUACwANQBFAHgAkwCeAN4A4gD0AAcBRgEGAAcAKQAsADwAPwBFAEkASgB0AHgAfQCLAI0AkwCgAL8A3gDgAOIABwEXARwBHQFGAYYBxQEVABYAIAAhACgALgBcAHQAdwB5AIoAkgCiAKMAzQDOANMA1gDYAN4A4ADiAAkBCwFrAXoBjwGSAbsBCQATACIAdwCSAM4A3QDeAOAA4QDiAPQA/wABARcBYwG6ASIAQgB9AIsAjACPAJAAkgCYAKIAowCpAM4A3QD6ABcBugEOABgAIgB9AIcAkACSAJgAmQDOAPoAFwFbAZ0BzgD/AEYAkgCZALUAuADOAMABQQBfAJMALwF7AYkBiwGaAZ0BnwGrAQwADQAOAEIAeAB5AI0AkwCiAKQApQCpAM0A8AAAAQEBEAEvATsBPQE+AVABcAF5AXsBnQHAATcAOgBCAEYAkwCpALIA0QAXATABNgE3AXUBdwF4AXsBwAHCATcAQgClAKkAMgHDAQ4APwBCAKUApwCpAL0A+gD7AHsBgQFCAIoAqQD3AEcBSAGIAZIBHQAoAH0AigD0APcAFgEXASEBRgFTAZIBlQEoAF8AigCuAPcA+AD5AJIBDgAoACwAOQBCAEMAWwCDAJIAkwClAKkAtAC2AM4A9AAWAXMBdAEMABAAKAA5AEEAQgBDAFsAXABiAGMAeQCKAJAAkgCYAKkAvgDKAM4A7QD3ACoBKwFRAWIBkgGxARAAKAA5AEAAQQBCAGYAgQCKAKkAsgC+AMgA9wAQATIBkgEQADkAQQBCAJ8AqQCyAL4AIwEyAQ4AfQAXAX0AtAAPARcBkgEMAA0AOABiAGMAeQDHAA0BDgEPAU4BYgFoAXUBdwGSAWcAaQBsAA0BDwGSAQ0BDwGSARAAKgA5AGcArQBlAGgAawCGAcUBZwBpAGwAjQFnAGgAaQBsAGUAZgBnAGgAaQBqAGsAbADZAHABpAEXAGUAZwBoAGkAagBrAGwAoAC/AMsA2wBwASQAJQBLAEwAYQCBAKQAuwFhAHcAiAB6AYUBYQCBALQAzgB6AYkBigGdAZ4BJAAlAGEAdwCBAMkAygDgAOEARwFIAVABegGKAboBJAAlAGEAdwCBAKIApADKAHoBnQEQACQAJQBBAEIAYQB5AKkAuQDNAOEAbQFuAXoBowGpAboBDAAQABkAGgApACsAQQBVAHkA7ABkAaABowEMAA4AGQClAM0ATwEMAA4ANwA6AEYAkAAMAA0AIwB5ALsA6wBBAVABhQEMAA0AJAAlAGcAaQBsAHkApQC8APgA+QAfAVABlgG6AQwADQAiAHkApQC8ABcBHwFQAWEBvgEMAA0AHQAnAEoAeQDRAAgBHAFTAQwAeQAMABMAeQCQAC0BJQBIAHcAiwCMAJIAwADDAMYAyQDKAM4A0gDbACABRwFIAVABdAF6AY0BrAG/AScALABKAHMAeAB5AJkAyQDKANIA+QAEAQUBHAFQAY4BjwGhAaIBIgA4AEAAQQB5AJwAyADJAMoAzQDSAA0BDgEPAUMBUAF0AXwBkgFHAMkAygDNANIA+AD5ADIBUAEnAHkAyQDKAM0A0gAEAQUBUAGPASIAeQDJAMoA0gBQAXkAyQDKAM0A0gBQAXkAyQDKAM0A0gCHAPkAUAFdAV4BZwBoAGkAbABtAHkAowDxAPgA+QBQAV0BXgF+AY4BZwBpAGwAeQD1APYA+AD5ADgBOQE6AVABZwCgAL8A+AD5AFABZwB0AKAAqgC/APgA+QBQAdMA+AD5AFABjgGPATAAagD4APkAUAEjAG0AdwCiAKMAzgB6AX4BbQB5APgA+QBwAX4BbQD5AH4BpgGnAagBqgEkADQANQB2AIUAiwDNAPkAOwFaAYkBjgGtAcABwQHCAXYAYAC5AAsBZgFnAZUBowFnAW0BbgGlAakB6ADpAD8BQAFJAWcBbgGlAakBNgDBAF0BNgCvACcBKAFXAVkBkAGRAa0BrgGvAbEBsgGzAbQBtQG2AbcBuQE2AK8AJwEoAS4BUQFXAVkBkAGRAa0BrgGvAbABsQGyAbMBtAG1AbYBtwG4AbkBPQBUAGcAgAAoAT0AbgDoAOkAJwEoATEBWwFnAX4BfwGdACcBKAGWAaMBsAG0AWwAJwEoAV0BXgEnASgBZQF4AJkAuwC8AMMA6wAfASABQQGTAbwAwwDGAOgA6QARARMBHgEfASABUgFyAZMBvADDAMYA6ADpAB8BIAFMAXIBFwBhAGwA8QAXAGwAyQDNAAQBFQEkASUBKQFdAV4BjgEXAFUAbAC5AM0A9gAwATkBjgGjAR0AKABCAHEAdQB3AHoAewCKAKIAowCpAM0A1QAWASQBKQFTAWoBbAF6AYIBkgEdAEIARwBxAHUAegB7AKkAzQDVACQBKQFTAVgBagFsAYIBOwB6ANUA6ADpACQBKQGHAZsBqAHNAOgA6QDqABEBHgEkASkBcgF/AQUAKgDDAMQAxgDNAOgA6QDqAAQBEQEUAR4BIAEiASQBKQEuAW0BbgFyAX8BgAGOAZMBqQEOACkAiwCNAM0AJAEpAUcBSAF6AYkBigGeAXYAmgDJAMoAzQAkAScBKAEpATQBUAGQAc0AJAEnASgBKQFtAW4BqQGuAXoAzQDVACQBJwEoASkBMAGoAUcAzQAgASQBKQEsATABNQEJAGwAzQAUASEBJAEpAWMBSgCsAMoAzQAIASQBJQEmASkBLgF1AUoAzQAIASQBKQGEAM0AJAEpAYYAhgA=","tree":{"ab":"vwDAAL4AiQG9AIoBugC7ALwAiwGMAY0BuQCOAbgAjwEZABoAGACRAQ8AEAAOAJMBAgADABMAFAAXAJIBCwAMABYAlwEVAJkBlgGaAQoAmAESAJsBGwAcAJ0BngEJAJwBEQCfAQgAoAGUAaEBBwCiAQ0AowGkAaUBBgCmAQUApwEEAKgBlQGpAQEAqgEAAKsBKAApADQANQA5ADoAMwCuAUYARwAtAC4AMgCwAS8AMABCAEMAMQCzAUUAsQG0AbYBSABJAEoASwA9AD4AsgG4AUQAtwG1Ab0BLAC8ATgArwEhACIAJQAmACcArQFBAL4BKgArALkBugE3AMABxAHGATYAxwFAAMgBPwDKAb8ByQHCAcMBuwHLATwAzgHFAcwBIADBATsAzwHQAdIBIwAkAM0B0wHUAdUB0QHWAR8A1wEeANgBHQDZAZ8AoACeANsBmQCaAKUApgCYAN0BnQDcAaIAowCXAN8BnADgAZYA4gGbAOMB5AHlAZIAkwCkAN4B4QHoAZUA5gGRAOcBlADqAaEA6QHsAe0B6wHuAZAA7wGPAPABjgDxAY0A8gGBAIIAhwCIAIQAhQCJAIoAiwCMAIYA9QH3AfgBgwD2AfkB+gH7AfwB9AH9AeIA4wDNAM4A4QD/AccAyADKAMsA0wDUANIABALRAAUC2ADZANAABgLMAAACyQADAs8ACALVANYAAgIKAuAAAQLGAA0C2wDcAMIAwwAJAgsC1wAHAg8CEgLdAN4AxADFAN8ADgIVAhcCDAITAhECFgIUAhkCEAIYAtoAHAIbAh0CGgIeAsEAHwJuAG8AbQAhAnAAcQBrAGwAaABpACICIwIkAiYCagAnAiUCKAJnACkCZgAqAmUAKwKyALMArACtAKsALgKqAC8CtgC3AK4ArwCxAC0CtQAxArAAMwK0ADQCMAIyAjUCNgI3AjgCqQA5AqgAOgKnADsCegB7AHkAPQJ1AHYAdAA/AnMAQAJyAEECfwCAAHgAPgJ8AH0AdwBEAn4AQwJCAkYCRQJHAkgCSQJdAF4AXABLAloAWwBVAFYAVwBYAFkATQJgAGEAXwBRAlEAUgBjAGQAYgBUAk0ATgBQAFMCTgJPAlICVQJMAlkCTABWAk8AVwJUAFgCUAJaAlsCXAJdAl4CUwBgAl8CYQLpAOoA9wD4AOwA7QDxAPIA5QDmAAIBAwHoAGMC9gBkAusAZQL+AP8AaQJrAvsA/AD1AGoCAQFoAvQAbwLnAG0C/QBsAgABcALzAHEC7gDvAGYCdQLkAGcC+gBuAnICdgJzAnQCeAJ6AvAAdwJ8An0CeQJ7AvkAfwJ+AoACBAEFAYECggKFAYYBFQEWAVgBWQFqAWsBXQFeARsBHAELAQwBVwGGAncBeAE+AT8BcgFzAVYBiwKDAYQBOgE7AUABQQE1ATYBVQGPAmcBaAFQAVEBRgFHAX4BfwF6AXsBXwFgAYIBkAJNAU4BWwFcAScBKAFvAXABGAEZATcBOAGIApoCfQGYAmIBYwGNApICVAGUAoEBmwJxAY4CgAGnAlMBpgISARMBIwEkATQBkwIxATIBRQGXAqMCqQIaAYkCnQKiAm4BnwIKAYoCdQF2AUwBnAIuAS8BHwEgAVoBsgJKAUsBDgEPATABrgJEAa8CeQGZAiIBrAImAZ4CTwGWAkMBvQI5AZECfAGwAgcBCAFhAaQCFAGFArYCwQK+AsQCdAG1AkgBSQEdAR4BMwGtAm0BswINAbsCEAERAT0BpQJSAaoCsQLMAowCyQItAbcCoALTAiwB1QIpASoBbAHOAiEBvwK8As0CoQLDArkCxgK6AsgCwALYAhcB1gKHAtkCygLUAmYBlQK4AtoCJQHfAssC3gLXAtsCPAHRAtIC3QJkAWUBQgHCAuYC6QLcAugCKwHnAuUC7gJpAeECxwLgAqgC4gLkAu8C6wLsAvAC8gLjAvUC7QL0AqsC8QLzAvcC6gL2AvkC+gL4AvsC0AL8As8C/QK0Av4CCQH/AsUCAAMGAQEDhwGIAYQCAwMCAwQDLAJKAvMBPAJiAgYDkAEgAgcDCQP+AQoDCAMLA6wB2gGDAgUDDAMOAw0DDwM=","h":"AABGWGBujIwAAAAAFhshJCYpNTpBSEhOUV9kZ3J0f4GEh4uMABccIiMjKCgpKisvMjU6OzxARUZGRkZIS0tNTlRXV1hZXGBiY2RobHR4foSGjAAAJjU4Pk1TU11gY2RlbG1xdHZ7gYaHiYxMV2hrc3d8fYKKjCY5P0JGSEpOUFRbW1tdXmFkZWtrbm9ycnN3e3+DhIaHi4wkNj4/REVLU3KCh4wjSFtjamttc3R1d3t+g4iMJDo8Q05RVVxmbHp/gowAAC5KS1BRU2BkZmpxc3Z9f4CDhIWJjIw8Rk5UWFhZXV1iZmZnaGpsbm5vb3J0dHR3en2AgYOEjIwAEBcYIyovMjg4PERGRkZRU1RUVlZWWFtbW1teXl5fYGJkZmZmZ2lpamtrbGxsbW1tbW1ubm9wcHBxcnJzc3R0dXV2dnZ2d3d3d3h4eHl5enp6e3t7e3x9fX5+fn+AgYGBgYKCgoKDhIWGh4eIiIiJiYmKioqKiouLi4uMjIyMjIyMnra9yc/Z5fP5/f8=","cut":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQE="}};

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

// The neuromuscular junction, close up: a cut-away section through one junction, the hero of the endotype story.
// Up (+y) is the nerve, down the muscle; the cut face (z = ZC) looks towards +z. A glassy nerve ending (bouton)
// under a thin Schwann cell cap, its myelinated axon arriving from above left; inside, synaptic vesicles clustered
// over four active zones (dense bars opposite the mouths of the junctional folds, a few vesicles docked), three
// mitochondria cut open to show their cristae, endosomes and a faint actin mesh. Across the synaptic cleft runs the
// basement membrane (a glowing fibrous sheet of laminin crosses and collagen threads, acetylcholinesterase on
// collagen-Q tails, agrin strands from the nerve), dipping into each of six deep junctional folds of the muscle
// membrane. Acetylcholine receptors (five-subunit rosettes) carpet the crests with rapsyn under them and MuSK/LRP4
// pairs among them; sodium channels line the troughs. Inside the fibre: two of the junction's own nuclei (one cut
// open), endoplasmic reticulum and a Golgi stack, mitochondria, and striated myofibrils with desmin round their
// Z-discs. Params: assembly, firing, fatigue, the 35 seed genes where they act, an endotype's place, the endotypes
// arriving. Data: ENDO_DATA (endotype colours, places and seeds). Sizes are exaggerated where they would vanish.
SETS.syn = function (K) {
  const { THREE, clamp, lerp, prog, smooth, rng, gauss, v3 } = K;
  const set = K.newSet('syn');
  const PI = Math.PI, TAU = 2 * PI;
  const R = rng(4711);
  const f4 = x => x.toFixed(4);   // numbers for GLSL

  // ------------------------------------------------------------------ the layout (local units: 1 micrometre is about 0.5)
  const ZC = 0.34, ZB = -0.62, XS = 1.2;            // the cut plane, the back of the section, its half width
  const YP = 0.13, YL = 0.06;                        // the nerve's membrane over the cleft; the basement membrane's middle
  const BC = [0, 0.2, -0.12], BRX = 0.9, BRU = 0.78, BRD = 0.07, BRZ = 0.62;   // the bouton: a superellipsoid round BC
  const NF = 6, FX = [0, 1, 2, 3, 4, 5].map(i => -0.625 + 0.25 * i), FD = [0.34, 0.42, 0.38, 0.41, 0.44, 0.33], FW = 0.022;
  const AZ = [1, 2, 3, 4];                           // active zones over the mouths of the four middle folds
  const ZP = 0.42;                                   // Z-disc spacing of the myofibrils (shorter than life)
  const NA = [-0.5, -0.6, 0.2], NAR = [0.28, 0.13, 0.2];      // nucleus A (cut open) and B (whole)
  const NB = [0.66, -0.6, -0.2], NBR = [0.22, 0.11, 0.15];
  const GO = [-0.07, -0.6, 0.16];                    // the Golgi stack, at nucleus A's right end
  const MYO = [];                                    // myofibrils: [y, z], along x
  for (const y of [-0.9, -1.06]) for (const z of [0.22, 0.05, -0.12, -0.29, -0.46]) MYO.push([y + (z === 0.05 ? 0.012 : 0), z]);
  const MYR = 0.06;

  // ------------------------------------------------------------------ endotypes and places (from the data)
  // place slots (index into uG/uD): 0 neutral, 1 mito, 2 lamina, 3 golgi, 4 channels, 5 er, 6 endosome, 7 vesicles,
  // 8 scaffold, 9 junction (the synaptic membranes), 10 nucleus
  const PLACES = ['', 'mito', 'lamina', 'golgi', 'channels', 'er', 'endosome', 'vesicles', 'scaffold', 'junction'];
  const SLOT = {}; PLACES.forEach((p, i) => { if (p) SLOT[p] = i; });
  const ED = ENDO_DATA, EN = ED.endo, ECOL = EN.map(e => K.rgb(e.col));
  const SCOL = [...Array(12)].map(() => new THREE.Vector3(1, 1, 1));
  EN.forEach(e => { if (SLOT[e.place] !== undefined) SCOL[SLOT[e.place]].set(...ECOL[e.id]); });
  const GENDO = {}; EN.forEach(e => e.seeds.forEach(s => { GENDO[s] = e.id; }));

  // ------------------------------------------------------------------ shared uniforms
  const SU = {
    uTime: K.U.uTime, uG: { value: new Array(12).fill(0) }, uD: { value: new Array(12).fill(1) }, uSC: { value: SCOL },
    uStage: { value: [1, 1, 1, 1, 1, 1] }, uNerveY: { value: 0 },
    uPh: { value: 9 }, uFire: { value: 0 }, uWave: { value: 0 }, uTw: { value: 0 }, uFuse: { value: new Array(16).fill(0) },
  };
  // aS: place slot, build stage (0 fibre, 1 membrane, 2 basement membrane, 3 receptors, 4 nerve, 5 Schwann cell and
  // matrix proteins), moves with the arriving nerve (0/1), cut at the cut plane (0/1).
  // aQ: when the impulse (or the muscle's wave) passes in the firing cycle, its kind (0 none, 1 nerve, 2 muscle wave,
  // 3 wave with striations, 4 fibrous sheet, 5 striated myofibril), and a brightness gain
  const VH = `
attribute vec4 aS; attribute vec3 aQ;
uniform float uG[12], uD[12], uStage[6], uNerveY, uPh, uFire, uWave, uTw; uniform vec3 uSC[12];
varying vec3 vGC, vL; varying float vDm, vK, vP, vKind, vClip;`;
  const VB = `
{ int si = int(aS.x + 0.5); int st = int(aS.y + 0.5); vGC = uSC[si] * uG[si]; vDm = uD[si]; vK = uStage[st]; vClip = aS.w; vKind = aQ.y;
  float pd = uPh - aQ.x; vP = (aQ.y < 0.5 || aQ.y > 3.5) ? 0.0 : (aQ.y < 1.5 ? uFire : uWave) * exp(-pd * pd / 0.0018); vL = position; }`;
  // the receptors open where acetylcholine lands: e = (release site, squared distance to it, a random threshold)
  const OPEN = `
uniform float uFuse[16];
float openR(vec3 e) {
  float f = uFuse[int(e.x + 0.5)], env = smoothstep(0.31, 0.37, uPh) * (1.0 - smoothstep(0.52, 0.74, uPh));
  return f * env * step(e.z, exp(-e.y / 0.0065));
}`;

  // translucent membranes (bouton, axon, myelin, Schwann cell, muscle membrane, organelle envelopes, the fibre's
  // surface, the cut edges and the basement membrane's sheet): additive glass that glows at the rim
  const glassMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, SU),
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 color;` + VH + `
varying vec3 vN, vW, vC; varying float vGA, vSc;
void main() {` + VB + `
  vC = color; vGA = aQ.z; vSc = length(modelMatrix[0].xyz);
  vec3 p = position; p.y += aS.z * uNerveY;
  vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float uA;
varying vec3 vN, vW, vC, vGC, vL; varying float vDm, vK, vP, vKind, vClip, vGA, vSc;
void main() {
  if (vK < 0.003 || (vClip > 0.5 && vL.z > ${f4(ZC)})) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW); float r = pow(1.0 - abs(dot(n, v)), 2.2), pat = 1.0;
  if (vKind > 1.5 && vKind < 4.5) r = min(r, 0.55);   // wide sheets seen edge-on would add up to white
  if (vKind > 3.5 && vKind < 4.5) {   // the basement membrane: a fibrous mesh
    vec2 q = vec2(vL.x + vL.y, vL.z) * 70.0;
    pat = 0.2 + 0.8 * pow(abs(sin(q.x + 1.7 * sin(q.y * 0.53)) * sin(q.y * 0.8 + 1.3 * sin(q.x * 0.41))), 0.7); r = 0.18 + 0.4 * r;
  } else if (vKind > 5.5) { gl_FragColor = vec4(vC * vDm * vGA * vK * 0.09 + vGC * 0.05, uA); return; }
  else if (vKind > 2.5) { pat = 0.65 + 0.35 * smoothstep(0.2, 0.6, abs(fract(vL.x / ${f4(ZP)}) - 0.5) * 2.0); r = 0.2 + 0.8 * r; }   // the fibre's surface: a base tint, striated
  vec3 pc = vKind < 1.5 ? vec3(0.25, 0.42, 0.5) : vec3(1.0, 0.68, 0.32);
  float a0 = (vKind > 1.5 && vKind < 4.5) ? 0.012 : 0.03;   // sheets seen face-on through many folds stay faint
  vec3 col = (vC * (0.45 + 0.85 * r) * vDm * pat + vGC * (0.5 + 1.2 * r) * pat) * (a0 + 0.42 * r) + pc * vP * (0.35 + 0.8 * r);
  // glass right in front of the eye fades (in the set's own units, so also at life size in a headset)
  gl_FragColor = vec4(col * vGA * vK * smoothstep(0.03, 0.3, distance(cameraPosition, vW) / vSc), uA);
}`,
  });
  set.mats.push(glassMat);

  // lit surfaces with the set's hooks: place glow and dimming, build stage, the nerve arriving, the cut, rim light
  const FH = `
uniform float uSelf, uRimK; uniform vec3 uRimC;
varying vec3 vGC, vL; varying float vDm, vK, vP, vKind, vClip;`;
  function lit(key, o = {}) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough === undefined ? 0.5 : o.rough, metalness: 0, side: o.side || THREE.FrontSide });
    K.fade(set, m, 1);
    m.extensions = { derivatives: true };
    const un = { uSelf: { value: o.self === undefined ? 0.14 : o.self }, uRimK: { value: o.rimK === undefined ? 0.35 : o.rimK }, uRimC: { value: new THREE.Color(...(o.rimC || [0.6, 0.8, 1])) } };
    m.userData.u = un;
    m.customProgramCacheKey = () => 'syn-' + key;
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, SU, un, o.uniforms || {});
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + VH + (o.vh || ''))
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);' + VB + '\n' + (o.vb || '') + '\ntransformed.y += aS.z * uNerveY;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + FH + (o.fh || ''))
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (vK < 0.003 || (vClip > 0.5 && vL.z > ${f4(ZC)})) discard;` + (o.fc || ''))
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (o.fcol || '') + '\ndiffuseColor.rgb *= 0.3 + 0.7 * vDm;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float rimF = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
totalEmissiveRadiance += diffuseColor.rgb * uSelf + uRimC * (uRimK * rimF * vDm) + vGC * (0.3 + 0.9 * rimF) + vec3(1.0, 0.72, 0.4) * vP * (0.12 + 0.4 * rimF);` + (o.fe || ''));
    };
    return m;
  }

  // ------------------------------------------------------------------ geometry helpers
  const V = a => new THREE.Vector3(a[0], a[1], a[2]);
  // collects geometries into one indexed geometry with the attributes in spec ({ name: size }); vals give each
  // attribute a constant, a function (x, y, z, i) of the (transformed) vertex, or nothing (the geometry's own, or
  // zeros); m an optional Matrix4 applied on the way
  function Builder(spec) {
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
  // a tube along an explicit centre line f(u), u 0..1 (frames by parallel transport), radius r(u) or r(u, angle)
  function tubeFn(f, seg, rad, r) {
    const nv = (seg + 1) * (rad + 1), P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv);
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
        N[o * 3] = nx; N[o * 3 + 1] = ny; N[o * 3 + 2] = nz; U[o] = u; o++;
      }
    }
    let k = 0;
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx[k++] = a; idx[k++] = b; idx[k++] = a + 1; idx[k++] = b; idx[k++] = b + 1; idx[k++] = a + 1; }
    const at = (array, itemSize) => ({ array, itemSize, count: array.length / itemSize });
    return { attributes: { position: at(P, 3), normal: at(N, 3), aU: at(U, 1) }, index: { array: idx } };
  }
  // a grid surface from rows of points (each row the same length); normals from the mesh
  function rowsGeo(rows, closed) {
    const nr = rows.length, nc = rows[0].length, P = new Float32Array(nr * nc * 3), idx = [];
    rows.forEach((row, j) => row.forEach((p, i) => P.set(p, (j * nc + i) * 3)));
    for (let j = 0; j < nr - 1; j++) for (let i = 0; i < nc - 1; i++) { const a = j * nc + i, b = a + nc; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    if (closed) for (let j = 0; j < nr - 1; j++) { const a = j * nc + nc - 1, b = a + nc; idx.push(a, b, j * nc, b, (j + 1) * nc, j * nc); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // a closed surface f(u, v) -> [x, y, z], u 0..1 pole to pole, v 0..1 around
  function surf(nu, nv, f) {
    const rows = [];
    for (let i = 0; i <= nu; i++) { const row = []; for (let j = 0; j < nv; j++) row.push(f(i / nu, j / nv)); rows.push(row); }
    return rowsGeo(rows, true);
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
  // a matrix that puts a template's +y along n at p, turned by a about n, scaled s
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _Y = new THREE.Vector3(0, 1, 0);
  function orient(p, n, a, s, out) {
    _q.setFromUnitVectors(_Y, V(n).normalize()).multiply(_q2.setFromAxisAngle(_Y, a));
    return (out || new THREE.Matrix4()).compose(V(p), _q, new THREE.Vector3(s, s, s));
  }
  const ellipsoid = (c, r, nu, nv, wob) => surf(nu, nv, (u, v) => {
    const th = u * PI, ph = v * TAU, w = wob ? 1 + wob(th, ph) : 1;
    return [c[0] + r[0] * w * Math.sin(th) * Math.cos(ph), c[1] + r[1] * w * Math.cos(th), c[2] + r[2] * w * Math.sin(th) * Math.sin(ph)];
  });
  const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

  // ------------------------------------------------------------------ shapes
  // the bouton: rounder on top, flat underneath (the side facing the cleft); bR(d) its radius in unit direction d
  function bR(d) {
    const n = 2.1 + 1.5 * smooth(-d[1] * 1.6), ry = d[1] > 0 ? BRU : BRD;
    return Math.pow(Math.pow(Math.abs(d[0]) / BRX, n) + Math.pow(Math.abs(d[1]) / ry, n) + Math.pow(Math.abs(d[2]) / BRZ, n), -1 / n);
  }
  const bWob = d => 1 + 0.03 * smooth(d[1] * 2 + 0.2) * Math.sin(Math.atan2(d[2], d[0]) * 3 + 1.1) * Math.sin(Math.acos(clamp(d[1], -1, 1)) * 2.4);
  const bIn = (p, m = 0, w) => { const q = v3.sub(p, BC), l = v3.len(q) || 1e-6, d = v3.mul(q, 1 / l); return l < bR(d) * (w ? bWob(d) : 1) - m; };
  const bPt = (d, off = 0) => v3.add(BC, v3.mul(d, bR(d) * bWob(d) + off));
  // the underside's height at (x, z)
  function bBot(x, z) { let lo = BC[1] - BRD - 0.02, hi = BC[1]; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (bIn([x, m, z])) hi = m; else lo = m; } return hi; }
  const AXP = [[-2.9, 2.3, -0.55], [-2.2, 1.86, -0.46], [-1.5, 1.42, -0.36], [-0.98, 1.1, -0.26], [-0.58, 0.88, -0.18], [-0.3, 0.72, -0.13]];
  const axC = new THREE.CatmullRomCurve3(AXP.map(V));
  const axAt = u => axC.getPointAt(clamp(u, 0, 1)).toArray();
  const AXE = axAt(0.86);   // where the impulse enters the bouton

  // the muscle membrane: the folds wander a little along z, and their depth changes
  const fX = (i, z) => FX[i] + 0.008 * Math.sin(z * 4.1 + i * 1.9) + 0.003 * Math.sin(z * 9.3 + i);
  const fD = (i, z) => FD[i] * (1 + 0.07 * Math.sin(z * 3.3 + i * 2.7));
  const lip = x => 0.24 * smooth((Math.abs(x) - 0.82) / 0.38);   // the gutter's walls round the bouton
  // the profile across x at depth z: crests at y0, the gutter's walls, and six folds (half width w at the mouth,
  // wider at the bottom, dd shallower than the membrane's folds); dip rounds the mouths. 252 points at every z
  function profile(z, y0, w, dd, dip) {
    const P = [];
    const crest = (xa, xb, n, skip) => {
      for (let k = skip ? 1 : 0; k <= n; k++) {
        const x = lerp(xa, xb, k / n); let y = y0 + lip(x);
        for (let i = 0; i < NF; i++) { const e = Math.abs(x - fX(i, z)) - w; if (e < 0.03) y -= dip * smooth(1 - e / 0.03); }
        P.push([x, y, z]);
      }
    };
    let x0 = -XS;
    for (let i = 0; i < NF; i++) {
      const cx = fX(i, z), D = fD(i, z) - dd;
      crest(x0, cx - w, i ? 7 : 18, i > 0); P.pop();
      for (let k = 0; k <= 30; k++) {
        const s = 0.5 - 0.5 * Math.cos(PI * k / 30), sn = Math.sin(PI * s);
        P.push([cx - w * (1 + 0.4 * Math.pow(sn, 4)) * Math.cos(PI * s), y0 - dip - (D + y0 - dip) * Math.pow(sn, 0.32), z]);
      }
      x0 = cx + w;
    }
    crest(x0, XS, 18, true);
    return P;
  }
  const memProf = z => profile(z, 0, FW, 0, 0.015);
  const lamProf = z => profile(z, YL, 0.008, 0.018, 0.03);
  // points every 'step' along a profile (arc length, starting at 'off'), with the outward normal (into the cleft)
  function along(P, step, off) {
    const out = [];
    let acc = -off;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-9) continue;
      const n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L, 0];
      while (acc + L >= 0) { const f = -acc / L; out.push({ p: [lerp(a[0], b[0], f), lerp(a[1], b[1], f), a[2]], n }); acc -= step; }
      acc += L;
    }
    return out;
  }
  const nearFold = x => { let k = 0; for (let i = 1; i < NF; i++) if (Math.abs(x - FX[i]) < Math.abs(x - FX[k])) k = i; return k; };
  // when the muscle's wave passes a point of its membrane (from the end plate outwards and down into the folds)
  const waveT = (x, y) => 0.42 + 0.35 * Math.max(0, Math.abs(x) - 0.45) + 0.25 * Math.max(0, -y);

  // ------------------------------------------------------------------ glass: every translucent membrane in one mesh
  const glass = Builder({ color: 3, aS: 4, aQ: 3 });
  const gAdd = (geo, col, s, q, m) => glass.add(geo, { color: col, aS: s, aQ: q }, m);
  const ring = (pts, closed) => u => {   // a polyline as a function u 0..1 -> point
    const n = closed ? pts.length : pts.length - 1, x = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
    return v3.lerp(pts[i], pts[(i + 1) % pts.length], f);
  };
  // the bouton (pale cyan), the impulse spreading from where the axon enters
  gAdd(surf(44, 72, (u, v) => { const th = u * PI, ph = v * TAU; return bPt([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]); }),
    [0.5, 0.8, 1.0], [9, 4, 1, 1], (x, y, z) => [0.14 + 0.1 * v3.dist([x, y, z], AXE), 1, 1]);
  // the axon, its myelin (two internodes and a node of Ranvier between them) and the terminal Schwann cell's sleeve
  gAdd(tubeFn(axAt, 90, 12, u => 0.072 + 0.1 * smooth((u - 0.8) / 0.2)), [0.55, 0.85, 1.0], [0, 4, 1, 1], (x, y, z, i) => [0.16 * Math.floor(i / 13) / 90, 1, 1.1]);
  for (const [u0, u1] of [[0.0, 0.37], [0.4, 0.72]]) {
    gAdd(tubeFn(u => axAt(lerp(u0, u1, u)), 40, 14, u => 0.074 + 0.06 * Math.pow(Math.sin(PI * u), 0.35)), [0.82, 0.8, 1.0], [0, 4, 1, 1], (x, y, z, i) => [0.16 * lerp(u0, u1, Math.floor(i / 15) / 40), 1, 0.75]);
  }
  gAdd(tubeFn(u => axAt(lerp(0.73, 0.9, u)), 16, 14, u => 0.1 + 0.03 * Math.sin(PI * u) + 0.06 * smooth(u)), [1.0, 0.86, 0.66], [0, 5, 1, 1], [0, 0, 0.7]);
  // the Schwann cell's cap over the bouton's top, with a ragged edge
  const capMax = ph => 0.42 * PI + 0.07 * Math.sin(3 * ph + 0.5) + 0.04 * Math.sin(7 * ph);
  const SND = v3.norm([0.28, 1, -0.32]);   // where the Schwann cell's nucleus bulges its cap
  const capPt = (th, ph) => { const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    return bPt(d, 0.035 + 0.012 * Math.sin(5 * ph + 2 * th) + 0.075 * Math.exp(-(1 - v3.dot(d, SND)) / 0.012)); };
  gAdd(surf(18, 72, (u, v) => capPt(u * capMax(v * TAU), v * TAU)), [1.0, 0.86, 0.66], [0, 5, 1, 1], [0, 0, 0.8]);
  // the muscle membrane over the folds (rose), fading at the back and the sides; the wave runs along it
  const memRows = []; for (let j = 0; j <= 18; j++) memRows.push(memProf(lerp(ZB, ZC, j / 18)));
  gAdd(rowsGeo(memRows), [1.0, 0.58, 0.7], [9, 1, 0, 0], (x, y, z) => [waveT(x, y), 2, 1.05 * smooth((z - ZB) / 0.22) * (0.3 + 0.7 * smooth((XS - Math.abs(x)) / 0.2)) * (0.3 + 0.4 * smooth((y + 0.06) / 0.06))]);
  // the basement membrane: a fibrous sheet through the middle of the cleft and down into every fold
  const lamRows = []; for (let j = 0; j <= 18; j++) lamRows.push(lamProf(lerp(ZB, ZC, j / 18)));
  gAdd(rowsGeo(lamRows), [0.35, 0.85, 1.0], [2, 2, 0, 0], (x, y, z) => [0, 4, 0.9 * smooth((z - ZB) / 0.22) * (0.3 + 0.7 * smooth((XS - Math.abs(x)) / 0.2)) * (0.3 + 0.7 * smooth((y + 0.02) / 0.07))]);
  // the fibre's surface round the junction (a wide cylinder along x), cut away where the section is
  {
    const RF = 3.2, yc = 0.2 - RF, aB = Math.asin(ZB / RF), xs = [], as = [];
    for (let k = 0; k <= 22; k++) xs.push(lerp(-5, -XS, k / 22));
    for (let k = 1; k <= 8; k++) xs.push(lerp(-XS, XS, k / 8));
    for (let k = 1; k <= 22; k++) xs.push(lerp(XS, 5, k / 22));
    for (let k = 0; k <= 10; k++) as.push(lerp(-1.05, aB, k / 10));
    for (let k = 1; k <= 14; k++) as.push(lerp(aB, 1.05, k / 14));
    const rows = as.map(a => xs.map(x => [x, yc + RF * Math.cos(a), RF * Math.sin(a)]));
    const g = rowsGeo(rows), ix = g.index.array, keep = [], nc = xs.length;
    for (let q = 0; q < ix.length; q += 3) {
      const c = [ix[q], ix[q + 1], ix[q + 2]].map(i => [xs[i % nc], as[Math.floor(i / nc)]]);
      const mx = (c[0][0] + c[1][0] + c[2][0]) / 3, ma = (c[0][1] + c[1][1] + c[2][1]) / 3;
      if (!(Math.abs(mx) < XS && ma > aB)) keep.push(ix[q], ix[q + 1], ix[q + 2]);
    }
    g.setIndex(keep);
    gAdd(g, [1.0, 0.6, 0.7], [0, 1, 0, 0], (x, y, z) => [0.4 + 0.1 * Math.max(0, Math.abs(x) - 0.9), 3, 0.45 * smooth((5 - Math.abs(x)) / 1.6) * smooth((3.2 * 0.87 - Math.abs(z)) / 0.8)]);
  }
  {   // the fibre's cut face: a faint tint under the membrane's profile, fading towards the sides and the bottom
    const top = memProf(ZC - 0.002), rows = [top, top.map(p => [p[0], -1.18, p[2]])];
    gAdd(rowsGeo(rows), [1.0, 0.5, 0.6], [0, 0, 0, 0], (x, y) => [0, 6, smooth((XS - Math.abs(x)) / 0.35) * (0.4 + 0.6 * smooth((y + 1.18) / 0.4))]);
  }
  // cut edges, where the cut plane meets the bouton, the Schwann cell, the muscle membrane and the basement membrane
  const edge = (pts, closed, col, s, gain) => gAdd(tubeFn(ring(pts, closed), pts.length * 2, 4, 0.0045), col, s, [0, 0, gain]);
  const BCUT = [];
  for (let k = 0; k < 140; k++) {
    const a = k / 140 * TAU, dir = [Math.cos(a), Math.sin(a)];
    let lo = 0, hi = 1.2;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (bIn([dir[0] * m, BC[1] + dir[1] * m, ZC], 0, true)) lo = m; else hi = m; }
    BCUT.push([dir[0] * lo, BC[1] + dir[1] * lo, ZC]);
  }
  edge(BCUT, true, [0.6, 0.9, 1.0], [9, 4, 1, 0], 2.4);
  {   // the cap's edge: the bouton's cut, pushed out, where the cap covers it
    let run = [];
    const flush = () => { if (run.length > 3) edge(run, false, [1.0, 0.85, 0.65], [0, 5, 1, 0], 2.0); run = []; };
    for (const p of BCUT) {
      const q = v3.sub(p, BC), d = v3.norm(q), th = Math.acos(clamp(d[1], -1, 1)), ph = Math.atan2(d[2], d[0]);
      if (th < capMax(ph) - 0.03) { const l = Math.hypot(q[0], q[1]) || 1; run.push([p[0] + q[0] / l * 0.04, p[1] + q[1] / l * 0.04, ZC]); } else flush();
    }
    flush();
  }
  edge(memProf(ZC), false, [1.0, 0.68, 0.8], [9, 1, 0, 0], 2.2);
  edge(lamProf(ZC), false, [0.45, 0.9, 1.0], [2, 2, 0, 0], 1.6);

  // ------------------------------------------------------------------ solid parts (lit), one mesh
  const solid = Builder({ color: 3, aS: 4, aQ: 3, aCtr: 3 });
  const sAdd = (geo, col, s, ctr, m) => solid.add(geo, { color: col, aS: s, aQ: [0, 0, 1], aCtr: ctr }, m);
  const PTS = [];   // static points (rapsyn, chromatin, pores, ribosomes) and effects, filled below
  // pt(position, colour, size, alpha, kind (0 still, 1 receptor pore, 2 acetylcholine, 3 calcium), [slot, stage, moves], kind data, target)
  const pt = (p, col, size, a, k, sk, e, to) => PTS.push({ p, col, size, a, k, sk: sk || [0, 0, 0], e: e || [0, 0, 0], to: to || p });
  // a mitochondrion: outer membrane (glass), inner membrane (solid, seen from inside where it is cut) and lamellar
  // cristae from alternate walls, across its long axis
  const MITO = [];
  function mito(c, ax, r, h, site, stage, mv) {
    const a = v3.norm(ax), e1 = v3.norm(v3.cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), e2 = v3.cross(a, e1);
    const at = (s, ph, k) => {
      const rho = r * k * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(s), 2.6))), b = 0.18 * r * (1 - s * s);
      return v3.add(v3.add(c, v3.mul(a, s * (h + r))), v3.add(v3.mul(e1, rho * Math.cos(ph) + b), v3.mul(e2, rho * Math.sin(ph))));
    };
    gAdd(surf(26, 22, (u, v) => at(2 * u - 1, v * TAU, 1)), [0.8, 0.62, 1.0], [site, stage, mv, 1], [0, 0, 1.3]);
    sAdd(surf(22, 20, (u, v) => at(2 * u - 1, v * TAU, 0.86)), [0.5, 0.36, 0.78], [site, stage, mv, 1], c);
    const nc = Math.round((h + r) / 0.028);
    for (let k = 0; k < nc; k++) {
      const s = lerp(-0.74, 0.74, (k + 0.5) / nc), side = k % 2 ? 1 : -1, rho = r * 0.86 * Math.sqrt(1 - Math.pow(Math.abs(s), 2.6));
      const cc = v3.add(at(s, 0, 0), v3.mul(e1, side * 0.4 * rho));
      const m = new THREE.Matrix4().makeBasis(V(e1), V(a), V(e2)).setPosition(...cc);
      sAdd(ellipsoid([0, 0, 0], [0.52 * rho, 0.0055, 0.74 * rho], 5, 12), [0.86, 0.62, 1.0], [site, stage, mv, 1], c, m);
    }
    MITO.push({ c, a, r, h, at });
  }
  mito([-0.3, 0.5, ZC - 0.01], [1, 0.15, -0.12], 0.07, 0.15, 1, 4, 1);
  mito([0.31, 0.55, ZC - 0.035], [1, -0.22, 0.18], 0.064, 0.13, 1, 4, 1);
  mito([0.05, 0.44, -0.22], [0.35, 0.12, 1], 0.06, 0.13, 1, 4, 1);
  mito([0.3, -0.63, 0.16], [1, -0.08, 0.22], 0.052, 0.13, 0, 0, 0);    // and three in the muscle fibre
  mito([-1.0, -0.6, 0.06], [0.25, 0.05, 1], 0.05, 0.12, 0, 0, 0);
  mito([0.98, -0.72, 0.18], [1, 0.12, -0.1], 0.048, 0.12, 0, 0, 0);
  // endosomes: larger, lumpy, darker vesicles in the nerve ending
  const ENDS = [[0.56, 0.34, 0.12, 0.058], [-0.55, 0.3, 0.06, 0.05], [0.2, 0.62, -0.26, 0.068]];
  for (const [x, y, z, r] of ENDS) {
    const k = R() * TAU;
    sAdd(ellipsoid([x, y, z], [r * 1.15, r * 0.85, r], 14, 18, (th, ph) => 0.16 * Math.sin(2 * th + k) * Math.sin(3 * ph + k) + 0.06 * Math.sin(5 * ph)), [0.4, 0.56, 0.47], [6, 4, 1, 1], [x, y, z]);
  }
  // active zones: dense bars on the nerve's membrane, over the mouths of the folds, with knobs (dense projections)
  const azF = AZ.map(i => u => { const z = lerp(-0.32, 0.3, u), x = fX(i, z); return [x, bBot(x, z) + 0.005, z]; });
  azF.forEach(f => sAdd(tubeFn(f, 40, 6, (u, a) => (0.011 + 0.0025 * Math.cos(2 * a)) * (1 + 0.3 * Math.max(0, Math.sin(u * 60))) * Math.min(1, Math.sin(PI * u) * 5)),
    [0.34, 0.38, 0.54], [7, 4, 1, 0], f(0.5)));
  // agrin: strands from the nerve's side through the cleft to the muscle's crests, beaded with its domains
  const AGR = [];
  for (let k = 0; k < 22; k++) {
    const i = Math.floor(R() * 5), x0 = lerp(FX[i], FX[i + 1], 0.22 + 0.56 * R()), z0 = lerp(-0.42, 0.28, R());
    const top = [x0 + gauss(R) * 0.02, bBot(x0, z0) - 0.002, z0], bot = [x0 + gauss(R) * 0.03, 0.008, z0 + gauss(R) * 0.03], ph = R() * TAU;
    const f = u => { const p = v3.lerp(top, bot, u), s = Math.sin(PI * u); return [p[0] + 0.012 * s * Math.sin(u * 9 + ph), p[1], p[2] + 0.012 * s * Math.cos(u * 7 + ph)]; };
    sAdd(tubeFn(f, 14, 4, 0.0015), [0.5, 0.95, 0.86], [2, 5, 0, 0], bot); AGR.push(f(0.42));
    for (const u of [0.18, 0.42, 0.66, 0.88]) sAdd(new THREE.IcosahedronGeometry(0.0042, 1).translate(...f(u)), [0.62, 1.0, 0.9], [2, 5, 0, 0], bot);
  }
  // the Schwann cell's nucleus, under its cap
  { const p = bPt(SND, 0.07); sAdd(ellipsoid(p, [0.15, 0.035, 0.1], 10, 20), [0.62, 0.5, 0.38], [0, 5, 1, 1], p); }
  // the junction's own nuclei: a double envelope (glass), the inside where nucleus A is cut, a nucleolus, chromatin
  for (const [c, r, cut] of [[NA, NAR, true], [NB, NBR, false]]) {
    gAdd(ellipsoid(c, r, 26, 40), [0.55, 0.6, 1.0], [10, 0, 0, 1], [0, 0, 1.0]);
    gAdd(ellipsoid(c, r.map(x => x - 0.011), 26, 40), [0.55, 0.6, 1.0], [10, 0, 0, 1], [0, 0, 0.6]);
    if (cut) sAdd(ellipsoid(c, r.map(x => x - 0.015), 22, 36), [0.22, 0.2, 0.42], [10, 0, 0, 1], c);
    const nu = [c[0] + 0.25 * r[0], c[1] - 0.15 * r[1], c[2] - 0.3 * r[2]];
    sAdd(ellipsoid(nu, [0.05, 0.042, 0.045].map(x => x * r[0] / 0.28), 10, 14, (th, ph) => 0.08 * Math.sin(3 * ph) * Math.sin(2 * th)), [0.5, 0.36, 0.72], [10, 0, 0, 1], c);
    for (let k = 0; k < (cut ? 520 : 300); k++) {   // chromatin, denser under the envelope; pores in the envelope
      const d = K.unit(R), q = k % 3 ? 0.8 + 0.16 * R() : Math.cbrt(R()) * 0.9, p = [c[0] + d[0] * r[0] * q, c[1] + d[1] * r[1] * q, c[2] + d[2] * r[2] * q];
      if (p[2] < ZC - 0.004) pt(p, [0.5, 0.45, 0.95], 0.011 + 0.008 * R(), 0.5, 0, [10, 0, 0]);
    }
    for (let k = 0; k < 80; k++) {
      const d = K.unit(R), p = [c[0] + d[0] * (r[0] - 0.005), c[1] + d[1] * (r[1] - 0.005), c[2] + d[2] * (r[2] - 0.005)];
      if (p[2] < ZC - 0.003) pt(p, [0.75, 0.85, 1.0], 0.009, 0.8, 0, [10, 0, 0]);
    }
  }
  {   // nucleus A's cut edge
    const s = Math.sqrt(1 - Math.pow((ZC - NA[2]) / NAR[2], 2)), e = [];
    for (let k = 0; k < 80; k++) { const a = k / 80 * TAU; e.push([NA[0] + NAR[0] * s * Math.cos(a), NA[1] + NAR[1] * s * Math.sin(a), ZC]); }
    edge(e, true, [0.6, 0.66, 1.0], [10, 0, 0, 0], 2.0);
  }
  // endoplasmic reticulum: three wavy sheets wrapped round nucleus A's left half, studded with ribosomes
  const ERP = [];
  for (let k = 0; k < 3; k++) {
    const off = 0.035 + 0.034 * k, rows = [];
    for (let i = 0; i <= 16; i++) {
      const th = lerp(0.3 * PI, 0.8 * PI, i / 16), row = [];
      for (let j = 0; j <= 26; j++) {
        const ph = lerp(0.56 * PI, 1.5 * PI, j / 26), w = off + 0.007 * Math.sin(th * 9 + k) * Math.sin(ph * 7 + 2 * k);
        const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        const p = [NA[0] + (NAR[0] + w) * d[0], NA[1] + (NAR[1] + w * 0.8) * d[1], NA[2] + (NAR[2] + w) * d[2]];
        row.push(p);
        if (p[2] < ZC - 0.005 && R() < 0.5) { const q = v3.add(p, v3.mul(d, R() < 0.5 ? 0.006 : -0.006)); pt(q, [0.95, 0.6, 0.7], 0.008, 0.6, 0, [5, 0, 0]); if (k === 2) ERP.push(q); }
      }
      rows.push(row);
    }
    sAdd(rowsGeo(rows), [0.78, 0.45, 0.55], [5, 0, 0, 1], NA);
  }
  // the Golgi stack at nucleus A's right end: five curved cisternae, convex towards the nucleus, budding vesicles
  const GOR = [0.12, 0.13, 0.13, 0.12, 0.1];
  GOR.forEach((Rk, k) => {
    const x0 = GO[0] - 0.052 + 0.026 * k;
    sAdd(surf(8, 24, (u, v) => {
      const th = u * PI, ph = v * TAU, s = Math.sin(th), y = Rk * s * Math.cos(ph) * 0.75, z = Rk * s * Math.sin(ph);
      return [x0 + 0.0075 * Math.cos(th) + 1.4 * (y * y + z * z) + 0.006 * Math.sin(ph * 3 + k), GO[1] + y, GO[2] + z];
    }), [0.42, 0.74, 0.66], [3, 0, 0, 1], GO);
  });
  for (let k = 0; k < 16; k++) {
    const a = R() * TAU, rr = 0.125 + 0.025 * R(), y = rr * Math.cos(a) * 0.75, z = rr * Math.sin(a), x = GO[0] + lerp(-0.05, 0.08, R()) + 1.4 * (y * y + z * z);
    sAdd(new THREE.SphereGeometry(0.011, 8, 6).translate(x, GO[1] + y, GO[2] + z), [0.5, 0.82, 0.72], [3, 0, 0, 1], GO);
  }

  // ------------------------------------------------------------------ the myofibrils, desmin and plectin (they twitch)
  const myo = Builder({ color: 3, aS: 4, aQ: 3, aCtr: 3 });
  const ZX = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(n => n * ZP);   // the Z-discs
  const CYLX = new THREE.CylinderGeometry(MYR, MYR, 2 * XS - 0.04, 24, 1, false).rotateZ(PI / 2);
  for (const [y, z] of MYO) myo.add(CYLX.clone().translate(0, y, z), { color: [0.46, 0.22, 0.28], aS: [8, 0, 0, 0], aQ: [0, 5, 1], aCtr: [0, y, z] });
  const STRUT = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
  const mAdd = (geo, col, ctr, m) => myo.add(geo, { color: col, aS: [8, 0, 0, 0], aQ: [0, 0, 1], aCtr: ctr }, m);
  const DES = [0.95, 0.8, 0.6], PLE = [1.0, 0.68, 0.36];
  for (const x of ZX) {
    for (const [y, z] of MYO) mAdd(new THREE.TorusGeometry(MYR + 0.005, 0.0038, 4, 26).rotateY(PI / 2).translate(x, y, z), DES, [x, y, z]);
    for (let i = 0; i < MYO.length; i++) for (let j = i + 1; j < MYO.length; j++) {   // links between neighbouring rings
      const [ya, za] = MYO[i], [yb, zb] = MYO[j], d = Math.hypot(yb - ya, zb - za);
      if (d > 0.2) continue;
      const u = [(yb - ya) / d, (zb - za) / d], a = [x, ya + u[0] * (MYR + 0.006), za + u[1] * (MYR + 0.006)], b = [x, yb - u[0] * (MYR + 0.006), zb - u[1] * (MYR + 0.006)];
      mAdd(STRUT, DES, a, strutM(a, b, 0.0032));
      if ((i + j + Math.round(x * 10)) % 3 === 0) mAdd(new THREE.IcosahedronGeometry(0.0075, 0).translate(...v3.lerp(a, b, 0.5)), PLE, a);
    }
  }
  // plectin: from the top row's desmin rings up to the nuclei, a mitochondrion and the bottoms of the folds
  const PLX = [];
  for (const [x0, z0, to] of [[ZX[1], 0.22, [NA[0] - 0.05, NA[1] - NAR[1], 0.2]], [ZX[2], 0.05, [NA[0] + 0.12, NA[1] - NAR[1] * 0.9, 0.12]], [ZX[3], 0.22, [0.3, -0.68, 0.16]],
    [ZX[4], -0.12, [NB[0], NB[1] - NBR[1], NB[2]]], [ZX[3], -0.29, [fX(3, -0.29), -fD(3, -0.29) - 0.01, -0.29]], [ZX[1], -0.12, [fX(1, -0.12), -fD(1, -0.12) - 0.01, -0.12]],
    [ZX[4], 0.05, [fX(4, 0.05), -fD(4, 0.05) - 0.01, 0.05]]]) {
    const yTop = MYO.find(m => m[1] === z0)[0] + MYR + 0.005, a = [x0, yTop, z0], ph = R() * TAU;
    const f = u => { const p = v3.lerp(a, to, u), s = Math.sin(PI * u); return [p[0] + 0.02 * s * Math.sin(u * 8 + ph), p[1], p[2] + 0.015 * s * Math.cos(u * 6 + ph)]; };
    mAdd(tubeFn(f, 20, 4, 0.0032), PLE, a);
    for (const u of [0.0, 0.5, 1.0]) mAdd(new THREE.IcosahedronGeometry(0.008, 0).translate(...f(u)), PLE, a);
    PLX.push(f(0.5));
  }

  // ------------------------------------------------------------------ instanced parts
  const IB = () => Builder({ color: 3, aS: 4, aQ: 3 });
  const iAdd = (B, geo, col, s, m) => B.add(geo, { color: col, aS: s, aQ: [0, 0, 1] }, m);
  // a tapered n-sided prism along y (a subunit), with a top cap
  function prism(n, r0, r1, y0, y1) {
    const P = [], idx = [];
    for (const [r, y] of [[r0, y0], [r1, y1]]) for (let k = 0; k < n; k++) { const a = k / n * TAU; P.push(r * Math.cos(a), y, r * Math.sin(a)); }
    for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; idx.push(k, n + k, k1, k1, n + k, n + k1); }
    for (let k = 1; k < n - 1; k++) idx.push(n, n + k + 1, n + k);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function inst(geo, mat, mats, order) {
    const m = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((M, i) => m.setMatrixAt(i, M));
    m.frustumCulled = false; m.renderOrder = order || 1; set.group.add(m);
    return m;
  }
  const grow = 'transformed *= vK;';

  // synaptic vesicles: four clusters over the active zones, four docked at each (the release sites)
  const DOCK = [];
  AZ.forEach(i => [-0.14, -0.02, 0.1, 0.22].forEach((z, k) => { const x = fX(i, z) + (k % 2 ? 0.032 : -0.032); DOCK.push([x, bBot(x, z) + 0.022, z]); }));
  const VES = DOCK.map(p => p.slice());
  for (let n = 0; VES.length < 166 && n < 30000; n++) {
    const pool = R() < 0.25, j = Math.floor(R() * 4);
    const p = [fX(AZ[j], 0) + gauss(R) * (pool ? 0.22 : 0.09), YP + 0.048 + Math.abs(gauss(R)) * (pool ? 0.25 : 0.11), lerp(-0.55, ZC - 0.024, Math.sqrt(R()))];
    if (!bIn(p, 0.035) || VES.some(q => v3.dist(p, q) < 0.045)) continue;
    VES.push(p);
  }
  const vb = IB(); iAdd(vb, new THREE.IcosahedronGeometry(0.021, 1), [0.42, 0.6, 0.92], [7, 4, 0, 0]);
  const vesMat = lit('ves', { self: 0.12, rimK: 0.4, rimC: [0.55, 0.85, 1.0], rough: 0.35, vb: grow });
  const vesMesh = inst(vb.geo(), vesMat, VES.map(p => new THREE.Matrix4().makeTranslation(...p)), 2);
  VES.forEach((p, i) => vesMesh.setColorAt(i, new THREE.Color().setScalar(0.88 + 0.16 * R())));
  const VPH = VES.map(() => R() * TAU);

  // acetylcholine receptors: five subunits round a pore (alpha, epsilon, alpha, delta, beta, faintly coloured),
  // packed on the crests and down the folds' upper walls; rapsyn under each; a few MuSK/LRP4 pairs among them
  const SUB = [[1.0, 0.45, 0.5], [0.5, 0.6, 1.0], [1.0, 0.45, 0.5], [0.45, 0.95, 0.6], [1.0, 0.9, 0.4]].map(c => v3.mul(v3.lerp([0.95, 0.72, 0.5], c, 0.3), 0.72));
  const rb = IB();
  SUB.forEach((c, k) => { const a = k / 5 * TAU; iAdd(rb, prism(5, 0.0048, 0.0036, -0.005, 0.0135).translate(0.0063 * Math.cos(a), 0, 0.0063 * Math.sin(a)), c, [4, 3, 0, 0]); });
  iAdd(rb, new THREE.OctahedronGeometry(0.0045, 0).scale(1.3, 0.7, 1.3).translate(0, -0.011, 0), [0.7, 0.55, 0.95], [9, 3, 0, 0]);   // rapsyn, under it
  const REC = [], MUSK = [];
  for (let z = ZB + 0.06, row = 0; z < ZC - 0.012; z += 0.032, row++) {
    for (const s of along(memProf(z), 0.032, (row % 2) * 0.016 + 0.004)) {
      const [x, y] = s.p;
      if (Math.abs(x) > 0.79 || y < -0.065) continue;
      const p = [x + gauss(R) * 0.0025, y, z + gauss(R) * 0.004];
      (y > -0.004 && R() < 0.03 ? MUSK : REC).push({ p, n: s.n });
    }
  }
  const nearDock = p => { let b = 0, bd = 9; DOCK.forEach((q, s) => { const d = (p[0] - q[0]) ** 2 + p[1] ** 2 + (p[2] - q[2]) ** 2; if (d < bd) { bd = d; b = s; } }); return [b, bd]; };
  const aR = new Float32Array(REC.length * 3), aOff = new Float32Array(REC.length * 3);
  REC.forEach((r, i) => {
    const [s, d] = nearDock(r.p), rnd = R();
    aR.set([s, d, rnd], i * 3); aOff.set([gauss(R) * 0.22, 0, gauss(R) * 0.22], i * 3);
    pt(v3.add(r.p, v3.mul(r.n, 0.017)), [1.0, 0.92, 0.65], 0.017, 1, 1, [4, 3, 0], [s, d, rnd]);         // the pore, lit when open
  });
  const rg = rb.geo();
  rg.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 3)); rg.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 3));
  const recMat = lit('rec', { self: 0.12, rimK: 0.2, rimC: [1.0, 0.85, 0.6], vh: 'attribute vec3 aR, aOff;' + OPEN,
    // they gather from all over the membrane as the junction builds (each a little later than the last), and light up when open
    vb: `{ float k = clamp(vK * 1.6 - aR.z * 0.6, 0.0, 1.0); transformed = transformed * smoothstep(0.0, 0.25, k) + aOff * (1.0 - smoothstep(0.0, 1.0, k));
  vGC += vec3(1.0, 0.88, 0.55) * openR(aR) * 0.85; }` });
  const recMesh = inst(rg, recMat, REC.map(r => orient(r.p, r.n, R() * TAU, 1)), 1);
  // MuSK/LRP4: LRP4 (agrin's receptor) a tall stalk ending in beta-propellers, MuSK a shorter one with Ig domains and
  // its kinase inside, DOK7 under it
  const mb = IB(), LR = [0.72, 1.0, 0.6], MK = [0.55, 0.95, 0.85];
  const lrF = u => [0.006 + 0.004 * Math.sin(u * 3), -0.004 + 0.036 * u, 0.002 * Math.sin(u * 5)], mkF = u => [-0.006, -0.004 + 0.024 * u, 0.001];
  iAdd(mb, tubeFn(lrF, 8, 4, 0.0016), LR, [9, 3, 0, 0]);
  for (const u of [0.38, 0.62, 0.84, 1.0]) iAdd(mb, new THREE.IcosahedronGeometry(0.0052, 0).translate(...lrF(u)), LR, [9, 3, 0, 0]);
  iAdd(mb, tubeFn(mkF, 6, 4, 0.0014), MK, [9, 3, 0, 0]);
  for (const u of [0.45, 0.75, 1.0]) iAdd(mb, new THREE.IcosahedronGeometry(0.0038, 0).translate(...mkF(u)), MK, [9, 3, 0, 0]);
  iAdd(mb, new THREE.IcosahedronGeometry(0.0068, 0).translate(-0.006, -0.014, 0), [0.95, 0.9, 0.55], [9, 3, 0, 0]);
  iAdd(mb, new THREE.IcosahedronGeometry(0.005, 0).translate(-0.003, -0.025, 0.004), [1.0, 0.72, 0.5], [9, 3, 0, 0]);
  const muskMesh = inst(mb.geo(), lit('musk', { self: 0.25, rimK: 0.5, vb: grow }), MUSK.map(r => orient(r.p, r.n, R() * TAU, 1)), 1);

  // sodium channels (Nav1.4) in the troughs: four domains round a pore; they light as the wave passes
  const NAV = [];
  for (let z = ZB + 0.05, row = 0; z < ZC - 0.012; z += 0.05, row++) {
    for (const s of along(memProf(z), 0.05, (row % 2) * 0.025)) {
      const [x, y] = s.p, i = nearFold(x);
      if (Math.abs(x - fX(i, z)) > 0.06 || y > -0.45 * fD(i, z)) continue;
      NAV.push({ p: [x, y + gauss(R) * 0.01 * Math.abs(s.n[0]), z + gauss(R) * 0.012], n: s.n, w: waveT(x, y) });
    }
  }
  const nb = IB();
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; iAdd(nb, prism(5, 0.0044, 0.0036, -0.01, 0.01).translate(0.006 * Math.cos(a), 0, 0.006 * Math.sin(a)), [0.72, 0.66, 0.88], [4, 3, 0, 0]); }
  const ng = nb.geo(); ng.setAttribute('aW', new THREE.InstancedBufferAttribute(new Float32Array(NAV.map(c => c.w)), 1));
  const navMesh = inst(ng, lit('nav', { self: 0.25, rimK: 0.5, rimC: [1.0, 0.85, 0.6], vh: 'attribute float aW;',
    vb: grow + ' { float d = uPh - aW; vGC += vec3(1.0, 0.75, 0.35) * uWave * 3.2 * exp(-d * d / 0.0025); }' }), NAV.map(c => orient(c.p, c.n, R() * TAU, 1)), 1);

  // the basement membrane's laminin: crosses (one long arm ending in a globular head, three short arms) lying in it
  const lb = IB(), LC = [0.18, 0.55, 0.8], LE = [0.35, 0.78, 1.0], ST3 = new THREE.CylinderGeometry(1, 1, 1, 3, 1, true);
  for (const [e, r, cr] of [[[0.046, 0, 0.004], 0.0011, 0.0052], [[-0.022, 0, 0.003], 0.0009, 0.0032], [[0.002, 0, 0.022], 0.0009, 0.0032], [[0.001, 0, -0.022], 0.0009, 0.0032]]) {
    iAdd(lb, ST3, LC, [2, 2, 0, 0], strutM([0, 0, 0], e, r));
    iAdd(lb, new THREE.TetrahedronGeometry(cr, 0).translate(...e), LE, [2, 2, 0, 0]);
  }
  const LAMI = [];
  for (let z = ZB + 0.04; z < ZC - 0.01; z += 0.095) {
    for (const s of along(lamProf(z), 0.085, R() * 0.085)) {
      if (Math.abs(s.p[0]) > XS - 0.05) continue;
      const p = v3.add(s.p, v3.mul(s.n, gauss(R) * 0.006)); p[2] = Math.min(ZC - 0.012, p[2] + (R() - 0.5) * 0.07);
      LAMI.push(orient(p, v3.norm(v3.add(s.n, [gauss(R) * 0.15, 0, gauss(R) * 0.15])), R() * TAU, 0.85 + 0.3 * R()));
    }
  }
  const lamMesh = inst(lb.geo(), lit('lam', { self: 0.3, rimK: 0.25, rimC: [0.4, 0.85, 1.0], vb: grow }), LAMI, 1);

  // acetylcholinesterase: three globular enzymes on the triple-helix tail of collagen Q, anchored in the basement membrane
  const ab = IB();
  for (let s = 0; s < 3; s++) iAdd(ab, tubeFn(u => { const a = u * 9 + s * TAU / 3; return [0.0022 * Math.cos(a), u * 0.05, 0.0022 * Math.sin(a)]; }, 18, 3, 0.0011), [0.6, 0.9, 1.0], [2, 5, 0, 0]);
  for (let s = 0; s < 3; s++) { const a = s * TAU / 3; iAdd(ab, new THREE.IcosahedronGeometry(0.0062, 1).translate(0.0085 * Math.cos(a), 0.056 + 0.003 * s, 0.0085 * Math.sin(a)), [0.74, 1.0, 0.7], [2, 5, 0, 0]); }
  const ACHE = [];
  for (let n = 0; ACHE.length < 34 && n < 500; n++) {
    const x = lerp(-0.76, 0.76, R()), z = lerp(ZB + 0.08, ZC - 0.03, R());
    if (FX.some((f, i) => Math.abs(x - fX(i, z)) < 0.045)) continue;
    const up = R() < 0.6, n3 = v3.norm([gauss(R) * 0.35, up ? 1 : -1, gauss(R) * 0.35]);
    ACHE.push({ p: [x, YL + lip(x) + (up ? 0.004 : -0.004), z], n: n3 });
  }
  const acheMesh = inst(ab.geo(), lit('ache', { self: 0.3, rimK: 0.5, vb: grow }), ACHE.map(a => orient(a.p, a.n, R() * TAU, 1)), 1);

  // ------------------------------------------------------------------ lines: collagen IV and XIII, actin, microtubules
  const LS = [];
  const seg = (a, b, col, al, s) => LS.push([a, b, col, al, s]);
  {   // collagen IV: a chicken-wire net in the basement membrane
    let prev = null;
    for (let z = ZB + 0.03, j = 0; z < ZC - 0.005; z += 0.045, j++) {
      const row = along(lamProf(z), 0.05, (j % 2) * 0.025).map(s => v3.add(s.p, [gauss(R) * 0.004, gauss(R) * 0.004, gauss(R) * 0.008]));
      for (let i = 1; i < row.length; i++) if (Math.abs(row[i][0]) < XS - 0.04) seg(row[i - 1], row[i], [0.4, 0.82, 1.0], 0.07, [2, 2, 0]);
      if (prev) for (let i = 0; i < row.length; i++) { const q = prev[Math.min(prev.length - 1, Math.round(i * prev.length / row.length))]; if (v3.dist(q, row[i]) < 0.09 && Math.abs(q[0]) < XS - 0.04) seg(q, row[i], [0.4, 0.82, 1.0], 0.05, [2, 2, 0]); }
      prev = row;
    }
  }
  for (let k = 0; k < 60; k++) {   // collagen XIII: rods from the muscle's surface into the cleft
    const x = (R() < 0.5 ? -1 : 1) * lerp(0.1, 0.95, R()), z = lerp(ZB + 0.05, ZC - 0.02, R());
    if (FX.some((f, i) => Math.abs(x - fX(i, z)) < 0.04)) continue;
    const a = [x, lip(x) + 0.004, z], n = v3.norm([gauss(R) * 0.4 - Math.sign(x) * lip(x) * 2, 1, gauss(R) * 0.4]);
    seg(a, v3.add(a, v3.mul(n, 0.035 + 0.02 * R())), [0.6, 1.0, 0.86], 0.55, [2, 2, 0]);
  }
  for (let k = 0, n = 0; k < 460 && n < 5000; n++) {   // actin in the nerve ending, densest under its membrane
    const d = K.unit(R), cortex = R() < 0.6, q = cortex ? 0.8 + 0.16 * R() : Math.cbrt(R()) * 0.9, p = v3.add(BC, v3.mul(d, bR(d) * q));
    const e = v3.add(p, v3.mul(K.unit(R), 0.05 + 0.06 * R()));
    if (p[2] > ZC - 0.01 || e[2] > ZC - 0.01 || !bIn(p, 0.012) || !bIn(e, 0.012)) continue;
    seg(p, e, [0.72, 0.74, 1.0], 0.12, [0, 4, 1]); k++;
  }
  for (let k = 0; k < 6; k++) {   // microtubules along the axon
    const o = [0, 0.04 * Math.cos(k * 1.05), 0.04 * Math.sin(k * 1.05)];
    for (let i = 0; i < 44; i++) seg(v3.add(axAt(i / 50), o), v3.add(axAt((i + 1) / 50), o), [0.6, 0.86, 1.0], 0.3, [0, 4, 1]);
  }
  const lg = K.linesGeo(LS.length), lK = new Float32Array(LS.length * 8);
  LS.forEach(([a, b, c, al, s], i) => {
    lg.attributes.position.array.set(a, i * 6); lg.attributes.position.array.set(b, i * 6 + 3);
    lg.attributes.aCol.array.set(c, i * 6); lg.attributes.aCol.array.set(c, i * 6 + 3);
    lg.attributes.aA.array[i * 2] = lg.attributes.aA.array[i * 2 + 1] = al;
    lK.set([...s, 0, ...s, 0], i * 8);
  });
  lg.setAttribute('aK', new THREE.BufferAttribute(lK, 4));
  const PU = { uG: SU.uG, uD: SU.uD, uSC: SU.uSC, uStage: SU.uStage, uNerveY: SU.uNerveY, uPh: SU.uPh, uFire: SU.uFire, uFuse: SU.uFuse };
  const lnMat = K.lines(set, { uniforms: PU,
    head: 'attribute vec4 aK; uniform float uG[12], uD[12], uStage[6], uNerveY; uniform vec3 uSC[12];',
    vertex: `{ int si = int(aK.x + 0.5); int st = int(aK.y + 0.5); pos.y += aK.z * uNerveY;
  vA *= uStage[st] * (0.3 + 0.7 * uD[si]); vC = vC * (0.4 + 0.6 * uD[si]) + uSC[si] * uG[si] * 1.2;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0); }` });
  const lnObj = new THREE.LineSegments(lg, lnMat); lnObj.frustumCulled = false; lnObj.renderOrder = 6; set.group.add(lnObj);

  // ------------------------------------------------------------------ points: still ones and the firing's effects
  DOCK.forEach((q, s) => {
    for (let k = 0; k < 18; k++) {   // acetylcholine: a puff from each release site across the cleft onto the crests and into the folds
      const x = q[0] + gauss(R) * 0.045, z = clamp(q[2] + gauss(R) * 0.045, ZB, ZC - 0.01), i = nearFold(x), inFold = Math.abs(x - fX(i, z)) < FW * 0.8;
      pt([q[0] + gauss(R) * 0.006, q[1] - 0.02, q[2] + gauss(R) * 0.006], [1.0, 0.95, 0.72], 0.016, 1, 2, [9, 4, 0], [s, R(), 0], [x, inFold ? -R() * 0.07 : 0.022 + R() * 0.012, z]);
    }
    pt([q[0] + (s % 2 ? 0.012 : -0.012), YP + 0.004, q[2]], [0.6, 1.0, 0.75], 0.065, 1, 3, [7, 4, 1]);   // calcium rushing in beside it
  });
  const pg = K.pointsGeo(PTS.length), pK = new Float32Array(PTS.length * 4), pE = new Float32Array(PTS.length * 3), pTo = new Float32Array(PTS.length * 3);
  PTS.forEach((q, i) => {
    pg.attributes.position.array.set(q.p, i * 3); pg.attributes.aCol.array.set(q.col, i * 3);
    pg.attributes.aSize.array[i] = q.size; pg.attributes.aA.array[i] = q.a;
    pK.set([q.k, ...q.sk], i * 4); pE.set(q.e, i * 3); pTo.set(q.to, i * 3);
  });
  pg.setAttribute('aK', new THREE.BufferAttribute(pK, 4)); pg.setAttribute('aE', new THREE.BufferAttribute(pE, 3)); pg.setAttribute('aTo', new THREE.BufferAttribute(pTo, 3));
  const ptMat = K.points(set, { uniforms: PU,
    head: 'attribute vec4 aK; attribute vec3 aE, aTo; uniform float uG[12], uD[12], uStage[6], uNerveY, uPh, uFire; uniform vec3 uSC[12];' + OPEN,
    vertex: `{ int si = int(aK.y + 0.5); int st = int(aK.z + 0.5); float g = 1.0; vec3 p = position; p.y += aK.w * uNerveY;
  if (aK.x > 0.5 && aK.x < 1.5) g = 1.3 * openR(aE);
  else if (aK.x > 1.5 && aK.x < 2.5) {
    float tt = clamp((uPh - 0.27) / 0.2, 0.0, 1.0), e = 1.0 - (1.0 - tt) * (1.0 - tt);
    p = mix(position, aTo, e) + 0.005 * tt * vec3(sin(uTime * 23.0 + aE.y * 40.0), sin(uTime * 19.0 + aE.y * 17.0), cos(uTime * 21.0 + aE.y * 29.0));
    g = 1.6 * uFuse[int(aE.x + 0.5)] * smoothstep(0.26, 0.29, uPh) * (1.0 - smoothstep(0.47, 0.64, uPh));
  } else if (aK.x > 2.5) { float d = uPh - 0.235; g = 2.0 * uFire * exp(-d * d / 0.0011); }
  vC = vC * (0.35 + 0.65 * uD[si]) + uSC[si] * uG[si] * 0.9;
  vA *= g * uStage[st] * (0.3 + 0.7 * uD[si]);
  mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = pointPx(aSize, mv);
  if (aK.x > 0.5 && aK.x < 2.5) gl_PointSize = min(gl_PointSize, 10.0); }` });   // tiny molecules stay tiny up close
  const ptObj = new THREE.Points(pg, ptMat); ptObj.frustumCulled = false; ptObj.renderOrder = 7; set.group.add(ptObj);

  // ------------------------------------------------------------------ the 35 seed genes where they act
  const front = a => a.reduce((b, x) => (x[2] > b[2] ? x : b));
  const vesNear = x0 => front(VES.slice(16).filter(p => Math.abs(p[0] - x0) < 0.08 && p[2] < ZC - 0.03));
  const mu = MUSK.reduce((b, m) => (m.p[2] > b.p[2] ? m : b)), ac = ACHE.reduce((b, m) => (m.p[2] > b.p[2] ? m : b));
  const na = NAV.filter(c => Math.abs(c.p[0] - FX[3]) < 0.07).reduce((b, m) => (m.p[2] > b.p[2] ? m : b));
  const erF = ERP.filter(p => p[2] > 0.2).sort((a, b) => a[1] - b[1]);
  const pent = (k, r) => { const a = k / 5 * TAU + 0.3; return [0.005 + r * Math.cos(a), 0.03, 0.27 + r * Math.sin(a) * 0.8]; };
  const ncut = a => [NA[0] + NAR[0] * 0.714 * Math.cos(a), NA[1] + NAR[1] * 0.714 * Math.sin(a), ZC - 0.006];
  const GG = [   // [label bold, rest, [symbol, position] ...]
    ['CHAT · SLC5A7 · SLC18A3', 'making and recycling acetylcholine', ['CHAT', [0.02, 0.66, 0.24]], ['SLC5A7', [-0.25, bBot(-0.25, 0.3) + 0.004, 0.3]], ['SLC18A3', v3.add(vesNear(0.13), [0, 0.022, 0.006])]],
    ['SYT2 · VAMP1 · SNAP25 · UNC13A · RPH3A', 'release', ['SYT2', v3.add(DOCK[15], [0.012, 0.012, 0.016])], ['VAMP1', v3.add(DOCK[7], [-0.016, -0.004, 0.016])],
      ['SNAP25', [fX(AZ[2], 0.29) + 0.03, bBot(fX(AZ[2], 0.29) + 0.03, 0.29) + 0.004, 0.29]], ['UNC13A', azF[0](0.97)], ['RPH3A', v3.add(vesNear(-0.37), [0, 0.022, 0.006])]],
    ['SLC25A1', 'mitochondrion', ['SLC25A1', MITO[0].at(0.25, -PI / 2, 0.9)]],
    ['PREPL · MYO9A', 'nerve ending', ['PREPL', [0.45, 0.38, 0.27]], ['MYO9A', bPt(v3.norm([-0.6, 0.7, 0.45]), -0.05)]],
    ['COLQ · AGRN · LAMB2 · LAMA5 · COL13A1', 'basement membrane', ['COLQ', v3.add(ac.p, v3.mul(ac.n, 0.03))], ['AGRN', front(AGR)],
      ['LAMB2', [0.25, YL + 0.004, 0.29]], ['LAMA5', [fX(4, 0.27) - 0.008, -0.2, 0.27]], ['COL13A1', [0.7, 0.025, 0.28]]],
    ['CHRNA1 · B1 · D · E · G', 'receptor', ['CHRNA1', pent(0, 0.036)], ['CHRNE', pent(1, 0.036)], ['CHRNG', pent(1, 0.07)], ['CHRND', pent(3, 0.036)], ['CHRNB1', pent(4, 0.036)]],
    ['RAPSN · MUSK · LRP4 · DOK7', 'clustering', ['RAPSN', [-0.25, -0.014, 0.29]], ['MUSK', v3.add(mu.p, v3.add(v3.mul(mu.n, 0.022), [-0.006, 0, 0]))],
      ['LRP4', v3.add(mu.p, v3.add(v3.mul(mu.n, 0.04), [0.008, 0, 0]))], ['DOK7', v3.add(mu.p, v3.mul(mu.n, -0.03))]],
    ['SCN4A', 'sodium channel', ['SCN4A', v3.add(na.p, v3.mul(na.n, 0.012))]],
    ['DPAGT1 · ALG2 · ALG14 · GFPT1 · GMPPB', 'sugar chains', ['DPAGT1', erF[0]], ['ALG2', erF[Math.floor(erF.length / 2)]], ['ALG14', erF[erF.length - 1]],
      ['GFPT1', [-0.9, -0.72, 0.28]], ['GMPPB', [-0.86, -0.48, 0.3]]],
    ['PLEC · DES', 'scaffold', ['PLEC', PLX[2]], ['DES', [ZX[3], MYO[0][0], 0.22 + MYR + 0.008]]],
    ['TOR1AIP1 · CHD8', 'nucleus', ['TOR1AIP1', ncut(2.2)], ['CHD8', [NA[0] + 0.06, NA[1] - 0.01, ZC - 0.05]]],
  ];
  const GPOS = {}, GLAB = [], GENES = [];
  let genePts, endoPts;
  GG.forEach(([b, r, ...gs], g) => {
    const c = [0, 0, 0];
    for (const [sym, p] of gs) { GPOS[sym] = p; GENES.push([sym, p, g]); for (let k = 0; k < 3; k++) c[k] += p[k] / gs.length; }
    GLAB.push({ b, r, at: c, g, syms: gs.map(x => x[0]) });
  });
  const EU = { uGenes: { value: 0 }, uEndo: { value: 0 }, uEW: { value: new Array(12).fill(1) } };
  const geneStart = g => 0.04 + 0.07 * g;   // the groups light up one after another: nerve, cleft, membrane, inside
  {
    const gg = K.pointsGeo(GENES.length * 2), aG = new Float32Array(GENES.length * 6);
    GENES.forEach(([sym, p, g], i) => {
      const e = GENDO[sym] === undefined ? 0 : GENDO[sym], c = ECOL[e];
      for (const [h, size, a, col] of [[0, 0.1, 0.5, c], [1, 0.036, 1, v3.lerp(c, [1, 1, 1], 0.3)]]) {
        const j = i * 2 + h;
        gg.attributes.position.array.set(p, j * 3); gg.attributes.aCol.array.set(col, j * 3);
        gg.attributes.aSize.array[j] = size; gg.attributes.aA.array[j] = a; aG.set([g, e, i * 0.7], j * 3);
      }
    });
    gg.setAttribute('aG', new THREE.BufferAttribute(aG, 3));
    const gm = K.points(set, { uniforms: EU, head: 'attribute vec3 aG; uniform float uGenes, uEW[12];',
      vertex: `{ float s = 0.04 + 0.07 * aG.x, k = smoothstep(s, s + 0.12, uGenes);
  vA *= k * uEW[int(aG.y + 0.5)] * (0.82 + 0.18 * sin(uTime * 3.0 + aG.z)); gl_PointSize *= 0.5 + 0.5 * k; }` });
    const o = new THREE.Points(gg, gm); o.frustumCulled = false; o.renderOrder = 9; set.group.add(o); genePts = o;
  }

  // ------------------------------------------------------------------ the endotypes arrive
  // each a cloud of its genes (as many as it has, up to 40) in its colour, from a ring above the scene (the tree's
  // view of the endotypes); those with a place settle round it, those without one (0, 4, 7) hover loose above
  const PLC = { mito: [], lamina: [], golgi: [], channels: [], er: [], endosome: [], vesicles: [], scaffold: [], junction: [] };
  MITO.slice(0, 3).forEach(m => { for (let k = 0; k < 30; k++) { const p = m.at(lerp(-0.8, 0.8, R()), R() * TAU, 1.3); if (p[2] < ZC + 0.03) PLC.mito.push(p); } });
  for (let z = -0.1; z < ZC - 0.01; z += 0.05) along(lamProf(z), 0.03, R() * 0.03).forEach(s => { if (Math.abs(s.p[0]) < 1.0) PLC.lamina.push(s.p); });
  for (let k = 0; k < 40; k++) { const d = K.unit(R); PLC.golgi.push([GO[0] + 0.02 + d[0] * 0.09, GO[1] + d[1] * 0.13, GO[2] + d[2] * 0.16]); }
  REC.forEach(r => { if (r.p[2] > -0.1 && R() < 0.15) PLC.channels.push(v3.add(r.p, v3.mul(r.n, 0.028))); });
  NAV.forEach(c => { if (c.p[2] > -0.1) PLC.channels.push(v3.add(c.p, v3.mul(c.n, 0.014))); });
  ERP.forEach(p => { if (p[2] > -0.05) PLC.er.push(p); });
  ENDS.forEach(([x, y, z, r]) => { for (let k = 0; k < 20; k++) PLC.endosome.push(v3.add([x, y, z], v3.mul(K.unit(R), r * 1.45))); });
  VES.forEach(p => { if (p[2] > -0.15) PLC.vesicles.push(v3.add(p, v3.mul(K.unit(R), 0.026))); });
  MYO.slice(0, 5).forEach(([y, z]) => { for (let k = 0; k < 16; k++) { const a = lerp(-1.3, 1.3, R()); PLC.scaffold.push([lerp(-1.0, 1.0, R()), y + (MYR + 0.022) * Math.cos(a), z + (MYR + 0.022) * Math.sin(a)]); } });
  for (let k = 0; k < 90; k++) { const x = lerp(-0.95, 0.95, R()), z = lerp(-0.2, 0.3, R()); PLC.junction.push(k % 2 ? [x * 0.72, bBot(x * 0.72, z) + 0.02, z] : [x, lip(x) + 0.035, z]); }
  const HOV = { 0: [0.62, 1.14, 0.08], 4: [0.98, 0.98, -0.1], 7: [0.32, 1.3, -0.18] };
  const ECEN = [];
  {
    const ECL = [];
    EN.forEach(e => {
      const n = Math.min(40, e.n), th = PI / 2 + (11 - e.id) * TAU / 12, from = [0.85 * Math.cos(th), 1.95 + 0.55 * Math.sin(th), 0];
      const L = PLC[e.place], hov = HOV[e.id] || [0.6 + 0.1 * e.id % 3, 1.1, 0], rr = 0.045 + 0.011 * Math.sqrt(n), cen = [0, 0, 0];
      for (let k = 0; k < n; k++) {
        const to = L ? v3.add(L[Math.floor(R() * L.length)], v3.mul(K.unit(R), 0.012)) : v3.add(hov, v3.mul(K.unit(R), 0.08 * Math.cbrt(R())));
        ECL.push({ to, from: v3.add(from, v3.mul(K.unit(R), rr * Math.cbrt(R()))), e: [e.id, R(), L ? 0 : 1] });
        for (let c = 0; c < 3; c++) cen[c] += to[c] / n;
      }
      ECEN.push(cen);
    });
    const eg = K.pointsGeo(ECL.length), aF = new Float32Array(ECL.length * 3), aE = new Float32Array(ECL.length * 3);
    ECL.forEach((q, i) => {
      eg.attributes.position.array.set(q.to, i * 3); eg.attributes.aCol.array.set(v3.lerp(ECOL[q.e[0]], [1, 1, 1], 0.15), i * 3);
      eg.attributes.aSize.array[i] = 0.024; aF.set(q.from, i * 3); aE.set(q.e, i * 3);
    });
    eg.setAttribute('aFrom', new THREE.BufferAttribute(aF, 3)); eg.setAttribute('aE', new THREE.BufferAttribute(aE, 3));
    const em = K.points(set, { uniforms: EU, head: 'attribute vec3 aFrom, aE; uniform float uEndo, uEW[12];',
      vertex: `{ float k = smoothstep(0.0, 1.0, clamp((uEndo - aE.x * 0.04) / 0.5, 0.0, 1.0)), ph = aE.y * 6.2832, arc = sin(k * 3.1416);
  vec3 a = aFrom + 0.025 * vec3(sin(uTime * 0.8 + ph), cos(uTime * 0.7 + ph * 1.3), sin(uTime * 0.6 + ph * 0.7));
  vec3 b = pos + (0.008 + 0.03 * aE.z) * vec3(sin(uTime * 1.1 + ph * 2.0), sin(uTime * 0.9 + ph * 1.7), cos(uTime * 1.2 + ph));
  vec3 p = mix(a, b, k) + arc * 0.12 * vec3(sin(ph), 0.3, cos(ph));   // the cloud loosens on the way and gathers again
  vA *= smoothstep(0.0, 0.06, uEndo) * uEW[int(aE.x + 0.5)];
  mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = pointPx(aSize * (1.0 + 0.5 * arc), mv); }` });
    const o = new THREE.Points(eg, em); o.frustumCulled = false; o.renderOrder = 10; set.group.add(o); endoPts = o;
  }

  // ------------------------------------------------------------------ the meshes
  const mk = (B, mat, order, parent) => { const m = new THREE.Mesh(B.geo(), mat); m.frustumCulled = false; m.renderOrder = order; (parent || set.group).add(m); return m; };
  const fromCtr = 'transformed = aCtr + (transformed - aCtr) * vK;';   // a part grows from its middle as it builds
  mk(solid, lit('solid', { side: THREE.DoubleSide, vh: 'attribute vec3 aCtr;', vb: fromCtr }), 1);
  const myoG = new THREE.Group(); set.group.add(myoG);
  // myofibrils striated in the shader (I-band light, A-band dark, H-zone, M-line, Z-line; fading where it would alias)
  mk(myo, lit('myo', { side: THREE.DoubleSide, self: 0.06, rimK: 0.22, rimC: [1.0, 0.7, 0.75], vh: 'attribute vec3 aCtr;', vb: fromCtr, fh: 'uniform float uTw;',
    fcol: `if (vKind > 4.5) {
  float x = vL.x / ${f4(ZP)}, q = fract(x - 0.5), w = fwidth(x) * 1.5, m = abs(q - 0.5), fa = clamp(1.0 - w * 4.0, 0.0, 1.0);
  float A = smoothstep(0.3 + w, 0.3 - w, m), H = smoothstep(0.08 + w, 0.08 - w, m), M = smoothstep(0.012 + w, 0.012 - w, m), Z = smoothstep(0.02 + w, 0.02 - w, 0.5 - m);
  diffuseColor.rgb *= mix(1.0, 1.15 - 0.5 * A + 0.22 * H - 0.25 * M, fa);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.45, 0.9), Z * 0.85 * fa);
}`, fe: '\ntotalEmissiveRadiance += diffuseColor.rgb * uTw * 0.7;' }), 1, myoG);
  mk(glass, glassMat, 5);
  {   // the muscle membrane's skin: semi-opaque, so the receptors sit on a surface and the crests hide what is under them
    const sk = Builder({ color: 3, aS: 4, aQ: 3, aCtr: 3 });
    sk.add(rowsGeo(memRows.map(r => r.map(p => [p[0], p[1] - 0.004, p[2]]))), { color: [0.48, 0.26, 0.33], aS: [9, 1, 0, 0], aQ: (x, y) => [waveT(x, y), 2, 1], aCtr: [0, 0, 0] });
    const m = lit('skin', { side: THREE.DoubleSide, self: 0.1, rimK: 0.12, rimC: [1.0, 0.6, 0.7], vh: 'attribute vec3 aCtr;', vb: 'transformed.y -= (1.0 - vK) * 0.3;' });
    m.userData.base = 0.62; mk(sk, m, 3);
  }

  // ------------------------------------------------------------------ update
  const G = SU.uG.value, D = SU.uD.value, ST = SU.uStage.value, FU = SU.uFuse.value, EW = EU.uEW.value;
  const RUN = [1, 0.7, 0.5, 0.36, 0.27, 0.2];   // release per impulse in the tired run-down (six, then two at rest)
  const fused = new Array(16).fill(0), FOC = new Array(12).fill(0);
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _S = new THREE.Vector3(), _Q0 = new THREE.Quaternion();
  // the vesicles jiggle; docked ones that fuse sink and flatten into the membrane, and new ones dock before the next impulse
  function vesicles(t, ph, amp) {
    const fa = smooth(clamp(amp * 2, 0, 1));
    for (let i = 0; i < VES.length; i++) {
      const p = VES[i], w = VPH[i];
      let x = p[0], y = p[1], z = p[2], sxz = 1, sy = 1;
      if (i >= 16) { x += 0.003 * Math.sin(t * 1.3 + w); y += 0.003 * Math.sin(t * 1.1 + 2 * w); z += 0.003 * Math.cos(t * 0.9 + w); }
      else if (fused[i] && fa > 0) {
        let dy = 0, s1 = 1, s2 = 1;
        if (ph < 0.39) { const k = prog(ph, 0.24, 0.35), e = prog(ph, 0.32, 0.39); dy = -0.016 * k; s1 = (1 + 0.6 * k) * (1 - e); s2 = (1 - 0.85 * k) * (1 - e); }
        else if (ph < 0.8) s1 = s2 = 0;
        else { const r = prog(ph, 0.8, 0.98); dy = 0.07 * (1 - r); s1 = s2 = 0.4 + 0.6 * r; }
        y += dy * fa; sxz = Math.max(1e-4, lerp(1, s1, fa)); sy = Math.max(1e-4, lerp(1, s2, fa));
      }
      vesMesh.setMatrixAt(i, _M.compose(_P.set(x, y, z), _Q0, _S.set(sxz, sy, sxz)));
    }
    vesMesh.instanceMatrix.needsUpdate = true;
  }
  let cur = { place: 0 };
  function update(S, t) {
    // assembly: the fibre, its membrane, the basement membrane, the receptors gather, the nerve arrives, the Schwann cell
    const b = clamp(S.syn_build, 0, 1);
    ST[0] = prog(b, 0, 0.3); ST[1] = prog(b, 0.05, 0.35); ST[2] = prog(b, 0.25, 0.5); ST[3] = prog(b, 0.4, 0.7); ST[4] = prog(b, 0.5, 0.85); ST[5] = prog(b, 0.8, 1);
    const ny = 0.6 * Math.pow(1 - ST[4], 2);
    SU.uNerveY.value = ny; vesMesh.position.y = ny;
    // firing: one impulse a second; tired, each of six impulses releases less (the twitch shrinks, then fails), two rest
    const fire = clamp(S.syn_fire, 0, 1), tired = clamp(S.syn_tired, 0, 1);
    const n = Math.floor(t), ph = t - n, kc = ((n % 8) + 8) % 8;
    const amp = fire * (kc < 6 ? 1 : 1 - tired) * ST[4], rel = kc < 6 ? lerp(1, RUN[kc], tired) : 1;
    SU.uPh.value = ph; SU.uFire.value = amp; SU.uWave.value = amp * prog(rel, 0.3, 0.55) * ST[1];
    const dd = ph - 0.52, tw = dd > 0 ? amp * prog(rel, 0.24, 0.7) * (dd / 0.08) * Math.exp(1 - dd / 0.08) : 0;
    SU.uTw.value = tw; myoG.scale.x = 1 - 0.035 * tw;
    for (let s = 0; s < 16; s++) { fused[s] = amp > 0.001 && hash(n, s) < 0.12 + 0.48 * rel ? 1 : 0; FU[s] = fused[s] * amp; }
    vesicles(t, ph, amp);
    // an endotype's place glows in its colour and the rest dims; an endotype without a place dims everything a little
    const sp = clamp(S.syn_place, 0, 12), breath = 0.85 + 0.15 * Math.sin(t * 2.4);
    G.fill(0); FOC.fill(0);
    let wp = 0, wn = 0;
    for (let id = 0; id < 12; id++) {
      const w = clamp(1 - Math.abs(sp - id - 1), 0, 1), sl = SLOT[EN[id].place];
      if (w <= 0) continue;
      if (sl !== undefined) { G[sl] += 1.1 * w * breath; FOC[sl] += w; wp += w; } else wn += w;
    }
    const gd = 1 - 0.22 * prog(S.syn_genes, 0, 0.3) - 0.15 * prog(S.syn_endo, 0, 0.5);
    for (let k = 0; k < 12; k++) D[k] = (1 - 0.66 * (wp - FOC[k]) - 0.22 * wn) * gd;
    for (let id = 0; id < 12; id++) EW[id] = 1 - 0.65 * (wp + wn) + 0.85 * clamp(1 - Math.abs(sp - id - 1), 0, 1);
    EU.uGenes.value = clamp(S.syn_genes, 0, 1); EU.uEndo.value = clamp(S.syn_endo, 0, 1);
    // what is not there costs nothing
    genePts.visible = EU.uGenes.value > 0.04; endoPts.visible = EU.uEndo.value > 0.001;
    vesMesh.visible = ST[4] > 0; recMesh.visible = muskMesh.visible = navMesh.visible = ST[3] > 0; lamMesh.visible = ST[2] > 0; acheMesh.visible = ST[5] > 0;
    cur.place = sp;
  }

  // ------------------------------------------------------------------ anchors, labels, views, explore
  const anchors = {
    axon: axAt(0.45), terminal: [0.05, 0.8, 0.12], vesicles: [-0.1, 0.3, 0.26], activezone: azF[1](0.92), mito: MITO[0].at(0, -PI / 2, 1),
    endosome: ENDS[0].slice(0, 3), cleft: [0.25, 0.08, 0.3], lamina: [0.5, YL + 0.005, 0.3], receptors: [0.25, 0.022, 0.28],
    folds: [fX(4, 0.3), -0.18, 0.3], channels: v3.add(na.p, v3.mul(na.n, 0.01)), nucleus: [NA[0], NA[1] + 0.06, ZC], er: ERP.length ? erF[0] : NA,
    golgi: [GO[0], GO[1] + 0.12, GO[2]], scaffold: [0.1, MYO[0][0] + MYR, 0.24], fibre: [0.95, -0.5, 0.3], gap: [0, 0.085, 0.05],
    junction: [0, 0.05, 0], loose: [0.62, 1.22, 0],
  };
  EN.forEach(e => { anchors['e' + e.id] = ECEN[e.id]; });
  // the current syn_place: its endotype's place, or its loose cloud; the junction when none
  anchors.place = () => { const id = Math.round(cur.place) - 1; return id < 0 ? anchors.junction : anchors[EN[id].place] || ECEN[id]; };
  const quiet = S => (1 - prog(S.syn_genes, 0, 0.12)) * (1 - prog(S.syn_endo, 0, 0.12)) * (1 - clamp(S.syn_place, 0, 1));
  const at = (b0, b1) => S => quiet(S) * prog(S.syn_build, b0, b1);
  const labels = [
    { text: ['Nerve ending', 'of a motor axon'], at: 'terminal', cls: 'cyn', alpha: at(0.8, 0.95) },
    { text: ['Synaptic vesicles', 'full of acetylcholine'], at: 'vesicles', cls: '', alpha: at(0.85, 0.95) },
    { text: ['Mitochondrion', ''], at: 'mito', cls: 'mag', alpha: at(0.85, 0.95) },
    { text: ['Basement membrane', 'in the cleft'], at: 'lamina', cls: 'cyn', alpha: at(0.45, 0.55) },
    { text: ['Acetylcholine receptors', 'on the crests'], at: 'receptors', cls: 'grn', alpha: at(0.65, 0.75) },
    { text: ['Junctional folds', ''], at: 'folds', cls: 'amb', alpha: at(0.3, 0.4) },
    { text: ['Muscle fibre', ''], at: 'fibre', cls: '', alpha: at(0.2, 0.3) },
  ];
  const GCLS = ['cyn', 'cyn', 'cyn', 'cyn', '', 'amb', 'amb', 'amb', 'mag', 'mag', 'mag'];
  // each group's label pinned near its markers, spread so they stack tidily when all show
  const GLA = [[0.02, 0.74, 0.24], [0.12, 0.2, 0.3], [-0.3, 0.58, ZC], [0.45, 0.42, 0.27], [0.62, 0.07, 0.3], [0.05, 0.03, 0.27],
    [-0.25, -0.01, 0.3], [FX[3], -0.36, 0.3], [-0.86, -0.6, 0.3], [0.3, -0.84, 0.28], [-0.45, -0.56, ZC]];
  GLAB.forEach(L => labels.push({ text: [L.b, L.r], at: GLA[L.g], cls: GCLS[L.g],
    alpha: S => prog(S.syn_genes, geneStart(L.g), geneStart(L.g) + 0.1) * (1 - prog(S.syn_endo, 0, 0.12)) * (1 - clamp(S.syn_place, 0, 1)) }));
  EN.forEach(e => labels.push({ text: ['Endotype ' + e.id, e.name], at: e.place && anchors[e.place] ? e.place : 'e' + e.id, cls: '',
    alpha: S => clamp(1 - Math.abs(S.syn_place - e.id - 1), 0, 1) }));
  const LOOSE = EN.filter(e => !e.place).map(e => e.id);
  labels.push({ text: ['No shared place', 'endotypes ' + LOOSE.slice(0, -1).join(', ') + ' and ' + LOOSE[LOOSE.length - 1]], at: 'loose', cls: '',
    alpha: S => prog(S.syn_endo, 0.35, 0.6) * (1 - clamp(S.syn_place, 0, 1)) });
  const cam = {
    default: [26, 16, 5.8, -0.05, 0.05, 0],
    terminal: [22, 14, 2.1, 0, 0.42, 0.1],
    cleft: [62, 4, 1.05, 0.1, 0.06, 0.15],
    receptors: [6, 48, 0.32, 0.25, 0.0, 0.27],
    folds: [10, 6, 1.45, 0.1, -0.18, 0.2],
    nucleus: [-16, 10, 1.45, -0.32, -0.66, 0.15],
    gap: [-90, 0, 1.1, 0.35, 0.092, 0.1],
    wide: [24, 20, 8.2, -0.25, -0.25, -0.2],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['default', 'Junction'], ['terminal', 'Nerve ending'], ['cleft', 'Cleft'], ['folds', 'Folds'], ['nucleus', 'Inside the fibre']] },
    { key: 'fire', label: 'Firing', options: [['still', 'Still'], ['firing', 'Firing'], ['tired', 'Until tired']] },
    { key: 'genes', label: 'Genes', options: [['off', 'Off'], ['on', 'On']] },
  ];
  let placeSel = -1;   // the endotype the engine asked to show (showPlace), or -1
  function explore(c) {
    const pl = c.place !== undefined ? c.place : placeSel;
    return { syn_build: 1, syn_fire: c.fire === 'firing' || c.fire === 'tired' ? 1 : 0, syn_tired: c.fire === 'tired' ? 1 : 0,
      syn_genes: c.genes === 'on' ? 1 : 0, syn_place: pl >= 0 ? pl + 1 : 0, syn_endo: pl >= 0 ? 1 : 0 };
  }
  return Object.assign(set, {
    params: { syn_a: 1, syn_build: 1, syn_fire: 0, syn_tired: 0, syn_genes: 0, syn_place: 0, syn_endo: 0 },
    update, anchors, labels, cam, controls, explore,
    showPlace: id => { placeSel = id >= 0 && id < 12 ? id : -1; },
    genePos: sym => GPOS[sym] || null,                                       // where a seed gene acts (local coordinates)
    geneGroups: GLAB.map(L => ({ text: [L.b, L.r], genes: L.syms, at: L.at, from: geneStart(L.g) })),   // in the order they light
  });
};

// The protein network of the endotype story, from ENDO_DATA: the authors' network of 18,306 proteins as a deep,
// glowing cloud (the 2,000 genes the walk from the seeds visits most in the middle, with 15,000 of their links; the
// rest in a thick shell), the 35 CMS seed genes, their neighbourhoods growing and merging with k, walkers doing a
// random walk with restart, the module of 393 genes pulling out of the cloud, endotype colours, and one gene's
// 184-gene neighbourhood. Positions, colours and highlights follow the params alone; the walkers follow planned,
// seeded paths, so they too are a function of the time.
SETS.net = function (K) {
  const { THREE, smooth, clamp, lerp, prog } = K;
  const set = K.newSet('net');
  const D = ENDO_DATA, FA = D.facts;

  // ---------------------------------------------------------------- data, decoded once
  const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const u16 = s => new Uint16Array(bytes(s).buffer), i16 = s => new Int16Array(bytes(s).buffer);
  const N = D.nodes, NC = D.core, NM = D.mod, NL = D.nLinks, ML = D.modLinks, HS = FA.hood, NS = D.seeds.length;
  const KV = D.groups.k, NK = KV.length, ENDO = D.endo, NE = ENDO.length;
  const P = new Float32Array(3 * N);
  { const q = i16(D.pos); for (let i = 0; i < 3 * N; i++) P[i] = q[i] / 10000; }
  const HEAT = bytes(D.heat), LK = u16(D.links), GENE = bytes(D.gene), SEEDOF = bytes(D.seedOf), GRP = bytes(D.groups.g), HOOD = u16(D.hood);
  const NAMES = D.names.split('|'), MNAMES = NAMES.slice(0, NM);
  const SEED = new Int32Array(NS);   // module index of each seed, in the Gene Table's order (the groups' order)
  for (let i = 0; i < NM; i++) if (SEEDOF[i]) SEED[SEEDOF[i] - 1] = i;
  const KIND = new Uint8Array(N);    // 0 shell, 1 core, 2 found by the walk (in the module), 3 seed
  for (let i = 0; i < NC; i++) KIND[i] = i < NM ? (SEEDOF[i] ? 3 : 2) : 1;
  // the core's links as adjacency lists (the walkers hop along them)
  const DEG = new Int32Array(NC), OFF = new Int32Array(NC + 1), NB = new Uint16Array(2 * NL);
  for (let e = 0; e < NL; e++) { DEG[LK[2 * e]]++; DEG[LK[2 * e + 1]]++; }
  for (let i = 0; i < NC; i++) OFF[i + 1] = OFF[i] + DEG[i];
  { const f = OFF.slice(0, NC); for (let e = 0; e < NL; e++) { const a = LK[2 * e], b = LK[2 * e + 1]; NB[f[a]++] = b; NB[f[b]++] = a; } }
  const R = K.rng(18306);

  // ---------------------------------------------------------------- seed groups
  // A gene joins a seed's neighbourhood at k = its rank in that seed's walk: hood lists are in rank order, and the
  // seeds whose top-k sets overlap are exactly the groups in ENDO_DATA.groups (checked at every k).
  const JR = new Float32Array(N).fill(999), JS = new Float32Array(N);
  for (let s = 0; s < NS; s++) { const b = SEED[s] * HS; for (let r = 1; r < HS; r++) { const n = HOOD[b + r]; if (r < JR[n]) { JR[n] = r; JS[n] = s; } } }
  for (let s = 0; s < NS; s++) { JR[SEED[s]] = 0; JS[SEED[s]] = s; }
  const gOf = (L, s) => GRP[L * NS + s];
  // Colours follow lineages: the groups only ever merge as k grows, so going from one group (amber) down to the
  // smallest k, the biggest part of a group keeps its colour and the others take new ones. Amber is thus group 0
  // from k = 20 on, and the growing neighbourhood at every k (the biggest group switches lineage below that).
  const PAL = ['#ffb43b', '#46d9ff', '#3ee08f', '#ff5ad9', '#a98bea', '#5d86f0', '#34d1a8', '#ff7aa8', '#c7e05a', '#7fc8ff', '#e070d0', '#58d06a'].map(K.rgb);
  const GC = new Float32Array(NK * NS * 3);
  {
    const ci = new Int16Array(NK * NS);
    let next = 0;
    const fresh = () => 1 + (next++ % (PAL.length - 1));
    const tops = new Map();
    for (let s = 0; s < NS; s++) { const g = gOf(NK - 1, s); if (!tops.has(g)) tops.set(g, g === 0 ? 0 : fresh()); ci[(NK - 1) * NS + s] = tops.get(g); }
    for (let L = NK - 2; L >= 0; L--) {
      const kids = new Map();   // parent group -> [child, size, first seed]
      for (let s = 0; s < NS; s++) {
        const p = gOf(L + 1, s), c = gOf(L, s);
        if (!kids.has(p)) kids.set(p, new Map());
        const m = kids.get(p);
        if (!m.has(c)) m.set(c, [c, 0, s]);
        m.get(c)[1]++;
      }
      const colOf = new Map();
      for (const m of kids.values()) {
        const pc = ci[(L + 1) * NS + [...m.values()][0][2]];
        [...m.values()].sort((a, b) => b[1] - a[1] || (a[0] === 0 ? -1 : b[0] === 0 ? 1 : a[2] - b[2]))
          .forEach((k, j) => colOf.set(k[0], j === 0 ? pc : fresh()));
      }
      for (let s = 0; s < NS; s++) ci[L * NS + s] = colOf.get(gOf(L, s));
    }
    for (let i = 0; i < NK * NS; i++) GC.set(PAL[ci[i]], 3 * i);
  }
  const groupCount = KV.map((_, L) => new Set(Array.from(GRP.subarray(L * NS, L * NS + NS))).size);

  // ---------------------------------------------------------------- the module's own layout
  // a quick force layout of the 393 genes on their 710 links, started from their places in the cloud (so they keep
  // their bearings as they move), with a weak pull to their endotype's middle so the endotypes read as regions
  const MODP = new Float32Array(3 * NM);
  {
    const X = new Float64Array(3 * NM), F = new Float64Array(3 * NM), cen = new Float64Array(3 * NE), cnt = new Float64Array(NE);
    for (let i = 0; i < 3 * NM; i++) X[i] = P[i] * 0.5;
    for (let i = 0; i < NM; i++) cnt[GENE[i]]++;
    const IT = 60, KR = 0.00004, KSP = 0.4, L0 = 0.08, KC = 0.03, KE = 0.06;
    for (let it = 0; it < IT; it++) {
      const T = 0.05 * Math.pow(1 - it / IT, 1.5) + 0.002;
      F.fill(0); cen.fill(0);
      for (let i = 0; i < NM; i++) {
        const i3 = 3 * i, xi = X[i3], yi = X[i3 + 1], zi = X[i3 + 2];
        let ax = 0, ay = 0, az = 0;
        for (let j = i + 1; j < NM; j++) {
          const j3 = 3 * j, dx = xi - X[j3], dy = yi - X[j3 + 1], dz = zi - X[j3 + 2], d2 = dx * dx + dy * dy + dz * dz + 0.0004, f = KR / (d2 * Math.sqrt(d2));
          ax += dx * f; ay += dy * f; az += dz * f; F[j3] -= dx * f; F[j3 + 1] -= dy * f; F[j3 + 2] -= dz * f;
        }
        F[i3] += ax; F[i3 + 1] += ay; F[i3 + 2] += az;
      }
      for (let e = 0; e < ML; e++) {
        const a = 3 * LK[2 * e], b = 3 * LK[2 * e + 1], dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2];
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6, f = KSP * (L - L0) / L;
        F[a] += dx * f; F[a + 1] += dy * f; F[a + 2] += dz * f; F[b] -= dx * f; F[b + 1] -= dy * f; F[b + 2] -= dz * f;
      }
      for (let i = 0; i < NM; i++) { const e = 3 * GENE[i], w = 1 / cnt[GENE[i]]; cen[e] += X[3 * i] * w; cen[e + 1] += X[3 * i + 1] * w; cen[e + 2] += X[3 * i + 2] * w; }
      for (let i = 0; i < NM; i++) {
        const i3 = 3 * i, e = 3 * GENE[i];
        for (let a = 0; a < 3; a++) F[i3 + a] += -X[i3 + a] * KC + (cen[e + a] - X[i3 + a]) * KE;
        const fl = Math.hypot(F[i3], F[i3 + 1], F[i3 + 2]) + 1e-9, s = Math.min(1, T / fl);
        X[i3] += F[i3] * s; X[i3 + 1] += F[i3 + 1] * s; X[i3 + 2] += F[i3 + 2] * s;
      }
    }
    // centred, about 1.3 across (RMS radius 0.4)
    const c = [0, 0, 0]; for (let i = 0; i < NM; i++) for (let a = 0; a < 3; a++) c[a] += X[3 * i + a] / NM;
    let rr = 0; for (let i = 0; i < NM; i++) rr += (X[3 * i] - c[0]) ** 2 + (X[3 * i + 1] - c[1]) ** 2 + (X[3 * i + 2] - c[2]) ** 2;
    const k = 0.4 / Math.sqrt(rr / NM);
    for (let i = 0; i < NM; i++) for (let a = 0; a < 3; a++) MODP[3 * i + a] = (X[3 * i + a] - c[a]) * k;
  }
  // where each node goes as the module pulls out: module genes to their layout, the rest of the cloud a little
  // outwards (it recedes); each gene leaves at its own moment (ST), the far travellers last
  const MT = new Float32Array(3 * N), ST = new Float32Array(N);
  {
    let far = 0;
    const dd = new Float32Array(NM);
    for (let i = 0; i < NM; i++) { dd[i] = Math.hypot(MODP[3 * i] - P[3 * i], MODP[3 * i + 1] - P[3 * i + 1], MODP[3 * i + 2] - P[3 * i + 2]); far = Math.max(far, dd[i]); }
    for (let i = 0; i < N; i++) {
      if (i < NM) { MT.set(MODP.subarray(3 * i, 3 * i + 3), 3 * i); ST[i] = 0.3 * dd[i] / far + 0.1 * R(); }
      else { MT[3 * i] = P[3 * i] * 1.14; MT[3 * i + 1] = P[3 * i + 1] * 1.14; MT[3 * i + 2] = P[3 * i + 2] * 1.14; ST[i] = 0.12 * R(); }
    }
  }
  // the same morph as the shaders' morph(): eased, with a sideways bow about the vertical
  function mpos(i, m, out, o) {
    const i3 = 3 * i;
    let x = P[i3], y = P[i3 + 1], z = P[i3 + 2];
    if (m > 0) {
      const e = smooth((m - ST[i]) / 0.6);
      if (e > 0) {
        const dx = MT[i3] - x, dy = MT[i3 + 1] - y, dz = MT[i3 + 2] - z, b = 0.3 * Math.sin(Math.PI * e);
        x += dx * e - dz * b; y += dy * e; z += dz * e + dx * b;
      }
    }
    out[o] = x; out[o + 1] = y; out[o + 2] = z;
    return out;
  }

  // how crowded each gene's surroundings are (genes in a 0.3-unit box): the middle of the core is so dense that
  // additive points and links would burn out to white, so brightness falls with the crowd (in the cloud and in the
  // module's layout)
  function crowd(pos, n) {
    const C = 0.1, G = 44, H = G / 2, cnt = new Uint16Array(G * G * G), out = new Float32Array(n);
    const c = x => clamp(Math.floor(x / C) + H, 0, G - 1), cell = new Int32Array(3 * n);
    for (let i = 0; i < n; i++) { for (let a = 0; a < 3; a++) cell[3 * i + a] = c(pos[3 * i + a]); cnt[(cell[3 * i] * G + cell[3 * i + 1]) * G + cell[3 * i + 2]]++; }
    for (let i = 0; i < n; i++) {
      const x = cell[3 * i], y = cell[3 * i + 1], z = cell[3 * i + 2];
      let s = 0;
      for (let a = Math.max(0, x - 1); a <= Math.min(G - 1, x + 1); a++) for (let b = Math.max(0, y - 1); b <= Math.min(G - 1, y + 1); b++)
        for (let d = Math.max(0, z - 1); d <= Math.min(G - 1, z + 1); d++) s += cnt[(a * G + b) * G + d];
      out[i] = s;
    }
    return out;
  }
  const CRC = crowd(P, NC), CRM = crowd(MODP, NM);
  const dimP = d => Math.pow(6 / Math.max(6, d), 0.6), dimL = d => Math.pow(6 / Math.max(6, d), 0.8);

  // ---------------------------------------------------------------- shared uniforms and GLSL
  const U = {
    uCloud: { value: 1 }, uSeeds: { value: 0 }, uKv: { value: 1 }, uGk: { value: 0 }, uHeat: { value: 0 }, uMod: { value: 0 },
    uEndo: { value: 0 }, uFocus: { value: 0 }, uHoodP: { value: 0 }, uHoodOn: { value: 0 }, uMark: { value: 0 }, uHot: { value: 0 },
    uLo: { value: 0 }, uHi: { value: 0 }, uKf: { value: 0 },
    uSeedCol: { value: new Float32Array(3 * NS) }, uEndoCol: { value: new Float32Array(3 * NE) },
  };
  ENDO.forEach((e, i) => U.uEndoCol.value.set(K.rgb(e.col), 3 * i));
  const LOOK = `
uniform float uCloud, uSeeds, uKv, uGk, uHeat, uMod, uEndo, uFocus, uHoodP, uHoodOn, uMark, uHot, uLo, uHi, uKf;
uniform vec3 uSeedCol[${NS}], uEndoCol[${NE}];
// the module pulls out: eased per gene (st: its start), with a sideways bow about the vertical (mpos() in JS)
vec3 morph(vec3 p, vec3 q, float st) {
  float e = clamp((uMod - st) / 0.6, 0.0, 1.0); e = e * e * (3.0 - 2.0 * e);
  vec3 d = q - p;
  return p + d * e + vec3(-d.z, 0.0, d.x) * (0.3 * sin(3.14159265 * e));
}
vec3 seedCol(float s) { return uSeedCol[int(s + 0.5)]; }
vec3 endoCol(float e) { return uEndoCol[int(clamp(e, 0.0, ${NE - 1}.0) + 0.5)]; }
// the walk's heat: deep blue (rarely visited), teal, amber, orange, white-hot (the seeds)
vec3 heatRamp(float h) {
  vec3 c = mix(vec3(0.13, 0.2, 0.52), vec3(0.18, 0.46, 0.88), smoothstep(0.0, 0.3, h));
  c = mix(c, vec3(0.22, 0.8, 0.74), smoothstep(0.3, 0.44, h));
  c = mix(c, vec3(1.0, 0.74, 0.28), smoothstep(0.44, 0.6, h));
  c = mix(c, vec3(1.0, 0.4, 0.2), smoothstep(0.62, 0.82, h));
  return mix(c, vec3(1.0, 0.93, 0.82), smoothstep(0.86, 1.0, h));
}
float bitAt(float m, float l) { return mod(floor(m / exp2(l) + 0.001), 2.0); }
// brighter in front of the set's middle, darker behind (depth)
float depthCue(vec4 mv) { vec4 o = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); float s = length(modelViewMatrix[0].xyz); return clamp(1.0 - (o.z - mv.z) / s * 0.22, 0.42, 1.35); }
`;
  const mat = (vs, fs, opts = {}) => {
    const m = new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U, opts.uniforms || {}),
      vertexShader: K.GLSL + LOOK + vs, fragmentShader: fs,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }, opts.extra || {}));
    set.mats.push(m);
    return m;
  };
  const attr = (g, name, arr, n) => g.setAttribute(name, new THREE.BufferAttribute(arr, n));
  const BS = new THREE.Sphere(new THREE.Vector3(), 2.8);
  const GLOW_FS = `
varying vec3 vC; varying float vA;
void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0; if (d > 1.0) discard;
  float core = smoothstep(0.6, 0.1, d), halo = pow(1.0 - d, 2.0);
  gl_FragColor = vec4(vC * (0.7 + 0.5 * core), vA * (core * 0.8 + halo * 0.5)); }`;

  // ---------------------------------------------------------------- the nodes: one cloud of 18,306 points
  const HA = new Float32Array(N).fill(-1);   // rank in the current gene's neighbourhood, or -1
  const nodeGeo = new THREE.BufferGeometry();
  {
    const I = new Float32Array(4 * N), Q = new Float32Array(4 * N), B = new Float32Array(2 * N).fill(1);
    for (let i = 0; i < N; i++) {
      const k = KIND[i], h = HEAT[i] / 255;
      I[4 * i] = h; I[4 * i + 1] = k; I[4 * i + 2] = i < NM ? GENE[i] : -1; I[4 * i + 3] = ST[i];
      const sz = k === 3 ? 0.026 : k === 2 ? 0.02 : k === 1 ? 0.0135 + 0.005 * Math.min(1, DEG[i] / 40) : 0.0085 + 0.004 * clamp(h / 0.4, 0, 1);
      Q[4 * i] = JR[i]; Q[4 * i + 1] = JS[i]; Q[4 * i + 2] = sz; Q[4 * i + 3] = R();
      if (i < NC) B[2 * i] = dimP(CRC[i]);
      if (i < NM) B[2 * i + 1] = dimP(CRM[i]);
    }
    attr(nodeGeo, 'position', P, 3); attr(nodeGeo, 'aMod', MT, 3); attr(nodeGeo, 'aI', I, 4); attr(nodeGeo, 'aK', Q, 4); attr(nodeGeo, 'aHood', HA, 1); attr(nodeGeo, 'aB', B, 2);
    nodeGeo.boundingSphere = BS;
  }
  const nodeMat = mat(`
attribute vec3 aMod; attribute vec4 aI, aK; attribute float aHood; attribute vec2 aB;
uniform float uA; varying vec3 vC; varying float vA, vHot;
void main() {
  float heat = aI.x, kind = aI.y, endo = aI.z;
  float isCore = step(0.5, kind), isMod = step(1.5, kind), isSeed = step(2.5, kind);
  vec3 pos = morph(position, aMod, aI.w);
  float r = length(position);
  vec3 c = mix(vec3(0.27, 0.38, 0.64), vec3(0.47, 0.6, 0.9), isCore);
  c = mix(c, vec3(0.62, 0.74, 1.0), isMod);
  float sz = aK.z, hi = 0.0;
  float br = mix(0.5 + 0.5 * smoothstep(2.45, 1.75, r), 1.0, isCore);
  // seed groups: the genes within k of a seed take its group's colour
  float lit = (1.0 - isSeed) * smoothstep(aK.x - 1.0, aK.x, uKv) * uGk;
  c = mix(c, seedCol(aK.y), lit * 0.9); sz *= 1.0 + 0.4 * lit; hi = max(hi, lit);
  // the walk's heat
  float hh = uHeat * smoothstep(0.4, 0.75, heat);
  c = mix(c, heatRamp(heat) * 1.15, uHeat); sz *= mix(1.0, 0.55 + 1.6 * heat * heat, uHeat); hi = max(hi, uHeat * smoothstep(0.55, 0.85, heat));
  // the module: found genes warm, the rest of the cloud a faint haze
  float mo = uMod * isMod;
  c = mix(c, vec3(1.0, 0.64, 0.24) * 1.15, mo * (1.0 - isSeed)); hi = max(hi, mo);
  br *= mix(1.0, 0.22, uMod * (1.0 - isMod)); sz *= mix(1.0, 0.8, uMod * (1.0 - isMod)); sz *= 1.0 + 0.55 * mo;
  // endotypes, and one of them in focus
  c = mix(c, endoCol(endo) * 1.35, uEndo * isMod); hi = max(hi, uEndo * isMod);
  sz *= 1.0 + 0.5 * uEndo * isMod * (1.0 - uMod); br *= 1.0 - 0.5 * uEndo * (1.0 - isMod);
  float fw = isMod * clamp(1.0 - abs(uFocus - endo - 1.0), 0.0, 1.0), fon = clamp(uFocus, 0.0, 1.0);
  float fd = mix(1.0, 0.14 + 0.86 * fw, fon);
  br *= fd; sz *= 1.0 + 0.7 * fw; hi = max(hi, fw);
  // the seeds: white-hot (their endotype's colour round a white heart in endotype colours)
  float hot = isSeed * uHot;
  c = mix(c, mix(vec3(1.0, 0.95, 0.86), endoCol(endo) * 1.3, 0.6 * uEndo), hot); sz *= 1.0 + (1.2 - 0.5 * max(uMod, uHeat)) * hot; br *= 1.0 + 0.5 * hot; hi = max(hi, hot);
  // one gene's neighbourhood lights up in order of rank, the gene itself white
  float hl = aHood < -0.5 ? 0.0 : smoothstep(aHood / ${HS}.0, aHood / ${HS}.0 + 0.05, uHoodP);
  float me = aHood > -0.5 && aHood < 0.5 ? uMark : 0.0;
  c = mix(c, vec3(0.42, 0.9, 1.0) * 1.3, hl * 0.9 * (1.0 - me)); sz *= 1.0 + 0.6 * hl * (1.0 - isSeed); hi = max(hi, max(hl, me));
  c = mix(c, vec3(1.0), me * 0.6); sz *= 1.0 + 0.5 * me * (1.0 - hot);
  // whatever is not lit steps back a little behind the seeds, more behind a neighbourhood; crowds dim
  br *= (1.0 - 0.42 * uSeeds * (1.0 - hi)) * (1.0 - 0.72 * uHoodOn * (1.0 - max(hl, me)));
  br *= mix(mix(aB.x, aB.y, uMod * isMod), 1.0, max(max(hot, me) * 0.7, max(max(hl * 0.3, hh * 0.65), max(uEndo * isMod, fw) * 0.5 + lit * 0.2)));
  // the cloud appears from the centre outwards, with a bright front
  float rv = r / 2.45, u = uCloud * 1.05, ap = smoothstep(rv, rv + 0.035, u), fl = uCloud < 0.999 ? exp(-pow((u - rv - 0.025) / 0.03, 2.0)) : 0.0;
  br *= (0.86 + 0.14 * sin(uTime * 1.3 + aK.w * 6.2832)) * (1.0 + 1.6 * fl);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(sz * ap * (1.0 + 0.8 * fl), mv);
  vC = c * br * depthCue(mv);
  vHot = min(hot + me, 1.0) * fd * (1.0 - 0.75 * uHoodOn * (1.0 - max(hl, me)));
  vA = uA * ap;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA, vHot;
void main() {
  vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.62, 0.12, d), halo = pow(1.0 - d, 2.0);
  vec3 col = vC * (0.6 + 0.55 * core) + vec3(0.9, 0.88, 0.82) * vHot * smoothstep(0.42, 0.0, d);
  gl_FragColor = vec4(col, vA * (core * 0.75 + halo * (0.45 + 0.35 * vHot)));
}`);
  const nodes = new THREE.Points(nodeGeo, nodeMat);
  nodes.renderOrder = 2;
  set.group.add(nodes);

  // ---------------------------------------------------------------- the 15,000 core links
  {
    const g = new THREE.BufferGeometry(), n = 2 * NL;
    const pos = new Float32Array(3 * n), mod = new Float32Array(3 * n), dA = new Float32Array(4 * n), eA = new Float32Array(4 * n), jA = new Float32Array(3 * n);
    for (let e = 0; e < NL; e++) {
      const a = LK[2 * e], b = LK[2 * e + 1], a3 = 3 * a, b3 = 3 * b;
      const len = Math.hypot(P[a3] - P[b3], P[a3 + 1] - P[b3 + 1], P[a3 + 2] - P[b3 + 2]);
      const type = e < ML ? 0 : (a < NM || b < NM) ? 1 : 2;
      const al = (0.2 / (1 + (len / 0.2) * (len / 0.2)) + 0.02) * (type === 0 ? 1.4 : type === 1 ? 1 : 0.8);
      const ac = al * dimL(0.5 * (CRC[a] + CRC[b])), am = type === 0 ? 0.6 * dimL(0.5 * (CRM[a] + CRM[b])) : 0;
      const rv = Math.max(Math.hypot(P[a3], P[a3 + 1], P[a3 + 2]), Math.hypot(P[b3], P[b3 + 1], P[b3 + 2])) / 2.45;
      for (let j = 0; j < 2; j++) {
        const s = j ? b : a, o = j ? a : b, v = 2 * e + j, s3 = 3 * s;
        pos[3 * v] = P[s3]; pos[3 * v + 1] = P[s3 + 1]; pos[3 * v + 2] = P[s3 + 2];
        mod[3 * v] = MT[s3]; mod[3 * v + 1] = MT[s3 + 1]; mod[3 * v + 2] = MT[s3 + 2];
        dA[4 * v] = ST[s]; dA[4 * v + 1] = HEAT[s] / 255; dA[4 * v + 2] = s < NM ? GENE[s] : -1; dA[4 * v + 3] = KIND[s];
        eA[4 * v] = type; eA[4 * v + 1] = ac; eA[4 * v + 2] = rv; eA[4 * v + 3] = JR[o];
        jA[3 * v] = JR[s]; jA[3 * v + 1] = JS[s]; jA[3 * v + 2] = am;
      }
    }
    attr(g, 'position', pos, 3); attr(g, 'aMod', mod, 3); attr(g, 'aD', dA, 4); attr(g, 'aE', eA, 4); attr(g, 'aJ', jA, 3);
    g.boundingSphere = BS;
    const m = mat(`
attribute vec3 aMod, aJ; attribute vec4 aD, aE;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec3 pos = morph(position, aMod, aD.x);
  float isM = 1.0 - step(0.5, aE.x);
  vec3 c = vec3(0.38, 0.52, 0.86);
  // crowded links are fainter (aE.y in the cloud, aJ.z in the module's layout)
  float a = mix(aE.y, aJ.z, uMod * isM), hi = 0.0;
  // a link inside a lit neighbourhood glows with it
  float kr = max(aJ.x, aE.w), lit = smoothstep(kr - 1.0, kr, uKv) * uGk;
  c = mix(c, seedCol(aJ.y), lit); a *= 1.0 + 1.3 * lit; hi = max(hi, lit);
  c = mix(c, heatRamp(aD.y), uHeat); a *= mix(1.0, 0.45 + 1.0 * aD.y, uHeat);
  c = mix(c, vec3(1.0, 0.8, 0.52), uMod * isM); a *= mix(1.0, isM + (1.0 - isM) * 0.06, uMod); hi = max(hi, uMod * isM);
  c = mix(c, endoCol(aD.z) * 1.1, uEndo * isM); a *= 1.0 - 0.5 * uEndo * (1.0 - isM);
  float fw = isM * clamp(1.0 - abs(uFocus - aD.z - 1.0), 0.0, 1.0);
  a *= mix(1.0, 0.12 + 1.3 * fw, clamp(uFocus, 0.0, 1.0)); hi = max(hi, fw);
  a *= 1.0 - max(0.45 * uSeeds, 0.78 * uHoodOn) * (1.0 - hi);
  float ap = smoothstep(aE.z, aE.z + 0.04, uCloud * 1.05);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vC = c * depthCue(mv); vA = uA * a * ap;
}`, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.002) discard; gl_FragColor = vec4(vC, vA); }`);
    const L = new THREE.LineSegments(g, m);
    L.renderOrder = 1;
    set.group.add(L);
  }

  // ---------------------------------------------------------------- depth: a haze of big faint sprites and a glowing core
  {
    const n = 300, g = new THREE.BufferGeometry(), pos = new Float32Array(3 * n), mod = new Float32Array(3 * n), h = new Float32Array(4 * n);
    for (let k = 0; k < n; k++) {
      const i = k < 70 ? Math.floor(R() * NM) : k < 190 ? Math.floor(R() * NC) : NC + Math.floor(R() * (N - NC));
      const j = [K.gauss(R) * 0.05, K.gauss(R) * 0.05, K.gauss(R) * 0.05];
      for (let a = 0; a < 3; a++) { pos[3 * k + a] = P[3 * i + a] + j[a]; mod[3 * k + a] = MT[3 * i + a] + j[a] * 0.6; }
      h[4 * k] = ST[i]; h[4 * k + 1] = (i < NC ? 0.22 : 0.4) + 0.2 * R(); h[4 * k + 2] = i < NM ? 1 : 0; h[4 * k + 3] = i < NM ? 0.05 : i < NC ? 0.04 : 0.032;
    }
    attr(g, 'position', pos, 3); attr(g, 'aMod', mod, 3); attr(g, 'aH', h, 4);
    g.boundingSphere = BS;
    const m = mat(`
attribute vec3 aMod; attribute vec4 aH;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec3 pos = morph(position, aMod, aH.x);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aH.y * (1.0 - 0.35 * uMod * aH.z), mv);
  float r = length(position);
  vC = mix(vec3(0.3, 0.44, 0.9), vec3(1.0, 0.6, 0.28), max(uMod * aH.z, uHeat * (r < 1.75 ? 0.75 : 0.0)));
  vA = uA * aH.w * smoothstep(r / 2.45, r / 2.45 + 0.12, uCloud * 1.05) * mix(1.0, 0.35 + aH.z * 1.05, uMod) * (1.0 - 0.6 * uHoodOn) * (1.0 - 0.3 * uSeeds) * (1.0 - 0.6 * clamp(uFocus, 0.0, 1.0));
  if (vA < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA;
void main() { vec2 q = gl_PointCoord - 0.5; float d2 = dot(q, q) * 4.0; if (d2 > 1.0) discard; gl_FragColor = vec4(vC, vA * exp(-d2 * 3.5) * (1.0 - d2)); }`);
    const pts = new THREE.Points(g, m); pts.renderOrder = 0; set.group.add(pts);
  }
  const glowMat = mat(`
uniform float uA; varying vec3 vN, vW;
void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, `
uniform float uA, uCloud, uMod, uHoodOn, uFocus; varying vec3 vN, vW;
void main() {
  float f = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  float a = pow(f, 3.0) * uA * smoothstep(0.0, 0.45, uCloud) * (1.0 - 0.75 * max(uMod, uHoodOn)) * (1.0 - 0.6 * clamp(uFocus, 0.0, 1.0));
  gl_FragColor = vec4(mix(vec3(0.36, 0.52, 1.0), vec3(0.8, 0.9, 1.0), f * f), a * 0.05);
}`);
  {
    const sg = new THREE.SphereGeometry(1, 32, 20);
    for (const r of [0.55, 1.05, 1.9]) { const m = new THREE.Mesh(sg, glowMat); m.scale.setScalar(r); m.renderOrder = 0; set.group.add(m); }
  }

  // ---------------------------------------------------------------- seed halos (instanced soft spheres) and arcs
  const SCTR = new Float32Array(3 * NS);
  const halo = (() => {
    const sg = new THREE.SphereGeometry(1, 20, 14), g = new THREE.InstancedBufferGeometry();
    g.setIndex(sg.index); g.setAttribute('position', sg.attributes.position); g.setAttribute('normal', sg.attributes.normal);
    g.setAttribute('aCtr', new THREE.InstancedBufferAttribute(SCTR, 3));
    g.setAttribute('aSlot', new THREE.InstancedBufferAttribute(new Float32Array(NS).map((_, s) => s), 1));
    g.instanceCount = NS;
    const m = mat(`
attribute vec3 aCtr; attribute float aSlot;
uniform float uA, uHaloR; varying vec3 vN, vW, vC;
void main() {
  vec4 w = modelMatrix * vec4(aCtr + position * uHaloR, 1.0);
  vN = normalize(mat3(modelMatrix) * normal); vW = w.xyz; vC = seedCol(aSlot);
  gl_Position = projectionMatrix * viewMatrix * w;
}`, `
uniform float uA, uHaloA; varying vec3 vN, vW, vC;
void main() {
  float f = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  gl_FragColor = vec4(vC, pow(f, 1.8) * uHaloA * uA);
}`, { uniforms: { uHaloR: { value: 0.05 }, uHaloA: { value: 0 } } });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3;
    set.group.add(mesh);
    return { mesh, m, g };
  })();
  // arcs join the seeds of one group: at every k, the shortest tree through each group's seeds (Kruskal on their
  // places in the cloud); each arc knows at which k it shows (a bit mask over the 13 values)
  const arcs = (() => {
    const pairs = [];
    for (let a = 0; a < NS; a++) for (let b = a + 1; b < NS; b++) {
      const i = 3 * SEED[a], j = 3 * SEED[b];
      pairs.push([Math.hypot(P[i] - P[j], P[i + 1] - P[j + 1], P[i + 2] - P[j + 2]), a, b]);
    }
    pairs.sort((x, y) => x[0] - y[0]);
    const mask = new Map();
    for (let L = 0; L < NK; L++) {
      const par = Array.from({ length: NS }, (_, i) => i), find = x => (par[x] === x ? x : (par[x] = find(par[x])));
      for (const [, a, b] of pairs) {
        if (gOf(L, a) !== gOf(L, b)) continue;
        const ra = find(a), rb = find(b);
        if (ra === rb) continue;
        par[ra] = rb;
        const key = a * NS + b;
        mask.set(key, (mask.get(key) || 0) | (1 << L));
      }
    }
    const SEG = 24, n = mask.size, nv = n * SEG * 4, g = new THREE.BufferGeometry();
    const A = new Float32Array(3 * nv), Am = new Float32Array(3 * nv), B = new Float32Array(3 * nv), Bm = new Float32Array(3 * nv), Rr = new Float32Array(4 * nv), Sa = new Float32Array(2 * nv);
    const idx = new Uint16Array(n * SEG * 6);
    let v = 0, q = 0;
    for (const [key, m] of mask) {
      const a = Math.floor(key / NS), b = key % NS, ia = SEED[a], ib = SEED[b];
      for (let s = 0; s < SEG; s++) {
        idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], 6 * q++);
        for (let c = 0; c < 4; c++, v++) {
          A.set(P.subarray(3 * ia, 3 * ia + 3), 3 * v); Am.set(MT.subarray(3 * ia, 3 * ia + 3), 3 * v);
          B.set(P.subarray(3 * ib, 3 * ib + 3), 3 * v); Bm.set(MT.subarray(3 * ib, 3 * ib + 3), 3 * v);
          Rr[4 * v] = ST[ia]; Rr[4 * v + 1] = ST[ib]; Rr[4 * v + 2] = (s + (c >> 1)) / SEG; Rr[4 * v + 3] = c & 1 ? 1 : -1;
          Sa[2 * v] = a; Sa[2 * v + 1] = m;
        }
      }
    }
    attr(g, 'position', A, 3); attr(g, 'aAm', Am, 3); attr(g, 'aBc', B, 3); attr(g, 'aBm', Bm, 3); attr(g, 'aR', Rr, 4); attr(g, 'aS', Sa, 2);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = BS;
    const m = mat(`
attribute vec3 aAm, aBc, aBm; attribute vec4 aR; attribute vec2 aS;
uniform float uA; varying vec3 vC; varying float vA, vS, vSide, vLen;
void main() {
  vec3 A = morph(position, aAm, aR.x), B = morph(aBc, aBm, aR.y);
  vec3 ab = B - A, mid = 0.5 * (A + B); float L = length(ab);
  vec3 o = mid - ab * dot(mid, ab) / max(L * L, 1e-6);
  vec3 C = mid + (length(o) > 0.02 ? normalize(o) : vec3(0.0, 1.0, 0.0)) * 0.24 * L;   // bowed away from the middle
  float s = aR.z, u = 1.0 - s;
  vec3 p = u * u * A + 2.0 * u * s * C + s * s * B, tg = 2.0 * u * (C - A) + 2.0 * s * (B - C);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 side = normalize(cross((modelViewMatrix * vec4(tg, 0.0)).xyz, mv.xyz) + vec3(1e-6));
  mv.xyz += side * aR.w * 0.012 * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
  float w = (1.0 - uKf) * bitAt(aS.y, uLo) + uKf * bitAt(aS.y, uHi);
  vC = seedCol(aS.x) * min(depthCue(mv), 1.15); vA = uA * uGk * w; vS = s; vSide = aR.w; vLen = L * 1.2;
  if (vA < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform float uTime; varying vec3 vC; varying float vA, vS, vSide, vLen;
void main() {
  float prof = 1.0 - vSide * vSide;
  float f = fract(vS * vLen / 0.09 - uTime * 0.45), pulse = exp(-pow((f - 0.5) / 0.16, 2.0));
  float ends = smoothstep(0.0, 0.07, vS) * smoothstep(1.0, 0.93, vS);
  gl_FragColor = vec4(vC * (1.0 + 1.2 * pulse), vA * prof * ends * (0.6 + 0.4 * pulse));
}`, { extra: { side: THREE.DoubleSide } });
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 3; set.group.add(mesh);
    return { mesh };
  })();

  // ---------------------------------------------------------------- walkers: a random walk with restart, planned
  // Each walker lives at one seed (spread evenly over the 35, which averages to the walk from all seeds). At every
  // step it jumps back home with probability r = 0.8, else hops to a random neighbour along a stored link (a gene
  // with none sends it home). Restarts at home change nothing, so they show as a short rest. Plans are seeded and
  // loop seamlessly (each starts and ends at home), so a walker's place is a function of the time.
  const NW = 300, TS = 7, LAG = 0.024, RS = FA.r;
  const W0 = new Int32Array(NW), WN = new Int32Array(NW), WT = new Float32Array(NW), WPH = new Float32Array(NW);
  let EA, EB, EK, E0, ED;
  {
    const a = [], b = [], k = [], t0 = [], du = [];
    for (let w = 0; w < NW; w++) {
      const home = SEED[w % NS], want = 14 + 8 * R();
      let t = 0, cur = home;
      const push = (x, y, kind, d) => { a.push(x); b.push(y); k.push(kind); t0.push(t); du.push(d); t += d; };
      const hop = x => NB[OFF[x] + Math.floor(R() * DEG[x])];
      W0[w] = a.length;
      for (let guard = 0; guard < 400; guard++) {
        if (cur === home) {
          if (t >= want) break;
          let n = 1; while (R() < RS && n < 12) n++;
          push(home, home, 2, n * 0.09);
          const y = hop(home); push(home, y, 0, 0.25 * (0.85 + 0.3 * R())); cur = y;
        } else if (DEG[cur] === 0 || R() < RS) { push(cur, home, 1, 0.13); cur = home; }
        else { const y = hop(cur); push(cur, y, 0, 0.25 * (0.85 + 0.3 * R())); cur = y; }
      }
      if (cur !== home) push(cur, home, 1, 0.13);
      WN[w] = a.length - W0[w]; WT[w] = t; WPH[w] = R() * t;
    }
    EA = Uint16Array.from(a); EB = Uint16Array.from(b); EK = Uint8Array.from(k); E0 = Float32Array.from(t0); ED = Float32Array.from(du);
  }
  const WP = new Float32Array(3 * NW * TS), WW = new Float32Array(2 * NW * TS), VP = new Float32Array(6 * NW), VA = new Float32Array(2 * NW);
  const wPos = new THREE.BufferAttribute(WP, 3), wW = new THREE.BufferAttribute(WW, 2);
  wPos.setUsage(THREE.DynamicDrawUsage); wW.setUsage(THREE.DynamicDrawUsage);
  const walkers = (() => {
    const hg = new THREE.BufferGeometry(), tg = new THREE.BufferGeometry();
    hg.setAttribute('position', wPos); hg.setAttribute('aW', wW); tg.setAttribute('position', wPos); tg.setAttribute('aW', wW);
    const hi = new Uint16Array(NW), ti = new Uint16Array(NW * (TS - 1) * 2);
    for (let w = 0; w < NW; w++) { hi[w] = w * TS; for (let j = 0; j < TS - 1; j++) { ti[2 * (w * (TS - 1) + j)] = w * TS + j; ti[2 * (w * (TS - 1) + j) + 1] = w * TS + j + 1; } }
    hg.setIndex(new THREE.BufferAttribute(hi, 1)); tg.setIndex(new THREE.BufferAttribute(ti, 1));
    const VS = `
attribute vec2 aW;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(0.028 * (1.0 + 0.4 * aW.y), mv);
  vC = mix(vec3(1.0, 0.78, 0.4), vec3(0.45, 0.85, 1.0), aW.y);
  vA = uA * aW.x;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
    const heads = new THREE.Points(hg, mat(VS, `
varying vec3 vC; varying float vA;
void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0; if (d > 1.0) discard;
  float core = smoothstep(0.5, 0.0, d), halo = pow(1.0 - d, 2.2);
  gl_FragColor = vec4(mix(vC, vec3(1.0), core * 0.7), vA * (core + halo * 0.6)); }`));
    const trails = new THREE.LineSegments(tg, mat(VS, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.003) discard; gl_FragColor = vec4(vC, vA * 0.85); }`));
    // the genes a walker has just reached glow warm for a moment
    const vg = new THREE.BufferGeometry();
    const vp = new THREE.BufferAttribute(VP, 3), va = new THREE.BufferAttribute(VA, 1);
    vp.setUsage(THREE.DynamicDrawUsage); va.setUsage(THREE.DynamicDrawUsage);
    vg.setAttribute('position', vp); vg.setAttribute('aA', va);
    const visits = new THREE.Points(vg, mat(`
attribute float aA;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(0.022 + 0.03 * aA, mv);
  vC = vec3(1.0, 0.58, 0.22); vA = uA * aA * 0.75;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, GLOW_FS));
    for (const o of [heads, trails, visits]) { o.frustumCulled = false; o.renderOrder = 5; o.visible = false; set.group.add(o); }
    return { heads, trails, visits, vp, va };
  })();
  // the core's places at the module's current morph (the walkers only visit the core), made again only when it moves
  const CP = new Float32Array(3 * NC);
  let cpM = -1;
  function corePlaces(m) {
    if (m === cpM) return;
    cpM = m;
    if (m <= 0) CP.set(P.subarray(0, 3 * NC)); else for (let i = 0; i < NC; i++) mpos(i, m, CP, 3 * i);
  }
  // where walker w is at time tt (into out at o); sets wk.k (event kind: 0 hop, 1 restart, 2 rest), wk.f, wk.e, wk.tt
  const wk = { k: 0, f: 0, e: 0, tt: 0 };
  function walkerAt(w, tt, out, o) {
    const T = WT[w];
    tt = (tt + WPH[w]) % T; if (tt < 0) tt += T;
    let lo = W0[w], hi = lo + WN[w] - 1;
    while (lo < hi) { const mi = (lo + hi + 1) >> 1; if (E0[mi] <= tt) lo = mi; else hi = mi - 1; }
    const k = EK[lo], f = clamp((tt - E0[lo]) / ED[lo], 0, 1);
    wk.k = k; wk.f = f; wk.e = lo; wk.tt = tt;
    const a = 3 * EA[lo];
    if (k === 2) { out[o] = CP[a]; out[o + 1] = CP[a + 1]; out[o + 2] = CP[a + 2]; return; }
    const e = k === 0 ? smooth(f) : 1 - Math.pow(1 - f, 2.4), b = 3 * EB[lo];   // a hop glides, a restart streaks home
    out[o] = CP[a] + (CP[b] - CP[a]) * e; out[o + 1] = CP[a + 1] + (CP[b + 1] - CP[a + 1]) * e; out[o + 2] = CP[a + 2] + (CP[b + 2] - CP[a + 2]) * e;
  }
  let walkersOn = false;
  function updateWalkers(wv, t, m) {
    const on = wv > 0.003;
    walkers.heads.visible = walkers.trails.visible = walkers.visits.visible = on;
    if (!on) { if (walkersOn) { WW.fill(0); VA.fill(0); } walkersOn = false; return; }
    walkersOn = true;
    corePlaces(m);
    const live = wv * NW;
    for (let w = 0; w < NW; w++) {
      const aw = clamp(live - w, 0, 1), b = w * TS;
      if (aw <= 0) { for (let j = 0; j < TS; j++) WW[2 * (b + j)] = 0; VA[2 * w] = VA[2 * w + 1] = 0; continue; }
      // a home-coming walker fades into its seed, and shows again as it leaves
      walkerAt(w, t, WP, 3 * b);
      const k = wk.k, ev = wk.e, tt = wk.tt;
      let ah = 1;
      if (k === 2) { const s = tt - E0[ev], r = E0[ev] + ED[ev] - tt; ah = Math.max(0, 1 - s / 0.14, 1 - r / 0.1); }
      for (let j = 0; j < TS; j++) {
        if (j) walkerAt(w, t - j * LAG, WP, 3 * (b + j));
        WW[2 * (b + j)] = aw * (j ? 0.9 * Math.pow(1 - j / TS, 1.2) : ah) * (j && wk.k === 1 ? 0.6 : 1);
        WW[2 * (b + j) + 1] = (j ? wk.k : k) === 1 ? 1 : 0;
      }
      // the last two genes reached (not home), glowing for about a second
      let found = 0, e = ev, back = 0;
      const first = W0[w], last = first + WN[w] - 1;
      for (let n = 0; n < 8 && found < 2; n++) {
        if (EK[e] === 0) {
          const ta = E0[e] + ED[e] - back, age = tt - ta;
          if (age >= 0) {
            if (age > 2.5) break;
            if (EB[e] !== EA[first]) { const q = 3 * EB[e], v = 3 * (2 * w + found); VP[v] = CP[q]; VP[v + 1] = CP[q + 1]; VP[v + 2] = CP[q + 2]; VA[2 * w + found] = aw * Math.exp(-age / 0.7); found++; }
          }
        }
        if (e === first) { e = last; back += WT[w]; } else e--;
      }
      for (; found < 2; found++) VA[2 * w + found] = 0;
    }
    wPos.needsUpdate = wW.needsUpdate = true;
    walkers.vp.needsUpdate = walkers.va.needsUpdate = true;
  }

  // ---------------------------------------------------------------- one gene's neighbourhood: lines and a bubble
  const hoodGeo = new THREE.BufferGeometry();
  const HP = new Float32Array(6 * HS), HM = new Float32Array(6 * HS), HG = new Float32Array(6 * HS), HGM = new Float32Array(6 * HS), HH = new Float32Array(8 * HS);
  attr(hoodGeo, 'position', HP, 3); attr(hoodGeo, 'aMod', HM, 3); attr(hoodGeo, 'aG', HG, 3); attr(hoodGeo, 'aGm', HGM, 3); attr(hoodGeo, 'aH', HH, 4);
  hoodGeo.boundingSphere = BS; hoodGeo.setDrawRange(0, 0);
  const hoodLines = new THREE.LineSegments(hoodGeo, mat(`
attribute vec3 aMod, aG, aGm; attribute vec4 aH;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec3 me = morph(position, aMod, aH.x), g = morph(aG, aGm, aH.y);
  float grow = clamp((uHoodP - aH.z) / 0.06, 0.0, 1.0), L = length(me - g);
  vec4 mv = modelViewMatrix * vec4(mix(g, me, aH.w * grow), 1.0);
  gl_Position = projectionMatrix * mv;
  vC = mix(vec3(0.85, 0.97, 1.0), vec3(0.3, 0.82, 1.0), aH.w) * depthCue(mv);
  vA = uA * uHoodOn * step(0.001, grow) * (0.12 + 0.4 / (1.0 + L * L * 6.0)) * (1.0 - 0.4 * uMod);
}`, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.002) discard; gl_FragColor = vec4(vC, vA); }`));
  hoodLines.renderOrder = 4; set.group.add(hoodLines);
  const bubMat = K.rim(set, { color: '#46d9ff', a0: 0.04, a1: 0.65 });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), bubMat);
  bubble.renderOrder = 6; bubble.visible = false; set.group.add(bubble);
  let hoodGene = -2;
  const hoodCtr = [new Float32Array(3), new Float32Array(3)];   // the neighbourhood's core members' middle, in the cloud and in the module view
  function setHood(g) {
    hoodGene = g;
    HA.fill(-1);
    let n = 0;
    hoodCtr[0].fill(0); hoodCtr[1].fill(0);
    if (g >= 0) {
      for (let r = HS - 1; r >= 0; r--) HA[HOOD[g * HS + r]] = r;
      const g3 = 3 * g;
      for (let r = 1; r < HS; r++) {
        const h = HOOD[g * HS + r];
        if (h >= NC) continue;
        for (let j = 0; j < 2; j++) {
          const v = 2 * n + j;
          for (let a = 0; a < 3; a++) { HP[3 * v + a] = P[3 * h + a]; HM[3 * v + a] = MT[3 * h + a]; HG[3 * v + a] = P[g3 + a]; HGM[3 * v + a] = MT[g3 + a]; }
          HH[4 * v] = ST[h]; HH[4 * v + 1] = ST[g]; HH[4 * v + 2] = r / HS; HH[4 * v + 3] = j;
        }
        for (let a = 0; a < 3; a++) { hoodCtr[0][a] += P[3 * h + a]; hoodCtr[1][a] += MT[3 * h + a]; }
        n++;
      }
      if (n) for (let a = 0; a < 3; a++) { hoodCtr[0][a] /= n; hoodCtr[1][a] /= n; }
    }
    hoodGeo.setDrawRange(0, 2 * n);
    for (const k in hoodGeo.attributes) hoodGeo.attributes[k].needsUpdate = true;
    nodeGeo.attributes.aHood.needsUpdate = true;
  }

  // ---------------------------------------------------------------- update
  let apiGene = -1;
  const cur = { m: 0, gene: -1, hoodOn: 0 };
  const _g = new Float32Array(3);
  function update(S, t) {
    const cl = clamp(S.net_cloud, 0, 1), sd = clamp(S.net_seeds, 0, 1), kk = clamp(S.net_k, 0, NK - 1), wv = clamp(S.net_walk, 0, 1) * cl;
    const ht = clamp(S.net_heat, 0, 1), md = clamp(S.net_module, 0, 1), en = clamp(S.net_endo, 0, 1), hd = clamp(S.net_hood, 0, 1), fc = clamp(S.net_focus || 0, 0, NE);
    const pg = S.net_gene >= -0.5 ? Math.round(S.net_gene) : -1, g = pg >= 0 && pg < NM ? pg : apiGene;
    cur.m = md; cur.gene = g;
    if (g !== hoodGene) setHood(g);
    const hoodOn = g >= 0 ? prog(hd, 0, 0.3) : 0, mark = g >= 0 ? Math.max(hoodOn, pg < 0 ? 1 : 0) : 0;
    // the seed groups give way to the walk, its heat, the module and a neighbourhood
    // (below net_seeds 0.5 only the seeds glow: the story dims them to 0.4 for the neighbourhood chapter)
    const gk = prog(sd, 0.5, 1) * cl * (1 - Math.max(ht, md, hoodOn, en)) * (1 - 0.8 * wv);
    const lo = Math.floor(kk), hi = Math.min(NK - 1, lo + 1), f = kk - lo, kv = lerp(KV[lo], KV[hi], f);
    cur.hoodOn = hoodOn;
    U.uCloud.value = cl; U.uSeeds.value = sd; U.uKv.value = kv; U.uGk.value = gk; U.uHeat.value = ht; U.uMod.value = md; U.uEndo.value = en;
    U.uFocus.value = fc; U.uHoodP.value = g >= 0 ? prog(hd, 0.2, 1) * 1.06 : 0; U.uHoodOn.value = hoodOn; U.uMark.value = mark;
    // seeds stay white in the module, softer when one endotype is in focus
    U.uHot.value = Math.max(sd, ht, md * (1 - 0.7 * Math.min(fc, 1))) * cl;
    U.uLo.value = lo; U.uHi.value = hi; U.uKf.value = f;
    const sc = U.uSeedCol.value;
    for (let i = 0; i < 3 * NS; i++) sc[i] = lerp(GC[lo * 3 * NS + i], GC[hi * 3 * NS + i], f);
    // halos round the seeds grow with k (softer as they grow, so 35 of them merge into one glow)
    halo.mesh.visible = arcs.mesh.visible = gk > 0.003;
    if (gk > 0.003) {
      for (let s = 0; s < NS; s++) mpos(SEED[s], md, SCTR, 3 * s);
      halo.g.attributes.aCtr.needsUpdate = true;
      halo.m.uniforms.uHaloR.value = 0.04 + 0.021 * Math.sqrt(kv);
      halo.m.uniforms.uHaloA.value = 0.5 * gk / (1 + kv / 25);
    }
    // the gene's bubble
    bubble.visible = g >= 0 && mark > 0.003;
    if (bubble.visible) { mpos(g, md, _g, 0); bubble.position.set(_g[0], _g[1], _g[2]); bubble.scale.setScalar(0.055 + 0.03 * hoodOn); bubMat.uniforms.uK.value = mark * cl; }
    updateWalkers(wv, t, md);
  }

  // ---------------------------------------------------------------- anchors, labels, views
  // anchor functions write into their own arrays (no garbage per frame): copy one to keep it
  const _c = [0, 0, 0];
  const at = (i, out) => mpos(i, cur.m, out, 0);
  const centroid = (a, b, out) => { out[0] = out[1] = out[2] = 0; for (let i = a; i < b; i++) { at(i, _c); out[0] += _c[0]; out[1] += _c[1]; out[2] += _c[2]; } const n = Math.max(1, b - a); out[0] /= n; out[1] /= n; out[2] /= n; return out; };
  const seedMid = out => { out[0] = out[1] = out[2] = 0; for (let s = 0; s < NS; s++) { at(SEED[s], _c); for (let a = 0; a < 3; a++) out[a] += _c[a] / NS; } return out; };
  const own = f => { const o = [0, 0, 0]; return () => f(o); };
  // the topmost seed carries the "35 seed genes" label
  let topSeed = SEED[0]; for (let s = 0; s < NS; s++) if (P[3 * SEED[s] + 1] > P[3 * topSeed + 1]) topSeed = SEED[s];
  const runs = ENDO.map((_, e) => { let a = -1, b = -1; for (let i = 0; i < NM; i++) if (GENE[i] === e) { if (a < 0) a = i; b = i + 1; } return [a, b]; });
  let modTop = 0; for (let i = 0; i < NM; i++) modTop = Math.max(modTop, MODP[3 * i + 1]);
  const anchors = {
    centre: [0, 0, 0],
    cloud: [1.25, 1.55, 0.7],
    module: own(o => centroid(0, NM, o)),
    moduleTop: own(o => { o[0] = o[2] = 0; o[1] = lerp(1.15, modTop + 0.1, smooth(cur.m)); return o; }),
    seeds: own(seedMid),
    seedTop: own(o => at(topSeed, o)),
    k: [0.35, 0.95, 0.2],
    gene: own(o => (cur.gene >= 0 ? at(cur.gene, o) : centroid(0, NM, o))),
    hood: own(o => { const n = smooth(cur.m); for (let a = 0; a < 3; a++) o[a] = cur.gene >= 0 ? lerp(hoodCtr[0][a], hoodCtr[1][a], n) : 0; return o; }),
  };
  runs.forEach(([a, b], e) => { anchors['e' + e] = own(o => centroid(a, b, o)); });
  const SYM = D.seeds.map(s => s[0]), seedNamed = sym => SEED[SYM.indexOf(sym)];
  const quiet = S => 1 - Math.max(clamp(S.net_walk, 0, 1), clamp(S.net_heat, 0, 1), clamp(S.net_module, 0, 1), clamp(S.net_endo, 0, 1), cur.hoodOn || 0);
  const kOf = S => clamp(S.net_k, 0, NK - 1);
  const fmt = n => n.toLocaleString('en-GB');
  const labels = [
    { text: [fmt(FA.genes), 'proteins'], cls: 'cyn', at: 'cloud', alpha: S => prog(S.net_cloud, 0.5, 1) * (1 - prog(S.net_seeds, 0, 0.4)) * (1 - clamp(S.net_module, 0, 1)) * (1 - (cur.hoodOn || 0)) },
    { text: [`${NS} seed genes`, ''], cls: '', at: 'seedTop', alpha: S => prog(S.net_seeds, 0.3, 0.8) * (1 - prog(kOf(S), 0.02, 0.25)) * quiet(S) },
    ...['CHRNA1', 'MUSK', 'AGRN', 'DOK7'].map(sym => ({ text: [sym, ''], cls: '', at: own(o => at(seedNamed(sym), o)), minor: true,
      alpha: S => prog(S.net_seeds, 0.5, 1) * (1 - prog(kOf(S), 0.02, 0.25)) * quiet(S) })),
    ...KV.map((k, i) => ({ text: [`k = ${k}`, `· ${groupCount[i] === 1 ? 'one group' : groupCount[i] + ' groups'}`], cls: 'amb', at: 'k',
      alpha: S => prog(S.net_seeds, 0.5, 1) * clamp((0.5 - Math.abs(kOf(S) - i)) * 4.5, 0, 1) * (i ? 1 : prog(kOf(S), 0.04, 0.2)) * quiet(S) * (1 - clamp(S.net_endo, 0, 1)) })),
    { text: ['The module', `· ${fmt(FA.module)} genes`], cls: 'amb', at: 'moduleTop', alpha: S => prog(S.net_module, 0.6, 1) * (1 - (cur.hoodOn || 0)) * (1 - clamp(S.net_focus || 0, 0, 1)) },
    // the current gene's name: the story's genes are seeds; explore mode labels any other gene at the 'gene' anchor
    ...Array.from(SEED).map((i, s) => ({ text: [SYM[s], `· ${HS}-gene neighbourhood`], cls: 'cyn', at: own(o => at(i, o)),
      alpha: S => (cur.gene === i ? 1 : 0) * prog(clamp(S.net_hood, 0, 1), 0.05, 0.35) })),
  ];
  // a view of gene i from outside the cloud, the gene in front
  function geneView(i) {
    if (!(i >= 0 && i < NM)) return [20, 10, 2.9, 0, 0, 0];
    const p = at(i, [0, 0, 0]), az = Math.atan2(p[0], p[2]) * 180 / Math.PI;
    return [Math.round(az + 12), 12, cur.m > 0.5 ? 1.8 : 2.4, +p[0].toFixed(3), +p[1].toFixed(3), +p[2].toFixed(3)];
  }
  const cam = { default: [18, 12, 6.8, 0, 0, 0], core: [24, 10, 4.4, 0, 0, 0], module: [20, 8, 2.9, 0, 0, 0], seeds: [-28, 14, 3.6, 0, 0, 0] };
  Object.defineProperty(cam, 'gene', { enumerable: true, get: () => geneView(cur.gene) });
  const controls = [
    { key: 'view', label: 'View', options: [['network', 'Network'], ['module', 'Module']] },
    { key: 'walkers', label: 'Walkers', options: [['off', 'Off'], ['on', 'On']] },
    { key: 'colour', label: 'Colour', options: [['walk', 'Walk'], ['endo', 'Endotypes']] },
  ];
  function explore(c) {
    return { net_cloud: 1, net_seeds: 1, net_module: c.view === 'module' ? 1 : 0, net_walk: c.walkers === 'on' ? 1 : 0,
      net_heat: c.colour === 'walk' ? 1 : 0, net_endo: c.colour === 'endo' ? 1 : 0 };
  }

  // ---------------------------------------------------------------- explore API
  const BYNAME = new Map(MNAMES.map((s, i) => [s.toUpperCase(), i]));
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray(), _q = new Float32Array(3);
  function pick(raycaster) {
    set.group.updateMatrixWorld();
    _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    const o = _ray.origin, d = _ray.direction;
    let best = -1, bs = 1;
    for (let i = 0; i < NM; i++) {
      mpos(i, cur.m, _q, 0);
      const x = _q[0] - o.x, y = _q[1] - o.y, z = _q[2] - o.z, along = x * d.x + y * d.y + z * d.z;
      if (along <= 0) continue;
      const off = Math.sqrt(Math.max(0, x * x + y * y + z * z - along * along)), tol = 0.02 + 0.014 * along, s = off / tol;
      if (s < bs) { bs = s; best = i; }
    }
    return best;
  }
  const API = {
    names: MNAMES,
    setGene: i => { apiGene = i >= 0 && i < NM ? i | 0 : -1; },
    geneIndex: name => { const i = BYNAME.get(String(name || '').trim().toUpperCase()); return i === undefined ? -1 : i; },
    pick,
    seeds: Array.from(SEED),                 // module indices of the 35 seeds, in the Gene Table's order
    kValues: KV.slice(), groupCount,         // the 13 neighbourhood sizes and the number of seed groups at each
    endoOf: i => (i >= 0 && i < NM ? GENE[i] : -1),
    geneView,                                // [az, el, dist, tx, ty, tz] near module gene i
    hoodCore: i => { const o = []; if (i >= 0 && i < NM) for (let r = 1; r < HS; r++) if (HOOD[i * HS + r] < NC) o.push(HOOD[i * HS + r]); return o; },
  };
  return Object.assign(set, {
    params: { net_a: 1, net_cloud: 1, net_seeds: 0, net_k: 0, net_walk: 0, net_heat: 0, net_module: 0, net_endo: 0, net_gene: -1, net_hood: 0, net_focus: 0 },
    update, anchors, labels, cam, controls, explore, api: () => API,
  });
};

// The tree set of the endotype story: from the neighbourhoods' terms to the 12 endotypes. The gene x term matrix
// fills row by row, the dendrogram grows beside it, the split tests run down the tree from the root (a kept split
// parts the rows, a refused one gives an endotype its colour), the genes fly to positions by their tree distances,
// and the endotype network (the poster's metagraph) gathers them into bubbles on a ring. All geometry is built once;
// positions, colours and morphs are worked out in the shaders from a few dozen uniforms that update() sets.
SETS.tree = function (K) {
  const { THREE, smooth, clamp, lerp, prog, rng, rgb } = K;
  const set = K.newSet('tree');
  const D = ENDO_DATA, EN = D.endo, NE = EN.length, N = D.mod, NT = D.terms.length, PI = Math.PI, TAU = PI * 2;

  // ---------------------------------------------------------------- decode the data (once)
  const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const u16 = s => { const b = bytes(s); return new Uint16Array(b.buffer, 0, b.length >> 1); };
  const GENE = bytes(D.gene), SEED = bytes(D.seedOf), AB = u16(D.tree.ab), TH = bytes(D.tree.h), TCUT = bytes(D.tree.cut);
  const FN = u16(D.featN), FI = u16(D.featI), LK = u16(D.links), ML = D.modLinks || 0;
  const NAME = D.names.split('|').slice(0, N);
  const ECOL = EN.map(e => rgb(e.col));
  const MEM = EN.map(() => []); for (let i = 0; i < N; i++) MEM[GENE[i]].push(i);

  // the tree: node ids as in scipy (0..N-1 the genes, N + k merge k); leaves are in tree order, so every node spans a
  // run of rows LO..HI, and u (its row coordinate) is the middle of its two children's
  const NN = 2 * N - 1, ROOT = NN - 1;
  const NU = new Float32Array(NN), NH = new Float32Array(NN), LO = new Int32Array(NN), HI = new Int32Array(NN), PAR = new Int32Array(NN).fill(-1);
  for (let i = 0; i < N; i++) { NU[i] = i; LO[i] = HI[i] = i; }
  for (let k = 0; k < N - 1; k++) {
    const a = AB[2 * k], b = AB[2 * k + 1], n = N + k;
    NU[n] = (NU[a] + NU[b]) / 2; NH[n] = TH[k] / 255; LO[n] = Math.min(LO[a], LO[b]); HI[n] = Math.max(HI[a], HI[b]); PAR[a] = n; PAR[b] = n;
  }
  const KA = n => AB[2 * (n - N)], KB = n => AB[2 * (n - N) + 1];
  // the kept splits (cut 1), children before parents; each parts the rows at one boundary between two endotypes
  const CUTN = []; for (let k = 0; k < N - 1; k++) if (TCUT[k]) CUTN.push(N + k);
  const NC = Math.max(1, CUTN.length), CI = new Int32Array(NN).fill(-1); CUTN.forEach((n, j) => { CI[n] = j; });
  const BND = new Float32Array(NC).fill(1e6), CKA = new Int32Array(NC), CKB = new Int32Array(NC);
  CUTN.forEach((n, j) => { const a = KA(n), b = KB(n); CKA[j] = a; CKB[j] = b; BND[j] = (HI[a] < LO[b] ? HI[a] : HI[b]) + 0.5; });
  // the test pulse: it starts on a short trunk left of the root and arrives at each node of the kept tree at TAUN;
  // where it meets a split inside an endotype (that endotype's root) the test refuses and the endotype's colour runs
  // down its subtree (WD) and across its rows of the matrix (WA)
  const EROOT = new Int32Array(NE).fill(-1), TAUN = new Float32Array(NN).fill(-1);
  const visit = (n, tau) => {
    TAUN[n] = tau;
    if (CI[n] >= 0) for (const c of [KA(n), KB(n)]) visit(c, tau + 0.45 + 1.6 * (NH[n] - NH[c]));
    else EROOT[GENE[LO[n]]] = n;
  };
  visit(ROOT, 0);
  const TE = Array.from(EROOT, n => (n >= 0 ? TAUN[n] : 0)), WD = 1.0, WA = 0.8, P0 = -0.55, HTOP = 1.07;
  const PEND = Math.max(...TE) + WD + WA + 0.25;
  const washT = (e, h) => { const r = EROOT[e]; return TE[e] + WD * (1 - h / Math.max(r >= 0 ? NH[r] : 1, 1e-3)); };

  // the matrix: rows = genes, columns = terms ordered by the mean row of their ones, so its structure shows
  const OFF = new Int32Array(N + 1); for (let i = 0; i < N; i++) OFF[i + 1] = OFF[i] + FN[i];
  const tSum = new Float64Array(NT), tCnt = new Int32Array(NT);
  for (let i = 0; i < N; i++) for (let q = OFF[i]; q < OFF[i + 1]; q++) { tSum[FI[q]] += i; tCnt[FI[q]]++; }
  const ORDER = Array.from({ length: NT }, (_, c) => c).sort((a, b) => (tCnt[a] ? tSum[a] / tCnt[a] : 1e9) - (tCnt[b] ? tSum[b] / tCnt[b] : 1e9) || a - b);
  const COLX = new Int32Array(NT); ORDER.forEach((c, x) => { COLX[c] = x; });

  // the module's own links: inside an endotype (drawn in its bubble) and between two (the grey bands)
  const WL = [], BT = new Int32Array(NE * NE), OWN = new Int32Array(NE);
  for (let k = 0; k < ML; k++) {
    const a = LK[2 * k], b = LK[2 * k + 1]; if (a >= N || b >= N) continue;
    const ea = GENE[a], eb = GENE[b];
    if (ea === eb) { WL.push(a, b); OWN[ea]++; } else { BT[ea * NE + eb]++; BT[eb * NE + ea]++; }
  }
  const LOOSE = EN.map((e, k) => OWN[k] === 0);

  // ---------------------------------------------------------------- the look's dimensions (local units)
  const RH = 1.3, RP = RH / N, Y0 = (N - 1) * RP / 2, GAP = 0.02;           // rows: 1.3 tall, parting by GAP per kept split
  const MW = 1.5, CP = MW / NT, X0 = -0.36, X1 = X0 + MW;                  // columns: 1.5 wide
  const XL = X0 - 0.05, WT = 0.78, ZT = 0.3;                               // the tree: leaves at XL, root WT further left
  const XD = XL + 0.024;                                                   // the genes' dots between the leaves and the matrix
  const SZC = Math.min(RP, CP) * 1.08;

  // ---------------------------------------------------------------- positions by tree distance: metric MDS (SMACOF) of
  // the endotypes by the height where their subtrees meet, then of each endotype's genes by their own tree distances
  // (drawn smaller, so the endotypes read as clusters)
  function smacof(n, d, iters, r) {
    const X = new Float64Array(3 * n), Y = new Float64Array(3 * n);
    for (let i = 0; i < 3 * n; i++) X[i] = r() - 0.5;
    for (let it = 0; it < iters; it++) {
      Y.fill(0);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = X[3 * i] - X[3 * j], dy = X[3 * i + 1] - X[3 * j + 1], dz = X[3 * i + 2] - X[3 * j + 2];
        const dd = Math.sqrt(dx * dx + dy * dy + dz * dz), b = dd > 1e-9 ? d[i * n + j] / dd : 0;
        Y[3 * i] += b * dx; Y[3 * i + 1] += b * dy; Y[3 * i + 2] += b * dz; Y[3 * j] -= b * dx; Y[3 * j + 1] -= b * dy; Y[3 * j + 2] -= b * dz;
      }
      for (let i = 0; i < 3 * n; i++) X[i] = Y[i] / n;
    }
    let cx = 0, cy = 0, cz = 0; for (let i = 0; i < n; i++) { cx += X[3 * i]; cy += X[3 * i + 1]; cz += X[3 * i + 2]; }
    for (let i = 0; i < n; i++) { X[3 * i] -= cx / n; X[3 * i + 1] -= cy / n; X[3 * i + 2] -= cz / n; }
    return X;
  }
  const R0 = rng(393457);
  const ED = new Float64Array(NE * NE);
  { const anc = Array.from(EROOT, n => { const s = new Set(); for (let x = n; x >= 0; x = PAR[x]) s.add(x); return s; });
    for (let e = 0; e < NE; e++) for (let f = 0; f < NE; f++) if (e !== f) {
      let x = EROOT[f]; while (x >= 0 && !anc[e].has(x)) x = PAR[x];
      ED[e * NE + f] = x >= 0 ? NH[x] : 1;
    } }
  const CE = smacof(NE, ED, 160, R0);
  const DL = EN.map((e, k) => { const r = EROOT[k], n = r >= 0 ? HI[r] - LO[r] + 1 : 0; return new Float64Array(n * n).fill(0.04); });
  for (let k = 0; k < N - 1; k++) {
    const m = N + k; if (CI[m] >= 0) continue;
    const e = GENE[LO[m]], r = EROOT[e]; if (r < 0) continue;
    const lo = LO[r], n = HI[r] - lo + 1, d = DL[e], a = KA(m), b = KB(m), h = Math.max(NH[m], 0.04);
    for (let i = LO[a]; i <= HI[a]; i++) for (let j = LO[b]; j <= HI[b]; j++) { d[(i - lo) * n + j - lo] = h; d[(j - lo) * n + i - lo] = h; }
  }
  const MDS = new Float32Array(3 * N), WPOS = new Float32Array(3 * N);
  for (let e = 0; e < NE; e++) {
    const r = EROOT[e]; if (r < 0) continue;
    const lo = LO[r], n = HI[r] - lo + 1, X = n > 1 ? smacof(n, DL[e], 70, R0) : new Float64Array(3);
    let mx = 1e-6; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.hypot(X[3 * i], X[3 * i + 1], X[3 * i + 2]));
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) {
      WPOS[3 * (lo + i) + c] = X[3 * i + c] / mx;
      MDS[3 * (lo + i) + c] = CE[3 * e + c] + X[3 * i + c] * 0.34;
    }
  }
  { let mx = 1e-6; for (let i = 0; i < N; i++) mx = Math.max(mx, Math.hypot(MDS[3 * i], MDS[3 * i + 1], MDS[3 * i + 2]));
    for (let i = 0; i < 3 * N; i++) MDS[i] *= 0.82 / mx; }
  const MDSC = EN.map((e, k) => { const c = [0, 0, 0]; for (const i of MEM[k]) for (let q = 0; q < 3; q++) c[q] += MDS[3 * i + q] / Math.max(1, MEM[k].length); return c; });
  const MDSR = EN.map((e, k) => { let s = 0; for (const i of MEM[k]) s = Math.max(s, Math.hypot(MDS[3 * i] - MDSC[k][0], MDS[3 * i + 1] - MDSC[k][1], MDS[3 * i + 2] - MDSC[k][2])); return s; });

  // ---------------------------------------------------------------- the endotype network: bubbles on a ring (tree
  // order, the biggest at the top), the loose endotypes (no links among their own genes) floating below it
  const BR = EN.map((e, k) => 0.052 * Math.cbrt(Math.max(1, MEM[k].length)) * (LOOSE[k] ? 0.85 : 1));
  const runOrder = EN.map((e, k) => k).filter(k => EROOT[k] >= 0).sort((a, b) => LO[EROOT[a]] - LO[EROOT[b]]);
  let ring = runOrder.filter(k => !LOOSE[k]);
  const loose = runOrder.filter(k => LOOSE[k]);
  if (ring.length) { const big = ring.reduce((b, k) => (MEM[k].length > MEM[b].length ? k : b), ring[0]), q = ring.indexOf(big); ring = ring.slice(q).concat(ring.slice(0, q)); }
  const BC = new Float32Array(3 * NE), PAD = 0.075, LBELOW = new Uint8Array(NE);   // LBELOW: its label under the bubble
  { const span = k => 2 * BR[k] + PAD, tot = ring.reduce((s, k) => s + span(k), 0), RR = Math.max(0.3, tot / TAU);
    let c = 0;
    ring.forEach((k, j) => { if (j) c += (span(ring[j - 1]) + span(k)) / 2; const a = PI / 2 - c / RR;
      BC[3 * k] = RR * Math.cos(a); BC[3 * k + 1] = RR * Math.sin(a); BC[3 * k + 2] = 0.08 * Math.sin(2 * a); });
    let bot = 0; for (const k of ring) bot = Math.min(bot, BC[3 * k + 1] - BR[k]);
    loose.forEach((k, j) => { const sx = loose.length > 1 ? (j / (loose.length - 1)) * 2 - 1 : 0;
      BC[3 * k] = sx * RR * 0.95; BC[3 * k + 1] = bot - 0.02 - BR[k] - (1 - Math.abs(sx)) * 0.12; BC[3 * k + 2] = -0.1; });
    // labels: above the bubbles, but on the lower part of the ring they alternate below and above (neighbours there
    // are close), and the loose ones have theirs below
    ring.filter(k => BC[3 * k + 1] < -0.6 * RR).sort((a, b) => BC[3 * a] - BC[3 * b]).forEach((k, j) => { LBELOW[k] = j % 2 ? 1 : 0; });
    for (const k of loose) LBELOW[k] = 1;
    let top = -9, low = 9; for (let k = 0; k < NE; k++) { top = Math.max(top, BC[3 * k + 1] + BR[k]); low = Math.min(low, BC[3 * k + 1] - BR[k]); }
    const sh = -(top + low) / 2; for (let k = 0; k < NE; k++) BC[3 * k + 1] += sh; }
  const RCY = (() => { let s = 0, n = 0; for (const k of ring) { s += BC[3 * k + 1]; n++; } return n ? s / n : 0; })();
  const META_TOP = Math.max(...EN.map((e, k) => BC[3 * k + 1] + BR[k])), META_LOW = Math.min(...EN.map((e, k) => BC[3 * k + 1] - BR[k]));
  // each endotype's genes inside its bubble: a small force layout of its own links, started from its tree distances
  const LOC = new Float32Array(3 * N);
  { const adj = EN.map(() => []); for (let q = 0; q < WL.length; q += 2) adj[GENE[WL[q]]].push(WL[q], WL[q + 1]);
    for (let e = 0; e < NE; e++) {
      const r = EROOT[e]; if (r < 0) continue;
      const lo = LO[r], n = HI[r] - lo + 1, P = new Float64Array(3 * n), rr = Math.min(0.75, 1.15 / Math.cbrt(n)), rest = rr * 0.75;
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) P[3 * i + c] = WPOS[3 * (lo + i) + c] * 0.9 + (R0() - 0.5) * 0.04;
      const L = adj[e];
      for (let it = 0; it < 90; it++) {
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
          if (d < rr) { const f = (rr - d) / d * 0.22; P[3 * i] += dx * f; P[3 * i + 1] += dy * f; P[3 * i + 2] += dz * f; P[3 * j] -= dx * f; P[3 * j + 1] -= dy * f; P[3 * j + 2] -= dz * f; }
        }
        for (let q = 0; q < L.length; q += 2) {
          const i = L[q] - lo, j = L[q + 1] - lo, dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6, f = (d - rest) / d * 0.08;
          P[3 * i] -= dx * f; P[3 * i + 1] -= dy * f; P[3 * i + 2] -= dz * f; P[3 * j] += dx * f; P[3 * j + 1] += dy * f; P[3 * j + 2] += dz * f;
        }
        for (let i = 0; i < n; i++) { const l = Math.hypot(P[3 * i], P[3 * i + 1], P[3 * i + 2]); if (l > 1) { P[3 * i] /= l; P[3 * i + 1] /= l; P[3 * i + 2] /= l; } }
      }
      let mx = 1e-6; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.hypot(P[3 * i], P[3 * i + 1], P[3 * i + 2]));
      const s = (LOOSE[e] ? 0.95 : 0.8) / mx;
      for (let i = 0; i < 3 * n; i++) LOC[3 * lo + i] = P[i] * s;
    } }

  // ---------------------------------------------------------------- shared uniforms and GLSL
  const UNI = {
    uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime,
    uGap: { value: new Float32Array(NC) }, uBnd: { value: BND }, uCutY: { value: new Float32Array(NC) },
    uF: { value: new Float32Array(NE) }, uR: { value: Float32Array.from(BR) }, uC: { value: BC },
    uCol: { value: Float32Array.from([].concat(...ECOL)) },
    uP: { value: PEND }, uScan: { value: N + 4 }, uScanA: { value: 0 }, uGridA: { value: 1 }, uGrow: { value: 1.2 }, uGrowing: { value: 0 },
    uMT: { value: 1 }, uM1: { value: 0 }, uM2: { value: 0 }, uDim: { value: 0 }, uFwdA: { value: 0.04 }, uBub: { value: 0 }, uLinkA: { value: 0 }, uBandA: { value: 0 },
  };
  const gf = x => (Number.isInteger(x) ? x.toFixed(1) : x.toFixed(6));   // a number for GLSL
  const HEAD = K.GLSL + `
uniform float uA, uGap[${NC}], uBnd[${NC}], uCutY[${NC}], uF[${NE}], uR[${NE}];
uniform vec3 uC[${NE}], uCol[${NE}];
uniform float uP, uScan, uScanA, uGrow, uGrowing, uMT, uM1, uM2, uDim, uFwdA, uBub, uLinkA, uBandA;
const float Y0 = ${gf(Y0)}, RP = ${gf(RP)}, GAP = ${gf(GAP)}, XL = ${gf(XL)}, WT = ${gf(WT)}, ZT = ${gf(ZT)}, X0 = ${gf(X0)}, CP = ${gf(CP)}, XD = ${gf(XD)};
const vec3 RC = vec3(0.0, ${gf(RCY)}, 0.0);
// a row's height: the kept splits passed so far part the rows at their boundaries
float rowY(float u) { float y = Y0 - u * RP; for (int k = 0; k < ${NC}; k++) y += GAP * uGap[k] * (0.5 - step(uBnd[k], u)); return y; }
float nodeY(float u, float i) { return i > -0.5 ? uCutY[int(i + 0.5)] : rowY(u); }
vec3 treeP(float h, float y) { return vec3(XL - WT * h, y, ZT * h * h); }
// a branch from child (x) to parent (y): an S-curve, level at both ends
vec3 branchP(vec2 u, vec2 h, vec2 i, float s) { float e = s * s * (3.0 - 2.0 * s); return treeP(mix(h.x, h.y, s), mix(nodeY(u.x, i.x), nodeY(u.y, i.y), e)); }
// brightness of endotype k under the focus: the focused one brighter, the others dimmed
float lum(int k) { return (1.0 - uDim * 0.72 * (1.0 - uF[k])) * (1.0 + 0.35 * uF[k]); }
vec3 bubC(int k) { return mix(uC[k], RC, 0.2 * uF[k]) + vec3(0.0, 0.0, 0.34 * uF[k]); }
float bubR(int k) { return uR[k] * (1.0 + 0.16 * uF[k]); }
`;
  // a gene's place: its row, its tree-distance spot, its bubble (each gene leaves a little after or before the others)
  const GENE_GLSL = `
attribute float aRow, aE, aSeed, aStag, aTm; attribute vec3 aMds, aLoc;
vec3 geneP(out float e1, out float e2) {
  int k = int(aE + 0.5);
  e1 = smoothstep(aStag * 0.35, aStag * 0.35 + 0.65, uM1);
  e2 = smoothstep(aStag * 0.3, aStag * 0.3 + 0.7, uM2);
  vec3 p = mix(vec3(XD, rowY(aRow), 0.0), aMds, e1);
  p.z += 0.22 * sin(3.14159 * e1) + uF[k] * uFwdA;
  p = mix(p, bubC(k) + aLoc * bubR(k), e2);
  p.z += 0.16 * sin(3.14159 * e2);
  return p;
}
`;
  const mat = (vs, fs, o = {}) => {
    const m = new THREE.ShaderMaterial(Object.assign({ uniforms: UNI, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending }, o));
    set.mats.push(m);
    return m;
  };
  const geo = (n, attrs, index) => {
    const g = new THREE.BufferGeometry(), A = { position: new Float32Array(3 * n) };
    g.setAttribute('position', new THREE.BufferAttribute(A.position, 3));
    for (const [k, s] of attrs) { A[k] = new Float32Array(n * s); g.setAttribute(k, new THREE.BufferAttribute(A[k], s)); }
    if (index) g.setIndex(index);
    return [g, A];
  };
  const add = (o, order) => { o.frustumCulled = false; o.renderOrder = order; set.group.add(o); return o; };

  // ---------------------------------------------------------------- the matrix: a faint grid per endotype block (it
  // parts with the rows), the scan line, and the ones as crisp glowing cells
  const bndAt = u => { for (let j = 0; j < CUTN.length; j++) if (Math.abs(BND[j] - u) < 0.01) return j; return -1; };
  { const [g, A] = geo(4 * NE, [['aUC', 2], ['aQ', 2], ['aG', 2], ['aE', 1], ['aTm', 1]], (() => { const ix = []; for (let k = 0; k < NE; k++) ix.push(4 * k, 4 * k + 1, 4 * k + 2, 4 * k + 2, 4 * k + 1, 4 * k + 3); return ix; })());
    for (let e = 0; e < NE; e++) {
      const r = EROOT[e], lo = r >= 0 ? LO[r] : 0, hi = r >= 0 ? HI[r] : -1;
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([qx, qy], c) => {
        const v = 4 * e + c;
        A.aUC.set([qy ? hi + 0.5 - 1e-3 : lo - 0.5 + 1e-3, qx ? NT + 1 : -1], 2 * v); A.aQ.set([qx, qy], 2 * v);
        A.aE[v] = e; A.aTm[v] = TE[e] + WD + (qx ? WA : 0); A.aG.set([bndAt(lo - 0.5), bndAt(hi + 0.5)], 2 * v);
      });
    }
    add(new THREE.Mesh(g, mat(HEAD + `
attribute vec2 aUC, aQ, aG; attribute float aE, aTm;
varying vec2 vUC, vQ, vG; varying vec3 vCol; varying float vTm, vK;
void main() {
  int k = int(aE + 0.5);
  vUC = aUC; vQ = aQ; vCol = uCol[k]; vTm = aTm; vK = lum(k);
  vG = vec2(aG.x < -0.5 ? 1.0 : uGap[int(aG.x + 0.5)], aG.y < -0.5 ? 1.0 : uGap[int(aG.y + 0.5)]);   // a frame between two blocks shows as they part
  gl_Position = projectionMatrix * modelViewMatrix * vec4(X0 + aUC.y * CP, rowY(aUC.x), uF[k] * uFwdA - 0.002, 1.0);
}`, `
uniform float uA, uP, uScan, uScanA, uGridA, uMT;
varying vec2 vUC, vQ, vG; varying vec3 vCol; varying float vTm, vK;
void main() {
  vec2 w = max(fwidth(vUC), vec2(1e-4)), fr = vec2(fract(vUC.x + 0.5), fract(vUC.y));
  vec2 dl = min(fr, 1.0 - fr) / w;
  float dense = smoothstep(0.22, 0.5, max(w.x, w.y));                    // cells under ~3 px: no lines (no moire), only the tint
  float line = (1.0 - smoothstep(0.0, 1.0, min(dl.x, dl.y))) * (1.0 - dense);
  vec2 qw = max(fwidth(vQ), vec2(1e-5)), qe = min(vQ, 1.0 - vQ) / qw;
  float edge = max(1.0 - smoothstep(0.0, 1.5, qe.x), (1.0 - smoothstep(0.0, 1.5, qe.y)) * (vQ.y < 0.5 ? vG.x : vG.y));
  float filled = smoothstep(uScan + 0.5, uScan - 0.5, vUC.x), lit = smoothstep(vTm - 0.05, vTm + 0.3, uP);
  vec3 col = mix(vec3(0.55, 0.66, 0.8), vCol, lit);
  float a = 0.03 + 0.025 * filled + 0.05 * lit + line * 0.09 + edge * (0.16 + 0.3 * lit);
  float sd = abs(vUC.x - uScan);
  a += uScanA * (exp(-sd * sd / 2.0) * 0.9 + exp(-sd / 9.0) * 0.08);
  col = mix(col, vec3(0.55, 0.93, 1.0), uScanA * exp(-sd / 3.0));
  gl_FragColor = vec4(col, a * vK * uMT * uGridA * uA);
}`, { side: THREE.DoubleSide, extensions: { derivatives: true } })), 1); }

  const NCELL = FI.length;
  { const [g, A] = geo(NCELL, [['aRC', 2], ['aE', 1], ['aTm', 1]]);
    let v = 0;
    for (let i = 0; i < N; i++) for (let q = OFF[i]; q < OFF[i + 1]; q++, v++) {
      const x = COLX[FI[q]]; A.aRC[2 * v] = i; A.aRC[2 * v + 1] = x; A.aE[v] = GENE[i]; A.aTm[v] = TE[GENE[i]] + WD + WA * x / NT;
    }
    add(new THREE.Points(g, mat(HEAD + `
attribute vec2 aRC; attribute float aE, aTm;
varying vec3 vC; varying float vA;
void main() {
  int k = int(aE + 0.5);
  float row = aRC.x, past = uScan - row;
  vec4 mv = modelViewMatrix * vec4(X0 + (aRC.y + 0.5) * CP, rowY(row), uF[k] * uFwdA, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(${gf(SZC)}, mv);
  float on = clamp(past, 0.0, 1.0), flash = on * exp(-max(past, 0.0) / 5.0) * uScanA, lit = smoothstep(aTm - 0.05, aTm + 0.25, uP);
  vC = mix(vec3(0.33, 0.8, 1.0), uCol[k], lit) * (1.0 + 1.8 * flash);
  vA = on * uMT * uA * lum(k) * 0.95;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA;
void main() {
  vec2 q = abs(gl_PointCoord - 0.5); float d = max(q.x, q.y);
  float a = smoothstep(0.5, 0.34, d);
  gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.3, 0.0, d) * 0.25), vA * a);
}`)), 3); }

  // ---------------------------------------------------------------- the tree: every branch an S-curve from its child to
  // its parent; the kept tree (from the root down to each endotype's root) and the subtrees inside the endotypes
  const BRANCHES = [];   // [child, parent node or -1 for the trunk]
  for (let n = 0; n < NN; n++) if (n !== ROOT) BRANCHES.push([n, PAR[n]]);
  BRANCHES.push([ROOT, -1]);
  const kept = ([c, p]) => p < 0 || CI[p] >= 0;
  const segsOf = b => (kept(b) ? 22 : NH[b[1]] - NH[b[0]] > 0.12 ? 9 : 6);
  const bInfo = ([c, p]) => {
    const hp = p < 0 ? HTOP : NH[p], ip = p < 0 ? CI[ROOT] : CI[p], up = p < 0 ? NU[ROOT] : NU[p];
    const tc = TAUN[c], tp = p < 0 ? P0 + 0.05 : TAUN[p], e = kept([c, p]) ? -1 : GENE[LO[c]];
    return { uc: NU[c], up, hc: NH[c], hp, ic: CI[c], ip, e, tm: s => (e < 0 ? tc + s * (tp - tc) : washT(e, lerp(NH[c], hp, s))) };
  };
  const putB = (A, v, B, s) => {
    A.aUU[2 * v] = B.uc; A.aUU[2 * v + 1] = B.up; A.aHH[2 * v] = B.hc; A.aHH[2 * v + 1] = B.hp; A.aII[2 * v] = B.ic; A.aII[2 * v + 1] = B.ip;
    A.aS[v] = s; A.aTm[v] = B.tm(s); if (A.aE) A.aE[v] = B.e;
  };
  { const nSeg = BRANCHES.reduce((s, b) => s + segsOf(b), 0);
    const [g, A] = geo(2 * nSeg, [['aUU', 2], ['aHH', 2], ['aII', 2], ['aS', 1], ['aE', 1], ['aTm', 1]]);
    let v = 0;
    for (const b of BRANCHES) { const B = bInfo(b), m = segsOf(b); for (let q = 0; q < m; q++) { putB(A, v++, B, q / m); putB(A, v++, B, (q + 1) / m); } }
    add(new THREE.LineSegments(g, mat(HEAD + `
attribute vec2 aUU, aHH, aII; attribute float aS, aE, aTm;
varying vec3 vC; varying float vA;
void main() {
  vec3 p = branchP(aUU, aHH, aII, aS);
  float h = mix(aHH.x, aHH.y, aS), lk = 1.0, d = uP - aTm;
  vec3 ec = vec3(0.78, 1.0, 0.9);
  if (aE > -0.5) { int k = int(aE + 0.5); lk = lum(k); p.z += uF[k] * uFwdA; ec = uCol[k]; }
  float lit = smoothstep(-0.02, 0.18, d);
  float grow = smoothstep(uGrow + 0.004, uGrow - 0.025, h), front = uGrowing * exp(-pow((uGrow - h) / 0.03, 2.0));
  float comet = aE < -0.5 ? exp(-d * d / 0.003) : 0.35 * exp(-d * d / 0.012);
  vC = mix(vec3(0.38, 0.64, 0.92), ec, lit) + vec3(0.55, 0.85, 1.0) * (comet + front);
  vA = (mix(0.36, aE < -0.5 ? 0.95 : 0.75, lit) + 0.6 * comet + 0.7 * front) * grow * uMT * uA * lk;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(vC, vA); }`)), 2); }

  // the pulse's head: a comet of glowing points along the kept tree
  { const KB_ = BRANCHES.filter(kept), CPN = 40;
    const [g, A] = geo(KB_.length * CPN, [['aUU', 2], ['aHH', 2], ['aII', 2], ['aS', 1], ['aTm', 1]]);
    let v = 0; for (const b of KB_) { const B = bInfo(b); for (let q = 0; q < CPN; q++) putB(A, v++, B, (q + 0.5) / CPN); }
    add(new THREE.Points(g, mat(HEAD + `
attribute vec2 aUU, aHH, aII; attribute float aS, aTm;
varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(branchP(aUU, aHH, aII, aS), 1.0);
  gl_Position = projectionMatrix * mv;
  float d = uP - aTm, a = d > 0.0 ? exp(-d / 0.09) : exp(-d * d / 0.0005);
  float h = mix(aHH.x, aHH.y, aS);
  gl_PointSize = pointPx(0.03 * (0.35 + 0.65 * a), mv);
  vC = mix(vec3(0.45, 0.85, 1.0), vec3(1.0), a * 0.6);
  vA = a * 0.9 * smoothstep(uGrow + 0.004, uGrow - 0.025, h) * uMT * uA;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float a = max(smoothstep(0.5, 0.15, d) * 0.9, pow(1.0 - 2.0 * d, 1.5) * 0.6); gl_FragColor = vec4(vC, vA * a); }`)), 6); }

  // the tests' verdicts: a green check in a ring where a split is kept, a small dim cross where it is refused
  const GLY = CUTN.map(n => [n, 0]).concat(Array.from(EROOT).filter(n => n >= N).map(n => [n, 1]));
  { const [g, A] = geo(GLY.length, [['aNode', 3], ['aKind', 1], ['aTm', 1]]);
    GLY.forEach(([n, kind], v) => { A.aNode.set([NU[n], NH[n], CI[n]], 3 * v); A.aKind[v] = kind; A.aTm[v] = TAUN[n]; });
    add(new THREE.Points(g, mat(HEAD + `
attribute vec3 aNode; attribute float aKind, aTm;
varying vec3 vC; varying float vA, vKind, vAge, vPx;
void main() {
  vec4 mv = modelViewMatrix * vec4(treeP(aNode.y, nodeY(aNode.x, aNode.z)), 1.0);
  gl_Position = projectionMatrix * mv;
  float age = uP - aTm, on = smoothstep(0.0, 0.07, age), pop = 1.0 + 0.8 * exp(-max(age, 0.0) * 5.0) * on;
  gl_PointSize = pointPx((aKind < 0.5 ? 0.085 : 0.05) * pop, mv); vPx = 1.0 / gl_PointSize;
  vKind = aKind; vAge = max(age, 0.0);
  vC = aKind < 0.5 ? vec3(0.28, 0.95, 0.6) : vec3(1.0, 0.42, 0.36);
  vA = on * (aKind < 0.5 ? 1.0 : 0.62 - 0.22 * smoothstep(0.0, 0.8, age)) * smoothstep(uGrow + 0.004, uGrow - 0.025, aNode.y) * uMT * uA;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA, vKind, vAge, vPx;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 q = gl_PointCoord - 0.5; q.y = -q.y;
  float aa = max(vPx, 0.01), r = length(q), a;
  if (vKind < 0.5) {
    float d = min(seg(q, vec2(-0.15, 0.01), vec2(-0.04, -0.1)), seg(q, vec2(-0.04, -0.1), vec2(0.16, 0.13)));
    float ck = 1.0 - smoothstep(0.04, 0.04 + aa, d), rg = 1.0 - smoothstep(0.024, 0.024 + aa, abs(r - 0.29));
    float wave = (1.0 - smoothstep(0.02, 0.02 + aa, abs(r - 0.29 - 0.2 * clamp(vAge * 2.5, 0.0, 1.0)))) * exp(-vAge * 3.5);
    a = max(max(ck, rg * 0.8), max((1.0 - smoothstep(0.27, 0.29, r)) * 0.16, wave * 0.7));
  } else {
    float d = min(seg(q, vec2(-0.2, -0.2), vec2(0.2, 0.2)), seg(q, vec2(-0.2, 0.2), vec2(0.2, -0.2)));
    a = 1.0 - smoothstep(0.055, 0.055 + aa, d);
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(vC, vA * a);
}`)), 7); }

  // ---------------------------------------------------------------- the genes: dots at their rows, at their tree-distance
  // spots, in their bubbles; and the links among each endotype's own genes
  const geneStag = i => ((i * 0.6180339887) % 1) * 0.6 + 0.4 * (i - LO[EROOT[GENE[i]]]) / Math.max(1, MEM[GENE[i]].length);
  const putG = (A, v, i) => {
    A.aRow[v] = i; A.aE[v] = GENE[i]; A.aSeed[v] = SEED[i] ? 1 : 0; A.aTm[v] = TE[GENE[i]] + WD; A.aStag[v] = geneStag(i);
    for (let c = 0; c < 3; c++) { A.aMds[3 * v + c] = MDS[3 * i + c]; A.aLoc[3 * v + c] = LOC[3 * i + c]; }
  };
  const GATTR = [['aRow', 1], ['aE', 1], ['aSeed', 1], ['aStag', 1], ['aTm', 1], ['aMds', 3], ['aLoc', 3]];
  { const [g, A] = geo(N, GATTR);
    for (let i = 0; i < N; i++) putG(A, i, i);
    add(new THREE.Points(g, mat(HEAD + GENE_GLSL + `
varying vec3 vC; varying float vA, vSeed;
void main() {
  int k = int(aE + 0.5); float e1, e2;
  vec4 mv = modelViewMatrix * vec4(geneP(e1, e2), 1.0);
  gl_Position = projectionMatrix * mv;
  float out_ = max(e1, e2), lit = max(smoothstep(aTm - 0.05, aTm + 0.2, uP), out_);
  gl_PointSize = pointPx(mix(0.0095, mix(0.032, 0.024, e2), out_) * (1.0 + 0.4 * aSeed * out_) * (1.0 + 0.25 * uF[k]), mv);
  vC = mix(vec3(0.5, 0.86, 1.0), uCol[k], lit); vSeed = aSeed * out_;
  float shown = max(clamp(uScan - aRow, 0.0, 1.0) * uMT, smoothstep(0.0, 0.3, out_));
  vA = shown * lum(k) * uA;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA, vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float a = max(smoothstep(0.5, 0.2, d) * 0.88, pow(1.0 - d * 2.0, 1.6) * 0.6);
  vec3 col = mix(vC, vec3(1.0), smoothstep(0.24, 0.0, d) * (0.3 + 0.45 * vSeed));
  a = max(a, vSeed * (1.0 - smoothstep(0.035, 0.08, abs(d - 0.42))));
  gl_FragColor = vec4(col, vA * a);
}`)), 8); }
  { const nL = WL.length / 2, [g, A] = geo(2 * nL, GATTR);
    for (let v = 0; v < WL.length; v++) putG(A, v, WL[v]);
    add(new THREE.LineSegments(g, mat(HEAD + GENE_GLSL + `
varying vec3 vC; varying float vA;
void main() {
  int k = int(aE + 0.5); float e1, e2;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(geneP(e1, e2), 1.0);
  vC = mix(uCol[k], vec3(1.0), 0.25); vA = uLinkA * e2 * 0.42 * lum(k) * uA;
}`, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(vC, vA); }`)), 5); }

  // ---------------------------------------------------------------- the bubbles and the grey bands between them
  { const sph = new THREE.SphereGeometry(1, 32, 22), sp = sph.attributes.position.array, si = sph.index.array, nv = sp.length / 3;
    const ix = []; for (let e = 0; e < NE; e++) for (let q = 0; q < si.length; q++) ix.push(si[q] + e * nv);
    const [g, A] = geo(nv * NE, [['aE', 1], ['aL', 1]], ix);
    for (let e = 0; e < NE; e++) { A.position.set(sp, 3 * nv * e); A.aE.fill(e, nv * e, nv * (e + 1)); A.aL.fill(LOOSE[e] ? 0.4 : 1, nv * e, nv * (e + 1)); }
    sph.dispose();
    add(new THREE.Mesh(g, mat(HEAD + `
attribute float aE, aL;
varying vec3 vN, vW, vCol; varying float vK;
void main() {
  int k = int(aE + 0.5); vec3 n = normalize(position);
  float wob = 1.0 + 0.035 * sin(3.0 * n.x + 2.0 * n.y + uTime * 0.6 + aE * 1.7) + 0.03 * sin(4.0 * n.z - uTime * 0.45 + aE);
  vec4 w = modelMatrix * vec4(bubC(k) + n * bubR(k) * mix(0.55, 1.0, uBub) * wob, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * n); vCol = uCol[k]; vK = lum(k) * uBub * aL;
  gl_Position = projectionMatrix * viewMatrix * w;
}`, `
uniform float uA; varying vec3 vN, vW, vCol; varying float vK;
void main() {
  float r = pow(1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW))), 2.2);
  gl_FragColor = vec4(vCol * (0.5 + 0.75 * r), (0.035 + 0.5 * r) * vK * uA);
}`, { side: THREE.DoubleSide })), 4); }
  const BANDS = []; for (let a = 0; a < NE; a++) for (let b = a + 1; b < NE; b++) if (BT[a * NE + b] > 0) BANDS.push([a, b, BT[a * NE + b]]);
  { const TUB = 26, RAD = 6, per = (TUB + 1) * RAD, ix = [];
    BANDS.forEach((B, j) => { for (let s = 0; s < TUB; s++) for (let r = 0; r < RAD; r++) {
      const a = j * per + s * RAD + r, b = j * per + s * RAD + (r + 1) % RAD; ix.push(a, a + RAD, b, b, a + RAD, b + RAD); } });
    const [g, A] = geo(Math.max(1, BANDS.length * per), [['aS', 1], ['aTh', 1], ['aPair', 2], ['aW', 1]], ix);
    BANDS.forEach(([a, b, n], j) => { for (let s = 0; s <= TUB; s++) for (let r = 0; r < RAD; r++) {
      const v = j * per + s * RAD + r; A.aS[v] = s / TUB; A.aTh[v] = r / RAD * TAU; A.aPair[2 * v] = a; A.aPair[2 * v + 1] = b;
      A.aW[v] = (0.0015 + 0.00056 * n) * (LOOSE[a] || LOOSE[b] ? 0.8 : 1); } });
    add(new THREE.Mesh(g, mat(HEAD + `
attribute float aS, aTh, aW; attribute vec2 aPair;
varying vec3 vN, vW; varying float vK, vHi;
void main() {
  int a = int(aPair.x + 0.5), b = int(aPair.y + 0.5);
  vec3 cA = bubC(a), cB = bubC(b), ctl = mix(0.5 * (cA + cB), RC, 0.5);
  float L = max(length(cB - cA), 1e-3), s0 = clamp(bubR(a) * 0.9 / L, 0.0, 0.45), s1 = 1.0 - clamp(bubR(b) * 0.9 / L, 0.0, 0.45);
  float s = mix(s0, s1, aS), t = 1.0 - s;
  vec3 P = t * t * cA + 2.0 * t * s * ctl + s * s * cB, T = normalize(2.0 * t * (ctl - cA) + 2.0 * s * (cB - ctl) + 1e-5);
  vec3 Nn = cross(T, vec3(0.0, 0.0, 1.0)); Nn = length(Nn) < 0.1 ? normalize(cross(T, vec3(0.0, 1.0, 0.0))) : normalize(Nn);
  vec3 Bn = cross(T, Nn), n = cos(aTh) * Nn + sin(aTh) * Bn;
  float hide = smoothstep(uBandA * 0.52 - 0.04, uBandA * 0.52, min(aS, 1.0 - aS));   // they grow in from both ends
  vec4 w = modelMatrix * vec4(P + n * aW * mix(0.4, 1.0, uBandA), 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * n);
  vHi = max(uF[a], uF[b]); vK = uBandA * (1.0 - uDim * 0.75 * (1.0 - vHi)) * (1.0 - hide);
  gl_Position = projectionMatrix * viewMatrix * w;
}`, `
uniform float uA; varying vec3 vN, vW; varying float vK, vHi;
void main() {
  float r = pow(1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW))), 1.5);
  vec3 col = mix(vec3(0.6, 0.66, 0.76), vec3(0.9, 0.93, 1.0), vHi);
  gl_FragColor = vec4(col, (0.07 + 0.2 * r) * (1.0 + 0.8 * vHi) * vK * uA);
}`, { side: THREE.DoubleSide })), 3); }

  // ---------------------------------------------------------------- CPU mirrors (anchors, views, pick)
  const st = { mat: 1, grow: 1, P: PEND, m1: 0, m2: 0, m1r: 0, m2r: 0, mt: 1, dim: 0, fwdA: 0.04 };
  const GAPV = UNI.uGap.value, CUTY = UNI.uCutY.value, FW = UNI.uF.value;
  const rowY = u => { let y = Y0 - u * RP; for (let j = 0; j < NC; j++) y += GAP * GAPV[j] * (0.5 - (u >= BND[j] ? 1 : 0)); return y; };
  const nodeY = n => (CI[n] >= 0 ? CUTY[CI[n]] : rowY(NU[n]));
  const bubC = (k, o = [0, 0, 0]) => { o[0] = lerp(BC[3 * k], 0, 0.2 * FW[k]); o[1] = lerp(BC[3 * k + 1], RCY, 0.2 * FW[k]); o[2] = BC[3 * k + 2] + 0.34 * FW[k]; return o; };
  const put = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
  const bubR = k => BR[k] * (1 + 0.16 * FW[k]);
  const sm = (a, b, x) => smooth((x - a) / (b - a));
  function genePos(i) {
    const k = GENE[i], s = geneStag(i), e1 = sm(s * 0.35, s * 0.35 + 0.65, st.m1r), e2 = sm(s * 0.3, s * 0.3 + 0.7, st.m2r);
    const p = [lerp(XD, MDS[3 * i], e1), lerp(rowY(i), MDS[3 * i + 1], e1), lerp(0, MDS[3 * i + 2], e1) + 0.22 * Math.sin(PI * e1) + FW[k] * st.fwdA];
    const c = bubC(k), r = bubR(k);
    for (let q = 0; q < 3; q++) p[q] = lerp(p[q], c[q] + LOC[3 * i + q] * r, e2);
    p[2] += 0.16 * Math.sin(PI * e2);
    return p;
  }
  const rowsMid = k => { const r = EROOT[k]; return r >= 0 ? (LO[r] + HI[r]) / 2 : 0; };
  // where endotype k is now: its rows, its cluster, its bubble
  const endoPos = (k, o = [0, 0, 0]) => {
    const fz = FW[k] * st.fwdA, c = MDSC[k], m1 = st.m1, ax = lerp(X0 + 0.12, c[0], m1), ay = lerp(rowY(rowsMid(k)), c[1], m1), az = c[2] * m1 + fz;
    bubC(k, o);
    return put(o, lerp(ax, o[0], st.m2), lerp(ay, o[1], st.m2), lerp(az, o[2], st.m2));
  };

  // ---------------------------------------------------------------- the focus: an endotype id from the param or the
  // explore panel, cross-faded over 0.6 s whenever it changes
  let ovr = null, fCur = -1, fPrev = -1, tCh = -1e9, lastT = 0;
  function update(S, t) {
    const mat_ = clamp(S.tree_matrix, 0, 1), grow = clamp(S.tree_tree, 0, 1), test = clamp(S.tree_test, 0, 1);
    const m1r = clamp(S.tree_mds, 0, 1), m2r = clamp(S.tree_meta, 0, 1), m1 = smooth(m1r), m2 = smooth(m2r);
    const mt = 1 - prog(Math.max(m1r, m2r), 0, 0.55), P = lerp(P0, PEND, test);
    U('uScan', mat_ * (N + 8) - 4); U('uScanA', prog(mat_, 0, 0.02) * (1 - prog(mat_, 0.95, 1))); U('uGridA', prog(mat_, 0, 0.06));
    U('uGrow', grow * 1.12); U('uGrowing', clamp(grow * (1 - grow) * 6, 0, 1)); U('uP', P); U('uMT', mt);
    U('uM1', m1r); U('uM2', m2r); U('uBub', prog(m2r, 0.3, 0.85)); U('uLinkA', prog(m2r, 0.55, 1)); U('uBandA', prog(m2r, 0.45, 0.95));
    for (let j = 0; j < CUTN.length; j++) GAPV[j] = smooth((P - TAUN[CUTN[j]]) / 0.7);
    for (let j = 0; j < CUTN.length; j++) CUTY[j] = (nodeY(CKA[j]) + nodeY(CKB[j])) / 2;
    // the focus
    // only a clock that runs smoothly cross-fades; a paused story, a seek or the first frame show the focus at once
    const adv = t - lastT, running = adv > 0 && adv < 0.25;
    if (t < lastT - 0.5 || t < tCh) tCh = -1e9;
    lastT = t;
    const want = ovr !== null ? ovr : clamp(Math.round(S.tree_focus || 0), 0, NE) - 1;
    if (want !== fCur) { fPrev = fCur; fCur = want; tCh = running ? t : -1e9; }
    const X = smooth(clamp((t - tCh) / 0.6, 0, 1));
    FW.fill(0); if (fCur >= 0) FW[fCur] += X; if (fPrev >= 0 && fPrev !== fCur) FW[fPrev] += 1 - X;
    const dim = (fCur >= 0 ? X : 0) + (fPrev >= 0 && fPrev !== fCur ? 1 - X : 0);
    const fwdA = lerp(lerp(0.04, 0.16, m1), 0.16, m2);
    U('uDim', dim); U('uFwdA', fwdA);
    st.mat = mat_; st.grow = grow; st.P = P; st.m1 = m1; st.m2 = m2; st.m1r = m1r; st.m2r = m2r; st.mt = mt; st.dim = dim; st.fwdA = fwdA;
  }
  const U = (k, v) => { UNI[k].value = v; };

  // ---------------------------------------------------------------- explore API
  const _m = new THREE.Matrix4(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
  const setV = (v, a) => (Array.isArray(a) ? v.set(a[0], a[1], a[2]) : v.copy(a));
  const rowAt = y => {   // the row nearest to height y (rows fall with u), or -1 in a gap
    let lo = 0, hi = N - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (rowY(m) > y) lo = m + 1; else hi = m; }
    let best = lo; if (lo > 0 && Math.abs(rowY(lo - 1) - y) < Math.abs(rowY(lo) - y)) best = lo - 1;
    return Math.abs(rowY(best) - y) < RP * 1.5 ? best : -1;
  };
  function pick(a, b) {
    if (a && a.ray) { _m.copy(set.group.matrixWorld).invert(); _o.copy(a.ray.origin).applyMatrix4(_m); _d.copy(a.ray.direction).transformDirection(_m); }
    else if (a && b) { setV(_o, a); setV(_d, b); _d.normalize(); }
    else return null;
    const o = [_o.x, _o.y, _o.z], d = [_d.x, _d.y, _d.z];
    if (st.m1 > 0.5 || st.m2 > 0.5) {
      // a gene dot near the ray, else (endotype network) a bubble it passes through, else (distances) a cluster
      let best = -1, bs = 1e9;
      for (let i = 0; i < N; i++) {
        if (FW[GENE[i]] < 0.5 && st.dim > 0.5) continue;
        const p = genePos(i), wx = p[0] - o[0], wy = p[1] - o[1], wz = p[2] - o[2], tt = wx * d[0] + wy * d[1] + wz * d[2];
        if (tt <= 0) continue;
        const perp = Math.hypot(wx - d[0] * tt, wy - d[1] * tt, wz - d[2] * tt), tol = (0.004 + 0.0028 * tt) * (st.m2 > 0.5 ? 1 : 1.4);
        if (perp < tol && perp / tol + tt * 0.05 < bs) { bs = perp / tol + tt * 0.05; best = i; }
      }
      if (best >= 0) return { gene: best };
      let be = -1, bt = 1e9;
      for (let k = 0; k < NE; k++) {
        const c = st.m2 > 0.5 ? bubC(k) : endoPos(k), r = st.m2 > 0.5 ? bubR(k) : Math.max(0.05, MDSR[k] * 1.1);
        const wx = c[0] - o[0], wy = c[1] - o[1], wz = c[2] - o[2], tt = wx * d[0] + wy * d[1] + wz * d[2];
        const q = wx * wx + wy * wy + wz * wz - tt * tt;
        if (q > r * r) continue;
        const hit = tt - Math.sqrt(r * r - q);
        if (hit > 0 && hit < bt) { bt = hit; be = k; }
      }
      return be >= 0 ? { endo: be } : null;
    }
    if (st.mt < 0.3 || Math.abs(d[2]) < 1e-4) return null;
    // the matrix and the leaves lie in z = 0; the tree curves towards you, so find its surface by a few steps
    let tt = -o[2] / d[2], x = o[0] + d[0] * tt, y = o[1] + d[1] * tt;
    if (tt > 0 && x >= XL - 0.004 && x <= X1 + 0.01) { const r = rowAt(y); return r >= 0 && r < (st.mat * (N + 8) - 4) ? { gene: r } : null; }
    let h = 0;
    for (let k = 0; k < 4; k++) { h = clamp((XL - x) / WT, 0, 1.1); tt = (ZT * h * h - o[2]) / d[2]; x = o[0] + d[0] * tt; y = o[1] + d[1] * tt; }
    h = (XL - x) / WT;
    if (tt <= 0 || h < 0 || h > 0.58 || h > st.grow * 1.12) return null;
    const r = rowAt(y);
    return r >= 0 ? { endo: GENE[r] } : null;
  }
  function setFocus(id) { ovr = id === null || id === undefined || id < 0 || id >= NE ? null : id | 0; }
  const API = {
    setFocus, pick, focus: () => fCur, genePos, endoPos,
    genes: N, terms: NT, order: ORDER.slice(), cells: NCELL, kept: CUTN.length, endoRoots: Array.from(EROOT),
    testTimes: { kept: CUTN.map(n => (TAUN[n] - P0) / (PEND - P0)), refused: TE.map(x => (x - P0) / (PEND - P0)) },
    bands: BANDS.map(b => b.slice()), own: Array.from(OWN), loose: LOOSE.slice(), name: i => NAME[i],
    bubble: k => ({ c: bubC(k), r: bubR(k), base: [BC[3 * k], BC[3 * k + 1], BC[3 * k + 2]], r0: BR[k], below: !!LBELOW[k] }),
  };

  // ---------------------------------------------------------------- anchors, labels, views, controls
  // anchors the labels read every frame fill arrays of their own (no garbage per frame)
  const AR = Array.from({ length: 6 + 2 * NE }, () => [0, 0, 0]);
  const root = () => put(AR[0], XL - WT * NH[ROOT], nodeY(ROOT), ZT * NH[ROOT] * NH[ROOT]);
  // the first refusal (for its label): the endotype whose root the pulse reaches first
  const REF = EROOT.reduce((b, n, e) => (n >= N && (b < 0 || TE[e] < TE[b]) ? e : b), -1), TREF = REF >= 0 ? TE[REF] : 0;
  const anchors = {
    matrix: [X0 + MW / 2, 0, 0], matrixTop: () => put(AR[1], X0 + MW / 2 - 0.2, rowY(0) + 0.07, 0),
    tree: [XL - WT * 0.5, 0, ZT * 0.25], treeTop: () => put(AR[2], XL - WT * 0.62, rowY(0) + 0.07, ZT * 0.38),
    root, kept: root, refused: () => { const n = EROOT[Math.max(REF, 0)]; return put(AR[3], XL - WT * NH[n], nodeY(n), ZT * NH[n] * NH[n]); },
    scan: () => [XD, rowY(clamp(st.mat * (N + 8) - 4, 0, N - 1)), 0],
    mds: [0, 0, 0], mdsTop: [0, Math.max(...MDSC.map((c, k) => c[1] + MDSR[k])) + 0.06, 0],
    meta: [0, RCY, 0], metaLow: [-0.06, META_LOW - 0.1, 0],
    focus: () => (fCur >= 0 ? endoPos(fCur, AR[4]) : st.m2 > 0.5 ? put(AR[4], 0, RCY, 0) : st.m1 > 0.5 ? put(AR[4], 0, 0, 0) : put(AR[4], -0.05, 0, 0.05)),
  };
  EN.forEach((e, k) => { anchors['e' + k] = () => endoPos(k, AR[6 + NE + k]); });
  const labels = [
    { text: [`${N} genes`, `× ${NT} terms`], cls: 'cyn', at: 'matrixTop', alpha: S => prog(S.tree_matrix, 0.02, 0.15) * st.mt },
    { text: ['Tree of genes', ''], cls: '', at: 'treeTop', alpha: S => prog(S.tree_tree, 0.35, 0.8) * st.mt },
    { text: ['Split kept', '· the two sides differ'], cls: 'grn', at: 'kept',
      alpha: S => sm(P0 + 0.5, P0 + 0.9, st.P) * (1 - prog(S.tree_test, 0.8, 0.95)) * st.mt },
    { text: ['Split refused', '· too alike'], cls: 'amb', at: 'refused',
      alpha: S => (REF >= 0 ? sm(TREF, TREF + 0.3, st.P) : 0) * (1 - prog(S.tree_test, 0.8, 0.95)) * st.mt },
    { text: ['Tree distances', '· near in the tree, near here'], cls: 'cyn', at: 'mdsTop', alpha: S => prog(S.tree_mds, 0.7, 1) * (1 - prog(S.tree_meta, 0, 0.3)) },
    { text: [`${NE} endotypes`, ''], cls: 'mag', at: 'metaLow', alpha: S => prog(S.tree_meta, 0.75, 1) },
  ];
  EN.forEach((e, k) => labels.push({ text: [String(e.id), '· ' + e.name], cls: '',
    at: () => { const c = bubC(k, AR[6 + k]); c[1] += LBELOW[k] ? -bubR(k) - 0.045 : bubR(k) + 0.03; return c; },
    alpha: S => prog(S.tree_meta, 0.85, 1) * (1 - st.dim * 0.6 * (1 - FW[k])) }));
  const camE = k => { const c = [lerp(BC[3 * k], 0, 0.2), lerp(BC[3 * k + 1], RCY, 0.2), BC[3 * k + 2] + 0.34], r = BR[k] * 1.16;
    return [clamp(c[0] * 14, -16, 16), clamp(6 + c[1] * 6, -4, 14), 1.25 + r * 4.2, c[0], c[1], c[2]]; };
  const cam = {
    default: [14, 8, 4.4, -0.05, 0, 0.05],
    matrix: [6, 4, 2.6, X0 + MW / 2, 0, 0],
    tree: [30, 6, 3.0, XL - WT * 0.4, 0, ZT * 0.2],
    mds: [22, 14, 3.5, 0, 0, 0],
    meta: [0, 5, 4.3, 0, (META_TOP + META_LOW) / 2, 0],
  };
  Object.defineProperty(cam, 'focus', { enumerable: true, get: () => {
    if (fCur < 0) return (st.m2 > 0.5 ? cam.meta : st.m1 > 0.5 ? cam.mds : cam.default).slice();
    if (st.m2 > 0.5) return camE(fCur);
    const p = endoPos(fCur); return st.m1 > 0.5 ? [22, 12, 1.5, p[0], p[1], p[2]] : [10, 4, 1.7, X0 + 0.45, p[1], p[2]];
  } });
  EN.forEach((e, k) => { cam['e' + k] = camE(k); });
  const params = { tree_a: 1, tree_matrix: 1, tree_tree: 1, tree_test: 1, tree_mds: 0, tree_meta: 0, tree_focus: 0 };
  const controls = [{ key: 'view', label: 'View', options: [['matrix', 'Matrix'], ['tree', 'Tree'], ['dist', 'Distances'], ['endo', 'Endotypes']] }];
  function explore(c) {
    const o = Object.assign({}, params), t = c.t || 0;
    delete o.tree_a;
    if (c.view === 'matrix') { o.tree_tree = 0; o.tree_test = 0; }
    if (c.view === 'tree') o.tree_test = clamp((t - 0.8) / 9, 0, 1);   // the tests replay each time the view opens
    if (c.view === 'dist') o.tree_mds = 1;
    if (c.view === 'endo') o.tree_meta = 1;
    return o;
  }

  update(params, 0);
  return Object.assign(set, { params, update, anchors, labels, cam, controls, explore, api: () => API });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['motor', 'syn', 'net', 'tree'];
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
  [0, 0], [310, 310],
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
  { key: 'title', name: 'Intro', a: 0, b: 14 },
  { key: 'tired', name: 'Tired', a: 14, b: 40 },
  { key: 'genes', name: 'Genes', a: 40, b: 70 },
  { key: 'cloud', name: 'Network', a: 70, b: 108 },
  { key: 'walk', name: 'Walk', a: 108, b: 148 },
  { key: 'hood', name: 'Neighbours', a: 148, b: 185 },
  { key: 'split', name: 'Tree', a: 185, b: 225 },
  { key: 'endotypes', name: 'Endotypes', a: 225, b: 285 },
  { key: 'next', name: 'What for', a: 285, b: 310 },
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
// The analysis data (ENDO_DATA), decoded once for the story and the panels (each set decodes its own copy for
// drawing). Module genes are the first ED.M nodes, in tree order, so each endotype is a run of indices.
const ED = (() => {
  const D = ENDO_DATA, b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const u16 = s => { const b = b64(s); return new Uint16Array(b.buffer, 0, b.length >> 1); };
  const M = D.mod, names = D.names.split('|'), S = D.seeds.length;
  const gene = b64(D.gene), seedOf = b64(D.seedOf), featN = u16(D.featN), featI = u16(D.featI), links = u16(D.links), g = b64(D.groups.g);
  const nb = Array.from({ length: M }, () => []);
  for (let k = 0; k < D.modLinks; k++) { const a = links[2 * k], b = links[2 * k + 1]; if (a < M && b < M) { nb[a].push(b); nb[b].push(a); } }
  let o = 0;
  const genes = names.slice(0, M).map((sym, i) => {
    const terms = Array.from(featI.subarray(o, o + featN[i])); o += featN[i];
    return { sym, endo: gene[i], seed: seedOf[i] - 1, terms, nb: nb[i] };
  });
  const bySym = new Map(genes.map((x, i) => [x.sym.toUpperCase(), i]));
  // the seeds' groups at each neighbourhood size k: each seed's group (0 the largest) and how many groups there are
  const groups = D.groups.k.map((k, j) => { const of = Array.from(g.subarray(j * S, j * S + S)); return { k, of, n: new Set(of).size }; });
  const members = D.endo.map(e => genes.map((x, i) => i).filter(i => gene[i] === e.id));
  // a gene's neighbourhood (node indices of the whole network), decoded when asked for
  let hood = null;
  const hoodOf = i => { hood = hood || u16(D.hood); return hood.subarray(i * D.facts.hood, (i + 1) * D.facts.hood); };
  const cut = b64(D.tree.cut);
  return { D, M, genes, bySym, groups, members, hoodOf, cut, endo: D.endo, seeds: D.seeds, terms: D.terms };
})();
const geneIdx = s => { const i = ED.bySym.get(String(s || '').trim().toUpperCase()); return i === undefined ? -1 : i; };
// where each seed gene acts in the junction (UniProt; see tools/endo/SPEC.md), for the story's count by region
const SEED_SITE = {
  nerve: ['CHAT', 'SLC5A7', 'SLC18A3', 'SYT2', 'VAMP1', 'SNAP25', 'UNC13A', 'RPH3A', 'PREPL', 'MYO9A', 'SLC25A1'],
  cleft: ['COLQ', 'AGRN', 'LAMB2', 'LAMA5', 'COL13A1'],
  membrane: ['CHRNA1', 'CHRNB1', 'CHRND', 'CHRNE', 'CHRNG', 'RAPSN', 'LRP4', 'MUSK', 'DOK7', 'SCN4A'],
  fibre: ['DPAGT1', 'ALG2', 'ALG14', 'GFPT1', 'GMPPB', 'PLEC', 'DES', 'TOR1AIP1', 'CHD8'],
};
// what an endotype's place in the synapse is called
const PLACE = { mito: 'the nerve ending\'s mitochondria', lamina: 'the basement membrane in the gap', golgi: 'the Golgi of the muscle fibre',
  channels: 'the ion channels of the muscle membrane', er: 'the muscle fibre\'s endoplasmic reticulum', endosome: 'the nerve ending\'s endosomes',
  vesicles: 'the nerve ending\'s synaptic vesicles', scaffold: 'the muscle fibre\'s scaffold', junction: 'the junction as a whole' };
const STRONG = ['nothing shared', 'weak', 'clear'];

// ------------------------------------------------------------------ facts --
// Numbers the story quotes, counted from the analysis data (ENDO_DATA) when the story loads
const FACTS = (() => {
  const D = ENDO_DATA, F = D.facts, seedSet = new Set(D.seeds.map(s => s[0]));
  const at = k => ED.groups.find(x => x.k === k) || { n: 0 };
  const one = ED.groups.find(x => x.n === 1);
  // seeds that already share a neighbourhood at the smallest k
  const g0 = ED.groups[0], first = D.seeds.filter((s, j) => g0.of[j] === 0 && g0.of.filter(x => x === 0).length > 1).map(s => s[0]);
  const sites = Object.fromEntries(Object.entries(SEED_SITE).map(([k, l]) => [k, l.filter(s => seedSet.has(s)).length]));
  return Object.assign({}, F, {
    ones: ED.genes.reduce((a, x) => a + x.terms.length, 0), modLinks: D.modLinks, merges: D.mod - 1,
    cuts: ED.cut.reduce((a, x) => a + x, 0), groupsAt: k => at(k).n, oneK: one ? one.k : null, firstShare: first, sites,
    clear: D.endo.filter(e => e.strong === 2).length, weak: D.endo.filter(e => e.strong === 1).length, none: D.endo.filter(e => e.strong === 0).length,
    noPlace: D.endo.filter(e => !e.place).map(e => e.id), tenths: Math.round(F.r * 10),
  });
})();
// ' · '-joined symbols of those genes that are in endotype id (so the text only names what the data has)
const inEndo = (id, syms) => syms.filter(s => { const i = geneIdx(s); return i >= 0 && ED.genes[i].endo === id; });
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const endoCol = id => (ED.endo[id] ? ED.endo[id].col : '#9aa3b5');

// the story's gene for the neighbourhoods: COLQ (in the basement membrane endotype)
const STORY_GENE = 'COLQ';
function buildStory() {
  const F = FACTS, E = ED.endo;
  const gi = geneIdx(STORY_GENE), gsym = gi >= 0 ? ED.genes[gi].sym : STORY_GENE;
  const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);
  const Word = n => { const w = word(n); return w.charAt(0).toUpperCase() + w.slice(1); };
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // jump an index param (a site, a gene, an endotype) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  const kAt = k => Math.max(0, ED.groups.findIndex(x => x.k === k));   // net_k for a neighbourhood size
  const ks = [1, 10, 20, 50].filter(k => ED.groups.some(x => x.k === k));
  // the poster's four endotypes, in the order the story tells them
  const four = [1, 9, 5, 2].filter(id => E[id]);
  // one endotype's point, in its colour; they take turns in one place (a grid cell), each fading out as the next comes
  const step = (id, at, out, text) => `<ul class="steps" data-at="${at}"${out ? ` data-out="${out}"` : ''} style="grid-area:1/1"><li style="border-left-color:${endoCol(id)}"><b style="color:${endoCol(id)}">${id} · ${esc(E[id].name)}</b>${text}</li></ul>`;
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Endotypes</h1>
      <p class="lede" data-at="2.4">one disease, many mechanisms</p>
      <p data-at="4">${F.seeds} genes cause a group of rare diseases of the junction between nerve and muscle. How many mechanisms hide behind them?</p>
      <p class="note" data-at="9">A story of congenital myasthenic syndromes, and of EndotypY, a Python package that finds the endotypes of a disease in a network of proteins.</p>`,
    tired: `<h2 data-at="0.6">Muscles that tire</h2>
      <p data-at="1.2">Every movement starts with a nerve cell telling muscle fibres to contract. Each fibre meets the nerve at one point: the neuromuscular junction.</p>
      <p data-at="10">Up close, the nerve ending releases acetylcholine. It crosses a narrow gap and opens receptors on the muscle, and the fibre twitches.</p>
      <p data-at="17" class="amber">In congenital myasthenic syndromes (CMS) the signal runs down: muscles tire as they work, and weakness grows with effort.</p>
      <p data-at="22">CMS are rare and inherited, most often from both parents. Some patients only tire with exercise; others struggle to walk, or to breathe.</p>`,
    genes: `<h2 data-at="0.6">${F.seeds} genes, one junction</h2>
      <p data-at="1.2">The Gene Table of Neuromuscular Disorders lists ${F.seeds} genes for CMS. Each works somewhere in the junction.</p>
      <ul class="steps">
        <li data-at="6"><b>Nerve ending · ${F.sites.nerve}</b>making, loading and releasing acetylcholine</li>
        <li data-at="11"><b>The gap · ${F.sites.cleft}</b>the basement membrane that holds it together</li>
        <li data-at="15"><b>Muscle membrane · ${F.sites.membrane}</b>the receptor, the proteins that cluster it, sodium channels</li>
        <li data-at="20"><b>Inside the fibre · ${F.sites.fibre}</b>sugar chains for receptors, the scaffold, the nuclei</li>
      </ul>
      <p data-at="25" class="amber">Yet one mutation can be mild in one patient and severe in another. Genes alone do not explain the range; other genes in their networks are thought to shape it.</p>
      <p class="credits" data-at="27">Gene Table of Neuromuscular Disorders; places after UniProt (the junction is illustrative). Severity: Núñez-Carpintero et al., Nature Communications (2024).</p>`,
    cloud: `<h2 data-at="0.6">${fmt(F.genes)} proteins</h2>
      <div style="display:grid">
        <p data-at="1.2" data-out="8.5" style="grid-area:1/1">Proteins that interact make a network: ${fmt(F.genes)} proteins, ${fmt(F.links)} links. The ${F.seeds} CMS genes are its seeds.</p>
        <p data-at="9" class="amber" style="grid-area:1/1">Do the seeds share mechanisms? Endotypes are subtypes of a disease defined by its molecules: groups of disease genes that hang together, in the network and in what they do.</p>
      </div>
      <p data-at="17">First, one group or several? Give each seed a neighbourhood of its k closest proteins. Seeds whose neighbourhoods meet form a group.</p>
      <div class="facts">${ks.map((k, j) => `<div data-at="${[19, 23, 25, 28][j]}"><b>${F.groupsAt(k)}</b><small>${F.groupsAt(k) === 1 ? 'group' : 'groups'} at k = ${k}</small></div>`).join('')}</div>
      <p data-at="31" class="amber">${F.oneK ? `From k = ${F.oneK} on, all ${F.seeds} seeds share one neighbourhood: one module, which the next steps split.` : 'The seeds stay in several groups.'}</p>
      <p class="credits" data-at="33">Step 1 of EndotypY (optional): seed groups.${F.firstShare.length ? ` Even at k = 1, ${listOf(F.firstShare)} share one.` : ''} The protein network is the one the authors used.</p>`,
    walk: `<h2 data-at="0.6">A walker that keeps coming home</h2>
      <p data-at="1.2">To find the rest of the module, EndotypY sends random walkers out from the seeds. At every step a walker hops to a random neighbour, or, ${word(F.tenths)} times in ten, jumps back to a seed.</p>
      <p data-at="11">Proteins the walkers visit again and again are close to the seeds, by many paths at once.</p>
      <p data-at="22" class="amber">The most visited join the seeds, one by one, until the module holds together. In the authors' run:</p>
      <div class="facts"><div data-at="26"><b>${F.seeds}</b><small>seeds</small></div><div data-at="27.5"><b>+ ${F.found}</b><small>found by the walk</small></div><div data-at="29"><b>${F.module}</b><small>genes in the module</small></div></div>
      <p class="credits" data-at="32">Step 2 of EndotypY: network expansion by random walk with restart (restart probability ${F.r}, the package's default). The walkers and their heat are a re-run with the package's defaults; the module is the authors'.</p>`,
    hood: `<h2 data-at="0.6">Every gene's neighbourhood</h2>
      <p data-at="1.2">What does each gene do? Its neighbours tell more than the gene alone. Take ${esc(gsym)}, which anchors acetylcholinesterase in the gap: a walk from ${esc(gsym)} alone marks its neighbourhood, the top ${F.pct}% of the network (${F.hood} proteins).</p>
      <p data-at="11">The parts of the cell that come up among them more often than chance (Gene Ontology terms), with ${esc(gsym)}'s own, become ${esc(gsym)}'s row of marks. Every gene gets one.</p>
      <div class="facts"><div data-at="22"><b>${F.module}</b><small>genes</small></div><div data-at="23"><b>${F.terms}</b><small>cell parts</small></div><div data-at="24"><b>${fmt(F.ones)}</b><small>marks</small></div></div>
      <p data-at="28" class="amber">Genes with similar rows sit among similar parts of the cell.</p>
      <p class="credits" data-at="30">Step 3 of EndotypY: functional neighbourhood annotation (gene-set enrichment with GSEApy and Enrichr libraries; here ${esc(F.featLib.replace(/_/g, ' '))}).</p>`,
    split: `<h2 data-at="0.6">A tree that splits only when it must</h2>
      <p data-at="1.2">Genes with similar rows are joined, pair by pair, into a tree.</p>
      <p data-at="8">Where to cut it? Not at a fixed height. Tree2BreakSpace tests every split from the root down: do the two sides use the cell's parts differently? A split stays only when the data say so.</p>
      <p data-at="19" class="amber">Only ${F.cuts} splits are kept: ${F.endotypes} endotypes.</p>
      <p data-at="28">Laid out by their distances in the tree: genes close in the tree land close together.</p>
      <p class="credits" data-at="32">Step 4 of EndotypY: statistically filtered hierarchical clustering (Tree2BreakSpace, Sakalli et al., in progress).</p>`,
    endotypes: `<h2 data-at="0.6">${F.endotypes} endotypes</h2>
      <p data-at="1.2">Each endotype is a group of genes tied together in the network and in what they do: one bubble each, with grey bands for the links between them. In the authors' analysis:</p>
      <div style="display:grid">
        ${E[1] ? step(1, 8, 17.5, `${listOf(inEndo(1, ['SLC25A1']))} exports citrate from the nerve ending's mitochondria; from it comes acetyl-CoA, needed to make acetylcholine.`) : ''}
        ${E[9] ? step(9, 18, 27.5, `forming and releasing synaptic vesicles (${inEndo(9, ['SYT1', 'SYT2', 'SNAP25', 'STX19', 'RPH3A']).join(', ')}). Givinostat, a treatment for Duchenne muscular dystrophy, perturbs several of this endotype's genes: a lead for repurposing, not a treatment for CMS.`) : ''}
        ${E[5] ? step(5, 28, 37.5, `receptor subunits (${inEndo(5, ['CHRNB1', 'CHRND']).join(', ')}) that start the muscle's signal, and sodium channels (${inEndo(5, ['SCN4A', 'SCN8A', 'SCN1B']).join(', ')}) that carry it on.`) : ''}
        ${E[2] ? step(2, 38, 45.5, `the matrix in the gap (${inEndo(2, ['COLQ', 'AGRN', 'LAMB2', 'LAMA5', 'COL13A1']).join(', ')}): it holds the junction together and anchors acetylcholinesterase.`) : ''}
      </div>
      <p data-at="46" class="amber">Back in the junction, the endotypes with a shared place settle at it.</p>
      <p class="note" data-at="52">${Word(F.clear)} endotypes share a clear place in the cell, ${word(F.weak)} a weak one; ${word(F.none)} (${F.noPlace.join(', ')}) share none and hover loose.</p>`,
    next: `<h2 data-at="0.6">What endotypes are for</h2>
      <ul class="steps">
        <li data-at="1.2"><b>Patients</b>grouped by mechanism, not by broad symptoms</li>
        <li data-at="3.5"><b>Drugs</b>pathways to target, and drugs to repurpose</li>
        <li data-at="6"><b>Rare and common</b>the links between rare and common forms of a disease</li>
      </ul>
      <p data-at="9">EndotypY is open source: a Python package you install from github.com/menchelab/EndotypY.</p>
      <p data-at="13">Chloé Bûcheron, Iker Núñez-Carpintero, Enes Sakalli, Mathilde Meyenberg, Julia Guthrie and Jörg Menche: Ludwig Boltzmann Institute for Network Medicine, University of Vienna.</p>
      <p data-at="17"><button class="btn primary" id="btnGoExplore" type="button">Explore the endotypes</button></p>
      <p class="credits" data-at="19">Endotypes: the authors' result. The steps before them: re-run with the package's defaults to show the method. ISMB 2026 poster. Rare and common autoimmunity: Guthrie et al., Science Advances (2023).</p>`,
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
  // Intro: the motor unit builds, its impulses running
  a = C.title.a; b = C.title.b;
  show('motor', 0.2, 2.5);
  ramp('motor_build', 0.5, 8, 0, 1);
  ramp('motor_signal', 5, 7, 0, 1);
  cam(a, 'motor', 'default', -35, null, [0, -4, 0.6]);
  cam(b - 1, 'motor', 'default', 5, 'spin');
  // Muscles that tire: the junctions glow, the camera dives into one, and the junction close up fires, then tires
  a = C.tired.a; b = C.tired.b;
  ramp('motor_groups', a, a + 2, 0, 1);
  jump('motor_site', a + 1, 0, 3);
  // the dive: into one end plate as the motor unit fades out, then the junction close up comes in
  ramp('motor_a', a + 7, a + 8.6, 1, 0);
  cam(a + 1, 'motor', 'default', 10);
  cam(a + 5.5, 'motor', 'junction');
  cam(a + 8.6, 'motor', 'junction', 0, null, [0, 0, -0.28]);
  show('syn', a + 8.6, a + 9.4, C.cloud.a - 0.5, C.cloud.a + 1.5);
  ramp('syn_build', a + 8.7, a + 12, 0, 1);
  ramp('syn_fire', a + 11, a + 12.5, 0, 1);
  ramp('syn_tired', a + 17, a + 22, 0, 1);
  cam(a + 8.7, 'syn', 'wide');
  cam(a + 14, 'syn', 'default');
  cam(b - 0.5, 'syn', 'default', 20, 'spin');
  // The genes: each seed lights where it acts, the camera visiting the nerve ending, the gap, the receptors, the fibre
  a = C.genes.a; b = C.genes.b;
  ramp('syn_tired', a, a + 2, 1, 0);
  ramp('syn_fire', a + 1, a + 3, 1, 0);
  // the gene groups light one after another (nerve ending, gap, muscle membrane, inside) as the camera reaches them
  [[4, 0], [10, 0.3], [13, 0.45], [17, 0.62], [22, 0.86], [24, 1]].forEach(([t, v]) => key('syn_genes', a + t, v));
  cam(a + 2, 'syn', 'default', 10);
  cam(a + 7, 'syn', 'terminal');
  cam(a + 12, 'syn', 'cleft');
  cam(a + 16, 'syn', 'receptors');
  cam(a + 21, 'syn', 'nucleus');
  cam(a + 26, 'syn', 'default', -10);
  cam(b - 1, 'syn', 'default', 15, 'spin');
  ramp('syn_genes', b - 1.5, b + 0.5, 1, 0);
  // The network: the cloud of proteins, the seeds, and their groups as the neighbourhoods grow
  a = C.cloud.a; b = C.cloud.b;
  show('net', a - 0.5, a + 1.5, C.hood.a + 16, C.hood.a + 18);
  ramp('net_cloud', a, a + 6, 0, 1);
  ramp('net_seeds', a + 9, a + 11, 0, 1);
  // k = 1, then the neighbourhoods grow, holding where the text names the number of groups
  // (k = 1 shows its label a little past 0; groups at k = 1 and 2 are the same here)
  [[19, 1], [23, 10], [25, 20], [28, 50], [31, F.oneK || 75]].reduce((k0, [t, k]) => { const v = j => kAt(j) + (j === 1 ? 0.25 : 0); ramp('net_k', a + t - 2, a + t, k0 === null ? 0 : v(k0), v(k)); return k; }, null);
  cam(a + 1.5, 'net', 'default', -30, null, [0, 0, 1.2]);
  cam(a + 8, 'net', 'default', -5, 'spin');
  cam(a + 13, 'net', 'core');
  cam(b - 1, 'net', 'core', 50, 'spin');
  // The walk: walkers with restart, the heat they leave, then the module pulls together
  a = C.walk.a; b = C.walk.b;
  ramp('net_k', a, a + 2, kAt(F.oneK || 75), ED.groups.length - 1);
  ramp('net_walk', a + 2, a + 4, 0, 1); ramp('net_walk', a + 27, a + 29, 1, 0);
  ramp('net_heat', a + 10, a + 20, 0, 1);
  ramp('net_module', a + 23, a + 31, 0, 1);
  cam(a + 1, 'net', 'core', 50);
  cam(a + 21, 'net', 'core', 80, 'spin');
  cam(a + 27, 'net', 'module');
  cam(b - 1, 'net', 'module', 30, 'spin');
  // Neighbourhoods: the module goes back into the cloud, one gene lights its neighbourhood; then the matrix fills
  a = C.hood.a; b = C.hood.b;
  ramp('net_module', a, a + 3, 1, 0);
  ramp('net_heat', a + 1, a + 4, 1, 0);
  ramp('net_seeds', a + 1, a + 4, 1, 0.4);
  if (gi >= 0) { jump('net_gene', a + 2, -1, gi); ramp('net_hood', a + 4, a + 8, 0, 1); }
  cam(a + 1, 'net', 'default', 30);
  // close to the gene, in the cloud (the module back in it), from outside
  const NA = GL.sets.net.api ? GL.sets.net.api() : null, gv = gi >= 0 && NA && NA.geneView ? NA.geneView(gi) : view('net', 'core');
  wp.push([a + 6, ...gv, null, 'net']);
  wp.push([a + 15, gv[0] + 30, ...gv.slice(1), 'spin', 'net']);
  show('tree', a + 16, a + 18, C.endotypes.a + 45, C.endotypes.a + 47);
  ramp('tree_matrix', a + 18, a + 30, 0, 1);
  cam(a + 17.5, 'tree', 'matrix');
  cam(b - 1, 'tree', 'matrix', 15, 'spin');
  // The tree: grown from the leaves, tested from the root, then the genes by their tree distances
  a = C.split.a; b = C.split.b;
  ramp('tree_tree', a + 1, a + 9, 0, 1);
  ramp('tree_test', a + 10, a + 22, 0, 1);
  ramp('tree_mds', a + 28, a + 33, 0, 1);
  cam(a + 1, 'tree', 'tree');
  cam(a + 10, 'tree', 'default');
  cam(a + 22, 'tree', 'default', 15, 'spin');
  cam(a + 29, 'tree', 'mds');
  cam(b - 1, 'tree', 'mds', 40, 'spin');
  // Endotypes: the poster's endotype network, the four endotypes in turn, then each endotype flies to its place
  a = C.endotypes.a; b = C.endotypes.b;
  ramp('tree_mds', a, a + 3, 1, 0);
  ramp('tree_meta', a + 1, a + 5, 0, 1);
  four.reduce((f0, id, j) => { jump('tree_focus', a + 9 + 10 * j - (j === 3 ? 1 : 0), f0, id + 1); return id + 1; }, 0);
  jump('tree_focus', a + 45, four.length ? four[four.length - 1] + 1 : 0, 0);
  cam(a + 2, 'tree', 'meta');
  cam(a + 8, 'tree', 'meta', 10, 'spin');
  // each endotype from its own view (the set's cam e<id>), turning a little while it is told
  four.forEach((id, j) => { const t = a + 9.5 + 10 * j - (j === 3 ? 1 : 0); cam(t + 1, 'tree', 'e' + id); cam(t + 7.5, 'tree', 'e' + id, 6, 'spin'); });
  cam(a + 44, 'tree', 'meta');
  show('syn', a + 45, a + 47);
  ramp('syn_endo', a + 47, a + 53, 0, 1);
  four.reduce((p0, id, j) => { jump('syn_place', a + 50 + 2.6 * j, p0, id + 1); return id + 1; }, 0);
  cam(a + 46.5, 'syn', 'wide');
  cam(a + 50, 'syn', 'default');
  cam(b, 'syn', 'default', 25, 'spin');
  // What for: the junction with every endotype in its place
  a = C.next.a; b = C.next.b;
  jump('syn_place', a + 3, four.length ? four[four.length - 1] + 1 : 0, 0);
  cam(a + 5, 'syn', 'wide', 20);
  cam(b, 'syn', 'wide', 60, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  label('syn', () => anchorOf('syn', 'scaffold'), '<b>Fatigable weakness</b>each twitch weaker', C.tired.a + 18, C.tired.b - 0.5, 'amb');
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
// Explore mode: the 12 endotypes, the 393 genes of the module and the five steps of the method, shown in the
// synapse, the protein network or the tree; or any scene with its own controls.
const SCENES = [
  ['syn', 'Synapse', 'The neuromuscular junction, cut open: the nerve ending, the gap with its basement membrane, the folded muscle membrane and the fibre. With the seed genes where they act, and each endotype in its place.'],
  ['net', 'Network', `The protein network the authors used: ${fmt(FACTS.genes)} proteins and their links, the ${FACTS.seeds} seeds, the walk with restart and the module of ${FACTS.module} genes. Positions are a drawing: linked genes sit close, and in the module each endotype is pulled towards its own region.`],
  ['tree', 'Tree', `The module's genes by the cell parts around them: the ${FACTS.module} × ${FACTS.terms} matrix, the tree that splits only when the data say so, the genes by tree distance and the endotype network.`],
  ['motor', 'Motor unit', 'From nerve to muscle: the motor neuron, its axon, the neuromuscular junctions and the muscle fibres they drive.'],
];
const TABS = [['endo', 'Endotypes'], ['genes', 'Genes'], ['method', 'Method'], ['scenes', 'Scenes']];
// the method's five steps: key, name, the scene it shows
const METHOD = [['groups', 'Seed groups', 'net'], ['walk', 'The walk', 'net'], ['hood', 'Neighbourhoods', 'net'], ['tree', 'The tree', 'tree'], ['endo', 'Endotypes', 'tree']];
const K_DEF = Math.max(0, ED.groups.findIndex(g => g.k === 20));
const X = { tab: 'endo', scene: 'tree', ctl: {}, t0: 0, turn: 'on', endo: -1, gene: -1, k: K_DEF, step: 0, gap: false };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['motor_site', 'syn_place', 'tree_focus', 'net_gene', 'net_focus']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => (GL.sets[k].controls || []).find(c => c.key === key);
// a control's option whose key or name matches re (the sets name their own options)
const optKey = (k, key, re) => { const c = ctlOf(k, key), o = c && c.options.find(([v, n]) => re.test(v) || re.test(n)); return o ? o[0] : null; };
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
// a view option's camera: the cam view of the same name, or one the set names otherwise (the tree's Distances and
// Endotypes are its cam views mds and meta)
const CAM_ALIAS = { tree: { dist: 'mds', endo: 'meta' } };
const camFor = (k, v) => { const c = GL.sets[k].cam || {}, a = (CAM_ALIAS[k] || {})[v] || v; return c[a] ? a : null; };
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
const STORY_IDX = () => geneIdx(STORY_GENE);
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
const afterUpdate = f => { NEXT.push(f); };

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
function exploreTargets(now = performance.now()) {
  const s = GL.sets[X.scene], tg = Object.assign({}, s.params);
  tg[X.scene + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(X.scene, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  const e = X.endo, g = X.gene;
  // the picked endotype in the tree, the synapse or the network; the picked gene's neighbourhood in the network
  if (X.scene === 'tree' && e >= 0) tg.tree_focus = e + 1;
  if (X.scene === 'syn' && e >= 0) { tg.syn_endo = 1; tg.syn_place = e + 1; }
  if (X.scene === 'net') {
    if (e >= 0) { tg.net_module = 1; tg.net_endo = 1; tg.net_focus = e + 1; tg.net_seeds = Math.min(tg.net_seeds, 0.3); }   // (white seeds would outshine its colour)
    if (g >= 0) { tg.net_gene = g; tg.net_hood = 1; }
  }
  // the Method tab shows its step on top
  if (X.tab === 'method' && METHOD[X.step][2] === X.scene) {
    const st = METHOD[X.step][0];
    const quiet = { net_endo: 0, net_focus: 0, net_gene: -1, net_hood: 0 };
    if (st === 'groups') Object.assign(tg, quiet, { net_cloud: 1, net_seeds: 1, net_k: X.k + (X.k === 0 ? 0.25 : 0), net_walk: 0, net_heat: 0, net_module: 0 });
    if (st === 'walk') Object.assign(tg, quiet, { net_seeds: 1, net_k: ED.groups.length - 1, net_heat: 1 });
    if (st === 'hood') Object.assign(tg, quiet, { net_gene: g >= 0 ? g : STORY_IDX(), net_hood: 1, net_module: 0, net_walk: 0, net_heat: 0, net_seeds: 0.4 });
    if (st === 'tree') { tg.tree_meta = 0; tg.tree_focus = 0; }
    if (st === 'endo') { tg.tree_meta = 1; tg.tree_focus = e + 1; }
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it, standing in the gap, or a set asks for stillness
  if (X.turn === 'on' && !(X.gap && X.scene === 'syn') && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets); here only the labels follow
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) flyTo(view(k, X.gap && k === 'syn' ? 'gap' : viewCam(k) || 'default'));
  renderScenes();
  updateExtraLabels();
}
function setCtl(k, key, v) {
  const s = GL.sets[k], c = (s.controls || []).find(x => x.key === key), was = c ? ctlValue(k, c) : null;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // some views have their own best camera (cam views named like the option); leaving one goes back to the scene's own view
  if (!(X.gap && k === 'syn') && k === X.scene) {
    if (camFor(k, v)) flyTo(view(k, camFor(k, v)));
    else if (was && camFor(k, was)) flyTo(view(k, 'default'));
  }
  if (c) { renderScenes(); renderMethod(); }
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
function flyNear(p, d) { if (p && !(X.gap && X.scene === 'syn')) flyTo([orbit.cur[0], orbit.cur[1], d, p[0], p[1], p[2]]); }

// --------------------------------------------------------------- actions --
// pick an endotype (-1 none); the motor unit has none to show, so the tree comes up
function selectEndo(id, fly = true) {
  X.endo = id;
  if (id >= 0 && X.scene === 'motor') openScene('tree');
  pushState(); renderAll();
  if (fly && id >= 0) flyToEndo();
}
function flyToEndo() {
  const id = X.endo, s = GL.sets[X.scene], tv = ctlOf('tree', 'view');
  if (id < 0) return;
  const meta = (X.tab === 'method' && METHOD[X.step][0] === 'endo') || (tv && ctlValue('tree', tv) === optKey('tree', 'view', /meta|endo/i));
  if (X.scene === 'tree' && meta && s.cam['e' + id]) flyTo(view('tree', 'e' + id));
  else if (X.scene === 'tree' && 'focus' in s.cam) afterUpdate(() => { if (X.scene === 'tree' && X.endo === id) flyTo(view('tree', 'focus')); });   // (the set's focus view follows its focus)
  else if (X.scene === 'syn' && (s.anchors['e' + id] || s.anchors[ED.endo[id].place])) flyNear(anchorOf('syn', s.anchors['e' + id] ? 'e' + id : ED.endo[id].place), 0.45 * view('syn', 'default')[2]);   // where its cloud settles
  else if (X.scene === 'net' && s.cam.module) flyTo(view('net', 'module'));   // the module pulls together, the endotype bright in it
}
// pick a gene of the module (-1 none); picked from a list (fly), its neighbourhood shows in the network
function selectGene(i, fly = true) {
  X.gene = i;
  if (i >= 0 && (X.scene === 'motor' || (fly && X.scene !== 'net'))) openScene('net');
  pushState(); renderGene(i); renderMethod();
  if (fly && i >= 0 && X.scene === 'net') afterUpdate(flyToGene);
}
// the method's step i: its scene, and the view that suits it
function showStep(i, quiet) {
  X.step = clamp(i | 0, 0, METHOD.length - 1);
  if (!quiet) {
    const st = METHOD[X.step];
    if (X.scene !== st[2]) openScene(st[2]);
    if (st[0] === 'groups' || st[0] === 'hood') { const v = optKey('net', 'view', /net|cloud/i); if (v && ctlValue('net', ctlOf('net', 'view')) !== v) setCtl('net', 'view', v); }
    if (st[0] === 'tree') { const v = optKey('tree', 'view', /^tree$/i); if (v && ctlValue('tree', ctlOf('tree', 'view')) !== v) setCtl('tree', 'view', v); else X.t0 = performance.now(); }
    if (st[0] === 'endo') { const v = optKey('tree', 'view', /meta|endo/i); if (v && ctlValue('tree', ctlOf('tree', 'view')) !== v) setCtl('tree', 'view', v); }
    if (st[0] === 'walk') { const v = optKey('net', 'walkers', /^on$/i); if (v && ctlValue('net', ctlOf('net', 'walkers')) !== v) setCtl('net', 'walkers', v); }
    if (st[0] === 'hood' && X.scene === 'net') afterUpdate(flyToGene);
  }
  renderMethod(); updateExtraLabels();
}
// the Genes tab's buttons: the gene's neighbourhood in the network; its endotype in the endotype network
function showHood() { openScene('net'); selectGene(X.gene); }
function showInTree(i) { openScene('tree'); const t = optKey('tree', 'view', /meta|endo/i); if (t) setCtl('tree', 'view', t); selectEndo(ED.genes[i].endo); }
// the Endotypes tab's buttons: the picked endotype in another scene
function showEndoIn(k) { openScene(k); flyToEndo(); renderEndo(); renderMethod(); }
function flyToGene() {
  const A = setApi('net'), i = X.gene >= 0 ? X.gene : X.tab === 'method' && METHOD[X.step][0] === 'hood' ? STORY_IDX() : -1;
  if (X.scene === 'net' && i >= 0 && !(X.gap && X.scene === 'syn')) { if (A && A.geneView) flyTo(A.geneView(i)); else flyNear(anchorOf('net', 'gene'), 2.4); }
}
function setK(j) { X.k = clamp(j | 0, 0, ED.groups.length - 1); renderMethod(); }
// the tree's tests run each time its Tree view opens (its explore(c) follows c.t): open it, or start the clock again
function replayTests() {
  if (X.scene !== 'tree') openScene('tree');
  const v = optKey('tree', 'view', /^tree$/i);
  if (v && ctlValue('tree', ctlOf('tree', 'view')) !== v) setCtl('tree', 'view', v); else X.t0 = performance.now();
}
// Stand in the gap: on screen a view from inside the cleft; in the headset the synapse life size around you
function setGap(on) {
  X.gap = on;
  if (XR.on) xrRoom(on);
  if (on && X.scene !== 'syn') openScene('syn', false);
  if (X.scene === 'syn') flyTo(view('syn', on ? 'gap' : 'default'));
  document.querySelectorAll('[data-ctl="gap"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === (on ? 'on' : 'off'))));
  renderScenes();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls, the
// picked endotype and gene, the method's step and its k. Turning and standing in the gap are each person's own view.
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
  for (const [k] of SCENES) ctl[k] = Object.fromEntries((GL.sets[k].controls || []).map(c => [c.key, ctlValue(k, c)]));
  return { tab: X.tab, scene: X.scene, ctl, endo: X.endo, gene: X.gene, k: X.k, step: X.step };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n < hi;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if ((v.endo === -1 || int(v.endo, 0, ED.endo.length)) && v.endo !== X.endo) selectEndo(v.endo, false);
  if ((v.gene === -1 || int(v.gene, 0, ED.M)) && v.gene !== X.gene) { $('#q').value = v.gene >= 0 ? ED.genes[v.gene].sym : ''; selectGene(v.gene, false); }
  if (int(v.k, 0, ED.groups.length) && v.k !== X.k) setK(v.k);
  if (int(v.step, 0, METHOD.length) && v.step !== X.step) showStep(v.step, true);
  // the scene and its controls last; a control flies to its own view as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of GL.sets[k].controls || []) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
}

// ------------------------------------------------------------- search --
// the module's genes by symbol first, then by a seed's protein name or a cell part in its row of the matrix
function matches(q, limit) {
  q = String(q == null ? '' : q).trim().toUpperCase();
  if (!q) return [];
  const res = [];
  ED.genes.forEach((g, i) => {
    const s = g.sym.toUpperCase();
    let r = -1;
    if (s === q) r = 0; else if (s.startsWith(q)) r = 1; else if (q.length >= 3 && s.includes(q)) r = 2;
    else if (q.length >= 4 && g.seed >= 0 && ED.seeds[g.seed][1].toUpperCase().includes(q)) r = 3;
    else if (q.length >= 4 && g.terms.some(t => ED.terms[t].toUpperCase().includes(q))) r = 4;
    if (r >= 0) res.push([r, i]);
  });
  return res.sort((a, b) => a[0] - b[0] || ED.genes[a[1]].sym.localeCompare(ED.genes[b[1]].sym)).slice(0, limit || 8).map(r => r[1]);
}
const findGene = s => { const i = geneIdx(s); return i < 0 ? (matches(s, 1)[0] ?? -1) : i; };
const endoName = id => `${id} · ${ED.endo[id].name}`;
const geneNote = i => { const g = ED.genes[i]; return `${g.seed >= 0 ? 'seed' : 'found'} · ${endoName(g.endo)}`; };
function attachSuggest(input, list, onPick) {
  let items = [], hi = -1;
  const close = () => { list.classList.remove('on'); input.setAttribute('aria-expanded', 'false'); hi = -1; };
  const render = () => {
    items = matches(input.value, 8);
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === hi}"><b>${esc(ED.genes[i].sym)}</b><span>${esc(ED.genes[i].seed >= 0 ? ED.seeds[ED.genes[i].seed][1] : 'found by the walk')}</span><em>${esc(endoName(ED.genes[i].endo))}</em></li>`).join('');
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
  if (i >= 0) { $('#q').value = ED.genes[i].sym; selectGene(i); } else { X.gene = -1; pushState(); renderGene(-2, q); }
}

// ------------------------------------------------------------------ panes --
// seeds of the poster's endotypes, for a quick start
const QUICK = ['COLQ', 'AGRN', 'SNAP25', 'SYT2', 'SLC25A1', 'SCN4A', 'CHRNE', 'DOK7', 'MUSK', 'RAPSN'];
// genes for the neighbourhood step: a seed of each endotype that has one (its first)
const HOOD_GENES = () => ED.endo.map(e => geneIdx(e.seeds[0])).filter(i => i >= 0);
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:#04131c"' : ''}>${col ? `<span class="sw" style="background:${col}"></span>` : ''}${label}</button>`;
// links inside an endotype, and from a gene to each endotype (the module's own links)
const linksIn = id => ED.members[id].reduce((a, i) => a + ED.genes[i].nb.filter(j => ED.genes[j].endo === id).length, 0) / 2;
const fmtP = p => (p >= 0.001 ? String(+p.toPrecision(2)) : p.toExponential(1).replace('e-', ' × 10^-').replace(/\^-(\d+)/, (m, d) => '⁻' + [...d].map(x => '⁰¹²³⁴⁵⁶⁷⁸⁹'[x]).join('')));
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    <div class="pane" id="pane-endo" role="tabpanel"></div>
    <div class="pane" id="pane-genes" role="tabpanel">
      <div class="search"><input id="q" type="search" placeholder="Search a gene of the module, or a cell part" autocomplete="off" spellcheck="false" aria-label="Search genes" role="combobox" aria-expanded="false" aria-controls="qs"><ul class="sugg" id="qs" role="listbox"></ul></div>
      <div id="ginfo"></div>
    </div>
    <div class="pane" id="pane-method" role="tabpanel"></div>
    <div class="pane" id="pane-scenes" role="tabpanel"></div>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  attachSuggest($('#q'), $('#qs'), (i, text) => { if (i !== null && i !== undefined) { $('#q').value = ED.genes[i].sym; selectGene(i); } else runQuery(text); });
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v, n = v !== undefined && v !== '' && !isNaN(+v) ? +v : v;
    ({
      endo: () => selectEndo(n === X.endo ? -1 : n), gene: () => { $('#q').value = ED.genes[n].sym; showTab('genes'); selectGene(n); },
      quick: () => { $('#q').value = ED.genes[n].sym; selectGene(n); }, hood: showHood, intree: () => showInTree(n),
      show: () => showEndoIn(v), step: () => showStep(n), k: () => setK(n), replay: replayTests,
      hgene: () => { $('#q').value = ED.genes[n].sym; selectGene(n, false); showStep(2); },
      scene: () => openScene(v), ctl: () => setCtl(b.dataset.scene || X.scene, b.dataset.ctl, v), gap: () => setGap(!X.gap),
    }[b.dataset.act] || (() => {}))();
  });
  renderAll(); renderGene(-1);
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>
    <div class="grp"><span>Stand in the gap</span><div class="seg" data-ctl="gap" role="group" aria-label="Stand in the gap of the synapse">${[['off', 'Off'], ['on', 'On']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${(X.gap ? 'on' : 'off') === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (!seg) return;
    if (seg.dataset.ctl === 'turn') setTurn(b.dataset.v); else setGap(b.dataset.v === 'on');
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
  // the Method tab shows its step's scene
  if (k === 'method' && X.scene !== METHOD[X.step][2]) openScene(METHOD[X.step][2]);
  updateExtraLabels();
}
function renderAll() { renderEndo(); renderGene(X.gene); renderMethod(); renderScenes(); }
const SHOW_IN = [['tree', 'In the tree'], ['syn', 'In the synapse'], ['net', 'In the network']];
function renderEndo() {
  const pane = $('#pane-endo');
  if (!pane) return;
  const id = X.endo, E = ED.endo[id];
  let h = `<p class="sub">The ${ED.endo.length} endotypes the authors found among the ${ED.M} genes of the CMS module. Pick one to see its genes, and where it works.</p>
    <div class="chips">${ED.endo.map(e => chip(`data-act="endo" data-v="${e.id}"`, `${e.id} · ${esc(e.name)} <small>${e.n}</small>`, id === e.id, e.col)).join('')}</div>`;
  if (E) {
    const mem = ED.members[id], seeds = mem.filter(i => ED.genes[i].seed >= 0), L = linksIn(id);
    h += `<h3><span class="sw" style="background:${E.col}"></span>${esc(endoName(id))}</h3>
      <dl class="stats"><dt>Genes</dt><dd>${mem.length}<small>${seeds.length ? `${seeds.length} of them ${seeds.length === 1 ? 'a seed' : 'seeds'}` : 'no seed: all found by the walk'}</small></dd>
      <dt>Strongest term</dt><dd style="font-size:15px">${esc(E.term)}<small>${STRONG[E.strong]} (adjusted p ${fmtP(E.p)}): the cell part its genes share most, from the COMPARTMENTS database; clear means p under 0.01</small></dd>
      <dt>Drawn at</dt><dd style="font-size:15px">${E.place ? esc(PLACE[E.place] || E.place) : 'no shared place'}</dd>
      <dt>Links inside</dt><dd>${L}<small>${L ? 'among its own genes, in the protein network' : 'none among its own genes: a loose cloud'}</small></dd></dl>
      <div class="chips">${SHOW_IN.map(([k, n]) => chip(`data-act="show" data-v="${k}"`, n, X.scene === k)).join('')}</div>
      <p class="grp-h">Its genes (seeds in bold)</p>
      <div class="chips">${seeds.concat(mem.filter(i => ED.genes[i].seed < 0)).map(i => `<button type="button" data-act="gene" data-v="${i}">${ED.genes[i].seed >= 0 ? `<b>${esc(ED.genes[i].sym)}</b>` : esc(ED.genes[i].sym)}</button>`).join('')}</div>`;
  } else h += `<p class="empty">${FACTS.clear} endotypes share a clear place in the cell, ${FACTS.weak} a weak one, ${FACTS.none} none. Colours are the same in every scene.</p>`;
  pane.innerHTML = h;
}
function renderGene(i, q) {
  const pane = $('#ginfo');
  if (!pane) return;
  if (i < 0) {
    pane.innerHTML = `${i === -2 ? `<p class="empty">No gene of the module matches “${esc(q)}”. Try a symbol like COLQ, or a cell part like synapse.</p>` : `<p class="empty">Search above, or click a gene in the network or the tree. The ${ED.M} genes are those of the CMS module: ${FACTS.seeds} seeds and ${FACTS.found} genes the walk found.</p>`}
      <div class="quick">${QUICK.map(geneIdx).filter(k => k >= 0).map(k => `<button type="button" data-act="quick" data-v="${k}">${esc(ED.genes[k].sym)}</button>`).join('')}</div>`;
    return;
  }
  const G = ED.genes[i], E = ED.endo[G.endo], S = G.seed >= 0 ? ED.seeds[G.seed] : null;
  const hood = ED.hoodOf(i), inMod = hood.filter(j => j < ED.M).length;
  pane.innerHTML = `<h3>${esc(G.sym)}</h3><p class="sub">${S ? `${esc(S[1])}. Seed: a CMS gene (Gene Table item ${esc(S[2])}).` : 'Found by the walk: not one of the ' + FACTS.seeds + ' Gene Table seeds, but close to them.'}</p>
    <div class="chips">${chip(`data-act="endo" data-v="${G.endo}"`, `Endotype ${esc(endoName(G.endo))}`, X.endo === G.endo, E.col)}</div>
    <dl class="stats" style="margin-top:12px"><dt>Cell parts</dt><dd>${G.terms.length}<small>in its row of the matrix</small></dd>
    <dt>Links</dt><dd>${G.nb.length}<small>to other genes of the module</small></dd>
    <dt>Neighbours</dt><dd>${hood.length}<small>proteins, ${inMod} of them in the module</small></dd></dl>
    <div class="actions"><button class="btn" type="button" data-act="hood">Show its neighbourhood</button><button class="btn" type="button" data-act="intree" data-v="${i}">Show it in the tree</button></div>
    ${G.terms.length ? `<p class="grp-h">Cell parts in its row</p><p class="sub" style="margin:0 0 8px">${esc(G.terms.map(t => ED.terms[t]).join(', '))}</p>` : '<p class="sub">No cell part in its row.</p>'}
    ${G.nb.length ? `<p class="grp-h">Linked genes in the module</p><div class="chips">${G.nb.map(j => `<button type="button" data-act="gene" data-v="${j}"><span class="sw" style="background:${endoCol(ED.genes[j].endo)}"></span>${esc(ED.genes[j].sym)}</button>`).join('')}</div>` : ''}`;
}
// one sentence per step, and its control
const NOTE = `Illustrative: the endotypes are the authors' result. The steps before them were re-run on the same network with the package's default settings to show how the method works; the tree is drawn to agree with the authors' endotypes.`;
function methodText(st) {
  const F = FACTS;
  return {
    groups: `Each seed gets a neighbourhood, its k closest proteins in the network. Seeds whose neighbourhoods meet form a group: ${ED.groups[0].n} groups at k = ${ED.groups[0].k}${F.oneK ? `, one from k = ${F.oneK} on` : ''}.`,
    walk: `Walkers start at the seeds. At every step one jumps back to a seed with probability ${F.r}, otherwise it hops to a random neighbour. The most visited genes join the ${F.seeds} seeds until the module holds together. In the authors' run: ${F.found} found, ${F.module} in all (the walkers here are a re-run).`,
    hood: `A walk from one gene alone marks its neighbourhood, the top ${F.pct}% of the network (${F.hood} proteins). The cell parts enriched there, with the gene's own, are its row of the matrix.`,
    tree: `Genes with similar rows join into a tree. Tree2BreakSpace tests each split from the root down and keeps it only when the two sides differ: only ${F.cuts} are kept.`,
    endo: `The kept splits leave ${F.endotypes} endotypes: one bubble each, with bands as wide as the links between them. Pick one in Endotypes to bring it forward.`,
  }[st];
}
function renderMethod() {
  const pane = $('#pane-method');
  if (!pane) return;
  const st = METHOD[X.step][0];
  let h = `<div class="chips">${METHOD.map(([k, n], j) => chip(`data-act="step" data-v="${j}"`, `${j + 1} · ${n}`, X.step === j)).join('')}</div>
    <p>${esc(methodText(st))}</p>`;
  const ctlChips = (k, key) => { const c = ctlOf(k, key); return c ? `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-scene="${k}" data-ctl="${key}" data-v="${v}"`, esc(n), ctlValue(k, c) === v)).join('')}</div>` : ''; };
  if (st === 'groups') h += `<p class="grp-h">Neighbourhood size k</p><div class="chips">${ED.groups.map((g, j) => chip(`data-act="k" data-v="${j}"`, `k = ${g.k} <small>${g.n} ${g.n === 1 ? 'group' : 'groups'}</small>`, X.k === j)).join('')}</div>`;
  if (st === 'walk') h += ctlChips('net', 'walkers') + ctlChips('net', 'view');
  if (st === 'hood') {
    const cur = X.gene >= 0 ? X.gene : STORY_IDX(), list = [...new Set([cur, ...HOOD_GENES()])].filter(i => i >= 0);
    h += `<p class="grp-h">A gene (a seed of each endotype that has one; or search any in Genes)</p><div class="chips">${list.map(i => chip(`data-act="hgene" data-v="${i}"`, esc(ED.genes[i].sym), i === cur, endoCol(ED.genes[i].endo))).join('')}</div>`;
  }
  if (st === 'tree') h += ctlChips('tree', 'view') + `<div class="actions"><button class="btn primary" type="button" data-act="replay">Replay the tests</button></div>`;
  if (st === 'endo') h += `<div class="chips">${SHOW_IN.slice(0, 2).map(([k, n]) => chip(`data-act="show" data-v="${k}"`, n, X.scene === k)).join('')}</div>`;
  h += `<p class="note" style="margin-top:14px">${esc(NOTE)}</p>`;
  pane.innerHTML = h;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${(s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${X.scene === 'syn' ? `<div class="actions">${chip('data-act="gap"', 'Stand in the gap', X.gap)}</div>` : ''}
    ${X.endo >= 0 || X.gene >= 0 ? `<p class="sub" style="margin-top:10px">Also shown: ${[X.endo >= 0 ? `endotype ${esc(endoName(X.endo))}` : '', X.gene >= 0 ? esc(ED.genes[X.gene].sym) : ''].filter(Boolean).join(' and ')} (Endotypes and Genes tabs).</p>` : ''}`;
}
// labels the panes add (the sets label their own picks: the gene in the network, the endotypes in the tree and synapse)
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  const s = GL.sets[X.scene], own = at => (s.labels || []).some(L => L.at === at);
  // (the network labels a seed with its neighbourhood itself)
  const sym = X.gene >= 0 ? ED.genes[X.gene].sym : '', rest = X.gene >= 0 ? endoName(ED.genes[X.gene].endo) : '';
  const add = (set, at) => LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(sym)}</b>${esc(rest)}`, 'cyn'), set, at, o: -1, txt: [sym, rest, 'cyn'] });
  if (X.gene >= 0 && ED.genes[X.gene].seed < 0 && X.scene === 'net' && s.anchors.gene && !own('gene')) add('net', 'gene');
  // in the tree, where the gene is now (its row, its dot by tree distance, or in its endotype's bubble)
  const T = setApi('tree'), i = X.gene;
  if (i >= 0 && X.scene === 'tree' && T && T.genePos) add('tree', () => T.genePos(i));
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { gene } or { endo }, or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || !(X.scene === 'net' || X.scene === 'tree')) return null;
  const A = setApi(X.scene);
  if (!A || !A.pick) return null;
  const r = A.pick(rc);
  if (typeof r === 'number') return r >= 0 ? { gene: r } : null;
  return r && (r.gene >= 0 || r.endo >= 0) ? r : null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null
function pickPos(p) {
  const A = setApi(X.scene);
  if (!A || !p) return null;
  let q = null;
  if (X.scene === 'net' && p.gene >= 0 && A.geneView) q = A.geneView(p.gene).slice(3, 6);
  if (X.scene === 'tree') q = p.gene >= 0 && A.genePos ? A.genePos(p.gene) : p.endo >= 0 && A.endoPos ? A.endoPos(p.endo) : null;
  return q && Number.isFinite(q[0]) ? [q[0], q[1], q[2]] : null;
}
const pickText = p => (p.gene >= 0 ? [ED.genes[p.gene].sym, geneNote(p.gene)] : [`Endotype ${p.endo}`, ED.endo[p.endo].name]);
function choosePick(p) {
  if (!p) return;
  if (p.gene >= 0) { $('#q').value = ED.genes[p.gene].sym; if (X.tab !== 'method') showTab('genes'); selectGene(p.gene, false); if (X.tab === 'method' && X.step === 2) renderMethod(); }
  else { if (X.tab !== 'method') showTab('endo'); selectEndo(p.endo === X.endo ? -1 : p.endo, false); }
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
  // standing in the gap: the synapse life size around you (gapScale), the cleft at your chest, turned by the thumbstick
  if (XR.room && APP.mode === 'explore' && X.scene === 'syn') {
    const g = anchorOf('syn', 'gap');
    XR.R = gapScale(); XR.hitR = 1.2 / XR.R; XR.target.set(g[0], g[1], g[2]);
    GL.world.quaternion.setFromAxisAngle(_xY, -v[0] * D2R);
    GL.world.scale.setScalar(XR.R);
    _xb.copy(XR.target).applyQuaternion(GL.world.quaternion).multiplyScalar(XR.R);
    GL.world.position.set(-_xb.x, -0.35 - _xb.y, -_xb.z);   // the rig is at your eyes: the cleft 35 cm below them
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
// the gene or endotype a controller points at, labelled where the ray meets it
function xrTip(S) {
  let h = null;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.pk) { h = c.hover; break; }
  const id = h ? (h.pk.gene >= 0 ? 'g' + h.pk.gene : 'e' + h.pk.endo) + X.scene : '';
  if (id !== XR.tipI) {
    XR.tipI = id;
    if (XR.tip) dropSprite(XR.tip);
    XR.tip = h ? { set: X.scene, at: [0, 0, 0], txt: [...pickText(h.pk), 'tip'] } : null;
  }
  if (XR.tip) { GL.sets[XR.tip.set].group.worldToLocal(_xp.copy(h.point)); XR.tip.at = [_xp.x, _xp.y, _xp.z]; placeLabelXR(XR.tip, 1, S); }
}

// ------------------------------------------------------ picking a gene --
// The gene or endotype a ray points at (explore mode, the network or the tree on show): { gene } or { endo }, or null
const _prc = new THREE.Raycaster();
function pickRay(o, d) {
  if (APP.mode !== 'explore' || !(X.scene === 'net' || X.scene === 'tree')) return null;
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
  if (h.kind !== 'panel' && XR.room && APP.mode === 'explore' && X.scene === 'syn') return;   // standing in the gap: life size round you
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
    const pk = pickRay(c.o, c.d);
    if (t > 0 || pk) {
      // a gene or endotype is marked where it is; else the ball's surface
      const q = pk ? pickPos(pk) : null;
      if (q) _xp.set(q[0], q[1], q[2]).applyMatrix4(GL.sets[X.scene].group.matrixWorld);
      else _xp.copy(dL).multiplyScalar(t > 0 ? t : Math.max(0, _xc.copy(XR.target).sub(oL).dot(dL))).add(oL).applyMatrix4(GL.world.matrixWorld);
      hit = { kind: 'globe', i: pk && pk.gene >= 0 ? pk.gene : -1, pk, point: _xp.clone() };
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
function xrPickSuggestion(i) {
  XR.kbd.open = false; XR.kbd.q = '';
  $('#q').value = ED.genes[i].sym; showTab('genes'); selectGene(i);
}
// Stand in the gap: in the headset the synapse is shown around you, the cleft at your chest
function xrRoom(on) { XR.room = on; }
// the gap's scale (metres per unit): with the cleft's middle at your chest, the nerve ending's vesicles about 0.85 m
// above it (over your head) and the receptor-covered crests of the folds 0.25 m below it (at your hips); the folds
// go down from there and the muscle is under your feet (about 4 m to the unit)
function gapScale() {
  if (XR.gapR) return XR.gapR;
  const g = anchorOf('syn', 'gap')[1], up = anchorOf('syn', 'vesicles')[1] - g, down = g - anchorOf('syn', 'receptors')[1];
  const k = [up > 0.01 ? 0.85 / up : 0, down > 0.01 ? 0.25 / down : 0].filter(x => x > 0);
  return (XR.gapR = k.length ? k.reduce((a, x) => a + x, 0) / k.length : 2);
}
// how close the headset may zoom: as close as the scene's own closest view, else 0.9 (closer, the scene would surround your head)
const xrMinD = () => (XR.room && X.scene === 'syn' ? 0.05 : Math.min(0.9, ...Object.values(GL.sets[X.scene].cam || {}).map(v => +v[2] || 9)));
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
  XR.room = !!X.gap;
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
  return ['x', audioLabel(), X.tab, X.scene, JSON.stringify(X.ctl), X.endo, X.gene, X.k, X.step, X.gap, XR.kbd.open, XR.kbd.q].join('|');
}
const XR_HERE = 'endo';
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
  ctx.fillText(fitText(ctx, 'Endotypes', x - 40), 40, 36);
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
      const col = li.style.borderLeftColor || VC.amber;   // an endotype's point in its own colour
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
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => { XR.kbd.open = false; showTab(k); } });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 88;
  const bottom = P.h - 34;
  if (XR.kbd.open && X.tab === 'genes') return drawKeyboard(ctx, P, x, y, W);
  ({ endo: drawEndoPane, genes: drawGenePane, method: drawMethodPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
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
    ctx.font = vfont(px, it.on ? 700 : 400);   // (a lit chip's bold label is wider)
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
const head = (ctx, x, y, t) => { ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(t, x, y); return 34; };
function drawEndoPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, ED.endo.map(e => ({ id: 'en:' + e.id, label: `${e.id} · ${e.name}`, col: e.col, on: X.endo === e.id, fn: () => selectEndo(X.endo === e.id ? -1 : e.id) })), x, y, W, bottom, { px: 21, h: 44 }) + 18;
  const id = X.endo, E = ED.endo[id];
  if (!E) { textBlock(ctx, `Pick one of the ${ED.endo.length} endotypes the authors found among the ${ED.M} genes of the CMS module, to see its genes and where it works.`, x, y, W, 26, 38, VC.muted); return; }
  const mem = ED.members[id], seeds = mem.filter(i => ED.genes[i].seed >= 0), L = linksIn(id);
  swatch(ctx, x, y + 9, 26, E.col);
  y += textBlock(ctx, endoName(id), x + 40, y, W - 40, 36, 44, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, `${mem.length} genes, ${seeds.length ? `${seeds.length} of them ${seeds.length === 1 ? 'a seed' : 'seeds'}` : 'no seed'}. ${L ? `${L} links among them.` : 'No links among them: a loose cloud.'}`, x, y, W, 24, 34, VC.muted, 400, 2) + 4;
  y += textBlock(ctx, `Strongest term: ${E.term} (${STRONG[E.strong]}, adjusted p ${fmtP(E.p)}; clear means p under 0.01).`, x, y, W, 24, 34, VC.muted, 400, 2) + 4;
  y += textBlock(ctx, `Drawn at: ${E.place ? PLACE[E.place] || E.place : 'no shared place'}.`, x, y, W, 24, 34, VC.muted, 400, 2) + 14;
  y += flow(ctx, P, SHOW_IN.map(([k, n]) => ({ id: 'show:' + k, label: n, on: X.scene === k, fn: () => showEndoIn(k) })), x, y, W, bottom, { px: 23, h: 52 }) + 16;
  y += head(ctx, x, y, 'Its genes (seeds marked ●)');
  flow(ctx, P, seeds.concat(mem.filter(i => ED.genes[i].seed < 0)).map(i => ({ id: 'eg:' + i, label: (ED.genes[i].seed >= 0 ? '● ' : '') + ED.genes[i].sym, fn: () => { showTab('genes'); selectGene(i); } })), x, y, W, bottom, { px: 20, h: 38 });
}
function drawGenePane(ctx, P, x, y, W, bottom) {
  searchField(ctx, P, x, y, W, 'Search a gene of the module');
  y += 90;
  const i = X.gene;
  if (i < 0) {
    y += textBlock(ctx, `Point at a gene in the network or the tree and pull the trigger (or pinch). The ${ED.M} genes are those of the CMS module: ${FACTS.seeds} seeds and ${FACTS.found} the walk found.`, x, y, W, 26, 38, VC.muted) + 20;
    flow(ctx, P, QUICK.map(geneIdx).filter(k => k >= 0).map(k => ({ id: 'qk:' + k, label: ED.genes[k].sym, col: endoCol(ED.genes[k].endo), fn: () => selectGene(k) })), x, y, W, bottom, { px: 24, h: 52 });
    return;
  }
  const G = ED.genes[i], S = G.seed >= 0 ? ED.seeds[G.seed] : null, hood = ED.hoodOf(i), inMod = hood.filter(j => j < ED.M).length;
  y += textBlock(ctx, G.sym, x, y, W, 42, 48, VC.ink, 700, 1) + 2;
  y += textBlock(ctx, S ? `${S[1]}. A seed: Gene Table item ${S[2]}.` : 'Found by the walk: not one of the ' + FACTS.seeds + ' Gene Table seeds, but close to them.', x, y, W, 23, 32, VC.muted, 400, 2) + 12;
  y += flow(ctx, P, [{ id: 'gen:' + G.endo, label: 'Endotype ' + endoName(G.endo), col: endoCol(G.endo), on: X.endo === G.endo, fn: () => selectEndo(X.endo === G.endo ? -1 : G.endo) }], x, y, W, bottom, { px: 23, h: 50 }) + 12;
  y += textBlock(ctx, `${G.terms.length} cell parts in its row of the matrix; ${G.nb.length} links to genes of the module; ${hood.length} neighbours, ${inMod} of them in the module.`, x, y, W, 24, 34, VC.muted, 400, 3) + 10;
  vButton(ctx, P, 'ghood', x, y, 380, 56, 'Show its neighbourhood', showHood, { px: 23, on: X.scene === 'net' });
  vButton(ctx, P, 'gtree', x + 396, y, 320, 56, 'Show it in the tree', () => showInTree(i), { px: 23, on: X.scene === 'tree' });
  y += 76;
  if (G.terms.length) { y += head(ctx, x, y, 'Cell parts in its row'); y += textBlock(ctx, G.terms.map(t => ED.terms[t]).join(', '), x, y, W, 22, 30, VC.ink, 400, 4) + 12; }
  if (G.nb.length && y + 80 < bottom) {
    y += head(ctx, x, y, 'Linked genes in the module');
    flow(ctx, P, G.nb.map(j => ({ id: 'nb:' + j, label: ED.genes[j].sym, col: endoCol(ED.genes[j].endo), fn: () => selectGene(j) })), x, y, W, bottom, { px: 21, h: 40 });
  }
}
// the method's steps, one at a time, each with its control
function drawMethodPane(ctx, P, x, y, W, bottom) {
  y += flow(ctx, P, METHOD.map(([k, n], j) => ({ id: 'st:' + j, label: `${j + 1} · ${n}`, on: X.step === j, fn: () => showStep(j) })), x, y, W, bottom, { px: 23, h: 52 }) + 18;
  const st = METHOD[X.step][0];
  y += textBlock(ctx, methodText(st), x, y, W, 26, 37, VC.ink, 400, 5) + 18;
  const ctlRow = (k, key) => {
    const c = ctlOf(k, key);
    if (!c) return;
    y += head(ctx, x, y, c.label);
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'mc:' + k + ':' + key + ':' + v, label: n, on: ctlValue(k, c) === v, fn: () => setCtl(k, key, v) })), x, y, W, bottom, { px: 23, h: 52 }) + 14;
  };
  if (st === 'groups') {
    y += head(ctx, x, y, 'Neighbourhood size k · groups');
    y += flow(ctx, P, ED.groups.map((g, j) => ({ id: 'k:' + j, label: `k = ${g.k} · ${g.n}`, on: X.k === j, fn: () => setK(j) })), x, y, W, bottom, { px: 21, h: 46 }) + 14;
  }
  if (st === 'walk') { ctlRow('net', 'walkers'); ctlRow('net', 'view'); }
  if (st === 'hood') {
    const cur = X.gene >= 0 ? X.gene : STORY_IDX(), list = [...new Set([cur, ...HOOD_GENES()])].filter(i => i >= 0);
    y += head(ctx, x, y, 'A gene (or search any in Genes)');
    y += flow(ctx, P, list.map(i => ({ id: 'hg:' + i, label: ED.genes[i].sym, col: endoCol(ED.genes[i].endo), on: i === cur, fn: () => { selectGene(i, false); showStep(2); } })), x, y, W, bottom, { px: 22, h: 46 }) + 14;
  }
  if (st === 'tree') { ctlRow('tree', 'view'); vButton(ctx, P, 'replay', x, y, 340, 60, 'Replay the tests', replayTests, { primary: true, px: 24 }); y += 80; }
  if (st === 'endo') y += flow(ctx, P, SHOW_IN.slice(0, 2).map(([k, n]) => ({ id: 'ms:' + k, label: n, on: X.scene === k, fn: () => showEndoIn(k) })), x, y, W, bottom, { px: 23, h: 52 }) + 14;
  // the illustrative note, at the foot of the pane
  const nh = 4 * 30;
  if (y + 10 < bottom - nh) textBlock(ctx, NOTE, x, bottom - nh, W, 21, 30, VC.faint, 400, 4);
}
// the four scenes, and the chosen scene's own controls
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of s.controls || []) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  if (X.scene === 'syn' && y + 70 < bottom) vButton(ctx, P, 'gap', x, y, 360, 60, 'Stand in the gap', () => setGap(!X.gap), { on: X.gap, px: 24 });
}
// on-panel keyboard for searching genes
const KROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
function drawKeyboard(ctx, P, x, y, W) {
  const kb = XR.kbd;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted;
  ctx.fillText('Search a gene of the module by its symbol, or a cell part like SYNAPSE', x, y);
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
    const g = ED.genes[i];
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(g.sym, x + 16, yy + 14);
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, g.seed >= 0 ? ED.seeds[g.seed][1] : 'found by the walk', W - 470), x + 170, yy + 15);
    ctx.fillStyle = endoCol(g.endo); ctx.textAlign = 'right'; ctx.fillText(fitText(ctx, endoName(g.endo), 270), x + W - 16, yy + 15); ctx.textAlign = 'left';
  });
  const kw = 84, kh = 70, g = 9, ky0 = P.h - 34 - 4 * kh - 3 * g;
  KROWS.forEach((row, r) => {
    const rw = row.length * kw + (row.length - 1) * g, rx = x + (W - rw) / 2 - (r === 2 ? 50 : 0);
    [...row].forEach((ch, k) => vButton(ctx, P, 'key:' + ch, rx + k * (kw + g), ky0 + r * (kh + g), kw, kh, ch,
      () => { kb.q = (kb.q + ch).slice(0, 24); }, { px: 28 }));
    if (r === 2) vButton(ctx, P, 'key:back', rx + rw + g, ky0 + r * (kh + g), 2 * kw, kh, '⌫ Delete', () => { kb.q = kb.q.slice(0, -1); }, { px: 24 });
  });
  // gene symbols have digits (SNAP25, LAMA5): a row of them above the letters
  const rw0 = 10 * kw + 9 * g, rx0 = x + (W - rw0) / 2;
  [...'1234567890'].forEach((ch, k) => vButton(ctx, P, 'key:' + ch, rx0 + k * (kw + g), ky0 - kh - g, kw, kh, ch, () => { kb.q = (kb.q + ch).slice(0, 24); }, { px: 28 }));
  const by = ky0 + 3 * (kh + g);
  vButton(ctx, P, 'key:dash', x + 40, by, 380, kh, '- (dash)', () => { kb.q = (kb.q + '-').slice(0, 24); }, { px: 24 });
  vButton(ctx, P, 'key:clear', x + 432, by, 170, kh, 'Clear', () => { kb.q = ''; }, { px: 24 });
  vButton(ctx, P, 'key:done', x + 614, by, 290, kh, sug.length ? 'Choose ' + ED.genes[sug[0]].sym : 'Close', () => {
    if (sug.length) xrPickSuggestion(sug[0]); else kb.open = false;
  }, { px: 24, primary: !!sug.length });
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
// Optional voice-over: put an MP3 at audio/narration-endo.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-endo.mp3', {
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
    let best = 'tree', ba = 0;
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
    // the story's endotype or gene carries over to the panels
    X.endo = -1; X.gene = -1;
    if (best === 'tree' && S.tree_focus > 0.5) X.endo = Math.round(S.tree_focus) - 1;
    if (best === 'syn' && S.syn_place > 0.5) X.endo = Math.round(S.syn_place) - 1;
    if (best === 'net' && S.net_gene >= 0 && S.net_hood > 0.5) X.gene = Math.round(S.net_gene);
    if (X.endo >= ED.endo.length) X.endo = -1;
    if (X.gene >= ED.M) X.gene = -1;
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    if (X.gene >= 0) $('#q').value = ED.genes[X.gene].sym;
    pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: no picked endotype or gene, nobody standing in the gap
    if (X.gap) setGap(false);
    X.endo = -1; X.gene = -1; NEXT.length = 0; pushState();
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
  // what explore mode asked to do once the sets show its pick (a flight to a gene)
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
    // #endo&explore&scene=syn&view=cleft (any control of a scene by its key), &endo=2, &gene=COLQ (or &q=...),
    // &k=20 (the Method tab's seed groups at that k), &step=1..5 or a step's name, &tab=genes, &inside (stand in the gap)
    const tv = optKey('tree', 'view', /meta|endo/i);
    if (hp.get('scene')) openScene(hp.get('scene'), false);
    else if (!hp.has('t')) { openScene('tree', false); if (tv) (X.ctl.tree = X.ctl.tree || {}).view = tv; }   // straight in: the endotype network
    orbit.cur = view(X.scene, 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    const s = GL.sets[X.scene];
    for (const c of s.controls || []) if (hp.get(c.key)) setCtl(X.scene, c.key, hp.get(c.key));
    if (!hp.get('scene') && !hp.has('t') && tv && camFor('tree', tv)) { orbit.cur = view('tree', camFor('tree', tv)); orbit.to = null; }
    // (the story's own key is the hash's first word, also 'endo': the endotype is the 'endo' with a value)
    const ev = hp.getAll('endo').filter(Boolean).pop();
    if (ev) {
      const v = ev, n = parseInt(v, 10), id = !isNaN(n) ? n : ED.endo.findIndex(e => e.name.toLowerCase().startsWith(v.toLowerCase()));
      if (id >= 0 && id < ED.endo.length) { showTab('endo'); selectEndo(id, false); flyToEndo(); }
    }
    if (hp.get('gene')) { const i = findGene(hp.get('gene')); if (i >= 0) { showTab('genes'); $('#q').value = ED.genes[i].sym; selectGene(i); } }
    if (hp.get('k')) { const j = ED.groups.findIndex(g => g.k === parseInt(hp.get('k'), 10)); if (j >= 0) { setK(j); X.step = 0; showTab('method'); showStep(0); } }
    if (hp.get('step')) {
      const v = hp.get('step'), n = parseInt(v, 10), j = !isNaN(n) ? n - 1 : METHOD.findIndex(m => m[0] === v.toLowerCase() || m[1].toLowerCase() === v.toLowerCase());
      if (j >= 0 && j < METHOD.length) { X.step = j; showTab('method'); showStep(j); }
    }
    if (hp.get('tab') && TABS.some(t => t[0] === hp.get('tab'))) showTab(hp.get('tab'));
    if (hp.get('q')) { $('#q').value = hp.get('q'); runQuery(hp.get('q')); }
    if (hp.has('inside')) setGap(true);
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
