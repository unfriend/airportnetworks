// Tissue and time: how the body's organs are built from small working units, and how they change as we age. One H&E
// slide and what it shows, 24,945 slides of GTEx, the authors' method (H&E-UTAG: tiles, features, neighbours, domains),
// an atlas of 218 microanatomical domains, the network of organ architecture, what changes with age and with disease,
// and the contacts between domains. After Buljan I, Bago-Horvath Z, Rendeiro AF, "Systematic mapping of human tissue
// microanatomy reveals age-associated remodeling and resilience", bioRxiv 2025, doi 10.1101/2025.10.13.682110
// (CC BY-NC), the poster "Microanatomical organization of the human body and its changes with age" and the talk
// "Microanatomical principles of tissue organization and their change with age" (Iva Buljan, Rendeiro group; LBI for
// Network Medicine, CeMM, Medical University of Vienna), with Iva Buljan's network of organ architecture.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/micro/build.mjs from the tour's kit, the tour's PET body and tissue sets and the data, organ models,
// sets and engine parts in tools/micro: edit those, not this file.
HOST.register('micro', function (HOST) {
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
// MICRO_DATA (the preprint's numbers and the network of organ architecture, tools/micro/sets/data.js) comes first, then
// the organs' small 3D models (ORGAN3D, tools/micro/sets/organs.js; SETS.organs there is the harness's gallery, not
// part of the story); the tour's PET body and tissue sets (SETS.body, SETS.tissue) are used unchanged.
const SETS = {};
// MICRO_DATA: generated by tools/micro/data/gen_data.mjs; never edit by hand.
// Sources: the preprint (Buljan I, Bago-Horvath Z, Rendeiro AF. Systematic mapping of human tissue microanatomy reveals age-associated remodeling and resilience. bioRxiv 2025. doi:10.1101/2025.10.13.682110 (CC BY-NC)), the poster and talk, and Iva Buljan's network of organ architecture.
// Fields:
//   source        citations
//   facts         the preprint's numbers (slides, tissues, organs, donors (983 in its abstract; 971 analysed in its
//                 results), ages, tiles, domains, domain types, shared and tissue-specific shares (%), the share of
//                 domains that change with age (%, and as domain-tissue pairs over 1 % abundance), pathology, benchmarks)
//   examples[]    the three worked examples of change with age { domain, tissue, from (% at 20), to (% at 70),
//                 perDecade, note }
//   findings      the preprint's other findings in words: most and least changed systems, connective tissue,
//                 pathology [{ kind, organ, note }], interactions [{ organ, a, b, dir (1 more contacts with age, -1
//                 fewer), note }], stable
//   levels        the four levels of the network: organ, tissue, tissue type, domain
//   graph         the network of organ architecture: nodes [name, level 0..3, abundance (domains only)], edges [a, b]
//                 (indices into nodes; organ-tissue, organ-tissue type, tissue-tissue type, domain-tissue type and a
//                 few tissue type-tissue type links)
//   organs[]      the 29 organs { name, pos (a home point in the tour's PET body set's frame) }
//   figures       values read off the talk's figures (atlas sections, the volcano, trajectories, interactions), if any
const MICRO_DATA = {"source":{"preprint":"Buljan I, Bago-Horvath Z, Rendeiro AF. Systematic mapping of human tissue microanatomy reveals age-associated remodeling and resilience. bioRxiv 2025. doi:10.1101/2025.10.13.682110 (CC BY-NC)","poster":"Buljan I, Bagó-Horváth Z, Rendeiro A. Microanatomical organization of the human body and its changes with age. LBI for Network Medicine; CeMM; Medical University of Vienna."},"facts":{"slides":24945,"tissues":40,"organs":29,"donors":983,"donorsAnalysed":971,"ages":[20,70],"medianAge":56,"male":66.8,"tiles":162000000,"domains":218,"types":74,"superclasses":10,"shared3":16,"specific":69,"ageChange":28,"agePairs":[37,128],"agePairsMin":1,"mostUnder":3,"donorVars":111,"pathology":{"instances":9643,"kinds":54},"bench":{"salivary":{"r":0.91,"r2":0.83},"stomach":{"r":0.76,"r2":0.58}},"method":"H&E-UTAG","gtex":"GTEx (Genotype-Tissue Expression project)"},"examples":[{"domain":"corpus albicans","tissue":"Ovary","from":1.4,"to":11.89,"perDecade":3.51,"note":"scars left by old ovarian follicles: they pile up with age"},{"domain":"submucosa","tissue":"gastrointestinal tract","from":42.9,"to":34.5,"perDecade":-0.98,"note":"the loose layer under the gut lining thins"},{"domain":"adenohypophysis","tissue":"Pituitary","from":82.6,"to":67.9,"perDecade":-3.42,"note":"the gland part of the pituitary shrinks"}],"findings":{"most":"Integumentary (skin) and reproductive tissues changed most, nervous and muscular tissues least.","connective":"Connective tissue increased with age in many organs.","pathology":[{"kind":"calcified plaques","organ":"Artery","note":"rise with age, faster after about 40"},{"kind":"infarct tissue","organ":"Heart","note":"rises steeply after about 60"},{"kind":"testicular atrophy","organ":"Testis","note":"changes the shape of the seminiferous tubules (morphology)"},{"kind":"arterial fibrosis","organ":"Artery","note":"changes how much tunica adventitia there is (abundance)"},{"kind":"liver cirrhosis","organ":"Liver","note":"changes both"}],"interactions":[{"organ":"Uterus","note":"the endometrium shifts towards contacts with connective tissue","dir":0},{"organ":"Ovary","a":"mucosa","b":"fibromuscular tissue","dir":1},{"organ":"Skin","a":"subdermis","b":"reticular dermis","dir":-1},{"organ":"Colon","a":"muscularis","b":"submucosa","dir":-1},{"organ":"Fallopian Tube","a":"mucosa","b":"muscularis","dir":-1},{"organ":"Fallopian Tube","a":"mucosa","b":"fibromuscular tissue","dir":1},{"organ":"Artery","a":"calcified plaque","b":"tunica intima","dir":1,"note":"coronary and tibial arteries"}],"stable":"Most organs keep the same core network of domain contacts as they age: a resilient framework."},"levels":["organ","tissue","tissue type","domain"],"graph":{"nodes":[["Adipose",0,50],["Adrenal Gland",0,50],["Artery",0,50],["Bladder",0,50],["Brain",0,50],["Breast",0,50],["Cervix",0,50],["Colon",0,50],["Esophagus",0,50],["Fallopian Tube",0,50],["Heart",0,50],["Kidney",0,50],["Liver",0,50],["Lung",0,50],["Minor Salivary Gland",0,50],["Muscle",0,50],["Nerve",0,50],["Ovary",0,50],["Pancreas",0,50],["Pituitary",0,50],["Prostate",0,50],["Skin",0,50],["Small Intestine",0,50],["Spleen",0,50],["Stomach",0,50],["Testis",0,50],["Thyroid",0,50],["Uterus",0,50],["Vagina",0,50],["Adipose - Subcutaneous",1,50],["Adipose - Visceral (Omentum)",1,50],["Artery - Aorta",1,50],["Artery - Coronary",1,50],["Artery - Tibial",1,50],["Brain - Cerebellum",1,50],["Brain - Cortex",1,50],["Breast - Mammary Tissue",1,50],["Cervix - Ectocervix",1,50],["Cervix - Endocervix",1,50],["Colon - Sigmoid",1,50],["Colon - Transverse",1,50],["Esophagus - Gastroesophageal Junction",1,50],["Esophagus - Mucosa",1,50],["Esophagus - Muscularis",1,50],["Heart - Atrial Appendage",1,50],["Heart - Left Ventricle",1,50],["Kidney - Cortex",1,50],["Kidney - Medulla",1,50],["Muscle - Skeletal",1,50],["Nerve - Tibial",1,50],["Skin - Not Sun Exposed (Suprapubic)",1,50],["Skin - Sun Exposed (Lower leg)",1,50],["Small Intestine - Terminal Ileum",1,50],["adipose tissue",2,3],["cardiac muscle",2,12],["connective tissue",2,21],["glandular tissue",2,17],["lining epithelium",2,12],["lymphoid structure",2,2],["neuronal tissue",2,24],["skeletal muscle",2,2],["smooth muscle",2,17],["vascular tissue",2,5],["adenohypophysis",3,34],["adrenal cortex",3,11],["adrenal cortex or medulla",3,14],["adrenal medulla",3,5],["adventitia subserosa",3,36],["alveolar space",3,28],["blood vessels",3,1],["blood vessels and hemorrhage",3,0],["cerebral medulla",3,8],["cervical stroma",3,32],["connective tissue and adipose tissue",3,35],["corpus albicans",3,8],["ductal tissue",3,9],["endocervical epithelium",3,0],["endometrium",3,3],["epidermis",3,15],["epididymis",3,1],["epineurium",3,55],["fat",3,0],["fibroadipose tissue",3,14],["fibromuscular tissue",3,19],["fibrovascular tissue",3,8],["glandular and ductal elements",3,38],["granular layer",3,19],["gray matter",3,40],["inner circular smooth muscle",3,10],["lamina propria",3,19],["liver parenchyma",3,29],["lung parenchyma",3,16],["lymph node",3,1],["lymphoid Peyer patches",3,6],["lymphoid tissue",3,0],["medulla",3,6],["medulla kidney tubules",3,15],["molecular layer",3,16],["mucosa",3,11],["mucosa epithelium",3,28],["mucosa lamina propria",3,24],["muscularis",3,17],["myocardium",3,8],["myometrium",3,26],["nerve fibers",3,43],["neurohypophysis",3,8],["outer longitudinal smooth muscle",3,21],["ovarian cortex",3,19],["ovarian stroma",3,32],["pancreatic parenchyma",3,23],["pancreatic parenchyma autolysed",3,6],["papillary dermis",3,24],["pars intermedia",3,0],["pia mater",3,1],["pia mater and white matter",3,19],["portal vein",3,9],["prostatic acini",3,24],["renal glomeruli",3,25],["reticular dermis",3,17],["seminiferous tubules",3,31],["squamous epithelium",3,6],["stroma",3,36],["subcutaneous dermis",3,36],["subdermis",3,38],["submucosa",3,26],["submucosal gland",3,0],["tendon",3,0],["thyroid follicles",3,40],["tunica adventitia",3,21],["tunica intima",3,25],["tunica media",3,15],["vessels and connective tissue",3,20],["white matter",3,37]],"edges":[[28,57],[28,55],[28,61],[27,57],[27,55],[27,61],[26,55],[26,56],[25,55],[25,56],[24,57],[24,55],[24,61],[23,55],[22,52],[52,58],[52,55],[52,61],[52,57],[21,51],[51,57],[51,55],[21,50],[50,57],[50,55],[20,56],[20,55],[19,55],[19,56],[18,55],[18,56],[17,57],[17,55],[16,49],[49,55],[49,59],[15,48],[48,55],[48,60],[14,61],[14,57],[14,56],[14,55],[13,56],[13,55],[12,62],[12,55],[12,56],[11,47],[47,55],[47,56],[11,46],[46,55],[46,56],[10,45],[45,55],[45,54],[10,44],[44,55],[44,54],[9,53],[9,62],[9,57],[9,61],[9,55],[8,43],[43,56],[43,57],[43,60],[43,55],[43,61],[8,42],[42,62],[42,56],[42,57],[42,61],[42,55],[8,41],[41,61],[41,55],[7,40],[40,57],[40,61],[40,55],[7,39],[39,57],[39,61],[39,55],[6,38],[38,57],[38,56],[38,55],[6,37],[37,57],[37,55],[5,36],[36,53],[36,56],[36,55],[4,35],[35,59],[4,34],[34,59],[3,57],[3,55],[3,61],[2,33],[33,60],[33,58],[33,61],[33,55],[2,32],[32,54],[32,55],[32,61],[2,31],[31,55],[31,61],[1,55],[1,56],[0,30],[30,60],[30,62],[30,58],[30,55],[0,29],[29,53],[29,62],[29,55],[55,89],[57,77],[61,103],[56,127],[56,79],[56,119],[55,100],[55,121],[58,93],[57,99],[55,122],[57,78],[55,111],[55,118],[55,123],[56,116],[56,112],[56,105],[56,63],[56,110],[56,109],[55,84],[55,74],[57,107],[55,108],[59,126],[59,104],[59,80],[56,85],[55,73],[56,68],[55,91],[62,115],[56,90],[56,95],[56,96],[56,117],[53,81],[62,69],[56,125],[61,88],[61,106],[55,124],[57,76],[57,120],[55,72],[56,75],[55,83],[59,113],[59,114],[59,132],[59,87],[59,71],[59,97],[59,86],[57,98],[55,67],[61,101],[58,94],[54,54],[54,102],[55,129],[55,128],[61,130],[56,66],[55,82],[56,65],[56,56],[56,64],[60,60],[58,92],[53,53],[62,70],[62,131],[55,55]]},"organs":[{"name":"Adipose","pos":[0.1,-0.2,0.07]},{"name":"Adrenal Gland","pos":[-0.054,0.152,-0.06]},{"name":"Artery","pos":[0.014,0.25,-0.04]},{"name":"Bladder","pos":[0,-0.112,0.045]},{"name":"Brain","pos":[0,0.738,-0.008]},{"name":"Breast","pos":[0.07,0.36,0.1]},{"name":"Cervix","pos":[0,-0.1,0.02]},{"name":"Colon","pos":[-0.09,0.05,0.03]},{"name":"Esophagus","pos":[0,0.45,-0.03]},{"name":"Fallopian Tube","pos":[0.06,-0.04,0]},{"name":"Heart","pos":[0.038,0.293,0.052]},{"name":"Kidney","pos":[-0.065,0.098,-0.066]},{"name":"Liver","pos":[-0.074,0.205,0.012]},{"name":"Lung","pos":[-0.079,0.365,-0.01]},{"name":"Minor Salivary Gland","pos":[0,0.66,0.08]},{"name":"Muscle","pos":[0.09,-0.62,-0.03]},{"name":"Nerve","pos":[-0.09,-0.62,0]},{"name":"Ovary","pos":[-0.06,-0.06,0]},{"name":"Pancreas","pos":[0.032,0.14,-0.01]},{"name":"Pituitary","pos":[0,0.71,0]},{"name":"Prostate","pos":[0,-0.15,0]},{"name":"Skin","pos":[0.1,-0.7,0.05]},{"name":"Small Intestine","pos":[0,0.02,0.05]},{"name":"Spleen","pos":[0.108,0.2,-0.056]},{"name":"Stomach","pos":[0.08,0.2,0.05]},{"name":"Testis","pos":[0.03,-0.21,0.06]},{"name":"Thyroid","pos":[0,0.548,0.042]},{"name":"Uterus","pos":[0,-0.07,0.02]},{"name":"Vagina","pos":[0,-0.13,0.02]}],"figures":{"atlas":[{"tissue":"Small intestine","scaleBar":"1 cm","shape":"curved crescent / bean-shaped strip, a little over 2:1; the segmentation map looks cut off along its flat left side; bands run parallel to the curved outer edge","domains":[{"name":"Peyer's pathches","colour":"#1a78b6","share":0.22},{"name":"mucosa","colour":"#f58020","share":0.15},{"name":"muscularis","colour":"#2ca249","share":0.37},{"name":"submucosa","colour":"#d82a2a","share":0.26}]},{"tissue":"Stomach","scaleBar":"2 cm","shape":"tall ragged-edged rectangle (about 1:2); layers run lengthways: orange gastric glands on the left, wavy red submucosa strip in the middle, big green muscularis on the right, blue foveolae as a thin rim","domains":[{"name":"gastric foveolae","colour":"#1a78b6","share":0.13},{"name":"gastric glands","colour":"#f58020","share":0.21},{"name":"muscularis","colour":"#2ca249","share":0.5},{"name":"submucosa","colour":"#d82a2a","share":0.16}]},{"tissue":"Ovary","scaleBar":"1 cm","shape":"half dome / rounded wedge with a flat base; thin purple edge line, green cortex rim along the curve, blue corpus albicans core with red stroma patches and a few orange flecks","domains":[{"name":"corpus albicans","colour":"#1a78b6","share":0.44},{"name":"fibrovascular tissue","colour":"#f58020","share":0.03},{"name":"ovarian cortex","colour":"#2ca249","share":0.27},{"name":"ovarian stroma","colour":"#d82a2a","share":0.2},{"name":"tissue edge","colour":"#9268ad","share":0.07}]},{"tissue":"Pancreas","scaleBar":"1 dm","shape":"irregular triangular patchwork: big orange lobules separated by branching blue connective-tissue bands","domains":[{"name":"connective tissue","colour":"#1a78b6","share":0.25},{"name":"pancreatic parenchyma","colour":"#f58020","share":0.75}]},{"tissue":"Skeletal muscle","scaleBar":"1 cm","shape":"irregular hooked blob with holes and folds; orange muscle with blue fibroadipose seams","domains":[{"name":"fibroadipose tissue","colour":"#1a78b6","share":0.31},{"name":"skeletal muscle","colour":"#f58020","share":0.69}]},{"tissue":"Kidney Medulla","scaleBar":"2 cm","shape":"roughly square slab; large brown tubule mass in the lower/centre part, pink glomeruli band across the top and down the sides, red connective rim, a few purple medulla specks","domains":[{"name":"connective tissue","colour":"#d82a2a","share":0.12},{"name":"medula","colour":"#9268ad","share":0.05},{"name":"medula kidney tubules","colour":"#8c574c","share":0.59},{"name":"renal glomeruli","colour":"#d87ab2","share":0.24}]},{"tissue":"Vagina","scaleBar":"2 cm","shape":"tall teardrop / oval (about 1:1.6); thin red epithelium on the left rim, orange lamina propria band, green muscularis in the lower right bulk, blue connective rim","domains":[{"name":"connective tissue","colour":"#1a78b6","share":0.08},{"name":"lamina propria","colour":"#f58020","share":0.41},{"name":"muscularis","colour":"#2ca249","share":0.42},{"name":"squamous epithelium","colour":"#d82a2a","share":0.09}]},{"tissue":"Prostate","scaleBar":"1 cm","shape":"roughly square slab; blue fibromuscular matrix with orange acini patches (checkerboard-like) and an orange rim","domains":[{"name":"fibromuscular tissue","colour":"#1a78b6","share":0.57},{"name":"prostatic acini","colour":"#f58020","share":0.43}]},{"tissue":"Liver","scaleBar":"2 cm","shape":"squarish quadrilateral; orange parenchyma, scattered green portal-vein specks, blue connective tissue at the rim and in patches","domains":[{"name":"connective tissue","colour":"#1a78b6","share":0.17},{"name":"liver parenchyma","colour":"#f58020","share":0.74},{"name":"portal vein","colour":"#2ca249","share":0.09}]},{"tissue":"Aorta","scaleBar":"2 cm","shape":"long straight (slightly curved) band, about 6:1, in three layers: thin orange intima on the top edge, thick green media, thin blue adventitia underneath","domains":[{"name":"tunica intima","colour":"#f58020","share":0.13},{"name":"tunica media","colour":"#2ca249","share":0.74},{"name":"tunica adventitia","colour":"#1a78b6","share":0.12}]},{"tissue":"Tibial nerve","scaleBar":"1 cm","shape":"cluster of 5 to 6 round fascicles joined together; orange nerve fibres in each, blue epineurium between and around them","domains":[{"name":"epineurium","colour":"#1a78b6","share":0.52},{"name":"nerve fibers","colour":"#f58020","share":0.48}]},{"tissue":"Adrenal gland","scaleBar":"1 cm","shape":"small bean / oval; green fibroadipose core, blue adrenal cortex layer along the lower and right edge, thin orange tissue edge","domains":[{"name":"adrenal cortex","colour":"#1a78b6","share":0.33},{"name":"fibroadipose tissue","colour":"#2ca249","share":0.53},{"name":"tissue edge","colour":"#f58020","share":0.14}]},{"tissue":"Brain cortex","scaleBar":"2 cm","shape":"folded two-lobed gyrus shape; purple white matter core, green grey-matter cortex round it, thin red edge","domains":[{"name":"gray matter","colour":"#2ca249","share":0.37},{"name":"tissue edge","colour":"#d82a2a","share":0.1},{"name":"white matter","colour":"#9268ad","share":0.52}]},{"tissue":"Pituitary","scaleBar":"5 mm","shape":"rounded blob with a small lobe at the lower right; mostly blue adenohypophysis, green neurohypophysis lobe at the lower right, thin orange rim","domains":[{"name":"adenohypophysis","colour":"#1a78b6","share":0.83},{"name":"fibromuscular tissue","colour":"#f58020","share":0.06},{"name":"neurohypophysis","colour":"#2ca249","share":0.12}]},{"tissue":"Artery coronary","scaleBar":"1 cm","shape":"ring (annulus) with an open oval lumen; orange intima inside, green media, blue adventitia outside","domains":[{"name":"tunica adventitia","colour":"#1a78b6","share":0.24},{"name":"tunica intima","colour":"#f58020","share":0.38},{"name":"tunica media","colour":"#2ca249","share":0.38}]},{"tissue":"Thyroid","scaleBar":"1 cm","shape":"oval / bean blob; green follicles inside, blue connective tissue rim and septa (cyst, orange, is in the legend but hardly drawn)","domains":[{"name":"connective tissue","colour":"#1a78b6","share":0.37},{"name":"cyst","colour":"#f58020","share":0},{"name":"thyroid follicles","colour":"#2ca249","share":0.63}]},{"tissue":"Bladder","scaleBar":"1 cm","shape":"narrow tall strip, slightly curved (about 1:2.5); red muscularis bulk, orange adventitia / subserosa on the left, thin green mucosa on the right edge","domains":[{"name":"mucosa","colour":"#2ca249","share":0.09},{"name":"muscularis","colour":"#d82a2a","share":0.63},{"name":"adventita subserosa","colour":"#f58020","share":0.28}]},{"tissue":"Skin","scaleBar":"2 cm","shape":"narrow vertical oval strip (about 1:3); thin blue epidermis on the outer edge, orange papillary dermis, green reticular dermis core, red subdermis","domains":[{"name":"epidermis","colour":"#1a78b6","share":0.09},{"name":"papillary dermis","colour":"#f58020","share":0.27},{"name":"reticular dermis","colour":"#2ca249","share":0.38},{"name":"subdermis","colour":"#d82a2a","share":0.27}]},{"tissue":"Heart","scaleBar":"1 cm","shape":"irregular triangular chunk with a large white hole (cavity); almost all blue cardiac muscle, orange connective rim, a few green flecks","domains":[{"name":"cardiac muscle","colour":"#1a78b6","share":0.91},{"name":"connective tissue","colour":"#f58020","share":0.08},{"name":"fibroadipose tissue","colour":"#2ca249","share":0}]},{"tissue":"Adipose - Visceral","scaleBar":"2 cm","shape":"ragged net of orange fragments with many holes; a green lymph-node streak lower right, a few blue vessel specks","domains":[{"name":"connective tissue","colour":"#f58020","share":0.87},{"name":"lymph node","colour":"#2ca249","share":0.13},{"name":"blood vessels /hemorrhage","colour":"#1a78b6","share":0.01}]},{"tissue":"Spleen","scaleBar":"2 cm","shape":"tall rounded rectangle (about 1:1.5); uniform green stroma with blue connective flecks and a thin red edge","domains":[{"name":"connective tissue","colour":"#1a78b6","share":0.1},{"name":"stroma","colour":"#2ca249","share":0.85},{"name":"tissue edge","colour":"#d82a2a","share":0.05}]},{"tissue":"Breast","scaleBar":"1 cm","shape":"small ragged crescent; orange connective tissue with red fibromuscular and green ductal patches; blue adipose bits at the edges","domains":[{"name":"adipose tissue","colour":"#1a78b6","share":0.04},{"name":"connective tissue","colour":"#f58020","share":0.62},{"name":"ductal tissue","colour":"#2ca249","share":0.08},{"name":"fibromuscular tissue","colour":"#d82a2a","share":0.26}]},{"tissue":"Fallopian tube","scaleBar":"1 cm","shape":"round cross-section (disc with a ring): green mucosa in the middle with a white lumen, red muscularis ring, orange fibromuscular outer ring","domains":[{"name":"fibromuscular tissue","colour":"#f58020","share":0.27},{"name":"mucosa","colour":"#2ca249","share":0.32},{"name":"muscularis","colour":"#d82a2a","share":0.42}]},{"tissue":"Testis","scaleBar":"1 cm","shape":"roughly round lump with ragged edge; orange seminiferous tubules, blue connective tissue patches (mostly lower centre)","domains":[{"name":"connective tissue","colour":"#1a78b6","share":0.38},{"name":"seminiferous tubules","colour":"#f58020","share":0.62}]},{"tissue":"Uterus","scaleBar":"2 cm","shape":"wide irregular quadrilateral with an oval hole (cavity) in the middle; red myometrium dominates, green endometrium lines the hole, thin orange connective rim","domains":[{"name":"connective tissue","colour":"#f58020","share":0.08},{"name":"endometrium","colour":"#2ca249","share":0.14},{"name":"myometrium","colour":"#d82a2a","share":0.77}]},{"tissue":"Ectocervix","scaleBar":"5 cm","shape":"tall wedge / comma, pointed at the bottom; purple cervical stroma, pink squamous epithelium on the right edge, grey tissue-edge pixels on the left and bottom, brown specks (fibromuscular tissue) almost absent","domains":[{"name":"cervical stroma","colour":"#9268ad","share":0.8},{"name":"fibromuscular tissue","colour":"#8c574c","share":0},{"name":"squamous epithelium","colour":"#d87ab2","share":0.09},{"name":"tissue edge","colour":"#939598","share":0.11}]},{"tissue":"Minor salivary gland","scaleBar":"2 cm","shape":"elongated vertical drop (about 1:2.3), patchy: green fibroadipose tissue, red glandular and ductal lobules, pink submucosa, purple mucosa on the right edge, brown muscularis blob at the top","domains":[{"name":"fibroadipose tissue","colour":"#2ca249","share":0.32},{"name":"mucosa","colour":"#9268ad","share":0.08},{"name":"muscularis","colour":"#8c574c","share":0.09},{"name":"submucosa","colour":"#d87ab2","share":0.23},{"name":"glandular and ductal elements","colour":"#d82a2a","share":0.28}]},{"tissue":"Colon","scaleBar":"2 cm","shape":"narrow winding strip: finger-like folded mucosa at the top and bottom, and a thicker orange muscularis block in the lower left; blue mucosa on the outside, green submucosa inside","domains":[{"name":"mucosa","colour":"#1a78b6","share":0.41},{"name":"muscularis","colour":"#f58020","share":0.22},{"name":"submucosa","colour":"#2ca249","share":0.36}]},{"tissue":"Cerebellum","scaleBar":"2 cm","shape":"fan / triangle with a short stalk at the bottom; branching foliage pattern: red molecular layer and green granular layer in alternating bands, branching orange medulla tree","domains":[{"name":"cerebral medulla","colour":"#f58020","share":0.12},{"name":"granular layer","colour":"#2ca249","share":0.37},{"name":"molecular layer","colour":"#d82a2a","share":0.51}]}],"volcano":{"xLabel":"Abundance change (% per decade)","yLabel":"-log(P-value-adj)","xTicks":[-3,-2,-1,0,1,2,3],"yTicks":[0,2.5,5,7.5,10,12.5,15,17.5,20],"threshold":{"y":3,"x":0,"note":"horizontal grey dashed line at y = 3.0 (= -ln 0.05) and vertical at x = 0; points above the horizontal line are the significant ones"},"yScaleNote":"The y axis is labelled -log but matches the NATURAL log: panel f p = 4.8e-07 gives -ln p = 14.55 (dot at 14.54), panel g 1.1e-07 gives 16.0 (16.0), h: 7.4e-07 gives 14.1 (14.09), 0.0132 gives 4.33 (4.35), 0.0013 gives 6.65 (6.61), 4.6e-05 gives 9.99 (9.97).","encoding":"Dot colour = signed abundance change on a diverging blue-grey-red scale (legend -1, 0, 1, 2, 3); dot diameter grows with |change| (legend 1.0 to 3.5).","points":[{"domain":"tunica adventitia","tissue":"Artery - Aorta","x":-1.21,"y":16.29,"significant":true,"colour":"#acc2e5"},{"domain":"submucosa","tissue":"Colon - Transverse","x":-0.99,"y":14.54,"significant":true,"colour":"#b5cbe9"},{"domain":"submucosa","tissue":"Colon - Sigmoid","x":-1.13,"y":12.52,"significant":true,"colour":"#afc6e7"},{"domain":"nerve fibers","tissue":"Nerve - Tibial","x":-0.83,"y":10.65,"significant":true,"colour":"#bdcfeb"},{"domain":"squamous epithelium","tissue":"Vagina","x":-1.04,"y":9.97,"significant":true,"colour":"#b4c8e8"},{"domain":"ovarian stroma","tissue":"Ovary","x":-1.84,"y":7.46,"significant":true,"colour":"#90a9d8"},{"domain":"adenohypophysis","tissue":"Pituitary","x":-1.71,"y":6.61,"significant":true,"colour":"#96afdb"},{"domain":"ovarian cortex","tissue":"Ovary","x":-1.24,"y":6.32,"significant":true,"colour":"#abc2e5"},{"domain":"reticular dermis","tissue":"Skin - Not Sun Exposed","x":-1.48,"y":5.69,"significant":true,"colour":"#a0b9e0"},{"domain":"tunica adventitia","tissue":"Artery - Coronary","x":-1.28,"y":4.91,"significant":true,"colour":"#aac1e4"},{"domain":"tunica media","tissue":"Artery - Tibial","x":-0.54,"y":5.23,"significant":true,"colour":"#c8d8ef"},{"domain":"seminiferous tubules","tissue":"Testis","x":-0.92,"y":4.35,"significant":true,"colour":"#b9ccea"},{"domain":"pia matter and white matter","tissue":"Brain - Cortex","x":-0.9,"y":3.77,"significant":true,"colour":"#baceea"},{"domain":"submucosa","tissue":"Stomach","x":-0.54,"y":3.29,"significant":true,"colour":"#c8d8ef"},{"domain":"subdermis","tissue":"Skin - Not Sun Exposed","x":2.17,"y":19.72,"significant":true,"colour":"#ed7f64"},{"domain":"corpus albicans","tissue":"Ovary","x":3.51,"y":15.98,"significant":true,"colour":"#b31f2a"},{"domain":"connective tissue","tissue":"Testis","x":1.48,"y":14.09,"significant":true,"colour":"#f9a989"},{"domain":"connective tissue","tissue":null,"x":1.26,"y":11.11,"significant":true,"colour":"#f7b497","tissueNote":"tissue colour in panel e is light purple, not in the legend: not identified"},{"domain":"calcified plaques","tissue":"Artery - Tibial","x":0.72,"y":10.79,"significant":true,"colour":"#f4cbb6"},{"domain":"calcified plaques","tissue":"Artery - Coronary","x":1.08,"y":9.52,"significant":true,"colour":"#f8bca1"},{"domain":"endometrium","tissue":"Uterus","x":1.42,"y":8.21,"significant":true,"colour":"#f8ad8e","tissueNote":"inferred: panel e colour (dark blue) not in its legend; the atlas lists endometrium only under Uterus"},{"domain":"connective tissue","tissue":"Vagina","x":1.47,"y":5.58,"significant":true,"colour":"#f8aa8b","tissueNote":"from panel e: small red dot inside the Testis dot (Vagina in its legend)"},{"domain":"fibromuscular tissue","tissue":"Pituitary","x":1.48,"y":4.99,"significant":true,"colour":"#f9a989"},{"domain":"papillary dermis","tissue":"Skin - Not Sun Exposed","x":0.57,"y":4.2,"significant":true,"colour":"#f1d0bf"},{"domain":"fibroadipose tissue","tissue":"Lung","x":0.58,"y":3.93,"significant":true,"colour":"#f1cfbe"},{"domain":"neurohypophysis","tissue":"Pituitary","x":1.13,"y":3.08,"significant":true,"colour":"#f7b99e","note":"just above the threshold, overlaps white matter"},{"domain":"white matter","tissue":"Brain - Cortex","x":1.17,"y":3.07,"significant":true,"colour":"#f7b99e","note":"just above the threshold, overlaps neurohypophysis"}],"unlabelledSignificant":{"count":4,"colour":"light grey (change about +0.4 to +0.5, too small to colour)","points":[{"x":0.46,"y":4.44},{"x":0.46,"y":3.51,"note":"may be two overlapping dots"},{"x":0.36,"y":3.36},{"x":0.45,"y":3.19}],"note":"Panel e lists 4 domains that are not labelled in panel a: adrenal medulla (+0.47), epidermis (+0.46), epineurium (+0.45) and a second connective tissue (+0.36, pale olive, probably Pituitary). Their x values match these four grey dots, but which dot is which is not readable."},"unlabelledNotSignificant":{"countVisible":"about 50","note":"light grey dots below y = 3, most of them within |x| < 1; many overlap near x = 0, y < 1.5, so the real number is larger. Largest ones: (2.51, 0.77), (1.76, 1.13), (1.54, 0.3), (-1.18, 1.02); some blobs near (1.07, 1.55) and (-0.74, 0.78) are several merged dots. One grey dot sits just under the line at (-0.56, 2.95)."},"significantTotal":31,"bySystem":{"value":"Mean combined score (as printed above the axis, 0.00 to 1.75+; the figure does not define it)","bars":[{"system":"Integumentary","value":1.89},{"system":"Reproductive","value":1.45},{"system":"Cardiovascular","value":0.64},{"system":"Endocrine","value":0.53},{"system":"Digestive","value":0.48},{"system":"Urinary","value":0.39},{"system":"Nervous","value":0.34},{"system":"Respiratory","value":0.31},{"system":"Lymphatic","value":0.3},{"system":"Muscular","value":0.18}]},"byType":{"value":"Mean combined score (0.0 to 1.2+ axis; bar ends measured against the printed ticks)","bars":[{"type":"connective tissue","value":1.28},{"type":"pathology","value":0.69},{"type":"lining epithelium","value":0.62},{"type":"glandular tissue","value":0.44},{"type":"vascular tissue","value":0.39},{"type":"neuronal tissue","value":0.35},{"type":"cardiac muscle","value":0.35},{"type":"skeletal muscle","value":0.25},{"type":"smooth muscle","value":0.22},{"type":"adipose tissue","value":0.14},{"type":"lymphoid structure","value":0.01}]},"panelDandE":{"note":"Panels d (negative changes) and e (positive changes) list the same significant domains by name with the tissue as a dot colour; I used them to name the tissue of each volcano dot. Panel d x values: tunica media -0.54 (Artery - Tibial), submucosa -1.12 (Colon - Sigmoid), -0.98 (Colon - Transverse), -0.54 (Stomach), nerve fibers -0.82, pia and white matter -0.90, seminiferous tubules -0.92, squamous epithelium -1.04, tunica adventitia -1.21 (Aorta) and -1.28 (Coronary), ovarian cortex -1.24, reticular dermis -1.48, adenohypophysis -1.71, ovarian stroma -1.84. Panel e x values: corpus albicans 3.51, subdermis 2.17, fibromuscular tissue 1.48, connective tissue 1.48, 1.46, 1.26, 0.36, endometrium 1.42, white matter 1.17, neurohypophysis 1.13, calcified plaques 1.08 and 0.72, fibroadipose tissue 0.55, papillary dermis 0.57, adrenal medulla 0.47, epidermis 0.46, epineurium 0.45."}},"trajectories":[{"source":"image18 panel f","title":"submucosa (Colon - Transverse)","tissue":"Colon - Transverse","domain":"submucosa","x":"age (20 to 70)","y":"Domain abundance per slide (fraction, 0 to 0.6)","points":[[20,0.431],[30,0.416],[40,0.401],[50,0.386],[60,0.371],[70,0.356]],"band":[[20,0.419,0.442],[30,0.411,0.424],[40,0.396,0.406],[50,0.381,0.391],[60,0.366,0.376],[70,0.351,0.361]],"label":{"p":"4.8e-07","slope":"-0.98%/decade"},"note":"The drawn straight regression line falls about 0.015 per decade (-1.5 points), more than the printed -0.98%/decade. Line values are the drawn line; about 600 slide dots (grey) are not read. Companion H&E sections 20-29 and 60-69 y.o. with mucosa (blue), muscularis (orange), submucosa (green)."},{"source":"image18 panel g","title":"corpus albicans (Ovary)","tissue":"Ovary","domain":"corpus albicans","x":"age (20 to 70)","y":"Domain abundance per slide (fraction, 0 to 0.6)","points":[[20,null],[30,0.019],[40,0.052],[50,0.085],[60,0.118],[70,0.151]],"band":[[30,0.012,0.03],[40,0.044,0.059],[50,0.075,0.09],[60,0.103,0.136],[70,0.128,0.176]],"label":{"p":"1.1e-07","slope":"3.51%/decade"},"note":"The line is cut at the bottom axis: it starts at value 0 at about age 25 (the straight line would be slightly negative at 20). Drawn slope about +0.033 per decade. Most slides below 20 y.o. sit at 0; scatter widens strongly with age. Companion sections: corpus albicans (green here), ovarian cortex (red), ovarian stroma (purple): different colours from the atlas."},{"source":"image18 panel h","title":"seminiferous tubules (Testis)","tissue":"Testis","domain":"seminiferous tubules","x":"age (20 to 70)","y":"Domain abundance per slide (fraction, 0 to 0.6)","points":[[20,0.361],[30,0.348],[40,0.335],[50,0.323],[60,0.31],[70,0.297]],"band":[[20,0.35,0.369],[30,0.341,0.354],[40,0.329,0.341],[50,0.316,0.328],[60,0.304,0.315],[70,0.29,0.303]],"label":{"p":"0.0132","slope":"-0.91%/decade"}},{"source":"image18 panel h","title":"connective tissue (Testis)","tissue":"Testis","domain":"connective tissue","x":"age (20 to 70)","y":"Domain abundance per slide (fraction, 0 to 0.6)","points":[[20,0.272],[30,0.296],[40,0.319],[50,0.343],[60,0.366],[70,0.389]],"band":[[20,0.259,0.285],[30,0.285,0.303],[40,0.313,0.325],[50,0.337,0.349],[60,0.359,0.372],[70,0.379,0.399]],"label":{"p":"7.4e-07","slope":"1.48%/decade"}},{"source":"image18 panel h","title":"adenohypophysis (Pituitary)","tissue":"Pituitary","domain":"adenohypophysis","x":"age (20 to 70)","y":"Domain abundance per slide (fraction, 0 to 0.6)","points":[[20,0.4],[30,0.386],[40,0.371],[50,0.357],[60,0.342],[70,0.328]],"band":[[20,0.377,0.422],[30,0.369,0.403],[40,0.359,0.382],[50,0.349,0.363],[60,0.337,0.349],[70,0.318,0.338]],"label":{"p":"0.0013","slope":"-1.71%/decade"},"note":"The talk quotes 82.6% to 67.9% (-3.42%/decade) for this domain: that is about twice what this panel draws (0.40 to 0.33) and twice its printed slope (-1.71). The atlas section has 83% adenohypophysis by area. So this panel is probably per slide area and the talk numbers per tissue area (my guess, not stated)."},{"source":"image18 panel h","title":"squamous epithelium (Vagina)","tissue":"Vagina","domain":"squamous epithelium","x":"age (20 to 70)","y":"Domain abundance per slide (fraction, 0 to 0.6)","points":[[20,0.116],[30,0.102],[40,0.088],[50,0.074],[60,0.06],[70,0.047]],"band":[[20,0.109,0.12],[30,0.093,0.113],[40,0.082,0.094],[50,0.068,0.081],[60,0.054,0.066],[70,0.04,0.053]],"label":{"p":"4.6e-05","slope":"-1.04%/decade"},"note":"line starts at about age 20.5"},{"source":"image18 panel i (top left)","title":"Colon - Transverse (cell density in the domain)","tissue":"Colon - Transverse","domain":"submucosa (assumed from the neighbouring panels; the panel title says only the tissue)","x":"age (20 to 70)","y":"Density_domain (axis 0 to 22; unit not given)","series":{"Connective":[[20,6.33],[30,6.72],[40,7.16],[50,7.36],[60,7.35],[70,7.08]],"Inflammatory":[[20,1.29],[30,1.29],[40,1.35],[50,1.41],[60,1.44],[70,1.38]],"Neoplastic":"about 0 (a red line along the bottom, hidden by dots)","Dead":"about 0 (purple line along the bottom, starts at about age 22)","Epithelial":"not visible (orange, at or under 0)"},"points":[[20,6.33],[30,6.72],[40,7.16],[50,7.36],[60,7.35],[70,7.08]],"note":"smoothed curve (rises to a plateau at 45-60, dips after 60), series colours as legend: Connective blue, Epithelial orange, Inflammatory green, Neoplastic red, Dead purple; no band drawn"},{"source":"image18 panel i (top right)","title":"Colon - Transverse (cell-type proportion)","tissue":"Colon - Transverse","x":"age (20 to 70)","y":"Proportion (axis 0 to 0.55)","series":{"Connective":[[20,0.102],[30,0.11],[40,0.114],[50,0.121],[60,0.134],[70,0.139]],"Inflammatory":[[20,0.021],[30,0.021],[40,0.022],[50,0.024],[60,0.027],[70,0.028]],"Neoplastic":"about 0","Dead":"about 0","Epithelial":"not visible"},"points":[[20,0.102],[30,0.11],[40,0.114],[50,0.121],[60,0.134],[70,0.139]]},{"source":"image18 panel i (bottom left)","title":"submucosa, Stomach (cell density)","tissue":"Stomach","domain":"submucosa","x":"age (20 to 70)","y":"Density_domain (axis 0 to 15; unit not given)","series":{"Connective":[[20,4.58],[30,4.76],[40,4.93],[50,5.17],[60,5.11],[70,4.95]],"Inflammatory":[[20,0.96],[30,0.99],[40,0.98],[50,0.99],[60,0.98],[70,1.01]],"Neoplastic":"about 0","Dead":"about 0, line only from age 35","Epithelial":"not visible"},"points":[[20,4.58],[30,4.76],[40,4.93],[50,5.17],[60,5.11],[70,4.95]]},{"source":"image18 panel i (bottom right)","title":"submucosa, Stomach (cell-type proportion)","tissue":"Stomach","domain":"submucosa","x":"age (20 to 70)","y":"Proportion (axis 0 to 0.23)","series":{"Connective":[[20,0.053],[30,0.053],[40,0.053],[50,0.054],[60,0.056],[70,0.058]],"Inflammatory":[[20,0.011],[30,0.011],[40,0.01],[50,0.01],[60,0.01],[70,0.011]],"Neoplastic":"about 0","Dead":"about 0, line only from age 35","Epithelial":"not visible"},"points":[[20,0.053],[30,0.053],[40,0.053],[50,0.054],[60,0.056],[70,0.058]]},{"source":"image19 panel b","title":"calcified plaques","tissue":"not named in the panel (the schematic in panel a is a vessel cross-section and the pathologies, calcified plaques and atherosis, suggest arteries: inferred)","x":"age (20 to 70)","y":"Domain abundance (%) (axis units as printed)","points":[[20,0.833],[30,0.6],[40,0.744],[50,1.819],[60,2.928],[70,4.14]],"pointsMid":[[25,0.735],[35,0.529],[45,1.299],[55,2.319],[65,3.609]],"band":[[20,-0.148,1.823],[30,0.108,1.093],[40,0.054,1.447],[50,0.717,2.917],[60,1.841,4.023],[70,2.935,5.344]],"bandMid":[[25,-0.018,1.496],[35,0.134,0.932],[45,0.254,2.348],[55,1.263,3.374],[65,2.451,4.772]],"note":"smoothed curve with a shaded band (about a 95% interval, not stated); the band is clipped at the plot edge and dips below 0"},{"source":"image19 panel b","title":"atherosis","tissue":"not named in the panel (the schematic in panel a is a vessel cross-section and the pathologies, calcified plaques and atherosis, suggest arteries: inferred)","x":"age (20 to 70)","y":"Domain abundance (%) (axis units as printed)","points":[[20,0.015],[30,0.042],[40,0.083],[50,0.21],[60,0.4],[70,0.38]],"pointsMid":[[25,0.032],[35,0.039],[45,0.157],[55,0.292],[65,0.394]],"band":[[20,-0.011,0.042],[30,0.03,0.056],[40,-0.024,0.194],[50,-0.007,0.427],[60,0.115,0.686],[70,0.133,0.628]],"bandMid":[[25,0.011,0.054],[35,0.019,0.058],[45,-0.045,0.36],[55,0.063,0.526],[65,0.122,0.665]],"note":"smoothed curve with a shaded band (about a 95% interval, not stated); the band is clipped at the plot edge and dips below 0"},{"source":"image19 panel b","title":"infarct tissue","tissue":"not named in the panel (the schematic in panel a is a vessel cross-section and the pathologies, calcified plaques and atherosis, suggest arteries: inferred)","x":"age (20 to 70)","y":"Domain abundance (%) (axis units as printed)","points":[[20,0.021],[30,0.002],[40,0.017],[50,0.03],[60,0.112],[70,0.299]],"pointsMid":[[25,0.01],[35,0.006],[45,0.027],[55,0.051],[65,0.216]],"band":[[20,-0.016,0.059],[30,-0.006,0.011],[40,-0.011,0.046],[50,-0.014,0.072],[60,-0.059,0.288],[70,-0.143,0.744]],"bandMid":[[25,-0.011,0.032],[35,-0.008,0.019],[45,-0.014,0.069],[55,-0.022,0.126],[65,-0.105,0.542]],"note":"smoothed curve with a shaded band (about a 95% interval, not stated); the band is clipped at the plot edge and dips below 0"},{"source":"image19 panel b","title":"inflammatory aggregates and hemorrhage","tissue":"not named in the panel (the schematic in panel a is a vessel cross-section and the pathologies, calcified plaques and atherosis, suggest arteries: inferred)","x":"age (20 to 70)","y":"Domain abundance (%) (axis units as printed)","points":[[20,0.009],[30,0.017],[40,0.079],[50,0.285],[60,0.589],[70,0.567]],"pointsMid":[[25,0.013],[35,0.021],[45,0.159],[55,0.502],[65,0.58]],"band":[[20,-0.004,0.022],[30,-0.001,0.033],[40,-0.03,0.19],[50,-0.044,0.624],[60,0.108,1.07],[70,0.183,0.952]],"bandMid":[[25,0,0.026],[35,-0.015,0.057],[45,-0.059,0.382],[55,0.052,0.954],[65,0.156,1.006]],"note":"smoothed curve with a shaded band (about a 95% interval, not stated); the band is clipped at the plot edge and dips below 0"},{"source":"image20 panel f","title":"mucosa-muscularis, Fallopian Tube","tissue":"Fallopian Tube","x":"Age (21 to 69)","y":"Percentage of touching points (axis 0 to 100)","points":[[20,84.3],[30,76.7],[40,69.1],[50,61.5],[60,54],[70,46.4]],"band":[[20,71.5,93.6],[30,67.4,85.1],[40,61.8,75.6],[50,54.3,68.5],[60,45.1,63.2],[70,36.8,59.5]],"note":"straight regression line (-7.6 per decade, matches panel e -7.57), about 45 slide dots (grey-blue). Line spans age 21 to 69, so the 20 and 70 values are extrapolated by under one year."},{"source":"image20 panel g","title":"mucosa-fibromuscular tissue, Fallopian Tube","tissue":"Fallopian Tube","x":"Age (21 to 69)","y":"Percentage of touching points (axis 0 to 100)","points":[[20,19.8],[30,29.1],[40,38.3],[50,47.6],[60,56.8],[70,66.1]],"band":[[20,11.5,32.8],[30,21.5,38.4],[40,31.3,46],[50,40.1,55.3],[60,47.4,66.3],[70,52.6,76.8]],"note":"straight regression line (+9.25 per decade, matches panel e +9.25). Line spans age 21 to 69."}],"interactions":[{"organ":"Artery - Coronary","age":"20-29","nodes":["adipose tissue","smooth muscle","connective tissue","cardiac muscle"],"edges":[["adipose tissue","smooth muscle",0.21],["adipose tissue","cardiac muscle",0.11],["smooth muscle","connective tissue",1],["smooth muscle","cardiac muscle",0.11]],"edgeWidthPx":{"adipose tissue - smooth muscle":2.64,"adipose tissue - connective tissue":0,"adipose tissue - cardiac muscle":1.41,"smooth muscle - connective tissue":12.5,"smooth muscle - cardiac muscle":1.33,"connective tissue - cardiac muscle":0},"weightNote":"weight = line width / width of the thickest edge in that panel (smooth muscle - connective tissue, about 12.5 to 13.4 px at the figure scale, the same in all five panels). An edge with weight 0 is not drawn. Node colours: adipose pale blue, smooth muscle green, connective tissue light green, cardiac muscle dark blue (tissue-type legend of panel b/c). Nodes are tissue types here, not domains."},{"organ":"Artery - Coronary","age":"30-39","nodes":["adipose tissue","smooth muscle","connective tissue","cardiac muscle"],"edges":[["adipose tissue","connective tissue",0.17],["adipose tissue","cardiac muscle",0.19],["smooth muscle","connective tissue",1],["smooth muscle","cardiac muscle",0.24],["connective tissue","cardiac muscle",0.18]],"edgeWidthPx":{"adipose tissue - smooth muscle":0,"adipose tissue - connective tissue":2.15,"adipose tissue - cardiac muscle":2.37,"smooth muscle - connective tissue":12.7,"smooth muscle - cardiac muscle":3.09,"connective tissue - cardiac muscle":2.3}},{"organ":"Artery - Coronary","age":"40-49","nodes":["adipose tissue","smooth muscle","connective tissue","cardiac muscle"],"edges":[["adipose tissue","smooth muscle",0.21],["adipose tissue","connective tissue",0.23],["adipose tissue","cardiac muscle",0.12],["smooth muscle","connective tissue",1],["smooth muscle","cardiac muscle",0.2],["connective tissue","cardiac muscle",0.14]],"edgeWidthPx":{"adipose tissue - smooth muscle":2.64,"adipose tissue - connective tissue":2.99,"adipose tissue - cardiac muscle":1.58,"smooth muscle - connective tissue":12.8,"smooth muscle - cardiac muscle":2.59,"connective tissue - cardiac muscle":1.8}},{"organ":"Artery - Coronary","age":"50-59","nodes":["adipose tissue","smooth muscle","connective tissue","cardiac muscle"],"edges":[["adipose tissue","smooth muscle",0.27],["adipose tissue","connective tissue",0.27],["smooth muscle","connective tissue",1],["smooth muscle","cardiac muscle",0.15],["connective tissue","cardiac muscle",0.08]],"edgeWidthPx":{"adipose tissue - smooth muscle":3.64,"adipose tissue - connective tissue":3.67,"adipose tissue - cardiac muscle":0,"smooth muscle - connective tissue":13.4,"smooth muscle - cardiac muscle":2.07,"connective tissue - cardiac muscle":1.04}},{"organ":"Artery - Coronary","age":"60-69","nodes":["adipose tissue","smooth muscle","connective tissue","cardiac muscle"],"edges":[["adipose tissue","smooth muscle",0.29],["adipose tissue","connective tissue",0.3],["smooth muscle","connective tissue",1],["smooth muscle","cardiac muscle",0.12],["connective tissue","cardiac muscle",0.1]],"edgeWidthPx":{"adipose tissue - smooth muscle":3.92,"adipose tissue - connective tissue":3.94,"adipose tissue - cardiac muscle":0,"smooth muscle - connective tissue":13.3,"smooth muscle - cardiac muscle":1.58,"connective tissue - cardiac muscle":1.29}},{"organ":"Stomach","age":"all ages (not age-stratified)","nodes":["connective tissue","smooth muscle","lining epithelium"],"edges":[["connective tissue","smooth muscle",null],["connective tissue","lining epithelium",null],["smooth muscle","lining epithelium",null]],"note":"panel b: tissue-type adjacency of one organ; all lines have the same thin width (about 1.6 to 1.9 px), so the figure shows presence only, no weights"},{"organ":"Small intestine (terminal ileum)","age":"all ages (not age-stratified)","nodes":["lymphoid structure","lining epithelium","connective tissue","smooth muscle"],"edges":[["lymphoid structure","lining epithelium",null],["lining epithelium","connective tissue",null],["lining epithelium","smooth muscle",null],["connective tissue","smooth muscle",null]],"note":"panel b: tissue-type adjacency of one organ; all lines have the same thin width (about 1.6 to 1.9 px), so the figure shows presence only, no weights"},{"organ":"Breast (mammary tissue)","age":"all ages (not age-stratified)","nodes":["adipose tissue","connective tissue","glandular tissue"],"edges":[["adipose tissue","connective tissue",null],["adipose tissue","glandular tissue",null],["connective tissue","glandular tissue",null]],"note":"panel b: tissue-type adjacency of one organ; all lines have the same thin width (about 1.6 to 1.9 px), so the figure shows presence only, no weights"},{"organ":"Minor salivary gland","age":"all ages (not age-stratified)","nodes":["smooth muscle","connective tissue","glandular tissue","lining epithelium"],"edges":[["smooth muscle","connective tissue",null],["smooth muscle","glandular tissue",null],["connective tissue","glandular tissue",null],["connective tissue","lining epithelium",null],["glandular tissue","lining epithelium",null]],"note":"panel b: tissue-type adjacency of one organ; all lines have the same thin width (about 1.6 to 1.9 px), so the figure shows presence only, no weights"}],"borderContactAndMotifs":{"borderContactChangePerDecade":{"source":"image20 panel e","xLabel":"Change in border contact per decade (units as printed; same units as the percentage of touching points in f and g)","sizeLegend":"-log10(pval) 2.5 to 15.0; sizes below are my estimate from the marker area (square of the diameter is linear in the legend)","rows":[["mucosa-fibromuscular tissue","Fallopian Tube",9.25,2.5],["myometrium-endometrium","Uterus",5.98,8.9],["adipose tissue-tunica media","Artery - Coronary",5.54,4.1],["Anatomical_cluster_4-fibromuscular tissue","Fallopian Tube",5.4,null],["adipose tissue-tunica intima","Artery - Coronary",5.37,4.1],["ovarian stroma-corpus albicans","Ovary",4.51,9.4],["squamous epithelium-tissue edge","Cervix - Ectocervix",3.42,null],["mucosa epithelium-muscularis","Small Intestine - Terminal Ileum",3.29,10.9],["muscularis-fibromuscular tissue","Fallopian Tube",3.26,null],["pancreatic parenchyma-pancreatic parenchyma autolysed","Pancreas",3.07,4.1],["endometrium-Anatomical_cluster_3","Uterus",-2.92,2.7],["Anatomical_cluster_5-renal glomeruli","Kidney - Medulla",-3.05,null],["muscularis-submucosa","Small Intestine - Terminal Ileum",-3.08,7.5],["mucosa-connective tissue and adipose tissue","Minor Salivary Gland",-3.19,null],["muscularis-mucosa","Fallopian Tube",-3.33,null],["mucosa epithelium-lymphoid Peyer pathches","Small Intestine - Terminal Ileum",-3.37,4.8],["fibromuscular tissue-muscularis","Fallopian Tube",-3.91,null],["ovarian stroma-ovarian cortex","Ovary",-4.58,5.2],["myometrium-Anatomical_cluster_3","Uterus",-5.98,10.9],["mucosa-muscularis","Fallopian Tube",-7.57,2]],"rowFormat":"[domain pair, tissue, change in border contact per decade, approx -log10 p or null when the marker is below the legend minimum]","reading":"Contacts that rise with age: Fallopian tube mucosa - fibromuscular tissue (+9.3), uterus myometrium - endometrium (+6.0), coronary artery adipose tissue with tunica media (+5.5) and with tunica intima (+5.4), ovary stroma - corpus albicans (+4.5), small intestine mucosa epithelium - muscularis (+3.3). Contacts that fall: Fallopian tube mucosa - muscularis (-7.6) and fibromuscular tissue - muscularis (-3.9), uterus myometrium - anatomical cluster 3 (-6.0), ovary stroma - cortex (-4.6), small intestine mucosa epithelium - lymphoid Peyer patches (-3.4) and muscularis - submucosa (-3.1)."},"motifCounts":{"source":"image20 panel c","x":"Motif count across tissues","rows":[{"motif":["connective tissue","lining epithelium"],"count":13},{"motif":["connective tissue","smooth muscle"],"count":12},{"motif":["connective tissue","glandular tissue"],"count":10},{"motif":["lining epithelium","smooth muscle"],"count":9},{"motif":["connective tissue","lining epithelium","smooth muscle"],"note":"three-node motif (triangle)","count":9},{"motif":["cardiac muscle","connective tissue"],"count":3},{"motif":["adipose tissue","connective tissue"],"count":2}]},"borderProportionExample":{"source":"image20 panel d","what":"The \"proportion of touching border\" is directed: of a domain pair in a small-intestine section (submucosa, lymphoid aggregate) 27% on the arrow pointing up to submucosa and 4% on the arrow pointing down to lymphoid. Which direction is which follows the arrowheads: the lymphoid aggregate has about 27% of its border against submucosa; submucosa has about 4% of its border against the aggregate.","values":{"lymphoid->submucosa":0.27,"submucosa->lymphoid":0.04}},"fallopianTubeDomainMix":{"source":"image20 panel h (pixel share of the three drawn colours in each section map)","legend":{"fibromuscular tissue":"#1878b6","mucosa":"#29a249","muscularis":"#f57e20"},"ages":{"20-29":{"fibromuscular tissue":0.2,"mucosa":0.4,"muscularis":0.4},"40-49":{"fibromuscular tissue":0.43,"mucosa":0.42,"muscularis":0.15},"60-69":{"fibromuscular tissue":0.65,"mucosa":0.13,"muscularis":0.21,"other (red specks)":0.02}},"shape":"a round tube cross-section: young: green mucosa core, orange muscularis ring, thin blue rim; old: the blue fibromuscular tissue fills most of the section, green mucosa shrinks to a small patch","note":"single sections, one each, not averages"},"hierarchyNetwork":{"source":"image20 panel a","description":"Four-level graph: organs (dark green nodes, 29 of them: Muscle, Adipose, Skin, Uterus, Ovary, Fallopian Tube, Cervix, Vagina, Breast, Artery, Heart, Kidney, Spleen, Bladder, Prostate, Testis, Liver, Pancreas, Thyroid, Adrenal Gland, Lung, Minor Salivary Gland, Stomach, Esophagus, Colon, Small Intestine, Pituitary, Nerve, Brain) joined to their tissues (light green, e.g. Heart - Left Ventricle, Colon - Sigmoid, Skin - Not Sun Exposed), and to ten tissue-type hubs (pink-red: connective tissue (by far the biggest hub), lining epithelium, vascular tissue, adipose tissue, lymphoid structure, glandular tissue, neuronal tissue, cardiac muscle, skeletal muscle, smooth muscle) which carry the domains (light blue discs, sized by an unstated quantity; roughly 90 to 100 of them, not counted exactly, e.g. mucosa epithelium, tunica intima, ovarian stroma, seminiferous tubules). Edge weights are not readable (thin grey curves) and which hub each organ line ends at is only approximately readable."}},"pathology":{"source":"image19 panels c, e, f (not asked for explicitly; read because they compare age and pathology)","c":{"xLabel":"Abundance change","yLabel":"Morphological change","xClip":"values beyond +-0.4 are drawn at +-0.4 (four dots sit exactly at x = 0.4, one at -0.4)","guides":"light dashed lines at x = -0.2 and +0.2 and at y = 70; solid grey dashed at x = 0","legend":{"grey":"stable with pathology","red":"morphology and abundance changes","purple":"abundance changes","green":"morphology changes"},"greyCount":"about 100 (85 separable blobs, many overlapping near (0, 20))","labelled":[["connective tissue (Testis, atrophy)","red",0.284,141],["fibroadipose tissue (Muscle, atrophy)","red",0.4,123],["seminiferous tubules (Testis, atrophy)","red",-0.294,103],["connective tissue (Liver, cirrhosis)","red",0.263,93],["portal vein (Liver, congestion)","red",-0.4,75],["connective tissue (Thyroid, hashimoto)","green",0.184,145],["skeletal muscle (Muscle, atrophy)","green",-0.159,101],["stroma (Spleen, congestion)","green",-0.061,98],["connective tissue (Testis, fibrosis)","green",0.132,90],["pancreatic parenchyma (Pancreas, saponification)","green",-0.048,77],["portal vein (Liver, cirrhosis)","purple",0.273,69],["liver parenchyma (Liver, cirrhosis)","purple",-0.233,57],["liver parenchyma (Liver, steatosis)","purple",-0.308,50],["fibromuscular tissue (Breast, gynecomastoid)","purple",0.4,48],["thyroid follicles (Thyroid, hashimoto)","purple",-0.265,47],["connective tissue (Lung, fibrosis)","purple",0.222,34],["portal vein (Liver, steatosis)","purple",0.4,31],["fibromuscular tissue (Breast, hyperplasia)","purple",0.226,29],["portal vein (Liver, fibrosis)","purple",0.4,28.5],["connective tissue (Pancreas, atrophy)","purple",0.351,20],["ductal tissue (Breast, atrophy)","purple",0.274,13.6],["adipose tissue (Breast, fibrosis)","purple",-0.215,9.3]],"unlabelledPurple":[[0.217,16.9],[0.211,13.9]],"rowFormat":"[label, colour class, abundance change, morphological change]"},"f":{"xLabel":"Correlation score (Age vs. Pathology effect)","bars":[["calcification",0.97],["sclerotic",0.67],["atherosclerosis",0.54],["atherosis",0.18],["gastritis",0.02],["atrophy",0.04],["fibrosis",0],["congestion",0],["cyst",0],["esophagitis",0],["desquamation",0],["hyperplasia",-0.09],["inflammation",-0.27]],"note":"bar ends measured against the printed ticks (-0.2 to 1.0); zeros are bars too short to see"},"e":{"xLabel":"Effect of Age on Domain Abundance (Slope, delta abundance per decade)","yLabel":"Effect of Pathology on Domain Abundance (Coefficient from GLM)","guides":"dashed lines at x = 0, +-0.5 and y = 0, +-0.5","legend":{"grey":"Stable","red":"Pathology-only","blue":"Age-only","green":"Both age & pathology"},"clip":"x clipped at 3.5 (two ovary corpus albicans dots: atrophy at y +0.08, cyst at y -0.48)","counts":"about 23 red, 13 green detected; blue and grey dots are too many and overlap (many tens to a few hundred); labels overlap heavily so only a few are matched to dots","examples":[["connective tissue (Muscle, atrophy)","red",0.23,2.72],["portal vein (Liver, steatosis)","red",-0.24,2.19],["calcified plaques (Artery, calcification)","green",1.08,2.22],["calcified plaques (Artery, calcification)","green",0.71,1.73],["calcified plaques (Artery, sclerotic)","green",0.71,1.64],["calcified plaques (Artery, monckeberg)","green",0.7,1.35],["calcified plaques (Artery, atherosclerosis)","green",0.71,1.15],["muscle (Thyroid, goiter)","red",-0.38,-3.98],["muscle (Thyroid, nodularity)","red",-0.38,-3.53],["myocardium (Artery, fibrosis)","green",-0.55,-3.83],["fibrotic myocard (Heart, infarction)","red",0.01,-3.86]],"rowFormat":"[label, colour class, age effect (slope), pathology effect (GLM coefficient)]"}},"notes":["Atlas: shares are pixel shares of each segmentation map by legend colour (palette match within a small tolerance, my boxes drawn by eye), so rounded to 0.01, and they include thin outline pixels; a share of 0 means a legend entry that is hardly drawn (thyroid cyst, heart fibroadipose tissue, ectocervix fibromuscular tissue, adipose blood vessels). The small-intestine map looks cut off along its left edge in the figure itself.","Atlas colours differ from section to section (each tissue reuses a tab10-like palette: blue #1a78b6, orange #f58020, green #2ca249, red #d82a2a, purple #9268ad, brown #8c574c, pink #d87ab2, grey #939598); the same colour means different domains in different tissues. Legend spellings kept as printed (Peyer's pathches, medula, adventita subserosa, Anatomical_cluster).","Check on the brief: the atlas pituitary map is 83% adenohypophysis (blue), matching the 82.6% in the talk, so atlas shares look right.","Volcano: all 27 labelled dots and 4 unlabelled significant dots were located by pixel analysis against the axis ticks (x +-0.01, y +-0.05). The y axis is a natural log although labelled -log (see yScaleNote). Tissue names come from panels d/e dot colours and their legend; four dots have uncertain tissue (connective tissue +1.26 light purple, endometrium inferred, and the four unlabelled ones). 31 significant dots in total; the number of non-significant dots is only an estimate.","The drawn regression lines in 18f-h do not have the slopes printed in the same panels (four are 35 to 60% steeper than the printed slope (f, both Testis panels, Vagina), two are 6% and 15% shallower (g, adenohypophysis)), the label slope is probably from a model with covariates. The line values are what is drawn; use the printed slope as the paper number. Panel f line: 43.1% to 35.6%, near the talk numbers 42.9 to 34.5 for the GI submucosa.","The talk numbers for the ovary (1.4% to 11.89%) are not what panel g draws (0 at 25 y.o. to 0.15 at 70); the straight line reaches 0.151 at 70, and the individual slides spread to 0.6. The pituitary numbers differ by a factor of 2 (see its trajectory note). I cannot say which is \"right\"; I only report the figure.","Image19 b curves: read in 5-year steps (points = every 10 years as asked, pointsMid = 25, 35, ... 65); band edges are the drawn shaded band, which dips below 0. The tissue is not named in the panel (the schematic is a vessel); y is \"Domain abundance (%)\" with axes 0 to 5 (calcified plaques), 0 to 0.6+ (atherosis), 0 to 0.6+ (infarct tissue), 0 to 1.0+ (inflammatory aggregates and hemorrhage).","Image20 coronary-artery networks (panel i): edge widths measured by pixel analysis along each node pair (grey #939598 lines, node centres from the coloured discs). The smooth muscle - connective tissue edge is very thick and short (the nodes overlap and the text covers part of it), so its width (12 to 14 px) is the least certain; it is the thickest edge in every panel and I used it as weight 1.0. Other edges 1 to 4 px (+-0.5). Edges can hide behind nodes: lines from connective tissue to adipose tissue or cardiac muscle pass through the smooth-muscle disc, so I tested each node pair for a line along the whole centre-to-centre path (an edge counted only if it is visible beside the discs). Widths may be normalised per panel (the thickest is always the same), so only the relative ranking inside a panel is safe, not the absolute change of one edge between ages.","Panel i reading: adipose tissue contacts with smooth muscle and with connective tissue thicken with age (about 0.21 to 0.29 and absent to 0.30 of the thickest edge) and adipose tissue - cardiac muscle goes 0.11, 0.19, 0.12 and is absent from 50-59 on; the cardiac muscle links with smooth muscle and connective tissue peak at 30-39 and fall after. This agrees in sign with panel e (coronary artery adipose tissue with tunica media and intima +5.5 and +5.4 per decade), but panel e uses domain names, not tissue types.","Not in image20: no stomach-versus-uterus pair of networks and no organ-clustering dendrogram. Panel b shows Stomach, Small intestine (terminal ileum), Breast and Minor salivary gland; the uterus appears only in panel e (domain pairs) and its colour legend. If stomach vs uterus is on another slide it is in a figure I was not given.","Not read: individual slide dots in the trajectory scatter plots; the mean-combined-score definition; image17; node sizes in image20 panel a; the H&E images themselves. Image18 panel i has no unit for Density_domain and its domain is not printed (title says Colon - Transverse, or submucosa Stomach).","Panel e of image20: -log10 p values are estimated from marker sizes only; markers below the legend minimum (2.5) are given as null. The x axis of that panel is clipped at 10 (label cut off) and the units of border contact are as printed (no unit word)."]}};

// Small 3D organ models for the microanatomy story: one lit procedural mesh for each of MICRO_DATA's 29 organs (the
// heart, brain, lungs ... and the vagina), each a signed distance field (spheres, ellipsoids, round cones and tubes
// blended softly, as the muscle story's heart is) polygonised by surface nets on a small grid. They stand in for the
// PET story's flat line icons: as real meshes in the scenes (the network's organ ring), and as small pictures in the
// HTML chips and the headset's canvas panels (each model drawn once onto a 2D canvas, lazily, by a tiny painter's
// renderer, so no WebGL context or render target is needed, also inside a headset session).
// ORGAN3D: ids, idOf(name), geo(id) (the mesh, built on first use), lite(id) (a lighter copy, for small on screen),
// merged(ids, opts) (one BufferGeometry, aSlot per model; opts.lite: the lighter copies), shader(n) (a lit material's GLSL with per-model place and look), canvas(id, px), url(id), step(ms) (build
// models and pictures ahead between frames, one organ after another), want(id) (that one next), mesh(id), pic(id) and
// picUrl(id) (without waiting: null until built), version(), ready(). Manifest: organs.md. SETS.organs is the
// harness's gallery (not part of the story).
const ORGAN3D = (() => {
  const PI = Math.PI, hyp = (x, y, z = 0) => Math.sqrt(x * x + y * y + z * z), clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  // ------------------------------------------------------------ distance primitives (after Inigo Quilez)
  const sph = (cx, cy, cz, r) => (x, y, z) => hyp(x - cx, y - cy, z - cz) - r;
  // an ellipsoid (a close bound), turned by rz about z and then ry about y
  const ell = (cx, cy, cz, rx, ry, rz, rotZ = 0, rotY = 0) => {
    const cz0 = Math.cos(rotZ), sz0 = Math.sin(rotZ), cy0 = Math.cos(rotY), sy0 = Math.sin(rotY);
    return (x, y, z) => {
      let px = x - cx, py = y - cy, pz = z - cz;
      const qx = px * cy0 - pz * sy0, qz = px * sy0 + pz * cy0; px = qx; pz = qz;
      const ux = px * cz0 + py * sz0, uy = -px * sz0 + py * cz0;
      const a = ux / rx, b = uy / ry, c = pz / rz, k0 = Math.sqrt(a * a + b * b + c * c), k1 = Math.sqrt(a * a / (rx * rx) + b * b / (ry * ry) + c * c / (rz * rz));
      return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
    };
  };
  // a cone with round ends from a (radius r1) to b (radius r2)
  const cone = (a, b, r1, r2) => {
    const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2], rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
    return (x, y, z) => {
      const px = x - a[0], py = y - a[1], pz = z - a[2], yy = px * ba[0] + py * ba[1] + pz * ba[2], zz = yy - l2;
      const qx = px * l2 - ba[0] * yy, qy = py * l2 - ba[1] * yy, qz = pz * l2 - ba[2] * yy, x2 = qx * qx + qy * qy + qz * qz;
      const kk = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zz) * a2 * zz * zz > kk) return Math.sqrt(x2 + zz * zz * l2) * il2 - r2;
      if (Math.sign(yy) * a2 * yy * yy < kk) return Math.sqrt(x2 + yy * yy * l2) * il2 - r1;
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
    };
  };
  const cap = (a, b, r) => cone(a, b, r, r);
  // a tube through points [x, y, z, r] (smoothed: a Catmull-Rom curve sampled into round cones)
  const tube = (pts, sub = 3) => {
    const P = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < sub; s++) {
        const t = s / sub, t2 = t * t, t3 = t2 * t;
        P.push([0, 1, 2, 3].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
      }
    }
    P.push(pts[pts.length - 1]);
    // (each piece with a bounding sphere: a piece that cannot be nearer than the best so far is skipped)
    const C = [], B = [];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      C.push(cone(a, b, a[3], b[3]));
      B.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) / 2 + Math.max(a[3], b[3])]);
    }
    return (x, y, z) => {
      let d = 1e9;
      for (let i = 0; i < C.length; i++) {
        const q = B[i], dx = x - q[0], dy = y - q[1], dz = z - q[2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) - q[3] >= d) continue;
        const v = C[i](x, y, z); if (v < d) d = v;
      }
      return d;
    };
  };
  // a rounded box (half sizes)
  const box = (cx, cy, cz, hx, hy, hz, r) => (x, y, z) => {
    const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
    return hyp(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const mirror = f => (x, y, z) => f(Math.abs(x), y, z);
  const scaleZ = (f, k) => (x, y, z) => f(x, y, z * k) / Math.max(1, k);

  // ------------------------------------------------------------ the organs
  // Each: parts [distance, colour, blend], optional cut (subtracted, with its blend), disp (a small displacement:
  // gyri, lobules, folds) and paint (stripes, layers). Local frame: x to the viewer's right, y up, z towards the
  // viewer; about [-1, 1]. Colours are natural (fresh tissue), a little brightened to read on the dark scene.
  const C = {
    flesh: '#c23a44', red: '#d4474f', vein: '#5b6bd2', pale: '#efe2d2', ureter: '#e8d2ad', yellow: '#f2d47e',
  };
  const ORG = {
    brain: { parts: [[ell(0.04, 0.16, 0, 0.92, 0.6, 0.7), '#e8b2b7'], [ell(0.22, -0.2, 0.05, 0.56, 0.3, 0.6), '#e8b2b7', 0.12],
      [ell(-0.62, -0.42, 0, 0.36, 0.24, 0.52), '#d49ba3', 0.06], [cone([-0.24, -0.34, 0], [-0.32, -0.92, 0], 0.12, 0.08), '#e6c2b6', 0.06]],
      cut: [[box(0, 0.5, 0, 1.2, 0.5, 0.022, 0.01), 0.04]],
      disp: (x, y, z) => (x > -0.4 || y > -0.1 ? 0.034 * Math.sin(8 * x + 2.2 * Math.sin(7 * y)) * Math.sin(8.5 * y + 2 * Math.sin(7 * z)) * Math.sin(7 * z + 1.7 * Math.sin(6 * x)) : 0.012 * Math.sin(40 * y)),
      view: [-15, 8], res: 28 },
    thyroid: { parts: [[ell(-0.42, 0.05, 0.12, 0.27, 0.6, 0.24, -0.25), '#b8424f'], [ell(0.42, 0.05, 0.12, 0.27, 0.6, 0.24, 0.25), '#b8424f'],
      [cap([-0.35, -0.22, 0.2], [0.35, -0.22, 0.2], 0.13), '#b8424f', 0.1], [cap([0, -1.0, -0.22], [0, 1.0, -0.22], 0.27), '#eadccf', 0.02]],
      paint: (x, y, z, c, part) => (part === 3 && Math.sin(y * 26) > 0.55 ? c.map(v => v * 0.8) : c), view: [-20, 10] },
    lungs: { parts: [[cone([-0.46, -0.48, 0], [-0.36, 0.56, 0], 0.44, 0.2), '#f19aa7', 0.25], [cone([0.46, -0.5, 0], [0.36, 0.52, 0], 0.42, 0.19), '#f19aa7', 0.25],
      [cap([0, 0.98, 0], [0, 0.28, 0], 0.1), C.pale, 0.05], [cap([0, 0.3, 0], [-0.3, 0.02, 0], 0.08), C.pale, 0.05], [cap([0, 0.3, 0], [0.3, 0.02, 0], 0.08), C.pale, 0.05]],
      cut: [[sph(0.18, -0.38, 0.25, 0.3), 0.1], [box(0, -0.1, 0, 0.1, 0.6, 0.6, 0.05), 0.12]],
      disp: (x, y, z) => 0.008 * Math.sin(30 * x) * Math.sin(30 * y), view: [-12, 6] },
    heart: { parts: [[ell(0.04, -0.14, 0.05, 0.5, 0.7, 0.48, 0.6), C.flesh], [cone([-0.12, 0.12, 0.08], [0.42, -0.68, 0.12], 0.46, 0.1), C.flesh, 0.18],
      [sph(-0.4, 0.34, -0.06, 0.31), '#b33748', 0.12], [sph(0.26, 0.42, -0.2, 0.28), '#b33748', 0.12],
      [tube([[-0.02, 0.3, -0.05, 0.17], [-0.02, 0.74, 0, 0.16], [0.2, 0.93, -0.02, 0.15], [0.42, 0.82, -0.12, 0.14], [0.5, 0.42, -0.28, 0.13]]), '#dd5a61', 0.06],
      [tube([[0.16, 0.24, 0.26, 0.15], [0.22, 0.6, 0.2, 0.14], [0.36, 0.74, 0.05, 0.12]]), '#6d77d6', 0.06],
      [cap([-0.38, 0.5, -0.08], [-0.38, 0.98, -0.08], 0.12), C.vein, 0.05]],
      view: [-10, 6] },
    liver: { parts: [[ell(-0.22, 0.04, 0, 0.88, 0.5, 0.56, -0.1), '#8e3b2d'], [ell(0.52, 0.12, 0.08, 0.5, 0.26, 0.4, 0.15), '#8e3b2d', 0.25],
      [ell(-0.12, -0.36, 0.38, 0.12, 0.2, 0.12, 0.4), '#6c9a46', 0.04]],
      cut: [[(x, y, z) => y + 0.3 - 0.22 * x, 0.18]], view: [-20, 18] },
    spleen: { parts: [[scaleZ(tube([[-0.55, -0.55, 0, 0.16], [-0.62, 0, 0, 0.3], [-0.3, 0.5, 0, 0.32], [0.2, 0.62, 0, 0.26], [0.6, 0.38, 0, 0.15]]), 1.6), '#7d3559']],
      disp: (x, y, z) => 0.012 * Math.sin(12 * x + 4 * y), view: [-15, 8] },
    pancreas: { parts: [[tube([[-0.8, -0.2, 0.05, 0.27], [-0.4, -0.06, 0, 0.22], [0.08, 0.04, 0, 0.19], [0.5, 0.18, -0.04, 0.16], [0.86, 0.34, -0.06, 0.12]]), '#e9b47c'],
      [tube([[-0.6, 0.38, 0.1, 0.12], [-1.0, 0.1, 0.12, 0.13], [-0.98, -0.42, 0.12, 0.13], [-0.5, -0.56, 0.12, 0.12], [-0.1, -0.42, 0.1, 0.11]]), '#e39790', 0.04]],
      disp: (x, y, z) => 0.032 * Math.sin(24 * x) * Math.sin(21 * y + 1) * Math.sin(23 * z + 2), view: [-10, 14] },
    kidney: { parts: [[(e => (h => (x, y, z) => smax(e(x, y, z), -h(x, y, z), 0.16))(sph(0.42, 0, 0, 0.27)))(ell(-0.1, 0, 0, 0.44, 0.72, 0.32)), '#9d3b37'], [tube([[0.22, 0, 0, 0.11], [0.4, -0.22, 0, 0.08], [0.36, -0.98, 0.02, 0.055]]), C.ureter, 0.06],
      [cap([0.2, 0.14, 0.02], [0.8, 0.18, 0.02], 0.065), C.red, 0.04], [cap([0.2, 0.04, 0.09], [0.8, 0.02, 0.12], 0.075), C.vein, 0.04]],
      view: [-10, 6] },
    adrenal: { parts: [[ell(0, 0.32, 0, 0.52, 0.36, 0.15), '#e8a63b'], [ell(-0.34, 0.06, 0, 0.3, 0.3, 0.15), '#e8a63b', 0.12], [ell(0.34, 0.06, 0, 0.3, 0.3, 0.15), '#e8a63b', 0.12],
      [ell(0, -0.6, -0.08, 0.52, 0.48, 0.32), '#9d3b37', 0.03]],
      disp: (x, y, z) => (y > -0.15 ? 0.018 * Math.sin(20 * x + 3) * Math.sin(18 * y) : 0), view: [-22, 14] },
    smallint: { parts: [[tube([[-0.7, 0.62, -0.1, 0.12], [-0.2, 0.74, 0.1, 0.12], [0.3, 0.56, 0.22, 0.12], [0.66, 0.66, -0.05, 0.12], [0.74, 0.3, 0.12, 0.12], [0.36, 0.24, -0.22, 0.12],
      [-0.08, 0.38, -0.1, 0.12], [-0.5, 0.26, 0.24, 0.12], [-0.78, 0.0, -0.06, 0.12], [-0.42, -0.14, -0.26, 0.12], [0.0, 0.0, 0.2, 0.12], [0.46, -0.08, 0.24, 0.12],
      [0.78, -0.32, -0.08, 0.12], [0.36, -0.46, -0.24, 0.12], [-0.06, -0.36, 0.1, 0.12], [-0.5, -0.5, 0.22, 0.12], [-0.7, -0.76, -0.1, 0.12], [-0.2, -0.84, 0.06, 0.12],
      [0.3, -0.78, 0.18, 0.12], [0.62, -0.66, 0.0, 0.12]], 3), '#ea9fa1']],
      disp: (x, y, z) => 0.006 * Math.sin(40 * x + 30 * y), view: [-14, 16] },
    colon: { parts: [[tube([[-0.62, -0.62, 0.05, 0.2], [-0.66, -0.1, 0, 0.19], [-0.6, 0.5, 0, 0.19], [-0.3, 0.68, 0.06, 0.18], [0.1, 0.6, 0.12, 0.18], [0.5, 0.66, 0.02, 0.17],
      [0.68, 0.4, 0, 0.16], [0.68, -0.2, 0, 0.16], [0.56, -0.62, 0.08, 0.15], [0.2, -0.56, 0.16, 0.14], [0.02, -0.74, 0.08, 0.13], [0, -1.0, 0, 0.12]], 5), '#d88a83'],
      [sph(-0.6, -0.78, 0.08, 0.17), '#d88a83', 0.1]],
      disp: (x, y, z) => 0.03 * Math.pow(Math.max(0, Math.sin((Math.abs(x) * 1.5 + y) * 15)), 2) - 0.012, view: [-10, 8] },
    muscle: { parts: [[cone([0, 0, 0], [0.05, 0.72, 0], 0.37, 0.11), '#c03b42', 0.25], [cone([0, 0, 0], [-0.05, -0.72, 0], 0.37, 0.11), '#c03b42', 0.25],
      [cap([0.05, 0.66, 0], [0.08, 1.0, 0], 0.07), C.pale, 0.05], [cap([-0.05, -0.66, 0], [-0.08, -1.0, 0], 0.07), C.pale, 0.05]],
      disp: (x, y, z) => (Math.abs(y) < 0.75 ? 0.014 * Math.sin(16 * Math.atan2(z, x)) : 0),
      paint: (x, y, z, c, part) => (part < 2 && Math.sin(16 * Math.atan2(z, x)) > 0.7 ? c.map(v => v * 0.82) : c), view: [-10, 6] },
    adipose: { parts: [[sph(0, 0, 0, 0.32), '#f5d98a'], [sph(0.42, 0.18, 0.05, 0.27), '#f5d98a', 0.07], [sph(-0.4, 0.2, -0.05, 0.28), '#f5d98a', 0.07], [sph(0.1, 0.5, 0.05, 0.25), '#f5d98a', 0.07],
      [sph(-0.2, -0.42, 0.1, 0.27), '#f5d98a', 0.07], [sph(0.36, -0.36, -0.05, 0.26), '#f5d98a', 0.07], [sph(-0.62, -0.18, 0.08, 0.22), '#f5d98a', 0.07], [sph(0.68, -0.08, 0.1, 0.21), '#f5d98a', 0.07],
      [sph(-0.28, 0.6, 0.0, 0.2), '#f5d98a', 0.07], [sph(0.15, 0.05, 0.38, 0.22), '#f5d98a', 0.07], [sph(-0.1, -0.1, -0.38, 0.25), '#f5d98a', 0.07],
      [tube([[-0.9, 0.7, 0.3, 0.035], [-0.4, 0.42, 0.35, 0.035], [0.1, 0.36, 0.42, 0.03], [0.5, 0.3, 0.32, 0.03]]), C.red, 0.02]], view: [-15, 10] },
    artery: { parts: [[tube([[-0.46, -0.95, 0.1, 0.19], [-0.46, 0.1, 0.1, 0.19], [-0.22, 0.58, 0, 0.18], [0.22, 0.58, -0.06, 0.17], [0.46, 0.15, -0.1, 0.16], [0.46, -0.95, -0.1, 0.15]]), '#d84a52'],
      [cap([-0.2, 0.6, 0], [-0.26, 1.0, 0], 0.075), '#d84a52', 0.06], [cap([0.0, 0.66, -0.03], [0.0, 1.0, -0.03], 0.065), '#d84a52', 0.06], [cap([0.18, 0.62, -0.05], [0.26, 1.0, -0.05], 0.065), '#d84a52', 0.06]],
      cut: [[(x, y, z) => y + 0.9, 0.02], [(x, y, z) => Math.max(hyp(x + 0.46, z - 0.1) - 0.1, y + 0.75), 0.02], [(x, y, z) => Math.max(hyp(x - 0.46, z + 0.1) - 0.08, y + 0.75), 0.02]],
      paint: (x, y, z, c) => (y < -0.86 ? hex('#f3d08a') : c), view: [-10, 14] },
    bladder: { parts: [[ell(0, 0.05, 0, 0.62, 0.55, 0.55), '#e6ad9c'], [cone([0, -0.42, 0], [0, -0.92, 0], 0.18, 0.07), '#e6ad9c', 0.12],
      [tube([[-0.42, 0.22, -0.22, 0.06], [-0.7, 0.6, -0.26, 0.055], [-0.74, 1.0, -0.26, 0.05]]), C.ureter, 0.05], [tube([[0.42, 0.22, -0.22, 0.06], [0.7, 0.6, -0.26, 0.055], [0.74, 1.0, -0.26, 0.05]]), C.ureter, 0.05]],
      cut: [[sph(0, 0.85, 0.1, 0.42), 0.25]], view: [-12, 12] },
    breast: { parts: [[ell(0, 0, 0, 0.74, 0.68, 0.5), '#f0c2aa'], [sph(0, -0.06, 0.49, 0.075), '#b8775f', 0.05], [box(0, 0, -0.12, 0.92, 0.88, 0.09, 0.04), '#e6b49c', 0.06]],
      cut: [[(x, y, z) => z + 0.05, 0.08]], paint: (x, y, z, c) => (z > 0.2 && hyp(x, y + 0.06) < 0.2 ? hex('#c98a70') : c), view: [-55, 10] },
    cervix: { parts: [[cap([0, 0.02, -0.45], [0, 0, 0.45], 0.5), '#e5a2ad'], [cone([0, 0.2, -0.55], [0, 0.42, -0.7], 0.5, 0.36), '#df8f9e', 0.15]],
      cut: [[ell(0, 0, 0.94, 0.16, 0.07, 0.16), 0.05]], paint: (x, y, z, c) => (z > 0.8 && hyp(x, y) < 0.24 ? hex('#cf7f8f') : c), view: [-25, 18] },
    esophagus: { parts: [[tube([[0, 1.0, 0, 0.21], [0.06, 0.4, 0.05, 0.21], [-0.04, -0.3, 0.02, 0.2], [0.08, -0.85, 0.06, 0.22], [0.25, -1.0, 0.1, 0.28]]), '#dc8a8c']],
      cut: [[(x, y, z) => 0.95 - y, 0.02], [(x, y, z) => Math.max(hyp(x, z) - 0.09 - 0.03 * Math.cos(6 * Math.atan2(z, x)), 0.82 - y), 0.02]],
      disp: (x, y, z) => 0.01 * Math.sin(30 * y), paint: (x, y, z, c) => (y > 0.9 && hyp(x, z) < 0.18 ? hex('#f0b8b8') : c), view: [-10, 28] },
    fallopian: { parts: [[tube([[-0.95, -0.38, 0, 0.09], [-0.45, 0.12, 0.05, 0.09], [0.1, 0.38, 0.05, 0.1], [0.55, 0.28, 0, 0.13]]), '#e8a3b7'],
      [cone([0.55, 0.28, 0], [0.82, -0.04, 0.05], 0.13, 0.28), '#e8a3b7', 0.08],
      ...[0, 1, 2, 3, 4, 5].map(k => { const a = -1.9 + k * 0.55; return [cap([0.86 + 0.18 * Math.cos(a), -0.08 + 0.18 * Math.sin(a), 0.05], [0.86 + 0.42 * Math.cos(a), -0.08 + 0.42 * Math.sin(a), 0.05 + 0.04 * Math.sin(3 * k)], 0.045), '#eab0c2', 0.04]; }),
      [ell(0.32, -0.42, 0.12, 0.24, 0.15, 0.15, 0.3), '#f1cbc3', 0.02]],
      cut: [[sph(0.92, -0.12, 0.12, 0.16), 0.05]], view: [-12, 10] },
    salivary: { parts: [[tube([[0, 0.95, 0, 0.06], [0, 0.45, 0, 0.055], [-0.1, 0.1, 0, 0.045]]), C.pale],
      ...[[-0.35, 0.3, 0.05], [0.3, 0.32, 0], [-0.1, 0.05, 0.25], [0.18, 0.02, -0.2], [-0.45, -0.1, -0.1], [0.45, -0.08, 0.12], [-0.2, -0.38, 0.12], [0.2, -0.4, -0.05],
        [0, -0.68, 0.06], [-0.5, -0.5, 0.0], [0.52, -0.46, 0.0], [0.05, 0.38, 0.22], [-0.08, -0.12, -0.32]].map(p => [sph(p[0], p[1], p[2], 0.21), '#e6b08c', 0.05])],
      disp: (x, y, z) => 0.012 * Math.sin(28 * x) * Math.sin(26 * y) * Math.sin(27 * z), view: [-15, 10] },
    nerve: { parts: [[(c => (x, y, z) => smax(c(x, y, z), x - 0.5, 0.03))(cap([-0.8, 0, 0], [0.7, 0, 0], 0.34)), '#e9cf86'],
      ...[[0, 0], [0.17, 0.05], [-0.15, 0.1], [0.05, -0.17], [-0.12, -0.12], [0.16, -0.12], [0.02, 0.18]].map(([py, pz]) => [cap([0.2, py, pz], [0.84, py * 1.1, pz * 1.1], 0.085), '#f6ebbe', 0.01])],
      view: [-34, 12] },
    ovary: { parts: [[ell(0, 0, 0, 0.78, 0.48, 0.44, 0.15), '#f0c2bc'], ...[[0.35, 0.3, 0.2, 0.15], [-0.4, 0.26, 0.18, 0.12], [0.05, 0.36, 0.28, 0.1], [-0.15, -0.18, 0.4, 0.13], [0.5, -0.12, 0.3, 0.11], [-0.6, -0.02, 0.22, 0.09]]
      .map(p => [sph(p[0], p[1], p[2], p[3]), '#f8d9cf', 0.06])], paint: (x, y, z, c) => (hyp(x + 0.3, y + 0.25, z - 0.25) < 0.16 ? hex('#fbf0e4') : c), view: [-15, 12] },
    pituitary: { parts: [[sph(0, -0.3, 0.16, 0.42), '#d8858d'], [sph(0, -0.22, -0.26, 0.3), '#ead0b6', 0.1], [cone([0, 0.04, -0.18], [0, 0.98, -0.08], 0.13, 0.08), '#ead0b6', 0.1]],
      view: [-55, 12] },
    prostate: { parts: [[cone([0, 0.3, 0], [0, -0.55, 0.05], 0.62, 0.24), '#cf8e7e', 0.15], [cap([0, 1.0, 0], [0, -1.0, 0.06], 0.09), C.pale, 0.04],
      [ell(-0.46, 0.56, -0.32, 0.33, 0.14, 0.14, 0.5), '#e0b48f', 0.05], [ell(0.46, 0.56, -0.32, 0.33, 0.14, 0.14, -0.5), '#e0b48f', 0.05]],
      disp: (x, y, z) => 0.015 * Math.sin(12 * x) * Math.sin(14 * y), view: [-14, 12] },
    skin: { parts: [[box(0, -0.18, 0, 0.86, 0.52, 0.6, 0.06), '#f2aba2'],
      ...[[-0.5, 0.1], [-0.1, -0.25], [0.25, 0.2], [0.55, -0.2]].map(([px, pz]) => [cap([px, -0.05, pz], [px + 0.2, 0.7, pz + 0.12], 0.022), '#4a3a32', 0.005])],
      disp: (x, y, z) => (y > 0.2 ? 0.03 * Math.sin(9 * x) * Math.sin(7 * z) : 0),
      paint: (x, y, z, c, part) => (part > 0 ? c : y > 0.26 ? hex('#e9be97') : y < -0.32 ? (Math.sin(20 * x) * Math.sin(20 * z) > 0.2 ? hex('#f6dd8c') : hex('#efcf78')) : c), view: [-25, 22] },
    stomach: { parts: [[tube([[-0.18, 1.0, 0, 0.1], [-0.08, 0.72, 0, 0.17], [0.25, 0.64, 0, 0.42], [0.22, 0.12, 0, 0.46], [0.04, -0.36, 0, 0.38], [-0.36, -0.56, 0, 0.27], [-0.7, -0.42, 0, 0.14], [-0.92, -0.2, 0, 0.12]]), '#e39498']],
      disp: (x, y, z) => 0.006 * Math.sin(30 * x + 20 * y), view: [-10, 6] },
    testis: { parts: [[ell(0, 0, 0, 0.42, 0.62, 0.45, -0.15), '#f0d4c6'], [tube([[0.32, 0.62, -0.08, 0.14], [0.46, 0.2, -0.26, 0.11], [0.4, -0.36, -0.26, 0.1], [0.24, -0.66, -0.14, 0.08]]), '#d79a95', 0.06],
      [tube([[0.24, -0.66, -0.14, 0.05], [0.4, -0.5, -0.36, 0.05], [0.42, 0.2, -0.45, 0.05], [0.32, 1.0, -0.4, 0.05]]), '#e8cfae', 0.03]], view: [-40, 8] },
    uterus: { parts: [[scaleZ(cone([0, 0.32, 0], [0, -0.52, 0], 0.5, 0.22), 1.35), '#e38e9c', 0.2], [cap([0, -0.5, 0], [0, -0.86, 0], 0.18), '#e7a2ad', 0.08],
      [tube([[-0.4, 0.5, 0, 0.07], [-0.72, 0.6, 0, 0.06], [-0.95, 0.38, 0.02, 0.06], [-0.92, 0.14, 0.04, 0.1]]), '#ecaabd', 0.05],
      [tube([[0.4, 0.5, 0, 0.07], [0.72, 0.6, 0, 0.06], [0.95, 0.38, 0.02, 0.06], [0.92, 0.14, 0.04, 0.1]]), '#ecaabd', 0.05],
      [ell(-0.66, 0.16, 0.06, 0.18, 0.12, 0.12, 0.4), '#f2cdc4', 0.02], [ell(0.66, 0.16, 0.06, 0.18, 0.12, 0.12, -0.4), '#f2cdc4', 0.02]], view: [-12, 10] },
    vagina: { parts: [[scaleZ(cone([0, 0.62, 0], [0, -0.86, 0], 0.3, 0.36), 1.3), '#e39aa5', 0.1], [sph(0, 0.72, 0, 0.3), '#e5a2ad', 0.1]],
      cut: [[(x, y, z) => y + 0.95, 0.02], [(x, y, z) => Math.max(hyp(x, z * 1.8) - 0.16, y + 0.7), 0.04]],
      disp: (x, y, z) => 0.014 * Math.sin(34 * y), paint: (x, y, z, c, part) => (part === 1 && y > 0.85 && hyp(x, z) < 0.08 ? hex('#c9737f') : c), view: [-20, 22] },
  };
  // MICRO_DATA's organs by name -> model
  const BYNAME = { 'adipose': 'adipose', 'adrenal gland': 'adrenal', 'artery': 'artery', 'bladder': 'bladder', 'brain': 'brain', 'breast': 'breast', 'cervix': 'cervix',
    'colon': 'colon', 'esophagus': 'esophagus', 'fallopian tube': 'fallopian', 'heart': 'heart', 'kidney': 'kidney', 'liver': 'liver', 'lung': 'lungs',
    'minor salivary gland': 'salivary', 'muscle': 'muscle', 'nerve': 'nerve', 'ovary': 'ovary', 'pancreas': 'pancreas', 'pituitary': 'pituitary',
    'prostate': 'prostate', 'skin': 'skin', 'small intestine': 'smallint', 'spleen': 'spleen', 'stomach': 'stomach', 'testis': 'testis', 'thyroid': 'thyroid',
    'uterus': 'uterus', 'vagina': 'vagina' };
  const ids = Object.keys(ORG);
  const idOf = name => BYNAME[String(name || '').trim().toLowerCase()] || null;
  for (const id of ids) { const o = ORG[id]; o.parts = o.parts.map(p => ({ f: p[0], c: hex(p[1]), k: p[2] || 0.06 })); o.cut = (o.cut || []).map(c => ({ f: c[0], k: c[1] })); }

  // the field, and the colour where a point lies (the nearest part's, blended softly near seams)
  const dv = new Float64Array(24);
  function field(o, x, y, z) {
    const P = o.parts;
    let d = 1e9;
    for (let i = 0; i < P.length; i++) { const v = P[i].f(x, y, z); dv[i] = v; d = i ? smin(d, v, P[i].k) : v; }
    for (const c of o.cut) d = smax(d, -c.f(x, y, z), c.k);
    return o.disp ? d + o.disp(x, y, z) : d;
  }
  let fieldLast = 0;
  function colourAt(o, x, y, z) {
    fieldLast = field(o, x, y, z);
    const P = o.parts;
    let m = 1e9, mi = 0;
    for (let i = 0; i < P.length; i++) if (dv[i] < m) { m = dv[i]; mi = i; }
    const c = [0, 0, 0];
    let ws = 0;
    for (let i = 0; i < P.length; i++) { const w = Math.exp(-(dv[i] - m) / 0.025); ws += w; for (let q = 0; q < 3; q++) c[q] += P[i].c[q] * w; }
    let col = c.map(v => v / ws);
    if (o.paint) col = o.paint(x, y, z, col, mi);
    return col;
  }

  // ------------------------------------------------------------ surface nets
  // a coarse pass finds the box the organ fills; then a grid of about RES cells along its longest side is sampled,
  // each cell the surface crosses gets a vertex (the mean of the crossings, pulled onto the surface), and a quad joins
  // the four cells round every crossed grid edge. Normals from the field's gradient; colours darkened in creases (how
  // far the field stays below the distance a little way out along the normal)
  const MESH = {};
  function* polygonise(id, RES = ORG[id].res || 24) {
    const o = ORG[id], f = (x, y, z) => field(o, x, y, z);
    // (the coarse grid's values also spare the fine grid: a fine point in a coarse cell far from the surface takes its sign)
    const cg = 16, ch = 2.4 / cg, c1 = cg + 1, CF = new Float32Array(c1 * c1 * c1), lo = [9, 9, 9], hi = [-9, -9, -9];
    for (let i = 0; i <= cg; i++) for (let j = 0; j <= cg; j++) for (let k = 0; k <= cg; k++) {
      const x = -1.2 + i * ch, y = -1.2 + j * ch, z = -1.2 + k * ch, d = CF[(i * c1 + j) * c1 + k] = f(x, y, z);
      if (d < ch) { const p = [x, y, z]; for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], p[q] - ch); hi[q] = Math.max(hi[q], p[q] + ch); } }
      if (k === cg) yield;   // (a row at a time: a whole pass of an intricate organ took up to 0.1 s)
    }
    const far = new Int8Array(cg * cg * cg), M = 1.9 * ch;
    for (let i = 0; i < cg; i++) for (let j = 0; j < cg; j++) for (let k = 0; k < cg; k++) {
      let s = 0;
      for (let c = 0; c < 8; c++) { const v = CF[((i + (c & 1)) * c1 + j + (c >> 1 & 1)) * c1 + k + (c >> 2 & 1)]; s += v > M ? 1 : v < -M ? -1 : 0; }
      far[(i * cg + j) * cg + k] = s === 8 ? 1 : s === -8 ? -1 : 0;
    }
    const h = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / RES;
    const nx = Math.ceil((hi[0] - lo[0]) / h) + 2, ny = Math.ceil((hi[1] - lo[1]) / h) + 2, nz = Math.ceil((hi[2] - lo[2]) / h) + 2;
    for (let q = 0; q < 3; q++) lo[q] -= h * 0.5;
    const F = new Float32Array(nx * ny * nz), id3 = (i, j, k) => (i * ny + j) * nz + k, cc = v => Math.min(cg - 1, Math.max(0, Math.floor((v + 1.2) / ch)));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
      const x = lo[0] + i * h, y = lo[1] + j * h, z = lo[2] + k * h, fr = far[(cc(x) * cg + cc(y)) * cg + cc(z)];
      F[id3(i, j, k)] = fr ? fr * M : f(x, y, z);
      if (k === nz - 1) yield;   // (a row at a time, so a slice of 3 ms stays near 3 ms)
    }
    const VI = new Int32Array(nx * ny * nz).fill(-1), P = [], N = [], Cl = [];
    const EG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], cv = new Float64Array(8), e = 0.004;
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) for (let k = 0; k < nz - 1; k++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) { cv[c] = F[id3(i + (c & 1), j + (c >> 1 & 1), k + (c >> 2 & 1))]; if (cv[c] < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, ne = 0;
      for (const [a, b] of EG) {
        if ((cv[a] < 0) === (cv[b] < 0)) continue;
        const t = cv[a] / (cv[a] - cv[b]);
        sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; ne++;
      }
      let x = lo[0] + (i + sx / ne) * h, y = lo[1] + (j + sy / ne) * h, z = lo[2] + (k + sz / ne) * h;
      // (the gradient from four samples on a tetrahedron; the colour from the value's own evaluation; one look outwards
      // for the creases)
      const col = colourAt(o, x, y, z), d = fieldLast;
      const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), w = f(x + e, y + e, z + e);
      const gx = a - b - c + w, gy = -a - b + c + w, gz = -a + b - c + w, gl = hyp(gx, gy, gz) || 1;
      const nxv = gx / gl, nyv = gy / gl, nzv = gz / gl, pull = clamp(d, -h * 0.5, h * 0.5);
      x -= nxv * pull; y -= nyv * pull; z -= nzv * pull;
      const oc = Math.max(0, 0.14 - f(x + nxv * 0.14, y + nyv * 0.14, z + nzv * 0.14));
      const ko = clamp(1 - 4.6 * oc, 0.42, 1);
      VI[id3(i, j, k)] = P.length / 3; P.push(x, y, z); N.push(nxv, nyv, nzv); Cl.push(col[0] * ko, col[1] * ko, col[2] * ko);
      if (P.length % 60 === 0) yield;
    }
    const I = [];
    const quad = (a, b, c, d, dir, axis) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      // wound to face out: compare the quad's normal with the crossing's direction
      const ux = P[3 * c] - P[3 * a], uy = P[3 * c + 1] - P[3 * a + 1], uz = P[3 * c + 2] - P[3 * a + 2], vx = P[3 * d] - P[3 * b], vy = P[3 * d + 1] - P[3 * b + 1], vz = P[3 * d + 2] - P[3 * b + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx][axis];
      if (n * dir >= 0) I.push(a, b, c, a, c, d); else I.push(a, c, b, a, d, c);
    };
    for (let i = 1; i < nx - 1; i++) for (let j = 1; j < ny - 1; j++) for (let k = 1; k < nz - 1; k++) {
      const v0 = F[id3(i, j, k)];
      if (i < nx - 1 && (v0 < 0) !== (F[id3(i + 1, j, k)] < 0)) quad(VI[id3(i, j - 1, k - 1)], VI[id3(i, j, k - 1)], VI[id3(i, j, k)], VI[id3(i, j - 1, k)], v0 < 0 ? 1 : -1, 0);
      if (j < ny - 1 && (v0 < 0) !== (F[id3(i, j + 1, k)] < 0)) quad(VI[id3(i - 1, j, k - 1)], VI[id3(i - 1, j, k)], VI[id3(i, j, k)], VI[id3(i, j, k - 1)], v0 < 0 ? 1 : -1, 1);
      if (k < nz - 1 && (v0 < 0) !== (F[id3(i, j, k + 1)] < 0)) quad(VI[id3(i - 1, j - 1, k)], VI[id3(i, j - 1, k)], VI[id3(i, j, k)], VI[id3(i - 1, j, k)], v0 < 0 ? 1 : -1, 2);
    }
    // centred and scaled to fit a unit sphere
    let cx = 0, cy = 0, cz = 0, r = 0;
    const nv = P.length / 3;
    for (let v = 0; v < nv; v++) { cx += P[3 * v]; cy += P[3 * v + 1]; cz += P[3 * v + 2]; }
    cx /= nv || 1; cy /= nv || 1; cz /= nv || 1;
    for (let v = 0; v < nv; v++) r = Math.max(r, hyp(P[3 * v] - cx, P[3 * v + 1] - cy, P[3 * v + 2] - cz));
    const pos = new Float32Array(P.length);
    for (let v = 0; v < nv; v++) { pos[3 * v] = (P[3 * v] - cx) / r; pos[3 * v + 1] = (P[3 * v + 1] - cy) / r; pos[3 * v + 2] = (P[3 * v + 2] - cz) / r; }
    return { pos, nrm: new Float32Array(N), col: new Float32Array(Cl), idx: I.length > 65535 ? new Uint32Array(I) : new Uint16Array(I), view: o.view || [-15, 10] };
  }
  // a model now (finishing one under way), or built ahead between frames, in slices of at most ms milliseconds
  const JOB = {};
  const run = (id, until) => {
    const g = JOB[id] || (JOB[id] = polygonise(id));
    for (;;) { const r = g.next(); if (r.done) { MESH[id] = r.value; delete JOB[id]; return true; } if (performance.now() > until) return false; }
  };
  const geo = id => (!ORG[id] ? null : MESH[id] || (run(id, Infinity), MESH[id]));
  // the queue: each organ's model and then its picture, one organ after another, so pictures come one by one from the
  // start (not all at the end); want(id) puts an organ at the front (the one a pane or the body shows now)
  const QUEUE = ids.slice();
  let ver = 0;
  const want = id => { const i = QUEUE.indexOf(id); if (i > 0) { QUEUE.splice(i, 1); QUEUE.unshift(id); } };
  function step(ms) {
    const until = performance.now() + ms;
    while (QUEUE.length) {
      const id = QUEUE[0];
      if (!MESH[id]) { if (!run(id, until)) return false; ver++; }
      if (!drawPic(id, 64, until)) return false;
      QUEUE.shift(); ver++;
      if (performance.now() > until) break;
    }
    return !QUEUE.length;
  }
  const ready = () => ids.every(id => MESH[id]);
  const built = () => ids.filter(id => MESH[id]).length;

  // ------------------------------------------------------------ a lighter copy, for where a model is small on screen
  // (the atlas's 40 plates): its vertices merged on a grid twice as coarse as it was built on (vertex clustering: the
  // mean place, colour and normal of each cell's vertices; triangles that collapse are dropped), about a third of its
  // triangles. Made once, on first use, from the built model (no new field evaluations)
  const LITE = {};
  function lite(id) {
    if (LITE[id]) return LITE[id];
    const g = geo(id);
    if (!g) return null;
    const cs = 4 / ((ORG[id] && ORG[id].res) || 24), nv = g.pos.length / 3, to = new Int32Array(nv), cell = new Map(), P = [], N = [], C = [], W = [];
    const ix = v => Math.floor((v + 1.5) / cs);
    for (let v = 0; v < nv; v++) {
      const k = ix(g.pos[3 * v]) + 64 * (ix(g.pos[3 * v + 1]) + 64 * ix(g.pos[3 * v + 2]));
      let j = cell.get(k);
      if (j === undefined) { j = W.length; cell.set(k, j); P.push(0, 0, 0); N.push(0, 0, 0); C.push(0, 0, 0); W.push(0); }
      for (let q = 0; q < 3; q++) { P[3 * j + q] += g.pos[3 * v + q]; N[3 * j + q] += g.nrm[3 * v + q]; C[3 * j + q] += g.col[3 * v + q]; }
      W[j]++; to[v] = j;
    }
    for (let j = 0; j < W.length; j++) {
      const nl = hyp(N[3 * j], N[3 * j + 1], N[3 * j + 2]) || 1;
      for (let q = 0; q < 3; q++) { P[3 * j + q] /= W[j]; C[3 * j + q] /= W[j]; N[3 * j + q] /= nl; }
    }
    const I = [], seen = new Set();
    for (let i = 0; i < g.idx.length; i += 3) {
      const a = to[g.idx[i]], b = to[g.idx[i + 1]], c = to[g.idx[i + 2]];
      if (a === b || b === c || a === c) continue;
      const key = [a, b, c].sort((x, y) => x - y).join(',');
      if (seen.has(key)) continue;
      seen.add(key); I.push(a, b, c);
    }
    return (LITE[id] = { pos: new Float32Array(P), nrm: new Float32Array(N), col: new Float32Array(C), idx: W.length > 65535 ? new Uint32Array(I) : new Uint16Array(I), view: g.view });
  }

  // ------------------------------------------------------------ one geometry for several models
  // aSlot: which model (its index in the list); the material places, turns and lights each (shader(n)); opts.lite: the
  // lighter copies
  function merged(list, opts = {}) {
    const one = opts.lite ? lite : geo;
    const G = list.map(id => one(id) || one('stomach'));
    const nv = G.reduce((s, g) => s + g.pos.length / 3, 0), ni = G.reduce((s, g) => s + g.idx.length, 0);
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3), slot = new Float32Array(nv), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v0 = 0, i0 = 0;
    G.forEach((g, s) => {
      pos.set(g.pos, 3 * v0); nrm.set(g.nrm, 3 * v0); col.set(g.col, 3 * v0); slot.fill(s, v0, v0 + g.pos.length / 3);
      for (let i = 0; i < g.idx.length; i++) idx[i0 + i] = g.idx[i] + v0;
      v0 += g.pos.length / 3; i0 += g.idx.length;
    });
    return { pos, nrm, col, slot, idx, tris: ni / 3 };
  }
  // GLSL for a lit material over a merged geometry: uP[n] place (xyz) and size (w), uQ[n] alpha (x), glow (y), turn (z,
  // radians about y), and how far the model takes its level colour uTint (w). Light from over the viewer's left shoulder.
  function shader(n) {
    return {
      vertex: `
attribute vec3 aCol; attribute float aSlot;
uniform vec4 uP[${n}], uQ[${n}]; uniform vec3 uTint;
varying vec3 vC, vN, vV; varying float vA, vG;
void main() {
  int s = int(aSlot + 0.5);
  vec4 P = uP[s], Q = uQ[s];
  float c = cos(Q.z), sn = sin(Q.z);
  vec3 p = vec3(position.x * c + position.z * sn, position.y, -position.x * sn + position.z * c);
  vec3 nr = vec3(normal.x * c + normal.z * sn, normal.y, -normal.x * sn + normal.z * c);
  vec4 mv = modelViewMatrix * vec4(P.xyz + p * P.w, 1.0);
  vN = normalize(normalMatrix * nr); vV = -mv.xyz;
  vC = mix(aCol, uTint * (0.55 + 0.45 * dot(aCol, vec3(0.33))), Q.w); vA = Q.x; vG = Q.y;
  gl_Position = projectionMatrix * mv;
  if (Q.x < 0.004 || P.w < 1e-4) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `
uniform float uA;
varying vec3 vC, vN, vV; varying float vA, vG;
void main() {
  float a = vA * uA;
  if (a < 0.01) discard;
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.45, 0.6, 0.65));
  if (dot(n, v) < 0.0) n = -n;
  float df = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y, fr = pow(1.0 - max(dot(n, v), 0.0), 2.4), sp = pow(max(dot(reflect(-l, n), v), 0.0), 28.0);
  vec3 col = vC * (0.26 + 0.24 * hemi + 0.72 * df) + mix(vC, vec3(1.0), 0.6) * fr * (0.35 + 0.6 * vG) + vec3(sp * 0.28) + vC * vG * 0.35;
  gl_FragColor = vec4(col, a);
}`,
    };
  }

  // ------------------------------------------------------------ pictures (a painter's renderer on a 2D canvas)
  // (a resumable job, so drawing ahead between frames stays within its slice: a few hundred triangles at a time)
  const PIC = {}, URL = {}, PJOB = {};
  function* picture(id, px) {
    const g = geo(id);
    if (!g || typeof document === 'undefined') return null;
    const S = 2, W = px * S, cv = document.createElement('canvas');
    cv.width = cv.height = W;
    // (both canvases in memory, not on the GPU: a picture's data URL (toDataURL) then needs no read back from the GPU,
    // which waited for the frame being drawn, up to seconds where the GPU is slow, and stalls a headset)
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const [yaw, pitch] = g.view, cyw = Math.cos(yaw * PI / 180), syw = Math.sin(yaw * PI / 180), cp = Math.cos(pitch * PI / 180), sp = Math.sin(pitch * PI / 180);
    const nv = g.pos.length / 3, X = new Float32Array(nv), Y = new Float32Array(nv), Z = new Float32Array(nv), NX = new Float32Array(nv), NY = new Float32Array(nv), NZ = new Float32Array(nv);
    const rot = (x, y, z, o, k) => { const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw, y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; o[0][k] = x1; o[1][k] = y2; o[2][k] = z2; };
    for (let v = 0; v < nv; v++) { rot(g.pos[3 * v], g.pos[3 * v + 1], g.pos[3 * v + 2], [X, Y, Z], v); rot(g.nrm[3 * v], g.nrm[3 * v + 1], g.nrm[3 * v + 2], [NX, NY, NZ], v); }
    const sc = W * 0.46, ox = W / 2, oy = W / 2;
    const nt = g.idx.length / 3, ord = new Uint32Array(nt), dep = new Float32Array(nt);
    for (let t = 0; t < nt; t++) { ord[t] = t; dep[t] = Z[g.idx[3 * t]] + Z[g.idx[3 * t + 1]] + Z[g.idx[3 * t + 2]]; }
    ord.sort((a, b) => dep[a] - dep[b]);
    const L = [-0.45, 0.6, 0.65], ll = hyp(...L), Lx = L[0] / ll, Ly = L[1] / ll, Lz = L[2] / ll;
    for (let q = 0; q < nt; q++) {
      const t = ord[q], a = g.idx[3 * t], b = g.idx[3 * t + 1], c = g.idx[3 * t + 2];
      let nx = NX[a] + NX[b] + NX[c], ny = NY[a] + NY[b] + NY[c], nz = NZ[a] + NZ[b] + NZ[c];
      const nl = hyp(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      if (nz < -0.05) continue;   // facing away
      const df = Math.max(0, nx * Lx + ny * Ly + nz * Lz), hemi = 0.5 + 0.5 * ny, fr = Math.pow(1 - Math.max(0, nz), 2.4);
      const rz = 2 * (nx * Lx + ny * Ly + nz * Lz) * nz - Lz, spc = Math.pow(Math.max(0, rz), 28);
      const col = [0, 1, 2].map(k => { const v = (g.col[3 * a + k] + g.col[3 * b + k] + g.col[3 * c + k]) / 3; return clamp(v * (0.3 + 0.24 * hemi + 0.72 * df) + (v * 0.4 + 0.6) * fr * 0.3 + spc * 0.28, 0, 1); });
      const st = `rgb(${Math.round(col[0] * 255)},${Math.round(col[1] * 255)},${Math.round(col[2] * 255)})`;
      ctx.beginPath();
      ctx.moveTo(ox + X[a] * sc, oy - Y[a] * sc); ctx.lineTo(ox + X[b] * sc, oy - Y[b] * sc); ctx.lineTo(ox + X[c] * sc, oy - Y[c] * sc); ctx.closePath();
      ctx.fillStyle = st; ctx.strokeStyle = st; ctx.lineWidth = 0.7; ctx.fill(); ctx.stroke();
      if (q % 100 === 99) yield;
    }
    const out = document.createElement('canvas');
    out.width = out.height = px;
    const o2 = out.getContext('2d', { willReadFrequently: true });
    o2.imageSmoothingEnabled = true; o2.imageSmoothingQuality = 'high';
    o2.drawImage(cv, 0, 0, px, px);
    return out;
  }
  // a picture now (finishing one under way), or drawn ahead until a time
  function drawPic(id, px, until) {
    const key = id + '@' + px;
    if (PIC[key] !== undefined) return true;
    const j = PJOB[key] || (PJOB[key] = picture(id, px));
    for (;;) { const r = j.next(); if (r.done) { PIC[key] = r.value; delete PJOB[key]; return true; } if (performance.now() > until) return false; }
  }
  function canvas(id, px = 64) { drawPic(id, px, Infinity); return PIC[id + '@' + px]; }
  function url(id, px = 64) {
    const key = id + '@' + px;
    if (URL[key] === undefined) { const c = canvas(id, px); try { URL[key] = c ? c.toDataURL() : ''; } catch (e) { URL[key] = ''; } }
    return URL[key];
  }
  // without waiting: the 64 px picture (a canvas, or its data URL) if it is drawn, else null ('') and the organ is
  // wanted next; a model (its mesh) likewise
  const pic = id => { const c = PIC[id + '@64']; if (c === undefined) { want(id); return null; } return c; };
  const picUrl = id => (pic(id) ? url(id, 64) : '');
  const mesh = id => (MESH[id] || (want(id), null));
  // version(): goes up as each model and picture is done (the panes redraw on it); driven: the engine steps the queue
  // itself every frame (the sets then leave it alone; in the harness they step it)
  return { ids, idOf, geo, lite, merged, shader, canvas, url, pic, picUrl, mesh, want, step, ready, built, has: id => !!MESH[id], version: () => ver,
    driven: false, names: BYNAME };
})();

// the harness's gallery of the models (harness.html?set=organs): not part of the story
SETS.organs = function (K) {
  const { THREE } = K;
  const set = K.newSet('organs');
  const ids = ORGAN3D.ids, n = ids.length, M = ORGAN3D.merged(ids), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(M.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(M.nrm, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(M.col, 3)); g.setAttribute('aSlot', new THREE.BufferAttribute(M.slot, 1)); g.setIndex(new THREE.BufferAttribute(M.idx, 1));
  const uP = ids.map((id, i) => new THREE.Vector4(((i % 6) - 2.5) * 0.36, (2 - Math.floor(i / 6)) * 0.36, 0, 0.15)), uQ = ids.map(() => new THREE.Vector4(1, 0, 0, 0));
  const sh = ORGAN3D.shader(n);
  const mat = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uP: { value: uP }, uQ: { value: uQ }, uTint: { value: new THREE.Color(0.1, 0.55, 0.3) } },
    vertexShader: sh.vertex, fragmentShader: sh.fragment, transparent: true });
  set.mats.push(mat);
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; set.group.add(mesh);
  // (organs_lite: the lighter copies the atlas's plates use, in the same places)
  const L = ORGAN3D.merged(ids, { lite: true }), gl = new THREE.BufferGeometry();
  gl.setAttribute('position', new THREE.BufferAttribute(L.pos, 3)); gl.setAttribute('normal', new THREE.BufferAttribute(L.nrm, 3));
  gl.setAttribute('aCol', new THREE.BufferAttribute(L.col, 3)); gl.setAttribute('aSlot', new THREE.BufferAttribute(L.slot, 1)); gl.setIndex(new THREE.BufferAttribute(L.idx, 1));
  const meshL = new THREE.Mesh(gl, mat); meshL.frustumCulled = false; meshL.visible = false; set.group.add(meshL);
  let pics = null;
  return Object.assign(set, {
    params: { organs_a: 1, organs_spin: 0, organs_tint: 0, organs_pics: 0, organs_lite: 0 },
    update(S, t) {
      meshL.visible = !!S.organs_lite; mesh.visible = !S.organs_lite;
      ids.forEach((id, i) => uQ[i].set(1, 0, (S.organs_spin || 0) * t * 0.6, S.organs_tint || 0));
      // organs_pics: the pictures the panels use, laid over the page (harness only)
      if (S.organs_pics && !pics && typeof document !== 'undefined') {
        pics = document.createElement('div');
        pics.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;background:#e9edf3;display:flex;flex-wrap:wrap;align-content:flex-start;gap:4px;padding:8px';
        for (const id of ids) {
          const d = document.createElement('div'), c = ORGAN3D.canvas(id, 64), c2 = ORGAN3D.canvas(id, 64);
          d.style.cssText = 'width:96px;text-align:center;font:11px sans-serif;color:#223';
          c.style.cssText = 'width:64px;height:64px;display:block;margin:0 auto';
          const dk = document.createElement('div'); dk.style.cssText = 'background:#0a1322;width:40px;height:40px;margin:2px auto;display:flex;align-items:center;justify-content:center';
          const im = document.createElement('img'); im.src = ORGAN3D.url(id, 64); im.width = im.height = 32; dk.appendChild(im);
          d.appendChild(c); d.appendChild(dk); d.appendChild(document.createTextNode(id)); pics.appendChild(d);
          void c2;
        }
        document.body.appendChild(pics);
      }
    },
    anchors: {}, labels: ids.map((id, i) => ({ text: [id, ''], at: [uP[i].x - 0.1, uP[i].y - 0.17, 0], cls: '' })),
    cam: { default: [0, 0, 3.4, 0, 0.0, 0] }, tris: M.tris, trisLite: L.tris,
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

// One H&E section, the method and the domains (the microanatomy story; Buljan, Bago-Horvath & Rendeiro, bioRxiv 2025),
// drawn over the tour's tissue set (tools/lbi/sets/tissue.js) in its frame, in the tour's visual language for its cell
// network: the section is cut into tiles; every tile grows a little skyline of 16 bars, its description (features);
// a network floats over the tiles, each joined to its neighbours, with light running along the links (message
// passing) while the skylines and colours mix; the nodes lift off into a 3D map of their mixed descriptions where
// alike tiles gather (the groups), take their group's colour and fly back down to colour the section: the domains
// (the layers of the gut wall). Then the domain map changes from age 20 to 70 as in the preprint's gut submucosa
// example. The tiles' outlines, colours and borders are one shader over a mesh that follows the slab; the domains wash
// in tile by tile, but their borders follow the tissue set's layers, the patch and the vessels to the pixel (the real
// tiles are far smaller than these).
SETS.slide = function (K) {
  const { THREE, v3, smooth, clamp, prog, lerp } = K;
  const set = K.newSet('slide');
  const PI = Math.PI;
  const MD = MICRO_DATA, EX = MD.examples.find(e => e.domain === 'submucosa') || { from: 42.9, to: 34.5 };
  const AGES = (MD.facts && MD.facts.ages) || [20, 70];

  // ------------------------------------------------- the tissue set's frame
  // (copied from tools/lbi/sets/tissue.js, which this set must match: the strip's layers and its curve in space)
  const L = 2.1, TH = 0.008, BK = 0.1, RA = 2.7, TILT = -0.15;
  function noise1(seed) {
    const r = K.rng(seed), v = new Float32Array(256);
    for (let i = 0; i < 256; i++) v[i] = r() * 2 - 1;
    return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = v[i & 255]; return a + (v[(i + 1) & 255] - a) * u; };
  }
  const gs = (x, m, w) => Math.exp(-((x - m) / w) * ((x - m) / w));
  const nM = noise1(11), nS = noise1(12), nP = noise1(13), nT = noise1(14);
  // s along the section (0..L), d depth below the lumen: lumen surface, mucosa / submucosa (b1), submucosa / muscle
  // (b2), inner / outer muscle (bm), serosa
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
  {
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (let k = 0; k <= 200; k++) {
      const s = L * k / 200, ly = layers(s);
      for (const d of [ly.top, ly.bot]) { const p = plane(s, d); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    }
    CX = (x0 + x1) / 2; CY = (y0 + y1) / 2; CZ = BK * ((x1 - x0) / 2) ** 2 / 2;
  }
  const P3 = (s, d) => { const p = plane(s, d); return [p[0], p[1], BK * p[0] * p[0] - CZ]; };
  const nrm = x => v3.norm([-2 * BK * x, 0, 1]);
  const front = (s, d, o = 0.004) => { const p = P3(s, d); return v3.add(p, v3.mul(nrm(p[0]), TH / 2 + o)); };
  // the lymphoid aggregate and the zoom patch's artery and vein (tissue.js: AG, vessels[0..1]); a vessel's halo counts
  // as vessel, as its wall and the loose tissue round it do in a tile
  const AG = { s: 0.6, d: layers(0.6).b1 - 0.008, a: 0.046, b: 0.032 };
  const bZ = layers(1.27).b1;
  const VES = [{ s: 1.304, d: bZ + 0.031, r: 0.0165, asp: 1.15, ang: 0.3 }, { s: 1.22, d: bZ + 0.044, r: 0.013, asp: 2.3, ang: -0.25 }];
  AG.A = AG.a * Math.sqrt(1.1); AG.B = AG.b * Math.sqrt(1.1);
  for (const v of VES) { v.A = v.r * Math.sqrt(v.asp) * 1.6; v.B = v.r / Math.sqrt(v.asp) * 1.6 + 0.006; v.c = Math.cos(v.ang); v.sn = Math.sin(v.ang); }
  const inAG = (s, d) => ((s - AG.s) / AG.A) ** 2 + ((d - AG.d) / AG.B) ** 2 < 1;
  const inVes = (s, d) => VES.some(v => {
    const x = (s - v.s) * v.c + (d - v.d) * v.sn, y = (d - v.d) * v.c - (s - v.s) * v.sn;
    return (x / v.A) ** 2 + (y / v.B) ** 2 < 1;
  });

  // ------------------------------------------------------------- the domains
  // names as in MICRO_DATA.graph (so the explore panels can match them), labels as shown. Colours as in the talk's
  // atlas (MICRO_DATA.figures.atlas): its stomach map (glands orange, submucosa red, muscularis green) and its small
  // intestine's lymphoid patches (blue); the talk draws the muscularis as one domain, so the outer layer takes a lighter
  // green, and the vessels the palette's next colour. Without the figures, a fixed palette.
  const ATL = Array.isArray(MD.figures && MD.figures.atlas) ? MD.figures.atlas : [];
  const isHex = c => /^#[0-9a-f]{6}$/i.test(c || '');
  const figOf = (tre, dre) => { const t = ATL.find(x => tre.test(x.tissue || '')), d = t && (t.domains || []).find(x => dre.test(x.name || '')); return d && isHex(d.colour) ? d.colour : null; };
  const DOM = [
    { name: 'mucosa', title: 'Mucosa', label: ['Mucosa', ''], cls: 'amb', css: figOf(/stomach/i, /gland/i) || '#f58020' },
    { name: 'submucosa', title: 'Submucosa', label: ['Submucosa', ''], cls: 'mag', css: figOf(/stomach/i, /submucosa/i) || '#d82a2a' },
    { name: 'inner circular smooth muscle', title: 'Inner circular muscle', label: ['Muscle', 'inner, circular'], cls: 'grn', css: figOf(/stomach/i, /muscularis/i) || '#2ca249' },
    { name: 'outer longitudinal smooth muscle', title: 'Outer lengthwise muscle', label: ['Muscle', 'outer, lengthwise'], cls: 'grn', css: '#9bd14b' },
    { name: 'lymphoid tissue', title: 'Lymphoid patch', label: ['Lymphoid', 'patch'], cls: 'cyn', css: figOf(/small intestine/i, /peyer/i) || '#1a78b6' },
    { name: 'blood vessels', title: 'Blood vessels', label: ['Blood vessels', ''], cls: '', css: '#9268ad' },
  ];
  // any other name: the talk's colour where it names that domain (the first section that does), else a fixed
  // categorical colour per name. (The atlas set owns the story's domainColour; the engine may hand it over with
  // api().recolour(fn).)
  const FIGC = {};
  for (const t of ATL) for (const d of t.domains || []) { const n = String(d.name || '').toLowerCase(); if (isHex(d.colour) && !FIGC[n]) FIGC[n] = d.colour; }
  const CAT = ['#1a78b6', '#f58020', '#2ca249', '#d82a2a', '#9268ad', '#8c574c', '#d87ab2', '#939598', '#46d9ff', '#ffb43b', '#3ee08f', '#ff5ad9'];
  function domainColour(name) {
    const n = String(name || '').toLowerCase(), own = DOM.find(d => d.name === n);
    if (own) return own.css;
    if (FIGC[n]) return FIGC[n];
    let h = 7;
    for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
    return CAT[h % CAT.length];
  }

  // ------------------------------------------------- the domains, to the pixel
  // the domain at (s, d) at age a (0 = 20, 1 = 70), as drawn: the lymphoid patch, then the two vessels, then the
  // layers. With age the submucosa / muscle border rises (the inner muscle takes the submucosa's loss) and the inner /
  // outer muscle border rises by 0.4 of that (so both muscle layers thicken: illustrative); the change runs along the
  // section in a gentle wave, and not where the strip has no muscle (its right end)
  const wm = s => smooth((1.97 - s) / 0.3);
  const apAt = (s, a) => smooth(clamp((a - 0.15 - 0.15 * Math.sin(s * 2.7 + 1)) / 0.7, 0, 1));
  let FS = 0;   // how much of its thickness the submucosa loses by 70 (set below from the preprint's example)
  function bordersAt(s, a, ly) {
    const sh = apAt(s, a) * FS * (ly.b2 - ly.b1) * wm(s);
    return [ly.b1, ly.b2 - sh, ly.bm - 0.4 * sh];
  }
  function domAt(s, d, a, ly = layers(s)) {
    if (s < 0 || s > L || d < ly.top || d > ly.bot) return -1;
    if (inAG(s, d)) return 4;
    if (inVes(s, d)) return 5;
    const b = bordersAt(s, a, ly);
    return d < b[0] ? 0 : d < b[1] ? 1 : d < b[2] ? 2 : 3;
  }
  // each domain's share of the drawn section (by area on the slab: a strip's length scales with its radius)
  function sharesAt(a) {
    const n = [0, 0, 0, 0, 0, 0], NS = 420, DD = 0.003;
    let tot = 0;
    for (let k = 0; k < NS; k++) {
      const s = L * (k + 0.5) / NS, ly = layers(s);
      for (let d = ly.top + DD / 2; d < ly.bot; d += DD) { const w = (RA - d) / RA, c = domAt(s, d, a, ly); n[c] += w; tot += w; }
    }
    return n.map(x => 100 * x / tot);
  }
  // the submucosa thins by the same fraction as in the preprint's gut example (42.9 % -> 34.5 % of the slides: about
  // a fifth of itself); the shifted strip lies clear of the patch and the vessels, so its area is linear in FS
  const SH20 = sharesAt(0);
  {
    let band = 0, tot = 0;
    for (let k = 0; k < 420; k++) {
      const s = L * (k + 0.5) / 420, ly = layers(s), bw = (ly.b2 - ly.b1) * wm(s);
      band += bw / 0.003 * (RA - ly.b2) / RA;
      for (let d = ly.top + 0.0015; d < ly.bot; d += 0.003) tot += (RA - d) / RA;
    }
    FS = clamp(SH20[1] * (1 - EX.to / EX.from) / (100 * band / tot || 1), 0, 0.5);
  }
  const SH70 = sharesAt(1);

  // ---------------------------------------------------------------- the tiles
  // NX x NY square tiles over the strip in (s, d); a tile is kept when at least 30 % of it is tissue. A tile's domain
  // (for its features, its lift and the matrix) is the main one in it at 20; small structures count 2.4 times
  const NX = 40, NY = 12, TS = L / NX, D0 = -0.004, NP = 3;
  const R = K.rng(1310), rr = (a, b) => a + (b - a) * R();
  const SUB = 8, LYS = [];
  for (let i = 0; i < NX * SUB; i++) LYS.push(layers((i + 0.5) * TS / SUB));
  const tiles = [];
  const T = (i, j) => (i < 0 || j < 0 || i >= NX || j >= NY ? null : tiles[i + NX * j]);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const fr = [0, 0, 0, 0, 0, 0];
    let inside = 0;
    for (let a = 0; a < SUB; a++) {
      const s = (i + (a + 0.5) / SUB) * TS, ly = LYS[i * SUB + a];
      for (let b = 0; b < SUB; b++) {
        const d = D0 + (j + (b + 0.5) / SUB) * TS;
        if (s < 0.004 || s > L - 0.004 || d < ly.top || d > ly.bot) continue;
        inside++;
        fr[domAt(s, d, 0, ly)]++;
      }
    }
    const tot = Math.max(1, inside), W = [1, 1, 1, 1, 2.4, 2.4];
    let dom = 0;
    for (let k = 1; k < 6; k++) if (fr[k] * W[k] > fr[dom] * W[dom]) dom = k;
    tiles.push({ i, j, keep: inside >= 0.3 * SUB * SUB, fr: fr.map(x => x / tot), dom });
  }
  const kept = tiles.filter(t => t.keep);
  const nb4 = t => [T(t.i - 1, t.j), T(t.i + 1, t.j), T(t.i, t.j - 1), T(t.i, t.j + 1)].filter(n => n && n.keep);

  // features: each tile is described by 16 numbers, from what it holds (its mix of domains) and some noise; message
  // passing mixes in its neighbours' (two rounds, half its own each time; the network drawn has eight neighbours a
  // tile, the mixing uses the four that share an edge)
  const NF = 16, HI = [[0, 3, 7, 12], [2, 5, 10, 13], [6, 8, 11, 14], [6, 8, 9, 15], [1, 3, 9, 14], [4, 5, 11, 15]];
  const proto = HI.map(h => Array.from({ length: NF }, (_, f) => (h.includes(f) ? rr(0.72, 0.95) : rr(0.08, 0.26))));
  const featOf = fr => proto[0].map((_, f) => clamp(fr.reduce((a, w, k) => a + w * proto[k][f], 0) + 0.13 * K.gauss(R), 0, 1));
  for (const t of kept) t.f = featOf(t.fr);
  for (const t of kept) t.m = t.f.slice();
  for (let round = 0; round < 2; round++) {
    const next = kept.map(t => { const ns = nb4(t); return t.m.map((v, f) => (ns.length ? 0.5 * v + 0.5 * ns.reduce((a, n) => a + n.m[f], 0) / ns.length : v)); });
    kept.forEach((t, k) => { t.m = next[k]; });
  }
  // a tile's description as a colour: three fixed random projections of its features, stretched to a bright range
  const WP = [0, 1, 2].map(() => Array.from({ length: NF }, () => K.gauss(R)));
  const proj = f => WP.map(w => w.reduce((a, x, k) => a + x * f[k], 0));
  const lo = [9, 9, 9].map(() => 1e9), hi = [0, 0, 0].map(() => -1e9);
  for (const t of kept) proj(t.f).forEach((v, c) => { lo[c] = Math.min(lo[c], v); hi[c] = Math.max(hi[c], v); });
  const tintOf = f => {
    const p = proj(f).map((v, c) => clamp((v - lo[c]) / (hi[c] - lo[c] + 1e-6), 0, 1));
    const g = (p[0] + p[1] + p[2]) / 3;
    return p.map(v => clamp(0.22 + 0.72 * (g + (v - g) * 1.5), 0.05, 1));
  };
  for (const t of kept) {
    t.tint = tintOf(t.f); t.tintM = tintOf(t.m);
    t.ord = clamp(0.8 * (t.i + 0.6 * t.j) / (NX + 0.6 * NY) + 0.2 * R(), 0, 1);   // tiles draw on in a sweep
    t.dord = clamp(0.35 * (t.i / NX) + 0.65 * R(), 0, 1);                          // and take their domain colours
  }

  const tileC = t => [(t.i + 0.5) * TS, D0 + (t.j + 0.5) * TS];
  // the close-up: a tile on the mucosa / submucosa border; every step spreads outwards from it, as the tour's cell
  // network draws outwards from its zoom patch
  const CL = T(16, 3), CLc = tileC(CL);
  const dCL = t => Math.hypot((t.i - CL.i) / NX * 2.4, (t.j - CL.j) / NY * 0.7);
  { const mx = Math.max(...kept.map(dCL)); for (const t of kept) t.wave = clamp(0.62 * dCL(t) / mx + 0.08 * R(), 0, 0.7); }
  // each kept tile's place on the slab: centre, the slab's normal, unit tangents along the section and in depth
  for (const t of kept) {
    const [s, d] = tileC(t), p = P3(s, d);
    t.p = p; t.ts = v3.norm(v3.sub(P3(s + 0.01, d), P3(s - 0.01, d))); t.td = v3.norm(v3.sub(P3(s, d + 0.01), P3(s, d - 0.01)));
  }

  // ------------------------------------------------------- the tile texture
  // NP pages of NX x NY texels: 0 own tint + kept, 1 mixed tint + domain order, 2 draw-on order
  const TT = new Uint8Array(NX * NY * NP * 4);
  const texT = new THREE.DataTexture(TT, NX, NY * NP, THREE.RGBAFormat);
  texT.magFilter = texT.minFilter = THREE.NearestFilter; texT.generateMipmaps = false;
  const b8 = x => Math.round(clamp(x, 0, 1) * 255);
  for (const t of tiles) {
    const put = (p, r, g, b, a) => { const o = 4 * (t.i + NX * (p * NY + t.j)); TT[o] = b8(r); TT[o + 1] = b8(g); TT[o + 2] = b8(b); TT[o + 3] = b8(a); };
    if (!t.keep) { for (let p = 0; p < NP; p++) put(p, 0, 0, 0, 0); continue; }
    put(0, ...t.tint, 1); put(1, ...t.tintM, t.dord);
    put(2, t.ord, 0, 0, 1);
  }
  texT.needsUpdate = true;

  // the domains' colours as drawn: the slide is darkened a little under them (DARK), and each colour is pushed away
  // from the stain it lies on (BASE: the tissue set's colour there, read off a render) so that, laid over it at WA,
  // it reads as itself and not as a mix with pink (green on pink went olive)
  const DARK = 0.2, WA = 0.58;
  const BASE = ['#a671a2', '#e7a6c7', '#d05f91', '#d05f91', '#503775', '#e0a0c0'].map(K.rgb);
  const uCol = DOM.map(() => new THREE.Vector3());
  function fillCols() {
    DOM.forEach((d, k) => {
      const c = K.rgb(d.css), b = BASE[k].map(x => x * (1 - DARK)), g = (b[0] + b[1] + b[2]) / 3;
      uCol[k].set(...c.map((x, i) => clamp(x + 0.85 * (1 - WA) / WA * (g - b[i]), 0, 1)));
    });
  }
  fillCols();

  // premultiplied blending: one material can both lay a translucent colour over the slide and add glow
  const pm = m => { m.blending = THREE.CustomBlending; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendEquation = THREE.AddEquation; set.mats.push(m); return m; };
  const OVER = 'vec4 over(vec4 acc, vec3 c, float a) { return vec4(c * a + acc.rgb * (1.0 - a), a + acc.a * (1.0 - a)); }';
  // a feature's value as a colour (the usual even scale for numbers: indigo for low, through teal, to yellow for
  // high), bright enough to glow on the darkened slide
  const ICE = `
vec3 ice(float v) {
  vec3 c = mix(vec3(0.3, 0.2, 0.72), vec3(0.12, 0.62, 0.78), smoothstep(0.05, 0.5, v));
  c = mix(c, vec3(0.35, 0.86, 0.45), smoothstep(0.45, 0.75, v));
  return mix(c, vec3(1.0, 0.9, 0.28), smoothstep(0.7, 1.0, v));
}`;
  const TILEGL = `
uniform sampler2D tT;
const float NX = ${NX}.0, NY = ${NY}.0, NP = ${NP}.0;
vec4 tt(vec2 ij, float p) { vec2 c = clamp(ij, vec2(0.0), vec2(NX - 1.0, NY - 1.0)); return texture2D(tT, vec2((c.x + 0.5) / NX, (p * NY + c.y + 0.5) / (NP * NY))); }`;
  // which face of the slab the camera sees (+1 front, -1 back), at a point of the slab: things stand on that face
  const SIDE = `
float slabSide(vec3 p) { vec3 n = normalize(vec3(-2.0 * uBK * p.x, 0.0, 1.0)); return dot(normalMatrix * n, -(modelViewMatrix * vec4(p, 1.0)).xyz) >= 0.0 ? 1.0 : -1.0; }
vec3 slabN(vec3 p) { return normalize(vec3(-2.0 * uBK * p.x, 0.0, 1.0)); }`;

  // ------------------------------------------------- the mesh over the slab
  // a grid in (s, d) that follows the strip (4 x 5 quads per tile, only under kept tiles), drawn on whichever face
  // of the slab the camera sees, a hair in front of it
  const QS = 4, QD = 5, NC = NX * QS, NR = NY * QD;
  // (aL: the layers' borders at this s in tile units, and where there is muscle, for the domains to the pixel)
  const nv = (NC + 1) * (NR + 1), gPos = new Float32Array(nv * 3), gG = new Float32Array(nv * 2), gTB = new Float32Array(nv * 2), gUv = new Float32Array(nv * 2), gL = new Float32Array(nv * 4);
  for (let c = 0; c <= NC; c++) {
    const s = L * c / NC, ly = layers(s), lv = [(ly.b1 - D0) / TS, (ly.b2 - D0) / TS, (ly.bm - D0) / TS, wm(s)];
    for (let r = 0; r <= NR; r++) {
      const d = D0 + NY * TS * r / NR, p = P3(s, d), k = c * (NR + 1) + r;
      gPos.set(p, 3 * k); gG.set([s / TS, (d - D0) / TS], 2 * k); gL.set(lv, 4 * k);
      gTB.set([(ly.top + 0.002 - D0) / TS, (ly.bot - D0) / TS], 2 * k); gUv.set([s / L, r / NR], 2 * k);
    }
  }
  const gIdx = [];
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    if (!T(Math.floor(c / QS), Math.floor(r / QD)).keep) continue;
    const a = c * (NR + 1) + r, b = a + NR + 1;
    gIdx.push(a, a + 1, b + 1, a, b + 1, b);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gridGeo.setAttribute('aG', new THREE.BufferAttribute(gG, 2));
  gridGeo.setAttribute('aTB', new THREE.BufferAttribute(gTB, 2));
  gridGeo.setAttribute('aL', new THREE.BufferAttribute(gL, 4));
  gridGeo.setAttribute('uv', new THREE.BufferAttribute(gUv, 2));
  gridGeo.setIndex(gIdx);
  gridGeo.computeBoundingSphere();
  const U = { uA: set.uA, uTime: K.U.uTime, tT: { value: texT }, uBK: { value: BK }, uTiles: { value: 0 }, uAdj: { value: 0 }, uDom: { value: 0 }, uAge: { value: 0 },
    uFoc: { value: 0 }, uNet: { value: 0 }, uDim: { value: 0 }, uFeat: { value: 0 }, uGrp: { value: 0 }, uLand: { value: 0 }, uOut: { value: 1 },
    // the domains: colours, how much the submucosa thins by 70, the patch and the vessels (centre and half axes in tile
    // units; a vessel's turn as cos, sin)
    uCol: { value: uCol }, uFS: { value: FS }, uAGe: { value: new THREE.Vector4(AG.s / TS, (AG.d - D0) / TS, AG.A / TS, AG.B / TS) },
    uVe: { value: VES.map(v => new THREE.Vector4(v.s / TS, (v.d - D0) / TS, v.A / TS, v.B / TS)) }, uVr: { value: VES.map(v => new THREE.Vector2(v.c, v.sn)) } };
  const washMat = pm(new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true },
    vertexShader: `
uniform float uBK;
attribute vec2 aG, aTB; attribute vec4 aL;
varying vec2 vG, vTB; varying vec4 vL;
${SIDE}
void main() {
  vG = aG; vTB = aTB; vL = aL;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + slabN(position) * slabSide(position) * ${(TH / 2 + 0.0016).toFixed(4)}, 1.0);
}`,
    fragmentShader: TILEGL + OVER + `
const float TSZ = ${TS.toFixed(6)}, DARK = ${DARK.toFixed(3)}, WA = ${WA.toFixed(3)};
uniform float uA, uTime, uTiles, uAdj, uDom, uAge, uFoc, uFS, uDim, uFeat;
uniform vec3 uCol[6]; uniform vec4 uAGe, uVe[2]; uniform vec2 uVr[2];
varying vec2 vG, vTB; varying vec4 vL;
float dpr(float o) { return smoothstep(0.0, 1.0, clamp((uDom - 0.55 * o) / 0.45, 0.0, 1.0)); }
// an ellipse (centre, half axes; turned by r = cos, sin): 1 at its centre, 0 on its edge
float ell(vec4 e, vec2 r) { vec2 o = vG - e.xy, q = vec2(o.x * r.x + o.y * r.y, o.y * r.x - o.x * r.y) / e.zw; return 1.0 - dot(q, q); }
// 0 -> 1 across x = 0 in about a pixel (fx: how much x changes per pixel); a line along x = 0, w pixels each side
float side(float x, float fx) { return clamp(x / fx + 0.5, 0.0, 1.0); }
float line(float x, float fx, float w) { return 1.0 - smoothstep(w, w + 1.0, abs(x) / fx); }
float sel(float k) { return max(0.0, 1.0 - abs(uFoc - k - 1.0)); }
void main() {
  vec2 ij = floor(vG), f = vG - ij, c = f - 0.5;
  vec2 fw = max(fwidth(vG), vec2(1e-5)); float px = max(fw.x, fw.y);
  // the domains here, to the pixel: the layers' borders (the lower two rise with age, in a wave along the section),
  // then the vessels and the lymphoid patch over them
  float ap = smoothstep(0.0, 1.0, clamp((uAge - 0.15 - 0.15 * sin(vG.x * TSZ * 2.7 + 1.0)) / 0.7, 0.0, 1.0));
  float sh = ap * uFS * (vL.y - vL.x) * vL.w;
  float e1 = vG.y - vL.x, e2 = vG.y - vL.y + sh, e3 = vG.y - vL.z + 0.4 * sh;
  float qa = ell(uAGe, vec2(1.0, 0.0)), q0 = ell(uVe[0], uVr[0]), q1 = ell(uVe[1], uVr[1]);
  float f1 = max(fwidth(e1), 1e-5), f2 = max(fwidth(e2), 1e-5), f3 = max(fwidth(e3), 1e-5);
  float fqa = max(fwidth(qa), 1e-5), fq0 = max(fwidth(q0), 1e-5), fq1 = max(fwidth(q1), 1e-5);
  vec4 p0 = tt(ij, 0.0);
  if (p0.a < 0.5) discard;
  vec4 p1 = tt(ij, 1.0), p2 = tt(ij, 2.0);
  float h1 = side(e1, f1), h2 = side(e2, f2), h3 = side(e3, f3);
  float wa = side(qa, fqa), vv = max(side(q0, fq0), side(q1, fq1)), wv = vv * (1.0 - wa), lay = (1.0 - wa) * (1.0 - vv);
  float w0 = (1.0 - h1) * lay, w1 = max(0.0, h1 - h2) * lay, w2 = max(0.0, h2 - h3) * lay, w3 = h3 * lay;
  vec3 dc = uCol[0] * w0 + uCol[1] * w1 + uCol[2] * w2 + uCol[3] * w3 + uCol[4] * wa + uCol[5] * wv;
  float foc = clamp(uFoc, 0.0, 1.0);
  float fsel = (w0 * sel(0.0) + w1 * sel(1.0) + w2 * sel(2.0) + w3 * sel(3.0) + wa * sel(4.0) + wv * sel(5.0)) * foc;
  // the wash stays on the tissue; the outlines are whole squares
  float inT = smoothstep(vTB.x - fw.y, vTB.x + fw.y, vG.y) * (1.0 - smoothstep(vTB.y - fw.y, vTB.y + fw.y, vG.y));
  vec4 acc = vec4(0.0);
  // the tile's description as a colour (its own, then mixed with its neighbours'), then the domains' colours, which
  // wash in tile by tile; under them the slide darkens a little, so they read as themselves on its pink (the small
  // patch and vessels a little stronger). While the network floats over it, the slide dims, so its light reads.
  float dp = dpr(p1.a), fa = max(dp, fsel);
  vec3 tint = mix(p0.rgb, p1.rgb, smoothstep(0.25, 0.85, uAdj));
  float ta = 0.3 * smoothstep(0.0, 0.25, uAdj);
  acc = over(acc, vec3(0.012, 0.02, 0.045), max(0.45 * uDim, 0.42 * uFeat) * (1.0 - fa) * inT);
  acc = over(acc, vec3(0.0), DARK * fa * inT);
  acc = over(acc, mix(tint, dc, fa), mix(ta, WA + 0.16 * (wa + wv) + 0.12 * fsel, fa) * (1.0 - 0.5 * (foc - fsel)) * inT);
  // focus: the other domains dim
  acc = over(acc, vec3(0.01, 0.018, 0.035), 0.6 * (foc - fsel) * inT);
  // the outline draws on round the tile, tiles one after another
  float tp = clamp((uTiles * 1.3 - p2.r) / 0.3, 0.0, 1.0);
  float m = max(abs(c.x), abs(c.y));
  float e = abs(0.455 - m) / (abs(c.x) > abs(c.y) ? fw.x : fw.y);
  float per = atan(c.x, c.y) / 6.28318 + 0.5;
  float show = 1.0 - smoothstep(tp * 1.04 - 0.03, tp * 1.04, per);
  float head = exp(-pow((per - tp * 1.04) / 0.05, 2.0)) * step(0.001, tp) * (1.0 - step(0.999, tp));
  // thin and faint from afar (a fine mesh over the slide), brighter once a tile is big on screen; kept on the tissue
  float near = smoothstep(14.0, 70.0, 1.0 / px);
  float inO = smoothstep(vTB.x - 0.04 - fw.y, vTB.x - 0.04, vG.y) * (1.0 - smoothstep(vTB.y + 0.04, vTB.y + 0.04 + fw.y, vG.y));
  float ln = (1.0 - smoothstep(0.15 + 0.2 * near, 0.95 + 0.2 * near, e)) * show * inO * (0.42 + 0.3 * near) * (1.0 - 0.5 * smoothstep(0.0, 0.3, uAdj));
  acc.rgb += vec3(0.55, 0.9, 1.0) * ln * (0.55 + 1.3 * head) * (1.0 - 0.82 * fa);
  acc.rgb += vec3(0.2, 0.45, 0.6) * 0.28 * sin(3.14159 * tp) * inT;
  // clean light borders where two domains meet (the layers' lines stop at the patch and the vessels)
  if (uDom + uFoc > 0.001) {
    float bw = max(0.6, 0.016 / px);
    float bd = max(max(line(e1, f1, bw), line(e2, f2, bw)), line(e3, f3, bw)) * lay;
    bd = max(bd, max(line(qa, fqa, bw), max(line(q0, fq0, bw), line(q1, fq1, bw)) * (1.0 - wa)));
    acc = over(acc, mix(dc, vec3(1.0), 0.55), bd * 0.9 * fa * (1.0 - 0.7 * (foc - fsel)) * inT);
    // the focused domain glows
    acc.rgb += (dc * (0.14 + 0.05 * sin(uTime * 2.2)) + mix(dc, vec3(1.0), 0.5) * bd * 0.7) * fsel * inT;
  }
  gl_FragColor = acc * uA;
}`,
  }));
  const wash = new THREE.Mesh(gridGeo, washMat);
  wash.renderOrder = 5;
  set.group.add(wash);

  // ------------------------------------------------------- features: 16 glowing blocks on every tile
  // (a 4 x 4 mosaic of low blocks on the tile, each as bright and as tall as one of its numbers, as the tour's cells
  // light up in its fluorescence view: the slide darkens, and the mosaics light up in a wave from the close-up tile;
  // as the tiles listen to their neighbours they settle to the mixed numbers, so neighbouring mosaics grow alike)
  const NB = kept.length * NF, HB = 0.016, H0 = 0.0012;
  const boxGeo = new THREE.InstancedBufferGeometry();
  {
    // a box without its floor: x, y across (-0.5..0.5), z up (0..1), with flat normals
    const P = [], N = [], I = [];
    const face = (o, u, v, n) => { const b = P.length / 3; for (const [a, c] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { P.push(o[0] + u[0] * a + v[0] * c, o[1] + u[1] * a + v[1] * c, o[2] + u[2] * a + v[2] * c); N.push(...n); } I.push(b, b + 1, b + 2, b, b + 2, b + 3); };
    face([-0.5, -0.5, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    face([-0.5, -0.5, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0]); face([0.5, 0.5, 0], [-1, 0, 0], [0, 0, 1], [0, 1, 0]);
    face([0.5, -0.5, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]); face([-0.5, 0.5, 0], [0, -1, 0], [0, 0, 1], [-1, 0, 0]);
    boxGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); boxGeo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); boxGeo.setIndex(I);
    const aC = new Float32Array(NB * 3), aS = new Float32Array(NB * 3), aD = new Float32Array(NB * 3), aI = new Float32Array(NB * 4);
    kept.forEach((t, k) => {
      for (let b = 0; b < NF; b++) {
        const o = k * NF + b;
        aC.set(t.p, 3 * o); aS.set(t.ts, 3 * o); aD.set(t.td, 3 * o);
        aI.set([b, t.f[b], t.m[b], t.wave + 0.012 * b], 4 * o);
      }
    });
    for (const [n, a, w] of [['aC', aC, 3], ['aS', aS, 3], ['aD', aD, 3], ['aI', aI, 4]]) boxGeo.setAttribute(n, new THREE.InstancedBufferAttribute(a, w));
    boxGeo.instanceCount = NB;
    boxGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.4);
  }
  const barMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uTS: { value: TS }, uTH: { value: TH } }, U), transparent: true, depthWrite: true,
    vertexShader: `
uniform float uBK, uTS, uTH, uFeat, uAdj, uOut;
attribute vec3 aC, aS, aD; attribute vec4 aI;
varying vec3 vN, vV, vC; varying float vAl, vTop;
${SIDE}
${ICE}
void main() {
  float sd = slabSide(aC); vec3 n = slabN(aC) * sd;
  float g = smoothstep(0.0, 1.0, clamp((uFeat * 1.45 - aI.w) / 0.45, 0.0, 1.0));
  float v = mix(aI.y, aI.z, smoothstep(0.2, 0.85, uAdj));
  float h = (${H0.toFixed(4)} + ${HB.toFixed(4)} * pow(v, 1.6)) * g * uOut * (1.0 - 0.45 * smoothstep(0.0, 0.5, uAdj));
  float bx = mod(aI.x, 4.0), by = floor(aI.x / 4.0), bw = uTS * 0.25 * 0.66 * (1.0 - 0.3 * smoothstep(0.0, 0.6, uAdj));
  vec3 o = aC + n * (uTH * 0.5 + 0.0018) + aS * ((bx + 0.5) * 0.25 - 0.5) * uTS * 0.86 + aD * ((by + 0.5) * 0.25 - 0.5) * uTS * 0.86;
  vec3 p = o + aS * position.x * bw - aD * position.y * bw * sd + n * position.z * h;   // (aS, -aD, n) is right-handed: the faces wind outwards
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * (aS * normal.x - aD * normal.y * sd + n * normal.z)); vV = -mv.xyz;
  vC = ice(v) * (0.75 + 0.5 * v); vAl = step(0.0005, h); vTop = position.z;
  gl_Position = projectionMatrix * mv;
  if (vAl < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vN, vV, vC; varying float vAl, vTop;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.45, 0.6, 0.65));
  float df = max(dot(n, l), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = vC * (0.5 + 0.7 * df) * mix(0.5, 1.15, vTop) + mix(vC, vec3(1.0), 0.5) * fr * 0.25;
  gl_FragColor = vec4(col, uA);
}`,
  });
  set.mats.push(barMat);
  const bars = new THREE.Mesh(boxGeo, barMat);
  bars.frustumCulled = false; bars.renderOrder = 6;
  set.group.add(bars);

  // ------------------------------------------------------- the network of neighbouring tiles
  // A node floats over each tile (a lit sphere in the tile's colour: its description, its own and then mixed), joined
  // to its eight neighbours by glowing tubes; light runs both ways along them (the messages), and the colours mix.
  // Then the nodes lift off into a 3D map of their mixed descriptions (the first three principal components), where
  // alike tiles gather; there they take their group's colour (a domain), and fly back down to colour the section.
  const HN = 0.05;   // how high the network floats over the slab (above the tallest bars)
  // the map: principal components of the mixed descriptions (power iteration, deflated), scaled to a ball
  const ECEN = [0.04, 0.68, 0.3], ER = 0.58;
  {
    const n = kept.length, mu = new Array(NF).fill(0);
    for (const t of kept) for (let f = 0; f < NF; f++) mu[f] += t.m[f] / n;
    const Cv = Array.from({ length: NF }, () => new Array(NF).fill(0));
    for (const t of kept) for (let a = 0; a < NF; a++) for (let b = 0; b < NF; b++) Cv[a][b] += (t.m[a] - mu[a]) * (t.m[b] - mu[b]) / n;
    const PC = [];
    for (let k = 0; k < 3; k++) {
      let w = Array.from({ length: NF }, (_, i) => Math.sin(i * 1.7 + k));
      for (let it = 0; it < 60; it++) {
        const x = Cv.map(r => r.reduce((s, c, j) => s + c * w[j], 0));
        for (const p of PC) { const d = x.reduce((s, c, j) => s + c * p.w[j], 0); for (let j = 0; j < NF; j++) x[j] -= d * p.w[j]; }
        const l = Math.hypot(...x) || 1; w = x.map(c => c / l);
      }
      const lam = Cv.map(r => r.reduce((s, c, j) => s + c * w[j], 0)).reduce((s, c, j) => s + c * w[j], 0);
      PC.push({ w, lam });
    }
    const Z = kept.map(t => PC.map(p => t.m.reduce((s, v, f) => s + (v - mu[f]) * p.w[f], 0) / Math.sqrt(Math.max(p.lam, 1e-9))));
    const rad = Z.map(z => Math.hypot(...z)).sort((a, b) => a - b)[Math.floor(n * 0.95)] || 1;
    // (each drawn 60 % of the way towards its own kind's middle, the middles a little apart, so the groups read as
    // groups: illustrative, the method clusters in the full description)
    const mid = DOM.map((_, d) => { const m = [0, 0, 0]; let c = 0; kept.forEach((t, k) => { if (t.dom === d) { for (let q = 0; q < 3; q++) m[q] += Z[k][q]; c++; } }); return m.map(v => 1.2 * v / Math.max(1, c)); });
    kept.forEach((t, k) => { const z = Z[k].map((v, q) => v + 0.6 * (mid[t.dom][q] - v)); t.e = [ECEN[0] + z[0] / rad * ER * 1.2, ECEN[1] + z[1] / rad * ER * 0.8, ECEN[2] + z[2] / rad * ER * 0.7]; t.ph = R() * 6.28; t.gw = 0.5 * R(); });
  }
  // each group's middle in the map (for its label), and how many tiles it has
  const GC = DOM.map((_, d) => { const m = [0, 0, 0]; let c = 0; for (const t of kept) if (t.dom === d) { for (let q = 0; q < 3; q++) m[q] += t.e[q]; c++; } return { p: m.map(v => v / Math.max(1, c)), n: c }; });
  // nodes (instanced lit spheres) and their halos (instanced quads facing the camera)
  const NK = kept.length;
  const nodeGeo = new THREE.InstancedBufferGeometry();
  {
    const s = new THREE.IcosahedronGeometry(1, 1);
    nodeGeo.setAttribute('position', s.attributes.position); nodeGeo.setAttribute('normal', s.attributes.normal);
    if (s.index) nodeGeo.setIndex(s.index);
  }
  const haloGeo = new THREE.InstancedBufferGeometry();
  haloGeo.setIndex([0, 1, 2, 0, 2, 3]);
  haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  const NA = { aC: 3, aE: 3, aT0: 3, aT1: 3, aDc: 3, aW: 4 }, nAttr = {};
  for (const k in NA) nAttr[k] = new THREE.InstancedBufferAttribute(new Float32Array(NK * NA[k]), NA[k]);
  function fillNodes() {
    kept.forEach((t, k) => {
      nAttr.aC.array.set(t.p, 3 * k); nAttr.aE.array.set(t.e, 3 * k); nAttr.aT0.array.set(t.tint, 3 * k); nAttr.aT1.array.set(t.tintM, 3 * k);
      nAttr.aDc.array.set([uCol[t.dom].x, uCol[t.dom].y, uCol[t.dom].z].map(x => clamp(x * 1.15, 0, 1)), 3 * k);
      nAttr.aW.array.set([t.wave, 0.45 * dCL(t) / 1.4 + t.gw * 0.35, t.ph, t.dord], 4 * k);
    });
    for (const k in nAttr) nAttr[k].needsUpdate = true;
  }
  fillNodes();
  for (const k in NA) { nodeGeo.setAttribute(k, nAttr[k]); haloGeo.setAttribute(k, nAttr[k]); }
  nodeGeo.instanceCount = haloGeo.instanceCount = NK;
  nodeGeo.boundingSphere = haloGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);
  // where a node is (in the vertex shaders): over its tile, in flight, in the map, or back down; its colour and size
  const NODEGL = `
uniform float uBK, uTH, uAdj, uNet, uGrp, uLand, uTime;
attribute vec3 aC, aE, aT0, aT1, aDc; attribute vec4 aW;
${SIDE}
vec3 nodeAt(out vec3 col, out float vis) {
  float sd = slabSide(aC); vec3 n = slabN(aC) * sd, home = aC + n * (uTH * 0.5 + ${HN.toFixed(3)});
  // appears in a wave from the close-up tile; lifts (staggered), arcs out towards you and up into the map, drifts there
  float on = smoothstep(0.0, 1.0, clamp((uNet * 1.5 - aW.x) / 0.5, 0.0, 1.0));
  float g = smoothstep(0.0, 1.0, clamp((uGrp * 1.6 - aW.y) / 0.6, 0.0, 1.0)), ld = smoothstep(0.0, 1.0, clamp((uLand * 1.6 - aW.y) / 0.6, 0.0, 1.0));
  vec3 e = aE + 0.012 * vec3(sin(uTime * 0.7 + aW.z), sin(uTime * 0.55 + aW.z * 1.3), cos(uTime * 0.6 + aW.z));
  vec3 mid = mix(home, e, 0.5) + vec3(0.0, 0.06, 0.18);
  float u = g * (1.0 - ld);
  vec3 p = mix(mix(home, mid, u), mix(mid, e, u), u);
  // its colour: its own description, then the mixed one; in the map its group's colour; down again, it melts into the wash
  col = mix(mix(aT0, aT1, smoothstep(0.25, 0.85, uAdj)), aDc, smoothstep(0.35, 0.9, g));
  vis = max(on, step(0.001, uGrp) * 1.0) * (1.0 - smoothstep(0.7, 1.0, ld));
  return p;
}`;
  const nodeMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uR: { value: 0.0062 } }, U), transparent: true, depthWrite: true,
    vertexShader: NODEGL + `
uniform float uR;
varying vec3 vN, vV, vC; varying float vA;
void main() {
  vec3 col; float vis;
  vec3 p = nodeAt(col, vis);
  vec4 mv = modelViewMatrix * vec4(p + position * uR * (0.4 + 0.6 * vis) * (1.0 + 1.5 * smoothstep(0.3, 1.0, uGrp) * (1.0 - uLand)), 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = col; vA = vis;
  gl_Position = projectionMatrix * mv;
  if (vis < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vN, vV, vC; varying float vA;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.45, 0.6, 0.65));
  float df = max(dot(n, l), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 2.2), sp = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);
  vec3 col = vC * (0.45 + 0.75 * df) + mix(vC, vec3(1.0), 0.5) * fr * 0.6 + vec3(sp * 0.35);
  gl_FragColor = vec4(col, uA * vA);
}`,
  });
  set.mats.push(nodeMat);
  const nodes = new THREE.Mesh(nodeGeo, nodeMat);
  nodes.frustumCulled = false; nodes.renderOrder = 8;
  set.group.add(nodes);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uR: { value: 0.0062 } }, U), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: NODEGL + `
uniform float uR;
varying vec3 vC; varying float vA; varying vec2 vQ;
void main() {
  vec3 col; float vis;
  vec3 p = nodeAt(col, vis);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * uR * 3.6 * (1.0 + 1.5 * smoothstep(0.3, 1.0, uGrp) * (1.0 - uLand)) * length(modelViewMatrix[0].xyz);
  vC = col; vA = vis; vQ = position.xy;
  gl_Position = projectionMatrix * mv;
  if (vis < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vC; varying float vA; varying vec2 vQ;
void main() {
  float d = length(vQ);
  if (d > 1.0) discard;
  float g = exp(-max(d * 3.6 - 0.9, 0.0) * 1.5) * smoothstep(1.0, 0.55, d);
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.2) * g * 0.7, g * 0.6 * vA * uA);
}`,
  });
  set.mats.push(haloMat);
  const halos = new THREE.Mesh(haloGeo, haloMat);
  halos.frustumCulled = false; halos.renderOrder = 9;
  set.group.add(halos);

  // the links: a ribbon per pair of neighbours (eight around a tile), turned to face the camera and shaded as a round
  // tube, its colour running from one end's tile to the other's; messages are bright pulses running both ways
  const LK = [];
  for (const t of kept) for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { const u = T(t.i + di, t.j + dj); if (u && u.keep) LK.push([t, u, di && dj ? 1 : 0]); }
  const linkGeo = new THREE.InstancedBufferGeometry();
  linkGeo.setIndex([0, 1, 2, 0, 2, 3]);
  linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  {
    const n = LK.length, at = {};
    for (const k of ['aA', 'aB', 'aA0', 'aA1', 'aB0', 'aB1']) at[k] = new Float32Array(n * 3);
    at.aW = new Float32Array(n * 4);
    LK.forEach(([a, b, dg], k) => {
      at.aA.set(a.p, 3 * k); at.aB.set(b.p, 3 * k); at.aA0.set(a.tint, 3 * k); at.aA1.set(a.tintM, 3 * k); at.aB0.set(b.tint, 3 * k); at.aB1.set(b.tintM, 3 * k);
      at.aW.set([Math.min(a.wave, b.wave), R(), R(), dg], 4 * k);
    });
    for (const k in at) linkGeo.setAttribute(k, new THREE.InstancedBufferAttribute(at[k], k === 'aW' ? 4 : 3));
    linkGeo.instanceCount = n;
    linkGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.4);
  }
  const linkMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uW: { value: 0.0029 } }, U), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
uniform float uBK, uTH, uNet, uAdj, uGrp, uW;
attribute vec3 aA, aB, aA0, aA1, aB0, aB1; attribute vec4 aW;
varying vec3 vCA, vCB; varying vec2 vQ; varying float vVis, vPh, vSp, vLen;
${SIDE}
void main() {
  float sa = slabSide(aA), sb = slabSide(aB);
  vec3 A = aA + slabN(aA) * sa * (uTH * 0.5 + ${HN.toFixed(3)}), B = aB + slabN(aB) * sb * (uTH * 0.5 + ${HN.toFixed(3)});
  float on = smoothstep(0.0, 1.0, clamp((uNet * 1.5 - aW.x - 0.06) / 0.5, 0.0, 1.0)) * (1.0 - smoothstep(0.0, 0.25, uGrp));
  vec4 a = modelViewMatrix * vec4(A, 1.0), b = modelViewMatrix * vec4(B, 1.0);
  vec3 dir = b.xyz - a.xyz, mid = mix(a.xyz, b.xyz, position.x);
  vec3 sideV = normalize(cross(dir, mid));
  vec4 mv = vec4(mid + sideV * position.y * uW * (aW.w > 0.5 ? 0.75 : 1.0) * length(modelViewMatrix[0].xyz), 1.0);
  float m = smoothstep(0.25, 0.85, uAdj);
  vCA = mix(aA0, aA1, m); vCB = mix(aB0, aB1, m);
  vQ = position.xy; vVis = on * (aW.w > 0.5 ? 0.6 : 1.0); vPh = aW.y; vSp = aW.z; vLen = length(dir);
  gl_Position = projectionMatrix * mv;
  if (vVis < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA, uTime, uAdj;
varying vec3 vCA, vCB; varying vec2 vQ; varying float vVis, vPh, vSp, vLen;
void main() {
  float r = abs(vQ.y), core = 1.0 - r * r;
  // messages: two pulses on each link, one each way, while the tiles listen to their neighbours
  float t1 = fract(uTime * (0.32 + 0.12 * vSp) + vPh), t2 = fract(uTime * (0.32 + 0.12 * vSp) + vPh + 0.5);
  float msg = (exp(-pow((vQ.x - t1) / 0.08, 2.0)) + exp(-pow((1.0 - vQ.x - t2) / 0.08, 2.0))) * smoothstep(0.0, 0.3, uAdj) * (1.0 - smoothstep(0.85, 1.0, uAdj) * 0.6);
  vec3 c = mix(vCA, vCB, smoothstep(0.15, 0.85, vQ.x));
  vec3 col = mix(c, vec3(1.0), 0.25 + 0.5 * pow(core, 4.0)) * (0.5 + 2.4 * msg);
  float a = pow(core, 1.5) * vVis * (0.45 + 0.55 * msg);
  gl_FragColor = vec4(col * a, a) * uA;
}`,
  });
  set.mats.push(linkMat);
  const links = new THREE.Mesh(linkGeo, linkMat);
  links.frustumCulled = false; links.renderOrder = 7;
  set.group.add(links);

  // ------------------------------------------------------------- the gauge
  // the submucosa's share of the gut's slides in the preprint (its example; not of this drawn section, whose submucosa
  // thins by the same fraction) and the age, on a small slab of dark glass above the section (its face drawn on a
  // canvas, its edges lit)
  const GW = 0.68, GH = 0.26, GD = 0.022, GCEN = [-0.5, 0.57, 0.06];
  const gCan = document.createElement('canvas'); gCan.width = 512; gCan.height = 196;
  const gTex = new THREE.CanvasTexture(gCan);
  gTex.minFilter = THREE.LinearFilter; gTex.generateMipmaps = false;
  const gaugeU = { uA: set.uA, uK: { value: 0 }, tMap: { value: gTex } };
  const gaugeMat = new THREE.ShaderMaterial({
    uniforms: gaugeU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main() { vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `
uniform sampler2D tMap; uniform float uA, uK; varying vec2 vUv; varying vec3 vN, vV;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  float fr = pow(1.0 - abs(dot(n, v)), 2.0), df = max(dot(n, normalize(vec3(-0.45, 0.6, 0.65))), 0.0);
  vec4 c = abs(n.z) > 0.9 && gl_FrontFacing ? texture2D(tMap, vUv) : vec4(vec3(0.06, 0.1, 0.18) * (0.6 + 0.8 * df) + vec3(0.5, 0.65, 0.9) * fr, 0.92);
  gl_FragColor = vec4(c.rgb, c.a * uA * uK);
}`,
  });
  set.mats.push(gaugeMat);
  const gauge = new THREE.Mesh(new THREE.BoxGeometry(GW, GH, GD), gaugeMat);
  gauge.position.set(...GCEN); gauge.rotation.x = -0.1; gauge.renderOrder = 10;
  set.group.add(gauge);
  const fmt = x => x.toFixed(1);
  let gKey = '';
  function drawGauge(share, age) {
    const key = fmt(share) + '|' + Math.round(age) + '|' + DOM[1].css;
    if (key === gKey) return;
    gKey = key;
    const g = gCan.getContext('2d'), W = gCan.width, H = gCan.height, col = DOM[1].css;
    g.clearRect(0, 0, W, H);
    const rnd = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.fillStyle = 'rgba(4,9,18,0.94)'; g.fillRect(0, 0, W, H);
    rnd(3, 3, W - 6, H - 6, 14); g.lineWidth = 3; g.strokeStyle = col; g.globalAlpha = 0.75; g.stroke(); g.globalAlpha = 1;
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#e7eef8'; g.font = 'bold 38px sans-serif'; g.textAlign = 'left'; g.fillText('Submucosa', 24, 56);
    g.fillStyle = col; g.font = 'bold 50px sans-serif'; g.textAlign = 'right'; g.fillText(fmt(share) + ' %', W - 24, 60);
    // the share as a bar, with ticks at the two ages' values
    const x0 = 24, x1 = W - 24, y = 84, bh = 22, X = v => x0 + (x1 - x0) * v / 100;
    rnd(x0, y, x1 - x0, bh, 8); g.fillStyle = '#1a2536'; g.fill();
    rnd(x0, y, Math.max(16, X(share) - x0), bh, 8); g.fillStyle = col; g.fill();
    g.fillStyle = '#e7eef8';
    for (const v of [EX.from, EX.to]) g.fillRect(X(v) - 1.5, y - 7, 3, bh + 14);
    g.fillStyle = '#95a6bd'; g.font = '30px sans-serif'; g.textAlign = 'left'; g.fillText('of gut slides at', 24, 162);
    g.fillStyle = '#e7eef8'; g.font = 'bold 44px sans-serif'; g.textAlign = 'right'; g.fillText(Math.round(age) + ' years', W - 24, 166);
    gTex.needsUpdate = true;
  }
  drawGauge(EX.from, AGES[0]);

  // -------------------------------------------- a ghost of the tissue set (harness only)
  // slide_ghost > 0 draws the tour's tissue set under the overlay (the engine shows the real one: it leaves this at 0)
  let ghost = null;
  const ghostS = { tissue_a: 1, tissue_graph: 0, tissue_mark: 0, tissue_embed: 0 };

  // ------------------------------------------------------ anchors and views
  const LA = { mucosa: 0.22, submucosa: 0.2, inner: 0.6, outer: 1.34 };   // where along the section
  // the domains' labels: each at the middle of its layer (at 20) where it is clear of the others' in the domains and
  // age views (the mucosa, submucosa and inner muscle stacked on the left, the patch, the vessels and the outer
  // muscle along the section)
  const bandMid = (s, k) => { const ly = layers(s), e = [ly.top, ly.b1, ly.b2, ly.bm, ly.bot]; return front(s, (e[k] + e[k + 1]) / 2); };
  const DA = [bandMid(LA.mucosa, 0), bandMid(LA.submucosa, 1), bandMid(LA.inner, 2), bandMid(LA.outer, 3),
    front(AG.s + AG.A * 0.6, AG.d), front(VES[0].s + 0.01, VES[0].d)];
  const above = (t, h, ds) => v3.add(v3.add(t.p, v3.mul(nrm(t.p[0]), TH / 2 + h)), v3.mul(t.ts, ds || 0));
  const anchors = {
    tiles: front(5.5 * TS, D0 + 0.004),
    feat: above(CL, HB + 0.012, TS * 0.55), listen: above(CL, HN), close: above(CL, 0.012),
    cloud: [ECEN[0] - ER * 0.3, ECEN[1] + ER * 0.95, ECEN[2]], cloudC: ECEN.slice(),
    mucosa: DA[0], submucosa: DA[1], inner: DA[2], outer: DA[3], lymphoid: DA[4], vessels: DA[5],
    muscularis: front(1.05, (layers(1.05).b2 + layers(1.05).bot) / 2),
    gauge: [GCEN[0] + GW / 2 + 0.01, GCEN[1] + 0.04, GCEN[2]],
  };
  GC.forEach((g, k) => { anchors['grp' + k] = [g.p[0] + 0.03, g.p[1] + 0.05, g.p[2]]; });
  const azAt = p => { const n = nrm(p[0]); return Math.atan2(n[0], n[2]) * 180 / PI; };
  const Tc = front(0.72, 0.2), Fc = above(CL, 0.016), Nc = above(CL, 0.03, TS * 0.5);

  const DK = ['mucosa', 'submucosa', 'inner', 'outer', 'lymphoid', 'vessels'];
  const gaugeOn = S => Math.max(S.slide_gauge || 0, prog(S.slide_age, 0, 0.05));
  const domA = (k, S) => {
    const f = S.slide_focus, sel = f < 0.05 ? 1 : Math.max(0, 1 - Math.abs(f - k - 1));
    return Math.max(prog(S.slide_domain, 0.62, 0.95), clamp(f, 0, 1)) * sel * (k >= 4 ? 1 - gaugeOn(S) : 1);
  };
  let lastAge = 0;
  const VIEWS = ['section', 'tiles', 'matrix', 'close', 'group', 'domains', 'age'];

  return Object.assign(set, {
    params: { slide_a: 1, slide_tiles: 0, slide_feat: 0, slide_adj: 0, slide_group: 0, slide_domain: 0, slide_age: 0, slide_focus: 0, slide_gauge: 0, slide_ghost: 0 },
    update(S, t, dt) {
      const tl = S.slide_tiles, ft = S.slide_feat, ad = S.slide_adj, gr = clamp(S.slide_group || 0, 0, 2), dm = S.slide_domain, ag = S.slide_age, fc = S.slide_focus;
      U.uTiles.value = tl; U.uAdj.value = ad; U.uDom.value = dm; U.uAge.value = ag; U.uFoc.value = fc;
      U.uGrp.value = clamp(gr, 0, 1); U.uLand.value = clamp(gr - 1, 0, 1);
      // the network shows with the neighbours (and while the nodes are in the map); the bars from the features on, until
      // the tiles group
      U.uNet.value = Math.max(ad, gr > 0 && gr < 2 ? 1 : 0);
      U.uFeat.value = ft * (1 - prog(gr, 0, 0.3));
      U.uOut.value = 1 - prog(gr, 0, 0.25);
      U.uDim.value = Math.max(ad * (1 - prog(gr, 0, 0.3)), 0.85 * prog(gr, 0.1, 0.5) * (1 - prog(gr, 1, 1.4)));   // (the slide dims under the map)
      // hidden parts are not drawn at all
      wash.visible = tl + ft + ad + dm + fc > 0.001;
      bars.visible = ft > 0.001 && U.uOut.value > 0.003;
      links.visible = ad > 0.001 && gr < 0.25;
      nodes.visible = halos.visible = (ad > 0.001 || gr > 0.001) && gr < 1.999;
      const gv = gaugeOn(S);
      gaugeU.uK.value = gv; gauge.visible = gv > 0.003;
      if (gauge.visible) drawGauge(lerp(EX.from, EX.to, ag), lerp(AGES[0], AGES[1], ag));
      lastAge = ag;
      // the harness's ghost of the tissue set under the overlay
      if (S.slide_ghost > 0.001 && !ghost && SETS.tissue) { ghost = SETS.tissue(K); set.group.add(ghost.group); }
      if (ghost) { ghost.setAlpha(S.slide_ghost); if (S.slide_ghost > 0.003) ghost.update(ghostS, t, dt); }
    },
    anchors,
    labels: [
      { text: ['Tiles', ''], at: 'tiles', cls: 'cyn', alpha: S => prog(S.slide_tiles, 0.15, 0.45) * (1 - prog(S.slide_feat, 0.05, 0.25)) * (1 - prog(Math.max(S.slide_adj, S.slide_domain), 0, 0.2)) },
      { text: ['Features', 'a list of numbers a tile'], at: 'feat', cls: 'cyn', alpha: S => prog(S.slide_feat, 0.45, 0.75) * (1 - prog(Math.max(S.slide_adj, S.slide_group || 0, S.slide_domain), 0.05, 0.3)) },
      { text: ['Each tile', 'listens to its neighbours'], at: 'listen', cls: 'cyn', alpha: S => prog(S.slide_adj, 0.3, 0.6) * (1 - prog(Math.max(S.slide_group || 0, S.slide_domain), 0.02, 0.2)) },
      // the method's last step: alike tiles gather in the map of their descriptions
      { text: ['Alike tiles', 'gather: a domain each'], at: 'cloud', cls: 'cyn', alpha: S => prog(S.slide_group || 0, 0.6, 0.9) * (1 - prog(S.slide_group || 0, 1.05, 1.35)) * (1 - clamp(S.slide_focus, 0, 1)) },
      // (each group in the map named as the domain it becomes; groups of a handful of tiles too small to name)
      ...DOM.map((d, k) => ({ text: d.label, at: 'grp' + k, cls: d.cls, alpha: S => (GC[k].n >= 8 ? 1 : 0) * prog(S.slide_group || 0, 0.75, 0.95) * (1 - prog(S.slide_group || 0, 1.02, 1.25)) * (1 - clamp(S.slide_focus, 0, 1)) })),
      ...DOM.map((d, k) => ({ text: d.label, at: DK[k], cls: d.cls, alpha: S => domA(k, S) })),
      // (the numbers are on the gauge)
      { text: ['Gut submucosa', 'thins with age'], at: 'gauge', cls: 'mag', alpha: S => gaugeOn(S) },
    ],
    cam: {
      default: [0, 6, 3.2, 0, 0, 0], section: [0, 6, 3.2, 0, 0, 0],
      tiles: [azAt(Tc) - 24, 12, 1.7, ...Tc],
      // (the features and the network from a slant, so the bars and the floating network stand out of the slide)
      matrix: [azAt(Fc) - 22, 20, 0.56, ...Fc],
      close: [azAt(Nc) - 14, 26, 0.8, ...Nc],
      // (the map and the whole section under it)
      group: [-12, 12, 3.0, ECEN[0] + 0.04, ECEN[1] * 0.5, ECEN[2] * 0.45],
      domains: [5, 5, 2.85, 0.02, -0.02, 0],
      age: [0, 8, 3.25, -0.06, 0.12, 0],
    },
    controls: [
      { key: 'view', label: 'View', options: [['section', 'Section'], ['tiles', 'Tiles'], ['matrix', 'Features'], ['close', 'Neighbours'], ['group', 'Groups'], ['domains', 'Domains'], ['age', 'Age']] },
      { key: 'age', label: 'Age', options: [['20', '20'], ['70', '70']] },
    ],
    explore(c) {
      const i = VIEWS.indexOf(c.view);
      return {
        slide_tiles: i >= 1 ? 1 : 0, slide_feat: i === 2 || i === 3 ? 1 : 0, slide_adj: i >= 3 ? 1 : 0, slide_group: i === 4 ? 1 : i >= 5 ? 2 : 0,
        slide_domain: i >= 4 ? 1 : 0, slide_age: i >= 5 && c.age === '70' ? 1 : 0, slide_gauge: i === 6 ? 1 : 0,
      };
    },
    api() {
      return {
        domains: DOM.map(d => d.name), titles: DOM.map(d => d.title), colours: DOM.map(d => d.css),
        // the preprint's example (from, to: % of gut slides) and this drawn section's shares at 20 and 70 (% of its area,
        // in the order of domains)
        shares: { from: EX.from, to: EX.to, tiles: kept.length, here20: SH20.map(x => +x.toFixed(1)), here70: SH70.map(x => +x.toFixed(1)) },
        // the domain under the ray (at the age now shown), or -1
        pick(rc) {
          if (!set.group.visible) return -1;
          const hits = [];
          wash.raycast(rc, hits);
          hits.sort((a, b) => a.distance - b.distance);
          for (const h of hits) {
            if (!h.uv) continue;
            const k = domAt(h.uv.x * L, D0 + h.uv.y * NY * TS, lastAge);
            if (k >= 0) return k;
          }
          return -1;
        },
        domainColour,
        // take another set's palette (fn(name) -> '#rrggbb' or [r, g, b])
        recolour(fn) {
          DOM.forEach(d => { const c = fn(d.name); if (c) d.css = Array.isArray(c) ? '#' + c.map(x => b8(x).toString(16).padStart(2, '0')).join('') : c; });
          fillCols(); fillNodes(); gKey = '';
        },
      };
    },
    textures: [texT, gTex],
    dispose() { if (ghost) ghost.dispose(); K.dispose(set); texT.dispose(); gTex.dispose(); },
    tileCount: kept.length, linkCount: LK.length,
  });
};

// The atlas set of the microanatomy story (stories/micro.js): the GTEx slide library, the atlas of 40 sections and
// their domains, the tile cloud, ageing (the volcano and the examples' morph) and trajectories over age. Manifest:
// atlas.md. Slides, sections and tiles are drawn (procedural), never the GTEx images; shares, the volcano and the
// curves come from MICRO_DATA (the preprint's numbers and readings of the talk's figures), stand-ins where it has none.
// Everything is drawn as lit 3D objects: each slide a thin glass box with its tissue on it, each section a slab of tiles
// standing in relief (each domain its own height), the tiles flying into the cloud as small lit cubes, the volcano's
// bubbles as lit spheres over a glass floor with their shadows, the trajectories as lit ribbons over glass lanes.
SETS.atlas = function (K) {
  const { THREE, clamp, lerp, prog, rng, gauss } = K;
  const set = K.newSet('atlas');
  const MD = typeof MICRO_DATA !== 'undefined' ? MICRO_DATA : {};
  const F = MD.facts || {}, FIG = MD.figures || {}, EX = MD.examples || [], GR = MD.graph || { nodes: [], edges: [] };
  const PI = Math.PI, c01 = x => clamp(x, 0, 1), sm = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const fmt = n => Number(n).toLocaleString('en-GB'), cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const AGES = F.ages || [20, 70], f1 = x => String(+(+x).toFixed(1));
  const hex = c => '#' + c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');

  // ---------------------------------------------------------------- the 40 GTEx tissues and their domains
  // [GTEx name, short name, organ, slide weight (GTEx sample counts, scaled to the preprint's total: illustrative),
  //  name in the talk's atlas figure, shape, domains [name, % (the figure's share replaces it), mode, options]]
  // modes: E rim, P patches, S specks, L layers by depth (from the surface or the lumen inwards, in the order given).
  // Domains of the 11 tissues the talk's figure does not show are illustrative.
  const TT = [
    ['Adipose - Subcutaneous', 'Adipose, under skin', 'Adipose', 663, '', { k: 'lobes', n: 9 }, [['tissue edge', 5, 'E'], ['blood vessels', 3, 'S', { n: 8 }], ['adipose tissue', 72, 'L'], ['connective tissue', 20, 'L']]],
    ['Adipose - Visceral (Omentum)', 'Adipose, omentum', 'Adipose', 541, 'adipose - visceral', { k: 'lobes', n: 13, lacy: 0.3 }, [['lymph node', 13, 'P', { n: 1, s: 0.3 }], ['blood vessels and hemorrhage', 1, 'S', { n: 6 }], ['connective tissue', 86, 'L']]],
    ['Adrenal Gland', 'Adrenal gland', 'Adrenal Gland', 258, 'adrenal gland', { k: 'round', sx: 0.66, sy: 0.95, w: 0.3 }, [['tissue edge', 14, 'E'], ['adrenal cortex', 33, 'L'], ['fibroadipose tissue', 53, 'L']]],
    ['Artery - Aorta', 'Aorta', 'Artery', 432, 'aorta', { k: 'strip', amp: 0.05, w: 0.17, rot: 0.12, fq: 0.8 }, [['tunica intima', 13, 'L'], ['tunica media', 75, 'L'], ['tunica adventitia', 12, 'L']]],
    ['Artery - Coronary', 'Coronary artery', 'Artery', 240, 'artery coronary', { k: 'ring', rin: 0.55, w: 0.1, ecc: 0.08 }, [['calcified plaques', 0.6, 'P', { n: 2, s: 0.25, d: [0, 0.3], keep: 1 }], ['tunica intima', 38, 'L'], ['tunica media', 38, 'L'], ['tunica adventitia', 24, 'L']]],
    ['Artery - Tibial', 'Tibial artery', 'Artery', 663, '', { k: 'ring', rin: 0.4, w: 0.1, ecc: 0.04 }, [['calcified plaques', 0.6, 'P', { n: 2, s: 0.22, d: [0, 0.3] }], ['tunica intima', 15, 'L'], ['tunica media', 50, 'L'], ['tunica adventitia', 34.4, 'L']]],
    ['Bladder', 'Bladder', 'Bladder', 21, 'bladder', { k: 'strip', amp: 0.1, w: 0.3, rot: 1.45, fq: 1 }, [['mucosa', 9, 'L'], ['muscularis', 63, 'L'], ['adventitia subserosa', 28, 'L']]],
    ['Brain - Cerebellum', 'Cerebellum', 'Brain', 241, 'cerebellum', { k: 'folia', n: 12, dp: 0.42 }, [['molecular layer', 51, 'L'], ['granular layer', 37, 'L'], ['cerebral medulla', 12, 'L']]],
    ['Brain - Cortex', 'Brain cortex', 'Brain', 255, 'brain cortex', { k: 'folia', n: 3, dp: 0.36 }, [['tissue edge', 10, 'E'], ['gray matter', 37, 'L'], ['white matter', 53, 'L']]],
    ['Breast - Mammary Tissue', 'Breast', 'Breast', 459, 'breast', { k: 'lobes', n: 9, lacy: 0.5, sy: 0.7 }, [['ductal tissue', 8, 'S', { n: 7 }], ['fibromuscular tissue', 26, 'P', { n: 3 }], ['connective tissue', 62, 'L'], ['adipose tissue', 4, 'L']]],
    ['Cervix - Ectocervix', 'Ectocervix', 'Cervix', 9, 'ectocervix', { k: 'round', sx: 0.62, sy: 0.95, w: 0.4 }, [['tissue edge', 11, 'E'], ['fibromuscular tissue', 1, 'P', { n: 2, s: 0.2, d: [0.5, 1] }], ['squamous epithelium', 9, 'L'], ['cervical stroma', 79, 'L']]],
    ['Cervix - Endocervix', 'Endocervix', 'Cervix', 10, '', { k: 'round', sx: 0.9, sy: 0.72, w: 0.35 }, [['endocervical epithelium', 15, 'E'], ['cervical stroma', 70, 'L'], ['fibromuscular tissue', 15, 'L']]],
    ['Colon - Sigmoid', 'Colon, sigmoid', 'Colon', 373, '', { k: 'strip', amp: 0.18, w: 0.34, rot: 0.3, fold: 0.07, fq: 1.3 }, [['mucosa', 15, 'L'], ['submucosa', 25, 'L'], ['muscularis', 60, 'L']]],
    ['Colon - Transverse', 'Colon, transverse', 'Colon', 406, 'colon', { k: 'strip', amp: 0.24, w: 0.27, rot: 1.25, fold: 0.11, fq: 1.7 }, [['mucosa', 41, 'L'], ['submucosa', 36, 'L'], ['muscularis', 22, 'L']]],
    ['Esophagus - Gastroesophageal Junction', 'Oesophagus, junction', 'Esophagus', 375, '', { k: 'strip', amp: 0.1, w: 0.4, rot: -0.2, fold: 0.05 }, [['mucosa', 12, 'L'], ['submucosa', 18, 'L'], ['muscularis', 70, 'L']]],
    ['Esophagus - Mucosa', 'Oesophagus, mucosa', 'Esophagus', 555, '', { k: 'strip', amp: 0.16, w: 0.26, rot: 0.1, fold: 0.04, fq: 1.8 }, [['squamous epithelium', 45, 'L'], ['mucosa lamina propria', 30, 'L'], ['submucosa', 25, 'L']]],
    ['Esophagus - Muscularis', 'Oesophagus, muscle', 'Esophagus', 515, '', { k: 'strip', amp: 0.06, w: 0.5, rot: 0.5 }, [['connective tissue', 10, 'E'], ['inner circular smooth muscle', 45, 'L'], ['outer longitudinal smooth muscle', 45, 'L']]],
    ['Fallopian Tube', 'Fallopian tube', 'Fallopian Tube', 9, 'fallopian tube', { k: 'ring', rin: 0.48, w: 0.12, fold: 0.42, nf: 7 }, [['mucosa', 32, 'L'], ['muscularis', 42, 'L'], ['fibromuscular tissue', 27, 'L']]],
    ['Heart - Atrial Appendage', 'Heart, atrium', 'Heart', 429, '', { k: 'lobes', n: 7, lacy: 0.35 }, [['fibroadipose tissue', 20, 'E'], ['cardiac muscle', 65, 'L'], ['connective tissue', 15, 'L']]],
    ['Heart - Left Ventricle', 'Heart, left ventricle', 'Heart', 432, 'heart', { k: 'ring', rin: 0.34, w: 0.3, ecc: 0.25, sq: 1 }, [['fibroadipose tissue', 1, 'S', { n: 3, d: [0.7, 1] }], ['cardiac muscle', 91, 'L'], ['connective tissue', 8, 'L']]],
    ['Kidney - Cortex', 'Kidney cortex', 'Kidney', 85, '', { k: 'block', sx: 0.85, sy: 0.8, w: 0.2 }, [['connective tissue', 10, 'E'], ['renal glomeruli', 12, 'S', { n: 22, s: 0.07 }], ['renal tubules', 78, 'L']]],
    ['Kidney - Medulla', 'Kidney medulla', 'Kidney', 4, 'kidney medulla', { k: 'block', sx: 0.86, sy: 0.86, w: 0.15 }, [['connective tissue', 12, 'E'], ['medulla', 5, 'S', { n: 5, s: 0.1 }], ['renal glomeruli', 24, 'L'], ['medulla kidney tubules', 59, 'L']]],
    ['Liver', 'Liver', 'Liver', 226, 'liver', { k: 'block', sx: 0.86, sy: 0.88, w: 0.2 }, [['connective tissue', 17, 'E'], ['portal vein', 9, 'S', { n: 12, s: 0.08 }], ['liver parenchyma', 74, 'L']]],
    ['Lung', 'Lung', 'Lung', 578, '', { k: 'lobes', n: 18 }, [['blood vessels', 6, 'S', { n: 6 }], ['fibroadipose tissue', 6, 'P', { n: 2 }], ['connective tissue', 8, 'P', { n: 3 }], ['alveolar space', 42, 'L'], ['lung parenchyma', 38, 'L']]],
    ['Minor Salivary Gland', 'Salivary gland', 'Minor Salivary Gland', 162, 'minor salivary gland', { k: 'lobes', n: 8, sx: 0.55 }, [['mucosa', 8, 'E'], ['muscularis', 9, 'P', { n: 1, at: [0, 0.75] }], ['glandular and ductal elements', 28, 'L'], ['submucosa', 23, 'L'], ['fibroadipose tissue', 32, 'L']]],
    ['Muscle - Skeletal', 'Skeletal muscle', 'Muscle', 803, 'skeletal muscle', { k: 'lobes', n: 6, lacy: 0.12 }, [['skeletal muscle', 69, 'L'], ['fibroadipose tissue', 31, 'L']]],
    ['Nerve - Tibial', 'Tibial nerve', 'Nerve', 619, 'tibial nerve', { k: 'fasc', n: 6 }, [['nerve fibers', 48, 'L'], ['epineurium', 52, 'L']]],
    ['Ovary', 'Ovary', 'Ovary', 180, 'ovary', { k: 'round', sx: 0.95, sy: 0.85, w: 0.2, flat: -0.45 }, [['tissue edge', 7, 'E'], ['corpus albicans', 44, 'P', { n: 4, s: 0.32, d: [0.4, 1] }], ['fibrovascular tissue', 3, 'S', { n: 5, s: 0.08 }], ['ovarian cortex', 27, 'L'], ['ovarian stroma', 20, 'L']]],
    ['Pancreas', 'Pancreas', 'Pancreas', 328, 'pancreas', { k: 'lobes', n: 11 }, [['pancreatic parenchyma', 75, 'L'], ['connective tissue', 25, 'L']]],
    ['Pituitary', 'Pituitary', 'Pituitary', 283, 'pituitary', { k: 'round', sx: 0.92, sy: 0.82, w: 0.2 }, [['fibromuscular tissue', 6, 'E'], ['neurohypophysis', 12, 'P', { n: 1, s: 0.5, at: [0.55, -0.45] }], ['adenohypophysis', 83, 'L']]],
    ['Prostate', 'Prostate', 'Prostate', 245, 'prostate', { k: 'block', sx: 0.9, sy: 0.85, w: 0.2 }, [['prostatic acini', 43, 'S', { n: 26, s: 0.12 }], ['fibromuscular tissue', 57, 'L']]],
    ['Skin - Not Sun Exposed (Suprapubic)', 'Skin', 'Skin', 604, 'skin', { k: 'strip', amp: 0.08, w: 0.22, rot: 1.5 }, [['epidermis', 9, 'L'], ['papillary dermis', 27, 'L'], ['reticular dermis', 38, 'L'], ['subdermis', 27, 'L']]],
    ['Skin - Sun Exposed (Lower leg)', 'Skin, sun-exposed', 'Skin', 701, '', { k: 'strip', amp: 0.1, w: 0.3, rot: 1.6 }, [['epidermis', 7, 'L'], ['papillary dermis', 16, 'L'], ['reticular dermis', 50, 'L'], ['subdermis', 27, 'L']]],
    ['Small Intestine - Terminal Ileum', 'Small intestine', 'Small Intestine', 187, 'small intestine', { k: 'strip', amp: 0.38, w: 0.3, fq: 1.5, fold: 0.13, rot: 0.2 }, [['lymphoid Peyer patches', 22, 'P', { n: 3, s: 0.32, d: [0.3, 0.55] }], ['mucosa', 15, 'L'], ['submucosa', 26, 'L'], ['muscularis', 37, 'L']]],
    ['Spleen', 'Spleen', 'Spleen', 241, 'spleen', { k: 'block', sx: 0.68, sy: 0.95, w: 0.15 }, [['tissue edge', 5, 'E'], ['connective tissue', 10, 'S', { n: 10, s: 0.1 }], ['stroma', 85, 'L']]],
    ['Stomach', 'Stomach', 'Stomach', 359, 'stomach', { k: 'strip', amp: 0.05, w: 0.55, rot: 1.57 }, [['gastric foveolae', 13, 'L'], ['gastric glands', 21, 'L'], ['submucosa', 16, 'L'], ['muscularis', 50, 'L']]],
    ['Testis', 'Testis', 'Testis', 361, 'testis', { k: 'round', sx: 0.95, sy: 0.85, w: 0.3 }, [['seminiferous tubules', 62, 'S', { n: 28, s: 0.13 }], ['connective tissue', 38, 'L']]],
    ['Thyroid', 'Thyroid', 'Thyroid', 653, 'thyroid', { k: 'round', sx: 0.75, sy: 0.95, w: 0.25 }, [['cyst', 1, 'P', { n: 1, s: 0.2 }], ['thyroid follicles', 63, 'S', { n: 30, s: 0.11 }], ['connective tissue', 37, 'L']]],
    ['Uterus', 'Uterus', 'Uterus', 142, 'uterus', { k: 'ring', rin: 0.26, w: 0.3, sq: 1, ecc: 0.1 }, [['endometrium', 14, 'L'], ['myometrium', 77, 'L'], ['connective tissue', 8, 'L']]],
    ['Vagina', 'Vagina', 'Vagina', 156, 'vagina', { k: 'strip', amp: 0.12, w: 0.42, rot: 1.4 }, [['squamous epithelium', 9, 'L'], ['lamina propria', 41, 'L'], ['muscularis', 42, 'L'], ['connective tissue', 8, 'L']]],
  ];
  const NT = TT.length;
  const NAMES = TT.map(r => r[0]), SHORT = TT.map(r => r[1]), ORGAN = TT.map(r => r[2]);

  // one spelling per domain (the figure's legends keep the slides' spellings)
  const canon = s => String(s || '').toLowerCase().replace(/\s*\/\s*/g, ' and ').replace(/peyer'?s? pat\w*/, 'lymphoid peyer patches')
    .replace(/^lymphoid lymphoid/, 'lymphoid').replace(/\bmedula\b/g, 'medulla').replace(/adventita/, 'adventitia').replace(/pia matter/, 'pia mater')
    .replace(/calcified plaque$/, 'calcified plaques').replace(/\s+/g, ' ').trim();
  const tissueIx = s => { const n = String(s || '').toLowerCase(); if (!n) return -1;
    let i = NAMES.findIndex(m => m.toLowerCase() === n); if (i < 0) i = NAMES.findIndex(m => m.toLowerCase().startsWith(n));
    if (i < 0) i = TT.findIndex(r => r[4] === n || r[1].toLowerCase() === n); if (i < 0) i = ORGAN.findIndex(o => o.toLowerCase() === n); return i; };

  // the talk's atlas: domains and shares of 29 sections (pixel shares of its maps)
  const FA = Array.isArray(FIG.atlas) ? FIG.atlas : [];
  const figIx = s => { const n = String(s || '').toLowerCase(), i = TT.findIndex(r => r[4] && r[4] === n); return i >= 0 ? i : tissueIx(s); };
  // the talk's volcano: significant changes, used as each domain's drift with age (points a decade, illustrative)
  const VP = (FIG.volcano && Array.isArray(FIG.volcano.points)) ? FIG.volcano.points : [];
  const driftOf = (ti, nm) => { const p = VP.find(q => q.significant !== false && q.tissue && tissueIx(q.tissue) === ti && canon(q.domain) === nm);
    return p ? +p.x : nm === 'connective tissue' ? 0.3 : 0; };

  // the preprint's three examples: which tissue and domain they morph
  const exT = EX.map(e => { let i = tissueIx(e.tissue); if (i < 0 && /gastro|gut|intestin|colon|digest/i.test(e.tissue || '')) i = NAMES.indexOf('Colon - Transverse'); return i; });

  const REC = TT.map((row, ti) => {
    let doms = row[6].map(d => ({ name: canon(d[0]), f20: d[1], mode: d[2], o: d[3] || {} }));
    const fa = FA.find(a => figIx(a.tissue) === ti);
    if (fa && Array.isArray(fa.domains) && fa.domains.length) {
      const sum = fa.domains.reduce((s, d) => s + (+d.share || 0), 0), k = sum > 1.5 ? 1 : 100;
      const fd = fa.domains.map(d => ({ name: canon(d.name), share: Math.max(0.5, (+d.share || 0) * k) }));
      doms = doms.filter(d => d.o.keep || fd.some(q => q.name === d.name));
      for (const d of doms) { const q = fd.find(x => x.name === d.name); if (q) d.f20 = q.share; }
      for (const q of fd) if (!doms.some(d => d.name === q.name)) doms.push({ name: q.name, f20: q.share, mode: q.share < 8 ? 'P' : 'L', o: {} });
    }
    const tot = doms.reduce((s, d) => s + d.f20, 0);
    for (const d of doms) { d.f20 *= 100 / tot; const dr = driftOf(ti, d.name); if (dr) d.f70 = Math.max(0.3, d.f20 + dr * (AGES[1] - AGES[0]) / 10); }
    EX.forEach((e, k) => { if (exT[k] !== ti) return; const nm = canon(e.domain); let d = doms.find(x => x.name === nm);
      if (!d) { d = { name: nm, f20: 0, mode: 'P', o: { n: 3 } }; doms.unshift(d); } d.f20 = +e.from; d.f70 = +e.to; d.ex = k; });
    // the others fill the rest at 20 (the figure's section is one donor's; the example's numbers are the preprint's)
    const exs = doms.reduce((s, d) => s + (d.ex !== undefined ? d.f20 : 0), 0), os = doms.reduce((s, d) => s + (d.ex === undefined ? d.f20 : 0), 0);
    if (exs > 0 && os > 0) for (const d of doms) if (d.ex === undefined) { d.f20 *= (100 - exs) / os; delete d.f70; }
    return doms;
  });
  // shares at age a (0 = 20, 1 = 70). In an example's section only the example changes (the preprint's numbers) and
  // the rest scale to fill; elsewhere the domains that drift follow their line and all are scaled back to 100 %
  function shares(doms, a) {
    const e = doms.find(d => d.ex !== undefined);
    if (e) { const v = lerp(e.f20, e.f70, a), k = (100 - v) / Math.max(1e-6, 100 - e.f20); return doms.map(d => (d === e ? v : d.f20 * k)); }
    const v = doms.map(d => (d.f70 !== undefined ? lerp(d.f20, d.f70, a) : d.f20)), tot = v.reduce((s, x) => s + x, 0) || 1;
    return v.map(x => x * 100 / tot);
  }

  // ---------------------------------------------------------------- domain types, H&E looks and colours
  const GT = {};
  { const N = GR.nodes || []; for (const [a, b] of GR.edges || []) { const A = N[a], B = N[b]; if (!A || !B) continue;
    if (A[1] === 3 && B[1] === 2) GT[canon(A[0])] = B[0]; if (B[1] === 3 && A[1] === 2) GT[canon(B[0])] = A[0]; } }
  const typeOf = nm => GT[nm] || (/edge/.test(nm) ? 'other' : /plaque/.test(nm) ? 'vascular tissue' : /skeletal/.test(nm) ? 'skeletal muscle'
    : /cardiac|myocard/.test(nm) ? 'cardiac muscle' : /adipose|fat/.test(nm) ? 'adipose tissue' : /lymph/.test(nm) ? 'lymphoid structure'
    : /muscle|muscularis/.test(nm) ? 'smooth muscle' : /foveol|epitheli|mucosa/.test(nm) ? 'lining epithelium'
    : /gland|cyst|tubul|acini|parenchyma|follic/.test(nm) ? 'glandular tissue' : /vessel|vein/.test(nm) ? 'vascular tissue'
    : /matter|nerve|layer/.test(nm) ? 'neuronal tissue' : 'connective tissue');
  // H&E: eosin base and nuclear density by tissue type (eosin #e88bb0..#f6c4d6, haematoxylin #4b3b8f..#7d6bc4, white #fbf4f7)
  const HE = { 'connective tissue': ['#f4b9cf', 0.14], 'smooth muscle': ['#e88bb0', 0.24], 'skeletal muscle': ['#e57fa9', 0.1], 'cardiac muscle': ['#e57fa9', 0.14],
    'lining epithelium': ['#d79cc8', 0.6], 'glandular tissue': ['#dca2cc', 0.48], 'lymphoid structure': ['#a892d4', 0.95], 'neuronal tissue': ['#e2b7da', 0.28],
    'vascular tissue': ['#ec8fac', 0.22], 'adipose tissue': ['#fbf4f7', 0.03], other: ['#f6c4d6', 0.1] };
  const heOf = nm => (/space|cyst|lumen/.test(nm) ? ['#fbf4f7', 0.04] : /granular/.test(nm) ? ['#9d8ad0', 0.9] : /white matter/.test(nm) ? ['#f2cade', 0.1]
    : /squamous|epidermis/.test(nm) ? ['#c99ccc', 0.62] : /plaque/.test(nm) ? ['#c7b7e0', 0.5] : HE[typeOf(nm)] || HE.other);
  const HAE = K.rgb('#5a49a6');

  // one colour per domain name, the same in every set. The talk's sections reuse one palette per section (the same
  // colour means different domains), so names get fixed colours: the gut and ovary ones as in its panels f and g
  const CUR = {
    'mucosa': '#4f8dff', 'mucosa epithelium': '#6fa3ff', 'mucosa lamina propria': '#9db7ff', 'lamina propria': '#a58bff', 'submucosa': '#3ee08f',
    'muscularis': '#ff8a3d', 'inner circular smooth muscle': '#ffa04d', 'outer longitudinal smooth muscle': '#ff6a3d',
    'lymphoid peyer patches': '#c070ff', 'lymphoid tissue': '#c070ff', 'lymph node': '#c070ff', 'blood vessels': '#ff3d6e',
    'blood vessels and hemorrhage': '#ff3d6e', 'portal vein': '#ff4f86', 'connective tissue': '#ffd84a', 'fibroadipose tissue': '#f2e2a0',
    'adipose tissue': '#fff3cf', 'fat': '#fff3cf', 'fibromuscular tissue': '#ff9db5', 'fibrovascular tissue': '#e58bd0', 'tissue edge': '#8a9bb3',
    'corpus albicans': '#9be05a', 'ovarian cortex': '#ff6a5a', 'ovarian stroma': '#b98cff', 'adenohypophysis': '#46a8ff', 'neurohypophysis': '#3ee0c8',
    'tunica intima': '#ffb43b', 'tunica media': '#ff5ad9', 'tunica adventitia': '#46d9ff', 'calcified plaques': '#f4f1e8',
    'epidermis': '#c070ff', 'papillary dermis': '#ff8fb0', 'reticular dermis': '#3ee08f', 'subdermis': '#ffb43b',
    'gray matter': '#3ee08f', 'white matter': '#b98cff', 'molecular layer': '#ff5a6e', 'granular layer': '#46d9ff', 'cerebral medulla': '#ffa04d',
    'squamous epithelium': '#ff5a6e', 'endometrium': '#3ee08f', 'myometrium': '#ff5a6e', 'cardiac muscle': '#4f8dff', 'myocardium': '#4f8dff',
    'skeletal muscle': '#ff6a3d', 'nerve fibers': '#ffa04d', 'epineurium': '#46a8ff', 'seminiferous tubules': '#ff8a3d', 'thyroid follicles': '#3ee08f',
    'liver parenchyma': '#ff9a52', 'pancreatic parenchyma': '#ffa86b', 'prostatic acini': '#ff7a59', 'stroma': '#3ee08f',
  };
  const PAL = ['#46d9ff', '#ff5ad9', '#ffb43b', '#3ee08f', '#4f8dff', '#ff8a3d', '#b98cff', '#ff5a6e', '#9be05a', '#3ee0c8', '#ffd84a', '#ff9db5', '#7a7dff', '#c98a5a', '#a0e8ff', '#e58bd0'];
  const COL = {};
  for (const k in CUR) COL[k] = CUR[k];
  { const use = {}, dist = (a, b) => { const x = K.rgb(a), y = K.rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
    for (const doms of REC) for (const d of doms) if (!COL[d.name]) {
      const here = doms.filter(e => COL[e.name]).map(e => COL[e.name]);
      let best = PAL[0], bs = -9;
      for (const c of PAL) { const s = (here.length ? Math.min(...here.map(h => dist(c, h))) : 1) - 0.04 * (use[c] || 0); if (s > bs) { bs = s; best = c; } }
      COL[d.name] = best; use[best] = (use[best] || 0) + 1;
    } }
  function domainColour(name) {
    let n = canon(name);
    if (!COL[n]) { if (/inner/.test(n) && /musc/.test(n)) n = 'inner circular smooth muscle'; else if (/outer/.test(n) && /musc/.test(n)) n = 'outer longitudinal smooth muscle';
      else if (/lymph/.test(n)) n = 'lymphoid tissue'; else if (/vessel/.test(n)) n = 'blood vessels'; else if (/muscularis/.test(n)) n = 'muscularis'; }
    if (COL[n]) return COL[n];
    let h = 2166136261; for (let i = 0; i < n.length; i++) h = Math.imul(h ^ n.charCodeAt(i), 16777619);
    return PAL[(h >>> 0) % PAL.length];
  }

  // ---------------------------------------------------------------- section shapes (local coords, about [-1, 1])
  const vnoise = seed => {
    const h = (i, j) => { let n = (i * 374761393 + j * 668265263 + seed * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    return (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return lerp(lerp(h(i, j), h(i + 1, j), sx), lerp(h(i, j + 1), h(i + 1, j + 1), sx), sy) * 2 - 1; };
  };
  // st(x, y): 0 outside, 1 tissue, 2 lumen; depth(x, y) (optional): 0 at the surface or lumen, 1 deepest
  function makeShape(i, sp) {
    const r = rng(7001 + i * 131), nz = vnoise(i * 7 + 3);
    const harm = (w) => { const a = [], ph = []; for (let k = 2; k <= 6; k++) { a.push(w * (0.3 + 0.7 * r()) / k); ph.push(r() * 2 * PI); }
      const f = th => { let s = 1; for (let k = 0; k < a.length; k++) s += a[k] * Math.cos((k + 2) * th + ph[k]); return s; };
      let mx = 0; for (let k = 0; k < 96; k++) mx = Math.max(mx, f(k / 96 * 2 * PI)); return th => f(th) / mx; };
    const kd = sp.k;
    if (kd === 'ring') {
      const ho = harm(sp.w || 0.12), hi = harm(0.2), ex = (r() - 0.5) * 2 * (sp.ecc || 0), rin = sp.rin || 0.45, nf = sp.nf || 0, fold = sp.fold || 0, ph = r() * 6.28;
      return { hole: true, st: (x, y) => {
        const th = Math.atan2(y, x), q = sp.sq ? Math.pow(Math.pow(Math.abs(x / 0.95), 4) + Math.pow(Math.abs(y / 0.85), 4), 0.25) : Math.hypot(x, y);
        if (q > 0.96 * ho(th) * (1 + 0.03 * nz(x * 7, y * 7))) return 0;
        const thi = Math.atan2(y, x - ex), ri = rin * hi(thi) * (1 - fold * Math.pow(Math.max(0, Math.sin(nf * thi + ph)), 2));
        return Math.hypot(x - ex, y) < ri ? 2 : 1; } };
    }
    if (kd === 'strip') {
      const rot = sp.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot), amp = sp.amp || 0, fq = sp.fq || 1.2, ph = r() * 6.28, w = sp.w || 0.3, fold = sp.fold || 0;
      const e = w + amp + fold, ac = Math.abs(cr), as = Math.abs(sr);
      const L = Math.min(0.95, ac > 0.01 ? (0.97 - e * as) / ac : 9, as > 0.01 ? (0.97 - e * ac) / as : 9);
      const cen = u => amp * Math.sin(fq * u + ph), fo = u => fold * Math.pow(Math.max(0, Math.sin(u * 24 + ph)), 1.5);
      return { st: (x, y) => {
        const u = x * cr + y * sr, v = -x * sr + y * cr; if (Math.abs(u) > L) return 0;
        const t = Math.max(0, (Math.abs(u) - L + 0.12) / 0.12), wf = Math.sqrt(Math.max(0, 1 - t * t)), c = cen(u) + 0.02 * nz(u * 5, 3);
        return v < c + (w + fo(u)) * wf && v > c - w * wf ? 1 : 0; },
      depth: (x, y) => { const u = x * cr + y * sr, v = -x * sr + y * cr; return c01((cen(u) + w - v) / (2 * w)); } };
    }
    if (kd === 'lobes') {
      const hb = harm(0.25), sx = sp.sx || 0.92, sy = sp.sy || 0.92, n = sp.n || 8, C = [], md = 1.4 / Math.sqrt(n);
      for (let g = 0; C.length < n && g < 5000; g++) {
        const x = (r() * 2 - 1) * sx, y = (r() * 2 - 1) * sy;
        if (Math.hypot(x / sx, y / sy) > 0.85 * hb(Math.atan2(y / sy, x / sx))) continue;
        if (C.some(c => Math.hypot(c[0] - x, c[1] - y) < md * (g > 2500 ? 0.6 : 1))) continue;
        C.push([x, y, r() < (sp.lacy || 0)]);
      }
      const vor = (x, y) => { let d1 = 9, d2 = 9, i1 = 0; for (let k = 0; k < C.length; k++) { const d = Math.hypot(C[k][0] - x, C[k][1] - y); if (d < d1) { d2 = d1; d1 = d; i1 = k; } else if (d < d2) d2 = d; } return [d1 / (0.5 * (d1 + d2)), i1]; };
      return { st: (x, y) => { const u = x / sx, v = y / sy; if (Math.hypot(u, v) > 0.97 * hb(Math.atan2(v, u)) * (1 + 0.03 * nz(x * 7, y * 7))) return 0;
          if (sp.lacy) { const [d, k] = vor(x, y); if (d > 0.84 || C[k][2]) return 0; } return 1; },
        depth: (x, y) => c01(vor(x, y)[0] + 0.06 * nz(x * 9, y * 9)) };
    }
    if (kd === 'fasc') {
      const C = [];
      for (let g = 0; C.length < (sp.n || 6) && g < 4000; g++) {
        const rr = 0.2 + 0.14 * r(), a = r() * 6.28, q = r() * (0.82 - rr), x = q * Math.cos(a), y = q * Math.sin(a) * 0.9;
        if (C.some(c => Math.hypot(c[0] - x, c[1] - y) < c[2] + rr + 0.06)) continue;
        C.push([x, y, rr]);
      }
      const near = (x, y) => { let b = 9; for (const c of C) b = Math.min(b, Math.hypot(c[0] - x, c[1] - y) / c[2]); return b; };
      return { st: (x, y) => { for (const c of C) if (Math.hypot(c[0] - x, c[1] - y) < c[2] + 0.11 + 0.04 * nz(x * 6, y * 6)) return 1; return 0; },
        depth: (x, y) => c01(near(x, y) * 0.5) };
    }
    if (kd === 'folia') {
      const hb = harm(0.16), n = sp.n || 8, dp = sp.dp || 0.3, ph = r() * 6.28;
      return { st: (x, y) => { const th = Math.atan2(y, x), q = Math.hypot(x / 0.96, y / 0.9);
        return q < 0.97 * hb(th) * (1 - dp * Math.pow(Math.abs(Math.cos(n * th / 2 + ph)), 10)) ? 1 : 0; } };
    }
    // round or block (a rounded square)
    const hb = harm(sp.w || 0.2), sx = sp.sx || 0.9, sy = sp.sy || 0.9, p = kd === 'block' ? 4 : 2;
    return { st: (x, y) => { if (sp.flat !== undefined && y < sp.flat) return 0;
      const u = x / sx, v = y / sy, q = Math.pow(Math.pow(Math.abs(u), p) + Math.pow(Math.abs(v), p), 1 / p);
      return q < 0.97 * hb(Math.atan2(v, u)) * (1 + 0.04 * nz(x * 6, y * 6)) ? 1 : 0; } };
  }
  // chamfer distance (in cells) from the cells where src is 1
  function chamfer(nx, ny, src) {
    const d = new Float32Array(nx * ny), D2 = 1.414;
    for (let k = 0; k < d.length; k++) d[k] = src[k] ? 0 : 1e9;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const k = y * nx + x; let v = d[k]; if (!v) continue;
      if (x > 0) v = Math.min(v, d[k - 1] + 1);
      if (y > 0) { v = Math.min(v, d[k - nx] + 1); if (x > 0) v = Math.min(v, d[k - nx - 1] + D2); if (x < nx - 1) v = Math.min(v, d[k - nx + 1] + D2); }
      d[k] = v; }
    for (let y = ny - 1; y >= 0; y--) for (let x = nx - 1; x >= 0; x--) { const k = y * nx + x; let v = d[k]; if (!v) continue;
      if (x < nx - 1) v = Math.min(v, d[k + 1] + 1);
      if (y < ny - 1) { v = Math.min(v, d[k + nx] + 1); if (x < nx - 1) v = Math.min(v, d[k + nx + 1] + D2); if (x > 0) v = Math.min(v, d[k + nx - 1] + D2); }
      d[k] = v; }
    return d;
  }

  // ---------------------------------------------------------------- the sections: tiles, domains at 20 and 70
  const TARGET = 620, NAGE = 16;
  const SEC = TT.map((row, ti) => {
    const sh = makeShape(ti, row[5]), nz = vnoise(500 + ti), r = rng(900 + ti * 37), doms = REC[ti];
    let cnt = 0; const G0 = 36;
    for (let y = 0; y < G0; y++) for (let x = 0; x < G0; x++) if (sh.st(-1 + (x + 0.5) * 2 / G0, -1 + (y + 0.5) * 2 / G0) === 1) cnt++;
    const cell = Math.sqrt(4 * Math.max(cnt, 40) / (G0 * G0) / TARGET), nx = Math.ceil(2.1 / cell) + 2, ny = nx, h0 = (nx - 1) / 2;
    const st = new Uint8Array(nx * ny), PX = new Float32Array(nx * ny), PY = new Float32Array(nx * ny);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const k = y * nx + x, px = (x - h0) * cell, py = (y - h0) * cell;
      PX[k] = px; PY[k] = py; st[k] = Math.abs(px) > 1.02 || Math.abs(py) > 1.02 ? 0 : sh.st(px, py); }
    const de = chamfer(nx, ny, st.map(v => (v === 0 ? 1 : 0))), dh = sh.hole ? chamfer(nx, ny, st.map(v => (v === 2 ? 1 : 0))) : null;
    const T = []; for (let k = 0; k < st.length; k++) if (st[k] === 1) T.push(k);
    const N = T.length; let mxe = 1; for (const k of T) mxe = Math.max(mxe, de[k]);
    const x = new Float32Array(N), y = new Float32Array(N), dep = new Float32Array(N), edg = new Float32Array(N);
    T.forEach((k, j) => { x[j] = PX[k]; y[j] = PY[k];
      const d = sh.depth ? sh.depth(PX[k], PY[k]) : dh ? dh[k] / (dh[k] + de[k]) : (de[k] - 1) / Math.max(1, mxe - 1);
      dep[j] = d + 0.045 * nz(PX[k] * 4, PY[k] * 4); edg[j] = de[k] + 0.7 * nz(PX[k] * 5 + 9, PY[k] * 5); });
    // the order in which each rim, patch or speck domain takes tiles
    const ord = doms.map(d => {
      if (d.mode === 'L') return null;
      const idx = Array.from({ length: N }, (_, j) => j);
      if (d.mode === 'E') return idx.sort((a, b) => edg[a] - edg[b]);
      const o = d.o, n = o.n || (d.mode === 'S' ? 14 : 3), s = o.s || (d.mode === 'S' ? 0.09 : 0.26), band = o.d || [0, 1], seeds = [];
      if (o.at) seeds.push([o.at[0], o.at[1]]);
      for (let g = 0; seeds.length < n && g < 400; g++) { const j = Math.floor(r() * N); if (dep[j] >= band[0] && dep[j] <= band[1] || g > 300) seeds.push([x[j], y[j]]); }
      const fld = new Float32Array(N);
      for (let j = 0; j < N; j++) { let m = 0; for (const c of seeds) m = Math.max(m, Math.exp(-((x[j] - c[0]) ** 2 + (y[j] - c[1]) ** 2) / (s * s))); fld[j] = m * (0.85 + 0.15 * nz(x[j] * 8 + 3, y[j] * 8)); }
      return idx.sort((a, b) => fld[b] - fld[a]);
    });
    const byDepth = Array.from({ length: N }, (_, j) => j).sort((a, b) => dep[a] - dep[b]);
    const assign = fr => {
      const out = new Int16Array(N).fill(-1);
      doms.forEach((d, k) => { if (!ord[k]) return; let need = Math.round(fr[k] / 100 * N); for (const j of ord[k]) { if (need <= 0) break; if (out[j] < 0) { out[j] = k; need--; } } });
      const rest = byDepth.filter(j => out[j] < 0), Ls = doms.map((d, k) => k).filter(k => !ord[k]);
      const fl = Ls.reduce((s, k) => s + fr[k], 0) || 1; let c = 0, at = 0;
      Ls.forEach((k, q) => { c += fr[k]; const to = q === Ls.length - 1 ? rest.length : Math.round(c / fl * rest.length); for (; at < to; at++) out[rest[at]] = k; });
      for (const j of rest) if (out[j] < 0) out[j] = Ls.length ? Ls[Ls.length - 1] : 0;
      return out;
    };
    const d0 = assign(shares(doms, 0)), d1 = assign(shares(doms, 1)), flip = new Float32Array(N).fill(2);
    for (let s = 1; s <= NAGE; s++) { const ds = s === NAGE ? d1 : assign(shares(doms, s / NAGE)); for (let j = 0; j < N; j++) if (flip[j] > 1.5 && ds[j] !== d0[j] && d1[j] !== d0[j]) flip[j] = (s - 0.5) / NAGE; }
    // where each example domain lies (for its label)
    const exAt = doms.map((d, k) => { let sx = 0, sy = 0, n = 0; for (let j = 0; j < N; j++) if (d1[j] === k) { sx += x[j]; sy += y[j]; n++; } return n ? [sx / n, sy / n] : [0, 0]; });
    return { N, x, y, cell, d0, d1, flip, exAt };
  });
  // where each tile goes when its section's tiles gather into one bead per domain (atlas_net, before the section flies
  // into the network): each domain's bead sits at its tiles' centre, pushed clear of the others; each tile keeps its
  // direction from that centre and moves in to a radius by its rank in distance, so the domain contracts into a disc
  // without tiles crossing (BK of their spacing apart: they shrink as much)
  const BK = 0.72;
  SEC.forEach((s, ti) => {
    const nd = REC[ti].length, B = Array.from({ length: nd }, () => ({ n: 0, x: 0, y: 0, R: 0, js: [] }));
    for (let j = 0; j < s.N; j++) { const b = B[s.d0[j]]; b.n++; b.x += s.x[j]; b.y += s.y[j]; b.js.push(j); }
    const on = B.filter(b => b.n);
    for (const b of on) { b.x /= b.n; b.y /= b.n; b.cx = b.x; b.cy = b.y; b.R = BK * s.cell * Math.sqrt(b.n / PI); }
    for (let it = 0; it < 120; it++) for (let p = 0; p < on.length; p++) for (let q = p + 1; q < on.length; q++) {
      const A = on[p], C = on[q], dx = C.x - A.x, dy = C.y - A.y, d = Math.hypot(dx, dy) || 1e-3, m = A.R + C.R + 0.6 * BK * s.cell;
      if (d >= m) continue;
      const wA = C.n / (A.n + C.n), ux = d > 1e-3 ? dx / d : Math.cos(p + q), uy = d > 1e-3 ? dy / d : Math.sin(p + q), push = (m - d) * 0.5;
      A.x -= ux * push * wA * 2; A.y -= uy * push * wA * 2; C.x += ux * push * (1 - wA) * 2; C.y += uy * push * (1 - wA) * 2;
      for (const b of [A, C]) { const lim = Math.max(0.2, 1.05 - b.R); b.x = clamp(b.x, -lim, lim); b.y = clamp(b.y, -lim, lim); }
    }
    s.gx = new Float32Array(s.N); s.gy = new Float32Array(s.N);
    for (const b of on) {
      b.js.sort((a, c) => Math.hypot(s.x[a] - b.cx, s.y[a] - b.cy) - Math.hypot(s.x[c] - b.cx, s.y[c] - b.cy));
      b.js.forEach((j, k) => { const r = b.R * Math.sqrt((k + 0.5) / b.n), th = Math.atan2(s.y[j] - b.cy, s.x[j] - b.cx + 1e-6); s.gx[j] = b.x + r * Math.cos(th); s.gy[j] = b.y + r * Math.sin(th); });
    }
  });

  // ---------------------------------------------------------------- the tile cloud (an embedding by domain)
  // tissues sit round a sphere grouped by organ system; a domain found in one tissue clusters beside it, one shared by
  // several sits between them (connective tissue near the middle), and its tiles stretch towards their own tissues
  const SYS = [['Esophagus', 'Stomach', 'Small Intestine', 'Colon', 'Liver', 'Pancreas', 'Minor Salivary Gland'], ['Spleen'], ['Kidney', 'Bladder'],
    ['Ovary', 'Uterus', 'Cervix', 'Vagina', 'Fallopian Tube', 'Testis', 'Prostate', 'Breast'], ['Skin', 'Adipose'], ['Muscle'], ['Artery', 'Heart'],
    ['Lung'], ['Brain', 'Nerve'], ['Pituitary', 'Thyroid', 'Adrenal Gland']];
  const HOME = new Array(NT);
  { const ns = SYS.length, cen = SYS.map((_, s) => { const yy = 1 - 2 * (s + 0.5) / ns, rr = Math.sqrt(1 - yy * yy), th = s * 2.39996; return [rr * Math.cos(th), yy, rr * Math.sin(th)]; });
    SYS.forEach((orgs, s) => { const mem = []; for (let i = 0; i < NT; i++) if (orgs.includes(ORGAN[i])) mem.push(i);
      const c = cen[s], t1 = K.v3.norm(K.v3.cross(c, Math.abs(c[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), t2 = K.v3.cross(c, t1);
      mem.forEach((i, k) => { const a = k / Math.max(1, mem.length) * 2 * PI, rad = mem.length > 1 ? 0.28 + 0.03 * mem.length : 0;
        const p = K.v3.norm(K.v3.add(c, K.v3.add(K.v3.mul(t1, rad * Math.cos(a)), K.v3.mul(t2, rad * Math.sin(a)))));
        HOME[i] = [p[0] * 0.82, p[1] * 0.62, p[2] * 0.7]; }); }); }
  const DT = {};   // domain name -> tissues it is found in
  REC.forEach((doms, ti) => doms.forEach(d => { (DT[d.name] = DT[d.name] || []).includes(ti) || DT[d.name].push(ti); }));
  const DC = {};
  for (const nm in DT) { const ts = DT[nm], r = rng(nm.length * 97 + nm.charCodeAt(0) * 13 + nm.charCodeAt(nm.length - 1));
    if (ts.length === 1) { const h = HOME[ts[0]], u = K.unit(r); DC[nm] = K.v3.add(K.v3.mul(h, 1.12), K.v3.mul(u, 0.12)); }
    else { let m = [0, 0, 0]; for (const t of ts) m = K.v3.add(m, HOME[t]); m = K.v3.mul(m, 1 / ts.length);
      DC[nm] = K.v3.add(K.v3.mul(m, 0.8 / (1 + 0.1 * (ts.length - 2))), K.v3.mul(K.unit(r), 0.05)); } }

  // ---------------------------------------------------------------- layout: the wall, the atlas grid, focus
  const WR = 1.25, WC = 0.75, TH = 62 * PI / 180, WH = 1.12, NR = 80, GAP = 0.8;   // wall radius, centre z, half arc, height, rows
  const wallAt = (th, y) => [WR * Math.sin(th), y, WC - WR * Math.cos(th)];
  const COLS = 10, RA = 1.7, ZA = 1.8, DA = 0.165, S0 = 0.125;
  const gridAt = i => { const c = i % COLS, rw = Math.floor(i / COLS), th = (c - (COLS - 1) / 2) * DA; return { p: [RA * Math.sin(th), 0.5 - rw * 0.335, ZA - RA * Math.cos(th)], yaw: -th }; };
  const GRID = TT.map((_, i) => gridAt(i));

  // slides per tissue (the total is the preprint's), their columns on the wall and their rows by donor age
  const TOTAL = F.slides || 24945;
  const AGEB = [0.085, 0.08, 0.16, 0.33, 0.345];   // GTEx donors by decade, 20s to 60s (approximate: they lean old, median 56)
  const wsum = TT.reduce((s, r) => s + r[3], 0);
  const NSL = TT.map(r => Math.max(30, Math.round(r[3] / wsum * TOTAL)));
  { let d = TOTAL - NSL.reduce((s, n) => s + n, 0), k = 0; while (d !== 0 && k < 9999) { const i = k++ % NT; if (d > 0 || NSL[i] > 31) { NSL[i] += Math.sign(d); d -= Math.sign(d); } } }
  const WCOLS = NSL.map(n => Math.max(1, Math.ceil(n * 1.6 / NR)));
  const WST = []; let U = 0; for (let i = 0; i < NT; i++) { WST.push(U); U += WCOLS[i] + (i < NT - 1 ? GAP : 0); }
  const uTh = u => (u / U - 0.5) * 2 * TH;
  // the rows by age stand in a rack: a shelf at every decade (16 rows each), SG rows' height apart
  const SG = 1.6, RT = NR + 6 * SG, rowY = rw => ((rw + 0.5 + SG * (1 + Math.floor(rw / 16))) / RT - 0.5) * WH, shelfY = k => ((16 * k + SG * (k + 0.5)) / RT - 0.5) * WH;
  const WALLMID = TT.map((_, i) => wallAt(uTh(WST[i] + WCOLS[i] / 2), 0));

  // ---------------------------------------------------------------- textures: slides (one per shape), captions
  const SHAPES = ['strip', 'ring', 'round', 'lobes', 'block', 'lacy', 'folia', 'fasc'];
  const varOf = sp => { const k = sp.k === 'lobes' && sp.lacy > 0.25 ? 'lacy' : sp.k; return Math.max(0, SHAPES.indexOf(k)); };
  function slideTexture() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    const g = cv.getContext('2d'), r = rng(31);
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); g.globalCompositeOperation = 'lighter';
    SHAPES.forEach((k, v) => {
      const ox = (v % 4) * 128, oy = Math.floor(v / 4) * 256, cx = ox + 64, cy = oy + 150, P = new Path2D();
      g.fillStyle = 'rgb(0,0,255)'; g.fillRect(ox + 12, oy + 10, 104, 46);   // the frosted label end
      const blob = (rx, ry, w, n) => { const ph = r() * 6; for (let a = 0; a <= 64; a++) { const t = a / 64 * 2 * PI, q = 1 + w * Math.sin(n * t + ph) + 0.5 * w * Math.sin((n + 3) * t);
        const px = cx + rx * q * Math.cos(t), py = cy + ry * q * Math.sin(t); a ? P.lineTo(px, py) : P.moveTo(px, py); } P.closePath(); };
      if (k === 'strip') { for (let a = 0; a <= 40; a++) { const t = a / 40, py = oy + 72 + t * 168, px = cx + 22 * Math.sin(t * 5) - 16; a ? P.lineTo(px, py) : P.moveTo(px, py); }
        for (let a = 40; a >= 0; a--) { const t = a / 40, py = oy + 72 + t * 168, px = cx + 22 * Math.sin(t * 5) + 20 + 4 * Math.sin(t * 40); P.lineTo(px, py); } P.closePath(); }
      else if (k === 'ring') { P.arc(cx, cy, 46, 0, 2 * PI); P.moveTo(cx + 26, cy); P.arc(cx, cy, 26, 0, 2 * PI); }
      else if (k === 'round') blob(46, 62, 0.06, 3);
      else if (k === 'block') { P.rect(cx - 42, cy - 62, 84, 124); }
      else if (k === 'folia') blob(44, 64, 0.16, 9);
      else if (k === 'fasc') { for (let a = 0; a < 6; a++) { const t = a * 1.05, q = a ? 30 : 0; P.moveTo(cx + q * Math.cos(t) + 20, cy + q * 1.4 * Math.sin(t)); P.arc(cx + q * Math.cos(t), cy + q * 1.4 * Math.sin(t), 20, 0, 2 * PI); } }
      else { const n = k === 'lacy' ? 11 : 8; for (let a = 0; a < n; a++) { const px = cx + (r() - 0.5) * 70, py = cy + (r() - 0.5) * 120, rr = k === 'lacy' ? 9 + r() * 9 : 16 + r() * 8; P.moveTo(px + rr, py); P.arc(px, py, rr, 0, 2 * PI); } }
      g.fillStyle = 'rgb(255,0,0)'; g.fill(P, k === 'ring' ? 'evenodd' : 'nonzero');
      g.fillStyle = 'rgb(0,150,0)';
      for (let a = 0; a < 520; a++) { const px = ox + 8 + r() * 112, py = oy + 64 + r() * 186; if (!g.isPointInPath(P, px, py, k === 'ring' ? 'evenodd' : 'nonzero')) continue;
        g.beginPath(); g.arc(px, py, 0.9 + r() * 1.6, 0, 2 * PI); g.fill(); }
    });
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  function captionTexture() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 1024;
    const g = cv.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e7eef8';
    SHORT.forEach((s, i) => { const cx = (i % 2) * 256 + 128, cy = Math.floor(i / 2) * 48 + 24; let fs = 26;
      do { g.font = `600 ${fs}px "Inter", "Segoe UI", system-ui, sans-serif`; fs--; } while (g.measureText(s).width > 240 && fs > 12);
      g.fillText(s, cx, cy); });
    return new THREE.CanvasTexture(cv);
  }

  // ---------------------------------------------------------------- a box as the three faces the camera sees
  // Slides and tiles are boxes; a box is drawn as three quads (its broad face, a side, an end), each turned in the
  // vertex shader to the side of the box that faces the camera, so a box costs 6 triangles instead of 12 and is right
  // from every side (in a headset each eye picks its own). position = (a, b, face) with a, b in -0.5..0.5; the broad
  // face comes first, so a draw range of 6 indices draws only it (a box seen from afar)
  const BOXQ = { P: [], I: [] };
  for (let fc = 0; fc < 3; fc++) { const b = BOXQ.P.length / 3; BOXQ.P.push(-0.5, -0.5, fc, 0.5, -0.5, fc, 0.5, 0.5, fc, -0.5, 0.5, fc); BOXQ.I.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  const boxGeo = g => { g.setIndex(BOXQ.I); g.setAttribute('position', new THREE.Float32BufferAttribute(BOXQ.P, 3)); return g; };
  // (X, Y, Z: the box's half-to-half axes, scaled; c its centre; out: the point's offset from c and the face's normal)
  const BOXGL = `
vec3 boxAt(vec3 q, vec3 c, vec3 X, vec3 Y, vec3 Z, out vec3 nrm, out vec2 fuv) {
  vec3 V = cameraPosition - (modelMatrix * vec4(c, 1.0)).xyz; mat3 M = mat3(modelMatrix);
  float sx = dot(V, M * X) >= 0.0 ? 1.0 : -1.0, sy = dot(V, M * Y) >= 0.0 ? 1.0 : -1.0, sz = dot(V, M * Z) >= 0.0 ? 1.0 : -1.0;
  vec3 l; fuv = q.xy + 0.5;
  if (q.z < 0.5) { l = vec3(q.x, q.y, 0.5 * sz); nrm = normalize(Z) * sz; }
  else if (q.z < 1.5) { l = vec3(0.5 * sx, q.x, q.y); nrm = normalize(X) * sx; }
  else { l = vec3(q.x, 0.5 * sy, q.y); nrm = normalize(Y) * sy; }
  return X * l.x + Y * l.y + Z * l.z;
}`;

  // ---------------------------------------------------------------- the slide library (one instanced draw)
  const NW = NSL.reduce((s, n) => s + n, 0);
  const wallGeo = boxGeo(new THREE.InstancedBufferGeometry());
  const aW = new Float32Array(NW * 4), aWR = new Float32Array(NW * 4);
  { const r = rng(4242); let o = 0;
    TT.forEach((row, ti) => {
      const n = NSL[ti], cols = WCOLS[ti], occ = new Int16Array(NR), ages = [];
      for (let k = 0; k < n; k++) { let u = r(), b = 0; while (b < 4 && u > AGEB[b]) { u -= AGEB[b]; b++; } ages.push(AGES[0] + 10 * b + 10 * r()); }
      ages.sort((a, b) => a - b);
      const vi = varOf(row[5]);
      for (const a of ages) {
        let rw = clamp(Math.floor((a - AGES[0]) / (AGES[1] - AGES[0]) * NR), 0, NR - 1);
        for (let s = 0; s < NR * 2 && occ[rw] >= cols; s++) { const t = rw + (s % 2 ? -1 : 1) * Math.ceil((s + 1) / 2); if (t >= 0 && t < NR && occ[t] < cols) { rw = t; break; } }
        const c = occ[rw]++, u = WST[ti] + c + 0.5, th = uTh(u), y = rowY(rw);
        aW.set([th, y, ti, vi + (r() < 0.5 ? 0 : 8)], o * 4);
        aWR.set([r(), 0.42 * Math.abs(th) / TH + 0.12 * rw / NR + 0.1 * r(), r(), a], o * 4);
        o++;
      }
    });
    wallGeo.setAttribute('aW', new THREE.InstancedBufferAttribute(aW, 4));
    wallGeo.setAttribute('aR', new THREE.InstancedBufferAttribute(aWR, 4));
    wallGeo.instanceCount = NW;
    wallGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 3);
  }
  // per tissue: eosin colour and nuclear density, from its domains
  const TIS = TT.map((row, ti) => { let c = [0, 0, 0], nu = 0, w = 0; REC[ti].forEach(d => { const h = heOf(d.name), k = d.f20; c = K.v3.add(c, K.v3.mul(K.rgb(h[0]), k)); nu += h[1] * k; w += k; });
    c = K.v3.mul(c, 1 / w); return new THREE.Vector4(c[0], c[1], c[2], nu / w); });
  const slideTex = slideTexture();
  const wallMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uLib: { value: 1 }, uVis: { value: 1 }, uTex: { value: slideTex }, uTis: { value: TIS },
      uSW: { value: (WR * 2 * TH / U) * 0.8 }, uSH: { value: WH / RT * 0.88 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true },
    vertexShader: BOXGL + `
attribute vec4 aW, aR;
uniform float uLib, uVis, uA, uTime, uSW, uSH;
uniform vec4 uTis[${NT}];
varying vec2 vUv, vCell; varying vec4 vT; varying float vA, vGl, vFace; varying vec3 vN, vV;
void main() {
  float th = aW.x, y = aW.y;
  vec3 home = vec3(${WR.toFixed(3)} * sin(th), y, ${WC.toFixed(3)} - ${WR.toFixed(3)} * cos(th));
  vec3 src = vec3(home.x * 0.22, y * 0.4, ${(WC - 0.15).toFixed(3)});
  float k = clamp((uLib * 1.45 - aR.y) / 0.45, 0.0, 1.0); k = k * k * (3.0 - 2.0 * k);
  vec3 c = mix(src, home, k);
  c.y += sin(k * 3.14159) * 0.16 * (aR.x - 0.35);
  float ang = (1.0 - k) * (aR.z * 7.0 - 3.5), ca = cos(ang), sa = sin(ang), sc = mix(0.3, 1.0, k);
  float fl = aW.w > 7.5 ? -1.0 : 1.0;
  // a glass slide: its broad face in the wall's surface (turned in its plane while it flies), a little thickness
  vec3 rgt = vec3(cos(th), 0.0, sin(th)), up = vec3(0.0, 1.0, 0.0), nw = vec3(-sin(th), 0.0, cos(th));
  // (each slide a little askew in its place, so the light glints off the glass here and there, as off a real rack)
  float ty = (aR.x - 0.5) * 0.36 * k, tx = (fract(aR.z * 7.3) - 0.5) * 0.22 * k, cy = cos(ty), sy = sin(ty), cx = cos(tx), sx = sin(tx);
  vec3 r2 = rgt * cy + nw * sy, n2 = -rgt * sy + nw * cy; up = vec3(0.0, cx, 0.0) + n2 * sx; nw = n2 * cx - vec3(0.0, sx, 0.0); rgt = r2;
  vec3 X = (rgt * uSW * ca + up * uSH * sa) * sc, Y = (-rgt * uSW * sa + up * uSH * ca) * sc, Z = nw * uSW * 0.16 * sc;
  vec3 nrm; vec2 fuv;
  vec3 p = c + boxAt(position, c, X, Y, Z, nrm, fuv);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vN = normalize(normalMatrix * nrm); vV = -mv.xyz; vFace = position.z;
  float vi = mod(aW.w, 8.0);
  vUv = fuv; vCell = vec2(mod(vi, 4.0), floor(vi / 4.0));
  vUv.x = fl > 0.0 ? vUv.x : 1.0 - vUv.x;
  vT = uTis[int(aW.z + 0.5)];
  vA = uA * uVis * smoothstep(0.0, 0.25, k);
  vGl = pow(max(0.0, cos(th * 1.6 - y * 2.0 + uTime * 0.35 + aR.x * 0.5)), 160.0) * 0.6 * k + step(0.9985, fract(aR.z * 37.0 + uTime * 0.07)) * 0.6 * k;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform sampler2D uTex;
varying vec2 vUv, vCell; varying vec4 vT; varying float vA, vGl, vFace; varying vec3 vN, vV;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.45, 0.6, 0.65));
  float df = max(dot(n, L), 0.0), fr = pow(1.0 - abs(dot(n, v)), 3.0), sp = pow(max(dot(reflect(-L, n), v), 0.0), 40.0);
  vec3 glass = vec3(0.55, 0.72, 0.86);
  // (from afar, where a slide is a few pixels across, its rim and edges would be all that shows, as grey dashes: there
  // it fades to its stained tissue on the glass, so the wall reads as rows of slides in the tissues' own colours)
  float far = smoothstep(0.1, 0.34, fwidth(vUv.x));
  // the glass's edges: green-blue glass, bright where the light catches it
  if (vFace > 0.5) { gl_FragColor = vec4(glass * (0.3 + 0.5 * df) + vec3(sp * 0.6), (0.18 + 0.35 * fr + 0.4 * sp) * vA * (1.0 - 0.8 * far)); return; }
  vec2 tc = vec2((vCell.x + vUv.x) / 4.0, 1.0 - (vCell.y + 1.0 - vUv.y) / 2.0);
  vec4 tx = texture2D(uTex, tc);
  // the tissue lies on the glass as a thin slab: lit, with its shadow on the glass beside it
  float shd = texture2D(uTex, tc + vec2(-0.006, 0.006)).r;
  float tis = tx.r, nuc = tx.g * tis * 1.7, lab = tx.b;
  vec3 col = mix(vT.rgb, vec3(0.30, 0.24, 0.58), clamp(nuc * (0.25 + vT.a * 1.4), 0.0, 0.92));
  vec2 e = min(vUv, 1.0 - vUv); float rim = 1.0 - smoothstep(0.0, 0.07, min(e.x, e.y * 0.4));
  float ts = smoothstep(0.0, 0.45, tis);
  float a = max(0.06 + 0.24 * rim + 0.18 * shd * (1.0 - ts), ts * 0.97);
  col = mix(glass * (1.0 - 0.45 * shd), col * (0.72 + 0.4 * df), ts);
  col = mix(col, vec3(0.86, 0.9, 0.96), lab * 0.45 * (1.0 - ts)); a = max(a, lab * 0.32);
  // (afar: the slide's mean look, its tissue's colour over a little glass, lit)
  float cov = clamp(tis * 2.6, 0.0, 1.0);
  col = mix(col, mix(glass * 0.45, mix(vT.rgb, vec3(0.30, 0.24, 0.58), 0.25 * vT.a) * (0.72 + 0.42 * df), 0.35 + 0.65 * cov), far);
  a = mix(a, 0.42 + 0.5 * cov, far); rim *= 1.0 - far;
  col += glass * (vGl * (0.45 + rim) + 0.12 * fr) + vec3(sp * 0.35);
  gl_FragColor = vec4(col, min(1.0, a + vGl * 0.3 + sp * 0.25) * vA);
}`,
  });
  set.mats.push(wallMat);
  const wall = new THREE.Mesh(wallGeo, wallMat); wall.frustumCulled = false; wall.renderOrder = 1; set.group.add(wall);

  // the rack the slides stand in: a dark back panel, a shelf at every decade of age and a post between tissues, lit, so
  // the wall reads as a curved cabinet in depth (from afar too, where single slides are a few pixels); it stands first
  // as the library opens, and fades with the wall
  const rackGeo = new THREE.BufferGeometry();
  {
    const P = [], N = [], E = [], I = [], th0 = uTh(-GAP / 2), th1 = uTh(U + GAP / 2), SEG = 120;
    const r0 = WR - 0.02, r1 = WR + 0.016, yB = shelfY(0), yT = shelfY(5);
    const at = (r, th, y) => [r * Math.sin(th), y, WC - r * Math.cos(th)], inw = th => [-Math.sin(th), 0, Math.cos(th)];
    // a quad from four corners (a, b along one way, then c, d back), its normal and the edge glow's coordinate per corner
    const quad = (a, b, c, d, n, e) => { const v = P.length / 3; for (const q of [a, b, c, d]) P.push(...q); for (let k = 0; k < 4; k++) N.push(...(Array.isArray(n[0]) ? n[k] : n)); E.push(...e); I.push(v, v + 1, v + 2, v, v + 2, v + 3); };
    // the shelves (the top one and the bottom one a little deeper): top, front lip, underside
    for (let k = 0; k <= 5; k++) {
      const y = shelfY(k), h = k % 5 ? 0.0034 : 0.006, rf = r0 - (k % 5 ? 0 : 0.006);
      for (let sg = 0; sg < SEG; sg++) {
        const a = lerp(th0, th1, sg / SEG), b = lerp(th0, th1, (sg + 1) / SEG), na = inw(a), nb = inw(b);
        quad(at(rf, a, y + h), at(rf, b, y + h), at(r1, b, y + h), at(r1, a, y + h), [0, 1, 0], [1, 1, 0, 0]);
        quad(at(rf, a, y - h), at(rf, b, y - h), at(rf, b, y + h), at(rf, a, y + h), [na, nb, nb, na], [0.8, 0.8, 1, 1]);
        quad(at(r1, a, y - h), at(r1, b, y - h), at(rf, b, y - h), at(rf, a, y - h), [0, -1, 0], [0, 0, 0, 0]);
      }
    }
    // the posts between tissues (and at both ends): front and both sides
    const posts = [th0, th1];
    for (let i = 1; i < NT; i++) posts.push(uTh(WST[i] - GAP / 2));
    for (const th of posts) {
      const w = 0.0016 / WR, a = th - w, b = th + w, na = inw(a), sa = [Math.cos(th), 0, Math.sin(th)], sb = sa.map(v => -v);
      quad(at(r0, a, yB), at(r0, b, yB), at(r0, b, yT), at(r0, a, yT), [na, na, na, na], [-0.2, -0.2, -0.2, -0.2]);
      quad(at(r1, a, yB), at(r0, a, yB), at(r0, a, yT), at(r1, a, yT), sb, [-0.4, -0.4, -0.4, -0.4]);
      quad(at(r0, b, yB), at(r1, b, yB), at(r1, b, yT), at(r0, b, yT), sa, [-0.4, -0.4, -0.4, -0.4]);
    }
    // the back panel
    for (let sg = 0; sg < SEG; sg++) {
      const a = lerp(th0, th1, sg / SEG), b = lerp(th0, th1, (sg + 1) / SEG), na = inw(a), nb = inw(b);
      quad(at(r1, a, yB), at(r1, b, yB), at(r1, b, yT), at(r1, a, yT), [na, nb, nb, na], [-1, -1, -1, -1]);
    }
    rackGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    rackGeo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    rackGeo.setAttribute('aE', new THREE.Float32BufferAttribute(E, 1));
    rackGeo.setIndex(I);
  }
  const rackMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 1 } },
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    vertexShader: `
attribute float aE;
varying vec3 vN, vV, vW; varying float vE;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vE = aE; vW = position;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform float uA, uK;
varying vec3 vN, vV, vW; varying float vE;
void main() {
  float a = uA * uK;
  if (a < 0.004) discard;
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.45, 0.6, 0.65));
  if (dot(n, v) < 0.0) n = -n;
  float df = max(dot(n, L), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 3.0), sp = pow(max(dot(reflect(-L, n), v), 0.0), 30.0);
  // the back panel: deep blue, a soft light pooled in its middle; shelves and posts: blue-grey metal with a bright lip
  if (vE < -0.5) {
    float pool = exp(-pow(vW.x / 1.1, 2.0) - pow(vW.y / 0.7, 2.0));
    gl_FragColor = vec4(vec3(0.02, 0.045, 0.085) * (0.6 + 0.6 * df) + vec3(0.03, 0.06, 0.1) * pool, a);
    return;
  }
  // (vE: 1 at a shelf's lip, 0 at its back; below 0 a post: a little darker, no lip)
  float lip = smoothstep(0.75, 1.0, vE), post = step(vE, -0.1);
  vec3 base = vec3(0.16, 0.22, 0.32) * (1.0 - 0.35 * post);
  vec3 col = base * (0.25 + 0.95 * df) + vec3(0.55, 0.7, 0.9) * (fr * 0.25 + sp * 0.5 + lip * (0.18 + 0.3 * df));
  gl_FragColor = vec4(col, a);
}`,
  });
  set.mats.push(rackMat);
  const rack = new THREE.Mesh(rackGeo, rackMat); rack.frustumCulled = false; rack.renderOrder = 0; rack.raycast = () => {}; set.group.add(rack);

  // ---------------------------------------------------------------- the sections' tiles = the cloud's points
  const NTILE = SEC.reduce((s, q) => s + q.N, 0), exSet0 = new Set(exT.filter(i => i >= 0));
  const tileGeo = boxGeo(new THREE.InstancedBufferGeometry());
  // each domain stands at its own height on the section (in tile sizes, by its kind of tissue), so a section is a slab
  // in relief: linings and glands high, muscle middling, connective tissue and fat low, spaces lowest (illustrative)
  const RELIEF = { 'lining epithelium': 1.0, 'glandular tissue': 0.9, 'lymphoid structure': 0.85, 'skeletal muscle': 0.72, 'cardiac muscle': 0.72, 'smooth muscle': 0.66,
    'neuronal tissue': 0.6, 'vascular tissue': 0.56, 'connective tissue': 0.42, 'adipose tissue': 0.3, other: 0.34 };
  const reliefOf = nm => (/space|cyst|lumen/.test(nm) ? 0.16 : RELIEF[typeOf(nm)] || 0.4);
  const aT = new Float32Array(NTILE * 4), aU = new Float32Array(NTILE * 3), aCA = new Float32Array(NTILE * 3), aCB = new Float32Array(NTILE * 3),
    aH = new Float32Array(NTILE * 3), aM = new Float32Array(NTILE * 4), aRH = new Float32Array(NTILE * 2);
  // the morph into the network (filled by useNetwork): aNA its tissue type's node and when it gets there, aNB its
  // domain's node and when, aNC its place in the clumps there (a unit ball) and when it leaves for the type, aND where it
  // gathers on its section (section-local) and the clumps' radii at the type and at the domain
  const aNA = new Float32Array(NTILE * 4), aNB = new Float32Array(NTILE * 4), aNC = new Float32Array(NTILE * 4), aND = new Float32Array(NTILE * 4);
  { const r = rng(77); let o = 0;
    SEC.forEach((s, ti) => { const doms = REC[ti];
      for (let j = 0; j < s.N; j++, o++) {
        const dA = doms[s.d0[j]], dB = doms[s.d1[j]];
        aT.set([s.x[j], s.y[j], ti, s.cell], o * 4);
        aRH.set([reliefOf(dA.name), reliefOf(dB.name)], o * 2);
        aCA.set(K.rgb(domainColour(dA.name)), o * 3); aCB.set(K.rgb(domainColour(dB.name)), o * 3);
        const he = heOf(dA.name), base = K.rgb(he[0]), nu = clamp(he[1] * (0.3 + 1.1 * r()) + (r() < he[1] * 0.35 ? 0.4 : 0), 0, 0.9), lum = 0.92 + 0.12 * r();
        aH.set(K.v3.mul(K.v3.lerp(base, HAE, nu), lum), o * 3);
        // the cloud: a shared domain's tiles stretch from its cluster towards their own tissue (bridges)
        const ts = DT[dA.name], c = DC[dA.name];
        let p;
        if (ts.length > 1) { const b = 0.75 * Math.pow(r(), 2.2), sg = Math.min(0.075, 0.03 + 0.01 * Math.sqrt(ts.length)); p = K.v3.add(K.v3.lerp(c, HOME[ti], b), [gauss(r) * sg, gauss(r) * sg, gauss(r) * sg]); }
        else { const sg = 0.045; p = K.v3.add(c, [gauss(r) * sg * 1.2, gauss(r) * sg * 0.8, gauss(r) * sg]); }
        aU.set(p, o * 3);
        const exw = !exSet0.has(ti) ? 0 : dA.ex !== undefined || dB.ex !== undefined ? 1 : 0.5;   // in an example's section: its domain or the rest
        aM.set([s.flip[j], r(), 0.15 * Math.hypot(GRID[ti].p[0], GRID[ti].p[1]) + 0.45 * r(), exw], o * 4);
        aND.set([s.gx[j], s.gy[j], 0.01, 0.01], o * 4);
      } });
    tileGeo.setAttribute('aT', new THREE.InstancedBufferAttribute(aT, 4)); tileGeo.setAttribute('aU', new THREE.InstancedBufferAttribute(aU, 3));
    tileGeo.setAttribute('aCA', new THREE.InstancedBufferAttribute(aCA, 3)); tileGeo.setAttribute('aCB', new THREE.InstancedBufferAttribute(aCB, 3));
    tileGeo.setAttribute('aH', new THREE.InstancedBufferAttribute(aH, 3)); tileGeo.setAttribute('aM', new THREE.InstancedBufferAttribute(aM, 4));
    tileGeo.setAttribute('aRH', new THREE.InstancedBufferAttribute(aRH, 2));
    for (const [k, a] of [['aNA', aNA], ['aNB', aNB], ['aNC', aNC], ['aND', aND]]) tileGeo.setAttribute(k, new THREE.InstancedBufferAttribute(a, 4));
    tileGeo.instanceCount = NTILE; tileGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 3);
  }
  // per section: uP = centre and size, uQ = yaw, alpha, domain colours (0 H&E, 1 domains), focus
  const uP = TT.map(() => new THREE.Vector4(0, 0, 0, S0)), uQ = TT.map(() => new THREE.Vector4(0, 0, 0, 0));
  const SECU = { uP: { value: uP }, uQ: { value: uQ } };
  const tileMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA, uUm: { value: 0 }, uAge: { value: 0 }, uCA: { value: 1 }, uCR: { value: 0 }, uFoc: { value: 0 }, uHero: { value: -1 },
      uPt: { value: 0.015 }, uCC: { value: new THREE.Vector3(0, 0.05, 0.08) }, uCS: { value: 1 }, uG: { value: -1 }, uNt: { value: 0.0036 } }, SECU),
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: BOXGL + `
attribute vec4 aT, aM, aNA, aNB, aNC, aND; attribute vec3 aU, aCA, aCB, aH; attribute vec2 aRH;
uniform vec4 uP[${NT}], uQ[${NT}];
uniform float uA, uUm, uAge, uCA, uCR, uFoc, uPt, uCS, uHero, uG, uNt; uniform vec3 uCC;
varying vec3 vC, vN, vV; varying float vA, vK, vTop; varying vec2 vQ;
void main() {
  int ti = int(aT.z + 0.5);
  vec4 P = uP[ti], Q = uQ[ti];
  float c = cos(Q.x), s = sin(Q.x);
  // the morph into the network (uG: the network's growth, hier_grow; below -0.9 none): the tiles gather into a bead per
  // domain on their section (gat), ride it to its tissue's node (the section's place, uP), fly on to their tissue
  // type's node (k3) and on to their domain's (k4), shrinking into it with a flash (gone, hot)
  float gat = 0.0, k3 = 0.0, k4 = 0.0, gone = 0.0, hot = 0.0;
  if (uG > -0.9) {
    gat = clamp((uG + 0.31 - 0.04 * mod(aT.z, 10.0) / 9.0 - 0.02 * aM.y) / 0.1, 0.0, 1.0); gat = gat * gat * (3.0 - 2.0 * gat);
    float j = 0.012 * aM.y, a3 = aNA.w + j, d3 = aNC.w + j, a4 = aNB.w + j, d4 = max(a4 - 0.17, a3 + 0.015);
    k3 = clamp((uG - d3) / max(a3 - d3, 0.001), 0.0, 1.0); k3 = k3 * k3 * (3.0 - 2.0 * k3);
    k4 = clamp((uG - d4) / max(a4 - d4, 0.001), 0.0, 1.0); k4 = k4 * k4 * (3.0 - 2.0 * k4);
    gone = clamp((uG - a4) / 0.035, 0.0, 1.0);
    hot = exp(-pow((uG - a3) / 0.018, 2.0)) * step(0.0001, k3) * (1.0 - k4) + exp(-pow((uG - a4) / 0.018, 2.0)) * step(0.0001, k4);
  }
  vec2 lp = mix(aT.xy, aND.xy, gat);
  vec3 sp = P.xyz + vec3(lp.x * c, lp.y, -lp.x * s) * P.w;
  float k = clamp((uUm * 1.7 - aM.z) / 0.6, 0.0, 1.0); k = k * k * (3.0 - 2.0 * k);
  float cr = cos(uCR), sr = sin(uCR);
  vec3 up = uCC + vec3(aU.x * cr + aU.z * sr, aU.y, -aU.x * sr + aU.z * cr) * uCS;
  float f = smoothstep(aM.x - 0.035, aM.x + 0.035, uAge);
  // a tile on its section: a box standing on the plate, as tall as its domain's relief; in the cloud, a small cube
  // (a focused section stands in deeper relief: a terrain of its domains)
  float cs = aT.w * P.w * 0.94 * (1.0 - ${(1 - BK).toFixed(2)} * gat), hs = mix(aRH.x, aRH.y, f) * cs * (0.85 + 0.3 * aM.y) * (1.0 + 2.4 * Q.w * (1.0 - k)), cc = uPt * (0.75 + 0.5 * aM.y);
  vec3 Xs = vec3(c, 0.0, -s) * cs, Ys = vec3(0.0, cs, 0.0), Zs = vec3(s, 0.0, c) * hs;
  vec3 X = mix(Xs, vec3(cc, 0.0, 0.0), k), Y = mix(Ys, vec3(0.0, cc, 0.0), k), Z = mix(Zs, vec3(0.0, 0.0, cc), k);
  vec3 p = mix(sp + Zs * 0.5, up, k);
  p.y += sin(k * 3.14159) * (0.1 + 0.25 * aM.y);
  // (in flight: a small bright cube, on a path bowed out from the network's axis; a clump round each node)
  float fly = 0.0, cube = 0.0;
  if (k3 > 0.0) {
    vec3 q = mix(mix(p, aNA.xyz + aNC.xyz * aND.z, k3), aNB.xyz + aNC.xyz * aND.w, k4);
    vec2 o = q.xz; float ol = length(o); o = ol > 1e-4 ? o / ol : vec2(0.0, 1.0);
    float b3 = sin(3.14159 * k3) * (1.0 - k4), b4 = sin(3.14159 * k4);
    q.xz += o * (0.08 * b3 + 0.06 * b4); q.y += 0.05 * b3 - 0.02 * b4;
    cube = min(1.0, k3 * 6.0); fly = max(b3, b4);
    float cn = uNt * (0.75 + 0.5 * aM.y) * (1.0 - gone);
    X = mix(X, vec3(cn, 0.0, 0.0), cube); Y = mix(Y, vec3(0.0, cn, 0.0), cube); Z = mix(Z, vec3(0.0, 0.0, cn), cube);
    p = q;
  }
  vec3 nrm; vec2 fuv;
  vec4 mv = modelViewMatrix * vec4(p + boxAt(position, p, X, Y, Z, nrm, fuv), 1.0);
  gl_Position = projectionMatrix * mv;
  vN = normalize(normalMatrix * nrm); vV = -mv.xyz; vTop = 1.0 - step(0.5, position.z);
  float gl = aM.x < 1.5 ? clamp(1.0 - abs(uAge - aM.x) * 14.0, 0.0, 1.0) * 0.8 : 0.0;
  float ex = aM.w > 0.25 && aM.w < 0.75 ? 1.0 - 0.5 * Q.w * (1.0 - k) : 1.0 + 0.15 * step(0.75, aM.w) * Q.w;   // a focused example: its domain stands out
  // (Q.z: H&E 0 to domain colours 1; above 1 while the section flies into the network: its plate fades)
  vC = (mix(aH, mix(aCA, aCB, f), max(min(Q.z, 1.0), k)) * (1.0 + 0.1 * Q.w) + gl * vec3(0.7)) * ex;
  // (on the way the tiles take on a little of the network's colours: salmon at the tissue types, blue to the domains)
  vC = mix(vC, mix(vec3(0.94, 0.56, 0.48), vec3(0.35, 0.66, 1.0), k4), 0.3 * cube);
  vC = mix(vC, vec3(1.0), 0.4 * hot) * (1.0 + 0.2 * fly + 0.4 * hot);
  vA = uA * mix(Q.y, 0.88 * uCA * (1.0 - 0.85 * uFoc * (1.0 - Q.w)), k);
  vK = max(k, 0.85 * cube); vQ = fuv * 2.0 - 1.0;
#ifdef HERO
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
#else
  if (vA < 0.004 || abs(aT.z - uHero) < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
#endif
}`,
    fragmentShader: `
varying vec3 vC, vN, vV; varying float vA, vK, vTop; varying vec2 vQ;
void main() {
  float a = vA;
  if (a < 0.003) discard;
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.45, 0.6, 0.65));
  if (dot(n, v) < 0.0) n = -n;
  float df = max(dot(n, L), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 2.5);
  // lit faces; the tops bright and bevelled at their edges, the sides darker and darker still towards their foot (where
  // a step of the relief meets the lower tiles), so the relief reads; in the cloud a soft glow of their own
  float e = 1.0 - smoothstep(0.7, 1.0, max(abs(vQ.x), abs(vQ.y)));
  float side = mix(0.42 + 0.26 * (vQ.y * 0.5 + 0.5), 0.8, vK);
  vec3 col = vC * (0.42 + 0.7 * df) * mix(side, 1.06, vTop) * mix(1.0, mix(0.8, 1.0, e), vTop) + vC * fr * 0.35 + vC * vK * 0.35;
  gl_FragColor = vec4(col * a, a);
}`,
  });
  set.mats.push(tileMat);
  const tiles = new THREE.Mesh(tileGeo, tileMat); tiles.frustumCulled = false; tiles.renderOrder = 3; set.group.add(tiles);
  // the focused section drawn again on its own, writing depth, so its relief is right from every side (the main draw
  // writes none while a section is focused or a plot shows: the dimmed sections must not hide what is in front of them,
  // and leaves the focused one out). A small geometry of views into the main arrays (a section's tiles are contiguous),
  // made again when another section is focused (the old one freed)
  const heroMat = new THREE.ShaderMaterial({ uniforms: tileMat.uniforms, vertexShader: tileMat.vertexShader, fragmentShader: tileMat.fragmentShader,
    defines: { HERO: 1 }, transparent: true, depthWrite: true, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  set.mats.push(heroMat);
  const T0 = []; { let o = 0; SEC.forEach(q => { T0.push(o); o += q.N; }); }
  const heroGeo = ti => {
    const g = boxGeo(new THREE.InstancedBufferGeometry()), o = T0[ti], n = SEC[ti].N;
    for (const k of ['aT', 'aU', 'aCA', 'aCB', 'aH', 'aM', 'aRH', 'aNA', 'aNB', 'aNC', 'aND']) { const at = tileGeo.attributes[k], w = at.itemSize; g.setAttribute(k, new THREE.InstancedBufferAttribute(at.array.subarray(o * w, (o + n) * w), w)); }
    g.instanceCount = n; g.boundingSphere = tileGeo.boundingSphere;
    return g;
  };
  let heroI = 0;
  const hero = new THREE.Mesh(heroGeo(0), heroMat); hero.frustumCulled = false; hero.renderOrder = 3; hero.visible = false; set.group.add(hero);

  // plates behind the sections and their captions (one instanced draw: 40 plates, 40 captions)
  // (each plate a slab of dark glass with a lit edge, a box as three faces; a caption is only a face)
  const capGeo = boxGeo(new THREE.InstancedBufferGeometry());
  { const aI = new Float32Array(NT * 2 * 4);
    for (let i = 0; i < NT; i++) { aI.set([i, 0, 0, 0], i * 4); aI.set([i, 1, (i % 2) * 0.5, 1 - (Math.floor(i / 2) + 1) * 48 / 1024], (NT + i) * 4); }
    capGeo.setAttribute('aI', new THREE.InstancedBufferAttribute(aI, 4)); capGeo.instanceCount = NT * 2; capGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3); }
  const capMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA, uTex: { value: captionTexture() }, uUm: { value: 0 } }, SECU),
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: BOXGL + `
attribute vec4 aI; uniform vec4 uP[${NT}], uQ[${NT}]; uniform float uA, uUm;
varying vec2 vUv, vL; varying float vA, vKind, vF, vSide; varying vec3 vN, vV;
void main() {
  vec4 P = uP[int(aI.x + 0.5)], Q = uQ[int(aI.x + 0.5)];
  float c = cos(Q.x), s = sin(Q.x), cap = step(0.5, aI.y), th = 0.075 * (1.0 - cap);
  vec2 sz = cap > 0.5 ? vec2(2.1, 0.39) : vec2(2.3, 2.62);
  vec3 l = vec3(0.0, cap > 0.5 ? -1.2 : -0.13, cap > 0.5 ? 0.01 : -0.02 - 0.5 * th);
  vec3 C = P.xyz + vec3(l.x * c + l.z * s, l.y, -l.x * s + l.z * c) * P.w;
  vec3 X = vec3(c, 0.0, -s) * sz.x * P.w, Y = vec3(0.0, sz.y * P.w, 0.0), Z = vec3(s, 0.0, c) * max(th, 1e-4) * P.w, nrm; vec2 fuv;
  vec4 mv = modelViewMatrix * vec4(C + boxAt(position, C, X, Y, Z, nrm, fuv), 1.0);
  gl_Position = projectionMatrix * mv;
  vN = normalize(normalMatrix * nrm); vV = -mv.xyz; vSide = step(0.5, position.z);
  vUv = aI.zw + fuv * vec2(0.5, 48.0 / 1024.0); vL = (fuv - 0.5) * sz; vKind = aI.y; vF = Q.w;
  vA = uA * Q.y * (1.0 - uUm) * (1.0 - clamp(Q.z - 1.0, 0.0, 1.0));   // (Q.z above 1: the section flies into the network)
  // (a caption is not drawn from behind: it would read mirrored)
  float back = step(dot(cameraPosition - (modelMatrix * vec4(C, 1.0)).xyz, mat3(modelMatrix) * vec3(s, 0.0, c)), 0.0);
  if (vA < 0.004 || (cap > 0.5 && (vSide > 0.5 || back > 0.5))) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform sampler2D uTex; varying vec2 vUv, vL; varying float vA, vKind, vF, vSide; varying vec3 vN, vV;
void main() {
  if (vKind > 0.5) { vec4 t = texture2D(uTex, vUv); gl_FragColor = vec4(t.rgb, t.a * vA * 0.95); return; }
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.45, 0.6, 0.65));
  if (dot(n, v) < 0.0) n = -n;
  float df = max(dot(n, L), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 2.5);
  vec3 rimC = mix(vec3(0.35, 0.45, 0.6), vec3(1.0, 0.62, 0.8), vF);
  // the slab's edges: dark glass lit from the side, its rim colour catching the light
  if (vSide > 0.5) { gl_FragColor = vec4(vec3(0.03, 0.06, 0.11) * (0.6 + 0.9 * df) + rimC * (0.25 + 0.45 * df + 0.3 * fr), min(1.0, 0.75 + 0.2 * vF) * vA); return; }
  vec2 h = vec2(1.15, 1.31), q = abs(vL) - h + 0.05; float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.05;
  if (d > 0.0) discard;
  float rim = smoothstep(-0.035, 0.0, d);
  // its face: dark, a little sheen across it from the light
  float sheen = 0.5 + 0.5 * dot(vL / max(length(vL), 1e-3), vec2(-0.6, 0.8));
  vec3 col = mix(vec3(0.025, 0.05, 0.09) * (0.8 + 0.5 * sheen), rimC, rim);
  gl_FragColor = vec4(col, min(1.0, 0.6 + 0.33 * vF + 0.35 * rim) * vA);
}`,
  });
  set.mats.push(capMat);
  const caps = new THREE.Mesh(capGeo, capMat); caps.frustumCulled = false; caps.renderOrder = 2; set.group.add(caps);

  // ---------------------------------------------------------------- each section's organ: a small 3D model (ORGAN3D)
  // floating at its plate's top left corner, turning slowly; the models build between frames (the network set does it
  // while hidden, or a slice a frame here); until they are ready the plates have none
  const O3 = typeof ORGAN3D !== 'undefined' ? ORGAN3D : null;
  const mP = TT.map(() => new THREE.Vector4()), mQ = TT.map(() => new THREE.Vector4());
  let orgMesh = null;
  function buildOrgans() {
    if (orgMesh || !O3 || !O3.ready()) return;
    const M = O3.merged(ORGAN.map(o => O3.idOf(o) || 'stomach'), { lite: true }), g = new THREE.BufferGeometry();   // (small on screen: the lighter copies)
    g.setAttribute('position', new THREE.BufferAttribute(M.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(M.nrm, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(M.col, 3)); g.setAttribute('aSlot', new THREE.BufferAttribute(M.slot, 1)); g.setIndex(new THREE.BufferAttribute(M.idx, 1));
    const sh = O3.shader(NT);
    const m = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uP: { value: mP }, uQ: { value: mQ }, uTint: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: sh.vertex, fragmentShader: sh.fragment, transparent: true });
    set.mats.push(m);
    orgMesh = new THREE.Mesh(g, m); orgMesh.frustumCulled = false; orgMesh.renderOrder = 4; orgMesh.raycast = () => {};
    set.group.add(orgMesh);
  }

  // ---------------------------------------------------------------- the volcano
  const VS = { x: 0.24, y0: -0.52, y: 0.05 };
  const vg = new THREE.Group(); set.group.add(vg);
  let VOL = [], volFromFig = false;
  { const r = rng(515);
    if (VP.length) { volFromFig = true;
      VP.forEach(p => VOL.push({ name: canon(p.domain), tissue: p.tissue || '', x: +p.x, y: +p.y, sig: p.significant !== false }));
      const us = FIG.volcano.unlabelledSignificant; if (us && Array.isArray(us.points)) us.points.forEach(p => VOL.push({ name: '', tissue: '', x: +p.x, y: +p.y, sig: true }));
    }
    // the examples (the preprint's): where the figure has them, as drawn; else at their slope and a typical height
    EX.forEach((e, k) => { const nm = canon(e.domain); let p = VOL.find(q => q.name === nm && (exT[k] < 0 || tissueIx(q.tissue) === exT[k]));
      if (!p) { p = { name: nm, tissue: exT[k] >= 0 ? NAMES[exT[k]] : '', x: +e.perDecade, y: [16, 14.5, 6.6][k] || 8, sig: true }; VOL.push(p); }
      p.ex = k; });
    // the rest of the 128 domain-tissue pairs: dim, unlabelled, illustrative (the talk draws them small and overlapping)
    const total = (F.agePairs && F.agePairs[1]) || 128, big = [[2.51, 0.77], [1.76, 1.13], [1.54, 0.3], [-1.18, 1.02], [1.07, 1.55], [-0.74, 0.78], [-0.56, 2.95]];
    for (const b of big) if (VOL.length < total) VOL.push({ name: '', x: b[0], y: b[1], sig: false });
    while (VOL.length < total) VOL.push({ name: '', x: clamp(0.15 + gauss(r) * 0.55, -1.6, 2.4), y: Math.min(2.8, Math.abs(gauss(r)) * 0.9), sig: false });
    VOL.forEach(p => { p.z = (r() - 0.5) * 0.3; p.pos = [p.x * VS.x, VS.y0 + p.y * VS.y, p.z]; p.rad = 0.011 + 0.0075 * Math.min(3.5, Math.max(0.6, Math.abs(p.x))); p.delay = 0.15 + 0.5 * r(); });
  }
  const NV = VOL.length;
  const volGeo = new THREE.IcosahedronGeometry(1, 2);
  { const col = new Float32Array(NV * 3), av = new Float32Array(NV * 4);
    const warm = [[0, K.rgb('#ffc8b0')], [1, K.rgb('#ff9a6a')], [2, K.rgb('#ff6a4b')], [3.5, K.rgb('#ff3b3b')]], cool = [[0, K.rgb('#c4d8ff')], [1, K.rgb('#7fb0ff')], [2, K.rgb('#4f86ff')]];
    VOL.forEach((p, i) => { p.col = K.ramp(p.x >= 0 ? warm : cool, Math.abs(p.x)); col.set(p.col, i * 3); av.set([p.delay, p.sig ? 1 : 0, p.ex !== undefined ? 1 : 0, 0], i * 4); });
    volGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 3)); volGeo.setAttribute('aV', new THREE.InstancedBufferAttribute(av, 4)); }
  const volMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uRev: { value: 0 }, uSig: { value: 0 } },
    transparent: true, depthWrite: false,
    vertexShader: `
attribute vec3 aCol; attribute vec4 aV; uniform float uA, uRev, uSig;
varying vec3 vN, vV, vC; varying float vAl;
void main() {
  float g = clamp((uRev - aV.x) / 0.14, 0.0, 1.0); g = g * g * (3.0 - 2.0 * g);
  vec4 p = instanceMatrix * vec4(position * g * (1.0 + 0.35 * aV.z), 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vec4 mv = modelViewMatrix * p; vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  float on = aV.y * uSig;
  vC = mix(vec3(0.36, 0.42, 0.5), aCol, on);
  vAl = uA * mix(0.4, 1.0, on) * step(0.001, g);
}`,
    fragmentShader: `
varying vec3 vN, vV, vC; varying float vAl;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.4, 0.6, 0.7));
  float l = max(dot(n, L), 0.0), rim = pow(1.0 - max(dot(n, v), 0.0), 2.0), sp = pow(max(dot(reflect(-L, n), v), 0.0), 24.0);
  gl_FragColor = vec4(vC * (0.4 + 0.7 * l) + vC * rim * 0.7 + vec3(sp * 0.35), vAl);
}`,
  });
  set.mats.push(volMat);
  const vol = new THREE.InstancedMesh(volGeo, volMat, NV);
  { const m = new THREE.Matrix4(); VOL.forEach((p, i) => { m.makeScale(p.rad, p.rad, p.rad); m.setPosition(p.pos[0], p.pos[1], p.pos[2]); vol.setMatrixAt(i, m); }); }
  vol.frustumCulled = false; vol.renderOrder = 5; vg.add(vol);
  // axes, grid and the significance plane
  const XM = 3.8 * VS.x, YT = VS.y0 + 21 * VS.y, ZB = -0.2, ZF = 0.2;
  { const segs = [], add = (a, b, c, al, t) => segs.push([a, b, c, al, t]);
    const ink = K.rgb('#9fb0c6'), dim = K.rgb('#5a6b82'), amb = K.rgb('#ffb43b');
    add([-XM, VS.y0, ZF], [XM, VS.y0, ZF], ink, 0.8, 0); add([-XM, VS.y0, ZB], [XM, VS.y0, ZB], dim, 0.5, 0);
    add([-XM, VS.y0, ZB], [-XM, YT, ZB], ink, 0.6, 0.1);
    for (let x = -3; x <= 3; x++) { const X = x * VS.x; add([X, VS.y0, ZF], [X, VS.y0 - 0.02, ZF + 0.02], ink, 0.8, 0.1); add([X, VS.y0, ZB], [X, YT, ZB], dim, x ? 0.18 : 0, 0.2); add([X, VS.y0, ZB], [X, VS.y0, ZF], dim, 0.18, 0.2); }
    for (let y = 0; y <= 20; y += 5) { const Y = VS.y0 + y * VS.y; add([-XM, Y, ZB], [XM, Y, ZB], dim, y ? 0.16 : 0, 0.3); add([-XM, Y, ZB], [-XM - 0.02, Y, ZB], ink, 0.8, 0.3); }
    for (let y = 0; y < 21; y += 0.6) add([0, VS.y0 + y * VS.y, ZB], [0, VS.y0 + (y + 0.3) * VS.y, ZB], ink, 0.45, 0.4);   // the zero line, dashed
    const Ys = VS.y0 + 3 * VS.y;
    add([-XM, Ys, ZF], [XM, Ys, ZF], amb, 0.9, 0.6); add([-XM, Ys, ZB], [XM, Ys, ZB], amb, 0.6, 0.6); add([-XM, Ys, ZB], [-XM, Ys, ZF], amb, 0.6, 0.6); add([XM, Ys, ZB], [XM, Ys, ZF], amb, 0.6, 0.6);
    const g = K.linesGeo(segs.length), P = g.attributes.position.array, C = g.attributes.aCol.array, A = g.attributes.aA.array, T = g.attributes.aT.array;
    segs.forEach((s, i) => { P.set(s[0], i * 6); P.set(s[1], i * 6 + 3); C.set(s[2], i * 6); C.set(s[2], i * 6 + 3); A[i * 2] = A[i * 2 + 1] = s[3]; T[i * 2] = T[i * 2 + 1] = s[4]; });
    const L = new THREE.LineSegments(g, K.lines(set)); L.renderOrder = 4; vg.add(L); vg.userData.lines = L;
    const pm = K.fade(set, new THREE.MeshBasicMaterial({ color: 0xffb43b, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0.07);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2 * XM, ZF - ZB), pm); pl.rotation.x = -PI / 2; pl.position.set(0, Ys, 0); pl.renderOrder = 4; vg.add(pl); vg.userData.plane = pl;
  }
  // the plot as an object in space: a dark glass floor under the bubbles, the two axes as lit rods, each bubble's soft
  // shadow on the floor, a thin line down to it from each significant one, and a halo round those
  {
    const floorM = K.fade(set, new THREE.MeshStandardMaterial({ color: 0x0b1626, roughness: 0.3, metalness: 0.25, transparent: true }), 0.85);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(2 * XM + 0.1, 0.014, ZF - ZB + 0.1), floorM);
    fl.position.set(0, VS.y0 - 0.009, 0); fl.renderOrder = 3; vg.add(fl);
    const rodM = K.fade(set, new THREE.MeshStandardMaterial({ color: 0xa9b8cc, roughness: 0.35, metalness: 0.4, emissive: 0x16202c, transparent: true }), 1);
    const rods = K.merge([K.tube([[-XM - 0.02, VS.y0, ZF], [XM + 0.02, VS.y0, ZF]], 0.0055, 2, 10), K.tube([[-XM, VS.y0, ZB], [-XM, YT, ZB]], 0.0055, 2, 10)]);
    const rm = new THREE.Mesh(rods, rodM); rm.renderOrder = 4; vg.add(rm);
    // shadows and halos: one quad per bubble, popping in with it (the bubbles' own reveal, shared uniforms)
    const hgeo = new THREE.InstancedBufferGeometry();
    hgeo.setIndex([0, 1, 2, 0, 2, 3]);
    hgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    const hp = new Float32Array(NV * 4), hv = new Float32Array(NV * 4), hc = new Float32Array(NV * 3);
    VOL.forEach((p, i) => { hp.set([...p.pos, p.rad], 4 * i); hv.set([p.delay, p.sig ? 1 : 0, p.ex !== undefined ? 1 : 0, 0], 4 * i); hc.set(p.col, 3 * i); });
    hgeo.setAttribute('aP', new THREE.InstancedBufferAttribute(hp, 4)); hgeo.setAttribute('aV', new THREE.InstancedBufferAttribute(hv, 4)); hgeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(hc, 3));
    hgeo.instanceCount = NV; hgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    const U2 = volMat.uniforms;
    const qv = (kind) => `
attribute vec4 aP, aV; attribute vec3 aCol; uniform float uA, uRev, uSig;
varying vec2 vQ; varying vec3 vC; varying float vAl;
void main() {
  float g = clamp((uRev - aV.x) / 0.14, 0.0, 1.0); g = g * g * (3.0 - 2.0 * g);
  float on = aV.y * uSig, r = aP.w * (1.0 + 0.35 * aV.z) * g;
  vQ = position.xy; vC = aCol;
  ${kind ? `vec4 mv = modelViewMatrix * vec4(aP.xyz, 1.0); mv.xy += position.xy * r * 3.0 * length(modelViewMatrix[0].xyz);
  vAl = uA * on;` : `float hgt = aP.y - ${VS.y0.toFixed(3)};
  vec4 mv = modelViewMatrix * vec4(aP.x + position.x * r * 1.7, ${(VS.y0 + 0.0005).toFixed(4)}, aP.z + position.y * r * 1.7, 1.0);
  vAl = uA * mix(0.25, 0.6, on) / (1.0 + 5.0 * hgt);`}
  gl_Position = projectionMatrix * mv;
  if (vAl < 0.004 || g < 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
    const shadowM = new THREE.ShaderMaterial({ uniforms: U2, transparent: true, depthWrite: false, vertexShader: qv(0),
      fragmentShader: 'varying vec2 vQ; varying float vAl; void main() { float d = dot(vQ, vQ); if (d > 1.0) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, vAl * (1.0 - d) * (1.0 - d)); }' });
    const haloM = new THREE.ShaderMaterial({ uniforms: U2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: qv(1),
      fragmentShader: 'varying vec2 vQ; varying vec3 vC; varying float vAl; void main() { float d = length(vQ); if (d > 1.0) discard; float g = exp(-max(d * 3.0 - 0.95, 0.0) * 1.7) * smoothstep(1.0, 0.6, d); gl_FragColor = vec4(mix(vC, vec3(1.0), 0.2) * g * 0.55, g * vAl); }' });
    set.mats.push(shadowM, haloM);
    const sh = new THREE.Mesh(hgeo, shadowM); sh.frustumCulled = false; sh.renderOrder = 4; vg.add(sh);
    const ha = new THREE.Mesh(hgeo, haloM); ha.frustumCulled = false; ha.renderOrder = 6; vg.add(ha);
    // (the drop lines: from each significant bubble to the floor)
    const sig = VOL.filter(p => p.sig), dg = K.linesGeo(sig.length), DP = dg.attributes.position.array, DC = dg.attributes.aCol.array, DA = dg.attributes.aA.array;
    sig.forEach((p, i) => { DP.set(p.pos, 6 * i); DP.set([p.pos[0], VS.y0, p.pos[2]], 6 * i + 3); DC.set(p.col, 6 * i); DC.set(p.col, 6 * i + 3); DA[2 * i] = 0.5; DA[2 * i + 1] = 0.1; });
    const dl = new THREE.LineSegments(dg, K.lines(set)); dl.frustumCulled = false; dl.renderOrder = 4; vg.add(dl); vg.userData.drops = dl;
  }

  // ---------------------------------------------------------------- trajectories over age (a staircase of lanes)
  const TRJ = Array.isArray(FIG.trajectories) ? FIG.trajectories : [];
  const trj = re => { const t = TRJ.find(q => re.test(q.title || '') || re.test(q.domain || '')); if (!t) return null;
    const pts = [].concat(t.points || [], t.pointsMid || []).filter(p => p && p[1] !== null && isFinite(p[1])).sort((a, b) => a[0] - b[0]); return pts.length > 2 ? pts : null; };
  const exName = k => (EX[k] ? cap(canon(EX[k].domain)) : '');
  const exWhere = k => { const t = String((EX[k] || {}).tissue || '').toLowerCase(); return /gastro|intestin|gut/.test(t) ? 'gut' : t; };
  const LANES = [
    { name: 'Calcified plaques', rest: ' arteries', col: '#ff5a4b',
      pts: trj(/calcified/) || [[20, 0.8], [30, 0.6], [40, 0.75], [50, 1.8], [60, 2.9], [70, 4.1]] },
    { name: 'Infarct tissue', rest: ' heart', col: '#ff5ad9',
      pts: trj(/infarct/) || [[20, 0.02], [30, 0], [40, 0.02], [50, 0.03], [60, 0.11], [70, 0.3]] },
  ];
  EX.forEach((e, k) => LANES.push({ name: exName(k), rest: ` ${f1(e.from)} → ${f1(e.to)} %`, col: domainColour(e.domain), pts: [[AGES[0], +e.from], [AGES[1], +e.to]], ex: k }));
  const NL = LANES.length, LX = 0.85, LH = 0.27;
  const laneY = j => -0.5 + j * 0.19, laneZ = j => 0.3 - j * 0.15, ageX = a => -LX + (a - AGES[0]) / (AGES[1] - AGES[0]) * 2 * LX;
  // each lane fills its own height; an example lane that only falls a little (a share of 83 % to 68 %) stands on its own
  // floor (its fall takes 30 % of the lane's height, against 18 to 20 % from zero), so it reads as a fall, not a bar; its
  // label gives the numbers
  LANES.forEach(l => { const vs = l.pts.map(p => p[1]), mx = Math.max(...vs) || 1, mn = Math.min(...vs);
    const lo = l.ex !== undefined ? Math.max(0, mn - 2.3 * (mx - mn)) : 0, nv = v => Math.max(0, (v - lo) / ((mx - lo) || 1));
    l.at = a => { const P = l.pts; if (a <= P[0][0]) return nv(P[0][1]); for (let i = 1; i < P.length; i++) if (a <= P[i][0]) {
      const p0 = P[Math.max(0, i - 2)], p1 = P[i - 1], p2 = P[i], p3 = P[Math.min(P.length - 1, i + 1)], t = (a - p1[0]) / (p2[0] - p1[0]), t2 = t * t, t3 = t2 * t;
      const v = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      return nv(Math.max(0, v)); } return nv(P[P.length - 1][1]); }; });
  const cg = new THREE.Group(); set.group.add(cg);
  { const SEG = 60, pos = [], nor = [], col = [], at = [], ak = [];
    const push = (p, n, c, t, k) => { pos.push(...p); nor.push(...n); col.push(...c); at.push(t); ak.push(...k); };
    LANES.forEach((l, j) => { const c = K.rgb(l.col), y0 = laneY(j), z = laneZ(j), Y = a => y0 + LH * l.at(a);
      for (let s = 0; s < SEG; s++) { const a0 = AGES[0] + (AGES[1] - AGES[0]) * s / SEG, a1 = AGES[0] + (AGES[1] - AGES[0]) * (s + 1) / SEG, t0 = s / SEG, t1 = (s + 1) / SEG;
        const x0 = ageX(a0), x1 = ageX(a1), q = [[x0, y0, z, t0, 0], [x1, y0, z, t1, 0], [x1, Y(a1), z, t1, 1], [x0, Y(a0), z, t0, 1]];
        for (const v of [0, 1, 2, 0, 2, 3]) push(q[v].slice(0, 3), [0, 0, 1], c, q[v][3], [j, q[v][4], 0]); }
      // (a lit ribbon along the curve's top, a band 0.034 deep, so each trajectory reads as a solid edge in depth)
      for (let s = 0; s < SEG; s++) { const a0 = AGES[0] + (AGES[1] - AGES[0]) * s / SEG, a1 = AGES[0] + (AGES[1] - AGES[0]) * (s + 1) / SEG, t0 = s / SEG, t1 = (s + 1) / SEG;
        const x0 = ageX(a0), x1 = ageX(a1), y0r = Y(a0), y1r = Y(a1), nl = Math.hypot(y1r - y0r, x1 - x0) || 1, nn = [-(y1r - y0r) / nl, (x1 - x0) / nl, 0];
        const q = [[x0, y0r, z - 0.017, t0], [x1, y1r, z - 0.017, t1], [x1, y1r, z + 0.017, t1], [x0, y0r, z + 0.017, t0]];
        for (const v of [0, 1, 2, 0, 2, 3]) push(q[v].slice(0, 3), nn, c.map(x => x * 0.85), q[v][3], [j, 1, 1]); }
      const tg = K.tube(Array.from({ length: SEG + 1 }, (_, s) => { const a = AGES[0] + (AGES[1] - AGES[0]) * s / SEG; return [ageX(a), Y(a), z + 0.018]; }), 0.0075, SEG * 2, 8).toNonIndexed();
      const P = tg.attributes.position.array, N = tg.attributes.normal.array;
      for (let v = 0; v < P.length / 3; v++) push([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]], c, c01((P[v * 3] + LX) / (2 * LX)), [j, 1, 1]); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(at, 1)); g.setAttribute('aK', new THREE.Float32BufferAttribute(ak, 3));
    const m = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uRev: { value: new Array(NL).fill(0) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `
attribute vec3 aCol, aK; attribute float aT; uniform float uA, uRev[${NL}];
varying vec3 vC, vN, vV; varying float vA, vY, vKind;
void main() {
  float rv = uRev[int(aK.x + 0.5)];
  vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
  vC = aCol; vY = aK.y; vKind = aK.z; vA = uA * smoothstep(rv + 0.004, rv - 0.004, aT);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `
varying vec3 vC, vN, vV; varying float vA, vY, vKind;
void main() {
  if (vKind > 0.5) { vec3 n = normalize(vN), v = normalize(vV); float l = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.3, 0.7, 0.6))), 0.0);
    gl_FragColor = vec4(mix(vC, vec3(1.0), 0.25) * l * 1.1, vA); return; }
  gl_FragColor = vec4(vC * (0.02 + 0.3 * pow(vY, 3.0)), vA);
}` });
    set.mats.push(m); const cm = new THREE.Mesh(g, m); cm.frustumCulled = false; cm.renderOrder = 5; cg.add(cm); cg.userData.mat = m;
    // each lane stands on a strip of dark glass
    const laneM = K.fade(set, new THREE.MeshStandardMaterial({ color: 0x0d1a2b, roughness: 0.3, metalness: 0.25, transparent: true }), 0.85);
    const lanes = K.merge(LANES.map((l, j) => { const b = new THREE.BoxGeometry(2 * LX + 0.06, 0.008, 0.07); b.translate(0, laneY(j) - 0.0045, laneZ(j)); return b; }));
    const lm = new THREE.Mesh(lanes, laneM); lm.renderOrder = 4; cg.add(lm);
    // baselines, decade marks, the 40 and 60 guides
    const segs = [], ink = K.rgb('#9fb0c6'), dim = K.rgb('#56677e');
    LANES.forEach((l, j) => { const y0 = laneY(j), z = laneZ(j); segs.push([[-LX, y0, z], [LX, y0, z], dim, 0.55, 0]);
      for (let a = AGES[0]; a <= AGES[1]; a += 10) segs.push([[ageX(a), y0, z], [ageX(a), y0 + (j ? 0.015 : -0.03), z], ink, j ? 0.35 : 0.8, 0]); });
    for (const a of [40, 60]) for (let j = 0; j < NL - 1; j++) segs.push([[ageX(a), laneY(j), laneZ(j)], [ageX(a), laneY(j + 1), laneZ(j + 1)], K.rgb('#ffb43b'), 0.35, 0]);
    for (const a of [40, 60]) for (let j = 0; j < NL; j++) for (let y = 0; y < LH; y += 0.03) segs.push([[ageX(a), laneY(j) + y, laneZ(j)], [ageX(a), laneY(j) + y + 0.015, laneZ(j)], K.rgb('#ffb43b'), 0.25, 0]);
    const lg = K.linesGeo(segs.length), P = lg.attributes.position.array, C = lg.attributes.aCol.array, A = lg.attributes.aA.array;
    segs.forEach((s, i) => { P.set(s[0], i * 6); P.set(s[1], i * 6 + 3); C.set(s[2], i * 6); C.set(s[2], i * 6 + 3); A[i * 2] = A[i * 2 + 1] = s[3]; });
    cg.add(new THREE.LineSegments(lg, K.lines(set)));
    // a bright head where each lane is drawing
    const hg = K.pointsGeo(NL); LANES.forEach((l, j) => { hg.attributes.aCol.array.set(K.v3.lerp(K.rgb(l.col), [1, 1, 1], 0.35), j * 3); hg.attributes.aSize.array[j] = 0.045; });
    const hp = new THREE.Points(hg, K.points(set)); hp.frustumCulled = false; cg.add(hp); cg.userData.head = hp;
  }

  // ---------------------------------------------------------------- the age gauge under a focused section
  const GY = 1.1;   // the gauge runs along the top of the focused section's plate
  const gaugeG = K.linesGeo(8), gaugeL = new THREE.LineSegments(gaugeG, K.lines(set)); gaugeL.frustumCulled = false; set.group.add(gaugeL);
  const markG = K.pointsGeo(1), mark = new THREE.Points(markG, K.points(set)); mark.frustumCulled = false; set.group.add(mark);
  markG.attributes.aCol.array.set(K.rgb('#ffb43b')); markG.attributes.aSize.array[0] = 0.05;
  for (let i = 0; i < 8; i++) { const c = K.rgb(i === 7 ? '#ffb43b' : '#9fb0c6'); gaugeG.attributes.aCol.array.set(c, i * 6); gaugeG.attributes.aCol.array.set(c, i * 6 + 3); }

  // ---------------------------------------------------------------- the morph into the network (atlas_net)
  // In the story the atlas turns into the network of organ architecture (the hier set), one level after another, as
  // the network grows (hier_grow, which the engine keys with atlas_net: g = (atlas_net - NET0) / (1 - NET0), so the
  // atlas leads by NET0): first each section's tiles gather into a bead per domain; each section's organ flies up to
  // its organ's node (sections of one organ merge there); each section, its plate fading, flies to its tissue's node
  // (to its organ's where the organ is one tissue); its beads fly on to their tissue type's node and on to their
  // domain's node, where they shrink with a flash. Each node of the network grows as its things arrive. The targets are
  // the network's own (its api().layout(), handed over by the engine: useNetwork) in its frame, which the story gives
  // this set's turn (buildCamera) so they meet exactly.
  const NET0 = 0.25, gOf = n => (n > 0 ? (n - NET0) / (1 - NET0) : -1);
  // the atlas's domain names that are not the network's: its own name for one, or none of its own (null: the domain
  // goes to its tissue type's node; '': the slide's edge, not a domain, stays with its tissue). Every other name is
  // the network's; a name that is neither is reported once (console) and goes to its tissue type
  const NETMAP = { 'adipose tissue': 'fat', 'cardiac muscle': 'myocardium',
    'connective tissue': null, 'skeletal muscle': null, 'calcified plaques': null, 'cyst': null, 'renal tubules': null,
    'gastric glands': null, 'gastric foveolae': null, 'tissue edge': '' };
  let NET = null, MAP = null;
  const MS = TT.map(() => null);   // per section: its organ's and its own flight
  const bez = (a, b, c, e) => [0, 1, 2].map(q => (1 - e) * (1 - e) * a[q] + 2 * e * (1 - e) * b[q] + e * e * c[q]);
  const lift = (a, c, h) => { const m = K.v3.lerp(a, c, 0.5); return [m[0], m[1] + h, m[2] + 0.12]; };
  // a flash where things arrive: one additive glow per event, by the network's growth (uG)
  const flGeo = new THREE.InstancedBufferGeometry();
  flGeo.setIndex([0, 1, 2, 0, 2, 3]);
  flGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  const flMat = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uG: tileMat.uniforms.uG }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec4 aFP, aFC; uniform float uA, uG;
varying vec2 vQ; varying vec3 vC; varying float vF;
void main() {
  float x = (uG - aFP.w) / 0.026, f = uG > -0.9 ? exp(-x * x) : 0.0;
  vQ = position.xy; vC = aFC.rgb; vF = f * uA;
  vec4 mv = modelViewMatrix * vec4(aFP.xyz, 1.0);
  mv.xy += position.xy * aFC.w * (0.6 + 0.6 * f) * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
  if (vF < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
varying vec2 vQ; varying vec3 vC; varying float vF;
void main() {
  float d = dot(vQ, vQ);
  if (d > 1.0) discard;
  float g = exp(-d * 4.0) * (1.0 - d) + 0.8 * exp(-d * 40.0);
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.35) * g * vF, g * vF);
}` });
  set.mats.push(flMat);
  const flash = new THREE.Mesh(flGeo, flMat); flash.frustumCulled = false; flash.renderOrder = 6; flash.visible = false; flash.raycast = () => {};
  set.group.add(flash);
  function useNetwork(L) {
    if (NET || !L || !Array.isArray(L.pos) || !Array.isArray(L.start)) return;
    const lv = L.level, low = L.name.map(s => String(s).toLowerCase()), GSL = L.levelStart || [0, 0.22, 0.44, 0.66], st = L.start;
    const node = (name, level) => low.findIndex((s, i) => lv[i] === level && s === String(name).toLowerCase());
    const P = i => L.pos[i], R = i => L.size[i] || 0.03;
    // the atlas's domains -> the network's nodes (d: its domain node or -1; ty: its tissue type's node or -1)
    MAP = {};
    const miss = [];
    for (const nm in DT) {
      const m = NETMAP[nm];
      const d = m === undefined ? node(nm, 3) : m ? node(m, 3) : -1;
      let ty = d >= 0 ? (L.up[d] || []).find(u => lv[u] === 2) : m === '' ? -1 : node(typeOf(nm), 2);
      if (ty === undefined) ty = -1;
      if ((m === undefined && d < 0) || (m && d < 0)) miss.push(nm);
      MAP[nm] = { d, ty, as: d >= 0 ? L.name[d] : ty >= 0 ? L.name[ty] + ' (tissue type)' : 'its tissue' };
    }
    if (miss.length) console.warn('atlas: no node in the network for', miss.join(', '));
    // each section: its organ's flight (1) and its own (2), to its tissue's node or its organ's
    const FL = [], flashAt = (p, g, col, size) => FL.push([...p, g, ...K.rgb(col), size]);
    const seen = new Set();
    TT.forEach((row, ti) => {
      const on = node(ORGAN[ti], 0), tn = node(NAMES[ti], 1), sn = tn >= 0 ? tn : on;
      if (on < 0) return;
      const r = rng(1300 + ti), G = GRID[ti], c = Math.cos(G.yaw), sn0 = Math.sin(G.yaw), l = [-0.86, 0.9, 0.34];
      const c0 = [G.p[0] + (l[0] * c + l[2] * sn0) * S0, G.p[1] + l[1] * S0, G.p[2] + (-l[0] * sn0 + l[2] * c) * S0];
      const arr1 = st[on] + 0.012, dep1 = arr1 - 0.2 * (0.8 + 0.4 * r());
      const arr2 = (tn >= 0 ? st[tn] : GSL[1] + st[on] - GSL[0]) + 0.012, dep2 = arr2 - 0.19;
      // (the section comes to rest just outside its node, on the side away from the axis, so the node stays in sight)
      const np = P(sn), rad = Math.hypot(np[0], np[2]) || 1, out = [np[0] / rad, 0, np[2] / rad], gap = R(sn) * 0.9 + 0.03;
      const s2 = [np[0] + out[0] * gap, np[1] - 0.01, np[2] + out[2] * gap];
      MS[ti] = { on, sn, dep1, arr1, c0, c1: lift(c0, P(on), 0.3 + 0.1 * r()), dep2, arr2, s2, s1: lift(G.p, s2, 0.22), sEnd: 0.034 };
      if (!seen.has(on)) { seen.add(on); flashAt(P(on), arr1, '#7dffb0', R(on) * 2.4); }
      flashAt(s2, arr2, '#c4f5b8', 0.07);
    });
    // each tile: its tissue type's node and its domain's, when it leaves and gets there, and its place in the clumps
    const nT = {}, nD = {}, bead = {};
    let o = 0;
    SEC.forEach((s, ti) => { for (let j = 0; j < s.N; j++, o++) { const m = MS[ti], mp = MAP[REC[ti][s.d0[j]].name]; if (!m) continue;
      if (mp.ty >= 0) nT[mp.ty] = (nT[mp.ty] || 0) + 1; if (mp.d >= 0) nD[mp.d] = (nD[mp.d] || 0) + 1; } });
    const rOf = n => 0.0036 * Math.cbrt(Math.max(1, n));
    const r = rng(4711);
    o = 0;
    SEC.forEach((s, ti) => {
      const m = MS[ti];
      for (let j = 0; j < s.N; j++, o++) {
        const dn = REC[ti][s.d0[j]].name, mp = MAP[dn];
        const u = K.unit(r), q = Math.cbrt(r()); aNC.set([u[0] * q, u[1] * q, u[2] * q], o * 4);
        if (!m) { aNA.set([0, 0, 0, 9], o * 4); aNC[o * 4 + 3] = 9; aNB.set([0, 0, 0, 9], o * 4); continue; }   // (never leaves)
        const bk = ti + ':' + dn, rb = bead[bk] === undefined ? (bead[bk] = r()) : bead[bk];   // (a bead's tiles fly together)
        if (mp.ty < 0) {   // the slide's edge: gathers into its section's middle and goes there
          aNA.set([...m.s2, m.arr2 + 0.07], o * 4); aNC[o * 4 + 3] = m.arr2 + 0.02; aNB.set([...m.s2, m.arr2 + 0.08], o * 4);
          aND[o * 4 + 2] = aND[o * 4 + 3] = 0.006; continue;
        }
        const a3 = st[mp.ty] + 0.012 + 0.04 * rb;
        aNA.set([...P(mp.ty), a3], o * 4); aNC[o * 4 + 3] = Math.max(a3 - 0.17, m.arr2 + 0.012 + 0.03 * rb);
        aND[o * 4 + 2] = rOf(nT[mp.ty]);
        if (mp.d >= 0) { aNB.set([...P(mp.d), st[mp.d] + 0.012], o * 4); aND[o * 4 + 3] = rOf(nD[mp.d]); }
        else { aNB.set([...P(mp.ty), GSL[3] + 0.03 + 0.06 * rb], o * 4); aND[o * 4 + 3] = 0.35 * rOf(nT[mp.ty]); }   // (no node of its own: into its type's)
      }
    });
    for (const k of ['aNA', 'aNB', 'aNC', 'aND']) tileGeo.attributes[k].needsUpdate = true;
    for (const t in nT) flashAt(P(+t), st[+t] + 0.035, '#ffc2a8', rOf(nT[t]) * 2.2);
    for (const d in nD) flashAt(P(+d), st[+d] + 0.02, '#a8d4ff', R(+d) * 2.5 + rOf(nD[d]));
    const fp = new Float32Array(FL.length * 4), fc = new Float32Array(FL.length * 4);
    FL.forEach((f, i) => { fp.set(f.slice(0, 4), i * 4); fc.set(f.slice(4, 8), i * 4); });
    flGeo.setAttribute('aFP', new THREE.InstancedBufferAttribute(fp, 4)); flGeo.setAttribute('aFC', new THREE.InstancedBufferAttribute(fc, 4));
    flGeo.instanceCount = FL.length;
    NET = L;
  }

  // ---------------------------------------------------------------- per-frame state
  const cur = { fw: new Float32Array(NT), P: TT.map(() => [0, 0, 0]), s: new Float32Array(NT), yaw: new Float32Array(NT), al: new Float32Array(NT),
    first: true, t: 0, fmax: 0, fi: -1, lib: 1, map: 0, um: 0, vc: 0, volc: 0, curv: 0, age: 0, vOff: [0, 0, 0], vS: 1, gauge: 0, rev: new Array(NL).fill(0) };
  const exSet = new Set(exT.filter(i => i >= 0));
  const secW = (i, l) => { const p = cur.P[i], s = cur.s[i], c = Math.cos(cur.yaw[i]), sn = Math.sin(cur.yaw[i]); return [p[0] + l[0] * c * s + (l[2] || 0) * sn * s, p[1] + l[1] * s, p[2] - l[0] * sn * s + (l[2] || 0) * c * s]; };
  const inG = (g, p) => [g.position.x + p[0] * g.scale.x, g.position.y + p[1] * g.scale.y, g.position.z + p[2] * g.scale.z];
  const focusW = (S, i) => { const fp = clamp(S.atlas_focus || 0, 0, NT); return fp < 0.5 ? 0 : c01(1 - Math.abs(fp - (i + 1))); };

  function update(S, t, dt) {
    const lib = c01(S.atlas_lib), map = c01(S.atlas_map), um = c01(S.atlas_umap), age = c01(S.atlas_age), volc = c01(S.atlas_volcano), curv = c01(S.atlas_curves);
    const MG = NET ? gOf(c01(S.atlas_net || 0)) : -1;   // the network's growth while the atlas turns into it (-1: not)
    tileMat.uniforms.uG.value = MG; flash.visible = MG > -0.9;
    // (snaps on the first frame, without a dt, after a long frame or when t jumps: a seek, story to explore)
    const vc = Math.max(volc, curv), snap = cur.first || !(dt >= 0) || dt > 0.3 || Math.abs(t - cur.t - dt) > 0.3, ke = snap ? 1 : 1 - Math.exp(-5 * dt);
    cur.first = false; cur.t = t;
    Object.assign(cur, { lib, map, um, age, volc, curv, vc });
    // focus: eased (the engine steps it), passing through fractional values
    let fmax = 0, fi = -1;
    for (let i = 0; i < NT; i++) { cur.fw[i] += (focusW(S, i) - cur.fw[i]) * ke; if (cur.fw[i] < 1e-3) cur.fw[i] = 0; if (cur.fw[i] > fmax) { fmax = cur.fw[i]; fi = i; } }
    cur.fmax = fmax; cur.fi = fi;
    // the library
    const dimW = (1 - 0.72 * map) * (1 - 0.85 * um) * (1 - vc) * (1 - 0.6 * fmax), libV = lib * dimW;   // (no wall behind a plot)
    wallMat.uniforms.uLib.value = lib; wallMat.uniforms.uVis.value = libV; wall.visible = libV > 0.04 && lib > 0.002;
    rackMat.uniforms.uK.value = sm(c01(lib / 0.12)) * dimW; rack.visible = rackMat.uniforms.uK.value > 0.01;   // (the rack stands first)
    wallGeo.setDrawRange(0, map > 0.2 || um > 0.2 || vc > 0.2 ? 6 : 18);   // (a dimmed wall behind the sections: the slides' faces only)
    // the sections: from their tissue's column on the wall to the grid, one of them forward when focused
    const wc = vc > 0 ? curv / (volc + curv) : 0, F0 = [0, 0.02, 0.72], FV = [lerp(0.74, 0.84, wc), 0.04, 0.5], Fp = K.v3.lerp(F0, FV, vc), sF = lerp(0.42, 0.33, vc);
    let anySec = 0;
    for (let i = 0; i < NT; i++) {
      const g = GRID[i], d = 0.5 * ((i % COLS) / (COLS - 1) * 0.6 + Math.floor(i / COLS) / 3 * 0.4), km = sm((map * 1.5 - d) / 0.5), fw = cur.fw[i];
      let p = K.v3.lerp(WALLMID[i], g.p, km); p[2] += 0.25 * Math.sin(PI * km);
      let s = lerp(0.012, S0, km), yaw = g.yaw * km + (1 - km) * -uTh(WST[i] + WCOLS[i] / 2);
      p[2] -= 0.3 * fmax * (1 - fw);
      p = K.v3.lerp(p, Fp, fw); s = lerp(s, sF, fw); yaw = lerp(yaw, 0, fw);
      let al = Math.max(Math.min(1, km * 3) * map, fw);
      al *= (1 - 0.82 * fmax * (1 - fw)) * (1 - sm(c01(vc / 0.15)) * (1 - fw));   // (gone behind a plot, the volcano or the trajectories, as soon as it starts)
      let cm = Math.max(prog(map, 0.55, 0.95) * km, fw);
      // the morph: the section flies to its tissue's node, shrinking, its plate fading (cm above 1, read by the shaders)
      const m = MG > -0.9 && MS[i], k2 = m ? c01((MG - m.dep2) / (m.arr2 - m.dep2)) : 0;
      if (k2 > 0) { const e = sm(k2); p = bez(p, m.s1, m.s2, e); s = Math.exp(lerp(Math.log(s), Math.log(m.sEnd), e)); yaw = lerp(yaw, 0, e); cm = 1 + prog(k2, 0, 0.45); }
      cur.P[i] = p; cur.s[i] = s; cur.yaw[i] = yaw; cur.al[i] = al; anySec = Math.max(anySec, al);
      uP[i].set(p[0], p[1], p[2], s); uQ[i].set(yaw, al, cm, fw);
    }
    // the cloud
    tileMat.uniforms.uUm.value = um; tileMat.uniforms.uAge.value = age; tileMat.uniforms.uFoc.value = fmax;
    tileMat.uniforms.uCA.value = 1 - 0.88 * vc; tileMat.uniforms.uCR.value = 0.5 + 0.035 * t;
    tiles.visible = anySec > 0.003 || um > 0.002;
    const hi = fmax > 0.02 && fi >= 0 ? fi : -1;
    tileMat.uniforms.uHero.value = hi; hero.visible = hi >= 0 && tiles.visible;
    if (hi >= 0 && hi !== heroI) { hero.geometry.dispose(); hero.geometry = heroGeo(hi); heroI = hi; }
    // the sections' organs (gone as the tiles fly to the cloud)
    if (!orgMesh && O3) { if (!O3.driven) O3.step(3); buildOrgans(); }   // (the engine steps them itself)
    if (orgMesh) {
      const show = 1 - sm(um * 2.5);
      orgMesh.visible = anySec > 0.003 && show > 0.01 && vc < 0.5;   // (not beside a plot: the sections there are dim)
      if (orgMesh.visible) for (let i = 0; i < NT; i++) {
        const m = MG > -0.9 && MS[i], k1 = m ? c01((MG - m.dep1) / (m.arr1 - m.dep1)) : 0;
        if (k1 <= 0) { const p = secW(i, [-0.86, 0.9, 0.34]); mP[i].set(p[0], p[1], p[2], Math.min(cur.s[i] * 0.3, 0.075)); mQ[i].set(cur.al[i] * show, 0.25 * cur.fw[i], t * 0.4 + i, 0); continue; }
        // the morph: the organ flies up to its node in the network and turns as the network's model there does; landed,
        // it fades as that one grows (the same model, so they read as one), with a flash
        const o = m.on, e = sm(k1), ga = prog(MG, NET.start[o], NET.start[o] + NET.span), so = NET.size[o], sA = 0.75 * so;
        const p = k1 < 1 ? bez(m.c0, m.c1, NET.pos[o], e) : NET.pos[o];
        const own = t * 0.4 + i, dA = ((NET.spinRate * t + NET.spin[o] - own) % (2 * PI) + 3 * PI) % (2 * PI) - PI;
        mP[i].set(p[0], p[1], p[2], k1 < 1 ? lerp(Math.min(S0 * 0.3, 0.075), sA, e) : Math.max(sA, so * (0.25 + 0.75 * ga)));
        mQ[i].set(k1 < 1 ? 1 : 1 - ga, 0.25 + 0.6 * Math.sin(PI * k1) + 0.8 * Math.exp(-Math.pow((MG - m.arr1) / 0.02, 2)), own + dA * prog(k1, 0.5, 1), 0);
      }
    }
    tileMat.depthWrite = vc < 0.02 && fmax < 0.02;   // (dimmed sections behind a plot or a focused section must not hide what is in front of them)
    caps.visible = anySec > 0.003 && um < 0.998; capMat.uniforms.uUm.value = sm(um * 1.6);
    // the volcano (left of a focused section)
    const vS = 1 - 0.2 * fmax; vg.position.set(-0.5 * fmax, 0.02, 0.1); vg.scale.setScalar(vS); vg.visible = volc > 0.003;
    volMat.uniforms.uRev.value = volc * 1.05; volMat.uniforms.uSig.value = prog(volc, 0.68, 0.95);
    vg.userData.lines.material.uniforms.uReveal.value = prog(volc, 0, 0.35) * 1.0;
    vg.userData.drops.material.uniforms.uReveal.value = prog(volc, 0.7, 0.95) > 0 ? 1 : -1;
    vg.userData.plane.material.opacity = 0.07 * set.uA.value * prog(volc, 0.5, 0.8);   // from its base, never compounding
    // the trajectories
    cg.position.set(-0.69 * fmax, 0, 0.1); cg.scale.setScalar(1 - 0.34 * fmax); cg.visible = curv > 0.003;   // (beside a section: smaller, short names)
    const hd = cg.userData.head.geometry.attributes;
    LANES.forEach((l, j) => { const rv = c01((curv - 0.15 - 0.05 * j) / 0.6); cur.rev[j] = rv; cg.userData.mat.uniforms.uRev.value[j] = rv;
      const a = lerp(AGES[0], AGES[1], rv); hd.position.array.set([ageX(a), laneY(j) + LH * l.at(a), laneZ(j)], j * 3); hd.aA.array[j] = rv > 0.002 && rv < 0.998 ? 1 : 0; });
    hd.position.needsUpdate = true; hd.aA.needsUpdate = true;
    // the age gauge under the focused section
    const gA = fi >= 0 ? fmax * (exSet.has(fi) ? 1 : prog(age, 0, 0.05)) : 0;
    cur.gauge = gA; gaugeL.visible = mark.visible = gA > 0.003;
    if (gA > 0.003) { const GP = gaugeG.attributes.position.array, GA = gaugeG.attributes.aA.array, gy = GY;
      GP.set(secW(fi, [-0.8, gy, 0.02]), 0); GP.set(secW(fi, [0.8, gy, 0.02]), 3); GA[0] = GA[1] = gA * 0.9;
      for (let k = 0; k <= 5; k++) { const x = -0.8 + 1.6 * k / 5; GP.set(secW(fi, [x, gy, 0.02]), 6 + k * 6); GP.set(secW(fi, [x, gy + 0.05, 0.02]), 9 + k * 6); GA[2 + k * 2] = GA[3 + k * 2] = gA * 0.7; }
      GP.set(secW(fi, [-0.8, gy, 0.02]), 42); GP.set(secW(fi, [-0.8 + 1.6 * age, gy, 0.02]), 45); GA[14] = GA[15] = gA;
      gaugeG.attributes.position.needsUpdate = true; gaugeG.attributes.aA.needsUpdate = true;
      markG.attributes.position.array.set(secW(fi, [-0.8 + 1.6 * age, gy, 0.03]), 0); markG.attributes.aA.array[0] = gA;
      markG.attributes.position.needsUpdate = true; markG.attributes.aA.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- anchors, labels, views, controls
  const gaugeAt = x => () => (cur.fi >= 0 ? secW(cur.fi, [x, GY, 0.03]) : [0, 0, 0]);
  const anchors = {
    library: [0, 0, WC - WR], libTop: [0, WH / 2 + 0.07, WC - WR], libBase: [0, -WH / 2 - 0.08, WC - WR],
    libAge: wallAt(-TH, -0.12), libAge20: wallAt(-TH, -WH / 2 + 0.04), libAge70: wallAt(-TH, WH / 2 - 0.02), atlas: [0, 0, 0.12], atlasTop: [0, 0.72, 0.15],
    umap: () => [0, 0.05, 0.08], umapTop: () => [0, 0.7, 0.08],
    focus: () => (cur.fi >= 0 && cur.fmax > 0.3 ? cur.P[cur.fi].slice() : [0, 0, 0.12]),
    focusTop: () => (cur.fi >= 0 ? secW(cur.fi, [0, 1.08, 0]) : [0, 0.6, 0.12]),
    age20: gaugeAt(-0.8), age70: gaugeAt(0.8), ageMark: () => (cur.fi >= 0 ? secW(cur.fi, [-0.8 + 1.6 * cur.age, GY, 0.03]) : [0, 0, 0]),
    volcano: () => inG(vg, [0, 0, 0]), volcanoTop: () => inG(vg, [0, YT + 0.08, 0]), vLeft: () => inG(vg, [-0.6, VS.y0 - 0.06, ZF]), vRight: () => inG(vg, [0.6, VS.y0 - 0.06, ZF]),
    curves: () => inG(cg, [0, 0, 0]), curveAxis: () => inG(cg, [0, laneY(0) - 0.07, laneZ(0)]),
  };
  anchors.age = anchors.ageMark;   // the age readout's marker
  EX.forEach((e, k) => { const v = VOL.find(p => p.ex === k); anchors['ex' + k] = () => inG(vg, v ? v.pos : [0, 0, 0]);
    anchors['exDom' + k] = () => { const ti = exT[k]; if (ti < 0) return [0, 0, 0]; const s = SEC[ti], dk = REC[ti].findIndex(d => d.ex === k); return secW(ti, [...(s.exAt[dk] || [0, 0]), 0.03]); }; });
  for (let i = 0; i < NT; i++) { anchors['sec' + i] = () => cur.P[i].slice(); anchors['secTop' + i] = () => secW(i, [0, 1.1, 0]); }
  LANES.forEach((l, j) => { anchors['curve' + j] = () => inG(cg, [ageX(lerp(AGES[0], AGES[1], cur.rev[j])), laneY(j) + LH * l.at(lerp(AGES[0], AGES[1], cur.rev[j])), laneZ(j)]);
    anchors['curveTag' + j] = () => inG(cg, [LX + 0.02, laneY(j) + 0.8 * LH, laneZ(j)]); });   // (each lane's end, evenly spaced: the short names)

  const libLab = S => prog(S.atlas_lib, 0.75, 1) * (1 - prog(S.atlas_map, 0, 0.3)) * (1 - prog(Math.max(S.atlas_umap, S.atlas_volcano, S.atlas_curves), 0, 0.3)) * (S.atlas_focus >= 0.5 ? 0 : 1);
  const vcS = S => Math.max(S.atlas_volcano || 0, S.atlas_curves || 0), anyF = S => (S.atlas_focus >= 0.5 ? 1 : 0);
  const exTitle = exName;
  const labels = [
    { text: [fmt(TOTAL), ' slides'], at: 'libTop', cls: 'mag', alpha: libLab },
    { text: [`${F.tissues || NT} tissues`, ` of ${F.organs || 29} organs`], at: 'libBase', cls: '', alpha: libLab },
    { text: [`${fmt(F.donors || 983)} people`, `, aged ${AGES[0]} to ${AGES[1]}`], at: 'libAge', cls: 'amb', alpha: libLab },
    // the wall's rows run by the donor's age: say which way
    { text: [`${AGES[1]}`, ' years'], at: 'libAge70', cls: '', minor: true, alpha: libLab },
    { text: [`${AGES[0]}`, ' years'], at: 'libAge20', cls: '', minor: true, alpha: libLab },
    { text: [`${F.domains || 218} domains`, ` in ${F.types || 74} types`], at: 'atlasTop', cls: 'cyn',
      alpha: S => prog(S.atlas_map, 0.7, 1) * (1 - prog(S.atlas_umap, 0, 0.3)) * (1 - prog(vcS(S), 0, 0.1)) * (1 - anyF(S)) * (1 - prog(S.atlas_net || 0, 0, 0.06)) },   // (gone with the sections behind a plot, or as they turn into the network)
    { text: [`${Math.round((F.tiles || 162e6) / 1e6)} million tiles`, `, ${F.domains || 218} domains`], at: 'umapTop', cls: 'cyn',
      alpha: S => prog(S.atlas_umap, 0.6, 0.95) * (1 - prog(vcS(S), 0, 0.1)) * (1 - anyF(S)) },
    { text: [`${F.ageChange || 28} %`, ' of domains change with age'], at: 'volcanoTop', cls: 'amb', alpha: S => prog(S.atlas_volcano, 0.7, 1) },
    { text: ['Falls', ' with age'], at: 'vLeft', cls: 'cyn', alpha: S => prog(S.atlas_volcano, 0.75, 1) * (1 - anyF(S)) },
    { text: ['Rises', ' with age'], at: 'vRight', cls: 'mag', alpha: S => prog(S.atlas_volcano, 0.75, 1) * (1 - anyF(S)) },
    { text: ['Age', ` ${AGES[0]} to ${AGES[1]}`], at: 'curveAxis', cls: '', alpha: S => prog(S.atlas_curves, 0.1, 0.3) },
  ];
  EX.forEach((e, k) => {
    labels.push({ text: [exTitle(k), ` ${exWhere(k)}`], at: 'ex' + k, cls: e.perDecade >= 0 ? 'mag' : 'cyn', alpha: S => prog(S.atlas_volcano, 0.8, 1) * (1 - (exT[k] >= 0 ? focusW(S, exT[k]) : 0)) });
    // (beside a plot the section sits at the right: the shorter wording there)
    const exA = S => (exT[k] >= 0 ? focusW(S, exT[k]) : 0) * (1 - prog(S.atlas_umap, 0, 0.3)), pl = S => sm(vcS(S) * 4);
    labels.push({ text: [exTitle(k), ` ${f1(e.from)} % → ${f1(e.to)} %`], at: 'exDom' + k, cls: 'amb', alpha: S => exA(S) * (1 - pl(S)) });
    labels.push({ text: [exTitle(k), ` ${f1(e.from)} → ${f1(e.to)} %`], at: 'exDom' + k, cls: 'amb', alpha: S => exA(S) * pl(S) * (1 - sm(c01(S.atlas_curves * 4))) });   // (the curves' lane says it there)
  });
  LANES.forEach((l, j) => { const la = S => prog(S.atlas_curves, 0.55 + 0.05 * j, 0.85 + 0.03 * j), cls = l.ex === undefined ? 'mag' : '';
    labels.push({ text: [l.name, l.rest], at: 'curve' + j, cls, alpha: S => la(S) * (1 - cur.fmax) });
    labels.push({ text: [l.name, ''], at: 'curveTag' + j, cls, alpha: S => la(S) * cur.fmax }); });   // (beside a section: the name alone, a row apart)
  labels.push({ text: [String(AGES[0]), ' years'], at: 'age20', cls: '', alpha: S => (cur.fi >= 0 ? cur.gauge : 0) * (1 - vcS(S)) });
  labels.push({ text: [String(AGES[1]), ' years'], at: 'age70', cls: '', alpha: S => (cur.fi >= 0 ? cur.gauge : 0) * (1 - vcS(S)) });

  const cam = {
    default: [0, 10, 3.4, 0, 0, -0.12], library: [0, 10, 3.4, 0, 0, -0.12],   // (a little from above: the rack's shelves show)
    atlas: [0, 3, 3.2, 0, 0, 0.14],
    umap: [24, 14, 3.3, 0, 0.05, 0.08], focus: [-26, 16, 1.95, 0, 0.0, 0.72],   // (the focused section from a little left and above: its relief shows)
    volcano: [-6, 9, 3.1, 0.24, 0.02, 0.1],
    curves: [-20, 14, 3.4, 0.33, -0.04, 0.08], age: [0, 6, 3.4, 0.2, 0.02, 0.3],
    slides: [-8, 6, 0.75, -0.1, 0.22, -0.49],   // close to the wall: single slides (the library's own view is the whole wall)
    shelf: [-32, 10, 0.3, -0.12, 0.1, -0.47],   // a slant along the wall, up close: the slides as glass with their tissue
  };
  const controls = [
    { key: 'view', label: 'View', options: [['library', 'Library'], ['atlas', 'Atlas'], ['tiles', 'Tiles'], ['age', 'Age'], ['pathology', 'Pathology']] },
    { key: 'age', label: 'Age', options: [['20', `${AGES[0]} years`], ['70', `${AGES[1]} years`]] },
  ];
  function explore(c) {
    const v = c.view || 'library';
    return { atlas_lib: v === 'library' ? 1 : 0, atlas_map: v === 'library' ? 0 : 1, atlas_umap: v === 'tiles' ? 1 : 0, atlas_volcano: v === 'age' ? 1 : 0,
      atlas_curves: v === 'pathology' ? 1 : 0, atlas_age: c.age === '70' ? 1 : 0 };
  }

  // what a ray points at: a section (the atlas or a focused one) or a tissue's column of slides
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray();
  function pick(raycaster) {
    set.group.updateMatrixWorld();
    _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    const o = _ray.origin, d = _ray.direction;
    let best = -1, bt = Infinity;
    if (cur.um < 0.5) for (let i = 0; i < NT; i++) {
      if (cur.al[i] < 0.25) continue;
      const p = cur.P[i], n = [Math.sin(cur.yaw[i]), 0, Math.cos(cur.yaw[i])], dn = d.x * n[0] + d.z * n[2];
      if (Math.abs(dn) < 1e-4) continue;
      const tt = ((p[0] - o.x) * n[0] + (p[2] - o.z) * n[2]) / dn; if (tt <= 0 || tt >= bt) continue;
      const hx = o.x + d.x * tt - p[0], hy = o.y + d.y * tt - p[1], hz = o.z + d.z * tt - p[2];
      if (Math.hypot(hx, hy, hz) < cur.s[i] * 1.12) { bt = tt; best = i; }
    }
    if (best < 0 && cur.lib > 0.5 && cur.map < 0.3 && cur.vc < 0.3) {
      const a = d.x * d.x + d.z * d.z, b = 2 * (o.x * d.x + (o.z - WC) * d.z), cc = o.x * o.x + (o.z - WC) ** 2 - WR * WR, disc = b * b - 4 * a * cc;
      if (disc > 0 && a > 1e-6) for (const tt of [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)]) {
        if (tt <= 0) continue; const x = o.x + d.x * tt, y = o.y + d.y * tt, z = o.z + d.z * tt, th = Math.atan2(x, WC - z);
        if (Math.abs(th) > TH || Math.abs(y) > WH / 2) continue;
        const u = (th / TH / 2 + 0.5) * U; for (let i = 0; i < NT; i++) if (u >= WST[i] - GAP / 2 && u <= WST[i] + WCOLS[i] + GAP / 2) { best = i; break; }
        break;
      }
    }
    return best;
  }
  const API = {
    tissues: NAMES, short: SHORT, organs: ORGAN, examples: exT, pick, domainColour,
    domains: i => (REC[i] || []).map((d, k) => { const a = shares(REC[i], 0), b = shares(REC[i], 1); return { name: d.name, at20: +a[k].toFixed(1), at70: +b[k].toFixed(1), colour: domainColour(d.name) }; }),
    tissuesOf: organ => ORGAN.map((o, i) => (o.toLowerCase() === String(organ).toLowerCase() ? i : -1)).filter(i => i >= 0),
    volcanoFromFigure: volFromFig, slides: NSL.slice(), tiles: NTILE,
    // the morph into the network: its layout from the engine (the hier set's api().layout()); atlas_net leads the
    // network's growth by netLead; netMap: each domain name of the atlas -> the node it ends at
    useNetwork, netLead: NET0, netMap: () => (MAP ? Object.fromEntries(Object.entries(MAP).map(([k, v]) => [k, v.as])) : null),
  };

  return Object.assign(set, {
    params: { atlas_a: 1, atlas_lib: 1, atlas_map: 0, atlas_umap: 0, atlas_focus: 0, atlas_age: 0, atlas_volcano: 0, atlas_curves: 0, atlas_net: 0 },
    update, anchors, labels, cam, controls, explore, api() { return API; },
    // (the organ models: built at once by the harness and the sweeps)
    finish() { if (O3) O3.step(Infinity); buildOrgans(); },
  });
};

// The hier set of the microanatomy story: organ architecture as a network of four levels (organs, tissues, tissue
// types, domains: MICRO_DATA.graph, Iva Buljan's network, the talk's Figure 5a in 3D) and one organ's network of
// contacts between its domains, changing with age (the preprint's findings; by how much from the talk's Figure 5e-g,
// read into MICRO_DATA.figures, where present). The levels are stacked rings, wide at the top (organs), narrow at the tissue types and wide again
// at the domains, so the tissue types sit at the waist of an hourglass; links hang between the rings as soft threads.
// Everything follows the params; only the switch from one focused node or organ to the next eases in its own time
// (a jump to another index crossfades for 0.3 s; a seek or the first frame shows the new one at once).
// The look matches the other stories' networks: lit nodes with soft halos, links as glowing tubes with a colour
// gradient and a light running along them, each level a glowing plate's rim; the organs are small 3D models
// (ORGAN3D, sets/organs.js), built between frames while the set is hidden, spheres until they are ready.
SETS.hier = function (K) {
  const { THREE, clamp, lerp, prog, smooth, v3, rgb } = K;
  const set = K.newSet('hier');
  const PI = Math.PI, TAU = 2 * PI;
  const D = MICRO_DATA, G = D.graph, NN = G.nodes.length;
  const LVN = D.levels || ['organ', 'tissue', 'tissue type', 'domain'];
  const NAME = G.nodes.map(n => n[0]), LEV = G.nodes.map(n => n[1]), AB = G.nodes.map(n => +n[2] || 0);
  const LCOL = ['#1f8a4c', '#7ccf7e', '#ef8f7a', '#5aa9ff'].map(rgb);   // organs, tissues, tissue types, domains (Figure 5)
  const ids = [...Array(NN).keys()], byLev = [0, 1, 2, 3].map(L => ids.filter(i => LEV[i] === L));
  const find = s => { const q = String(s || '').trim().toLowerCase(); return NAME.findIndex(n => n.toLowerCase() === q); };
  const short = s => String(s).replace(/\s*\(.*\)\s*$/, '');

  // ---------------------------------------------------------------- the graph: links from the upper level to the lower
  // (the graph's five tissue type-tissue type links are loops of a type to itself: left out)
  const EU = [];
  {
    const seen = new Set();
    for (const [a, b] of G.edges) {
      if (a === b || LEV[a] === LEV[b]) continue;
      const u = LEV[a] < LEV[b] ? a : b, v = u === a ? b : a;
      if (!seen.has(u * NN + v)) { seen.add(u * NN + v); EU.push([u, v]); }
    }
  }
  const NE = EU.length, UP = ids.map(() => []), DN = ids.map(() => []);
  EU.forEach(([u, v]) => { DN[u].push(v); UP[v].push(u); });
  const DEG = ids.map(i => UP[i].length + DN[i].length);
  // the organs a tissue type is found in (directly or through one of the organ's tissues)
  const ORGS = ids.map(i => (LEV[i] !== 2 ? [] : [...new Set(UP[i].flatMap(u => (LEV[u] === 1 ? UP[u] : [u])))].filter(o => LEV[o] === 0)));
  const CONN = (j => (j >= 0 ? j : byLev[2].reduce((m, t) => (ORGS[t].length > ORGS[m].length ? t : m), byLev[2][0])))(find('connective tissue'));
  // the organs a domain is found in: the graph does not say (domains hang only from tissue types), the talk's atlas of
  // segmentation maps does (MICRO_DATA.figures.atlas: one map per organ, its domains named), where it names the domain
  const OAL = { aorta: 'artery', 'artery coronary': 'artery', 'tibial nerve': 'nerve', 'skeletal muscle': 'muscle', ectocervix: 'cervix',
    cerebellum: 'brain', 'brain cortex': 'brain', 'kidney medulla': 'kidney', 'adipose - visceral': 'adipose' };
  const DAL = { 'adipose tissue': 'fat', "peyer's pathches": 'lymphoid peyer patches', 'adventita subserosa': 'adventitia subserosa',
    medula: 'medulla', 'medula kidney tubules': 'medulla kidney tubules', 'blood vessels /hemorrhage': 'blood vessels and hemorrhage' };   // (as the figure spells them)
  const FOUND = ids.map(() => []);
  for (const m of (D.figures && Array.isArray(D.figures.atlas) ? D.figures.atlas : [])) {
    const q = String((m && m.tissue) || '').trim().toLowerCase(), on = OAL[q] || q;
    const o = byLev[0].find(i => NAME[i].toLowerCase() === on);
    if (o === undefined) continue;
    for (const d of (m.domains || [])) {
      const q = String((d && d.name) || '').trim().toLowerCase(), i = find(DAL[q] || q);
      if (i >= 0 && LEV[i] === 3 && !FOUND[i].includes(o)) FOUND[i].push(o);
    }
  }

  // ---------------------------------------------------------------- layout: four rings, ordered so threads hang short
  const ANG = new Float64Array(NN), RAW = new Float64Array(NN);
  const norm = a => ((a % TAU) + TAU) % TAU;
  const cmean = list => { let x = 0, z = 0; for (const [a, w] of list) { x += Math.cos(a) * w; z += Math.sin(a) * w; } return norm(Math.atan2(z, x)); };
  // sort by the wished-for angle, then space evenly round the ring, turned to fit the wishes best
  const spread = list => {
    const s = list.slice().sort((a, b) => RAW[a] - RAW[b]), n = s.length;
    let x = 0, z = 0;
    s.forEach((i, k) => { const d = RAW[i] - TAU * k / n; x += Math.cos(d); z += Math.sin(d); });
    const off = Math.atan2(z, x);
    s.forEach((i, k) => { ANG[i] = norm(TAU * k / n + off); });
  };
  {
    const T = byLev[2], sh = (a, b) => UP[a].filter(u => UP[b].includes(u)).length;
    const order = [CONN];   // tissue types: each next to the one it shares most organs and tissues with
    while (order.length < T.length) {
      const last = order[order.length - 1];
      let best = -1, bs = -1;
      for (const t of T) if (!order.includes(t)) { const s = sh(last, t) + 0.01 * UP[t].length; if (s > bs) { bs = s; best = t; } }
      order.push(best);
    }
    order.forEach((t, k) => { ANG[t] = TAU * k / T.length; });
    const tw = t => 1 / Math.sqrt(Math.max(1, UP[t].length));   // a rare tissue type pulls harder than connective tissue
    for (let it = 0; it < 4; it++) {
      for (const i of byLev[1]) RAW[i] = cmean(DN[i].map(t => [ANG[t], tw(t)]));
      for (const i of byLev[0]) RAW[i] = cmean(DN[i].map(j => [LEV[j] === 1 ? RAW[j] : ANG[j], LEV[j] === 1 ? 1 : tw(j)]));
      spread(byLev[0]);
      for (const i of byLev[1]) RAW[i] = cmean([[ANG[UP[i][0]], 3], ...DN[i].map(t => [ANG[t], tw(t) * 0.5])]);
      spread(byLev[1]);
      if (it < 3) { for (const t of T) RAW[t] = cmean(UP[t].map(u => [ANG[u], 1])); spread(T); }
    }
    // domains: in arcs under their tissue type
    const dm = byLev[3].slice().sort((a, b) => NAME[a].localeCompare(NAME[b]));
    for (const i of dm) RAW[i] = UP[i].length ? ANG[UP[i][0]] : 0;
    spread(dm);
    // turn the whole so connective tissue faces you
    const rot = -ANG[CONN];
    for (const i of ids) ANG[i] = norm(ANG[i] + rot);
  }
  const RING = [[0.9, 0.66], [0.7, 0.28], [0.4, -0.1], [0.9, -0.62]];   // [radius, height] per level
  const GS = [0, 0.22, 0.44, 0.66];   // when each level starts to grow (hier_grow)
  const POS = ids.map(i => { const [R, y] = RING[LEV[i]], a = ANG[i]; return [R * Math.sin(a), y, R * Math.cos(a)]; });
  const RAD = ids.map(i => (LEV[i] === 3 ? 0.013 + 0.0026 * Math.sqrt(AB[i]) : LEV[i] === 2 ? 0.028 + 0.0075 * Math.sqrt(DEG[i]) : 0.024 + 0.007 * Math.sqrt(DEG[i])));
  const SW = ids.map(i => 0.08 * norm(ANG[i] + PI) / TAU);   // each ring grows round from the back
  // an organ's model is larger than a sphere node (its shape must read), the others as before
  const ORAD = ids.map(i => (LEV[i] === 0 ? 0.062 + 0.005 * Math.sqrt(DEG[i]) : RAD[i]));

  // ---------------------------------------------------------------- the domain-contact networks
  // Organs with contact findings. Their domains (names as in the graph; calcified plaque is not a domain of the graph)
  // and contacts are illustrative: layers that touch, with a share of contacts (0..1) for the band's width. The
  // findings (MICRO_DATA.findings.interactions) say which contacts change with age and which way; values read off the
  // talk's figures (MICRO_DATA.figures.interactions) set by how much, where present. axis: the surface layer and the
  // deepest, drawn top and bottom.
  const CO = [
    { name: 'Colon', organ: 'Colon', tissue: 'Colon - Transverse', re: /colon/i, axis: [0, 4],
      dom: ['mucosa epithelium', 'mucosa lamina propria', 'submucosa', 'muscularis', 'adventitia subserosa', 'lymphoid tissue', 'blood vessels'],
      con: [[0, 1, 0.85], [1, 2, 0.55], [2, 3, 0.5], [3, 4, 0.6], [1, 5, 0.22], [2, 5, 0.3], [2, 6, 0.3], [4, 6, 0.2]] },
    { name: 'Skin', organ: 'Skin', tissue: 'Skin - Sun Exposed (Lower leg)', re: /skin/i, axis: [0, 4],
      dom: ['epidermis', 'papillary dermis', 'reticular dermis', 'subdermis', 'fat', 'blood vessels'],
      con: [[0, 1, 0.85], [1, 2, 0.7], [2, 3, 0.5], [3, 4, 0.55], [1, 5, 0.2], [2, 5, 0.3], [3, 5, 0.15]] },
    { name: 'Ovary', organ: 'Ovary', re: /ovar/i, axis: [0, 3],
      dom: ['ovarian cortex', 'ovarian stroma', 'corpus albicans', 'fibromuscular tissue', 'mucosa', 'blood vessels'],
      con: [[0, 1, 0.8], [1, 2, 0.35], [1, 3, 0.35], [3, 4, 0.25], [1, 5, 0.35], [0, 5, 0.12], [3, 5, 0.15]] },
    { name: 'Fallopian tube', organ: 'Fallopian Tube', re: /fallopian/i, axis: [0, 2],
      dom: ['mucosa', 'muscularis', 'fibromuscular tissue', 'blood vessels', 'fat'],
      con: [[0, 1, 0.7], [1, 2, 0.6], [0, 2, 0.22], [2, 3, 0.35], [2, 4, 0.35], [1, 3, 0.2]] },
    { name: 'Uterus', organ: 'Uterus', re: /uter/i, axis: [0, 1], shift: ['endometrium', 'connective tissue and adipose tissue'],
      dom: ['endometrium', 'myometrium', 'connective tissue and adipose tissue', 'vessels and connective tissue', 'blood vessels'],
      con: [[0, 1, 0.5], [1, 2, 0.45], [1, 3, 0.4], [0, 2, 0.15], [3, 4, 0.35], [1, 4, 0.2]] },
    { name: 'Coronary artery', organ: 'Artery', tissue: 'Artery - Coronary', re: /coronary/i, axis: [0, 3],
      dom: ['tunica intima', 'tunica media', 'tunica adventitia', 'fat', 'myocardium', 'calcified plaque'],
      con: [[0, 1, 0.85], [1, 2, 0.75], [2, 3, 0.55], [2, 4, 0.2], [3, 4, 0.15], [5, 0, 0.06], [5, 1, 0.05]] },
  ].map(o => Object.assign(o, { dom: o.dom.slice(), con: o.con.map(c => c.slice()), ch: [] }));
  const NCO = CO.length;
  // a change: [a, b, dir (1 more contacts with age, -1 fewer), d (share gained by age 70), from figures?]
  const ALIAS = { 'adipose tissue': 'fat' };   // the figures' name for the fat of a vessel's wall; the graph's domain is 'fat'
  function addChange(co, a, b, dir, d, fig, base) {
    const di = n => {
      const q = String(n).trim().toLowerCase(), nm = ALIAS[q] || q;
      let j = co.dom.findIndex(x => x.toLowerCase() === nm);
      if (j < 0 && co.dom.length < 8 && find(nm) >= 0 && LEV[find(nm)] === 3) { co.dom.push(NAME[find(nm)]); j = co.dom.length - 1; }
      return j;
    };
    const ia = di(a), ib = di(b);
    if (ia < 0 || ib < 0 || ia === ib || !dir) return;
    let c = co.con.find(x => (x[0] === ia && x[1] === ib) || (x[0] === ib && x[1] === ia));
    if (!c) { c = [ia, ib, dir > 0 ? 0.08 : 0.35]; co.con.push(c); }
    if (base !== null && base !== undefined) c[2] = clamp(base, 0.03, 0.98);
    const old = co.ch.find(x => x.c === c);
    if (old && !fig) return;
    const ch = old || { c, a: co.dom[ia], b: co.dom[ib] };
    Object.assign(ch, { dir: Math.sign(dir), d: d !== null ? d : Math.sign(dir) * 0.26, fig: !!fig });
    if (!old) co.ch.push(ch);
  }
  for (const f of (D.findings && D.findings.interactions) || []) {
    const co = CO.find(o => o.organ.toLowerCase() === String(f.organ || '').toLowerCase());
    if (!co) continue;
    let a = f.a, b = f.b, dir = f.dir;
    if ((!a || !b) && co.shift && /connective/i.test(f.note || '')) { [a, b] = co.shift; dir = 1; }   // "the endometrium turns towards connective tissue"
    if (a && b) addChange(co, a, b, dir, null, false, null);
  }
  // readings of the talk's figures (MICRO_DATA.figures), where present: the changes in border contact per decade
  // (Figure 5e: [pair 'a-b', tissue, change per decade in percentage points, -log10 p]; a pair read both ways is
  // averaged, as a band has no direction; under 1 point per decade is left out) and the trajectories of contacts over
  // age (Figure 5f, g: 'a-b, tissue' with points [age, % of touching points], which give the shares at 20 and 70)
  {
    const F = D.figures || {}, acc = new Map();
    const key = (co, a, b) => { const x = [a, b].map(n => (ALIAS[n.trim().toLowerCase()] || n.trim().toLowerCase())).sort(); return CO.indexOf(co) + '|' + x.join('|'); };
    const entry = (org, pair) => {
      const co = CO.find(o => o.re.test(String(org || ''))), ab = String(pair || '').split('-');
      if (!co || ab.length !== 2) return null;
      const k = key(co, ab[0], ab[1]);
      if (!acc.has(k)) acc.set(k, { co, a: ab[0].trim(), b: ab[1].trim(), pd: [], tr: null });
      return acc.get(k);
    };
    const rows = ((F.borderContactAndMotifs || {}).borderContactChangePerDecade || {}).rows || [];
    for (const r of rows) if (Array.isArray(r) && typeof r[2] === 'number') { const e = entry(r[1], r[0]); if (e) e.pd.push(r[2]); }
    for (const tr of Array.isArray(F.trajectories) ? F.trajectories : []) {
      const m = /^(.*?),\s*(.*)$/.exec(String((tr && tr.title) || '')), pts = tr && Array.isArray(tr.points) ? tr.points : [];
      if (!m || pts.length < 2) continue;
      const e = entry(tr.tissue || m[2], m[1]);
      const at = age => (pts.find(p => p[0] === age) || (age < 45 ? pts[0] : pts[pts.length - 1]))[1];
      if (e) e.tr = [at(20), at(70)];
    }
    for (const e of acc.values()) {
      if (e.tr) addChange(e.co, e.a, e.b, e.tr[1] - e.tr[0], (e.tr[1] - e.tr[0]) / 100, true, e.tr[0] / 100);
      else if (e.pd.length) {
        const pd = e.pd.reduce((s, x) => s + x, 0) / e.pd.length;
        if (Math.abs(pd) >= 1) addChange(e.co, e.a, e.b, pd, pd * 5 / 100, true, null);
      }
    }
  }
  // the preprint's examples of change with age, for the nodes' sizes (corpus albicans, the gut's submucosa ...)
  const exFor = (co, name) => (D.examples || []).find(e => e.domain.toLowerCase() === name.toLowerCase()
    && (co.re.test(e.tissue) || (co.organ === 'Colon' && /gastro|intestin|colon|gut/i.test(e.tissue))));
  // domain colours: the atlas set's (the engine may hand them over as K.domainColour, or later through api().useColours),
  // else the talk's colours of tissue types (Figure 5b), a little varied per domain
  const TYPEC = { 'adipose tissue': '#9fd3f2', 'cardiac muscle': '#3f86d6', 'connective tissue': '#b5dc8f', 'glandular tissue': '#45b05e',
    'lining epithelium': '#f4a3ab', 'lymphoid structure': '#e2363a', 'neuronal tissue': '#f6c27a', 'skeletal muscle': '#d77a3c',
    'smooth muscle': '#f2861f', 'vascular tissue': '#c9a9e6' };
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  function ownColour(name) {
    const i = find(name), t = i >= 0 && UP[i].length ? NAME[UP[i][0]] : '';
    if (!TYPEC[t]) return rgb('#e9e1cf');   // calcified plaque: bone white
    const c = rgb(TYPEC[t]), k = 0.88 + 0.24 * (((hash(name) % 100) + 100) % 100) / 100;
    return c.map(x => clamp(x * k, 0, 1));
  }
  let domainColour = typeof K.domainColour === 'function' ? n => rgb(K.domainColour(n)) : ownColour;
  // a small force layout per organ, in the plane facing you, the surface layer on top, a little depth for parallax; it
  // stands left of the middle, so a column of notes on its right (the changes, the core, the age) has room
  const CEN = [0, 0.02, 0.45], CR = 0.5, GAP = 0.085, AGEY = CEN[1] - CR * 0.85 - 0.08;   // (the age under the lowest node's row)
  for (const [k, co] of CO.entries()) {
    const n = co.dom.length, r = K.rng(31 + 7 * k);
    let P = co.dom.map((_, i) => [Math.cos(TAU * i / n) * 0.5, Math.sin(TAU * i / n) * 0.5]);
    for (let it = 0; it < 500; it++) {
      const F = P.map(() => [0, 0]), st = 0.06 * (1 - it / 560);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], d2 = Math.max(1e-4, dx * dx + dy * dy), f = 0.08 / d2, d = Math.sqrt(d2);
        F[i][0] -= f * dx / d; F[i][1] -= f * dy / d; F[j][0] += f * dx / d; F[j][1] += f * dy / d;
      }
      for (const [a, b, w] of co.con) {
        const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], d = Math.max(1e-3, Math.hypot(dx, dy)), f = 0.6 * (d - (0.66 - 0.3 * w));
        F[a][0] += f * dx / d; F[a][1] += f * dy / d; F[b][0] -= f * dx / d; F[b][1] -= f * dy / d;
      }
      P = P.map((p, i) => [p[0] + clamp(F[i][0] - 0.05 * p[0], -1, 1) * st, p[1] + clamp(F[i][1] - 0.05 * p[1], -1, 1) * st]);
    }
    // turn so the surface layer is on top and the deepest at the bottom; centre and size
    const [s0, s1] = co.axis, ax = [P[s0][0] - P[s1][0], P[s0][1] - P[s1][1]], th = PI / 2 - Math.atan2(ax[1], ax[0]);
    P = P.map(([x, y]) => [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)]);
    // a layered organ lays out as a tall chain: widen it so the side domains stand clear
    { const w = Math.max(...P.map(p => p[0])) - Math.min(...P.map(p => p[0])), h = Math.max(...P.map(p => p[1])) - Math.min(...P.map(p => p[1])), k = clamp(0.8 * h / Math.max(1e-3, w), 1, 2.4);
      P = P.map(([x, y]) => [x * k, y]); }
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = Math.min(2 * CR * 0.95 / Math.max(1e-3, x1 - x0), 2 * CR * 0.85 / Math.max(1e-3, y1 - y0), 2.5);
    co.P = P.map(p => [CEN[0] + (p[0] - (x0 + x1) / 2) * sc, CEN[1] + (p[1] - (y0 + y1) / 2) * sc, CEN[2] + (r() - 0.5) * 0.22]);
    co.top = CEN[1] + (y1 - y0) / 2 * sc;
    co.gi = co.dom.map(find).map(i => (i >= 0 && LEV[i] === 3 ? i : -1));
    co.gOrgan = find(co.organ); co.gTissue = co.tissue ? find(co.tissue) : -1;
    co.col = co.dom.map(domainColour);
    co.ex = co.dom.map(nm => exFor(co, nm) || null);
    const str = co.dom.map((_, i) => co.con.reduce((s, c) => s + (c[0] === i || c[1] === i ? c[2] : 0), 0));
    co.rad = str.map(s => 0.046 + 0.026 * Math.sqrt(s / Math.max(...str)));
    // the bands: a gentle arc bowing away from the middle and towards you
    co.bands = co.con.map(c => {
      const A = co.P[c[0]], B = co.P[c[1]], M = v3.lerp(A, B, 0.5), len = v3.dist(A, B);
      let out = [M[0] - CEN[0], M[1] - CEN[1], 0];
      if (v3.len(out) < 0.05) out = [-(B[1] - A[1]), B[0] - A[0], 0];
      const C = v3.add(M, v3.add(v3.mul(v3.norm(out), 0.07 * len), [0, 0, 0.05 * len]));
      return { c, A, B, C, mid: [0, 1, 2].map(q => 0.25 * A[q] + 0.5 * C[q] + 0.25 * B[q]), ch: co.ch.find(x => x.c === c) || null };
    });
    const core = co.bands.filter(b => !b.ch).sort((x, y) => y.c[2] - x.c[2])[0] || co.bands[0];
    co.core = core.mid;
    co.change = (co.bands.find(b => b.ch) || core).mid;
    // the notes' column: right of the network, each note at its band's height, spread to stay apart (a leader line joins
    // them); the column's top row holds the note that the drawing is illustrative, its foot the age
    co.colX = Math.max(...co.P.map((p, j) => p[0] + co.rad[j])) + 0.07;
    const hi = co.top + 0.13 - GAP, lo = AGEY + GAP, items = co.bands.filter(b => b.ch).concat(core.ch ? [] : [core]);
    items.sort((x, y) => y.mid[1] - x.mid[1]);
    let yy = hi + GAP;
    for (const b of items) { yy = Math.min(b.mid[1], hi, yy - GAP); b.lab = [co.colX, yy, CEN[2] + 0.06]; }
    const under = lo - Math.min(lo, yy);
    for (const b of items) b.lab[1] += under;
    co.items = items; co.coreBand = core;
  }
  const NCN = CO.reduce((s, o) => s + o.dom.length, 0);
  CO.reduce((o0, co) => { co.o = o0; return o0 + co.dom.length; }, 0);

  // ---------------------------------------------------------------- the network's threads (tubes, in the hierarchy's group)
  const hg = new THREE.Group();   // the four-level network: moves back and shrinks as a contact network comes forward
  set.group.add(hg);
  const TS = 18, TR = 6, EV = (TS + 1) * TR;
  const thrGeo = new THREE.BufferGeometry();
  const aH = new Float32Array(NE * EV);
  {
    const nv = NE * EV, C = new Float32Array(nv * 3), Nr = new Float32Array(nv * 3), T = new Float32Array(nv), S0 = new Float32Array(nv),
      L0 = new Float32Array(nv), L1 = new Float32Array(nv), PH = new Float32Array(nv), idx = [];
    let v = 0;
    const pt = (u, v0, w0, dA) => {
      const [RA, yA] = RING[LEV[v0]], [RB, yB] = RING[LEV[w0]], s = smooth(u), R = lerp(RA, RB, s), a = ANG[v0] + dA * s;
      return [R * Math.sin(a), lerp(yA, yB, u), R * Math.cos(a)];
    };
    EU.forEach(([a, b], e) => {
      let dA = ANG[b] - ANG[a];
      dA = dA > PI ? dA - TAU : dA < -PI ? dA + TAU : dA;
      const v0 = v, ph = K.rng(e + 5)() * TAU, st = GS[LEV[b]] - 0.06 + SW[b];
      for (let s = 0; s <= TS; s++) {
        const u = s / TS, p = pt(u, a, b, dA), q = pt(Math.min(1, u + 0.01), a, b, dA), q0 = pt(Math.max(0, u - 0.01), a, b, dA);
        const t = v3.norm(v3.sub(q, q0)), radial = v3.norm([p[0], 0, p[2]]);
        let n1 = v3.cross(t, radial); if (v3.len(n1) < 1e-4) n1 = [1, 0, 0]; n1 = v3.norm(n1);
        const n2 = v3.norm(v3.cross(t, n1));
        for (let r = 0; r < TR; r++) {
          const th = r / TR * TAU, d = v3.add(v3.mul(n1, Math.cos(th)), v3.mul(n2, Math.sin(th)));
          C.set(p, 3 * v); Nr.set(d, 3 * v); T[v] = u; S0[v] = st; L0[v] = LEV[a]; L1[v] = LEV[b]; PH[v] = ph; v++;
        }
      }
      for (let s = 0; s < TS; s++) for (let r = 0; r < TR; r++) {
        const a0 = v0 + s * TR + r, a1 = v0 + s * TR + (r + 1) % TR;
        idx.push(a0, a0 + TR, a1, a1, a0 + TR, a1 + TR);
      }
    });
    thrGeo.setAttribute('position', new THREE.BufferAttribute(C, 3));
    thrGeo.setAttribute('aNrm', new THREE.BufferAttribute(Nr, 3));
    thrGeo.setAttribute('aT', new THREE.BufferAttribute(T, 1));
    thrGeo.setAttribute('aS', new THREE.BufferAttribute(S0, 1));
    thrGeo.setAttribute('aL0', new THREE.BufferAttribute(L0, 1));
    thrGeo.setAttribute('aL1', new THREE.BufferAttribute(L1, 1));
    thrGeo.setAttribute('aPh', new THREE.BufferAttribute(PH, 1));
    thrGeo.setAttribute('aH', new THREE.BufferAttribute(aH, 1).setUsage(THREE.DynamicDrawUsage));
    thrGeo.setIndex(idx);
  }
  const thrMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uGrow: { value: 1 }, uK: { value: 1 }, uF: { value: 0 }, uLC: { value: LCOL.map(c => new THREE.Color(...c)) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aNrm; attribute float aT, aS, aL0, aL1, aPh, aH;
uniform float uGrow, uF, uK; uniform vec3 uLC[4];
varying vec3 vC, vN, vV; varying float vA, vT, vPh, vH;
void main() {
  // drawn from the upper node down to the lower one as the lower level grows; the growing end tapers
  float g = clamp((uGrow - aS) / 0.12, 0.0, 1.0), on = step(aT, g + 0.0001), tip = g > 0.999 ? 1.0 : smoothstep(g, g - 0.15, aT);
  // (thick enough to read as tubes from afar; the rest stay in view, a little dimmer, while a node is focused)
  float h = aH * uF;
  float r = 0.0095 * (1.0 + 0.4 * h) * on * mix(0.3, 1.0, tip);
  vC = mix(uLC[int(aL0 + 0.5)], uLC[int(aL1 + 0.5)], aT); vT = aT; vPh = aPh; vH = h;
  vA = on * uK * (0.6 * (1.0 - 0.45 * uF) + 0.55 * h);
  vec4 mv = modelViewMatrix * vec4(position + aNrm * r, 1.0);
  vN = normalMatrix * aNrm; vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform float uA, uTime;
varying vec3 vC, vN, vV; varying float vA, vT, vPh, vH;
void main() {
  if (vA < 0.003) discard;
  // a soft glowing tube in its levels' colours (from the upper level's to the lower one's): lit across, bright along
  // its middle, fading to its edges; a light runs down it now and then (organ to domain)
  float c = abs(dot(normalize(vN), normalize(vV)));
  float run = pow(0.5 + 0.5 * sin(vT * 7.0 - uTime * 1.4 + vPh), 12.0);
  vec3 col = mix(vC, vec3(1.0), 0.12) * (0.5 + 0.85 * c) * (0.8 + 0.9 * run) + vec3(1.0) * (0.08 * pow(c, 6.0) + 0.22 * vH * pow(c, 3.0) + 0.18 * run);
  gl_FragColor = vec4(col, vA * uA * (0.25 + 0.75 * c) * (1.0 + 0.5 * run));
}`,
  });
  set.mats.push(thrMat);
  const threads = new THREE.Mesh(thrGeo, thrMat);
  threads.frustumCulled = false; threads.renderOrder = 2;
  hg.add(threads);
  // the four levels: each a faint glowing plate whose rim is a soft bright line, drawn round as its level grows (from the
  // back); the plate's sheen fades inwards, so the stack reads as four floors in depth
  const RS = 160, ringGeo = new THREE.BufferGeometry();
  {
    const P = [], A = [], idx = [];
    for (let L = 0; L < 4; L++) {
      const [R, y] = RING[L], r0 = R - 0.16, r1 = R + 0.035, v0 = P.length / 3;
      for (let s = 0; s <= RS; s++) {
        const a = TAU * s / RS + PI, tt = GS[L] + 0.16 * s / RS;
        for (const r of [r0, r1]) { P.push(r * Math.sin(a), y, r * Math.cos(a)); A.push(L, tt, R); }
      }
      for (let s = 0; s < RS; s++) { const a = v0 + 2 * s; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    }
    ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    ringGeo.setAttribute('aL', new THREE.Float32BufferAttribute(A, 3));
    ringGeo.setIndex(idx);
  }
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uReveal: { value: 1 }, uK: { value: 1 }, uLC: { value: LCOL.map(c => new THREE.Color(...c)) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, extensions: { derivatives: true },
    vertexShader: `
attribute vec3 aL;
varying vec3 vP; varying float vL, vT, vR;
void main() { vP = position; vL = aL.x; vT = aL.y; vR = aL.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
uniform float uA, uReveal, uK; uniform vec3 uLC[4];
varying vec3 vP; varying float vL, vT, vR;
void main() {
  if (vT > uReveal + 0.0001) discard;
  float r = length(vP.xz), d = r - vR, fw = max(fwidth(r), 1e-5);
  float line = 1.0 - smoothstep(0.6, 1.8, abs(d) / fw);
  float glow = exp(-pow(d / 0.012, 2.0)), sheen = smoothstep(-0.16, 0.0, d) * step(d, 0.0);
  vec3 c = mix(uLC[int(vL + 0.5)], vec3(1.0), 0.3);
  gl_FragColor = vec4(c, (0.55 * line + 0.3 * glow + 0.05 * sheen * sheen) * uK * uA);
}`,
  });
  set.mats.push(ringMat);
  const rings = new THREE.Mesh(ringGeo, ringMat);
  rings.frustumCulled = false; rings.renderOrder = 1;
  hg.add(rings);

  // ---------------------------------------------------------------- nodes: lit spheres and additive halos
  // one instance per network node (0..NN-1) and per contact-network node (NN..NN+NCN-1)
  const NI = NN + NCN;
  const sphGeo = new THREE.SphereGeometry(1, 14, 10);
  const nCol = new THREE.InstancedBufferAttribute(new Float32Array(NI * 3), 3), nA = new THREE.InstancedBufferAttribute(new Float32Array(NI), 1);
  nCol.setUsage(THREE.DynamicDrawUsage); nA.setUsage(THREE.DynamicDrawUsage);
  sphGeo.setAttribute('aCol', nCol); sphGeo.setAttribute('aA', nA);
  const nodeMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA }, transparent: true, depthWrite: true,
    vertexShader: `
attribute vec3 aCol; attribute float aA;
varying vec3 vC, vN, vV; varying float vA;
void main() {
  vC = aCol; vA = aA;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (aA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vC, vN, vV; varying float vA;
void main() {
  float a = vA * uA;
  if (a < 0.02) discard;
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.45, 0.6, 0.65));
  float df = max(dot(n, l), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 2.2), sp = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);
  vec3 col = vC * (0.45 + 0.75 * df) + mix(vC, vec3(1.0), 0.5) * fr * 0.6 + vec3(sp * 0.3);
  gl_FragColor = vec4(col, a);
}`,
  });
  set.mats.push(nodeMat);
  const nodes = new THREE.InstancedMesh(sphGeo, nodeMat, NI);
  nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  nodes.frustumCulled = false; nodes.renderOrder = 3;
  nodes.raycast = () => {};   // (pick() knows the nodes)
  set.group.add(nodes);
  const IM = nodes.instanceMatrix.array;
  const haloGeo = new THREE.InstancedBufferGeometry();
  haloGeo.setIndex([0, 1, 2, 0, 2, 3]);
  haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  const HA = {};
  for (const [name, k] of [['aP', 3], ['aCol', 3], ['aSize', 1], ['aA', 1], ['aRing', 1]]) {
    HA[name] = new THREE.InstancedBufferAttribute(new Float32Array(NI * k), k);
    HA[name].setUsage(THREE.DynamicDrawUsage);
    haloGeo.setAttribute(name, HA[name]);
  }
  haloGeo.instanceCount = NI;
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aP, aCol; attribute float aSize, aA, aRing;
uniform float uA;
varying vec3 vC; varying float vA, vR; varying vec2 vQ;
void main() {
  vC = aCol; vA = aA * uA; vR = aRing; vQ = position.xy;
  vec4 mv = modelViewMatrix * vec4(aP, 1.0);
  mv.xy += position.xy * 3.2 * aSize * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uTime;
varying vec3 vC; varying float vA, vR; varying vec2 vQ;
void main() {
  float d = length(vQ);
  if (d > 1.0) discard;
  float rr = d * 3.2;   // in node radii
  float glow = exp(-max(rr - 0.95, 0.0) * 1.6) * smoothstep(1.0, 0.6, d);
  float ring = vR * smoothstep(0.14, 0.0, abs(rr - 1.75 - 0.12 * sin(uTime * 3.0)));
  vec3 col = mix(vC, vec3(1.0), 0.15) * glow * 0.75 + mix(vC, vec3(1.0), 0.45) * ring;
  gl_FragColor = vec4(col, vA * max(glow * 0.6, ring));
}`,
  });
  set.mats.push(haloMat);
  const halos = new THREE.Mesh(haloGeo, haloMat);
  halos.frustumCulled = false; halos.renderOrder = 4;
  halos.raycast = () => {};
  set.group.add(halos);

  // ---------------------------------------------------------------- the organs: small 3D models (ORGAN3D)
  // built between frames while the set is hidden (idle), or a slice a frame while it shows; until they are all ready the
  // organs are spheres like the other nodes. Each turns slowly, so its shape reads from any side
  const ORGN = byLev[0], OSL = ids.map(() => -1);
  ORGN.forEach((i, k) => { OSL[i] = k; });
  const O3 = typeof ORGAN3D !== 'undefined' ? ORGAN3D : null;
  const oP = ORGN.map(() => new THREE.Vector4()), oQ = ORGN.map(() => new THREE.Vector4()), oPh = ORGN.map((_, k) => K.rng(80 + k)() * TAU);
  let orgMesh = null;
  function buildOrgans() {
    if (orgMesh || !O3 || !O3.ready()) return;
    const M = O3.merged(ORGN.map(i => O3.idOf(NAME[i]) || 'stomach')), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(M.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(M.nrm, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(M.col, 3)); g.setAttribute('aSlot', new THREE.BufferAttribute(M.slot, 1));
    g.setIndex(new THREE.BufferAttribute(M.idx, 1));
    const sh = O3.shader(ORGN.length);
    const m = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uP: { value: oP }, uQ: { value: oQ }, uTint: { value: new THREE.Color(...LCOL[0]) } },
      vertexShader: sh.vertex, fragmentShader: sh.fragment, transparent: true });
    set.mats.push(m);
    orgMesh = new THREE.Mesh(g, m);
    orgMesh.frustumCulled = false; orgMesh.renderOrder = 3; orgMesh.raycast = () => {};
    set.group.add(orgMesh);
  }
  const orgStep = ms => { if (!orgMesh && O3) { if (!O3.driven) O3.step(ms); buildOrgans(); } };   // (the engine steps them itself)

  // ---------------------------------------------------------------- the contact bands (tubes; width and colour per frame)
  const BS = 22, BR = 6, NBD = CO.reduce((s, o) => s + o.bands.length, 0);
  const bandGeo = new THREE.BufferGeometry();
  {
    const nv = NBD * (BS + 1) * BR, C = new Float32Array(nv * 3), Nr = new Float32Array(nv * 3), T = new Float32Array(nv), Bi = new Float32Array(nv), idx = [];
    let v = 0, bi = 0;
    for (const co of CO) for (const b of co.bands) {
      const v0 = v, { A, B, C: Cp } = b;
      for (let s = 0; s <= BS; s++) {
        const u = s / BS, w = 1 - u, p = [0, 1, 2].map(i => w * w * A[i] + 2 * u * w * Cp[i] + u * u * B[i]);
        const t = v3.norm([0, 1, 2].map(i => 2 * w * (Cp[i] - A[i]) + 2 * u * (B[i] - Cp[i])));
        let n1 = v3.cross(t, [0, 0, 1]); if (v3.len(n1) < 1e-4) n1 = [1, 0, 0]; n1 = v3.norm(n1);
        const n2 = v3.norm(v3.cross(t, n1));
        for (let q = 0; q < BR; q++) {
          const th = q / BR * TAU, d = v3.add(v3.mul(n1, Math.cos(th)), v3.mul(n2, Math.sin(th)));
          C.set(p, 3 * v); Nr.set(d, 3 * v); T[v] = u; Bi[v] = bi; v++;
        }
      }
      for (let s = 0; s < BS; s++) for (let q = 0; q < BR; q++) {
        const a0 = v0 + s * BR + q, a1 = v0 + s * BR + (q + 1) % BR;
        idx.push(a0, a0 + BR, a1, a1, a0 + BR, a1 + BR);
      }
      b.bi = bi++;
    }
    bandGeo.setAttribute('position', new THREE.BufferAttribute(C, 3));
    bandGeo.setAttribute('aNrm', new THREE.BufferAttribute(Nr, 3));
    bandGeo.setAttribute('aT', new THREE.BufferAttribute(T, 1));
    bandGeo.setAttribute('aB', new THREE.BufferAttribute(Bi, 1));
    bandGeo.setAttribute('aCA', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    bandGeo.setAttribute('aCB', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    bandGeo.setIndex(idx);
  }
  // each band's two ends in their domains' colours (a gradient along it), again when the colours change
  function bandCols() {
    const A = bandGeo.attributes.aCA.array, B = bandGeo.attributes.aCB.array, per = (BS + 1) * BR;
    let bi = 0;
    for (const co of CO) for (const b of co.bands) {
      for (let v = bi * per; v < (bi + 1) * per; v++) { A.set(co.col[b.c[0]], 3 * v); B.set(co.col[b.c[1]], 3 * v); }
      bi++;
    }
    bandGeo.attributes.aCA.needsUpdate = bandGeo.attributes.aCB.needsUpdate = true;
  }
  bandCols();
  const UB = Array.from({ length: NBD }, () => new THREE.Vector4());   // x radius, y warmth (-1 cool .. 1 warm), z alpha, w reveal
  const bandMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uB: { value: UB }, uCore: { value: new THREE.Color(...rgb('#eadff5')) },
      uWarm: { value: new THREE.Color(...rgb('#ffb43b')) }, uCool: { value: new THREE.Color(...rgb('#46d9ff')) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aNrm, aCA, aCB; attribute float aT, aB;
uniform vec4 uB[${NBD}];
varying vec3 vN, vW, vG; varying float vT, vY, vZ;
void main() {
  vG = mix(aCA, aCB, smoothstep(0.1, 0.9, aT));
  vec4 B = uB[int(aB + 0.5)];
  // drawn from both ends to the middle
  float m = min(aT, 1.0 - aT) * 2.0, on = step(m, B.w + 0.0001);
  float r = B.x * on;
  vT = aT; vY = B.y; vZ = B.z * on;
  vN = normalize(mat3(modelMatrix) * aNrm);
  vec4 wp = modelMatrix * vec4(position + aNrm * r, 1.0); vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `
uniform float uA, uTime; uniform vec3 uCore, uWarm, uCool;
varying vec3 vN, vW, vG; varying float vT, vY, vZ;
void main() {
  if (vZ < 0.003) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float c = abs(dot(n, v));
  // the core: pale, tinted towards the two domains it joins; a changing contact: warm (more) or cool (fewer)
  vec3 base = mix(mix(uCore, vG, 0.45), vY > 0.0 ? uWarm : uCool, min(1.0, abs(vY)));
  float flow = 0.8 + 0.45 * pow(0.5 + 0.5 * sin(vT * 14.0 - uTime * 2.2), 3.0);   // contacts as a quiet flow along the band
  vec3 col = base * (0.4 + 0.8 * c) * flow + vec3(1.0) * 0.18 * pow(c, 8.0);
  gl_FragColor = vec4(col, (0.2 + 0.75 * c * c) * vZ * uA);
}`,
  });
  set.mats.push(bandMat);
  const bands = new THREE.Mesh(bandGeo, bandMat);
  bands.frustumCulled = false; bands.renderOrder = 2;
  set.group.add(bands);
  // leader lines from a band to its note in the column
  const NLD = CO.reduce((s, o) => s + o.items.length, 0), ldGeo = K.linesGeo(NLD);
  {
    const P = ldGeo.attributes.position.array, Cc = ldGeo.attributes.aCol.array;
    let s = 0;
    for (const co of CO) for (const b of co.items) {
      const col = rgb(!b.ch ? '#b9add6' : b.ch.dir > 0 ? '#ffb43b' : '#46d9ff'), e = [co.colX - 0.012, b.lab[1], b.lab[2]];
      P.set(b.mid, 6 * s); P.set(e, 6 * s + 3); Cc.set(col, 6 * s); Cc.set(col, 6 * s + 3);
      b.li = s++;
    }
  }
  ldGeo.attributes.aA.setUsage(THREE.DynamicDrawUsage);
  const leaders = new THREE.LineSegments(ldGeo, K.lines(set));
  leaders.frustumCulled = false; leaders.renderOrder = 3;
  set.group.add(leaders);

  // ---------------------------------------------------------------- focus: what lights up with a node
  // 1 for the node and its direct links, 0.6 two steps, 0.35 three, up and down the levels (not sideways); an edge
  // lights as far as the walk that reached its lower or upper end went along it. From a domain the atlas names, the walk
  // up reaches only the organs (and their tissues) whose maps show it
  const REL = new Map();
  function relOf(k) {
    if (REL.has(k)) return REL.get(k);
    const F = LEV[k] === 3 && FOUND[k].length ? FOUND[k] : null;
    const ok = v => !F || LEV[v] > 1 || (LEV[v] === 0 ? F.includes(v) : UP[v].some(o => F.includes(o)));
    const wt = [1, 1, 0.6, 0.35], walk = (nb, up) => {
      const w = new Float32Array(NN); w[k] = 1;
      let front = [k];
      for (let s = 1; s <= 3 && front.length; s++) {
        const nx = [];
        for (const u of front) for (const v of nb[u]) if (!w[v] && (!up || ok(v))) { w[v] = wt[s]; nx.push(v); }
        front = nx;
      }
      return w;
    };
    const wu = walk(UP, true), wd = walk(DN, false), w = new Float32Array(NN), e = new Float32Array(NE);
    for (const i of ids) w[i] = Math.max(wu[i], wd[i]);
    EU.forEach(([u, v], j) => { e[j] = Math.max(wd[u] && wd[v] ? Math.min(wd[u], wd[v]) : 0, wu[u] && wu[v] ? Math.min(wu[u], wu[v]) : 0); });
    const r = { w, e };
    REL.set(k, r);
    return r;
  }
  // up to six nodes named round a focused one: its direct links (none when it has more than 8), then for an organ the
  // tissue types of its tissues; for a domain its tissue type and the organs whose atlas maps show it
  const LABN = new Map();
  function labFor(k) {
    if (LABN.has(k)) return LABN.get(k);
    const out = [], direct = [...UP[k], ...DN[k]];
    if (LEV[k] === 3) { for (const j of [...UP[k], ...FOUND[k]]) if (out.length < 6) out.push(j); }
    else if (direct.length <= 8) {
      for (const j of direct.slice().sort((a, b) => LEV[a] - LEV[b] || DEG[b] - DEG[a])) if (out.length < 6) out.push(j);
      if (LEV[k] === 0) for (const ti of DN[k]) if (LEV[ti] === 1) for (const t of DN[ti]) if (!out.includes(t) && out.length < 6) out.push(t);
    }
    LABN.set(k, out);
    return out;
  }
  // the shown focus and organ: a crossfade from index a to b (m 0..1); a fractional param crossfades by its fraction
  const FS = { a: -1, b: -1, m: 1, fresh: true }, OS = { a: 0, b: 0, m: 1, fresh: true };
  function stepSel(st, v0, dt, lo, hi) {
    const v = clamp(isFinite(v0) ? v0 : lo, lo, hi), iv = Math.round(v);
    if (Math.abs(v - iv) > 0.001) { st.a = Math.floor(v); st.b = Math.ceil(v); st.m = v - st.a; st.fresh = false; return; }
    if (st.fresh || !(dt > 0) || dt > 0.25) { st.a = st.b = iv; st.m = 1; st.fresh = false; return; }
    if (iv !== st.b) { st.a = st.m >= 0.5 ? st.b : st.a; st.b = iv; st.m = 0; }
    st.m = Math.min(1, st.m + dt * 3.5);
  }
  const wOf = (st, k) => (st.b === k ? smooth(st.m) : 0) + (st.a === k ? 1 - smooth(st.m) : 0);

  // ---------------------------------------------------------------- per frame
  const cur = { c: 0, cl: 0, fon: 0, age: 0, hz: 0, hs: 1, hy: 0, fw: new Float32Array(NN), nl: new Float32Array(NN), vis: new Float32Array(NN), ga: new Float32Array(NN),
    cw: new Float32Array(NCO), cp: CO.map(o => o.P.map(p => p.slice())), dom: 0, sig: '' };
  const posOf = i => [POS[i][0] * cur.hs, POS[i][1] * cur.hs + cur.hy, POS[i][2] * cur.hs + cur.hz];
  const hw = new Float32Array(NN), eh = new Float32Array(NE);
  function setInst(k, p, s, col, a, halo, ring) {
    const o = 16 * k;
    IM[o] = s; IM[o + 1] = 0; IM[o + 2] = 0; IM[o + 3] = 0; IM[o + 4] = 0; IM[o + 5] = s; IM[o + 6] = 0; IM[o + 7] = 0;
    IM[o + 8] = 0; IM[o + 9] = 0; IM[o + 10] = s; IM[o + 11] = 0; IM[o + 12] = p[0]; IM[o + 13] = p[1]; IM[o + 14] = p[2]; IM[o + 15] = 1;
    nCol.array.set(col, 3 * k); nA.array[k] = a;
    HA.aP.array.set(p, 3 * k); HA.aCol.array.set(col, 3 * k); HA.aSize.array[k] = s; HA.aA.array[k] = a * halo; HA.aRing.array[k] = ring;
  }
  const _c = [0, 0, 0];
  let lastT = null;
  function update(S, t, dt) {
    orgStep(4);
    const g = clamp(S.hier_grow === undefined ? 1 : S.hier_grow, 0, 1), c = smooth(clamp(S.hier_contacts || 0, 0, 1)), age = clamp(S.hier_age || 0, 0, 1);
    // a seek (time going back, or on by much more than the frame's dt; also the first frame after the set was hidden)
    // shows the new focus and organ at once, so a seek is exact whatever dt the engine passes
    if (lastT === null || t < lastT - 1e-4 || t - lastT > Math.max(0.3, 2.5 * (dt || 0) + 0.05)) FS.fresh = OS.fresh = true;
    lastT = t;
    stepSel(FS, S.hier_focus === undefined ? -1 : S.hier_focus, dt, -1, NN - 1);
    stepSel(OS, S.hier_organ || 0, dt, 0, NCO - 1);
    const fon = 1 - wOf(FS, -1);
    cur.c = c; cur.fon = fon; cur.age = age; cur.cl = prog(clamp(S.hier_contacts || 0, 0, 1), 0.55, 0.9);
    for (let k = 0; k < NCO; k++) cur.cw[k] = wOf(OS, k);
    cur.dom = cur.cw[OS.b] >= 0.5 ? OS.b : OS.a;
    // the network steps back as the contacts come forward
    cur.hz = -0.85 * c; cur.hs = 1 - 0.2 * c; cur.hy = 0.06 * c;
    hg.position.set(0, cur.hy, cur.hz); hg.scale.setScalar(cur.hs);
    thrMat.uniforms.uGrow.value = g; thrMat.uniforms.uF.value = fon; thrMat.uniforms.uK.value = lerp(1, 0.1, c);
    ringMat.uniforms.uReveal.value = g; ringMat.uniforms.uK.value = lerp(1, 0.25, c);
    // what the focus lights
    hw.fill(0); eh.fill(0); cur.fw.fill(0); cur.nl.fill(0);
    for (const k of FS.a === FS.b ? [FS.a] : [FS.a, FS.b]) {
      const w = wOf(FS, k);
      if (k < 0 || w <= 0) continue;
      const r = relOf(k);
      for (let i = 0; i < NN; i++) hw[i] += w * r.w[i];
      for (let j = 0; j < NE; j++) eh[j] += w * r.e[j];
      cur.fw[k] += w;
      for (const j of labFor(k)) cur.nl[j] += w;
    }
    const sig = `${FS.a},${FS.b},${FS.m.toFixed(3)}`;
    if (sig !== cur.sig) {
      cur.sig = sig;
      for (let j = 0; j < NE; j++) aH.fill(Math.min(1, eh[j]), j * EV, (j + 1) * EV);
      thrGeo.attributes.aH.needsUpdate = true;
    }
    // the network's nodes
    const leave = prog(c, 0, 0.12);   // contact domains leave their ring as they fly
    for (let i = 0; i < NN; i++) {
      const L = LEV[i], ga = prog(g, GS[L] + SW[i], GS[L] + SW[i] + 0.1);
      let og = 0, gone = 0;
      for (let k = 0; k < NCO; k++) {
        const w = cur.cw[k];
        if (!w) continue;
        if (i === CO[k].gOrgan || i === CO[k].gTissue) og += w;
        if (CO[k].gi.includes(i)) gone += w * leave;
      }
      const lit = 1 - 0.8 * fon * (1 - Math.min(1, hw[i]));
      let vis = ga * lit * (1 - gone);
      vis *= lerp(1, 0.12 + 0.75 * og, c);
      cur.vis[i] = vis; cur.ga[i] = ga;
      const br = (0.5 + 0.5 * lit) * (1 + 0.3 * cur.fw[i]) * lerp(1, 0.6 + 0.6 * og, c);
      for (let q = 0; q < 3; q++) _c[q] = Math.min(1, LCOL[L][q] * br);
      const grow = (0.25 + 0.75 * ga) * (1 + 0.5 * cur.fw[i]) * (1 + 0.4 * og * c) * cur.hs, s = RAD[i] * grow, p = posOf(i);
      setInst(i, p, s, _c, vis, 0.55 + 0.45 * Math.min(1, hw[i]) * fon, cur.fw[i] * (1 - c));
      // an organ: its model instead of the sphere, sitting in a glow of its level's colour
      if (orgMesh && OSL[i] >= 0) {
        const k = OSL[i], so = ORAD[i] * grow * (1 - 0.15 * cur.fw[i]);
        nA.array[i] = 0; HA.aSize.array[i] = so * 0.8;
        oP[k].set(p[0], p[1], p[2], so); oQ[k].set(vis, 0.6 * cur.fw[i] + 0.25 * Math.min(1, hw[i]) * fon, t * 0.35 + oPh[k], 0.6 * (1 - lit));
      }
    }
    // the contact networks
    let bi = 0;
    for (let k = 0; k < NCO; k++) {
      const co = CO[k], w = cur.cw[k], n = co.dom.length;
      for (let j = 0; j < n; j++) {
        const ii = NN + co.o + j;
        if (w <= 0 || c <= 0) { nA.array[ii] = 0; HA.aA.array[ii] = 0; continue; }
        const f = prog(c, 0.04 + 0.06 * j / n, 0.5 + 0.06 * j / n), gi = co.gi[j];
        const st = gi >= 0 ? posOf(gi) : posOf(co.gTissue >= 0 ? co.gTissue : Math.max(0, co.gOrgan));
        const p = v3.lerp(st, co.P[j], f);
        p[1] += 0.12 * Math.sin(PI * f);
        cur.cp[k][j] = p;
        const ex = co.ex[j], grow = ex ? Math.pow(lerp(ex.from, ex.to, age) / Math.sqrt(ex.from * ex.to), 0.25) : 1;
        const s = lerp(gi >= 0 ? RAD[gi] * cur.hs : 0.02, co.rad[j] * grow, f);
        const col = v3.lerp(LCOL[3], co.col[j], f);
        setInst(ii, p, s, col, w * prog(c, 0, 0.12), 0.8, 0);
      }
      const rv = prog(clamp(S.hier_contacts || 0, 0, 1), 0.55, 0.95);
      for (const b of co.bands) {
        const ch = b.ch, sh = ch ? clamp(b.c[2] + ch.d * age, 0.03, 0.98) : b.c[2];
        // (a changing band is only just tinted at 20, so its colour is the change)
        UB[bi++].set(0.003 + 0.042 * sh, ch ? ch.dir * (0.15 + 0.85 * age) : 0, w * (c > 0 ? 1 : 0), rv);
      }
      const la = ldGeo.attributes.aA.array;
      for (const b of co.items) la[2 * b.li] = la[2 * b.li + 1] = 0.5 * w * cur.cl * (b.ch ? 1 : prog(age, 0.05, 0.4));
    }
    ldGeo.attributes.aA.needsUpdate = true;
    nodes.instanceMatrix.needsUpdate = true; nCol.needsUpdate = true; nA.needsUpdate = true;
    for (const k in HA) HA[k].needsUpdate = true;
    nodeMat.depthWrite = set.uA.value > 0.9;
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const dco = () => CO[cur.dom];
  const anchors = {
    top: () => [0, (RING[0][1] + 0.06) * cur.hs + cur.hy, cur.hz],
    bottom: () => [0, (RING[3][1] - 0.04) * cur.hs + cur.hy, cur.hz],
    // (below and right of the node, clear of it and of the tissue types' label beside the waist)
    connective: () => { const p = posOf(CONN), r = RAD[CONN] * cur.hs; p[0] += 0.7 * r; p[1] -= 1.2 * r; return p; },
    focus: () => { const k = FS.m >= 0.5 ? FS.b : FS.a; return k >= 0 ? posOf(k) : [0, 0, 0]; },
    contacts: () => [CEN[0] - 0.48, dco().top + 0.13, CEN[2]],
    change: () => dco().change,
    core: () => dco().core,
    age: () => [dco().colX, AGEY, CEN[2] + 0.06],
  };
  // the level labels beside each ring's right-hand edge (no ring is wider than the organs', so they have room)
  for (let L = 0; L < 4; L++) anchors['lv' + L] = () => [(RING[L][0] + 0.05) * cur.hs, RING[L][1] * cur.hs + cur.hy, cur.hz];
  const CLS = ['grn', 'grn', 'amb', 'cyn'];
  const lvOn = (S, L) => prog(clamp(S.hier_grow === undefined ? 1 : S.hier_grow, 0, 1), GS[L] + 0.04, GS[L] + 0.14) * (1 - cur.fon) * (1 - prog(cur.c, 0, 0.3));
  const nTis = i => DN[i].filter(j => LEV[j] === 1).length;
  const nTyp = i => new Set(DN[i].flatMap(j => (LEV[j] === 1 ? DN[j] : [j])).filter(j => LEV[j] === 2)).size;
  const cap = s => s.replace(/^./, x => x.toUpperCase());
  // (a change's name stays short: the organ is in the title)
  const brief = s => s.replace(/^(tunica|calcified|ovarian) /, '').replace(/ and adipose tissue$/, '').replace(/^vessels and connective tissue$/, 'vessels');
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const rest = i => (LEV[i] === 0 ? (nTis(i) ? ` · ${pl(nTis(i), 'tissue')}, ${pl(nTyp(i), 'type')}` : ` · ${pl(nTyp(i), 'tissue type')}`)
    : LEV[i] === 1 ? ` · ${pl(nTyp(i), 'tissue type')}`
    : LEV[i] === 2 ? ` · ${ORGS[i].length} organs, ${pl(DN[i].length, 'domain')}`
    : (UP[i].length ? ` · ${NAME[UP[i][0]]}` : '') + (FOUND[i].length ? `, in ${pl(FOUND[i].length, 'organ')} of the atlas` : ''));
  const right = (p, r) => { p[0] += r; return p; };   // a node's label starts at its edge, not on it
  const labels = [
    { text: ['Organs', ` · ${byLev[0].length}`], at: 'lv0', cls: 'grn', alpha: S => lvOn(S, 0) },
    { text: ['Tissues', ` · ${byLev[1].length} in this map`], at: 'lv1', cls: 'grn', alpha: S => lvOn(S, 1) },
    { text: ['Tissue types', ` · ${byLev[2].length}`], at: 'lv2', cls: 'amb', alpha: S => lvOn(S, 2) },
    { text: ['Domains', ` · ${byLev[3].length}`], at: 'lv3', cls: 'cyn', alpha: S => lvOn(S, 3) },
    { text: [cap(NAME[CONN]), ` · in ${ORGS[CONN].length} of ${byLev[0].length} organs`], at: 'connective', cls: 'amb',
      alpha: S => prog(clamp(S.hier_grow === undefined ? 1 : S.hier_grow, 0, 1), 0.84, 0.96) * (1 - cur.fon) * (1 - prog(cur.c, 0, 0.3)) },
  ];
  for (const i of ids) {
    const at = () => right(posOf(i), 0.9 * (orgMesh ? ORAD[i] : RAD[i]) * cur.hs * (1 + 0.5 * cur.fw[i]));
    labels.push({ text: [cap(short(NAME[i])), rest(i)], at, cls: CLS[LEV[i]], alpha: () => cur.fw[i] * cur.ga[i] * (1 - cur.c) });
    labels.push({ text: [cap(short(NAME[i])), ''], at, cls: '', minor: true, alpha: () => clamp(cur.nl[i], 0, 1) * cur.vis[i] * (1 - cur.c) });
  }
  CO.forEach((co, k) => {
    const on = () => cur.cw[k] * cur.cl;
    labels.push({ text: [co.name, ' · domain contacts'], at: 'contacts', cls: '', alpha: on });
    // (what is drawn to illustrate and what is the study's: said on screen, not only here)
    labels.push({ text: ['Illustrative', ' · trends from the study'], at: [co.colX, co.top + 0.13, CEN[2] + 0.06], cls: '', alpha: on });
    co.dom.forEach((nm, j) => labels.push({ text: [nm, ''], at: () => right(cur.cp[k][j].slice(), 0.8 * co.rad[j]), cls: '', minor: true, alpha: on }));
    // the notes' column: the changes (the first two, the findings' first, stay on narrow screens) and the core; with a
    // long name in it, an organ's notes say only "more" or "fewer" (the age is at the column's foot)
    const nm = ch => `${cap(brief(ch.a))}–${brief(ch.b)}`, terse = co.ch.some(ch => nm(ch).length > 20);
    for (const b of co.items) {
      if (!b.ch) { labels.push({ text: ['The core stays', ''], at: b.lab, cls: '', alpha: () => on() * prog(cur.age, 0.05, 0.4) }); continue; }
      const way = (b.ch.dir > 0 ? ' · more' : ' · fewer') + (terse ? '' : ' with age');
      labels.push({ text: [nm(b.ch), way], at: b.lab, cls: b.ch.dir > 0 ? 'amb' : 'cyn', minor: co.ch.indexOf(b.ch) >= 2, alpha: on });
    }
  });
  for (let d = 0; d <= 5; d++) labels.push({ text: [`${20 + 10 * d} years`, ''], at: 'age', cls: '', minor: true, alpha: () => cur.cl * clamp(1 - Math.abs(cur.age * 5 - d) * 2, 0, 1) });

  const cam = {
    default: [0, 12, 4.15, 0, -0.03, 0],
    net: [28, 38, 4.6, 0, -0.2, 0],
    // (the network growing out of the atlas's sections in front of it: from a little above, wide enough for both)
    grow: [6, 20, 4.4, 0, 0, 0.12],
    // (the target right of the network's middle: the notes' column on its right is in the picture)
    contacts: [0, 6, 2.8, CEN[0] + 0.28, CEN[1] + 0.03, CEN[2]],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['network', 'Network'], ['contacts', 'Contacts']] },
    { key: 'organ', label: 'Organ', options: CO.map((o, k) => [String(k), o.name]), when: v => v.view === 'contacts' },
    { key: 'age', label: 'Age', options: [['20', '20 years'], ['70', '70 years']], when: v => v.view === 'contacts' },
  ];
  function explore(c) {
    return { hier_grow: 1, hier_contacts: c.view === 'contacts' ? 1 : 0, hier_organ: clamp(parseInt(c.organ, 10) || 0, 0, NCO - 1),
      hier_age: c.age === '70' ? 1 : 0 };
  }
  // picking: the node nearest along the ray within a little more than its radius
  const _p = new THREE.Vector3(), _d = new THREE.Vector3();
  function pick(rc) {
    const ray = rc.ray;
    set.group.updateMatrixWorld();
    const M = set.group.matrixWorld, sc = M.getMaxScaleOnAxis();
    let best = -1, bt = Infinity;
    const test = (p, r, id) => {
      _p.set(p[0], p[1], p[2]).applyMatrix4(M);
      const tt = _d.copy(_p).sub(ray.origin).dot(ray.direction), rr = Math.max(r * 1.6, 0.03) * sc;
      if (tt > 0 && tt < bt && ray.distanceSqToPoint(_p) < rr * rr) { bt = tt; best = id; }
    };
    if (cur.c > 0.5) { const co = dco(); co.dom.forEach((_, j) => test(cur.cp[cur.dom][j], co.rad[j], co.gi[j])); }
    else for (let i = 0; i < NN; i++) if (cur.vis[i] > 0.15) test(posOf(i), orgMesh ? ORAD[i] : RAD[i], i);
    return best;
  }
  const API = {
    nodes: ids.map(i => ({ i, name: NAME[i], level: LEV[i], levelName: LVN[LEV[i]] })),
    levels: LVN.slice(),
    pick,
    find,
    linked: i => ({ up: UP[i] ? UP[i].slice() : [], down: DN[i] ? DN[i].slice() : [] }),
    organsOfType: i => (ORGS[i] || []).slice(),
    organsOfDomain: i => (FOUND[i] || []).slice(),
    contactOrgans: CO.map(co => ({ name: co.name, organ: co.gOrgan, tissue: co.gTissue, domains: co.dom.slice(),
      changes: co.ch.map(ch => ({ a: ch.a, b: ch.b, dir: ch.dir, from: ch.c[2], to: clamp(ch.c[2] + ch.d, 0.03, 0.98), fig: ch.fig })) })),
    levelColour: L => '#' + new THREE.Color(...LCOL[L]).getHexString(),
    // where the network stands and when each node grows, for the atlas set, whose sections turn into it in the story
    // (atlas_net): rest positions in this set's frame (no contacts shown), the hier_grow at which a node starts to grow
    // (it is grown 0.1 later: scale from 0.25, alpha from 0), its radius when grown (an organ's model: ORAD) and an
    // organ model's turn (t * spinRate + spin)
    layout: () => ({ pos: POS.map(p => p.slice()), level: LEV.slice(), name: NAME.slice(), up: UP.map(u => u.slice()),
      start: ids.map(i => GS[LEV[i]] + SW[i]), span: 0.1, size: ids.map(i => (LEV[i] === 0 ? ORAD[i] : RAD[i])),
      spin: ids.map(i => (OSL[i] >= 0 ? oPh[OSL[i]] : 0)), spinRate: 0.35, levelStart: GS.slice() }),
    useColours(fn) { if (typeof fn !== 'function') return; domainColour = n => rgb(fn(n)); for (const co of CO) co.col = co.dom.map(domainColour); bandCols(); },
  };

  return Object.assign(set, {
    params: { hier_a: 1, hier_grow: 1, hier_focus: -1, hier_contacts: 0, hier_organ: 0, hier_age: 0 },
    update, anchors, labels, cam, controls, explore,
    // (the organ models build between frames while the set is hidden; the harness and the sweeps build them at once)
    idle() { orgStep(3); },
    finish() { if (O3) O3.step(Infinity); buildOrgans(); },
    api: () => API,
  });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['body', 'tissue', 'slide', 'atlas', 'hier'];
// sets drawn in another set's frame: the slide's tiles and domains lie on the tour's tissue section, so the two always
// turn together (and show together)
const FRAME = { slide: 'tissue' };
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
// one set, built as a step of the load (LOAD) and hidden until the story fades it in
function buildSet(k) {
  const s = SETS[k](K);
  GL.sets[k] = s;
  GL.world.add(s.group);
  s.setAlpha(0);
}
// once every set is built (a step of the load): what joins them
function sceneJoin() {
  // one colour per domain in every set: the atlas set's (from the talk's figures), handed to the sets that take it
  const dc = GL.sets.atlas.api && GL.sets.atlas.api().domainColour;
  if (dc) for (const k of SET_ORDER) { const A = GL.sets[k].api && GL.sets[k].api(), f = A && (A.useColours || A.recolour); if (f && k !== 'atlas') f(dc); }
  // the network's layout to the atlas, whose sections turn into it in the story (atlas_net: they fly to its nodes)
  const nl = GL.sets.hier.api && GL.sets.hier.api().layout, un = GL.sets.atlas.api && GL.sets.atlas.api().useNetwork;
  if (nl && un) un(nl());
  // the 29 organs of GTEx as points of light in the tour's body (the engine's own, in the body set's frame)
  GL.dots = makeDots();
  GL.sets.body.group.add(GL.dots.group);
}
// The organs' points: MICRO_DATA.organs' home points in the body, under the params dots (0..1, as far as the body shows)
// and dots_pick (an organ's index + 1, 0 none: it grows and glows white, the others dim a little, and the organ's small
// 3D model (ORGAN3D) floats out beside it, turning slowly, once the models are built). They twinkle gently.
const DOT_COL = '#ff9ec4';
function makeDots() {
  const set = K.newSet('dots'), O = MICRO_DATA.organs, n = O.length, g = K.pointsGeo(n);
  const P = g.attributes.position.array, C = g.attributes.aCol.array, Z = g.attributes.aSize.array, A = g.attributes.aA.array;
  O.forEach((o, i) => { P.set(o.pos, 3 * i); C.set(K.rgb(DOT_COL), 3 * i); Z[i] = 0.05; });
  const pts = new THREE.Points(g, K.points(set, { vertex: 'gl_PointSize *= 1.0 + 0.18 * sin(uTime * 2.3 + position.x * 53.0 + position.y * 31.0);' }));
  pts.renderOrder = 4;
  set.group.add(pts);
  let last = -1, pickT = 0;
  const _p = new THREE.Vector3();
  // the model: only the picked organ's (its geometry swapped when the pick changes, as soon as that model is built: it
  // is wanted first), placed and shown by its uniforms
  const oP = [new THREE.Vector4()], oQ = [new THREE.Vector4()], sh = ORGAN3D.shader(1);
  const om = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uP: { value: oP }, uQ: { value: oQ },
    uTint: { value: new THREE.Color(...K.rgb(DOT_COL)) } }, vertexShader: sh.vertex, fragmentShader: sh.fragment, transparent: true }));
  set.mats.push(om.material);
  om.frustumCulled = false; om.renderOrder = 5; om.raycast = () => {}; om.visible = false;
  set.group.add(om);
  let omId = null;
  function model(id, t) {
    if (id !== omId) {
      const M = id && ORGAN3D.mesh(id);
      if (id && !M) return false;   // (wanted: built next)
      om.geometry.dispose();
      if (id && t - pickT > 0 && t - pickT < 9) pickT = t;   // (a model that came late grows from now; not after a seek)
      const mg = om.geometry = new THREE.BufferGeometry();
      if (M) {
        mg.setAttribute('position', new THREE.BufferAttribute(M.pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(M.nrm, 3));
        mg.setAttribute('aCol', new THREE.BufferAttribute(M.col, 3)); mg.setAttribute('aSlot', new THREE.BufferAttribute(new Float32Array(M.pos.length / 3), 1));
        mg.setIndex(new THREE.BufferAttribute(M.idx, 1));
      }
      omId = id;
    }
    return !!id;
  }
  return Object.assign(set, {
    update(S, t) {
      const k = Math.round(S.dots_pick || 0);
      if (k !== last) {
        pickT = last < 0 ? t - 9 : t; last = k;
        O.forEach((o, i) => { const on = k === i + 1; Z[i] = on ? 0.11 : 0.05; A[i] = !k || on ? 1 : 0.45; C.set(K.rgb(on ? '#ffffff' : DOT_COL), 3 * i); });
        g.attributes.aSize.needsUpdate = g.attributes.aA.needsUpdate = g.attributes.aCol.needsUpdate = true;
      }
      if (t < pickT) pickT = t - 9;   // (a seek back: shown at once)
      // the picked organ's model grows out in front of the body, beside its point (left of it: its label runs right)
      const o = O[k - 1];
      om.visible = model(o ? ORGAN3D.idOf(o.name) : null, t);
      if (!om.visible) return;
      const gr = smooth(clamp((t - pickT) / 0.9, 0, 1));
      oQ[0].set(gr, 0.25, t * 0.5, 0);
      oP[0].set(o.pos[0] - 0.19 * gr, o.pos[1] + 0.03, o.pos[2] + 0.16 * gr, 0.075 * (0.3 + 0.7 * gr));
    },
    // the organ a ray passes closest to (within about 0.045 of its point, in the body's units), or -1
    pick(rc) {
      pts.updateMatrixWorld();
      let best = -1, bd = 0.045 * pts.matrixWorld.getMaxScaleOnAxis();
      O.forEach((o, i) => { _p.fromArray(o.pos).applyMatrix4(pts.matrixWorld); const d = rc.ray.distanceToPoint(_p); if (d < bd) { bd = d; best = i; } });
      return best;
    },
  });
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
  // the organs' 3D models and their pictures build between frames from the start, one organ after another (the one a
  // pane or the body wants first): a short slice a frame in a headset (3 ms), elsewhere a quarter of the frame, 4 to
  // 8 ms (a little more where frames are slow anyway). Each picture goes into the HTML chips waiting for it as it is
  // done, and the headset's panels redraw on GL.orgV (at most twice a second while they come)
  if (!GL.orgDone) {
    ORGAN3D.driven = true;
    GL.orgDone = ORGAN3D.step(GL.renderer.xr.isPresenting ? 3 : clamp((dt || 0) * 250, 4, 8));
    const v = ORGAN3D.version();
    if (v !== GL.orgSeen) { GL.orgSeen = v; fillOrganPics(); }
    const now = performance.now();
    if (GL.orgDone || now - (GL.orgVT || 0) > 500) { GL.orgVT = now; GL.orgV = v; }
  }
  const da = (S.body_a || 0) * (S.dots || 0);
  GL.dots.setAlpha(da);
  if (da > 0.003) GL.dots.update(S, t);
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
  [0, 0], [2.6, 2.4], [5.9, 4], [6.5, 4.6], [12.8, 7], [18.9, 10], [19.5, 10.6],  // Intro
  [29, 14], [29.7, 14.6], [30.5, 15.2], [41.4, 20.5], [50.4, 27], [60.8, 36.5], [64.1, 38.5],
  [66.9, 41.1], [71.1, 42.5], [73.6, 44.5], [78.4, 47], [79.1, 47.6],  // Slide
  [86.2, 50], [87.5, 51.2], [92.8, 55], [101.6, 63], [111.3, 71],  // Library
  [126.7, 85], [127.4, 85.6], [128.6, 86.5], [168.3, 122.6], [178.2, 126],  // Method
  [185.1, 130], [186.4, 131.18], [187.8, 131.2], [193.6, 136.5], [195.6, 138], [209.5, 150.6],
  [213.7, 151], [215.9, 153], [218.7, 155], [224.2, 160], [229.9, 163],  // Atlas
  [238, 170], [239.3, 171.2], [245.8, 176], [246.5, 176.6], [256, 179.5], [264.5, 184], [296, 212.6],  // Age
  [303.4, 215], [304.7, 216.2], [309.6, 220], [321.7, 231], [330.6, 237], [341.2, 244],  // Disease
  [347.8, 250], [349.1, 251.2], [355.6, 256], [374.3, 273], [380.8, 278], [381.5, 278.6],  // Contacts
  [403.5, 285], [404.2, 285.6], [405.4, 286.2], [406.1, 286.8], [413.9, 289.5], [423.3, 296],
  [423.9, 296.6], [442.7, 298.5], [445, 300.6], [456.2, 305],  // Next
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
  { key: 'slide', name: 'Slide', a: 14, b: 50 },
  { key: 'library', name: 'Library', a: 50, b: 85 },
  { key: 'method', name: 'Method', a: 85, b: 130 },
  { key: 'atlas', name: 'Atlas', a: 130, b: 170 },
  { key: 'age', name: 'Age', a: 170, b: 215 },
  { key: 'pathology', name: 'Disease', a: 215, b: 250 },
  { key: 'contacts', name: 'Contacts', a: 250, b: 285 },
  { key: 'next', name: 'Next', a: 285, b: 305 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest; the sets themselves start hidden
const DEF = {};
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
  DEF.dots = 0; DEF.dots_pick = 0;   // the engine's own organ points in the body (makeDots)
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
// (the section, 2.1 long, needs about 4 units' distance to fit right of the panel: further back, and moved right)
const SEC = [0, 0, 0.6, -0.22];
const FIT = { atlas: { default: [0, 0, 1.1, -0.22], library: [0, 0, 1.1, -0.22], atlas: [0, 0, 0.8, -0.35], focus: [0, 0, 0.55, -0.05, 0.0], volcano: [0, 0, 0.45, -0.2],
  curves: [0, 0, 1.1, -0.32], age: [0, 0, 0.45, -0.2] },
  body: { default: [0, 0, 0.55], front: [0, 0, 0.55] }, hier: { net: [0, 0, 0.35, 0, 0.05], default: [0, 0, 0.25, 0, 0.03], grow: [0, 0, 0.8, -0.18, 0.02] }, tissue: { default: SEC, section: SEC }, slide: { default: SEC, section: SEC, domains: SEC, age: SEC, tiles: [0, 0, 0.35, -0.25], close: [0, 0, 0.6, -0.14], group: [0, 0, 0.85, -0.17] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen
const NARROW = { tissue: { section: 1.2, default: 1.2 }, slide: { default: 1.2, domains: 1.2, group: 1.25 }, atlas: { library: 1.1, default: 1.1, atlas: 1.2, volcano: 1.15, curves: 1.15 },
  hier: { net: 1.2, default: 1.2, grow: 1.2 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The preprint's numbers and Iva Buljan's network of organ architecture (MICRO_DATA), looked up once for the story and
// the panes. In the network, domains hang on tissue types (not on organs): an organ reaches its domains only through
// the tissue types it has, which other organs share.
const MD = (() => {
  const D = MICRO_DATA, N = D.graph.nodes, adj = N.map(() => new Set());
  for (const [a, b] of D.graph.edges) if (a !== b) { adj[a].add(b); adj[b].add(a); }
  const byName = (i, j) => N[i][0].localeCompare(N[j][0]);
  const nb = (i, level) => [...adj[i]].filter(j => N[j][1] === level).sort(byName);
  const atLevel = level => N.map((n, i) => i).filter(i => N[i][1] === level).sort(byName);
  const types = atLevel(2), domains = atLevel(3);
  const organs = D.organs.map((o, i) => {
    const node = N.findIndex(n => n[1] === 0 && n[0] === o.name), tis = node >= 0 ? nb(node, 1) : [];
    const ty = new Set(node >= 0 ? nb(node, 2) : []);
    tis.forEach(t => nb(t, 2).forEach(x => ty.add(x)));
    return Object.assign({ i, node, tissues: tis.map(t => N[t][0]), types: [...ty].sort(byName) }, o);
  });
  // a tissue type's domains, and the organs that have it (directly or through one of their tissues)
  const typeDomains = t => nb(t, 3);
  const typeOrgans = t => organs.filter(o => o.types.includes(t));
  const typeOfDomain = d => nb(d, 2)[0] ?? -1;
  return { D, N, adj, organs, types, domains, typeDomains, typeOrgans, typeOfDomain,
    organ: name => organs.find(o => o.name.toLowerCase() === String(name || '').toLowerCase()) || null,
    domain: name => domains.find(d => N[d][0].toLowerCase() === String(name || '').toLowerCase()) ?? -1,
    type: name => types.find(t => N[t][0].toLowerCase() === String(name || '').toLowerCase()) ?? -1 };
})();
const nodeName = i => (MD.N[i] ? MD.N[i][0] : '');
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
// a GTEx tissue's own part, for a list under its organ ('Adipose - Subcutaneous' under Adipose: 'Subcutaneous')
const tisShort = (t, organ) => (t.startsWith(organ + ' - ') ? t.slice(organ.length + 3) : t);
// the network's four levels and their colours (as in the talk's Figure 5)
const LEVEL_COL = ['#1f8a4c', '#7ccf7e', '#ef8f7a', '#5aa9ff'];
const levelName = l => (MICRO_DATA.levels || ['organ', 'tissue', 'tissue type', 'domain'])[l];
// what the sets know (their api()): the atlas's 40 tissues, the slide's domains, the network's nodes and contact organs
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
const API = {};
const api = k => API[k] || (API[k] = setApi(k) || {});
// a domain's colour, the same in every set (the atlas set's palette; else the slide's; else a fixed one by name)
const PAL = ['#ff9ec4', '#ffd166', '#4d94ff', '#3ee08f', '#c77dff', '#ff8a5b', '#46d9ff', '#f4a6ff', '#b8e05a', '#ff5a7a'];
function domCol(name) {
  for (const k of ['atlas', 'slide']) { const f = api(k).domainColour; if (f) { try { const c = f(name); if (c) return c; } catch (e) { /* the next */ } } }
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PAL[h % PAL.length];
}
// an organ's section in the atlas (atlas_focus: a tissue's index + 1; 0 none): its own tissue, or its first
const atlasIdx = name => {
  const T = api('atlas').tissues || [], n = String(name || '').toLowerCase();
  const i = T.findIndex(t => t.toLowerCase() === n), j = i >= 0 ? i : T.findIndex(t => t.toLowerCase().startsWith(n + ' - '));
  return j + 1;
};
// the organ a tissue of the atlas belongs to
const tissueOrgan = t => { const s = String(t || ''); return MD.organs.find(o => s === o.name || s.startsWith(o.name + ' - ') || o.tissues.includes(s)) || null; };
// a node of the network set by name and level (hier_focus), or -1
const hierIdx = (name, level) => { const L = api('hier').nodes || []; const n = String(name || '').toLowerCase(); return L.findIndex(x => x.level === level && String(x.name).toLowerCase() === n); };
// a domain of the network on the slide (slide_focus: its index + 1; 0 none): the same name, or one that starts alike
// ('muscularis' and 'muscularis inner', 'lymphoid Peyer patches' and 'lymphoid')
function slideIdx(name) {
  const L = (api('slide').domains || []).map(x => String(x).toLowerCase()), n = String(name || '').toLowerCase();
  if (!n) return 0;
  let i = L.indexOf(n);
  if (i < 0) i = L.findIndex(x => x.startsWith(n + ' ') || n.startsWith(x + ' '));
  if (i < 0) i = L.findIndex(x => x.split(' ')[0] === n.split(' ')[0]);
  return i + 1;
}
// the network's domain a slide domain stands for (its name, or the one that starts alike), or ''
function slideDomain(k) {
  const s = String((api('slide').domains || [])[k] || '').toLowerCase();
  if (!s) return '';
  const D = MD.domains.map(d => nodeName(d));
  return D.find(n => n.toLowerCase() === s) || D.find(n => s.startsWith(n.toLowerCase() + ' ') || n.toLowerCase().startsWith(s + ' '))
    || D.find(n => n.toLowerCase().split(' ')[0] === s.split(' ')[0]) || '';
}
// the contact networks' organs (hier_organ: an index into them) and the preprint's findings for one of them
const contactIdx = re => Math.max(0, (api('hier').contactOrgans || []).findIndex(o => re.test((o && o.name) || o)));
// the talk's figures, when read: the domains drawn for a tissue ({ name, share }), else none. The figures name tissues
// their own way ('Artery coronary', 'Tibial nerve', 'Aorta'): a reading fits a GTEx tissue when all its words are in it
const words = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').split(/[^a-z]+/).filter(Boolean);
const tidyDom = s => String(s).replace(/pathches/g, 'patches').replace(/adventita/g, 'adventitia').replace(/\bmedula\b/g, 'medulla').replace(/\s*\/\s*/g, ' and ');
// (a reading named only by its organ, 'Colon' or 'Heart', fits no tissue of an organ sampled at two sites: which one the
// talk shows is not said)
function figDomains(tissue) {
  const A = (MICRO_DATA.figures || {}).atlas, w = words(tissue), O = tissueOrgan(tissue);
  if (!Array.isArray(A) || !w.length) return [];
  const only = x => O && O.tissues.length > 1 && words(x).join() === words(O.name).join();
  const e = A.find(x => x && words(x.tissue).join() === w.join()) || A.find(x => x && words(x.tissue).length && !only(x.tissue) && words(x.tissue).every(q => w.includes(q)));
  return e && Array.isArray(e.domains) ? e.domains.filter(d => d && d.name && !/tissue edge/i.test(d.name)).map(d => ({ name: tidyDom(d.name), share: +d.share || 0 })) : [];
}

// ------------------------------------------------------------------ facts --
// Numbers and findings the story quotes, all from MICRO_DATA (a finding not there leaves its sentence out)
const FACTS = (() => {
  const D = MICRO_DATA, F = D.facts, fd = D.findings || {}, path = fd.pathology || [], inter = fd.interactions || [];
  const lv = [0, 0, 0, 0];
  D.graph.nodes.forEach(n => { lv[n[1]]++; });
  // the tissue type shared most widely: the one most organs have
  const wide = MD.types.map(t => ({ name: nodeName(t), organs: MD.typeOrgans(t).length })).sort((a, b) => b.organs - a.organs)[0] || null;
  const yr = /bioRxiv (\d{4})/.exec(D.source.preprint || '');
  return Object.assign({}, F, {
    tilesM: Math.round(F.tiles / 1e6), levels: lv, wide, year: yr ? +yr[1] : null,
    plaque: path.find(p => /plaque/i.test(p.kind)) || null, infarct: path.find(p => /infarct/i.test(p.kind)) || null,
    remodel: path.filter(p => !/plaque|infarct/i.test(p.kind)),
    colon: inter.find(x => /colon/i.test(x.organ) && x.a) || null, artery: inter.find(x => /arter/i.test(x.organ) && x.a) || null, inter,
    ex: D.examples || [], most: fd.most || '', connective: fd.connective || '', stable: fd.stable || '',
    figs: Object.keys(D.figures || {}),
  });
})();
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
const pct = v => (Number.isFinite(+v) ? `${+v}%` : '–');
const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
// colours as text on the HTML panel, which is light in the light theme: a colour mixed with the panel's ink (darker on a
// light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same colour
// a worked example of change with age in a line: what it is, its share at both ages and per decade
const exText = x => `${x.note}; ${pct(x.from)} of the section at ${FACTS.ages[0]}, ${pct(x.to)} at ${FACTS.ages[1]} (${signed(x.perDecade)}% per decade)`;
const exName = x => `${cap(x.tissue)} · ${x.domain}`;
// a change in the contacts between two domains, in words
// where a finding is ('in arteries', 'in the heart')
const inOrgan = o => (/^arter/i.test(o) ? 'in arteries' : `in the ${String(o).toLowerCase()}`);
const where = x => (x.note && /arter/i.test(x.note) ? x.note : `the ${String(x.organ).toLowerCase()}`);
const meet = x => (x.a ? `${cap(x.a)} and ${x.b} meet ${x.dir > 0 ? 'more' : 'less'} with age in ${where(x)}` : `In ${where(x)}, ${x.note}`);

function buildStory() {
  const F = FACTS;
  // fade a set in over [t0, t1] and out over [t2, t3]; the slide always comes with the tissue section it lies on
  const show = (k, t0, t1, t2, t3) => {
    for (const s of k === 'slide' ? ['tissue', 'slide'] : [k]) { ramp(s + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(s + '_a', t2, t3, 1, 0); }
  };
  const hide = (k, t0, t1) => { for (const s of k === 'slide' ? ['tissue', 'slide'] : [k]) ramp(s + '_a', t0, t1, 1, 0); };
  // jump an index param (a domain, a tissue, an organ) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const sd = (...names) => names.reduce((f, n) => f || slideIdx(n), 0);   // slide_focus for a domain of the section (the first name it has)
  // atlas_focus for each worked example (the atlas set's own choice, else by name; the gut's is shown on the slide)
  const exI = F.ex.map((x, i) => (Array.isArray(api('atlas').examples) && api('atlas').examples[i] >= 0 ? api('atlas').examples[i] + 1 : atlasIdx(x.tissue)));
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  const exCol = ['#ff9ec4', '#ffd166', '#c77dff'];
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const others = F.inter.filter(x => x !== F.colon && x !== F.artery).map(x => (x.a ? `${x.a} and ${x.b} meet ${x.dir > 0 ? 'more' : 'less'} in ${where(x)}` : `in ${where(x)}, ${x.note}`));
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Tissue and time</h1>
      <p class="lede" data-at="2.4">how organs are built, and how they age</p>
      <p data-at="4">How the body's organs are built from small working units, and how they change as we age.</p>
      <p data-at="7">Each point of light is one of the ${F.organs} organs whose tissue GTEx collected from ${fmt(F.donors)} people.</p>
      <p class="note" data-at="10">After a preprint${F.year ? ` (bioRxiv, ${F.year})` : ''}, a poster and a talk from the Rendeiro group: CeMM, the LBI for Network Medicine and the Medical University of Vienna.</p>`,
    slide: `<h2 data-at="0.6">One slide</h2>
      ${turns(`<p data-at="1.2" data-out="21.5">Take a thin slice of an organ, here the wall of the stomach, and stain it. This is H&amp;E (haematoxylin and eosin), the standard stain of pathology.</p>
        <p data-at="6.5" data-out="21.5">Haematoxylin colours the cells' nuclei purple-blue; eosin colours their cytoplasm and the fibres between them pink. White is fat, or empty space.</p>
        <p data-at="13" data-out="21.5">Close up, it is all cells. Yet they are not scattered at random: they are arranged in units that each do a job.</p>`,
      `<ul class="steps">
          ${step(22.5, 0, domCol('mucosa'), 'Mucosa', 'the lining: glands that make mucus and acid')}
          ${step(24.5, 0, domCol('submucosa'), 'Submucosa', 'loose tissue with blood vessels')}
          ${step(26.5, 0, domCol('inner circular smooth muscle'), 'Muscularis', 'layers of muscle, one around and one along, that move food on')}
          ${step(28.5, 0, domCol('lymphoid tissue'), 'Lymphoid patch', 'a cluster of immune cells')}
        </ul>
        <p data-at="30.5" class="amber">Such recurring arrangements are microanatomical domains: the units between cells and organs.</p>
        <p class="credits" data-at="33">Slides like this are cheap, plentiful and show a wide field. This section is drawn, not a real slide.</p>`)}`,
    library: `<h2 data-at="0.6">${fmt(F.slides)} slides</h2>
      <p data-at="1.2">GTEx (the Genotype-Tissue Expression project) collected tissue from ${fmt(F.donors)} people who died aged ${F.ages[0]} to ${F.ages[1]}.</p>
      <div class="facts"><div data-at="5"><b>${fmt(F.donors)}</b><small>people</small></div><div data-at="6.5"><b>${F.tissues}</b><small>tissues</small></div><div data-at="8"><b>${F.organs}</b><small>organs</small></div><div data-at="9.5"><b>${fmt(F.slides)}</b><small>slides</small></div></div>
      <p data-at="13">Each slide is one tissue of one person. Here each column is a tissue, and each row an age, the youngest at the bottom.</p>
      <p data-at="21" class="amber">Enough to compare how organs are built, and to see how that changes with age.</p>
      <p class="credits" data-at="27">${fmt(F.donorsAnalysed)} people's slides were analysed: median age ${F.medianAge}, ${pct(F.male)} men. The slides here are drawn, not the GTEx images.</p>`,
    method: `<h2 data-at="0.6">Finding the domains</h2>
      ${turns(`<ul class="steps">
          ${step(1.5, 36.5, '#46d9ff', '1 · Tiles', `each slide is cut into small squares (far smaller than drawn here): ${F.tilesM} million tiles in all`)}
          ${step(9.5, 36.5, '#46d9ff', '2 · Features', 'a deep-learning vision model describes each tile with a list of numbers (drawn here as 16 blocks of colour)')}
          ${step(17.5, 36.5, '#46d9ff', '3 · Neighbours', 'joined to its neighbours, each tile mixes in their descriptions: messages run along the links (message passing)')}
          ${step(26.5, 36.5, '#46d9ff', '4 · Domains', 'in a map of the mixed descriptions, alike tiles gather, across all slides: each group is a domain, and colours the slide')}
        </ul>`,
      `<p data-at="37">No labels needed: a pathologist named the domains afterwards. The method, ${esc(F.method)}, agrees with pathologists' notes (salivary gland r = ${F.bench.salivary.r}, stomach mucosa r = ${F.bench.stomach.r}; r = 1 would be perfect).</p>
        <p data-at="41" class="amber">Now the tiles of every tissue in one map: alike tiles lie close together, coloured by domain.</p>`)}`,
    atlas: `<h2 data-at="0.6">An atlas of the body</h2>
      ${turns(`<p data-at="1.2" data-out="19.5">Across the ${F.tissues} tissues: ${F.domains} domains of ${F.types} types, in ${F.superclasses} classes.</p>
        <div class="facts"><div data-at="5" data-out="19.5"><b>${F.types}</b><small>types of domain</small></div><div data-at="6.5" data-out="19.5"><b>${pct(F.shared3)}</b><small>in three or more tissues</small></div><div data-at="8" data-out="19.5"><b>${pct(F.specific)}</b><small>in one tissue only</small></div></div>
        <p data-at="11" data-out="19.5">A few kinds recur in many tissues, such as connective tissue and blood vessels. Most belong to one tissue.</p>`,
      `<p data-at="20">Iva Buljan's network of organ architecture puts it together in four levels:</p>
        <ul class="legend">${[`${F.levels[0]} organs`, `their tissues, where an organ has several (${F.levels[1]})`, `${F.levels[2]} tissue types`, `${F.levels[3]} domains, as named in this map`].map((t, l) => `<li data-at="${21 + 2 * l}"><span class="sw" style="background:${LEVEL_COL[l]}"></span>${t}</li>`).join('')}</ul>
        ${F.wide ? `<p data-at="30" class="amber">${esc(cap(F.wide.name))} is the tissue type shared most widely: ${F.wide.organs} of the ${F.organs} organs have it.</p>` : ''}
        <p class="credits" data-at="33">The network as in the talk's Figure 5: domains hang on tissue types, and tissue types on organs and their tissues.</p>`)}`,
    age: `<h2 data-at="0.6">Age</h2>
      ${turns(`<p data-at="1.2" data-out="13.5">Of ${F.donorVars} things known about the donors, age is the strongest in explaining how their domains differ.</p>
        <p data-at="6" data-out="13.5" class="amber">${pct(F.ageChange)} of domains change with age (${F.agePairs[0]} of ${F.agePairs[1]} pairs of a domain and a tissue, where the domain covers more than ${pct(F.agePairsMin)}), mostly by less than ${pct(F.mostUnder)} per decade.</p>
        <p class="credits" data-at="9.5" data-out="13.5">Each bubble is a domain in a tissue: right, it grows with age; left, it shrinks; higher, the change is surer.</p>`,
      `<ul class="steps">${F.ex.map((x, i) => step(14 + 10 * i, 0, exCol[i], exName(x), esc(exText(x)))).join('')}</ul>
        <p data-at="42">${esc(F.connective)} ${esc(F.most)}</p>`)}`,
    pathology: `<h2 data-at="0.6">Disease</h2>
      ${turns(`<p data-at="1.2" data-out="15.5">GTEx's pathologists noted what they saw on each slide: ${fmt(F.pathology.instances)} notes of ${F.pathology.kinds} kinds.</p>
        <ul class="steps">${[F.plaque, F.infarct].filter(Boolean).map((p, i) => step(5 + 4 * i, 15.5, i ? '#ff5a4b' : '#ffb43b', cap(p.kind), `${esc(inOrgan(p.organ))}: ${esc(p.note)}`)).join('')}</ul>`,
      `<p data-at="16" class="amber">Disease and healthy ageing often remodel different parts of a tissue: how much of a domain there is, its shape, or both.</p>
        ${F.remodel.length ? `<p data-at="22">For example: ${esc(F.remodel.map(p => `${p.kind} ${p.note}`).join('; '))}.</p>` : ''}
        <p class="credits" data-at="29">${F.figs.includes('trajectories') ? 'Curves read off the talk\'s figures.' : 'Curves drawn after the preprint\'s descriptions, not its data points.'}</p>`)}`,
    contacts: `<h2 data-at="0.6">Neighbours</h2>
      ${turns(`<p data-at="1.2" data-out="16.5">Domains touch. Which ones meet, and how much, makes a network of contacts in each organ.</p>
        ${F.colon ? `<p data-at="6" data-out="16.5">${esc(meet(F.colon))}.</p>` : ''}`,
      `${F.artery ? `<p data-at="17">${esc(meet(F.artery))}.</p>` : ''}
        ${F.stable ? `<p data-at="23" class="amber">${esc(F.stable)}</p>` : ''}
        ${others.length ? `<p class="credits" data-at="28">Also: ${esc(others.join('; '))}. Contact networks drawn after the preprint's findings.</p>` : ''}`)}`,
    next: `<h2 data-at="0.6">Tissue and time</h2>
      ${turns(`<p data-at="1.2" data-out="10.5">A map of how the body is built, from cells to domains to organs, and of how it changes with age.</p>
        <p data-at="4.5" data-out="10.5" class="amber">It may help to study ageing itself, to spot early signs of disease in routine slides, and to compare organs on one scale.</p>`,
      `<p data-at="11">Preprint: Iva Buljan, Z. Bagó-Horváth and A. F. Rendeiro${F.year ? ` (bioRxiv, ${F.year})` : ''}. Poster and talk: Iva Buljan, of the Rendeiro group at CeMM (Research Center for Molecular Medicine of the Austrian Academy of Sciences), the LBI for Network Medicine and the Medical University of Vienna. Slides: ${esc(F.gtex)}.</p>
        <p data-at="13.5"><button class="btn primary" id="btnGoExplore" type="button">Explore the atlas</button></p>
        <p class="credits" data-at="15">Slides, sections and tiles are drawn, not the GTEx images; the domain maps, the volcano's other points and the contact networks are illustrative where the figures give no numbers.</p>`)}`,
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
  // (the tissue and the slide share one frame, so their waypoints turn them together)
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  start({ body_pet: 1, body_net: 0, body_state: 0, body_blank: 0, dots: 0, dots_pick: 0, tissue_graph: 0, tissue_mark: 0, tissue_embed: 0,
    slide_tiles: 0, slide_feat: 0, slide_adj: 0, slide_group: 0, slide_domain: 0, slide_age: 0, slide_focus: 0,
    atlas_lib: 0, atlas_map: 0, atlas_umap: 0, atlas_focus: 0, atlas_age: 0, atlas_volcano: 0, atlas_curves: 0, atlas_net: 0,
    hier_grow: 0, hier_focus: -1, hier_contacts: 0, hier_organ: 0, hier_age: 0 });
  const stomach = MD.organs.findIndex(o => /stomach/i.test(o.name)) + 1;
  if (stomach) ORGAN3D.want(ORGAN3D.idOf(MD.organs[stomach - 1].name));   // (its model is the first the story shows: built first)
  let a, b;
  // Intro: the tour's PET body, the organs' points lighting up one by one
  a = C.title.a; b = C.title.b;
  show('body', 0.2, 2);
  ramp('dots', a + 3, a + 7, 0, 1);
  cam(a, 'body', 'front', -14);
  cam(b - 2.5, 'body', 'front', 8, 'spin');
  // One slide: into the stomach (its point glows), the section, close up, then its domains wash in, one by one
  a = C.slide.a; b = C.slide.b;
  jump('dots_pick', a - 2.5, 0, stomach);
  const st = (MD.organs[stomach - 1] || { pos: [0, 0, 0] }).pos;
  cam(a + 1.5, 'body', 'front', 4, null, [0, 0, -2.6, st[0], st[1], st[2]]);
  hide('body', a + 1.2, a + 3);
  show('slide', a + 1.8, a + 4);
  cam(a + 4, 'tissue', 'section', -8);
  cam(a + 11, 'tissue', 'section', 6, 'spin');
  cam(a + 15, 'tissue', 'zoom');
  cam(a + 20, 'tissue', 'zoom', 10, 'spin');
  cam(a + 23.5, 'slide', 'domains', -6);
  cam(b - 0.5, 'slide', 'domains', 6, 'spin');
  ramp('slide_domain', a + 22, a + 27, 0, 1);
  // (each glows as its line appears; one the section does not have is skipped; then all of them again)
  let f0 = 0;
  for (const [f, t] of [[sd('mucosa'), 22.5], [sd('submucosa'), 24.5], [sd('inner circular smooth muscle', 'muscularis'), 26.5], [sd('outer longitudinal smooth muscle'), 27.5],
    [sd('lymphoid tissue', 'lymphoid'), 28.5], [-1, 30.5]]) if (f && f !== f0) { const v = Math.max(0, f); jump('slide_focus', a + t, f0, v); f0 = v; }
  // 24,945 slides: the library, column by tissue, row by age
  a = C.library.a; b = C.library.b;
  hide('slide', a, a + 2);
  show('atlas', a + 0.5, a + 2.5);
  ramp('atlas_lib', a + 1, a + 14, 0, 1);
  // (the slides burst onto the wall; the camera goes along the rack up close, glass slides with their tissue, then
  // back to the whole wall)
  cam(a + 1, 'atlas', 'library', -12);
  cam(a + 6, 'atlas', 'shelf');
  cam(a + 11, 'atlas', 'shelf', 8, 'spin');
  cam(a + 16.5, 'atlas', 'library', -4);
  cam(b - 0.5, 'atlas', 'library', 12, 'spin');
  // Finding the domains: back at the section, the four steps, built as the tour builds its cell network: the tiles,
  // their features lighting up (16 blocks each), a network over them whose links carry messages, the lift into a map
  // of the mixed descriptions where alike tiles gather and take their domain's colour, and back down onto the slide;
  // then the tile cloud of all slides
  a = C.method.a; b = C.method.b;
  // (the library and the section cross: one fades out as the other fades in, over the camera's move)
  hide('atlas', a - 0.5, a + 2.5);
  jump('atlas_lib', a + 2.6, 1, 0);   // the library's wall stays gone after its chapter (the sections still come from its place)
  jump('slide_domain', a - 0.6, 1, 0);
  show('slide', a - 0.5, a + 2, a + 37, a + 39);
  ramp('slide_tiles', a + 2, a + 8, 0, 1);
  ramp('slide_feat', a + 9.5, a + 15.5, 0, 1);
  ramp('slide_adj', a + 17.5, a + 24, 0, 1);
  ramp('slide_group', a + 26.5, a + 30.5, 0, 1);
  ramp('slide_group', a + 33, a + 35.5, 1, 2);
  ramp('slide_domain', a + 33.5, a + 36, 0, 1);
  cam(a + 2, 'slide', 'tiles', -8);
  cam(a + 8, 'slide', 'tiles', 4, 'spin');
  cam(a + 10.5, 'slide', 'matrix');
  cam(a + 16, 'slide', 'matrix', 6, 'spin');
  cam(a + 18.5, 'slide', 'close');
  cam(a + 25, 'slide', 'close', 8, 'spin');
  cam(a + 28.5, 'slide', 'group');
  cam(a + 33, 'slide', 'group', 6, 'spin');
  cam(a + 36, 'slide', 'domains');
  // (the sections come forward from the library's wall, and the tiles rise out of them)
  show('atlas', a + 37.5, a + 39.5);
  ramp('atlas_map', a + 37.5, a + 40, 0, 1);
  ramp('atlas_umap', a + 40, a + 44, 0, 1);
  cam(a + 39, 'atlas', 'umap', -10);
  cam(b - 0.5, 'atlas', 'umap', 25, 'spin');
  // An atlas of the body: a section per tissue; then it turns into the network of organ architecture, level by level
  // with the legend's lines: the sections' tiles gather into a bead per domain, each section's organ flies up to its
  // node, the sections to their tissues', their beads on to the tissue types' and the domains' (atlas_net; hier_grow
  // is keyed at the same times, so each node grows as its things arrive: the atlas leads it by netLead)
  a = C.atlas.a; b = C.atlas.b;
  ramp('atlas_umap', a + 1, a + 4, 1, 0);
  cam(a + 2.5, 'atlas', 'atlas', -6);
  cam(a + 15.5, 'atlas', 'atlas', 5, 'spin');
  const lead = +api('atlas').netLead || 0, grow = v => (v - lead) / (1 - lead);
  ramp('atlas_net', a + 15, a + 31.5, 0, 1); ramp('hier_grow', a + 15, a + 31.5, grow(0), grow(1));
  jump('atlas_net', a + 33, 1, 0);   // (the atlas is gone by then; it comes back as itself in the next chapter)
  show('hier', a + 19, a + 20);
  hide('atlas', a + 28.8, a + 30.3);
  // (the camera rises over the atlas while its tiles gather, holds while things fly, then takes the network's view)
  // (an even turn of about 2.5 degrees a second, ending where it did before the morph, so the next hand-over is as it was)
  cam(a + 19.5, 'hier', 'grow', -3);
  cam(a + 28.5, 'hier', 'grow', 19, 'spin');
  // (the tissue type shared most widely lights up with its line)
  const wideN = F.wide ? hierIdx(F.wide.name, 2) : -1;
  if (wideN >= 0) { jump('hier_focus', a + 30, -1, wideN); jump('hier_focus', b - 0.5, wideN, -1); }
  cam(a + 31.5, 'hier', 'net', 4);
  cam(b - 0.5, 'hier', 'net', 25, 'spin');
  // Age: the volcano; then the three examples in turn (the ovary, the gut on the slide, the pituitary)
  a = C.age.a; b = C.age.b;
  hide('hier', a, a + 2);
  show('atlas', a + 0.5, a + 2.5, a + 24, a + 26);
  ramp('atlas_volcano', a, a + 6, 0, 1);   // (begun before the atlas shows, so its sections never flash up behind it)
  cam(a + 2, 'atlas', 'volcano', -8);
  cam(a + 13, 'atlas', 'volcano', 6, 'spin');
  ramp('atlas_volcano', a + 14, a + 16, 1, 0);
  if (exI[0]) jump('atlas_focus', a + 14, 0, exI[0]);
  ramp('atlas_age', a + 17, a + 23, 0, 1);
  cam(a + 15.5, 'atlas', 'focus');
  cam(a + 23.5, 'atlas', 'focus', 8, 'spin');
  // (the gut's submucosa on the section: its share falls as the age goes from 20 to 70)
  jump('slide_tiles', a, 1, 0); jump('slide_adj', a, 1, 0); jump('slide_feat', a, 1, 0); jump('slide_group', a, 2, 0);
  show('slide', a + 24.5, a + 26.5, a + 34, a + 36);
  jump('slide_focus', a + 24, 0, sd('submucosa'));
  ramp('slide_age', a + 27, a + 33, 0, 1);
  cam(a + 25, 'slide', 'age', -6);
  cam(a + 33.5, 'slide', 'age', 6, 'spin');
  show('atlas', a + 34, a + 36);
  if (exI[0] || exI[2]) jump('atlas_focus', a + 30, exI[0], exI[2]);
  jump('atlas_age', a + 30, 1, 0);
  ramp('atlas_age', a + 37, a + 42, 0, 1);
  cam(a + 35, 'atlas', 'focus', -6);
  cam(b - 0.5, 'atlas', 'focus', 8, 'spin');
  // Disease: the trajectories over age
  a = C.pathology.a; b = C.pathology.b;
  ramp('atlas_curves', a + 1.5, a + 7, 0, 1);
  jump('atlas_focus', a + 2.6, exI[2], 0); jump('atlas_age', a + 2.6, 1, 0);
  cam(a + 2, 'atlas', 'curves', -6);
  cam(b - 0.5, 'atlas', 'curves', 8, 'spin');
  // Neighbours: the colon's domain contacts, then the coronary artery's, each from age 20 to 70
  a = C.contacts.a; b = C.contacts.b;
  hide('atlas', a, a + 2);
  jump('hier_contacts', a, 0, 1);
  jump('hier_organ', a, 0, contactIdx(/colon/i));
  show('hier', a + 0.5, a + 2.5);
  ramp('hier_age', a + 7, a + 14, 0, 1);
  // (the switch to the artery behind a short fade)
  ramp('hier_a', a + 15.5, a + 16.8, 1, 0); ramp('hier_a', a + 17.2, a + 18.6, 0, 1);
  jump('hier_organ', a + 17, contactIdx(/colon/i), contactIdx(/coronary|arter/i));
  jump('hier_age', a + 17, 1, 0);
  ramp('hier_age', a + 19, a + 26, 0, 1);
  cam(a + 2, 'hier', 'contacts', -10);
  cam(a + 16, 'hier', 'contacts', 6, 'spin');
  cam(a + 18, 'hier', 'contacts', -6);
  cam(b - 0.5, 'hier', 'contacts', 8, 'spin');
  // Tissue and time: the body and its organs again
  a = C.next.a; b = C.next.b;
  hide('hier', a, a + 2);
  show('body', a + 0.5, a + 2.5);
  jump('dots_pick', a, stomach, 0);
  cam(a + 1, 'body', 'front', -16);
  cam(b, 'body', 'front', 10, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);

  // ------------------------------------------------------------ sound effects
  // (sfxCue: story time, a sound, where it comes from: a set and one of its anchors, or a point in its frame; its options)
  a = C.title.a;
  sfxCue(a + 0.3, 'rise', 'body', null);                                                  // the PET body
  sfxCue(a + 3, 'patter', 'body', null, { dur: 4, pitch: 1.4, gain: 0.3 });               // the organs' points light one by one
  sfxCue(C.slide.a - 2.5, 'pick', 'body', st);                                            // the stomach's point glows
  a = C.slide.a;
  sfxCue(a + 1.2, 'whoosh', 'slide', null, { dur: 2 });                                   // into the stomach: the section
  ['mucosa', 'submucosa', 'inner', 'outer', 'lymphoid'].forEach((d, k) => sfxCue(a + [22.5, 24.5, 26.5, 27.5, 28.5][k], 'step', 'slide', d, { pitch: Math.pow(2, 2 * k / 12), seq: true }));   // its domains wash in
  a = C.library.a;
  sfxCue(a + 1, 'clink', 'atlas', 'library');                                             // the first slide
  sfxCue(a + 1.5, 'patter', 'atlas', 'library', { dur: 11, gain: 0.35 });                 // the slides burst onto the wall
  a = C.method.a;
  sfxCue(a + 2, 'grow', 'slide', 'tiles', { dur: 6, pitch: 1.2 });                       // tiles
  sfxCue(a + 9.5, 'grow', 'slide', 'feat', { dur: 6, pitch: 1.5, gain: 0.35 });          // their features light up
  [18, 20, 22].forEach(t => sfxCue(a + t, 'pulse', 'slide', 'listen', { gain: 0.3, seq: true }));   // messages along the links
  sfxCue(a + 26.5, 'whoosh', 'slide', 'cloudC', { dur: 4, pitch: 1.2 });                  // the lift into a map
  sfxCue(a + 33, 'whoosh', 'slide', null, { dur: 2.5, pitch: 0.7 });                      // back down onto the slide
  sfxCue(a + 37.5, 'rise', 'atlas', 'umap', { dur: 5 });                                  // the tile cloud of all slides
  a = C.atlas.a;
  sfxCue(a + 15, 'rise', 'hier', 'top', { dur: 16, gain: 0.4 });                          // the atlas turns into the network
  sfxCue(a + 20, 'whoosh', 'hier', 'top', { dur: 3 });                                    // the organs fly up to their nodes
  if (wideN >= 0) sfxCue(a + 30, 'ping', 'hier', 'focus');                                // the tissue type shared most widely
  a = C.age.a;
  sfxCue(a + 0.3, 'grow', 'atlas', 'volcano', { dur: 6 });                                // the volcano
  sfxCue(a + 14, 'pick', 'atlas', 'ex0');                                                 // the first example
  sfxCue(a + 17, 'rise', 'atlas', 'focus', { dur: 6, pitch: 0.8 });                       // from 20 to 70
  sfxCue(a + 27, 'rise', 'slide', 'submucosa', { dur: 6, pitch: 0.8 });                   // the gut ages
  sfxCue(a + 37, 'rise', 'atlas', 'focus', { dur: 5, pitch: 0.8 });                       // the third example ages
  sfxCue(C.pathology.a + 1.5, 'grow', 'atlas', 'curves', { dur: 5, pitch: 0.8 });         // the trajectories
  a = C.contacts.a;
  sfxCue(a + 0.5, 'whoosh', 'hier', 'contacts');                                          // the colon's contacts
  sfxCue(a + 7, 'rise', 'hier', 'change', { dur: 7, pitch: 0.8 });                        // from 20 to 70
  sfxCue(a + 16, 'whoosh', 'hier', null, { dur: 1.5 });                                   // the switch to the artery
  sfxCue(a + 19, 'rise', 'hier', 'change', { dur: 7, pitch: 0.75 });                      // from 20 to 70
  sfxCue(C.next.a + 0.5, 'rise', 'body', null, { gain: 0.4 });                            // tissue and time
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  const at = (k, n) => () => anchorOf(k, n);
  const dotAt = name => (MD.organ(name) || { pos: [0, 0, 0] }).pos;
  a = C.title.a;
  label('body', dotAt('Brain'), `<b>${F.organs} organs</b>`, a + 7, C.slide.a - 3, 'mag');
  label('body', st, '<b>Stomach</b>', C.slide.a - 2.5, C.slide.a + 1.6, 'mag');
  a = C.slide.a;
  label('tissue', at('tissue', 'mucosa'), '<b>Nuclei</b>purple-blue: haematoxylin', a + 7, a + 13, 'amb');
  label('tissue', at('tissue', 'submucosa'), '<b>Fibres</b>pink: eosin', a + 8, a + 13, 'amb');
  label('tissue', at('tissue', 'vessel'), '<b>A blood vessel</b>', a + 9.5, a + 13, 'amb');
}
// sets the one before turns into at a hand-over (the network grows out of the atlas: atlas_net), so they share its turn
const MORPH = { hier: 'atlas' };
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
      // (a set that the one before turns into, MORPH, takes its turn: the atlas's things fly to the network's nodes)
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
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[9] || 1, w[10]];
  });
}
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
// (the tissue and the slide share one turn: one frame)
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
// Explore mode: the organs and their tissues, the domains and their tissue types, what changes with age, the method in
// four steps; or any scene with its own controls.
const SCENES = [
  ['body', 'Body', `The ${FACTS.organs} organs whose tissue GTEx collected, as points of light on a body drawn from a PET scan (the tour's body).`],
  ['slide', 'Section', 'One H&E-stained section of stomach wall (the tour\'s tissue, drawn), with the method\'s tiles, features and neighbours, and its domains at 20 and at 70.'],
  ['atlas', 'Library and atlas', `The slide library (${fmt(FACTS.slides)} slides), a section per tissue with its domains, the tiles in one map, what changes with age and the pathology curves.`],
  ['hier', 'Network', 'Iva Buljan\'s network of organ architecture: organs, tissues, tissue types and domains; and one organ\'s domain contacts at 20 and at 70.'],
];
const SCENE_SHORT = { atlas: 'Atlas' };
const TABS = [['organs', 'Organs'], ['domains', 'Domains'], ['age', 'Age'], ['method', 'Method'], ['scenes', 'Scenes']];
// the tour's body set: its network and its disease scan are the tour's illustration, so this story leaves them out;
// the sets' own Age controls give way to the story's age slider (X.age), which drives them all
const HIDE_CTL = { body: ['view', 'state', 'tracer'] };
const isAge = c => /^age$/i.test(c.key) || /^age$/i.test(c.label || '');
const ctlsOf = k => (GL.sets[k].controls || []).filter(c => !(HIDE_CTL[k] || []).includes(c.key) && !isAge(c));
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries((GL.sets[k].controls || []).map(x => [x.key, isAge(x) ? ageOpt(x) : ctlValue(k, x)])));
const AGE0 = FACTS.ages[0], AGE1 = FACTS.ages[1];
const X = { tab: 'organs', scene: 'atlas', ctl: {}, t0: 0, turn: 'on', organ: null, domain: null, age: AGE0, step: 1, kind: null };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['slide_focus', 'atlas_focus', 'hier_focus', 'hier_organ', 'dots_pick', 'atlas_net']);   // (atlas_net: the story's morph, never eased back in explore)
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a control's option whose key or name matches re (the sets name their own options)
const optKey = (k, key, re) => { const c = ctlOf(k, key), o = c && c.options.find(([v, n]) => re.test(v) || re.test(n)); return o ? o[0] : null; };
// the age slider as a set's own Age option (the one nearest X.age)
const ageOpt = c => { let b = c.options[0][0], bd = Infinity; for (const [v, n] of c.options) { const a = parseFloat(n) || parseFloat(v), d = Math.abs(a - X.age); if (d < bd) { bd = d; b = v; } } return b; };
const ageF = () => clamp((X.age - AGE0) / (AGE1 - AGE0), 0, 1);
// a view option's camera: the cam view of the same name, or the one its name stands for
const CAM_ALIAS = { atlas: { tiles: 'umap', age: 'volcano', pathology: 'curves', section: 'focus' }, slide: { section: 'default', features: 'matrix', neighbours: 'close', groups: 'group', age: 'domains' },
  hier: { network: 'net' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {}, vc = ctlOf(k, 'view'), o = vc && vc.options.find(x => x[0] === v), n = o ? String(o[1]).toLowerCase() : '';
  // the atlas with a section brought forward: the section alone, or beside the volcano or the curves
  if (k === 'atlas' && X.organ && atlasIdx(X.organ)) { if (VIEW.map.test(v) && c.focus) return 'focus'; if ((VIEW.volcano.test(v) || VIEW.curves.test(v)) && c.age) return 'age'; }
  // (the atlas's age camera is for the volcano beside a section; the volcano alone has its own)
  if (k === 'atlas' && v === 'age' && c.volcano) return 'volcano';
  for (const x of [v, al[v], n, al[n]]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the view on show in a set, by its key or its name
const viewIs = (k, re) => { const c = ctlOf(k, 'view'); if (!c) return false; const v = ctlValue(k, c), o = c.options.find(x => x[0] === v); return re.test(v) || !!(o && re.test(o[1])); };
// the views the panes ask for, by what they show
const VIEW = { lib: /lib/i, map: /^atlas$/i, umap: /tile|umap/i, volcano: /volcano|^age$/i, curves: /patho|curve/i, net: /net/i, contacts: /contact/i,
  section: /section/i, sAge: /^age$/i };
// the method's four steps and the slide's views that show them
const STEPS = [
  ['Tiles', /tile/i, () => `Each slide is cut into small squares: ${FACTS.tilesM} million tiles in all.`],
  ['Features', /feat/i, () => 'A deep-learning vision model describes each tile with a list of numbers, its features.'],
  ['Neighbours', /neigh/i, () => 'Each tile mixes in the features of the tiles around it (message passing), so it knows its surroundings.'],
  ['Domains', /group/i, () => 'Tiles with similar mixed features are grouped, across all slides: in a map of their features, alike tiles gather. A pathologist then names each group: a domain.'],
];
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
const afterUpdate = f => { NEXT.push(f); };
// the organ picked (X.organ: an organ's name, or one of its GTEx tissues'), and the worked examples' organs
const organOf = v => (v ? MD.organ(v) || tissueOrgan(v) : null);
const exOrgan = i => { const x = FACTS.ex[i]; return x && atlasIdx(x.tissue) ? (api('atlas').tissues || [])[atlasIdx(x.tissue) - 1] : null; };
// the worked example on show (-1 none): its section in the atlas with the age slider, or the gut's on the slide
const exOn = () => FACTS.ex.findIndex((x, i) => (exOrgan(i) ? X.scene === 'atlas' && X.organ === exOrgan(i) && viewIs('atlas', VIEW.map)
  : X.scene === 'slide' && viewIs('slide', VIEW.sAge) && X.domain === x.domain));

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  // the slide's tiles and domains lie on the tour's tissue section: wherever the slide shows, the section shows too
  if (k === 'slide') Object.assign(tg, GL.sets.tissue.params, { tissue_a: 1 });
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = isAge(ct) ? ageOpt(ct) : ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  const ag = ageF(), O = organOf(X.organ);
  tg.dots = 0; tg.dots_pick = 0;
  if (k === 'body') { tg.body_net = 0; tg.body_state = 0; tg.dots = 1; tg.dots_pick = O ? O.i + 1 : 0; }   // never the tour's own network or disease scan
  if (k === 'slide') { if (viewIs('slide', /age|domain/i)) tg.slide_age = ag; tg.slide_focus = X.domain ? slideIdx(X.domain) : 0; }
  if (k === 'atlas') { tg.atlas_focus = X.organ ? atlasIdx(X.organ) : 0; tg.atlas_age = ag; }
  if (k === 'hier') {
    const d = X.domain ? hierIdx(X.domain, 3) : -1, t = O && X.organ !== O.name ? hierIdx(X.organ, 1) : -1;
    tg.hier_focus = d >= 0 ? d : t >= 0 ? t : O ? hierIdx(O.name, 0) : X.kind ? hierIdx(X.kind, 2) : -1;
    tg.hier_age = ag;
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it or a set asks for stillness
  if (X.turn === 'on' && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets); here only the labels follow
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (k === 'tissue') k = 'slide';   // (the section is shown with the slide)
  if (!GL.sets[k] || !SCENES.some(s => s[0] === k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (!same) sfxAct('whoosh', k, null, { dur: 1.2 });   // (sound effects: another scene)
  if (fly && !same) flyTo(view(k, viewCam(k) || 'default'));
  renderAll();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // a view of one of the method's steps is that step
  if (k === 'slide' && key === 'view') { const i = STEPS.findIndex(s => viewIs('slide', s[1])); if (i >= 0) X.step = i + 1; }
  // a view has its own best camera
  if (key === 'view' && k === X.scene) { const n = camFor(k, v); flyTo(view(k, n || 'default')); }
  renderAll();
}
// a view of a set by what it shows (VIEW), its scene brought up
function showView(k, re) { if (X.scene !== k) openScene(k); const v = optKey(k, 'view', re); if (v && ctlValue(k, ctlOf(k, 'view')) !== v) setCtl(k, 'view', v); }
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
function flyNear(p, d) { if (p) flyTo([orbit.cur[0], orbit.cur[1], d, p[0], p[1], p[2]]); }

// --------------------------------------------------------------- actions --
// Each setter changes its own field only when called with ui false (a shared room's state arriving); picked by
// hand (ui true) it also brings up the scene and the view that show it.
// an organ, or one of its tissues (null none): its section comes forward in the atlas, it lights up in the network
// and in the body
function selectOrgan(v, ui = true) {
  const O = organOf(v);
  X.organ = O ? (MD.organ(v) ? O.name : (O.tissues.find(t => t.toLowerCase() === String(v).toLowerCase()) || O.name)) : null;
  if (X.organ) X.domain = null;
  if (ui && X.organ) {
    if (X.scene === 'body') afterUpdate(() => { if (X.organ && organOf(X.organ) === O) flyNear(O.pos, Math.min(orbit.cur[2], 1.6)); });
    else if (X.scene !== 'hier' || !viewIs('hier', VIEW.net)) { if (atlasIdx(X.organ)) { if (!(X.scene === 'atlas' && (viewIs('atlas', VIEW.volcano) || viewIs('atlas', VIEW.curves)))) showView('atlas', VIEW.map); flyTo(view('atlas', viewCam('atlas') || 'focus')); } }
  }
  if (ui && !X.organ && X.scene === 'atlas') flyTo(view('atlas', viewCam('atlas') || 'default'));   // (back from the section)
  if (ui && X.organ) sfxAct('pick', X.scene, X.scene === 'body' ? O.pos : null);   // (sound effects: an organ picked)
  pushState(); renderAll();
}
// a domain of the network (null none): it lights up in the network, and on the section if it is one of its domains
function selectDomain(v, ui = true) {
  const d = v ? MD.domain(v) : -1;
  X.domain = d >= 0 ? nodeName(d) : null;
  if (X.domain) { X.organ = null; X.kind = nodeName(MD.typeOfDomain(d)) || X.kind; }
  if (ui && X.domain && !(X.scene === 'slide' && slideIdx(X.domain))) showView('hier', VIEW.net);
  if (ui && X.domain) sfxAct('pick', X.scene, null);   // (sound effects: a domain picked)
  pushState(); renderAll();
}
// a tissue type: the Domains panes list its domains (this device's own choice, not shared)
function pickKind(v) { X.kind = MD.type(v) >= 0 ? nodeName(MD.type(v)) : null; renderAll(); }
// the age (20 to 70): the sections, the domains on the slide and the contacts follow it
function setAge(v, ui = false) {
  const a0 = X.age;
  X.age = Math.round(clamp(+v, AGE0, AGE1));
  // (sound effects: the slider moved by hand across a decade, a tone higher each decade)
  if (ui && Math.floor(a0 / 10) !== Math.floor(X.age / 10)) sfxAct('step', X.scene, null, { pitch: Math.pow(2, 2 * (Math.floor(X.age / 10) - 2) / 12) });
  // (moved by hand where nothing shows the age: the gut's example on the slide)
  if (ui && !(X.scene === 'slide' && viewIs('slide', /age|domain/i)) && !(X.scene === 'atlas' && X.organ && viewIs('atlas', VIEW.map)) && !(X.scene === 'hier' && viewIs('hier', VIEW.contacts))) showExample(FACTS.ex.findIndex((x, i) => !exOrgan(i)), false);
  syncAge();
}
// one of the method's four steps (1 to 4): the section with that step's view
function setStep(n, ui = true) {
  X.step = clamp(n | 0, 1, STEPS.length);
  if (ui) showView('slide', STEPS[X.step - 1][1]);
  if (ui) sfxAct('step', 'slide', null, { pitch: Math.pow(2, 2 * (X.step - 1) / 12) });   // (sound effects: the method's step, a tone higher each)
  renderAll();
}
// a worked example of change with age: its section in the atlas (or on the slide), at 70 unless asked otherwise
function showExample(i, to70 = true) {
  const x = FACTS.ex[i];
  if (!x) return;
  if (exOrgan(i)) { X.domain = null; X.organ = exOrgan(i); showView('atlas', VIEW.map); flyTo(view('atlas', viewCam('atlas') || 'focus')); }
  else { X.organ = null; const d = MD.domain(x.domain); X.domain = d >= 0 ? nodeName(d) : null; showView('slide', VIEW.sAge); }
  if (to70) X.age = AGE1;
  pushState(); renderAll();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls, the organ (or
// tissue), the domain, the age and the method's step. The tissue type listed in the Domains panes, the search and the
// camera are each person's own.
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
  return { tab: X.tab, scene: X.scene, ctl, organ: X.organ, domain: X.domain, age: X.age, step: X.step };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  // the scene and its controls; a view flies to its own camera as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  // then the picks (after the views, which may set the step: the room's step wins)
  if ((v.organ === null || (typeof v.organ === 'string' && organOf(v.organ))) && v.organ !== X.organ) selectOrgan(v.organ, false);
  if ((v.domain === null || (typeof v.domain === 'string' && MD.domain(v.domain) >= 0)) && v.domain !== X.domain) selectDomain(v.domain, false);
  if (Number.isInteger(v.age) && v.age >= AGE0 && v.age <= AGE1 && v.age !== X.age) setAge(v.age);
  if (Number.isInteger(v.step) && v.step >= 1 && v.step <= STEPS.length && v.step !== X.step) setStep(v.step, false);
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
// each organ's small 3D model (ORGAN3D, sets/organs.js) as a picture for the panes: drawn once at 64 px, shown at 20 to
// 30. The models and pictures build between frames from the start (updateSets), the ones a pane asks for first; until
// an organ's picture is drawn its chip keeps the place with a soft dot, and the picture goes in as it comes
// (fillOrganPics), so nothing is drawn again all at once
const orgPic = o => (o && ORGAN3D.idOf(o.name)) || null;
const ORG_DOT = 'radial-gradient(circle,rgba(255,158,196,.55) 0 22%,rgba(255,158,196,0) 46%)';
const iconImg = (o, px) => {
  const id = orgPic(o), u = id ? ORGAN3D.picUrl(id) : '', s = px || 22;
  return id ? `<span class="o3"${u ? '' : ` data-org="${id}"`} aria-hidden="true" style="display:inline-block;width:${s}px;height:${s}px;vertical-align:-6px;margin-right:5px;background:${u ? `url(${u})` : ORG_DOT} center/contain no-repeat"></span>` : '';
};
function fillOrganPics() {
  for (const el of document.querySelectorAll('span.o3[data-org]')) {
    const u = ORGAN3D.picUrl(el.dataset.org);
    if (u) { el.style.background = `url(${u}) center/contain no-repeat`; el.removeAttribute('data-org'); }
  }
}
const link = (act, v, text) => `<button type="button" data-act="${act}" data-v="${esc(v)}" style="border:0;background:none;padding:0;font:inherit;color:var(--cyan);text-decoration:underline;cursor:pointer">${text}</button>`;
let DQ = '';   // the Domains pane's search (this page's own)
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v, n = v !== undefined && v !== '' && !isNaN(+v) ? +v : v;
    ({
      organ: () => selectOrgan(organOf(v) && organOf(v) === organOf(X.organ) && MD.organ(v) ? null : v), tis: () => selectOrgan(v),
      domain: () => selectDomain(v === X.domain ? null : v), kind: () => { pickKind(v); if (X.tab !== 'domains') showTab('domains'); },
      ex: () => showExample(n), view: () => { const [k, r] = v.split(':'); showView(k, VIEW[r]); }, step: () => setStep(n),
      scene: () => openScene(v), ctl: () => setCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
    }[b.dataset.act] || (() => {}))();
  });
  // the age slider and the domains' search change in place, so a drag or typing is not cut short by a redraw
  $('#explore').addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.age !== undefined) setAge(+el.value, true);
    else if (el.id === 'domq') { DQ = el.value; filterDomains(); }
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
// a tab picked by hand brings up the scene it talks about (a shared room's tab arriving does not: its scene comes with it)
function pickTab(k) {
  showTab(k);
  if (k === 'organs' && X.scene === 'slide') { if (X.organ && atlasIdx(X.organ)) showView('atlas', VIEW.map); else openScene('body'); }
  if (k === 'domains' && X.scene !== 'hier' && !(X.scene === 'slide' && X.domain && slideIdx(X.domain))) showView('hier', VIEW.net);
  if (k === 'age' && !(exOn() >= 0 || (X.scene === 'atlas' && (viewIs('atlas', VIEW.volcano) || viewIs('atlas', VIEW.curves))) || (X.scene === 'hier' && viewIs('hier', VIEW.contacts)))) showView('atlas', VIEW.volcano);
  if (k === 'method') setStep(X.step);
}
function renderAll() { renderOrgans(); renderDomains(); renderAge(); renderMethod(); renderScenes(); updateExtraLabels(); }
function renderOrgans() {
  const pane = $('#pane-organs');
  if (!pane) return;
  const O = organOf(X.organ);
  let h = `<p class="sub">The ${FACTS.organs} organs whose tissue GTEx collected. Pick one: its section, its tissues and its place in the network.</p>
    <div class="chips">${MD.organs.map(o => chip(`data-act="organ" data-v="${esc(o.name)}"`, iconImg(o) + esc(o.name), O === o)).join('')}</div>`;
  if (O) {
    const tis = O.tissues.length ? O.tissues : [O.name], fd = figDomains(X.organ !== O.name ? X.organ : tis[0]);
    h += `<h3>${iconImg(O, 26)}${esc(O.name)}</h3>
      <p class="grp-h">${tis.length > 1 ? `Its ${word(tis.length)} tissues in GTEx: pick one to see its section` : 'One tissue in GTEx'}</p>
      <div class="chips">${tis.map(t => chip(`data-act="tis" data-v="${esc(t)}"`, esc(tisShort(t, O.name)), X.organ === t || (tis.length > 1 && X.organ === O.name && t === tis[0]), LEVEL_COL[1])).join('')}</div>
      <p class="grp-h">Its tissue types in the network</p>
      <div class="chips">${O.types.map(t => chip(`data-act="kind" data-v="${esc(nodeName(t))}"`, `${esc(cap(nodeName(t)))} <small>${MD.typeDomains(t).length}</small>`, false, LEVEL_COL[2])).join('')}</div>
      <p class="sub">The number is how many domains hang on that tissue type in the network (shared with other organs). Pick a type to see them.</p>
      ${fd.length ? `<p class="grp-h">Domains of ${esc(tisShort(X.organ !== O.name ? X.organ : tis[0], O.name))} in the talk's atlas (approximate share, read off the talk's figure)</p><div class="chips">${fd.map(d => (MD.domain(d.name) >= 0 ? chip(`data-act="domain" data-v="${esc(nodeName(MD.domain(d.name)))}"`, `${esc(cap(d.name))} <small>${shareTxt(d.share)}</small>`, false, domCol(d.name))
        : `<span class="empty" style="display:inline-flex;align-items:center;padding:6px 8px"><span class="sw" style="background:${swCol(domCol(d.name))};margin-right:6px"></span>${esc(cap(d.name))}&nbsp;<small>${shareTxt(d.share)}</small></span>`)).join('')}</div>` : ''}
      <p class="grp-h">Show it</p><div class="chips">${chip('data-act="view" data-v="atlas:map"', 'Its section', X.scene === 'atlas' && viewIs('atlas', VIEW.map))}${chip('data-act="view" data-v="hier:net"', 'In the network', X.scene === 'hier' && viewIs('hier', VIEW.net))}${chip('data-act="scene" data-v="body"', 'In the body', X.scene === 'body')}</div>`;
  } else h += '<p class="empty">Point at an organ\'s light in the body, a section in the atlas or a node of the network to pick it there.</p>';
  pane.innerHTML = h;
}
function renderDomains() {
  const pane = $('#pane-domains');
  if (!pane) return;
  const d = X.domain ? MD.domain(X.domain) : -1, t = d >= 0 ? MD.typeOfDomain(d) : -1;
  let h = `<p class="sub">The network's ${MD.domains.length} domains (as named in this map), by the tissue type they belong to. Pick one, or search.</p>`;
  if (d >= 0) {
    const org = t >= 0 ? MD.typeOrgans(t) : [], si = slideIdx(X.domain);
    h += `<h3><span class="sw" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${domCol(X.domain)};margin-right:8px"></span>${esc(cap(X.domain))}</h3>
      <dl class="stats"><dt>Tissue type</dt><dd style="font-size:16px">${t >= 0 ? link('kind', nodeName(t), esc(cap(nodeName(t)))) : '–'}</dd>
      <dt>Organs with it</dt><dd>${org.length}<small>organs have ${t >= 0 ? esc(nodeName(t)) : 'its tissue type'}; the network does not say which of them have this domain</small></dd></dl>
      <div class="chips">${org.map(o => chip(`data-act="organ" data-v="${esc(o.name)}"`, iconImg(o) + esc(o.name), false)).join('')}</div>
      <p class="grp-h">Show it</p><div class="chips">${chip('data-act="view" data-v="hier:net"', 'In the network', X.scene === 'hier')}${si ? chip('data-act="view" data-v="slide:sAge"', 'On the section', X.scene === 'slide') : ''}</div>`;
  }
  h += `<input type="search" id="domq" placeholder="Search the domains" aria-label="Search the domains" value="${esc(DQ)}" style="width:100%;margin:12px 0 4px;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--ink);font:inherit">
    <div id="domList">${MD.types.filter(x => MD.typeDomains(x).length).map(x => `<div data-grp><p class="grp-h"${X.kind === nodeName(x) ? ' style="color:var(--ink)"' : ''}><span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${LEVEL_COL[2]};margin-right:6px"></span>${esc(cap(nodeName(x)))}</p>
      <div class="chips">${MD.typeDomains(x).map(y => chip(`data-act="domain" data-v="${esc(nodeName(y))}" data-name="${esc(nodeName(y).toLowerCase())}"`, esc(cap(nodeName(y))), y === d, domCol(nodeName(y)))).join('')}</div></div>`).join('')}</div>
    <p class="note">Domain colours are the same in every scene. Point at a domain on the section or a node of the network to pick it there.</p>`;
  pane.innerHTML = h;
  filterDomains();
}
// the search: domains whose name holds it (and the groups that still hold any)
function filterDomains() {
  const q = DQ.trim().toLowerCase();
  document.querySelectorAll('#domList [data-grp]').forEach(g => {
    let any = false;
    g.querySelectorAll('[data-name]').forEach(b => { const on = !q || b.dataset.name.includes(q); b.style.display = on ? '' : 'none'; any = any || on; });
    g.style.display = any ? '' : 'none';
  });
}
function renderAge() {
  const pane = $('#pane-age');
  if (!pane) return;
  const F = FACTS, e = exOn(), exCol = ['#ff9ec4', '#ffd166', '#c77dff'];
  pane.innerHTML = `<p class="sub">Age is the strongest of ${F.donorVars} things known about the donors. ${pct(F.ageChange)} of domains change with it, mostly by less than ${pct(F.mostUnder)} per decade. Pick an example, or move the age.</p>
    <p class="grp-h">Worked examples</p><div class="chips">${F.ex.map((x, i) => chip(`data-act="ex" data-v="${i}"`, esc(exName(x)), e === i, exCol[i])).join('')}</div>
    ${e >= 0 ? `<p class="sub">${esc(cap(exText(F.ex[e])))}.</p>` : ''}
    <p class="grp-h">Age <b data-agev style="margin-left:auto;color:var(--ink)">${X.age}</b></p><input type="range" data-age min="${AGE0}" max="${AGE1}" step="1" value="${X.age}" aria-label="Age" style="accent-color:#ffb43b">
    <p class="grp-h">Across the body</p><div class="chips">${chip('data-act="view" data-v="atlas:volcano"', 'What changes', X.scene === 'atlas' && viewIs('atlas', VIEW.volcano))}${chip('data-act="view" data-v="atlas:curves"', 'Pathology', X.scene === 'atlas' && viewIs('atlas', VIEW.curves))}${chip('data-act="view" data-v="hier:contacts"', 'Contacts', X.scene === 'hier' && viewIs('hier', VIEW.contacts))}</div>
    <p class="note">${esc(F.connective)} ${esc(F.most)}${F.plaque ? ` ${esc(cap(F.plaque.kind))} ${esc(inOrgan(F.plaque.organ))} ${esc(F.plaque.note)}` : ''}${F.infarct ? `; ${esc(F.infarct.kind)} ${esc(inOrgan(F.infarct.organ))} ${esc(F.infarct.note)}` : ''}.</p>`;
}
// the age's readouts and slider, in place (a drag is not cut short)
function syncAge() {
  document.querySelectorAll('[data-agev]').forEach(el => { el.textContent = X.age; });
  document.querySelectorAll('input[data-age]').forEach(el => { if (document.activeElement !== el) el.value = X.age; });
}
function renderMethod() {
  const pane = $('#pane-method');
  if (!pane) return;
  const F = FACTS, s = STEPS[X.step - 1];
  pane.innerHTML = `<p class="sub">How ${esc(F.method)} finds domains in ${fmt(F.slides)} slides without being told what to look for, in four steps.</p>
    <div class="chips">${STEPS.map(([n], i) => chip(`data-act="step" data-v="${i + 1}"`, `${i + 1} · ${n}`, X.step === i + 1 && X.scene === 'slide')).join('')}</div>
    <h3>${X.step} · ${s[0]}</h3><p>${esc(s[2]())}</p>
    <div class="actions">${X.step > 1 ? chip(`data-act="step" data-v="${X.step - 1}"`, 'Back', false) : ''}${X.step < STEPS.length ? chip(`data-act="step" data-v="${X.step + 1}"`, 'Next', false) : ''}</div>
    <p class="grp-h">Then</p><div class="chips">${chip('data-act="view" data-v="atlas:umap"', 'The tiles in one map', X.scene === 'atlas' && viewIs('atlas', VIEW.umap))}${chip('data-act="view" data-v="atlas:map"', 'The atlas', X.scene === 'atlas' && viewIs('atlas', VIEW.map))}</div>
    <p class="note">It agrees with pathologists' notes: salivary gland r = ${F.bench.salivary.r}, stomach mucosa r = ${F.bench.stomach.r} (1 would be perfect). The result: ${F.domains} domains of ${F.types} types.</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${ageHere() ? `<p class="grp-h">Age <b data-agev style="margin-left:auto;color:var(--ink)">${X.age}</b></p><input type="range" data-age min="${AGE0}" max="${AGE1}" step="1" value="${X.age}" aria-label="Age" style="accent-color:#ffb43b">` : ''}
    ${X.organ && X.scene !== 'slide' && !contactsOn() ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(X.organ)} (Organs tab).</p>` : X.domain && !contactsOn() ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(cap(X.domain))} (Domains tab).</p>` : ''}`;
}
// a share read off the talk's figure, by eye: under half a percent is shown as <1%
const shareTxt = f => (f * 100 < 0.5 ? '&lt;1%' : Math.round(f * 100) + '%');
// the network's contacts: one organ's own contact network (the hier set's Organ control), not the organ or domain picked
const contactsOn = () => X.scene === 'hier' && viewIs('hier', VIEW.contacts);
// the scene on show changes with the age (the slider belongs with it)
const ageHere = () => (X.scene === 'slide' && viewIs('slide', /age|domain/i)) || (X.scene === 'atlas' && !!X.organ && viewIs('atlas', VIEW.map)) || (X.scene === 'hier' && viewIs('hier', VIEW.contacts));
// labels the panes add (the sets label their own picks: the atlas names its focused section, the network its focused node)
let XL = null;
function updateExtraLabels() {
  const O = organOf(X.organ), sig = [APP.mode, X.scene, X.organ].join('|');
  if (sig === XL) return;
  XL = sig;
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  if (APP.mode !== 'explore') return;
  // the organ picked, at its point in the body
  if (X.scene === 'body' && O) LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(O.name)}</b>`, 'mag'), set: 'body', at: O.pos.slice(), o: -1, txt: [O.name, '', 'mag'] });
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { organ } (an organ or one of its
// tissues), { domain }, { kind } (a tissue type) or { sdom } (a domain of the section not in the network), or null
function pickWith(rc) {
  if (APP.mode !== 'explore') return null;
  const k = X.scene;
  if (k === 'body') { const i = GL.dots.pick(rc); return i >= 0 ? { organ: MD.organs[i].name } : null; }
  const A = api(k);
  if (!A.pick) return null;
  let r = -1;
  try { r = A.pick(rc); } catch (e) { return null; }
  if (!(r >= 0)) return null;
  if (k === 'atlas') { const t = (A.tissues || [])[r]; return t && organOf(t) ? { organ: t } : null; }
  if (k === 'hier') {
    const n = (A.nodes || [])[r];
    if (!n) return null;
    if (n.level === 3) { const d = MD.domain(n.name); return d >= 0 ? { domain: nodeName(d) } : null; }
    if (n.level === 2) return MD.type(n.name) >= 0 ? { kind: nodeName(MD.type(n.name)) } : null;
    return organOf(n.name) ? { organ: n.name } : null;
  }
  if (k === 'slide') { const d = slideDomain(r); return d ? { domain: d } : (A.domains || [])[r] ? { sdom: A.domains[r] } : null; }
  return null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null (then where the ray meets the scene)
function pickPos(p) {
  if (p && p.organ && X.scene === 'body') { const O = organOf(p.organ); return O ? O.pos.slice() : null; }
  return null;
}
const pickText = p => (p.organ ? (MD.organ(p.organ) ? [p.organ, 'organ'] : [tisShort(p.organ, organOf(p.organ).name), `tissue of the ${organOf(p.organ).name.toLowerCase()}`])
  : p.domain ? [cap(p.domain), nodeName(MD.typeOfDomain(MD.domain(p.domain))) || 'domain'] : p.kind ? [cap(p.kind), 'tissue type'] : [cap(p.sdom), 'on this section']);
function choosePick(p) {
  if (!p) return;
  if (p.organ) { if (X.tab !== 'organs') showTab('organs'); selectOrgan(p.organ === X.organ ? null : p.organ, false); }
  else if (p.domain) { if (X.tab !== 'domains') showTab('domains'); selectDomain(p.domain === X.domain ? null : p.domain, false); }
  else if (p.kind) { showTab('domains'); pickKind(p.kind); }
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
// A/X plays and pauses the story. Hand tracking: point and pinch.
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
// The shell's headset settings, the same for everyone in a shared room (HOST.xr; read every frame, and a shell
// without them means labels on top and nothing free): the scene's small labels 'face' (on top: sprites turned to you,
// over everything), 'fixed' (in 3D: upright signs in the scene, turned to you) or 'hidden'; the cards (the story panels
// here, the station cards and name tags in the shell) the same three ways, independent of the labels (a shell without
// them: as the labels); free moving holds what the grip takes like a real object.
const xrLabelMode = () => (HOST.xr && HOST.xr.labels ? HOST.xr.labels() : 'face');
const xrCardMode = () => (HOST.xr && HOST.xr.cards ? HOST.xr.cards() : xrLabelMode());
const xrFreeOn = () => !!(HOST.xr && HOST.xr.free && HOST.xr.free());
const xrSig = () => (HOST.xr && HOST.xr.sig ? HOST.xr.sig() : '') + (HOST.panels && HOST.panels.sig ? HOST.panels.sig(XR_HERE) : '');
// this story's panels in a headset (the shell's HOST.panels, each story its own; at a station in a shared room the
// station's, for everyone at that circle): 'shown', 'controls' (only the foot bar) or 'hidden' (neither: A or X still
// plays); a shell without it: shown
const xrPanels = () => (HOST.panels && HOST.panels.get ? HOST.panels.get(XR_HERE) : 'shown');
// a headset in a shared room (the shell's HOST.room): no Stories screen there, a story runs only at its station (reached
// by walking into its circle), and away from one it is hidden, not pointable, paused and silent. A shell without
// HOST.room.away: as before (only at a station is the story the station's)
const xrRoomOnly = () => !!(HOST.room && HOST.room.away && HOST.room.inRoom());
const xrAway = () => !!(HOST.room && HOST.room.away && HOST.room.away());
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
// the organ, tissue or domain a controller points at, labelled where the ray meets it
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

// ---------------------------------------------------- picking an organ --
// The organ, tissue or domain a ray points at in explore mode (see pickWith), or null
const _prc = new THREE.Raycaster();
function pickRay(o, d) {
  if (APP.mode !== 'explore') return null;
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
      // (a soft click at the button, unless the press made a sound of its own: the shell's rule for page buttons)
      if (r && r.id === p.id && r.fn) { buzz(c); const n = sfxN(); r.fn(); if (sfxN() === n) sfxPlay('click', 'world', h.point); }
    }
  } else if (!p.moved && p.pk) { buzz(c); xrClickPick(p.pk); }
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
  if (HOST.anchor.locked(G.target === 'panel' ? 'panel' : 'globe')) { c.grab = null; return; }   // locked meanwhile (a shared room's story lock: Lock this story)
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
  else if (xrAway()) hit = null;   // away from its station in a shared room: nothing of the story to point at
  else if (hs.length) {
    const h = hs[0], P = XR.panels.find(q => q.mesh === h.object);
    hit = { kind: 'panel', P, x: h.uv.x * P.w, y: (1 - h.uv.y) * P.h, point: h.point };
    dist = h.distance;
  } else if (!XR.stories) {
    // the scene counts as a ball around the view's target; an organ or a domain counts if the ray passes close
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    _xc.copy(oL).sub(XR.target);
    const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const pk = pickRay(c.o, c.d);
    if (t > 0 || pk) {
      // an organ's point is marked where it is; else the ball's surface
      const q = pk ? pickPos(pk) : null;
      if (q) _xp.set(q[0], q[1], q[2]).applyMatrix4(GL.sets[X.scene].group.matrixWorld);
      else _xp.copy(dL).multiplyScalar(t > 0 ? t : Math.max(0, _xc.copy(XR.target).sub(oL).dot(dL))).add(oL).applyMatrix4(GL.world.matrixWorld);
      hit = { kind: 'globe', i: -1, pk, point: _xp.clone() };
      dist = c.o.distanceTo(_xp);
    }
  }
  c.hover = hit;
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu)
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
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
    // in a shared room no Stories screen: a story is reached by walking into its station's circle, and at its station it
    // is the station's (a shell without HOST.room.away: only there); leaving the room brings it back, as for a new wearer
    const roomOnly = xrRoomOnly();
    if (XR.inRoom && !roomOnly) xrFreshStart();
    XR.inRoom = roomOnly;
    if (XR.stories && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();
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
  // away from its station in a shared room the story waits, silent (hidden in xrUpdate, not pointable in xrPoint); a
  // pause made here is not the room's (the shell takes no clock or state from a headset that is not at a station)
  if (xrAway()) { APP.playing = false; SLIDE.tail = null; }
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
  const land = !!XR.stories, away = xrAway();   // (away from its station in a shared room: the story hidden, only the shell's things)
  if (XR.land) {
    if (XR.landRev !== HOST.listRev) xrLandingCards();   // a story added while the app runs: its card joins the arc
    // Sound check takes the place of the story cards while it is open
    for (const P of XR.land) P.mesh.visible = land && (P === XR.land[0] || !XR.soundCheck);
    XR.snd.mesh.visible = land && !!XR.soundCheck;
    // cards hidden: no story panel at all, in story and explore mode (the Stories screen, the shell's menu and its
    // clock stay, and A or X still plays); cards in 3D: the panels stand in the scene, as the labels' signs do (the
    // labels have their own setting). And this story's panels (xrPanels): controls only keeps just the foot bar, hidden
    // neither
    const pm = xrPanels(), pv = !land && !away && XR.cm !== 'hidden';
    XR.main.mesh.visible = pv && pm === 'shown';
    XR.foot.mesh.visible = pv && pm !== 'hidden';
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
    if (!story) placeLabelXR(L, 1, S);
    else hideLabelXR(L);
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
  XR.free = xrFreeOn(); XR.lm = xrLabelMode(); XR.cm = xrCardMode();   // (as the shell has them: nothing to turn off or on at the first frame)
  document.body.classList.add('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  XR.clear = !(XR.session.environmentBlendMode && XR.session.environmentBlendMode !== 'opaque') && XR.mode !== 'immersive-ar';
  applyTheme();
  GL.stars.visible = XR.clear;
  GL.stars.material.size = 2.2;
  for (const P of XR.panels) { P.mesh.visible = true; P.last = ''; }
  XR.kbd.open = false;
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
  // in a shared room the story and its place stay (at its station the room's clock and state go on applying; away from
  // one a new wearer walks up to a station: no Stories screen in a room)
  if (HOST.collab.mine() || xrRoomOnly()) { lastNow = 0; return; }
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
  // keep the scene and the panel where they were in the story before
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
  const away = xrAway();   // (asked while the session is still the shell's)
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
  // left the headset from the Stories screen, or away from a station in a shared room (its story hidden and paused
  // there): back to the Stories screen on the page
  if (XR.stories || away) { XR.stories = false; HOST.openPicker(); }
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
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.organ, X.domain, X.age, X.step, X.kind, GL.orgV || 0].join('|');
}
const XR_HERE = 'micro';
const XR_STORIES = HOST.list;
// ------------------------------------------------------- headset landing --
// The Stories screen in the headset: a title panel and one card per story,
// floating in an arc in front of you while the story itself is hidden.
function xrLandingSetup() {
  XR.land = [];
  XR.landGroup = new THREE.Group();
  GL.rig.add(XR.landGroup);
  const head = makePanel(1400, 300, 1.02, drawLandHead, () => 'h' + XR.inStory + audioLabel() + HOST.repeat + XR.soundCheck + HOST.audio.muted + HOST.anchor.status() + HOST.list.length);
  head.mesh.position.set(0, 0.36, -1.22);
  XR.landGroup.add(head.mesh); XR.land.push(head); XR.panels.push(head);
  xrLandingCards();
  // Sound check (opened from the header), in the place of the story cards
  XR.snd = makePanel(1400, 860, 1.02, drawSoundCheck, () => (XR.snd.mesh.visible ? 'snd' + Math.floor(performance.now() / 500) : 'off'));
  XR.snd.mesh.position.set(0, -0.17, -1.2);
  XR.landGroup.add(XR.snd.mesh); XR.panels.push(XR.snd);
  XR.panelMeshes = XR.panels.map(P => P.mesh);
}
// One card per story, 0.36 m wide, on an arc for any number of stories: neighbours 0.381 m apart and the outer ones at
// most 62° to the side (fifteen: 0.155 rad apart at 2.46 m), never nearer than 1.25 m (a few stories stand closer
// together in angle). Built again when the shell's list of stories changes while the app runs (HOST.listRev: a story
// added in a release gets its card)
function xrLandingCards() {
  for (const P of XR.land.splice(1)) {
    XR.landGroup.remove(P.mesh); XR.panels.splice(XR.panels.indexOf(P), 1);
    P.tex.dispose(); P.mesh.geometry.dispose(); P.mesh.material.dispose();
  }
  const n = HOST.list.length, d = Math.max(1.25, n > 1 ? 0.1905 / Math.sin(1.085 / (n - 1)) : 0), step = 2 * Math.asin(0.1905 / d);
  XR.landRev = HOST.listRev;
  HOST.list.forEach((s, k) => {
    const a = (k - (n - 1) / 2) * step;
    const P = makePanel(640, 820, 0.36, (ctx, P) => drawLandCard(ctx, P, s), () => 'c' + XR.inStory + s.key);
    P.mesh.position.set(Math.sin(a) * d, -0.105, -Math.cos(a) * d);   // top edge 0.126 m up, under the header
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
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
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
  if (HOST.anchor.on) hb('again', 'Place again', xrRecenterAsk, 210, { px: 27 });
  else hb('recenter', 'Recenter', xrRecenterAsk, 170, { px: 27 });
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
  if (!HOST.anchor.on) hb('recenter', 'Recenter', xrRecenterAsk, 140); // anchored: nothing moves
  // in a shared room no Stories button: each station keeps its story, and another story is another station (walk into
  // its circle)
  if (!(HOST.room && HOST.room.placing()) && !xrRoomOnly()) hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  // the story's name, smaller when the buttons leave it less room
  fitTitle(ctx, 'Tissue and time', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
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
  ({ organs: drawOrgansPane, domains: drawDomainsPane, age: drawAgePane, method: drawMethodPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// buttons that wrap like the HTML chips: items -> { id, label, on, col, icon (an organ's model: ORGAN3D id), fn }
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
    if (it.icon) {   // (its picture, or a soft dot while it is drawn)
      const c = ORGAN3D.pic(it.icon), q = h - 8;
      if (c) ctx.drawImage(c, cx + 7, cy + 4, q, q);
      else { ctx.beginPath(); ctx.arc(cx + 7 + q / 2, cy + 4 + q / 2, q * 0.16, 0, 7); ctx.fillStyle = 'rgba(255,158,196,0.6)'; ctx.fill(); }
    }
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
// the age slider with its readout (20 to 70)
function drawAge(ctx, P, x, y, W) {
  ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle'; ctx.fillText('Age', x, y + 25);
  ctx.font = vfont(26, 700); ctx.textAlign = 'right'; ctx.fillText(String(X.age), x + W, y + 25); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  vSlider(ctx, P, 'age', x + 80, y, W - 160, X.age, AGE0, AGE1, VC.amber, v => setAge(v, true));
  return 60;
}
function drawOrgansPane(ctx, P, x, y, W, bottom) {
  const O = organOf(X.organ);
  y += flow(ctx, P, MD.organs.map(o => ({ id: 'org:' + o.name, label: o.name, icon: orgPic(o), on: O === o, fn: () => selectOrgan(O === o ? null : o.name) })), x, y, W, bottom, { px: 20, h: 42 }) + 18;
  if (!O) { textBlock(ctx, `The ${FACTS.organs} organs whose tissue GTEx collected. Pick one, or point at an organ's light in the body, a section in the atlas or a node of the network and pull the trigger (or pinch).`, x, y, W, 26, 38, VC.muted); return; }
  const oi = orgPic(O), oc = oi && ORGAN3D.pic(oi);
  if (oc) ctx.drawImage(oc, x - 4, y - 6, 58, 58);
  y += textBlock(ctx, O.name, x + (oc ? 60 : 0), y + 2, W - 60, 38, 46, VC.ink, 700, 1) + 10;
  const tis = O.tissues.length ? O.tissues : [O.name];
  y += head(ctx, x, y, tis.length > 1 ? `Its ${word(tis.length)} tissues in GTEx: pick one to see its section` : 'One tissue in GTEx');
  y += flow(ctx, P, tis.map(t => ({ id: 'tis:' + t, label: tisShort(t, O.name), col: LEVEL_COL[1], on: X.organ === t || (tis.length > 1 && X.organ === O.name && t === tis[0]), fn: () => selectOrgan(t) })), x, y, W, bottom, { px: 21, h: 44 }) + 14;
  y += head(ctx, x, y, 'Its tissue types in the network (domains on each)');
  y += flow(ctx, P, O.types.map(t => ({ id: 'kind:' + t, label: `${cap(nodeName(t))} · ${MD.typeDomains(t).length}`, col: LEVEL_COL[2], fn: () => { pickKind(nodeName(t)); showTab('domains'); } })), x, y, W, bottom, { px: 21, h: 44 }) + 14;
  if (y + 100 > bottom) return;
  y += head(ctx, x, y, 'Show it');
  flow(ctx, P, [{ id: 'sh:map', label: 'Its section', on: X.scene === 'atlas' && viewIs('atlas', VIEW.map), fn: () => showView('atlas', VIEW.map) },
    { id: 'sh:net', label: 'In the network', on: X.scene === 'hier' && viewIs('hier', VIEW.net), fn: () => showView('hier', VIEW.net) },
    { id: 'sh:body', label: 'In the body', on: X.scene === 'body', fn: () => openScene('body') }], x, y, W, bottom, { px: 22, h: 50 });
}
function drawDomainsPane(ctx, P, x, y, W, bottom) {
  const d = X.domain ? MD.domain(X.domain) : -1, td = d >= 0 ? MD.typeOfDomain(d) : -1;
  // the tissue type listed: the one picked here, else the domain's
  const kinds = MD.types.filter(t => MD.typeDomains(t).length), kt = X.kind && MD.type(X.kind) >= 0 ? MD.type(X.kind) : td >= 0 ? td : kinds[0];
  y += head(ctx, x, y, 'Tissue types: pick one, then a domain');
  y += flow(ctx, P, kinds.map(t => ({ id: 'kind:' + t, label: cap(nodeName(t)), col: LEVEL_COL[2], on: t === kt, fn: () => pickKind(nodeName(t)) })), x, y, W, bottom, { px: 20, h: 42 }) + 16;
  y += head(ctx, x, y, `${cap(nodeName(kt))}: its ${MD.typeDomains(kt).length} domains in this map`);
  y += flow(ctx, P, MD.typeDomains(kt).map(j => ({ id: 'dom:' + j, label: cap(nodeName(j)), col: domCol(nodeName(j)), on: j === d, fn: () => selectDomain(j === d ? null : nodeName(j)) })), x, y, W, bottom - 220, { px: 20, h: 42 }) + 18;
  if (d < 0) { textBlock(ctx, 'Or point at a domain on the section or a node of the network and pull the trigger (or pinch).', x, y, W, 24, 34, VC.muted, 400, 2); return; }
  ctx.fillStyle = VC.line; ctx.fillRect(x, y, W, 2); y += 14;
  swatch(ctx, x, y + 10, 26, domCol(X.domain));
  y += textBlock(ctx, cap(X.domain), x + 40, y + 2, W - 40, 34, 42, VC.ink, 700, 1) + 6;
  const org = td >= 0 ? MD.typeOrgans(td) : [];
  y += textBlock(ctx, td >= 0 ? `Tissue type: ${nodeName(td)}. ${org.length} organs have ${nodeName(td)}; the network does not say which of them have this domain: ${listOf(org.map(o => o.name))}.` : 'Tissue type: –.', x, y, W, 22, 30, VC.muted, 400, clamp(Math.floor((bottom - y - 70) / 30), 3, 5)) + 10;   // (the organs' list as far as there is room)
  const si = slideIdx(X.domain);
  flow(ctx, P, [{ id: 'sh:net', label: 'In the network', on: X.scene === 'hier', fn: () => showView('hier', VIEW.net) }].concat(si ? [{ id: 'sh:slide', label: 'On the section', on: X.scene === 'slide', fn: () => showView('slide', VIEW.sAge) }] : []), x, y, W, bottom, { px: 22, h: 50 });
}
function drawAgePane(ctx, P, x, y, W, bottom) {
  const F = FACTS, e = exOn(), exCol = ['#ff9ec4', '#ffd166', '#c77dff'];
  y += textBlock(ctx, `Age is the strongest of ${F.donorVars} things known about the donors. ${pct(F.ageChange)} of domains change with it, mostly by less than ${pct(F.mostUnder)} per decade.`, x, y, W, 24, 33, VC.muted, 400, 3) + 12;
  y += head(ctx, x, y, 'Worked examples');
  y += flow(ctx, P, F.ex.map((q, i) => ({ id: 'ex:' + i, label: exName(q), col: exCol[i], on: e === i, fn: () => showExample(i) })), x, y, W, bottom, { px: 22, h: 50 }) + 10;
  if (e >= 0) y += textBlock(ctx, cap(exText(F.ex[e])) + '.', x, y, W, 23, 32, VC.ink, 400, 3) + 10;
  y += drawAge(ctx, P, x, y, W) + 14;
  y += head(ctx, x, y, 'Across the body');
  y += flow(ctx, P, [{ id: 'v:volcano', label: 'What changes', on: X.scene === 'atlas' && viewIs('atlas', VIEW.volcano), fn: () => showView('atlas', VIEW.volcano) },
    { id: 'v:curves', label: 'Pathology', on: X.scene === 'atlas' && viewIs('atlas', VIEW.curves), fn: () => showView('atlas', VIEW.curves) },
    { id: 'v:contacts', label: 'Contacts', on: X.scene === 'hier' && viewIs('hier', VIEW.contacts), fn: () => showView('hier', VIEW.contacts) }], x, y, W, bottom, { px: 22, h: 50 }) + 16;
  if (y + 70 < bottom) textBlock(ctx, `${F.connective} ${F.most}`, x, y, W, 21, 29, VC.faint, 400, 3);
}
function drawMethodPane(ctx, P, x, y, W, bottom) {
  const F = FACTS, s = STEPS[X.step - 1];
  y += textBlock(ctx, `How ${F.method} finds domains in ${fmt(F.slides)} slides without being told what to look for, in four steps.`, x, y, W, 24, 33, VC.muted, 400, 2) + 14;
  const sw = (W - 3 * 12) / 4;
  STEPS.forEach(([n], i) => vButton(ctx, P, 'step:' + i, x + i * (sw + 12), y, sw, 60, `${i + 1} · ${n}`, () => setStep(i + 1), { on: X.step === i + 1 && X.scene === 'slide', px: 22 }));
  y += 84;
  y += textBlock(ctx, `${X.step} · ${s[0]}`, x, y, W, 38, 46, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, s[2](), x, y, W, 27, 38, VC.ink, 400, 4) + 18;
  if (X.step > 1) vButton(ctx, P, 'step:back', x, y, 160, 56, 'Back', () => setStep(X.step - 1), { px: 23 });
  if (X.step < STEPS.length) vButton(ctx, P, 'step:next', x + 172, y, 160, 56, 'Next', () => setStep(X.step + 1), { px: 23 });
  y += 80;
  y += head(ctx, x, y, 'Then');
  y += flow(ctx, P, [{ id: 'v:umap', label: 'The tiles in one map', on: X.scene === 'atlas' && viewIs('atlas', VIEW.umap), fn: () => showView('atlas', VIEW.umap) },
    { id: 'v:map', label: 'The atlas', on: X.scene === 'atlas' && viewIs('atlas', VIEW.map), fn: () => showView('atlas', VIEW.map) }], x, y, W, bottom, { px: 22, h: 50 }) + 18;
  if (y + 70 < bottom) textBlock(ctx, `It agrees with pathologists' notes: salivary gland r = ${F.bench.salivary.r}, stomach mucosa r = ${F.bench.stomach.r} (1 would be perfect). The result: ${F.domains} domains of ${F.types} types.`, x, y, W, 21, 29, VC.faint, 400, 3);
}
// the four scenes, and the chosen scene's own controls (and the age, where the scene shows it)
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, SCENE_SHORT[k] || n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene);
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  if (ageHere() && y + 70 < bottom) drawAge(ctx, P, x, y, W);
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
// Optional voice-over: put an MP3 at audio/narration-micro.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-micro.mp3', {
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
    let best = 'atlas', ba = 0;
    for (const k of SET_ORDER) { const a = Math.max(S[k + '_a'], 0.9 * S2[k + '_a']); if (a > ba + 0.01) { ba = a; best = k; } }
    if (best === 'tissue') best = 'slide';   // (the section is shown with the slide)
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
        for (const c2 of s.controls || []) c[c2.key] = c2 === ct ? v : isAge(c2) ? ageOpt(c2) : ctlValue(best, c2);
        const tg = s.explore ? s.explore(c) : {};
        let d = 0;
        for (const n in tg) if (n in S && !n.endsWith('_a') && !/_age$|_focus$/.test(n)) d += (tg[n] - S[n]) ** 2;
        if (d < bd) { bd = d; bo = v; }
      }
      X.ctl[best][ct.key] = bo;
    }
    // (a set that remembers what it showed last is told the chosen controls, long settled, twice)
    if (s.explore) { const c = { t: 1e3 }; for (const c2 of s.controls || []) c[c2.key] = isAge(c2) ? ageOpt(c2) : ctlValue(best, c2); s.explore(c); s.explore(c); }
    // the story's picks carry over to the panes: the section's domain, the atlas's tissue, the age
    X.organ = null; X.domain = null; X.kind = null;
    const ag = best === 'atlas' ? S.atlas_age : best === 'slide' ? S.slide_age : best === 'hier' ? S.hier_age : 0;
    X.age = Math.round(AGE0 + clamp(ag || 0, 0, 1) * (AGE1 - AGE0));
    if (best === 'atlas' && S.atlas_focus > 0.5 && S.atlas_map > 0.5) { const t = (api('atlas').tissues || [])[Math.round(S.atlas_focus) - 1]; if (t && organOf(t)) X.organ = t; }
    if (best === 'slide' && S.slide_focus > 0.5) { const d = slideDomain(Math.round(S.slide_focus) - 1); if (d) X.domain = d; }
    if (best === 'hier' && S.hier_focus > -0.5) { const n = (api('hier').nodes || [])[Math.round(S.hier_focus)]; if (n && n.level === 2) X.kind = n.name; }
    // (the section's domains as the story showed them: at an age, or by themselves)
    if (best === 'slide' && S.slide_domain > 0.5) { const v = optKey('slide', 'view', S.slide_age > 0.02 ? VIEW.sAge : /domain/i); if (v) X.ctl.slide.view = v; }
    if (best === 'slide') { const i = STEPS.findIndex(q => viewIs('slide', q[1])); if (i >= 0) X.step = i + 1; }
    X.tab = best === 'slide' ? (viewIs('slide', /age/i) ? 'age' : viewIs('slide', /domain/i) ? 'domains' : 'method')
      : best === 'atlas' ? (X.organ && exOn() >= 0 || viewIs('atlas', VIEW.volcano) || viewIs('atlas', VIEW.curves) ? 'age' : viewIs('atlas', VIEW.umap) ? 'method' : 'organs')
      : best === 'hier' ? (viewIs('hier', VIEW.contacts) ? 'age' : 'domains') : 'organs';
    // from the last chapter (the story's end, or its Explore button): the atlas, in the Organs tab
    if (ts >= C.next.a) openStart();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: no picked organ or domain
    X.organ = null; X.domain = null; NEXT.length = 0; pushState();
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start: the atlas, a section per tissue, in the Organs tab
function openStart() {
  openScene('atlas', false);
  const v = optKey('atlas', 'view', VIEW.map);
  if (v) (X.ctl.atlas = X.ctl.atlas || {}).view = v;
  X.tab = 'organs'; showTab('organs');
  orbit.cur = view('atlas', viewCam('atlas') || 'default'); orbit.to = null;
  renderAll();
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
  const was = APP.mode === 'story' && APP.playing;   // (sound effects: the story was playing as the frame began)
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
  }
  slideStep(t0);   // slideshow: the story waits at the end of each chapter
  sfxStep(was, dt);   // sound effects: the cues the clock crossed, the spans it is in, the live sounds
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
    const vn = viewCam(X.scene) || 'default', fs = fitShift(X.scene, vn), ke = 1 - Math.exp(-dt * 3);
    GL.nf += (narrowOf(X.scene, vn) - GL.nf) * ke;
    for (let i = 0; i < 3; i++) EXV[7 + i] += (fs[i] - EXV[7 + i]) * ke;
    orbitStep(xr ? pn : now);
    for (let i = 0; i < 6; i++) EXV[i] = orbit.cur[i];
    if (xr) xrPlace(orbit.cur); else { applyCamera(EXV); keepCamera(S, null); }
  }
  K.U.uTime.value = tSet;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  updateSets(S, tSet, dt, APP.mode === 'story');
  // what explore mode asked to do once the sets show its pick (a flight to an organ's point)
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
    }],
    ['Setting up explore mode', () => { buildExplore(); bindCanvas(); }],
    ['Making the headset panels', () => { audioInit(); xrSetup(); LOAD.done = true; initEnd(); }]);
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
    // #micro&explore&scene=atlas&view=volcano (any control of a scene by its key, or an option by its name or camera),
    // &tab=organs|domains|age|method|scenes, &organ=Ovary (an organ or one of its GTEx tissues), &domain=submucosa,
    // &age=70, &step=2 (the method's step), &example=0 (a worked example of change with age)
    const sc = hp.get('scene');
    if (sc && GL.sets[sc]) { openScene(sc, false); showTab('scenes'); }
    else if (!hp.has('t')) openStart();   // straight in: the atlas
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    for (const c of ctlsOf(X.scene)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.options.find(([v, n]) => v.toLowerCase() === q || String(n).toLowerCase() === q || camFor(X.scene, v) === q || (CAM_ALIAS[X.scene] || {})[v] === q);
      if (o) setCtl(X.scene, c.key, o[0]);
    }
    if (organOf(hp.get('organ'))) { showTab('organs'); selectOrgan(hp.get('organ')); }
    if (hp.get('domain') && MD.domain(hp.get('domain')) >= 0) { showTab('domains'); selectDomain(hp.get('domain')); }
    if (hp.get('example') !== null && FACTS.ex[+hp.get('example')]) { showTab('age'); showExample(+hp.get('example')); }
    if (hp.get('age') && Number.isFinite(+hp.get('age'))) setAge(+hp.get('age'));
    if (hp.get('step') && Number.isFinite(+hp.get('step'))) { showTab('method'); setStep(+hp.get('step')); }
    if (hp.get('tab') && TABS.some(t => t[0] === hp.get('tab'))) {
      if (sc || hp.get('organ') || hp.get('domain') || hp.get('step')) showTab(hp.get('tab')); else pickTab(hp.get('tab'));
    }
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
    renderAll();
  }
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  LOAD.t = setTimeout(() => $('#loading').classList.add('gone'), 120);   // (dispose clears it: a story picked meanwhile keeps its loading screen)
}
LOAD.t = setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  caption: xrCaption,
  recenter: xrRecenterAsk,
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the explore panes, and there are no effects
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: v => { SFXQ.quiet++; try { return collabApply(v); } finally { SFXQ.quiet--; } }, view: collabView, setView: collabSetView,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
  },
  // for tests and the browser console: HOST.cur.peek('NET.N')
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
