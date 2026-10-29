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
  const len3 = a => Math.hypot(a[0], a[1], a[2]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const norm3 = a => mul3(a, 1 / (len3(a) || 1));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t = Math.max(0, Math.min(1, t)), t * t * (3 - 2 * t));
  const unit = r => { const z = 2 * r() - 1, a = 6.2832 * r(), s = Math.sqrt(1 - z * z); return [s * Math.cos(a), z, s * Math.sin(a)]; };
  const col = c => (c instanceof T.Color ? c.clone() : Array.isArray(c) ? new T.Color(c[0], c[1], c[2]) : new T.Color(c));
  const mix = (a, b, t) => col(a).lerp(col(b), Math.max(0, Math.min(1, t)));
  const ramp = (stops, v) => { for (let i = 1; i < stops.length; i++) if (v <= stops[i][0] || i === stops.length - 1) return mix(stops[i - 1][1], stops[i][1], (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); };
  // the body set's hot-iron map, as the PET scans are drawn
  const IRON = [[0, '#160303'], [0.3, '#6a0d06'], [0.5, '#c22a0a'], [0.68, '#ff7414'], [0.85, '#ffd25a'], [1, '#fff8e2']];

  // a part placed by position, Euler turn and scale (number or [x, y, z])
  const M4 = (p, r, s) => new T.Matrix4().compose(new T.Vector3(...(p || [0, 0, 0])), new T.Quaternion().setFromEuler(new T.Euler(...(r || [0, 0, 0]))),
    new T.Vector3(...(s === undefined ? [1, 1, 1] : typeof s === 'number' ? [s, s, s] : s)));
  const at = (g, p, r, s) => g.applyMatrix4(M4(p, r, s));
  const box = (w, h, d, p, r) => at(new T.BoxGeometry(w, h, d), p, r);
  const sph = (rad, ws, hs, p, s, r) => at(new T.SphereGeometry(rad, ws, hs), p, r, s);
  const ico = (rad, det, p, s) => at(new T.IcosahedronGeometry(rad, det), p, null, s);
  const octa = (rad, p, s) => at(new T.OctahedronGeometry(rad, 0), p, null, s);
  const cyl = (rt, rb, h, n, p, r, open) => at(new T.CylinderGeometry(rt, rb, h, n, 1, !!open), p, r);
  const tor = (R, r, rs, ts, p, rot, arc) => at(new T.TorusGeometry(R, r, rs, ts, arc || Math.PI * 2), p, rot);
  const disc = (rad, n, p, r) => at(new T.CircleGeometry(rad, n), p, r);
  const lathe = (pts, n, p, s, r) => at(new T.LatheGeometry(pts.map(q => new T.Vector2(q[0], q[1])), n), p, r, s);
  const tube = (pts, seg, rad, n) => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(q => new T.Vector3(...q))), seg, rad, n, false);
  // a rod from a to b (radius r1 at a, r2 at b); open by default, as the thin links are
  function rod(a, b, r1, r2, n, open) {
    const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length() || 1e-6;
    const g = new T.CylinderGeometry(r2 === undefined ? r1 : r2, r1, L, n || 4, 1, open !== false);
    return g.applyMatrix4(new T.Matrix4().compose(A.add(B).multiplyScalar(0.5), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()), new T.Vector3(1, 1, 1)));
  }
  // a flat shape (points [x, s], s = -z) extruded up from y0 by h
  function slab(pts, h, y0, opt) {
    const sh = new T.Shape(pts.map(q => new T.Vector2(q[0], q[1])));
    return at(new T.ExtrudeGeometry(sh, Object.assign({ depth: h, bevelEnabled: false, steps: 1 }, opt || {})), [0, y0, 0], [-Math.PI / 2, 0, 0]);
  }

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
    glow: () => glowing(std({ roughness: 0.45, metalness: 0 }), 0.85),
    glass: () => glowing(std({ roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide }), 0.3),
  };
  const ORDER = ['solid', 'shiny', 'soft', 'two', 'glow', 'glass'];

  // a bag of parts, merged per material, then scaled and moved into the unit box standing on y = 0
  function bag() {
    const parts = {}, c = new T.Color();
    return {
      add(kind, g, colour) {
        const geo = g.index ? g.toNonIndexed() : g;
        if (!geo.attributes.normal) geo.computeVertexNormals();
        const pos = geo.attributes.position, n = pos.count, cols = new Float32Array(3 * n), fn = typeof colour === 'function';
        if (!fn) c.copy(col(colour));
        for (let i = 0; i < n; i++) {
          if (fn) c.copy(col(colour(pos.getX(i), pos.getY(i), pos.getZ(i))));
          cols[3 * i] = c.r; cols[3 * i + 1] = c.g; cols[3 * i + 2] = c.b;
        }
        (parts[kind] = parts[kind] || []).push([pos.array, geo.attributes.normal.array, cols]);
        g.dispose(); if (geo !== g) geo.dispose();
        return this;
      },
      done() {
        const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
        for (const k in parts) for (const [p] of parts[k]) for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[i + a]); hi[a] = Math.max(hi[a], p[i + a]); }
        const s = 1 / Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), o = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
        const grp = new T.Group(); let tris = 0;
        for (const k of ORDER) if (parts[k]) {
          const n = parts[k].reduce((m, q) => m + q[0].length, 0), P = new Float32Array(n), N = new Float32Array(n), C = new Float32Array(n);
          let j = 0;
          for (const [p, nn, cc] of parts[k]) {
            for (let i = 0; i < p.length; i++) P[j + i] = (p[i] - o[i % 3]) * s;
            N.set(nn, j); C.set(cc, j); j += p.length;
          }
          const g = new T.BufferGeometry();
          g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3));
          g.computeBoundingSphere();
          const m = new T.Mesh(g, MAT[k]()); m.name = k; if (k === 'glass') m.renderOrder = 1;
          grp.add(m); tris += n / 9;
        }
        grp.userData.tris = tris;
        return grp;
      },
    };
  }

  // a dark round stand with a glowing rim, for the props that float
  const plinth = (b, r, h) => { h = h || 0.04; b.add('solid', cyl(r, r * 1.04, h, 16, [0, h / 2, 0]), '#0f1b2e'); b.add('glow', cyl(r * 1.006, r * 1.006, h * 0.3, 16, [0, h * 0.8, 0], null, true), '#2397c4'); };
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

  add('lbi.int', 'Interactome', 'A glowing ball of human protein interactions, dense and bright at its centre, with tufts towards the rim.', b => {
    const r = rng(7), C = [0, 0.55, 0], P = [], cols = [];
    plinth(b, 0.3);
    const tufts = [0, 1, 2, 3, 4, 5].map(() => mul3(unit(r), 0.33));
    const ACC = ['#ff5ad9', '#ffb43b', '#3ee08f', '#46d9ff', '#ff5a4b', '#c84fd0', '#2f9e44', '#4d94ff'];
    for (let i = 0; i < 60; i++) {
      const p = i < 22 ? mul3(unit(r), 0.03 + 0.15 * Math.cbrt(r())) : i < 42 ? mul3(unit(r), 0.17 + 0.17 * r()) : add3(tufts[i % 6], mul3(unit(r), 0.065 * r()));
      p[1] *= 0.92; P.push(p);
      const d = len3(p) / 0.4;
      cols.push(i >= 24 && i < 32 ? col(ACC[i - 24]) : d < 0.5 ? mix('#ffffff', '#b4c8ff', d * 2) : mix('#b4c8ff', '#8a78f0', (d - 0.5) * 2));
      b.add('glow', octa(i < 4 ? 0.024 : 0.017 - 0.008 * Math.min(1, d), add3(C, p)), cols[i]);
    }
    const link = (i, j) => b.add('glow', rod(add3(C, P[i]), add3(C, P[j]), 0.0035, 0.0035, 3), mix(cols[i], cols[j], 0.5).multiplyScalar(0.75));
    for (let i = 1; i < 60; i++) { let best = 0; for (let j = 1; j < i; j++) if (dist(P[i], P[j]) < dist(P[i], P[best])) best = j; link(i, best); }
    for (let k = 0; k < 12; k++) { const i = 22 + Math.floor(r() * 38); link(i, Math.floor(r() * 4)); }
    b.add('glass', sph(0.15, 8, 6, C), '#dfe8ff');
    b.add('glow', ico(0.065, 0, C), '#ffffff');
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
    b.add('solid', box(0.44, 0.022, 0.17, [0, 0.011, 0.37], [0.05, 0, 0]), BE);  // keyboard
    for (let k = 0; k < 4; k++) for (let c = 0; c < 10; c++) b.add('solid', box(0.032, 0.012, 0.028, [-0.171 + c * 0.038, 0.027 - 0.0017 * k, 0.306 + k * 0.034]), KEY);
    b.add('solid', box(0.2, 0.012, 0.028, [0, 0.02, 0.442]), KEY);
    for (const x of [-0.17, -0.132, 0.132, 0.17]) b.add('solid', box(0.032, 0.012, 0.028, [x, 0.02, 0.442]), BE3);
    b.add('solid', sph(0.04, 8, 5, [0.31, 0.014, 0.38], [0.75, 0.35, 1.2]), BE);  // mouse
    b.add('solid', box(0.04, 0.006, 0.02, [0.31, 0.024, 0.345]), BE3);
    b.add('solid', tube([[0.31, 0.01, 0.33], [0.29, 0.01, 0.26], [0.24, 0.02, 0.2], [0.21, 0.08, 0.05]], 8, 0.004, 3), BE3);
  });

  add('lbi.web', 'Internet map', 'The internet as trees of links growing out of white-hot hubs into yellow trunks and red twigs.', b => {
    const r = rng(5), CY = 0.5, COL = ['#ffe27a', '#ff9a2a', '#e0401a'], RAD = [0.0065, 0.0045, 0.0032];
    plinth(b, 0.3);
    const flat = d => norm3([d[0], d[1] * 0.45, d[2]]);
    function grow(p, d, len, depth) {
      const q = add3(p, mul3(d, len));
      b.add('glow', rod(p, q, RAD[depth], RAD[depth] * 0.8, 3), COL[depth]);
      if (depth < 2) for (let k = 0; k < 2; k++) grow(q, flat(add3(d, mul3(unit(r), 0.75))), len * 0.62, depth + 1);
    }
    const hubs = [[-0.15, CY + 0.02, 0.06, 6, 0, 0.15], [0.17, CY - 0.03, -0.06, 6, 0, 0.14], [-0.02, CY + 0.1, -0.29, 4, 1, 0.12],
      [0.31, CY + 0.05, 0.2, 4, 1, 0.11], [-0.34, CY - 0.05, -0.18, 4, 1, 0.11], [0.04, CY - 0.08, 0.32, 4, 1, 0.12]];
    for (const [x, y, z, n, d0, len] of hubs) {
      const a0 = r() * 6.28;
      for (let k = 0; k < n; k++) { const a = a0 + 6.2832 * k / n; grow([x, y, z], flat([Math.cos(a), (r() - 0.5) * 0.6, Math.sin(a)]), len, d0); }
      b.add('glow', ico(d0 ? 0.017 : 0.026, 0, [x, y, z]), '#fff6dc');
    }
    for (const [i, j] of [[0, 1], [0, 4], [1, 3], [2, 5]]) b.add('soft', rod(hubs[i], hubs[j], 0.0025, 0.0025, 3), '#d8763a');
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
      const g = at(new T.CylinderGeometry(0.026, 0.026, Math.hypot(dx, dy), 6, 3, false), [CC[0] + dx / 2, CC[1] + dy / 2, CC[2]], [0, 0, -Math.atan2(dx, dy)]);
      b.add('soft', g, (x, y) => (Math.floor(Math.abs(y - CC[1]) / 0.03) % 2 ? '#b9a6ff' : '#5aa0ff'));
    }
  });

  add('lbi.atp', 'ATP synthase', 'The molecular machine in its membrane: the turning ring, the central stalk and the head that makes ATP.', b => {
    b.add('soft', cyl(0.42, 0.42, 0.1, 20, [0, 0.05, 0]), '#c9a677');            // the lipid bilayer
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
    const r = rng(9), F = [0, 0, 0.92], ROWS = [4, 5, 6, 5];
    b.add('solid', cyl(0.46, 0.47, 0.02, 16, [0, 0.01, 0.02]), '#0b1424');
    const person = (p, red) => {
      const c = red ? '#ff5a4b' : mix('#7d8796', '#bcc4cf', r());
      b.add(red ? 'glow' : 'solid', lathe([[0, 0], [0.042, 0], [0.036, 0.07], [0.03, 0.095], [0.012, 0.104]], 5, [p[0], 0.02, p[2]]), c);
      b.add(red ? 'glow' : 'solid', sph(0.022, 5, 3, [p[0], 0.149, p[2]]), c);
    };
    ROWS.forEach((n, k) => {
      const R = 0.62 + 0.14 * k;
      for (let j = 0; j < n; j++) {
        const a = (j - (n - 1) / 2) * 0.17 + (r() - 0.5) * 0.04, p = [F[0] + R * Math.sin(a), 0, F[2] - R * Math.cos(a)], red = k === 1 && j === 2;
        person(p, red);
        if (red) {
          b.add('glow', disc(0.08, 12, [p[0], 0.022, p[2]], [-Math.PI / 2, 0, 0]), '#a8281e');
          b.add('glass', cyl(0.035, 0.085, 0.62, 10, [p[0], 0.33, p[2]], null, true), '#ffe6cc');
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
      const [m, oR] = M[i][j], yl = topL[i] - offL[i] - m * uL / 2, yr = topR[j] - oR - m * uR / 2, z0 = (4 - i) * 0.024, SEG = 6, P = [];
      offL[i] += m * uL;
      const pt = t => { const s = smooth(t), e = t < 0.35 ? smooth(t / 0.35) : t > 0.65 ? smooth((1 - t) / 0.35) : 1, h = lerp(m * uL, m * uR, s) / 2, yc = lerp(yl, yr, s);
        return [[-0.38 + 0.76 * t, yc + h, z0 * e], [-0.38 + 0.76 * t, yc - h, z0 * e]]; };
      for (let k = 0; k < SEG; k++) { const [a, c] = pt(k / SEG), [d, e] = pt((k + 1) / SEG); P.push(...a, ...c, ...d, ...d, ...c, ...e); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); g.computeVertexNormals();
      b.add('two', g, CL[i]);
    }
  });

  add('lbi.scale', 'Tower of scales', 'A glass tower of eight glowing floors, from DNA at the bottom to the whole body at the top.', b => {
    plinth(b, 0.31);
    b.add('glass', cyl(0.29, 0.29, 0.92, 14, [0, 0.5, 0], null, true), '#7fe3ff');
    b.add('glow', cyl(0.292, 0.292, 0.008, 14, [0, 0.96, 0], null, true), '#46d9ff');
    const Y = k => 0.1 + k * 0.112;
    for (let k = 0; k < 8; k++) {
      b.add('glass', cyl(0.25, 0.25, 0.006, 12, [0, Y(k), 0]), '#46d9ff');
      b.add('glow', cyl(0.252, 0.252, 0.01, 12, [0, Y(k), 0], null, true), '#46d9ff');
    }
    const E = k => [0, Y(k) + 0.004, 0];
    b.add('soft', rod(add3(E(0), [-0.03, 0.005, 0]), add3(E(0), [0.03, 0.07, 0]), 0.008, 0.008, 4), '#3ee08f');      // DNA bases
    b.add('soft', rod(add3(E(0), [0.03, 0.005, 0]), add3(E(0), [-0.03, 0.07, 0]), 0.008, 0.008, 4), '#ff5a4b');
    b.add('soft', rod(add3(E(0), [-0.022, 0.04, 0]), add3(E(0), [0.022, 0.04, 0]), 0.006, 0.006, 4), '#ffb43b');
    b.add('soft', ico(0.036, 0, add3(E(1), [0, 0.04, 0]), [1, 1.2, 1]), '#3a7bd5');                               // a protein
    b.add('soft', rod(add3(E(1), [0.02, 0.06, 0]), add3(E(1), [0.05, 0.08, 0.01]), 0.006, 0.004, 4), '#ffd23a');
    b.add('soft', cyl(0.022, 0.022, 0.02, 6, add3(E(2), [0, 0.012, 0])), '#ec8396');                               // a complex
    b.add('soft', rod(add3(E(2), [0, 0.02, 0]), add3(E(2), [0, 0.05, 0]), 0.007, 0.007, 4), '#5adcc7');
    b.add('soft', sph(0.03, 6, 4, add3(E(2), [0, 0.07, 0])), '#1db0a2');
    b.add('soft', sph(0.03, 6, 4, add3(E(3), [0, 0.03, 0]), [1.7, 0.85, 0.85]), '#ffa36b');                       // a mitochondrion
    b.add('glass', sph(0.042, 6, 4, add3(E(4), [0, 0.045, 0])), '#7fe3ff');                                        // a cell
    b.add('soft', ico(0.016, 0, add3(E(4), [0, 0.045, 0])), '#9b6bd6');
    b.add('soft', cyl(0.04, 0.04, 0.025, 6, add3(E(5), [0, 0.013, 0])), '#f19aa7');                                // tissue
    for (const s of [-1, 1]) b.add('soft', sph(0.032, 6, 4, add3(E(6), [0.017 * s, 0.035, 0]), [0.8, 0.85, 1.15]), '#f2a7b5');   // a brain
    b.add('soft', cyl(0.012, 0.016, 0.05, 6, add3(E(7), [0, 0.03, 0])), '#e2eaf6');                                // the body
    b.add('soft', ico(0.012, 0, add3(E(7), [0, 0.07, 0])), '#e2eaf6');
  });

  add('lbi.body', 'PET body network', 'A whole-body PET scan in glowing hot-iron colours, with the network of its organs wound round it.', b => {
    const HOT = [[[0, 0.9, 0], 0.07, 0.55], [[0.03, 0.69, 0.04], 0.06, 0.35], [[-0.06, 0.6, 0.03], 0.07, 0.15], [[0.06, 0.55, -0.03], 0.05, 0.25], [[-0.06, 0.55, -0.03], 0.05, 0.25], [[0, 0.47, 0.04], 0.05, 0.4]];
    const heat = (x, y, z) => ramp(IRON, 0.36 + HOT.reduce((s, [c, w, a]) => s + a * Math.exp(-((x - c[0]) ** 2 + (y - 0.04 - c[1]) ** 2 + (z - c[2]) ** 2) / (2 * w * w)), 0));
    plinth(b, 0.24);
    const F = [0, 0.04, 0];
    const fb = { add: (k, g, c) => b.add(k, at(g, F), c) };
    figure(fb, 'glow', heat, 6);
    b.add('glow', sph(0.032, 6, 4, add3(F, [0.035, 0.69, 0.06])), '#ff9a2a');     // heart
    b.add('glow', sph(0.028, 6, 4, add3(F, [0, 0.47, 0.055])), '#ffe680');        // bladder
    const N = [[0.3, 0.5], [1.4, 0.62], [2.4, 0.46], [3.3, 0.7], [4.3, 0.54], [5.3, 0.78], [0.8, 0.82], [2.9, 0.38]].map(([a, y]) => add3(F, [0.21 * Math.sin(a), y, 0.17 * Math.cos(a)]));
    for (const p of N) b.add('glow', ico(0.018, 0, p), '#f6f8ff');
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [0, 4], [7, 2]]) {
      const m = mul3(add3(N[i], N[j]), 0.5), out = norm3([m[0], 0, m[2]]);           // bands bow outwards round the body
      b.add('glow', tube([N[i], add3(m, add3(mul3(out, 0.07), [0, 0.03, 0])), N[j]], 6, 0.0045, 3), '#e9eef8');
    }
  });

  add('lbi.tissue', 'Tissue section', 'A stained section of stomach wall on a glass slide, its layers in purple and pink, with a cell nucleus in every dot.', b => {
    const r = rng(4), L = 0.46, zc = x => 0.05 * Math.sin(x * 2.4) + 0.01, Y0 = 0.02;
    b.add('glass', box(1.0, 0.02, 0.38, [0, 0.01, 0]), '#cfe8f0');
    const lay = (w0, w1, h, c) => b.add('solid', slab(band(L, zc, () => w0, x => w1 + (w1 > 0.12 ? 0.008 * Math.sin(x * 70) : 0), 18), h, Y0), c);
    lay(-0.13, -0.075, 0.026, '#cf4f82');      // outer muscle, lengthwise
    lay(-0.075, -0.02, 0.03, '#e2729d');       // inner muscle, circular
    lay(-0.02, 0.07, 0.032, '#f2bdd5');        // submucosa
    lay(0.07, 0.13, 0.04, '#9b66c2');          // mucosa
    const tp = x => Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / L, 6)));
    for (let i = 0; i < 24; i++) { const x = (r() * 2 - 1) * 0.4, w = (0.08 + 0.042 * r()) * tp(x); b.add('solid', octa(0.012, [x, Y0 + 0.041, zc(x) + w], [1, 0.4, 1]), '#4b2a75'); }
    for (let i = 0; i < 5; i++) { const x = (r() * 2 - 1) * 0.36, w = (0.005 + 0.05 * r()) * tp(x); b.add('solid', octa(0.011, [x, Y0 + 0.033, zc(x) + w], [1, 0.45, 1]), '#b8283c'); }
    b.add('solid', sph(0.032, 6, 4, [-0.12, Y0 + 0.036, zc(-0.12) + 0.085], [1, 0.35, 1]), '#3d2266');   // a lymphoid aggregate
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
    plinth(b, 0.5);
    b.add('glass', cyl(0.11, 0.11, 0.1, 12, [-0.36, 0.38, 0], [Math.PI / 2, 0, 0]), '#dfe8f2');   // the spinal cord, cut face to the front
    for (const s of [-1, 1]) b.add('solid', box(0.1, 0.026, 0.006, [-0.36, 0.38, 0.052], [0, 0, 0.6 * s]), '#a39cb0');   // grey matter butterfly
    b.add('glow', sph(0.022, 6, 4, [-0.32, 0.36, 0.056]), '#ffe27a');                                  // motor neuron
    for (const d of [[-0.05, 0.04], [0.03, 0.05], [-0.04, -0.035], [0.0, -0.05]]) b.add('glow', rod([-0.32, 0.36, 0.056], [-0.32 + d[0], 0.36 + d[1], 0.056], 0.004, 0.002, 3), '#ffe27a');
    const AX = [[-0.32, 0.36, 0.056], [-0.25, 0.32, 0.06], [-0.18, 0.2, 0.07], [-0.02, 0.15, 0.08], [0.08, 0.2, 0.08], [0.12, 0.27, 0.075]];
    b.add('glow', tube(AX, 16, 0.006, 3), '#fff1b0');
    b.add('glass', tube(AX.slice(1), 14, 0.017, 5), '#bfefff');                                         // myelin sheath
    b.add('glass', sph(0.032, 6, 4, [-0.4, 0.2, 0.04]), '#cfe0f0');                                     // dorsal root ganglion
    b.add('glow', tube([[-0.4, 0.2, 0.04], [-0.33, 0.21, 0.065], [-0.24, 0.24, 0.07]], 6, 0.004, 3), '#7fe3ff');
    const HEX = [[0, 0], [0.05, 0], [-0.05, 0], [0.025, 0.043], [-0.025, 0.043], [0.025, -0.043], [-0.025, -0.043]];
    HEX.forEach(([dy, dz], k) => b.add('solid', cyl(0.03, 0.03, 0.4, 8, [0.27, 0.31 + dy, dz], [0, 0, Math.PI / 2]), k % 2 ? '#e8697c' : '#f07c8a'));
    for (const e of [[0.17, 0.33, 0.07], [0.25, 0.28, 0.075], [0.33, 0.33, 0.07]]) {                  // neuromuscular junctions
      b.add('glow', rod([0.12, 0.27, 0.075], e, 0.004, 0.004, 3), '#fff1b0');
      b.add('glow', octa(0.018, e, [1, 0.6, 0.5]), '#ffb43b');
    }
    const HC = [0.27, 0.6, -0.04];                                                                       // the heart
    b.add('solid', sph(0.085, 8, 6, HC, [1, 1.2, 0.9], [0, 0, 0.5]), '#c23a44');
    b.add('solid', sph(0.048, 6, 4, add3(HC, [-0.05, 0.07, -0.01])), '#b33748');
    b.add('solid', sph(0.045, 6, 4, add3(HC, [0.04, 0.08, -0.03])), '#b33748');
    b.add('solid', tube([add3(HC, [0, 0.06, 0.02]), add3(HC, [0, 0.15, 0.02]), add3(HC, [0.05, 0.17, 0]), add3(HC, [0.08, 0.12, -0.04])], 8, 0.018, 5), '#dd5a61');
    b.add('solid', rod(add3(HC, [-0.07, 0.04, 0.02]), add3(HC, [-0.08, 0.17, 0.02]), 0.016, 0.016, 6, false), '#5b6bd2');
  });

  add('nmd.hpc', 'Supercomputer', 'A hall of dark computer racks with glowing fronts and a lit cold aisle, and the small towers it computes.', b => {
    b.add('solid', box(1.0, 0.03, 0.82, [0, 0.015, 0]), '#0b1626');
    for (const z of [-0.3, -0.1, 0.1, 0.3]) b.add('soft', box(1.0, 0.002, 0.004, [0, 0.031, z]), '#1f5f9a');
    for (const x of [-0.25, 0, 0.25]) b.add('soft', box(0.004, 0.002, 0.82, [x, 0.031, 0]), '#1f5f9a');
    b.add('glow', box(0.8, 0.004, 0.1, [0, 0.032, 0]), '#2f8fe8');                                  // the cold aisle
    [[-0.27, -1], [-0.11, 1], [0.11, -1], [0.27, 1]].forEach(([z, f], k) => {
      for (let i = 0; i < 5; i++) {
        const x = -0.32 + 0.16 * i;
        b.add('solid', box(0.15, 0.34, 0.12, [x, 0.2, z]), '#151b25');
        b.add('glow', box(0.11, 0.26, 0.003, [x, 0.21, z + f * 0.061]), (i + k) % 2 ? '#1d5fae' : '#1b8a6a');
      }
      b.add('solid', box(0.82, 0.012, 0.04, [0, 0.43, z]), '#3a4250');                              // cable tray
      b.add('glow', rod([-0.41, 0.442, z - 0.008], [0.41, 0.442, z - 0.008], 0.004, 0.004, 4), '#ffc23a');
      b.add('glow', rod([-0.41, 0.442, z + 0.008], [0.41, 0.442, z + 0.008], 0.004, 0.004, 4), '#3a8cff');
    });
    const TC = ['#46d9ff', '#3ee08f', '#a77bff', '#ffb43b', '#ff5ad9'];
    for (let i = 0; i < 6; i++) {                                                                   // tiny towers in the field round the hall
      const x = -0.42 + i * 0.168, z = i % 2 ? 0.385 : -0.385, g = new T.CylinderGeometry(0.022, 0.022, 0.1, 6, 3, true);
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
    b.add('glass', at(new T.SphereGeometry(0.27, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), B0, null, [1, 0.78, 0.85]), '#a8d8ff');   // the bouton
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = 0.2 * Math.sqrt(r()), p = [d * Math.cos(a), 0.385 + 0.12 * r() * r(), d * Math.sin(a) * 0.8]; b.add('glow', ico(0.022, 0, p), '#5d9dff'); }
    b.add('soft', sph(0.035, 6, 4, [-0.08, 0.5, -0.03], [2, 0.8, 0.8], [0, 0.4, 0.2]), '#e05ad0');   // a mitochondrion
    const AX = [[0, 0.56, 0], [-0.1, 0.7, -0.02], [-0.28, 0.84, -0.04], [-0.44, 0.95, -0.05]];
    b.add('glass', tube(AX, 8, 0.045, 6), '#cfe8ff');
    b.add('glow', tube(AX, 8, 0.012, 3), '#ffe08a');
  });

  add('endo.net', 'Protein network cloud', 'A deep cloud of proteins with the disease genes lit as seeds, their neighbourhoods joined by glowing arcs.', b => {
    const r = rng(12), C = [0, 0.52, 0], core = [];
    plinth(b, 0.3);
    for (let i = 0; i < 32; i++) b.add('soft', octa(0.011, add3(C, mul3(unit(r), 0.3 + 0.12 * r()))), '#8ea4cf');
    for (let i = 0; i < 26; i++) { const p = mul3(unit(r), 0.2 * Math.cbrt(r())); core.push(p); b.add('glow', octa(0.013, add3(C, p)), mix('#9fb3ee', '#dfe7ff', r())); }
    for (let i = 1; i < 25; i++) { let best = 0; for (let j = 0; j < i; j++) if (dist(core[i], core[j]) < dist(core[i], core[best])) best = j; b.add('soft', rod(add3(C, core[i]), add3(C, core[best]), 0.003, 0.003, 3), '#6f86c8'); }
    const S = [[0.14, 0.06, 0.05], [0.06, -0.1, 0.12], [-0.12, 0.08, 0.09], [-0.04, 0.15, -0.1], [0.13, -0.08, -0.08], [-0.15, -0.09, -0.04], [-0.17, -0.02, -0.02]].map(p => add3(C, p));
    S.forEach((p, i) => { const pink = i >= 5; b.add('glow', ico(0.026, 0, p), pink ? '#ff5ad9' : '#ffb43b'); if (!pink) b.add('glass', sph(0.05, 6, 4, p), '#ffb43b'); });
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [0, 4], [5, 6]]) {
      const m = mul3(add3(S[i], S[j]), 0.5), out = norm3(add3(m, mul3(C, -1)));
      b.add('glow', tube([S[i], add3(m, mul3(out, 0.06)), S[j]], 6, 0.0045, 3), i === 5 ? '#ff5ad9' : '#ffc960');
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
      b.add('glow', ico(0.015, 0, [n.x, n.y, n.z]), '#9ff5e2');
      return n;
    };
    node(0, 12, 0);
    Y.forEach((y, i) => b.add('glow', octa(0.012, [0, y, 0]), EN[i][1]));
  });

  // ================================================================ the PET story (pet)

  add('pet.scan', 'PET/CT scanner', 'A glossy white scanner with its ring-shaped gantry, the blue band round the bore and the couch that slides the patient in.', b => {
    const W = 0.29, B = 0.06, TOP = 0.66, BC = 0.36, sh = new T.Shape();
    sh.moveTo(-W + 0.05, B); sh.lineTo(W - 0.05, B); sh.quadraticCurveTo(W, B, W, B + 0.05);
    sh.lineTo(W, TOP - 0.17); sh.quadraticCurveTo(W, TOP, 0, TOP); sh.quadraticCurveTo(-W, TOP, -W, TOP - 0.17);
    sh.lineTo(-W, B + 0.05); sh.quadraticCurveTo(-W, B, -W + 0.05, B);
    const hole = new T.Path(); hole.absarc(0, BC, 0.15, 0, Math.PI * 2, true); sh.holes.push(hole);
    b.add('shiny', at(new T.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.018, bevelSegments: 1, curveSegments: 5 }), [0, 0, -0.2]), '#eef1f5');
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
    const sh = new T.Shape(OUT.map(q => new T.Vector2(q[0], q[1])));
    b.add('glass', at(new T.ExtrudeGeometry(sh, { depth: D, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 2 }), [0, Y0, -D / 2]), '#f97316');
    const inside = (x, y) => { let c = false; for (let i = 0, j = OUT.length - 1; i < OUT.length; j = i++) { const [xi, yi] = OUT[i], [xj, yj] = OUT[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const P = [], V = [];
    while (P.length < 46) {
      const x = -0.42 + 0.86 * r(), y = -0.1 + 0.42 * r(), z = (r() - 0.5) * (D + 0.04);
      if (!inside(x, y) || !inside(x + 0.04, y) || !inside(x - 0.04, y) || !inside(x, y + 0.04) || !inside(x, y - 0.04)) continue;
      const v = 0.45 + 0.18 * Math.sin(5 * x + 2) * Math.cos(6 * y) + (x < -0.2 && y > 0.12 ? 0.22 : 0) + 0.12 * r();
      P.push([x, Y0 + y, z]); V.push(v);
      b.add('glow', octa(0.014, [x, Y0 + y, z]), ramp(IRON, Math.min(1, v)));
    }
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++)
      if (dist(P[i], P[j]) < 0.115 && Math.abs(V[i] - V[j]) > 0.06) b.add('soft', rod(P[i], P[j], 0.003, 0.003, 3), V[i] > V[j] ? '#ffb46a' : '#ff8a4a');
    b.add('soft', sph(0.04, 6, 4, [-0.13, Y0 - 0.07, D / 2 + 0.02], [0.8, 1.2, 0.8]), '#6c9a46');   // gallbladder
  });

  // ================================================================ the microanatomy story (micro)

  add('micro.slide', 'Section in tiles', 'A tissue section cut into tiles, coloured by the domains a network of neighbouring tiles finds in it.', b => {
    const zc = x => 0.05 * Math.sin(x * 2.4) + 0.01, slope = x => 0.12 * Math.cos(x * 2.4), Y0 = 0.02;
    const DOM = [['#52a83c', 0.034], ['#1c7a3c', 0.044], ['#9b2b22', 0.04], ['#b8741f', 0.056]], W = [-0.105, -0.035, 0.035, 0.105];
    b.add('glass', box(1.0, 0.02, 0.4, [0, 0.01, 0]), '#cfe8f0');
    const top = {}, r = rng(3);
    for (let c = 0; c < 12; c++) for (let w = 0; w < 4; w++) {
      if ((c === 0 || c === 11) && (w === 0 || w === 3)) continue;
      const x = -0.44 + c * 0.08, z = zc(x) + W[w], [colour, h0] = DOM[w], h = h0 + 0.006 * r();
      b.add('soft', box(0.072, h, 0.066, [x, Y0 + h / 2, z], [0, -Math.atan(slope(x)), 0]), w === 3 && c === 4 ? '#1a78b6' : colour);
      top[c + ',' + w] = [x, Y0 + 0.13, z];
    }
    const N = Object.keys(top).filter(k => +k.split(',')[0] % 2 === 0);
    for (const k of N) {
      const [c, w] = k.split(',').map(Number), p = top[k], colour = mix(w === 3 && c === 4 ? '#1a78b6' : DOM[w][0], '#ffffff', 0.4);
      b.add('glow', octa(0.013, p), colour);
      for (const q of [(c + 2) + ',' + w, c + ',' + (w + 1)]) if (top[q] && N.includes(q)) b.add('soft', rod(p, top[q], 0.0028, 0.0028, 3), '#cfe6ff');
    }
  });

  add('micro.atlas', 'Slide library', 'A curved wall of glass slides with their tissue on shelves, one shelf for each decade of age.', b => {
    const r = rng(14), RC = 1.0, A = 0.48, SH = [0.0, 0.17, 0.34, 0.51, 0.68], TIS = ['#d986b0', '#b46aa8', '#e8a0a0', '#c45a7a', '#d79a6a', '#a77bd0'];
    const back = at(new T.CylinderGeometry(RC, RC, 0.8, 12, 2, true, Math.PI - A, 2 * A), [0, 0.4, RC]);
    b.add('two', back, (x, y) => mix('#0e2140', '#284a80', (1 - Math.abs(x) / 0.5) * (1 - Math.abs(y - 0.4) / 0.4)));
    for (const y of SH) {
      b.add('solid', at(new T.RingGeometry(RC - 0.07, RC, 12, 1, Math.PI / 2 - A, 2 * A), [0, y, RC], [-Math.PI / 2, 0, 0]), '#122440');
      b.add('glow', at(new T.CylinderGeometry(RC - 0.07, RC - 0.07, 0.008, 12, 1, true, Math.PI - A, 2 * A), [0, y + 0.004, RC]), '#5f8fd0');   // the shelf's bright lip
    }
    for (const f of [-0.32, -0.16, 0.16, 0.32]) b.add('solid', box(0.012, 0.68, 0.05, [(RC - 0.035) * Math.sin(f), 0.34, RC - (RC - 0.035) * Math.cos(f)], [0, -f, 0]), '#0b1626');
    for (let k = 0; k < 4; k++) for (let j = 0; j < 13; j++) {
      const f = -0.44 + j * 0.88 / 12 + (r() - 0.5) * 0.01, R = RC - 0.035, yc = SH[k] + 0.065, tis = TIS[Math.floor(j / 13 * 6)];
      b.add('soft', at(new T.BoxGeometry(0.042, 0.1, 0.007), [R * Math.sin(f), yc, RC - R * Math.cos(f)], [(r() - 0.5) * 0.15, -f + (r() - 0.5) * 0.25, (r() - 0.5) * 0.1]),
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
      pos[l].forEach(p => b.add(l === 3 ? 'glow' : 'soft', l === 3 ? octa(s, p) : ico(s, 0, p), c));
    });
    const link = (l, i, j) => { const a = pos[l][i], c = pos[l + 1][j], ca = LV[l][2], cc = LV[l + 1][2];
      b.add('soft', rod(a, c, 0.004, 0.004, 3), (x, y) => mix(cc, ca, (y - c[1]) / (a[1] - c[1]))); };
    for (let i = 0; i < 10; i++) { link(0, i, Math.round(i * 0.8) % 8); if (i % 3 === 0) link(0, i, (Math.round(i * 0.8) + 1) % 8); }
    for (let i = 0; i < 8; i++) { link(1, i, Math.floor(i * 5 / 8)); if (i % 2) link(1, i, (Math.floor(i * 5 / 8) + 2) % 5); }
    for (let i = 0; i < 14; i++) link(2, Math.min(4, Math.floor(i / 3)), i);
  });

  add('micro.organs', 'Organ models', 'Small 3D models of the organs the slides come from: a heart, a kidney and a brain.', b => {
    plinth(b, 0.42);
    const H = [-0.18, 0.04, 0.1];                                                   // the heart, apex down and to its left
    b.add('solid', lathe([[0, 0], [0.04, 0.025], [0.09, 0.08], [0.12, 0.15], [0.12, 0.21], [0.09, 0.26], [0, 0.28]], 8, add3(H, [0, 0.02, 0]), [1, 1, 0.85], [0, 0, 0.35]), '#c23a44');
    b.add('solid', sph(0.06, 6, 4, add3(H, [-0.03, 0.27, -0.02])), '#b33748');
    b.add('solid', sph(0.055, 6, 4, add3(H, [0.08, 0.25, -0.03])), '#b33748');
    b.add('solid', tube([add3(H, [0.02, 0.24, 0.03]), add3(H, [0.03, 0.36, 0.02]), add3(H, [0.1, 0.39, 0]), add3(H, [0.15, 0.32, -0.03])], 8, 0.03, 5), '#dd5a61');
    for (const d of [-0.015, 0.03, 0.07]) b.add('solid', rod(add3(H, [d + 0.03, 0.37, 0.01]), add3(H, [d + 0.03, 0.44, 0.01]), 0.012, 0.01, 6), '#efe2d2');
    b.add('solid', rod(add3(H, [-0.09, 0.2, 0.03]), add3(H, [-0.1, 0.37, 0.02]), 0.025, 0.025, 6, false), '#6d77d6');
    const K = [0.2, 0.04, 0.1];                                                      // the kidney, a bean on end
    b.add('solid', tor(0.075, 0.058, 6, 10, add3(K, [0.0, 0.15, 0]), [0, 0, Math.PI * 0.4], Math.PI * 1.2), '#9d3b37');
    for (const a of [Math.PI * 0.4, Math.PI * 1.6]) b.add('solid', sph(0.058, 6, 4, add3(K, [0.075 * Math.cos(a), 0.15 + 0.075 * Math.sin(a), 0])), '#9d3b37');
    b.add('solid', tube([add3(K, [-0.055, 0.13, 0.01]), add3(K, [-0.09, 0.08, 0.02]), add3(K, [-0.08, 0.0, 0.03])], 6, 0.01, 3), '#e8d2ad');
    const Bn = [0.0, 0.04, -0.16], r = rng(21);                                       // the brain, two hemispheres
    for (const s of [-1, 1]) b.add('solid', sph(0.14, 9, 6, add3(Bn, [0.038 * s, 0.17, 0]), [0.48, 0.72, 1]), () => mix('#e8b2b7', '#c98c95', r() * 0.6));
    b.add('solid', sph(0.06, 6, 4, add3(Bn, [0, 0.09, -0.1]), [1.3, 0.7, 0.9]), '#d49ba3');
    b.add('solid', rod(add3(Bn, [0, 0.11, -0.03]), add3(Bn, [0, 0.0, -0.04]), 0.022, 0.016, 6, false), '#e6c2b6');
  });
})();
