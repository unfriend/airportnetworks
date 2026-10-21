// The PET story's opening set: a modern PET/CT scanner (after the one on the vision slide), the detector ring and how
// PET sees (a positron, its annihilation, two 511 keV photons, a coincidence, lines of response), the patient's image
// forming from the counts, and the vision row of the slide (scanner -> glowing body -> network of organs -> prognosis
// and medication). 1 unit = 1 m; the origin is the centre of the bore, its axis is z, the couch comes out towards +z
// and the floor is at y = -1.05.
SETS.scan = function (K) {
  const { THREE, clamp, lerp, smooth, prog, rng, v3 } = K;
  const set = K.newSet('scan');
  const PI = Math.PI, TAU = 2 * PI, FLOOR = -1.05;
  const D = typeof PET_DATA !== 'undefined' ? PET_DATA : null;
  const ocol = (id, f) => { const o = D && D.organs.find(q => q.id === id); return K.rgb(o ? o.col : f); };
  // deterministic hashes (events are functions of their index, so seeking works)
  const hash = i => { let h = Math.imul((i | 0) ^ 0x2c1b3c6d, 0x297a2d39); h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const hk = (i, k) => hash(Math.imul(i | 0, 0x9e3779b1) + Math.imul(k + 1, 0x632be5ab));

  // ------------------------------------------------------------------ the studio material --
  // Clinical glossy plastic lit like a product shot: a soft key over the viewer's left shoulder, a fill from the
  // right, sky and floor, a clear coat reflecting a studio (a softbox overhead, strip lights), fresnel and a cool rim.
  // Vertex attributes: color, aM (gloss, glow, cut flag, ambient occlusion), aE (vision element: 0 the scanner).
  // The cut: surfaces flagged for it vanish above uCut (scanner frame) with a glowing edge; their insides (back
  // faces) show as the dark inside of the housing. uMir draws the mirrored copy (the floor's reflection). o.cry: the
// crystals, each with its own glow (aG, per instance: a crystal struck by a photon flashes). While the set fades,
// back faces are dropped: the dark inside showed through the housing itself (a muddy charcoal ghost).
  const SU = { uCut: { value: 9 }, uWin: { value: 0 }, uDim: { value: 1 }, uFloor: { value: FLOOR }, uE: { value: new THREE.Vector4(1, 1, 1, 1) } };
  function studio(o = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uMir: { value: o.mir ? 1 : 0 }, uK: { value: 1 } }, SU), defines: o.cry ? { CRY: '' } : {},
      transparent: true, depthWrite: !o.mir && !o.vis, side: THREE.DoubleSide, extensions: { derivatives: true },
      vertexShader: `
attribute vec3 color; attribute vec4 aM; attribute float aE;
uniform vec4 uE;
varying vec3 vC, vN, vW, vL, vLN; varying vec4 vM; varying float vE;
#ifdef CRY
attribute float aG; varying float vG;
#endif
void main() {
#ifdef CRY
  vG = aG;
#endif
  vec4 p = vec4(position, 1.0); vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
  vL = p.xyz; vLN = n;
  vec4 w = modelMatrix * p; vW = w.xyz; vN = mat3(modelMatrix) * n;
  vC = color; vM = aM;
  vE = aE < 0.5 ? 1.0 : dot(vec4(equal(vec4(aE), vec4(1.0, 2.0, 3.0, 4.0))), uE);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
      fragmentShader: `
uniform float uA, uCut, uWin, uDim, uMir, uFloor, uK;
varying vec3 vC, vN, vW, vL, vLN; varying vec4 vM; varying float vE;
#ifdef CRY
varying float vG;
#endif
vec3 env(vec3 r) {
  float top = smoothstep(0.2, 0.92, r.y) * 1.15;
  float hor = exp(-pow((r.y - 0.06) / 0.2, 2.0)) * 0.2;
  float sl = pow(max(dot(r, normalize(vec3(-0.85, 0.3, 0.45))), 0.0), 14.0) * 1.3;
  float sr = pow(max(dot(r, normalize(vec3(0.9, 0.2, -0.25))), 0.0), 20.0) * 0.55;
  return vec3(0.9, 0.95, 1.0) * (top + hor + sl + sr) + vec3(0.015, 0.02, 0.03);
}
void main() {
  if (vM.z > 0.5 && vL.y > uCut) discard;
  if (vM.z > 1.5 && abs(vL.z) < uWin) discard;   // the bore's cover opens over the detector ring
  bool inside = !gl_FrontFacing;
  if (inside && uA < 0.97) discard;
  float a = uA * vE * uK;
  // the reflection fades with the height above the floor (and costs nothing where it has gone)
  if (uMir > 0.5) { a *= 0.32 * exp(-max(vL.y - uFloor, 0.0) * 3.0); if (a < 0.004) discard; }
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  if (inside) n = -n;
  if (uMir > 0.5) { n.y = -n.y; v.y = -v.y; }
  vec3 L = normalize((vec4(-0.45, 0.65, 0.75, 0.0) * viewMatrix).xyz), F = normalize((vec4(0.9, 0.1, 0.45, 0.0) * viewMatrix).xyz);
  float wr = clamp((dot(n, L) + 0.25) / 1.25, 0.0, 1.0), nv = max(dot(n, v), 0.0), g = vM.x;
  vec3 col = vC * (0.31 + 0.2 * (0.5 + 0.5 * n.y) + 0.55 * wr * wr + 0.22 * max(dot(n, F), 0.0)) * vM.w;
  float fr = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  col += env(reflect(-v, n)) * g * mix(0.07, 0.9, fr) * mix(0.5, 1.0, vM.w);
  col += pow(max(dot(n, normalize(L + v)), 0.0), mix(18.0, 150.0, g)) * g * 0.45;
  col += vec3(0.55, 0.72, 1.0) * pow(1.0 - nv, 3.0) * 0.16 * g;
  // panel seams: vertical grooves on the rear housing's sides
  if (vM.z > 0.5 && abs(vLN.x) > 0.8 && vL.z < 0.16 && vL.z > -0.72 && vL.y > -0.62 && vL.y < 0.7) {
    float dz = min(min(abs(vL.z + 0.06), abs(vL.z + 0.3)), abs(vL.z + 0.54)), fw = fwidth(vL.z) + 0.0005;
    col *= 1.0 - 0.45 * (1.0 - smoothstep(0.0022, 0.0022 + fw, dz));
  }
  col *= uDim;
  if (inside) col = vec3(0.075, 0.09, 0.12) * (0.55 + 0.45 * wr) * mix(1.0, uDim, 0.5);
  col += vC * vM.y;
  // a glowing edge where the cut goes through the housing (softer on the bore's cover, which runs through the bore)
  if (vM.z > 0.5) col += vec3(0.4, 0.82, 1.0) * (1.0 - smoothstep(0.0, 0.011, uCut - vL.y)) * (vM.z > 1.5 ? 0.5 : 1.5);
#ifdef CRY
  col += vec3(0.45, 0.85, 1.0) * vG * 2.6;
#endif
  gl_FragColor = vec4(col, a);
}`,
    });
    set.mats.push(m);
    return m;
  }
  const solidMat = studio(), mirMat = studio({ mir: true }), visMat = studio({ vis: true }), cryMat = studio({ cry: true });

  // ------------------------------------------------------------------ geometry builder --
  // Everything the studio material lights goes through a builder (one indexed geometry per mesh).
  function Builder() {
    const P = [], N = [], C = [], M = [], E = [], I = [];
    return {
      n: () => P.length / 3,
      vert(p, n, c, m, e) { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); C.push(c[0], c[1], c[2]); M.push(m[0], m[1], m[2], m[3]); E.push(e || 0); },
      tri(a, b, c) { I.push(a, b, c); },
      geo() {
        const g = new THREE.BufferGeometry(), at = (k, a, s) => g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(a), s));
        at('position', P, 3); at('normal', N, 3); at('color', C, 3); at('aM', M, 4); at('aE', E, 1);
        g.setIndex(new THREE.BufferAttribute(P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I), 1));
        g.computeBoundingSphere();
        return g;
      },
    };
  }
  const xp = (m, p) => { if (!m) return p; const e = m.elements; return [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]]; };
  const xn = (m, n) => { if (!m) return n; const e = m.elements; return v3.norm([e[0] * n[0] + e[4] * n[1] + e[8] * n[2], e[1] * n[0] + e[5] * n[1] + e[9] * n[2], e[2] * n[0] + e[6] * n[1] + e[10] * n[2]]); };
  // a look: col ([r, g, b] or f(p, n, i, j)), m ([gloss, glow, cut, ao] or f(p, n, i, j)), e (vision element)
  const paint = (L, p, n, i, j) => [typeof L.col === 'function' ? L.col(p, n, i, j) : L.col, typeof L.m === 'function' ? L.m(p, n, i, j) : L.m];
  // a grid of ni x nj points at(i, j); normals analytic (o.nrm) or from the neighbours; o.wrapI / o.wrapJ close it
  function grid(B, ni, nj, at, L, o = {}) {
    const W = [], base = B.n();
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) W.push(at(i, j));
    const g = (i, j) => W[i * nj + j];
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
      let n;
      if (o.nrm) n = o.nrm(i, j);
      else {
        const i0 = o.wrapI ? (i - 1 + ni) % ni : Math.max(i - 1, 0), i1 = o.wrapI ? (i + 1) % ni : Math.min(i + 1, ni - 1);
        const j0 = o.wrapJ ? (j - 1 + nj) % nj : Math.max(j - 1, 0), j1 = o.wrapJ ? (j + 1) % nj : Math.min(j + 1, nj - 1);
        n = v3.cross(v3.sub(g(i1, j), g(i0, j)), v3.sub(g(i, j1), g(i, j0)));
        if (v3.len(n) < 1e-14) n = o.fallback || [0, 1, 0];
      }
      n = v3.norm(o.flip ? v3.mul(n, -1) : n);
      const p = xp(o.mat, g(i, j)), nn = xn(o.mat, n), [c, m] = paint(L, p, nn, i, j);
      B.vert(p, nn, c, m, L.e);
    }
    const I1 = o.wrapI ? ni : ni - 1, J1 = o.wrapJ ? nj : nj - 1;
    for (let i = 0; i < I1; i++) for (let j = 0; j < J1; j++) {
      const a = base + i * nj + j, b = base + ((i + 1) % ni) * nj + j, c = base + ((i + 1) % ni) * nj + (j + 1) % nj, d = base + i * nj + (j + 1) % nj;
      if (o.flip) { B.tri(a, c, b); B.tri(a, d, c); } else { B.tri(a, b, c); B.tri(a, c, d); }
    }
  }
  // a rounded rectangle outline (counter-clockwise)
  function rrect(cx, cy, hx, hy, r, seg = 6) {
    r = Math.min(r, hx, hy);
    const out = [], C = [[hx - r, hy - r, 0], [-hx + r, hy - r, 1], [-hx + r, -hy + r, 2], [hx - r, -hy + r, 3]];
    for (const [x, y, q] of C) for (let k = 0; k <= seg; k++) { const a = (q + k / seg) * PI / 2; out.push([cx + x + r * Math.cos(a), cy + y + r * Math.sin(a)]); }
    return out;
  }
  // round a polygon's corners (quadratic arcs of about radius rad)
  function roundPoly(poly, rad, seg = 6) {
    const out = [], n = poly.length;
    for (let k = 0; k < n; k++) {
      const p = poly[k], a = poly[(k - 1 + n) % n], b = poly[(k + 1) % n];
      const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const ua = [(a[0] - p[0]) / la, (a[1] - p[1]) / la], ub = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb];
      const half = Math.acos(clamp(ua[0] * ub[0] + ua[1] * ub[1], -1, 1)) / 2, t = Math.min(rad / Math.tan(half || 1e-3), la * 0.48, lb * 0.48);
      const T1 = [p[0] + ua[0] * t, p[1] + ua[1] * t], T2 = [p[0] + ub[0] * t, p[1] + ub[1] * t];
      for (let s = 0; s <= seg; s++) { const u = s / seg, w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u; out.push([w0 * T1[0] + w1 * p[0] + w2 * T2[0], w0 * T1[1] + w1 * p[1] + w2 * T2[1]]); }
    }
    return out;
  }
  // A slab: the smooth closed outline core ([x, y]) grown by r, from z = 0 back to z = -d, every edge rounded with
  // radius r (exact normals), both caps flat; built in its own frame and placed by the matrix m.
  function slab(B, core, d, r, L, m, nf = 4) {
    if (THREE.ShapeUtils.isClockWise(core.map(p => new THREE.Vector2(p[0], p[1])))) core = core.slice().reverse();
    const n = core.length, nr = core.map((p, k) => {
      const a = core[(k - 1 + n) % n], b = core[(k + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [dy / l, -dx / l];
    });
    r = Math.min(r, d / 2);
    const rows = [];
    for (let k = 0; k <= nf; k++) { const a = k / nf * PI / 2; rows.push([r * Math.sin(a), -r + r * Math.cos(a), Math.sin(a), Math.cos(a)]); }
    for (let k = d - 2 * r > 1e-4 ? 0 : 1; k <= nf; k++) { const a = PI / 2 + k / nf * PI / 2; rows.push([r * Math.sin(a), -(d - r) + r * Math.cos(a), Math.sin(a), Math.cos(a)]); }
    grid(B, rows.length, n, (i, j) => [core[j][0] + nr[j][0] * rows[i][0], core[j][1] + nr[j][1] * rows[i][0], rows[i][1]], L,
      { wrapJ: true, mat: m, nrm: (i, j) => [nr[j][0] * rows[i][2], nr[j][1] * rows[i][2], rows[i][3]] });
    const tris = THREE.ShapeUtils.triangulateShape(core.map(p => new THREE.Vector2(p[0], p[1])), []);
    for (const [z, nz] of [[0, 1], [-d, -1]]) {
      const base = B.n(), nn = xn(m, [0, 0, nz]);
      for (const q of core) { const p = xp(m, [q[0], q[1], z]), [c, mm] = paint(L, p, nn, -1, -1); B.vert(p, nn, c, mm, L.e); }
      for (const [a, b, c] of tris) {
        const ar = (core[b][0] - core[a][0]) * (core[c][1] - core[a][1]) - (core[b][1] - core[a][1]) * (core[c][0] - core[a][0]);
        if ((ar > 0) === (nz > 0)) B.tri(base + a, base + b, base + c); else B.tri(base + a, base + c, base + b);
      }
    }
  }
  // a matrix from a basis (columns X, Y, Z) and an origin
  const basis = (X, Y, Z, o) => new THREE.Matrix4().set(X[0], Y[0], Z[0], o[0], X[1], Y[1], Z[1], o[1], X[2], Y[2], Z[2], o[2], 0, 0, 0, 1);
  // a rounded box centred at c with half sizes h
  const rbox = (B, c, h, r, L) => slab(B, rrect(0, 0, h[0] - r, h[1] - r, 0.0001, 1), 2 * h[2], r, L, basis([1, 0, 0], [0, 1, 0], [0, 0, 1], [c[0], c[1], c[2] + h[2]]));
  // a slab lying flat (outline in x, z seen from above), top at y0, thickness d
  const flat = (B, core, y0, d, r, L, nf) => slab(B, core, d, r, L, basis([1, 0, 0], [0, 0, -1], [0, 1, 0], [0, y0, 0]), nf);
  // a solid of revolution about the bore's axis (z): profile [[r, z], ...] clockwise in (r, z), closed
  function lathe(B, prof, nt, L) {
    grid(B, prof.length, nt, (i, j) => { const a = j / nt * TAU; return [prof[i][0] * Math.cos(a), prof[i][0] * Math.sin(a), prof[i][1]]; }, L, { wrapI: true, wrapJ: true });
  }
  const rprof = (r0, r1, z0, z1, rad) => rrect((r0 + r1) / 2, (z0 + z1) / 2, (r1 - r0) / 2, (z1 - z0) / 2, rad, 4).reverse();

  // colours and looks
  const WHITE = [0.885, 0.9, 0.92], BLUE = [0.47, 0.62, 0.86], GREY = [0.36, 0.39, 0.44];
  const floorAO = y => 0.6 + 0.4 * K.smooth((y + 1.02) / 0.22);

  // ------------------------------------------------------------------ the gantry --
  // One closed surface: the tunnel, the front lip, the blue band with its two pods, the white face, a generous fillet,
  // the front cover, a seam, the deeper rear housing, the back face and the back lip, swept round the bore (columns
  // by angle about the bore's centre). The face is a softly rounded square: straight sides, a domed top, tight
  // bottom corners; core = the outline before the fillet.
  const RB = 0.39, RF = 0.1, RF2 = 0.12, GA = 0.9, GT = 0.95, GBo = -0.89, GYS = 0.02, GYB = -0.6;
  function gIn(x, y) {
    const ax = Math.abs(x) / GA;
    if (y > GYS) { const b = (y - GYS) / (GT - GYS); return Math.pow(Math.pow(ax, 2.9) + Math.pow(b, 2.9), 1 / 2.9); }
    if (y < GYB) { const b = (GYB - y) / (GYB - GBo); return Math.pow(Math.pow(ax, 7) + Math.pow(b, 7), 1 / 7); }
    return ax;
  }
  // the rear housing (the PET part) is a little larger and boxier than the front cover
  function gIn2(x, y) {
    const ax = Math.abs(x) / (GA + 0.03);
    if (y > 0.2) { const b = (y - 0.2) / (GT + 0.035 - 0.2); return Math.pow(Math.pow(ax, 3.6) + Math.pow(b, 3.6), 1 / 3.6); }
    if (y < GYB) { const b = (GYB - y) / (GYB - GBo); return Math.pow(Math.pow(ax, 7) + Math.pow(b, 7), 1 / 7); }
    return ax;
  }
  const along = (f, a, lo, hi) => { const c = Math.cos(a), s = Math.sin(a); for (let k = 0; k < 36; k++) { const m = (lo + hi) / 2; if (f(c * m, s * m)) lo = m; else hi = m; } return lo; };
  // the blue band's outline: the ring smoothly joined to two lens-shaped pods at its sides
  const smin2 = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const blueSD = (x, y) => { const e = (Math.hypot((Math.abs(x) - 0.69) / 0.155, y / 0.3) - 1) * 0.155; return smin2(Math.hypot(x, y) - 0.665, e, 0.09); };
  const NT = 200, COL = [];
  for (let j = 0; j < NT; j++) {
    const a = j / NT * TAU, c = Math.cos(a), s = Math.sin(a), rho = along((x, y) => gIn(x, y) < 1, a, 0, 2), x = c * rho, y = s * rho, e = 1e-4;
    const gx = gIn(x + e, y) - gIn(x - e, y), gy = gIn(x, y + e) - gIn(x, y - e), gl = Math.hypot(gx, gy) || 1;
    const rho2 = along((x, y) => gIn2(x, y) < 1, a, 0, 2), x2 = c * rho2, y2 = s * rho2;
    const hx = gIn2(x2 + e, y2) - gIn2(x2 - e, y2), hy = gIn2(x2, y2 + e) - gIn2(x2, y2 - e), hl = Math.hypot(hx, hy) || 1;
    COL.push({ c, s, rho, nx: gx / gl, ny: gy / gl, rho2, nx2: hx / hl, ny2: hy / hl, rb: along((x, y) => blueSD(x, y) < 0, a, 0.4, 1.2) });
  }
  const ROWS = [];
  const Rr = (r, z, tag) => ROWS.push({ k: 'r', r, z, tag }), Rs = (off, z, tag) => ROWS.push({ k: 's', off, z, tag }), R2 = (off, z, tag) => ROWS.push({ k: 's2', off, z, tag });
  for (let k = 0; k <= 14; k++) Rr(RB, -0.7 + 1.415 * k / 14, 'tunnel');
  for (let k = 1; k <= 6; k++) { const a = k / 6 * PI / 2; Rr(RB + 0.06 * (1 - Math.cos(a)), 0.715 + 0.06 * Math.sin(a), 'lip'); }
  Rr(0.462, 0.775, 'lip');
  for (let k = 1; k <= 3; k++) { const s = k / 3; Rr(0.462 + 0.014 * s, 0.775 - 0.013 * smooth(s), k < 3 ? 'lip' : 'blue'); }
  for (let k = 1; k <= 6; k++) { const s = k / 6; Rr(c => lerp(0.476, c.rb - 0.012, s), 0.762 + 0.005 * Math.sin(PI * s), 'blue'); }
  for (let k = 1; k <= 5; k++) { const s = k / 5; Rr(c => c.rb - 0.012 + 0.032 * s, 0.762 + 0.038 * smooth(s), s < 0.5 ? 'blue' : 'face'); }
  for (let k = 1; k <= 6; k++) { const s = k / 6; Rr(c => lerp(c.rb + 0.02, c.rho, s), 0.8, 'face'); }
  for (let k = 1; k <= 7; k++) { const a = k / 7 * PI / 2; Rs(RF * Math.sin(a), 0.8 - RF * (1 - Math.cos(a)), 'skin'); }
  Rs(RF, 0.48, 'skin'); Rs(RF, 0.29, 'skin');
  Rs(RF - 0.005, 0.27, 'seam'); Rs(RF - 0.014, 0.256, 'seam'); Rs(RF - 0.004, 0.242, 'seam');
  R2(RF - 0.03, 0.238, 'seam'); R2(RF - 0.012, 0.234, 'skin'); R2(RF - 0.003, 0.226, 'skin');
  for (let k = 0; k <= 4; k++) R2(RF, 0.214 - (0.214 - (-0.8 + RF2)) * k / 4, 'skin');
  for (let k = 1; k <= 7; k++) { const a = PI / 2 + k / 7 * PI / 2; R2(RF - RF2 + RF2 * Math.sin(a), -0.8 + RF2 + RF2 * Math.cos(a), 'skin'); }
  for (let k = 1; k <= 5; k++) ROWS.push({ k: 'b', s: k / 5, z: -0.8, tag: 'back' });
  for (let k = 1; k <= 5; k++) { const a = PI / 2 - k / 6 * PI / 2; Rr(RB + 0.1 * (1 - Math.cos(a)), -0.7 - 0.1 * Math.sin(a), 'lip'); }
  const LOOK = {
    tunnel: (p) => [[0.8, 0.82, 0.86], [0.45, 0, 2, 1 - 0.5 * (1 - K.smooth((Math.abs(p[2]) - 0.05) / 0.6))]],
    lip: (p) => [WHITE, [0.85, 0, 1, 1]], blue: (p) => [BLUE, [0.42, 0.13, 1, 1]], face: (p) => [WHITE, [0.85, 0, 1, floorAO(p[1])]],
    skin: (p) => [WHITE, [0.85, 0, 1, floorAO(p[1])]], seam: (p) => [[0.55, 0.58, 0.62], [0.3, 0, 1, 0.7 * floorAO(p[1])]],
    back: (p) => [[0.86, 0.87, 0.89], [0.7, 0, 1, floorAO(p[1])]],
  };
  const outer = Builder();
  {
    let tag = null;
    grid(outer, ROWS.length, NT, (i, j) => {
      const R = ROWS[i], c = COL[j];
      if (R.k === 'r') { const r = typeof R.r === 'function' ? R.r(c) : R.r; return [c.c * r, c.s * r, R.z]; }
      if (R.k === 's') return [c.c * c.rho + c.nx * R.off, c.s * c.rho + c.ny * R.off, R.z];
      if (R.k === 's2') return [c.c * c.rho2 + c.nx2 * R.off, c.s * c.rho2 + c.ny2 * R.off, R.z];
      const q0 = [c.c * c.rho2 + c.nx2 * (RF - RF2), c.s * c.rho2 + c.ny2 * (RF - RF2)];
      return [lerp(q0[0], c.c * 0.49, R.s), lerp(q0[1], c.s * 0.49, R.s), R.z];
    }, { col: (p, n, i) => (tag = LOOK[ROWS[i].tag](p))[0], m: () => tag[1] }, { wrapI: true, wrapJ: true });
  }
  // the pods' control panels (a small screen, buttons, a status light) and the dark status panel high on the face
  const cutL = (col, g, glow) => ({ col, m: p => [g, glow || 0, 1, 1] });
  for (const sx of [-1, 1]) {
    const x = 0.735 * sx, at = (y, z) => basis([1, 0, 0], [0, 1, 0], [0, 0, 1], [x, y, z]);
    slab(outer, rrect(0, 0, 0.034, 0.135, 0.03, 6), 0.024, 0.012, cutL([0.74, 0.77, 0.82], 0.7), at(0, 0.786));
    slab(outer, rrect(0, 0, 0.018, 0.013, 0.003, 2), 0.006, 0.003, cutL([0.04, 0.06, 0.09], 0.9, 0.06), at(0.062, 0.79));
    for (let k = 0; k < 6; k++) slab(outer, rrect(0, 0, 0.002, 0.002, 0.002, 3), 0.005, 0.004, cutL([0.95, 0.96, 0.97], 0.6), at(-0.032 * (k >> 1), 0.79).multiply(new THREE.Matrix4().makeTranslation((k & 1 ? 0.014 : -0.014), 0, 0)));
    slab(outer, rrect(0, 0, 0.002, 0.002, 0.002, 3), 0.005, 0.004, cutL([1.0, 0.25, 0.12], 0.5, 0.9), at(0.112, 0.79));
  }
  {
    const arc = [], a0 = PI / 2 - 0.56, a1 = PI / 2 + 0.56;
    for (let k = 0; k <= 24; k++) { const a = lerp(a0, a1, k / 24); arc.push([0.872 * Math.cos(a), 0.872 * Math.sin(a)]); }
    for (let k = 24; k >= 0; k--) { const a = lerp(a0, a1, k / 24); arc.push([0.792 * Math.cos(a), 0.792 * Math.sin(a)]); }
    slab(outer, roundPoly(arc.filter((p, k) => k % 6 === 0 || k === 24 || k === 25 || k === 49), 0.022, 5), 0.014, 0.006, cutL([0.06, 0.07, 0.09], 0.95), basis([1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0.812]));
    for (const a of [PI / 2 - 0.3, PI / 2, PI / 2 + 0.3]) {
      const c = Math.cos(a), s = Math.sin(a);
      slab(outer, rrect(0, 0, 0.03, 0.004, 0.004, 3), 0.004, 0.0018, cutL([1.0, 0.42, 0.16], 0.4, 0.95), basis([-s, c, 0], [-c, -s, 0], [0, 0, 1], [0.832 * c, 0.832 * s, 0.815]));
    }
  }
  // the slim grey plinth, and the couch's base, pedestal (a curved skirt) and carriage
  flat(outer, rrect(0, 0, 0.92, 0.68, 0.1, 6), -0.99, 0.06, 0.02, { col: GREY, m: [0.5, 0, 0, 0.8] });
  flat(outer, rrect(0, -1.9, 0.27, 0.92, 0.1, 6), -0.955, 0.095, 0.035, { col: [0.84, 0.86, 0.89], m: p => [0.75, 0, 0, floorAO(p[1] + 0.03)] });
  {
    const KEY = [[-0.96, 0.22, 0.62], [-0.9, 0.19, 0.56], [-0.8, 0.14, 0.46], [-0.66, 0.13, 0.42], [-0.54, 0.16, 0.5], [-0.46, 0.2, 0.66]];
    const cr = (y) => { let k = 0; while (k < KEY.length - 2 && y > KEY[k + 1][0]) k++; const f = smooth((y - KEY[k][0]) / (KEY[k + 1][0] - KEY[k][0])); return [lerp(KEY[k][1], KEY[k + 1][1], f), lerp(KEY[k][2], KEY[k + 1][2], f)]; };
    const NR = 14, sec = [];
    for (let i = 0; i <= NR; i++) { const y = lerp(-0.96, -0.45, i / NR), [hx, hz] = cr(y); sec.push(rrect(0, -1.82, hx, hz, Math.min(0.12, hx * 0.8), 7).map(q => [q[0], y, -q[1]])); }
    grid(outer, sec.length, sec[0].length, (i, j) => sec[i][j], { col: [0.86, 0.88, 0.9], m: p => [0.75, 0, 0, 0.7 + 0.3 * K.smooth((p[1] + 0.95) / 0.45)] }, { wrapJ: true, flip: true });
  }
  flat(outer, rrect(0, -1.81, 0.22, 0.86, 0.1, 6), -0.345, 0.11, 0.04, { col: [0.8, 0.82, 0.86], m: [0.8, 0, 0, 0.9] });
  const outerGeo = outer.geo();

  // the couch's table top (it slides): a thick white board with a blue stripe along its sides, and a soft pad
  const TL = 2.3, TOP = -0.215;
  const table = Builder();
  const stripe = (p, n) => Math.abs(n[1]) < 0.7 && p[1] < TOP - 0.045 && p[1] > TOP - 0.1;
  flat(table, rrect(0, -TL / 2, 0.26 - 0.035, TL / 2 - 0.035, 0.1, 6), TOP - 0.025, 0.105, 0.035, {
    col: (p, n) => (stripe(p, n) ? [0.45, 0.62, 0.88] : WHITE), m: (p, n) => (stripe(p, n) ? [0.5, 0.12, 0, 1] : [0.85, 0, 0, 1]) }, 6);
  flat(table, rrect(0, -TL / 2, 0.2, TL / 2 - 0.07, 0.09, 6), TOP, 0.028, 0.013, { col: [0.7, 0.76, 0.85], m: [0.25, 0, 0, 1] });
  // a head rest: a shallow cradle at the head end
  flat(table, rrect(0, -0.2, 0.12, 0.11, 0.08, 6), TOP + 0.016, 0.02, 0.009, { col: [0.68, 0.74, 0.83], m: [0.25, 0, 0, 1] });
  const tableGeo = table.geo();

  // ------------------------------------------------------------------ inside the housing --
  // the CT ring in front (a drum with its X-ray tube) and the PET detector behind: two support rings, 48 detector
  // modules (the electronics behind the crystals) and the crystals themselves (instanced, below)
  const ZH = 0.165, RC0 = 0.41, RC1 = 0.44, NA = 192, NZ = 24, RDET = (RC0 + RC1) / 2;
  const inner = Builder();
  lathe(inner, rprof(0.43, 0.72, 0.4, 0.64, 0.02), 120, { col: [0.5, 0.53, 0.58], m: [0.75, 0, 1, 1] });
  rbox(inner, [0, 0.8, 0.52], [0.14, 0.075, 0.1], 0.03, { col: [0.25, 0.27, 0.31], m: [0.7, 0, 1, 1] });
  for (const z of [-ZH - 0.004, ZH + 0.02]) lathe(inner, rprof(0.445, 0.53, z - 0.016, z, 0.006), 120, { col: [0.62, 0.65, 0.7], m: [0.8, 0, 0, 1] });
  for (let b = 0; b < 48; b++) {
    const a = (b + 0.5) / 48 * TAU, c = Math.cos(a), s = Math.sin(a);
    slab(inner, rrect(0, 0.4725, 0.0225, 0.03, 0.008, 3), 2 * ZH, 0.008, { col: [0.13, 0.15, 0.19], m: [0.6, 0, 1, 1] }, basis([-s, c, 0], [c, s, 0], [0, 0, -1], [0, 0, ZH]));
  }
  const innerGeo = inner.geo();
  // the crystals: 192 around x 24 deep (48 blocks of 4 x 4 around, 6 blocks deep), dark glass, their faces to the bore;
  // each can flash (aG, set for the few struck crystals). Face and sides close in tone and only moderately glossy, so
  // the band does not shimmer into a moire from afar
  const cryPitchA = TAU / NA, cryPitchZ = 2 * ZH / NZ;
  const cryZ = k => -ZH + (k + 0.5) * cryPitchZ, cryA = k => (k + 0.5) * cryPitchA;
  const cg = new THREE.BoxGeometry(RDET * cryPitchA * 0.86, cryPitchZ * 0.86, RC1 - RC0);
  const CG = new Float32Array(NA * NZ);
  {
    const nv = cg.attributes.position.count, nrm = cg.attributes.normal.array, C = new Float32Array(nv * 3), M = new Float32Array(nv * 4);
    for (let v = 0; v < nv; v++) {
      const face = nrm[3 * v + 2] < -0.5;   // the face towards the axis
      C.set(face ? [0.17, 0.36, 0.5] : [0.12, 0.26, 0.37], 3 * v); M.set([0.7, face ? 0.18 : 0.13, 0, 1], 4 * v);
    }
    cg.setAttribute('color', new THREE.BufferAttribute(C, 3)); cg.setAttribute('aM', new THREE.BufferAttribute(M, 4));
    cg.setAttribute('aE', new THREE.BufferAttribute(new Float32Array(nv), 1));
    cg.setAttribute('aG', new THREE.InstancedBufferAttribute(CG, 1));
  }
  const crystals = new THREE.InstancedMesh(cg, cryMat, NA * NZ);
  for (let ia = 0; ia < NA; ia++) for (let iz = 0; iz < NZ; iz++) {
    const a = cryA(ia), c = Math.cos(a), s = Math.sin(a);
    crystals.setMatrixAt(ia * NZ + iz, basis([-s, c, 0], [0, 0, 1], [c, s, 0], [RDET * c, RDET * s, cryZ(iz)]));
  }
  crystals.instanceMatrix.needsUpdate = true;

  // ------------------------------------------------------------------ floor --
  // a glossy dark floor: a soft pool with contact shadows under the gantry and the couch (the reflection is drawn on it)
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uF: { value: 1 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA, uF; varying vec2 vP;
float sdB(vec2 p, vec2 c, vec2 b, float r) { vec2 q = abs(p - c) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  float rr = length(vec2(vP.x * 0.85, (vP.y - 0.7) * 0.62)) / 2.5;
  float a = 0.92 * (1.0 - smoothstep(0.25, 1.0, rr));
  float sh = max(1.0 - smoothstep(0.0, 0.3, sdB(vP, vec2(0.0, 0.0), vec2(1.0, 0.8), 0.12)), 0.8 * (1.0 - smoothstep(0.0, 0.18, sdB(vP, vec2(0.0, 1.9), vec2(0.3, 0.95), 0.1))));
  vec3 col = mix(vec3(0.045, 0.06, 0.085), vec3(0.008, 0.01, 0.016), sh * 0.85);
  gl_FragColor = vec4(col, a * uA * uF);
}`,
  });
  set.mats.push(floorMat);
  const floorG = new THREE.PlaneGeometry(7, 7).rotateX(-PI / 2).translate(0, FLOOR + 0.0005, 0.7);

  // ------------------------------------------------------------------ the scanner's group --
  const scanG = new THREE.Group();
  set.group.add(scanG);
  const mk = (geo, mat, order) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; m.frustumCulled = false; scanG.add(m); return m; };
  const floorMesh = mk(floorG, floorMat, -3);
  const outerRefl = mk(outerGeo, mirMat, -2), tableRefl = mk(tableGeo, mirMat, -2);
  for (const m of [outerRefl, tableRefl]) { m.scale.y = -1; m.position.y = 2 * FLOOR; }
  const outerMesh = mk(outerGeo, solidMat, 0), tableMesh = mk(tableGeo, solidMat, 0), innerMesh = mk(innerGeo, solidMat, 0);
  crystals.renderOrder = 0; crystals.frustumCulled = false; scanG.add(crystals);

  // ------------------------------------------------------------------ the patient --
  // The tour's PET body (its own set, unchanged) lies on the couch inside a soft glass shell of the same figure. The
  // shell is the body set's own shape (its numbers, copied: tools/lbi/sets/body.js) polygonised once by surface nets.
  const fade3 = x => x * x * (3 - 2 * x);
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  function cone(x, y, z, c) {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    let h = (px * c[3] + py * c[4] + pz * c[5]) * c[6];
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = px - c[3] * h, dy = py - c[4] * h, dz = pz - c[5] * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (c[7] + (c[8] - c[7]) * h);
  }
  const mkCone = (a, b, ra, rb) => { const d = v3.sub(b, a); return [a[0], a[1], a[2], d[0], d[1], d[2], 1 / v3.dot(d, d), ra, rb]; };
  const ell = (x, y, z, c, r) => { const a = (x - c[0]) / r[0], b = (y - c[1]) / r[1], d = (z - c[2]) / r[2]; return (Math.sqrt(a * a + b * b + d * d) - 1) * Math.min(r[0], r[1], r[2]); };
  const TR = [[-0.135, 0.145, 0.092, -0.012], [-0.08, 0.158, 0.104, -0.012], [-0.01, 0.160, 0.102, -0.002], [0.08, 0.142, 0.097, 0.008],
    [0.18, 0.140, 0.100, 0.010], [0.30, 0.153, 0.108, 0.006], [0.40, 0.160, 0.104, 0.0], [0.47, 0.150, 0.088, -0.010], [0.53, 0.090, 0.060, -0.016]];
  function torso(x, y, z) {
    const y0 = TR[0][0], y1 = TR[TR.length - 1][0], yy = clamp(y, y0, y1);
    let i = 0;
    while (i < TR.length - 2 && yy > TR[i + 1][0]) i++;
    const f = fade3((yy - TR[i][0]) / (TR[i + 1][0] - TR[i][0])), at = c => TR[i][c] + (TR[i + 1][c] - TR[i][c]) * f, w = at(1), d = at(2), zc = at(3);
    const e = (Math.hypot(x / w, (z - zc) / d) - 1) * Math.min(w, d), dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
    return dy > 0 ? Math.hypot(Math.max(e, 0), dy) : e;
  }
  const J = { shoulder: [0.172, 0.468, -0.012], elbow: [0.33, 0.79, -0.002], hip: [0.086, -0.07, 0.0], knee: [0.094, -0.47, 0.012],
    ankle: [0.100, -0.872, -0.014], heel: [0.100, -0.918, -0.036], toe: [0.126, -0.93, 0.165] };
  const mir = (p, s) => [p[0] * s, p[1], p[2]];
  const tips = { 1: [-0.045, 0.93, 0.038], [-1]: [0.045, 0.925, 0.004] }, wrists = { 1: [0.108, 0.902, 0.026], [-1]: [-0.108, 0.898, 0.006] };
  const limbs = [];
  const limb = (a, b, ra, rb, k) => { const m = v3.lerp(a, b, 0.5); limbs.push([mkCone(a, b, ra, rb), k, m[0], m[1], m[2], v3.dist(a, b) / 2 + Math.max(ra, rb)]); };
  for (const s of [1, -1]) {
    limb(mir(J.shoulder, s), mir(J.elbow, s), 0.048, 0.037, 0.05); limb(mir(J.elbow, s), wrists[s], 0.035, 0.024, 0.025);
    limb(wrists[s], v3.lerp(wrists[s], tips[s], 0.82), 0.024, 0.02, 0.012); limb(mir(J.hip, s), mir(J.knee, s), 0.084, 0.049, 0.06);
    limb(mir(J.knee, s), mir(J.ankle, s), 0.047, 0.027, 0.025); limb(mir(J.heel, s), mir(J.toe, s), 0.032, 0.022, 0.025);
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
      const L = limbs[i], dx = x - L[2], dy = y - L[3], dz = z - L[4], m = Math.max(0, d + L[1] + L[5]);
      if (dx * dx + dy * dy + dz * dz > m * m) continue;
      d = smin(d, cone(x, y, z, L[0]), L[1]);
    }
    if (y < -0.4) d = smin(d, ell(Math.abs(x), y, z, [0.097, -0.59, -0.022], [0.046, 0.11, 0.05]), 0.03);
    return d;
  }
  const XS = 0.9, SHELL = 0.011;
  // surface nets over the figure (modelling coordinates; x slimmed by XS afterwards, as the body set does)
  const shellGeo = (function () {
    const h = 0.0165, lo = [-0.42, -0.985, -0.18], nx = Math.ceil(0.84 / h) + 1, ny = Math.ceil(1.97 / h) + 1, nz = Math.ceil(0.4 / h) + 1;
    const f = (x, y, z) => bodySDF(x, y, z) - SHELL, F = new Float32Array(nx * ny * nz), id = (i, j, k) => (i * ny + j) * nz + k;
    // blocks of 4 cells: only those the surface can reach (judged from the field at the block's centre) are sampled;
    // the others take the centre's sign, and the cells are visited only in sampled blocks
    const BK = 4, rb = 1.05 * Math.sqrt(3) * BK * h / 2, done = new Uint8Array(nx * ny * nz), near = [], far = [];
    for (let bi = 0; bi < nx - 1; bi += BK) for (let bj = 0; bj < ny - 1; bj += BK) for (let bl = 0; bl < nz - 1; bl += BK) {
      const b = [bi, bj, bl, Math.min(bi + BK, nx - 1), Math.min(bj + BK, ny - 1), Math.min(bl + BK, nz - 1)];
      const fc = f(lo[0] + (b[0] + b[3]) / 2 * h, lo[1] + (b[1] + b[4]) / 2 * h, lo[2] + (b[2] + b[5]) / 2 * h);
      if (Math.abs(fc) > rb) { b.push(fc > 0 ? 1 : -1); far.push(b); } else near.push(b);
    }
    for (const [bi, bj, bl, i1, j1, k1] of near) for (let i = bi; i <= i1; i++) for (let j = bj; j <= j1; j++) for (let k = bl; k <= k1; k++) {
      const q = id(i, j, k); if (!done[q]) { F[q] = f(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h); done[q] = 1; }
    }
    for (const [bi, bj, bl, i1, j1, k1, sg] of far) for (let i = bi; i <= i1; i++) for (let j = bj; j <= j1; j++) for (let k = bl; k <= k1; k++) { const q = id(i, j, k); if (!done[q]) F[q] = sg; }
    const VI = new Int32Array(nx * ny * nz).fill(-1), P = [], N = [], cv = new Float64Array(8);
    const EG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [bi, bj, bl] of near) for (let i = bi; i < Math.min(bi + BK, nx - 1); i++) for (let j = bj; j < Math.min(bj + BK, ny - 1); j++) for (let k = bl; k < Math.min(bl + BK, nz - 1); k++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) { cv[c] = F[id(i + (c & 1), j + (c >> 1 & 1), k + (c >> 2 & 1))]; if (cv[c] < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, ne = 0;
      for (const [a, b] of EG) {
        if ((cv[a] < 0) === (cv[b] < 0)) continue;
        const t = cv[a] / (cv[a] - cv[b]);
        sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; ne++;
      }
      // the normal from the cell's corners (the field's gradient across the cell)
      const gx = cv[1] + cv[3] + cv[5] + cv[7] - cv[0] - cv[2] - cv[4] - cv[6], gy = cv[2] + cv[3] + cv[6] + cv[7] - cv[0] - cv[1] - cv[4] - cv[5];
      const gz = cv[4] + cv[5] + cv[6] + cv[7] - cv[0] - cv[1] - cv[2] - cv[3], nn = v3.norm([gx / XS, gy, gz]);
      VI[id(i, j, k)] = P.length / 3;
      P.push((lo[0] + (i + sx / ne) * h) * XS, lo[1] + (j + sy / ne) * h, lo[2] + (k + sz / ne) * h); N.push(nn[0], nn[1], nn[2]);
    }
    const I = [];
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I.push(a, c, b, a, d, c); else I.push(a, b, c, a, c, d); };
    for (const [bi, bj, bl] of near) for (let i = bi; i < Math.min(bi + BK, nx - 1); i++) for (let j = bj; j < Math.min(bj + BK, ny - 1); j++) for (let k = bl; k < Math.min(bl + BK, nz - 1); k++) {
      const v0 = F[id(i, j, k)] < 0;
      if (j > 0 && k > 0 && v0 !== F[id(i + 1, j, k)] < 0) quad(VI[id(i, j - 1, k - 1)], VI[id(i, j, k - 1)], VI[id(i, j, k)], VI[id(i, j - 1, k)], !v0);
      if (i > 0 && k > 0 && v0 !== F[id(i, j + 1, k)] < 0) quad(VI[id(i - 1, j, k - 1)], VI[id(i - 1, j, k)], VI[id(i, j, k)], VI[id(i, j, k - 1)], !v0);
      if (i > 0 && j > 0 && v0 !== F[id(i, j, k + 1)] < 0) quad(VI[id(i - 1, j - 1, k)], VI[id(i, j - 1, k)], VI[id(i, j, k)], VI[id(i - 1, j, k)], !v0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
    g.setIndex(new THREE.BufferAttribute(P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I), 1));
    g.computeBoundingSphere();
    return g;
  })();
  // the shell: a dark glass body pass (it also gives the image a dark ground: the body set blends by maximum), then
  // the patient's image (renderOrder 2), then a rim of light over both
  const shellU = { uA: set.uA, uSC: { value: new THREE.Color(0.36, 0.45, 0.58) }, uSA: { value: 0.45 }, uSR: { value: 1 }, uRC: { value: new THREE.Color(0.5, 0.7, 0.95) } };
  const shellV = 'varying vec3 vN, vW; void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const shellDark = new THREE.ShaderMaterial({
    uniforms: shellU, transparent: true, depthWrite: false, vertexShader: shellV,
    fragmentShader: `uniform float uA, uSA; uniform vec3 uSC; varying vec3 vN, vW;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW), L = normalize((vec4(-0.45, 0.65, 0.75, 0.0) * viewMatrix).xyz);
  float k = 0.62 + 0.38 * clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0), nv = abs(dot(n, v));
  gl_FragColor = vec4(uSC * k, uSA * uA * (0.75 + 0.25 * (1.0 - nv)));
}`,
  });
  const shellRim = new THREE.ShaderMaterial({
    uniforms: shellU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: shellV,
    fragmentShader: `uniform float uA, uSR; uniform vec3 uRC; varying vec3 vN, vW;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW), L = normalize((vec4(-0.45, 0.65, 0.75, 0.0) * viewMatrix).xyz);
  float r = pow(1.0 - abs(dot(n, v)), 2.4), s = pow(max(dot(n, normalize(L + v)), 0.0), 36.0);
  gl_FragColor = vec4(uRC * (r * 0.75 + s * 0.22) * uSR * uA, 1.0);
}`,
  });
  set.mats.push(shellDark, shellRim);
  const patientG = new THREE.Group();
  patientG.matrixAutoUpdate = false;
  set.group.add(patientG);
  const shellD = new THREE.Mesh(shellGeo, shellDark), shellR = new THREE.Mesh(shellGeo, shellRim);
  shellD.renderOrder = 1; shellR.renderOrder = 3; shellD.frustumCulled = shellR.frustumCulled = false;
  patientG.add(shellD, shellR);
  const body = SETS.body ? SETS.body(K) : null;
  const BP = body ? Object.assign({}, body.params, { body_pet: 1, body_net: 0, body_state: 0, body_blank: 0 }) : null;
  if (body) {
    body.group.traverse(o => { if (o.isPoints) o.renderOrder = 2; });
    patientG.add(body.group);
  }

  // ------------------------------------------------------------------ where the sugar is --
  // Events are drawn from a pool of points in the body's frame weighted by FDG uptake: brain, heart muscle, kidneys
  // and bladder (FDG leaves in the urine), a tumour in the right lung, the liver, and faint tissue everywhere.
  const atX = p => [p[0] * XS, p[1], p[2]];
  const TUMOUR = atX([-0.1, 0.415, 0.012]);
  const SRC = [
    [atX([0, 0.745, 0.0]), [0.058, 0.072, 0.075], 20, 1.0], [atX([0.045, 0.29, 0.06]), [0.036, 0.042, 0.036], 8, 0.82],
    [atX([0.072, 0.115, -0.066]), [0.02, 0.042, 0.018], 4.5, 0.8], [atX([-0.072, 0.098, -0.066]), [0.02, 0.042, 0.018], 4.5, 0.8],
    [atX([0, -0.112, 0.045]), [0.036, 0.028, 0.03], 7, 1.0], [TUMOUR, [0.013, 0.013, 0.013], 3.2, 1.0],
    [atX([-0.08, 0.205, 0.012]), [0.06, 0.06, 0.06], 5, 0.45],
  ];
  const POOL = 4096, PX = new Float32Array(POOL), PY = new Float32Array(POOL), PZ = new Float32Array(POOL), PU = new Float32Array(POOL);
  {
    const R = rng(511), wsum = SRC.reduce((s, q) => s + q[2], 0) + 70, tmp = [];
    for (const [c, r, w, I] of SRC) {
      const n = Math.round(POOL * w / wsum);
      for (let k = 0; k < n; k++) { let p; do { p = [K.gauss(R) * 0.6, K.gauss(R) * 0.6, K.gauss(R) * 0.6]; } while (v3.len(p) > 1.2); tmp.push([c[0] + p[0] * r[0], c[1] + p[1] * r[1], c[2] + p[2] * r[2], I * (0.85 + 0.15 * R())]); }
    }
    while (tmp.length < POOL) {
      const x = (R() - 0.5) * 0.8, y = R() * 1.9 - 0.95, z = (R() - 0.5) * 0.34;
      if (bodySDF(x, y, z) < -0.008) tmp.push([x * XS, y, z, 0.18 + 0.1 * R()]);
    }
    tmp.length = POOL;
    tmp.sort((a, b) => a[1] - b[1]);
    tmp.forEach((q, k) => { PX[k] = q[0]; PY[k] = q[1]; PZ[k] = q[2]; PU[k] = q[3]; });
  }

  // the counts: as the image forms, the pool's points light up one by one in hot iron (a grainy first image), only
  // where the patient has passed through the ring (body height above the ring's trailing edge, uLow), then give way
  // to the smooth image; a tumour glows in the right lung (the body set has none)
  const hotC = x => [Math.pow(clamp(x * 2, 0, 1), 0.9), Math.pow(clamp((x - 0.15) / 0.8, 0, 1), 1.5), clamp((x - 0.76) * 4.2, 0, 1) * 0.95];
  const dotG = K.pointsGeo(POOL + 260);
  {
    const p = dotG.attributes.position.array, c = dotG.attributes.aCol.array, s = dotG.attributes.aSize.array, sd = new Float32Array(POOL + 260), R = rng(7);
    for (let k = 0; k < POOL; k++) { p.set([PX[k], PY[k], PZ[k]], 3 * k); c.set(hotC(PU[k] * (0.7 + 0.4 * hash(k))), 3 * k); s[k] = 0.011; sd[k] = hash(k + 99); }
    for (let k = POOL; k < POOL + 260; k++) { const q = v3.mul(K.unit(R), 0.012 * Math.cbrt(R())); p.set(v3.add(TUMOUR, q), 3 * k); c.set(hotC(0.75 + 0.25 * R()), 3 * k); s[k] = 0.012; sd[k] = -1; }
    dotG.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  }
  // up close (in a headset, or the inside view) sprites shrink with distance, so they stay grains, not discs
  const CLOSE = ' gl_PointSize *= clamp(-mv.z / length(modelViewMatrix[0].xyz) / 1.6, 0.35, 1.0);';
  const dotU = { uImg: { value: 0 }, uLow: { value: -9 } };
  const dotMat = K.points(set, { uniforms: dotU, head: 'attribute float aSeed; uniform float uImg, uLow;',
    vertex: 'vA *= (aSeed < 0.0 ? smoothstep(0.45, 0.8, uImg) : smoothstep(aSeed * 0.55, aSeed * 0.55 + 0.04, uImg) * (1.0 - smoothstep(0.62, 0.95, uImg))) * smoothstep(uLow - 0.004, uLow + 0.012, position.y);' + CLOSE });
  const dots = new THREE.Points(dotG, dotMat);
  dots.renderOrder = 4; dots.frustumCulled = false;
  patientG.add(dots);

  // ------------------------------------------------------------------ events and lines of response --
  // A positron travels about a millimetre (drawn larger), meets an electron: both turn into two 511 keV photons flying
  // apart in exactly opposite directions; each hits a crystal, which flashes; the coincidence gives a line of response
  // between the two crystals, through the point where the sugar was. Animated events come at 25 a second (each shown
  // when its hash is below a level set by scan_events); the web of lines comes from a faster stream (200 a second), as
  // a real scan records millions, and every 8th line of the web is one of the animated events (the same event), so a
  // line you saw drawn stays in the web. Everything is a function of the event's index and of where the couch is now
  // (seeking works). An event's annihilation point is fixed in the body's frame, so its line moves with the patient;
  // only points inside the ring's slice give events. The featured events (one every 2 s, which the labels follow)
  // come from the hottest source inside the slice, fly slowly and roughly sideways, rising a little to the right.
  const EV_RATE = 25, WEB_RATE = 200, WEB_N = 3000, COPY = WEB_RATE / EV_RATE, V_PH = 2.2, V_F = 1.1, TP = 0.24, WIN = 2.7;
  const NC = 20, ZE = ZH - 0.006, FEAT = 50, S0 = 0.97;
  const pose = { ty: TOP + 0.116 * S0, tz: 0.3, s: S0 };   // the body's frame in the scanner's: x' = s x, y' = ty + s z, z' = tz - s y
  const mod = (a, n) => ((a % n) + n) % n;
  const inSlice = yb => Math.abs(pose.tz - pose.s * yb) < ZE;   // a body-frame height inside the ring's slice
  const SRC_BY_W = SRC.map((q, k) => k).sort((a, b) => SRC[b][2] - SRC[a][2]);
  let featSrc = -1;
  // an event's fixed part, from its index: direction, the positron's path (6 steps, scanner frame) and its sum
  const SP = { dx: 0, dy: 0, dz: 0, ox: 0, oy: 0, oz: 0, feat: false }, STEP = new Float64Array(18);
  function spec(n, anim) {
    const feat = anim && mod(n, FEAT) === 0, kd = anim ? 0 : 1000;
    const phi = feat ? 0.04 + 0.16 * hk(n, 3) : hk(n, 3 + kd) * TAU, dz = feat ? (hk(n, 4) - 0.5) * 0.1 : (hk(n, 4 + kd) - 0.5) * 0.3, l = Math.sqrt(1 + dz * dz);
    SP.dx = Math.cos(phi) / l; SP.dy = Math.sin(phi) / l; SP.dz = dz / l; SP.feat = feat;
    SP.ox = SP.oy = SP.oz = 0;
    if (anim) for (let s = 0; s < 6; s++) {
      const ux = hk(n, 11 + s) - 0.5, uy = hk(n, 21 + s) - 0.5, uz = (hk(n, 31 + s) - 0.5) * 0.5, ul = 0.0065 / (Math.sqrt(ux * ux + uy * uy + uz * uz) || 1);
      STEP[3 * s] = ux * ul; STEP[3 * s + 1] = uy * ul; STEP[3 * s + 2] = uz * ul;
      SP.ox += ux * ul; SP.oy += uy * ul; SP.oz += uz * ul;
    }
    return SP;
  }
  // where event n's annihilation is (body frame, into CHP): a featured one at its source (jittered by a centimetre),
  // else the first of NC pool points (by hash) that, moved by the positron's path, lies inside the slice. Returns a
  // code (the candidate r, NC + the source, or -1: none)
  const CHP = [0, 0, 0];
  function choose(n, anim, feat, obx, oby, obz) {
    if (feat && featSrc >= 0) {
      const c = SRC[featSrc][0];
      CHP[0] = c[0] + (hk(n, 60) - 0.5) * 0.016; CHP[1] = c[1] + (hk(n, 61) - 0.5) * 0.016; CHP[2] = c[2] + (hk(n, 62) - 0.5) * 0.016;
      return NC + featSrc;
    }
    const kb = anim ? 7000 : 100;
    for (let r = 0; r < NC; r++) {
      const c = (hk(n, kb + r) * POOL) | 0;
      if (inSlice(PY[c] + oby)) { CHP[0] = PX[c] + obx; CHP[1] = PY[c] + oby; CHP[2] = PZ[c] + obz; return r; }
    }
    return -1;
  }
  // the positive distance along (dx, dy) from (px, py) to the circle of radius R about the axis
  const ringS = (px, py, dx, dy, R) => { const a = dx * dx + dy * dy, b = 2 * (px * dx + py * dy), c = px * px + py * py - R * R; return (-b + Math.sqrt(Math.max(b * b - 4 * a * c, 0))) / (2 * a); };
  // An animated event, worked out in full (no allocation): EV holds its annihilation point P and emission point in
  // the scanner's frame, its direction, both crystals (centres, instance index), how far each photon flies before it
  // shows its hit (the crystal's face where the bore's cover is open, else the cover) and the flash points there.
  const EV = { px: 0, py: 0, pz: 0, ex: 0, ey: 0, ez: 0, dx: 0, dy: 0, dz: 0, A: [0, 0, 0], B: [0, 0, 0], FA: [0, 0, 0], FB: [0, 0, 0], iA: 0, iB: 0, tA: 0, tB: 0, feat: false, V: V_PH };
  // a line's end on the ring: snapped to its crystal's centre round the ring, but not along the axis, so a line
  // glides with the couch instead of stepping from one row of crystals to the next
  function crystalAt(qx, qy, qz, out, fo, rf) {
    const ia = mod(Math.floor(Math.atan2(qy, qx) / cryPitchA), NA), iz = clamp(Math.floor((qz + ZH) / cryPitchZ), 0, NZ - 1), an = cryA(ia), c = Math.cos(an), s = Math.sin(an);
    out[0] = RDET * c; out[1] = RDET * s; out[2] = qz;
    fo[0] = rf * c; fo[1] = rf * s; fo[2] = qz;
    return ia * NZ + iz;
  }
  function place(j) {
    spec(j, true);
    const s = pose.s, code = choose(j, true, SP.feat, SP.ox / s, -SP.oz / s, SP.oy / s);
    if (code < 0) return false;
    const px = s * CHP[0], py = pose.ty + s * CHP[2], pz = pose.tz - s * CHP[1];
    EV.px = px; EV.py = py; EV.pz = pz; EV.ex = px - SP.ox; EV.ey = py - SP.oy; EV.ez = pz - SP.oz; EV.feat = SP.feat; EV.V = SP.feat ? V_F : V_PH;
    // both photons must reach the ring inside its length; if not, the event flies flat (as the web's shader does)
    let dx = SP.dx, dy = SP.dy, dz = SP.dz, s1 = ringS(px, py, dx, dy, RDET), s2 = ringS(px, py, -dx, -dy, RDET);
    if (Math.abs(pz + dz * s1) > ZH || Math.abs(pz - dz * s2) > ZH) { const l = Math.hypot(dx, dy); dx /= l; dy /= l; dz = 0; s1 = ringS(px, py, dx, dy, RDET); s2 = ringS(px, py, -dx, -dy, RDET); }
    EV.dx = dx; EV.dy = dy; EV.dz = dz;
    // the cover over the ring is gone above the cut and inside the opened window
    const cy = SU.uCut.value, cw = SU.uWin.value;
    for (let e = 0; e < 2; e++) {
      const sg = e ? -1 : 1, sd = e ? s2 : s1, qx = px + sg * dx * sd, qy = py + sg * dy * sd, qz = pz + sg * dz * sd;
      // (a point sprite has one depth: the flash stands 2 cm in front of the face, or the crystals beside it cut it)
      const open = qy > cy || Math.abs(qz) < cw, rs = open ? RC0 - 0.004 : RB - 0.004, rf = open ? RC0 - 0.02 : RB - 0.01;
      const idx = crystalAt(qx, qy, qz, e ? EV.B : EV.A, e ? EV.FB : EV.FA, rf), st = ringS(px, py, sg * dx, sg * dy, rs);
      if (e) { EV.iB = idx; EV.tB = st; } else { EV.iA = idx; EV.tA = st; }
    }
    return true;
  }
  // the featured events' state for the labels: the latest one's annihilation point and how far it has got, and the
  // left-hand end of the latest featured line of response
  const featured = { on: false, p: [0, 0, 0], lor: [0, 0, 0], env: 0, lorOn: 0 };
  function featState(t) {
    featured.on = false; featured.env = 0; featured.lorOn = 0;
    let jf = Math.floor(t * EV_RATE / FEAT) * FEAT;
    if ((jf + 0.8 * hk(jf, 50)) / EV_RATE > t) jf -= FEAT;
    let got = false;
    for (let q = 0; q < 2; q++) {
      const j = jf - q * FEAT, age = t - (j + 0.8 * hk(j, 50)) / EV_RATE;
      if (!place(j)) continue;
      const tc = TP + Math.max(EV.tA, EV.tB) / EV.V;
      if (j === jf) {
        featured.on = true;
        featured.p[0] = EV.px; featured.p[1] = EV.py + 0.15; featured.p[2] = EV.pz;
        featured.env = smooth(age / 0.15) * (1 - smooth((age - tc - 0.6) / 0.4));
      }
      if (!got && age >= tc && age < tc + 2.05) {
        got = true; featured.on = true; featured.lorOn = 1;
        const L = EV.A[0] < EV.B[0] ? EV.A : EV.B;
        featured.lor[0] = L[0] + 0.03; featured.lor[1] = L[1] - 0.08; featured.lor[2] = L[2];
      }
    }
    if (!got && featured.on) { featured.lor[0] = featured.p[0] - 0.39; featured.lor[1] = featured.p[1] - 0.2; featured.lor[2] = featured.p[2]; }
  }

  // The web: one buffer of 3000 reusable slots (slot = index mod 3000). A slot keeps its event's annihilation point
  // in the body's frame (position) and direction (aD: + at one end, - at the other); the shader puts the line in
  // the scanner from the couch's pose (uPose), meets the ring and snaps both ends to crystals round the ring, so a moving
  // couch only changes a uniform. The CPU picks each slot's point (the first of its candidates inside the slice),
  // and rewrites only the slots whose pick changes, plus the few newest each frame.
  const webG = K.linesGeo(WEB_N);
  webG.setAttribute('aD', new THREE.BufferAttribute(new Float32Array(WEB_N * 6), 3));
  webG.setAttribute('aIdx', new THREE.BufferAttribute(new Float32Array(WEB_N * 2).fill(-1e9), 1));
  webG.setAttribute('aTim', new THREE.BufferAttribute(new Float32Array(WEB_N * 2).fill(-1e9), 1));
  {
    const c = webG.attributes.aCol.array, p = webG.attributes.position.array;
    for (let k = 0; k < WEB_N; k++) { const v = 0.8 + 0.2 * hash(k + 7); c.set([1.0 * v, 0.42 * v, 0.12 * v, 1.0 * v, 0.42 * v, 0.12 * v], 6 * k); p[6 * k + 1] = p[6 * k + 4] = 99; }
  }
  const f6 = x => x.toFixed(6);
  const webU = { uHead: { value: 0 }, uCap: { value: 0 }, uNow: { value: 0 }, uLin: { value: 0 }, uPose: { value: new THREE.Vector3(pose.ty, pose.tz, pose.s) } };
  const webMat = K.lines(set, { uniforms: webU,
    head: `attribute float aIdx, aTim; attribute vec3 aD; uniform float uHead, uCap, uNow, uLin; uniform vec3 uPose;
const float RD = ${f6(RDET)}, ZH_ = ${f6(ZH)}, ZE_ = ${f6(ZE)}, PA = ${f6(cryPitchA)};
float ringS(vec2 p, vec2 d) { float a = dot(d, d), b = 2.0 * dot(p, d), c = dot(p, p) - RD * RD; return (-b + sqrt(max(b * b - 4.0 * a * c, 0.0))) / (2.0 * a); }`,
    vertex: `
  float kk = uHead - aIdx, age = uNow - aTim;
  vA *= uLin * smoothstep(0.0, 0.3, age) * step(-0.5, kk) * (1.0 - smoothstep(uCap * 0.7, uCap + 0.5, kk));
  vec3 P = vec3(uPose.z * position.x, uPose.x + uPose.z * position.z, uPose.y - uPose.z * position.y), d = aD;
  vA *= 1.0 - smoothstep(ZE_ - 0.02, ZE_, abs(P.z));   // fainter at the slice's edges (as a ring's sensitivity is)
  float s1 = ringS(P.xy, d.xy), s2 = ringS(P.xy, -d.xy);
  if (abs(P.z + d.z * s1) > ZH_ || abs(P.z - d.z * s2) > ZH_) { d = vec3(normalize(d.xy), 0.0); s1 = ringS(P.xy, d.xy); }
  vec3 q = P + d * s1;
  float an = (floor(atan(q.y, q.x) / PA) + 0.5) * PA;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(RD * cos(an), RD * sin(an), q.z, 1.0);` });
  const web = new THREE.LineSegments(webG, webMat);
  web.renderOrder = 5; web.frustumCulled = false; scanG.add(web);
  // per slot: its event's index, candidates (pool index and body height), the positron's offset (body frame),
  // whether featured, its current pick, and the pose version it was picked for
  const slotIdx = new Float64Array(WEB_N).fill(NaN), CI = new Int32Array(WEB_N * NC), CY = new Float32Array(WEB_N * NC);
  const OB = new Float32Array(WEB_N * 3), FJ = new Float32Array(WEB_N * 3), WF = new Uint8Array(WEB_N), pick = new Int16Array(WEB_N).fill(-2), stamp = new Int32Array(WEB_N).fill(-1);
  let poseVer = 0, lastTz = NaN, lastSrc = -2;
  function writeSlot(slot, i) {
    const anim = mod(i, COPY) === 0, n = anim ? i / COPY : i, A = webG.attributes;
    spec(n, anim);
    const obx = SP.ox / S0, oby = -SP.oz / S0, obz = SP.oy / S0, kb = anim ? 7000 : 100, b = slot * NC;
    OB[3 * slot] = obx; OB[3 * slot + 1] = oby; OB[3 * slot + 2] = obz; WF[slot] = SP.feat ? 1 : 0;
    if (SP.feat) { FJ[3 * slot] = (hk(n, 60) - 0.5) * 0.016; FJ[3 * slot + 1] = (hk(n, 61) - 0.5) * 0.016; FJ[3 * slot + 2] = (hk(n, 62) - 0.5) * 0.016; }
    for (let r = 0; r < NC; r++) { const c = (hk(n, kb + r) * POOL) | 0; CI[b + r] = c; CY[b + r] = PY[c] + oby; }
    const D = A.aD.array;
    D[6 * slot] = SP.dx; D[6 * slot + 1] = SP.dy; D[6 * slot + 2] = SP.dz; D[6 * slot + 3] = -SP.dx; D[6 * slot + 4] = -SP.dy; D[6 * slot + 5] = -SP.dz;
    A.aIdx.array[2 * slot] = A.aIdx.array[2 * slot + 1] = i;
    // an animated event's line joins the web as its coincidence comes (about when the second photon arrives)
    A.aTim.array[2 * slot] = A.aTim.array[2 * slot + 1] = anim ? (n + 0.8 * hk(n, 50)) / EV_RATE + TP + 0.42 / (SP.feat ? V_F : V_PH) : i / WEB_RATE;
    pick[slot] = -2; stamp[slot] = -1;
  }
  function pickSlot(slot) {
    let code = -1;
    const b = slot * NC;
    if (WF[slot] && featSrc >= 0) code = NC + featSrc;
    else for (let r = 0; r < NC; r++) if (Math.abs(pose.tz - pose.s * CY[b + r]) < ZE) { code = r; break; }
    if (code === pick[slot]) return false;
    pick[slot] = code;
    let x = 0, y = 99, z = 0;
    if (code >= NC) { const c = SRC[code - NC][0]; x = c[0] + FJ[3 * slot]; y = c[1] + FJ[3 * slot + 1]; z = c[2] + FJ[3 * slot + 2]; }
    else if (code >= 0) { const c = CI[b + code]; x = PX[c] + OB[3 * slot]; y = PY[c] + OB[3 * slot + 1]; z = PZ[c] + OB[3 * slot + 2]; }
    const p = webG.attributes.position.array;
    p[6 * slot] = p[6 * slot + 3] = x; p[6 * slot + 1] = p[6 * slot + 4] = y; p[6 * slot + 2] = p[6 * slot + 5] = z;
    return true;
  }
  const upload = (at, lo, hi, per) => {
    if (hi < lo) return;
    const full = hi - lo > 1200;
    at.updateRange.offset = full ? 0 : lo * per; at.updateRange.count = full ? -1 : (hi - lo + 1) * per; at.needsUpdate = true;
  };
  function webStep(cap, head) {
    if (pose.tz !== lastTz || featSrc !== lastSrc) { poseVer++; lastTz = pose.tz; lastSrc = featSrc; }
    let loM = WEB_N, hiM = -1, loP = WEB_N, hiP = -1;
    for (let k = 0; k < cap; k++) {
      const i = head - k, slot = mod(i, WEB_N);
      if (slotIdx[slot] !== i) { slotIdx[slot] = i; writeSlot(slot, i); if (slot < loM) loM = slot; if (slot > hiM) hiM = slot; }
      if (stamp[slot] !== poseVer) { stamp[slot] = poseVer; if (pickSlot(slot)) { if (slot < loP) loP = slot; if (slot > hiP) hiP = slot; } }
    }
    const A = webG.attributes;
    upload(A.aD, loM, hiM, 6); upload(A.aIdx, loM, hiM, 2); upload(A.aTim, loM, hiM, 2); upload(A.position, loP, hiP, 6);
  }

  // the animated events: positron paths, photon streaks and lines of response (lines), flashes, photons' comets and
  // heads (points), the featured line of response as a soft glowing beam (two quads at most), crystals' glow
  const FXL = 1000, FXP = 640;
  const fxG = K.linesGeo(FXL), fxPG = K.pointsGeo(FXP);
  const fxL = new THREE.LineSegments(fxG, K.lines(set)), fxP = new THREE.Points(fxPG, K.points(set, { vertex: CLOSE }));
  fxL.renderOrder = 6; fxP.renderOrder = 7; fxL.frustumCulled = fxP.frustumCulled = false;
  scanG.add(fxL, fxP);
  const beamG = new THREE.BufferGeometry();
  {
    const at = (k, n) => beamG.setAttribute(k, new THREE.BufferAttribute(new Float32Array(8 * n), n));
    at('position', 3); at('aB', 3); at('aS', 1); at('aF', 1); at('aA', 1);
    for (let q = 0; q < 2; q++) [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sd, f], v) => { beamG.attributes.aS.array[4 * q + v] = sd; beamG.attributes.aF.array[4 * q + v] = f; });
    beamG.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  }
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uW: { value: 0.009 }, uC: { value: new THREE.Color(1.0, 0.62, 0.3) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 aB; attribute float aS, aF, aA; uniform float uA, uW; varying float vS, vA;
void main() {
  vec4 a = modelViewMatrix * vec4(position, 1.0); vec3 b = (modelViewMatrix * vec4(aB, 1.0)).xyz;
  vec3 sd = normalize(cross(b - a.xyz, a.xyz));   // across the line, square to the view
  a.xyz += sd * aS * aF * uW * length(modelViewMatrix[0].xyz);
  vS = aS; vA = aA * uA;
  gl_Position = projectionMatrix * a;
}`,
    fragmentShader: `uniform vec3 uC; varying float vS, vA;
void main() { float f = 1.0 - abs(vS); gl_FragColor = vec4((uC * 0.6 * f * f + vec3(1.0, 0.9, 0.75) * 0.75 * pow(f, 10.0)) * vA, 1.0); }`,
  });
  set.mats.push(beamMat);
  const beam = new THREE.Mesh(beamG, beamMat);
  beam.renderOrder = 6; beam.frustumCulled = false; scanG.add(beam);
  const LIT = new Int32Array(256);
  let nLit = 0;

  // ------------------------------------------------------------------ the vision row --
  // the scanner moves to the left; to its right, linked by big soft arrows: the glowing body standing (the same
  // body, risen from the couch), a neon network of organs, and prognosis (three bars) above medication (a bar chart)
  const visG = new THREE.Group();
  set.group.add(visG);
  const VX = { body: -0.62, net: 0.68, prog: 2.36 }, CHEV = [-1.15, -0.06, 1.46];
  const vis = Builder();
  CHEV.forEach((cx, k) => {
    const poly = [[-0.17, -0.085], [0.0, -0.085], [0.0, -0.17], [0.17, 0.0], [0.0, 0.17], [0.0, 0.085], [-0.17, 0.085]];
    slab(vis, roundPoly(poly, 0.022, 5), 0.07, 0.024, {
      col: p => { const s = clamp((p[0] - cx + 0.19) / 0.36, 0, 1); return v3.lerp([0.2, 0.21, 0.24], [1.0, 1.0, 1.0], Math.pow(s, 0.7)); },
      m: p => [0.8, 0.55 * Math.pow(clamp((p[0] - cx + 0.19) / 0.36, 0, 1), 2), 0, 1], e: k + 1 }, basis([1, 0, 0], [0, 1, 0], [0, 0, 1], [cx, -0.04, 0.035]));
  });
  const chev = new THREE.Mesh(vis.geo(), visMat);
  chev.renderOrder = 8; chev.frustumCulled = false; visG.add(chev);
  // the neon organs (icons from PET_ICONS, drawn glowing in each organ's colour on one canvas)
  const NET_ORG = [['brain', '#a78bfa', [0.06, 0.47, 0.04], 0.36], ['lungs', '#60a5fa', [0.0, 0.08, -0.05], 0.36], ['heart', '#f43f5e', [-0.37, -0.22, 0.1], 0.3],
    ['liver', '#f97316', [0.37, -0.2, 0.08], 0.31], ['kidneys', '#fb7185', [0.02, -0.56, 0.0], 0.27]];
  // the other organs once each, and three more nodes in a neutral white (as on the slide, more than the organs drawn)
  const NET_NODE = [['thyroid', [-0.43, 0.43, -0.1]], ['muscle', [-0.6, 0.12, 0.12]], ['adrenal', [-0.2, 0.26, 0.18]], ['spleen', [0.3, 0.3, -0.12]],
    ['pancreas', [0.58, 0.1, 0.1]], ['intestine', [0.6, -0.46, -0.06]], ['fat', [-0.52, -0.52, -0.12]], ['marrow', [0.32, -0.66, 0.12]], ['aorta', [-0.13, -0.36, -0.15]],
    [null, [-0.22, 0.64, 0.0]], [null, [0.42, 0.6, 0.06]], [null, [-0.66, -0.2, -0.05]]];
  let iconTex = null;
  {
    const S = 256, cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (cv) {
      cv.width = 4 * S; cv.height = 2 * S;   // four icons to a row (a power of two: no resizing on WebGL1)
      const ctx = cv.getContext('2d');
      NET_ORG.forEach(([id, f], k) => {
        const col = (D && (D.organs.find(o => o.id === id) || {}).col) || f, cx = (k % 4 + 0.5) * S, cy = ((k >> 2) + 0.5) * S;
        if (typeof PET_ICONS !== 'undefined') {
          ctx.globalAlpha = 0.22; PET_ICONS.draw(ctx, id, cx, cy, S * 0.8, { color: col, width: S * 0.09 });
          ctx.globalAlpha = 1; PET_ICONS.draw(ctx, id, cx, cy, S * 0.8, { color: col, width: S * 0.03, glow: true });
          ctx.globalAlpha = 0.8; PET_ICONS.draw(ctx, id, cx, cy, S * 0.8, { color: '#ffffff', width: S * 0.008 });
        } else { ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, S * 0.35, 0, TAU); ctx.stroke(); }
      });
      ctx.globalAlpha = 1;
      iconTex = new THREE.CanvasTexture(cv);
      iconTex.anisotropy = 4;
    }
  }
  const iconU = { uMap: { value: iconTex }, uF: { value: 0 } };
  const iconMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, iconU), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D uMap; uniform float uA, uF; varying vec2 vUv; void main() { vec4 c = texture2D(uMap, vUv); gl_FragColor = vec4(c.rgb * c.a * 1.35 * uA * uF, 1.0); }',
  });
  set.mats.push(iconMat);
  const netC = [VX.net, 0.02, 0];
  {
    const quads = NET_ORG.map(([id, f, p, s], k) => {
      const g = new THREE.PlaneGeometry(s, s), uv = g.attributes.uv.array;
      for (let v = 0; v < uv.length; v += 2) { uv[v] = (k % 4 + uv[v]) / 4; uv[v + 1] = 1 - ((k >> 2) + 1 - uv[v + 1]) / 2; }
      return g.translate(netC[0] + p[0], netC[1] + p[1], p[2]);
    });
    const icons = new THREE.Mesh(K.merge(quads), iconMat);
    icons.renderOrder = 9; icons.frustumCulled = false; visG.add(icons);
  }
  // the network's nodes (the other organs, small coloured discs) and glowing links (each in its two nodes' colours)
  const NODES = [...NET_ORG.map(([id, f, p]) => ({ p: v3.add(netC, p), c: ocol(id, f), big: true })), ...NET_NODE.map(([id, p]) => ({ p: v3.add(netC, p), c: id ? ocol(id, '#99aaaa') : [0.84, 0.88, 0.95], big: false }))];
  const LINKS = [];
  {
    const seen = new Set();
    NODES.forEach((a, i) => {
      const near = NODES.map((b, j) => [v3.dist(a.p, b.p), j]).filter(q => q[1] !== i).sort((x, y) => x[0] - y[0]).slice(0, 3);
      for (const [, j] of near) { const key = Math.min(i, j) + ',' + Math.max(i, j); if (!seen.has(key)) { seen.add(key); LINKS.push([i, j]); } }
    });
  }
  const nlG = K.linesGeo(LINKS.length), nnG = K.pointsGeo(NODES.length * 2);
  LINKS.forEach(([i, j], k) => {
    const a = NODES[i], b = NODES[j], u = v3.norm(v3.sub(b.p, a.p)), ra = a.big ? 0.1 : 0.02, rb = b.big ? 0.1 : 0.02;
    nlG.attributes.position.array.set([...v3.add(a.p, v3.mul(u, ra)), ...v3.sub(b.p, v3.mul(u, rb))], 6 * k);
    nlG.attributes.aCol.array.set([...a.c, ...b.c], 6 * k);
    nlG.attributes.aA.array.set([0.75, 0.75], 2 * k);
  });
  NODES.forEach((n, k) => {
    const A = nnG.attributes;
    A.position.array.set(n.p, 6 * k); A.position.array.set(n.p, 6 * k + 3);
    A.aCol.array.set(n.c, 6 * k); A.aCol.array.set(v3.lerp(n.c, [1, 1, 1], 0.55), 6 * k + 3);
    A.aSize.array[2 * k] = n.big ? 0.0 : 0.075; A.aSize.array[2 * k + 1] = n.big ? 0.0 : 0.032;
    A.aA.array[2 * k] = 0.55; A.aA.array[2 * k + 1] = 1;
  });
  const netU = { uF: { value: 0 } };
  const netL = new THREE.LineSegments(nlG, K.lines(set, { uniforms: netU, head: 'uniform float uF;', vertex: 'vA *= uF;' }));
  const netN = new THREE.Points(nnG, K.points(set, { uniforms: netU, head: 'uniform float uF;', vertex: 'vA *= uF;' }));
  netL.renderOrder = 8; netN.renderOrder = 9; netL.frustumCulled = netN.frustumCulled = false;
  visG.add(netL, netN);
  // prognosis and medication: neon rectangles drawn from their distance fields (frames, filled bars, a panel, bars
  // rising from an axis); aE groups them for the left-to-right fade (1-3 the prognosis bars, 4 medication)
  const neonU = { uG: { value: new THREE.Vector4() } };
  const neonMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, neonU), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec2 aQ, aH; attribute vec4 aR; attribute vec3 aC0, aC1; attribute float aE;
uniform vec4 uG; uniform float uA;
varying vec2 vQ, vH; varying vec4 vR; varying vec3 vC0, vC1; varying float vF;
void main() {
  vQ = aQ; vH = aH; vR = aR; vC0 = aC0; vC1 = aC1;
  vF = dot(vec4(equal(vec4(aE), vec4(1.0, 2.0, 3.0, 4.0))), uG);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `uniform float uA; varying vec2 vQ, vH; varying vec4 vR; varying vec3 vC0, vC1; varying float vF;
float sdB(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  float mode = vR.y, r = vR.x, w = vR.w, g = clamp((vF - vR.z) / max(1.0 - vR.z, 0.01), 0.0, 1.0);
  vec3 col = vec3(0.0);
  if (mode < 0.5) {
    float d = sdB(vQ, vH, r), ad = abs(d);
    col = mix(vC0, vec3(1.0), 0.45) * exp(-ad * ad / (w * w)) + vC0 * 0.28 * exp(-ad / (w * 5.0)) + vC1 * 0.1 * smoothstep(0.004, -0.004, d);
    g = smoothstep(0.0, 0.4, g);
  } else if (mode < 1.5) {
    float f = g, x0 = -vH.x, x1 = -vH.x + 2.0 * vH.x * vR.w * f;
    vec2 hb = vec2(max((x1 - x0) * 0.5, 0.0005), vH.y);
    float d = sdB(vQ - vec2((x0 + x1) * 0.5, 0.0), hb, min(r, hb.x)), s = clamp((vQ.x - x0) / max(x1 - x0, 0.001), 0.0, 1.0);
    vec3 cc = mix(vC0, vC1, s);
    col = cc * (smoothstep(0.003, -0.003, d) * (0.55 + 0.75 * s * s) + 0.5 * exp(-max(d, 0.0) / 0.018)) * step(0.001, f);
    g = smoothstep(0.0, 0.25, g);
  } else if (mode < 2.5) {
    float d = sdB(vQ, vH, r);
    col = vC0 * (smoothstep(0.004, -0.004, d) * 0.07 + exp(-d * d / (w * w)) * 0.35);
    g = smoothstep(0.0, 0.5, g);
  } else {
    float hh = max(vH.y * g, 0.0005), d = sdB(vQ - vec2(0.0, -vH.y + hh), vec2(vH.x, hh), min(r, hh)), ad = abs(d);
    col = (mix(vC0, vec3(1.0), 0.3) * exp(-ad * ad / (w * w)) + vC0 * (0.3 * exp(-ad / (w * 5.0)) + 0.1 * smoothstep(0.003, -0.003, d))) * step(0.002, g);
    g = smoothstep(0.0, 0.2, g);
  }
  gl_FragColor = vec4(col * g * uA, 1.0);
}`,
  });
  set.mats.push(neonMat);
  {
    const R = [];   // [cx, cy, hx, hy, radius, mode, delay or fraction, width, c0, c1, element]
    const PB = [[0.64, 0.8, '#ff6a1a', '#ffc27a', 1], [0.42, 0.4, '#e0103c', '#ff3a50', 2], [0.2, 0.9, '#ffb000', '#fff08a', 3]];
    for (const [y, f, c0, c1, e] of PB) {
      R.push([VX.prog, y, 0.55, 0.068, 0.066, 0, 0.0, 0.006, [0.92, 0.94, 1.0], [0.1, 0.11, 0.14], e]);
      R.push([VX.prog, y, 0.53, 0.05, 0.05, 1, 0.0, f, K.rgb(c0), K.rgb(c1), e]);
    }
    const my = -0.41, mh = 0.35, ORANGE = K.rgb('#ff7a1a');
    R.push([VX.prog, my, 0.56, mh, 0.03, 2, 0.0, 0.008, [0.32, 0.36, 0.5], [0, 0, 0], 4]);
    R.push([VX.prog - 0.46, my, 0.004, mh - 0.06, 0.004, 0, 0.0, 0.0045, [1.0, 0.86, 0.7], [0, 0, 0], 4]);
    R.push([VX.prog + 0.02, my - mh + 0.06, 0.48, 0.004, 0.004, 0, 0.0, 0.0045, [1.0, 0.86, 0.7], [0, 0, 0], 4]);
    [0.42, 0.78, 0.3, 0.55, 0.68].forEach((hgt, k) => {
      const h2 = (2 * mh - 0.16) * hgt / 2, x = VX.prog - 0.31 + k * 0.16;
      R.push([x, my - mh + 0.075 + h2, 0.045, h2, 0.008, 3, 0.15 + 0.12 * k, 0.005, ORANGE, [0, 0, 0], 4]);
    });
    const n = R.length, PAD = 0.07, pos = new Float32Array(n * 12), aQ = new Float32Array(n * 8), aH = new Float32Array(n * 8), aR = new Float32Array(n * 16);
    const c0 = new Float32Array(n * 12), c1 = new Float32Array(n * 12), aE = new Float32Array(n * 4), idx = [];
    R.forEach(([cx, cy, hx, hy, rad, mode, del, wf, C0, C1, e], k) => {
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], v) => {
        const qx = sx * (hx + PAD), qy = sy * (hy + PAD), o = k * 4 + v;
        pos.set([cx + qx, cy + qy, 0.02 * mode], 3 * o); aQ.set([qx, qy], 2 * o); aH.set([hx, hy], 2 * o);
        aR.set(mode === 1 ? [rad, mode, 0, wf] : [rad, mode, del, wf], 4 * o); c0.set(C0, 3 * o); c1.set(C1, 3 * o); aE[o] = e;
      });
      idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
    });
    const g = new THREE.BufferGeometry(), at = (key, a, s) => g.setAttribute(key, new THREE.BufferAttribute(a, s));
    at('position', pos, 3); at('aQ', aQ, 2); at('aH', aH, 2); at('aR', aR, 4); at('aC0', c0, 3); at('aC1', c1, 3); at('aE', aE, 1);
    g.setIndex(idx);
    const neon = new THREE.Mesh(g, neonMat);
    neon.renderOrder = 9; neon.frustumCulled = false; visG.add(neon);
  }

  // ------------------------------------------------------------------ update --
  const mS = new THREE.Matrix4(), mL = new THREE.Matrix4(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), sa = new THREE.Vector3(), sb = new THREE.Vector3();
  const LIE = new THREE.Matrix4().makeRotationX(-PI / 2), STAND = new THREE.Vector3(VX.body, 0.0, 0), SSTAND = 0.8;
  const BED_IN = 1.15, PASS = 0.85, TZ0 = 0.85;   // the table's head end at bed 0; its travel in; the travel of the pass
  let tableZ = TZ0;
  const live = { vis: 0, img: 0, ev: 0 };
  const sp = p => xp(scanG.matrix, p), pp = p => xp(patientG.matrix, p);
  function writeLine(k, ax, ay, az, bx, by, bz, col, al) {
    const A = fxG.attributes, P = A.position.array, C = A.aCol.array, k6 = 6 * k;
    P[k6] = ax; P[k6 + 1] = ay; P[k6 + 2] = az; P[k6 + 3] = bx; P[k6 + 4] = by; P[k6 + 5] = bz;
    C[k6] = C[k6 + 3] = col[0]; C[k6 + 1] = C[k6 + 4] = col[1]; C[k6 + 2] = C[k6 + 5] = col[2];
    A.aA.array[2 * k] = A.aA.array[2 * k + 1] = al;
  }
  function writePoint(k, x, y, z, col, size, al) {
    const A = fxPG.attributes, P = A.position.array, C = A.aCol.array, k3 = 3 * k;
    P[k3] = x; P[k3 + 1] = y; P[k3 + 2] = z; C[k3] = col[0]; C[k3 + 1] = col[1]; C[k3 + 2] = col[2]; A.aSize.array[k] = size; A.aA.array[k] = al;
  }
  function writeBeam(q, a, b, al) {
    const A = beamG.attributes, P = A.position.array, B = A.aB.array;
    for (let v = 0; v < 4; v++) {
      const o = 3 * (4 * q + v), s = v < 2 ? a : b, e = v < 2 ? b : a;
      P[o] = s[0]; P[o + 1] = s[1]; P[o + 2] = s[2]; B[o] = e[0]; B[o + 1] = e[1]; B[o + 2] = e[2]; A.aA.array[4 * q + v] = al;
    }
  }
  const lightCrystal = (idx, g) => { if (CG[idx] === 0 && nLit < LIT.length) LIT[nLit++] = idx; if (g > CG[idx]) CG[idx] = g; };
  const C_POS = [1.0, 0.36, 0.86], C_PH = [1.0, 0.9, 0.6], C_FL = [1.0, 0.96, 0.85], C_CR = [0.55, 0.9, 1.0], C_LOR = [1.0, 0.68, 0.36], C_WH = [1, 1, 1];

  function update(S, t) {
    const g = k => clamp(S[k] || 0, 0, 1);
    const vision = g('scan_vision'), bed = g('scan_bed'), cut = g('scan_cut') * (1 - prog(vision, 0, 0.3)), evs = g('scan_events'), lin = g('scan_lines'), img = g('scan_image');
    // as the image forms, the couch carries the patient on through the ring to the thighs (the counts come in behind it)
    const pass = g('scan_pass') + (1 - g('scan_pass')) * prog(img, 0, 0.6);
    const flo = S.scan_floor === undefined ? 1 : g('scan_floor');
    live.vis = vision; live.img = img; live.ev = evs;
    // the scanner moves to the left, shrinks a little and turns to show its side (as on the slide)
    const fs = smooth(prog(vision, 0, 0.45));
    scanG.position.set(lerp(0, -2.12, fs), lerp(0, -0.1, fs), lerp(0, -0.6, fs));
    scanG.rotation.y = lerp(0, -0.55, fs);
    scanG.scale.setScalar(lerp(1, 0.55, fs));
    scanG.updateMatrix(); scanG.matrixWorldNeedsUpdate = true;
    // the couch slides in, then on through the ring (the pass: from the head to the pelvis)
    tableZ = TZ0 - BED_IN * smooth(bed) - PASS * smooth(pass);
    tableMesh.position.z = tableZ; tableRefl.position.z = tableZ;
    pose.tz = tableZ + 0.3 + 0.712 * pose.s;
    // the patient: lying on the couch (in the scanner's frame), or standing up in the vision row
    mL.makeTranslation(0, pose.ty, pose.tz).multiply(LIE).multiply(mS.makeScale(pose.s, pose.s, pose.s));
    mL.premultiply(scanG.matrix);
    const fb = smooth(prog(vision, 0.08, 0.5));
    if (fb <= 0) patientG.matrix.copy(mL);
    else {
      mL.decompose(pa, qa, sa);
      qb.identity(); pb.copy(STAND); sb.setScalar(SSTAND);
      pa.lerp(pb, fb); pa.y += Math.sin(PI * fb) * 0.35; qa.slerp(qb, fb); sa.lerp(sb, fb);
      patientG.matrix.compose(pa, qa, sa);
    }
    patientG.matrixWorldNeedsUpdate = true;
    // the cut: the housing's upper half goes (a plane sweeping down to just above the bore's centre); lights down
    SU.uCut.value = lerp(1.12, 0.015, smooth(cut));
    SU.uWin.value = (ZH + 0.012) * smooth(prog(cut, 0.5, 1));
    innerMesh.visible = crystals.visible = cut > 0.002;   // hidden by the housing until it opens
    SU.uDim.value = 1 - 0.38 * smooth(Math.max(cut, evs)) * (1 - vision);
    const a = set.uA.value, solid = a > 0.97;
    solidMat.depthWrite = cryMat.depthWrite = solid;
    floorMesh.visible = outerRefl.visible = tableRefl.visible = flo > 0.003;
    floorMat.uniforms.uF.value = flo * (1 - 0.4 * fs);
    // the image: the counts light up behind the ring as the patient passes through it, then the smooth image (the
    // body set at steady state) glows inside the shell once the pass is done
    const standA = prog(vision, 0.1, 0.42), imgA = smooth(prog(img, 0.5, 0.95));
    const bodyA = Math.max(imgA * (1 - fb), standA);
    if (body) {
      body.setAlpha(a * bodyA);
      if (bodyA > 0.003) body.update(BP, t);
    }
    dotU.uImg.value = img * (1 - fb);
    dotU.uLow.value = (pose.tz - ZH) / pose.s;
    dots.visible = img > 0.003 && fb < 1;
    const dark = Math.max(smooth(prog(img, 0, 0.5)), 0.55 * smooth(Math.max(cut, evs)));
    // standing in the row, the shell turns into the slide's warm orange glow under the image (the image blends by
    // maximum, so its hot organs still show above it), with a bright rim round its outline
    shellU.uSC.value.setRGB(lerp(lerp(0.36, 0.02, dark), 0.85, fb), lerp(lerp(0.45, 0.03, dark), 0.25, fb), lerp(lerp(0.58, 0.05, dark), 0.04, fb));
    shellU.uSA.value = lerp(0.45, 0.84, dark) * (1 - smooth(prog(vision, 0.04, 0.25))) + 0.9 * standA * fb;
    shellU.uSR.value = lerp(1 - 0.35 * dark, 1.2, fb);
    shellU.uRC.value.setRGB(lerp(0.5, 1.0, fb), lerp(0.7, 0.55, fb), lerp(0.95, 0.2, fb));
    shellD.visible = shellU.uSA.value > 0.003; shellR.visible = shellU.uSR.value * standA + (1 - fb) > 0.003;
    // the hottest source inside the ring's slice gives the featured events
    featSrc = -1;
    for (const k of SRC_BY_W) if (Math.abs(pose.tz - pose.s * SRC[k][0][1]) < ZH - 0.025) { featSrc = k; break; }
    // the web of lines
    const cap = Math.round(lin * WEB_N), head = Math.floor(t * WEB_RATE);
    webU.uHead.value = head; webU.uCap.value = cap; webU.uNow.value = t; webU.uPose.value.set(pose.ty, pose.tz, pose.s);
    webU.uLin.value = (0.022 + 0.05 * (1 - lin)) * (1 - smooth(prog(img, 0.05, 0.55))) * (1 - fs);
    web.visible = cap > 0 && webU.uLin.value > 0.001;
    if (web.visible) webStep(cap, head);
    // the animated events
    let nl = 0, np = 0, nb = 0;
    for (let k = 0; k < nLit; k++) CG[LIT[k]] = 0;
    const litBefore = nLit;
    nLit = 0;
    const fxA = (1 - smooth(prog(img, 0.1, 0.5))) * (1 - fs);
    if (evs > 0.001 && fxA > 0.002) featState(t); else featured.on = false;
    if (evs > 0.001 && fxA > 0.002) {
      // beyond the featured events, the share of events shown grows with the square of scan_events (a few at 0.3)
      const q = evs > 0.08 ? Math.pow((evs - 0.08) / 0.92, 2) : -1;
      const j0 = Math.floor((t - WIN) * EV_RATE), j1 = Math.floor(t * EV_RATE);
      for (let j = j0; j <= j1; j++) {
        const tj = (j + 0.8 * hk(j, 50)) / EV_RATE, age = t - tj;
        if (age < 0) continue;
        const feat = mod(j, FEAT) === 0, w = (feat ? clamp(evs * 30, 0, 1) : clamp((q - hk(j, 51)) * 8, 0, 1)) * fxA;
        if (w <= 0.002 || nl > FXL - 12 || np > FXP - 24) continue;
        if (!place(j)) continue;
        const V = EV.V, big = feat ? 1.5 : 1;
        // the positron's short zigzag, then the flash where it meets an electron
        if (age < TP + 0.3) {
          const f = clamp(age / TP, 0, 1) * 6, fa = w * (1 - clamp((age - TP) / 0.3, 0, 1));
          let x = EV.ex, y = EV.ey, z = EV.ez;
          for (let s = 0; s < 6 && s < f; s++) {
            const u = Math.min(1, f - s), nx = x + STEP[3 * s] * u, ny = y + STEP[3 * s + 1] * u, nz = z + STEP[3 * s + 2] * u;
            writeLine(nl++, x, y, z, nx, ny, nz, C_POS, 0.95 * fa);
            x = nx; y = ny; z = nz;
          }
          if (age < TP) writePoint(np++, x, y, z, C_POS, 0.022 * big, w);
        }
        if (age >= TP && age < TP + 0.32) { const x = (age - TP) / 0.32; writePoint(np++, EV.px, EV.py, EV.pz, C_FL, big * (0.03 + 0.04 * Math.sqrt(x)), w * (1 - x) * (1 - x)); }
        if (age < TP) continue;
        // the two photons, back to back at a visible speed (the featured ones slower, as comets)
        const run = (age - TP) * V;
        for (let e = 0; e < 2; e++) {
          const sg = e ? -1 : 1, lim = e ? EV.tB : EV.tA, dx = sg * EV.dx, dy = sg * EV.dy, dz = sg * EV.dz;
          if (run < lim) {
            if (feat) {
              for (let c = 0; c < 7; c++) {
                const r = run - c * 0.025;
                if (r < 0) break;
                writePoint(np++, EV.px + dx * r, EV.py + dy * r, EV.pz + dz * r, C_PH, 0.036 - 0.0042 * c, w * Math.pow(1 - c / 7, 1.3));
              }
            }
            const r0 = Math.max(0, run - 0.075);
            writeLine(nl++, EV.px + dx * r0, EV.py + dy * r0, EV.pz + dz * r0, EV.px + dx * run, EV.py + dy * run, EV.pz + dz * run, C_PH, w);
            if (!feat) writePoint(np++, EV.px + dx * run, EV.py + dy * run, EV.pz + dz * run, C_PH, 0.02, w);
          } else {
            // scintillation: the struck crystal glows, and a flash on its face (or on the bore's cover over it)
            const x = (run - lim) / (0.45 * V), F = e ? EV.FB : EV.FA;
            if (x < 1) {
              lightCrystal(e ? EV.iB : EV.iA, w * Math.pow(1 - x, 1.5) * (feat ? 1 : 0.75));
              writePoint(np++, F[0], F[1], F[2], C_CR, big * (0.024 + 0.024 * (1 - x)), w * Math.pow(1 - x, 1.5));
              if (x < 0.4) writePoint(np++, F[0], F[1], F[2], C_WH, 0.015 * big, w * (1 - x / 0.4));
            }
          }
        }
        // the coincidence: a line of response joins the two crystals, then fades (the web keeps it while lines stay);
        // a featured line stays faintly until the next featured one is drawn
        const tc = TP + Math.max(EV.tA, EV.tB) / V, lt = feat ? 2.05 : 1.8;
        if (age >= tc && age < tc + lt) {
          const x = age - tc, la = w * (feat ? 0.16 + 0.8 * Math.exp(-x * 2.6) : 0.1 + 0.5 * Math.exp(-x * 2.6)) * (1 - smooth((x - lt + 0.4) / 0.4));
          writeLine(nl++, EV.A[0], EV.A[1], EV.A[2], EV.B[0], EV.B[1], EV.B[2], C_LOR, la);
          if (feat && nb < 2) writeBeam(nb++, EV.A, EV.B, la * 1.1);
        }
      }
    }
    fxL.visible = nl > 0; fxP.visible = np > 0; beam.visible = nb > 0;
    fxG.setDrawRange(0, nl * 2); fxPG.setDrawRange(0, np); beamG.setDrawRange(0, nb * 6);
    send(fxG, nl * 2, FXL_AT); send(fxPG, np, FXP_AT); send(beamG, nb * 4, BEAM_AT);
    if (nLit || litBefore) cg.attributes.aG.needsUpdate = true;
    // the vision row fades in left to right
    const e = k => smooth(prog(vision, k, k + 0.2));
    SU.uE.value.set(e(0.12), e(0.36), e(0.62), 0);
    visG.visible = vision > 0.003;
    netU.uF.value = e(0.44); iconU.uF.value = e(0.48);
    neonU.uG.value.set(prog(vision, 0.7, 0.86), prog(vision, 0.74, 0.9), prog(vision, 0.78, 0.94), prog(vision, 0.8, 1.0));
  }
  const FXL_AT = { position: 3, aCol: 3, aA: 1 }, FXP_AT = { position: 3, aCol: 3, aSize: 1, aA: 1 }, BEAM_AT = { position: 3, aB: 3, aA: 1 };
  // upload only the part of a packed buffer that is drawn
  function send(geo, n, sz) {
    if (!n) return;
    for (const k in sz) { const at = geo.attributes[k]; at.updateRange.offset = 0; at.updateRange.count = n * sz[k]; at.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ exports --
  const anchors = {
    centre: () => sp([0, 0, 0]), bore: () => sp([0, 0, 0.8]), ring: () => sp([0, RC1 + 0.12, 0]), gantry: () => sp([0.62, 0.98, 0.55]),
    couch: () => sp([0.27, TOP - 0.03, tableZ + 1.95]), patient: () => pp([0, 0.32, 0.1]), head: () => pp([0, 0.76, 0.08]),
    tumour: () => pp(TUMOUR), event: () => (featured.on ? sp(featured.p) : sp([0, 0.1, 0])), lor: () => (featured.on ? sp(featured.lor) : sp([-0.36, -0.2, 0])),
    floor: () => sp([0, FLOOR, 0]), vision_scan: () => sp([-0.2, 1.12, 0.2]), vision_body: [VX.body - 0.15, 0.84, 0], vision_net: [VX.net - 0.3, 0.84, 0],
    vision_prog: [VX.prog - 0.55, 0.8, 0], vision_med: [VX.prog - 0.55, 0.0, 0],
  };
  const rowA = (S, k) => prog(S.scan_vision || 0, k, k + 0.15);
  const notRow = S => 1 - prog(S.scan_vision || 0, 0, 0.2);
  const evLab = S => notRow(S) * (1 - prog(S.scan_image || 0, 0, 0.3)) * (featured.on ? 1 : 0);
  return Object.assign(set, {
    params: { scan_a: 1, scan_bed: 0, scan_pass: 0, scan_cut: 0, scan_events: 0, scan_lines: 0, scan_image: 0, scan_vision: 0, scan_floor: 1 },
    floorY: FLOOR,
    update,
    anchors,
    labels: [
      { text: ['PET/CT scanner', ''], at: 'gantry', cls: 'cyn', alpha: S => notRow(S) * (1 - prog(S.scan_cut || 0, 0, 0.4)) * (1 - prog(S.scan_image || 0, 0, 0.3)) },
      { text: ['Detector ring', ''], at: 'ring', cls: 'cyn', alpha: S => notRow(S) * prog(S.scan_cut || 0, 0.6, 1) * (1 - prog(S.scan_image || 0, 0, 0.3)) },
      // the featured event's labels: the photons' brighter while they fly, the line's once a line has been drawn
      // (in the story each comes as the panel's text names it: the photons once the lines begin, the line of response
      // once they are under way; with the events on in explore, scan_events is 1 and both show at once)
      { text: ['Two gamma photons', '· 511 keV each'], at: 'event', cls: 'amb', alpha: S => evLab(S) * prog(S.scan_events || 0, 0.005, 0.04) * Math.max(prog(S.scan_lines || 0, 0.04, 0.06), prog(S.scan_events || 0, 0.9, 1)) * (1 - prog(S.scan_lines || 0, 0.45, 0.65)) * (0.45 + 0.55 * featured.env) },
      { text: ['Line of response', ''], at: 'lor', cls: 'amb', alpha: S => evLab(S) * featured.lorOn * prog(S.scan_events || 0, 0.01, 0.05) * Math.max(prog(S.scan_lines || 0, 0.41, 0.45), prog(S.scan_events || 0, 0.9, 1)) * (1 - prog(S.scan_lines || 0, 0.72, 0.9)) },
      { text: ['FDG', 'in the patient'], at: 'patient', cls: 'amb', alpha: S => notRow(S) * prog(S.scan_image || 0, 0.5, 0.9) },
      // (the row's names give way on narrow screens, where they covered the pictures: minor)
      { text: ['PET scan', ''], at: 'vision_scan', minor: true, alpha: S => rowA(S, 0.3) },
      { text: ['One body', ''], at: 'vision_body', minor: true, alpha: S => rowA(S, 0.4) },
      { text: ['One network', ''], at: 'vision_net', minor: true, alpha: S => rowA(S, 0.6) },
      { text: ['Prognosis', ''], at: 'vision_prog', minor: true, alpha: S => rowA(S, 0.74) },
      { text: ['Medication', ''], at: 'vision_med', minor: true, alpha: S => rowA(S, 0.8) },
    ],
    cam: {
      default: [34, 13, 7.2, 0, -0.25, 0.95], front: [0, 4, 6.4, 0, -0.1, 0.4], ring: [28, 22, 2.4, 0, -0.02, 0], side: [90, 6, 7.6, 0, -0.25, 0.9],
      inside: [0, 18, 1.1, 0, -0.08, -0.35], vision: [0, 3, 8.2, 0, -0.02, 0], life: [20, 12.4, 2.56, 0, 0, 0.8],
    },
    controls: [
      { key: 'view', label: 'View', options: [['scanner', 'Scanner'], ['ring', 'Ring'], ['inside', 'Inside'], ['vision', 'Vision']] },
      // (the vision row shows neither: when says which views they apply to)
      { key: 'events', label: 'Events', options: [['off', 'Off'], ['on', 'On']], when: c => c.view !== 'vision' },
      { key: 'image', label: 'Image', options: [['lines', 'Lines'], ['image', 'Image']], when: c => c.view !== 'vision' },
    ],
    // every view but Vision: the couch in with the chest in the ring (switching views never moves it); the housing
    // opens in Ring, and in Scanner while events or the image show (closed, it hid them)
    explore(c) {
      const row = c.view === 'vision', on = c.events === 'on' && !row, im = c.image === 'image' && !row;
      return {
        scan_bed: row ? 0 : 1, scan_pass: row ? 0 : 0.4, scan_cut: c.view === 'ring' || (c.view === 'scanner' && (on || im)) ? 1 : 0, scan_vision: row ? 1 : 0,
        scan_events: on ? 1 : 0, scan_lines: on && !im ? 1 : 0, scan_image: im ? 1 : 0,
      };
    },
    // for the engine: the latest featured event (a point in the set's frame) and whether events are showing
    api() { return { floorY: FLOOR, event: () => (featured.on ? anchors.event() : null), live }; },
  });
};
