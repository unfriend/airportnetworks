// Low-poly miniatures of the story sets, batch a: the tour (lbi), the muscle (nmd), endotype (endo), PET (pet) and
// microanatomy (micro) stories. Each entry's build(THREE) returns a THREE.Group centred on x and z, standing on y = 0
// and fitting a 1 x 1 x 1 box (the caller scales it): simple shapes merged into one mesh per material, lit, in the
// prop's own colours, for the design room's table and the shared rooms' station icons. three.js r128, no libraries.
var LOWPOLY_MODELS = LOWPOLY_MODELS || {};
(function () {
  'use strict';
  let T = null;                       // THREE, set by each build

  // ---------------------------------------------------------------- small helpers
  const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const len3 = a => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);         // not Math.hypot: it is slow, and these run per vertex
  const dist = (a, b) => { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); };
  const norm3 = a => mul3(a, 1 / (len3(a) || 1));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t = Math.max(0, Math.min(1, t)), t * t * (3 - 2 * t));
  const unit = r => { const z = 2 * r() - 1, a = 6.2832 * r(), s = Math.sqrt(1 - z * z); return [s * Math.cos(a), z, s * Math.sin(a)]; };
  const CC = new Map();                 // parsed colour strings: parsing one per vertex was the slowest part of a build
  const raw = c => (c instanceof T.Color ? c : Array.isArray(c) ? new T.Color(c[0], c[1], c[2]) : CC.get(c) || (CC.set(c, new T.Color(c)), CC.get(c)));   // never changed
  const col = c => raw(c).clone();
  const mix = (a, b, t) => col(a).lerp(raw(b), Math.max(0, Math.min(1, t)));
  const ramp = (stops, v) => { for (let i = 1; i < stops.length; i++) if (v <= stops[i][0] || i === stops.length - 1) return mix(stops[i - 1][1], stops[i][1], (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); };
  // the body set's hot-iron map, as the PET scans are drawn
  const IRON = [[0, '#160303'], [0.3, '#6a0d06'], [0.5, '#c22a0a'], [0.68, '#ff7414'], [0.85, '#ffd25a'], [1, '#fff8e2']];

  // a part placed by position, turn (Euler [x, y, z] or a quaternion) and scale (number or [x, y, z])
  let SM, SV, SS, SQ, SE;
  const M4 = (p, r, s) => {
    if (!SM || SM.constructor !== T.Matrix4) { SM = new T.Matrix4(); SV = new T.Vector3(); SS = new T.Vector3(); SQ = new T.Quaternion(); SE = new T.Euler(); }
    p = p || [0, 0, 0]; r = r || [0, 0, 0]; s = s === undefined ? 1 : s;
    return SM.compose(SV.set(p[0], p[1], p[2]), r.isQuaternion ? SQ.copy(r) : SQ.setFromEuler(SE.set(r[0], r[1], r[2])), typeof s === 'number' ? SS.set(s, s, s) : SS.set(s[0], s[1], s[2]));
  };
  let SN = null;
  const at = (g, p, r, s) => {
    if (g.fast && !r && (s === undefined || s === 1)) { const P = g.P; if (p) for (let i = 0; i < P.length; i += 3) { P[i] += p[0]; P[i + 1] += p[1]; P[i + 2] += p[2]; } return g; }
    const m = M4(p, r, s);
    if (!g.fast) return g.applyMatrix4(m);
    if (!SN || SN.constructor !== T.Matrix3) SN = new T.Matrix3();
    const e = m.elements, nm = SN.getNormalMatrix(m).elements, P = g.P, N = g.N;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2], a = N[i], b = N[i + 1], c = N[i + 2];
      P[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx = nm[0] * a + nm[3] * b + nm[6] * c, ny = nm[1] * a + nm[4] * b + nm[7] * c, nz = nm[2] * a + nm[5] * b + nm[8] * c, l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      N[i] = nx / l; N[i + 1] = ny / l; N[i + 2] = nz / l;
    }
    return g;
  };

  // the common shapes are written straight into arrays ({ fast, P, N }): a three.js geometry for every node, link and
  // box made a build slow. Each triangle is wound to face along its points' normals, and empty ones are dropped.
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function mesh() {
    const P = [], N = [];
    return {
      P, N, fast: true,
      tri(a, b, c) {                             // points [x, y, z, nx, ny, nz]
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
        if (Math.abs(x) + Math.abs(y) + Math.abs(z) < 1e-12) return;
        if (x * (a[3] + b[3] + c[3]) + y * (a[4] + b[4] + c[4]) + z * (a[5] + b[5] + c[5]) < 0) { const t = b; b = c; c = t; }
        P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); N.push(a[3], a[4], a[5], b[3], b[4], b[5], c[3], c[4], c[5]);
      },
    };
  }
  function surf(nu, nv, f, m) {                  // a grid of nu x nv cells, f(u, v) -> [x, y, z, nx, ny, nz]
    m = m || mesh();
    const G = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) G.push(f(i / nu, j / nv));
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = G[j * (nu + 1) + i], b = G[j * (nu + 1) + i + 1], c = G[(j + 1) * (nu + 1) + i + 1], d = G[(j + 1) * (nu + 1) + i];
      m.tri(a, b, c); m.tri(a, c, d);
    }
    return m;
  }
  const sphF = (r, ws, hs, tl) => surf(ws, hs, (u, v) => { const ph = u * 6.2832, th = v * (tl || Math.PI), x = -Math.cos(ph) * Math.sin(th), y = Math.cos(th), z = Math.sin(ph) * Math.sin(th); return [r * x, r * y, r * z, x, y, z]; });
  function cylF(rt, rb, h, n, hs, open, t0, tl) {  // as three's CylinderGeometry: x = r sin t, z = r cos t
    t0 = t0 || 0; tl = tl || 6.2832;
    const k = (rb - rt) / h, l = Math.hypot(1, k);
    const m = surf(n, hs || 1, (u, v) => { const t = t0 + u * tl, r = lerp(rt, rb, v), si = Math.sin(t), co = Math.cos(t); return [r * si, h / 2 - v * h, r * co, si / l, k / l, co / l]; });
    if (!open) for (const [y, r, ny] of [[h / 2, rt, 1], [-h / 2, rb, -1]]) if (r > 0) for (let i = 0; i < n; i++) {
      const a = t0 + tl * i / n, c = t0 + tl * (i + 1) / n;
      m.tri([0, y, 0, 0, ny, 0], [r * Math.sin(a), y, r * Math.cos(a), 0, ny, 0], [r * Math.sin(c), y, r * Math.cos(c), 0, ny, 0]);
    }
    return m;
  }
  const torF = (R, r, rs, ts, arc) => surf(ts, rs, (u, v) => { const a = u * arc, b = v * 6.2832, cb = Math.cos(b); return [(R + r * cb) * Math.cos(a), (R + r * cb) * Math.sin(a), r * Math.sin(b), cb * Math.cos(a), cb * Math.sin(a), Math.sin(b)]; });
  function discF(r, n) {                         // in the x-y plane, facing +z
    const m = mesh();
    for (let i = 0; i < n; i++) { const a = 6.2832 * i / n, c = 6.2832 * (i + 1) / n; m.tri([0, 0, 0, 0, 0, 1], [r * Math.cos(a), r * Math.sin(a), 0, 0, 0, 1], [r * Math.cos(c), r * Math.sin(c), 0, 0, 0, 1]); }
    return m;
  }
  function boxF(w, h, d) {
    const m = mesh(), x = w / 2, y = h / 2, z = d / 2;
    for (const [n, u, v] of [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, 1]], [[0, 1, 0], [1, 0, 0], [0, 0, 1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [1, 0, 0], [0, 1, 0]]]) {
      const q = (a, b) => [n[0] * x + (u[0] * a + v[0] * b) * x, n[1] * y + (u[1] * a + v[1] * b) * y, n[2] * z + (u[2] * a + v[2] * b) * z, ...n];
      m.tri(q(-1, -1), q(1, -1), q(1, 1)); m.tri(q(-1, -1), q(1, 1), q(-1, 1));
    }
    return m;
  }
  const ICO = (() => { const t = (1 + Math.sqrt(5)) / 2, l = Math.hypot(1, t); return [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => p.map(c => c / l)); })();
  const ICOF = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
  function icoF(r) {                             // 20 flat faces, as three's IcosahedronGeometry at detail 0
    const m = mesh();
    for (let f = 0; f < 60; f += 3) {
      const [a, b, c] = [ICOF[f], ICOF[f + 1], ICOF[f + 2]].map(i => mul3(ICO[i], r)), n = norm3(add3(add3(a, b), c));
      m.tri([...a, ...n], [...b, ...n], [...c, ...n]);
    }
    return m;
  }
  function octa(rad, p, s) {                     // an octahedron (8 flat faces), scaled by s
    const k = Array.isArray(s) ? s : [s || 1, s || 1, s || 1], m = mesh();
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) {
      const n = norm3([a / k[0], b / k[1], c / k[2]]);
      m.tri([p[0] + a * rad * k[0], p[1], p[2], ...n], [p[0], p[1] + b * rad * k[1], p[2], ...n], [p[0], p[1], p[2] + c * rad * k[2], ...n]);
    }
    return m;
  }
  const box = (w, h, d, p, r) => at(boxF(w, h, d), p, r);
  const sph = (rad, ws, hs, p, s, r) => at(sphF(rad, ws, hs), p, r, s);
  const ico = (rad, p, s) => at(icoF(rad), p, null, s);
  const cyl = (rt, rb, h, n, p, r, open) => at(cylF(rt, rb, h, n, 1, open), p, r);
  const tor = (R, r, rs, ts, p, rot, arc) => at(torF(R, r, rs, ts, arc || Math.PI * 2), p, rot);
  const disc = (rad, n, p, r) => at(discF(rad, n), p, r);
  // a profile [[r, y], ...] turned round the y axis (x = r sin a, z = r cos a, as three's LatheGeometry)
  function latheF(pts, n) {
    const L = pts.length - 1;
    return surf(n, L, (u, v) => {
      const j = Math.round(v * L), a = u * 6.2832, q = pts[j], q0 = pts[Math.max(0, j - 1)], q1 = pts[Math.min(L, j + 1)];
      const dr = q1[0] - q0[0], dy = q1[1] - q0[1], l = Math.hypot(dr, dy) || 1, nr = dy / l, ny = -dr / l;
      return [q[0] * Math.sin(a), q[1], q[0] * Math.cos(a), nr * Math.sin(a), ny, nr * Math.cos(a)];
    });
  }
  const lathe = (pts, n, p, s, r) => at(latheF(pts, n), p, r, s);
  // a tube of n sides through points, along a Catmull-Rom curve, its rings carried along by parallel transport
  function tube(pts, seg, rad, n) {
    const S = [], K = pts.length - 1;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg * K, k = Math.min(K - 1, Math.floor(t)), u = t - k, p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(K, k + 2)];
      S.push([0, 1, 2].map(c => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u * u + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * u * u * u)));
    }
    const Tn = S.map((_, i) => norm3(add3(S[Math.min(seg, i + 1)], mul3(S[Math.max(0, i - 1)], -1)))), Nn = [], Bn = [];
    let nv = norm3(cross(Tn[0], Math.abs(Tn[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    for (let i = 0; i <= seg; i++) { nv = norm3(add3(nv, mul3(Tn[i], -(nv[0] * Tn[i][0] + nv[1] * Tn[i][1] + nv[2] * Tn[i][2])))); Nn.push(nv); Bn.push(cross(Tn[i], nv)); }
    return surf(n, seg, (u, v) => { const i = Math.round(v * seg), a = u * 6.2832, d = add3(mul3(Nn[i], Math.cos(a)), mul3(Bn[i], Math.sin(a))); return [...add3(S[i], mul3(d, rad)), ...d]; });
  }
  // a flat sector of a ring in the x-z plane facing up, from angle t0 over tl (x = r sin t, z = r cos t)
  const ringF = (r0, r1, n, t0, tl) => surf(n, 1, (u, v) => { const t = t0 + u * tl, r = lerp(r0, r1, v); return [r * Math.sin(t), 0, r * Math.cos(t), 0, 1, 0]; });
  // a rod from a to b (radius r1 at a, r2 at b, n sides); open by default, as the thin links are
  // (written straight along the axis, with no matrix: the links are most of the parts)
  function rod(a, b, r1, r2, n, open) {
    n = n || 4; if (r2 === undefined) r2 = r1;
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = len3(d) || 1e-6, t = [d[0] / L, d[1] / L, d[2] / L];
    const u = norm3(cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = cross(t, u), k = (r1 - r2) / L, l = Math.sqrt(1 + k * k), m = mesh(), A = [], B = [];
    for (let i = 0; i <= n; i++) {
      const th = 6.2832 * i / n, c = Math.cos(th), s = Math.sin(th), w0 = c * u[0] + s * v[0], w1 = c * u[1] + s * v[1], w2 = c * u[2] + s * v[2];
      const nx = (w0 + k * t[0]) / l, ny = (w1 + k * t[1]) / l, nz = (w2 + k * t[2]) / l;
      A.push([a[0] + r1 * w0, a[1] + r1 * w1, a[2] + r1 * w2, nx, ny, nz]); B.push([b[0] + r2 * w0, b[1] + r2 * w1, b[2] + r2 * w2, nx, ny, nz]);
    }
    for (let i = 0; i < n; i++) { m.tri(B[i], B[i + 1], A[i + 1]); m.tri(B[i], A[i + 1], A[i]); }
    if (open === false) for (const [E, p, r, sg] of [[B, b, r2, 1], [A, a, r1, -1]]) if (r > 0) {
      const nn = [sg * t[0], sg * t[1], sg * t[2]], cap = q => [q[0], q[1], q[2], nn[0], nn[1], nn[2]];
      for (let i = 0; i < n; i++) m.tri([p[0], p[1], p[2], nn[0], nn[1], nn[2]], cap(E[i]), cap(E[i + 1]));
    }
    return m;
  }
  // a flat-shaded triangle, turned to face along the hint h when given (three's ExtrudeGeometry and a ribbon's
  // computeVertexNormals were most of a cold build, so outlines are extruded here)
  const ftri = (m, a, b, c, h) => {
    let n = norm3(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]));
    if (h && n[0] * h[0] + n[1] * h[1] + n[2] * h[2] < 0) n = mul3(n, -1);
    m.tri([a[0], a[1], a[2], n[0], n[1], n[2]], [b[0], b[1], b[2], n[0], n[1], n[2]], [c[0], c[1], c[2], n[0], n[1], n[2]]);
  };
  // an outline [[x, y], ...] extruded along z from 0 to d, flat-shaded, as three's ExtrudeGeometry: o.bt, o.bs, o.k
  // round its edges with a bevel (that deep and wide, in k steps); the caps are fanned from o.c (the outline must be
  // star-shaped from it), or ring round a hole of radius o.hole about o.c, or (o.strip) join the outline's first half
  // to its second, for a band whose two edges share their x
  function extrude(pts, d, o) {
    o = o || {};
    const n = pts.length, bt = o.bt || 0, bs = o.bs || 0, k = bt ? o.k || 1 : 1, c = o.c || [0, 0], rh = o.hole || 0, m = mesh();
    let A = 0; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
    const sg = A > 0 ? 1 : -1, en = pts.map((p, i) => { const q = pts[(i + 1) % n], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [sg * (q[1] - p[1]) / l, -sg * (q[0] - p[0]) / l]; });
    const mit = pts.map((_, i) => { const a = en[(i + n - 1) % n], e = en[i], x = a[0] + e[0], y = a[1] + e[1], l = Math.hypot(x, y) || 1, cs = Math.max(0.35, (x * e[0] + y * e[1]) / l); return [x / l / cs, y / l / cs]; });
    const th = pts.map(p => Math.atan2(p[1] - c[1], p[0] - c[0]));
    const ring = [];                           // [z, offset] from the front cap round the side to the back cap
    for (let t = 0; t <= k; t++) ring.push([d + bt * Math.cos(t / k * Math.PI / 2), bs * Math.sin(t / k * Math.PI / 2)]);
    for (let t = k; t >= 0; t--) ring.push([-bt * Math.cos(t / k * Math.PI / 2), bs * Math.sin(t / k * Math.PI / 2)]);
    const out = ([z, s]) => pts.map((p, i) => [p[0] + s * mit[i][0], p[1] + s * mit[i][1], z]);
    const hol = ([z, s]) => th.map(a => [c[0] + (rh - s) * Math.cos(a), c[1] + (rh - s) * Math.sin(a), z]);
    for (let j = 0; j + 1 < ring.length; j++) {
      const R0 = out(ring[j]), R1 = out(ring[j + 1]), H0 = rh && hol(ring[j]), H1 = rh && hol(ring[j + 1]);
      for (let i = 0; i < n; i++) {
        const i1 = (i + 1) % n, h = [en[i][0], en[i][1], 0];
        ftri(m, R0[i], R0[i1], R1[i1], h); ftri(m, R0[i], R1[i1], R1[i], h);
        if (rh) { const a = (th[i] + th[i1]) / 2, hh = [-Math.cos(a), -Math.sin(a), 0]; ftri(m, H0[i], H0[i1], H1[i1], hh); ftri(m, H0[i], H1[i1], H1[i], hh); }
      }
    }
    for (const [z, hz] of [[d + bt, 1], [-bt, -1]]) {
      const R = out([z, 0]), H = rh && hol([z, 0]), h = [0, 0, hz];
      if (o.strip) for (let i = 0; i + 1 < n / 2; i++) { const a = R[i], b2 = R[i + 1], c2 = R[n - 2 - i], e = R[n - 1 - i]; ftri(m, a, b2, c2, h); ftri(m, a, c2, e, h); }
      else for (let i = 0; i < n; i++) {
        const i1 = (i + 1) % n;
        if (rh) { ftri(m, R[i], R[i1], H[i1], h); ftri(m, R[i], H[i1], H[i], h); } else ftri(m, [c[0], c[1], z], R[i], R[i1], h);
      }
    }
    return m;
  }
  // a band outline (points [x, s], s = -z, from band()) extruded up from y0 by h
  const slab = (pts, h, y0) => at(extrude(pts, h, { strip: true }), [0, y0, 0], [-Math.PI / 2, 0, 0]);

  // the materials: lit, with vertex colours; 'glow' and 'soft' add the vertex colour as light, as the app's props glow
  function glowing(m, k) {
    m.emissive = new T.Color(1, 1, 1); m.emissiveIntensity = k;
    m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;'); };
    return m;
  }
  const std = o => new T.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.6, metalness: 0.05 }, o));
  const MAT = {
    solid: () => std({}),
    shiny: () => std({ roughness: 0.28, metalness: 0.08 }),
    soft: () => glowing(std({ roughness: 0.5, metalness: 0 }), 0.3),
    two: () => glowing(std({ roughness: 0.55, metalness: 0, side: T.DoubleSide }), 0.3),
    glow: () => glowing(std({ color: 0x808080, roughness: 0.45, metalness: 0 }), 0.65),   // half lit, so bright colours keep their hue
    glass: () => glowing(std({ roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide }), 0.4),
    haze: () => glowing(std({ color: 0x000000, roughness: 1, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false, blending: T.AdditiveBlending }), 1),   // unlit glow
  };
  const ORDER = ['solid', 'shiny', 'soft', 'two', 'glow', 'glass', 'haze'];

  // a bag of parts, merged per material, then scaled and moved into the unit box standing on y = 0. Parts are kept by
  // reference and copied once into typed arrays at the end: pushing every vertex through growing arrays made most of a
  // build's garbage (so a part must not be changed after it is added)
  function bag() {
    const parts = {}, c = new T.Color();
    const setc = v => (v instanceof T.Color ? c.copy(v) : Array.isArray(v) ? c.setRGB(v[0], v[1], v[2]) : c.copy(CC.get(v) || (CC.set(v, new T.Color(v)), CC.get(v))));
    return {
      add(kind, g, colour) {
        let P, N, C;
        if (g.fast) { P = g.P; N = g.N; } else {
          const geo = g.index ? g.toNonIndexed() : g;
          if (!geo.attributes.normal) geo.computeVertexNormals();
          P = geo.attributes.position.array; N = geo.attributes.normal.array; g.dispose();
        }
        if (typeof colour === 'function') {        // per vertex, now, so seeded colours keep their order
          C = new Float32Array(P.length);
          for (let i = 0; i < P.length; i += 3) { setc(colour(P[i], P[i + 1], P[i + 2])); C[i] = c.r; C[i + 1] = c.g; C[i + 2] = c.b; }
        } else { setc(colour); C = [c.r, c.g, c.b]; }
        (parts[kind] || (parts[kind] = [])).push(P, N, C);
        return this;
      },
      done() {
        let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
        const merged = {};
        for (const k of ORDER) if (parts[k]) {
          const L = parts[k]; let n = 0, o = 0;
          for (let j = 0; j < L.length; j += 3) n += L[j].length;
          const P = new Float32Array(n), N = new Float32Array(n), C = new Float32Array(n);
          for (let j = 0; j < L.length; j += 3) {          // copied natively (set); a cold build spent most of its time here
            const m = L[j].length, cc = L[j + 2];
            P.set(L[j], o); N.set(L[j + 1], o);
            if (cc.length === m) C.set(cc, o); else for (let i = o; i < o + m; i += 3) { C[i] = cc[0]; C[i + 1] = cc[1]; C[i + 2] = cc[2]; }
            o += m;
          }
          for (let i = 0; i < n; i += 3) {
            const x = P[i], y = P[i + 1], z = P[i + 2];
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
          }
          merged[k] = [P, N, C];
        }
        const s = 1 / Math.max(x1 - x0, y1 - y0, z1 - z0), ox = (x0 + x1) / 2, oz = (z0 + z1) / 2;
        const sphere = new T.Sphere(new T.Vector3(0, (y1 - y0) * s / 2, 0), 0.5 * s * Math.hypot(x1 - x0, y1 - y0, z1 - z0));
        const grp = new T.Group(); let tris = 0;
        for (const k of ORDER) if (merged[k]) {
          const [P, N, C] = merged[k], n = P.length;
          for (let i = 0; i < n; i += 3) { P[i] = (P[i] - ox) * s; P[i + 1] = (P[i + 1] - y0) * s; P[i + 2] = (P[i + 2] - oz) * s; }
          const g = new T.BufferGeometry();
          g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3));
          g.boundingSphere = sphere.clone();
          const m = new T.Mesh(g, MAT[k]()); m.name = k; if (k === 'glass' || k === 'haze') m.renderOrder = k === 'glass' ? 1 : 2;
          grp.add(m); tris += n / 9;
        }
        grp.userData.tris = tris;
        return grp;
      },
    };
  }

  // a soft glow brighter towards its middle: three nested additive shells
  const glowBall = (b, c, r, outer, inner) => { for (let k = 0; k < 3; k++) b.add('haze', sph(r * [1, 0.68, 0.38][k], 8, 6, c), mix(outer, inner, k / 2)); };
  // a dark round stand with a glowing rim, for the props that float
  const plinth = (b, r, h) => { h = h || 0.04; b.add('solid', cyl(r, r * 1.04, h, 16, [0, h / 2, 0]), '#0f1b2e'); b.add('glow', cyl(r * 1.006, r * 1.006, h * 0.3, 16, [0, h * 0.8, 0], null, true), '#2397c4'); };
  // a long dark stand with glowing top edges, for the props laid out along x
  function stand(b, w, d, h) {
    h = h || 0.04; b.add('solid', box(w, h, d, [0, h / 2, 0]), '#0f1b2e');
    for (const z of [-d / 2, d / 2]) b.add('glow', box(w, 0.006, 0.006, [0, h - 0.003, z]), '#2397c4');
    for (const x of [-w / 2, w / 2]) b.add('glow', box(0.006, 0.006, d, [x, h - 0.003, 0]), '#2397c4');
  }
  // a dark wedge that holds a slide (depth 2 hz, width 2 hx, its underside at y 0) tilted up at the back by th;
  // returns a bag whose parts are tilted onto it
  function easel(b, th, hz, hx) {
    const s = Math.sin(th), c = Math.cos(th), zn = hz * c, yf = 2 * hz * s, m = mesh(), V = (x, i) => [x, [0, 0, yf][i], [zn, -zn, -zn][i]];
    const quad = (a, b2, c2, d, n) => { m.tri([...a, ...n], [...b2, ...n], [...c2, ...n]); m.tri([...a, ...n], [...c2, ...n], [...d, ...n]); };
    const sl = norm3([0, 2 * zn, yf]);
    quad(V(-hx, 0), V(hx, 0), V(hx, 1), V(-hx, 1), [0, -1, 0]);
    quad(V(-hx, 1), V(hx, 1), V(hx, 2), V(-hx, 2), [0, 0, -1]);
    quad(V(-hx, 0), V(hx, 0), V(hx, 2), V(-hx, 2), sl);
    for (const x of [-hx, hx]) m.tri([...V(x, 0), Math.sign(x), 0, 0], [...V(x, 1), Math.sign(x), 0, 0], [...V(x, 2), Math.sign(x), 0, 0]);
    b.add('solid', m, '#0f1b2e');
    b.add('glow', box(2 * hx, 0.006, 0.006, [0, 0.003, zn]), '#2397c4');
    return { add: (k, g, col2) => b.add(k, at(g, [0, hz * s, 0], [th, 0, 0]), col2) };
  }
  // a standing figure in the PET pose (arms raised, hands crossed over the head), feet at y 0, about 1.06 tall
  function figure(b, kind, colour, n) {
    for (const s of [-1, 1]) {
      b.add(kind, rod([0.055 * s, 0, 0], [0.07 * s, 0.25, 0], 0.028, 0.042, n, false), colour);
      b.add(kind, rod([0.07 * s, 0.25, 0], [0.075 * s, 0.46, 0], 0.042, 0.06, n, false), colour);
      b.add(kind, rod([0.125 * s, 0.76, 0], [0.165 * s, 0.94, 0.01], 0.032, 0.026, n, false), colour);
      b.add(kind, rod([0.165 * s, 0.94, 0.01], [-0.03 * s, 1.035, 0.02 * s], 0.026, 0.02, n, false), colour);
    }
    b.add(kind, lathe([[0, 0.43], [0.1, 0.44], [0.125, 0.5], [0.118, 0.58], [0.1, 0.64], [0.115, 0.72], [0.13, 0.765], [0.06, 0.8], [0, 0.81]], n + 2, null, [1, 1, 0.6]), colour);
    b.add(kind, rod([0, 0.8, 0], [0, 0.85, 0], 0.028, 0.028, n), colour);
    b.add(kind, sph(0.058, n + 2, 6, [0, 0.9, 0.005], [1, 1.12, 1.02]), colour);
  }
  // a gently curved strip in the x-z plane between offsets w0 and w1 (z) from its centre line, ends rounded
  function band(L, zc, w0, w1, N) {
    const tp = x => Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / L, 6))), pts = [];
    for (let i = 0; i <= N; i++) { const x = -L + 2 * L * i / N; pts.push([x, -(zc(x) + w1(x) * tp(x))]); }
    for (let i = N; i >= 0; i--) { const x = -L + 2 * L * i / N; pts.push([x, -(zc(x) + w0(x) * tp(x))]); }
    return pts;
  }

  const add = (key, name, shows, make) => {
    const [story, set] = key.split('.');
    LOWPOLY_MODELS[key] = { story, set, name, shows, tris: 0, build(THREE) { T = THREE; const b = bag(); make(b); const g = b.done(); g.name = key; g.userData.key = key; return g; } };
  };

  // ================================================================ the tour (lbi)

  add('lbi.int', 'Interactome', 'A cloud of human protein interactions with no edge to it: a white-hot centre, knots of proteins out to the rim, the curated modules in their colours and TP53 the biggest hub.', b => {
    const r = rng(7), C = [0, 0.36, 0], P = [], cols = [];
    // the set's module colours (p53's gold is TP53's own, below)
    const MODS = ['#ff6b38', '#4d94ff', '#40e673', '#cc61ff', '#ff61ad'];
    plinth(b, 0.2);
    const node = (p, c, s, big) => { P.push(p); cols.push(col(c)); b.add('glow', big ? ico(s, add3(C, p)) : octa(s, add3(C, p)), c); return P.length - 1; };
    const link = (i, j, k, w) => b.add('glow', rod(add3(C, P[i]), add3(C, P[j]), w || 0.005, w || 0.005, 3), mix(cols[i], cols[j], 0.5).multiplyScalar(k || 0.7));
    const near = (p, i0, n) => { let best = i0; for (let j = i0 + 1; j < n; j++) if (dist(p, P[j]) < dist(p, P[best])) best = j; return best; };
    const shade = d => d < 0.5 ? mix('#f4f8ff', '#8fb0ff', d * 2) : mix('#8fb0ff', '#8a74f0', (d - 0.5) * 2);   // white-hot to violet, as the set
    for (let i = 0; i < 30; i++) { const p = mul3(unit(r), 0.015 + 0.085 * Math.cbrt(r())); node(p, i % 4 ? '#f4f8ff' : '#c9d8ff', 0.021); if (i % 4 === 1) link(i, near(p, 0, i), 1); }   // the dense white-hot centre
    // no shell round it: seven knots of proteins stand out from the centre on faint filaments, so its outline is lumpy
    for (let f = 0; f < 7; f++) {
      const y = 0.8 - (f + 0.5) / 7 * 1.6, a = f * 2.39996 + 0.4, s = Math.sqrt(1 - y * y), dir = [s * Math.cos(a), y * 0.85, s * Math.sin(a)];
      const tip = mul3(dir, 0.25 + 0.06 * r()), mid = add3(mul3(dir, 0.15), mul3(unit(r), 0.025));
      const m = node(mid, shade(0.4), 0.017), t0 = P.length;
      link(near(mid, 0, 30), m, 0.5);
      for (let k = 0; k < 6; k++) { const i = node(add3(tip, mul3(unit(r), 0.01 + 0.035 * r())), shade(0.72 + 0.28 * r()), 0.019); if (k < 3) link(k ? near(P[i], t0, i) : m, i, 0.5); }
    }
    // the curated modules half way out, three proteins each in their colour
    for (let q = 0; q < 5; q++) {
      const c = mul3(unit(r), 0.15), t0 = P.length;
      for (let k = 0; k < 3; k++) { const i = node(add3(c, mul3(unit(r), 0.028)), MODS[q], 0.023); link(k ? near(P[i], t0, i) : near(P[i], 0, 30), i, 1.1, 0.0055); }
    }
    // TP53, the biggest curated hub, in p53's gold beside the centre, with its spokes
    const p53 = [0.06, 0.05, 0.07], h = node(p53, '#ffd62e', 0.042, true), by = P.map((q, i) => [dist(p53, q), i]).filter(([, i]) => i !== h).sort((u, v) => u[0] - v[0]);
    for (let k = 0; k < 4; k++) link(h, by[k * 3 + 2][1], 1, 0.006);
  });

  add('lbi.mac', 'Classic computer', 'A beige all-in-one computer with its keyboard and mouse, before it is taken apart.', b => {
    const BE = '#cdc4ad', BE2 = '#b3aa94', BE3 = '#9a927e', KEY = '#bab19a', DARK = '#1a1b1d', INNER = '#3c3a36';
    b.add('solid', box(0.42, 0.52, 0.46, [0, 0.3, -0.06]), BE);
    b.add('solid', box(0.43, 0.04, 0.44, [0, 0.02, -0.06]), BE3);
    b.add('solid', box(0.33, 0.28, 0.008, [0, 0.405, 0.172]), BE2);              // the sloping surround, read as a recess
    b.add('solid', box(0.28, 0.225, 0.008, [0, 0.405, 0.176]), INNER);
    b.add('glow', box(0.25, 0.19, 0.006, [0, 0.405, 0.18]), '#8e9aa5');           // the light grey desktop
    b.add('glow', box(0.25, 0.016, 0.004, [0, 0.49, 0.183]), '#e8edf1');          // menu bar
    b.add('glow', box(0.13, 0.09, 0.004, [-0.03, 0.395, 0.184]), '#e2e8ec');      // the "Network" window
    b.add('solid', box(0.13, 0.014, 0.005, [-0.03, 0.44, 0.185]), '#4c5260');
    for (const p of [[-0.07, 0.38], [-0.03, 0.41], [0.0, 0.37], [-0.045, 0.36]]) b.add('solid', box(0.012, 0.012, 0.005, [p[0], p[1], 0.186]), '#2a2d33');
    b.add('solid', box(0.022, 0.018, 0.005, [0.095, 0.46, 0.184]), '#6d7480');    // disk and bin icons
    b.add('solid', box(0.016, 0.022, 0.005, [0.095, 0.345, 0.184]), '#6d7480');
    b.add('solid', box(0.09, 0.009, 0.006, [0.07, 0.19, 0.172]), DARK);           // floppy slot
    b.add('solid', box(0.42, 0.004, 0.004, [0, 0.13, 0.171]), BE3);
    b.add('solid', box(0.2, 0.006, 0.05, [0, 0.561, -0.2]), INNER);              // carrying handle
    b.add('solid', box(0.3, 0.06, 0.006, [0, 0.12, -0.291]), INNER);             // the port panel and vents at the back
    for (let k = 0; k < 4; k++) b.add('solid', box(0.26, 0.008, 0.006, [0, 0.4 + 0.03 * k, -0.291]), BE3);
    b.add('solid', box(0.44, 0.022, 0.17, [0, 0.011, 0.37], [0.05, 0, 0]), BE);  // keyboard
    for (let k = 0; k < 4; k++) for (let c = 0; c < 10; c++) b.add('solid', box(0.032, 0.012, 0.028, [-0.171 + c * 0.038, 0.027 - 0.0017 * k, 0.306 + k * 0.034]), KEY);
    b.add('solid', box(0.2, 0.012, 0.028, [0, 0.02, 0.442]), KEY);
    for (const x of [-0.17, -0.132, 0.132, 0.17]) b.add('solid', box(0.032, 0.012, 0.028, [x, 0.02, 0.442]), BE3);
    b.add('solid', sph(0.04, 8, 5, [0.31, 0.014, 0.38], [0.75, 0.35, 1.2]), BE);  // mouse
    b.add('solid', box(0.04, 0.006, 0.02, [0.31, 0.024, 0.345]), BE3);
    b.add('solid', tube([[0.31, 0.01, 0.33], [0.29, 0.01, 0.26], [0.24, 0.02, 0.2], [0.21, 0.08, 0.05]], 8, 0.004, 3), BE3);
  });

  add('lbi.web', 'Internet map', 'The internet as trees of links growing out of white-hot hubs into yellow trunks and red twigs.', b => {
    // thick, bright links and white-hot hubs over a faint glowing core, so it reads at 12 cm (thin and dark before)
    const r = rng(5), CY = 0.46, COL = ['#fff0a0', '#ffb040', '#ff5a2a'], RAD = [0.015, 0.011, 0.0078];
    plinth(b, 0.22);
    const flat = d => norm3([d[0], d[1] * 0.7, d[2]]);
    function grow(p, d, len, depth) {
      const q = add3(p, mul3(d, len));
      b.add('glow', rod(p, q, RAD[depth], RAD[depth] * 0.8, 3), COL[depth]);
      if (depth < 2) for (let k = 0; k < 2; k++) grow(q, flat(add3(d, mul3(unit(r), 0.75))), len * 0.62, depth + 1);
    }
    const hubs = [[-0.15, CY + 0.03, 0.06, 6, 0, 0.19], [0.17, CY - 0.03, -0.06, 6, 0, 0.18], [-0.02, CY + 0.12, -0.28, 4, 1, 0.14],
      [0.3, CY + 0.06, 0.2, 4, 1, 0.13], [-0.33, CY - 0.07, -0.17, 4, 1, 0.13], [0.04, CY - 0.1, 0.31, 4, 1, 0.14]];
    for (const [x, y, z, n, d0, len] of hubs) {
      const a0 = r() * 6.28;
      for (let k = 0; k < n; k++) { const a = a0 + 6.2832 * k / n; grow([x, y, z], flat([Math.cos(a), (r() - 0.5) * 0.8, Math.sin(a)]), len, d0); }
      b.add('glow', ico(d0 ? 0.03 : 0.046, [x, y, z]), '#ffffff');
      if (!d0) b.add('haze', sph(0.09, 6, 4, [x, y, z]), '#ffd27a');            // the white-hot glow of a big hub
    }
    b.add('haze', sph(0.24, 8, 6, [0.01, CY, 0], [1.2, 0.5, 0.9]), '#d89040');      // a faint glowing core
    for (const [i, j] of [[0, 1], [0, 4], [1, 3], [2, 5]]) b.add('soft', rod(hubs[i], hubs[j], 0.005, 0.005, 3), '#ff9a50');
  });

  add('lbi.dna', 'DNA double helix', 'A double helix with its coloured base pairs, beside a chromosome it coils up into.', b => {
    const BASE = { A: '#3ee08f', T: '#ff5a4b', G: '#ffb43b', C: '#4f9dff' }, PAIRS = ['AT', 'GC', 'TA', 'CG', 'AT', 'GC', 'CG', 'TA'];
    const X0 = -0.07, Y0 = 0.09, H = 0.86, R = 0.1, TURNS = 2.1, PH = [0, 2.3];
    const at3 = (s, u) => { const a = 6.2832 * TURNS * u + PH[s]; return [X0 + R * Math.cos(a), Y0 + H * u, R * Math.sin(a)]; };
    plinth(b, 0.28);
    for (const s of [0, 1]) b.add('soft', tube(Array.from({ length: 25 }, (_, k) => at3(s, k / 24)), 30, 0.016, 4), ['#6f93cf', '#9180c8'][s]);
    for (let j = 0; j < 16; j++) {
      const u = (j + 0.5) / 16, a = at3(0, u), c = at3(1, u), m = mul3(add3(a, c), 0.5), pr = PAIRS[j % 8];
      b.add('soft', rod(a, m, 0.011, 0.011, 4), BASE[pr[0]]); b.add('soft', rod(m, c, 0.011, 0.011, 4), BASE[pr[1]]);
    }
    const CC = [0.17, 0.22, 0.06];                                                // an X-shaped chromosome, banded
    for (const [dx, dy] of [[-0.045, 0.13], [0.045, 0.13], [-0.055, -0.13], [0.055, -0.13]]) {
      const g = at(cylF(0.026, 0.026, Math.hypot(dx, dy), 6, 3, false), [CC[0] + dx / 2, CC[1] + dy / 2, CC[2]], [0, 0, -Math.atan2(dx, dy)]);
      b.add('soft', g, (x, y) => (Math.floor(Math.abs(y - CC[1]) / 0.03) % 2 ? '#b9a6ff' : '#5aa0ff'));
    }
  });

  add('lbi.atp', 'ATP synthase', 'The molecular machine in its membrane: the turning ring, the central stalk and the head that makes ATP.', b => {
    b.add('solid', at(cylF(0.42, 0.42, 0.1, 20, 3, false), [0, 0.05, 0]), (x, y) => (Math.abs(y - 0.05) < 0.03 ? '#8a6640' : '#d4b27c'));   // the lipid bilayer: heads outside, tails inside
    b.add('soft', cyl(0.1, 0.1, 0.17, 10, [0, 0.085, 0]), '#ec8396');             // c-ring
    b.add('soft', sph(0.07, 6, 4, [0.17, 0.11, 0.03], [1, 1.3, 1]), '#7e4a3c');   // subunit a
    b.add('soft', cyl(0.035, 0.035, 0.27, 6, [0, 0.3, 0]), '#5adcc7');            // gamma, the central stalk
    b.add('soft', sph(0.05, 6, 4, [0, 0.19, 0]), '#3ebfaf');                      // delta and epsilon
    for (let k = 0; k < 6; k++) {                                                 // alpha3 beta3, alternating
      const a = k * Math.PI / 3;
      b.add('soft', sph(0.088, 7, 5, [0.105 * Math.cos(a), 0.5, 0.105 * Math.sin(a)], [1, 1.35, 1]), k % 2 ? '#3184dc' : '#1db0a2');
    }
    b.add('soft', sph(0.07, 7, 5, [0.03, 0.665, 0.01], [1.1, 0.8, 1.1]), '#9283d0');          // OSCP
    b.add('soft', tube([[0.18, 0.14, 0.04], [0.245, 0.3, 0.05], [0.235, 0.48, 0.04], [0.12, 0.645, 0.02]], 12, 0.028, 5), '#a33d4b');   // peripheral stalk
  });

  add('lbi.crowd', 'Crowd of patients', 'A crowd of people, one of them lit red under a beam of light: one patient among many rare diseases.', b => {
    const r = rng(9), F = [0, 0, 0.86], ROWS = [4, 5, 6, 5];
    b.add('solid', cyl(0.4, 0.41, 0.02, 16, [0, 0.01, 0.06]), '#0b1424');
    const person = (p, red) => {
      const c = red ? '#ff5a4b' : mix('#5f6b7c', '#99a5b6', r()), k = red ? 'glow' : 'solid';
      b.add(k, lathe([[0, 0], [0.042, 0], [0.033, 0.08], [0.012, 0.104]], 5, [p[0], 0.02, p[2]]), c);
      b.add(k, sph(0.022, 5, 3, [p[0], 0.149, p[2]]), c);
    };
    ROWS.forEach((n, k) => {
      const R = 0.6 + 0.13 * k;
      for (let j = 0; j < n; j++) {
        const a = (j - (n - 1) / 2) * 0.17 + (r() - 0.5) * 0.04, p = [F[0] + R * Math.sin(a), 0, F[2] - R * Math.cos(a)], red = k === 0 && j === 1;
        person(p, red);
        if (red) {
          b.add('glow', disc(0.075, 12, [p[0], 0.022, p[2]], [-Math.PI / 2, 0, 0]), '#b02a20');   // a red pool round their feet
          b.add('haze', cyl(0.022, 0.07, 0.6, 10, [p[0], 0.32, p[2]], null, true), '#ffd9b0');   // the beam of light
        }
      }
    });
  });

  add('lbi.sankey', 'Sankey diagram', 'Clinical categories on the left flowing as coloured ribbons into molecular clusters on the right.', b => {
    const CL = ['#4bb8d6', '#f39a3c', '#e3534c', '#b07fd9', '#43b6c6', '#a2544f', '#8d8d8d', '#e2c64a', '#e0535b'];
    const MO = ['#8a8f98', '#9b6bd6', '#e0453a', '#3fae5a', '#2f9e44', '#8c3b2e', '#6d7784', '#c84fd0', '#d9c63a', '#2d8fd6', '#7d6b5d', '#a855d8', '#c73fa0', '#1f7ac2', '#8a4b2a', '#5aa86c', '#9aa4ad', '#d6303a', '#c0c4c9'];
    const M = [   // genes from clinical category (row) to molecular cluster (column), as the set has them (illustrative)
      [1, 8, 7, 0, 8, 4, 0, 0, 0, 0, 0, 0, 0, 2, 9, 0, 0, 1, 0], [0, 6, 0, 1, 2, 0, 1, 1, 1, 1, 5, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 2, 0, 1, 3, 0, 1, 2, 0, 1, 5, 6, 3, 3, 0, 0, 0, 0, 0], [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 2, 10, 1, 0, 7, 1, 6, 0, 1, 1, 3, 0, 1, 0, 0], [0, 1, 0, 0, 4, 1, 0, 0, 0, 0, 1, 3, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 3, 0, 0, 1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0], [0, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 22, 1]];
    const rowS = M.map(r => r.reduce((s, v) => s + v, 0)), colS = MO.map((_, j) => M.reduce((s, r) => s + r[j], 0)), TOP = 0.92, HH = 0.84;
    const uL = (HH - 8 * 0.014) / 173, uR = (HH - 18 * 0.008) / 173;
    const topL = [], topR = [];
    let y = TOP; rowS.forEach((n, i) => { topL[i] = y; b.add('soft', box(0.08, n * uL, 0.14, [-0.42, y - n * uL / 2, 0]), CL[i]); y -= n * uL + 0.014; });
    y = TOP; colS.forEach((n, j) => { topR[j] = y; b.add('soft', box(0.08, n * uR, 0.14, [0.42, y - n * uR / 2, 0]), MO[j]); y -= n * uR + 0.008; });
    b.add('solid', box(1.0, 0.02, 0.3, [0, 0.01, 0]), '#0f1b2e');
    b.add('glow', box(1.0, 0.004, 0.004, [0, 0.019, 0.15]), '#2397c4');
    const offL = rowS.map(() => 0), offR = colS.map(() => 0);
    for (let j = 0; j < 19; j++) for (let i = 0; i < 9; i++) if (M[i][j]) {     // right ends stacked by category
      M[i][j] = [M[i][j], offR[j]]; offR[j] += M[i][j][0] * uR;
    }
    for (let i = 0; i < 9; i++) for (let j = 0; j < 19; j++) if (M[i][j]) {
      const [m, oR] = M[i][j], yl = topL[i] - offL[i] - m * uL / 2, yr = topR[j] - oR - m * uR / 2, z0 = (4 - i) * 0.024, SEG = 6;
      offL[i] += m * uL;
      const pt = t => { const s = smooth(t), e = t < 0.35 ? smooth(t / 0.35) : t > 0.65 ? smooth((1 - t) / 0.35) : 1, h = lerp(m * uL, m * uR, s) / 2, yc = lerp(yl, yr, s);
        return [[-0.38 + 0.76 * t, yc + h, z0 * e], [-0.38 + 0.76 * t, yc - h, z0 * e]]; };
      const g = mesh();
      for (let k = 0; k < SEG; k++) { const [a, c] = pt(k / SEG), [d, e] = pt((k + 1) / SEG); ftri(g, a, c, d); ftri(g, d, c, e); }
      b.add('two', g, CL[i]);
    }
  });

  add('lbi.scale', 'Tower of scales', 'A glass tower of eight glowing floors, from DNA at the bottom to the whole body at the top.', b => {
    plinth(b, 0.31);
    b.add('glass', cyl(0.29, 0.29, 0.92, 14, [0, 0.5, 0], null, true), '#2a8fb0');
    b.add('glow', cyl(0.292, 0.292, 0.008, 14, [0, 0.96, 0], null, true), '#46d9ff');
    // the emblems 1.5 times their first size (1.25 times upwards, so each stays under the floor above)
    const Y = k => 0.1 + k * 0.112, G = 'soft', Z = 1.5, ZY = 1.25, E = (k, d) => add3([0, Y(k) + 0.004, 0], [d[0] * Z, d[1] * ZY, d[2] * Z]);
    for (let k = 0; k < 8; k++) {
      b.add('haze', disc(0.25, 12, [0, Y(k), 0], [-Math.PI / 2, 0, 0]), '#0f5f78');          // a holographic floor
      b.add('glow', cyl(0.252, 0.252, 0.01, 12, [0, Y(k), 0], null, true), '#46d9ff');
    }
    // a small lit emblem on each floor
    b.add(G, rod(E(0, [-0.04, 0.005, 0]), E(0, [0.04, 0.09, 0]), 0.011 * Z, 0.011 * Z, 4), '#3ee08f');                  // DNA bases
    b.add(G, rod(E(0, [0.04, 0.005, 0]), E(0, [-0.04, 0.09, 0]), 0.011 * Z, 0.011 * Z, 4), '#ff5a4b');
    for (const y of [0.025, 0.07]) b.add(G, rod(E(0, [-0.03, y, 0]), E(0, [0.03, y, 0]), 0.008 * Z, 0.008 * Z, 4), y < 0.05 ? '#ffb43b' : '#4f9dff');
    b.add(G, ico(0.045 * Z, E(1, [0, 0.05, 0]), [1, 1.15 * ZY / Z, 1]), '#3a7bd5');                                       // a protein
    b.add(G, rod(E(1, [0.03, 0.07, 0]), E(1, [0.07, 0.095, 0.01]), 0.008 * Z, 0.005 * Z, 4), '#ffd23a');
    b.add(G, cyl(0.032 * Z, 0.032 * Z, 0.025 * ZY, 6, E(2, [0, 0.014, 0])), '#ec8396');                                     // a complex
    b.add(G, rod(E(2, [0, 0.025, 0]), E(2, [0, 0.05, 0]), 0.009 * Z, 0.009 * Z, 4), '#5adcc7');
    b.add(G, sph(0.034 * Z, 6, 4, E(2, [0, 0.068, 0]), [1, ZY / Z, 1]), '#1db0a2');
    b.add(G, sph(0.04 * Z, 6, 4, E(3, [0, 0.04, 0]), [1.7, 0.8 * ZY / Z, 0.8]), '#ffa36b');                                 // a mitochondrion
    b.add('haze', sph(0.052 * Z, 6, 4, E(4, [0, 0.052, 0]), [1, ZY / Z, 1]), '#7fe3ff');                                    // a cell
    b.add(G, ico(0.022 * Z, E(4, [0, 0.052, 0])), '#b98bff');
    b.add(G, cyl(0.052 * Z, 0.052 * Z, 0.03 * ZY, 6, E(5, [0, 0.016, 0])), '#f19aa7');                                      // tissue
    for (const s of [-1, 1]) b.add(G, sph(0.042 * Z, 6, 4, E(6, [0.022 * s, 0.045, 0]), [0.8, 0.85 * ZY / Z, 1.15]), '#f2a7b5');   // a brain
    b.add(G, cyl(0.015 * Z, 0.022 * Z, 0.065 * ZY, 6, E(7, [0, 0.035, 0])), '#e2eaf6');                                      // the body
    b.add(G, ico(0.017 * Z, E(7, [0, 0.085, 0])), '#e2eaf6');
  });

  add('lbi.body', 'PET body network', 'A whole-body PET scan in glowing hot-iron colours, with the network of its organs wound round it.', b => {
    const HOT = [[[0, 0.9, 0], 0.07, 0.55], [[0.03, 0.69, 0.04], 0.06, 0.35], [[-0.06, 0.6, 0.03], 0.07, 0.15], [[0.06, 0.55, -0.03], 0.05, 0.25], [[-0.06, 0.55, -0.03], 0.05, 0.25], [[0, 0.47, 0.04], 0.05, 0.4]];
    const heat = (x, y, z) => ramp(IRON, 0.31 + HOT.reduce((s, [c, w, a]) => s + a * Math.exp(-((x - c[0]) ** 2 + (y - 0.04 - c[1]) ** 2 + (z - c[2]) ** 2) / (2 * w * w)), 0));
    plinth(b, 0.24);
    const F = [0, 0.04, 0];
    const fb = { add: (k, g, c) => b.add(k, at(g, F), c) };
    figure(fb, 'glow', heat, 6);
    b.add('glow', sph(0.032, 6, 4, add3(F, [0.035, 0.69, 0.06])), '#ff9a2a');     // heart
    b.add('glow', sph(0.028, 6, 4, add3(F, [0, 0.47, 0.055])), '#ffe680');        // bladder
    const N = [[0.3, 0.5], [1.4, 0.62], [2.4, 0.46], [3.3, 0.7], [4.3, 0.54], [5.3, 0.78], [0.8, 0.82], [2.9, 0.38]].map(([a, y]) => add3(F, [0.21 * Math.sin(a), y, 0.17 * Math.cos(a)]));
    for (const p of N) b.add('glow', ico(0.018, p), '#f6f8ff');
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [0, 4], [7, 2]]) {
      const m = mul3(add3(N[i], N[j]), 0.5), out = norm3([m[0], 0, m[2]]);           // bands bow outwards round the body
      b.add('glow', tube([N[i], add3(m, add3(mul3(out, 0.07), [0, 0.03, 0])), N[j]], 6, 0.0045, 3), '#e9eef8');
    }
  });

  add('lbi.tissue', 'Tissue section', 'A stained section of stomach wall on a glass slide, its layers in purple and pink, with a cell nucleus in every dot.', b => {
    const r = rng(4), L = 0.46, zc = x => 0.05 * Math.sin(x * 2.4) + 0.01, Y0 = 0.02, tb = easel(b, 0.5, 0.19, 0.44);
    tb.add('glass', box(1.0, 0.02, 0.38, [0, 0.01, 0]), '#cfe8f0');
    const lay = (w0, w1, h, c) => tb.add('solid', slab(band(L, zc, () => w0, x => w1 + (w1 > 0.12 ? 0.008 * Math.sin(x * 70) : 0), 18), h, Y0), c);
    lay(-0.13, -0.075, 0.04, '#cf4f82');       // outer muscle, lengthwise
    lay(-0.075, -0.02, 0.045, '#e2729d');      // inner muscle, circular
    lay(-0.02, 0.07, 0.05, '#e9a2c3');         // submucosa
    lay(0.07, 0.13, 0.06, '#9b66c2');          // mucosa
    const tp = x => Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / L, 6)));
    for (let i = 0; i < 24; i++) { const x = (r() * 2 - 1) * 0.4, w = (0.08 + 0.042 * r()) * tp(x); tb.add('solid', octa(0.012, [x, Y0 + 0.061, zc(x) + w], [1, 0.4, 1]), '#4b2a75'); }
    for (let i = 0; i < 5; i++) { const x = (r() * 2 - 1) * 0.36, w = (0.005 + 0.05 * r()) * tp(x); tb.add('solid', octa(0.012, [x, Y0 + 0.051, zc(x) + w], [1, 0.45, 1]), '#b8283c'); }
    tb.add('solid', sph(0.034, 6, 4, [-0.12, Y0 + 0.058, zc(-0.12) + 0.085], [1, 0.35, 1]), '#3d2266');   // a lymphoid aggregate
  });

  // ================================================================ the muscle story (nmd)

  add('nmd.tower', 'Multiplex tower', 'Seventy-one layers of gene links stacked into a tower, coloured by kind and threaded through by each gene.', b => {
    const r = rng(2), CAT = [['#46d9ff', 6], ['#3ee08f', 6], ['#a77bff', 1], ['#ff5a4b', 1], ['#ffb43b', 1], ['#ff5ad9', 2]];
    plinth(b, 0.44);
    let y = 0.08, ys = [];
    CAT.forEach(([c, n], k) => {
      if (k) y += 0.035;
      for (let i = 0; i < n; i++, y += 0.045) {
        ys.push(y);
        b.add('glass', disc(0.4, 16, [0, y, 0], [-Math.PI / 2, 0, 0]), c);
        b.add('glow', cyl(0.4, 0.4, 0.006, 16, [0, y, 0], null, true), c);
      }
    });
    const y0 = ys[0], y1 = ys[ys.length - 1];
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 0.08 + 0.26 * Math.sqrt(r()); b.add('soft', rod([d * Math.cos(a), y0, d * Math.sin(a)], [d * Math.cos(a), y1, d * Math.sin(a)], 0.004, 0.004, 4), '#bfe9ff'); }
    b.add('glow', rod([0.02, y0, -0.01], [0.02, y1, -0.01], 0.008, 0.008, 4), '#ffd77a');   // the disease module's thread
  });

  add('nmd.motor', 'Motor unit', 'The spinal cord, a motor neuron and its axon, and the striated muscle fibres it drives, with the heart above.', b => {
    stand(b, 1.0, 0.34);
    b.add('glass', cyl(0.12, 0.12, 0.11, 12, [-0.36, 0.3, 0], [Math.PI / 2, 0, 0]), '#dfe8f2');      // the spinal cord, cut face to the front
    for (const s of [-1, 1]) b.add('solid', box(0.13, 0.03, 0.008, [-0.36, 0.3, 0.057], [0, 0, 0.6 * s]), '#8d86a0');   // grey matter butterfly
    b.add('glow', sph(0.026, 6, 4, [-0.31, 0.27, 0.062]), '#ffe27a');                                   // motor neuron
    for (const d of [[-0.06, 0.05], [0.03, 0.06], [-0.05, -0.04], [0.0, -0.06]]) b.add('glow', rod([-0.31, 0.27, 0.062], [-0.31 + d[0], 0.27 + d[1], 0.062], 0.005, 0.0025, 3), '#ffe27a');
    const AX = [[-0.31, 0.27, 0.062], [-0.24, 0.22, 0.065], [-0.17, 0.12, 0.07], [-0.03, 0.09, 0.08], [0.07, 0.14, 0.08], [0.1, 0.21, 0.08]];
    b.add('glow', tube(AX, 16, 0.007, 3), '#fff1b0');
    b.add('glass', tube(AX.slice(1), 14, 0.02, 5), '#9fe4ff');                                          // myelin sheath
    b.add('glass', sph(0.036, 6, 4, [-0.42, 0.13, 0.04]), '#cfe0f0');                                    // dorsal root ganglion
    b.add('glow', tube([[-0.42, 0.13, 0.04], [-0.34, 0.14, 0.065], [-0.24, 0.17, 0.07]], 6, 0.005, 3), '#7fe3ff');
    const HEX = [[0, 0], [0.06, 0], [-0.06, 0], [0.03, 0.052], [-0.03, 0.052], [0.03, -0.052], [-0.03, -0.052]];
    HEX.forEach(([dy, dz], k) => b.add('solid', cyl(0.036, 0.036, 0.44, 8, [0.26, 0.26 + dy, dz], [0, 0, Math.PI / 2]), k % 2 ? '#e8697c' : '#f07c8a'));
    for (const e of [[0.15, 0.3, 0.083], [0.24, 0.235, 0.088], [0.33, 0.3, 0.083]]) {                  // neuromuscular junctions
      b.add('glow', rod([0.1, 0.21, 0.08], e, 0.005, 0.005, 3), '#fff1b0');
      b.add('glow', octa(0.022, e, [1, 0.6, 0.5]), '#ffb43b');
    }
    const HC = [0.26, 0.56, -0.04];                                                                      // the heart
    b.add('solid', sph(0.1, 8, 6, HC, [1, 1.2, 0.9], [0, 0, 0.5]), '#c23a44');
    b.add('solid', sph(0.056, 6, 4, add3(HC, [-0.06, 0.085, -0.01])), '#b33748');
    b.add('solid', sph(0.052, 6, 4, add3(HC, [0.05, 0.095, -0.035])), '#b33748');
    b.add('solid', tube([add3(HC, [0, 0.07, 0.02]), add3(HC, [0, 0.18, 0.02]), add3(HC, [0.06, 0.2, 0]), add3(HC, [0.095, 0.14, -0.05])], 8, 0.021, 5), '#dd5a61');
    b.add('solid', rod(add3(HC, [-0.085, 0.05, 0.02]), add3(HC, [-0.095, 0.2, 0.02]), 0.019, 0.019, 6, false), '#5b6bd2');
  });

  add('nmd.hpc', 'Supercomputer', 'A hall of dark computer racks with blinking blue and green fronts and a lit cold aisle, and the small towers it computes.', b => {
    b.add('solid', box(1.0, 0.03, 0.82, [0, 0.015, 0]), '#0b1626');
    for (const z of [-0.3, -0.1, 0.1, 0.3]) b.add('soft', box(1.0, 0.002, 0.004, [0, 0.031, z]), '#1f5f9a');
    for (const x of [-0.25, 0, 0.25]) b.add('soft', box(0.004, 0.002, 0.82, [x, 0.031, 0]), '#1f5f9a');
    b.add('glow', box(0.78, 0.004, 0.1, [0, 0.032, 0]), '#2f8fe8');                                 // the cold aisle
    [[-0.27, -1], [-0.11, 1], [0.11, -1], [0.27, 1]].forEach(([z, f], k) => {
      for (let i = 0; i < 4; i++) {
        const x = -0.27 + 0.18 * i, fz = z + f * 0.0615;
        b.add('solid', box(0.17, 0.34, 0.12, [x, 0.2, z]), '#141a24');
        b.add('glow', box(0.012, 0.27, 0.003, [x - 0.035, 0.205, fz]), '#3a9cff');                 // rows of lights on the front
        b.add('glow', box(0.012, 0.27, 0.003, [x + 0.035, 0.205, fz]), (i + k) % 2 ? '#3ee08f' : '#3a9cff');
      }
      b.add('solid', box(0.76, 0.012, 0.04, [0, 0.43, z]), '#3a4250');                              // cable tray
      b.add('glow', rod([-0.38, 0.442, z - 0.008], [0.38, 0.442, z - 0.008], 0.004, 0.004, 4), '#ffc23a');
      b.add('glow', rod([-0.38, 0.442, z + 0.008], [0.38, 0.442, z + 0.008], 0.004, 0.004, 4), '#3a8cff');
    });
    const TC = ['#46d9ff', '#3ee08f', '#a77bff', '#ffb43b', '#ff5ad9'];
    for (let i = 0; i < 6; i++) {                                                                   // tiny towers in the field round the hall
      const x = -0.42 + i * 0.168, z = i % 2 ? 0.385 : -0.385, g = cylF(0.022, 0.022, 0.1, 6, 3, true);
      b.add('glow', at(g, [x, 0.08, z]), (px, py) => TC[Math.max(0, Math.min(4, Math.floor((py - 0.03) / 0.022)))]);
    }
  });

  // ================================================================ the endotype story (endo)

  add('endo.syn', 'Neuromuscular junction', 'A nerve ending full of vesicles over the folded muscle membrane it signals to, with receptors on the crests.', b => {
    for (let k = 0; k < 4; k++) b.add('solid', cyl(0.045, 0.045, 0.92, 8, [0, 0.045, -0.18 + 0.12 * k], [0, 0, Math.PI / 2]), k % 2 ? '#e2758f' : '#f08aa6');   // myofibrils
    b.add('soft', box(0.9, 0.08, 0.48, [0, 0.13, 0]), '#b9476a');
    const RC = ['#ffb43b', '#7fe0ff', '#3ee08f'];
    for (let k = 0; k < 7; k++) {
      const x = -0.36 + 0.12 * k;
      b.add('soft', box(0.09, 0.15, 0.48, [x, 0.245, 0]), '#e27a96');           // the crests between the junctional folds
      for (let j = 0; j < 3; j++) b.add('glow', octa(0.017, [x, 0.325, -0.14 + 0.14 * j], [1.2, 0.45, 1.2]), RC[(k + j) % 3]);
    }
    b.add('glass', box(0.8, 0.004, 0.44, [0, 0.345, 0]), '#bfe6ff');            // basement membrane in the cleft
    const B0 = [0, 0.36, 0], r = rng(6);
    b.add('glass', at(sphF(0.27, 12, 5, Math.PI / 2), B0, null, [1, 0.78, 0.85]), '#8fd0ff');   // the bouton
    b.add('glow', at(torF(0.27, 0.006, 3, 16, Math.PI * 2), B0, [Math.PI / 2, 0, 0], [1, 0.85, 1]), '#7fe3ff');
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = 0.2 * Math.sqrt(r()), p = [d * Math.cos(a), 0.385 + 0.12 * r() * r(), d * Math.sin(a) * 0.8]; b.add('glow', ico(0.022, p), '#5d9dff'); }
    b.add('soft', sph(0.035, 6, 4, [-0.08, 0.5, -0.03], [2, 0.8, 0.8], [0, 0.4, 0.2]), '#e05ad0');   // a mitochondrion
    const AX = [[0, 0.56, 0], [-0.1, 0.7, -0.02], [-0.28, 0.84, -0.04], [-0.44, 0.95, -0.05]];
    b.add('glass', tube(AX, 8, 0.045, 6), '#7fc8ff');                            // the motor axon in its myelin
    b.add('glow', tube(AX, 8, 0.014, 3), '#ffe08a');
  });

  add('endo.net', 'Protein network cloud', 'A deep, round cloud of proteins in a glass shell, the disease genes lit inside as seeds with halos, their groups joined by glowing arcs.', b => {
    const r = rng(12), C = [0, 0.52, 0], core = [];
    plinth(b, 0.28);
    for (let i = 0; i < 15; i++) b.add('soft', octa(0.015, add3(C, mul3(unit(r), 0.29 + 0.11 * r()))), '#8ea4cf');
    for (let i = 0; i < 20; i++) { const p = mul3(unit(r), 0.21 * Math.cbrt(r())); core.push(p); b.add('glow', octa(0.017, add3(C, p)), mix('#9fb3ee', '#e4ebff', r())); }
    for (let i = 1; i < 20; i++) { let best = 0; for (let j = 0; j < i; j++) if (dist(core[i], core[j]) < dist(core[i], core[best])) best = j; b.add('soft', rod(add3(C, core[i]), add3(C, core[best]), 0.004, 0.004, 3), '#7f96d8'); }
    // the cloud is round and deep: a glass shell with a bright equator round its far shell of genes, haze inside
    b.add('glass', sph(0.42, 10, 7, C), '#34509c');
    b.add('glow', cyl(0.422, 0.422, 0.006, 16, C, null, true), '#4f8fe0');
    b.add('haze', sph(0.3, 8, 6, C), '#2a3f8f');
    const S = [[0.14, 0.06, 0.05], [0.06, -0.1, 0.12], [-0.12, 0.08, 0.09], [-0.04, 0.15, -0.1], [0.13, -0.08, -0.08], [-0.15, -0.09, -0.04], [-0.17, -0.02, -0.02]].map(p => add3(C, p));
    S.forEach((p, i) => { const pink = i >= 5; b.add('glow', ico(0.03, p), pink ? '#ff5ad9' : '#ffb43b'); if (!pink) b.add('haze', sph(0.058, 6, 4, p), '#ffb43b'); });
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [5, 6]]) {
      const m = mul3(add3(S[i], S[j]), 0.5), out = norm3(add3(m, mul3(C, -1)));
      b.add('glow', tube([S[i], add3(m, mul3(out, 0.06)), S[j]], 6, 0.0055, 3), i === 5 ? '#ff5ad9' : '#ffc960');
    }
  });

  add('endo.tree', 'Endotype tree', 'A tree of the module genes beside their rows of terms, cut and coloured into the twelve endotypes.', b => {
    const EN = [[9, '#9aa3b5'], [29, '#a98bea'], [47, '#3cc4e6'], [26, '#34d1a8'], [12, '#c7d65a'], [35, '#e3a03c'], [13, '#e2557a'], [17, '#8f9bb0'], [15, '#58d06a'], [25, '#5d86f0'], [34, '#f07b5a'], [131, '#e070d0']];
    b.add('solid', box(1.0, 0.03, 0.32, [0, 0.015, 0]), '#0f1b2e');
    b.add('glow', box(1.0, 0.004, 0.004, [0, 0.026, 0.16]), '#2397c4');
    b.add('solid', box(0.46, 0.86, 0.025, [0.25, 0.47, -0.02]), '#0d1626');      // the gene x term matrix
    const u = 0.82 / 393, Y = [];
    let y = 0.88;
    EN.forEach(([n, c]) => { const h = n * u; Y.push(y - h / 2); b.add('soft', box(0.42, h - 0.004, 0.006, [0.25, y - h / 2, -0.005]), c); y -= h; });
    // a dendrogram from the root on the left to a leaf per endotype, curving towards you in 3D
    const node = (lo, hi, depth) => {
      if (hi - lo === 1) return { x: 0, y: Y[lo], z: 0, c: EN[lo][1], leaf: true };
      const mid = lo + Math.ceil((hi - lo) / 2), a = node(lo, mid, depth + 1), c = node(mid, hi, depth + 1);
      const h = Math.max(a.h || 0, c.h || 0) + 1, n = { x: -0.05 - 0.085 * h, y: (a.y + c.y) / 2, z: 0.03 * h, h, kids: [a, c] };
      b.add('soft', rod([n.x, a.y, n.z], [n.x, c.y, n.z], 0.004, 0.004, 4), '#5fd7c0');
      for (const k of n.kids) b.add('soft', rod([n.x, k.y, n.z], [k.x, k.y, k.z], 0.004, 0.004, 4), k.leaf ? k.c : '#5fd7c0');
      b.add('glow', ico(0.015, [n.x, n.y, n.z]), '#9ff5e2');
      return n;
    };
    node(0, 12, 0);
    Y.forEach((y, i) => b.add('glow', octa(0.012, [0, y, 0]), EN[i][1]));
  });

  // ================================================================ the PET story (pet)

  add('pet.scan', 'PET/CT scanner', 'A glossy white scanner with its ring-shaped gantry, the blue band round the bore and the couch that slides the patient in.', b => {
    const W = 0.29, B = 0.06, TOP = 0.66, BC = 0.36, sh = [[-W + 0.05, B]];
    // the gantry's outline: lines cut so the bore's ring of points stays round, and quadratic corners and dome
    const L = (x, y, n) => { const [x0, y0] = sh[sh.length - 1]; for (let i = 1; i <= n; i++) sh.push([lerp(x0, x, i / n), lerp(y0, y, i / n)]); };
    const Q = (cx, cy, x, y, n) => { const [x0, y0] = sh[sh.length - 1]; for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; sh.push([u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y]); } };
    L(W - 0.05, B, 4); Q(W, B, W, B + 0.05, 2); L(W, TOP - 0.17, 4); Q(W, TOP, 0, TOP, 5); Q(-W, TOP, -W, TOP - 0.17, 5); L(-W, B + 0.05, 4); Q(-W, B, -W + 0.05, B, 2); sh.pop();
    b.add('shiny', at(extrude(sh, 0.36, { bt: 0.02, bs: 0.018, k: 1, c: [0, BC], hole: 0.15 }), [0, 0, -0.2]), '#eef1f5');
    b.add('solid', cyl(0.131, 0.131, 0.4, 16, [0, BC, -0.02], [Math.PI / 2, 0, 0], true), '#c3cedb');   // bore lining (the bevel narrows the hole)
    b.add('shiny', tor(0.178, 0.03, 4, 20, [0, BC, 0.18]), '#4e7fc4');                                   // the satin blue band
    for (const s of [-1, 1]) b.add('shiny', sph(0.06, 6, 4, [0.205 * s, BC, 0.185], [0.5, 1, 0.35]), '#5c86c0');
    for (const x of [-0.05, 0, 0.05]) b.add('glow', box(0.022, 0.01, 0.006, [x, 0.6, 0.183]), '#ffb43b');  // status lights
    b.add('solid', box(0.5, 0.06, 0.38, [0, 0.03, -0.02]), '#a9b2bc');                                   // plinth
    b.add('shiny', box(0.17, 0.035, 0.78, [0, 0.29, 0.27]), '#f2f4f6');                                  // the couch
    b.add('solid', box(0.15, 0.014, 0.7, [0, 0.314, 0.28]), '#d5dde8');
    b.add('soft', box(0.004, 0.014, 0.74, [0.087, 0.29, 0.27]), '#2f6fd8');
    b.add('soft', box(0.004, 0.014, 0.74, [-0.087, 0.29, 0.27]), '#2f6fd8');
    b.add('shiny', box(0.12, 0.03, 0.4, [0, 0.258, 0.44]), '#e8ebef');
    b.add('shiny', cyl(0.05, 0.1, 0.2, 4, [0, 0.145, 0.46], [0, Math.PI / 4, 0]), '#eef1f5');
    b.add('shiny', box(0.24, 0.03, 0.3, [0, 0.015, 0.46]), '#dde2e8');
  });

  add('pet.organs', 'Organ network', 'The body\'s organs as coloured rings linked by how their uptake rises and falls together, across hundreds of scans.', b => {
    plinth(b, 0.3);
    const F = [0, 0.04, 0], fb = { add: (k, g, c) => b.add(k, at(g, F), c) };
    figure(fb, 'glass', '#8fb1d8', 5);
    const O = { brain: [0, 0.97, '#a78bfa'], thyroid: [0.17, 0.86, '#22d3ee'], lungs: [-0.2, 0.76, '#60a5fa'], heart: [0.14, 0.7, '#f43f5e'], liver: [-0.25, 0.6, '#f97316'],
      spleen: [0.26, 0.6, '#d946ef'], kidneys: [-0.2, 0.47, '#fb7185'], intestine: [-0.04, 0.4, '#f9a8d4'], muscle: [0.18, 0.36, '#4ade80'] };
    const P = {};
    for (const k in O) {
      const [x, y, c] = O[k], p = add3(F, [x, y, 0.12]); P[k] = p;
      b.add('glow', tor(0.036, 0.0065, 3, 10, p), c);
      b.add('solid', disc(0.033, 10, p), '#0a1222');
    }
    const POS = [['liver', 'spleen'], ['heart', 'lungs'], ['lungs', 'liver'], ['intestine', 'muscle'], ['brain', 'thyroid'], ['heart', 'spleen'], ['kidneys', 'intestine'], ['lungs', 'brain'], ['liver', 'kidneys'], ['thyroid', 'heart']];
    const NEG = [['liver', 'heart'], ['kidneys', 'muscle'], ['brain', 'spleen']];
    const link = (a, c, colour) => { const d = norm3(add3(P[c], mul3(P[a], -1))), e = 0.038; b.add('soft', rod(add3(P[a], mul3(d, e)), add3(P[c], mul3(d, -e)), 0.0045, 0.0045, 3), colour); };
    POS.forEach(([a, c]) => link(a, c, '#4d8cff')); NEG.forEach(([a, c]) => link(a, c, '#ff5a4b'));
  });

  add('pet.liver', 'Liver network', 'A glass liver filled with small patches in hot-iron colours, linked where one takes up more sugar than its neighbour.', b => {
    const r = rng(8), OUT = [[-0.42, 0.04], [-0.4, 0.18], [-0.3, 0.28], [-0.12, 0.32], [0.08, 0.3], [0.25, 0.24], [0.38, 0.16], [0.45, 0.1], [0.3, 0.07], [0.12, 0.03], [0.02, -0.01], [-0.1, -0.04], [-0.14, -0.08], [-0.27, -0.11], [-0.38, -0.08]];
    const Y0 = 0.22, D = 0.2;
    plinth(b, 0.3);
    b.add('glass', at(extrude(OUT, D, { bt: 0.05, bs: 0.045, k: 2, c: [-0.1, 0.12] }), [0, Y0, -D / 2]), '#f97316');
    const inside = (x, y) => { let c = false; for (let i = 0, j = OUT.length - 1; i < OUT.length; j = i++) { const [xi, yi] = OUT[i], [xj, yj] = OUT[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const P = [], V = [];
    while (P.length < 46) {
      const x = -0.42 + 0.86 * r(), y = -0.1 + 0.42 * r(), z = (r() - 0.5) * (D + 0.04);
      if (!inside(x, y) || !inside(x + 0.04, y) || !inside(x - 0.04, y) || !inside(x, y + 0.04) || !inside(x, y - 0.04)) continue;
      const v = 0.45 + 0.18 * Math.sin(5 * x + 2) * Math.cos(6 * y) + (x < -0.2 && y > 0.12 ? 0.22 : 0) + 0.12 * r();
      P.push([x, Y0 + y, z]); V.push(v);
      b.add('glow', octa(0.019, [x, Y0 + y, z]), ramp(IRON, Math.min(1, v)));
    }
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++)
      if (dist(P[i], P[j]) < 0.115 && Math.abs(V[i] - V[j]) > 0.06) b.add('soft', rod(P[i], P[j], 0.0042, 0.0042, 3), V[i] > V[j] ? '#ffc27a' : '#ff9a5a');
    b.add('soft', sph(0.04, 6, 4, [-0.13, Y0 - 0.07, D / 2 + 0.02], [0.8, 1.2, 0.8]), '#6c9a46');   // gallbladder
  });

  // ================================================================ the microanatomy story (micro)

  add('micro.slide', 'Section in tiles', 'A tissue section cut into tiles, coloured by the domains a network of neighbouring tiles finds in it.', b => {
    const zc = x => 0.05 * Math.sin(x * 2.4) + 0.01, slope = x => 0.12 * Math.cos(x * 2.4), Y0 = 0.02, tb = easel(b, 0.5, 0.2, 0.44);
    const DOM = [['#52a83c', 0.034], ['#1c7a3c', 0.044], ['#9b2b22', 0.04], ['#b8741f', 0.056]], W = [-0.105, -0.035, 0.035, 0.105];
    tb.add('glass', box(1.0, 0.02, 0.4, [0, 0.01, 0]), '#cfe8f0');
    const top = {}, r = rng(3);
    for (let c = 0; c < 12; c++) for (let w = 0; w < 4; w++) {
      if ((c === 0 || c === 11) && (w === 0 || w === 3)) continue;
      const x = -0.44 + c * 0.08, z = zc(x) + W[w], [colour, h0] = DOM[w], h = h0 + 0.006 * r();
      tb.add('soft', box(0.072, h, 0.066, [x, Y0 + h / 2, z], [0, -Math.atan(slope(x)), 0]), w === 3 && c === 4 ? '#1a78b6' : colour);
      top[c + ',' + w] = [x, Y0 + 0.12, z];
    }
    const N = Object.keys(top).filter(k => +k.split(',')[0] % 2 === 0);
    for (const k of N) {                                                         // the network of neighbouring tiles over the section
      const [c, w] = k.split(',').map(Number), p = top[k], colour = mix(w === 3 && c === 4 ? '#1a78b6' : DOM[w][0], '#ffffff', 0.4);
      tb.add('glow', octa(0.015, p), colour);
      for (const q of [(c + 2) + ',' + w, c + ',' + (w + 1)]) if (top[q] && N.includes(q)) tb.add('soft', rod(p, top[q], 0.0035, 0.0035, 3), '#cfe6ff');
    }
  });

  add('micro.atlas', 'Slide library', 'A curved wall of glass slides with their tissue on shelves, one shelf for each decade of age.', b => {
    const r = rng(14), RC = 1.0, A = 0.48, SH = [0.0, 0.17, 0.34, 0.51, 0.68], TIS = ['#d986b0', '#b46aa8', '#e8a0a0', '#c45a7a', '#d79a6a', '#a77bd0'];
    const back = at(cylF(RC, RC, 0.8, 12, 2, true, Math.PI - A, 2 * A), [0, 0.4, RC]);
    b.add('two', back, (x, y) => mix('#0e2140', '#284a80', (1 - Math.abs(x) / 0.5) * (1 - Math.abs(y - 0.4) / 0.4)));
    for (const y of SH) {
      b.add('solid', at(ringF(RC - 0.07, RC, 12, Math.PI - A, 2 * A), [0, y, RC]), '#122440');
      b.add('glow', at(cylF(RC - 0.07, RC - 0.07, 0.008, 12, 1, true, Math.PI - A, 2 * A), [0, y + 0.004, RC]), '#5f8fd0');   // the shelf's bright lip
    }
    for (const f of [-0.32, -0.16, 0.16, 0.32]) b.add('solid', box(0.012, 0.68, 0.05, [(RC - 0.035) * Math.sin(f), 0.34, RC - (RC - 0.035) * Math.cos(f)], [0, -f, 0]), '#0b1626');
    for (let k = 0; k < 4; k++) for (let j = 0; j < 13; j++) {
      const f = -0.44 + j * 0.88 / 12 + (r() - 0.5) * 0.01, R = RC - 0.035, yc = SH[k] + 0.065, tis = TIS[Math.floor(j / 13 * 6)];
      b.add('soft', at(boxF(0.042, 0.1, 0.007), [R * Math.sin(f), yc, RC - R * Math.cos(f)], [(r() - 0.5) * 0.15, -f + (r() - 0.5) * 0.25, (r() - 0.5) * 0.1]),
        (x, y) => (y > yc + 0.026 ? '#e3eaf0' : mix(tis, '#9fd0d8', 0.25)));
    }
  });

  add('micro.hier', 'Organ architecture network', 'Organs, tissues, tissue types and domains as four rings, joined into an hourglass network.', b => {
    const LV = [[0.92, 0.42, '#1f8a4c', 10, 0.03], [0.66, 0.31, '#7ccf7e', 8, 0.022], [0.4, 0.14, '#ef8f7a', 5, 0.032], [0.12, 0.42, '#5aa9ff', 14, 0.015]];
    plinth(b, 0.46);
    const pos = LV.map(([y, R, c, n], l) => Array.from({ length: n }, (_, i) => {
      const a = l === 3 ? 6.2832 * (Math.floor(i / 3) + 0.25 * (i % 3) - 0.25) / 5 + 0.3 : 6.2832 * i / n + 0.3 * l;
      return [R * Math.sin(a), y, R * Math.cos(a)];
    }));
    LV.forEach(([y, R, c, n, s], l) => {
      b.add('glow', cyl(R, R, 0.006, 20, [0, y, 0], null, true), c);
      b.add('glass', disc(R, 20, [0, y, 0], [-Math.PI / 2, 0, 0]), c);
      pos[l].forEach(p => b.add(l === 3 ? 'glow' : 'soft', l === 3 ? octa(s, p) : ico(s, p), c));
    });
    const link = (l, i, j) => { const a = pos[l][i], c = pos[l + 1][j], ca = LV[l][2], cc = LV[l + 1][2];
      b.add('soft', rod(a, c, 0.004, 0.004, 3), (x, y) => mix(cc, ca, (y - c[1]) / (a[1] - c[1]))); };
    for (let i = 0; i < 10; i++) { link(0, i, Math.round(i * 0.8) % 8); if (i % 3 === 0) link(0, i, (Math.round(i * 0.8) + 1) % 8); }
    for (let i = 0; i < 8; i++) { link(1, i, Math.floor(i * 5 / 8)); if (i % 2) link(1, i, (Math.floor(i * 5 / 8) + 2) % 5); }
    for (let i = 0; i < 14; i++) link(2, Math.min(4, Math.floor(i / 3)), i);
  });

  add('micro.organs', 'Organ models', 'Small 3D models of the organs the slides come from: a heart, a kidney and a brain.', b => {
    plinth(b, 0.42);
    const H = [-0.2, 0.04, 0.08];                                                   // the heart, apex down and to its left
    b.add('solid', lathe([[0, 0], [0.04, 0.025], [0.09, 0.08], [0.12, 0.15], [0.12, 0.21], [0.09, 0.26], [0, 0.28]], 8, add3(H, [0, 0.02, 0]), [1, 1, 0.85], [0, 0, 0.35]), '#c23a44');
    b.add('solid', sph(0.06, 6, 4, add3(H, [-0.03, 0.27, -0.02])), '#b33748');
    b.add('solid', sph(0.055, 6, 4, add3(H, [0.08, 0.25, -0.03])), '#b33748');
    b.add('solid', tube([add3(H, [0.02, 0.24, 0.03]), add3(H, [0.03, 0.36, 0.02]), add3(H, [0.1, 0.39, 0]), add3(H, [0.15, 0.32, -0.03])], 8, 0.03, 5), '#dd5a61');
    for (const d of [-0.015, 0.03, 0.07]) b.add('solid', rod(add3(H, [d + 0.03, 0.37, 0.01]), add3(H, [d + 0.03, 0.44, 0.01]), 0.012, 0.01, 6), '#efe2d2');
    b.add('solid', rod(add3(H, [-0.09, 0.2, 0.03]), add3(H, [-0.1, 0.37, 0.02]), 0.025, 0.025, 6, false), '#6d77d6');
    const K = [0.08, 0.04, 0.2];                                                     // the kidney, a bean on end, its hilum inwards
    b.add('solid', tor(0.05, 0.066, 6, 10, add3(K, [0.0, 0.14, 0]), [0, 0, Math.PI * 0.2], Math.PI * 1.6), '#8f2f2c');
    for (const a of [Math.PI * 0.2, Math.PI * 1.8]) b.add('solid', sph(0.066, 6, 4, add3(K, [0.05 * Math.cos(a), 0.14 + 0.05 * Math.sin(a), 0])), '#8f2f2c');
    b.add('solid', tube([add3(K, [-0.045, 0.12, 0.01]), add3(K, [-0.08, 0.07, 0.02]), add3(K, [-0.07, 0.0, 0.03])], 6, 0.011, 3), '#e8d2ad');
    const Bn = [0.17, 0.04, -0.14], r = rng(21);                                      // the brain, two hemispheres
    for (const s of [-1, 1]) b.add('solid', sph(0.14, 9, 6, add3(Bn, [0.038 * s, 0.17, 0]), [0.48, 0.72, 1]), () => mix('#e8b2b7', '#c98c95', r() * 0.6));
    b.add('solid', sph(0.06, 6, 4, add3(Bn, [0, 0.09, -0.1]), [1.3, 0.7, 0.9]), '#d49ba3');
    b.add('solid', rod(add3(Bn, [0, 0.11, -0.03]), add3(Bn, [0, 0.0, -0.04]), 0.022, 0.016, 6, false), '#e6c2b6');
  });

  // triangles of each build, measured (the harness lists any that no longer match)
  const TRIS = {
    'lbi.int': 1198, 'lbi.mac': 940, 'lbi.web': 1184, 'lbi.dna': 1024, 'lbi.atp': 808, 'lbi.crowd': 996,
    'lbi.sankey': 1056, 'lbi.scale': 800, 'lbi.body': 1048, 'lbi.tissue': 860, 'nmd.tower': 992, 'nmd.motor': 1022,
    'nmd.hpc': 1012, 'endo.syn': 1108, 'endo.net': 1186, 'endo.tree': 760, 'pet.scan': 816, 'pet.organs': 1142,
    'pet.liver': 980, 'micro.slide': 940, 'micro.atlas': 960, 'micro.hier': 1148, 'micro.organs': 856
  };
  for (const k in TRIS) LOWPOLY_MODELS[k].tris = TRIS[k];
})();
