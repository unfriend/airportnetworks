// The design room: a table standing in the room with a small low-poly model of every prop (3D set) of the stories, in
// groups by story, and a stage where the one you pick stands bigger and turns, its card on the panel: what it shows,
// its size and frame, its params, its named views, what reuses it and its source. Not one of the stories: no
// narration and no chapters, it opens straight into the table.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/design/build.mjs from the tour's kit, the engine (adapted from the flock's) and the table set in
// tools/design, and the cards from tools/design/props.json: edit those, not this file. The models are lowpoly.js's.
HOST.register('design', function (HOST) {
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

// ================================================================= CARDS ==
// The props' cards, generated by tools/design/build.mjs from tools/design/props.json and the miniatures' names: by
// miniature key, { story, set, name, tris, id, shows, size, frame, params: [[name, range, meaning, step]], views:
// [[name, what it frames]], reusedBy, reuses, file, manifest, note }
const DESIGN_CARDS = {
  "lbi.int": {"story":"lbi","set":"int","name":"Interactome","tris":1198,"id":"lbi/int","shows":"A big glowing human protein interaction network (about 9,100 proteins, 22,100 interactions) with a dense centre and filaments towards the rim. The story lights curated pathways, the ATP synthase complex, flattens it into a city map with pins and a route, shows disease modules, a rare disease and its drug target, 173 immunity genes in 19 clusters, drug capsules and heat spreading from three seeds.","size":"radius ~1","frame":"Centred on the origin, y up, about radius 1 (city mode flattens it onto a disc of radius 1.12). Views are [az, el, dist, tx, ty, tz].","params":[["int_a","0..1","the set's fade, 0 hidden to 1 shown",0],["int_reveal","0..1","the network grows from the centre out, with a bright growth front",0],["int_edges","0..1","interaction brightness",0],["int_dim","0..1","dims everything that is not highlighted",0],["int_path0","0..1","curated module k lights up in its own colour",0],["int_path1","0..1","curated module k lights up in its own colour",0],["int_path2","0..1","curated module k lights up in its own colour",0],["int_path3","0..1","curated module k lights up in its own colour",0],["int_path4","0..1","curated module k lights up in its own colour",0],["int_path5","0..1","curated module k lights up in its own colour",0],["int_path6","0..1","curated module k lights up in its own colour",0],["int_path7","0..1","curated module k lights up in its own colour",0],["int_path8","0..1","curated module k lights up in its own colour",0],["int_path9","0..1","curated module k lights up in its own colour",0],["int_atp","0..1","the 13 ATP synthase nodes glow blue with their 21 contacts inside a faint blue bubble",0],["int_flat","0..1","city morph: the network flattens onto a disc",0],["int_build","0..1","lit buildings with windows rise on the 254 curated proteins",0],["int_hub","0..1","centrality: hubs and essential curated proteins glow hot",0],["int_hood","0..1","neighbourhoods",0],["int_pins","0..1","two map pins (with a dark dot on each face of the head) drop and bounce",0],["int_route","0..1","the shortest path between the pins lights up hop by hop as an orange route with stops",0],["int_dis","0..1","the 3 disease modules glow in their colours inside rim bubbles",0],["int_rare","0..1","the rare disease",0],["int_iei","0..1","the 19 immunity clusters light up in their colours with rim bubbles",0],["int_drugs","0..1","drug capsules fly in",0],["int_heat","0..1","network propagation",0],["int_cand","0..1","the 12 candidates show as rings",0],["int_spin","turns (unbounded)","turns the network about y, in turns",0]],"views":[["default","the whole network"],["city","low oblique over the map"],["atp","the ATP synthase centroid"],["dis","MS and RA on the left, peroxisomal disorders on the right"],["rare","the disease gene"],["iei","all 19 clusters face on"],["heat","seeds, causal gene and candidates"],["paths","the pathways chapter"]],"reusedBy":[],"reuses":[],"file":"tools/lbi/sets/int.js","manifest":"tools/lbi/sets/int.md","note":""},
  "lbi.mac": {"story":"lbi","set":"mac","name":"Classic computer","tris":940,"id":"lbi/mac","shows":"A beige 1990s all-in-one computer (no brand marks) on a table. It switches off like a CRT, comes apart in the order of a real teardown, every part lands in neat rows, glowing wires connect the chips, then the parts shrink into a network of 106 nodes and 209 links that lifts off the table.","size":"table 1.76 x 1.48 (corners reach radius ~1.15); network radius ~0.6","frame":"y up; table top at y = -0.30; computer faces +z, keyboard in front, mouse right; network floats at (0, -0.14, 0).","params":[["mac_a","0..1","the set's fade, 0 hidden to 1 shown",0],["mac_explode","0..1","0: the assembled computer",0],["mac_wire","0..1","The schematic wiring grows wire by wire",0],["mac_net","0..1","parts shrink into glowing nodes",0]],"views":[["default","Three-quarter view of the computer, keyboard and mouse"],["computer","three-quarter view of the assembled computer, keyboard and mouse"],["table","above the teardown"],["apart","the same view as table"],["wiring","Closer over the wired middle rows"],["network","the lifted network"],["screen","close on the screen glass and its desktop"]],"reusedBy":[],"reuses":[],"file":"tools/lbi/sets/mac.js","manifest":"tools/lbi/sets/mac.md","note":""},
  "lbi.web": {"story":"lbi","set":"web","name":"Internet map","tris":1184,"id":"lbi/web","shows":"Networks are everywhere: first the internet as a tree-like network of 15,938 nodes and 16,359 links in the style of the Opte maps, then a dark globe with the 3,214 airport cities as lights and about 11,800 friendship ties as arcs (mostly local, about 650 long ones with travelling glints).","size":"globe radius 1; internet about radius 1","frame":"Centred on the origin; the globe has radius 1 and turns about the polar axis (web_spin).","params":[["web_a","0..1","Fade of the whole set",0],["web_net","0..1","Internet growth",0],["web_globe","0..1","The globe. A dark sphere grows out of the internet's core, reaching full size at about 0.6",0],["web_ties","0..1","Friendship ties",0],["web_spin","turns (unbounded; 0.12 = 43 degrees)","Globe rotation in turns about the polar axis",0]],"views":[["default","net : the whole internet, filling most of the frame"],["net","the whole internet, both giant hubs side by side"],["hub","close on the giant hub with spokes all round"],["globe","the globe facing Europe and the Atlantic at web_spin 0"],["europe","close over Europe"]],"reusedBy":["soil (its globe only, with the engine's hop)"],"reuses":[],"file":"tools/lbi/sets/web.js","manifest":"tools/lbi/sets/web.md","note":""},
  "lbi.dna": {"story":"lbi","set":"dna","name":"DNA double helix","tris":1024,"id":"lbi/dna","shows":"A long DNA double helix is written from the middle outwards, coils into the 23 chromosomes, threads grow from genes and fold into 25 AlphaFold-style protein chains in a 5 x 5 grid, which then becomes a tiny framed patch in a field of 20,000 proteins.","size":"helix, karyotype and grid ~radius 1; field radius ~15 (default view dist 3.9, field view dist 17)","frame":"Centred on the origin; the helix runs along x, the grid in the z = 0 plane; the field fills a ball of radius ~15 around you.","params":[["dna_a","0..1","Fade (applied by the engine)",0],["dna_helix","0..1","the helix is written from the middle outwards, with a bright seam at the growing ends that fades out as it…",0],["dna_chrom","0..1","the helix squeezes onto a coloured cord inside it",0],["dna_fold","0..1","thin white threads grow out of the chromosomes, each at its gene",0],["dna_field","0..1","the field appears from the inside out",0],["dna_rainbow","0..1","protein colours morph from AlphaFold confidence to chain order",0]],"views":[["default","the helix in three-quarter view"],["helix","along the helix in perspective"],["chrom","the karyotype of 23 chromosomes, pulled back to leave room for the bars"],["fold","the 5 x 5 grid of folded proteins"],["field","upper right of the patch, for the field label"]],"reusedBy":[],"reuses":[],"file":"tools/lbi/sets/dna.js","manifest":"tools/lbi/sets/dna.md","note":""},
  "lbi.atp": {"story":"lbi","set":"atp","name":"ATP synthase","tris":808,"id":"lbi/atp","shows":"ATP synthase in three looks: a grid of its 13 AlphaFold-like chains, the assembled complex in a lipid membrane (protons turn the rotor, ATP pops out of the head), and the 13 parts and their 21 contacts as a network over a faint ghost of the complex.","size":"1.2 units tall","frame":"Rotor axis on y; head at the top (matrix side), membrane at y ~ -0.38; subunit a and the peripheral stalk on +x. The parts grid lies in the z = 0 plane (x +-1.0, y…","params":[["atp_a","0..1","the set's fade, 0 hidden to 1 shown",0],["atp_parts","0..1","The 13 chains draw themselves along their length, one after another, then float gently in the grid",0],["atp_colour","0..1","Grey-teal (slide 13) changes to the group colours of slide 14",0],["atp_build","0..1","assembly: the 13 chains fly from the grid to their slots, copies split",0],["atp_turns","turns (unbounded)","Rotor angle in turns, unbounded",0],["atp_flow","0..1","protons flow in through subunit a and ATP pops out of the head",0],["atp_net","0..1","Network view (slide 15)",0],["atp_shrink","0..1","The ghost fades out first",0]],"views":[["default","the grid of 13 parts"],["parts","one entry { sym, hgnc, name, copies } per part, for panel or explore text"],["complex","side view of the assembled complex, slightly from below"],["top","the c-ring and subunit a show under the head, so Rotor points at the ring"],["running","close on ring, a and stalk"],["network","the 21-contact network over a faint ghost of the complex"]],"reusedBy":[],"reuses":[],"file":"tools/lbi/sets/atp.js","manifest":"tools/lbi/sets/atp.md","note":""},
  "lbi.crowd": {"story":"lbi","set":"crowd","name":"Crowd of patients","tris":996,"id":"lbi/crowd","shows":"6,000 instanced lit people. The first crowd of 422 stands in curved rows; one turns red and glows under a beam of light; the other 5,578 then rise out of the floor outwards until a sea of people reaches the horizon (one figure per rare disease).","size":"first crowd ~2.3 x 2.0 (radius 1.45, exported as radius); grown sea ~12 x 7","frame":"Feet at y = 0; rows on arcs bending towards the viewer; people ~0.13 tall.","params":[["crowd_a","0..1","the set's fade, 0 hidden to 1 shown",0],["crowd_red","0..1","one person (red) turns red and glows",0],["crowd_grow","0..1","the other 5,578 people rise out of the floor, outwards from the first crowd at an even rate, until a sea of…",0]],"views":[["default","front view of the whole first crowd"],["close","close on the red patient"],["wide","the grown sea of 6,000 people, pulled back"]],"reusedBy":[],"reuses":[],"file":"tools/lbi/sets/clinic.js","manifest":"tools/lbi/sets/clinic.md","note":"One of 2 sets in one file, with lbi/sankey."},
  "lbi.sankey": {"story":"lbi","set":"sankey","name":"Sankey diagram","tris":1056,"id":"lbi/sankey","shows":"A 3D Sankey diagram, 9 clinical categories on the left against 19 molecular clusters on the right, joined by 58 ribbons whose height is the gene count; each category's ribbons lie in their own depth layer so the diagram has parallax. A gene dot travels along each ribbon.","size":"~1.45 wide, 1.47 tall","frame":"Centred on the origin, facing +z.","params":[["sankey_a","0..1","the set's fade, 0 hidden to 1 shown",0],["sankey_left","0..1","the 9 clinical blocks grow in, top to bottom",0],["sankey_right","0..1","the 19 cluster blocks grow in, top to bottom",0],["sankey_flow","0..1","the ribbons sweep from left to right",0],["sankey_hi","0..9 (category, step)","for the story (keyed in jumps)",1],["sankey_h1","0..1","explore: highlight weight for clinical category 1",0],["sankey_h2","0..1","explore: highlight weight for clinical category 2",0],["sankey_h3","0..1","explore: highlight weight for clinical category 3",0],["sankey_h4","0..1","explore: highlight weight for clinical category 4",0],["sankey_h5","0..1","explore: highlight weight for clinical category 5",0],["sankey_h6","0..1","explore: highlight weight for clinical category 6",0],["sankey_h7","0..1","explore: highlight weight for clinical category 7",0],["sankey_h8","0..1","explore: highlight weight for clinical category 8",0],["sankey_h9","0..1","explore: highlight weight for clinical category 9",0]],"views":[["default","front view of the whole diagram"],["oblique","turned so the depth layers of the ribbons show"],["molecular","above the two columns"],["portrait","narrower, turned view for portrait screens"]],"reusedBy":[],"reuses":[],"file":"tools/lbi/sets/clinic.js","manifest":"tools/lbi/sets/clinic.md","note":"One of 2 sets in one file, with lbi/crowd."},
  "lbi.scale": {"story":"lbi","set":"scale","name":"Tower of scales","tris":800,"id":"lbi/scale","shows":"A glowing tower of eight length scales (DNA bases, proteins, ATP synthase, a mitochondrion, a cell, a tissue, a brain, a body), with an amber time spiral, small networks at four floors, a medicine column, four research-group bands with 22 synergy arcs, and finally the tower dissolving into a team of 42 people.","size":"~2.45 tall, discs radius ~1","frame":"Centred on the origin, y up; floors one above another.","params":[["scale_a","0..1","the set's fade, 0 hidden to 1 shown",0],["scale_len","0..1","the floors appear from the bottom up",0],["scale_time","0..1","an amber spiral time axis",0],["scale_net","0..1","small glowing networks grow out from a hub at four floors, one after another",0],["scale_med","0..1","a medicine column beside the tower",0],["scale_rg","0..1","the four research groups light up one after another",0],["scale_syn","0..1","synergy arcs: 22 nested arcs between the group bands, drawn one after another",0],["scale_team","0..1","the tower dissolves into dust and fades by team 0.55",0]],"views":[["default","the whole tower, from a little above so that every floor reads as a disc"],["tower","the whole tower of eight scales from a little above"],["low","the lowest floors, nearly level"],["high","the upper floors from above"],["groups","the explore Groups view"],["time","the whole time spiral, from its start at the bottom to the top"],["team","the constellation"]],"reusedBy":[],"reuses":[],"file":"tools/lbi/sets/scale.js","manifest":"tools/lbi/sets/scale.md","note":""},
  "lbi.body": {"story":"lbi","set":"body","name":"PET body network","tris":1048,"id":"lbi/body","shows":"A standing figure, arms raised and hands crossed over the head, as a total-body PET maximum-intensity projection (about 52k glowing points, max blending, hot-iron colours). Twelve organ nodes rise onto a cage around the body, joined by bands that rewire between a healthy and a disease network, and a tracer injection can run.","size":"1.9 tall; the network cage spans y -0.42 to 0.8 and ~1.3 wide with labels","frame":"Feet at y = -0.95, hands at +0.95; faces +z; the person's left is +x. The figure is slimmed across by XS = 0.9. Other sets that draw on the body use this frame.","params":[["body_a","0..1","the set's fade, 0 hidden to 1 shown",0],["body_pet","0..1","Tracer time: 0 is the injection, 1 the steady scan",0],["body_net","0..1","The organ network",0],["body_state","0..1","0 is the healthy network and scan, 1 the disease network and scan",0],["body_blank","0..1","Only for the explore loop",0]],"views":[["default","front : the whole figure, from the front"],["front","the whole figure from the front"],["side","profile"],["net","the whole organ network with all 12 labels, landscape screen"],["netTall","the same network framing for a portrait phone"]],"reusedBy":["pet","micro","ovary","topo"],"reuses":[],"file":"tools/lbi/sets/body.js","manifest":"tools/lbi/sets/body.md","note":""},
  "lbi.tissue": {"story":"lbi","set":"tissue","name":"Tissue section","tris":860,"id":"lbi/tissue","shows":"An H&E-stained section of stomach wall built from about 18,600 cells: zoom in and every cell is there, join cells to neighbours for a network, switch to multiplexed imaging so cells take their type colours, then 300 tissue regions lift off into a 3D embedding with loading arrows.","size":"~2.1 long, up to 0.6 deep","frame":"A thin slab (0.008 thick) standing upright, facing +z, centred on the origin; mucosa on top, muscle below. Overlay sets draw in this frame.","params":[["tissue_a","0..1","the set's fade, 0 hidden to 1 shown",0],["tissue_graph","0..1","network of neighbouring cells",0],["tissue_mark","0..1","multiplexed imaging",0],["tissue_embed","0..1","300 regions lift off and fly to a 3D embedding in front of the slab",0]],"views":[["default","the whole slab"],["section","the whole slab"],["zoom","face-on, dist 0.25"],["graph","deep in the zoom patch, for the cell-network look"],["mark","deep in the zoom patch, for the multiplexed-imaging look"],["embed","the 3D embedding of 300 regions in front of the slab"]],"reusedBy":["micro (slide overlay)"],"reuses":[],"file":"tools/lbi/sets/tissue.js","manifest":"tools/lbi/sets/tissue.md","note":""},
  "nmd.tower": {"story":"nmd","set":"tower","name":"Multiplex tower","tris":992,"id":"nmd/tower","shows":"The multiplex network of rare muscle diseases: 71 layers of gene links (phenotypes, pathways, drug targets, co-essential genes, 39 co-expression layers, 27 protein-interaction layers) stacked into a tower with the same gene at the same spot in every layer. Pick a disease group to light its module, seeds, endotypes, a random walk, a squashed endotype grid, z-score bars or a pair of groups.","size":"~2.2 tall, discs radius 1","frame":"Centred on the origin, y up; layers top to bottom in data order with 0.08 gaps between categories.","params":[["tower_a","0..1","the set's fade, 0 hidden to 1 shown",0],["tower_rise","0..1","layers appear from the bottom up",0],["tower_cats","0..1","category tints, and the six category labels above 0.5",0],["tower_group","0..13 (group index + 1, 0 all)","0 all groups (group colours, genes in several groups white-gold, a web of context links in the same colours)",1],["tower_seeds","0..1","the selected group's seeds glow and pulse",0],["tower_walk","0..1","about 20 walkers",0],["tower_heat","0..1","genes warm up by the group's heat",0],["tower_module","0..1","the added genes join the module one by one in order of heat",0],["tower_z","0..1","layer significance",0],["tower_endo","0..1","the selected group's genes take endotype colours",0],["tower_grid","0..1","the endotype grid",0],["tower_pair","0..1","Congenital Myopathies",0],["tower_seedonly","0..1","in pair mode only seeds and their links stay highlighted",0],["tower_drop","0..1","robustness: layers fall a little and fade one by one in a fixed random order",0],["tower_room","0..1","the layout moves out into an annulus",0]],"views":[["default","the whole tower slightly from above"],["ppi","tower layer indices"],["top","straight down onto the top layer"],["side","level side view of the stack"],["grid","above the squashed endotype grid"],["z","the z-score bar chart column"],["pair","the two towers of a pair, target moved right so layer names fit"],["inside","from the middle of the tower looking out and down"]],"reusedBy":[],"reuses":[],"file":"tools/nmd/sets/tower.js","manifest":"tools/nmd/sets/tower.md","note":""},
  "nmd.motor": {"story":"nmd","set":"motor","name":"Motor unit","tris":1022,"id":"nmd/motor","shows":"The motor unit from nerve to sarcomere, and the heart: spinal cord, motor and sensory neurons, myelinated axons, six neuromuscular junctions, a fascicle of 20 striated fibres with one opened to show myofibrils, a magnified sarcomere with myosin, actin, titin, Z-discs and M-band, and a smooth surface-net heart with great vessels. Sites can be highlighted and shown with impulses or contraction.","size":"~2.5 long (x -1.18 to 1.27, y -0.5 to 0.7)","frame":"Read left to right, y up; ventral points right (+x). Heart centre (0.30, 0.29, -0.12).","params":[["motor_a","0..1","the set's fade, 0 hidden to 1 shown",0],["motor_build","0..1","The scene appears along the path from left to right",0],["motor_signal","0..1","Impulses, all from t",0],["motor_open","0..1","0-0.5: one front fibre's sheath opens along its distal part",0],["motor_contract","0..1","Sarcomere contraction",0],["motor_heart","0..1","0-0.3 a magenta glow, 0.2-0.75 the heart fades in from it and grows",0],["motor_groups","0..1","Every disease group's colour lights its site",0],["motor_site","0..5 (0 all, 1 neuron, 2 nerve, 3…","0 all sites alike",1]],"views":[["default","the whole unit, three-quarter view from the front left"],["cord","the cord's cut face, the motor neuron, roots and ganglion"],["junction","close on the third end plate with its vesicles"],["fibre","the opened fibre, its myofibrils and the sarcomere growing out"],["sarcomere","inside the lattice, in the bare zone beside the M-band, in a corridor between…"],["sarcEnd","the magnified sarcomere from outside, down its filaments from beyond the"],["sarcSide","the sarcomere from the side, a little from above, for the filaments"],["heart","the heart from the front, a little from its right"]],"reusedBy":["endo"],"reuses":[],"file":"tools/nmd/sets/motor.js","manifest":"tools/nmd/sets/motor.md","note":""},
  "nmd.hpc": {"story":"nmd","set":"hpc","name":"Supercomputer","tris":1012,"id":"nmd/hpc","shows":"The stress test on a supercomputer: a hall of racks with a cold aisle, blinking lights, cable trays and a glass door, and the field of tiny towers it computes, stretching to the horizon. Each tower is a stack of 20 glowing discs; far ones are single points.","size":"1 unit ~ 4 m (racks 2 m tall); field far beyond the usual radius on purpose","frame":"Floor at y = -0.3; hall fits |x|, |z| < 0.85; the field extends to about 22 units.","params":[["hpc_a","0..1","the set's fade, 0 hidden to 1 shown",0],["hpc_racks","0..1","the racks rise out of the floor, nearest first, then their lights power on",0],["hpc_field","0..1","the field spreads from the hall to the horizon",0],["hpc_remove","0..1","in a wave from the hall outwards",0]],"views":[["default","the hall from above, three-quarter view"],["racks","down the cold aisle between the racks"],["aisle","on the same line, just outside the aisle's open end"],["field","high over the hall and the field of tiny towers"],["near","one tower close, its neighbours receding towards the hall"]],"reusedBy":[],"reuses":[],"file":"tools/nmd/sets/hpc.js","manifest":"tools/nmd/sets/hpc.md","note":""},
  "endo.syn": {"story":"endo","set":"syn","name":"Neuromuscular junction","tris":1108,"id":"endo/syn","shows":"One neuromuscular junction close up as a cut-away: a glass nerve bouton with vesicles, active zones, mitochondria and Schwann cell; the synaptic cleft with basement membrane, laminin, collagen IV and Q, acetylcholinesterase and agrin; the muscle side with six junctional folds, 1,677 acetylcholine receptors, MuSK/LRP4 and sodium channels; and the inside of the fibre with nuclei, ER, Golgi, myofibrils, desmin and plectin. Endotype clouds of genes can…","size":"~2.4 across (x -1.2 to 1.2); 1 micrometre ~ 0.5 units; small parts drawn bigger than life","frame":"Up (+y) is the nerve, down the muscle. Cut plane z = 0.34 facing +z. Axon reaches up and left to about (-2.9, 2.3); the fibre's surface spreads to x +-5 for the wide…","params":[["syn_a","0..1","the set's fade, 0 hidden to 1 shown",0],["syn_build","0..1","The junction assembles",0],["syn_fire","0..1","Firing, one impulse a second, all from t",0],["syn_tired","0..1","Fatigable weakness, with firing on",0],["syn_genes","0..1","The 35 seed genes light up where they act, as glowing markers in their endotype's colour",0],["syn_place","0..12 (endotype id + 1, 0 none)","Endotype id + 1, 0 none",1],["syn_endo","0..1","The endotypes arrive",0],["syn_shell","0..1","The fibre's wide surface round the junction",0]],"views":[["default","three-quarter view of the whole section, a little from above, the"],["terminal","the bouton's inside"],["cleft","low and close, along the cleft from the front right"],["receptors","down onto a crest's carpet of receptor rosettes, from in front of the"],["folds","the folds' cut face, receptors on top, sodium channels below"],["nucleus","nucleus A cut open, ER, Golgi, myofibrils"],["gap","inside the cleft"],["wide","pulled back, the fibre's striated surface round the cut-away and the"]],"reusedBy":[],"reuses":[],"file":"tools/endo/sets/syn.js","manifest":"tools/endo/sets/syn.md","note":""},
  "endo.net": {"story":"endo","set":"net","name":"Protein network cloud","tris":1186,"id":"endo/net","shows":"The authors' protein network (18,306 proteins) as a deep glowing cloud: the 35 congenital-myasthenic seed genes, their neighbourhoods growing and merging as k rises, walkers doing a random walk with restart, the module of 393 genes pulling out of the cloud with endotype colours, and one gene's 184-gene neighbourhood.","size":"~4.8 across (larger than the usual radius 1.1)","frame":"Centred on the origin; 2,000 core genes near the middle, the other 16,306 in a shell from radius 1.8 to 2.4. The module layout is a drawing about 1.3 across.","params":[["net_a","0..1","the set's fade, 0 hidden to 1 shown",0],["net_cloud","0..1","the cloud appears from the centre outwards with a bright front",0],["net_seeds","0..1","the 35 seeds glow white-hot and grow, everything else dims a little",0],["net_k","0..12","0..12: neighbourhood size groups.k[round(net_k)]",0],["net_walk","0..1","walkers: their number grows with the value",0],["net_heat","0..1","every gene coloured by the walk from all seeds",0],["net_module","0..1","the module pulls out",0],["net_endo","0..1","module genes (and their links) take their endotype colours",0],["net_gene","-1, 0..392 (module index)","-1 none, else a module index",1],["net_hood","0..1","0..0.3: the gene is marked",0],["net_focus","0..12 (endotype id + 1)","0 none, id + 1",1]],"views":[["default","the whole cloud"],["core","the core of the protein network"],["module","the module of 393 genes pulled out of the cloud"],["seeds","module indices of the 35 seeds in the Gene Table's order"],["gene","the current gene, or the module's centroid"]],"reusedBy":[],"reuses":[],"file":"tools/endo/sets/net.js","manifest":"tools/endo/sets/net.md","note":""},
  "endo.tree": {"story":"endo","set":"tree","name":"Endotype tree","tris":760,"id":"endo/tree","shows":"From neighbourhoods to endotypes: the gene x term matrix (393 x 457) fills row by row, a dendrogram grows beside it, a test pulse runs down the tree (green check at kept splits, red cross inside an endotype), endotype colours run down the subtree, then genes fly into the poster's metagraph of translucent bubbles on a ring.","size":"not stated in the manifest (see views)","frame":"Centred on the origin; leaves at the rows, root at the far left, the tree curving towards you.","params":[["tree_a","0..1","the set's fade, 0 hidden to 1 shown",0],["tree_matrix","0..1","the empty matrix appears",0],["tree_tree","0..1","the dendrogram grows from the leaves",0],["tree_test","0..1","the test pulse runs down the tree from the root",0],["tree_mds","0..1","genes fly (staggered, in an arc towards you) from their rows to their tree-distance spots",0],["tree_meta","0..1","genes fly (from the rows or from the spots) into their bubbles",0],["tree_focus","0..12 (endotype id + 1)","id + 1 of the endotype in focus",1]],"views":[["default","matrix and tree"],["matrix","the gene x term matrix beside the tree"],["tree","the tree a little from the side, so its curve shows"],["mds","field of ENDO_DATA is not used"],["meta","the poster's metagraph ring of endotype bubbles"],["focus","the endotype in focus"],["e0","close on endotype 0"],["e1","close on endotype 1"],["e2","close on endotype 2"],["e3","close on endotype 3"],["e4","close on endotype 4"],["e5","close on endotype 5"],["e6","close on endotype 6"],["e7","close on endotype 7"],["e8","close on endotype 8"],["e9","close on endotype 9"],["e10","close on endotype 10"],["e11","close on endotype 11"]],"reusedBy":[],"reuses":[],"file":"tools/endo/sets/tree.js","manifest":"tools/endo/sets/tree.md","note":""},
  "pet.scan": {"story":"pet","set":"scan","name":"PET/CT scanner","tris":816,"id":"pet/scan","shows":"A glossy PET/CT scanner (no brand, no text) with a patient on the couch, shown as a studio product shot. A plane cuts the housing away to show the detector ring of 4,608 crystals; positrons annihilate, pairs of 511 keV photons fly apart and lines of response join the struck crystals; the couch carries the patient through; the image builds up; finally the patient stands up and hands over to the body set.","size":"gantry 2.02 wide, 2.1 tall; scanner life size","frame":"1 unit = 1 m. Origin at the centre of the bore; its axis is z; the couch comes out towards +z; floor at y = -1.05 (exported as floorY).","params":[["scan_a","0..1","the set's fade, 0 hidden to 1 shown",0],["scan_bed","0..1","the couch slides in",0],["scan_pass","0..1","added: the couch goes on through the ring, 0 the head in the ring, 0.4 the chest",0],["scan_cut","0..1","the housing's upper half goes",0],["scan_events","0..1","0 none; from about 0.03 the featured event",0],["scan_lines","0..1","how many lines of the web stay",0],["scan_image","0..1","0-0.6 the couch carries the patient on through the ring",0],["scan_vision","0..1","the vision row",0],["scan_floor","0..1","added: the floor and its reflection",0],["scan_rise","0..1","added: the hand-over to the body set",0]],"views":[["default","three-quarter view of scanner and couch from slightly above"],["front","straight at the bore"],["ring","close to the cut detector ring, the web and events inside"],["side","side view along the couch"],["inside","in the bore (26 cm above its axis, 10 cm inside its mouth) looking along"],["vision","the scanner pulled back for the vision row"],["life","the scanner from 2.5 m at eye height"]],"reusedBy":[],"reuses":["lbi/body (an unchanged instance inside the patient)"],"file":"tools/pet/sets/scan.js","manifest":"tools/pet/sets/scan.md","note":""},
  "pet.organs": {"story":"pet","set":"organs","name":"Organ network","tris":1142,"id":"pet/organs","shows":"Organs, uptake and the cohort network, drawn on the body: a scan plane segments 14 organs (translucent shells with outlines), 14 uptake bars to the body's right (aorta as the unit), a slab of 658 x 11 cells and the partial-correlation panel with 658 stand-in people, then the paper's networks (all scans, tracers, doses, disease) and lesion views.","size":"body-sized; bars x 0.40 to 1.1; slab 0.47 to 1.13","frame":"The body set's frame (feet y -0.95, 1.9 tall, faces +z, slimmed by XS = 0.9); always shown with body.","params":[["organs_a","0..1","the set's fade, 0 hidden to 1 shown",0],["organs_seg","0..1","the sweep. At 0 no shells, at 1 all of them",0],["organs_suv","0..1","the uptake bars grow head to toe",0],["organs_focus","0..14 (organ index + 1)","organ index + 1 in PET_DATA.organs order",1],["organs_lesion","0..1","the tumour hot spot and its rings",0],["organs_rows","0..1","0-0.28: the f2 bars become one row",0],["organs_pair","0..5","which explainer pair",1],["organs_scatter","0..1","the rise of the dots and the panel, multiplied with min(organs_pair, 1)",0],["organs_partial","0..1","0 the raw values and r",0],["organs_net","0..1","0-0.48: the nodes rise",0],["organs_which","0..14 (network index)","which network: 0 full, 1 FDG_healthy, 2 A_low, 3 A_high, 4 B_low, 5 B_high, 6 C_low, 7 C_mid, 8 C_high, 9…",1],["organs_prev","0..14","the network crossfaded from",1],["organs_mix","0..1","0 shows organs_prev, 1 shows organs_which, between a direct crossfade of the two",1],["organs_measures","0..1","the density and disorder tag under the network's title",0],["organs_ghost","0..1","harness only: an instance of SETS.body",0]],"views":[["default","the body, all of it"],["seg","the torso with the segmentation plane seen from a little above"],["bars","above the column), unit"],["matrix","the cohort slab of 658 x 11 cells beside the body"],["scatter","above the panel"],["net","the network's middle"],["lesion","close on the lesion"]],"reusedBy":[],"reuses":["lbi/body (drawn on it)"],"file":"tools/pet/sets/organs.js","manifest":"tools/pet/sets/organs.md","note":""},
  "pet.liver": {"story":"pet","set":"liver","name":"Liver network","tris":980,"id":"pet/liver","shows":"An organ is a network too: a liver made of 3,000 small patches joined into a network (about 19,700 links) by the poster's rule, with its gallbladder and falciform ligament, patches coloured by a stand-in uptake and hubs picked out.","size":"1.65 wide, 0.99 tall, 0.77 deep (about 1 unit = 13 cm)","frame":"Seen from the front: x the patient's left, y up, z forward; centred on the origin by its bounding box.","params":[["liver_a","0..1","the set's fade, 0 hidden to 1 shown",0],["liver_grow","0..1","patches appear from the middle of the patches outwards, with a cyan front",0],["liver_links","0..1","the links appear",0],["liver_top","0..1","the best-connected 5 % stand out",0],["liver_spin","turns (0.25 = quarter turn)","turns the organ about its vertical axis",0]],"views":[["default","three-quarter front view, the whole organ"],["front","straight at the front, the atlas view"],["close","into the web round the warmer patch"],["below","the underside: the gallbladder in its bed"],["side","from the patient's right"]],"reusedBy":[],"reuses":[],"file":"tools/pet/sets/liver.js","manifest":"tools/pet/sets/liver.md","note":""},
  "micro.slide": {"story":"micro","set":"slide","name":"Section in tiles","tris":940,"id":"micro/slide","shows":"The preprint's method (H&E-UTAG) shown on one section: it is cut into tiles, a vision model describes each as glowing blocks, a network of neighbours passes messages, the tiles lift into a 3D map where alike tiles gather and take their domain colour, then fly back and colour the section; the domains change from age 20 to 70.","size":"as the tissue slab (~2.1 long)","frame":"An overlay in the tour's tissue set's frame (the stomach-wall H&E slab); show tissue and slide together with the same transform.","params":[["slide_a","0..1","the set's fade, 0 hidden to 1 shown",0],["slide_tiles","0..1","tile outlines draw on, each traced round its edge, in a diagonal sweep from left to right with some randomness",0],["slide_feat","0..1","the slide darkens and every tile's mosaic lights up, in a wave from the close-up tile",0],["slide_adj","0..1","each tile takes its own tint",0],["slide_group","0..2","0..2. 0-1: the nodes lift off",0],["slide_domain","0..1","tiles take their domain colours one by one",0],["slide_age","0..1","age 20 (0) to 70",0],["slide_focus","0..6 (domain + 1)","0..6: domain index + 1",1],["slide_gauge","0..1","shows the gauge",0],["slide_ghost","0..1","harness only: draws an instance of SETS.tissue under the overlay",0]],"views":[["default","the whole slab"],["section","the whole section, same as default"],["tiles","the top-left tiles), feat"],["matrix","the mosaics close up at a slant, so the blocks stand out of the slide"],["close","the network over the close-up tile and its neighbours"],["group","the map and the whole section under it"],["domains","the domain map with its labels"],["age","the section for the age sweep from 20 to 70"]],"reusedBy":[],"reuses":["lbi/tissue (overlay in its frame)"],"file":"tools/micro/sets/slide.js","manifest":"tools/micro/sets/slide.md","note":""},
  "micro.atlas": {"story":"micro","set":"atlas","name":"Slide library","tris":960,"id":"micro/atlas","shows":"The slide library as a curved wall of glass slides, the atlas of 40 sections standing in relief on a 10 x 4 arc with each section's organ model, a cloud of tiles, the volcano of changing domains, the age trajectories on glass lanes; at the end it morphs into the network of organ architecture.","size":"not stated in the manifest (see views)","frame":"y up, viewer towards +z; wall at the back, sections in front, tiles in the middle; centred on the origin.","params":[["atlas_a","0..1","the set's fade, 0 hidden to 1 shown",0],["atlas_lib","0..1","the library: slides burst from the stage's middle onto the wall in waves",0],["atlas_map","0..1","the atlas: each tissue's section leaves its column on the wall and comes forward to the arc as an H&E section",0],["atlas_umap","0..1","the tile cloud",0],["atlas_focus","0..40 (tissue + 1)","tissue index + 1",1],["atlas_age","0..1","age 20 -> 70 for every section's domains",0],["atlas_volcano","0..1","the volcano: a dark glass floor and the two axes as lit rods, a faint grid",0],["atlas_curves","0..1","trajectories: five lanes, each on a strip of dark glass, draw from age 20 to 70 as a glowing tube along the…",0],["atlas_net","0..1 (morph, jumps)","with atlas_map 1 the atlas turns into the network of organ architecture, in step with hier_grow",1]],"views":[["default","the wall of slides"],["library","the curved wall of glass slides"],["atlas","the arc's centre"],["umap","the cloud of tiles in the middle"],["focus","the focused section's centre, or the atlas's centre"],["volcano","the volcano of bubbles over its glass floor, with a section beside it"],["curves","the trajectories on their glass lanes, age 20 to 70"],["age","volcano or curves with a focused section"],["slides","close on a tissue's glass slides"],["shelf","very close: slides standing in the wall's compartments"]],"reusedBy":[],"reuses":["micro/organs (ORGAN3D)"],"file":"tools/micro/sets/atlas.js","manifest":"tools/micro/sets/atlas.md","note":""},
  "micro.hier": {"story":"micro","set":"hier","name":"Organ architecture network","tris":1148,"id":"micro/hier","shows":"Organ architecture as a four-level hourglass network (29 organs, 24 tissues, 10 tissue types, 70 domains) with glowing curved links, each organ its small 3D model, and the contact networks between domains for six organs.","size":"radius ~0.9; node sizes by degree","frame":"Centred on the origin facing +z; rings at y 0.66 (organs, radius 0.9), 0.28 (tissues, 0.7), -0.1 (tissue types, 0.4), -0.62 (domains, 0.9).","params":[["hier_a","0..1","the set's fade, 0 hidden to 1 shown",0],["hier_grow","0..1","the network grows top to bottom",0],["hier_focus","-1..132 (node index)","a node index into MICRO_DATA.graph.nodes",1],["hier_contacts","0..1","the contact network comes forward",0],["hier_organ","0..5 (contact network)","which contact network",1],["hier_age","0..1","age 20 (0) to 70",0]],"views":[["default","the whole hourglass"],["net","from above: the rings"],["grow","higher and further back"],["contacts","the contact network left of the middle with its notes column on the right"]],"reusedBy":[],"reuses":["micro/organs (ORGAN3D)"],"file":"tools/micro/sets/hier.js","manifest":"tools/micro/sets/hier.md","note":""},
  "micro.organs": {"story":"micro","set":"organs","name":"Organ models","tris":856,"id":"micro/organs","shows":"Small lit 3D models of the 29 organs of the microanatomy atlas (adipose to vagina), each a signed distance field of a few primitives polygonised by surface nets, replacing flat icons. Used as meshes on the body, the atlas plates and the network's organ ring, and as pictures in panes.","size":"drawn small (organ nodes on the network ring are radius 0.062 + 0.005 sqrt(degree))","frame":"Each model is centred in its own small box; no shared scene frame. Other sets read ORGAN3D, not this set's group.","params":[["organs_a","0..1","the set's fade, 0 hidden to 1 shown",0],["organs_spin","0..1","turns the models",0],["organs_tint","0..1","models take their level colour",0],["organs_pics","0..1","lays the 2D pictures over the page",0],["organs_lite","0..1","shows the lighter low-triangle models",0]],"views":[["default","one frame for the harness grid of 29 models"]],"reusedBy":["micro/atlas","micro/hier","topo/*"],"reuses":[],"file":"tools/micro/sets/organs.js","manifest":"tools/micro/sets/organs.md","note":"Not a scene of its own: a library of small organ models (ORGAN3D) that the atlas, the network and the tissue topology story draw."},
  "ovary.organ": {"story":"ovary","set":"organ","name":"Cut-away ovary","tris":1070,"id":"ovary/organ","shows":"A large cut-away ovary (almond-shaped, tunica albuginea, cortex and medulla) with antral follicles, scars (corpora albicantia), vessels and a corpus luteum, whose contents follow the poster's trend lines as it ages from 20 to 70. It is small in the body's pelvis at first and grows out of it. Say \"drawn\", never \"to scale\".","size":"~1.9 long, 1.1 tall, 0.9 deep","frame":"Centred on the origin; in the body, the same frame as the body set (the ovary sits in its pelvis before growing).","params":[["organ_a","0..1","the set's fade, 0 hidden to 1 shown",0],["organ_grow","0..1","0 small in the body, 1 large at the centre",0],["organ_body","0..1","the pelvis while small",0],["organ_open","0..1","0 closed (the wedge in place), 1 cut open",0],["organ_age","20..70 (years)","the donor age shown, 20 to 70 years",0],["organ_follicle","0..1","picked out in the poster's colors",0],["organ_albicans","0..1","picked out in the poster's colors",0],["organ_vessel","0..1","picked out in the poster's colors",0],["organ_luteum","0..1","picked out in the poster's colors",0],["organ_parts","0..1","the part labels",0],["organ_agelab","0..1","the age readout label",0],["organ_counts","0..1","three live tags with each method's count on the poster's lines at organ_age",0]],"views":[["default","the cut-away ovary in three-quarter view"],["face","the cut face square on"],["cortex","right-hand end of the band), medulla, follicle"],["medulla","close on the pink medulla"],["whole","the intact end"],["open","for the wedge lifting"],["pelvis","the body's pelvis, close"],["body","the whole body"]],"reusedBy":[],"reuses":["lbi/body (small in its pelvis)"],"file":"tools/ovary/sets/organ.js","manifest":"tools/ovary/sets/organ.md","note":""},
  "ovary.section": {"story":"ovary","set":"section","name":"Ovary section","tris":1016,"id":"ovary/section","shows":"A drawn H&E section of an ovary with blood vessels, macrophages, corpora albicantia, follicles and cysts in relief; tiles, UNI2 features and a forest of decision trees that votes; SegFormer's masks with scores as tags; and an illustrative neighbor network that tips off the section and gathers into five hubs by kind joined by bands.","size":"section ~1.9 x 1.5, 0.03 thick","frame":"Section A in the xy plane facing +z, centred on the origin; a second section for the pair view; the grove and hubs beside it.","params":[["section_a","0..1","the set's fade, 0 hidden to 1 shown",0],["section_age","20..70 (years)","section A's age",0],["section_pair","0..1","A shrinks to the left, B comes in on the right",0],["section_vessel","0..1","picks out the vessel objects on section A and dims the rest",0],["section_macrophage","0..1","picks out the macrophage objects on section A and dims the rest",0],["section_albicans","0..1","picks out the albicans objects on section A and dims the rest",0],["section_follicle","0..1","picks out the follicle objects on section A and dims the rest",0],["section_cyst","0..1","picks out the cyst objects on section A and dims the rest",0],["section_tiles","0..1","tile outlines draw on",0],["section_feat","0..1","the feature blocks",0],["section_forest","0..1","the vote: grove in by 0.12, features flow 0.1-0.45, trees answer 0.35-0.85, verdict 0.8-0.95, tile lit at 1",0],["section_pred","0..1","predictions sweep across",0],["section_mask","0..1","SegFormer's masks sweep across",0],["section_net","0..1","the network draws outwards",0],["section_lift","0..1","the slab tips back about 70 degrees",0],["section_kinds","0..1","the nodes gather into the hubs",0],["section_names","0..1","the hubs' names as set labels",0]],"views":[["default","the whole section A"],["close","the largest follicle"],["pair","section A beside the second section"],["tiles","from above, the tiles"],["feat","a slant close-up of the blocks"],["forest","above the grove"],["mask","the sweep line"],["net","the neighbor network lifted off the section"],["kinds","the middle of the hubs"]],"reusedBy":[],"reuses":[],"file":"tools/ovary/sets/section.js","manifest":"tools/ovary/sets/section.md","note":""},
  "ovary.charts": {"story":"ovary","set":"charts","name":"Donors histogram","tris":1080,"id":"ovary/charts","shows":"Only the donors in 3D: 255 glass slides fly in, fan out in three arcs and stack into the poster's age histogram, one slide per donor. The story's one graph, shown in passing.","size":"not stated in the manifest (see views)","frame":"Centred near the origin facing +z in front of a backdrop of ages and counts.","params":[["charts_a","0..1","the set's fade, 0 hidden to 1 shown",0],["charts_slides","0..1","the slides fly in",0],["charts_hist","0..1","the slides stack into the histogram",0]],"views":[["default","the slides and the histogram"],["hist","the age histogram of 255 donors"],["fan","the slides fanned out in three arcs"]],"reusedBy":[],"reuses":[],"file":"tools/ovary/sets/charts.js","manifest":"tools/ovary/sets/charts.md","note":""},
  "qubits.pairs": {"story":"qubits","set":"pairs","name":"City map and chip","tris":1052,"id":"qubits/pairs","shows":"Why pairs: a grid of all pairs of genes grows; the example network as a city map with two walkers settling into valleys; a chip with three qubits; and the map folding into eight neighborhoods placed on a ring in Gray-code order with three-digit codes.","size":"not stated in the manifest (see views)","frame":"Centred on the origin, flat map seen from above; neighborhoods on a ring in Gray order.","params":[["pairs_a","0..1","the set's fade, 0 hidden to 1 shown",0],["pairs_genes","0..1","the grid's genes",0],["pairs_grid","0..1","the grid of pairs grows",0],["pairs_map","0..1","the city map (ground, streets, street lights)",0],["pairs_walk","0..1","two walkers (magenta, cyan) wander the streets with short trails",0],["pairs_valley","0..1","the valleys dip and glow amber",0],["pairs_settle","0..1","the walkers settle in the valleys",0],["pairs_chip","0..1","the chip with three qubits beside the map",0],["pairs_fold","0..1","the map folds into the eight neighborhoods",0],["pairs_code","0..8 (neighborhood + 1)","0 none, k = 1..8",1]],"views":[["default","the map of the example network from above"],["grid","face on to the grid"],["map","oblique over the map"],["walkers","closer, the valleys"],["chip","the three-qubit chip and the folded ring"],["hoods","from above, the folded ring and the chip"]],"reusedBy":[],"reuses":[],"file":"tools/qubits/sets/pairs.js","manifest":"tools/qubits/sets/pairs.md","note":""},
  "qubits.cube": {"story":"qubits","set":"cube","name":"Coarse operator cube","tris":824,"id":"qubits/cube","shows":"The cuts and the coarse operator: the network is cut in two, four and eight and its genes fly to the corners of a cube; the coarse operator A_c lives on the cube; Pauli strings are small cubes with weights, added one by one as the error shrinks; the toolbox (so(6) or so(7)) keeps strings in the algebra bright and drops the rest.","size":"not stated in the manifest (see views)","frame":"Centred on the origin; first cut left/right, second front/back, third top/bottom; 000 is top-front-left.","params":[["cube_a","0..1","the set's fade, 0 hidden to 1 shown",0],["cube_net","0..3 (example network)","which example network",1],["cube_cut","0..1 (found cut or random)","0 the found cut, 1 random halvings",1],["cube_genes","0..1","the gene-level network",0],["cube_bits","0..3","0..3: the cuts",0],["cube_ac","0..1","the genes gather into their corners and the coarse operator grows",0],["cube_bricks","0..1","the big cube moves left and the gallery of strings comes in",0],["cube_lesson","0..1","1: the gallery shows the reference figure's strings one by one, without weights",0],["cube_build","0..1","the big cube shows the sum of the strings added so far",0],["cube_sum","0..10","0..10: how many strings have been added",0],["cube_alg","0..1","strings outside the algebra go gray in the gallery",0],["cube_keep","0..1","the big cube keeps only the trace part and the strings inside the algebra",0],["cube_algebra","0..1 (so(2L) or so(2L+1))","0 so(2L) (the TFIM chain), 1 so(2L+1)",1],["cube_focus","-1, 0.. (string index)","a string index k",1]],"views":[["default","three-quarter view of the cube, as in the reference figure"],["genes","the network's center"],["cube","the big cube's center, moves with the gallery"],["bricks","the gallery now , lesson(L) the lesson's names"],["gallery","the gallery of Pauli-string bricks"]],"reusedBy":[],"reuses":[],"file":"tools/qubits/sets/cube.js","manifest":"tools/qubits/sets/cube.md","note":""},
  "qubits.chart": {"story":"qubits","set":"chart","name":"Residual chart and circuit","tris":740,"id":"qubits/chart","shows":"The real run's best residual by depth (our cuts against random ones, with the example network's own residuals live at 1 to 3 bits) and one Trotter step at 3 bits in so(7) as a circuit of six gates with its angles.","size":"not stated in the manifest (see views)","frame":"Chart and circuit share the origin; show one at a time.","params":[["chart_a","0..1","the set's fade, 0 hidden to 1 shown",0],["chart_plot","0..1","the chart (back panel with lines at 0, 0.25 .",0],["chart_grow","0..1","the two series draw left to right",0],["chart_rand","0..1","the random-cut series",0],["chart_best","0..1","the best 8-bit run",0],["chart_ex","0..1","the example network's residuals at 1, 2, 3 bits",0],["chart_circuit","0..1","the circuit: wires q2, q1, q0",0],["chart_gates","0..6","0..6: the gates appear in time order",0],["chart_run","0..1","pulses run down the wires and light each gate as they pass",0],["chart_src","0..1","0 the real run's angles, 1 the example network's",1]],"views":[["default","the residual chart"],["chart","face on, a little above"],["circuit","a little from the left"]],"reusedBy":[],"reuses":[],"file":"tools/qubits/sets/chart.js","manifest":"tools/qubits/sets/chart.md","note":""},
  "mutation.letters": {"story":"mutation","set":"letters","name":"DNA helix and letters","tris":1036,"id":"mutation/letters","shows":"A text in four letters copied with swaps: a 24-pair DNA helix, eight letters peeling into tiles (ACGTTAGC), two copies with swaps flashing, then one letter opened into its two qubits, a mix of letters and read-outs spinning like a coin and piling into four heaps as tall as the chances.","size":"not stated in the manifest (see views)","frame":"Centred on the origin; helix vertical; tiles in a row.","params":[["letters_a","0..1","the set's fade, 0 hidden to 1 shown",0],["letters_helix","0..1","the helix (both strands, rungs, backbones)",0],["letters_peel","0..1","the ancestor's eight letters grow out of their rungs as tiles, peel away one after another",0],["letters_copy1","0..1","copy 1 slides out of the ancestor's row",0],["letters_mut1","0..1","copy 1's two swaps",0],["letters_copy2","0..1","copy 2 slides out",0],["letters_mut2","0..1","copy 2's two swaps, as copy 1's",0],["letters_open","0..1","the ancestor's first tile",0],["letters_code","0..3 (letter code)","which two-qubit code is shown, 0..3",1],["letters_mix","0..1","0 the pure code, 1 the mix",0],["letters_target","0..1","the mix: 0 the rule's mix after letters_time from the code's letter",1],["letters_time","0..3 (swaps per letter)","the branch length for the rule's mix",0],["letters_reads","0..400 (read-outs, continuous)","how many read-outs",0],["letters_seed","integer >= 1","which read-outs come out",1]],"views":[["default","the helix, face on"],["helix","the helix from the left, showing its grooves"],["peel","the strand peeling into letter tiles"],["rows","the ancestor and its two copies with their swaps"],["qubits","the tile and its two qubits, the codes and the mix"],["reads","the qubits and the four piles of read-outs below"]],"reusedBy":[],"reuses":[],"file":"tools/mutation/sets/letters.js","manifest":"tools/mutation/sets/letters.md","note":""},
  "mutation.tree": {"story":"mutation","set":"tree","name":"Family tree in 3D","tris":1064,"id":"mutation/tree","shows":"A family tree in 3D (8 tips, 14 branches) that grows up from its root as a level of change rises (a branch rises by its length), every swap simulated, letters riding up each branch; a gear (machine) on every branch; and the poster's species tree. You walk round it and look up into it.","size":"tree ~2.06 units tall with letters, widest radius 1.18","frame":"Root at (0, -1, 0); tips on a ring round the vertical; the species tree in the same frame (stem set draws in it).","params":[["tree_a","0..1","the set's fade, 0 hidden to 1 shown",0],["tree_species","0..1","0 the family tree, 1 the species tree",0],["tree_grow","0..1","the level of change rising from the root past the highest tip",0],["tree_seq","0..1","the letters: the ancestor's arc at the root, the rows riding up, the tips' rows",0],["tree_hi","0..1","lights the long and the short branch",0],["tree_gears","0..1","a gear on every branch",0],["tree_flow","0..1","the machines run",0],["tree_q","0..1","the glass \"?\" at the species tree's root",0],["tree_seed","integer >= 1","which family tree",1],["tree_speed","0..3 (index into 0.5, 1, 2, 4)","how fast letters change",1],["tree_pick","-1..13 (branch)","a picked branch",1]],"views":[["default","the whole family tree"],["grow","from low, while the tree grows"],["crown","the crown and the tips' sequences from above"],["pair","the long and the short branch side by side"],["long","close on the long highlighted branch"],["short","the middles of the two highlighted branches"],["gears","the machines: a gear on every branch"],["stand","the headset view"],["up","from below the root looking up into the crown"],["species","the species tree with its stems"],["what","the species tree with machines running and the stems"]],"reusedBy":[],"reuses":[],"file":"tools/mutation/sets/tree.js","manifest":"tools/mutation/sets/tree.md","note":""},
  "mutation.rule": {"story":"mutation","set":"rule","name":"Pyramid of mixes","tris":952,"id":"mutation/rule","shows":"The rule of change: four letter balls at the corners of a pyramid joined by rate arrows, the pyramid of mixes and a point gliding along its path, the compiler (a drum with a gear), the machine for one branch (copy the parent's letter, then turn it), its circuit and the turn blocks opening into their simple steps.","size":"pyramid x +-0.93, y -0.5 to 1.2; machine x -1.15 to 1.05","frame":"Centred on the origin; A at the top, C front left, G back, T front right.","params":[["rule_a","0..1","the set's fade, 0 hidden to 1 shown",0],["rule_balls","0..1","the balls grow",0],["rule_flow","0..1","light running along the arrows",0],["rule_pyr","0..1","the pyramid forms",0],["rule_path","0..1","the mix point, its trail and the path ahead, points 1-3, the long-run ring, the threads",0],["rule_time","0..3 (swaps per letter)","the branch length / time",0],["rule_model","0..2 (even, transitions, uneven)","0 even (JC69), 1 transitions",1],["rule_start","0..3 (A C G T)","the path's start letter",1],["rule_compile","0..1","the drum appears",0],["rule_machine","0..1","the machine comes out of the drum part by part",0],["rule_parent","0..3 (A C G T)","the parent's letter",1],["rule_copy","0..1","the copy: the head moves over the parent",0],["rule_circuit","0..1","the circuit under the machine",0],["rule_simple","0..1","the turn blocks open into their simple steps",0],["rule_run","0..1","pulses run along the wires",0]],"views":[["default","the pyramid and its path, from the front left"],["rates","the letter balls and rate arrows"],["pyramid","the pyramid of mixes forming"],["path","the turn has begun, without the circuit"],["compiler","the drum (the compiler)"],["machine","the whole machine for one branch"],["copy","the copy step: parent and child"],["turn","the turn: gears, dial and small pyramid"],["circuit","the compiler runs, until the machine is half out"],["steps","the simple steps"]],"reusedBy":[],"reuses":[],"file":"tools/mutation/sets/rule.js","manifest":"tools/mutation/sets/rule.md","note":""},
  "mutation.stem": {"story":"mutation","set":"stem","name":"RNA stem","tris":748,"id":"mutation/stem","shows":"Letters that work together: an RNA strand folds into a stem of six pairs, one letter changes alone and its rung snaps, a coupling makes the pair change together, the count of combinations (16, 64, about a million) against qubits, then three fields of 2,000 rebuilt ancestors on the species tree.","size":"stem ~radius 1; fields in front of the root","frame":"In the tree set's frame; chapter 6 at the origin with the tree hidden, chapter 7 at the species tree.","params":[["stem_a","0..1","the set's fade, 0 hidden to 1 shown",0],["stem_strand","0..1","the close-up's strand",0],["stem_fold","0..1","0 a straight row, to 0.55 a hairpin folding round its loop, to 1 the twisted stem",0],["stem_break","0..1","pair 5's top letter flips C -> A at 0.5",0],["stem_couple","0..1","the coupling gear over pair 5",0],["stem_both","0..1","pair 5 changes both letters at once at 0.5",0],["stem_count","0..3","0..3: to 1 the 4 x 4 square of tile pairs beside the stem",0],["stem_qubits","0..1","a row of 20 qubits under it all",0],["stem_species","0..1","the three species' stems on the species tree's tips, small, upright, facing the viewer, broken pairs as red…",0],["stem_fields","0..1","three fields of 2,000 tiny stems sprout in front of the root",0],["stem_named","0..3","how many fields' tags show, left to right",0],["stem_sort","0..1","the stems whose six pairs all hold walk to the front rows of their field",0],["stem_truth","0..1","the true ancestor's stem, big at the root",0],["stem_examples","0..1","one rebuilt ancestor per method stands before its field",0],["stem_src","0..1","0 the authors' test",1],["stem_w","1..30","the pair favour w, 1 to 30",1],["stem_seed","integer >= 1","the rebuild's seed",1],["stem_method","-1..2","a method lit, the other fields dimmed",1]],"views":[["default","the folded RNA stem"],["strand","the straight strand and its fold"],["fold","the stem a little closer"],["break","close on pair 5"],["count","the stem, the 4 x 4 square, the cube and the qubits"],["cloud","the cloud of a million combinations against 20 qubits"],["species","the species tree and its stems"],["fields","the three fields of 2,000 rebuilt ancestors, from in front"],["compare","the true ancestor and the three examples before their fields"],["what","the species tree, its machines and the stems"]],"reusedBy":[],"reuses":[],"file":"tools/mutation/sets/stem.js","manifest":"tools/mutation/sets/stem.md","note":""},
  "topo.slide": {"story":"topo","set":"slide","name":"Liver on a glass slide","tris":622,"id":"topo/slide","shows":"Real tissue on its glass slide drawn in H&E from cells alone: the healthy tile of 640 um round the poster's patch (945 cells) and the new slide's window of 1.5 mm (6,716 cells), plus sketches of other modalities (spots, multiplex), the fixed scales other tools read and an overview of the whole section.","size":"1.6 across","frame":"Lies flat (x-z, y up), centred on the origin on a glass slide whose +x end shows past it.","params":[["slide_a","0..1","the set's fade, 0 hidden to 1 shown",0],["slide_show","0..1","what lies on the glass",0],["slide_mode","0..2 (H&E, spots, multiplex)","the modality: 0 H&E, 1 spatial transcriptomics",0],["slide_points","0..1","every cell becomes a glowing white-gold bead",0],["slide_scale","0..3","chapter 2's fixed scales on the tile",0],["slide_patch","0..1","the poster's patch marked on the tile",0],["slide_over","0..1","the new slide's overview",0]],"views":[["default","the whole tile or window from above and in front"],["tile","the tile's far left corner, for its tag"],["low","low across the tissue to show its relief"],["close","the cells close up"],["cells","very close on the tile's cells"],["square","chapter 2's three scales"],["hub","the cell with its six neighbours"],["circle","the circle's rim"],["patch","the poster's patch from above"],["over","the overview on its glass"],["window","the new slide's window alone"],["both","the two side by side"]],"reusedBy":[],"reuses":[],"file":"tools/topo/sets/slide.js","manifest":"tools/topo/sets/slide.md","note":""},
  "topo.map": {"story":"topo","set":"map","name":"Scored cells relief","tris":758,"id":"topo/map","shows":"The signal back on the tissue: one cell's 50 um neighbourhood and its own network, bars and score; every cell scored as a relief; the two groups (healthy-like, cirrhosis-like) as piles with shares; and sketches of the next steps (genes, proteins).","size":"1.6 across","frame":"In the slide set's frame over the window (centred on the origin; side by side with slide_show 2 it moves to x 0.42).","params":[["map_a","0..1","the set's fade, 0 hidden to 1 shown",0],["map_cell","0..1","the dome on the cell, its cells lit, its complex, its bars and score",0],["map_r","um (default 50)","the radius (µm) of its part of the complex",0],["map_balls","0..1","the growing balls round its cells",0],["map_bars","0..1","the picked cell's own persistence bars rise behind it",0],["map_score","0..1","its score's needle and tag",0],["map_all","0..1","the sweeping dome and the relief behind it",0],["map_split","0..1","the cells fly to their piles",0],["map_omics","0..2","the sketches: 1 spots and the volcano, 2 the multiplex slide and protein columns",0],["map_pick","-1.. (cell index)","the cell with the dome",1],["map_delta","0..1 (50 or 100 um)","the map at 50 µm",1]],"views":[["default","the window and whatever stands on it"],["cell","close on the picked cell and its 50 µm dome"],["net","close from above"],["bars","amber, at bars"],["score","close on a cell with its score tag"],["sweep","the dome sweeping the window"],["relief","the relief of scored cells"],["low","the relief from low, the sunk blue under the glass"],["split","the two groups' piles"],["omics","the sketches of genes and proteins"]],"reusedBy":[],"reuses":[],"file":"tools/topo/sets/map.js","manifest":"tools/topo/sets/map.md","note":""},
  "topo.tower": {"story":"topo","set":"tower","name":"Tower of scales","tris":1064,"id":"topo/tower","shows":"The poster's patch of 110 real cells with glass balls growing round them, edges and triangles appearing, pieces joining and loops opening and closing, then the tower of scales and its barcode.","size":"plate 1.5 wide; tower 1.68 units with the trunk","frame":"The patch lies on a glass plate with its frosted label towards you, the poster's y running away (-z); the tower rises from it.","params":[["tower_a","0..1","the set's fade, 0 hidden to 1 shown",0],["tower_r","um, 1.5..60 (drawn to 120)","the radius in µm",0],["tower_rise","0..1","0 everything on the plate",0],["tower_bars","0..1","the rods fly out to the board",0],["tower_he","0..1","1: the 110 cells in H&E by their types",0],["tower_lit","0..2 (both, pieces, loops)","0 both, 1 pieces lit",1]],"views":[["default","the tower whole, the plate at its foot, from a little above"],["plate","close on the plate while the balls grow"],["snap","straight down, as the poster's snapshots"],["tower","the tower rising"],["up","from under the glass plate up through the threads"],["bars","the tower and the board of rods and curves"],["stand","the headset view"]],"reusedBy":[],"reuses":[],"file":"tools/topo/sets/tower.js","manifest":"tools/topo/sets/tower.md","note":""},
  "topo.cohort": {"story":"topo","set":"cohort","name":"Slide rack","tris":920,"id":"topo/cohort","shows":"The 123 slides as a rack of glass slides with their curves (66 healthy, 57 cirrhotic), the classes' means, the main shapes, the cube of scores, the classifier's wall with its held-out stacks, and the weight for every radius on a column of radii with windows and a gap.","size":"rack plus a weights column out to x ~2.05; cube of scores 1.6 across","frame":"Rack of slides in two rows stepping up towards the back; weights column at x 2.05; cube of scores 1.6 across.","params":[["cohort_a","0..1","the set's fade, 0 hidden to 1 shown",0],["cohort_dim","0..1 (pieces, loops)","1 loops (h1, the poster's), 0 pieces",1],["cohort_rack","0..1","the slides drop into their slots",0],["cohort_means","0..1","the classes' mean curves in front of their rows",0],["cohort_shapes","0..1","the two main shapes hovering over the rack, their shares as tags",0],["cohort_space","0..1","the slides fly into the cube of their scores",0],["cohort_wall","0..1","the classifier's wall sweeps in to its place",0],["cohort_odds","0..1","the slides glide to their log-odds along the axis through the wall",0],["cohort_stacks","0..1","the slides drop into the four stacks",0],["cohort_gamma","0..1","the column rises",0],["cohort_gap","0..1","the bands drop into the gap's stack",0],["cohort_win","0..1","a window of radii chosen in explore",0],["cohort_from","um, 0..100 (0.5 grid)","the window in µm, rounded to the 0.5 µm grid of the stored shares",0],["cohort_to","um, 0..100.5 (100.5 = and above)","the window in µm, rounded to the 0.5 µm grid of the stored shares",0],["cohort_pick","-1..122 (slide)","a picked slide",1]],"views":[["default","the rack whole, from the front and above"],["rack","close on the rack's front"],["means","the classes' mean curves"],["shapes","the shapes hovering over the rack"],["space","the cube of the scores"],["wall","the classifier's wall nearly edge-on between the two clouds"],["odds","the log-odds scale from healthy to cirrhosis"],["stacks","the four stacks"],["gamma","the column, γ and the means"],["gap","the gap's stack of radius bands, right of everything"],["all","everything at once"]],"reusedBy":[],"reuses":[],"file":"tools/topo/sets/cohort.js","manifest":"tools/topo/sets/cohort.md","note":""},
  "soil.soil": {"story":"soil","set":"soil","name":"Cut-away soil block","tris":1120,"id":"soil/soil","shows":"A cut-away block of soil with a wheat plant (ears, leaves, fibrous roots and root hairs): fertiliser falls and dissolves into amber ammonium, flows of nitrogen climb the roots or pass through the relay (rose nitrite, blue nitrate washing out, lilac N2O rising); a magnified pore with the relay's microbes (archaea, ammonia-oxidising bacteria, nitrite oxidisers, comammox); the BNI halo round the roots, the wild grass and the piece of chromosome moving into…","size":"block 1.2 x 0.8 x 0.7; the plant to 0.83 above it","frame":"The block centred on the origin, its surface at y = 0: 1.2 wide (x), 0.8 deep (z), down to y = -0.7; the wheat at the origin, its awns up to about y = 0.83, its roots…","params":[["soil_a","0..1","the set's fade, 0 hidden to 1 shown",0],["soil_grow","0..1","the plant and its roots grow from nothing",0],["soil_cut","0..1","0 a closed block",0],["soil_fert","0..1","fertiliser grains fall, land, sink a little and dissolve",0],["soil_flow","0..1","how many flow particles run",0],["soil_plant","0..1","the plant's share of the flows",0],["soil_inhibit","0..1","slows the relay's first step",0],["soil_halo","0..1","the BNI halo: a soft teal glow along the roots, seeping outwards",0],["soil_dcd","0..1","yellow DCD granules in the top soil",0],["soil_pore","0..1","a magnified pore grows out of the pore spot",0],["soil_relay","0..4 (eased)","the relay's microbes come in one guild per step",0],["soil_grass","0..1","the wild grass",0],["soil_chrom","0..1","the grass's and the wheat's chromosomes grow in",0],["soil_tracer","0..1","one white atom with a trail",0],["soil_pick","step, -1 or 0..3","a guild lit in the pore",1]],"views":[["default","the block and the plant"],["plant","the shoot"],["roots","low: the roots and the halo"],["surface","from above: the fertiliser, ammonium and N2O"],["pore","the magnified pore filling most of the view"],["relay","close on the relay's microbes in the pore"],["chrom","the wild grass, the wheat and the chromosomes above them"],["tracer","the marked atom's way from grain to leaf"]],"reusedBy":[],"reuses":[],"file":"tools/soil/sets/soil.js","manifest":"tools/soil/sets/soil.md","note":""},
  "soil.field": {"story":"soil","set":"field","name":"Field trial under netting","tris":1053,"id":"soil/field","shows":"The trial's 24 plots in four blocks (two wheat lines, three regimes) under netting, the wheat growing over five dates with its leaves by each plot's measured chlorophyll, ammonium and nitrate under each plot from the data, jars on a bench breathing N2O as read off the slides, 119 soil cores lifting and stacking into the design, and a module of the network lighting the plots where it is strong.","size":"field ~1.8 x 1.2 (2.2 wide with the bench)","frame":"The plots on the x-z plane at y = 0 (about 1.8 by 1.2), a soil slab under them to y = -0.25, the wheat up to about 0.3, the netting at 0.42, the jars on a bench at x =…","params":[["field_a","0..1","the set's fade, 0 hidden to 1 shown",0],["field_grow","0..1","the wheat grows from bare soil",0],["field_date","0..4 (days 1, 15, 24, 53, 70; eased)","the sampling date",0],["field_net","0..1","the netting, drawn across from left to right",0],["field_chl","0..1","0 a uniform green",0],["field_nh4","0..1","each plot's top soil glows amber with its ammonium at the date",0],["field_no3","0..1","blue light seeps down under each plot into the slab, as deep and bright as its nitrate at the date, with…",0],["field_jars","0..1","the bench and the jars",0],["field_jday","step, -1..4","the date whose soil is in the jars",1],["field_inc","0..1 (0 to 22 days)","the incubation's time",0],["field_cores","0..1","at each date a core lifts out of every plot sampled",0],["field_stack","0..1","the cores fly in arcs into the stack of the design",0],["field_module","step, -1..16","a module of the network",1],["field_mlit","0..1","each plot glows in the module's colour as far as the module's score in its sample at the date",0],["field_pick","step, -1..5 (line * 3 + regime)","a group of plots lit, the others dimmed",1],["field_tags","0..1","tags on the picked group's four plots",0],["field_show","step, 0..4","the measure: 0 chlorophyll, 1 ammonium, 2 nitrate, 3 N2O",1],["field_life","0..1","not built (the life-size field was optional)",0],["field_line","step, -1, 0, 1","only one wheat line's plots lit",1],["field_fert","step, -1..2","only one regime's plots lit",1]],"views":[["default","the whole field from above a front corner"],["low","among the wheat, day 70's colours"],["plots","from above, for the tags"],["under","the slab's side"],["jars","from the bench's side, the field behind"],["stack","the stack of 119 cores behind the field"],["cloud","the field small under the cloud"],["stand","eye level at the front plots"]],"reusedBy":[],"reuses":["flock/flock (its swaying reeds adapted as the wheat)","ovary/charts (its stacking movement adapted for the cores)"],"file":"tools/soil/sets/field.js","manifest":"tools/soil/sets/field.md","note":""},
  "soil.net": {"story":"soil","set":"net","name":"Microbe cloud and network","tris":1012,"id":"soil/net","shows":"The soil's crowd of microbes as a deep cloud (20,000 kinds by phylum: the common ones in its core, the rare ones in a faint shell), the nitrifiers flaring in their guilds' colours, the co-occurrence network of 1,564 kinds and 22,348 links pulling out of the core, a shuffle dissolving every link, its 17 modules in colour, and the halves' own networks side by side (by wheat line, fertiliser or at random).","size":"cloud radius ~0.7; network radius ~0.6","frame":"In the field set's frame: the cloud centred at (0, 1.3, 0), radius about 0.7; the network scaled to radius about 0.6; split copies at x -0.6 and 0.6 (three: -0.8, 0…","params":[["net_a","0..1","the set's fade, 0 hidden to 1 shown",0],["net_cloud","0..1","the cloud of 20,000 kinds appears from the centre outwards with a bright front",0],["net_nitro","0..1","the nitrifiers' kinds flare in their guilds' colours, larger, with their tags",0],["net_pull","0..1","the network's 1,564 kinds fly out of the core to their stored layout",0],["net_links","0..1","the 22,348 links fade in",0],["net_shuffle","0..1","the links shiver and fade to nothing while the kinds scatter a little",0],["net_mods","0..1","kinds and links take their module's colour",0],["net_rho","0.6..0.8","only the strongest links",0],["net_focus","step, -1..16","a module lit, the rest dimmed",1],["net_split","0..1","the network's copies move apart and fade in, each showing only the links its half's own network also has…",0],["net_splitBy","step, 0..2","0 wheat line (two copies), 1 fertiliser",1],["net_kind","step, -1.. (cloud index)","one kind picked",1]],"views":[["default","the whole cloud over the field"],["cloud","the whole cloud over the field"],["core","close on the cloud's core of common kinds"],["net","the network pulled out of the core"],["module","the network with the field below"],["split","the copies side by side"],["over","from above: the network over the field"]],"reusedBy":[],"reuses":["endo/net (adapted, not reused)"],"file":"tools/soil/sets/net.js","manifest":"tools/soil/sets/net.md","note":""},
  "pass.fish": {"story":"pass","set":"fish","name":"School of fish","tris":802,"id":"pass/fish","shows":"A school of 300 fish (30 to 600, a live simulation) all around you, each watching its seven nearest neighbours; water, seabed with caustics, rocks, seagrass, light shafts; a shark you steer or that comes now and then; the school can be pulled apart by watching fewer neighbours.","size":"life size; fish 0.27 m long","frame":"Life size: 1 unit = 1 m, eyes at the origin (1.6 m), seabed 6.5 m below, surface 15 m above.","params":[["fish_a","0..1","the set's fade, 0 hidden to 1 shown",0],["fish_n","30..600","how many fish (30-600",1],["fish_k","1..12","neighbours each fish watches",1],["fish_links","0..1","the network: 0 hidden, 1 shown",0],["fish_water","0..1","the water and everything in it",0],["fish_shark","0..1","above 0.5 a shark comes now and then",0],["fish_hunt","counter (shark at each whole number)","a shark each time this passes a whole number",1],["fish_scale","0..1","the whole set's size on top of life size",0]],"views":[["default","among the fish, life size, looking up a little"],["up","looking up to the light"],["near","from just outside the school"],["afar","the whole school from outside"],["above","high above, looking down on the school"]],"reusedBy":[],"reuses":["flock/flock (simulation adapted, not reused)"],"file":"tools/pass/sets/fish.js","manifest":"tools/pass/sets/fish.md","note":""},
  "pass.globe": {"story":"pass","set":"globe","name":"Globe with an outbreak","tris":1156,"id":"pass/globe","shows":"The airports story's globe exactly as it is (3,214 airports, 18,858 routes), driven from params, with a seeded S/E/I/R outbreak on its real routes: pick a start airport, set incubation, infectious days, spread and flights cut, and play the days.","size":"radius 1","frame":"Radius 1, centred on the origin, y up, longitude 0 towards +x, 90 E towards -z.","params":[["globe_a","0..1","the set's fade, 0 hidden to 1 shown",0],["globe_reveal","0..1","the airports and routes appear",0],["globe_routes","0..1","brightness of the routes",0],["globe_hubs","0..1","airports coloured by their number of routes",0],["globe_pillars","0..1","pillars by number of routes",0],["globe_dim","0..1","dims the plain airports and routes, so the outbreak's colours stand out",0],["globe_out","0..1","the outbreak shown",0],["globe_day","days, 0..end of outbreak","the outbreak's day",1]],"views":[["default","Europe, Africa and Asia"],["europe","close over Europe"],["world","the whole globe from afar"],["atlantic","the Atlantic with Europe and the Americas"],["asia","Asia"],["start","turned to the start city by setup"]],"reusedBy":[],"reuses":["stories/airports.js (globe cut out unchanged)"],"file":"tools/pass/sets/globe.js","manifest":"tools/pass/sets/globe.md","note":""},
  "pass.cell": {"story":"pass","set":"cell","name":"The cell, a relay","tris":1016,"id":"pass/cell","shows":"The cell map story's cell exactly as it is (249 proteins in 13 places, 252 links, 10 organelles, 7 moves): organelles appear one by one, proteins and links by place or colour, the growth signal from EGF to SRF, the TNF to NF-kB relay, and the moves that go wrong (CFTR in the ER, TDP-43 leaving the nucleus).","size":"radius 1","frame":"Radius 1, centred on the origin; a cell about 20 micrometres across, the membrane a slightly flattened ellipsoid.","params":[["cell_a","0..1","the set's fade, 0 hidden to 1 shown",0],["cell_org","0..10","organelles shown",0],["cell_shell","0..1","the organelles' skins",0],["cell_reveal","0..1","proteins and links appear",0],["cell_links","0..1","brightness of the links",0],["cell_ids","0..1","the dotted links between the copies of one protein",0],["cell_multi","0..1","colour by number of places instead of by place",0],["cell_focus","0..1","the rest dims, the growth signal's proteins glow as the signal reaches them",0],["cell_ex","0..1","two proteins meet",0],["cell_cue","0..1","the relay from TNF to NF-kB's brake",0],["cell_cue_a","0..1","the relay from TNF to NF-kB's brake",0],["cell_path","0..10 (hops)","the growth signal, in hops",0],["cell_path_a","0..1","the growth signal, in hops",0],["cell_names","0..1","the organelles' names as labels",0],["cell_nfkb","0..1","how far each of the cell map's moves has gone",0],["cell_apop","0..1","how far each of the cell map's moves has gone",0],["cell_tfeb","0..1","how far each of the cell map's moves has gone",0],["cell_glut4","0..1","how far each of the cell map's moves has gone",0],["cell_nrf2","0..1","how far each of the cell map's moves has gone",0],["cell_als","0..1","how far each of the cell map's moves has gone",0],["cell_cf","0..1","how far each of the cell map's moves has gone",0]],"views":[["default","the whole cell"],["nucleus","close on the nucleus"],["signal","the growth signal from EGF outside to SRF in the nucleus"],["nfkb","the NF-kB relay"],["cf","CFTR caught in the wrong place"],["als","TDP-43 leaving the nucleus"]],"reusedBy":[],"reuses":["stories/spatial.js (cell cut out unchanged)"],"file":"tools/pass/sets/cell.js","manifest":"tools/pass/sets/cell.md","note":""},
  "flock.flock": {"story":"flock","set":"flock","name":"Starlings at dusk","tris":609,"id":"flock/flock","shows":"Starlings at dusk all around you: 200 birds (50 to 400, a live simulation), each following its seven nearest neighbours, keeping its distance and fleeing a falcon with alarm passing between neighbours; sky, a lake, trees and reeds; the flock swoops round you every 88 s.","size":"life size; sky to the horizon, 2,600 reeds within 32 m","frame":"Life size: 1 unit = 1 m, the viewer at the origin, ground y = 0, the sun sets towards -z.","params":[["flock_a","0..1","the set's fade, 0 hidden to 1 shown",0],["flock_birds","50..400","how many birds",1],["flock_links","0..1","the network: 0 hidden, 1 shown",0],["flock_sky","0..1","the sky, land and reeds",0],["flock_falcon","0..1","above 0.5 a falcon comes now and then",0],["flock_hunt","counter (falcon at each whole number)","a falcon each time this passes a whole number",1]],"views":[["default","standing in the field, looking up at the sky"],["up","looking steeply up"],["afar","the engine aims it at the flock"]],"reusedBy":[],"reuses":[],"file":"tools/flock/sets/flock.js","manifest":"tools/flock/sets/flock.md","note":""},
  "robots.robots": {"story":"robots","set":"robots","name":"Robot vacuum gang","tris":864,"id":"robots/robots","shows":"A gang of 6 to 24 robot vacuums (a live simulation) in a living room: dock, bump and turn, follow you, conga line or keep away; each robot follows rules about who it follows, which is the network. On a screen the model living room; in a headset your own room from detected planes and meshes.","size":"life size; robot radius 0.17 m","frame":"Life size: 1 unit = 1 m, floor at y = 0 in the set's own frame; the room description {kind, floor, walls, blocks} is set with setRoom().","params":[["robots_a","0..1","the set's fade, 0 hidden to 1 shown",0],["robots_rule","0..4","0 dock, 1 bounce, 2 follow, 3 chain, 4 flee",1],["robots_n","1..24","how many robots, 1 to 24",1],["robots_trails","0..1","the cleaned area's cyan tint",0],["robots_links","0..1","who follows whom",0],["robots_scan","0..1","the room-finding sweep",0],["robots_room","0..1","1 draw the room",0],["robots_walk","0..1","when 1 the avatar strolls",1],["robots_dust","counter","counter: dusty again at each whole number",1],["robots_crumbs","counter","counter: a pile at each whole number",1]],"views":[["default","the whole room from above and to one side"],["low","low, near the floor"],["eyes","a stand-in at head height"]],"reusedBy":[],"reuses":[],"file":"tools/robots/sets/robots.js","manifest":"tools/robots/sets/robots.md","note":""},
  "airports.globe": {"story":"airports","set":"globe","name":"Globe of flights","tris":1190,"id":"airports","shows":"One scene: the globe of 3,214 airports and 18,858 routes (pillars, arcs, communities, closures, a shortest path). Chapters: Intro, Nodes, Edges, Degree, Hubs, Shortest paths, Betweenness, Communities, Robustness, Recap. Explore tabs: Airport, Paths, Hubs, Communities, Closures.","size":"","frame":"","params":[],"views":[],"reusedBy":["pass/globe"],"reuses":[],"file":"stories/airports.js","manifest":"","note":"A hand-written story: its scene is code in the story itself, not a set, so it has no params or named views to list."},
  "proteins.cell": {"story":"proteins","set":"cell","name":"Cell of proteins","tris":1058,"id":"proteins","shows":"One scene: 254 curated proteins and 375 interactions as a network in a cell. Chapters: Intro, Proteins, Interactions, Hubs, Essential, Modules, Disease modules, Drug targets, Robustness, Recap. Explore tabs: Protein, Paths, Hubs, Modules, Knockouts.","size":"","frame":"","params":[],"views":[],"reusedBy":[],"reuses":[],"file":"stories/proteins.js","manifest":"","note":"A hand-written story: its scene is code in the story itself, not a set, so it has no params or named views to list."},
  "spatial.cell": {"story":"spatial","set":"cell","name":"Model cell","tris":1148,"id":"spatial","shows":"One scene: a model cell with 13 compartments, 249 proteins and 252 links. Chapters: Intro, Compartments, Addresses, Meeting, Many places, Signals, Moving, Proximity, Wrong place, Recap. Explore tabs: Protein, Paths, Places, Moves, Proximity.","size":"","frame":"","params":[],"views":[],"reusedBy":["pass/cell"],"reuses":[],"file":"stories/spatial.js","manifest":"","note":"A hand-written story: its scene is code in the story itself, not a set, so it has no params or named views to list."},
};
const CARD_KEYS = Object.keys(DESIGN_CARDS);
// the stories in the shell's order (their colours and titles), then any the shell does not list
const STORIES = (() => {
  const L = (HOST.list || []).filter(s => CARD_KEYS.some(k => DESIGN_CARDS[k].story === s.key)).map(s => ({ key: s.key, kick: s.kick, title: s.title, col: s.col }));
  for (const k of CARD_KEYS) { const st = DESIGN_CARDS[k].story; if (!L.some(s => s.key === st)) L.push({ key: st, kick: st, title: st, col: '#95a6bd' }); }
  return L.map(s => Object.assign(s, { keys: CARD_KEYS.filter(k => DESIGN_CARDS[k].story === s.key) }));
})();
const storyOf = k => STORIES.find(s => s.key === (DESIGN_CARDS[k] || {}).story) || { key: '', kick: '', title: '', col: '#95a6bd', keys: [] };

// ================================================================== SETS ==
// The one set: the table, life size (1 unit is 1 m, the floor at y = 0), its plates, the miniatures and the stage.
const SETS = {};
// The props table (manifest: table.md). Life size: 1 unit is 1 m, the floor at y = 0, the table round the origin with
// its top at 0.86 m. Round its rim a plate per story in the story's colour, a place card at its edge naming the story,
// and the story's miniatures standing on it (12 cm, turned to face out); in the middle the stage, where the picked prop
// stands 40 cm tall and turns slowly. The models come from lowpoly.js (feed); they are built a few per frame
// (update -> buildSome), so the table fills in without a stall. A miniature moved by hand keeps a record of where it
// was put (rec: [x, y, z, qx, qy, qz, qw, s] in this frame, rounded; s its size, 1 its own), the room's in a shared
// room; without one it stands at home on its plate. Anything else glides to where it should be.
SETS.table = function (K) {
  const group = new THREE.Group();
  const TOP = 0.86, R = 1.15, PLATE = 0.012, MINI = 0.12, STAGE_R = 0.28, STAGE_Y = TOP + 0.05, BIG = 0.4;
  const RINGS = [0.98, 0.82, 0.66, 0.5], STEP = 0.16, CARD_R = 1.105, CARD_H = 0.062, CARD_W = 0.25;
  const disposable = [];
  const keep = x => (disposable.push(x), x);
  const std = o => keep(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0.12 }, o)));
  const basic = o => keep(new THREE.MeshBasicMaterial(o));
  const mesh = (geo, mat, p) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); return m; };
  const flat = g => g.rotateX(-Math.PI / 2);   // a shape in the x-y plane laid on the floor, facing up
  const NAVY = new THREE.Color('#15233b');
  // a soft round glow (additive), for the stage and the highlights
  const glowTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d'), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    return keep(new THREE.CanvasTexture(cv));
  })();
  const glowMat = (col, o) => basic({ map: glowTex, color: col, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });

  // ---- the floor (hidden in passthrough: table_floor 0) and the table
  const floor = new THREE.Group(), floorDisc = mesh(flat(new THREE.CircleGeometry(5, 72)), std({ color: 0x070d19, roughness: 0.95, metalness: 0 }));
  floor.add(floorDisc);
  for (const [r, o] of [[1.6, 0.3], [2.7, 0.16]]) { const m = mesh(flat(new THREE.RingGeometry(r, r + 0.014, 120)), basic({ color: 0x46d9ff, transparent: true, opacity: o, depthWrite: false })); m.position.y = 0.002; floor.add(m); }
  group.add(floor);
  const table = new THREE.Group(), tableTop = mesh(new THREE.CylinderGeometry(R, R, 0.045, 96), std({ color: NAVY, roughness: 0.55, metalness: 0.2 }), [0, TOP - 0.0225, 0]);
  table.add(tableTop);
  table.add(mesh(new THREE.CylinderGeometry(R + 0.004, R + 0.004, 0.01, 96, 1, true), basic({ color: 0x2397c4 }), [0, TOP - 0.006, 0]));   // the glowing rim
  table.add(mesh(new THREE.CylinderGeometry(0.11, 0.17, TOP - 0.07, 24), std({ color: 0x0e1828 }), [0, (TOP - 0.07) / 2 + 0.03, 0]));
  table.add(mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.03, 48), std({ color: 0x0e1828 }), [0, 0.015, 0]));
  table.add(mesh(flat(new THREE.RingGeometry(0.4, 0.406, 96)), basic({ color: 0x2397c4, transparent: true, opacity: 0.5 }), [0, TOP + 0.001, 0]));
  // the stage: a dark drum with a glowing edge and a soft light on it
  table.add(mesh(new THREE.CylinderGeometry(STAGE_R, STAGE_R + 0.012, 0.05, 64), std({ color: 0x0f1b2e, roughness: 0.4, metalness: 0.3 }), [0, TOP + 0.025, 0]));
  table.add(mesh(flat(new THREE.RingGeometry(STAGE_R - 0.012, STAGE_R, 64)), basic({ color: 0x46d9ff }), [0, STAGE_Y + 0.001, 0]));
  const stageGlow = mesh(flat(new THREE.PlaneGeometry(1.1, 1.1)), glowMat(0x46d9ff, 0.22), [0, STAGE_Y + 0.002, 0]);
  table.add(stageGlow);
  group.add(table);

  // ---- the plates, their place cards and the miniatures' homes (layout)
  const minis = new Map(), plates = [], order = [];
  let cardsCv = null, cardsTex = null, groups = [];
  const angleOf = (x, z) => Math.atan2(x, z);
  const at = (r, a, y) => new THREE.Vector3(r * Math.sin(a), y, r * Math.cos(a));
  // an annular sector of the table top (angles a0..a1, x = r sin a, z = r cos a), h thick, standing on y = 0
  function sector(r0, r1, a0, a1, h) {
    const sh = new THREE.Shape(), n = Math.max(6, Math.round((a1 - a0) * 40));
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; sh[i ? 'lineTo' : 'moveTo'](r1 * Math.sin(a), -r1 * Math.cos(a)); }
    for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; sh.lineTo(r0 * Math.sin(a), -r0 * Math.cos(a)); }
    return new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2);
  }
  // the place cards: one canvas, a row per story (512 x 128 for a card 0.25 m wide; a narrower card shows part of it)
  function drawCards() {
    if (!cardsCv) return;
    const c = cardsCv.getContext('2d'), W = 512, H = 128, font = (px, w) => `${w || 400} ${px}px B612, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    c.clearRect(0, 0, cardsCv.width, cardsCv.height);
    groups.forEach((G, i) => {
      const y = i * H, w = Math.round(W * G.cardW / CARD_W);
      c.fillStyle = '#0b1526'; c.fillRect(0, y, w, H);
      c.fillStyle = G.col; c.fillRect(0, y, w, 8);
      c.textBaseline = 'top'; c.textAlign = 'center';
      const fit = (t, px, wt, maxW) => { let s = px; for (; s > 14; s--) { c.font = font(s, wt); if (c.measureText(t).width <= maxW) break; } return s; };
      fit(G.kick.toUpperCase(), 28, 700, w - 24); c.fillStyle = G.col; c.fillText(G.kick.toUpperCase(), w / 2, y + 20);
      fit(G.title, 50, 700, w - 24); c.fillStyle = '#e7eef8'; c.fillText(G.title, w / 2, y + 58);
    });
    cardsTex.needsUpdate = true;
  }
  // groups: [{ key, col, kick, title, keys: [miniature keys] }] in their order round the table, from the front (+z),
  // the viewer's side, round to the right. Each story's share of the rim grows with its count; its miniatures stand on
  // rings from the rim inwards, 16 cm apart
  function layout(G) {
    groups = G;
    const W = G.reduce((a, g) => a + g.keys.length + 1.2, 0), unit = Math.PI * 2 / W;
    cardsCv = document.createElement('canvas'); cardsCv.width = 512; cardsCv.height = 128 * Math.max(1, G.length);
    cardsTex = keep(new THREE.CanvasTexture(cardsCv)); cardsTex.anisotropy = 4;
    const cardMat = basic({ map: cardsTex }), backMat = std({ color: 0x0b1526 });
    let a = -unit * (G[0] ? (G[0].keys.length + 1.2) / 2 : 0);   // the first story's middle at the front
    G.forEach((g, gi) => {
      const span = unit * (g.keys.length + 1.2), a0 = a, a1 = a + span, mid = (a0 + a1) / 2, m = 0.018;
      a += span;
      // fill the rings from the rim inwards
      const slots = [];
      let left = g.keys.length, ri = 0, rin = RINGS[0];
      while (left > 0 && ri < RINGS.length) {
        const r = RINGS[ri], cap = Math.max(1, Math.floor(((span - 2 * m) * r - 0.02) / STEP) + 1), n = Math.min(left, cap);
        for (let j = 0; j < n; j++) slots.push([r, mid + (j - (n - 1) / 2) * STEP / r]);
        left -= n; rin = r; ri++;
      }
      const col = new THREE.Color(g.col), plate = mesh(sector(rin - 0.085, R - 0.075, a0 + m, a1 - m, PLATE), std({ color: col.clone().lerp(NAVY, 0.7), roughness: 0.5 }), [0, TOP, 0]);
      group.add(plate);
      const edge = mesh(flat(new THREE.RingGeometry(R - 0.083, R - 0.075, Math.max(8, Math.round(span * 40)), 1, a0 + m - Math.PI / 2, span - 2 * m)), basic({ color: col }), [0, TOP + PLATE + 0.0008, 0]);
      group.add(edge);
      // the place card at the rim, leaning back, facing out
      const cw = Math.min(CARD_W, (span - 2 * m) * CARD_R - 0.02);
      g.cardW = cw;
      const geo = new THREE.PlaneGeometry(cw, CARD_H), uv = geo.attributes.uv, v0 = 1 - (gi + 1) / G.length, v1 = 1 - gi / G.length, u1 = cw / CARD_W;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u1, v0 + (v1 - v0) * uv.getY(i));
      const card = new THREE.Group(), lean = 0.42;
      card.position.copy(at(CARD_R, mid, TOP + PLATE + Math.cos(lean) * CARD_H / 2));
      card.rotation.set(-lean, mid, 0, 'YXZ');
      card.add(new THREE.Mesh(geo, cardMat));
      const back = new THREE.Mesh(new THREE.PlaneGeometry(cw, CARD_H), backMat); back.rotation.y = Math.PI; card.add(back);
      group.add(card);
      plates.push({ key: g.key, mid, r: (rin + R) / 2, plate, card });
      g.keys.forEach((k, j) => {
        const [r, sa] = slots[j], home = at(r, sa, TOP + PLATE), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sa);
        const holder = new THREE.Group();
        holder.position.copy(home); holder.quaternion.copy(q); holder.scale.setScalar(MINI);
        // its home: a dark disc ringed in the story's colour (seen while the miniature is built, or moved away)
        const mark = mesh(flat(new THREE.CircleGeometry(0.058, 28)), std({ color: 0x0a1424, roughness: 0.7 }), [home.x, TOP + PLATE + 0.0006, home.z]);
        mark.add(mesh(flat(new THREE.RingGeometry(0.054, 0.06, 28)), basic({ color: col, transparent: true, opacity: 0.7 }), [0, 0.0004, 0]));
        group.add(mark);
        // what the pointer finds: an unseen box round the model (sized once it is built)
        const proxy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basic({ visible: false }));
        proxy.position.y = 0.5; proxy.userData.key = k;
        holder.add(proxy);
        group.add(holder);
        minis.set(k, { key: k, holder, proxy, home, homeQ: q, rec: null, carry: false, s: 1, model: null, h: 1, hover: 0 });
        order.push(k);
      });
    });
    drawCards();
  }

  // ---- the models
  let MODELS = null;
  const queue = [];
  const feed = M => { MODELS = M; queue.length = 0; for (const k of order) if (M[k] && !minis.get(k).model) queue.push(k); };
  function buildOne(k) {
    const m = minis.get(k);
    if (!m || m.model || !MODELS || !MODELS[k]) return false;
    const g = MODELS[k].build(THREE);
    const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    m.proxy.scale.set(Math.max(0.35, sz.x), Math.max(0.35, sz.y), Math.max(0.35, sz.z)); m.proxy.position.copy(c);
    m.h = Math.max(0.2, bb.max.y);
    m.holder.add(g); m.model = g;
    const i = queue.indexOf(k); if (i >= 0) queue.splice(i, 1);
    return true;
  }
  // build for up to ms milliseconds (at least one); the picked one first
  function buildSome(ms) {
    const t0 = performance.now();
    let n = 0;
    if (pick && !minis.get(pick).model && buildOne(pick)) n++;
    while (queue.length && (n === 0 || performance.now() - t0 < ms)) if (buildOne(queue[0])) n++; else queue.shift();
    return n;
  }
  const built = () => order.filter(k => minis.get(k).model).length;

  // ---- hover, pick and the stage
  let hover = null, pick = null, stageModel = null, stageGrow = 0, stageTurn = 0;
  const stage = new THREE.Group();
  stage.position.set(0, STAGE_Y, 0);
  group.add(stage);
  const ring = (col, o) => { const m = mesh(flat(new THREE.RingGeometry(0.068, 0.082, 40)), basic({ color: col, transparent: true, opacity: o, depthWrite: false }), [0, 0, 0]); m.visible = false; group.add(m); return m; };
  const hoverRing = ring(0x9fe8ff, 0.95), pickRing = ring(0xffffff, 0.9);
  const hoverGlow = mesh(flat(new THREE.PlaneGeometry(0.26, 0.26)), glowMat(0x46d9ff, 0.5));
  hoverGlow.visible = false; group.add(hoverGlow);
  function setPick(k) {
    k = k && minis.has(k) ? k : null;
    if (k === pick && (stageModel || !k)) return;
    pick = k;
    if (stageModel) { stage.remove(stageModel); stageModel = null; }
    if (!k) return;
    buildOne(k);
    const m = minis.get(k);
    if (m.model) { stageModel = m.model.clone(); stage.add(stageModel); stageGrow = 0; }
    pickRing.material.color.set(storyCol(k));
  }
  let storyCol = () => '#ffffff';

  // ---- moved miniatures: records, glides and carrying
  const r3 = v => Math.round(v * 1000) / 1000, r2 = v => Math.round(v * 100) / 100;
  const okRec = a => Array.isArray(a) && a.length === 8 && a.every(Number.isFinite) && Math.abs(a[0]) <= 6 && Math.abs(a[2]) <= 6 && a[1] >= 0 && a[1] <= 3 &&
    a[7] >= 0.5 && a[7] <= 4 && Math.hypot(a[3], a[4], a[5], a[6]) > 0.5;
  const poseRec = m => { const p = m.holder.position, q = m.holder.quaternion; return [r3(p.x), r3(p.y), r3(p.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w), r2(m.s)]; };
  // a miniature's record: where it was put, as the room has it (while carried here, where it is now)
  const recOf = k => { const m = minis.get(k); return !m ? null : m.carry ? poseRec(m) : m.rec; };
  function setRec(k, a) { const m = minis.get(k); if (m) m.rec = okRec(a) ? a.slice() : null; }
  // carried by a hand: placed straight where it is (p and q in this frame), s its size
  function carryTo(k, p, q, s) {
    const m = minis.get(k);
    if (!m) return;
    m.carry = true; m.holder.position.copy(p); m.holder.quaternion.copy(q); m.s = clamp(s, 0.5, 4);
    if (m.holder.position.y < 0) m.holder.position.y = 0;
  }
  // let go: it stays where it is (rounded, as the room keeps it)
  function drop(k) { const m = minis.get(k); if (!m || !m.carry) return; m.carry = false; m.rec = poseRec(m); }
  function tidy() { for (const m of minis.values()) { m.carry = false; m.rec = null; } }
  const _tp = new THREE.Vector3(), _tq = new THREE.Quaternion();
  function glide(dt) {
    const k = 1 - Math.exp(-dt * 8);
    for (const m of minis.values()) {
      if (!m.carry) {
        if (m.rec) { _tp.fromArray(m.rec, 0); _tq.fromArray(m.rec, 3).normalize(); } else { _tp.copy(m.home); _tq.copy(m.homeQ); }
        const ts = m.rec ? m.rec[7] : 1;
        m.holder.position.lerp(_tp, k); m.holder.quaternion.slerp(_tq, k); m.s += (ts - m.s) * k;
      }
      m.hover += ((m.key === hover ? 1 : 0) - m.hover) * (1 - Math.exp(-dt * 12));
      m.holder.scale.setScalar(MINI * m.s * (1 + 0.15 * m.hover));
    }
  }
  // the rings and the glow under the hovered and the picked miniature, wherever it stands
  function marks() {
    for (const [r, k] of [[hoverRing, hover], [pickRing, pick]]) {
      const m = k && minis.get(k);
      r.visible = !!(m && m.model);
      if (!r.visible) continue;
      r.position.set(m.holder.position.x, m.holder.position.y + 0.0015, m.holder.position.z);
      r.scale.setScalar(m.s * (r === hoverRing ? 1.12 : 1));
    }
    hoverGlow.visible = hoverRing.visible;
    if (hoverGlow.visible) { hoverGlow.position.copy(hoverRing.position); hoverGlow.position.y += 0.001; hoverGlow.scale.setScalar(minis.get(hover).s); }
  }

  const params = { table_a: 1, table_floor: 1 };
  return {
    group, params,
    setAlpha(a) { group.visible = a > 0.01; },
    update(S, t, dt) {
      floor.visible = (S.table_floor === undefined ? 1 : S.table_floor) > 0.5;
      if (MODELS && queue.length) buildSome(5);
      glide(dt || 0);
      marks();
      if (stageModel) {
        stageGrow = Math.min(1, stageGrow + (dt || 0) * 2.2);
        stageTurn += (dt || 0) * 0.45;
        stageModel.scale.setScalar(BIG * smooth(stageGrow));
        stageModel.rotation.y = stageTurn;
      }
      stageGlow.material.opacity = 0.14 + 0.1 * (stageModel ? smooth(stageGrow) : 0);
    },
    anchors: {
      centre: [0, TOP, 0],
      // over the hovered miniature, and over the prop on the stage
      hover: () => { const m = hover && minis.get(hover); return m ? [m.holder.position.x, m.holder.position.y + MINI * m.s * (1 + 0.15 * m.hover) * m.h + 0.012, m.holder.position.z] : [0, TOP, 0]; },
      stage: () => [0, STAGE_Y + BIG * (pick && minis.get(pick) ? minis.get(pick).h : 1) + 0.03, 0],
    },
    labels: [],
    // views [az, el, dist, tx, ty, tz]: the whole table from the front, the stage close, from above
    cam: { default: [0, 38, 4.3, 0, 0.66, 0.05], stage: [0, 16, 1.35, 0, STAGE_Y + 0.17, 0], above: [0, 78, 3.6, 0, TOP, 0] },
    controls: [], explore: () => ({}),
    // the table's own
    layout, feed, buildSome, built, total: () => order.length, keys: () => order.slice(), drawCards,
    colours(fn) { storyCol = fn; },
    pickables: () => order.map(k => minis.get(k)).filter(m => m.model).map(m => m.proxy),
    setHover(k) { hover = k && minis.has(k) ? k : null; }, hovered: () => hover,
    setPick, picked: () => pick, stageModel: () => stageModel,
    mini: k => minis.get(k), recOf, setRec, carryTo, drop, tidy, okRec,
    moved: () => order.filter(k => recOf(k)),
    // a close view of a story's plate, from outside the table
    groupView(key) { const p = plates.find(x => x.key === key); if (!p) return null; const d = p.mid / D2R; return [d, 36, 1.05, Math.sin(p.mid) * p.r * 0.92, TOP + 0.04, Math.cos(p.mid) * p.r * 0.92]; },
    plateOf: key => plates.find(x => x.key === key) || null,
    dispose() { for (const x of disposable) x.dispose(); },
    solid: [tableTop, floorDisc],   // (the pointer's dot lands on these)
    TOP, STAGE_Y,
  };
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear (one: the table)
const SET_ORDER = ['table'];
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 200);
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // lit as the app's props are: a sky light, a light from over your shoulder, and a cool rim light from behind
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x1a2233, 0.85));
  GL.sun = new THREE.DirectionalLight(0xffffff, 0.85);
  scene.add(GL.sun); scene.add(GL.sun.target);
  GL.rim = new THREE.DirectionalLight(0x6fb6ff, 0.55);
  scene.add(GL.rim); scene.add(GL.rim.target);
  // stars (kept for the engine's sake; the room has none)
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  GL.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false }));
  scene.add(GL.stars); GL.stars.visible = false;
  // (the table, built on its own as a step of the load: buildSet, LOAD)
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
  // the plates, by story round the table; a story's colour for its picked miniature's ring
  const T = GL.sets.table;
  T.layout(STORIES);
  T.colours(k => storyOf(k).col);
  if (document.fonts) document.fonts.ready.then(() => { if (!GL.gone) T.drawCards(); }).catch(() => {});
  // the room's first view (the story and explore mode, built next, start from it)
  orbit.cur = view('table', 'default');
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
  GL.camera.position.y = Math.max(GL.camera.position.y, 0.15);   // never under the floor
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
// the sun comes from over the viewer's left shoulder, the rim light from behind the table; point sizes follow the screen
const LV = new THREE.Vector3(), _v2 = new THREE.Vector2();
function updateLight(xr) {
  const q = xr ? XR.headQ : GL.camera.quaternion;
  LV.set(-0.5, 0.6, 1.0).normalize().applyQuaternion(q);
  GL.sun.position.copy(LV); GL.sun.target.position.set(0, 0, 0);
  LV.set(0.3, 0.5, -1.0).normalize().applyQuaternion(q);
  GL.rim.position.copy(LV); GL.rim.target.position.set(0, 0, 0);
  if (xr) K.U.uPx.value = XR.viewH * 0.5 * XR.R;
  else K.U.uPx.value = GL.renderer.getDrawingBufferSize(_v2).y * 0.5;
}

// ================================================================== STORY ==
// The design room tells no story: its "story" is one short intro line (the table seen from the door, then the walk
// up to it) for a new wearer or a Replay, and it opens straight into explore mode. The engine's clock, chapters and
// slideshow stay as every story has them, so the shell and the shared rooms treat it like the others.
const NARRATION_SYNC = [[0, 0], [6, 6]];
// recording time -> story time (no recording: the same)
function storyT(t) {
  const W = NARRATION_SYNC;
  if (t <= 0) return 0;
  for (let i = 1; i < W.length; i++) {
    if (t <= W[i][0]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return o0 + (o1 - o0) * (t - n0) / (n1 - n0); }
  }
  return W[W.length - 1][1] + (t - W[W.length - 1][0]);
}
// story time -> recording time
function narrT(o) {
  const W = NARRATION_SYNC;
  for (let i = 1; i < W.length; i++) {
    if (o <= W[i][1]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return n0 + (n1 - n0) * (o - o0) / (o1 - o0); }
  }
  return W[W.length - 1][0] + (o - W[W.length - 1][1]);
}
let T_END = NARRATION_SYNC[NARRATION_SYNC.length - 1][0];
const CH = [{ key: 'table', name: 'The props table', a: 0, b: 6 }];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); });
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest
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
  const html = {
    table: `<h1 data-at="0.3">The props table</h1>
      <p class="lede" data-at="0.9">Every prop of the stories, small, on one table.</p>
      <p data-at="1.6">${CARD_KEYS.length} models of the 3D sets the ${STORIES.length} stories are made of, a plate for each story. Point at one to see its name; put it on the stage to see what it is made of.</p>
      <p data-at="2.4"><button class="btn primary" type="button" id="btnGoExplore">To the table</button></p>`,
  };
  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });
  // the table fades in; the camera comes up to it from across the room
  ramp('table_a', 0, 0.8, 0, 1);
  // sound effects (sfxCue: story time, a sound, where it comes from, its options); the rest is explore's (e4_explore.js)
  sfxCue(0.2, 'rise', 'table', 'centre', { dur: 2, gain: 0.4 });   // the table fades in
  const wp = [];
  const cam = (t, name, nudge) => { const v = view('table', name); if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0; wp.push([t, ...v, '', 'table']); };
  cam(0, 'default', [-30, -16, 2.4, 0, 0.2, 0]);
  cam(5.5, 'default');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set], turning the short way round
function buildCamera(wp) {
  wp.sort((x, y) => x[0] - y[0]);
  let prev = null;
  ST.wp = wp.map(w => {
    let az = w[1];
    if (prev !== null) az += 360 * Math.round((prev - az) / 360);
    prev = az;
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7]];
  });
}
function storyCam(t) {
  const wp = ST.wp;
  if (t <= wp[0][0]) return wp[0].slice(1, 7);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? smooth((t - p[0]) / (q[0] - p[0])) : 1;
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x];
    }
  }
  return wp[wp.length - 1].slice(1, 7);
}

// ---------------------------------------------------------------- labels --
// Two labels of the engine's own: the name of the miniature you point at, over it, and the name of the prop on the
// stage, over the stage. Their text follows (labelSet); on a screen they are HTML, in a headset sprites or signs.
const LBL = { story: ST.labels, sets: [], extra: [] };
function labelEl(html, cls) {
  const el = document.createElement('div');
  el.className = 'lbl ' + (cls || '');
  el.innerHTML = html;
  el.style.opacity = 0;
  $('#labels').appendChild(el);
  return el;
}
function buildSetLabels() {
  for (const at of ['hover', 'stage']) LBL.extra.push({ kind: 'extra', el: labelEl('', at === 'hover' ? 'cyn' : ''), set: 'table', at, txt: null, o: -1, show: 0 });
}
// a label's words: [bold, rest]; the headset's picture is drawn again when they change
function labelSet(L, txt) {
  const s = txt ? txt.join('|') : '';
  if (s === (L.txt ? L.txt.join('|') : '')) return;
  L.txt = txt ? [txt[0], txt[1], L.el.classList.contains('cyn') ? 'cyn' : ''] : null;
  L.el.innerHTML = txt ? `<b>${esc(txt[0])}</b> ${esc(txt[1])}` : '';
  L.w = 0;
  dropSprite(L);
}
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
  for (const e of it.els) {
    const o = Math.round(fadeVal(t, e.at, e.out, 0.6) * 100) / 100;
    if (o !== e.o) { e.el.style.opacity = o; e.o = o; e.el.style.visibility = o > 0 ? 'visible' : 'hidden'; }
  }
}

// ------------------------------------------------------------- timeline UI --
function buildTimeline() {
  const tr = $('#track');
  tr.innerHTML = '<div class="rail"></div><div class="done"></div><div class="knob"></div>';
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
    lastTick = p;
  }
  const want = playing ? 'pause' : 'play';
  const btn = $('#play');
  if (btn.dataset.s !== want) { btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY; btn.dataset.s = want; btn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
  slideDOM();
}

// ================================================================ EXPLORE ==
// Explore mode is the room itself: the table with every miniature, a click (or the trigger, or a pinch) puts one on
// the stage and its card on the panel. Two tabs: Prop (the card of the prop on the stage) and All props (every
// story's props, to pick from). On a screen the camera goes round the table (drag to turn, wheel to zoom).
const TABS = [['prop', 'Prop'], ['all', 'All props']];
const X = { tab: 'all', pick: '', story: STORIES.length ? STORIES[0].key : '', viewName: 'default', minis: 'loading', t0: 0 };
const XS = {};
const orbit = { cur: [0, 38, 4.3, 0, 0.66, 0.05], from: null, to: null, t0: 0, dur: 1.4 };

function exploreTargets() {
  const out = {};
  for (const n in DEF) out[n] = n.endsWith('_a') ? 0 : XS[n];
  out.table_a = 1;
  return out;
}
function exploreStep(dt) {
  const tg = exploreTargets(), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = XS[n] + (tg[n] - XS[n]) * k;
  return XS;
}
function openScene() { /* one scene: the table */ }
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
// the camera's views: the whole table, the stage close, from above, or a story's plate
function showView(name) {
  if (name !== X.viewName) sfxAct('whoosh', 'table', name.startsWith('group:') ? null : 'centre', { dur: 0.8 });   // (sound effects: off to another view, or a story's plate)
  X.viewName = name;
  const T = GL.sets.table, v = name.startsWith('group:') ? T.groupView(name.slice(6)) : view('table', name);
  if (v) flyTo(v);
  document.querySelectorAll('[data-ctl="view"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === name));
}

// ---------------------------------------------------------------- picking --
// put a prop on the stage (k: a miniature's key, '' to clear it); its card shows on the Prop tab
function pickProp(k, tab = true) {
  k = DESIGN_CARDS[k] ? k : '';
  const changed = k !== X.pick;
  // (sound effects: a pluck at the miniature, and the prop rising onto the stage)
  if (changed && k) { sfxAct('pick', 'table', miniPos(k)); sfxAct('rise', 'table', 'stage', { dur: 0.8, pitch: 1.3, delay: 0.1, gain: 0.7 }); }
  X.pick = k; X.story = k ? DESIGN_CARDS[k].story : X.story;
  GL.sets.table.setPick(k || null);
  if (tab && k) X.tab = 'prop';
  if (changed || tab) renderPanes();
  updateExtraLabels();
}
// where a miniature stands, in the table's frame (sound effects)
const miniPos = k => { const m = GL.sets.table.mini(k); return m ? m.holder.position.toArray() : 'centre'; };
function setHover(k) {
  const T = GL.sets.table;
  if ((k || null) === T.hovered()) return;
  if (k) sfxAct('hover', 'table', miniPos(k));   // (sound effects: the shell's soft tick, at the miniature)
  T.setHover(k || null);
  updateExtraLabels();
}
// every miniature back on its plate (for everyone at a station: the records go out with the state)
function tidyTable() {
  // (sound effects: a soft thunk for each miniature put back, one after another, as Arrange all places circles)
  GL.sets.table.moved().slice(0, 12).forEach((k, j) => sfxAct('place', 'table', GL.sets.table.mini(k).home.toArray(), { delay: 0.07 * j, force: true }));
  GL.sets.table.tidy(); renderPanes();
}
function pickTab(k) { if (!TABS.some(t => t[0] === k)) return; X.tab = k; renderPanes(); }

// --------------------------------------------------------- shared rooms --
// What everyone at the station sees alike: the prop on the stage and every miniature moved by hand (its record: where
// it was put and its turn, rounded, and its size), one top-level field each, so two people moving two miniatures at once
// both keep theirs. Nothing per device (the camera, the hover, the tab). Life size in a headset: no view to share.
function collabView() { return null; }
function collabSetView() { /* nothing to set */ }
function collabState() {
  const T = GL.sets.table, s = { pick: X.pick || '' };
  for (const k of CARD_KEYS) { const r = T.recOf(k); if (r) s[k] = r; }
  return s;
}
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const T = GL.sets.table;
  if (typeof v.pick === 'string' && (v.pick === '' || DESIGN_CARDS[v.pick]) && v.pick !== X.pick) pickProp(v.pick, false);
  let moved = false;
  for (const k of CARD_KEYS) {
    const m = T.mini(k);
    if (!m) continue;
    const a = T.okRec(v[k]) ? v[k] : null, was = m.rec;
    if (JSON.stringify(a) === JSON.stringify(was)) continue;
    T.setRec(k, a); moved = true;
  }
  if (moved) renderPanes();
}
function designEffect() { /* none */ }

// ------------------------------------------------------------ the panes --
const CARD_CSS = `<style>
  .dz-kick { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; margin: 0 0 4px; }
  .dz-card dl.stats { grid-template-columns: 6.2em 1fr; }
  .dz-card dl.stats dd { font-size: 14px; }
  .dz-card code, .dz-params code { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 12.5px; }
  .dz-params { width: 100%; border-collapse: collapse; margin: 4px 0 14px; font-size: 13px; }
  .dz-params td { border-top: 1px solid var(--line); padding: 5px 6px 5px 0; vertical-align: top; }
  .dz-params td:nth-child(2) { color: var(--muted); white-space: nowrap; max-width: 9em; overflow: hidden; text-overflow: ellipsis; }
  .dz-params .step { color: var(--amber); font-size: 11px; margin-left: 4px; }
  .dz-views { list-style: none; padding: 0; margin: 4px 0 14px; font-size: 13px; }
  .dz-views li { padding: 3px 0; } .dz-views li b { margin-right: 6px; }
  .dz-story { cursor: pointer; } .dz-story:hover { color: var(--ink); }
  .chips button[aria-pressed="true"] { border-color: var(--cyan); color: var(--cyan); }
</style>`;
function buildExplore() {
  $('#explore').innerHTML = CARD_CSS + `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v;
    ({ pick: () => pickProp(v), tidy: () => tidyTable(), clear: () => pickProp(''), group: () => showView('group:' + v) })[b.dataset.act]();
  });
  renderPanes();
  $('#viewctl').innerHTML = `<div class="grp"><span>View</span><div class="seg" data-ctl="view" role="group" aria-label="View">${[['default', 'The table'], ['stage', 'The stage'], ['above', 'From above']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.viewName === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b) showView(b.dataset.v); });
}
function showTab(k) { pickTab(k); }
const listOf = a => (a && a.length ? a.map(x => `<code>${esc(x)}</code>`).join(', ') : '');
function cardHTML(k) {
  const c = DESIGN_CARDS[k], s = storyOf(k), moved = GL.sets.table.moved().length;
  const rows = [['Story', `${esc(s.title)} <small>${esc(s.kick)}</small>`], c.size && ['Size', esc(c.size)], c.frame && ['Frame', esc(c.frame)],
    ['Source', `<code>${esc(c.file)}</code>${c.manifest ? `<br><small>manifest <code>${esc(c.manifest)}</code></small>` : ''}`],
    ['Reused by', listOf(c.reusedBy) || 'no other set'], c.reuses.length && ['Reuses', esc(c.reuses.join('; '))],
    ['Model', `${fmt(c.tris)} triangles in the miniature`]].filter(Boolean);
  return `<div class="dz-card" data-key="${k}" data-params="${c.params.length}" data-views="${c.views.length}">
    <p class="dz-kick" style="color:${s.col}">${esc(s.kick)} · ${esc(s.title)}</p>
    <h3>${esc(c.name)}</h3><p class="sub">${esc(c.shows)}</p>
    <dl class="stats">${rows.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>
    ${c.note ? `<p class="sub">${esc(c.note)}</p>` : ''}
    ${c.params.length ? `<p class="grp-h">Params (${c.params.length}): names start with the set's key, <code>_a</code> is its fade</p>
    <table class="dz-params"><tbody>${c.params.map(([n, r, m, st]) => `<tr><td><code>${esc(n)}</code>${st ? '<span class="step">step</span>' : ''}</td><td title="${esc(r)}">${esc(r)}</td><td>${esc(m)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${c.views.length ? `<p class="grp-h">Views (${c.views.length})</p><ul class="dz-views">${c.views.map(([n, f]) => `<li><b>${esc(n)}</b>${esc(f)}</li>`).join('')}</ul>` : ''}
    <div class="actions"><button class="btn" type="button" data-act="clear">Clear the stage</button><button class="btn" type="button" data-act="tidy"${moved ? '' : ' disabled'}>Tidy the table</button></div>
  </div>`;
}
function renderPanes() {
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === X.tab));
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + X.tab));
  const pp = $('#pane-prop'), pa = $('#pane-all');
  if (!pp || !pa) return;
  const moved = GL.sets.table.moved().length, T = GL.sets.table;
  const state = X.minis === 'failed' ? '<p class="empty">The models could not be loaded: the cards still work.</p>'
    : T.built() < T.total() ? `<p class="empty">Laying the table: ${T.built()} of ${T.total()} models.</p>` : '';
  pp.innerHTML = X.pick ? cardHTML(X.pick) + state : `<h3>The stage</h3><p class="sub">Nothing on the stage yet. Click a model on the table, or pick one under All props: it stands here bigger, and its card shows what it is made of.</p>${state}`;
  pa.innerHTML = `<h3>Every prop</h3><p class="sub">${CARD_KEYS.length} models of the 3D sets of ${STORIES.length} stories, a plate for each story. Click one to put it on the stage.</p>${state}
    ${STORIES.map(s => `<p class="grp-h dz-story" data-act="group" data-v="${s.key}" title="Look at its plate"><span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${s.col}"></span><b style="color:${s.col}">${esc(s.title)}</b> ${esc(s.kick)}</p>
      <div class="chips">${s.keys.map(k => `<button type="button" data-act="pick" data-v="${k}" aria-pressed="${k === X.pick}">${esc(DESIGN_CARDS[k].name)}</button>`).join('')}</div>`).join('')}
    <div class="actions"><button class="btn" type="button" data-act="tidy"${moved ? '' : ' disabled'}>Tidy the table${moved ? ` (${moved} moved)` : ''}</button></div>`;
}
// the two labels: the name of what you point at, and of what stands on the stage
function updateExtraLabels() {
  const T = GL.sets.table, h = T.hovered(), [Lh, Ls] = LBL.extra;
  if (!Lh) return;
  labelSet(Lh, h ? [DESIGN_CARDS[h].name, storyOf(h).title] : null);
  labelSet(Ls, X.pick ? [DESIGN_CARDS[X.pick].name, 'on the stage'] : null);
  Lh.show = h ? 1 : 0; Ls.show = X.pick && T.stageModel() ? 1 : 0;
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// the miniature under the pointer (mx, my in the window), or null
function miniAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  GL.world.updateMatrixWorld(true);
  const hs = _rc.intersectObjects(GL.sets.table.pickables(), false);
  return hs.length ? hs[0].object.userData.key : null;
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
    if (!pts.has(ev.pointerId)) {
      // pointing without a button: the miniature under the mouse lights up and shows its name
      if (APP.mode === 'explore' && ev.pointerType !== 'touch') { const k = miniAt(ev.clientX, ev.clientY); setHover(k); cv.style.cursor = k ? 'pointer' : 'grab'; }
      return;
    }
    if (APP.mode !== 'explore') return;
    const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.5, 8);
      pinch = d; down.moved = true; return;
    }
    if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
    if (down && down.moved) {
      orbit.to = null;
      orbit.cur[0] -= dx * 0.3; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.25, 4, 86);
    }
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') { const k = miniAt(ev.clientX, ev.clientY); if (k) pickProp(k); }
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { if (!pts.size) setHover(null); });
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.5, 8);
  }, { passive: false });
}
// ================================================================= WEBXR ==
// Headset mode (built for Meta Quest, works in any WebXR browser). The table stands life size in front of you, the
// side panel is redrawn on a canvas you point at, and labels become sprites on top or signs in the scene.
// Controllers: point at a miniature to light it, pull the trigger (or pinch) to put it on the stage, and grip it to
// pick it up: it follows your hand and turns with it, both hands size it, let go it stays. The grip on the panel moves
// the panel. A/X plays and pauses the intro.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), size: 1, globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  baseR: 0.36, R: 0.36, viewH: 1600, hitR: 1, target: new THREE.Vector3(),
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' }, pf: -1, pt: -1, pick: 'from',
  rot: new THREE.Quaternion(), free: false, lm: 'face', signL: new THREE.Quaternion(), signH: new THREE.Vector3(),
};
const _xd = new THREE.Vector3(), _xp = new THREE.Vector3(), _xq = new THREE.Quaternion();
const _xq2 = new THREE.Quaternion(), _xm = new THREE.Matrix4(), _xinv = new THREE.Matrix4();
const _xa = new THREE.Vector3(), _xb = new THREE.Vector3(), _xc = new THREE.Vector3(), _xz = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------ scene pose --
const _xX = new THREE.Vector3(1, 0, 0), _xY = new THREE.Vector3(0, 1, 0);
// The table is life size: the floor under your feet (the frame hangs at your head, so the floor is a standing eye
// height below it: the reference space is 'local', so the floor is not known), the table's middle 1.55 m ahead of
// where you faced when the place was set, its near edge 40 cm in front of you; views do not move it.
const XR_EYE = 1.6, XR_AHEAD = 1.55;
function xrPlace(v) {
  XR.R = 1; XR.hitR = 1; XR.target.set(0, 0, 0);
  GL.world.quaternion.identity();
  GL.world.scale.setScalar(1);
  GL.world.position.set(0, -XR_EYE, -XR_AHEAD);
  XR.globeBase.set(0, -XR_EYE, -XR_AHEAD);
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
  const hm = 0.021 * Math.max(1, sp.position.distanceTo(XR.camLocal));   // the same size to the eye, near or far
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
  if (fixed) {
    // upright and turned to you, about the vertical only (the rig's frame): a sign in the scene, not a sprite on top
    _fv.copy(sp.position).applyMatrix4(GL.world.matrix);
    sp.quaternion.copy(XR.signL).multiply(_fq.setFromAxisAngle(_xY, Math.atan2(XR.signH.x - _fv.x, XR.signH.z - _fv.z)));
  }
}
function xrTip() {}

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
  g.addEventListener('disconnected', () => { c.src = null; c.press = null; xrLetGo(c); c.hover = null; c.wantPress = false; c.dot.visible = false; });
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
  } else if (h.kind === 'mini' && !XR.stories) {   // the trigger (or a pinch) on a miniature puts it on the stage
    c.press = { kind: 'mini' };
    pickProp(h.key); buzz(c, 0.4, 30);
  }
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
  }
}
function xrGrab(c, on) {
  xrLetGo(c);
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  if (h.kind === 'mini') {   // a miniature, picked up where it stands: it keeps its offset from the hand
    const m = GL.sets.table.mini(h.key);
    if (!m) return;
    GL.world.updateMatrixWorld(true);
    c.grab = { target: 'mini', key: h.key, q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(), o0: c.o.clone(),
      p0: m.holder.getWorldPosition(new THREE.Vector3()), reach: 1, r0: m.holder.getWorldQuaternion(new THREE.Quaternion()) };
    GL.sets.table.carryTo(h.key, m.holder.position, m.holder.quaternion, m.s);
    setHover(h.key); buzz(c, 0.4, 25); sfxAct('grab', 'table', miniPos(h.key));   // (sound effects: picked up)
    return;
  }
  if (h.kind !== 'panel') return;   // the table stays where it is: only the panel and the miniatures move
  const p0 = XR.panelGroup.getWorldPosition(new THREE.Vector3());
  c.grab = { target: 'panel', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0, reach: 1, r0: XR.panelGroup.quaternion.clone() };
  buzz(c, 0.4, 25);
}
// let go of a miniature (the grip up, the controller gone, or locked meanwhile): it stays where it is, unless the other
// hand still holds it
function xrLetGo(c) {
  const G = c.grab;
  c.grab = null;
  if (G && G.target === 'mini' && !XR.ctrls.some(k => k !== c && k.grab && k.grab.target === 'mini' && k.grab.key === G.key)) { GL.sets.table.drop(G.key); sfxAct('drop', 'table', miniPos(G.key)); }   // (sound effects: let go)
  else if (G && G.target === 'mini') { const o = XR.ctrls.find(k => k !== c && k.grab && k.grab.key === G.key); if (o) xrRegrip(o); }
}
// a hand that holds a miniature alone again (the other let go) carries on from where it is now
function xrRegrip(c) {
  const G = c.grab, m = GL.sets.table.mini(G.key);
  G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.reach = 1;
  m.holder.getWorldPosition(G.p0); m.holder.getWorldQuaternion(G.r0);
}
const _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gh = new THREE.Vector3(), _gr = new THREE.Quaternion();
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it (moving freely,
// it also turns with your hand, about it: what you hold stays in your hand)
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
  // both hands on the scene resize it (xrResize, once a frame); when one lets go, the other carries on from there
  if (HOST.anchor.locked(G.target === 'panel' ? 'panel' : 'globe')) { xrLetGo(c); return; }   // locked meanwhile (a shared room's story lock: Lock this story)
  if (G.target === 'mini') { carryMini(c, dt); return; }
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
// a miniature in the hand: where the hand puts it (moving freely it turns with the hand as a real object would; else
// it stays upright, turning only about the vertical as the hand does); both hands on it size it (half to four times
// its own size) and move it with their middle
const _mq = new THREE.Quaternion(), _mi = new THREE.Quaternion(), _mv = new THREE.Vector3(), _me = new THREE.Euler();
function carryMini(c, dt) {
  const G = c.grab, T = GL.sets.table, m = T.mini(G.key), gp = c.src.gamepad;
  const o = XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'mini' && k.grab.key === G.key && k.src && k.g.visible);
  GL.world.updateMatrixWorld(true);
  _mi.copy(GL.sets.table.group.getWorldQuaternion(_mq)).invert();
  if (o) {
    if (c.i < o.i) return;   // (once a frame, by the second hand)
    const d = c.o.distanceTo(o.o);
    _mv.copy(c.o).add(o.o).multiplyScalar(0.5);
    const W = G.two || (G.two = o.grab.two = { d0: Math.max(0.05, d), s0: m.s, m0: _mv.clone(), p0: m.holder.getWorldPosition(new THREE.Vector3()) });
    const p = W.p0.clone().add(_mv).sub(W.m0);
    T.carryTo(G.key, T.group.worldToLocal(p), m.holder.quaternion, W.s0 * d / W.d0);
    return;
  }
  if (G.two) xrRegrip(c);
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(gp.axes[3] * dt * 1.5), 0.15, 6);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);   // the hand's turn since it took hold
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  if (_gv.length() > 4) _gv.setLength(4);
  _gv.applyQuaternion(_gq).add(c.o);
  let q;
  if (XR.free) q = _mq.copy(_gq).multiply(G.r0);
  else { _me.setFromQuaternion(_gq, 'YXZ'); q = _mq.setFromAxisAngle(_xY, _me.y).multiply(G.r0); }
  T.carryTo(G.key, T.group.worldToLocal(_gv), q.premultiply(_mi), m.s);
}
function xrPoint(c, dt) {
  const g = c.g;
  if (!c.src || !g.visible) { c.hover = null; c.dot.visible = false; xrLetGo(c); return; }   // (a controller gone lets go)
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
    // a miniature (lit, its name shown), else the table or the floor (the dot only)
    const ms = XR.raycaster.intersectObjects(GL.sets.table.pickables(), false);
    if (ms.length) { hit = { kind: 'mini', key: ms[0].object.userData.key, point: ms[0].point.clone() }; dist = ms[0].distance; }
    else {
      const ts = XR.raycaster.intersectObjects(XR.solid, false);
      if (ts.length) { hit = { kind: 'table', point: ts[0].point.clone() }; dist = ts[0].distance; }
    }
  }
  c.hover = hit;
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu)
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  // A/X: play or pause the story
  const gp = c.src.gamepad;
  if (gp) {
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
  // the miniature a controller points at (or holds) lights up and shows its name
  const ch = XR.ctrls.find(c => c.grab && c.grab.target === 'mini') || XR.ctrls.find(c => c.hover && c.hover.kind === 'mini');
  setHover(ch ? (ch.grab ? ch.grab.key : ch.hover.key) : null);
}
function xrUpdate(S) {
  // the Stories screen replaces the story's panels and hides the story
  const land = !!XR.stories, away = xrAway();   // (away from its station in a shared room: the story hidden, only the shell's things)
  if (XR.land) {
    if (XR.landRev !== HOST.listRev) xrLandingCards();   // a story added while the app runs: its card joins the arc
    // Sound check takes the place of the story cards while it is open
    for (const P of XR.land) P.mesh.visible = land && (P === XR.land[0] || !XR.soundCheck);
    XR.snd.mesh.visible = land && !!XR.soundCheck;
    // labels hidden: no story panel at all, in story and explore mode (the Stories screen, the shell's menu and its
    // clock stay, and A or X still plays); labels in 3D: the panels stand in the scene, as the labels' signs do. And
    // this story's panels (xrPanels): controls only keeps just the foot bar, hidden neither
    const pm = xrPanels(), pv = !land && !away && XR.lm !== 'hidden';
    XR.main.mesh.visible = pv && pm === 'shown';
    XR.foot.mesh.visible = pv && pm !== 'hidden';
    panelDepth(XR.main, XR.lm === 'fixed'); panelDepth(XR.foot, XR.lm === 'fixed');
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
    if (!story && L.txt) placeLabelXR(L, L.show, S);
    else hideLabelXR(L);
  }
  xrTip(S);
  const now = performance.now();
  for (const P of XR.panels) panelTick(P, now);
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
  for (const c of XR.ctrls) { c.press = null; xrLetGo(c); c.wantPress = false; }
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
  const away = xrAway();   // (asked while the session is still the shell's)
  XR.on = false; XR.session = null; XR.mode = null; XR.hiddenAt = 0;
  HOST.session = null;
  document.body.classList.remove('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.scale.setScalar(1);
  for (const P of XR.panels) P.mesh.visible = false;
  for (const c of XR.ctrls) { c.g.visible = false; c.dot.visible = false; c.press = null; xrLetGo(c); c.hover = null; c.src = null; }
  setHover(null);
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) { hideLabelXR(L); L.o = -1; }
  if (XR.tip) dropSprite(XR.tip);
  XR.tip = null; XR.tipI = -1;
  XR.clear = true;
  GL.stars.visible = false;   // (the room has no stars)
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
  XR.solid = GL.sets.table.solid;   // what the pointer's dot lands on when it misses a miniature: the table and the floor
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
  const T = GL.sets.table;
  return ['x', audioLabel(), xrSig(), X.tab, X.pick, X.story, X.minis, T.built(), T.moved().length].join('|');
}
const XR_HERE = 'design';
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
  // in a shared room no Stories button: each station keeps its story, and another story is another station (walk into
  // its circle)
  if (!(HOST.room && HOST.room.placing()) && !xrRoomOnly()) hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  if (!XR.stories) hb('mode', story ? 'To the table' : 'Intro', () => (story ? APP.enterExplore() : APP.enterStory(0)), story ? 186 : 110, { primary: story });
  // the story's name, smaller when the buttons leave it less room
  fitTitle(ctx, 'The props table', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. A or X: play and pause. Anchored: to move things, use Place again on the Stories screen.' : 'Trigger (or pinch): use buttons. Grip: ' + (XR.free ? 'move and turn' : 'move') + ' this panel. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
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


// explore: the Prop and All props tabs, mirroring the HTML ones (the card shorter: the headset's panel holds less, and
// the stories' props are picked story by story)
function drawExplorePane(ctx, P, x, y, W) {
  const T = GL.sets.table, moved = T.moved().length, bottom = P.h - 30;
  let bx = x;
  for (const [k, n] of TABS) { vButton(ctx, P, 'tab:' + k, bx, y, 200, 56, n, () => pickTab(k), { on: X.tab === k, px: 24 }); bx += 212; }
  vButton(ctx, P, 'tidy', x + W - 280, y, 280, 56, moved ? `Tidy the table (${moved})` : 'Tidy the table', moved ? () => tidyTable() : null, { px: 22, color: moved ? VC.ink : VC.faint });
  y += 78;
  if (X.minis === 'failed') textBlock(ctx, 'The models could not be loaded: the cards still work.', x, bottom - 30, W, 21, 28, VC.amber, 400, 1);
  else if (T.built() < T.total()) textBlock(ctx, `Laying the table: ${T.built()} of ${T.total()} models.`, x, bottom - 30, W, 21, 28, VC.faint, 400, 1);
  const foot = X.minis === 'failed' || T.built() < T.total() ? 40 : 0;   // (room for the line above)
  if (X.tab === 'prop') drawCardPane(ctx, P, x, y, W, bottom - foot); else drawAllPane(ctx, P, x, y, W, bottom - foot);
}
function drawCardPane(ctx, P, x, y, W, bottom) {
  const k = X.pick;
  if (!k) { textBlock(ctx, 'Nothing on the stage yet. Point at a model on the table and pull the trigger (or pinch), or pick one under All props: it stands on the stage, and its card shows here.', x, y, W, 27, 38, VC.muted, 400, 5); return; }
  const c = DESIGN_CARDS[k], s = storyOf(k);
  ctx.font = vfont(21, 700); ctx.fillStyle = s.col; ctx.fillText(fitText(ctx, (s.kick + ' · ' + s.title).toUpperCase(), W - 230), x, y + 4);
  vButton(ctx, P, 'clear', x + W - 210, y - 6, 210, 44, 'Clear the stage', () => pickProp(''), { px: 19 });
  y += 46;
  y += fitTitle(ctx, c.name, x, y, W, 46, 54, VC.ink, 700, 32) + 4;
  y += textBlock(ctx, c.shows, x, y, W, 22, 31, VC.muted, 400, 4) + 12;
  const kv = (t, v) => { if (!v || y > bottom - 40) return; ctx.font = vfont(19); ctx.fillStyle = VC.faint; ctx.fillText(t, x, y + 2); y += textBlock(ctx, v, x + 140, y, W - 140, 20, 28, VC.ink, 400, 2) + 6; };
  kv('Size', c.size); kv('Frame', c.frame); kv('Source', c.file); kv('Reused by', c.reusedBy.join(', ') || 'no other set');
  if (c.reuses.length) kv('Reuses', c.reuses.join('; '));
  if (c.note && y < bottom - 60) y += textBlock(ctx, c.note, x, y, W, 19, 27, VC.muted, 400, 2) + 8;
  if (c.params.length && y < bottom - 90) {
    ctx.fillStyle = VC.line; ctx.fillRect(x, y, W, 2); y += 12;
    ctx.font = vfont(22, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Params (${c.params.length})`, x, y);
    ctx.font = vfont(18); ctx.fillStyle = VC.faint; ctx.fillText('amber: a step, never eased', x + 190, y + 4);
    y += 36;
    const vh = c.views.length ? 72 : 0, room = Math.max(1, Math.floor((bottom - y - vh) / 29)), show = c.params.length > room ? room - 1 : c.params.length;
    for (const [n, r, m, st] of c.params.slice(0, show)) {
      ctx.font = vfont(18, 700); ctx.fillStyle = st ? VC.amber : VC.cyan; ctx.fillText(fitText(ctx, n, 220), x, y);
      ctx.font = vfont(18); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, r, 140), x + 228, y);
      ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, m, W - 380), x + 380, y);
      y += 29;
    }
    if (show < c.params.length) { ctx.font = vfont(18); ctx.fillStyle = VC.faint; ctx.fillText(`and ${c.params.length - show} more (the page's card lists every one)`, x, y); y += 29; }
  }
  if (c.views.length && y < bottom - 50) {
    y += 8; ctx.font = vfont(22, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Views (${c.views.length})`, x, y); y += 32;
    textBlock(ctx, c.views.map(v => v[0]).join(', '), x, y, W, 19, 27, VC.muted, 400, Math.max(1, Math.floor((bottom - y) / 27)));
  }
}
function drawAllPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, `${CARD_KEYS.length} models of ${STORIES.length} stories. Pick a story, then a prop, or point at the table.`, x, y, W, 23, 32, VC.muted, 400, 2) + 14;
  const cw = (W - 24) / 3;
  STORIES.forEach((s, i) => {
    const bx = x + (i % 3) * (cw + 12), by = y + Math.floor(i / 3) * 62;
    vButton(ctx, P, 'grp:' + s.key, bx, by, cw, 52, '', () => { X.story = s.key; }, { on: X.story === s.key });
    swatch(ctx, bx + 14, by + 18, 16, s.col);
    ctx.font = vfont(21, X.story === s.key ? 700 : 400); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle'; ctx.fillText(fitText(ctx, s.title, cw - 52), bx + 40, by + 27); ctx.textBaseline = 'top';
  });
  y += Math.ceil(STORIES.length / 3) * 62 + 12;
  const s = STORIES.find(q => q.key === X.story) || STORIES[0];
  if (!s) return;
  ctx.font = vfont(21, 700); ctx.fillStyle = s.col; ctx.fillText(fitText(ctx, `${s.kick} · ${s.title}`.toUpperCase(), W), x, y); y += 36;
  const pw = (W - 12) / 2;
  s.keys.forEach((k, i) => {
    const bx = x + (i % 2) * (pw + 12), by = y + Math.floor(i / 2) * 62;
    if (by + 52 <= bottom) vButton(ctx, P, 'pick:' + k, bx, by, pw, 52, DESIGN_CARDS[k].name, () => pickProp(k), { on: X.pick === k, px: 21 });
  });
}
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.round(APP.t * 4) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x' + footHint();
}
// explore: what the hands do here (in a shared room the room's word on the grip; anchored, nothing moves)
const footHint = () => (HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Anchored: the models stay put (Place again on the Stories screen to move things). Trigger or pinch on a model: on the stage.'
  : 'Point at a model: its name. Trigger or pinch: on the stage. Grip: pick it up' + (XR.free ? ', turn it' : '') + '; both grips size it.');
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
  textBlock(ctx, footHint(), 28, 40, P.w - 56, 23, 32, VC.muted, 400, 3);
}


// ------------------------------------------------------------- narration --
// ------------------------------------------------------------- narration --
// The design room has no narration: AUD stays null, and the lines that would play it do nothing. The sound engine is
// the shell's (HOST.audio), unlocked by the first tap or click and kept across stories and headset sessions.
let AUD = null;
function audioInit() { /* nothing to narrate */ }
function audioSync() { if (AUD) AUD.sync(...slideSound()); }
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
    $('#btnMode').textContent = 'Intro';
    Object.assign(XS, DEF, { table_a: 1 });
    // from where the intro's camera is, to the table's view
    orbit.cur = storyCam(storyT(this.t)); orbit.to = null;
    showView(X.viewName);
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    renderPanes();
    updateExtraLabels();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'To the table';
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
  const was = APP.mode === 'story' && APP.playing;   // (sound effects: the story was playing as the frame began)
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
  }
  slideStep(t0);   // slideshow: the story waits at the end of each chapter
  sfxStep(was, dt);   // sound effects: the cues the clock crossed, the spans it is in, the live sounds
  // the end of the intro: the table (not Repeat: the design room is not one of the stories)
  if (APP.mode === 'story' && APP.playing && APP.t >= T_END) { APP.t = T_END; APP.enterExplore(); }
  audioSync();
  const ts = storyT(APP.t); // original story time for this point in the narration
  if (APP.mode === 'story') {
    S = storyState(ts); tSet = ts;
    if (xr) xrPlace(storyCam(ts)); else applyCamera(storyCam(ts));
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    const pn = performance.now();
    S = exploreStep(dt); tSet = pn / 1000;
    orbitStep(xr ? pn : now);
    if (xr) xrPlace(orbit.cur); else applyCamera(orbit.cur);
  }
  K.U.uTime.value = (performance.now() / 1000) % 3600;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  if (XR.on && !XR.clear) S = Object.assign({}, S, { table_floor: 0 });   // passthrough: the table stands in your room
  updateSets(S, tSet, dt);
  builtStep();
  if (xr) xrUpdate(S);
  GL.renderer.render(GL.scene, GL.camera);
  if (!xr) {
    GL.world.updateMatrixWorld(true);
    if (APP.mode === 'story') placeLabels(LBL.storyAll, L => (L.kind === 'story' ? fadeVal(ts, L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0) : setLabelAlpha(L, S)));
    else placeLabels(LBL.exploreAll(), L => (L.kind === 'set' ? setLabelAlpha(L, S) : L.txt ? L.show : 0));
  }
  window.__frames = (window.__frames || 0) + 1;
}
// the table fills in a few models a frame: the panes say how far it has got (four times a second at most)
let lastBuilt = -1, builtAt = 0;
function builtStep() {
  const n = GL.sets.table.built(), pn = performance.now();
  if (n === lastBuilt || (pn - builtAt < 250 && n < GL.sets.table.total())) return;
  lastBuilt = n; builtAt = pn;
  if (X.pick && !GL.sets.table.stageModel()) GL.sets.table.setPick(X.pick);
  renderPanes(); updateExtraLabels();
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
  // straight into the table (#design&t=2: the intro at that second, paused); #design&pick=pet.scan puts a prop on the
  // stage, &tab=prop|all, &view=default|stage|above|group:<story>, &now without the camera's flight
  if (!hp.has('t')) APP.enterExplore();
  if (hp.get('tab')) X.tab = hp.get('tab') === 'prop' ? 'prop' : 'all';
  if (hp.get('pick')) pickProp(hp.get('pick'), !hp.get('tab'));
  if (hp.get('view') && APP.mode === 'explore') showView(hp.get('view'));
  if (hp.has('now')) { orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
  renderPanes();
  // the miniatures: lowpoly.js, loaded once by the shell; the table fills in from it a few at a time
  (HOST.lowpoly ? HOST.lowpoly() : Promise.reject(new Error('this shell cannot load the miniatures'))).then(M => {
    if (GL.gone) return;
    X.minis = 'ready'; GL.sets.table.feed(M);
    if (X.pick) GL.sets.table.setPick(X.pick);
    renderPanes();
  }).catch(e => { if (GL.gone) return; X.minis = 'failed'; renderPanes(); console.warn('The miniatures did not load:', e && e.message); });
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  LOAD.t = setTimeout(() => $('#loading').classList.add('gone'), 120);   // (dispose clears it: a story picked meanwhile keeps its loading screen)
}
LOAD.t = setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  caption: xrCaption,
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the prop on the stage and the miniatures moved by
  // hand (no effects)
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: v => { SFXQ.quiet++; try { return collabApply(v); } finally { SFXQ.quiet--; } }, view: collabView, setView: collabSetView,
    effect: designEffect,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
  },
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    // timers left running must not write into the next story's panes (they share ids) or build this one after all
    GL.gone = true;
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
