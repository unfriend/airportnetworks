// The miniatures' kit a (until v190 the helpers of tools/lowpoly/models-a.js): a bag of parts per material written
// straight into arrays, for the miniatures of the tour (lbi), the muscle (nmd), endotype (endo), PET (pet) and
// microanatomy (micro) stories. A package's src/minis.js that says "// kit: a" is pasted after it by
// tools/lowpoly/build.mjs, inside one function (so these names are its own); not loaded on its own.
// Each entry's build(THREE) returns a THREE.Group centred on x and z, standing on y = 0 and fitting a 1 x 1 x 1 box (the
// caller scales it): simple shapes merged into one mesh per material, lit, in the prop's own colours, for the design
// room's table and the shared rooms' station icons. three.js r128, no libraries.
// add(key, name, shows, make(bag)) registers LOWPOLY_MODELS[key]; tris({ key: n }) gives each its measured triangles.
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

  const tris = o => { for (const k in o) LOWPOLY_MODELS[k].tris = o[k]; };
