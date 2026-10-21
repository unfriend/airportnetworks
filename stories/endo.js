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
const ENDO_DATA = {"facts":{"genes":18306,"links":316613,"seeds":35,"module":393,"found":358,"endotypes":12,"hood":184,"pct":1,"r":0.8,"terms":457,"annotated":389,"featLib":"GO_Cellular_Component_2026","nameLib":"Jensen_COMPARTMENTS"},"seeds":[["CHRNA1","Cholinergic receptor, nicotinic, alpha polypeptide 1","11.1"],["CHRNB1","Cholinergic receptor, nicotinic, beta 1 muscle","11.2"],["CHRND","Cholinergic receptor, nicotinic, delta","11.3"],["CHRNE","Cholinergic receptor, nicotinic, epsilon","11.4"],["COLQ","Acetylcholinesterase collagen-like tail subunit","11.12"],["CHAT","Choline acetyltransferase isoform","11.13"],["SYT2","Synaptotagmin II","11.14"],["AGRN","Agrin","11.16"],["MUSK","Muscle, skeletal, receptor tyrosine kinase","11.17"],["DOK7","Docking protein 7","11.18"],["RAPSN","Rapsyn","11.19"],["GFPT1","Glutamine-fructose-6-phosphate transaminase 1","11.20"],["DPAGT1","Dolichyl-phosphate (UDP-N-acetylglucosamine) N-acetylglucosaminephosphotransferase 1 (GlcNAc-1-P transferase)","11.21"],["ALG2","Alpha-1,3/1,6-mannosyltransferase","11.22"],["ALG14","UDP-N-acetylglucosaminyltransferase","11.23"],["SCN4A","Sodium channel, voltage-gated, type IV, alpha","11.24"],["LRP4","LDL receptor related protein 4","11.25"],["SNAP25","Synaptosome associated protein 25","11.26"],["COL13A1","Collagen type XIII alpha 1 chain","11.27"],["SLC5A7","Solute carrier family 5 (sodium/choline cotransporter), member 7","11.28"],["SLC18A3","Solute Carrier Family 18 (Vesicular Acetylcholine), Member 3","11.29"],["PREPL","Prolyl endopeptidase-like","11.30"],["SLC25A1","Solute carrier family 25 (mitochondrial carrier, citrate transporter), member 1","11.31"],["MYO9A","Myosin IXA","11.32"],["VAMP1","Vesicle associated membrane protein (synaptobrevin 1)","11.33"],["LAMB2","Laminin, beta 2 (laminin S)","11.34"],["CHRNG","Cholinergic receptor, nicotinic, gamma polypeptide","11.35"],["PLEC","Plectin","11.36"],["GMPPB","GDP-mannose pyrophosphorylase B","11.37"],["LAMA5","Laminin, Alpha 5","11.38"],["UNC13A","Unc-13 homolog A (C. elegans)","11.39"],["RPH3A","Rabphilin 3A","11.40"],["TOR1AIP1","Torsin A interacting protein 1","11.41"],["CHD8","Chromodomain Helicase DNA-Binding Protein 8","11.42"],["DES","Desmin","11.44"]],"endo":[{"id":0,"n":9,"name":"No shared place","term":"Translocon complex","p":0.12,"strong":0,"col":"#9aa3b5","place":"","seeds":["RAPSN"]},{"id":1,"n":29,"name":"Mitochondria","term":"Mitochondrial part","p":2.3e-11,"strong":2,"col":"#a98bea","place":"mito","seeds":["PREPL","SLC25A1"]},{"id":2,"n":47,"name":"Basement membrane","term":"Extracellular matrix component","p":4.8e-14,"strong":2,"col":"#3cc4e6","place":"lamina","seeds":["COLQ","AGRN","COL13A1","LAMB2","LAMA5"]},{"id":3,"n":26,"name":"Golgi","term":"Golgi membrane","p":0.0002,"strong":2,"col":"#34d1a8","place":"golgi","seeds":["CHRNE","DPAGT1","ALG14"]},{"id":4,"n":12,"name":"No shared place","term":"AP-2 adaptor complex","p":0.089,"strong":0,"col":"#c7d65a","place":"","seeds":["SLC18A3"]},{"id":5,"n":35,"name":"Ion channels","term":"Sodium channel complex","p":0.00081,"strong":2,"col":"#e3a03c","place":"channels","seeds":["CHRNB1","CHRND","SCN4A","TOR1AIP1"]},{"id":6,"n":13,"name":"ER membrane","term":"Bounding membrane of organelle","p":0.0015,"strong":2,"col":"#e2557a","place":"er","seeds":["VAMP1"]},{"id":7,"n":17,"name":"No shared place","term":"ATPase complex","p":0.2,"strong":0,"col":"#8f9bb0","place":"","seeds":["CHRNA1"]},{"id":8,"n":15,"name":"Endosomes","term":"Endosome","p":6.6e-10,"strong":2,"col":"#58d06a","place":"endosome","seeds":[]},{"id":9,"n":25,"name":"Vesicles","term":"Cytoplasmic vesicle","p":3.5e-06,"strong":2,"col":"#5d86f0","place":"vesicles","seeds":["SYT2","MUSK","ALG2","SNAP25","RPH3A"]},{"id":10,"n":34,"name":"Muscle scaffold","term":"Costamere","p":0.04,"strong":1,"col":"#f07b5a","place":"scaffold","seeds":["DOK7","SLC5A7","PLEC"]},{"id":11,"n":131,"name":"The junction","term":"Neuromuscular junction","p":0.053,"strong":1,"col":"#e070d0","place":"junction","seeds":["CHAT","GFPT1","LRP4","MYO9A","CHRNG","GMPPB","UNC13A","CHD8","DES"]}],"nodes":18306,"core":2000,"mod":393,"names":"DHRSX|C14ORF156|MRPL27|ZNF274|CKMT2|LBX2|ACSM3|GLDC|SLC25A1|AK2|PREPL|C13ORF27|PDHX|C4ORF26|ZNF556|DHODH|GFPT2|COQ4|C9ORF170|MTG2|PMPCA|UQCC2|TFAM|METTL20|SUCLA2|CRYZ|METTL2A|CARS2|DHRS4L2|IGSF5|GDF10|SMOC2|ZNF224|MMP19|SGTA|ADAMTS1|ELANE|FBLN5|LEPREL1|ZNF778|KRTAP5-3|ZNF563|COL7A1|FN1|ALG13|GLT25D1|VWA1|PLOD1|PLOD2|PLOD3|LAIR2|COLQ|COL13A1|GLT25D2|PARP4|CCL3L1|IGFL3|ADAMTSL4|TEX15|CCL3|TXNDC5|C1QTNF7|FAM55C|NID2|FGF4|BCAN|AGRN|PI15|CFC1|EDN3|LAMA5|LAMB2|C1ORF54|CBLN4|CRP|ELSPBP1|SNX20|HTT|MUSK|APPL1|CHP1|EHD3|ZFYVE20|MANSC1|RPH3A|SNAP25|STX19|SYT1|SYT2|C8ORF47|NCOA7|PLXDC2|TNFRSF10C|SLC29A4|TMEM184C|PDCD6IP|ALG2|PTPN23|SLC5A1|CD63|CD9|TSPAN1|TBC1D15|SGMS2|BNIP1|VAMP1|CNNM1|C9ORF167|LOC100507703|HLA-C|DNAJC16|SCNN1A|ADAM30|ROR2|RAB3A|RAB8B|RAB27A|RAB27B|RAB8A|LAMTOR1|CPLX1|VPS45|STX4|VAMP2|DNAJC13|SNX1|EHD1|EHD4|RAP1GDS1|ELOVL7|RNF24|MTCH2|SLC27A1|TLCD2|TSPAN31|MFSD1|TMEM186|C20ORF108|SLC18A3|MFF|SLC38A10|SCGB1C1|ITPRIP|S1PR5|ALG14|SAR1B|EEF1AKMT4-ECE2|SUN1|GPR126|MANEA|DPAGT1|TPST2|FZD6|ICAM4|UGT3A2|GALNT2|SCD5|CHST11|ST3GAL2|CSGALNACT2|EXTL2|METTL7B|MBTPS2|TMEM219|TUSC3|CHRNE|SGCB|GMPPA|PCDHA4|OLFML3|GML|CHRNA1|ADPGK|CD1E|ALG11|SLC5A9|RGS4|TNFSF18|ACPL2|ZDHHC7|ATP1B2|PI4K2B|OCA2|WLS|ZNF177|RAPSN|C10ORF35|LRP12|TMEM18|UBE2J1|ZDHHC6|FAM63A|FNDC3A|CYP2A13|EMD|TMEM80|FAM134C|SLC19A2|TMEM63B|DPY19L4|LPPR3|ABCC4|LRRC8A|PPM1L|RETSAT|FAM8A1|SLC27A3|PDZD8|CYB5R1|DNAJC18|ITPRIPL2|C1ORF43|FAM189B|CHRNB1|CHRND|SCN1B|SCN4A|SCN8A|HERPUD2|ASB11|TOR1AIP1|APOL2|SNX13|SYVN1|CCDC167|SEC11C|FADS3|POMT2|SLC9A5|ACRBP|KIAA1549|ITGB1BP1|FLT3|CSF1R|PIK3R2|BCAR1|CRK|DOK7|HSPA1B|SRCIN1|SYNM|MYLK3|SPRY2|TEK|PLEC|TRIM67|MYH7|AVIL|DQX1|RABEP2|KPTN|SLC5A7|SYT5|DRC9|CALM3|KCNN1|CDC37|EPHA10|EPHA5|MERTK|BLK|FOXA3|GALK1|BHMT2|WBP5|ZNF383|ZNF214|AGGF1|PRUNE|NEK10|EIF2D|HAUS7|GPSM2|WHRN|CHRNG|SRP9|SELPLG|CHAT|VWFP1|ALS2CR11|DIRAS2|DOC2A|UNC13B|DIRAS1|UNC13A|OSBPL2|SYNPR|CHP|SUN2|SEC14L1|SPPL2B|MFAP3|SMO|MVP|PPT1|LMTK3|ROS1|FAM169B|SHISA5|CD53|RAC2|ANXA7|C19ORF26|PODXL|FLT1|LRP4|TRIM68|DAG1|COL17A1|ERBB2IP|OBP2A|BVES|EPHA6|MYH1|C12ORF10|NOTCH2NL|PLEKHA6|SELS|DEFB123|HEMGN|COPS7A|UBE2F|GATA2|TBC1D4|GSDMC|AKR1C1|AKR1B10|ALOX12B|ALOX15B|MPP5|SPATA13|ZNF280A|MYO9A|PDCL2|POTEF|IFT57|ARHGAP36|SPATA17|ADSSL1|WHAMML1|DES|PPP1R13B|IFFO1|DUX1|KRT31|KRT34|PDDC1|CCT4|PEX7|GBA3|PDCL|ARHGEF38|TBCE|HSP90AB1|CCNB2|GMPPB|ANXA11|RBPMS|SYDE1|AKD1|IL20RA|TPMT|AKR1D1|GEMIN5|RG9MTD2|AFF3|DOC2B|CRY2|WT1|PHF15|INO80|LRTM2|HSF2|MAD2L1BP|TP63|ACHE|RPL21|RASGEF1A|CHD7|CHD8|CHP2|DUX4L9|SBK3|ZNF816|SIRT6|GFPT1|SYNE1|BRWD1|ENOSF1|ZNF296|ZNF423|ARL4C|ATG4C|ARMCX4|KRTAP10-3|ZNF34|ZNF621|CSN3|SPATS1|ZNF187|KRTAP5-1|MRAP|MSANTD3|ZNF248|ZNF584|PRMT3|SLC47A1|TMUB2|DKK3|ANKRD36B|IL37|SOCS6|TEP1|SHPK|GUSBP1|FAM69A|SH3GLB2|ZNF354C|FGD5|FZD8|TMEM59L|ZBTB33|ELAPOR1|PDE6H|C3ORF58|GPX8|LONRF3|TMEM101|COL18A1|KCMF1|CRYBA2|SERPINH1|OIT3|PUSL1|CCDC68|PAN2|EFEMP2|CWC27|TMEM62|XIRP1|ARHGAP10|RHOB|NEFM|LEPREL4|FNDC8|FBXO2|IMMP2L|CASK|CRB3|TMOD4|DNAJC30|RHOA|KRT8|TRIM9|EEF1DP3|WHSC1L1|CAMKV|FST|MNAT1|PID1|CRTAP|STX1A|ST3GAL4|PCNXL3|ATXN7|PREB|CISD2|AP3B1|TUSC2|LTBP1|NTN5|TMPO|LAPTM5|SDF2L1|TBCC|EIF2B5|STX1B|ZBBX|MDH2|RPS29|GHDC|LEMD2|DHRS2|CRYL1|PDGFRA|ATF6|C7ORF34|DST|KRT23|AAK1|GFI1B|CIMAP1D|SMG5|PLEKHS1|ABCA3|C4BPB|SIRPD|RBM46|SDHB|CCDC141|PAAT|ITGA6|GLT8D1|KLHL8|ABTB2|COL6A2|DPPA4|EMX2|TMEM35A|TGOLN2|DGUOK|OS9|FEZF1|ALG12|M1AP|MTM1|ITSN1|ESYT2|GOLPH3|COL6A1|ZZEF1|PRPF39|HID1|SLC30A8|GOLM1|KHDRBS1|LRRTM4|ST7|STAT3|KIAA1383|SQLE|CORO1A|CAND1|RAPGEF5|TMTC3|EPHA7|ZDHHC9|SAMD3|DNAJB9|BEX1|GLYCTK|HMGCL|TBL2|TTC17|SLC27A4|BCHE|AP3B2|GALNTL1|FAM98C|EPHA8|SLC30A7|CCNF|HERC1|CA10|NUP88|NACA|LEPRE1|ZNF74|ABCC10|LEPREL2|SNCA|PARP16|ATXN1|UBE4A|DPYS|PDE3A|ACAA2|PIGW|UNKL|RNF214|DYSF|C19ORF28|ZBTB7A|KRTAP8-1|WDR70|VEGFB|GPATCH2|C14ORF104|C17ORF62|CARM1|LRPAP1|ACADL|SIDT2|KRT73|TUBB2B|WASHC3|RFPL4B|SH3KBP1|CTNND1|SOST|FBLN1|TRIM7|MACF1|VLDLR|NME4|IL5RA|PYHIN1|SCGB2A2|NCR3|ST7L|LOC100507680|HSPA13|MAD2L1|ISLR|DNASE1L1|ZNF398|ABLIM2|MECOM|BPNT1|ZNF17|BOLL|UBR4|WDR20|NFATC2IP|TMEM131|MRM1|TAP2|P4HA1|HMOX2|SCGN|C1ORF52|RDH11|DFNA5|ZNF121|UNC45A|BCAM|HSPA8|TMEM66|TSR2|TMEM111|ROR1|ZMYM5|MFSD5|MFAP4|GPIHBP1|CD48|EDA|TMEM39A|LBX1|PRNP|KIAA1161|EPB41L5|STX3|CARD8|SLC44A1|MYC|RUSC1-AS1|ACOT7|PDIA5|TACSTD2|INS|PDPK1|ZNF331|ASB6|GALNT12|UBAC2|CRKL|KRT33B|TXN|CXORF66|FSTL4|TSG101|LILRA5|MSTN|BTLA|C8ORF48|SDCCAG8|KRTAP19-6|CHMP7|KRT78|SLURP1|CLDN4|CLCN3|KIF5B|BMPR2|CUX1|NMU|TMEM30A|PRKAR2A|MAGT1|FAM162A|TMEM63A|MAP1A|ZNF330|SPATA22|KANK1|SLC27A2|ZFP41|PARK2|KIF1C|TYW3|DNAJC10|SLC12A9|SLC15A4|FBLN2|LYPD6B|TMEM57|AMBRA1|SCAPER|CHD9|STON2|EPHX1|VSIG4|NOL4|ALDH18A1|TMEM201|YBEY|KLHL15|GTPBP5|CHRNA5|GGH|USF1|NUFIP1|PNPLA6|CSPG5|WDR55|UBE2R2|ANK3|ATP5IF1|SNAPIN|FAM210B|KPNA5|DYRK1A|AQP10|TGFBR2|KRT222|P4HB|MFAP5|ZNF707|TAP1|CRISP2|SLC22A4|SELT|BRPF3|GXYLT1|ID1|ZNF669|SKAP1|GOLGA8G|TUFM|LEMD3|ODF2|HMGCR|KIAA1429|ZDHHC17|NIPSNAP3A|HSPB2|PPP2R2B|CHCHD4|EIF2AK3|BET1|CAPN2|FCER1G|HADHA|CEP76|RGR|BRPF1|CUL3|GBF1|IKZF5|ALG9|CTSS|PARP11|UBE2Q1|UBE3A|NAP1L3|CAPN3|PLD6|CT55|LY86|POM121|KIAA0528|EXTL3|KRT2|SPPL3|CD274|DHRS7|IGF2BP2|SLC25A48|RSPH6A|C16ORF79|ATP1A3|GLRB|ERC1|WNK1|KPNA6|MRPL21|SGTB|FIBP|GPM6A|MRPL41|RTF1|EDDM3B|ERGIC2|GFOD1|KRT14|CMTM3|LPHN1|TOR1A|VASP|PMPCB|PKD2|NBL1|MNS1|SREBF2|MAD2L2|MCAT|FTSJ2|SLC35A4|GP1BB|RNF208|TCP1|IFT46|C10ORF58|NCF1|SIN3B|C2CD4B|MAX|PIGO|THSD7B|NFKBIL1|ZSCAN21|MGAT5|RAF1|B4GALT7|C1QB|APBA2|CT45A5|NAT14|TRGV3|PRG2|CA6|SLC12A4|HSD17B12|NXPH3|DUX4|GPATCH8|KCNA2|CYB5R3|ARGLU1|IGF2BP1|AK4|MRPL10|PIGU|SPATA24|SMG7|SPATA12|CDC42|DNAJC1|KRTAP9-3|SOAT1|MTHFR|SNAP29|LIPG|CCDC92|TSHR|STX11|MIER1|NES|TUBB2A|EAF2|NAA15|NDUFS6|CST9L|ASH2L|ANTXR1|INA|HSPD1|KIAA2013|VIM|ZNF829|FAM83A|KRT39|ITGB4|CTDP1|POLR1C|PPP4R1L|GATA3|NSF|PSME1|AGTRAP|FAM24B|C15ORF24|EXOG|ELOVL4|TMEM85|UGT8|BOD1|OPTN|RETREG3|SBDS|LEO1|BRD2|FZD2|FAM124B|EGFR|TSPAN6|RBBP5|KRT20|TP53BP1|TERF2IP|SLC29A1|SPTAN1|DACH1|RHBDD1|KRTAP12-3|NEUROG3|STAM|GAN|SQSTM1|MIIP|SLMAP|RPN2|RPN1|SULF2|PLPP4|ACE2|PIGN|KASH5|UBL4A|FIBIN|C1ORF190|GPRC5B|DSP|MRPS34|CDHR4|SLC7A1|RNF5|ELL2|VAMP5|BEND7|DIEXF|MAGED1|LYZL2|MRPS17|MAOB|BTN2A2|GPAA1|REEP4|IL12RB1|KRT18|CDC34|FITM2|PLCD3|RPL34|TEPSIN|VAMP3|PLAUR|NAPB|FCGRT|AGPAT4|YAF2|CST11|CFTR|SLC35A1|RTN1|CENPB|KRTAP1-3|TMEM229B|EZH2|CCT2|MRFAP1L1|CLGN|UQCRFS1|NCAPH2|UXS1|SELENBP1|SYNC|ARL13B|TMPPE|C6ORF141|NDUFS7|TOP3B|HSPA2|PTPRK|BRD3|KRT13|KIF14|GJA1|MRPS25|MLLT1|FOSL1|SGK196|EIF2B3|DCAF16|VPS11|MAP4K4|UBE2A|AIFM1|IGLL5|KRT16|AFF4|YIF1A|CWC22|TSPAN33|FA2H|DPF1|KRTAP1-1|CDC16|MADD|CEACAM8|SPRY4|RCOR1|ZNF408|ORMDL3|PPP1R16A|ASCL4|TRIM52|ALPP|KRTAP5-9|SMC3|ITGAM|CDC73|MRPS24|C22ORF39|CUL7|BRCA2|KRTAP10-9|RLN1|FAHD1|TCAP|NOTCH2NLC|ESRP1|SCN3B|TTYH1|GPR89A|TMX2|IGF2BP3|STK4|GPR152|ACTG1|MIP|ADNP|SETD1A|NAF1|ZNF655|SLC31A1|SF3B3|PRPH|MLLT3|BNIP2|EIF2B1|DCAF8|PPM1G|YARS2|PSMC3|PTCH1|ISCA2|ISG15|CTR9|JUNB|ATG9A|H2AFZ|ZNF444|MRPL12|TMEM25|ERN1|CLEC11A|PIH1D2|LYPD4|FBXO6|POLR2G|C18ORF25|EBP|IDS|LDLRAD1|TMEM107|ELAVL2|PAF1|SEC62|KRTAP10-7|PNKP|GABPB1|CBX4|TADA3|SPRED2|NOLC1|KLHL22|CHST8|KRT38|EIF2B2|BOP1|CREB3L1|PPP1R18|YY1|SSSCA1|PIP4K2C|KPNA2|TMEM87A|GPBP1L1|CENPH|DCAF5|FXR1|TSNAX|CEBPA|FAM9A|PPP1CA|ACTC1|PTDSS1|UBXN7|ANKRD17|CTCF|CDS2|CDK9|RBM25|LMNA|FUNDC2|PPP1CC|ERGIC3|EIF2B4|COPS4|C1ORF216|AP2M1|C1QBP|BAHD1|KLC3|BAIAP2|LASS2|TSPO2|NOTCH2NLA|PFDN5|TFPT|COPS7B|MRPS5|KRT37|RANBP10|FAM120A|THAP3|PSMD14|KEAP1|BAG5|LGALS1|PMP22|CREB3|PTPN1|CD97|CYLD|PIAS2|CHEK2|BTNL2|TSC22D4|LENG1|MLH1|PSME3|VAMP4|TENT5B|ERMP1|PPL|TMEM14B|KLK15|RAD18|PNMA2|NEFL|KRTAP10-8|LATS1|TRIM69|SYCE1|KPNA1|HDGFRP2|AQP6|AHCYL2|SNW1|YIPF3|KRT19|KMO|CWF19L2|OR2A4|DDX39B|IQUB|TF|MDFI|TCEA2|CSNK2B|AURKB|RALBP1|CANX|ZC2HC1C|LASS6|LMO4|FBXW11|U2AF2|VTI1B|COPS2|LAT|ARIH1|KRT75|FUS|UBQLN2|MAP1LC3B|UBXN6|NOTCH2|YES1|LZTS2|GOT1|LENG8|JMJD6|CYSRT1|KRT15|SPANXN2|NDEL1|SFN|ACTA2|NEK6|EHHADH|ARRB2|RAC1|COPS6|TSPAN15|KCTD17|DDX6|UBE2O|AHCYL1|STX17|PDE4DIP|RPL10|WDR5|AR|MEOX2|COPS3|HSPA4|GFAP|KRT40|FGFR1|LASP1|RNF4|DVL2|RPS10|JPH3|CTNNB1|MALL|ACTB|CUL4A|HSPA5|AGR2|GOLGA6L9|COPS5|CUL4B|RELA|TFIP11|SIRT1|PRPF40A|NPM1|STUB1|RPL31|BRD4|TRAF2|APP|OR6A2|YWHAQ|ANLN|HSP90AA1|CDH13|FGFR3|CHRNA4|MAP7D2|CHRNB2|KIAA0586|MIPEP|HTR3A|OR51E1|NKAIN1|C2CD2|GPR98|MOBKL1B|CHRNA3|COL23A1|SORL1|COL4A4|PRKACB|DUX3|GSN|HTR3C|C3ORF52|KLK6|DKFZP686O24166|MC2R|CHRNB4|ZDHHC12|HFE|COL21A1|COL5A2|COL6A3|EMID2|CX3CR1|KIAA1598|ZNF559|LAMA1|GPR182|COL9A3|C12ORF52|OR6B1|COL4A2|COL4A1|OR10H2|OR10A4|OR7A5|SYTL3|RXFP1|COL8A2|SYTL1|UBQLN1|OR2G6|COL4A6|GRIN2C|ADAMTS7|TDRD10|COL16A1|GABRA3|LRP1B|SRI|CLEC12B|METRNL|C1QTNF1|GALNTL4|MYRIP|ARSK|MPPE1|GP9|ZNF786|IL17RA|HTR3B|FCN1|CLRN2|ST14|KLRC2|MARCH4|BMP1|PIGH|SEMA3B|PCSK6|LAMP3|DHRS4L1|ZNRF4|C1QTNF9B|MCOLN3|JAG2|SEMA3C|LDLR|MTIF2|COL12A1|TMEM169|CD70|SLC39A4|TCTN2|LGALS9|LAMB1|GUSB|MMUT|PCSK9|LOXL2|LTBP4|SCARA3|COLEC11|LRRC55|GBA|IDUA|FZD1|SLC22A9|VWDE|ZBED2|HCST|SYTL2|NCEH1|TMEM59|SLC4A8|LAMB3|MAN2B1|SPRED1|MAN2B2|ITGA7|KLRC3|CNTNAP3B|LAMC1|ZNF507|TRIM28|LGALS3|GPR114|SYTL4|FGFR4|FGF14|CNTNAP3|PIP4K2A|SCAP|TRIM39|TRMT12|FRAS1|SV2B|FSHR|CCNDBP1|C14ORF80|HRAS|CADM3|SLC39A12|MIA3|CILP2|NAGLU|TMPRSS12|PCDHB1|TMEM106A|ZFPL1|NRSN1|GPR21|CHRNA9|LGALS8|OLFM2|CRELD1|SLC23A2|COLEC10|NOTCH3|APOM|CASP6|LNPK|LRP5|HLA-F|ZNF365|THBS1|ENO1|DPM2|POGLUT1|ACCN4|LRP6|PLPP6|CNGA4|RAN|CHPF2|MYCBP2|LRP2|C1QTNF8|MUT|CRELD2|ZACN|LY6G5C|EDEM3|GDF11|HLA-DQA1|TVP23B|COL9A2|CEP70|HPN|NUDT8|KCNK16|PCDHGC4|RACK1|DGCR2|MARCO|GALNT15|COL14A1|TRIP13|APLP2|TOR3A|C3ORF64|KCNS3|TMEM9B|SYTL5|NAAA|PLXNA1|STXBP1|SLC7A14|MS4A15|PLEKHM3|PLTP|GABRD|C5ORF34|PON2|COL1A1|THSD4|CD3D|TUBB8|GRN|PSCA|KRIT1|TP53|PBXIP1|NPTN|SNAP23|TOR1B|CHRNA10|NIPAL1|WNT5A|CERCAM|LAMA4|CLEC4E|MMP2|FCER1A|TRPC4AP|KIF1B|PCDHB3|TMEM132A|COL2A1|ZNF432|TMEM2|PTCHD3|PRSS23|OR1D4|SFTPC|ATRN|VNN2|GNPTG|CHST12|QSOX1|MEGF8|ADAM9|OAF|MRAP2|GGPS1|CSPG4|GALNS|SLC2A2|C22ORF32|ART5|KLHDC2|MLPH|LRRC52|DARS2|STX12|PRF1|HSPG2|LRP3|CHRD|CRTC3|FBN2|TTC13|METRN|MAN2A2|COL5A1|CELSR1|ATF6B|DOLK|KIAA1715|MYO5C|CDH5|CTBS|TSPAN17|PCDHGA5|PCDHGC5|KREMEN2|KIR2DS3|SPAG9|PCDHB11|BTNL3|CHM|NMRK2|PCDHB7|COL25A1|KDELC1|ACP5|HLA-DRA|LPPR1|LPAR2|CNTNAP1|ATP2B2|EFEMP1|H6PD|TMEM95|FUT11|CHML|HLA-G|TIMP3|C6ORF154|GGT7|ANKS3|PCDHGB4|C1QTNF3|SLC17A2|SNX16|CACNA2D2|PLXNA3|LAMP2|VAPB|GJA8|ECEL1|ENTPD2|TMED6|GYPB|GRB2|MTHFS|VAPA|ADIPOQ|KCNE3|MESDC1|GPR37L1|HYAL2|LCTL|CNPY3|EXT2|CXCL6|ST8SIA6|SERPINC1|APBB2|CNIH1|PTPRU|KLRD1|PDIA4|CLEC2B|KLF11|CHST5|NUDT19|ITM2C|VCP|SLC22A15|CHID1|PTGIR|ABCA2|ABHD14A|GPR56|FOXRED2|EMR4P|HARS2|C1QTNF9|LPAR1|ARLN|CACNA1C|LARS2|KIAA0090|STX7|RNF11|NOTCH1|CD79A|POLG|BMP8A|LYG2|LAMA3|HSPA1A|FFAR1|LRFN3|CLEC2D|LY6G5B|IQGAP3|MBTPS1|C11ORF87|SDHC|HSPB1|FAM209A|CD3E|FAM189A2|TMPRSS13|PCDHB6|PCDHAC1|COL4A5|PLAU|KLRC4|HS3ST1|ITGB1|COTL1|GABRA6|VIPAR|ADSS|TGFB1|CD1A|WFS1|MANBA|ATP2A3|RTP2|ADRB2|SCGB1D4|DPYSL3|C1QL1|SYN3|ZNF740|LRP1|KTN1|C1QTNF2|SPOCK2|CD79B|EXT1|MATN2|ALX3|ARMC1|KCNMB3|RBM8A|TMEM254|P4HTM|BSCL2|NIPA1|BTC|ADAMTS2|CTSA|BORCS7|ZNF22-AS1|CMTM5|CHST6|C3ORF32|ARSB|LPAR3|COL10A1|TNFRSF6B|SERF1B|PROS1|CPLX2|CACNA2D1|B4GALT3|KBTBD2|TP53BP2|GALNT10|SAAL1|FGF12|UQCC1|FADS2|PLXNA2|LRRTM1|CRYAA|GAS6|GPC3|CHST14|EIF2AK4|IL17RB|PAM|SEMA4B|SEL1L|RFWD2|IL22RA1|C1QA|EDEM2|PALM2|KRBA1|CPS1|OR10H1|TMEM176A|OR4N2|DLD|CHST3|C9ORF91|NUP58|DISC1|SRC|TSPAN18|EMILIN2|B4GALT4|CRIP3|SEMA6B|GOLGA2|MMAB|UNC13D|TAS1R2|BAG6|GDF15|GEN1|KLRC1|AIM1|MFI2|VMA22|NID1|ACYP2|CHST10|TMPRSS3|RYK|ADAM21|LOC81691|HLA-DPA1|IL13RA2|TMEM14C|SLC28A2|ADAM10|LMX1B|C21ORF63|STX2|CYP19A1|BMP4|TUBA4A|SCN9A|PEAK1|VAC14|ADAM33|GOLPH3L|TMEM67|MAP7|TUBB|PRKAB2|WWOX|C3AR1|PGRMC2|PPOX|CACNB4|DNAJB6|APPBP2|MCCC1|PXDN|SEL1L3|LRRC23|GALNT7|NARS2|B3GNT1|NAGA|IL17RC|CRLF1|TLR9|STXBP5|TUBA1A|UGT1A7|C15ORF32|PILRA|PLCD4|TARDBP|CX3CL1|NTN1|BAG2|C16ORF55|KLHL2|HLA-DRB1|TTN|TRMT2A|RPH3AL|ANKRD46|PCDHAC2|EIF2S3|CREB5|CLSTN1|UBC|ADCY9|CD1D|TNFSF8|NEB|CRYGS|SLC22A2|IGF1R|MYO9B|CGREF1|KDELC2|DESI1|CBX5|ARL6IP1|NOMO1|INSR|SDHD|SPINT2|SGCA|TMEM31|SEMA6A|EPPK1|MAGEA9|PIK3R3|PRR14L|KIAA1199|GPC4|PCDHB16|FATE1|KRTAP10-5|HS6ST2|SLC1A1|PTPRN|PCSK5|C19ORF46|UGGT2|ERLEC1|SEPN1|SYP|TRIM27|EPB41L3|IPPK|TMEM42|RAMP3|CTSF|ACAD10|ARHGEF18|NEDD4|TLL2|AQP9|AP3S1|GYLTL1B|ZNF195|MYST2|SDC2|RNF14|CLSTN3|TEX264|EXOC8|FYN|KCNA5|TOP3A|NAGPA|COL3A1|PCDHGB5|SEMA4G|RPL23|SLC39A8|BCL2L13|CST8|GDI2|COL8A1|LYZL1|VWCE|TMEM86B|CEP55|ACRV1|HSP90B1|EAF1|DNALI1|FBXW5|SYT12|SOD1|SMCO4|TMEM179B|KCNK18|DBT|ASPH|LMAN2L|SRPRB|LTBP2|GIPC1|YAP1|TMEM63C|KCNA10|TRARG1|NTM|LMF2|PRPS2|UPK2|CAV1|PTCH2|HRG|TMEM243|BMP8B|STX8|AQP3|MTHFD2|SULF1|CSK|PRPS1|ADAMTS13|GLG1|MDK|CBWD1|YWHAG|BDNF|CMYA5|CHSY3|YIPF6|PIK3R1|MGRN1|ACOT9|SGSH|TMPRSS11B|SNAPC5|VAMP8|NPTX1|STX5|BTNL8|DPP4|PLXNB2|SERBP1|GABRE|STX6|TACR1|TMEM237|KIF1A|C1GALT1C1|HNRNPH2|PUS1|MGST3|VCAN|RUFY3|FKBP14|EPHB4|MYOM2|NPPA|TAF2|MAN1A1|ADAD2|HEPACAM2|DALRD3|HLA-E|SERPINA12|ASPHD2|ZNF521|COLEC12|SRR|TAZ|ACSF3|TCEANC2|STIM1|ATP2A1|MRPS36|ESR1|NXPH4|UBIAD1|GOSR2|CCK|MET|SGPL1|CCR6|BGLAP|TRDN|CTAGE5|PSG9|MTO1|TMED7|TM4SF19|CYP26B1|PDCD6|AVPR2|DNM2|LGR4|TMEM116|CYCS|IPO13|YWHAE|TMLHE|SLC30A2|PRRC2B|STXBP2","gene":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkGBgYGBgYGBgYGBgYGCAgICAgICAgICAgICAgIBAQEBAQEBAQEBAQEAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMHBwcHBwcHBwcHBwcHBwcHBwAAAAAAAAAAAAUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsL","seedOf":"AAAAAAAAAAAXABYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABRMAAAAAAAAAAAAAAAAACAAAAB4aAAAAAAAACQAAAAAAIBIAAAcAAAAAAAAADgAAAAAAAAAAGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFQAAAAAADwAAAAAADQAAAAAAAAAAAAAAAAAABAAAAAAAAQAAAAAAAAAAAAAAAAALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgMAEAAAACEAAAAAAAAAAAAAAAAAAAAACgAAAAAAABwAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAABsAAAYAAAAAAAAfAAAAAAAAAAAAAAAAAAAAAAAAAAARAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAACMAAAAAAAAAAAAAAAAAAB0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAACIAAAAAAAwAAAAAAAAA","pos":"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","heat":"X6NQeWSuqV//o/+4pKerrbBfpqWoqmWlba6oQaqqs3Okb5SlXaSqq1qqr6Nsrqi0prO5//+1rquvkrCjpaWmsKqr/6mmp///pKatqXGq/7E1bLZu//+qp/9mc2ClXV2l/6Zap2e0mK6l/65bV52mqaljqKuqsqelsWmmqamZZmlqqKVnpG2qY2lo/6qnpqWm/2NWaK2v/6eqqqlxrKq2bGpVZLCr/6WpbcWk/7KwY12oaqZbYKOyqaj/YK2lcaCjZVhtamVipKeqbaOmpaeap6erq6ij//+k/7JhRv+naKi3sbKrcaS/slZZqaqj/6GspFSaVf+lZ2WmbqT/plqnV5hgW1pqqUkucKOppqu4tqlksv+tLv+3UXd2fMX/r7o4cc6mraWlplZbxLSkb7dhpGT/o7J3p1lWV2thpzaqpGWQNqRZsjxSp66ndlH/NaNnqVKrXv9pcbKOmalcYHxZpXCYpv+tka6tb1x3U7Wmt1yZpm67oKeluaWwo/8zqF2mpv+1pzKksW6jxbaurKurq6qqqqqqpqampqWlpKSko6Ojo6Ojo6OioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoJ+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2cnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5qampqampqampqampqampqampqampqampqampqampqampqampmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pjo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6OjY2NjY2NjY2NjY2NjY2NjY2NjY2MjIyMjIyMjIyMjIyMjIyMjIyMi4uLi4uLi4uLi4uLi4uLioqKioqKioqKiYmJiYmJiIiIiIiHh4eHh4aGhoaGhYWEhIOCgoKCgoCAgH9+fn59fHx7e3t7e3p6enl5eXh4eHh4eHh3d3d3d3d3dnZ2dnZ2dnZ2dnZ2dXV1dXV1dHR0dHR0dHR0dHRzc3Nzc3Nzc3Nzc3Nzc3NycnJycnJycnJycnJycnJxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFwcHBwcHBwcHBwcHBwcHBwcHBvb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbWxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2trampqampqampqampqampqampqampqampqampqampqampqampqampqampqampqamlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGdnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2ZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRUSDxfWkBdTCUZA1pBTEZPSEZXWkVHJUxWVkBMED4qS0UgJzpWDgFJSkFLS0E7NDgkTzAXAEgZTVFZSVdcVTtJAChKVlRaGkxdWj87Vg1RQFVCHk9eWRZbVlBQSVI2GllHO09TYzpJFSswWi05IEBLIFE6WCk6RlVND042HBwhVSgoJBlZGGQsMisqSSYqDSQ1RhJEQksSU0wUUGM9VFZIPSQROU5OGT9cUkhSUh4oEQ5KW2JVVj1ORU1cUDZLUEdBQhdLS1lMVTRHQUpaTlVaNWRHQ0ksBlE3TVtUV2AuTzlZPC5KUiYlSkg/KCxCTFpYNQkPSFYYB1IxYTUrS0tGDyMPAD8bXyUxNzE6FQASIRJKRlYPSlhYWRILYQBEI09XTRAkGQYlOksOHUElFkYKUE8ADzZFRUlBLQBCLFwUHgBaNCEyJlRNRkkdEU5LSzpSSj5HO0hTJCtgVVNQVU0VO0c0US5aJlFKFVRVXSZaUVoFTC0xUzlDIi1DTyNkVD5PVk9UTFpKSlAeUUEATy9cVExIURhVSjpNVk1SS1o3GDcUH1EnKkdDITMqR1JeKV9RPkBZDVJKP11TT0hCQkFVT1tbVz85NyA1Vx01VlMpVlRNVWEhHwAnNDxJPSZeTj9VRlRLI1ZjWF5FJjooPUtSNyRRCis2QkocYQ5bVT9cS1EAGFlVVw9MN2E6KR1UKhA3YlVCUjc3QFVOU0FcTUEiTFArHz4OQBhSYE1FQ0BQLxRBVEA1Qjo/Rz5MGUQyVUU/GRQGUjgQTElGVSwdA0Y6HhJASGMYUVERR0pEJE1IVCxKNggFGU9ePx1JGTs+YDxcJkpKUgdNTT5RGlg2NVISDlQ/SEhYRUcIQlBfH1pEUFJESz40XUdjXF1jXFc5PkcaHQcAME9SS11GV2ExJyRGQkpTQTJNTCktN10zRlFDWTlOTSMZQj5RNhomP0VhVGFMJzAUUwVEJEJUQUZbU1RfRQtGOFpOM08FNFA3RTtLSU1OT1teUVlNUApMHlg8PDZfNk1RVDU7Ll1OSg5BXTxLSBYXVUI6SQkiQklCRU5OQlFHM00+FlFAVyVJHRw9QEtPRUUvUVJHNz1AR05ZTEsAMERSLCERHVNSRUs9FEBDGzwgT0JQUk08UR07SF5WX0kvF0xETB5IPlQpUklERkkhPTkcFykbP2FRHk0fEmQaVFpbHkM4SVsuWloZDzkwUEJaKSs5Qls1FyZZPT9ATT8vTE9JTUxNVl5KJQ0fVD8VR0ZDQUImLABhEDtRGWMUQT8VJEdOKlpCNldfUzxKMVw2VFNWTFRRI0U+O0RSWxpBXz9HS11OTjcJTGM2P1EaThkLAC1QJ1NUH0ZMWllYWFxdUipeXmFNV1VQV00mXCxeWlJYIlg/Ti1KRUEpT1JASj9BJEJBPx0eWEQZNU4pCx5PVVpXK1NcTkpQRVVTO15AKCMtOkgRU0U8UE1UTlBGTR1jWDFPMUggSChFXE1VUl0XTElbGFZLVExLQEEYDU1OAGBCHktGXU5hJkQOVWBTXCdFUllbJjxcZGMnE1JMNxlbP1RQXFlcWBksLC1NPRc6RV45RUlUY18ZWSM5GD1KUgBMIk9CIV1PTRETQElLX0BSSUozMABQPE82H0E8N1EgTERYVEdXNmRGUkUfW0xfTTpRWCJYNExUSkZQOU1KP0tEQzBRFFtAW05JRSVCUw4AWB5NKQIjSBY+WFEoUSZSYDxCRA0QQlwSBi9XVUVSRzRdXS9JT0NPYEg/NEROEk9NQ0tSOBk6WjhJWDMnGkdjWh9MRi1DXTxRTz1GSBZhPEIhQlhRNElEJkJUSjEZRjALVSpLPUpEEAwbOzBXRQJTLUdcS1BNQ0lAOzUlN1tSMF47VlFJTFE0IxgwSSBXRFtCYiI+XDRWAA4MUExXOTlWT1haJS8pHlMuV0lZXEteX09XUTgAN1MeN05cYjQrACZXNFBLDGAoV1JLQz8dJRsVXRo2HE9RTRlGOzlRRxYFMiQtVRtFMyMtPlVGGisiBEQ9QjsxJhEWR1Y/OxxOGV47Gj1jS1oZUCcfWA8UUDlOSUAlHExOADsxF0NPKQ8/GjEbUEocMDZBRTQSLDIgQBxbKEAfYBhEAEcZNCcMUVBZGUgaEE4uEjUmPD5jPgowG1dITBkhFEg9GkgVXBgcPhtkFRdVTw4wPjVIIlJPCD1VXkJDM1JJKFIXE0o8AEE+WFYTCgAMFklOV1VTW1BAMEtTOgs/K0IxVxQvIT0SVjpgWz9MRDldSlo7Y1NVGidIG1AcTBg+EwALThQ8KCwxTgcnRVIgLz0rOU1fFRI1UFRRAENDHx4/ISATJkwyTR5LIFJPYCBkREpkI0pDXTwYWSFOQyASTikPLAlMQTdQHVJLTQAlT0NJJFs2VE0vTD1JTFUTQCIhOg1CDkkqU0IPWUlGVyJAVBpQNjc6XCY9JB4JIWFFGEQFAABMHUQuQDEZOBFVSllKN18uVF8tREdAQkgsUkZkI1ZMNSNDXgtbSSlUCk8jHBUfUFc4YEwqPDtJHB03LShaGR1CXAwpRSBLLDUqKiw8AAVFCFJOLRosOitDSjszSSMlPj9XFTUeVSdDUB0xRUcyH1ZEYBwzSwhhTA8EJTxDVBw3SCEpRlQaBTI+HzsgTU0kE0ZJJEFBOB1NClY2DBA4JTASGTs9DjYNEgtTJB4+TlI6DzhSUzk7DSwYVEYHWlc3Fk0ORVcgPUo8RDobPCpMLkotLmA1SCAiIVFLETpGSTFcTylRIVkaTB5CXVAVFABHDDJQRR0/Vk5JSzRbMCE4M0xNR1JVFUZLWjA0YlYgI1grRQUbWUVVVh9HXlFgEk9UM2FdWFcaMEtSPFoeR0kpK1JPSVxQT01aXjpUHDwSLz8iTldRMUo/TktXVUMvGBETARBiHlNBT0oyVk5YTBRXGkEsCVA1ShsKTEM+LSBPKSFOHxk0S0hcAEorO01RWUwjSRxMI0dbQGJZSj5BRU0/U11FXiYcWFBYWjRXSVY/RyxKVkdSLjNYXlVTSx9cYkJCCiVAG1JCR04/YkQ5GzZFXEVJTkwnUjlBR0RNKVJBACRPPBVcUkoRNhQHNz1DQyhVQFJHTR5SVicVL18kIEcfP00sTF9KS0w/SlIIR1scHgVKSl0mSUxCYg4YS0A3CkxMVgU7GipRXU03TGFNRUhUHCY2VCVdNFJbWEUwGhIAY1FOLU07PDg/XR4ABjQsRFdVOzldITJSRSgNEDhGWUkZUks7TDg7UCNXGTlIPFZjUEkWVlE2S0pcYAYbHBlaFQtJWhw3OFxfXlBgV09MDk1VVGJcNj8nB0kqYjZER1ATSUwnWi5VRStUSTVaQThMXSwMR0FVVE5SNUsnTkNPVRhbOUMhMlsuVFxQS1JJUkZbOUoAHDRXRzpHVj4TFEMjRVtJWUQ/Qk5XVDxRVkNdNjZTQkA8R1hQT0tLSEZDV1pdLmAxPj5MYy9QSVUTYEovNTVVNShDX1chPmJWS1FTPEQ5TjZWTj1ZSz49SUtbSxReUEhHWEVTOxNLJzxVWlBRR0wrQFdEEiQuQiBcUzABJBpZWzo8TC00Rh1PNztWYkAUSCNRIzdGNjI5WTBXTktPJxFgIUgTYVYmSxdWSi8xRldAT08zXT04RlVCLzxjMRUwSjYjSU9PSk8vY1k8RFFNCVNaHU8bR0RRT145VFM9KyBNP1c0Xl1DDT5FW2M/PUtEPVE8W0AQShQjMRZVECERJBwRJwAbEkMeJTktAAtDHxkGQSNYWCdgXl0lWVQ4U1oRBEQeWUIhWxkdQhtAP0ULO1RBUEM/OwBCOVJUXD0UXU1TLiQ2PjBaQVcnKQlSQVMmSUEjSmJRS0ocLkdHWUhcTTtGUCgNYVJPHVA8MV05YkUiRlAmVUdBEywnVlZcOhtPI1VFLj0RLjFWH0cxEVs3MERJWVBORkZSTkoKR0FgUUkmWCxIUQZWWUA8T0ciI0AmTmNWTydHMx0jWkZaTyolCCBfTldHQVtYT1JXQEVSTFEwRlFiU08xOUlCVhVMQVo0LBdVVVI5Tz9RUUogQkBIVVIcUzBFTlZgOWNXU09DOUNVXGFNLmNNIioXOiZRUkFhQhBLV0o6OUlOVkU7FjxkYgk/NVhRTlhEOF8rSD9KMmFLMFBTOlBRIkhOT08SWUhfUxxNTUhEMRdZOh9UGRRIRAUsAEUcRABJRjUqYU5EVD9WXU9MVRREMxlJFBEuDVhjPEIxPEcTQDVPIjY6S1RgPFNbYFdKUU0bUxA0LAwkWUpOKl1XTEtVPSJHTlw/GTMkOkdHNwBDWRlOSVo2TTtLEUQuQzoaIiNJVU5IWDACVURSVS1VVlIeEkckL141OERMSCtANFZFRUEhRERQPFQhX1tWQRtMTEpWOQ0yODVQSyMnOGBBVEBVVkJgOVwdQkNVJ0JOXRo1JS9WChkkOFBkURJeP1BXTzVDGSksWz9dPEgiOkkiUCBONE1OLzwVOEUqVVdIRB5JMCE/UFUoRhEHWDBTL2BQR1BTYV0ePj5DOzpiSUJUMFVQTklXTztFRlNRXzs7M0kWIWAzLC4sVFVZQUBWRyBDUUsxYithWVZbR1NNJRYVVEM/SF5fOVkrVVhbVjBgACoWP0pUP0xZWFVhCEIyXWFYSwZGSEg0QT0NRi8SGyUhXgAdKF0TRCYwJWETJD5YAgpJWVEXW0NDIDlOEgBhE1tNM1ZKYldiAFApYFNISUAXQBwGID8mKkJgKg4IFSRaIjI7ABlLQyNaADE3Q1U6BSBfPhYrBQtPEkxaRQAhSRBJGDpLPDZBLiViAEBOW0o6SUIwRVlBVzgYHwgMVjYSO1BPSxpcTUVFQ1hAP0I9XRdVGBdJCi4AQTpEVz4cRE5FSllMSV9RTE1NTUpiW0YcSUAaRVBbDxY1SCdOSEZaBF5GU15PWFRYVEBNIlxPS0xPWDJWIUVbVTRDVDtCNFE/XksHXU5QU0k6WkUiUEVWXFdJTUcyPENVREpQUEpDRkpJSF1NMFEWS1BLRhNHEUcUUkQrGlE9Rl9eSkc+UToqJjdRGVAhX0UZCFtFDVhbFAZQSFUWIR9TVEs5ZCtAPUIUGk1AXlQTQTpMXVo5PVhMPioxHFEiVUsfRD8cXDxFQRFPTBhVVyVVWhViYGBfDzxTS19MYiJVTjRMTTwfRUU6T1tJHkBTQlRPVUxNQCoaR1dERU4ERUdOJRNUPUwpOVRQWWAmFAtXQ0BRSUtJN1JBXFhTJxpYIRlNHzs0E1knVV0fSQJSU0RRIlMSRFBFUVQFOy8aBi4zUgBAUUonHgAQRgADNUREFE1YWEtbVlcwUU0vW0YhQGBNMj9CUUk/ORdONxoiYkhfVUJQWUZYSz5EOkBDChVRXFtTV05NSEA/HEdLRFouOFkpNlVNTTpGHV1bWVE3OUBAFUxGM0c6WFtJPEhFX1NBCEgrCD5cQVJhXFAYIUlDYg9eWV9iNjEvDD4JUiI4TkpRPUQ/SR5NHEtgR0ohOB85UUJhRFBUXFBOUE1LXlJeR1giWFRVKExHIBdiJC8MAFIhJFNcJV00Vy9cRzo1Q1BJSUdPRD00HxNAO09dSk4oT1lARD9ATxApL1pcQ1EMIUlDMT1NTT4vPUdFTEVIPiBWR05GM15gYlAdS1I4Rl9MUTBbVVFQWkM1VFJSHTtYKlRVUl1IW1c5V0pTWhtaDyBQDl4wWVE2KF5eOzVKEBUiVwBPMh9aKB5dVFQqUiRcQFdcYV0/Sj5BRVVAWGFLXE0kTSwaF0BCUBtFXEorFzNMIlVKSzlbR1A6RlxWV05NQ0QySF1PQj5IPzZCQUZRS0pQFFcgRxwfRVBTVCNITywTQEwSVVJOSiFXNSlOKF1JSRVdXFVOWEIqEDtWRDYeMQsoQiFKJE1aVkw+J0lMJ0oxQ0pYSSREPixIYF1hTlNYTUVPWgBaSzkTWBFVRlddTDhCG1lPRys1IxsjWkNHRVRLSVMXNUNCYVxjHEA9GU8nCR5gSR8KNUtkX0RPOjZLSTceWxk0XllUWjZOLEsNRytTV0E3LkcaVSZbVVVPRyYzU11bRRBfWVA6SjtIWF9NTFI9VDNOR1tZTTMQHh5CLRRJYV1TF0dSYFZUVj9YFBVDPUxNWT44T0k/OkI2Wlo6OUtFOkNLR0wIJ00oAE0SLiZZHyVBPEZbUzpbWC5dH04UPBJfM0M0NT9QU1BCTzE+NUw0SjcmRi1iPjA/WjZFH1dTNFNZTxQ9WVsAHExbFiJbTkA+LU8FPEslOUE2K1RUR1ReSi46QBsMMRkPADoyPFJMG0NOIUQlViIGNUk6AjxOXl5OET5MPEBJRkxNYgRbTjg4XABNHjMsU0U9ZFgWWEhDVENFFUsVIUQrWhwkLSVQT1tUG0wvBwBdWVpDSUxJVk5HYitFYlE3AhI1ABwTUS0VFVk3OUdNOztAWFcASTJYV1A9QxUrJToVMTgbGVNFGRMTNyIcOhoPKiI5IDlHTwhBDT0WChQTXj4+Pk9PQkpBI09KOGJZUEgvDSUiTD0kBA4OVEhOUElHQlNRRVkMHCsTSFRBWDlaSEJVJSwdAQAUFBgXOVkeUUI+VjVBTj1RDEcMTS1dJzwnADQ1Ah1gE0JDGE06RUFgVThMJUVLJDlSWFE+RixHT1gwWUdJT1JYP1xRREpZUlVEXz5EVT8DS2NVSUhCSRtaT1ZCP1BVIEASLT0+TVQ1Hk1gMShYMF1BQ0hQVkRZKTMrUBFEMTdCQSM6RxkRO1syRhZWUkhYU0QeHUhQSUUuCCxEUUNARTJeCCdALhc2ABJYYksfLylVXEtNMUNENzJhTUVKR0xXLWM6VFE3HjkUNVIwYDtSOyRJAEg3QhQaK00rSxhQUlhRTx9WPVVGEkwIP0xeXlY3Q1ZLQlZDGWAWKyBSSCJUNFFhO04rSl1DT0xWYFpeP1o4V2FPVEY3WkBEZFFjU1hTKDxXVRdYSxliP09MQBI5FU1cU0swFjY6TERJWCVKVToaSlMSJEMqLVc7VkFNVDJCQTMWST5VS0gaWiE0Vl1LVk0nGjlVVh1ASSoyWjw3RTooSkJFOwxTREJAWBJPXTgLG01aTUVGWhsUVUQAYhAoGkRaADE0ETtELSI/WDgOQFJYB0BMQV5SKlcZTV9JSUVKVABiYzwjWzgqXklNK1VVKkZYYkBJR1pFVlpHOGMzUlRgWlEdQkViVEg6V1laVkNPR0w9PkEkP0JdJw5CRkErP1hORQ0WGRoWDQ0YGD1HJlNQWWMQSE1HL1VHTlMTLF5aWVlROUElIGM2YR84W15CREtLFxYFFjtQDl03RlIGXFpTVRBaSEZCH0BSUQQ9FANKHwAdG004RDxEGk5PIyQTTlFIT0FONy5JUz9MCgVPSUhDPEleXlJiLCYpRVlCRFQsPBA8FEBhCkY6TQNjUkRVTChKW1JZWyxcYFEtDWMmAlY4TQhTU01SQQwMGSIYCSUgEVw/EzYZPD1iU01dQghhHSIkHSo2Mi5VWCcZVFISSSZMV09UK1U3PUceBxRARAwlQUxNVTNcXlE7Pl1RP0kyTTdEVxVWNVEjHFdEYlg1HFMWYyUnWlYwOxVOUVdVR0M/WFkRTi1OOlxiIABGLVo0SCpLHlRaUkkfYVpTByYfVlFTXFoyMD9XRSo6X10sOEckXy4WMVFNOj5TPkM/HVpWG09BLUxRU0JRFFE4LkgUVxNIX09iSCkPXFNTY1s3YkkWXxxLBitVTAItLVEQRkJDYUlJURFFV0wcOzJaQlc8XUAmTjFTVElgIB9dHk8fNlIeGkVUE00ZOTdjDVBZKiZWWEYvNRBDW1kKAF5eSFFOS0IAVRsQPwBbRUMATldYXlBNRjFZSUxJNkBNASAiWk9PTiJHRVBBXFkeIUk0QyQ7L1IdRTU1R19cLkgXGhgZE2BdRT1LQ1hUB1U+CidFUzo/QkwkGEEWAE9CWkxeVUhDLRdaUlwASSgQVlpeGT9PTwZFVyUsKUFLCBhIJiEiP1slEDg2S1RRF0RXOktRUlRIHyEhMlMuW1YmVy1SYWFDXDdbSVFcUGRVWRxkLzUaTTJULRE6DSszSzpRVFEvWkZQEyQaOlAlBQReEh4ZFDFPTiRGGABRCicgIB81UVFGUV1QTz1BRzoHPRE6EBFVTxgjNEdNT08xEU0+GzknQBwaTENPVz8iVSQ2GktJSlBcFwE8GQsLRENNYU9fXV1SVlBUZDNYUlQgQwA3KzJNS01QQ1kYV1pJUDc5GVMUT2BaOF9cUDtdVgY8DR5XRBw7NSs+TzhZQ14hKktRDyVZRmFDVkxBME8VElJMAC8UCWEtXTgrPBVTPyReUEhCTypOTVRKWT8PUFk+YjUQUE8mVjs7FVQqS0dEWEwWUlRUJBkTLUc5KVtTHD4SQVBBU09TQk49NkkpIhdPOSIiEEtDIFQKSUEKQkNVOyJOXCIkFzk2FhYWLV4tLDQWGDQzNDAuOApNUj9LNjRRLVpTNCBJT0JGUjZEJEJFSVphWiJgLwBYJGRNXkxLTiRRPEZUSQBOT0k7SUc8QR9TUDknJyVLQk06Yy4AHlE4NkEFSVtVVl1SVkVPB1ZFVWFMW1NUU1BbT0tGQUBMO1dWW1RYJyovYDg8A1lAUwtTUVguJU8LT1BSKVYgQCsXW0ETUlcbNRo9SyE/Q0RFWl9VHRM3IEFQTUIdU1JkT1I3H0cCIEMiOjwNTExdRQ1HJCBfKVI7WVU6F0FTW2NFSVM3JD81PkZdWE1NY1UbLkRDSF0ZWEZPSElXV1hUUFVSWFpINUZTMTdiNFVUTUQVPDRaQB4UXTQyGjELT11OPiMjRztcW1tTHC8jHCIMH2RSTQAkVg9fQzAvSDxTRlRfISNAPzBiXVZBYGNUU0I6UkA3MiU4TVc9RD5EHFFVTBYRWUI5WyA9Qlo/WkQ+Tx1CGx46TElHLztAXysjWDlMVSU/LDtWT1dfSCFIM1MAWVdZTRM/Fk1KUFRWTkpgVVpPEEVTFiBGQUBWV1ZFVVohKw0SNlodAT5ESEBDUjAAIVVhUVcNUkViV1pEXFlFWF9IVhswGDcMSFUqJwlVPkgZUzRGEiUeRz4gSU4nAEdUS0gdLEAbVRg6XhgPJ18vPj9gRyFjACNcK1YiPhhOPkMbIQAvUBA+Rk0wW1RSUGAsMFJSUUBHSlxKPUxVT1ZdVwlaNFpOV0tIV2FcPVcbYT49G1hVQlgpGj44GVIZKTlbXEFZWj43V0kbXVIdTDU/TzcKSUtNRkVKPzocP0xcPUUUSVNSVGBURlc4AE8ySzkvYFBbWSYlTkUnH0c2PD80UDxPLVQhLkNZPz1BVD5dLDgPHw87VFIdLDVeMkweTj0wSEhhTk9VTWMgT19YX0pYGWIpVFVRPmEdW0E7Vyw6IyNRS0JOYmBECkE+P0RMRVJJYWA1Q0Y8AkQrNklhTUw7QzkUKx00Nz1LOFhLRkheT1dNWRZZLEtQRFhdUVgcQT9cCzFFLjdYIk1YUV5UT1NGRj4fQEMRPUcgGj5cT1JfSVxcXEYcTiBHNi1bYD0MPDBXS2JFFmAlQxkRDjxHRSwfZElKFSkgNxdNKR1gW1BcChg6V1cbG0YWHFRbNkwkRUZFRjxSOlkzTF8zXS1aMjs/QEQ7TFFLEGJbQVEuYVxNOipfOlIdSEJBRjNIGwAuSltYNzAMPl9QKVxQPkFJHBYQODpZNTANXRYdM0ZXM1dcUVdGUjwMXGAmVlVLQjpfMzJIVzNJBToOXjxKSicISUQxOlNARx9EShcbJChTYzkgTE5KPURFRkpLYFJIMAhHOz8XU0BHQUoXEEs9N01CUVBfWT9RLEJCTxMIHFQXUkVKXDEuPgdTSzFeTkVQPV0PVUxZXBhIMSlGS2FdUVQbMiUYUA9eQjg+WVdbQx5SGWA9GDZLMkVFCSARTlxBTEVENj9FXEdYWFdIRVhEMVE1VUAuSy9IRzBIXTIoQk80Tl5TQls0SiAcRUQiUENbM2BIXR8YVl8+WVJKUSIUEA5DTUE7TT9QUgRZWRgOMRpYFRs6AztFX0lcTFlbSl9JWFRXXVZWXFpbYV5fWlhHXllYUVZXYThKX0dbJF1dWVlSR2RdQE1JT01RSFNQTk9KLE5bUU9JPE9hWktTSFVIUGBJI1BdWFBbTVFJV0o8IkclTmMwFWJIXlsaEkBaMlJETyEYUl1ZS0xNUUReGk1RV18ASUZQVxJQVBRYIQhEQEkXX1hCJBUnXDhVHVZeWlJXWE1UWFdYVVdYV1hYV1wZQk0wRmBgJFhLTFREJUs9VVkfUE4rJBI5P1gqKj0wAAAgRFIcGlRGR15MN1BZR0YqVD5bPzxVW1UWSSNVUEhfT0o/YjlfVyIuVGBITz81JllCSjJURgAhABVDQEpJPz5WRUkPT05YPT8eIk85QFVbWFNgRkgAPyENQABKOUA5AC8dXzcWXC8mLE9EKyVgMSAQDkpOPmBfWlVNEEkfUGFhWFFiV1pCDU8rRl1dXSpLE102K1lEKBNXIhUaFwoUCQBOTFZWWGNCW2JaUVovQDZUW1JUSUdHS0JJVQcpXzBROhc9UFJSQWEEUydaGisISV1jVCpWXjhbWEpUS0Y5VEBIPEtjWS5KQxBZXRk3TiwoKlVATTQ8Sz5BPU9WRSIdWxtXPVw6HWBaTmIwVlBTE0VdGlYRQVQsUkIbC0RTPzAURVw+P0A9LigoOVo5TztIXT42NAAQC1VSRUVTUBk3T1dLPEI8Tz8cNU48L19WVh04FFZGGF0zXDZiSV49I05EXDtJRic+OFhNVy5GSk1HMBQlT18hLEFMFkQSWyBSHzU6GU8yRRAoQVhPVTklS0tGT15aQQVMTTJTUR08XUpfQDsxIiBUNzVHTFUZODFDWFYrVksUVyRIIVxTFWRHR15IS15UJFREY1FXT0JJOEFKQUwzIUEcQDAURUZeR1tPQDpQVFg6VgBXOzdPVjk+RkdWRj9PUENGT0lUPlk7RSAlWGBRUl86TFg9F05URTVCTlJYVCIkW0ZNQ0NLTE9OPEQtVgEwMUVDM09CXk0FPCJEOlZMWWFMNU9JNlxfYRlMIzxhRFZSVy8gJVQyRjETUUY3EWBXT0I4S00aRxRFUFNQO0RPSFJDRE0AVWA/D2APTUAKD1FAFjkcXT9XITtTN10iWixNNzJLKCI1QU45UkRGREU4Nzs9RylGSkJHRjoiQDQhNg0GOjQaQxdcOmFFNhNKLE43W0xPTyFdJCVcTUpQH00+VClMJUc3PFFRIFlZYE9XHjcTDA9PY0MWRFdBUB4pLlpUDVs9UUpASiBWUjcHLGFOYD1cQldeUxQHVVBjAEcjPikGTVkuVVhjSEliXF5aHCVJOT9MYA1APURDPT9VOi8/TygwTCFiWFRLGEZNVF82Okc7HEQcWVYlRE1cClsXGkdhUThLPFsaR1FRVBZLRFROP1tOVx4eM0VIO1A/VmMkU08+VmA7MUFOVCtAX00dUDFHGz9bTk5PSUoAFUVHRSdLVFlfPV9OGVZPXxpFTEkvPUtaUhxMUj9XU0wkQVVMYAUFPT1VTEI2LU48XhpgRF02Oxc6WT0vUQ5OIkpbLBdgVzBSFkwlXk4AED4+SiVKSFFPO01PSVNNUEtITUdSSlVHPklIOE1OT1FNVEhQSklNSElITUhJOEgzCk5TU1lJT05JWllRTlpYW1dOUVpLWFFcVVJXGAlUJFtbUlEpD15QCipNSShJUlE4Tk08S0s8RxVeVFJUYjwzTUguLVxQODRXWgshTBEtES0UOEAmHyQAXkNFRltaWEcWFlY6RAsZUBEaIkkrUlNAQUM5STwtOllWUWAAVkFgLzpZKjdGXDgpHkUcQSJRT0U+Ck8bBRsOHlMTCUlQYEJDPmEUTTVDEjIyUGQsWCo9TFBMSBRKQT5GT01ZQB5NTjtLJUJUXUYSOUUxQU5IJ0VQJkhVUEVMTEtaTyBcS1RPTllaTkA6MzsvRDcATkUtNFY8PTlgVUIxUQRSUg5WVVtRRRc/YldeJw46LVNcTl4eOFFOTyhPMTA3IEQZC1JWICM5MiccXFgeT1NRFSlHSChASzgQRBg4F1dLJR1BQlg/OjQzUFI0EjFGJ0BDRTkTI05YRTViFl89Vi9JQTtNSThHSRZDVlk2RDhDOClVVBY/JitFEQoADV1YUFNJSkhFSEEmOFZJWUpOWVNHFkNRVVlYRUdJSk9KVk1TE0VMRE9AT1ZVHDZeS1FTRENLWk5XW1NbXUkqS1YuU1JUXFQaTVNNRFtWUVFEWhQYFgBQVUwYUk5RUlhaVlRcVVdRWk9QXldZTVVMOUkeUFETUF5ZWFYfTj83RT5BQFwMV09VH0k2QTpRXz5ZT1lAOE5gYUdBGjUGOl5GFkVNO0xSXicSNV0qGzEyUlchMFNJUz1UTUJHSF44SllFPEFGOkBQPztGKUMXXUcZRE8gPlA0WFxPSUQdJUgRKkQzN1dCVVpcRjpQWjdOSjlKSkoVPx1FQidRMGFXWUhVFyQSQwtKHw0LRlBhVhwgSEgNHTlKIzdQUhU1GhhGUV9hQVwjT09EVwBZTj9BQBVRTl5UXgATUlc5HlFESRpGRl9UPlJDQxFHMi1CR0pZVUg7QEg2UVQAFURRMlY+NipQREwPABocEU1IXFw8FUA6QjlVYFtWMlpSQSNQMUtWJRUdNxddST82UgAbIiJIXTxdXElVT0NBRjg0KDQuRCw3OjE9RzsxMVhfVx9KLVItQxBYHgA8OVZWO0oSXg9ZYhpRFkEhRz9eZDVdVSVOABxiPDswRVY6T1JMSDcvGEVSNldPWk1LVBxCVUtSOgAcUkRdRGBNUFIEVFYgUF1RXFVWPU0oS1ZYTUlKRjg9VE8mFTEwRDQxWkcdXVpGSAArM0RXYFJTNk9OWFhXQ1RQT1EsR0pVTWNQTlFZKkZXTT1cQjZEFFYcGBo8OSc4EVlPUDBOOBw8RyImIjA5RjtGQFBARDE8WjtVNWEiI1o6AD40NDoYUUw1QjZGXVBXTk4oNDpBRiUzWl4vXkBaTjE1GD5YVRVKIhoOIB9QVSldT05HIVlcNRY9I2FdMTkNAjUhXyUVBUoUIFBFRCw5YkwRUwkQYBIbGiBiDyAACkkaABkbNxIHGhgAACUGTT5JGAASFwwABRIqFloxTSIQQREaWxdeHkUDCxQ1PgkaRAUfOlA4R0omDkZDW1lBKTM7SFg7PTZeRixdAE1FUD9XGExBSyBLUkspNU4MTgsgKEgZL1JMNj5OTTxaQB1eO1FjUhkMHU48Mj5VOTwsXx5LZGNcQVVUUwBXHg1hRUxeVlBXU05IRDFZFjZcP0xHVCVHNF8oTEpWEB5FMSpQTEpRPkRPJyRHECpLE0xMKTlQPVw3U0lFXT5JSkY+QCBCRzpMUlccWjRMVkELKSZJWz46RkRFOElJS1g5GlFBOlQ5F05SWixgRSREGVkgJSQNTUEPRwBjVikzN1hNLiVTIlNMSSdAM0xASFZYMEZETVQ3OFpOYk1ZXFpcAEpLJS5WSVQvWE9cNy1ZKDVcRF9FLi0hKi83ISE6PiwqYUpULllOXSwwJjtBNR5SU0VGWUogSEUKQ19MG05OQEVUIxAXV2EYKlwoTVhJVTxcYUQdRx4nTFJHTlhWN0tCWiMzSBUfRFFQLDZVIAY2SCUmLwAAUFtGUFE7WF1cSF5SVF5IG0lHXCtDLRw3WVJVSVVSUU9OWl1PSB86JSpIEiJBTWBGIjs2Oz9hOBtAOTBVUE9LS0YgTGBNPjphVFBPUi9EVjJdUmIeT0sxT04lP1BYVFlYNCo7Kkw/WlVTQhYoQVQ+V0dbIVA/FBIUHENJKilGUUojRVJDRChINSxEYkE6QTtPIEFaYlpPVk47Ix1dRE5EDEUtLE4UPSNDQUU1RTxKQ01WRyxARxRASQ88PUhYRkkiShI8ND86Kz43I0lPIyhCWFQ/GkYxW0BaSlJjTw4ODTZLSw8qTFBYI1FWTThaXVwkGytMI1g8DVpVW1YvYFUAOy1KRj4ARmA1YjtfXyMhTBUvGUtcGFw+MTI7JCQsYlVGGklTIk1jUDQXT0kbMBQzUlk2Xl9XXURSV1dLWixWLB1QIkBGXTRUGEdUU0o7QSJKIjU1QSA/RUVcRRxMYzdPSkYcU0JJPU9eUEcNAElTWklXP0hXQURAVCodVE0AAEo/I148NkpPNj07VlklUF5ODFBTLlYaOCpQL1YoR1JbW1xiXTc0WSFUTUhMR2MtTVtKMFAWSzwrX1dSSC07XEZMIl4oKCVQPhwOV1ZCYT9YNE4zWR5VVVo6Lz9AS1A5WVoaOGA3KlZPS0lYVFosO1lHVU5OSFgWW044RUFNP0czQEYcPEFQVEBQQV9QTVlLTVBfXBU5TE04UURNPUdBPlU+SVlUJFBbRlU4ZBonIzhANiJNAFMSAFkTTjVCFlxDEFlCT1JCUyQWIyUnIFYvNw5XXFBUQThVXDY9IFNMTS9TPDAoPBs4Dk8gMhtWXk1cIjpfSEVBQk9AQTo5Ph86WFNMQEFQKRsmWkdJTkpYTjNLHx4QOTpfUSMVC0FKOD9CRUFBNkU6PUJJP0JIWl1KV0tCSUQtPEBCRkZFWFFGOjtONU9HT0kLKUlHR0hbDihSVEc+TVMaWz1VVRs4RjsTIg5KVVEYP0dhTU82XxhRL0sWGi5GT1ZgWVVZRlU8AFlWSCBXFT4eUDRPSCBQUkdbSU83QUhiWVRNU0VIVxxQL1JcSltaXkgUYFIoRVAuFTYHSDxXLk1YUjlQBD82IyNTIU1HMShEO1QTP14vHyNINVFVRmBDUjVKP0xOWFFHTj5DTEEmIElQUFBRUEgfQEUbTC1LR1EXTjYWPxdNTksrUB0mIDQNSS1SY0ZOVUkRGC5BO0QeUUwlXDNVWlZRQzwALj5EQzssUFRUV1c5FxEiSks8Ql1NY1JPVVE0Wz8bV0xQSVBHUkRaVDtOWFdRTVFTT1hUV0tPTVBYTylNW1FRUlsPSkcLNBsMR0hiJVUzLVFIWAZSWUAMG1BjFlBNUylZGjQVSUIUMxJdGV1UUVdNI1lUUFpBIU1BUE1dXWNOSU9dEz1LNj9PU1VeW045TCxRR1JOO1xRRVk1Wz5GXC1QWlI0UjcCVSJRTENGQjpFSlBbOBFjTChQU1xLOCBKHkBRRhNhKE1IPhtIDRhNSlslSyUGGjopTUseUTcsVytXTEtVRg07GEtWLVZTTkw1QVxZP1ljSzRJMlpaGjJOJE08SlMnPVNOUTxKSlBKVRAcSBonSV1aQUg9YWRNVENALAsyTiZfUlFLXj9YU0NPP1tYLFpeUl1LYxlDUlA6Skg2SFFQSU9SSgsmTEg6R0k6GVFLJUU+WlUDWkIaLk9USzhLUUdRPU82VzZTYk45OEpCL0xTU1dNX0xDLU4oT14yNE49Q2EuKFMjKUQ2TVRePR1MK0s+MyoXEQ0iQiFFTEomI1o0R1NGSClNVCpQJllaP1lhP11UIkhOVUhULABTQUJNVD8oSVpISUBVPRBMRkFCQj1MUzVhVFNILx9RWFBBR1FSQFdFWjpMMSgAEDoGRUxMNShROls1YE5RKCY6NFY1HEVdVVpLYU9XVF8SIUAhMFBPNQw2RE5ZBj1FPl1MNzxPQ2NYABdKGDxUTUtZXVgLRClPUlRaRVBDCSVLYDxeOkM5TDQ7DBc+Q0BMRkVbVBYXRjg+Q1ZNPlpCP0M1MzY/SBlNRyQUNkNQIkUXAjYtN0YfTyJVFCQfLhkqNUQGPEZMREY7ShQuQFM2VFYTTFEjLj1HUl1DRydJR1ZILkpBZDkoQkg7FxJfVT5JQEsYTzpAWg1KNS1HVVwHRz9GFD8fTh5NHVNOHl1HSC4HVjs1YEg/R1dUXikfVidQRiAxE0hSORZaV04APElTETpHCDtRTBE3Wzc/RzFXQSwpUgVaVCdEWCRATzxbVFZPXUJRQCJNQUA7YB5JNj8STj5PPVZDLEgtT2AsViVkVFgJHFA5QhVAUEJBPVEpTFYxWF1SRUtUU0VPSxBVWk0yH1oABkk/IA9PYj8wRztAGCIwKjJPSGNZVy8iRVlIH18RODc+SEZaSDNORVRMOElRTFFRVlhQTEtJWExJTE9QSUdSVkRAFFBJUl8yJRxUIlBRVU5KT0o/TCFPQyo3ShxIPSdITUZiEA9JV05NS1NTQkdPVFJVQkVESFEwUlQzSlNLVVJPTVFVP19ITkRHRkorWlFXTABSG1ZZUkw2R0pMSDk6Vj0eQUI7OAhIQzk/P01DO0JcS0ctEzw/LEU1SldJHihFTyZNWkNGPBlMN1tXKWAiR04YNTNDL1FdUz5VTjAfNlNNJkcxHGA6QiZFVRc7XD9FVUleXF1GKU0ZUiIhPjxJIl4sNw9AMTYWVFBbYVBMJlhfWydWWVMTXhcnW0BIXlccF05ZQ0BQVRlGZCE2VyFRGxVGNkUTJVJLFUxRDlQ5J0BEXy1dE0A7MFtcRFFHSEZHSlZYUhlTOxhZPh1YD1JJKUlBPklAPF5TVEZDYUhgW2NMS1JdUV5ZIhhMTxhUI2A5PUcvSjo/QDwwJAFVViVLUkRcWGNePEpIPF01VjopVkdFGU8XT0JJOmNRYWRHRQBEY15RJTkZO1Q+UVdZGQxfIEo9GUMQWk1aZC5XSlEyP0MkTEJUMV9CW0BJKlEqWlNgIhY9GCgqGyFcG0wJRDRNLE0JR1haWzBPXUtYS1RdJCNMTiI7JDVETUUqTVI7Q0hTP007BksiP0BFSypJOyUfHxVdJkBQYyA2Y1lUSVdQVTMpS1AOJRtSU1pfVDNGU0JcR19cPkszU0o4R0tPGUkoR1U7UlcbGU0yQSEKVjwzDl8zM11TS01QSRBHSEBBQEA8YT9FN1FTQVhUFjMAYjERV0tZQ1dLQVZOUllRQVQ/JlpOQ1IaUCFfTEdCNlBYYV9TGg5MX0BgSidGRj1XXEtaODtbSzs4SjhSRUQKVkpUNGIyVyVUTD9LREk7TBhNQUZIRFJFHkRCRTgLTSBCWkUXKihMAFE+HQxUKVxAN0dKYkBIHVhUWDteTVZOOEJJTlxWM1dBMz1WIE4oGkxKTENAFk5VAEI2PhdgUkwxPkNIS0pBHkZeMFpjWUpQR2BUWUgISFpQVFtMTUhXElJDFjRMSkwqUhI4IR0xH0siY1VaRyBVTS5bVz8aFBEhIElSNFoQIVNIUVsjYlZWW0RaQlRSSE1MG0IeQEk/NxMkQGFJWzJDPQBAWEdTUkUeUhVaGVorGU8RVyxeCjwsTghRP1UWWkUjREBHNiQ9QlMiV1FMTVZQIEU9C1RIPgwsUlcAVSQ4AB89JAVIQEBcSUJMSiFjMQA6SVIdVUMeVD9USjpSVDNTWkhZXFhgFVwwXVRTSU1EMiBeIx0GRCVARTlEKlMvPg5MN1pWVSRJIlIaITtkP2JHJ089MVA5IVJIGT5XG0NGVlpcUVdhYhFGFU0AWFNPSgEdWzkHSVFIBxpXWwhRFlRRHz03NBdPQF4MSAASSD0TTjVFXTRATTc1ST8APlROXx0gUiIxWlleYEYrSEJWF0hGSk9cVGM0V1RfXlZDYlNGUE46N0xfJ08dJDYfVElDWyRLXTQvPTQ3EigbAF5AHUtbP2FTW1dJRA5KBVZZM1EpQ0VSYVFWTz4kIE0uEmFVU1dUWkVcK05NUFIgWixDTUtOTUkjUk5SUkhZRVBGQ1xLSj9HVTs9SjI8O0JQJFpcN1tMFjs+SVE/M0VVTzlBUx5SSxsSUFhFTzNaIUg6UQA0TE9BXhJJRDJUVlMkCSBNEFMFAC5EQy8EWzZEOClHLlFWVjpWFwtFU0BQQCJbLx4NUzYyNCQQS1kwE1wPQEQZSFNcNVglPComW01eDEoSAEccABhCQlE0I1EUVEc9YDtgY1tCRR9FHx8dRB9RU0o1DDEAXElPPlZRVEYfTUUTTx1MITEgRTxOTkhaTj8oRWI/MTU7UEZBSDA6W1k6Gz0/TjhhRQhGPUYvM0RTGz4UUk1fSVRCRkRcSVo2U1ZTJ1JPUU1EHDFTJlMlOUNZPggySjpTRj1KPFVHPkBAWFlbUFJJTDJRIg1GU0RZUE9OOkFWRkxPVT5XGjI/R0FRXE5DQTc1VToYWWNKTUI/WVYtRRwoABZHGyY3OE9CHR5FKShRERFWRk5bN0FYOVhRRlNVWVldY1weTEVTRERMDxE0WUxFSkJGOSFRVD81JTM4UURKWjsrTlpCSDFfBxQpWDgfL1lNMF1MV0lYC0A6R0pIUkZZQ0RER0tQUUUzTk5FPGQdVSQhPhQfQzM9QUtORj5dU09XYVRgD2JgW1hOYFtKNRVGSFs1TEhVPVBVJlcnGzwlB1YUR0pVC2NOVzhXVzUtEVxWVVgqWElNTj84WElZWUhaX0dfPSkgRWFhC09RH0U8Eh1QO1VHQDYTABFIK0BUVl1aVkBWJ1NTZE9CGFZJYEIkKDZSUVQgRFpSPUhYUVwTDE8UUxwEI0lTPSFIWyRQQwBZQ1lWUVMvTSVPLTRFMwZERSBOZE5bSzxVVFAHGS0vTBM2HU9DQzwhGzxGUFFiUjBITj06XCY3QywzPQlODwAzHT8MHwteAFE/REYHV0VLUCgwPj0+FVoaM1VESlI/NDYQUCBGDREwGRtLGVFRQAMzSlJJQFZTKVc6Rk9FS1AyPFwvTiE5RSovNktKMztETxATT1ULUlI/Jy0XWz40VFRWUUtMTzhASyo1JVxcXEw1WVoXG1cLX0c+LTBcVh9cNhxIHkNNWFhPTTQ4PghEPShMXCkbTSkPNF0mUBdFGjxPPkVORxBCSVIZTlUqNShBJjdBBgcCUFhQXCVHQRkeVBhjUk09Qj49SzYRXz81UDIxIk5KRz4zWkdSQk8ORUJMNilEP1E/YBZaSGMtQV5SLUknXGBBMyFTX1tWV0s9Sj48J09aT1dAIFUXSU8+QVg1OiFIPUVFRTweWz5ORkRIQkxEIEBINVBZTzoZQU5jLhBDVko9BkI1ByVNSixiXCdISUNLIFIrPDVIUA88UldLFllhXDNJWkAiJTtPW1VXPlEiE1QhSU5bUlNQU2AtUkcoWl8jMkc1QzFSOkQoMkNRY2BfA1dKSEBHQTsQQGBGR0pSJ1URWhJIHB4jTkhNJ15aUCVNW1NZUV9ZGlBXVkJORTpjWEdPXxEWVVxfT0VZQQxiQVc8VxZdHGJcPURNHkxXT0RQQk1XR0UkRUoWWEtGL01ARFU6SVEPTlI/VThWElEUPlhAXUo0GVRTQlQpVFctVTEpXFtOPF1YS15gSzkXVkhRQR5WNEBRLjdIX049KUFUQlhMXVBBXFdFQFhTXmNZT1ZjTWE/WGE6U0JCYxRLJVBASQpMDWAOS1dXWFIyYBcXRUNKVTwvWlpaKkVWRy5JTU9cVU5LAFVeUlNLUzZPNBhWY1A3QCs9JU1KOk1WTDscKC9ISVJRI01XYEcAXFxcX04+WExJSz4rVlBPQDs4OFIXTVVZVDtYRkFSKVlYQkwyPjwVV0VFOz8uXFBZGSNSGlJFTxRPTk5hV1QuPEZVEyxbDC0WKjdPREBfNzdFRhM+RRhRZFFcXFFMSj1ESElfUj0vYWJDHl45RldJKExGQi9JT1hXVDZVXFBZXVFfMklOWShMPkgWHFNAVhs/MUZIQ0YkSDxMHVEtKUBdJl9NEWM/MlJGWAs2YUxCUEszMENeOl1eXFJSRi9ZVh5MO2FQSzlZXUlCPxNPE1ALR0NNW0QlLl07B1ZNAFw8RT9GDFxGSFNASjpgA0wbUFYmSUMkPFVOWFdTV1VNQjpVQ0sqGxhcAEUYNkAZU1JDK0pYIUpBVzVOJUtKWEBHQ1kcRlZHTj05XRYyR2NOTEAqWFZDEyhjX1lHY0FaHk0nBBwuGwBOVVExVzxMSkJBVh5IP1RCSDhfRRkoQWAXNVdGSVhGRB9YTk9CRSpZAE87N0cYVEhSUyw5EldHMVNTFkw5N0tPAEJKVC02QVdfQVYvVDxYX10VR09JQmFVY15OVVIhVS5OPkhNUlI+P1FQSSYnSQBMID9STU0+Fk5PYFxLYGBEVl8fPyIcWFJOMEY7UVMgTlo+QTtRWyBBUzUVVkwkU1Y7Olg8QlhfLz5aAFhUSldWY1BNMkpSUl1LS0NFODNHXGBXSFNSQgBTPjZQSEQ+ME9PID4wVkVcQFE0MVUxJ1E1Y1tZWh5EUlVQVTw+Lz1YSxhKT1MuKkoPRzMqFyNEUFMeSVJEQ00xKUEhI1kAHVAhMUwXJ05JS1g0Pz8pYVMROxIROy1JSS03X0RATD9PYE0zNFY3UCxaYFAwTVc9P1hHSj9UTEVbSEEbOj5CLABLJxVgSC9MAFwcS1BUSUxeR1NQUj0dRFNcVVJVSEhBSU5JRl0AVlJgUEVHIjxGQRNJIksyS0NQOk1DSVFfLUVbVldFLV4lHk5KQk5GSFNTQxtMW0dBI1ZeYl1SHl84KFQ7QFNEQ0M1VUNYJ19INEFAFVdbUkhgSEddQVREYTIAVDxhNkM6UEwnYl0NMlVZXF82TzJDY0pERC5FTz1GRElKTkZBY1ERU0hNUVtYQTpVEz5WRDZXRE1FUlBTTUFeS11ZUEVUUU03L1hJRjFMWEYfUktVI1RYPUwiE04/RTU4VBkXVBYSW2BKSjxDRVA7IA8sXlNWRVBTU0wfFBg7JFNUWjk/JU5FPUZRWzVGSS0IWUZIVyEkR1VaXVdbVhE9GVA1GzdDVVBQRlMeVio3SwMfMUVNQ1xWS05UMDVLRFEhPko4LE8fFEBAUFNeVD9RQzlQVEpMVk0TV1ZZYl0fS2BWK2FhJkgbP1BPIEhARDFCRVEQPlorOllbT0UwRU1BTSpGEDVNTRYzJWMyJ0pPRFZWUVNVUkRaWy9SQF9fP0FSPR1AWzpCUE1USElBX01KVFBcVTpBTldMSEYeElFTRkc/Wks/XmNhUD9BUj4POUhLED1CUzQeUFY4NU5MKTdUSVBIP08VLDJDSAxRRlg1K0ZVRkY/RUtOODZbPhhWTR9SAEhVL2BQSwBUMzNSIVBZXUZBGCxFFT8vMkQ6NjARWlBEWw9bPVM+VFRHQ0dDJ1IYNURTFTlGGRopDUUkQzVPYTAODUsSElgdQgBCRCc1MURISlVASkUqHjZaTVFLTF9XXlYbR1o1QVhjABtXFFM0VmFHS1Q1VTE5QDhHSUhQTVtaOShPGlJNSjxWFU4sSlM8SRc5VksbJE5HYEVJRThITlU7JkotHDdTKUpdIzhITx9RPTw4SkkyPGEzL0wiGy4kRkVYWBRENlUAUzlMKj8ePkVYVEceRk9DQ1sXJh5dVDsMVylFTT9CF19IUEFiUERONllSTkRIMC5HHhhMPk1ORx0oGE08UxslN0spNUFXMVY0UWIaKltGSjI/U0RLPEdHSFJSLV9NJlFbWU9RYDAzTxsNQVBMTjY+PUZTT0ZHQk1RNEVFBz5DPEMYR0pVVVZLTRsAIhQXRElLBTJaQD5NWVIcQ0wtKh46V1JZG01cTRNKSkxaIS0bEFwbR046YSAPVERCIC0tNBZXTTguHxgwLVtSQTNCU1ZDT0lMS1s7OUs/GkcnJ09PP0VMDkEbJjBHMRtHJFRUPkwsPj9gQUktNh01UTENTlE3HEAvIwAuGxlRKxtYK1NWIkA6YjEfWV81UBtVWUI7LSpMRC9HQVVTUzQORTdKOBtURC8OQhkqXiQ5PVlUUypeOQk7SB4/Rzc+AF1CHFMbQz4pSltRRlk4UDxAOipUBz07F2BQRQM+NEU/WTssNU1OQyFHX0cbRitNOkRPKQ0MHTRNGyNQQ1lCVE5QVl9d","links":"mADYAJgAqwBPAIMBTwDtAE8AVACnAEoApwBjAVwAIgBcAMMAXACQAFwAgwBcAF0AXABXAFwAXgBcAIgAxgAiAcYA2ADGAMUAxgCrAHsBEwF7ASMAewF6AXsBJQAUAUwAHgAxAQsBFQELAdwAPgBIAD4ApQA+ADgAPgBKAD4APQA7ALIAOwAjADsAQgA7ADMBOwCgADsAMAE7AJsAOwCZADsARgA7AEcAIgASASIA0AAiADIAIgCoACIAKgEiAPIAUQB+AFEAfwBRAFIA0gCrAEQBTAF8AFMAfABOAHwAQwFsAG0AbABwACcB7gAnAf4AHAEbATUBIwA1AU4ANQE2ATUBKQD6AGMB+gAhAS4ASAAuADUALgAyAC4A1QCeAJYAngAFAbEAnwCxAMQAsQDFALEAkwCxACABsQCCAQwACgAzAUgAMwGlADMBSQAzAdUAMwG5AAABBAEAAQIBAAFhAQABAwEAAU4AAAFxAJwAqwChAHAALwAzAC8AMAAvADEALwAsAC8ANADRANUA0QDWAHYBVQF2AVQAhACrAH8BMQF3ATMAGgAKAFwBWwFcAeIAXAFeAVwBzABKAQcASgEbAUoBBgFDAf4AfQASAQoBMQHdANYA3QCLAN0A1QD9AP4AdgBUAHYAcwDgAFgA4ADDAOAABADgAIoA4QDWAOEApQDhAHAA4QCLAOEAvQDhAGkA7ABNAOwA6wDsAO0A7ADqAH8AfgB/AFIAYgBjADIBWwEyATMAMgE9ADIBJQAyAUcASwH+AMQAYwDEALoAxAArAcQAZQDEAIYADQAKAA0AFAANAF4BOAC7ADgAMQE4AEIAOAAlADgARgA4AEcAPgExAYYBgQECAe4AAgH+AIMAIgGDAIsAgwB3AIMAZQCDAIYA5QBMAbUAUwC1AFoBtQBjAWEAXwBhAGAA2ADUANgAIgHYAN8A2ABqANgAbgDYAJcA2ACdANgA0ADYAMcA2ACUANgAmQDYACMB2ADLANgAjwDYANcA2ADZANgAPQHYAIwA2AAkAdgAowBTAU8BUwFWAVMBggE8AQgBYABOAWAATQBgAF8AYAB4AWAAZAFgAC0BYAB3AGAAKgGkANYApAClAAUBFQGHAIYANAA1ADQAMgA0ADEANAAeAf4A6AD+AHEA/gBOAP4ANwH+AOkA/gABAf4AOAH+ADAB/gD/AP4AAwH+APEA/gAoAf4AUQH+APMAOQDyADkAEgE5AEIBOQAoAD8AQgA/AEAAPwCVAD8ARgA/AEcAWwBqAVsAiAH0AFkB9ABNAPQA9QCEAUwARQBOAUUAIAFFAEIARQBGAEUARwAXARoBXgFdAcMAYwDDAMIAwwBlAAkAIgEJACYBCQDcAPsAIQH7AOYA3wBNAN8ASADfANYA3wDNAN8AqwDfAPkA3wDOAN8AvQALAAoAxwDWADsBEgE7AToBOwEkADsBaQHJAGMAyQBzAWEBBAFhAXEAYQFOAIYAegCGAGMAhgCuAIYAkACGALQAhgCzALsA1QC7AKUAbwF+AYoAiwCKACEB6wDtAOsA7wBSADkBUgBOAFIAfgBSAPYAUgD3AFIAqABSAFYBUgB5ALgAVQBtAVgAlABtAJQAqwBvANYAbwBwAG8AqwB5AUwB7QDqAO0A5wAIARsBCAEbAH0BVAEVAFUAcgFzATAB7gAwAUgAiAFNAIgB3ABfARUBEQExAREBNAERARIBEQEQAREBPwFFAWoBWwFdAVsBWgE4Ae4AfAHkAL4AYwC+AKsAvgBzAQQAagFUAU0AVAFSAVQBVwFUASsAVAF1AVQBFABUAXUAVAHwAK4AYwCuAEMArgAPASsAMwArACoAKwAyAIIBwgCCAU8BggEgAYIBTgCCAZMAggEhAAIAAwAsAGMALABxACwAJQAsAOIAeAB7AHgAVQBOAUYBTgFEAE4BMwBOAW4BTgGqAE4BIAEMAWMBJQEzACUBNgC9AGMAvQAbAQUACgDAAK0AwADiANUAzwDVACIB1QBoANUA0wDVALcA1QC/ANUAygDVACMBWQEEAVkBEgFZAZkAWQF1AQkBMQEdADEBTgBtAE4A7gBOAHAA0ABIANAApQDQAGgBEgFYARIBdAESARMBEgFlARIB8gDyADwAagFGAWoBGwFqAWsBbQBwAG0ArABtAGoAbQBuAG0AAQFtAHEAVwBjAFcAWABXAJ8AVwBVAFcA/ADnAFgBTwFNAE8BaABPAfkASAFUAEwBcQFMAWYATAFnAUwB+ABMAQ0BTAFaAUkAIAFJAEIASQBGAEkARwBJADAASQCRAPwAWACAAYEBgAEQAIwASACMAKsAFgBlAFQASQFUAHQAVABuAVQAdQBUAHIAVABzAFQAZgGRAF8AkQDiAC0AMwAtADUALQAxAGQAYwBkAGUAnwAgAZ8ArACfAKAAnwCVAJ8AkwCfAJcAnwBlAEgAsgBIAEIASAAPAEgAoABIAEYASABHAEgAlwBIAJoAdQHcABAAgQE9ACMAPQDjAD0AQgA9ADUAPQCZAD0ARgAIACYB6gBTAGgBGwHuAOkA7gABAe4A6ADuAAMB7gBxAO4AKAHuAPMAawFaAQcAEgDWANQA1gDPANYAaADWANMA1gCrANYAagDWAM0A1gDIANYAIwHWALYA1gDjANYAzADWAKYA1gDOANYAIgHWALwA1gCXANYAtwClACIBpQBqAKUAjgClAOMApQCyAKUAmQClAC8BpQCmAKUAowClAJcApQCaADAAMwAwADUAMAAxAEsAQgBLAEYASwBHAEsAcQBLACABjQBGACkBgQE3ACMANwBCADcARgBgARsBYAEHAaYArQCmAHAAZwBpAEYAqgBGAEQARgBKAEYAQQBGAEMARgAlAEYAQABGADIARgCVAEYAKgC3AGMAmwBzAWYAcwEgADEBRwGWAGkAegBpAIIAaQBCAWkAgQBpAHsAzgBzARcACgBiAWMBswCIAA8BTQAPAZAARABCAEQARwBEACABwQBjAN4AZQAnADEBHwHkAGMAkABjALoAYwCJAGMArwDKAOIAEwFAAbkATQAsARsBLAGAAGMBPABjAQ8AYwEOAVYBVQFlAU0AZQFxAGUBQgHcAKwA3ACDAdwAhQEuAeIAhQBlADUAMwA1ADIANQAxABsBVQEbAeQAGwFTABsB+QAbARgAGwFMABsBWgAbAYcBGwEYARsBXQEbAYAAGwEaARsBAwDvAFUAxQAiAcUAZQBqAKgAUwC/ACsBkAArAYkAKwGSACsBiACZAFgBGQEaARkBbgFKAEIASgBHAHcAFQF0AHUAzACrAAAA4gCrAM0AqwBuAEIAQwBCACUAQgBAAEIAMgBCAJUAGQAKABkAEwBaAQoAewBWAHsAegB7AFUAlQBHAOIAkADiAFkA4gAjAeIAiACAAOQAgAD5AIAAhwGAABgBgABdATYAMwAjADEBEgAKAAYAMQFCARUBrACWAKwAlwAzACYAMwAxADMAOgABAAoAEwAKABMAFADUAPkAiQBlADEBDgAxASkAVQBWAFUAegBVAE0AVQAdATIANAEyADEAHAAKAHABFQEWARUBNAExAEcAqgBHAEEARwBDALAACgBWABUB5ABQAIgAIgGIAGUAZQC6AGUAkABlAKAAbAFYAK0AlgBNARoBIgGgAHMBBAFzAZAAzQCiAEABWACTAMIAbgBwAEEBGAFQAQoAqQCWAMIAegDCAHEAwgAgARQACgDTAM8AogBwAG4BGgHbABgBGgEYAWsAcAAgAXAAIAFDAHEAcABYAE0AlgBNABUBgwGJAxoBRQD/BW0EwgBIAAQDAwdVARMGcgDuAGIFmwB3BqsBewDUAO0FMgGmBj8FagCOBeMAAAFiBf0EzQAzAb0B3gRNAFQBpwRhBXYAEgMKAIAB/AKEBs8AXABSBY4F0wAKBqAAOwALBSsAvQGqBUMAVwaMAOoAwgZ+A3oBSAfTAJgBIwCABzcAmAARBlMBrQa7AN8FpAAXBhUDTQARB78A7gAwAkQCMQGyBiUAVAHAAngAmAbnBXUA7gDiBNgAnwFSBaYA5QBWBeQBRwDDAM0ESQAoBy8A8wSsAgQBRgJqAOQESwDgBvgAZgE0Bm8B5QPLBKAAWwHrAm0AFgRIAHsHPwCBBi8FIAE7ADgD0QBCBlEEVgE+BCAB5ARDAGQAqQTQAPwETAHhAusAsAT1BUQAzADHB6MFRADGAEkFXABgBm8AVgLuAGoEeAWCADgFRABmAeYFYgQgAXIHbQAZBFgAWAHFBK0AlwQGAyIB+ATPAKQEWgBpA3AAEgU1AAEFMgD4BMkAMgMiAXYFbwAPAQ4E6wMxASkB6QSaBa4AUQMSAQkBZwVlBAgBkgUgAAIAZwTVAHwCPQAjBZYDewBvA9wARQJYAEkHaAAUBm4AaQA9ArYCRgA9Ak0AdANpAEEHBAFUA00AOQCDB5kA/QOaA9YAoAH5AA8HvwDxAk0AbwGbAqMEMgAjAIEHmgVtAJYDwgCOABMDswc1AD4FoABmBk8BSADuBaYAcAbUBEABMwE/BQYHoADnBCIBJwVLAIoBcAFhA0cAfgCeAmUFiAFcAAwGbwCBBcMBSQH9BM8ARQA3BfkBPgFbAkcAgARUAU4BgwThAAAEFAcyAOoAAQesBJkAOQC0AVAEWABOAUkEOgBaBk8Aagc0BdQAVQKXAL0AqgMJBTEATQCuAZMAWwTBBCUA3QBjByADEgBIALkHugQpAP0DKACsAawA3gZaAdkBbgAABMoAWQNYAOwAcgIrBx4B0gBUBUAFLwFPAGsFHQQlACoG0wC9ADMHgQRwAe4A0QbkBTYABQNMAQcFrAAwAiIBNwIiATMCqwBdBLEAfQCwAj4A/gR1AYwGVAGiAmsHSQFlAwQBLwAaBfgE1ADcAwkAPQUiAUkAxwVXBswAVAHeBB4H6gB2BmoAYAN6AVcA2wG2BscAdQF0BN8ArAWWAVQBEgH5A6YCewFnBkQAmACUB6QBrQDEALcE5wRkAJQASQYdAFAGPgckAacAsAIuA00AkQB8BNAALQUUBpMAuQF3ACcAagWDBBUBxQBgBfgEzAD4BCQBDQOXAB0GSQDgANACPwDmASIBFgRDAYIHpADPBzgFSQB5B4sAGgRAAewFQwAZAKcFhgHeBEAETgEGBUAAhwcEAZoEWAFIB88AKwUlAGEBaQQ+AHoC4ANNAAcCMQCMBUQAhAA1B18EZQGYBUMA3wA5Bq4ANQcAAbkH1QCIAzkA8QPMAlgAvwc1AGMBygEABM4AOQZuANwANQJLAB8CJgdoARYFLwDGAPgErwYwAD0AuAbaBswAnQMgASsAawRIB4sAjQCmBeYBRgDIAGAFVgZhAXkFjwCUAPwGRwHrAoUCeAErAOIE6QMVAXgAcgJHBhMAYwBfBSUBrQaWBaYAFQAmBpEA7QZjAHsFMAUHAOQESQBCAAcD+wZNACsFmwCYBBUBJgMKAE8CQgAbBW0ACACNAxIBkgQSBkMAsQCkAUcApgQWAFkEdAF7BP8DlQAOAkYAuQGAAM0BVwBcAJYBhgPCABsF4wDwAyAB+QX3AIECWAD6AiIBYQGVBC0ElwBOBnkALgD/AWEBwwTIB88AaQVJAGoADANkAyIBRQDuBaIFeAHcA+4ATgHdA1sBuQNZAbkEYQFrB3wAEQIPB70AaAYiAYsCTQAhB64AOQCqBH0AAwdvAL0GlgMgAWUBpwWsATUApgKDAPUFSAA4BjIAlQVEAG0A+wY4AIsGVAFHAkEFSgDSACUFPQACB0kAcwWGANYDYQGwAkkAqgZLAJUF/wIiAW0AcAZjBFQBxwC3BIIEBADDACwGCAByAkYC0QBcA1gA9AD3A7wAngWRBnsA+ADTBnsBvwJ4BbsAmADJBYYAsgO9AKwG/QTKACgGzwB7AdECTQIHAK4ASQa8Bl8AZAFaB1MDWAB6BxMBEQGnBX0ErADbAtAA5QTIAC4BWgfeAqwAbQCnBj4FiACfBCsB5ASFAUsA7gVeBcIACwHkBPAEIwHAAMUFaADuArcATQWsAIEFIgCWA0sAQgUPBicARABLBeoA4ATAAAMGrACeBWcCCgA/AEEFWQcAAAcCqgDCAdUAGwIKABwHGADsAJsBdQQyAewDWAA7APMGMQEtAuUEjADZASABHgBdBVgBggMIBTEAwQKrAE4BTQZZARsCRAG8BMYAJQVUAUMCTAGYAXoCTQBuAM4F4gEKACIAzgTQAEsHTAYXACIGbgAiBwAA7ALcADkFRQAoAPEDRgDGAvwFzgANAyIBdgAHAzIBuAcAAaEERgBVArEFewAHBU0AFAamAIUFcADvAUcAtwAnBDgAQgeaBzEACAAnAkUAqAUqAHEFiACeA4IFTQDJAI8GzAAvB1sBawfRAGwG5wQjAQIEaQC+BHgBIgByAsYFJgHgAHkDIwC7BVwFlQBHAKUDQQMVARIGRAByACUCfAD4BEYA3QNrAMsFvQLyAO4AxgSaBYwApgaIAEQAxwbCA6oAyQAvBUsAnwd0BCYA7gAyAhAGPQBCAcUEuQEuAVQB+AF3AE8DyAYxAC4EJwApB0AAyANpAG0AuQc9BTMBCQD1AjgA8gTfABsESATcAE8AeAV+AO0GWQcrAVMCRgBrAhkB5gZNACgGYgHGAA4GNQGFAiUBnAEyA5EAQwatACIAxgZuAIsF5ACxBGQAagYfBH4AKgXjANkGUgA8AMUEQAXmADcDwgA2BaMAjgEVAU8AmwFLABgFfQSTAIEEIwArAZcHhwfpAIMApAQKAEkDOQDkBFsB+wbMALcEOgRpAIUCFQHkAHICSgCnBpQAvQFLAPsFgwaCAE8AvwVoBE0APgEcBX8CQQDwBTgAwwG9ACoBHAcjBE4BYwGBAnsBPATPBIMBAASjAOMBTAFGAGsESQDABQYFlQDIBZUAOAA4BVcFXwHlBKMAIQRHAFcFVgDaBs4ASARVAdIBqAAaAkIAewHTAcYHVgC3APcExASIADkAYwJaBccAWAGMAxcAPAcUBBMA4QAbBVEHSgCcAAcFbAUEAXsBdwQHAkUA6wCnBNcDVwDZAUcASAQuAXwAKQUwACAFTwDnAfYGSQD2AxUBPgD/AckAzQfnBGoAIgGcB3sBwAQrBawArAXPAEAEIAHJAH0FSwBLBUcFIAEiAG0HnwAkBX0AcAPKBTUAYQF/A8QAAARcACwGvQFHALYFZwE3ALsFRQBDBzUBywcNBc8AiAD3BCcF0wDMBE0AxgCpBmUBwgaUAFQHSwBVBUcBogfeBEEA1gAPAvAEagALAfYESQA2BkUFQwCRAAwE9ADRBC8ACAXQAHMGOwCKBfgEcgBBBUQAJQG0BzkFHQDkBIgA3wNYAL8F7gCFAI8GBgD1A5MAJAVbAGYCRACpAdAAEQWZA2YBswRUAdIEVAHWABYCRADyBMcA6gT1AD4G2AAjAsYAzQefAEYDBQR6AOAAWQe9ANACbwC4A1AFtQBEAEUFIgDRBMYAGQahAFcGLwC7AcMBgAB5AJUHjAC+AnAGIAE7ABQFRQCBB48HnwAABMcAFQdqAGgFDgAvALgFJwWuAN8A4gQyAbkFVAXJAB0HSwBhAb8FWwB3A5AHbgBcAFAD6QAmBpcAngO7AC0F1gUgAUcAPQMqAlQBYwEcApkA8gQzAXYFbwBzBGAAiQJ9B4UBuwD+BJEGRwGrAcIA6wCCB1EAHAd3AaIFYwD3BdgAOwJ5BE0AawE9BDQCFQHLBkUATgNNAN8AugUaA1gBRQDDBTkBxQSmAM4FVAELA2EFcwDYAG4ERgKVAHwArAU5AFYHaQB5AxQF0AC9AGQFygFNADMBGQagBBMB7gC5AxcCMQDdAOoEYgceAYoFRAA9ANQFnQZqAEYC1ADQAAwEtwQjAa4FTgE9AFwHAAF2Am0APAdUAcQBZAEKA9EAEQVLAKYEOABVBpMCMQEYBSMAqwWTADsAewdtAqsAKwBVB7sA4gbRALQGQgCLAioGAwGeAKMFjAIlACIAAQbAACAHNgCtBosEFQHsAVgAYwDCA/8DaQCUAM4FhwfqAGAGKwE1AsIAJQFoBGEERwDCAFIDRgDOA7kA1AEIBkgAhAAHBUUA9QU1AH8FbwBfA30AQARjAa4BBgU/AEYCIgH0AKwDBgPWANsCDgHkBCUAOwDlBgABCgQzAfcERQBOBeEAFwbbAsUA4wD3BDgA3QWAAWUDxgC5Bm4GUgHQBs8ABwXiAGYHTgFcAIQCTwYiAawGzQCcAhUB3AbPAOwFMAETBnUAEwCbB20AxwfqAIIDgwByAiIAIgfNAR4BxQCeA0YAHQQVAKAG5wGrAFcA/gE5APADBAROAfIAJQV9AM0D5QTQAAsBtwPdAyABsAIUAEMG3wC5BUEAUwcrAesFSADsAEsCdQRYAWYHegDmAEsGngCLB/IA3QQzAf4E5AGbAKYAbARUBCMBhgDSAxYH7gBFAJkFsgXJAI8HegBEAE4FIwCeBSkFLwGsBXkAeAODAXYA6wIUBTIAYQG0B+oEtgDhBBYA4ACXBw0ETAE9ACEC1gaLAD8F4wAwAnsAVAFXBNsFSwA5BT4B/QFyABIFFgCeBqAAZAbjAOoAxgSUALoF5QY2AJsABgLfBS8BUwC8BtkDFQGuAg8BpwEVAcQArgKSBJMAjQFAAZ8CWAAyAX0FxwZDAGEBNQQAARYHwwFnAZoCFQFEALAGewFGBG0AUwXiAwQAUQTCADMGOgBDB4ABaQM0Aa8EFQE5BqAAdAEDB3sBOwPWBXEARQBxBZcBpQDlAKkFYgbUAMcA/ATuAH8DCwF4A+oDRwBOAfYEPgdvAEsARQV7AkcARwCeAkkArAbtARUBxABJBucAtwZWAZ0CxQcEAVcG4gAABo4AfwJUAHIAfwM7ADYDEgHBBAABjQMpBTAACwJYAMsH6wCOACgFeAWdADcEPACXBkUASwBWBZIDNwC5AbcArAEzAN0A2wbsAMYE2ACAAr0AYAaRAk0AFwIBAUkAzgOxAWMB5AKrAM8AoAVvAD0GnQZDALcFbQALBnoAfQRHAIoCsgBXBeoAewE8AgAE0ABRBzsA0wBFA8UDIgGcBHABXACHBN8CFQFfB1gBVgZ0AW0EzQARAWkE1gBkA7EAWAJtAKUClAABA9EAxAUvAM0FEAeyAJIDSADmBKkAngAMBIcHMAEwAk0AEAY3AFgBOwRtAIsFsQWIAKgGZwE5BpMAuQAyAr4BCgB2BSABfwOAAHwA5QZlARwC5wRoAB0DbQA7ABAGpAJDAEsAsAZCAa0GYQRyAboHkQBPAH8DmABwBscAYAUjBk0AMAQVAUoH6QBpBkAAmADVBWYAnQRmA00AYQBfBAwCqwBhAd0EmAD9BHwFRADRAGAFeAIiAV4CFQEXAK8H2wVKAB4H7gCVAyIBgwZyACYHBAGNAdoAxARUAeMAUwVABXwABAD3AtgAKQPiA/YALwDOB9AAVQIjBEcAVQSXADsARAf3BR4BYQEkBOEAeATiBUsAYQHRBN4GqgDKB30BiAaVAFYEQAG0AVgBjwYYALwBdQHKAI8GvwX1ABAFdQCTBGUBSQC7AW4HiwDdAOYBwwHAAOEFQwA5AMsBXwI5AScEewDIAUIAjQOwAB8FQQDyACwHqQOfAM8FbQDYALgCnAU1AHsBHAQ9ALQFrwY1ANAEQwC9AJ8DUgWtANMEQAGyBFgB3gWHAUkAWAUPBjwA9QJNAKwEpgDbBisBRgB5AgABFwJGAP8B6QUXANEA0wWfA9YA0ACeA1YCkwCyA3oAuQFxAFAFzADhBDEAuwfjAF0ExACGB7cAMwFKB0YAAQOdBFgAvQUrAY0AfQOlAPUBSwJUAMYAbAddBGMApgD8BPEFRABFACMF1gWbAC4FRADWAO0CwgNxAHMGlwBaAnUBfgCwAi8ATwVMAjQBVQKgAGoAiwVbASsDxwDCAy8ABwYNBE0AeANNANwAhANOAVoG0gIIAP0FzwBFAEIF9wG5AMkAXwXMAAwE5QThAHwAVQM8AHICvgDoBWkAngNeAcADzQR6APQA4QSwAngBIAZiAQYA6QSMAMkF4AB0A08A3wJrB3gBLwesANsBWABWBu4A1gDFAtgAjwNtAdQDLwDQBWACTAEiAbgEbgCrA0kARAV3BWUANQA7BTgBoAdoAMUFyQRlAf4AFwLYAKkDYACVAgcH8ACzBKYAWAN6ANMBWAD5ATEAnwA7BmkAgwOMAFsC9AAYBNUA4QFhBXQANwCqBXIFQwBhAM0DTgFhA1wAtQKfByABEwZzAN0AsQXGBM0AYQE+BmQCMQGEBUMAXAB4BEUAYgXoBSIB4QBvBdwAUwSJANsBVAH0AzwAowS2BFgAYQZuAJ0EDwEwACQEewGFBCAGJgEMAvkAOwAfBbwFQgEIAPUC5QYlADIBsQMLAzkBuAAAAzEA/wQVA+8ANQEIB4wFcAC3BSIBbwSDAKwF0wCDANoEqwAYAlsBaATZAXEAxgARBYIBUQRnA1QBSgDdBRwFKQAoAJABqQVFAF8CVAEKBqYAMAG9AXsFLwF7AeoCrAM0AVMBwgZ0AK0FtQBsAz8AwQdHAFUDfQY2ADgAogZEAN0FKwGpATgA5AZrAHMEvQAHBeAAiQamAPcESACrBuEGlwAJAiIBXwUjAYYAbgRUAWUDEACYASIAxwTkBIMBHwRHALUAywVoAG0EzQUlAIQAPgXtBsIAYwGgATkAGwRGArcAhQVEAOYADgVVAQ4EbwAiBhgGDgBGAt8AlQVNAK4AhAbuAdYA3QDBBY8BMQFxAIsFRgLWAMQAeQUyAcMGJwVFADkA5QNhAeIEeQfQADgAHgf4BGsAOACRBeoEmgAXB/gAYQFcB4gGogDhANQFtAdaACEFQwDGAI8GhAVwANgAMAPbBW0ASwCIB18AWgd7AeoB2ACVA9YA5gK7BFgAVwUlAJkCFQFtAC0DeQBUAz8AawTmAIYFcgeUAEkAWQVVAyABwAf4AEUAcgX0ACsCNwK3ALEAOAN2AHgDTwDdBJkFSgAiAfwExgB5BewA4QYEAy8B+ATQAEwBcALmAF8FnQFaAW0A4gavBUMAzgDVBRsEWAF+AFQDCwJpAKsF0wDfAL8FZgMmAXgEiwCNAEwFfwNfAK0AWQXRAGwH9ADeAwwAOgXsBUUAIgGXBM0BegDPB1YAVAFDA1kBsgQ5AHEGaAfPAEQEBAHYANwCAgSLAN8AyQXbAZcAFAQKAEcETQDDAZ8A3ADnAuUBIgFbBUoA1wWVAOgGZAFYBksA/QXMAGoAFgRKAIAGSQCkB6UBJQArBXAAHgWXABYElwB8AAMHIgDUASIFdABvBlkBZwGjB+MGTQBjBA4AWAEOBCsFmgDUAEIGhAVEAGIDUwHJAA0FSAAjB8gEBAEBAyABUgfTAGAA/QGGBFgASgdNADwFlwC/AC8FLAG1BOcExwBbBoUBxAAtBMcEFQFrBC8BmQAkBVIGEwAIACUDNQALBa0HewBvBjkAawXPAAABfwMfBncAMgErA2ABkwdtB6AAFgCUAwYGjgA1AtMAFAZtAP0CWACbAFMHRQD2Bu4AJQLgAIcE9ACFAucGWAGABSAAAASPAB4FsgBIAHYDzgAqBUwBRQNIAKoFZwcjAZYEFQF7AcwD0wJYAEYAFgTABjEA8QVJAC4FOwA0BZMA7gJ6AH8AiAXPBq0A2ADCAQABsAKkADYFSgGCB1QBJAI7APAGCgEYBuoFewCCBPYASAAXB0QAcgUOAgQB5gAPBUkAvQFkABUHLgQ8AM8AowbLBkkAJwVwAMIFewDEAKoDJQJHAFYGJQEiAacDFwJHAFsB9QJ5AkcA+ASuAC8APQfWANIB+QVTAaUAzgGkADEH3QC9Bd8A/QTsBNMAAgUyAFwB2gRzA1gAuQVEABQFiADJBiIBmQBMB9EADQXOAKAFBAR8AAQENAE6AlQBSADVARoEFQEFA1YBRwH6AbcEugBEAnEBpgAiBpMAtwTJBHABPgcwAckEFQEvBc8Ajgc7AGYApAR4BHoAIgB/BkEAcgUWBuYAnwBTBVMBuwY9AC8C/QTUADsArAEABEwBzwRAAewAlQJcAWAEXwAmBqIDwgAnByUAQgNHAJ4A1QYXAOsGUQV1AKYAWQa0AlMAxgIgAQIEaAAwAP8EtwefAB4FrgBhAeQEVAE1BEoHKwD6AL0BUgThAI0DTQALAWsC/AMVAdgA1gMJAK8BtATkAN8FIwE7ALQFpwcaABAEWADCAJ0FLwYtAIYAXwWwAhgASQAvApwFMQD+AOQEzAEzAD8AHwSxAKMCXgWAATsAkgasBzIApgAkBvQAxAEiAJgBngAHBV4FwAA5ALgHTAGlBGEBNwPYAIADRgCwAZcGSwBfBiIBXACyAx4HwgBZB3sARQBYBd8AnwOEAAwGuwCLBc4EcgFeB00ACgdJAAsBZQP4BJMA6gSOAFwAVAQ6B3oAnwUUAGABAweCBFUBbgKXAMEBTAFoAHkDcgesANgADAKfBMMAcAMWAFwFSgCNAE0GhQITAS8AjANPAH8CeAX5ADgA8AbLBSMBsAJ5ALICMQFIBTEAOAAcBUcG4gANA1wATAGoBFAFiQB9AO0GGgZNAAkAYQdgADICxgD8BcQEWAFOAeYGVgD6BqwEWAFKBw8BMwHGApoFlwC5AK8BhQIrAGQFqgBpANwBfQWJAJ0CWAFPA8IACwP2AH0F4wBUASUE5wSdAJYFiADAAPgBXgFfB8MA7gLXBFgAGgJOASIHewBGANkBLgFTBEgAmQXDApkAlgJHAEMBmwTHABsGYQH7BnwH7wAzAecCHANYAHsBtwPcALUE7AUrANYCMwCvBUgArgXNAFsBxwVsAAwDbwCLBXsBSgKiBxQA4gM5AVgGPQBFAFkFbwDLBScDCgDUBFgAOACSAzkAMAdvANkBrwIlAMEFTQC1BIAAuQVDAAEGiAHEAI8GOAfeAHMDZwECAaAHmQNPAXsBhQIPAe0GuQbMADYHgAELAnsATANYAV8C9gAwBkQAGgA6BS0F0wDlBKYA9ACzAbsAJAUnA0MAsQBmBeUE4wCxA1kBSwDHBRoGNQAiAJcDDwd7AAAEywBdBg4BUwZDADoHKAC9BBUBTgG7BTAFRQDsAOQBsQWLAPkGbQCJBZoApQCkAUYAvQH0AGUDLgAYB4IGJgDNA0wATgFTApoAJAVpBaoASQZoANwD3ABFB4gANQHDAV4EWAAsBFgAywdhAV0CwgDYAMoCgwdJADEBYQIHBcwAmAAlBTsAvwY9AKYFOwDyBckFzQAiALQB1AQAAagDKwE+ByABAQBlB3YBvwVIAKwGEARXAM4ARQOXBHEAoQXMAEkA5QVEAO4FZQHUAQIA+wPYALcEcgZDAJgANAVsADkGRABZBU0DWAABATgGmAf4AKQGhQFoAEUDSgMKAGEH5wBFALsBgwD/AiMAuwJeAfkEigVLAG0AlQTcAIkEfwItAUUA+wXyBCkAMwH9BVAFgwBCBs8AtQR3AOYAqQfBA00AnwSLAH8DbgBcAiABuwAkBvIA5wZFAPIERADdBt8AmgYKBowA5gDrBA8EWAC5BskAhQJ6AZgA/AZvBkUAvwZIAPwGbgDGAKEFUAOGAA8HbQDMBMIAUQSTACQBwgNiBmYAwwBZBjIBLALNARoBRADFA2gAeAc2BBUB2ACoAg4HqADNBSIBrARwAVwBwAP9BGgAdAJHACYHTQBVAIICOADXBaQA6gRIANQFYQB/A8UATQVLAEQGdADEBsUAKQQcBSAASQDzBakFQABIAZsGLQOsAIUCFgC0AtYAcgD+AQAEIgFTASgChwVDAHsDWAC/AxUB9wBtBfoELwHlBNQAFwLpAF8HEgBCAFQC4QBHBvoAoQL0ALAC3QRNADgFPQDuAKAH2gQVAVoBuwXEABwHUACXBOUEOQARAcIGTAHEA2gAIgfnBJkAxQaVAJYDQgG2A4sAbQD1AYUFSQC/BU0AIgDABUQAqgZ2AGgHpAQVAdwAKQI4AC0GMgQVAUYC4wDwBKMASQBTBTkFOAAvAkMAQwJfAB0D2ACLATEBzAAvBewAuQd+B0kB7gDNA7UAswMABJUARQC5BRUBpwO8BEYBDQZIAC8A2QU6AJcFAQHZAQYBsAL0ALIBwAO5AGgHzACIABEG1QClAWEBGARAAbYELAWPADYEbgBtAIsHAATPAPQAvASWA5MAbQAwBikGiwCmAGQFQwE0BmsCoABPB8wAHgWaADkHiwB4BXoAygCfAdMEWADqBJcAZQGoBIcHTQBfAJQDoAMVASIB1APAAP0FowUBAP0EagCfAJYDlgNpAGoCrADkASMATgEMA4gAtwTYAHgCUgWaAEUAcwWFBUsApAAeBQABSge9BaYAqwXPAHAGIwH0AE8EdAO9AOUEtwBIAMcGkQZ1ADMB6AM1AfUCXgHWBtoETQBKBXUA1gDgA6QAtQW5AK0B6gDhAugGdwBLANkF8wZtAJsAUwX0ANEDjQCABjYDRABZASMD2ABSA24FgACOAqsAQwGlBLEHKAHyBmcBPwAXAgAErgBPAJwGrAJNAH8CTQD8BYwAmwABAzkA7gX1AkABtwZNAAQEWwFIAP8BtQMxAUcFcACKB0MAnwAtA08B+AHfBtcAFAWFAeIEcQA+AR0G/wOkAE0FcQDEAGYHxQCaBkMGZgBUARIEJwG0B0gFNQC3AMsFZgCwAnsBKwRuBx4BaQWZAD4B5AbmAGsExwD9BpgETQCKBM0ASgHgBFMBWgdqAP4EAAHNAW0ApAIGAPkEaAChAyIBJAUrAF8FbwHFBIQAIAJ3APYEPgGZBuYACgUzAdEE4gQVAfUC9QDEADgHgwCwApUBVgBQBcQAFQGQBBQCVAByADACcQFEB4sGSABeAQoDbQVxAS4EEgFFBFgBAwNYAN8AxAWiBbsACADXARACBAH2AqsAaQDQAjMBfAczAC8CTgEcBgsFMgAaAm8AdgDlAnUC2AD+AhUB7gYlAPQBFQEzAWoGCgd6AL8H3QBhAWgETgasAG0AJAYeAqsAEwF+BK0AnwE/AXIC3QARBawF1AD3BtMA5gDfBKsAIALQAKYHfQA6BIEEEgFxBFQBRQASBp8AAQd7AYED8AUyAd8AWQY+BdMA7ATOADUDMQHzAhUBLwAgBe8AvAZAAZ4EIgFUBPMAcwdjAkQAsAKsAJoA/ASEAFEG3wA+BkkAYgX+ANEGzQL0ABMDLwHcAJcEAgbPAKoA0gYQAHoCJQC7BuICMQHCAJQEOwANBp8DlwBhAFoHWwEYBOMCCgBXBTkAHASAAREFzQBUAQ4ErgAlBasBaQA3ABUGTAEpBLMF5gA9APAG8gDuBWMGkwArAD4GUwCgB/QAaQTCB2gAPwAOAjMBYwaKARIBpQAfAkgAVQUrBCwAAAElAn0BWQTrBVgBHwCQAa8FSQAEBMIAXwUvATgAhAXjAOoEDQCfBZACVQBhAFYGSgDaBWAECgDNA00AjQAjBw0HVgBMAcEDvwDxBp4DegAwArkA/QHCACIBHgOxAKUCxQCKBAAB0QbIB8wA0QBrBTYCCgDEBAUAigWfAGsBogR8APUCQQWVAMwE6AC5AW0ASQBHB/gEwACjBaoADAdNALsAIAdLAmYBwwB6BD8GagD2ApcAoQExAVQBdgR5AiABJQWTAOIEBAEzACECQgDQAckGuwCPBpMAqgL0AEECVQBGAtgARgLIAOwEogCeANAEbQCoB4gGbQBRB0gAOQYgARgFQQBIAC0GVAHQA8AAlwQzARgHMgG7Bt4CkwCXAU0A6AQNAdEANQImB1MAOAe6AMcAdAWFBW0AKgETAzUA7AYwAlUARQAxBUUAxwVyATwEBAQWAHsATwMnBUkAdAATBVUBcQdEAHEFRwUxALIFzQC7AMUGYQEnAkYAVgJ0Ac0D2wQVASQBFgQqAxUBKwBFBTcAkgboBtQA6gV6AEgAZgJVAQ0CowBJBWEB2gTFAFkG/gB/A4EBcgKYAHQFJQACA1YBRwI5ACwHKgfPAKABTQCiBq0ALgRNAPIAJgbmABUFMQHgApoHMAA7AJAFvAExAdsDFQE7AcMG0ABJBUQAVQXgACcE5wAwAkgASwWoB3EAAgJUAWMF2QBeBQMAwADFB+EGgwBFAIQFWQKVAIUCwgC3BXAA5AGZAAsFMQB5BcUAOwB2A9QGpgA+AFkG2AIxAXYF0AAwBUQAtwDqBJMAowblAFsGeAd6AOgGWQGGAKgCOwCyBhUDcgBABckA5wTQAGYADAb6BnoAWwGUA1YGDAE4ADcF8gB8BC8ETQBnAAEHIgB8Bg0AIAOEAFcGeQChA2EBJgZ8Bh4BNgNIAHYFkwBYAaEGTwCwAo8HaADfACkEuwC0Bs0AmgZhALwGTgcyAEoAOANhAfQESwRYAEkARAbCAKEDCACUA5wAJQUGBPQAlwRwABYAHAdFAdEEgQeHAYkAtwRhAZQDVAEPA30AiwO6AVQBAAHgBJkDTAFpByUAYwCKBDgB+gMUAMMGYQADB3wAvQEZAEMFVAGNBOQEcAFVATsEUwHPAvACvQC/AGwHXgV/AdIFSACMAAED/gC5B1cA7AbWABICoQBZBqgA1QHGAIoEyANcAC0GTQD/A8wA0ACwAv0GIgE9ANoFaQAnBEUApQaUAK4FKwFuBzsAmgYzASYGBQDMBawAwwVvAV8ECAZJAA0HWAFJAHwFUwCkAkgAQAbAABAHXQRZAGMDWAEUBagAZQUgAc8FSQBPB84AUgWMADkBegPxBDEAlQZEAP8BQgBcBqoAnAEzADsAXAWIBFgAdgHmA3gEeQDbBTcAVAG7Az4ACgYvAKwBjQESAcYAAAScAE0FGAVDAJkA/gSwAoEB2AAvA9gAAQRqAoMBJgfqAAAEzAC+AKAB5wERAJgA+ASGAI8G2AAtBGEBqAKXARUBagBGBicAHAYrBucAuQANAjIGSgDeBCAApAD8BI4AcwSaARUBSgV0AFcGEAAyB0MApgAjBpAFQwBFADAGmwCYA4UGbgFpAIcEMwEDBsMALwfUBGEBRgGEA24FcAE7AAoESgBLBXYFawA7ANoDRgA+A6UApAIMA3EAbAbPAAEDsgDRBFgBugRYANIBwgCYAMYC/wNoAEcGGADxAAIGaAB4BPQASgRSBFgAYQFKBzcE6gAjBA8B4wC9AQIBXwO7APcGbwDkAdgAowGlBR4BhQXmAE4EFQE/BZ8AxgD9BGAE6wAFAE8EGQbPADUB6wPfAOoExgBBBhYAVAI1ANAFIAZ6AEsAxQNUAX4CrwYxACIDFQGIAA0FFQQOATcAvgaOAxUBpQKFAA8CRwHeBlsBsgAoBTEAfwXdAIYHPgMgAXIDIgE9AJkFSAC0Bd0ApQKoAKQCDQfyAMMAYgcxB58AzQFVAJ4AcAclAC0CIgCHBJQADAMABNMAOACpBTQEWADkBqoA5QSaAEsC6wCgBFgAPADDBDgAQQWeARUBDAUxAEsAYgVCAKQDzAAqB+4A2gT+AOQBwwD3BWcHTQBZAe4F1AIjAWMCuQCPBogAOQBfBwsHSQHNAWkANAdIAD8FlwDqBJMAbQD+BCkFSgAlAd0E8gJjAQkFLQDjBpcAAgAeBPIA6ALABXAA0AKLAC8GNQA+AOcEggCGBiIADwbeBHABkAcjAaYAjwYvAPQFxgA+BQAB0gTdAFQEFwLuAE4BzgXlAdUAjAD+BDUAbQZJADgG2AAPAj0AQAY7ACECdgOsAJwAcwZRAlgAAgSCAJgALwfHAJ4FSQdZASADFACGAK4DyAJXAL8DXwCoBa0AvgDpBtUEFQHWAKkBgwBfBosGcABUAQoDPwBcBW8AJQVOAjMAWQGdAjoDWABIALsFNAdEAGoHhQFMAU8DkQAUA7gETQCXAFMF4QChAzAAOQOjBE0AoQN6AOcEtgC5AQgASACQBQoEWACxB3AAZgdNAJ8EvgDuBUMA7QUgATkAggXaAAoExQNDAMoAwgOsAUoAZQEyAtEASwf+A2UB7gMVAVkCRADuA00AxAIKADsAOAUNAMwFEwIFAbIGJgDKAw8BewBUBFYGTQDnA1gAIgaTACIAlwEsAjMAfgCTB98ACgaFAl8AuwFDACEB7QRJAOEFewERA1QA/AICAEoDvwVwAfwFiQDTAC8FlQJfADIApgVcAOoFjwWDATgCCgAsAD4DnwA4BwgEWADjBpUAOACZBlkBLAc5B2UBRADABa4AngO5AvgATgHGBQkBvwI+AF8DdgAwAkYAegKwAL4FNQYrAdgETQDkBm0AvQExAGwAcAblBn4A6wCWBL0AJwR5BBUBNQG5ATsAgAZEAMUC9QZxAPkBRAAIA1sAtwSgAFcFoAAtACAFKwWkAN4CIAFtAKkBTAGKA7QEUwDnBNEATgRNAGwCWAB1BS8BewCCAiIGIAEAAcIGqgIXAUkGegApBk0AQAUrAGoAhAaYANYFBgbTAKQA1wYuBHABOwDSBfYEVgBmAxUB7wNMAbUAbwOwAK0BxQXLAI4CRADYAIUDIge/ANMASwcXAi0AagCfAeAABQQiAN8FVwdxAJUHegDDBBUB4QR4AWkBggcNByUAeAW/AP0EiADlBJ8A/QGbAOAAAwVZAVcEVAGsAsYEWABFAOYGDAC3Bv4EowBDBs0A0QA0BTsAowQrAMoFSwCrBoYAHAd7AYMC1ACEBsAATwPsAIcHvACqA+MAKgePA/kAOwUxAL0DbwE7AKAHewHcBCwFagBtAQ8EDwFXB/MGrAAzAXMHSABVBpMFNQA5Bk0ARAAEAwgBsgZUAZsDcQVwAOQBRgDTAU0AWAFHAmkDWAESBSUB3gLcAHYAxgb2BToAmgL5AE8AOgJ/AUMEWQeLAIMAOQZEAMMFcwVDAFcAVQRJB7gA2AA3AgQEYQH0AI8EVwCoAzkCVAHGAC8FzABFA+wEyAC7ABEF3QCcB5UATQWDB0wATgZoAM4ANAVGAsoAiAPNAJ4AHgV4BaAALQXUANgAxQM9AGQFKAK5ADEB+wEIBqoAUATkAEoBywdTAqYAVAN6AC8HbgB7Ac8DZAVuAI0AzgHnACYHPQZuAMYA5QRfA0YAMwELB90BVgFhAcwEBAZyAHgHiwBtALsFCQC3BqQHQABnBQ4A5AGgAIIFgwGbAOcCywARBQsHzwBvBkgA5QTKAHgB0ATxBUgAZQGSBFwAOgTSAPgE1AZOAT0AFQZhAIsD5QTSAH8DVQA1ARcFXwH2BNwATwNwAPYBLQc9AD4AnQYAAXACKwBtAkQAHwX0AI4ExQcPAREAkAE1AYIHUwWdAL8FVQFIAPAGzwJVAIkFtwAOAXEHSABYBUQAxwVZAbwFWQFuBwABuwYMBA8AvgOLABsE1gAAAeYGYQAmBn0FkwASBGUBtQTCAGsB9QJOBCIBbAD8BtQA0wVpANgB0AADBoYBYQJ7AZsEdQaDAdMAZQZbByYB1AB/BsMBCAAvACQETwAFB64ALwdzBqAA4AFjAGcCFQFoB2gA/QTTAPwF1ABABTMBmAA9BuAAVARUAQADSAC+BssHZgGnAMYGOQCaBAsBMAMEBO4ALgMVAVYAugawBU0AYQH1AkcFkwDCBXoAmgRUAZ8EWAB8AZIEdAGCB+wAXwZiAkIAsQUrAWIEQAFHAXMCPQIVAT4GTQD0AN8BBwW3ALUBWACmAE0FRQAhBVwFQwCrAKkBmwAkBdkGTgFFAEcH2ACKBF8B5AS+BAIAdQGnBdUAAgMyAUgF3ACQAzkAzAPsAPoBaAayANAA6wJjBpsAqAFtAEsC8gB7AWAD8AKLAOUE0wAfBUMAKwUjAKcHTQDgAeEAzwNyAcYARQNyBFgALwA7Be4AowRLAE4FQgHCBrcEegAAAd0EJgGXBMMHzwBQB2UBHwaDAbcFagBlBCMAqQVEAK4EWAAcALsFOQBfBB4F4wCbBSoB2wVAAEUAlQZyASkCwgRYAFEHPQASAV8EkgdIAAAAhwSaBW4ARAFtBUsD2ADOAOIG5wbkABoCUwBJBroAnwBkA8MB3AAzAQwDOwCIAnYBSwL8BnEADwG6BjAFQwA2BW0AOgejAOMGmwCmAAwDOACIBz8AXwUHAjUArQTqADgAMAczAVQHdgRVAdoGzwBUAWoEtAN6AFQBsQIhBo8AQgH5A/EBFQG8BCUBVgZgAdwFSQAAAYUCFQNXAOEGTQBPBoUBWAG9BKUA1QFZAtwARgUlAL4A4gYAAdoE5wTjAMoAJQbNB4kAIgBoBA8B5gNYATgDKgbqAMsBMQFIACMFLQZYAZ4GlwA4AFECNwACB70AsAI+AP4FPQWfAC4EbwFFAIwFhQJMAccFQwAJAYwFXwQ8AHMHIAE7AAYFvgQxAacCbgDIBT8ABgU9ADIFIQETAvUAQgCrAoEGUgHsACYHOAA8BJEGRAGBBDkAIQeMAAABbwNaAtwAnAC1BuoGIgG7A00APgRYAB4GSADDAI8GawfUAKwBQACLBE0AaAA0BeACJQDJALQG+wJYABIFKwBFAMUCVwaIAJwANwYqBrUAQQbNAB4FmwCEAMcHNgXHAMYA7ASsBCgAXgMKAEAERwB5B20AkgM9AHsBNAMOBpcAXgQrAVYGWwExBBUB3QBgBjsChgBcAAUEjQd6ADkAigIrA00AfADGBPUCeAEABuMAYQVyAPoDRwBYAkkA6wBKB6MFZgDGALIFNQQxAGAGwgDPBUgALwBmBmUBCgOlAqUAIgZxAJEBFQGGBosARgCYAfIA+QNOBsMAcge7AMgCcgBiBFgAcAIYAUUAxQPcAXoAVwBqAkgARAW5Bs4ATAHmAw4GyQBJAB8CIgApBk0FIgHJBpcAMgENAjEDQgCpBswA9QJHAEoHXwDEAhkAwgCXBG0CRADkBEIBRACmBFQBIAMyAf4GEQXPAL4AvgLDAAsCvwUtAY0HVgBGBpUA8AEYATUB1gFvAZABdwDUAQcCMgBOAWACWQHEATgABwL0ABoD5AHuACEGygBxAkYASwJfAJkBMQFPASwDtANWAEsAIQUzAQIGDABwA4wARQNLAPIFqQYjARAAAQPtAqgACAK5AHAAVQVjAfoB3AC9Ae4AAweAAHQEFQHtA0UGSAApBjUAOQDNBdUEWwC0BFgAKQdIADUBSAQ7AKoG0QCQBqQA7QK/BHQBTgHmAbEDQgCABGUBVAGRAn0FIgEwAEgFewA+BmUBAgMAAbgBSADlBUkGzQCxBWgA4gI5AMkHgwEyAFQGwwAqBOcBNAE4AE4Frgc/AOcEsgBjAdsBZwCMBiIBZwcAAHkDvAUlAAABNwOxAI0DfADaBIwCMQHRAEEGigJGAK4FjAB8AiYA0QGrAIEE8gBPAEAHWQGVAo8FTQA/AFQGFQZKADsAiwbVAvQAlwD3BHwGIgFtAOoEAATUAFUCQgDlBCQB1QDuAvkGzwBbARIE1wVFANYFIwFGBSkAagDLBQMCVAFnA1kBzwRYAOwAuQQQAHsGsAVWAJUBYwHgAGMHfQWVAOsA4AaBA3oBOABpBQAEiQA7Bz0AywJYAOoEIgFYABcDpwAAB30C1gDEANYDZgdoAPQAygTnBJcAvAA7BgUCqwBrAcEFyALvAB4FuwB7AdkEiQC7A9EAZQbkAxUBngRYAOoGjgBIANoF+waHAQ8AkwdyA40AqgC7BbcFowBvAf0DZgE1BIMGVwAgBigBewCVBxMBlAOVAlUBfgBRBpEATwZVBUMAwgO0ADUBHQQ3BnEArgA6B+gFowAUBm8AggG7BnwAagRYAGwEcgG/BMsARQMwBUgAFAV3AOsFSwDEAJkEaQD8AR0BNAaGAQUHuQPCAJsAygJrAnoAPgYmAQcEVwDNAXgAVgRYACMApgRMAT0EHgWMAHMA9Ab4BNMAAAFPBH0FiADbBnoA5AFCACsA1QF4BZcA9ABpA9YAQANUBjEA4gNUAY4AiwUnBcwAkgXnAIwA9wRTAZwGAAHiBBAAsAIPABEGIAbCADsA4gXsBMoAYQCVAgAEagCPB1MASQAYBVsBwAMtBYgAgAFsBXMAVQfqBWgAZQE9AscAlgV7AFQD+gWmALQB7QAzBBUBqwRYAMQEoAC8BH4A0wMKAD4AGAM9AeYFwwCbBYwAWQYCAb0BQgGSBDUB5wHgAJYHSwJJAUMHCQG6Bk0AWABEA9wEWwE1AcwE8AUgAEwBfwQCABIDhAA/A7UDrQCZANAE+ASgAKwBMQDJAlsAIgDiBCgGewDdAhUB3wXTAAAEiAByAk0A8ASXACED1gBEBUsASQBZAu4AuQcZAk0AuwBJBUkHWAHqBuIAKwD0BfwFpgDAAM0HSARNADUB2ALOAC8FRQdXAP4DFQF0AXIC+waqAGQBxAfcBBYAMgDQBbMDRwDFALcESADOAQoAwgJLAJgFYAQcALwFhQFlAVwDpAD+BI4HSwAzAdEG3wCuBd0AkwNHAakEXQWTABEBogOKBUMAbwD8BtIArAVeBg8AVQD+AVkBGwRqAOoEUgWOANgAPAPEB18A3wDQBFoD8AAIA9cAKgXMAPQA5wJ6AkcAzgcxALICZgGaBaMAlwZEALYHVwAGBUgAxwTyALMCRwBGAakESwSDAZgH9QAAAZIEOwBCB9gEWAC9ADkGVAGMA0QArQFVBFgASwMiAUYCbgBGAqQAEQRYAFwASQZtAAwDbwHxA3QGgQDBAosACQRYAA0HZQHYADID5ARWAFAFygAqBiMBFwIwAGgArAVIAB8CWQFfBwoAHgTvBhgA9ACdAlkBLQZMAe8C3QA0BjQFIAH2BnUBIgH3BGkAVAQQAOYGRgLOACsAJgZJAFsFXwSZAE4BVgJFBBUBvgCKBgEGlwBpALIDlAAqBaMFcAAKAbwD3wCsBg8BKQOxAEkGIgAaA4AB2gQzAdQGSAAyB/UCMQBXA0cAKAYdAVgBnQXCAJADIAGeBeMAJAVvAZQEzACuBmMDEQBWAcUEUgJUAdYGgQAFAOAFowKrAOoFrABhBroATgaXAFcAQQKHBnAAOwF6A7kB5gAnAGkHSAAvAm0AQQPMAKsFCgdFADwA0ARGAJ4CmgOfAG0AXAIkBSABCgZqAG8BvAXIBFQBUQSAAU0AXAS8AlgApQBmArsDBAGkBzAARADxBrIDeQAIBkUAnAYbARcCRgAzAWsEmwTpAP0GogDOBE0A4wNYALIA2QVMANQCbwBZBkoFMgCmAPUGDAGeB7IF4wDiAKEGOQVDAOcGVQF7AXwDngCqB4gDJAB7AUgDUwIgAfQCWABaBaYAMAB/BfgEnwCdBrIAeAatALACGwCJAxIB2AB1A98AIARtADcGxwAVBSYBZQexAJYB/gDuBl4FIABwAxgAIgAgBa0CWABdBmUBRgLTAFcFDwFFAJUFRAC7Ae4CiwAXBpUAcgBVBw0GOACnBSUAVgVDAC4BggcvAAsF8gDBBK4FbQCBBHIA3AEaAZsA/gTyAnQBqQVDAM0BewBTAWsHewGHAjkA/QN1AAkHRAAvAoAATwPlBiUBBQNYATwBzASFAu4AVQAEAmMCgwHnBlYAbQCKAgsGyACoBEAAXQIxAcYFNwCZAXsBPwDxAs0AGAJPAY4FbQBqAjgAGAUfBAYBCQDUAgsBfgdhAU8ENQd7AAYHcQC9ACIHSQD/AYgGIAF3BVcAhADABcYAbwR7AcYDSAA4A/QAEAOCA00AmAFWAcoAewWVAL0HEwJPAZ0FTQBJAIgHnQR5ACUAcgWeBj0BJAPWAHwAewWWAdYAVAHWBHABxQQHAkQAYQBxA+QEdwBtAEcHoQXPAMIFVgCYADEH1AD+BSsAuAVNBc0AhADaBgkAZQOTATEBzgCEBo4B3ADRALUFOwACB0oESAH0AHAEMwG5AbUAXwe9AUIAUwGwBcAFQwC4AHYEzwADBu0GTQAlANUBhALYALoEDgCYAPABmABRBpEGRgF9AMMB2AC3AaYAKgUCBL0AfAUTATgAgAVDAScCNwMIAJACBAEAAX8ERwdwACQBDQV3BXoAZQHFBNEA+QZhAc8EbwHdBFkBJQMxBUQAlQBYBVUCmgBUBIsA1AD+BC0B7wRtALUEUQQgATMBcwRiA1QBrAQSAbsAdQUrAOsC/wVLAF0EdwC7B8UA6gDBA0QAQgfeBEkAfQAcB/0EwAAaApMA4wCLBXgDiwBXADgE4QNYAHsBrwP0AGgEWQFdB1gCqgBFAN4EXQZZAYAEWAG9BZoARAAfAhQFKwALAa0GngO6AFMAJwNMAlUA9wC7BTUBxwYnB1oB3AAeA4QATQXhAI0FjAJWAYcBzgM6BlYAOwByBfQA6AHhAIEFXgSLALUAPQSbABYE5wSkAL0AbQTWBW4AgwC0B70GpgAcADMF4QClAuUE0QCaAPcEZgXOAN4ERABEBiIB4gVEAEEEWADRAI4F9ACiBHQB9QLsAMcEjgNZAVgAkwOUA3gBAgHdBGMGIAHaAkcAIgDSBpkEWAAVA7cAkQZ+AFYDVAFbBBUBbQSZAAoGzQBIACECcgBBAtUA0gFYAm0AFgRNAFQBewTOAMMH4ABdBzkAHwaCAb8DxgD5BigB2QG9ANgBIwDQBCAA8gRZATsEOwBmBJgA2AVtAxUBEgeUAGwA1gXaACIHEAJoAdwFSwCxA1gBLAWyACwEhwF8AM0DSQCHBn4A5AF2AlgA+QEzABUFvwBbAbACrARZAfQA8gNKAOEFOgUcAC8AFwLGAFQFhAC3BM0AWQYoA9oASQAfBdgAtQLYAP8CDwZNAEgAWQW4AOcGQwGwBAABvAYDAk4BuwEzAP4EsgD0AFACNwVwAAQECAAeASwGFgMKAI4A/gU6Bg8BxgBfBTMAEwPKAI4FhgGrBwcFkwDmAHsFVAGyBJkDSQHKAGEGVAGEBDsAQQVMBhMAvQEDAWYGKwH0AN4BlAA3BtsETQC7AOoEUQTcAEQARgXsAIQD0QAQB64AtwQ5AKsCRQByBnoF0wBHAHMEFgSaAHQEFQHkBksAQgQVATUBaQNmAI8CuAZKABQDWACTAC8FwQQoAGQA2AbnAi8BXABRBp8AzgHcBHIBBQTCADMETQAEBnUA0QCrBRoDTQCmARUBhwSLAJACMAE4AFkFFQGLA7wAeQMFBIsA4wRNALcCRwCUAIEFdgWbAHkHzgC9ALEHOwAwBwQEeAFKBh4BtwCNBoMHSADUAk0ASQd+AGsB5wJjAGoGQQVIANEALQV8AC8FzgDOBcgFOwA+AD8FXgUJAckAAQdOAWcGPQUhAewAwgf+AFsGXQbFAOMAJAZDBU0AbQDQBCMGbgAqBdQAPAeqAJwDCgC6BW0AeQOLAKgFSwBHALABzADDB3EGgwEiABIFeAWDAEgAuAakAAAEHwG3BLsAnwHYANIDSACiBlsBPQJJABkHiQRNALUAGgORBFgAbQBVA7IH0AApAe4EwgOjAE8Ahwd8AAUHLgVFAFgAdwOnACcCyAFYANUEgAEgAXMEkgVTACMAPgOZAXoBfgBzAlUGqgDUBHgBewGUBHMGIgEDB4sAbwIxAcMDCgBIALUH6QIKADkAaQPgAEAHRABQBtUGowAAAVoHawXUAM4AvgI+AfIErwVEAK8CMQF2AVEDiQGWAHcAZQPrALQHPQAjB2UBlQIvAOUCZQVtAbkHwgAzB5cAagNYAAQE/gA1ApMAPACYBQ8B4QFvAGEGZgXPAEgBogdLACMFAQYeAfMDWAC8AlcAuQF5ADkAiQM/AVYEvwZKANUDFQFTAkcA2wJgAK4GzwBWBkkBOQasAE4BSAJ1ABMFAQNxAH4EWADsAOAGugdtAKYHIwFEAFMFBwRYADsAmQUxBCUAbQBzBGEAxAd8BUsAZgQlAMUFIgEZBswAbQfTADsBPwM4B4gAHgXUAOAGJQBUAbkEQwclAL0A3gJEAGIFCwRNAPIBCgD4AtYA6wC8BoUCCABbAXAExwRlAQQDIgG6AfQAxwPwAIgAJAUUBYMBaABUA0IETwFEAFsFTwZCAVQBqgE5AfgBhwIcAIYAzQcaAyIBgQRZAT4AJAWeAOMF3QDSAeYFJQDDAXcA4gOLABIFMACBAZsBYwagADcHSQHqBgAAYQGFAhABbgUvAPkB9QMKADIAygZjA1kBOAAhBRMGdABtAU8EiAbKANgAOANcAEYDkgMlAKQA7ATHA1QBygC3BFoEFQFIAEUFmQN0AS0EoAA5BTAB/gAWB9QEgwF7AVoCOQCPBeUEIgF+BjoAjgJLAAsBkwVJAN4FTQIxAYwAsAbNAWgAuwAsBccAJQUiAZ4DVAFaA20AqwNsAHIHeAMYAFsBQwTWBZMAaQBUAxYFMgA/AP4G7AB/A50HQQC8A1gAIgCjBOcFdABwBZUAYQHGBGQHygDFB8UAHgdYAU8DIAGWBZMAZwCTBs0AfwZ2B8MAuQFMAbUA5gY/BCABvQDCB9gAWAJOAXsCeAO5AGQFSgB/ALACfwYjARkFywC0AVkBSwDdBRAC6gDgBC4BuwciAcIEQAE1AFYHCAZLAEYA6AMUBiAB/gMiAUIFQQBXAFECVAE7BC8ADAWCBDkBUgK5ALcFbwD/A3sAbwPCACsBkwbhAOoFWAHEAUMGYwBmBcwAbAJ1AT4AKAV7AZwEKwO5ALoFjAAqBlcAOQD5AzIAOwXgAFEGYARNAJcASQVGADkD0QBFA5IC3AC7AFMF5wBqBnMDdwB9BcoAPgdJAXsBFQRmAPYF0gB5BzUCIAGHAYQDYQFiBWEBUAZJAEIFigVIAE4BcwRpAjMAoAesANUAqQIlAakEjwDYBU4CJQDrAyUApQJNAG4FVgBjAK4DbQA9BsYArAW1AAMHSABcBmMBawMzA1gAYgNYAZwELAHPBj0ATAIEAUEGIwE1AP8E9ACxBNICJQB+A2UBOgUYABIB8QN/A8IAlAExAbgDRwCBBG8BYQGIBUsA3gW3BeMA1gAuAoEEPAAnBdQAugVqAB4FnwDCAyIBWwGtBnwAcgInB/gASwAfBcEEiwAFBCsByQExAQwFNQC9ABMDNQEqBnQCiwDGADgHfwJHAFgAKgQABMkAZgcAAFwAhQN/Au8A/AYgAS8ARwVbBUEA2AB2A5oAKAW8BUAArgXQAGwA0QYoBuEANwVBAPQAygMrAHsFKwXHAE4GegDsBGoAzQPMAA0DYABIADAHzwJ3AFgALAOcAL4CBQHkBLQE/gAHBc4AOgZNACsBvgM5AGwF7wDFBKcC3ABoAPwE1AasAEwAZQN5BFkBeAXTAAABxgStAGcHGQPWAMgDnwCYAL0F2AatALkA1AK9ADYEzgIVATsAqgUoATgGSQCaBroBWAFYBUMA3QDwBPsDCgBpBXAAIwDFBBMAHgTYAK4DUgIUAEUA3gVcAHAD0QDtBXsBxwFDAcoDxgC3BMIAbgTnBncAKwVtAHUHJQBYADgEUAdIAIgGkwB4BFgAYQFyAocBuwU5AGsDWwHRBNkBkwBJBxUA/AQjAdIA/QQgB24AAAZqAEYAuQNABWMAMAdEAJ8FEgB2BZcA+QEyAJcCRwC0A1cAEgGQAW0AOQbXAc8A0AATAwQHBQA4AMYFEwIzABMEFgC6B3oACgZvAEwA1gTNAOgCxgRBAAABCwRhBnEAlQB/BpAGSgBAB4sAYQAPBzoAPQO9BSIBNQA1Bf4EmgDsALEFWQGkAtUAcAN1BmQApQJqAB4B+AUzAXsFvARHAXUArQXSBUoAkgEVAToEewBjAZsCOACSBUsA5QWhACkERwCdA28AKQRUAaEEegXRAEkAkgcnBUMApQKsAOoAfwOGAAEESQDBBh8HDwCHBUQAOQVwADYGQwCEAPgETgFKAmUDTQDMAHICUwFMBGgALwUvAPUCtweLAOwAvAZSAk0AzwHVAMUE9gCOBrcA4wFNAHsAsgNIAGIF1AaMAEYA1wKFBaoAMwHVBuwAMgL2A2UBiARMAHYFLwH6AFgHxAA8BbkBfgBpBUQAOgQrAUkAmAUiAA8H4gRNAI0DcAHIAysBLgVBADUB+AFYBkQAbQByBJEG0ADRANAGYwC3BAABywf4BkkAVwLWAOIFQwCIAMsE3ACjBBUGrAB9AI8GQAU/AJMAzgVnBBUBhARWAI0BZQFwBawAvQA+BjAAlAZ5BWoAjQJAASsA9gRHAYADPQCsAT0AqgbmAO8FVAXTAEQAqwY7AC8CnwSzAB4GSQBVArIA3wDeBK4FQwCGB5cAVwNOAYwAPAUtADUFXwRCAZEDNAEhAZ0FXwaDAbsA7QXGAC0FRgayANYAqAM4BTcABwIzAHsAeAdtBjEA9QMOADsAnQdTAAIDIgRNAP0BKwFxBkIB8gCSBC8ABwLDAN8FtAFlAcwAoAX6AcIAOwAVBmkGSgBHAD4DDQAhBZkEIgE1AEgG3QBgAm8BWASRB18AQwRYAIEEWAFDAbACFQFcBBMASQMsAM4HbQAlA1AHSQCsB0oApAZNAP4DTQDHAD8GYAFyAvIEQwBpAKEDIwYiAWQAawRFAKsGSQdJASIA2QH0AOsClAJHAEYA8AFbALcC1gVrAC8A+QI4AE4CWALcALIDVgDLBksABwSLAPEEMAAQAL4C1gVvAMABaQAuAD4D4wQhAcUBVgB/AlcAWgJrAXgFAgHTAKMGvQLWAGEB5gaaBXEA+QX4ABoGMABQBYgAfwDlBo8GiwBtANIBRQDyBW8AxgLTAAMGfgNYAawAtAVEAGQFzQO5ACoFowCKBT0A+AP0AOcE4QBGBx0BEgBlB44AdQV9ADUHRgBcAr0ATwORA8IAWgW7AE8AJQdUASIEeAOAAFsBuQIrAIgDiQXjAHgGMgDQAK4GMwEeBcgEegDsBUAAJwVEAIYBNgdKANQFPwRlASkEsgB3BYsAiAZ8ADcAgQcYBAQBzAAtBXgAJQZRBXQASQagADMBJwXxAkIACQU1AIUCWwGkAIkF7ADCBkcAqwMHACcCrARvAUoAzgHfALQF1QCNAnYAVQczAfoFpgDqBGwArgUUBnEAmAJHAJoEWQFLAE4C4AAhBtgAUAO0B8IATwaDAdkBQgCCBFQBNAN6AXAB1AJIAEIGHQdJAAgAuQISBTYA9gNNANAAtwRIAIAGRQDkBCIBWQY+BSIBewHHAjIB2gTFBcUAKwVEAIEEKAAABCQBrARCAZ4ALgaoBWYBkwQWAG8GOAAuBSMAPwC9AbEAWAbwACYGSQDDBWYF0wB3AYgFRQD7BkoAUwVVAYIDewEDBGcAqQHmAUIAbQDJBS4HHgFhARMH/QTOAIwAtwTlBJcAOQDnBnsAXwXQAP0FSACFB3sETQCGADgDRABcBVsADATJA9gAJAQxAFQBywSPBsUAZQFWB0kHfwBUAW4DxgdNABAAzgaPBXABbwDJBUcA8AEWAJwH2ABzAnwAVgatAPMFJgIiASAFMQBmBosAagD8BFgDewAVA1UA3ACpAVcEWAHKAUMAggJ6AGwDTAGYAMkGqAVEAMUB9QA/AkcAuwA/BVwAawQPB/kAMwF/Aj4AHgVjAxUBwwF5AGgCqwCuAMoCNAXPAL0AfASIAjIAOwC+BiEGKwFUAL8BmwW3AHcFZwDsBMwAwAQ8AEgA8wXTBIMB5AHQACUB6wKqBqwAwwY6AWgD9ABkByMBLwQ0AVsBvwTKAPcEuwAMA74HrQD0ALAEVwVFAVAFrgC+ANYDOAByBkQAIQWkBTEAewG/BBoAYwIrAFUCmgNjAG0AkQf0AHEDIgJYAMgDfgEwB0MA1gExAYcFKwDcAPYBEwRYADsAAgMSBj0A8AEgAeAAsQUVBE0AOQDiBD4B+wVPA5MAVAGVBJgAYQZLALsFAAGdBeEDVwBIAJoGewFNBJcDFQFfBV8AAAEFB34D9gDbBnsAmgXdANgDWACeAJ8HDQZEAOEAhgY5AFED7gB2AmEAPgZjANgBFQL0ADwEUgFWAiABbQBnB8cAxAXoAk0AcQYlAOEGDwBMARkCmAAUBuIFSQDaAJ4DPQC1B3YBawepAyIBSQBkBbACwgANBdMAsQetACsBsgO9AygASQB4BjkArASSA58AqAdqAF4DdQHMAAYGHgWTADMB1gU6BRMAPwHZBPQAbgKoB24A9ACpBCEB+gTOBXEAAAUyAE4GiwB7AfcCxwDYBWsCVQCxAPgEsAJfAEUAUAY5Bs0AMAZDAKYAtAXIAlUAIgAhB8YAqQJ2BXEAdANoAKcAOgYgBh0BVwa3AN0AYQdkAbACgAA0BmEB4QS2A9gAPgDkATAANQWVAO0FJwLCAEcFMgAYBUQAbwBwBlAFugBiAH8DxgW3ADkAXwZJANkFaQBGA6ECVQCoAasABgbPAC4AAgaMBUMAWwFyAloHTQCXAAYC+AZIAEgAtgH0AEkEgwCeA2wFIQEeAJEF3AVFALoFiQCGByIBMQEAAs0FgwFEAFMGnwAFBGUB8QGRBZkAoQXUAFgA1ANMAW0EqgAfAlcGcgBPAGYD0gVJAHIArQVHBBUBYwa7AKUAnwH5ATUAagHXBIMAbgScABIHAARoAK8BTABlBs8A+QIxAGUBWgZEAGYCfwOwAEwAcgJ9AHICNQEwA80A0wVIAKcGYARbAawDTQA7AIUHIgV1AL0AmgY5AH4DeACyA6YDCgDfAAEDXACAAnYBogQ1BoEAygANBaEEiwDqAAwEvgQlAL8A0wVLAJUG0QCjBUAGQwDaA1gAIAfUAMMAbAS6A1gAbQBCBp8EIgBvAJ4CDwdfAAIAFgNmBDEB2AB9A+YD+QAQB9MAtQQgAbUApwV4B3kA1AAkBRkDIgESAf0D8gC8BRAAXwOSAzEB3wA/BogCPQCZAxAABwUhAUwDVAEnATgGZgCJAuEAqANMAfgBAQYvAUAA3QZEAOUFiAJKADUGiwChBFgBbQBTAnQACQd7BSMBRgLGAKcABgJlAaQDjgdbADADSQFfBCgAdgfhAEUGQwApBU4BOQD2BPgEaAAlAsIA1gPFAP0EzACWAwQBPgWXAEUAiAc0BdMAKwBqBiIB8gR1BFQBrAWTAMgD4ADhAEQFPwQrAHQDBAEdBE0AhgIVAVQBdwJUAbADIgB3BB0FLQHWA60AyQc9AYoEIgHyAjcALgVLAN8ATQVBANAE3wAzB08GcQBJBt4AnwCjBOIADQX0AL8DTwC6BBEBvwHuAH4EgAUdAFkBkgQzAfsGbQBWAtgAcgM5ALwFkQc8AKYA1QUiAMMEhgJNAIYAUwexAJkEVAHgBHsBCQNFAEUFRACYBYcFKgD6AhUBpACwBWMBSALGAAwGAAGnBFUBUwS/BVsBAAFyAsIETQDOByUAGgBMB9AApQJnALIDPAA+BvMBFQE+AGAH+wbCAOYA6AM9AFUGaQAFBCcCgQHEAGEGWAGKBiUFygBHANAEVwNXALEAyQMNBkoAAAHkBOEAXAJDAeAEbgDQBCgGwgBUAWQETgFxAykF5gDcAPkCtQAHBb4GJQBEAPYBuQHqAL0DEgG2BVoBsQBuBHsBZQJjAKoDPgfUAAABoAdEAC0GkwRUAXYB2gQABDcBpAAbBUUApgSkAMEH0QAABJEExADCBE4BxwANBR0EIgEvAKYFhAApBA8HTQD0ABsDNQaCAGMDEwAiALwFRQCuBcABSQHMABEFtQAMBPQAXwKEBQkBhgC3BDYD2ACfAEkG5wAyAtQADQVuAKAFWAC7AggBxwZ9AP0BlgRVAc4AMwc7AC0D+QEtAFUASQIwBUEAYwYjABACgwEEBnQAyQARBQkAMgI+AWAEYQHBAUUAsAaeAJcEfwG8A1cAhgZlBFgAMwEhBysAIAWMADoHtAe/AP8DxgBHAJgDOwc3AD0ATgIaAiABRwdEACIAjwcwACkGMgE/AigERwCyABYELQRlAH0EIAFQBSEBewE/BEQAKAdEAHIGwgZNAFwBKwMsAHEHhQKAAakFSwBaBbwAMQERAn8HIgGnAOYGAAImAKsA2QKJBxAAzAQBADYDiwDjACgFVAGtBCIAkQNrBzIA0QYjAdIAAATsANAEsQb8AOUEpADgAO4GlAY1AOsBFQHtABACJARHAP8DoAB7AX4DhwNYACIAWQK4AVgAMQGiA3YB6QL5AUUArgApBGICZQEtAiYAVQE9BIMFHgG9BW0A5wB7BqwA/AMMAXYGAgAIAuUCFQGWA5sAOgegAG0HvwBAAlgAYARLAEgBzAaQAuoAZQQRAOQBsgDhBCUBpACQA0oAmgY1BTEAoQXTAGMAIAKtBHUBRgHrAnYBcgTkBEQATwG3A+UEmQAIBTUAKwfCADgHegB8AGUF9AB6A4gFTQALAAQFYwMXAHwAXwUrAE4CxARNAO8DLADqALwFSwBQBosAkwbhAPcE/gTTAM4EwgBYARsCxgANBZECFQFgAL4C4wDCA/QAogEKB4sA1wNYAEMBywdOAaUDWAFwB7gHgwHhAOADPgV5AH0FaABvBE4BOAOsAAABogMMAZMC3wBcB/gEzgA1AW4FXABRAzMBvAanAIoG5AEiAZED3AA8APkDGgcqAc0EWAC8AMMGzACsBXwCEwGbAMUFMQVLAEUAVQWOBEYBXQNYAKcAXgcuANkBfQGiBKMENAGmBkAAYAcjAWYAIAcXBBUB2AAxAooDawBoAJUHzADOBUQAcwVOAxUBMgC4BSUA9wPlAOgCUQNYAUkAjAUXBYMBYQGnBC8A/wSrAAQDlgd6ACoGIAFpAHwEAAFcB0AFIwFeBMMAygeqAPQA3QSAAdkEIgADB+wApAMiAIoG4gAMBmgB7gIkArkAOABFBTIBWweYAN4CsQBvBM0GPwBWBsIAYgbTAGcEJgCZBSUATwHoAlEDKACtANAE5QSVAJgA7ARJANoF5AZEAMEEwgAdAKYEPAYGAFkBHAJWBZUASACSBroCFQEMBroARQA0BzECwgAWB+oAmwQgAXcFHQF5BdQABgdvAGsEAwFTAMcHIAU1ANgAAQImBFgALAc8APwCRwFEABYCOwAjAvQAHQJMAQwEDQN5AT4ADAOoBUEAOQRYADUAuAVcAkcAfgV5AUgA8QYWBHEALwCFAuoA1AJjAwoA6QUTAIwHXwFgBosAzACjBkUAfAUvAJoHWQGhBI0FHgFrAWMF+AS7AEkAxQLdAM0BZQHnBmYHJQDdATEB6wCVAscGqgDQAEUDWAJwANYALQM/BaYAjAD1BicGsAAJAhUBDAUyAEwBxQS5BUsARACqBfQA6QE/AJ4CfQciASsBoQOSBKAAOwdIAOQE7gASBksA6AYqAd4EZgFVAOgCmgVvAGMBDAO2BysB/wVEAPQAuQOdATEBMwfNALsANAUQALABHQCVBSIARwWABVMAiwBRBowETQA5BqYAUwCyA+MAnwHVAHMCNQAaBbEF0AAaAO8GFgUxAKQA9wRLACMGVQGvB2EANgdxAJ4CYAdNAKwA6QS9AFEGrgC6BUUAGAXNA4UBRgA/A7gAjAeTAsIAeANmALEAPAOfAHkDdgAuB5EAaAcvAPEEhQDFBXsBzASsAE0GDQO0AC4FSQBJACEFugJNAEQAhwbsAJwGbQVYASIBqQFFB0AAAgTCAEkA8gTJAtYASQBLBdIALwWjBC8BRAVDAJYGgQBHBZUAjwA+BcoFMQCxAPMF0gU9AJcAOAQhBE0AzgAgBzgAvAWQAX4BjgW/AD4FlQDQAKEF8gDxA18BbgWjA1gAwwFMATEFSQA5ABwCVAGCA1kECgA5ABcFkwUxAD4AVQJ0B9MAiAE1BMMAbgdYAEICWANVAEgArAHxBC0ANQFTBMADXQFbA9wAGgJGAN8A/wGsATcAPwABA/IFQwBiBUMAKwFsBGkAqgOeA4sArACZB9AAKAXJAHsF6gClBMQA/AW7By8BIwVDAPQARwMrBUsALwQVAd8AigQAAQ4EWAEkB3YAAQYgBFgA9QRXAcsDCgC5AS8BAAB8BDEBHwNJAKcGSQDdBgYETQAIApkAYABqAuUExwCQAusAhAD9BKQAngUGBUoALQdIAAABlQQwAoUBPgSIAVUCOgAiAQEEagDRBvQA9QIwBUkAbgCdAysHiwDhBG0AOQAmBigEIAFaAQQCPQAZB/4AYgW9AZMA+gDDAuoFZgA7AJIDOwNAAZYFIwGsATIAewCHBEwEWAAmAqsAxQFVAIwEqQB0ABAFOAAGBZ0EegDcAMIDdQBzB18CMgB7AVgEWQGCA/ADRwAuAFMC4QBgBZkA/AROBnsAWwE+BtwBewDDAGYGLwAvAv0F1AA5AE8G6wVwAC4FQwASAeUDSQDdBTsAQAYEBnMAMgFpB5UCWAGaBGUBQgE9AnYFpgA+AlgAYQGPBJgAIgb5BXEB1gCgAvACaQDnBnEA6gCmB1oDWAFmB3kABgdtAGMAZwdbABoCNQdNAAAE4wAaBTEAAAHEBNgAtgHHAIkF7AD8A28E2AC0A1gA5gAxBrQBJQDrACYGTQfiAI8GAADIA3sABgQAAWEBvAYNBzkAuAQVAeoAJgatA1gAwANNAEgApQY4AFAGZgDuAmkACwTLBy4BlAA2BAQE9ABbAU8EiALcALcHegC5ATEBAAErB4cHaAHsBKMAhwfrAK4CqwCzAiUASAAhBY4HMwFJBogA6QbFAFgAqgSuBUgA0AbMAEUALwJpBkkAMAZwAP4ELwEjAxUBrADOAfEFcADqBIgARgAYAwABzgQhAcEF4QA5B8YAewW+ACkEYQRcAQ0GRQCTAO0FRABCBTgFSAAjBqAAtwDJBcYCRwDeBkUAuwAFBpQFGQBYB+MAOQCTBIgB9AauAyIBXAC6B84E9ABjBqwA7ATQANADOQEGAfUCQAXGAOsAbgSMADUH9QLCAHEAcwTwBG4BNgUjAW8GJQArADkDMgElBDgAMQT5AUkAWAZIAFYCRwAGB2oAdgVuAOAAwgfAAJ4FYAGwAvkF5QDXBUsAYQdfADMHJgFqAJAHiAKsAAEDRwA7ANsFOwAhBc4FzwC9AFQEZgY1AOAB1QCXB4sAawJ7AJgASQU6BJ8A2gEVATsA1QGhBz0AYQGTB8ECwgAoA1gAhgP0ACYGTQCRA9sAIAfMADIBwAMzARIHrAFEAMIAxAOEAD0GYQV1ANgAegTnAL4FOwCoAcYBFQHsACYGSAB8BVYCoAA7ANQFCgIVAdgADgONACECVgCrAmEBuQOmAHMESABCBd8AZQP2AqoAxgAVB+4A9QKkBBsAjgJDAIQALwUKB20AZgJwAAAB5AHQADQFjgRHAewE1ABdBPQATAHrAqMAnwEWB8IANwRMAQ8HZgC1BJMA1ABZBngFYQDfAG0EpwDbAXwGzwCMATEB3ANtAGMBBgI/BY4A4AACBNwFRAC8ByYARgBbAjABPwLqBMgACAPWABgDIgFkBZMANgXQAGYAxgdFAEQFyQayAAgAsALWBlcAqwCPAtQAqwX0BTIAwABZBhoAXgNMAX8DdgJxAEYBvQQXAMwHIgATA9cDlwBIAGQFPgfyAMMC3ACYAOUE2ABDAjgApgQPB3cA1gElAJEAbQTzBDIAzQHCACsBugO+A1gAewFEBNgGcAC5A1gB4QB0Bn8DBAFFBjMHjwbZAvUCwALGBLwGxAJgBOAGJgYhBI8C0QEvBVkGrQEKBkIGMgNuBUoEVAZmBX0D5gGQBbkBUAaNA4sCHgbZAV4EhwRFBrsFYAXBB38C3gRXBdkD3gGwAiMGPQZbBbgDywY+A08GUgPuA18G9gPkBGoGAQchBLwFlALeBakFOwbqBdsBtgP/AzYF7gF7AtAEdgWqBscEkgQiBsIDzQXFASsFAQISA0wHZAWoB1IGvgHDAaABqwEgBt4FngLkBFwCKwXdBTgF5AHBBSUDbQUaBAQEHgIuB+sGxgOnBccFzgP1BXMErAMkBxQEZgTcBT0DggSjBGoCoQM+A6kBFQN3BkEH4gGzBCIHkALgBngHggL+AzIClwFgBpsEsAKPB+oFBATOBJUDAQTNAvgBOgScB1MHugOtBMQBVwV4BP8DbgfWBXIFFgQhBaYD1wSOAnYFcwaEBpIFvQG6BFYGJAJOA2gCFQcOBn0DqQN9BVkHhwThBosBNwNpBPgE7gGqAs4EeAU2BtYFIwbkBNoExQRWB14HJALABPwC/wOdBDcHggenB6wE5QJfBp8Ehwd0A6kEOwfEBF8H+wbwBs4DyQL4BBQG8QZOBCEHsAImBnMEVQU5A6MEmQafAVAH/QQ6AngDcgPBB94ELQY7BxgHrAZcAg0GwgMUBqkBDQTyA5sE5AEGBxQGPQX2ArcFIwV0A7EFgQelBLYC7AUZBKIExQEFB98DfAKwAtkEGgKJBSkEfQMMB44BgQftBOQE3QLiBfADkAVzBMsCxAOXAVQEigVXB1MCjAWIB5UCYAZiBz4GlAMsBBcDgQJMBFUGVQL/AdAEAgSqA+YBxgTzA3QD1gPFB90C9gQfBPgGFALnAuQE6wHqBfoGtASIBGsEcQNjApEHrgV5AuQC1wE2A3AFkgTFBIwFxgK0AnICjwTYBJoExwRABMMFrwXOBbAHzAKxBYoELgTrA1oCuwI2B4UECAZ2BbkD0QLNBTMEtAEKA3MD+gWuBd4FmQRNBTAHCwTFATICtwQBBDwDngO7AZ0DhAJJBTkGHgOuBwgGMgICAxIDHgRxBvMBZgNxBlcFRQe8AlgEeAWkAfgDcgQYBXoC3AOwArEHIgbPAoIDlgJLBcsHUAJKBlMHzQHNBIUCCAfMBC0EJQKXBFgDuwbBBDsEPgUEAw0E5gbzAqQGnANNBLEHLwUqBs0FDwdjApIDfAN9BMEGAAebAXkHnQTiBD4GoQRJAucCXAevBX0ENgPmAYcHTwOLBO4FkAOLB/8DkwaxB3AG2wIZA3kD7gKLBK0EXgVdB0UGwgPVBOQEsgOcB+wB2gRfAgcHwQTwAzoGkQJMA6gExAQCAxUHhQO2Bk0GqwPQBMkDTQVmBdEB1gK4BbIFJAN1BkQGHwQ4BZUEUQbRA0QEHwVXB80FUwdGAqwF6wUUBmsDqASZBhgDuQcMA0UGOQMBA6YFUwLHBlIEwAGoBfAB3gKfB5wE1wEtA2AFIQafAg0HoATLB5wGjQPSA7EFbgcbBOUDRwQPBH0EwAXGAqoFLgSzBGkEvAWQAuQBsALDBCsFIwTYBgQDIQcTA/8D9gGuBWkDXwfAA/gGQQVdBJYHzwTTBAIEeASABBIEyAMcA4AEmARxBA4EYQTgBfEFXAJfAvECUwI4BioG7gI/Bb0BSQdQBQIHngKsAdkBOgR6BB0HsgdxApIEOwRTBC4HugPEAh8G5gGmBeID0gEXBdAF4wMnBOcBYgQeBWwEJAJHBBcHPwNjBjAGUQTWBHsHngVPAnsCLgWwAaMEMgK0B40DlwTQBFgGvQEGB0cHSwKoBE4C1wKwBMQBwwTQBM8BLwWMBqoDQQOUA+QD9gSMBocEywdZBFcFmAf+BAID3wPUA9EEEwP8BqgHwwLKBVAH1gU2B3EFfwNzB9cB0ASZBVUCMgP3BAcFAQTiAsEEDQSBB7QCewUnAqEGSARrBx0HngUwBWICPAc2AqYGMQIeByIG2QGqBScEhwQ+A6YEZwT1A9YCWgdHBnoCmgUEAyoG/QL6BWkEqAV9BKsERwTjBpAGqwRlBY8HeATrBXkCigQBBMEE8QOsBtoFtQSBAl8E7gWsBF8DMQXwA8QENgckAkMFkwfUApME0QSsA7kDKgblBnEG2gTlA2kDFgd/AyIGxQO6AWUDzQV5BCgEigcNBuYBBwWuApMG7QOHBJ4DRASPBGMDXwSyA1EGJAXaBVMChwa+B9kBMQVTApMEwgbLA4EHOQNCBeoFxgRwBygFFwSiB4cCVgbuASQFcQaYBJQHfQM5BdAE4AOpAdcDVQQHBQQD2QHzBQAEDwJbAscF3ASJBP0FZAVnAvYETQVZBY8HOQYeArACEwKwAl8FbAfIA7kB1gOqA4EETANZAt4C4QMRAoQFegKoBO0D3gSMApACVgaPBfwDFwIvAnoF7QK9BXgEYgSeBG0E2QJRA+cGKgYKBHIClAOKASYF8wboA9UGjQWyBuYDvwVdAu0C0AR6As4D0gWKAgYHIgYuBDAHcgTXBDkDHwVrBNEExwQXBRoCpwaPBmcCLgSTBEEHNwcUBqcGeAMjBpYD7gItBlUD/wE+BtIE+gMWB7MCrASbAiwHpAMmBwEHoAMPBGUFqAQnAggHgAXrA5UG+QM6B+0E4QOvA4UFqAcEA54CIAaCA/gGxwZABlcHWAU9A+UE4QFWAksFaQVTAtsDrQF4B7IDuQbmAmgHvgdsA20FMwL9BFYCHwJgBuwDeQQKBHEGdASkB7MDXAPCBjcGHwVqAsYCuQH1AdYF8gVeBMAD3QPhBegDQgflBAEC8QKwArYGowTaBNIBagZ7BaQEPgZGBaYEVQLQBF8GjwK0AhEFNwUMAw8H0QQqBhcCGAPOAZwHHAdPBxkGCgeuB+UGnAFHBzYEDwfnAyoGpwROBrIDPwSuAtQEGweNBEQEhwU+A1YEsALUBF8HjgT2BMIHBQTkAZoGkwREBE0CygZxBGwFNwRDB0QGBgZrAz0CIQbNBA8HJwIIBgEDQwRBBCcEYgeaBakBDwZOAmMHZAemA5wDKgYUA2MG3gVdB2kEfAW4A04GggIdBpgDNQXQBa4CcAI6AhMH3ASGBEQGVwdXBGUDNwTEAWgCdAdWAmIFMAVbAvwFjwJ1BDoE+ATSAfIEPgNyBp4CNgc7BP8BLwIbBOoEpQJwBiEDvQHgBfwBCgaLB10EAASoBXME5AaLBbEBDATzA5YDWQTtBTcF6gHbBMoEKwXWBfYDgQTxApcEjgK4A7wGAQfCBGIEvgdgBbEBPQR/Bz4DSgT2BBAEBQR4BYQFhAVXB3MGqwWEBTEChQQnBPgEAgM6BFgFsASCB8IFsgNjB0EGrgW9AWsH2gSBAkEE+ATRAVYGtgRnBaUEyQXrBtcEvgEKBvUFsAKVAuUGfwSGAskHRgLlBLoDhwQHAs4DmAL7BVUG6AMMBugCzwb6A0wDzwdnBBcFFwUiAysFIAfNBYIHYwagBx0HrgWSAhACyQQ+AzQHVwe/BaUBwQK3BIsGiweRA/8B2AT8A78DPgZUBIAGYwSSA1cFMwTkAVUFNQJzB80FVwRiAnwCKwU3BacH8QPMBNkEWAeNAwAE7gH6BlQD9gLgBGMD4gQsB8EEawfQBA8HTwbZBFMEDwNkBOUEHAWlAi0DKgb0BNEErwHkAcYFQQVRBlAF+wLLB78F+QafAUsEIgeZBHMGhAVTAmsF4ASMB78ChwUjBMUEkATtASAEJwXwAeoEjQMaAmYCEga4A+YGwAMgAsAFZgdpB+YBvgZnAoIFGgIiBjoE5wauBAsEQARFBdgD3QbAB+kCdQaaA3MH3QR8BQED4QYOBggH7gYoBEIFVwXuA7AE6wKJA+UDMwa1A/8BmAWRA/kCyQRAB3YEsgOWAvsFAQPSBkwGZwLzA4gDrwK8BSoGPwbjAu8GLAJ8AjoGrgEUBsEGLAKUBscEowTuA7AFbwPZA0cFVgKvAnsGkgInApsD5wJKB+IEpQLJBUwDkgThA4AHKQckBWQF8wUiBrsBmgWxB6ECwQToBpADOAPQBIoC0ASwAmsH3gVCAycF8AN5ApIGtAETA8YEnQNqBO0GPQWeBhoDXwQIA2gHrAc4B9EBKQSIA4kC7AW/BhQGMgMuB6wFeAN5AyEHjwX/A54DgQSJArgDVQW9A6QCiwRrAxkCXwbzA1EGWwOCBd8DNwcBA8cGGgL8BD4D+wXSAoIHlQXGAjACagQoBpEDfQXDB2cCHAOcAlsGjgKuBcgFvwUbBMcFrAOtBHMGnAceAjoH8gIsBwIE4wNmB7QHawS1BHgFsgM6BmUDYwM8BlIGAwenAiEH9gOSBMkFQQPHAYUCHQUQAlgCIganB1ICvQFyBSQE8gNVAscFGQRPBDkHLAYwAtoEiQOTBs0FmAQKBhYH3AM8B/8BIATnBPAE9QLCA6wG/wHBBLsEXQe3A/gEcQZFBv8BVwXkA64FnAeaBDAEVgfQBcsC0wbUBvoERgQwBLcHAQeJA6QCAANlA8YCuwHMBTgCkQQMAkYCKQNNB2sFGgIfAg0DbwTlBZ4CKgagAqwELQZ8AzsDhgOFAjIHegK2AqAEkgciBrQHvwNmAqMGFALTBAoH1wX6A6QCGQa+Bn8CiAXqBWAG9QINAuUEgAI6B8IDxQPbAXMG0wWdBZAEUwIfAuQEIgMrBYsFtwV9BMEGPgOYA/MFiwaXAk4GJwQeB24EVwUcAqgFSwZlBMcG5gbRBDAHswMkA2YFVwWdBUoF2QHTBDUEtQLNBwIHpgTkAYEHUAc6BMsGfQTAB/IGUQPHBUsF8AGkBLkCpgbmAV8HKwOFAkQDVgaLAxUGVQJKBMoGcAJ6A44HrwY+BnMHuQOCB4EEkwTDAVYGLgWXAvMDIgfaBfcEDAeeAboF1gMoBjUHvwUbAyYCxgVWAnEF2QGdA6wEJgaAA7cETwZ0BHQDuwfEAkkD4QXwAXEGMwQfBqIBmgWLBncH/wE8Ba4DBAReBdYFZwbrBLgEdAcSAnwFXALhBHMH/AbGBKkCeAKFAkMCjgWPAtwFngLbAxsHUwIYBRgFmAO0B3ICXQYsBwgEzAR+BygCmwPQBFsH0gEwBdAECwInBP0D8QMXAhgFVwPGBIcGVQOIBgIDvgOcBx8GZwIpBu4FZgXHBqgFdgXgA60FswMvAocHcQafA7kDiANZB+QBgAY5BDsDzwMxBIUFcAYsAnUH7gO8Bi8FjwKNBFgDhwcQAr0CTwe3B04GUgKYAf4CgwQ1BfMFjQPDBMAH1QYKBogHtgfEAxIEsAKzBGAGUAXGB70EWwScAWoEUQeUA48HmgPeBroFSQf+AnQDsgPJBHwFsgMGArAHcAO7AZgD5QEDBs0F4AS1BnkDNwPiBN4ENgShB+IDmwOwAoQCDQXUAZIEnAeeA5EFlQPIAbsCTwdIB8sHFgenBFMFuQGgB7YHUgOIAz4G2AYiBuEDyAFgBowGVgbMBCUFnwFcBB8DWgIIBIgDLQWzBMgEuQP2BAUE7gISBfkB1ASeBNkBuwFFBqwG2QFyBgIEVAW6Ad4DIgSTBgEGvgJWBpUEhQUiBmcEwgbuA3EGRwc+A5IC0wRHBssDzQV/BDYDsQXuAeoE9gSbAc0FpAYFBJcHvwWVBNYFUQYEBCAG5gaUAzwDpgfwBb0BIgcqBHYFbQKZA1EHKgbCBpMFuwGiBs4DugHKBqkDIwb/AwoH4QQ0BBQE7wYhBVUDxwRaBM0D/APYA9MEvAWHBJcEXAfDAcIFcAPAAl4HTgPEAW4EeQT5BCkE0gGNB5UHygKZB2oCgwQCAnoGHgbdA7QH1gLHBXICcQZfAj8E9QJ/BysF3gboAyUGuwMEBOcCAgQnBY0DuAODB1YCkQIOBEcFIAUhA8IDBgdmAtgG8AEEBNkE0AO5A/UCaQRLAqABKgZ+BFMFwwUJBDsDUQeiBQwHJwIABH0C9QVCA3gE0gH2BSQFRwc9BikFNQT4BgwD4gVcByAEmwE5BhEEzQUSBBYEVQWCBLIHgAZTBUMDjwWnBM0ENgclA88FYQNeBWECPwPQBMgDtwdYA1sE5AMgBHIH9gInBz0EnQSHBK4HIQV8AiICdAbYAc8EQwQbBhsE+ANsA0UG9gZFB/EC5AG7ASgG/wMaAnEFtAQWB6oHmgbcBLADxARaBLoH4wPAB0kD2QFxBQ8HYQPVBMEEQwZHBb8F2wMSBtkByQaoA+oFVQQKBxYEZwOkA7EF9wVKBSsDwwFABBYHVANxBngDvQXGBT4HlQKGB1QEFwXbA/sGfwa8BC4HqAU5BlkFKQK5A18GPgNOBVYGygQBBrcEhQLkBMYFpQbUBMwFNwMrAwQE2wRpA3EDoQXQBDoGgwNZBHICvQFFBQ0Diwd2BasGtgM6BCQHZQOWBFcEZAKCB7UHewYwB1YCDQeJAw4GBwUcBfoD5QatBnYFIwavAyYEygMABz4GUwQzApoG5QbhBHkHXwVaApMHEgRPBocG2QG5BXkCXQSGA8UHigQGAwcFfAV6AlYCIQWwArUE7wOcAfwBvgPLB3ICBAM+A64FkAUsBKIE2AOfBssH0QMqBskEBwQtBFwFPgNrAhoEUQRwBPwGUwW9BZkGXAV6AlcHqgUfBC8C1QS0B28HvQECBE4GjwUhAo0HoQPaBqkHVwIZBuQE5AMABI4CYQSyBisDrQYAB3ICFAKwAwED4QVHBz0DLgUBA2gHwQVGAq4DxwQQAn0G3QVLByoE8wKCBTsHnQYjBEQFaQZUB5QCrQE2B8cEVwTFBFoCxgGrBE8EugOpAeYGRAQ+BX0DRAS5BIQCvQUPB40DhwW1AzEFfQRKByUC2wGKBgkEgAc3BFoH1gGSBa8FWwJzAi0FMAfxA64F5gY7B+QBcQYqA18H9wMdB54CWAKXBcEEIgNgBnQGSgbYAckCzgXlA6QCGgJEBkACRQS9AioFrgdOBcEFsQRRBNkE8QW9ASsFewd9BxkCzwU+A00FAQToA5gFRQTABWMHbgc2Az4D2QGXBEoDHgTFB9wCtAIBB1UCgAb1BtIDFQP+AT8EawdgBtwBmASoBEQFqwPjAqsDkgLRBKQH6ANIBy4C4gZ9AwUEGANGAnQF+QHZAe4BNAW2BmMHKwWIAtYCLwdvA+QE1gNTBfQD4gRvBoEEDgZHAm0F5gPnBJ8BRwXABdQEvwVkA84F4QT2BNQEzwS8A2EC+wY6B38CPgbCAx4D9QY4AzoC7QbOBNAEdgM+A7YCTgV9B6sD+QFWAuMBqAYnAtoEkwdlA4EENQNgBmwEdgVmAuQERQQYBT8DVgLGBr0BiwfJBqoG1QPgBfsG5gZzAxEEuAZVApsHSQNXB7sFWwMnBxwCnQWTBFgD3gUXBXwCCwe6BL4E2AY9AyEHUwUkAwAEvwWJBB4FNwU2BFMF3ATHAVgGvgKdBNsBAgRqAlYEjQJ9B54CCwKqA6QExgYtB5cEqAfzBd8ChQJxBpcBDAOXBFMHkwPiBcIDcgMjBkAFTgKjBKIHyQKrBToG2wMVA4MGDgdzBLkDlAO/AtMGWwOVBKUDpQaKAl8EUAXhBiQCiAV5B80BywReAo4D9gR1Bj4GYgU9AwQEGwcSBTsF/QL/BjUFvAZkAmcC+ATSA/8DIAYIBlUCkgdzBP8FWQahAucCOAe3BLQEFwPWBSEGCgbBBoUC2gTxBXAGwQa9Ad4GngLaBLwG9gLaBtIFGAO9BrEHUQSEBHwDsALWBfYBJgVfBNMEngS/Bp4CeQVAAxoCEQWsBIoCcQbHBDUFOwWvBOQEAALFBHIDlgXNBFID6QUyBRQFlAYZB9AEgwS6Bm0FcgISBs4D+QEgBaMCcwYpBKcGAQM/B54DUQY5BsIDBwVkA38DDAOpAmQD3AZAA1IFNAeaBVkFDgeLBQAG3gaFBI8FvAWYB4MHFgQPBDcHfAL8BDAFLALoBk8G6wNRAkUFPQMyBL8FbwT8BOoGbASnB18EUgLjBnkHTQN2AxYETQKfBYAErQRHBuEEzASMBVEHPQTuA08GIwNuBdwBVAMeBzgGiwaeAtkEkwcrBZ8BBwI/AjQHQgNXBWkEUQcGBooFAQNYA60B5QY1BMsE/ANlBV0HXgWLAc4ELgOeBokEtQTFBCcFVAejAv0ElQXsAsACJQPvBjYCBASIBSgDlwdRB1YGyQL+BJED7QKWAk4F0wTQBMEDMgLPBVYCJQOJAkgF5QXWAg8GjwewBQcFigSEBRQGzQdyAg0HyQFKB7gHtgOcB84E1AUoBj4GiAaUB5wCuAetBrYEUANwAzkGwAWIBogDKAa+A6wGNgQqBa4DXwbpA8UCwgNiBF8GkQZ7BIgGigTzAhcFRQe5AQ4DPwWhAtAE8gGDAyoFjwIGBIUCeQUQB5IC2QRhBFwDwwLrAuYEoQK/BZMHiAY7AnEG4AOVAbACcwP4BEoHpwSpAxEGaQPwAbACpwUGB8kFzQUdBN4CgQc+BOcD1gXFA30HHQSWBWcHbQTSA1wHkAPoBuoC9gO8BX0HMQNmBCECVQdfBvkEOAIwBoAGdQTFBL8FvwS9Aq4GVAVzBskCAgbGApgFdgUEA6kFYwb9A+4FjgLzBuABAARbAwED5QMtBvwCRgSJBTIDvgchAtADOwSGA2sHYwK3AuUEDgM7BgoEGQNUBIYEowdMArkBdgeHBFMC5QXZAkUDCQQ3B6kFUwLuA1sGDQcaBGMGHgO9BSECXgW6BJgEFwXoBu0FdQa/A4cEjQVgBMIGTwbpA7ACpwQ5BvEGKQaXB48GeQMuBmsEQgYDBkMG1QYNBkID8gLEBA8E7gb4BsYCfQU3AvUCNQTqBf0EMASkBkUFpQPnBvkDOQNiBcMFHgPRBCYGQQVcBUwGWwJIBNEEfQWZBJoHtAfWBVgClQVcAj8FzgPwA0AGUwLdBnUGiQR4A8YHbQQWBIsGxQZWAmYCtgYUBSQCCwSjBT0GNgKbB5cHKgRXBUUEQwQIB5QDZQOJBNgEoAfRBv4EcAdSBR4FswQKAoYDSQQEBPYElgLQBHQEewSrBNYE3gbmBmME9QOVBBsH4AQ1AkYCDALlBGMHtQNiBVsCXAZrBFkFrgOeA1EEaAReBeACMQUBA3kCcAfaAu4FLARGBC4EHQSJBMcCKwdjBwQCuwY/BQECrAPtBpkDRAd9BC0G3AUUBoIHWwSLBOQESAOwAikGLwKtBIIDVwWDBKQEUwSoATcGBgf7BiYCOQaBBOsDLAfuBVUCzgFvBEAEnQZCB3MEQgemBvECcQXwAZIBFwWaA3oEBwXBAj4DwwV4BIICfwJjAmIDaAMQA3UGLgcgBoEEIQPJBKIDbAKfBjcGqQFOBsIG1gLxA4AHrQGfAYsH5gFVBuABtwQwB+gDNAd6AjkHIQasARYEgQK0BRUDegSsBBsEzgTIBMgEogQhBJEFRAaeAusDqAR2Bd4FRALeBLUHzgUeBX0DEAOCB10CaQdeBUgEJwZ0BDoEiAPwArEFvQFqBqMClQePB4ICKwV9BG0CxgLIA1IEWgRqB+ACvAMUAogFBgPpBmkDDAOsAUgGyQY2BggGLAI4BrACfQV1Ax0DWQY3Ak0FMAWeAuIFAQNXBfoCKwNyAkYC0gOcBwwGNQcEA8YHkAReBAUEigVjBo8BpgQsAlYHuQGXB/UGmgbXBcYCuAJkBogD3QMHBesGnASHAzYCzAcxA7cDvwVgA+oFUwcwB54CYAa6A6IF2wSUBfUDjwWnA3ECQQV4A2EHZgfhASMG9gGwAuIEPgNzBUUETQPBAj4FmgOVB5UFPgO5AYICPAawAokDXwRSAsIEmwUiB/ICEQI+BmUDNwSyBloD+wY3BWsExAEOBOAF2ALZAS8CBgUPB28H8QOdA9AEbQIWBOIFlQUEBDkEXAKwBv0ELgK9BfMF5wTuAaMEQQPVBvYBfQI8BQQEZgSuBFEGWgTNA+QBIwX5A/EDrwXWBeYBWQUTBNwE9gTrAg0EcgJGBXUH8ANCBT4H7QUiBpAFzwYYA1YG5wIVA64D9gPbBngD5wGIBjUHwQTuBVsCcgVTAnMF6wWLBR0C6QSKB8YCHQPVBX8CwwR9BCMGggTPBNIBbAewAtsE5gFOBUIDVQVkBRYE1gI+BmUD0ATnBBYCzAR/A/0EZwfyAjwEBQKBBUoHxgaoBN0EvQVFBfQGNgIXBlkG4gNUBC8FpgS/BQ0EBATfAYAFAwbgBCQHfQTzBUUEMwQuBfQFKARkBdcDOAT4BnkCpgG8BSQERgWNBNYEpQPlBe0CdQXPAoMExgTUAsgDtQSSA3oCZgedBFICUQYoBLsFZAPFBaAHPgNzBNAE9ASwAq8FXAL9BLEH5wKTB2cGPwOCAqkBDAULBT8EtQRVArsFIQKeAugD3QXWBd4EdgXYBsQECwR5Ah8CNAc7BsUH9AbaBJQDwQbZAQUE2QL5BYkFAQPQBNsBiQIUBLMGYgecB68GcgbSBKEEvwHxAoQExwKjAoQE0gKoBCAFOwXEBAADhQLJB78FPgZfA6sGAQPDBSwFtgFuBcEDGgLoA/gCwgPgBHAEeQdCAi0GQgPtBpAEiAMuA88E5wKEBNYEYwL5Ak4FpQP1AlkEeQLzBY0D/AQ5B1EGLgafAcUCnQMwBfADLgdfA8wEcwdpAswDmgUhBZ0GHgafBCYG1AS2BEEFqQevAk4CTwKvBDoGWwSrAVsE4wS7BbgCNQdLA30FSQQFB5oErQTWA5cEpQI5BpoCYwLCBD4G2QP2BJkEYAWsBF0GMweLBdoDjwPwAjUGggdwBOEEsANGAvwEnwf8BH0FwQIBA04CuAOzAywCggaBAjcHggJ8BPUCkAN4BTkFzgRDAjoGnQXDAXgH4QRaB20CxwdzArQGCAYaAvUGwQIYB/IFkQeQA2EHrgFjAucC6ALvApEDpwJHBjYCHQROAg4HuATGAkQG5wQuAhYDEgNeA5sHcAUCA/8BogZvBsEEdgWkAmsHmwGsB8IDwQTlAj4GggesBEkCNwQFA6wExwQVAyIC5gEZBwUEnAd/A/4ENwKKBOcE7gJkBIwD8wIUBX4GxQMZByQEBwIXArACmwdDBuYB6wUpBEwCJwLIAdQDEganBrAC9AZdBmsEyQT1AgIG1QHvA8QDzwFmBWEH5gYvAvABlwZCA/AB8gWrBJwE9gLnAhYC/ARKB7wGYwRPA58B9wTcBMAEGAVcAiQFcAcdB4sFHgWaBuQEPgN2BYgHlwY/BWsCggIXBqUDegQNBUIF3QMUBaMEfQVwB3gFlQdGA5ADBAR7BQQE0AMIBBwE1gVCByYGDQI5A/IFrgfDA3YFHga2B6oDBgfBAs8E4gSBBMEE3gT7BsAEjwXZAUUFWwKFBz8DLwKIBJ8GIQahA9wG/AYKBlsF9QGoB98Fsgd9BJgFkwSfA14FTwQ5BqwG5gFzBQICWgRwBdIDtwUdBr8FwAPMAYIGrgU+A4UC7wbWBbgEfweYAWQFegJMAj4GRwZRBmcGWwLAA2sH+QEjBLYEngQ6BeIBhAW1A4wF2QE7BbAByQI0BeYB8QY0B8AF/Aa8BrUEggJ5BScE1QRQBs0BggI6BGIHIga1B04F1wKNAzME+gNOBakDvQG5BsEC1gHyBAcFLQQoBuADwgTTBGUFqgSKAt0F3ASvA8gDlwEdBLsE2gQ+BscDWgdgBr4DhQMBB5wE4gSHBlYC3gaIB7YDfAQeBvABOQd8BAEDYgXJB4kEsAJlAwQEjwVXAi0FOAWGBHYHLAadAt4DRgLEBQEDWwUkBFwFuweFA08CtwK1AZ0EYgd5A8sHsAQkAj0C2AFGA2MDwgK4B6MEEwIeBLYD1QWvBSIGRwTTAUIDYgX1AisDDgeJBLQE1APTA2MEXAXQBMQEpwTlBJUDZAYqB7wF6QPOBOAESQfxA7UCQQYRBX0D6AZxBqMEjQMeApQHowIHBbwFdATRBKIE1gKwAuQE5wbEBN4ESwOWA44B+QTJBkIHEgItBd0DYgVWAlwGTgahA7QH/AJfA1UGAwMUA+UElQV7Bc4DrwZZBeIF5gEoBFkFPwSPBVEHCweXBp4CaQLWAkQEWQRHBsICxAIKBvUCZQPeBA4H2Aa9Ac8FiwVSBvsDoQcHBx4CPAUzB1UDigXOAywE1AMeB38DPgMhBWMHlwe/BMEEcgIfA9wENASXAU8GrgU5A60FsQRyBaYEPwQJBJoEwgZMAjUEZwawARsDaweAAnME5AECB70BTQZaBCAEqgHdBK4CPgXeBjIHSgePBVcD3gWABaYEXgXXBIMEqgMIAicDCAP9Ba8FAQOHB40DpwI/BWkCdARqAnYDpwcyAngFKwdXA2cHyQaSB+EERAQ+B08GGAWXAjAC/gErBAkDYwQDBOADfAQXAvsGtwWSAyUDkAPJBtYF/gNPBmAF0gP+Ap4HLQdTBSkEIAKvBs8FbwfIAuQBWQVWA8IGpgO8BYEHqwOBBPAD1QTNA4wFIga3BR8ExgUBA8kGKgWOAlUCzwU5A/8DdwXfAzsD3wNcA/gCGwXkATgGtAFsBTYG/gXAA0MELAWXBMUDgQeyB4AGtwZlB7oGiwMABHoETgbqBcAEYANcApAF4wOpAX4EiQR/A6wGfwPgBA0H+QOhAoQEyQbCAzMENAYkAlwEzQdtBGcEygSHBJMG3ARlBUcFVweyA4IHagMlBD8EmwTCBGoC3AQxBCEDQQZmA4AEKweoAwMHjQOxB8YCdgN4B6gF3gRPBnEHOQafAWkG5AEIA3QHHwU/AxkG4ANyBxcG5ATZAXIHQgaVBasDnwQTA0kGtwRABtAEgARbBIoFjQP5A8UEdQIpBu4BLQXkBKQE0wRtBCQCNQeRAqEEBAMkBegGlwSXAZ8BPgPzBeMCNQc1BgUEkQeXBNsC3AKRA5cEWwXdA+4DuAdWBZ4CXwS1BWEHjwSFBTkG2QFEBmgHcQU+B9QBXALhBVkHbgRMAvUC9QLbBL8G4waZAUQCnQTbBtkBQga0AX4CvAOUBDsGowPMBOoBAgRLB5oFnwF4BS0H2QSIBR0GAQMHAp4CQgU9A6YDZgRRBwIGNwOwBLQD0gFdBGsHywY9A1wCXAdXBUcEUAf5BP4CggW3Ak4CAQMOB5ED4QQnBLcEhgZ5AxIGPgObBYYH3ANBA+EDLQRxBpgHpQFxBzcEWwZPAwQCjQP+BLEFhgcPAjgDZwOGBtADnQKCB5sBLAJzBQcE0gEuB+wDzwLWBJYFqQGoBUoHswWYB70DLAf7BisDSwRnBa8GHgcoBMMFSwJbBIIHuASRA/UC7wMnB2gE2gTWBgUE9QFqB7AD2QSgBJMBnQNnBwAHogSPB5gB5ASXA5kGvQH2A/ICywYjBA0EjwQUBUEDPwWQB4MHVwf2BXMEIQTQBDcH0wHOBMsHuQGnBPkCrwE3AsUHjQQLBLEHTwNjA78D4wI3A68FJASvBsYFOQOBB4UCWATmBjACEwKwBToEvAV2A1MF1gVmAuEEAAf+AvYEQARzBa8DPQSdBqIGkQO0B64HHwYwBp4FYQSWBKwCwgavBf8BKAa5A1wFVALLB/UCfQXLBMEHiwf1AXUFZgMgBO4DzQVbAuUFowVVAxQFxwINBNEEzwSBA44BpAbEBKoETAPgBdwDtwYjBIAD7gWwAeYBoAe3BAIDawN0BB8EygH8Bc8B5gadA5MGUQZOBFQESwK8BrIFVwKpBVUDQgaXBL4GpgQwBdoCpgb6AxkGcwbiA9gGNQRNBtwDlQRWBqwDqQN0Bs4EtAelBWMH4wOHBOQCIQd9BqME/wNsBFUC8gU8BFAGOQMOB8kGLAWPB8ABbQePA1cEkgRBBaUDaQb4BsQEkASaBUIHSgdqAmkFvgTbBnQGdAMsBuQCLwWWBWQDVgaNA6YC0ASxA7IE0QPBBXEGkATLBKoEvQL8BZoFAgPcBGMC0QSjBF4H0wGiBdMEzAMzBAAElQPJBqEDcQZ9B6kBoQNWBjQE5AMAB+4DJgacBpYEcgc9BhIFOgTkAd4F8AJjB6QHhQePB94E4QGeA8UHoALEBNADKgbpA6ECsAKuBYAGsAINAmoGlwSVBj4DvwXXBIEGNQQEBN4GIQP4BKcEoAFFB80FNgeNBFMHKQbaBMMENwK3BDQC9gRGAucEWQecB40EwgYPBuACowU+B+YE2wH7BrkCWALdA64F2gJTAyoH+gUeAtkB3QYlBb4HDQM6B94EXAdEBVYC1gLZAtgGKQR8BFEGkAKFAqoCuwapBRoCjgcBA0EHIgLXBnUDCQS/BKwEOAPgAyoF1gTCBnMCdQckAk8G5AEVBvUF2gLyAgIDlAYTAzcGPAcEBI0DrwTFBA0Dlgc9BqcGfQYvAr0BnQOBA8cCWAJZBv4ENgbDBXMEAweLA1YCLwJzAzwFGAUVBkUDAgN/A3YG5gO7BuoG5QU5BRUGHwSZBQQEUQc+BzAC1QPNAxIEAAcOBrUCQgP7BYkEogTJAvoFlwWqBaMFpQPiBdkBCAMZBhkEFwPJBXYDTwNcBGICCgT1BT0D9QLyA10EvAZyAzgGJARiBS4ELAdWBrQH1QPHAgcFpwMJBHwCUQTXBAAH5gNxBMIGWwN/AykGdQOuBc4BPANFA6UCJQU7A9MEvQFxBYUCTwSSB+YBLQboA1EEGATkAUUFVwPhBVAHFwX1ApQE6QUSAxIDWQTGAhMD/wObBTYFZgLWBVkFfAe8BroHQAdLAnEGLQTzBZcCTgWuB3MFcQbCA/oF1QGXAVMH3AS/BToEdwUyAvwDXwP9AwoHJwTCBloHkwR5Az8HngLNA2oEOgQwBw4HKQIfBrgEWALJBckGIwc9BcYHBAQoBrwCBAJoBGUDtwJOBeAB8AR9BQEEAgScBxACvwOwAq8BPALiBHoC7gQwBiQFZgS/A/4GDgLuAzQGZgelA8sHrQLJA28EWQIYB2MDnQVcBj0DXgULBDACcwdpAhoFcwYBBNcDxQPhBMADhgcMBuQEMAQsAlYCIgbtBkwGYALOAroGpQfNAx4GOQNiA7oBbwZGBVsG7QNgBPQGdQSLBFgCBgauBDwEhgdRBpIHvQEaAvMFAwcXA/UCTwPHBp4CvAUdBC4DKQMqBmIFcgdnB1EHugTeAocGUwXzBUkHiwQMAjgEVQKSBm0EJgQVBoEH1ATCBE8C1QTVAl8GFAVLBCQDJwU8BYUDHAN5A/gEvQL1AvIBswL1Ar8F+QJmA8oGWgdWB+EDZQXWAu8C6AWkAaAEngLJBlkGxwYWBK4EYAalB3ICvQLOBYcHkAINA6wFCwIiB+EETwS8BbcDwwEwAr0B3QWFAvIDUwLuBXgFcwKwAlgEegTqBLwFngKfBAUESwNmB3cFGQN+BY8GVwdCB0YG8wW8Aa0H+AYXAtkBsAZAAy8FtwRCBg0EvwNRB+EE+gUCAz8FoAfbBT8DHwTzBTkHZwKSAxgDlwE0BtQEVgRjAyUDYwb4AqQH+gP4Aj8F+ARIAlYGAweSBwwDfAVWAi0DtwTwAdIG3gLsAkAEHwWXBngDNgKzBogGhgfgAUsHtQS4BB8EfAU3BSIG0gSNAicD6QSFBTYEWAZ2BX8E4AKdA3MFgwQAByoGfAMHBKkBAAQ4A+YCYAW6B7UGPgcWB/ADxQOKBz4D5ARaBEEFJAQ3B0QDygdDA7UCtwSVB9AClgG6BXcHeQINB7QB9QKtAYUClAS3BQoHvwX8AnUG3QLiBIwDwAMnAsgDLAa9A+4FlQVbAsYC0gYEBKQEgASZAt4C/wG0BCICewK7BRcHPQQEBXEDnAT1AhEF0gMABC4CZwP2BEEDiwd8A8sECAMtBZID/wE8BSkDrASJA0cFNQW6BYUDxASYBEoEmwPEAdYEWwNrB5sDggdEAoECHQPnBMAERge2BkADNAfZAUsDjwboAlwEiAMpBJsC6QTxBcYCMQUoBKEDxAMLBN0ELwYMAmwG5gJfBnICUgKCBYQEsAYeBbgGywcyAuUE/wLhAwUHYwbWA64DtwQSBrMDWwP7BuUBJAOHB6gEWgWsBlYGvwXqBpADpwJPA6QG/AO7BasDiAN1B4sC6AJKBzACowTgAkIESQXJBZADDQa9AYUC8QI6BaYDrAcgBbQCRQOLBlUC2QPeBPoDLwIPB78EqAEBA+kCswZQBJMHXwT5A4UCSASxAoIH9gTQBf8DpQLgBNkEUgWXBBgFJAQvB/IFtANBAmQDDAaIB3MEbwSFAzIC3QSwAnICjwVyAjwE+QNOBkkG/gMUBVEE1wGzA5IG5AbOA/UCwwS+BMoENgeQBD4DPwfFAj4DcgejBYoFUwIhA0IE/QafAckGbATKB8EFogbSBhAD6QGsBJAEBwLKBSgEiAKaBrsFsQRaBq4FZweSA1UCzAE1BU4EigQxB4AGnQRkBN4ENQepBZcE3gT0BIgG6AKEBRUGeQKYBY8HLwTkBKADBwfZBJECbgUXBI8D3gTjBVYDaAQZA4oEFQM6Bl4FLQLZAVwGNAfwAdEEjQOABdcCrwW1BA8HWATgBWYEWAbFBtUCxgYIA2YFDQMjBhUD6AIUAg8H+AKeBd4FNQVGAn0DRwKMA0QC2QH/A3YH+AZrBHsC/wHGAsMF5gGlBqMFvQWfBtQDPwXCAw0DgwM3A18G3AQbB30FuAJgBlYCDgeQA/gEqAM5BdYB1wFJBHYF2gXPBQED6gVuA8MBuAHsAvIBxgLhBYgDEQWCBfwDuQXGAkYCjwK/BJMH8QUbBcgBCgRzAkUDmwSgBCgGIAaZBgwDqQMgBqoGFgQQBMEEvwT5BEYCcQX/BQwDfAOUBHADRgMtB30ErwQUBSMFzgOsB8oFrgVbBXkCRQU8BEYEZQXfA70DigTgAQcFagZfBQgGUwKJB4sCTAbCAmcGngLxBSgEQASxBUIFngJxBhIECgZ2AxcEygZeBRsHAAK8A7MD8wV5B/sG5wGbAQYESQQrBUAGCAT4AVEE6wH/AVwCHgZzBHYDJAVvBAEE1wS/A4MG3AF2B6kB1ATmBmQFXALgAbACrATrA1cFxATOAf4ETgTkBGsEQgaLBKwDlwLSBnUE3QQXArUHzQNbBDYFZgX3AR0EBAQrBAQEhQbDBdAEhQJwAgwHWgTjAhwHBgfdBawBVgcrBVwCwgTPBPQDFwN9Ai0FfAXGAukFNgJNB1gE3gTKBVICowSsBAACfgSDA7cHeATbBpUH8wYGAmkEuAXcBJQE+gUWAjACuQLOA/MFDQYpBCEG3AG1BR8CHQafASoGJgILAtACkgOwBiUF7gZgA8cCbwaqA6sECgQeBeUFfQe1BCADsAJXBzsFrwW9BQMH2QSWA24HagOfBsABnQRmArUFGgK+B9wGGwQKB3YFHgUeBusDpgRxBj0CtwfiAvoFcwIOBIwDWwLZAlIFwgMaA7EB5wTaBeEEcgLzAvYEtAfKARQFhQKOAjIFhQUvBxYH2QFIA08EKAMXBuADvAX2BDYEtQS8BqECvwOuB+QBHgUfAjgGiwd3BekGvQWMBgQEhQS3B3YFzQKfBn0ExQLIBMwERgIPAgkEYAN5AsMFJwOzBtwEnATmBmgEtQRzB2kF6ANkBVUCsQcjBt8FQgbsBesDRQUMA3EGBwXlBHoEXwOQAb8FUQQ9BtoFaQSNA70CLQXpAp0FMAf9A1AFRwZuA3gE2QGzA+sDvQSdBLkDvQPwA9wGaAIdBKQGyALIAQ8H/AKnAj4F3gTuBnYFoAfJA6oDZgPtBt4CwgPLBzQExwT5BMMB3gRmBcECfQV6BFgD2wFzA54GtAI2Ba8DFwNpBT4D6AZiBs0FkQLEAhQEvQVEBRsEtQXOBJQDYwNDBCMFFgT7A/QGyQTMBGYC8AHfAZMHxgIhBQoEpAPFAmAFnwSnApYHtwSuB0IHwARPBG8CaQTIA4YHJgZyAiQDPgWKBaUDoQJyArQEDASuB7QFnAS/BD0FpQLkAaoF2AYMA5sEaweNBPED6QVgAisFAgf7BmsHSQV9A5kBuwQzAjECUgJRBBAEKQR2BcUDIQaTBNUGPAeBBPkDMAKsArsHtwTkBO0DUQSDBGYHCgYzBtAEWAJzBK8GPwVUA1UFZgX1Bs4CxgdCBKkBGwQ9AicCXwWcAm0EzAf1A50GNAeRAsICqQXyBVADuQPuAlEG9QIdBCwCuwEkBcAF3gRnBn0H+wNBAncG+ASgAi4Hhgc1AykEXwXCBqAHlAeNAz4G3ARLBDYHXwddB50FywbGBJgBxgZFA6oDdwVgBkIGoQOIAtkBdQb6AiMGegQuB2AGagJ8BNgFcQULA3MGagd7BosG4gZYAzsEhgOPBNgGJgayA9ACiAOQBycFlgLEBFwETwTaBP4CjwUuBMUEHgWSB68GEwOIA0sH9AQVBpgEwgZOAp4F3gZfBxQFcQTNBr0BigTxA9YF8QbZAQ4HCAJKA/QEYwXmAbQFFAWaAfkF4QRTAvAGdwfwAVEEggbEBDMEhweCB9QEEgRYAjkGJAT7BcgDMwO6BPcC5AThBSgEMAbnBgkHYwdUBC0EDAIjBBIG/AaxB7YGQgYEBPcDtwQMBqQEpwWRB68BUwItBgQEIQR2Bf4EsAJmBOIFlALpBTMDdwUiB8UHlQO0B2ADtQSVB+IF5AG+BFkEBwf1AigEYgWsA5EH/wEhBesDvAXhBGsEwQYBA7UCKAWiBXQEGgLDBScEVAT4AiwFJwJfBgwHAwRDBuoEWgJpBDgFCAJHB9kBRgIBBEkH1gSNB3gHJQV6BJwD6wIvAnICpQJZBggEpAbGBdAEQgZnBzAFkgRpBZ0DUQdbAlEDPAQfBnIC3AQ5BHgFggJjA0cGRQZ9BL8EawcdAzoH/AapATUDaQcIAy4GIgYpBKIGDANMAjACPwR2BBwFvQHBBBsCfAZjB3gDxwRwBSkDVASTAwEDZgLAA1wHhQL0AxoC3gQABL4HuQU+A9wC/AQIAmcCUAU8B/AChgdWBn4EKgW2AQoHlgPBBKQDDgY3BlYCNgasBP0DzgT1AvoFzwbgBIIH4gHuBuMCHwTDA5sH4AGuBlIFFgLbBPYE/QLGB8YCxQMwBRYErwZZBL0DPAQ+BZUHVQIhAk8EvAVcAuUFyAPWBpMHrwEUBRgEJgX9A+MCOgV5AuEFZQWvA6wEtAFABc4DuQGmBLIC8gQvBgEDtQSnBKgB/gQrA4kEbwdfBA4CvANyB7sFYQT7BuQEngGtBJUC4gS5AgQEwwRABPUFcQbJBSgG/AGuAtIB9gUDBqwHfwb7BgoD7QZyAqgEiQQvBg4CzgRIBJQCxQOVBrgD5QOrAjQHNgQXApAFewKsBoUCKwN4A58DFQM1B/sGagZQBwoGtgLVAXMGYAcwBgQD7QL+BIgGdAMkA3AFmgPRAbACbgReB/MCIwO7BrAEkQXBBjcGpgPMBzIEvwSTAsoGgwfeBJICawcVA/wFYALTBnIGegIEA7cEWQKwAskGdwXsBKkClQeSBGkGLALZA+0GNwQnB9YFowWwAhcDxASLBDQD0wEoBn8C0wP1A3cFYQajBXYFdge9BZoFegSTB5QDfwT3A+UBegKcBpAEOQWeAgAExQPAA/cD4gLQAygEHgYIAwsHIwRYBfgGOQZXA4EHzgVCBi0DngV7BN0EJwVbAncEowPeBp0G3gSXBJUDQQb+BKkBDQdWBywCNQXXAScCeQVjBywEigO/AbACVwVbBl4D+wMdB1UDOgQcA84CvAWKAnsHYQfDBEIEVwQ8BQ8CygMwAjQEnwYIA6EFtgeJBKkFfQRABMEFLge+Ag0HfASvBfABfQRNA1oExQQiBv4E/wFVBsUFrgP4BBAHYga0AikGpgUVBlMFeQUPAhoCcwVoAroFdQSWA7ABzgMuBT8DBgfeAvMDnAf/BbABuQaeA4oFGAPUBNMEAQOXBJACTAJOA1sGlwM+BkcHgQWPBNAE1QScBvIDlwS0AqAFuQFcBGYFtwQUBn0C+QVyAuAEXwYPB48Cugd0BlEHcwR6BeABJwJcB48BCQbkAiUFmQTpBm8GvQGABS0CwgVPA7wFcQf2BPQBDwfxA0gE9QJ5B5wHBgPFB9MC0gFhBIsEDwfZBKIB2ASRA8kF5QIXBVcHYgVOBNgEQQXGAjAFFwLFAY0EBAQGBOsFqAeSBNkCFAKwAtoDpgdVAh8DfwMMAqYDgQc2AwwDhQLPBLsHeAL4BCAEuQYtBc0B2ALoBrIHKATOAboBWgMyBDoGIQLOA8kEnASzA7sD4gSIBbADuQPnBAwCGgJBBakDmgO2B0YDEgQrAwcCIAVZAhMD9gEGAksCrAR7AywECwKHBMoDmwOoAyoHFQLNAhYCvQHpBfUDXwMjB9gGiwemAcsEvwXKBB8F2gKXBNIGtAHxA/kBygUgBicEvQFCBfoD8gRHBRoCiAYqBfoBJgZrBOEFdwWcB30EQgVpAnUHAgQgBtkCDAPJBqMFSgfhAroHbgcGA2AFeAXuAigG0gIrA2sH1QMaBIAEwgbwBlQH8gFMB38CxgYGBwIDFQaeBTwGwwOlBdIBEgUsAtUE1wScBNAEeAfABSQC4wawApcEewOlBNgEpwPgAVQFwgbBB7UDowNJB8IGFwaLBZUGeQJ0A80E0QO1AycFxgLSBDsEkgQeA2wHLwWMBTECeQSbAkYDcwdABnoCyATfAtQG1QGUAmcGjQEUBT0CNAZ0A3gEcwa3BEYC6gR8BZgDbwQ4ByYDZgSyBTIDUgV4BgwD0ATHBvIEPgfYAZcCxwamA1IGXALUAuEEIAYuBPEDmQSwBWkCkQclBcEC6gWNB5YBLAXuA7wF2QFTBmIGfQPPAUUDrgcdBqUC0QZwB/cE5AGZBx4FEgb3AbYETga5AXgEqgM5A1YFuANZBX0DhAaFBwYC5AJZBnMGwQLoA3AHtwXPBuUCiQSfA2YFWAfgAkAFXAXmAkEG5AQmBh8EWQUiBAADygULBQ0HvAWWBUQGnwNoB4cFGgKEBMED7wExBRsGLgJqBLkC9QL4AXwFWwIMBvgF6AYoBoMH8AOkB54FvwRgA94CVQK0BZ8BOQNkBeMGgAY7BL0EvwZUBzYDngMaAlwGvgScAzcFVwdyAwcFhgd5A3EFqQf5AVwCrwKmBLQHDQJWAl8FhQK4BykHRgY5BlUE8QaXBF0H3QSlAnMCwwFBA9kClwR2BakBqAPTBQQEiQRvBHIHqQGNBSoGiwO/BgYC4QFSB6QCVAdRBL8DYwZwBzwEAwfkBHoCkQXgBMoDWwY0B70BWQQeBGsDhwS4A0UFyAPTAgUCBwXGB8IGBQPQA0kHYAYeBUcHmwS3BjUFuwUHBbIEyAKwBfICXQdxBugCjwbFA0QF2QHVA7sExwUpAuEDnQTHBK4BHQcMAz8E4wXbBlQDBARRBPoD/gQ3Bi0DkAKnBBUEhQLiBQwDswNFBZcEWQa/BIcE3gTYBo8HIgcyAj4GFwbJBZkFGAOpBVcHdQJ1A4AHNwNHBTMHZwM9AskGZAVuA1QDTgSuBa4HswMHAj4DhQVzBDYDmAPNAdsGwgSNAq0DDwctBDgEaQfYAg8Hcwe/BYIF3gb7BtkBWQUCBK4GtwV2A0YGQgd4A+gCrgK3BNYF+Ab4Bt0GOQOlBo0HVAOXBsYFPAQbB/ABYgU1AqoDdgXWA6ACewXoBscERgLRAbwGywUCBHwEhwTuAh8E3QVjBt0FvgSVBHoFAgN1BIEECwJUBDoEjQVRB08HGgLBBuYCqwUwBR8EGwT8Ah8FVQOsB1kGhQUhB5AE3QRfAxcG/wOCAq4FSwWSA4oCPAbpAi4HqQHNAbkDzQGoA4UCcQTNAVQDPwThBFEHJQNHBb0BWALeAsIF6AIIBH8EqQEsBsAH+AFPAnEHeARUA6MFawf/AUIDyQP3BL8FyQVABXsFmgXlAbUEqAQeBjkG0QQ+BlIEhwTABDwCAQNyBakBkwbpBcAC5AROA9gBTwMHBUIGRQTBA6sEvwXUBqQCrAEgBTkHlwfgBFsE/gMfBgoEIQJvBhYESQY4BxAERgNjA/gBigUWBJgFwAXGAeQEsgXgASMEVgXwA/0DHwWLBTsDowN0A48GngYpA78FAwe9BUAGgAZJBTwH9QNdBDcHMAKwAm8EtwTWBVsFVAQqBAoHOgRABDUEOQY9BtYFQAQBA6cGfQRFBQ4GGwTRAToHrgT6AQEDRQWZBEkGMAK9BN8FogLhAzsGiAZPBjQCFwV+BMIGzAdJAw0GIAcHBUQGfQRYBVEDVgchB6UChQJTBMAHRQZcB9AEYgbgBO8G9QP2BEED+wY3Bs0FsAT4Bq4FkQRUBGoCJwTWAzwD8wMCBFcHDgfFBs4B9QVbAskGNwUHBVUE+wM8B2MDuQIQBhoC3gZVAkcG+wOKBSMEdgYjBWAGagJ6AjYGOAMWBAcF6gbNA7kDaARyAg4GvgLNBAEErwUXAu4DjwWCA/kDtANgBpoHPgZgAkwHwQY5A28DuwOHBXsGKgMmBpIHuQfYBmQFJwW9ASMFDANPA3MHNQZUBM4EkQfpBg8CRAJRAnkHNwKFBYsFxASoBdIB7gLRBNAErAE+A3YFpwYQBsYCOwNMBHcE5wZhBw0ETQVzB+QGuAPBAzgERgcAB1cHkAXSBVMCqgc5BscEwgYKB1MC1gWSB+oFtAMeBbYBogZ6AuQEZAK2Bg4DzQGHBGYHRAI8B8EFSwKvAT4DHwKpArsHdwUrB6wECgMEBMsHRQV7Bt4ElAO5AbwGeQWuA+4BPwXeBvIG3AN2BFQFcgPkASECuAPABdUGXwXoBoMEEgSSBDQDRAM4BlUD0QGXBG8EIwaHB94E/wNABC4EiALPAwMHKATQBMEE9AHeBl8DkwcAB3IHWALGBk4DtgdUBNYDmgY1B2cCBwJXB2sDjQVRBF4CFATpBYMDJQO0AvgEtwKtAawFQgadBlYC3gZsA18DogbkBuIG/wKwBNEEaAR7A1MEOQaXBGgEowQ6B18FZATxA8MB7QT0BvUD1gUtBwQEPwQMAkAH3gbBBegD1QFjBacDNgM5A5ECOwScBrkEZgcLAvYEpwMXB08DyAV7BdwEjwSTAocECgcrBQUDhQIqBoYHZAejAZ4GqAJABZ4DHgJmBc8EMgIrBfUBgQTHBDgDJAUbBLwGrARRA8wE4gRfBqoE1gVkBQIHigP0BL0EWAR4B1EHzgV8B7ACfwMmBkwGwQW5AVQDQAPCA4wGlwd9BPYB9QKbBjwHfwV0AzkHggJUBL4HqQciB6ME6AakBn0EqgbBBlMCAgQzA44CVwewApADfwP2BD4DwAWoAVIF4AFPB3IC0AQQA0gEzgd/BHYFxwYuBXME0gTnBgcF8QbhBLACJwKmBGgDewQwAk8D5AYBA0UEWwQXAmIFDgZ/BhsEggd4BZoG8wOqAwMEJQPLBz4GjwX0AYIEtAfhBGoC1QTMBPUCHgQrB8ECswOqBTYHHAKRAgoEuQQOBDIHpQNvBO4CVwVXBGgC6gSPBi4CIwOhBG4D7gLDArYEBgOKBA0HKgOAAgwD0QQNAtABPgaOB7kFhwfoAqwC7QZKBw0CWgJ0Ah8GNQfNAXgEwAQQAuABYgYCBDQFngYjAlYGbgY7B1UCUgKLApcFuwVmAhEFLgU+A4ICUQauBbMDNwWwAYkD7gUSB6kBrwNDBKwBNQWVBXoCgQQsB+kFSQM6BNMBagSjB3EGwAP1BtoFGQdVApUFDANSAnsGYQO+ArICQwTiBF8GgQTNBL0FIQXVBIUChQJRBPUBvQErBaAHIwQfAkgHcgR/A7wGzQGdBB0GXAIOBs8BwAGBAuEERgQ+A7sF1wWQB9EDuQG4AgcFBAREBLcFVQXBBAADRQWrA/gG8gS3BfkCVAOhA3AE3QQqBpUHKQTCA2AGkwO6ARcHtwUlA70CEQU5BbICTgRXBocEHAcXAqwBywF7BicCuQKUAh8FxwZZBEkCwgYtBDgDawfdBGIDnQIFBEYDPAdJAyQDVAXQBtgG5AFCBQgE0QJuBWsENgSwBhUHsgRbA78F4ATRBNYBxweKBVsCjgEXBXMHbgSsBBsCUwJcBugDsAZlBTQDYwMUAsADaATNBVwEFgd/AkwGpgN4A5kCdgRyAp8BwAXIBWsEVwULBIkE6AIdB50DbQQIBwYH/AY5B2MHhQJnBgMDrgRyAzUE5AJJBiAGUQYgAi8F+Ab6A8QEjAOyBakCHgXzBQYHUwUdB18DHgfaBIIEjwYSBhUGYgICAxQCBwUNB8cFFALdBFYEHgOnARQFSgbEA0AEcwYqBowF1QGmBMcGsAFtBbsGBwSzBNcDJwJiB8UEkgSrAiAG4AP1AvgFvQanBkAEmAWRAsQB1gWoBzkGOATcBNMEuwE+A4QFqQfqBpcEGAeHBN4EpQIkA5gB3AR8Ay0EJQYhBN0GywPpBSkE7QJvBpQC+AZcAusC3QPkAk8DsQKYB+UEQwazApEHEwe3AfABTgXRBMoEzgUCA5oFgAapAVUDCAZXBzYDVQIHBAwCHwTmBvACyQUYBUIDrQZUAykG3QZ3B+QBZgepASsFPgNHBQwDLAJxBYgGHAeiBmsEBgSzBF4FUwSvA4YESAXQBHoEtwR4B70H3gT1Ah0H9wQdBGoHegUmAj4HxgQ7BngGVwfyBbEHsAK1BLID1gV2A44BjwXWA2AFVwUNBwYHcAZWAvMFawL6BosGPgOuB+gDywe5AxAEAgRNBYUD+QOkAwAEcwatA8EEiALdBMIDWAWFBd8FwgFFA6wHvQFUBAEH3gHRBOQBIwZ8BdkBnQVhAmEHsAW5BKID6wXZARYHagY3BZYCFAU9AogGzgXsBGMHeQNWB78FTwOeBgwGKwUtB+UC9wLWBcEGFAY2BgsCUQaWAsADgQQ8BDAF+QP+AtgEQAUuB5YCWwUWB5cE5ASZApkCFwV1Bs4CTQLXBL8GAQNxBmEDAAThAZIDuwIGB+sFiAYfBA8HlQK/BfcD5AEIB4wF3gKlB7sFHgVkBUAEQgVJB4cEFgdcB/UB/gQVA80BCwSrAmACPAfKA3sE9QJDAp8DjQVmBXMCJARCBYoF6AOpBfgGzwXaAkUHZgdTAtgGeQKpAdkB8gWPB9sGAwZNBugFlwSBBLQBHwTZAj4C/wZ9BvsCQgVCA6cCOQbGAscFBgeoB7EDkwRmAk8DHgWiBtUCggU2BGcHyQZ4BiMEqwavBZ4C3gbLBj4EFwMUBkIHIQaaA5oDwQLEArMGuQVCA/sGwAPWBUcHvwVNA6oF1wJ0A2YGXgOWB8IE9QLEASYGXAW7BjkHwgcdBKYEwQROAqADjwUFBCcE0gRrA5kG6APCBc8CywFfBNAEQgfbAgYDPwSSBIAE+wMwBlYCYwP7AzgHAQSUBqME+wOTB3wCDwRCAn8GCAaXAq4HHgXCA5IGDQbZAYEC6QTUBNgD0gW9AaUC2QHnBLsFpAQwApUHoQOjBFgE9gNxBowFzgE2BaQBwgXNAeoFwgZ/A5UCxQWyA5UDrgN1A70HEgWfB0QEggflBKMCXgQnBEwCfwNvBuQBUQf+BIoEcweSBRUGUgKHB9kBEwMSBlMCGgItB+wEMQLqBgwGFAQDBFcH8wXJBA8DeQfWAysEiQQ6A9UE6gXbBkQFPwPvAXwFUAIwA+QENgSvBqwGrgcjBaoGVQLcBZcCxATCBtgEhAO+ApUEvgQcBSYCqQIlBI0Ctwe9B44HkgXfAw8ElgJiBakB7gJYB9UBWgTaBLkDWgdiAi4HsAfYA8UGLQahAlsE1QQ8BOMGHAfWBUsFrgafAS0F7gIgBocEXgRmBpIGngLBBC0GFQOwBUEFcwQwB18EYATmBSQDLwVaBLAF9QK4BAEEbAdpB9AELAWfAeAF9wImBWwF3wWRAXwFRAP8AVoHKAaHBFICiAUPB38DVgMiB5EG3QO6ASQHTgQSB+IFzgOVA00F5QTSAeoErgO/A18GIwZuBLMEJwRjArACGwSNA4kHrQE8BwwERAU5A7oFlwRmB6gHtwdgBi4FGgLmBPwCvQbdBRYFaQLmAs4FqQGgBcgBuwQIA9sCYAYsBosG/gQpBmcCRQfiAYUCawRhBZ0FFgMeBC0GngIeB5cE5gF7B+QCsgd4AuoGBASwBCQE8gTwBa8CiAJhA3ME8wW0BH4EYwPLA2MDfwKsBCwHDwfPBDAFXwQGBFMEnATNAb0CqwUdBvABOAZcB70CGQZPBIkEkQRABxUDDgawBj4DWANqBzEFVgJmA80D9gUkBlcFjwWdBBEEjAWjAb0GqQEkBp8BhAXOAUoHgwcdBj0DlgcBBAcHCwPqBNIDPwNLBTwHTQVqAm4FuQVzBBcE5AQmBAACtgecB/ADRAYIAvUDMALYBE4CHgS0BDQDPgRBBPkB8AHMAbACkgM0A/QDwgYEBAQFwAFqAq8FlgIdAykEHgWTBlQEkwb2BLsGnQRUBNwEdwSFAvYEhwduBZYEhARcBdkBigWeBRoCKAcEBF8GdAP9BE4GRwZmBygEJAfoATsGWQRxBsQEQAQfApsEvwMoBJ8H/ALDBGYEJQPkBOkDKANGA5YBAATkBC4DgQTlA90D0ARjA9AEwgS8BVoExgaZBAwGWAb3BO0EzgUfBT0DxgcmBt0BxgcZBIoDaAIgBs8H0gOiBnkCAQPFApEG6gbwAyEFlQKqBFcCUgdkBQ4HDQc4AkcGHgR0A+MD6wNfBGoCCwLeBj4DOAa4BZ4GfwPLBFwEFAVaBFADKQS9ArkDeAecBw0EJwKWA80HRwWeBlcF6wMQAo4ExgUXBs8ESwQ3Bb0BJASeBMYCcQWFAsQHigXZAT4HpAS6BA8HcgefAQIERQM2AusGLQSgBTMHXAc5A8UCnAIfBgUEdAbiAiwHVwUvBpsEywcYBuACOwf6A1EHVQIeBc8FXwPzBV8FhQMNBFsGBAQ7BCIHeQO3BVgGmAS5BFcD5gYuAhEFLQd4BJ0GIwdvBuUD+APEA3ADeQPLBkUFFgLqBIMHLALMA0EDYAbuAgkDZgR6ArsFmAIjBagDqQHzAuQEVwP/AVYG0ATvAb0BfQUWAisGvgXIAdMBOwOHA8MBbgRdBuUDeQRbBlICMgL7Bp4CwgSeBFcFlwEIBnoCrAKiBDsHWwLcBtEBGwRfBIcH2gRpBdYBJwOvBw0D7gP5AaUD5QEzBzkFKwWAB4ECaQWjBr8FxAd6AqoFbwSGB+MCmwctBCICcwTlBfkCHwJgA80DtwU+A2MCaAR8BV8EEgftBFYGaQJ8BXkCWgT5BM0BQQJ2BWcHHgXDBSIGqwaFAgMHvAVcAncFKQTWAiAEVgJCBWMD9QNRBMYGIga+B2UFRANnBrMD5QSIA2kFVwdtBBgCYgTPBHYF3QW0B9oEugfJBS8GKATyBJAEWQKBBT0G7QJKB+EEMgKuAfACXgSsBPQDvwVqBKgDCwc4A/4EhQZNAwQEaQQWBEIG5QSoAcwEYwWBB1EGnQIkBzcDPgaxBWAGcQZZBtkBuQdxBlcGzgRrB2AE7wauBysFPgX2AX8DagbMBKUBSgc6BkUHIgMMB4UCFgKlA2oGTwMrBfgCvQGwBsIDFgRWBtoEGAXZAQ8HuQLBBFgHYwYVBvECawQUAs8EcgeWA1QCXwUUBKUECQPMA50HPgMGB7sFrQOUBHMDcwasATkDjgSPAnwFJARwAwUEKARbBbQCKgVpBTADowRWBykEAgNrB4IH0QHOBVIC+AG+BPUCaAIHBUgHoQVOA+0GkQMeB0gDhQJcBQEDVgZNA78FRAQCA90EDQT8AlEHOgfgBHICwwM2AsgDjAaFAjcDRQf+AzwD2AV5BwEEyQe4BLsH9wV1BA4ExAScBuQGngUmB5sBEgZXBy4FXAIaBbsFvwXGBmwDJweIBZQDVgawAsYEBgY5BrsFWwXZAV8CXwYdBIIHugW2AXwGTwM+AzYGTgSPBeUBtQVvBOEBOAZWAhoCNgbOBaUGsQepBuABYQZtAiIHjQNfBjAFtwI7A4gE/wGrA1AHvQFHBAoEjgJwBncEfgRWApgFUwY9A5YDKQapAcsFLgUpBvAFvgRTAkQGbwPLBBQFaAQSBQUEzARfBtsGoQPCA5cEmARrAzQElAS1BFQDsgNsBxcC9wPIAwwEDgOJBS4F0AT4AvcGegLOAY4CIwTDA68HtAa9BIAEiQRnB4sFaQKsAc4BmQcOBhICcQLlA2oCKQQfBH8DqwdhAhAE+wNkBbsFNwanBnEE3QQWB9YCfgQyAhYHggeyBMQBkgeLB8IGrQHeBHsGXALDBVgCGAPgAY4FigWnAncHegIfBcYC8gR7BWIDxwOnAjgGtgdgBhgEjQPJBaACUwdZBxgDWQXVBDwCGAOpAWkDxQS0BLwGdAOoA1oE9gR5BZkECwVUBoAFZAcCBGwH6gOkBtADggOJBX0DrASkAjoHnAe7BaMGQAP3BpkBewZzBqMGgALSAW4FnAczAoQGLgSvAsgCNQfVBL8FQAN7BdIFVQJ/ArsD6gRCBhgFvQFHBqYDeQSnBdwBJwSIBmQDnAaNBJQCWAXrA/0DKgbHB1gDoQTHBMcFFwK7BXoCIQVWBVcHsALGAxQEOgU0Au4GzQWqBL4B9QMeBoEF6APOA7oH+ARFBWUD9QKeBMADxwUSBzwHxQMkBb4EaQdYBlYCSgfLBEgDlAN+A8UEmASSBH8DTwM/BcYFagLQAi8G+QQUBMACcwLKBigGZgd4A44BZQUmBMgCzQG0A1QDhwebBo8HhwRqAjEEvAW9AcYBdQZABOQE4gImBDkFawS3BdYFvgOpAT8FjwOvA9QDPgUBBC4E4gK3BwAEJQPaBfUCcATVAjcHHwbvApsE1QQQAwMH1AbyBOgGLQbcBOIE3wMOAokB+QTjAlYG1QQUBSED4wG9AR8CwgF2BUYCvQJnApMGoAKsBRgEjwVcBpcEaQVrBL0FngO9AWIFlweTBlcCnwOvBFQDWALZAV8DWQW3BJ4DRAIoBFgCIQcdB3MGYgOEBEoEXwWWAT8FNAVCBlcDuwXZAVYFggQHBxQGqAfpBR4EfwNwBN4GrgJ4A/0GHQPBBxYEqQFIA5UBHwbpAxkGqAPWBQUElgXSA3IHVAQ5A6cGkQIkB7UEpgS3ArsFaAOyB8UHAQTgAS0E6wW4A64HigWQBjsGrwWYAyMGngKJA9YC4wYeA+kGOAOwAmoHpAMcAi4CDQW/BdkEWwU9A+MGBgKWAvsGxQd4As8G5gHUBL8EeAdTBU0FBAOwBIwDlAb7A98DrwPhBGgHxgJWBc8BEQXEAkwGUwKQBfgGvQFOBFkGMwIlBgUCuQN5BUkGDANZBUgHBQR4BRgCowUaAnoCmAXRA2UDdAM+BeYBdQOcAhQFxwSoBFoEkgTLB1wEWQWLBeMCjwZ0AxwDHQNTBb0FDgcIBtAEhQaTB0MG+wawA5MHwAT2BEUG6QQ5BpgFrATnBucGkgSOASAERQaYA2YDFwWdBuQB0gVPA10GxQTCBB4DwQIGBnADIgepBcID8wLGBpwERAN2A7QFXgWUAdwGjwKYBIIDIQP9BhME8QIhA7QGRwP3A5gD7gU9AqQGXgXYAhIFrAffA0cE2QEEAx0HpQMABK4DrAaaBqIC3QZzBvcGqARPA/gEsQGhBS8FwwMnAx0G+gOjBfAB4wNtBIEE2QNIBN4EvwTZBH8D4gRTB24HlQEiBGAGKgTGBWEDvQX1AcgFcQLOA6oFIwZrBD4GHwPNArUEaQR0BNsElAP1Au0GsATgBM4EUQQNBOcCYAI8BuEC0waJBGUDzQWxAqgDqwJQBAMHtAMcB0cHcAaBB4kCqwRHA2oCnAcnBdoChwceA2MHZwKJB38DhgLkBLwF1wIvBPsBzQfNA7MFlwS9AeIGjgLkAf4CswRzBkIGhAL8BWEHOAYPBt0EewbQBDsH5gEwAsMEUwUYAgQEDQQiBmcHrwaiBmUCVgc2B78FzAUoAnYEJwRgBVQEvATCBVgEpwQaBtAEswXgBLkHngIKBqQHbQR4B48FJQOJBNAEgQSJA8YFKQTSBF0HRAXdA/oDsAbkBDMEdQS9BJYGMAKyA3ED4wMFBHgDZAJeBU8D0AOVAqgCkwfoBn0HrgelA/8BAgctB1YC5QH6BdkB8gQlAtAEqgboA0AE9gaaBT8F1wOdBAoGRAY7AjwFgATlBqgExANqAk8D8wZ6AkADAwfmAfsGsQUGA0sCHgRMA18E4QbBBU0FcAfJB94E4wInAlICwgL9AZgFige9AUYCPAOZAYgEOgQSAsMBTwOpAl8FRgLgAesFlwI3BZgDrwdJA74ERgWtA5sEggMOBOsCiwJYBiQFjwYRA4EG0AEuBRkHVwXOAhMEOwODBnICZgJXBy4E2AL4AmAFZgIWBAsCLAbWBpYD2AYvB10H+gEIBnkCBgTQBC0EEQQMAj4FKAYCBDsCxQV9B6oE/QQQBx4FwAUqA2UDIwVnB8AEiQTNBUcEdgbuBFEHfgb1AWsE9QEMA8QEOwSaBtIGZgeMBgsC6gaaBVgCZAWYA2EEWQTUBL8DTwSTBzEFlwLbAuYFxgEUBSME3gWnBXcCuQfRBrkFXAIWBygEigd5AmkEEQMvAj4DCAYWBM8BMgNIBDsEHgWQBXIDdQNfB+YGzQWGAngDXQIKBnEFeAW5B0ADtAZ7Ag4HsQUYArkDjQNaAosHEgX0BXgEhwTdBWAFRAKRB8wEjQPnBBQFMAfOA7kDVQWXATIC2AJnBcsE7QOgA9QD9QbhAdwELATgA9ACXQZfBWYFzQN7B70BYwXbAVcEAAPrAY8FLgXkAa4HAQOdArEEEAK8BlYCqgU5Bv8BlgV9Az4GogRpBiEE4QSCB9oE7QY5BgQDVQbOA+4BUwVmBXMGmgV8ArIFtAKFApsD3gOMA4EEBQUSBNMEJQUFAokD6wP1BgIDtgIPBs4EaAQJAvkEhwe+Aq8GtQTmBHgH+AOkBJkE6gReBZwEkwRcA0cFBAM7BMUEPQIyAgcHpAS9BVkF1QK4B4UCSALNBO4CEAdfBWIECAJxAgUHrAWmBGcHiwdXA1gFYQfeBLcFiwU/A7sF5AMfBgMHfgTBBDAHhAS+B5YDjwbmBUECHgK3BDcFAQPIAUECXgVaBD8DmAX9BP8B5wQCA1sCmAVQB30HIgdGAx0HAQO0B8AFyQTCBlsEDgSuBUUG5ASWBFcE1gTaBn8EjgI+A7QD7gI/Av8FjgVUA58FogcxBNgEJwR4BLIB1gSwBIsCYATJBc8FFgQ7Bx4FiALGAoMGhgZGAiwF0QMOBN4EaQQrBZ0HvASbAyMG/gSkAVMFJQWpAckDbgfeBnAGdAOeA48HeQO/BI8FAATYBFgGiwdrB18GJQaqA1IEBQSFBFEEOQNZBDkDuwFTAkIFBgS7BvsGMAKiBv4EXAIhBUAEUwYfBmsEQgNxBXkFGAI1A8UEUQemBH0DKgR4BagFRARfBqwEMAe0B0MC/QUYAsYHWgcUBacDeAVHB6wFlQfDAaYEIQekAUgEUwQuBeYBOAOeBTYDngXkBN0DxAJ7BhoErQYyBFYHZAJfB+QBxgKaBS0DJwWlA30H2APGAp8H4QRJBDEF2QH6A9oFPQU4BPYGSwXDAfUBTALMBIcHJgeIA+gDowG3BC4ErAT1AuYGQAThBSACUQaEBVYCfwcPB3EGeQSxBNIGyQfFBNYF2gX8ArMDrgXwA4AEfwJjAwQErgejBkkGegS3B6EDQAMMBI8GfATiBX0EIQfUAl8DuwVfAjQGNAc+BSIHzQSyB0kGXwcoAmAGkwYwB+UDUgIAB7AHJgS3B08DmALeBWAEuwWABT4DoAKOBTYElwT9BSMHwgaQBMwEYAMtBwwDngZ4B38HawRkBYsFIgaoB0ADFQWVB3wEEgY5BvkFwQE4B3gHUQcnApEG2QIkA8cHhwckApYByQZSAlkE5ATbBCIGpwYWBzgG6gVPA0sDtwRqBMMERAL5AtEEbgQdB30E5ATGBIMGAwfOBNEE+QH4BuEE2QReBdEEVwVYA2MHDQXoA1kFkwTBBIgDIgfZAqkEYwNfBpoDhge6BRMDCQSvA78EHASRBScCNwOCB+kD6AI+B7AEvwZVAhoC9QWsB2sE4gGzBtYD2QFCBCAHOgZaBG4HUQanBQsEuAQ0Bg0HLAdxAv0D0AbSA+oFwgVEBUIDQAWsB7cGkwcoBMMCZgU0BawEeQSIBucEBATYBHAGlwTiBfoDtwU5BhIGfQTqBVQE9wVUBAIEjgUIA7kGcge1A/4EzgP6A9IG9gKCB8oDbQX4AiQFAgYfAoAEWgNnA+QEBQShA0UEqARsBaQD2gI/B8QELQZxBlwEkgNDBGAFfQPLB+AEVgWYA7MC+QIwBnAGzAWiB70BiwWHBG4EMAcBA8UB3gS0BD4H+AO/BVsCWQVNArsEVwXrAbACqQSBBdIGtAOVByYFkgT4BKoDZwLYBBUDNgOSBz0D4wJyAr8F2gTrBRoCYARuBA0DyQaBAsoEzwQSBMsHrwTZAWYCkgN/BAEDZAWsB30GRQRIBmwCAwdGA7sDBATKBtYFQgZzAksHUANZBq8FDAN4BXECXAKnBvAC4APJBnIEWQI+A1MCYgUYA90FfgPCBnID1wakBzYElgFoBiQD9wZhBDYHIwcWBP8BMwfVBBACKwWNA6IG+gOdA04FvAZLB8sGAQPOBEsEwQRwAgkExwJ4BacG6QWNA30E2gWhA6oD4QR/A30EsQevBeQBQwZgBS0DxQVOBAUEBgR2BHwCQQbPAQ0FiAYBBAQEgQN6AlwGhQLAA5oFQgYiB24EbQSoAxQGbQJBBJ8GAQY1B+QBfwOZBJUDHQbkAZMHbgS1BJIEVweBBwEDpQZFA0sHnASJBIUCMQOLAssEhASQBIMDZQMIBX8D5gFzAk4G+gYVBDICoATIAZYBdAVhA7sFZgUCA4EEbwIGA+oEigWzA84EUwT1AWoGdgUjBboCHgPrAYIFeQe8BJsE9gJWArsFYwI+BuYBuwWoAXYFgATQA2EH2gQeAqEFcQYkAvoFfwPSBeYBJgZwBMkGmQdeBYwCDwejBA8HaQRBBQUERwd6AkwGSQOlArAGWAP5BMYCLwLXA2MF1QSPBaMEugaBAtsE1gWlArYDPgVSBsMDVwUZAl8HAwe9A/EDiAZsBi4DZQNXBNQCyQa7BTQCXge0A9wBHwV5As0FywdXBZEC5wQtB+QEvQQaAs4DawS5B14EdAOcA40DAwe7BgICjQQFBIICWQeXB30FuwVjA68HyQYtBjoEngPzAjoGBgdzBoIHTASFArkEsAJGA94GwAPkBOUCrQNPBBkCywTnBpQEYwKUAxIExgJjBqoFzASkBF8CvwU2A9YFFgeRB2YD5AQrBU0GqQIRBaAErwMeBSMFNAfeAsYCHwLQApMGZAUzB38CUQT8AqMEKgRRBr4ElAMbBOAEtwXJBgAEQAN4B2wHQAT1BgcCVgL8BWQDbgWJBLACkwfXBHcEvQdNBusGSQPhBFsGKwPHBaQC8QPRA8EHbgXdAlcHcwXoBl8GcQaqBMMEaAV3Bv4BsQNUBn4HwAIQBE8DjwfGBrUHsAH/AaYFvQW6A8AEmAd+A6gEAwejB4gD/ATGBL0BaQXYAvsGsALkAd4E8wY/BWYCegI3AjgHlAcpA8kD0wUxBQwDaQY+A+wFDAOFBNEC4QSyA1EEiQR4BWIFwgRRBKMFuAOuBWED6APDBd4GOgfIAUQDqgLIAuIFUwLPBLACVgZrBBcFIQIHBVIG5AQvBAAELQQ+BNMBxwT2BGYFzgWsBEADUAa9AfQEogGFAswEbQSPBrkBgQLwBVgHWgJDBMcEpwQ6B2cHZAXOA6wGpQN9BNIGtgOqAx0GngIOBuEBwwH1Ao8GigT5AlwHfwOYB2YFJQX2BJAEyAPBAv8BZAV/BFQGqgFKAsMBkgXIA2wEYAaGBjcGzgFbA6sDKwdgBpQCMQUXBLwFUAKpBMYCRQVUBNkCrANlAygEQAbTA7MGegIfAjgFvQGRA4sHmgS0B0EF2QF/A2sHPgecBh0E+QSzAyEFuQdzBEoHzQTgAqsCxwMbA3gHqQEyAlwEmATLBK4FVQPDA/QG8gK5BEwD/QOnAvsG+QEpAvgE4QHPA1AEjweoBX8D3QSLAfIEZQSvAz4HawOvBGECVwPWA8AEcwdzBVEGQwPbBCwCXAb5Ab0BAQJFA/gEowLGB8YEWwLyBSoG7Qa3BOkDTwIpBl8GRQUfBoMDlQUBA+IFeQKLBMwErgeuBbUEagbrA50FSwMgBoADqQfsBVMCDQdOA5cBfwYOAikHBASGA4IFgwTcBfABYAZ6BBQGHgaPBHICuQRZBKwHewU6BpAEfQcAB78FXwbcAxQCpQMfAvkFzQNuA54DFAW1BVYCcwUxA3AC3gLOBV8GwwQ+BMgBhQUeBT8DCAeSA5gBjAU+A70CLwUuBZ4CJATiBC8HlwS9AbQFIAX/BFcFkgKVBfABlwaCBx0EiATDAZMHfQOLB8UFOANEBgwDJQbGB8kC7AT5AUgFWQVzBDUFSAYdB2MGGgK4A1AE2ASZATIEeAPDBigERAWPB80BqAG9BnoCnwEMAgQDvgK8Bp0G0gUhAy8FUAedA3wDgQIZBCwE0gaeAu8FggfNA9sD0wO+BI4HegJRB2UGdgUfAl0EpwRxBocE1QZ/A8IFuQNQBj4D/QT2BX0HsAKOAgwDSAdgBg8EgQIdBgwD0gXkAZEGZQMsBzUDDAfkA/kDkAT4BgED2wWeBqwEmgS5ARcCWAJaBnMGbAYaAsAF1gOMBbMCHgfNBW0GWwWBBQoGPQZTAmQFUQThAckFqQFmB/UC6gThAYYHfASFBBEDLgKEBuQBpAfFAlYCkgJ/AyYDnAN5AlwGoAQkBJwGaweYAh8FyQMFBMkD8AS1BE8D+QWeBmYHvASvBVYCAATSA0QCkgV9Bu4GsARcBPMGngXUBA8CRAZCA/YGUwJOBPYELgcEA2UFXANmBb0B/AGyA+QClwRnB1kGLgQQAgYEUgJYA6QGdQaPBeEGjAeGA7kB5AadA/4CBwecBLAC5wMvB4cFAQP2BPEBywcmBogGZQZzBgcD2QFzBQ0EogTeBtwDlgHqBLQEjgM+BNwE9QLWAngH2wEYA1EG5ATGAqgFIQdjApUE+QE1BWgC0wWwAvQDFAYXBg0DqQbeBbABgAW9ARQC1QaFAmsDYATnBjoEkwO3BXIH/QRQBlcDRAZJB4QE4gTnAicHpQTUBHICyQOCAusBsAU+A9IGrwVABA8HeAPcBZgDuANLBT8EJwJjBikH+APvAwQEfwOFAsME2gR7Bu0CwQenAvwGDwdPA/wDZQNYBJQDRgI+BQIEggKAB5MEOgTTAsoHjwX0BBEC6AbNBTEF9gYfBAgH7QauAbcHeAd4AsUFFAWYBEAFDAZaBAAHhQINBDAGVQKkAVQHYwKtAZIDkgUMBqcDOQSFApYCWQUKB/ADyQaLBj8CAQNeB9sDuAI8BQIC0gRHBwYGEwcLAyMEmAdFB3EGFAJyAuEB/ATJBvgCLwSxBBIH3QZxBtUD1QPkBBcF0ARhAmcFyQTdBLMCvAXkAgAEtAR/A78BgQLlA+cGSgciA1cGagL9BGYFkQSFAt4GFwVpBCcCNAfXAiEDjgUeAkgHFQSjBF0HrwPwA5AF+wbBBR8GoAMmAkkGMAbwAakC0wFFAnoHnwGeBYkHsAJnA+8GjQPZBH8DaQSuB9gGHgYMAwgDDQUgBaYFAwe5ArsFVAeNA3MHlgEbBmkD/QOlB8wBXgPCAf8DsgPnArMGRgXQARsGcwK0Am0H8AM4BuUEZAMuBOcGgwd5AkIDuwWABxQFygU7BVEDowTxBQEDvgQWA/YEqQQEBL4EsAMnAhQEBQclBrcENgTCA2gCSQVOBtIBOQM7BTMHmAUoBgUCewPhBKkDtwRQB6cFKAQeB80HKgRIBFEF+QG9BQ0DyQX5BtAEfAI+BXUEnQUMBIsHoQQcAl8GpAa3BUIG9QKkAwMH2gQFAyYGOQefAuQE+gLxBZgDDQNyBxsELwUTBIQDwATMBBYC2QHtBl0D/gM0BusDRgUQAn8DWALmAcABlgYdBysFhQIgAlYEngSJA4IDbgVzByQFlwQUAtkE6AOaBlMCRQXgAfwFrgewBjwErwECBJsFaQO4AyAG3AFWBlgEDwcUBWoCeQOXBvABHQdSBdwEVgYXAuYGsQPOBQ4HDAMoBvQEPgcdAs4EJwJZB6kBaANXBJYEwgZ/AlwHVQKFB9oDuwbNBq4H2wLZAigHeQLwAR8CtwWlArkBwgUuBAoDHQfmAUcEXwYGBwoG4AFmBRYHbgTMBDYGSwIPBz4HUAbiA6kBhgeeA1cFzARIB9EBuQFzB5sDawfmBqsDLgWUAqQB/ASZA2sHMQO8BQYEsAKpAZwH2QHQBOcExQKpBVYCCgcFBDsDgQJzA70HzQV0BGcCHgTPBvcGwAf7AzgFGAOZAZIFuQHhBAAEHwZGAtwCMgfuBnMDBwXDB8sEbwT2AToCBwfgAUUDhQIXB+QBkAUEBOMCCgZzBPgEGAJYB0YF3APmBi8H/gRFBIIHjgGCBSgDVAS2B8ABPAWjAd8B0QTUBsEGpwUcAj4F0gOwA7ACvQGrBiQFAgOuBc4FaAZ2A8wEkwdGArUFxwU+A/8BvgZeA2UHcANnAskD6QaSBzkGAAQZA8ADuwUjByQFOwc1BQ4GLgLiA7IHEgYXAqMCsgf1AYEFMQXwAR8ELQbeBF8GdAb8Aa4HxwUWA0oD0QWTAToCzwLlBBYCfwO1BDoE1gZ/AuAEoQX8BMMB0gVFBlwC4wPqBiUEawM3ArIHwARWBicF5AEUBY4B0gLvAg4HVAd9B/MBnAfuAkkHjQTOBD4GvQFVBTAC4gTnBAgDVwRbBrcFLQbSBXYFnwQhBqgB2QFaBBsH5AOCBaMFXAIMBcoF6Ab5BL0BZgK/BWsHXALyBb8FnAZRBwED+APjARYGDgXJBs8GAAPWBB4FDAK2A8UFUQRTBDAGxgIEBAkDMgRuBcYFzgNiA1oDJAOhBVgDlQcxBH8E3gZQBZwGggeABeIGiQdgAy8GIgbXAy0EmQO2BTUD8gQFArAClgdzB84F0AQ5A04FHwW4A1gG2QFiBPwCSAciB9wBoQNPBosD7gKhAysHdAYmAlcGUQQfBoMGsAVvBg8GsAKIBR8FXAKFAr8DUwTtA4sGigIDBLkDdQZXA+ACZwV1A70BggSCB1IF/wGuBawGjwUwBBQETAZPAnECsAKFBgQEggTMBGsHMAWrA8sDrwdXBSIDKAN8BBQEmwfqBZ0EaQZTArMBqAR9BzACDQc9AikH6APwAgsCCAPBBVYCQAa5BN0ESgZ5A38DXwaLAoIHsAWCAiQCXwbkAUIHDgRlA1gCrgVbBfoDdgchBg8H2wN6AksFqAM0BSsF3gUnBCkEAAQ3Ap4GrgIrA7ACiAblBGMEWQSSBxYEBwXZAsMBRQO5BbIGvQWzA7EBYAPgAvcD3AW9Ad4CWQXCArMGFAUwBMMBUAYUBd0CngYjBpIHAQPoA7QF5wGKAzoHuwVABDcFtgMCBC0HKQRYAgEHdAN0Bq4CbgIcBf8BNgOoB0EFFAVZB3gHOgZnBAQEgwT/BXME3gQ5BooFHgWnApUFDQR3BEwGsALJBsYHZAXFAqIGJAXiBSMEXgeQBIUFyQXhA4ECDQOlA1UEEQTOBPYEvQFLBbkEJwLFBGECAwftBgwH2wOOAR8G5gFmAlsDcgLuA7QHLwIWBFgCqAdeB4IHaQILBboBwgaoBnEHcgfxBkAFXwVYBe4GxQWFAy8CzgP8BSkDDwLFBVcHIQXNArEG/gSfAf4D+QTPBwMHFAXWAuwEkwZyBj4DPgSGBNYFHQY0BQIDrgQ3ByAEiwVfBj0CUAWVA9wEywcVA6IGYwTDAboHtAfGBwQCZQW7BOcEqAGpAnsFoQSMA5QCQAYiB3QGOQbzBYEC3QQmB6cEWgTAAycC2wGOB08CYAaoA5IDGAbABL8EwgVUA8EClwdAAxEFyQLtBSMGZwfhBpwHFgfiBJkEcAbcBI8FnALkBKMF5AKFAoMDxwN7BAMHagQeBO0DaAeXBOkG1gM2B7ACRwV9BLIE3QT+A4IFjAVXBxoC8QY7BUgGHQbCAxoCJAZrAo0HvwVTBBUD3AFoAoQGMwfQBGkC+QLrBQEDGAMjBakCQQamBsgBiQTCBg4D/gTeBrgDpgYeBb4DqgPSAkgD9wH1AjcFLQLhAcAFRQb7BmsDpAbqBJkHFQaeApcCkAVYArUDaAVyAjYD2QGCBGsHYQfPBzkDUwb1BgwG0gFYBbAC0wEHAooCewfXAhIEywTSAt0EYwOFAvUCtgQiBlUCdwQnB1IHVAQABvgCVQLrBooF8AMBA+UFyAOTA2MEvgQeBZkFnAKPBWMDxAIWBd4EUQewAX0G0AVXB/4E6AMjBTwFbgRQB54CLgRpA1cCuALOBHICugHlBqoBXwTzA4cENwN/A8kDIAVqAnAHdQLmASYHDASwAtoEzAMkB5IDCALmBtAEBAUhAssH5wL7BiUFyAXeBDkHeQdSBvUDQwe5BaAHngL9BBsEDgZ7BdYF0gYEBLkEjQeCAkgCuwVYAvYGvQFYBeoEeAbJAioFnARHA6UCxQINA00FRAJ5Al8G2gRxBqYDKwU4BfEGcAbHB9AEIQXXAkUHvwEtB/wELgcBBGgDbQVeBaEBnATYBHoCTgWHBKEDgQLZBLYD0gGpBRUG7AUoBKkFQAT/AtYCJQbbAboHOgfyBC0CNgdqBPYGpgV/AvUCkQbKBmEHrAIUBK8HDwIRBbACPgZiAwUDZgd4B2kFNQP1AT4DBgbSAZMH6QTGAlgF6APHBRQFBQKsBb0H6gWWA+ABGwQiBsAFpQLOBaQHZAUiBjgGZQOMA5AFPgMKB9wFogeBB3gHoQNVAuUF4wafAT4EOwMyBz4DlwTaBckDyQYHBLwG/QWgB5EHUwWWBXoE2wWOBM0FjwLlBH0CowJwBa8EXweHBX0EYwP0BjkDxwUhB68ByAPsA1AHjwXWBnwE5ASDBAcEAgT/AwgDrwW5ATkDkAWhBN4DKwUpB1MCsAYOA1kGPASjB90BKALkBDEEOgYbB+gEygNpBugDcgPxBvQGSQOvBTkDhgO5A4MHYAbUBBQCfAaXBPgGsAGxAacFoQXRBgUDpAQEBI8DUQeFArQBHgS5BKQDFgdcAvEFVwf2BFsGSgT7BWAFbgQaAqsGNge7Bt4CaQMSBz0GFgLoA5EG2wXwAicEfwN2AmgC7ASsBGcDvwQxA9gFgANkBdkBUQT0BIAExwMDB2sHHgVkA18DIwXsBC4CxwRxA3QCuwbuBDADyQRaBOoGzQRsA6gGlwSQA70Euwa1A2wEBASiBDMG6wL7Bn8DFwIlAlYGEAPCA8MFxgbTAT4DpQZXBS4EuwHwAXAFAQLoBqEEpgZ6ArQH4gTeBLUEGwPEAfwCiAXZAccFcwaLBYUCNwcJA+EEIwZVBAoHvQHkAS8CrAdJBo4HXwO0AkEGWgJZA0MD2QTWAuECXAVfBTwH6QKZB1IHowQCA0AGiwXPBVcDxASmAeoFWQfXA4oGyQRYBG8E9QaCBEgEQwaPAjYD+ARTAscFQQVXA6gDVATMBM4D7gGsBYoFwgOdBG0EfAcmBtkBNgb5AcYCWgIeB3wDGwfeBQEDkANSA3cHVQJ5AscFywRsBOIEIAROAqYELgUjBHMG1AJHBTkGGgI/B58BiwWfBG0E5ATzAXoElwdFBsYCSAd8AkYDlwS8ASwHJARYBREDpAPlAb0BeQfmBsEEjwb9BM8BHgUtA2cGAQM9BkIGUwaeAlsDSAJoA8ECuAXQBEYFPgNjA+IFIwbRAQAEgAYaAp4F0wRWBB4GGAMyB+gDeAOwAnQFUgPGB4MDsgNUA2cGFgRSBXAHmAKBB7MEYwXSBcIDBARwArAEawdFBMYGuQEFAvUCygRvBtUBbAP7BngH7gLeBLACDAc4BEoEewS0BGUFsAJuA6wDhAT4BEIGYwKXBXUE0gSBBPED2AZVAlICmgRWBi0DiwYoBA0EggVcAlgFsAR/A0sCnAY+A1kFwgMjBTIFsgTbAjgDbgWLAy4EJgVGBKIEDgYMAo8GnAelBc0HVwWOA3cHfQRYBjkDsQfeAhMCwgbeBMYGJQMbBz4EXQfEBGUD0gSaBFAHFgRQBegC+gWUA3oF0gGuBfMFrgWSBiIHqgNIByMGHgaYA9IC4AS6BS4HlwLuBsgCdwaLASwHyQUgB8kFwgPWAU4FJwVABLEDCgXeAw4EFAaSB3AG/gShBGQE1gQCA/EFIgZ4A7QFVwaGB+EE8QKuBVwGOAYvB30C0gZXBcEErgdyBlAF+wY8Ba4CFQcpA7cFrgcXBc4DUgY2Al8CgwPrBZ4C0QGwAvkFNwSSBJAEIQWlA1MH0AJSBI8G2gMmBhQF0QTzBiIGLQT1BjwCDQIiBh8CJgSCBgYHNgQEBEgEXwf9AxsEawQEBL4FoQLgBG0CDAMaBjsFBwTNA5oFIATCAcsDlAVJA1ECngW/BXEEIQb3BV8DBAMxBXkC2QQ+BsEEbgM8AzoHIQYqBMEC/AGuBQEDoQRrAyAGuQOdBKoDfwObATsGnwHFAvoDeQdUBPQE4gSFAoIHwAPmBXgHeQNBB8sC4gV6Ar8FrQZjBLAC5QS1AlkHsgPfBWIFewP0AxQFugYrBNYEnAJuBUsDRgYiB7IDIwSXBLwFPQLMBQIGSwKNA04CngJwBS0DfAU5A4YGqQHxBTYE1gLRBAEDuQf2BO0DeQe7BcMDTAcPA+AEywNMBnEGRwTAB1oGMQUXAh8ESwV/AnUG5gHaBVkCxgKaA74H0gVrBLIDeQMPBqQDrgSSA7sBhQc4BlwCeQK7BeUGkgU5Ay0GtALNB+EE1wH4BHMGKARCB04G2QPeBKIE+gPHBfYGQgMUBmYCYwdgBXICUwTqBbIDLAKyBkQEzAPOBLkDUwKKB64COgdnBlwC3gZ7BmQGDwLCASIGzwTMBa4HxQKFAtAE3gNlA10EZQMmArcEtAcQAhQGXAa3BCkDrwLVAfgCFwbxBXkCiQR8BGIDrAM/BHIEkQagAfUBcwSGBqoDiwKzA9sF6ANRBw4HFAYeAo8GqgMPBzACFQOZBsgDzQSyAmsErgfzBR0HcwS9Av0FXQRuBfsGQgOuB4QFOQTZBDUGUQawAo8E0gVzBDYG8AFYAmEGmgS9BKkCbgRRA6ABigTNBL8FgQOCBHMHrwM0BA0H6wPZAi8FzQPtBvEGwgMeAr4CIwZwBkUGVgJ4B1EGVwbqBq8BlAOABKwD5AR0BGUEVAdHBI8FwQRuByADogcAB50FOgSTBoMHAQPWBLsGWAJTAk4GOgTGB1wEqQKVA5IEwAWWBy0DsAS2BJUC3gNjA8YF4QSnBDcEUQRXBbgEwQSrAjkDcwV9BWQDOQVjBgkEhQJXBSAChQU9Bq4FGQe2Al8HmgXJAssGVQNlBTEDkQJXBB4F8wZKBx8GvQVLBXgDsQfCBYIC2wKxB+MDVASYBZcE4AKdBZcEngW3AUIGtwXQBK8DrQLJBqUG0QMgB9kEywKZBcoBOgbeBG8G1gLrBSIGJAKLAnoExQXCB2wEnAP1Aw0DXwOIArABYgfQArsFWgZzBi8FFwUwBPcFBwM+BdIB3wPdBBYHiwdiBBoEAwSUAw0DKQRxBq0FUQM6By4HVAQkA+wE0gEzA48EkAOWAkIFyQN5A5cHngNQAx8G1AFyAigEEgaXBHMFRQbZAZoEoQRxBscD5ASbAc8FPQOaBycCZQQ+B80F6QP2Ar4CMgMHBdwEGQQPB/ECsAK5Ar8FzAOpA0YGhQLHBHYC0QZ2B2cC1gFGBe4CqgMPA3kC5AY5BlIG8gFcBVYCRwbBA7MDewbkBiUF3gR/A58GFwPwAmAGzwWuBZwDZgT5ATkDTwYqAxoDTwY+B+AExQJCA/MDZwKwBKoDaQNfBLMEMgK0B7wGlgPuBuQEsQcqBZ8BjgKoBwIEoAXbATgExgJuBPgG1AUABAEEVAZtBpUDtwTTBFMEdwScA18EpAKABgYC5QYrBHMGSwcUBXcCzgR/A+QEOQMNB+cGmQPTBq4COATOBN4E3gL5AjYDpQMLAjMDAAL3A9gGPgN5ArsBsAZCBjoHlQSuBDkC/QNWB4UCGQSeBvECvQG5B+gGDQfrA8wDxgOTAl0HDwSWBXgGUwIwB3EGtAcOB1UDDwdaB24FgwQCBBEFQQVrBDME6ALkAdQFLwbwBtcGcwKiBWYCQAS7AW4CWwSQArwFWQLRBkQFOAZhBa4EvwP5A7QDeASYAQIDCAbGAlgGzgFUBt0EVgPZA1EHFQR2BaQHKgbqBS4EHgOgBz4GlQdPA64FuwX1ASQGrATlA8YH6AJrArIDdgWSB4EEGwR/B9sB3AS/BPwEcAcnAnICPgbQBH0GOwXpBcICKQdUAoYHlwfRA1MEkQYtA0IF8AG/BeIEtwePB3gFZQPCAWYFugclBVAH5AQuBPkD1QS4B+wErgIkBHMFqgfFBmkF8AGhAWcFsAKiBDkGaQMMAx8CTQWuAwQE4gH0BcoFGgLkBNUCngfHBE8G5gbTBP8BHwJ4A48DkgWJBCEG4AMVA+MEsAKCB3EGxgZmBMoEJwV5AuQGwgP4BlsCnAZaBxgDjQNjBLEErwRuBZcGPgOuB6kF0gT0A0UGgQc3Bc4FOAUBA/gDnQKgAl8FrASrAlAHagIaArMD5AHwBpACfwOaARcFvgSwAgEDUwYHBVIDvgKhAwUEHAd2BTYGTQKSBZIDzAW5BXICJwRsBDkGlQaIA4oEXQTWA78G9QEgBNsD+AKJBQcCSAZkAn8EfQL9BdcFiAcjBJ8BUQQ+Bn0D9wQ4BT4DQAWpAgoHwAESBhYE5QPgAiYElASIBvwFFQPIAYkFcAdSAkMFXwKyBw4GHgPlBHAHHwS7BeAEMgIqBkEELgV5AoMHXAJXBtsBVgJyBaMEcgIsBF8GxQRwB90C0ASYA6cGGgJLBTkD8wWGBbsGrQJcBBACTwTWBT4HZAU+A9cDIwZjBiMCeQcFBPgCOwbPBVwC6QUnA4kEywSPBLcGBAR8BosEywRLAywFqAU2BIUCogS3BXAGNAQnAo4HSwUmBeUDEAd7BRwFFQYyBIUE8AaeAkUE9gTlBE0HLQY+A2UF5wMlBiUD2AJGBfgClgWCA8UErAHwAy0ExQVAApQEdgbdBR4GAQMuBdkB+QXvA1MCSwXeBFMECgd0A5AD+AVaAiQExARFBL8ExwKoASIGtgVsA1IFegRPBvsDlwdPA3ADwwT4BEADcwanA0oHNAYpBOAC5AEZBzAGFQdrA64BVwTBA7QDwgXkAYUHvQP5A5YB9wS1A/4EHgVCB20DSgflBKQCwwHqBu8BMwegA1wDTQVCBr0FFgLfBZUHGARfBuEGxwTCBdsGoQHXBAsHzgWCBekDfQIkBfYEMARzBNIG1wPbAZgE1gRzAkIGqQNJBmID4gRrB6IEIgZZBXYFWQd/AlACJAREBiMG2wFLA8UF8AMtBlED7gXGBG4ErwVkBeEEwALgBIsCQANfBWYF6AInAsQHwQRYAygGTwOYA/IFzwXkAY4CIgbIAwoHdgd5A3IHcwbZAZgDHQdXA9cEnwYaAocG5AFiBUcEHwapAQwDbgXFA7kB0gVWBgQFlwPGBnUEsQO0AekD7QQvBUcGwgYkBMMF/gPNBXgD6gXhBG4EBwXtBEwGEgOSA4ECrQQcAhQFLwSGByIHvwLuBsYFDARbBqUExwY+Aw4GuweuB2kFeAX5BCsCcgJ5AkQGqQEMBuQEAQMBA7sBwAcDB6wEPQJmBTgHeAb8BM8BIgeWAT4FrAH/AckEbgX1AWkDeAWIA+AEmwHAB3sGtQSFA9YFpAHzAh8GbQTuBjkFRAUOB6sDsAIAB38C1gKuBfsGnQdWApUFpQOtBEcCjQdPAysFTgJyAxEGAwdyAhYHawToBssExgc+BhAH5gJ3BXAFKgbaAz4HawcnBSMEfQfBA3EGOgf1BRYE0QSIBTACXwW9AiAHdgUlAzEFMAfjBtgFGgSjA/gEzwFXBRIEqQXQBk8GkASwAkgCJAROAnwDyAHJAv4FrAP3A5YCZAUXAt4FQwZTBYwFVgJ+BBoEdQQ2Bw0D/gORB5UFmAVzBHYHqwHlBjYHLwJ1B6MFVgIgBrUEKgavA20EtAWWBNgCwQZbAgcF9gHkAXYDOAZqBlcFHQSQBpcEMgOPBk8GiQSsBPkDzASBAyIEawMHBTwHDQaXBAwEzgHRAU8DsASpBDAF8QNmBt4EKAbXAVcE0gEnBQEDNwciAgoGIwctBsYCAQMtBkUGUwLPBc4F6gQpA+gE7wP/BfAD2QE/B1EH+ASqAqQEOwJNBdcB4gQ5BsYHHQQOBJwCFwWsB8oCSgR6BJYCKwPrA2kHTQWpAVICYATgBoIH8wNUBIMGzQOuBRIGkgToAswE0wQuBFoEzwTYAwQECAQVA9QCRgWwAb8FZwUIB6sD7QHNAygECAdYAj0DngbhAX0FdgPXAWsHrgctBskE0ARJB6wEmgSjBC4ETANuBUMC5AY/BdYFUwVPBJQEXgUlBw0EAAc3BYsFvwXbBIUFFAa+BKcE1gPGAl0HXAPWBcYESARyAsYFcAZXBYkEMgJUA2wDsgYeBXYDBgSwBP8FfQRAA3ICHgUyA7oBxwOABdgCnAGKA5wCugaoAjME","modLinks":710,"nLinks":15000,"groups":{"k":[1,2,3,4,5,10,20,30,50,75,100,150,200],"g":"AQIDBAUGBwgJCgsMDQ4PEBESEwAAFBUWFxgZGhscHR4fICEBAgMEBQYHCAkKCwwNDg8QERITAAAUFRYXGBkaGxwdHh8gIQECAwQFBgcICQoLDA0ODxAREhMAABQVFhcYGRobHB0eHyAhAgMEBQYHCAkKCwwNDg8QERITFAAAFRYXGAEZGhsBHB0eHyACAwQFBgcICQoLDA0ODxAREhMUAAAVFhcYARkaGwEcHR4fIAMEBQYHCAkACgsMDQ4PEBESEwABARQVFhcAAhgBABkaGwIcAAAAAAEABgEHAgAFAAAAAAMAAQQEAgUBAAEDCAQBCQIAAwIAAAAAAAACAAMAAAAAAAAAAQAAAAAAAAAAAAEEAAAAAAABAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="},"hood":"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","terms":["9+0 Non-Motile Cilium","9+2 Motile Cilium","AP-1 Adaptor Complex","AP-2 Adaptor Complex","AP-3 Adaptor Complex","ATAC Complex","ATP-binding Cassette (ABC) Transporter Complex","ATPase Dependent Transmembrane Transport Complex","Acetylcholine-gated Channel Complex","Acetyltransferase Complex","Acrosomal Membrane","Acrosomal Vesicle","Actin Cytoskeleton","Actin Filament","Actin-based Cell Projection","Activin Receptor Complex","Adherens Junction","Aggresome","Alpha-beta T Cell Receptor Complex","Alpha-ketoacid Dehydrogenase Complex","Alveolar Lamellar Body","Amphisome","Amphisome Membrane","Anaphase-promoting Complex","Apical Dendrite","Apical Junction Complex","Apicolateral Plasma Membrane","Astrocyte End-Foot","Astrocyte Projection","Asymmetric Synapse","Asymmetric, Glutamatergic, Excitatory Synapse","Autolysosome","Autophagosome","Autophagosome Membrane","Axon","Axonal Growth Cone","Azurophil Granule","Azurophil Granule Lumen","Azurophil Granule Membrane","BLOC-1 Complex","Basement Membrane","Basolateral Plasma Membrane","Beta-catenin-TCF Complex","Bicellular Tight Junction","Bounding Membrane of Organelle","Brush Border Membrane","CD40 Receptor Complex","CD95 Death-Inducing Signaling Complex","CMG Complex","COPI Vesicle Coat","COPI-coated Vesicle","COPI-coated Vesicle Membrane","COPII Vesicle Coat","COPII-coated ER to Golgi Transport Vesicle","Cajal Body","Calcium Channel Complex","Cardiac Myofibril","Catenin Complex","Cation Channel Complex","Cation-transporting ATPase Complex","Caveola","Cdc73/Paf1 Complex","Cell Cortex Region","Cell Projection Membrane","Cell-cell Contact Zone","Cell-cell Junction","Cell-substrate Junction","Chicken-wire-like Collagen Network","Chitosome","Chloride Channel Complex","Chromaffin Granule","Chromosome","Chylomicron","Ciliary Membrane","Cilium","Cis-Golgi Network","Cis-Golgi Network Membrane","Clathrin Adaptor Complex","Clathrin Coat","Clathrin Coat of Coated Pit","Clathrin Coat of Endocytic Vesicle","Clathrin Coat of trans-Golgi Network Vesicle","Clathrin Vesicle Coat","Clathrin-coated Endocytic Vesicle","Clathrin-coated Endocytic Vesicle Membrane","Clathrin-coated Vesicle","Clathrin-coated Vesicle Membrane","Clathrin-sculpted Gamma-Aminobutyric Acid Transport Vesicle","Clathrin-sculpted Gamma-Aminobutyric Acid Transport Vesicle Membrane","Coated Vesicle","Coated Vesicle Membrane","Collagen Type IV Trimer","Collagen Type XI Trimer","Condensed Chromosome","Condensed Chromosome, Centromeric Region","Connexin Complex","Core Mediator Complex","Cornified Envelope","Cortical Actin Cytoskeleton","Cortical Cytoskeleton","Cortical Endoplasmic Reticulum","Cul2-RING Ubiquitin Ligase Complex","Cul3-RING Ubiquitin Ligase Complex","Cul4-RING E3 Ubiquitin Ligase Complex","Cul4A-RING E3 Ubiquitin Ligase Complex","Cul4B-RING E3 Ubiquitin Ligase Complex","Cul5-RING Ubiquitin Ligase Complex","Cul7-RING Ubiquitin Ligase Complex","Cullin-RING Ubiquitin Ligase Complex","Cyclin-dependent Protein Kinase Holoenzyme Complex","Cyclin/CDK Positive Transcription Elongation Factor Complex","Cytolytic Granule","Cytoplasmic Dynein Complex","Cytoplasmic Side of Endoplasmic Reticulum Membrane","Cytoplasmic Side of Endosome Membrane","Cytoplasmic Side of Lysosomal Membrane","Cytoplasmic Side of Plasma Membrane","Cytoplasmic Side of Rough Endoplasmic Reticulum Membrane","Cytoplasmic Stress Granule","Cytoplasmic Vesicle Lumen","Cytoplasmic Vesicle Membrane","Cytoskeleton","Cytosolic Large Ribosomal Subunit","Cytosolic Small Ribosomal Subunit","Death-inducing Signaling Complex","Dendrite","Dendrite Cytoplasm","Dendrite Membrane","Dense Core Granule","Desmosome","Deuterosome","Dystroglycan Complex","EKC/KEOPS Complex","ER to Golgi Transport Vesicle Membrane","ESC/E(Z) Complex","Early Endosome","Early Endosome Membrane","Early Phagosome","Elastic Fiber","Endocytic Vesicle","Endocytic Vesicle Lumen","Endocytic Vesicle Membrane","Endodeoxyribonuclease Complex","Endolysosome","Endolysosome Lumen","Endolysosome Membrane","Endoplasmic Reticulum Lumen","Endoplasmic Reticulum Membrane","Endoplasmic Reticulum Tubular Network","Endoplasmic Reticulum Tubular Network Membrane","Endoplasmic reticulum-Golgi Intermediate Compartment Membrane","Endosomal Intralumenal Vesicle","Endosome Lumen","Endosome Membrane","Eukaryotic 43S Preinitiation Complex","Excitatory Synapse","Exocytic Vesicle","Exocytic Vesicle Membrane","External Side of Apical Plasma Membrane","Extracellular Membrane-Bounded Organelle","Extrinsic Component of Cytoplasmic Side of Plasma Membrane","FNIP-folliculin RagC/D GAP","Ficolin-1-rich Granule","Ficolin-1-rich Granule Lumen","Ficolin-1-rich Granule Membrane","Filopodium","Filopodium Membrane","Filtration Diaphragm","Flotillin Complex","Focal Adhesion","G Protein-Coupled Receptor Dimeric Complex","GABA-A Receptor Complex","GABA-ergic Synapse","GID Complex","Gap Junction","Gemini of Cajal Bodies","Germ Cell Nucleus","Glial Cell Projection","Glutamatergic Synapse","Golgi Cisterna","Golgi Lumen","Golgi Medial Cisterna","Golgi Membrane","Golgi Stack","Golgi Trans Cisterna","Golgi-associated Vesicle","Golgi-associated Vesicle Membrane","H3 Histone Acetyltransferase Complex","H4/H2A Histone Acetyltransferase Complex","HFE-transferrin Receptor Complex","Hemidesmosome","Heterotrimeric G-protein Complex","High-density Lipoprotein Particle","Histone Locus Body","Hrd1p Ubiquitin Ligase Complex","INO80-type Complex","ISWI-type Complex","Inhibitory Synapse","Ino80 Complex","Insulin-responsive Compartment","Intercalated Disc","Intermediate Filament","Intermediate Filament Cytoskeleton","Intermediate-density Lipoprotein Particle","Intracellular Cyclic Nucleotide Activated Cation Channel Complex","Intracellular Membraneless Organelle","Intracellular Organelle Lumen","Intracellular Vesicle","Ionotropic Glutamate Receptor Complex","Junctional Sarcoplasmic Reticulum Membrane","Keratin Filament","Kinetochore Microtubule","Lamellar Body","Large Ribosomal Subunit","Late Endosome","Late Endosome Lumen","Late Endosome Membrane","Lewy Body","Lipid Droplet","Low-density Lipoprotein Particle","Lumenal Side of Endoplasmic Reticulum Membrane","Lysosomal Lumen","Lysosomal Membrane","Lysosomal Proton-Transporting V-type ATPase Complex","Lysosome","Lytic Vacuole","Lytic Vacuole Membrane","MHC Class I Protein Complex","MHC Class II Protein Complex","MHC Protein Complex","MIB Complex","MICOS Complex","MLL1 Complex","MLL1/2 Complex","MLL3/4 Complex","MOZ/MORF Histone Acetyltransferase Complex","MPP7-DLG1-LIN7 Complex","MRNA Cleavage and Polyadenylation Specificity Factor Complex","Macropinosome","Male Germ Cell Nucleus","Matrix Side of Mitochondrial Inner Membrane","Meiotic Spindle","Melanosome","Melanosome Membrane","Membrane Raft","Microbody Lumen","Microbody Membrane","Microfibril","Microtubule","Microtubule Cytoskeleton","Microvillus","Microvillus Membrane","Mitochondrial Complex I Intermediate Assembly Complex","Mitochondrial Inner Membrane","Mitochondrial Intermembrane Space","Mitochondrial Matrix","Mitochondrial Membrane","Mitochondrial Outer Membrane","Mitochondrial Outer Membrane Translocase Complex","Mitochondrial Ribosome","Mitotic Spindle","Mitotic Spindle Microtubule","Mon1-Ccz1 Complex","Monoatomic Ion Channel Complex","Motile Cilium","Multivesicular Body","Multivesicular Body Lumen","Multivesicular Body Membrane","Multivesicular Body, Internal Vesicle","Muscle Myosin Complex","Myofibril","Myosin Filament","NADPH Oxidase Complex","NBAF Complex","NMDA Selective Glutamate Receptor Complex","NSL Complex","NURF Complex","NatA Complex","Neuromuscular Junction","Neuron Projection","Neuron Spine","Neuron to Neuron Synapse","Neuronal Dense Core Vesicle","Neurotransmitter Receptor Complex","Non-motile Cilium","Non-motile Cilium Membrane","NpBAF Complex","NuA4 Histone Acetyltransferase Complex","Nuclear Chromosome","Nuclear Envelope Lumen","Nuclear Inclusion Body","Nuclear Inner Membrane","Nuclear Lumen","Nuclear Membrane","Nuclear Outer Membrane","Nuclear Ribonucleoprotein Granule","Nuclear Speck","Nucleolus","Oligosaccharyltransferase Complex A","Oligosaccharyltransferase Complex B","Outer Dynein Arm","Oxoglutarate Dehydrogenase Complex","P-body","PAM Complex, Tim23 Associated Import Motor","PML Body","PRC1 Complex","PTW/PP1 Phosphatase Complex","Palmitoyltransferase Complex","Paraspeckles","Pericentric Heterochromatin","Perineuronal Net","Perisynaptic Extracellular Matrix","Peroxisomal Matrix","Peroxisomal Membrane","Peroxisome","Phagocytic Vesicle","Phagocytic Vesicle Lumen","Phagocytic Vesicle Membrane","Phagolysosome","Phosphatidylinositol 3-Kinase Complex, Class I","Phosphatidylinositol 3-Kinase Complex, Class IA","Phosphatidylinositol 3-Kinase Complex, Class III","PiP-body","Pigment Granule","Pigment Granule Membrane","Pinosome","Plasma Membrane Raft","Platelet Alpha Granule","Platelet Alpha Granule Lumen","Platelet Alpha Granule Membrane","Platelet Dense Granule","Platelet Dense Granule Lumen","Platelet Dense Granule Membrane","Platelet Dense Tubular Network","Platelet Dense Tubular Network Membrane","Podosome","Polymeric Cytoskeletal Fiber","Post-mRNA Release Spliceosomal Complex","Postsynaptic Actin Cytoskeleton","Postsynaptic Density","Postsynaptic Density Membrane","Postsynaptic Specialization Membrane","Potassium Channel Complex","Precatalytic Spliceosome","Preribosome, Large Subunit Precursor","Prespliceosome","Primary Lysosome","Protein Kinase Complex","Protein Phosphatase 4 Complex","Protein Phosphatase Type 2A Complex","Protein Serine/Threonine Phosphatase Complex","Proton-transporting V-type ATPase Complex","Proton-transporting V-type ATPase, V0 Domain","Proton-transporting V-type ATPase, V1 Domain","Pseudopodium","Pyruvate Dehydrogenase Complex","RISC-loading Complex","RNA N6-methyladenosine Methyltransferase Complex","RNA Polymerase II, Core Complex","RNA Polymerase II, Holoenzyme","Recycling Endosome","Recycling Endosome Membrane","Ribosome","Rough Endoplasmic Reticulum","Rough Endoplasmic Reticulum Membrane","SAGA Complex","SAGA-type Complex","SAM Complex","SCF Ubiquitin Ligase Complex","SUMO Ligase Complex","SWI/SNF Complex","Sarcoglycan Complex","Sarcolemma","Sarcoplasmic Reticulum","Sarcoplasmic Reticulum Lumen","Sarcoplasmic Reticulum Membrane","Schaffer Collateral - CA1 Synapse","Secondary Lysosome","Secretory Granule Lumen","Secretory Granule Membrane","Secretory Vesicle","Serine Palmitoyltransferase Complex","Serine/threonine Protein Kinase Complex","Set1C/COMPASS Complex","Signal Recognition Particle, Endoplasmic Reticulum Targeting","Slit Diaphragm","Small Ribosomal Subunit","Smc5-Smc6 Complex","Smooth Endoplasmic Reticulum","Smooth Endoplasmic Reticulum Membrane","Sodium Channel Complex","Sodium:potassium-exchanging ATPase Complex","Sorting Endosome","Specific Granule","Specific Granule Lumen","Specific Granule Membrane","Sperm Flagellum","Spherical High-Density Lipoprotein Particle","Spindle","Spindle Microtubule","Spliceosomal snRNP Complex","Spliceosomal tri-snRNP Complex","Supramolecular Fiber","Swr1 Complex","Symmetric Synapse","Synaptic Membrane","Synaptic Vesicle Membrane","T Cell Receptor Complex","THO Complex Part of Transcription Export Complex","TIM22 Mitochondrial Import Inner Membrane Insertion Complex","TIM23 Mitochondrial Import Inner Membrane Translocase Complex","TORC1 Complex","TRNA Methyltransferase Complex","Tertiary Granule","Tertiary Granule Lumen","Tertiary Granule Membrane","Tight Junction","Trans-Golgi Network","Trans-Golgi Network Membrane","Trans-Golgi Network Transport Vesicle","Transcription Factor AP-1 Complex","Transcription Factor TFIID Complex","Transcription Factor TFIIH Core Complex","Transcription Factor TFIIH Holo Complex","Transcription Factor TFIIIC Complex","Transcription Factor TFTC Complex","Transferase Complex, Transferring Phosphorus-Containing Groups","Transport Vesicle Membrane","Triglyceride-rich Plasma Lipoprotein Particle","U1 snRNP","U12-type Spliceosomal Complex","U2 snRNP","U2-type Catalytic Step 1 Spliceosome","U2-type Catalytic Step 2 Spliceosome","U2-type Precatalytic Spliceosome","U2-type Prespliceosome","U2-type Spliceosomal Complex","U4 snRNP","U4/U6 X U5 tri-snRNP Complex","U5 snRNP","U6 snRNP","U7 snRNP","Vacuolar Lumen","Vacuolar Membrane","Vacuolar Proton-Transporting V-type ATPase Complex","Vacuolar Proton-Transporting V-type ATPase, V0 Domain","Vacuolar Proton-Transporting V-type ATPase, V1 Domain","Very-low-density Lipoprotein Particle","Vesicle","Vesicle Coat","Vesicle Membrane","Voltage-gated Calcium Channel Complex","Voltage-gated Potassium Channel Complex","Voltage-gated Sodium Channel Complex","Zonula Adherens","Zymogen Granule","Zymogen Granule Membrane"],"featN":"CQAGAA4ADgAGAA8ACQAJAAsACQAKAAcACQALAAIAAgACAAcABgAFAAYABQAFAAUABAAEAAQABwAHAAMAAQACAAMAAQACAAcAFAAGAAYABAACAAIAEwAWAAoAEAAMAAsADQANAAsACgAKAAwACgAKAAkABAAFAA8ACAAJAAoADwAJABgADwAOABMAEgATABAADAALAAwADgADAAgADgASAA0AEwAPABEAGAApACQAEwAOABAAGQATABIAEgASACQAIAAvABEAGQATAA8ACAAQADcAIgAdABUAHgAqACAAJQAiAB4ALQAtACgAIQApADMAGwAzADQAMgANAAgAFAANAAsACgAIAAoACQAMABAADgANAAgADgAPABAADwAPAAIADQAKAAwACwAMAAkABwAFAAYACAAGAAcAAwAFAAMAAwADAA0ADgAQABAAFQAWAAIABAAEABYAHAAhABwADgAMAAgADQAEAAMAFwAQABQAFAABAAIACAADAAMAAgABAAEAAQAIAAwACgAIAAcAEAALAA4ADQAJAAsABgAHAAYACgAVABMADAARAAwAEQATAAYADQAMAAYABwAFAAcAAwADAAEAAgADAAQACAAGAAUACQARAA0ACQAVAAoAEAAQABMAIgADAAQADQATAAwACgAHAAUADAAHAA4AEwAXAAoAEAAFAAkABQAGAAAAAAACAAQAAwABAAMAAgADAAUAAwADAAQABAAEAAEABgAJAAgACwADAAEABQAHAAoACAAHAAYACwADAB0ADgAbAB0AEQARAA4AAgAHAAsAGwASAAYACwAIAA0ACAATABwAEQAKAAMABQAQAAYAAwAFAAUABAAEAAsADQAEAAQABQAJAA8ACgARAA0ABgAGAAkAEAALAAoAAgAFABcAEwATAAkACgAGAAYABQAFAA8ADAAGAAgABgAFAAgABgAHABAAAQAHAAUACQADABMAFwAFAAsABwAFAAMACgANAAkABAAMAAoAFwARAAoACgAaAA0ADAAJAAkACAAIAAsABQAEAAEAAQAAAAAA","featI":"cQCTAM0A2gDnAP0AAAEzAX0BEAA5AEEAqADOAP8AQgB2AHoAewCpANUA/QD/AAABAwEkASkBagGCAUIAegB7AKkAzQDVAP0A/wAAAQMBJAEpAWoBggH9AAABDQEOAQ8BkgECAE0AUQBnAGgAaQBuAHQAzgD9AP8AAAGhAaIBwgFnAGoAbADOAPUA/QD/ADgBOgEJABMAzgDfAP8AYQFjAbwBvgEJABMAdwCiAKMAzgD9AAABAQFjAXoBCQATACIAzgD0AP4A/wAAAWMBCQATAHkAzQDOAP0A/wAAAWMBoQEJABMAzgD9AP8AAAFjAQkAEwDOAP0A/wAAAQMBLQFjAWcAoAC/AM4A+AD5AP0A/wAAAVABXAH9AAAB/QAAAf0AAAGtAL4AzgD9AP8AAAGeAc4A/QD/AAABXAFeAc4A/QD/AAABAwHOAPwA/QD/AAABAwHOAP0A/gD/AAABXADOAP0A/wAAAaoAzgD9AP8AAAHOAP0A/wAAAc4A/QD/AAABzgD9AP8AAAEgAK0AzgD9AP8AAAEDAc4A/QD/AAABAwE6AWoBGQArAKAB9wAoAK0AkgAhASUBkgCSAM4AkgCtAM4A7ABHAUgBegEkACUAfACMAJIAogC0AMAAzgA8AUcBSAFaAXoBiQGKAZ0BngGfAboBKABrAIoA9wAxAZIBawCKAJIA9wB2AZIBigDZAPcAkgGKAJIBigCSASgALAA1AEIAWQCKAJIAlgCpALQAzgD3ADcBRwFIAXoBiQGSAboBKABCAEMAWwBcAIoAkgCjAKUAqQC0AM4A9wAWATcBRwFIAUkBSgFLAXoBkgEoAEMAWwBxAHYAigCSAJMAzgCSASgAQwBbAFwAigCPAJIAnwCjALQAzgDdAPcARwGSAboBKABDAFsAXACKAJIAnwDOAN0A9wCSAboBKABDAFsAXACKAJIAkwDOAPcAkgGeASgAQwBbAFwAigCSAJMAvADOAN0A9wAfAZIBKABDAFsAXABmAIoAkACSAJMAvgDOAPcAkgEoAEMAWwBcAIoAkgC+AM4A9wBHAZIBKABDAFsAXACKAJIAzgD3ABYBkgEoAEMAWwBcAGYAigCSAM4A9wCSARMAKABDAFsAXABmAIoAkgDOAPcALQGSASgAXACKAJIAzgD4AAQBjgGPAZIBKABTAFQAigCSAJgAtADOAHoBkgEoACwAigCSALQAtgDOAPcAkgGKAJIAzgCSASgAigCSAM4AkgEoACwAYACBAIoAkgCfALYAuADdAAYBNgE3AZIBugEkACUAkgDOAN0A4AB6AboBKAAsAJIAtgDOAN0A4QCKAboBKAAsAIMAkgCTALYA3QDhABYBugEoADIANQBZAIoAkgCWALQAzgDdAOAAkgG6AccByAEoAIsAkgC0AM4A3QBHAUgBugEoAIoAkgCiAKMAtADOANsA3QDgAOEA9AD3ADYBNwFHAUgBegGKAZIBngGsAboBvwEoAEMAWwCKAJIAnwC0ALYAzgDdAOAA4QD3AJIBugEoAIoAkgC0ALYAzgDdAOAA4QD3AJIBpgGnAboBKAAsAIgAigCSAJMAtAC2AM4A3QDgAPcAIQFHAUgBegGJAZIBugEkACUAKACKAJIAmAC0AM4A3QDgAOEA9wAhAUcBSAF6AZIBugEkACUAKACKAJIAnwC0ALYAzgDdAOAA4QD3ADYBNwFIAXoBkgG6ASgAigCSALQAzgDdAOAA4QD3ADYBNwFHAUgBegGSAboBKAAsAIoAkgC0ALYAwgDOAN0A4ADhALoBKACSAKwAtADCAM4A3QDgAOEAIQG6ASgALACSALQAtgDOAN0AegGJAYoBngG6ASgAigCSALQAzgDdAOAA4QB6AYkBigGSAZ4BugGHAIgAmQAgACIAeAB9AIcA1gAXAcIBIgBkAHgAfQCHAIgAmQC+AOMA5QAWARcBaAFpASwAVQB4AIcAiQCZAKkAsgC5AM8A7gA7AT8BQAFFAaMBwAHCASkALABCAHgAeQCTAJkAqQC2ANwA+QBpAXsBDAANABAALABCAEoAYgBjAHIAeAB5AIcAiwCZAKkAxwAPAWgBaQEsADgAcgB4AHkAhwCZAMkA0gANAQ4BDwFoAWkBogEPADwAfQCZAJsAxQDWAOAA4QDyAPQAFwE/AUABQwFGAX4BEABBAEoAVQCHAJwAnQC3ALkAxwDZAOwA8gAXAUMBSQFmAWcBaAFpAXwBlgGgAaMBEAAgACEAIgAkACYAJwA5AEIAUwBUAFYAVwBYAHkAfQCHAI0AnACdAKkAzQDWANgA3gDgABcBOwE9AVYBWgFoAXsBiQGLAZYBnQGfAaEBwAHEASAAIQAkACcAUwBUAFUAVgBXAFgAWQB4AI0AnQCyANYA2ADeABABFwE7AT0BRwFaAWgBaQF7AYkBlgGdAZ8BoQGiAasBuwHAASIAUwBUAFYAVwBYAH0AgACNAJsAnACdABcBVgF8AZYBqwHAAcQBIgA9AFMAVABWAGcAgACNAJwAnQAXASgBfAGWAXgAmQCmAKgA3gDgAOIAFQExATsBPQFfAWEBuwG8Ab4BIAAhACwAeACNAJkAnQChAKIApADeAN8A4ADiADsBPQFfAWABYQF7AZ0BuwG8Ab0BvgEsAHgAjQCZAKQA3gDfAOAA4gA7AT0BSAFfAWABYQG7AbwBvQG+ASYAKQAvAHwAlwCZANYA3gDgAOIAAQEJAQwBewGJAYsBnQHAASYAKQAvAHwAlwCZANYA3gDgAOIAAQEJAQwBewGJAYsBnQHAASYAKQAvAHwAlwCZANYA3gDgAOIAAQEJAQwBewGJAYsBnQHAARUAFgAgACEAJAAmACwANAA8AEIAdAB4AH0AfgCFAIcAiACLAI0AmQCfAKkA0wDWANgA3gDgAOIA9AAJAQsBRgGPAbsBwAHBARUAFgBGAE4AUwBUAFUAVgBxAHgAhQCHAIsAjQCTAJkAnwChANMA1gDYAN4A4ADhAOIA9AAFAQkBCwGPAcABwQECAAMAEQAVABYAIAAhACQAJgA0AE0ATgBPAFAAUQBSAFMAVABVAFYAWQB0AHgAhQCHAIsAjQCPAJEAmQDTANYA2ADeAOAA4gAFAQkBCwEyATwBWgGPAZwBuwHAAcEBLQA/AFMAVABWAHEAeACHAI0AkwDPAPQADAFKAUwBewHAASQAJgAsAFMAVABWAHgAgACNAJMAlwCYAJkAzgDWANgA3gDgAOIACQELAQwBSgFMAXsBBwAsAEIAUwBUAFYAeACLAI0AkwCXAJ8AqQAJAQwBRwFJAXsBwAESACwAcQB4AIcAjQCUAJkApQDfAGABewGXAb0BwAEgACEALACLALYAaAFpAbsBKQAsAJMAnQC2ANYA3QDeAOIAewGWAaEBogGrAccByAEIACAAIQAkACYAJwAsADUAUwBUAFYAWQBaAGQAcACFAI0AkwCUAJYAmQCdALAAtgC3ANYA2ADeAOAA4gDvAAABAQEHATsBPQFWAVoBYQFoAWkBewGJAYsBlgGdAZ8BoQGiAasBuwG8Ab4BwAHEASAAIQAkACYALAA1AFQAWQBaAIUAjQCTAJYAnQC2AN4AAAEBATMBOwE9AVoBaAF7AX0BiQGLAZYBnQGfAaEBqwG7AcABCAAsADUAPwBFAEkAUwBUAFYAWgCFAIsAjQCTALYA3ADeAOIA4wDkAOUABwEWARsBHQE7AT0BaQGrASwANQBaAGQAhQCHAIgAjQCSAJMAmQC2ANYA3ADjAOUAOwE9AWgBaQGrASIALAA1AEAAUwBUAFoAgwCFAIcAiACNAJIAkwCZALUAtgDYANwA4wDkAOUAOwE9AVQBVQFoAWkBlAGrASwANQBTAFQAVgBaAF4AeACFAIcAiACLAI0AjwCTAJgAmQCkALUAtgC9ANYA2ADcAN4A4ADhAOIA4wDkAOUAGQE7AT0BaAFpAXsBhwGUAaEBogGrASwANQBJAFMAVABWAFoAhQCHAIgAiwCNAJIAkwCZALUAtgDWANgA3ADeAOAA4gDjAOQA5QA7AT0BaAFpAaIBqwELACwANQA6AD8ASQBKAFMAVABWAFoAeACFAIcAiACLAI0AkwCZALYA1gDYANwA3gDgAOIA4wDkAOUACAE7AT0BaAFpAYYBogGrARQALAA1AFMAVABWAFoAeACFAIcAiACLAI0AkwCZALYA1ADXANgA3ADgAOMA5ADlAAoBOwE9AWgBaQGJAYoBnQGrAboBIgAjACoALAA1AEkAUwBUAFYAWgBvAHgAhQCIAIsAjQCTAJkAtgDYANwA4wDkAOUAFwE7AT0BaQGrAboBIAAhACIAIwAsAEwAUwBUAFUAVgBXAFgAcgB4AH0AhwCIAIkAiwCNAJkAnACdAJ8AtgC3ALkAxwDWAOEA8gAXATsBPQFDAWgBaQF7AXwBlgGhAaIBowGrAcABHwAsAEIASgBMAFUAYgBjAHIAeACDAIcAiACJAIsAmQCcAJ0AqQC2ALcAuQDHANYA4QDyAPYAOQE6ATsBQwFHAUgBYgFoAWkBcwF7AXwBlgGhAaIBowHAAcIBLABCAEQAVQByAHgAfQCHAIgAiQCLAJkAnACpALYAuQDHANYA2ADgAOEA8gDzAAkBCwEXATsBQwFEAWgBaQF6AXsBfAGJAYoBoQGiAaMBwAEsAFUAcgB4AIcAiACJAIsAmQCcAJ0AtgC3ALkAxwDWANgA8gAJAQsBOwFDAUoBTAFoAWkBewF8AZYBoQGiAaMBwAEfACAAIQAsAEQASgBVAHIAeACHAIgAiQCLAJkAnACdALYAtwC5AMcA1gDZAOAA8gDzAAkBHAE7AUMBRAFoAWkBewF8AZYBoQGiAaMBuwHAAcIBHwAgACEAJAAmACcAKQAsAEIAUwBUAFYAYgBjAG8AcwB4AIcAiACLAI0AmQChAKIApACoAKkAuQDWANgA3gDfAOAA4QDiAPQAOwE9AV8BYAFhAXsBiQGLAZsBnQGfAbsBvAG9Ab4BJAAmACcAKQAsAFMAVABWAFcAWABZAIcAjQCdAN4A4ADiABcBPQFaAWgBewGJAYsBlgGiAcABDQAgACEAJAAmACwANQBCAFMAVABVAFYAWQBaAG8AeACFAIcAiACLAI0AlgCZAJ0ApACpALYA1gDYANoA3gDgAOEA4gAJATsBPQFHAVoBaAFpAXsBiQGLAZYBnQGhAaIBqwG7AcABHwAgACEAJAAmACcAKQAsADUAUwBUAFUAVgBXAFgAWQBaAGQAeACFAIcAjQCTAJQAlgCZAJ0AsgC2ANYA2ADeAOAA4QDiADsBPQFaAWgBaQF7AYkBiwGWAZ0BnwGhAaIBqwG7AcABwgEgACEAJAAmACcALAA1AFMAVABVAFYAVwBYAFkAWgB4AIUAjQCTAJYAmQCdALYA1gDYAN4A4ADhAOIAFwE7AT0BVgFaAWgBaQF7AYkBiwGWAZ0BnwGhAaIBqwG7AcABxAHHAcgBJAAmACwAeACHAIgAmQCiAKQA3gDgAOIAewEsAHgAhwCIAJkA4ADhAMABLABKAFUAcgB4AIQAhwCIAIsAmQDNANoAOwE+AU0BTgFoAWkBwAHCARAALABBAEIAeACHAIsAmQCcAKkAFQFoAWkBLABCAHgAhwCZAKkAEAE7AWgBaQF7AVcAWABfAJMAlACdAK4A2gB7AZYBVwBYAJMAnQDaAAABlgGfAeYA5wD2AAABAQECATkBOgFCAW8BBwAsAJMAtgDCAPYAOQE6AYsBLABxAJMA9gD9AAABIwE5AWsBewGLAaEBJgApAHEAjQCTAJQAlwDeAAkBCwEMARkBPQFgAXsBvQFTAFQAVgBxAJMAlACVAJcA3gDgAOEA4gAMAXsBUwBUAFYAkwDeAOAA4gD8AP0AAAFoAXsBoQFTAFQAVgCDAI0AkwBMAXMBAgADACwATQBPAFAAUQBTAFQAVgCNAJMAAQGrASwANQBaAGQAhQCNAJMAlgC2AAABAQE6AWABqwG9ASwANQBUAIMAjQCTALYA3ADeAOQA5QD9AAABFgFzAYYBLAAyADUASABZAJIAlgC0ALYAuQDOAHsBjQHHAcgBHgCDAJMAmwCsALYAxQAWARsBJQEmAVQBVQGUAZUBkwDFASwAcQCTAJcA3gDiAAQBBQEMAUwBewGPAasBNAA1AFoAhQCTAN4A4ADiAKsBwQEsADQANQBvAHgAhQCTALYA8AAlAS8BqwEUACwAWgBkAIUAkwC2ACUBJgF1AasBLAA1AIgAjQCTALYAwgDcAOUAOwE9AYYBKAAsAJMAtgDQANwAEgEbAXYBLACSAJMAtgDcAOMA5QAIACwAswC2AAcBFAAsAJMAtgDcAAcBCAAsAIMAkwC2ANwA5QAHAQgALACTALYA3AAHASwAkwCzALUAtgC3ALgALACTAAEBLACTALYASQHFASwAkwC2ACwAkwC2ACwAkwC2AAcALAA7AG8AgwCIAJMAlQC2AN4A9ABzAYcBFAAsAEUAZACTAJQAtgDCANwA3gDgAOIABwEWAQgAFAAsAEUAeACDAJMAtgC6ANwA3gDgAOIA4wDlAAcBCAA7AEAAgwCTAKsAtgDcAN4A4wAHARYBKgErAXQBhwEIACwANQBTAFoAgwCFAIsAjQCTALYA3ADeAOQA5QAHARYBFwEbAXMBqwEIACwANQA7AFQAWgCDAIUAjQCTALYA3ADeAOIA5ADlAAcBFgFzAXQBhwGrAagBqgEIAOMA5QBpAZIAnwC2AMABFAAoACwANQBKAFoAhQCHAIgAjQC2AM4A1ADcAOMA5QA7AT0BaAFpAZ0BqwEIABIAFAAsADUAUwBUAFYAWgCFAI0AkwCWALYAvgDCANwA5ADlAAcBFgEXATsBPQFWAYYBqwHEAQgAJAAmACwANQBaAHgAhQCNAJIAkwC2ALgAwADWANgA2gDbANwA3QDeAOAA4gDjAOQA5QAHAXsBjQGrAawBvwHAAQgALAA1AFMAVABWAFoAhQCNAJIAkwC2AL0A1gDYANwA3gDiAOMA5ADlAAcBPQFpAY0BnQGfAasBLABTAFQAVgBaAIUAkwC5ALoA2ADeAOAA4gCiAVMAVABWAI0AkwCUAJUAmQDYAAkBJQFMASwAMQAzAHQAoAC2AL8AwQEdAB4AJgAsAIsAkwCbAKwAtgDFABYBJQGUASwAkwC2ANwALACTALYAGwAcACwAOwA/AJMAlACVAJcAmQCfAKQAsQC2AN0A3gDgAOIADAEZAR0BewGHASwAPwBJAEoAhwCIAJMAmQC2APgA+QAEAQUBUAGhAaoBCAAsAEQAcQB4AJMAmQC2AMIA3ADeAOAA4gDyAPMABwEmAUQBVQF7AQgALAB4AIcAiACLAI0AkgCTAJkAswC0ALUAtgC4AN4AAgEHARYBoQEnAM4AFgEsAIMAkwCUAJUAtgD8AHMBLACTALYAkwCUACUBkwDCAJMAkwCTAJMA/gA8AUwBegGJAYoBmQFUAGQAkwCUAKUAzQD5ACMBJQEmASsBjgEZACsALACTAJQAIwElASYBewGgASYAkwCUAJUA/AB7AYkBiwEsAHEAkwCUAJUAtgBpAQwAFAApAEUAeQCHAIgAkwCZAKgA3gDgAOIABwFfAXsBCABFAJMA1gDcAN4A4ADiAAcBewGJAQgAFAA6AEUAkwC6AMIA3ADeAOAA4gAHARsBiQEpAD8ARQCTAJ4A1gDeAOAA4gAHAUoBTAF7ASkALABFAIMAkwDeAOAA4gAHASwARQCTAN4A4ADiAAcBVgGGAcQBxQFkAJMA3gDiACUBJgEGAJMAwgDeAOAA4gDyAAYAZACTAN4A4ADiAAYABwBkAH8AkwCUAN4A4gBWAcQBBgAHAAgAFAA6AEUAZACTAN4A4ADiAAcBRwFJAU0BTgFWAXUBdwF7AcQBBgAHAAgAFAB/AIQAkwCrAMIA3gDgAOIABwEcAR0BVQFWAZUBxAEGAAcACAAUACwAZACTAMIA3gDgAOIABwEGAAcACAAPABQAOgBkAJMAzADeAOAA4gAHARcBHQFWAcQBBgAHAAgAFACTAL0A3gDiAAcBVgGGAcQBCAA6AH0AfwCTAKsArAC6AMwABwEWARcBRgFVAVYBlQHEAQgALAA1ADoASQBxAH8AkwCrAKwAugDCANwA3gDiAAcBFgEXAR0BQACTAMgAFwGGAcUBCACNAJMAugDcAAcBFwEbAR0BRgGEAYYBxQEIACIAkwCvALkAugABAQcBFwGEAYYBxQFFAF8AkwCuADMBfQFlAGoAbACTACoBKwEwAZIAkwAlASoBKwEIACwAXQCTAAEBcQGDASwAhwCTAJMAwgCEAZMACACTAAgAkwAHAQgAkwDcAAcBQgCSAJkAqQAXARgBaAFpAQoACwAXAEIAqQB7AUIAhwCpAN4AewEJABMAQgB5AKkAzQA/AUABYwEiACwAOQA8AEEAQgBqAHQAeAB9AJkAoACpAPQAFwFGAVsBIgA8AEIAfQCHAKkA9AAXAT8BQAFGAVsBeAEPADwAQgCpAPQAPwFAAUYBWwEMAA0APABBAEIAdAB5AKcAqACpALIA7gD0AD8BQAFFAUYBTwGBAcABxgEMAEIAeQCpAM8A9AASAT8BQAFPAQwAIgApAEIAeAB5AIcAqQDPAO4A9AA/AUABRQFbAZIBEQAiAEIAfQCHAIwAogCjAKkAzgAXASIBJwEoAVsBwAEMAB0AIgAnAEIAVwBYAHMAeQB9AJ0AqQCyAPQAFwFTAXQBlgHAAQIAAwAEAAwAIgBNAE4ATwBQAFEAUgBTAFQAVQBWAHQAeQCLAI8AkQClAKYAyQDKANYA3gDhAPgA+QAOARYBFwFQAXQBDAB5ABYBDAB5AM0A+QAMAA0ADgApAEEAQgCpAM8A9AD6AFABiAHAAQwADQAiAEIAeQB7AIEAqQC+AMkAygDNANIABQEXAU8BUAF0AYIBDAANAFUAeQDJAMoA+AD5AFABcAGPAcABDAANADgAeQANAQ4BDwFOAVABkgEMAA0AQgB5AKkAFwFQAQwADQBnAHkAUAEAAIIAxwD4APkABAEXARgBUAFdAV4BjgEMAN4A4ADiAFIBmAG7ASIATwB4AH0AhwCIAJkAnQDeAOAA4gAWARcBlgEiAD0AVwBYAIAAnACdAN4A3wDgAOIAFwFfAWEBfAGWAbsBvAG+AQEADAANAA4AGAAiADcAOgBKAFMAeAB5AH0AjgCQAJkAxwDRAPoACAEXARoBjAE3ADoAfQD0APgA+gAXAY4BjwHAAQwALAA3ADoAeAB9AI0AkACTAJkA9AAXAVYBhAHAAcQBIgBtAMoAFwF+AQ4AIgB9AI8AkACYAPoAFwFbASIAfQDHABcBawEiACwAeAB9AJkAFwGWAC4BLgBEAPMARAEEAC4ArQAlAScAMAGoAScAcwAnAHMAoQAFAVsBhQGqAcABcQAEAaoBBAEFAY8BPgB0AKAAvwA+AEoAvgAyAQgABwEXAYABgAEgACEApQD0AEYBuwEgACEAYgBjALsA6wAXAT4BeQEgACEAYgBjALsA6wA+AXkBIgAxADMAjgCyAPUAFwEYATgBlgHBAWoAawCWAZYBnQAIARYBFwGWASEArQBhAZYBuwG8Ab4BIQCdAK0AFgEXAWEBlgG7AbwBvgF0AJ0AsgDNANoAlgGhAcABeACTAJ0AVgF7AZYBxAEsAJMAtgACAaEBogEsAIcAiACTALYA3QDgACUBJgFwAboB3gDgAOIACAAsADIAMwA1ADsASwBZAFoAcQB4AJMAlgCZAJ8AtgC5ALoA3ADeAOAA4gD9AAABBwEWAXQBewGHAQgADwAUACwANQBFAHgAkwCeAN4A4gD0AAcBRgEGAAcAKQAsADwAPwBFAEkASgB0AHgAfQCLAI0AkwCgAL8A3gDgAOIABwEXARwBHQFGAYYBxQEVABYAIAAhACgALgBcAHQAdwB5AIoAkgCiAKMAzQDOANMA1gDYAN4A4ADiAAkBCwFrAXoBjwGSAbsBCQATACIAdwCSAM4A3QDeAOAA4QDiAPQA/wABARcBYwG6ASIAQgB9AIsAjACPAJAAkgCYAKIAowCpAM4A3QD6ABcBugEOABgAIgB9AIcAkACSAJgAmQDOAPoAFwFbAZ0BzgD/AEYAkgCZALUAuADOAMABQQBfAJMALwF7AYkBiwGaAZ0BnwGrAQwADQAOAEIAeAB5AI0AkwCiAKQApQCpAM0A8AAAAQEBEAEvATsBPQE+AVABcAF5AXsBnQHAATcAOgBCAEYAkwCpALIA0QAXATABNgE3AXUBdwF4AXsBwAHCATcAQgClAKkAMgHDAQ4APwBCAKUApwCpAL0A+gD7AHsBgQFCAIoAqQD3AEcBSAGIAZIBHQAoAH0AigD0APcAFgEXASEBRgFTAZIBlQEoAF8AigCuAPcA+AD5AJIBDgAoACwAOQBCAEMAWwCDAJIAkwClAKkAtAC2AM4A9AAWAXMBdAEMABAAKAA5AEEAQgBDAFsAXABiAGMAeQCKAJAAkgCYAKkAvgDKAM4A7QD3ACoBKwFRAWIBkgGxARAAKAA5AEAAQQBCAGYAgQCKAKkAsgC+AMgA9wAQATIBkgEQADkAQQBCAJ8AqQCyAL4AIwEyAQ4AfQAXAX0AtAAPARcBkgEMAA0AOABiAGMAeQDHAA0BDgEPAU4BYgFoAXUBdwGSAWcAaQBsAA0BDwGSAQ0BDwGSARAAKgA5AGcArQBlAGgAawCGAcUBZwBpAGwAjQFnAGgAaQBsAGUAZgBnAGgAaQBqAGsAbADZAHABpAEXAGUAZwBoAGkAagBrAGwAoAC/AMsA2wBwASQAJQBLAEwAYQCBAKQAuwFhAHcAiAB6AYUBYQCBALQAzgB6AYkBigGdAZ4BJAAlAGEAdwCBAMkAygDgAOEARwFIAVABegGKAboBJAAlAGEAdwCBAKIApADKAHoBnQEQACQAJQBBAEIAYQB5AKkAuQDNAOEAbQFuAXoBowGpAboBDAAQABkAGgApACsAQQBVAHkA7ABkAaABowEMAA4AGQClAM0ATwEMAA4ANwA6AEYAkAAMAA0AIwB5ALsA6wBBAVABhQEMAA0AJAAlAGcAaQBsAHkApQC8APgA+QAfAVABlgG6AQwADQAiAHkApQC8ABcBHwFQAWEBvgEMAA0AHQAnAEoAeQDRAAgBHAFTAQwAeQAMABMAeQCQAC0BJQBIAHcAiwCMAJIAwADDAMYAyQDKAM4A0gDbACABRwFIAVABdAF6AY0BrAG/AScALABKAHMAeAB5AJkAyQDKANIA+QAEAQUBHAFQAY4BjwGhAaIBIgA4AEAAQQB5AJwAyADJAMoAzQDSAA0BDgEPAUMBUAF0AXwBkgFHAMkAygDNANIA+AD5ADIBUAEnAHkAyQDKAM0A0gAEAQUBUAGPASIAeQDJAMoA0gBQAXkAyQDKAM0A0gBQAXkAyQDKAM0A0gCHAPkAUAFdAV4BZwBoAGkAbABtAHkAowDxAPgA+QBQAV0BXgF+AY4BZwBpAGwAeQD1APYA+AD5ADgBOQE6AVABZwCgAL8A+AD5AFABZwB0AKAAqgC/APgA+QBQAdMA+AD5AFABjgGPATAAagD4APkAUAEjAG0AdwCiAKMAzgB6AX4BbQB5APgA+QBwAX4BbQD5AH4BpgGnAagBqgEkADQANQB2AIUAiwDNAPkAOwFaAYkBjgGtAcABwQHCAXYAYAC5AAsBZgFnAZUBowFnAW0BbgGlAakB6ADpAD8BQAFJAWcBbgGlAakBNgDBAF0BNgCvACcBKAFXAVkBkAGRAa0BrgGvAbEBsgGzAbQBtQG2AbcBuQE2AK8AJwEoAS4BUQFXAVkBkAGRAa0BrgGvAbABsQGyAbMBtAG1AbYBtwG4AbkBPQBUAGcAgAAoAT0AbgDoAOkAJwEoATEBWwFnAX4BfwGdACcBKAGWAaMBsAG0AWwAJwEoAV0BXgEnASgBZQF4AJkAuwC8AMMA6wAfASABQQGTAbwAwwDGAOgA6QARARMBHgEfASABUgFyAZMBvADDAMYA6ADpAB8BIAFMAXIBFwBhAGwA8QAXAGwAyQDNAAQBFQEkASUBKQFdAV4BjgEXAFUAbAC5AM0A9gAwATkBjgGjAR0AKABCAHEAdQB3AHoAewCKAKIAowCpAM0A1QAWASQBKQFTAWoBbAF6AYIBkgEdAEIARwBxAHUAegB7AKkAzQDVACQBKQFTAVgBagFsAYIBOwB6ANUA6ADpACQBKQGHAZsBqAHNAOgA6QDqABEBHgEkASkBcgF/AQUAKgDDAMQAxgDNAOgA6QDqAAQBEQEUAR4BIAEiASQBKQEuAW0BbgFyAX8BgAGOAZMBqQEOACkAiwCNAM0AJAEpAUcBSAF6AYkBigGeAXYAmgDJAMoAzQAkAScBKAEpATQBUAGQAc0AJAEnASgBKQFtAW4BqQGuAXoAzQDVACQBJwEoASkBMAGoAUcAzQAgASQBKQEsATABNQEJAGwAzQAUASEBJAEpAWMBSgCsAMoAzQAIASQBJQEmASkBLgF1AUoAzQAIASQBKQGEAM0AJAEpAYYAhgA=","tree":{"ab":"vwDAAL4AiQG9AIoBugC7ALwAiwGMAY0BuQCOAbgAjwEZABoAGACRAQ8AEAAOAJMBAgADABMAFAAXAJIBCwAMABYAlwEVAJkBlgGaAQoAmAESAJsBGwAcAJ0BngEJAJwBEQCfAQgAoAGUAaEBBwCiAQ0AowGkAaUBBgCmAQUApwEEAKgBlQGpAQEAqgEAAKsBKAApADQANQA5ADoAMwCuAUYARwAtAC4AMgCwAS8AMABCAEMAMQCzAUUAsQG0AbYBSABJAEoASwA9AD4AsgG4AUQAtwG1Ab0BLAC8ATgArwEhACIAJQAmACcArQFBAL4BKgArALkBugE3AMABxAHGATYAxwFAAMgBPwDKAb8ByQHCAcMBuwHLATwAzgHFAcwBIADBATsAzwHQAdIBIwAkAM0B0wHUAdUB0QHWAR8A1wEeANgBHQDZAZ8AoACeANsBmQCaAKUApgCYAN0BnQDcAaIAowCXAN8BnADgAZYA4gGbAOMB5AHlAZIAkwCkAN4B4QHoAZUA5gGRAOcBlADqAaEA6QHsAe0B6wHuAZAA7wGPAPABjgDxAY0A8gGBAIIAhwCIAIQAhQCJAIoAiwCMAIYA9QH3AfgBgwD2AfkB+gH7AfwB9AH9AeIA4wDNAM4A4QD/AccAyADKAMsA0wDUANIABALRAAUC2ADZANAABgLMAAACyQADAs8ACALVANYAAgIKAuAAAQLGAA0C2wDcAMIAwwAJAgsC1wAHAg8CEgLdAN4AxADFAN8ADgIVAhcCDAITAhECFgIUAhkCEAIYAtoAHAIbAh0CGgIeAsEAHwJuAG8AbQAhAnAAcQBrAGwAaABpACICIwIkAiYCagAnAiUCKAJnACkCZgAqAmUAKwKyALMArACtAKsALgKqAC8CtgC3AK4ArwCxAC0CtQAxArAAMwK0ADQCMAIyAjUCNgI3AjgCqQA5AqgAOgKnADsCegB7AHkAPQJ1AHYAdAA/AnMAQAJyAEECfwCAAHgAPgJ8AH0AdwBEAn4AQwJCAkYCRQJHAkgCSQJdAF4AXABLAloAWwBVAFYAVwBYAFkATQJgAGEAXwBRAlEAUgBjAGQAYgBUAk0ATgBQAFMCTgJPAlICVQJMAlkCTABWAk8AVwJUAFgCUAJaAlsCXAJdAl4CUwBgAl8CYQLpAOoA9wD4AOwA7QDxAPIA5QDmAAIBAwHoAGMC9gBkAusAZQL+AP8AaQJrAvsA/AD1AGoCAQFoAvQAbwLnAG0C/QBsAgABcALzAHEC7gDvAGYCdQLkAGcC+gBuAnICdgJzAnQCeAJ6AvAAdwJ8An0CeQJ7AvkAfwJ+AoACBAEFAYECggKFAYYBFQEWAVgBWQFqAWsBXQFeARsBHAELAQwBVwGGAncBeAE+AT8BcgFzAVYBiwKDAYQBOgE7AUABQQE1ATYBVQGPAmcBaAFQAVEBRgFHAX4BfwF6AXsBXwFgAYIBkAJNAU4BWwFcAScBKAFvAXABGAEZATcBOAGIApoCfQGYAmIBYwGNApICVAGUAoEBmwJxAY4CgAGnAlMBpgISARMBIwEkATQBkwIxATIBRQGXAqMCqQIaAYkCnQKiAm4BnwIKAYoCdQF2AUwBnAIuAS8BHwEgAVoBsgJKAUsBDgEPATABrgJEAa8CeQGZAiIBrAImAZ4CTwGWAkMBvQI5AZECfAGwAgcBCAFhAaQCFAGFArYCwQK+AsQCdAG1AkgBSQEdAR4BMwGtAm0BswINAbsCEAERAT0BpQJSAaoCsQLMAowCyQItAbcCoALTAiwB1QIpASoBbAHOAiEBvwK8As0CoQLDArkCxgK6AsgCwALYAhcB1gKHAtkCygLUAmYBlQK4AtoCJQHfAssC3gLXAtsCPAHRAtIC3QJkAWUBQgHCAuYC6QLcAugCKwHnAuUC7gJpAeECxwLgAqgC4gLkAu8C6wLsAvAC8gLjAvUC7QL0AqsC8QLzAvcC6gL2AvkC+gL4AvsC0AL8As8C/QK0Av4CCQH/AsUCAAMGAQEDhwGIAYQCAwMCAwQDLAJKAvMBPAJiAgYDkAEgAgcDCQP+AQoDCAMLA6wB2gGDAgUDDAMOAw0DDwM=","h":"AABGWGBujIwAAAAAFhshJCYpNTpBSEhOUV9kZ3J0f4GEh4uMABccIiMjKCgpKisvMjU6OzxARUZGRkZIS0tNTlRXV1hZXGBiY2RobHR4foSGjAAAJjU4Pk1TU11gY2RlbG1xdHZ7gYaHiYxMV2hrc3d8fYKKjCY5P0JGSEpOUFRbW1tdXmFkZWtrbm9ycnN3e3+DhIaHi4wkNj4/REVLU3KCh4wjSFtjamttc3R1d3t+g4iMJDo8Q05RVVxmbHp/gowAAC5KS1BRU2BkZmpxc3Z9f4CDhIWJjIw8Rk5UWFhZXV1iZmZnaGpsbm5vb3J0dHR3en2AgYOEjIwAEBcYIyovMjg4PERGRkZRU1RUVlZWWFtbW1teXl5fYGJkZmZmZ2lpamtrbGxsbW1tbW1ubm9wcHBxcnJzc3R0dXV2dnZ2d3d3d3h4eHl5enp6e3t7e3x9fX5+fn+AgYGBgYKCgoKDhIWGh4eIiIiJiYmKioqKiouLi4uMjIyMjIyMnra9yc/Z5fP5/f8=","cut":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQE="}};

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
      <p data-at="4">${F.seeds} genes cause one rare disease of the junction between nerve and muscle. How many mechanisms hide behind them?</p>
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
        <p data-at="1.2" data-out="8.5" style="grid-area:1/1">Which human proteins bind each other makes a network: ${fmt(F.genes)} proteins, ${fmt(F.links)} links. The ${F.seeds} CMS genes are its seeds.</p>
        <p data-at="9" class="amber" style="grid-area:1/1">Do the seeds share mechanisms? Endotypes are subtypes of a disease defined by its molecules: groups of disease genes that hang together, in the network and in what they do.</p>
      </div>
      <p data-at="17">First, one group or several? Give each seed a neighbourhood of its k closest proteins. Seeds whose neighbourhoods meet form a group.</p>
      <div class="facts">${ks.map((k, j) => `<div data-at="${[19, 23, 25, 28][j]}"><b>${F.groupsAt(k)}</b><small>${F.groupsAt(k) === 1 ? 'group' : 'groups'} at k = ${k}</small></div>`).join('')}</div>
      <p data-at="31" class="amber">${F.oneK ? `From k = ${F.oneK} on, all ${F.seeds} seeds share one neighbourhood: one module, to split from the inside.` : 'The seeds stay in several groups.'}</p>
      <p class="credits" data-at="33">Step 1 of EndotypY (optional): seed groups.${F.firstShare.length ? ` Even at k = 1, ${listOf(F.firstShare)} share one.` : ''} The protein network is the authors'.</p>`,
    walk: `<h2 data-at="0.6">A walker that keeps coming home</h2>
      <p data-at="1.2">To find the rest of the module, EndotypY sends random walkers out from the seeds. At every step a walker hops to a random neighbour, or, ${word(F.tenths)} times in ten, jumps back to a seed.</p>
      <p data-at="11">Proteins the walkers visit again and again are close to the seeds, by many paths at once.</p>
      <p data-at="22" class="amber">The most visited join the seeds, one by one, until the module holds together.</p>
      <div class="facts"><div data-at="26"><b>${F.seeds}</b><small>seeds</small></div><div data-at="27.5"><b>+ ${F.found}</b><small>found by the walk</small></div><div data-at="29"><b>${F.module}</b><small>genes in the module</small></div></div>
      <p class="credits" data-at="32">Step 2 of EndotypY: network expansion by random walk with restart (restart probability ${F.r}).</p>`,
    hood: `<h2 data-at="0.6">Every gene's neighbourhood</h2>
      <p data-at="1.2">What does each gene do? Its neighbours tell more than the gene alone. Take ${esc(gsym)}, which anchors acetylcholinesterase in the gap: a walk from ${esc(gsym)} alone marks its neighbourhood, the top ${F.pct}% of the network (${F.hood} proteins).</p>
      <p data-at="11">The parts of the cell that come up among them more often than chance (Gene Ontology terms), with ${esc(gsym)}'s own, become ${esc(gsym)}'s row of marks. Every gene gets one.</p>
      <div class="facts"><div data-at="22"><b>${F.module}</b><small>genes</small></div><div data-at="23"><b>${F.terms}</b><small>cell parts</small></div><div data-at="24"><b>${fmt(F.ones)}</b><small>marks</small></div></div>
      <p data-at="28" class="amber">Genes with similar rows work in similar places.</p>
      <p class="credits" data-at="30">Step 3 of EndotypY: functional neighbourhood annotation (gene-set enrichment with GSEApy and Enrichr libraries; here ${esc(F.featLib.replace(/_/g, ' '))}).</p>`,
    split: `<h2 data-at="0.6">A tree that splits only when it must</h2>
      <p data-at="1.2">Genes with similar rows are joined, pair by pair, into a tree.</p>
      <p data-at="8">Where to cut it? Not at a fixed height. Tree2BreakSpace tests every split from the root down: do the two sides use the cell's parts differently? A split stays only when the data say so.</p>
      <p data-at="19" class="amber">Of the tree's ${F.merges} splits, ${F.cuts} pass the test: ${F.endotypes} endotypes.</p>
      <p data-at="28">Laid out by their distances in the tree, the endotypes stand apart.</p>
      <p class="credits" data-at="32">Step 4 of EndotypY: statistically filtered hierarchical clustering (Tree2BreakSpace, Sakalli et al., in progress).</p>`,
    endotypes: `<h2 data-at="0.6">${F.endotypes} endotypes</h2>
      <p data-at="1.2">Each endotype is a group of genes tied together in the network and in what they do: one bubble each, with grey bands for the links between them. In the authors' analysis:</p>
      <div style="display:grid">
        ${E[1] ? step(1, 8, 17.5, `${listOf(inEndo(1, ['SLC25A1']))} exports citrate from the nerve ending's mitochondria; from it comes acetyl-CoA, needed to make acetylcholine.`) : ''}
        ${E[9] ? step(9, 18, 27.5, `forming and releasing synaptic vesicles (${inEndo(9, ['SYT1', 'SYT2', 'SNAP25', 'STX19', 'RPH3A']).join(', ')}). Givinostat, a treatment for Duchenne muscular dystrophy, perturbs several of them: a lead for repurposing.`) : ''}
        ${E[5] ? step(5, 28, 37.5, `receptor subunits (${inEndo(5, ['CHRNB1', 'CHRND']).join(', ')}) that start the muscle's signal, and sodium channels (${inEndo(5, ['SCN4A', 'SCN8A', 'SCN1B']).join(', ')}) that carry it on.`) : ''}
        ${E[2] ? step(2, 38, 0, `the matrix in the gap (${inEndo(2, ['COLQ', 'AGRN', 'LAMB2', 'LAMA5', 'COL13A1']).join(', ')}): it holds the junction together and anchors acetylcholinesterase.`) : ''}
      </div>
      <p data-at="46" class="amber">Back in the junction, every endotype finds its place.</p>
      <p class="note" data-at="52">${Word(F.clear)} endotypes share a clear place in the cell, ${word(F.weak)} a weak one; ${word(F.none)} (${F.noPlace.join(', ')}) share none and hover loose.</p>`,
    next: `<h2 data-at="0.6">What endotypes are for</h2>
      <ul class="steps">
        <li data-at="1.2"><b>Patients</b>grouped by mechanism, not by broad symptoms</li>
        <li data-at="3.5"><b>Drugs</b>pathways to target, and drugs to repurpose</li>
        <li data-at="6"><b>Rare and common</b>the links between rare and common forms of a disease</li>
      </ul>
      <p data-at="9">EndotypY is open source, a Python package installed with pip: github.com/menchelab/EndotypY.</p>
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
  show('syn', a + 8.7, a + 10.5, C.cloud.a - 0.5, C.cloud.a + 1.5);
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
  label('motor', 'junction', '<b>Neuromuscular junction</b>where nerve meets muscle', C.tired.a + 2, C.tired.a + 8.5, 'cyn');
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
  ['net', 'Network', `The authors' protein network: ${fmt(FACTS.genes)} proteins and their links, the ${FACTS.seeds} seeds, the walk with restart and the module of ${FACTS.module} genes.`],
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
      <dt>Strongest term</dt><dd style="font-size:15px">${esc(E.term)}<small>${STRONG[E.strong]} (adjusted p ${fmtP(E.p)})</small></dd>
      <dt>Place</dt><dd style="font-size:15px">${E.place ? esc(PLACE[E.place] || E.place) : 'no shared place'}</dd>
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
  pane.innerHTML = `<h3>${esc(G.sym)}</h3><p class="sub">${S ? `${esc(S[1])}. Seed: a CMS gene (Gene Table item ${esc(S[2])}).` : 'Found by the walk: not a known CMS gene, but close to the seeds.'}</p>
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
    walk: `Walkers start at the seeds. At every step one jumps back to a seed with probability ${F.r}, otherwise it hops to a random neighbour. The most visited genes join the ${F.seeds} seeds until the module holds together: ${F.found} found, ${F.module} in all.`,
    hood: `A walk from one gene alone marks its neighbourhood, the top ${F.pct}% of the network (${F.hood} proteins). The cell parts enriched there, with the gene's own, are its row of the matrix.`,
    tree: `Genes with similar rows join into a tree. Tree2BreakSpace tests each split from the root down and keeps it only when the two sides differ: ${F.cuts} of ${F.merges} splits.`,
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
// the gap's scale (metres per unit): the nerve ending's vesicles about 0.8 m above the cleft (over your head) and the
// receptor-covered folds about 0.45 m below it (at your hips), so the muscle is under them
function gapScale() {
  if (XR.gapR) return XR.gapR;
  const g = anchorOf('syn', 'gap')[1], up = anchorOf('syn', 'vesicles')[1] - g, down = g - anchorOf('syn', 'folds')[1];
  const k = [up > 0.01 ? 0.8 / up : 0, down > 0.01 ? 0.45 / down : 0].filter(x => x > 0);
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
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
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
  y += textBlock(ctx, `Strongest term: ${E.term} (${STRONG[E.strong]}, adjusted p ${fmtP(E.p)}).`, x, y, W, 24, 34, VC.muted, 400, 2) + 4;
  y += textBlock(ctx, `Place: ${E.place ? PLACE[E.place] || E.place : 'no shared place'}.`, x, y, W, 24, 34, VC.muted, 400, 2) + 14;
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
  y += textBlock(ctx, S ? `${S[1]}. A seed: Gene Table item ${S[2]}.` : 'Found by the walk: not a known CMS gene, but close to the seeds.', x, y, W, 23, 32, VC.muted, 400, 2) + 12;
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
