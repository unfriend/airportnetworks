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
  // faces) show as the dark inside of the housing. uMir draws the mirrored copy (the floor's reflection).
  const SU = { uCut: { value: 9 }, uWin: { value: 0 }, uDim: { value: 1 }, uFloor: { value: FLOOR }, uE: { value: new THREE.Vector4(1, 1, 1, 1) } };
  function studio(o = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uMir: { value: o.mir ? 1 : 0 }, uK: { value: 1 } }, SU),
      transparent: true, depthWrite: !o.mir && !o.vis, side: THREE.DoubleSide, extensions: { derivatives: true },
      vertexShader: `
attribute vec3 color; attribute vec4 aM; attribute float aE;
uniform vec4 uE;
varying vec3 vC, vN, vW, vL, vLN; varying vec4 vM; varying float vE;
void main() {
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
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  bool inside = !gl_FrontFacing;
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
  float a = uA * vE * uK;
  if (vM.z > 0.5) col += vec3(0.4, 0.82, 1.0) * (1.0 - smoothstep(0.0, 0.011, uCut - vL.y)) * 1.5;
  if (vM.z > 1.5 && uWin > 0.0) col += vec3(0.4, 0.82, 1.0) * (1.0 - smoothstep(0.0, 0.008, abs(vL.z) - uWin)) * 1.2;
  if (uMir > 0.5) a *= 0.32 * exp(-max(vL.y - uFloor, 0.0) * 3.0);
  gl_FragColor = vec4(col, a);
}`,
    });
    set.mats.push(m);
    return m;
  }
  const solidMat = studio(), mirMat = studio({ mir: true }), visMat = studio({ vis: true });

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
    for (let k = 0; k < 6; k++) slab(outer, rrect(0, 0, 0.002, 0.002, 0.002, 3), 0.005, 0.004, cutL([0.95, 0.96, 0.97], 0.6), at(-0.0 - 0.032 * (k >> 1), 0.79).multiply(new THREE.Matrix4().makeTranslation((k & 1 ? 0.014 : -0.014), 0, 0)));
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
  // the crystals: 192 around x 24 deep (48 blocks of 4 x 4 around, 6 blocks deep), dark glass, their faces to the bore
  const cryPitchA = TAU / NA, cryPitchZ = 2 * ZH / NZ;
  const cryZ = k => -ZH + (k + 0.5) * cryPitchZ, cryA = k => (k + 0.5) * cryPitchA;
  const cg = new THREE.BoxGeometry(RDET * cryPitchA * 0.86, cryPitchZ * 0.86, RC1 - RC0);
  {
    const nv = cg.attributes.position.count, nrm = cg.attributes.normal.array, C = new Float32Array(nv * 3), M = new Float32Array(nv * 4);
    for (let v = 0; v < nv; v++) {
      const face = nrm[3 * v + 2] < -0.5;   // the face towards the axis
      C.set(face ? [0.2, 0.44, 0.6] : [0.09, 0.17, 0.25], 3 * v); M.set([0.95, face ? 0.25 : 0.12, 0, 1], 4 * v);
    }
    cg.setAttribute('color', new THREE.BufferAttribute(C, 3)); cg.setAttribute('aM', new THREE.BufferAttribute(M, 4));
    cg.setAttribute('aE', new THREE.BufferAttribute(new Float32Array(nv), 1));
  }
  const crystals = new THREE.InstancedMesh(cg, solidMat, NA * NZ);
  for (let ia = 0; ia < NA; ia++) for (let iz = 0; iz < NZ; iz++) {
    const a = cryA(ia), c = Math.cos(a), s = Math.sin(a);
    crystals.setMatrixAt(ia * NZ + iz, basis([-s, c, 0], [0, 0, 1], [c, s, 0], [RDET * c, RDET * s, cryZ(iz)]));
  }
  crystals.instanceMatrix.needsUpdate = true;
  const cryPos = (ia, iz) => { const a = cryA(ia); return [RDET * Math.cos(a), RDET * Math.sin(a), cryZ(iz)]; };

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
    const BS = 4, rb = 1.05 * Math.sqrt(3) * BS * h / 2, done = new Uint8Array(nx * ny * nz), near = [], far = [];
    for (let I = 0; I < nx - 1; I += BS) for (let J = 0; J < ny - 1; J += BS) for (let L = 0; L < nz - 1; L += BS) {
      const b = [I, J, L, Math.min(I + BS, nx - 1), Math.min(J + BS, ny - 1), Math.min(L + BS, nz - 1)];
      const fc = f(lo[0] + (b[0] + b[3]) / 2 * h, lo[1] + (b[1] + b[4]) / 2 * h, lo[2] + (b[2] + b[5]) / 2 * h);
      if (Math.abs(fc) > rb) { b.push(fc > 0 ? 1 : -1); far.push(b); } else near.push(b);
    }
    for (const [I, J, L, i1, j1, k1] of near) for (let i = I; i <= i1; i++) for (let j = J; j <= j1; j++) for (let k = L; k <= k1; k++) {
      const q = id(i, j, k); if (!done[q]) { F[q] = f(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h); done[q] = 1; }
    }
    for (const [I, J, L, i1, j1, k1, sg] of far) for (let i = I; i <= i1; i++) for (let j = J; j <= j1; j++) for (let k = L; k <= k1; k++) { const q = id(i, j, k); if (!done[q]) F[q] = sg; }
    const VI = new Int32Array(nx * ny * nz).fill(-1), P = [], N = [], cv = new Float64Array(8);
    const EG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [I, J, L] of near) for (let i = I; i < Math.min(I + BS, nx - 1); i++) for (let j = J; j < Math.min(J + BS, ny - 1); j++) for (let k = L; k < Math.min(L + BS, nz - 1); k++) {
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
    for (const [I0, J0, L0] of near) for (let i = I0; i < Math.min(I0 + BS, nx - 1); i++) for (let j = J0; j < Math.min(J0 + BS, ny - 1); j++) for (let k = L0; k < Math.min(L0 + BS, nz - 1); k++) {
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
  const BS = body ? Object.assign({}, body.params, { body_pet: 1, body_net: 0, body_state: 0, body_blank: 0 }) : null;
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
  const POOL = 4096, PX = new Float32Array(POOL), PY = new Float32Array(POOL), PZ = new Float32Array(POOL), PI_ = new Float32Array(POOL);
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
    tmp.forEach((q, k) => { PX[k] = q[0]; PY[k] = q[1]; PZ[k] = q[2]; PI_[k] = q[3]; });
  }
  const lowerY = y => { let lo = 0, hi = POOL; while (lo < hi) { const m = (lo + hi) >> 1; if (PY[m] < y) lo = m + 1; else hi = m; } return lo; };

  // the counts: as the image forms, the pool's points light up one by one in hot iron (a grainy first image), then
  // give way to the smooth image; a tumour glows in the right lung (the body set has none)
  const hotC = x => [Math.pow(clamp(x * 2, 0, 1), 0.9), Math.pow(clamp((x - 0.15) / 0.8, 0, 1), 1.5), clamp((x - 0.76) * 4.2, 0, 1) * 0.95];
  const dotG = K.pointsGeo(POOL + 260);
  {
    const p = dotG.attributes.position.array, c = dotG.attributes.aCol.array, s = dotG.attributes.aSize.array, sd = new Float32Array(POOL + 260), R = rng(7);
    for (let k = 0; k < POOL; k++) { p.set([PX[k], PY[k], PZ[k]], 3 * k); c.set(hotC(PI_[k] * (0.7 + 0.4 * hash(k))), 3 * k); s[k] = 0.011; sd[k] = hash(k + 99); }
    for (let k = POOL; k < POOL + 260; k++) { const q = v3.mul(K.unit(R), 0.012 * Math.cbrt(R())); p.set(v3.add(TUMOUR, q), 3 * k); c.set(hotC(0.75 + 0.25 * R()), 3 * k); s[k] = 0.012; sd[k] = -1; }
    dotG.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  }
  // up close (in a headset, or the inside view) sprites shrink with distance, so they stay grains, not discs
  const CLOSE = ' gl_PointSize *= clamp(-mv.z / length(modelViewMatrix[0].xyz) / 1.6, 0.35, 1.0);';
  const dotU = { uImg: { value: 0 } };
  const dotMat = K.points(set, { uniforms: dotU, head: 'attribute float aSeed; uniform float uImg;',
    vertex: 'vA *= aSeed < 0.0 ? smoothstep(0.45, 0.8, uImg) : smoothstep(aSeed * 0.55, aSeed * 0.55 + 0.04, uImg) * (1.0 - smoothstep(0.62, 0.95, uImg));' + CLOSE });
  const dots = new THREE.Points(dotG, dotMat);
  dots.renderOrder = 4; dots.frustumCulled = false;
  patientG.add(dots);

  // ------------------------------------------------------------------ events and lines of response --
  // A positron travels about a millimetre (drawn larger), meets an electron: both turn into two 511 keV photons flying
  // apart in exactly opposite directions; each hits a crystal, which flashes; the coincidence gives a line of response
  // between the two crystals, through the point where the sugar was. Animated events come at 25 a second (each shown
  // when its hash is below scan_events); the web of lines comes from a faster stream (200 a second), as a real scan
  // records millions. Everything is a function of the event's index and of where the couch is now.
  const EV_RATE = 25, WEB_RATE = 200, WEB_N = 3000, V_PH = 2.2, TP = 0.24;
  const pose = { ty: TOP + 0.116 * 0.97, tz: 0.3, s: 0.97 };   // the body's frame in the scanner's: x' = s x, y' = ty + s z, z' = tz - s y
  const toScan = (x, y, z) => [pose.s * x, pose.ty + pose.s * z, pose.tz - pose.s * y];
  let rangeLo = 0, rangeHi = 0;
  const ev = {};   // reused: e (emission), p (annihilation), d, A, B, sA, sB, hit
  function event(i, rate, out, path, feat) {
    const det = rangeHi > rangeLo, h0 = hk(i, 0 + rate);
    const k = det ? rangeLo + Math.min(rangeHi - rangeLo - 1, Math.floor(h0 * (rangeHi - rangeLo))) : Math.floor(h0 * POOL);
    const e = toScan(PX[k], PY[k], PZ[k]);
    let p = e;
    if (path) {
      path[0] = e;
      for (let s = 1; s <= 6; s++) { const u = [hk(i, 10 + s) - 0.5, hk(i, 20 + s) - 0.5, hk(i, 30 + s) - 0.5]; p = v3.add(p, v3.mul(v3.norm(u), 0.0065)); path[s] = p; }
    }
    if (det) p = [p[0], p[1], clamp(p[2], -ZH + 0.006, ZH - 0.006)];
    // a featured event (the one the labels follow) flies roughly sideways, so both photons cross open space
    const phi = feat ? (hk(i, 5) < 0.5 ? 0 : PI) + (hk(i, 3) - 0.5) * 1.1 : hk(i, 3) * TAU;
    let d = v3.norm([Math.cos(phi), Math.sin(phi), (hk(i, 4) - 0.5) * 0.3]);
    const hit = (dd) => {
      const a = dd[0] * dd[0] + dd[1] * dd[1], b = 2 * (p[0] * dd[0] + p[1] * dd[1]), c = p[0] * p[0] + p[1] * p[1] - RDET * RDET, q = Math.sqrt(Math.max(b * b - 4 * a * c, 0));
      return [(-b + q) / (2 * a), (-b - q) / (2 * a)];
    };
    let [s1, s2] = hit(d);
    if (Math.abs(p[2] + d[2] * s1) > ZH || Math.abs(p[2] + d[2] * s2) > ZH) { d = [Math.cos(phi), Math.sin(phi), 0]; [s1, s2] = hit(d); }
    const snap = q => { const ia = ((Math.floor(Math.atan2(q[1], q[0]) / cryPitchA) % NA) + NA) % NA, iz = clamp(Math.floor((q[2] + ZH) / cryPitchZ), 0, NZ - 1); return cryPos(ia, iz); };
    out.e = e; out.p = p; out.d = d; out.hit = det;
    out.sA = s1; out.sB = -s2;
    out.A = det ? snap(v3.add(p, v3.mul(d, s1))) : null; out.B = det ? snap(v3.add(p, v3.mul(d, s2))) : null;
    return out;
  }
  // the web: one buffer of 3000 reusable slots (slot = index mod 3000); the shader fades lines by age and by how
  // many may stay (scan_lines), so a frame only writes the newest lines
  const webG = K.linesGeo(WEB_N);
  webG.setAttribute('aIdx', new THREE.BufferAttribute(new Float32Array(WEB_N * 2).fill(-1e9), 1));
  webG.setAttribute('aTim', new THREE.BufferAttribute(new Float32Array(WEB_N * 2).fill(-1e9), 1));
  {
    const c = webG.attributes.aCol.array;
    for (let k = 0; k < WEB_N; k++) { const v = 0.8 + 0.2 * hash(k + 7), col = [1.0 * v, 0.42 * v, 0.12 * v]; c.set(col, 6 * k); c.set(col, 6 * k + 3); }
  }
  const webU = { uHead: { value: 0 }, uCap: { value: 0 }, uNow: { value: 0 }, uLin: { value: 0 } };
  const webMat = K.lines(set, { uniforms: webU, head: 'attribute float aIdx, aTim; uniform float uHead, uCap, uNow, uLin;',
    vertex: 'float kk = uHead - aIdx, age = uNow - aTim; vA *= uLin * smoothstep(0.0, 0.3, age) * step(-0.5, kk) * (1.0 - smoothstep(uCap * 0.7, uCap + 0.5, kk));' });
  const web = new THREE.LineSegments(webG, webMat);
  web.renderOrder = 5; web.frustumCulled = false; scanG.add(web);
  const slotIdx = new Float64Array(WEB_N).fill(NaN);
  let webKey = null;
  // the animated events: positron paths, photon streaks and their lines (lines), flashes (points); packed each frame
  const FXL = 900, FXP = 260;
  const fxG = K.linesGeo(FXL), fxPG = K.pointsGeo(FXP);
  const fxL = new THREE.LineSegments(fxG, K.lines(set)), fxP = new THREE.Points(fxPG, K.points(set, { vertex: CLOSE }));
  fxL.renderOrder = 6; fxP.renderOrder = 7; fxL.frustumCulled = fxP.frustumCulled = false;
  scanG.add(fxL, fxP);
  const PATH = [];
  const featured = { p: [0, 0, 0], lor: [0, 0.42, 0], on: false };

  // ------------------------------------------------------------------ the vision row --
  // the scanner moves to the left; to its right, linked by big soft arrows: the glowing body standing (the same
  // body, risen from the couch), a neon network of organs, and prognosis (three bars) above medication (a bar chart)
  const visG = new THREE.Group();
  set.group.add(visG);
  const VX = { body: -0.62, net: 0.68, prog: 2.36 }, CHEV = [-1.22, -0.06, 1.46];
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
  const NET_NODE = [['thyroid', [-0.43, 0.43, -0.1]], ['muscle', [-0.6, 0.12, 0.12]], ['adrenal', [-0.2, 0.26, 0.18]], ['spleen', [0.3, 0.3, -0.12]],
    ['pancreas', [0.58, 0.1, 0.1]], ['intestine', [0.6, -0.46, -0.06]], ['fat', [-0.52, -0.52, -0.12]], ['marrow', [0.32, -0.66, 0.12]], ['aorta', [-0.13, -0.36, -0.15]],
    ['brain', [-0.22, 0.64, 0.0]], ['spleen', [0.42, 0.6, 0.06]], ['heart', [-0.66, -0.2, -0.05]]];
  let iconTex = null;
  {
    const S = 256, cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (cv) {
      cv.width = S * NET_ORG.length; cv.height = S;
      const ctx = cv.getContext('2d');
      NET_ORG.forEach(([id, f], k) => {
        const col = (D && (D.organs.find(o => o.id === id) || {}).col) || f, cx = (k + 0.5) * S, cy = S / 2;
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
      for (let v = 0; v < uv.length; v += 2) uv[v] = (k + uv[v]) / NET_ORG.length;
      return g.translate(netC[0] + p[0], netC[1] + p[1], p[2]);
    });
    const icons = new THREE.Mesh(K.merge(quads), iconMat);
    icons.renderOrder = 9; icons.frustumCulled = false; visG.add(icons);
  }
  // the network's nodes (the other organs, small coloured discs) and glowing links (each in its two nodes' colours)
  const NODES = [...NET_ORG.map(([id, f, p]) => ({ p: v3.add(netC, p), c: ocol(id, f), big: true })), ...NET_NODE.map(([id, p]) => ({ p: v3.add(netC, p), c: ocol(id, '#99aaaa'), big: false }))];
  const LINKS = [];
  {
    const seen = new Set();
    NODES.forEach((a, i) => {
      const near = NODES.map((b, j) => [v3.dist(a.p, b.p), j]).filter(q => q[1] !== i).sort((x, y) => x[0] - y[0]).slice(0, a.big ? 3 : 3);
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
    const PB = [[0.64, 0.8, '#ff6a1a', '#ffc27a', 1], [0.42, 0.4, '#e0103c', '#ff7a94', 2], [0.2, 0.9, '#ffb000', '#fff08a', 3]];
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
  const mS = new THREE.Matrix4(), mL = new THREE.Matrix4(), mT = new THREE.Matrix4(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), sa = new THREE.Vector3(), sb = new THREE.Vector3();
  const LIE = new THREE.Matrix4().makeRotationX(-PI / 2), STAND = new THREE.Vector3(VX.body, 0.0, 0), SSTAND = 0.8;
  const BED_IN = 1.15, PASS = 0.85, TZ0 = 0.85;   // the table's head end at bed 0; its travel in; the travel of the pass
  let tableZ = TZ0;
  const live = { vis: 0, img: 0, ev: 0 };
  const sp = p => xp(scanG.matrix, p), pp = p => xp(patientG.matrix, p);
  function writeLine(geo, k, a, b, col, al) {
    const A = geo.attributes;
    A.position.array.set(a, 6 * k); A.position.array.set(b, 6 * k + 3);
    A.aCol.array.set(col, 6 * k); A.aCol.array.set(col, 6 * k + 3);
    A.aA.array[2 * k] = al; A.aA.array[2 * k + 1] = al;
  }
  function writePoint(geo, k, p, col, size, al) {
    const A = geo.attributes;
    A.position.array.set(p, 3 * k); A.aCol.array.set(col, 3 * k); A.aSize.array[k] = size; A.aA.array[k] = al;
  }
  const C_POS = [1.0, 0.36, 0.86], C_PH = [1.0, 0.9, 0.6], C_FL = [1.0, 0.96, 0.85], C_CR = [0.55, 0.9, 1.0], C_LOR = [1.0, 0.68, 0.36];

  function update(S, t) {
    const g = k => clamp(S[k] || 0, 0, 1);
    const vision = g('scan_vision'), bed = g('scan_bed'), pass = g('scan_pass'), cut = g('scan_cut') * (1 - prog(vision, 0, 0.3)), evs = g('scan_events'), lin = g('scan_lines'), img = g('scan_image');
    const flo = S.scan_floor === undefined ? 1 : g('scan_floor');
    live.vis = vision; live.img = img; live.ev = evs;
    // the scanner moves to the left, shrinks a little and turns to show its side (as on the slide)
    const fs = smooth(prog(vision, 0, 0.45));
    scanG.position.set(lerp(0, -2.08, fs), lerp(0, -0.1, fs), lerp(0, -0.6, fs));
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
    solidMat.depthWrite = solid;
    floorMesh.visible = outerRefl.visible = tableRefl.visible = flo > 0.003;
    floorMat.uniforms.uF.value = flo * (1 - 0.4 * fs);
    // the image: the counts light up, then the smooth image (the body set at steady state) glows inside the shell
    const standA = prog(vision, 0.1, 0.42), imgA = smooth(prog(img, 0.3, 0.92));
    const bodyA = Math.max(imgA * (1 - fb), standA);
    if (body) {
      body.setAlpha(a * bodyA);
      if (bodyA > 0.003) body.update(BS, t);
    }
    dotU.uImg.value = img * (1 - fb);
    dots.visible = img > 0.003 && fb < 1;
    const dark = Math.max(smooth(prog(img, 0, 0.5)), 0.55 * smooth(Math.max(cut, evs)));
    // standing in the row, the shell turns into the slide's warm glow under the image (the image blends by maximum)
    shellU.uSC.value.setRGB(lerp(lerp(0.36, 0.02, dark), 0.42, fb), lerp(lerp(0.45, 0.03, dark), 0.09, fb), lerp(lerp(0.58, 0.05, dark), 0.01, fb));
    shellU.uSA.value = lerp(0.45, 0.84, dark) * (1 - smooth(prog(vision, 0.04, 0.25))) + 0.9 * standA * fb;
    // standing in the row, the body keeps a warm glow round its outline (the slide's glowing body)
    shellU.uSR.value = lerp(1 - 0.35 * dark, 0.85, fb);
    shellU.uRC.value.setRGB(lerp(0.5, 1.0, fb), lerp(0.7, 0.42, fb), lerp(0.95, 0.12, fb));
    shellD.visible = shellU.uSA.value > 0.003; shellR.visible = shellU.uSR.value * standA + (1 - fb) > 0.003;
    // which slice of the patient is inside the ring (events come only from there)
    rangeLo = lowerY((pose.tz - ZH) / pose.s); rangeHi = lowerY((pose.tz + ZH) / pose.s);
    // the web of lines
    const cap = Math.round(lin * WEB_N), head = Math.floor(t * WEB_RATE);
    webU.uHead.value = head; webU.uCap.value = cap; webU.uNow.value = t;
    webU.uLin.value = (0.022 + 0.05 * (1 - lin)) * (1 - smooth(prog(img, 0.05, 0.55))) * (1 - fs);
    web.visible = cap > 0 && webU.uLin.value > 0.001;
    if (web.visible) {
      const key = rangeLo + ':' + rangeHi + ':' + Math.round(pose.tz * 100);
      if (key !== webKey) { webKey = key; slotIdx.fill(NaN); }
      const A = webG.attributes;
      let lo = WEB_N, hi = -1, nw = 0;
      for (let k = 0; k < cap; k++) {
        const i = head - k, slot = ((i % WEB_N) + WEB_N) % WEB_N;
        if (slotIdx[slot] === i) continue;
        slotIdx[slot] = i; nw++;
        event(i, 1, ev, null);
        if (ev.hit) { A.position.array.set(ev.A, 6 * slot); A.position.array.set(ev.B, 6 * slot + 3); }
        else { A.position.array.fill(0, 6 * slot, 6 * slot + 6); }
        A.aIdx.array[2 * slot] = A.aIdx.array[2 * slot + 1] = ev.hit ? i : -1e9;
        A.aTim.array[2 * slot] = A.aTim.array[2 * slot + 1] = i / WEB_RATE;
        lo = Math.min(lo, slot); hi = Math.max(hi, slot);
      }
      if (nw) {
        const full = nw > 400 || hi - lo > 400;
        for (const [k, s] of [['position', 6], ['aIdx', 2], ['aTim', 2]]) {
          const at = A[k];
          at.updateRange.offset = full ? 0 : lo * s; at.updateRange.count = full ? -1 : (hi - lo + 1) * s; at.needsUpdate = true;
        }
      }
    }
    // the animated events
    let nl = 0, np = 0;
    featured.on = false;
    const fxA = (1 - smooth(prog(img, 0.1, 0.5))) * (1 - fs);
    if (evs > 0.001 && fxA > 0.002) {
      const j0 = Math.floor((t - 2.4) * EV_RATE), j1 = Math.floor(t * EV_RATE), jf = Math.floor(t * EV_RATE / 50) * 50;
      for (let j = j0; j <= j1; j++) {
        const tj = (j + 0.8 * hk(j, 50)) / EV_RATE, age = t - tj;
        if (age < 0) continue;
        // the featured events (one every 2 s, which the labels follow) show from the lowest scan_events; the rest above 0.08
        const w = (j === jf || j === jf - 50 ? clamp(evs * 30, 0, 1) : clamp((evs - 0.08 - 0.92 * hk(j, 51)) * 8, 0, 1)) * fxA;
        if (w <= 0.002) continue;
        event(j, 7, ev, PATH, j === jf || j === jf - 50);
        const p = ev.p, big = j === jf || j === jf - 50 ? 1.5 : 1;
        if (j === jf || (j === jf - 50 && !featured.on)) {
          // labels: the photons' just above the annihilation, the line's on the line near its left-hand crystal
          featured.on = true; featured.p = v3.add(p, [0, 0.05, 0]);
          const L = ev.hit ? (ev.A[0] < ev.B[0] ? ev.A : ev.B) : v3.add(p, v3.mul(ev.d, 0.3));
          featured.lor = v3.add(v3.lerp(L, p, 0.3), [0, -0.035, 0]);
        }
        // the positron's short zigzag, then the flash where it meets an electron
        if (age < TP + 0.3 && nl < FXL - 10) {
          const f = clamp(age / TP, 0, 1) * 6, fa = w * (1 - clamp((age - TP) / 0.3, 0, 1));
          for (let s = 0; s < 6 && s < f; s++) {
            const b = s + 1 <= f ? PATH[s + 1] : v3.lerp(PATH[s], PATH[s + 1], f - s);
            writeLine(fxG, nl++, PATH[s], b, C_POS, 0.95 * fa);
          }
          if (age < TP) writePoint(fxPG, np++, v3.lerp(PATH[Math.min(5, Math.floor(f))], PATH[Math.min(6, Math.floor(f) + 1)], f - Math.floor(f)), C_POS, 0.022, w);
        }
        if (age >= TP && age < TP + 0.32 && np < FXP - 4) { const x = (age - TP) / 0.32; writePoint(fxPG, np++, p, C_FL, big * (0.03 + 0.04 * Math.sqrt(x)), w * (1 - x) * (1 - x)); }
        // the two photons, back to back at a visible speed
        if (age >= TP) {
          const run = (age - TP) * V_PH;
          for (const [sgn, dist, C] of [[1, ev.sA, ev.A], [-1, ev.sB, ev.B]]) {
            const lim = ev.hit ? dist : 0.75;
            if (run < lim && nl < FXL - 2) {
              const hd = v3.add(p, v3.mul(ev.d, sgn * run)), tail = v3.add(p, v3.mul(ev.d, sgn * Math.max(0, run - 0.075)));
              const fadeOut = ev.hit ? 1 : 1 - run / 0.75;
              writeLine(fxG, nl++, tail, hd, C_PH, w * fadeOut);
              if (np < FXP - 2) writePoint(fxPG, np++, hd, C_PH, 0.02 * big, w * fadeOut);
            } else if (ev.hit && np < FXP - 2) {
              const x = (run - lim) / (0.45 * V_PH);
              if (x < 1) { writePoint(fxPG, np++, C, C_CR, big * (0.022 + 0.022 * (1 - x)), w * Math.pow(1 - x, 1.5)); if (x < 0.4 && np < FXP - 1) writePoint(fxPG, np++, C, [1, 1, 1], 0.014, w * (1 - x / 0.4)); }
            }
          }
          // the coincidence: a line of response joins the two crystals, then fades to a faint trace
          const tc = TP + Math.max(ev.sA, ev.sB) / V_PH;
          if (ev.hit && age >= tc && age < tc + 1.8 && nl < FXL - 3) {
            const x = age - tc, la = w * (0.1 + (big > 1 ? 0.8 : 0.5) * Math.exp(-x * 2.6)) * (1 - smoothstep01((x - 1.3) / 0.5));
            writeLine(fxG, nl++, ev.A, ev.B, C_LOR, la);
            // the featured line is drawn thicker (three strands)
            if (big > 1) for (const o of [[0, 0.0025, 0.0015], [0, -0.0025, -0.0015]]) writeLine(fxG, nl++, v3.add(ev.A, o), v3.add(ev.B, o), C_LOR, la * 0.8);
          }
        }
      }
    }
    fxL.visible = nl > 0; fxP.visible = np > 0;
    fxG.setDrawRange(0, nl * 2); fxPG.setDrawRange(0, np);
    for (const [geo, n, sz] of [[fxG, nl * 2, { position: 3, aCol: 3, aA: 1 }], [fxPG, np, { position: 3, aCol: 3, aSize: 1, aA: 1 }]]) {
      if (!n) continue;
      for (const k in sz) { const at = geo.attributes[k]; at.updateRange.offset = 0; at.updateRange.count = n * sz[k]; at.needsUpdate = true; }
    }
    // the vision row fades in left to right
    const e = k => smooth(prog(vision, k, k + 0.2));
    SU.uE.value.set(e(0.12), e(0.36), e(0.62), 0);
    visG.visible = vision > 0.003;
    netU.uF.value = e(0.44); iconU.uF.value = e(0.48);
    neonU.uG.value.set(prog(vision, 0.7, 0.86), prog(vision, 0.74, 0.9), prog(vision, 0.78, 0.94), prog(vision, 0.8, 1.0));
  }
  const smoothstep01 = x => smooth(clamp(x, 0, 1));

  // ------------------------------------------------------------------ exports --
  const anchors = {
    centre: () => sp([0, 0, 0]), bore: () => sp([0, 0, 0.8]), ring: () => sp([0, RC1 + 0.12, 0]), gantry: () => sp([0.62, 0.98, 0.55]),
    couch: () => sp([0.27, TOP - 0.03, tableZ + 1.95]), patient: () => pp([0, 0.32, 0.1]), head: () => pp([0, 0.76, 0.08]),
    tumour: () => pp(TUMOUR), event: () => (featured.on ? sp(featured.p) : sp([0, -0.05, 0])), lor: () => (featured.on ? sp(featured.lor) : sp([0.25, 0.25, 0])),
    floor: () => sp([0, FLOOR, 0]), vision_scan: () => sp([-0.2, 1.12, 0.2]), vision_body: [VX.body - 0.15, 0.84, 0], vision_net: [VX.net - 0.3, 0.84, 0],
    vision_prog: [VX.prog - 0.55, 0.8, 0], vision_med: [VX.prog - 0.55, 0.0, 0],
  };
  const rowA = (S, k) => prog(S.scan_vision || 0, k, k + 0.15);
  const notRow = S => 1 - prog(S.scan_vision || 0, 0, 0.2);
  return Object.assign(set, {
    params: { scan_a: 1, scan_bed: 0, scan_pass: 0, scan_cut: 0, scan_events: 0, scan_lines: 0, scan_image: 0, scan_vision: 0, scan_floor: 1 },
    floorY: FLOOR,
    update,
    anchors,
    labels: [
      { text: ['PET/CT scanner', ''], at: 'gantry', cls: 'cyn', alpha: S => notRow(S) * (1 - prog(S.scan_cut || 0, 0, 0.4)) * (1 - prog(S.scan_image || 0, 0, 0.3)) },
      { text: ['Detector ring', ''], at: 'ring', cls: 'cyn', alpha: S => notRow(S) * prog(S.scan_cut || 0, 0.6, 1) * (1 - prog(S.scan_image || 0, 0, 0.3)) },
      { text: ['Two gamma photons', ', 511 keV'], at: 'event', cls: 'amb', alpha: S => notRow(S) * prog(S.scan_events || 0, 0.005, 0.04) * (1 - prog(S.scan_lines || 0, 0.3, 0.6)) * (1 - prog(S.scan_image || 0, 0, 0.3)) },
      { text: ['Line of response', ''], at: 'lor', cls: 'amb', alpha: S => notRow(S) * prog(S.scan_events || 0, 0.01, 0.05) * (1 - prog(S.scan_lines || 0, 0.4, 0.7)) * (1 - prog(S.scan_image || 0, 0, 0.3)) },
      { text: ['FDG', ' in the patient'], at: 'patient', cls: 'amb', alpha: S => notRow(S) * prog(S.scan_image || 0, 0.5, 0.9) },
      { text: ['PET scan', ''], at: 'vision_scan', alpha: S => rowA(S, 0.3) },
      { text: ['One body', ''], at: 'vision_body', alpha: S => rowA(S, 0.4) },
      { text: ['One network', ''], at: 'vision_net', alpha: S => rowA(S, 0.6) },
      { text: ['Prognosis', ''], at: 'vision_prog', alpha: S => rowA(S, 0.74) },
      { text: ['Medication', ''], at: 'vision_med', alpha: S => rowA(S, 0.8) },
    ],
    cam: {
      default: [34, 13, 7.2, 0, -0.25, 0.95], front: [0, 4, 6.4, 0, -0.1, 0.4], ring: [28, 22, 2.4, 0, -0.02, 0], side: [90, 6, 7.6, 0, -0.25, 0.9],
      inside: [0, 7, 1.3, 0, -0.06, -0.3], vision: [0, 3, 7.7, 0, -0.02, 0], life: [20, 12.4, 2.56, 0, 0, 0.8],
    },
    controls: [
      { key: 'view', label: 'View', options: [['scanner', 'Scanner'], ['ring', 'Ring'], ['inside', 'Inside'], ['vision', 'Vision']] },
      { key: 'events', label: 'Events', options: [['off', 'Off'], ['on', 'On']] },
      { key: 'image', label: 'Image', options: [['lines', 'Lines'], ['image', 'Image']] },
    ],
    explore(c) {
      const row = c.view === 'vision', on = c.events === 'on' && !row, im = c.image === 'image' && !row;
      return {
        scan_bed: row ? 0 : 1, scan_pass: row ? 0 : 0.4, scan_cut: c.view === 'ring' ? 1 : 0, scan_vision: row ? 1 : 0,
        scan_events: on ? 1 : 0, scan_lines: on && !im ? 1 : 0, scan_image: im ? 1 : 0,
      };
    },
    // for the engine: the latest featured event (a point in the set's frame) and whether events are showing
    api() { return { floorY: FLOOR, event: () => (featured.on ? anchors.event() : null), live }; },
  });
};
