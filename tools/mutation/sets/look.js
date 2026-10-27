// MLOOK: the shared look of the mutation story's sets, grown from the qubits story's QLOOK. Lit, glowing shapes drawn as
// instanced meshes that a set refills every frame (a few hundred instances: cheap), soft halos, and the story's own
// pieces: letter tiles, arrowheads, glass spheres, qubits and the machine's gears. Colours are the poster's, the
// Okabe-Ito palette: A orange, C sky blue, G yellow, T pink; the machine blue with bright rims; time and branch length
// green; a pair that holds white, a broken one red.
//
// const LK = MLOOK(K, set)   (K the kit; set from K.newSet: every material fades with the set's uA)
// Units: positions and sizes in the set's local units, angles in radians, colours [r, g, b] (0..1) or '#rrggbb'
// (arrays avoid an allocation per add), alpha 0..1 (an instance at or under 0.004 is skipped).
// Every pool: const P = LK.<pool>(max); set.group.add(P.mesh) once; then every frame P.begin(), P.add(...) (at most max
// times: more are dropped; add returns the instance's index or -1), P.end() (sets the count, uploads, and hides the
// mesh while it is empty, so an empty pool costs no draw call). Nothing is allocated per add: reuse arrays and options.
// Triangles per instance: tube 20, cone 48, tile 200, ball 352, ring 640, glass 952, gear about 1,550 (a qubit about
// 2,800 with its glass, two rings, ball, tubes and cone); each pool is one draw call (gears two).
//
// From the qubits story, unchanged in use:
//   tubes(max).add(a, b, r, col, alpha, dash)          an open cylinder from point a to point b, radius r; dash: the
//                                                     number of dashes along it (0 solid)
//   rings(max).add(c, axis, R, r, col, alpha, dash)    a torus round c across 'axis' (any length), radius R, tube r
//   balls(max).add(p, r, col, alpha)                   a lit sphere
//   boxes(max).add(p, [sx, sy, sz], col, alpha)        a lit block, axis-aligned, sizes across
//   halos(max).add(p, size, col, alpha)                a soft additive glow (the kit's points), size across
//   depth()                                            call once per frame: depth writes only while the set is fully in
// New for this story:
//   cones(max).add(base, dir, length, r, col, alpha)   an arrowhead: a base disc of radius r at 'base', its tip at
//                                                     base + unit(dir) * length
//   glass(max).add(p, r, col, alpha)                   a glass sphere: clear face-on, glowing at its rim (additive)
//   tiles(max).add(p, q, size, letter, alpha, frame, glow, col)
//       A letter tile: a rounded block 'size' wide and high and 0.24 size thick, in the letter's colour, with the letter
//       in dark ink on both faces (read the right way round from either side). q: a THREE.Quaternion or [x, y, z, w]
//       that turns the tile from facing +z (the letter upright along +y), or null to face the camera, kept upright.
//       letter: 0..3 for A C G T, 4 '?', 5 '0', 6 '1' (GLYPHS). frame 0..1: the white thick frame (a letter that
//       differs). glow 0..1: lit from inside. col (optional): another colour for the block (default LCOL[letter]).
//   gears(max, teeth = 12).add(c, axis, R, angle, col, alpha, opts)
//       The machine's gear: a toothed rim (tips at R, roots at 0.8 R, 0.22 R thick, bright chamfered edges) round a
//       recessed web with the hub's dot in a circle on both faces; it lies across 'axis' and is turned by 'angle' about
//       it. opts: true (or { pair: true }) for the coupling gear, a double white band across both faces (the poster's
//       sign for a pair's two letters); { rim, glow }: the bright edges' colour (default RIM for BLUE, else a lighter
//       col) and 0..1 lit from inside. Pass a constant object. Two gears of one size and tooth count mesh with their
//       centres 2 * P.pitchR * R apart (P.pitchR = 0.9) when one is turned half a tooth (P.pitch / 2) further and they
//       turn opposite ways. The returned index is within its kind (plain or coupling). P.mesh is a group of two meshes.
//   qubit(pools, c, R, bloch, alpha, opts)
//       Draws one qubit from the pools { glass, rings, tubes, cones, balls, halos } (a missing pool's part is left
//       out; without glass the ball is a faint lit sphere): a glass ball of radius R at c, its equator ring, a faint
//       vertical axis, the 0 mark above (a small ring) and the 1 mark below (a small stroke with a flag), and the arrow
//       from the centre (a tube and a cone) whose length is the Bloch vector's (R for a pure state; a dashed trace
//       carries on to the sphere when it is shorter, as when two qubits depend on each other; no arrow under 0.04).
//       bloch: [x, y, z] with z +1 for |0> (up) and -1 for |1> (down); x is drawn along +x, y along -z. opts (all
//       optional; pass a constant object): at (offset into bloch, e.g. 3 for the second qubit of MMATH.bloch's six
//       numbers), col (the arrow, default INK), tint (glass, ring and axis, default GLASS), glow 0..1 (the arrow's
//       halo), spin (radians: turns the arrow round the vertical, the coin spinning), marks (false: no 0 and 1),
//       face ([x, y, z] the side the marks face, default +z), tip (an array that receives the arrow's tip).
// Colours ([r, g, b]): LCOL[0..4] (A C G T and the grey of '?'), LHEX (A C G T as '#rrggbb', for HTML), BLUE (gears),
// RIM (their bright edges), GREEN (time, branch length), GREENLIT (green where it must glow), RED (a broken pair),
// WHITE (a pair that holds, frames), INK (light marks), DARK (the tiles' ink), GREY, CYAN (highlights), AMBER, GLASS.
// Helpers: LETTERS 'ACGT', GLYPHS 'ACGT?01', mix(a, b, t, out) (out optional, else a new array), quat(out, axis, angle)
// (a quaternion [x, y, z, w] about 'axis' into out, for tiles), ID (no turn: [0, 0, 0, 1]).
const MLOOK = function (K, set) {
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
  // (opts: side, blending; additive materials keep depth writes off, so depth() leaves them alone)
  const mat = (vertex, frag, opts = {}) => {
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ uA: set.uA }, opts.uniforms || {}), vertexShader: vertex, fragmentShader: frag || FRAG,
      transparent: true, side: opts.side === undefined ? THREE.DoubleSide : opts.side, blending: opts.blending || THREE.NormalBlending, depthWrite: !opts.blending });
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
  // per-instance attributes on an instanced mesh
  function pool(geo, material, max, extra) {
    const g = new THREE.BufferGeometry();
    for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
    g.setIndex(geo.index);
    const A = { aCol: 3, aA: 1, aDash: 1 };
    Object.assign(A, extra || {});
    const attrs = {};
    for (const k in A) { attrs[k] = new THREE.InstancedBufferAttribute(new Float32Array(max * A[k]), A[k]); attrs[k].setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, attrs[k]); }
    const mesh = new THREE.InstancedMesh(g, material, max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false;
    const P = { mesh, attrs, n: 0, max };
    P.begin = () => { P.n = 0; };
    P.end = () => {
      mesh.count = P.n; mesh.visible = P.n > 0; mesh.instanceMatrix.needsUpdate = true;
      for (const k in attrs) { attrs[k].needsUpdate = true; }
    };
    P.put = (m, col, a, dash) => {
      if (P.n >= max) return -1;
      const i = P.n++;
      mesh.setMatrixAt(i, m);
      const c = Array.isArray(col) ? col : rgb(col);
      attrs.aCol.array[3 * i] = c[0]; attrs.aCol.array[3 * i + 1] = c[1]; attrs.aCol.array[3 * i + 2] = c[2];
      attrs.aA.array[i] = a; attrs.aDash.array[i] = dash || 0;
      return i;
    };
    return P;
  }
  // a small mesh builder for the tiles and gears: vertices [x, y, z, nx, ny, nz, ...extras]; each triangle is wound
  // to face its vertices' normals (so front faces are outside, whatever order the code lists them in)
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
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);
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
      for (const k of ['position', 'aCol', 'aSize', 'aA']) g.attributes[k].needsUpdate = true;
    };
    return P;
  }

  // ---------------------------------------------------------------- arrowheads and glass
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

  // ---------------------------------------------------------------- letter tiles
  // The glyphs in one canvas texture: eight square cells side by side (A C G T ? 0 1 and one spare), white on clear,
  // read as a mask in the shader. Drawn once per page and shared by the story's sets.
  const GLYPHS = 'ACGT?01', CELL = 256, CELLS = 8;
  function atlas() {
    if (MLOOK.atlas && MLOOK.atlas.image) return MLOOK.atlas;
    const cv = document.createElement('canvas');
    cv.width = CELL * CELLS; cv.height = CELL;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = `bold ${Math.round(CELL * 0.66)}px "Helvetica Neue", Helvetica, Arial, "Liberation Sans", "DejaVu Sans", sans-serif`;
    for (let i = 0; i < GLYPHS.length; i++) {
      // (centred on its ink, not on the font's em box)
      const m = g.measureText(GLYPHS[i]), asc = m.actualBoundingBoxAscent || CELL * 0.48, desc = m.actualBoundingBoxDescent || 0;
      g.fillText(GLYPHS[i], (i + 0.5) * CELL, CELL / 2 + (asc - desc) / 2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    return (MLOOK.atlas = t);
  }
  // A rounded block: the outline a square of side 1 with corners of radius 0.2, its edge a half-round of radius 0.12
  // (the thickness 0.24), flat faces in front and behind. uv runs across each face as seen from its own side, so the
  // letter reads the right way round from behind too.
  function tileGeo() {
    const B = builder([['uv', 2], ['aFace', 1]]), b = 0.12, rc = 0.2, CS = 4, PS = 4, O = [];
    const cen = [[0.3, 0.3], [-0.3, 0.3], [-0.3, -0.3], [0.3, -0.3]];
    for (let j = 0; j < 4; j++) for (let s = 0; s <= CS; s++) {
      const a = (j + s / CS) * Math.PI / 2;
      O.push([cen[j][0] + rc * Math.cos(a), cen[j][1] + rc * Math.sin(a), Math.cos(a), Math.sin(a)]);
    }
    const n = O.length;
    const rimV = (i, k) => {
      const [x, y, mx, my] = O[i], f = k / PS * Math.PI, s = Math.sin(f), c = Math.cos(f), px = x - mx * b * (1 - s), py = y - my * b * (1 - s);
      return [px, py, b * c, mx * s, my * s, c, px + 0.5, py + 0.5, 0];
    };
    for (let k = 0; k < PS; k++) for (let i = 0; i < n; i++) { const j = (i + 1) % n; B.quad(rimV(i, k), rimV(j, k), rimV(j, k + 1), rimV(i, k + 1)); }
    for (const z of [1, -1]) {
      const fv = (x, y) => [x, y, b * z, 0, 0, z, z > 0 ? x + 0.5 : 0.5 - x, y + 0.5, 1], C = fv(0, 0);
      for (let i = 0; i < n; i++) { const a = O[i], c = O[(i + 1) % n]; B.tri(C, fv(a[0] - a[2] * b, a[1] - a[3] * b), fv(c[0] - c[2] * b, c[1] - c[3] * b)); }
    }
    return B.geo();
  }
  const VTILE = `
attribute vec3 aCol; attribute float aA, aLetter, aFrame, aGlow, aBill, aFace;
uniform float uA;
varying vec3 vC, vN, vV; varying vec2 vUv; varying float vA, vL, vF, vG, vFace;
void main() {
  vec4 mv; vec3 n;
  if (aBill > 0.5) {
    // facing the camera, kept upright: a frame from the tile's centre towards the eye
    mat4 mi = modelMatrix * instanceMatrix;
    vec3 c = mi[3].xyz, d = cameraPosition - c;
    d = dot(d, d) > 1e-10 ? normalize(d) : vec3(0.0, 0.0, 1.0);
    vec3 r = cross(vec3(0.0, 1.0, 0.0), d);
    r = dot(r, r) > 1e-8 ? normalize(r) : vec3(1.0, 0.0, 0.0);
    mat3 B = mat3(r, cross(d, r), d);
    mv = viewMatrix * vec4(c + B * position * length(mi[0].xyz), 1.0);
    n = mat3(viewMatrix) * (B * normal);
  } else {
    mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    n = normalMatrix * mat3(instanceMatrix) * normal;
  }
  vN = normalize(n); vV = -mv.xyz; vC = aCol; vA = aA * uA; vUv = uv; vL = aLetter; vF = aFrame; vG = aGlow; vFace = aFace;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const FTILE = `
uniform sampler2D uMap; uniform vec3 uInk, uWhite;
varying vec3 vC, vN, vV; varying vec2 vUv; varying float vA, vL, vF, vG, vFace;
float box(vec2 p, float b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - abs(dot(n, v)), 2.4), spec = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);
  // the frame: the whole rounded edge, and a band just inside it on the faces
  float fr = vF * (vFace > 0.5 ? smoothstep(-0.008, 0.008, box(vUv - 0.5, 0.33, 0.07)) : 1.0);
  vec3 body = mix(vC, uWhite, fr);
  vec3 col = body * (0.62 + 0.36 * dif + 0.14 * hemi + 0.75 * vG) + body * rim * 0.55 + vec3(spec * 0.22);
  if (vFace > 0.5) col = mix(col, uInk, texture2D(uMap, vec2((vL + vUv.x) / ${CELLS}.0, vUv.y)).a);
  gl_FragColor = vec4(col, vA);
}`;
  function tiles(max) {
    const m = mat(VTILE, FTILE, { side: THREE.FrontSide, uniforms: { uMap: { value: atlas() }, uInk: { value: new THREE.Color(...DARK) }, uWhite: { value: new THREE.Color(...WHITE) } } });
    const P = pool(tileGeo(), m, max, { aLetter: 1, aFrame: 1, aGlow: 1, aBill: 1 }), A = P.attrs;
    P.add = (p, q, size, letter, alpha, frame, glow, col) => {
      if (size <= 0 || alpha <= 0.004) return -1;
      const L = letter > 0 ? Math.min(GLYPHS.length - 1, letter | 0) : 0;
      if (!q) _q.set(0, 0, 0, 1); else if (q.isQuaternion) _q.copy(q); else _q.set(q[0], q[1], q[2], q[3]);
      _m.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(size, size, size));
      const i = P.put(_m, col || LCOL[Math.min(L, 4)] || LCOL[4], alpha, 0);
      if (i >= 0) { A.aLetter.array[i] = L; A.aFrame.array[i] = frame || 0; A.aGlow.array[i] = glow || 0; A.aBill.array[i] = q ? 0 : 1; }
      return i;
    };
    return P;
  }

  // ---------------------------------------------------------------- the machine's gears
  // parts (aPart): 0 body, 1 walls, 2 the bright chamfered edges, 3 the hub, 4 the coupling's white bands
  const VGEAR = `
attribute vec3 aCol, aRim; attribute float aA, aGlow, aPart;
uniform float uA;
varying vec3 vC, vR, vN, vV; varying float vA, vP, vG;
void main() {
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vV = -mv.xyz; vC = aCol; vR = aRim; vA = aA * uA; vP = aPart; vG = aGlow;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const FGEAR = `
uniform vec3 uWhite;
varying vec3 vC, vR, vN, vV; varying float vA, vP, vG;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - abs(dot(n, v)), 2.2), spec = pow(max(dot(reflect(-l, n), v), 0.0), 30.0);
  vec3 c = vP > 3.5 ? uWhite : mix(vC, vR, vP > 1.5 ? 1.0 : vP > 0.5 ? 0.4 : 0.0);
  float e = vP > 1.5 ? 0.3 : 0.0;   // the bright edges, the hub and the bands glow a little
  vec3 col = c * (0.32 + 0.55 * dif + 0.18 * hemi + e) + vR * rim * 0.7 + vec3(spec * 0.35) + vR * vG * 0.55;
  gl_FragColor = vec4(col, vA);
}`;
  // one gear of radius 1 in the xy plane, its axis z
  function gearGeo(teeth, pair) {
    const B = builder([['aPart', 1]]), TAU = Math.PI * 2;
    const rr = 0.8, rt = 1, ra = 0.6, hz = 0.11, ch = 0.03, hw = 0.05, SEG = 32;
    // the toothed outline, counter-clockwise, and the same inset by the chamfer (mitred at the corners)
    const O = [];
    for (let k = 0; k < teeth; k++) for (const [f, r] of [[0, rr], [0.14, rt], [0.36, rt], [0.5, rr], [0.75, rr]]) {
      const a = (k + f) / teeth * TAU; O.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    const n = O.length;
    const SN = O.map((p, i) => { const q = O[(i + 1) % n], l = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(q[1] - p[1]) / l, -(q[0] - p[0]) / l]; });
    const I = O.map((p, i) => { const a = SN[(i + n - 1) % n], b = SN[i], d = 1 + a[0] * b[0] + a[1] * b[1]; return [p[0] - ch * (a[0] + b[0]) / d, p[1] - ch * (a[1] + b[1]) / d]; });
    const ang = I.map(p => Math.atan2(p[1], p[0]));
    const V = (x, y, z, nx, ny, nz, k) => [x, y, z, nx, ny, nz, k];
    const ring = (r0, r1, z0, z1, s, k) => {   // a raised ring (r0 0: a disc) on the face, side s
      for (let i = 0; i < SEG; i++) {
        const a = i / SEG * TAU, b = (i + 1) / SEG * TAU, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        B.quad(V(r0 * ca, r0 * sa, s * z1, 0, 0, s, k), V(r0 * cb, r0 * sb, s * z1, 0, 0, s, k), V(r1 * cb, r1 * sb, s * z1, 0, 0, s, k), V(r1 * ca, r1 * sa, s * z1, 0, 0, s, k));
        B.quad(V(r1 * ca, r1 * sa, s * z0, ca, sa, 0, k), V(r1 * cb, r1 * sb, s * z0, cb, sb, 0, k), V(r1 * cb, r1 * sb, s * z1, cb, sb, 0, k), V(r1 * ca, r1 * sa, s * z1, ca, sa, 0, k));
        if (r0 > 0) B.quad(V(r0 * ca, r0 * sa, s * z0, -ca, -sa, 0, k), V(r0 * cb, r0 * sb, s * z0, -cb, -sb, 0, k), V(r0 * cb, r0 * sb, s * z1, -cb, -sb, 0, k), V(r0 * ca, r0 * sa, s * z1, -ca, -sa, 0, k));
      }
    };
    const box = (x0, x1, y0, y1, z0, z1, k) => {
      const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      const F = [[0, 1, 2, 3, 0, 0, -1], [4, 5, 6, 7, 0, 0, 1], [0, 1, 5, 4, 0, -1, 0], [3, 2, 6, 7, 0, 1, 0], [0, 3, 7, 4, -1, 0, 0], [1, 2, 6, 5, 1, 0, 0]];
      for (const f of F) B.quad(...[0, 1, 2, 3].map(j => V(...P[f[j]], f[4], f[5], f[6], k)));
    };
    for (const s of [1, -1]) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, ci = Math.cos(ang[i]), si = Math.sin(ang[i]), cj = Math.cos(ang[j]), sj = Math.sin(ang[j]), m = SN[i], h = Math.SQRT1_2;
        // the rim's face, from the inner circle to the inset outline; the chamfer down to the toothed wall
        B.quad(V(ra * ci, ra * si, s * hz, 0, 0, s, 0), V(ra * cj, ra * sj, s * hz, 0, 0, s, 0), V(I[j][0], I[j][1], s * hz, 0, 0, s, 0), V(I[i][0], I[i][1], s * hz, 0, 0, s, 0));
        B.quad(V(I[i][0], I[i][1], s * hz, m[0] * h, m[1] * h, s * h, 2), V(I[j][0], I[j][1], s * hz, m[0] * h, m[1] * h, s * h, 2),
          V(O[j][0], O[j][1], s * (hz - ch), m[0] * h, m[1] * h, s * h, 2), V(O[i][0], O[i][1], s * (hz - ch), m[0] * h, m[1] * h, s * h, 2));
        // the rim's inner wall down to the web, and the web
        B.quad(V(ra * ci, ra * si, s * hw, -ci, -si, 0, 1), V(ra * cj, ra * sj, s * hw, -cj, -sj, 0, 1), V(ra * cj, ra * sj, s * hz, -cj, -sj, 0, 1), V(ra * ci, ra * si, s * hz, -ci, -si, 0, 1));
        B.tri(V(0, 0, s * hw, 0, 0, s, 0), V(ra * ci, ra * si, s * hw, 0, 0, s, 0), V(ra * cj, ra * sj, s * hw, 0, 0, s, 0));
      }
      // the hub: a dot in a circle; the coupling gear's smaller, between its two bands
      if (pair) { ring(0.12, 0.17, hw, hw + 0.04, s, 3); ring(0, 0.06, hw, hw + 0.05, s, 3); }
      else { ring(0.19, 0.27, hw, hw + 0.04, s, 3); ring(0, 0.085, hw, hw + 0.05, s, 3); }
      if (pair) for (const y of [-0.31, 0.31]) box(-0.7, 0.7, y - 0.05, y + 0.05, s > 0 ? hz - 0.02 : -hz - 0.03, s > 0 ? hz + 0.03 : -hz + 0.02, 4);
    }
    // the toothed wall
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, m = SN[i], z = hz - ch;
      B.quad(V(O[i][0], O[i][1], z, m[0], m[1], 0, 1), V(O[j][0], O[j][1], z, m[0], m[1], 0, 1), V(O[j][0], O[j][1], -z, m[0], m[1], 0, 1), V(O[i][0], O[i][1], -z, m[0], m[1], 0, 1));
    }
    return B.geo();
  }
  const _rim = [0, 0, 0];
  function gears(max, teeth = 12) {
    const m = mat(VGEAR, FGEAR, { side: THREE.FrontSide, uniforms: { uWhite: { value: new THREE.Color(...WHITE) } } }), X = { aRim: 3, aGlow: 1 };
    const plain = pool(gearGeo(teeth, false), m, max, X), pair = pool(gearGeo(teeth, true), m, max, X), group = new THREE.Group();
    group.add(plain.mesh, pair.mesh);
    const P = { mesh: group, plain, pair, max, pitch: Math.PI * 2 / teeth, pitchR: 0.9 };
    P.begin = () => { plain.begin(); pair.begin(); };
    P.end = () => { plain.end(); pair.end(); };
    P.add = (c, axis, R, angle, col, alpha, opts) => {
      if (R <= 0 || alpha <= 0.004) return -1;
      const two = opts === true || !!(opts && opts.pair), Q = two ? pair : plain;
      _d.set(axis[0], axis[1], axis[2]).normalize();
      _q.setFromUnitVectors(_z, _d).multiply(_q2.setFromAxisAngle(_z, angle));
      _m.compose(_p.set(c[0], c[1], c[2]), _q, _s.set(R, R, R));
      const cc = Array.isArray(col) ? col : rgb(col), i = Q.put(_m, cc, alpha, 0);
      if (i < 0) return i;
      let r = opts && opts.rim;
      if (!r && cc === BLUE) r = RIM;
      if (!r) {   // a lighter, fuller version of the colour
        for (let k = 0; k < 3; k++) _rim[k] = cc[k] + (1 - cc[k]) * 0.3;
        const mx = Math.max(_rim[0], _rim[1], _rim[2], 1e-3);
        for (let k = 0; k < 3; k++) _rim[k] /= mx;
        r = _rim;
      } else if (!Array.isArray(r)) r = rgb(r);
      const a = Q.attrs.aRim.array;
      a[3 * i] = r[0]; a[3 * i + 1] = r[1]; a[3 * i + 2] = r[2];
      Q.attrs.aGlow.array[i] = (opts && opts.glow) || 0;
      return i;
    };
    return P;
  }

  // ---------------------------------------------------------------- a qubit
  const NONE = {}, UP = [0, 1, 0], FRONT = [0, 0, 1], _a = [0, 0, 0], _b = [0, 0, 0], _l = [0, 0, 0];
  const at = (out, c, x, y, z) => { out[0] = c[0] + x; out[1] = c[1] + y; out[2] = c[2] + z; return out; };
  function qubit(pools, c, R, bloch, alpha, opts) {
    if (R <= 0 || alpha <= 0.004) return;
    const o = opts || NONE, k = o.at || 0, tint = o.tint || GLASS, col = o.col || INK, glow = o.glow || 0;
    const { glass: gl, rings: rg, tubes: tb, cones: cn, balls: bl, halos: hl } = pools;
    // the glass ball, its equator and its faint axis
    if (gl) gl.add(c, R, tint, alpha); else if (bl) bl.add(c, R, tint, 0.1 * alpha);
    if (rg) rg.add(c, UP, R, R * 0.016, tint, 0.6 * alpha);
    if (tb) tb.add(at(_a, c, 0, -R, 0), at(_b, c, 0, R, 0), R * 0.009, tint, 0.4 * alpha);
    // 0 above, 1 below, facing 'face'
    if (o.marks !== false) {
      const f = o.face || FRONT;
      _l[0] = f[1] * UP[2] - f[2] * UP[1]; _l[1] = f[2] * UP[0] - f[0] * UP[2]; _l[2] = f[0] * UP[1] - f[1] * UP[0];
      const ll = Math.hypot(_l[0], _l[1], _l[2]) || 1, w = R * 0.026;
      if (rg) rg.add(at(_a, c, 0, R * 1.27, 0), f, R * 0.08, w, INK, 0.85 * alpha);
      if (tb) {
        tb.add(at(_a, c, 0, -R * 1.16, 0), at(_b, c, 0, -R * 1.4, 0), w, INK, 0.85 * alpha);
        tb.add(at(_a, c, 0, -R * 1.16, 0), at(_b, c, _l[0] / ll * R * 0.08, -R * 1.22, _l[2] / ll * R * 0.08), w, INK, 0.85 * alpha);
      }
    }
    // the arrow: Bloch x along +x, z up, y along -z; turned round the vertical by spin
    let bx = bloch[k], by = bloch[k + 1], bz = bloch[k + 2];
    if (o.spin) { const cs = Math.cos(o.spin), sn = Math.sin(o.spin), x = bx * cs - by * sn; by = bx * sn + by * cs; bx = x; }
    const len = Math.min(1, Math.hypot(bx, by, bz)), L = len * R;
    if (len < 0.04) {
      if (bl) bl.add(c, R * 0.075, col, alpha);
      if (o.tip) at(o.tip, c, 0, 0, 0);
      return;
    }
    const dx = bx / len, dy = bz / len, dz = -by / len, h = Math.min(R * 0.32, L * 0.6), hr = R * 0.13 * Math.min(1, L / (R * 0.35));
    if (bl) bl.add(c, R * 0.075, col, alpha);
    at(_a, c, dx * (L - h), dy * (L - h), dz * (L - h));
    if (tb && L - h > R * 0.02) tb.add(c, _a, R * 0.048, col, alpha);
    _b[0] = dx; _b[1] = dy; _b[2] = dz;
    if (cn) cn.add(_a, _b, h, hr, col, alpha);
    at(_a, c, dx * L, dy * L, dz * L);
    if (o.tip) { o.tip[0] = _a[0]; o.tip[1] = _a[1]; o.tip[2] = _a[2]; }
    // shorter than the sphere: a dashed trace on to it
    if (tb && len < 0.96) tb.add(_a, at(_b, c, dx * R, dy * R, dz * R), R * 0.012, col, 0.35 * alpha, Math.max(2, Math.round((1 - len) * 8)));
    if (hl) hl.add(_a, R * (0.35 + 0.5 * glow), col, (0.2 + 0.6 * glow) * alpha);
  }

  // depth writes only while the set is fully in (fading glass would hide what is behind it)
  const depth = () => { const on = set.uA.value > 0.97; for (const m of set.mats) if (m.blending === THREE.NormalBlending) m.depthWrite = on; };
  const mix = (a, b, t, out) => { const o = out || [0, 0, 0]; o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
  const quat = (out, axis, angle) => {
    const l = Math.hypot(axis[0], axis[1], axis[2]) || 1, s = Math.sin(angle / 2) / l;
    out[0] = axis[0] * s; out[1] = axis[1] * s; out[2] = axis[2] * s; out[3] = Math.cos(angle / 2); return out;
  };
  const LHEX = ['#e69f00', '#56b4e9', '#f0e442', '#cc79a7'];
  const LCOL = LHEX.concat('#9aa8bd').map(rgb);
  const BLUE = rgb('#0072b2'), RIM = rgb('#4fb0ff'), WHITE = rgb('#f2f6ff'), DARK = rgb('#0b1322'), INK = rgb('#e7eef8'), GLASS = rgb('#8cc6ff');
  return {
    tubes, rings, balls, boxes, halos, cones, glass, tiles, gears, qubit, depth, mix, quat, ID: [0, 0, 0, 1],
    LETTERS: 'ACGT', GLYPHS, LHEX, LCOL, BLUE, RIM, WHITE, DARK, INK, GLASS,
    GREEN: rgb('#009e73'), GREENLIT: rgb('#3fd6a6'), RED: rgb('#ff5a4b'), GREY: rgb('#5d6676'), CYAN: rgb('#46d9ff'), AMBER: rgb('#ffb43b'),
  };
};
