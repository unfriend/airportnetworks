// Holding on to nitrogen: why half of a farm's fertiliser is lost through the soil's microbes, and a wheat that slows
// them down. A cut-away block of soil with a wheat plant: fertiliser dissolving into ammonium, the microbes' relay that
// turns it into nitrate, which washes away, and nitrous oxide, which escapes; a halo round the roots of a wheat that
// carries a piece of a wild grass's chromosome. A hop on the globe from Vienna to Japan, a field of 24 plots under
// netting growing over five dates, nitrate seeping under each plot and jars of soil breathing out N2O; a cloud of the
// soil's microbes, the network of those that rise and fall together, its modules lighting the plots where they thrive,
// and the two wheat lines' networks side by side. After the slides "Exploring the Effects of Biological Nitrification
// Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter Wheat" by Marina Montserrat Díez and colleagues
// (Christa Schleper's group, University of Vienna, with JIRCAS, the University of Thessaly and Université Lyon 1), and
// their field trial's data, used with the authors' permission (SOIL_DATA, decoded by SDATA). The soil block, the flows,
// the relay, the chromosome and the field's layout are illustrative; every number is the data's or read off the slides.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/soil/build.mjs from the tour's kit and the data, look, sets and engine parts in tools/soil: edit
// those, not this file.
HOST.register('soil', function (HOST) {
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
// SOIL_DATA (the trial's numbers, generated), SDATA (its decoders and lookups: no science) and SLOOK (the story's
// palette and shared shapes) come first, then TLOOK (the tissue topology story's look, unchanged: tubes, rings, balls,
// glass, halos), then the tour's web set (unchanged: only its globe is used), then the sets: soil, field, net.
const SETS = {};
// Generated by tools/soil/data/gen_data.py from the authors' field trial (16S reads, taxonomy, field metadata) and tools/soil/data/figures.json; do not edit.
// See the header of the generator and tools/soil/SPEC.md for what each field holds; decode it with SDATA (sets/sdata.js).
const SOIL_DATA = {"about":"the BNI wheat field trial (Marina Montserrat Díez and colleagues; Christa Schleper's group, University of Vienna, with JIRCAS, the University of Thessaly and Université Lyon 1): 16S amplicon reads, their taxonomy and the field metadata, used with the authors' permission (29 Oct 2026); kinds numbered, no ids, no sequences; values read off the slides' charts in figs (two readers, reconciled)","src":{"samples":119,"kinds":100116,"withReads":100116,"reads":22741355,"readsMin":49478,"readsMedian":187772,"readsMax":414013,"zeros":0.9677,"kindsPerSample":3195,"kingdoms":{"Bacteria":99075,"Archaea":525,"Eukaryota":501,"Unassigned":15},"assigned":{"Phylum":0.846,"Class":0.791,"Order":0.631,"Family":0.415,"Genus":0.194},"noGenus":0.511,"missing":{"line":0,"fert":2,"time":3,"rep":0,"slot":52}},"design":{"lines":[{"key":"BNI","name":"Munal-BNI","short":"BNI wheat"},{"key":"Ctrl","name":"Munal-control","short":"control wheat"}],"ferts":[{"key":"N","name":"Not fertilised","kgN":0},{"key":"F","name":"Fertilised","kgN":250},{"key":"S","name":"Fertilised + DCD","kgN":250,"inhibitor":"DCD (a synthetic nitrification inhibitor)"}],"times":[{"key":"T1","dap":129,"day":1,"stage":"early jointing and booting","zadoks":[30,49]},{"key":"T2","dap":144,"day":15,"stage":"late jointing and booting","zadoks":[30,49]},{"key":"T3","dap":153,"day":24,"stage":"heading and flowering","zadoks":[50,69]},{"key":"T4","dap":182,"day":53,"stage":"grain filling","zadoks":[70,89]},{"key":"T5","dap":199,"day":70,"stage":"ripening","zadoks":[90,100]}],"reps":4,"plots":24,"groups":"g = (line * 3 + fert) * 5 + time (line 0 BNI, 1 control; fert 0 N, 1 F, 2 S; time 0..4)","slots":"s = g * 4 + rep (rep 0..3); the missing sample's slot is null in every per-sample list","n":[4,4,4,4,4,4,4,4,4,4,4,4,4,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],"fraction":"rhizosphere soil (the slides' notes)"},"meta":{"nh4":{"name":"Ammonium","unit":"mg N per kg dry soil","values":[6.4,6.96,7.81,5.53,5.64,6.1,7.11,6.77,8.51,10.2,8.94,9.35,6.92,8.17,8.41,9.81,2.81,4.79,2.85,2.77,248.5,81.0,207.0,54.0,87.5,34.0,107.0,57.5,11.5,32.0,13.0,22.5,2.0,4.5,7.0,11.25,4.25,4.95,3.65,4.9,249.5,208.0,377.5,311.0,268.0,166.0,218.0,269.0,134.0,60.0,42.5,177.5,null,0.5,10.05,9.05,2.3,1.2,0.75,5.15,5.67,4.45,6.07,6.6,5.43,5.32,9.81,7.09,8.91,8.52,9.3,10.54,7.76,8.99,7.82,10.35,3.48,2.6,2.41,2.4,161.0,231.0,50.0,269.5,110.5,86.5,59.5,57.5,49.5,34.5,16.0,35.0,12.0,9.5,9.5,58.0,4.4,4.95,4.05,4.9,254.0,345.5,262.5,286.5,380.5,204.0,168.0,270.0,124.5,67.0,63.5,105.5,11.2,10.85,10.55,13.15,2.8,3.8,5.6,2.8],"mean":[6.67,6.4,9.25,8.33,3.3,147.62,71.5,19.75,6.19,4.44,286.5,230.25,103.5,6.53,2.35,5.7,6.91,9.32,8.73,2.72,177.88,78.5,33.75,22.25,4.58,287.12,255.62,90.12,11.44,3.75],"sd":[0.96,0.66,0.72,1.18,0.99,94.7,32.24,9.51,3.94,0.61,73.97,49.01,63.3,5.25,1.98,0.91,2.09,0.87,1.22,0.51,96.36,25.1,13.73,23.86,0.43,41.28,93.35,29.79,1.17,1.32],"n":[4,4,4,4,4,4,4,4,4,4,4,4,4,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],"line":{"byFert":[[6.79,6.68,0.892],[49.9,63.39,0.344],[132.11,129.61,0.684]],"byGroup":[[6.67,5.7,0.343],[6.4,6.91,0.886],[9.25,9.32,1.0],[8.33,8.73,0.886],[3.3,2.72,0.2],[147.62,177.88,0.886],[71.5,78.5,0.772],[19.75,33.75,0.114],[6.19,22.25,0.11],[4.44,4.58,0.884],[286.5,287.12,0.886],[230.25,255.62,0.686],[103.5,90.12,1.0],[6.53,11.44,0.057],[2.35,3.75,0.191]]},"fertP":2e-06},"no3":{"name":"Nitrate","unit":"mg N per kg dry soil","values":[2.09,2.39,3.84,2.77,1.94,2.41,4.53,2.36,1.49,3.05,3.74,2.46,1.15,1.66,1.41,1.91,7.48,8.74,6.17,8.8,57.5,78.0,73.0,55.5,108.0,90.5,107.0,101.5,26.0,44.0,39.5,50.0,33.5,63.5,7.0,74.0,30.0,56.0,8.5,7.5,29.5,19.5,27.0,14.0,44.0,45.5,51.5,47.5,41.5,43.5,31.0,63.0,null,103.0,71.0,112.0,61.5,48.5,17.5,55.0,1.88,2.07,2.6,2.51,2.14,2.54,4.61,2.33,1.69,2.51,1.35,2.24,1.2,1.61,1.63,1.65,3.56,5.14,5.51,6.48,123.5,86.0,25.0,53.0,110.0,129.5,82.5,102.0,75.5,56.0,56.5,55.5,107.5,42.0,31.5,136.0,22.5,9.5,62.0,19.5,10.0,14.5,23.5,18.0,42.0,33.0,74.0,51.0,61.0,45.0,48.5,64.0,101.0,64.5,154.0,112.5,10.5,13.0,111.0,47.5],"mean":[2.77,2.81,2.69,1.53,7.8,66.0,101.75,39.88,44.5,25.5,22.5,47.12,44.75,95.33,45.62,2.26,2.9,1.95,1.52,5.17,71.88,106.0,60.88,79.25,28.38,16.5,50.0,54.62,108.0,45.5],"sd":[0.76,1.17,0.95,0.33,1.24,11.19,8.03,10.2,30.32,22.83,7.08,3.25,13.34,21.55,19.49,0.35,1.15,0.52,0.22,1.21,42.5,19.46,9.76,50.62,23.1,5.7,17.61,9.29,36.87,46.82],"n":[4,4,4,4,4,4,4,4,4,4,4,4,4,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],"line":{"byFert":[[3.52,2.76,0.394],[55.52,69.28,0.285],[48.74,54.92,0.833]],"byGroup":[[2.77,2.26,0.343],[2.81,2.9,0.886],[2.69,1.95,0.343],[1.53,1.52,0.886],[7.8,5.17,0.057],[66.0,71.88,1.0],[101.75,106.0,0.686],[39.88,60.88,0.029],[44.5,79.25,0.486],[25.5,28.38,0.686],[22.5,16.5,0.343],[47.12,50.0,0.886],[44.75,54.62,0.2],[95.33,108.0,0.857],[45.62,45.5,0.486]]},"fertP":0.0},"n2o":{"name":"N2O, potential production","unit":"unit not given (one number per sample)","values":[0.855,1.366,0.82,1.09,1.099,1.952,1.059,1.024,0.952,1.079,0.719,1.105,0.414,0.607,0.548,0.684,0.162,0.314,0.186,0.37,0.448,0.279,0.316,0.455,1.26,2.77,1.721,0.906,1.06,0.474,0.381,1.759,1.262,0.819,0.224,1.322,0.255,0.202,0.19,0.127,0.084,0.099,0.102,0.029,0.182,0.329,0.186,0.219,0.569,0.152,0.201,0.164,null,0.074,0.317,0.106,0.09,0.086,0.101,0.171,0.962,0.942,0.99,0.91,0.879,1.641,1.239,1.011,0.991,0.931,0.955,1.234,0.637,0.877,0.772,0.585,0.088,0.277,0.34,0.246,2.843,1.498,0.228,0.271,2.107,1.304,0.665,0.931,2.919,1.922,0.535,0.336,1.505,0.595,0.459,0.83,0.322,0.138,0.099,0.15,0.073,0.09,0.03,0.053,0.26,0.174,0.389,0.245,0.468,0.182,0.174,0.216,0.34,0.266,0.477,0.434,0.131,0.067,0.056,0.091],"mean":[1.033,1.283,0.964,0.563,0.258,0.374,1.664,0.918,0.907,0.193,0.078,0.229,0.272,0.166,0.112,0.951,1.193,1.028,0.718,0.238,1.21,1.252,1.428,0.847,0.177,0.062,0.267,0.26,0.379,0.086],"sd":[0.252,0.446,0.176,0.114,0.1,0.09,0.809,0.636,0.507,0.053,0.034,0.069,0.2,0.132,0.04,0.034,0.334,0.14,0.132,0.107,1.238,0.628,1.219,0.465,0.099,0.026,0.09,0.139,0.095,0.033],"n":[4,4,4,4,4,4,4,4,4,4,4,4,4,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],"line":{"byFert":[[0.82,0.825,0.989],[0.812,0.983,0.579],[0.172,0.211,0.509]],"byGroup":[[1.033,0.951,1.0],[1.283,1.193,0.686],[0.964,1.028,0.886],[0.563,0.718,0.2],[0.258,0.238,0.886],[0.374,1.21,1.0],[1.664,1.252,0.686],[0.918,1.428,0.686],[0.907,0.847,1.0],[0.193,0.177,0.686],[0.078,0.062,0.486],[0.229,0.267,0.686],[0.272,0.26,0.686],[0.166,0.379,0.114],[0.112,0.086,0.486]]},"fertP":0.0},"chl":{"name":"Chlorophyll","unit":"SPAD index (leaves)","values":[51.56,51.72,52.81,54.17,55.12,50.62,56.17,52.85,55.89,58.5,59.45,60.37,64.55,59.72,62.05,62.22,null,null,null,null,52.78,58.09,57.21,51.53,54.97,58.21,54.82,61.93,62.3,62.98,62.07,61.79,61.87,62.74,61.63,59.15,null,null,null,null,52.74,62.45,54.65,58.38,55.35,54.83,57.17,55.19,65.46,63.15,61.1,60.63,null,58.5,56.03,56.15,null,null,null,null,54.2,58.04,57.91,59.05,59.69,58.43,55.98,56.72,57.3,58.56,62.02,63.74,48.0,42.62,50.76,55.85,57.64,null,null,null,61.86,58.17,63.72,60.72,63.02,60.29,56.71,64.38,62.46,64.58,64.42,61.04,57.58,57.82,60.17,56.79,null,null,null,null,60.61,58.08,58.33,67.08,59.78,61.02,57.23,65.16,65.7,62.58,63.04,59.25,53.36,60.61,62.14,61.07,null,null,null,null],"mean":[52.56,53.69,58.55,62.13,null,54.9,57.48,62.28,61.35,null,57.05,55.64,62.58,56.89,null,57.3,57.71,60.41,49.31,57.64,61.12,61.1,63.13,58.09,null,61.03,60.8,62.64,59.3,null],"sd":[1.2,2.47,1.93,1.97,null,3.24,3.35,0.51,1.54,null,4.29,1.04,2.21,1.39,null,2.13,1.68,2.99,5.52,null,2.32,3.39,1.69,1.46,null,4.19,3.31,2.65,4.01,null],"n":[4,4,4,4,0,4,4,4,4,0,4,4,4,3,0,4,4,4,4,1,4,4,4,4,0,4,4,4,4,0],"line":{"byFert":[[56.74,56.27,0.986],[59.01,60.86,0.235],[58.12,60.94,0.055]],"byGroup":[[52.56,57.3,0.029],[53.69,57.71,0.057],[58.55,60.41,0.486],[62.13,49.31,0.029],[null,57.64,null],[54.9,61.12,0.029],[57.48,61.1,0.2],[62.28,63.13,0.486],[61.35,58.09,0.057],[null,null,null],[57.05,61.03,0.486],[55.64,60.8,0.029],[62.58,62.64,1.0],[56.89,59.3,0.4],[null,null,null]]},"fertP":0.004495},"ph":{"name":"pH","unit":"","values":[null,null,null,null,6.24,6.34,6.37,6.26,6.3,6.4,6.4,6.2,null,null,null,null,6.63,6.58,6.37,6.62,null,null,null,null,5.2,4.99,5.05,5.0,5.36,5.53,5.39,5.09,null,null,null,null,5.99,5.97,5.93,5.87,null,null,null,null,5.5,5.32,5.39,5.18,5.43,5.51,5.43,5.07,null,null,null,null,5.76,5.77,5.7,5.52,null,null,null,null,6.21,6.33,6.37,6.22,6.25,6.37,6.4,6.32,null,null,null,null,6.41,6.6,6.32,6.6,null,null,null,null,5.03,5.11,5.33,4.82,5.11,5.15,5.5,5.18,null,null,null,null,6.37,6.08,6.02,5.91,null,null,null,null,5.48,5.58,5.38,5.19,5.49,5.51,5.45,5.2,null,null,null,null,5.96,5.88,5.46,5.64],"mean":[null,6.3,6.33,null,6.55,null,5.06,5.34,null,5.94,null,5.35,5.36,null,5.69,null,6.28,6.34,null,6.48,null,5.07,5.24,null,6.09,null,5.41,5.41,null,5.74],"sd":[null,0.06,0.1,null,0.12,null,0.1,0.18,null,0.05,null,0.13,0.2,null,0.12,null,0.08,0.07,null,0.14,null,0.21,0.18,null,0.2,null,0.17,0.14,null,0.23],"n":[0,4,4,0,4,0,4,4,0,4,0,4,4,0,4,0,4,4,0,4,0,4,4,0,4,0,4,4,0,4],"line":{"byFert":[[6.39,6.37,0.706],[5.45,5.47,0.885],[5.46,5.52,0.644]],"byGroup":[[null,null,null],[6.3,6.28,0.561],[6.33,6.34,1.0],[null,null,null],[6.55,6.48,0.468],[null,null,null],[5.06,5.07,0.886],[5.34,5.24,0.686],[null,null,null],[5.94,6.09,0.2],[null,null,null],[5.35,5.41,0.686],[5.36,5.41,0.559],[null,null,null],[5.69,5.74,0.886]]},"fertP":0.0},"water":{"name":"Soil water","unit":"unit not given (0.25 to 0.66: a fraction)","values":[0.342,0.275,0.332,0.303,0.351,0.34,0.345,0.337,0.38,0.38,0.427,0.424,0.497,0.416,0.436,0.506,0.397,0.38,0.378,0.398,0.325,0.321,0.319,0.248,0.335,0.345,0.338,0.331,0.362,0.385,0.391,0.357,0.383,0.403,0.456,0.605,0.513,0.486,0.514,0.45,0.315,0.283,0.323,0.314,0.335,0.339,0.332,0.335,0.393,0.463,0.44,0.367,null,0.455,0.414,0.482,0.516,0.59,0.457,0.536,0.324,0.34,0.335,0.332,0.355,0.359,0.34,0.345,0.353,0.366,0.357,0.393,0.424,0.653,0.66,0.514,0.629,0.582,0.518,0.39,0.327,0.335,0.322,0.319,0.338,0.334,0.33,0.327,0.474,0.391,0.406,0.399,0.399,0.36,0.344,0.448,0.487,0.542,0.434,0.473,0.315,0.33,0.323,0.26,0.337,0.341,0.352,0.341,0.414,0.36,0.393,0.375,0.488,0.395,0.448,0.521,0.479,0.449,0.581,0.41],"mean":[0.313,0.343,0.403,0.464,0.388,0.303,0.337,0.374,0.462,0.491,0.309,0.335,0.416,0.45,0.525,0.333,0.35,0.367,0.563,0.53,0.326,0.332,0.417,0.388,0.484,0.307,0.343,0.386,0.463,0.48],"sd":[0.03,0.006,0.026,0.044,0.011,0.037,0.006,0.017,0.1,0.03,0.018,0.003,0.044,0.034,0.055,0.007,0.009,0.018,0.114,0.104,0.007,0.005,0.038,0.046,0.045,0.032,0.006,0.023,0.054,0.073],"n":[4,4,4,4,4,4,4,4,4,4,4,4,4,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],"line":{"byFert":[[0.382,0.428,0.57],[0.393,0.389,0.946],[0.405,0.396,0.978]],"byGroup":[[0.313,0.333,0.686],[0.343,0.35,0.306],[0.403,0.367,0.114],[0.464,0.563,0.2],[0.388,0.53,0.114],[0.303,0.326,0.245],[0.337,0.332,0.2],[0.374,0.417,0.042],[0.462,0.388,0.2],[0.491,0.484,0.886],[0.309,0.307,0.661],[0.335,0.343,0.058],[0.416,0.386,0.384],[0.45,0.463,0.857],[0.525,0.48,0.343]]},"fertP":0.773607}},"phyla":{"names":["Proteobacteria","Actinobacteriota","Acidobacteriota","Verrucomicrobiota","Chloroflexi","Gemmatimonadota","Crenarchaeota","Firmicutes","Bacteroidota","Planctomycetota","Myxococcota","Armatimonadota","Other","Unassigned"],"kinds":[18936,14285,11730,3413,7392,3391,311,4285,1834,5462,3803,1219,8682,15373],"share":[21.55,20.43,16.21,6.6,6.51,6.36,4.51,3.35,2.76,2.45,2.05,0.9,5.12,1.21],"group":[[19.18,17.51,17.4,7.91,6.63,5.9,5.98,4.33,2.07,2.4,2.36,0.99,5.85,1.5],[20.48,18.58,16.74,7.33,6.69,5.89,5.08,3.77,2.39,2.62,2.35,0.96,6.05,1.07],[19.83,18.9,18.18,7.05,6.89,5.56,4.57,4.23,1.86,2.6,2.4,1.01,6.1,0.82],[21.14,19.4,17.55,6.81,6.48,5.55,4.2,3.21,2.57,2.54,2.36,1.02,5.86,1.32],[20.41,19.08,17.85,7.08,6.38,5.64,4.54,3.09,2.42,2.7,2.42,1.11,6.04,1.24],[22.45,18.28,16.01,6.69,6.57,6.64,5.35,3.6,2.61,2.62,2.01,0.86,5.2,1.12],[22.72,28.25,12.37,6.06,5.39,5.83,4.04,2.39,3.43,2.17,1.53,0.8,4.14,0.87],[22.75,21.69,15.1,6.01,6.18,6.8,4.68,3.41,2.71,2.41,1.9,0.75,4.71,0.9],[22.74,22.61,15.0,5.61,6.62,6.24,4.46,2.71,3.27,2.41,1.86,0.83,4.43,1.2],[21.78,20.42,16.45,6.09,6.75,6.69,4.57,2.52,3.57,2.43,1.95,0.9,4.82,1.05],[22.89,19.98,15.62,6.19,6.4,6.74,3.95,3.41,2.4,2.57,1.96,0.79,4.36,2.75],[22.52,22.78,15.45,7.14,6.25,6.82,3.25,3.06,2.79,2.34,1.7,0.72,4.16,1.03],[22.55,22.19,15.56,5.81,5.91,7.09,3.76,3.36,2.94,2.35,1.85,0.77,4.71,1.15],[22.6,20.5,15.02,5.87,6.23,6.63,4.43,3.45,4.26,2.47,1.89,0.92,4.8,0.92],[21.05,21.29,16.39,6.43,6.69,6.93,4.01,2.45,3.57,2.4,1.91,0.96,4.82,1.11],[19.8,18.87,16.96,7.41,6.47,5.84,5.47,4.57,2.13,2.36,2.26,0.89,5.54,1.44],[19.21,19.12,17.45,7.96,6.88,5.77,4.8,3.76,1.98,2.44,2.41,0.94,5.99,1.28],[19.81,18.82,18.04,7.13,6.7,5.81,4.73,4.35,1.88,2.29,2.49,1.05,6.01,0.89],[19.84,18.94,18.17,7.13,6.8,5.5,4.48,3.53,1.9,2.55,2.45,1.05,6.33,1.33],[19.42,17.94,19.29,7.32,6.5,5.7,5.04,3.54,1.78,2.35,2.45,1.03,6.21,1.4],[23.06,18.49,15.7,6.7,6.52,6.85,5.53,3.61,2.46,2.44,1.81,0.84,4.87,1.12],[23.46,20.27,14.6,6.7,6.33,6.67,4.81,3.37,3.05,2.47,1.75,0.84,4.71,0.97],[22.27,20.7,15.4,6.06,6.47,6.73,4.82,3.7,2.64,2.46,1.91,0.87,5.06,0.91],[23.59,22.49,14.5,5.11,6.78,6.3,4.08,3.0,3.74,2.32,1.81,0.8,4.33,1.17],[21.42,19.42,16.4,6.21,6.77,6.8,4.92,2.59,3.76,2.58,2.08,0.92,5.07,1.05],[22.28,20.06,15.35,6.29,6.6,6.82,3.8,3.62,2.52,2.75,2.09,0.82,4.81,2.19],[22.67,21.08,15.91,7.22,6.51,6.72,3.49,3.41,2.58,2.27,1.78,0.69,4.33,1.34],[22.37,21.32,16.05,6.28,6.36,6.67,3.69,3.29,2.9,2.47,1.95,0.87,4.67,1.12],[21.63,22.85,15.02,5.86,6.53,6.49,4.72,2.61,3.72,2.26,1.83,1.02,4.65,0.8],[20.8,21.01,16.4,6.5,6.99,7.17,4.11,2.63,3.27,2.42,1.8,0.86,4.96,1.08]]},"guilds":{"keys":["aoa","nsp","nsm","nit","mnd"],"names":["Ammonia-oxidising archaea","Nitrosospira","Nitrosomonas","Nitrospira","Uncultured Nitrosomonadaceae"],"roles":["ammonium to nitrite","ammonium to nitrite","ammonium to nitrite","nitrite to nitrate (some do both steps: comammox; 16S cannot tell)","unknown: relatives of Nitrosospira, not known to oxidise ammonia"],"aoa":{"name":"Ammonia-oxidising archaea","kinds":293,"share":4.512,"group":[5.977,5.074,4.568,4.198,4.536,5.35,4.041,4.682,4.459,4.57,3.949,3.247,3.761,4.427,4.007,5.466,4.803,4.725,4.477,5.041,5.532,4.811,4.822,4.075,4.923,3.797,3.487,3.693,4.716,4.113],"sd":[1.118,1.183,0.857,1.01,1.034,0.35,0.842,0.736,0.272,0.836,0.625,0.695,0.551,0.133,0.771,0.602,0.704,0.967,0.974,0.97,0.864,0.662,0.585,0.269,0.535,0.253,0.714,0.512,0.977,0.811],"byFert":[4.887,4.726,3.907],"byLine":[4.457,4.565],"p":{"fert":1.7e-06,"line":0.6,"time":0.1},"rho":{"n2o":0.25,"nh4":-0.26,"no3":-0.14,"ph":0.32}},"nsp":{"name":"Nitrosospira","kinds":12,"share":0.386,"group":[0.238,0.18,0.171,0.244,0.306,0.455,0.522,0.529,0.529,0.468,0.465,0.374,0.42,0.49,0.364,0.205,0.209,0.185,0.239,0.336,0.487,0.558,0.516,0.554,0.443,0.361,0.406,0.438,0.546,0.354],"sd":[0.047,0.016,0.038,0.068,0.049,0.066,0.083,0.11,0.086,0.025,0.089,0.091,0.044,0.145,0.043,0.024,0.006,0.05,0.043,0.136,0.111,0.116,0.113,0.159,0.099,0.058,0.092,0.052,0.063,0.06],"byFert":[0.231,0.506,0.42],"byLine":[0.382,0.389],"p":{"fert":3.6e-17,"line":0.75,"time":0.62},"rho":{"n2o":-0.1,"nh4":0.35,"no3":0.77,"ph":-0.67}},"nsm":{"name":"Nitrosomonas","kinds":7,"share":0.18,"group":[0.157,0.116,0.092,0.18,0.228,0.161,0.18,0.17,0.202,0.182,0.31,0.132,0.202,0.235,0.181,0.14,0.135,0.126,0.163,0.255,0.19,0.179,0.153,0.205,0.165,0.229,0.185,0.239,0.183,0.133],"sd":[0.084,0.056,0.02,0.106,0.117,0.071,0.09,0.082,0.082,0.083,0.172,0.069,0.068,0.139,0.106,0.079,0.051,0.083,0.068,0.067,0.05,0.048,0.065,0.073,0.053,0.059,0.067,0.119,0.098,0.023],"byFert":[0.159,0.179,0.202],"byLine":[0.181,0.179],"p":{"fert":0.13,"line":0.78,"time":0.33},"rho":{"n2o":-0.25,"nh4":0.16,"no3":0.18,"ph":-0.09}},"nit":{"name":"Nitrospira","kinds":631,"share":0.877,"group":[0.944,0.859,0.936,0.841,0.851,0.893,0.646,0.877,0.802,0.833,0.776,0.754,0.859,1.094,1.049,0.908,0.847,0.94,0.908,0.955,0.867,0.756,0.852,0.764,0.889,0.815,0.806,0.897,1.088,1.068],"sd":[0.066,0.054,0.057,0.089,0.101,0.044,0.176,0.091,0.069,0.051,0.058,0.12,0.13,0.013,0.037,0.038,0.103,0.093,0.037,0.044,0.048,0.086,0.057,0.072,0.058,0.033,0.085,0.029,0.118,0.088],"byFert":[0.899,0.818,0.916],"byLine":[0.864,0.891],"p":{"fert":0.00046,"line":0.33,"time":0.00017},"rho":{"n2o":-0.14,"nh4":-0.42,"no3":-0.13,"ph":0.39}},"mnd":{"name":"Uncultured Nitrosomonadaceae","kinds":1345,"share":4.141,"group":[4.102,4.022,4.174,4.451,4.502,3.825,3.071,4.097,4.369,4.542,3.897,3.926,4.196,4.037,4.458,3.982,4.223,4.352,4.46,4.593,3.909,3.696,4.034,4.289,4.737,3.693,4.137,4.12,4.112,4.19],"sd":[0.251,0.235,0.152,0.414,0.261,0.237,0.774,0.324,0.182,0.342,0.2,0.396,0.342,0.254,0.302,0.221,0.345,0.127,0.203,0.096,0.425,0.238,0.214,0.232,0.335,0.229,0.503,0.22,0.281,0.288],"byFert":[4.286,4.057,4.078],"byLine":[4.113,4.168],"p":{"fert":0.017,"line":0.76,"time":9.4e-09},"rho":{"n2o":-0.2,"nh4":-0.49,"no3":-0.31,"ph":0.53}},"aoa1c":{"kinds":42,"share":0.031,"note":"Group 1.1c archaea (inside the class of the ammonia-oxidising archaea): not known to oxidise ammonia"},"nob":{"kinds":32,"share":0.0035,"note":"Nitrobacter and Nitrolancea, the other nitrite oxidisers: almost absent"}},"cloud":{"n":20000,"of":100116,"seed":7,"abRange":[-8.0,-1.0],"rank":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQICAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAQIBAQEBAQECAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAgEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQIBAQECAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAgEBAwIBAQECAgECAQIBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgIBAQEBAQEBAgEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAgEBAQEBAQEBAQICAQEBAQIBAQEBAQECAQEBAQEBAQIBAQIBAQEBAQEBAQEBAQIBAQEBAgEBAQIBAgEBAwEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAgEBAQEBAgEBAQEBAQECAQEBAQEBAgEDAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQECAQEBAgEBAQIBAQEBAQECAQEBAgEBAQEBAQECAQEBAQEBAQEBAQEBAgEBAwEBAQEBAQEBAQEBAQQBAQEBAQEBAQEBAQIBAgECAQEBAQEBAQEBAQEBAQEBAgEBAwEDAQEBAQEBAwIBAQIBAQEBAQEBAQEBAQECAgEBAQEBAgEBAQECAQIBAQEBAgEBAQEBAgEBAQECAQEBAQEBAQEBAQEEAgEDAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEDAQEBAQIBAgEBAQECAQECAQICAQIBAQEBAQEBAQIBAQEBAQIBAQIBAgEDAQEBAQECAQIBAQEBAQECAQEBAQEDAQEBAQEBAQEBAQEBAQEDAQEBAQECAQEBAQEBAgIBAwEBAQIBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQIBAQECAwIBAQIBAQEBAQEEAQICAwEBAQEBAwECAgEBAQEBAQEBAQQBAQEDAQEBAQEBAQECAQEBAQICAgEEAQEEAQEBAQEBAQEBAQIBAgEBAQICAQECAQECAgEBAQECAwUBAgIBAQMBAQECAQEBAQEBAQEBAQMBAQECAQIBAQEBAwICAQIBAgIBAQEBAQEBAQECAgECAQEBAwEBAQEBAQECAgEBAQIBAQEBBQEBAQEBAQEBBAEBAQECAQECAQEBAQEBAQEBAQEDAQIBAQIBAQIBAQECAQEDAgEBAQEBAQIDAQEBAQECAQEBAQEEAQEBAwEBAgEBAQEDAQIDAQEBAQEBAQMBAQEBAQEBAwECAQEBAQEBAQEGAwMCAQIBAQIBAQMBAwMBAQMCAgICAgEBAQEBAQEBAQEDAQEBAQEBAQEEAQECAwECAQEBAQICAQEBAgEBAQMEBAMCAQIBAgQBAQEBAQEBAQMBAQUBAQEBAgIFAwEBAwIBAQIBAQEGAQECAgECAQECAQMBBAEBBAEBAQIEAgEEAQIBAQIBAQIBAgIBAwEBAQEBAgMCAgEBAQECAgUBAQMBAQEBAQIBAQICAgYBAgIBAQEBAQEBAQEGAgEBAQEBBAECAQQBAwMBAwEBBQEBAgIBAQEBAgEBAgIBBQICAgQCAQEBBAIEBAECAQIBAwMCAQEBAQIEAgEGAQEBAQECAgEBAQMBAgMEAgICBQEEAQEFAQIBBAEBAQECAgECAwEEAQIDAwECAQIBAQEEAwECAgEBAwEGAgEBAQMFAQEBAQIBAQEDBAMBAQIEAQICAgQCAgIDAgECAQICAgEBAgMCBAEBAgECAQIEAwICAQMBCAEDAgICAgICAwEDAQEGBAMBAgEDAQIBAgEJAwMBAQYBBQEHAgUEAQQBBAYCAgIDAgEBBAECAQQDAQECAwICAQoFAQEDAQEEAgIEAgMCAQIBAgECAwEBAQIFAQECBQEDBwEBAQMCAgkJAgECAQEFBQEDAQIDAQICBgEDAgQBBwECAQEFAQQCAwEEAgQBAgEEAgMBAgECAw8BAQIDAQMBAwECBQMCAQEBAgEBAwEMAQUBAQkCAwEDAwICAQIDAQQCAQMBAQECBQMCAQQEAQQCAwICAQMCAgMDAQMFAwIBAQICAQMBAQYJCAQJBgEDAgEDDwEDAQICAwUEAg0DBQEDAQQFCwEEAQEIBAEBBgMJAwMBAQMEAQMNAQMCAwEEAQwBAwEDBwUHAQQJAgcBBwIBAQMPCAECAgIBAgMHAQEHAgoGAgEDAQIHBAEEAwMIBQQDBAEHAQEJCQECBgUDCQEEAQEBAgECDQ8FAgUFCAECBQsKAwUCDwQDBgECBAIGAQcIAwkBAQ8BBAEDBAUNCQQDAQIBAQEBAgMFCAECAQgFBwoEAwUBAxIPGQkBAQUDARUCAwUCAggCAQcGBQEGAgMUBAEBBAMMEgEDBAoEAgsLAgISAgMCDwMCAQsDAwUFCQwMBwIDBQQDBQMEAgcJDw0CAQgFDw4HBQEMAgINBAgGAhAGBQgCAQkBCQkPBg4LEAcUBAIGBQEBAQ8PBAEGECUIAwMDAQILAR8BBwIZBgIEBAIGAQ8BBwYBAgoCBQQPBgMCBQIHCQMLBwcCAgIGAQUEAgYDBAIBBQEGBAEJCgMDAQYECwcBFgENAQIBAQYBAQMGDQoEAQ4DCAIEBBAGAgUNFAcNAQMBEwEFAgEJCgoFBwIEFg0GDBYODQcDDAgFAQgGEgUECA8EAQMECAEBBAUGARcZCQYBBwUBBAMCAwwBAgQGHAUFBgsKBAUCAQICDQUBBAoEBAIBDBEJAgEHBwYMAQUBBgUCCgcDBwEFDwUBAgQBAwECBQEIKAIMAQoCAQwBBA8CAQYHAQcDAQICBRAFAQ0IFAIDJwMEBw8FCQUCAgEHBQEDBAMLEAENAg0DAQMHBwEBAQINAQYBAwEICAcIDwYLBQEDEwMCEgUFAwECDRADDhQBBgQHAgkDBQUBAwUDAQgBBAIDAwEBAQQDAgkDCgMBEAQBCw4HAwEMAwoBBQIDBwUGBgYBAQQDCAcIAQENAQYBAQoECQEJBAsFAQMFBAoBBAUBAQECAggFAgcEBgIIAQECAgEDCQgCAggDCAEEAgcDBQQEDgEBAQMOAwsGAgYBCQEEARAKAgQGAQ4NBwMCAQoDBAQBAhIBBAcNAgYCFAoNCQYGAwMCAgccAQYEAQUGBQoEBgEJDgMQBBkKBwQBAwIFAgEBAQwBBwQFEAQDDAIGCQEBBQICBgMHAQEFAgQCDwMGCgkCAhABAwIBAgEHCQUCBAYNBwEEAQIEAQEDAwoNBAUGBwMGAQUIAw8FARADBQ8CAgQCCwEEAQ4EAQsSDQELAQQLDAICBAEBAwUBEQICAgYEAQYBBgIBGwgBAwEEBAEHIQEBEQYBAxQLBgIFAQEFAQEMBwUECgMGBwEDBQ0BCgkBCAIIAgEDAwEBDwMCDQEMBQoFAQcTAQEDAQEBBQIIBQMJAQQNAwQEAgIDCgEJAwICAQIUBAEFAQkCEAYHBAEEAgQCBgcBEQ4GAQgDDAQGBgICBwIDCAUDBQYECgoDDAMCAQIMAQIBCAMGAgoCCQUDDwECAgEDDwMDAQoDAgkCARQDCAgCAgUCBgIBCAIGAQUMBwEDAgcEAgMBBAUEBhUFCwYJAQEDBQYEAgsFBwQCAQEHAQcFBQQOCQIHBBACAQUCDRECCQUGAQkEBwUEAQIDBQcEAQEDDwEBEwMFAQ0MBAIDBAQEAwEBBhEEBQMCAQkpAQICAQQBDQMDAwQEAQcNARABBwILCwEGCwcCAQ4CBAIDAgUKAwICBwMKBAcEBAMBCgQBCQICBQwBAREDDAEQBQ0CAQwPBAICEQESBRQNAQMYDAsCDgENBwEEBwMCBAUDBggEBAYEAQIDAwcEAgEMBQEHAgYEBQQCBAMDCAUDDAMCAQ0BBwgEBwYEAQIEAwcFAQgBBAIFAwcBAgsBAwEMCQIYAgECAgIBCAIQAQMNBwQHCAQCBwEGAwcCCQMcAQIDGg8CDAMGAQEDAwQGAgUHDgcaFwgMGAIIAwEEEgsIAgMEAQ0FAgcGCAUHBhgEEQsBAgIBFwoGAwQOBgcBBw0BBQEDFwICAwoCAQIBCAsMCQQBBgYCBQIBCQIFBRIGDxADGgEDAQYGAxMBDgsCBAsBAwMKGgEFEwIJBgQBDgUEAwsHCQcCBAYMAQEDAwMKAgEDBQsHBAQBBAYCBAIFCQcBAQYIAQsGBQIFAQoCBAYBBAIBCgEFAgEVFAkDAwQICgEBAQkBBgMBAQYGAhkGDAoCAgQMAgwEAQIBIgsEAwIMAQYOAQQDBQIEBwQQAQEEDAEKCAwCBQ8DAwQCAgEXBgkGEAoBBQgDAQIDAwsFChALCQIGBggFAQUDDAEBAQMBBAcBAQcMBxECBQgCDwcDAgMICwEOCA4CAQcEBQ4BBQUFAQUHCQEEFwEBDAUDBAYDARsECAYJAgUDAgEJBAcJAgEGCAEEAQUEAgEFCAkCBhEiAwYGAwINBQEEAQEEBAIECg0DEgIGIRQDBwIEBAEHAwwEBwIFDgYDDg8CBgcHBxADAwUCAgEFAggGBgECAgQRCgICAwMEAgMLAQMKAgQFBAYJAgUBBgIJBAQBCQICBggGAgMCBgIFAgQGAw4DBgQHCgEEAwwIAgIFCgEBDAIDAQMBBQMCCwEGAgIOBwQOBQ0EDQUCAQIBAwEEBgEJBAcJAxEDCwQCAwEGAQcHBQMEBgEBAhUJCAQaAQEBBg4DDwgYAwUECQkEDBMFAQ0BBhgEBQUDAwYBBAEQAhcCAQkFAQQBAQMECQUGBxICAwYGBwIKBRkIAQEHBg4BBAMBBQMGBQUBBgcdAwQCAgoCHAQIAxESDhMFAgIJAQIEAgEGDAUBDwMBAwwHBQwHAQMYBAwFAgIMAQECAg4JAgEBCAQFAwQFAQYCBAUFBQQCAgkBBgMDCgMDAhMHAgMBAwgBCAYGAQ4BCwkBBAIBAQcEAQYJAQYLAQkBBQEUBgIUAgEFBAQRAgECEwgCDwQOCAIGCwUGBwIIBAMFAQcIAgEBAQQLAQkGBQgNEwECAwwBAQYCAgQDBAIEAgEKCAgBCAwPCQsGAgQBAwcBAQICAgcJDAISCQgKBggFCwYDAgMMBQMDAggKBAIFFAUKCAMNAgIBBgYKCwQJAgEEGwEJCAMEAQ4LAQMPAgEEBAEGAQYFAgYNBQQDCQIEAQcKAwYEAQYDAwMCAQQGAgwBAgUDBAEEAQMHCAgWBAMCCgEHAwISAQsMAgMJDwwEAwEBAQIIBwUFBAIFBQYECQMBCQ8EAQcCAwEDBQIICwYDBQUDDAsBCRACBggFCAwUGhoFBQEGAQMKAgkHDQYTAgwMAQIBAQEFBwEBAwIFAwQHBQUBBg0FCAIEAwIDAgIFBgEGBAMEBQcEAQEFCQUOBgMBCgYFAwUEDQYGDAUFBwICGQICAgsKBQEECgEECQQEBQQMDBEHBQQCBgQBBAIDAwIKCgQDFwYEAgEBDAMMAggFDAgDAwEBBAQNCQEEAwIDAQQMBQMDCgMGBQQGAQgDBgoGAwIEAgUJCggLAwcBBwMEAwoaBQICAQcCAQIEAwEDBBUIFAISBQEGAgUBAgEBAgMJBgUFBAYEEAQSCAQLBQEFAgEJDAQEBAsEAgQMBgIDAQkmAgECAgsbAgcDBgEFAQUDBAQEBQgBEA8DBwIHBQEKARcDDwYGAQgKBRsDAQQBAgMGAQMCAggFAgIBBhEEAQcDAgMIAQUBCQkKBAMGBhUBDAMBDQkEBwkFAgYEAgECAgkBBwMGCQYCAQcDAgUEBQ4BAQEEDhQDAgQFBgEECQEOAQQGBwgRFQEGAQQDBQsFAwcECQgNAggBDgECCwQBCwEIEAEHAQIFBwEBAhIFBwEDAwIEAQEHCAMOEAECBAgJCQQEBAIICQEKAwEHBAIEBw4EBggBAwUFAgcBBQsEAwQCAgEFEwIBBAUFAwMBBQMMBQUDCQgBDwsDAQMEAwMBBgQPASAWAg8DAQYBBwQCBAgDBQQLCgENDgIHAQcBDAIDAwMDCQYCBgYBAQEBBAsCAQwBBQMHCQIEAwYDDQoPDQ0EBQIECQUCAgEDAgcCBgQBEgQCAQQBAxoBAQwKBgIBCQICBQMCAgMDAQQDEAgBAwUCBgMFEAoEAwIHAQ0GCAEFAQQDAwIDAwIBAQQDBQICAQMMBgEEAQ4JBgIEBQsIAgwEAQMGAQMCBAERAQQHAgEIAgMBBAcHCQMBCgIJAwUHCQIGFAIDAgkDAQMLBgsFDwUBAwMQCQcDAQgQAgcGAQ8BDQgIAQgBCAEDAwMBAwEFBAcKAwIBAQUGCAoGEQgCBgsEAg4EAgYSAxkGDAENAwMIBgIFBQIOAQECBAMHARAYHRMFAwcGAwMGAQ4DCwUBAgsFBg8HAQYICAoPBAsLEggEBgEICwQBBQIGAQsFCAMBBQYBBwMBBQQMAQkHAwYHFAUFBgIDCQcCAQgTAwECBwYBBQIDCAIEAgECBQMMAQECAgUBDQQCCwcLBAEEAwkFBgIBAQYKBAgBBwUBCAcCBAMBBAQBBgUNBQ4IBAQLBgIDAgEEAgYDDQoECAIBAQkCGAYCAgMDBAETAgwDDgkFAwQBDQ0FAgYFAwYFCwMDAQ8JAgEEAwQGCQYCAgoBAwUCAgEDCAIDDQkECQIBBgMDAQkCAQIJDAgBAwIBBggJBwIGARACAQMBBgEDBQQHEwMEBAMGAQcBCgYSCQMKAwgBBBIPBQIDBgQBCwQCBQkBAgQCAwQDAwUBBgEGAQQEBwQBAxAEBAQDBwoDAwMFAwQCBQgBCQEKBwICCBAHAgEDAwgUCgEHBQEEBgEKAgQDBxINDAMBCwIQFAEGBgUCAQIOBQMBAwgNAQQDCgUJBQoDAgcDAhMEAQkJBAEBAwgEARoGAgQDAgMCAQEBDAEBCAQGBwEFAgUMCQcRBg0CBQETCw0BBQEGBAEFCQICCQEMAgEHBQYDAwEFBAcHCQIEAQEBCAIEAwIBBwMFAQECIhwJBgIIDAkBBAgEBAYHAwUBAwECBQIDBAECBQQJAwgNCA8BBgUIEAgGAwMBBwcGBAEGBAYMEAwHAg8FDQMKAQQFAgENDQgBAwEMBgMCAgUJBQkLAgsDBAgGBAQZAgIBAQUHAwUFAQUBAxEHCg0CBQoGBAIHAwMEBAEYAQIHBAgHHAMKAQoEAgcEAQ0EBQUEAgQHAgMBAwgJBQMCARMBAgkEAwoBAgMGBwMFCA8GAwkGAgMGAQcFBgIDAgEBBAIFAwIDAwwHAgEGAQIHBg0CBgUGDQUCAgIEAgcGDgwDAggLAgELEAUCBAEKAgUCFQIEAQsBAgwIAgEHBwcJEgISBQIFAwwBAQIKAQURBAETAgIEAwQBAwQEBwUCFAQUBggDAwEECAEGAhkDAwcIAQcIAgEGAgMCDQEMBQoIAw0IAgUDAQMDBQ0OBA4FBQwMBQYBAQECAQEBAQoMBQoDBAMKAQQHBQkCCQECCQ0aAwwFAwECBA0DBAIBDQIBBQcBAwYBAwcDCw0EBQUDAQcCBQcOAwUBAgITAQMJBgESAQEGFQYCARAKARcBAQgJEwQBBwMIHQUCAwQBAgUJFQEUEgwBAiIBAQEBDAQJBAIEBAEDAQEDBAYCCAUJAQYHDgUBAwEHBgYHAQIJAQQLDQgBAQoBBwIDDAUBAwYEAwoEAwYBDgQCDAcHDgQBAQMQBwcEAgoEDQIOBwYHEAEEAgMGDgINCgIBAQgBCgEIAgIBGgULCwIDBAoGBwoOBAIJAgIBCAMBDQEMAQQHBgQBAQEBBxQBAwEECQkEAwUKAwULAQMGBR0HBAIJBgQCAQMDCAYEBQEDCQEGAQcHAgEDEAkHCAMBBQ4NBAEMAwEKCwMSAgEFBQoCCwEFBwYDAQgDAgUZBQMCBgIEBwMFAgEFARcBAwMBBAMWCRAFBQUCAgQBAgYGCwIIBgMSAggHGgkBAgIDCQQIBQoMCgQBAwQDBAEDCgIJAgcBDAYOEQIBAhANARAKAwYJAgcSARMBDgMBAQUJCQEJAgUCAQMJAgkBCQYSAgMDARADDAEDAQQDAQIFAgsDAwIFBQgDAwMJAQsPBAEHAQIBBgQXBQcECAIBAQcCAgMHAgQCAQgLAQIDCRIEBAcKAgEGAgkPAgEDAQYDAQUBAQIDAgwIBgcDCAkBBAICAwENBAUCCAcDAwQFAQgDAQIBAwIBBAEGAQIGAgoDAQgGBgICAhABAQIIBBMGCAoNAQIJAgsEAQMBCgMTFAcFBAkMBAUJBQIDGQoBEQwIBAYDCAkDAQYFDAQIAQIBBAQBBgEDBgYFBhIFAgkFBgEFAQUGCwQBCQIEBAEVBQYJCAUNBgQNBA0KBAEEFA0CAQcFBgQIAw0BAQEEAQYTBgIBBQIICRABFg8FAQMCDAIECwIDAQYEAgUJBQEHHhgGEgQCDQQBAwoREgQJCgYIAQIGEwMJCwEGAgIIBQcIAgEFEAQEAwwCBAUDBQMGAQEGBAIFAgIDDgcJBwQBAwEBAwQGAwIBBwIKDAkBDgIBEwcBAhILEAIGDAEWAQMDAwkCEAEDAgUCAgEEAQEBAgQHBgICBQUKAgMCBwIGAQQHAQ0EAwULCAcDBAcCAwYCBwIFAw8LAwEFBAMDDAQBBAMFAQMECQUDBwIGAQ0ECQMHBgcKBQIBAwIKAwsBAgMFBQMEAgkCBQkCCQ8KAREDBgECAhgIDAEFAQYIAQIRAQsFBwkDBAQECAEGDAESCAMBBQMJAwUGBAEBBwYGDQIPBQEDBAIDCQ4GAgIBBQIBCwYLBgQBAQgKDxEQAQEDAiYUHgENAwICAwcBAQUEAQcDAgIDAwEHAQQFBAEFDAUEAgEBBAUUCQsDAgkGAQ4DBAUHAgIHAgQBAwwCBwICBQQNAwMUBgUHCwQKAgIBDRcCAQUEAwEBCgoJDgQCCwMHARAEBgMCBwEEAQEFAQIiAxEGBgQHBQIFAw0BFgQPBgsCAwIBDwQNAQEEAgkBBAEIBwIFBxQBCwIFAwQBBAICAQECAgcDBAMICQ0FAQEBAgMDBQUBBgUDBAQCAwEIBQUQGwwHCgUBBQ8DCQcLCREFAQ4GEAMJDQgHAQIPBwEBAQwNCwcDEAQMAxIDFAEJCQIJBwUDBQUBDAQHBQQYAgEBCAYIBQYCBgEEAQsCCgELAgYFBgIXBgQBBAwDDgEIGAEDAwEUAQ0DAwECAgYBBAIIAgEHAgsBBQ0MAQcEAQEBAgMIAwENAwgQFwgFCQgIAQcBCQIPAgceAwQBAwINDQECBAcBEQ4BEwILAQQEASYBAgcBAwIDBQELAgUICRgPEQMEBQQBAQEKBwQBAQgKAhICEgIDBgUEAwIBAwMCAgQFDwMGBAcCAQ4DBwEGDAcJARsGHAIHAQQFBAMMAQgFCwUPBAEBCgoEAgIBAQEDEAINAwIFAQQDAQMEAgICAQQDAwIBCgEBCwMJARgFBAoVDwsDAQEGBAIHAQIBFwIEAgQCCgoRAgYBCBgbBAUCAgIGDQIEAgQFBAYYAQMeAgsIAwMBAQICBgQBCAsFDQsBCgICBAEOBwYFDwgOAQMPCwEDAwIEBA0FFgQGAgIEAQkBCAsDAwIHCgECBQMjBQYDBAMDCRMDAgkCAgMFBggLAQQBAwEEAgECBAIDAwcBAg4EAwIKAg8CAgIBBAEBAhMCBQEFAgEGAgICCggDAg4EBAECAQMIAQEICwQKDwoBAgYLAwcDAwIGGAIFBAESAQgICAQEEgQBCAgNCAYFAQwCCAMHAQoGDAcECQEDAw0EAgMICAIEBwERDg0DAQYEDgECBB4NBAcHEQEEAgQECQ0KAQIOBw8IAhABAgQBAwgNBAgDBQQDAgQFBgEEAQMEAQUDCQEPAQECBAkGBgYFBQoCCAYFGQIBAhcFBAUCDQIEAwMCCgMUAgUIBwMDBwECDQIFEBACAQYJBgEJAgYCBAgCCAMECAILAgEDAw0JAQUGBQIEAgUBCQYDAgoIEgQCCQsUAxIBBgkEHAUFEQgKBQEKAQsBAQEPAgYCBQEBAQMHBwEBAwkEAQkCAQUBBw0LAQEIAwUDAQcCAQMDBgMPAwMEDAEEDAEDDAQCBgIMAwoCBQQDCQEDCQIIBQIEAQMWAgEBDQECDAcDBgEOBAIBHwoDDQwBAwEEAwICCwkDAQwGAgQDBAIBBQYGAQoBAQkPAgcEAwYKCAIBBQMDAgcBBQICCwkBAwIBAQsHAgkBAg0DAwEDDAUEAgMBBAMBAQEBBAIBAgQWCgUSDQ0DBAgIBAEFBwEGBAYCBAYJAwIJAQIDDQwCBQ8DAQMIAwEHEQUJAgMMAgEDEAMCAwEDAQMHBxEBAQcKAQoBAgICBgYEBwEPAgoCBgIEBgQFBwUBCwECAwQEAQwFCgIDEQ4GBwUDBAkFAwsCAwICCAICAQwCBQIEBQICBQEDAgUJEQgBBAIDDwYCAQQDBQEHAwUIAQEDBBcFBg4BDQMDCgEDARQDBAEFAwYFARgEAwgIAgYBBgIPBAgDCgcPAwcBBwQGAggHDwQBAQMCDwIJAhMCBBEEEAELAgcCAQMCCgIBAwEDCgICBwQBCwcBAgMFBggPAgMCAgIFAwQBAgcEAxIBBQYHBgEHCAMCAQMDBwcHAQUEAwsBAQYLAwIBCQIDAgIBBQQCBAcCCAETAhgICgcHCA8GBAwFAwEBBQcCCwEBAgMGAwsDCQEPAQkBAgwCFAEDAQEBExMCAwUBBgsCAgwDBAIBCgMFCA8CBAICAxQHBAYEFgYJAgUGAgQCAgwEAwIEBgYYBAEKBwEEBQMKAQEFBgIICQ4BCBABAwIDAwEEAQcGBAMPCgMDAgIGBAwHCRACAQMLAwQCBQoDAgEGCA4FCAIJAgMRBwgCEwICBgQgAQwGAQEEBwMSAxEKAwEaAgICBAkCAQYNDAUGAQoBAw0BAwECBQUMAwEKDwEKCAQJAwcKGAELFAEDAQQECAwCAgcCAwYPBwYIAwIFCQURBAIFCQUCAwYCAgMEGAQFAQMBBw8CBgILCgQCCAYIBQIFCwYNAwgGARABAQYPBAMJAwIDBxANAw4GBQEBCQQHBwoLCQgBBg8FAQEBAwIBAwEJAwsHBAYLCQEHAgIHAgESBg0BCgMBCAQIAQYKEgICAQUEEAUHCAEIDAkCAQEFDAkBBQoDBwsHAgIDAgUDBwIDAQUBAgYJBAUIAQISBgELAwEBARkGAgYGAwEBBAcDBxUDBwIBCwUKBwIEAQEJDgkDCAcBAwEFBgMCCAMBAQIHCAUEAQYIAgkQBwIBCgYBCQkMAgIpBQEIEQICBAIFDQYGAg4RAQIDAgYBAQIJBwIOAgMEAQMCAQECAgUBAQYBAQIEIAUBAgMEAQUECQICBQEBAgsFFQYKCAQGDwYFCgMDBgIEBAUBAw0KAQQOCQIJDAcLBAkJBQUHAQQEDQMZBAoFCBUGAgECAgIKAxMJBAYEAgEDAQoDCgUGAgsBAgcCAggUBhkFBgQBAQsgCwgGBwQCAwQGAwYEAgQDCwIDBwMHAQIEAwwDAwQHBAQGAQUJCQsSAQEBEgIDCA4GCwMEBA8CAQMGAwsHDAcFAQUBAwMCBQINBQsRAgcCAQYCCQEBAQoHBgMNCQYEBQMQAgEBAQMCAwMFCAMDAwMKIQENDQYHAgcHAQUCBAgRAwcCAgMBBgkEAQEBCgQLAQEHAwUDEwIIFRIDARITBQ0CAwMOCgEEAQYMBAUFCQEFAgQFBgECAwoDAQYXCgwCAgoFCwkKAhcMAgIBAxADAgECCQIGBAUHCwIRAwICDwERBAsFBQIOAQcMARQDAQcBAgoEEgUBAQUCBgMFAQQCAQMFBQkGCwUFBA8HBAEGCgQBFwQKBAEKBgcGAgEDCgcDFggBBAYHBAMBCgcBBwEBAgEBBQoGBAMEBQoDDAoBCRABAQMGAQkHBRIBBwMQAQEBAwYFAQsBARQHBgYFAwEIAgoMCQMGCAEMBwYCAxMFAQEJBQkPBAQPAwIEBw4HCxMIAQQDHAEIAwEBDwMFCgMIAgkFBgoBAgMDAQ8CAwkOBwEDCgQEBAECBgEIAwgLAgQGCAgFAgMBAQYCBwYEBgUSAQYHBAEDEAEDDwEEAQ0CDQEBDgEEAwICCQUEBgsBBQECCQUCCgIHCQ4TBAwGCAkFBQUDCA0GAQQGAwEEDwMGARMBAQECCgUHAQYLAgEDAgMCAgQJBQgLDgIBAgIIBgUBAQ0DAgUMAwICAQEDCgEBBwsDAgMBCwIEAwEDBBcEAgUBAgIFCAMCBAIKBwEBAQMIBQIBEA4DCAEBBwkBDAYHAQELBAQDBxQLBAwYBAEBAgIBBQUCAwECAwQBAwcMAgEJBgQEBBMLAggJAQYBAQMGBA4HBgUJCAEEAQcBAwIDCQIIAQUKDwYFAQEBAwgJAwIGAwoBAxIFDwQIEgMQAwIBCw4FBQEDAQUDAgECCQYBAQUBARUIBAIBAQYBDQEFDAQGDAQGAQEBAQgECQUCGgEBAQQDAgUCBQcSAQMCAQUHBgIFBAoCBgQEDAIDDQoCAQMCDwQTBAEHCAYBBAYFBxIIAgEFAgsSBgkEEQICBQIMBQICGAEFBgMCCQoCAQkPCgIPBwIMDg0aDQQDAgcDDAgGBR4CGwUCAQ0GBwIIBhEBBwsPBQYEBgEDAgMDCgUGBgIIAwERAwcBAgUBAwEFAgEDAwgIAwYKAwwDBBMBBggBAgQBAgMBEQYDBwMFAQsBCgYKAgMECQcBBAMEBQMIAwEEAwMMBgYBBAoECAIBBQIBBQUNCQgCAgMHBAYMAwECAgcBBgYDAwkNBQEEAggDAwUDAgQNBQEOAwEEBQIDDAUCAQEGCQMDCQEJAwcGBAISAQEKAQwBBAcMDRcJCgQBExAHBQUCAQEDBQIBGgIKAwEMCQQEAQENAgYGCwINBgMBAQ4IAQQEBgYBAwcMAQYHBwQJAwkCAwYFDwUBAQUCAQEGBAQFBgEBAQECCwIDAwQECgIEAwIBFQUBAwIFAgUPBAUXBAMDDA8FAQMEBgECBQEBBBkDCQIEBQcGCAIFAgcSAQEIDQIFBwINCQEIAQEBAQIBEgMBAQIBBwEECR8NIgkCDwMEDAEFCxAHAgUDDgIJAwUQBQISAgIjCwIDDwICEgIBBwsNDAUBBgEDBQIGCwECAwUEAgIGAQEEAxgBAwIGAgMJAgUKAQMCEAoCEgMBAQ8GBBIUAQUDDQMDAwIHGQEFBQoBBwUFBQYKAg0BBgUDAQICAQgHFgUFAQECCw0MAQMRBgEEAgMBBgsDDQESCAUCAgwJAgQCEwcCBAIBAQcFAwYCCQUBBgINAwIBAQUDBAEBAQEFAwYMCgEGCwMBAgYBBAIJFSIIAwUEAwoMAgcBCQEIBQ0EBAQCAQEFAQINBgIGAwgEAwQHBAECAwcBBQYDBwQIAwMKHQQJBQILAgMHBgECEAQBAwMDAhUCAQQCBQEEAwQEBwYCAQUCBQwIAwQQCA8EAwIEAQEBAQYBBQEIAQoJAgcEAQUBBQIKAwMPBwMFFRQFDAQFAwgDAQoBBgIBAQkCDA8GAgQDBg0LCAQEAQMDAwkECQEGBAwCCwMGBAUCCQoDBAECAwQUBAMICwgCDwcCGwIBCgEBAwIDBgICAwEKFwEEAwgYAQYCBwQFEgkBAQYXBREDDwoGGREGCggFDwQDAgIBBAMCCwYQBAYIBAEBAgUKEAwLAwYHBAMBAQUGAQcDCwUBBRMEAwQVAwMOAgsHBQEEAQENAQEBBQcFAgEJAQkJAwIEBgULBAQMAwQBBgEFBQUBBgMCAgQGFwYNAQMDAQEHBwoCCAMCAhUBBwYPAwUBCQQFBAcSBAcGBwYDBQYECAUCAgoDCgEBBgUEAwMCDQoCAgUMEwEMAQELAwIDBwYBAgIFAQoFAgQBBAEBAQEGDQYBAgIPEQoVBwgKCAQBDwcGBQIHBQsEBwQBAwgCCQUEEwoEBQECAwMBBggBAgIDAwQKCQEGJAsCAgUBCQIEDwQCAQMFCQIaAwMLAQQIAwQEAgQGBQUFBwUBBwEDEgMVAggEAgYEAgEDDQMBBwMJBgUMBAIMBAECEQEHDQMBCAUBBgIJCgsQBQoLBQUMAgoTAQUJAQQBDAQFAQIGBwEIAwMNAQIBCgUEAwMDAwMBCQYKAQQMAwUCCQUBDAEBAQEFAQUJAQEIAgMCDAQQBwEEAgYDAxMEBwQBAgQJAwIBBQ0cBgMHAQwBBwIJAxENCgIDAwQCAwgGHgEBAQ8HBggMAgQdBCEDBQYBCgYDFQ4GAQMDFgMDFwgPAQIFEgMCAgcCBAcCBAICDwQBCwQCAwYEAQMCCAMBAwIGAQkCCgEECREBAwMECwIBBwEEBQMMCwwFAQUHCAQCDhQCBgQECg0HCgELAQQMAwcGAwMPAgMOAgEKBwMHAwUBAQICBQEHBQENBQEDAQwCAwEkAgIIAgMCCAYKBAMDAQEMBwEDBxQBCQIDBgoBBAYHAwULBgILBQEFBAsBBgQNCAUDBQEGAQ0GCQUSAQUCBRkFAQQCCgwCDAQMCQcJAwsKAQkCBggDBQQBCAgBBgEMCwYSCgQCBgMEAQQBBAIDAQUCBAIFEQUGAwICAQ4GAQ0JAhMICAICAgsCAhQJBAMEGQIGBAQGDAMFBgEBBQYMBgkMAQcDBQQMAQMaCxUIBAsBDgIBAQMHBQcIAwICCQQFAQUHCgcXAggKCQMOBwMDBQwEAwMCBgEBAgMCFAYCAQIQAhoBAgEDAgIOBAQPCAEHCQMMFAEKAgUCAgIIBQsCAgUQAgYDCQEJDgoEBhIDBAYEAgEIAwcGBAEBCgIGFAMFCQsDAwIFAQUDBQITBgQHBQIGEAIBCQgDDwkCCA4CBgMCBgIQBAICBQMFBg8CAQYDAQUjDQYFBwUBDgQDBwEBDAcFBwEDAwQGCAIPEQQSAwUECQcCBQgBDgMKAgcPAQ8REAgDDAgJBxwCBwMNBwIDAgEKBQYEAQECAQ4HCgYQAQIEEwsLAQUEAwEOBgMLBA8CBAYCAgIIAQUQAQ4BAgwDAQIBAgkEBAcCBgEFAQYHCgkEBgIBAgIQBAQFAQEEDQQBAQICDgYLAgQIAxcHAQEJBwIECwEGFQIBEwEHAhIDAgwCBwQOBAEIAgEDEQgSAwEMAwcDEQEEBgQDAwUPAg4BAxMYAQgLBgcCAwkHBggFAwUPBwMECwQNAw0CAgoBAgMDAwsBAgIQAQIHCQUIAwoHEgIDCAECCwkBAQEBAwwFGQQBBQsEBQQfBwkBAggGBAUeDAQPGBoBCQEMBwYBBgIBBAgQBQgHGwUECAUCFQEKAgIIAQUEFQgGAwMGBAEBBwIEAw4FAgcBBAMOBRQJBgoIBQEBAQEMEgYBCAEJBgMFAQwaAg0CBggCEw4FAQcHBwEXBg8CBgUQCwQHDAUDBAQGAgUBAQgBBQEBAwQJBgQFCQIKCwIDAwcLBwECBQgIAwENAgIKBAQBAQgDAgEFBQMFDgQLAgsBBA8DAQ8MBA4BAQMGGQIEAgUBAwMCBggBAwQCAQcECgUCBAYDAgUGAgIBAggPCQgPAgMBARICAgIJCgUBDwUFAyUVAQkCDwEMAQsIBwMLAgcQDgEHBxQDAgMBBQcDAQUHBgMBDAcBAQQHMAgEAwMBBR8SBwEBAQEIBwQEBg4JCQIGBgYBBQYOBAEFCQEKDQgNCQUGDgcEBgUBAQ4ZAQIBEAEBDgYBDAICAgYiBgYIBgQBBAcEAQUFAQMNAQIFBQIGBwMJBAUFAQYCAgYCAQcHEgMKAwgFBAMCBg8DAw0GCAICCgEGFwIPAgQHBgkGCBAKCAECAwYZAQEOCQcCCwEHAQIEAQ8PARMEBAYEBQYCBQYCBQsFEwYLChgGBQIEDAMZAgIHAQwOAwQRAQMDBhAaBgQCBwENBRQGAQEBAwEFAgcTCAwCBwIPAw8FCQIKBQECAQERCAMDAQgCBQEEDAsBBBEPAQMCBwMCBAIBAgUGBAEBCAYOAgYBAQweCAQICgoICwEHEgEMAQIDCAEKAgIIEQMEBAUDBQkDAgMBCgIBCgQECQENAggEBwMHBQQICAIHAQIBCAcEBQIJCQEQBw4CHwEGAgcBAgQQIQMCDwYCBAIGEwYBAQwIEAICAwgBBQsHCgEFCwUDAgURAQICAQgBAQMKAQICASUMAgYMBQEDAQYGAgQDCQ0FBQUDAxIKAQEEBQkCCAQCCAYCEwEMAwQGBQEJAwoFAgYBDBMHDQMMBAQLBA0EAgwFBBMBAQIJAQYDBwQDAgIHAQIBAQMBBQcCAQILBQQBCAIECwEBBAkIAgYGAxAEBAMBCgQOCQIOBgEKAgECDgIJAwsCDAMFFQQBAhIKBAwBBgQCBAMBAyYBCAUCBAwBBgYIBA0BAQUCAgEDCAEBAQIIHAIBBgEFBwMBCAERAQkBBgkIAwEEBgYDAQgBBgMGAwMIBwEDARYJAQIDBgEBBAgLAQYEEBkEBQICAwMDDQEBGgIIAQIHASgGAgkCEAwFFAEBBwQCAgEHCBMCEAEGAgMPBBMVBggCAgEGAgECBgoEBAMBBAQEAQICBgEHAQMDAgEIAgEFAQMSDgQCAwwFCxEDDAcIAwEGAwMOEwUGAx8DBQQEAgICEQUBBQQBAgEHAQgFCRgJCwYBCQwDAgcEBAYEAg4DAQsBBwQEAgcBAgIGAwUEBgYEEQMDEhUBAgIEAQQGBAILBAENAgECCgYBCAYBAgIJAgkCDwQGAwcBCAkCAQoBDwsHAQgQAQEBBAIhBQICGRAHBAoEAQEPCwUZAwMJAgoLDAMEAQ0BBgMCAgYDAgEBCAcBAwMCAgEBBwEFAQIBBQ8JAQcIAgUEBwQEBwQFAgQBDgECAQIIAwEMAgEMAwcDBQEEEgQBCAMOBwMBCQsHDwMHCwkEARYKCQIODQcBDggDBQcBBAEBDQUCDAoCEgYGAgEFCwQBAgwGAxMDBAQQAQEHBwwDBwQEBgIEBQQFBgIEBwcDDwQRAQ4DAgICAwUCCQcHBwMCBAMKAwEKCgQBCAQDCAIDBAgMBRUDAwICAScFBAcKAQYCAQsDAQkEBAcBBAMCCA0EBAIFAwUCBwUBBQQKBBIBAQMDBgUCBgYEAgQBBwECARECBAcBBQECAwMDAQoFCAQJBgEGAwUCAwQDAQIDDgEEDAEEAgICAQgDAwkDAwENBSEEBgEDBQIMBgYBDAEGAwYWAQcKBAsFBQgNDAEDAQ8IAwEBBAIEAgEJCwUDCgQFCwUIAgIDDwsDBgIHCQgGAgIPEgESDwUFBAMLAwEEBQUGAwgDAQsICwICAgMCAQgGCAYHBAcCBAMCBQkHBAgBAQQBAQEDAQQFAgYFBAYBEQ4ECQEBAQEJAQIECQcDCAoCAQMCCwMICgQBBgQCAg8GBAQCAwoFCQEBEQMCCREDDgYBDBADAQIGBQcCAxECAwoCAxAHAgQFBQUDBgkRARYFDwIBAgoBAwYMBAoBBAQIAgYSJgIBAgUDBAwCDQQCBwYGAQEDAgEHDw4GBAIFAQQBAwYEAwsCBQ0HCgMGDwQGCQQEAgEGAQgJAQMCBAIHAQQEAQwDAwMJBQECBAkIARYOAQUGAQELAwIIBAIGAgEBCAoBAQoDAgQFAQMGBAIGAQIGAwEBAQMBAh8BAQwBChEBBgsDBQEFAwYCFgkCCRACAgwBAwQHDQQCFgMEFQYBCgQEDgEFCwIDBwgGAQUBAQwGAgMDAgUBAwgFAgoCAQMKCQ8MDgUDAwsFBwoNAgYBBQMFAwYCAwIFBAQBAgIKBQEOBhsHChgECAgFEQgNCRACAwgCBxgBCAIKDwIDBA8EARYBBwMJAgMEAgQRAQgOCggGDgUBBQIBBgEGBQERAQEBAgUCBQYCAQEFAQMCAgEFJgICBgQBBCgCBAoBDBABDAwCBAMJIwEDAwcWBgUFBgEIAwsOBwQBAQIDAQgCAgQCBAcGAgIJBhICEwIHBwoDAggBBAQBAgMCAQIDBgkBHgIBCQMEBQYCBwEEAxUBCwEBDwECBBEEHhYEARUCBAkBAgEDAwUCBQkIBgQKAwEEBAcGBgQBAQMBBQUcAQQGBwQEBAERCA0QAQMBAwoECQgWAwEKAwQDDwEHBwEBBAMBAQYDAgwFAwEBBgICAwIBAgsBAQcKBQQFAQsDBAYFCAQUAQMCDAEFBBkGAgcECwMCBQsNAwMHBQEFBgsIAwYFAwEDBQUIBwMBAg8BEgoDAwULBAEJDgUFBAIKAgMBBAEIBwMCAwYaBwcCBwkICAUNAwUHAQEDAggCARADBAENBAEKARkBEQ8NAQgECQEBAgwEAQgBEBQCBAYGEAEHBgUHCgQBAQMCBCEEAQECBwYEBAcCAQYGARQEBgEIBQELDAEBBBQHCwUDCQQBAwQFBAMLAgcEBAkDAwcCAwkDCgMDAgEDBgIHCAcCAQEMDQIOBg4DBwcLAwMDCgkBAw8LAggQDQMDAQMCDwQWARIBAQ0OBgMDAwcGBA4GCwMJBQERBAYRDA0DBBMMAgIICwMCCgECBgMBAw0DAQ0DAggDCwcDAQIMCQUCBQQGAQcBAgoBCAQYAgMDAQ8ECQ4CAgMDDwkLAQIKAgkNBgQREQYJCAMBBwQGAQIBCQYCEAMCAgIBBgUBAwMFDAMEBQEGAwECCAYDBAYLBA4OAQMDBAILAwQCBAoBCAMCBAsDAwQBAQYHBAQDCQIDAgcBAgIBAQcEBQMRFQIEBQEEAQkDAwUCBQEkAwIGCgQRBQMLAQELAQ8DBgICAQsJCAELDR8BCQIBDAwBCQcGAgYKBQQIAgEJBwIDAQIcBgQICwQPAQgEAQEDBgEBCwMBBA0DBAUKAQICAggJFQIHCwsGAgIBGQMCAwcCAREKBgUFAQoBAgICBAcBCwYIAw0BCwEDBQQCAQIECAcBCgEYAwECAwEBDQIEAQEDAgIDAQQBAQMJAwYEAgkQAgQEAQEIAQkCBAMFAgIBAQkCAQ4DBAUIBA4GBQELDgIBAxkDFggNBAcEAwEEEAEGAwMJAgEBBgoBEgwCAQQlBwYSBAMBBA0ECwMCBwoBAgMDAQQDBwoJCxUDEwYCAwMDBgYDBAUBAgIBBgIJCRUBBAMHAgQYBAIGDwUBBQIEAQECBQYEBAMECwkTBAcLCQILBgUBBgwBAgYDAgcNDwYDAQMCAwsBEQMWAwUCAgUNDwQCCBIEAgMCAwcWAgIPBAMRAgICBAELAgIDAwMDAwQCAgMEDg4NBQYDBAgCCQUBBAEBEwECAQEOCwUFFwIFBwgGAwQEBQQBAQEBBgkBAQgGCwEDEAMFBAgHAQkDBAMEAwgCBwgBAwIBCgUKBAoHBAMCAwECAQISBgELAQUDAgECAQoIAwwCEgMDBQcBBQUDBgIBBwUDAQIGBAUBBwICBAELEQQBDQgCBwcCFwUCAw4HAgUDEAwBAQQMBBEGAwIBAg8TCQQEBQQHCAwDAwIGBwMFBgEBCggBAQMOCgUDBgEHBAMBCAIGAhMBDwELAQMBAwEBCAECCggCAQgXCQUXAgEFAQEHBgMFBAkBBAIBBBABBgQDCwkUAwoSBAMBBgQBAwQBBBUEBAQHAQoIAwIWAgUDAQEUBgQBAwIDCgcEBQcFBAQCAQYNCwIKCwIDAQEIBAEDAwYDAwIHAgQFBAYBCQIBDggCCwEFBRACAQYMBQQJCwYCAgMBBQMWAgIDDwQRAQMHAwcDBggBCwYBBQEGAQEDCQMCAwUOBgUFBQMBBQEBBwIKBAYJAgUHAQgCCAgBBQIDEAYBAQESAQMDAgUBCQIHBwcRCAcBAQEHBQMBCgMBAgQECgMEAQQHBQcJCAUBAgkFCgIGDgMBEwQDBgYIAhADAwIIBAMeAgQEBQIZCgwDFAEHBQMIBAICCQMOAQUOAgEJBAQDAQcEAQgCAwEJCAcBAwkBBA4BDggECAcBBgEFAQUSCgEFBQQCDAIBBQQGBQIPCAIDBAwNAwUICQoEBQICBwMBBQIDAQYNDAEOBAYDAQMPAgkEAgMBAwQDBQoDAwYBBgECCgEBBAkDBwcCCQMEAQQDBwwCCgMOBQEIAgYECAYMCAYDBQMBAQQHBQ0FBgEICAcGAwECAwcWAQUFBQIHCgEKAQwMDQIHCgMGBgUFEQgJBQkCBQQBEQoOHQMEAgoDCAYOAw8DCAYCBAMSBxQGFRwWCwEFCgYGCAYQAgcLEggBCgICBAkHBgQGDgMGAwoEEQwEBgYBAxEJAQsGAw4OBAEGDAsIBAYjDg0FAhEBAgsDHQECCAMCDwUBCAYEAwQBAQMBAQUGCgEEBAEEBQIHAQIFCQUCAgIGEgECCAkCAQIBBAQCAwUHGAECIQYBAwwNDQQCCQILBgMFAgECAhAOBwkEAQcCBQIGARMlAwMBBwIDBgcEDxYBBwQMAxAZAgQDBgMIAQYCAQQBAwQIAQIKAgIBBg8DCQUBAgIHAgQIAQwBBAYJAQIRAQcCAQYFBQEDAQEGAQkKAgcCBgoGEwIJBgIBAwICAxQMAgMEBA0BAQEBAgoEBQYFDgICAgcKCAYKBQEOARcBAQMBAgsIAw0OAwsBAQYIAgcECwMEAwIBAQ0EAgEFBBUHBwIIAQIICwMBCAICCAEGAwQCAgcBBQYJAQUGAwEBAQMCAwILDggBCQMEAwUEBAcDBwgQCwMFAQUCBgEDBgQEAQcDBgQIDAkCAQIDBQgFCx4CAQQFAhECAwcBAgEHAwYGBQEIAQEKEAINCAgNBAYHAgECAwgKAQ0BBA8CBQICCAUMAgoEAgECBQIDBQcBBAUEAwQBAQcDAwIFDRIGBAQKBRADBgIEAgIGBwYCAwgPAwUDHQMBBQMDCAgDCAICBQYDAwIKCgMMBgIDBAkFBAYLAgYBAQgCBBUCCBEZBAIGBgEHBAMGAQwCAQIJAgUHAQINFAQBAgEKFAEEBwIDAgUFBAYFDwIDAgIBAgMDBAQOAgUICR4FAQgGBQQDBAMGDQEFAgMKBgkBAQgBAQECBgoHCwECAwEJAQsHAQECAgMKBQIECAIDBwoBAQYEBgMCAQkBBxAFAQEEAQMCBAcCAgEJAw0EBQIEBgEHBAsSCQEKGQEQBBEHCQoKBQMCBgEDAQYCBQoCAgIBAgINBhYECAoCAwYEAwIFAwgCBwMEAQIGDQYDCgEPAQoBAgQDAgIBAQEBDQcGFwgKBRETAgIJAgQHCAMMAhQCAwUFAgMGEQUOBQILAwQBJQEEAwYDBgELCgMEAQUCBQ4GDQgbAgMEAwIMBAMJAwIFAQUBBQkEAQEDBhkIAQMCAggEBRAIAQEJGgEBAgsHDwQHAQUBCAsBBAUCAwgGAQENCwUCCwcIBgIFCQMFDQwEBgUQCQQEBQkCDBABAQUBCQEDBQILCAIEAwcKCwMHAQMKAgcBDwUDBwUCAgwHAwwBBQ0EBQkEBAEJBAMIAgQdBgMOBAICAwMIGggDBAYHBwEHAgIBBAEDAgIDBgICBgcCCwQEAgUCFhABDAMBAQIBBQMKAQMHAgsPFAoQBQEGBwMEBwEBEA0PBwMDAw4BBgQGBAMBAgMCDAYCAgcJAgYIBgMFAwIKBQUBBwUCFwEEAgQJEAcCAwMDCwMDBQEOCggGBQoFAQcBBgkGCQIBBAIBCQcJBQIDAgITAwEBBQIBDAEHCAUBERQFDwMDBgsTAQEDCAMCDQQCBgECAQkEAwQBFwELAQIDAQENBgUIAg8IBgMBAwMGBgECCAYQAQIGBwYPCQQBAQMOBgIMBQEEBgYQBAgHBAEBAg8GCQIEAQoEBQIKAgUFAg4HBQkBAw8CAQQEARABCQMPBAsEAQcFHR0DAQEJAwQBAQcCAwIBAQcOAQIECAsDAQIFAQQDBQwEAQIFDQMBBggBBgQDCAYBAQQHAQsDCwECAgUFDgUEBAILBgMCBwEEBgQBDAICAwENAwQCCQEIAwMCCAMIAQ4FCQwGBwQGAQICAgwJAQwCCAghDQMGAQ8GAgkBDAQICwUEAgIGCQMBDgMBCwwMCgECDgEGAw0DAQMKAgERBAMEAgQBAgUNCQQDBwINAwkCDAoDAwcFBgYDBwICAgMDCwwBAgQEFwcTAgwFBAsDAwIWBQUCBwYFAwUCCwEBBAEGCQMBAwoHBQYBAQQBBAIEBwUFCQ0GBQYCBAEBBAEIAQoCAQEDBwIJAgQBDgQBAgsCAgsBCAUBEAkJCAgMAQEBCgoQDwEEAQEGBQIQAwIFAgkTBwQCAgUIAwQEBgQJAwYBBQUJAQEIDgcVAQEBCAMCAwoCAQ4KAwEIBQ8EAQgEBAEHAgUKAQkCCwEGBgcQBAEGBAYGAhQGFgIMCwQGChEHBAEKAwMIBAIQEgIKAgUCDwEGAQMCBAkBAQMPBAMHAQUBBxcBAQMECQ0DBAMBAwICCwUCCg8DChIBAgQFAg0NAwYEAgMEAwkBAxMBAgMCBAIDEQsIAwEEBgQDBgcBAwIEBAQGAQIYCAYIAgIBAQsFAw4CBAMKEQ8BDwIEAQIFAQkKFgMBBQYGBAELAhAFCwsDAQEDAwgBDAILAwUCBggDBwMBBQUGAgEGCQEMGAMHBQMEAQ8HCgICCwcBDgUBAQECAgEJDQQDBwEKBQQCCAIBBgEBAgUMAwIIEhgFBAECDQcGBwUBAQgFBQgCBQUBEwQCDAIBBgEDAwEBBwcFAgMDAgMGDAgJAwIDBgsHDwIMAQgDCQEGAgIKBAYBAgkNAwECAREDAgQCAQINIggOAwUTBQMDAQgBDgEBCRoDCAoEAgECAQEDAgYFCgcDBAIEBgoCAgoDAgMCBwUFAgEKAgYDAQUJBAIGCQwECwIBAgEDAQEBBAgCBgsDBwYIAQQFCxIBBgMCBAQFAgILAQwkAQIDCQYCCQEBAQoGAQQFBQIBBAMGAwQEIAoFERMBAgIGDAQFEAgGAgUFAwcFAQUGAg0IFgICCQYJAgcFCQMCDw4LBQECAQQBAgMHDAIFDAgFAgMFAQwMCwQJFAwIBwIEAwIFAQoGAQcHBAMBAQcBAwMcAxkHCQUEAQcEAgYCAwMSBgMOAgsCCQQCAQwEBAIPBAYCCAIDAQEFCQYBCwQCCAEBDgEBBQYBBAkCAgMHBg0BAyEFDQ8HAxIYBgMBAwEGCQgEAgIMBQIDBAEDChUMAwMFAQICCA0bBgMKDQYEBAMCAggJAgMEAwcPAwkVAQIEBAQBAQQLBQwMAgQBBQQGCQIBAxIGAgEBAQcTBwECAwECBQUBAgMEBQ4CBQQEAQIMBAELAgIDAQoFCBACBQEEBgwDDgQSAgcPBQIDBgMBDAYCAwEBCAEBBwIHAgcOEgIOBgQMAQcDBAYIAwMCAQQPBQUFBwICCgMECAQGCgEMAggEHAEBBwICAQENDgEEBQQDAgIGAwQEBQoXAQUIGgIEAgkDAQEFAgMJBQUHAgIECAEBBQEJAgwHBAgDAwIGAgcCFQsDBQEJBAcNAQIGCxAJDgsQBwECCAoSBgMHAgQFBAIBBQUBCA4CBQkGAQULAgsCAgcBDAICBwMCBg0CAgcBCwkRAwEFCAMUAgEIBwMIDAEHBQoCAwUEBAgBAxUBAQ0EEwMLARMcAQMDBQ8BAQICAgICBAcDAQECDA4DBggECAsNBAQHBQQPBAYGBgwBBwgBBQMFAwEBBwIBAQYCAgUDBAEECQYFAgEDBQYJBgkPAwICBgIBAg0KBAIVAgIICwMCCQsYAwEEAQkDCg4QBgIMAQ8FAwQKCgMBAR0CCQMCAwYHGAYGDQkFAQQBAwYLAgQCBgQGDQEDBwEBCwkEAgMCAgEFCwYFCiEKCgQTAgYRBwgKBAIDAgEFAQUCBwMCBgcGBQQCAgILBQQKAwEHDA8KAQEDEAMIAw0IAggFBQEEAQYHCAcEBQoCHgEFAwsHAQQFAwIBBgkCBgMNBAQJAwUEAwMCBgYEBAoEAgoCAQkDCgoCBgMDCQIJBAYWFAsEBwcBCgEFAwoLBAQOBAoEDwsIAxICBgEFCwUECgwDAwYBBgIFBAEKBgQCCAoEBQMZAQECCgcDBAEDBwwBDAgCAQcQCgUCBwYBAQEMDwEDBwQJAwUECQELCggCDgUEAxIOAQUJBAIOBw0FDwEDDQETAQYBFAEBBAMIBA4GARYDAwMBAQQJBgQEAgEBIQQFAQQJCAgMAwEBBwQMCwEHAgENBwIHEwkDBwsHBQECAgYDCQsCAhMCAQUBDwIDDwQ=","phy":"AQMABgcGAQUDAwMFBgIBAAABBgABAAwEAAQBAAIAAAMAAAIFAAIBAAYCDAIAAQAFAAAABQIAAAQCBAACDAMBAQQBBgMBAQIADAcGAgUJBAAMAQAAAgEBAgABAgUMAQAAAgIDBQIABwEBAgAADAUAAAEAAAAABQAMAAoCAAACAgEAAAYCAQEBAwACAgIBBwUCAAEACwAACgACAgECAwUABAICAgMFBQUFAQwMAQICBQEFAggBAQcACgICAgICAgIAAQEEAQECBAICAgAABQAAAAAADQACAgAEAAABAAEAAQQCAgQDDAICAgICBQQCBAIHBgQKBAIAAgECAgABAgUCAgcHAQIACAICAwICBAICAgEEAgACCAAJBQACAQEBAAIEAQgBCQAHAQICAQgCBwEEAQ0BBAIBDAIAAgAEAQAEAQAIDAECAQwAAAABCAEBAAAABAIBBwAAAQMAAAABDAEBBAIBAQoHAgEDDAABAgQIBQYABAANAQUABwABAAEBBQQIAAIAAgMABQIEAgIABAACCAQBAQUHAAIBAgAACgEBAAgEBAIIAwgBCAIAAwUEAQAAAQIKAgQFCQkEAQIJDAgHAAQACwoEAwUAAgEBCwACAAoCAAEFAQkKAgUMCAUBBQIADAEDAQICAQsMCQEEAQEEAgMFAAcAAgIAAQABAgACAQIMDAAAAAABAQIACAAAAgEAAg0AAQECAgAADAAJBQgBAgIHCAEBAQAEBQIEBAABAAIDAQMCAQgMCwEIAQQBAwUABAEBBAEBBQEAAgQACgILBAIHAwEDAAICAgEDAgANAQUMAgICAgEAAQIAAAwCAggKAAAAAgQFBwAIAAQBAQAEBQQBAgACAQsBAQABAQQHCgALAAoJAQABCwAKAgIHAQQCAQEBBQUIBgAAAQEBAAIJAQIAAAAACQkBAQIKBgIAAQMMDAcBAQgBAAEAAA0KAQYBCwEBAgEKDAwEDAgCCgwCBAEBAQUIAgEAAgQBAgQBAgEEAAQDCQEABAIEAAcHAgANAgUBAgIBAgQFAQUJAggABAcIAQIICgwABAABAgIDAAwEAAwIAQIBAQAADQkKBQEFBQwBAgEMDAEMAAAIAgUCAQoBAgAABAEMAQoJAAECAAEAAggNBwQMDAECBAQCCgEECgkIBAgJDAYBAQAABQkDAAgCAgEIAAoCCQgNBAMCDAIAAAAAAQIIBQQABQAIAQIFAQAMBwwCBwIADAAFCQIGCQMBAAIGAQAAAgwBCAUFDAkIBwACBQICAgACCgwAAQsIBAIEAAICCAACDAABAgIECQcEAAsNCAQAAAoEAQAACgACBAkMAgIBAgYDCgQBAgEBAAEAAQQFDAIBAgIAAgkABAIDAQABDAgACQgEAQkBBQQDAwAAAgAFAAQLAQAAAAIBAgABBAEECwQHBAIMAQIJAgICAwELAAIDBAIADAkADQIKDAIFDAABBQcMAwINCAwBAgQCAQEEAQEMAwEMAAgFBQkACAAACAMBBAEAAwAJDAgAAQEHAgAFAQABDAAMAQwCBQEADAsJCAkACQABAQkMAAABCAgMCwgADAIAAQwBAgwCAAgBAAQJDAQFBAQFAQwECQAJAQgJBAABCQICAgIAAAQHAAkBBQcMDAgCAgIJCAkCBQMBAgkCBAANAQQCCQAMCQkECAoMCAkJBAQHCgEFCgAACAUCAAQEBwAHCQoDDAABAQIFAwAADQANAAkACAEGCAACDAAABAwHAAIMAwwCCQQCAgkLAAQACgABAgALAQQAAgkBAAADBAEAAAECCAAHAQEEBAEACQcCCgEKCQAIAQUIDAUKAAAKAgwAAAwBAQoMAgADCQUIBQEMCAkAAAENAgwBCwUBAAEBAgkACQECAAEBAQAMAwgKDAwHCQADAgEBAQIEAQECBAEAAQcMBQACBQgBCQEHBAIBBAUNAAMEBAECAgwBBgECCQACAgEBDAIECQIMBAIEAQ0KAAkBDAEADAUEAgMBAAEACAIMCgwFAAIACQEIAAAAAAILAQkBBwIKBAQBDAUGAQYCCgQEAgoAAAgCBAUEBQQBAgQMAQIIAQIIAAwJCAIFAQoAAAgFBQEFDAQNAgQICgIACQQHAgoHAAkAAgMJDAsCBAkBCwMMAQsNAgIIBAQBAQIMAQQAAAIDAgkDAAQIDQECAQACAQsBAggJAQEBCgsBAQIAAAgKAwwKDAwNCQEACwoBCwECCAABAAAMAQAMCQADBAQMAAALAQICCQQBAAIDCgUEBQQCAQEEAAEABAQBDQUCAQEAAgEDCQwAAQAGAgABAAwEAAkBAAkEAQEHCQABAAgEAAwHAgMNCAcAAwAHAgIHCAsBAQUKAQcEAgEJCAAJBQIMBQgCAwgBDQEGAggIDAwEAAAMAAsKCgwJAQMBAAECAQIKAwEHAQkEBAACBAICBAAADQAFAgwAAwULAQwFAAkFBAEJAAMAAQoAAgMABA0CAQICAggJAgEKCgoMAgIJDAEEDAcACgwEAQgMCQACAAwCAQACDAoJCAMEAQABCQkKAQIBCQAGBwAHAQEHBAAMAQgEAQILAQEHCAEDAQABBwMMBAEKCQQAAQgBCAIKAQAMBAsAAAIKCAwAAgIEAgkJBQQLBQEAAgwICAAEAQwAAAIEBQACCAAJCw0CAgACAQEDAwkBBAcMBAkMCAEEAQkECQUEBgECAQkBAAQACQUBAAADDAIJAgALDAoNDAIEBAwEBQwBAQAMCAgABAcHAAUIDAAMDAICDAMAAAkECQQCAAgAAQUADAwJAgABAgkFCAsABwQEAwEAAgwECQAAAAgJAgQADAQKAQACAAwAAQAAAQoBAgAJAgEBAgoBAgACCAAEAQEBCAwACAMDCgwIBwIAAgEEDQwAAwQCBQUACwEBDAgKAwkHCQECDAkICAEMAA0MDQEAAgoKAgkDBAoJAAkJAQABAQwCDAIHDQABAQUMAQwHCQECDAMAAAMCBAAIAAoKAAABCgkEBwMHAgoMCQwMCwEICgcIAQsBAQgLBAcEBQwLCQsKAAAECgAFAAwIDAMCBQUAAgoACQEECQANCQUNAgUACgIMCAkABwQJDAEACQwECAwHCwcEBwIIAAwFAgwIAA0AAQwMAAEHCgIDCgIAAAwKBwwHAAABAQsBAg0BBAkEAAEBAQsKAAkBBwEABwIMAAAEBwwBAQIJAQgJAAwAAQIMCQQCDAEJDAkAAgIACQwIBAIEAgMJAAEKBQYMBgkMCQMJDAoAAAkAAgEEBAkJBwMAAgsICAcIAgEKCQgMBAAJAgsMDAgCDAQBCgwJAAwMAQcMAwwABAUMDAkCDAQACQwAAw0BAAcBAwQACgABCgMMCgEBAQ0BAgAFAggCAgwLAAAECgENDAwBAQALBAwJBAUMAAEKAAgNAQAMBAAIAwEJDQEMDQoMDAACAA0MCgcLBAIEBwAIAAQEDAQKBwgJAAoBCwIECQ0ACQAMDAEACQgKDAQLDAIACQQABAEEBwsCBAAMCgQBAgkABAoLBwQKAA0FAQAMDAABDAoECAIDAgAACQsECgQJCAcEDAQIAAIJCAsJCgIJCQAIDAAMCQwEDAoEAAkADQABDAgDCgwBAQQJCQkEAAcKAAAACgIEDAkEAwQFCQoACgsFAgIEAgEMCAQACgECAQwEDQICAAUMDAcCCQcACQwMAQIJCQkKCAMKAAwBAA0EDAADDAAEAAAEDAQNCwEHCQsAAQsJCAIICQEEDAwMDAEADAwJCgEEAQgICQIAAgABCgwCAQoMAAsFBwgEDAsEAQEKBwEMAAUMDAAECQkKAgoADQAJCg0ADAkMCQAAAAQCBAICAwABCAwNAgwMDAkDDAUACgEFCgQJBwAADAQIAw0JDAwCBAYFDAkMBAUIDAAJCgwBBAsMBAEDAAQAAQAICwAJDAgACQwKAAcJCwkBAgQEBAwBDQkKCwUNBAwJCAMAAQgKAAwJCQEKDAcACQ0JAgAMCwAHAQwICQsEAAIEAQkBCQwMDQsBCgsBAAAJBQwECgADDAAJAQsMDAkFCQUJAgkKAQkJAQENDAwMDAkMDQoADQoADAwMAQQMDAwAAQAGDAAECQYMAAIADA0EAAQKAAQECAMBCQIJCQICCgAADAEKAA0EDAsCCQQJAAoFDAQCAAIECAwLAAIEAQkECQwEDAIEBAoBCQAICAwCBwwDAQ0MCQAEDAkMBAkNCw0CAwoMBAAECAQFDAIMBA0MCQgEDQQBBQoCDAQKDAIMCQcHAwECBAIBDAEKDAQMCAsEAwQMAQkBAgwJCQwJDAIKBwAKAAwBCAEIAAQJAQgEAgwACgwEDQAMCgMCCAABDAwMCQgBCwgKCwoABwAEAgoADAEMAwkIAgAMCg0ACQEMBQgEAQwNAQcFDAUAAQABBwAJAgQADQ0JAAUMCAcJDAwMBA0EBQQAAgkJBAkMAAkAAgwEBwIIDQwBAAAMDAAJAAoLDAMBAQwHDAwMAQQCBAEMDAAACwgJCwQDDAIICgwCBAwACgwNAAoHDAkAAQICAQ0MCQQJCQMADQUEBAkBAAkMCgcKAAkICQkACQILBAAAAgwAAAAKDAMMAAABBAoKBwQEAA0JAAUADQwBAAwAAgAICQwMCQEMDAkADQIMCQUADA0IAAAAAwoNCAAHAwcKAQIBDAUEAAsMDAoJAAACAAANBwsACQ0LCQAMDAQMAAQABAIEAAAEAA0BCQMDDQIMCgwMBwENCQAAAAkMBAwMAQIIDAwJDAkAAwEMCAMECAIAAQAMAwcMBAwLBwkMAQwEBAoBAgwHDA0EBwcEDQgECQ0ECQQJDAEADQkNBwoJCQwCBAICCQwMAQAKAgIEAAAJDAkBDA0ABAQKCQkAAggNAAoIDAIAAQkCAwEDBw0BBAgJCQkFDQANAgkEBAQDBAgAAgwAAgEMAQoEDAIAAAEMAgwJAgAJDAQBDAYBCwACAg0ECAMJDAkMDQwMCQEFAQwJBwINBAEKBwgEBwQAAgICDQwAAAMMCQcDAAwCAAAIBwwMDAcMAQEKCAEJAgkHAwIJCwQCAAIHAwEEAAwACgQMDAICAgIAAAQBBAICBAoAAgACDQEABAkIAgACBAwCBw0EAAkMDAIFCQgAAgoECAAJDAcFBA0MBAIMCQ0AAwAMCQQBAQkMCQIBBQ0CCQoADAkHAAACAQEBCg0ADAMECgAHCAAADAAMAggBAwoDCQAADAANDAMMCwoHAwABAwQJAAQCAQMKCQoACwoCAgUFBwwBAwkCAQ0EBQwBDAAACQwNAgEEBA0JAgoMAQwJAwICDAIFBQwHDQoACAwKCQIKBQABBQkAAA0BBAkAAgwJAgMKDAIKBQAADAkBAgQMAQEJDQIEBAkECgICAAMMDAABDQIAAgsMAQQBAAkCDAwCDAYADAIDDAECCgIAAAwEAAICBAkBDAwBBwUACQwBCAwJAAQMAgQBCgAEAQILAgYHBAEJBAEADAgKDAwNBAAIAwUBCgcMBwwMDQkEAgkJAQAIAgABAgIMBwEAAQ0CAQwIDQMMAAABBwAAAQAFBAMCAAMADQkEAgcLAwwAAAkAAAMNBQEMAAAMAAAAAgIBBwUNAAABDAkBBQcCAgQADQQJDQwBDQACAgMCBwIABwEHDAEMCgECAgwAAQMCAQkMDQQFAwIMAAAMAAgBCgwDBAQCAAACDAcAAAIJAAkDDAENDAABBAICBAAGAgIMCQwBAwECCgAHAgYBCQECAAgMAgABCgcCAQIDAQEKCAcBBwEEBwEACAMBBAMECgICBAEIAQMCAAINBQgIAQIAAQwKAgACAAIABwAJCAsEDQIBAgQNBgkBAQgADAMHAQAAAAIMAgQCAgkEDAABAwMAAgkBDAwEDAEBAAAMCgYMAgIFCAEBAQIHCQQDAAwGDAIMAgwDAAcACgABDQIEAgEMAAIABwQCBgEAAgcBAgEFAAABAgYMAAIFAAUCDQQIAQQMAgcBAQICAgwBAgIAAg0BAAICAQwEAgQBCwoJDAEADAwJAQAJCgEIDAwCAgEJAQAJDA0BAA0CAAICAQEIAAUFDAQEAQIFDQUCDQEMAwwECQkMAQQJAQQAAgwAAAABCAADDAIMAwABAwMFAAEBAw0CAQEAAAMCCAICDAAIAAEKAQ0CDAEJAgsBAgQABw0BAQEAAgIEAAAEAQIBAQgNAAQDBwILAgIJAAEHBQEEAQwECgEMBwIBBwQBCQUCBAIIDQgIBAYABgMIAAkEDQEAAAIFAgQMAgMNAgIKDQQNAQIEAgwAAgIHAAwEAAAHAQAEDAIJBAIADAMAAQICAAMECQYBAQABAwgIBwIBDAIJDQIKCgMCBQkACgMAAAAFAQANDAEAAQECAAwNCggAAQADDQQBBA0BDAENBQINCgwCAAwGCQwNAgIDAQECAgQBCQAEBAIAAAILBAIHAAcCAQQACwwBBAILAgcABwIEAAwFAQICDA0CAgoBAgQACgcACgwACgkCDAwBAQEADAIMBwQCDQUDBQICAQICAQAHDAAMAgUBAQINAAEIAQEADAECAgEKAQMAAQEAAgAMDAQBAAAAAgACAAUBAggEAAwJBAMAAAUNDQIJAAoEAQECDAcMAQEKAAMKAgINAgABCgACCQABAgkMBQAACgICCAUCAgkAAQ0MAQ0ADQUCAAoAAg0CAgMMAgABCgwMCQIHBAIEBwACAgwCAQMJBwwCAAIDAAEAAQEABAIMCQUAAAkDAQEBDQkABQ0FAQMBAAIADQUADAIMDAANAggMAgEMAAAABw0BBAAMDAcMAAYABQIADAEACg0ECAoNAAAAAQACAQQIAgAMAAMADAwNAgAJDQQCBQwNAAAEAAAMAQwCAQICDAQMAgINAwABAAADAgECBQEABwILDQwBAQECCQEEAgUAAQUBAQEAAg0EAwUMAAkMBwsEAAIMAQIBAgEFAgANCgICAgEHAQcBAAUBAgUDBAIBDQoBBAwEBA0CDAICBAAEAAEJAgkNAgAADAAAAQUBAQkMAAECAwIBBwEMDQIFAgwBDQEJAgkCAAQAAAABAgYCBwINCwwMAQkBAQMBAQQCBAICAgEAAQEJDAQBAAECAQwFAAINBQIAAAIBAQkHAgsCBAAAAwINAAAAAQwMDQAAAgIBAgEFBwICAQIEAQABDAAEAAICAQ0NCQEICgcBAAAHCQ0ADQ0HAQEBDAEACQkNAQcEBA0NAgIMBQQADAAACgINAAEHDAUAAQQKBAcCDAIADAANAgcNBQIBBA0JAQIAAAABAQwBAQsHDAAJAQAFAQcBAAEBDQEMAQELBQ0NBQICAgEHAAIBAAAAAQEBAgEBBwsNAgEEDQACBAINBAABCQwAAQ0FAQwECQMBDAIMDAECAAABBwwCAQABAAQAAAMAAAEEDAEKBA0FBwEJCgIKAwULDAIBBA0MDAwHAAAIBQQEDAoCAQECAQAEBQwAAgANAgECDAwABQIAAQoDCgUEDAoAAgcMAQwCAgICAgQMAgIABwcAAgICAQwDDQACAAANAwAAAQEADQwBBwcNBQAACgIABQIAAAABAgIMAQEACgUECgACCAEJAgwKAgEBAgADAAQADAkHAAUNAAICAAQCBQEMCQAAAQMCDAAMCgEHAgACCAcMDQsEAAQADAICAQwFAAMLAAANDAIJBQECAAEEAAwACQICAAIBAgAEAgAMAgsACQ0CAgQNAQQBBwACAQQADAkFDAIABwENAQwMAgMAAgEKDAAABAoAAAcNBAIBAgAHAAwJAAIKAgQJBAINAQABAAQAAgwAAQwMBQ0CAQEBCwAADAsECQwMAgIAAgACDAEDAAEECQwADAAECQQBAgQNDAoCCQQBCwEJAgAEAQkJAAAAAAwAAgIFAAsCBwQAAAUNBAAABAEACQAKDQwMAgECDA0AAQ0HAAEIAgIDAgkCAAEJAg0ADAQLDAAFAg0DAwoNDQABDAEBCgAABQIEAgIBCgIAAQAMAQIEAAwNAAkHAQAFAgQBAgECBAwADQkCDQ0MBQ0ECQECAgEBAgwICgEMAA0AAAoMCQADBA0AAQECAQwBCQIFAgEBCQ0DDQkAAgwEDAAMBwEMCwIBAAAKBQEBDAgNAQQKDAEACQEMAggAAgIEAgIKAgMAAQQECg0HDAIJDQMCAgAEAQACBAABAAQBBQUAAgINDQIBAQEBAAIBBwAEAgEFBwMMAQAJAgEADAwFBQEJDAkCDAIADAQDDQIJBQ0BCgEDBAICAQcDAQABAgECAQEBDAENAAwBAAAADAwNCwAADAQAAQQKAAMBBAwNBAEHBwwFCQAGAQINCQACAwwKAAECAAECAAEBAgkBDQAKDAIAAAACAgAAAAAIAgwMAAICBAEADAwEDAABBAAFDAAMBwEDAgIFDQAMAgIABAIJBAUDAAwAAAEEAgEEAAcCAA0CAgcCDAwCCgABAAINAQEFCAwJAgICCAsABwwJDQICAAQACQEDAAsACgIMAAIJDQIMBQIHAQABDAwAAgkIDAEBCQMCAgEBAAIHBQIABAoCDAkDAQoMAQAADAUNDAECAwwBCQQJDAICDAoABQkMDQAJBAIBAAQMCQ0AAQAEBAACDQIADQEBBAoCAQwCAgwEDAEAAQACBAwCDQcADAIAAgkMAgABAQIDAAIKAAAHCQoHAAMCAQcABwICAAAAAwwNAgQNAQQDAQMNAAQHCQAMAwAADAsICwEMAAQCAAEECgQACgACAQEDBQ0MAQwAAg0EAgECCgwMAg0EAgEBAg0NAQEBCQQABAkNAwEHAA0AAA0KCgICBwAAAwIEBwcNAAwDCQACAQEBBA0IAQIAAQ0FAAQMBAAMCAUHAAcCCQIEBAEDAgECAQEHBw0AAAIHAAwHBAUEAQcAAgQBBwEBAAgCDAcEAQICCAQNAAkBAgINAAEDBA0BAAABAQAAAgQKBQEEAgIBBwAAAgcAAgILDAAMAgwBBAwHDQYCAgUHAgAFAAICDQEKBQwEDAwMAg0BAgIEAgAMAgQBAQAEAA0ABwEEDQsAAAIADAkADQEADAAEAAUBAAcBBAwBDQkCAAEADAUBAAcNAAIMDAIMDA0BDQEACQ0ACwEBDAUAAQIFDQwDCQMEAAEBCw0NBAIAAQEMCgIFAQECAgwBAAAEBAQAAAACAQkJAwIBAQcBAQwFAgEHAQwCDAQBAAABAAAFAgACAwQADAECDAEEAAMABQEACQwKAgEADAEBAAwCAgwDAAUFAQwBCQMAAgEBAQICAA0DAQYHCwABDQcBDQQAAAkDAgQAAAIMAgIBAAwCAAAEAQkABwUFAg0MBQIBBAEBAQAACQICAAQCDA0BAg0JAwcBBAACAwEHBAkMAgIAAgMMDQUHAwQBCQEABQIMAAINAAENAQ0NAgAMAQ0AAgwCAAECAgAAAg0BAgILBQwEDQIABAEACg0BBQkLDQEABA0BCgwKDAIMAAICAgEADAwDDQEAAAIHBwQFAwMNAAEEBAIFAQEHDAIAAg0ABQUJCAACBwEBAAQFAQoBBAUJAQAMBA0FCw0BAgAADQ0BAAIAAAwMAQUCBAIHCwAHAAQCCA0CCgIKCQIFAAEBCgwNBQAICgIMDAQADQECAgwACwcABw0CAgIBAAwACAcBAQEAAQUCAQ0HAAkBAA0JCQcBAQwCAgEJAgQJBQAFBwkJCQINAAAHDQUCAAAFAQMAAAIIBAkBAAAHCQ0NBAoCDQ0DDQ0BCwMNCQcDAAQBAQAMAAQABwACBQEMAAAKBQACAgACAAAMBQMIDQwEDAQMDQMMAAEAAwIBAgEEAAAJBAwEBwAJDQECAgIABAELCQIBAQABAgECAQACAQEAAAwNAQEMCQ0CDQ0ACAACAAoEBwEEDAwCAAwBDQoJAQECCwMCBQEKDAIFAgcMAwMNBAwKAgQHCwwCCQUKAAABAQEAAgwBAgkKAA0BDQEJCgkCAgACBQQCAgEABwEEDQAMAAEBCQEADQEKAgICAAUAAAIBBQEEBAICDQEBBAAAAQECAg0BAQAABAEKDQAAAAwCAgEEDAEHBwACAQQABAEFBAICDQwHAAQMAA0KAwgCCQECAAEMAAEMCQoAAQEMCgMBAgEABAIABAAAAQIFBAAECQAKAgEEAQICBgAAAgABAgAKDQEFAAECDAwAAQEBAQwIBQIKAgwAAAcECQIDAAIBAAQKDAMBAgEAAA0ABQECBwACAAoKDQUFBwABAAEEAQkNBQwCBQAACQ0CAwINCwELAAEMAQwCAgIHAQ0ACwAACwEGAA0MAQcEDAEEDAICDAEEDQAADAQECgsDDQEAAQkNCQAMAgwNAgwCDAAEAAwJBQEHAA0BAgABAwAAAAIBAgEHAAICAAkNAAANAAoFAgwMAgICAQ0DAgEADAwFAgECCgQADAICAgEKDAACAg0BAgQAAQAHDQAEAgwNAQAABwUDAAMCDAIDDQkDDQcADQMAAAIFDQQCCgENDQABDAkADAICAgELAQ0EDQkMAgQBAAAEBAIBDQUFAAEFBQkMBQICAQABBw0AAQwAAw0BAAkECQABAQ0CBAECCwoADAQMCQQBDQEAAgACAAcBDAQADQABBAEBCgACAgQAAA0LAAIAAgwMDAwFCQEFBwAHBwQNBw0AAAEBCQwAAwECDAACCQUCAgEADQEFAAAEAgkNAQAGCQwEAgINBAEBAQAJAQUEAQEAAAwJAAIDAAIIAgEGCgQCBAELAQkAAgUMAgQJBAwFAQQMBAICAgENCgcADQALAAADCgIMBQICAAEADAEACgQCAAgCAg0AAQEBCwEAAQcCAAsEAQIMAgECBw0CBgAMAA0JAQUKDAoCBAENAAUAAQABAQAMBQQBAAAECQAAAgEBBAoAAgACAQwAAAgMAQAADAkJAAkJDQAFBQAAAQUADAkCAwAABQcBCAQBAAoCDQADDQEEDAwMCwEADAEABAwBAgcHBAQECQoNAgEHBA0HDAwBDQQMDAwJBQICDAINBQ0BCQwCAwECAAIHCgUBAAQMAQ0HBAEBCgkIDQoMAAIACQAMDQICAQcBDAkFAAQNDQANAQIJBQ0CBAEMDQ0CAgAFAQ0NBw0EDQoCAg0MAgACAgEHBwQMDAQBAAECAQENDAwCBAIAAgsEDQcBAQEJAQwBCQACBgkAAAgNDA0FBQIMAgUMDQENAgEBAAAAAA0AAAACAQICAgUACQkAAAIMAQICAQAADAoNBwEHAAQMAQIKAgIBDAQLCQ0ADQoNBQ0MDQwDDAkCAQEBAQcADQAAAg0HAAQMDAIBBAABAgkAAgAEDQIJAAEECgANAgEEBAkCBAoLAQ0FAQUHAAAEAgACAAAAAQwBBAQBAgAACQELBAoMAgEBAQAABAIBAQQJCwEAAQMDAAwCDAEHAQAAAgkCDQENAAECBAQNAQkMDAENAgIBAQ0AAgAKAg0CAg0EAwELBAQBAw0CAgoBBw0BCwQMDAUACgANBQoBAQkHDQAAAgIEAAQACQgJBwENCQwACg0ECQoBAgIBBAEBDAwCCwAEAAwLAgoCAAEAAAEFDQENAg0AAQwNCAwEBQAHAAIAAQEMAA0AAwgNCwAFDQ0EBAEBAg0AAAEHDAwCAAIBDAAMCQkAAAAMAQwBAQIBDQEBBAQNDAIDCgwIBQEBBwcBBAcBBQoLBQcBAgwBAQMBCAMCAAoAAQAECQIDCgANCgcACQUNAQQDBA0JDAEAAQwNDQENCgwFBAEADAkNBAENBAMABwEHAQQJDAIJCQUNCQAACAQCBwIFDQwNDQwADQEAAAABAQAEAAQAAwkAAAsHBAQBAQ0ACQoKAwwFDQcBAQEBBwQCAQEKAAwEDAEJCQQBAQQAAAABDAEDDQoDAAwCDQEHAQ0HAAEEAg0EBAICAg0EBAEBAAAJCgALAgEEAQAADAIHDQEAAAANDAIMBwEBBwAMBAAADAwBAAQADAIMAgICCwABAAIKAQoNAAwCBQ0BDQkADAICAQQNCQUIAA0HAgcFAAwABAAMDQkJAQEMAgEBAgoBDQ0CAAELAQEAAA0BDQQAAgICAgwADQABDQACCQwNAA0AAgABBwsBAQENDQoNCwAEDQIMAQMADQIBAQcAAAACDQ0BAQ0FCAINAAoADQAAAAwMAgIECwkMBQwNAg0EAgINAAkMAAkNAgACAAEDAAAMAQADAAAMDAIAAAEBBwIBAQIMAAMMCwwMBwwADAwCBAECAAkCDQAMDAUBBAEBBwENAQAABwcADQAADQ0HAwEAAAwFBQICDQICAgQNAAAJAQEBAQcMAw0FAgEDDQwIDQADAAQJDQADCQcJAgwFBQABDAQAAAAADQAMBQECAwANDQINAQwJAAEHAQIJAwAFBQEEDQMECQkADQ0KDQECAQwCAAACBA0BBQsBDQsBAAkNAAAAAA0ADQIBDAENAAAMAgwFAwIHAA0KDQAMAAAAAAsACAIFAQQBAQAMCQAAAQsJAgEBBwkCAwQACQABBA0AAA0EAgkJAQoCDAcCAggMAQEMDAwKAgIFAAMABw0BAQQNCQkNAgENAQcAAQEFBAEIAQoBAgAMAAQBBAABAQEAAQABAAwMAgIJAQELCQACBAQECQAFBwIHAAUCAgICDQANAg0CAAAABAcCDQcDBw0BAQwLAgkMDAECAgAKCQkAAQAAAAENAAUDAQcNDQMJDQANAg0AAQIKBQcACwIBAg0NCQcHBAENAQENBAQABgAAAgINDAEBAQQJCQkJDQEMAQ0BAQQMAQ0ADQIADQoLAA0ECwMNCQIEBAENDQANAAgCAAIHAAAMAg0AAQ0CDA0BAgIJCQ0CAwoKDAAFAQIBAQ0BDQAEAAIBDQUEDQQBBAIAAAABCQEAAgwAAQADAgAHDQcBAA0DBAIAAAEEAQEAAggFBAwADQICDQMMAQ0AAAUNAgMCBQoCAAQCCwgHAAAAAA0MBwQNAQQKAAMDAAACBwEBAQQAAQQMAgACAQIBAAwJCg0ADQECAQoCAgEACQACDQkFBAILAAEBAQEBAAsADQoJAQwBAAUFDAMACQwABwQFAQEECQEEAAQMCQAADAAMAAAADQIBAAEAAQAMDQECDQMKDQ0AAgEADA0MCgwAAw0MAgIABAQECQAFBAwJBQUBBAABBQIFCgABBwwNAQgNAAABAQQJDAsABAwMAAoDDAADAgQHAQADCQwEAAcBDAMHAAwCCgICAgcBAQECCQAMAQUNDQENBwUABAAMAAwKAAMBBwwMDQkJDAkMAgoJAgAAAgsNAAcCDQkJBAQMAQANAAQHBwkEAgMNAwAKAgAEBQoEAQENCQAMAAENDAQMDQwABAICDQQABAoNAgIABgAAAwkMAgEHBA0AAAQNCQALAA0BBwQBAQAEAAcHAQoEBAEECgAAAAUNBAINAQUNBAgIDAECBwcHBAENAA0FAQECDQINDQABDQAECQAAAAwAAQ0EAAoNAQAEDQ0AAwwADQIABwwBAgYAAAIBAQwMAQwKAAoCDAAADQIEDQQABAMMAgEAAwAAAA0FAg0BAgEHAA0MDAIMAAECAQENDQIMAAENDQAACQwMAAENAAENAQEBBAABDQAAAwQFCAIAAgEEBAEABwQFAQcFAQUBCQAJDAIEAQEEBAMADA0MAAEABAQCCgUFAQABDQ0AAwANDQQNCwUNCQ0KAgQACQcCCQoAAgwABQwHAwgNAgIHBwUBDQwMDQINAAUCCgwAAwINBwEBAQ0BAAQBAAoMAAEEAgQNBwgDBwQMAgwJAAACDQ0NAgQMBAAADQAMAAAAAwUNDAAEAQ0BAA0JDQ0DAQINAgMCAg0AAgIMCgoHCQEABAIBAQAAAA0HDQQFAgAFDQEBAQEHAAAAAQQJAAMBCgIAAAwFBQQNAQEADQQADAkMAA0BCAQCAQcNAQQNAAcMDAwDDAkMCgwNAAwFCA0BAQEEAQANAAANAQkAAQAEAQkCBwoAAQEJDAIJAgICCw0HBAwMAgIMCgUJAAoNBAIBDQ0HDQAAAQwABQkJAQEBAgANDQcBDAAJDAIBAg0BAAIMDQ0MCQwJAg0MAAANAQIKAAEBAQEECQwNAgMCAw0ACQACAgEAAQcHBAIBDQACBAcAAQgJAgoJAAcMDQIMAAINAQ0IAgcBDAIMBwEMCgoNDQAMAAAADAsNAAMCDAUNBQoJDA0NBQICAAkEDA0AAQANDQgAAQ0AAwQBAQEACQ0MBQAMAgENAAAADQEAAQ0BBwIBDQENDQ0ADAIDDQIMBAIDAwAABQwNAgEEDQANAQAECQIDBQUABwEFDAEDAwwMAQQECQABDQAAAw0NDAwNDQwKAg0AAQwNAAEBDQIBAAAAAAABAQEKAgcNAgICAw0CBAQMDQINCA0MAgINDQIEAgEHAQEBBAANCQwBAAEDDQ0NAAwNDQUCAgQABAEABwAAAAAABwQCBAEEAAkMBw0CAgIAAwQNAQ0NBwwHAQMKCAAHAAEEAgADCwANCQQCAAINAgIMAQAABAQNDQcHCgkMDQQADQAKAQcAAQMIDQIDAA0CDQcBAAABDQEHCgAKAQwEAgAMCwIMAAwMBAEAAwIMCQkCAwMADAQCAA0BDQQKAQwCDAoCAwAADA0CAgEBAAAECQgACgMNBAENAQINDQMIDAwNDQ0NAAINAAAADAEMDQ0DCA0FDQ0EBw0BBAEEBA0NDQIBAQANAQwMBAUADQAIAQAHCQkAAA0ABwEBDQ0JCQACCgACAgwCBwAFAgAEAQINCgkNCQINAQIACgAIDQEBDQEHAQ0FAgQJCAAMAQwADQEABAEJDAkNCQwEAAwCAgECAgwAAwwMAgoABQIADQIMAwoBDQINAQUMDAEEDQABBwgECgwJAA0CBAcEBwAHDQQMDAUNAQIKBgQNBQECAQQBAAkJAwoDAgABAAQECwwAAQAFAAICBQ0EBA0BDAAMAQQCAAENDQAMAgAAAQ0BBAENCQANBQEMBwAIBQABBQwCBAQMAA0KDQkJCQwBCgwCBAACDAkJDQECAgIDAQcHDQEECQ0BAAwCAAMEAAwNBQQNDQ0AAAQNAAEJAQ0HAgABAA0ADQcKAAIKAAUABwAMBQcMDAQEAAkCDAABAgwIBQAKBAEBBwEKAQcBBwIBDAEFDQQDAgoCCwAHBAECAwkNAAQBAQ0BBAAABQAMCgoEAwAABAEHAAAAAQACAQ0CBwANAgUAAQQEAQECAgMMAQQNBAkMAgUNAAIADQwCAA0CAgQMAwIADAEBAQ0CDQEBBQIBCwEBAQABDQANBAkJCQ0NCgoABQUBDQwJAAAAAAIFDAMKBA0HAQQCDAwEBAIAAgENBQUCBwEEAgECDQwNAgMDAAAADAwADAUFCQQNDQIKAQAHCQ0CCQ0BAAIDBQAABQEBAQcLAQACDA0BAQ0KAgAADA0CCgEHAQQAAQAHBAQBAQwAAAAMCAwNAQcHDQsBCA0DBwQEDQAIAwUBAgoIDQAKCQwAAAIADQ0MAgIAAQcBBAwEDQ0BCAcMDQwDAgUECA0CCg0EAgQMAg0HBA0HBwEJAQwMDQ0CBwEAAgEJAAQAAA0JBA0EAg0CDAMADQAAAAAADQkFDQENBwIBAAINBwUMAQoAAQwKDAwAAwIBAAwEDQAAAAMHCQAECQkEDQwNBAQCAQQEAQoJAAAMBwIKAAAACgEDAgINAgECDQAEAQcCBAENDQAAAAcCBQ0DAAAADQgABA0NDQwBDQQNDQIMBAgEAQcACgUJDQIBAQ0ACQ0CAAsBDAwFAQIHBAAHCgwEDQsAAgABAAIADQANAgIAAQEAAAAABAAEDQ0FDQMADQEAAAABBAoAAAkADQUDAQ0BAAENAA0AAwQCDQUCDQsBBQEBDQkNAA0ECgEMAQICBAQBBwcNAQcAAgEKCQACAAkFAAIMAgIEAgIAAAEMAQQAAQAJDAACDAALAgIAAQEACwcBBAsJDQANAAwMAg0AAgACAQ0CCgoCAwwBAAcEAQAEAAoAAQwCCgwCAA0NAQ0HDQQACgwJAwUNAgEBDAkKAA0ABQIAAwANAgENAg0EAgQBAAAAAA0BDAIAAAwMAQICCwQBBAoMCQEAAgMDAgADCwIEAQQEBAQBBAEBAAAAAAcEAAkJCQEEDAIAAwUNDQEMBQENDQANAQEBCgEMAAIAAAABBQIBDAUNAQANCwECBgMMAgcADQACDAAADAIEAAcBDQEBDQcECQkACgAICQACAgANCwEBBwEBAQEEDQECAAAMAAANAgcJAQoAAAAFDQ0MAAwDAQ0FCw0ACQIJAAADAA0AAQAMAAENBA0CDAwEBwIEDQEADQ0NDQ0AAAINCgAJAAAABQwMAQQMBAQCBA0BDQQJCQ0BCwAABQoCBwABAAEMAgwADA0FAgAEAQQAAA0AAgENAgAAAA0KAQMAAAoNAAACDQ0KBwQADAAKAwAJDQ0BAQAHDQQNDAQNDA0AAQoJAAcNCgIAAAMDAgAKCg0IAQAACAINAAINDQENBAQNAA0BAAANBw0MDQwBDQIIAAANAQwBBgAAAAIIBAEBAAQNCQkCDQIADAkCCAANBAALAQEECAABCQANAAANAgAAAAACAgoBBwcECQEMCgkBAg0NAAMADQ0AAQ0KDA0NAAINBwQCBAIBAQABDQ0EDQAAAQ0ABQEMDAEADA0NBAQBBwwKAQkMAAUAAA0MAAUCAgAKBwEBAQEAAQwEAAwCAgEABwwJCgwDAwACDQMAAg0EDA0NBAMNAAABDQQICQENDQ0NAAACAQ0HCgEJBAECBQACBAAAAQECBw0BDQEEAAAMAAoMCAgADQMCDAQBAAgABAQBAAQECQEKDQ0NDQABDAIFAQEFDQICBAEEDQAEBwQNDQkNDQ0CAAAJCg0NAAACBAINAQAAAQkBDQQNAAsEAgUBCgkMAAEAAAIKDQoAAwwJAQQAAgEEAQENAQAADQABDQkNAAEDBwEFAQ0BBAENAgEKDQwACQwABAANAQcHDQANDQoBCQwNDQkNDQENCgMAAAAADQwLDQMMDQIDAA0CCQEKDA0BDQ0CDQENCAUMAAEBDAwJCQkNAg0DAgkMAAAMBQECAAcHDQ0BAQgABAEJCQ0MAwoBAQANDAAMDQMNAgwNAA0NAQAEAAANDAkHAQAKAAIMDQACBwMECgkEDAQAAA0ACgIAAgUBAQcABA0EDAANDQEAAAkKAAAKDAgCAAcADAkCDQ0MDQwAAAABBwwMBAkADQoAAgACBAQLDQIIAQIJBwENBA0LAQABAA0HDAMNAAICAAADDAgFAgcBAw0ADA0ACwQNDQoBAQAADA0BBAANDQ0BDQcBBAIGDQwCBAQNCgkJCQkADA0AAAICAQIBAA0HAwkCAg0HAQINAAEADQQJAgMAAAkCAA0CAAAMAAQFBQ0FCw0CAA0ADQ0JDAUJDA0IAQ0EAQEADA0BAQ0GCgoCAwQDCQ0AAAAJBQwNAQMNAgINBAcAAQEADA0EDAwFAwwCDQ0BDQAABQwBBAEDAwwBAAACCQkNDQAKCQ0NDA0EAgQNBAIFBA0AAwEBAQoAAwUAAA0MAQEDAQEAAA0CDAEMAA0BBAkCAAIFAAUNBA0EAQEAAAABAA0AAwoAAAwCAQEEAgEABQAEDQ0JAQcMAAEDAQMAAAkACAEBAgcBAA0BBwABCwMBDAECDQANAQkNDQ0KBwUHDQEADQEAAA0KCAMMAg0BAQEABA0BAQEADQQBDQANDQMNAAgCAgcABA0JDQABCQkNAgIADAUBAgENAAIMAgAAAAUFAAQHAQQBAQoMDA0ACg0CAAAFAQANDQIICAICDQAFAgAMAQwABwkACQsNDAMCDQICAA0DAAAMDAoCCgEEBwAADAEADQwKBQEDDQAADAIBAA0BAAQCAAoKAgwKAQAABAIJCQAMAQwCAAIADQAKDQINAQEAAAINBwQNBAkIAg0AAQ0KDAQBDQIBAQEAAAANDAoBDQMNAQEBAAEBAQQBAgkFAAAAAQwNDQENBQIBAwQEBw0EAAABAAwJDA0NAAMADQsNAg0AAA0LDQQAAAEAAAMMCQoACgAACgQADA0FDQEAAAAADQINAAAEAgECCQAAAAcEAAACCgkJDQ0MBA0BAAMCAg0NAAwMDAICDQ0ADQMCBw0MBQ0NDQIMAAQBDQwECwEAAAANCgACAA0EAQwCAAIMAgABBAEBAQEBBAABBAUKAQgNAAACAAwCDAECAg0EAQELAAEBAQENAAAMAQANBwECDQAAAA0NDQsEAAcNAAACAAANAAAIAAQEAgcCAQQAAAABDQ0AAA0JDAEHAA0CDQwAAQwKAwwJAgABBAABDQMBBwcIBAwBDQkBCQwAAA0KBwANAQAMDAAJDQwNAgIDAgEKAQ0DCg0LDQ0AAAENCQwJCQoCAAAMCw0NAgQHBwAAAQQEDQ0KCgEBAAAFCQAEAQEAAgABAgoEDQoADQoHDAAMDQ0BAgQCCgkJCg0NAgEMAAwNAQQEAQoCDQACAQAEBQEMDAEFDQoMAAEKAAMABQwBAgoJDQ0EAQEMAQsAAAUECQ0BCg0ADQ0CAAAMAwMCAggNBAICDQwADQ0BDQEAAAEBDQwJDQwJDAEMBAUACgoNAQ0AAAkCCg0CAQEHDA0ABAwADQIIAQQAAgIAAAAMCQgNAwIHBwUABQEJBAkNAAkKBAkNDAoKCgAADQAABA0NDQMDDQkAAA0NAA0NAg0NAg0BAQ0NDQkBDQ0MBAkFAAkMAgAADAAAAAAADQ0BDA0BDQACDQ0BAQEBBAEECgEMDQEBAA0ACQIAAgwBAA0HDQkJAAIDAAAAAQEHAAoJCQkDDAAADQ0NBQIDDQADDQUFAAICDA0BAgoBAQQNCAoIAAkMDAIAAA0NAAAAAAkAAAIMDQMADAAJDAIADQkBAgEMAQENAQEBAQcBCw0HAQAAAQECAAkJBAEBAgADAAAADQENDQICAQ0NBAAAAQEBAgwEAgACAgINAAkCAA0EAgABAAcBCQwBDQ0JAAwCDQMEBAQBAQEBDQ0NDQ0BCAkJAAwAAAANAwMDDQABAQMJAAwNCwMABQ0DDQ0EBAIDDQENAwACAQwBAQcKAQ0NCAAADQMDBQ0NDQENAAEADQUKAgEHBA0EDQAMAgoAAAIDDQENAAwFBAECAgEEAQAHBAwJCQkNAQsJBwAKAgAADAwNAAADCAwNAgEKAg0EDQINAQIBAA0BDQcEDQkJDA0CAAAKAQADAAANAQ0KBAACAQ0BAQQNAQcNAAEADQ0ABwwKAQIMAAwKAgIMAgMBAQEBCwEADQsBBAoBDQANAAkICgABAgAADQwNAAIADQ0NAQoNDQkAAAEADAsNCAUHDAACDQQEAQEEAQsNAwENDQcBBAkBCQwLAQwJAgAAAAANBQ0CBAABCwEBDQENBwEADQ0NDAwDDQEACQAKAAMDAA0KDQMADQAAAAoNAg0ADAsADQIMAgUNDQIHBAkADQ0NAAoIDQQADAcADAEADA0KBwkMAA0MBwoEAQQNDQwNCg0AAAoNAA0NAw0NDAAFAA0BAAENAQcNAQcBAQAAAA0BAQ0JDQwJAAUFAgkIDQwCAQoLAQIAAQIEAQcNCQkNDAcNAAANCgADAAACCgACAgIBDQkBBAIBAQMABwcBBAQHAAABAAwABAQJAgEAAAENDQwKDQMCDAMECQECCQoJAQEDAA0NAgQNBA0NAQ0BAQcKAg0EDQMAAQ0ACQQMCQkCDQMKAgAACgANAQcAAQIMAAILAAMDAAANAgIBAgQCDQUNDQENBAENAQ0AAQcNAA0NDQkJCQ0BBAoJAAICBQUIAA0ADQcBDQIKBA0NDQcABw0AAQMNAwAMAQkCDQENAAAJDQwNBAAMDQENDQ0ABAoADQoBCgEBCgUEAQ0AAgUBAA0EAQABAgQMDAwAAgIDAQwBAgICAwIBAQALAQcNDQkJAAEMDQMCDAoMAg0AAAUNAAoNAA0NCg0ADAwNAg0CAAEFBwIEDQ0BAQUNBA0BAQwBBwIABwAMCQkBCQAMDQUECQcCAA0NDQgBDQkAAgECBwcCAQIAAwQNAQ0ADQwEBQAKAA0NDQIBDQAJBwEABA0AAAUCDQ0NAA0NAAAAAAAABA0AAQgEAAkNAAoAAAELAgUNAA0ACQMADQAADQIADAMMAg0NDQ0EBw0NAwMNAAANBwQMAQwKAA0JDAwJDA0KDQAABQEEDQ0AAAoBDQAABA0HAQcHAwEHBwIMAg0ADAENDA0HDQkCCQoJAAINAQ0NDQsLAgMACQIMCA0AAgIFBwcEBQEBBwQADQkNDAEBCwANAA0NAw0NAA0MDA0ADQ0NAA0NAA0AAgANAA0NCQ0EAQEJAA0BDQQEAwQECgEAAwgGAAgNAQ0NBwEBDAQNBAwAAQAAAAUHAgAKCQENAAcNDAEMAg0NBAoIAQEJAQQHBAANAgwDCQwJBQwBBAcBDAAACg0ABQwABAICBAQBAAgNBAQHBAQNCQkMAQEJCQ0ADQMDAAIJCQANCQAABA0NBA0HBAkJDAIAAgoABQANAAIHDQENBAkNAgECCQwADQEBBwQNDQ0AAAQBDAoAAAwJDQkMBA0KDQ0JAAACDAABDQ0IDAUAAgwCAgUBDQEEDQ0ADQAADQABAQANCQ0AAwkNAAQBAA0EDQQNAg0NAQcABA0MAAwAAAwHAgwEAAcJAQAADAMAAAENBQ0FDQsKBwcBBA0AAgACCQwAAgwEAAwEDQkDAQICAQoMCQIAAAEMAQwBAA0ADA0AAQQBAwANAgIMAQgCAgoNAQ0EDQMAAQABDQQHAQENDAIACg0KBQINDQ0CAAAADQEKDQ0MDQENDAEIBQEBAQ0EBAIAAAMNBwwAAAkDAAAKDQACAA0CAgACAgwBAQ0NAA0JAAwCAgAAAgABDAkCAQcJDAAMCwUAAwwBCAcEDQcMAAQAAAACCA0ECQQCAAAFAAUKAAIBBQwMAgQCAAcBAQEBBwEAAAENDA0EDQkJAAkFAwAACQ0BAAAADQwADQAACQ0CDQENAgELDAEADQECDQQMDQ0JAAkJCQkBAQkBAAACAAANDQICDQ0ADA0NDQ0NAQIHBwQNDQ0NAQ0NAAEBAQACAAsCBAIBBwANAQQJDQEFAAkFAg0ACA0NAQENBAEHDQEEDQ0AAAAADQAACQ0NCQwNAgUDCQMCAAwMDAwNAgIFBwwBBwsMBA0HAgQKCQ0MAQQHAQ0AAgAAAA0NAQ0ADQkMDQAICAEDDQ0CDQoJDQIEAg0NAQEAAQABAQEBBA0NDQwMAAEADQACAAkADQAADQkMAQkMAAAABQ0CAAAJAA0NAAwNDQMKAgUDDQ0CDQACAQQCDQEBDQ0EDA0NAAAHBw0AAg0CAQANAQINAAANDQ0FDQ0BDQcBDQABAQQJBQMAAg0BAAwHCgACDAIFBAoBAgENAQ0NDQEHAQ0IDQkNAQwNDQ0KAQoNAg0JDQALAAAJAgQADQAMBAsAAAQEDQQMDQEBBwEADQ0KAwINAAkEAgANDQQEAQ0EAQAEDQENDQQABwEBCgkJDQsKAA0FBA0BDQAMDA0NAg0AAAAADQwKDQINDQECAQcBAQ0BAQENAgIBAwAAAAcAAAAAAAkMDAIAAgwFDQIEBwABDQEKCQoFBQINAQQEDQAAAAEKDAwBCwECDQIHAQ0AAA0DBwoBCQsJDQwCBAwKAgANAAIJCQAADQwDAAoNBQ0ADQIJDQ0NDA0EDAcBBwcHDA0NCgAABAwAAQkKCg0KAAwJDQwBAQAAAgABDQENAgoNAAAIDQ0BAgAIDA0CDQ0CAg0AAQcNAQ0KAQ0ADQQNDQcBDQINBwANDQUBDQMICQ0CAgINAAIEAQEBDQEBDQ0BBAgBBAQDAAUCAwMNDQAABQ0DDQoNDAEEAAAADAENCQoNDQEBAQEBAwAAAA0DDQAJAAwCCAwAAAAAAQQBDQ0BDQAAAAAJAAENCAQEDQkACQkNDQwNAQQADQAAAAADDAEDAAMCDQEFDAMDDQUNAw0AAAICDQ0BDQQCAg0EDQ0LDQABAQAHDQEBAQEDBA0BDQoKCgkBAA0AAgwBBQ0NDQQNAQQBBw0AAA0NAQQBCgkJDAgCAgAACQUNAAICAg0FBQ0BAg0EBAcHAAENAAANAQEBBwcNAQEBDQ0EAwAADAENBAoNDQQCCgEHBwcHDQAAAA0BAAQNCQkDDQMMAQoABwUNBwAKAA0BDAINDQUADQ0NAgIBBwsHAQcNBAEAAAANDAEJBAcMCQIKAAEKAgUNAA0AAAECDQ0NAAAHBQEBDQAFCQENDQcNDQEBAQANAwQJAgoNBQMCAgAABQQCAQENAQQEDQoJCQ0BCgUNAw0CCAANCQQHDAgCAQMBDQ0BAQwHAQ0AAAQAAAEMDAkNDAENAAQCCg0AAAABBwwNDQAADAQCAAwCAgIBAwQNDQ0ADQQNBwcMBQEBDQAAAA0BBAkNAA0NDAwADQ0ADQ0ACQEAAAoMAA0ADA0MCg0BDQ0BDQoNAQUBAAENAAAEAAIJCQkAAgAMAAUDDQkNAg0BDQACAA0IAgwJAg0AAgENAQECBA0HBAEAAAANBA0ACQkJCQ0ABgANAw0NAwAHDAwAAQMJBQAEAg0NDQMNBwENDQMEAQEBBA0MAAECAgkNAA0MAAMNDQINAAAAAAAMDAABAA0NDQ0CAggCDA0CDAAEBQQNBwANDQcEDQkMCQ0JCQkEAQAKAAUNBQEBDAgKAAACAgoIDQwLAA0BAQEADQEHDQQEBwIAAA0FBAcDCgwJCgAAAQIAAQANDQINAgEBAQ0NAgAIAAECAAANDQwMAg0CDQIJAAEABAQNCgwJCQkEDQEJDQ0AAQ0NDQAAAA0MDAENCw0NDQINAg0LDQMNCwEADQENCQkJAAAJAwMCDQwNAAMAAAAAAwgKAw0FAAwNBAQEAg0AAQcNDQ0NDQQBAAAABwcHAQkJCQkNCQQBAgkEAAMNDQoCAgECBAEBAAABAAcNBAwMBAAMDQoKAAMAAAIAAAsIAgEHDQ0NBA0HAAMAAAwNAA0AAAoKDQAFAwENDQYAAAEKDQ0FCgANCQENDA0BDQIMDAQNDQEHBQcBDQIMAA0NAA0NBw0EBw0NBA0FAAkJDAEMCgAEDQ0DAwAAAAEJAAUMAQEHAAACAgAAAQILDAAAAAAFDQkNAQEAAAAAAAoHDA0BAAIHAwEAAA0AAAEBDQwMDA0MBQkMDQABAg0NCg0FBQ0NDQ0JAAENAgAACgcNAAUNAAgNCgINDQ0CDQANDQ0CAQEHBwcBDQQNDQcEBAANBwcICA0NDQwNCQwADQ0EDQMKAgANAAAAAAkMAAMCBAQAAgEHBwENAQUAAQANDQQNDQ0EAQMCBQECDQIMDA0DDAQMAAINBAEBAQEMAAEJAAkMDAIFAAEADQAJAAIKBwAKAQUFAQEBCwIEDQwNCQENCwsJDQwNDQAADQUNDAkADQwNDQENAQ0FCgUCDQ0NBAQNCw0EBwQNAgEEAAABAA0FAA0HAQkJDA0NAAAHDAwAAw0ADAINAg0CAgEADQIBAAECCgQBCQ0KDAkJBwQMDAAAAAgMAAIAAAAMAQQBBQENAAkCDQ0NAQADDQcNAAQHAQ0NCQANDQ0NAQwMAQANAAANDAECAQgNDQ0DAgIACg0ADQ0CCA0JBQAMDQMNAgcNAQEHAwcEAQENDQQBAgEAAA0BBAANCA0ABAkFAgIKAAADBQQNBA0AAQQNBwIMBA0ECgwNDA0HAAkACgEMAwEABAEMCQENDA0JAA0ADQUMAQ0HCQcAAwAADQ0HAA0KAQQIDQkEAAALDQcBAQENCwQAAAABBAEACQkNAQwBAAANAAAAAA0NAQ0BAAQNAwENCgENDQMNAA0EDQMNDQAKCg0NCgMJDQQKCgoIAAAAAg0DDAQJAAcHBA0MAgkNBAEHAgAAAA0DAQQKCgwNDAcBBwkBAgAMCgoNCQoJAAABAQwFCggNAQkMAwENCwEBAAAAAAwBDAENDQAFDAADAA0MDAUNBwEHCwEAAAwACgkNDQ0ADQ0MAw0NAAwADQANDAEAAwINBAcIAgIFBwENBw0HAA0BBwENDQ0AAgoNDQoNDQkJAAEBAQEHAA0NAAANDQICAAAADQANCgoCDAIBCAANAAwCDQABAQEHAQQNAwEEAAABAQAHCQwEDQwNCQAJAQ0NDQAAAAoBDA0CCQAAAA0NDQUFAg0MDQ0AAgINDAEADQEHDQAMAA0BBAwABAcACQEBDQICAgANAA0DDQUJDAgCAQIIAQoDDQUMAgANCgUCDQcADQAHDQIHAQwMDAEMAQsFDQUNAgINDQANAA0DDQEDDQABAQwMDA0BAAABCQwCDQ0EBAANDQ0BDQ0NAA0AAAABBw0HDQ0BCQkADQEDCQAKAwwNCQ0CDAwJDQICDQIEDQENDQQAAAwAAQENCQwMBAANDAIACQ0ADQwNBQACDQcNDAQCDQEBDQkBAQQADQ0BDQAMDQQNAAwKCQkJAAEADAEJCQQNDQ0NDQANAwMDAgUMBAEEBAACAQENAAQBBA0EAA0BCgADBwQIDQEAAAwNCQkNDAAEAAAADQgAAQoMAAAADA0MBwUABA0CAAEHAQQBAQ0MAAMBBAwNBAAEAQoDCQ0NDQ0AAA0KCgUNDAMBAg0ADQUAAAoAAw0NDQEDDQ0ADQ0CDQECAQ0NBw0BAQ0NCw0NDAAMBAAACwcDCQEKDAwAAAEAAAwNAw0JDQIMAQEDBwANDQcCDQoJAAQBAAwNCgwJCgAMBQINAg0CAQAMAA0MDAwFCAAACAENAAACAQ0NBwcNBwAAAA0NBgUJCQANDAsKDQANDQoADQUHAAwJAgEDDA0ADAcNDQ0NDQAAAQ0BAQELDQANCg0EDQ0EDAwNCgkIAAwEDAINAQINCQsHAgwNDQsCAgABAQcEDQQHAQABAAcBAAQNDAINDQ0NDQAJAA0CDQ0NAQoEAgINDQMCDQIBCgQDDQkJAAwDAAcBDQACAQACAAICAgENDQABDQAAAQAHDQAMAA0NDQMAAAAADQ0GDA0AAA0CDAoCCAIMBQENAgEAAQcCAQcNAAAAAAEBBwwNDAINCQ0BCQgACgEKDQADAQAADA0NDQQNAg0NDQ0AAwANAA0AAAcEBwABDQ0MBQANDQ0CAAoKBQ0BAQ0JDQ0AAgEAAAAMCQ0NAgIKAgwABQkEDQoNAQ0BAQENAQ0BAQ0AAAANAQcACQgNAAQNCQkJCQkJDAEJAg0NAwAMBw0MAAwEAgINAg0NAgQNAQQNAQQAAAANAAINBwcNAgwKCQkAAAIDAA0BCQABDA0IDQIMAgANAgEBAAcMDQEAAA0CBAcHDQACCQoJCQ0NAQABAgwNCgMABwoNDQENAgMEAA0HAQ0ADAAMDAQKBQ0HCgwCAAMDAAAKAAAKAwUFCAACAAICCQ0EAQQEAQABBAEEDQABAQABDAkJCQ0BDAANDQ0NAAQNDQANAQEFDQAADQkIAAUNDQgNBQUJAQ0KBAEBDQ0HBw0EAg0EAQENBAwNCgoJAAQBBAAAAAABDQANDQIJDAAMDQALAAENAA0ADQQEDQINAA0BAwAADA0AAQQNDQwEDQECAAABDA0NAQ0NBAIADAIMDQ0KBQUCAA0AAQIADQQABAEAAAAADAAADQ0ECQEMDQ0KAA0DAAAADQAMDQENBQENAQQAAg0BBQEEDQQBAA0CBA0KCgwNAAoNDAkEDAMMDQ0ADQIBDQwEDAIBCA0BBwQCCwQNAQABAAAAAQkJDAANCQkJAQwABAoNDQAAAAAACg0NCQsCAA0CDQ0EBAgCDAEBDQABAg0AAQEBAAAHBAEHBAkCCQkJCQwNDAoACQAFAA0EAAAADA0ACA0FDQMNAwIDAQENAA0ACAwHDQcACQ0JDQIJAgMDAwIDCQMAAAABDQACAwMACQ0ABwECAAEHAQIBAwQADQANDAADBwIADQkNAAwMAAUCDQoNDQAADQwNAQ0NAQ0ADQ0NCQAHDQQLBAQNAAgADQQMDQkJDQAADQEEAAMKDQINAAAMCAANAgsLAAgMAAAADQEBDQcBAQcNAgQNDQANAA0AAQQBAQANBQMBAgENCgAAAQANAgkNAA0ACAgDDQIADQ0JDQ0EDQICDQ0NDQEBDQQBDQAEAAACAAoNDQ0JBAANAgAFBwACAwIAAAANDAIADQ0DBAcNAgEFAQAAAQQJAAwMDQAKAAAMAgEADQoCAQ0IDQ0NDQMDDA0BAg0CAAANBQcAAQcBAAEHAAANDQAADQcEDQ0BAAAEDQACCQkNDQECAAIADQoAAgAAAA0MDAMNAQ0CAQEBBwcNDQENAQ0HDAENCQkBCg0NDQ0AAwIAAAABAA0IDQEFCgIBAQIMBwEBAQ0ADQEAAAENAAAAAAcNDQ0KCgENAAcAAAMNBw0GDAACAAcADQAADQoNAQ0ACgMADAwCDAoNAgEADQMNAAEADAwEBQoIDQENAQ0NAA0NAwEHAAwLBQEMDQ0JCQIEAAABCgMGDAEBDQ0IDQENDQIJDQ0NCgICAAkCBAcBAwMNAQABCgACAwcBBA0ADAMNBA0EBA0NAA0NAw0MBQwNAQABDQ0HAAAADAUEBwEDAAENDAoKAAAAAAgADAgCAA0NCAUFDAANAQUEDQ0JBwQHCwcBAAQNDQENBw0NCQwMCAcNDQAJAAENAAgBBQ0NAgcAAgIHAAEEAA0IAQAAAgkABAAAAAMNBAMCDAoMCQENDQIEBAENBAcLDQEAAAAMDQEEDAgHAQAJAAgFAQMNDA0CAAoMDQ0NDQwMDQoFDQUJDAEHBw0EAAcNAAANBAcAAAAAAgAAAQE=","prev":"d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3Z3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d2d3d3d3d3d3d3d3d3d3d3d3dpd3d3d3d2d3d3d3d3Znd3d3d3dnd3d3d3d3d3dWp0d3d3d3d3dnd3d3d3d3d3d3d3d3Z3d3d3dnd3d3d3d3dzd3d3d3d3d3Nyd3d3d3d3dnd3d3d3d3d3dHd3d3d3d3d3d3d3d3d3cnd3aXd3dnZ2d3ZkY3d3dHZ3d3d3d3d3d3Z0dHd3d3d3d3Vzd3d3Ynd2dXd3d1B3d3N1d3d3d3d3d3d3d3d3d293d3d3d3d3d2R3dnZsc3d3d3ZzdVx3d3dvdnd0d3d3d2V3Z3JVd3d3YXZyd2FpcHdkd3F1dE9vdndvd3d3d3d3d3d3d3d2dXZ2d3F3d3Z3dHd3dndjdndSd3d3d3d3d2Vyd3Fvd3ddd3d2and3d3d1d2Vzd3dwd3Zkd1p1bmR3a3d3dXBad3Z2dmZ3d3d3d250d1Fycmx3dnd3d3JzbXR3Z1x0d1V2c3dpaXdbd2Vvb1tzd3d3d1pid3Z1d3N2ZnJddnV0bHdzdnZmc3d3d2p3d29vdnd1d3d3dnJzW3dKdEF2d3dkdnN1dk11dHFxbXV1c3dmdXdwcnVoa3VAdWl3d3drdzt3d3V3dm5xcEt3d3dsX0RuWnN1d0lzdnZ2SHV1d3dnd253d3Z3VG9ZdHdud3d2dnJDb3Z3SGh2dHVpcWFCVW11Um93Xl12d0Jzal92dUtnd3N2d3dncUxydndxd3R3dG93cml3dndQXXdscXd3dkVndnJ3YXddd2p3c2p2bnR0Rk5TbncvcHded19xbHJ2MVVGd1lgbXd3d0d2YXZrd3dEdm1MYnRvdlRdcih3a3Nxd3ZXbnR3dFd0dmxqbmZ0cXR3U3ZxLFp1d3dzW3Zid3R3d3dvd2psd3Z3dFlrUnc7ajB1dndOc29ra2lzVnJdd3BydThyVXZpd1FPd3d3dnV3amh3dmtzYE11d3dta0F3d21iWVBxX3ZdX1ZqcTRtQl9vbDZxdDtlcHR3YGVmZV5Vd3d3Y3d3RHBMdnZAcmdvdnJvdnV2aWdPbGYwdG9Kc2N0Y2lzdlpLbnU6KHVxN25JdHB1amlydXVTakdddGRXTFxNdHVfVW1yd3dAZmVjX2k8dWhmam53VnZucl50XmJ3aHNuZ0JvY0pSUmJrYHZqd1tsdSs7blNbc25Yd2FwdmJzLXcubi4eXHFuRXRsQjZnd3d1cGhqW3dwZUVcWVVkRktObnR2Z3dyXS9mPHIhdmF2TnZzVGt1ZF9uZnFncXVrYyN0dDVpU3ZyaG5YXF9nd0pvcWB3d1xjcHZyX2ViZzNnXFppW21RdUcwRXZkMGZAbUNwVltvRW52bXE5SXMpXVVvX0t1W2tec15NZU91dHBlY2hWYUVsc2dsRVV2b2diPHFlXWhQRlZxdGd1dkpgSGhVXFZmXFZYZ08lXXF0ZmNeXkppcVprcDtQY3NYdGgwQW9qJmFjaW9naGNza2d3c0peaCddcGRdYiJGZ2EtcHNram5NNU1Tb2daaylMQ2ckUGNlUWhTZ00jdW9OaWZecHBAanRePGtbO3ZrbklnV0dbbmtlQ0N3TF9LaGtpJT1qZl5yZUhSPk9iUmtbRlxFNVVFaDg+cm5EVVtZdGNdTTpeMWZMKFVFW1dlTjZvXGwkQG1MbExxZDZiUjxjSUk5KlxrQjtDNXRNPFY2V1ZBYFEsKzpSYylEYldcSV9HWm84SipGaF5xayhsc2Y5ZmEdX1ZdblBsJjpNSmxTdlE0RytfM2FBXSpiRipqaTxIbUdHIWo/UUBXdDIuSV1wQVJmX2BfWllOWUtXXUd0biVcUVUlQWBPPWJdZDNPbE9ZJFxfZSxSaCpuRSMyQGlERko9bmN1JF87RFlnSjdmSUxdYDtaZVojWjMgLR1rTWhIMkZBW2M6bDM5WzoYSm11T1tLIEcxdVhdaGteHW9IaS4+HFVKMDxtWSQnQjBkJD1dVEhpTHVjIGdOZB1FTFY/U1FTSzEwQjhvY1FWRTpbLTs0K1w6WzlqT2ElODViImEsQThHW19DZFNbKWJgVDwmTWI0RF1JHTBGQThDWF07JDk7K1VfF1MwaUksOjBgOU9KPipOKWBxVy5Nb1gvXGZvQz5hQFdaRXQ8ZE4/YmBoYUdbUyxMVUZUSUxVMUsqHFskLEQdZkBAS1kgZjIgHVtdJGRNTlZyMjU3VGEsOWpVQlMtQhs9QRszJjFOPB11GTcdPFIaNDM/NExEQlFgWhtHMjwhXS4dMDMyHl4+Zl44OihfGVNBGVZOTB4g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HQYSAhkhERUdCBsIGgECBR4ZBAgEBwELIwkNHQoJEhIJAx4HDBMJCBMKCAkQDAMHBQwBGAYJFAQcBQ8EDxMLGA8BCQIRARUCHAgGBRwECAEMBBYOEQMEAQkVARoKAQkGBBgGBAYCBAgBDQUXCgMZDwwLBhANBgoJBBEOCgEEBQQKBAQYGwgZAQUGBBEbGBAaCgsKBw4DAgMCBw0JCAUDAgoHEAEbBAUDCQMGCQ8BCgEUBQ0GDw0DBg4PDwQDBQEZAggLDQEHBg4GAQEBEgULDwwIAQEECgwDCgEBAhAPAwEFCg0BAQ8KBAIHBwcBBxMHAQEGFQEHBgUIBAcBBAgIDAIEAQQBEAkBCQgGBQsBDAELEAEECQQMBwIBDQEBDQgKCwUHAQUHBwECEgoEDwYJCQgECAEEAwEKBQ4BAQEGBAQJCAQBAQUDAQUFCAIBBQcSAgcFBAMFDAUBAQMBBgIDAQ0MAQUHAwEBBgEFAQcGDgwBBAEKBAEEAQEBAQ0BBgEBAQgKAwIFAQcIBwEFBgENBAoECQwQCAEHAgUDAgoGBAEBAQYBBwYBCQMCAQQJAQEBCwUECQsCBQIICwEBAQoBAwEBAQgDBgIBAwMCAwcBAQECCQwBBQoICAYCAQoBBgEIAQEMAQECAQEEAQEBAQQGBQQBBwEIAQQBAgEBAgkKBwkBAQIHAQEBAQECAQUBAwEBAQEBAgYCAQIMAQEBAQEBBAYBBwEBAQEGAQIDCQEHBwEGAgIBBAEBAQEBAQEBCAMBAQEDCAEBBQgBBwEFAQIBAQEBAQEKBQYBAQQBAQEBAQEBAQEMCAEGAQEIAQIBAQMBAQIDBAoBAwEGAQEKAQEEAQgBAQEBAgYBBAEBAQgCBAUBBAEKBQcBAQUCAQECAQECBgMBAgIBBAEBAQEBBQUBAQcBAQECAQEBAQQDAgEFBAEBBAQDAgEBAgEBBAEBBAEBAQEBAQEBAQECAQICAQEFAQQBAQYFAQECAQECAgYDAQEBAQECAQYBAQECBgEEAQEBAQEBAQEBAQUFAwMBBwEBAQMDAQMBBQEBAQEKAQECAQEBBAMCAQEDAgEGAgcGCAELAQMCAQEBBgEBAQEDAQEHAgEBAgUBAQEBAQEBAQEBAQUBAQUDAQEBAQEHAQECAQoGAQIBAgEBAQEBAQUBAQEBAQEBAQIFAQEBAwIEBQEBBAEJBQEFAgEFBAYBAQEEAQECAQEBAQEBAQECAQEBAQEBCAMEAQEBAQEBAQIBAQEHBgIDAQEEAgcEAQEBAQEBAgMCAwEBBAEBAQYBAQEBAQEBAQEBAQEBAgEBBgEBAQECAQEBCQEBAQEBAQYIAwEBAgEBAQECAQQBAQEBAQUBAQECAQECAQEBAQEBBAEBAQEBAQEBAQEBAQEBCQEBAgEEBAECAwEBAQEFAQMBAQEEAQEBAQUGAQEBAwEBAwEBAQEBAQUBAQEBAQEBAQEBAQkBAwEDBQEGAgEEAQEBAQEBAQEBAQEBAQMBBAEBBgEEBQEBAQIBAQEBBQEEBAIBAQEGBQEBAQEBAwMBBAQCAQEBAQcBAgEBAgECAQEBAgEBAQcDBQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAwUBBAIBBQEBAQEBAQEDBgIBAQYBAQEBAQEBAQMBAgEBAQEBAQEBAQEBAQECBgIDAQEBAQYBAQEBAQEBAQUBBQEBAwEBAQEHAQECAQEBAgEBAQIBAQEBAQEBAQUFBAEBAQEBAQEBAQEBAQMBAQECAgIBAQEBAQEBAQEBAQQCAQIFAQEBAQECBAEBAQEBAwEBAwEBAQEDAQEBAQEBAgEBAQMBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAgEBAQEBAQIDAQIBAQMBAQEBAwQBAQEBAQEBAQECAgEBBAICBgEBAQECAQQBAQEBAQEBAQEBAQEBAQEBAQEBAQQBAQEBAQEBAQEBAQEEAwQBAQEBAQEBAQECAQEBAgEBAQEBAQEBAQQCAQEEAQEDAwEBAQEBAQEBAQIBAQEBAQEGAQYBAQEBAQEDAQEEAgQBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEFAQIBAQEBAQEBAQIEAQIBAQYEAQEFAQEBAQEBAQEBAQEBAQEBAQEBAwQBAQEBAQEBAQEBAgEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQMDAQEBAQEBAQEBAQEBAQEBAQEBAQQBAQEBAQEBAQEBAQIBAQIEAQMBAQEBAQEBAQEBAQEBAQECAwEBAQEBAQEBAQEBAQEBAQEBAQQBAQEBBAEBAwEBAQEBAQEBBAEBAQEBAQEBAQEBAQEBAQEBAwIBAgEBAQEBAQICAQEBAQEBAQEBAQEBAQEBAQEBBAMBAQECAQEBAQEDAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAwEBAQEBAgEBAQEDAQEBAQEBAQIBAQEBAwEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAwQBAQMBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBBAEFAwEBAwEBAgEBAQEDAQEBAQMBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQQBAQEBAQMBAQEBBQEBAQEEAQMCAQEBAQEBAQEDAQIBAQEBAQIBBgEBAgEBAQEBAQEBAQYBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQUBAQEBAQEBAQEBAQEBAQEBAQEBBgEBAQECAgMDAgMBAQEBAQEBAQEBAwEBAQEBAQEBAQEBAQEBAQEBAwEEAQEBAQEBAQEBAQEBAQEBAQEBAQEDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEFAQEBAQEBAQEDAQEBAQECAwEBAQEBAQEBAQQBAQECAQEEAQEBAQEBAQEBAQEBAQEBAQEBAQEBBQEBAQECAQEBAQEBAQEBAQEBAQEBAgEBAgEBAQEBAQEBAwEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBBAEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgIBAgICAQEBAQEGAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQQBAQIDAwEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQQBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQIBAQEBAQEBAQEBAQEBAwEBAQEBAQEBAQMCAQEDAgEFAQEBAQEBAQEBAQEBAQEBAQEBAgECAgEBAQEBAQEBAQEBAQQBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAwMBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQECAQEBAQEBAQEBAQIBAQEBAQMBAQEBAQEBAQEBAQEDAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBBQQBAQEBAQEBAQICAQEBAQEBAgEBBAEBAgEBAQEBAQEBAQEBAQEBAQEBAwEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQMBAQEBAQEBAQUBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAwEBAQQBAQEDAgEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQIBAQEBBAEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAgMCAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQMBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAwEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBBAEBAgEBAQEBAQEBAQIBAQEBAQEBAQEBAQMBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEDAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQMBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAwIBAQEBAQEBAQEBAQECAQEBAQICAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQECAgEBAQEBAQEBAgIBAQEBAgIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAgMCAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQECAgEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAwEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQMBAQEBAgEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgECAQEBAQEBAQEBAQECAQEBAQEBAQIBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAgEBAgIBAQIDAgEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQMBAQEBAQEBAwEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgEBAQEBAQEBAQEBAQEBAQEBAQECAgEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQECAQEBAgIDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQICAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgICAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQECAgIBAQECAQEBAQECAQEBAQEBAQMCAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAwEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAgIBAgICAgIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQMBAQEBAQEBAQEBAgIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAwEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAwEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQICAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQMBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQMBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQICAgEBAQEBAQICAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQICAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=","ab":"8ODf3tzb2trX19fW1NPT0tLQzs3My8vKysnJycjIx8bGxsbFxcXFxMTExMPDwsLCwsLBwcHBwcDAwMDAwMDAwMC/v7+/v76+vr6+vr6+vr29vb29vb29vb29vby8vLy8vLy8vLy8vLy8u7u7u7u7u7u7urq6urq6urq6urq6urm5ubm5ubm5ubm5ubm5ubm5ubm4uLi4uLi4uLi4uLi4uLi3t7e3t7e3t7e2tra2tra2tra2tra2tra2tra1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0s7Ozs7Ozs7Ozs7KysrKysrKysrKysrKysrKysrKysrKysbGxsbGxsbGxsbGxsbGxsbGxsbCwsLCwsLCwsLCwsLCwsLCwsLCwr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr66urq6urq6urq6urq6urq6urq6urq6urq6urq6tra2tra2tra2tra2tra2tra2srKysrKysrKysrKysrKysrKysrKysrKyrq6urq6urq6urq6urq6urq6urq6urq6uqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpqampqampqampqampqampqampqampqampqampqaioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKinp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enpqampqampqampqampqampqampqampqampqampqampqWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSko6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6OjoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCfn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fnp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2cnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJybm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubmpqampqampqampqampqampqampqampqampqampqampqampqampqampqampqamZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJeXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6OjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjYyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiomJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4aGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fXx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3p6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHd3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3Z2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0c3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3NzcnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcG9vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbWxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2trampqampqampqampqampqampqampqampqampqampqampqampqaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2ZmZmZmZmZmZmZmZmZmZmZmZmZmZmVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmFhYWFhYWFhYWFhYWFhYWFhYWFhYWBgYGBgYGBgYGBgYGBgYGBgYGBgYGBfX19fX19fX19fX19fX19fX19fX19eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5dXV1dXV1dXV1dXV1dXV1dXV1dXV1cXFxcXFxcXFxcXFxcXFxcW1tbW1tbW1tbW1tbW1tbWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYV1dXV1dXV1dXV1dXV1dXV1dXV1dXVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTUxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSklJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAPz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PTw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3NzY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCsrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiopKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHRwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWExMTDw4=","guild":"AAAAAQABAAAAAAAAAQAAAAUAAQUAAAQABQAAAAAFAAAFAAAAAgAAAAEAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAAUAAAAAAAAAAAAAAAAAAAUAAAAAAAAFAAAAAAUAAAAAAAAAAAADAAAAAAAAAAAAAAAAAgEAAAAAAAAAAAAAAAAABQAAAAAAAAUAAAAAAAAFAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQUFAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAABAAAAAAAAAEAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAABQAAAAAABQAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAABQAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAABAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAFAAAAAAUAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAFAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAABAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAUAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAUAAAAFAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAEAAAAAAAAABAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAUAAAAEAAAFAAAAAAAAAAAAAAUAAAUFAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAUAAAEAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAUABQAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAFAAAAAAAAAAAAAAEABQAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAQAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAUFAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAABQAAAAAAAAUAAAAAAAEAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAAAAAABQAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAABAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAAAAAUAAAAAAAAAAAAAAAUAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAQAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAUABQAFAAQAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAUAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQQAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAFAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAQAFAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAQAAAAAAAAAAAUAAAAAAAAABQAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAFAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAFAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAEAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAABQAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAFAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAFAAAAAAAFAAAAAAAFAQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAEAAAAAAAEAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUEAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAUAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAABAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAABQAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAQUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAUFAAA="},"common":{"n":3384,"prevalence":0.2,"readShare":0.946,"idx":"AAABAAMAAgAEAAYABQAHAAoACAAJAAsADAAOAA0ADwAQABEAEgATABQAFQAWABcAGAAZABsAGgAcAB0AHgAfACIAIAAoACEAIwAmACUAJAApACcAKgArACwALgAwAC0AMQAyAC8AMwA6ADgANwA5ADQANQA/ADwAQQA+AEoAOwA9AEAATgA2AEQAQgBDAEUARwBIAE8ATQBJAEYAUwBVAFIASwBMAFAAVwBUAGIAXQBRAFkAVgBYAGMAZgBgAGEAXgBbAFwAbABoAGkAWgBnAGUAZABxAF8AdwBqAGsAbgB4AHIAbwBtAHoAdQBwAHYAcwB+AH0AfAB/AIMAhQCYAHQAgQCLAIQAeQCWAIAAewCCAIwAiACQAJMAigCHAI4AlQCUAKkAjwCRAI0AkgCJAJsAnwCGAJ4ApACdAJoAnACXAJkArQCjAKoAoQCrAKIAoACmALkApwCuALEApQCoALoAsAC1AKwAswDCALsAwQC0AOIAvQCyAMkAvgCvAMAAvADIANkA3wC2ANAAxQDeAL8AuADXAMMAtwDYANsA0gDdANMA7QDPAMwA3ADRANQA2gDHAOcA5ADNAMQAxgDlAMoA7gDxAM4AywDmAOsA9ADgAOwA1QDjAOEA6ADpAPMA7wDWAPUA8gDqAAoB+wD5APgAAwEEAfcA+gABAf8A/ADwAAcBFgEQAfYAGAEaAQUB/gAXARsBCQESASIBAAEyARkBEQENARQBCAEOAQsBLQEuARUBBgEmARMBKwEdAf0AJQEcASABIQEjAQ8BAgEeASwBNAE6AR8BJwFBAT0BUAEpASgBOAFFASQBRAE1AS8BDAEzAVwBPgFJAVYBMAEqAUYBTAE/AUMBMQE7AV0BNgFZAVQBQgFOAUoBUgFrAWYBWgFLAUgBXwFYAU0BZQGZAUABXgE5AWABVwFRAU8BWwFHATcBYwGBAWEBaQFqAWwBZAFxAW4BeQGDAZYBPAFoAYABeAF0AYIBdgFiAZQBZwF3AXwBhQF6AW8BcAGHAW0BcgGTAYgBhAGYAZIBtwGKAZ4BUwF+AXUBjgGuAZ8BfwF9AZABewHAAZwBiwGRAZ0BhgGJAY0BlwFVAagBpwGkAcUBpgGhAbkBowGlAakBjAGaAaIBvQGVAbwBuAHJAa0BsgHYAeUBrAG1AZsBuwGwAbYBwwG/AXMBswEgAo8BwQHNAcgBzgGxAdwBywHGAcoBxAGqAaAB1AHPAe8BwgG+AeQB6AHmAbQB0gGvAd8B1gHeAdUBugHqAasB0QHpAeAB7AHhAdMB2QHXAQEC/AHjAccBEgLbAfIB0AHxAd0B7gEFAgkCBAL/AesB+AHtAZ4C8AHaARMC+QExAvMBDQL9AQ4C9AH3AecBzAH1AWECFAIkAuIBAAL+AToCDAIhAvYBGwIdAhECCgIXAgMCQAIHAh8CAgIpAisCBgL6ATwCVQIlAgsCOwIQAvsBOQJGAkECLwIjAigCJgIiAhgCCAIeApsCDwIcAhoCLAJKAhYCRAJfAicCKgIVAlECTQItAnUCNgI4AjQCGQJbAp8CQwIwAj4CRQIzAi4CSwI3AjICVgJ+Aj0CfQJHAmMCYgJIAmQChQJQAkwCYAJ6ArYGPwJaAk4CQgJtAsACXAJZAnICZwJSAlMCbwJoAoICwwJmAnYCagJeAk8CZQJYApUCgAKWAnwCtAJ3AowC4gJwAkkCjQJUAnsCgQJxAoYCeQJpAqICkQJsAnMC5QJ/ApQCmAJdAlwDiQKaAoQCNQJ0AqoCeAKoAosCEwOhAooCuQKdAlcCjgKZAmsCsAK3Aq0CxgKpAskCGQPmAsQCuALIAogCkgKjAqcC2ALNAt8CpgKkAq8C1wKrAm4CrAKcApcCxQK/AswCkAK6ApMCrgK2Ar0CpQLSAscC0QKyAoMC3QKPAv0CswIHA/8CuwLKAucC6QKxAgYDoAL8AuwCzwJtA+ACvgLWAtUCvALCAugCwQLUAs4C0wIEA9ACywLeAtwC4QLvAvACAwMPAwED9wLrAtkC9gK1Aj0D+QLyAg0DEAP+Ai0DGgOHAvMC2wL4AuoCAgPtAuQCIQMqAxgDOgPjAkMDBQPxAvQC7gI5Aw4D9QIXAxsDDAMlAz8D2gJAA3oDMwMgAx0DEQMUA1gDCAMyAyYDSwNjA/oCAAMSAzcDCgMnA1EDHgMxA2sDIwMuA08DZwMJA/sC0gMLA1sD1gNJAyQDVwNFAywDMAMrA1oDLwMoA0EDcANdA1UDRAN7AykDFgMcAxUDNAM1A2ADcwN9A0gDTAM4Ax8DOwNsA08EWQNWAzYDFQRKA2gDIgM+AzwDbgN3A0IDYgNOA14DkANTA1IDiANHA00DgwNvA3IDjwN4A18DjAOEA4IDVANkA7kDdAOWA6MD6wOSA3UDgQO8A2kDZgOnA2UDmQOLA/EDjQOHA8UDkwN+A2EDnAOAA3EDfAO0A6YDhgNQA6gD3wOFA3YDrAO9A7oEiQPeA58DmAOeA80DlwMIBBIEsQPBA7oDjgPyA68DpQORA2oDmwOqA50DuwOVA+EDtgNGAwUEzAOaA8ADwgPOA3kDrQPaA88DqQOiA/ADfwPbA7UDoQPmA4oDqwOzA64DwwO4A8kDCgSyA78D0wOwA9ED7gPcA6ADpAPlA5QDPgTLA/QDyAPoA8cD7QPgA9AD1QO3Aw8E2QMABL4D+wMiBOMD6QPEA6AE2AP6A00EygMnBOwDOQTdA+IDBAT2A+8D+QMhBMYDBwTqAyQE9QP/AwEETASyBAIE+APzAwsEKQQwBA4EHgRRBPcDIARXBB0EFAQaBGcE5wMoBAME/QMzBBEEGQQNBBMETgREBBsEMgRdBBwECQSQBC4EGAQfBD8EJgR2BBcEFgQlBCwEjgQqBCsERQQ1BBAEcQT8AyMEWgQGBCIFUwQtBOQDDAQ9BGEERgQxBLEEPARDBEgELwSDBEAEQQTXA0IEiQSEBFQEOATUAzQEVQSRBEkENgSjBEoEWwSLBGMEdwRuBFwEdARyBHMEOgT+A+kF1gSABJkEaQRiBJ8EXgRlBDsEqgTGBEsEagSbBGwE2ASGBIgEWARtBFAEyARfBJ0EaAR9BHUENwR5BEYFUgScBFYEfASMBEcEmgRrBJQEegSmBMUEfgTMBDEF2wTfBL8EWQSSBJgEYAR7BIIEigSBBP8EeATCBJ4EqARkBKsEswTtBKkE9gSlBDMFOQUSBYUEtwSvBMoEzQSVBIcEbwRwBI8EjQT4BNIEpATBBL4E7wSXBCYF4QTeBLgEtQTJBK0EsATTBGYEwAR/BJME6QTXBLkE8QToBOQEogSuBOUEuwT0BNoEvQTDBLwExwTEBPUEKQUWBesEoQTwBDsFOAX4BQAF4wTOBN0EaAV0BawE7gTLBNAE1AQNBRMFJAYJBecEtgRIBacEDAXVBAoF+wROBeoEQAX6BOwELgVDBfcE3ARiBSAFBgUeBQEF5gRBBW0FTQX8BCoFYQUrBQQF4gTgBJMF0QQ0BfIESQUcBdMF1wXPBCcF+QQIBT0FlgT+BFcFMgUoBQMFBQUOBS0FJQVLBR0FLwWPBfMETAUYBRsFPAVFBVoFQgUaBVUFSgWYBSwFMAVSBQ8FOgU3BUQF2QR9BVwFFgYjBVQF5AWCBf0ENQV3BU8FJAVzBZUFhgUZBZkFAgVfBUcFpwVpBVgFfwVwBZAFvgU+BWoFlAVlBSEFbgWqBR8FewWpBRUFbAWxBcUFkQULBRcFYAU2BWQFnwW0BIsFeAWJBV4FZwW8BY0FUQWdBQcFWQW4BZIFeQWOBZwFdgWBBboFcgVmBeYFrgUUBXEFwgWDBb0FoQWsBc4FlwWaBagFXAZjBd8FigXrBcoFzAVrBYUFngVQBaAFlgV+BeMF2AV1BaQFxgV6Bc0FCQYTBsQFEAXHBVsFpgUABrAFpQURBaIFywVdBbIFOgbzBYgFgAX5BcMFVwZrBh8GuQW2BSkGqwXaBa8FwQV8BbcFUwW0BRIGwAU/BYcFDAbVBdIF/gUXBtkF7wWzBVYFAgZvBTAGSQa/BaMF7QUHBtQFDQaEBeEF5wVfBkUG1gUEBvwFtQUIBisGjAXiBdsF4AXRBeUF/QXPBfAFuwUjBvsFLwbeBckFyAUFBk8GdAZLBskG9AXqBdAF8gUoBjIGYwYmB5sF9QUbBkcGNQYhBkYGrQV1BhAGIAZiBk0G3AXdBQ4GGAYiBvcFXQY3BkEGCwYGBvoF8QX/BW0GAwYeBi0GGQYsBjgGVAYKB3gGFAYqBm4GPgZaBj0GEQZIBk4G6AXsBYEGiAY5Bg8GCgZSBncGZgYzBlUGOwYaBhUGJgaFBmAGfgZhBmoGJwZ6BlEGHAZnBi4GWAZKBkAGXgbuBUQGZQZMBqcGJQaYB2gGQwZZBlYGcAZsBjQGHQZQBjYGgwaABjwG2wa9BsMGjAb2BVsGlQZzBrwGmAazBmQGkwbYBtUGrgZpBqoG5AYBBlMGogaPBpsGPwZ2BlsHigaEBpEHvwbZBpEGjQaGBrgGpAa5BnEGnAaXBrAGnwbMBsEGTQejBvoGcAeWBqYG3gaaBqUG2ga0BnwGwgaOBkIGrAbxBpQGiwaQBocGfwarBq8GggaZBv0G5QYXCKAGHweSBssGrQb2BtYGxgbnBsAG1AbEBgkHtwbXBp0G0AZvBrsGqQa1BvkGzQYUB+sGyAaJBjAHvgYEB90GLAfuBjEGeQaoBg0HngZ6B/gGFgfoBnsGDAf1Bh4HsQZ9BgUH9AbPBi0HsgZIBwcH0QYAB28HGwcVByIHIQfiBqEGDwccB+AH8AbpBnYHygbtBnEH9wYTBxgH4AZDB+MGRAf7BvwGFwfHBhoHAgf+B2EH7wZ4B0oHugfcBjIHIwf+BsUGKQcBBwsHNwfqBiUHGQfTBnkHRQfyBhIHUQeCB2YHawfhBj4H/wYzB2wHCAdqBy4HPQeeBw4HEQffBl4H7AZ+BxAH0gY4B2cHOwcDBzQHrQd0B2kHKAdBB1oHVgfOBkAHSwc2CCcHZQdOB2MHlwdTB7oGQge+B4EHSQdgB40HVAfNByAHdQdPB4QHRwcGB7sHPAdZB1cHKgc6B5wHhQdiB+QHMQcRCFAHJAfzBp8HKwe1B0YHjgenB+sHMAi9By8HGwg/B6sHbQebB1gHXQdcB4YHTAfmBpoH7AepB24HlgeVB18HDgiuB6gHiwdyB5kHaAeAB2QHVQePB7QHrwf7B7gHcwe3B9YHkwcOCbkHogd7B3cHwAixBxIIWwgACLYHqgfEB7IH2AegB8AHpgfbB1QI9wceCFIHJQh/B+0HowcECNkHxgfoB30HigcxCJ0HlAcVCCkI6gfpB00I9geQBzUHjAeSB/UHgwfMB8EH1AfxByUJTwj9BxYI7gfiB9cH0gfQBwsI8gelBzwI7wcGCKQH0QfzBwwIoQdiCKcIyQcdCIgH5QffB90H9AcjCOEH5wfPB4kH+QfVB84HLAiHBxgIawg5CGcIKwjLBw8IHAgaCAkIOggDCNoH8Ac5B0MIdwjjB1cIUQgQCEgITAgvCLsIkghZCHwHwgecCJQIQAhjCPIIAQjeB3gI+gfHB0sI/AczCAUILQgHCDsIRQioCA0IjAghCL8HSghNCWkISQgoCHEIUAmfCI0IkQizBxQIsAhQCCAIlQg+CBMIJAibCCoIVgjiCM4IXQi8B4EINQhuCBMJBAmdCFII3AdwCEcI+AdkCMMHcwgfCOYHIghBCDQIOQkCCTcIrAdECIYIRgj/Bz8IMgi5CAEJugieCM8IAgi8CHQILgh1CPMIagh9CGUIJwjRCFoIxQg9CF8IJgjSCJMJrgiACLMI6QisCIcIBQmoCcoH6wi3CBkIfwg4CMYILwnIB60ICAheCGgIYAiECLQI4whCCFwIVQhOCKsIvwiKCL4IpQjFB5oIoAhsCHIIfAixCIgIxwhuCZgIOAl2CO8IuAgPCcsICghhCBUJkwj8CI4IeQh7CIMI0wgSCT0JmQjECfsItQgXCXoI6AiXCJYIjwiCCLYI3gj1CMQIwwi9CC4JmgrnCJAIawnNCMII5gjJCCAJZghtCKEIfghbCcoIzAmjCKYI9AjBCEoJUwhaCeEI3wjQCOwJ1AiqCDoJDQnkCOwI4Aj6CBgJaQmZCcgI2AiFCDEJ+AipCNAJ1ggJCREJKQlFCe4I1wiFCfAITgkiCVEKWAhzCcIJcQlnCUcJZglECXgJlAnlCAgJ9whACXIJNgk7CeoIJAlICQYJHAndCK8I3Aj2CEYKhwnlCiwJgwlGCZgJAwkACRsJ/ghJCXUJzAiyCYoJ5gmsCRQJ3Qk0CSsJwQnVCCMJgQkWCfEIbQlLCV8JEAq7CU8JMwk1CXAJAArtCCYJPgnaCDwJiwghCUEJVQmJCR0JbAlDCTIJMAlWCbQJXQlTCVcJyAloCWUJDAp3Cb4JdAliCVgJ/wgLCeoJBwkZCcMJYwlgCRoJdglvCckJoQkMCQoJ2wjgCb8JOwpUCVkJlglSCSoKjAn9CJAJnAmkCYQJYQkxCpEJdAqVCR8J6AmSCSgJgAmNCYIKsgi1CfAJ2QnPCYsJggnWCbEJeQlqCUIJPQpUCgIKUQnLCRwKlwl9CQgK9AnZCnwJhgm3ClwJrQqPCc0JmgnHCsYJmwraCakJ3gmfCaoKoAnTCbYJngmqCS0Jygk3CXoJuAnHCXsJMgrOCe0JrQmjCUgKxQnbCdkI5wmICa8JEAkjCo4Jpgm3Cb0JaQqzCRUKfwnpCeEJ8wmdCa4JFgsqCZYKdQr7CUwJOgoBCjgKmwnwCtEJGgp8CicKNgpQCgkKfgn1CcAJ3wkvCvYJ+QgZCmgKWAouCtgJcAonCREKiQpJCqIJ1AmnCW8KXgn3CWQJRwomCgUKqwm2CuUJDQoKCusJwQqHCkoKHwqwCS0Klwp3CrwJugkrCjUKJArXCaUKFgoYCjMKqwqOCv4JcgqcCk4KuwriCbkJjQo+CigKAwrkCdIKGwoUCvgJIQpdCu4JbQrfCkUKIAqGCmYKagosCwcKkQoSCj8KZQpeCnkK8gkEClIKZAr6CZAKXwpaCkAKQwoiCksKNwqSCp8K7wlNCm4KYQqVCoMKWQopCo8KvgokC/gKDgrDCh4KUwr9CVwKtQqFCjwKiwqZCqgKcwolClYKcQoTCqMKCwr2CmIKawpCCuAKswpXCnAL5gr8CVsKfQr5CkQKdgodCjoLigpPCjAKDgueCjwLpwp6CtYKrgp7CogKrwqyCsQKNAsAC2AKFwu/CqYK0ApVCiwKYAsmC34KTAoSCykLGguxCp0K7go0CvsKtAqhCuoKuQsGCxMLxgrXCskKDwsRC9sKZQvICmcKoArFCmwKrApRC3ULqQp/C3gK/wkxC7wKmAqBCoAL7QqMCicLSAu6C3sL0wqyC+EKogrCCisLsArVClMLHgu6CmYLzAriCiML5ArjCvEKuAvYChQLHwvrCvIKCgs5Cr0K5wpZCwILLQvRCjALDQsQC5cLcgshCzULLgvKCtQKWAukCgEM/QoYCxsLbQtAC7kKRguQC8AKaQtPC2gL2gq4Cj8LwAsRDJQL/Ar6CvULVQsMC80KNguEC8cL9QpXC2sLXwtdC3ELTgtCC/cKHQsqCz4L7woLDBULiAs9CxwLhwv0Cm4LzAvQCxkLBQsDC3gLeguYC40LTAsiC34LCQxiCzMLSwuCC3MLpgu1CzgLGAxSC0oLIwyrC6ULQQupC9ELzws3C0UL6QpWC7cL3wsvC/MKBwslC6wLCQuRC2wLxAuhC4ELfQvSC7QLZAtcC00LjgujC54LjwvWC2oLAQt2CwsLsQuuCzkLhgthC+wKfAtaC14LeQs7C4kLZwvpC+0L7guYDMoLoAvJDJMLtguZC6QLnAtIDOYL9wvJC9cLdAv9C98MXwyDC8sLlgt3C6ILUAsoC/ELgQywC28LPA36C6cLBwzsC8YL7wsWDL0LIgwzDDIMnQu8CzkMyAuLC/kL+AtLDEAM0wtJCwwMCAzNCxkMJAzCCxoM9gsoDPQLhQtoDR0M/AvaC9ULEgwwDCcMvwvdC+cLWAwODOELLAw/DH8MkgtoDHwM4AtiDOULbwxZDCYM4gvkCy0MSgwpDMEL8gvqC0IMdwyhDAMMWgzUCxwMxAyZDC8MOwxgDDEMAgx6DGEMSQxmDBQMUgwrDNwLVQw+DA0MAAwGDMwMXAzjCyAMEwzeC/4LLgyUDG0MUwxyDIkM6wt9DL8MnwvZDKgMsgw2DCoMjgy9DFEMRAz/C4QMDwxBDG4MhgyiDIMMPQwfDIIM9gx5DDwMvgy0DFsMVgy4DOcMqgyWDAoMfgz7DGkMpAyIDGcMtgyRDBsMvAxFDOIMbA2xDDMNMQ2KDJwM8QydDHQMagyVDNgMHgymDM8MeAwkDUcM7AyADE4MXgzIDDQMrQzyDKMM8wueDM4MrwwuDcAM7gywDKQNrAxrDIcMwgyXDIwM6gwKDUYM7QwEDZoM3gybDLcMqwz0DOgMrgyPDOMMFQx7DAkN+Ay1DEsNbAynDCINJw1KDdcNNQ26DCoN8AygDOQMAw3VDBYNNw0RDSAN1Ax1DekM3AxGDd0Mtw1XDaINGg25DGMM5gzHDA0NQQ0ODToMbg00DUUNPQ3DDNMMywzlDGANcA1QDRMNAQ02DSMNVQ0oDRwNEA1HDesMqg0fDe8Mhg0PDfUMQg1ZDcINUQ1aDT8N/gwVDWcN/wxcDYQNYg1kDSwNQA1DDRQNmw1MDTsNoA0tDaMNXQ1yDVwOvg1EDR0NTg2LDSYNsA1SDWMNew2RDaYNlw3yDU8OkA0VDrYN0g0wDX4NKQ2uDVQN4A28DXgNXg3ADc8N+w3wDcQNxw2DDYgN/w2CDcENcQ0DDk8NAg5fDX8N0Q2WDY0Njg36DcwN6w2YDZINeQ25Dd4NlQ30DcUN6A3pDWUN7g2eDcgNuA3NDdsNKw4NDmsO4g0oDuYNEA4UDiEOBQ7hDRoODA4YDjIOBg4JDkgOHA4gDgEOlg5DDrQOlA5YDnEOnA6dDpMOfg6fDs8O","flags":"CwkJCwsKCQsLCQkDCQsJCQoJCQEJCQEJCQkLCQgIAQkKCAkICwgIAQgJAQEJCQgDCgsICQkJCwkLCQkBAwkJCAsICAsACQsDAwgJCwkKCQsKCQoJAggICQkCCQkJCwkJCgoJCQkJCAAJCgkLCAoJCAkJCQkLCQkKCQoJCwIICAkIAQkJCQgJCAEJCggICQgLCQgICAgLAwkKCQEJCQkIAwgICAkICAsACAkICQkKCwkJCwoKCQkLCQgICgkICAEICAkJCAgJCQMBCQoACQgLCAgJCAoACQkKCAILAAkJCQsJCAkLAAkBCQkBAAgJCAkICgQLAAkIAgsICQgKCwsLCQkKCwoICAkJAQsJCQoDCwgIAgkJCwkJCQgJCAgICQgLCwkBCQgJCQEKCQgICQkJCQkJCQkJAgkICQILCQEJCQkLCQkICAoICAgJCQgJCAoICgkLCAgKCQMBCwsACgkBCQsICQgJCwkKCgMJAgkJCwELCQkBCAIKCQsICwgIAwkDAwgKCggICQoICwkIAgELCwkICQgICQkJCQkJCAMJAwkJCQsJCQEJCAoICwoJCwsICQkICAkBCQALCgABCQkICQkJCAgJCQkICQgDCgkLCQoLAwoICQkLCwgJCAkJAQoICQgJCQkLCQoLCQkCCQoJCQgLCQkJCwkJCgkKCQsLCQoCCAgJCAgBCAsKAgkLCQoICwMLAggJCAgIAQgICwkIAQoJAQgIAwkJCQgBAAkLCQkICQoICQoICAkJCAgJCgkICwkJCQgJCAgBAAEBCQkJCQkJCgECCAAJCgkACwgJCAEICAEJCQkAAgoBAwkICAsKCQAICQkACAEJCQsKCQkJCwsIAQECCAsACQgICAELAQEICAgJCQkICQkJCQgJCAAICAADAwkJCQAJCAIJCAgJCgkKCwkICAgBCAkJCAkJCQoKCQkJCgkKCwgICwkICQEICQkKCQEDCAsJCwEICQgICAgBCAIJCQgJCQgJAwEACQgJCQgACAkJCAgBCQgIAgkICwsLAggICAkBCAoJAQgLCAgJCAkJCQIICQgJCQkCCQgDCQAJCQkICQkJAggJCQgJCgEBCQkCAQgDCAsICwgJAwsICQkLCQoJCQkJAQEACAgJCwsJCQkBCQkJCwgICQMICQsICAgJCAAICQEICQoJCAsICQgICAIJCwgJCQkJCQgCCAkIAgoJAQkLCQEJAAkJCwAJCAkICgkDCQkACgoJCggICQgICQkICggBAQgDAwgJAggICAkJCQsICQEBCgkIAQkICQgICQgJCQIIAQgJCQsDCQoLCAgLAAoBCAgBCQAKCgkICQkJCAkJCQkJCggICAkJAQkICQkJCwkJCAgICAAAAQkBCAkACQgIAgkJCwkJCAkICAkJCQIACgkJCAAICgoJCAAICAELCwoACQkKCQMJCQgICQkJAQgKCAkACgkIAQEJCQkICwEICggLCQkCCQgAAQgJCAgDCQIJAwkDAAgKCQkJCAIJCQgCCwkICAkJCAADCAkJCAgIAAgJCAkLCQgJCQoJCAgJCQgICQsBCAoJCQkACQgIAAEICgkBCQEJCgEICwMBCQkICAgJCQgJCAkICQAJAwgICAgAAQkBCQEKAAkJCggJCwAIAgEBAQEACQkBCAgICQgCCwsCCAgKAAgJAAgJCwgJCggJCQgJAAEDCQkJCQkACQoJAQkLCAIBAQgJAAkICQgACQADCwAACQIJCQkICwkICAgICQkICQgJAQEJCAkBCQkLCwEBCQEBCQkKAQkBAQAIAggJCAgBAQgJCQsJAgkJAgkKAAgLCAkJCAEJCQELCAEJAggICQgJCQIIAQAAAQkACQIICQkICAABAAgBCAkJCQEBCgkIAQEJCwgAAwECCQkLCQECAQEACAkBCAMBCQkIAgkJAAkJCAkLCAgAAQoJCQkBCQoLAQkBCAkJAAkBAQAACQADAAsJAQkICAgKCAEICQgIAQkKCAgJCgkICggIAAEICQAACQEJCAkACAIIAAgBAQgJCAkJAAgIAQAICAAJCAIICAkICAkLCQkICggBAgkAAAkICAAJCAkACggJCQMCCQkJCQgICAgBCwkCCAAICQAJCQAJCAABCQkICAoACAgJAAAICgkJAQALCggJCQgICAEIAAgIAAgLAAgICQABCQgAAggBCgEAAAMLCQkICQgICQgDCQgCCQkLCQALCAAACQgJCwkIAAsICAkDCQEBCAkJCAAAAQoACQAJAgkBCwEIAgsICQgIAQAICQkJCAgIAQEJCAgJCQgICggJCAkJAQAICQkBCgkBCQkACQEJCQkBCQELCAEJCQkJAQkAAAgJAggJAAkBCAIIAQILCQkLCAIJCAgJCQgJCAIACAgACQgIAwkACgIJAAoACQgBCAkAAAAJAQAIAAkKCQkIAAkICAgBCQkJCQkBAAkMAwgAAQEACAEACQICCAgCCQEAAQMICQgICwkBCQgCCQMACAgJCAgICQkIAAkIAQgLAQEJCAgIAwABCQgIAQABAAkAAAEJCQAJCQkJAwoICQADCQMJCQEIAQkICQkJCQIICQEJCAACCAAAAgEICQMICAgJAQEJAgkICQEJAQkIAAkBCAkBCAECCAsACAkJCAACCQEICAEACAgICAABAAkACAAACAALCAgACAEACQgJCAsBCAkJCwkJCAkAAAgJAQAACAkJCQgJCAgCAwEICAgJAAgIAQAACQsJCAkJCAgBCQkACAoBAAgJCAkJAQkICAkIAQgBAwoKCAsICAACCQgICQkJCQgAAAAACwIICAkJAQAJAQgCCgIJCAgJAQgICQAJCQgJAAEDCwkACAgAAQgICAgICQkICQECCAoICAsICQEBCQgIAAEBAAAICQAAAQgICQkICgkJCAAJCQAJCAEIAAECAAkJCAgICQoJCQkJAAgICQkBCQEBAQgACAkBAQkJAQgJCQkICAgLCggACAICAAEICQkKAggIAQgJCQABCQgBAQgBAAEICQgCAQgJAAkICAkLAQgJCAEJCQoJAQAACQkDAQAACAgACQAIAQgCAggACAsJCQgICQsJCAgICQgBAQAKAAkJAAgKCQgACAgICAgIAgEJCQkIAAAJCgAACQgBCAIICAkACAgCCAkBCAEACAgAAQgACQgIAAgACAkJAAkICAMCAQgAAAgCCQgKAQEBCAAICQEACQgACQEJCAgICQgBCQkJCAgIAQkDAQgKAQgCAQkICAkBCAEICAMAAgkICAAJAAgIAAEBAwEIAQgICAALAgAICAEJAgkDCAEBAgEBCAgAAAgJCAkKCgkACAgDCQgIAAkACQkBCAkICwMBAAgIAAsJCQgBAQkICAkKAwgJCQgJCQgICwAAAAoCAAsICAAJAAEBCQgJCAgBCQgBCAEBAAEACgIBCAgIAAkACAAACQgJCAAJAAkJCQgJCQEAAAgBAQkJCAAICQkAAgkBCAkACQACAAADCAgAAQkCCAkIAAEICQgBAAAKAQABAQEICAAAAQEACAAKCQkBAgIAAAgBCQAACwgBCQgICAkICQkIAwAJCAoAAQAJAQgLAQAJCQgJAAkBCAIICAkJCQgICQAJAgEJAQkJCAgJAAEIAQoJCAAAAQAJCAAAAQkJCQkACAIAAggJAAgACAgICAgAAAkBCAoACQIICAAIAAMAAQAICQEICQkBAAkBCQIDAQgBAAgAAAgKAQECCAgBAAIBAAAAAgkIAAgCAQkKCAkACAgACAEACAEJAwgIAgEAAAgJAgkJAQAACAgBCAgACAAAAAAACAEACAEAAAkAAgMICAkACAkJAAgICQkAAAAACgkBAAMIAAEICAAAAQABAgkICAoDCAACAggJAAgDCAkBCQgJCAkCCAEBCQABCAIAAgoICAIIAQEICAAJCQALCAgJCQgJCAgACAAAAAgBCAgICQEBAAgJAAgJCQgICAkAAQEJCAgBAQEJCQEJAQgAAAgIAAEJCQADAAkAAQAJAwgACAEACAkACQEICQgBCAAIAQAICQoICAkAAAAICQIIAQgIAQgACAkAAAAKCwEIAAgIAAgACAgAAAAAAQEACQABAQgBAQgIAQIICAMACggBAwgCAAgBCwgACAEBAAgAAAEICAkICAgACAEJAAgIAAgDCAEICAEAAAEKAQgBAgAIAAAIAAgKCAAACggAAAgKAAEAAwgACAEJAAgACQEKAAAACAEACQEIAAgIAQgAAQkACAAIAAEBAAgACAgAAQkBCggAAQgJCAgAAAAIAAAAAAgJCQkCAAAIAAEACAAICAAICAgKCAMIAwoDCQgAAAkICQMACQMACQAACAIACAAIAAIICggACQgAAAAICAkACAAJCAAIAAEBAAEIAwAIAQoBAwkIAwkICAAIAAAAAQAAAAEICQgBAggBAAgICAAJCAAAAAgICAgIAAgIAAsACQEKCAABAggICAIBCAgCCAoJAAsICAkIAAAIAQAIAAgCCAkICAgBCAIAAQgICwAAAAAIAAkAAAAI","cls":"BgBVADYAIgAOAFIANgAjAFUAVQBVACMANgBSAFYACAAiAAYANgAiAFIACAA3ACgAIgACAAgAUgAFACIACABVAFYAIgA2AAgAIwBSAAUAIgAlACIAMgBWAAgAIgAIAAYAIgAIACMAIwAiAAUAKwAoAFYAIgAGADIABgBSADYAVgBVAAkAAgAiAFIANgBVAAYAIgAAACIAQQAOABIACABSAAgAEgAjAAAAVgBMAFUAUgBSAAYABgAIACMADgAFAFYAIgAjAAAAAABSAFYAEgBSACIAJQAIACIAMgAiAAgACAAIAAgACAAjAFYAIwBSACIACAAFAFYACAAGAAUAUgAFACIAIgAFAFIANAA0AAgACAA2AAYAIgAiABUAVgBVACMAIgAiADcAVgBSAA4AIgAFAEwAAgAGACIAIwAjAAQAVQAiAFYABQBVAAAABQAGAFYAVgAjAAUAIwAjABIAIwBSAFYAIwAOABIAUgAkAFYABgBSACsABQAPAAUABQAGAFIAVgASAAgAKwAiACIAJQAGAAgABQArAAYANAAiACIAAAAiACIAAgAiACMABgAiABIAUgASACUANwAiAFIACQBWAAgABQAoACIAIgBWACsABQBWAAUAJQBVAAUAVgBWAAIADgAiACIANAAjAAUABAAFAAUAVgAIAFIACAAOAAUAVgA2AFYAQQArABIACABSAA8AVgAjAFIAVgAIAAYADgArAAUAVgBWAA8AVQBWAAkAUgACAAgAVgBSAFYAVgAIACMADgBSAAQADwA+AFIABgAFAE8AUgAJAAkAJQA3ACsAAgAGAFYABQAAAAgABgAAAFIAVgAFABcABgAEADEAAAAPACIABAAIAFYAUgBSAFIAEgAiAAgABgAIAA8ABgBWAAYACABSACIAKwAIACIAVgAiAA8AUgAiAFYAVQBWAAgABAAiAAgAVwAFAFIAIgBSACgADgAYACMABgAFAFYAIgA3AAgAIgAEAAgACAAEAA4AVQAOAFIAIgAiADYACAAFAA8ACAAjACsAVQAlAFIAQQASAAgADgAoACMAVgAiAA8ADwAjAAIAUgArAAQAIgAGAAYAIwASACIAUgAIABIADwBVAFUAUgBQAFIADwAPACIAAgAIAFYADwAiABcAAABSAFIANAAjAAUAKAAjAEIAPgBSAD4ANAAIAAAAVgBWAA8ACAAFAFYAIgBWAAYAFQAjAAYAKABVAFAAMQA0ACUAFQAOAAUAFwAGAAkAUgAIACIAQgAFAEEAVgAGACMACAA+AAAAUgBSACMANwASADcAIgBSACIAIgAjACIAEgAjACMAUAAiAAgAIgAFAFAABgBSACsAVQAPAAYAIgBSAA4AUQBIAAYACAAIABUACABWAFYAUgAGAFUAFwAGAAYACAAOAFYAPgAPAAAADwAIAAgAKwAGAAUAIgBWACsAUgAGAFIACABSACIAKwBRACUADwAjAFIAVgBSACMAIgAPACIATQBSAAUACAAjAAgAIgA8AFYABAAjACsAKABWAA4ABQBSACMAHgBSAFIAAABWAAUAKABVACMAUgBWAAgACAAVAFUABQBQAFUAIgBSABIAVgAiAFYABgBWAEIAAAArADYACABVABUAMQBWABcAIgBSAAgABgBVAFIANABWAAUAUgAIAA4AIgBSACQAUgBWAAgAKAAGAAYAIgAiACsAUgAiAFYADgBVAAYAUgAIABUACAAIAFIACABWAAUAEgAjAAYAIgAAAFYACABRAAUADwArAFIADwAiAAYAVgAGAAYAVgAGACUANABXABcAVgBSAFYABgAGACIAIgAGAFIAUgAGAAYANAAjACIAKwBSAAIANgAjAAYAMgBSAA8AIgAOACEADwBVADQAIQA0AEEAQQBBACIADwBSAAgABgAiACIAMgAiAAUACAAUAAAANgAIAAgAKwAiAFYABgAOACsAUgBBAFIAUgAAADQAEgAOAAUAAABSADYAVgBWACEAAABWAEIAUgBSACsAJQArACMACQBWAAAAIgBBACMAKwAUAA8ADgAIACMABgAGAFUAEgBWAFIAUgBSAA8AIgAAACcAIgAjAAgABgAIAEEABQAiACIAUgAiAAUAJQAFAFIAKQA0AAAAVgAJAFUADwAPAFIAIwBSAFIACAArACIAJQBSAAQAIwBSAAUAIgAyACIADwAGAAYANgBSAA4ACABBAFAAKwA0ADEAFwArADQAIwBBACsAIwAiAFIADwA0ACsACABQACIALABWADQABgAgAEIABAAFAFIAMQAyAAAADwAjAAQAVgA6AAAAIgBBAFIAAAAFAAUAVQASACUADwAIAFIABAAAAA8AKwAgAE0ACAAiAFYAIwBBAFAADwAEACIADgAPAFYADwAOABIACQA3ACIACAAiADEAIAAIAEEAAAAIAAYAUgAjABIADgA6AEEAQQAIAAUAVQAjAAgADwAiAFYAIgBWAEIAIwAxAFYAIgA0AEEACAA2AFYAJQBBACIADgAlADQABQAiAEEABgAiAAgAIwBSAFYAMgBWACsAVgAGABcABQAIABQAFAAoACoAIwArAD4ALgAIACIABQBSAFYAUgBSACMADwAlAB0AIgAiAAAAAgAIAA8AAAAPACsABgAiAFUANgBWAFQAAABSACsATQA2AAgABQASAA4ADwBNADwAQgBWACEAIgAEAB4AVQBWAFYAIgASAA8AIgAUAAYAJQAIAD4ABgA6AFIABQAIAA8AIgA0AFIAIwArAFUAAABBAFIAUgAEAAYACQBWACMABQArAAUABQAGAAgABQBSAAYASwBPAAgAQQAGAFUAFQBSAAgAAAAAAAgAVQAPACIADwAIAAwACQAGAAUAFQAjAAgAIwAnAAYAFwAfAAAACAAiAFUABgBNABgABAAPAAUABgASABIAQQAiAAgAUgBWACIAPwAjAA4ABQAgAEIAFwAiAFYAQQAAAAQAKwAAACEACQAGAB0ATAAxAFUAMgBSAAgAUgA3ACIAVgAGAA4AIgAiAAUAVgAjAE0ABAAPACAAIwAPAAAAKwAOAAUAIgBSACIACAAPAAgAHgBBAAUAAAAjAFIAFAAEACIAVQBSAEEABQA9AFIANwAEACMACABVAAAAUwBBACMAMgBWAAUAPAAeAAgAVQAPAAAAQQAIAAgACAAEAAgAIgAiAAUAGAAiACgAMQBSACMAAgAJAFIAIgAFAD4ACAArAFYAPgAAAD4ADwAiAAgAQQAOAFUACAAOACIAQgAiAFAAPgAIAFIAQQAPAAYAPgBSAFUACQBWAA8AKAArAD4AIgBBAEIADwBFAEUAVgAFAFIABQBBAFYANwAGACIAIgArAA4AIgAIAAYABgA2ADEADwAPAEEABgAjAEQAIwBRABIAJQAPAAAABQAAAEAAUAAFAC4ACABBACIAPwAPABQABgAOAEIABgArACsABQAIACsACAAFAAYADwAEACIACABCAFIABQAFAFUAKABBAFAAIwAiAA8AQgBVABIAMQBBACIAIgAIAA8ADwAXAEIAQQBCACMAIgAGAAAACAA0AAAAFAAGACMADAAOAAAABQAIAAgAKwAlACIABgAGACIAIgAXADYACAAoAAYAAAAGAEYAVgA+AEIADwAGAFUACAAGAAQAFQAAAFIADwAiACIAEgBXAE8AJQAAAAUAIgAFAAYAAAAiAA8ABgAjAEsAUgAjAEEACAArACIACABWACUAUgBBAAAAAABVAEEAVgAPAEEABgAXAAQAIwAGAFUADwAjAAAAAABBAAUABQAFABcACAAGAAUAUgAPAAgAKAAIAFMAEgAiAAYADwAIAFIAKwBSADEAVgBVACIADgBSACIABAA+AFUAIgAjACMABQAlAAYACAAxAAQAFABBABcAEgAdABQADwAGAAgAFAAIAAQADgAiAAYAQQBSABIAPgAGADcABgAFADoAAAAiAAYAIgAEAAgAAABWACgAQQBBAFYAIwAGACIACQAOADQABgAEABQAQgAjACkAJQABACIAJQAAACIABQAFAEEABAArAFUAJQAAAAgAIgBSACsACAAjACsANgBSACsAIgBBAAAAEgAjACIAEgAiAEIABQAAAAkADgAjAEIAAAAoAAUAAAAGAAgAAAAAAFMACQBMAAgABABSAC0AIwAiAAYAPgAXACsAVQBBAAUAIwBBACIAQgAgAA8ABgAJAAYABgAVAAAAOgAjAEIACQAiAA8ACQAjABIANAAOAAUAIgAFAAAAQQBBAEIAAABSAFUADwAGAAgAIgBBAAgACAAJAAYAUABBAAgAQgBRAAkAUgAIAA8ADwAIAFYADwAPAAUAVwAEAFYADwAVAEIABAAdABUAAAAOAA8ABgAUAFIAKwBSAFIAVgBWAA8AAAAiAFUAIwBVAC8APQBSAAoADwAIAFIARgA2ACIABgAdACsAVQAIAAYAQQASAFUAVgAGAAUAJQAPAFUACAAAACcABgAEACUAKwAGAAgAUgBWACUACAAAACIACAAGADQAIwBMAFUABgAIAEEAAABSAFQANgAIACQABgAjACsADgBSAFIAFAAiAFYAUgAPACsAKwAEAD4AIgBSAFIACABCAAgABAACAAQAIwBMACsAIgASAAgAQQAPACIACABSAAYABQAOABQAVQBVAC4AIwAIABcAAAArAFYABgBVAFUAPgBBAAYAKwAPAEEANAAAAEIABQAGAA8ABQAIAAoAVgA2ACIAQQAFAAQABgAlAFIAAAAFAAYAAAAVAAgACAAiAAgAHQAOABQAUgAiAAQAVQBBAA4ADwAjAA4ADwArAFYAQgA0ACgAQgAJACIAKAAIADwAQgAxAEEAEgAIABcAVgAVAAQAVQAAABoACAA0AAYACAAjABUAVgAOADoAQgAGADkAAAAOAAgAUgBSAFYAIgA0ABIAIgBCAEEAVgAIAFUABAAjAFYAFwASAA4ADwAJAAYAUgBTACIAIwBSAEEAIwAFABcAQQAaAEEABgAIADoABgAOADsAQgBSACIABAAFAAQAPgBCAAYADwBSAE0AUgAIAAYAUQBVABQAVgAIAAgAQQBWAAAAVQAPAFAAIgBVAEIAIwAAABIAIwAUAEYAVwBWAFUACAAiACIAIgAPACsABgA8AAUAIgBSAAYACQBBAFMAFwBBAEEAVgAPABAABQBSAEEAUwAIACIAPgAxACsAAABBAAgACAAjACIADgAAAFAADwAOACIAMgAPACsAAgAZAAgABAAAAAQAIwASAA8AQQBCAAgAUAAjAAYAKwAIACsAVgAAAFYACAArAAIACABSAAQAVQASACIAUgAJAAAAIgAIAAgATAAJAFYAKwAGAAAADwA+ADkADwAAAAUAVgAEAEEAQQAEAAQAPwA9ACIAAABLAAgABQAOAFYAFAA0AB4ADwBVACMAUgAjAAYAIgBWADYAAAAIAEEAIwAAABsAMgBSAAkACQAiAAUAUgBBAAAADgBVAAUAUgAPAA8ABQAIAD4ACAAAAAgAUgAiAFYAMQA9AAgAVgAEAAgAQQAIAAkAFQAGADwAMQBVAAYADwAGAAQAUAAFAFIAOgArAA4AKwAiABQAIgA9AAAABgA5ACoANAArACIABgAPAAAAQwBWAAgAVgAqAEEAVQBSAFMANAAoAAgABgAIACIAIgBCAA4ABAAjAFYAIgAAAFYAKwAGAAUAKwBVAAgAKwBCAAAAIwAAAEEAEgAiAEEAKwAIACIAFQABAAQABgAiAEIAUwBCAEEAQgA3AA8ADwAIACMAOwAIACcABQBBABcAIwAAACsAQgBTADoAQQAEAAUABQAEAFUAVQBBAAAAQQAIAFUAIwAPAAgAQQAPABAADgBSAFIAIwAqABIACAAPAAUAIgAFAAYAEgBBAA4APwAdADQABgAFAAYAAAArAEgAVQAIACIAQQArAD4ABgAVAEIACAAAAFIAPQApAAgAVQAiABIAFwBCAEEAMQBPAAYAPgArACMAFAAjAA8APQAIAEEAQgAAAAgAQgAIAFYADgAEAAAAKwAPAEIADwA0AFUAAAAdAEUADwAAAAUADgAFABUAQgAAAFIAQQAOADIANABSABQAIgAGAFQADwAAAEEAOgAjACMACAAFABIAQQArAC4AFAAPAAgAIwAGAAAAKwBBAAkAIgAOAE0ADgBSACIADgAGACIADwAEAAYAQQASAAgAUQAGADYAUgAIAAgAPgAhAAgABQBQAFYANAAOAFMAAAAVAD0AQQAAAAAAUABBAEIACAAGAFMADgAPACIATQASACMAKQAjAA4AFQAOAA8AKwAVAD0ADgAVAA4ACAAHAD4AVgAIAAUADwAQAB0ABgAEAFUANAAiAFUABAAcAAgAAAAiADQADwBBACIAFABBAAQACAA+ADcAQQBBACIABAAIAAgAVgAyAAAAVwBBABcAAAAJACsABgAdAFUAHQAAAA8ANgAFADQAVgAPAAAAFQAAAAYACQAGACIAPwAlAA8ACABCAA8ABQAEAE0ABgAiAAAAFwA0AD0AFwAPAFYACABWAFIACABBACIAEAAEAFUAQQAPAAkAQQAuAAgAAABCADoABgAAAAYAKgA5ADQACAArAFUAKwAjADUANAAPAFIAIgBCAEIAVQAVADMANAAyAA8ADwAiABIAPQA6ABYAEwAAADoAAAAIAEEAQQBSAAgAEAArAFAACAAIACMAAABBABcADgBBABUAAQAzAFUAVgA9ACsAQgBBAFMAUgAAAFUAIgAiAAUACABBAAgAUQAXAA4AQQAGAFIAIgArAAQABAAAAAAAHQAAAAgAUgAXABQAAABBAAgAVQAAAAUAQQA0AAgABABCAD0AIwA+AFYACQAIAEEADgBUACIAMQAIACIAAAAhACMAHQAdACIAFAAIACQAKwBBAAAAQQA0ABQAIgAlAFYAQgAPAFAAAABQABAACAArACIABQA9AAgAQQBCACIACAAGAAgANAAXAA8AAAAVAAQAQQAOADQAQQA0AAkAQQAIAEUAQgArAAAAHQArACsAAAAFAFIAFAAGAA4AQgAIAAYAIgAiAAAACQAIADQANAAEAEIAPwBCADoASwBBACIACABBAFIADgBNAFYAOgAEAEEABQBVACIAQQBBAAQADwAAAA8APgArACMAKwBSAA8ADwBBAEEAAABWAAAADwAAACIACAAPAAkAEAAVABIAFAA9AEsAFQA+ABcATQA9ACsABgA0AAQABQBQAD4AEwAEABQAIwBBAAkAUAAJAD0AQQAAAEEAIwBCAEEAIgAAACMAMgAiAEEABQBXAAQAAAAuAA4AQQAIAFUAUABSABgAFQAPAA8AIgBBACEAIgBYAAgAEQBWAAAAAAArAEEAAAAiACgAAAA+ACIAQQAGAFgAVQBBACEAIQAEAEEABAAIAB0AQgAOABAAEAAIACIAAABSAAgAQgAIAAQASQAoADIADgAVAA4AEgA+ABAACABFAAUAUwAGAEEAQQAIACIACABCAD0ARQAFACsACAAHAAAAUgAAADcANAAiADoAVQBVADEARwAAAFUAKwA0AAgAEgAPADYACQArAAAAUgAGAAQAVwAjACsACAAPAAgADwAIAAkAQQAdAEEAAAAFAD0AAAA9AD4AQgA+AAgAIwAFABAAQgASAEIADgBSAEEAOgAAAAQAQQAQAB8AIgAUAD0AUgAAAAAAQQAQACIAKwAAAA4AIwBBAEEAQQAPACMAQQA2AAYAAAAJAAAACABCACIAIwAGAAgAFwAiACsAQQA0ADoAKwAjAAkADwAVAAAAEwAGAAgAQgBBAA8ABAAJAAAAQQBCAAAAAAA6ADUACAAAACMAKwArACIAUgBBADAATABBAFcACgA0AAgAIgArABcACAAvAFIADwAIACsAKwBUAEEAPgA9AAAAAAAAAAAABgBYAA8AAABTAD0AEgAdAD4ACAAhAEEAAAAJACsAOQAiAA8AFQAJAAgABQAAAAAABAAaAEIAQQBBABQADwAiAEEAAAAFAEEAAAArACMAFAA9AEEAIgAXAAgAAABBAAAABQAIACIACQBSAAkADwA0AAAAQgAEAFMAVQBGAAAAAAAiAEEAAAAUADQACAAQAEEANAArAA8AFABBADQACAAEAAAAHwAAAAUAKAAQACsAPgAdACsACABBABAAFABVACIAIgA+ACMAPQBCAAAAAAAAACsAAABSAE8AOAAUAEEAPQAJABcAQQAIAA8ADwBBAFIACAAXAFAACQBXAFYAVAA9AE8APgAAAAQAPQArAEEAJwAJAA4AUgAKAAAAIwAiAA8AUgAIAAUAVQAIAD0AEAAyACsACAAvACIAIgA9AAAAKwAAAEIAAAAAABIAUAA9AFIAHwAPAAQAOgATAAYAEQArAA0AAAA9AFUADwAIADQAOgAIACIAKwAIACsADwAIAFUAAAAEAFMAPQA1ADkADwAJADQANQBBADkAKwAGACYAEgAJAA4AAABBAA4AQQBCAEEARQApACIAMwBCAEEAQQASAEEABQAIAAIAHQBKAFQARAA6AAgAAwBUABAACAAxAAAARABUAEEACAAUAD4AKwAFAAAAKwAJACMABwAAACEAQQAAAEUACAAAACMARgAFABYAUwAjAAgAQQAIAE8AJgBBAAAACAAPAD0AUgArAAEACAAiACsAAABVAD4AOwAUAAgAQQAiACsACQA9AAQADgAFAD4ALgAXAAkAQQAIAD0AMQA6AAQAKwAQADMAEQALABcAFAAAAD0ADgAIADUAPgAPABMACAAIAEEAAAArAAAAIgAAAC4ACAAAABAANAAVAEEAPQArAD0AIgAIAAQACQAAADEAVQA9AFQAAAA9ACsACAAJAFcAAAAIABAAQQAIAAAADwAJABcAAAATABMACAAIABAAJgAKAEEAKwAqACIAUwBOAAAAVAAAAFYAFwBBAD0ACAAIAA8APQBBADoADgA+AB0AAAA+ABQACQAUAAQAFAA9AAEACABVAEEAAAAJACcACAAIABQAQQA9ACIA","fam":"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","gen":"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AAAAAAAAAAAAAKIAAAAAAAAARgAAAEAAAAAAAAAAAAAAAAAAAAAAAC0BAAAeAAAAAAC/AAAAAAAAAAAAAAAAANIAAwF7AAAAAAAAAB0AAAAGAQAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAABQAqASoA+gAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAHMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAG4AAABzACYAAAAAAAAAAAA6AAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAEAAAAOwAAAAAAAACEAGMAAAAAAAAAAAA+AAAAAAAAAAAAAACRAAAAAAAAAAAAAgAqAAAAAAAAAAAAZQAAAAAAAAAAAAAAIQEAAAAAAAD/AAAAAABvAAAAogAAAAAAAAAAACoAGgBKAAAAAABvAAAAAAAAAAAAAAAAAAAAPwAAAAAAAAAAAGMAAAAAAAAAAAAAACgAIAEAAAAAAAAAAFwAAAAAAAAAAAAAACoAAAAAAAAAYwAAAAAAAAAbAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGUAAABlAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADIB","names":{"cls":["","ABY1","AD3","Abditibacteria","Acidimicrobiia","Acidobacteriae","Actinobacteria","Aenigmarchaeia","Alphaproteobacteria","Anaerolineae","Armatimonadia","BD2-11 terrestrial group","BD7-11","Babeliae","Bacilli","Bacteroidia","Bdellovibrionia","Berkelbacteria","Blastocatellia","Chlamydiae","Chloroflexia","Chthonomonadetes","Clostridia","Cyanobacteriia","Dehalococcoidia","Deinococci","Desulfitobacteriia","Desulfotomaculia","Desulfuromonadia","Elusimicrobia","Entotheonellia","FFCH5909","Fibrobacteria","Fimbriimonadia","Gammaproteobacteria","Gemmatimonadetes","Gitt-GS-136","Holophagae","Ignavibacteria","JG30-KF-CM66","KD4-96","Kapabacteria","Kryptonia","Ktedonobacteria","Latescibacteria","Limnochordia","Lineage IIa","Lineage IIb","Lineage IIc","MB-A2-108","Methylomirabilia","Microgenomatia","Myxococcia","Nanoarchaeia","Nitrososphaeria","Nitrospiria","OLB14","OM190","Oligoflexia","Omnitrophia","P2-11E","Parcubacteria","Phycisphaerae","Pla3 lineage","Pla4 lineage","Planctomycetes","Polyangia","Rubrobacteria","S0134 terrestrial group","Saccharimonadia","Sericytochromatia","Spirochaetia","Subgroup 11","Subgroup 18","Subgroup 20","Subgroup 22","Subgroup 25","Subgroup 5","Sumerlaeia","Symbiobacteriia","TK10","Thermoanaerobaculia","Thermoleophilia","Thermoplasmata","Vampirivibrionia","Verrucomicrobiae","Vicinamibacteria","bacteriap25","vadinHA49"],"fam":["","27F-1492R","67-14","A0839","A21b","A4b","AKIW781","AKYG1722","AKYH767","Abditibacteriaceae","Acetobacteraceae","Acidiferrobacteraceae","Acidimicrobiaceae","Acidobacteriaceae (Subgroup 1)","Acidothermaceae","Alcaligenaceae","Alicyclobacillaceae","Anaerolineaceae","Anaeromyxobacteraceae","Azospirillaceae","B1-7BS","BIrii41","BSV26","Babeliaceae","Bacillaceae","Bacteriovoracaceae","Bdellovibrionaceae","Beijerinckiaceae","Blastocatellaceae","Brevibacillaceae","Bryobacteraceae","Burkholderiaceae","Caldilineaceae","Caldinitratiruptor","Caloramatoraceae","Catenulisporaceae","Caulobacteraceae","Cellulomonadaceae","Cellvibrionaceae","Chitinophagaceae","Chlamydiaceae","Chloroflexaceae","Chthoniobacteraceae","Chthonomonadaceae","Clostridiaceae","Coleofasciculaceae","Comamonadaceae","Deinococcaceae","Desulfitobacteriaceae","Devosiaceae","Diplorickettsiaceae","Dongiaceae","Entotheonellaceae","Erwiniaceae","FFCH9454","Fibrobacteraceae","Fimbriimonadaceae","Flavobacteriaceae","Frankiaceae","Gaiellaceae","Geminicoccaceae","Gemmataceae","Gemmatimonadaceae","Geodermatophilaceae","Gloeobacteraceae","Glycomycetaceae","Haliangiaceae","Holophagaceae","Hymenobacteraceae","Hyphomicrobiaceae","Hyphomonadaceae","Iamiaceae","Ilumatobacteraceae","Inquilinaceae","Intrasporangiaceae","Isosphaeraceae","JG30-KF-AS9","JG30-KF-CM45","KD3-93","Kineosporiaceae","Koribacteraceae","Ktedonobacteraceae","Labraceae","Latescibacteraceae","Legionellaceae","Leptolyngbyaceae","Methyloligellaceae","Methylophilaceae","Microbacteriaceae","Micrococcaceae","Micromonosporaceae","Micropepsaceae","Microscillaceae","Mitochondria","Moraxellaceae","Mycobacteriaceae","Myxococcaceae","Nakamurellaceae","Nannocystaceae","Nitrosomonadaceae","Nitrosopumilaceae","Nitrososphaeraceae","Nitrosotaleaceae","Nitrospiraceae","Nocardiaceae","Nocardioidaceae","Nostocaceae","Obscuribacteraceae","Oligoflexaceae","Omnitrophaceae","Opitutaceae","Oxalobacteraceae","Paenibacillaceae","Paracaedibacteraceae","Parachlamydiaceae","Parvibaculaceae","Pedosphaeraceae","Pelotomaculaceae","Phycisphaeraceae","Pirellulaceae","Planococcaceae","Pseudomonadaceae","Pseudonocardiaceae","Pyrinomonadaceae","Reyranellaceae","Rhizobiaceae","Rhizobiales Incertae Sedis","Rhodanobacteraceae","Rhodobacteraceae","Rhodocyclaceae","Rhodomicrobiaceae","Roseiflexaceae","Rubinisphaeraceae","Rubrobacteriaceae","SC-I-84","Sandaracinaceae","Simkaniaceae","Solibacteraceae","Solimonadaceae","Solirubrobacteraceae","Sphingobacteriaceae","Sphingomonadaceae","Spirochaetaceae","Spirosomaceae","Sporichthyaceae","Steroidobacteraceae","Streptomycetaceae","Streptosporangiaceae","Sumerlaeaceae","Sutterellaceae","Symbiobacteraceae","TRA3-20","Tepidisphaeraceae","Thermoactinomycetaceae","Thermoanaerobaculaceae","Thermomicrobiaceae","Thermomonosporaceae","Unknown Family","Vampirovibrionaceae","Verrucomicrobiaceae","Vicinamibacteraceae","Vulgatibacteraceae","WD2101 soil group","WX65","Weeksellaceae","Xanthobacteraceae","Xanthomonadaceae","Xiphinematobacteraceae","cvE6","env.OPS 17","type III"],"gen":["","1921-2","1921-3","1959-1","ADurb.Bin063-1","Abditibacterium","Achromobacter","Acidibacter","Acidicaldus","Acidothermus","Actimicrobium","Actinoallomurus","Actinocorallia","Actinomadura","Actinophytocola","Aeromicrobium","Afipia","Ahniella","Allocatelliglobosispora","Allokutzneria","Allorhizobium-Neorhizobium-Pararhizobium-Rhizobium","Alsobacter","Altererythrobacter","Aminobacter","Amnibacterium","Amycolatopsis","Anaeromyxobacter","Angustibacter","Anoxybacillus","Aquicella","Aquisphaera","Archangium","Arcticibacter","Arenimonas","Aridibacter","Arthrobacter","Asticcacaulis","Azohydromonas","Azospirillum","Bacillus","Bacteriovorax","Bauldia","Bdellovibrio","Belnapia","Blastococcus","Bosea","Bradyrhizobium","Brevibacillus","Bryobacter","Burkholderia-Caballeronia-Paraburkholderia","CL500-29 marine group","Caenimonas","Candidatus Alysiosphaera","Candidatus Koribacter","Candidatus Nitrocosmicus","Candidatus Nitrososphaera","Candidatus Nitrosotalea","Candidatus Nitrosotenuis","Candidatus Nostocoida","Candidatus Omnitrophus","Candidatus Ovatusbacter","Candidatus Protochlamydia","Candidatus Solibacter","Candidatus Udaeobacter","Candidatus Xiphinematobacter","Catellatospora","Catenulispora","Caulobacter","Cellulomonas","Cellvibrio","Chitinophaga","Chryseobacterium","Chryseolinea","Chthoniobacter","Chthonomonas","Clostridium sensu stricto 9","Cohnella","Conexibacter","Cupriavidus","Curtobacterium","Cystobacter","Dactylosporangium","Deinococcus","Denitratisoma","Desulfitobacterium","Desulfosporosinus","Devosia","Dinghuibacter","Dokdonella","Dongia","Duganella","Dyadobacter","EcFYyy-200","Edaphobaculum","Effusibacillus","Ellin516","Ellin517","Ellin6055","Ellin6067","FCPS473","FFCH5858","FFCH7168","Falsibacillus","Ferruginibacter","Filimonas","Fimbriiglobus","Flaviaesturariibacter","Flavisolibacter","Flavitalea","Flavobacterium","Fonticella","G12-WMSP1","GOUTA6","Gaiella","Gemmata","Gemmatimonas","Gemmatirosa","Geodermatophilus","Georgfuchsia","Geothrix","Gloeobacter PCC-7421","Granulicella","HSB OF53-F07","Haliangium","Hamadaea","Herminiimonas","Hirschia","Hoeflea","Holophaga","Hymenobacter","Hyphomicrobium","I-8","IS-44","Iamia","Ideonella","Inquilinus","JCM 18997","JG30a-KF-32","JGI 0001001-H03","Jatrophihabitans","KD3-10","Kibdelosporangium","Kitasatospora","Kribbella","Ktedonobacter","Labrys","Lacunisphaera","Lapillicoccus","Lautropia","Lechevalieria","Legionella","Leifsonia","Leptolyngbya ANT.L52.2","Leptolyngbya EcFYyyy-00","Leptolyngbya Es-Yyy1000","Longispora","Luedemannella","Luteibacter","Luteimonas","Luteitalea","Lysobacter","MN 122.2a","MND1","Marmoricola","Massilia","Mastigocladopsis PCC-10914","Mesorhizobium","Methylobacterium-Methylorubrum","Methylocapsa","Methylorosula","Methylotenera","Methylovirgula","Microbispora","Micromonospora","Microvirga","Mucilaginibacter","Mycoavidus","Mycobacterium","Mycoplana","Myxococcus","Nakamurella","Nannocystis","Neo-b11","Neochlamydia","Niastella","Nitrolancea","Nitrosomonas","Nitrosospira","Nitrospira","Nocardia","Nocardioides","Nonomuraea","Nordella","Nostoc PCC-7107","Nostoc PCC-7524","Noviherbaspirillum","Novosphingobium","OLB12","OLB17","OM27 clade","Oceanobacillus","Ohtaekwangia","Oligoflexus","Oligotropha","Opitutus","Oryzihumus","Oxalicibacterium","Oxalophagus","P3OB-42","Paenarthrobacter","Paenibacillus","Pantoea","Parafilimonas","Parviterribacter","Paucibacter","Pedobacter","Pedococcus-Phycicoccus","Pedomicrobium","Pelotomaculum","Peredibacter","Phenylobacterium","Phyllobacterium","Pir4 lineage","Pirellula","Piscinibacter","Planotetraspora","Plot4-2H12","Polaromonas","Polycyclovorans","Pseudaminobacter","Pseudarthrobacter","Pseudoduganella","Pseudoflavitalea","Pseudolabrys","Pseudomonas","Pseudonocardia","Pseudorhodoplanes","Psychroglaciecola","Puia","RB41","Ramlibacter","Renibacterium","Reyranella","Rhizobacter","Rhizocola","Rhizorhapis","Rhodanobacter","Rhodococcus","Rhodoferax","Rhodomicrobium","Rhodopila","Rhodoplanes","Rhodopseudomonas","Roseisolibacter","Roseomonas","Rubellimicrobium","Rubrobacter","Rudaea","Rugosimonospora","SH-PL14","SWB02","Saccharothrix","Sandaracinus","Sediminibacterium","Segetibacter","Shimazuella","Singulisphaera","Skermanella","Smaragdicoccus","Solibacillus","Solirubrobacter","Sphaerisporangium","Sphaerotilus","Sphingoaurantiacus","Sphingomonas","Spirochaeta","Sporichthya","Stenotrophobacter","Steroidobacter","Streptomyces","Streptosporangium","Subgroup 10","Sulfurifustis","Sumerlaea","Symbiobacterium","Tahibacter","Taibaiella","Tardiphaga","Telmatocola","Tepidisphaera","Terrabacter","Terribacillus","Terrimonas","Thermomonas","Thermosporothrix","Tumebacillus","Tundrisphaera","UBA6140","Vampirovibrio","Variovorax","Vicinamibacter","Vulgatibacter","Xylophilus","Zavarzinella","[Aquaspirillum] arcticum group","[Polyangium] brachysporum group","mle1-7","possible genus 04"]},"diff":{"fert":1646,"time":580,"line":2,"plot":2281},"lineKinds":[{"common":241,"rank":215,"phylum":"Proteobacteria","family":"Rhodocyclaceae","genus":"Denitratisoma","more":"Ctrl","q":0.0311},{"common":1829,"rank":1819,"phylum":"Actinobacteriota","family":"Streptomycetaceae","genus":"Kitasatospora","more":"BNI","q":0.0354}],"n2oTop":[{"common":227,"name":"Polycyclovorans","phylum":"Proteobacteria","rho":-0.59},{"common":1371,"name":"Flavobacterium","phylum":"Bacteroidota","rho":0.51},{"common":903,"name":"possible genus 04","phylum":"Fibrobacterota","rho":-0.51}],"n2oMax":0.59},"net":{"params":{"prevalence":0.2,"transform":"centred log-ratio (CLR), pseudocount 1, over the common kinds","correlation":"Spearman","rho":0.6,"q":0.05,"fdr":"Benjamini-Hochberg (t approximation)","modules":"Louvain on the positive links, seed 1; a module has 3 or more kinds"},"n":1564,"links":22348,"pos":18216,"neg":4132,"Q":0.611,"lcc":1487,"density":0.0183,"meanDeg":28.58,"modules":17,"node":"AAABAAIAAwAEAAUABgAHAAgACQAKAAsADAANAA4ADwARABIAEwAUABUAFgAXABgAGQAaABsAHAAdAB4AHwAgACEAIgAjACQAJQAmACcAKAApACoAKwAsAC0ALgAvADAAMQAyADMANAA1ADYANwA4ADkAOgA7AD0APgA/AEAAQQBCAEMARABFAEYARwBIAEoASwBMAE0ATgBPAFAAUQBSAFMAVABWAFcAWABZAFoAWwBcAF0AXgBfAGEAYgBjAGQAZQBmAGkAawBsAG0AbgBvAHAAcQByAHMAdAB1AHYAdwB4AHkAegB7AH0AfgB/AIAAggCDAIQAhQCGAIcAiACJAIoAiwCMAI0AjgCPAJAAkQCSAJMAlACVAJcAmACaAJsAnACdAJ4AnwCgAKEAogCjAKUApgCnAKgAqQCqAKsArACtAK4ArwCwALEAsgCzALQAtQC2ALcAuAC5ALoAuwC8AL0AvgC/AMAAwQDCAMMAxADFAMYAyADJAMoAywDMAM0AzgDPANEA0gDTANUA1gDXANgA2QDaANwA3QDeAOAA4QDiAOMA5QDmAOcA6ADrAOwA7QDuAO8A8ADyAPMA9AD1APcA+AD5APoA+wD8AP0A/gD/AAABAQECAQQBBgEHAQkBCgELAQ0BDgEPARABEgETARUBFgEXARgBGgEbARwBHQEfASABIQEiASMBJQEmAScBKAEpASoBKwEsAS0BLgEvATABMQEyATMBNAE1ATYBNwE4ATkBOgE7AT0BPgE/AUABQQFCAUMBRAFFAUYBRwFIAUkBSgFLAUwBTQFOAU8BUQFSAVYBVwFYAVkBWgFcAV0BXgFfAWABYQFiAWMBZAFlAWYBaAFqAWsBbAFtAW4BbwFwAXIBdQF3AXgBeQF6AXsBfAF9AX4BfwGAAYEBggGDAYQBhQGGAYcBiAGJAYoBiwGOAY8BkAGRAZIBkwGWAZcBmAGZAZoBmwGcAZ0BoAGjAaQBpgGnAagBqQGqAasBrAGtAa4BrwGwAbEBsgGzAbQBuwG8Ab0BvgG/AcABwQHDAcQBxQHGAcgByQHKAcwBzQHPAdEB0wHUAdUB1gHXAdgB2QHbAdwB3QHgAeEB4gHjAeQB5gHnAegB6QHqAewB7gHvAfEB8gHzAfQB9QH2AfcB+QH7AfwB/QH+AQICAwIEAgUCCAIJAgoCCwIMAg4CEAISAhQCFQIWAhgCGQIaAhsCHAIeAh8CIAIhAiICIwIkAiUCJgInAigCKQIsAi0CLgIvAjACMQIyAjMCNAI1AjYCNwI4AjkCPAI9Aj4CPwJAAkICQwJFAkYCSAJKAkwCTQJOAk8CUAJRAlICVwJYAlwCXQJfAmACYQJiAmMCZAJlAmkCagJrAmwCbgJvAnICcwJ0AnoCfQJ+An8CgAKFAoYChwKJAowCjQKOAo8CkAKRApMClAKVApYClwKaAp0CnwKgAqICpAKmAqgCqQKqAq0CrgKvArACsgKzArQCtQK2ArcCuQK6ArsCvAK9Ar8CwQLCAsMCxQLGAscCyQLLAswCzgLPAtAC0QLSAtMC1gLXAtgC2QLbAtwC3QLfAuIC5ALlAuYC5wLoAukC6gLrAuwC7gLwAvIC9gL4AvoC+wL8Av4C/wIAAwEDBQMGAwcDCAMLAwwDDQMOAw8DEQMSAxMDFAMVAxcDGQMaAxsDHQMeAx8DIQMjAyQDKAMsAy0DLgMvAzEDMgMzAzQDNQM2AzoDPgNAA0MDRANFA0gDSgNOA08DUANRA1IDUwNVA1cDWANZA1oDWwNdA2ADYQNiA2QDZgNpA2sDbANvA3EDcgN0A3gDeQN6A3wDfQN+A4EDggOFA4YDhwOIA4kDigOLA44DkAOSA5MDlAOVA5YDlwOaA50DnwOhA6IDowOkA6UDpgOnA6kDqgOrA60DrwOzA7QDtQO2A7cDuQO6A7sDvgPBA8IDwwPFA8cDyAPJA8sDzQPOA88D0QPSA9MD1APVA9YD1wPdA94D4APhA+ID5QPmA+cD6APpA+oD7gPvA/ED8gP0A/YD9wP5A/oD+wP9A/4DAwQEBAgEDAQNBA8EEAQRBBIEFAQWBBcEGwQcBB0EIQQjBCYEKAQpBCoELAQtBDEEMgQzBDQENgQ3BD8EQAREBEUERgRHBEoETgRQBFQEVQRWBFgEWQRaBFsEXQRgBGIEYwRnBGkEawRsBG0EbwRwBHQEdQR2BHcEewR8BH0EfgR/BIAEgQSCBIMEhgSHBIgEiQSMBI0EkQSTBJcEmgScBJ0EngSfBKAEoQSjBKUEpgSnBKgEqwStBK4EsQS1BLcEuQS7BLwEvQTDBMUExwTIBMoEzgTQBNEE0wTUBNUE2gTbBNwE3QTeBN8E4gTkBOcE6ATrBO0E8wT0BPUE9gT4BPwE/QT+BAYFBwUKBQ0FEAUTBRUFFwUZBRwFHwUjBSUFJgUoBSkFKgUrBSwFLQUvBTAFMQU0BTUFNgU8BUAFQwVEBUYFRwVIBUoFTgVPBVQFVgVaBVsFXgVkBWgFagVtBW4FbwVwBXIFdAV3BXgFegV9BYAFhQWHBYgFjgWSBZMFlQWXBZgFngWhBagFqQWwBbMFtgW/BcAFwgXFBcgFygXNBc4FzwXSBdQF1gXaBeYF6QXqBewF7QXvBfIF8wX3BfkF/wUBBgIGBAYHBg0GDgYPBhEGEgYTBhYGFwYZBhsGHAYdBh8GIQYjBiQGKQYsBi0GMwY0BjYGOgY/BkAGQgZDBkcGTQZVBloGZAZlBmcGaQZqBmwGbgZwBnIGcwZ3BngGfAZ/BoAGggaDBoQGiQaLBpAGkwaVBqUGpwaoBq0GsAazBrYGuAa6BrwGvQa+Br8GwQbDBsQGxgbIBsoGzgbRBtIG0wbUBtYG2gbgBuMG5QbnBuwG9wb5Bg4HEAcVBxgHGwccBx0HHgcgByEHJgcqBy8HMwc1BzgHOwc/B0IHSQdLB1EHVAdVB1gHWgdeB2QHZgdpB2oHawdyB3MHdAd2B3cHeAd5B3oHfQd+B4AHggeDB4YHiQeLB4wHkQeaB50HngelB6gHrQeuB7AHsQe+B78HwAfFB8sHzAfNB9EH0wfVB9cH3AfdB+cH6wfsB/EH9Af4B/0HAQgECAkIEQgUCBUIGAgjCCYIKAgpCC8IMwg2CEIIRghICEwITQhQCFgIWwhcCF0IYAhhCGIIYwhkCGcIaAhrCG8IcAhzCHYIeAh/CIEIiwiMCJAIkgiTCJcImAieCKIIowilCKcIqAiqCK0IrgiwCLgIuQi8CL0IvgjACMEIxQjGCMkIywjMCM0IzwjSCNYI1wjYCNkI3gjfCOEI4gjlCOYI5wjrCPEI8gj4CPsI/gj/CAEJAwkGCQ8JFgkZCRoJHAkhCSYJKAkrCTYJPAk/CUYJSAlJCVEJUglUCVYJWgllCW0JbwlwCXEJcwl5CXsJfgl/CYAJhQmJCZAJkgmTCZYJoQmjCawJrQmuCa8JsQm1CbcJuAm5Cb4JwAnDCcQJxQnPCdEJ0wnVCdcJ2AnbCeUJ7QnvCfQJ/An/CQMKCwoNChEKEwoZChsKHAogCiQKKQorCiwKLwo0CjYKOgo9CkEKRApFCksKTQpQClcKXApfCmUKbgpwCnYKewp9CoEKggqDCoQKhgqICokKigqMCo0KjgqQCpEKlwqgCqIKpAqlCqcKqAqsCr4KyArJCsoKzQrVCt4K5QrqCu0K7grvCvEK8wr2CvgK/Ar9CgELBgsICwkLCgsRCx0LIAsjCyQLLgsvCzYLRAtHC0gLSQtRC1ILVQtXC1gLWQtbC1wLXgtnC20LbwtyC3ULdgt4C3wLgQuDC4cLiQuKC40LjguQC5ILlguYC5sLnQufC6ALpwuoC6sLrQuxC7MLuAu5C74LxAvLC9AL3wvhC+QL5gvxC/QL+gsADAEMAwwMDBAMEwwWDBgMGwwcDCMMJAwrDCwMOAw8DD0MQQxDDEUMSQxODFAMVAxXDFwMXgxgDGEMYwxlDGcMbwxwDHIMdQx2DHcMgwyEDIUMjwyQDJMMlQyXDJkMmgybDJwMoAyhDKIMpQymDK4MsgyzDLQMtQy3DL4MwAzCDMcMygzLDM8M0gzTDNYM3gzkDOYM6wzsDPYM+gz7DP0M/wwBDQINBA0FDQcNCA0LDQ8NEA0SDRQNFQ0WDRcNGg0eDSENJw0pDSwNMw0=","mod":"AAIDAAQAAQECAQEAAAMBAAACAwMAAQABAgADAgEAAgUBAgEAAwEABQAEBAIAAQAAAAECAAEAAAEAAAQDAgEBAgUAAAABAAACAAQAAAAAAwEAAwICAQIBAwABAgEBAQICBAEABAIBAwICAgEBAAABAwECAwMBAgIOBAMBAgABAAAAAwICAQACAQUBAwQDAgACAAACAAEDAgICAAEBAAIAAAMAAwIAAQMAAAMCAwICAAICAAMDBQQCAQICAAECAQH//wEAAgIAAQICAQABAwEBAgAAAgoCAwEDAAMCAQMBAwUBAgICAQEBAgEAAwADAAAAAAH/AAICAwADAwUFAwIBAgEAAwEAAwAAAQICAwIAAAIDAgICAwACAQEABAMDDQABAgAAAQMCAQUDAAIAAwUCAAAEAAAAAAEDAAMAAQECAwADAQAABAQAAAIDCQECAgACAQACAAACAgICBQICBQADAQAAAAIDAgABAwADAgACAv8AAAEBAgABAgIDAQEFAgMAAAAFAQMAAAMAAgADAwABAAH/AQD/AAACAQMBAAUDAgQBAAIAAQAAAwAAAAIDAAMCAAAAAQQCAQMDAAH/AAABAAMAAAICBAICCQIEAQEKAwMAAP8DAwAAAQMCAQECAAADAgABAwIBAgEAAAICAAAAAwEDAgAABQACAgACAwQEAAMABAMCAAIDAwMAAAEBAAMA/wMAAAQABQIBAAECAAT/AQL/AgICAgALAAADCgMFAwEEAwADAAECAwEBAQAAAQEBAAIBAAcAAgACAAEDAgIBAgEBAQECAQwEAwACBAECAwUBAgAAAwEDAAAEAwADAQEAAwEBAv8CBwMCAAIAAgIAAgIDAAAAAAAAAwAAAAIAAAECBAAAAQIDAQEBAgACAwIB/wACAAIDBAMAAgAAAgAFAwUDAAIABP8AAAAF/wEBAgMD/wIA/wIAAAIFBAQE/wH/AwMDAgMAAwABAAIB/wEDAgABBAEAAgIDAAADAwcDAgMCAwEAAgMEAQIEBAD/AAMBAAAAAgMDAAIDAgEBAQIDAAICAAUAAP8DAAICAgMBAwMAAQABAAABAgIAAQEDAgUDBAMCAAAC/wABAgECAgACAAADAgIEAwIAAQEE/wH/AgD/AwAAAQMJAQEEAQP/AwAC//8AAQAAAAADAP8DAAICBAT//wIBAAMCAQQPAAEDAAMCBAMDBAIAAAQCAwIDAwQCAQAAAAAEBAQAAAABBAMAAAAABAMDAAIAAAAAAQAEAAMAAwIAAQEBAAEEAA0DAAAAAAIDAwAAAwEDAAAAAP8EAgQD/wMA/wAA/wACAQMCAgMCAwAABQMABQIBAgACAQD/BAACCwQAAwQAAQMCAgIFAP8EAQIBAAADAQL/AA4AAQD/AQQCAP//AgD/AQD/BA8DAwECA/8DAwEAAgIDBAEAAAMEAAMDAQIBAAMAAgQBAwECAgT/BAMDAAAE/wAABAMCAAIBAgADAwQEAAAAAAACAAQAAAIABAQCAAQAAwAAAwABAwIAAgsAAgEC/wIDAv8EAQABAgQDAAMCAAQBBQIEAgMCBAEDAwEAAQABBAQABAEBAAQEAwQA/wQBAwACBAABAgAEAgIEAAQBBAIA/wABAAH/BAIBAAIDAAQEAgAAAAEBAAQCAgQEBAMDAAIEAAEAAwACAAQBAAQBAgAAAwEADQIBBAEEDwQAAQAEBQEB/wEEAwEBAv8BAQQEAQYBAAQCAQECBAIECAIAAwAAAAABAAAAAAQAAwQCAf8BAQEABAQCBAEBBAD/AgABAQYEAAQEAQAOAAMEBAEAAgIAAgABAAAAAAAEBAIEAAEAAgABAQQBAAQDAgIAAAABAAQAAwQCBAQAAQQDBAIE/wAI/wAEAgAAAQwBBAEBAQEABAIBAQABAwQBBAIEAQQEAQIAAQEEAgT/BAIEAQQB/wABBAYEBAICAQQCAAgBBAEBBAEBAgQAAgAQBwQQAQAABAECAQQCAQQCAQH/AAABAP8CAAEEAQEBAQwEAQEEAQEGBAQBAQEHAgQAAQIABAEEBAH/BAYBAQgBAQEAAAECBAEBAQEBAAQBAgH/AhAB/wEAAQ==","deg":"UgBiAKIANwA5AAkABAAmAFUAYgB4ABEAAwAdADwAZABhAOYABQA4ADUADQAGAAEAEgAgAAQAzwAeAEMAygAOADwAxAAdAAcABwAnABAAAQApABMAGACnAGsAGgAjAAgAWgAZAEAAnwAnACkAHwAVAAMACAAcAKYAjAAOAB8ArAAfABkAAwBJACsAKgABAGYAQwCDAAgAgAAwABAACAAGAAQAAgBqADgAFAABAEcAnwBGACcAxQADABAAJwAuAEUAGAAeAAgACwBVABAABgDNAAMAMAAeAAgABAAYABwABQAaAFEALQAoAAQABQBVAAEABACNAEIASgAzACkAPABBAAYAAQBUAD0AAQAIAAkAGQAJADsAXwBkAEwANABPAD4AsAAmAG8ABQAvAJIAxQATAD8ADQABAAIAGgA7AEIAEgABACQAEABoACQABwAFABAADAABAIwABgDBAIoAMQCMAGgAJAAFAA8ACwAEAFQADgBzAAEAAQA8ADwAAQBEAAEAAQACAIcAxAANABIAEABZACkAEQBgAA8AdwAKAGYAnAAaABkAKQABAA8AWgAFAEcAAQAfAHAAGgACAAEApwAUABcAXAAYABwAAgAFAAYAJAAWAAMAAQAeAF0ANABhADIALwA0AAEAFQCoAAEAnABVAAEAOgAPAAEAVQBgAAEAVQAhAAgADwAFACoAOQAMAAQABwClAGMAFQBGADkAJgBdACwAFwByACAAWwAKAAUADABSAAcADACSAEMAAgA9AAIAAwBDAAEAIAADAA0ADwAKAAMAOwBMAIIAAgABABEAEAAZAAIAHgA8AAkAHAAYADkAJwAOABMAAwBGAJAANAADAA0ACAACAAEAHgAaAAgARwBGAFkAAQAOABwAFgACABEAFAAiAGAAMQAGAHwACwA5AA0ABQA+ABUAAwAXAFUACQAaAB4AZgBZADsAlwATADEABABGAAQAMAAaABQACQABAIMACQAtAAYAEwA9AB0AAwABAAEANgApAC0AewABABwAAgAmAAUAGgAMADQABgAXAGwAPAAUALkADgABAB4ARAAKAAEAFgAGAAEAAQABADsAAgA+ABMACwAcAAEADQAKABMAEgACABcABQAkAF8AJAAPAA8APAARAB0ABAAGAOgAKgBsAAEADQAiABwACAABADUAHQAGAAEAAgATAAQALQADAAMAAgCkACwAKAB0AAUAAgAXAEAACgALAAIADwABAAoAGQACACQANQBqAB0ACQClAMUAGQACAB4AMwABABMAAgAgAB8AXQAJAAMAgwAGAAoAGQChAAUAFgADAAIAOgAVAJAAIwA8AAEADQAHAHgAYwAEAEsAGAACAAMAIgCPAAEABwASAGAAVwAFACsAdAAXAA0AAQAoAAUACgBFADUAAQAHABcAAQABABEAKQBGACAATwAuAGYALwARAAEABwA9AAEAAQBjAGsAKwAHAAEAiQASADgAAQACAAcABgACAEYALAAwAGkAQwA1ABMAewATAD8AIgAJACwAHQAkAAIAAQCmADsAegABAFMAGwAJAAcACgABAAIArAA1AA4AQAADAAkARwAEAAMAGwACAAwACAAKAFMAJgAxAGAAAQAHABEANQACAB0AAQADAEoAJAAdACYAJAABAA4AAgASAAoACAAVAAEAIQABAG8AAQAUAKcABgCnAC8AsAABACYAHQBGAAIAAgALABoAAgABAAgAFwAPAA8AGgAiAC4ACgAXAAEABgABAAsAAwB6AKgAAgACAAoAewABAAMAAQAJAAMAAQBfAFMAGwCNAAMABAANAAcAPQBbABMAewAOAAsABwAJAIUAHwCBABAAAgABAAEABQATAC4AAQAXAAMACAADAAkAAQA5ACQAAQBUAAEAAQAIAAgAEQACAAUAAQACAAEAcQCUAAEAngA7AAEAFgAbAAcACgBiAAIAAwA9ABoAnwBNADUACQACAAoACQBlAEcABgADAH4ACQABAC8AAQBJAGcACAABAAIANwA2AAIAAgBzAAgAIgAcAAEACAA8AAMABgAMAAUAQgA3AGwABwBCABIAlQAEAAgAMAAWAAYAAgALAE0ACAACAAUAAQACAAEACwAOACcABAApABcAcQAFADsAGwA1AAEAAQBUACMALgAIAAEAKQABAF4AEwAGAE4AKAARACAAEAAKADEAAQAGAAQAKQAbABMACwBuAAEAAgBGADkAAwBjAAMAeQAgADoAEQAJABIAAQA6AAEABQAWAAEAAQADACAAAwACAAEAAQAFAAoAAgA9AAEAKQABADIAAQABAAsAAwAQAAsAQwAnAAQAAQABAD8ASACYAF8AFwAMAAEAAQAOAAQATABNACAADgADAAIAAwADAF8AFQAKAAsAKAAYACIAAwANAAEABwADAFYAAwAGAC8AUAAMAB4AMQAIAAQAEAAPAHwAGQAJAAEAGQAHABoADQAGABUAGgAWAAYAlAAEADMABQABAAQAAwAkAAIADAADAHgAAwAOAB0AAgAfAC0AAwAsACAAAQANACcADAABAAcAAQAEAAcAEQBZAD8ANgAcADkACQATAEcAAwA1ACMAKwABAAEAAgAEAAQAAQAdAAQAAQAEAAMAAwABADYAIwAEADcAigBhAA0AAQAZADAABQB/ABsADgAYAAEAfAAHAAgAKQAuAAEAIgAXABoAAQACADUABwADAAgADQBtABQACgAxAAUAAgABAA4AAQBlAAQAAwANAGcAJgASAAEAFAACAAEAAgAIAAEAAQAlAEIAAgABAAEAAQANAAEAUAADAAEAAgABAAQAGwATABUAHAABAFQAAQAUAAEAMwA0AGEAAgADAAUAGQAEAAQADQADAAwAAgABACMAAwAoAAMAdAACAAMACAABAAQAIwAOAAEABgABABQABQAHAAEAAQABAB8ACAAzACkAFwAeAAUADgAEAAQAAwAdAAEAAwABAAIAJwAEAAUAFwAKAAEACgAPAC0ALAASAAYABAALABYAAQAGAAEAPwAIAAUALgACAAUAMAADAAIAPQAfAAoAAQAGAAMAEAABAAIAEgAFAAYAEwABAA0AFAAKAA4AAwAkAAIADgAGABcARgAPAAMAQQAEACcAIwAPAAEAFQADABMABQATAAMAIAAJAAkAGwAEAAIAAQACAAUAAQAqAAIABgAEABsACgAGAAMAOQAHAA0AAQAEAAUACQALAAIAGwAiAA4AAgACACUABQABAAEACAAHAAsAAgAEACcABQAGAAQAMgADAAoABABTAAsAAgA+AAQAAgABABIADQAFABgAAQAPAAEADgABAAEAAQAYAAEAAwAPAAIAAwA9ABQAAgABAAIAAQAIAAEAAQAZAAMAMwABAAcAAQAMAAUAAQAFAAQAAgACAAIAAQABAAwAAgABAAIAJwABAAEAAwAhACUABAAEAA8AHgAGAAwAAwADAAIAAQArACUAAQA2AAUAMwANAAQAAgACABUAAwAXAAMAAQALABgAAgABAAEABgABAAQAFgAFAAgAHQAIAAsAFQAEABgANwAPAAEADwAHAAMABwABAA0AAQABAD0ACQABAAEABwACAAMADgABAAUACgABAAcAEgACAAEAHgABAAIAAQABAAYAAgAEABMABAABAAwAAgAGABkAAwATAAMAAwAMAAIABAABABMAAgAEAB8AAQAiAAgAAwACAAIAAQAEAAEAKAAJAAQAAQASAAEAAQABAAEAAQABAAMAEQAQAAwABAACAAMAAQAOAA0AAwAMAAEABgAeAAUAAgAQACIAEgAJAAwABQAHAAwAAQAFABUAAgACAAEAAgADAAgAEQASAAEAEgAPACUAAwABAAkAAQAJAAgABgADAAwABQAHAAEAAgABAAYABQACAAEAAgARAAEAHAADABMAHgAHAAIABwAEAAEAAgAEAAEAAgAEAAIABAAbAAMADQABAAIAAQAEAAEABQANAAEAAQADAAcAAQABAAMAAQADABAAAQAVAAMABAACAAIAAgAKAAEADQABAAIADAABAAoAAQABAAQAEgAEAAUAAQAQAAEACgAQAAoAOwAMAAEACwACAAYABQACAAIAAgBMAAEAAQAPAAgARAABABIAAgAbAAEABgAeAAEAOAABAAEABgACAAQAAQABABQAAwA=","xyz":"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","xyzScale":0.0001,"ij":"/gQFBWcArACVA6IDGwBnABsArAAJAAoAAwDKA2cAlgAvBOEEZwDDAFYC4wWsAMMAGwB4AhsAwwD2ANgBMAAEAoABYQWWAKwABwBcAJYAwwDxAZYCPwBnAAIAlgIRACEAlQOSBAEACAARAB4AwwB4AjAAwgCUASECZwB4An8ANAIKABgBOwDYAQIA8QE7APYAVwDRAjsAVwAbAJYAGwCkAqwAeAIbAEECSQCLABsBiwFBAqwCVwCWAswA3gBXAP8BCgDOAGcAQQLDAEECVwCxAhsBmQHDAK8BiwHYARsAPwAbAdgB2QFMAj8ArAAbAK0A3gCxAkEClQKvAKQCIQDDAAIAVwDZAXwC/wGxAgIA0QI/AMMAAgCLAfQArwGvAEEClgCvAZUD+gWsAEECOwHOAiEArADKAHUB9gAbAQIAGwE8AIsB/wGWAhsArwBnAD0B9gDRAhAA7gA/AHgCAAAPAmIEjwV8AboC5wQ/BUECeAL6BQkGwwCkAmUBQQKVA9IEigBeAT8AlgBnAN8CwwDfAhUCYgTeAOoClgLRAjsAiwEBAB4A9AB8AqwApAIbAGUBCgAaBKIDkgSsAK8AlgKxAjsAlgLnBPoFZwBlAUkAogMHApYCIQBnAPYAiwGWAD0BrADfAj8F+gXYAdECGwDfArEC0QKWAEEClgB4AjsABQMCADsAygBAAxEAWgAIAB4ArAAJA6MArwAwAMoAOwCxAlcA2AGVAz8FAQCXABsAzwBnAAkDCQU/BVcA9gBnAK8BIwKVAq8B6gF2AOIAZQF4AiEAlgAEAFkAZwCvAMMAfQHDAdkBwgI1A/EB0QJ4AqQCrACvARsAfQGKANQBrwHZASEA3wLDAAkDzACxAiEAwwHDAGUB3gD/AQAAEACVAwkGeQCxAgIA9gBBAqQCMwDqASwAMAAKALsA3gDRAjAD0gSiAzQFCQDOAK8BfALnBBUF8QGxAvgBEgaVA+cEVwDxASEATAKLAa8BZwDPAAkBrwEhANkBrAB9AZUAMwJXAN4ASQCVA1cA1QABAFcBcgELAsMBTAKVAqwCrQDPACEA0wLZAUUDAgB1AlIACgGxAuoCrwCVAggAvADeADcCHgBaAJYAzwBnALMCEQCvARUCjwWsANMClQPyBDsA0QLuANUBCQHDAZUA2AEhAD8AGwAJA/8B6gKkAkMDrwDDAEMAfgAVBT8FOwD/AREAfAIrAFoAogPnBN4A2QHPAMMBAwAkBSsAuAAhAK8BVwDqApwBugIDANYBrwF6AvYAlgKVA7kDlQBlAdkB6gGvAHgCZwCkApYC6gL/ATcCWgC4AGIB1QGWAAkDKwHgAqMBCQKYAK0A2QEkAnkAKAI/AG4D2QHmARYANgCWAlsD1QEoAsMA0wKvAdgBzwDTAvQA5gHPAPcBwgAEAjUFgAVnAG0DigBDA84AGAE9AUECAwBdAWcAxgEhAAkBCABXAUwCRQPxAVsDGwF1ArYARgKmASADTAJ8AosB6gMrAGcA2QHeAwkB2QHmAeoBrADPAHoAvgAKAEwDCQF6AgAAsQCLAdECOwAHAl4B1AFlAZUCLADCADMAkAAbACEAVgAYAQoAQwMCANgBwwAjApYArwACANQC2AHQAtgBBQMbAK8BiwF1AqwAZQEAAO4A9ADZASEAfAIhAN4DHQHvBBEAlgJnANMCwwA9AZYAwwE3Ao0DsQElAz0B2QGLAdAC/wHRAisBPQMAAGkBIwJBAnUCjwSWAN8CZQGkAu0A8ADqAXwCAwAyAWUBrALYAfEBZwCaApUDNAXDAFUBsQJ9A/QA6gEhAM8AwwD0ADsA1QCWAPQAAACOAKIDCQaVAqQCGwDGAVcABwIeACEAZwCsAsIAygDDABsC0QJ9AxEAiwG+AN0CPAAbAWAAcgCLAZYC3gBkAUECQwNyAd0CrADqA38A8wAeAHoClgDTAkEC3wI/ALMCPwUJBgkF+gVLAJAACQAYATACogNEAUUBBwKxAswA/wHQAPAAEADFAAcC6gL3ACsBTALTAh4ArwFpAQ8CUgCWAA8BrAIrAfEBOwDeAPIENAV+AKYB0QLqAj8AZQHPAN8CCQPqA/YA8QGsABsCGQI9A1oAdQLDAM8A9wA9A1IAZwBlAd8CUgB2AK8BwwFlAUMDNwJOBDwArwHeAPwAfQF4AmwDswPxAX0DDwBiATsA8QHDAHwCZwB9AXwC3gPDAEwCogP6BRsAQwPYAZYC8gQ/BVkA2wAPAZUCGwDFAuYBiQOWAGUBGwJ4AsoBogMeAAkBrwEJA4wA3gAhAAoBKwBrAZYACQHeAGYCogKkAsoDJAUhAAkDygD1Az8A+gEbAJoCPQHmAR4ATALOABoE2AH6AwQCoQKKAGUBlQNrBawArQA7AMwAlAA+AhsBlgI7AHkAwwFtA5IE0gSiA9IEeAJDA5AAsQHZAXoCHgEiAwkFCQaWAEwCrAA9AYIAlgDDAJUCPABaAOYBfALKABkClgJ9A9cA2QAwApUDZwCVAnkASQGsADsEAADVATcC6gL2ACsElQOlBREA0QIDAGwBrACVAhsA8ALDAMMBZwAJAawAxgERAAkBAQBHAIwA6gIhAFUBEQDxAfYABQMrAOEArwBDA0AAFgIRANkBHgDZAcMB0wKoBDQFMwDvAHkA8QFaAqQCogPyBB4AZwDPAG0DSwBDAj8A6gN5AJYCdgAsAwoA4QJcArUDrwCiAkMApgFaAKoA2AEHBAoBTALKAb8DOAFiAXkA/wE/AJoCrQB4ApYAVQEwAKECAgDgAooApAKOAGkBrwH6AxsAlQIeAJYAeAJuA/MANAKWAKwCGwHRAhsA2gDTAt8CGAEaAj8ArwGoBPoFEQBFAjABowEwAtIEGwEHBEcAwwGvAeYBIwJaAqIDPwURANgBlgCkAg8AEABHANkBGwCwAIsB+gNHAEwC0QLUApIAlgA3ArECZwA7BGcAIwIPANUBZAGxAoMAowDPBAQG8QH/AXkAfQOsAJoClgDZAT8AQQIrAE0C8QF1AhQBsQLDAOUDVwB9A/EBKAIoACADCgHTAqoArwGVACwDVwAFA4wAsQKvAGUB9gCvAaMAwwARAHoCUgDPAFoA+AKVAIsBVwDXAK8B0QI/AAkDDwBLAGcA6gNSAN8CWgH9AxUBJgLmAUwCeAIJA8YBQQLYAeoD9gCxAloAEgECALEBEQB1AnYAewD/AHwCZwDwApUDqAQbACMCPwA9ASEA9AAbACsAwwF8ApAAcAGSBPoFCQF8As0BKwLOAGcBPQHaAooApANnAG4DIQGhAgIAsQKVAOUDrQBaAtECBQNXABsBPwDPAJkBdQIOACIAAwA1AX0BpAISAYACMwBaAMMACQGvAeYCXgFBAhEATAKVAMMAegJ8AvYA3wN4At8C3gAHAgoAlQKQAMIAEQA/ACEARQMrASgCdgCsAv8BBwIeAD8AdQKWAhAA1QHWAcADAgA8AEwAqgCSBDQFogOoBGcA5QN/AMwDPQFMAhgBTAMSAa8BVgAqA5UC3wLeAI0DPwDfAmIB4ALmAy8EegLRAq8A3wI9AeUDGwA8ANcAFAHSBAkGGwBaAkAD4wMKAFYAOwAbARsAswI/ALYAZwCjABsA0wJnAFUBrACzApAA6gGQAK8BVwB5AKwArAL0AFUB2gBjAVcAiwFnABsCEQDqAdoAeAKWAHwCGwHqA1oAiwGQAKoACwLdApYA5gFnAMUCRQA4AQQCbAOWAtQC8QFrAzwC7gMUAVICZQHwAjUBygMRAMMB8QHqAh4AwwGVAPYAowBBAqYBxQMPAWUBzwBMAloArwHdArUD3QElA/EB4AJnAK0AdgA9AUkAMAIQAEsAAgDvAREAwwD/ATEC1QDYAfYABwTDAFIBlQMJBcwAZgIzAiwDngCmARIBUgHTAgkDMwCvAZUCQwN6AH0AfgDEA2cATALVAPYAQQKiAl0B1gHDAd4DVQGkAhEA0wJnAOEAlgBtA6oA6gEbAD0BGwGvAZYA6gODAK8AXQJ1Aq8B3gPeAPYAwgCPAdIEPwWIAaECEQCWAN4ARQMbAKwCBwLRAgoAZwGsAPACrwGzAhEArAA/AKwCrwDwApUA7AA0AswDrwHQAvQATAIeAHwC1wD/AYEBIAORAJ4AQwBHAc8AQQJXAMwAlgD3AVUBrwF4AvACfALTApYAlQIeANMCvgA5AsMArAKjAeQCGwBtAwoAGgIRAAkDEQBwASsAlgAbAFUBlgCaApIE5wSQAJYClAC7AJAAKwECAH0D8QF6AjwAdQKvAUwClQAeAysArAAbAMMBPwDYAcMAEQOkAt8CrwHqA60A9wHYASsEEAAoAvEBBwKqALkBCQAqA8MA9wHMAOoCLAChAiEAeALMAAUBrwF4AloAswLeABQBPAAXAqwAVQEPAVUB9ADDAcMA2QH2AHoCwwBtAzIBygMZAKQAIQBtAz8AbQP2AO8BHgF1A1IALANaAJYAkQAEAZMCsgIbAF0CVwB6Ao8BjQMJAOECPwD0AAIA6gIbALYAowCkAjQFPwURAJAAwwDGAdUA0QLKATACygGVAxgB7QMbAGMBrABDA1oAZwAjAqQCrABuA2MBeAJDAxoEIQBlAaIDZQTeAO8CFQX6BaYBZAQZAvsCUgDDACEAOwRWADwBGwHxATwAZwALAhYC4QIqAwEAvADDAGMBZwCCANsAkAHVAO8BPALmAx4AwwCsAt8CEQAzAFoACQNXAF0DPwA7BNcAsQLKAEwECQBWALEBGQIzAKoAXgFDA2UBogLYAR4DGwAeAHwBnAHnBPIEKwD4AgIABwLDAOoDcAGWAmcA9ABaAkMDrwHTAhMAzACWADsEuwAYAYsBBQNSAKwCWgAbAXkAwgMbAFIAigBBAjsArwGvALAASwBTAEMArgCxAeAC5wS7BVoCeAI7AOoCdgAKAawAbQOmAZkDXgGkAhsAGwIAAEUAkgSoBGcA9wErALMC0gT6Be4DTwU8AMMA5wRrBSMCrAJFAnUCHgD4Ag8BQQKVAEECHgAzADAAiAGLAQcECQC7ANECKwT2APoDIACJACsAzwQTAFcA5wQ0BaMAPQGWAMYBjwGQA3wCRQMYARoEjQNOBN4A3wO2AMMA6gFMAsMA2AHnBAkGKwB1AoUA5wBlAQkDKwCwAIsA+QBXADcBrQDHAFcA7wKhA4AFIwFQAcIAoQL2AOoCDwDuAKwAuACvAMYB2gAqAZYAswLPAHgCwwCLAaMAVQEgACUACQESAf8BQwKhAB4BwwAPAR4AkgDDANoCrADDAdIE5wQuAGABDwF3BMMAAwKVABsBlgD9ADMAegLeACQClgAKAb4AtQMwAEADLAPlA2MBpALYAQQDCAAMAQoAKgMzAHABSQH/AdwBogIhAPcB4AIlA8UBogOsAMUCCABLAHkAiwCQA7UDwwBuA68BHgM/AFUBKwA8ABEAZwA8AJkBlQCvARsA9wErAHgC2QEDAysAFwKKAA4C7gAoAmcA2gICAP8BWgBFAhEAwQOsAOEAIQEEAiMCLAP3ABwCHAFJARsAowCIAQQCrAD3ATkCtQMeAEcARQBiAc8ACgFaAPgBSQHxAR4ASwAJAGcBHgAMAREAOwCkAhoE/ADfA5YC4AIlACsAIQBSAK0ApAJnABEDGwA7BFcAMQKvAFUBVQHfAq8AKgGWAH0BZwAKATMASwB8AtECZwBDA0kA0gTaAKQC2AGxAsIAiAEoAuACzgBDA0sA7gAJABoEVwDUApIEawUCABkCrADmAh4AbQOKADMCeQCtA2UBMwJeAaQD1QAFA6IDuQM/AK0AKwGxAZYAAwIDACkCewBMAosBCQMsAAQCQQLlAzsEFwX0AHoC9wBwAawCQwMJAQkDzADZAXkAawNkANkBwwDmAjsABwR2AEwCSQEoAqwA9ACWAOUDFAHqAgMAYwKWAN4D2wQSBkkACQb3AdMCLAN1AxgBPgIwAHUBjADMAMMACgFnAJUApAIJAwIARQIrAygFrACLASwAygB9ARsCKwGqAsIAowKWAgcEkgQ/BbMCCQNdAcoDUgAjAtgBRQMZAkADEQD2AJUAXgHeAOwArADlA8MA3gMAADAB+ALBA6wCdwQrAeMBQQI7BMMAxQJJAZYCuACzAkwC3gNLAI8A9gDvAgoApAL2AOoDMwB8AlYA7QOWAtACfgDFA6QC3QOsACMC3gCWAosBmQEPAI4AlQAlBMMA8AJwAfMB8QEFA0sADgH2AP8BEQD/AQEAEQB2AQsCHQA9A5YCqgLPACMCeAKVAj8A0wJSAKwAZwADApIE8gQhAOYBlQDVAN4A5wI1AO4AeQAHAq0AQwOsAAkBEgHqARABlgIhAD0BIQD9AAkBTALmA+EE0ALqA/gB+AIbAFoACQHqAV0CjwSsAHwCVgDhAl0CIgTGAaQCEQBDAiMCeAJYAI4AKwBdAq0AwwB2AA8BngAgAwoACAQoAq0DUgB7AEEC3QMPAXUDAQAMAQkA4ABnAMMBCgHZARkA7gB4AqwC5wSlBYsB8QEsA4wDKwEZAs8ACQE/AKQCIwLfAjwAqgBnANoARwB7AAQADAJFApYCKwBjARsA6gPZAd8DAwANBQ8AKAIKAVUBMwBIAK8ArAITANkAMAEJAhQALABnARoEUgBMApAAQwKxAT0DOwA+AcMAmgI8Ak8FrACwAAAAYgEoApYC/QBMAgIAmQHFAZUDdQLgApUA3wMrAXABzwBIAVoA8wEsAIgBGwAJAQkA8AGVAhoE6gEkAl4BuAFnAIsBlgDqAaMA3wKWAA8BZwC4AAAAKAJwASgCPgBEAHgCxQJSAD0BPwAbAR4AXQICAKoCMgE1AUcBJQMJAYACAwBiAWcAAwR9AL4AHgDBAw8AKwE8AOoDkAA9A9ECXQNHAUcDMwCxARgBPAHmAd8D3gAFAQAFpQUhAEcATAI7BPoB6gMRAN4DCQHTApUDuwVrBQkGrAI7BDwAeAIeAJAAKAKNApYA2gAJBaMFZwDZAbsF+gVXAEkBMAIwAx4DOwQ/AAoBGwADAhgBugJXADcCFAE3ArQAugIdAEcBHgDqAcMAOwSMADcCDwD3AFYAOQIeAJoCJQKPA8MBegJjAsoDkAD3ADMA9ADDALMCKQA6ABgBfAHKAAQCwwDaAFIA0wKiAwkFwgArAVUBZQEbALgAeAJtAwkB9wH/AQUD9AAJAcMB9wF5AFsDIQDYAVIAVQGvAD0B2AEzAtoAVQGOAGIBXgEaBNgB3wMrAAkD+AISBsMA+gNLAHABKwCaAjAAgQPuAA8CCgHDAVoAXQJeAX4C8gQVBZYAsAD6AyUEZADmAZUArADKApUDPQHfAngCmgLfAvAC/wF9A2UBIwKKAJUARwCWAA8AOAEwACEB/AAeAxEA9wERAEcAZAShBN8CCQPeANgBegA5AhsAbgOvAd8CwwCJA5YAowBkAdECiwHDA8IAQAN+AGQEZwCwADwC4QRmArECCgBaAhsAlwFHAP0ANQMUBXIBvAIjAsUCfAHtAx4BpgEbAOEA3gB8ArkDkgSPAbYDFAApATMAwgA8AFIBUgGvAboC7QMYAeECPwBSAHkA6gIrAD8AEQCqAIsBswI7AO8CCgE9AdYDGwULAgMDUgDjAP8A2QGsANgBuwAnBNgB5wI7ACsEzwCsAj8A9wE9Aa8B7wHRAhgBJwSWAgUDlgCtAJUCdwRXAGQBNAX6BTwACQOVALgBUgCVAisBlgLDAOYBHgCsABEAEgHCACgCEQC4AAIAkABHAM8APwDQAsIAdQErARwCPAFCAh4AxwBaAAkBGwFdAkQCxAX4AdsEEQAFA0UDBwRaAJAACgCvAMMBOwSDAR4FegA+AloAcAHCAI0DzAAGAmcAkgBFABIC4QAXAkkAygGxAgUDJQNHAxEAGwG4AAkDdQFAAwIAKwGKAHgCYgHKA68B5QMEAIsADgA3AIoAGgTeAOoBFAAwAHkAKwGSAAkBRwBkABEA6gMKAd4DSQB5APYABAMhAHoCZwB8Ah4AzwA7ANACOQLdAhcCswI8ABIBPAJAA6wCbgOiA1cFygBhASIAJQAhAEECqgASAd4AKgJIAKoCigAEAQoAwwLfAkMDVwDvAaQC8AKqALgAuwAaAnsAwwFsBYAFlQJ1A9ACBwSWACMC0wJtAw4AIABBAtMCiwErBCgCPQNnAN4DPwAHBLgAXQIBAMMB0gTyBB4AswI3AkEDrAAPAZ4AIQG4APgCsQBsAwkBRQNXAK8BuACaAn0BrwH2ANACLgDjA/YAXQNlAcYBWgCsAFcARQPYAcMDbQM7BKwAGwEeAFMAKgGiAh4AKwBVAcMB7AD8AJIAzwCvATsEjAAFAZUADgI8AuMDlAAjASMBgATDAOoB/QB8AiEA5gKKALgBKwASAaMArADmA+4DNwLRAj0BrAJDAOkBDwHfAgsBkgFnAFoCTAJ0BPYANwGsAnUD9ABFAzECsQI7ANQCPgHYASgApgGCAMMAPAD6A1IADwE/AEMDrwAaBGQE3QQ8AeECEQBLALgAdQLZAR4DlgCLAREAswI/AHwCrAIsA1IAwwERAFcAHgD9AM4AjgEoAHwAEQBtA6wAXQLYAf8BRwHVAXkAjADCAD0DKwCSAK8AfQFSAP0AAgCvAQAA8QAbAQkDPwDwAqwA2gCIAa0D6gJ9A34AoQRXANkBLgDKAK8BbQMSAQkDQQKpAsUC8AJnALYAGwCKABEAzwCvAM4AsQHjAXwAIgOxAu8CGAEqAxwAfQAUADYAdgB1A6ICQwNnAGMBkAC5ATUASwAeAFcBOwA3AcoAPQNDAB4BDgIlBM4AlQKDAdgC2gLfApYA8AKUABgBXgGsAj0BeAI8AF0CDQFHAaEC9QPeAAUDHgPlA94AyAOjAJUC3wIsA5YA2gJHAOoB2AF8Ao4AsQBZAK0AZQGLAY4A1QFHAAkBoQBnAnUCswIRACsBxwDPAD8AiwGSBAkGMAOVA7YCuwLmAgkDeALTAnwAHgHyBPoFlgARA80AgwGaAt8CeQAcAUMCsQKVAPoDDgBqAFkA4AB8AokD8AB8ASEAAwQxAjcCfgCZAzAA9QOWAJcBGwHQAgcCfQPdApADZQGvAbQAfAHKALEBVQF4AgIA0AIrAdcCiwCMANgBegK5A9IEnQDZAQoAigA7ADcCeAKpAggAAwNBAsUCiwFFApUDFQVBAm4DogNrBe4AjQIzACsB9gDnAjADCAUCAFsD2QHTAl0AcAA7AO8BQQLwAvMBdQIwAI8BQQIlBBgBQgKKAFwEigCzABsAiwFaAMMAgwAqAY4AEgKtAGUB9AA9AdYBygNsAcoDRwCvAT8AWgB9AQkDMwDZAREA9ADGAXgCBADbAK8BRQOZAY8E3gB6AmcA5gJ4ArMCWgCSAM8AZQERANAC+AHwBB4D3wPDAPYArwGJA1EBYQEKAOIBeAKiAh4A9ACvAUEClgC2AOoBegLRAkUD9AAJA2QA6gEIAEcAPAE5An0BQQIhAFoABAFDA94AfQMQALEAJAJMAjwAswJBAgkDPwAXAiwDdgMRABsAPACJATEAAAGxAZYChwWQBT8ATAKOAA8CewD9AF4BIwKiA44EOwDnAsoAbwM+AbECPQNAA2QACQGhAlMDXwAJAYoAfgLQAtECqATyBEgA6gH/AXoC7AAeAwAAygMjAkMDTAJtA8YBCQNwAT0DewGiA98COwRnAF0C2QHQAn0DwgNMAiwDcwXLBX0BXQIrASUDOwDDAwoAXgHMAPwAuwAIBI4ABgErAKoA/wFmAukBmQTCAK0DzwBXAZYAEgHMADcCYASlBRAA7QCxASgCsQFAAysA9wGWAOYCZwDmAcYBrAIyASkCKwHVAcMAWgIRAAcD7gBpASkBpgEKAJ4AjAD/AXkAMQKxAlsDCgGsAmQATAJ1AeMDsgL1A2UAdgFlATsEggD9AP8AQwKtAH0BiwHUAtUAhwGsAPoBZwCpAs8AOwQ+AAUBKwDaACEAxgFSAEECvgByAawAJQT8APUCNALKAxQB3QJnAPoDXgGVAtUA/wH0ANgBiwEeA2UBJQStACMCEwA7AKQCrAKVAHYDggCvAdECBwStAEECBAEYAVsDfQMeANECCQAOACgCsQK2AM8AOgBJAM4AGgKWAOEAJgPPBC4AMAA9AXwCrwHfA8oAsgKjATsCrABMAsMAdgOKAFoCOwBFAkECbQN6ApYC2gAJA68A3QPDABIBOgFTAe4AYgG2APcB8QE9A1MBaQHEA2QEfwC4At0CtgPCALkBPwVrBR4AvAAbAt8CHgAJA1wC3QLCAL8BSwC8AHgCJQQgACIASwAoAmQB6gJnACwDCQFtAwQCgQMuAE0AGwASAfACQwOvAZYCuQPyBKYBXwSvAaQCHgBwAR4A+AHXAN4AEQCxAh4ACgEKAd8CogOlBaoAYwEoAIEBAgAFAz0B3gOvANoADwGkAhAAGQARAF0CjAD5AJUApAKVAqIC8QFFAhsBBQN+ADMBrwBaAvsCZwMAASEEXwRkBEwDGgQCACgCVwArBEwAawGBAaYBPwCvAIwAFAGoBOcE4QB4AvYAfAIRAP8ASQDnBJoCbQMCAHkAGwBeAWcADwEuBQkG9gBFAxsATwQ9AWUBPAB9AVoAwQNaAJYCnADrABEAfQNgAdABkQAgA/YABwJ+AqQDAAADAD8AxwBSAHUDlgBuA7EBRwPSBAgFcgFcApUA5wJLAFgAiwHIA8MAJQRIAdMCBwA0AF8ADAE8AJYACQGzAsoAgQPZAWECRQKqAlcAawOVA2UErQDFAkwC3wIOAIkAMwBHAPMBlgKvAGMBMwD/AGcAEgEKANQBZwBxAM4ATAM9AdMCPwB9AYIAVQFrBfoFHgBFA8IAgQM8AGcDiAEoAsMA/QAkAnwCNwHRAqMAeAJ2A+UDRwHsAT0BLAOkAqQD0QBAA94AMQL6AQkD1AFDA1cABwQwA+cEPQGVApIArwEbAa8DXgF4AiMBgwHPAD0BrABaAkECTwQlALAA4gBFATsAawM/BWIFiwCiA1oA0wJIAJAAHgBfAK8A4QA8AD8AAgB6AhsACgHCAN0BWgLFAmUAHwHCALEBMAKSBJUDrQMBAM8ArQDGAV4BZQEJAEICqgDDAAMAwAMQAEUA+QA3AtkB/wF1AfUDAwIJA9cASQH0AIkD/wAkAooArwCLAeoBrwDPAKIDrQPOAKQCGwH6AxAAQwL8AGoCZwDYAUkB1QHhAAkDrABPBB4AiwHKAOMDpgGhBNECLwN8AKYBIwKpArMC0AKPAJAAkAD/AXoAGALqAYkD2AEHApUDLgXOACoBEQCaAh4AuADwAJwBwwADBD8AIwLXADECfAAgAyoBlQJHAHwCCQU0Bf0AwwGQAKoBeQDVAXsBNQIbAOUDPwAXBZUA9ACsALYAZAB7AK0AtgAeAKoAFQXyBQABkgFBAiwDDwBpAc8ArwEeANoDXQJ4AtMC5gLsACwDWgHZAdAA7QAkAgMD3gArBMIABwKWAIkDIQO+BBgBnAGjANoCHgPIAx4AAwTMAN8DDQBOAEgA7wDOAFoC1QHgAksA/wHDAd8CfAJtA88AxgEbAcMDZQHTAkUA1QEPAeYBlgAbAn0B3wLHAMgACQCiAxgBZwHeAK8BegJFA0QAYQB9AeoDVgBCApAAZgNLACQCPwDFAq0ACQP9ANkBDgBEAEgAKwGOAO4A9ADmAq0AsABJAbECQQAyAXEAQQIDAkECLAAhAWcAMwJlAaQDQAOgA8MBRQOvASsEZAB8Aj8AlQCsABMElgC4AK0ArwDCADcCSwB/AQkB3gOvAA8BqgBrAfUDTAQbAqQCTADvAK0A2wDjASgCHgD3AUkA+gWQAOoCiwGUBMMAGwECAFoAEQD4AtkB/gLKAqIDVQHTAnYA5gFIAfcBVwAcA00A9gFJAJIECQHfAgIAawNsAdYBewDjACsAwwAeABIBZwDHALYAeAIbAMcAWgDqAT8AMwKkAiUEsADGAVIBfQFWABoCOwDIA4wA1wBaAFIBWgD3ATMAqgHeAHEEmgKzAiQCjQOsAF4B1QCLAV4BpwIrAK0APwDZAaoAiwEwAvIEVwAoApoC0wI7AGQBfALfAtMCRQNXABQB4QCzAvEBqgKQAPEBXgEzAoUBRQIAAI0CAwJ4AgEACQE/AFoCygBRAT0BiQNXAGYCNQC8AAQAogMXAl0CaQHVAVgAkACLAW4EiwEOAjsAKAIIAJ0AMgHWARgBCAQIADUAPACsAB4AeALhBE8FPwBdAo4ARwOvASkEGQIcAuYDTwX3AW0DeQA3ArEA7gB4AuUDzwDeAwIAEAEwAOMDXQIJAxkC4AIsAJ8DdgAeAQoA8AE/AOEAVwCMAMMAMwKKACUE2QF0BAoAQgJaAIACUgB4AuUDJQQeAJYCAgAHBPEAGAH8ANkBIQDqAeUDOwQ8AGMBrABjAVoB8gEwAFEBsADhADsAkAAhAP0DrwBeAZAA0QICACsERQCxAEwCHgMBAEwCOwCIAtcAUgJ6AuoCzwCaAhMA1wAHAhwDtgAJA2IBKAKqAj0DuwXeBWQAwwF/AEcBrAAXAmAB6AJKAGIAAwA0ApYAUgHuAFIC3gBMAmQB/wGkAsUCQwAzAZAABwIrACACBAKtAxsA9ACvASUEGwEEA/AEEgZLAHoCEQBFA/8BRQNjAa8BIQDqAy8BpgEhAB4DrQCaAtcA6gKQAA0BNgDwAMgD3wNlAW4DwwBFA18AnQC8ANkBoQJsA3AB8QGVAOoDwwAHA74AkAO4A48EMAM/BWQAlgA8AZADkAAoAjQAjQAYAUMD7AD+AsoBkgSvAQUDSwBfADAAvwECABEA2QE7BP8BKAI7AH0DUgARAwQA4ACPAKoAJQAtAM8AfAIbAgkDDQFwAd4ABgJSAK0AlgDFAiAAegEKAUECrQBdAuYBJAKxAA8CEABSAhkCZwMWAgMDrwAbAtUA1AIcASgCAQD3AXgC+gPaAGUBwwAsA8MAQwNzAHkAewKhAisAMgAbABcCIQB9ASEBpgE6AKIDlgAzApUDCAVeAVwE8QHUAikCygPTAhEDCQDiAegASwHUAaQD2gBBApUA/gLnBAkFWgBtA/QA3gP0APYAhQGqARMAsQLRAlsDKwADAjsA3wPYAW4EpgHEA20DsATTAtoCQwChAP0ArwEAAA8AlgI9AysAxwA9ATsECQEkAhYC5wMgA8QDogKsAq8BGwKxACgCIwGPAl4BdQNFA94DHQAmAN4FBwZFAI4A9ADRAj8AGwKqAPgCMAKKBDMBpgHsAOcCKQHFA8IA4wG0AaIDIQCaAggCNwKJAXUCZwCqADwApAKZAR8DQwDEA2UB6gMnAeEBQwOkAz0BwwHaAA8BQwJoAqQCdwSMAGQB9ABlAdgBXQNkAJIAwwTpBAkB5gIhAA8BZwAaA7EA1QGCAK8AkACFAaMA9AI/AA8BLQK6AjsAEAFaAHoCrwDFAmkBygMJBRAGmABDA0gARQLrAO0ArAAKAWQA/wBBApoCFwIJA2UBGwJeASwDZwAlBK0DigRhARkCIQC2ACsBfQMbANoCwgD3ADcEvgRnABcCDwBYAM8A2QGQAHoCdgCWAHAAegAeAAcD7AAzAsoA+wJVASUEqgHqATcB/wEPAHABlQOOBN4A9QIXAuoD0QKUBIIArAByAbUDVwDQAvYAwwMbAN0DwwCpAnkAFAHMANECcgF2ATwAawGxAGIBEAGLASwAjwECAF0D7QB8AUsAwgD8AOoCCgE7BEkA+QAeAFcA3wJtA9gByAMRAPgBzwBVAbkD5wRlAeUDUQFAA68BBwMHAjcC/wGNA+wARQMTAP8BJAJmAzwAuADxAEICkAXoBZkBXQJmAtECrwHIA5UAlgDRALICrQDfAtcABwLYAe8BrAADAvcBeAIKAAQBVQHZAeAClAMeAD0BYgT5BOoDBwQCAMMDEQCqAgQASQAbABsBSQAuBQ4AbgBIBLsE4wElAysBRQJMAtoCHAGtAwUDBwTvAd8DOwD6A7MC6gMPAEUAswJuAwIA1QARAKoBKACKAM4A4QIHAM8E5gHlA/YBDwNnAFIBJgMEBkQA1gBBA40DWgFDAjsC5AJ9AfAC3gAvAwAAUwHOAiYD2QElAiwALgAKACEBfwBHA8UCQwOWAB4DHgAyAHYA2QEKAHUDwwF0BFoAfAKVAKwCEwA+AZYCXQNaAQMDzAAeAw4CMwIxAAsBZwATBEEC9ALZAcgD3gDxAR4APAABAJ0AkADvABEAMgA9AW0DQQIRA6oA+AErAWIBcAH/ATMAEgEKAMUD5gE7BNoA3wJkAK8BlgJmAywAKQEgACYBDwFDA8wAlgIRAOcA9ABuA+oB0QIUATwBpQBBAbAATQIhAG4DFAFBA00AZQOaAgkDOwR3BGkBZwIeAHUCWgDqA9EC7wJBAtoCZQF9AQIA+gMzANECiAElA8oA4wEoAkUC3wJuAwEAaQBnAIMAYAQABZ4AHgFLANkBlgB6AjwCuwQUAf8BEQBIAeMBGQKoAPAAoQKtA4MAQQJDAGcCEABpAagEFQWcBAgFPwDaAGcAKgERAEgA6gKNAxsBKwSQAOMBCQFVAa8BmgL2AD4BWgE1A/YA9QJaAE8CpAAMARsA+AIsAFMD/gEoAhAAcAGQAPgBMwD4AdECwwMSAcMBYgEPAhUFIwW8At0CEgH3AUsA/wDZAdoCAgBJAQgAlwCiA4oEjgAoApYC7wIXAngCzABMAhsB1ALGATsEWgDPAKoAcAE/AMMBKwHCA4MAlQIwACsBrwCvAQ8AHAKlBfoF5gElAsoAiAF9AYsB6gIcA54AxQPoBMsFCgBBAosBXQIdAFEBDwAOARAANQAzAkECPAIvBCwAdQG7BE8FCADZAcwAZAEPAD0D2QHRArAAAwI3AZYCBwLCA/0ACQERAOYC3QMaBGcA/QAbAKoAiwCVAyEAggBnAPoBMwAkAgIAlAReAVoCWgIaBBEABwTCAGYBzADXAPwAyAOWAsMDCgDtA+0AnAEQAA4B0wIDBM8EDQYDBBcF2gD0ANACHgMKAQ8BEQD9ABsAAwR4BM8EiwF8Aj8A5gE/APYArQDOAP8ATAKSAVwCkADKAFcAPgGeAAQBCACkAM4A4gFMAPgBvADeAz0BbgOWAKoAJQB6Af8A6gFBAnYDOwCVAGIBNAJSAKMAGwDmAo8BkwNdAL4AYgFpAQgAUwCvACUEHAHxAUcA9wGSAKwAqgB8Aq8ACQP0ANMCzgCsAnkA4wFlAdQBQQIaA10BGgYQAA8CzwBfAxcCdQLMAEUD9ADqA7AAeAK8AFoBjwC8AA4CIgMjAZoBfQHTAkAAAwM8ANACrADmAdIELgWsAN4DMwBfANUAlgL2ANMBQwDMA94A5gEgA4YEVwDDA38A6ACdAMMBlQAjAgoAkQDsAGoClgBjAT0BVQGiAy4FcQCWABsAsAT1At8D+gEXAq0AlwH7AkADvgBcAswA2AEyAWwBlgBFA18AqgAeAN4DKwCvAPkAjQPMAzIEEACOACsAfQEPAGwDGAFIA94AKgR8ATkCZQGpApUC3QOxAmsDZAD0AJ0ATALqAeYCGwCYAFcAcwArAMYBIAWPBREAAwS2AH0BVgB6ALAA8AIBAG0B/wHTA6oACQMPAMIA0gQxBdUArwEbAKkCiwA3AhEA8wGvAdoCdQLqAwEA/QC4ABcCOwD1AjsA/AAKAI4B/QDeAx4AEgYBANkBPgHRAloA9AAsAIEDQwA0AjsAZgIhAIsBHAHWAvcAKAKkAvQCpAJ1A8wA9gA3Ae8BrwAjAjwBtQOIAT0DrALlAxkCMgKsANoCGwF6At4AQwKWANgBAABsA3YDJQRHAMMAsQKNAzwA2AErAQcCEgEbAosB/wF8At8D/wEHBJMC9QNpBZAFWgFMAkECGgSWAsID4QIgA7gB2AHYAXUCZQHmAswABQM7AKcBMwLlA8MBJAJnASoDxwD3AYgBUwOjASkCsQIrBJ4AZwJBAloCWABpAN0CjQPaAK8B9gBuBFoAeAJ8ArMCwwAeA00AqQH2APwAPwDGAVUB5gFkAZYCgwCJALsApALUAUECKAJDAswAFAE3BF0FVwBbA5UAOwRpAmUEMwJuAwkF9wU8AJoCpALlA5IASAEHAu0CcAHVAeoByANaAAcE4QBdAhsBGwJlAR4DGwGPBHgC6gMbAIMAqgEkAqwAEgG4AIsBfgCuAD8FpQWeAA8COAFnAlcAkADeAPsB9ABtA0kBYgGqAFIBHgDQAjACrQONAM8APwBFA5UA0QKSBKUFzgAqA1wCtgMzAEMC/wFbA6wA2QHUAX4CrAAzAjcB7wI3AnEElQDfAnoCbQNLAFcAUwASBqIDngTHAJoCJAJ6AjADkgRlAXcESwArASEAswKVABsCDQEoAlYAvgBMAuUDMgLgAjAAQQPPABIBrADdA2UBWgJnABsB5gEeA6ICGgP0AN8DygALBKwAqQKEAvUD2QHlA8oAkwI9AUUDAgBwAQoAIwI8AZkClQB4AjQAyQA3AbECpgF+A3oCXQPZAd8C3gA3AfIECQXTAt4DwgBwAf0AVQHKADwClQNXBXMAFAGqAPQA3QEEAkQAugGWACUEcwKiAhsC6gMbAFIB3gC2A5IAbQPZAUMCDgDMAXoAGAGhAzUFewDZAQIAJQMjAhEDCgAgAxsC0wIgAH0AwwCiAtgB2QHxAQcE5gHnAnkAEAFLAOoCmgEeBVcArAEsAPUDlAC+BGcAogKPBLoElQNXBPAAugIUAY0DEAAwAXAB+AFWABoEOwBJAW0DAwT0ADsE0gBDA6wARgOIAbEBMwDmATACZQQ8AAMCfACKAAsCjwIOAh4DygAcAnoC3gODAKQC3gDQAnYA3wJWAHsBngRXBZYALAMRAH0BjQNxBNMC8ALRAuoDWgKVAqQDXAT/AFoBygChAsoAcAMeAywDKAJrA9kA/wEvBE8FjQOQA0ECdwSVAqkC2QFtA8IA9QN5AKIDCQAaAg4BaAL3AOMB9AAPAXcADASWAAMEQwApAZAAqgJaABIGPwADBJUA0AK4AMMAKwCPBJUDRgUzAqwCFADCAAIAPQOZAXgC7gCIAXwCOwQ5ArwC6gJOBA4BsAMMA9sD+AEvBK0AIALZAYkD9gB1AjUCVQIHAsgDQwNMA/QA/wBJAD8FlgJrA98DGQXCAEED2AHvAvcAGQIzAAkBPwAJAcICFAXsAN8DEgGLAQEAxwARAPoBQwA4AZYA0AIqAXgCigDdA/EA4QJ6AisEVQF8AgwFBAYKAIMA7AAOAhsAKgF+AJ4AGwCVALEBqgJSAIwC/wHvAt0BRwOwARkC6gFDAkUAUwE7ADECZwBFAzMAjwAbAHEAAABJAgcCKAJjAWsBXgAJAV4ArwEZAkUCSQAIBcUCCQMxAHIBxQGSBJIAXwOvASQCBAL1Aw4AcABSAQkDCABaAdACRQPCAO4AZwAeA1IAxQKtANoA2gCiAjoAlQN2ACMCGwHvAVUBQQIJACEBogNXBA8BeALqAd8DjwHdAkMAngDYAW4DJgPNBVkA4gFeAXYDIADPBFcAKgSVAAkDiAGwAQsAoQDRAmsDrAD6A9IECQVaAJoCQAALAsMAXgHYAQkDEwBJAa0AyAC+ALwCiwGxAsMAegL3AUECCgAnBNkB7wIzAWIBCQP6A3YAqwFkACQC4QBNAl4A6gGOAZUCiwHfA2cA3QPRAt8DxABrAe4AKwHsANgBGwCSAJAAowJnAHoC1QCxAhUFNAXWAQ0FLAM7BNUA3gBtACUDzAAxAogBQQMbAPQCQQJcBLEC0AJVAUwCVwFMAoEETwUBAFoAKQBJAGUB2AEPAaICSQCtAwMAUwEzAJYC9gAJA4sB0wGpAt8C+gBZAWQEWgX2AKcBZwAgAl0CmgJxAD0BVwBwAV0C+AKsABEDgwC7AFIBeAKxATICLgBAA0cA0wJ4AjsEPQERA/oClQMRAN8CugKMBHwBJwQbANoDCQNuA60A0wKqAiUD3gDeAwoAxAR5APcAPADhADMAqgJCAgwDXQBzAGUBTAI8APYAigB2A2AA8gRFAA8ClgDLBN0BoQLRAioElQLFAnMAsQIQAnQCYwFBAqIABQH2AB4DWgLfAn0BIwITANgB+gMrBLYA0wLfA5QEogDMACAFGgbUARoEzAAkAggATAL8AAYCMgCSAAIA8wFVAdoCdgB3BF0CwQM9AcsEUwCQAHkA1wCvAJoCXgHFAgEE8gSjACoBrQBtA9YEPwX0ALMCDwE9AZUATALKAw0F7wGUBDcEHgUyAFoAdQMaBBEAKAKSBEYFPwC4ALoCIQOtAPAC2AHqAkgAPQOQAH0DSQHRAosAsQLQAvoDdQIJA5IAuABzAqQCDQEZAhsAuwCIAWwD8QErBMMB/QMhAPoD1QESAs4AIwLXANECOwSwBPEBNwJDAwgEWgB9AQoArAKQAHwCKAJsA5UDXwXMAPsBqgAJAUsACQFnAE8CHAB6AOoDjwRBArAEXQB6AEMAfwDPAKQC8gFoAmcAXwOwAbICeAKwBAEAUwB5AIgB9wHfAiEAGwIeAHEA1AGkAtMB+gMhAeECCgEsA9MCLAPVADcBDwC/AcoAvwFlAXYDRwE0ArECwgN5ANECZwAXBfIBQwLKATQFPQNbA/cBCQP0ADsDDwCQAMMBYQKlAeACAQDTAoIAUgFaANEC9gBmAnwCCQPwAgkDCgDSALMC5gIUAKECRwEyAjMA6gLYAeUDBwIxAlUBbQM8AI8ETALLBN4A9AD2AMgDHgBIAa8BgAJlAQ4CEgF9AVYAugIKABsAogNfBcMBeAJIAKoA6gIgBIEFjwU7ADkBYwLAAwsAUwE8APgBwgBsA0wCAwQOAuUDHQAoAroCxwM9AaQCdgCVAqYBhgT0AIsB6gGAAsoAngNZAAwCWQBaAlkAmAATADEC+AHBA4wABwICAHIA/AAFAXUCwQOdAP8A2AFMAkMAxQPDAeYCiwDCAEMAywPeAFwC9gAvAyEAYQJ/ALEB/wHUAoEBGgSsALAERwD/AHwCHgOzAm0DsQJmA88AlwFuA+oDZwB2A+YBRQMQAbECPQEjAhsAogIzAD0D1QDfA3wC5gIbAA8BowEzAwUD3wPZAf0DdQGgA0kA4wH2ANQC4QEDA3kAwgCYBF0F9wDVAUcBzANXAOACeALmAjsAjAA7AHABqgLgAr8BPQOSAAkDuAHUAXAB0QKvAQcEUgBXAQABCwEwAi4FHgNFAwkAgwDtALoCdgAlAiIAXQARAGYD2gLeAwQAlQMUAZAD2AGzAt4A+QBnANACBQHqAgIANwEhABIBNwKWAtIEawVjAV0CogM8BcwAQwIRACsA/wFOBHUC0QLQAI8BiwHvAXkAzAANAbEBiwElBAkBPQFBAvoDegB6AYsBBwIKAD0CCQBMA6wAAwQhAK0ADgAlAA8BOwT0ACkErwDSACoBQQLrAEMCKgHfAs8A2gMNASsBGwLwAjUCMwWSAMMBSwCkAA8ABAI3ApADfgMaBDUCOQI7AOoBJQPMAxsAmQFWAMsA2QGxAnkA0gQkAkMC/QA9AVYAfAGvAS8D6gGWAl4B3QPDAA4COwDZATMAuQGLARsCiwF4AgkAagARADwAMAA9A9oC5QPDAeoB9gBrA5ADTgR8ALkCHgAbAUECdQP0AHgCpgHDAi8FCQY9AxIErABSAWYEqAQeANgB2QEqBKoBQwILAYwDJQCJACEAWgGwAMMAIQD2AI8ACQHuAHABPACVAMIA+QBsA60DIAAEBosBmgLKANEAZwCwBGcAdgD/AWYDygArAXoCKQRdAWwBrwHxARIBswIKADwBHgFkBL8BrQNXAcMBYgESAgoAeALPAP0ArAKkA6wAHgP8AO8CxQDuAAgACQFRAXUBQwN3BNECZgMRACkEzwD0AFoA9gBfAP8ALADdAaMAbQOSAY8D7QDuAB0AoQKKAMMAlQMBBAkAwwIzAFgAfQHGAU8AfQArAUMCIwIaBGUBEwQrAPoBLgX6BTEFPwVnAF4B8wHgAtQBMwLqAmsDZwDLBGUBbQNkAP0ATADLAXYAbgGLAecCUwEgBfYA6gE8ANEC/wDeAwEAAwNIAPcAvgRpBXUC+AJhAUADcwKVAjwAZQHfAhMEAQBLAF0AfQC1BBAGNADPBBEAOwSPBL4FEwCiAL0FCwb/AV0D9ABBAq8AGgPTAjsECAARAKwA0AJaACsBHQDKABoC7QNaAPEBwwBdAg4CpAJlAbMCYQE9A5UAsgPYAdQCzwB9AY4AUwFfAP0AQgKhAkMCfQPPBDoFlAC6AvQAHgMzAkwClQJcBDADuQRTAFoAVgAYAjsAWwMIAMMBOAHVASwA8AAPAB0AIQEgA+MB8QHjAT0DlQI7BPcBTAK8AAwBlQB+AokD5QMdAPcArwEDAjMCdgNpAYoBKwFHA2oEEgasACwDfAIpBAoAmAA7AAQDKAKpA5YA+gMdAA0BNAWlBVoASAEdANUBCQCOAVUBrALSABoEIwEeBdQBrAKKAKwCWgBfAFIAWgJLAHkAPADqAYEBTAOMADECQwNuA2cAlwHTAdgBkgD0AAMC5gIeAbkCOQJcAjwAbgRLAAMDegBuAjwBNQJ6AtACOQK6AvEBZgMxAJIB7wDqAQQDBwQPAP4BxgHTAhkCTAQcAT0DrwAEBT8AegLZAQYCzwCVAo8AWgHeAN0CPACQAJUABANbAqIDVwCLAjMCeAIdAAQCsABjAZAAQANFAj0DEQCSAHwCBwPDASkEvgRdBXEA0wJiAWcCWgF2AbwA/QDjAeACBAHUAXwCAwTfAwcEmgIHA/cAvwGjACMCNQFsAUsAaAL/AAkBDwEjAlUB5gJaAJkBrwC7AIsBegIhAUICCQHmAeMBlgJ1ATwCDwCxAGsBogKVAMgDRwBnACsAhwAwAcoDAAEfAqYB4gNaALEBPwB1AnEAEgGxAfEBIQDQAgAAsAMUATECZQEsA4gB1QFXAN8D9wDxASEArALmAd8CtAGVA0EADQL5AOoCgwCwAOsA8ABlAcUCQwPdA3oATgIjAm0D7ADlA7AAlwFpBDQFsAAJA2YCKgQzAcQDcgGSAfEB0AIgACsAKAIlAxYA8AAhAKQCsQGpA/QAJAJnAeECjgArAQgAXwBVAYkDNwJDAsYBogI7AB4DBABBAaQC0wK5A/oFxwA2ARsATALMAOoBFAELApIAmgLXADcCOwBdA/gCbQOSBBUFjgEjAiEAlQDHAG0D1wBkARsAEQM5AnECOwA8AEMC6gKWAiUDUgHqAUwC/gIFAQgCdQFvA8MA9AI9AcYB4wP1A5AAiAHsANkBqAQ/BTcCfQMBAF8ADwEiA5UCTANHAbEBQQBdAUUAaQGIAU4EegAhA88ACQMQAQcCIwLTAlcAfALhAHUCpAIaAxsA+gGMANECdQLUAowA8QFsAcADigCsALMC3wJkAHYAiAHjAXoCswIeAPEBKwDPAN4A/gJAAwsE/QAKAXkA7gDDACsEuwA9AmcBQwMDAKMBFAFyAeoB3gMLArYDkACLARIBfAKvARkFwgDqAnsCxQOPATkCKAIcA/cAlgJnAPgCEQCAAh4AKQQJA20DRQLBA4kAsAB8AAQB2AF4AqwCdgMjAnUDBwKqAlwCvAKvAW4EOwBuBMUBWwI0AuACZwBGAxQAHQCsAEUDlgD6AYACCQNlA28DDQAFAWUEkgSdACQCrwBSAVMAkgCMANkApAJMA2cA6gFJAMoAIwG6AnkAZAGSBAkFogI8A9oAlQKLADECKgGkAuMBrQMKAdoC3wLeA1MAvABSAK8AtgDfAnoCsQKwABIBzwQMBUwCxwTZASkEpALqAxsAggCoBFcFWgCJAXoCBQNHAPQA4wDDAf8AAwMUAHsCMAMxBfwAcQQNAT0DRQPfAxsBfQE7AO0CGAEhAcwA7wIlBFwE/gIsA0sAfAI3AlICWgDDAZUAKwQlBBkFHQBHA8wABwI1ASQFFgIhBD0BswJxAMMAuwDcATAArQOtAEgBfgBHAdYE5wR2AEEC7gAUAZcBeAIYAWAC2QFmAhIB0wL6AV0CfAJmAwoB5gGsArAE4QIaBMoCkgSVAO8BeALdA20DywQhANoD6gEpBNkB6gJjARcCVgDOAOMB+gIZAigCSQEFA9gBrwOOADgBCQBZAJADtgN5AD0DAQB8AqwAXwP8AK8BQwBiAR4AUgDvAQUDIgN3BJ0AvACCAN8CLQCSAKQAfwGuArACwwAqAbEBdQLqAu0C9gDeAj8AlQKCALAA2QGPA5UARQOOBJIEBwDJABsAzgCPBM8EUgDZAaQCsARTAWcCEQD6A/YAZAEgAGoAEQDeAAcEKwTGAd8CBwBUAF0CzwStAzkEgwB4AiUA4QCQANQCcAGLARsAIAJ7AJ0A4QD6AYgB6gIrAAkBlQD1AnYBAwOsAJcBlgAHBHgCGgM/AOUDOgB5AK8ATAMqASACpgG5AgoAlAAYASEDNwBuANMB7wF2AEUBYgX6BdEC+gPOAEECPQC3ACMCdwTDAOEAHgFnAuEA6gMIBQkG1wCWAhwCPQOvAHUDfALLBEcBYgEAAZoB8wFFAosBqgLDAJcBrwHGAdUAGwHaAAMCGwCPBEgAdQEsAK0DGwFFApAAJQNJAIEDYwGiAvYAWwNdBQ0GTAG4ArsAugJxAM8A1QGNArEB8wFpAaYBDgFDAgcC0AKtA9IEdgARA5EAIQF2AIwDZQHaAjMATADxAcID/wEqAlYAIQEzAGYD0gQ0BYsBMwIfALACwwATBFUBbgOoBAkGrAIXBQIAMwCVAzwFzwDwAooAogKQANkBZwBPBAEA/wBwAbECCgF4AgMEOwQRAMMDNwUEBisAvgUJAdAC9gDZAXkA3gCeBDQFTAJ6AgIA4wGcAPAAQwBpAYsB8wGDAM4AKwF1AvcARQIKAa8BBAEgA68AcwIYAccDMwFsAyACQQIOABUApAMaBP0A/wAJAHgD1QAzAgkACATmAQkDjQBIAQMD8gMZAvUDcAFDAiMCdgPeAE4EMgA/AOEAKgHwA2UEAAB7AtoAxgFHABIBWgAXAiEBewL+AuUDGwDUAaoArADvAZYCVgBgApQAUAE3AfEBlQAHBKQCdgNlAZoCfALaAiQCNwKWAEMDlwHDASgAqAF1Ae4DGQDFAOcC3wOjAPACUwGzA1cAZgPDABkFoQM4Bc8ALAOYAOIBMgAzALsAQwNxAJIAvgAUAawAGgMHAgUD3gMDBB0AiAFcAH0AcgGPAkECTAKVAD0BAgDqAzwAQQLGAd0DCgFXAVIBiwGvAPQCewDPAHkAQwLfAncEqQLFAhsA3gNHAEUDMAALBOcEYgWWAAcDLAN3BB4AJwM7AJQEawHLAVUC3QIzAA0BUgEbAloAhQH0AKQCrwHnAiQCYQKVAqQDlQMxBRsATwJdAG4AjwE3ApYCIwQqAWUBlgAqAWUB5gE7ACoC3gDTA3UDdwRaALYAzwSTBdEC5wJFAuACIQEqA9kBywQEAigCowCsAs8AxAEbANgB4AI9AzUD/QOIAbMDBQAWAHIBOQLiARoCBQH1AioClgKLAY8EsQIqBH0ACwYhAIkDTAIRA48AfwF5AEED3gAeAx4AAwJJAQcCygIJBtkBZgPjAaoCdgDUAFUBYwEyAOgAEQAHAtYBKQLmAdACCgERA6UBigIqAXoB2wBBAfQA0AJDAtMDXgHfAnUDdgNJAMIA2gBDAyEAAwKxAGkBHgDLBI8A/QCpAQsEVwH3AZIA0wLGAXcEHgDzAcwAKgStAxIE2gG1A7ECRQNkAWsDPwAHA9kBKgL3ASACDgBdAK8A0wKsAhEDMACTA18AjwAxAuoCPAFSAkIC4QJVAd4DZwD0Ah4FXQXaALMCDwBmAawABAVLADcCjACWAo8EmATLA8wDIQDBA18AJAL8AGYCowBaAtQBeAIJAEMDHgD/ACkBUARyARYCtgDwAisA6gMiA3UDrAB/AioB5AH/AZAEzADnAuoCOQQZAqoC2AHTAgQCPQOvAf8BIQDFAn8ASwEZAKMBSQFbA8wA2QDZAfUC9wF8AmQAnQDGAW0DrQBGAj8A3gNhAH0AbAENBa0A4AAhAJUCkAAZAkgAqgECADcClQATBO8AsQFjAX0BfAB1A4sB0wK+AAsCPAD7ApIA/QA0BVcFVgDiAZYAxwAqA6IDJALqAuwACwEDBEEEwwC4ATMDpgR5ABwDlQD8AHsAVwHIAM8AngBpARsAJQQkAt4DwwBPBJYCKwQ/AKkCwwCwBBMB2QGpAgkDQAP1A4sB5gKWAu0CPQEJA5AAsQJVATsECQPBA9gBDgLxAUMCqgLRAoEBfgIwAKMCYgFjAhsBeAIeAPYAiAG/ASAAegBAAN0CfQH3AaoAgAKQAL8BKwBPAjsARQMRAAwBKwGlAaEAOgH2AH0DEQD9AzwAlgJAAK4CEwCEAQIAXQIhAPoBFAA5AAIAHANlANkAGwHgAu8BsQJMAqwCeAJPBDcCOQQrAK8B5gO7BLECHANwAbEBJQBrAUUDKwTaABcCgwCOASsBQAPDABoD0wLqAwIAQAP2AA4CsQJOBJ4AewIeAYwDkQAYAQEAewAzAt8C8gQJBgEACgH8AAUDzADsAKMAogLPABsC9QLIAxIBeAJnAIoACABSADICNALDARsCCgDxADAAqQEoAqECeQA5BEAA5wNVAcYBfALvAiwA4wPGAcUCDwEsA7ECQQOtABoCTALmAqwAiQPDAUECTAJ4AjwB7QMWAq4CkAAJARsAiQBdBYkFbgM7BLABMgIOAfIBQwBkBOoCyAOVA7kERAALBjsAfAKvAWYCYgHjAT8ALAOkAm4D1wA1AhMA1QAfACcBMABTA+EB3QK+BdQFrAAXBbYApALuAAQCRwBLAKoA/QBLAFoBFwKkAlcAQwKaAjsEEQB4AtACKwRlARED/wFxBHEArACkAiwDdQLQAlMA+AEdABIEfAB+A6gA0AAwALIC9gAQAcMBrAQ/APoDwwDQAkUA7gCwAGsBdQKqAkcAXgDmAUECFAFOBJYAdwQzAPEBswLaAgkAlQKwAEEChgWHBbEBsgJ+AhoEDwDjAeMBoQIEAVoCWgDYAVoAOQOwAbEBVQGzAisAbQNMAmEC4wD9APkF+gVHALwAygD3AB4DJQT6AZoCqASlBXsACgGOAGwDqgB6AigCfQMaAaIDrwDlA38AYgEbAbMCDQBmAPEBXQPZAQMEjgCcANEAsQF8AA4ClAA9AhEA1AJBANYBlgCiAq8A2gLDAOgDvgA8ARoCNwQrAAQGWQAjAjoAcwCRAIMCywXeBQIAHAHlA/oDPQEzAs8AWwHqAvUCjQD3AUcA3gPDAIACDwAPAhAAYgHPAKkCBQQbBQEAMgBAAN8AKgE8A+cCbgRSAG4BEQBTAAcCZgOiA7sFsACkAn8A4AIgBQ8GSwCxAqwC0wIeAS8BHABdAIkAegGDAZoB2QHnAjAAbwPfACQCGwB8Ah4BqwIBAFoBZwDOAAoA4AAPAK0DfALQAl8AkgAPAREDlQCVAnYAzwAhAKkCVQEJA6EC2wP2AGUBYgHMA2MBZQEAABkAlgCpAvEAxQNaANoDZQF+ArgAeAIqAxoEFAE5AiMCOwRiATIC1wBDAhMB6gF4BJgE8wC4AioBVQHqAlsD0wLaA9AAQwLYAd4DlwBXAQAABgGvAKkCwwEJA2cABAUJBWsFfgAgAyEABwPRAPUDHgAkAgoAeAP/ASoE9wEjAhsCQQJVAZUCawOtAw4AegG7AEwDwQJxA3ABfQNaAvACwwBGA5UA5gHnBCMFOwCqAjMAXgC4ANoAkgDDAGUBwwHQAuUDRQPIA3wAZAQjAkwC6gLvAisAOQPVAT0D9ADfAlIAZQF5AOACCQA8ATAC+gLOAAgE2AH1AuECogNMAucCWgIIBAgAaQAUAEcD2QHHBOoCRQOFAbEBSQD6AosA4wF5AGIB3gBdAzcCIAQhANoA2QAUAf8AaALXA48FiwAHAswA9QIrACoBCQHaAwkDXwNXAMgDcAGvAXkAigT2ADMCIAPFAyYCZQMEAKUAGwGJAfQAmgLMAHIBAwNPAysBuQEyAhgEfALqAmUB9wFIAW0DrwB3BKQCCAQ8AboCMwD2AKsABQEdACwAfAFCAgsCXAKVAiIDqgCzAvwA6gEfAGwAYACVAxsALANBAuoDAQCWAJ4AGAGKACwD5wIrBNkBwgJkAQcCcAGOAl8AegJYAEMCrALFAuYBrAKJAAQGWgHDARMBQwLVAPoDEQASBgwD8APsAIwDegLmAo0CsAMVBaUFfQGaApwEMQVDAlICJQEDA6ECogOtAM8EkgRfBb8BBAKtAy4F6gJmAwEAIQBYACsBkgQuBRQBdgHxADwBAQT6BboD4wPaACACqQJDA9UBDwLbAAgBrAD0AlcABAO7ACMBrgLnA6QCEwThAAMCigCVAooA0gDZAS8D1gEkBSAAsAD2AJQEPwDaAowAfQNIAcMBuABrARsCMwIbAAgEDgJ2A+ECTAMJAdEC7ADIAyEASAHCAOMDSQAJBREA5gEbADMCBwJBAw8ApQEPAIgBogIaBM8AxQK8AEwCZQEDAqID8ANIAIUBIQDaAq8AAwJYAG0AsQFpAkECiQNnAIkDZwGiA38AVAEJAIkA7wHxAcoAjwGLAUUDrACZAd4AZgM4AkICNQBpAQoBIwIEACoD5wQIBXEAwwEbASIEjwG5AQMEUwQ5ApADLACEAooApwLKAIQCjwEuBHYC8AW+ABgCfgBlBOoDKwQgAJgAQwKqAlgA6AHYAf4CigAYATAAbAPYAX0D5gLqAxUBZQP0AOUDEgH4AgoAfAFbA2sD6gEeA0kAXwXhAQsCLQC1Ac8ADAH9AOYB1QC4AcoB0gRaAOcAGwAaBIsAvwEMAfgCFwKPBFcA7QIrAEECPQEeAwkBAwJ9AW0DUwCqAGcBpgF2AMMAVgC7AOoBLwMJAFoCPwCYAAoAgQH/AKoBPQOtAzMCJQS4APoBHAGWAisAcQCKAEwDRABdAFoA+gNyAEkBigCLATADFQWWAF8DsQLfAygAxQOWApUEJQM9A68B9AJDApYCmgL4AisALQAeAI8ABgJcApUA3wFDAKEEjwFcAjQDcwRhAt4DVwCnAaoA8AQOAqICFAG8Am0DQQSOAMwDzADVAAkBeALHAAwBrACiAv8AZgMgALcAggAPATAAuQHhARYCPwDmAosBBAOdAFoBwgKIBEcAPQHqAecCQAAhBHkANwEzAIUBEQBbA1MAXwCtAMMBCAORBa8ARgMYATkCHgBDAj0BEwTPBCsFkABnA54CogK7AJYEfAKAAtMCwQM9AZoCagIeA5UDmQWwAH0BIQD/ABsCIwJDAmYDfQHDATAA3QGQACQCQwLRAqMAEQM3AEQAQANMBGMBAwJ/AL8EiwCNA14BJQS7ABoEwwD+Av8BTALKALABiQEXAkwCmgJYAF8ATAIJA+cERgV5AIgCEQAnA/QAKgSqAWYD2gHTA68BXQLDAcsEKALqAgoArQAAAasDaQWGBREACgGqAH0B/wGqAtgB3gIDAGkB4QLbA0wAkABMAsICrQCVApIATAICAD4BjQO2A7gA4QAPAmwDmwSeBK8BRQIRANoDGQJ1AgsBjAEzAN4AxgGVAsQDxQPeAzsEGwJtAywAPQNiAWwDPQEDBIMAdAEhAOUDAQDeA8oBZQSnAHoCTQSRBQ8AxQAEAGABtgDHANUBEgSSALMCqgLCA9oCHgPvAV0DcwD/AZ4AgQEwAEwEQwCZAwwFzQXmARkDuAD4AR4BLAMYAYEBwgDvACwAvQFpAJIAXAKCAx0ArQNSAN4DIALPBEsADAH5ALECeQCNAvwA2AEbAkYD6gFmA6wAjwQeA/oDHgDfAqYBbAPKAGcDcAEZArUDtgNXAdMCWgADAq8A3AHtADkC7AAFAQcC7wJkAX0DEQCPAEsA8gECAN4A9wGaAjYAhgGGBZAF+AFFAp4B+AIhASkBIQAjAmcAMgMPASoBOQJCAiQCsQKPAK8B2QEsA5kBBwQgA34DsADPAEwC0QKvAeoCCQRMBZAA9gA0AFQA/wDDAe4AEgKQABIBWgHCAkcBqgL9AxQF6gMTBBIBxgEeAP8BGQKWAnkAMAKYAM4AFAAEAq8BJwMgAFAB/wE5BFcA+gPKAGABiwHlA1QAXABdADUCiQC7AL0BogMeADsEEACwA8MA3QPqA/oDuwDOAA8BGgRJAMUB8QF8AjsAKwEFAd0C2AGUBEcAWgDDAQME5gGzAqwA+ALfAgMEwwHaApUAwAJkATcCRQA0AnoCqgL/ABQFQwJ6As8AIALRALABggCVAmIB7AHHAFcBZgS/BVYAOAIhANECDgJuBAEAjQDPAAMEZwB1A6QCbQMwArkDSQAwA5oCpALdA08EQQIDBF0BJAUHACsFcgBbA8QDoQSJAJgAKQCiAw8ARwMPAOACIANkBI8BbwPqAyUErAH1As4AdQOvAW4D9AD9AHABBwJnAcUDMAOcBDAD+gUDAhcCYwH0AlcE0gReAIIAMgEkBc8AswKPAbUDGQBFAOoDOwSOAEcBXQEgBX8A6AHCAlMEBAJTA+oBAwKkAjsEhQHqAeoBcQSvAG0DsQI5BFIBgAJ8AgUDCQUVBZUAgwN6AFUCfwAlA5IAxgHTAm4DpgHwA3YA5QMRAMwAdQIiBPoAXwLjAUADQwNcBMoAUwNFAl0CogNpBB4AaQBwAQUDlAAaAnUBBAL/AXwC3gCnAZQAaQU/AI8EVwDRAa8AlwEYAjkCVQERAw4BUgK+ALYDnQD9ABgBvgTjARwCjQCtANACyAOvAKQDAACeABgB8AERAAMCwwHCAsUC3wJMAgMDwwBfA5IAsACTBeAFJgHPBMQB+AIBAJIArQPwA68BlAQbAHcEMACJAgkBWgFBAnMCrALqA68BYQL/AZUE2QByAUcACgEwApYDrQDEAUYBGASlBQkGNAAmA/8BawMHA20DSwDtAFIAOwSCA7YDSwDqAUgAuQHsAHYDuACvAfwANwKbA8UDcAHqAXkAkABMAO4DggBlAdkBlgIuAHUB5wRXBREAXwA9A2sD9QNQBB8AQAANAaoClQDZAf8BJAIbAWUB+wEGAmkClQMIAAoBvgBVAtgBgwN/ADIC9wFaAikCJAWtACoBCgCkA0cAVQE8AK8AlQIRA+8BegLWASAFMwE0AlcAqgI9AeoBWgDeA4kBrwEeAEwFSwCWAh4A/QOWAIACrALdA8oAZgV/ADMBEwDeAFoAXwN1AgcE3gByAd8CHgOSBAgFkABFAjMAVwBIAycEAABjAu8C3wNlAfoDtgD0AFcAKwHmAeoDFAFkAXYAjwMPAW4DwgCwAXkATgQBABIBfQGZAUwC3wN5ACUDVAAmAQoAiQBJAI4EwwCyAwkFYgUIACEAIgBwAFIC3QLtADoD0QHqAuwBJQPPAFoCBANdAygC0QIdABkCHgMiAywA0ACLAX0DogOhBcMBLANBAhcF7gDCA7sA7QPqAeoCegJ9A1IA4gBDAgMDHgCdAH4CIgOPAMMBEAD9AmQB8QEjAjMCjwB6AtQBTAOiAwgFUgC2AD4AvgCVAuUD0wITBA8BHgE9A0cDEwB5ADwCoAMyAQ0FKwCLAUMDnQMHAlsDBgEPApgAGgJXAJUAsADaAEAA4QFjAG8DiwFMAkECpAMrAYUB0QIEAz4AugEBADMATAA8AuQE9ATPAEUDeAJ2AwoApgGJAYsBPgBhAJoC6gPZARQF7QBDAggAewAdAKEBDwAsAEkA8gRgAEQBBwAmAUYBMgLCANEA1QDTAfYAbgNDAgUDogOWBcYBQwNpAUcDOwAcA/QA9QLxARkClQB8At4AiwEVBQkGlQIsA14BDgLQAsMDHgFaBXgC2gKiAxUFkQLEAhAAFAE7AHoCMgIBA4sB2QGxAdQCiwCIAjwBKgOMAD4BSwDRAt4CBQN7AMICIwAoAIMAPQGDAYAEwgJ0BOwA9gD8AOcCegL6Aw0BJQMlACYBGwD6A/MAdQKSAHoCVgCiA/cArQPCAGEBwwAXBeECDAMoAjkE+ALxBSsBBAIDABUCZwBRBOEAGwLQAjsESwCNAiACNwSeAMMCuABFAuoDbgTmAS8DzQCaAbEBRQIzAh4DIQFsAxgBPQLDAHcETAPdA9cAfQOcAKgBrwF1AuoCLwM0Ag0FIQDeAMwAyAMKAW0DzACNA48ApABZAM4AuAEEA30AoAFTAI8ACQC0AfACEwQAAFICXQKzArECBwR8ApYCGwAXBbEC1AKMAZIB+QSPBVoAxgECAB4AcAEcAtUA5wI8AroDlgAbAbMC0wJBA04EMgJsAxoCYAJ4AiwDzABcAggA/QBSArECjwRdBVYA8AHPAMsE+wFcAoUB+AGBAYYErAB6Al0BwAM7AOoDWgCqAjwA5gLSAKQCigB1AzcC0wM7AkcCEwFVATMC5wIoAkcDZQEaAysBiAEYAF4AIgAtAEkAQQNaAqQD7AArBIMBvgSLATkD9wHmAhEA9wDjATACWgD6AR4AUgEJAMsApgHLAxEAGwIUA2UDNwBdANYBYwKmASIDfAAaBDwBewFHAFcB9gCzArsFCQZVAVoCiwHqAlgA8AC4ATMCKAKwA+YBAwLfAnYDZQFzAh4AwwNVASwD6gGxApIADAHKAKADowBjASgCwgN2AMMBHgDnAMMAFwI8AvUDrAIiA6MBRwIvBaUFzwBDAyEAkgDGAfACSACvAWUBTwJMAm4DqgIFAwsCvAIRAI4CegIvA+AAKgMbAloCPAAbAnQAsAD/AHoCMAI0BV8A+AKiAkwDVgDxANAE6AU3AdgBrAIeA8MABwRtA/oDMwLTAgYALgJBArMCpwJ2A5YCHAMRALYAQACIAJUD9gRLANUBZwB/AtQBJQSHALgAqgADAhQAUwNfALwABwJDAioBTQIwAGABrwHDA6wASAEHAAwF9QIeA1IAWwE/AAMCLgA8AooCZAOWAPQC1QFHA+wAHgGjANoAZQEaBD8AXwNwAVsDbAP1A0cAbQMcAuACEACtAz8AmQEyAswDPgLHAyEALAPeA+UDcgB5AJoCMgN9AQMCugO7BHwBjARmAkUDuwB4AigCZANHAFIAPQEDAvEBJQMbABoDPADUAlIA9wGWABMEfQF8Al4A9AB+ArkCdQL6A+oC3wMxAOwABgJMAhsApAOQADcCMQX6BZwBJwRIAcEDTQClAyQCRQNVAXcETAA0AQABjAEzAPgCjgBwAQMC6gMsAEAD8ACfA0cADAFJAGUEuAAbAdUB4wErAPsD2AElBHIBnwT3AbMCWgKsAq8BFwIJAVIBdQGBAyEArwASAeYCYwKUAwQCiQI/Bf0FMwAoAosF+gV2ACIDZwGVAmQAggDqAkEDtgA9AXwAgQHfAuUDvADDAXwCEwQhACkEEADCAFIAqwGVANMC4AJbA3oAlAB6AsEDYgHxAU0A0AHYATEDkACAAhsAEwSvAU8CegC1A+cEMQXvAeoCFQKzA3YAVQHvAfUCjwFiAtcAXQP6AY8EGwDZARsAwQOZAQkDtgCzAiEBwwI+Af8BSQB7AQMACQKJAQMCsAEoAnUCfQN7AUICiwBbAi4FPwWvAfcBOwCLAlMA/QAQAI0C0ALnAo8BTgRyAJ8BHQDiAiUAFwGLASoCDQA7AFoA5gKSBLsFiwCtA0ECHgMJADgCOgUEBiMCsgO2AEEC8gEkAtsD8AOxAnEERgJ4AtIEFQXKAucEVgCzAYoAIgM8AQwDCQFIAXgCjwQ7AHUCWgF8AtQCBQPKAY4EfQGzAq4A9QOoBAkF0ALfA4kArQBfAGkAZwAHBNQBWgIaAkMDSAFMAQ8AeQB6ADwBiwDeAEwC/QPxAAwDdgBEARYC3QIqArEC5ASZBREAxwAYAscDLACjAhsAXwNLAGYD+AHmA7ABTATnAgUDRAFEAx4A5gGZAeoDcgDxAXkAlQM8AMMDIwLwAqwAdQMQAfEBoQKfA84AogOvAf4CewADA74F8QX9AN8CNwEFAwQA5wR5APkAXQENBfcAfQNTAQ0FeQChApAAPAIKAUUDEwAEA6wABwSIATkE1ADkARAB/wEgA0wDVwX6BdECyAM3AeoCawN9Ax0AUwPxAa0DwgCxAv8BHAPYARkF4gJKA34ClQLxAYoCcgAcAfcB+AKWAE8C9ADnAusAOgP+At4DjwDZASID5QMJAZcBlwH3AQ8BiQOVAnYDPADoAzIBUwEoAC8B/wHtAjkC7QPVAAQD4ALMAxwAPQC4AAMCJQAqAeoBBwKVAOYCiwDSBBsARgIJAEQAKQFHA0sAPQOWAHYDawEXAjAAsAFZAKsBCQM7BCsAlwFLAF4AuwB8AbQAXwI/ACUEMwJ1A3UBGQKqACsBNAUJBisB/gGSAMgAAQDqAYIAxgHoAMwDZASGBLYAmgK4AF8DrAD9ANkBBQMwAE0AVwBMArYAZQH5AEEDzABhAlICXAJ9Ad0D2QE1A2ABqQGLAe8CuwB6AawAUQRaAAMEUgAJATwATwKVANQBmABaAj4BlgJTAF4AjACgAX0DrQPMAxgEfAL+AqwAywQzAQ0FlgBaAoAEnwRaAOACeQBwAa8ACQFwASAEIQHbAxsBFwI/AGMBIQAHBLgAYwFJAWsDZwCAAhEAZQEDADABwgIDBPcBRgJKA6ID5gF6AjcEaQVJAcIDpwHvAsMAdQNwAeACkgD6AVoBJAL3AFsD8gRrBfMBPQOVACID2QEHA0cBKAJfAOoBIAKVAmAAPwX2AEUCAQBYAO4AygMSAfgBVwAqArEC0wMpAJUDwwEjAhsB/wEJA0UD7wIrBNEBlgLeACUClgDaA+oCKwTsAOYBuAGnAloAawHYASMEewA9AcMBQQQrAfMBJQDPBNUA/ADhABIBnAQHBokAKgG5AeoBdQHjATcBZAE9AXYDZQHdA3EArwGNAOcAHQBsA84AxQJVASUCpALmAqoAmgI/AKMAcAF6ApYC+gPCAN4AVwHZAVoA4QCxARwCgwGPBCwAOQCLAE4ESQChAt4AOQT0AAoBDwElBH4A6QFlBNIEjwK8AsIALgTKAa0DkADzAeIARAH6AJoBrwH4AhkCsgIoAqoC7AD0AKMAsABxANoCKAAeARIB2QEJAUMCQQLeA3sA8gNJAX0DKwCJAM8AEwSEAqECKQH1AzwCPQPgAn0DDAFXASADkQNTAFgAawWlBUcB4AJjAQkDRwCSAIkAkAU5AlICjABrA38AygMEBg0GcgFxAt8CEQMAAEcBjQAJAX4AtAEhAPACZgMqBAkAYAI6AMoBuQM0BewAIgMEAaQC1ALDA9wBTAMyALMCUgCkAvoBswJDAnwCKwBSAR4BhgR/AI4A8QHBAwAAywPYARsC6gH/AeYCDQO2AHwC+gMZBY4BGgQcAigCVQF2A44A4AKUAHoBpgEaBN4AjwGaAYAEsAC4AIsAQQPjA+4DMwNsBaoA7wAFA0UDXgCqADQCywNaAI8EiwFBApwB5AN1AaECwwGkAmYCBQOVA4oExQHKARsAxAHVAPEB1wNiBFcAhwFYAJ8AiQDhAHoCBwRzAEkBPwBGApAFBAbqAl0DMwGKAdMC/QMlAE0CQwI9A3EArAI9AcICKQGhArsAxAQqAQMCZwB3BDsAwgDPABEDGwAEBQoAXAQrAdECgQHZAtACJQTvAf8BqgDmAn0B6ANwAeoCxQNkBFUB6gMFATcCeAQEBlUBHgN+AF8EggARA68BxwTvAIUBNwLdAgoA3AF4AvQCogL0AkEAoQAoAhIEQQLmAg0CGgavAUEEEgFMAggAQwIhABcFigDwAnwCwQPhAMYBJAK2A/sDEAXHAOcAqgBnA9cAHAOWAt8DVwQJBs4APQIbAV0DwgBDAuoC2QQeAG0BxgH6AT0DfQOVAxAGNQAOAWYC5wLqA5QErwHUAgAACQJHAOYBOQJVAnwCyANeAMMBMwAHAogBQgLDAYACrACyA0sAsANjAG4A7wJFA5AAqQM8AFcArAD2AKMArwEJARsCCgC0AT8AsgMzAzUFIQH1A4ACswKSBFcFVwDCA4MAwwARAFUBuADPBC4FmQWsAlwE1wDxATMCpAIRALwA4QGNA4MAlgDFA18EMABhAdgBWwOdAAkB+gKtA7ECIAQJAfgCLwBjAOoBCQPJAWECVwT6BXYAOwQsA24D7gPhBCoANwCjAMYBPgGLAZ4A8QCVA9cEjQCSAD0BYQJYAKcA5gHmAswArwGtABsCDwB/ASEAvACOADICKQEgAzADCQaVAG4DTQIEBsICOwS5BNIEigAjAlIC6gK4AE8CKgLqApYAXQKMADkEKwH/ARkCJQMDAqQCewEEAk8CXQLqAdAC0gRfBUABLAKFAaoCwgASBB0AKwEyAEcAMwAOATMA1wIjAuADBQN9A1ICOgPsAOsCBwB9AAEAUgAEAaQDewBaAYQDNAWZAdgBHgA2Aq8BsQLVAWwD0wHeAqIDnwXrAGkBygKlBT0B8AICAI8EDQH4AZYCRQN1AsMDCQGLAQoBfAJpASADzwDmAgMCswJFA8cEUQWABYQCUAQKAJoEsAGhAsMAiQGJAFECOwDTAQcCZgKDASEDCQGWAmcA9gDaAOEAagIsAxUBbATCACUD2QEHBJUABQPxARwDaQAMAQ0BhQFiAcsD/wHQAqwCGgSKACADrwEqAtsA4ADhAu0DNQCkANgBZgK5A18FrAB1AjwAJQQzAowDwwHaA0wA5gN5AAUDVQEDAqMBygMbAgQDUwDqAawA6gEjArAEmgJuAzMAJQO6AkgDPwCwBK8BBAOLAWcDiwFPArkF8QXmAW4DrwEDBGkE8gQRADkD7gB/AaYBDwIFADYAHQAzAWcATQLeACAEggDqAQQBTANtA24D+AE8Aq8AswL9AOoBNQVsBbMCOwRSAHcEyQFMAh4AlwBHAOYCeQAgBA4CwAKJAV0CEAHQAjADygQ0AAQGqgBPApYAbgShAKYBvgA1At8AFgIeAKQAiwD/AXwAngBxAK8AMAOiA98CsATmAiUENwE3Al4AXwA+ATECogIlBAcCOQQ3AqoCwgDCA9oCEQPaAgME6gEFAz4AtwAEALMBrAJtA0UC0QJSAEMDZAA9AY4AewL4AeEEuQE9A7kFAgYAAKMBPADzAREAJALYAV0C9gC4AbkDPwWwAFIBCQFlAUkANAUsA0UDcgEDA7AAxwArAHoBXQInA/wA0QJYAJwAKwCkAnoAGgK7AL4EFAG2AwAANQHqAQcDrQBjAR4AfQEDBEwFYQJ3A7MC+AKqAF0CwQMSBiIAJgFHAcsDHgAHBLICQAMlAAQG3gAIAh4ArQBTABQFZQGwBPEAIQFLAK8BIQGIAZUAswCiAFgCQwC0AkkAVgA8AOUDTAKsBN8AAwN8AgcEGwC6BGoAgwBHAHoCkADeAFoAEQG5AUADHAHAAUgBNgIiAywD1wAoAlcBAwOPAN4DsAFAAykACAXnBC4FsQLtAj8AigDKAK0DCQHxAdACfQO6AicEqgDeAzQCRwPrBf0F/wEvAzkCtgPYAeoBjwB8Ag0B1QEVADoCqgCwAP0AwgJpAqEC/AAIAg8AQwAzAFMAIQBSAZQDygMJAf0DrwHBA3UD5QMjAZ8ErwHLBK8BMwJJAHIAjQWQBd4AAwMzAIsBCgF3BK8AFwIRA20DZgLqAgEArwHtAA8C9ABjAUUAZwIqAHIACQDEBBsAdgMEAV4BrQAFAjMFcwXDAeUDiwDKAAoAYAIyAM8AkgTXBB4AIgRxAAMEiwFbAygAkQPvAi8DKwAmA2QAwwCWAuoDzABxBLkF+AUJAeoDXgCPALAAKgHkBAgFHgA7AD8ARwDPANoAggBMArwACgHIAG0DCABMBRsB0wJYAA4BqgD/AI8C3QIdAJ4D+gCcAaoBlgJwAfgC4wNPBSAArQACAPsC+ALbBEcAUwAqAUMDrQC4APcAuQGDAV0FwgCfA8cAXQIHAioCWABHA5UApANwAaoCEQBtAf0ADAEBAJAAlQCvANQCfQPQAgUD7ACHAa0AOwQ3AmYCHQG7AyAALQDWAwUEoQBkBHUCWwOYACoB7wFrA30BlQIgBYEFVwWjBTcC7wJIAIsBrQCsAvQEmQVdAGEAKgPtAz0DgQMyAjIElgOtA8MBxwR1AroEmwOiAwoAdwSiAD4BIQHiAw0B8wGIAUADSQC5BNMB3wMDAEkBigBuA3AB4wE7ANcAPABFAu4DuwQ8AY0DLQDlAAUB+wETAAIBGwLlA0MCKgQZAmkCeQCKAZgAZQGIAX0DsQLIA8MBAwPvAdQCfAKaAloAZQEhABsByAMHBGMB8AJyAKIDVQHwAjAAkACzAsEDDQCiALYAIwLVAbADFACIAaQCRgMeAIYAMgFiAR4AQQSWAEgB+AIDBAoAKgEeAPoBMADjAZgA9wFQBFkE3gA+AWEAvgCPAXEEqwEjAmwDzgSvAbID1QEyAqoBRQIbAAcEaQKiAyACxQJ1AUoDUwOtA44AsQE3AmsDNQJSAqwAugQ0AiUDLwPfA9UADgMKAFkAlQIJA9kBswJDAEUBoAPjA0kAsQJxAt0CMwL+Ak8CswIKAJ4EGwBIAYcB/wEhADMAegC8AsMB5gF4AhcFBAMeA2UB6AM7AEwCywULBnoBBAavAGsB5QMZBecCHgMBAI8AwgBRAeoBDQOJAUUC/wATAdACbgQRAFIBYwTxBSoBYwEMAX8BTAOkAyACeALGAeoDFgCGAccATAFXBOcE8ARMBQkAmABSAW4EOwAqBAoAPgKhAFMBcQCsBLgA6gPMAAQDEAF9AzwCZwMeAXcEfAIvA18DbQPaAVwCHgA5A60ABAb4AXUCfgJcBN4A7QLWARUCsgLcArMCXwNhAb8BAgBnAwcCjQOJAQkD4QJ4A0cB3QFMAfcB2QE3AqwByAPNACMBdgDTAgkBHgNTAcoD0ADrABEAQQQyAPoBrADUAT8AHgPGAZoCoQKyAucCRQOLAaQCzwT4BfQAXwN8AUgDUgHGAUUC+AKVAvACdQKaAqoA2gAQAEkBRQM7BI0AwwH/ASsEVwAcAQkB2AEZAAMDxQIaBFoAlwHFATACKwD4AbgAfQERAH8BYgGWAmAAogN7AQwD8AJtAyEAMwLmAdoCNADHAHABuQE3AgUDPwCSAGQA0wJMA5oE6gFFA1IAzgBuAyUEzADTA9cA7gAhABED2QHyAZcENQW4APMBSQHgAiEAwgIhAcUDiwDqAlIAZAA0ADYBKABkBCMC5QMeABQFMwBkAJIA+AKvADsE+gE7BBEAeQCxAtkEawW7BZwB7QM4AqIDjwQNBvcF+gVLAMMB3gP6A6MAfQFXAOoBOAFpAWIBDQUaAiED9AAzAlUBjANJATECHgB9AzsA9AAKAWUBxgGwBF0C6gOxADgBqgJ9AxoCCARIAEAD5AGVAuYBeAI8APQAOwA9A8sAKgPVAO8CrAIlBD0B9AIHAIIElgAXAtUBlgKHBcsFEgFdAmcBdQMQANcAEgFPApUCsAT3APMBAQA1AI0CJQMKAL4EWAHmAQMCEQP2AOYCEADrANgBRQIwAHAD8QAgA9ACCQPMAP4CFACOALgAjwSmAeECHgEgA+EAfQFSAG0DFADdAY0DowMJAJ4EIQCqAI8AcAHDAG4ECQMlBEADBgTVAMMDRwCdAIsB3wFnALIDcwWQBRsA6AOzA78DrAB3BAEApAA9ARcFKwFbA6wA2gN5AAwD9AAlBO4AQwL8AGQBoQLwA84AogI0Ar8EWgCtAHwBXwK0AcUDowBlAWUBuAEZAm8EkgDCAuYCbQNwAUUCXwCQAK8B9QJPAgkDrwBuAzwBUwJ6AFABrQD6AUkAiAFzBQcGEAEqAioBqQIwAIQCiQHoA5UAagIKAf0DCQB7ATMAKgTeAO8BKwCZAUECIgM0AEsB9AAbASQC3QIzADcChQANAgoAogJ1AYQCWgBxAAIAwQODATcEIQDLBPIBAwMEAoQCfQEZBfcB3gMrAEwAzAA3AdQBDgJLAPEBNwQEBrYAwwFgAOcEIQAFA5gAeAJIAHUCPwD9ADsANAQHAuACMwB9A2QANQNBAZABrwETBMIAqgG5AnUDRwCsAM8ATwFXAOcCCQFfA0gB2gOvAe8BbQDdAWUB0AK4AaQCTwLqA5kDZAQ9AeoDCgB8AEECsgOJAWcDrQAIBOEAUgG+AI8BtAHhAhkCngOYBM8ESABnA5IAEgGqAQ0D8QDbAzIBYwKNAFcB9wHwAgIAMgJeARsC8QDtA78DMgQSAcQBVgCLAMoAuQGLABQBEABoAqwCCQMeA94DzAAHBCEAGQUwA/IElQBuBNUBHAKmAaECuAHqA3sALAP0AMYBwwLFA+0DJwSCAHgCCQNDAyEAEwQ9A+4DLAEfA64AbAOYBPgFQQOQAzEACwK7AG4CzgB3BA8AQwIcAbEC3wORBdoA8ALhAKQCrQCPBHsA5wNHAI8AcwA3ASwAvwExAo0DPQEkAkcAJAJDAOwBrQDhAOYDgQQbADIDlABMA/YAgwOxAi8DuAElBKcBsQKHAf4CQANHBLwAVwHuADABSQC5AwgAzwDZAeYCcwW9BcADIAUbAH8CiwCzAX0B2AHYATsEYgF/AdkBQQRyANIEcQK8AzsA0QFXAIQBJQPCA34A4gOpAdABWgDwBAkBBwO8AAkBfABMA6QCEQO2AEwCgALmAjMA/QD3AA0BdAF4AlgA6wCtANoDowDlAz8AEQO4AG0DBQNdAyAAGgLqAS0D+AJJBc8A4wCzAtECXQN9AxwAtwCJAK8AuwBBAhsA/QA+AicEBQMeA9UBrQPgAOIBZQFcBDICJQM9AXUDQwAtBVoAGwKtAKkCMAGmBIIA5gETAHMAEwEkAn4AbwJSAIIAHgBmA0ECfAKsACACMAAcAnEAAwIuANAB/wHCA+YCOwRSAdMCiwB7AQgA/QOCAN4DugLJApgAIAJeAGQA6gGqAj8AEwSvALUB3wIaBMwAfALiAKwCnATeBcMAxwSqAuoCfgCbAyEBewEzADwA9gDmAdgB3wJwAcIDdgBqAuACHAP6AjADzwBPAkMCHAMVBbsFmgEhA54ATAPHACACbAE0AkAAJwGvAfgBPAE+AloCLAOMA3UFzwBGAtUAKwRnANoDrgApAXkAqgJYAO8AEQCeAa8AEQOMAyUEeQCzA60AJgPOA+QE8QExAtEB2AEqABwB5wKJAysAMwA1AOsAkQB7AqYBZwIUALEB7APDBHIB2gGLAd4CNQKtAxEAWgEhAAQDCQQUBe4DLwSIAOoBkgCsBGcAGQV+AnUDjgBJAvYANwLqAeoDVwD1Aj8A1AGCAEECDwCxAcoB8gQ8APQCoQJMBKACagMJAQMEEQCMBfwAtgM4AVMBAAASAsMAywSlAfEBPwBxALoCtQOeBKgECQDtA68APAMFARQBGAFaAmYC7wKeAIYEdgDCAgoB9wGVAn4DrQOzAxsARwBtA+oDMABmAecE+QUUACEBBADnAbABbAM1AqsFwwD6AVoBFAWjAHYDiwCcBKkBZQMcAvUDLAASBEUCOQNkAFUBSwD+AR8AEwEJAX0B7wA8AoIACQGSAQsCsAIhBIsAoQJWADUCmQEXAjwAOQN1AjkDvgBOAjAAngN9AcUCUwOBAxQBXAIvAEYAQADZAWMB+AIUAQcC4wMGBGwD4gORABoE/QDTAu0C7wJ6AgQDNwA6AloCbQMqAnwCTAKzAoIAPQHZAiADIQD4AisAugSVAOoB1gKtAwkD5QOsAvACoQAiA84AoAQXAm4DNwJFA+YBOwMFA8gDiwE7BFoA1wKWAjkE9wDgAjMA8wEbAd8DCwEuAp0ANQOLAMUBGAEgA+wATALfAAsCGwDQAiUEOwQdAOMBIQDMAIsAMALqASoEegLfA9AC6gLbADYBCAU/BQMEjAVIAOMDfACGBA8ANQD5BQkGZAATAQAA7QAdADAAwwJ1A8UBNAWLAB0D2QHyA0gAwgBeAfAC2gL0AtkBQQIbABAD8AI7BFoApQGjAE0B2AGaAvwA7QIkAtMDowDPANMBBQOWABoDQQOBA1cA/ABVARsCDgLaAiEDHgWqAG0DKwFmA9oAmgKhAsUD6AX7BXoAvgTOAJ4EQwKNAowCQwP9ABQF5gHTAgIA6gETAaoBQANnAykACQbFAxoE6gIHBDMFoQUJAcsEHgDaAhEAywQrAWwDeQA+AWAAtQB7AI8AsABdAtIEuwU1AWkB2QEtA8MA5wKwAfUDrQQjBR0AvwGPAP8A9gBMAgkA8QDVAOwAewAMAaMAiQNnAaQClQDeAh4AWgFIAZoCAABJASoA/AG8AAMDVQHqAa8BZwO4AAkBCQCvACoAcwBdAQ0CMwDBA/EBZAOuABwCnAH+AzwAsQFLAH0DwwDaA9cAjQLKACgC3QE9A3kF/AUKAYkDiwGDA94AUgIbAd4CwwH/AcwAdgGKBC4FiAGBA0gBxAG4AMEDzADdAq8BdwMvA+UDrQM8BfIEygUWAnECWACxAScDbQMZAYAFOwBzAFoB8gOyAiUDBwIlA3oD9QTGAbMCMgFdAT0AmwA/AH8CAgBmAx0DMwWiA5kFKgCiA6wAxwCKAPYDKwGtAwcCRQLaAuYClgArBCsAGwIwAucEiwHtAtgBLwOdAAwBqAXNBcMBdwPPAMICFAVMBR4DbgQwAPcAlgBeAX8AZAM1AwkESABaADcAYQC5A6UFMgBPAdoAawHqAUUCVgF4AkcB8wFpATQC3QOaBFoA2gC6A08FmAWlBY8BCALEBfAFTwKaAq0D1wTuAEcD3wPqA6wAGQUbAVsDsQAEAo0CsQIwA5kFPwAgAuoCPQMyAPgCGwFuBGkBbANSANoCjwBDAhsCfAINALkElACPAg4AFwF8AfUBDgJBAtUBwgMKAEgDwAPKA2IEIAUHAioEmQGWAtUB/gGsACoBkgFqAowAUgIjAb4E2QAxAgsCTgJXAI0DygDuA10CEgZ5AFICBwIHBKcB2AH4AV0CQgKfAx4AXgAgAxoEKAIFA/8BIATeAGsDUwAMAUUCBwQ7AKwBOwD3AOoBswIrAd0B1QAHBLYACQE1AO0AqgEoAgMAfwDWBPoFegL4AkwALwRXAJQENQOIBHIAlgIpBMsEHgMHBPcBBwPCAJYCrwAzAt4D/QO4ABIGTALQAgkBxgEJAWECPQGpAtIEpQUyAAkBjAGCAzMBZQRnACsEWgHeA9YE6wUYAjUCQACwAigAngBiAaUBXQJtA5UA3gAJBbsFRAC3ANUBQwLhANMCVwD5ADcC7QKkAqkCRQFEA/gCCQM8AIAClQCHAaEAMwHbBRUGcwDVAG0DwQMbAHMC8wH4ARwAvgA9AYwDdgFSAu4ADgEHAmsDOwDeArYAbQMHACAAfAAYAZQAIQNXBD8FcQB4AhEAKgR9AU8EkgBSATMFRwWqAMMBIQBeADUAWgFVAo8CHgMTBB4AtgDuAGYBMAChASsBsQLqAZQEZwDCApYDogMhACsERQKPBOMBBAIpAYEBgwDhAFoA0AIFA8IDzABrA0AA8gM1Aw8FGgSeBOEAawEEAkoDOwBDAuEAZQEbAE0CwgDqAZUAiQNTAWIBSQAlA30BgAKUACcEIQM3BJUDlgMJAUEClADcAdECCQM0A08FrQA2AaMADwH4AngE2gLnAigCWwP9APcBUgC8AB4BDgJ8AF4BGwAHA2cBngSiA9sDtgDeAxMBfAJFAOACDwLKAw4AzgB4AnwCCQALAxgBmgQdABwCKwEFAysBYQFXANkACAQaBJUApwL1AwsEMgD3ARcCQQL8ACoC2gDmAnkA9gBXAC8DdQFMBKMAjgGsAeoCGgIqAywAQgI3AacBCwAPAJwBSAOtA9sDAQBtAwAADAMbAB4D2QH3AQoBbgOLAGQBUgDHAKoAPQOkArMCXQCgATwAKwTsAPsBkADeA88AsAQEAPoF7wHWAt8C6gM3ASgCBQGxAjAAKAKDAAMCtgDGAX8C8AJXABABIQBkANYBjwU4AQ8CLgBTA84AxgHeABABXwDZAUAAnQDiAA8B3wJFAwMAlAMQAHkA2wUSBikBxAMLAp8EDgF6AiEAXwPjAUwEMwITBO4AsAOVA/kFWgDHAAoA3QPlA+oDIQNdBVEBGQLqAioE9wBiATMBZwIyAHoC6gE7A5YCyAOSAHwCkAC8AIoA3wJJADUC3wPHBOYB3gPhAPACugS+BSoBIwJqASwDfgJ+A5YFmQUzAI0DMAJpAgIAiQH6AW4D6QAYBE0EnAQBAEwFwgANAbEB+wJ1AZ4D+QA6AqMACgHQAN0CPAAOArYArwHfAuYCIABuAkcAkACrAiwDXgCQAPEB1wKpAvACEgHmAcIA/wHnAM8EMwD3AJMBpgHVAP4CsQASAhEA6gLmAW0DGQBLAJ0A3wBDAjkEKAI3AjUDAwRMAhMEKwCAAhEAZgLPBO0EVgCUAIgBlgKJAbMC2gCJA44A1QIrAKICNADoAGcASAHVANkBuwA3BCEAjwDeAGECqQKsAm0DFwVnAA4COAFsAz8AwQMzAIACswKPBBsAUQQsAGwDeQBsA+MBRwMoAtQCMgC4AEwCBwNSAG4DPACiAjQDqwSVAMwAEQBPAjIAzwQrAeoCMAEPAiwDFwU8AD0BOwCLAO0AZgExAtECPQNmBdoCOwTqAdMCEwCMAAoAugIbAIAC7wErBDwAtgCvAAgEtgBVAf8B3gO8AK8BfAEtAp4AZASSBJkFwwBGAq4AAQMWAqsDBQP6Aw4ANgEdAN0BwwApBK8BEQMzAWQEUQEBArMAMwIrALUBPwWZBfcBEQNVAeUDzwQwBVsAXQCQAP8APAD4AjcBPgFDA3UDfgA0An8AqAO+AHECRQBHAeEAjwQJA48EHgArAVEBPQN+ACkBKQBXAnEAbQNDAF8EggB8ApECgQNEAH0AewE4AuoBZgLmASsEwgL9A6IDZgQzApUCfAIUBQAAOAEgAm0DcQBIAQQBIQFLAFoAlgCdAHwArwB7AZUDpgF7AqwATwJEAaIDwgBxBM8A/QOiAqQDzwAPAe8A+AFYAHABZAHvAoMAYwEjASEDEQArBDEAHwLEAQkD5gHIA7AB4wFSAJcBegIJA1YAZwE9A2wDMwLfA6AD7gPgAkcD9gAlBBwBMAJpBKgEAAU/BXgEkwWJAJQAuwCiApYARgLxBBMGoQAAARABWwNTAcwDSwAUATMApwACAEkAbANMBEkBrQN3ApYCiAGNAxwCngPnBJkFSwCqAIsBgAIuAKkBzgAgAgMC9AKBAX4DMwD/Aa8BLQPUAl0DagBwAPEB8wF3A94DSQD/Ae0APAFeAJIAIQGfAyoFzQUaAroCCwBiAfAA7QNZACoDegDdAqoDcgXtAsgDiwFsAicB5wPRAbECeAIIBM4ApAGOBNIEPAF8AXUBrQPGAeUDDwChAokD3gN7ALwAYADSBPEB7wKvAQ4CcgHhAc8A+AIFA+oDwwEeAxgBeAMIADUDggAeAzAAPAKzAgcEMwLqA30DRgRaALAAGwC4ARoBlQN8AuUD7QQEBnwC5wKuADMBdQL7AisFOgV2AGoBEgFwAQ4CfgLFAecE/ACxApYCKgQCAIoC8wBdAZAF7QVVAUMDoQA4AR4ARQJFAn0DwgCpA4IAowBzADEC6QJiAyAAJgMPAcYBPgA6AuoCBQOVAA8BNgPVA0cAxwCPAAwBoQBFAf8BjQL5ADwBkAAvAz0BGQUzA4AFlQBcBOMACgGVALkCRwHjAQYBaQEzACcD1wTnBAkAxQMSARsBCQUuBeYBBwM3AHAAcQDEAQkBwQMyAWkBMACxAcoCqARzBbsFBAMjBJcDogNwAG4CRQV0BfYBZQNDACUDEQCPBFcAJAKiAiIDzAUVBjYAKQFpAQwDpABXAVcENAVEADoCJQJMAjoAiwAoANQBeAIyAzIAxwAFAacB3wKJA6ECgQMNAYgBUAF6AUQBtQI9ARkD2AFBAg4C5wJiASUDsQHMA7kCIgMrAGUBewBhAvQA+gPVAXsCdQJ6ArgBQQL8AO8BIQAlBDsAHAHmAakCAQAHA/oBQQJaAWgCjgA0AqQC+gMEAkEDrwHvAooA5QPCAO0AHgCnAB4BdQXSBOQENwK2A3sAJQLeAAcEmAAYAa8BDQOeBKMF3AFzAokAzwQeAOYCcAESBvEB+gOkAoUDGwFsAjkAKQElAokDrwF2A+YBKgIJAQMDAAA0AjwBGAKPBB4FewCrATMARQIeALAAfAL6A0kAOgJuAAIBwgA8AgsCcQI5BEYEeAR3BSwDbQOQAP4BPQB9AHsAJQGPAG0DKgG1ATsASABxArUDkgTrBQAARwMeA3YDQQITBMIAkwOQACcDRQLqAysAeAT+AkUDXwCvAZkAaAIrADQAOgDFAdkAdgHfAQ4CpwFrA0wCjwOxAucCMwIEAxQB0wM7AOACUgLWAvQAyANHACUBiQBNApUDDgWCANoCUgDaAAIAMAPvAS8DxQJtA78B4wH2ANMCrQBNAgMD5wN9AVoCvgBUA2IBHAJ5AN0BOQK+BBEAXwOHBdgF4wNsBI0DOQQRABABOgFnAvYAmQHVAHoCmADgAEwAYwGMA98D2gLwAhQBTgLtAJ8DPABGAywDJQQHAGEA/ACSAdkBKwSvAdMBcgCVAy8DbgStAUoDKQFpArEB+AHZALECLwRqBHoC0wK4AIAC2gB9AVUBMwIdAEMACAAUBTMF+wVVASMCrwB2AzQFawVcA0oEdgCjABsBZwMXAvgCcwDXAQQBGgTxAFMC7wATARsBwAIDApUCqgD6A4EBxQMJAUEEsQJdAxsBQQIwAgkGjgGiA9oAtQHKAYoEnQBXAUgA+wK/AYED9AArBAIA9wACAnEEiwGvA50A3gOsAtoCTQJ4AmQAWgEKAA8BYgGUA/8BPQNJATkEXQDXAWkA9wH6AqIDAQBxAEcAAwMJASUBbAEkBQ8AigGsAA4CGwAEBpUAGQUqAkwCHQB1AdACxgM7AC8D2gHdArEB3QF8Al8DRgEBA+wALgIHALoBMwHFA0oByAGaAvAClgIEA/QAEgFqAkUDPwDLBD8FuwW2AKwCOgA0BZYARgNzAFIC+gUQBg8BjAKIAfEBHgPqA0oAxwATAAUDMwA7AIsBMQNeAeUDeQDKAUYF+gV6AGkF6AA0ApUC5gIqAtECdgDaAiYDkwUgA3gDxQEUAiYAigEKATMCugLdAlIB+gNXAHUC1AGVAlEB7gMhAHYACQCVA0UDgwMlArAC0QLmAogB3QG4AKAF/wHfAzIAZwCLAI8BrwEHAj4B8QEbAHUCGwGUBCEAsATTAl8DigC7AHwCsQKSAE8BkgCtAOMDGgUOAOAAZwFaAmYENAXFAnUDKwAbAf8ByAOqAIUBVQK1A3UCJQOhAqgCSwDeAF0C0wIbAMgA3gDaARsAywTXANMD/AB8AvcBpAJZAOcBKwDoAA8AMwB8ARoCOQJIA9UBfQMkAncD5QPHBPwA/wGxAQcCLgDoAmUBIALYAWwC5QN3BAwDigShAiUDiAGNArMAuAERAO8CUgFBApcB8AI7AJEFkAB7AzECfQPhAL4FTQBgATMCpAN1AfsC6gLTAwMAjwVfBKEEfQM5BHEATAIOANsA9wEDAgoB5QOVA54EpAI8A1oADAE/ABIBkAD0AMMA0QLKABIErwFmA7YAlwHMAOYBIQC4AQIA+QAQAFQEBwJ8AuoBjQP4AfUF5gL0AtMCBwNlAI8CSwCjAiACIwJ4AhEDKAKHAzsABgJjAaIBPwXyBaMAqQKqAeMB7wH6AxIB6gPSAFoCbAEpAgYCHgMOAK0AIQCWAjECwgMhAQwDiAFHA9cATgQAADIBsQLDA90BKAL7AC0CegIDA8UB0gQeAawCGQJmBWUB9AJsASAFHgARA68BRgMRABEB9gCJATsAAgGQAOACyAC1AQEAwwAEABoBHgGhBEkB6gJSAXwCCQMrBDcCfwNhAmoCSQBOBD8AXgFpBasFZgGhAvgC3QUmA+AFGwB1A5YC2QRnAHUCogLdA8IAhAIWAvIDfQE7BBsBPgHFA6EEiwHGAQQAVgBJAdQC7gCtAzMAiAF9AfoDfgBnAgkDBwT9AG0DMwCWAF8AzwCUADcE9AAHBP8BwwOtAOIBlQDaAowDWAUhAEEEGwHzAf0AyQFJAcABiwFdA8IAIAT3ALEBdQEcAkcBiAGzA/ADDwGvAQEA+AGSASUC2QEJA5YC8QJjAZoClgD2AMwAIwQbAEYDcgA9A6YBNAKbA5IEwwCZAXoCgAIxAIwBwgAZAvAC6gN/APEBAwLTAoMAQwOVA2IFEAHRAjQCJAVJADECuAF4Aq0DZQT3ARsCMAAzAI8AdATVAD4BgwDkAbEClAQIBd4FXwB8ArEClQR+AMMCNwEvA94ACQH/AVICnAOtAwgA0wIhAKMA3wP6A+wAxwQbATMCWgBMAsYBAwQzAgcESQA3AigCMgJ1AQYEcQDZATYBJgMeA4kDNwTPBOYCEQP3AJ4D3gMrBEsAjgAeAKoCBwJdA8IA8QFrAJgCZQHcAX4CdgM9AUMDGQAOASwArAPMAFICfALqA3YAGQMLBRgFCQDbA7UEawWLAG8DAACzA90B4wGkArIDSQCMANMCBwTaAgkDMADQATwAfAKvABIBbAIeA3UCJwMKAGUBAwNFA0wAdANQBGQE+AFqBEkAKgMDBBQFDAX4BTwBVQLHANoDnAHJAlcCogMBBJIEsAEEAsYBGwIAAKYBfAGDAsQAYwGDAKwA9AD3AR0AsQFuAHAAgwFtAvYAiALGAREDuQQxBYIAiQM8AbwCiwETBEwCyAPaAQsC2gBtAwkCOwIrAIkBpAIeA0wDJwS4APcBXABhAAMEdATnAvoDWgDZAQMCbQMyABIBCQEKAQcA2wBxADsEowCaAlQAyQA+AacBKABeAWcAcwJHAFoB9AB3A6ECswOeACkB7QD1AR0DNwNaAO8AiwAJBjQADAUEAhIEzwTgBewABAMRAJ8AfACkAngEDQb0AJQECwKQA+wArwEzAWwBGAK1A4sBLwM1BRoG/QDaAgEAKQSsAM4APwBCAwAB6wKkAlwElgIvA6MA0wJ8An0DZQHnAgkBVwHnAsgDFQEpAlQA5QBeAHoCcwThBPEBRQN8Am4EDwCzA8cAeAJ8AioEggCkAnIAawNdATUFVwFaAaQC9gOjAEMDRwLkAgkBmgIJAfoDCgA4AgEAZABIABMBCQAnBIkAlgRTAO8AAgCwARsAsgNMAmYCBAKyAhIB3gMSAdoDRwGmAV0CwwPvAHUBLwCAAHwApANxAAkBMADuA6oCsQKzAA4CLgA0AT8A6gERAD0DGwGxAjMC2gKeAGwDEAD+AUcDzAOvAPQASAFtAcUDywMJAK0AjAD8AHAAfQDPAFIBvgAFAbgAiQEoAjACtgBaAvgCoAWBA60DPQPCA0MCTwMhAHEAKwDxBeEArwEGAt8DxgFfA7QA7QPzASUDUwE0An8AKwGBBOEEZQEHBDABRwJJAIoEZQF8AuwDAwTMAFgCHgMvAyEAuAAEAp8DjgDKA64AGgX6AIMBkAB1AqwAwQPRAtMCmgKsAnoC6gOVAtoCowDFAtoAxQK4ANACQQLIAgwBwwEVAg0F/AArBH0B+AKaBIkFXQUEBocAzwQiBI8ExQE/BYwAZgJhAbEBowAsA3oAywUEAnsC8QCmAVwAzwSvAMMBRADLBUUD6gN7AJYAHgDXAosBFwLyBKUF+AIEBg8AMAApAUcBCAB6AgoBmgLuAPMCBwI9AzwAVQE+AKABAwDVAVMBgQVfAMMBEgF6AloBbQHCAE4EtgBbAdUAiwK+BMQEPQF3A1kAQQFLAAcCCQHaAgABsAL6ARcFeQAEAlUB9wGRAKYBcgCtA2cABwMUAdECMwB1AjsAwgNlAYkDugPuA/oF/QVYAKoB/ABFA0sAqgEuAcMBwwEUBd0CAwMxApYCEQDhABQBKgQ1AEMCMAHkAnABdQIKAJQCrQC1AVEBPAKPAp8EVwCNApUAjANrAU0CagDMAQoAywDGAD4CfgKnAnoAFAFzAvQCNQGzA4wD6wOQANcCwgBTA1cB8gNLAMEDhwIiA1IFqgUyATQCewDeAysA9ACKAHcECgDFAigCigQ3AWsDsAAEBiUDfQMDAtoCDAESBqoA2QHtAAYDogOjBSQCcQQDACAFLAMTBIkAJgMeAcQDFAFDAq8A5AGsAhME9AAZBVoAhwBDAFkDxgH3AYAC3gNjAo8F3wLdA6QC2gL0ArIDgwGfBDQCtAKRAIEBDAOzA2oE4QTzAEwBzwB6AhgBNwRtAEcBSQBrBQkBEwHHACYDEwQ7BFkEHQUUAYIDBAMFA/IEXwUJA4ADWQDPAC4FlgUeAKQFlgB3A8IA/gEJAU8CKwE3Ah0DkANtA1EEqgANAzICPQO+APsBVwD0AEkBjQIKAH4CUgBeAakCbQMlAK8AJwNmA3oACgNMABIBKgBJABwBYgHfAssEMgBfABUAKgDzASgCIQA7ADIAQgO2ABIBYwEbAngCBwP1A2YFYQKJA7wAfAKSBDwFCgCWBMMD6gMzALECHABzAFcAiwDQAegCAAAEAmUEigQ4Aa4ErwATBOoCcQQ3AFsC7gNIBGQBKgIyAAwBMANGBZYAdQMOAC0AwwE1A0UCZwOdAAMDGwGDA3AB2QE3AioEKgLIA5UD5ARxAOYBMwKrAg8ArgCWABcFKgOVA7YA/QCOACUDBQHPAYwAXAIkAnQEkgDHAFYA2wOVAH0BUgCaAokD+gP3AYACzgDSAA4BWgFpAbMDHAJMBC4B2QEcAYoEKAAiAzIAaQBFAekBAgBkAdcAdgEgAE0CEAHYAWgCTwNkAGcAIQCAAscASAGDAFoCqgJHAxAAOgOVAvQCZgSSBHgCRgMPAdMC1QFnAt0BowL/AQMDSQAoAisASAFxAIACeAIDBP0AEgGqAtACIAJ4BNsADAIrAPMBPACKAIkAzgBJAEkBuAC6BPkAFAEoAH4CbQN3A0UCBQOqAKQCPwXrBcoAAQKLAb4C/wGLAhsB5gIcAf8BUwD/ACUANADRAf8BjQBMAdkBdwOqAT0DUgEDArMBKgOIAcIDwgB9AwEAZwA6AOcEXgEIBDUCywWWAsEDygH6BXYB2QFTAPgCCADeA7MCTwT0AG4E1AEIBLwCtQPPAOoDqAEgA3wAdwR1A8QDlQDwAvkA/wEcAAUBQwAgA94AbgRJAf4BWwKtA8IAqgLeAJADKwH4AYsBuAH3AcsEHAEEArYAAwQcAWsDIQEaBAQASgOxAdECZACIAPEBOQQzAEwCBAIPAioBjgFJAAcCRwHFA1cABgJiAMcAZAFbA+cC9QK+ALYBewHhAscAzwSLADoCgwDaADMAmQB1AT0DQgIqAzsASQCVAhoD+gFtAxsCOwRxAHwC9gBwAeYBZgJ+AKECHgD6AwAANQDVAC8D/QARA1cB/QP/ADUDcwULBpkBIgQbAPsDrQOSBBwB6gIcAeACRQBjAhsBDgIDAI0CVwAnA9AAOQIrAMQAUgAzAuECxQPhAVwCkADtAqYBDAMdA60DaQXoBVAEXwTmAf4CWgBuBCUCYQJJAdYCEAF1AjkC6AReAHwC5gNqBKMBXQQdAEoD4wF9AzoAFQWpAhoDTAO+BGkAAwEwA7kDAQCXAewA9QKxAdUB3wMrBHoAIwGCAPACoQXLBYMAogKvAE8EMAL6Bd0BUwNhAMsFMQCaAdgBxgNiAY0CPwCJAwkBpAIUATUC6gHvAqIA9QKqAaoCKwEcAwkBcAFIAOUCDwDtAE8CDQNnAEYCewCIBAIAswI5Aj4CiAGWA9QB2AFFA+UDIgB6ANwBQQL1ApEFlQDOAQkC5AKWABkFaQCNAEQAegBLAL8BAQAUBTcCrQN8AisEfgAeAQkBDAH/AK8BjQBtA4IFoAUbAUUDaQAJAQUBoAGIAQcCBAJMBHgCGgQIAMcAdQOkAxIBhQGhAgwDfgChAKwAgAJEAKABewFKA2cB2wOvATkDWgAiBKEAoQQZAhoFhQGtAhgCugLsAJIBrAC4AdcC4ALfA3EEoAPhBDsAMQMJAQ0DGgMaBP0ACQPvAgUDxQPwA60AVQH6AXgC2AFrA84A4ADMAKUCOgA/BRsAdAGtABIBkgDfAjAC8ANFAR0CsAD4AosBbgMoAIYEzwBuA9oCiQNXAEYEMwHMA6YBdQNHAIIAfACiAlgAfwCvAA4CrQA2AisBoQLqApUE0QL1AqIDcwVVAYwCWgBjASEAMgBVArwCUgJOBCoBEQPRAhwDSADKAKYBmwM6AF0AowBuAwUDcQTSAJUCMwApBIwBjwM7ACMEGQA1ADsABQGJAQcDWQBDA3UBuQHmAWECLgF6ArAA+gF4AnUDYQC6AXIBBgLfAcgD9wUJBjAAiwADAEEAogO5BGkAlQVOAbACSQAdA5gA2gBuA+UD5gERA8IAJAIsAC4E1QBdA48AJAIPAEkBlgBRBDkCjQPzARkCBgIOAwgA8gMFAXIB+gC6ApgAPQLsAIMDzANZBIIA2gB/AMsDyAFWA5YAIAJjAUMD2QBJAWkF6QUnARYCHwCIAMMBsAQjAggEuQOOBBkA1QE8AG0DugK+BFoCmgKnAeoCTQImAyMCqwJJAJYCUgHeA+4A/wE3AnoCFwLmAkQB8gR6AioEBwDzAEECQARaAA0BZAAlAvwAhwFZA6IDEAHqAtYEFQW4AE0CogJ3BDQAhwBwAdEBfAJuA9AAnwMbAbgBKQFsA1wCcQJaAgkDXQIEBjcClQQ0AHQAjQDHAJIErQTxAXACrwHtAsgANgEdAooEewDJAaIC5QOvAawCowKtA0MCZgLKAKMCUgFMAnwByQIzATgBGAHiASEAMgM9ARoD3wIXBdEB8QEUAQMDqgF8AgEAGABYANcCMwAJA2EBKAIKAKwAVQF9AdECgwP2AHgCEgFtA0MAUwGWAMIC5gHLBNoBcQI7AN4DDwFMAmIBzQRfAroCpAJPBJ4AywO+AI8C7gDxAMIAewP+AT0DNwRSBMoB8AN+AkMDiwDJBGcCbAOuACsBMwW9BRsB6gEqAWUC0QD7Am0D3gNVAaICHgArBCEAFAVHAekBlgWfBSoC0AJBAhkFlgA5A8ICbQNVAZoC6gEqAh0AYQFXBBUFygG5A68B6AN6AkEEBwLDAxQBJAIIAJAAtgBIAcoAaQKXAG0B8ADJAucAXQIUAUkDNwCgAeMBaQJyARgCwwB/ArMCMgN/AsUCWQDLACoBrAL2ACME9ACsAgIAOQNcApADrwDUAZIAqgDVAGYCegL1AvQAxwQzAnwCKABDAH8ApQEzABMB7gPCBZYA5wJQApgCnQDJASgCswMrABIGRQBsAwEBSAEoAjQCEQDgAjcChQRJAJwEOACuADoAqAQgAqwC9gAxAzwB+QOtAE8BqgFxBMcA/QD3AP4BOwBaAKgAjwHSBJ8F9wDuA1IBiQEsAKEBhwCSAMIAjQKhBb8FfAJ0BMsEFAUcAGUAUgKNAnkAZQTZATsDuAA5A9MCfQS8APIDwgIJBBEArQBXAMIAzgB4AiMC3QNEAHAAxgElBIEB4QIAAMAFRQBiA1EBYAEJADkCwgRzBSAAXwHyAf0DyAAMAY8CjAS6Ai4D2AIhAz0CPgJ0AZUCcgFSAlICjQNaAt0DeAL4AioBGgR9AbgBHgB/ARwBKwE7BNMEiAEyAhwATwANATICVwA0BEcAqgD2AK8DRQMTBBsCGgMRAC8DrQDnANUBJQPDAf4CsACaAg8CDAPOAA8B3gL6Az0AoAFSAPQADwAZADwA0wIiADcAFQUxBbAAFwJkAN4DjgCkAK8AGAGWAqkDsADEAW0D5QPiAQsDZwKzAwMAGgYsA+ADswDVAFoALwNMAOoBFwKiAtkA0wMCACcDHgBJBdoCLAMsA0MDZwCMBZkF+gVSAHYDOwDDAHsAVQHMAO0C3wJ1A+EAmQHHAPoBMwXLBdIAdQO+AI0DeQBFApUAwwERAA0DrwGqAkYFawX6AtIExwPtA48BqgFdAAIBiwAIBVoAzwTfAzsE/QATAc4AmgTMAO8B6gErBFEBCwT0AokDPQBhANwBpAKiAoUDqwMhBHoB3AGWAPgCRQDFAI4AHALXADkE6wNYBcoBJQMlA2YDCQB1A7kCfgPeA24EMAIIBT8A5wB5AO8CPwVfBR8A4QFMAmoCuAARAdwBQwMMA2UE2gJ2A50A9AD2AEkBHgBVARsBNwHfA+UD6gHtAkcAEwFmAisEQQBTAagE0gS8AIsCwwGaAiEAVwGMAHIBRACQAyoCRQMzALMC7wIeA3kCrQPLAxgEAAHpAVoA1ALZAW4DkQAqA2ECHgPjAwsERwE9A8wAiwE8AccDMwCjAqQCIgO+ACEDRAA5AtUB8QE/AN0DZwMPBBYBjAL9AC0DDgAEBgcC1ALhAvkD1wAqBB4A8ATvAQQDSQGqAvQAfQHaATECRwARAxkAfwGwAJUCCQHwAgMGBAbeAIIDBwAmA5AAcQRwASUDFwJNAhEAgAMQAeoBUwCvAdkB7QKWANECrAHZAbICTARZAGAB/wD9AyEAewDIAGMEqgCJAbMCBwNtAO8A1QGcA3UCrQKZAUECUgFVATQAYwQaBJoEFQLdBEwCKgShABgERQL6A9QBXAQSBhUGDgA0AA0ApgA8ABkC5gHHBBAAPwMaBHcEowTWBBsBfALDANQBPAAJAe4ASQGJAysEwQNqBBcCmgKNAMkAIgB9ABcCvgVHAcoBZwBNAX4AywOLASMEQwKtAzUBNAIeAJ4BcQDhAMwA9AADAO4ASABMAGkC9QPsAOAEUgAJA98CTwTGAQQFGgRcBF4B2AFHANoDMwVpBR4BfgMcAs0EKwDmAisFDQYJBhAGVwBSAlMBwAMGAmoCEwCWAsMBXwOdAM8AwwKGBCMCmgIHAtMDkgD/AMMA+AJLAP0DIADMAVgBiQNhAG4ALACoAkUCZAPDADIDXgGrAiQCKgTTAuUD0QIxA48CugJVAecCWgD/AH8AdQKsADID9wGpAtYENAVXAAkBHgDhALEBfQNnADcFbAIHBLYABwPYAYsCkAAFA+EA9wH2AO0CZwDrAWYC3wOMAN0ClgInA50APQHCAhcFogDeAP8AdATaADwD+wKgA7kDawUOAI4B5wTeBfcAeQJDAk4ECQCeABgC3QIZAI4AIwEqBVMACQHdA7AEIQB/Aq8BTwQRAB4DoQTdBH8ATAF9AdoDjwH2AVcA3gPZAN4AEQCJAU0CzwSvAOoD1gE0AiwAZgUKAW4BZwHDAq8AXARRAW8D/QN0BBIBpAJaACcDfgBpAZUCJQQDADMB6gH4AV8A3gOtALsAPAHwAR4BAgPwBKQFqQI7BKgCUwPhAXECqgXXBWcD4wMbAIwFRgLfAsoADQHEAOEARAH2AosBbQMGAdUBegKLAuEBtQPpAS0FLABQBD8A0QIUAPAAcwDeADACrQTGAQMCZwBBBLEB/wErAF8D2gAJAUwAWgA3AhwDSQCNA8MBEQO5A6gE4QDfAjkCMwV6AssElQAXBfcBAwTDAQMCogObBP8A/wHdARwCKQHwA5AAUgEzAN4DygAGBIsA5wT9AAMEfgCKAUwCKQSeAKECpQDbAGIB8QPfAlEEegDoBN8C9AKCAAoBvgDoBAEAQwILAjkCzwCrASYDDQZDAEUAiQGWAvcB2gNSAMYBmABRAlwA2wGmAZEDWgJ1A0kBNwKMAPsB1QD1Ao0DIASjAHUDdQFPBTQDBgaMABwDlgAOAioC3wOqAbEBnwFXAnkA+QIJAxEDAwIHA5QA7QPnALgD0QIeAw4BAwMrATICxQPbA4sBiQMGAVMBNQK1AxIBmgKCAKoACwKCAzMBMALPADMCCQEbAWMBbQNFA3YD7gA1AXoBzwQxAKsDjABOBF4BEwSiA9AEOgKtA8MBrAJdBRsGQQLgAwIAqQNMAOEELwBgBK8ALANrAbMCeAQrBfsDzwRlAQMEgQUaBvIBTwNeAJYAKgL+AucAmgIUAXEClgC8AGUBFwIcATEC2AEqAswAKgIvArUD0AFAA+4AbAMgAg0GZAExAhsARQPXA/kEIwLaAgIAyAP0AP4CzACnARsBHgPnAI8EpgG0ATMCRQNDAo0DkgDLBDIDbQM2AQQGiwFoA+EAiwFbApUDrwB/AgkAxQGjAAMCXAIDA/gFBAYrAI0AEQA9Aa4A9wCsAHYDmQG6BFoASwGLAH0DHAGyBKUF+QUkAi8DMwCGAIQCTAR9AUMDywUHBrgARgPNAIAEZgSQBTABYwI9AdACWgGIBOoBywT/AdkEkACgA9gBqgRXAG4EdgDHBBIBdQJDAsID2QGAAosB9QJDAqMCHQApAZAAjQMIAI8AIQAkAisAjAXCANAA3gCsAT4B0AK7APABuwA+AtQCWwPxAPUBZwF4AxQBOgOvAfACbAO1Be8CfQPUAOIACAUxBUgAPAJaAD0DtgAXAnoEfgRnAMED+AFBBA8CKAKQACkEKwDTAvwArAGkA3cE0gBlAaoADQHeAJUELwNxBPQArARSAh0DIgPYBHsA3wALAiEEqgDlAqEClQMOANAE/ACgAUsAUgKqAY0D3gAOA8YBHgOvAPcBGAF6AQcCqQO4BQkGrwB8AlcBAwSiA0IEjwDPAMUC0wKLARkCIQDxAfQAFwLVAcoDPABPBEwCdgNnAJkBGwB6AlsCCAWCADsEdwUEBjsCMwOjAPQAUgCSADQCZAMBAHoCNwBbAMIAZgWNAJcB4QCXAXsACQHaAKkCfgKsAvMB+AIrAHwCgwIgA/cAZwNNAK0BAwA1BQkAKgErAA0GKQEEAjoCuQStAEwBJgOCBPcAqgLsACUCiwFrAzwA2gBdAysEpAUSBqMBpgQxABYCHgEzAlABGALCAIkCwwLEA/QA6gJnA/oDAgDvAhgBwwJHAWwDPgHqAhwDJQMJAwMEKQHdATQCYwKKAB4D0QJxBMoC+gUUAFgACQEpBK4AsQHQAm4DUgHDAf0ABwMzAJUEggD0ALkECQYPAkcD0QJuBB4AZAAgAyIDkgSfBd4DKQQKAKMAMwFHAaIDEAYzAloC4wPmA/4B4AIeAGUBfQHlA9oAOwR1Ad0BSAEJAwkAIwIQABIEdgP6A7YA6gNHATACZAC8AGMCIAUNAG4AegJmA9oCJQS4AQcEUgL3AvYAGwJkACUBygA0ATAARwR8AicDBAAJAH0AXALvAioEmgKPBOoB2gIIAFsBdgOMAwgAGQCcBL0FbgMXBfkABQGeAOECzwAEBc8A+gH5AAcCAACIAY4APQOOACkBqgJAA/oAgATmAfUCPwCMBVABHgVTAbQCGwBrAWcBIwI3AIkAsAC1AfQABwN1A1wEngAaBAQAEAZrAzQEDAH3AZAA+gMlALUB9wBhATMA5gIhAJcBwwKZAyMBXQUuAHADxQEJBVcAOQS5BD8FAACZArQBCQZDAkwC+AG0BdEClQTrAA4BPQH+ApAF+wXMAE4EegKJAzUCkAPdAk4EjwFBA4kAbgIcAKABgwARA3sAwwCWBfsFqwK5AgoBdQNSAaQC1ALgAgIA0QEJASsESQFdA4oAxgEzAtACCQNGA4IAgwAjBT8FtgDFAu8AqgL+At8DiAKxAlgADQGvAfoBsACvAbQBoQKxAUwEkQDxACIAegGJA98DTAD4ApkBGwJBAlMELwMrBBkC7gOLAgUDMAI/BeoDFwUGADEAUQGeA2IFawXjAZ4DjwKABKsB3wLYAXYDJAJmAhMABgLCAO4DXgDDADUAOgOuAOIDmgLQAhABpwEsAAsE3gB0BAsBagJvAsMCCQC9ASYDmAQCAMIAKwFHAQwDogPPBM0FZADCAtoAdAEeAOoDPACFAWIBZQQaAlIENwErBDAAkwIrAEYDqgJmAw8BMwLeAJQErgBHAZ8AEgZwAf4BDgIsA1cA0wHOAF4BDwAcAWkBewJ7AtsDYABXAn4AzANXAEEDHgCAAlYAoQILAo8DHgAbAjoAkgS4BfoFewAkAmQFEgZeAZ0D/ADmAQEA2gNSAJ0AIAKpAhQBGAI8AAADjAAqBFYADAN9ALcAlAAYAhsBfQNXBJIECACkBc4AZQGQAFsDVwAjBOEAmgLFAYoE1AEsA3MFCQYmAD0DsAB6AQkFVwUVBWsFdgEGAjQClAPSAHcE7gD3AA0AlQP2BPoFowDDATQCxQM1A4MEVwBOBAkBdAQBAOcAZAEcA3ABEgI8APACLgDCANUBBAKDAY8CZgIvA+oB8QGaAl8DNgB8AQsC8gMbAOYBVwDGAw4CrAI/ALAABAJCAngCpAPnAPoBBgESAgMCqQIoAkwE8QBMA/8B4AJfAGQAfwCqAlIB6gMjAXIB2AHmAm8CxQPDAYwDEwDRAgcAGgbyAXoCEQBeAMYBdQN7Aa0DswMoBKYBqAHtADUCjABDAlUBDgLKAecEHgDbBIgBNwLoBO0FUgCpAmQBAgKqATcC2AHmAQ4CeAK5BOcE0wJ2A18AhgDDAN8DPgCQA7gB3wOzAnIE9AADAvYAiQOsAEYC7gB7ApUAdQNuAMkAfwBFAlIBXQJTAdYBMgBIAdUA3gJPAW0D1wADA8IAbwNrAIMBAAF8AwIA1wKxAq0DxwDFAiEAKwA9AfcB5gH6AfQAEwTvAKoBSwD4AXoAjwINALIA4gNkBHwB4QFqAIkARQB7At4DywTfAjIDWgAwBc8ANgIKAAsDKQGIAYkB6gGKAHMCegLfAkUB9gIJAQcEuAASASEAxAFwAOgERQMqBK4A6QFaAqICHAISBA4C6gPTAvgCdgB2AxsBmgJzAIEC/QA1A9oA+ALDAfIDiwHaAiwA7wB1AaMCZwAaBMwA0AIYAaQCNwV3BY4AjQIXAvQC3wDZAU0BbQNtAwQFHgDwAnoANwQ0Ae4DrAAaBGsFkgXQAhkFMACNAyoD2wNSAQQFDwBHAVcAWgBJAZQDsABzAqwCiQMOAJAFFgKPAicDwQO4AEECDwH8AzIAlgB2AfIBOgHWATwAJwPnBP0FMADuADIAcQB7ApIDUgHaAxwBiAH3AeoDfAKsBJIA5gEkAt8DZwBuBDMAkgBSAPACHAFbA7gAzwBzBf8FgwMHBG0DjAMhAEUCNQEPAosBAwJEAIYFEQMDBLgBIwIrAAQFsQBTARMA9gAwAAcCUgCvAYkB+gN2AOMAqgCqAsYBHgKeAF8E9wHBAzUBaALIAAAGXQI5A54BXQJMAsMDQQLaA2cAjwRLAJ0AywB7Ad4AcAFHAZkEZQGZAWcCIAPWBP0FawBQAQwDRwOSBA4FOwBnA9MBJQTCAqwEfQFGA6YBtAKsALUBEQAiBKUFEAYJAS4BPAAHBA8AFADKAbMDuQMJBuQE+gUeAG4DlgKzApIA6gPvAZEF9wFdAmsAgAQBAF4ACQH/AaoAEgYyADYCKwDwAkQAbgCCBM8EwwEHA5gAlQIpAXsCRQP9A3YFowVaAEMCKwESBL0B9QN9AW4DuADTAoIACQMJATsESQBXAIsBwQNMBRIGowDOAKIDlAXHAD0BEQBXAZIEAAXVAQcCwwDHACEBqAIqADUC/QCzArgA5wCJACAChAOoBDsAuAERAI0AHgCMBXwAoQCYALYANwRwBEUAKAIUAbUD7wDuA/oBIAIjAqICzAA5BKoAVQEeAS0FVgCRAIgBaQLqAxkF5gHCAt8DEwTSBGIFGAEYAlkACAH8AIsBMAFpAUICYAJwAWYDGAHcAeIAPQHYAbIDcQCwAD0BegJ0Ba4FWgHTAhUBhQIIAAME6gE+BCgCUgL/AfECawBQAigCowIwA+QEEAFkAQYCsQLFAQkGWgAFA3sAowD9AwMEZgL1AugEMwXRAdECAQA2AqcBBwISATsEUwDbBEcAQwKrAZUC1gJrA2IBcAHqAW4EWgDbBJUCbgNiAbEBPQHHBDkCywWQAI8BlQOhBWYEwgQxAI8DggCsAn0D8QOVAtMCBwAfAgkBrASPAYED0ACQAwMA3QRvBE8FzwQSBnYA7ADDAdECXgD9AAsCjQMVAV0B8AJuAyUEfARXANMDPwCXAe4AOgOKAJ0DhwCzArgBpAP5AB0DCQA1AokAPQJdATQCCgEDBHABvwFWAKgCmACsAAsB6wLVATQC/wGFBI0CygN+AFoF1QBFA2kE5wQYAdQBZQTyBMMBfQRIALEB0AT7BQEE5wTjAUUCOwBLAAoBlQL1ApQEPQElBBQA4wNfAKcA2AGJA3EACgFVAZcBPAAYA9IABAFOBHEEBgX7BTkCHQOcANkCRwFiA7QBwwLrAMoDIAA0AK8BxQJ9AeYC8QHDA+0AQgLQBDMF/wECAkwCjAMIAG0BSQCcA88EKAURAIUBEQATAbwANQN8AFwEPQGsBB4BlQIwA1cE+gKyBFgAwgARANMB1QAeA5IAeAIZAA8CLAPHBO4D9QNYAO0AeATgBVIB3wL3AHUBNQFiARcCbQNBAugDigDAAgoAKABmA30DIQD/AQEA+AJFADoB+gAeBa8BQwIvBPAFAAA6AQoA8ALOAN0DAQAlAaoA8wGQADcBywALAyUBwwGvAPwDegA1Am4DsARjAeoB3AGVAm8A3gD2AOUDAQD9A1oAagSgA6kDwgDVAdoA9AIhAGYC+gJXBCQC7QIkALIA0gCiAjEFCQadAK8BKwFBA1MAfAKQAA4BUgK1A70FBwa+AN4A7gBUBAsGEAZaAtMCcAGLAucELwVTAaYB8AE5AgIAjAATAVoBMgBfA/cA3QFjAbMCSgNTA8wAagJzAHoArAHfAzsETwSyA+oDSQA5BM4A3wLjAakDMANNBK8AiQOwAGUB9gCqAjUFOAWiA9wEVQE7AxUCygMeAGMB4QQaBUkAWwLjAfUDLAA2AJYAJAK7AGMBVwDRA8MA7AAhANMB4QUEBpUACQFMAokD+QAxAqQCmgTVAaEC4QFPA3ABqgE5AOsAfwC0AjUCbgJ2AEUD2QH6A/YAxgMCAPoCMwCUBAgADgFVAUUDqgD3ASMCFwWzAisExgEaAxsA0gAhAYQCDwGFA+oCwgOtBf4FBwIgBAoBFwVIAOMBgQGTAbsASAPSBPYE6gF9A64AmwFaAAcDDgIbAmIBRwPSBJkFPgEHAvcABwLPBLkFSACgA/8ALgETAH4B5gLlA9kBeQTZAQMCawF4AvgCfwWiA/kFWAD4AcIAsgLnAu8CHgCNAEkAvwF5ANYCrALeA4gBGQIpAIsAZwCJAa8BIwRVAccE2gCsAi0AAwGMAEED1AFuA6wCTwRiBQkG7ACnASsBZwNiAbMDQgIgAxwBogPKAEcE4QBVASQC8gPnBAAFJALRAqsCjAMsAIMCMAORBVIAmABTAWwDGwDPBIgB8AMTAGQCXgFuAwIAIwTuABIEowDiADMBrQMQAMoDzAB9Ax4B2AQBAV0BvAB6AjkCOgP6AX8CBAKWAzMBRQHwADkCiwBfBdECwQPnAgQDVgBMA9kAvAKqAdkBTAC4AD0BdwQzAL8BWgA9AXwAfgJJBRIGTABTAGkA4wDDAEEEigB9AeIAdQNnAUwDDwDxAbgAfALCAg8FAAA8AaoARQIBBNIEVgCfA5gEuQWHAMcA0wFuAxgBDAPRAAsECwJSAgwBSAEqAVoC3wMqBKEBBAKLAcACowAaBAkB5QMqAt4D6QFQAuYBLANzANcACgBnAMMDlATaAkUDpQW7BUcACQM8AMYBfQPZBFMAEgFTAWMCIQDhAOgF7QVgAaECzwBjARwB1QH+Ah4D4QBBAiUAgwApAVMDCgCgBFoCTANIAf0D/gH/AZMFDQZxAMICcAA1AhIBZQGIAfUD0gRGBQMEywQeAFgAqwERA3wBIQNpAcwD/wEjBJAAHAJgAXUBPwAaA2oAegH2AN4DlgBNASsBigKvASoEGwJuA0wDXAQ9AF0AlgBzAjsAcQQ/ALgBDwBnAgMC+gPVADcCwgCQA48EBAZrAXUC5QUHBqoAdQKsArMCBADFASwAPALGAakCcQAkApsB3QE4AToBbwLEA0MAbAPNAiQEGwBWAcIAHAIeAAMDBgALAY4E5wSQAGYCbQBHAwIAqgCtAF4B3QGqAnABLwM8ALAAgAQeBWQB2AG+AD4CTgKCA3gC3gPQAt4D5wT2BKIDAQQSAQ0DvQGVAwIA7QIpBEEEWgFFAywD3gNzANkApwGWAqID9gQsAE0AmQFFAuwA2AQqAjEDugP1A8IAIQFwAcEDKQQ7BAcCMQOVA5YFPADaAsoBCQbJAdkBcwDMABkAaQGzAvoDDwHlA8MAwQPIA24ELADDAhAAWAD7AbECTAIXBeYBJQSLAWYCqwJ1A48ATAJSAMICqgHxAZoC3gOzANgBKwFJARgCSQNGAbABKwDEAcYBWgJqAt8DngBoAUUArgRhAAsGEQFPAsoC8gQ3BA0GsQL6A4sB5gE8AHoC8AA8AdcE8gRkAacBQwBlBP0AegIUAX0DLAOwBAgA9wFVARcCKwDBAyoB3AHDAysErwCMAhsCQwM7ABkCEAGqAlUBQQSoBGsFiwCIAe4AsQJ3AtECCAX6BcoA3QE9AecClACcAUMF8wW7AJUC2QETBGYClgJ5AL8BMwHVAWMEEgZaAI8A3gCHAaECSgMUAIMCBwAAAUgBswIrAPgFLABmAXEACQOIATACCAB/AUcAaQAiAG4AWACPACEA4wAzAC8DCgHGATADawXDAHcDGwGkAmwC3wM3AYcB1gQjBVIA1ABSAW0DjgFDA5YDigQrAEUClQDeA0cBewLYATcCZADfAPgCCQQDAokDoAE6AnoC2gLDAhoEGgK+BGMB9wFiAa4EsQHqAjcA1gDzACIEqgBlAd4AagKxAkYEBwLZBGQArAB8Ai0DGgSgBJUDaQQjAXoBaQKWA+gA8wCLAfACCAD/AI4AngDZAYwD8QGVBAQBZQEUAUkBawGvAa8AIgNoAnoCIAAXAcwA2gGcBMkEOwBmA/8A5gH/AUUCPQHfA+4A0wNJAcoDowDSAD0EGQY/AEgBTQK+BesAaAJDAJsBkgA9ASMCEwQIAPIBBwKVBMMDBwQrBc0FoAMPBGcAtQEbAIwCSQE0AnEAEQOLARkFlgKtAksA9wCsAowD7wFmAlICcQJXALEBWgJ3BJkDLQV6AD0ClgCwBBsBBwJ5A6IDVgDtAA8A1wKaAsED7QSaBfoALQIJANIAGwKsApUAogLMAPEBAgCVACgClQSSAJ0ABQPeA68AZwFHAJcBKwB6AkEA6wIJA94DRQNuA/gC+AXYAdoCKQR0BCgAnADSAPACDgCDADcBXQOcBHMFSwDeA5gAxwCSAOoBtgDaA04AZgCWApQE0QLgAiEAWwHoBIcFCQEvA3wCeQRDAyUEnAToBe0A4QFpAiUDkgDEASoBCQNeALwARwGhAiADXwQOAGEAPQHdA/8BqQPhAbwDQAB7ANUArAEKAKIDswJFA+wAJQRYAeoBHAOpA1gAAwETAeEBcAHtAkMC2QRmBI0FfALCAtoA5gEzAFIBkQAeAV0AkAWvALYAkABOBFQAzwR0AUEC8QAaBLgAmQERABgDMQViBaoA6gOjAN0DrwF9AyAAXAAVAakBowB8AjsA/gKKAM4BCwBDAIoBpgFMAu8C6wCoAV0BKQJBAn8CTAFdAkgA3QEzAn4CWQBnAYoAlgCwAMUCVQHQApUCEwSPAGEC2QF4AkUAygP7ASUC8wDgAqMCbwMKAf4CBAGsAo0CoQKtAHgE2QEZBSYFMQWzAg0DCgFaAawBBgKcAccDEACIAXkA2wM3AIYFygHhAq0AxwFiBN0ECQTDBAIApwEsALQBVgA+Ao8AyQGtAJkBQwPqAwgAWADjAWsD9gDaAhoDQwM4ATQC5wASBmcAyADPAOYBCQB6AGUBXQIhAF4EZgShBRgBBgMVAvkElgBPBKwABwN/ACkB4QLHA3kAsAOPALkBwwHGAaMACQF6AT4CwwFDAvYArAEvAZkDQwCOAHsANQN5ANgBUgDlAzECQQOVAKoEjACCA6UBdQL4As8ElQBsAosB+gFvAIwA1QGxAg8BdgNwAMsFjQUEBqQBpAKeAKEAqgDPAKYBHwUJA+gDJQLeAwoAUgBEAL4A4QAgAowACAIAADoDYQJ8AnoCOwTKATAD8QFGBK4AmQPGASMCOwB3AjwBSQNjAdwBKwF/AdUA6gI0BXQFBAGDAr0F5QVcAMkANwFmAswAPgFkAWYD7wArAUkAcwBBAggEigDYAZUAbQNVAm4CzgBCApoC+gNHAP0DOgKVA/QA/AAeADUA9wFfA6oClQTwAI8BWgBtAa0AwQM3ATEC9ADCAkQANQLOALQBeALQApUDlAXxAdkEjgFaAiMCCQPWBAkG3wIHAy4A7wCzAIsBIQATAdUABgIsAEEDrAIaAzMBRAFfAPgBLgVrBXwA4wTOAIUDYwHmAq8BIwKjACUEEAD/AVABgAQzAOMBRgPqA/MBfQMRANUAZwAMAbMA1AHOAAsDMQWZBawChQPDAdgBsADHAUYBYwI1AqIDKQHLAxkAaAJYATsD4AJkA4sAuQQlAJAFIQDTBD4AtgFfALkBewFbAkUDZgOeBAkF7ADqAlgAqgCwAN8CnABxAfEAgQHVAakD6gO6BHgC2gNkBbQFFABxAa0ACgGxAewByQHCAhMABwQRAUwBfwCKAlUCXAKJBdQFeQDZBMMA4wAhADsDsAElA3IBtgM0BesFKgHGASwDpAN1AeICAgDfA4gBsAPwAFMDPQH6A88AWgGVAMUCOgAIBT0B2AFXAHcC6gFOA68ABAHxAV0CZwC6BM8AXQJ8Av0DOAHgAn8C3wKMAVwCwwH4AvcBOwSqAPYALAODA10C+gNdAwcE+QBbAqMAqwEpAYQCzwCsBNkBBwLKAFcE9AAsA0ADgQPsANACqgI5AywAkwMoAnsC3wGUBAwAqwTZATMC1QH/Ac8EvgXyAFADHgAHAjMBswM/ABkFZACqAIMDKwQeAV8EdgDPAxEAlQC/AeoCEAEwA5UAcwIoAMQDMgCGAIMD3wOVAuAD3QH1A4sBwwHaAIwCUwBMBQ8BGgOQAOYD7gA9A50AbQMLArUD+wPxBRIB3wIhAFcAyADEAa8ATwICAIoDigKWAuYCKwQcAbABlQBVAREAyAN2AKsDAQBIAZkB+gM/APgCiAGiA/UBugL9BQkGxgDQBN8CJQTmAt4DMwI7BFUBegIZAjwCdQIbA60AsAS4ACACHwAWAo4ABAKSAE8CKQG9AYwANwHvAD0DmwNlBKYBWgWVA9ADYgPNBD0BfQGsAMQBFgKMBFICrQNLAIgBQwCZBEsAqgLSA8EEPQFSAX0BjwTDATMCLQA0AGEAoAGHAd8DEQFIAToACQUlAiEE+AGqAtoCbgNnANIAQwDVAc4AxATEAEYD6gE3AhEATAEUAEADFgJcAioAWwIHBgkGawDNAFoAZwMrAMgATAKxAhEABANVAroCTAMIBPEBtgQeAC8DlADHA7QB8ANBAQwCSwC5AVcAJQMSAYwFZARoBVgDxwNnACcDqgHRAnwCQQT3ABIEWgHJAZgAegEbAdMBNgDtAFQBuAJJADEFNwJPA68ACgHsAeACowD9ABMABQHvApEFCQA3AMoA+gLGAJAFwwAiAxkCbAMIA38EtAHFAXYA9AATABwBAgEoAZQAfAGJAA0GUgK2A5IA2QF2AY8CmgGrA64AugOqAHgCkADYATEAXALKAJUDjgCuANQCJwOaAssEHAEHAmMBIwIyAcADDwJ7AjUDdARmAnoCkABhAR4AsQKeAJsDfgBSA/MFDwY+ASsEowDIAjkF1AUUAeEBJQIZAyEA3wNlAd4DfAL1AgEAEgYgA3UDaQSSBHkAgQMZAocDqgDRAj8ATwQOAnUDygGoBCgCngNDAjcDvgDMAP4BqgKbAcwDAQQ/BZUDnwUpAbICEAB1BEgAGQLjATICDwCNAksAwgNdAY8FFwLQAtMCsATtAGgCTwL7A/oBdQJMAl8DvgD/AvAAcQGWAMEDNwSPBMMAgAMhAHYDJgFfAQEAPwA9ASoCBQAuA0AAJAKjADwDkQDhAq8BOwOFAGIBWwIdA1QAzQDVAHwCEQB9BD0BBwRdA2sDrQNOBLMCJwNbAcMBHgBbA1EBHAJjAREDMAAGBBsCqQIrBG4EDwISAvADUAQDADMDNAOKBfABKgPZAeoDvgCzASsBegKVAJoCfAIDAzwAlAS4AMQBnwDnAI4E8gQpAWUEkAD4Ag4AJgFjBDoFWgCNABsCxQL3ALEC8wHUAngCiQPhAGMBVQGLAZEAQgLDAcUCfQF1AngCdwQNAUUCugMaBUUCsQIrAJgAqAT9BWIADAF1AngClQOtBHYA5wNSAfgCswNkBBkAwQFmAmYDIgNcBMIAiAJnAJgAMwKaAtAC3wLXABwBOwA5BNcE+gUQABICPwBPAq0DwgP5AIgBtQPtAxgCcgKkAugDRwBfAA8BZwHEARIGDwHwAgIAwgOHAdgBcAF8AkMCWwRmAsgDHgBBAmUBMgOqAhwDmAQEBoUBZgPKAmsFMAIlAzMBtAIkAhQFZAErBEICOgNHAVEBEAB/AQQDJQT6AdACPABzAoIAWAH8ABQBOwDsAPgBlgLhAsQDIwCcACsFvAU1BDMF3gD/ADMBoQRBADoB3gPHBHsAjwNLBVAF7wEzBHsA4gCmAVAEPQKkAmgC6gIPAiADOQJOAkcBcAG4ARkFqAO/BCEAdwMgALsAUgBFAxIBYwFLAPgCgALTAjIAdQLGAeYBFAFVAiEAxwBMAE8F5gJzAx0AqgJHAHQEZQH6ASoBjALuAP4BeQBbArMC8AI1AlsCYwFNAiAAkAWsAdgBMgENAmkBqAEzAPUChQGJAe8C9QJ7AssDMAD5AA0B4wFbAnEFmgLaAt8CpAMbAW4DMwC4ADoCogMFA2sDXQLwAo4A6wCcAKYBygFXBO4ABgG/AaECSQAEApUDAAXQAJwBogIJA9AE3gVYAKQAfQHeA5oBMgUbALUBPwD0AkABMAJ3AtQCUgADBK8AjgHxAGkBjQPTA68BXwNXAIMDCwBnAnQEFAXZAXEEIQOABNcEmQWNA5UEQABkAA4APQD9AzsEAAB5AEICTAOYANsAGwKVAosB3wI+AnEC9gAJASsBiwE/AKIC8ALdA3wC8AI/ADIDAwLfAgQA4gGxAI0CHgDeAH0A3QJaAU8DPADVAH0AVAMRAIsCAwSDBKwAbgTeAMMB7ACMAfIBdATZAdMDRQFZA1gA/wAvA0UD1wA8AQkApALiAUMDTwH3ASEAcAEwABIESQCIAl0AWwKZA6EEmgHpAdsA5gCiAqkCZQFPBLAA9wH8AC8DIAPtA8IACANqBckFKQAJBeEATwL3AKEBmQPEA1oAKAKQBRAGFACVAfUBQgIEAQYDkwEaBMMAGgQgAFQAmACMAjECUgKQACsEFQHWAZcBCQMeAxkF3gAEA6IDvwWtAzwEBQGCA94AQQPEAfUFWgDoABABawPHAPgCjwEkAnMAkAS8AAMEqgAvAwgAWgCXAUECsACzAgoEkQQiA34DzQMVBNYBGgZXAJAEWwEjAqwApAM2ADkAHgCDBNUALAMHAEsB7ALwBXYAeAArAaoBYAB4ACoBTAP1BRIGKAB+AMMBbgOKABsCAwKiAioCZgPmAm4DdgAhBNUAkASxAvUCPQFNAeIAjAJLAPEDfQXIBZUD6wVdAPsFZwDUASQC5gIrAJ4BSwCNA1MAZACRANkC+gAWAp4AZgFyAPcA+AEpBDgC4QIEAaICsQI9A7YD+ARYAIUBMwLeAxkC1AINAeACmQHQAgkBEQPOAaQDDAE2AlYACwNHAAcDWgDEASUAIAIdAK4AjgOtA6MAjAOtALMCSQDqAsMD3wMhALECrAApBCUA2gBpAG0DzADcAysAwwHlAxcFVwDuADACXwURAmoCwgD6AgMC8AL2AckDzADeA0ICxQPPAOUDCgCbA6oADAGiA9cEWgKpAqwACATTAikEIAOkA1oAwwOqAMEDsQThBOYBagISARIG6gH1AngEDAX/ANMCLQCwAM8EXQUhAOcCZAAUBZAAyAMwAHsBdgPHBCsBdQHxBQQGPwWjBeQCMwM3AtkEegFNAtECIATvAEADngCRA4gBsQJSBJAFfgCGBOoBJQLTAh4DwwIgAw8ADQGQAO4DPgFkAQkCygOqANgBMwHWA84AjAKcASEDZwJkBFUB2AFkAC8DSQE9A10BYwK7BRAGawHPBHcCBQNIALgAMgKyAi8BZARhAWYFMgDnAGEABQGMAPYALACyAv8AqgKsAMICagB6ALAA+wMjAVUCugSTBXsAFgKvAZUCUwEPAoQBpwF4BLAFVgB4Az0CQwNkAe8BHgAyA0kAuwVIAEMCtgA7BJgE7wUiAAQGHgFeAZYAiQHvAnEEYwT1BSAF5gU3AvcCLgBRAdQARAE9AeYCTgD5APYAKgQ/AIIAMAAuBJsD8APeBQkGEAHIA/oBrAJaAJ4BBAKjAnoA1wG2AG4DwgA8AW0AKwFHAHYAFAGPASsBlQQAAOsAxQI7BDABMwPVAaoCLABRAWkAwwGhAlAEDQCMABsATQHVACoC6ABUAVoBegJ2A6QDDwCKBF8AlgDXAI0DswLlA+cCJQTvAsgD5gH0AgMFTgUlAMsBiAGyAsgARgKIAXsCUgHoAwUAQgDCAAsEjgKWAiEAUQQ9AaIC2gASAZwDigRnAGsB8QBSAvYAKAKSASEEGwBZAKcB0QIsAKIDtgAKAdQCBwTxAMcDNAEaBecATAHIALAFRwFpAaUB7gF1ArgD7gC/ATwASACLADwBfwAyBLAAzwTrA2QEZQHZASsA6gEQAL8BxAH3AZUDtwQJAwQFqASsBVkAGgEUAC4AxAHfAjMAwwFLANsESQBEBG0AqgIIAPgChwBrAVcA4wFXAEUCmAAmARgCPgLqApADAgAJA+QE5wTzARIGMAMuBdECRgRMA8cDwgBHA4wASQHFAuUDWgB/BSYAqwRNAo8EggDDAUkBUgIoAmYDTgAFAdoATQKvAbkBwwCkAwABcgEfAC0BjwEdAycCdQRkAM8A9AAFA2MBBwNMAuoDPgJSAvwAJQKpAW8DiAESBBAB0gTEAW0DFAHvAj0CogLmAdEC9gGTA44ApQGmA1MEegBcAgkA0ARMArAEhQElA/oDBwQrBJQExwDDASoAXQD0ANoCXwX6BbAAPQFIASgDegIeA6IDtwRBAqcC8wGqAgAAbAHsAN4DwwBRBCsBjgKoBJgFxgEaBG0DrAR1Ab8BeASgBcoFCQa1ASACMwDIAxAAFAQzAkMDiwBAA84AOAICANMBLADuA8MBswLMAC8DlQOjBVMAaQBBA8IDogACAV8AEgHWAWIEuADHAG0AsQEMAd4DRQISBgUDbgRDAHsCHgGHAuECQwPBA4MEiQQaBqoArwBbA0YEMwAbAT8AOQOXAQMC0ALtAioBGgN4AgcEZQHqAWYCfAL2AIcBiAGjAnoC7wK4AXYDcQCzAo4EPwWBAagBKALWAgAAIQFHAJcAUQEEAnIBjwNTAMMBbQMUBRsAGQWIAu8CpgEdAhEA5wKOALAD0QE3AgMC+AKfAa0DuAMQBRMA3ADKArsFZQFRBGkBJQM/ACIE+QCPAUQBlQPuA28EOwCiABMB5gHCAGYD0wDNAXwCEQOOBKgEAAFDBZAA7wJIAV0CAgDKAMIAtgNeAbAEUwBwAa4ApgFLADcDBABjAAkDcwPHAPACjAKVAigCXQPCAJUEEQDfA+EBOQJ4AnoCSAANATUBFQKKAJkBYQLlA68BvgIgBQUGVgAhA08CdQJaAE0COgDSBDUDSgVfAAkEtgD6AUECRgMKAG8CYwINBQ8A3QHtALADZwOgA+oCMQOCAM8AKwGBA2AE5wT3AXoCPQNBAysA5wA/AU4BzAAQAV8D6gPaABYBpgF+Ao4A4wEqA54E+gNuBPgCQQTaATkCGwA3BWsBmgKVAJkB9QJFA5UAegJFADABnwClAT0BxQL2AMACjwFAA6MACQOYAM8AygPxA3oBDQbHANMCMAB7AhsAiQO0AqEERAFZA5IA4QANAUADCAVfBeEABAUbAfoBqQIRAwcDwQMeAwMEUwA1AwcFXQWjAOYBzwR3BY4BTANSArwCKwAQBUsFqgXDAAQDMwLhAwQCcAOvAOYBlQDTARsA9gAPAeYCsQGtAosB+wJhAGkFCAK2A9MCwwNIAE8FCADjAKwCTANhAXUBqQH2AUECBAVaAKAFNQHWAS8BuQKIAQwD2gJ0BMoA6AJpBJ4EEgATANYEAAW7BM4E0wEeA8UDhgQrAfgCpQH4AiIAkAUrAbYEjwCdALMCAwTTAm4EXgF9Af8AbQMMA8IDFACNAzECTgQdABwBewJTA8YB+gMsAHADcwC+AL4AvgQRAPACBAKiA0kAYwAKAbAEfwCFAUcAOwStAOoDXQJ/BYEDogM3AtQCjQRJBbgA8QFMAi8D5gEZBdUA5QMSAQMCcAF/AV0AOgLxAPAD+ALwBJUAlARLACAESQFGBG4DdgPFAbkDQwAYBA8AJQOYAM8ECALqAnIBVQIqAh4DIwJcBBgB2wMPAHsCewKuA+EAfwKjAK0AmQNfBAQDKwQPArADYQEEAh4A1ALKAR0CMwGiA+8CAwRqAuUDygGWAzMCbgRnAOgDGgHFAfcABAJaAEECrAAiBFcBbQPRAsIDtgDmAvQAAwR2AKwAIQHEA60A+ALdAkEDrQOyBEcBEgIZApYDagJ2AwkBqgH0AGYCOARPBcwAegLVAKcBKwDaA/QADgIRAC0DZwAQAxkCOgQ3ASME3QGEAsMBwQNnAPsDkgAkAhEAawMhAbQBWgCGAL8AwAAQALECzADyA80AHgWaAbgE8gHyA1IB2QFMALkBPgB9AMsDoQSvAOYC6gFtA68BnALFAMEBHQCyBEMAyAT+AUMC1QE5BD4CvgQ1AF8ARABzBe0A8gFnAFMEBAIcAlICQQPhAEMDKAKyBP8BJQOmAd0ExwBGAvEBCQPTAjIDTAE2AhsBHwPRAiMEygFCBEAD7gNXBQkGaQLSBMMBBwR9ASUEIQFpAYMAIwLsAUcDiwHoA44AtQWVAMcEFgBCAGwB1gOxAfUD2AEqBD4BSQFFAk8CWgIlBAkDbgTsAG4DyQDkAN8C2gMBAm8DIQF4A84A8AJXAN4CiwCpA+wAdQM3AisE6wB8AZUD9wMIBS4F6gHzAdEC7QKqACkExgFMAiEA7gKjAYAFQQAgBRQB2gFiAX0DjgBxAVcELgXXAPkAgwD0AmcAiQA3AvUCGwDqASoAlQMvAVoFSAEFAnEA+AKeAc8CwwBhAkYD5QMEAasCmQIMA9MC/gJnAFcBIQAMAd4A+gP3AawCDQDMAEgAfAIvAIAFSQBAAwMCXQJuA/oD/wFBAwIC7wIIAzADTwJfA2MBjwRAAI8DMgB8AgoANwSWAGECAwAPAoMAGgTPAIwFKQAqABgBewF6AO0DRwEZAv0AUgEbAa4BLwGrAisFXQULAK4AHgGZA5AA0QNaABkCdQGPAYgBUgLTAdECjADvAoIA2QHeAAsCAADFADcClATZAFICUgCwBPABGgJSApADAwPeAxsAegH6ANgCCQPaA7MC9ALkAPgFawUQBj8AUQQ9AYsB+ALgBRgC7QNpBYcFDwA0AngEuQV+AKgB7gCLAosA+gLXAJUEYQIDAwgAiATZAawETAI7A38AXQEzAMMAlgDIA6EFqwUUAQgCAQCtAA8BbgFJAMID7gNmBQYCRQO+AGkFKAL3BMMB6gOZA+IDZwApBA4AxgCeAQkDAgCIAVoBdASOAUECJQPxAxcC+gOrAawCgQOcAw4AKgE+AkgDKQHiA2IBWwNkAWYCqgGvAVoArQLhASQCHgBPAWMB3wKWAP4CdAEjApIAEQEqBJQECwJPA0kAVwRsA/8D1QDTAsUCLAMSAUECsQH6AlIAfAJNAWsBrADgA+MB7AEmA3gEewDTApUAQwMxAOkBAQBbAaEA6QE8AOUCIQGiA88AFwXAAw0F0wJ0BI4BngTZAAsCUgS+BPEA1QGWAMcEAQAbACIDJQSWA2UEGAK8AmYDIAR1AbEBngBCAkkAlwMiA6QDHgARAdkBagL/ANECxgFzAnoCDQO4AKQCnAGMBAYBYgEeANoAwwNuBHYDXAR8ANIAQQAAAd8DTQQhACoEbQMpBMoAQQOvASwD/ACRBQ0ASQBtAcMBTALyA68FvQXZAbMEUwBDAokA+wMEAMoAYgESA/AAGAFtA90DUgFPBJUD3gWtA3EFggADAjMB+AM/AHYASQCoBL0FDga4AMQA1wB6An4CIAMRAGoEfgBiA5cBxQIDADoBwwB1AlYAoATBA0kFDgB9AH0BAwQPADMBzAALAkwCFAVLAEUDdQK+BeMACQHiAWACFACZACACQwMYATgCngDZAgwDOgOjAAQFOAWABSQCbQNAAR8DBgLvAmsBCQMqAWsBLwFfBGcAcwPDAAQF3wLgA9UABwJXAIUEPAAFA7gAfwVhAmYC4wHRAkwAhwBtAJAAwwBPAqIDMwUbAcEDGwKkAxsAWwGhBb0FCACSAHwAwwI8APcBzADDAVcBiAQaAicE0wIXBZwA7QCLATQE1ACVAooAzgBWAHAAAAGHAs4A8AFiABkBewEqA/wATAITAF0DMwArBPkArQPDAfACiwHeA1ICOQR1AzsEEAA9A/EB/gFjAfoDYwMhBDcBiwEPAKkD2gD6A40AyADQAjEDrQBPAjABSQI4ARIC7wEjBCsAywGVAk8EOwDzAewA0QJFAwME9AARAyQCKgIJA4kDKQGsA+gDTwQCADkEMgD9Ax0A7gOvAJoE3gACAg0APgE+AN4AJAIlAg8AAQPCANECMwLRAgMDdAQbAcgDsAKrA3kApwF7AaECUgD9A4cB7wE+APkA0QFbAwMAEAABAMsE9gB9AbkE5AStArMCkgCnAJYAKQSqANoCuAD0AAQAoQIWBKcEwgAUAQMARQDDAHMC/wBFA30BFwVMAKADeQDFAXgCBAUbAfgCjgQ0BUMA4gO8AN8ACAASBhAAbANxAOYCLgApASEAXQJlASIDKQDnBAcAtwC0A3gEmAC7AAgArwFBAv4CMAA6AowCrALuAOMBSADxAfMAHwOcAS4DzgDaAK0AjAKxARIEegC7ABQBZgJeAM8AfQONA38DjQOoBIsFPwArBD8A2gOQACAE+wX/BX0BsASlAaoCNwI9AwkAlgRCAu0DWgBMAQcDCQOsANECCQAgA/QAdAR4BDcFVwCIApIApAU+AkwDiQB4AkwAWAC4AOoBRAC1A/oBdwWhAL4DxgHeAzMARwODAN8CZQGXAccAswKiAKsAswD2APQAKgKtABEBygC9AQAAlAMrAWsDZwHiAW8AsQJ6ApoCqgJrAzABEgN5AAgFbAGUAzkCIQO4ARcFswPiAwYC5wJFAnwCVwF8AjEC7wIPARcFkgTWBEsAzAAbATsEfgUJBisASwGNAAwBgAIvAzMCKwQvBBIGBACQASACEAMiAIkASQGOA58A+AKMA48DegCQBS8AoQPPAHMD4QAbAaIA2AE8Ad0CwgDwAPUCBAPRAo0DGwC+BXwBqAEUAWsDPQEbAkAAvAAQAAQCjwASAbEBoQIeAKwEAQJAA6cByAOOAGYB+AFjBH8ADQWQABABYQJtA60AegHVACUExQKwBCEAnQB9AbIDyADPBNoAfAIrAOAFtAINBUABogP/AbADSQCpA8YBTwQ3AlwCLACNAzcCkAQqAEkBcgAwAhsCgAKgBbAFzwDBA30BEwT6ACMBiwGxAfkAlgJXAP4CGwE5A2cAdwPwBPUFXwEEBg4AKgD2ADsE2gE4A88EHgUhAeIBjACtA9MCiQOjBfcFwgD5Ad4AWwMlAVcBYgGKBBkDiQPKABoFGwElBHsFtgVGAcwDuQUEBqwAVgEpAFsCEQCNBCgAXARXAB4DEATaBTQFowWSAFoBEwBYAvYAkQW2ANkBMADRALAATwJSAbMCZAARA5IFEAY0AFwAfAG+BHYA/QBiAR0CKwBMAeMBgQPxAbMCxQFlBNAC7wIhALAAMwBAAzgFyQX4AYMEUAGPAjUAigGMAI0D+QBOBD0BXgE0BawFMwWrBf8BBgIvBIEEIAAMBVUB9AIZATsCDwAMA0sA0wMYAcQELANcBPoCLgXFA8wDngDiA9gBEwSuABkCMwHdBBMAeQF2A7AEkAB/AWQArAT7AYIDXQAFAYkB2AGvAV4EqAXtBYMEEgX8AN4D8AFCArEAZwIDBA8FuQQVBVoB5wMrATwC0AIjBBQBiAGkA90D7ACxA+8AuQE9A08FrQAJASsAEQERAGQBEgE9AYwBagLwAiwDiQErBJwBBgNAA2YFBgAAAdECJwP0AKICgwEXAtIAeALeAFUD/AALARQB2QEeAMYBYQJFA44AwgC9BcsFHwBkAAgBkAHdAa0DcAHIA3gC6AM3AkQEeAITBBAAKwE/AIkB5gEpBD8AdwQ6ApADEAA8AZUD/QWoBNYEMAAZApcB3gOQAPsCFQI0Ah4DbgMgA1wEHACbAA8AfwAvBT8FRQIJAyAANwD2ANEBSQV/BTQCqAMbAkwCIQDHBMICLANIAFUBjAM7BH8FEgbYAcACpgFlBGEBsAF/ADgBLADjATcECgXgABoCigHVAb4AAAE8AQ8CewB0BAEAmgKWAP8AAAChAosAkgSjAEwCiwGAA3sA2gIuAGwEzAAgBEMC7QJgBXMFvgSoBaIDxQN5ACoEiwCQA+wAPQHqAQcEqgCJA9IAZwEbAeUDKgHLATICRwOCAOEAnwOtA38B1QFtA3QEGAHFAzUBYwJzBegFdAEgAgQACQYQAT4BGAJSAgkBZgMEAMoCNAF1AaYB2wPVAEwCjgBnAiMBXwKqAbECrwA9AqMAswLDBBQFMABJAHoA8AESAuAC5wDBA1oA/wGSAYwDlwC8ABkAsAOjAhIEMwLwAiAAXQBFAJ4AiwA3AbMDDQWQAMIDPwB2A0QBoQQBAAMEOwCFBMcAIwKUAEgDJQQrBC4A7gOKABoDdQELBDYBzwRxAJoCQQBLBQQBdQMFA5AE4gGMAvEAOgMeAAUDsAC+BUwClQKSAvUDTwPxA3EA3gP0AEEEYgGYA9oCbgTnA/IDOwAOAuMBwgNHAFIBCQBIA9UBUgLHAFsBegLUAoYFqwVLALEBVwCVBAoAWAN7Aa8E/wBXAbIDOwS7AJoElQKJA7gBBQNlARcF9QIvA4MEFAVIAV8DDwBTASAFJAUeAJcBMQQ0BT8FVwUOAHoAwwSVBT4BMQOfAdYCZAHZAdAC0wJ3BeAFYgFiA44EmQXLAOAAkAB1AV4BgQFGBaUFrwBNAXQBAwJXAJEFLgHgAUEDfQOoAcUDuAAEBpUCbQN5ABIEfQGXAR4A6gL5APEBiwKxAgIAfwCqAvoCigAeAUECXwN6AiMEsQEwAkcATwFSAWMBXQI5BQ4AzwTtABgBBAF+Aj4BBQN4Al8DIwGPBAgAKQSpAuYCMAJXBAcCdQJ1AooCEQDGASsB0QGNAM8EcAHUAtkBfQOPADUDTAPtAwgCcQQrAAMEegByASkBlgNjAdMCQQBsAXEA6gESATkDuAHfAj8ABAPEAZoCvgQeBdgBbQOTBGkFBAJHA/cAbAP2AP4CNQCOAJIA2gDNANgC/wD4AWAANAXhAHoBCQEUBbsAOQKvAHoBAABLAPQAZgNCAvADxAHaAzMABQPUAd0DNQPDBKEArgBwAXcCwwJkBG4AoAFaAPUFEwBlAJ4AdQMlACYDMwEVApIBggMzAt4C2QHxAXgCHgOsACsECwIkArgBHgMrAKUBiwEYA3UAjQCFARkCZAFDAtEC3gOhAGIBpgGzA1IAjgEyAG0DlQOLBZ0AfALfAyUECQCUAsYB5gIRAJcAjQRNBXsAggCxBE8FaQKSBI8EKwV1AmcDsABDA/cAQAPuAKECfQMgBP0AxQJDAnQE9wFRBN8CBAWhAA0FlQKFAxoBngQSAigC4ABnAWkCsgJ5AEYE6ADmBXoA/wK2A3EEiAH6AnoC5wL0APQCagBVAkgB+AJ9AaICMQSjBT4C7QMwAJ8DkgGrA3sAEQMYAHUAQQJWBRwAzAArAFUB+AF8Av0AdAReAR4DoQKOBMMC4QKPBLkFOQKPAnoAhwVeANkBXQKWAscABAbJAOYFIAJNArwA/wB1ARoF/AD7AT8ADgLhALUBMQCCAw8AKQE0ArgCMABKAwEAqgA9AbAEwgChAZUDvwVJADcBawMgBB4B5QN9ARcCrwEfBA8AEgK/AUADKADxAP8ANwP+AZYCiwAEAikBtAEbAnoC5gEqBB0CoQQzAHEAdwOJA2QEZwUSAFEANgHmBSsAbgMrALYAVwDsAD8ANgIeAYEBwwB0AZMFAAZYAUwCBgILAl4AewBfAKQAjwDqAbMCUQQ1AMUAQQIHBBkCEgSiA/cFAgD4AU4AjADGARcFqgBmAzgBzAMcA30DHgB7AIMBXQL6AV8DuAD1BTwA+gEdAjACWgJcBA8BFgFiAXsCsQCzA44BrAKSAAMEGwJPBDoAMALbAL4B2gBuA0YFXwVwAWsDgAA7Al4AnQCMBeAFqgF6AksARwM+AVsDygFsAzcFCAbuADwBygHsATYA0ADeAxQFSQCxASwA4gPxATQCawFGA5YAzgDkBDEFrgBnAhsAmATwAeECyAMrBIcF0wWUBQkGWAC5Ad8CXARTASQFPADRAAkBIwI7AMYDYwCiAywAkAOiAuYCUwDwBPAADgH0AEMCAAUVBZkDxQNIAKMCfQH6AUkAsAFMAm4EtwC+AA4CpAN6AEkDqgD3ANAC2gI7AD8AGwAmA0QABQFlASsEMwCdAAYCBQM+AN0CygCpAXgCXARpAWMClwABAQ8CSQKVA8IEjACnAfYAbQVNArMCBABmBHQBEQMcATMB9wEFAkICQQPKAKkDNwJmA20DNwXRAI0DpQHXApsBJQO7AFUCAQBtAGcA/gKsAgMETADEAKgEAAWxAZUEZQHaAyQCywTHADsEAgBAAWwBYwJ6ALMBrADoA44AywOEAp8DSQA8ATcCyAMZABICHQONA1YAvgRBAtACSQCqAq4AzANNAl0CkgD3AeAFEgZDAEcDcAFqBIkA2gDeABwDlgAtA4gBawN5AIECFABHAcoAJQMmA9QFGwEYA7gA8QXqAfoDqQLTAuEAiQFdAiYDKwAMATwAngLKAPkAygDQAXAClgJpAKQA4QD0AuAA8AGXAa8B8AE1Au4DsQTaAF0CHgD1BZMA6AAGAmECjgT6Bd0BDANDAzsE/wF/A0ECfgIHAkADIwKkAwoA2wNUAAwFtgBdApUDcwU6Ah0D8gFMAgQAqAQNAmUDKwAIBv8AKQQFAz0DQwP2AyoBdwRLAEwCmQCxAUkBigFMALAAHgCLAt4AkgGJAfEB2gDTAh4AnwCqAf8BbQOMBSsBZAP3AIkC8QA4At0BsgJ6ALoC0wF6AiMC5gKwAH8C4wHqAlMApAX0AMEDsQE0AukAMgSvAV0DlgIJA0wAhQGvAdoD2gD3Aa4FygVnARoCMwDfA5EAoQKsASsEBwJOBA4AUQKWAFcBtgBDA6oAHgPvAKADIQB1An8BKAIUAfEBBAFBApYC3gO+BQ0GVQFhAu4APwMEAZUCYQCGBUkApQXPAOoBjAPHBEUDbQOqANMC9wHFAlIA4APuA8gFrQDdA7kBkwPVAYoENQDyAVoAVQHDAIwFIgAgAqUBPQM2AHEBKwCTBREC3wNFA/oDQQJMA5YCRgTTAssEKACkA5IANwUTAfIBPwBNAnkA8AOqAOYBAgB8AsoBxQPmAxoFLwBKAN0DJQSCAOUDZQF1A4kBjwRHAGYDGwIsA4gClgLjAbICCACWABEANQAzAoMDzwAHA6wBrwFxAG0BygDvAM0FBAYyApYC3gMHBHwBxwOJAdACsAC7ADACnwWUADkChwXoBf8ADAFfADUD1gENAm0DJQRZAKUDygLSBBsBqgL6AzsEUQDqAOoB5QM1AqEFfABnAeMBQQOHBRAGxQLaAlcB3gM0AAcB3gC1A50A6gElAIcAlQAaA0sAbQG4AGUB0AI5AywASQCzAt4DAAEWAngCGQXHAAME8QFVBNIAXgFuAxMEmgL7A0cBsAEyArUFHgBfA24DGQWpArIDkgUJBq8AuAARAG4D6AUQBikBNAIIAGQAXQKYBKID/QVIA+0DsQIjBDQA+AKQANsEewAUBeMBNwIJA08EhwAgAgMAAQFeAUwDYAGTAqIDYgU4Au0D7gBBA0gA+AFZAJABAwBHAvEBrQKKAMUC9gDfAa8BgwOxAAYBDgJuA9kBGQOjADsErwGwBM4BpAJpAq0DBwDbAfEBKgR6AcwBBALCA9YECQXUAXYDqgAbAaIDRgU9ASUCeAJMA2oEcwS1BAsGZAEFA68AsASvATcCCQFjAfwAjwHaAAgGwwBNASEAXwA3AD4APAFBA68BgAP8AJADbANQBA0BHAKhAioDdQOGBOEAOQNnAMQBlQBaAgEAEQPyA4gEwgA5BKIDDgUbAU8CrQBfA4MD5QPDAEgB6gH3AeMAVQGWABkDDQUgBY4ERgWtABoE/wBwAdoA5AFaAH8ASwD9ANIEPAWCA48DrwAgAmUE5wRlAfwDnAOvBMUDUATeAgQDMwCJAxsCmgJEATQF6ARzBR0CZQRaAjsEygBKA/gBFwJJAJYFegEaAhsBqgT4ARUGCgB7AQYCZgLDAZUCNQBTAMIAHANXAi4FFAFoAoQEMQUDA7AD+QChAosAygFMAmYDSAFMAvQALwNSAmgCtAFlBN4DdARnAHcFkQG7AYsANQL2AGcDLgF8AtcAOQIQAKQA5gGVArwAQwL/AfED5QMrBGUBvgJLANcCTAHPBGwDlgPnAuUDNwLCA6AFEgYkAucCnAJnBPsBZgKQAC0DKwEYA18AZwBaAKcAqgAHAxkAEgPZAfsBHgW5BRwBUgLZAZoCXgASAbgA+wM6AWkBNQLWAtMCQwMoAEwDOwEmAxAAewIbAVIBCAAzAH4A+AMxAPsBRwHIBJUAqQJLAUwBNQDVAUICugIyAKUBigDqA2QAegLsAG4ECQWlBZkC4QI4AQEDZgJdAxkDPgNtAxMEogPkBM4AtQH/AdYCAACtA0wC9QLYAaQCXgH+AhoCPgICAtECuAH6A1gADAE/AOcC7AAGAv4B1AImAHkCrABzAnkAAgG1BAkFcAGVBAcChQRpAuACRwADAsIC7AMEA98DAQQ0BYkB6gPUAPUAygCJAgMAOAHZAU8DkgA1A5UAxgEaAhoEDAMgA30BXwMzAIkBNgBtAIsALgWwAP0AOgBbAvEAewK5Ab8BMAXqBeIAqwMKAXYD5wKDA3oACwb3ATIDHAIlA/YAKgJVAbAEAgD0AHoCigKCANMCiwFGA9EEgAUeACgDUAGDAcoBmwNPAjkDLQBpAIsBTwQNAUcDSwVoBVcBywSPAP0DtwC2ASsB6gG1AQQGKwBHADMAjwFcAowE3gPqA20D/QM3BLkFBABvA7EC1gISAfMBZABSAX4CLAMSAQcD4QKXA48AdwONA7UDBwKIAhEAcQARANoCBQGNAyUCrgLLBe0F6AUJBjQCswPVAIMD/wDBA30BrALDANUAfQByAYoBswN2AIkDiQA+AiwA9wDnAPMBCANxBBsCdQIEAkADFAH7AQMCgAL/AUYEWACZALsAWgJAAZUDSAHfAg8AfQPRAjkEKwCjAHUBkwJ9ALoBGQKtA9MCDwUwA60D8AIaBIgAnQBiATACNQPsAx4ATwICALgArQDgBSEAQwKDAMUCDgG/AQoAOQI3AVsDywDiAe8ADQENAa8CIAJ3BbMCHgPGAMUBzgB6AfwAEQLwAkYDuwUHBhEANwJdAMsFUgHaAlIBEQPmAawEDwJnAqMA9wGWAjEDQQJFAzwAcAF7AIgAOwCJAYcAjQBXAVsBUwEPBnwC+ALnAE0CrQTnBMYBDgIPAo0CbgKWBLkDoQX/AQgCfgCiA8UCFwWqAEwCowDhAA4AogNBAlEEsAEwAooBDwJfAH8BTAIFA1kBFgJkBCEFyQBUAZ0AiARqBK0FNACwAF4BCQMUAJ8DCAX7Ba8AiwGKAJwBAAHUA0kBQwKWAC8D9AD6AfwAiQMtANoA3QHCA94AWgGMAt8C8wFHA5QAPAGwALYADgU/BYsA1wALAYIDHAGVBGcAOQNgBPoF4gAsAzMAZwCvAN4D7QDtA8wAtgNVAcUC8AOKBCEBDwIRANcCGwAOAnwBgQEzANgBcgHyA4kAaQWJAMYAgQMSBJkBHgVwAUcDUwAJBEgABwIIAOoBAwIgAuMBsQJwAakD0gCsAm4D3QOQBaEFkgBBAikCMwPeADEDvwFBA0kAlgPzAV0CRwAlAsUB8gQ0AhgEXQXUBQ8C4QKWAGsBSwBbA6IDMQQNAZ4DowC2ACsB+wJXApUDGgPlAxwBnwEEACkA8ABCAocB0QLEAdMC8wBDBW8DkwPoBQcGYAH1AzwFCQYQAGYBIQB0BDIEtAUBAD0BzwDhADIArAByAboCNwTEBEwA8ARhAHoALgD1A+ICbwMPBOEEuwBzAgsBHgFiAWkCNwFJAccANgIrAb8BygTSBL4AugKtALoEuABIAQkAUQKwAbMDQwKVBI8BqQEgA5kDEQAjBGIBGATMAHQEZgONA0sB+AJuAKIDwAOPBX0DyAM9AkwDCAAuAaIDwgQRAL4C8ADyAX0AHwJ8Ag8FEQDwBGIBsAOPAPQA2gC6BB0DVQUCAgUDiAHKAYoAVQERAIIAoAW5BWsB3AGvAB4DsQArAY8BowJTBAQFfAJ3AwMEtARDAGIDEQN3BJAAdwIDAk0CYAFvA3oC5QOOAMUAfQFGAosAlgIrAD0BNQKGBaYBUgOiA9AD9ABIAucA9wGOAd8CMwLmAt4AkQVFAKQA+AKPBA8AaAL2AIUEjwEEAg4C+gPvAOMDXAIhBAoBqQJTAdUBNAA6BdsCIQNdAqQCGQAwAfMASwHqAWECkQAGA5cBxgEhACUCEQDTA2UBRQOLABwDIQBLAHkAsQFXAHEEQQKMAysAqQL0ADkDZQGLA3ABQQQjBTQFEQAoAxcCIAIRAJcBeAJ/AhAA8QA4AioD2gCXAUgAswIUAbwDIQBaAlgA7gADAkwCjQLCAwAAnABeAG0DhAJsAx4AiQGJAyUEqgLUAqgFrgUCAGIBMAApASsA1AVkAMYBuABSAV0C+wN7AK4ClgDjAK8AUQQwADcCsQBJAR4FKwU/AN8DlgANA3sCbAPaABEDyQBBAQIA2QQFAbYDPQBEAO4ADAMMAUwCjAD1An0BRQLFAt0DqwKsAnEA5QOQAEEDQwKwA2kA/QBJAGkCFQIkBZsE6wXCBBAG4AUEBvEAiAHqAk8DIACWBLgAngHVANcAhALuA1ABTQKaAsUC6ACbAXMA6gKVAAYC1gI9A84AwwIXAp4CkgA2ARIBHgO6Av4DDwASBI4A3QH3AW4DvgBSAjIACQN6AW4CuQIsA8gAxQKVA5sDewLMA9UBWwOMAGYDegBzBZ4AZwFgALkDUQGhAhEEiQVSANoDIAKiAmMBiQFhAIcFSQAQAQ8AvAQ6AAkGlwFNAhQAygAbAEEEowBeAdkBwQOjANkBGwJdAhsATAEoAvoCLAAcAoAFGgbZAY0DRQN0BNgBZwMCAT4BPACjAI8C/QTiAOYBAAFcAjACswMoAnoCRQLQAg8AsAOoBPkFuwBgAjcB4wEPAKQAIgBqACAAbgCkALwATAIHBF8BzwQdAPgDWQAaAsMAyANFAaIDmQHxAaEFpQXCAAgCsAAEBWcBjgE3AdYCEgFFAqwAiQEUAI8BRAEdAtoCKQTaAZcCCQHqAhMABwIEAaYBQAOeA+YDXAUzBXEFEADQANUA0AKjBfsFwwC6BMMAOQPUAd8CKgF0AfEBdwJSAWUBlQB3BBsBcAFgABUFZwLLA14B0wKYAPoBjgI9A20DiQN8Ad0CmAQNBiwFkAWFAxoEmACkAi4AZQNlBC4FiwCKBAkDLwPKAT8F/gHRAksAxQCuBRAGTQQIBQ0BgQM7AHIARQGmAjcEiQWaAkMDZAB0BJUA9AKwAOAFCQMTBPkAfQMPAVEEXgBaAa0DlgWrAiIDOgNIA4gFiQUsAA0BIAA9AuoCrQN7AfADIQBDA+4DgQTPBBEFOgDyBOYCiQPvAt4DkgBBBCUDQANdAroEEQAyA44AJAXYAe0CtgHdAhsAjQCxAFQECQFuAzMAbQBwAY0CBAAVALgA3wLRACUDtgBfA8MBFwUiA4wDmACsAiUAdAOsAH0EYgGKAWQBjQMIAPgBlgI5A8oBWQM/ACcD4wFCBPQAywRfAFoBYAGlAxAARwPZARcFGwEnA+MD4QTYAaoC8ALaA1cAAgJ9A9MDhALiA/gDGwVnAMcEeQD6AsIATARjAZ4CGAFYAxsAwgIkAmgCuwDUAQUAhgH0AFgBVwDDARIBlwHSAEECiQAIBJYA0gAKABoBiwEnA9EC2QQkAikEaQDPAEICeAPrADUBcgAZArYAAwIyBCAFOgHAA5gAQQLxAS8DsQLgAl4F7gUrABoD2gBfAyEAdwRTAGME1AIrBAEAKwByAEQBAABUBBcBegGtAG4DBABuAHEA2gMrAdgBRAEdBG8B0gEqA8UDegIDBI0A+AFzAIsAwgCKBFUBWAFBAIcCxQIaA5oCsAQ4AKUBcQAHAxsAjgEwAJADsACpAjMBygNXAMEDPAG+BPgBMAViAa0DgwDMARgDZwPVAPgAWgA7BMkB5wP3AfoBAwIjAsMCXwRUABcBoQGtA5IA2gP4Ao0EowAXArgAIgSKAOQDFAA9A/AAZgErAa8CAwOIBHABNwKvAXQEZwCMAnkAqQOLALkDQwJFAiMCfgK5ATwCPgJOApUDQgSqAvEDCgBWAVIB+AHDAIcEswI5A7QBkgSOAeIBBQG3AWcBQgIYAlUCAwCFAJ8A9wAaBU8FrgBpAugCQAPmAYACDAFvBZUDkgUhBUgF6gE7BNcA9gAlAGUC2QHhAUcAiQOaA7EEFABoAFgAqACAABkBYQA6AvcBlQJsAgUDoQKOA/oBBAa/AZAD+gFPBIkDOwRaAGQA+ALaA60AWwFsAxIEMAIyAgYCAwOvAakCDgEUAbMD2wNpAY0CaQGwA1cA2QTsAO8CWgB9A9cAwgOOAAACRQMZBSAA4QBXBAkFBwBBALAEFwUCAK0CgwB4AaIC6gOeBKAESQHYASwARwOqAF8DPADeA6cB7wGjAHcEqgCMBWMBiwGyAgsE4QCiAhgBoARSAIMArgBPBUwAqgG8APIBEAA5BIkB8wEzAO8C4QGQA/sC4wNaAAcC8AJPBHMCeAL4AWQF1wBrA2kBSQLMAIgCHgHrA34AMAIhATgCBQM0BEECugStA7kDlQCwBLMCBAZqALsA3gCqAQoBxQKAApYCngCZA68B3wH6AQMEZwKuBGQBcQQDAI4AiQE5Az4BfQMJA7oE3AEaBPwAJAKIAaoBHQB+ANAADgH5AJADewDfArECfwNDAxMEtgDaAJoDTwWVA64FugJMAygCnAMgADYBjwCAAmIB/gGWAE8BGQKgAygCgQOLAT0DNwJ8AkEDrQOeAAYDUwGPBdMCQQRrBa4FuQNmBFoEgQUhAYMCYQFsA9UBDAMMAW0BQQIQA5kBpAJkBKoFpABTAUwAEgYqAisEGwITBAQDRQN5ANQCqgADBEkA+QPaAL4FYAQvBVIAWQADAzUDcgA+AecANgLpAqcDPQI8A0wA4wP3ABwBJgKFAqwAjAWLAbIDdgCCAA8AmwHqAUgCMAC9AeIB7QMSAcEDCwCbAbkDPAUOAMgAcQBSAW0DGQUTABwAhAULBnEAegLtAA4BpACwBbMCywSVA2YE8QA+AjAATgSuAJwFBgIBBUcAAwQIANoDDQFhAaoCBwQEAAgBYgEBA3sBxQFMAigDLAB7AUkAmQWQAAwBHAFAAasCdgOhBKoFCAPfAygDAwSLAKABAwIDBAMEKQRHAPgC2QERA0wAXwBDAEQBhAKyAo8A0QGzAO8BPwC6BC0AjQAJAXUCDQAkAHEA3wIIBQkFCQTbBH0AkgEtA94D/AAIAzkBiwF+AqQCXgFrBBABiAIrAF0FmgDJAF4BaAHgAgED4QKbA0wCKwS4AxcGRwD/AU8DTgRDAAcBsQKQBM8EAAaDAHoBKAUaBuYBdwMrAN8CCAPsBGsBpAJjAZUCzwADAgAADgHbABoCrAJTBDUAfwG8AMkBHALjA88AjAIAAPkDtAGtA68BjQTvACUDEgGWAusCIgMsAZkBrwGsBIkB9AL1A1cEnQTIBSUEbgRaAGMEdgAeAzUC3QLVATACNwS+BfQALgGOBKUFqgCxAZcBWgIOAXABBQDeAY8E1AV5AI0DoQLjA9AAjQM7AAgD7APwBEwC2gNYANUBeQOVA4kCoQJxAMsEdgFMAu0AcQFCAtsDzwAyA98B6wKnAbkEKgE9AmwDwgMIA8gDcQAMAesBeAJBBPAEYQLfAtUAZAGeAAwDYwHGAWAAQAFBAvwD0AC1A1kAvgE7ANEDDAB8AIoApgG2AKkCdQFmBX0BjAXXAYID4gFaAnwCpAJTAWwBMwBFA1oA/QDuAAcCZABFAwoB0AIPAXwC9gBdAo0FqAU7AAgCZwGGBJIEcAWaAqkC+AJjBCsAmAQpAbwBHwDfAFYBdAGuAqsDOABUAGMBvgVlAW4EVwDWAhIBbQG0AdsDTwJtAxwCiQIrALkFnQCqAA8BCQOmAVwEcAGIAYkAQwPKAaUFlQPwAywAsQHHAEwC7gAcAZEA4gFDAqkDCADJAdMB6gOtA0YESAHPBHQEywTlA24EoQJZAx4ATAFnAHsANwKjA30BHgN5AP4BQwBSAzwBOgMnAa4CDQA+AEQAhAD2AN8CXQUXBlsDwgP+AhcFRQCzA9YB3QRWACcESAD0ABsCHgMbAcMBPQOVBN4A2QT2AIsCGwFzA2oC5wInBIsEowJbBCsA0gVQBGUESACJAQIAoANcAo8D+gHPBLMCwwMWAroClQBmAsMAcwMgACACUgLTAwQABAL0AgkDXQBqAEICGgSQAPwAeALLBO0CfQMUAZYCegLIAzkBsQLBA+oDkAAbAf8B0QMeAVgF7ACLAfQAWgEeAcUDvgDaATsA2QRnASADfwFDAkMAAgMFAy8DCwCOADwBOAJnAIsDaQDIAHEAdgAbAo8EXQW+Be4A/QLTA04ElgCMBawA/gIlAjsD7QCbAmQAAwP8A3cEgwBNAhkC+gKNAE0CaQAUBVIARgLKAzUF+gGMBQMCrAJPBLAEiQF4AiUExwShAB0CEQDtArMD3QQRAH8FCQCXAxkCuANpBY0FsQHjA4sClgLIAtoCGwLmAjsA4wGwAcoBEgHgBTEAuATfAvwDSAHoAWcA4AMYAVUC0wHQAtUAwwEbAWsDbwOBAxAAVAVHAVMB2gA9Ac4A3AEFAyMETAN3BAoA3wISAnsCFgIkAn0A7QV8AKsCsQHXAmkC8AMVBZkF4gEaBH8AmQD3AHUCcwWIBZAArQIhAfADnABpAR0A7AHYAY8E9AD/AYsAQgIpAD8FSATaBN0BQQN6AoMDEADwAJYAdQKUAJ8EEAChAQMExgSQA5MDaAIDA5oCLAOtABED3gCQBCkA8gRaAI4CSADEAPwA3gJDAC8B3wEzAvQAgwOgAy8EwwCsBMYBfAICADECPQEpBCsA+gP9AGECQwLeA7YA3QNFAZkDGwKzAooAaAPeBf8FWgDfAooAowB4AroEQwJxBMoAzAIUAXEEqgKgAxEAsADvABIBCQAqAJIEiwUJAzkDZgQJBpkBswI1A7QE1wDVAVwCjQOjAFIBpAKJAxsAGgKKAIEBFQBqAM8AfwIwAtAD/QAlAvYAGQWQAN0BfgBiAaQAWgE3AQICIQD+AjMBNQFWANAEQANvA1UBdQNkAAoBIwCmAa0DVwRwAYUB5gIpBK0ArwEVABwAfQEHBBEDOwT1AcUD9wB/AaMAGwIeAWoCEAEbAT8BZQMPAfcBGgRfBGUENAUKAMMAfgJMA/ACHgN6AT0CqgFoAkoDlQP0AiUESQAcA8gCdgOfAPgBxQNlBJgArwBpAWQEqQRpBQ4CEwR4AlEEYQJ6An4AbAMbAeoCLwJcAg4BKAKVAqsC2QELAvoCQANTAJYAbQDhASkBmQPMBGQFGwJ9BBEASQHPACoBrwUHBjwAqgIoAOsAmQCqAaQAEgMuAd4DmgKiAt4AdgEdAMIAXgBVAUUBZQTQAHwB4gOGBBEAxAEHAiQCMwWQBdwB5AGzATkCnQDjAMEDtAUUAL8B7ABVAQAAZwKwACYDIQCNAMcATwEFA8MDqgHdATIAmgJ+ALQCxwB9Aa8AugTqAd8CbQMHBHMF9wU7ADMCyANxBN4A0QH8AC0DmgIDBKQAWQIyAMMB7ADfAY4BxQLPAEwBQAAAAQIAEgGXAaQC8QFHAysAFwHXAIUE1wFOAhEApQErBbkF1wDdAjwBTgTKAyAFrwEZAxEAaQAeABcCigATBHwBtQPKATQCaQEEAiMALwFnALgBeQCWA0kAHAHIAPcB8wDMA30B2gKLAeACHQBwAYcBZgKKAH4DWwIzBX0ATgIeARoERQGmAQcCegISAWsBiwEDBAEAtgCrAUwC3wIaAxAA1gIRAV0C/gKwBM8EGwZhAYgBbAObA/QECAWVAHcDjQIcA00AjwEkAtMCHANBAwEAAQGVA5wEBAV/BTMCagKxARICpADuANgBBgKOBBUF8QAqA/EBNAQQAcMDBwYLBjoBZARRAYkCAAGPAxoCTAMzAOUCkgCvAK0DXwWUAA0GYwHlAksAlwB/AD0DfwCWAsgAIAICANcAjQBbAQUBkAMeAIIAwgA6AgoBCQNVARkDOwBAAzAA7wCXAFoBwwGPA8YBbgOhAGgFiwH+AgQAPwUgAHAAAwDrAEUCJQPrACQFJALaArgDzwTjAQcCaQWoBa8BcQQLAGkBAgKxAuoBeAIeAysEqADfAPkAQAOaASoF5gL6A+cEPAXeBQsGwQN/BWMAlQPvAIgB4wHjA08AXAB1AisEnQDTApAFywVlAUwDlgJxBDIApADMAGYDcgBAAYsBCAM7BMsEHQBiAYMA8AKJAKwAOwBtBdECPQM+AugEBAAOALQALQLhAM8ELAA8AYwCpAKMAKIAIgCtAOIB4QJWALUDzwAUBd0CggPYAawCrAC7AJYABAUNAKIDngGaAnIAKAFJAWQB9QIqBFoANgJJAXABqgBqBNQBIwLtAhwD1wQ0BasA7ACeAMQDzwBRBEECBwMuALICYAInBNkBgwNxAMYBwQOPBC0A+AKsAE0B/AA3AR4DdATDAEUCUgAaBHADgQPQAMkC/gJ2A6kDsANwAdgB2QGCA3QFkgWQA8kDLwGMA+8BNwLeAKMDrQB/Aq0DmQX8AP4CAQD0AC0AywFbA5UEEQANASgCcAKCABIBPgALBvoBGwP4AsEFjwFlAwUB/wGxAYoCHABuACIAmADsAcwDSAF9BFYAIAMlAnwC4wGiA0MCkAQwA6IEzwB9BPgBAwIvBBoFkAAcAwUDKwRPAqoCZADlA20AQwK4AJYCHgBGAm4EeQRMAncDewGKBPEB+ALBAycFMwDKADIA2QGNA0QEsAF7AkcDlQR+APADxwCXAVUBKQQoAtkESQGKBNACBAMYAgoD4wFDAsoB0AOXAAwBRgIJA8UAFAQHAo0CzgDPAA8BxQI3Ai8DDgBzBa4A5gOLAfgClgCyA8cAEQFdAN0CAgBIANoC+gMUACsBVwDTAmYCfQP3AMIDBQNbA/8ANwIMAQMECQCRAEQA6ASxAEACPwBSAeMBigR8Ag0DqAGDApkB0QI9A28EygGtBD4BIwRDAvEDxwBBAh0AgQPeAAsBdgEWAjUADwKtAHAEuAC+BdUAhQQCAIQBmABGAgkAoARpASgCawENBskBJAIrATQC3QKMBEUCegLMACgCDgBpBY0ARgJaABsDWwX1BVYA8AB5ADoDGwEjBCEBgQH2ADECPQFTBGcABAYmAysFlgAqApAA7wGgAKYAZwCkA1cAAwNlANcAPAGPAccEGQUTAHYBQADyAWoBdQNvA9UEPABMABgBogJuAkgDLACwAR4B4wTaAMMB5wBFAtwBngJkAYsBTQR/BHsAfAJIAXUCAQFMAZUCmgJwAfAEEQBdAzIAbQFHA/ED1wC1AzMC9QINAbABcgBXAooAsAScBLsFRAC2AdMB8QGxAqkDLACTAqIDMQVLANEBpgEEAvMAXQIIACUB0AKUBDgBpQF4AowC4QKgBEsATgSsAFMEEwDqAuMB/wEZAHEBLgVXBXQFzgVJAsoDiwCBA0MC/QPPBBoGawF6AYkAzAEPADICRwCqAXIBtgG1AXcF3wLoAyEBXwTqAXcD6QHUA5gAEAPqAeUCqQGTA38AaQH8ACoEOQPqAzsAqgAJAcgDcAC+AH0AtQNwAYACSQO1AyoBhQNwAdcCiQBjAQ8AsAHYAh4FNwI6AiYDXQW2AMEDmADhACsAJwOjAN4DBAIZAm4AtwDRAOMDZwJ7Aq4BrwOIAI8BeAIQAzAAZgUbAAwBmQA9A+8BWwMLANUB7ADaAmcAdAFfAI0AgAAzA0MFGgaLAt4DMwIJAwQAZwGFAT0DAwBiBMMBZgIyAFoBogLfAsYAcwUgArMCTAItA9UAXgEBAPIDPAJmBWIBbAFvAGQB+wJMBEMDJwQzAscE+QE9A+AAYAEJAyIENAJnAq8B0QFnANECMwIiAy8EcwQYAeUBWgKwBHsCDAMOAFQADwQvBBgAWADPAIACnQADBBwBNwLTAowF3AGsAuwACgHbAOIB/QBaAa0DCQaFA3cEtACcAdQClARwAXACGwDHAb0BBAItABcB0AKPBN4DsARMAeYFaQB6AgoBswL4AicDWQCOAUcB3wRhAo8DvQGEAsoA4gJeAc4BewBtAx4AoAUoAlMD6gJ/A5wAJAUMAfAEQwOwBMICUQRjAVoCxwDBAz4BBANIAfoBiwFnBNcCJwPyBAgFCQMaA1cA6gNeAfYDnwDoAc8E1AX3AFEB7ACCA44B4QIPAKoCcQBlAV4BwwIPAEIErgHYAQcCrQPTAfUCKgLvAvEB8QJLACoEBQELAQYBRwH8AGECfwBTAfoBwQMwASkCIABEAO0C9QKeALEAFAE4AysF+AUOAtACygI/BbkEQAVCAqIDwgAFA2oAbgDDAC8D3wErBAgDRAX6A48EIQA1A1cAbQW/A8wDqgDGAQgAfAJBAnsEEAD3ANoCIgN2AzsEegCQAwwDbAMeA8cEIAHBAykBsQEbAbIDBADmADMADAEYAZkCAwJzApAARwMFAd8DVgHfAlgAYgEBAHABPADZAToDTgSmAW8C/wDsA5oCfwUBBKgEPgCMAKoAPAJtAYAC5wB1An0BTwIAAEcCkgAKAdoA6gOFAZYCuANqBKMF+gXhALoEEQOJA58BWwLAAyQF5AGiAvcBTQKyA+UDdQFTA9EAjwEeACoEmwQ0BQIAhQGiA/cDCQMXBXEA9AD0ABsCPQFABMYAegGPAb8BcwA3AhgATAA7APkAwwDSALEBBAKZAA0BIQDvAiMCpwKNApYCOwRTBOwBMgKRAHUD+gMDBA0A5wRpAooEfAIsA4kDEwQCAC8DCAWlBQkAWwLOAKQDPAGBAc8A3QOVAjwDggKrBF4BuQLvAfwCHgDEAfgBGQJRAUwEawEDApkB8wF9AHMBJQJqAqwAhwSQABIGxADaABsB9wG/AZMD4wDfAsoAbAMAAMADvwEoAtYBbAXiA84EYABFARoAnQFcACYBlgDdA/0ATQERAGECfgOGBJ0AgwSxAt4DCABAACAA2wArAakDNQIdA10BQwWiAm4DHAJnAxAAjwCEAtIEXQDGAGEB8wF2APIDiwGnAR4DbQNwASQCiQGZAaYBlQI0AqEEGwASBg8BXgEjAYIBlQCxAvAAhgH4AvUFBwBEAOUDEwQbAD0CYwFPAlEB9QMNABMAZwLEA8YElQVIAOYDmQBHA0kBiAHkBN4F1gEzA9gBLAOVAC8DDAFZAgMAtAKQAGoEcgGQAxQBvwIPAdkBoQE9A2kCTAQwAHkAHgBjBEMDdgNyAYwERQEtBVoADQMCAJUEEwFMAigCdQI0BbsFAgCRBfQA7QKMANgBdgDgAy4AugMjAYkFKwEnA98B6gM8AEADNwSeBUgA9gAqAMYAjAAFA7UAxQSiBD8FYwCLAMgATwG+AEkDowUQBjQAzAXVAfMCRAHnBDABOwIJAJ8DUgAqATkETgTYAd8BxgF2A0AAjwGCAE8CnAH7BMUDngQNAVEBzgCWBBoBZwElBBcFgwCsAtoA4wDHAAoB/wDyAdoAJQSQAIkB3wIZBVwEsARpAMcAJAJIAjMAvADDAWYDBAXxBcsA2wDmARcFMwAgBC4AoQL3AAUDQQKLA8ICmwU7AE4EzgDtA6wAcwMYAfUBHQC9AUcAgAI/AP4CJQDGAAkBxQLXALwDWACwA5cDZQSiA3QFlgB/AuIAHgE8AbADoQG/AbABCwTJATUDiAE0AuwABwRWAJcDNwGIAj0BTgMbAG4EhwDIADMB4wQ8AEwCPQOpAwMDZgMoACkBZwAIBN8DPgSWAtMCpwBwAYgBnwPmARMExAF4AhAAnABXACAE6gLeAzIArwEDAGQDpgFCAkoApAA9AZcB8ACoAU0CfwL5AKID/QAbAgUB5wJHAPIBrQPyBD4A+wFJATACrABNAqQBQwO+BQQGvQGhAoAC5QN4Av4C7QJBA/oAggECADACdAWjBWoAKgGxAeUCGwExA3oAxwP6Ad8CuQO5BIwAtQOxAY0DDgLIA90CLgNrANgCuADYATIB3QT9AMsECwH7AbQFFQbsAI8D2QGsAncFDQYaA24DIgHCAYAEKgVCAXsCIwBQABgAHgC4ANoDNgG+AV0C4ALyBPkFfgB7AsYBMgPFAbsFaAXXBQcCKwRJAH0DzADWAv8FBwbhAD0BgwQSBsED2gMJAFIASADuA6IA/AA6Ao0DzwSXBbwAfwFkA8oDCwGPA9ECkQUJAfgBPwAqAUQAEAYPAJwACwG2A1IBLwMDAIAFCwCkAMUAaQHXAHIBcwWrBdoA+gFBAJMAKgNMAysAOwSvAdcCBwAEBqMBNQVFADICwQP9A1QAXwEMAyUDlgKNA4IAfQEEACEB/wFPA/cAawMRAaUBSQA8BRwBEgT5ANECzAADA+4AJQNdBfgFIgN2A4gBlQNLAPQAkACIAiEBYAKCBDoFKwGwAXoC8QNkAS8DiAGhAW0AtwKSABQFNQENBTADXwVNAd8CjAAoAjwBBAInAwcEiwDCAyEBTAMPAR4DiQH7AmABzAJnAYEBEgSyBCgCQQPUAocDCQNRBDMBiAElAioCEACZAnoAiQDxAeoDlwGVAgMCfAIoApQDQAW9BaEBrgPXAHECPwBXAbgBLAOQBdAF7gNqBNgBhwQHAE8AfwJPBAoBGwLjAa8CEwCBAD0AZgBaAuUDcAA5AuMBHAMPAiUDHAJAAxsB3wI7AIQBHAEZAj4AXAAEAlsCDgC6AaEAAgPZAYsCDQUkBYQCrQPdAQcCCQDEA3oCMgMrAIUBSQFkA5EA8ABrBZQFJQLlA/EBBAOBAbkCPADBA8wAhwHKAxoGWwJzBf0BaQLXAAUDOAJbAmAAHAGoBHgFRAGmAnYAbgPKATwFPgHvAREAsQEeAIkDOwQZBb4AGgJHAb8DowBzAnoCHwQJAD0CEQAqAgIClgIbAHcFpgHMA9ACiQMuAE8FMgLqBFMBMgRaAKQFOQAhAdUA0QGhAHwDMgARAZUD0QU9ASID7wD/AGEAtwAEALsFNQAMAX4AkQNkAMkBwgLfArkDMQViAKQAvAB3AwoADgBZAKUA5AKmBAoB5gJ2AbwDGQBiAcID2wMMA8UDegJbA7kDFQWLACgCfACVAmQBBAO7AMcDCQDnAWYE+gX7Ag8ElQIXBUsADQHYATECaQBxAFkCEgZSADUDOwBYAg8BqQKeBPoFrwFzA+IAbgGjAUkCAADbA30A6ASdABYCoQLiAwkDHgMUAKoBaQA2AYEBQgLWBKUFygFpAvoBOQMbAfQCTwLBA5sDLQQrAa8BiwA5AuYBlASCAHMCagKMA9AC/gLIA+oDfABfBEcBjQIwAjQCCQWuBa8AhQNFAAEDRQPDAwgCQQN1AQEChQHjAwoFiQWOA6IDywGAAtUBlAPeAt8DJAA5AcoAKQMxAKEAGwD4ARsBbQMmAO4APwBGA8MAzgAaACQAGAJxAi4AiAHDARMEWAElAvQAdgPRAoUE3wL6A8wDHAVTAN4D8QChAtIAxgEwAOoC8wN1BCMCjAKCAJcBqgEqBA4AIAI0AeMDgAE4BAoAhgRaAJgEJAKsBOMAIwL+AscERwC2AKwABAOOAIEFKwFqBMMETAUhAb0BHQCZAAcBUwFIAXwCIQBqAucCOwMIA6UE/ACCA9AAOgPlAM8EaQGBAUQATgA7AJAEkQJvA3gC+wM1A0wFIQBTABQAJQMDBPAEBAF4AoIA0gAeADUDsQIwBF0AFAGLAl0DHABhAJAArwKsAhkF4gEqAzEAHgFzABwBgwCYAZ4AqAFABQcGrABcBCUAEgGsAXoCKwHUAoIAYwGpAIQByAORBYIAEwHKAKIDXQI7BB4AjwSVA/cFZQAJAjoDkAPdAewBfwDxAzMBWQM0AAMBbALlA3ABpQEXAkMDOAGmAXgEzQVFA24ErwGMBeUANAO4ARsCMwJcBPUCiQOBAcMCwwHEAWQBTgSUAL4FUwCHALMAGwHOAAQB5gF3BN8BGwJ7AFgBTwKAAloAMgOWAKwEfwDVAbwAJALIAPUFmgPuA2gC/QPBA0EEwwDTAUkAswECASQB0wEvAygCwQMSAVUB3AEDAucCBwT/AFUBqgGVBCoBfQEbAHYAbAOiA8gDIAQqAKYCCQFmAmkAEgF9AL0FDAHEAXIABwKAAg0DBAEeAS8F+gV7ACMCkgAJBAAA/QIsACgCFwLwAgIAbgR7ATkCgQOKBMMAIAKxADICCABnAEQAaQW4A8EDBwA+AO4AGwQeA4wD6gIeA7EB/gFXBI4ECQGxAkkA1QHZAYgEWgArBO0ADAMOACYDuACtAtIAxQI6AaEE2gKHBL4E6AT/AIMEKgHwAhMA8QEZAMoDcACgATcCRgS0AZsDZwDfA9YBNQWxAToElgKvAw4AyQDiAB0CtAFCBBABRQIyAToBogLwAiwATAT2ADQEBAEzAp4AQwPEABcC2QElBDMAaQBzBRAG1QB2A8IAawM/AG4ERwFlBIwBLgI1BMsFDgCYACgCiAJkAHEAEABjAo8BQwJXADkBDAUrBVoAaQBDAPUDEgSKBGsCDwQ/BfcFggBuBO8ARwNkAG0DFABtAGkBywNDAKECYwHrAeYCRQOqAH8BYANhA54AzgCxAa8CTACxAdUADgIcAqkDYAGoAmQAEgEKAccE3gA7AxEA8QOuAiEEeQDZAIwAHQPsAHwC+AE9AyUAagANAeoBQwAcAvAA4QEYAV4B/AB6AvsCPQM1AI0CjQDHAVgAZgEMAaQFIADOACQCXAJJAWMC8gSZBQ8BagJDA7IDiwKOAn4AFQPeAMMD8QFAA74AFgKkARoEkgBVAbwA9ADhAAQGvgBzBbkEYAXeAIUETwLTAgQACQVXATUD2QHaA5gF+gWWAtMDSwBPA9QBnQO7AGkF5gEtA84B1AEbAgcExgF/AiQCTwODAegEYgGIAdkBFgLzAVsDTgLdAjcElgQpAcMCMwDTAucC/gIeAJkBHgFFARQBfwNaADcDeQDzAdsAswFpBFcF/wSHBe4AlgKcAEIBSAFXAVcAlAOxAVsDKAJpAooArQBhAUwEPAAzAlcBRQPMAEkBQACIBDUC6AQHAJABiAOVA1cEqASYAN8CogKJA14BGgJ1AnwCKAKKAgkAmwPvAK8BdQIAAzcCewM8AeEBJQBjAcQA+wKhAYkCEwHDATwA8QGqAq0CIQE8AWYC5gKaAgQG5wLqAzwBTgJMAvoDaQESAggCsQLlAwMEAgDKBFoARgPuAPkD9ABhAhkC4wPKAAcCDwETBI0C0QKWAJgA9AAUBV8ApAWJACYBDAFaAT0B+gH2ACkE8QEnA4IAswJ/AqQCRQMXBTAAJQMAACQFsAGtA/EAnwMKAMQDKwXxBX0BBAVUAOgA9gDHBJ8AwQN9AeoBzwTxBccA4QDPBPQFhwDoAJAAtgTmARsCDwDCAy4BAwOoBLsFkAAqBLwCCgMHBBMEiwH0AiMC6gMJA3YDYAABBD8AqgB7AR0DGwKiAmMB+AEsAE4EGAAuAeoCRgSPAPgCBwRuBB4BdgPxAA8CCQCYAUUBHQR6AFQDlQKeBBIDygOKAPoDqgAXAhUAIAAsAMUDMQB2APABGAIuAGYFlgLGAwIAzADtAJADVwF6AnMCGgP3ADwCdgBlAc8ATQHhBFwFFQBdADwBBAR8ANQBSwNNA0QAXABiARUCGwANBoQCVwSVAM8ApwKkA18AbQP8AOsCZQF0AVUAjQCsAIwCLwPqAwkAbwLeAPIB/wEeAz4AXQCdBLEEvAA9ASwA+AO/AYkCWgAkAhsAOQNeAaICwwAFAxgBbgLgBQ0GRwFJAYAC3wJGAloCEQCdADoBbAHSAD0CmAAPAdUB7AFEBFUFtAEwAtoCywQOAOYA2gHhARIA2QBBADQCAgJDAowAkAPfAv4CugPmA34DpAOsAvwDZwGVAwQANAUlBHcEEQAZBRsCBAUJBKQFOwQEBfIEuwUpAS8BHgBiAD4AtgN6ASYDIwSUBDUCowIyArMDEADxAdoCbQMFA14E8AEaBM4ASgL0AvoDHALuA5UAEQIOAnwElQCWAtUANASwABIGuQKMA0wETwUqANkA3gAjBEsAZgIFAHEBWQAaBC4BVwGlAXoCMwHLAwAAQgIHAxEDdwKxAnUCtgTPAHcETAKAAp4D4wMiACsAVwCZASwA7QB9AysEoQKKBEgAlgKWAOwAIgMaBBsC+gOAAsEFJgA0A2QACQOKAcoDjADsAC4ABAINAZYCNgFGAmQESwVPAuYCnAEtAo4ABwF3An0D3gCJA78BZgV4AN8ACgEHA8gC9AICADEDIwGeArQCGgZ6AgcDGwDcAaoAwgDvAYUEsAGWAwoB2AEzAN0B/wGUBN8ChwQTAIcBvAKQA1gA0AB1AZUD2gAjAh4AfwUlA0EDUwAkAngCsgOPArUDQwISBA0AcgBjAiQFigCrAokAGgI1A88FCABeANQADwEgAL4ABAIlA0EAygNJAMkEPQErBKQDsAREAcQDZQFfAysB4wPOAOMChwOtAw8AoQFdARUCYgHCA3YBwwGLADAD1wDWAtcABwR/AEgBSQGcAzwATQKoAO0A/QJsA3UDfgNgBGsFtACMBKICdgNiAaYBJQDMATsA0wLDAp4EIAAqAf0AmgJsA0IEtAOYBE0EbgUbAFMEhQEDAtcAZgIbAYAC7AAqAkECMgONA8IDfwGLAkMD5QPuAH0DowQVBYkAvgQvADgFiAGEAhMAZAHUBfgF7gBCAtgF4gUgAGEAAgB3AmYAuQR8AJUATwXIBfQC6gMJAAQEAwWmBawB/wECAOYC4ADnATcC5wJfAHABmQOGBNIA3wIwA2IFkwTUBbgB3QPHAMYBpgHpAfoBqQIhAOwAmAAWAX0B0QLTATMCwwBrAa0APQI+AI8BmwWwBc8A/wALAR8C2gIrBJAD6AQJAXcBygCWAw4BNwIjAYwEJgF6AfkEYQUwAnsCEAG2BLwA/QMyAP0AawH6A+EAxQKuALICUgFPAsYB2gIRAP4BfQEaA+0CHgPtAI8BSAHmBe4ANwJLBeIFCABtA+8A1wLzBOgFCAAyAHoAUgJJAFcCPAGIARQBIASRA8UDzgBwBCsAMgMrAcEDAgAJAa0AAAYLADgBDAFMBTwA3wE+Aa4BtgDIANYBZARNABUBDgF2AVgAPQNGAm0DMwHKAcoBoQJxAIwFSQFFAq8B4gTXAQgCfQFzAwoAaAFdAuYCKwGNAg0A9gBgARMCAgD+AQ8BwwFSAeYBOQJgAjIFQwUlA6kD6gIjBHgECAbhAOYCnARABR0AMAL4AaAFnAH1ASwECQaFAa8BaQBaATUCQQMbAe8C1wBGBO0FBAYSAcsBAgAqAjMATgTDAC0DswO9AwYCyAOtA/kDNAASBgoBHgN0Ad8CdgHdAv4CyAOQAMwAdgH9A0wAUgEQAMEBXwDJAWcAVgG4ARMETAI1A58BogMVAFsCfACsApIAAwI0AK0AQwDKAdUBHAM1A8UFaQBIAewAuAGXAdMCHACrABUASQD9ADsELwF+AyoC8QKAAIAFEgErAcUCdwWzAkYDjgCmAYMETAVdAFICSwBpAaMAGgPtAk4ERwDfAmUBRgMJACAA0AJtA7sEwgWQAO4AlQP6BF0CoAXWAgUDrwHlAmIBDANMBG8EAAVrBTMBtAHnAt4DPQFuAQcC5wLzAI8EiAGKBK8BbAISAkcDBgIkApAAEgSiA34FRwCwADMAeQAXAroEIAKkAjsArwPiAlMDxwXiBd4A8QI4BGEFLACtAQIA0gRmBAAF4wAPAR4AWwGwAOoDGgKkAiAFKAVFATQFHAGVA4MAPQIqARcCDQHuA8MCCATfAisECQOyA88AxwRaACUDNwR4BPYAQQI8AZ8DFAAzAOUEGwbPANoCtAH4A/MBBwL4AUwFrwD6A+gEhgUoAGkB+QA5AusA8ANSAE0B8AIDBBEAdwFBAm4EPQNnA5wAIAPMADwEQwCSA1IA5gFpAaEC8QFmAn0BiQHfAxcFDwKzA6ICiwPVADMECgAOBAsC5wMhADwAigRUBZQAlgREAGoA4QD4ArwAzwABACQC0ATLBdEC/gJzBaEFGABoAq8BjwTuAwYE7QBSAkoDrQOaAY8EEQGqAjYAQgJ6AEICfALDA7EAwgChAkcDhwLUA4sAuwVPAngC+QDJBCoCbgTUAuoCUwF7AkICkAOVAp0D2QFOA7UBxgG9Bd4FZgHVAXUDmQNTAFkCVgBqACwAqQHTAt0DWgCMBTgBRwGFAUMC8QGAAqID6wVQAVUCtQOMBHYArwBCAq8EiwGcAugEkAVMAqkCPwDDA1sCVAWQAOMDaQVzBRsAIgT4AsYEPgLdAlYAmwOLAAgCSQDXAB0ATAS4AAMEHgBIAD8AEANSAWsBxQFCAqgA3QIbAHUAsAD0AqoAngFpAMwF9gDDASsAJgFDAlsDxgFPApwE0gSKAcIDHANrA2MB6gPhAKwCDgLfA1AAswCsAocESAAFAyoDiAN0BMcENwEHArgApQGLAHUBQwDgAioBcwIyAIcA3gDCA6oCqQM2AKgANgQSBgIADQHzAJQDqASjBe4DGgVTBLQExgFNAkgETwVaAMEFNQI6A2sDwgO1AEkE9AD4AZUCCARDAB0CzgDFATsAZQHaAP0AfgDmBI0AbQGLAPoFCACDBMgABAYrACIEywDOAAQC4QL7A7kFdwXTBZwEuQTrAO4AfQH0At0BEgR/AgkDPQE1A08C+ALDAMQBSAAcAiwAngDrALADxwBNAjMA1AI5BJUEAgCvA6oAPQEJASwDCQMyAxsCEQMUBZUFCAKQA2IBygHtA/kDBwLfAyQC7wJ0BKwEDwKZAmQAxwQNBQ8GygI0BQsFOwUTACQAjgA1Ae4A8ABdAt8CmQGvA7gA8AQeAb4DvQDJADsAFAHeAjsEygEuBRoBvQH8AOUDTwSPBGYBBALQAOEB/QADApUCpwKyAnAD4gHLAgIARQMPAmMCUQEGBDsDKgSsA1AEggI0Aw0AoAErAfED4gKBA+YBDQODAZwBvwE3AlIBRQLlA9gEMwAHA38AbAERAIkDoQAyAQgAcAH4AXoCXwD0AFIAGwJiAbwECAUVBWEC2gKHAmQEQAFJAY0DrQOjAWwFLwRNBZEAUwMMAPgDewBFAxUFrAXPAF4BkgSWBXoA3gQRAywDCQB6AQkApgFZAboCUgFGA2YCjQMKAPUBHwAhBFUBBwMzAGYCfAI1A0kAygL1AZ8DBwJFAyEAjAW4AP8ApAPlA38AvAENAXUB+AI9BNMCUQQeBYkFWgBeAGEBPAIpBCoEqgH4AecCLwOqAeoCzAFNAjkCaQU+AosEGQOMAwUDgwMFAQYCMwJ3BFMAnQCBA04EdQLPBHoCawPLAGACYgE9A6QCqgTqARsCsgLjAwgAGAD7AgADjwAvAwwB+AGSBKEF7wHvApkBrwFyAOACTgCmAM4BDgIyA24DGgEhAXwB/gOhBA0FAgBqBMkC3QKNAJoC6gLxArEBHANiASQFCQF9AwkBMgOoBOsFsQBmASgAXwTwAgQFrAD8AxYBKgErAcwDNAD4AX8ArgCdABQFNwWTBSQClgKWAmQDXwVrBWACCAQTASUCkwO2AwoB6gEgAMcASQHjAbkEoQW4AHABtQFNAsICQAR5AIsB9wCqAaECzAJWAJADegG6BMIAhQHMAIsC3gJuA9kBcgOQAP0AmQHUAq0AFwIEAYEB/QB4ApoC3QMvAwcEWwHeA30ABQHWASYC4wDgAfEBIwQzAm0DqASSBZEAfAEwA6UF2gBaAgIAtgS5ARwCigAvAbQBbAO4ADsEdgDGAQAAIAMmADMBFADGAgoBjAJ7AZYFkgDPBOsDoQRJAN0B6QGHAmoCiQMDA7UDwwGIBIQBawPEACoBCACNAOYCJwPMAw0FXQIAA1oAnQDTAuAD9AAtA1IBZwMwAHABzABdA6ABywUkAKcBxQJPBL8BRgRlAXMD2QDuAJIE5AQ8AG4DMgEVAgAB3QIpANIEowKyBKEA4gAgA6EEWgDtAu0CfwNHAHEArAJFA4cAeAR+AqsCugPOBLQBygG6AuQD2QEnAx4AgAOQAGsD6ACFAYkAtQE8AsIFaQE6AycDwwMUAcIDiwFBBBEA2gA+AAAB8QH6AqUBzAOQAPAEcAGNAyUCjAPOAGAClQPKBYQCogPZAW4EzwDgBT8FrAV2ADMCowCwBAcADQJpANMC/AAHAsoB+gIwAkIEagBQAWEAcwU8ABoDZwF+A/gBfwXwAvoDwgDZBEQBLQWiA4sFLADhAmQAgALIAAMEEQCpAnIBTgLQAjIDRQOHBAUBTgQ7ALEBxwAJATMAgwMEAGAC9gBmA3oBkAWvAaICMwPKA/wAjwM1AUkBNQK8AtsD7QMNAjUFIAA3BKIDRQUjBaUFjQKzA60DQgQaAloCvQFQBPcB4AVTAWIDKwAwBZoCOQNaABgDQwLXAvUDBgTYAcEDbgDbAH4AIQEAAOACmgIRAwMAswMhAC8DMgB4BCsEGQWhAdUBbANmBTcCOgNgADACDQE8AoUBZwMlBLAEkgS/Bd8CfQS/AX0DEQBuBFkA4wICAk4ELACeAzMAbQOtA9kElQMzBTMAaAKrA74DggEWAgAF+gXZAT4EiwBrA2kF7QUzAgUD1QGvAigAWgUnAV8CUgEDBAIABANIAawEQwFUAUgFWgUtACoBogOsBREAEQN+AFAEwQA2AY8CvgShA6oDFQKBBdEAGQJLAeYFyATMBDsAlgBhAe4D3gBJAaIBogIsAI4AlQDDA1kAswFIA/4D+QBCAqMBEgP7AY8DgwKhAsYBLAMrAWkCbgNRBJQAEwMCAKUBggAbAhwAIACVAKsCkgBNAuEA2gIPAYwDrAGxAkUDiQMuAK0BYgFGBB4AyAA3AZEFBwCOBXEEnQUHADoFrQC+AWoCLwMPAaQDQQAaBrAACQH3AM0EYQC2ASACmgIwAOICJgP7AwoAUQKLAAUBjwAOAQIBBQGNANMC9AJtA4YFywUCAK0DYwEnA7wAKQRnAswDFgKIBM8AQQTCAJ4DowAzAhQBKAJlAD4C8AD1AbwAYQJ+AtkCagDOAP0AlwGuBQkGPQFuBG0AEwE8AUwDwgLaAgkAzAF+AB0CSQEqBCEAZgMAADICdgDJAY8FGgaKAJ4AdQI9AzMF/wUOAJ8CMwDyAREASQUrADcE4AClA2EB4wEkAi0DAAELAigCygM0ABcB5AJdBKwAvgWVA5cDjQD/ACsBaQF1Aq8DewAnAQwB2QEdAmQEJgJsBDMAPAIaAjkCZQGPBBQBOQRXBPIEfAAlBBEAFAUqADoA7wDmA70BMALTAZYC6gKUBDAFEgZNAbMCNQBYAJEA1AEyATMBVwRrBbsA3QOLAXcCxAFBAhEDdgOqAC0DpwCvASEAvgKLACoDWQGABFIB5QNDAKoFqgAZAv4BBwJ9AUwCvgBQAbgADQYeABkFrAEqBEAAtgNgACgB8QCbAzEAIQT5ANkEDwCJAlUCvgSWAkEEAgDRAB4B6wJuA98DMgEPAiwAfgCTAX4DuAAHBIQBsQLeAh4DxwBjBEMC8gN5ALABywMfBRMAJAEFA2YDGgPdA24CcwWYAJoCqgDlA3cEFwXaAHoBGACQADwAjAVpAcIDfQAYAs8ABQKUAIwE2gGQA4sAOQREAWUEQACoAGMCpgT9AFcBMgBXAewAXgJABYQFHwAlAkkAXQC+AD8CrQADAokAFwHDAFYB7AHzATAFrQVFAcoBQANPBYkBBwR2AFcBMQFFATAARwNqAPABbgBzAXoAOgLdAuoCWgKMAj0BFwKKBJIEdAGOAewA3wIzAvoD2QHDA2MB6APhAA0GTQH3AbYAlQInAFkB5gJmAywA8QB5AIQBWwKhBQkAcACvAwcEBAIMA+MBjQOLAYgCEAAbBOUDsAR5AI4EIQDeAqoCrQPVAfMBEQB3Ah4AxQJ6AicDewHtA+0CBQPqAWcDQANBAyUDWwMbAboE3gDhAVMD8ANJAGsDUgKXAiwABgRoACQCGQLcArYA4wAoAosCtgAPAV0AcwEQAAkCDwLLA3gCzwQqAfcBKAKOAxwB0gSXAPcBxgCiA6gFtwU+Am4ClQPWBDMAdQGPAMMAWgBBBMQA7wAQAKMBFQXrBccATwKSBJ4EOwCDA1sDrwPeAxkFwwB9BDwAyAOVAKMA7gBTAxAAlQSlBesFMwBIAn0ADAUYAPgBwgBbAuECngTlBF0FQQLLBDkDBwR5AJUEdgH9BBQBTwMeAIUBGQLmA+4AaAJIAX0BvADDAGQE5gSDAFUBrAD9A2wD2wMhAE8CoQBEAUUAfwCLAgcEmgLmAtQF8QUgAMkAWgCkAqIC+gNYAFoANwF9A5YEaQV2AysErQCYBIMAIAJ+ALcEcQC4ACgC+QJ+A3cEHQCWA/wAlgKPAVICXwDLBOsAWgFCAnsC2AE5A2YE5wTVAc0E8QCZAtICBQO4A10FBAP6AzIA8wEwAA0BswB2A10AhgWaA7sEfALUArgAwwFDAM0EWQUEBvYAJwMRAGQAwwJQBNkBDQPqAT0DPQNTAykBMwHKAbcEYQLHBKwABQNSAYUBGwFJAWMBsgPXANQC7QDdAg4ATQKYANMFSwAcAzsAIATSABgBlwDDAbgBfgIvA1UDlgDoA7QBlgMRAJUEHgODA54ABAKmAe0BMwFTAd8B3wO4AHoCNAE8AtsDZQRSAcEDRwDyAywAewKJABAD/gIHBD0ByAJ9AS8D9ACVAl8AgAJpAP8AwgMgBCMAIgM2ACEBvgAdAzcC+gJxAHsAkQApAeEClQNXAOYCDgKJAwIAQwLaAhME1AGnAjQB+wK2ATkCrAB3AyMCbgOjAOYCeAIEA5YCIAS4AVoCEQDCA84BHgMzAO4APwAEAZYCZwMdACUDewDHBM4AIQG0ABMDfAEuA1kA9wExACUCeQCSBJkBngKkAMcApwAJAXMABQOuALsEugQEBnkAQAGsAH8FOwDmAt8A3QIuAdIBEwFmAwkFPgWQANkENwLWAqUEbgU7AAIClgIeA9gBkQUOAMcAUgAXBakDOQTTAvoDZACJA7AATQGmBagF2gJRBIEB9QGOBeIFSQBYBEEADQUMAW0DlwGMAs4B5QMYAZ8DSQHvAeoB/gL4AaQFNwF6AlsB3wIOAOgF8AChApIAVwEEAM4AZgPeA9UBywMHAncCBQMZBTkA8AAWArwC3gCLAl4BjAN2AUUDBQMqBB0ApgGKANwBrAIIBMwDvwRwAKID6gHYAxADBAawAD0CVwI/BYcAtQGWA/IEKwWCBa0DRATCADcBugI6A5UACgH9AEUDNQPGBN0EDQUOAisEMQIcA5YCQQNkBFgFhQGAAo0AsABIBPYFcQB9AWMDfAOfAJ4BUgGJA48B4QEcAsUEKgAzBd8CKQSmAYcCWgDxBQ4ACwZIAYAC4gCVAogC5wLQAq8DcgB9A5AArQOVA7UEHgAqAtAC9QIBAcoDXgCqAcMD+gMPAP0C0QDjAcYBsgNmAAIBuANzBN0DFwWKANkCkgAlAY8BUwMJABsACQRcBWkFCwYcABQBswK+BZoCBwRmAjsDHwCuAnwAQQIgAisFAQBZAjAAwgNMAg8FcwA6AjYA3QGsAuYC5wD4AloAnwDXAvgCIAVsBfYAOQGxAWYFEQBwAjEDKwQ8ANoDawF0A60AzAFwAdAC3gDHBPMBsQJ6AtcCnwGcA5QDDQVoAP8AMAAcAbwA6gE6APoFjwN0BMMAyAJTBBcFNQI+ApYATQI2APUBfwARAZYAfQQCAIsAWAAkAioC5wI6BGgEsAHVATwAiQOVAKoAdgFcAnoBNwQ/AEEETQBsBCMBDAaeA0wErgBiATACoQKzA70EawDpAZQAHgUPAd0D1QDeAyAAPQCyBQQG8AD+AwcDOQNIAA0DxgHCAh8BUwLYATQECQJdBMgAlQWPAscDPQHIAywAKgPmAQcENACJAB4DFwXVAG4EJQP1A0QAqQSJAvUDjQIkBcMB0AL0AzQF9ALoA8QBwQNJAHUB5gIZA7gAxgEgA5sD+QAIAkkDkAOPAAMD2gBPAhAAnAOMAMIDEQDvAH8BegIhANUAKwCDAC0AhwAPAKYBSwDXACUB2QEbAPEFIQPHA9AAtgOXAdoDMAEyATMFiAVVAfoD9QI+BMwESAWxAEcBeQI9A4UD3QP6AmsDwgB7AsYBNwUpAe0BxAHBBV4BmQGsArIDZwD9A3UCvgIEApMCYgH/AQ4C8AK5ApkDEAAMA8MAwwOVApoEqgDfArEBegKzAm4E0AJBBEsAZAA+AlUCfQDXAfoBAwKVArkCEAA1Aq8A4AMzAWkBlgAFA6wC9AJ1AYUBLwPHBI8BNQKdAAkEgAWBBRsAfQRbAdMCYgFkA1ICsANpBPoFHQB5AHwAzgCKAAkD2gDxBaMAVAKJAKMAwgLlAygA2QIWAo8D3gB5BBkB5ALvAm4ECgBqAFgBYQI2AOsAjwADBDUDzwP4AggGcAC3AGQAAwJwAfEDBwQ7BAkCKQI0A4EF/wF3ArgA+gPVAIQBfQAAAR0AOAH0AIAC0gCdA7MDYgRBApYE+gIIBWQEPQWwAeACNgDtASIAzAFMAZcBwwJXBf8A9wGNAMQBjwT8BIcFCwb8APoD2QF2A14BZwHmASIDIAIEBoIAVAKDANQABgIqBJAApwCvAbgBnABeA6ECQANkAQgCMwDtAmUB0wEyA48E9wD3BFsDBwQoAMMCkABZAiMBNwRkAOYCjAAcAQ8CQgKPAMICBAC9AaoAtgCHALAATwRWBbYAsAQsBYYFxQIIBBsBngIBBAkGZQHfA5MDyQOsAEEExgETBP8AgALUAXUDFgN1A3wAMgGOAJsBNQJzBTcE6ARHAMsEBACSBLwCjASQALgA6QE0ArMCEwQRAFgAvgAsBVIBBwMeAX4CeAJFA38AYwKXAEMCrgDjAVgAKAL7AbEDTwBUAFkDxQMvBBgF+QCVA0cAbQGMANUAiwAJBSwAkQBgAJIEeASPBH8ACgLQAnkEmgIEBQUBcQQLBeoFHgCVBRsAiQF9AWcDNgChAu4A8QGqAsEDigAIBEMAqAFSAsIDogIRA74AkQIhAEYC0wEIA8IC3gNIAfACUADYAHoCPgQbARkCQAHgAqwBHgPlAwcE7AAvAwUBOgLXAEED5gEaA7AA+AGpAeMD7QKNA68BCAP2APMBrAHlA9oACgHvAggDrwDoA5kBuAFMAhkFHADLBTwAxwCLAXYDzwBPBHIAsQIUAQYCDgPfA5gAIwIKAVoC5gEzAoAD+gOHAeUDVQGkAzYAkQCDAQwGPAE3ApwECQYKACED9gB3AksASQF6AsMDkAWmBWUBBAOtAPQATQCTAxEAoAXYBeYF7ABeASoDnwMMAXoCUwB6AiwA7gCIAfkDLABgAe8BbAIKAXQE9AAjAjsAXgQCAKwBRwPLA7YA5QOzAgQF+wHdAuAC+AJ6AHEC4QARA2AE7AVSAGECbQDrACsBrQLsAKUCFgKwAlcAYgG1Ac8E1QFUBZ0AegJeAQQDggDqAzQAyADPAHQEygOPBa8BJQKsAscEjwBMBfQADQMwAjwF5gH6A9UAlAQRAHEEqAAkAkgA6gNmAokDrABrAYgBPAJaAFsDnAEYAlMA9AB5AA0B1QGuBF8DAwT3Af0DDwHaAgIDmQNqABgCGwB/BRAAWgGWAm4EegJ5BKoAyAMDAuUDsADTAscANwUTABQBJALIA2QAOwQZAO0A3AF4ApAA0QDyBCMFHAGOAywARwEwAdUBfwDpAfcAgQNfAPcBOgLqAo8B6gLdBI8F6wSqBRwAcwGQA3EEogNxBSYBBAbTAigDiwAQAc8A2AGMA7AEBwXgBUUBqwPJAEsBegL9A0sAYgG6BQQGtgUBBvgBZwT7AR4DYQIsAyIAxgAbAdoDAQNkA6cA+AGVAIsDgQGGA6wA+wO5BPoFBgKCAyAAqAX6AX8FVgCVA9EBBwTfAFwCwQMDBN4AfwOQAzMFOAEoAoIAAwRkAeoB3AP9AwkA5QFSASUESABwAUQAYwDkBfIFzQBQAfoAIQQxAIwDrAByBEsA7wB2AHUFTAKWApYADAGIAakDLwPeAzMADQOqAo0DGwFfAyABdQI7BIwF3gC8AgAAEgRoAkcDggEeBXwALAP7Af8BbwDZAHwBYAK1A74EwwAPBc4ANAU4ApUDVwA9A8kBEQPPAAcE+QDjATMAjQJhAtMCwwFRBAcDJwMbAS8DfwCFAA8A+AEJALMBpgH4A0AD5gOBAV8EpAJfA4IAxQJyAO8BRQOMA94AOgJMAXUCdwJbA30BEQPtAt8DQwPEBMkBAwP3AXUCkAATAUABGQIcAoYCpAMTBBABMQM7BKwEtQHwAvEAJwRhADUCewDUAKkC9ALCAAYEZwCDA4wAOgL+AbECWwA6AhQAgQNDAt0CDQGpAzcCaAKNAPgCEQUEBvACywQHA8sE8QGpA5IAgALYAfQCkgB9AcMBcwMXBEwFBwDoAKUADAJlAQQFOwAlBPwAXAJzANECOgJbAsQD4gNIBdYF7gDgAl4AEwFMAoMDCgHCAmcAQgP/ACoE2QDdAn8B/wGeACoDcwIiA0kBJQPHABIBGgKaBBIBJAIFA5QEigIbA6wB0QI+AAsBswDAAsMB3wMQADgBdgAWAiYDuQU3AXABPQOyBK0AogIhACoCBAFcBHsAOwQKAWECTwPTA5sDxAP4AbMCCgCTAXYA3gOmARYDngCSA+4DTATLAw0FCgDHA4wA+QIwBfUFwwHJARUFYgU/BRAGZwCOAegBigJFAtQCogKzAtEC8QIFATEC8QCwA48AkgCsAosDIwL0At4D3wOrAD4BGQBYAF8AJQGfAK4A9wH4AaMBYwLJAeYBjANWBNIAEwQPAJYCmAAEBisA/QB+ANUBBAKeA/IEMQUYAKoAygCIAjoDVAUYAZsDpQW/BXkAewGQANUBRQMjBAsAJAPeADAEeATtBHoBnwJwAdsEPQBuAHkAaQLDAYkDBQN5BM4BfgLmAxgFewCvATMAcQTcAQgEFgKfBI8EMAWpArAEZQByAYsAkACDBeMFkgDFAiwDdAQBAIYAGwHoA1oATwFEAOAAqgJOBI0A4wAvA4kDgwOUBIoAkQD3APgB+QCnAZ8CBAb2AOACOwRuBHkALgVsA/ADMgA2AXYDBwRTAKQAZQCUAHUC5gL4AQkDqADvAIsB1AHwAroEAQCkBWUBGQX4AZEEiwE3ApYC+ALOAawCVwAzBAQAuQOABDIFPQOKBKwAdwXYAV8DiQMpBN8AJwEYAF8AcgAoAm0DcwOWAvEDZABpANgBAwTzAdACkgDeA2kAVwHpAaEE5gHvAjwArQApASUDDQGqAXoCdARkANoCwgBEBeMDTAQ/AN4C0QB1AZYAQQREATACDwHCAlcADgOLADgCFADjAewBzQT3ANECYwLMA9oBNwJNAg0GLAMaBO4AUwERAxoDiAHFA8cAvQKWAiIE8AL0Aj4CIQPKAfYEOwR9BAAA4QKxAjQEzABwAacB3wMyAtQCNwJdA3YD9gMbAdkBhwEvA8QBBAb2AJoCPwB7BJYAgwOMAesCHAFsA60DMwXYAfAC2QFcAi0A6AFfAFcBlAC+AD0B2gOtBNIEKAL9Ah0AeQKjAAMEAQBiAEkAEAaJAYACTAEiBK8B/QMcAcIDZgJOBOYACAH2AD0DawPSBA0BjQKaAUMFSQBvAxUF5AUAAWMDUwCNAIUBBwL8AD4EGAGkA+cA6ABjAXUCxQKkAz0E4AXiAaID4gEjAnsAkgCsAMgAiwIEA8kAkAEeAaQCSQA9A1oAqgG8AgMDZwGbA4wA2QFXAIgBaATUBc8EBAVzBfsFkQBnAn4DmQNVAakCkACzAuACJwM8AAcDPQJ4AtECNAQSAQMElACDAZ4BxAGXAX0EeAJ7BBAA+QJcAB8CwgK0BP8B9QIIAD0BNQDKA2oB5QNABZ0FRQJrA5sEdAW7BOEEAwKaAjwC+wIEAKUFoQJBA4kAxATbAOcBsQHqAfgCvgUDAPEDxwDfAgoA2QKlARkC7wEoAnoBeAIYAZYEPwApBCQAOwCfAFkCnADxANUA6gNQBFcEwwAnA68A/QAqAHkAkgC2ACEArATHAAcDbACPAT8AwgJEAIkAXgHAAmUEtwThAUMCEQDbBIcAEgYTALIAaQJsA3oC4ALbBKQFHQBAAw0ApwGcALADbAGzA/YENAUlAFABLgFDAnABGAMoAO0DyAPlA4IAKgGVAowDAgAYA9EF+gWWABQFggAlAu4A+QIcAqoCSAEHA1wCYQJpACQCDgH/AWoCIgMtAIkACQFzA/cD0gQJASsBEwBFA+MAjAKOAJkA4QCAAnMF0wVSAHEAlgDgA0QAVQKZATIDTQF4AjwDdwQoApYDCgFbAUMC1gI9AQcDGgJuAlcEmQUTBcUFLABKA3sBQQOqAAUD/wDTA7AAugTFANEEiwC+AN4AdwIyAOoBEAFmA68ATQL6AU0CDgCwAO0AtQMuAAsE0QUJBggATwPvAYoDVgBpBcgAxgH1AuUDKgKJA6EA1wWUAIAEOwOJAzAAQgIvAQIDfQDYBWUCogKLAboE3wNWBNgBWAJJAEYFVgBTAgUDCQPYBQcGNQD9A2IBaQPvAvoDEQCZAR4AlQAjBcUFbQMJBGABCwSJBb4F6gOMBQcA6QFmA2sDQQJdAqMFrAVlAbIDigAbAaoBRwN8An0EAgD4AqIDkgUhAWABpgF3BMwAKwS+BJAFDAOtAxsAlgQ+AQcEJQOzA+oBAwOQADkEIgDBAKECIAM3BJoEtQUPBl8A6AFHACkEjgC6AFwBAwPRAqkDTgJJA/EE7QUyApQDXwD9A/4CjAMWAi4DrgDhBKwA0gCkAroEEAEHBGQEUwX/AMsEegFRAn4AfwDfAgcEzAA7AzABYgF1A5EDdgBhAjUBjQK3AKABIwJzAlsDrQMNAFgCjwELAv8B5wL9AZUD3wKyAzoByATsAacDFgUBBlsCigT2AJAEJgDVAQkA2wAgAt8CJAUaBisATwHFAeECZQGJASAD8AOuAMoAegMeBAwBFAX/AW4EdQISBsoB4wERAEECBAHZApIB+wFDAikEogJ1A6IDrQQJABgCNQADA8gC5QMSAGoAjAC+ACEB7QPTAi8DJgIUAz8AdQNiBIEFMgCXALgABwM8ADkBsQABA+MB9wTsANMC4QBGA/EByAN/A04EVwDXAtwAPgFKAJMAMgMTBJwA1QFyADADIwIiAxkCDwTvAuUDygPABQ8AUgLyATcCmQCIAZ0E2QU8ArEEXQLaA2gCygN9AcEDegG1ASQCNQMtA3EEkwBTASsAxQJ4AowFZACvALEBAQPvAlsDwgS7BegASAFVAY8D7AA3Ai4BTAI8AOYBugTPBHEArQBMALsEewHbA60A5gKvAfMBvAUPBnwBOgM/AE8BjAFRA9cELgVpAbQC1QH3BBIBSAHsAaECDwLCA/MBgAIDA48DEgIlAxAAMwB7AP8AqgDxASgABAHvAP0A7wAkAjYAwgEQAEkCtwTyBD0D/wP3AEcDyAPeA68BeQQ1A20DJAL9A7sAKgF1AYgBbQN9BNMBbQOhAZMDBgFJAnsBnwOlARwCCQA0BfgBgAKoALYDOwCdAvAAIQHqARMEZwPuAz8FRgWvAcIC0AELBD8AgwNEAcoB2QGQBEoAyADRAJYB3QNcBNMCgwRTANkBGwKwBGIBGQImAGIDvwKNA0oADAFLAAUD5gCQAVoASQUVAIsAyQQuBa0ENAX3AIgBMwAUBfQAwwNnALsAcgDKAPUDtwTRADICDgJDAykFfAVjAXwCrQOOBJQACgUEAooEdQLXAu4AOAHJAiEDsQCwAYkB5gGXAeYCMAISBOMBdQKxAWYDGAIhAwYCtgOmAaIDJAL1ApIAEQOiA9YEGQBaAZYChQRSAXUCmAA3BBgARwCYAMMA9gDBA48BcANXAPMBogD2APQAsgMQAJYCzgAaAVgAaQE0ALQFBAPIA2oE8ARaAN0FYgGnA+YBTgNnAMgDigEMA4IAdwSQAMMDrACqBMADegUuAJMCVwAzAhQAcAPGAQQGjQDgBV8AswJ1AtMCAwQEBQkBJwOtAA8BPgBcAucA+AFMA8UDIQCAA0MA3QFJAfEDcwA+AWABcAOwAFUBwgLTAvMASAGIAUwENQNTBAwBrwFVARMEiwHGAzcB1AL1AisEZAADBG8DcAPeAIMDlgCMAx4ACQQ9AeADXgCJA1cAogC3AzIEygK5AywAkAAaAlgDLACmAQIAHAIuAv4CZQRXBQIAiAIOAvYDwwFPAzYARwM3Ad8DlQJRBFYAngA9A7YEFwEEBssBdAPyBPQExgFGA6wAxwTHAFoC/wEwBMwAqgHRAhkFCQChAjcAPQANABoA6wFBAisBUQEOAp4CKwUEBrgBzgGWAq0DZQQIBdoC6gMbAV4B0QBMBKoALwTsAKwBegGDAVoAlwB5AKMCDAHTAp4D9QP2ACsBFgJfAisFFwaJAfgBIAPkA7gAmASHATMC3gMlBPcBNgLSAHMCoAPmA30BdgPIAyoEGwIlBDQCfQMQAMIDNQAbBDcCJQV7ACEEZADiADUBKQJLACUDwQPBBUsFGgb3AEcBOQEHAsMFFgZ2AxkFWgDqAhgA/wDZAFwCigHwA9cATwMrAIYATwFXAZwDEgQqAgcEEQCtAg4CBAM8AVsCUwOfA60D5wS4AEwC3gA5AQ0AAgGqAJYCMAKeAzMB8AOiBdUFjgD+AfcA4wOLANkEsAANBnMA7wFJALcEswFCAioCZgL4AjkF1wAFAUwA2gCJAKQCYwRlBfgCuQXaAncDSAWqBZkB4ALHAN4DawMrBLwA0wISAS8DzQX4BTIArQDaAOoBfwCbAdIAMwL2AD0BZwKhBHABBAI9AVQCYQJ0BCUBTAKhAqMCEwA3AXsAWwE/AM4ABQFcAhkCTwUTAO8BXwAUBawA3gKBAVwE+gAhA6sAAgH8ADED7wBDAqQAxQB5ABkCIQFnAZoCbgRgAUADHARDBC8EXAUrAAcDZwDnAiEDjwQ/AJYCHQBFACsB+QExAiAElgAEAzcCTAIoA9oDTAKHBDACmQUKAXoCjwGzAXsA5gHjAdQCEwAbAYcATQJeBdgF5wLGA2oAPQJDA3sEUgB3A38CQwOyAvsCSwCkBXgDGgRuAJAFAwIkAioBlwFtAnUC9wFFAzIE8wUHBSgFMAA2AOMB1wIPAasBUwGNATUAKwGjBQkGjgABA54A7gDFAO0AywB4A2MB+wP9AB4DBAIHAqcB0AI8BasFUgGaAkcBzQTjAZYDsQE8AtYE8gQzAPoDGwA2AisFkwV9AboE8QBIA68BsQHUBBIG/QBYAewBaQI8ARoC1AHwAusD3AVpAJ0A8gRXBQcAzQURADYCHAF9AxcFGQVLAfgBwgSvBYsBQANEAYIBqgArBCoCcQQbAFYF2wPiAxgBlQJMAsUCsABPBOkBmQMrAOUAIQBtAYkACwOHAV0DbQCIAeoCqQMBAA4BTwLQAgMC3gNAAHIBwgBEBGoAbgJXAgkFLQBNAs4BQQKOAJ8A/wADBCoBxQLxAZQE4ABaApIB3QLmAW4EkgAEBowD5QMIAFkCOwCpAxsBYwFyAIoDzgB/AuYDSARWBAEFcwBJA2EBiQKPAZECwwCPBMUA1QFnAQgEywNkBKoBgAJ9APEEIwE7AY4AHAVmA8IDWgJ4A5kBmgJfA8EDxANaBcMBLwPeAgcEtQNOBJAADQNGATQCkABMAjUBUwG5AOIAZwCdABwBNwEHAt4DiAHbAzsAGAP4AdQEUQJpBXYArgJ2AAkBwgBSAqwAOQN5AHUCGwJ2A0kBMgLsABECWgBFAzwAcQAmA7wFBwQjBOoBiAJUAPgFbACGAbAAbQMiAM8EQAB2AMgAdwU1Au0DEQAgATsA5gEAAMwDSQChBWAAjgPNBdQF5gGkArcE0gTtBN0FxQPiA/8AQQSaAtoD+gEEBecC6gIrAAAG/wBIAuYCBwPaAf8BmABNAlYAcwUmACgCTALwAvAABgPtAI0CZgJxBOQEPwUcABgC7ACxAgcCcQR7AHcDcwV+Be8CjQNnAsgEZAPMA0YC8AIxAjkE1ADFAVoCEQMFAT4BMwHbA5QAcQLjAMkBPAAQAQQCZgWCAOUCGAAzAJAA4QSNABIGSwAUBZcBGwJaAOYBXgBSAfwAQAU4AWID8gHdAm4BJQIEAuICCQGpAkECwgLvAHABOwAJA1sDKwT4AScDXQNGBAMAbAXPAIsBRQG+A8MB8gFHAHgCfQEHA3wAMwIFAVgCegLtAt4AWAL6AqIEJgMRBhIBywRUATQCVQFPArAEBAUbAbEBmwNfBfAAiAEeAFkCcAESBG4ABQE+AKYAbwIgA4wANQKGBB8FeASCBa4AGAQ/AAQF3gAIAzICxwLrAPEAuQNXBEkAbgAoAHwBZADfAikBQgS1AcQBNQBXAQECBgScATkCRQC0AvkAHAPqAUADfQEiBEkAFQVmASgCCQFtAa4AOAHLABgBgQGDAmcCxQMhAJAAEAAcARgAZAD/AR0DWABZAooA7AAAAA0FgwTBBc8AHgPeAKoCigAPAY8B6gEhACgDKwA2AXcFsQUlAGcAkADDAScBWgFSAZYC/ARdBY4A7QAyAbQCBwCTAGYClARMAFwFbAEFBA0A+QCsATcCUQIIBOMBzAPUAIwCAAAlA8UBpQUbAHsEDwDbA8UCAwSuAOMDAwCBBWsFvwUEAQ4CMgJpAggAXAFMAuoCLAArAVcC0gTeBRAGQwJHA6gEpwWEApUDVwCzArEAoQIAADMBbgC5BKECZQRkAa8BQgCyAEoAOAVLAeAC2QA8AVYA4ACrASwDWwNdA1IBcAH6AgkG/QAkAlIE0wXaAQMDWQAhAQQCaQICALgDpwIsA48D5wOvAQQFXgBMAkwFpAU1AEkCkABkAYsASgOWAJkBkgD1BY8A/ADXBDwF4gP1AwQCUgL0AJYCjwHjAw0AiwAzAZUD9AQJBTID5QPvAGYD4gAZA3wBVQLCAssEkQDDAugAJQNhAL0FcQAbARAAkACDAE8EjAGkBK4AJQMHAm4EuQIgA3oBCAQlAF8BZwDTBGYD2QTwAo8E4wBbASkBoQTeAC4CCgB6AGsBvgUxAmYCSQXbBWABBAKzAiUE7gASA68B3gLOAC0ENwJAA14AJALbAM8ESQH6ArgAjAVpArcEQQAiAy0ABAZLAI8BnAE+AjwCCwTQAi8DYAC3BHwAkQC5AeMDfQEzApAAwwDeACYExQGtA2QBiAKsAAQB8QFBAxcCBAaNAJYADwCBA4UB8QGLAXMCngDmBMoBywN6AqwEUgHwAt4AJQUPAUwDWAAlA/cBQwPPAOcAdgThBHkANQLaAQYCNAWuBQQAqALVAY4D4AAQBuwAPgTDAuIDAQQVBWUEPwXZAQ8FDwF+AvgBqQOTBZ4F+gJ9A6IDhQVIANgBswK6BHwCxwSqAEECEgIyAv4COwQEBVYFBgRMBDMA4AJMATIEngA4AdoAGwIKANoAmgPhBCwA8ANhAJAFUgH6ASsA3AFaAEwF4QCYBCsBVQQzAQwDoQFTA9UBzAPzAdECngC0ASEBUAScA7IEggQXBowCxQIBAMgAyQDdAFABvgU0AP4A+QA3AU0BwwFxAu0D2gDPBLUBggUcAdEC7QBpATMB4gN/AhoEiwEiBGQA3gADBFEEzAACAgoAIAIvBEsECgHyA/cBjAXqAgQDmwFnAqoA+wLnAE8CsQCJAj8ACASqAVMDXQLRAt4CJQSzAiIENgWpBaUA5gC4APAC0AHjA2cArARBAvYDegJuA3cBrwHxAUsCowCXAQoFaQX/AXQEogQJBhsBGQUAASUCagDGAAQCswP9AA8B8wF6AiEADwVNAA8DCgCMAjYAgQFtA08EiQHRAnkDkgSAAisEUQHjAwgCggMbAFwEkAAvBMcACQMYAJIAFwAcAE8BwwEjAH4CAQATARwAvQWLAQ0DPgI3BKQA/QM1Ap8DDgHVASwA+QA+AAcGmgKMBXoCdwM1AYgBDQIpAgMAEgNCAlICIQGyAs4A1AGsAkAEOQErBGsBIAI7APoCMAGZAvkAOQTaAPgBeQBmAz0AVABLADUDOwCJA7AAEAM4AcoDLwR2BEcDbAN5AO0CkACVBJcBOwRAAIIDQwANBJMEXQX4Ae4DMAFdBKcBKwTqAsMDgwT1BSsAKwXhAKkCsAAbAkkArgNtAIUBKgIvA90BbANIAnwCcgCEAfcAcAKUAKQCLgU0BRcC8QX2BAkGCwLJAmoANQJtAIYBDgV0BWwBGwVzAvACnACeAKcA7wBGAl0CgAJfA7kDEAZwAHsBWgC+AqcA6AE5AgoDuANnBN0COgPpATIFFAHtAtMCJwNXATYCOwM7BOkBtAKKAP4CaAL7BJ8A6AD0AP0DmAC+BAkBBQPaANoC6QGABNoDEgZWAI0DDgGIAWkAgAKiA94FNwJ0BNQAfQLKAE8FgwG+BXkAeQKaA+sEKwBIAIcDqQNbBRIGAgBnBCAD3QR9ACYB+QCjAw4C9QI1AHABPADPAIMBdQJWAMUDEAA3AhIB8ALnBPIF2gCJAdcEFQWVA5gFKgEbAvwBWwL6A08EkAKPBGkA6AC0AfIEiwEyA9kA2gE8AR0DsAGOAzYCvQI/AIwCagL1AtoAPQKLBQkG6QLNBEsA3wD7AxIGEQA3AyIAFwHsAKwCNgAgAzQA5wC+AEEDMAJbAq8A+gEpAPoFqgCtAiAFgAUSAfoB2gIXBVoA9wDRAIUB+QKtA1cA1QHTAqwEMwKnAhsAKQRvBOEEMwClAXIA1AJuAwMELwVrBTwAvgWCAA4CTACvAYMArQA1Ao0DDgARBewDgwRJAWkBPAAeAyEAbgQJAEECjAB6AooB3QEGBAsEiwEfBNoAxAE6AlICVgGkAqYBQgRXAK0DlQDdAxEBzwRRAXABAwPTA2UAowEsANsDGwB4BLkDCAXgAHAEhQE5A7kBFAMMAcEDdQC4AK8FCQZDAFoF/wDCAnsBBAQAAGYBJQO/A4AC+AJtAJwA3QLoBCsAfwWCBCsFpAMlBJ0AYQKsAXYDAgKNA2wC3gIuAJMDBAIqA6oC1wICAAADtQEXAkkA9gRlAOQCdwPlA+YDsQQbAcYDbgLLBToCOQR1A90DkQBnAVcA/gFyADMBHgCNBAkCRwLOAAIEYQEyAjwA+wMoAkIEXwDfADQAWgBHAZ4DQAONAzcF8QVLAK0DygHbAzYAPAEBAMEDmgIXBZ0A+ALmAZoC0wHnAjAC4AJ0AAMBvQUQBrQCZAR8AMQDUgJGBFYAWQDiA1AEZwHtAzUB8AMtBJ4EDQEvBBsB3wFYAHoCFAAWAOkBzQSxAUMCMwIZBXEARQMQAFcAfAHkA0UFngUeAE0BQgLDAswAggMCAGYCfAI7A0gBegIxAGoCoQLhApAFqwV9AFAB3QMTBPUDuwSdAHQEvgCGBQcDAwQGAiwDHQKiAyIDZAT3AIcDiQDWAIIA9AIdAo4DtgBMAWMBIAJaAOAFCQCjAN4AKAKiA/oEFQBEAF0CMAU3AqkDfwAoAnwA4QLiAAoB4QE4A8sA4QJ/Ad4DGAHyAgEBVwGaAikE4QAXAQABgAQEAQgEqgAbAjwA4AJhAXABsQA6AeECCwP+Aa0D9wClAd4A0wJyAY0DYwGXASoDmwPwAlEExgHZAVIB2AGVAD4EPAJIBEgAOwOiA64FCwDsAfQEPwXjAWUEuwAXAkwCpAJdAu0E2QA1AlEBsQHmAYwDlQD8A6UCHgN4BPgFIwIHAx4DdQPbAMQB5gJ3A/YAFwWmADgFZQHOAUUCWwNFAaEEQwO6BBkCagQsADMAPQFRBBwBPgGIAtIE6gEDBF4ADAEPAFsDVgBBA8MA3wHDAJYC3QF9A6UAkAEDBBkFkgAHA5oBnwQ6A60DkADBA60AkAHWAAQGsAHxASACBAW5AmQE4QG6AmYErgWPBIkF2gG2AwkALABwAUADWgJ2A98CXwNwA/oEfABaBRAA+QM5AJwAnwGKBNIAbgM3AHMFCQF3AzcAywV6AGAChQG2BAMDjQN2AHcDnwESBD8BbAQsAFgAjgLgAjsALQOYAMYBvABvBWIB7gRtA5UFjwE6AqYBqwIZAaEDxQAPAloB3AO4AW4DwwF2Aw8AygOFAOsAxQLeA9wC9QPhAE8EHgCjAMUB+gWQAGYF2gHyA+cEXwWeBPIEHQDgAi8D+gPSBNcElQMvBfgCNwVJAHMF+gHTAj0CvgQ1BVEFmQE5AwQAywK0A7kF+QCVBLcACwY0At0ECgFIAaQA+AKLAWYDMwCOAEUAMwEbAUwCeQBmAggC3QKeANUB2QAGAnAAOAIJAcQB0QCTAkcALQO5BL0FOgM/BKgEIwURARIBFADQAMYFFgY+AYQB2QHYAw4ADAWWAN8DTwC+AEkA+QWZAdoDDARCBTkCKgP0ABMBPACSAAwB/QOQACoCaAQYBYsAPwVpBK0ELQDPBEkAkAD0AisEtAHEAzQDiQTyAeoCNgLPBBsC2gIlAkUDAwLFAkgBxwETAGsDPwX5BSsB7AG4ARECXAHnA+0A1QHeAI8D/QBGAhwBlgMhAMkBCAFBAUkA7AFwBAQGAQT2BIgAIQQhAYEDygEMA18A4wAbADIAZAF8AnIAWwJqBE8FxQJ4BOQBQQLCA04EmgKyA1kABQJlAFICeAIEBjUAlwAdA8kEsQFnA5YAJwNMAnkEiATPBZUAKgIpAV8EAgB9AR4A8QNJALIELAA1Ak0CCQNHABQF8ACwA/oBBwMcAIwBkADxA74EBAYHBBkFFwLBA8sDXwT7AuEEbANkBEICBASUAM4ACAA2ArkEcwVmAt4DQQCPBcIA/QJYAdkBpQGxATgBywOVA7MFCQETBGcBDAO/AZ8DWgAJBHIA8gTVAHcCSAFPAmECIQSwAZ4DggCSALkDZQR4ALUASQEsAkEAwAMPABkCHABUAO4AMQIoAswD+wL1Aw8CoQK4AZUCIgNtBCEAgwPCADUCCQUOBdUBRQJyABABGwBMA3wC7QJJAJ8FZQAUAdAC1AJHAb8ESwBBBIcBLAPqAjAETwJzA8ED2wRJAEcBAQA1A/EB3wNaA4AEMwDwBCUCXAJgBMUF/gGNAvMBTwKWAA8FygFXBaoAywFLAfMBXgUKBhQGGAbhAAkBFgK1AwQApQMYAbQBiQPqA2oCdwP3AKECQwIgBJIE0QXMAJAEJgMDBqwA5wIsA9gEEAA1AdoCQQQjAXwB3gC8A7gB5QONAq0DHAA+AK0A7QR9A5UE1gC+BPQAcAFMAPQBIAMqAzAFBAaMANYCFQDnAb4AHwJgADEB4wHbA0oD+gRpAPgBlQCsAQMC6AMEAJ4EsQKRBaID9QP0AE4DDgEqBMYApgLxAWcDGwCaBJkB0wKwADYB8wFqBPQAsAQsBP0FAADWAewAiQPeAu8COwBoA10C6AMbARcDsQGgA4oADgRDAn8DpAFaAkcAjwMRABcCVwW7BSsBOQT2ABwDNAIgBQYCYwWLAdEBcQBuAzwA3wLqAScDVgKDBVYAbgKVAuoDuACFAfMAMgSlAegB0wF8AhsB7QJ6AZYENAIyBMoAhQGOAaQCLABiAvkA0gTlA1wEiwGuAdACEwRSAXoCaQHFA8wAgwNvBLsEMgAEBhQD4wMbAdQBaQEkBdoBTgIZABQBcgFaA3oCgAOgBfUF6gHDA28DjQM6AkAFOQHvApgE7QQiAM4AewHwASUC3wI7ACkEMgAIBqkCBwODAN0D7wIHBPgBXAUCAFIBDwI0AjIAJwPvAsMDkgX6BZ4AIgNDAKcDSAEEBlcDmwOEBd8FOwAnAxQAKAL0APEBNwFxBAcEFwW/AVMDIAK+BQ4B6gJ8AqwCRwDCAkUDDwXvARECVQKMBIgBiAPvAv4CMAKyBE0CmgIUARwDnADuAFUBfwKMAEYEeQBHASsB9QOXAAkBcQD3AT8ATAGDAG0DSwCnAGkA5gUVARQD5gFIAsoArwI6AQ0FZADjAM4AlAIDAm4DZwAvA/oBugRtAI0DcwCWAo0AEQHSAA8BmACPBEgAZgMOAfEDrQAQA2kBDQUMA/kDDgJcBKcB8QFuAZUCWAAJATQA+AXKAJMDhgD4AgIAKwCPAPIB6AE0AmcE8ATKAZ4EeAKaBB0AzAI+AdQCPgFdA0cBDAMKAHoBOwCZARwAAgGlATQC9wBDAuwA6gPBA/AE8QEgBPAA8QCRAEwDLAPfAykAjgRdAg0G+QEoAgIASwBkASgCIABpBYMAfQHxAHwB7QCtA2kBbAHxAY4CWADxAw4A4gEWArwDbAO/AzMA3wB1A8UDZQAjAxsB8AJxAA8FtAAYAa8AlgTqAU8ClgOSBEQAXAIPAvkDmABdAhAAHQDxAe0CvQImA80AzwTMAPkATQS5BPgC4QVFAIEFcAD/AjIBZAS6Ah4FIADwATUAYgGVA2AEIQGTAQkBbAKpAiwDNwK1A0ICWwJJAAwDbAIEAzoAMAOuAKECigFsA5UAHgFbAqMCKwARAwkBrAL0Am4DYwBwABwB2AGzA2UEGQBXAcIAewGrAcMBdQNBBREAYwRjAJAFygFGBfgBaAQJAD4CFACqAkwCgAMrAOsBdQHmA9UAawP0AE8CcAEHBJUC3gPwAncEOgBuANsESQXTAQQDJgBwATkB0QKZAroCsgIYBEcBRQJwATIC5gMPBEECNwWRAHgDyADaAIQD9APwAb4EAwCxAK0AMgMAAfMFBADCBIME2wQ0BZgFlQBGAyMBLQIpAdkDNgC6ArQAIwEMAfIDQwBCBPQAUgFFA5AEvgBzAZIE/QUCAGQD+gK5A1AEoQSQABgDZwBhAvEA+QPwALUDkQQSBnwBvAJkAd8DlADpA2MBegHFAVcCGwDjAFsB9wHVAPQAkQBDA3MC5QOsAOwAsAX1BXMFhgUIABIFFAHXAYgBvQEIA5QEWwLLBYEDLgTxBQgGpAAZAaoApQFJAZAECgDABF4A/wDZAYMElQB8BAQD5QOAAuoDVwAFAQcC9QJHAK0AyABfAyMF+gVtAQcDggAlBAAEGQTUARMEZQF/AjMAcAKkADMDAQILBE0AkwJYAHEBGwC+AgUA8ABfAEMCewFSAvACdQN+A18EjADZBHIAPwUqAvoDHAKHAygAdQNlAf4C+AIHA20DdwUhAH0E4gFRAqMAawFxAgMDEAAsAAQGCAZnAMMDpAIXBQUAbAD0AIwDRwEPAg4DtgNLAGECdgGHAXoBTAO1AywFkgCsAnUDYQT8ANwDJgBsA3wC0wNLACkE0QEHAlMDEgQrAHUAUAQdBbsAZwFRAegCkAClAV8A8gFdAFUC+QDCA+MBewIIBKAERAFVBMQBoAWQANACcAA9AlcBdATeAB0DNQGKAYsB2gNFAMsDdQFnAzoAjgRVASID9wCVBDgBMgIKAL0BEwBmAvEBrwMzAWIDOQI6ApUCBAWDAFYBmgITBCIANgGJBJgELACLANQArAKHAF8BlgJOBLkECAUCAE8CcwA8Af8BNAS4AQkDzAAJAX8AJAWDACICkADRAYEDsgQEAPIEdQMIBP0A5QMbAP4C0ADyAXYAdAQQAPIBOQOPBGoCdQXGAYkD8QGNAnoBvgQJAIwChQF1AvcBfwKVAzEEBALiA6MCTgSvAWoCJgIpAssFEAYiAFQA3AHHA4UANALmAaICEQBeBJ0AwgKtAHcFfADFA7AA2gMhAE8EIADGAHwCcQQJAjMDfwAiBQcA5gXOAOUBigA9AUcCMwOWAkADlgCrAT8ARQKqABEDMwK5AmkFzQWNABUGrQA9Ad0B8AMzAPEDcgDnBBEAEwT8AGMF8ACDAsoAKQEcAeMBPwBXABAAswNTAbUFGgOaBKQCGQXhAlgDRwHCA/gB0wIBAKwAlgBFAsMAzgHxAlsDOwA5AykCNQU/Ba4FFgI5ArUCRAOKAJEDYAW9BfEBagQbAIcEIACTBcIARwQBACcDQwCuBDwBAgVDAkEDWgDwAmcBdwQIAGIAFABmAWcD5gMgAIcAwQOgBZYCygR6AbIFHgCpAv8B0wIpAmwFgwBlAdcBUgIEAvkDFAALBCEA/AAeAcMC+AHBBcwArAFjBOkEKwDhBZQAxAQzAIMEeQC5AxIAJAE+AE4AUgDTBJIAawE8Am8EqgF9A8UA/QJ1AUcErwF/BQ0AeQATAMABoQBaBQIAhQRpAI8A+QISBPkCVAWCALwA2gCPBM8AEQG5A5IFAgDVAc0FDQZYAEcB9gSlBU8FwgWDABcC6gIlA9kBlARFApoCuwBeAfQE3gURAAICMgGmAQ4AxQF+APEAGwFGA6oAOwQCAGEBSwASAWkCVwS+BL4FoQUJBs4A2wBZA9sDngDSADMAWgEMAaAFHABQAeMDLwQHAPMFkQKNAw8AnwBEAT8FygBwAbUBUQTFAZcDIgAMBTkCJwTmAhMEwwAqAigAfgOIANkBeQAwAx0AQgQsALIElgDDA3QBlwHqA6oEKwCQAA8BWgLsAwkEKwACBscAxAF7AiADrAB7BF8FCQbfADUDBQG1A6EALQUPAWMBgQP1AyYAKwGsAAQGJQB0ANACKQRXARQFFABRAecC9AK+ANsC9gBSARoCxATyBKMF7gCzA64APQMUAO8ATQGvAQMDOAMQAI4CcwBBA0wAAwJ2AXEC5gJRBLAAjAWtA/UDqgARAZIDXwSLAO8DPQOgA1YASANcAF8BOgEPAn4AjgCcAzkE9wCjAjQATQKPAyEEVgAIBBEB9wHqAUECwwEZAzcCggPaAFEEXwPLBBoAsgDDA4cEDAE1A4wCGgSWAMgAIQFvAikAeQB5APcE0QFrA4oAmgRpAn0D6wPHBUMAmwMKAHQBpADKAxIB8ARDANQDYQBuAmIBigIdAjQCCQMZBWgB1AEYBC0FEgH6A+0FEAZ/Af4BQQApAl0AGAIHAF8B2AFGA4sApwEoABoETQGkAg8AJgBIAeoDxQE4AqoAqgGqANcClgDeALAAIAJvApkDaAPDAzYB9wECAEUE5wTrBRcCDQYLAVwCNgH4BXUD/ANkAI8DJQPLA9gBTwLdAwgEdQKYBKMAIgNpAKcAUgKBA8cAeATnADkDxANfBLADygMLAMwDawGJAXMAZgJSAMgAlwHfAt8CjAPUAeUDlwOSBLAAGgPEAfgBGwJfA8sDZQRLAuoCdwSwBNkANwIPAd4D5wJxBLEAcAFVAicE3wIEA4gB2QT4AZoCJgBFAAMAZwWhAssDggBtA4sC0QI8AhoFEAAUAEMDhQPPBKAFxQL6AwQBwwKmARgEPgE3AiUAzgBHAsADDgJ3BI4BjAJ4A+0DXAAMBREAUgAqAI4D8QCoAXYBTwOLAQcDhQESBhkCAANuAAkG0wPyA40C6gILAFgA3wHRAh4BqgUtAEwAbQOwBRgBpgG/AkED2QHnAzIBywMlAJgAfgAhBZUAPgGwADsEBQGSAXMCrAJwAqoCqwF3BBwDPQN7Ar0EMAIMAxoBSgNnAI0AAABDANcA/gErAFMAaQDBA74AOgI0BfcFCABFAxEAHwQIATYB8wEHBAkBNQNIAF4AKwHuAwwFKAWtAEwCfgD1A64AmgOUALQAZgBuAK8AGgI5A20DCAJOBPYArgGLABAG1QHTA+EEGAW0AVAEMgLLA/IBfAIeAO0CdgCkAoIAgAI8AEcA7AA+Ae4AowGWAzQFNAWfBU8C3wKcBPsFaQJZA+cAIgQzAeECKABQABsCsgPXAj0DmgXgBQoBdwOfA+0DzACgAUcAhgCuAN0BSADRAsoAMAKeBAkGWQCeBP8ADgEpAboDtgBSAXUCawMFAawBUgBWAb0F/wUCAXMBZwC8AJIAYwEKAawETAD/AKYBTAOWBecF/wC5AXwC2AMAAH4AygCyAZoB2AI5AdACSQESBL4ACwbXAOACRwCDA3kAygBeAZoElgA3BTYAWAADAtoDRwNTA3MCdwS5A/YEWgBuA/0B8gSzAvsDHAHvAZMEiQXPACkEZwBcBDYAjwENAZUEigI9A/4CGQULBf4FgACjAd4ATwOeBD8FFAECAhwCRQKSBJQFWgDlA44ADQErAPAElgLSBNQAbgGiA5AFZAAeA/wAMwJVAV4BcgEkAjsCgAWhAaMCZgGJAkUDeQQtAAkE3gDlA3IA9gBdAgQFAgBVBPACEQNBA0cDlgB0BEUCBwPTAhQFHQB7AoQC4wNmAtAC/gIvA4sA9wCqAnEEoQDLAwUBQAVJAI4DLACuAEMCJQPUAiMENgFPAekARgFaApoEwgAcAdMCJQRPBWYFzgA8A/YAEgFrAfgCkAMsBcUB0AQcAQUDTwQEBXkAtgSFADgBwgAdA3EAxQJeAYYEZgRrBbsF9wUsAPoChgRaBX0APwJcAmYCOwCtA/AAvwGSAZoBZgPBA9gBgANzBZYFIgOJA/4CKwRLABIG7gBjAjACMQU5AcMDKgBqAIUBLwQdAI4AzAKVAxEB7gEKAIUDSwAuAa8FEAZ8AOIDQQDzANwBPAOmAZ4E8wAyApUAXQNbAgkG2AUaBg==","w":"eXd2dXV1dXV0dHRzc3NycnJycnFxcXFxcXFxcHBwcHBwcHBwcHBwcHBvb29vb29vb29vb29ubm5ubm5ubm5ubm5ubm5ubm5tbW1tbW1tbW2TbW1tbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxra2tra2tra2tra2tra2tra2tra2tra2tra2tra2pqampqampqampqampqampqampqampqampqampqampqampqampqamlpaWlpaWmXaWlpaWlpaWlpaWlpaWmXl2lpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaJhoaGhoaGhoaGhomGhoaGhoaGhoaGhoaJhoaGhoaGiYaGhoaGhomGhoaGhoaJhomGhoaJhoaGhoaGhoaGhoaGhoaGhnZ2dnZ2dnZ2dnmWdnZ2dnZ5lnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ5lnmWdnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dmZmZmZmZmZmaaZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmaaZmZmZmZmZmZmZmZmZmZmZmVlZWVlZWVlZWVlZWVlZZtlZWVlZWVlZWVlm2VlZWVlZWVlZWVlZWVlZWVlm2VlZWVlZWWbZWVlZWVlm5tlm2VlZWVlZWVlZWVlZWVlZWVlZWWbZWVlZWVlZWVlZWVlZWVlZWVlZWVlm2WbZZtlZGRkZGRknGRkZGRkZJxkZGRkZGRkZGScZGScZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZJxkZGRkZGRknGScZGRkZGRkZJxkZGRknGRknGRkZJxkZGRkZGRkZGRknGScZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRknJxkZGRkZGRkZGRkZGRjY2NjY2NjY2NjY51jY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjnWNjY2NjY2NjY2NjY2NjY2NjY2NjnWNjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2OdY2NjnWNjY2NjnWNjY2NjY2NjY2NjY2NjY2NjY2NjY2OdY2NjY2NjY51jY2NjnZ1iYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmKeYmJiYmJiYmJiYmJiYmJiYmJinmJiYmJiYmJinmJiYmJiYmJinmJinp5iYmJiYmJiYmJinmJiYmJiYmJiYmJiYmKeYmJiYmJiYmJiYmJinp5iYmJiYp5iYmJiYmJiYmJiYmJiYmJiYmJinmJiYp5iYmJiYmJiYmJiYmKeYmJiYmJiYmJiYmJiYmJiYmJiYp5iYmKenmJiYmJiYmJiYmJiYp9hYWFhYWFhYWFhYWFhYZ9hYZ9hYWFhYWFhYWFhYWGfYWFhYWFhYWFhYWGfYWFhYZ9hYWFhYWFhYZ9hn2FhYWFhn2FhYWFhn2GfYWFhYWFhYWFhYWGfYZ9hn2FhYWFhYWFhYWFhn2Fhn2FhYWGfYWFhYWFhYWGfYWFhYWFhYWFhYWFhYWFhn2FhYZ9hYWFhYWFhYWFhYWFhYWFhYWFhn2FhYWFhYWFhYWFhYWFhYWGfYWGfYWFhYWFhYWFhYWFhYWFhYWGfYWGfYWFhYWFhYWFhYWBgYGBgYGCgYGBgYGBgYGBgYGBgYGCgYGBgYGBgYGBgoGCgYGBgYGBgYGBgYGBgYGCgYGBgYGBgYGBgYGBgYGBgYGBgYKBgYKBgYGBgYGBgYGBgYGBgYGBgYKBgYGBgYGBgYGBgYGBgoGBgYGBgoGBgYKBgYKBgYGBgYGBgYKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgoGBgoGCgYGBgYKBgYGBgYKBgYGCgYGCgYGBgYGBgYGBgYGBgYGBgYKBgYGBgYKBgoGBgYGBgoGBgoGBgYGBgYGCgYGBgYGBgYKBgYKCgYKBgYKCgYKBgYGBgYGBfX19fX19fX19fX19fX19fX6FfX19fX19foV9fX19fX19foV9fX19fX19fX6GhX19fX19fX19fX6FfX19fX19fX19fX19fX19fX19fX19fX19fX1+hoV9fX19foV9fX19fX1+hoV9foV+hX19fX19fX19fX19foaGhX1+hX1+hX19fX19foV9foV9fX19foV9fX19fX19fX19fX19foV9fX19fX19foV9foV9foV9fX19fX6FfX6FfX19fX19fX6FfX19fX19fX19fX19fX19fX19fX6FfX6FfX19foV9fX19fX19fX19fX19foV9fX6FfX19fX19fX19fX19fX6GhoV9fX1+hX1+hX19fX19fX19fX19fX19foV9fX19fX19fX1+hX19fX6FfX6FfXl5eXl5eXl6iXl5eXl5eXl5eol6iXl5eXqJeXl5eXl6iXl5eXl5eXl5eXl5eXl5eXl6iXl5eXl5eXl5eXl5eXl5eXl5eXl5eXqJeXl6iol6iXqJeXl5eXl5eol6iXqJeXl5eXl5eol5eXqKiol6iXl5eXl5eol5eXl5eXl5eXl5eXqJeXl6iXqJeXl6iXl5eXl5eol5eXl5eXl5eXl5eXqJeol5eXl5eXl6iXl5eXl5eXqJeXl5eol5eXl5eXl6iXqJeXl5eXl6iXl5eXl5eXqJeXl5eXqJeXl5eXl5eXqJeXl6iXl5eXl5eoqJeXl5eXl5eXqKiXl5eol5eXl5eol5eXl5eXl5eXl5eXl5eol5eXl5eXl5eXqJeXl5eXqJeXl5eXqKiXl5eXl5eoqJeXqJeXl5dXaNdo11dXV1dXV1dXV1dXV1dXV1do12jXaNdXV1dXV2jXV1dXV1dXV1dXaNdXaNdXV1dXV1dXaNdXV1dXV1dXV1dXV2jo11dXV1dXV1dXV1dXV1dXV1dXaOjXaOjXaNdXV2jXV1dXV1dXV2jXV2jXaOjXaNdXV1dXV1dXV1dXV1dXV1dXaOjXV1dXV1dXV1dXaOjXV1dXaNdo11dXaNdXaOjXV1dXV1dXV1dXV1dXV1dXaNdXV1dXV1dXV1dXV1dXV2jXV1dXV1do11dXaNdXV1dXV2jXV2jXaNdXV1dXaNdo6NdXaNdXV2jXV1dXV1dXV1dXV1dXV2jo11dXaNdo12jXV1do11dXV2jXV1dXV1do11dXaOjXV1dXV1dXV1dXV2jXV2jXaNdXV1dXV1dXV1dXV1dXV1do11dXV2jXaNdo11dXV1dXV1do11dXV1dXV1dXV1dXV2jXV1dXV1dXV1dXV1do11dXV1dXV1dXV2jXV1do11dXV1dXaNdXV1dXV1dXV1do1xcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcpFxcXKRcXFxcXFxcXFxcXFykXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFykXFxcXFykXFxcXFxcXFxcXKRcpKRcXFxcXFykXFxcXKRcXFykXFxcpFxcXFxcXFxcXFxcXFxcpFxcXFxcXFxcXFxcXFykXFykXFykXFykXFxcXFxcXFykXFxcXFxcXFxcpFykXFxcpFxcXFxcXKRcXFxcXFxcXFxcXFxcXFykXKRcXFxcXFxcXFxcXKRcpFxcXFxcXFxcXFykXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcpFxcXFxcpFxcXFxcXFykXFxcXKRcXFykXFxcXFxcpFxcXFxcXFxcXFxcXFykXKRcXFxcXFxcXFxcXFxcXFxcpFykXFxcXFxcXFxcXFxcXFykXFxcXFxcXFykXFxcXFxcXFykXFxcXFxcXFxcXFxcXFykXFxcXFxcXKRcXFxcpKRcXFxcXFxcXFxcXFxcpFxcXFxcXFxcXKSkXFxcXFxcW1tbW1tbW1tbW1tbW6VbW1tbW1tbW1tbW1tbW1ulW1ulW1tbpVtbW1tbpVtbpaWlW1tbW6WlW1ulW1tbW1tbpVulW1tbW1tbW1tbW1tbW1tbW1tbpVtbW1tbW1ulW1tbW6VbpVtbpVtbW6WlW6WlpVtbW1ulW1tbW6VbW6VbpVtbpVtbW1tbW1tbpVtbpVulW1tbW1tbW1ulW1ulW6VbW1ulpVulW1tbpVulpVtbpVtbW6VbW1tbW1tbW1tbW1ulW1tbW1tbW1tbW6VbpVtbW6VbpVulW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW6VbW1ulW1tbW6VbpVtbW1tbW1tbW1ulW1tbW1tbW1tbW1ulW6WlW1tbW1tbW1tbpVtbW1tbW1ulW1tbW1tbpVtbW6VbpVulW1tbW1tbpVtbW1tbW1tbpVtbW6VbW1tbW1tbW1tbW1tbW1tbpVtbW1tbW1ulW1ulpVulW1tbW6WlW1tbpVtbpaWlW1tbW1tbW6VbpVtbW1tbW1tbW1tbW1tbW1tbpVtbW6VbpVtbW1tbW6VbW1ulpVtbW1tbW1tbpVtbW1tbW1taWlpaWqZaWlpaplqmWlpaWlqmWlpaWlqmWlqmWlpaWlpaWlpaWlqmplpaWqZaWlpaWlpaplpaWlpaWqZaWlpaplpaWqZaWlqmWlpaWlpaWlpaWlqmWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlqmWlpaplqmpqZaWlqmWlpaWlpaplpaWlpaWlqmWlpaWlpaWqZaWlpaWqZaWlqmWqZaWlpaWlpaWlpaWlpaWqZaWlqmWlpaWlpaWlpaWlpaplpaplpaWlpaWqZaWqZaplpapqZaWlpaWlpaWlpaWlpaWqZaWlqmWlqmWlpaWqamWlpaWlpaWlpaWlpaplqmWlpaWlpaWqZaWqZaWlpaWlqmWlpaWlpaWlpaWlpaWlpaWlpaWlpaplqmWqZaplpaWqampqamplqmplpaWqZaWlpapqZaWlqmWlqmWlpaWlpaplpapqamWqZaWlqmWlpaplpaWqZaWlpapqZaWlpaWqZaWqZaWlqmWlqmWqZaWlpaWlpaWlqmWlpaWlpaWlpaWqamWlpaWlpaWlpaWlpaWlpaWlpaWlpaWqZaWlqmWqZaWqZaWlpapqZapqamplpaWlpaWlpaWlqmWlpaWqZaWlpaWlqmWlpaWqZaWlpaWlpaWqamWlqmWqZaWlpaWlpaWqZaWlqmpqZaWlpaWlqmWlqmWlpaWlpapqZaWlpaWlpaWlpaplqmWlpaWlpaWlpaWVmnWaenWVlZWVlZWVlZWVlZWVmnp1lZp1lZp1lZWVlZWVlZWVlZWVlZWadZWVlZWVlZWVlZWVlZp1lZWVlZWVmnWVlZWVlZWadZWVlZp6enWadZp1lZWVmnWVlZp1lZWVmnWVlZWadZWVlZp1lZp1lZp1mnWVlZWaenWVlZWVlZp1mnp1mnp6dZWVlZWVlZp6enp1mnWVlZWVmnWVmnWVlZWVlZWVmnp1lZWVlZWVlZWVlZWadZWadZWVlZWadZWVlZWVlZWadZp1lZWVlZWVlZWVlZp1lZWadZWVlZp1lZp1lZWVlZWVlZWVlZWadZWVlZWVlZWVmnWVmnWVlZp1lZWVlZWVlZWVlZWVlZWVlZWVlZp1lZp1lZWVlZWVmnp1lZWadZWadZp1mnWVlZWVlZWVlZWVlZWVlZWVlZWVmnWVlZWadZWVlZWVmnp1lZWVlZWadZWVlZWVlZWVmnWVlZWadZWVlZWVlZWadZWadZWVmnWVmnWVmnp1lZWVlZWadZWVlZWVlZWVlZp1lZWVlZWVlZWadZWVlZWVlZWVlZp1lZWVlZWadZWadZWVlZWVlZWaenWadZWVlZWVlZWVlZWVmnp1lZWadZWadZWVmnWVlZp1lZWVlZWVlZp1mnWVlZp1lZWVlZWadZWVlZp1lZWVmnWVlZWVlZWVmnp1lZWVlZWVlZWVmnWVlZp1mnWVlZWaenp1mnWVlZWVlZWVlZWadZWVlZWadZWVlZWVlZWVlZWVlZWVmnWVlZWVlZWadZWVmnWVlZWVlZWVlZp1mnWVlZWVmnWVlZWVlZWVlZWVlZp1lZWadZWVlZWFhYqFhYqFhYWFhYWKhYWFhYWFhYWKhYWKhYWFioqFhYWKioWFioWFhYWFhYWFhYWKhYWKhYWFhYqFhYWFhYWFhYWFhYWFhYWKhYWFhYqFioWFhYWFhYWFioWFhYWFhYWFhYqFhYqFhYWFhYWFhYWFhYWFhYWFhYWKioqKhYWFhYWKhYWFhYWFhYWKhYWFhYWFioqFioWFhYWFioqFhYWFhYWFioWFhYWFioqKioqFhYWFhYWFhYWFhYWFhYWKhYqFioWFhYWFhYWKhYWFhYWFhYWFhYWFhYqFhYWFhYWFhYWFhYWFhYWKhYWFhYqFhYWFhYqKhYWFhYWFioqFhYqFhYWKioWFhYWKhYqFhYWFhYqFhYWFhYWFioWFhYWFhYWFhYWFioWFhYWFhYWKhYWKhYqFhYWFhYWFhYWFhYWFioWFhYWFioWFhYqFhYWFioWFhYWFhYWFhYWFhYWFhYWFhYqFhYWFhYqFhYWFioqFhYqFioWKhYWKhYWKhYWFhYWFhYWFhYWFhYWFhYWFhYWFioWKhYWFhYqFhYWFhYWFhYWFhYWFhYWFhYqKioWFhYWFhYWKhYWFioWFhYWFioWFhYWFhYWFhYWFhYqFhYWFhYWFhYqKhYWFhYWFioWFhYWFhYWFhYqKhYWFhYqFhYWFioWKhYqFioWFhYWFhYWKhYWFhYqFhYWKhYWKhYWKhYqFhYWFioWKhYWFhYWFhYWFioWFhYWFhYqFhYWFioWFhYWFhYWFhYWFhYWFhYWFioqFhYqFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYqFhYWFhYWFhYqKhYWFhYWFhYWFhYWFhYqFhYWFhYqFhYWFhYWFhYWFhYWFhYWFioWFhYWFhYWFioWFhYWFioWKhYqKhYWFhYWFhYWFioWFhYWKhYWFhYqFhYWFhYWFhYWFhYWFioWFhYWFhYWFhYWFhYWFdXV6lXqVdXV6mpV6lXV1dXV1dXV1epqVdXV1dXV1dXV1dXV6lXV1epV1dXqalXV1dXV1dXV1dXV1dXV1dXV1dXV1epV1dXqVdXV1dXV1dXV1dXV1dXV6mpV6lXV6mpV1dXV1dXV1epV1dXV1dXV1dXV6lXV1epV1dXV1dXqampV1epqVdXV1epV1epV1dXqVdXV6lXV1epV1epV1dXV1dXV1dXV1dXV6lXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1epV6lXV6lXV1epV1dXqampV1dXV1dXV1dXqVdXV6lXV6lXV1dXqVdXV1dXV1epV6lXV6lXV1epV6lXV1dXV1dXqampV1dXV1dXV1epqVdXV6lXV1dXV6lXqVepqVdXV1dXV1epV6lXV1epV6lXV1dXqalXV1dXV1dXqalXV1dXV1epqampV1dXV1dXV1dXV1dXV6mpV1dXV6mpqVdXqVdXV1dXqampV6mpV1dXqVdXV1dXV1dXqVdXqVdXV6lXV1epV1dXV1epV1dXV6mpV1dXV1dXV1dXV1dXqVdXV1dXV1dXV1epV1epV1dXV1epV1dXqVdXV1epV1dXV1dXV1dXV1epV1dXV1dXV1dXV1dXV1epV1epV1dXV1dXV1dXV1dXqVdXqVdXV1dXV1epV6mpqVdXV6lXV1dXqVdXV1dXV1dXqVdXqVdXV1dXV1dXV1dXqampqVdXV1dXV1dXV1dXV1dXqVdXqVdXV1dXV1dXV1dXV1epV1dXqalXV6mpV1dXV1dXV1dXV6lXqVdXV1dXqVdXqampV6lXV6lXV1dXV1dXV1dXqalXV1dXV1dXqVdXV1dXV1epV1dXV1epV1dXV1epqVdXqVdXV1dXV1dXV1dXV1dXV1epV1dXV1dXV6lXV1dXqVdXV6lXqVdXV1dXV6lXV1dXV1dXV1dXV1dXV1epV1dXV1dXV1dXqalXV6lXV1dXV6lXV1dXV1dXV1dXV1epV1epV6lXV1epV1dXV1dXV6lXqVepV6mpV1epV1dXV1dXqVdXV6mpV1dXqampV1dXV1epV1dXV1dXV1dXV6mpV1dXV1epV1dXV1dXqVepV1dXV1dXV1dXV1dXVqpWqlZWqlZWVlZWVlZWVlZWVlZWVlZWqlZWVlZWqlaqqqpWqlZWVlZWVlZWVlZWVqpWVlaqVlZWVlZWVlaqVlZWVlZWVlaqVqqqVlaqVlZWVlZWVlZWVlZWqlaqVlZWVlZWVlZWVlaqVlZWVlZWqlZWqlZWVlZWVlaqVlZWqlZWVlZWVlZWVlZWVlaqVlZWVlZWVlZWVlZWVlZWVqpWVlZWVlaqVlZWVlZWVlZWqlaqqlZWVlZWqlZWqqpWVlZWVlZWVlZWqlZWVlZWVlZWVlZWVqpWVlZWVlZWVlZWVlZWVqpWVqqqVlZWVlaqVlZWVqpWVqpWVlZWVlaqVlZWVlZWqlZWqlZWVlZWVlZWVlZWVqpWVlaqqlZWVqpWqqpWVlZWVlaqqlZWVlZWVlZWVlZWVlaqVqpWqlZWVlZWVlZWVlZWVlaqVlZWVqpWVlZWVqpWVlZWVlaqVlZWqlZWVlZWqlZWqlaqVlZWqlZWVlZWVlZWVlZWVlZWVqpWVlZWVlaqVlaqqlZWVlZWVlZWVlZWVlZWqqpWVlZWqlZWVlZWVlZWqlZWVlZWVqpWVlZWVlaqVlZWVlaqVqqqqlZWVlZWVlZWVlZWVqpWVlZWVlZWVlZWVlZWVlZWVqpWVlZWVlZWVlaqVlZWqlaqqlZWqlZWVqpWVlZWVlZWVlaqVlZWVlZWqlZWVlZWVlZWVlZWVlZWVlZWVlZWqlZWVlZWVqpWVlZWVlaqVlaqVlZWqlZWVlZWqlZWVlZWVqqqqlaqVlZWVlaqVlZWVlaqVlZWVlZWVlZWVqpWVqqqVlZWVlZWVlZWVqpWVlaqqlZWVlZWVlZWVlaqVlZWVlZWqlZWVlZWVqpWVlZWVqpWVlaqVlZWVlZWVlZWVlZWVlZWqlZWVlZWVlZWVqpWVlZWVlaqVlZWVqpWVqpWVlZWVlZWVlaqqqpWVlZWVlZWqlaqqlaqVlZWVlaqVlZWVlZWVlZWVlZWVlZWVlZWqlZWVlaqVlZWVlaqVlaqqlZWVlZWVlZWVlaqVlZWVlZWVlZWVlZWVlaqVlZWVlZWVlZWVlZWVlZWqlZWVlZWVlaqqlZWVlZWVlaqqlZWVlZWVlZWqlZWqlZWVlZWqlZWVqpWVlZWqqpWVlaqVlaqVlZWVlaqqlZWVqpWVlZWVlZWqlZWVqpWVlZWVlZWqlarVatVVVVVq1VVVVVVVatVVVVVVatVVatVVVVVq1WrVVVVq6tVq6tVVVVVq1VVVVVVq1VVq1VVVatVVaurVVVVVVVVVVWrVaurq6tVVVWrVVVVVVVVVVWrq1VVVVVVVVVVVVVVq1VVq1VVq1VVVVWrVatVVVVVVatVVVVVVatVVVVVVVVVVVVVq6tVq6urVVVVVatVVVVVq1VVVVWrVVVVq1VVVVWrq1VVVVVVVVVVVVWrVaurVVVVq1VVVVWrVVVVVVVVVVVVVaurVVVVVVVVVVWrVatVVVVVq6tVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVaurVVVVVatVq1VVVVVVq1VVVVVVVVVVq1VVVVVVVVWrVVVVVVVVVatVq1WrVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVatVVaurq6tVq6urq6tVVatVVatVVVVVVatVVVVVVatVVVVVq1VVVatVq1VVVVVVVVVVVVWrVVVVVatVVVVVVatVVVVVVatVVVVVVVWrVatVVVVVVVVVVVWrq1VVVVVVVVVVVVWrVVVVq1VVVVVVVVVVq6tVq1VVVVVVq1VVVVVVVVWrVVWrVVWrVVVVVVWrVatVVVVVVVVVq1VVVVVVVVVVq6urq6urq1VVq1VVVVVVVVVVVVVVVVVVVVWrVVVVVVVVq1WrVVVVVVVVq1VVVVVVVVVVVVVVVatVVVWrVVVVVVVVVVVVVVVVVatVVVVVq1VVVVVVVVVVq1VVVVVVVVVVVatVVVWrVatVVVVVVVVVq1VVq1VVVVVVVVWrVVVVVVVVq1VVVVVVq1VVVVVVq6tVq1VVVVVVVVVVVVVVq1VVVVVVVVVVVVVVVVVVVatVVVVVq6tVVatVVatVVVVVVVVVVVVVq6tVVVWrVVVVVVVVVVVVVVVVVVVVq1Wrq1VVVatVq1VVVVVVVVVVVVVVVVVVVVWrq1VVq1VVVVVVVaurVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVWrVVVVVVVVq1VVVVVVVVVVVVVVq1VVVaurVVWrVatVVatVVVVVVVWrq1VVVatVq1VVVVVVVatVVVVVq6tVVVVVVVVVVVVVVVVVVVVVq1VVVVVVVVVVVVVVVVVVVatVVatVVaurVVVVVVVVVatVVVVVVVWrVVVVVVVVVVVVVVVVVVVVq1WrVVVVVVWrq1VVVVWrVVWrVVVVVVVVVatVVVVVVVVVVVWrVatVVVVVVVVVVVWrq1VVVVVVVatVVatVVVVVVatVVVWrq1VVVatVVatVVVVVVVWrVVWrVVWrVVVVVVVVq6urVVVVVVVVVVWrVatVVVVVVVVVVatVVVVVVatVVVVVVVWrVFRUVFRUrFRUVFSsVFRUVFSsVFRUVFRUVFRUVFRUVFRUVKysVFSsVFRUVFRUVKxUVFRUrFSsVFRUVFRUrFRUrKxUVFRUVFRUVFRUVFRUVFRUVFRUrFRUVFRUrFRUVKxUVFRUrFRUVKxUVKxUVFSsVKxUVFRUVFSsVFRUrKysVFRUVFSsrFSsrFRUrFSsrFRUrFSsVKxUVFSsVFRUVKysVFRUVFSsVFRUVFRUVFSsrFRUrKxUrKxUVFRUrFRUVKysVFRUVFRUVFRUVFRUVFRUVKysVFSsVFRUVFRUVFRUVKxUVFRUrFRUVFRUVKxUVKxUrFRUVFRUVKysrFRUVFRUVFRUVFRUVFRUVFRUVFRUrKxUVFRUVFRUrFRUVFRUVKxUVFRUVKxUVFRUVFRUVFRUVFRUVFRUVFRUVFSsVKxUVFRUVFRUVKysVFRUVFSsVFRUVFSsVFSsVFRUVFRUVFRUVKysVFSsrFRUVFRUVKxUVFRUrFSsVKxUVKxUVFRUrFRUVKxUVFRUVFSsrKxUVFRUVFRUVKxUVFRUVFRUVFSsVFSsVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFSsrFRUrFRUVFRUVFRUVFSsVFSsrKysrFRUVFRUrFRUVFSsrFRUVFRUrKxUVFRUVFSsrFRUVFRUrFRUVFRUrFRUVFSsVKxUVFSsVFRUrFRUVFSsVFRUVFRUVFRUVFRUVFRUVKxUVFRUVKysVFSsrFRUrKxUVFRUVFRUVFRUVFSsVFRUVFRUrFSsVFRUVFRUVFSsVFRUVFRUrFRUVFRUVFRUrFSsVKxUVFRUrFRUVFRUVFRUrFRUrFSsVKxUVFRUrFRUrFRUrFRUVKxUVFSsVFSsVFRUrFRUrFRUrFRUVFSsVFRUVFRUrFRUVFRUVFRUVFRUVKxUVFRUVFRUVFRUVFRUVFSsVFRUrFRUVKxUVFRUVFRUVFRUVFRUVKxUVKxUVFRUVFRUrFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUrKxUVFRUrFRUVFRUVFRUVFRUVFRUVFRUVFRUVKxUVFSsVFRUrFSsVKxUVFRUVFRUVFSsVFSsrFRUrFRUVFSsVFRUVFRUVKxUVFSsVFRUVFRUrFSsVFRUVKxUVFRUVKxUVFRUVKxUVFRUVFRUVFRUVFSsVFRUrFRUVFRUVKxUVFRUrFRUVFRUVFRUVFSsVFSsVFRUVFSsVFRUVFRUVFRUVFRUrFRUrFRUVKxUVKxUVFRUVFRUrFRUVFRUVFSsVKxUVFSsVKxUrFRUVFRUVFRUVFRUVFRUVKxUVKxUVFRUVFRUrFRUVFRUVFRUVFRUVFRUVFRUVFSsVKxUVKxUVFRUVKxUrFRUrFRUrFSsVFRUVFRUVFRUrFRUVFRUVFRUVFRUVFRUVFRUVFRUrFRUVFRUrKysrFRUVFRUVKxUVFRUrFRUVFRUVFRUVKysVFRUVFRUVFRUVFRUVKxUVFRUVFSsVFRUVFRUVFRUVFRUVFSsVKxUVFRUVFNTU1OtU1NTU1NTU1NTU61TU1NTU1OtrVNTU1OtU1NTrVNTU1NTU61TU62tra1TU1OtU1NTU1OtrVNTrVOtU61TU1OtrVNTU61TrVNTU1OtU1NTU1NTrVNTrVOtU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTra1TrVNTU1NTU61TU1OtU1NTra1Tra2tra1TU1OtrVNTrVNTU1OtU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTrVNTrVNTU1NTU61TrVNTU1NTU1OtU1NTU1OtU1NTU1NTU1OtU1NTU1OtU1NTU1NTU1NTU61TrVNTU1NTU1NTrVNTU1NTU1NTU1NTU61TU1NTU1NTrVOtU1NTU1NTU1NTU1NTU61TU1NTU61TU1NTU1NTU1OtU1NTU61TU1NTU1OtU1NTU1OtU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTrVNTU61TU62tU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTrVNTU61Tra1TU1NTU1NTU62tU1NTU1NTU1OtU1NTU1OtU1NTU1NTrVNTU1OtU1NTU61TU1NTrVNTU1OtU1NTrVNTU1NTU61TU61TU1NTU1NTU1NTU1NTU61TrVNTra2tU1NTU61TU1NTU1NTU1NTU1NTU1NTrVNTrVNTU1NTU1NTU1NTrVNTU1NTU1OtU1NTra1TU1NTU1NTU61TU1NTU1NTU1OtU61TU1NTU1NTrVOtU1OtU61TU1NTU1NTU1NTU1OtU61TU1OtU61TU1OtU62tU1OtrVNTra1TU61Tra1TU1NTU1NTU1OtU1NTrVNTU1NTU1NTU1NTU61TrVOtU1NTU1OtU1NTrVNTU1NTrVNTU1NTU1NTU1NTU61TU61Tra1TU1NTU61TU61TU1NTU1NTrVNTrVNTU1NTU1NTU61TU1OtU62trVOtU1NTU1NTrVOtU1NTU1NTrVNTU1NTrVNTU62tU62tU1NTU1OtU1NTrVNTU61TU61TU1NTrVNTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1OtU62tU1NTU1OtU61TU1OtrVNTU1NTrVNTU1NTU1NTU1OtrVNTU1NTU1OtU1NTU61TU1NTU1NTra2tU1NTU61TU1NTU1NTU1OtU1NTU1NTU61TU61TU61TU1NTU61TU1NTU1NTU1NTrVNTU61TrVNTU1NTU1NTU1NTU1NTU1NTU1NTrVNTU1NTrVNTU1OtU1NTrVNTU1NTU1NTU1NTra1TU1NTU62trVNTU1NTU61TU1NTU61TU61TU1NTU1NTU1NTU1NTU1NTU1NTU61TU1OtU1NTrVOtU1NTU61TU1NTrVNTU1OtrVNTU1OtU1NTU1NTU1OtU1NTU1NTrVOtU1NTU61TU1NTU1NTU1OtU1NTU1NTU1NTU61TU1NTU1OtU1NTU1NTU1NTU61TU62tU61TU61TU1NTU1OtrVNTU62tU1NTU1NTU1NTU1NTU1NTrVNTU1NTU1NTU1NTU1OtU1NTU1OtU1NTU62tU61TU61TU1NTU1NTU1OtU1OtU1NTU1NTU1NTU1OtU1NTrVNTU1OtU1OtU1NTU61TU61TU1NTU1OtU1NTU1NTU1OtU1NTU1NTU62tU1NTU1NTU1NTrVNTU61TU1NTU1OtU1NTrVNTU1NTrVNTU1NTrVNTU1NTU61Tra2tU61TU1NTU1NTU1NTU61TrVOtU61TU1OtU1NTU1OtU1NTrVNTU61TrVNTrVNTrVOtU1NTU1NTU61TU1JSUq5SUlJSUlKurlKuUlJSUq6uUlJSUlJSrlJSUlJSrlJSUlJSUlKuUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUq5SUq5SUq5Srq5SUlJSUq5SUlJSrlKuUlJSUq5SUlKurq5SUq5SUlKurq5SrlKuUlJSUq5SUlJSUlJSUlJSrq5SUq5SUlJSUlJSUlJSUlJSUlJSUlJSUlKuUlKuUlJSrlJSrq5Srq5SUlJSrlJSUlJSUlJSUlJSUlJSUlJSrlJSUq6uUlJSrlJSUlKuUlJSUlJSUq5SUlKurlJSUlJSUq5SUq5SUq5SUlKuUq5SUq5SUlJSUlKuUlJSUq5SrlJSUq5SrlJSUlJSUlJSrlKuUlJSrlJSUlJSrlJSUlJSUlJSrlJSrlJSUlJSUq5SUlJSUlKuUlJSUlJSUlJSUlJSUlJSUlJSUlJSrq6uUq5SUlJSUlJSUlKuUlJSUlJSrq5SUlJSUlJSrlJSUlKuUlJSUlJSUlKuUlJSrlJSUlKuUq5SUlKurlJSUq6uUlKuUlJSUq5SUlJSUlJSUlKuUlJSUlJSUlKuUlJSUlKurlJSrlJSrlJSUq5SUlJSUq5SUlJSUq5SUq5SUlJSUlJSUq5SUlKuUlJSUlJSUlJSUlJSUq6urlJSrlJSUlJSUlKuUlJSUlJSUlJSUlJSUlKuUq5SUlJSrlJSUlJSUlJSUlJSUlJSUlJSrlJSUlJSUlKuUlJSrlJSUlJSUlKuUlJSUq6uUq5SUlJSUlJSUlKurlJSrlKuUlKuUlJSUlJSUlKuUlJSrlJSrlJSUq5SUlJSrlJSUlJSUlJSUq5SUlJSUq6uUlJSrlJSUlJSrlJSUlJSrlJSUlJSUq5SrlKuUq5SUlJSUlJSrq6uUq5SUlJSUlJSUlJSUlJSrq5SrlJSrlJSrlJSrlJSUlJSrlJSUq6uUq5SUlKuUlJSUlJSUlJSUq5SUlJSUlJSrlJSUlJSUlJSUq5SUlJSUlKuUlJSUq5SUlKuUq5SrlJSUlJSUlJSUlJSUlKuUlJSUlKuUq6uUq5SUlJSUlKuUlJSrlJSrq5SUlJSrlJSUlJSUlJSUlJSUlKurlJSUlJSUq5SUlJSrlJSrlJSUlJSUlJSUlJSUq5SrlJSrlJSrlJSUlJSUlKurlJSrq5SUlKurlJSUlKuUlJSUq5SUlJSUlKuUlJSUlKuUlJSrlJSUlJSUlJSrlJSUlJSUlKuUlJSrlJSUlJSUlJSUlJSUlKuUlKuUq5SUq5SUlJSrlKurq6uUlJSUlJSUlJSUlJSUlJSrlJSrlKuUlKuUlJSUlJSrlJSUlJSUq5SUq5SrlJSUlJSrlKuUlJSUlJSUlJSUlJSrlJSrlKuUlKuUlJSUlJSUq6uUlJSrlJSrlJSrq5SUlJSUlJSrlJSUq5SUlJSrlJSUlJSUlKuUlJSUlJSUq5SrlJSUlKuUq6urlJSrlJSUlKuUlJSUlJSUlKuUlKuUlJSrlJSUlJSUlJSUq5SUlJSUq5SUlJSUlJSUlJSrlJSUlJSUq5Srq5SUlJSUlJSUlJSUlKuUlJSUlJSUlJSUlJSUlJSUlKuUlJSUq5SUq5SUq5SUq5SUlJSUlJSrlJSUlJSUlJSUlKuUq5SUlJSUlKurlKuUq6uUlJSUlKuUlJSUlJSUlJSUlJSUq5SUlJSUq5SUlJSUlJSUlJSUlJSUlJSUlJSUlKuUlJSrlKuUq5SUq6uUlJSUlJSUlKuUq5SUlJSUq6urq5SUlJSUlKurlJSrlKuUlJSUq6uUq5SUlJSUq5SUlJSUlJSUlKuUlJSrq6urq6uUlJSrlJSUq5SrlJSUlJSUlJSUlJSUlJSUlJSUlJSUlKuUlKuUlJRUVGvUVFRUVFRr1FRr1FRUVFRr6+vUa+vUVFRUa9RUVFRr1GvUVFRUVFRr1FRUVFRUa9Rr1FRUVFRUa9RUVFRUVFRr1GvUa9RUVFRUVGvUa+vUVFRUVGvUa9Rr1FRUVFRr1FRUVFRUVFRUVFRUVGvUa9Rr1FRUVFRUVFRUVGvUVGvUVFRr1FRUVGvUa9RUVFRr1FRUVFRUa9RUVFRUVGvUa9RUVGvUVFRUVGvr1FRr69RUVFRUa9RUVFRUVFRUVGvUa9Rr69RUVFRUVGvUVFRUVFRUVFRUVFRUVGvUVFRr1FRUVFRUVGvUVFRUa+vUVFRr1FRr1FRUVFRUa9RUVFRUVFRr1FRUVFRUVFRUVFRUVFRUVFRUVFRUVGvUVFRr69RUa+vUVFRUVFRUVFRr1FRUVFRUVFRUVFRUVGvUVFRUVGvUVFRUVFRr1FRUa9Rr69RUVFRUVFRr1FRr1FRUa+vUVGvUVFRUVFRUVGvUVFRUVFRUVFRr69RUVFRUVFRUa9Rr1FRUVGvr1FRUVFRUVFRUVFRUVFRr1FRUa9Rr1FRUa9RUVFRUVFRUVFRUVGvUa9Rr1FRUVFRUVFRr1FRr1FRUVGvUVGvr1FRr69RUVFRUVFRUVFRUa9RUVGvUVFRUVGvr1FRr1FRr6+vUVFRUVFRUa9RUa9Rr1FRUVGvUa+vUVFRUVFRUVFRUa9RUVGvUVFRUVGvUVGvUa+vr1FRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUa9RUVFRUVFRUVFRr1FRr69RUVFRUVFRUVFRUVFRr1FRr1FRUVFRUVFRUVFRr1FRUVFRUa9RUVGvUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVGvUVFRr1FRUVFRUVGvUVFRUVFRUVFRr1FRr1FRr1FRUa+vr1FRUVGvUVFRUVFRUVFRUVFRUVFRr1GvUVGvUVFRUVFRUVFRr1Gvr1FRUVFRUVFRUVFRUVFRUVFRUVFRUVFRr1FRUVGvUa9RUa9RUVFRr1FRUa9RUa9Rr69Rr1FRUVFRUVFRr1FRUVFRUVFRUa9Rr6+vUVFRUVFRUa+vr69RUVFRr1FRUVFRUVFRUVGvUVFRUVFRr1FRr1FRUVFRUa9RUVFRUVFRUa9RUVFRUVFRUVFRUVFRUVFRUVGvUVGvUVFRUVFRUVGvUa9RUa9RUa9RUa9RUVFRUVFRUVGvUVFRUVFRUVFRUVFRUVGvr1FRr1GvUa+vUVFRr1FRUVFRUVFRUa+vr1FRUVFRUVGvUa9RUVFRUVFRr1FRUVFRUVFRUa9Rr69RUVFRUVFRUVFRUVFRUVFRUVGvUVGvUa9RUa9RUVFRUVFRUa+vUVGvr1FRUVFRUVFRUVFRr1FRr1FRUVFRUVFRr69RUa9RUVFRUVFRUa+vUVFRr1FRUVFRr1FRr6+vUVFRr1FRr1FRUVFRUVFRUVFRUVGvUVFRUVFRUVFRUVGvUa9RUa9RUVFRUVFRr1GvUVFRUVFRUVFRUVFRUVFRUVFRUVFRUa9RUa9RUVFRUVFRUVFRUVGvUVFRUVGvUVFRUVFRUVFRUVFRUVFRr1FRUVFRUVFRUVFRUVFRr1FRUa9RUVFRUa9RUVFRUVGvUVGvr1FRr69Rr1FRUa9RUa9RUVFRr1FRUVFRUa+vUVFRUa9Rr1FRUa+vUVFRUVFRUVGvUVFRUa+vUVFRUVFRUVGvUa9RUVFRUVFRUVFRr1FRUVFRUVFRUVFRUVGvUVFRUVFRUVFRUVFRUVFRUVFRUVFRr1GvUVFRUVGvr1FRUVFRr1FRUVFRUa9RUVFRUa9Rr1FRr1GvUa+vUVFRr1FRUVFRUVFRr1GvUa9RUVFRUVFRUVFRUVGvUVFRr1GvUVFRr1FRr1FRUVFRUa+vr1FRr1FRUVGvUVFRUVFRUVGvUVFRUVGvr1Gvr69RUVGvUVFRUVFRr1GvUVFRr1FRUVGvr1FRUVFRUVFRUVFRUVFRUVFRUa9RUVGvUVFRr1FRUVGvUVFRUVFRUa+vUVFRr1FRUVFRUVGvUVFRr1FRUVFRUVFRUVFRUVFRr1FRUVGvUVFRUVFRUVFRUVCwsFBQsFBQUFBQUFCwsFBQsFBQUFCwUFCwUFBQUFBQsFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQsFCwUFCwUFBQUFBQUFBQULBQUFBQUFBQsLBQUFBQULBQUFCwUFBQULBQUFCwUFBQUFBQULCwUFBQUFCwUFCwsFBQULBQUFBQULBQsFBQUFCwsFBQUFBQUFBQsFBQUFBQULBQUFBQUFCwUFBQsLBQsFBQsFBQsFBQUFCwUFBQUFBQsFBQULBQULCwULCwUFBQUFBQsFBQsFBQUFBQUFBQULCwULCwUFBQsFBQULBQUFCwsFBQUFCwsLBQUFBQUFCwUFBQUFBQUFCwUFBQUFBQULBQUFBQULBQsFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQsLBQUFBQUFBQUFBQUFBQUFBQULBQsLCwUFCwsFBQUFCwUFBQUFBQULBQUFBQsLBQUFBQULBQUFBQsLBQULBQUFBQUFBQUFBQUFBQUFBQULCwUFCwUFBQUFBQUFBQsLCwsFBQsFBQsLBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQULBQUFBQsLBQUFBQUFBQUFBQUFBQUFBQsLBQUFBQsFBQUFBQULBQUFBQsFBQUFBQUFBQsFBQsFCwsLBQULBQUFBQUFBQUFBQUFBQUFBQUFBQsLBQsFBQUFBQUFBQUFBQsFBQUFBQUFBQUFCwUFBQUFBQsFCwsFBQsFCwUFBQUFBQUFBQULBQUFBQULBQUFBQUFBQULCwUFBQULCwUFCwUFBQULBQUFBQUFBQUFCwUFBQsFCwUFBQULBQUFCwUFBQUFBQUFBQUFBQUFCwsFBQUFBQUFBQULBQUFBQsFCwUFBQUFCwUFBQUFBQUFBQUFCwULBQULCwsFBQUFBQUFCwUFCwsFBQULBQUFCwUFCwUFBQUFCwsFBQUFBQUFCwsFBQUFBQsFBQUFBQULBQUFBQsLBQUFCwUFBQULBQUFBQUFCwUFBQUFBQUFBQUFBQUFBQUFBQsLBQULCwsFBQsFCwUFBQULBQUFCwsLCwUFBQUFBQULCwULCwULBQsFBQUFBQUFBQsFBQsLBQsLBQULBQUFBQULBQUFBQUFBQUFBQUFBQUFBQUFCwUFBQsFBQULCwULBQsFBQULBQULBQsFBQsFBQUFBQUFCwULBQUFBQUFBQUFCwUFBQsFBQsFCwUFBQUFBQUFBQUFBQUFCwUFBQUFBQUFBQUFBQsFBQUFBQUFBQULBQsFBQsFBQULCwUFBQUFCwUFBQUFCwUFBQULBQUFCwUFBQUFBQUFCwUFBQUFBQUFCwUFCwUFBQULBQULBQsFBQUFBQUFBQUFBQsLCwUFBQUFCwULBQUFBQsFCwUFBQUFBQUFBQULBQsFBQUFBQULBQULCwUFBQUFBQsFBQsFBQUFBQULBQUFBQUFBQUFCwUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCwUFBQUFBQUFBQUFBQUFBQULBQUFBQsFBQUFCwUFCwUFBQUFBQUFCwULBQUFBQULBQUFBQUFBQsFBQsFBQUFBQULBQUFBQsFBQUFBQsFBQsFBQUFBQULBQULBQULCwULBQsLBQUFBQUFBQUFBQsFBQsFBQUFBQsFCwsFBQULBQULBQUFBQUFBQUFBQsFBQUFBQULBQsFBQUFBQsFBQsFBQULBQUFBQUFBQUFCwUFBQUFBQUFCwUFBQULBQUFBQsFBQsFCwsFBQUFBQUFBQUFBQUFBQUFBQsLBQUFCwUFBQUFBQULBQsLBQUFBQUFBQUFBQsFBQUFBQUFBQUFBQUFBQUFBQUFBQsLBQULBQsFBQUFBQUFBQULBQUFBQUFBQsFBQUFCwsFCwUFBQUFBQUFCwsFCwUFBQUFBQULBQUFBQsLCwUFBQUFBQULCwUFBQUFBQUFBQsLBQULBQsFBQUFBQUFBQULCwULBQUFBQUFBQULBQUFBQsFBQUFCwUFCwsLBQUFBQULBQsFBQUFBQUFBQsFBQULBQUFCwUFBQUFBQUFBQsFBQUFBQUFBQUFCwUFBQsLBQULBQUFCwUFBQUFBQULBQsFBQULBQUFBQULBQUFBQUFBQUFBQUFBQUFBQUFCwUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQsFBQUFBQUFBQsFCwUFBQUFCwUFBQUFBQsFBQsFBQUFBQsFBQUFBQsFBQUFBQsFBQUFBQUFBQUFBQUFCwUFCwUFBQsFBQUFBQUFCwUFCwUFCwUFBQUFBQUFBQsFBQUFBQUFCwULBQULBQULBQUFBQUFCwUFBPT09PT09PsU9PT09PT09PT09PT09PT09PsU+xT09PT0+xsbFPsbFPT09PsU9PT09PT0+xT09PT09PT09PT7FPT09PT09PsU+xsU+xT09PT09PT7GxT09PsU9PsU+xT7FPT09PT09PT7FPT09PT09PT09PsbFPT09PT7GxsU9PT09PT09PT7FPT7FPT09PT09PT09PT09PT09PT0+xT0+xT09PT09PT09PT7FPT09PT09PT7FPT09PT7FPT09PsU9PT09PT09PT09PT0+xT09PT09PT09PT09PT0+xT09PT09PT7FPsbFPT09PT09PT09PT09PT09PT0+xT09PsU9PT0+xT09PsU+xT09PT09PT09PT7FPT09PT09PsU9PT09PT7FPT09PT0+xT09PsU9PT09PT09PT09PsU+xsbFPsU9PsU9PT09PT0+xT0+xT09PT09PT09PT09PT09PsbFPT7FPT09PsU9PT7GxT09PT0+xT0+xT09PT7GxsU+xsU9PT0+xT7GxT7FPT09PT7FPT0+xT09PsU9PsU9PT09PT0+xT09PT09PT09PT09PT7FPT09PT7FPT09PT09PT0+xsU9PT09PT7FPT0+xT09PT09PT7FPT7FPT09PT09PT09PT09PT09PT0+xT0+xsU9PT7GxT09PT0+xT7FPT09PT09PT7FPT09PT7FPT0+xT09PT7FPsbFPT09PT09PT7FPsU9PT09PT09PT09PT09PsU9PsbFPT09PT09PsU9PT09PT09PsU9PsbFPT0+xT7FPsU9PT7FPT09PT0+xsbFPT09PT7FPT09PT09PT09PT09PT0+xT09PT09PsU9PT09PT09PT09PsU9PT7GxT09PT09PsbFPsU9PT09PT09PT09PsbGxT0+xT09PT0+xT09PT0+xsbFPsU9PT7FPsU9PsU+xsU9PT09PT09PT09PT09PT09PsU9PT09PT09PsU9PT09PsU9PsU9PT09PT09PT09PT09PT7FPT09PT7FPsU9PT09PsU+xT09PT0+xT09PT09PT7FPT09PsU9PT09PT0+xT09PT09PsU+xT7FPT09PT09PT7FPT09PT7FPT09PT0+xsU+xT09PT09PT09PT7FPT09PT09PT09PT7FPT7FPT09PsU9PsU+xT7FPT7FPT09PT7GxT0+xT09PsU9PT0+xT09PT0+xT09PsbFPsU+xT7FPsU9PT09PT09PT09PT7FPsU9PT09PT09PT09PsU+xT09PT7FPT09PT09PsbFPsbFPsU9PT09PT09PT09PT09PT09PT09PsU9PT09PT7FPT0+xT09PT09PT09PT7FPT09PT09PT09PT09PT09PT09PT09PT0+xT7GxT09PT09PT09PT09PT09PT09PT09PT09PT09PsU9PT09PsU9PT7FPT09PT09PT09PT09PT7FPT0+xT09PT7FPT09PT09PT7FPT09PT0+xT09PsU9PT09PT09PT7FPT09PT09PT09PT09PsU9PT7FPT09PT09PT0+xT09PT09PT0+xT09PT09PT09PT09PsU+xT0+xT09PT09PT7GxT7FPT0+xT09PT09PT09PT09PT09PT09PT09PT0+xT09PT09PT0+xT09PT7FPT09PT09PT09PT09PsbGxT09PsU9PsU9PT0+xsU9PT0+xT09PT7FPsbFPT7FPT09PT09PT09PT09PT0+xT09PT09PT0+xT09PT7FPsbFPT7GxT09PT7FPT09PT09PT7FPT09PT09PT09PT7GxT7GxsU9PT09PT7FPT09PT7FPT7FPT7FPT09PT09PT0+xT09PsU9PT7FPT0+xT09PT7FPsbFPT09PT09PsU+xT09PT0+xT0+xT09PT09PT7GxT09PT09PT0+xT09PT09PT0+xT09PT09PsU9PsU9PT09PT09PT09PT09PT7GxT09PT09PT09PT0+xT7FPsU9PT0+xT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PsU9PT09PT7FPT09PT09PT09PT09PT0+xT0+xsbFPT09PsU9PT7FPsbFPT09PT09PT09PsbGxT7GxT7GxT7GxT0+xsU+xT09PT09PT09PT09PT09PT0+xT09PT7FPsU+xT09PT7GxsU9PsU9PsU9PT09PT09PT09PT09PT09PsU9PT7FPsU9PT7FPT09PT7FPT0+xT09PT09PT09PT09PT09PT0+xsU+xsU9PT09PT09PT09PT09PT09PsU9PT7FPT7FPT0+xT09PT7FPT0+xT0+xT09PT0+xT09PT09PT09PT7FPT09PT09PT7FPsU9PsU+xT09PT09PT7FPT09PT7FPT09PT09PsbFPT7FPT09PT09PT09PsU9PT0+xT7GxT09PT09PsU+xsU9PT0+xT09PsU9PT7FPT09PT09PT0+xT7FPT09PT0+xT7FPT09PT09PT09PsU9PT09PT09PsU9PsU9PsU9PT09PT09PT09PT09PT09PT09PT09PT09PsbFPsbFPT09PsU9PT09PT09PsU9PTk5OTrJOTk5OTrJOsk5OTrKysk5OTrJOTk5OTk5OTk5Osk5OTk5OTrJOsrKyTk5OTk6ysk6yTk6yTk5OTk6ysk5OTk5OTrKyTrJOTk5OsrJOTk5OTk5OTk5OTk5OTk5OTk6yTk5OTk6yTk5OTk6ysk5Osk5OTrJOTrKysrJOsrJOTk5OTk5OTrJOTk5OTrKyTk5OTrJOsrJOsk6yTk6yTk6yTk6yTrJOTk5OTk6ysk5Osk5OsrKyTk5OTk5OTk5OTk5Osk5OTk6ysk6yTk5OTk6yTk5OTk6yTk5OTk5OTk5Osk5OTk6yTk5OTk5OTk5Osk5OTrKyTk5OTk5OsrKyTk5OTk5OTk6ysk5Osk5OTk5OTk5OTk5Osk5Osk6yTk5OTk6ysk5OTk5OTk5OTrJOsk6yTk6yTk5OTk5OTk5OTrJOTk5OTrJOTk5OTk5OTk5OsrKysrJOTk5OTk6yTk5OTk5Osk5OTk5OTk5OTk5OsrJOTrJOTk6yTk6yTk5Osk5OTk5OTk5OTk5OsrKyTk5Osk5OsrJOTk5OTk5OTk5OTrJOTrKyTk6yTk5OTk6yTk5OTrKyTk5OTk5Osk5OTk5OTk5OTk6yTk5OTk5OTrJOTk6yTrJOTk6yTk5Osk5OsrKyTk6ysk5Osk5OTk5OTk5OTrJOTk5OTk5Osk5OTk5Osk5OTrJOTk5Osk5OsrJOsk5OTrJOTk5Osk5OTk5OTk5OTrJOTk5OTk5OTk5OTrJOTk5OTrJOTk6ysk5OTk6yTk5Osk5OsrJOTk5OTk5OTk5OTk5OTk5OTk5OTk5Osk5OTk5OTrJOTrKyTk5OsrJOsrJOTrJOTk6yTk5OTk5OTk5OTk5OTk5OTrKyTrJOTrKyTk5OsrJOsk5OTrJOTk6yTk5OTk5OTk6yTk5OTrJOTk5OTk5OTk5OTk5Osk5OTrJOsk5OTk5OTk5OTk6yTk5OTk5OTk5OTk5Osk5Osk5Osk5Osk5OTk5OTk5OTk5OTk5OTrJOTk5Osk6yTk6yTk5OTk6ysk6yTk6yTk5OTk5OTrJOTk5OTk5OTk5OTk6yTrJOTk5OTk5OTrJOTk5OTrJOTk5OTk5OTrJOTk6yTk5OTrJOTrJOsrJOTk5OTk5OTk5OTk6yTrJOTk5OTrKyTk5OTk5OTk5OTk6ysk5OTk5OTk5OTk6yTk5OTk5OTk5Osk6yTk6yTrJOTk6ysk6yTk5OTk5OTk5OTk5OTk5OTk6yTk5Osk5Osk5OTrJOTrJOTk5Osk5OTrKyTk5Osk5OsrJOTrJOsk5OTk5OTk5OTk5OTrKyTk5Osk5OTk5OTk5OTrJOTk6ysrJOTk5OTk5OTk6yTk6yTk5OTrJOTrJOTk5OTk5OTk6yTrKyTk5OTk5OTk5OTk5OTk5OTrJOsk5OTk5OsrJOsk5Osk5OTk5OTk6yTk5OsrJOsk5OTk5OsrJOTrKyTk6yTk5OTk5OTk5Osk6ysrJOsk5OTk6yTk6yTrJOsk5OTrKyTk5OTk5OTk5OTk5OTk5OTk6yTk5OTk6yTk5OTk5OTk6yTk6ysk5OTk5OTk5OTk6yTk5Osk5OTk5OTk5OTk5OTk5OTk5OTrJOTk5OTk6yTk6yTrKyTrKyTk5OTk6yTrJOsk5OTk5OTk6yTk5OTk6yTk5OTk5OTk5OTk5OTk5OsrJOTk5OTk5Osk5OTk6ysk5OTk5OTk5OTk5OsrJOTk5OTk5OTk6yTk6yTk5OTk5OTk5OTrJOTk5OTk5OTk5OTrJOTk5OsrJOTrJOTk6ysrJOTk5OTk6ysk6yTk5Osk5OTk6yTk6yTk5Osk5OTk6yTk6yTk5OTk5OTk5OTk5OTk5OTk5OTrJOTk5OTk5OTk5OTrJOsk5OTk5OTrJOTk5Osk5OTrJOsrJOsk5OTk5OsrKysrJOTk5Osk5OTk5OTk5Osk5OTk5OTk5OTk5OTk5OTk6yTrKyTrJOTk5Osk5OTrJOTrJOTk5OTk5OTrJOsk6yTk5OTrJOTk5OTk6yTrKysk6yTk6ysk5OTk5OTk5OTk5Osk5OTrJOTk5OTk5OsrJOTk5Osk5Osk5OTk5OTk6yTk5OTk5OTk5OTk5OTk6yTk5OTk5OTk5OTk6ysrJOTk5OTk5Osk6ysk5OsrJOsrJOTk6yTrJOTk5OTk5OsrJOTk6yTk5OTk5OTrKyTk5OTk5OTk5OTk6yTrJOsk5OTk5OTk5OTk6ysk5Osk6yTk5Osk5OTk5OTk6ysrKyTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTrJOsk5OTk5Osk5OTk5OTk5OTk5OTrKyTrJOTrJOTk5OTk5OTk5Osk5OTk6yTrJOTk5Osk5OTk5OTk5OTk5OTk5OTk6yTk5OTk5OTrJOTk5Osk5OTk5OTk5OTk5OsrKyTrJOTk5OTrJOTk6yTk6yTk5OTrJOTk6yTk5Osk5OTrJOTk6yTk5OTk5OTk5OTk5OTk5OsrJOsrJOTk6ysk5OTk6ysk5Osk5OTrJOTk5OTrJOsrKyTk5Osk5Osk5OTk5OTk5OTk5Osk5OTrJOTk5Osk5OTk5OTk5Osk5OTk5OsrKyTk5Osk6yTk5OsrJOTk5OTk5OTrJOsk5OTk5OTrJOsk5OTk5Osk5OTk5OTrJOTk5OTk5Osk5Osk5OTrJOTk5OTk5OTk6yTk5OTk5OTrJOsk5OTk5OTk5OTrKysk5OTk5OTk5OTrKyTk5OTk6yTk5OTk5OTk5OsrJOsk5OTk5OTrKyTrJOTk5OTrJOTk6yTk5OTrJOTrJOTk5OTk5OTk5OTrJOsk5OTk5OTk6yTk5Osk6yTk6yTk6ysk6yTk5OTk5OTk5OTrKyTk5Osk5OTk5OTk5OTrJOTrJOTk5OTk5OTrKyTrJOTk5OTk5Osk2zTU2zTU1NTU1NTbOzTU1NTU2zs02zTU1NTbNNTU2zs01Ns02zs01NTbNNs01NTbNNTU1Ns02zTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTbNNs01NTU1NTU1Ns02zTbOzTbNNTU1Ns02zTU1NTU1NTU1NTU1NTU2zTU1NTbOzs7NNTU1NTU1NTbNNTU2zs02zTU1Ns7NNs02zTU1NTU1NTU1NTU2zTU1Ns01NTbNNTU1NTU1NTU2zTU1NTU1Ns01NTU1NTU1NTU1NTU1Ns01NTbNNs01NTbNNTbNNs01Ns02zTU1NTU2zs02zTU1NTU1NTU1NTbNNTbOzTU1Ns02zTU1Ns02zTbOzTU1Ns01NTU1Ns02zTU1NTU1Ns02zTU1Ns01NTU2zTU1NTbNNs02zTU2zTU2zTbNNs02zs01NTU1NTU1NTU1NTU1NTU2zTU1NTU1NTbNNs01Ns01NTU1Ns02zs02zTbOzTU1NTU1NTU1NTU1NTU1NTbNNTU1NTU1Ns01NTU1Ns01NTU1NTbNNs01NTU1Ns7OzTU1NTU1NTU1NTU1NTU1Ns01NTU1NTU1NTU2zTU2zs01NTbNNTbNNs01NTU1NTU1NTU1NTU2zTU2zTbNNTU1Ns02zs01NTU1Ns01NTbNNTU1NTU1Ns01NTbNNTU2zTU1NTbNNTU1Ns7NNTU1NTU2zTU1NTU1Ns01Ns01NTU1NTU2zTU1NTU1NTU2zTU1NTU1NTU1NTU1NTU2zs01NTU1NTU1Ns01NTU1NTU1NTU1NTU1NTbNNTU1NTU1NTU1Ns01NTbNNTbOzTbNNTU2zTbOzTU1Ns01NTU1Ns01NTbOzTU1NTU1NTU2zTU1NTU1NTU1NTU1NTU1NTU1NTbNNTU1NTU1Ns01NTU1Ns01NTU1NTU1Ns01NTU1NTbNNTbNNTU2zTU1NTU1NTbNNs01Ns01NTU1NTU2zTU1NTU1NTbNNs7NNs01NTU2zTU2zTU1NTbNNTU2zs01NTU1NTU1Ns7OzTU2zTU1NTU1NTU2zs02zs01NTbNNTU1NTU1NTU2zTU2zTbNNTU1NTU1NTU1NTU1Ns01NTU1NTU1NTbNNTU1NTU1NTbNNTU1NTbNNTbNNs01NTU2zTU1NTU1NTU1NTU2zTU2zTU1NTU1Ns01NTbOzs7OzTU2zTU1NTU1NTU1Ns01Ns7NNTU1NTU1NTU1NTU2zs7NNTU1NTU1NTU1NTU1NTU1NTbNNTU2zTU1NTbOzTU1NTU1NTU1NTU1NTbNNs01NTU2zs7NNTU1Ns02zTU1Ns7NNs01Ns01NTU1NTU1NTU1NTU1NTU1Ns01NTbNNTU1NTU1NTU2zs01NTU1NTU2zTU1NTU1NTbNNs01NTU1NTbNNTbNNs01Ns01NTU1NTU1NTbNNs02zs01NTbNNTU1NTU2zTU1Ns7NNTU1NTU2zTU1NTU1NTU2zTbNNTbNNTU1NTU1NTU2zs7NNTU1Ns02zs7NNs01NTbNNTU1NTU1NTbNNTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1Ns01Ns01NTU1NTU1NTU1Ns02zTU1Ns01NTU2zs01NTU1Ns01NTU1NTU2zTU1Ns01NTU1NTU1NTU2zTU1NTbNNTbOzTU1NTU1NTU1NTU1Ns01NTU1NTbOzs01NTU1NTU2zTU1NTU1NTU1NTbNNTU1Ns01NTU1Ns02zTU1NTU2zs01NTbOzTU1NTU2zTU1NTU2zs7OzTU1NTU1Ns02zTbNNTbOzTU2zTbNNTbNNTU1Ns01NTU1NTU1NTbNNTU1NTU1NTU2zTbNNs01NTU1NTU1Ns01NTU1Ns01NTU2zTU1Ns7OzTbNNTU1NTU1NTU1NTbOzTU1NTU1Ns01NTU2zTbNNTbNNTU1NTU1NTbNNTU1NTbOzTU2zs01NTU1NTU1NTU1NTU1NTU1Ns7NNTU1NTU1NTU1NTU1Ns01NTU1NTU2zTU1NTU2zTU2zTU1NTU1NTU1Ns02zTU2zTU1NTU1NTU2zTU2zTbNNTU1NTU1NTbNNTU1Ns01Ns01Ns01NTU1Ns02zTU1NTU1NTU1NTbNNTU1NTbNNTU1Ns01NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTbNNTU1NTU1Ns01NTbNNTU1Ns01NTU1NTU2zs01NTU1NTU2zTU1Ns01Ns01NTU1NTU1NTU2zTU1NTU1NTU1NTU1NTbNNTU1NTU1NTU2zTU1NTU2zs7NNs01NTU1NTbNNs01Ns7OzTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1Ns02zTU2zs01NTU2zs7OzTU1NTU2zTU1Ns02zTbNNTU1NTbNNTU1NTU1NTbNNTU1NTU1NTbOzTU1Ns01NTU1Ns01NTU1NTU1NTU1NTU1NTU1NTbNNTU2zTbNNs01NTU1NTU2zTU1NTU2zTbNNTU1NTbNNTU1NTU1NTU1NTU2zs01NTU1NTbNNs7OzTU1NTU1NTU2zTbOzs02zTU1NTU1Ns01NTU1NTbNNs01NTbNNTU1NTU1NTbNNTU1NTbNNTU1Ns01NTbOzs01NTbNNTU1Ns01NTU1NTU1NTU1Ns01NTU1NTU2zTU2zTU1NTU1NTU1NTU1NTU1Ns02zTU2zTU1NTU2zTU1NTbOzs02zTU2zTU1NTU1NTU2zTU1NTbNNTbOzTU1Ns01NTU1NTU1NTU1NTU1NTU1Ns01Ns01NTU1NTU1NTU1NTU1NTU2zTU1NTU1NTU1NTU1NTbNNTU1NTU1NTbNNTU2zTbOzTU1NTbNNTU1NTU1NTU2zTU1NTbNNTU1NTU1NTU1Ns7NNTbNNs01NTbNNTU2zTU2zTU1NTU1Ns01NTU1NTU1NTU1NTbNNTU2zTbNNTU1NTbNNTU1NTbOzTU1NTbNNTU2zTU1NTU1NTU1Ns01NTU1NTU1NTbNNTU1NTU1NTU2zTU1Ns01NTU1NTU2zTU1NTU2zTU1NTU1NTU1Ns02zTbNNTbNNTbNNs7NNTU1NTU1Ns01NTU1NTU1NTbNNTU1Ns02zTU1NTU1NTU1NTU1NTU1NTbNNTU1NTbNNTbNNTU1NTbNNTbOzTU1NTbOzTU2zs02zTU2zTU1NTbNNs01NTU2zTU1NTUxMTExMTEy0TExMTLS0TExMTExMTEy0TExMTEy0TLRMTExMTExMTExMTExMtExMTExMTEy0TExMTEy0TExMTExMTExMtLRMTLRMtExMTEy0TExMTEy0TLRMTExMTEy0tLS0TExMTExMTLRMTExMTExMTExMTExMTExMtLS0TLRMtExMTExMTLRMTExMTEy0TExMTEy0TEy0TEy0TExMTExMTExMTLRMtLRMTExMTExMTLRMTEy0TExMTLRMTEy0tEy0TExMTExMTExMtExMTEy0TEy0tExMTExMtLS0TExMTExMtExMTExMTLS0tExMTExMTExMTExMTLRMTExMtEy0TExMTExMTLRMTExMTExMtExMTLRMtExMTLRMtExMtExMTLS0TExMTEy0TExMTExMTExMTLRMTEy0TLRMTExMTExMTExMTExMtExMTExMTExMTExMTExMtExMTExMtLRMtEy0TEy0tEy0TExMTExMtExMTExMTExMTExMTExMtExMTLS0tEy0TExMTExMTExMTExMtExMTLRMTLRMtExMTExMTLRMTExMTEy0TEy0TExMTExMTEy0TExMTExMTExMTExMTEy0tLRMTLRMTExMTEy0tExMtExMTExMtEy0TExMTExMtExMTExMTExMTLRMTLRMTLRMTExMTExMTExMTLRMTExMTLRMTExMTExMtLRMTExMTLRMTExMtExMTExMtExMTExMtLS0TExMtLRMTExMTLRMTExMTExMTEy0TLRMTExMTLRMTExMtLRMtExMTExMTEy0TExMTExMtEy0TEy0TExMTExMTExMTEy0TExMTEy0TExMtLRMTExMTLRMTExMTExMTLRMTLRMTExMTEy0tLS0TExMTExMTExMTExMtEy0TExMTLRMTExMtExMTExMtEy0tExMTLRMTExMTEy0TExMTExMTLS0TExMTExMTExMtLRMTLRMTExMTLRMtExMTEy0TExMTExMTLRMtExMTExMTExMTExMTExMTEy0TExMTA==","wScale":0.007874015748031496,"split":"e39jf39/f39af3J/f39/f39/f39/f39/Y39/f39/f3t/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f2F/f397f39/f39/f39/e3t/Y39hf39jf39/f3t/f39/f39/f2N/f39hf2N/f39/f2F/f39/f39/e39/f397f39jf39/YX9/f39/f39/f39/X39/f39/f39/f39/f39hf39/f29/f2djf39Bf3pjf39/f39/f39/Y39/f39/f39/f39/f39/f39/f3t/Y39vf39/f39/f3NBf39/Y39/e39/f39/f39jf39/f39/f29/e39/f2t/f39/c39/f39/e3t/f39/e39/f393f39rf39/f39/f39/f3t/f39/b39/f39/f397f39/e39/f39/f39/f39/c39/f3Nzf39/f39/f39/f2N7f39/f39/c2F/f39/f2t/f39/f3N/f39/f39/f39/YWF/f2Nvb39/f29zf397f397f2Nrf39/f39/a3t/c39/f39/b39/f2N3Y39/f39/YX9/Y39/f39/e2N/f3t7f39/f3t/a29/f39vf2t/QX9/f39/f2Njf2t/e2F/f39/f39jf39jf2d/b39/Y397f39/f39/e3t7f39/f39/e3tje2N/Y39/e39/f29/f2N/f39re39/f3tra397f39/f29/f39/f39he3tjf39/f2N/f3t/f39/b39vf39jf38wf3N/f39/e39/d3N/e39/f3t/f39/f3t/e39/d397f3t/f39/f39ze39/f2N/f39/f3dhf29/f39/e29/f39/f39/c39/f39/f39/f39/f393f39jf29/e297f3tjY39jf29/e39/f2Naf39/f29hf393f39/f397f39/f39/f39/f39/f397f39/a3tvZ3t/f3N/b39/f2N/f39vY2t/f2d3f39vf39/YX9/c39/f39/e39/f3t7e39/f39/f39/f3t/e2Njf39/f3t/f39/f39jf39/b3trY39/f3t/f39/f39/f39/f397f2N/f2t3f39/f397f39/f39/e297e39/a39/f39/f3t/f39/f3t/f39/f3t/P3t/f29vf3t/f2N/f39jY29/f39/f39/b2N/QXt7f39vf39/a39/f39/e39/f39/f29rf2N/f39/f39je2t/d39/f39/f39/f2N7f39/f3NzQ39/f39jf3t7Y39/YXN/QX97e39/f2N/f39/fzp/Y39/f39vb39/f39hf39/f29/f39vf2tvc39/f397b3t/f29rf397e2N/b39/f39/e297f393f393d39/c2N/f2tvf397f397f39/f397c39re3t/a39rZ39jf3d7a39qY3t7f39/f2t/f39/f297e39/e3t/f2N/f2Njf3Nra0Frf397Y38/f2N/c39/f39rf39/dz97f2t/f39/Y39/f3t7e2F/e397e3t/f3s5f2t/c2t/Y397f39jf39/f397c29jf39nf3t3b39/f29/Y39/f3tjf397f39/b3t/Y3t/f39/f2N/f39/b39/f2t/f39Sf2p/f29/b3t/e39vf39/a39jf39/f3t/f39/Y39/Y3t/f39/f397f39/e2N7f39/e2trf39rf39rf2Nrf39je39zf39je29vf39/f39/f2Nrf39/f3t7c2N/a39/e3N/a29je39/f2N/f39/f0NBf39/c3thf0F3Y397f39vd39zf39vY39/f3t7c39/a3dje39hY3t/f3tvf3t3f3t/f3tjP39/e397f2t7e39/QX9/f39jf39/d39/f2Nrf39/cz9/f39/f39vb29zf1p/f3t/W3d/b3t/f2Nvc3d7f29vf3N/f29ve3t/e39/f39/f3t/d3d/f29nYX9/e3N/f39jf2t/f2tjb39/e396f397f393f39rf397f2N/c39/e2t/a397b39/b2N/f397Y39/f39/d39/e39jc39/e39/P2t/d39/f39vb29/f39/b2d7f39/Y39vf2t7a39/f39/a29/f39vf39/f397f39/e397f39/f3t/f39ja39nf39/f39/f29rb397f39/f2Nne39/b39/f39/f397f39/Y3tjf39/f29/f39jd3N/e39/f39/b39/Y29/e39za29/e3t7f2Nvf39/e39/P39/c2N/f29/f39/f3M/f2N/a3t7f29hYnt/e3thf29/Z39/f39/f39vc2t7f2dvf39je397b39je39rf39/e0F/QXdzf2dne393f3tvf2d7f39/f3t/f2tzf38/f38/f39vf39/f39ran9/f3Nvf39/e39/f397f39/P39rf28/f3t/f39jZ39jf29jf3tve39jf39/Y397f2N7fz9zY39/f3N/J39ja3t/f3N/f3Nnf39vJXNjY39/f39/Y39/d2Nre2t3f397Y3d/f3s/e19vf393fz97d39vc39/b39/f39/b39/f39/b2d7f2N/S397Ont/f2N/e387e39/f39/a2N7Y2t7e39vQXt/e397f39ve2d/f2N7f39/Y3N/f3pva397Y3tve39/f397e39/e39je3t/c39rf397f39jf397Y39rf39hb39/f3t7c2t7a297Y397f2Njf393b39/b3d/e2t/e39jf39/e2t/e39/f39/f3tBf2N/Y3t/d397Y387a29vf39jf39/f3d/f39/a2thY397d39/e3tjf39jY2N7fz9nf3t7b39rf2d/f39ve2N/f3d/f2N/b297Y397f39/b29/f2N/f39/fz9ne39/YX9vY2d/f397f393QX9/Y397f3t/f3d/f3d/L39/f39/f3t/Y3t7f39vP2t/fz9/Y3t/f39/J397fz97f3dzf39ne39/a387e39/f38/f39nc3t/f2N7fz9jf2Frfz9/e39je39/e39jf3N7e397f39/f39/f3s/b3t/f293f28/e29/f39ja3t3f397f2Nve3tnf3t/c39vf2N/Z3dvf2d/e29/f39Sf3N7c2t/Y29/e2trf2N7b297e39/f2d7e397f29/f39/f39zf3t/P29/e39/b2d7f3dzf2NzQ39jf397c39rf2d/Y2N/Y39/f2t/f397f3t/f2d7f39/f39/Y2d/f397Y39/Y39vf2N/e2N7f2t3f397f38/a3d7f397f39rY3t/O29je39/f39/c39/f2Njb0N7e39/b287f39Bf39/e29nf39vY397a3tja39/f39rP39jf3t/Y2dzf397Y2N/Y2Njb29vf39/Y39/P39/f397f39/ant/P2N/a39/f2t7P3NBP3t3e3t/fz97f2Njf2t7cz9/c39/f29/b3t7f39jY397b3t/f29vf3N/b39jT397f3N/e2t7f296e2Nvc29vY39vf39nQz9/f29jf293f3sve2t/cX9ve3t/Y39rY3t7Y393f39jf3tzfy86f29/NW9nf28/f3M/f3trY39/f397f39/b39/f3t/P39/f39/c29/e3pjd397f3t/e2N/b39vf393f29/Z39/f2t7f297P39/Y2Nzf39/IXt7f2tnP2N/Y39rY0Fie39/Z29je39/W39+d3tjc2N6em97Y0R3f3N7Y39jYX9/f2t/f3d/Y39jf2Nhf2N/e3Njf2tzc3N/Wmtje39jfz9/a3t7P3t/Y3tvf387f39zb39vb39qfypve397f28qP29/f39/Y097f396e39/f3t/f2N7e3t/Y39/Y3t/fz9/f2N/fytrP39vf39/e39/f39rf2N7d39/Y39zb29/fy9/e3tjfX9/f3trf2tzf3t7f2tjcz9jd393f29nf397f39/c39/P397d3tjZ29/b2t/f3t/f39/e3t7b39jY38vY2N/e3tvO39jb2N/f39/Y3t7c39jf2t/b2tnfz9jY397e29vb39zf2N7f2s7f297b39/f39vP39nd39/c38td39jfyFvf39vY29/fz9/e39/f39vY2Nja2t/f2N7a2N7f39jO3d7d3s/f35vP397a2N/f2N/c38/az9/Y2N/bz8/fz9/a39jf3N/c3tze393f297f2F7d3t7Y3d/Y39/fz9/f39/f39rf0N/a39/b39/b3t7f3trb299Y39ne3JnZW9/b39jf2N/e3d/Y3l/f3tvY39/e3t/fXt/Y3t/Y39Sd39/f2tjP2tjf29tY3Nrb39/b2N/Y2s/Y39/b2tjSm9/a29vf39jZ39zT2N/e3t/f3tvY29/dyd7ewR/f39ze3N7b2Njd2tuf3N/e2N/f39zQz9/Yz9/Y397f29zfzt/f0N/dXtrY39/b2N/Im9/On9/Y2t3f2F/fz9/b39/b39/f39jf39/b3t7f29/f2N/f3N/b0F7f39jb2N/e397fXt5Sz9/Y2N3f3d/d3NvP39/d3t/f3tje3t/f2N/f3t/f39jez9jf3Nna3t/a0djfWN/L3d/f29/OT9vf3t/fys/f393f2t7b3t9d2t/f0N7f2N/f39rZ39ve3Njf39/b2NnZ2N/f39vY39jf39/a31rf2Nvfzt/Y2N7e3t7X2t/f2N7ez9jf3tiez99f29je39/c2N7Y2t7f39jYzt7c3tze3t7f3s/b39jY2t/bnt/f39vP397fz9/Y3t7d0t7e2N6c39vYz9/e3Nve3N/Pz9vYmtnf3t/O2N7Y2N/Z3tjb2t/e39/a3t/f39rfy9zf3t/W39/e2dvf2MtY2Nje3t3Y2M/f3d/f3tjf39/f397e0N3f3tvf3s/a0F/Y39/a2t3d39jf39/f09/e29/f397b3sneX9jOyZ/d2N3a2d/Yz9vf2N/fzdvfz9vP3M/f39/Y39/Z2d7e39/a0Bjf2J7f3d/d3t9f3tze2NjJW9/f39rY39rf38ne2N5az9/O39ve3tzb3t/f29/Y39/Y2MvQWtzP19rLz9vYWM/c393fX97f3tve39/f3tzb3tyb38/d39DKn9/byZPfz1/e297c297P3tvcz97O3N3Y2s6b39/eWd7f3d7Y2NrY2Njf3t7f39jf3tDY3N/ez9/Y39zYz9ja3tvPy8vf3tre2Nrf3t/f3t/f29/P297b3t/e39jP2NjfX93e3d/ez9jf3tjf2trP397LX9jf39jP39/b0N7c3t7f3t7f39jf2N7Y39ve297f2N7e31je3Nne2N/Z39/Y39if3cvL39/b38jP39jf39/Y38/Y38jc3d7Y39/fz9hf3t/f39nZ3tBe39/b3tne3tjf3tve3t/a2N/Q2dzb21je2NjPztrP3d/by97c2t7L39/Y3t/e39re2N7bzt7b3tva39/Z2Mna3d7e39/ezdrf29rS35vf1NjP2N/b3t/f2N7f3t7f39jP2Jhf39nf2N7e3t7e299Cn97f3tia29/e39jZ3djbz9va29/f39nf29/Y29zd39/b2d/Y2N7Z3t/f38/f39/KyN3L397f39/O2NjZW9je29jez1/Y393b397e3d/e3Nvdz95f29hf38qf39jf2d/e38vfzJjf39rdy97a2N7f3t7P39vc39/c38/fzdvYH8/d285aztBa2N7fWNva3t7P39/f3Nje2Njf2cNey9/Y3NDc29jf2t/e3tjfyN7Y39/P3thb3Njey9/b3t3e29rIW9rf3tjf2NzY2t/e2N7bz8tYz9fO3sre3t/e39Da2tvfz1jYz97e2N/f393b39zf2tvf39/ezt7W39/Y2N/T39/V299dy9vf2N/d3tvf38veX9/e2MvN3t7a2F/a39vf2dreWl/b38pYntvZ2d/e39/Z2t/IH9rY39jb39/Y19jX3dvf39rbyZ/e3tjf39nYX9je3t7e3tve0Nvf3tnP39jf3tjf3t7eX8/a39jd29nb39/dzt7enNmZmd7eyV/Y3tzai9je39ve39/e2N/e31rf3tve2NjP2Nrf293R35vf3svf3t/a39/a2trP2t/Kz9nd39jb39jf39/L1ljb39/Y3t/L18/f3s/Y2tvf2N7e39ra3tra39/Yn9vP3tze29/c3l3f3t/f29vK2t3S3d/f2d9Y2tjf39/d2Nvf2N/a2N/L38/YXtvf287b38vf2N7Z35jY397b2svb2M/e397ey9ff38tf2N7Y39DJj9/Y39/Z39/Y39zf39je397f2tvf087Z317a2pjeXNjT39/f2N/e39/d393f3k/J2MvY2M7f3tjf317e2F7Y39vQ3tjf2Njb2Nvd3t/c2N9b297b3t7Pz81N3t7Y1N/b3t/e3t7Y2N/d3l/f29/f2tCf2Ngcz97e3d/b2t/f29/fztja397f39/e2N/Y3t3f2N/P38rZ39ja3stc3tze2d7f3t/e3tBa297fytvPzt7Y39/b2c/P39CY3t/P3t/L1t/b39jPztjJ2N/byNvf39jf39rY2Zjb2d7b3tzY39/eztvf2M/Y1t/b29/e3Njfz9/e28vb29zL39vf39/Q3s/e2s7b39nd3tzP381f3p/e2N/e2NBf2Jje2M6Y2Nna3tzY38nQWtvb2t/f39/Vz9tLWt+c39ve3N7dzt/fy97fz9jYX97Y0NjPz97f2N7e39xY39/Y2l/d2svPXtic3tzQ3tza203c29je29vY29/a2t/L2N3e1t/eydzf2N/f39/f2NrP2N7b299f3l/c2N/Pz57OyNvZ3tvY313bn9jf0A1f2tTY39re397d21jf2N7b2tvd3tje3t/L3t/e29/ezd7e1tvf2NrZ3N7dz13ez8ya393f3t/P2M9fz97e2N/e3tna39jZ38ve39jb397O0Nrf39jbnt5az97J3t7a3djY3t/P397b29jYXt7Y39/L2NPf2Njf39/eWN7Z19rf2N/Y39vZyNrYwp/an8rcyt7f2N7OnNjY287eW9vf2NbY2d5O213f29me397b3cnentjPz97L397f3t7e39/eWt9e0F7f2N7Pz9rY2N/Y2svY097f3dnd2N/cy9vfy9jf2NvZ3tvb3tve39nY3d7ezljf2N5Yit/f38vf39jQ39/b3MzR2N/QmNjS2t/f3d/e2djYkFvf2N7c3sve39jY3NvY3l/a2d/Y3M3QX8vYy9/Y39rc39je2N7Ij93b2N/e297c3tve2Nmey9je3c7Y295fz97PX8oOnt7Y38vY38vP3tnbltjf2NhP29/c3tve3drb29jd2Nra39rYndjY3tjf38/e2N7L29jf3t/O1t/ezdrY2NfeXt7e3t7L2tjZz97f39De3dna29/X2N/Zn8tIyN7Pz9jf39jP0F7d29je2M7f3Njf3dnQ389Yy9/d3t/e297Q2crfzdCe35vP3tjf3Njb3dnQz9/f397Lztrf397a2E/e2tvP297d39rY2FDX2Nrf39jYz9jc29jP29Ba39ve1tBf2J3Yy9jYytre1d/b3t/f39vf2N3f2M/Y2djf2dje2NzLz9/cz9ra29+f2t/S28vPWNje28je295b3dzO39zY3tnP29/f29vcz97Y39rPztnc317f39zLWN9f2pjf3t/e29veWd7e38hL2N7f2M7bz9pe3Njb3trYz97b3t/O2t5b0F7b3M/Y3s/b2t7f3tzf2N/a3trb3tiOz8/f357Z3dnbzs7O3t7Y3t/JyFfbz9/P3sva1N/f2NhP39ve2N7Y29raz9ef3tvemN7Y397Pz9nY1tjYztjL397Y28/a19vf2N/e2M/a38/d3s7f39/fztrQW87O397X25zY21jentjK2M7f3d7O3s7Yz97d2NCcyFvK39Lezt7ez97c3c/Qy97Y3trfz87J0NjY3t/b0cve3svf2tLY3s7Y2tnY2M7d39zb2djY39va3sCY38jIT9/f2JnP0FiI21nOz9rf2tjN2Ngf39/fzt3O2MvZ39na39/YX8/YTl7YmNva387Y2MrPT9Da2N7f3t7c0Jia2NrY2N7fz9je0tnYGdjZ2Nnd2N/Yy9jZ3t7b2Nvc297e39rfWNrbyd7Y39vb296Qz93Y2Mvf2N7b31zL39/f2F7YWN7ez9jcU8ve39/P39CfzZvX3tvdy89ez8/P087d2djf11jO197Y39nZ3t7P39jf397bXtjfy8jb39Lb39jAXN/a2N/f0N7dWNyXmdDf2t7T39/f0tvf3tne3tjMG89ZTdzY2Z/L30/Yz1Xf397d392eTtjbyNuY2d7f2Njd2tjY2tve0Nha39fa3t/eX9jPz9jY3Jje2tzQGM7fyZmY2Mlbztje2M/W2tjQ38vK29/Oy97eXFje2E/bz1bf29hamF/a3dvf2Nze3Nve2NrP29je29hYz9/c197P3tnfyVnYztvY39/Y3c/L0d7e3ljY39vez9jQ3tvJXthe39rf29/b2Vjeyt5O31ve3s/bltve2t/QX9rc2d7L2Njc29HKXtbby97Y2N7P2t2b2trP397ez9LY29jc3l7OmN7Y3t7P3ljY1d7Z2d7e39/QX97UGN/a2Nje397ens7d3tjY0FvJW9HK2J+fzsiY2NvY3tvY2NjZ2N/e3NxZ2dvf387f2J7f29Dd0NjY397cn9rb39jOy9/TmM/Iztuf38/fz9/b3tje39DP2Mhey99W38tV29jf39/e2pre3s7e397b2Nvfz9vOil/bWNtc2F/Y393Oyd1cj9/S39rf3t7Y39pR2c1ey9jb3dzY2t9Qn97b3tPf2NLY3t7d39zf3s7W2NAeyh/e397P0N5e2N/b39/eW9jfS8vZ2Nvfz95f3tvY35je0M1Z39/f2N7Y29OZ2N/P3c/fTt5e3tvY3tvK117c0JDby9jf39ve2NDb3cvV2NqfX9jf2Nzf2N7O393fX9DJntnaX97c3tje2FTP2srPyN7Yi19Y3ttZztmN3t/byl7ey9ha1t7e1s/ez9ze3dTX2d7c29hY3stf3slYz9vaztjeT91O2N/X3tvd297Y2N/dz1jYG9rOyF/K2MhYXt/YytvS2NjQ3diL2Nje2Enf39vP3NjYz9jb3trfz8vb39De2NrejtjYz1VZ3s/ezVvY39ja29zd2M/Y3N7Yy9zYyFjZn1jb38zP3tiS2Nnf3ojP19/d3t/Nzs/JjV/f297aztbe297GH9zOy8/c29Caz9vZ29he29/Qnprfj13bTVqe29zY39ib2srIyM/f083P39DY3tvP39vYy9/Mn9vPXk9eXtjb3lLd3t3LzliYn9zY0Nnfz99O3Nnfzs9f3t3Z2c/bzFvY39jY197Syt7fzt7b2NjAHdiLyF7Wzs3YyMvb3tne395PXtjYy9Le39vY3lufXt1e2NjOStjM3tzfyMve3t7Y3trI2tvQ29jaz99Y2Zhf39vf2tre2k/Iz1hL3dtQ39jf3N3Yz9jf39jKT9Bf3tzf286f2svLyIjb39rby97Z3t3J283f3trbz9rfWs/fX9jb3tze39zJVtDfz9re2dDZ1ttPycrW3d/Oz91c28/e2N3Ky97f3kmI2Eie385Y3N7P2M7JSJ9c2snMz9/b39jb2MjP1svY2V5Pz9jb2MTZ39/b3NHd389L397Z2Nmf39jO3M/f392Omtec39zY3t7BXs/Mz5/cXtDb2tnY2Nua297azt7e31ze2M/ezt/ZX97anl7d3c3fXtnf2Nre2N/Yz8/e3tne2N7e38vY197I3t7Yzt7dz9/cz89PT9vY3trYWN/fz9iP2NGOyNAfyM9Y396L3t/e0t/a2Nzczt7Yi8hQ3tjb3V3c2Njcm93Yns3WRB7f28rc0t/bz97Y0NvY395b25jY31jfWdjLTdnK257PXsrY3t/I0NjaWM3L3trZj9DY3t7YV87cjt/f2JlJ2trZ2s/Y3V7e3tmc2MrO28/aj97O3sve21/Zz45Kyl9f3pvf3tjY3N3b15jI25/a3tje2Z/fX9/Qk9TeVNhe2NjW2Nje2c7bXsvX3M7f293e3c9Y257bz9/e38jQy5hMzt7Ozt7S0Fjb2J9e31jS0N/f0Jjd2tjQmt2Pydve387dXt/Y0Z/e21reWd7c2NhZ3tje2tjY0t5f3J3fz8jY3lrbnt/I0FvYV9/Z31jQ3svc38/a2NjYn9rZWNbez9ib2d7Ant/O29CPmNTe39CW397fnNjLX9jY2d6emNjd29HY2NjP2t7b0E7cz9Ddzd3b2Mne3NneWM9dyZvZy9je2siT09iY3src2dne3t6c21jb1tjcyNBe0pnXmZ9fW9nO39rKz93N2J5f2N/e2NmfyNhOX9BbyF5Q29/QnprT2sgR3stYltLf2Jnd39/a29DfXNvPSN7e1t3f3pzc2Nrf2N7a2NzfStze39eJ39jcytvdz9jYztvL2FbJ3sjP30hL2N7fzkpL2NjW3tjQ3t7Yy9hc2NrL3trfz9/e1dmY3t/PSFKZW9jeWN7e3lif38/fmpbf3tBej9rb2M/Pz5DO3NzYz1bf1tvf2NjKWJney1jP2NDfy1vLWNjZ2N3em9/fy1jf3s7d3tua2NrY29vY2d7Y3FzZntnelo7P38ve2M3P2Y6c3N7S2t/U3ZjI08/a2soP2Jve3d9bz8vP3p/P38vY3tzby9jY2Njfjl7f2N/OzpLU39/QmNKYnt/cy97Z39tW3t7W0EjO0Nff3sjeT1jc2t/Izt7Klt3e0d7Y2MmYy9vW2NjQn1BO2M3Yjd/f2Ive2NtPTt5ezthYztDZj8/f0pjZn9/em8/LWN7ezNjP2tjP2MjQylvN3tAbUNzemNDY2NGI0Njcit7PVtBa3tjb2N/Yyt/aiotYSc/d3pvN29nb2tjL2M/Y3t/Q0dvb3t/eyNbK2ttPyM9L2N/JS9jYTFucz9if39jeyV7QXtrQ3lnWzUvPmc/d1t7a3Nqam1Pe3s9Y0NpY2M5YXt3OztjY2IDZ2NnIT0ja29vOmNjf2Muf1p/P397P2NjL29bPz9jISs/e29jezd3O1d/aS9bYX9jby9zc3thb1tvLzlhbzJ7e381dWNbfm97Yy4vf3N/d2tPa29jJ39jb1t7PWM3YmF/L3pLey1vc2l3Q29tb19vP2ZDYm99P0M7O0Vvf2M3b38/J2NjLz1iWyNvcXNvOVs/O39Tf3t/f3snQ2dzY2JrUHsrN3tje0d7akF/e3dbeysve39/fyN7Rz1hYz8hfWtja2NuR3l9b38pYWNlbztDeXt5Y2MvNU97c09uJmMvY19+Y1o/f38/XUJ/Yz9jYSlif39rY29vY0EvYX5LOQ0rYkNpdzNjLWs/Y296OyMqb38mb0N9ZX8tL39WO0N6e0J7P295T0trejs7an0nbjtpb3Ind2F/f35jfi93LyNjY29jeXtnb2MvOztxZ3NhYzl/O3ljb3l/X39je3t7L0JLP2tqay1WZT05YX8/Qi9jZW1vdld/fyNjY2djT2F/eWJvQnt7PX87R0Zje3tra2Nxe2d7Jz4mKzMqe2c9J2N/P09jP2tjQ2t2Izt9f3c/P0t/OXt7a39pa2ZzYSNjf3h6e0N7L28zY2NjO3t3Yztje21gQzNjP2M6Y39rfW9jf0djbntjY3t9c28/Py8/Z2Nhez8tOntDe2F7V2d2bW9+WnF2f3tSY0FqYWM/Zzt7fn8/dWk9e3thYiNpAn87N0NBYz9hZ1t/e2N6VUcvYTt/Py9ue38/e28vf2lre3ttWz1tf3tTSy1/e2Nja2NzQVwjID9xOQt7d25jJy4hO3E9L255bnl/e3lve0V7SH8tYX93e2F7fWtre1p7Int7M3d5Qj5/Y3syY2tjXzl9W2tua19jT3lDY2M/O2M/e297dytjOShjYzs9dzl/LS9TY2NSP1shP29mby9rYWN3a3t7fX15Pj9rT3sjb3s7JQprYllie2JjYxp7Im97W0tDMWNjeXtpY3t3K1FXe3tjO28/fW1jWyovQ3ohYz1yY2M/I0Bhb2Nbe29KOWtjW2M7fXJvY39/f2lnL3d7c2tzY21ze2Fje28rP2NjNWNba3tyIWdzPjdrY30vb29jO3trL3s/d2MjY0BreT8jQXs+P2JvP2F5PyFLe2M7Yyc/O2JvfyMrOn99W3tTY0N9V3phP39aOT9jW3shd29jTkN6IyNBO2diI3Z5Qn9/XnN7fzYjZ0B3LWFtY1phZz1/fyM7e397Z39hQ3tja1ljYn9vS3d7Oz19Y2J7Qj0/Y2F7Yy17L39KLX95f39hbWJrVTN/YnI7Tythen1rP39jOSNjZ3tCayNrQX9ze29vP24/Iyt7O2J3YW9iYkdXUj97YztjI0dje2N/Yz9nY39PRm07ZzpjfWthIUM/bT99d34jOWNuOTteIHM7I2NBaz4jYydfaWJ/Y2FjYWFvb1tjRzd7M39jY0A3L39CeS1jbz87Ii0tYGNid0shb39nL29jYz5rYTN7f303Y39/Ly1He3tvazZze2d7e3t6eyptOXZiQz57O2lhYWtuQWEpc2FBKzN/L2NHWk8pPTtnY3svb3l/Qit9PyJje29hf31jYmN7O2ErP2NDbyJ5OW9GJztLY2F7fWcve3ZnW2o7N2lbe387fn5NISZxQ3tfazpvfXdjT3djLydjN3svfz9vY3kjez9/b2pne1tpQ2stLzk2J2lCeWdrS0N3eTdrV09jY0FvL11Lf3I9Yz8/NWM7e0Fhb31hfy99YXFrO1VhLy0vP387b3tzX2I9Ok8/fWE/WS97fUN/LWE3Y2tjJSMqY2NDAz93T3lre3thQ0tteX9Lf2JBQ3t5S2o1O2N5ezsyLkM3LTc+Ozlnf2FnNztPbW8/K2N7Q29bf2NjQ3kja0tia0M/aiJWJ39ja2dhcztxe3Nhe283Y2N/a2kvWz1nPS9mPWMzS3UmI31nf1d1d296fmYuei83U2E7Y09jZ3tHPz9uf2N/b0EldVd9UzluQXd7cW9jb38jQysxXy57byZpY3k7f2F7f3kvOSsvIio2Y3s5f0FnJWdSQjp/eT1zK3J/P20lb216W2Ena2NrYWF5QjtfY3c+Oy9jO1tleld/b1trYWJzWnk/L3pdbmMjdytbIz1KI2s/a29mNmMueTt7NWtna2o9ITdue3M9eyV7PWdDbykve28/cmNrdntaOy1zZ2s9e1otYX9jX3tgXXpbP2suAz8va2N7Y2tvfVZiOSF3cSNzbXtje0NdOi8rOT86Z2NDbQNhY0t2bz17cT8lentzP0o7aWM9LX87an9qe2MvP2NzO2Nlf29xazlPfWc7S3ttT35/YwE1I2MjYydbf3o9b21+Yz83f3tiezI9M2N7I3lrP39rYW1jens/a2tbTmJvSVN9e1NHcy8hcWZjaV8jdmItWWM9eXNjI3tDOSd9Jzt7I2ohYXt7Y0I5Y31jT2MvLj17JXl3fyZjSTMrL30je2V5PTZ7eSFqK29pQ2M7Mycrf39jIi1zL387L2MveXtvYzJ5Kj5jSnsJfWNKAHt3KTovInt7T2pney9nT2pXOkMvZntDO21rK38tYy9jdT81SylDLiM/dQF5f0MuLWFnIUF3UWI/Yz5uImtPb31hazZvfSkje28hY2Nzf30jflMvJWdnIWc/c0drImJTP387eEF7bW4rL2tHZj1iW3Z/OWNid2NnZj97L2Nhfzkheztbf3tpLXo5eUNbJXt9f2N5TmN5e1t/J2l5I3Jre3UPY2d/NXN7ZX9rS1lff39ic3tGTytjYmMrI3N7Z2Fjc2F9eWlhe0Fhb3tpQ3l/Y0N7Q2M/O3tjO2ljP3tje3tSYXs/cz9be3NfIy5vL117W1MlNXsjeS9CI2NjYktvdy9jdysvXW95Y2Fne15vUn97Iy1rYSFBSyF/Ykdza0Nvfy1lIm9neVtjLXt5Q3t7ZTd/N1lCO2N/Z2NvfWNjJ219UzstbmF/Ym93U0FjXjs/V29re2Nia3NLP39rYydjIyMCez9/a2MlSmM/YT1vQSFrK383Y0FDQ2NDO2tfP0NhfyByXztdL2dpe2UlN0Yjez1jZ2lhOyEjbSBANmMqYkNhe0Maa3tpY0M/K2N/Ji89Z19/Wy17YjsrYTdjJ0N7Yzt3OyF7aylvOz9jYSNjKytCU2MlPmojJytBO3F/Lzdvaz05Yz1fI3tJKXd3a2t/cWNnNy17Zy9paj97YWY2YX09aztzY3otf2J7T38vbSEpIWt6ez1HVnp7bVNpP2svJWFvdl15PjpxL0F/ZyN9Y2tnNS0iNjl/Ln93SWlCJn1BOmM7PWdvL207RT8gb397Qy0lKS95c0tmfytbc3tBOzJ7aXIrPyl7b3ZhPSMBJmJCSzd9OWE5e0N7a2MjYWF/eS1mOW97e3N7PzIwaztjOyF5YWs2LztZYytqe0J/OWNzfytiOyk9Yj87b2MtNWNnYy8rY3trI2MvPz9gd1tvcSdzLz8vfV0BO3t5T2tTe2FgYndhe3svbyNLey5/Y3kzc0EvQy9hd2ZzQ2JvS2I/Vj9iJSNhKCt7ey47P3tje2J2bztiZi97eUMrO29jRSMjbyIrQ3t7YkFDY3tvb2NzLXlbOypvASYrY2sjTT8zTyNCZn97Iwg7e1spZ2tCYWMzez9bfWNjCDdjI3k7f2Nhfztpd3taQz0tWzFqaVl+Jz95LTt/O3NKY397Qm9tL2B7QnpxZiNWSyA5W0JhL2p6NWM5I35af24uJz1jZj8tU1kje2M9UmZCI31+Y2o1JWs5Yi9jOydiI2c/e1tja1V6Pi9pLS5iJWJAZ2ljYTdiZ0MtO2NjSmIoW1s3eid5d3tCQmNve2NiWWJCPXt7O29vJy5gP3tjI2NRe3pCfSUhZTtjOmNnNmdiW2Njd3MreWYvYSInIjt3LUZ3cy9yfztrdnlZLyMjYn93ZnlBIyl2b2VpPjk5b2F/blt6cz8nPSs7Ano/QVNLKSFLe2FbLXdjJzs5YwE9Jz9jQ21zfzVja2F7L397OUNzNzFOLWYvaT9paiV7Zns/Y2MvXWNDI2FXemFZKkNrY2s6Q341f2cnb1kpY0EtY2tZf19qZ2N+e3ttS2NzeU5heWE/Z1otbztvISN7bT9vL1d7I0lvITNDLT8/e0MiO2IPTy9rImNmY3lzO3t7Yy1Laz9DQ3sAImJGQGNvbSNtP09CYwJ7T2NjNykjIz0je3lrczluO0BbP3VPQDl5KSF5a0NLV3t3Zn8rLzthYzdxf39jZ3t5JSN2YWc/c0N/Qy1mb297JU5FY1trfXdibwItbyNjfy1vRWkCazV7Ynk/a2NpZzdjKUMveU8jI3J6MVsrPytpfWNbfzt5OXp6SwE5OWsuNk8henttemZvQztnOjd5YXdhOz1aI2F3biN7X2siK2s7YTt3Z2sif3tzayZ7axA7IyM7IGtud317eX85IUMvZnsvPUE7Ny8vei93e2NaY2p5L2Mvb0cteX81I0InY2tzUE8hNT05P3djPy1hITo6Lz87QGthLyliLyFDO1kvf1shY1ZPe0c1OWMydS97Yy8iBG1heyI7ejsvPSsid11CY2MvQjpvU2ohMwI5LmtjQkttPy8vI207Qm9bOUkneXlGfy46O0JDaz9BP2M/e28iLWNoQWkleT9ZZm9jN0tqe25zZjU7X3IjY1NbY0MneTpSYjshf3M9eWNjKX8gIXtjX287Yk56Y3l7Y0cjLTtzfyMrfX0rQn9GXS95fTl3YTk+W3svf2NFcjkiOy9Cf2N/SzpDTUovYzJCaSNnO29xSj5jRytpcW9xYyt7c2VjY3lmLz5/eztCY2tCOm9vOWF6I3NAYjt7e3tjZTsvd2EyIUpSYWNjQjd7dSMjYkF5dy1vez5POUF6cksvYzd2KS9jfWYgZzE7PzctJysqLWJ9c0NrSU1fI1thd24lazVCMXtBeWZnJkNmT2JnIj1HQyUmVm9XaWN/Sn9jISltR3prYQdpYmlhY0BLb0s7Wz95bzspImFjay85QkEzRitiQUFjbyFjIyNxS3kzOyktNyc7LTs+f1t/X3tnK3sjIkUyO39rI0l6c0I5QTdvSWFbYyl/MXMveVN/LWEhaT8IOTtmK309OiE7Py1jY2M+Qlc/Q1t7YWVTa2c7LSsnY2FBOiNiJ209cyt5LWJPNjMnPT1BJXMAYWNZZicyMz9vPWt2PnpjbStAemF5eV5ATXphLTNhdkMuYXs3e3lbeystRm8jOiF7L2tjRj8mbydbeSNPWm9hZiNmeSk/V0IjPiMjY3FDY0J3LUJxe3M1WUJGOXljZj1fIzonb2NBW15NISctOT8ne0svLzsvOUtjezZbezZ7ey17fTZnIXMmZ3klUz9nYyZjQ0ovLzluJ0UGQTtjI2FDeSF5IS9dOmZ6O3tPdyJzb0NoZSN6Ymc5KjlZbSsrbytvOzsjOj4/eVdjUy8qKVs7LXpveW9lOVljYWJjL1t7YzojVkFHWiMvY3YheWthKS05NSFLeTVDQ0k/Yyt/WX87N3ltY2M2Jy9PayE6Y2tDPW95KWtzUj55bwR6fyBrOW9hOmE0IFljT2djIWInIV87Y2MhRzMvQXk3YTo+IXtCMnJLY2FyO3dLY2t7LSsvLVZ/UUYKIW1nOUJjSk0lOztnSkJyZ0paL2V7Q2NgSS9bIUZvI2JfZmMjbllhIzthIzVKaXkrYXdnLntPeSdtYzcjOUlrYy8tfyN3Z0N6P2ohW2knQy9aYVNrQl4iYTBBa21idUM/QW8ifntxTmM7TWNjPiZSf2FrQyMtI2MvKUItO0NjK01TKz5vI296bzt/Z397Y0J5QzV/e0FFLiJ7Y21OW2d5YXM/f0Eqa0NKLVIjLi1BKgFvJ0s7Ymo9Q3tvITticlMzf2N7aX9DcS0qAH9CdmlpZTk7bzdPKWc6LUMjY2J5Y096d28mYmpBSilma2oCLyM6KkNhTllzb31BY2I5Qm43S0MiQjpvO2lDfyd5cWM/eSsqPzt5QgZzLj0jeiNTQ257YwF5Yjtbey0/OyEhb0knZW05bX1paT9Paz87Ywd9I3djYTlTQnknOjkvXik5IitucmEnOSstNz9+Y0ElR2sjWTFxLykoQ0kjW3pjJUMhNzFZSyZheikrPl9jY2ZhYzcpWyc+I3JZYUs5KSFLKns2ZzkpU0oiaz1jQS9jI2M6ZlZ/eSNDQSp7I2dDIyFhI28vYm05Y0I9Ojlye207YnotY0NDL29rK2laNyt5L0JbY3s7TWNCUT1iayZbd3N7dmF5XTlLIWEhQy5TI3MtQUc9IWNBbn8pOWlnI3kgYjs7Qnkja0E9WUNidWU7ey9qOn5xIz1XYnpKRkNDK29tL1dbYUZjc0NieztNXUMjNXFneS4pYnt5e0t7YltdYy1lQkZFOj1aRz05Qy5NU2UvI3lPKwhhM0tja0I3Szs/SklmeS1Ge39WOm87QS8vIiIiYykhd0JBd24teyl/LSJGeVsjQWcnQ3sjWW57YjtrQ0s7JydnQkNmdTt7UjlpOjtrNkJSOzo/I305fUIHezp3eyF7Yy9re2FuJUMveV9hNmNBI2Frez56Pyl9d2E7K0kqayd7USJ+Z0p5eRF7c25CZSI+XWJiO0M9QgR3azkjQztDOSliLS9jfzp6X3lvYS0qKSc9TV9jOnc/Y3s5OUdleil6YklhOiI5Ozoie2kre202f0FyOy8uc2tXYW5HKmJ7aSI/Y3I7elJjfXtNOzNJZXsvaX9NeWo3YT1hfWMtTmpGf0JGPzpNL1pBe00uU2N5NkBxZ1l9bkJ/ImItej8rQjkzYWN3O2FZaztvQl0PJnt5QzkiISl1PTtDJ0ZbYWciWTtmIT8nY1YtKSt/IXkBR0tvN3NnLycxe1F5ezpObktbKmFDIzteY2lDY243YXd7OUY9QWs9QTd5Om1APy0nIyF7J0k7OU4vIzVjLTJiN38hW2E9YidhAiNLeW86OXk+KlsgI0JhYy81I3NGQikKOzdtS0JeKVlqBWsvNjIpYjMhYlZbIVtRP31jIFpGMmleUCFfLmdaa3l3e2NtJX9iNSNdYkU9YkcqL2Evai5CIl1QTHtbY1MnOkNCYz9jQ2YrUztOWksrJVtKZ0FNQT5id2I7eVJjeTtifm47QntCa2NvJy9OX3o/eWEjWzsjNj9COSMvWS0jYkJiQ1lhYXcpXSJCeS5RKyM1Pz9+eStPI2JhY3YpQ35jfVp6IWM5KTtLJSMFJyNqJW4tMi8/fiM5QiM7YnMBM0BbTntjc2ErYW5iPT8oIi9haWltc0NhOW5BQiMiLmM5RS0vbUsvQyhtaSlmOyNpbXtLWTk7Yy9ePiJ7I2M+ISZhQTVieS4vPz8vT3o9Q1M5AUIvSlpFNisCa0NZYS1GOTtlW0MiFX9jO1lCT2JjOS0jY1tZZzgnM2s9JXF6IkNlP0s4Jn9WJUY5ZmM5UVUlNTc2PTsEY0N9YT1GakFtezdtYUliP2c2CEEjQXYoN2E1Qk51f3t/ejs3K3khInlhYXtNI3k6Kzt5KTtzYTtlL0JCZzo/Ki9jJSNBMWJjUyJGIi17IzEnACUqOUtbdVZ7enl/YiMpdyZ7aTRJL3pRWi8/byIhYTFbYWJLQS03P0FjIzNiYmM5WSJ1e2FNOn0/XjsiOy15dn9RUi1SPWEjci0ve2NjeUctKi1hMSlhQXktKUJae0Jjb3sgIWFHYUFiYTM6YkkiO30gIT9jSydAUjlzRj1LYiNPamNbQSFBJyIvX3sxe2tvNnV7e1VnejlreSFDakd5YjpjNWZBIWFqY2InaWttaWJhP01OYms5OSEiI29JIz8tY0NtOyBjQzVCKSJGQ2MzalYvOy03OX9CemN5eSt5ZXM+Kjd3QSN+KS5DKSNUOiNjTkI7NHsjKitaKWJVeV5LOTFjTWJCImMnOzouYlM6IWFJS2kzewExfyFbamo5P35rK3FCL3kGMWUpJ0Jdem97PXFQLmohR3p9PUJhKTZvPWJ5K2VLLyJ/O2JSfz97PSk5O0Zje0IvLUt5YwBCOSVvNUMlI1NXOzspInFdOV8iKWIiOjk1bnl/J1JuKSF5V2cvIyouOyJjNWc2IX1fI2F7L0JlRjJxe2InLzsxaWArYno/WWIpKU9jL1l5WTpjdWc5Q0BPO0NaPSECJjlJeVY1MXcnJyp2IUEjUTl7OTktQ0M6OV8/f3lba0EuNl1nOiNOLUJqImM3XzpDISE5IVphbTYgJnZbQWJDMkV7YmI5OW4mYmknbSNGW2dRPnlCXz9RIENvIiBvUVl7KXdhKWVaKWJKeTtBYjkhNUMzMUFfQXYpYy12Pj9uQCNDSWkvQD1mYS0+PTVqL3FrO1IjLUZBQmVhWy41QS9ZQ2FaWjcuYTlSYWN5UmNTQWt6LyI5IU9bP2s7Pk4tJSMpey0hAXlyNkskWWp2e3spQ0ZpMyotIX4uZ31aZ1shQCI5ej8rJiE9T2IpZjpDd3ljYStCPkNhPUEmYz9iPy9hBjpvKHs/YydDSWNjJT5jLTYxQ0NCe3k1Q3pOLnJuS0s5IFI9QjdDVkFmIy17OUItIkNzP2dja28Cfz5KQz89WiEvTzk3Y2c5My06YmJeQT0BaV1ZJ0Y6ImJrKylmTiZmIS1CUUpzN2JjLiYiLVtKYiFJXyMjIGN3cgFxW2FDJyZKK096IWoiSyFDOyJbOX92O0snSmdCLV1hZTtCZSYtLXoiQSpjYmEuISlGS3cuW0IrUXdOKyFeTWlCIis6KC07IWptf1lCakItQ11SP0J9J2JjOS09O2dRQSNlIm9hX3tjKUo+cyNZaXtbQytDWiMmUy0xejlCPS87LmMjWU1TPWJ7IWFZYiltYSFjYzIpczt2eS0nQzpFO2M5OUtHNmNbeXsvLzVCIT1jciFDICE5N1JiYi8uMjJdIWtuPTpHYyF7Zm4tJTYjQ0NqJyFDYVc7LztnQ0JBKSNZIjt5Mz0hYwpOakpDPWc/fmM7K2NCLUJVby9xOQJDKW1jcUNieUsjaS0jYl02emYpQ1kiYjtgLS0ld0I5L0dFIT4uQ092DiclOT0jYypCYlMBZkNlSzk9OzkoJkItciFtZlFDZWNCPyEgQlIxKUM9LWFvLnlLW0FjTS9DOU1BO3U5YiIyIWFfY01RWyFdSUJTP2YhYmk5YyN5ITtZKzV7enkuNi8iSUNZOSMjQzohSTtuQ0k9OS1SSzlDSnc+SjtTS0VjLSpCYWkhLW1SKT0uLkM7L0BBKjtqTXMrOml/QTsyO0ppQyJhb2IpeSNiOy9qNiFBP1IpKSJlOiEmI3FBQ3J3JiFiXUNnWXpTXltbOj91YyUjJ007M3pDIXd/YkMjQ2FvQyFRbi1Bb09iMS0lZSM5eWYrSTlDLSl6YWlNQkNrNkNJLi0gYiNKYWNiJj1ieSUrZjspIyktQ2ZBa0ItLm4jImMieykyWnEhJSMte2NSYyJJaWMpQVoBQkIjQmJZLz1hUUNKNydKLSJuADFeJS0jJ2tDeU0vO0MxKy0xISF5PTVWIl1jUklCJSdidnk5UklbQmEvYWNpYS1BVi1yOU17eXFjYls9eTk5WS9BQX45R0oqK0IsRjtSIXoheyVJJjhlAVo9b399OSI5LVJ5Y3khIjlDKVo7PVlDMG0YPSdhLntBOWprXWMyQSVHSzpjI2JZczFjOW1HJUFmOTUpMUZBPXNqJ1tLWT06QU1GTX9DbzljOil9IyBiKkIvQCciczpZM08vYmkiO2Eoej05YidCYmNtYishfSVBKEltIiVbZjtCYiZOJnc/IEEtQSM1Xjk5Y2FxKT4lOlJjWkNPOCk2bzotJkI6ZiNeOWZCJUo7SmF5Ln9qJkcjc0EmISIvfTs7BUJmRVldcVsqbSJ5e3p7LT15LTtibSEpYkkiQ1tvO0IiIHEqMX0tMSpHYidpWy8jIjlhOiVpYWJBJiFjJSJCYSJrayJCQSJTMjllYikhejs7Z0FBS3VhKW4QNS9CWSUzeS8jOjtgPyk9J2FmMz1HYiEhYClZYS05Pz8vVylBWy9hIltme2IjSXtbciojezleOUszUzk+QklfQkE9IXsvK0FNISsgIztBJToteSFKNiMpW2N6JyNBMiF5IXpjIUV7LTdhe0JXITktI2UhWUBiamEnO1JpIVYhPz1/OwI/JkJObXNNTT09TjlbYl1jLmEoLSZTey1bOmYjQ3EtQ2E5Q1pDQU8pJi5rImNJLVs9JWI5ewhiIWE7YSt7QnkiWS8jVVFBIydKIEFKKi85PSImWTViYy0iOmU7QTtZQmJRWydJeUJOIUMheyJCIidhQllKdUJqayIgK0JiQjlDeyI9JlkpIEVNQz07R0onelkyISlJLiUnSi09fTlCWkFlbylDMykpIUkjKz1DIXItSTs9Til5Kis3WiFGWyEiO2FmLiJPW3VGaUE7JC0zOS5qbzohKiNbQiMiaShQYyl6UiEpPjtaQVFrYk12IyNheXliYjYpI2N5OUchPS1bAiJjPlsiIzlCPyUiRWo5KSpBW0Erc3FBQ0YhP2FeVmMtT01iLSlhBzshVytKLlopQidjJSJKLTUTKWJZKTlXJi8neypRcSV2I0l7KT8mYV0pOS0jQUlBaS1iQTVCPjVKIkJSYTF7ZkF7KSItZmJRIgEjIjUidTJCbTYmO0FaIyopKmNncStnLy4zKi1CdiJ2Ryw7OilZYypKQUpXL0NbI0VhKztzWSFzO2dhcytJLSIveT9tYmM6YyclYmMqYUo9TQg2OSM9Wjk5OWNLLWpOciElNUpDOSNOK1kxOzkrMWNbIiM5eSgiK0FhPTk6OUYteTFDPVYqQTIiWiFiLTlhQmVTR0N6X0FvYilpLm5CSgE/YiYiRkcuaVFBXkdhPXstI00OJ0E7MWItW3FhLyFqcmE7ejcjbilDNmJ5KTpZPTkjQSAtcUZzWS8vYWpzIWNDL2U5JU0zJlFCL2MhMyshTSMrJUFhPi1uQiIhIy4mYikpO2BDJUpVMjlhTTlyOSJLQklBQVlVLjl5ITprWy1BImElU3VDRkJaRjl2IylhOyUlTzUgfi4tOUJ2YUlqISJgSz8uMUIhdyd9IyNCEjpXSjlBOWFCJW9LMWpdWWlGWWNGK0IiMjYpQShJQlkiOSEpJj87UyJSMyY5eTk5bnlaZ3ktMXl7UTllYiMjW1JKKztmITktTz9HQWMhLidiamJWIS5hYlMpTkkpQTlhTT19QiMvP3Fna2UjYVpZMi5iKU9JI2YnTWclYTp7QyVDISVtSiUvISpjTyVGKiFdXiA7XQVuek9JV1pOe1FCQz4CQU9hckA5Kik5IU5xKjtjSiUqOSFhbiJLd0pOIS9pIU1zFFtiOlciYjthIyMyIWNCaSEoTSFaIikxIkpGYVVaIUIpSiJKIiMvQUUhIUInLWFaSy5dWTkhJmJFeTpEYz05PXkiLlUpLiEhQz1OQzYjJkEzI0NCQTtJIyVAV3UzKU8LIkIjIkFhSTkhJSE5TTUjLX1tSmInQm1KISNZI2lBOyJveiUCMiE7PyJXKzZNSXpHUSIjYkBCKU4lb0B5LWFKOWtaKlYgOkpjQyZeQTojLSNBQW89MiFZI24pJW9FSSEhISVSTWZBQjVhM2F1SUFNWC0hNj1tJnIrWTpFPWF6IS5GTXlrIz1bTzEqVVlpWiVRUTBhKTE5Nmp6WycgQ1UnJjsSekMpLilaRiZZbWMtLU9DSiNCOS1bQXlDRTliO2khSkUhQyM5N0EvQQAvRWExOW0peSI+Vi4jLTl5Kyo1IXsoYVFLLSJdNnF6bSlbYT07IydBKzEReUIhKUBaW1IiPm8uIS1DeS1JPko9XiJhKmI+MiE9KS5BOS46LUFCQiEjLUtCRV8jIkNCJWMmOTlaOnkhO0ItIm4BKkNZS2Zq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","splitBits":{"BNI":1,"Ctrl":2,"N":4,"F":8,"S":16,"randomA":32,"randomB":64},"cuts":[[0.6,22348],[0.65,10373],[0.7,4267],[0.75,1564],[0.8,449]],"mods":[{"n":438,"phyla":[["Proteobacteria",121],["Actinobacteriota",68],["Bacteroidota",57]],"top":[["Pseudarthrobacter",15.0],["unnamed Gemmatimonadaceae",8.4],["Massilia",5.9]],"share":[17.048,18.384,17.012,17.933,17.518,27.835,41.867,30.794,30.425,27.81,28.746,33.168,30.763,29.634,28.093,18.026,18.355,17.129,16.707,15.729,28.516,32.918,30.013,31.705,27.187,28.164,31.312,28.865,31.403,28.005],"score":[-0.51,-0.58,-0.79,-0.65,-0.52,-0.69,-0.76,-0.55,-0.7,-0.94,-0.8,-0.74,-0.68,-0.68,-0.76,-0.5,-0.42,-0.65,-0.73,-0.7,0.11,0.11,0.03,0.01,0.58,0.69,0.43,0.26,0.56,0.41,0.36,0.24,0.71,0.5,0.47,0.39,0.41,0.4,0.28,0.16,0.31,0.33,0.07,0.25,0.42,0.64,0.32,0.31,0.55,0.44,0.4,0.32,null,0.32,0.49,0.36,0.35,0.37,0.38,0.2,-0.33,-0.69,-0.61,-0.69,-0.28,-0.68,-0.74,-0.72,-0.67,-0.91,-0.95,-0.67,-0.58,-0.94,-0.8,-0.65,-0.38,-0.86,-0.77,-0.86,0.31,0.2,0.11,-0.11,0.43,0.4,0.38,0.32,0.37,0.53,0.12,0.11,0.61,0.7,0.32,0.42,0.4,0.35,0.31,0.22,0.21,0.19,0.17,0.12,0.48,0.31,0.31,0.09,0.43,0.49,0.3,0.22,0.52,0.55,0.58,0.33,0.36,0.4,0.39,0.2],"r2":{"fert":0.899,"time":0.015,"line":0.0,"plot":0.022},"p":{"fert":7e-18,"time":0.082,"line":0.62,"plot":2.3e-10},"guilds":{"aoa":7,"nsp":1,"nsm":1,"nit":2,"mnd":4}},{"n":312,"phyla":[["Proteobacteria",48],["Acidobacteriota",47],["Chloroflexi",29]],"top":[["Candidatus Udaeobacter",14.1],["unnamed Gemmatimonadaceae",11.4],["unnamed Vicinamibacterales",10.7]],"share":[19.581,17.069,18.459,17.907,17.988,17.264,12.676,15.923,14.89,15.484,15.761,15.101,15.159,16.125,15.273,18.809,18.739,18.839,18.677,19.48,17.328,15.19,16.178,14.322,15.727,15.204,16.071,15.286,15.047,15.183],"score":[-0.2,-0.01,0.44,0.73,-0.48,-0.25,0.3,0.61,-0.31,-0.13,0.51,0.51,-0.52,0.07,0.54,0.55,-0.58,0.03,0.58,0.49,-0.03,-0.31,0.15,0.51,-0.41,-0.34,-0.06,0.28,-0.4,-0.19,0.18,0.39,-0.41,-0.35,-0.09,0.28,-0.62,-0.37,0.14,0.19,-0.2,-0.31,-0.2,0.44,-0.23,-0.31,0.01,0.48,-0.47,-0.38,0.02,0.26,null,-0.44,0.03,0.33,-0.65,-0.3,-0.02,0.2,-0.27,-0.04,0.51,0.66,-0.22,-0.14,0.57,0.74,-0.37,-0.06,0.3,0.75,-0.4,0.02,0.5,0.62,-0.02,0.04,0.35,0.72,-0.15,-0.07,0.17,0.51,-0.26,-0.21,-0.14,0.38,-0.48,-0.21,-0.11,0.54,-0.25,-0.43,-0.09,0.22,-0.52,-0.51,-0.0,0.32,-0.36,-0.24,-0.16,0.32,-0.17,-0.23,-0.12,0.29,-0.39,-0.5,-0.12,0.47,-0.42,-0.33,-0.15,0.31,-0.45,-0.76,-0.04,0.42],"r2":{"fert":0.117,"time":0.014,"line":0.0,"plot":0.725},"p":{"fert":0.0017,"time":0.81,"line":0.89,"plot":1.7e-21},"guilds":{"aoa":4,"nsp":0,"nsm":1,"nit":2,"mnd":11}},{"n":296,"phyla":[["Acidobacteriota",74],["Chloroflexi",56],["Actinobacteriota",45]],"top":[["Candidatus Udaeobacter",19.1],["unnamed Acidobacteriales",7.8],["unnamed Nitrososphaeraceae",4.7]],"share":[14.159,13.17,14.484,13.605,13.399,15.556,12.941,14.923,14.449,15.028,14.6,15.418,14.385,13.742,15.352,13.407,14.905,14.939,14.322,14.69,15.545,14.72,15.311,14.373,15.025,14.459,16.986,15.831,15.036,16.404],"score":[0.21,-0.61,-0.49,0.38,0.04,-0.73,-0.77,0.25,0.24,-0.66,-0.21,0.5,0.1,-0.65,-0.36,0.39,-0.1,-0.5,-0.21,0.38,0.66,-0.74,-0.48,0.64,0.27,-0.79,-0.25,0.77,0.39,-0.56,-0.37,0.82,0.26,-0.7,-0.53,0.86,0.27,-0.67,-0.25,0.89,0.59,-0.5,-0.64,0.47,0.68,-0.43,-0.52,0.65,0.56,-0.47,-0.48,0.39,null,-0.68,-0.41,0.56,0.59,-0.41,-0.49,0.65,0.23,-0.48,-0.56,0.1,0.36,-0.36,-0.45,0.43,0.18,-0.42,-0.41,0.6,0.18,-0.53,-0.31,0.47,0.45,-0.34,-0.41,0.36,0.78,-0.42,-0.53,0.46,0.56,-0.48,-0.46,0.58,0.72,-0.51,-0.68,0.51,0.64,-0.54,-0.62,0.54,0.67,-0.57,-0.51,0.5,0.65,-0.29,-0.59,0.15,0.63,0.39,-0.54,0.05,0.63,0.56,-0.49,0.31,0.72,-0.2,-0.52,0.38,0.74,-0.23,-0.27,0.39],"r2":{"fert":0.018,"time":0.006,"line":0.005,"plot":0.803},"p":{"fert":0.27,"time":0.84,"line":0.37,"plot":1.3e-18},"guilds":{"aoa":5,"nsp":0,"nsm":0,"nit":0,"mnd":7}},{"n":213,"phyla":[["Actinobacteriota",61],["Acidobacteriota",45],["Proteobacteria",29]],"top":[["unnamed Nitrososphaeraceae",11.9],["unnamed Gaiellales",11.2],["unnamed Vicinamibacterales",10.8]],"share":[14.25,14.106,13.671,13.598,13.719,9.383,7.064,9.691,9.897,10.25,9.837,8.74,9.388,9.867,9.957,14.265,13.926,13.344,14.036,14.367,9.873,9.106,9.372,9.646,10.337,10.039,8.525,8.857,9.328,9.49],"score":[0.17,0.79,0.83,-0.35,0.11,0.65,0.74,-0.23,0.2,0.61,0.57,-0.29,0.11,0.79,0.69,-0.24,0.14,0.87,0.66,-0.15,-0.38,0.42,0.35,-0.95,-0.46,0.33,0.18,-1.17,-0.48,0.5,0.19,-0.84,-0.35,0.49,0.26,-1.01,-0.11,0.48,0.44,-0.93,-0.58,0.4,0.45,-0.51,-0.81,0.08,0.43,-0.97,-0.57,0.26,0.47,-0.73,null,0.14,0.06,-0.46,-0.64,0.24,0.52,-0.61,-0.08,0.84,0.84,0.19,-0.04,0.73,0.93,-0.2,0.02,0.69,0.64,-0.33,-0.06,0.78,0.77,-0.01,-0.03,0.82,0.78,0.15,-0.87,0.34,0.54,-0.63,-0.73,0.5,0.36,-0.73,-0.75,0.18,0.56,-0.99,-0.67,0.25,0.44,-0.75,-0.46,0.36,0.48,-0.5,-0.63,0.29,0.4,-0.1,-0.97,-0.61,0.53,-0.9,-0.68,-0.8,0.49,-0.46,-0.78,0.1,0.37,-0.55,-0.85,-0.05,0.42,-0.4],"r2":{"fert":0.198,"time":0.015,"line":0.001,"plot":0.652},"p":{"fert":1.1e-05,"time":0.85,"line":0.81,"plot":4.5e-19},"guilds":{"aoa":5,"nsp":0,"nsm":0,"nit":1,"mnd":5}},{"n":172,"phyla":[["Proteobacteria",33],["Acidobacteriota",25],["Myxococcota",17]],"top":[["Bacillus",27.2],["unnamed Vicinamibacterales",12.4],["unnamed Rokubacteriales",10.6]],"share":[6.527,6.098,6.212,5.646,5.452,3.452,2.3,3.086,2.664,2.708,3.348,2.961,3.091,3.189,2.667,6.423,5.791,6.178,5.769,5.64,3.465,2.929,3.224,2.785,2.782,3.404,3.364,3.052,2.717,2.828],"score":[1.02,1.39,1.33,0.7,0.97,1.37,0.97,0.72,1.05,1.13,0.87,0.8,1.02,1.19,0.98,0.59,0.84,1.12,1.01,0.55,-0.21,-0.6,-0.2,-0.07,-0.58,-0.49,-0.5,-0.47,-0.43,-0.41,-0.27,-0.68,-0.69,-0.59,-0.67,-0.63,-0.84,-0.69,-0.51,-0.8,-0.37,-0.46,-0.71,-0.26,-0.36,-0.5,-0.15,-0.21,-0.55,-0.46,-0.51,-0.49,null,-0.54,-0.3,-0.28,-1.04,-0.55,-0.47,-0.87,0.87,1.22,1.14,0.87,0.8,1.21,1.0,0.55,1.01,1.14,1.04,0.59,1.07,1.08,0.84,0.61,0.77,0.92,0.97,0.55,-0.34,-0.12,-0.07,-0.06,-0.47,-0.57,-0.68,-0.43,-0.68,-0.27,-0.48,-0.03,-0.42,-0.71,-0.56,-0.48,-0.67,-0.73,-0.65,-0.7,-0.57,-0.35,-0.62,-0.49,-0.09,-0.13,-0.32,0.23,-0.67,-0.72,-0.62,-0.45,-0.53,-0.5,-0.6,-0.51,-0.56,-0.78,-0.54,-0.55],"r2":{"fert":0.902,"time":0.021,"line":0.0,"plot":0.004},"p":{"fert":6.6e-18,"time":0.055,"line":0.88,"plot":0.062},"guilds":{"aoa":0,"nsp":0,"nsm":0,"nit":1,"mnd":2}},{"n":30,"phyla":[["Acidobacteriota",8],["Chloroflexi",6],["Actinobacteriota",5]],"top":[["unnamed Vicinamibacterales",23.0],["unnamed AD3",15.3],["unnamed Subgroup 7",14.2]],"share":[1.663,1.658,1.702,1.657,1.687,1.605,1.202,1.596,1.688,1.79,1.579,1.609,1.645,1.551,1.919,1.73,1.704,1.669,1.782,1.793,1.584,1.402,1.661,1.713,1.871,1.575,1.749,1.682,1.786,1.924],"score":[0.89,0.64,-0.45,-1.08,0.65,0.48,-0.45,-0.97,0.82,0.25,-0.71,-0.9,0.63,0.19,-0.67,-0.57,0.45,0.19,-0.61,-0.71,0.93,0.25,-0.43,-0.84,0.64,-0.18,-0.4,-0.2,0.72,0.08,-0.37,-0.15,0.79,0.09,-0.4,0.01,0.58,0.26,-0.45,0.06,0.88,0.2,-0.22,-0.73,1.03,0.14,-0.21,-1.4,0.73,0.09,-0.4,-0.55,null,-0.14,-0.25,-0.49,0.66,0.61,-0.35,-0.26,0.7,0.81,-0.66,-0.84,0.75,0.53,-0.22,-0.93,0.59,0.37,-0.39,-0.87,0.68,0.42,-0.52,-0.48,0.72,0.36,-0.5,-0.86,0.64,0.64,-0.29,-0.38,0.57,0.24,-0.54,-0.68,0.76,0.12,-0.22,-0.84,0.81,0.31,-0.3,-0.26,0.8,0.39,-0.15,-0.4,0.66,0.28,-0.3,-0.39,0.59,0.62,-0.22,-1.33,0.63,0.58,-0.18,-0.81,0.86,0.41,-0.37,-0.7,0.9,0.35,0.02,-0.88],"r2":{"fert":0.006,"time":0.005,"line":0.002,"plot":0.832},"p":{"fert":0.6,"time":0.98,"line":0.65,"plot":2.1e-21},"guilds":{"aoa":0,"nsp":0,"nsm":0,"nit":1,"mnd":1}},{"n":5,"phyla":[["Proteobacteria",3],["Actinobacteriota",1],["Thermoplasmatota",1]],"top":[["unnamed Mitochondria",34.9],["unnamed Acidimicrobiia",30.5],["unnamed Micropepsaceae",15.5]],"share":[0.001,0.001,0.004,0.005,0.002,0.007,0.013,0.011,0.012,0.017,0.002,0.009,0.015,0.04,0.009,0.0,0.002,0.0,0.007,0.0,0.009,0.006,0.005,0.027,0.02,0.006,0.009,0.01,0.01,0.026],"score":[-0.72,-0.55,-0.6,0.57,-0.63,-1.17,-1.09,-0.54,-0.53,-1.36,0.12,-0.48,-1.27,-0.79,0.03,-0.08,-1.26,-0.73,-0.4,-0.48,0.24,-1.13,0.06,0.65,0.62,1.43,-0.25,0.83,-0.54,-0.42,1.21,0.98,0.27,-0.68,0.64,-0.63,-0.19,-0.12,-0.06,1.95,0.05,-0.82,-0.61,0.07,0.71,0.14,-0.18,0.95,1.14,0.76,0.47,-0.45,null,1.62,1.58,0.22,0.93,-0.6,-0.48,0.41,-0.71,-0.63,-0.21,-0.37,-0.67,-0.89,-0.3,0.16,-1.39,-1.11,-1.02,0.16,-1.17,-0.49,0.63,0.33,-0.21,-0.81,-0.68,-0.55,-0.22,0.54,0.43,0.53,-0.28,-0.09,-0.79,1.17,-0.96,0.44,-0.46,0.72,0.47,1.52,-0.82,1.47,-0.3,1.77,0.41,-0.27,0.18,-0.39,-1.02,0.38,1.29,0.15,0.33,0.66,0.25,-0.56,0.96,0.02,0.42,-0.46,-0.14,0.71,0.62,1.49,-0.57,1.52],"r2":{"fert":0.253,"time":0.023,"line":0.001,"plot":0.067},"p":{"fert":1.3e-07,"time":0.77,"line":0.76,"plot":0.0031},"guilds":{"aoa":0,"nsp":0,"nsm":0,"nit":0,"mnd":0}},{"n":5,"phyla":[["Unassigned",5]],"top":[["unnamed",100.0]],"share":[0.032,0.018,0.019,0.097,0.144,0.095,0.004,0.005,0.075,0.213,0.005,0.0,0.043,0.046,0.212,0.037,0.023,0.028,0.106,0.175,0.099,0.005,0.009,0.103,0.186,0.005,0.0,0.02,0.022,0.226],"score":[-0.75,0.18,-0.64,0.14,-0.49,-1.36,-1.1,-0.47,-0.9,-1.34,-0.41,-1.66,0.33,0.69,-0.45,2.1,0.37,2.03,0.03,2.19,0.52,-0.62,0.56,0.26,-1.52,-1.4,-1.5,-0.59,-1.32,-1.2,-0.84,-0.16,1.09,0.38,-0.75,-0.7,1.58,1.77,2.05,2.71,-1.09,-0.98,-1.29,-0.72,-1.0,-1.19,-0.96,-0.74,-0.77,-0.84,-0.55,1.07,null,-1.79,-0.83,-0.09,1.89,2.66,1.72,0.65,0.04,-0.65,-0.23,0.23,-0.02,-0.96,-0.05,0.03,0.06,-0.63,-0.93,0.59,-0.99,1.73,0.65,1.3,0.86,1.91,0.83,1.68,1.22,0.43,0.07,0.24,-1.43,-1.37,-0.93,-0.64,-1.74,-0.16,-1.69,0.01,1.6,0.93,-0.25,-0.42,1.85,1.86,1.96,2.61,-1.56,-0.81,-1.19,-1.4,-0.48,-0.63,-1.36,-0.13,-0.78,-1.08,-0.73,-0.17,-0.59,-0.53,-0.58,-0.19,2.57,1.79,2.48,1.84],"r2":{"fert":0.016,"time":0.623,"line":0.007,"plot":0.029},"p":{"fert":0.15,"time":1.7e-12,"line":0.26,"plot":0.0015},"guilds":{"aoa":0,"nsp":0,"nsm":0,"nit":0,"mnd":0}},{"n":4,"phyla":[["Armatimonadota",1],["Chloroflexi",1],["Unassigned",1]],"top":[["unnamed Chthonomonadales",40.4],["unnamed RBG-13-54-9",28.4],["unnamed",19.9]],"share":[0.003,0.01,0.006,0.002,0.006,0.015,0.01,0.004,0.008,0.006,0.011,0.006,0.007,0.015,0.004,0.005,0.008,0.005,0.004,0.005,0.009,0.013,0.004,0.006,0.015,0.009,0.0,0.007,0.003,0.007],"score":[-0.78,0.82,-0.21,0.2,-1.25,0.1,1.77,-0.6,-0.52,1.1,0.14,-0.92,-1.33,-0.85,-0.68,0.11,-0.91,0.5,-0.73,-1.07,-0.26,1.77,1.53,0.03,-0.79,0.18,1.79,-0.56,-0.24,0.48,0.24,-0.63,-0.22,1.19,-0.28,-0.69,-1.47,0.19,0.85,-0.99,-0.36,0.86,1.59,0.02,-0.26,0.7,0.32,-0.0,-0.7,0.36,0.31,-0.5,null,1.03,1.15,-0.41,-1.43,-0.21,0.65,-1.07,-0.76,-0.69,0.88,-0.43,-0.38,1.37,0.05,0.25,-1.44,0.83,-0.53,0.11,-1.22,-0.07,-0.11,-0.6,-0.26,0.6,0.01,-0.61,-0.28,0.5,1.62,0.02,-0.69,0.8,1.52,-0.47,-1.01,-0.06,0.98,0.25,0.0,-0.8,1.07,-0.48,-0.58,1.31,1.94,-0.9,-0.43,-0.32,0.31,1.06,0.26,0.1,-0.63,0.61,-0.74,-0.59,1.55,-0.45,-0.57,-0.24,0.82,-0.5,-0.72,-0.47,1.1,-0.87],"r2":{"fert":0.036,"time":0.056,"line":0.0,"plot":0.396},"p":{"fert":0.15,"time":0.12,"line":0.86,"plot":8.5e-13},"guilds":{"aoa":0,"nsp":0,"nsm":0,"nit":0,"mnd":0}},{"n":3,"phyla":[["Actinobacteriota",3]],"top":[["unnamed Acidimicrobiia",51.8],["unnamed Solirubrobacteraceae",35.0],["unnamed IMCC26256",13.3]],"share":[0.167,0.168,0.092,0.143,0.142,0.161,0.083,0.076,0.099,0.081,0.159,0.149,0.105,0.06,0.109,0.192,0.116,0.075,0.115,0.097,0.18,0.108,0.072,0.054,0.06,0.178,0.132,0.095,0.099,0.093],"score":[0.25,0.72,0.49,0.85,0.41,0.39,0.53,0.49,-0.23,-0.17,-0.29,0.29,0.37,0.31,0.06,0.43,0.59,0.23,0.17,0.02,0.95,0.27,0.69,0.47,-0.04,-0.88,0.05,-0.03,0.07,-1.13,-0.88,-0.48,0.23,-0.05,0.07,-0.19,-0.16,-0.69,-0.27,-0.38,0.76,0.52,0.31,-0.45,0.95,0.69,0.33,0.29,0.1,0.01,-0.89,0.51,null,-0.52,-0.34,-1.51,-0.1,0.38,0.32,-0.27,0.5,0.51,1.37,0.39,0.09,0.2,0.44,0.13,-0.52,-0.4,-0.03,-0.87,0.2,-0.07,0.13,0.4,-0.84,0.17,0.49,-1.42,0.6,0.9,0.68,0.73,0.3,-0.0,0.27,-0.98,-1.38,-0.02,-0.36,-0.82,-2.24,-0.51,-0.27,-1.37,0.01,-0.44,-1.72,-1.82,0.82,0.83,0.07,0.4,0.41,0.87,0.09,-0.4,-0.23,0.1,0.04,0.22,0.45,0.27,0.02,-1.1,0.38,-0.27,0.2,-0.17],"r2":{"fert":0.096,"time":0.283,"line":0.015,"plot":0.04},"p":{"fert":0.0058,"time":4.1e-09,"line":0.36,"plot":0.018},"guilds":{"aoa":0,"nsp":0,"nsm":0,"nit":0,"mnd":0}},{"n":3,"phyla":[["Chloroflexi",3]],"top":[["1959-1",100.0]],"share":[0.249,0.182,0.172,0.196,0.143,0.151,0.109,0.108,0.106,0.102,0.155,0.143,0.143,0.138,0.106,0.194,0.193,0.204,0.148,0.189,0.152,0.126,0.091,0.105,0.135,0.164,0.162,0.145,0.15,0.151],"score":[0.67,0.81,0.63,0.56,0.3,0.27,0.05,0.37,0.37,0.24,0.41,-0.36,0.74,0.16,0.16,0.08,-0.31,0.15,0.41,-0.71,0.64,-0.19,-0.12,0.23,0.04,-0.23,-0.42,0.23,-0.36,-1.35,-2.33,0.15,-0.19,-0.46,-0.68,-0.08,-0.15,-0.65,-0.49,-0.29,0.14,-0.23,0.25,0.4,0.07,-0.01,0.26,0.15,-0.04,-0.02,-0.08,0.45,null,-0.41,-0.02,0.23,-0.49,0.11,-0.37,-0.44,0.37,0.6,0.58,-0.02,0.72,0.07,0.2,0.55,0.44,0.23,0.32,0.64,0.16,0.25,0.04,-0.46,0.78,0.15,0.37,-0.03,0.58,0.17,-0.15,0.19,0.18,-0.24,-0.4,0.11,-0.24,-0.21,-0.42,-1.33,0.15,-1.7,-0.79,-0.03,0.25,-0.36,-0.47,0.03,0.1,0.16,-0.18,0.17,-1.07,0.15,0.12,0.45,-0.06,-0.26,0.16,0.24,-0.09,0.03,-0.07,0.42,-0.05,0.16,-0.09,0.19],"r2":{"fert":0.229,"time":0.104,"line":0.004,"plot":0.042},"p":{"fert":1.6e-07,"time":0.0058,"line":0.43,"plot":0.0047},"guilds":{"aoa":0,"nsp":0,"nsm":0,"nit":0,"mnd":0}},{"n":3,"phyla":[["Gemmatimonadota",1],["Actinobacteriota",1],["Deinococcota",1]],"top":[["Pedococcus-Phycicoccus",66.8],["unnamed Gemmatimonadaceae",20.9],["Deinococcus",12.3]],"share":[0.014,0.048,0.022,0.066,0.051,0.024,0.129,0.061,0.058,0.033,0.024,0.06,0.064,0.031,0.055,0.032,0.04,0.032,0.032,0.027,0.018,0.058,0.05,0.05,0.038,0.029,0.025,0.035,0.052,0.054],"score":[0.42,-1.6,-1.32,-0.54,1.09,0.7,-2.06,0.59,-0.81,-0.22,-1.66,-0.44,0.64,1.06,0.72,0.01,1.39,-0.83,-1.73,0.09,-1.32,0.35,-0.09,-1.77,1.73,2.93,1.33,-0.84,1.03,-0.95,1.29,0.32,1.46,0.59,1.1,-1.6,0.32,0.54,-0.37,-1.36,-1.28,0.5,-0.38,-0.8,-0.35,1.65,0.99,0.98,1.11,1.05,0.31,1.2,null,0.16,-1.36,0.39,1.23,-0.06,0.22,0.17,1.2,0.3,-1.2,-2.22,1.63,-0.97,-1.23,-0.79,0.65,-1.27,0.71,-1.69,0.73,-0.68,-1.41,-1.07,-1.18,0.56,0.4,-1.75,-2.07,-0.46,-0.55,-1.78,1.01,-0.46,1.13,1.03,0.72,1.24,-0.39,-0.86,-0.68,1.06,0.55,0.89,0.82,0.38,-0.58,-0.68,0.4,0.49,0.05,-1.7,-0.74,0.05,0.68,-0.73,0.28,0.78,0.54,-2.24,1.37,0.89,0.62,-0.61,1.11,0.76,0.69,0.34],"r2":{"fert":0.056,"time":0.11,"line":0.009,"plot":0.133},"p":{"fert":0.061,"time":0.0098,"line":0.41,"plot":8.4e-05},"guilds":{"aoa":0,"nsp":0,"nsm":0,"nit":0,"mnd":0}},{"n":3,"phyla":[["Unassigned",2],["Gemmatimonadota",1]],"top":[["unnamed",94.2],["Gemmatimonas",5.8]],"share":[0.024,0.0,0.007,0.004,0.026,0.029,0.0,0.014,0.012,0.001,0.214,0.022,0.002,0.027,0.001,0.027,0.017,0.009,0.007,0.036,0.059,0.008,0.0,0.001,0.028,0.244,0.081,0.043,0.013,0.008],"score":[-1.01,-0.14,-0.89,1.41,-1.49,-1.45,-1.37,-0.83,-1.2,0.2,0.41,-1.16,1.09,-1.08,-0.91,-0.85,0.52,1.2,-0.96,-1.31,-0.49,-0.44,2.59,-0.2,-1.02,-0.9,-1.0,-0.79,-0.82,1.37,0.43,0.17,-0.8,1.31,-1.17,-0.92,-0.69,-1.4,-0.84,-1.22,2.63,2.76,2.56,-0.22,-0.49,0.97,-0.46,-0.24,0.01,-1.06,-0.71,-0.73,null,1.03,1.72,-0.64,-0.72,-0.89,-0.77,-1.3,-0.4,1.09,-0.49,1.42,-0.95,-1.17,0.94,-0.59,-1.67,-1.4,-1.31,1.06,-1.45,-0.11,0.42,-0.83,1.98,-1.09,-0.97,0.68,1.65,0.58,2.13,0.66,-0.16,0.26,-1.08,0.28,-1.24,-0.29,-1.19,0.01,-0.5,-1.03,-0.41,-0.72,1.42,-1.49,2.12,-1.13,1.9,2.94,2.84,2.8,2.07,2.11,2.21,0.38,2.22,-1.31,2.52,-0.68,-0.8,-0.75,1.22,-0.74,-0.05,1.26,-0.86,-1.1],"r2":{"fert":0.099,"time":0.184,"line":0.031,"plot":0.018},"p":{"fert":0.0037,"time":0.00046,"line":0.097,"plot":0.33},"guilds":{"aoa":0,"nsp":0,"nsm":0,"nit":0,"mnd":0}},{"n":3,"phyla":[["Unassigned",3]],"top":[["unnamed",100.0]],"share":[0.058,0.064,0.021,0.052,0.045,0.081,0.024,0.076,0.096,0.064,0.556,0.102,0.069,0.03,0.059,0.039,0.058,0.012,0.047,0.044,0.061,0.014,0.107,0.122,0.037,0.344,0.1,0.038,0.038,0.05],"score":[1.24,1.27,1.07,-1.39,0.65,0.75,0.71,1.19,-0.92,-3.0,-2.05,0.9,-2.91,-1.39,-1.21,2.11,-2.9,-2.37,-0.05,1.33,0.79,-0.32,-1.97,0.79,0.41,0.44,-0.23,-1.01,1.24,0.02,0.85,1.33,1.98,0.41,1.19,0.95,-0.61,-0.11,0.23,0.68,3.1,2.41,2.18,3.57,0.85,-2.05,0.47,1.14,0.45,1.17,1.28,-0.98,null,-3.38,-1.68,0.23,-1.01,0.06,-0.17,1.04,0.36,-2.27,1.61,-2.01,1.29,0.83,-1.94,0.74,-0.78,-1.55,-0.86,-1.48,-1.62,-2.57,-1.97,2.01,-1.85,-0.11,-0.08,0.29,-1.86,0.79,-1.74,0.54,-1.0,-2.23,-0.44,-1.06,1.12,1.74,0.66,1.1,2.15,1.76,0.65,1.22,-0.51,-0.26,-2.43,0.61,2.49,2.41,2.19,2.39,1.89,-1.49,-2.21,1.09,-2.33,0.94,-2.33,1.2,0.91,0.35,-2.19,-0.04,-0.15,-3.01,0.02,0.26],"r2":{"fert":0.049,"time":0.067,"line":0.009,"plot":0.069},"p":{"fert":0.12,"time":0.052,"line":0.3,"plot":0.0021},"guilds":{"aoa":0,"nsp":0,"nsm":0,"nit":0,"mnd":0}},{"n":3,"phyla":[["Proteobacteria",3]],"top":[["Nitrosomonas",92.3],["unnamed Oxalobacteraceae",5.8],["Luteimonas",1.8]],"share":[0.114,0.084,0.084,0.102,0.161,0.1,0.114,0.133,0.13,0.112,0.181,0.101,0.192,0.191,0.14,0.139,0.13,0.093,0.145,0.236,0.17,0.159,0.104,0.178,0.144,0.214,0.168,0.158,0.178,0.124],"score":[-2.34,0.26,2.11,0.3,-2.82,-1.24,0.61,0.72,-0.87,0.3,-0.37,-0.9,-1.31,1.89,-0.45,-2.18,-1.12,2.17,-0.34,-2.64,-1.82,-1.22,1.21,0.12,-2.35,0.25,1.12,-0.3,-0.56,0.99,-0.09,0.7,-0.53,2.3,0.55,-2.25,-1.37,2.09,-0.34,-2.55,-1.93,0.4,1.8,0.4,-1.83,-0.57,1.29,0.03,-0.43,1.16,-0.15,-0.28,null,1.18,0.12,0.98,0.81,2.29,-0.21,-2.64,-0.67,-0.62,2.36,-0.29,-0.53,-0.82,1.28,-0.21,-3.01,-0.32,1.58,0.25,-1.03,0.89,-0.17,-0.33,0.08,2.19,-0.37,0.46,-0.17,1.07,1.37,0.11,-0.42,-0.47,2.15,-0.21,-2.58,0.72,1.83,0.3,-0.04,2.21,0.55,-0.24,-0.74,1.84,0.54,-0.61,-0.45,-0.35,2.07,-0.28,0.2,0.12,0.89,0.68,-2.31,-0.96,2.3,-0.08,-0.34,-0.46,2.13,-0.18,-0.5,0.51,-0.39,-0.71],"r2":{"fert":0.011,"time":0.008,"line":0.017,"plot":0.348},"p":{"fert":0.4,"time":0.92,"line":0.32,"plot":3.7e-10},"guilds":{"aoa":0,"nsp":0,"nsm":1,"nit":0,"mnd":0}},{"n":3,"phyla":[["Crenarchaeota",2],["Bacteroidota",1]],"top":[["unnamed Nitrososphaeraceae",52.6],["Candidatus Nitrocosmicus",32.6],["unnamed Microscillaceae",14.8]],"share":[0.018,0.009,0.007,0.026,0.036,0.005,0.02,0.006,0.029,0.021,0.051,0.007,0.031,0.005,0.022,0.007,0.006,0.005,0.015,0.032,0.005,0.02,0.003,0.021,0.012,0.03,0.005,0.036,0.039,0.014],"score":[0.67,-0.68,1.71,-0.53,-0.87,-0.77,0.0,-1.32,1.31,-1.21,-1.18,-1.65,1.0,1.69,-1.4,1.08,1.32,2.12,-0.53,1.49,-0.98,-1.11,-0.08,-0.7,0.4,1.59,1.65,-1.28,-0.18,-1.2,-0.83,-0.52,1.02,1.88,-1.67,1.0,0.15,1.53,-1.33,1.28,2.55,1.92,1.63,0.32,-0.99,-1.18,0.9,-0.73,2.46,1.8,-0.4,-1.23,null,0.44,-0.82,-1.14,-1.05,1.97,-1.26,1.19,-1.49,-0.16,-0.25,-1.15,-0.68,-0.43,-1.08,-1.08,-1.14,-1.89,-0.67,-0.62,1.41,1.28,-1.11,-1.32,2.59,1.85,-1.46,-1.33,-1.0,0.23,-0.88,-0.71,-1.42,2.13,1.32,-1.19,-1.74,-0.78,-0.61,-0.48,2.45,-0.39,-1.6,-1.21,0.67,0.92,-1.57,-1.62,-0.7,2.28,1.55,-1.39,-0.47,0.39,-1.35,-0.12,0.56,1.69,2.03,-0.17,2.26,1.84,1.92,-1.23,1.8,-0.97,-1.35,-1.59],"r2":{"fert":0.034,"time":0.035,"line":0.014,"plot":0.127},"p":{"fert":0.17,"time":0.72,"line":0.18,"plot":0.00015},"guilds":{"aoa":2,"nsp":0,"nsm":0,"nit":0,"mnd":0}},{"n":3,"phyla":[["Acidobacteriota",1],["Planctomycetota",1],["Latescibacterota",1]],"top":[["unnamed Subgroup 12",44.8],["unnamed Latescibacterota",37.0],["unnamed Planctomycetes",18.2]],"share":[0.007,0.008,0.0,0.005,0.006,0.004,0.001,0.0,0.006,0.004,0.005,0.0,0.002,0.002,0.003,0.006,0.002,0.005,0.003,0.006,0.002,0.003,0.003,0.005,0.003,0.001,0.003,0.0,0.0,0.001],"score":[-0.63,1.11,-0.5,1.25,-1.1,1.37,1.79,-0.45,-0.82,-1.26,-0.31,-0.77,-1.17,1.46,0.33,-0.46,-1.16,0.32,1.28,-0.92,-0.1,0.4,0.91,0.18,-0.63,0.22,-0.61,-0.41,-0.44,-0.32,0.05,-0.48,-0.41,0.65,1.54,-0.53,-0.4,-1.01,0.97,-0.83,0.25,0.89,0.48,0.17,-0.11,-0.31,-0.08,0.15,-0.55,0.66,-0.33,-0.35,null,-0.7,0.52,-0.26,-1.28,0.27,-0.38,0.01,-0.15,0.73,0.75,0.58,-0.11,0.6,-0.2,-0.2,-0.29,1.42,-0.0,0.26,-1.07,0.87,0.57,-0.44,-0.11,1.61,0.91,-0.45,-0.12,0.62,0.6,0.17,-0.54,0.74,-0.09,0.33,-0.86,0.1,0.89,0.4,-0.12,0.64,1.26,-0.33,-0.83,-0.37,0.71,-0.74,-0.68,0.39,-0.93,-0.51,0.41,0.25,0.26,1.22,-0.59,-0.92,-0.59,-0.29,-0.41,-0.36,-0.45,0.11,-0.57,-1.27,0.72,-0.71],"r2":{"fert":0.024,"time":0.062,"line":0.004,"plot":0.232},"p":{"fert":0.38,"time":0.082,"line":0.36,"plot":8.3e-08},"guilds":{"aoa":0,"nsp":0,"nsm":0,"nit":0,"mnd":0}}],"louvain":{"seeds":30,"modules":[15,17],"Q":[0.601,0.612],"big":[5,6],"bigSize":100,"note":"Louvain with seeds 0 to 29: the count of modules of 3 or more kinds and of 100 or more; this network is seed 1"},"thresholds":[{"rho":0.5,"nodes":2463,"links":84506,"pos":66874,"modules":8,"Q":0.548},{"rho":0.55,"nodes":2008,"links":44897,"pos":35917,"modules":8,"Q":0.582},{"rho":0.6,"nodes":1564,"links":22348,"pos":18216,"modules":17,"Q":0.611},{"rho":0.65,"nodes":1112,"links":10373,"pos":8647,"modules":15,"Q":0.624},{"rho":0.7,"nodes":734,"links":4267,"pos":3666,"modules":14,"Q":0.649},{"rho":0.75,"nodes":450,"links":1564,"pos":1429,"modules":16,"Q":0.659},{"rho":0.8,"nodes":231,"links":449,"pos":431,"modules":20,"Q":0.73}],"prevalence":[{"prev":0.1,"kinds":4660,"nodes":2901,"links":83641,"jaccard":0.198},{"prev":0.5,"kinds":1962,"nodes":1128,"links":21737,"jaccard":0.536}],"null":{"links":0,"seed":1,"how":"each kind's values shuffled across the samples on its own"},"splits":{"line":[{"key":"BNI","samples":59,"kept":3512,"nodes":2414,"links":38653,"Q":0.562,"modules":13,"null":0,"keeps":17909},{"key":"Ctrl","samples":60,"kept":3370,"nodes":2215,"links":30276,"Q":0.623,"modules":14,"null":0,"keeps":16377}],"fert":[{"key":"N","samples":40,"kept":3794,"nodes":3205,"links":72969,"Q":0.479,"modules":18,"null":0,"keeps":9324},{"key":"F","samples":40,"kept":3301,"nodes":2747,"links":66578,"Q":0.504,"modules":10,"null":0,"keeps":12990},{"key":"S","samples":39,"kept":3284,"nodes":2755,"links":45387,"Q":0.502,"modules":16,"null":0,"keeps":10410}],"random":[[45369,30025],[40603,35752],[30444,41993],[30869,36603],[41904,31820],[41023,30049],[40440,32110],[23665,51423],[42884,31022],[38468,30192],[40344,32561],[39336,34365],[35204,31954],[43674,27117],[39634,28886],[43425,27887],[39681,30965],[33685,38741],[35959,35801],[35210,36208]],"randomKeeps":[18017,15114],"lineDiff":8377,"randomDiff":[158,27758],"randomMore":10,"seed":1,"note":"each half's own network, as the whole one (its own 20 % filter and CLR): the BNI and control halves differ by lineDiff links; random halves of 59 and 60 samples by randomDiff"},"residual":{"group":{"links":22348,"shared":9931},"plot":{"links":1024,"nodes":370}},"fertNodes":0.659,"fertAll":0.486,"guilds":{"aoa":{"kept":29,"inNet":23,"meanDeg":60.2},"nsp":{"kept":2,"inNet":1,"meanDeg":16.0},"nsm":{"kept":3,"inNet":3,"meanDeg":13.3},"nit":{"kept":15,"inNet":7,"meanDeg":29.6},"mnd":{"kept":62,"inNet":30,"meanDeg":26.8}}},"figs":{"chl70":[[{"v":62.11,"err":2.01},{"v":49.28,"err":5.54}],[{"v":61.35,"err":1.56},{"v":58.11,"err":1.47}],[{"v":60.36,"err":1.93},{"v":56.0,"err":2.09}]],"n2o":{"times":[1,4,8,9,10,11,15,16,17,22],"units":"N2O ppm in the jar's air","curves":[[[[0.07,0.15,0.57,0.93,0.94,0.71,0.57,0.61,0.56,0.07],[0.15,0.24,0.82,1.08,0.94,0.71,0.57,0.48,0.43,0.07]],[[0.22,0.41,0.22,0.41,0.32,0.26,0.24,0.24,0.22,-0.01],[0.22,0.41,0.86,1.33,1.26,0.99,0.62,0.55,0.5,0.11]],[[-0.01,-0.1,0.05,0.08,0.04,0.04,0.06,0.08,0.06,-0.01],[0.07,-0.1,0.05,0.08,0.04,0.04,0.06,0.08,0.06,0.07]]],[[[0.21,0.65,1.09,1.25,1.09,1.15,0.85,0.8,0.73,0.32],[0.12,0.65,1.31,1.44,1.39,1.25,0.65,0.62,0.54,0.18]],[[0.47,1.01,1.26,1.26,1.06,0.86,0.6,0.6,0.55,0.26],[0.35,1.01,2.04,2.05,1.87,1.5,0.81,0.71,0.7,0.26]],[[0.17,0.25,0.36,0.26,0.26,0.28,0.2,0.2,0.18,0.12],[0.17,0.25,0.21,0.26,0.26,0.28,0.2,0.2,0.18,0.12]]],[[[0.21,0.47,0.96,0.94,1.0,1.0,0.32,0.45,0.33,0.24],[0.21,0.47,0.81,0.94,1.0,1.0,0.46,0.64,0.45,0.35]],[[0.26,0.78,0.79,0.73,0.77,0.57,0.27,0.23,0.2,0.3],[0.26,0.78,1.91,1.83,1.6,1.33,0.27,0.35,0.2,0.37]],[[0.16,0.21,0.14,0.15,0.2,0.23,0.18,0.12,0.14,0.16],[0.16,0.21,0.29,0.32,0.35,0.35,0.18,0.21,0.14,0.16]]],[[[0.01,0.17,0.52,0.65,0.66,0.66,0.58,0.56,0.36,0.2],[0.01,0.17,0.52,0.65,0.66,0.66,0.58,0.56,0.48,0.2]],[[0.08,0.46,0.95,0.93,0.72,0.52,0.24,0.2,0.15,0.11],[0.08,0.35,0.95,1.25,1.05,0.52,0.24,0.2,0.28,0.11]],[[0.04,0.09,0.29,0.29,0.23,0.2,0.11,0.09,0.08,0.04],[0.04,0.09,0.29,0.29,0.23,0.2,0.11,0.09,0.08,0.04]]],[[[0.08,0.17,0.31,0.31,0.29,0.23,0.11,0.13,0.12,0.13],[0.08,0.17,0.31,0.31,0.29,0.23,0.11,0.13,0.12,0.13]],[[0.05,0.16,0.1,0.12,0.17,0.15,0.17,0.17,0.21,0.17],[0.05,0.16,0.19,0.22,0.17,0.22,0.23,0.17,0.21,0.08]],[[0.07,0.1,null,0.13,0.13,0.12,0.16,0.16,0.17,0.16],[0.07,0.1,null,0.13,0.07,0.12,0.09,0.16,0.17,0.16]]]],"peaks":[[[0.94,1.08],[0.41,1.33],[0.08,0.08]],[[1.25,1.44],[1.26,2.05],[0.36,0.28]],[[1.0,1.0],[0.79,1.91],[0.23,0.35]],[[0.66,0.66],[0.95,1.25],[0.29,0.29]],[[0.31,0.31],[0.21,0.23],[0.17,0.17]]],"p":[["n.s.","p<0.0001***","p<0.01*"],["n.s.","p<0.0001***","p<0.05*"],["n.s.","p<0.001***","p<0.001**"],["n.s.","p<0.05*","n.s."],["n.s.","p=0.05 .","p<0.0001***"]],"incubation":"250 mg N/kg soil (NH4)2SO4, 70% water content, 20 days incubation (slide text)","note":"the slide says 20 days of incubation, the notes' caption 22; the x axis runs to about 22"},"qpcr":{"aoa":[[[{"v":41900000.0,"err":13250000.0},{"v":45100000.0,"err":11300000.0}],[{"v":60750000.0,"err":7500000.0},{"v":60300000.0,"err":14180000.0}],[{"v":101500000.0,"err":17250000.0},{"v":78300000.0,"err":19950000.0}],[{"v":49400000.0,"err":14200000.0},{"v":47900000.0,"err":11050000.0}],[{"v":91600000.0,"err":7100000.0},{"v":120000000.0,"err":42980000.0}]],[[{"v":49600000.0,"err":12700000.0},{"v":44500000.0,"err":10980000.0}],[{"v":65900000.0,"err":19150000.0},{"v":58800000.0,"err":14900000.0}],[{"v":56500000.0,"err":16120000.0},{"v":78750000.0,"err":7080000.0}],[{"v":41700000.0,"err":17280000.0},{"v":29000000.0,"err":3520000.0}],[{"v":80500000.0,"err":18120000.0},{"v":95900000.0,"err":2380000.0}]],[[{"v":37200000.0,"err":7900000.0},{"v":35900000.0,"err":11900000.0}],[{"v":58600000.0,"err":15100000.0},{"v":54750000.0,"err":21000000.0}],[{"v":64200000.0,"err":22020000.0},{"v":57500000.0,"err":7600000.0}],[{"v":57300000.0,"err":16050000.0},{"v":42750000.0,"err":7500000.0}],[{"v":88400000.0,"err":16350000.0},{"v":102000000.0,"err":39850000.0}]]],"aob":[[[{"v":1570000.0,"err":390000.0},{"v":1180000.0,"err":240000.0}],[{"v":1100000.0,"err":80000.0},{"v":1100000.0,"err":510000.0}],[{"v":2980000.0,"err":120000.0},{"v":2830000.0,"err":900000.0}],[{"v":1260000.0,"err":670000.0},{"v":2040000.0,"err":970000.0}],[{"v":1260000.0,"err":240000.0},{"v":2200000.0,"err":1320000.0}]],[[{"v":21700000.0,"err":4950000.0},{"v":19300000.0,"err":9020000.0}],[{"v":21800000.0,"err":4320000.0},{"v":17400000.0,"err":7680000.0}],[{"v":29050000.0,"err":5320000.0},{"v":41500000.0,"err":17900000.0}],[{"v":19600000.0,"err":2480000.0},{"v":20250000.0,"err":1320000.0}],[{"v":14450000.0,"err":5680000.0},{"v":14000000.0,"err":3320000.0}]],[[{"v":8950000.0,"err":4660000.0},{"v":4400000.0,"err":280000.0}],[{"v":12100000.0,"err":4340000.0},{"v":9580000.0,"err":4880000.0}],[{"v":29400000.0,"err":7300000.0},{"v":22150000.0,"err":2120000.0}],[{"v":28900000.0,"err":880000.0},{"v":26700000.0,"err":6400000.0}],[{"v":20900000.0,"err":1100000.0},{"v":18050000.0,"err":6250000.0}]]]},"qpcrUnits":"amoA gene copies per g dry soil","qpcrNote":"the only one printed: AOA, fertilised, day 24, p = 0.057","match":{"nh4":{"maxDiff":4.1,"medianDiff":0.88},"no3":{"maxDiff":0.8,"medianDiff":0.31},"chl":{"rows":[[0,0,0,52.56,52.52,0.04],[0,0,1,57.3,57.31,0.01],[0,1,0,53.69,53.7,0.01],[0,1,1,57.71,57.73,0.02],[0,2,0,58.55,58.59,0.04],[0,2,1,60.41,60.3,0.11],[0,3,0,62.13,62.11,0.02],[0,3,1,49.31,49.28,0.03],[1,0,0,54.9,54.83,0.07],[1,0,1,61.12,61.12,0.0],[1,1,0,57.48,57.36,0.12],[1,1,1,61.1,61.21,0.11],[1,2,0,62.28,62.25,0.03],[1,2,1,63.13,63.32,0.19],[1,3,0,61.35,61.35,0.0],[1,3,1,58.09,58.11,0.02],[2,0,0,57.05,57.0,0.05],[2,0,1,61.03,60.98,0.05],[2,1,0,55.64,55.67,0.03],[2,1,1,60.8,60.79,0.01],[2,2,0,62.58,62.65,0.07],[2,2,1,62.64,62.62,0.02],[2,3,0,56.89,60.36,3.47],[2,3,1,59.3,56.0,3.3]],"order":"[fert, metadata time, line, metadata mean, slide reading, difference]: the metadata's T1..T4 against the slides' days 1, 15, 24 and 70"}}},"open":["Chlorophyll: the slides show it on days 1, 15, 24 and 70 (none on day 53); the metadata has it at T1 to T4 (T5 almost empty), and its T4 values match the slides' day 70 for the unfertilised and fertilised plots. For fertilised + DCD the metadata's T4 (BNI 56.89 from 3 plots, control 59.3) and the slide's day 70 (BNI about 60.36, control about 56.0) are nearly swapped.","N2O: the metadata's value is \"the potential amount of produced nitrous oxide\" (one number per sample, unit not given); the slides show N2O in ppm over a 20 to 22 day incubation of each day's soil. Within fertilised soil, pooled over the season, the metadata gives BNI 0.812 against control 0.983 (p = 0.579); by date it is lower for BNI on days 1 and 24 and higher on day 15, while the slides' model finds the wheat line significant on days 1 to 53. Which measurement the metadata's is, and how the two relate, is open.","Days: the slides' days 1, 15, 24, 53 and 70 are taken as T1 to T5 (129, 144, 153, 182 and 199 days after planting); by that count the slides' day 15 would be day 16.","The incubation ran 20 days (slide 7) or 22 (its caption in the notes; the axis runs to about 22).","Nitrate: the slide says lower under the BNI wheat on days 24 to 53 in fertilised soil; only day 24 is starred.","DCD is taken to be dicyandiamide, a synthetic nitrification inhibitor (the slides do not spell it out).","The field: the site and year are not given (the trial is JIRCAS's, in Japan); the plot map is not known, so the field's 24 plots in four blocks (a replicate taken as a block, since the replicates behave like field blocks in the data) are illustrative.","Only the prokaryotes (16S) were sent; the slides also show fungi, arbuscular mycorrhizal fungi and protists.","Of the 293 kinds of ammonia-oxidising archaea (class Nitrososphaeria), 42 are Group 1.1c, not known to oxidise ammonia.","The co-occurrence network is ours, built with a standard method for this story: correlation, not interaction; its modules follow the fertiliser and the plots; its hubs shift with the thresholds (no keystone species)."]};

// SDATA: SOIL_DATA decoded once, and the lookups the sets and the engine share. No science here: every number is the
// trial's (SOIL_DATA, written by data/gen_data.py) or read off the slides (SOIL_DATA.figs); these only decode the typed
// arrays and look things up by the design's indices.
// Indices (the same everywhere): line 0 BNI, 1 control; fert 0 not fertilised (N), 1 fertilised (F), 2 fertilised + DCD
// (S); time 0..4 the five sampling dates (T1..T5); rep 0..3 the replicate, which the field draws as its block (a row);
// a group g = (line * 3 + fert) * 5 + time (30); a sample's slot s = g * 4 + rep (120; the missing sample's is null in
// every per-sample list: SOIL_DATA.src.missing.slot); a plot p = (line * 3 + fert) * 4 + rep (24).
//   b64(str, Type)              a base64 string as a typed array
//   group(line, fert, time), slot(line, fert, time, rep), plot(line, fert, rep), ofGroup(g), ofSlot(s), ofPlot(p)
//   missing                     the missing sample's slot (BNI, fertilised + DCD, T4, rep 0)
//   meta(key, line, fert, time) { mean, sd, n } of a field measure (nh4, no3, n2o, chl, ph, water) in a group
//   value(key, s)               a sample's own value (null where it was not measured)
//   lineTest(key, fert, time)   [mean BNI, mean control, p] (time -1: the whole season)
//   phylumShare(g, i)           % of reads of phylum i (SOIL_DATA.phyla.names) in group g
//   guild(key, g)               % of reads of a nitrifier guild (SOIL_DATA.guilds.keys) in group g
//   cloud                       n, rank (Int32Array, 1 = most abundant), phy, prev, guild (Uint8Array), ab (Float32Array:
//                               log10 of the mean share of reads)
//   common                      n, idx (Uint16Array: cloud index), flags (Uint8Array: 1 fertiliser, 2 date, 4 line, 8 plot),
//                               cls, fam, gen (Uint16Array into SOIL_DATA.common.names), name(i) (genus, or "unnamed
//                               <family or class>")
//   net                         n, node (Uint16Array: common index), cloudOf(i) (the node's cloud index), mod (Uint8Array,
//                               255 none), deg (Uint16Array), xyz (Float32Array x 3, the stored layout, radius about 1),
//                               links (number), ij (Uint16Array pairs, strongest first), rho (Float32Array), split
//                               (Uint8Array bits: SOIL_DATA.net.splitBits), cut(rho) (how many of the strongest links have
//                               |rho| >= rho: exact at the stored cuts 0.6, 0.65, 0.7, 0.75, 0.8; between them counted on the
//                               stored rho, to 1/127), members(m) (the nodes of module m), score(m, s), share(m, g)
//   n2o(day, fert, line)        the incubation curve read off slide 7: [v at each of SOIL_DATA.figs.n2o.times] (ppm)
//   qpcr(kind, fert, day, line) { v, err } read off slide 9 (kind 'aoa' or 'aob'; copies per g dry soil)
//   chl70(fert, line)           { v, err } read off slide 6: chlorophyll on day 70
const SDATA = (() => {
  const D = typeof SOIL_DATA !== 'undefined' ? SOIL_DATA : null;
  const b64 = (s, Type) => {
    const bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Type(bytes.buffer, 0, bytes.length / Type.BYTES_PER_ELEMENT);
  };
  const group = (line, fert, time) => (line * 3 + fert) * 5 + time;
  const slot = (line, fert, time, rep) => group(line, fert, time) * 4 + rep;
  const plot = (line, fert, rep) => (line * 3 + fert) * 4 + rep;
  const ofGroup = g => ({ line: Math.floor(g / 15), fert: Math.floor(g / 5) % 3, time: g % 5 });
  const ofSlot = s => Object.assign(ofGroup(Math.floor(s / 4)), { rep: s % 4 });
  const ofPlot = p => ({ line: Math.floor(p / 12), fert: Math.floor(p / 4) % 3, rep: p % 4 });
  if (!D) return { b64, group, slot, plot, ofGroup, ofSlot, ofPlot };
  const M = D.meta;
  const meta = (key, line, fert, time) => { const g = group(line, fert, time), m = M[key]; return { mean: m.mean[g], sd: m.sd[g], n: m.n[g] }; };
  const value = (key, s) => M[key].values[s];
  const lineTest = (key, fert, time) => (time < 0 ? M[key].line.byFert[fert] : M[key].line.byGroup[fert * 5 + time]);
  const phylumShare = (g, i) => D.phyla.group[g][i];
  const guild = (key, g) => D.guilds[key].group[g];
  // the cloud
  const C = D.cloud, steps = b64(C.rank, Uint8Array), rank = new Int32Array(C.n);
  for (let i = 0, r = 0; i < C.n; i++) { r += steps[i]; rank[i] = r; }
  const abq = b64(C.ab, Uint8Array), ab = new Float32Array(C.n), [a0, a1] = C.abRange;
  for (let i = 0; i < C.n; i++) ab[i] = a0 + (a1 - a0) * abq[i] / 255;
  const cloud = { n: C.n, of: C.of, rank, ab, phy: b64(C.phy, Uint8Array), prev: b64(C.prev, Uint8Array), guild: b64(C.guild, Uint8Array) };
  // the common kinds
  const CM = D.common, cls = b64(CM.cls, Uint16Array), fam = b64(CM.fam, Uint16Array), gen = b64(CM.gen, Uint16Array);
  const name = i => (gen[i] ? CM.names.gen[gen[i]] : fam[i] ? `unnamed ${CM.names.fam[fam[i]]}` : cls[i] ? `unnamed ${CM.names.cls[cls[i]]}` : 'unnamed');
  const common = { n: CM.n, idx: b64(CM.idx, Uint16Array), flags: b64(CM.flags, Uint8Array), cls, fam, gen, name };
  // the network
  const N = D.net, node = b64(N.node, Uint16Array), xq = b64(N.xyz, Int16Array), xyz = new Float32Array(xq.length);
  for (let i = 0; i < xq.length; i++) xyz[i] = xq[i] * N.xyzScale;
  const wq = b64(N.w, Int8Array), rho = new Float32Array(wq.length);
  for (let i = 0; i < wq.length; i++) rho[i] = wq[i] * N.wScale;
  const mod = b64(N.mod, Uint8Array);
  function cut(r) {
    for (const [x, n] of N.cuts) if (Math.abs(x - r) < 1e-6) return n;
    let n = 0;
    while (n < rho.length && Math.abs(rho[n]) >= r - 1e-6) n++;
    return n;
  }
  const members = m => { const out = []; for (let i = 0; i < mod.length; i++) if (mod[i] === m) out.push(i); return out; };
  const net = { n: N.n, node, cloudOf: i => common.idx[node[i]], mod, deg: b64(N.deg, Uint16Array), xyz, links: N.links,
    ij: b64(N.ij, Uint16Array), rho, split: b64(N.split, Uint8Array), cut, members,
    score: (m, s) => N.mods[m].score[s], share: (m, g) => N.mods[m].share[g] };
  // the slides' readings
  const F = D.figs;
  const n2o = (day, fert, line) => F.n2o.curves[day][fert][line];
  const qpcr = (kind, fert, day, line) => F.qpcr[kind][fert][day][line];
  const chl70 = (fert, line) => F.chl70[fert][line];
  return { b64, group, slot, plot, ofGroup, ofSlot, ofPlot, missing: D.src.missing.slot, meta, value, lineTest, phylumShare, guild,
    cloud, common, net, n2o, qpcr, chl70 };
})();

// SLOOK: the soil story's palette and the colour rules its sets and the engine share (SPEC.md, "Look"). Plain constants
// and small functions: colours as '#rrggbb' strings and as [r, g, b] in 0..1 (rgb()). Shapes come from TLOOK (the tissue
// topology story's look, unchanged: tubes, rings, balls, boxes, halos, cones, glass) and from the sets themselves; a
// shape both the soil and the field sets draw (the wheat plant) may be added here, so the two stay alike.
const SLOOK = (() => {
  const rgb = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const mix = (a, b, t, out) => { const o = out || [0, 0, 0]; for (let j = 0; j < 3; j++) o[j] = a[j] + (b[j] - a[j]) * t; return o; };
  // nitrogen as it moves: fertiliser grains, ammonium, nitrite, nitrate, nitrous oxide, nitrogen in the plant
  const N = { grain: '#f1eee2', nh4: '#ffb43b', no2: '#ff7ab8', no3: '#4d9de0', no3Glow: '#7cc0ff', n2o: '#d9ccff', plant: '#7bd389', tracer: '#ffffff' };
  // the two wheat lines and the three regimes (the slides' own colours: BNI teal, control orange; not fertilised green,
  // fertilised purple, fertilised + DCD yellow)
  const LINE = ['#2ec4b6', '#f08a3c'];
  const FERT = ['#5cc96b', '#a77bff', '#f2d14b'];
  // the BNI halo round the roots (the line's teal, glowing) and the synthetic inhibitor's granules
  const HALO = '#5ff2e0', DCD = '#f2d14b';
  // the relay's microbes, by guild (SOIL_DATA.guilds.keys): archaea magenta, the two ammonia-oxidising bacteria coral and
  // salmon, Nitrospira cyan, uncultured Nitrosomonadaceae (role unknown) grey-violet; comammox (a Nitrospira that does
  // both steps) cyan with an amber core in the relay
  const GUILD = { aoa: '#ff5ad9', nsp: '#ff7a59', nsm: '#ffa07a', nit: '#46d9ff', mnd: '#9a8cc8' };
  // soil and plant: loam, grains, pores, roots, leaves (by chlorophyll), ripe ears, straw, the netting
  const SOIL = { loam: '#3b2a1e', loamLight: '#5a3f2a', grain: '#7a5a3c', sand: '#a88a62', pore: '#120c08', water: '#9fd8ff',
    root: '#e8dcc0', rootHair: '#f5eedc', ear: '#e3c15a', straw: '#cdb46a', net: '#cfd8e6', post: '#8a7a64' };
  // leaf colour by chlorophyll (SPAD index, the slides' axis 45 to 65): straw yellow at 45, deep green at 65
  const CHL = [[45, '#c9b44a'], [50, '#a9bb43'], [55, '#7fb23e'], [60, '#53a03a'], [65, '#2f8a3a']].map(([v, h]) => [v, rgb(h)]);
  function chl(spad, out) {
    const v = Math.min(65, Math.max(45, +spad || 45));
    for (let i = 1; i < CHL.length; i++) if (v <= CHL[i][0]) return mix(CHL[i - 1][1], CHL[i][1], (v - CHL[i - 1][0]) / (CHL[i][0] - CHL[i - 1][0]), out);
    return mix(CHL[CHL.length - 1][1], CHL[CHL.length - 1][1], 0, out);
  }
  // phyla (SOIL_DATA.phyla.names): a colour by name, readable on the dark background; Other and Unassigned grey
  const PHYLUM = { Proteobacteria: '#5aa9ff', Actinobacteriota: '#ffb347', Acidobacteriota: '#7bd389', Verrucomicrobiota: '#ff7eb6',
    Chloroflexi: '#c39bff', Gemmatimonadota: '#4dd0c8', Crenarchaeota: '#ff5ad9', Firmicutes: '#f2d14b', Bacteroidota: '#ff8a65',
    Planctomycetota: '#9ccc65', Myxococcota: '#80deea', Methylomirabilota: '#bcaaa4', Other: '#8e98ab', Unassigned: '#5c6678' };
  const SPARE = ['#e6ee9c', '#f48fb1', '#90caf9', '#ffcc80'];
  const phylum = (name, i) => PHYLUM[name] || SPARE[(i || 0) % SPARE.length];
  // modules (by size, SOIL_DATA.net.mods): the big ones vivid, the small ones softer; links positive pale cyan, negative
  // (one rises as the other falls) faint warm red
  const MODULE = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#cc5de8', '#ff922b', '#66d9e8', '#f783ac', '#a9e34b', '#9775fa',
    '#ffa8a8', '#74c0fc', '#ffe066', '#8ce99a', '#e599f7', '#ffc078', '#99e9f2'];
  const module = m => (m >= 0 && m < 255 ? MODULE[m % MODULE.length] : '#8e98ab');
  const LINK = { pos: '#9fe8ff', neg: '#ff7a6b' };
  // the app's own: highlights cyan, text ink, muted grey
  const UI = { cyan: '#46d9ff', amber: '#ffb43b', red: '#ff7a6b', blue: '#7cc0ff', green: '#3ee08f', grey: '#8e98ab' };
  return { rgb, mix, N, LINE, FERT, HALO, DCD, GUILD, SOIL, chl, PHYLUM, phylum, MODULE, module, LINK, UI };
})();

// TLOOK: the shared look of the topo story's sets, grown from the mutation story's MLOOK. Lit, glowing shapes drawn as
// instanced meshes that a set refills when they change (a few hundred instances every frame is cheap; thousands of
// cells are better filled once and again only when they move), soft halos, and the story's own pieces: glass discs for
// the growing balls (overlapping ones read as one union), a sheet of glass triangles, ribbons (a curve standing in the
// space as a lit strip), glass slides, and cells drawn in H&E (or as glowing beads). Colours are the story's (SPEC.md,
// "Look"): balls and triangles cyan, edges pale cyan, cells white-gold beads, pieces amber, loops orange, healthy blue,
// cirrhosis red; H&E from Beer-Lambert optical densities, as the tour's tissue set.
//
// const LK = TLOOK(K, set)   (K the kit; set from K.newSet: every material fades with the set's uA)
// Units: positions and sizes in the set's local units, angles in radians, colours [r, g, b] (0..1) or '#rrggbb'
// (arrays avoid an allocation per add), alpha 0..1 (an instance at or under 0.004 is skipped).
// Every pool: const P = LK.<pool>(max, ...); set.group.add(P.mesh) once; then P.begin(), P.add(...) (at most max times:
// more are dropped; add returns the instance's index or -1), P.end() (sets the count, uploads only the part in use, and
// hides the mesh while it is empty, so an empty pool costs no draw call). A pool keeps what it holds until the next
// begin(): a set may fill a still pool once. Nothing is allocated per add: reuse arrays and options objects.
// Draw calls: one per pool (discs two). Triangles per instance: tube 20, cone 48, ball 352, ring 640, glass 952, disc 2
// (drawn twice), cell 2, slide 224, sheet 1 per triangle, ribbon 4 per point of its pool (pts) less 4 (so give pts the
// envelopes' length: 123 ribbons of 160 points are about 78k triangles).
// Order of drawing (renderOrder): tubes, rings, balls, boxes, cones, slides 0; cells, the sheet, ribbons, glass 1;
// discs 2 and 3 (after everything else of the set, so beads, edges and triangles show through the balls' glass).
// Depth: tubes, rings, balls, boxes and cones write depth only while the set is fully in (call depth() every frame);
// glass, discs' colour, the sheet, ribbons, slides and cells never do (cells(max, { depth: true }) follow depth()).
//
// From the mutation story, unchanged in use:
//   tubes(max).add(a, b, r, col, alpha, dash)          an open cylinder from point a to point b, radius r; dash: the
//                                                     number of dashes along it (0 solid)
//   rings(max).add(c, axis, R, r, col, alpha, dash)    a torus round c across 'axis' (any length), radius R, tube r
//   balls(max).add(p, r, col, alpha)                   a lit sphere
//   boxes(max).add(p, [sx, sy, sz], col, alpha)        a lit block, axis-aligned, sizes across
//   halos(max).add(p, size, col, alpha)                a soft additive glow (the kit's points), size across
//   cones(max).add(base, dir, length, r, col, alpha)   an arrowhead: a base disc of radius r at 'base', its tip at
//                                                     base + unit(dir) * length
//   glass(max).add(p, r, col, alpha)                   a glass sphere: clear face-on, glowing at its rim (additive)
//   depth()                                            call once per frame: depth writes only while the set is fully in
// New for this story:
//   discs(max, dome = 0.25).add(c, nrm, R, col, alpha, rim)
//       A ball as a flat disc of soft glass lying in a plane: centre c, the plane's normal nrm (any length; null: +y,
//       lying in x-z), radius R; col its glass (default use CYAN), alpha 0..1 on the glass's own (0.15 face-on, the rim
//       brighter), rim 0..2 (optional, default 1) the rim's brightness. Overlapping discs read as one union: each pixel
//       shows only the disc whose low dome (height dome x R x (1 - (d / R)^2), towards the viewer, only in the depth
//       buffer: the discs stay flat) is highest there, so the union is cut along the bisectors between centres (the
//       Voronoi cells within the balls, as the alpha complex is built), and a seam glows where two balls just touch
//       and fades as they overlap more. Lift c a little off a surface it lies on. Two draw calls (a depth pass and the
//       glass), after everything else of the set; the depth pass hides what is drawn later within the dome's height
//       over the plane. P.dome.value: the dome's height on the radius (change it for every disc of the pool).
//   sheet(max).add(a, b, c, col, alpha, edge)
//       One glass triangle (corners a, b, c) in a merged buffer: 25 % glass at alpha 1, lit, a little brighter seen
//       edge-on; edge 0..1 (optional, default 0.6) a thin bright line along its sides. Drawn in front of a surface it
//       lies on (polygon offset), so it never fights with it.
//   ribbons(max, pts = 200).add(env, o, U, Y, depth, col, alpha, opts)
//       A curve standing in the space as a lit strip: env is an envelope [u, y, u, y, ...] (u along the curve, 0..1 by
//       convention; y its height, negative below the base line); the strip stands in the plane of U and Y from o:
//       a point (u, y) lies at o + u U + y Y (so U's length is the curve's width and Y's the height of y = 1), and it
//       is 'depth' thick (across, along U x Y). Drawn as a glass face filling from the base line to the curve (faint
//       at the base, brighter towards the curve) and a lit top edge 'depth' wide that glows. opts (optional; one
//       object kept by the set, its fields may change): neg (the colour where y < 0, default col), glow 0..1 (the
//       edge's glow, default 0.6), fill 0..1 (the face's strength, default 1), from, to (only u from..to is drawn,
//       default all). Each pool holds up to max ribbons of up to pts points (a longer envelope is thinned evenly);
//       the envelopes are kept on the graphics card, by identity: give a new array for new values, or call
//       P.changed(env) after changing one in place. One draw call for the pool.
//   slides(max).add(p, q, size, tint, alpha, glow)
//       A glass microscope slide: a thin rounded block with bevelled edges and a frosted label at its -x end. Lying
//       flat its length runs along x, its width along z (a third of the length: P.dims) and its top faces +y. q: a
//       THREE.Quaternion or [x, y, z, w] turning it from lying flat, or null. size: its length, or [sx, sy, sz] scaling
//       the standard slide (length 1, thickness P.dims.thick, width P.dims.wid) along x, y and z. tint: the label's
//       colour (the glass takes a hint of it). glow 0..1 (optional): the label lit (a pick). P.dims = { len: 1, wid,
//       thick, label } in units of the length: the label covers x from -0.5 to -0.5 + label, so tissue goes on the
//       rest of the top face (y = thick / 2).
//   cells(max, opts).add(p, r, kind, col, alpha, angle, nrm, nuc)
//       A cell as a splat lying on a surface: centre p, radius r (its long half-axis; the kind sets its shape), kind
//       0..8 (CELL below), col its cytoplasm (or a bead's colour), angle the turn of its long axis about the normal
//       (from the surface's first tangent: +x on a surface facing +y; every cell's details follow from its angle and
//       radius, so give each cell a steady angle of its own), nrm the surface's normal (null: the splat faces the
//       camera), nuc its nucleus (optional, default CELLCOL[kind][1]). H&E cells fade out as they shrink on screen
//       (under P.lod(px0, px1): their radius in pixels, default 0.6 to 1.6; lay a stain under them for far views) and
//       near the eye; beads never shrink under 1.5 pixels (smaller ones dim instead). P.bead(v): every cell turns into
//       a bead of 0.385 of its radius, in BEAD or the colour set by P.beadCol(c), as v goes 0..1. opts (optional):
//       additive (glowing on black), depth (write depth while the set is fully in). Drawn in front of the surface
//       (polygon offset). A still pool of thousands is best filled once (P.begin, adds, P.end) and left.
//   he(H, E, out)                                      the colour of H haematoxylin and E eosin (optical densities)
// Cell kinds (CELL): HEP 0 (hepatocyte-like: polygonal, a large round nucleus with its nucleolus, sometimes two), LARGE 1
// (a bigger, darker, irregular nucleus), SPINDLE 2 (a long thin cell, a slim nucleus), SMALL 3 (small and round, a dark
// nucleus filling it), LOBED 4 (a nucleus in three lobes), BODY 5 (shrunken and deep pink, with dense fragments), RBC 6 (a
// red disc with a pale middle, no nucleus), PLAIN 7 (round, a round nucleus), BEAD 8 (a glowing bead: r is its core; it
// glows out to 2.6 r). kindOf(type name) gives the kind for a cell classifier's label (Epithelial HEP, Cancer cell
// LARGE, Fibroblasts SPINDLE, Lymphocytes SMALL, Apoptotic Body BODY, ...). CELLCOL[kind]: [cytoplasm, nucleus] in H&E.
// Colours ([r, g, b]): CYAN (balls, triangles, highlights), EDGE (edges), BEAD (cells as beads), PIECE (H0, amber), LOOP
// (H1, orange), HEALTHY, HEALTHYLIT, CIRR, CIRRLIT (the two classes, and where they must glow), WHITE, INK, GREY, DARK,
// GLASS (glass spheres), SLIDE (the slides' glass), NUC, NUCLIT, EOSIN, EOSINPALE, COLLAGEN (H&E).
// Helpers: mix(a, b, t, out) (out optional, else a new array), quat(out, axis, angle) (a quaternion [x, y, z, w] about
// 'axis' into out, for slides), ID (no turn: [0, 0, 0, 1]).
const TLOOK = function (K, set) {
  const { THREE, rgb } = K;
  const LIGHT = 'vec3 l = normalize(vec3(-0.45, 0.55, 0.7));   // over the viewer\'s left shoulder, as the scene\'s light';
  const FRAG = `
varying vec3 vC, vN, vV; varying float vA, vU, vD;
void main() {
  if (vD > 0.5 && fract(vU * vD) > 0.56) discard;   // dashed
  vec3 n = normalize(vN), v = normalize(vV);
  if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - abs(dot(n, v)), 2.2), spec = pow(max(dot(reflect(-l, n), v), 0.0), 28.0);
  vec3 col = vC * (0.3 + 0.5 * dif + 0.2 * hemi) + vC * rim * 0.9 + vec3(spec * 0.3);
  gl_FragColor = vec4(col, vA);
}`;
  // opts: side, blending, uniforms, fixed (never written depth by depth()), offset (drawn in front of a surface it lies
  // on), deriv (fwidth), fragDepth, depthWrite, colorWrite; additive materials keep depth writes off
  const mat = (vertex, frag, opts = {}) => {
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ uA: set.uA }, opts.uniforms || {}), vertexShader: vertex, fragmentShader: frag || FRAG,
      transparent: true, side: opts.side === undefined ? THREE.DoubleSide : opts.side, blending: opts.blending || THREE.NormalBlending,
      depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : !opts.blending && !opts.fixed });
    if (opts.colorWrite === false) m.colorWrite = false;
    if (opts.offset) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -opts.offset; }
    m.extensions = { derivatives: !!opts.deriv, fragDepth: !!opts.fragDepth };
    m.userData.fixed = !!opts.fixed;
    set.mats.push(m);
    return m;
  };
  const VTUBE = `
attribute vec3 aCol; attribute float aA, aDash;
uniform float uA;
varying vec3 vC, vN, vV; varying float vA, vU, vD;
void main() {
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vV = -mv.xyz; vC = aCol; vA = aA * uA; vU = uv.y; vD = aDash;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const VRING = `
attribute vec2 aUV, aRr; attribute vec3 aCol; attribute float aA, aDash;
uniform float uA;
varying vec3 vC, vN, vV; varying float vA, vU, vD;
void main() {
  float cu = cos(aUV.x), su = sin(aUV.x), cv = cos(aUV.y), sv = sin(aUV.y), R = aRr.x + aRr.y * cv;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(R * cu, R * su, aRr.y * sv, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * vec3(cv * cu, cv * su, sv));
  vV = -mv.xyz; vC = aCol; vA = aA * uA; vU = aUV.x / 6.2831853; vD = aDash;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  // only the part of a buffer in use goes to the graphics card (a count of 0 would mean all of it: skipped)
  const upload = (attr, n) => { attr.updateRange.offset = 0; attr.updateRange.count = n * attr.itemSize; attr.needsUpdate = true; };
  // per-instance attributes on an instanced mesh (extra: { name: size }; size 0 drops one of the defaults)
  function pool(geo, material, max, extra) {
    const g = new THREE.BufferGeometry();
    for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
    g.setIndex(geo.index);
    const A = { aCol: 3, aA: 1, aDash: 1 };
    Object.assign(A, extra || {});
    const attrs = {};
    for (const k in A) {
      if (!A[k]) continue;
      attrs[k] = new THREE.InstancedBufferAttribute(new Float32Array(max * A[k]), A[k]); attrs[k].setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, attrs[k]);
    }
    const mesh = new THREE.InstancedMesh(g, material, max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false;
    const P = { mesh, attrs, n: 0, max };
    P.begin = () => { P.n = 0; };
    P.end = () => {
      mesh.count = P.n; mesh.visible = P.n > 0;
      if (!P.n) return;
      upload(mesh.instanceMatrix, P.n);
      for (const k in attrs) upload(attrs[k], P.n);
    };
    // the next instance with its colour and alpha (its matrix written by the caller), or -1 when full
    P.slot = (col, a) => {
      if (P.n >= max) return -1;
      const i = P.n++, c = Array.isArray(col) ? col : rgb(col);
      attrs.aCol.array[3 * i] = c[0]; attrs.aCol.array[3 * i + 1] = c[1]; attrs.aCol.array[3 * i + 2] = c[2];
      attrs.aA.array[i] = a;
      return i;
    };
    P.put = (m, col, a, dash) => {
      const i = P.slot(col, a);
      if (i < 0) return -1;
      mesh.setMatrixAt(i, m);
      if (attrs.aDash) attrs.aDash.array[i] = dash || 0;
      return i;
    };
    return P;
  }
  // a small mesh builder for the slides: vertices [x, y, z, nx, ny, nz, ...extras]; each triangle is wound to face its
  // vertices' normals (so front faces are outside, whatever order the code lists them in)
  function builder(extra) {
    const pos = [], nrm = [], ex = extra.map(() => []);
    const push = v => {
      pos.push(v[0], v[1], v[2]); nrm.push(v[3], v[4], v[5]);
      let o = 6;
      extra.forEach((e, j) => { for (let k = 0; k < e[1]; k++) ex[j].push(v[o++]); });
    };
    const tri = (a, b, c) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      if (gx * gx + gy * gy + gz * gz < 1e-14) return;
      if (gx * (a[3] + b[3] + c[3]) + gy * (a[4] + b[4] + c[4]) + gz * (a[5] + b[5] + c[5]) < 0) { push(a); push(c); push(b); } else { push(a); push(b); push(c); }
    };
    return {
      tri, quad: (a, b, c, d) => { tri(a, b, c); tri(a, c, d); },
      geo() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
        extra.forEach((e, j) => g.setAttribute(e[0], new THREE.Float32BufferAttribute(ex[j], e[1])));
        return g;
      },
    };
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);
  // tubes: open cylinders from a to b, radius r; dash = the number of dashes along it (0 solid)
  function tubes(max) {
    const P = pool(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), mat(VTUBE), max);
    P.add = (a, b, r, col, alpha, dash) => {
      _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const len = _d.length();
      if (len < 1e-6 || r <= 0 || alpha <= 0.004) return -1;
      _q.setFromUnitVectors(_y, _d.multiplyScalar(1 / len));
      _p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      _m.compose(_p, _q, _s.set(r, len, r));
      return P.put(_m, col, alpha, dash ? Math.max(2, Math.round(dash)) : 0);
    };
    return P;
  }
  // rings: a torus around centre c, its axis 'axis', major radius R, tube radius r; dash = dashes around it
  function rings(max) {
    const U = 40, V = 8, pos = [], uv = [], idx = [];
    for (let i = 0; i <= U; i++) for (let j = 0; j <= V; j++) { const u = i / U * Math.PI * 2, v = j / V * Math.PI * 2; uv.push(u, v); pos.push(Math.cos(u), Math.sin(u), 0); }
    for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) { const a = i * (V + 1) + j, b = a + V + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const P = pool(geo, mat(VRING), max, { aRr: 2 });
    P.add = (c, axis, R, r, col, alpha, dash) => {
      if (R <= 0 || alpha <= 0.004) return -1;
      _d.set(axis[0], axis[1], axis[2]).normalize();
      _q.setFromUnitVectors(_z, _d);
      _m.compose(_p.set(c[0], c[1], c[2]), _q, _s.set(1, 1, 1));
      const i = P.put(_m, col, alpha, dash ? Math.max(4, Math.round(dash)) : 0);
      if (i >= 0) { P.attrs.aRr.array[2 * i] = R; P.attrs.aRr.array[2 * i + 1] = r; }
      return i;
    };
    return P;
  }
  // balls: lit spheres at p, radius r
  function balls(max) {
    const P = pool(new THREE.SphereGeometry(1, 16, 12), mat(VTUBE), max);
    P.add = (p, r, col, alpha) => {
      if (r <= 0 || alpha <= 0.004) return -1;
      _m.compose(_p.set(p[0], p[1], p[2]), _q.set(0, 0, 0, 1), _s.set(r, r, r));
      return P.put(_m, col, alpha, 0);
    };
    return P;
  }
  // boxes: lit blocks at p, sizes [sx, sy, sz]
  function boxes(max) {
    const P = pool(new THREE.BoxGeometry(1, 1, 1), mat(VTUBE), max);
    P.add = (p, sz, col, alpha) => {
      if (alpha <= 0.004) return -1;
      _m.compose(_p.set(p[0], p[1], p[2]), _q.set(0, 0, 0, 1), _s.set(sz[0], sz[1], sz[2]));
      return P.put(_m, col, alpha, 0);
    };
    return P;
  }
  // halos: soft additive glows (the kit's points), size in local units
  function halos(max) {
    const g = K.pointsGeo(max), m = K.points(set), pts = new THREE.Points(g, m);
    pts.frustumCulled = false; pts.visible = false;
    const P = { mesh: pts, n: 0 };
    const pa = g.attributes.position.array, ca = g.attributes.aCol.array, sa = g.attributes.aSize.array, aa = g.attributes.aA.array;
    P.begin = () => { P.n = 0; };
    P.add = (p, size, col, alpha) => {
      if (P.n >= max || alpha <= 0.004) return;
      const i = P.n++, c = Array.isArray(col) ? col : rgb(col);
      pa[3 * i] = p[0]; pa[3 * i + 1] = p[1]; pa[3 * i + 2] = p[2];
      ca[3 * i] = c[0]; ca[3 * i + 1] = c[1]; ca[3 * i + 2] = c[2];
      sa[i] = size; aa[i] = alpha;
    };
    P.end = () => {
      g.setDrawRange(0, P.n); pts.visible = P.n > 0;
      if (P.n) for (const k of ['position', 'aCol', 'aSize', 'aA']) upload(g.attributes[k], P.n);
    };
    return P;
  }
  // cones: a base disc of radius r at 'base', the tip at base + unit(dir) * length
  function cones(max) {
    const geo = new THREE.ConeGeometry(1, 1, 16, 1, false);
    geo.translate(0, 0.5, 0);
    const P = pool(geo, mat(VTUBE, null, { side: THREE.FrontSide }), max);
    P.add = (base, dir, length, r, col, alpha) => {
      _d.set(dir[0], dir[1], dir[2]);
      const l = _d.length();
      if (l < 1e-9 || length <= 0 || r <= 0 || alpha <= 0.004) return -1;
      _q.setFromUnitVectors(_y, _d.multiplyScalar(1 / l));
      _m.compose(_p.set(base[0], base[1], base[2]), _q, _s.set(r, length, r));
      return P.put(_m, col, alpha, 0);
    };
    return P;
  }
  // glass: clear face-on, a glowing rim and a small highlight; the far side's rim shows through, fainter
  const FGLASS = `
varying vec3 vC, vN, vV; varying float vA, vU, vD;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  float f = gl_FrontFacing ? 1.0 : 0.4;
  if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float r = pow(1.0 - abs(dot(n, v)), 2.4), spec = gl_FrontFacing ? pow(max(dot(reflect(-l, n), v), 0.0), 60.0) : 0.0;
  gl_FragColor = vec4(vC * (0.3 + 1.1 * r) + vec3(spec), vA * (f * (0.05 + 0.75 * r) + 0.7 * spec));
}`;
  function glass(max) {
    const P = pool(new THREE.SphereGeometry(1, 28, 18), mat(VTUBE, FGLASS, { blending: THREE.AdditiveBlending }), max);
    P.mesh.renderOrder = 1;   // (after the solid pieces, so its glow lies over what is inside and behind)
    P.add = (p, r, col, alpha) => {
      if (r <= 0 || alpha <= 0.004) return -1;
      _m.compose(_p.set(p[0], p[1], p[2]), _q.set(0, 0, 0, 1), _s.set(r, r, r));
      return P.put(_m, col, alpha, 0);
    };
    return P;
  }

  // ---------------------------------------------------------------- frames on a surface
  // a matrix whose columns are the surface's first tangent turned by 'angle' about the normal, the second tangent and
  // the normal, each times s, then p: written straight into an instance matrix (16 floats at o). The first tangent is
  // +x projected onto the surface (+z where the normal is near x); nrm null: the xy plane (+z towards the viewer).
  function frame(arr, o, p, nrm, angle, s) {
    let nx = 0, ny = 0, nz = 1;
    if (nrm) { const l = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1; nx = nrm[0] / l; ny = nrm[1] / l; nz = nrm[2] / l; }
    let tx, ty, tz;
    if (Math.abs(nx) < 0.9) { tx = 1 - nx * nx; ty = -nx * ny; tz = -nx * nz; } else { tx = -nz * nx; ty = -nz * ny; tz = 1 - nz * nz; }
    const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;   // the second tangent: n x t
    const c = Math.cos(angle || 0), sn = Math.sin(angle || 0);
    arr[o] = (c * tx + sn * bx) * s; arr[o + 1] = (c * ty + sn * by) * s; arr[o + 2] = (c * tz + sn * bz) * s; arr[o + 3] = 0;
    arr[o + 4] = (c * bx - sn * tx) * s; arr[o + 5] = (c * by - sn * ty) * s; arr[o + 6] = (c * bz - sn * tz) * s; arr[o + 7] = 0;
    arr[o + 8] = nx * s; arr[o + 9] = ny * s; arr[o + 10] = nz * s; arr[o + 11] = 0;
    arr[o + 12] = p[0]; arr[o + 13] = p[1]; arr[o + 14] = p[2]; arr[o + 15] = 1;
  }
  const UPN = [0, 1, 0];

  // ---------------------------------------------------------------- glass discs (the growing balls)
  // A unit quad per disc. Both passes run the same shaders, so the depth they compute is the same to the bit: the first
  // writes only depth (each disc's low dome, raised towards the viewer), the second draws the glass where its own dome
  // is the nearest (less or equal), so overlapping discs cover each pixel once.
  const VDISC = `
attribute vec3 aCol; attribute float aA, aRim;
uniform float uA;
varying vec3 vC, vP, vM; varying vec2 vQ; varying float vA, vRim;
void main() {
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vQ = position.xy; vP = mv.xyz;
  vM = mat3(modelViewMatrix) * instanceMatrix[2].xyz;   // the plane's normal times the radius, in the view's units
  vC = aCol; vA = aA * uA; vRim = aRim;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const FDISC = `
uniform mat4 projectionMatrix; uniform float uDome;
varying vec3 vC, vP, vM; varying vec2 vQ; varying float vA, vRim;
void main() {
  float s2 = dot(vQ, vQ);
  if (s2 > 1.0) discard;
  float side = dot(vM, vP) <= 0.0 ? 1.0 : -1.0;          // the dome rises towards the viewer, from either side
  vec4 cp = projectionMatrix * vec4(vP + vM * (side * uDome * (1.0 - s2)), 1.0);
  gl_FragDepthEXT = 0.5 + 0.5 * cp.z / cp.w;
  float s = sqrt(s2), w = max(fwidth(s), 1e-4);
  float band = smoothstep(0.62, 1.0, s); band *= band;    // glass looks thicker towards its rim
  float line = smoothstep(1.0 - 2.5 * w - 0.03, 1.0 - 0.5 * w, s);
  float edge = 1.0 - smoothstep(1.0 - w, 1.0, s);
  // a soft sheen up-left, as the light
  float sh = smoothstep(0.75, 0.0, length(vQ - vec2(-0.38, 0.4))) * 0.12;
  vec3 col = vC * (0.5 + sh + 0.9 * band * vRim) + mix(vC, vec3(1.0), 0.45) * line * vRim;
  gl_FragColor = vec4(col, vA * edge * min(1.0, 0.15 + sh + 0.32 * band * vRim + 0.6 * line * vRim));
}`;
  function discs(max, dome = 0.25) {
    const U = { uDome: { value: dome } };
    const pre = mat(VDISC, FDISC, { uniforms: U, fixed: true, depthWrite: true, colorWrite: false, deriv: true, fragDepth: true });
    const glassM = mat(VDISC, FDISC, { uniforms: U, fixed: true, deriv: true, fragDepth: true });
    const P = pool(new THREE.PlaneGeometry(2, 2), pre, max, { aDash: 0, aRim: 1 }), group = new THREE.Group();
    const look = new THREE.InstancedMesh(P.mesh.geometry, glassM, max);
    look.instanceMatrix = P.mesh.instanceMatrix;   // (one buffer for both passes)
    look.frustumCulled = false; look.count = 0; look.visible = false;
    P.mesh.renderOrder = 2; look.renderOrder = 3;
    group.add(P.mesh, look);
    const end = P.end;
    P.end = () => { end(); look.count = P.n; look.visible = P.n > 0; };
    P.mesh = group; P.dome = U.uDome;
    P.add = (c, nrm, R, col, alpha, rim) => {
      if (R <= 0 || alpha <= 0.004) return -1;
      const i = P.slot(col, alpha);
      if (i < 0) return -1;
      frame(look.instanceMatrix.array, 16 * i, c, nrm || UPN, 0, R);
      P.attrs.aRim.array[i] = rim === undefined ? 1 : rim;
      return i;
    };
    return P;
  }

  // ---------------------------------------------------------------- a sheet of glass triangles
  const VSHEET = `
attribute vec3 aCol, aBar; attribute float aA, aEdge;
uniform float uA;
varying vec3 vC, vN, vV, vB; varying float vA, vE;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = aCol; vB = aBar; vA = aA * uA; vE = aEdge;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const FSHEET = `
varying vec3 vC, vN, vV, vB; varying float vA, vE;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), fr = pow(1.0 - abs(dot(n, v)), 2.0), spec = pow(max(dot(reflect(-l, n), v), 0.0), 40.0);
  float m = min(vB.x, min(vB.y, vB.z)), w = max(fwidth(m), 1e-5);
  float line = (1.0 - smoothstep(0.6 * w, 1.8 * w, m)) * vE;    // a crisp line along its sides
  float inner = (1.0 - smoothstep(0.0, 0.2, m)) * vE;            // and a soft glow inside them
  vec3 col = vC * (0.55 + 0.25 * dif + 0.5 * fr + 0.45 * inner) + mix(vC, vec3(1.0), 0.5) * line * 0.6 + vec3(spec * 0.5);
  gl_FragColor = vec4(col, vA * min(1.0, 0.25 + 0.2 * fr + 0.2 * inner + 0.5 * line + 0.4 * spec));
}`;
  function sheet(max) {
    const g = new THREE.BufferGeometry(), n9 = max * 9;
    const add = (name, size, arr) => { const a = new THREE.BufferAttribute(arr || new Float32Array(max * 3 * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    const pos = add('position', 3), nrm = add('normal', 3), col = add('aCol', 3), al = add('aA', 1), ed = add('aEdge', 1), bar = new Float32Array(n9);
    for (let i = 0; i < max; i++) { bar[9 * i] = 1; bar[9 * i + 4] = 1; bar[9 * i + 8] = 1; }
    g.setAttribute('aBar', new THREE.BufferAttribute(bar, 3));
    g.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(g, mat(VSHEET, FSHEET, { fixed: true, deriv: true, offset: 2 }));
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 1;
    const P = { mesh, n: 0, max };
    const pa = pos.array, na = nrm.array, ca = col.array, aa = al.array, ea = ed.array;
    P.begin = () => { P.n = 0; };
    P.add = (a, b, c, cl, alpha, edge) => {
      if (P.n >= max || alpha <= 0.004) return -1;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      const gl = Math.hypot(gx, gy, gz);
      if (gl < 1e-12) return -1;
      gx /= gl; gy /= gl; gz /= gl;
      const i = P.n++, k = Array.isArray(cl) ? cl : rgb(cl), e = edge === undefined ? 0.6 : edge;
      const o = 9 * i;
      pa[o] = a[0]; pa[o + 1] = a[1]; pa[o + 2] = a[2]; pa[o + 3] = b[0]; pa[o + 4] = b[1]; pa[o + 5] = b[2]; pa[o + 6] = c[0]; pa[o + 7] = c[1]; pa[o + 8] = c[2];
      for (let j = 0; j < 3; j++) {
        na[o + 3 * j] = gx; na[o + 3 * j + 1] = gy; na[o + 3 * j + 2] = gz;
        ca[o + 3 * j] = k[0]; ca[o + 3 * j + 1] = k[1]; ca[o + 3 * j + 2] = k[2];
        aa[3 * i + j] = alpha; ea[3 * i + j] = e;
      }
      return i;
    };
    P.end = () => {
      g.setDrawRange(0, 3 * P.n); mesh.visible = P.n > 0;
      if (P.n) for (const a of [pos, nrm, col, al, ed]) upload(a, 3 * P.n);
    };
    return P;
  }

  // ---------------------------------------------------------------- ribbons (curves standing in the space)
  // One template strip of pts points, drawn once per ribbon: four vertices per point (position.x the point, position.y
  // the part: 0 the base line, 1 the curve on the face, 2 and 3 the top edge's two sides). The envelopes live in a
  // float texture, a row each (u, y per texel); each ribbon's frame, colours and options are per-instance attributes.
  // (with antialiasing, a sample of a hair-thin triangle is shaded at the pixel's centre, outside it, unless at the
  // centroid: WebGL 2 only)
  const CENTROID = '#if __VERSION__ >= 300\ncentroid varying float vT;\n#else\nvarying float vT;\n#endif';
  const VRIB = `
attribute vec3 aO, aU, aY, aCol, aNeg; attribute vec4 aP, aR;   // aP: alpha, depth, glow, fill; aR: row, points, from, to
uniform float uA; uniform sampler2D uCurve; uniform vec2 uSize;
varying vec3 vC, vNg, vN, vV; varying float vA, vYs, vU, vG, vF, vCap; varying vec2 vRange;
${CENTROID}
vec2 pt(float i) { i = clamp(i, 0.0, aR.y - 1.0); return texture2D(uCurve, vec2((i + 0.5) / uSize.x, (aR.x + 0.5) / uSize.y)).xy; }
void main() {
  float i = position.x, part = position.y;
  vec2 c = pt(i), a = pt(i - 1.0), b = pt(i + 1.0);
  vec3 D = cross(aU, aY); float dl = length(D); D = dl > 1e-12 ? D / dl : vec3(0.0, 0.0, 1.0);
  float cap = step(1.5, part), side = part > 2.5 ? -1.0 : 1.0, sg = c.y < 0.0 ? -1.0 : 1.0;
  vec3 p = aO + c.x * aU + (part < 0.5 ? 0.0 : c.y) * aY + cap * side * 0.5 * aP.y * D;
  // the top edge faces away from the base line: the curve's normal in its plane
  vec3 t = (b.x - a.x) * aU + (b.y - a.y) * aY, n = cross(D, t);
  float nl = length(n);
  n = nl > 1e-12 ? sg * n / nl : sg * normalize(aY);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * mix(D, n, cap)); vV = -mv.xyz;
  vC = aCol; vNg = aNeg; vA = aP.x * uA; vT = part < 0.5 ? 0.0 : 1.0; vYs = c.y; vU = c.x; vG = aP.z; vF = aP.w; vCap = cap; vRange = aR.zw;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // (points past the envelope's end sit on its last: no area)
}`;
  const FRIB = `
varying vec3 vC, vNg, vN, vV; varying float vA, vYs, vU, vG, vF, vCap; varying vec2 vRange;
${CENTROID}
void main() {
  if (vU < vRange.x || vU > vRange.y) discard;
  vec3 n = normalize(vN), v = normalize(vV);
  if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  vec3 c = vYs < 0.0 ? vNg : vC;
  float dif = max(dot(n, l), 0.0), spec = pow(max(dot(reflect(-l, n), v), 0.0), 30.0), rim = pow(1.0 - abs(dot(n, v)), 2.0);
  if (vCap > 0.5) {
    gl_FragColor = vec4(c * (0.45 + 0.35 * dif + 0.25 * rim + 0.4 * vG) + vec3(spec * 0.35), vA * 0.95);
  } else {
    // (the line along the curve; not on the slivers of a step's riser, whose derivatives run wild)
    float w = max(fwidth(vT), 1e-5), line = smoothstep(1.0 - 2.5 * w, 1.0 - 0.4 * w, vT) * step(w, 0.25);
    float t = clamp(vT, 0.0, 1.0);   // (extrapolated past 0..1 on the edge samples of thin slivers)
    float a = vF * (0.06 + 0.3 * pow(t, 1.5)) + line * (0.55 + 0.45 * vG);
    vec3 col = c * (0.5 + 0.2 * dif + 0.3 * t * t) + mix(c, vec3(1.0), 0.25) * line * (0.3 + 0.4 * vG) + vec3(spec * 0.12);
    gl_FragColor = vec4(col, vA * min(1.0, a));
  }
}`;
  function ribbons(max, pts = 200) {
    pts = Math.max(2, pts | 0);
    const rows = max, tex = new Float32Array(pts * rows * 4);
    const T = new THREE.DataTexture(tex, pts, rows, THREE.RGBAFormat, THREE.FloatType);
    T.magFilter = T.minFilter = THREE.NearestFilter; T.generateMipmaps = false; T.needsUpdate = true;
    const tp = [], idx = [];
    for (let i = 0; i < pts; i++) for (let p = 0; p < 4; p++) tp.push(i, p, 0);
    for (let i = 0; i < pts - 1; i++) {
      const a = 4 * i, b = a + 4;
      idx.push(a, a + 1, b, b, a + 1, b + 1, a + 2, a + 3, b + 2, b + 2, a + 3, b + 3);
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    g.setIndex(idx);
    const attrs = {};
    for (const [k, s] of [['aO', 3], ['aU', 3], ['aY', 3], ['aCol', 3], ['aNeg', 3], ['aP', 4], ['aR', 4]]) {
      attrs[k] = new THREE.InstancedBufferAttribute(new Float32Array(max * s), s); attrs[k].setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, attrs[k]);
    }
    g.instanceCount = 0;
    const mesh = new THREE.Mesh(g, mat(VRIB, FRIB, { fixed: true, deriv: true, uniforms: { uCurve: { value: T }, uSize: { value: new THREE.Vector2(pts, rows) } } }));
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 1;
    // the envelopes held: env -> row; a row not used for longest is the one given to a new envelope
    const rowOf = new Map(), envAt = new Array(rows).fill(null), used = new Float64Array(rows), cnt = new Int32Array(rows);
    let tick = 0;
    function write(env, r) {
      const m = env.length >> 1, n = Math.min(m, pts), o = r * pts * 4;
      for (let k = 0; k < n; k++) {
        const j = m > pts ? Math.round(k * (m - 1) / (pts - 1)) : k;   // (thinned evenly, the ends kept)
        // a step's riser (two points at one u) a hair wide: a triangle with no area draws stray pixels
        tex[o + 4 * k] = k && env[2 * j] <= tex[o + 4 * k - 4] ? tex[o + 4 * k - 4] + 1e-5 : env[2 * j]; tex[o + 4 * k + 1] = env[2 * j + 1];
      }
      cnt[r] = n; T.needsUpdate = true;
    }
    function row(env) {
      let r = rowOf.get(env);
      if (r === undefined) {
        r = 0;
        for (let k = 1; k < rows; k++) if (used[k] < used[r]) r = k;
        if (used[r] === tick) return -1;   // (every row is in use this frame)
        if (envAt[r]) rowOf.delete(envAt[r]);
        envAt[r] = env; rowOf.set(env, r); write(env, r);
      }
      used[r] = tick;
      return r;
    }
    const P = { mesh, n: 0, max, pts };
    P.begin = () => { P.n = 0; tick++; };
    P.changed = env => { const r = rowOf.get(env); if (r !== undefined) write(env, r); };
    const NONE = {}, put3 = (a, i, v) => { a.array[3 * i] = v[0]; a.array[3 * i + 1] = v[1]; a.array[3 * i + 2] = v[2]; };
    P.add = (env, o, U, Y, depth, col, alpha, opts) => {
      if (P.n >= max || alpha <= 0.004 || !env || env.length < 4) return -1;
      const r = row(env);
      if (r < 0) return -1;
      const op = opts || NONE, i = P.n++, c = Array.isArray(col) ? col : rgb(col), ng = op.neg ? (Array.isArray(op.neg) ? op.neg : rgb(op.neg)) : c;
      put3(attrs.aO, i, o); put3(attrs.aU, i, U); put3(attrs.aY, i, Y); put3(attrs.aCol, i, c); put3(attrs.aNeg, i, ng);
      const p = attrs.aP.array, q = attrs.aR.array;
      p[4 * i] = alpha; p[4 * i + 1] = depth || 0; p[4 * i + 2] = op.glow === undefined ? 0.6 : op.glow; p[4 * i + 3] = op.fill === undefined ? 1 : op.fill;
      q[4 * i] = r; q[4 * i + 1] = cnt[r]; q[4 * i + 2] = op.from === undefined ? -1e9 : op.from; q[4 * i + 3] = op.to === undefined ? 1e9 : op.to;
      return i;
    };
    P.end = () => {
      g.instanceCount = P.n; mesh.visible = P.n > 0;
      if (P.n) for (const k in attrs) upload(attrs[k], P.n);
    };
    return P;
  }

  // ---------------------------------------------------------------- glass slides
  // The standard slide: length 1 along x, width WID along z, thickness THK, corners rounded, a bevel round both faces.
  // parts (aPart): 0 the top face, 1 the bevels, 2 the side wall, 3 the bottom face. uv runs over the faces (u along
  // the length from the label's end, v across).
  const WID = 1 / 3, THK = 0.03, LAB = 0.26;
  function slideGeo() {
    const B = builder([['uv', 2], ['aPart', 1]]), hx = 0.5, hz = WID / 2, rc = 0.03, bv = 0.007, h = THK / 2, CS = 6, O = [];
    const cen = [[hx - rc, hz - rc], [-hx + rc, hz - rc], [-hx + rc, -hz + rc], [hx - rc, -hz + rc]];
    for (let j = 0; j < 4; j++) for (let s = 0; s <= CS; s++) {
      const a = (j + s / CS) * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a);
      O.push([cen[j][0] + rc * c, cen[j][1] + rc * sn, c, sn]);
    }
    const n = O.length, uv = (x, z) => [x + 0.5, z / WID + 0.5], H2 = Math.SQRT1_2;
    for (const s of [1, -1]) {
      const part = s > 0 ? 0 : 3, C = [0, s * h, 0, 0, s, 0, ...uv(0, 0), part];
      for (let i = 0; i < n; i++) {
        const a = O[i], b = O[(i + 1) % n];
        const ai = [a[0] - a[2] * bv, a[1] - a[3] * bv], bi = [b[0] - b[2] * bv, b[1] - b[3] * bv];
        // the face (a fan from the middle), the bevel down to the wall
        B.tri(C, [ai[0], s * h, ai[1], 0, s, 0, ...uv(ai[0], ai[1]), part], [bi[0], s * h, bi[1], 0, s, 0, ...uv(bi[0], bi[1]), part]);
        B.quad([ai[0], s * h, ai[1], a[2] * H2, s * H2, a[3] * H2, ...uv(ai[0], ai[1]), 1], [bi[0], s * h, bi[1], b[2] * H2, s * H2, b[3] * H2, ...uv(bi[0], bi[1]), 1],
          [b[0], s * (h - bv), b[1], b[2] * H2, s * H2, b[3] * H2, ...uv(b[0], b[1]), 1], [a[0], s * (h - bv), a[1], a[2] * H2, s * H2, a[3] * H2, ...uv(a[0], a[1]), 1]);
      }
    }
    for (let i = 0; i < n; i++) {
      const a = O[i], b = O[(i + 1) % n], z = h - bv;
      B.quad([a[0], z, a[1], a[2], 0, a[3], ...uv(a[0], a[1]), 2], [b[0], z, b[1], b[2], 0, b[3], ...uv(b[0], b[1]), 2],
        [b[0], -z, b[1], b[2], 0, b[3], ...uv(b[0], b[1]), 2], [a[0], -z, a[1], a[2], 0, a[3], ...uv(a[0], a[1]), 2]);
    }
    return B.geo();
  }
  const VSLIDE = `
attribute vec3 aCol; attribute float aA, aGlow, aPart;
uniform float uA;
varying vec3 vC, vN, vV; varying vec2 vUv; varying float vA, vP, vG;
void main() {
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vV = -mv.xyz; vC = aCol; vA = aA * uA; vUv = uv; vP = aPart; vG = aGlow;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const FSLIDE = `
uniform vec3 uGlass;
varying vec3 vC, vN, vV; varying vec2 vUv; varying float vA, vP, vG;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), fr = pow(1.0 - abs(dot(n, v)), 3.0), spec = pow(max(dot(reflect(-l, n), v), 0.0), 60.0);
  vec3 gc = mix(uGlass, vC, 0.15);
  if (vP < 0.5 || vP > 2.5) {
    // a face: clear glass, and on the top the frosted label at the slide's end (its edges a pixel soft)
    float w = max(fwidth(vUv.x), 1e-5) * 1.2, wv = max(fwidth(vUv.y), 1e-5) * 1.2;
    float lab = vP < 0.5 ? smoothstep(0.025 - w, 0.025 + w, vUv.x) * (1.0 - smoothstep(${LAB.toFixed(3)} - w, ${LAB.toFixed(3)} + w, vUv.x))
      * smoothstep(0.07 - wv, 0.07 + wv, vUv.y) * (1.0 - smoothstep(0.93 - wv, 0.93 + wv, vUv.y)) : 0.0;
    float gr = (h2(floor(vUv * vec2(700.0, 240.0))) - 0.5) * 0.06;   // frosted grain
    vec3 fro = mix(vec3(0.84, 0.88, 0.93), vC, 0.6) * (0.72 + 0.3 * dif + gr) * (1.0 + 0.7 * vG) + vC * vG * 0.4;
    // (clear glass: almost nothing face-on, more towards grazing, a broad sheen; the bottom face fainter)
    float sh = pow(max(dot(reflect(-l, n), v), 0.0), 6.0) * 0.08;
    vec3 col = mix(gc * (0.5 + 0.9 * fr) + vec3(spec + sh), fro, lab);
    gl_FragColor = vec4(col, vA * mix((0.025 + 0.4 * fr + 0.8 * spec + sh) * (vP > 2.5 ? 0.6 : 1.0), 0.9, lab));
  } else {
    // the polished edges catch the light and glow a little, as a slide's do
    vec3 col = mix(gc, vec3(1.0), 0.3) * (0.45 + 0.55 * dif) + gc * fr * 0.8 + vec3(spec);
    gl_FragColor = vec4(col, vA * (vP < 1.5 ? 0.6 : 0.8));
  }
}`;
  function slides(max) {
    const m = mat(VSLIDE, FSLIDE, { fixed: true, deriv: true, uniforms: { uGlass: { value: new THREE.Color(...SLIDE) } } });
    const P = pool(slideGeo(), m, max, { aDash: 0, aGlow: 1 });
    P.dims = { len: 1, wid: WID, thick: THK, label: LAB };
    P.add = (p, q, size, tint, alpha, glow) => {
      if (alpha <= 0.004) return -1;
      if (!q) _q.set(0, 0, 0, 1); else if (q.isQuaternion) _q.copy(q); else _q.set(q[0], q[1], q[2], q[3]);
      if (Array.isArray(size)) _s.set(size[0], size[1], size[2]); else { if (!(size > 0)) return -1; _s.set(size, size, size); }
      _m.compose(_p.set(p[0], p[1], p[2]), _q, _s);
      const i = P.put(_m, tint, alpha, 0);
      if (i >= 0) P.attrs.aGlow.array[i] = glow || 0;
      return i;
    };
    return P;
  }

  // ---------------------------------------------------------------- cells (H&E splats, or glowing beads)
  // A unit quad per cell, lying on its surface (or facing the camera), the cell drawn in the quad's own frame (x its
  // long axis): its outline, cytoplasm and nucleus by kind; details only while it is a few pixels across.
  const VCELL = `
attribute vec3 aCol, aNuc, aK;   // aK: kind, seed, facing the camera
attribute float aA;
uniform float uA, uPx, uBead; uniform vec2 uLod;
varying vec3 vC, vNu; varying vec2 vQ; varying float vA, vK, vS, vPx;
void main() {
  float bead = aK.x > 7.5 ? 1.0 : 0.0, grow = mix(1.0, 2.6, bead);
  vec3 c = instanceMatrix[3].xyz;
  float r = length(instanceMatrix[0].xyz), ws = length(modelMatrix[0].xyz);
  vec4 mc = modelViewMatrix * vec4(c, 1.0);
  float dist = max(-mc.z, 1e-4), px = r * uPx * projectionMatrix[1][1] / dist;   // its radius on screen, in pixels
  // beads never shrink under 1.5 pixels: smaller ones grow and dim instead
  float g = bead > 0.5 ? max(1.0, 1.5 / max(px, 1e-3)) : 1.0;
  vec2 q = position.xy * grow * g;
  vec4 mv; float facing = 1.0;
  if (aK.z > 0.5) {
    vec3 cw = (modelMatrix * vec4(c, 1.0)).xyz, d = cameraPosition - cw;
    d = dot(d, d) > 1e-10 ? normalize(d) : vec3(0.0, 0.0, 1.0);
    vec3 rr = cross(vec3(0.0, 1.0, 0.0), d);
    rr = dot(rr, rr) > 1e-8 ? normalize(rr) : vec3(1.0, 0.0, 0.0);
    vec2 e = mat2(instanceMatrix[0].xy, instanceMatrix[1].xy) * q;   // turned by its angle, in local units
    mv = viewMatrix * vec4(cw + (rr * e.x + cross(d, rr) * e.y) * ws, 1.0);
  } else {
    mv = modelViewMatrix * instanceMatrix * vec4(q, 0.0, 1.0);
    facing = abs(dot(normalize(mat3(modelViewMatrix) * instanceMatrix[2].xyz), normalize(-mc.xyz)));
  }
  float lod = mix(smoothstep(uLod.x, uLod.y, px), 1.0, max(bead, uBead));
  // edge-on a flat cell is a sliver that flickers: it fades there; and near the eye
  vA = aA * uA * lod * mix(smoothstep(0.05, 0.25, facing), 1.0, bead) * smoothstep(2.0, 4.0, dist / max(r * ws * grow, 1e-6)) / (g * g);
  vC = aCol; vNu = aNuc; vQ = position.xy; vK = aK.x; vS = aK.y; vPx = px * grow * g;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const FCELL = `
uniform vec3 uBeadCol; uniform float uBead;
varying vec3 vC, vNu; varying vec2 vQ; varying float vA, vK, vS, vPx;
float h1(float n) { return fract(sin(n) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0;
  return mix(mix(h1(n), h1(n + 1.0), f.x), mix(h1(n + 57.0), h1(n + 58.0), f.x), f.y);
}
// the cell in H&E: colour and alpha
vec4 cell(vec2 q, int k, float s, float aa) {
  float th = atan(q.y, q.x), det = smoothstep(2.5, 7.0, vPx);
  float asp = 0.9, wob = 0.05, nr = 0.42, nasp = 0.95, nwob = 0.04, nuo = 0.0;   // outline, nucleus, nucleolus
  if (k == 0) { asp = 0.92; nr = 0.34; nuo = 0.075; }
  else if (k == 1) { asp = 0.84; wob = 0.08; nr = 0.5; nasp = 0.86; nwob = 0.13; nuo = 0.1; }
  else if (k == 2) { asp = 0.26; wob = 0.03; nr = 0.5; nasp = 0.34; nwob = 0.03; }
  else if (k == 3) { asp = 0.95; nr = 0.76; }
  else if (k == 4) { asp = 0.94; nr = 0.0; }
  else if (k == 5) { asp = 0.9; nr = 0.0; }
  else if (k == 6) { asp = 0.97; wob = 0.015; nr = 0.0; }
  float rc;
  if (k == 2) rc = length(vec2(q.x, q.y / (asp * max(0.12, 1.0 - 0.8 * q.x * q.x))));   // a spindle, tapering to both ends
  else {
    vec2 e = vec2(q.x, q.y / asp);
    rc = length(e);
    if (k == 0) {   // hepatocytes: polygons pressed together
      float pd = 0.0;
      for (int j = 0; j < 6; j++) { float b = 6.2831853 * s + float(j) * 1.0471976; pd = max(pd, dot(e, vec2(cos(b), sin(b)))); }
      rc = mix(rc, pd * 1.1547, 0.6);
    }
  }
  rc *= 1.0 + wob * (0.6 * sin(3.0 * th + 6.2831853 * s) + 0.4 * sin(5.0 * th + 17.0 * s));
  if (k == 5) rc /= 0.64;   // shrunken, in a clear halo
  float cm = 1.0 - smoothstep(1.0 - aa, 1.0, rc);
  if (cm <= 0.0) return vec4(0.0);
  // the nucleus: one (two in some hepatocytes), three lobes, or the dense fragments of an apoptotic body
  vec2 no = k == 2 ? vec2(0.0) : 0.08 * vec2(cos(s * 40.0), sin(s * 40.0));
  float nm = 0.0, ns = 1.0;
  if (nr > 0.0) {
    vec2 d = (q - no) / vec2(nr, nr * nasp);
    float rn = length(d) * (1.0 + nwob * sin(4.0 * atan(d.y, d.x) + 9.0 * s));
    if (k == 0 && s > 0.82) { rn = min(length(q - vec2(0.25, 0.0)), length(q + vec2(0.25, 0.0))) / (0.8 * nr); ns = 0.8; }
    nm = 1.0 - smoothstep(1.0 - aa / (nr * ns * nasp), 1.0, rn);
  } else if (k == 4) {
    float m = 9.0;
    for (int j = 0; j < 3; j++) { float b = 6.2831853 * s + float(j) * 1.3; m = min(m, length(q - 0.3 * vec2(cos(b), sin(b))) / 0.23); }
    nm = 1.0 - smoothstep(1.0 - aa / 0.23, 1.0, m);
  } else if (k == 5) {
    float m = 9.0;
    for (int j = 0; j < 3; j++) { float b = 6.2831853 * s + float(j) * 2.1, f = float(j); m = min(m, length(q - (0.12 + 0.1 * f) * vec2(cos(b), sin(b))) / (0.17 - 0.03 * f)); }
    nm = 1.0 - smoothstep(1.0 - aa / 0.12, 1.0, m);
  }
  // colours: grainy cytoplasm a little darker at the membrane, chromatin, a darker nucleolus
  vec3 cy = vC * (1.0 + 0.14 * (vn(q * 9.0 + s * 50.0) - 0.5) * det) * (1.0 - 0.16 * smoothstep(0.6, 1.0, rc));
  if (k == 6) cy = mix(cy, min(vec3(1.0), cy * 1.15 + 0.07), smoothstep(0.65, 0.05, rc));   // a red cell's pale middle
  vec3 nu = vNu * (1.0 + 0.4 * (vn(q * 15.0 + s * 31.0) - 0.5) * det);
  if (nuo > 0.0) {
    float dn = length(q - no - 0.35 * nr * vec2(cos(s * 23.0), sin(s * 23.0)));
    nu = mix(nu, vNu * 0.55, (1.0 - smoothstep(nuo - aa, nuo + aa, dn)) * det);
  }
  return vec4(mix(cy, nu, nm), max((k == 3 ? 0.86 : 0.92) * cm, 0.97 * nm));
}
void main() {
  float aa = 1.5 / max(vPx, 0.5);   // a pixel and a half, in the quad's units
  int k = int(vK + 0.5);
  float b = k == 8 ? 1.0 : uBead;
  vec4 he = b < 0.999 ? cell(vQ, k, vS, aa) : vec4(0.0);
  // the bead: a bright core, round and lit up-left, in a soft glow
  float d = length(vQ), core = 1.0 - smoothstep(0.385 - aa, 0.385 + aa, d);
  vec2 sq = vQ / 0.385;
  float lit = 0.78 + 0.32 * clamp(dot(sq, vec2(-0.45, 0.55)), -1.0, 1.0) * core;
  vec3 bc = k == 8 ? vC : uBeadCol;
  vec4 bd = vec4(mix(bc * lit, vec3(1.0), 0.45 * (1.0 - smoothstep(0.0, 0.22, d))), max(core, 0.55 * pow(max(0.0, 1.0 - d), 2.4)));
  vec4 o = mix(he, bd, b);
  if (o.a * vA < 0.01) discard;
  gl_FragColor = vec4(o.rgb, o.a * vA);
}`;
  function cells(max, opts = {}) {
    const U = { uPx: K.U.uPx, uBead: { value: 0 }, uLod: { value: new THREE.Vector2(0.6, 1.6) }, uBeadCol: { value: new THREE.Color(...BEAD) } };
    const m = mat(VCELL, FCELL, { uniforms: U, fixed: !opts.depth, offset: 4, blending: opts.additive ? THREE.AdditiveBlending : undefined });
    const P = pool(new THREE.PlaneGeometry(2, 2), m, max, { aDash: 0, aNuc: 3, aK: 3 });
    P.mesh.renderOrder = 1;
    P.bead = v => { U.uBead.value = v; };
    P.lod = (a, b) => { U.uLod.value.set(a, b); };
    P.beadCol = c => { const k = Array.isArray(c) ? c : rgb(c); U.uBeadCol.value.setRGB(k[0], k[1], k[2]); };
    P.add = (p, r, kind, col, alpha, angle, nrm, nuc) => {
      if (r <= 0 || alpha <= 0.004) return -1;
      const k = kind > 0 ? Math.min(8, kind | 0) : 0, i = P.slot(col, alpha);
      if (i < 0) return -1;
      const a = angle || 0, x = Math.sin(a * 12.9898 + r * 78.233 + k) * 43758.5453;
      frame(P.mesh.instanceMatrix.array, 16 * i, p, nrm, a, r);
      const n = nuc ? (Array.isArray(nuc) ? nuc : rgb(nuc)) : CELLCOL[k][1], N = P.attrs.aNuc.array, Q = P.attrs.aK.array;
      N[3 * i] = n[0]; N[3 * i + 1] = n[1]; N[3 * i + 2] = n[2];
      Q[3 * i] = k; Q[3 * i + 1] = x - Math.floor(x); Q[3 * i + 2] = nrm ? 0 : 1;
      return i;
    };
    return P;
  }

  // depth writes only while the set is fully in (fading glass would hide what is behind it); glass never
  const depth = () => { const on = set.uA.value > 0.97; for (const m of set.mats) if (m.blending === THREE.NormalBlending && !m.userData.fixed) m.depthWrite = on; };
  const mix = (a, b, t, out) => { const o = out || [0, 0, 0]; o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
  const quat = (out, axis, angle) => {
    const l = Math.hypot(axis[0], axis[1], axis[2]) || 1, s = Math.sin(angle / 2) / l;
    out[0] = axis[0] * s; out[1] = axis[1] * s; out[2] = axis[2] * s; out[3] = Math.cos(angle / 2); return out;
  };
  // Beer-Lambert stain colours, as the tour's tissue set: optical densities of haematoxylin (purple) and eosin (pink)
  const he = (H, E, out) => {
    const o = out || [0, 0, 0];
    o[0] = Math.exp(-(H * 1.31 + E * 0.16)); o[1] = Math.exp(-(H * 1.37 + E * 1.05)); o[2] = Math.exp(-(H * 0.62 + E * 0.6));
    return o;
  };
  const CELL = { HEP: 0, LARGE: 1, SPINDLE: 2, SMALL: 3, LOBED: 4, BODY: 5, RBC: 6, PLAIN: 7, BEAD: 8 };
  // [cytoplasm, nucleus] by kind (a bead's are its colour and white)
  const CELLCOL = [[he(0.08, 0.42), he(1.05, 0.25)], [he(0.12, 0.38), he(1.4, 0.3)], [he(0.05, 0.48), he(1.25, 0.3)],
    [he(0.25, 0.18), he(1.75, 0.2)], [he(0.06, 0.32), he(1.3, 0.3)], [he(0.05, 0.85), he(1.95, 0.4)],
    [rgb('#d9455f'), rgb('#d9455f')], [he(0.08, 0.38), he(1.15, 0.25)], [rgb('#ffe8b0'), [1, 1, 1]]];
  // a cell classifier's label (the 14 of HistoPLUS and the like) -> the kind it is drawn as (drawing, not science)
  const kindOf = name => {
    const s = String(name).toLowerCase();
    return /epithel|hepato/.test(s) ? 0 : /cancer|tumou?r|mitotic/.test(s) ? 1 : /fibro|muscle|endothel|stroma/.test(s) ? 2
      : /lympho|plasm/.test(s) ? 3 : /neutro|eosino|mast/.test(s) ? 4 : /apopto/.test(s) ? 5 : /red blood|erythro/.test(s) ? 6 : 7;
  };
  const CYAN = rgb('#46d9ff'), BEAD = rgb('#ffe8b0'), SLIDE = rgb('#cfefff');
  return {
    tubes, rings, balls, boxes, halos, cones, glass, discs, sheet, ribbons, slides, cells, depth, mix, quat, he, ID: [0, 0, 0, 1],
    CELL, CELLCOL, kindOf,
    CYAN, EDGE: rgb('#9fe8ff'), BEAD, PIECE: rgb('#ffb43b'), LOOP: rgb('#ff7a3c'),
    HEALTHY: rgb('#4d9de0'), HEALTHYLIT: rgb('#7cc0ff'), CIRR: rgb('#e0504d'), CIRRLIT: rgb('#ff7a6b'),
    WHITE: rgb('#f2f6ff'), INK: rgb('#e7eef8'), GREY: rgb('#5d6676'), DARK: rgb('#0b1322'), GLASS: rgb('#8cc6ff'), SLIDE,
    NUC: rgb('#3b2a7a'), NUCLIT: rgb('#5a3fa0'), EOSIN: rgb('#e7a3c0'), EOSINPALE: rgb('#f2c4d6'), COLLAGEN: rgb('#f5d0dc'),
  };
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
    return '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';
  }
};

// soil: a cut-away block of soil with a wheat plant, its roots and root hairs; fertiliser dissolving into ammonium, part
// of it climbing the roots, the rest turned by the microbes' relay into nitrate that sinks out of the block or into
// nitrous oxide that rises from it; the relay itself in a soil pore, magnified; the BNI halo round the roots that slows
// the relay; the chromosome segment from the wild grass; one marked nitrogen atom's path. All illustrative: the shares
// of the flows are a drawing (only "less than half reaches the plant" is the slides'), and so are the pore, the halo
// and the chromosomes. Manifest: soil.md.
// Frame: the block centred on the origin, its surface at y = 0 (1.2 wide in x, 0.8 deep in z, 0.7 down); the wheat at
// the origin, its ear's top near y = 0.85, its roots down to about y = -0.6. The story faces +z: the side of the block
// nearer the viewer turns to glass as soil_cut goes to 1 (whichever side that is, so it works from any angle in a
// headset), and the soil grains in front of the plant thin out.
SETS.soil = function (K) {
  const { THREE, clamp, prog, smooth, rng } = K;
  const set = K.newSet('soil');
  const LK = TLOOK(K, set), C = SLOOK.rgb;
  const TAU = Math.PI * 2;
  const R0 = rng(31);
  // ------------------------------------------------------------------ shared shader parts
  const LIGHT = 'vec3 l = normalize(vec3(-0.45, 0.55, 0.7));';
  const NOISE = `
float hsh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hsh(i + vec3(0.0, 1.0, 0.0)), hsh(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hsh(i + vec3(0.0, 0.0, 1.0)), hsh(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hsh(i + vec3(0.0, 1.0, 1.0)), hsh(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
// the soil's profile by depth: dark humus on top, loam, a lighter subsoil below; mottled, with specks of sand
vec3 profile(vec3 p) {
  float n = vnoise(p * 38.0) * 0.6 + vnoise(p * 95.0) * 0.4;
  float y = -p.y + 0.03 * (vnoise(p * 7.0) - 0.5);
  vec3 c = mix(vec3(0.12, 0.085, 0.06), vec3(0.23, 0.165, 0.118), smoothstep(0.03, 0.12, y));
  c = mix(c, vec3(0.33, 0.235, 0.16), smoothstep(0.24, 0.38, y));
  c = mix(c, vec3(0.43, 0.32, 0.21), smoothstep(0.5, 0.62, y));
  c *= 0.72 + 0.56 * n;
  c = mix(c, vec3(0.68, 0.56, 0.4), step(0.9, vnoise(p * 170.0)) * 0.65);
  return c;
}`;
  const LITCOL = `
  vec3 n = normalize(vN), v = normalize(vV); if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - abs(dot(n, v)), 2.2), spec = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);`;
  // the magnified pore (all the block's things hide inside its bubble while it shows)
  const PORE = { uPc: { value: new THREE.Vector3(0.18, -0.28, 0.25) }, uRad: { value: 0 }, uPore: { value: 0 }, uDim: { value: 0 } };
  const shader = (o) => {
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, PORE, o.uniforms || {}), vertexShader: o.vertex, fragmentShader: o.fragment,
      transparent: true, side: o.side === undefined ? THREE.DoubleSide : o.side, blending: o.blending || THREE.NormalBlending, depthWrite: o.depthWrite !== false });
    if (o.fixed) m.userData.fixed = true;
    set.mats.push(m);
    return m;
  };
  // a geometry builder: position, normal, aCol, aBase (the point a vertex shrinks to while it grows), aG (x: the growth
  // at which it is fully out, y: how long it takes to grow, z: sway weight, w: which plant: 0 wheat, 1 wild grass)
  function GB() {
    const P = [], N = [], Cc = [], B = [], G = [], I = [];
    const b = {
      P, I,
      v(p, n, c, base, g) { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); Cc.push(c[0], c[1], c[2]); B.push(base[0], base[1], base[2]); G.push(g[0], g[1], g[2], g[3]); return P.length / 3 - 1; },
      tri(a, c, d) { I.push(a, c, d); },
      geo() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('aCol', new THREE.Float32BufferAttribute(Cc, 3));
        g.setAttribute('aBase', new THREE.Float32BufferAttribute(B, 3));
        g.setAttribute('aG', new THREE.Float32BufferAttribute(G, 4));
        g.setIndex(I);
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
        return g;
      },
    };
    return b;
  }
  // a tube along pts with radius R[i], grown at G[i] (span sp), coloured col[i], swaying W[i]; rad sides
  function tube(b, pts, R, G, col, W, which, sp, rad) {
    const n = pts.length, base = b.P.length / 3;
    let nx = 1, ny = 0, nz = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)];
      let tx = c[0] - a[0], ty = c[1] - a[1], tz = c[2] - a[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let d = nx * tx + ny * ty + nz * tz; nx -= d * tx; ny -= d * ty; nz -= d * tz;
      let nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-3) { nx = Math.abs(tx) < 0.9 ? 1 : 0; ny = Math.abs(tx) < 0.9 ? 0 : 1; nz = 0; d = nx * tx + ny * ty; nx -= d * tx; ny -= d * ty; nz -= d * tz; nl = Math.hypot(nx, ny, nz); }
      nx /= nl; ny /= nl; nz /= nl;
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      for (let j = 0; j < rad; j++) {
        const an = j / rad * TAU, cs = Math.cos(an), sn = Math.sin(an), ox = nx * cs + bx * sn, oy = ny * cs + by * sn, oz = nz * cs + bz * sn;
        b.v([p[0] + ox * R[i], p[1] + oy * R[i], p[2] + oz * R[i]], [ox, oy, oz], col[i], p, [G[i], sp, W[i], which]);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < rad; j++) {
      const a = base + i * rad + j, c = base + i * rad + (j + 1) % rad;
      b.tri(a, a + rad, c); b.tri(c, a + rad, c + rad);
    }
  }
  // a small ellipsoid (a spikelet, a grain of the ear): centre c, half-axes along u (long), s (side), and their cross
  function ellipsoid(b, c, u, s, ru, rs, rt, col, base, g, segs = 6, rings = 4) {
    const t = K.v3.norm(K.v3.cross(u, s)), first = b.P.length / 3;
    for (let i = 0; i <= rings; i++) {
      const th = i / rings * Math.PI, ct = Math.cos(th), st = Math.sin(th);
      for (let j = 0; j < segs; j++) {
        const ph = j / segs * TAU, x = st * Math.cos(ph), y = st * Math.sin(ph);
        const p = [c[0] + u[0] * ct * ru + s[0] * x * rs + t[0] * y * rt, c[1] + u[1] * ct * ru + s[1] * x * rs + t[1] * y * rt, c[2] + u[2] * ct * ru + s[2] * x * rs + t[2] * y * rt];
        const nn = K.v3.norm([u[0] * ct / ru + s[0] * x / rs + t[0] * y / rt, u[1] * ct / ru + s[1] * x / rs + t[1] * y / rt, u[2] * ct / ru + s[2] * x / rs + t[2] * y / rt]);
        b.v(p, nn, col, base, g);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
      const a = first + i * segs + j, c2 = first + i * segs + (j + 1) % segs;
      b.tri(a, a + segs, c2); b.tri(c2, a + segs, c2 + segs);
    }
  }
  // a leaf: a strip along a drooping curve from 'at', heading azimuth az, rising at e0, length len, width w; folded
  // along its midrib
  function leaf(b, at, az, e0, len, w, colBase, colTip, g, which, droop = 1.25, segs = 12) {
    const hx = Math.cos(az), hz = Math.sin(az), sx = -hz, sz = hx;
    let p = at.slice();
    const pts = [p.slice()];
    for (let k = 1; k <= segs; k++) {
      const s = k / segs, e = e0 - (e0 + 0.7) * Math.pow(s, droop), d = len / segs;
      p = [p[0] + hx * Math.cos(e) * d, p[1] + Math.sin(e) * d, p[2] + hz * Math.cos(e) * d];
      pts.push(p.slice());
    }
    const first = b.P.length / 3;
    for (let k = 0; k <= segs; k++) {
      const s = k / segs, q = pts[k], a = pts[Math.max(0, k - 1)], c = pts[Math.min(segs, k + 1)];
      const t = K.v3.norm([c[0] - a[0], c[1] - a[1], c[2] - a[2]]), side = [sx, 0, sz], nrm = K.v3.norm(K.v3.cross(side, t));
      const ww = w * Math.pow(Math.max(0, 1 - Math.pow(s, 1.5)), 0.8) * (0.35 + 0.65 * smooth(s * 5)), fold = ww * 0.3;
      const col = K.v3.lerp(colBase, colTip, s), sw = (q[1] / 0.85) * (q[1] / 0.85) + s * 0.35;
      for (const [o, f] of [[-1, 1], [0, 0], [1, 1]]) {
        b.v([q[0] + sx * ww * o - nrm[0] * fold * f, q[1] - nrm[1] * fold * f, q[2] + sz * ww * o - nrm[2] * fold * f], nrm, col, at, [g, 0.08, sw, which]);
      }
    }
    for (let k = 0; k < segs; k++) for (let j = 0; j < 2; j++) {
      const a = first + k * 3 + j;
      b.tri(a, a + 3, a + 1); b.tri(a + 1, a + 3, a + 4);
    }
  }
  // ------------------------------------------------------------------ the roots (illustrative: a fibrous wheat root
  // system, seminal and crown roots with laterals, kept inside the block)
  const ROOTS = [];   // { pts, R, G, parent, at } (main roots first)
  {
    const r = rng(7), NM = 8, inside = p => [clamp(p[0], -0.56, 0.56), Math.max(-0.66, Math.min(-0.012, p[1])), clamp(p[2], -0.36, 0.36)];
    for (let k = 0; k < NM; k++) {
      const az = k / NM * TAU + (r() - 0.5) * 0.5, out = 0.35 + r() * 0.55, len = 0.5 + r() * 0.16, n = 17;
      let d = K.v3.norm([Math.cos(az) * out, -1, Math.sin(az) * out * 0.8]), p = [Math.cos(az) * 0.01, -0.015, Math.sin(az) * 0.01];
      const pts = [p.slice()];
      for (let i = 1; i < n; i++) {
        const w = [(r() - 0.5) * 0.5, -0.25 - 0.1 * i / n, (r() - 0.5) * 0.5];
        d = K.v3.norm(K.v3.add(d, K.v3.mul(w, 0.35)));
        p = inside(K.v3.add(p, K.v3.mul(d, len / (n - 1))));
        pts.push(p);
      }
      const R = pts.map((q, i) => 0.011 * (1 - 0.55 * i / (n - 1))), G = pts.map((q, i) => 0.03 + 0.62 * i / (n - 1));
      ROOTS.push({ pts, R, G, parent: -1, at: 0 });
    }
    for (let k = 0; k < NM; k++) {
      const M = ROOTS[k], nl = 7 + Math.floor(r() * 3);
      for (let j = 0; j < nl; j++) {
        const at = 2 + Math.floor((j + r() * 0.8) / nl * (M.pts.length - 4)), p0 = M.pts[at], len = 0.07 + r() * 0.13 * (1 - at / M.pts.length * 0.5), n = 7;
        const t = K.v3.norm(K.v3.sub(M.pts[at + 1], M.pts[at - 1])), side = K.v3.norm(K.v3.cross(t, K.unit(r)));
        let d = K.v3.norm(K.v3.add(side, [0, -0.35, 0])), p = p0.slice();
        const pts = [p.slice()];
        for (let i = 1; i < n; i++) { d = K.v3.norm(K.v3.add(d, [(r() - 0.5) * 0.3, -0.12, (r() - 0.5) * 0.3])); p = inside(K.v3.add(p, K.v3.mul(d, len / (n - 1)))); pts.push(p); }
        const g0 = M.G[at] + 0.02, R = pts.map((q, i) => 0.0046 * (1 - 0.5 * i / (n - 1))), G = pts.map((q, i) => g0 + 0.22 * i / (n - 1));
        ROOTS.push({ pts, R, G, parent: k, at });
        // a few second-order laterals
        if (r() < 0.55) {
          const a2 = 2 + Math.floor(r() * 3), q0 = pts[a2], d2 = K.v3.norm(K.v3.add(K.unit(r), [0, -0.6, 0])), n2 = 4, l2 = 0.03 + r() * 0.04;
          const p2 = [q0.slice()];
          for (let i = 1; i < n2; i++) p2.push(inside(K.v3.add(p2[i - 1], K.v3.mul(d2, l2 / (n2 - 1)))));
          ROOTS.push({ pts: p2, R: p2.map((q, i) => 0.0026 * (1 - 0.4 * i / (n2 - 1))), G: p2.map((q, i) => Math.min(0.94, G[a2] + 0.03 + 0.12 * i / (n2 - 1))), parent: ROOTS.length - 1, at: a2 });
        }
      }
    }
  }
  // points along the roots, for the halo and the hairs (with the growth at which each is there)
  const RPTS = [];
  for (const Rt of ROOTS) for (let i = 1; i < Rt.pts.length; i++) {
    const a = Rt.pts[i - 1], b = Rt.pts[i], L = K.v3.dist(a, b), m = Math.max(1, Math.round(L / 0.01));
    for (let k = 0; k < m; k++) { const f = (k + 0.5) / m; RPTS.push({ p: K.v3.lerp(a, b, f), t: K.v3.norm(K.v3.sub(b, a)), g: Rt.G[i - 1] + (Rt.G[i] - Rt.G[i - 1]) * f, r: Rt.R[i] }); }
  }
  // ------------------------------------------------------------------ the plant: wheat (and the wild grass beside the block)
  const LEAF0 = SLOOK.chl(56), LEAF1 = SLOOK.chl(63), STEM = SLOOK.chl(58), EAR = SLOOK.mix(SLOOK.chl(54), C(SLOOK.SOIL.ear), 0.35), AWN = SLOOK.mix(EAR, [1, 1, 0.85], 0.25);
  const ROOTC = C(SLOOK.SOIL.root), ROOTT = SLOOK.mix(ROOTC, [1, 1, 1], 0.4), ROOTB = SLOOK.mix(ROOTC, C(SLOOK.SOIL.grain), 0.35);
  const GRASS0 = C('#5f8f8a'), GRASS1 = C('#a9cfc8'), GSPIKE = C('#b9c9a0');
  const EARTOP = [0, 0, 0];
  const plantB = GB();
  // the roots
  for (const Rt of ROOTS) {
    const n = Rt.pts.length, col = Rt.pts.map((q, i) => SLOOK.mix(Rt.parent < 0 ? ROOTB : ROOTC, ROOTT, Math.pow(i / (n - 1), 2)));
    tube(plantB, Rt.pts, Rt.R, Rt.G, col, Rt.pts.map(() => 0), 0, 0.05, Rt.parent < 0 ? 6 : 4);
  }
  // a tiller: its stem, four leaves and its ear
  function tiller(b, foot, lean, lAz, h, earLen, g0, which, cols) {
    const n = 14, pts = [];
    for (let i = 0; i < n; i++) { const s = i / (n - 1); pts.push([foot[0] + Math.cos(lAz) * lean * s * s * h, foot[1] + s * h, foot[2] + Math.sin(lAz) * lean * s * s * h]); }
    const R = pts.map((q, i) => (which ? 0.0045 : 0.0062) * (1 - 0.3 * i / (n - 1))), G = pts.map((q, i) => g0 + 0.5 * i / (n - 1));
    tube(b, pts, R, G, pts.map(() => cols.stem), pts.map(q => (q[1] / 0.85) * (q[1] / 0.85)), which, 0.08, 6);
    const top = pts[n - 1], dir = K.v3.norm(K.v3.sub(top, pts[n - 3]));
    // leaves at the nodes (the flag leaf highest)
    const nl = cols.leaves;
    for (let k = 0; k < nl; k++) {
      const s = 0.05 + k / nl * 0.62, at = pts[Math.round(s * (n - 1))], az = lAz + (k % 2 ? Math.PI : 0) + (k * 0.9) % 1 - 0.5;
      leaf(b, at, az, cols.e0 + 0.15 * k / nl, cols.len * (1 - 0.18 * k / nl), cols.w, cols.leaf0, cols.leaf1, g0 + 0.12 + 0.5 * s, which, cols.droop);
    }
    // the ear: spikelets in two rows along the rachis, each with an awn
    const ns = which ? 22 : 15, g = g0 + 0.62, side = K.v3.norm(K.v3.cross(dir, [Math.cos(lAz + 1.2), 0, Math.sin(lAz + 1.2)]));
    for (let k = 0; k < ns; k++) {
      const s = k / (ns - 1), c = K.v3.add(top, K.v3.mul(dir, s * earLen)), o = k % 2 ? 1 : -1, taper = 1 - 0.35 * Math.pow(Math.abs(s - 0.4) / 0.6, 2);
      const u = K.v3.norm(K.v3.add(dir, K.v3.mul(side, o * 0.55))), cc = K.v3.add(c, K.v3.mul(side, o * (which ? 0.004 : 0.0065) * taper));
      ellipsoid(b, cc, u, side, (which ? 0.009 : 0.012) * taper, (which ? 0.0045 : 0.0065) * taper, (which ? 0.004 : 0.0055) * taper, cols.ear, c, [g, 0.1, (c[1] / 0.85) * (c[1] / 0.85), which], 5, 3);
      if (!which) {
        const a0 = K.v3.add(cc, K.v3.mul(u, 0.011)), a1 = K.v3.add(a0, K.v3.mul(K.v3.norm(K.v3.add(u, K.v3.mul(dir, 1.6))), 0.05 + 0.02 * s));
        tube(b, [a0, a1], [0.0011, 0.0003], [g, g], [cols.awn, cols.awn], [(a0[1] / 0.85) ** 2, (a1[1] / 0.85) ** 2], which, 0.1, 3);
        if (a1[1] > EARTOP[1]) EARTOP.splice(0, 3, ...a1);
      }
    }
    return top;
  }
  const WHEAT = { stem: STEM, leaves: 4, e0: 1.05, len: 0.3, w: 0.016, leaf0: LEAF0, leaf1: LEAF1, droop: 1.25, ear: EAR, awn: AWN };
  const EARS = [tiller(plantB, [0, 0, 0], 0.02, 0.4, 0.64, 0.12, 0.0, 0, WHEAT), tiller(plantB, [0.008, 0, 0.006], 0.16, 0.6, 0.57, 0.105, 0.03, 0, WHEAT),
    tiller(plantB, [-0.008, 0, -0.004], 0.18, 3.6, 0.54, 0.1, 0.05, 0, WHEAT)];
  // the wild grass: a clump of tall glaucous blades and three dense spikes (Leymus racemosus, drawn)
  const GRASS = [-0.86, 0, -0.1];
  {
    const r = rng(12);
    for (let k = 0; k < 18; k++) {
      const a = r() * TAU, foot = [GRASS[0] + Math.cos(a) * 0.02 * r(), 0, GRASS[2] + Math.sin(a) * 0.02 * r()];
      leaf(plantB, foot, a, 1.35 - r() * 0.2, 0.5 + r() * 0.45, 0.011 + r() * 0.006, GRASS0, GRASS1, 0.05 + r() * 0.3, 1, 1.9);
    }
    const GR = { stem: C('#7fa89c'), leaves: 2, e0: 1.2, len: 0.35, w: 0.01, leaf0: GRASS0, leaf1: GRASS1, droop: 1.8, ear: GSPIKE, awn: GSPIKE };
    tiller(plantB, [GRASS[0], 0, GRASS[2]], 0.05, 1.0, 0.86, 0.17, 0.1, 1, GR);
    tiller(plantB, [GRASS[0] + 0.01, 0, GRASS[2] + 0.01], 0.12, 5.5, 0.78, 0.15, 0.15, 1, GR);
    tiller(plantB, [GRASS[0] - 0.01, 0, GRASS[2] - 0.01], 0.15, 2.6, 0.72, 0.14, 0.2, 1, GR);
  }
  const plantMat = shader({
    uniforms: { uGrow: { value: 1 }, uGrass: { value: 0 }, uRootA: { value: 1 } },
    vertex: `attribute vec3 aCol, aBase; attribute vec4 aG;
uniform float uGrow, uGrass, uTime;
varying vec3 vC, vN, vV, vP; varying float vRoot;
void main() {
  float g = aG.w > 0.5 ? uGrass : uGrow;
  float k = clamp((g - aG.x) / aG.y, 0.0, 1.0);
  vec3 p = aBase + (position - aBase) * k;
  float ph = aG.w * 2.3;
  p.x += aG.z * (0.02 * sin(uTime * 1.2 + ph) + 0.006 * sin(uTime * 2.9 + p.y * 9.0 + ph));
  p.z += aG.z * 0.013 * sin(uTime * 0.93 + 1.3 + ph);
  vP = p; vRoot = step(p.y, -0.004) * (1.0 - aG.w);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = aCol;
  gl_Position = projectionMatrix * mv;
}`,
    fragment: `uniform float uA, uDim, uPore, uRad, uRootA; uniform vec3 uPc;
varying vec3 vC, vN, vV, vP; varying float vRoot;
void main() {
  if (uPore > 0.01 && distance(vP, uPc) < uRad * 1.03) discard;
  ${LITCOL}
  vec3 col = vC * (0.34 + 0.55 * dif + 0.2 * hemi) + vC * rim * 0.55 + vec3(spec * 0.16);
  col *= 1.0 - 0.75 * uDim;
  gl_FragColor = vec4(col, uA * mix(1.0, uRootA, vRoot));
}`,
  });
  const plant = new THREE.Mesh(plantB.geo(), plantMat);
  plant.frustumCulled = false;
  set.group.add(plant);
  // root hairs: fine, pale, along the younger parts of the roots
  const hairs = (() => {
    const r = rng(9), list = [];
    for (const q of RPTS) {
      if (q.p[1] > -0.06 || r() > 0.85) continue;
      for (let k = 0; k < 2; k++) {
        const o = K.v3.norm(K.v3.cross(q.t, K.unit(r))), L = 0.008 + r() * 0.014, a = K.v3.add(q.p, K.v3.mul(o, q.r));
        list.push([a, K.v3.add(a, K.v3.add(K.v3.mul(o, L), [0, -L * 0.2, 0])), q.g + 0.04]);
      }
    }
    const g = K.linesGeo(list.length), P = g.attributes.position.array, Cl = g.attributes.aCol.array, A = g.attributes.aA.array, T = g.attributes.aT.array, hc = C(SLOOK.SOIL.rootHair);
    list.forEach(([a, b, t], i) => { P.set(a, 6 * i); P.set(b, 6 * i + 3); Cl.set(hc, 6 * i); Cl.set(hc, 6 * i + 3); A[2 * i] = 0.55; A[2 * i + 1] = 0.12; T[2 * i] = T[2 * i + 1] = t; });
    const m = K.lines(set, { uniforms: PORE, head: 'uniform vec3 uPc; uniform float uRad, uPore, uDim;', vertex: 'if (uPore > 0.01 && distance(position, uPc) < uRad) vA = 0.0; vA *= 1.0 - 0.85 * uDim;' });
    const L = new THREE.LineSegments(g, m); L.frustumCulled = false; L.renderOrder = 1;
    set.group.add(L);
    return { mesh: L, m };
  })();
  // ------------------------------------------------------------------ the block: its faces (the near ones turn to glass)
  const faceMat = shader({
    fixed: true, depthWrite: false,
    uniforms: { uCut: { value: 1 }, uEdge: { value: new THREE.Color(...C(SLOOK.SOIL.water)) } },
    vertex: `varying vec3 vN, vV, vP; void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragment: `uniform float uA, uCut, uDim; uniform vec3 uEdge; varying vec3 vN, vV, vP;
${NOISE}
void main() {
  ${LITCOL}
  float dx = 0.6 - abs(vP.x), dy = min(-vP.y, vP.y + 0.7), dz = 0.4 - abs(vP.z);
  float e = dx + dy + dz - min(dx, min(dy, dz)) - max(dx, max(dy, dz));   // (the distance to the nearest edge)
  float edge = smoothstep(0.006, 0.0, e), cut = gl_FrontFacing ? uCut : 0.0;
  vec3 pc = profile(vP), col = pc * (0.45 + 0.5 * dif + 0.18 * hemi);
  col *= 1.0 - 0.75 * uDim;
  vec3 glass = pc * 0.9 + uEdge * edge * 0.7;
  gl_FragColor = vec4(mix(col, glass, cut), uA * mix(1.0, 0.1 + 0.6 * edge, cut));
}`,
  });
  {
    const fs = [];
    const face = (w, h, rot, pos) => { const g = new THREE.PlaneGeometry(w, h); g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot))); g.translate(...pos); fs.push(g); };
    face(1.2, 0.7, [0, 0, 0], [0, -0.35, 0.4]); face(1.2, 0.7, [0, Math.PI, 0], [0, -0.35, -0.4]);
    face(0.8, 0.7, [0, Math.PI / 2, 0], [0.6, -0.35, 0]); face(0.8, 0.7, [0, -Math.PI / 2, 0], [-0.6, -0.35, 0]);
    face(1.2, 0.8, [Math.PI / 2, 0, 0], [0, -0.7, 0]);
    const g = K.merge(fs.map(x => { x.deleteAttribute('uv'); return x; }));
    const faces = new THREE.Mesh(g, faceMat); faces.renderOrder = 2; faces.frustumCulled = false;
    set.group.add(faces);
  }
  // the surface: crumbly topsoil, a little uneven (from below, the profile's humus)
  const surfMat = shader({
    vertex: `varying vec3 vN, vV, vP; void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragment: `uniform float uA, uDim; varying vec3 vN, vV, vP;
${NOISE}
void main() {
  ${LITCOL}
  float c1 = vnoise(vP * 60.0), c2 = vnoise(vP * 160.0);
  vec3 top = mix(vec3(0.16, 0.11, 0.075), vec3(0.3, 0.215, 0.15), c1 * 0.7 + c2 * 0.3) * (0.8 + 0.4 * step(0.8, c2));
  vec3 col = gl_FrontFacing ? top : profile(vP) * 0.8;
  col = col * (0.45 + 0.55 * dif + 0.2 * hemi) + col * rim * 0.3;
  gl_FragColor = vec4(col * (1.0 - 0.75 * uDim), uA);
}`,
  });
  {
    const g = new THREE.PlaneGeometry(1.2, 0.8, 48, 32);
    g.rotateX(-Math.PI / 2);
    const P = g.attributes.position.array;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], z = P[i + 2], edge = Math.min(0.6 - Math.abs(x), 0.4 - Math.abs(z));
      P[i + 1] = edge < 0.012 ? 0 : 0.004 * Math.sin(x * 41 + 1.3) * Math.sin(z * 37) + 0.003 * Math.sin(x * 97 + z * 71) + 0.008 * Math.exp(-(x * x + z * z) / 0.004);
    }
    g.computeVertexNormals();
    const surf = new THREE.Mesh(g, surfMat); surf.frustumCulled = false;
    set.group.add(surf);
  }
  // ------------------------------------------------------------------ grains, stones, fertiliser and DCD: one instanced pool
  // (instances fixed at build; what moves, the fertiliser's fall and the cut, is the shader's)
  const BL = [];   // [x, y, z, size, kind, seed, r, g, b, delay]   kind 0 soil grain, 1 stone, 2 fertiliser, 3 DCD, 4 the grass's mound
  {
    const r = rng(21);
    for (let i = 0; i < 620; i++) {
      const x = (r() - 0.5) * 1.14, y = -0.02 - r() * 0.66, z = (r() - 0.5) * 0.74, d = Math.hypot(x, z);
      if (d < 0.05 && y > -0.2) continue;
      const tone = r(), col = tone < 0.55 ? SLOOK.mix(C(SLOOK.SOIL.grain), C(SLOOK.SOIL.loamLight), r()) : tone < 0.85 ? SLOOK.mix(C(SLOOK.SOIL.sand), C(SLOOK.SOIL.grain), r() * 0.5) : C('#2e2118');
      BL.push([x, y, z, 0.01 + Math.pow(r(), 2) * 0.026, 0, r(), ...col, 0]);
    }
    for (let i = 0; i < 26; i++) BL.push([(r() - 0.5) * 1.1, 0.004, (r() - 0.5) * 0.74, 0.008 + r() * 0.014, 1, r(), ...SLOOK.mix(C('#6d6258'), C('#9a8c7a'), r()), 0]);
    for (let i = 0; i < 54; i++) BL.push([(r() - 0.5) * 1.0, 0.006, -0.3 + r() * 0.66, 0.0075 + r() * 0.004, 2, r(), ...C(SLOOK.N.grain), r() * 0.32]);
    for (let i = 0; i < 40; i++) BL.push([(r() - 0.5) * 1.05, -0.005 - r() * 0.05, -0.32 + r() * 0.68, 0.005 + r() * 0.004, 3, r(), ...C(SLOOK.DCD), r() * 0.5]);
    BL.push([GRASS[0], -0.012, GRASS[2], 0.07, 4, 0.5, ...C('#2a1d14'), 0]);
  }
  const FERT = BL.filter(b => b[4] === 2);
  const blobs = (() => {
    // a lumpy little stone: a sphere pushed in and out
    const g0 = new THREE.SphereGeometry(1, 9, 6), P = g0.attributes.position.array;
    for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2], f = 1 + 0.16 * Math.sin(x * 3.1 + 1) * Math.sin(y * 2.7 + 2) + 0.1 * Math.sin(z * 4.3 + x * 2.1); P[i] *= f; P[i + 1] *= f * 0.8; P[i + 2] *= f; }
    g0.computeVertexNormals();
    const n = BL.length, g = new THREE.InstancedBufferGeometry();
    g.setIndex(g0.index); g.setAttribute('position', g0.attributes.position); g.setAttribute('normal', g0.attributes.normal);
    const a0 = new Float32Array(n * 4), a1 = new Float32Array(n * 4), a2 = new Float32Array(n * 3), r = rng(3);
    BL.forEach((b, i) => { a0.set([b[0], b[1], b[2], b[3]], 4 * i); a1.set([b[4], b[5], b[9], r() * TAU], 4 * i); a2.set([b[6], b[7], b[8]], 3 * i); });
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(a0, 4)); g.setAttribute('aK', new THREE.InstancedBufferAttribute(a1, 4)); g.setAttribute('aCol', new THREE.InstancedBufferAttribute(a2, 3));
    g.instanceCount = n;
    const m = shader({
      uniforms: { uCut: { value: 1 }, uFert: { value: 0 }, uDcd: { value: 0 }, uGrass: { value: 0 } },
      vertex: `attribute vec4 aP, aK; attribute vec3 aCol;
uniform float uCut, uFert, uDcd, uGrass, uPore, uRad; uniform vec3 uPc;
varying vec3 vC, vN, vV; varying float vF;
void main() {
  float kind = aK.x, s = aP.w; vec3 c = aP.xyz; vF = 0.0;
  if (kind < 0.5) {
    // the cut: the grains in front of the plant thin out (seven in ten go)
    float zc = mix(0.5, 0.0, uCut);
    s *= 1.0 - smoothstep(zc - 0.04, zc + 0.04, c.z) * step(0.3, aK.y);
  } else if (kind < 2.5 && kind > 1.5) {
    // fertiliser: falls, lands, sinks a little and dissolves (each grain from its own moment)
    float f = clamp((uFert - aK.z) / 0.22, 0.0, 1.0), lnd = clamp((uFert - aK.z - 0.22) / 0.2, 0.0, 1.0), dis = clamp((uFert - aK.z - 0.36) / 0.3, 0.0, 1.0);
    c.y = mix(0.42 + 0.2 * aK.y, 0.006, f * f) - 0.012 * lnd;
    s *= smoothstep(0.0, 0.08, uFert - aK.z) * (1.0 - dis);
    vF = 1.0;
  } else if (kind > 2.5 && kind < 3.5) s *= clamp((uDcd - aK.z * 0.5) * 3.0, 0.0, 1.0);
  else if (kind > 3.5) s *= uGrass;
  if (uPore > 0.01 && distance(c, uPc) < uRad * 1.05) s = 0.0;
  float ca = cos(aK.w), sa = sin(aK.w);
  vec3 q = vec3(ca * position.x + sa * position.z, position.y, -sa * position.x + ca * position.z) * s;
  vec3 nq = vec3(ca * normal.x + sa * normal.z, normal.y, -sa * normal.x + ca * normal.z);
  vec4 mv = modelViewMatrix * vec4(c + q, 1.0);
  vN = normalize(normalMatrix * nq); vV = -mv.xyz; vC = aCol;
  gl_Position = projectionMatrix * mv;
  if (s < 0.0005) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `uniform float uA, uDim; varying vec3 vC, vN, vV; varying float vF;
void main() {
  ${LITCOL}
  vec3 col = vC * (0.35 + 0.6 * dif + 0.2 * hemi) + vC * rim * 0.35 + vec3(spec * 0.2) + vC * vF * 0.25;
  gl_FragColor = vec4(col * (1.0 - 0.75 * uDim), uA);
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ the pore, magnified: a bubble with soil grains, water
  // films and the relay's microbes (bubble-local units: the bubble's radius is 1)
  const bubble = new THREE.Group();
  set.group.add(bubble);
  const shellMat = K.rim(set, { color: SLOOK.SOIL.water, a0: 0.025, a1: 0.55 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), shellMat); shell.renderOrder = 4; bubble.add(shell);
  // big grains round the pore (behind and at the sides), clipped by the bubble
  const PGR = [[-0.62, 0.55, -0.35, 0.5], [0.66, 0.48, -0.4, 0.52], [-0.05, 0.05, -0.85, 0.55], [0.6, -0.58, -0.25, 0.48], [-0.66, -0.52, -0.3, 0.5],
    [0.02, 0.95, 0.05, 0.36], [0.05, -0.98, 0.1, 0.38], [-1.0, 0.0, 0.25, 0.32], [1.0, 0.0, 0.2, 0.3]];
  const poreGrains = (() => {
    const r = rng(41), list = [];
    PGR.forEach(([x, y, z, rad], k) => {
      const g = new THREE.SphereGeometry(rad, 22, 16), P = g.attributes.position.array, ph = [r() * 6, r() * 6, r() * 6];
      for (let i = 0; i < P.length; i += 3) {
        const u = P[i] / rad, v = P[i + 1] / rad, w = P[i + 2] / rad;
        const f = 1 + 0.13 * Math.sin(u * 3.3 + ph[0]) * Math.sin(v * 2.9 + ph[1]) + 0.08 * Math.sin(w * 4.1 + u * 2.3 + ph[2]) + 0.04 * Math.sin(v * 9 + w * 7);
        P[i] = x + P[i] * f; P[i + 1] = y + P[i + 1] * f * 0.92; P[i + 2] = z + P[i + 2] * f;
      }
      g.computeVertexNormals();
      const col = [C(SLOOK.SOIL.sand), C(SLOOK.SOIL.grain), C('#4a3526'), C('#8a5a3a'), C('#6b5a48')][k % 5];
      list.push(K.paint(g, col));
    });
    const g = K.merge(list.map(x => { x.deleteAttribute('uv'); return x; }));
    const m = shader({
      uniforms: { uWater: { value: new THREE.Color(...C(SLOOK.SOIL.water)) }, uBA: { value: 0 } },
      vertex: `attribute vec3 color; varying vec3 vC, vN, vV, vL; void main() { vL = position; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragment: `uniform float uA, uBA; uniform vec3 uWater; varying vec3 vC, vN, vV, vL;
${NOISE}
void main() {
  if (length(vL) > 1.0) discard;
  ${LITCOL}
  float gr = vnoise(vL * 14.0) * 0.6 + vnoise(vL * 40.0) * 0.4, sp = step(0.86, vnoise(vL * 90.0));
  vec3 col = vC * (0.45 + 0.75 * gr) * (1.0 - 0.35 * smoothstep(0.55, 0.3, gr)) + vec3(0.55, 0.5, 0.42) * sp * 0.4;
  col = gl_FrontFacing ? col * (0.3 + 0.62 * dif + 0.18 * hemi) + vec3(spec * 0.3) + uWater * pow(rim, 1.5) * 0.9 : col * 0.22;
  gl_FragColor = vec4(col, uA * uBA);
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    bubble.add(mesh);
    return { mesh, m };
  })();
  // the microbes (bubble-local): archaea (round), ammonia-oxidising bacteria (rods), nitrite oxidisers (Nitrospira,
  // curved), comammox (curved, cyan with an amber core); each guild comes in with soil_relay
  const SITE = [[-0.3, 0.3, 0.22], [0.32, 0.27, 0.18], [0.3, -0.3, 0.2], [-0.3, -0.28, 0.22]];   // archaea, bacteria, nitrite oxidisers, comammox
  const MIC = [];   // { g, c }  (guild, centre)
  const microbes = (() => {
    const b = GB(), r = rng(55);
    const gcol = [C(SLOOK.GUILD.aoa), C(SLOOK.GUILD.nsp), C(SLOOK.GUILD.nit), C(SLOOK.GUILD.nit)];
    const add = (g, c, axis, L, rad, bend, p, col) => {
      // a body along a (bent) axis: round ends (a superellipse's profile), 'p' the squareness
      const n = 11, pts = [], R = [], side = K.v3.norm(K.v3.cross(axis, [0, 0, 1]));
      for (let i = 0; i < n; i++) {
        const s = i / (n - 1), x = (s - 0.5) * L, off = bend * (1 - 4 * (s - 0.5) * (s - 0.5)) * L * 0.25;
        pts.push(K.v3.add(c, K.v3.add(K.v3.mul(axis, x), K.v3.mul(side, off))));
        R.push(rad * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), p)), 1 / p) + 1e-4);
      }
      tube(b, pts, R, pts.map(() => g), pts.map(() => col), pts.map(() => r() * TAU), g === 3 ? 1 : 0, 1, 10);
      MIC.push({ g, c });
    };
    for (let k = 0; k < 5; k++) { const c = K.v3.add(SITE[0], [(r() - 0.5) * 0.24, (r() - 0.5) * 0.2, (r() - 0.5) * 0.1]); add(0, c, K.unit(r), 0.11, 0.05, 0, 2.2, gcol[0]); }
    for (let k = 0; k < 4; k++) { const c = K.v3.add(SITE[1], [(r() - 0.5) * 0.26, (r() - 0.5) * 0.2, (r() - 0.5) * 0.1]); add(1, c, K.v3.norm([r() - 0.5, r() - 0.5, (r() - 0.5) * 0.3]), 0.22, 0.045, 0, 4, k === 3 ? C(SLOOK.GUILD.nsm) : gcol[1]); }
    for (let k = 0; k < 4; k++) { const c = K.v3.add(SITE[2], [(r() - 0.5) * 0.26, (r() - 0.5) * 0.2, (r() - 0.5) * 0.1]); add(2, c, K.v3.norm([r() - 0.5, r() - 0.5, (r() - 0.5) * 0.3]), 0.26, 0.04, 0.9, 4, gcol[2]); }
    for (let k = 0; k < 2; k++) { const c = K.v3.add(SITE[3], [(r() - 0.5) * 0.22, (r() - 0.5) * 0.16, (r() - 0.5) * 0.1]); add(3, c, K.v3.norm([r() - 0.5, r() - 0.5, 0.1]), 0.27, 0.048, 1.0, 4, gcol[3]); }
    const m = shader({
      uniforms: { uShow: { value: new THREE.Vector4() }, uLit: { value: new THREE.Vector4(1, 1, 1, 1) }, uAmb: { value: new THREE.Color(...C(SLOOK.N.nh4)) } },
      vertex: `attribute vec3 aCol, aBase; attribute vec4 aG;
uniform vec4 uShow, uLit; uniform float uTime;
varying vec3 vC, vN, vV; varying float vS, vL, vCo;
void main() {
  int g = int(aG.x + 0.5);
  float sh = g == 0 ? uShow.x : g == 1 ? uShow.y : g == 2 ? uShow.z : uShow.w;
  vL = g == 0 ? uLit.x : g == 1 ? uLit.y : g == 2 ? uLit.z : uLit.w;
  float pop = sh * (1.0 + 0.25 * sin(sh * 3.14159));   // (a little overshoot as it comes in)
  float a = 0.18 * sin(uTime * 1.1 + aG.z), ca = cos(a), sa = sin(a);
  vec3 q = position - aBase; q = vec3(ca * q.x - sa * q.y, sa * q.x + ca * q.y, q.z);
  vec3 nq = vec3(ca * normal.x - sa * normal.y, sa * normal.x + ca * normal.y, normal.z);
  vec3 p = aBase + q * pop + vec3(0.0, 0.012 * sin(uTime * 0.8 + aG.z * 3.0), 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * nq); vV = -mv.xyz; vC = aCol; vS = sh; vCo = aG.w;
  gl_Position = projectionMatrix * mv;
  if (pop < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `uniform float uA; uniform vec3 uAmb; varying vec3 vC, vN, vV; varying float vS, vL, vCo;
void main() {
  ${LITCOL}
  float face = abs(dot(n, v));
  vec3 body = mix(vC, uAmb, vCo * smoothstep(0.55, 0.95, face));
  float glow = (1.0 - smoothstep(0.6, 1.0, vS)) * step(0.02, vS) * 0.8;
  vec3 col = body * (0.35 + 0.6 * dif + 0.25 * hemi) + body * rim * (0.9 + glow) + vec3(spec * 0.35);
  col *= 0.35 + 0.65 * vL;
  gl_FragColor = vec4(col, uA * mix(0.5, 1.0, vL));
}`,
    });
    const mesh = new THREE.Mesh(b.geo(), m); mesh.frustumCulled = false;
    bubble.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ the chromosomes: the wild grass's (blue) and the
  // wheat's (orange), each two sister chromatids with bands; a segment of the blue one moves into the orange one
  const CHG = [-0.55, 0.7, 0.2], CHW = [0.38, 0.7, 0.2], CH_LEN = 0.44, SEG = [0.6, 0.8];   // (where along it the segment lies)
  const BLUE = C('#4f86e8'), ORANGE = C(SLOOK.LINE[1]);
  const chromMat = shader({
    uniforms: { uGap: { value: new THREE.Vector2(1, 0) }, uSegLit: { value: 0 }, uWheatGlow: { value: 0 }, uIn: { value: 0 } },
    vertex: `attribute vec3 aCol, aBase; attribute vec4 aG;
uniform float uIn; uniform vec2 uGap;
varying vec3 vC, vN, vV; varying float vU, vW, vSeg, vGone;
void main() {
  vec3 cc = aG.w < 0.5 ? vec3(${CHG.join(', ')}) : vec3(${CHW.join(', ')});
  // where the segment left (the grass's) or is replaced (the wheat's), the chromatids thin to a thread
  float inSeg = step(${SEG[0].toFixed(2)}, aG.x) * step(aG.x, ${SEG[1].toFixed(2)});
  vGone = inSeg * (aG.w < 0.5 ? uGap.x : uGap.y);
  vec3 q = aBase + (position - aBase) * (1.0 - 0.8 * vGone);
  vec4 mv = modelViewMatrix * vec4(cc + (q - cc) * uIn, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = aCol; vU = aG.x; vW = aG.w; vSeg = aG.z;
  gl_Position = projectionMatrix * mv;
}`,
    fragment: `uniform float uA; uniform vec2 uGap; uniform float uSegLit, uWheatGlow; varying vec3 vC, vN, vV; varying float vU, vW, vSeg, vGone;
void main() {
  ${LITCOL}
  // bands (Giemsa-like, drawn): dark and light stripes along the chromatid
  float band = smoothstep(0.35, 0.6, abs(sin(vU * 37.0 + sin(vU * 11.0) * 2.0)));
  vec3 base = vC * mix(0.55, 1.1, band);
  float inSeg = step(${SEG[0].toFixed(2)}, vU) * step(vU, ${SEG[1].toFixed(2)});
  // the grass's segment glows while it is marked; the place it leaves fades; the wheat's piece it replaces fades
  float gone = vGone;
  base += inSeg * (1.0 - vW) * vec3(0.5, 0.7, 1.0) * uSegLit * 0.5;
  vec3 col = base * (0.35 + 0.6 * dif + 0.2 * hemi) + base * rim * (0.6 + uWheatGlow * vW * 1.4) + vec3(spec * 0.3);
  col += vW * uWheatGlow * vec3(1.0, 0.65, 0.3) * rim * 0.6;
  gl_FragColor = vec4(col * (1.0 - 0.5 * gone), uA);
}`,
  });
  function chromatids(b, c, col, which, from, to) {
    // two sister chromatids side by side, joined at the centromere (u 0.42), each a rounded tube
    for (const sx of [-1, 1]) {
      const n = 26, pts = [], R = [], U = [];
      for (let i = 0; i < n; i++) {
        const u = from + (to - from) * i / (n - 1), y = (u - 0.5) * CH_LEN, cen = Math.exp(-Math.pow((u - 0.42) / 0.06, 2));
        const x = sx * (0.025 - 0.016 * cen + 0.008 * Math.pow(Math.abs(u - 0.42) * 2, 2));
        pts.push([c[0] + x, c[1] + y, c[2]]);
        const edge = Math.min(1, Math.min(u - from, to - u) / ((to - from) * (from > 0 || to < 1 ? 0.25 : 0.06)));
        R.push(0.022 * (1 - 0.35 * cen) * Math.sqrt(Math.max(0, 1 - (1 - edge) * (1 - edge))) + 1e-4);
        U.push(u);
      }
      tube(b, pts, R, U, pts.map(() => col), U.map(u => +(u >= SEG[0] && u <= SEG[1])), which, 1, 12);
    }
  }
  const chromB = GB();
  chromatids(chromB, CHG, BLUE, 0, 0, 1); chromatids(chromB, CHW, ORANGE, 1, 0, 1);
  const chroms = new THREE.Mesh(chromB.geo(), chromMat); chroms.frustumCulled = false; set.group.add(chroms);
  // the moving segment (its own copy of the blue chromatids' piece, centred on its middle)
  const segB = GB(), SEGMID = (SEG[0] + SEG[1]) / 2, SEG_Y = (SEGMID - 0.5) * CH_LEN;
  chromatids(segB, [0, -SEG_Y, 0], SLOOK.mix(BLUE, [0.75, 0.85, 1], 0.25), 0, SEG[0] - 0.005, SEG[1] + 0.005);
  const segMat = shader({
    uniforms: { uLit: { value: 0 } },
    vertex: `attribute vec3 aCol; varying vec3 vC, vN, vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = aCol; gl_Position = projectionMatrix * mv; }`,
    fragment: `uniform float uA, uLit; varying vec3 vC, vN, vV;
void main() { ${LITCOL}
  vec3 col = vC * (0.4 + 0.6 * dif + 0.2 * hemi) + vC * rim * (0.8 + uLit) + vec3(spec * 0.3) + vec3(0.25, 0.4, 0.7) * uLit * 0.35;
  gl_FragColor = vec4(col, uA); }`,
  });
  const segment = new THREE.Mesh(segB.geo(), segMat); segment.frustumCulled = false; set.group.add(segment);
  const SEG_A = [CHG[0], CHG[1] + SEG_Y, CHG[2]], SEG_B = [CHW[0], CHW[1] + SEG_Y, CHW[2]];
  const segPos = [0, 0, 0];
  // ------------------------------------------------------------------ the tracer's microbe (one small rod in the soil)
  const TRM = [-0.08, -0.2, 0.27];
  const tracerBug = (() => {
    const b = GB(), n = 9, pts = [], R = [];
    for (let i = 0; i < n; i++) { const s = i / (n - 1); pts.push([TRM[0] + (s - 0.5) * 0.075, TRM[1] + (s - 0.5) * 0.02, TRM[2]]); R.push(0.014 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), 4)), 0.25) + 1e-4); }
    tube(b, pts, R, pts.map(() => 0), pts.map(() => C(SLOOK.GUILD.nsp)), pts.map(() => 0), 0, 1, 10);
    const m = shader({
      uniforms: { uS: { value: 0 }, uF: { value: 0 } },
      vertex: `attribute vec3 aCol, aBase; uniform float uS; varying vec3 vC, vN, vV;
void main() { vec3 p = ${'vec3(' + TRM.join(', ') + ')'} + (position - ${'vec3(' + TRM.join(', ') + ')'}) * uS; vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = aCol; gl_Position = projectionMatrix * mv; if (uS < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`,
      fragment: `uniform float uA, uF; varying vec3 vC, vN, vV;
void main() { ${LITCOL} vec3 col = vC * (0.4 + 0.6 * dif) + vC * rim * (0.9 + uF * 2.0) + vec3(uF * 0.5); gl_FragColor = vec4(col, uA); }`,
    });
    const mesh = new THREE.Mesh(b.geo(), m); mesh.frustumCulled = false; set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ glows: ammonium, the flows, the relay's particles,
  // the halo, N2O, the tracer (one pool of soft additive points, refilled each frame)
  const H = LK.halos(2200);
  H.mesh.renderOrder = 3; H.mesh.material.depthTest = false;   // (glows read through the grains: the block is a cut-away)
  set.group.add(H.mesh);
  const NSPC = C(SLOOK.GUILD.nsp), NH4 = C(SLOOK.N.nh4), NO2 = C(SLOOK.N.no2), NO3 = C(SLOOK.N.no3Glow), N2O = C(SLOOK.N.n2o), UP = C(SLOOK.N.plant), WHITE = [1, 1, 1], HALO = C(SLOOK.HALO);
  // the ammonium in the topsoil: two glows round each fertiliser grain's landing spot
  const AMM = [];
  { const r = rng(17); for (const f of FERT) for (let k = 0; k < 2; k++) AMM.push([f[0] + (r() - 0.5) * 0.08, -0.015 - r() * 0.08, f[2] + (r() - 0.5) * 0.07, f[9], 0.05 + r() * 0.05, r() * TAU]); }
  // the flows: each particle's cycle, start, its route's points (main roots for the plant's share)
  const MAINS = ROOTS.filter(R => R.parent < 0);
  const NF = 330, FL = [];
  {
    const r = rng(23);
    for (let i = 0; i < NF; i++) {
      const x = (r() - 0.5) * 1.0, z = -0.3 + r() * 0.66, y = -0.02 - r() * 0.1;
      const root = Math.floor(r() * MAINS.length), M = MAINS[root];
      let j = 1; const yc = -0.12 - r() * 0.3; while (j < M.pts.length - 1 && M.pts[j][1] > yc) j++;
      FL.push({ s: [x, y, z], per: 7 + r() * 3, ph: r(), root, j, ex: [x + (r() - 0.5) * 0.12, z + (r() - 0.5) * 0.08], w: [x + (r() - 0.5) * 0.1, z + (r() - 0.5) * 0.08], sd: r() * 100, leaf: 0.2 + r() * 0.3, lx: (r() - 0.5) * 0.3, lz: (r() - 0.5) * 0.2, gate: (i + 0.5) / NF });
    }
  }
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  // where flow particle i is at phase a of its cycle (route by u): its place into p, its colour, size and alpha into o
  const FLOW = { plant: 0.45, n2o: 0.12, amber: 0.25 }, FO = { col: null, size: 0, al: 0 }, _q2 = [0, 0, 0], _mc = [0, 0, 0];
  const mixC = (a, b, f) => SLOOK.mix(a, b, clamp(f, 0, 1), _mc);
  function flowAt(i, F, a, u, t, inh, p, o) {
    let col = NH4, size = 0.03, al = 0.78, x = F.s[0], y = F.s[1], z = F.s[2];
    const jx = 0.014 * Math.sin(t * 0.9 + F.sd), jz = 0.012 * Math.cos(t * 0.7 + F.sd * 1.3), ae = FLOW.amber;
    if (u < FLOW.plant) {
      // to a root, up the root (now the plant's), up the stem into the leaves
      const M = MAINS[F.root], rp = M.pts[F.j], e0 = 0.35 + 0.1 * inh;
      if (a < e0) { const f = smooth(a / e0); x = F.s[0] + (rp[0] - F.s[0]) * f + jx * (1 - f); y = F.s[1] + (rp[1] - F.s[1]) * f; z = F.s[2] + (rp[2] - F.s[2]) * f + jz * (1 - f) + 0.012 * f; }
      else if (a < 0.8) { rootClimb(M, F.j, (a - e0) / (0.8 - e0), _q2); x = _q2[0]; y = _q2[1]; z = _q2[2] + 0.012; col = UP; size = 0.026; al *= 1 - 0.85 * smooth((y + 0.15) / 0.15); }
      else { const f = (a - 0.8) / 0.2; x = 0.004 * Math.sin(F.sd) + f * F.lx; y = f * F.leaf; z = 0.012 + f * F.lz; col = UP; size = 0.022; al *= 0.22 * (1 - f * f); }
      if (a > e0 - 0.05 && a < e0 + 0.05) col = mixC(NH4, UP, (a - e0 + 0.05) / 0.1);
    } else if (u < FLOW.plant + FLOW.n2o) {
      // the relay, then up and out of the surface as N2O
      if (a < ae) { x += jx; z += jz; y -= 0.01 * a; }
      else if (a < ae + 0.15) { const f = (a - ae) / 0.15; col = mixC(NH4, NO2, f); x += jx; z += jz; y -= 0.01 * ae + 0.02 * f; }
      else { const f = (a - ae - 0.15) / (0.85 - ae); col = mixC(NO2, N2O, f * 4); y = F.s[1] - 0.02 + f * (0.52 - F.s[1]); x = F.s[0] + (F.w[0] - F.s[0]) * f + 0.04 * Math.sin(t * 1.3 + F.sd + f * 4) * f; z = F.s[2] + (F.w[1] - F.s[2]) * f; size = 0.03 + 0.08 * f * f; al = 0.7 * (1 - f * f); }
    } else {
      // the relay, then down and out of the block's bottom as nitrate
      if (a < ae) { x += jx; z += jz; y -= 0.015 * a; }
      else if (a < ae + 0.12) { const f = (a - ae) / 0.12; col = mixC(NH4, NO2, f); x += jx; z += jz; y -= 0.015 * ae + 0.03 * f; }
      else if (a < ae + 0.22) { const f = (a - ae - 0.12) / 0.1; col = mixC(NO2, NO3, f); x += jx; z += jz; y -= 0.015 * ae + 0.03 + 0.03 * f; }
      else { const f = (a - ae - 0.22) / (0.78 - ae); col = NO3; y = F.s[1] - 0.015 * ae - 0.06 - f * (0.84 + F.s[1]); x = F.s[0] + (F.ex[0] - F.s[0]) * f + 0.015 * Math.sin(f * 9 + F.sd); z = F.s[2] + (F.ex[1] - F.s[2]) * f; al *= 1 - smooth((y + 0.68) / -0.18); }
    }
    al *= clamp(a / 0.05, 0, 1) * clamp((1 - a) / 0.06, 0, 1);
    if (al <= 0.004) return false;
    p[0] = x; p[1] = y; p[2] = z; o.col = col; o.size = size; o.al = al;
    return true;
  }
  // the BNI halo: soft teal glows along the roots, seeping outwards
  const HAL = [];
  { const r = rng(29); for (let i = 0; i < RPTS.length; i += 4) { const q = RPTS[i]; if (q.p[1] > -0.03) continue; HAL.push([...q.p, ...K.unit(r), q.g, 0.04 + r() * 0.04, r() * TAU]); } }
  // the tracer's path: a fertiliser grain, the soil, a microbe (it waits there), a root, up into a leaf
  const TR = (() => {
    const M = MAINS[0], pts = [];
    pts.push([-0.22, 0.012, 0.24], [-0.2, -0.05, 0.25], [-0.15, -0.13, 0.27], TRM.slice());
    const k0 = M.pts.findIndex(q => q[1] < -0.22), k = k0 > 0 ? k0 : 4, rp = M.pts[k];
    pts.push(K.v3.lerp(TRM, rp, 0.5), rp);
    for (let i = k - 1; i >= 0; i--) pts.push(M.pts[i]);
    pts.push([0, 0.1, 0], [0, 0.25, 0], [0.04, 0.33, 0.02], [0.12, 0.38, 0.06], [0.2, 0.4, 0.1]);
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + K.v3.dist(pts[i - 1], pts[i]));
    return { pts, L, wait: 3 };   // (the microbe is point 3)
  })();
  const trOut = [0, 0, 0];
  // the relay's particles: where each enters the pore and leaves it (bubble-local)
  const RL = [];
  for (let i = 0; i < 40; i++) RL.push({ E: [(hash(i, 1) - 0.5) * 0.4, 0.95, 0.35], X: [(hash(i, 2) - 0.5) * 0.4, -0.95, 0.35] });
  const _l = [0, 0, 0], lerp3 = (a, b, f, out) => { out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = a[2] + (b[2] - a[2]) * f; return out; };
  const orbit = (s, ph, t, out) => { out[0] = s[0] + 0.1 * Math.cos(t * 2.1 + ph); out[1] = s[1] + 0.08 * Math.sin(t * 2.1 + ph); out[2] = s[2] + 0.1; return out; };
  // where along the path the atom is at tracer progress s (it waits in the microbe from 0.32 to 0.5)
  function tracerAt(s, out) {
    const lw = TR.L[TR.wait], tot = TR.L[TR.L.length - 1];
    let d = s < 0.32 ? s / 0.32 * lw : s < 0.5 ? lw : lw + (s - 0.5) / 0.5 * (tot - lw);
    d = clamp(d, 0, tot);
    let i = 1; while (i < TR.L.length - 1 && TR.L[i] < d) i++;
    const f = (d - TR.L[i - 1]) / Math.max(1e-6, TR.L[i] - TR.L[i - 1]), a = TR.pts[i - 1], b = TR.pts[i];
    out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = a[2] + (b[2] - a[2]) * f;
    return out;
  }
  // ------------------------------------------------------------------ state for labels and anchors
  const now = { pore: 0, R: 0, relay: 0, tracer: 0, chrom: 0 };
  const _p = [0, 0, 0], _q = [0, 0, 0], _c = [0, 0, 0];
  const bubbleP = (l, out) => { const R = now.R, c = PORE.uPc.value; out[0] = c.x + l[0] * R; out[1] = c.y + l[1] * R; out[2] = c.z + l[2] * R; return out; };
  // a point along a main root, from index j (fraction f of the way back up to its crown)
  function rootClimb(M, j, f, out) {
    const s = (1 - f) * j, i = Math.floor(s), u = s - i, a = M.pts[i], b = M.pts[Math.min(i + 1, M.pts.length - 1)];
    out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = a[2] + (b[2] - a[2]) * u;
    return out;
  }
  // ------------------------------------------------------------------ update: everything from the params and t
  function update(S, t) {
    LK.depth();
    const grow = clamp(S.soil_grow, 0, 1), cut = clamp(S.soil_cut, 0, 1), fert = clamp(S.soil_fert, 0, 1), flow = clamp(S.soil_flow, 0, 1);
    const inh = clamp(S.soil_inhibit, 0, 1), halo = clamp(S.soil_halo, 0, 1), dcd = clamp(S.soil_dcd, 0, 1), pore = clamp(S.soil_pore, 0, 1);
    const relay = clamp(S.soil_relay, 0, 4), grass = clamp(S.soil_grass, 0, 1), chrom = clamp(S.soil_chrom, 0, 1), tracer = clamp(S.soil_tracer, 0, 1);
    const pick = Math.round(S.soil_pick === undefined ? -1 : S.soil_pick);
    // the pore's bubble
    const pg = smooth(pore), R = 0.3 * pg;
    now.pore = pore; now.R = R; now.relay = relay; now.tracer = tracer; now.chrom = chrom;
    PORE.uRad.value = R; PORE.uPore.value = pore; PORE.uDim.value = smooth(clamp(pore * 1.3, 0, 1));
    bubble.visible = pore > 0.004;
    bubble.position.copy(PORE.uPc.value); bubble.scale.setScalar(Math.max(1e-4, R));
    shellMat.uniforms.uK.value = pg;
    poreGrains.m.uniforms.uBA.value = prog(pore, 0.2, 0.7);
    const sh = microbes.m.uniforms.uShow.value, lit = microbes.m.uniforms.uLit.value, pv = prog(pore, 0.4, 0.9);
    sh.set(clamp(relay, 0, 1) * pv, clamp(relay - 1, 0, 1) * pv, clamp(relay - 2, 0, 1) * pv, clamp(relay - 3, 0, 1) * pv);
    lit.set(pick < 0 || pick === 0 ? 1 : 0.25, pick < 0 || pick === 1 ? 1 : 0.25, pick < 0 || pick === 2 ? 1 : 0.25, pick < 0 || pick === 3 ? 1 : 0.25);
    // the plant, the grass, the roots, the block
    plantMat.uniforms.uGrow.value = grow; plantMat.uniforms.uGrass.value = grass;
    hairs.m.uniforms.uReveal.value = grow;
    faceMat.uniforms.uCut.value = cut;
    faceMat.depthWrite = cut < 0.02 && set.uA.value > 0.97;
    blobs.m.uniforms.uCut.value = cut; blobs.m.uniforms.uFert.value = fert; blobs.m.uniforms.uDcd.value = dcd; blobs.m.uniforms.uGrass.value = grass;
    // the chromosomes: in with soil_chrom; the segment lifts out (to 0.5) and glides into the wheat's (to 1)
    const cin = prog(chrom, 0, 0.12), lift = prog(chrom, 0.12, 0.5), glide = prog(chrom, 0.5, 0.92);
    chroms.visible = segment.visible = chrom > 0.004;
    chromMat.uniforms.uGap.value.set(lift > 0.02 ? 1 : 0, prog(chrom, 0.8, 0.95));
    chromMat.uniforms.uSegLit.value = prog(chrom, 0.04, 0.14) * (1 - glide);
    chromMat.uniforms.uWheatGlow.value = prog(chrom, 0.9, 1) * (0.75 + 0.25 * Math.sin(t * 3));
    {
      const h = 0.16 * lift * (1 - glide) + 0.22 * Math.sin(glide * Math.PI);
      segPos[0] = SEG_A[0] + (SEG_B[0] - SEG_A[0]) * glide; segPos[1] = SEG_A[1] + h; segPos[2] = SEG_A[2] + (SEG_B[2] - SEG_A[2]) * glide + 0.08 * Math.sin(glide * Math.PI);
      segment.position.set(segPos[0], segPos[1], segPos[2]);
      segment.rotation.set(0, glide * TAU, 0.25 * Math.sin(glide * Math.PI));
      segment.scale.setScalar(cin * (1 + 0.15 * Math.sin(glide * Math.PI)));
      segMat.uniforms.uLit.value = lift * (1 - prog(chrom, 0.92, 1));
    }
    chromMat.uniforms.uIn.value = cin;
    chroms.visible = cin > 0.004;
    // the glows
    H.begin();
    const dimB = 1 - 0.85 * PORE.uDim.value;
    // ammonium round the dissolving grains
    for (const a of AMM) {
      const d = clamp((fert - a[3] - 0.36) / 0.3, 0, 1);
      if (d <= 0) continue;
      _p[0] = a[0]; _p[1] = a[1]; _p[2] = a[2];
      if (pore > 0.01 && PORE.uPc.value.distanceTo(_v.set(_p[0], _p[1], _p[2])) < R) continue;
      H.add(_p, a[4] * (0.6 + 0.4 * d) * (1 + 0.08 * Math.sin(t * 1.7 + a[5])), NH4, 0.2 * d * dimB * (1 - 0.35 * flow * (1 - inh)));
    }
    // the flows (each particle with a short trail behind it)
    if (flow > 0.003) {
      const ps = clamp(S.soil_plant, 0, 1);
      FLOW.plant = ps + (1 - ps) * 0.55 * inh; FLOW.n2o = 0.12 * (1 - 0.75 * inh); FLOW.amber = 0.25 + 0.3 * inh;   // (the relay's first step slows: the nitrogen stays ammonium longer)
      const pc = PORE.uPc.value;
      for (let i = 0; i < NF; i++) {
        const F = FL[i], gate = clamp((flow - F.gate) * 12 + 1, 0, 1);
        if (gate <= 0) continue;
        for (let k = 0; k < 3; k++) {
          const c = (t - k * 0.09) / F.per + F.ph, cyc = Math.floor(c), a = c - cyc;
          if (!flowAt(i, F, a, hash(i, cyc), t - k * 0.09, inh, _p, FO)) continue;
          if (pore > 0.01 && (_p[0] - pc.x) ** 2 + (_p[1] - pc.y) ** 2 + (_p[2] - pc.z) ** 2 < R * R) continue;
          H.add(_p, FO.size * (1 - 0.22 * k), FO.col, FO.al * gate * dimB * (k ? 0.3 / k : 1));
        }
      }
    }
    // the halo: teal round the roots, seeping into the soil
    if (halo > 0.003) {
      const pc = PORE.uPc.value;
      for (const h of HAL) {
        if (h[6] > grow + 0.05) continue;
        const o = 0.012 + 0.035 * halo;
        _p[0] = h[0] + h[3] * o; _p[1] = h[1] + h[4] * o; _p[2] = h[2] + h[5] * o;
        if (pore > 0.01 && (_p[0] - pc.x) ** 2 + (_p[1] - pc.y) ** 2 + (_p[2] - pc.z) ** 2 < R * R) continue;
        H.add(_p, h[7] * (0.6 + 0.6 * halo), HALO, 0.085 * halo * (0.75 + 0.25 * Math.sin(t * 1.3 + h[8])) * dimB);
      }
    }
    // the relay in the pore: particles handed on, changing colour (bubble-local paths)
    if (pore > 0.05 && relay > 0.02) {
      const pv2 = prog(pore, 0.5, 1);
      for (let i = 0; i < 40; i++) {
        const per = 8 + hash(i, 7) * 3, c = t / per + hash(i, 3), cyc = Math.floor(c), a = c - cyc, u = hash(i, cyc + 11);
        // the route: archaea or bacteria, then the nitrite oxidisers; or comammox straight to nitrate
        const useB = relay > 1.5 && u < 0.45, comm = relay > 3.5 && u > 0.78, toNob = relay > 2.5, bounce = hash(i, cyc + 5) < inh * 0.7;
        const s1 = comm ? SITE[3] : useB ? SITE[1] : SITE[0], E = RL[i].E, X = RL[i].X;
        let col = NH4, l = _l;
        if (a < 0.22) lerp3(E, orbit(s1, i, t, _c), smooth(a / 0.22), _l);
        else if (a < 0.38) { l = orbit(s1, i, t, _c); if (!bounce) col = mixC(NH4, comm ? NO3 : NO2, smooth((a - 0.22) / 0.16)); }
        else if (bounce) { col = NH4; lerp3(orbit(s1, i, t, _q), E, smooth((a - 0.38) / 0.4), _l); }
        else if (comm || !toNob) { col = comm ? NO3 : NO2; lerp3(orbit(s1, i, t, _q), X, smooth((a - 0.38) / 0.5), _l); }
        else if (a < 0.6) { col = NO2; lerp3(orbit(s1, i, t, _q), orbit(SITE[2], i * 2, t, _c), smooth((a - 0.38) / 0.22), _l); }
        else if (a < 0.74) { l = orbit(SITE[2], i * 2, t, _c); col = mixC(NO2, NO3, smooth((a - 0.6) / 0.14)); }
        else { col = NO3; lerp3(orbit(SITE[2], i * 2, t, _q), X, smooth((a - 0.74) / 0.26), _l); }
        const al = 0.95 * pv2 * clamp(a / 0.06, 0, 1) * clamp((1 - a) / 0.08, 0, 1) * clamp(relay * 2, 0, 1);
        bubbleP(l, _p);
        H.add(_p, 0.09 * R, col, al);
      }
    }
    // the marked atom and its trail
    const trBug = prog(tracer, 0.05, 0.2) * (1 - prog(tracer, 0.93, 1));
    tracerBug.m.uniforms.uS.value = trBug;
    tracerBug.m.uniforms.uF.value = tracer > 0.32 && tracer < 0.5 ? 0.6 + 0.4 * Math.sin(t * 14) : 0;
    tracerBug.mesh.visible = trBug > 0.004;
    if (tracer > 0.003 && tracer < 0.999) {
      tracerAt(tracer, trOut);
      for (let k = 22; k >= 1; k--) { tracerAt(Math.max(0, tracer - k * 0.006), _p); H.add(_p, 0.012 + 0.01 * (1 - k / 22), WHITE, 0.4 * (1 - k / 22) * prog(tracer, 0, 0.04)); }
      const fl = tracer > 0.32 && tracer < 0.5 ? 0.7 + 0.3 * Math.sin(t * 14) : 1;
      if (trBug > 0.01) H.add(TRM, 0.09, NSPC, 0.35 * trBug * (tracer > 0.32 && tracer < 0.5 ? 1.6 : 1));
      H.add(trOut, 0.085, WHITE, 0.95 * fl * prog(tracer, 0, 0.03) * (1 - prog(tracer, 0.96, 0.999)));
    } else { trOut[0] = TR.pts[0][0]; trOut[1] = TR.pts[0][1]; trOut[2] = TR.pts[0][2]; }
    H.end();
    // the roots dim a little while the flows show (so the particles read)
    plantMat.uniforms.uRootA.value = 1;
  }
  // ------------------------------------------------------------------ picking: a microbe in the pore
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  function pick(rc) {
    if (now.pore < 0.5 || now.relay < 0.5) return null;
    set.group.updateMatrixWorld();
    const Mw = set.group.matrixWorld, s0 = Mw.getMaxScaleOnAxis(), ray = rc.ray;
    let best = Infinity, hit = -1;
    for (const m of MIC) {
      if (now.relay < m.g + 0.5) continue;
      bubbleP(m.c, _p);
      _v.set(_p[0], _p[1], _p[2]).applyMatrix4(Mw);
      const d = _w.copy(_v).sub(ray.origin).dot(ray.direction), rr = 0.12 * now.R * s0;
      if (d > 0 && d < best && ray.distanceSqToPoint(_v) < rr * rr) { best = d; hit = m.g; }
    }
    return hit >= 0 ? { kind: 'guild', g: hit } : null;
  }
  // a guild's microbes' middle (set coordinates, where it is now)
  const LOFF = [[0, 0.12], [0, 0.12], [0, -0.16], [-0.05, -0.3]];   // (where each guild's label points, off its cluster, so the four never overlap)
  const guildAt = g => { const c = SITE[g], out = [0, 0, 0]; return now.R > 0.01 ? bubbleP([c[0] + LOFF[g][0], c[1] + LOFF[g][1], c[2] + 0.1], out) : [PORE.uPc.value.x, PORE.uPc.value.y, PORE.uPc.value.z]; };
  const anchors = {
    surface: [0, 0, 0], ear: () => EARTOP.slice(), stem: [0, 0.4, 0], roots: [0.06, -0.2, 0.14], fert: [-0.25, 0.02, 0.15],
    nh4: [-0.22, -0.06, 0.24], no3: [0.28, -0.7, 0.22], n2o: [-0.28, 0.32, 0.12], halo: [0.12, -0.32, 0.16],
    pore: [0.18, -0.28, 0.25], aoa: () => guildAt(0), aob: () => guildAt(1), nob: () => guildAt(2), comammox: () => guildAt(3),
    grass: [GRASS[0], 0.55, GRASS[2]], chromGrass: [CHG[0], CHG[1] + CH_LEN * 0.55, CHG[2]], chromWheat: [CHW[0], CHW[1] - CH_LEN * 0.5, CHW[2]],
    segment: () => [segPos[0], segPos[1] + 0.05, segPos[2]], tracer: () => trOut.slice(), corner: [-0.6, -0.7, 0.4], uptake: [0.03, 0.18, 0.02],
  };
  const blockOn = S => 1 - prog(S.soil_pore, 0.15, 0.45);
  const labels = [
    { text: ['Ammonium', ' · from the fertiliser'], at: 'nh4', cls: 'amb', alpha: S => prog(S.soil_fert, 0.6, 0.85) * blockOn(S) * (1 - prog(S.soil_tracer, 0, 0.05)) * (1 - prog(S.soil_halo, 0, 0.3)) },
    { text: ['Nitrate', ' · washes away'], at: 'no3', cls: 'cyn', alpha: S => prog(S.soil_flow, 0.35, 0.6) * blockOn(S) * (1 - prog(S.soil_tracer, 0, 0.05)) },
    { text: ['N2O', ' · a greenhouse gas'], at: 'n2o', cls: 'mag', alpha: S => prog(S.soil_flow, 0.45, 0.7) * blockOn(S) * (1 - prog(S.soil_tracer, 0, 0.05)) * (1 - prog(S.soil_grass, 0, 0.3)) },
    { text: ['Taken up', ' by the plant'], at: 'uptake', cls: 'grn', alpha: S => prog(S.soil_flow, 0.55, 0.8) * blockOn(S) * (1 - prog(S.soil_tracer, 0, 0.05)) * (1 - prog(S.soil_chrom, 0, 0.1)) },
    { text: ['Archaea', ''], at: 'aoa', cls: 'mag', alpha: S => prog(S.soil_pore, 0.7, 0.9) * prog(S.soil_relay, 0.6, 1) * pickOk(S, 0) },
    { text: ['Bacteria', ''], at: 'aob', cls: 'amb', alpha: S => prog(S.soil_pore, 0.7, 0.9) * prog(S.soil_relay, 1.6, 2) * pickOk(S, 1) },
    { text: ['Nitrite oxidisers', ''], at: 'nob', cls: 'cyn', alpha: S => prog(S.soil_pore, 0.7, 0.9) * prog(S.soil_relay, 2.6, 3) * pickOk(S, 2) },
    { text: ['Comammox', ' · both steps'], at: 'comammox', cls: 'cyn', alpha: S => prog(S.soil_pore, 0.7, 0.9) * prog(S.soil_relay, 3.6, 4) * pickOk(S, 3) },
    { text: ['BNI', ' · from the roots'], at: 'halo', cls: 'cyn', alpha: S => prog(S.soil_halo, 0.4, 0.8) * blockOn(S) * (1 - prog(S.soil_tracer, 0, 0.05)) },
    { text: ['Wild grass', ' · Leymus racemosus'], at: 'grass', cls: 'grn', alpha: S => prog(S.soil_grass, 0.6, 0.9) },
    { text: ['Wheat', ' · Munal'], at: 'chromWheat', cls: 'amb', alpha: S => prog(S.soil_chrom, 0.05, 0.15) },
    { text: ['BNI trait', ' · a piece of chromosome'], at: 'segment', cls: 'cyn', alpha: S => prog(S.soil_chrom, 0.12, 0.25) * (1 - prog(S.soil_chrom, 0.9, 1)) },
    { text: ['One marked atom', ' · followed'], at: 'tracer', cls: '', alpha: S => prog(S.soil_tracer, 0.02, 0.08) * (1 - prog(S.soil_tracer, 0.92, 0.99)) },
    { text: ['Illustration', ''], at: 'corner', cls: '', minor: true, alpha: S => blockOn(S) * prog(S.soil_cut, 0.3, 0.8) },
  ];
  function pickOk(S, g) { const p = Math.round(S.soil_pick === undefined ? -1 : S.soil_pick); return p < 0 || p === g ? 1 : 0.35; }
  return Object.assign(set, {
    params: { soil_a: 1, soil_grow: 1, soil_cut: 1, soil_fert: 0, soil_flow: 0, soil_plant: 0.45, soil_inhibit: 0, soil_halo: 0,
      soil_dcd: 0, soil_pore: 0, soil_relay: 0, soil_grass: 0, soil_chrom: 0, soil_tracer: 0, soil_pick: -1 },
    log: [],
    update,
    anchors,
    labels,
    cam: {
      default: [-28, 18, 3.2, 0, 0.05, 0], plant: [-20, 10, 2.4, 0, 0.45, 0], roots: [-15, 4, 1.9, 0, -0.3, 0.15],
      surface: [-30, 22, 2.2, -0.1, 0.05, 0.1], pore: [-10, 6, 1.5, 0.18, -0.28, 0.25], relay: [0, 4, 1.2, 0.18, -0.28, 0.25],
      chrom: [-5, 8, 2.4, -0.1, 0.7, 0.2], tracer: [-25, 12, 2.8, 0, 0, 0],
    },
    controls: [
      { key: 'view', label: 'View', options: [['default', 'The block'], ['roots', 'The roots'], ['pore', 'A soil pore'], ['chrom', 'The chromosome']] },
      { key: 'fert', label: 'Fertiliser', options: [['on', 'Spread'], ['off', 'None']] },
      { key: 'wheat', label: 'Wheat', options: [['bni', 'BNI wheat'], ['ctrl', 'Control wheat']] },
      { key: 'dcd', label: 'Inhibitor', options: [['off', 'None'], ['on', 'DCD']] },
    ],
    // the Nitrogen sketch (a sketch, not data): the fertiliser falls and the flows build up again from c.t; the BNI wheat
    // brings its halo, DCD its granules, and both slow the relay
    explore(c) {
      const bni = c.wheat === 'bni', dcd = c.dcd === 'on', fert = c.fert !== 'off', pore = c.view === 'pore', chrom = c.view === 'chrom';
      return { soil_grow: 1, soil_cut: 1, soil_fert: fert ? K.prog(c.t, 0, 2.5) : 0, soil_flow: fert ? 0.3 + 0.7 * K.prog(c.t, 1.5, 3.5) : 0.2,
        soil_plant: 0.45, soil_halo: bni ? K.prog(c.t, 0.5, 2.5) : 0, soil_dcd: dcd ? 1 : 0, soil_inhibit: Math.min(1, (bni ? 0.6 : 0) + (dcd ? 0.8 : 0)),
        soil_pore: pore ? 1 : 0, soil_relay: pore ? 4 : 0, soil_grass: chrom ? 1 : 0, soil_chrom: chrom ? K.prog(c.t, 0.8, 5) : 0, soil_tracer: 0 };
    },
    api() { return { pick, guildAt, tracer: () => trOut.slice(), roots: ROOTS.length }; },
  });
};

// field: the trial's 24 plots under netting (2 wheat lines x 3 regimes x 4 replicates, the replicates drawn as four
// blocks), the wheat growing over the five sampling dates with each plot's leaves coloured by its measured chlorophyll,
// nitrate seeping down as blue light under each plot, jars of each date's soil breathing out N2O as the slides' curves
// say, soil cores lifting out of the plots and stacking into the design's 30 groups, and the plots lit by a module of
// the network. Real numbers from SOIL_DATA (SDATA); the plots' layout, the wheat's look (its height and stage by the
// Zadoks stages of design.times) and the plume's shape are illustrative; the day-70 chlorophyll and the jars' N2O are
// read off the slides. Manifest: field.md.
// Frame: the plots on the x-z plane at y = 0 (about 1.8 by 1.2), a soil slab under them to y = -0.25, the wheat up to
// about y = 0.3 when ripe, the netting at y = 0.42, the jars on a bench to the right (x about 1.3), the stack of cores
// behind (z about -0.95, up to y about 0.75). The net set (the cloud and the network) is drawn in this frame, over it.
SETS.field = function (K) {
  const { THREE, clamp, prog, smooth, rng, lerp } = K;
  const set = K.newSet('field');
  const LK = TLOOK(K, set), C = SLOOK.rgb, D = SOIL_DATA, TIMES = D.design.times;
  const TAU = Math.PI * 2;
  // the plots: 4 blocks (rows along z, the replicates) of 6 plots (along x); in each block the six treatments in an
  // order of their own (seeded: a randomised block design, as a field trial is laid out; the real map is not known)
  const PW = 0.24, PD = 0.2, GX = 0.06, GZ = 0.1, rnd = K.rng(16), order = [];
  for (let r = 0; r < 4; r++) {
    const o = [0, 1, 2, 3, 4, 5];
    for (let i = 5; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    order.push(o);
  }
  const plotXZ = p => {
    const { line, fert, rep } = SDATA.ofPlot(p), k = order[rep].indexOf(line * 3 + fert);
    return [(k - 2.5) * (PW + GX), 0, (rep - 1.5) * (PD + GZ)];
  };
  const PXZ = [];
  for (let p = 0; p < 24; p++) PXZ.push(plotXZ(p));
  // ------------------------------------------------------------------ the data per plot and date (looked up once)
  const KEYS = ['chl', 'nh4', 'no3', 'n2o', 'ph'], UNIT = { chl: ' SPAD', nh4: ' mg N/kg', no3: ' mg N/kg', n2o: '', ph: '' };
  const plotVal = (key, p, time) => { const { line, fert, rep } = SDATA.ofPlot(p), v = SDATA.value(key, SDATA.slot(line, fert, time, rep)); return v === null || v === undefined ? null : v; };
  const groupMean = (key, line, fert, time) => { const m = SDATA.meta(key, line, fert, time).mean; return m === null || m === undefined ? null : m; };
  // a plot's value at each date, its group's mean where the plot has none (the missing sample)
  const series = key => { const out = []; for (let p = 0; p < 24; p++) { const { line, fert } = SDATA.ofPlot(p); out.push(TIMES.map((T, ti) => { const v = plotVal(key, p, ti); return v !== null ? v : groupMean(key, line, fert, ti); })); } return out; };
  const NH4 = series('nh4'), NO3 = series('no3');
  // chlorophyll: the plots' own on days 1, 15 and 24; on day 70 the slides' reading for the group (the metadata's T4 is day
  // 70's, see SOIL_DATA.open); day 53 lies on the line from day 24 to day 70, as the slides draw it
  const CHL = [];
  for (let p = 0; p < 24; p++) {
    const { line, fert } = SDATA.ofPlot(p), v = [0, 1, 2].map(ti => { const x = plotVal('chl', p, ti); return x !== null ? x : groupMean('chl', line, fert, ti); });
    const v4 = SDATA.chl70(fert, line).v;
    v.push(v[2] + (v4 - v[2]) * (53 - 24) / (70 - 24), v4);
    CHL.push(v);
  }
  const at = (arr, d) => { const i = Math.min(3, Math.floor(clamp(d, 0, 4))), f = clamp(d, 0, 4) - i; return arr[i] + (arr[i + 1] - arr[i]) * f; };
  // a module's score in each plot's sample at each date (0 for the missing sample)
  const SCORE = {};
  const scores = m => SCORE[m] || (SCORE[m] = Array.from({ length: 24 }, (x, p) => { const { line, fert, rep } = SDATA.ofPlot(p); return TIMES.map((T, ti) => { const s = SDATA.net.score(m, SDATA.slot(line, fert, ti, rep)); return s === null || s === undefined ? 0 : s; }); }));
  // the jars' N2O: the slides' curve for a date, regime and line at incubation day tau (0 at the start; never below 0)
  const NT = D.figs.n2o.times;
  function ppm(time, fert, line, tau) {
    const c = SDATA.n2o(time, fert, line);
    if (tau <= NT[0]) return Math.max(0, c[0] * tau / NT[0]);
    for (let i = 1; i < NT.length; i++) if (tau <= NT[i]) return Math.max(0, c[i - 1] + (c[i] - c[i - 1]) * (tau - NT[i - 1]) / (NT[i] - NT[i - 1]));
    return Math.max(0, c[c.length - 1]);
  }
  // ------------------------------------------------------------------ shared shader parts
  const LIGHT = 'vec3 l = normalize(vec3(-0.45, 0.55, 0.7));';
  const NOISE = `
float hsh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hsh(i + vec3(0.0, 1.0, 0.0)), hsh(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hsh(i + vec3(0.0, 0.0, 1.0)), hsh(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hsh(i + vec3(0.0, 1.0, 1.0)), hsh(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }`;
  const LITCOL = `
  vec3 n = normalize(vN), v = normalize(vV); if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - abs(dot(n, v)), 2.2), spec = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);`;
  // per plot, refilled each frame: x ammonium glow, y the module's score (lit), z brightness (1, or dimmed when not
  // picked), w nitrate; and the leaves' colour
  const UP = { uPlot: { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, 0, 1, 0)) }, uLeaf: { value: Array.from({ length: 24 }, () => new THREE.Vector3(0.3, 0.6, 0.25)) },
    uMcol: { value: new THREE.Color(1, 1, 1) } };
  const PLOTGL = 'uniform vec4 uPlot[24]; uniform vec3 uLeaf[24]; uniform vec3 uMcol;';
  const shader = o => {
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, UP, o.uniforms || {}), vertexShader: o.vertex, fragmentShader: o.fragment,
      transparent: true, side: o.side === undefined ? THREE.DoubleSide : o.side, blending: o.blending || THREE.NormalBlending, depthWrite: o.depthWrite !== false });
    if (o.fixed) m.userData.fixed = true;
    set.mats.push(m);
    return m;
  };
  // ------------------------------------------------------------------ the slab: soil under the field (its near sides turn
  // to glass while the nitrate shows, as the soil story's block)
  const SX = 0.98, SZ = 0.66, SY = 0.25;
  const slabMat = shader({
    fixed: true, depthWrite: false,
    uniforms: { uCut: { value: 0 }, uEdge: { value: new THREE.Color(...C(SLOOK.SOIL.water)) } },
    vertex: `varying vec3 vN, vV, vP; void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragment: `uniform float uA, uCut; uniform vec3 uEdge; varying vec3 vN, vV, vP;
${NOISE}
void main() {
  ${LITCOL}
  float dx = ${SX} - abs(vP.x), dy = min(-vP.y, vP.y + ${SY}), dz = ${SZ} - abs(vP.z);
  float e = dx + dy + dz - min(dx, min(dy, dz)) - max(dx, max(dy, dz)), edge = smoothstep(0.006, 0.0, e), cut = gl_FrontFacing ? uCut : 0.0;
  float y = -vP.y + 0.01 * (vnoise(vP * 9.0) - 0.5), nn = vnoise(vP * 45.0) * 0.6 + vnoise(vP * 110.0) * 0.4;
  vec3 pc = mix(vec3(0.13, 0.09, 0.065), vec3(0.24, 0.17, 0.12), smoothstep(0.02, 0.07, y));
  pc = mix(pc, vec3(0.36, 0.26, 0.17), smoothstep(0.12, 0.2, y)) * (0.75 + 0.5 * nn);
  vec3 col = pc * (0.45 + 0.5 * dif + 0.18 * hemi);
  gl_FragColor = vec4(mix(col, pc * 0.9 + uEdge * edge * 0.7, cut), uA * mix(1.0, 0.08 + 0.6 * edge, cut));
}`,
  });
  {
    const fs = [], face = (w, h, rot, pos) => { const g = new THREE.PlaneGeometry(w, h); g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot))); g.translate(...pos); g.deleteAttribute('uv'); fs.push(g); };
    face(2 * SX, SY, [0, 0, 0], [0, -SY / 2, SZ]); face(2 * SX, SY, [0, Math.PI, 0], [0, -SY / 2, -SZ]);
    face(2 * SZ, SY, [0, Math.PI / 2, 0], [SX, -SY / 2, 0]); face(2 * SZ, SY, [0, -Math.PI / 2, 0], [-SX, -SY / 2, 0]);
    face(2 * SX, 2 * SZ, [Math.PI / 2, 0, 0], [0, -SY, 0]);
    const slab = new THREE.Mesh(K.merge(fs), slabMat); slab.renderOrder = 2; slab.frustumCulled = false;
    set.group.add(slab);
  }
  // ------------------------------------------------------------------ the ground and the plots (one mesh): mown paths
  // between the plots; each plot tilled soil in rows, edged in its regime's colour; it glows amber with its ammonium,
  // in a module's colour with the module's score, and darkens while not picked
  const ground = (() => {
    const P = [], N = [], A = [], I = [];   // A: plot index (-1 the ground), u, v, regime
    const quad = (x0, z0, x1, z1, y, plot, reg, nu, nv) => {
      const b = P.length / 3;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const u = i / nu, v = j / nv;
        P.push(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * v); N.push(0, 1, 0); A.push(plot, u, v, reg);
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = b + j * (nu + 1) + i; I.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2); }
    };
    quad(-SX, -SZ, SX, SZ, 0, -1, 0, 24, 16);
    for (let p = 0; p < 24; p++) { const [x, , z] = PXZ[p], { fert } = SDATA.ofPlot(p); quad(x - PW / 2, z - PD / 2, x + PW / 2, z + PD / 2, 0.006, p, fert, 6, 5); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('aI', new THREE.Float32BufferAttribute(A, 4)); g.setIndex(I);
    const regs = SLOOK.FERT.map(h => `vec3(${C(h).map(x => x.toFixed(3)).join(', ')})`);
    const m = shader({
      uniforms: { uNh4: { value: new THREE.Color(...C(SLOOK.N.nh4)) } },
      vertex: `attribute vec4 aI; ${PLOTGL}
varying vec3 vN, vV, vP, vR; varying vec4 vQ; varying vec2 vUV; varying float vPl;
void main() {
  vPl = aI.x; vUV = aI.yz; vQ = vec4(0.0, 0.0, 1.0, 0.0);
  if (aI.x > -0.5) vQ = uPlot[int(aI.x + 0.5)];
  vR = aI.w < 0.5 ? ${regs[0]} : aI.w < 1.5 ? ${regs[1]} : ${regs[2]};
  vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`,
      fragment: `uniform float uA, uMlit; uniform vec3 uMcol, uNh4; varying vec3 vN, vV, vP, vR; varying vec4 vQ; varying vec2 vUV; varying float vPl;
${NOISE}
void main() {
  ${LITCOL}
  float nn = vnoise(vP * 70.0) * 0.6 + vnoise(vP * 180.0) * 0.4;
  vec3 col;
  if (vPl < -0.5) {
    col = mix(vec3(0.1, 0.13, 0.07), vec3(0.17, 0.2, 0.1), nn);   // mown paths
    col = col * (0.5 + 0.5 * dif + 0.2 * hemi);
  } else {
    // tilled soil in drilled rows along x, edged in the regime's colour
    float row = 0.5 + 0.5 * cos(vUV.y * 6.2831853 * 5.0);
    col = mix(vec3(0.16, 0.11, 0.075), vec3(0.27, 0.19, 0.13), nn * 0.6 + row * 0.4);
    col = col * (0.45 + 0.55 * dif + 0.2 * hemi);
    float e = min(min(vUV.x, 1.0 - vUV.x) * ${(PW / PD).toFixed(3)}, min(vUV.y, 1.0 - vUV.y));
    col += uNh4 * vQ.x * (0.55 + 0.45 * nn) * 0.9;
    col = mix(col, uMcol * (0.55 + 0.45 * row), clamp(vQ.y, 0.0, 1.0) * 0.85);
    col *= 1.0 - 0.6 * clamp(-vQ.y, 0.0, 1.0);
    col *= vQ.z;
    col = mix(col, vR * (0.8 + 0.4 * vQ.z), smoothstep(0.045, 0.025, e));
  }
  gl_FragColor = vec4(col, uA);
}`,
    });
    m.uniforms.uMlit = { value: 0 };
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ the wheat: about fifty stems in rows on every plot
  // (the flock's swaying reeds, grown into wheat: a stalk, two leaves and an ear), height and stage by the date, the
  // leaves by the plot's chlorophyll
  const wheat = (() => {
    const P = [], N = [], B = [], W = [], I = [], r = rng(5);
    // one stem in unit height (y 0..1 the stem's height; offsets scale with it)
    const strip = (pts, wid, nrm, kind, base, w4) => {
      const b = P.length / 3;
      pts.forEach((q, i) => {
        const s = i / (pts.length - 1), hw = wid(s);
        P.push(q[0] - nrm[2] * hw, q[1], q[2] + nrm[0] * hw, q[0] + nrm[2] * hw, q[1], q[2] - nrm[0] * hw);
        N.push(nrm[0], 0.4, nrm[2], nrm[0], 0.4, nrm[2]);
        for (let k = 0; k < 2; k++) { B.push(...base); W.push(kind, s, w4[0], w4[1]); }
      });
      for (let i = 0; i < pts.length - 1; i++) { const a = b + 2 * i; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    };
    for (let p = 0; p < 24; p++) {
      const [px, , pz] = PXZ[p];
      for (let row = 0; row < 5; row++) for (let k = 0; k < 10; k++) {
        const x = px + (k + 0.5 + (r() - 0.5) * 0.6) / 10 * PW * 0.9 - PW * 0.45, z = pz + (row + 0.5) / 5 * PD * 0.8 - PD * 0.4 + (r() - 0.5) * 0.012;
        const base = [x, z, p, r()], ph = r() * TAU, lean = (r() - 0.5) * 0.12, az = r() * TAU, ca = Math.cos(az), sa = Math.sin(az);
        // the stalk (to 0.8: the ear above it), facing a random way
        const st = [0, 0.27, 0.54, 0.8].map(y => [lean * y * y, y, lean * 0.4 * y * y]);
        strip(st, s => 0.011 * (1 - 0.4 * s), [ca, 0, sa], 0, base, [ph, az]);
        // two leaves arching out
        for (const [h0, dir, len] of [[0.25, az + 1.2, 0.45], [0.5, az + 1.2 + Math.PI, 0.38]]) {
          const dx = Math.cos(dir), dz = Math.sin(dir), pts = [];
          for (let i = 0; i <= 4; i++) { const s = i / 4, e = 0.9 - 1.9 * s * s; pts.push([lean * h0 * h0 + dx * len * s * 0.75, h0 + Math.sin(0.9) * len * s - 0.5 * len * s * s * (1 + 0.5 * s), lean * 0.4 * h0 * h0 + dz * len * s * 0.75]); void e; }
          strip(pts, s => 0.03 * Math.sin(Math.PI * Math.min(1, s * 1.05 + 0.08)) + 0.003, [-dz, 0, dx], 1, base, [ph, az]);
        }
        // the ear: two crossed diamonds from 0.8 to 1.0
        for (const a2 of [az, az + Math.PI / 2]) {
          const pts = [0.8, 0.86, 0.94, 1.0].map(y => [lean * y * y, y, lean * 0.4 * y * y]);
          strip(pts, s => 0.026 * Math.sin(Math.PI * (0.15 + 0.85 * s)) * (1 - 0.3 * s), [Math.cos(a2), 0, Math.sin(a2)], 2, base, [ph, az]);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('aB', new THREE.Float32BufferAttribute(B, 4)); g.setAttribute('aW', new THREE.Float32BufferAttribute(W, 4)); g.setIndex(I);
    const green = C('#4e9a3c'), earG = C('#8fb04c'), gold = C(SLOOK.SOIL.ear), straw = C(SLOOK.SOIL.straw);
    const v3 = c => `vec3(${c.map(x => x.toFixed(3)).join(', ')})`;
    const m = shader({
      uniforms: { uH: { value: 0.1 }, uGrow: { value: 1 }, uEar: { value: 0 }, uRipe: { value: 0 }, uChl: { value: 1 } },
      vertex: `attribute vec4 aB, aW; ${PLOTGL}
uniform float uH, uGrow, uEar, uRipe, uChl, uTime;
varying vec3 vC, vN, vV;
void main() {
  int pi = int(aB.z + 0.5);
  vec4 Q = uPlot[pi];
  float g = clamp((uGrow - aB.w * 0.35) / 0.65, 0.0, 1.0);
  float h = uH * g * (0.85 + 0.3 * fract(aB.w * 7.31));
  vec3 q = position;
  float kind = aW.x;
  if (kind > 1.5) q.y = 0.8 + (q.y - 0.8) * uEar;   // (the ear comes out of the flag leaf's sheath)
  q *= h;
  // the ripe ears nod
  if (kind > 1.5) { float nod = uRipe * 0.35 * (q.y - 0.8 * h) / h; q.x += nod * h * cos(aW.w); q.z += nod * h * sin(aW.w); }
  float sw = pow(q.y / 0.3, 2.0);
  q.x += sw * (0.012 * sin(uTime * 1.3 + aB.x * 4.0 + aB.y * 2.0 + aW.z) + 0.006);
  q.z += sw * 0.008 * sin(uTime * 1.07 + aB.x * 3.0 + aW.z * 1.7);
  vec3 p = vec3(aB.x, 0.0, aB.y) + q;
  vec3 leaf = mix(${v3(green)}, uLeaf[pi], uChl) * (0.82 + 0.36 * fract(aB.w * 13.7));
  vec3 ear = mix(${v3(earG)}, ${v3(gold)}, uRipe);
  vC = kind > 1.5 ? ear : kind < 0.5 ? mix(leaf * 1.05, ${v3(straw)}, uRipe * 0.35) : leaf;
  vC *= mix(1.0, Q.z, 0.7);   // (the plots not picked stay readable: they are the comparison)
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (h < 0.002 || (kind > 1.5 && uEar < 0.01)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `uniform float uA; varying vec3 vC, vN, vV;
void main() {
  ${LITCOL}
  vec3 col = vC * (0.55 + 0.42 * dif + 0.2 * hemi) + vC * rim * 0.35 + vec3(spec * 0.08);
  gl_FragColor = vec4(col, uA);
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    set.group.add(mesh);
    return { mesh, m, tris: I.length / 3 };
  })();
  // ------------------------------------------------------------------ the netting: posts round the field and a net over
  // it on lines, sagging between the posts (drawn across as field_net grows)
  const NY = 0.42, POSTS = [];
  for (const x of [-SX, -SX / 3, SX / 3, SX]) for (const z of [-SZ, SZ]) POSTS.push([x, z]);
  POSTS.push([-SX, 0], [SX, 0]);
  const net = (() => {
    const segs = [], sag = (x, z) => NY - 0.035 * Math.sin(Math.PI * ((x + SX) / (2 * SX / 3) % 1)) * Math.sin(Math.PI * (z + SZ) / SZ % Math.PI);
    const L = (a, b) => segs.push([a, b]);
    const ST = 0.055, n = 26;
    for (let x = -SX; x <= SX + 1e-6; x += ST) for (let i = 0; i < n; i++) { const z0 = -SZ + 2 * SZ * i / n, z1 = -SZ + 2 * SZ * (i + 1) / n; L([x, sag(x, z0), z0], [x, sag(x, z1), z1]); }
    for (let z = -SZ; z <= SZ + 1e-6; z += ST) for (let i = 0; i < 36; i++) { const x0 = -SX + 2 * SX * i / 36, x1 = -SX + 2 * SX * (i + 1) / 36; L([x0, sag(x0, z), z], [x1, sag(x1, z), z]); }
    // the sides: vertical lines and a few rows
    for (const z of [-SZ, SZ]) { for (let x = -SX; x <= SX + 1e-6; x += ST * 2) L([x, 0, z], [x, sag(x, z), z]); for (const y of [0.1, 0.2, 0.3]) for (let i = 0; i < 18; i++) L([-SX + 2 * SX * i / 18, y, z], [-SX + 2 * SX * (i + 1) / 18, y, z]); }
    for (const x of [-SX, SX]) { for (let z = -SZ; z <= SZ + 1e-6; z += ST * 2) L([x, 0, z], [x, sag(x, z), z]); for (const y of [0.1, 0.2, 0.3]) for (let i = 0; i < 12; i++) L([x, y, -SZ + 2 * SZ * i / 12], [x, y, -SZ + 2 * SZ * (i + 1) / 12]); }
    const g = K.linesGeo(segs.length), Pp = g.attributes.position.array, Cc = g.attributes.aCol.array, A = g.attributes.aA.array, T = g.attributes.aT.array, nc = C(SLOOK.SOIL.net);
    segs.forEach(([a, b], i) => { Pp.set(a, 6 * i); Pp.set(b, 6 * i + 3); Cc.set(nc, 6 * i); Cc.set(nc, 6 * i + 3); A[2 * i] = A[2 * i + 1] = a[1] > NY - 0.06 && b[1] > NY - 0.06 ? 0.22 : 0.16; T[2 * i] = T[2 * i + 1] = ((a[0] + b[0]) / 2 + SX) / (2 * SX) * 0.9; });
    const m = K.lines(set);
    const mesh = new THREE.LineSegments(g, m); mesh.frustumCulled = false; mesh.renderOrder = 1;
    set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ lit things: posts, the bench, the jars' soil and
  // lids, the plots' signs (instanced built-in materials, coloured per instance)
  const cylP = (() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false); g.translate(0, 0.5, 0);
    const mt = K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05 }));
    const mesh = new THREE.InstancedMesh(g, mt, 120); mesh.frustumCulled = false; mesh.count = 0;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3), 3);   // (setColorAt would size it by count, 0 here)
    set.group.add(mesh);
    return mesh;
  })();
  const boxP = (() => {
    const mt = K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.02 }));
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mt, 64); mesh.frustumCulled = false; mesh.count = 0;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3), 3);
    set.group.add(mesh);
    return mesh;
  })();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _t = new THREE.Vector3(), _col = new THREE.Color();
  const putI = (mesh, i, pos, scl, col) => { _m.compose(_t.set(pos[0], pos[1], pos[2]), _q.set(0, 0, 0, 1), _s.set(scl[0], scl[1], scl[2])); mesh.setMatrixAt(i, _m); mesh.setColorAt(i, _col.setRGB(col[0], col[1], col[2])); };
  // the jars: one per regime and line for a date (six), or all five dates in rows (thirty)
  const BX = 1.3, JR = 0.042, JH = 0.11;
  const _jx = [0, 0], jarXZ = (time, fert, line, all, out = _jx) => { out[0] = all ? BX + (time - 2) * 0.115 : BX; out[1] = (fert * 2 + line - 2.5) * 0.13; return out; };
  const jarGeo = (() => {
    const prof = [[0.001, 0], [0.9, 0], [1, 0.06], [1, 0.82], [0.88, 0.93], [0.72, 0.97], [0.72, 1.0]].map(([r, y]) => new THREE.Vector2(r * JR, y * JH));
    return new THREE.LatheGeometry(prof, 28);
  })();
  const jarMat = K.rim(set, { color: '#bfe6ff', a0: 0.05, a1: 0.75 });
  const jars = new THREE.InstancedMesh(jarGeo, jarMat, 30); jars.frustumCulled = false; jars.count = 0; jars.renderOrder = 3;
  set.group.add(jars);
  // the fixed pieces of the pools (posts, signs, bench): written once; the jars' pieces follow the date (layoutJars)
  const POSTC = C(SLOOK.SOIL.post), BENCH = C('#56657c'), LEG = C('#3e4859'), SOILJ = C('#4a3424'), LID = C('#9aa4b2');
  let nCylFixed = 0, nBoxFixed = 0;
  {
    POSTS.forEach(([x, z], i) => putI(cylP, i, [x, -0.002, z], [0.009, NY + 0.02, 0.009], POSTC));
    nCylFixed = POSTS.length;
    let b = 0;
    benchAt(1); b = 5;
    // a small sign at the front of each plot: a post and a plate in its wheat line's colour
    for (let p = 0; p < 24; p++) {
      const [x, , z] = PXZ[p], { line } = SDATA.ofPlot(p), lc = C(SLOOK.LINE[line]);
      putI(boxP, b++, [x - PW / 2 + 0.02, 0.025, z + PD / 2 + 0.012], [0.004, 0.05, 0.004], POSTC);
      putI(boxP, b++, [x - PW / 2 + 0.02, 0.05, z + PD / 2 + 0.014], [0.032, 0.02, 0.003], lc);
    }
    nBoxFixed = b;
    boxP.count = b; boxP.instanceMatrix.needsUpdate = true; boxP.instanceColor.needsUpdate = true;
  }
  // the bench (box instances 0 to 4), there only while the jars are
  function benchAt(k) {
    const kk = Math.max(1e-3, k);
    putI(boxP, 0, [BX, -0.012, 0], [0.62 * kk, 0.024, 0.88 * kk], BENCH);
    [[-0.28, -0.41], [0.28, -0.41], [-0.28, 0.41], [0.28, 0.41]].forEach(([dx, dz], i) => putI(boxP, 1 + i, [BX + dx * kk, -0.135 + 0.115 * (1 - kk), dz * kk], [0.03 * kk, 0.23 * kk, 0.03 * kk], LEG));
    boxP.instanceMatrix.needsUpdate = true;
  }
  let jarKey = '', benchK = -1;
  function layoutJars(jday, show) {
    const key = jday + '|' + (show > 0.004);
    if (key === jarKey) return;
    jarKey = key;
    let c = nCylFixed, j = 0;
    if (show > 0.004) for (let ti = 0; ti < 5; ti++) {
      if (jday >= 0 && ti !== jday) continue;
      for (let fert = 0; fert < 3; fert++) for (let line = 0; line < 2; line++) {
        const [x, z] = jarXZ(ti, fert, line, jday < 0);
        _m.compose(_t.set(x, 0, z), _q.set(0, 0, 0, 1), _s.set(1, 1, 1)); jars.setMatrixAt(j++, _m);
        putI(cylP, c++, [x, 0.003, z], [JR * 0.86, 0.035, JR * 0.86], SOILJ);
        putI(cylP, c++, [x, JH, z], [JR * 0.78, 0.012, JR * 0.78], C(SLOOK.LINE[line]));
        putI(cylP, c++, [x, 0.0, z], [JR * 1.18, 0.004, JR * 1.18], C(SLOOK.FERT[fert]));
      }
    }
    jars.count = j; jars.instanceMatrix.needsUpdate = true;
    cylP.count = c; cylP.instanceMatrix.needsUpdate = true; if (cylP.instanceColor) cylP.instanceColor.needsUpdate = true;
  }
  layoutJars(0, 0);
  // ------------------------------------------------------------------ light columns: nitrate seeping down under each plot,
  // and a module's light rising from the plots where it is strong (one additive mesh)
  const columns = (() => {
    const P = [], A = [], I = [];
    for (let p = 0; p < 24; p++) for (const dir of [-1, 1]) {
      const [x, , z] = PXZ[p], w = PW * (dir < 0 ? 0.46 : 0.4), d = PD * (dir < 0 ? 0.46 : 0.4), b = P.length / 3;
      const box = new THREE.BoxGeometry(2 * w, 1, 2 * d, 1, 6, 1); box.translate(0, 0.5, 0);
      const pa = box.attributes.position.array;
      for (let i = 0; i < pa.length; i += 3) { P.push(x + pa[i], pa[i + 1], z + pa[i + 2]); A.push(p, dir, pa[i + 1], 0); }
      for (const ix of box.index.array) I.push(b + ix);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aI', new THREE.Float32BufferAttribute(A, 4)); g.setIndex(I);
    const m = shader({
      depthWrite: false, blending: THREE.AdditiveBlending, fixed: true,
      uniforms: { uNo3: { value: new THREE.Color(...C(SLOOK.N.no3Glow)) } },
      vertex: `attribute vec4 aI; ${PLOTGL} uniform float uTime; uniform vec3 uNo3;
varying float vI, vH, vDir; varying vec3 vP; varying vec3 vC;
void main() {
  vec4 Q = uPlot[int(aI.x + 0.5)];
  vec3 p = position; float u = aI.z;
  if (aI.y < 0.0) { float dep = clamp(0.03 + 0.24 * Q.w, 0.0, ${(SY - 0.006).toFixed(3)}); p.y = -0.004 - u * dep; vI = Q.w; vC = uNo3; }
  else { float s = clamp(Q.y, 0.0, 1.2); p.y = 0.01 + u * (0.1 + 0.95 * s); vI = s; vC = uMcol; }
  vH = u; vDir = aI.y; vP = p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  if (vI < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `uniform float uA, uTime; varying float vI, vH, vDir; varying vec3 vP; varying vec3 vC;
${NOISE}
void main() {
  float streak = vnoise(vec3(vP.x * 60.0, vP.y * 14.0 + uTime * 0.5 * vDir * -1.0, vP.z * 60.0));
  float a = vDir < 0.0 ? pow(1.0 - vH, 1.4) * (0.5 + 0.5 * streak) * 0.5 : pow(1.0 - vH, 1.5) * (0.45 + 0.55 * streak) * 0.42;
  gl_FragColor = vec4(vC * a * min(1.0, vI * 1.3) * uA, 1.0);
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3;
    set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ the cores: one out of every plot at each date (119;
  // the missing sample never lifts), lifting out and flying into the design's stack (the aging ovary story's stacking
  // movement: two poses per instance, a staggered smoothstep from one to the other)
  const stackXYZ = (line, fert, time, rep) => [(fert - 1) * 0.42 + (rep - 1.5) * 0.065, 0.12 + time * 0.13, -0.95 + (line - 0.5) * 0.12];
  const CORES = [];
  for (let g = 0; g < 30; g++) for (let rep = 0; rep < 4; rep++) {
    const s = g * 4 + rep;
    if (s === SDATA.missing) continue;
    const { line, fert, time } = SDATA.ofSlot(s);
    CORES.push({ s, line, fert, time, rep, plot: SDATA.plot(line, fert, rep) });
  }
  const cores = (() => {
    const g0 = new THREE.CylinderGeometry(1, 1, 1, 12, 3, false);
    const n = CORES.length, g = new THREE.InstancedBufferGeometry();
    g.setIndex(g0.index); g.setAttribute('position', g0.attributes.position); g.setAttribute('normal', g0.attributes.normal);
    const aA = new Float32Array(n * 4), aB = new Float32Array(n * 4), aI = new Float32Array(n * 4);
    CORES.forEach((c, i) => {
      const [x, , z] = PXZ[c.plot];
      aA.set([x + (c.time - 2) * 0.04, z - 0.02, c.time, 0], 4 * i);
      aB.set([...stackXYZ(c.line, c.fert, c.time, c.rep), (c.time * 4 + c.rep) / 20 + c.fert * 0.04], 4 * i);
      aI.set([c.fert, c.line, c.time, c.rep], 4 * i);
    });
    g.setAttribute('aA', new THREE.InstancedBufferAttribute(aA, 4)); g.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4)); g.setAttribute('aI', new THREE.InstancedBufferAttribute(aI, 4));
    g.instanceCount = n;
    const regs = SLOOK.FERT.map(h => `vec3(${C(h).map(x => x.toFixed(3)).join(', ')})`), lns = SLOOK.LINE.map(h => `vec3(${C(h).map(x => x.toFixed(3)).join(', ')})`);
    const m = shader({
      uniforms: { uLift: { value: 0 }, uStack: { value: 0 } },
      vertex: `attribute vec4 aA, aB, aI;
uniform float uLift, uStack;
varying vec3 vN, vV, vL, vReg, vLin; varying float vS, vNy;
void main() {
  vNy = normal.y;
  float lift = smoothstep(0.0, 1.0, clamp(uLift * 5.0 - aI.z, 0.0, 1.0));
  float st = smoothstep(0.0, 1.0, clamp(uStack * 1.6 - aB.w * 0.6, 0.0, 1.0));
  float r = 0.022, h = 0.1 * max(lift, st);
  vec3 a = vec3(aA.x, mix(-0.1, 0.03, lift), aA.y), b = aB.xyz - vec3(0.0, 0.05, 0.0);
  vec3 c = mix(a, b, st) + vec3(0.0, sin(st * 3.14159) * 0.28, 0.0);
  vec3 p = c + vec3(position.x * r, (position.y + 0.5) * h, position.z * r);
  vL = position; vS = st;
  vReg = aI.x < 0.5 ? ${regs[0]} : aI.x < 1.5 ? ${regs[1]} : ${regs[2]};
  vLin = aI.y < 0.5 ? ${lns[0]} : ${lns[1]};
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (h < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `uniform float uA; varying vec3 vN, vV, vL, vReg, vLin; varying float vS, vNy;
void main() {
  ${LITCOL}
  float y = vL.y + 0.5;
  vec3 soil = mix(vec3(0.42, 0.3, 0.2), vec3(0.17, 0.12, 0.08), smoothstep(0.55, 0.95, y));
  vec3 col = soil * (0.4 + 0.55 * dif + 0.2 * hemi) + soil * rim * 0.4;
  // in the stack: a band in its regime's colour, a cap in its wheat line's
  float band = smoothstep(0.08, 0.0, abs(y - 0.72)) * vS;
  col = mix(col, vReg * (0.7 + 0.5 * dif), band);
  col = mix(col, vLin * (0.75 + 0.4 * dif), vS * step(0.9, vNy));
  col += vReg * rim * 0.5 * vS;
  gl_FragColor = vec4(col, uA);
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ glows: nitrate drips under the plots, ammonium
  // sparkles on them, the module's light rising, the jars' N2O plumes (one pool of soft points)
  const H = LK.halos(1100);
  H.mesh.renderOrder = 4;
  set.group.add(H.mesh);
  const cNH4 = C(SLOOK.N.nh4), cNO3 = C(SLOOK.N.no3Glow), cN2O = C(SLOOK.N.n2o), _p = [0, 0, 0], mcol = [1, 1, 1];
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  // ------------------------------------------------------------------ state for labels
  const now = { date: 0, pick: -1, show: 0, tags: 0, jday: 0, inc: 0, mod: -1, mlit: 0, line: -1, fert: -1, jar: [] };
  for (let i = 0; i < 6; i++) now.jar.push({ v: 0, top: [BX, 0.2, 0] });
  const lit = p => { const { line, fert } = SDATA.ofPlot(p); return (now.line < 0 || now.line === line) && (now.fert < 0 || now.fert === fert) && (now.pick < 0 || now.pick === line * 3 + fert); };
  // ------------------------------------------------------------------ update: everything from the params and t
  const Hd = [0.13, 0.205, 0.27, 0.285, 0.285];   // the wheat's height at each date (jointing to ripening; a drawing)
  function update(S, t) {
    LK.depth();
    const grow = clamp(S.field_grow, 0, 1), date = clamp(S.field_date, 0, 4), chl = clamp(S.field_chl, 0, 1), no3 = clamp(S.field_no3, 0, 1), nh4 = clamp(S.field_nh4, 0, 1);
    const jarsA = clamp(S.field_jars, 0, 1), jday = Math.round(S.field_jday === undefined ? 0 : S.field_jday), inc = clamp(S.field_inc, 0, 1);
    const coresA = clamp(S.field_cores, 0, 1), stack = clamp(S.field_stack, 0, 1), mod = Math.round(S.field_module === undefined ? -1 : S.field_module), mlit = clamp(S.field_mlit, 0, 1);
    const pick = Math.round(S.field_pick === undefined ? -1 : S.field_pick), netA = clamp(S.field_net, 0, 1);
    now.date = date; now.pick = pick; now.show = Math.round(S.field_show || 0); now.tags = clamp(S.field_tags, 0, 1); now.jday = jday; now.inc = inc; now.mod = mod; now.mlit = mlit;
    now.line = Math.round(S.field_line === undefined ? -1 : S.field_line); now.fert = Math.round(S.field_fert === undefined ? -1 : S.field_fert);
    // the wheat by date: its height (jointing, booting, heading, grain filling, ripening), its ears and their colour
    wheat.m.uniforms.uH.value = at(Hd, date); wheat.m.uniforms.uGrow.value = grow;
    wheat.m.uniforms.uEar.value = prog(date, 1.4, 2.05) * (0.85 + 0.15 * prog(date, 2.5, 3.2)); wheat.m.uniforms.uRipe.value = prog(date, 3.1, 4);
    wheat.m.uniforms.uChl.value = chl;
    // per plot: ammonium, the module's score, brightness, nitrate, leaf colour
    const sc = mod >= 0 && mod < D.net.mods.length ? scores(mod) : null;
    if (sc) { const c = C(SLOOK.module(mod)); UP.uMcol.value.setRGB(c[0], c[1], c[2]); mcol[0] = c[0]; mcol[1] = c[1]; mcol[2] = c[2]; }
    ground.m.uniforms.uMlit.value = mlit;
    for (let p = 0; p < 24; p++) {
      const Q = UP.uPlot.value[p], lv = Math.pow(clamp(at(NH4[p], date) / 220, 0, 1), 0.6) * nh4, nv = clamp(at(NO3[p], date) / 110, 0, 1.3) * no3;
      Q.set(lv, sc ? at(sc[p], date) / 0.8 * mlit : 0, lit(p) ? 1 : 0.42, nv);
      const lc = SLOOK.chl(at(CHL[p], date), _p);
      UP.uLeaf.value[p].set(lc[0], lc[1], lc[2]);
    }
    // the slab turns to glass while the nitrate shows
    slabMat.uniforms.uCut.value = no3;
    slabMat.depthWrite = no3 < 0.02 && set.uA.value > 0.97;
    // the netting, drawn across
    net.m.uniforms.uReveal.value = netA; net.mesh.visible = netA > 0.004;
    for (let i = 0; i < nCylFixed; i++) { _m.compose(_t.set(POSTS[i][0], -0.002, POSTS[i][1]), _q.set(0, 0, 0, 1), _s.set(0.009, (NY + 0.02) * Math.max(1e-3, prog(netA, 0, 0.3)), 0.009)); cylP.setMatrixAt(i, _m); }
    cylP.instanceMatrix.needsUpdate = true;
    // the jars
    layoutJars(jday, jarsA);
    const bk = smooth(prog(jarsA, 0, 0.5));
    if (Math.abs(bk - benchK) > 1e-4) { benchK = bk; benchAt(bk); }
    jars.visible = jarsA > 0.004; jarMat.uniforms.uK.value = jarsA;
    // the cores
    cores.m.uniforms.uLift.value = coresA; cores.m.uniforms.uStack.value = stack;
    cores.mesh.visible = coresA > 0.002 || stack > 0.002;
    // the glows
    H.begin();
    if (no3 > 0.01) for (let p = 0; p < 24; p++) {
      const v = UP.uPlot.value[p].w, n = Math.round(v * 10), [x, , z] = PXZ[p];
      for (let k = 0; k < n; k++) {
        const per = 3 + hash(p, k) * 2, a = (t / per + hash(k, p)) % 1, dep = 0.03 + 0.21 * clamp(v, 0, 1);
        _p[0] = x + (hash(p * 7, k) - 0.5) * PW * 0.8; _p[1] = -0.01 - a * dep; _p[2] = z + (hash(k * 3, p) - 0.5) * PD * 0.8;
        H.add(_p, 0.03, cNO3, 0.9 * (1 - a) * Math.min(1, a * 8) * UP.uPlot.value[p].z);
      }
    }
    if (nh4 > 0.01) for (let p = 0; p < 24; p++) {
      const v = UP.uPlot.value[p].x, n = Math.round(v * 6), [x, , z] = PXZ[p];
      for (let k = 0; k < n; k++) {
        _p[0] = x + (hash(p * 5, k) - 0.5) * PW * 0.85; _p[1] = 0.008; _p[2] = z + (hash(k * 9, p) - 0.5) * PD * 0.85;
        H.add(_p, 0.03, cNH4, 0.5 * (0.6 + 0.4 * Math.sin(t * 2 + k + p)) * UP.uPlot.value[p].z);
      }
    }
    if (sc && mlit > 0.01) for (let p = 0; p < 24; p++) {
      const s = clamp(UP.uPlot.value[p].y, 0, 1.2), n = Math.round(s * 6), [x, , z] = PXZ[p], top = 0.1 + 0.95 * s;
      for (let k = 0; k < n; k++) {
        const a = (t / (2.5 + hash(p, k)) + hash(k, p * 3)) % 1;
        _p[0] = x + (hash(p * 11, k) - 0.5) * PW * 0.7; _p[1] = 0.02 + a * top; _p[2] = z + (hash(k * 13, p) - 0.5) * PD * 0.7;
        H.add(_p, 0.025, mcol, 0.6 * (1 - a) * Math.min(1, a * 6));
      }
    }
    // the plumes: N2O rising from each jar, as high and dense as its curve says at this moment of the incubation
    if (jarsA > 0.01) {
      const tau = inc * 22;
      let k6 = 0;
      for (let ti = 0; ti < 5; ti++) {
        if (jday >= 0 && ti !== jday) continue;
        for (let fert = 0; fert < 3; fert++) for (let line = 0; line < 2; line++) {
          const v = ppm(ti, fert, line, tau), [x, z] = jarXZ(ti, fert, line, jday < 0), top = JH + 0.02 + 0.2 * v, n = Math.round(clamp(v, 0, 2.2) * 13) + (v > 0.02 ? 2 : 0);
          for (let k = 0; k < n; k++) {
            const a = (t / (2.2 + hash(k, ti * 6 + fert * 2 + line)) + hash(ti * 6 + fert * 2 + line, k)) % 1;
            _p[0] = x + 0.025 * Math.sin(t * 1.3 + k * 2.1) * a; _p[1] = JH + 0.01 + a * (top - JH); _p[2] = z + 0.02 * Math.cos(t * 1.1 + k * 1.7) * a;
            H.add(_p, 0.028 + 0.06 * a, cN2O, jarsA * 0.8 * (1 - a * a) * Math.min(1, a * 6));
          }
          if (jday >= 0 && k6 < 6) { const J = now.jar[k6++]; J.v = v; J.top[0] = x; J.top[1] = top + 0.02; J.top[2] = z; }
        }
      }
    }
    H.end();
  }
  // ------------------------------------------------------------------ picking: a ray to a plot
  const _r = new THREE.Ray(), _w = new THREE.Vector3(), _mi = new THREE.Matrix4();
  function pick(rc) {
    set.group.updateMatrixWorld();
    _mi.copy(set.group.matrixWorld).invert();
    _r.copy(rc.ray).applyMatrix4(_mi);
    if (Math.abs(_r.direction.y) < 1e-6) return null;
    const d = -_r.origin.y / _r.direction.y;
    if (d <= 0) return null;
    _r.at(d, _w);
    for (let p = 0; p < 24; p++) { const [x, , z] = PXZ[p]; if (Math.abs(_w.x - x) <= PW / 2 + GX / 2 && Math.abs(_w.z - z) <= PD / 2 + GZ / 2) { const { line, fert, rep } = SDATA.ofPlot(p); return { kind: 'plot', p, group: line * 3 + fert, line, fert, rep }; } }
    return null;
  }
  // ------------------------------------------------------------------ labels: the date, the regimes and lines, the plots'
  // values when a group is picked, the jars' ppm, the stack, a module
  const dateOf = () => TIMES[Math.round(clamp(now.date, 0, 4))];
  const fmt = (v, key) => (v === null || v === undefined ? '' : key === 'ph' ? v.toFixed(2) : key === 'n2o' ? v.toFixed(2) : v >= 100 ? Math.round(v).toString() : v.toFixed(1));
  const pickPlots = () => (now.pick < 0 ? [] : [0, 1, 2, 3].map(rep => SDATA.plot(Math.floor(now.pick / 3), now.pick % 3, rep)));
  function tagText(k) {
    const pl = pickPlots(), key = KEYS[clamp(now.show, 0, 4)], ti = Math.round(clamp(now.date, 0, 4));
    if (!pl.length) return ['', ''];
    const v = key === 'chl' && ti === 4 ? null : plotVal(key, pl[k], ti);
    return v === null ? ['', ''] : [fmt(v, key), UNIT[key]];
  }
  function sumText() {
    if (now.pick < 0) return ['', ''];
    const line = Math.floor(now.pick / 3), fert = now.pick % 3, key = KEYS[clamp(now.show, 0, 4)], ti = Math.round(clamp(now.date, 0, 4)), M = D.meta[key];
    const other = ['BNI', 'control'][1 - line], day = TIMES[ti].day;
    if (key === 'chl' && ti === 4) { const a = SDATA.chl70(fert, line).v, b = SDATA.chl70(fert, 1 - line).v; return [`${M.name}, day 70: about ${Math.round(a)}`, ` · ${other} about ${Math.round(b)}, read off the slides`]; }
    const tst = SDATA.lineTest(key, fert, ti), me = tst ? tst[line] : null, ot = tst ? tst[1 - line] : null;
    if (me === null || me === undefined) return [`${M.name}, day ${day}`, ' · not measured'];
    const p = tst[2] === null || tst[2] === undefined ? '' : `, p ${tst[2] < 0.001 ? '< 0.001' : tst[2].toFixed(2)}`;
    return [`${M.name}, day ${day}: ${fmt(me, key)}${UNIT[key]}`, ` · ${other} ${fmt(ot, key)}${p}${key === 'n2o' ? ' (unit not given)' : ''}`];
  }
  const plotTop = k => () => { const pl = pickPlots(), p = pl.length ? pl[k] : 0, [x, , z] = PXZ[p]; return [x, 0.3, z]; };
  const MODTXT = m => { const M = D.net.mods[m]; if (!M) return ['', '']; const r = M.r2, f = r.fert >= 0.5 ? 'follows the fertiliser' : r.plot >= 0.5 ? 'follows the plots' : r.time >= 0.5 ? 'follows the date' : 'mixed'; return [`Module ${m + 1}`, ` · ${M.n.toLocaleString('en-GB')} kinds, ${f}`]; };
  // (the net set names the module over the field; here only where it is strong)
  const MODPLOTS = m => (D.net.mods[m] ? [`Module ${m + 1} is strong here`, ' · its plots light up'] : ['', '']);
  const nothingElse = S => (1 - clamp(S.field_jars, 0, 1)) * (1 - prog(S.field_stack, 0, 0.3)) * (1 - prog(S.field_tags * (S.field_pick >= 0 ? 1 : 0), 0, 0.3)) * (1 - prog(S.field_mlit, 0, 0.3)) * (1 - prog(S.net_cloud || 0, 0, 0.3));
  // the regimes, pointed at in the front block (the BNI wheat's plot of each), and the two lines on the unfertilised pair
  const front = (line, fert) => () => { const [x, , z] = PXZ[SDATA.plot(line, fert, 3)]; return [x, 0.32, z + PD * 0.3]; };
  const labels = [
    { text: () => { const T = dateOf(); return [`Day ${T.day}`, ` · ${T.stage}`]; }, at: [-SX, NY + 0.06, -SZ], cls: '',
      alpha: S => prog(S.field_grow, 0.2, 0.5) * (1 - clamp(S.field_jars, 0, 1)) * (1 - prog(S.field_stack, 0, 0.3)) * (1 - prog(S.net_cloud || 0, 0, 0.3)) },
    { text: ['Not fertilised', ''], at: front(1, 0), cls: 'grn', minor: true, alpha: S => prog(S.field_grow, 0.1, 0.4) * nothingElse(S) * (1 - prog(S.field_chl, 0, 0.3)) },
    { text: ['Fertilised', ' · 250 kg N/ha'], at: front(1, 1), cls: 'mag', minor: true, alpha: S => prog(S.field_grow, 0.1, 0.4) * nothingElse(S) * (1 - prog(S.field_chl, 0, 0.3)) },
    { text: ['Fertilised + DCD', ' · an inhibitor'], at: front(1, 2), cls: 'amb', minor: true, alpha: S => prog(S.field_grow, 0.1, 0.4) * nothingElse(S) * (1 - prog(S.field_chl, 0, 0.3)) },
    { text: ['Munal-BNI', ''], at: 'bni', cls: 'cyn', alpha: S => prog(S.field_chl, 0.2, 0.6) * nothingElse(S) },
    { text: ['Munal-control', ''], at: 'ctrl', cls: 'amb', alpha: S => prog(S.field_chl, 0.2, 0.6) * nothingElse(S) },
    // a picked group: its four plots' values and the comparison
    ...[0, 1, 2, 3].map(k => ({ text: () => tagText(k), at: plotTop(k), cls: '', alpha: S => (S.field_pick >= 0 ? 1 : 0) * clamp(S.field_tags, 0, 1) * (1 - clamp(S.field_jars, 0, 1)) })),
    { text: sumText, at: 'pick', cls: 'cyn', alpha: S => (S.field_pick >= 0 ? 1 : 0) * clamp(S.field_tags, 0, 1) * (1 - clamp(S.field_jars, 0, 1)) },
    // the jars
    { text: () => { const ti = now.jday; return ti < 0 ? ['Soil from every date', ' · N2O read off the slides'] : [`Day ${TIMES[clamp(ti, 0, 4)].day} soil in jars`, ` · N2O on incubation day ${Math.round(now.inc * 22)} (read off the slides)`]; },
      at: [BX, 0.0, 0.52], cls: 'mag', alpha: S => prog(S.field_jars, 0.5, 1) },
    ...[0, 1, 2, 3, 4, 5].map(k => ({ text: () => [now.jar[k].v.toFixed(2), ' ppm'], at: () => now.jar[k].top.slice(), cls: '',
      alpha: S => prog(S.field_jars, 0.6, 1) * (Math.round(S.field_jday) >= 0 ? 1 : 0) * prog(S.field_inc, 0.02, 0.08) })),
    // the stack
    { text: ['119 samples', ' · 30 groups of 4, one missing'], at: 'stack', cls: 'cyn', alpha: S => prog(S.field_stack, 0.7, 1) },
    { text: ['Day 1', ' · bottom'], at: [-0.72, 0.12, -0.95], cls: '', minor: true, alpha: S => prog(S.field_stack, 0.8, 1) },
    { text: ['Day 70', ' · top'], at: [-0.72, 0.64, -0.95], cls: '', minor: true, alpha: S => prog(S.field_stack, 0.8, 1) },
    // a module on the field
    { text: () => (now.mod >= 0 ? MODPLOTS(now.mod) : ['', '']), at: 'lit', cls: 'cyn', alpha: S => prog(S.field_mlit, 0.4, 0.9) * (S.field_module >= 0 ? 1 : 0) },
  ];
  const anchors = {
    centre: [0, 0, 0], field: [0, 0.35, 0], net: [0, 0.42, 0], under: [0, -0.2, 0.45], jars: [BX, 0.12, 0], stack: [0, 0.75, -0.95],
    bni: () => { const [x, , z] = PXZ[SDATA.plot(0, 0, 3)]; return [x, 0.3, z]; }, ctrl: () => { const [x, , z] = PXZ[SDATA.plot(1, 0, 3)]; return [x, 0.3, z]; },
    cloud: [0, 1.3, 0],
    // the middle of the plots a module lights most (for its label)
    lit: () => { if (now.mod < 0) return [0, 0.3, 0.3]; const sc = scores(now.mod); let x = 0, z = 0, w = 0; for (let p = 0; p < 24; p++) { const v = Math.max(0, at(sc[p], now.date)); x += PXZ[p][0] * v; z += PXZ[p][2] * v; w += v; } return w > 0 ? [x / w, 0.36, z / w] : [0, 0.3, 0.3]; },
    pick: () => { const pl = pickPlots(); if (!pl.length) return [0, 0.45, 0]; let x = 0, z = 0; for (const p of pl) { x += PXZ[p][0] / 4; z += PXZ[p][2] / 4; } return [x, 0.45, z]; },
  };
  return Object.assign(set, {
    params: { field_a: 1, field_grow: 1, field_date: 0, field_net: 1, field_chl: 0, field_nh4: 0, field_no3: 0, field_jars: 0,
      field_jday: 0, field_inc: 0, field_cores: 0, field_stack: 0, field_module: -1, field_mlit: 0, field_pick: -1, field_tags: 0,
      field_show: 0, field_life: 0, field_line: -1, field_fert: -1 },
    log: [],
    update,
    anchors,
    labels,
    cam: {
      default: [-24, 30, 4.2, 0, 0.05, 0], low: [-18, 9, 2.6, 0, 0.12, 0.1], plots: [-30, 40, 2.4, 0, 0, 0],
      under: [-20, 4, 3.2, 0, -0.12, 0], jars: [52, 14, 1.75, 1.3, 0.17, 0], stack: [-15, 18, 3.4, 0, 0.45, -0.5],
      cloud: [-20, 12, 4.4, 0, 0.8, 0], stand: [0, 2, 0.6, 0, 0.15, 0.55],
    },
    controls: [
      { key: 'view', label: 'View', options: [['default', 'The field'], ['low', 'Among the wheat'], ['under', 'Under the field'], ['jars', 'The jars'], ['stack', 'The samples']] },
      { key: 'date', label: 'Date', options: [['0', 'Day 1'], ['1', 'Day 15'], ['2', 'Day 24'], ['3', 'Day 53'], ['4', 'Day 70']] },
      { key: 'show', label: 'Show', options: [['chl', 'Chlorophyll'], ['nh4', 'Ammonium'], ['no3', 'Nitrate'], ['n2o', 'N2O'], ['ph', 'pH']] },
      { key: 'line', label: 'Wheat', options: [['both', 'Both'], ['0', 'BNI wheat'], ['1', 'Control wheat']] },
      { key: 'fert', label: 'Regime', options: [['all', 'All'], ['0', 'Not fertilised'], ['1', 'Fertilised'], ['2', 'Fertilised + DCD']] },
    ],
    // the Field pane: the wheat at the date, coloured by its chlorophyll; ammonium or nitrate on the plots; the jars of
    // that date breathing from c.t (N2O); the cores stacking (The samples); a line and a regime picked light their plots
    // (both picked: that group's four plots get tags with the measure shown)
    explore(c) {
      const date = +c.date || 0, show = Math.max(0, ['chl', 'nh4', 'no3', 'n2o', 'ph'].indexOf(c.show)), line = c.line === 'both' || c.line === undefined ? -1 : +c.line;
      const fert = c.fert === 'all' || c.fert === undefined ? -1 : +c.fert, jars = c.view === 'jars' || c.show === 'n2o', stack = c.view === 'stack';
      return { field_grow: 1, field_date: date, field_net: c.view === 'low' || c.view === 'under' ? 0 : 1, field_chl: 1,
        field_no3: c.show === 'no3' || c.view === 'under' ? 1 : 0, field_nh4: c.show === 'nh4' ? 1 : 0,
        field_jars: jars ? 1 : 0, field_jday: date, field_inc: jars ? K.prog(c.t, 0.5, 6) : 0,
        field_cores: stack ? 1 : 0, field_stack: stack ? K.prog(c.t, 0.8, 3.5) : 0, field_tags: line >= 0 && fert >= 0 ? 1 : 0, field_show: show,
        field_line: line, field_fert: fert, field_pick: line >= 0 && fert >= 0 ? line * 3 + fert : -1 };
    },
    api() {
      return { plotXZ, order, pick, plotAt: p => PXZ[p].slice(), plot: p => PXZ[p].slice(), jar: i => { const J = now.jar[i]; return J ? J.top.slice() : null; },
        ppm, chlAt: (p, d) => at(CHL[p], d), value: (key, p, time) => plotVal(key, p, time), mod: m => MODTXT(m) };
    },
  });
};

// net: the soil's microbes as a deep cloud (20,000 kinds: the 3,384 common ones in a bright core, the rare ones a faint
// shell, coloured by phylum, each phylum a sector), the nitrifiers flaring, the co-occurrence network of 1,564 kinds and
// 22,348 links pulling out of the core, a shuffle dissolving it, its modules in colour, and the two wheat lines' networks
// side by side (and the three regimes', and a random split's). Drawn in the field set's frame, floating over the field.
// Real numbers from SOIL_DATA (SDATA); the cloud's places and the network's layout are a drawing.
// Adapted from the endotype story's net set (tools/endo/sets/net.js: the cloud with its core and shell, the glowing
// seeds, the module pulling out, the colours, the focus and picking), without its walkers, heat and k.
SETS.net = function (K) {
  const { THREE, smooth, clamp, prog } = K;
  const set = K.newSet('net');
  const D = SOIL_DATA, SD = SDATA, CL = SD.cloud, NT = SD.net, CM = SD.common;
  const C = [0, 1.3, 0], RC = 0.7, RN = 0.6;   // the cloud's centre (over the field) and radius; the network's radius
  const NCL = CL.n, NN = NT.n, NL = NT.links, NM = D.net.mods.length, NP = D.phyla.names.length, GK = D.guilds.keys;
  const R = K.rng(100116);
  const fmt = n => Math.round(n).toLocaleString('en-GB');

  // ---------------------------------------------------------------- who is who
  const nodeOf = new Int32Array(NCL).fill(-1), comOf = new Int32Array(NCL).fill(-1);
  for (let i = 0; i < NN; i++) nodeOf[NT.cloudOf(i)] = i;
  for (let c = 0; c < CM.n; c++) comOf[CM.idx[c]] = c;

  // ---------------------------------------------------------------- the cloud's places (a drawing)
  // Each phylum a sector of the sphere about the vertical (wider for phyla with more kinds in the cloud); the common
  // kinds in a core of radius 0.06 to 0.38 (the most abundant innermost), the rare ones in a shell from 0.42 to 0.7.
  const P = new Float32Array(3 * NCL), RAD = new Float32Array(NCL);
  {
    const cnt = new Float64Array(NP);
    for (let i = 0; i < NCL; i++) cnt[CL.phy[i]]++;
    const w = Array.from(cnt, c => Math.pow(c, 0.55)), W = w.reduce((s, x) => s + x, 0), a0 = [];
    let acc = 0;
    for (let p = 0; p < NP; p++) { a0.push(acc / W * Math.PI * 2); acc += w[p]; }
    let nc = 0, nr = 0;
    const NR = NCL - CM.n;
    for (let i = 0; i < NCL; i++) {
      const p = CL.phy[i], az = a0[p] + (0.06 + 0.88 * R()) * (w[p] / W) * Math.PI * 2, y = (2 * R() - 1) * 0.94, s = Math.sqrt(1 - y * y);
      let r;
      if (comOf[i] >= 0) r = 0.06 + 0.32 * Math.pow(nc++ / CM.n, 0.75);
      else r = 0.42 + 0.28 * Math.pow(nr++ / NR, 0.9);
      r = clamp(r + K.gauss(R) * 0.018, 0.02, RC);
      RAD[i] = r;
      P[3 * i] = C[0] + r * s * Math.sin(az); P[3 * i + 1] = C[1] + r * y; P[3 * i + 2] = C[2] + r * s * Math.cos(az);
    }
  }
  // the network's own layout (stored: linked kinds sit close, modules apart), scaled to radius RN round the centre; each
  // module spread out round its middle (the stored modules are tight balls, whose links between them drew thick bars:
  // still a drawing where linked kinds sit close)
  const LAY = new Float32Array(3 * NN);
  {
    const mc = Array.from({ length: NM }, () => [0, 0, 0, 0]);
    for (let i = 0; i < NN; i++) { const m = NT.mod[i]; if (m >= NM) continue; for (let a = 0; a < 3; a++) mc[m][a] += NT.xyz[3 * i + a]; mc[m][3]++; }
    for (const v of mc) for (let a = 0; a < 3; a++) v[a] /= v[3] || 1;
    for (let i = 0; i < NN; i++) {
      const m = NT.mod[i], c = m < NM ? mc[m] : null, f = !c ? 1 : c[3] >= 30 ? 1.85 : 1.4;
      for (let a = 0; a < 3; a++) { const x = NT.xyz[3 * i + a]; LAY[3 * i + a] = C[a] + RN * (c ? c[a] + (x - c[a]) * f : x); }
    }
  }
  // each kind leaves the core at its own moment as the network pulls out (the far travellers last)
  const ST = new Float32Array(NN);
  {
    let far = 0;
    const dd = new Float32Array(NN);
    for (let i = 0; i < NN; i++) { const c = 3 * NT.cloudOf(i); dd[i] = Math.hypot(LAY[3 * i] - P[c], LAY[3 * i + 1] - P[c + 1], LAY[3 * i + 2] - P[c + 2]); far = Math.max(far, dd[i]); }
    for (let i = 0; i < NN; i++) ST[i] = 0.3 * dd[i] / far + 0.08 * R();
  }
  // a direction for each kind to scatter in while the samples are shuffled
  const SC = new Float32Array(3 * NN);
  for (let i = 0; i < NN; i++) SC.set(K.unit(R), 3 * i);
  // per node: its strongest link (the threshold leaves a node lit while it keeps one), and the halves whose own network
  // keeps one of its links (bits, as the links')
  const MINI = new Float32Array(NN).fill(1e9), NBIT = new Uint8Array(NN);
  for (let e = 0; e < NL; e++) for (const n of [NT.ij[2 * e], NT.ij[2 * e + 1]]) { if (e < MINI[n]) MINI[n] = e; NBIT[n] |= NT.split[e]; }
  // how crowded each node's surroundings are in the layout: the middle of a module would burn out to white, so points and
  // links dim with the crowd (as the endotype story's)
  const CROWD = (() => {
    const G = 40, H = G / 2, cs = 0.06, cnt = new Uint16Array(G * G * G), cell = new Int32Array(3 * NN), out = new Float32Array(NN);
    const c = (x, a) => clamp(Math.floor((x - C[a]) / cs) + H, 0, G - 1);
    for (let i = 0; i < NN; i++) { for (let a = 0; a < 3; a++) cell[3 * i + a] = c(LAY[3 * i + a], a); cnt[(cell[3 * i] * G + cell[3 * i + 1]) * G + cell[3 * i + 2]]++; }
    for (let i = 0; i < NN; i++) {
      let s = 0;
      for (let a = Math.max(0, cell[3 * i] - 1); a <= Math.min(G - 1, cell[3 * i] + 1); a++) for (let b = Math.max(0, cell[3 * i + 1] - 1); b <= Math.min(G - 1, cell[3 * i + 1] + 1); b++)
        for (let d = Math.max(0, cell[3 * i + 2] - 1); d <= Math.min(G - 1, cell[3 * i + 2] + 1); d++) s += cnt[(a * G + b) * G + d];
      out[i] = s;
    }
    return out;
  })();
  const dimP = d => Math.pow(10 / Math.max(10, d), 0.5), dimL = d => Math.pow(10 / Math.max(10, d), 0.7);
  // modules' middles in the layout
  const MCTR = Array.from({ length: NM }, () => [0, 0, 0]), MTOP = new Float32Array(NM).fill(-9);
  { const n = new Float64Array(NM); for (let i = 0; i < NN; i++) { const m = NT.mod[i]; if (m >= NM) continue; n[m]++; for (let a = 0; a < 3; a++) MCTR[m][a] += LAY[3 * i + a]; MTOP[m] = Math.max(MTOP[m], LAY[3 * i + 1]); }
    for (let m = 0; m < NM; m++) if (n[m]) for (let a = 0; a < 3; a++) MCTR[m][a] /= n[m]; }

  // ---------------------------------------------------------------- shared uniforms and GLSL
  const col3 = (arr, list) => { list.forEach((c, i) => arr.set(K.rgb(c), 3 * i)); return arr; };
  const U = {
    uCloud: { value: 1 }, uNitro: { value: 0 }, uPull: { value: 0 }, uLinks: { value: 0 }, uCut: { value: NL }, uShuf: { value: 0 },
    uMods: { value: 0 }, uFocus: { value: -1 }, uFocusOn: { value: 0 }, uSplit: { value: 0 }, uKindN: { value: -1 }, uKindC: { value: -1 }, uKindOn: { value: 0 },
    uCtr: { value: new THREE.Vector3(C[0], C[1], C[2]) },
    uModCol: { value: col3(new Float32Array(3 * NM), Array.from({ length: NM }, (_, m) => SLOOK.module(m))) },
    uPhyCol: { value: col3(new Float32Array(3 * NP), D.phyla.names.map((n, i) => SLOOK.phylum(n, i))) },
    uGuildCol: { value: col3(new Float32Array(18), ['#8e98ab', ...GK.map(k => SLOOK.GUILD[k])]) },
    uPos: { value: new THREE.Color(SLOOK.LINK.pos) }, uNeg: { value: new THREE.Color(SLOOK.LINK.neg) },
  };
  const LOOK = `
uniform float uCloud, uNitro, uPull, uLinks, uCut, uShuf, uMods, uFocus, uFocusOn, uSplit, uKindN, uKindC, uKindOn;
uniform vec3 uCtr, uModCol[${NM}], uPhyCol[${NP}], uGuildCol[6], uPos, uNeg;
// one copy of the network (split: side by side): its offset, size, which half's bit it keeps (-1 all) and its fade
uniform vec3 uOff; uniform float uSc, uBitL, uCA;
vec3 modCol(float m) { return m > ${NM - 1}.5 ? vec3(0.45, 0.5, 0.6) : uModCol[int(m + 0.5)]; }
vec3 phyCol(float p) { return uPhyCol[int(clamp(p, 0.0, ${NP - 1}.0) + 0.5)]; }
vec3 guildCol(float g) { return uGuildCol[int(clamp(g, 0.0, 5.0) + 0.5)]; }
float bitAt(float m, float l) { return l < -0.5 ? 1.0 : mod(floor(m / exp2(l) + 0.001), 2.0); }
// a kind of the network on its way out of the core: eased (st: its start), with a sideways bow about the vertical, to its
// place in this copy; scattered a little while the samples are shuffled
vec3 morph(vec3 cl, vec3 lay, float st, vec3 sc) {
  float e = clamp((uPull - st) / 0.6, 0.0, 1.0); e = e * e * (3.0 - 2.0 * e);
  vec3 q = uCtr + (lay - uCtr) * uSc + uOff, d = q - cl;
  return cl + d * e + vec3(-d.z, 0.0, d.x) * (0.3 * sin(3.14159265 * e)) + sc * (0.07 * uShuf * e);
}
// brighter in front of the set's middle, darker behind (depth)
float depthCue(vec4 mv) { vec4 o = modelViewMatrix * vec4(uCtr, 1.0); float s = length(modelViewMatrix[0].xyz); return clamp(1.0 - (o.z - mv.z) / s * 0.5, 0.45, 1.35); }
`;
  const copyU = () => ({ uOff: { value: new THREE.Vector3() }, uSc: { value: 1 }, uBitL: { value: -1 }, uCA: { value: 1 } });
  const mat = (vs, fs, own) => {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U, own || copyU()),
      vertexShader: K.GLSL + LOOK + vs, fragmentShader: fs,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    set.mats.push(m);
    return m;
  };
  const attr = (g, name, arr, n) => g.setAttribute(name, new THREE.BufferAttribute(arr, n));
  const BS = new THREE.Sphere(new THREE.Vector3(C[0], C[1], C[2]), 2.2);
  const GLOW_FS = `
varying vec3 vC; varying float vA, vHot;
void main() {
  vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.62, 0.12, d), halo = pow(1.0 - d, 2.0);
  gl_FragColor = vec4(vC * (0.6 + 0.55 * core) + vec3(0.95) * vHot * smoothstep(0.45, 0.0, d), vA * (core * 0.75 + halo * (0.45 + 0.35 * vHot)));
}`;

  // ---------------------------------------------------------------- the cloud: every kind not in the network
  const CN = NCL - NN, cIdx = new Int32Array(CN);
  { let k = 0; for (let i = 0; i < NCL; i++) if (nodeOf[i] < 0) cIdx[k++] = i; }
  const cloudGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(3 * CN), I = new Float32Array(4 * CN), Q = new Float32Array(4 * CN);
    const [a0, a1] = D.cloud.abRange;
    for (let k = 0; k < CN; k++) {
      const i = cIdx[k], com = comOf[i] >= 0, ab = clamp((CL.ab[i] - a0) / (a1 - a0), 0, 1);
      pos.set(P.subarray(3 * i, 3 * i + 3), 3 * k);
      I[4 * k] = CL.phy[i]; I[4 * k + 1] = CL.guild[i]; I[4 * k + 2] = com ? 1 : 0; I[4 * k + 3] = i;
      Q[4 * k] = com ? 0.011 + 0.016 * ab * ab : 0.0065 + 0.004 * ab; Q[4 * k + 1] = RAD[i] / RC; Q[4 * k + 2] = R(); Q[4 * k + 3] = 0.72 + 0.25 * RAD[i] / RC;
    }
    attr(cloudGeo, 'position', pos, 3); attr(cloudGeo, 'aI', I, 4); attr(cloudGeo, 'aQ', Q, 4);
    cloudGeo.boundingSphere = BS;
  }
  const cloudMat = mat(`
attribute vec4 aI, aQ;
uniform float uA; varying vec3 vC; varying float vA, vHot;
void main() {
  float com = aI.z, gu = aI.y, isG = step(0.5, gu), rv = aQ.y;
  vec3 c = phyCol(aI.x) * mix(0.62, 1.0, com);
  float sz = aQ.x, br = mix(0.42, 1.0, com);
  // the nitrifiers flare in their guild's colour, the rest steps back
  c = mix(c, guildCol(gu) * 1.3, uNitro * isG); sz *= 1.0 + 1.6 * uNitro * isG; br *= mix(1.0, mix(0.3, 1.6, isG), uNitro);
  // as the network pulls out, the rest of the cloud recedes to a faint shell round it (and fades as the network splits)
  vec3 d = position - uCtr; float r = length(d);
  vec3 pos = uCtr + d * (mix(r, aQ.w, uPull) / max(r, 1e-4));
  br *= mix(1.0, 0.32, uPull) * (1.0 - 0.85 * uSplit) * (1.0 - 0.4 * uFocusOn);
  // the picked kind
  float me = uKindOn * (1.0 - step(0.5, abs(aI.w - uKindC)));
  c = mix(c, vec3(1.0), me * 0.6); sz *= 1.0 + 1.5 * me; br = max(br, me);
  br *= 1.0 - 0.6 * uKindOn * (1.0 - me);
  // the cloud appears from the centre outwards, with a bright front; a slow twinkle
  float u = uCloud * 1.05, ap = smoothstep(rv, rv + 0.035, u), fl = uCloud < 0.999 ? exp(-pow((u - rv - 0.025) / 0.03, 2.0)) : 0.0;
  br *= (0.84 + 0.16 * sin(uTime * 1.3 + aQ.z * 6.2832)) * (1.0 + 1.6 * fl);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(sz * ap * (1.0 + 0.8 * fl), mv);
  vC = c * br * depthCue(mv); vHot = me;
  vA = uA * ap;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, GLOW_FS);
  const cloud = new THREE.Points(cloudGeo, cloudMat);
  cloud.renderOrder = 2; set.group.add(cloud);

  // ---------------------------------------------------------------- the network's kinds (three copies for the split)
  const NB = new Float32Array(NN);   // 1: a neighbour of the picked kind
  const nodeGeo = new THREE.BufferGeometry();
  {
    const cl = new Float32Array(3 * NN), I = new Float32Array(4 * NN), Q = new Float32Array(4 * NN);
    const [a0, a1] = D.cloud.abRange;
    for (let i = 0; i < NN; i++) {
      const c = NT.cloudOf(i), ab = clamp((CL.ab[c] - a0) / (a1 - a0), 0, 1);
      cl.set(P.subarray(3 * c, 3 * c + 3), 3 * i);
      I[4 * i] = i; I[4 * i + 1] = NT.mod[i] === 255 ? NM : NT.mod[i]; I[4 * i + 2] = CL.phy[c]; I[4 * i + 3] = CL.guild[c];
      Q[4 * i] = (0.012 + 0.016 * ab * ab) * (1 + 0.25 * Math.min(1, NT.deg[i] / 60)); Q[4 * i + 1] = ST[i]; Q[4 * i + 2] = MINI[i]; Q[4 * i + 3] = NBIT[i];
    }
    const B = new Float32Array(NN); for (let i = 0; i < NN; i++) B[i] = dimP(CROWD[i]);
    attr(nodeGeo, 'position', LAY, 3); attr(nodeGeo, 'aCl', cl, 3); attr(nodeGeo, 'aI', I, 4); attr(nodeGeo, 'aQ', Q, 4); attr(nodeGeo, 'aSc', SC, 3);
    attr(nodeGeo, 'aB', B, 1); attr(nodeGeo, 'aNb', NB, 1);
    nodeGeo.boundingSphere = BS;
  }
  const NODE_VS = `
attribute vec3 aCl, aSc; attribute vec4 aI, aQ; attribute float aB, aNb;
uniform float uA; varying vec3 vC; varying float vA, vHot;
void main() {
  float id = aI.x, m = aI.y, gu = aI.w, isG = step(0.5, gu);
  vec3 pos = morph(aCl, position, aQ.y, aSc);
  float e = clamp((uPull - aQ.y) / 0.6, 0.0, 1.0);
  vec3 c = phyCol(aI.z);
  float sz = aQ.x, br = 1.0, hi = 0.0;
  c = mix(c, guildCol(gu) * 1.3, uNitro * isG); sz *= 1.0 + 1.6 * uNitro * isG; br *= mix(1.0, mix(0.3, 1.6, isG), uNitro * (1.0 - uPull));
  // modules: each kind in its module's colour; one module in focus, the rest dims
  c = mix(c, modCol(m) * 1.2, uMods);
  float fw = 1.0 - step(0.5, abs(m - uFocus));
  br *= mix(1.0, 0.1 + 0.9 * fw, uFocusOn); sz *= 1.0 + 0.4 * fw * uFocusOn; hi = max(hi, fw * uFocusOn);
  // the threshold: a kind left without a link dims; a split copy: a kind whose half keeps none of its links goes
  float keep = clamp(uCut - aQ.z, 0.0, 1.0) * bitAt(aQ.w, uBitL);
  br *= mix(1.0, mix(0.12, 1.0, keep), uLinks * e);
  // the picked kind and its neighbours
  float me = uKindOn * (1.0 - step(0.5, abs(id - uKindN))), nb = uKindOn * aNb;
  c = mix(c, vec3(0.45, 0.92, 1.0), nb * 0.7 * (1.0 - me)); c = mix(c, vec3(1.0), me * 0.6);
  sz *= 1.0 + 1.5 * me + 0.4 * nb; hi = max(hi, max(me, nb));
  br *= 1.0 - 0.7 * uKindOn * (1.0 - hi);
  // crowded middles dim (less where something is lit); in the cloud the kinds take its look
  br *= mix(1.0, mix(aB, 1.0, hi * 0.6), uPull);
  float rv = length(aCl - uCtr) / ${RC.toFixed(2)}, u = uCloud * 1.05, ap = smoothstep(rv, rv + 0.035, u);
  br *= 0.86 + 0.14 * sin(uTime * 1.3 + id * 0.73);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(sz * ap, mv);
  vC = c * br * depthCue(mv); vHot = me;
  vA = uA * uCA * ap;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  // ---------------------------------------------------------------- the links (three copies for the split)
  const linkGeo = new THREE.BufferGeometry();
  {
    const n = 2 * NL, pos = new Float32Array(3 * n), cl = new Float32Array(3 * n), E = new Float32Array(4 * n), Nn = new Float32Array(4 * n), sc = new Float32Array(3 * n);
    for (let e = 0; e < NL; e++) {
      const a = NT.ij[2 * e], b = NT.ij[2 * e + 1], ma = NT.mod[a], mb = NT.mod[b];
      const len = Math.hypot(LAY[3 * a] - LAY[3 * b], LAY[3 * a + 1] - LAY[3 * b + 1], LAY[3 * a + 2] - LAY[3 * b + 2]);
      const al = (ma === mb ? 0.05 + 0.2 / (1 + (len / 0.1) ** 2) : 0.016 + 0.06 / (1 + (len / 0.1) ** 2)) * dimL(0.5 * (CROWD[a] + CROWD[b])) * (0.55 + 0.6 * (Math.abs(NT.rho[e]) - 0.6) / 0.4);
      for (let j = 0; j < 2; j++) {
        const s = j ? b : a, o = j ? a : b, v = 2 * e + j, ca = 3 * NT.cloudOf(s);
        pos.set(LAY.subarray(3 * s, 3 * s + 3), 3 * v); cl.set(P.subarray(ca, ca + 3), 3 * v); sc.set(SC.subarray(3 * s, 3 * s + 3), 3 * v);
        E[4 * v] = e; E[4 * v + 1] = NT.rho[e]; E[4 * v + 2] = NT.split[e]; E[4 * v + 3] = ma === mb && ma !== 255 ? ma : NM;
        Nn[4 * v] = s; Nn[4 * v + 1] = o; Nn[4 * v + 2] = ST[s]; Nn[4 * v + 3] = al;
      }
    }
    attr(linkGeo, 'position', pos, 3); attr(linkGeo, 'aCl', cl, 3); attr(linkGeo, 'aE', E, 4); attr(linkGeo, 'aN', Nn, 4); attr(linkGeo, 'aSc', sc, 3);
    linkGeo.boundingSphere = BS;
  }
  const LINK_VS = `
attribute vec3 aCl, aSc; attribute vec4 aE, aN;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  float idx = aE.x, rho = aE.y, m = aE.w;
  vec3 pos = morph(aCl, position, aN.z, aSc);
  // a link shivers while the samples are shuffled
  pos += vec3(sin(uTime * 37.0 + idx), cos(uTime * 41.0 + idx * 1.7), sin(uTime * 29.0 + idx * 2.3)) * 0.012 * uShuf;
  vec3 c = rho > 0.0 ? uPos : uNeg;
  float a = aN.w * (rho > 0.0 ? 1.0 : 0.7), hi = 0.0;
  // modules: a link inside one in its colour; one between two steps back
  float inside = 1.0 - step(${NM - 0.5}, m);
  c = mix(c, mix(vec3(0.5, 0.56, 0.68), modCol(m) * 1.1, inside), uMods); a *= mix(1.0, 0.3 + 0.9 * inside, uMods);
  float fw = inside * (1.0 - step(0.5, abs(m - uFocus)));
  a *= mix(1.0, 0.06 + 1.4 * fw, uFocusOn); hi = max(hi, fw * uFocusOn);
  // the picked kind's links
  float mine = uKindOn * max(1.0 - step(0.5, abs(aN.x - uKindN)), 1.0 - step(0.5, abs(aN.y - uKindN)));
  c = mix(c, vec3(0.55, 0.95, 1.0), mine); a *= mix(1.0, 0.1 + 4.0 * mine, uKindOn);
  // the threshold (the strongest first: a link shows while its rank is under the cut), the half this copy keeps, the
  // shuffle that leaves none
  a *= clamp(uCut - idx, 0.0, 1.0) * bitAt(aE.z, uBitL) * (1.0 - smoothstep(0.1, 0.75, uShuf));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vC = c * depthCue(mv); vA = uA * uCA * uLinks * a * clamp((uPull - aN.z - 0.35) / 0.4, 0.0, 1.0);
}`;
  const LINK_FS = `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.002) discard; gl_FragColor = vec4(vC, vA); }`;
  const copies = [0, 1, 2].map(k => {
    const own = copyU();
    const nodes = new THREE.Points(nodeGeo, mat(NODE_VS, GLOW_FS, own));
    const links = new THREE.LineSegments(linkGeo, mat(LINK_VS, LINK_FS, own));
    nodes.renderOrder = 3; links.renderOrder = 1;
    set.group.add(links, nodes);
    if (k) nodes.visible = links.visible = false;
    return { u: own, nodes, links };
  });

  // ---------------------------------------------------------------- depth: a haze of big faint sprites and soft glow shells
  {
    const n = 260, g = new THREE.BufferGeometry(), pos = new Float32Array(3 * n), h = new Float32Array(4 * n);
    for (let k = 0; k < n; k++) {
      const i = k < 120 ? CM.idx[Math.floor(R() * CM.n)] : Math.floor(R() * NCL);
      for (let a = 0; a < 3; a++) pos[3 * k + a] = P[3 * i + a] + K.gauss(R) * 0.03;
      h[4 * k] = RAD[i] / RC; h[4 * k + 1] = (k < 120 ? 0.14 : 0.2) + 0.1 * R(); h[4 * k + 2] = k < 120 ? 1 : 0; h[4 * k + 3] = k < 120 ? 0.05 : 0.03;
    }
    attr(g, 'position', pos, 3); attr(g, 'aH', h, 4);
    g.boundingSphere = BS;
    const m = mat(`
attribute vec4 aH;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aH.y, mv);
  vC = mix(vec3(0.42, 0.5, 0.36), vec3(0.62, 0.78, 0.42), aH.z);
  vA = uA * aH.w * smoothstep(aH.x, aH.x + 0.12, uCloud * 1.05) * (1.0 - 0.7 * uPull) * (1.0 - 0.5 * uNitro) * (1.0 - uSplit);
  if (vA < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA;
void main() { vec2 q = gl_PointCoord - 0.5; float d2 = dot(q, q) * 4.0; if (d2 > 1.0) discard; gl_FragColor = vec4(vC, vA * exp(-d2 * 3.5) * (1.0 - d2)); }`);
    const pts = new THREE.Points(g, m); pts.renderOrder = 0; set.group.add(pts);
  }
  const glowMat = mat(`
uniform float uA; varying vec3 vN, vW;
void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, `
uniform float uA, uCloud, uPull, uSplit; varying vec3 vN, vW;
void main() {
  float f = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  float a = pow(f, 3.0) * uA * smoothstep(0.0, 0.45, uCloud) * (1.0 - 0.6 * uPull) * (1.0 - uSplit);
  gl_FragColor = vec4(mix(vec3(0.5, 0.62, 0.38), vec3(0.88, 0.95, 0.8), f * f), a * 0.05);
}`);
  {
    const sg = new THREE.SphereGeometry(1, 28, 18);
    for (const r of [0.3, 0.72]) { const m = new THREE.Mesh(sg, glowMat); m.scale.setScalar(r); m.position.set(C[0], C[1], C[2]); m.renderOrder = 0; set.group.add(m); }
  }
  // the picked kind's bubble
  const bubMat = K.rim(set, { color: '#46d9ff', a0: 0.04, a1: 0.65 });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), bubMat);
  bubble.renderOrder = 6; bubble.visible = false; set.group.add(bubble);

  // ---------------------------------------------------------------- the split's copies: offsets and sizes
  // 0 by wheat line (two copies: BNI left, control right), 1 by fertiliser (three: not fertilised, fertilised, + DCD),
  // 2 at random (two: half A, half B); copy k keeps the links whose bit (SOIL_DATA.net.splitBits) its half has
  const BIT = { BNI: 0, Ctrl: 1, N: 2, F: 3, S: 4, randomA: 5, randomB: 6 };
  const SPLITS = [
    { n: 2, bits: [BIT.BNI, BIT.Ctrl], x: [-0.6, 0.6], s: 0.72 },
    { n: 3, bits: [BIT.N, BIT.F, BIT.S], x: [-0.8, 0, 0.8], s: 0.55 },
    { n: 2, bits: [BIT.randomA, BIT.randomB], x: [-0.6, 0.6], s: 0.72 },
  ];
  // where copy k of split `by` stands at split amount f (into out); copy 0 is the whole network when f is 0
  function copyPose(by, k, f, out) {
    const sp = SPLITS[by] || SPLITS[0];
    out.x = k < sp.n ? sp.x[k] * f : 0; out.s = 1 + (sp.s - 1) * f; out.bit = f > 0.002 && k < sp.n ? sp.bits[k] : -1;
    out.a = k === 0 ? 1 : k < sp.n ? prog(f, 0.15, 0.7) : 0;
    return out;
  }
  const _cp = { x: 0, s: 1, bit: -1, a: 1 };

  // ---------------------------------------------------------------- the picked kind
  let kindC = -2;
  function setKind(c) {
    kindC = c;
    NB.fill(0);
    const n = c >= 0 ? nodeOf[c] : -1;
    if (n >= 0) for (let e = 0; e < NL; e++) { const a = NT.ij[2 * e], b = NT.ij[2 * e + 1]; if (a === n) NB[b] = 1; else if (b === n) NB[a] = 1; }
    nodeGeo.attributes.aNb.needsUpdate = true;
  }

  // ---------------------------------------------------------------- update
  const cur = { pull: 0, shuf: 0, split: 0, by: 0, kind: -1, focus: -1, cut: NL, nitro: 0, mods: 0, links: 0, cloud: 1, rho: 0.6 };
  const _p = [0, 0, 0];
  let lastRho = -1, cutNow = NL;
  function update(S) {
    const cl = clamp(S.net_cloud, 0, 1), pull = clamp(S.net_pull, 0, 1), sp = clamp(S.net_split, 0, 1), by = clamp(Math.round(S.net_splitBy || 0), 0, 2);
    const fo = S.net_focus >= -0.5 ? Math.round(S.net_focus) : -1, kc = S.net_kind >= -0.5 ? Math.round(S.net_kind) : -1, rho = clamp(S.net_rho || 0.6, 0.6, 0.8);
    Object.assign(cur, { pull, shuf: clamp(S.net_shuffle, 0, 1), split: sp, by, focus: fo >= 0 && fo < NM ? fo : -1, kind: kc >= 0 && kc < NCL ? kc : -1,
      nitro: clamp(S.net_nitro, 0, 1), mods: clamp(S.net_mods, 0, 1), links: clamp(S.net_links, 0, 1), cloud: cl, rho });
    if (rho !== lastRho) { lastRho = rho; cutNow = NT.cut(rho); }
    cur.cut = cutNow;
    if (cur.kind !== kindC) setKind(cur.kind);
    U.uCloud.value = cl; U.uNitro.value = cur.nitro; U.uPull.value = pull; U.uLinks.value = cur.links; U.uCut.value = cur.cut; U.uShuf.value = cur.shuf;
    U.uMods.value = cur.mods; U.uFocus.value = cur.focus; U.uFocusOn.value = cur.focus >= 0 ? 1 : 0; U.uSplit.value = sp;
    const kn = cur.kind >= 0 ? nodeOf[cur.kind] : -1;
    U.uKindN.value = kn; U.uKindC.value = kn >= 0 ? -1 : cur.kind; U.uKindOn.value = cur.kind >= 0 ? 1 : 0;
    for (let k = 0; k < 3; k++) {
      const c = copies[k], p = copyPose(by, k, sp, _cp);
      c.u.uOff.value.set(p.x, 0, 0); c.u.uSc.value = p.s; c.u.uBitL.value = p.bit; c.u.uCA.value = p.a;
      c.nodes.visible = c.links.visible = p.a > 0.003;
    }
    bubble.visible = cur.kind >= 0;
    if (bubble.visible) { posOf(cur.kind, _p); bubble.position.set(_p[0], _p[1], _p[2]); bubble.scale.setScalar(0.035); bubMat.uniforms.uK.value = cl; }
  }

  // ---------------------------------------------------------------- places (the shaders' morph, mirrored) and anchors
  // where cloud kind c is now (into out): a network kind on its way to copy 0's place, the rest receding with the pull
  function posOf(c, out) {
    const n = nodeOf[c];
    if (n < 0) {
      const r = RAD[c], d = Math.max(r, 1e-4), to = r + (0.72 + 0.25 * r / RC - r) * cur.pull;
      for (let a = 0; a < 3; a++) out[a] = C[a] + (P[3 * c + a] - C[a]) * to / d;
      return out;
    }
    const p = copyPose(cur.by, 0, cur.split, _cp), e = smooth((cur.pull - ST[n]) / 0.6), c3 = 3 * c;
    const q0 = C[0] + (LAY[3 * n] - C[0]) * p.s + p.x, q1 = C[1] + (LAY[3 * n + 1] - C[1]) * p.s, q2 = C[2] + (LAY[3 * n + 2] - C[2]) * p.s;
    const dx = q0 - P[c3], dy = q1 - P[c3 + 1], dz = q2 - P[c3 + 2], b = 0.3 * Math.sin(Math.PI * e);
    out[0] = P[c3] + dx * e - dz * b; out[1] = P[c3 + 1] + dy * e; out[2] = P[c3 + 2] + dz * e + dx * b;
    return out;
  }
  const own = f => { const o = [0, 0, 0]; return () => f(o); };
  // a module's middle (in copy 0, as it stands), and its top
  const modAt = (m, top, o) => {
    const p = copyPose(cur.by, 0, cur.split, _cp), M = MCTR[m] || C;
    o[0] = C[0] + (M[0] - C[0]) * p.s + p.x; o[1] = C[1] + ((top ? MTOP[m] + 0.04 : M[1]) - C[1]) * p.s; o[2] = C[2] + (M[2] - C[2]) * p.s;
    return o;
  };
  const copyTopAt = (k, o) => { const p = copyPose(cur.by, k, cur.split, _cp); o[0] = C[0] + p.x; o[1] = C[1] + RN * p.s * 1.02; o[2] = C[2]; return o; };
  const copyTop = k => own(o => copyTopAt(k, o));
  // each guild's tag hangs on its most abundant kind in the cloud
  // (among its 40 most abundant kinds, the one farthest from the tags placed before, so the five tags spread round the
  // cloud; the most abundant itself for the first)
  const GTOP = [];
  GK.forEach((_, g) => {
    const cand = [];
    for (let i = 0; i < NCL && cand.length < 40; i++) if (CL.guild[i] === g + 1) cand.push(i);
    let best = cand[0] || 0, bd = -1;
    if (GTOP.length) for (const c of cand) {
      let d = Infinity;
      for (const o of GTOP) d = Math.min(d, Math.hypot(P[3 * c] - P[3 * o], P[3 * c + 1] - P[3 * o + 1], P[3 * c + 2] - P[3 * o + 2]));
      if (d > bd) { bd = d; best = c; }
    }
    GTOP.push(best);
  });
  const anchors = {
    cloud: [C[0] + 0.32, C[1] + 0.62, C[2] + 0.18], core: [C[0] + 0.12, C[1] + 0.2, C[2] + 0.1], top: [C[0], C[1] + 0.72, C[2]],
    net: [C[0], C[1], C[2]], netTop: [C[0] - 0.1, C[1] + 0.66, C[2] + 0.1], under: [C[0], C[1] - 0.68, C[2]],
    left: copyTop(0), mid: copyTop(1), right: own(o => copyTopAt(SPLITS[cur.by].n - 1, o)),
    pick: own(o => (cur.kind >= 0 ? posOf(cur.kind, o) : (o[0] = C[0], o[1] = C[1], o[2] = C[2], o))),
    module: m => modAt(m, false, [0, 0, 0]),
  };
  GK.forEach((k, g) => { anchors['g_' + k] = own(o => posOf(GTOP[g], o)); });
  for (let m = 0; m < NM; m++) anchors['m' + m] = own(o => modAt(m, true, o));
  for (let k = 0; k < 3; k++) anchors['copy' + k] = copyTop(k);

  // ---------------------------------------------------------------- labels (the set's own, by its params)
  const mods = D.net.mods, big = mods.map((m, i) => i).filter(i => mods[i].n >= 100);
  const WHAT = { fert: 'the fertiliser', time: 'the date', line: 'the wheat line', plot: 'the plots' };
  const follows = m => { const r = mods[m].r2; let best = 'fert'; for (const k in WHAT) if (r[k] > r[best]) best = k; return WHAT[best]; };
  const sp = D.net.splits, kinds100k = Math.round(D.src.kinds / 1000) * 1000;
  const quiet = S => (1 - clamp(S.net_split, 0, 1)) * (1 - clamp(S.net_shuffle, 0, 1));
  const kindOn = () => (cur.kind >= 0 ? 1 : 0);
  const SPLIT_TAGS = [
    [['BNI wheat', sp.line[0]], ['Control wheat', sp.line[1]]],
    [['Not fertilised', sp.fert[0]], ['Fertilised', sp.fert[1]], ['Fertilised + DCD', sp.fert[2]]],
    [['Random half A', { links: sp.random[0][0] }], ['Random half B', { links: sp.random[0][1] }]],
  ];
  const nodesAt = () => { let n = 0; for (let i = 0; i < NN; i++) if (MINI[i] < cur.cut) n++; return n; };
  const labels = [
    { text: [`About ${fmt(kinds100k)} kinds`, ' · of microbe in this soil'], cls: 'cyn', at: 'cloud',
      alpha: S => prog(S.net_cloud, 0.6, 1) * (1 - clamp(S.net_pull, 0, 1) * 2) * (1 - clamp(S.net_nitro, 0, 1)) * (1 - kindOn()) },
    { text: [`${fmt(CM.n)} common kinds`, ` · ${Math.round(100 * D.common.readShare)} % of the reads`], cls: 'amb', at: 'core', minor: false,
      alpha: S => prog(S.net_cloud, 0.8, 1) * (1 - clamp(S.net_pull, 0, 1) * 2) * (1 - clamp(S.net_nitro, 0, 1)) * (1 - kindOn()) },
    ...GK.map((k, g) => {
      const G = D.guilds[k], bf = G.byFert;
      const rest = k === 'nsp' ? ` · ${bf[0].toFixed(2)} % of reads, ${bf[1].toFixed(2)} % with fertiliser` : k === 'mnd' ? ` · ${fmt(G.kinds)} kinds · role unknown`
        : k === 'aoa' ? ` · ${fmt(G.kinds)} kinds · ${G.share.toFixed(1)} % of reads` : ` · ${fmt(G.kinds)} kinds · ${G.share.toFixed(2)} %`;
      return { text: [G.name, rest], cls: k === 'aoa' ? 'mag' : k === 'nit' ? 'cyn' : k === 'mnd' ? '' : 'amb', at: 'g_' + k, minor: k === 'nsm' || k === 'mnd',
        alpha: S => prog(S.net_nitro, 0.5, 1) * (1 - clamp(S.net_pull, 0, 1)) * (1 - kindOn()) };
    }),
    { text: () => [`${fmt(nodesAt())} kinds`, ` · ${fmt(cur.cut)} links`], cls: 'cyn', at: 'netTop',
      alpha: S => prog(S.net_links, 0.5, 1) * (1 - clamp(S.net_mods, 0, 1)) * quiet(S) * (1 - kindOn()) },
    { text: ['Shuffled', ' · not one link is left'], cls: 'amb', at: 'netTop', alpha: S => prog(S.net_shuffle, 0.55, 0.9) * prog(S.net_links, 0.5, 1) },
    ...big.map(m => ({ text: [`${fmt(mods[m].n)} kinds`, ` · follow ${follows(m)}`], cls: '', at: 'm' + m,
      alpha: S => prog(S.net_mods, 0.5, 1) * quiet(S) * (cur.focus < 0 || cur.focus === m ? 1 : 0) * (1 - kindOn()) })),
    // a small module in focus has its tag too
    ...mods.map((M, m) => m).filter(m => mods[m].n < 100).map(m => ({ text: [`${fmt(mods[m].n)} kinds`, ` · follow ${follows(m)}`], cls: '', at: 'm' + m,
      alpha: S => (cur.focus === m ? 1 : 0) * prog(S.net_mods, 0.5, 1) * quiet(S) * (1 - kindOn()) })),
    ...[0, 1, 2].flatMap(by => SPLIT_TAGS[by].map(([name, o], k) => ({ text: [name, ` · ${fmt(o.links)} links`], cls: by === 0 ? (k ? 'amb' : 'cyn') : '', at: 'copy' + k,
      alpha: S => prog(S.net_split, 0.6, 1) * (cur.by === by ? 1 : 0) }))),
    { text: [`${fmt(sp.lineDiff)} links apart`, ` · random halves: ${fmt(sp.randomDiff[0])} to ${fmt(sp.randomDiff[1])}`], cls: 'amb', at: 'under',
      alpha: S => prog(S.net_split, 0.75, 1) * (cur.by === 0 ? 1 : 0) },
    { text: () => kindText(cur.kind), cls: 'cyn', at: 'pick', alpha: () => kindOn() },
  ];
  // a kind in words, for its tag: [bold, rest]
  function kindText(c) {
    if (c < 0) return ['', ''];
    const I = info(c);
    return [`Kind ${fmt(I.rank)}`, ` · ${I.name ? I.name + ' · ' : ''}${I.phylum}`];
  }
  // a kind's numbers (the explore panes): its abundance rank among all 100,116, phylum, name (a common kind's genus, or
  // what it is known as), guild, in how many samples, its mean share of reads, what it differs by, and in the network its
  // module and links
  const FLAG = [[1, 'fertiliser'], [2, 'date'], [4, 'wheat line'], [8, 'plot']];
  function info(c) {
    const ci = comOf[c], n = nodeOf[c], fl = ci >= 0 ? CM.flags[ci] : 0;
    return { cloud: c, rank: CL.rank[c], phylum: D.phyla.names[CL.phy[c]], name: ci >= 0 ? CM.name(ci) : '', guild: CL.guild[c] ? D.guilds.names[CL.guild[c] - 1] : '',
      guildKey: CL.guild[c] ? GK[CL.guild[c] - 1] : '', prev: CL.prev[c], samples: D.src.samples, share: 100 * Math.pow(10, CL.ab[c]), common: ci >= 0,
      differs: ci >= 0 ? FLAG.filter(([b]) => fl & b).map(([, w]) => w) : null, node: n, module: n >= 0 && NT.mod[n] !== 255 ? NT.mod[n] : -1, links: n >= 0 ? NT.deg[n] : 0 };
  }

  // ---------------------------------------------------------------- views and explore
  const cam = { default: [-20, 12, 4.4, 0, 1.3, 0], cloud: [-20, 12, 4.4, 0, 1.3, 0], core: [-15, 8, 2.4, 0, 1.3, 0],
    net: [-12, 10, 2.8, 0, 1.3, 0], module: [-12, 20, 3.8, 0, 0.85, 0], split: [0, 8, 3.6, 0, 1.3, 0], over: [-24, 38, 4.6, 0, 0.6, 0] };
  const controls = [
    { key: 'view', label: 'View', options: [['cloud', 'The crowd'], ['net', 'The network'], ['split', 'Split']] },
    { key: 'colour', label: 'Colour', options: [['phylum', 'Phylum'], ['module', 'Module'], ['guild', 'Nitrifiers']] },
    { key: 'by', label: 'Split by', options: [['line', 'Wheat line'], ['fert', 'Fertiliser'], ['random', 'At random']], when: v => v.view === 'split' },
  ];
  function explore(c) {
    const net = c.view !== 'cloud', t = c.t;
    return { net_cloud: 1, net_nitro: c.colour === 'guild' ? 1 : 0, net_pull: net ? 1 : 0, net_links: net ? prog(t, 0.6, 1.8) : 0,
      net_shuffle: 0, net_mods: c.colour === 'module' ? 1 : 0, net_split: c.view === 'split' ? 1 : 0,
      net_splitBy: { line: 0, fert: 1, random: 2 }[c.by] || 0 };
  }

  // ---------------------------------------------------------------- picking
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray(), _q = [0, 0, 0];
  // a ray (a THREE.Raycaster in world coordinates) to the nearest kind it passes close to: in the cloud any kind, once the
  // network has pulled out only the network's (the rest is a faint shell); none while the network is split
  function pick(raycaster) {
    if (cur.split > 0.3 || set.uA.value < 0.5) return null;
    set.group.updateMatrixWorld();
    _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    const o = _ray.origin, d = _ray.direction, netOnly = cur.pull > 0.5;
    let best = -1, bs = 1;
    const test = c => {
      posOf(c, _q);
      const x = _q[0] - o.x, y = _q[1] - o.y, z = _q[2] - o.z, along = x * d.x + y * d.y + z * d.z;
      if (along <= 0) return;
      const off = Math.sqrt(Math.max(0, x * x + y * y + z * z - along * along)), tol = 0.008 + 0.006 * along, s = off / tol;
      if (s < bs) { bs = s; best = c; }
    };
    if (netOnly) { for (let i = 0; i < NN; i++) if (MINI[i] < cur.cut) test(NT.cloudOf(i)); } else for (let c = 0; c < NCL; c++) test(c);
    return best >= 0 ? { kind: 'kind', i: best } : null;
  }
  const API = {
    n: NCL, nodes: NN, centre: C,
    pick, pos: c => posOf(c, [0, 0, 0]), info, kindText,
    module: m => modAt(m, false, [0, 0, 0]),
    nodeOf: c => (c >= 0 && c < NCL ? nodeOf[c] : -1),
    cloudOfNode: i => NT.cloudOf(i),
    // a module's kinds, most linked first (cloud indices), for the panes
    members: m => SD.net.members(m).sort((a, b) => NT.deg[b] - NT.deg[a]).map(i => NT.cloudOf(i)),
    follows, nodesAt: rho => { const cut = NT.cut(rho); let n = 0; for (let i = 0; i < NN; i++) if (MINI[i] < cut) n++; return n; },
    // the most abundant kind of a guild (for the panes' "show one")
    guildTop: k => GTOP[GK.indexOf(k)],
  };
  return Object.assign(set, {
    params: { net_a: 1, net_cloud: 1, net_nitro: 0, net_pull: 0, net_links: 0, net_shuffle: 0, net_mods: 0, net_rho: 0.6,
      net_focus: -1, net_split: 0, net_splitBy: 0, net_kind: -1 },
    log: [],
    update, anchors, labels, cam, controls, explore, api: () => API,
  });
};

// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story: the soil block (chapters 1 to 3 and 8), the globe (the hop to Japan,
// chapter 4), the field (chapters 4 and 5, under the cloud in 6 and 7), the cloud and the network (chapters 6 and 7)
const SET_ORDER = ['soil', 'web', 'field', 'net'];
// sets drawn in another set's frame: the cloud and the network float over the field (the plots a module lights lie
// under it), so the two always turn together
const FRAME = { net: 'field' };
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
  // the hop from Vienna to the field in Japan (the engine's own, in the globe's frame)
  GL.hop = makeHop();
  GL.world.add(GL.hop.group);
}
// The hop (chapter 4 and the Globe scene): an arc above the tour's globe from Vienna to JIRCAS in Japan (Tsukuba: the
// trial's site and year are not given, so the place is JIRCAS's home), drawn out with a travelling glint, the two
// cities glowing. In the web set's frame: the globe has radius 1 and turns by web_spin turns (its live.spin), and its
// longitude L0 faces +z at spin 0 (its ll(), copied here: keep the two in step). Params (DEF, the engine's): hop_a (its
// fade), hop_t (0 nothing; to 1 the arc drawn from Vienna to Japan; the glint then rests on Japan).
// (Keyed in chapter 4 with the globe turning from Vienna to Japan, SPIN in e3_story.js; the Globe scene replays it.)
const HOP = { from: [48.21, 16.37], to: [36.05, 140.12], L0: -12, lift: 0.16, segs: 48 };
function makeHop() {
  const set = K.newSet('hop'), LK = TLOOK(K, set), TAU = Math.PI * 2;
  const tubes = LK.tubes(HOP.segs), halos = LK.halos(4);
  set.group.add(tubes.mesh, halos.mesh);
  const ll = (lat, lon) => { const a = lat * D2R, b = (lon - HOP.L0) * D2R; return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)]; };
  const A = ll(...HOP.from), B = ll(...HOP.to), om = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1));
  // the arc's points at the globe's rest (spin 0): a great circle, lifted in the middle
  const pts = [];
  for (let i = 0; i <= HOP.segs; i++) {
    const s = i / HOP.segs, wa = Math.sin((1 - s) * om) / Math.sin(om), wb = Math.sin(s * om) / Math.sin(om), h = 1.004 + HOP.lift * Math.sin(Math.PI * s);
    pts.push([(A[0] * wa + B[0] * wb) * h, (A[1] * wa + B[1] * wb) * h, (A[2] * wa + B[2] * wb) * h]);
  }
  const P = pts.map(() => [0, 0, 0]), spin = (p, a, o) => { const c = Math.cos(a), s = Math.sin(a); o[0] = p[0] * c + p[2] * s; o[1] = p[1]; o[2] = -p[0] * s + p[2] * c; return o; };
  const COL = [0.27, 0.85, 1], WARM = [1, 0.75, 0.35];
  // where the story's labels point (Vienna, Japan, the glint), as last drawn
  const at = { vienna: [0, 0, 0], japan: [0, 0, 0], glint: [0, 0, 0] };
  return Object.assign(set, {
    at,
    update(S, t) {
      const web = GL.sets.web, a = (S.web_spin || 0) * TAU, f = clamp(S.hop_t || 0, 0, 1);
      for (let i = 0; i < pts.length; i++) spin(pts[i], a, P[i]);
      tubes.begin();
      const n = Math.floor(f * HOP.segs);
      for (let i = 0; i < n; i++) tubes.add(P[i], P[i + 1], 0.006, COL, 0.9);
      tubes.end();
      halos.begin();
      halos.add(P[0], 0.09, WARM, 0.8);
      if (f > 0.98) halos.add(P[HOP.segs], 0.11, WARM, 0.9);
      const g = P[Math.min(HOP.segs, n)];
      if (f > 0.001) halos.add(g, 0.07, COL, 1);
      halos.end();
      at.vienna = P[0]; at.japan = P[HOP.segs]; at.glint = g;
      LK.depth();
      if (web) set.group.visible = set.uA.value > 0.003;
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
  // the hop turns with the globe's frame
  const ha = (S.hop_a || 0) * (S.web_a || 0);
  GL.hop.group.rotation.y = story ? setYaw('web', t) * D2R : 0;
  GL.hop.setAlpha(ha);
  if (ha > 0.003) GL.hop.update(S, t);
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
// on a screen held sideways without the side panel (the panel below, the scene in a strip above it) a view may come
// closer and aim lower: v[10] and v[11] (LOW in the story), taken in full from 1.2 : 1 on (as GL.fit's strip)
const lowK = () => (GL.wide ? 0 : clamp(((GL.aspect || 1) - 0.6) / 0.6, 0, 1));
// (v[7..9]: the target's shift clear of the side panel, FIT in the story; on a screen without a side panel it goes back)
function applyCamera(v) {
  const u = GL.wide ? 0 : 1, L = lowK(), lk = 1 + ((v[10] || 1) - 1) * L;
  viewDir(v, _vd); _vt.set(v[3] - u * (v[7] || 0), v[4] - u * (v[8] || 0) + L * (v[11] || 0), v[5] - u * (v[9] || 0));
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * (GL.fit || 1) * narrowK() * lk);
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
  [0, 0], [37, 33.6], [41.7, 35],                     // Half the sack
  [52.7, 45],                                         // The relay
  [113.2, 100], [113.9, 100.6], [114.9, 101.2],       // A wheat fights back
  [168.5, 150],                                       // The field trial
  [234.5, 210],                                       // Greener, fewer leaks
  [317, 285],                                         // A crowd of 100,000
  [377.5, 340],                                       // Who rises together
  [460, 415], [488.2, 440.6], [496.9, 443], [498.7, 444.6], [506, 445], [522.5, 460],  // What we know
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
  { key: 'title', name: 'Half the sack', a: 0, b: 45 },
  { key: 'relay', name: 'The relay', a: 45, b: 100 },
  { key: 'bni', name: 'A wheat fights back', a: 100, b: 150 },
  { key: 'trial', name: 'The field trial', a: 150, b: 210 },
  { key: 'leaks', name: 'Greener, fewer leaks', a: 210, b: 285 },
  { key: 'crowd', name: 'A crowd of 100,000', a: 285, b: 340 },
  { key: 'together', name: 'Who rises together', a: 340, b: 415 },
  { key: 'know', name: 'What we know', a: 415, b: 460 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest; the sets themselves start hidden (and the engine's hop, see makeHop)
const DEF = {};
// params eased on a log scale in the story and in explore (a set lists its own as log): none of the engine's
const LOG = new Set([]);
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
  DEF.hop_a = 0; DEF.hop_t = 0;
  for (const k of SET_ORDER) for (const n of GL.sets[k].log || []) LOG.add(n);
}
const TR = {};
const key = (n, t, v) => { (TR[n] = TR[n] || []).push([t, v]); };
const ramp = (n, t0, t1, v0, v1) => { key(n, t0, v0); key(n, t1, v1); };
// a value eased on a log scale: between log(v0) and log(v1)
const logMix = (v0, v1, x) => (v0 > 0 && v1 > 0 ? Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * x) : v0 + (v1 - v0) * x);
function evalTrack(n, t) {
  const ks = TR[n];
  if (!ks) return DEF[n];
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
      if (t1 <= t0) return v1;
      return LOG.has(n) ? logMix(v0, v1, smooth((t - t0) / (t1 - t0))) : v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
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

const ST = { labels: [], items: [], stand: [] };
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
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline; the
// sets' own views fill a whole screen, so the wide ones stand back a little and move their target left of the parts'
// middle: the network split in two or three, the field with its jars on the bench and its stack behind)
const FIT = {
  net: { split: [0, 0, 0.5, -0.1, 0, 0] },
  field: { default: [0, 0, 0.35, -0.2, 0, 0.05], jars: [0, 0, 0.2, 0, 0, 0] },
  web: { globe: [0, 0, 1.8, 0, 0, 0] },
};
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen (the split network, the field with its bench)
const NARROW = { net: { split: 1.55, module: 1.15 }, field: { default: 1.25, plots: 1.2, stack: 1.2, cloud: 1.15 }, soil: { default: 1.15 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// on a screen held sideways but too narrow for the side panel (the panel below, the scene in a strip above it, see
// lowK): [distance factor, the target's shift up]
const LOW = { soil: { default: [0.95, -0.1], plant: [0.9, -0.1] }, field: { stack: [0.9, -0.1] }, net: { cloud: [0.8, 0], core: [0.9, 0], net: [0.85, 0], module: [0.8, 0.1], split: [0.9, 0] } };
const LOW1 = [1, 0];
const lowOf = (k, name) => (LOW[k] && LOW[k][name]) || LOW1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// Every number the story shows is the trial's (SOIL_DATA), looked up through SDATA, or read off the slides' charts
// (SOIL_DATA.figs: said "read off the slides"). Nothing scientific is computed here.
const D = SOIL_DATA, SD = SDATA;
const pct = v => (Number.isFinite(+v) ? `${Math.round(100 * v)} %` : '–');
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
// a value as the panes print it: a measure to its own precision, '–' where none was measured
const num = (v, d) => (v === null || v === undefined || !Number.isFinite(+v) ? '–' : (+v).toFixed(d));
const pTxt = p => (p === null || p === undefined || !Number.isFinite(+p) ? '' : p < 0.001 ? 'p < 0.001' : `p = ${(+p).toFixed(p < 0.01 ? 3 : 2)}`);
// a whole number of thousands ("about 100,000")
const thousands = n => fmt(Math.round(n / 1000) * 1000);

// ------------------------------------------------------------------ facts --
// Numbers the story quotes, all from SOIL_DATA (SPEC.md, "The data")
const FACTS = (() => {
  const N = D.net, sp = N.splits, F = D.figs, M = D.meta, ds = D.design;
  const big = N.mods.map((m, i) => i).filter(i => N.mods[i].n >= 100);
  const top = m => { const r = N.mods[m].r2; let b = 'fert'; for (const k of ['time', 'line', 'plot']) if (r[k] > r[b]) b = k; return b; };
  const qp = /p = ([\d.]+)/.exec(F.qpcrNote || '');
  return {
    samples: D.src.samples, kinds: D.src.kinds, perSample: D.src.kindsPerSample, reads: D.src.reads, common: D.common.n, readShare: D.common.readShare,
    plots: ds.plots, reps: ds.reps, dates: ds.times.length, dap: ds.times.map(t => t.dap), days: ds.times.map(t => t.day), stages: ds.times.map(t => t.stage),
    kgN: ds.ferts[1].kgN, nodes: N.n, links: N.links, pos: N.pos, neg: N.neg, modules: N.modules, big: big.length, nullLinks: N.null.links,
    bigFert: big.filter(m => top(m) === 'fert').length, bigPlot: big.filter(m => top(m) === 'plot').length,
    lineR2: Math.max(...big.map(m => N.mods[m].r2.line)),
    byLine: D.common.diff.line, byFert: D.common.diff.fert, byTime: D.common.diff.time, byPlot: D.common.diff.plot,
    lineLinks: sp.line.map(x => x.links), lineDiff: sp.lineDiff, randomDiff: sp.randomDiff, randomN: sp.random.length, randomMore: sp.randomMore,
    thresholds: N.thresholds, cuts: N.cuts, residual: N.residual, nitrosospira: D.guilds.nsp.byFert, archaea: D.guilds.aoa.byFert,
    chl70: F.chl70[0].map(o => o.v), no3d24: M.no3.line.byGroup[1 * 5 + 2], n2oPeak: F.n2o.peaks[0][1], n2oDcd: F.n2o.peaks[0][2],
    n2oMeta: M.n2o.line.byFert[1], n2oMetaDay: [0, 1, 2].map(t => M.n2o.line.byGroup[1 * 5 + t]), qpcrP: qp ? qp[1] : '',
    incubation: F.n2o.incubation, fertNodes: N.fertNodes, fertAll: N.fertAll,
    // when the control wheat's fertilised soil of day 1 peaks in its jar, as a share of the incubation (the jars' clock)
    n2oPeakInc: (c => F.n2o.times[c.indexOf(Math.max(...c))] / F.n2o.times[F.n2o.times.length - 1])(SD.n2o(0, 1, 1)),
  };
})();
// the credits: the last chapter's small print and explore's About note (the Scenes pane, page and headset)
const AUTH = 'Marina Montserrat Díez, Tadashi Yoshihashi, Guntur Subbarao Ventaka, Eleftheria Bachtsevani, Dimitrios Karpouzas, Christina Hazard, Melina Kerou and Christa Schleper';
const INSTS = 'University of Vienna (Vienna Doctoral School of Ecology and Evolution; Archaea Biology and Ecogenomics); University of Thessaly; Université Lyon 1 Claude Bernard; JIRCAS (Japan International Research Center for Agricultural Sciences)';
const DATA_CREDIT = 'The field trial\'s data (16S amplicon reads, field measurements) used with the authors\' permission; the kinds of microbe are numbered by abundance, never named by their ids. Values from the slides\' charts were read off them by two readers. The soil block, the relay, the chromosome and the field\'s layout are illustrative. The co-occurrence network was built for this story with a standard method; it is not the authors\' analysis.';
const ABOUT = `After the slides "Exploring the Effects of Biological Nitrification Inhibition on the Rhizosphere Microbiome of a BNI-enabled Winter Wheat" by ${AUTH} (${INSTS}). The BNI wheat: Subbarao et al., PNAS. ${DATA_CREDIT}`;
// colours as text on the HTML panel, which is light in the light theme: a colour mixed with the panel's ink (darker on
// a light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same colour
// the story's colours (SPEC.md, "Look", SLOOK): the two wheat lines, the three regimes, nitrogen as it moves, the guilds
const CYAN = '#46d9ff', AMBER = '#ffb43b', RED = '#ff7a6b', BLUE = '#7cc0ff', GREEN = '#3ee08f', GREY = '#8e98ab';
const LINE_COL = SLOOK.LINE, FERT_COL = SLOOK.FERT;
const LINE_NAME = ['BNI wheat', 'Control wheat'], FERT_NAME = ['Not fertilised', 'Fertilised', 'Fertilised + DCD'];

function buildStory() {
  const F = FACTS;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const hide = (k, t0, t1) => ramp(k + '_a', t0, t1, 1, 0);
  // jump an index param (a pick, a date) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // a big number in a colour of its own (the headset's canvas reads data-col)
  const big = (col, v) => `<b data-col="${col}" style="color:${inkCol(col)}">${v}</b>`;
  // (out: where a part that takes turns with the next fades out)
  const fact = (at, col, v, small, out) => `<div data-at="${at}"${out ? ` data-out="${out}"` : ''}>${big(col, v)}<small>${small}</small></div>`;
  const legend = (items, out) => `<ul class="legend">${items.map(([at, col, t]) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''}><span class="sw" style="background:${swCol(col)}"></span>${t}</li>`).join('')}</ul>`;
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const G = SLOOK.GUILD, [cB, cC] = F.chl70, [nB, nC] = F.no3d24, [oB, oC] = F.n2oPeak, d1 = F.days[0], dL = F.days[F.days.length - 1];
  const n1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Holding on to nitrogen</h1>
      <p class="lede" data-at="2.4">A wheat, its soil and the microbes in between</p>
      ${turns(`<p data-at="5" data-out="21.5">Less than half of the fertiliser a farmer spreads ends up in the crop.</p>
        <p data-at="12" data-out="21.5" class="amber">The plant takes up some of it; microbes in the soil get to much of the rest first.</p>`,
      `<p data-at="22">They turn it into nitrate, which washes away, and into nitrous oxide, a strong greenhouse gas.</p>
        <p data-at="30" class="amber">So farmers spread more.</p>
        <p class="note" data-at="33">"Less than 50 %", as the slides put it. The flows in this block are a drawing: ammonium amber, nitrate blue, nitrous oxide lilac, nitrogen in the plant green.</p>
        <p class="credits" data-at="35">After the slides by Marina Montserrat Díez and colleagues (University of Vienna, JIRCAS, University of Thessaly, Université Lyon 1) and their field trial's data.</p>`)}`,
    relay: `<h2 data-at="0.6">The relay underground</h2>
      ${turns(`<p data-at="1.2" data-out="41.5">Inside the soil, microbes pass the nitrogen on, like runners in a relay.</p>
        <ul class="steps">
          ${step(9, 41.5, G.aoa, 'Archaea', 'turn ammonium into nitrite')}
          ${step(17, 41.5, G.nsp, 'Bacteria', 'do the same')}
          ${step(25, 41.5, G.nit, 'Nitrite oxidisers', 'turn nitrite into nitrate')}
          ${step(34, 41.5, AMBER, 'Comammox', 'does both steps in one microbe')}
        </ul>`,
      `<p data-at="42">Each hand-off is a step in a network of processes, and at each one nitrogen can leak away.</p>
        <p class="note" data-at="46">Nitrification: ammonia-oxidising archaea (AOA) and bacteria (AOB), nitrite-oxidising bacteria (NOB), complete ammonia oxidisers (comammox). Nitrous oxide escapes along the way. The pore is an illustration.</p>`)}`,
    bni: `<h2 data-at="0.6">A wheat that fights back</h2>
      ${turns(`<p data-at="1.2" data-out="23.5">Some plants release substances from their roots that slow the relay down: biological nitrification inhibition, or BNI.</p>
        <p data-at="9" data-out="23.5" class="amber">Breeders moved a piece of chromosome from a wild grass into the wheat Munal.</p>`,
      `<p data-at="24">The new wheat's roots are meant to slow the first hand-off, so that more ammonium stays where the plant can take it up.</p>
        <p data-at="35" class="amber">Until now the evidence was one bacterium in a dish and one day in a field.</p>
        <p class="note" data-at="39">The wild grass is Leymus racemosus; the BNI wheat is Munal-BNI, the control wheat Munal-control, the same wheat without the segment (Subbarao et al., PNAS). The earlier evidence: root exudates slowed one ammonia-oxidising bacterium in a culture; one field sampling found more nitrogen in the plant and fewer ammonia-oxidising archaea.</p>`)}`,
    trial: `<h2 data-at="0.6">The field trial</h2>
      ${turns(`<p data-at="1.2" data-out="24.5">To test it, the BNI wheat and the control wheat were grown side by side in a field in Japan:</p>
        ${legend([[16, FERT_COL[0], 'with no fertiliser'], [17.5, FERT_COL[1], 'with fertiliser'], [19, FERT_COL[2], 'with fertiliser and a synthetic inhibitor']], 24.5)}`,
      `<p data-at="25">Five times over ${F.days[F.days.length - 1]} days, soil was taken from the roots in every plot.</p>
        <div class="facts">${fact(40, AMBER, fmt(F.samples), 'samples')}${fact(41.5, CYAN, fmt(F.plots), 'plots')}${fact(43, GREEN, fmt(F.dates), 'dates')}</div>
        <p class="note" data-at="46">A JIRCAS trial: its site and year are not given, so the arc ends at JIRCAS's home in Tsukuba. Fertiliser: ${F.kgN} kg of nitrogen per hectare; the inhibitor: DCD (dicyandiamide, our reading). Days ${d1} to ${dL} are ${F.dap[0]} to ${F.dap[F.dap.length - 1]} days after planting. ${cap(word(F.reps))} replicates; soil clinging to the roots (the rhizosphere); one sample is missing. The plots' layout is illustrative.</p>`)}`,
    leaks: `<h2 data-at="0.6">Greener, fewer leaks</h2>
      ${turns(`<p data-at="1.2" data-out="21.5">At the end of the season the BNI wheat is still green where the control wheat yellows, most clearly without fertiliser.</p>
        <div class="facts">${fact(9, LINE_COL[0], Math.round(cB), `BNI wheat, day ${dL}`, 21.5)}${fact(10.5, LINE_COL[1], Math.round(cC), 'control wheat', 21.5)}</div>
        <p class="note" data-at="12" data-out="21.5">Chlorophyll (SPAD) in the leaves of unfertilised plots, read off the slides.</p>`,
      `<p data-at="22" data-out="41.5">With fertiliser there is less nitrate in the soil under it in mid-season.</p>
        <div class="facts">${fact(30, LINE_COL[0], Math.round(nB), `mg N per kg, day ${F.days[2]}`, 41.5)}${fact(31.5, LINE_COL[1], Math.round(nC), 'under the control wheat', 41.5)}</div>
        <p class="note" data-at="33" data-out="41.5">Nitrate in fertilised plots, the group means of the data (${pTxt(F.no3d24[2])}). The slides call it lower from day ${F.days[2]} to day ${F.days[3]}; only day ${F.days[2]} is starred.</p>`,
      `<p data-at="42">And soil from its roots, given ammonium in a jar, gives off far less nitrous oxide, close to what the synthetic inhibitor achieves.</p>
        <div class="facts">${fact(52, LINE_COL[0], n1(oB), 'ppm at the peak, BNI wheat')}${fact(53.5, LINE_COL[1], n1(oC), `control wheat, day ${d1}`)}</div>
        <p class="note" data-at="57">Fertilised soil, read off the slides (${esc(F.incubation.replace(/ \(slide text\)$/, ''))}). An open question: the data's own N2O value, "the potential amount of produced nitrous oxide" (unit not given), shows no clear difference over the season (${F.n2oMeta[0].toFixed(2)} against ${F.n2oMeta[1].toFixed(2)}, ${pTxt(F.n2oMeta[2])}); how the two measurements relate is not known yet.</p>`)}`,
    crowd: `<h2 data-at="0.6">A crowd of ${thousands(F.kinds)}</h2>
      ${turns(`<p data-at="1.2" data-out="23.5">Across the ${fmt(F.samples)} samples, this soil holds about ${thousands(F.kinds)} kinds of microbe, some ${fmt(Math.round(F.perSample / 100) * 100)} in a typical sample.</p>
        <p data-at="9" data-out="23.5" class="amber">${fmt(F.common)} of them make up ${pct(F.readShare)} of the DNA read.</p>`,
      `<p data-at="24">Fertiliser roughly doubles one ammonia-eating bacterium, Nitrosospira.</p>
        <p data-at="31">The wheat line barely shows: only ${word(F.byLine)} of the ${fmt(F.common)} common kinds differ between the two wheats.</p>
        <div class="facts">${fact(38, FERT_COL[1], fmt(F.byFert), 'differ by fertiliser')}${fact(39.5, GREY, fmt(F.byTime), 'by date')}${fact(41, LINE_COL[0], fmt(F.byLine), 'by wheat line')}</div>
        <p class="note" data-at="44">Kinds of microbe: amplicon sequence variants (ASVs) from 16S rRNA gene reads, numbered by abundance. Nitrosospira: ${F.nitrosospira.map(v => v.toFixed(2)).join(', ')} % of reads without fertiliser, with it, with DCD. Gene counts of the ammonia oxidisers (qPCR, read off the slides) differ little between the wheats (one marginal p = ${F.qpcrP}).</p>`)}`,
    together: `<h2 data-at="0.6">Who rises together</h2>
      ${turns(`<p data-at="1.2" data-out="30.5">Link two kinds of microbe when their numbers rise and fall together across the samples.</p>
        <div class="facts">${fact(10, CYAN, fmt(F.nodes), 'kinds', 30.5)}${fact(11.5, CYAN, fmt(F.links), 'links', 30.5)}</div>
        <p data-at="19" data-out="30.5" class="amber">Shuffle the samples, and not one link is left: the pattern is real.</p>`,
      `<p data-at="31" data-out="54.5">Its groups follow the fertiliser and the field's plots; the wheat barely shows.</p>
        <p class="note" data-at="40" data-out="54.5">About ${word(F.big)} big groups (modules): ${word(F.bigFert)} rise and fall with the fertiliser, ${word(F.bigPlot)} with the plots; the wheat line explains under ${Math.max(1, Math.ceil(F.lineR2 * 100))} % of any big group's ups and downs.</p>`,
      `<p data-at="55">Split by wheat line, the two networks differ no more than two random halves of the samples do.</p>
        <p data-at="64" class="amber">And rising together is not working together.</p>
        <p class="note" data-at="67">Built for this story, not the authors' analysis: the ${fmt(F.common)} common kinds, centred log-ratios, Spearman's correlation of at least 0.6 (false discovery rate under 5 %), Louvain modules. Each half's own network: ${fmt(F.lineLinks[0])} and ${fmt(F.lineLinks[1])} links; ${fmt(F.randomN)} random halves differ by ${fmt(F.randomDiff[0])} to ${fmt(F.randomDiff[1])}.</p>`)}`,
    know: `<h2 data-at="0.6">What we know</h2>
      ${turns(`<p data-at="1.2" data-out="24.5">There are strong indications that the BNI wheat stays greener and loses less nitrate, and that the soil's microbe community and network show no clear change from the wheat line.</p>
        <p data-at="10" data-out="24.5" class="amber">It is not yet proof.</p>
        <p data-at="14" data-out="24.5">Next: following marked nitrogen atoms through soil, microbe and plant, and reading which microbial genes are switched on.</p>`,
      `<p class="note" data-at="25">Marked atoms: isotope studies (15N); genes switched on: metatranscriptomics. Still open: the jars show far less nitrous oxide from the BNI wheat's soil, while the data's own N2O value shows no clear difference over the season (${F.n2oMeta[0].toFixed(2)} against ${F.n2oMeta[1].toFixed(2)}, ${pTxt(F.n2oMeta[2])}); how the two measurements relate is not known yet.</p>
        <p data-at="28"><button class="btn primary" id="btnGoExplore" type="button">Explore the trial</button></p>
        <p class="credits" data-at="29">After the slides by ${AUTH} (University of Vienna; University of Thessaly; Université Lyon 1; JIRCAS, Japan). The BNI wheat: Subbarao et al., PNAS.</p>
        <p class="credits" data-at="30">The trial's data used with the authors' permission. The soil block, the relay, the chromosome and the field's layout are illustrative.</p>`)}`,
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
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name), lowOf(k, name)]);
  };
  start({ soil_grow: 0, soil_cut: 1, soil_fert: 0, soil_flow: 0, soil_plant: 0.45, soil_inhibit: 0, soil_halo: 0, soil_dcd: 0, soil_pore: 0,
    soil_relay: 0, soil_grass: 0, soil_chrom: 0, soil_tracer: 0, soil_pick: -1,
    web_net: 0, web_globe: 1, web_ties: 0, web_spin: SPIN.vienna,
    field_grow: 0, field_date: 0, field_net: 0, field_chl: 0, field_nh4: 0, field_no3: 0, field_jars: 0, field_jday: 0, field_inc: 0,
    field_cores: 0, field_stack: 0, field_module: -1, field_mlit: 0, field_pick: -1, field_tags: 0, field_show: 0, field_life: 0, field_line: -1, field_fert: -1,
    net_cloud: 0, net_nitro: 0, net_pull: 0, net_links: 0, net_shuffle: 0, net_mods: 0, net_rho: 0.6, net_focus: -1, net_split: 0, net_splitBy: 0, net_kind: -1 });
  let a, b;
  // Half the sack: the block with its wheat growing from a seedling, fertiliser falling and dissolving into ammonium,
  // then the flows: some up the roots into the plant, the rest through the relay down out of the block as nitrate, or
  // up out of it as nitrous oxide
  a = C.title.a; b = C.title.b;
  show('soil', 0.2, 2);
  ramp('soil_grow', a + 0.5, a + 7, 0, 1);
  ramp('soil_fert', a + 6, a + 12, 0, 1);
  ramp('soil_flow', a + 12, a + 22, 0, 1);
  cam(a, 'soil', 'default', -34);
  cam(a + 5, 'soil', 'plant', -16);
  cam(a + 8, 'soil', 'surface', -10);
  cam(a + 13, 'soil', 'surface', 6, 'spin');
  cam(a + 17, 'soil', 'default', -6);
  cam(a + 29, 'soil', 'default', 12, 'spin');
  cam(a + 33, 'soil', 'roots', -8);
  cam(b - 0.5, 'soil', 'roots', 6, 'spin');
  // The relay underground: a pore grows out of the block, magnified; the four relay runners come in one by one, each
  // handing on glowing particles that change colour as they pass
  a = C.relay.a; b = C.relay.b;
  ramp('soil_pore', a + 2, a + 7, 0, 1);
  ramp('soil_relay', a + 8, a + 10, 0, 1);
  ramp('soil_relay', a + 16, a + 18, 1, 2);
  ramp('soil_relay', a + 24, a + 26, 2, 3);
  ramp('soil_relay', a + 33, a + 35, 3, 4);
  ramp('soil_pore', b - 6, b - 1, 1, 0);
  jump('soil_relay', b - 0.5, 4, 0);
  cam(a + 1, 'soil', 'pore', -10);
  cam(a + 7, 'soil', 'relay', -12);
  cam(a + 40, 'soil', 'relay', 12, 'spin');
  cam(b - 1, 'soil', 'default', -10);
  // A wheat that fights back: the wild grass beside the block, two chromosomes above, a segment gliding from the grass's
  // into the wheat's; then the halo round the roots and the relay slowing (the particles stay amber)
  a = C.bni.a; b = C.bni.b;
  ramp('soil_grass', a + 2, a + 6, 0, 1);
  ramp('soil_chrom', a + 9, a + 14, 0, 0.5);
  ramp('soil_chrom', a + 15, a + 21, 0.5, 1);
  ramp('soil_grass', a + 24, a + 27, 1, 0);
  ramp('soil_chrom', a + 24, a + 27, 1, 0);
  ramp('soil_halo', a + 26, a + 32, 0, 1);
  ramp('soil_inhibit', a + 28, a + 36, 0, 0.7);
  cam(a + 2, 'soil', 'chrom', -12);
  cam(a + 22, 'soil', 'chrom', 10, 'spin');
  cam(a + 26, 'soil', 'roots', -8);
  cam(b - 1, 'soil', 'roots', 10, 'spin');
  // The field trial: the globe facing Vienna, turning east while the hop draws its arc to Japan, the camera diving
  // towards Japan as the field fades in: the wheat grows on bare plots under netting, the dates pass, and at each a
  // core lifts out of every plot; then the cores fly into the stack of the design
  a = C.trial.a; b = C.trial.b;
  hide('soil', a, a + 2);
  show('web', a, a + 2);
  key('web_spin', a + 2, SPIN.vienna);
  ramp('web_spin', a + 3, a + 12, SPIN.vienna, SPIN.japan);
  ramp('hop_a', a + 2, a + 3, 0, 1);
  ramp('hop_t', a + 3, a + 11, 0, 1);
  hide('web', a + 14.5, a + 17);
  show('field', a + 14.5, a + 16.5);
  ramp('field_grow', a + 16, a + 24, 0, 1);
  ramp('field_net', a + 19, a + 23, 0, 1);
  // the five dates (the wheat taller, its stage, and the cores lifting at each)
  [26, 29.5, 33, 36.5].forEach((s, i) => ramp('field_date', a + s, a + s + 2, i, i + 1));
  ramp('field_cores', a + 25, a + 39, 0, 1);
  ramp('field_stack', a + 41, a + 50, 0, 1);
  const jp = SPIN.at(36.05, 140.12, SPIN.japan);
  cam(a + 0.5, 'web', 'globe', 0, null, [0, -6, 0.6]);
  cam(a + 3, 'web', 'globe', 0, null, [0, -2, 0.1]);
  cam(a + 12, 'web', 'globe', 0, 'spin', [0, 6, -0.7]);
  cam(a + 16, 'web', 'globe', 0, null, [0, 12, -4.5, jp[0], jp[1], jp[2]]);
  cam(a + 17, 'field', 'plots', -20);
  cam(a + 24, 'field', 'default', -10);
  cam(a + 27, 'field', 'low', -12);
  cam(a + 38, 'field', 'low', 14, 'spin');
  cam(a + 41, 'field', 'stack', -8);
  cam(b - 1, 'field', 'stack', 8, 'spin');
  // Greener, fewer leaks: the cores back into the ground; the leaves take each plot's measured chlorophyll at day 70
  // (the unfertilised BNI plots picked, with their tags); back to day 24 and nitrate seeping under the plots (the
  // fertilised BNI plots picked); then the jars of day 1's soil breathing out N2O over the incubation
  a = C.leaks.a; b = C.leaks.b;
  ramp('field_stack', a, a + 3, 1, 0);
  ramp('field_cores', a + 2, a + 4, 1, 0);
  ramp('field_chl', a + 3, a + 7, 0, 1);
  jump('field_pick', a + 8, -1, 0);
  ramp('field_tags', a + 8, a + 10, 0, 1);
  ramp('field_tags', a + 19, a + 21, 1, 0);
  jump('field_pick', a + 21.5, 0, -1);
  ramp('field_date', a + 22, a + 26, 4, 2);
  ramp('field_no3', a + 23, a + 28, 0, 1);
  jump('field_pick', a + 28.5, -1, 1); jump('field_show', a + 28.5, 0, 2);
  ramp('field_tags', a + 29, a + 31, 0, 1);
  ramp('field_tags', a + 39, a + 41, 1, 0);
  jump('field_pick', a + 41.5, 1, -1);
  ramp('field_no3', a + 40, a + 43, 1, 0);
  jump('field_jday', a + 41.9, 0, 0);
  ramp('field_jars', a + 42, a + 45, 0, 1);
  // (the incubation runs to the curves' peak, about day 9 of 22, and holds there: the text's numbers)
  ramp('field_inc', a + 45, a + 56, 0, F.n2oPeakInc);
  cam(a + 1, 'field', 'default', -12);
  cam(a + 6, 'field', 'low', -14);
  cam(a + 20, 'field', 'low', 10, 'spin');
  cam(a + 24, 'field', 'under', -10);
  cam(a + 40, 'field', 'under', 10, 'spin');
  cam(a + 44, 'field', 'jars', -6);
  cam(b - 1, 'field', 'jars', 8, 'spin');
  // A crowd of 100,000: the field small below; the cloud of kinds appears over it from the centre outwards; the
  // nitrifiers flare
  a = C.crowd.a; b = C.crowd.b;
  ramp('field_jars', a, a + 3, 1, 0);
  ramp('field_date', a, a + 3, 2, 4);
  show('net', a + 1, a + 2);
  ramp('net_cloud', a + 2, a + 9, 0, 1);
  ramp('net_nitro', a + 24, a + 28, 0, 1);
  ramp('net_nitro', b - 3, b, 1, 0);
  cam(a + 0.5, 'field', 'cloud', -10);
  cam(a + 8, 'net', 'cloud', -6);
  cam(a + 20, 'net', 'cloud', 10, 'spin');
  cam(a + 24, 'net', 'core', -6);
  cam(b - 1, 'net', 'core', 10, 'spin');
  // Who rises together: the network's kinds fly out of the core to its layout, the links fade in; a shuffle dissolves
  // them; the modules take their colours, two of them lighting the plots where they thrive below; then the two wheat
  // lines' networks side by side
  a = C.together.a; b = C.together.b;
  ramp('net_pull', a + 2, a + 10, 0, 1);
  ramp('net_links', a + 7, a + 13, 0, 1);
  ramp('net_shuffle', a + 19, a + 23, 0, 1);
  ramp('net_shuffle', a + 26, a + 29.5, 1, 0);
  ramp('net_mods', a + 31, a + 35, 0, 1);
  const [mF, mP] = [0, 1].map(want => D.net.mods.findIndex(m => { const r = m.r2; return m.n >= 100 && (want ? r.plot > r.fert : r.fert > r.plot); }));
  jump('net_focus', a + 38, -1, mF); jump('field_module', a + 38, -1, mF);
  ramp('field_mlit', a + 38, a + 41, 0, 1);
  jump('net_focus', a + 45, mF, mP); jump('field_module', a + 45, mF, mP);
  ramp('field_mlit', a + 51, a + 53, 1, 0);
  jump('net_focus', a + 53.5, mP, -1); jump('field_module', a + 53.5, mP, -1);
  ramp('net_mods', a + 53, a + 56, 1, 0);
  jump('net_splitBy', a + 55, 0, 0);
  ramp('net_split', a + 56, a + 62, 0, 1);
  ramp('field_a', a + 54, a + 57, 1, 0.25);
  cam(a + 1, 'net', 'core', 0);
  cam(a + 9, 'net', 'net', -8);
  cam(a + 30, 'net', 'net', 14, 'spin');
  cam(a + 34, 'net', 'module', -8);
  cam(a + 52, 'net', 'module', 10, 'spin');
  cam(a + 57, 'net', 'split', -4);
  cam(b - 1, 'net', 'split', 4, 'spin');
  // What we know: back in the block, the halo glowing and the flows held; one marked atom travels from a grain through
  // the soil, a microbe, a root and into the leaf
  a = C.know.a; b = C.know.b;
  hide('net', a, a + 2.5);
  ramp('field_a', a, a + 2.5, 0.25, 0);
  show('soil', a + 1, a + 3);
  ramp('soil_tracer', a + 5, a + 24, 0, 1);
  cam(a + 1.5, 'soil', 'tracer', -14);
  cam(a + 24, 'soil', 'tracer', 12, 'spin');
  cam(b - 0.5, 'soil', 'default', 16, 'spin');
  // ---- sound effects (sfxCue: story time, a sound, where it comes from, its options), beside the keys above: a cue just
  // before the line it goes with, textures under the voice soft; sequences from the keys (when a ramp reaches a share)
  const rampAt = (t0, t1, f) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (smooth(m) < f) lo = m; else hi = m; } return t0 + (t1 - t0) * lo; };
  a = C.title.a;
  sfxCue(a + 0.5, 'rise', 'soil', 'stem', { dur: 6 });                               // the wheat grows from a seedling
  sfxCue(a + 6, 'patter', 'soil', 'fert', { dur: 5, gain: 0.45 });                   // fertiliser falls
  sfxCue(a + 11.8, 'rush', 'soil', 'nh4', { dur: 10, pitch: 0.8, gain: 0.3 });       // the flows: up, down, out
  a = C.relay.a;
  sfxCue(a + 2, 'whoosh', 'soil', 'pore', { dur: 5 });                               // a pore, magnified
  ['aoa', 'aob', 'nob', 'comammox'].forEach((k, i) => sfxCue(a + [8, 16, 24, 33][i] + 0.2, 'pick', 'soil', k, { pitch: Math.pow(2, 2 * i / 12) }));   // the four relay runners
  sfxCue(a + 49, 'whoosh', 'soil', 'pore', { dur: 4, pitch: 0.7 });                 // the pore shrinks back
  a = C.bni.a;
  sfxCue(a + 2, 'rise', 'soil', 'grass');                                            // the wild grass
  sfxCue(a + 8.8, 'whoosh', 'soil', 'chromGrass');                                   // two chromosomes
  sfxCue(a + 21, 'link', 'soil', 'chromWheat');                                      // the segment lands in the wheat's
  sfxCue(a + 26, 'pulse', 'soil', 'halo');                                           // the halo round the roots
  sfxCue(a + 28.5, 'pulse', 'soil', 'pore', { pitch: 0.7, gain: 0.35 });             // the relay slows
  a = C.trial.a;
  sfxCue(a + 2.5, 'whoosh', 'web', 'europe', { dur: 9, pitch: 0.6 });                // the globe turns east, the hop to Japan
  sfxCue(a + 11, 'ping', 'web', 'asia');                                             // Japan
  sfxCue(a + 14.5, 'whoosh', 'field', 'field');                                      // down to the field
  sfxCue(a + 16, 'rise', 'field', 'field', { dur: 8 });                              // the wheat grows
  [26, 29.5, 33, 36.5].forEach((s, i) => sfxCue(a + s, 'knock', 'field', 'field', { pitch: 1.4 * Math.pow(2, i / 12), gain: 0.35 }));   // each date, a core lifts from every plot
  sfxCue(a + 41, 'patter', 'field', 'stack', { dur: 9, gain: 0.4 });                 // the cores fly into the stack
  a = C.leaks.a;
  sfxCue(a + 3, 'rise', 'field', 'field', { dur: 4, pitch: 1.2 });                   // leaves by their chlorophyll
  sfxCue(a + 8, 'pick', 'field', 'bni');                                             // the unfertilised BNI plots picked
  sfxCue(a + 21.8, 'whoosh', 'field', 'field', { dur: 4, pitch: 0.7 });              // back to day 24
  sfxCue(a + 23, 'rush', 'field', 'under', { dur: 5, pitch: 0.6, gain: 0.3 });       // nitrate seeping
  sfxCue(a + 28.5, 'pick', 'field', 'bni');                                          // the fertilised BNI plots
  [41.8, 42.2, 42.6].forEach((s, i) => sfxCue(a + s, 'bubble', 'field', 'jars', { pitch: Math.pow(2, 2 * i / 12), seq: true }));   // the jars
  [45, 48, 51, 54].forEach(s => sfxCue(a + s, 'bubble', 'field', 'jars', { pitch: 0.7, gain: 0.3 }));   // breathing out N2O
  a = C.crowd.a;
  sfxCue(a + 2, 'grow', 'net', 'cloud', { dur: 7, pitch: 0.9 });                     // 20,000 kinds
  sfxCue(a + 23.8, 'pulse', 'net', 'cloud', { pitch: 1.2 });                         // the nitrifiers flare
  a = C.together.a;
  sfxCue(a + 2, 'whoosh', 'net', 'net', { dur: 8 });                                 // kinds fly out to their layout
  sfxCue(a + 7, 'grow', 'net', 'net', { dur: 6 });                                   // links fade in
  sfxCue(a + 18.8, 'snap', 'net', 'net');                                            // the shuffle
  sfxCue(a + 19.1, 'patter', 'net', 'net', { dur: 3.5, gain: 0.3 });                 // the links dissolve
  sfxCue(a + 30.8, 'grow', 'net', 'net', { dur: 4, pitch: 1.2 });                    // modules take colours
  [38, 45].forEach((s, i) => sfxCue(a + s, 'pulse', 'field', 'lit', { pitch: i ? 0.8 : 1 }));   // a module lights its plots
  sfxCue(a + 55.8, 'whoosh', 'net', 'mid', { dur: 6 });                              // the two wheat lines' networks
  a = C.know.a;
  sfxCue(a + 1, 'rise', 'soil', null, { gain: 0.4 });                                // back in the block
  [0.02, 0.32, 0.5, 0.75].forEach((f, i) => sfxCue(rampAt(a + 5, a + 24, f), 'step', 'soil', 'tracer', { pitch: Math.pow(2, 2 * i / 12), seq: true }));   // one marked atom: grain, microbe, root, stem
  sfxCue(a + 24, 'ping', 'soil', 'ear');                                             // into the leaf
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds the hop's two ends)
  a = C.trial.a;
  label('web', () => GL.hop.at.vienna, '<b>Vienna</b> · the lab', a + 2.5, a + 9, 'cyn');
  label('web', () => GL.hop.at.japan, '<b>Japan</b> · the field trial', a + 10.5, a + 16, 'amb');
}
// the globe's turn (web_spin, in turns) that brings a longitude to face +z, and a point of the globe at a turn (the web
// set's ll() and its turn, as makeHop has them)
const SPIN = {
  of: lon => -(lon - HOP.L0) / 360,
  at(lat, lon, spin) {
    const A = lat * D2R, B = (lon - HOP.L0) * D2R, p = [Math.cos(A) * Math.sin(B), Math.sin(A), Math.cos(A) * Math.cos(B)], r = spin * Math.PI * 2;
    return [p[0] * Math.cos(r) + p[2] * Math.sin(r), p[1], -p[0] * Math.sin(r) + p[2] * Math.cos(r)];
  },
};
SPIN.vienna = SPIN.of(HOP.from[1]) + 0.02; SPIN.japan = SPIN.of(HOP.to[1]);
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set, narrow factor, FIT's target shift, LOW]; 'spin' segments turn at
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
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[9] || 1, w[10], w[11]];
  });
}
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
// (the field and the network share one turn: one frame)
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
// the story's view at time t: [az, el, dist, tx, ty, tz, narrow factor, FIT's target shift x, y, z, and LOW's two]
// (in a headset a set's stand view may take over while it is the scene, see standView: none in this story yet)
const storyCam = t => (XR.on ? standView(storyView(t), standW(t)) : storyView(t));
function storyView(t) {
  const wp = ST.wp, end = w => [w[1], w[2], w[3], w[4], w[5], w[6], w[8], ...w[9], ...w[10]];
  if (t <= wp[0][0]) return end(wp[0]);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? (q[7] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]) : 1, f = p[9], g = q[9], l = p[10], m = q[10];
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x, p[8] + (q[8] - p[8]) * x,
        f[0] + (g[0] - f[0]) * x, f[1] + (g[1] - f[1]) * x, f[2] + (g[2] - f[2]) * x, l[0] + (m[0] - l[0]) * x, l[1] + (m[1] - l[1]) * x];
    }
  }
  return end(wp[wp.length - 1]);
}

// In a headset a set may stand life size round you while it is the scene (the muscle story's Stand inside, the topo
// story's tower): the story's view eases into that set's STAND view, keeping the story's turn, its axis STAND_BACK
// further off than the view's target. The soil story keys none (ST.stand is empty: the field's life-size view is the
// field set's own option, SPEC.md); the lines stay so one can be added by time (ST.stand.push([t0, t1, t2, t3])). The
// weight follows the story's time alone, so at a shared-room station everyone sees the same size. On a screen nothing
// changes.
const STAND = ['field', 'stand'], STAND_BACK = 0;
// ST.stand: [t0, t1, t2, t3], in over t0..t1 and out over t2..t3 (story time)
const standW = t => ST.stand.reduce((w, [t0, t1, t2, t3]) => Math.max(w, Math.min(smooth((t - t0) / (t1 - t0)), smooth((t3 - t) / (t3 - t2)))), 0);
function standView(v, w) {
  if (w <= 0) return v;
  const s = view(...STAND), A = v[0] * D2R;
  s[3] += STAND_BACK * Math.sin(A); s[5] += STAND_BACK * Math.cos(A);   // (towards you: the target nearer, the axis further)
  v[1] += (s[1] - v[1]) * w;
  v[2] = Math.exp(Math.log(v[2]) + (Math.log(s[2]) - Math.log(v[2])) * w);
  for (let i = 3; i < 6; i++) v[i] += (s[i] - v[i]) * w;
  return v;
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
// a label whose text is a function (the radius and its counts, a slide picked, a window's share, a cell's score) is read again
// while it shows and redrawn when it changes: the HTML label, and the headset's sprite (dropped, so it is made again)
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
// Explore mode: the trial's field at any date with its measures (Field), the soil block's sketch with its three switches
// (Nitrogen), the cloud of kinds and the nitrifiers (Microbes), the co-occurrence network, its modules, a threshold, the
// shuffle and the split (Network); or any scene with its own controls (Scenes). Every number shown is looked up in
// SOIL_DATA (through SDATA and the sets' api()) or read off the slides (said so): nothing is computed here.
const SCENES = [
  ['soil', 'Soil', 'The cut-away block of soil with its wheat: fertiliser, the nitrogen\'s flows, a soil pore with the relay\'s microbes, the halo of the BNI wheat\'s roots and the chromosome. A sketch, not data.'],
  ['web', 'Globe', 'From the lab in Vienna to the field trial in Japan (the arc ends at JIRCAS\'s home in Tsukuba: the trial\'s site and year are not given).'],
  ['field', 'Field', `The trial's ${FACTS.plots} plots: two wheats, three regimes, ${FACTS.reps} plots of each, over ${FACTS.dates} dates; the leaves by their measured chlorophyll, nitrate under the plots, the jars' N2O and the ${FACTS.samples} samples. The plots' layout is illustrative.`],
  ['net', 'Microbes', `About ${thousands(FACTS.kinds)} kinds of microbe as a cloud (the ${fmt(FACTS.common)} common ones in its core) and the network of the ${fmt(FACTS.nodes)} that rise and fall together: its modules, a threshold, its halves.`],
];
const SCENE_SHORT = {};
// the panes' closing notes, the same on the page and in the headset (a pane's intro may be shorter in the headset)
const NOTE = {
  field: show => (show === 'n2o' ? `Two measurements, an open question: the data's own value is "the potential amount of produced nitrous oxide" (one number per sample, unit not given); the jars' peaks are read off the slides (N2O in ppm over a 20 to 22 day incubation of each date's soil). Over the season in fertilised soil the data gives ${FACTS.n2oMeta[0].toFixed(2)} against ${FACTS.n2oMeta[1].toFixed(2)} (${pTxt(FACTS.n2oMeta[2])}); the slides' model finds the wheat line significant on days ${FACTS.days[0]} to ${FACTS.days[3]}.`
    : show === 'chl' ? `Chlorophyll (SPAD) on days ${FACTS.days[0]} to ${FACTS.days[2]} is the data's; day ${FACTS.days[4]} is read off the slides (the data's last values match them, so their dates are an open question), and the slides show none on day ${FACTS.days[3]}.`
    : `Group means of ${FACTS.reps} plots (one sample is missing); p from the data's test of the two wheats at that date. ${show === 'ph' ? 'pH was not measured on every date.' : 'Ammonium and nitrate in mg N per kg dry soil.'}`),
  nitrogen: 'A sketch, not data: the soil block, its flows and their shares are a drawing. The BNI wheat\'s roots slow the relay\'s first step; the synthetic inhibitor DCD does it everywhere in the soil.',
  microbes: `Kinds are amplicon sequence variants (ASVs) from 16S rRNA gene reads, numbered by abundance among all ${fmt(FACTS.kinds)}; the cloud holds every common kind and a sample of the rest, its places a drawing (abundance inwards, each phylum a sector). Of the ${fmt(FACTS.common)} common kinds only ${word(FACTS.byLine)} differ between the wheats: a ${D.common.lineKinds.map(k => `${k.genus}, more under the ${k.more === 'BNI' ? 'BNI' : 'control'} wheat`).join(', and a ')} (q about ${D.common.lineKinds[0].q.toFixed(2)}).`,
  network: `Built for this story, not the authors' analysis: correlation, not interaction. Links join kinds whose centred log-ratios rise and fall together across the ${FACTS.samples} samples (Spearman's ρ of at least 0.6, false discovery rate under 5 %); modules by the Louvain method (their number depends on the run: about ${word(FACTS.big)} big ones). The links mostly reflect the fertiliser and the plots: with the plots' means taken out, ${fmt(FACTS.residual.plot.links)} are left. No hub is a keystone.`,
};
const TABS = [['field', 'Field'], ['nitrogen', 'Nitrogen'], ['microbes', 'Microbes'], ['network', 'Network'], ['scenes', 'Scenes']];
// the tour's web set: only its globe (with the engine's hop), so its own controls (the internet, the ties) stay out
const HIDE_CTL = { web: ['view', 'ties'] };
const OWN_CTL = {};
const isNum = () => false;
const allCtl = k => (GL.sets[k].controls || []).filter(c => !(HIDE_CTL[k] || []).includes(c.key)).concat(OWN_CTL[k] || []);
const ctlsOf = k => allCtl(k).filter(c => !isNum(k, c));
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries(allCtl(k).map(x => [x.key, ctlValue(k, x)])));
// whether a scene's slider applies now (the threshold, in the network)
const numShown = (k, key) => key === 'rho' && k === 'net' && netView() !== 'cloud';
const numOf = key => X[key];
// (explore opens on the field at day 70, chlorophyll, both wheats; each scene starts on the story's own choices)
const X = { tab: 'field', scene: 'field', t0: 0, turn: 'on',
  ctl: { soil: { view: 'default', fert: 'on', wheat: 'bni', dcd: 'off' }, field: { view: 'default', date: '4', show: 'chl', line: 'both', fert: 'all' },
    net: { view: 'net', colour: 'module', by: 'line' } },
  mod: -1, rho: 0.6, shuf: 0, kind: -1, plot: -1 };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['field_jday', 'field_module', 'field_pick', 'field_show', 'field_line', 'field_fert', 'net_focus', 'net_splitBy', 'net_kind', 'soil_pick']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a view option's camera: the one it stands for, or the cam view of the same name
const CAM_ALIAS = { soil: { pore: 'relay' }, net: {}, field: {} };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {};
  for (const x of [al[v], v]) if (x && c[x]) return x;
  return null;
}
// the control that chooses a scene's camera: its view
const VIEW_KEY = {};
const viewKey = k => VIEW_KEY[k] || 'view';
const viewCam = k => { const c = ctlOf(k, viewKey(k)); return c ? camFor(k, ctlValue(k, c)) : k === 'web' ? 'globe' : null; };
// the view on show in a set
const viewIs = (k, v) => { const c = ctlOf(k, viewKey(k)); return !!c && ctlValue(k, c) === v; };
// what the sets know (their api()): the field's plots and picking, the cloud's kinds, the network's modules and picking
const API = {};
const api = k => API[k] || (API[k] = (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null) || {});
// work for the next frame, once the sets have drawn what was just picked
const NEXT = [];
// what the panes choose, by name
const ctlv = (k, key) => { const c = ctlOf(k, key); return c ? ctlValue(k, c) : ''; };
const netView = () => ctlv('net', 'view');
const fieldDate = () => clamp(parseInt(ctlv('field', 'date'), 10) || 0, 0, 4);
const fieldShow = () => ctlv('field', 'show') || 'chl';
const SHOWS = ['chl', 'nh4', 'no3', 'n2o', 'ph'];
const BIG = D.net.mods.map((m, i) => i).filter(i => D.net.mods[i].n >= 100);
// a kind by its number (its abundance rank among all kinds): its index in the cloud, or -1 if the cloud does not hold it
function kindOfRank(r) {
  const R = SD.cloud.rank;
  let lo = 0, hi = R.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (R[m] < r) lo = m + 1; else hi = m; }
  return R[lo] === r ? lo : -1;
}

// the controls a set's explore() reads: its own, and the time since they changed
function ctlArgs(k, now) {
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of allCtl(k)) c[ct.key] = ctlValue(k, ct);
  return c;
}
// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
// (a plot group, a module, a threshold, the shuffle, a kind)
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = ctlArgs(k, now);
  if (s.explore) Object.assign(tg, s.explore(c));
  // the globe: only the globe, turning from Vienna to Japan while the hop draws its arc
  if (k === 'web') Object.assign(tg, { web_net: 0, web_globe: K.prog(c.t, 0, 1.2), web_ties: 0, web_spin: SPIN.vienna + (SPIN.japan - SPIN.vienna) * K.prog(c.t, 1, 7),
    hop_a: 1, hop_t: K.prog(c.t, 1.2, 6.5) });
  // the field: a plot group picked by hand
  // (the group picked lit whatever the wheat and regime chosen: those only dim plots while none is picked)
  if (k === 'field' && X.plot >= 0) Object.assign(tg, { field_pick: X.plot, field_tags: 1, field_line: -1, field_fert: -1 });
  if (k === 'net') {
    Object.assign(tg, { net_rho: X.rho, net_shuffle: X.shuf, net_focus: X.mod, net_kind: X.kind });
    if (X.mod >= 0 && netView() !== 'cloud') tg.net_mods = 1;
    // the field lies under the cloud and the network (a module lights the plots where it thrives), dim while it splits
    const fs = GL.sets.field, fc = ctlArgs('field', now);
    fc.t = 1e3;
    Object.assign(tg, fs.params, fs.explore ? fs.explore(fc) : {}, { field_a: netView() === 'split' ? 0.2 : X.mod >= 0 ? 1 : 0.7, field_jars: 0, field_cores: 0,
      field_stack: 0, field_tags: 0, field_pick: -1, field_line: -1, field_fert: -1, field_module: X.mod, field_mlit: X.mod >= 0 && netView() !== 'cloud' ? 1 : 0 });
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : LOG.has(n) ? logMix(XS[n], tg[n], k) : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it or a set asks for stillness
  if (X.turn === 'on' && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets)
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (!GL.sets[k] || !SCENES.some(s => s[0] === k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) { flyTo(view(k, viewCam(k) || 'default')); sfxAct('whoosh', k, null, { dur: 0.8 }); }   // (sound effects: another scene)
  renderAll();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  if (ctlValue(k, c) !== v) ctlSound(k, key, v);
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // (a wheat or a regime chosen: the group picked by hand gives way to it)
  if (k === 'field' && (key === 'line' || key === 'fert')) X.plot = -1;
  // a view has its own best camera
  if (key === viewKey(k) && k === X.scene) { const n = camFor(k, v); flyTo(view(k, n || 'default')); }
  renderAll();
}
// (sound effects: a control changed: the jars bubble, the split swings out, a measure washes over the field, the soil
// block's flows change, a date steps on)
function ctlSound(k, key, v) {
  const o = key === viewKey(k) ? (v === 'jars' ? ['bubble', k, 'jars'] : ['whoosh', k, v === 'split' ? 'mid' : null, { dur: 0.7, pitch: 1.1 }])
    : k === 'soil' ? ['rush', k, 'nh4', { dur: 1.5, gain: 0.7 }] : key === 'show' ? ['grow', k, 'field', { dur: 1 }] : key === 'colour' ? ['grow', k, 'net', { dur: 1, pitch: 1.2 }]
    : key === 'by' ? ['whoosh', k, 'mid', { dur: 0.7 }] : key === 'date' ? ['step', k, 'field', { pitch: Math.pow(2, 2 * (+v) / 12) }] : ['step', k, null];
  sfxAct(...o);
}
// a view of a set, its scene brought up
function showView(k, v) { if (X.scene !== k) openScene(k); if (!viewIs(k, v)) setCtl(k, viewKey(k), v); }
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
// the threshold of the links drawn (0.6 to 0.8, to the hundredth): only the strongest links, the stored ones a prefix
function setRho(v, ui = true) {
  const r = clamp(Math.round(+v * 100) / 100, 0.6, 0.8);
  if (!Number.isFinite(r) || r === X.rho) return;
  if (Math.floor(r * 50 + 1e-6) !== Math.floor(X.rho * 50 + 1e-6)) sfxAct('step', 'net', 'net', { pitch: Math.pow(2, (r - 0.6) * 5) });   // (sound effects: each 0.02 crossed)
  X.rho = r;
  if (ui) { if (X.scene !== 'net') openScene('net'); if (netView() === 'cloud') setCtl('net', 'view', 'net'); }
  syncNums();
}
const setNum = (key, v, ui) => ({ rho: setRho }[key] || (() => {}))(v, ui);
// a module (-1 none): its kinds lit, the rest dimmed, and the plots where it thrives lit below
function selectModule(m, ui = true) {
  const n = D.net.mods.length;
  const was = X.mod;
  X.mod = Number.isInteger(m) && m >= 0 && m < n ? m : -1;
  if (X.mod >= 0 && X.mod !== was) sfxAct('pulse', 'net', 'm' + X.mod);   // (sound effects: a module lit)
  if (ui && X.mod >= 0) {
    if (X.scene !== 'net') openScene('net');
    if (netView() !== 'net') setCtl('net', 'view', 'net');
    if (ctlv('net', 'colour') !== 'module') setCtl('net', 'colour', 'module');
  }
  renderAll();
}
const stepModule = d => { const n = D.net.mods.length; selectModule(X.mod < 0 ? (d > 0 ? 0 : n - 1) : (X.mod + d + n) % n); };
// the shuffle (0 the network, 1 the samples shuffled: not one link left)
function setShuffle(on, ui = true) {
  // (sound effects: the links snap and fall away; shuffled back, they come again)
  if ((on ? 1 : 0) !== X.shuf) { if (on) { sfxAct('snap', 'net', 'net'); sfxAct('patter', 'net', 'net', { dur: 1.5, delay: 0.1, gain: 0.6 }); } else sfxAct('rise', 'net', 'net', { dur: 1 }); }
  X.shuf = on ? 1 : 0;
  if (ui) { if (X.scene !== 'net') openScene('net'); if (netView() === 'cloud') setCtl('net', 'view', 'net'); }
  renderAll();
}
// the split: off (the whole network) or by wheat line, fertiliser or at random
function setSplit(by) {
  if (X.scene !== 'net') openScene('net');
  if (by === 'off') { if (netView() === 'split') setCtl('net', 'view', 'net'); }
  else { setCtl('net', 'by', by); if (netView() !== 'split') setCtl('net', 'view', 'split'); }
  renderAll();
}
// a kind of the cloud (-1 none): its bubble, its links and its numbers
function selectKind(i, ui = true) {
  const n = api('net').n || 0;
  const was = X.kind;
  X.kind = Number.isInteger(i) && i >= 0 && i < n ? i : -1;
  if (X.kind >= 0 && X.kind !== was) sfxAct('pick', 'net', api('net').pos ? api('net').pos(X.kind) : null);   // (sound effects: a kind picked, at it)
  if (ui && X.kind >= 0) {
    if (X.scene !== 'net') openScene('net');
    if (netView() === 'split') setCtl('net', 'view', api('net').nodeOf(X.kind) >= 0 ? 'net' : 'cloud');
    if (netView() === 'net' && api('net').nodeOf(X.kind) < 0) setCtl('net', 'view', 'cloud');
    NEXT.push(() => { if (X.scene !== 'net' || X.kind < 0) return; flyNear(api('net').pos(X.kind), Math.min(orbit.cur[2], 1.6)); });
  }
  renderAll();
}
// a group of plots (line * 3 + fert, -1 none): lit, the others dimmed, with tags of the measure on show
function selectPlot(g, ui = true) {
  const was = X.plot;
  X.plot = Number.isInteger(g) && g >= 0 && g < 6 ? g : -1;
  if (X.plot >= 0 && X.plot !== was) sfxAct('pick', 'field', X.plot < 3 ? 'bni' : 'ctrl');   // (sound effects: a group of plots picked)
  if (ui && X.plot >= 0 && X.scene !== 'field') openScene('field');
  renderAll();
}
// the field's measure picked by hand: N2O brings the jars into view (the data's N2O is the jars' soil, see NOTE.field)
function pickShow(v) {
  sceneCtl('field', 'show', v);
  if (v === 'n2o' && !viewIs('field', 'jars')) showView('field', 'jars');
}
// a control of a scene picked from a tab: its scene brought up
function sceneCtl(k, key, v) {
  if (X.scene !== k) openScene(k);
  setCtl(k, key, v);
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls (the soil
// block's switches, the field's view, date, measure, wheat and regime, the microbes' view, colour and split), the
// module picked, the threshold, the shuffle, the kind picked and the group of plots picked. The camera is each
// person's own.
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
  return { tab: X.tab, scene: X.scene, ctl, mod: X.mod, rho: X.rho, shuf: X.shuf, kind: X.kind, plot: X.plot };
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
  // then the numbers and the picks (the threshold as the slider rounds it, so state() reports what was applied)
  const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi, okNum = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
  if (okNum(v.rho, 0.6, 0.8) && Math.round(v.rho * 100) / 100 !== X.rho) setRho(v.rho, false);
  if ((v.shuf === 0 || v.shuf === 1) && v.shuf !== X.shuf) setShuffle(v.shuf === 1, false);
  if (int(v.mod, -1, D.net.mods.length - 1) && v.mod !== X.mod) selectModule(v.mod, false);
  if (int(v.kind, -1, (api('net').n || 1) - 1) && v.kind !== X.kind) selectKind(v.kind, false);
  if (int(v.plot, -1, 5) && v.plot !== X.plot) selectPlot(v.plot, false);
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
// a slider the panes hold (the threshold), with its value; it changes in place, so a drag is not cut short by a redraw
const NUM = { rho: { label: 'Rising together at least', min: 0.6, max: 0.8, step: 0.01, col: CYAN, text: v => `ρ ${v.toFixed(2)}` } };
const sOf = (o, v) => v, vOf = (o, s) => s;
const slider = key => { const o = NUM[key], v = numOf(key);
  return `<p class="grp-h">${o.label} <b data-numv="${key}" style="margin-left:auto;color:var(--ink)">${esc(o.text(v))}</b></p>
    <input type="range" data-num="${key}" min="${o.min}" max="${o.max}" step="${o.step}" value="${sOf(o, v)}" aria-label="${o.label}" style="accent-color:${o.col}">`; };
const statsHtml = rows => `<dl class="stats">${rows.map(([k, v, more]) => `<dt>${esc(k)}</dt><dd>${esc(v)}${more ? `<small>${esc(more)}</small>` : ''}</dd>`).join('')}</dl>`;
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
      view: () => { const [k, w] = v.split(':'); showView(k, w); }, scene: () => openScene(v),
      ctl: () => ((b.dataset.scene || X.scene) === 'field' && b.dataset.ctl === 'show' && X.tab === 'field' ? pickShow(v) : sceneCtl(b.dataset.scene || X.scene, b.dataset.ctl, v)),
      mod: () => (v === 'none' ? selectModule(-1) : v === 'prev' ? stepModule(-1) : v === 'next' ? stepModule(1) : selectModule(+v)),
      shuf: () => setShuffle(!X.shuf), split: () => setSplit(v), kind: () => selectKind(v === 'none' ? -1 : +v), plot: () => selectPlot(v === 'none' ? -1 : +v),
      replay: () => { X.t0 = performance.now(); },
    }[b.dataset.act] || (() => {}))();
  });
  // the sliders change in place, so a drag is not cut short by a redraw
  $('#explore').addEventListener('input', ev => {
    const k = ev.target.dataset.num;
    if (NUM[k]) setNum(k, vOf(NUM[k], +ev.target.value), true);
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
  if (k === 'field' && X.scene !== 'field') openScene('field');
  if (k === 'nitrogen' && X.scene !== 'soil') openScene('soil');
  if (k === 'microbes') { if (X.scene !== 'net') openScene('net'); if (netView() !== 'cloud') setCtl('net', 'view', 'cloud'); if (ctlv('net', 'colour') === 'module') setCtl('net', 'colour', 'phylum'); }
  if (k === 'network') { if (X.scene !== 'net') openScene('net'); if (netView() === 'cloud') setCtl('net', 'view', 'net'); }
  renderAll();
}
function renderAll() { renderField(); renderNitrogen(); renderMicrobes(); renderNetwork(); renderScenes(); updateExtraLabels(); }
// the numbers that follow a slider, redrawn in place (the sliders themselves keep still while dragged)
function syncNums() {
  for (const k in NUM) {
    document.querySelectorAll(`[data-numv="${k}"]`).forEach(el => { el.textContent = NUM[k].text(numOf(k)); });
    document.querySelectorAll(`input[data-num="${k}"]`).forEach(el => { if (document.activeElement !== el) el.value = sOf(NUM[k], numOf(k)); });
  }
  const live = { network: () => statsHtml(netInfo().rows) };
  for (const k in live) document.querySelectorAll(`[data-live="${k}"]`).forEach(el => { el.innerHTML = live[k](); });
}

// ----------------------------------------------------------------- field --
const MEASURE = { chl: ['Chlorophyll', 'SPAD', 1], nh4: ['Ammonium', 'mg N/kg', 1], no3: ['Nitrate', 'mg N/kg', 1], n2o: ['N2O', 'potential, unit not given', 2], ph: ['pH', '', 2] };
const dateTxt = t => `Day ${FACTS.days[t]} · ${FACTS.stages[t]}`;
// a measure of one group at a date, as the panes print it: { v (the mean or the slides' reading), p, how }
function measureOf(key, line, fert, time) {
  if (key === 'chl') {
    if (time === 4) return { v: SD.chl70(fert, line).v, p: null, how: 'read off the slides' };
    if (time === 3) return { v: null, p: null, how: `none on day ${FACTS.days[3]}` };
  }
  const m = SD.meta(key, line, fert, time), tst = SD.lineTest(key, fert, time);
  return { v: m.mean, sd: m.sd, n: m.n, p: tst ? tst[2] : null, how: '' };
}
// the Field pane in words (both panels): the measure at the date for each regime, BNI against control, or one group picked
function fieldInfo() {
  const show = fieldShow(), t = fieldDate(), [name, unit, dp] = MEASURE[show];
  const rows = [0, 1, 2].map(f => {
    const b = measureOf(show, 0, f, t), c = measureOf(show, 1, f, t);
    return [FERT_NAME[f], `${num(b.v, dp)} · ${num(c.v, dp)}`, b.how || pTxt(b.p)];
  });
  // the jars' peaks for the date (read off the slides) with the data's N2O
  const jars = show === 'n2o' ? [0, 1, 2].map(f => { const pk = D.figs.n2o.peaks[t][f]; return [FERT_NAME[f], `${num(pk[0], 2)} · ${num(pk[1], 2)} ppm`, D.figs.n2o.p[t][f]]; }) : null;
  let pick = null;
  if (X.plot >= 0) {
    const line = Math.floor(X.plot / 3), fert = X.plot % 3, me = measureOf(show, line, fert, t), other = measureOf(show, 1 - line, fert, t);
    pick = { head: `${LINE_NAME[line]}, ${FERT_NAME[fert].toLowerCase()}`, col: LINE_COL[line], rows: [
      [name, me.v === null ? '–' : `${num(me.v, dp)}${unit && show !== 'n2o' ? ' ' + unit : ''}`, me.how || (me.sd !== undefined && me.sd !== null ? `± ${num(me.sd, dp)}, ${me.n} plots` : '')],
      [LINE_NAME[1 - line], num(other.v, dp), other.how || pTxt(me.p)]] };
  }
  return { head: `${name} · ${dateTxt(t)}`, sub: `BNI wheat · control wheat${unit && show !== 'n2o' ? ` (${unit})` : show === 'n2o' ? ' (the data: potential, unit not given)' : ''}`, rows, jars, pick };
}
const DATE_OPTS = () => ctlOf('field', 'date').options;
function renderField() {
  const pane = $('#pane-field');
  if (!pane || !ctlOf('field', 'date')) return;
  const on = X.scene === 'field', I = fieldInfo(), opts = key => ctlOf('field', key).options;
  const chips = (key, cols) => `<div class="chips">${opts(key).map(([o, n], i) => chip(`data-act="ctl" data-scene="field" data-ctl="${key}" data-v="${o}"`, esc(n), ctlv('field', key) === o, cols ? cols(o, i) : null)).join('')}</div>`;
  pane.innerHTML = `<p class="sub">The trial's ${FACTS.plots} plots: the BNI wheat and the control wheat, each with no fertiliser, with fertiliser and with fertiliser + DCD, ${word(FACTS.reps)} plots of each. Click a plot (or point at it and pull the trigger) to pick its group.</p>
    <p class="grp-h">Date</p>${chips('date')}
    <p class="grp-h">Show</p>${chips('show')}
    <p class="grp-h">Wheat</p>${chips('line', o => (o === '0' ? LINE_COL[0] : o === '1' ? LINE_COL[1] : null))}
    <p class="grp-h">Regime</p>${chips('fert', o => (o === 'all' ? null : FERT_COL[+o]))}
    <p class="grp-h">View</p><div class="chips">${opts('view').map(([o, n]) => chip(`data-act="view" data-v="field:${o}"`, esc(n), on && ctlv('field', 'view') === o)).join('')}</div>
    <h3>${esc(I.head)}</h3><p class="sub">${esc(I.sub)}</p>${statsHtml(I.rows)}
    ${I.jars ? `<p class="grp-h">The jars' peaks (read off the slides): BNI · control</p>${statsHtml(I.jars)}` : ''}
    ${I.pick ? `<h3 style="color:${inkCol(I.pick.col)}">${esc(I.pick.head)}</h3>${statsHtml(I.pick.rows)}<div class="chips">${chip('data-act="plot" data-v="none"', 'None', false)}</div>` : ''}
    <p class="note">${esc(NOTE.field(fieldShow()))}</p>`;
}

// -------------------------------------------------------------- nitrogen --
function renderNitrogen() {
  const pane = $('#pane-nitrogen');
  if (!pane || !ctlOf('soil', 'view')) return;
  const on = X.scene === 'soil';
  pane.innerHTML = `<p class="sub">A sketch, not data: the soil block with fertiliser, the BNI wheat's roots and the synthetic inhibitor. Switch them, and watch where the nitrogen goes.</p>
    ${ctlsOf('soil').map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([o, n]) => chip(`data-act="ctl" data-scene="soil" data-ctl="${c.key}" data-v="${o}"`, esc(n), (c.key !== 'view' || on) && ctlValue('soil', c) === o)).join('')}</div>`).join('')}
    <div class="chips">${chip('data-act="replay"', 'Replay the flows', false)}</div>
    <p class="note">${esc(NOTE.nitrogen)}</p>`;
}

// -------------------------------------------------------------- microbes --
// the nitrifiers' shares of reads by regime and by wheat line (both panels)
function guildRows() {
  return D.guilds.keys.map(k => { const G = D.guilds[k]; return [G.name, `${G.byFert.map(v => v.toFixed(2)).join(' · ')} %`, `BNI ${G.byLine[0].toFixed(2)} · control ${G.byLine[1].toFixed(2)}`]; });
}
// a kind picked, in words (both panels)
function kindInfo() {
  if (X.kind < 0 || !api('net').info) return null;
  const I = api('net').info(X.kind), sh = I.share;
  const rows = [['Phylum', I.phylum], ['In samples', `${I.prev} of ${I.samples}`], ['Share of reads', `${sh >= 0.01 ? sh.toFixed(sh >= 1 ? 1 : 2) : sh.toPrecision(1)} %`, 'on average']];
  if (I.guild) rows.push(['Nitrifier', I.guild]);
  rows.push(['Differs by', I.differs ? (I.differs.length ? I.differs.join(', ') : 'none found') : 'not tested', I.differs ? 'fertiliser, date, wheat line or plot' : 'a rare kind']);
  rows.push(['Network', I.node >= 0 ? `${fmt(I.links)} links${I.module >= 0 ? `, module ${I.module + 1}` : ''}` : 'not in it']);
  return { head: `Kind ${fmt(I.rank)}${I.name ? ' · ' + I.name : ''}`, rows };
}
function renderMicrobes() {
  const pane = $('#pane-microbes');
  if (!pane || !ctlOf('net', 'colour')) return;
  const col = ctlv('net', 'colour'), K2 = kindInfo();
  pane.innerHTML = `<p class="sub">About ${thousands(FACTS.kinds)} kinds of microbe in this soil, as a cloud: the ${fmt(FACTS.common)} common ones (${pct(FACTS.readShare)} of the reads) in its core. Click a kind (or point at it and pull the trigger) to pick it.</p>
    <p class="grp-h">Colour</p><div class="chips">${[['phylum', 'Phylum'], ['guild', 'Nitrifiers']].map(([o, n]) => chip(`data-act="ctl" data-scene="net" data-ctl="colour" data-v="${o}"`, n, col === o)).join('')}${chip('data-act="view" data-v="net:cloud"', 'The crowd', X.scene === 'net' && netView() === 'cloud')}</div>
    <p class="grp-h">The nitrifiers' share of reads: not fertilised · fertilised · + DCD</p>${statsHtml(guildRows())}
    ${K2 ? `<h3>${esc(K2.head)}</h3>${statsHtml(K2.rows)}<div class="chips">${chip('data-act="kind" data-v="none"', 'None', false)}</div>` : '<p class="sub">No kind picked.</p>'}
    <p class="note">${esc(NOTE.microbes)}</p>`;
}

// --------------------------------------------------------------- network --
// a module in words (both panels): its size, phyla, best-known genera, what its ups and downs go with, its nitrifiers
const R2W = [['fert', 'fertiliser'], ['time', 'date'], ['line', 'wheat line'], ['plot', 'plot']];
function moduleInfo(m) {
  const M = D.net.mods[m];
  if (!M) return null;
  const GSHORT = { aoa: 'archaea', nsp: 'Nitrosospira', nsm: 'Nitrosomonas', nit: 'Nitrospira', mnd: 'of unknown role' };
  const gk = Object.entries(M.guilds || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${GSHORT[k] || D.guilds[k].name}`);
  return { head: `Module ${m + 1} · ${fmt(M.n)} kinds`, col: SLOOK.module(m), rows: [
    ['Follows', api('net').follows ? api('net').follows(m) : '', R2W.map(([k, w]) => `${w} ${pct(M.r2[k])}`).join(', ')],
    ['Phyla', M.phyla.map(([p, n]) => `${p} ${n}`).join(', ')],
    ['Best known', M.top.map(([g]) => g).join(', ')],
    ['Nitrifiers', gk.length ? gk.join(', ') : 'none']] };
}
// the network at the threshold, the shuffle and the split, in words (both panels)
function netInfo() {
  const A = api('net'), sp = D.net.splits, cut = SD.net.cut(X.rho), v = netView(), by = ctlv('net', 'by');
  const rows = [['Links', X.shuf ? `${fmt(D.net.null.links)} (shuffled)` : fmt(cut), X.shuf ? 'each kind\'s samples shuffled on its own' : `of ${fmt(FACTS.links)} at 0.60`],
    ['Kinds', A.nodesAt ? fmt(A.nodesAt(X.rho)) : '', 'with a link']];
  if (v === 'split') {
    const L = by === 'fert' ? sp.fert.map((s, i) => [FERT_NAME[i], `${fmt(s.links)} links`, `${s.samples} samples`]) : by === 'random' ? [['Half A', `${fmt(sp.random[0][0])} links`, '59 samples'], ['Half B', `${fmt(sp.random[0][1])} links`, '60 samples']]
      : sp.line.map((s, i) => [LINE_NAME[i], `${fmt(s.links)} links`, `${s.samples} samples`]);
    rows.push(...L);
    if (by !== 'fert') rows.push(['Apart', fmt(by === 'random' ? Math.abs(sp.random[0][0] - sp.random[0][1]) : sp.lineDiff), `random halves: ${fmt(sp.randomDiff[0])} to ${fmt(sp.randomDiff[1])}`]);
  }
  return { rows };
}
const SPLIT_OPTS = [['off', 'Off'], ['line', 'Wheat line'], ['fert', 'Fertiliser'], ['random', 'At random']];
const splitNow = () => (netView() === 'split' ? ctlv('net', 'by') : 'off');
function renderNetwork() {
  const pane = $('#pane-network');
  if (!pane || !ctlOf('net', 'colour')) return;
  const col = ctlv('net', 'colour'), M = X.mod >= 0 ? moduleInfo(X.mod) : null;
  pane.innerHTML = `<p class="sub">The ${fmt(FACTS.nodes)} kinds that rise and fall together across the ${FACTS.samples} samples. Pick a module to light the plots where it thrives; shuffle the samples; split the samples in two.</p>
    <p class="grp-h">Colour</p><div class="chips">${[['module', 'Module'], ['phylum', 'Phylum'], ['guild', 'Nitrifiers']].map(([o, n]) => chip(`data-act="ctl" data-scene="net" data-ctl="colour" data-v="${o}"`, n, col === o)).join('')}</div>
    <p class="grp-h">Module</p><div class="chips">${BIG.map(m => chip(`data-act="mod" data-v="${m}"`, `${m + 1}`, X.mod === m, SLOOK.module(m))).join('')}${chip('data-act="mod" data-v="prev"', '‹', false)}${chip('data-act="mod" data-v="next"', '›', false)}${chip('data-act="mod" data-v="none"', 'None', X.mod < 0)}</div>
    ${M ? `<h3 style="color:${inkCol(M.col)}">${esc(M.head)}</h3>${statsHtml(M.rows)}` : ''}
    ${slider('rho')}
    <p class="sub">At 0.55, ${fmt(FACTS.thresholds.find(x => x.rho === 0.55).links)} links; at 0.5, ${fmt(FACTS.thresholds.find(x => x.rho === 0.5).links)}: too many to draw.</p>
    <div class="chips">${chip('data-act="shuf"', X.shuf ? 'Unshuffle' : 'Shuffle the samples', !!X.shuf)}</div>
    <p class="grp-h">Split by</p><div class="chips">${SPLIT_OPTS.map(([o, n]) => chip(`data-act="split" data-v="${o}"`, n, splitNow() === o)).join('')}</div>
    <div data-live="network">${statsHtml(netInfo().rows)}</div>
    <p class="note">${esc(NOTE.network)}</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${Object.keys(NUM).filter(key => numShown(X.scene, key)).map(slider).join('')}
    <p class="grp-h">About</p><p class="credits">${esc(ABOUT)}</p>`;
}
// labels the panes add (none: the sets label their own picks)
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { kind } (a kind of the cloud or
// the network) or { plot } (a plot of the field), or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || !['field', 'net'].includes(X.scene)) return null;
  const A = api(X.scene);
  let r = null;
  try { r = A.pick ? A.pick(rc) : null; } catch (e) { return null; }
  if (r === null || r === undefined) return null;
  if (X.scene === 'net') return r.kind === 'kind' ? { kind: r.i } : null;
  const p = typeof r === 'number' ? r : r.plot !== undefined ? r.plot : r.p !== undefined ? r.p : r.i;
  return Number.isInteger(p) && p >= 0 && p < FACTS.plots ? { plot: p } : null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null (then where the ray meets the scene)
function pickPos(p) {
  if (p.kind !== undefined && api('net').pos) return api('net').pos(p.kind);
  if (p.plot !== undefined && api('field').plotXZ) { const q = api('field').plotXZ(p.plot); return [q[0], 0.06, q[2]]; }
  return null;
}
function pickText(p) {
  if (p.kind !== undefined) return api('net').kindText ? api('net').kindText(p.kind) : ['', ''];
  if (p.plot !== undefined) {
    const o = SD.ofPlot(p.plot), [name, , dp] = MEASURE[fieldShow()];
    return [LINE_NAME[o.line], ` · ${FERT_NAME[o.fert].toLowerCase()} · ${name === 'N2O' || name === 'pH' ? name : name.toLowerCase()} ${num(plotValue(p.plot), dp)}`];
  }
  return ['', ''];
}
// a plot's own value of the measure on show at the date (the data's; chlorophyll's last date from the slides, its group's)
function plotValue(p) {
  const o = SD.ofPlot(p), show = fieldShow(), t = fieldDate();
  if (show === 'chl' && t >= 3) return measureOf(show, o.line, o.fert, t).v;
  const v = SD.value(show, SD.slot(o.line, o.fert, t, o.rep));
  return v === null || v === undefined ? measureOf(show, o.line, o.fert, t).v : v;
}
// a click (or the trigger) on a kind picks it (again: none); on a plot, its group (again: none)
function choosePick(p) {
  if (!p) return;
  if (p.kind !== undefined) {
    if (X.tab !== 'microbes' && X.tab !== 'network') showTab(netView() === 'cloud' ? 'microbes' : 'network');
    selectKind(p.kind === X.kind ? -1 : p.kind, false);
  } else if (p.plot !== undefined) {
    const o = SD.ofPlot(p.plot), g = o.line * 3 + o.fert;
    if (X.tab !== 'field') showTab('field');
    selectPlot(g === X.plot ? -1 : g, false);
  }
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
// the slide, the cell or the loop a controller points at, labelled where the ray meets it
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

// --------------------------------------------------- picking a slide --
// The slide, the cell, the loop or the bar a ray points at in explore mode (see pickWith), or null
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
    // the scene counts as a ball around the view's target; a slide, a cell or a loop counts if the ray passes close
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
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.mod, X.rho, X.shuf, X.kind, X.plot, XR.on].join('|');
}
const XR_HERE = 'soil';
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
  fitTitle(ctx, 'Holding on to nitrogen', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
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
  ({ field: drawFieldPane, nitrogen: drawNitrogenPane, microbes: drawMicrobesPane, network: drawNetworkPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// buttons that wrap like the HTML chips: items -> { id, label, on, col, ink, fn } (no fn: a plain chip)
function flow(ctx, P, items, x, y, W, maxY, o = {}) {
  const px = o.px || 22, h = o.h || 44, gap = 8;
  let cx = x, cy = y;
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
// rows of a name (muted) and its value (ink), as the HTML's dl.stats
// (kw: the names' column, wider where they are long, as the windows of radii)
function stats(ctx, x, y, W, rows, kw = 220) {
  let yy = y;
  for (const [k, v, more] of rows) {
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, k, kw - 10), x, yy + 3);
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(v, x + kw, yy);
    if (more) { const w = ctx.measureText(v).width; ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, more, W - kw - 20 - w), x + kw + 16 + w, yy + 4); }
    yy += 38;
  }
  return yy - y;
}
// a slider the panes hold (a radius or an end of the window): its name, its value and the slider under them (a radius
// slides on the log ruler, as on the page)
function numRow(ctx, P, key, x, y, W) {
  const o = NUM[key], v = numOf(key);
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(o.label, x, y + 2);
  ctx.font = vfont(24, 700); ctx.fillStyle = VC.ink; ctx.textAlign = 'right'; ctx.fillText(o.text(v), x + W, y); ctx.textAlign = 'left';
  vSlider(ctx, P, 'num:' + key, x + 14, y + 28, W - 28, sOf(o, v), o.log ? 0 : o.min, o.log ? 1000 : o.max, o.col, s => setNum(key, vOf(o, s), true));
  return 28 + 48 + 12;
}
// a closing note in the room left, if any
const footNote = (ctx, text, x, y, W, bottom) => { if (y + 60 < bottom) textBlock(ctx, text, x, y, W, 21, 29, VC.faint, 400, Math.max(1, Math.min(4, Math.floor((bottom - y) / 29)))); };
// the explore panes' canvas twins (Field, Nitrogen, Microbes, Network, Scenes): the same choices and numbers as the HTML
// panes (renderField and the others in e4_explore.js); keep both twins in step
// (the chips of a control of a scene; cols(o) a swatch's colour)
const ctlChips = (k, key, cols, onIf) => ctlOf(k, key).options.map(([o, n]) => ({ id: k + ':' + key + ':' + o, label: n, col: cols ? cols(o) : null,
  on: (onIf ? onIf() : true) && ctlValue(k, ctlOf(k, key)) === o, fn: () => sceneCtl(k, key, o) }));
function drawFieldPane(ctx, P, x, y, W, bottom) {
  const on = X.scene === 'field', I = fieldInfo(), o = { px: 21, h: 44 };
  y += textBlock(ctx, `The trial's ${FACTS.plots} plots: two wheats, three regimes, ${word(FACTS.reps)} plots of each. Point at a plot and pull the trigger to pick its group.`, x, y, W, 23, 32, VC.muted, 400, 2) + 8;
  y += head(ctx, x, y, 'Date');
  y += flow(ctx, P, ctlChips('field', 'date'), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, ctlChips('field', 'show').map(c => Object.assign(c, { fn: () => pickShow(c.id.split(':')[2]) })), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Wheat and regime');
  y += flow(ctx, P, ctlChips('field', 'line', v => (v === '0' ? LINE_COL[0] : v === '1' ? LINE_COL[1] : null)).concat(
    ctlChips('field', 'fert', v => (v === 'all' ? null : FERT_COL[+v]))), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'View');
  y += flow(ctx, P, ctlChips('field', 'view', null, () => on).map(c => Object.assign(c, { fn: () => showView('field', c.id.split(':')[2]) })), x, y, W, bottom, o) + 12;
  y += textBlock(ctx, I.head, x, y, W, 26, 34, VC.ink, 700, 1) + 2;
  y += textBlock(ctx, I.sub, x, y, W, 21, 28, VC.muted, 400, 1) + 6;
  y += stats(ctx, x, y, W, I.rows) + 6;
  if (I.jars) { y += head(ctx, x, y, 'The jars\' peaks (read off the slides): BNI · control'); y += stats(ctx, x, y, W, I.jars) + 6; }
  if (I.pick && y + 140 < bottom) {
    y += textBlock(ctx, I.pick.head, x, y, W - 140, 25, 34, I.pick.col, 700, 1) + 4;
    vButton(ctx, P, 'plot:none', x + W - 120, y - 44, 120, 40, 'None', () => selectPlot(-1), { px: 20, r: 6 });
    y += stats(ctx, x, y, W, I.pick.rows) + 6;
  }
  footNote(ctx, NOTE.field(fieldShow()), x, y, W, bottom);
}
function drawNitrogenPane(ctx, P, x, y, W, bottom) {
  const on = X.scene === 'soil';
  y += textBlock(ctx, 'A sketch, not data: the soil block with fertiliser, the BNI wheat\'s roots and the synthetic inhibitor. Switch them, and watch where the nitrogen goes.', x, y, W, 24, 34, VC.muted, 400, 3) + 14;
  for (const c of ctlsOf('soil')) {
    y += head(ctx, x, y, c.label);
    y += flow(ctx, P, ctlChips('soil', c.key, null, () => c.key !== 'view' || on), x, y, W, bottom, { px: 23, h: 54 }) + 14;
  }
  y += flow(ctx, P, [{ id: 'replay', label: 'Replay the flows', fn: () => { X.t0 = performance.now(); } }], x, y, W, bottom, { px: 23, h: 54 }) + 18;
  footNote(ctx, NOTE.nitrogen, x, y, W, bottom);
}
function drawMicrobesPane(ctx, P, x, y, W, bottom) {
  const col = ctlv('net', 'colour'), K2 = kindInfo();
  y += textBlock(ctx, `About ${thousands(FACTS.kinds)} kinds of microbe as a cloud: the ${fmt(FACTS.common)} common ones (${pct(FACTS.readShare)} of the reads) in its core. Point at a kind and pull the trigger to pick it.`, x, y, W, 23, 32, VC.muted, 400, 3) + 10;
  y += head(ctx, x, y, 'Colour');
  y += flow(ctx, P, [['phylum', 'Phylum'], ['guild', 'Nitrifiers']].map(([o, n]) => ({ id: 'col:' + o, label: n, on: col === o, fn: () => sceneCtl('net', 'colour', o) }))
    .concat([{ id: 'crowd', label: 'The crowd', on: X.scene === 'net' && netView() === 'cloud', fn: () => showView('net', 'cloud') }]), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'The nitrifiers\' share of reads: not fertilised · fertilised · + DCD');
  ctx.font = vfont(21);
  for (const [n, v, more] of guildRows()) {
    if (y + 60 > bottom) break;
    ctx.font = vfont(22, 700); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, n, W * 0.48), x, y);
    ctx.font = vfont(22); ctx.fillText(v, x + W * 0.5, y);
    ctx.font = vfont(19); ctx.fillStyle = VC.muted; ctx.fillText(more, x + W * 0.5, y + 27);
    y += 58;
  }
  y += 8;
  if (K2) {
    y += textBlock(ctx, K2.head, x, y, W - 140, 26, 34, VC.cyan, 700, 1) + 4;
    vButton(ctx, P, 'kind:none', x + W - 120, y - 44, 120, 40, 'None', () => selectKind(-1), { px: 20, r: 6 });
    y += stats(ctx, x, y, W, K2.rows) + 8;
  } else y += textBlock(ctx, 'No kind picked.', x, y, W, 22, 30, VC.muted, 400, 1) + 8;
  footNote(ctx, NOTE.microbes, x, y, W, bottom);
}
function drawNetworkPane(ctx, P, x, y, W, bottom) {
  const col = ctlv('net', 'colour'), M = X.mod >= 0 ? moduleInfo(X.mod) : null, o = { px: 22, h: 48 };
  y += textBlock(ctx, `The ${fmt(FACTS.nodes)} kinds that rise and fall together across the ${FACTS.samples} samples. Pick a module to light the plots where it thrives.`, x, y, W, 23, 32, VC.muted, 400, 2) + 8;
  y += head(ctx, x, y, 'Colour');
  y += flow(ctx, P, [['module', 'Module'], ['phylum', 'Phylum'], ['guild', 'Nitrifiers']].map(([v, n]) => ({ id: 'col:' + v, label: n, on: col === v, fn: () => sceneCtl('net', 'colour', v) })), x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Module');
  y += flow(ctx, P, BIG.map(m => ({ id: 'mod:' + m, label: `${m + 1}`, col: SLOOK.module(m), on: X.mod === m, fn: () => selectModule(m) }))
    .concat([{ id: 'mod:prev', label: '‹', fn: () => stepModule(-1) }, { id: 'mod:next', label: '›', fn: () => stepModule(1) }, { id: 'mod:none', label: 'None', on: X.mod < 0, fn: () => selectModule(-1) }]), x, y, W, bottom, o) + 8;
  if (M) { y += textBlock(ctx, M.head, x, y, W, 25, 33, M.col, 700, 1) + 2; y += stats(ctx, x, y, W, M.rows, 170) + 4; }
  y += numRow(ctx, P, 'rho', x, y, W);
  y += flow(ctx, P, [{ id: 'shuf', label: X.shuf ? 'Unshuffle' : 'Shuffle the samples', on: !!X.shuf, fn: () => setShuffle(!X.shuf) }], x, y, W, bottom, o) + 8;
  y += head(ctx, x, y, 'Split by');
  y += flow(ctx, P, SPLIT_OPTS.map(([v, n]) => ({ id: 'split:' + v, label: n, on: splitNow() === v, fn: () => setSplit(v) })), x, y, W, bottom, o) + 8;
  y += stats(ctx, x, y, W, netInfo().rows, 200) + 6;
  footNote(ctx, NOTE.network, x, y, W, bottom);
}
// the five scenes, and the chosen scene's own controls (its sliders too); explore's About at its foot, room kept for it
function drawScenesPane(ctx, P, x, y, W, bottom) {
  ctx.font = vfont(21);
  const end = bottom - 34 - wrapLines(ctx, ABOUT, W).length * 29;
  head(ctx, x, end, 'About');
  textBlock(ctx, ABOUT, x, end + 34, W, 21, 29, VC.faint);
  bottom = end - 16;
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, SCENE_SHORT[k] || n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene);
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => sceneCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  for (const key of Object.keys(NUM).filter(k => numShown(X.scene, k))) if (y + 90 < bottom) y += numRow(ctx, P, key, x, y, W);
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
// Optional voice-over: put an MP3 at audio/narration-soil.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-soil.mp3', {
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
    let best = 'field', ba = 0;
    for (const k of SET_ORDER) { const a = Math.max(S[k + '_a'], 0.9 * S2[k + '_a']); if (a > ba + 0.01) { ba = a; best = k; } }
    if (best === 'field' && S.net_a > 0.5) best = 'net';   // (the cloud and the network float over the field)
    // the story's view, taken back into the set's own frame (explore shows sets unturned)
    const v = storyCam(ts).slice(0, 6), r = -setYaw(best, ts) * D2R, x = v[3], z = v[5];
    v[0] += r / D2R; v[3] = x * Math.cos(r) + z * Math.sin(r); v[5] = -x * Math.sin(r) + z * Math.cos(r);
    orbit.cur = v; orbit.to = null;
    X.scene = best; X.t0 = performance.now();
    // the story's picks carry over: a module lit, a group of plots tagged
    X.mod = best === 'net' && S.net_focus >= 0 ? Math.round(S.net_focus) : -1;
    X.rho = 0.6; X.shuf = 0; X.kind = -1;
    X.plot = best === 'field' && S.field_pick >= 0 && S.field_tags > 0.5 ? Math.round(S.field_pick) : -1;
    // and pick the scene's controls that come closest to what the story was showing
    const s = GL.sets[best];
    X.ctl[best] = {};
    for (const ct of ctlsOf(best)) {
      let bo = ct.options[0][0], bd = Infinity;
      for (const [v] of ct.options) {
        const c = ctlArgs(best, 0);
        c.t = 1e3; c[ct.key] = v;
        const tg = s.explore ? s.explore(c) : {};
        let d = 0;
        for (const n in tg) if (n in S && !n.endsWith('_a') && !/_pick$/.test(n)) d += (tg[n] - S[n]) ** 2;
        if (d < bd) { bd = d; bo = v; }
      }
      X.ctl[best][ct.key] = bo;
    }
    // (the field's measure on show: the story's)
    if (best === 'field' && S.field_tags > 0.5) X.ctl.field.show = SHOWS[clamp(Math.round(S.field_show), 0, 4)];
    X.tab = { soil: 'nitrogen', field: 'field', net: S.net_pull > 0.5 ? 'network' : 'microbes' }[best] || 'scenes';
    // from the last chapter (the story's end, or its Explore button): the field, in the Field tab
    if (ts >= C.know.a) openStart();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: nothing picked in explore
    X.mod = -1; X.kind = -1; X.plot = -1; X.shuf = 0; NEXT.length = 0; pushState();
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start: the field at the end of the season (day 70), its leaves by their chlorophyll, both wheats and
// every regime, in the Field tab
function openStart() {
  openScene('field', false);
  X.ctl.field = Object.assign(X.ctl.field || {}, { view: 'default', date: '4', show: 'chl', line: 'both', fert: 'all' });
  X.mod = -1; X.kind = -1; X.plot = -1; X.shuf = 0;
  X.tab = 'field'; showTab('field');
  orbit.cur = view('field', viewCam('field') || 'default'); orbit.to = null;
  renderAll();
}

let lastNow = 0;
const EXV = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];   // explore's view for applyCamera: orbit.cur, then FIT's and LOW's, eased
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
    const lo = lowOf(X.scene, vn); EXV[10] += (lo[0] - EXV[10]) * ke; EXV[11] += (lo[1] - EXV[11]) * ke;
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
    // #soil&explore&scene=net&view=split (a scene; view: an option by its key or name, or a camera of the scene by
    // name), &tab=field|nitrogen|microbes|network|scenes (picked by hand: its scene comes up), any control by its key
    // (date=0..4, show=chl|nh4|no3|n2o|ph, line=both|0|1, fert=all|0|1|2, wheat=bni|ctrl, dcd=on|off, colour=phylum|module|guild,
    // by=line|fert|random; by option or name), &split=line|fert|random|off, &mod=3 (a module, 1 to 17), &rho=0.7,
    // &shuffle, &kind=215 (a kind by its number), &plot=0..5 (a group of plots: line * 3 + regime)
    const sc = hp.get('scene'), tb = hp.get('tab'), tabOK = TABS.some(t => t[0] === tb);
    if (sc && GL.sets[sc] && SCENES.some(s => s[0] === sc)) { openScene(sc, false); showTab(tabOK ? tb : 'scenes'); }
    else if (tabOK) pickTab(tb);
    else if (!hp.has('t')) openStart();   // straight in: the field
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // every scene's controls but the views by their keys (the soil block's and the field's 'fert' share no option), then
    // the view of the scene on show
    const opt = (k, c, q) => c.options.find(([v, n]) => v.toLowerCase() === q || String(n).toLowerCase() === q || camFor(k, v) === q || (CAM_ALIAS[k] || {})[v] === q);
    for (const [k] of SCENES) for (const c of ctlsOf(k)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.key !== 'view' && c.key !== viewKey(k) && opt(k, c, q);
      if (o) { if (k === X.scene) setCtl(k, c.key, o[0]); else (X.ctl[k] = X.ctl[k] || {})[c.key] = o[0]; }
    }
    const vk = viewKey(X.scene), vq = String(hp.get('view') || hp.get(vk) || '').toLowerCase(), vc = ctlOf(X.scene, vk), vo = vq && vc && opt(X.scene, vc, vq);
    if (vo) setCtl(X.scene, vk, vo[0]);
    else if (vq && (GL.sets[X.scene].cam || {})[vq]) { orbit.cur = view(X.scene, vq); orbit.to = null; }   // a camera of its own
    const hnum = k => (hp.get(k) !== null && hp.get(k) !== '' && Number.isFinite(+hp.get(k)) ? +hp.get(k) : null);
    if (hp.has('split')) setSplit(['line', 'fert', 'random'].includes(hp.get('split')) ? hp.get('split') : 'off');
    if (hnum('mod') !== null) selectModule(Math.round(hnum('mod')) - 1);
    if (hnum('rho') !== null) setRho(hnum('rho'));
    if (hp.has('shuffle')) setShuffle(true);
    if (hnum('kind') !== null) selectKind(kindOfRank(Math.round(hnum('kind'))), false);
    if (hnum('plot') !== null) selectPlot(Math.round(hnum('plot')), false);
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
