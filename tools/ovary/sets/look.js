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
    const v = new (THREE.Vector3)(), nm = new (THREE.Matrix3)();
    // add a geometry; o: { m (Matrix4), col ([r, g, b] or (x, y, z) -> [r, g, b], at the placed vertex), cen ([x, y, z],
    // default: the placed geometry's middle), obj ([appear, vanish, kind, spare]), edge (per vertex 0..1, or a function
    // of the vertex in the geometry's own frame) }
    function add(geo, o = {}) {
      const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, n = g.attributes.normal, cnt = p.count;
      if (o.m) nm.getNormalMatrix(o.m);
      const s = P.length;
      for (let i = 0; i < cnt; i++) {
        v.set(p.getX(i), p.getY(i), p.getZ(i));
        const e = typeof o.edge === 'function' ? o.edge(v.x, v.y, v.z) : (o.edge || 0);
        if (o.m) v.applyMatrix4(o.m);
        P.push(v.x, v.y, v.z); E.push(e);
        if (n) { v.set(n.getX(i), n.getY(i), n.getZ(i)); if (o.m) v.applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); } else N.push(0, 0, 1);
      }
      let cen = o.cen;
      if (!cen) { let x = 0, y = 0, z = 0; for (let i = s; i < P.length; i += 3) { x += P[i]; y += P[i + 1]; z += P[i + 2]; } const k = 3 / (P.length - s); cen = [x * k, y * k, z * k]; }
      const obj = o.obj || [-99, 999, -1, 0];
      for (let i = s; i < P.length; i += 3) {
        const c = typeof o.col === 'function' ? o.col(P[i], P[i + 1], P[i + 2]) : (o.col || [1, 1, 1]);
        Cl.push(c[0], c[1], c[2]); Ce.push(cen[0], cen[1], cen[2]); O.push(obj[0], obj[1], obj[2], obj[3]);
      }
      if (g !== geo) g.dispose();
      return cen;
    }
    function geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute('aCol', new THREE.Float32BufferAttribute(Cl, 3));
      g.setAttribute('aCen', new THREE.Float32BufferAttribute(Ce, 3));
      g.setAttribute('aObj', new THREE.Float32BufferAttribute(O, 4));
      g.setAttribute('aEdge', new THREE.Float32BufferAttribute(E, 1));
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
