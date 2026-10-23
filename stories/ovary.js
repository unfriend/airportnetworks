// The aging ovary: what 255 ovaries show about aging. The ovary and its reserve of follicles, 255 GTEx donors aged 20 to
// 70, what an H&E section of an ovary shows (blood vessels, macrophages, corpora albicantia, follicles), two methods that
// find them (tile-level classification: UNI2 features and a random forest; semantic segmentation with SegFormer), the
// trends with age and whether the methods agree, and a spatial neighbor network as the next step. After the poster
// "Mapping the histological landscape of human ovarian aging" by Parijat Chakraborty, Samir Moustafa and André Rendeiro
// (LBI for Network Medicine; CeMM; Faculty of Computer Science, University of Vienna). American spelling in this story.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/ovary/build.mjs from the tour's kit, the tour's PET body set and the data, shared look, sets and engine
// parts in tools/ovary (the engine adapted from the microanatomy story's): edit those, not this file.
HOST.register('ovary', function (HOST) {
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
// OVARY_DATA (the poster's numbers, the figures' readings and the illustrative cohort, tools/ovary/sets/data.js) comes
// first, then OVARY_TREND and OVARY_LOOK (tools/ovary/sets/look.js: the trend lines looked up, the story's look) and
// the tour's PET body set (SETS.body, unchanged); then the story's sets organ, section and charts.
const SETS = {};
// OVARY_DATA: generated by tools/ovary/data/gen_data.mjs; never edit by hand.
// Source: Chakraborty P, Moustafa S, Rendeiro A. Mapping the histological landscape of human ovarian aging (poster). (1) Ludwig Boltzmann Institute for Network Medicine at the University of Vienna; (2) CeMM Research Center for Molecular Medicine of the Austrian Academy of Sciences; (3) Faculty of Computer Science, University of Vienna. Support: CeMM and the European Research Council (ERC). Data: GTEx (the Genotype-Tissue Expression project).
// Fields (numbers typed in exactly as the poster prints them; "read" = read off its figures, tools/ovary/data/figures.json):
//   source            the poster's title, authors (aff: indexes into affiliations, from 1), affiliations, support, data
//   facts             donors (255), ages ([20, 70]), data (what GTEx gives), scale (the example sections' scale bars)
//   hist              the age histogram: from (21), width (2.45 years), counts (20 bars, sum 255)
//   kinds[]           { key, name, plural, title (as on the charts), color (the poster's), annotated (training labels),
//                     rf { precision, recall, f1 } (random forest performance), iou (SegFormer), trend { rf, seg: { r, p } }
//                     (count against age), compare { r, p } (segmentation against random forest) }: vessel, macrophage,
//                     albicans, follicle (the poster's table order), then cyst (segOnly: only the segmentation has it; its
//                     colour is the story's own, the poster gives none)
//   chartOrder        the 2 x 2 order of the trend and comparison charts (vessel, albicans, follicle, macrophage)
//   axes              per kind: the trend chart's y ticks as printed (a log scale; 0 is drawn as a row at the place of
//                     0.5), min and max (read), and the comparison chart's ticks (linear)
//   methods           rf, seg: { short, name, title, dot and line colours (the poster's), steps }
//   trends            read: per kind and method { line: [[age, count]] (the fitted line, every 5 years from 21; a line
//                     with zeroAge falls to 0 there: the lines read as straight lines in counts), zeroAge, band: per
//                     decade 20s..60s [lo, mid, hi] (about the 10th, 50th and 90th percentiles of the dots), zero: per
//                     decade the share of dots at 0 }
//   compare           read: per kind { slope, intercept (the fitted line, segmentation = intercept + slope x random
//                     forest), xMax, yMax (axis maxima) }
//   message           the poster's message (why, reserve, approach) and future directions
//   background        textbook numbers (to be said with "about"): follicle stages, follicles at birth, puberty and
//                     menopause, the average age at menopause
//   cohort            ILLUSTRATIVE, not the donors' values: age[255] (whole years, filling the histogram's bars), and per
//                     kind { rf[255], seg[255] } counts per section drawn to follow the bands, shares at zero and lines;
//                     rho (the methods' tie), k (the spread's scale), r (what the drawn dots give: Pearson's r with age per
//                     method, rfRank and segRank Spearman's, compare Pearson's between the methods; compare with
//                     kinds[].trend and kinds[].compare)
//   checks            f1 printed and computed from precision and recall (blood vessel: 0.86 printed, 0.84 computed),
//                     the histogram's sum, the annotated objects' sum
const OVARY_DATA = {"source":{"poster":"Chakraborty P, Moustafa S, Rendeiro A. Mapping the histological landscape of human ovarian aging (poster).","title":"Mapping the histological landscape of human ovarian aging","authors":[{"name":"Parijat Chakraborty","aff":[1]},{"name":"Samir Moustafa","aff":[2,3]},{"name":"André Rendeiro","aff":[1,3]}],"affiliations":["Ludwig Boltzmann Institute for Network Medicine at the University of Vienna","CeMM Research Center for Molecular Medicine of the Austrian Academy of Sciences","Faculty of Computer Science, University of Vienna"],"support":["CeMM","the European Research Council (ERC)"],"data":"GTEx (the Genotype-Tissue Expression project)"},"facts":{"donors":255,"ages":[20,70],"data":["H&E histology","bulk RNA-seq","clinical and demographic information"],"scale":{"young":"1.58 mm","old":"791 µm"}},"hist":{"from":21,"width":2.45,"counts":[9,6,10,5,7,6,3,5,13,10,9,25,15,25,15,14,12,21,25,20]},"kinds":[{"key":"vessel","name":"blood vessel","plural":"blood vessels","title":"Blood vessels","color":"#8e9dba","annotated":8706,"rf":{"precision":0.81,"recall":0.88,"f1":0.86},"iou":0.84,"trend":{"rf":{"r":-0.24,"p":0.00021},"seg":{"r":-0.43,"p":8.3e-12}},"compare":{"r":0.78,"p":2.2e-47}},{"key":"macrophage","name":"macrophage","plural":"macrophages","title":"Macrophage","color":"#a4b58a","annotated":5540,"rf":{"precision":0.96,"recall":0.79,"f1":0.87},"iou":0.95,"trend":{"rf":{"r":0.05,"p":0.497},"seg":{"r":-0.29,"p":0.0000078}},"compare":{"r":0.51,"p":3.7e-16}},{"key":"albicans","name":"corpus albicans","plural":"corpora albicantia","title":"Corpus albicans","color":"#ad60bf","annotated":421,"rf":{"precision":0.87,"recall":0.89,"f1":0.88},"iou":0.97,"trend":{"rf":{"r":0.4,"p":5.7e-10},"seg":{"r":0.25,"p":0.00012}},"compare":{"r":0.41,"p":1.2e-10}},{"key":"follicle","name":"follicle","plural":"follicles","title":"Follicle","color":"#402580","annotated":274,"rf":{"precision":0.87,"recall":0.8,"f1":0.83},"iou":0.7,"trend":{"rf":{"r":-0.48,"p":1.5e-14},"seg":{"r":-0.48,"p":1.8e-14}},"compare":{"r":0.94,"p":1.4e-13}},{"key":"cyst","name":"cyst","plural":"cysts","title":"Cyst","color":"#d9a05b","segOnly":true,"iou":0.15}],"chartOrder":["vessel","albicans","follicle","macrophage"],"axes":{"vessel":{"ticks":[50,100,200,500,1000,2000],"min":25,"max":3200,"cmpTicks":[0,500,1000,1500,2000]},"albicans":{"ticks":[0,2,10,50,200,1000],"min":0,"max":1500,"cmpTicks":[0,200,400,600,800]},"follicle":{"ticks":[0,2,10,50,200],"min":0,"max":300,"cmpTicks":[0,40,80,120,160]},"macrophage":{"ticks":[0,1,5,20,100,500],"min":0,"max":600,"cmpTicks":[0,100,200,300]}},"methods":{"rf":{"key":"rf","short":"RF","name":"random forest","title":"Tile-level classification","dot":"#4078b0","line":"#004898","steps":["tissue tiling","label assignment","feature extraction with UNI2 (a pathology foundation model)","random forest classification","tile prediction"]},"seg":{"key":"seg","short":"Seg","name":"segmentation","title":"Semantic segmentation","dot":"#c87060","line":"#b03828","steps":["label assignment","semantic segmentation with SegFormer","mask prediction"]}},"trends":{"vessel":{"rf":{"line":[[21,1000],[25,967],[30,927.5],[35,889],[40,852.5],[45,817.5],[50,783.99],[55,751.49],[60,720.49],[65,690.99],[70,663.49]],"zeroAge":null,"band":[[324.04,800,1697.06],[334.66,750,1396.42],[400,700,1300],[256.9,624.5,1000],[324.04,700,1100]],"zero":[0,0,0,0,0]},"seg":{"line":[[21,1094.99],[25,1035.99],[30,967.5],[35,904],[40,843],[45,788],[50,735.5],[55,687],[60,641.5],[65,599],[70,560]],"zeroAge":null,"band":[[256.9,800,1749.29],[223.61,724.57,1396.42],[339.85,721.11,1300],[234.52,574.46,948.68],[223.61,464.76,800]],"zero":[0,0,0,0,0]}},"albicans":{"rf":{"line":[[21,74.83],[25,92.39],[30,122.98],[35,147.43],[40,171.97],[45,207.48],[50,235],[55,258.48],[60,277.49],[65,300],[70,322.49]],"zeroAge":null,"band":[[41.83,92,200],[55,124.9,200],[69.28,200,314.64],[56.12,214.48,380],[89.44,230,424.26]],"zero":[0,0.01,0.01,0,0]},"seg":{"line":[[21,16],[25,17.75],[30,20.24],[35,22.45],[40,24.92],[45,27.93],[50,30.94],[55,32.94],[60,35.47],[65,37.99],[70,39.99]],"zeroAge":null,"band":[[2.45,11.83,40],[4.47,15,39.69],[3.46,20,54.77],[3,23.45,64.81],[5,26.46,62.05]],"zero":[0,0,0.05,0.04,0.08]}},"follicle":{"rf":{"line":[[21,31.5],[25,28.5],[30,23.98],[35,18.89],[40,16.43],[45,12.19],[50,7.6],[55,3.45]],"zeroAge":58.55,"band":[[8,27.39,66.33],[3,9,44.72],[0.5,3,18],[0,0,2],[0,0,1]],"zero":[0.04,0.05,0.2,0.63,0.8]},"seg":{"line":[[21,42.5],[25,36.5],[30,30.67],[35,25.26],[40,21.07],[45,15.87],[50,10.6],[55,5.24]],"zeroAge":59,"band":[[7.48,32.4,79.37],[4.47,10.95,54.77],[0,3.87,24.49],[0,0,3.87],[0,0,3]],"zero":[0.03,0.05,0.23,0.6,0.78]}},"macrophage":{"rf":{"line":[[21,63.99],[25,65.5],[30,67.5],[35,69],[40,70],[45,71],[50,72],[55,73.5],[60,74.5],[65,74.99],[70,75.99]],"zeroAge":null,"band":[[7,37.42,139.64],[5.48,18,130],[9.8,47.43,142.83],[6.93,42.43,129.61],[5,42.43,130]],"zero":[0,0,0,0,0.01]},"seg":{"line":[[21,47],[25,42.47],[30,37.95],[35,33.47],[40,28.5],[45,24.98],[50,19.49],[55,16.16],[60,11.4],[65,7.1],[70,2.15]],"zeroAge":null,"band":[[0,16.43,48.99],[0,10,37.42],[0,15,90],[0,2,22],[0,0.5,6]],"zero":[0.18,0.09,0.18,0.4,0.57]}}},"compare":{"vessel":{"slope":0.77,"intercept":75.87,"xMax":2210,"yMax":2350},"albicans":{"slope":0.05,"intercept":19.73,"xMax":822.5,"yMax":812.5},"follicle":{"slope":1.26,"intercept":0.49,"xMax":167,"yMax":180},"macrophage":{"slope":0.27,"intercept":5.33,"xMax":355,"yMax":350.5}},"message":{"why":"The ovary is highly susceptible to age-related decline (loss of follicles, profound morphological changes), which shapes female reproductive lifespan.","reserve":"The ovarian reserve cannot be measured directly; AMH and FSH, widely used as indirect markers, cannot accurately reflect the true follicle reserve.","approach":"Histology with deep learning maps the ovary's microanatomy and finds features linked to ovarian fitness.","future":["study the spatial relationships between ovarian features","monitor how age affects the positional distribution of the microanatomical domains","validate in independent cohorts"]},"background":{"stages":["primordial","primary","secondary","antral"],"atBirth":[1000000,2000000],"atPuberty":[300000,400000],"atMenopause":1000,"menopauseAge":51,"notes":["follicles mature from primordial to primary, secondary and antral follicles","after ovulation the follicle becomes a corpus luteum, which shrinks to a pale scar of collagen, the corpus albicans, so scars accumulate over the years","AMH comes from the granulosa cells of growing follicles; FSH rises as the reserve falls"]},"cohort":{"note":"illustrative: drawn to follow the poster's trend lines, bands and shares at zero, not the donors' values","age":[21,21,22,22,22,22,23,23,23,24,24,24,25,25,26,26,26,26,27,27,27,28,28,28,28,29,29,29,30,31,31,31,32,32,32,33,33,33,34,34,35,35,36,36,37,38,39,39,40,40,40,41,41,41,41,41,42,42,42,42,42,43,43,43,43,43,44,44,44,44,45,45,45,45,46,46,46,46,47,47,47,47,48,48,48,48,48,48,49,49,49,49,49,49,49,49,49,49,49,50,50,50,50,50,50,50,50,50,51,51,51,51,51,51,51,52,52,52,52,52,52,53,53,53,53,53,53,53,53,54,54,54,54,54,54,54,54,54,54,54,55,55,55,55,55,55,55,55,55,56,56,56,56,56,56,57,57,57,57,57,57,58,58,58,58,58,58,59,59,59,59,59,59,60,60,60,60,60,61,61,61,61,61,61,62,62,62,62,63,63,63,63,63,63,63,63,63,64,64,64,64,64,64,64,64,65,65,65,65,65,65,65,65,65,66,66,66,66,66,66,66,66,66,66,67,67,67,67,67,67,67,67,67,67,68,68,68,68,68,68,68,68,68,69,69,69,69,69,69,69,69,70,70,70,70],"rho":{"vessel":0.845,"albicans":0.298,"follicle":0.922,"macrophage":0.783},"k":{"vessel":{"rf":0.4,"seg":0.676},"albicans":{"rf":0.811,"seg":0.686},"follicle":{"rf":1.513,"seg":1.372},"macrophage":{"rf":0.627,"seg":1.166}},"r":{"vessel":{"rf":-0.24,"seg":-0.43,"compare":0.78,"rfRank":-0.156,"segRank":-0.365},"albicans":{"rf":0.4,"seg":0.25,"compare":0.409,"rfRank":0.388,"segRank":0.229},"follicle":{"rf":-0.48,"seg":-0.48,"compare":0.94,"rfRank":-0.72,"segRank":-0.616},"macrophage":{"rf":0.05,"seg":-0.29,"compare":0.51,"rfRank":0.042,"segRank":-0.44}},"vessel":{"rf":[409,999,459,571,452,419,950,792,720,807,680,1023,784,670,1051,567,1011,942,675,898,629,782,968,475,727,1029,755,728,719,570,1012,1073,561,762,805,874,640,770,875,840,1064,940,932,918,427,933,649,607,713,984,623,563,594,588,895,889,536,710,781,844,569,693,759,613,722,497,947,821,729,595,575,690,565,759,806,597,521,673,565,629,491,558,685,584,432,948,544,388,589,468,926,374,853,516,595,631,586,925,923,783,814,688,642,710,691,739,518,822,395,494,533,645,680,496,487,520,494,705,679,741,887,472,602,562,686,544,723,518,687,650,614,546,665,631,673,594,694,541,805,463,818,594,548,528,489,734,588,744,484,762,675,631,845,377,581,767,804,516,731,608,379,721,469,513,734,682,723,776,469,470,655,570,511,603,702,778,740,365,569,647,742,735,662,721,405,647,494,801,539,483,480,800,558,693,470,610,700,427,823,608,806,654,545,814,884,579,610,698,650,674,763,742,773,466,744,522,651,827,622,993,736,790,825,558,527,734,806,673,584,614,454,410,652,977,738,738,823,667,532,722,592,686,541,741,704,576,645,611,617,588,660,519,737,718,741],"seg":[217,1063,286,859,690,376,1299,749,675,752,793,1109,931,427,1294,443,920,1518,709,1555,532,447,1256,366,490,1226,278,533,388,367,1136,1155,348,835,621,1064,477,583,1098,699,1449,1405,1029,831,288,1021,482,517,392,1279,449,285,521,428,856,1075,417,438,857,1090,428,1038,907,427,759,271,1054,787,676,843,588,453,452,1030,875,421,454,850,320,641,287,425,717,502,263,949,576,383,722,253,960,342,1088,477,453,555,694,1048,506,741,694,871,494,614,686,667,570,876,226,381,431,472,810,370,571,471,589,781,760,576,1115,366,589,349,754,594,499,596,583,707,336,628,651,512,764,464,694,511,930,310,748,587,601,614,604,800,684,632,600,762,587,443,785,351,611,669,745,355,629,623,309,619,354,559,737,613,549,719,204,346,512,330,228,436,512,731,644,188,377,539,624,773,604,421,230,295,240,580,400,193,264,563,338,507,371,394,499,287,535,375,615,350,577,623,682,287,290,487,337,414,505,577,415,319,640,358,347,659,398,758,544,446,568,448,312,524,733,382,251,326,194,273,444,846,661,499,530,344,291,567,360,536,329,580,505,342,717,586,338,386,336,187,600,532,346]},"albicans":{"rf":[83,120,68,142,54,93,67,50,214,183,90,114,27,62,59,89,34,172,139,108,123,163,157,55,75,67,45,67,127,106,74,61,33,169,121,70,86,73,105,132,171,142,94,41,196,211,119,72,178,105,327,123,128,183,106,41,86,121,126,239,202,231,263,81,232,99,331,252,265,273,276,0,64,147,192,219,222,196,356,415,392,62,183,199,62,280,109,46,100,259,49,153,88,137,109,228,142,121,105,310,140,249,48,222,41,225,218,272,255,310,261,247,306,112,108,261,232,51,292,123,439,235,458,269,146,303,306,45,165,221,328,186,41,128,104,204,266,176,238,216,155,328,285,271,482,304,73,48,396,207,96,100,237,79,143,298,54,213,230,276,102,288,258,225,301,92,47,346,48,110,279,98,233,319,83,124,378,237,208,139,201,61,69,231,80,65,376,110,134,216,77,469,146,533,276,225,316,341,109,151,105,132,145,171,186,364,242,188,486,114,297,446,91,158,183,118,138,227,154,137,278,124,264,366,243,335,130,514,415,529,260,120,345,295,127,127,114,124,248,218,244,231,502,176,358,154,169,239,122,257,292,252,170,263,311],"seg":[5,6,18,16,3,4,7,30,26,36,8,17,3,14,5,16,18,23,19,4,8,5,34,9,15,8,14,15,17,28,27,6,9,8,11,4,9,9,15,8,23,40,17,9,13,26,0,20,21,25,32,24,10,13,4,26,16,4,40,8,34,26,25,6,25,12,33,34,5,12,13,0,34,20,11,12,18,34,54,19,23,0,28,16,7,31,0,36,30,35,7,14,9,9,22,23,4,14,37,12,28,25,17,53,26,25,10,27,27,46,14,32,17,23,39,23,37,5,23,36,25,33,26,42,9,35,43,31,4,6,24,0,19,35,35,21,42,21,59,26,19,33,31,6,62,28,12,28,48,36,0,7,0,17,38,26,0,39,6,29,5,13,13,30,49,38,0,12,13,31,51,34,0,25,21,11,45,0,11,10,32,23,7,8,7,34,34,36,28,34,19,41,16,15,9,43,26,43,29,10,0,46,0,21,26,17,25,9,37,15,46,33,41,11,11,11,20,19,20,9,51,29,54,41,36,6,21,40,37,24,14,12,13,17,24,11,13,35,43,30,41,29,36,23,22,0,38,38,14,9,51,0,9,21,31]},"follicle":{"rf":[7,16,42,11,167,30,12,109,45,1,13,28,11,71,30,13,10,74,152,9,28,6,125,28,33,3,136,8,7,5,22,8,12,13,134,18,167,0,8,28,2,167,2,71,11,5,15,0,16,6,51,0,48,5,4,127,2,33,1,68,2,12,125,1,0,4,12,7,1,37,9,8,137,5,1,0,0,0,3,2,1,3,0,5,0,0,9,3,1,0,4,0,0,0,3,1,0,6,1,0,1,1,1,29,5,1,0,1,5,0,2,1,4,4,3,1,2,6,0,0,1,0,3,0,1,0,0,0,2,0,3,3,0,5,3,0,1,0,0,2,0,2,0,3,6,0,0,0,1,0,0,0,0,0,0,4,2,1,0,0,0,0,2,0,0,3,0,0,0,1,0,3,3,2,1,0,0,1,0,3,1,0,0,0,0,0,0,2,0,0,0,0,2,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1,0,0,1,0,0,2,0,0,0,0],"seg":[5,15,82,9,180,29,10,160,41,4,32,39,14,58,36,10,20,79,180,37,11,11,132,12,11,8,83,10,18,7,29,5,9,16,90,31,180,0,10,15,4,180,7,90,58,3,4,0,12,3,40,0,62,3,20,172,3,46,1,26,1,11,150,1,0,2,25,8,1,39,11,15,51,3,0,0,0,0,7,1,4,2,0,10,0,1,14,8,0,0,6,0,0,1,12,9,0,1,4,0,0,3,0,50,12,2,0,0,3,3,0,0,3,11,1,0,0,2,1,0,0,0,4,3,0,0,0,0,2,0,3,3,3,13,4,0,1,0,0,1,0,1,0,13,16,0,0,0,1,0,0,0,0,0,0,14,4,0,0,0,0,0,2,0,0,3,0,0,0,5,0,7,7,7,4,0,0,3,0,12,5,0,0,0,0,0,0,6,2,0,0,0,9,0,0,5,0,0,0,0,5,0,0,0,2,0,0,0,0,3,0,3,0,0,0,0,0,3,2,0,0,0,5,0,0,1,8,0,0,0,2,0,0,1,0,0,0,0,0,0,0,0,0,5,4,0,0,6,0,0,6,0,0,0,0]},"macrophage":{"rf":[16,24,75,14,19,104,9,52,9,85,86,15,38,43,21,9,44,20,27,77,53,109,27,52,15,30,25,45,40,53,31,49,32,7,42,7,18,112,16,9,16,53,32,30,18,29,100,106,30,26,9,44,45,49,26,96,121,30,62,34,11,52,24,58,31,84,30,96,44,62,22,63,70,104,102,31,99,50,123,57,27,62,16,46,37,13,81,48,44,65,40,68,70,59,95,34,44,48,11,10,64,16,24,12,102,14,76,57,30,36,77,24,15,66,35,88,75,16,97,18,50,19,34,72,12,16,22,21,55,63,49,40,90,34,43,51,68,94,37,16,100,20,13,22,45,60,52,68,21,84,57,42,33,17,21,16,114,17,45,68,16,24,63,41,51,96,80,23,48,49,92,72,32,25,28,28,59,85,24,40,19,11,19,95,56,0,33,47,99,71,62,23,53,71,52,72,75,59,11,18,47,60,13,23,28,61,8,9,101,66,61,45,25,14,82,69,48,42,61,14,35,46,74,12,42,65,56,9,22,12,44,28,96,93,9,54,40,75,36,80,7,72,98,13,11,34,11,67,27,69,8,56,88,44,57],"seg":[0,6,41,1,0,70,0,60,0,52,44,10,17,20,2,0,16,11,18,93,1,39,24,47,0,2,23,35,42,32,38,6,28,0,39,0,2,102,11,2,22,10,5,6,18,9,8,132,12,14,0,38,10,46,7,62,74,5,170,1,0,120,37,144,2,110,0,57,16,147,10,1,92,85,243,4,36,3,224,29,0,5,3,20,0,0,57,42,0,11,10,31,0,6,73,4,3,4,0,0,7,16,1,0,95,0,71,3,52,1,50,7,0,20,26,0,5,0,34,0,15,6,11,7,0,0,0,1,9,8,0,2,21,0,14,0,28,50,0,7,23,0,0,0,8,8,8,45,13,14,3,3,0,2,6,0,67,0,3,15,0,0,24,4,0,14,11,0,3,14,43,0,0,0,1,0,0,21,1,0,0,0,2,18,0,0,0,2,11,2,2,6,1,13,1,7,19,0,0,0,0,7,0,0,0,0,0,0,20,0,3,0,0,0,20,0,0,0,0,0,0,0,8,0,2,2,5,0,1,0,6,0,16,6,0,0,0,1,2,10,0,10,2,0,0,0,0,0,1,0,0,2,9,0,2]}},"checks":{"f1":{"vessel":{"printed":0.86,"computed":0.84},"macrophage":{"printed":0.87,"computed":0.87},"albicans":{"printed":0.88,"computed":0.88},"follicle":{"printed":0.83,"computed":0.83}},"histSum":255,"annotated":14941}};

// Shared parts of the aging ovary story's sets (pasted after OVARY_DATA, before the sets; the engine may use them too).
// OVARY_TREND: the poster's numbers looked up (fitted lines, the relative level of each kind of object with age, the
// trend charts' compressed y axis, r and p as printed). OVARY_LOOK: the story's look (colors; one lit material for
// merged objects that grow, shrink and light up with the age and the picked kind; a translucent mask material; a mesh
// builder; small shapes; surface nets for signed distance fields, built in slices).
const OVARY_TREND = (() => {
  const D = OVARY_DATA, KEYS = D.kinds.map(k => k.key);
  const kind = key => D.kinds.find(k => k.key === key);
  // the poster's fitted line at an age (objects per section): the lines read as straight lines in counts, so linear
  // between the readings (every 5 years from 21); a line with a zero age (the follicles) is 0 from there on
  const EXT = {};
  function line(o, m, age) {
    const T = D.trends[o] && D.trends[o][m];
    if (!T) return 0;
    const L = EXT[o + m] || (EXT[o + m] = T.zeroAge ? T.line.concat([[T.zeroAge, 0]]) : T.line);
    if (age <= L[0][0]) return L[0][1];
    for (let i = 1; i < L.length; i++) if (age <= L[i][0]) { const [a0, c0] = L[i - 1], [a1, c1] = L[i]; return c0 + (c1 - c0) * (age - a0) / (a1 - a0); }
    return T.zeroAge ? 0 : L[L.length - 1][1];
  }
  // how much of a kind there is at an age, relative to age 21: each method's line over its own value at 21, the two
  // averaged (the methods disagree on macrophages: flat by one, falling by the other). Cysts stay as they are.
  const level = (o, age) => (D.trends[o] ? (line(o, 'rf', age) / line(o, 'rf', 21) + line(o, 'seg', age) / line(o, 'seg', 21)) / 2 : 1);
  // the age at which a falling level crosses x (0..1 of its value at 21), or a rising one reaches x of its value at 70
  const LV = {};   // (each kind's level every quarter year from 20 to 70, made once)
  const lv = (o, i) => (LV[o] || (LV[o] = Array.from({ length: 201 }, (_, k) => level(o, 20 + k * 0.25))))[i];
  function crossing(o, x, rising) {
    const top = rising ? lv(o, 200) : 1;
    let prev = lv(o, 0) / top;
    for (let i = 1, a = 20.25; i <= 200; i++, a += 0.25) {
      const v = lv(o, i) / top;
      if (rising ? v >= x : v <= x) return a - 0.25 * (rising ? (v - x) / Math.max(1e-6, v - prev) : (x - v) / Math.max(1e-6, prev - v));
      prev = v;
    }
    return rising ? (lv(o, 0) / top >= x ? 0 : 99) : 99;
  }
  // the trend charts' y axis as printed: log10 of the count, with 0 drawn as a row at the place of 0.5
  const Y = c => Math.log10(Math.max(c, 0.5));
  // r and p as the poster prints them: '−0.24', '+0.40'; '2.1×10⁻⁴', '0.497'
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const rText = r => (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(2);
  function pText(p) {
    if (p >= 0.001) return String(p);
    const [m, e] = p.toExponential(1).split('e');
    return `${m}×10${String(+e).split('').map(c => SUP[c]).join('')}`;
  }
  return { KEYS, kind, line, level, crossing, Y, rText, pText };
})();

const OVARY_LOOK = (() => {
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  const C = {
    // H&E (the tour's tissue look): hematoxylin colors nuclei purple, eosin colors cytoplasm and fibers pink
    nucleus: hex('#4b3b8f'), nucleus2: hex('#7d6bc4'), eosin: hex('#e88bb0'), eosin2: hex('#f6c4d6'), white: hex('#fbf4f7'),
    // the organ: its surface (tunica albuginea), cortex, medulla, the hilum
    tunica: hex('#d9adb2'), cortex: hex('#b98ab0'), medulla: hex('#e2a3a6'), hilum: hex('#c46a6e'),
    granulosa: hex('#8e66b8'), theca: hex('#b4587a'), oocyte: hex('#f4b3cb'), zona: hex('#fbe8f1'), fluid: hex('#c4ccff'),
    luteum: hex('#f0b545'), albicans: hex('#d8bccb'), artery: hex('#c0353f'), vein: hex('#59649e'), blood: hex('#c23a3a'),
    macrophage: hex('#c79a86'),
  };
  // the poster's colors for each kind (vessel, macrophage, albicans, follicle, cyst), by index as in OVARY_DATA.kinds;
  // for glowing on the dark scene each is also given lighter (the follicle's deep indigo is nearly black there)
  const KIND = OVARY_DATA.kinds.map(k => hex(k.color));
  const GLOW = KIND.map(c => { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], f = l < 0.35 ? 0.45 : 0.18; return c.map(v => v + (1 - v) * f); });
  const KI = Object.fromEntries(OVARY_DATA.kinds.map((k, i) => [k.key, i]));

  // ------------------------------------------------------------- lighting
  // The scene's lights in a shader (as MeshStandardMaterial gives them with its defaults): a hemisphere light (sky
  // 0xdde8ff, ground 0x1a2233, 0.85) and a directional light (0.85) from over the viewer's left shoulder; a little
  // gloss and rim light so lit 3D objects read on the dark ground
  const LIT = `
vec3 litC(vec3 c, vec3 n, vec3 v, vec3 up, float gloss) {
  vec3 l = normalize(vec3(-0.5, 0.6, 1.0));
  vec3 hemi = mix(vec3(0.102, 0.133, 0.2), vec3(0.867, 0.91, 1.0), 0.5 + 0.5 * dot(n, up)) * 0.85;
  float df = max(dot(n, l), 0.0) * 0.85;
  float sp = pow(max(dot(n, normalize(l + v)), 0.0), 36.0) * gloss;
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.12;
  return c * (hemi + df) + vec3(sp) + c * rim;
}`;
  // ------------------------------------------------------------- merged objects
  // One geometry for many objects: each vertex carries its object's centre (aCen), color (aCol) and aObj = (the age it
  // appears at, the age it is gone by, its kind (index into OVARY_DATA.kinds; -1 none), its mode: 0 grows and shrinks,
  // 1 fades). In the shader an object grows from its centre as it appears and shrinks into it as it goes (over 3
  // years), or fades in and out in place, and takes its kind's color as that kind is picked out (uHi), while the
  // others dim (uDim).
  function builder() {
    const P = [], N = [], Cl = [], Ce = [], O = [], E = [];
    // add a geometry; o: { m (Matrix4), col ([r, g, b] or (x, y, z) -> [r, g, b], at the placed vertex), cen ([x, y, z],
    // default: the placed geometry's middle), obj ([appear, vanish, kind, mode]), edge (0..1 for all its vertices, or a
    // function of the vertex in the geometry's own frame; default: the shape's userData.edge, else 0) }
    function add(geo, o = {}) {
      // (an indexed shape is unrolled once and kept: most shapes are added many times)
      const g = geo.index ? (geo.userData.flat || (geo.userData.flat = geo.toNonIndexed())) : geo;
      const p = g.attributes.position.array, n = g.attributes.normal ? g.attributes.normal.array : null, cnt = p.length / 3;
      // (a shape may carry its own edge values per vertex: userData.edge, as blob() gives)
      const E0 = geo.userData.edge, ix = geo.index, ef = typeof o.edge === 'function' ? o.edge : null, ec = typeof o.edge === 'number' ? o.edge : null;
      const m = o.m ? o.m.elements : null;
      // the normal matrix: the inverse transpose of m's 3 x 3 part (for the uniform and axis scalings used here, m's
      // columns divided by their squared lengths)
      let q = null;
      if (m) { const sx = m[0] * m[0] + m[1] * m[1] + m[2] * m[2], sy = m[4] * m[4] + m[5] * m[5] + m[6] * m[6], sz = m[8] * m[8] + m[9] * m[9] + m[10] * m[10]; q = [m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz]; }
      const s = P.length;
      let mx = 0, my = 0, mz = 0;
      for (let i = 0; i < cnt; i++) {
        const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
        E.push(ef ? ef(x, y, z) : ec !== null ? ec : E0 ? E0[ix ? ix.getX(i) : i] : 0);
        let X = x, Y = y, Z = z;
        if (m) { X = m[0] * x + m[4] * y + m[8] * z + m[12]; Y = m[1] * x + m[5] * y + m[9] * z + m[13]; Z = m[2] * x + m[6] * y + m[10] * z + m[14]; }
        P.push(X, Y, Z); mx += X; my += Y; mz += Z;
        if (n) {
          let a = n[3 * i], b = n[3 * i + 1], c = n[3 * i + 2];
          if (q) { const A = q[0] * a + q[3] * b + q[6] * c, B2 = q[1] * a + q[4] * b + q[7] * c, C2 = q[2] * a + q[5] * b + q[8] * c, l = Math.sqrt(A * A + B2 * B2 + C2 * C2) || 1; a = A / l; b = B2 / l; c = C2 / l; }
          N.push(a, b, c);
        } else N.push(0, 0, 1);
      }
      const cen = o.cen || [mx / cnt, my / cnt, mz / cnt];
      const obj = o.obj || [-99, 999, -1, 0], cf = typeof o.col === 'function' ? o.col : null, cc = cf ? null : (o.col || [1, 1, 1]);
      for (let i = s; i < P.length; i += 3) {
        const c = cf ? cf(P[i], P[i + 1], P[i + 2]) : cc;
        Cl.push(c[0], c[1], c[2]); Ce.push(cen[0], cen[1], cen[2]); O.push(obj[0], obj[1], obj[2], obj[3]);
      }
      return cen;
    }
    function geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
      g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(Cl), 3));
      g.setAttribute('aCen', new THREE.BufferAttribute(new Float32Array(Ce), 3));
      g.setAttribute('aObj', new THREE.BufferAttribute(new Float32Array(O), 4));
      g.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(E), 1));
      g.computeBoundingSphere();
      return g;
    }
    return { add, geometry, count: () => P.length / 3 };
  }
  const OBJ_HEAD = `
attribute vec3 aCol, aCen; attribute vec4 aObj; attribute float aEdge;
uniform float uAge, uHi[6], uDim, uGrow;
uniform vec3 uHiCol[6];
float visAt(vec4 o) { return smoothstep(o.x - 1.5, o.x + 1.5, uAge) * (1.0 - smoothstep(o.y - 1.5, o.y + 1.5, uAge)); }
float hiOf(float k, out vec3 hc) { float h = 0.0; hc = vec3(0.0); for (int i = 0; i < 6; i++) if (abs(float(i) - k) < 0.5) { h = uHi[i]; hc = uHiCol[i]; } return h; }`;
  const hiUniforms = () => ({ uHi: { value: [0, 0, 0, 0, 0, 0] }, uHiCol: { value: GLOW.concat([[1, 1, 1]]).slice(0, 6).map(c => new THREE.Vector3(...c)) } });
  // the lit material for merged objects. opts: gloss (0.15), alpha (base opacity, 1), side, uniforms (shared ones, e.g.
  // the same uAge for several materials), glow (how much a picked kind glows, 0.35)
  function objMat(set, opts = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uAge: { value: 30 }, uDim: { value: 0 }, uGrow: { value: 1 }, uFade: { value: opts.alpha === undefined ? 1 : opts.alpha }, uGloss: { value: opts.gloss === undefined ? 0.15 : opts.gloss }, uGlowK: { value: opts.glow === undefined ? 0.35 : opts.glow } }, hiUniforms(), opts.uniforms || {}),
      transparent: true, side: opts.side || THREE.FrontSide, depthWrite: opts.depthWrite !== false,
      vertexShader: OBJ_HEAD + `
varying vec3 vN, vV, vC, vUp, vG; varying float vH, vF;
void main() {
  float vis = visAt(aObj) * uGrow, fd = step(0.5, aObj.w);
  vec3 p = aCen + (position - aCen) * mix(vis, 1.0, fd);
  vF = mix(1.0, vis, fd);
  vec3 hc; float h = hiOf(aObj.z, hc);
  vC = mix(aCol, hc, h) * (1.0 - uDim * (1.0 - h)); vG = hc * h; vH = h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  gl_Position = projectionMatrix * mv;
  if (vis < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: LIT + `
uniform float uA, uFade, uGloss, uGlowK;
varying vec3 vN, vV, vC, vUp, vG; varying float vH, vF;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  if (!gl_FrontFacing) n = -n;
  vec3 col = litC(vC, n, v, normalize(vUp), uGloss) + vG * uGlowK;
  gl_FragColor = vec4(col, uA * uFade * vF);
}`,
    });
    if (opts.polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = opts.polygonOffset; m.polygonOffsetUnits = opts.polygonOffset; }
    set.mats.push(m);
    return m;
  }
  // translucent masks and washes over objects (unlit): a kind's color, bright at the rim (aEdge 1) and see-through
  // inside; shown where a sweep (uSweep, along x in the material's frame, from uFrom) has passed the object's centre,
  // times uMask, or as its kind is picked out (uHi). aObj as for objMat; aCol is unused (the kind's color is used)
  function maskMat(set, opts = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uAge: { value: 30 }, uMask: { value: 0 }, uSweep: { value: 9 }, uHiFill: { value: opts.hiFill === undefined ? 0.5 : opts.hiFill }, uFill: { value: opts.fill === undefined ? 0.38 : opts.fill }, uDim: { value: 0 }, uGrow: { value: 1 } }, hiUniforms(), opts.uniforms || {}),
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: OBJ_HEAD + `
uniform float uMask, uSweep, uHiFill;
varying vec3 vC; varying float vAl, vE;
void main() {
  float vis = visAt(aObj) * uGrow;
  vec3 p = aCen + (position - aCen) * vis;
  vec3 hc; float h = hiOf(aObj.z, hc);
  float sw = uMask * smoothstep(0.0, 0.06, uSweep - aCen.x);
  vAl = max(sw, h * uHiFill); vC = hc; vE = aEdge;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  if (vis < 0.01 || vAl < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `
uniform float uA, uFill;
varying vec3 vC; varying float vAl, vE;
void main() {
  float e = smoothstep(0.78, 0.97, vE);
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.25 * e), uA * vAl * mix(uFill, 0.95, e));
}`,
    });
    set.mats.push(m);
    return m;
  }
  // set the picked-out amounts of a material made above: hi[k] for each kind (0..1)
  function setHi(mat, hi, dim) { for (let i = 0; i < 6; i++) mat.uniforms.uHi.value[i] = hi[i] || 0; if (dim !== undefined && mat.uniforms.uDim) mat.uniforms.uDim.value = dim; }

  // ------------------------------------------------------------- shapes (THREE geometries, centred on the origin)
  // a wavy, slightly domed body lying on the xy plane (top towards +z): radius R with waves on its rim, height h above
  // the plane and hb below it, and fine wrinkles; aEdge (via edgeOf) is 1 at the rim. opts: seed, waves (amplitude),
  // wrinkle (amplitude), rings, segs
  function blob(R, h, hb, opts = {}) {
    const r = K0.rng(opts.seed || 1), segs = opts.segs || 40, rings = opts.rings || 7, amp = opts.waves === undefined ? 0.16 : opts.waves;
    const W = [[2, r(), 0.5 * amp], [3, r(), 0.35 * amp], [5, r(), 0.3 * amp], [7, r(), 0.22 * amp], [11, r(), 0.12 * amp]];
    const rim = th => R * (1 + W.reduce((s, [k, ph, a]) => s + a * Math.sin(k * th + ph * 6.283), 0));
    const wr = opts.wrinkle === undefined ? 0.12 : opts.wrinkle;
    const P = [], I = [], E = [];
    // top: rings from the centre out; bottom: a flat cap below
    const top = (q, th) => { const rr = rim(th) * q, z = h * Math.sqrt(Math.max(0, 1 - q * q)) * (1 + wr * Math.sin(q * 9 + th * 3 + 1.7) * Math.sin(th * 5 + q * 4)); return [rr * Math.cos(th), rr * Math.sin(th), z]; };
    P.push(0, 0, h); E.push(0);
    for (let i = 1; i <= rings; i++) for (let j = 0; j < segs; j++) { const q = i / rings, th = j / segs * 6.2832; P.push(...top(Math.min(q, 0.999), th)); E.push(q); }
    for (let j = 0; j < segs; j++) { const th = j / segs * 6.2832, rr = rim(th) * 0.97; P.push(rr * Math.cos(th), rr * Math.sin(th), -hb); E.push(1); }
    const id = (i, j) => (i === 0 ? 0 : 1 + (i - 1) * segs + ((j % segs) + segs) % segs);
    for (let j = 0; j < segs; j++) I.push(0, id(1, j), id(1, j + 1));
    for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) { const a = id(i, j), b = id(i, j + 1), c = id(i + 1, j + 1), d = id(i + 1, j); I.push(a, d, c, a, c, b); }
    const bs = 1 + rings * segs;
    for (let j = 0; j < segs; j++) { const a = id(rings, j), b = id(rings, j + 1), c = bs + (j + 1) % segs, d = bs + j; I.push(a, d, c, a, c, b); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
    g.userData.edge = E;
    return g;
  }
  // a ring lying on the xy plane: radii r0..r1, a rounded top h high (towards +z), depth d below
  function ring(r0, r1, h, d, segs = 28) {
    const pts = [], n = 7;
    pts.push(new THREE.Vector2(r0, -d));
    for (let i = 0; i <= n; i++) { const a = Math.PI * i / n; pts.push(new THREE.Vector2((r0 + r1) / 2 - (r1 - r0) / 2 * Math.cos(a), h * Math.sin(a))); }
    pts.push(new THREE.Vector2(r1, -d));
    const g = new THREE.LatheGeometry(pts, segs);
    g.rotateX(Math.PI / 2);
    return g;
  }
  const sphere = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
  // the kit's rng, for shapes made before a set has K (the sets pass theirs to init)
  let K0 = null;
  const init = K => { K0 = K0 || K; };

  // ------------------------------------------------------------- surface nets (as the microanatomy story's organs)
  // A field f(x, y, z) (negative inside) over a box is polygonised: a coarse pass finds which cells are far from the
  // surface (their fine points take the sign without evaluating), then a grid of `res` cells along the longest side;
  // each cell the surface crosses gets a vertex (the mean of the crossings, pulled onto the surface), a quad joins the
  // four cells round every crossed grid edge. Normals from the field's gradient, colors from col(x, y, z), darkened in
  // creases. A generator: run it in slices (yield after each row) or at once. Returns { pos, nrm, col, idx }.
  function* nets(f, col, lo, hi, res) {
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), h = span / res;
    const nx = Math.ceil((hi[0] - lo[0]) / h) + 2, ny = Math.ceil((hi[1] - lo[1]) / h) + 2, nz = Math.ceil((hi[2] - lo[2]) / h) + 2;
    const o = [lo[0] - h, lo[1] - h, lo[2] - h];
    // coarse cells of 4 x 4 x 4: their corner values tell which are far from the surface
    const cs = 4, cx = Math.ceil(nx / cs) + 1, cy = Math.ceil(ny / cs) + 1, cz = Math.ceil(nz / cs) + 1, CF = new Float32Array(cx * cy * cz), ch = h * cs;
    for (let i = 0; i < cx; i++) { for (let j = 0; j < cy; j++) for (let k = 0; k < cz; k++) CF[(i * cy + j) * cz + k] = f(o[0] + i * ch, o[1] + j * ch, o[2] + k * ch); yield; }
    const M = ch * 0.9;
    const farOf = (i, j, k) => {
      const a = Math.min(cx - 2, Math.floor(i / cs)), b = Math.min(cy - 2, Math.floor(j / cs)), c = Math.min(cz - 2, Math.floor(k / cs));
      let s = 0;
      for (let q = 0; q < 8; q++) { const v = CF[((a + (q & 1)) * cy + b + (q >> 1 & 1)) * cz + c + (q >> 2 & 1)]; s += v > M ? 1 : v < -M ? -1 : 0; }
      return s === 8 ? 1 : s === -8 ? -1 : 0;
    };
    const F = new Float32Array(nx * ny * nz), id3 = (i, j, k) => (i * ny + j) * nz + k;
    for (let i = 0; i < nx; i++) { for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) { const fr = farOf(i, j, k); F[id3(i, j, k)] = fr ? fr * M : f(o[0] + i * h, o[1] + j * h, o[2] + k * h); } yield; }
    const VI = new Int32Array(nx * ny * nz).fill(-1), P = [], N = [], Cl = [];
    const EG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], cv = new Float64Array(8), e = h * 0.15;
    for (let i = 0; i < nx - 1; i++) {
      for (let j = 0; j < ny - 1; j++) for (let k = 0; k < nz - 1; k++) {
        let neg = 0;
        for (let c = 0; c < 8; c++) { cv[c] = F[id3(i + (c & 1), j + (c >> 1 & 1), k + (c >> 2 & 1))]; if (cv[c] < 0) neg++; }
        if (neg === 0 || neg === 8) continue;
        let sx = 0, sy = 0, sz = 0, ne = 0;
        for (const [a, b] of EG) {
          if ((cv[a] < 0) === (cv[b] < 0)) continue;
          const t = cv[a] / (cv[a] - cv[b]);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; ne++;
        }
        let x = o[0] + (i + sx / ne) * h, y = o[1] + (j + sy / ne) * h, z = o[2] + (k + sz / ne) * h;
        const d = f(x, y, z);
        const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), w = f(x + e, y + e, z + e);
        const gx = a - b - c + w, gy = -a - b + c + w, gz = -a + b - c + w, gl = Math.hypot(gx, gy, gz) || 1;
        const nxv = gx / gl, nyv = gy / gl, nzv = gz / gl, pull = Math.max(-h * 0.5, Math.min(h * 0.5, d));
        x -= nxv * pull; y -= nyv * pull; z -= nzv * pull;
        const oc = Math.max(0, h * 3 - f(x + nxv * h * 3, y + nyv * h * 3, z + nzv * h * 3)) / (h * 3);
        const ko = Math.max(0.5, Math.min(1, 1 - 0.55 * oc)), cl = col(x, y, z);
        VI[id3(i, j, k)] = P.length / 3; P.push(x, y, z); N.push(nxv, nyv, nzv); Cl.push(cl[0] * ko, cl[1] * ko, cl[2] * ko);
      }
      yield;
    }
    const I = [];
    const quad = (a, b, c, d, dir, axis) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      const ux = P[3 * c] - P[3 * a], uy = P[3 * c + 1] - P[3 * a + 1], uz = P[3 * c + 2] - P[3 * a + 2], vx = P[3 * d] - P[3 * b], vy = P[3 * d + 1] - P[3 * b + 1], vz = P[3 * d + 2] - P[3 * b + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx][axis];
      if (n * dir >= 0) I.push(a, b, c, a, c, d); else I.push(a, c, b, a, d, c);
    };
    for (let i = 1; i < nx - 1; i++) for (let j = 1; j < ny - 1; j++) for (let k = 1; k < nz - 1; k++) {
      const v0 = F[id3(i, j, k)];
      if ((v0 < 0) !== (F[id3(i + 1, j, k)] < 0)) quad(VI[id3(i, j - 1, k - 1)], VI[id3(i, j, k - 1)], VI[id3(i, j, k)], VI[id3(i, j - 1, k)], v0 < 0 ? 1 : -1, 0);
      if ((v0 < 0) !== (F[id3(i, j + 1, k)] < 0)) quad(VI[id3(i - 1, j, k - 1)], VI[id3(i - 1, j, k)], VI[id3(i, j, k)], VI[id3(i, j, k - 1)], v0 < 0 ? 1 : -1, 1);
      if ((v0 < 0) !== (F[id3(i, j, k + 1)] < 0)) quad(VI[id3(i - 1, j - 1, k)], VI[id3(i, j - 1, k)], VI[id3(i, j, k)], VI[id3(i - 1, j, k)], v0 < 0 ? 1 : -1, 2);
    }
    return { pos: new Float32Array(P), nrm: new Float32Array(N), col: new Float32Array(Cl), idx: P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I) };
  }
  // seeded smooth noise in 3D (value noise), about -1..1
  function noise3(seed) {
    const r = K0 ? K0.rng(seed) : (() => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(), T = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) T[i] = r() * 2 - 1;
    // (a table of 16 x 16 x 16 values, repeating: cheap to look up)
    return (x, y, z) => {
      const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
      let fx = x - i, fy = y - j, fz = z - k;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
      const i0 = i & 15, i1 = (i + 1) & 15, j0 = (j & 15) << 4, j1 = ((j + 1) & 15) << 4, k0 = (k & 15) << 8, k1 = ((k + 1) & 15) << 8;
      const a = T[i0 | j0 | k0], b = T[i1 | j0 | k0], c = T[i0 | j1 | k0], d = T[i1 | j1 | k0];
      const e = T[i0 | j0 | k1], f = T[i1 | j0 | k1], g = T[i0 | j1 | k1], h = T[i1 | j1 | k1];
      const ab = a + (b - a) * fx, cd = c + (d - c) * fx, ef = e + (f - e) * fx, gh = g + (h - g) * fx;
      const lo = ab + (cd - ab) * fy, hi = ef + (gh - ef) * fy;
      return lo + (hi - lo) * fz;
    };
  }
  return { C, KIND, GLOW, KI, hex, LIT, builder, objMat, maskMat, setHi, blob, ring, sphere, nets, noise3, init };
})();

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

// The ovary in 3D (the aging ovary story): a large cut-away ovary, lit, built from signed distance fields polygonised
// by surface nets (as the microanatomy story's organs, larger and in more detail): under its pale surface (the tunica
// albuginea) the cortex with follicles at their stages (primordial specks, primary and secondary follicles, antral
// follicles cut open: a fluid-filled antrum lined with granulosa cells, an oocyte on its mound), a corpus luteum and
// pale scars (corpora albicantia), the medulla with coiled blood vessels running in from the hilum. The age (20 to 70)
// thins the follicles and adds scars along the poster's trend lines (OVARY_TREND.level: follicles near none by about
// 60), a cut follicle closing as its floor rises; the vessels thin a little and the ovary shrinks. Tags give each
// method's count on the poster's lines at the age (organ_counts). It also sits small in
// the tour's body (the body set's frame, at the ovary's place, beside its partner and the uterus) and grows out of it,
// and the front wedge of the cut lifts away. The organ's two meshes build between frames (idle, finish).
SETS.organ = function (K) {
  const { THREE, smooth, clamp, prog, lerp } = K;
  const L = OVARY_LOOK, T = OVARY_TREND, C = L.C, KI = L.KI;
  L.init(K);
  const set = K.newSet('organ');
  const R = K.rng(51), rr = (a, b) => a + (b - a) * R();

  // ------------------------------------------------------------- the shape (local units: about 1.9 long)
  const A = 0.95, B = 0.56, CZ = 0.46, XC = -0.32;   // half axes; the cut removes z > 0 for x > XC
  const n1 = L.noise3(7), n2 = L.noise3(8), n3 = L.noise3(9), n4 = L.noise3(10);
  const bend = x => 0.07 * (x / A) * (x / A) + 0.02;
  function ell(x, y, z) {
    const a = x / A, b = (y - bend(x)) / B, c = z / CZ, k0 = Math.sqrt(a * a + b * b + c * c), k1 = Math.sqrt(a * a / (A * A) + b * b / (B * B) + c * c / (CZ * CZ));
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(A, B, CZ);
  }
  // (a cone with round ends, as the organs' models)
  function cone(a, b, r1, r2) {
    const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2], rd = r1 - r2, a2 = l2 - rd * rd, il2 = 1 / l2;
    return (x, y, z) => {
      const px = x - a[0], py = y - a[1], pz = z - a[2], yy = px * ba[0] + py * ba[1] + pz * ba[2], zz = yy - l2;
      const qx = px * l2 - ba[0] * yy, qy = py * l2 - ba[1] * yy, qz = pz * l2 - ba[2] * yy, x2 = qx * qx + qy * qy + qz * qz;
      const kk = Math.sign(rd) * rd * rd * x2;
      if (Math.sign(zz) * a2 * zz * zz > kk) return Math.sqrt(x2 + zz * zz * l2) * il2 - r2;
      if (Math.sign(yy) * a2 * yy * yy < kk) return Math.sqrt(x2 + yy * yy * l2) * il2 - r1;
      return (Math.sqrt(x2 * a2 * il2) + yy * rd) * il2 - r1;
    };
  }
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const surfN = (x, y, z) => 0.011 * n1(x * 4.2, y * 4.2, z * 4.2) + 0.005 * n2(x * 10, y * 10, z * 10);
  const HIL = [0.2, -0.44, -0.08], stub = cone(HIL, [0.27, -0.84, -0.16], 0.15, 0.085);
  const outer = (x, y, z) => ell(x, y, z) + surfN(x, y, z);
  const bodyF = (x, y, z) => smin(outer(x, y, z), stub(x, y, z), 0.14);
  // depth below the surface, on the cut face (z = 0)
  const depth = (x, y) => -outer(x, y, 0);
  const cortexD = (x, y) => 0.2 + 0.035 * n3(x * 3, y * 3, 0.5);

  // ------------------------------------------------------------- what is where (on the cut face, z = 0)
  const DISCS = [];   // [x, y, r] taken so far
  const free = (x, y, r, gap) => DISCS.every(([a, b, q]) => (x - a) * (x - a) + (y - b) * (y - b) > (r + q + gap) * (r + q + gap));
  const nearHilum = (x, y, r) => Math.hypot(x - HIL[0], y - HIL[1]) < r + 0.2;
  function place(n, rMin, rMax, dMin, dMax, gap, tries = 4000, opt = {}) {
    const out = [];
    for (let t = 0; t < tries && out.length < n; t++) {
      const r = rr(rMin, rMax), x = rr(XC + 0.04 + r, 0.93 - r), y = rr(-0.56, 0.62), d = depth(x, y);
      if (d < (opt.centre ? dMin : r + dMin) || d > (opt.centre ? dMax : r + dMax)) continue;
      if (!opt.hilum && nearHilum(x, y, r)) continue;
      if (!free(x, y, r, gap)) continue;
      DISCS.push([x, y, r]); out.push({ x, y, r, d });
    }
    return out;
  }
  // antral follicles (cut in half: holes in the face), the corpus luteum, scars, growing follicles, vessels cut across
  const ANT = place(8, 0.085, 0.15, 0.03, 0.075, 0.04);
  ANT.sort((a, b) => b.r - a.r);
  const LUT = place(1, 0.13, 0.15, 0.04, 0.09, 0.04)[0];
  const SCAR = place(16, 0.035, 0.1, 0.06, 0.32, 0.02);
  const SEC = place(14, 0.026, 0.04, 0.02, 0.09, 0.015);
  const PRI = place(30, 0.014, 0.02, 0.02, 0.07, 0.01);
  const VX = place(36, 0.012, 0.03, 0.17, 0.6, 0.012, 6000, { centre: true, hilum: true });
  // when each goes (or comes): along the poster's trend lines, the first ones early, so the count follows the line
  const order = n => { const o = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
  const falls = (list, kind) => { const o = order(list.length); list.forEach((s, i) => { s.until = T.crossing(kind, (o[i] + 0.5) / list.length, false); }); };
  falls(ANT, 'follicle'); falls(SEC, 'follicle'); falls(PRI, 'follicle'); falls(VX, 'vessel');
  { const o = order(SCAR.length); SCAR.forEach((s, i) => { s.from = T.crossing('albicans', (o[i] + 0.5) / SCAR.length, true); }); }
  // the largest antral follicle lasts longest (the one the story points at)
  { const last = ANT.reduce((a, s) => (s.until > a.until ? s : a), ANT[0]); [last.until, ANT[0].until] = [ANT[0].until, last.until]; }

  // ------------------------------------------------------------- the organ's field, with the antral holes
  const cutR = (x, z) => Math.min(z, x - XC);   // > 0 inside the removed wedge
  const holes = (x, y, z) => { let d = 9; for (let i = 0; i < ANT.length; i++) { const s = ANT[i], dx = x - s.x, dy = y - s.y, q = Math.sqrt(dx * dx + dy * dy + z * z) - s.r; if (q < d) d = q; } return d; };
  const mainF = (x, y, z) => Math.max(smax(bodyF(x, y, z), cutR(x, z), 0.012), -holes(x, y, z));
  const wedgeF = (x, y, z) => Math.max(smax(bodyF(x, y, z), -cutR(x, z), 0.012), -holes(x, y, z));
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const tint = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  // the face's colors: tunica (pale) at the rim, the cortex (dense, mauve, speckled) and the medulla (looser, redder,
  // mottled); round each antral follicle the theca; the holes lined with granulosa cells; the hilum red
  function faceCol(x, y, z, plain) {
    const d = -outer(x, y, z), cd = cortexD(x, y), sp = n2(x * 38, y * 38, z * 38), mo = n4(x * 7, y * 7, z * 7);
    let c;
    if (d < 0.03) c = mix(C.tunica, C.cortex, smooth((d - 0.012) / 0.02));
    else if (d < cd) c = tint(mix(C.cortex, [0.55, 0.38, 0.62], 0.2 + 0.3 * sp), 1 + 0.05 * mo);
    else c = tint(mix(C.medulla, [0.8, 0.42, 0.48], clamp(0.35 * mo + 0.25 * sp, 0, 1)), 1);
    if (d >= cd - 0.025 && d < cd + 0.025) c = mix(c, mix(C.cortex, C.medulla, 0.5), 0.6);
    return c;
  }
  function organCol(x, y, z) {
    const ds = stub(x, y, z), d0 = outer(x, y, z);
    if (ds < d0 && y < -0.32) return tint(mix(C.hilum, C.artery, 0.2 + 0.2 * n2(x * 20, y * 20, z * 20)), 1);
    if (z < -0.004 && Math.abs(holes(x, y, z)) < 0.012) return tint(mix(C.granulosa, C.nucleus2, 0.3 + 0.3 * n2(x * 50, y * 50, z * 50)), 0.95);
    if (d0 > -0.014) {
      // the outer surface: pale, with fine vessels showing through
      const st = Math.abs(n1(x * 9 + 3, y * 3, z * 9));
      return mix(C.tunica, [0.86, 0.6, 0.64], 0.35 * smooth(1 - st * 6) + 0.12 * n3(x * 13, y * 13, z * 13));
    }
    return faceCol(x, y, z);
  }

  // ------------------------------------------------------------- materials and meshes
  const ages = { value: 30 };   // (one age for all the ovary's materials)
  const solidMat = L.objMat(set, { gloss: 0.18, uniforms: { uAge: ages } });
  const organMat = L.objMat(set, { gloss: 0.1, uniforms: { uAge: ages } });
  const wedgeMat = L.objMat(set, { gloss: 0.1, uniforms: { uAge: ages } });
  const glassMat = L.objMat(set, { gloss: 0.9, alpha: 0.3, depthWrite: false, side: THREE.DoubleSide, uniforms: { uAge: ages } });
  const pairMat = L.objMat(set, { gloss: 0.12 }), pelvisMat = L.objMat(set, { gloss: 0.25 });
  for (const m of [solidMat, organMat, glassMat]) m.uniforms.uHiCol.value[5].set(...C.luteum.map(v => Math.min(1, v * 1.1)));
  // a geometry for the lit material from arrays (no objects in it: always shown)
  function objGeo(pos, nrm, col, idx) {
    const g = new THREE.BufferGeometry(), n = pos.length / 3;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aCen', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const o = new Float32Array(n * 4); for (let i = 0; i < n; i++) o.set([-99, 999, -1, 0], 4 * i);
    g.setAttribute('aObj', new THREE.BufferAttribute(o, 4));
    g.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(n), 1));
    if (idx) g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }
  // a stand-in until the organ is built (a smooth ellipsoid in the surface's color)
  function standIn(wedge) {
    const s = new THREE.SphereGeometry(1, 40, 24), p = s.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * A, p.getY(i) * B + bend(p.getX(i) * A), p.getZ(i) * CZ);
    s.computeVertexNormals();
    const g = s.toNonIndexed(), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set(C.tunica, 3 * i);
    return wedge ? new THREE.BufferGeometry() : objGeo(g.attributes.position.array, g.attributes.normal.array, col, null);
  }
  const ovary = new THREE.Group(), wedge = new THREE.Group(), partner = new THREE.Group();
  set.group.add(ovary, partner); ovary.add(wedge);
  const organMesh = new THREE.Mesh(standIn(false), organMat), wedgeMesh = new THREE.Mesh(standIn(true), wedgeMat);
  ovary.add(organMesh); wedge.add(wedgeMesh);
  wedgeMesh.visible = false;   // (until built)
  const pairA = new THREE.Mesh(organMesh.geometry, pairMat), pairB = new THREE.Mesh(wedgeMesh.geometry, pairMat);
  pairB.visible = false;
  partner.add(pairA, pairB);
  // the two meshes, built between frames (about 0.1 to 0.3 s of work each)
  const JOBS = [
    { gen: L.nets(mainF, organCol, [-1.0, -0.9, -0.52], [1.0, 0.66, 0.5], 80), done: r => { organMesh.geometry.dispose(); organMesh.geometry = pairA.geometry = objGeo(r.pos, r.nrm, r.col, r.idx); } },
    { gen: L.nets(wedgeF, organCol, [XC - 0.04, -0.62, -0.04], [1.0, 0.66, 0.5], 56), done: r => { wedgeMesh.geometry.dispose(); wedgeMesh.geometry = pairB.geometry = objGeo(r.pos, r.nrm, r.col, r.idx); wedgeMesh.visible = pairB.visible = true; } },
  ];
  let built = false;
  function step(ms) {
    if (built) return true;
    const until = performance.now() + ms;
    while (JOBS.length) {
      const j = JOBS[0], r = j.gen.next();
      if (r.done) { j.done(r.value); JOBS.shift(); continue; }
      if (performance.now() > until) return false;
    }
    built = true;
    return true;
  }

  // ------------------------------------------------------------- the follicles, scars, vessels (merged, by age)
  const S0 = L.builder(), G0 = L.builder(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3();
  const at = (x, y, z, s = [1, 1, 1], q = null) => M4.compose(V.set(x, y, z), q || Q.identity(), SC.set(s[0], s[1], s[2])).clone();
  const FOL = KI.follicle, ALB = KI.albicans, VES = KI.vessel, LUTK = 5;
  const SPH = [0, 1, 2].map(d => L.sphere(1, d));   // (unit spheres, placed and sized by matrix)
  // a tube along a smooth curve through pts, its radius tapering from r0 to r1 (frames about +z: the curves lie nearly
  // in the face)
  function ptube(pts, r0, r1, n, radial = 8) {
    const cu = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q))), P = cu.getPoints(n), up = new THREE.Vector3(0, 0, 1);
    const pos = [], nrm = [], idx = [], t = new THREE.Vector3(), b = new THREE.Vector3(), nn = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      t.subVectors(P[Math.min(n, i + 1)], P[Math.max(0, i - 1)]).normalize();
      b.crossVectors(t, up).normalize(); nn.crossVectors(b, t);
      const r = r0 + (r1 - r0) * i / n;
      for (let j = 0; j <= radial; j++) { const a = j / radial * 6.2832; d.copy(b).multiplyScalar(Math.cos(a)).addScaledVector(nn, Math.sin(a)); pos.push(P[i].x + d.x * r, P[i].y + d.y * r, P[i].z + d.z * r); nrm.push(d.x, d.y, d.z); }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, c = a + radial + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
    return g;
  }
  // antral follicles: the mound of granulosa cells (cumulus) on the cavity wall, the oocyte on it in its pale zona, the
  // antrum's fluid (a glassy lens filling the cavity)
  const OOC = [];
  for (const s of ANT) {
    const ph = rr(0, 6.283), dir = new THREE.Vector3(Math.cos(ph) * 0.62, Math.sin(ph) * 0.62, -0.5).normalize();
    const cu = [s.x + dir.x * s.r * 0.86, s.y + dir.y * s.r * 0.86, dir.z * s.r * 0.86], oc = [s.x + dir.x * s.r * 0.6, s.y + dir.y * s.r * 0.6, dir.z * s.r * 0.6];
    const obj = [-99, s.until, FOL, 0];
    const k3 = k => [s.r * k, s.r * k, s.r * k];
    S0.add(SPH[2], { m: at(...cu, k3(0.3)), col: C.granulosa, cen: [s.x, s.y, 0], obj });
    S0.add(SPH[2], { m: at(...oc, k3(0.12)), col: C.oocyte, cen: [s.x, s.y, 0], obj });
    S0.add(SPH[1], { m: at(oc[0] + 0.01 * s.r, oc[1] + 0.02 * s.r, oc[2] + s.r * 0.09, k3(0.045)), col: C.nucleus, cen: [s.x, s.y, 0], obj });
    G0.add(SPH[2], { m: at(...oc, k3(0.17)), col: C.zona, cen: [s.x, s.y, 0], obj });
    // (the fluid's surface, a little below the face: glossy, see-through)
    G0.add(new THREE.CircleGeometry(s.r * 0.985, 36), { m: at(s.x, s.y, -0.012), col: C.fluid, cen: [s.x, s.y, 0], obj });
    OOC.push(oc);
  }
  // growing follicles cut across: a dome of granulosa cells with the oocyte showing at its top
  for (const [list, kz] of [[SEC, 0.62], [PRI, 0.5]]) for (const s of list) {
    const obj = [-99, s.until, FOL, 0];
    S0.add(SPH[1], { m: at(s.x, s.y, 0, [s.r, s.r, s.r * kz]), col: tint(C.granulosa, 0.95 + 0.1 * R()), obj });
    S0.add(SPH[1], { m: at(s.x, s.y, s.r * kz * 0.62, [s.r * 0.42, s.r * 0.42, s.r * 0.3]), col: C.oocyte, cen: [s.x, s.y, 0], obj });
  }
  // the corpus luteum (golden, folded; gone by about 50) and the corpora albicantia (pale scars, more with age)
  if (LUT) S0.add(L.blob(LUT.r, 0.05, 0.05, { seed: 3, waves: 0.12, wrinkle: 0.28, rings: 9, segs: 56 }), { m: at(LUT.x, LUT.y, 0), col: (x, y, z) => mix(C.luteum, [0.86, 0.52, 0.2], clamp(0.3 + 0.7 * n2(x * 30, y * 30, z * 30), 0, 1)), cen: [LUT.x, LUT.y, 0], obj: [-99, 50, LUTK, 0] });
  for (const s of SCAR) S0.add(L.blob(s.r, Math.min(0.018, s.r * 0.25), 0.03, { seed: 20 + Math.floor(R() * 1000), waves: 0.3, wrinkle: 0.18, rings: 5, segs: 30 }), { m: at(s.x, s.y, 0, [1, 1, 1], Q.setFromAxisAngle(V.set(0, 0, 1), rr(0, 6.28)).clone()), col: (x, y, z) => mix(C.albicans, [0.86, 0.74, 0.86], clamp(0.5 + 0.8 * n2(x * 40, y * 40, z * 40), 0, 1)), cen: [s.x, s.y, 0], obj: [s.from, 999, ALB, 0] });
  // on the intact part: scars puckering the surface, follicles bulging it (blisters)
  const onSurface = (u, v) => {   // a point of the surface by two angles, and its outward normal
    const p = [A * Math.cos(v) * Math.cos(u), B * Math.sin(v) + bend(A * Math.cos(v) * Math.cos(u)), CZ * Math.cos(v) * Math.sin(u)];
    const n = new THREE.Vector3(p[0] / (A * A), (p[1] - bend(p[0])) / (B * B), p[2] / (CZ * CZ)).normalize();
    return { p, n };
  };
  const SURF = [], BLIS = [];
  for (let t = 0; t < 400 && (SURF.length < 6 || BLIS.length < 4); t++) {
    const u = rr(Math.PI * 0.55, Math.PI * 0.95), v = rr(-0.75, 0.85), { p, n } = onSurface(u, v);
    if (p[0] > XC - 0.08 || p[2] < 0.06) continue;
    const r = BLIS.length < 4 ? rr(0.08, 0.12) : rr(0.04, 0.07);
    if ([...SURF, ...BLIS].some(o => Math.hypot(o.p[0] - p[0], o.p[1] - p[1], o.p[2] - p[2]) < o.r + r + 0.03)) continue;
    (BLIS.length < 4 ? BLIS : SURF).push({ p, n, r });
  }
  falls(BLIS, 'follicle');
  { const o = order(SURF.length); SURF.forEach((s, i) => { s.from = T.crossing('albicans', (o[i] + 0.5) / SURF.length, true); }); }
  const up = new THREE.Vector3(0, 0, 1);
  for (const s of SURF) {
    const q = new THREE.Quaternion().setFromUnitVectors(up, s.n), c = [s.p[0] - s.n.x * 0.012, s.p[1] - s.n.y * 0.012, s.p[2] - s.n.z * 0.012];
    S0.add(L.blob(s.r, 0.02, 0.03, { seed: 300 + Math.floor(R() * 1000), waves: 0.3, wrinkle: 0.4, rings: 5, segs: 30 }), { m: at(...c, [1, 1, 1], q), col: C.albicans, cen: c, obj: [s.from, 999, ALB, 0] });
  }
  for (const s of BLIS) {
    const c = [s.p[0] - s.n.x * s.r * 0.55, s.p[1] - s.n.y * s.r * 0.55, s.p[2] - s.n.z * s.r * 0.55];
    S0.add(SPH[2], { m: at(...c, [s.r, s.r, s.r]), col: [0.96, 0.82, 0.86], cen: c, obj: [-99, s.until, FOL, 0] });
  }
  // the blood vessels: coiled arteries and veins in relief on the face, from the hilum up through the medulla (and out
  // through the hilum below), and vessels cut across (a wall round a dark lumen), some of them gone with age
  const VPATH = [];
  const inMed = (x, y) => depth(x, y) > cortexD(x, y) + 0.03;
  const medPick = () => { for (let t = 0; t < 400; t++) { const x = rr(XC + 0.08, 0.86), y = rr(-0.4, 0.55); if (inMed(x, y)) return [x, y]; } return [0.3, 0.1]; };
  // a coiled path from a to b (helicine arteries coil tightly, veins gently), bending a little to one side
  function vpath(a, b, art, bendK) {
    const pts = [], n = 18, dx = b[0] - a[0], dy = b[1] - a[1], ln = Math.hypot(dx, dy) || 1, px = -dy / ln, py = dx / ln;
    for (let k = 0; k <= n; k++) {
      const t = k / n, w = (art ? 0.009 : 0.005) * Math.sin(t * ln * (art ? 120 : 60) + bendK * 7), bo = bendK * ln * 0.25 * Math.sin(Math.PI * t);
      pts.push([a[0] + dx * t + px * (w + bo), a[1] + dy * t + py * (w + bo), -0.005]);
    }
    return pts;
  }
  for (let i = 0; i < 6; i++) {
    const art = i % 2 === 0, st = [HIL[0] - 0.1 + 0.2 * (i + 0.5) / 6, HIL[1] + 0.07];
    const tip = medPick(), bk = rr(-1, 1), trunk = vpath(st, tip, art, bk);
    // (and out through the hilum below)
    const out = [[st[0] + 0.03, st[1] - 0.16, -0.07], [st[0] + 0.06, st[1] - 0.36, -0.15]].reverse();
    const r0 = art ? 0.015 : 0.018;
    S0.add(ptube(out.concat(trunk), r0, r0 * 0.5, 80), { col: art ? C.artery : C.vein, obj: [-99, 999, VES, 0] });
    VPATH.push(trunk[Math.floor(trunk.length * 0.5)]);
    // two branches from along the trunk
    for (const f of [0.4, 0.7]) {
      const b0 = trunk[Math.floor(trunk.length * f)], to = medPick();
      if (Math.hypot(to[0] - b0[0], to[1] - b0[1]) > 0.5) continue;
      S0.add(ptube(vpath(b0, to, art, rr(-1, 1)), r0 * 0.6, r0 * 0.3, 40, 6), { col: art ? C.artery : C.vein, obj: [-99, 999, VES, 0] });
    }
  }
  for (const s of VX) {
    const q = Q.setFromAxisAngle(V.set(0, 0, 1), rr(0, 3.14)).clone(), e = rr(1, 1.5), obj = [-99, s.until, VES, 0];
    S0.add(L.ring(0.55, 1, 0.35, 0.3, 24), { m: at(s.x, s.y, 0.002, [s.r * e, s.r, s.r], q), col: R() < 0.5 ? C.artery : tint(C.vein, 1.25), cen: [s.x, s.y, 0], obj });
    S0.add(new THREE.CircleGeometry(0.56, 20), { m: at(s.x, s.y, 0.0035, [s.r * e, s.r, 1], q), col: [0.32, 0.08, 0.12], cen: [s.x, s.y, 0], obj });
  }
  // the theca round each cut antral follicle: a darker ring on the face that fades as its follicle goes
  const F0 = L.builder();
  for (const s of ANT) F0.add(new THREE.RingGeometry(s.r, s.r + 0.034, 48, 1), { m: at(s.x, s.y, 0.0007), col: C.theca, cen: [s.x, s.y, 0], obj: [-99, s.until, FOL, 1] });
  const thecaMat = L.objMat(set, { gloss: 0.05, alpha: 0.8, depthWrite: false, polygonOffset: -1, uniforms: { uAge: ages } });
  const thecaMesh = new THREE.Mesh(F0.geometry(), thecaMat);
  thecaMesh.renderOrder = 1;
  ovary.add(thecaMesh);
  const solidMesh = new THREE.Mesh(S0.geometry(), solidMat), glassMesh = new THREE.Mesh(G0.geometry(), glassMat);
  glassMesh.renderOrder = 2;
  ovary.add(solidMesh, glassMesh);

  // the floor of each cut antral follicle: as the follicle goes it rises (and widens to fit the cavity) until it is
  // flush with the face, in the cortex's color: the cavity closes into stroma
  const plugGeo = (() => {
    const P = [], Cl = [], Ce = [], O = [], segs = 32, rings = 4;
    for (const s of ANT) {
      const ring = [];
      for (let i = 0; i <= rings; i++) for (let j = 0; j < segs; j++) { const q = i / rings, a = j / segs * 6.2832; ring.push([q * Math.cos(a), q * Math.sin(a)]); }
      const id = (i, j) => i * segs + (j % segs), tri = [];
      for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) tri.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1));
      for (const k of tri) {
        const [u, v] = ring[k];
        P.push(u, v, 0); const c = faceCol(s.x + u * (s.r + 0.03), s.y + v * (s.r + 0.03), 0); Cl.push(...c); Ce.push(s.x, s.y, 0); O.push(-99, s.until, FOL, s.r);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(Cl, 3));
    g.setAttribute('aCen', new THREE.Float32BufferAttribute(Ce, 3)); g.setAttribute('aObj', new THREE.Float32BufferAttribute(O, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.3, 0, 0), 1.2);
    return g;
  })();
  const plugMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uAge: ages, uDim: organMat.uniforms.uDim },
    transparent: true,
    vertexShader: `
attribute vec3 aCol, aCen; attribute vec4 aObj;
uniform float uAge, uDim;
varying vec3 vN, vV, vC, vUp;
void main() {
  float vis = 1.0 - smoothstep(aObj.y - 1.5, aObj.y + 1.5, uAge), r = aObj.w;
  float d = r * vis, rp = sqrt(max(r * r - d * d, 0.0)) + 0.03;
  vec3 p = aCen + vec3(position.xy * rp, 0.0012 - d);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * vec3(0.0, 0.0, 1.0)); vV = -mv.xyz; vUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vC = aCol * (1.0 - uDim);
  gl_Position = projectionMatrix * mv;
  if (vis > 0.995) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: L.LIT + `
uniform float uA;
varying vec3 vN, vV, vC, vUp;
void main() { gl_FragColor = vec4(litC(vC, normalize(vN), normalize(vV), normalize(vUp), 0.1), uA); }`,
  });
  set.mats.push(plugMat);
  ovary.add(new THREE.Mesh(plugGeo, plugMat));
  // primordial follicles: specks in a band just under the surface, the resting reserve
  const SPK = [];   // (sizes exaggerated: real ones are about 0.04 mm)
  for (let t = 0; t < 20000 && SPK.length < 900; t++) {
    const x = rr(XC + 0.02, 0.94), y = rr(-0.56, 0.64), e = ell(x, y, 0);
    if (e > -0.02 || e < -0.11) continue;
    const d = depth(x, y);
    if (d < 0.03 || d > 0.08 + 0.02 * n3(x * 5, y * 5, 1) || nearHilum(x, y, 0) || !free(x, y, 0.008, 0)) continue;
    SPK.push([x, y]);
  }
  const spG = K.pointsGeo(SPK.length), spP = spG.attributes.position.array, spC = spG.attributes.aCol.array, spS = spG.attributes.aSize.array, spU = new Float32Array(SPK.length);
  { const o = order(SPK.length); SPK.forEach(([x, y], i) => { spP.set([x, y, 0.004], 3 * i); spC.set(mix(C.oocyte, [1, 0.9, 0.95], 0.4), 3 * i); spS[i] = rr(0.012, 0.018); spU[i] = T.crossing('follicle', (o[i] + 0.5) / SPK.length, false); }); }
  spG.setAttribute('aU', new THREE.BufferAttribute(spU, 1));
  const spMat = K.points(set, { hard: true, additive: false, uniforms: { uAge: ages, uS: { value: 1 }, uHiF: { value: 0 }, uHiC: { value: new THREE.Vector3(...L.GLOW[FOL]) } },
    head: 'attribute float aU; uniform float uAge, uS, uHiF; uniform vec3 uHiC;',
    vertex: 'gl_PointSize = pointPx(aSize * uS, mv); vA *= 1.0 - smoothstep(aU - 1.5, aU + 1.5, uAge); vC = mix(vC, uHiC, uHiF);' });
  const specks = new THREE.Points(spG, spMat);
  ovary.add(specks);

  // ------------------------------------------------------------- the pelvis (in the body: the uterus, the tubes)
  // in the body set's frame: the body faces +z, the person's left is +x; the ovaries at x = +-0.06, y = -0.06
  const BODY_AT = [-0.06, -0.06, 0.0], BODY_S = 0.028, BODY_ROT = 1.0;
  const P0 = L.builder();
  {
    const prof = [[0.001, -0.125], [0.008, -0.118], [0.011, -0.1], [0.016, -0.08], [0.024, -0.058], [0.026, -0.045], [0.022, -0.036], [0.012, -0.031], [0.001, -0.03]].map(([x, y]) => new THREE.Vector2(x, y));
    const ut = new THREE.LatheGeometry(prof, 24);
    ut.scale(1.2, 1, 0.7);
    P0.add(ut, { m: at(0, 0, 0.02), col: [0.84, 0.48, 0.54] });
    for (const sx of [-1, 1]) {
      const tube = K.tube([[sx * 0.02, -0.04, 0.02], [sx * 0.036, -0.036, 0.022], [sx * 0.052, -0.042, 0.016], [sx * 0.064, -0.05, 0.006], [sx * 0.07, -0.062, 0.0]], 0.0028, 30, 6, false);
      P0.add(tube, { col: [0.9, 0.6, 0.66] });
      // its fringed end (fimbriae) over the ovary
      for (let k = 0; k < 6; k++) P0.add(SPH[0], { m: at(sx * (0.068 + 0.004 * Math.cos(k)), -0.064 + 0.004 * Math.sin(k * 2), 0.002 * k, [0.003, 0.003, 0.003]), col: [0.92, 0.66, 0.7] });
    }
  }
  const pelvis = new THREE.Mesh(P0.geometry(), pelvisMat);
  set.group.add(pelvis);
  partner.position.set(-BODY_AT[0], BODY_AT[1], BODY_AT[2]); partner.scale.setScalar(BODY_S); partner.rotation.z = BODY_ROT;

  // ------------------------------------------------------------- anchors (in the set's frame, following the ovary)
  const tmp = new THREE.Vector3();
  const W = p => { tmp.set(p[0], p[1], p[2]); ovary.updateMatrix(); tmp.applyMatrix4(ovary.matrix); return [tmp.x, tmp.y, tmp.z]; };
  const big = ANT[0], scar0 = SCAR.reduce((a, s) => (s.from < a.from ? s : a), SCAR[0]);
  // (the cortex label towards the right-hand end, clear of the follicle's)
  const cortexPt = (() => { for (let x = 0.9; x > 0.4; x -= 0.01) for (const y of [0.05, -0.05, 0.12, -0.12, 0.2]) { const d = depth(x, y); if (d > 0.07 && d < 0.13 && free(x, y, 0.02, 0)) return [x, y, 0.01]; } return [0.75, 0.05, 0.01]; })();
  const medPt = (() => { let best = [0.3, -0.1, 0.01], bd = 0; for (let x = 0; x < 0.6; x += 0.03) for (let y = -0.3; y < 0.3; y += 0.03) { const d = depth(x, y); if (d > bd && free(x, y, 0.02, 0)) { bd = d; best = [x, y, 0.01]; } } return best; })();
  const spk0 = SPK.reduce((a, p) => (p[1] > a[1] ? p : a), SPK[0] || [0.4, 0.5]);
  const sec0 = SEC.reduce((a, s) => (s.until > a.until ? s : a), SEC[0]);
  const anchors = {
    cortex: () => W(cortexPt), medulla: () => W(medPt), follicle: () => W([big.x, big.y, 0]), oocyte: () => W(OOC[0]),
    primordial: () => W([spk0[0], spk0[1], 0.005]), secondary: () => W([sec0.x, sec0.y, sec0.r * 0.6]),
    luteum: () => W(LUT ? [LUT.x, LUT.y, 0.05] : [0.3, 0.3, 0]), albicans: () => W([scar0.x, scar0.y, 0.03]),
    vessel: () => W(VPATH[0] || medPt), hilum: () => W([HIL[0] + 0.04, HIL[1] - 0.3, -0.12]),
    surface: () => W(SURF[0] ? SURF[0].p : [-0.7, 0.2, 0.25]), blister: () => W(BLIS[0] ? BLIS[0].p : [-0.6, 0.3, 0.3]),
    top: () => W([0.1, 0.7, 0]), age: () => W([0.0, 0.78, 0.1]),
    small: () => { ovary.updateMatrix(); return [ovary.position.x, ovary.position.y, ovary.position.z]; },
    pelvis: [0, -0.07, 0.02],
  };
  let ageNow = 30, gNow = 1;
  // the counts on the poster's lines at the age, as the tags give them (organ_counts): each method's line (OVARY_TREND),
  // whole numbers under 100, the nearest ten above; none once both lines are about zero (read off the poster's figures:
  // approximate)
  const tagN = c => (c < 99.5 ? Math.round(c) : Math.round(c / 10) * 10).toLocaleString('en-US');
  const countTag = k => {
    const name = OVARY_DATA.kinds[KI[k]].plural, r = T.line(k, 'rf', ageNow), s = T.line(k, 'seg', ageNow);
    return [name.charAt(0).toUpperCase() + name.slice(1), r < 0.5 && s < 0.5 ? 'none left on the lines' : `RF ${tagN(r)} · Seg ${tagN(s)}`];
  };
  const visOf = (from, until) => prog(ageNow, from - 1.5, from + 1.5) * (1 - prog(ageNow, until - 1.5, until + 1.5));

  // ------------------------------------------------------------- update
  const hi = [0, 0, 0, 0, 0, 0];
  function update(S, t, dt) {
    if (!built) step(4);
    const g = smooth(clamp(S.organ_grow, 0, 1)), age = clamp(S.organ_age, 20, 70), open = smooth(clamp(S.organ_open, 0, 1)), body = clamp(S.organ_body, 0, 1);
    ageNow = age; gNow = g; ages.value = age;
    // from small in the body (turned as it lies there) to large at the centre; the ovary shrinks with age
    const shrink = 1 - 0.16 * smooth((age - 45) / 23);
    ovary.position.set(lerp(BODY_AT[0], 0, g), lerp(BODY_AT[1], 0, g), lerp(BODY_AT[2], 0, g));
    ovary.scale.setScalar(Math.exp(lerp(Math.log(BODY_S), 0, g)) * shrink);
    ovary.rotation.set(0, 0, BODY_ROT * (1 - g));
    // the front wedge of the cut lifts away and fades
    wedge.position.set(0.5 * open, 0.4 * open, 0.5 * open);
    wedge.rotation.set(-0.45 * open, 0.55 * open, 0);
    wedgeMat.uniforms.uFade.value = 1 - prog(open, 0.45, 0.95);
    wedge.visible = open < 0.95;
    // the pelvis and the other ovary while it is small in the body
    const pa = body * (1 - prog(g, 0, 0.3));
    pelvisMat.uniforms.uFade.value = pairMat.uniforms.uFade.value = pa;
    pelvis.visible = partner.visible = pa > 0.01;
    // picked out: follicles, scars, vessels, the corpus luteum (the poster's colors), the rest dims
    hi[VES] = clamp(S.organ_vessel, 0, 1); hi[ALB] = clamp(S.organ_albicans, 0, 1); hi[FOL] = clamp(S.organ_follicle, 0, 1); hi[LUTK] = clamp(S.organ_luteum, 0, 1);
    const dim = 0.45 * Math.max(...hi);
    for (const m of [solidMat, glassMat, organMat, wedgeMat, thecaMat]) L.setHi(m, hi, dim);
    spMat.uniforms.uHiF.value = hi[FOL]; spMat.uniforms.uS.value = ovary.scale.x;
  }

  return Object.assign(set, {
    params: { organ_a: 1, organ_grow: 1, organ_body: 0, organ_open: 1, organ_age: 30, organ_follicle: 0, organ_albicans: 0, organ_vessel: 0, organ_luteum: 0, organ_parts: 0, organ_agelab: 0, organ_counts: 0 },
    update,
    idle() { step(3); },
    finish() { step(Infinity); },
    built: () => built,
    anchors,
    labels: [
      { text: ['Cortex', 'where the follicles are'], at: 'cortex', cls: 'mag', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) },
      { text: ['Medulla', 'vessels, loose tissue'], at: 'medulla', cls: 'cyn', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) },
      { text: ['Follicle', 'fluid-filled'], at: 'follicle', cls: '', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) * visOf(-99, big.until) },
      { text: ['Primordial follicles', 'the reserve'], at: 'primordial', cls: 'amb', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) * (1 - prog(S.organ_age, 45, 55)) },
      { text: ['Corpus albicans', 'a pale scar'], at: 'albicans', cls: 'grn', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) * visOf(scar0.from, 999) },
      { text: ['Corpus luteum', ''], at: 'luteum', cls: 'amb', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) * visOf(-99, 50) },
      { text: () => ['Age', `${Math.round(ageNow)} years`], at: 'age', cls: 'cyn', alpha: S => S.organ_agelab * prog(S.organ_grow, 0.85, 1) },
      // each method's count on the poster's line at the age (function labels, read again while they show)
      { text: () => countTag('follicle'), at: 'follicle', cls: 'amb', alpha: S => S.organ_counts * prog(S.organ_grow, 0.85, 1) },
      { text: () => countTag('albicans'), at: 'albicans', cls: 'mag', alpha: S => S.organ_counts * prog(S.organ_grow, 0.85, 1) },
      { text: () => countTag('vessel'), at: 'vessel', cls: 'cyn', alpha: S => S.organ_counts * prog(S.organ_grow, 0.85, 1) },
    ],
    cam: {
      default: [24, 14, 3.5, 0.08, 0, 0], face: [4, 4, 2.6, 0.3, 0.02, 0], cortex: [10, 10, 1.15, big.x, big.y, 0],
      medulla: [6, 6, 1.25, medPt[0], medPt[1], 0], whole: [-58, 16, 3.3, -0.1, 0.02, 0], open: [38, 22, 3.6, 0.15, 0.05, 0.2],
      pelvis: [0, 6, 0.62, 0, -0.07, 0.02], body: [0, 4, 3.6, 0, 0, 0],
    },
    controls: [
      { key: 'view', label: 'View', options: [['cut', 'Cut open'], ['closed', 'Closed'], ['body', 'In the body']] },
      { key: 'age', label: 'Age', options: [['20', '20'], ['30', '30'], ['40', '40'], ['50', '50'], ['60', '60'], ['70', '70']] },
      { key: 'show', label: 'Show', options: [['none', 'All'], ['follicle', 'Follicles'], ['albicans', 'Scars'], ['vessel', 'Vessels']] },
    ],
    explore(c) {
      const v = c.view || 'cut', s = c.show || 'none';
      return {
        organ_grow: v === 'body' ? 0 : 1, organ_body: v === 'body' ? 1 : 0, organ_open: v === 'cut' ? 1 : 0, organ_age: +(c.age || 30),
        organ_follicle: s === 'follicle' ? 1 : 0, organ_albicans: s === 'albicans' ? 1 : 0, organ_vessel: s === 'vessel' ? 1 : 0, organ_luteum: 0,
        organ_parts: v === 'cut' && s === 'none' ? 1 : 0, organ_agelab: v === 'body' ? 0 : 1,
      };
    },
    // the counts on the ovary at an age (what the model shows; for the engine's readouts)
    shown(age) {
      const on = (from, until) => (age >= from && age < until ? 1 : 0);
      return {
        antral: ANT.reduce((s, a) => s + on(-99, a.until), 0), growing: SEC.concat(PRI).reduce((s, a) => s + on(-99, a.until), 0),
        primordial: SPK.length ? spU.reduce((s, u) => s + on(-99, u), 0) : 0, scars: SCAR.concat(SURF).reduce((s, a) => s + on(a.from, 999), 0),
        vessels: VX.reduce((s, a) => s + on(-99, a.until), 0), luteum: on(-99, 50),
      };
    },
  });
};

// A drawn H&E section of an ovary in 3D relief (the aging ovary story): pink stroma with purple nuclei (the tour's
// tissue look; never a GTEx image), and on it the poster's four kinds of object, each a small lit body standing out of
// the section: blood vessels (a wall round a lumen), macrophages (small brown cells), corpora albicantia (large pale
// wavy scars) and follicles (a ring of granulosa cells round an oocyte; antral ones round a fluid-filled antrum), and a
// few cysts. Each kind can be picked out in the poster's color. Their counts follow the poster's trend lines for the
// section's age (OVARY_TREND.level), and a younger and an older section stand side by side. The two methods: (1) the
// section cut into tiles, every tile's features (UNI2) as a mosaic of glowing blocks, a small grove of decision trees
// (the random forest) voting, the tiles colored by their predicted label; (2) SegFormer's masks painting the objects
// (honestly imperfect where its IoU is low: the cyst's 0.15). And the illustrative spatial neighbor network of the
// objects, which changes as they do with age; the section tips back, the network rises off it and gathers into five hubs
// by kind (sized by the objects alive), its links into bands between kinds (also illustrative).
SETS.section = function (K) {
  const { THREE, smooth, clamp, prog, lerp } = K;
  const L = OVARY_LOOK, T = OVARY_TREND, C = L.C, KI = L.KI;
  L.init(K);
  const set = K.newSet('section');
  const VES = KI.vessel, MAC = KI.macrophage, ALB = KI.albicans, FOL = KI.follicle, CYS = KI.cyst;
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), ZA = new THREE.Vector3(0, 0, 1);
  const at = (x, y, z, s = [1, 1, 1], rot = 0) => M4.compose(V.set(x, y, z), Q.setFromAxisAngle(ZA, rot), SC.set(s[0], s[1], s[2])).clone();
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const tint = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  // shapes made once, placed and sized by matrix
  const SPH0 = L.sphere(1, 0), SPH1 = L.sphere(1, 1), SPH2 = L.sphere(1, 2);
  const RING = L.ring(0.62, 1, 0.5, 0.2, 22), THIN = L.ring(0.9, 1, 0.35, 0.2, 40), ZONA = L.ring(0.8, 1, 0.6, 0.1, 20);
  const THECA = new THREE.RingGeometry(0.98, 1.22, 40, 1), DISC = new THREE.CircleGeometry(1, 28), CYL = new THREE.CylinderGeometry(1, 1, 1, 6), CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
  const discEdge = (x, y) => Math.min(1, Math.hypot(x, y));

  // the stains are made between frames (idle, and in update while shown) or at once (finish)
  const JOBS = [];
  let built = false;
  function step(ms) {
    if (built) return true;
    const until = performance.now() + ms;
    while (JOBS.length) { const r = JOBS[0].next(); if (r.done) { JOBS.shift(); continue; } if (performance.now() > until) return false; }
    return (built = true);
  }

  // ------------------------------------------------------------- one section
  // o: { seed, sx, sy, waves [[k, amp, phase]], notch [angle, depth, width], counts per kind, albicans size, age (the
  // age it is drawn at when fixed), tex (stain texture size) }
  function makeSection(o) {
    const R = K.rng(o.seed), rr = (a, b) => a + (b - a) * R();
    const nz = L.noise3(o.seed + 5), nz2 = L.noise3(o.seed + 6);
    const rad = th => 0.8 * (1 + o.waves.reduce((s, [k, a, p]) => s + a * Math.sin(k * th + p), 0) - (o.notch ? o.notch[1] * Math.exp(-((((th - o.notch[0] + 3 * Math.PI) % (2 * Math.PI) - Math.PI) / o.notch[2]) ** 2)) : 0));
    // how far inside the outline (in units; negative outside)
    const inside = (x, y) => { const u = x / o.sx, v = y / o.sy, th = Math.atan2(v, u); return (rad(th) - Math.hypot(u, v)) * Math.min(o.sx, o.sy); };
    const g = new THREE.Group();
    // --- the slab: its top (the stained face), its rim and its back
    const NO = 160, OUT = [];
    for (let i = 0; i < NO; i++) { const th = i / NO * 2 * Math.PI, r = rad(th); OUT.push([r * Math.cos(th) * o.sx, r * Math.sin(th) * o.sy]); }
    const shape = new THREE.Shape(OUT.map(([x, y]) => new THREE.Vector2(x, y)));
    const top = new THREE.ShapeGeometry(shape, 1);
    const TH = 0.03, ext = 1.05;
    {
      const p = top.attributes.position, uv = top.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) / ext + 1) / 2, (p.getY(i) / ext + 1) / 2);
    }
    const side = (() => {
      const P = [], N = [], I = [];
      for (let i = 0; i <= NO; i++) {
        const [x, y] = OUT[i % NO], [x0, y0] = OUT[(i + NO - 1) % NO], [x1, y1] = OUT[(i + 1) % NO], tx = x1 - x0, ty = y1 - y0, l = Math.hypot(tx, ty) || 1;
        P.push(x, y, 0, x, y, -TH); N.push(ty / l, -tx / l, 0, ty / l, -tx / l, 0);
      }
      for (let i = 0; i < NO; i++) { const a = 2 * i; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); gg.setIndex(I);
      return gg;
    })();
    const back = top.clone(); back.translate(0, 0, -TH); back.rotateY(0); { const n = back.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0, -1); }
    // --- the stain (eosin-pink stroma in whorls, denser and more purple in the cortex under the rim, looser and paler
    // in the medulla; spindle-shaped purple nuclei, dense in the cortex): made between frames (a flat eosin until then)
    const TX = o.tex, D = new Uint8Array(TX * TX * 4);
    new Uint32Array(D.buffer).fill(0xffb496e8);   // (little-endian RGBA: e8 96 b4 ff)
    const tex = new THREE.DataTexture(D, TX, TX, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
    function* stain() {
      const RS = K.rng(o.seed + 9);
      for (let j = 0; j < TX; j++) {
        for (let i = 0; i < TX; i++) {
          const x = ((i + 0.5) / TX * 2 - 1) * ext, y = ((j + 0.5) / TX * 2 - 1) * ext, e = inside(x, y);
          if (e < -0.02) continue;
          const k = 4 * (j * TX + i);
          const cx = clamp(1 - e / (0.2 + 0.04 * nz(x * 3, y * 3, 0)), 0, 1), w = nz(x * 2.2, y * 2.2, 3);
          const fib = 0.5 + 0.5 * Math.sin((x * Math.cos(w * 2.5) + y * Math.sin(w * 2.5)) * 95 + 5 * nz2(x * 4, y * 4, 1));
          let c = mix(C.eosin2, C.eosin, 0.35 + 0.35 * fib + 0.2 * nz2(x * 9, y * 9, 2));
          c = mix(c, mix(C.eosin, C.nucleus2, 0.45), 0.55 * cx);
          if (e < 0.012) c = mix(c, C.eosin, 0.6);
          D[k] = c[0] * 255; D[k + 1] = c[1] * 255; D[k + 2] = c[2] * 255;
        }
        if ((j & 7) === 7) yield;
      }
      const NN = Math.round(TX * TX * 0.03);
      for (let n = 0; n < NN; n++) {
        const x = (RS() * 2 - 1) * ext, y = (RS() * 2 - 1) * ext, e = inside(x, y);
        if (e < 0.004) continue;
        const cx = clamp(1 - e / 0.22, 0, 1);
        if (RS() > 0.28 + 0.72 * cx) continue;
        const i0 = Math.floor((x / ext + 1) / 2 * TX), j0 = Math.floor((y / ext + 1) / 2 * TX), ang = nz(x * 1.3, y * 1.3, 7) * 4 + nz2(x * 6, y * 6, 3), len = 1 + Math.round(RS() * 2 * (0.4 + cx) * TX / 1024);
        const col = RS() < 0.7 ? C.nucleus : C.nucleus2;
        for (let st = -len; st <= len; st++) {
          const ii = i0 + Math.round(Math.cos(ang) * st), jj = j0 + Math.round(Math.sin(ang) * st);
          if (ii < 0 || jj < 0 || ii >= TX || jj >= TX) continue;
          const k = 4 * (jj * TX + ii), a = 0.75;
          D[k] = D[k] * (1 - a) + col[0] * 255 * a; D[k + 1] = D[k + 1] * (1 - a) + col[1] * 255 * a; D[k + 2] = D[k + 2] * (1 - a) + col[2] * 255 * a;
        }
        if ((n & 4095) === 4095) yield;
      }
      tex.needsUpdate = true;
    }
    JOBS.push(stain());
    const slabMat = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uMap: { value: tex }, uDim: { value: 0 }, uDark: { value: 0 }, uFade: { value: 1 } },
      transparent: true,
      vertexShader: `varying vec2 vUv; varying vec3 vN, vV, vUp;
void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: L.LIT + `
uniform sampler2D uMap; uniform float uA, uDim, uDark, uFade; varying vec2 vUv; varying vec3 vN, vV, vUp;
void main() {
  vec3 n = normalize(vN), c = texture2D(uMap, vUv).rgb;
  if (!gl_FrontFacing) n = -n;
  // (the face is lit softly: a stained section, not a shiny one)
  vec3 col = mix(litC(c, n, normalize(vV), normalize(vUp), 0.04), c, 0.45) * (1.0 - 0.45 * uDim) * (1.0 - 0.7 * uDark);
  gl_FragColor = vec4(col, uA * uFade);
}`,
    });
    const rimMat = L.objMat(set, { gloss: 0.05 });
    set.mats.push(slabMat);
    const slab = new THREE.Mesh(top, slabMat);
    // (rim and back: the eosin color, lit)
    const rimB = L.builder(); rimB.add(side, { col: tint(C.eosin, 0.85) }); rimB.add(back, { col: tint(C.eosin, 0.7) });
    const rim = new THREE.Mesh(rimB.geometry(), rimMat);
    g.add(slab, rim);

    // --- the objects (placed in slots; each kind's slots go or come with age along the poster's lines)
    const OCC = [];   // [x, y, r]
    const free = (x, y, r, gap) => OCC.every(([a, b, q]) => (x - a) * (x - a) + (y - b) * (y - b) > (r + q + gap) * (r + q + gap));
    function slots(n, rMin, rMax, eMin, eMax, gap, tries = 5000) {
      const out = [];
      for (let t = 0; t < tries && out.length < n; t++) {
        const r = rr(rMin, rMax), x = rr(-1, 1) * o.sx * 0.95, y = rr(-1, 1) * o.sy * 0.95, e = inside(x, y);
        if (e < r + eMin || e > r + eMax || !free(x, y, r, gap)) continue;
        OCC.push([x, y, r]); out.push({ x, y, r, e });
      }
      return out;
    }
    const shuffle = n => { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const falls = (list, kind) => { const ord = shuffle(list.length); list.forEach((s, i) => { s.from = -99; s.until = T.crossing(kind, (ord[i] + 0.5) / list.length, false); }); };
    const rises = (list, kind) => { const ord = shuffle(list.length); list.forEach((s, i) => { s.from = T.crossing(kind, (ord[i] + 0.5) / list.length, true); s.until = 999; }); };
    const c = o.counts;
    const CY = slots(c.cyst, 0.07, 0.11, 0.08, 0.5, 0.04); CY.forEach(s => { s.from = -99; s.until = 999; });
    const AN = slots(c.antral, 0.085, 0.12, 0.03, 0.12, 0.04); falls(AN, 'follicle');
    const AL = slots(c.albicans, o.alb[0], o.alb[1], 0.02, 0.6, 0.025); rises(AL, 'albicans');
    const SE = slots(c.secondary, 0.034, 0.046, 0.015, 0.12, 0.02); falls(SE, 'follicle');
    const PR = slots(c.primary, 0.018, 0.024, 0.01, 0.1, 0.012); falls(PR, 'follicle');
    const VE = slots(c.vessel, 0.014, 0.048, 0.06, 0.9, 0.012); falls(VE, 'vessel');
    const MA = slots(c.macrophage, 0.011, 0.016, 0.01, 0.9, 0.01, 8000); falls(MA, 'macrophage');
    // the largest antral follicle lasts longest (the one the story points at)
    if (AN.length) { AN.sort((a, b) => b.r - a.r); const last = AN.reduce((a, s) => (s.until > a.until ? s : a), AN[0]); [last.until, AN[0].until] = [AN[0].until, last.until]; }
    // where each object is and when it shows (placed now, cheap); their meshes are made between frames (objects())
    const OBJ = [];
    for (const s of VE) { const e = rr(1, 1.7); OBJ.push({ k: VES, x: s.x, y: s.y, r: s.r * e, s, e, rot: rr(0, 3.14), from: s.from, until: s.until }); }
    for (const s of MA) OBJ.push({ k: MAC, x: s.x, y: s.y, r: s.r, s, rot: rr(0, 6.283), from: s.from, until: s.until });
    for (const s of AL) OBJ.push({ k: ALB, x: s.x, y: s.y, r: s.r, s, rot: rr(0, 6.283), seed: 40 + Math.floor(R() * 5000), from: s.from, until: s.until });
    for (const [list, stage] of [[AN, 'antral'], [SE, 'secondary'], [PR, 'primary']]) for (const s of list) OBJ.push({ k: FOL, x: s.x, y: s.y, r: s.r, s, rot: rr(0, 6.283), stage, from: s.from, until: s.until });
    for (const s of CY) OBJ.push({ k: CYS, x: s.x, y: s.y, r: s.r, s, from: s.from, until: s.until });
    const age = { value: o.age || 30 };
    const objMat = L.objMat(set, { gloss: 0.2, uniforms: { uAge: age } });
    const fadeMat = L.objMat(set, { gloss: 0.05, alpha: 0.75, depthWrite: false, polygonOffset: -1, uniforms: { uAge: age } });
    const maskMat = L.maskMat(set, { fill: 0.55, uniforms: { uAge: age } });
    const ob = (q, mode = 0) => [q.from, q.until, q.k, mode];
    function* objects() {
      const RG = K.rng(o.seed + 3), B1 = L.builder(), B2 = L.builder(), F = L.builder(), MK = L.builder();
      // a ring of granulosa cells (beads), in layers from r0 to r1
      const beadRing = (B, s, r0, r1, layers, sz, obj, cen, det) => {
        for (let l = 0; l < layers; l++) {
          const rl = r0 + (r1 - r0) * (layers === 1 ? 0.5 : l / (layers - 1)), n = Math.max(6, Math.round(2 * Math.PI * rl / (sz * 2.1)));
          for (let k = 0; k < n; k++) { const a = (k + 0.5 * (l & 1)) / n * 6.283; B.add(det, { m: at(s.x + Math.cos(a) * rl, s.y + Math.sin(a) * rl, 0.004, [sz, sz * 0.85, sz * 0.7], a), col: mix(C.nucleus, C.nucleus2, RG() * 0.6), cen, obj }); }
        }
      };
      let n = 0;
      for (const q of OBJ) {
        const s = q.s, obj = ob(q), cen = [s.x, s.y, 0];
        if (q.k === VES) {
          // vessels: a wall (pink-red, with a few flat nuclei) round a pale lumen, some with red cells; cut at a slant,
          // so oval
          const sx = s.r * q.e, sy = s.r, rot = q.rot;
          B1.add(RING, { m: at(s.x, s.y, 0, [sx, sy, 0.03], rot), col: mix([0.86, 0.43, 0.52], C.eosin, RG() * 0.4), cen, obj });
          B1.add(DISC, { m: at(s.x, s.y, 0.002, [sx * 0.64, sy * 0.64, 1], rot), col: [0.93, 0.85, 0.89], cen, obj });
          const nb = 3 + Math.floor(RG() * 4), cr = Math.cos(rot), sr = Math.sin(rot);
          for (let k = 0; k < nb; k++) { const a = k / nb * 6.283 + RG(), px = Math.cos(a) * 0.8, py = Math.sin(a) * 0.8; B1.add(SPH0, { m: at(s.x + (px * sx * cr - py * sy * sr), s.y + (px * sx * sr + py * sy * cr), 0.012, [0.007, 0.004, 0.004], a + rot), col: C.nucleus, cen, obj }); }
          if (RG() < 0.45) for (let k = 0; k < 4; k++) { const a = RG() * 6.283, d = RG() * 0.4; B1.add(DISC, { m: at(s.x + Math.cos(a) * d * sx, s.y + Math.sin(a) * d * sy, 0.004, [0.006, 0.006, 1]), col: C.blood, cen, obj }); }
          MK.add(DISC, { m: at(s.x, s.y, 0.02, [sx * 1.04, sy * 1.04, 1], rot), edge: discEdge, cen, obj });
        } else if (q.k === MAC) {
          // macrophages: small rounded cells, foamy and brown with iron pigment, a dark nucleus to one side
          const a = q.rot;
          B1.add(SPH1, { m: at(s.x, s.y, 0, [s.r, s.r * (0.8 + 0.2 * RG()), s.r * 0.55], a), col: mix(C.macrophage, [0.62, 0.42, 0.3], RG() * 0.5), cen, obj });
          B1.add(SPH0, { m: at(s.x + Math.cos(a) * s.r * 0.4, s.y + Math.sin(a) * s.r * 0.4, s.r * 0.4, [s.r * 0.42, s.r * 0.36, s.r * 0.3]), col: C.nucleus, cen, obj });
          MK.add(DISC, { m: at(s.x, s.y, 0.016, [s.r * 1.25, s.r * 1.25, 1]), edge: discEdge, cen, obj });
        } else if (q.k === ALB) {
          // corpora albicantia: large pale wavy bodies of collagen, a little raised, with folds
          const bg = L.blob(s.r, 0.009, 0.006, { seed: q.seed, waves: 0.3, wrinkle: 0.14, rings: 6, segs: 40 }), nz3 = L.noise3(q.seed);
          B2.add(bg, { m: at(s.x, s.y, 0, [1, 1, 1], q.rot), col: (x, y) => mix([0.9, 0.74, 0.86], [0.8, 0.56, 0.76], clamp(0.45 + 0.7 * nz3(x * 30, y * 30, 0), 0, 1)), cen, obj });
          const mg = L.blob(s.r * 1.04, 0.0001, 0.0001, { seed: q.seed, waves: 0.32, wrinkle: 0, rings: 6, segs: 40 });
          MK.add(mg, { m: at(s.x, s.y, 0.02, [1, 1, 1], q.rot), cen, obj });
        } else if (q.k === FOL) {
          // follicles: a ring of granulosa cells round an oocyte (in its pale zona); an antral one round a
          // fluid-filled antrum, its oocyte on a mound of cells; outside, a darker theca (fading with its follicle)
          if (q.stage === 'antral') {
            B2.add(DISC, { m: at(s.x, s.y, 0.001, [s.r * 0.74, s.r * 0.74, 1]), col: C.fluid, cen, obj });
            beadRing(B2, s, s.r * 0.76, s.r * 0.97, 3, 0.0062, obj, cen, SPH1);
            const a = q.rot, mx = s.x + Math.cos(a) * s.r * 0.55, my = s.y + Math.sin(a) * s.r * 0.55;
            for (let k = 0; k < 22; k++) { const b = RG() * 6.283, d = Math.sqrt(RG()) * s.r * 0.24; B2.add(SPH0, { m: at(mx + Math.cos(b) * d, my + Math.sin(b) * d, 0.005, [0.0058, 0.005, 0.004]), col: C.nucleus, cen, obj }); }
            B2.add(SPH2, { m: at(mx, my, 0.01, [s.r * 0.16, s.r * 0.16, s.r * 0.1]), col: C.oocyte, cen, obj });
            B2.add(ZONA, { m: at(mx, my, 0.004, [s.r * 0.21, s.r * 0.21, 0.02]), col: C.zona, cen, obj });
            B2.add(SPH1, { m: at(mx + s.r * 0.03, my + s.r * 0.02, 0.014, [s.r * 0.05, s.r * 0.05, s.r * 0.03]), col: C.nucleus2, cen, obj });
          } else {
            const sec = q.stage === 'secondary', lay = sec ? 3 : 1, sz = sec ? 0.0055 : 0.0048, ro = sec ? 0.42 : 0.6;
            beadRing(B2, s, s.r * (ro + 0.08), s.r * 0.95, lay, sz, obj, cen, SPH0);
            B2.add(SPH1, { m: at(s.x, s.y, 0.004, [s.r * ro * 0.82, s.r * ro * 0.82, s.r * 0.3]), col: C.oocyte, cen, obj });
            B2.add(ZONA, { m: at(s.x, s.y, 0.002, [s.r * ro, s.r * ro, 0.02]), col: C.zona, cen, obj });
          }
          F.add(THECA, { m: at(s.x, s.y, 0.0008, [s.r, s.r, 1]), col: [0.62, 0.32, 0.5], cen, obj: [s.from, s.until, FOL, 1] });
          // (the masks of a method with IoU 0.70: a little off for the smallest)
          const off = q.stage === 'primary' ? 0.35 : 0.08;
          MK.add(DISC, { m: at(s.x + s.r * off, s.y - s.r * off * 0.5, 0.02, [s.r * 1.12, s.r * 1.12, 1]), edge: discEdge, cen, obj });
        } else {
          // cysts: thin-walled pale cavities (their masks are the method's weak point: IoU 0.15)
          B1.add(THIN, { m: at(s.x, s.y, 0, [s.r, s.r * 0.92, 0.012]), col: tint(C.eosin, 0.95), cen, obj });
          B1.add(DISC, { m: at(s.x, s.y, 0.0015, [s.r * 0.92, s.r * 0.85, 1]), col: [0.95, 0.92, 0.96], cen, obj });
          MK.add(DISC, { m: at(s.x + s.r * 0.75, s.y + s.r * 0.35, 0.02, [s.r * 0.6, s.r * 0.45, 1]), edge: discEdge, cen, obj });
        }
        if (++n % 10 === 0) yield;
      }
      const m1 = new THREE.Mesh(B1.geometry(), objMat);
      yield;
      const m2 = new THREE.Mesh(B2.geometry(), objMat);
      yield;
      const fades = new THREE.Mesh(F.geometry(), fadeMat), masks = new THREE.Mesh(MK.geometry(), maskMat);
      fades.renderOrder = 1; masks.renderOrder = 3;
      g.add(m1, m2, fades, masks);
    }
    JOBS.push(objects());
    const visAt = (s, a) => smooth((a - s.from + 1.5) / 3) * (1 - smooth((a - s.until + 1.5) / 3));
    return { g, inside, rad, OUT, OBJ, AN, AL, VE, MA, CY, SE, PR, age, slabMat, rimMat, objMat, fadeMat, maskMat, visAt, TH };
  }

  // ------------------------------------------------------------- the two sections
  // A: the section of the story (younger by default; its age is a param); B: an older ovary (66), smaller in life (its
  // scale bar is 791 µm against A's 1.58 mm), with large scars and no follicles, shown beside A
  const SA = makeSection({ seed: 811, sx: 1.12, sy: 0.9, waves: [[2, 0.07, 0.4], [3, 0.06, 1.3], [5, 0.035, 2.1], [8, 0.015, 0.2], [13, 0.008, 1]], notch: [-0.95, 0.13, 0.2], tex: 1024,
    counts: { vessel: 64, macrophage: 56, albicans: 14, antral: 3, secondary: 6, primary: 10, cyst: 2 }, alb: [0.07, 0.16] });
  const SB = makeSection({ seed: 977, sx: 1.18, sy: 0.72, waves: [[2, 0.1, 1.1], [3, 0.09, 0.2], [4, 0.05, 2.0], [7, 0.035, 1.0], [11, 0.02, 0.5], [17, 0.012, 2]], notch: [1.9, 0.1, 0.25], tex: 512, age: 66,
    counts: { vessel: 50, macrophage: 50, albicans: 24, antral: 1, secondary: 3, primary: 6, cyst: 2 }, alb: [0.12, 0.27] });
  const gA = new THREE.Group(), gB = new THREE.Group();
  gA.add(SA.g); gB.add(SB.g);
  set.group.add(gA, gB);
  // scale bars (white, at each section's upper left): 1.58 mm and 791 µm on the poster's sections, drawn to the same
  // proportion of each section's width as there (about an eighth)
  const barMat = L.objMat(set, { gloss: 0.3 });
  const bar = w => { const bb = L.builder(); bb.add(new THREE.BoxGeometry(w, 0.018, 0.012), { m: at(-0.78, 0.8, 0.02), col: [0.97, 0.97, 1] }); return new THREE.Mesh(bb.geometry(), barMat); };
  const barA = bar(0.24), barB = bar(0.22);
  barA.position.set(-0.05, -0.02, 0); barB.position.set(0.02, -0.14, 0);
  SA.g.add(barA); SB.g.add(barB);

  // ------------------------------------------------------------- method 1: tiles, features, the forest, predictions
  const TS = 0.075, TILES = [];
  for (let j = -14; j <= 14; j++) for (let i = -16; i <= 16; i++) {
    const x = (i + 0.5) * TS, y = (j + 0.5) * TS;
    if (SA.inside(x, y) < TS * 0.2) continue;
    // its label: the object under its middle (the largest it overlaps), else none (stroma)
    let lab = -1, best = 0;
    for (const ob of SA.OBJ) { const d = Math.hypot(ob.x - x, ob.y - y), ov = ob.r + TS * 0.35 - d; if (ov > 0 && ob.k !== CYS && ob.r > best && ob.until > 30) { lab = ob.k; best = ob.r; } }
    TILES.push({ x, y, lab });
  }
  // the predictions: right mostly; now and then a near miss (illustrative)
  const RT = K.rng(77);
  for (const t of TILES) { t.pred = t.lab; const u = RT(); if (t.lab >= 0 && u < 0.1) t.pred = -1; else if (t.lab < 0 && u < 0.025) t.pred = [VES, MAC][Math.floor(RT() * 2)]; }
  // the tile the story follows: a follicle's, near the section's upper left
  const tile0 = TILES.filter(t => t.lab === FOL).sort((a, b) => (a.x - a.y) - (b.x - b.y))[0] || TILES[Math.floor(TILES.length / 2)];
  const NF = 16;
  // features: 16 numbers per tile, from a prototype per label plus noise (what a foundation model's numbers might look
  // like, illustrative)
  const PROTO = [-1, VES, MAC, ALB, FOL].map((k, i) => Array.from({ length: NF }, (_, f) => clamp(0.5 + 0.45 * Math.sin(f * (1.7 + i * 0.9) + i * 2.1), 0.05, 1)));
  const protoOf = lab => PROTO[[-1, VES, MAC, ALB, FOL].indexOf(lab)];
  for (const t of TILES) { const p = protoOf(t.lab); t.f = p.map(v => clamp(v + 0.16 * K.gauss(RT), 0, 1)); t.wave = Math.hypot(t.x - tile0.x, t.y - tile0.y); }
  const maxWave = Math.max(...TILES.map(t => t.wave));
  // tile outlines, drawn on one by one from the upper left
  const tl = K.linesGeo(TILES.length * 4), tlP = tl.attributes.position.array, tlC = tl.attributes.aCol.array, tlT = tl.attributes.aT.array;
  TILES.forEach((t, k) => {
    const h = TS * 0.47, cs = [[-h, -h], [h, -h], [h, h], [-h, h]], ord = ((t.x + 1.3) - (t.y - 1.1)) / 4.6;
    for (let e = 0; e < 4; e++) { const a = cs[e], b = cs[(e + 1) % 4], q = 6 * (4 * k + e); tlP.set([t.x + a[0], t.y + a[1], 0.03, t.x + b[0], t.y + b[1], 0.03], q); tlC.set([0.55, 0.9, 1, 0.55, 0.9, 1], q); tlT[2 * (4 * k + e)] = tlT[2 * (4 * k + e) + 1] = ord; }
  });
  const tileMat = K.lines(set, { uniforms: { uGlow: { value: 0.7 } } });
  const tileLines = new THREE.LineSegments(tl, tileMat);
  SA.g.add(tileLines);
  // features: a mosaic of 4 x 4 glowing blocks on each tile, each as tall and bright as one of its numbers (the even
  // scale for numbers: indigo low, teal, green, yellow high), lighting up in a wave from the followed tile
  const NB = TILES.length * NF;
  const boxGeo = new THREE.InstancedBufferGeometry();
  {
    const P = [], N = [], I = [];
    const face = (o, u, v, n) => { const b = P.length / 3; for (const [a, c] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { P.push(o[0] + u[0] * a + v[0] * c, o[1] + u[1] * a + v[1] * c, o[2] + u[2] * a + v[2] * c); N.push(...n); } I.push(b, b + 1, b + 2, b, b + 2, b + 3); };
    face([-0.5, -0.5, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    face([-0.5, -0.5, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0]); face([0.5, 0.5, 0], [-1, 0, 0], [0, 0, 1], [0, 1, 0]);
    face([0.5, -0.5, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]); face([-0.5, 0.5, 0], [0, -1, 0], [0, 0, 1], [-1, 0, 0]);
    boxGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); boxGeo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); boxGeo.setIndex(I);
    const aB = new Float32Array(NB * 4);
    TILES.forEach((t, k) => { for (let b = 0; b < NF; b++) aB.set([t.x + ((b % 4) + 0.5 - 2) * TS * 0.22, t.y + (Math.floor(b / 4) + 0.5 - 2) * TS * 0.22, t.f[b], t.wave / maxWave + 0.02 * b], 4 * (k * NF + b)); });
    boxGeo.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4));
    boxGeo.instanceCount = NB;
    boxGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.5);
  }
  const ICE = `
vec3 ice(float v) {
  vec3 c = mix(vec3(0.3, 0.2, 0.72), vec3(0.12, 0.62, 0.78), smoothstep(0.05, 0.5, v));
  c = mix(c, vec3(0.35, 0.86, 0.45), smoothstep(0.45, 0.75, v));
  return mix(c, vec3(1.0, 0.9, 0.28), smoothstep(0.7, 1.0, v));
}`;
  const blockMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uFeat: { value: 0 }, uOut: { value: 1 } }, transparent: true,
    vertexShader: ICE + `
uniform float uFeat, uOut; attribute vec4 aB;
varying vec3 vN, vV, vC; varying float vTop;
void main() {
  float g = smoothstep(0.0, 1.0, clamp((uFeat * 1.5 - aB.w) / 0.45, 0.0, 1.0)) * uOut;
  float h = (0.002 + 0.03 * pow(aB.z, 1.5)) * g, w = ${(TS * 0.22 * 0.72).toFixed(4)};
  vec3 p = vec3(aB.x + position.x * w, aB.y + position.y * w, 0.004 + position.z * h);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = ice(aB.z) * (0.75 + 0.5 * aB.z); vTop = position.z;
  gl_Position = projectionMatrix * mv;
  if (g < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA; varying vec3 vN, vV, vC; varying float vTop;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.5, 0.6, 1.0));
  float df = max(dot(n, l), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  gl_FragColor = vec4(vC * (0.55 + 0.6 * df) * mix(0.55, 1.15, vTop) + mix(vC, vec3(1.0), 0.5) * fr * 0.25, uA);
}`,
  });
  set.mats.push(blockMat);
  const blocks = new THREE.Mesh(boxGeo, blockMat);
  blocks.frustumCulled = false;
  SA.g.add(blocks);
  // the predictions: each tile washed in its predicted label's color (stroma tiles stay clear), sweeping left to right
  const PB = L.builder(), SQ = new THREE.PlaneGeometry(1, 1);
  for (const t of TILES) if (t.pred >= 0) PB.add(SQ, { m: at(t.x, t.y, 0.034, [TS * 0.94, TS * 0.94, 1]), edge: (x, y) => Math.max(Math.abs(x), Math.abs(y)) * 2, cen: [t.x, t.y, 0], obj: [-99, 999, t.pred, 0] });
  const predMat = L.maskMat(set, { fill: 0.5, hiFill: 0 });
  const predMesh = new THREE.Mesh(PB.geometry(), predMat);
  predMesh.renderOrder = 4;
  SA.g.add(predMesh);

  // the random forest: a small grove of decision trees beside the section (5 trees, 4 questions deep), standing on a
  // dark disc; as they vote, each lights the path its questions take from the root to a leaf, the leaves in the
  // colors of the labels they stand for; most of them say "follicle", and the tile takes that label
  const GROVE = [1.58, -0.1, 0.12], NT = 5, DEPTH = 4, CLS = [-1, VES, MAC, ALB, FOL];
  const FB = L.builder(), PATH = L.builder(), RF = K.rng(5);
  const trees = [];
  for (let ti = 0; ti < NT; ti++) {
    const row = ti < 3 ? 0 : 1, col = row === 0 ? ti - 1 : ti - 3.5, base = [GROVE[0] + col * 0.3, GROVE[1] - 0.4, GROVE[2] + (row === 0 ? 0.18 : -0.14)];
    const nodes = [];
    for (let l = 0; l <= DEPTH; l++) for (let k = 0; k < 2 ** l; k++) {
      const w = 0.27, x = base[0] + ((k + 0.5) / 2 ** l - 0.5) * w * (l === 0 ? 0 : 1), y = base[1] + 0.13 + l * 0.12, z = base[2] + (l ? (RF() - 0.5) * 0.05 : 0);
      nodes.push({ l, k, p: [x, y, z] });
    }
    const idx = (l, k) => 2 ** l - 1 + k;
    // the trunk
    FB.add(new THREE.CylinderGeometry(0.008, 0.012, 0.13, 8), { m: at(base[0], base[1] + 0.065, base[2]), col: [0.55, 0.45, 0.4] });
    // its path: the questions this tile's features answer (a vote for its label, but one tree errs)
    let k = 0; const path = [0];
    for (let l = 1; l <= DEPTH; l++) { k = 2 * k + (RF() < 0.5 ? 0 : 1); path.push(idx(l, k)); }
    const vote = ti === 3 ? ALB : FOL;
    nodes.forEach((n, i) => {
      const leaf = n.l === DEPTH, cls = leaf ? (path.includes(i) ? vote : CLS[(i * 7 + ti) % 5]) : -1;
      const colr = leaf ? (cls < 0 ? [0.7, 0.72, 0.78] : L.GLOW[cls]) : [0.56, 0.58, 0.64];
      FB.add(SPH1, { m: at(...n.p, leaf ? [0.022, 0.022, 0.022] : [0.015, 0.015, 0.015]), col: colr });
      if (n.l > 0) {
        const pa = nodes[idx(n.l - 1, n.k >> 1)].p, a = new THREE.Vector3(...pa), b = new THREE.Vector3(...n.p), d = b.clone().sub(a), ln = d.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), mid = a.clone().add(b).multiplyScalar(0.5);
        FB.add(CYL, { m: new THREE.Matrix4().compose(mid, q, new THREE.Vector3(0.005, ln, 0.005)), col: [0.46, 0.48, 0.54] });
        if (path.includes(i)) PATH.add(CYL8, { m: new THREE.Matrix4().compose(mid, q, new THREE.Vector3(0.011, ln, 0.011)), col: leaf ? colr : [1, 0.86, 0.4], cen: n.p, obj: [-99, 999, -1, (ti * 0.12 + n.l * 0.11)] });
      }
      if (path.includes(i)) PATH.add(SPH1, { m: at(...n.p, [0.032, 0.032, 0.032]), col: leaf ? colr : [1, 0.86, 0.4], cen: n.p, obj: [-99, 999, -1, (ti * 0.12 + n.l * 0.11)] });
    });
    trees.push({ base, top: nodes[path[DEPTH]].p, vote });
  }
  FB.add(new THREE.CylinderGeometry(0.5, 0.5, 0.012, 48), { m: at(GROVE[0], GROVE[1] - 0.406, GROVE[2]), col: [0.16, 0.2, 0.28] });
  const groveMat = L.objMat(set, { gloss: 0.25 });
  const grove = new THREE.Mesh(FB.geometry(), groveMat);
  // the lit paths: a glow that runs up each tree in turn (aObj.w: when, in the vote's time)
  const pathMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uVote: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aCol; attribute vec4 aObj; uniform float uVote; varying vec3 vC; varying float vAl;
void main() { vAl = smoothstep(aObj.w, aObj.w + 0.06, uVote); vC = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); if (vAl < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`,
    fragmentShader: `uniform float uA; varying vec3 vC; varying float vAl; void main() { gl_FragColor = vec4(vC * 1.15, vAl * uA * 0.95); }`,
  });
  set.mats.push(pathMat);
  const paths = new THREE.Mesh(PATH.geometry(), pathMat);
  const groveG = new THREE.Group();
  groveG.add(grove, paths);
  set.group.add(groveG);
  // the features flowing from the followed tile into the trees (points along arcs), and the verdict flowing back
  const NFP = 90, fpG = K.pointsGeo(NFP), fpP = fpG.attributes.position.array, fpC = fpG.attributes.aCol.array, fpS = fpG.attributes.aSize.array;
  const fpU = new Float32Array(NFP * 4);
  for (let i = 0; i < NFP; i++) { const tr = trees[i % NT], v = tile0.f[i % NF]; fpU.set([tr.base[0], tr.base[1] + 0.12, tr.base[2], i / NFP], 4 * i); fpC.set(i % 2 ? [0.45, 0.85, 1] : [1, 0.9, 0.4], 3 * i); fpS[i] = 0.014 + 0.012 * v; fpP.set([tile0.x, tile0.y, 0.05], 3 * i); }
  fpG.setAttribute('aU', new THREE.BufferAttribute(fpU, 4));
  fpG.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.6, 0, 0), 2);
  const flowMat = K.points(set, { uniforms: { uFlow: { value: 0 } }, head: 'attribute vec4 aU; uniform float uFlow;',
    vertex: `float ph = fract(uTime * 0.35 + aU.w), on = smoothstep(0.0, 0.08, uFlow) * (1.0 - smoothstep(0.92, 1.0, uFlow));
    vec3 a = position, b = aU.xyz; vec3 q = mix(a, b, ph); q.z += sin(ph * 3.14159) * 0.35; q.y += sin(ph * 3.14159) * 0.12;
    mv = modelViewMatrix * vec4(q, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = pointPx(aSize, mv); vA *= on * smoothstep(0.0, 0.1, ph) * (1.0 - smoothstep(0.85, 1.0, ph));
    if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);` });
  const flow = new THREE.Points(fpG, flowMat);
  flow.frustumCulled = false;
  set.group.add(flow);
  // the verdict: a glowing arc from the grove back to the tile, in the voted label's color
  const verdict = (() => {
    const a = [GROVE[0], GROVE[1] + 0.28, GROVE[2] + 0.1], b = [tile0.x, tile0.y, 0.05], pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) + Math.sin(t * Math.PI) * 0.25, lerp(a[2], b[2], t) + Math.sin(t * Math.PI) * 0.3]); }
    const gg = K.tube(pts, 0.006, 60, 6, false), n = gg.attributes.position.count, aT = new Float32Array(n), uvA = gg.attributes.uv;
    for (let i = 0; i < n; i++) aT[i] = uvA.getX(i);
    gg.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
    const m = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uT: { value: 0 }, uC: { value: new THREE.Vector3(...L.GLOW[FOL]) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aT; varying float vT; void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA, uT; uniform vec3 uC; varying float vT; void main() { float a = step(vT, uT) * (0.4 + 0.6 * smoothstep(uT - 0.15, uT, vT)); if (a < 0.01) discard; gl_FragColor = vec4(uC + 0.25, a * uA); }' });
    set.mats.push(m);
    return new THREE.Mesh(gg, m);
  })();
  set.group.add(verdict);
  // the followed tile itself, ringed and then lit in its label's color as the verdict lands
  const tileHi = (() => {
    const gg = new THREE.RingGeometry(TS * 0.5, TS * 0.62, 4, 1, Math.PI / 4);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    K.fade(set, m, 1);
    const me = new THREE.Mesh(gg, m); me.position.set(tile0.x, tile0.y, 0.036);
    return me;
  })();
  SA.g.add(tileHi);

  // ------------------------------------------------------------- method 2: SegFormer's masks, swept across
  const sweepBar = (() => {
    const m = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    K.fade(set, m, 0.5);
    const me = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 1.9), m);
    return me;
  })();
  SA.g.add(sweepBar);

  // ------------------------------------------------------------- the spatial neighbor network (illustrative)
  // every object a node floating over it, objects near each other linked (each to its nearest few within reach); a
  // node shows while its object does (with the age), a link while both ends do. With section_lift the slab tips back
  // and the nodes rise off it, each to its own height; with section_kinds they fly to their kind's hub (below) and merge
  // into it, and the links, their ends with them, bundle between the hubs and give way to the bands
  const NOD = SA.OBJ.filter(o => o.k !== FOL || o.stage !== 'primary');
  const RN = K.rng(31), NG = NOD.map(o => [o.k, RN(), RN(), RN()]);   // per node: kind, when it sets off, how high it rises, where in its hub it ends
  const ng = K.pointsGeo(NOD.length), ngP = ng.attributes.position.array, ngC = ng.attributes.aCol.array, ngS = ng.attributes.aSize.array, ngW = new Float32Array(NOD.length * 3), ngG = new Float32Array(NOD.length * 4);
  const HN = 0.09;
  NOD.forEach((o, i) => { ngP.set([o.x, o.y, HN], 3 * i); ngC.set(L.GLOW[o.k], 3 * i); ngS[i] = o.k === ALB ? 0.065 : o.k === FOL ? 0.055 : o.k === CYS ? 0.05 : o.k === VES ? 0.04 : 0.032; ngW.set([o.from, o.until, Math.hypot(o.x, o.y)], 3 * i); ngG.set(NG[i], 4 * i); });
  ng.setAttribute('aW', new THREE.BufferAttribute(ngW, 3)); ng.setAttribute('aG', new THREE.BufferAttribute(ngG, 4));
  const VIS = 'float visW(float a, float b) { return smoothstep(a - 1.5, a + 1.5, uAge) * (1.0 - smoothstep(b - 1.5, b + 1.5, uAge)); }';
  // (where a node is: risen off the slab, then on an arc into its hub, a point inside it; g: how far it has gone. The
  // hubs' places come in the slab's own frame, uHub: xyz and the radius)
  const KINDP = `attribute vec4 aG; uniform float uLift, uKinds; uniform vec4 uHub[5];
vec3 kindP(vec3 p, out float g) {
  vec3 q = vec3(p.xy, p.z + uLift * (0.14 + 0.24 * aG.z));
  g = smoothstep(0.0, 1.0, clamp(uKinds * 1.6 - aG.y * 0.6, 0.0, 1.0));
  if (g <= 0.0) return q;
  vec4 H = uHub[int(aG.x + 0.5)];
  float a = aG.w * 6.2832, c = fract(aG.y * 7.31) * 2.0 - 1.0, s = sqrt(1.0 - c * c);
  vec3 h = H.xyz + vec3(cos(a) * s, sin(a) * s, c) * H.w * 0.55;
  vec3 m = mix(q, h, 0.5) + vec3(0.0, 0.0, 0.12 + 0.1 * aG.z);
  return mix(mix(q, m, g), mix(m, h, g), g);
}`;
  const HUBU = { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, LIFTU = { value: 0 }, KINDU = { value: 0 };
  const netU = () => ({ uAge: SA.age, uNet: { value: 0 }, uLift: LIFTU, uKinds: KINDU, uHub: HUBU });
  const nodeMat = K.points(set, { uniforms: netU(), head: 'attribute vec3 aW; uniform float uAge, uNet; ' + VIS + KINDP,
    vertex: `float g; vec3 q = kindP(position, g); mv = modelViewMatrix * vec4(q, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = pointPx(aSize, mv) * (1.0 - 0.45 * g);
    vA *= visW(aW.x, aW.y) * smoothstep(aW.z * 0.9, aW.z * 0.9 + 0.15, uNet * 1.35 - 0.05) * (1.0 - smoothstep(0.75, 1.0, g));` });
  const nodes = new THREE.Points(ng, nodeMat);
  nodes.frustumCulled = false;
  const LK = [];
  NOD.forEach((a, i) => {
    const near = NOD.map((b, j) => [Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r, j]).filter(([d, j]) => j !== i && d < 0.14).sort((p, q) => p[0] - q[0]).slice(0, 4);
    for (const [, j] of near) if (!LK.some(([p, q]) => (p === j && q === i) || (p === i && q === j))) LK.push([i, j]);
  });
  const lg = K.linesGeo(LK.length), lgP = lg.attributes.position.array, lgC = lg.attributes.aCol.array, lgW = new Float32Array(LK.length * 2 * 4), lgG = new Float32Array(LK.length * 2 * 4);
  LK.forEach(([i, j], k) => {
    const a = NOD[i], b = NOD[j];
    lgP.set([a.x, a.y, HN, b.x, b.y, HN], 6 * k);
    const ca = L.GLOW[a.k], cb = L.GLOW[b.k];
    lgC.set([...ca, ...cb], 6 * k);
    const w = [Math.max(a.from, b.from), Math.min(a.until, b.until), Math.max(Math.hypot(a.x, a.y), Math.hypot(b.x, b.y)), 0];
    lgW.set(w, 8 * k); lgW.set(w, 8 * k + 4); lgG.set(NG[i], 8 * k); lgG.set(NG[j], 8 * k + 4);
  });
  lg.setAttribute('aW', new THREE.BufferAttribute(lgW, 4)); lg.setAttribute('aG', new THREE.BufferAttribute(lgG, 4));
  const linkMat = K.lines(set, { uniforms: netU(), head: 'attribute vec4 aW; uniform float uAge, uNet; ' + VIS + KINDP,
    vertex: `float g; gl_Position = projectionMatrix * modelViewMatrix * vec4(kindP(position, g), 1.0);
    vA *= 0.65 * visW(aW.x, aW.y) * smoothstep(aW.z * 0.9 + 0.05, aW.z * 0.9 + 0.2, uNet * 1.35 - 0.05) * (1.0 - smoothstep(0.55, 0.92, uKinds));` });
  const links = new THREE.LineSegments(lg, linkMat);
  links.frustumCulled = false;
  // stems from each node down to its object (stretching as the nodes rise; gone as they gather)
  const sg = K.linesGeo(NOD.length), sgP = sg.attributes.position.array, sgC = sg.attributes.aCol.array, sgW = new Float32Array(NOD.length * 2 * 3), sgG = new Float32Array(NOD.length * 2 * 4);
  NOD.forEach((o, i) => { sgP.set([o.x, o.y, 0.02, o.x, o.y, HN], 6 * i); sgC.set([...L.GLOW[o.k], ...L.GLOW[o.k]], 6 * i); sgW.set([o.from, o.until, Math.hypot(o.x, o.y), o.from, o.until, Math.hypot(o.x, o.y)], 6 * i); sgG.set(NG[i], 8 * i); sgG.set(NG[i], 8 * i + 4); });
  sg.setAttribute('aW', new THREE.BufferAttribute(sgW, 3)); sg.setAttribute('aG', new THREE.BufferAttribute(sgG, 4));
  const stemMat = K.lines(set, { uniforms: netU(), head: 'attribute vec3 aW; uniform float uAge, uNet; ' + VIS + KINDP,
    vertex: `float g; vec3 q = position; if (position.z > 0.05) q = kindP(position, g); gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
    vA *= 0.3 * visW(aW.x, aW.y) * smoothstep(aW.z * 0.9, aW.z * 0.9 + 0.15, uNet * 1.35 - 0.05) * (1.0 - smoothstep(0.0, 0.3, uKinds));` });
  const stems = new THREE.LineSegments(sg, stemMat);
  stems.frustumCulled = false;
  SA.g.add(nodes, links, stems);

  // ------------------------------------------------------------- the network by kind (illustrative)
  // Five glowing hubs, one per kind, on a tilted ellipse over the tipped section (in the set's frame): a hub's size is
  // how many objects of its kind are alive at the age (its area as their number), so the follicles' hub fades by about
  // 59 and the scars' swells. Bands join the kinds: a band's width is how many drawn links join those two kinds among
  // the objects alive (a loop on a hub: links within its kind), with a slow flow along it. No numbers on them.
  const KORD = [FOL, ALB, VES, MAC, CYS];   // round the ellipse from the top, clockwise as seen
  const KC = [0, 0.62, 0], KRX = 0.84, KRY = 0.48, KTILT = 25 * Math.PI / 180;
  const ringAt = (ang, f = 1) => [KC[0] + f * KRX * Math.cos(ang), KC[1] + f * KRY * Math.sin(ang) * Math.cos(KTILT), KC[2] - f * KRY * Math.sin(ang) * Math.sin(KTILT)];
  const HANG = [], HUBP = [];
  KORD.forEach((k, i) => { HANG[k] = Math.PI / 2 - i * 2 * Math.PI / 5; HUBP[k] = ringAt(HANG[k]); });
  // how many objects of each kind are alive at an age (smoothly, as they grow and shrink), and the hubs' radii
  const kindN = a => { const n = [0, 0, 0, 0, 0]; for (const o of SA.OBJ) n[o.k] += SA.visAt(o, a); return n; };
  const NMAX = Math.max(...[20, 30, 40, 50, 60, 70].map(a => Math.max(...kindN(a))));
  const hubR = n => smooth(Math.min(1, n)) * (0.02 + 0.13 * Math.sqrt(n / NMAX));
  let hubCache = { a: -1 };
  const hubsAt = a => { if (hubCache.a !== a) { const n = kindN(a); hubCache = { a, n, r: n.map(hubR), w: pairW(a) }; } return hubCache; };
  // the bands: every pair of kinds the links join (and a kind with itself), their links' weights at an age
  const PAIRS = [], PIX = {};
  const pairOf = (i, j) => { const a = Math.min(i, j), b = Math.max(i, j), key = a * 5 + b; if (!(key in PIX)) { PIX[key] = PAIRS.length; PAIRS.push([a, b]); } return PIX[key]; };
  const LKP = LK.map(([i, j]) => pairOf(NOD[i].k, NOD[j].k));
  const pairW = a => { const w = PAIRS.map(() => 0); LK.forEach(([i, j], k) => { w[LKP[k]] += SA.visAt(NOD[i], a) * SA.visAt(NOD[j], a); }); return w; };
  let WMAX = 1;
  for (let a = 20; a <= 70; a += 2.5) WMAX = Math.max(WMAX, ...pairW(a));
  const NBD = PAIRS.length, BS = 28, BR = 7;
  const bandGeo = new THREE.BufferGeometry();
  {
    const v3s = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s], nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const PN = nrm(crs([1, 0, 0], [0, Math.cos(KTILT), -Math.sin(KTILT)]));   // (the ellipse's normal, towards you)
    const nv = NBD * (BS + 1) * BR, P = new Float32Array(nv * 3), Nr = new Float32Array(nv * 3), T = new Float32Array(nv), Bi = new Float32Array(nv), CA = new Float32Array(nv * 3), CB = new Float32Array(nv * 3), idx = [];
    let v = 0;
    PAIRS.forEach(([ka, kb], bi) => {
      const A = HUBP[ka], B = HUBP[kb], v0 = v;
      let curve;
      if (ka === kb) {
        // a loop out from the hub and back, away from the middle
        const out = nrm([A[0] - KC[0], A[1] - KC[1], A[2] - KC[2]]), side = nrm(crs(out, PN)), Lp = 0.36, Wp = 0.13;
        curve = u => v3s(v3s(v3s(A, out, Lp * Math.sin(Math.PI * u)), side, Wp * Math.sin(2 * Math.PI * u)), PN, 0.05 * Math.sin(Math.PI * u));
      } else {
        // a gentle arc bowing away from the middle and towards you (as the microanatomy story's bands)
        const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
        const out = nrm([M[0] - KC[0], M[1] - KC[1], M[2] - KC[2]]), Cp = v3s(v3s(M, out, 0.1 * len), PN, 0.08 * len);
        curve = u => { const w = 1 - u; return [0, 1, 2].map(i => w * w * A[i] + 2 * u * w * Cp[i] + u * u * B[i]); };
      }
      for (let s = 0; s <= BS; s++) {
        const u = s / BS, p = curve(u), p1 = curve(Math.min(1, u + 1e-3)), p0 = curve(Math.max(0, u - 1e-3)), t = nrm([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]);
        let n1 = crs(t, PN); if (Math.hypot(...n1) < 1e-4) n1 = [1, 0, 0]; n1 = nrm(n1);
        const n2 = nrm(crs(t, n1));
        for (let q = 0; q < BR; q++) {
          const th = q / BR * 2 * Math.PI;
          P.set(p, 3 * v); Nr.set([n1[0] * Math.cos(th) + n2[0] * Math.sin(th), n1[1] * Math.cos(th) + n2[1] * Math.sin(th), n1[2] * Math.cos(th) + n2[2] * Math.sin(th)], 3 * v);
          T[v] = u; Bi[v] = bi; CA.set(L.GLOW[ka], 3 * v); CB.set(L.GLOW[kb], 3 * v); v++;
        }
      }
      for (let s = 0; s < BS; s++) for (let q = 0; q < BR; q++) { const a0 = v0 + s * BR + q, a1 = v0 + s * BR + (q + 1) % BR; idx.push(a0, a0 + BR, a1, a1, a0 + BR, a1 + BR); }
    });
    bandGeo.setAttribute('position', new THREE.BufferAttribute(P, 3)); bandGeo.setAttribute('aNrm', new THREE.BufferAttribute(Nr, 3));
    bandGeo.setAttribute('aT', new THREE.BufferAttribute(T, 1)); bandGeo.setAttribute('aB', new THREE.BufferAttribute(Bi, 1));
    bandGeo.setAttribute('aCA', new THREE.BufferAttribute(CA, 3)); bandGeo.setAttribute('aCB', new THREE.BufferAttribute(CB, 3));
    bandGeo.setIndex(idx);
  }
  const UB = Array.from({ length: Math.max(1, NBD) }, () => new THREE.Vector4());   // x radius, y alpha, z reveal (from both ends)
  const bandMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uB: { value: UB } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aNrm, aCA, aCB; attribute float aT, aB;
uniform vec4 uB[${Math.max(1, NBD)}];
varying vec3 vN, vW, vG; varying float vT, vZ;
void main() {
  vG = mix(aCA, aCB, smoothstep(0.15, 0.85, aT));
  vec4 B = uB[int(aB + 0.5)];
  float on = step(min(aT, 1.0 - aT) * 2.0, B.z + 0.0001);
  vT = aT; vZ = B.y * on;
  vN = normalize(mat3(modelMatrix) * aNrm);
  vec4 wp = modelMatrix * vec4(position + aNrm * B.x * on, 1.0); vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  if (vZ < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA, uTime;
varying vec3 vN, vW, vG; varying float vT, vZ;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float c = abs(dot(n, v));
  float flow = 0.75 + 0.5 * pow(0.5 + 0.5 * sin(vT * 16.0 - uTime * 1.6), 3.0);   // a slow flow along the band
  vec3 col = mix(vG, vec3(1.0), 0.12) * (0.35 + 0.75 * c) * flow + vec3(1.0) * 0.15 * pow(c, 8.0);
  gl_FragColor = vec4(col, (0.22 + 0.7 * c * c) * vZ * uA);
}`,
  });
  set.mats.push(bandMat);
  const bands = new THREE.Mesh(bandGeo, bandMat);
  bands.frustumCulled = false; bands.renderOrder = 6;
  // the hubs: lit spheres in the kinds' glowing colors (instances: place and radius per frame), each in a soft halo
  const hubGeo = new THREE.InstancedBufferGeometry();
  { const s = new THREE.IcosahedronGeometry(1, 3); hubGeo.setIndex(s.index); hubGeo.setAttribute('position', s.attributes.position); hubGeo.setAttribute('normal', s.attributes.normal); }
  const hubH = new THREE.InstancedBufferAttribute(new Float32Array(20), 4), hubCol = new THREE.InstancedBufferAttribute(new Float32Array(15), 3);
  hubH.setUsage(THREE.DynamicDrawUsage);
  for (let k = 0; k < 5; k++) hubCol.setXYZ(k, ...L.GLOW[k]);
  hubGeo.setAttribute('aH', hubH); hubGeo.setAttribute('aCol', hubCol); hubGeo.instanceCount = 5;
  const hubMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uOn: { value: 0 } }, transparent: true,
    vertexShader: `
attribute vec4 aH; attribute vec3 aCol;
varying vec3 vC, vN, vV;
void main() {
  vC = aCol;
  vec4 mv = modelViewMatrix * vec4(aH.xyz + position * aH.w, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (aH.w < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA, uOn;
varying vec3 vC, vN, vV;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.45, 0.6, 0.65));
  float df = max(dot(n, l), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 2.2), sp = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);
  vec3 c0 = mix(vC, vec3(1.0), 0.12), col = c0 * (0.5 + 0.6 * df) + c0 * 0.25 + mix(vC, vec3(1.0), 0.5) * fr * 0.7 + vec3(sp * 0.3);
  gl_FragColor = vec4(col, uA * uOn);
}`,
  });
  set.mats.push(hubMat);
  const hubs = new THREE.Mesh(hubGeo, hubMat);
  hubs.frustumCulled = false; hubs.renderOrder = 5;
  const haloGeo = new THREE.InstancedBufferGeometry();
  haloGeo.setIndex([0, 1, 2, 0, 2, 3]);
  haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  haloGeo.setAttribute('aH', hubH); haloGeo.setAttribute('aCol', hubCol); haloGeo.instanceCount = 5;
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uOn: { value: 0 }, uTime: K.U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec4 aH; attribute vec3 aCol;
varying vec3 vC; varying vec2 vQ;
void main() {
  vC = aCol; vQ = position.xy;
  vec4 mv = modelViewMatrix * vec4(aH.xyz, 1.0);
  mv.xy += position.xy * 3.0 * aH.w * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
  if (aH.w < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA, uOn, uTime;
varying vec3 vC; varying vec2 vQ;
void main() {
  float d = length(vQ);
  if (d > 1.0) discard;
  float rr = d * 3.0, glow = exp(-max(rr - 0.95, 0.0) * 1.8) * smoothstep(1.0, 0.5, d) * (0.9 + 0.1 * sin(uTime * 1.3));
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.15) * glow * 0.9, uA * uOn * glow * 0.75);
}`,
  });
  set.mats.push(haloMat);
  const halos = new THREE.Mesh(haloGeo, haloMat);
  halos.frustumCulled = false; halos.renderOrder = 7;
  const kindsG = new THREE.Group();
  kindsG.add(hubs, bands, halos);
  set.group.add(kindsG);

  // ------------------------------------------------------------- anchors
  const tmp = new THREE.Vector3();
  const inA = p => { tmp.set(p[0], p[1], p[2]); gA.updateMatrix(); tmp.applyMatrix4(gA.matrix); return [tmp.x, tmp.y, tmp.z]; };
  const inB = p => { tmp.set(p[0], p[1], p[2]); gB.updateMatrix(); tmp.applyMatrix4(gB.matrix); return [tmp.x, tmp.y, tmp.z]; };
  // a representative of each kind: one shown from 20 to 45 at least (the largest, near the middle)
  const rep = k => { const L0 = SA.OBJ.filter(o => o.k === k && o.from < 25 && o.until > 45); const pool = L0.length ? L0 : SA.OBJ.filter(o => o.k === k); return pool.sort((a, b) => (b.r - 0.2 * Math.hypot(b.x, b.y)) - (a.r - 0.2 * Math.hypot(a.x, a.y)))[0]; };
  const REP = { vessel: rep(VES), macrophage: rep(MAC), albicans: SA.AL.reduce((a, s) => (s.from < a.from ? s : a), SA.AL[0]), follicle: SA.AN[0], cyst: rep(CYS) };
  const topOf = (S, gfn) => { let y = -9, x = 0; for (const [px, py] of S.OUT) if (py > y) { y = py; x = px; } return () => gfn([x, y + 0.04, 0.02]); };
  let sweepX = -2, ageNow = 30, kindsNow = 0;
  // a hub's upper right rim, where its name goes (at its size now)
  const hubRim = k => { const r = hubsAt(ageNow).r[k] * prog(kindsNow, 0.35, 0.8), p = HUBP[k]; return [p[0] + 0.72 * r + 0.01, p[1] + 0.72 * r + 0.01, p[2] + 0.3 * r]; };
  const anchors = {
    vessel: () => inA([REP.vessel.x, REP.vessel.y, 0.02]), macrophage: () => inA([REP.macrophage.x, REP.macrophage.y, 0.02]),
    albicans: () => inA([REP.albicans.x, REP.albicans.y, 0.02]), follicle: () => inA([REP.follicle.x, REP.follicle.y, 0.02]),
    cyst: () => inA([REP.cyst.x, REP.cyst.y, 0.02]), center: () => inA([0, 0, 0.02]),
    young: topOf(SA, inA), old: topOf(SB, inB),
    barYoung: () => inA([-0.83 + 0.0, 0.8 - 0.02 + 0.03, 0.03]), barOld: () => inB([-0.76 + 0.0, 0.8 - 0.14 + 0.03, 0.03]),
    tiles: () => inA([-0.55, 0.62, 0.04]), tile: () => inA([tile0.x, tile0.y, 0.05]), feat: () => inA([tile0.x, tile0.y + TS * 0.6, 0.05]),
    forest: [GROVE[0], GROVE[1] + 0.32, GROVE[2]], uni: () => { const a = inA([tile0.x, tile0.y, 0.05]); return [lerp(a[0], GROVE[0], 0.5), lerp(a[1], GROVE[1], 0.5) + 0.22, 0.3]; },
    pred: () => inA([0.3, -0.35, 0.05]), mask: () => inA([clamp(sweepX, -1, 1), 0.72, 0.05]),
    net: () => inA([0.0, 0.62, HN + 0.02]),
    kinds: KC.slice(), kindsLabel: [-1.0, KC[1] + 0.66, KC[2] - 0.1],
  };
  for (const k of [VES, MAC, ALB, FOL, CYS]) anchors['hub_' + OVARY_DATA.kinds[k].key] = () => hubRim(k);

  // ------------------------------------------------------------- update
  const hi = [0, 0, 0, 0, 0, 0], TIP = 70 * Math.PI / 180, invA = new THREE.Matrix4(), hv = new THREE.Vector3();
  function update(S, t, dt) {
    if (!built) step(4);
    const age = clamp(S.section_age, 20, 70), pair = smooth(clamp(S.section_pair, 0, 1));
    ageNow = age; SA.age.value = age;
    // the pair: A shrinks to the left, B comes in on the right (both at 0.58 of A's size)
    const sc = 1 - 0.42 * pair;
    // the lift: the slab tips back like a tabletop (and sinks a little, so the hubs above it stay in view)
    const lift = smooth(clamp(S.section_lift || 0, 0, 1)), kinds = clamp(S.section_kinds || 0, 0, 1);
    kindsNow = kinds;
    gA.position.set(-0.6 * pair, -0.5 * lift, -0.05 * lift); gA.scale.setScalar(sc); gA.rotation.x = -TIP * lift;
    gB.position.set(0.62 * pair + 0.5 * (1 - pair), 0, 0); gB.scale.setScalar(0.58);
    gB.visible = pair > 0.01;
    for (const m of [SB.slabMat, SB.objMat, SB.fadeMat, SB.rimMat]) m.uniforms.uFade.value = (m === SB.fadeMat ? 0.75 : 1) * prog(pair, 0, 0.6);
    SB.maskMat.uniforms.uGrow.value = prog(pair, 0.5, 1);
    barA.visible = barB.visible = pair > 0.3;
    // picked out
    hi[VES] = clamp(S.section_vessel, 0, 1); hi[MAC] = clamp(S.section_macrophage, 0, 1); hi[ALB] = clamp(S.section_albicans, 0, 1); hi[FOL] = clamp(S.section_follicle, 0, 1); hi[CYS] = clamp(S.section_cyst, 0, 1);
    const pick = Math.max(...hi);
    // method 1
    const tiles = clamp(S.section_tiles, 0, 1), feat = clamp(S.section_feat, 0, 1), forest = clamp(S.section_forest, 0, 1), pred = clamp(S.section_pred, 0, 1);
    const mask = clamp(S.section_mask, 0, 1), net = clamp(S.section_net, 0, 1);
    const dark = 0.65 * prog(feat, 0, 0.3) * (1 - prog(pred, 0, 0.4)) + 0.35 * prog(net, 0, 0.4) + 0.25 * prog(kinds, 0.1, 0.6);
    for (const Sx of [SA, SB]) {
      L.setHi(Sx.objMat, hi, 0.5 * pick + 0.6 * dark); L.setHi(Sx.fadeMat, hi, 0.5 * pick + 0.6 * dark); L.setHi(Sx.maskMat, hi);
      Sx.slabMat.uniforms.uDim.value = pick; Sx.slabMat.uniforms.uDark.value = Sx === SA ? dark : 0;
      Sx.maskMat.uniforms.uMask.value = Sx === SA ? (mask > 0 ? 1 : 0) : 0;
    }
    sweepX = lerp(-1.25, 1.3, mask);
    SA.maskMat.uniforms.uSweep.value = sweepX;
    sweepBar.position.set(sweepX, 0, 0.05); sweepBar.visible = mask > 0.001 && mask < 0.999;
    tileMat.uniforms.uReveal.value = tiles * 1.05; tileLines.visible = tiles > 0.001;
    tileMat.uniforms.uGlow.value = 1;
    blockMat.uniforms.uFeat.value = feat; blockMat.uniforms.uOut.value = 1 - prog(pred, 0.3, 0.9); blocks.visible = feat > 0.001 && pred < 0.95;
    // the forest: in, then the features flow to it (0.1 to 0.45), the trees answer in turn (0.35 to 0.85), the verdict
    // flies back (0.8 to 0.95)
    groveG.visible = forest > 0.001;
    groveMat.uniforms.uFade.value = prog(forest, 0, 0.12);
    groveG.position.set(0, 0, 0); groveG.scale.setScalar(0.85 + 0.15 * smooth(forest / 0.12));
    flowMat.uniforms.uFlow.value = clamp((forest - 0.08) / 0.4, 0, 1); flow.visible = forest > 0.08 && forest < 0.5;
    pathMat.uniforms.uVote.value = (forest - 0.35) / 0.5 * 0.94;
    verdict.material.uniforms.uT.value = clamp((forest - 0.8) / 0.15, 0, 1); verdict.visible = forest > 0.8;
    tileHi.visible = (forest > 0.05 || feat > 0.05) && pred < 0.6;
    tileHi.material.color.setRGB(...(forest > 0.95 ? L.GLOW[FOL] : [1, 1, 1]));
    predMat.uniforms.uMask.value = pred > 0 ? 1 : 0; predMat.uniforms.uSweep.value = lerp(-1.25, 1.3, pred);
    // the network
    nodeMat.uniforms.uNet.value = linkMat.uniforms.uNet.value = stemMat.uniforms.uNet.value = net;
    nodes.visible = links.visible = stems.visible = net > 0.001;
    stems.visible = net > 0.001 && kinds < 0.3; links.visible = net > 0.001 && kinds < 0.93; nodes.visible = net > 0.001 && kinds < 0.999;
    // by kind: the hubs (their places in the slab's frame for the nodes flying in), their sizes and the bands' widths
    LIFTU.value = lift; KINDU.value = kinds;
    kindsG.visible = net > 0.001 && kinds > 0.001;
    if (net > 0.001 && kinds > 0.001) {
      gA.updateMatrix(); invA.copy(gA.matrix).invert();
      const H = hubsAt(age), on = prog(kinds, 0.35, 0.8);
      for (let k = 0; k < 5; k++) {
        hv.set(HUBP[k][0], HUBP[k][1], HUBP[k][2]).applyMatrix4(invA);
        HUBU.value[k].set(hv.x, hv.y, hv.z, H.r[k] / sc);
        hubH.setXYZW(k, HUBP[k][0], HUBP[k][1], HUBP[k][2], H.r[k] * on * (1 + 0.025 * Math.sin(t * 1.3 + k * 1.7)));
      }
      hubH.needsUpdate = true;
      hubMat.uniforms.uOn.value = haloMat.uniforms.uOn.value = prog(kinds, 0.3, 0.55);
      const rev = prog(kinds, 0.4, 0.9), ba = prog(kinds, 0.45, 0.85);
      PAIRS.forEach((p, i) => { const w = H.w[i], pres = smooth(Math.min(1, w)); UB[i].set(pres * (0.004 + 0.026 * Math.sqrt(w / WMAX)), ba * pres, rev, 0); });
    }
  }

  // ------------------------------------------------------------- picking (explore): the object under a ray
  // (hitAt: where the last pick met the section, in the set's own frame, for the headset's ray and tip; null on a miss)
  const plane = new THREE.Plane(), hit = new THREE.Vector3(), inv = new THREE.Matrix4(), hw = new THREE.Vector3();
  let hitAt = null;
  const hubW = new THREE.Vector3(), hubS = new THREE.Sphere(), hubHit = new THREE.Vector3();
  function pick(raycaster) {
    hitAt = null;
    // by kind: a hub under the ray (the nearest), else the section under it
    if (kindsG.visible && kindsNow > 0.5) {
      set.group.updateMatrixWorld(true);
      const sw = new THREE.Vector3().setFromMatrixScale(set.group.matrixWorld).x, H = hubsAt(ageNow);
      let kb = -1, db = 1e9;
      for (let k = 0; k < 5; k++) {
        if (H.r[k] < 0.01) continue;
        hubS.set(hubW.set(HUBP[k][0], HUBP[k][1], HUBP[k][2]).applyMatrix4(set.group.matrixWorld), H.r[k] * sw * 1.15);
        if (!raycaster.ray.intersectSphere(hubS, hubHit)) continue;
        const d = hubHit.distanceTo(raycaster.ray.origin);
        if (d < db) { db = d; kb = k; }
      }
      if (kb >= 0) { hitAt = HUBP[kb].slice(); return kb; }
    }
    SA.g.updateMatrixWorld(true);
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1).transformDirection(SA.g.matrixWorld), new THREE.Vector3().setFromMatrixPosition(SA.g.matrixWorld));
    if (!raycaster.ray.intersectPlane(plane, hit)) return -1;
    set.group.worldToLocal(hw.copy(hit));
    hit.applyMatrix4(inv.copy(SA.g.matrixWorld).invert());
    let best = -1, bd = 1e9;
    for (const o of SA.OBJ) { if (SA.visAt(o, ageNow) < 0.5) continue; const d = Math.hypot(o.x - hit.x, o.y - hit.y) - o.r; if (d < 0.015 && d < bd) { bd = d; best = o.k; } }
    if (best >= 0) hitAt = [hw.x, hw.y, hw.z];
    return best;
  }
  const count = (S, a) => { const n = [0, 0, 0, 0, 0]; for (const o of S.OBJ) if (S.visAt(o, a) > 0.5) n[o.k]++; return n; };

  const VIEWS = ['section', 'pair', 'tiles', 'features', 'forest', 'predicted', 'masks', 'network', 'kinds'];
  const NAMES = OVARY_DATA.kinds.map(k => k.plural.charAt(0).toUpperCase() + k.plural.slice(1)), KCLS = ['cyn', 'grn', 'mag', 'amb', ''];
  return Object.assign(set, {
    params: { section_a: 1, section_age: 30, section_pair: 0, section_vessel: 0, section_macrophage: 0, section_albicans: 0, section_follicle: 0, section_cyst: 0,
      section_tiles: 0, section_feat: 0, section_forest: 0, section_pred: 0, section_mask: 0, section_net: 0, section_lift: 0, section_kinds: 0, section_names: 0 },
    update,
    idle() { step(3); },
    finish() { step(Infinity); },
    built: () => built,
    anchors,
    labels: [
      { text: ['Younger ovary', ''], at: 'young', cls: 'cyn', alpha: S => prog(S.section_pair, 0.6, 1) },
      { text: ['Older ovary', ''], at: 'old', cls: 'mag', alpha: S => prog(S.section_pair, 0.6, 1) },
      { text: ['1.58 mm', ''], at: 'barYoung', cls: '', alpha: S => prog(S.section_pair, 0.7, 1) },
      { text: ['791 µm', ''], at: 'barOld', cls: '', alpha: S => prog(S.section_pair, 0.7, 1) },
      { text: ['Tiles', ''], at: 'tiles', cls: 'cyn', alpha: S => prog(S.section_tiles, 0.2, 0.5) * (1 - prog(S.section_feat, 0.05, 0.3)) },
      { text: ['Features', 'UNI2: numbers per tile'], at: 'feat', cls: 'cyn', alpha: S => prog(S.section_feat, 0.4, 0.7) * (1 - prog(S.section_forest, 0.05, 0.2)) },
      { text: ['Random forest', 'trees vote on each tile'], at: 'forest', cls: 'amb', alpha: S => prog(S.section_forest, 0.1, 0.3) * (1 - prog(S.section_pred, 0.5, 0.9)) },
      { text: ['SegFormer', 'paints a mask'], at: 'mask', cls: 'grn', alpha: S => prog(S.section_mask, 0.02, 0.1) * (1 - prog(S.section_mask, 0.9, 1)) },
      { text: ['Spatial neighbor network', 'illustrative'], at: 'net', cls: 'mag', alpha: S => prog(S.section_net, 0.5, 0.9) * (1 - prog(S.section_kinds || 0, 0.15, 0.3)) },
      { text: ['Neighbor network by kind', 'illustrative'], at: 'kindsLabel', cls: 'mag', alpha: S => prog(S.section_net, 0.3, 0.6) * prog(S.section_kinds || 0, 0.3, 0.45) },
      // (the hubs' names: only where section_names asks for them, as explore's By kind view does)
      ...[VES, MAC, ALB, FOL, CYS].map(k => ({ text: [NAMES[k], ''], at: 'hub_' + OVARY_DATA.kinds[k].key, cls: KCLS[k],
        alpha: S => prog(S.section_names || 0, 0.3, 1) * prog(S.section_kinds || 0, 0.55, 0.85) * prog(S.section_net, 0.3, 0.6) * smooth(Math.min(1, hubsAt(clamp(S.section_age, 20, 70)).n[k] * 1.5 - 0.3)) })),
    ],
    cam: {
      default: [0, 8, 3.5, 0, 0, 0], close: [10, 16, 0.85, REP.follicle.x, REP.follicle.y, 0], pair: [0, 6, 3.4, 0, 0, 0],
      tiles: [0, 22, 3.0, 0, 0, 0], feat: [16, 38, 1.0, tile0.x, tile0.y, 0], forest: [-16, 10, 4.6, 0.5, 0, 0],
      mask: [0, 10, 3.3, 0, 0, 0], net: [8, 32, 3.1, 0, 0.02, 0], kinds: [0, 12, 4.4, 0, 0.24, 0],
    },
    controls: [
      { key: 'view', label: 'View', options: [['section', 'Section'], ['pair', 'Young and old'], ['tiles', 'Tiles'], ['forest', 'Forest'], ['masks', 'Masks'], ['network', 'Network'], ['kinds', 'By kind']] },
      { key: 'age', label: 'Age', options: [['20', '20'], ['30', '30'], ['40', '40'], ['50', '50'], ['60', '60'], ['70', '70']] },
      { key: 'show', label: 'Pick out', options: [['none', 'None'], ['vessel', 'Vessels'], ['macrophage', 'Macrophages'], ['albicans', 'Scars'], ['follicle', 'Follicles'], ['cyst', 'Cysts']] },
    ],
    explore(c) {
      const v = c.view || 'section', s = c.show || 'none', tt = c.t || 0;
      const out = { section_age: +(c.age || 30), section_pair: v === 'pair' ? 1 : 0, section_tiles: 0, section_feat: 0, section_forest: 0, section_pred: 0, section_mask: 0, section_net: 0,
        section_lift: 0, section_kinds: 0, section_names: 0 };
      for (const k of ['vessel', 'macrophage', 'albicans', 'follicle', 'cyst']) out['section_' + k] = s === k ? 1 : 0;
      if (v === 'tiles') { out.section_tiles = 1; out.section_feat = 1; }
      if (v === 'forest') { out.section_tiles = 1; out.section_feat = 1; out.section_forest = clamp(tt / 8, 0, 1); out.section_pred = clamp((tt - 8) / 4, 0, 1); }
      if (v === 'masks') out.section_mask = clamp(tt / 5, 0, 1);
      if (v === 'network') out.section_net = 1;
      if (v === 'kinds') Object.assign(out, { section_net: 1, section_lift: 1, section_kinds: 1, section_names: 1 });
      return out;
    },
    api() {
      return {
        kinds: OVARY_DATA.kinds.map(k => k.key), pick, hitAt: () => hitAt, views: VIEWS,
        // what the section shows at an age (objects per kind, by OVARY_DATA.kinds' index), A or B
        count: (a, which) => count(which === 'B' ? SB : SA, a),
        objects: SA.OBJ.map(o => ({ kind: o.k, x: o.x, y: o.y, r: o.r, from: o.from, until: o.until })),
        tiles: TILES.length, links: LK.length,
        // the network by kind at an age (illustrative): objects alive per kind, and per pair of kinds [kind, kind, how
        // many drawn links join them among the objects alive] (by OVARY_DATA.kinds' index)
        byKind: a => { const H = hubsAt(clamp(a, 20, 70)); return { count: H.n.map(n => Math.round(n)), links: PAIRS.map((p, i) => [p[0], p[1], Math.round(H.w[i])]) }; },
        // the hubs as drawn now (set frame): kind index, centre, radius (0 while they are not shown)
        hubs: () => [0, 1, 2, 3, 4].map(k => ({ kind: k, p: HUBP[k].slice(), r: kindsG.visible ? hubsAt(ageNow).r[k] * prog(kindsNow, 0.35, 0.8) : 0 })),
      };
    },
  });
};

// The donors in 3D (the aging ovary story): 255 glass slides (drawn) that gather into a fan and then stack up into the
// donors' age histogram (one slide per donor, the poster's 20 bars). The story's one graph, and it goes by in passing:
// the trends, the comparisons and the scores are told on the ovary and the section instead (the owner's rule against 2D
// graphs). The donors' ages are OVARY_DATA.cohort.age (whole years filling the poster's bars).
SETS.charts = function (K) {
  const { THREE, clamp, prog } = K;
  const L = OVARY_LOOK, D = OVARY_DATA;
  L.init(K);
  const set = K.newSet('charts');
  const ink = '#e7eef8', muted = '#95a6bd', FONT = 'Inter, "Segoe UI", Arial, sans-serif';
  // a canvas texture drawn once (text and gridlines that belong to a chart)
  function canvasTex(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); draw(ctx, w, h);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  // a plane showing a texture; its opacity is the set's fade times its own (set in update)
  function plate(tex, w, h) {
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    me.renderOrder = 1;
    return me;
  }
  const fadeTo = (me, a) => { me.material.opacity = a * set.uA.value; me.visible = a > 0.003; };

  // ------------------------------------------------------------- the slides and the histogram
  const H = D.hist, NBAR = H.counts.length, HX0 = -0.95, HW = 1.9, HY0 = -0.42, DY = 0.026;
  const ageX = a => HX0 + (a - 20) / 50 * HW;
  // each donor's slide: its bar (by its age) and its place in the bar's stack
  const AGES = D.cohort.age, N = AGES.length;
  const barOf = a => clamp(Math.floor((a - H.from) / H.width), 0, NBAR - 1);
  // (the poster's bars hold its counts: donors fill them in age order)
  const order = AGES.map((a, i) => i).sort((i, j) => AGES[i] - AGES[j] || i - j);
  const SLOT = new Array(N);
  { let k = 0, n = 0; for (const i of order) { while (n >= H.counts[k]) { k++; n = 0; } SLOT[i] = [k, n++]; } }
  const SL = 0.085, SWD = 0.028, STH = 0.0042;
  const slideAttrs = (() => {
    const aF = new Float32Array(N * 4), aHh = new Float32Array(N * 4), R = K.rng(17);
    order.forEach((i, r) => {
      const ring = r % 3, k = Math.floor(r / 3), nk = Math.ceil(N / 3), th = (-75 + 150 * (k + 0.5) / nk) * Math.PI / 180;
      aF.set([th, 0.52 + 0.17 * ring, -0.06 * ring, R()], 4 * i);
      const [b, n] = SLOT[i];
      aHh.set([HX0 + (H.from + H.width * (b + 0.5) - 20) / 50 * HW, HY0 + (n + 0.5) * DY, R(), AGES[i]], 4 * i);
    });
    return { aF: new THREE.InstancedBufferAttribute(aF, 4), aH: new THREE.InstancedBufferAttribute(aHh, 4) };
  })();
  const SLIDE_GL = `
uniform float uIn, uHist; attribute vec4 aF, aH;
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
// the slide's pose: in the fan (standing, along its radius) or in the histogram (lying in its bar's stack)
vec3 slidePos(vec3 p, out mat3 R, out float al) {
  float sIn = smoothstep(0.0, 1.0, clamp((uIn * 1.6 - aF.w * 0.6), 0.0, 1.0));
  float sH = smoothstep(0.0, 1.0, clamp((uHist * 1.5 - (aH.w - 20.0) / 50.0 * 0.5), 0.0, 1.0));
  vec3 fan = vec3(0.0, -0.62, 0.0) + vec3(-sin(aF.x), cos(aF.x), 0.0) * aF.y + vec3(0.0, 0.0, aF.z);
  fan += vec3(0.0, -0.7, 0.5) * (1.0 - sIn);
  vec3 hist = vec3(aH.x, aH.y, 0.0);
  R = rotZ(mix(aF.x + 1.5708, 0.0, sH)) * rotX(mix(0.0, -1.5708, sH));
  al = sIn;
  return mix(fan, hist, sH) + vec3(0.0, sin(sH * 3.14159) * 0.22, sin(sH * 3.14159) * 0.25) + R * p;
}`;
  function slidePart(geo, frag, opts) {
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex(geo.index); g.setAttribute('position', geo.attributes.position); g.setAttribute('normal', geo.attributes.normal);
    g.setAttribute('aF', slideAttrs.aF); g.setAttribute('aH', slideAttrs.aH);
    g.instanceCount = N;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uIn: { value: 0 }, uHist: { value: 0 } }, transparent: true, depthWrite: !!opts.depth, side: opts.side || THREE.FrontSide,
      vertexShader: SLIDE_GL + `
varying vec3 vN, vV, vL; varying float vAl, vR;
void main() {
  mat3 R; float al;
  vec3 p = slidePos(${opts.local}, R, al);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * (R * normal)); vV = -mv.xyz; vL = position; vAl = al; vR = aH.z;
  gl_Position = projectionMatrix * mv;
  if (al < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `uniform float uA; varying vec3 vN, vV, vL; varying float vAl, vR;
void main() { vec3 n = normalize(vN), v = normalize(vV); if (!gl_FrontFacing) n = -n; float df = max(dot(n, normalize(vec3(-0.5, 0.6, 1.0))), 0.0), fr = pow(1.0 - abs(dot(n, v)), 2.0);
${frag}
}`,
    });
    set.mats.push(m);
    const me = new THREE.Mesh(g, m); me.frustumCulled = false;
    return me;
  }
  // glass (see-through, bright at its edges), the tissue on it (pink and purple), the frosted label at one end
  const glass = slidePart(new THREE.BoxGeometry(1, 1, 1), `float e = max(max(abs(vL.x), abs(vL.y)), abs(vL.z)) * 2.0; float edge = smoothstep(0.86, 1.0, max(abs(vL.x) * 2.0 * step(0.45, abs(vL.y) * 2.0 + 0.5), abs(vL.y) * 2.0));
  gl_FragColor = vec4(vec3(0.72, 0.88, 1.0) * (0.45 + 0.5 * df) + fr * 0.3 + edge * 0.25, (0.22 + 0.35 * fr + 0.3 * edge) * vAl * uA);`, { local: `vec3(position.x * ${SL}, position.y * ${SWD}, position.z * ${STH})` });
  const tissueGeo = new THREE.CircleGeometry(1, 20);
  const tissue = slidePart(tissueGeo, `float w = 0.5 + 0.5 * sin(vL.x * 9.0 + vR * 20.0) * cos(vL.y * 7.0 - vR * 11.0);
  vec3 c = mix(vec3(0.91, 0.55, 0.69), vec3(0.6, 0.45, 0.78), 0.25 + 0.4 * w * vR);
  gl_FragColor = vec4(c * (0.55 + 0.55 * df), vAl * uA);`, { depth: true, side: THREE.DoubleSide, local: `vec3(-0.012 + position.x * (0.02 + 0.006 * aH.z), position.y * (0.0095 + 0.003 * aH.z), ${(STH / 2 + 0.0006).toFixed(4)})` });
  const label = slidePart(new THREE.BoxGeometry(1, 1, 1), `gl_FragColor = vec4(vec3(0.95, 0.96, 0.98) * (0.6 + 0.45 * df), 0.95 * vAl * uA);`, { depth: true, local: `vec3(0.0305 + position.x * 0.022, position.y * ${SWD * 0.98}, position.z * ${STH * 1.25})` });
  const slides = new THREE.Group();
  slides.add(glass, tissue, label);
  glass.renderOrder = 2;
  // the histogram's backdrop: gridlines and ticks (age along the bottom, donors up the side)
  const HB = new THREE.Group();
  // (the plate reaches 0.22 left of the bars for the counts, 0.06 right of them)
  const HPW = HW + 0.28, HPX = HX0 - 0.22;
  const histTex = canvasTex(1024, 512, (c, w, h) => {
    const x = a => (ageX(a) - HPX) / HPW * w, y = n => h - ((HY0 + n * DY) - (HY0 - 0.08)) / 0.8 * h;
    c.strokeStyle = 'rgba(149,166,189,0.28)'; c.lineWidth = 2; c.fillStyle = muted; c.font = `28px ${FONT}`; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const n of [0, 5, 10, 15, 20, 25]) { c.beginPath(); c.moveTo(x(20), y(n)); c.lineTo(x(70), y(n)); c.stroke(); c.fillText(String(n), x(20) - 10, y(n)); }
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (const a of [20, 30, 40, 50, 60, 70]) { c.fillText(String(a), x(a), y(0) + 10); }
    c.fillStyle = ink; c.font = `600 26px ${FONT}`; c.fillText('Age (years)', x(45), y(0) + 46);
    c.save(); c.translate(x(20) - 70, y(12.5)); c.rotate(-Math.PI / 2); c.fillText('Donors', 0, 0); c.restore();
  });
  const histPlate = plate(histTex, HPW, 0.8);
  histPlate.position.set(HPX + HPW / 2, HY0 - 0.08 + 0.4, -0.06);
  HB.add(histPlate);

  set.group.add(slides, HB);

  // ------------------------------------------------------------- anchors
  const anchors = {
    hist: [0, HY0 + 0.75, 0], histTop: [ageX(H.from + H.width * 18.5), HY0 + 25 * DY + 0.05, 0], fan: [0, 0.38, 0.05], slides: [0, -0.1, 0.1],
  };

  // ------------------------------------------------------------- update
  function update(S) {
    const sl = clamp(S.charts_slides, 0, 1), hs = clamp(S.charts_hist, 0, 1);
    for (const me of [glass, tissue, label]) { me.material.uniforms.uIn.value = sl; me.material.uniforms.uHist.value = hs; }
    slides.visible = sl > 0.001;
    fadeTo(histPlate, prog(hs, 0.4, 1) * sl);
  }

  return Object.assign(set, {
    params: { charts_a: 1, charts_slides: 0, charts_hist: 0 },
    update,
    anchors,
    labels: [
      { text: [`${D.facts.donors} donors`, `GTEx, aged ${D.facts.ages[0]} to ${D.facts.ages[1]}`], at: 'histTop', cls: 'cyn', alpha: S => prog(S.charts_hist, 0.7, 1) * S.charts_slides },
    ],
    cam: { default: [0, 6, 3.2, -0.05, -0.1, 0], hist: [0, 6, 3.2, -0.05, -0.1, 0], fan: [0, 14, 3.0, 0, -0.15, 0] },
    // (not a scene of explore mode: no controls)
    controls: [],
  });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['body', 'organ', 'section', 'charts'];
// sets drawn in another set's frame: the ovary sits small in the tour's body before it grows out of it, so the two
// always turn together (and the story shows them together)
const FRAME = { body: 'organ' };
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
  [0, 0], [2.6, 2.4], [4.4, 4], [9.5, 8.5], [22.1, 20], [32.6, 28], [43.8, 36],  // Reserve
  [53.7, 45], [55, 46.2], [61.1, 49], [67.1, 54.5], [78, 63],  // Donors
  [96.7, 80], [98, 81.18], [98.8, 81.2], [106.3, 86], [138.2, 115], [144.7, 120],  // Section
  [154.4, 125], [155.1, 125.6], [156.9, 127], [209.3, 174.6], [223.4, 178],  // Methods
  [232.4, 185], [233, 185.6], [300, 225],             // Age (provisional: run tools/pace.mjs)
  [300.6, 225.6], [370, 270],                         // Next (provisional)
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
  { key: 'title', name: 'Reserve', a: 0, b: 45 },
  { key: 'donors', name: 'Donors', a: 45, b: 80 },
  { key: 'section', name: 'Section', a: 80, b: 125 },
  { key: 'methods', name: 'Methods', a: 125, b: 185 },
  { key: 'trends', name: 'Age', a: 185, b: 225 },
  { key: 'network', name: 'Next', a: 225, b: 270 },
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
// (the section and the ovary, about 1.9 long, need about 4 units' distance to fit right of the panel: further back,
// and moved right)
const SEC = [0, 0, 0.6, -0.22];
const FIT = { organ: { default: [0, 0, 0.5, -0.2], face: [0, 0, 1.0, -0.5], open: [0, 0, 0.5, -0.2], whole: [0, 0, 0.4, -0.15] },
  section: { default: SEC, pair: [0, 0, 1.05, -0.25], tiles: SEC, mask: SEC, net: [0, 0, 0.9, -0.2], forest: [0, 0, 1.0, -0.2], kinds: [0, 0, 0.3, -0.2] },
  charts: { default: [0, 0, 0.5, -0.2], hist: [0, 0, 0.5, -0.2], fan: [0, 0, 0.5, -0.2] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen
const NARROW = { organ: { default: 1.15, face: 1.15, open: 1.15 }, section: { default: 1.2, pair: 1.3, tiles: 1.2, mask: 1.2, net: 1.2, forest: 1.3, kinds: 1.25 },
  charts: { default: 1.25, hist: 1.25, fan: 1.25 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The poster's numbers (OVARY_DATA, typed in exactly as printed) and its lines looked up (OVARY_TREND), for the story and
// the panes. Every number the story states comes from here.
const OD = OVARY_DATA, TRD = OVARY_TREND;
const KD = Object.fromEntries(OD.kinds.map(k => [k.key, k]));
// the four kinds both methods find, in the poster's table order (vessel, macrophage, albicans, follicle); the cyst only
// the segmentation finds; the order of the poster's trend charts (vessel, albicans, follicle, macrophage), for lists
const KINDS4 = OD.kinds.filter(k => !k.segOnly).map(k => k.key), KINDS = OD.kinds.map(k => k.key), CHART = OD.chartOrder;
// each kind's color: the poster's, lifted for the dark scene and the headset's panel (OVARY_LOOK.GLOW)
const toHex = c => '#' + c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const KCOL = Object.fromEntries(OD.kinds.map((k, i) => [k.key, toHex(OVARY_LOOK.GLOW[i])]));
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
const plural = key => KD[key].plural, Plural = key => cap(KD[key].plural);
// scores as the poster prints them ('0.70'), r and p as printed ('−0.24', '2.1×10⁻⁴')
const sc2 = v => (+v).toFixed(2), rT = TRD.rText, pT = TRD.pText;
const METHOD = { rf: OD.methods.rf, seg: OD.methods.seg };
// the count of a kind at an age on each method's fitted line (objects per section), rounded as the ovary's tags round
// it (the lines are read off the poster's figures): whole numbers under 100, the nearest ten above
const onLine = (key, m, age) => { const c = Math.max(0, TRD.line(key, m, age)); return c < 99.5 ? Math.round(c) : Math.round(c / 10) * 10; };
// what the sets know (their api())
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
const API = {};
const api = k => API[k] || (API[k] = setApi(k) || {});

// ------------------------------------------------------------------ facts --
const FACTS = (() => {
  const D = OD, H = D.hist, B = D.background;
  // donors in the bars that start after an age (so all of them are older than it)
  const over = a => H.counts.reduce((s, n, i) => s + (H.from + i * H.width >= a ? n : 0), 0);
  // the age at which the follicle lines reach none (each method's, averaged; said to the nearest five years)
  const z = ['rf', 'seg'].map(m => D.trends.follicle[m].zeroAge).filter(Number.isFinite);
  const ps = KINDS4.map(k => KD[k].compare.p);
  // the trends with age (eight: four kinds by two methods): those with p of 0.05 or more are no trend; the others' p sum
  // up as "below" the first of 0.001, 0.01, 0.05 above their largest
  const tr = KINDS4.flatMap(k => ['rf', 'seg'].map(m => KD[k].trend[m])), sig = tr.filter(t => t.p < 0.05);
  const pTop = sig.length ? Math.max(...sig.map(t => t.p)) : 1;
  // the follicles: the share of donors with none in their section in the last decade (each method's, read off the
  // figures, averaged; said to the nearest 5 %)
  const zs = ['rf', 'seg'].map(m => D.trends.follicle[m].zero), last = zs[0].length - 1;
  return {
    donors: D.facts.donors, ages: D.facts.ages, data: D.facts.data, scale: D.facts.scale, bars: H.counts.length, width: H.width, over40: over(40),
    annotated: KINDS4.reduce((s, k) => s + KD[k].annotated, 0), zeroAt: z.length ? Math.round(z.reduce((s, v) => s + v, 0) / z.length / 5) * 5 : null,
    birth: B.atBirth, puberty: B.atPuberty, menopause: B.atMenopause, menoAge: B.menopauseAge, future: D.message.future,
    pMin: Math.min(...ps), pMax: Math.max(...ps), f1: D.checks.f1,
    noTrend: tr.length - sig.length, pBelow: [0.001, 0.01, 0.05].find(x => pTop < x) || null,
    noneDecade: 20 + 10 * last, nonePct: Math.round(zs.reduce((s, a) => s + a[last], 0) / zs.length * 20) * 5,
  };
})();
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const mil = n => (n >= 1e6 ? `${n / 1e6}` : fmt(n));
// the textbook numbers of follicles, said with "about"
const reserveText = F => `About ${mil(F.birth[0])} to ${mil(F.birth[1])} million follicles at birth, about ${fmt(F.puberty[0])} to ${fmt(F.puberty[1])} at puberty and about ${fmt(F.menopause)} at menopause (on average around ${F.menoAge}).`;
// the authors with their affiliations, and the support, as the poster gives them
const creditText = () => {
  const S = OD.source;
  return `Poster: "${S.title}" by ${listOf(S.authors.map(a => `${a.name} (${a.aff.join(', ')})`))}. ${S.affiliations.map((x, i) => `(${i + 1}) ${x}`).join('; ')}. Supported by ${listOf(S.support)}. Data: ${S.data}.`;
};
// colors as text on the HTML panel, which is light in the light theme: a color mixed with the panel's ink (darker on a
// light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the color itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same color

function buildStory() {
  const F = FACTS;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const hide = (k, t0, t1) => ramp(k + '_a', t0, t1, 1, 0);
  // jump a param (a step, or one changed while its set is hidden) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const fol = KD.follicle, ves = KD.vessel, alb = KD.albicans, mac = KD.macrophage, cyst = KD.cyst;
  // a trend in words: both methods' r below 0, 'fall'; above, 'rise' (the poster's r); per method, 'no trend' where its
  // p is 0.05 or more
  const trendDir = k => (k.trend.rf.r < 0 && k.trend.seg.r < 0 ? 'fall' : k.trend.rf.r > 0 && k.trend.seg.r > 0 ? 'rise' : '');
  const trendBy = (k, m) => { const t = k.trend[m]; return `${t.p >= 0.05 ? 'no trend' : t.r < 0 ? 'falling' : 'rising'} by ${m === 'rf' ? 'the random forest' : 'segmentation'} (r ${rT(t.r)}${t.p >= 0.05 ? `, p ${pT(t.p)}` : ''})`; };
  // the methods' agreement donor by donor (the poster's comparison r), well (r 0.7 or more) and less; where the
  // segmentation's fitted line runs below the diagonal for all the less (read slopes below 1), it finds fewer
  const agreeText = () => {
    const ag = KINDS4.slice().sort((p, q) => KD[q].compare.r - KD[p].compare.r), well = ag.filter(k => KD[k].compare.r >= 0.7), less = ag.filter(k => KD[k].compare.r < 0.7);
    const rl = (ks, first) => listOf(ks.map((k, i) => `${plural(k)} (${first && !i ? 'r ' : ''}${rT(KD[k].compare.r)})`));
    const fewer = less.length && less.every(k => OD.compare[k] && OD.compare[k].slope < 1) ? ': the segmentation finds fewer' : '';
    return well.length && less.length ? `Donor by donor the methods agree on ${rl(well, true)}, less on ${rl(less)}${fewer}.` : `Donor by donor the methods agree on ${rl(ag, true)}.`;
  };
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">The aging ovary</h1>
      <p class="lede" data-at="2.4">what ${F.donors} ovaries show about aging</p>
      ${turns(`<p data-at="4" data-out="19.5">The ovaries hold the eggs, each in a small sac of cells: a follicle.</p>
        <p data-at="8.5" data-out="19.5" class="amber">Every ovary starts with a reserve of follicles that is never refilled.</p>
        <p class="note" data-at="13" data-out="19.5">${esc(reserveText(F))}</p>`,
      `<p data-at="20">Cut open: the outer layer (the cortex) holds the follicles, from tiny resting ones to large ones filled with fluid. The inner part (the medulla) carries the blood vessels.</p>
        <p data-at="28">About once a month a follicle releases its egg. What is left becomes a corpus luteum, which shrinks to a pale scar: a corpus albicans. Scars pile up over the years.</p>
        <p class="note" data-at="36">The reserve cannot be measured directly. The hormones AMH and FSH are used as indirect markers, but they cannot accurately reflect the true reserve of follicles.</p>`)}`,
    donors: `<h2 data-at="0.6">${F.donors} donors</h2>
      <p data-at="1.2">The ovaries come from GTEx (the Genotype-Tissue Expression project), which collected tissue from people who had died.</p>
      <div class="facts"><div data-at="4"><b>${F.donors}</b><small>donors</small></div><div data-at="5.5"><b>${F.ages[0]}–${F.ages[1]}</b><small>years old</small></div></div>
      <p data-at="9.5">For each donor: a slide of ovary stained with H&amp;E (hematoxylin and eosin: nuclei purple, the rest pink), the activity of its genes (bulk RNA-seq), and clinical and demographic information.</p>
      <p data-at="18" class="amber">Each slide stacks on its donor's age. Most donors were older: at least ${F.over40} of the ${F.donors} were over 40.</p>
      <p class="credits" data-at="25">The poster's age histogram. The slides are drawn, not the GTEx images.</p>`,
    section: `<h2 data-at="0.6">What's in a section</h2>
      ${turns(`<p data-at="1.2" data-out="34.5">A thin slice of ovary, drawn. To teach a computer what to find, people marked ${fmt(F.annotated)} objects of four kinds by hand:</p>
        <ul class="steps">
          ${step(6, 34.5, KCOL.vessel, `${Plural('vessel')} · ${fmt(ves.annotated)}`, 'tubes that carry blood, here cut across')}
          ${step(12, 34.5, KCOL.macrophage, `${Plural('macrophage')} · ${fmt(mac.annotated)}`, 'immune cells that clear away debris')}
          ${step(18, 34.5, KCOL.albicans, `${Plural('albicans')} · ${fmt(alb.annotated)}`, 'pale scars, each left by a corpus luteum')}
          ${step(24, 34.5, KCOL.follicle, `${Plural('follicle')} · ${fmt(fol.annotated)}`, 'an egg in a ring of cells; large ones hold fluid')}
        </ul>`,
      `<p data-at="35">A younger ovary beside an older one. In the older: large pale scars, and almost no follicles left.</p>
        <p class="note" data-at="40">The numbers are the objects marked by hand (the training labels). Scale bars as on the poster: ${esc(F.scale.young)} and ${esc(F.scale.old)}. Both sections are drawn, not GTEx images.</p>`)}`,
    methods: `<h2 data-at="0.6">Two ways to find them</h2>
      ${turns(`<ul class="steps">
          ${step(2, 38.5, '#46d9ff', '1 · Tiles', 'the section is cut into small squares, each labeled with what it shows')}
          ${step(8, 38.5, '#46d9ff', 'Features', 'UNI2, a pathology foundation model (a large model trained on pathology images), turns each tile into a list of numbers')}
          ${step(16, 38.5, '#ffb43b', 'A random forest', 'many decision trees each ask a few questions of those numbers and vote; the most votes name the tile')}
          ${step(33, 38.5, '#ffb43b', 'Prediction', 'every tile gets a label: tile-level classification')}
        </ul>`,
      `<ul class="steps">${step(39, 0, '#3ee08f', '2 · Masks', 'SegFormer, a semantic segmentation model, paints a mask over each object it finds, pixel by pixel')}</ul>
        <p data-at="49">How good are they? Precision: of the tiles called follicle, how many are one. Recall: of the follicles, how many were found. F1: the two in one number. IoU: how far a predicted mask and the true one overlap. 1 is perfect.</p>
        <p class="note" data-at="53">Random forest F1: ${KINDS4.map(k => `${plural(k)} ${sc2(KD[k].rf.f1)}`).join(', ')}. SegFormer IoU: ${KINDS4.map(k => `${plural(k)} ${sc2(KD[k].iou)}`).join(', ')}; cysts, which only the segmentation finds, just ${sc2(cyst.iou)}: hard.</p>`)}`,
    trends: `<h2 data-at="0.6">Trends with age</h2>
      ${turns(`<p data-at="1.2" data-out="30.5">Count each kind in every donor's section by both methods, RF (random forest) and Seg (segmentation), and set the counts against age: different donors at each age, not one ovary followed over time. This ovary ages along the poster's lines.</p>
        <ul class="steps">
          ${step(7, 30.5, KCOL.follicle, `${Plural('follicle')} ${trendDir(fol)}`, `RF r ${rT(fol.trend.rf.r)}, Seg r ${rT(fol.trend.seg.r)} · the lines reach none by about ${F.zeroAt}; in their ${F.noneDecade}s about ${F.nonePct}% of donors have none in their section`)}
          ${step(12, 30.5, KCOL.vessel, `${Plural('vessel')} ${trendDir(ves)}`, `RF r ${rT(ves.trend.rf.r)}, Seg r ${rT(ves.trend.seg.r)}`)}
          ${step(17, 30.5, KCOL.albicans, `${Plural('albicans')} ${trendDir(alb)}`, `the scars pile up · RF r ${rT(alb.trend.rf.r)}, Seg r ${rT(alb.trend.seg.r)}`)}
          ${step(22, 30.5, KCOL.macrophage, Plural('macrophage'), `${trendBy(mac, 'rf')}, ${trendBy(mac, 'seg')}; not drawn in this ovary`)}
        </ul>
        <p class="note" data-at="26" data-out="30.5">Compare each method with itself over the years: they count in their own ways.${F.pBelow ? ` ${F.noTrend ? 'Every other' : 'Every'} trend has p below ${F.pBelow}.` : ''}</p>`,
      `<p data-at="31">${esc(agreeText())}</p>
        <p class="note" data-at="34.5">r runs from −1 to +1: below 0, fewer with age; above 0, more; near 0, no trend. A small p means a trend this strong would rarely come about by chance.</p>
        <p class="credits" data-at="37.5">r and p are the poster's (the agreement's p from ${pT(F.pMax)} down to ${pT(F.pMin)}). The tags on the ovary give each method's count on the poster's lines, read off its figures: approximate. The ovary is drawn to follow them, not to scale.</p>`)}`,
    network: `<h2 data-at="0.6">Next: a network</h2>
      ${turns(`<p data-at="1.2" data-out="29.5">Where things lie matters too. Make each object a node, and link objects that lie close together: a spatial neighbor network.</p>
        <p class="note" data-at="5" data-out="29.5">Drawn as an illustration of the poster's next step, not its result.</p>
        <p data-at="11" data-out="29.5">Gather the nodes by kind and the links become bands: which kinds lie next to which.</p>
        <p data-at="19.5" data-out="29.5">As the ovary ages, the network changes: follicles' nodes go, scars' nodes come.</p>`,
      `<p data-at="30">Next, the authors plan to ${esc(listOf(F.future))}.</p>
        <p class="amber" data-at="34.5">This is where network medicine comes in: as in Tissue and time, a tissue becomes a network of neighbors.</p>
        <p class="credits" data-at="38.5">${esc(creditText())}</p>
        <p data-at="41.5"><button class="btn primary" id="btnGoExplore" type="button">Explore the ovary</button></p>
        <p class="credits" data-at="43">Drawn, not GTEx images: the ovary, the slides and the sections. Illustrative: the network. The tags on the ovary are each method's count on the poster's lines, read off its figures: approximate.</p>`)}`,
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
  // (the body and the ovary share one frame, so their waypoints turn them together)
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  start({ body_pet: 1, body_net: 0, body_state: 0, body_blank: 0,
    organ_grow: 0, organ_body: 1, organ_open: 0, organ_age: 25, organ_follicle: 0, organ_albicans: 0, organ_vessel: 0, organ_luteum: 0, organ_parts: 0, organ_agelab: 0, organ_counts: 0,
    section_age: 26, section_pair: 0, section_vessel: 0, section_macrophage: 0, section_albicans: 0, section_follicle: 0, section_cyst: 0,
    section_tiles: 0, section_feat: 0, section_forest: 0, section_pred: 0, section_mask: 0, section_net: 0, section_lift: 0, section_kinds: 0, section_names: 0,
    charts_slides: 0, charts_hist: 0 });
  let a, b;
  // The reserve: the tour's PET body, the ovary small in its pelvis; it grows out of the body, opens, and its parts are named
  a = C.title.a; b = C.title.b;
  show('body', 0.2, 2); show('organ', 0.2, 2);
  cam(a, 'organ', 'body', -12);
  cam(a + 4.5, 'organ', 'body', 6, 'spin');
  cam(a + 9, 'organ', 'pelvis');
  ramp('organ_grow', a + 9.5, a + 18.5, 0, 1);
  hide('body', a + 11, a + 16);
  cam(a + 18.5, 'organ', 'whole');
  ramp('organ_open', a + 20, a + 27, 0, 1);
  cam(a + 21, 'organ', 'open');
  cam(a + 27.5, 'organ', 'face');
  ramp('organ_parts', a + 27, a + 29, 0, 1);
  cam(a + 32, 'organ', 'face', 8, 'spin');
  cam(a + 35, 'organ', 'cortex');
  cam(b - 0.5, 'organ', 'cortex', 10, 'spin');
  // 255 donors: the slides fly in and fan out, then stack into the age histogram
  a = C.donors.a; b = C.donors.b;
  hide('organ', a, a + 1.5);
  ramp('organ_parts', a + 1.5, a + 1.6, 1, 0);
  show('charts', a + 0.5, a + 2.5);
  ramp('charts_slides', a + 1, a + 10, 0, 1);
  cam(a + 1, 'charts', 'fan', -8);
  cam(a + 11, 'charts', 'fan', 6, 'spin');
  ramp('charts_hist', a + 13, a + 23, 0, 1);
  cam(a + 14, 'charts', 'hist', -4);
  cam(b - 0.5, 'charts', 'hist', 8, 'spin');
  // What's in a section: one kind picked out after another with its count; all four; then a younger and an older section
  a = C.section.a; b = C.section.b;
  hide('charts', a, a + 2);
  jump('charts_slides', a + 2.2, 1, 0); jump('charts_hist', a + 2.2, 1, 0);
  show('section', a + 0.5, a + 2.5);
  cam(a + 1, 'section', 'default', -10);
  cam(a + 5.5, 'section', 'default', 4, 'spin');
  const pick = (k, t0, t1) => { ramp('section_' + k, t0, t0 + 1, 0, 1); ramp('section_' + k, t1, t1 + 1, 1, 0); };
  pick('vessel', a + 6, a + 11.5); pick('macrophage', a + 12, a + 17.5); pick('albicans', a + 18, a + 23.5);
  ramp('section_follicle', a + 24, a + 25, 0, 1);
  cam(a + 25, 'section', 'close');
  cam(a + 29.5, 'section', 'close', 8, 'spin');
  // (all four at once, then none)
  for (const k of ['vessel', 'macrophage', 'albicans']) ramp('section_' + k, a + 30.5, a + 31.5, 0, 1);
  for (const k of KINDS4) ramp('section_' + k, a + 33.5, a + 34.5, 1, 0);
  cam(a + 31.5, 'section', 'default', -4);
  ramp('section_pair', a + 35, a + 41, 0, 1);
  cam(a + 35.5, 'section', 'pair');
  cam(b - 0.5, 'section', 'pair', 6, 'spin');
  // Two methods: tiles, their features, the forest's vote, the predictions; then SegFormer's masks, and the scores as tags
  // on the masked section's own objects (story labels, below)
  a = C.methods.a; b = C.methods.b;
  ramp('section_pair', a, a + 2, 1, 0);
  ramp('section_tiles', a + 2, a + 7, 0, 1);
  cam(a + 2, 'section', 'tiles', -6);
  cam(a + 7.5, 'section', 'tiles', 4, 'spin');
  ramp('section_feat', a + 8, a + 14, 0, 1);
  cam(a + 9, 'section', 'feat');
  cam(a + 15, 'section', 'feat', 6, 'spin');
  ramp('section_forest', a + 16, a + 33, 0, 1);
  cam(a + 17, 'section', 'forest');
  cam(a + 32, 'section', 'forest', 8, 'spin');
  ramp('section_pred', a + 33, a + 37.5, 0, 1);
  cam(a + 35.5, 'section', 'tiles', -4);
  for (const n of ['section_tiles', 'section_feat', 'section_forest', 'section_pred']) ramp(n, a + 38, a + 39.5, 1, 0);
  ramp('section_mask', a + 39.5, a + 47.5, 0, 1);
  cam(a + 39.5, 'section', 'mask', -6);
  cam(a + 47.5, 'section', 'mask', 6, 'spin');
  cam(b - 0.5, 'section', 'mask', 18, 'spin', [0, 10]);
  // Trends with age: the big cut-away ovary alone ages from 20 to 70, its tags giving each method's count on the poster's
  // lines (no charts: the r values are on the panel)
  a = C.trends.a; b = C.trends.b;
  hide('section', a, a + 2);
  jump('section_mask', a + 2.2, 1, 0);
  jump('organ_body', a, 1, 0); jump('organ_agelab', a, 0, 1); jump('organ_age', a, 25, 20);
  show('organ', a + 1, a + 3);
  ramp('organ_counts', a + 3, a + 5, 0, 1);
  ramp('organ_age', a + 5, a + 37, 20, 70);
  cam(a + 1, 'organ', 'default', -8);
  cam(a + 14, 'organ', 'default', 6, 'spin');
  cam(a + 19, 'organ', 'face', -4);
  cam(b - 0.5, 'organ', 'face', 8, 'spin');
  // Next, a network: the illustrative spatial neighbor network over the section; it tips back, its nodes rise off it and
  // gather into hubs by kind, the links into bands between kinds; then it ages from 25 to 65
  a = C.network.a; b = C.network.b;
  hide('organ', a, a + 2);
  jump('organ_counts', a + 2.2, 1, 0); jump('organ_agelab', a + 2.2, 1, 0);
  jump('section_age', a, 26, 25);
  show('section', a + 0.5, a + 2.5);
  ramp('section_net', a + 2, a + 9, 0, 1);
  ramp('section_lift', a + 10, a + 14, 0, 1);
  ramp('section_kinds', a + 14.5, a + 19, 0, 1);
  ramp('section_names', a + 17, a + 19, 0, 1);   // (the hubs' names: the set's labels, each going with its hub)
  ramp('section_age', a + 20, a + 36, 25, 65);
  cam(a + 1, 'section', 'net', -6);
  cam(a + 9.5, 'section', 'net', 2, 'spin');
  cam(a + 14, 'section', 'kinds', 0, null, [0, 10, -0.3, 0, -0.3]);   // (the slab tipped back and sunk: from a little above)
  cam(a + 19.5, 'section', 'kinds', -4);
  cam(b, 'section', 'kinds', 10, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  a = C.title.a;
  label('organ', 'small', '<b>An ovary</b>one of two', a + 4, a + 10, 'mag');
  a = C.donors.a;
  label('charts', 'fan', `<b>${F.donors} slides</b>one per donor`, a + 5, a + 13, 'cyn');
  a = C.section.a;
  [['vessel', 6, 11.5, 'cyn'], ['macrophage', 12, 17.5, 'grn'], ['albicans', 18, 23.5, 'mag'], ['follicle', 24, 30.5, 'amb']].forEach(([k, t0, t1, cls]) =>
    label('section', k, `<b>${esc(cap(KD[k].name))}</b>${fmt(KD[k].annotated)} marked`, a + t0 + 0.5, a + t1, cls));
  // the scores as tags on the masked section's own objects: the random forest's F1 and SegFormer's IoU (the poster's)
  a = C.methods.a; b = C.methods.b;
  [['follicle', 49.5, 'amb'], ['vessel', 50.3, 'cyn'], ['macrophage', 51.1, 'grn'], ['albicans', 51.9, 'mag'], ['cyst', 53.5, '']].forEach(([k, t0, cls]) =>
    label('section', k, `<b>${esc(cap(KD[k].name))}</b>${KD[k].rf ? `F1 ${sc2(KD[k].rf.f1)} · ` : ''}IoU ${sc2(KD[k].iou)}${k === 'cyst' ? ': the mask misses most of it' : ''}`, a + t0, b, cls));
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
// (the body and the ovary share one turn: one frame)
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
    // (a label's text may be a function: it follows what the set shows, see labelText)
    const fn = typeof L.text === 'function' ? L.text : null, [b, r] = fn ? fn() : L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${sfxSpan(r)}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1,
      fn, tx: fn ? b + '|' + r : '', none: !b && !r });
  }
}
// a label whose text is a function (the ovary's age and counts) is read again while it shows and redrawn when it
// changes: the HTML label, and the headset's sprite (dropped, so it is made again)
function labelText(L) {
  if (!L.fn) return;
  const [b, r] = L.fn(), s = b + '|' + r;
  if (s === L.tx) return;
  L.tx = s; L.none = !b && !r;
  L.el.innerHTML = `<b>${esc(b)}</b>${sfxSpan(r)}`;
  L.w = 0; L.nar = undefined; dropSprite(L);
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
    if (o <= 0) { if (L.o !== 0) { L.el.style.opacity = 0; L.o = 0; } continue; }
    vis.push([L, x, y, o]);
  }
  vis.sort((p, q) => p[2] - q[2]);
  for (const [L, x, y0, o0] of vis) {
    let y = y0, o = o0;
    for (let pass = 0; pass < 6; pass++) {
      const hit = _placed.find(r => x < r[0] + r[2] && r[0] < x + L.w && y < r[1] + r[3] && r[1] < y + L.h);
      if (!hit) break;
      y = hit[1] + hit[3] + 2;
    }
    // (a label nudged down under the panel or the timeline, as on a small screen held sideways, shows none)
    if ((pr.width && y + L.h > pr.top && y < pr.bottom && x < pr.right + 6) || y + L.h > barTop - 4) o = 0;
    if (o !== L.o) { L.el.style.opacity = o; L.o = o; }
    if (o <= 0) continue;
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
// Explore mode: the kinds of object and their numbers, the age along the poster's trend lines, the two methods; or any
// scene with its own controls.
const SCENES = [
  ['organ', 'Ovary', 'A drawn ovary, cut open: follicles in the cortex, blood vessels in the medulla, a corpus luteum and corpora albicantia. Its counts follow the poster\'s trend lines with age.'],
  ['section', 'Section', 'A drawn H&E section of an ovary with the four kinds of object and cysts; a younger and an older one; the two methods; and the illustrative neighbor network, also gathered by kind.'],
];
const SCENE_SHORT = {};
const TABS = [['objects', 'Objects'], ['age', 'Age'], ['methods', 'Methods'], ['scenes', 'Scenes']];
// the sets' own Age controls give way to the story's age slider (X.age), which drives them all
const isAge = c => /^age$/i.test(c.key) || /^age$/i.test(c.label || '');
const ctlsOf = k => (GL.sets[k].controls || []).filter(c => !isAge(c));
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries((GL.sets[k].controls || []).map(x => [x.key, isAge(x) ? ageOpt(x) : ctlValue(k, x)])));
const AGE0 = FACTS.ages[0], AGE1 = FACTS.ages[1];
const X = { tab: 'objects', scene: 'section', ctl: {}, t0: 0, turn: 'on', kind: null, age: 30, method: 'rf' };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between (none
// in this story's scenes now)
const STEP = new Set();
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a control's option whose key or name matches re (the sets name their own options)
const optKey = (k, key, re) => { const c = ctlOf(k, key), o = c && c.options.find(([v, n]) => re.test(v) || re.test(n)); return o ? o[0] : null; };
const hasOpt = (k, key, v) => { const c = ctlOf(k, key); return !!(c && c.options.some(o => o[0] === v)); };
// the age slider as a set's own Age option (the one nearest X.age)
const ageOpt = c => { let b = c.options[0][0], bd = Infinity; for (const [v, n] of c.options) { const a = parseFloat(n) || parseFloat(v), d = Math.abs(a - X.age); if (d < bd) { bd = d; b = v; } } return b; };
// a view option's camera: the one it stands for, or the cam view of the same name
const CAM_ALIAS = { organ: { cut: 'default', closed: 'whole', body: 'pelvis' }, section: { section: 'default', masks: 'mask', network: 'net' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {}, vc = ctlOf(k, 'view'), o = vc && vc.options.find(x => x[0] === v), n = o ? String(o[1]).toLowerCase() : '';
  for (const x of [al[v], v, n, al[n]]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the view on show in a set, by its key or its name
const viewIs = (k, re) => { const c = ctlOf(k, 'view'); if (!c) return false; const v = ctlValue(k, c), o = c.options.find(x => x[0] === v); return re.test(v) || !!(o && re.test(o[1])); };
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
const afterUpdate = f => { NEXT.push(f); };
// each kind in a line (the story's own words)
const KIND_TEXT = { vessel: 'Tubes that carry blood, here cut across: a wall round an opening.', macrophage: 'Immune cells that clear away debris.',
  albicans: 'Pale scars, each left by a corpus luteum after an egg was released. They pile up over the years.', follicle: 'An egg in a ring of cells; the large ones hold fluid. The reserve that is never refilled.',
  cyst: 'Fluid-filled sacs. Only the segmentation looks for them.' };

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = isAge(ct) ? ageOpt(ct) : ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  // the age slider drives the ovary and the section to the year (the sets' own Age options are steps of ten); on the Age
  // tab the cut-away ovary carries its tags (each method's count on the poster's lines) instead of its parts' names
  if (k === 'organ') {
    tg.organ_age = X.age;
    if (viewIs('organ', /body/)) Object.assign(tg, GL.sets.body.params, { body_a: 1, body_net: 0, body_state: 0, body_blank: 0 });   // the ovary in the tour's body
    else if (X.tab === 'age') Object.assign(tg, { organ_counts: 1, organ_parts: 0 });
  }
  if (k === 'section') tg.section_age = X.age;
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
  if (!GL.sets[k] || !SCENES.some(s => s[0] === k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) flyTo(view(k, viewCam(k) || 'default'));
  pushState(); renderAll();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // a view has its own best camera
  if (key === 'view' && k === X.scene) { const n = camFor(k, ctlValue(k, ctlOf(k, 'view'))); flyTo(view(k, n || 'default')); }
  pushState(); renderAll();
}
// a view of a set by its option's key, its scene brought up
function showView(k, v) { if (X.scene !== k) openScene(k); if (hasOpt(k, 'view', v) && ctlValue(k, ctlOf(k, 'view')) !== v) setCtl(k, 'view', v); }
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
// Each setter changes its own field only when called with ui false (a shared room's state arriving); picked by
// hand (ui true) it also sets the scenes' controls that show it.
// a kind of object (null none): picked out on the section and in the ovary (where it has it); a kind the ovary on show
// lacks (macrophages, cysts) brings up the section
function selectKind(v, ui = true) {
  X.kind = KD[v] ? v : null;
  if (ui) {
    const k = X.kind;
    (X.ctl.section = X.ctl.section || {}).show = k || 'none';
    (X.ctl.organ = X.ctl.organ || {}).show = k && hasOpt('organ', 'show', k) ? k : 'none';
    if (k && X.scene === 'organ' && !hasOpt('organ', 'show', k)) openScene('section');
  }
  pushState(); renderAll();
}
// the age (20 to 70): the ovary and the section follow it
function setAge(v) {
  X.age = Math.round(clamp(+v, AGE0, AGE1));
  syncAge();
}
// one of the two methods: tiles and the random forest (the vote plays again), or SegFormer's masks (swept again)
function setMethod(m, ui = true) {
  if (!METHOD[m]) return;
  X.method = m;
  if (ui) { showView('section', m === 'rf' ? 'forest' : 'masks'); X.t0 = performance.now(); }
  renderAll();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls, the kind of
// object, the age and the method. The camera is each person's own.
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
  return { tab: X.tab, scene: X.scene, ctl, kind: X.kind, age: X.age, method: X.method };
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
  // then the picks (after the controls, which already show them)
  if ((v.kind === null || (typeof v.kind === 'string' && KD[v.kind])) && v.kind !== X.kind) selectKind(v.kind, false);
  if (Number.isInteger(v.age) && v.age >= AGE0 && v.age <= AGE1 && v.age !== X.age) setAge(v.age);
  if (METHOD[v.method] && v.method !== X.method) setMethod(v.method, false);
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's color, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
const ageInput = () => `<p class="grp-h">Age <b data-agev style="margin-left:auto;color:var(--ink)">${X.age}</b></p><input type="range" data-age min="${AGE0}" max="${AGE1}" step="1" value="${X.age}" aria-label="Age" style="accent-color:#ffb43b;width:100%">`;
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v;
    ({
      kind: () => selectKind(v === X.kind ? null : v), method: () => setMethod(v),
      view: () => { const [k, o] = v.split(':'); showView(k, o); },
      scene: () => openScene(v), ctl: () => setCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
    }[b.dataset.act] || (() => {}))();
  });
  // the age slider changes in place, so a drag is not cut short by a redraw
  $('#explore').addEventListener('input', ev => { if (ev.target.dataset.age !== undefined) setAge(+ev.target.value); });
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
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  updateExtraLabels();
}
// a tab picked by hand brings up the scene it talks about (a shared room's tab arriving does not: its scene comes with it)
function pickTab(k) {
  showTab(k);
  if (k === 'methods' && !(X.scene === 'section' && viewIs('section', /tiles|forest|masks/))) setMethod(X.method);
  renderAll();
}
function renderAll() { renderObjects(); renderAge(); renderMethods(); renderScenes(); updateExtraLabels(); }
// a kind's numbers: annotated, the random forest's scores, SegFormer's IoU, its trend and the methods' agreement (as
// text: no charts in this story's explore mode)
function kindStats(key) {
  const k = KD[key], f1 = FACTS.f1[key], rows = [];
  if (k.annotated) rows.push(['Marked by hand', fmt(k.annotated), 'training labels']);
  if (k.rf) rows.push(['Random forest', `F1 ${sc2(k.rf.f1)}`, `precision ${sc2(k.rf.precision)} · recall ${sc2(k.rf.recall)}`]);
  rows.push(['SegFormer', `IoU ${sc2(k.iou)}`, key === 'cyst' ? 'hard: the masks mostly miss' : 'overlap of masks']);
  if (k.trend) rows.push(['With age', `r ${rT(k.trend.rf.r)} · ${rT(k.trend.seg.r)}`, `RF p ${pT(k.trend.rf.p)} · Seg p ${pT(k.trend.seg.p)}`]);
  if (k.compare) rows.push(['Methods agree', `r ${rT(k.compare.r)}`, `donor by donor · p ${pT(k.compare.p)}`]);
  const note = f1 && f1.printed !== f1.computed ? `F1 ${sc2(f1.printed)} as the poster prints it; its precision and recall give ${sc2(f1.computed)} (asked of the authors).` : '';
  return { rows, note };
}
function renderObjects() {
  const pane = $('#pane-objects');
  if (!pane) return;
  const k = X.kind;
  let h = `<p class="sub">The four kinds of object the poster counts, and cysts, which only the segmentation looks for. Pick one, or point at one on the section.</p>
    <div class="chips">${KINDS.map(q => chip(`data-act="kind" data-v="${q}"`, esc(Plural(q)), k === q, KCOL[q])).join('')}</div>`;
  if (k) {
    const st = kindStats(k);
    h += `<h3><span class="sw" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${KCOL[k]};margin-right:8px"></span>${esc(Plural(k))}</h3>
      <p class="sub">${esc(KIND_TEXT[k])}</p>
      <dl class="stats">${st.rows.map(([t, v, s]) => `<dt>${t}</dt><dd>${esc(v)}<small>${esc(s)}</small></dd>`).join('')}</dl>
      ${st.note ? `<p class="note">${esc(st.note)}</p>` : ''}
      <p class="grp-h">Show it</p><div class="chips">${chip('data-act="view" data-v="section:section"', 'On the section', X.scene === 'section' && viewIs('section', /^section$/))}${hasOpt('organ', 'show', k) ? chip('data-act="view" data-v="organ:cut"', 'In the ovary', X.scene === 'organ') : ''}</div>`;
  } else h += `<p class="empty">${fmt(FACTS.annotated)} objects of the four kinds were marked by hand to train the methods.</p>`;
  pane.innerHTML = h;
}
// the counts on the poster's trend lines at the age (objects per section, rounded), in the order of its trend charts
const ageRows = () => CHART.map(q => [q, onLine(q, 'rf', X.age), onLine(q, 'seg', X.age)]);
function renderAge() {
  const pane = $('#pane-age');
  if (!pane) return;
  pane.innerHTML = `<p class="sub">Move the age: the ovary and the section follow the poster's trend lines (different donors at each age, not one ovary followed over time).</p>
    ${ageInput()}
    <p class="grp-h">On the poster's trend line at <b data-agev style="color:var(--ink)">${X.age}</b> (objects per section)</p>
    <dl class="stats" id="ageTab">${ageTable()}</dl>
    <p class="grp-h">Show it on</p><div class="chips">${chip('data-act="scene" data-v="organ"', 'The ovary', X.scene === 'organ')}${chip('data-act="scene" data-v="section"', 'The section', X.scene === 'section')}</div>
    <p class="note">The two methods count differently (random forest, segmentation); the lines are the poster's. The ovary and the section are drawn to follow them, not to scale.</p>`;
}
const ageTable = () => ageRows().map(([q, r, s]) => `<dt><span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${KCOL[q]};margin-right:6px"></span>${esc(Plural(q))}</dt><dd>${fmt(r)} · ${fmt(s)}<small>random forest · segmentation</small></dd>`).join('');
// the age's readouts, slider and counts, in place (a drag is not cut short)
function syncAge() {
  document.querySelectorAll('[data-agev]').forEach(el => { el.textContent = X.age; });
  document.querySelectorAll('input[data-age]').forEach(el => { if (document.activeElement !== el) el.value = X.age; });
  const t = $('#ageTab'); if (t) t.innerHTML = ageTable();
}
function renderMethods() {
  const pane = $('#pane-methods');
  if (!pane) return;
  const m = METHOD[X.method], rf = X.method === 'rf', kinds = rf ? KINDS4 : KINDS;
  pane.innerHTML = `<p class="sub">Two ways to find the objects on a section, and how well each does.</p>
    <div class="chips">${chip('data-act="method" data-v="rf"', '1 · Tiles and a random forest', rf)}${chip('data-act="method" data-v="seg"', '2 · SegFormer\'s masks', !rf)}</div>
    <h3>${esc(m.title)}</h3><p>${esc(m.steps.join(' → '))}.</p>
    <div class="chips">${rf ? chip('data-act="view" data-v="section:tiles"', 'Tiles and features', X.scene === 'section' && viewIs('section', /tiles/)) + chip('data-act="view" data-v="section:forest"', 'The vote', X.scene === 'section' && viewIs('section', /forest/))
      : chip('data-act="view" data-v="section:masks"', 'The masks', X.scene === 'section' && viewIs('section', /masks/))}</div>
    <dl class="stats">${kinds.map(q => `<dt><span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${KCOL[q]};margin-right:6px"></span>${esc(Plural(q))}</dt><dd>${rf ? `F1 ${sc2(KD[q].rf.f1)}<small>precision ${sc2(KD[q].rf.precision)} · recall ${sc2(KD[q].rf.recall)}</small>` : `IoU ${sc2(KD[q].iou)}`}</dd>`).join('')}</dl>
    <p class="note">${rf ? 'Precision: of the tiles called follicle, how many are one. Recall: of the follicles, how many were found. F1: the two in one number. 1 is perfect.'
      : `IoU: how far a predicted mask and the true one overlap (1 is perfect). Cysts, found only by the segmentation, score just ${sc2(KD.cyst.iou)}: hard.`}</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${ageHere() ? ageInput() : ''}
    ${X.kind ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(Plural(X.kind))} (Objects tab).</p>` : ''}`;
}
// the scene on show changes with the age (the slider belongs with it)
const ageHere = () => X.scene === 'organ' || X.scene === 'section';
// labels the panes add: the kind picked, at its place on the section or in the ovary
let XL = null;
function updateExtraLabels() {
  const sig = [APP.mode, X.scene, X.kind].join('|');
  if (sig === XL) return;
  XL = sig;
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  if (APP.mode !== 'explore' || !X.kind) return;
  const k = KD[X.kind], at = X.scene === 'section' || (X.scene === 'organ' && hasOpt('organ', 'show', X.kind)) ? X.kind : null;
  if (!at || !GL.sets[X.scene].anchors[at]) return;
  const txt = [Plural(X.kind), k.annotated ? `${fmt(k.annotated)} marked` : 'segmentation only'];
  LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(txt[0])}</b>${esc(txt[1])}`, 'cyn'), set: X.scene, at, o: -1, txt: [...txt, 'cyn'] });
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { kind } (an object on the
// section), or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || X.scene !== 'section') return null;
  const A = api('section');
  if (!A.pick || (XS.section_a || 0) < 0.5) return null;
  let r = -1;
  try { r = A.pick(rc); } catch (e) { return null; }
  const key = (A.kinds || KINDS)[r];
  return r >= 0 && KD[key] ? { kind: key } : null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip): where the ray met the section (pickWith
// has just asked it), or null (then where the ray meets the scene)
const pickPos = p => (p && X.scene === 'section' && api('section').hitAt ? api('section').hitAt() : null);
const pickText = p => [cap(KD[p.kind].name), KD[p.kind].annotated ? `${fmt(KD[p.kind].annotated)} marked` : 'segmentation only'];
function choosePick(p) {
  if (!p) return;
  if (X.tab !== 'objects') showTab('objects');
  selectKind(p.kind === X.kind ? null : p.kind);
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
// the object a controller points at on the section, labeled where the ray meets it
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

// --------------------------------------------------- picking an object --
// The object a ray points at in explore mode (see pickWith), or null
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
      if (r && r.id === p.id && r.fn) { buzz(c); r.fn(); }
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
    // the scene counts as a ball around the view's target; an object on the section counts if the ray meets it
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    _xc.copy(oL).sub(XR.target);
    const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const pk = pickRay(c.o, c.d);
    if (t > 0 || pk) {
      // a pick with a point of its own is marked there; else the ball's surface
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
  // keep the scene and the panel where they were in the story before
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
  return ['x', audioLabel(), X.tab, X.scene, JSON.stringify(X.ctl), X.kind, X.age, X.method].join('|');
}
const XR_HERE = 'ovary';
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
  ctx.fillText(fitText(ctx, 'The aging ovary', x - 40), 40, 36);
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
  ({ objects: drawObjectsPane, age: drawAgePane, methods: drawMethodsPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
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
  vSlider(ctx, P, 'age', x + 80, y, W - 160, X.age, AGE0, AGE1, VC.amber, v => setAge(v));
  return 60;
}
// rows of a kind's swatch, its name, a value and a note (the HTML panes' stats)
function rows(ctx, list, x, y, W, bottom) {
  let yy = y;
  for (const [col, name, v, note] of list) {
    if (yy + 40 > bottom) break;
    if (col) swatch(ctx, x, yy + 6, 20, col);
    ctx.font = vfont(24); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, name, 260), x + (col ? 32 : 0), yy + 2);
    ctx.font = vfont(26, 700); ctx.fillStyle = VC.ink; ctx.fillText(v, x + 300, yy);
    if (note) { const w = ctx.measureText(v).width; ctx.font = vfont(21); ctx.fillStyle = VC.faint; ctx.fillText(fitText(ctx, note, W - 300 - w - 16), x + 300 + w + 14, yy + 4); }
    yy += 42;
  }
  return yy - y;
}
function drawObjectsPane(ctx, P, x, y, W, bottom) {
  const k = X.kind;
  y += textBlock(ctx, 'The four kinds of object the poster counts, and cysts, which only the segmentation looks for.', x, y, W, 24, 33, VC.muted, 400, 2) + 12;
  y += flow(ctx, P, KINDS.map(q => ({ id: 'kind:' + q, label: Plural(q), col: KCOL[q], on: k === q, fn: () => selectKind(k === q ? null : q) })), x, y, W, bottom, { px: 22, h: 48 }) + 18;
  if (!k) { textBlock(ctx, `${fmt(FACTS.annotated)} objects of the four kinds were marked by hand to train the methods. Pick one, or point at one on the section and pull the trigger (or pinch).`, x, y, W, 26, 38, VC.muted); return; }
  swatch(ctx, x, y + 10, 26, KCOL[k]);
  y += textBlock(ctx, Plural(k), x + 40, y + 2, W - 40, 36, 44, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, KIND_TEXT[k], x, y, W, 24, 32, VC.muted, 400, 2) + 12;
  const st = kindStats(k);
  y += rows(ctx, st.rows.map(([t, v, s]) => [null, t, v, s]), x, y, W, bottom) + 6;
  if (st.note && y + 60 < bottom) y += textBlock(ctx, st.note, x, y, W, 21, 29, VC.faint, 400, 2) + 10;
  if (y + 60 > bottom) return;
  flow(ctx, P, [{ id: 'sh:sec', label: 'On the section', on: X.scene === 'section' && viewIs('section', /^section$/), fn: () => showView('section', 'section') }]
    .concat(hasOpt('organ', 'show', k) ? [{ id: 'sh:organ', label: 'In the ovary', on: X.scene === 'organ', fn: () => showView('organ', 'cut') }] : []), x, y, W, bottom, { px: 22, h: 50 });
}
function drawAgePane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, 'Move the age: the ovary and the section follow the poster\'s trend lines (different donors at each age, not one ovary followed over time).', x, y, W, 24, 33, VC.muted, 400, 2) + 14;
  y += drawAge(ctx, P, x, y, W) + 14;
  y += head(ctx, x, y, `On the poster's trend line at ${X.age} (objects per section): random forest · segmentation`);
  y += rows(ctx, ageRows().map(([q, r, s]) => [KCOL[q], Plural(q), `${fmt(r)} · ${fmt(s)}`, '']), x, y, W, bottom) + 14;
  y += head(ctx, x, y, 'Show it on');
  y += flow(ctx, P, [{ id: 'a:organ', label: 'The ovary', on: X.scene === 'organ', fn: () => openScene('organ') },
    { id: 'a:sec', label: 'The section', on: X.scene === 'section', fn: () => openScene('section') }], x, y, W, bottom, { px: 22, h: 50 }) + 16;
  if (y + 70 < bottom) textBlock(ctx, 'The two methods count differently; the lines are the poster\'s. The ovary and the section are drawn to follow them, not to scale.', x, y, W, 21, 29, VC.faint, 400, 3);
}
function drawMethodsPane(ctx, P, x, y, W, bottom) {
  const rf = X.method === 'rf', m = METHOD[X.method], bw = (W - 12) / 2;
  vButton(ctx, P, 'm:rf', x, y, bw, 58, '1 · Tiles and a forest', () => setMethod('rf'), { on: rf, px: 22 });
  vButton(ctx, P, 'm:seg', x + bw + 12, y, bw, 58, '2 · SegFormer\'s masks', () => setMethod('seg'), { on: !rf, px: 22 });
  y += 78;
  y += textBlock(ctx, m.title, x, y, W, 34, 42, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, m.steps.join(' → ') + '.', x, y, W, 24, 33, VC.muted, 400, 4) + 12;
  y += flow(ctx, P, (rf ? [{ id: 'v:tiles', label: 'Tiles and features', on: X.scene === 'section' && viewIs('section', /tiles/), fn: () => showView('section', 'tiles') },
    { id: 'v:forest', label: 'The vote', on: X.scene === 'section' && viewIs('section', /forest/), fn: () => setMethod('rf') }]
    : [{ id: 'v:masks', label: 'The masks', on: X.scene === 'section' && viewIs('section', /masks/), fn: () => setMethod('seg') }]), x, y, W, bottom, { px: 22, h: 50 }) + 16;
  y += rows(ctx, (rf ? KINDS4 : KINDS).map(q => [KCOL[q], Plural(q), rf ? `F1 ${sc2(KD[q].rf.f1)}` : `IoU ${sc2(KD[q].iou)}`, rf ? `precision ${sc2(KD[q].rf.precision)} · recall ${sc2(KD[q].rf.recall)}` : '']), x, y, W, bottom) + 10;
  if (y + 70 < bottom) textBlock(ctx, rf ? 'Precision: of the tiles called follicle, how many are one. Recall: of the follicles, how many were found. F1: the two in one number. 1 is perfect.'
    : `IoU: how far a predicted mask and the true one overlap (1 is perfect). Cysts, found only by the segmentation: just ${sc2(KD.cyst.iou)}.`, x, y, W, 21, 29, VC.faint, 400, 3);
}
// the scenes, and the chosen scene's own controls (and the age, where the scene shows it)
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
// Optional voice-over: put an MP3 at audio/narration-ovary.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-ovary.mp3', {
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
    // (the set on show, or the one about to come: a short fade between two of the same set's views shows none)
    const S2 = storyState(Math.min(ts + 1.5, T_END));
    let best = 'section', ba = 0;
    for (const k of SET_ORDER) { const a = Math.max(S[k + '_a'], 0.9 * S2[k + '_a']); if (a > ba + 0.01) { ba = a; best = k; } }
    if (best === 'body') best = 'organ';   // (the body shows with the ovary in it)
    // (the donors' slides are no scene of explore mode: from there, explore's start)
    const fromSlides = best === 'charts';
    if (fromSlides) best = 'section';
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
    // the story's picks carry over to the panes: the kind picked out (on the section), the age, the method
    X.kind = null;
    if (best === 'section') { const on = KINDS.filter(q => (S['section_' + q] || 0) > 0.5); if (on.length === 1) X.kind = on[0]; X.ctl.section.show = X.kind || 'none'; }
    const ag = best === 'organ' ? S.organ_age : best === 'section' ? S.section_age : X.age;
    X.age = Math.round(clamp(ag || X.age, AGE0, AGE1));
    X.method = (S.section_mask || 0) > 0.5 ? 'seg' : 'rf';
    X.tab = best === 'section' ? (viewIs('section', /tiles|forest|masks/) ? 'methods' : 'objects') : 'age';
    // from the last chapter (the story's end, or its Explore button), or from the donors' slides: the section, in the
    // Objects tab
    if (ts >= C.network.a || fromSlides) openStart();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: no picked kind
    X.kind = null; NEXT.length = 0; pushState();
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start: the section, in the Objects tab
function openStart() {
  openScene('section', false);
  X.ctl.section = Object.assign(X.ctl.section || {}, { view: 'section', show: 'none' });
  X.kind = null; X.tab = 'objects'; showTab('objects');
  orbit.cur = view('section', viewCam('section') || 'default'); orbit.to = null;
  pushState(); renderAll();
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
    if (!hp.has('t')) { X.ctl = {}; X.age = 30; }   // (straight in: every scene's own defaults, not the story's first shot)
    // #ovary&explore&scene=section&view=forest (any control of a scene by its key, or an option by its name or camera),
    // &tab=objects|age|methods|scenes, &kind=follicle (or vessel, macrophage, albicans, cyst), &age=60, &method=rf|seg
    const sc = hp.get('scene');
    if (sc && SCENES.some(s => s[0] === sc)) { openScene(sc, false); showTab('scenes'); }
    else if (!hp.has('t')) openStart();   // straight in: the section
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    for (const c of ctlsOf(X.scene)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.options.find(([v, n]) => v.toLowerCase() === q || String(n).toLowerCase() === q || camFor(X.scene, v) === q || (CAM_ALIAS[X.scene] || {})[v] === q);
      if (o) setCtl(X.scene, c.key, o[0]);
    }
    const kd = hp.get('kind'), me = hp.get('method');
    if (KD[kd]) { showTab('objects'); selectKind(kd); }
    if (hp.get('age') && Number.isFinite(+hp.get('age'))) setAge(+hp.get('age'));
    if (METHOD[me]) { showTab('methods'); setMethod(me); }
    if (hp.get('tab') && TABS.some(t => t[0] === hp.get('tab'))) {
      if (sc || KD[kd] || METHOD[me]) showTab(hp.get('tab')); else pickTab(hp.get('tab'));
    }
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
    renderAll();
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
