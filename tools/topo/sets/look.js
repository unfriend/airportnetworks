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
// (drawn twice), cell 2, slide 236, sheet 1 per triangle, ribbon 4 per point of its pool (pts) less 4.
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
//       glass), after everything else of the set.
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
//       a bead of 0.385 of its radius in P.beadCol (default BEAD) as v goes 0..1. opts (optional): additive (glowing
//       on black), depth (write depth while the set is fully in). Drawn in front of the surface (polygon offset).
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
  const VRIB = `
attribute vec3 aO, aU, aY, aCol, aNeg; attribute vec4 aP, aR;   // aP: alpha, depth, glow, fill; aR: row, points, from, to
uniform float uA; uniform sampler2D uCurve; uniform vec2 uSize;
varying vec3 vC, vNg, vN, vV; varying float vA, vT, vYs, vU, vG, vF, vCap; varying vec2 vRange;
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
varying vec3 vC, vNg, vN, vV; varying float vA, vT, vYs, vU, vG, vF, vCap; varying vec2 vRange;
void main() {
  if (vU < vRange.x || vU > vRange.y) discard;
  vec3 n = normalize(vN), v = normalize(vV);
  if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  vec3 c = vYs < 0.0 ? vNg : vC;
  float dif = max(dot(n, l), 0.0), spec = pow(max(dot(reflect(-l, n), v), 0.0), 30.0), rim = pow(1.0 - abs(dot(n, v)), 2.0);
  if (vCap > 0.5) {
    gl_FragColor = vec4(c * (0.55 + 0.4 * dif + 0.3 * rim + 0.9 * vG) + vec3(spec * 0.5), vA * 0.95);
  } else {
    float w = max(fwidth(vT), 1e-5), line = smoothstep(1.0 - 2.5 * w, 1.0 - 0.4 * w, vT);
    float a = vF * (0.05 + 0.32 * vT * vT) + line * (0.55 + 0.45 * vG);
    vec3 col = c * (0.55 + 0.25 * dif + 0.5 * vT * vT) + mix(c, vec3(1.0), 0.4) * line * (0.4 + 0.6 * vG) + vec3(spec * 0.15);
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
        tex[o + 4 * k] = env[2 * j]; tex[o + 4 * k + 1] = env[2 * j + 1];
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
    vec3 col = mix(gc * (0.35 + 0.9 * fr) + vec3(spec), fro, lab);
    gl_FragColor = vec4(col, vA * mix(0.06 + 0.45 * fr + 0.8 * spec, 0.9, lab));
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
