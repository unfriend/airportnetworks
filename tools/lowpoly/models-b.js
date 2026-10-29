// Low-poly miniatures of the stories' sets, batch b: the aging ovary, qubits, mutation, tissue topology, pass, flock and
// robot gang stories' sets and the three hand-written stories' scenes (airports, proteins, spatial). They stand on the
// design room's table, and a story's main one is its station icon above the ring.
// Each entry of LOWPOLY_MODELS['<story>.<set>'] is { story, set, name, shows, build(THREE) -> THREE.Group, tris }:
// the group is centred on x and z, stands on y = 0 and fits a 1 x 1 x 1 box (the caller scales it). Built from simple
// shapes coloured per face (vertex colours), merged into one mesh per material (at most six), in the props' own
// colours (their manifests and code). three.js r128 only; nothing else is loaded. Harness: harness-b.html.
var LOWPOLY_MODELS = LOWPOLY_MODELS || {};
(function () {
  // ------------------------------------------------------------------ kit
  const rng = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const PI = Math.PI;
  // emissive in the part's own colour (the props glow in their colours, not white)
  const glowify = m => { m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n  totalEmissiveRadiance *= vColor.rgb;\n#endif'); }; return m; };
  const MAT = {
    mat: T => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.04 }),
    gloss: T => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.12 }),
    flat: T => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: T.DoubleSide }),   // strips, fins, faces
    glow: T => glowify(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.6, side: T.DoubleSide })),
    glass: T => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide }),
    veil: T => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.15, depthWrite: false, side: T.DoubleSide }),
  };
  const ORDER = ['mat', 'gloss', 'flat', 'glow', 'glass', 'veil'];   // opaque first; see-through last

  const smooth = f => (f.smooth = true, f);   // a colour function asked per vertex instead of per triangle
  // Mini(T, r): add(kind, geometry, colour, at, rot, scale) collects parts per material; frame(at, rot, scale) sets a
  // parent transform for the parts that follow (frame() clears it); done() merges, fits the unit box, returns the group.
  // A colour is a hex string, [r, g, b] or a function (centroid, normal, local centroid) -> colour, asked per triangle
  // (or per vertex when wrapped in smooth()).
  function Mini(T, r) {
    const parts = {}, P = new T.Matrix4(), L = new T.Matrix4(), W = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), C = new T.Color();
    const pa = new T.Vector3(), ps = new T.Vector3(), cache = new Map();
    const m4 = (at, rot, sc, out) => out.compose(at ? pa.set(at[0], at[1], at[2]) : pa.set(0, 0, 0), q.setFromEuler(rot ? e.set(rot[0], rot[1], rot[2], rot[3] || 'XYZ') : e.set(0, 0, 0)), typeof sc === 'number' ? ps.set(sc, sc, sc) : sc ? ps.set(sc[0], sc[1], sc[2]) : ps.set(1, 1, 1));
    const rgb = c => { if (Array.isArray(c)) return c; let v = cache.get(c); if (!v) { C.set(c); cache.set(c, v = [C.r, C.g, C.b]); } return v; };
    const M = {
      r, rgb,
      frame(at, rot, sc) { if (at === undefined) P.identity(); else m4(at, rot, sc, P); },
      jit: (c, a) => () => { const v = rgb(c), d = (r() - 0.5) * a; return [v[0] + d, v[1] + d, v[2] + d]; },
      add(kind, g, col, at, rot, sc) {
        g = g.index ? g.toNonIndexed() : g.clone();
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        if (!g.attributes.normal) g.computeVertexNormals();
        const p = g.attributes.position, n = p.count, loc = typeof col === 'function' ? p.array.slice() : null;
        g.applyMatrix4(W.multiplyMatrices(P, m4(at, rot, sc, L)));
        const c = new Float32Array(n * 3), a = p.array;
        if (loc && col.smooth) {   // per vertex: soft gradients (a sky)
          const w = new T.Vector3(), lc = new T.Vector3(), nn = new T.Vector3(), na = g.attributes.normal.array;
          for (let i = 0; i < n; i++) { const j = i * 3; c.set(rgb(col(w.fromArray(a, j), nn.fromArray(na, j), lc.fromArray(loc, j))), j); }
        } else if (loc) {
          const w = new T.Vector3(), lc = new T.Vector3(), u = new T.Vector3(), nn = new T.Vector3();
          for (let i = 0; i < n; i += 3) {
            const j = i * 3;
            w.set((a[j] + a[j + 3] + a[j + 6]) / 3, (a[j + 1] + a[j + 4] + a[j + 7]) / 3, (a[j + 2] + a[j + 5] + a[j + 8]) / 3);
            lc.set((loc[j] + loc[j + 3] + loc[j + 6]) / 3, (loc[j + 1] + loc[j + 4] + loc[j + 7]) / 3, (loc[j + 2] + loc[j + 5] + loc[j + 8]) / 3);
            u.set(a[j + 3] - a[j], a[j + 4] - a[j + 1], a[j + 5] - a[j + 2]); nn.set(a[j + 6] - a[j], a[j + 7] - a[j + 1], a[j + 8] - a[j + 2]);
            nn.crossVectors(u, nn).normalize();
            const v = rgb(col(w, nn, lc));
            c.set(v, j); c.set(v, j + 3); c.set(v, j + 6);
          }
        } else { const v = rgb(col); for (let i = 0; i < n; i++) c.set(v, 3 * i); }
        g.userData.c = c;
        (parts[kind] = parts[kind] || []).push(g);
      },
      done() {
        const box = new T.Box3();
        for (const k in parts) for (const g of parts[k]) { g.computeBoundingBox(); box.union(g.boundingBox); }
        const s = 1 / Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
        const fit = new T.Matrix4().makeScale(s, s, s).multiply(new T.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
        const grp = new T.Group();
        for (const k of ORDER) {
          if (!parts[k]) continue;
          let n = 0, o = 0;
          for (const g of parts[k]) n += g.attributes.position.count;
          const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
          for (const g of parts[k]) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); col.set(g.userData.c, o); o += g.attributes.position.count * 3; g.dispose(); }
          const geo = new T.BufferGeometry();
          geo.setAttribute('position', new T.BufferAttribute(pos, 3));
          geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
          geo.setAttribute('color', new T.BufferAttribute(col, 3));
          geo.applyMatrix4(fit);
          const mesh = new T.Mesh(geo, MAT[k](T));
          mesh.name = k;
          grp.add(mesh);
        }
        return grp;
      },
    };
    // geometry: each call makes a new one
    const V = p => new T.Vector3(p[0], p[1], p[2]);
    M.g = {
      box: (w, h, d, ws, hs, ds) => new T.BoxGeometry(w, h, d, ws, hs, ds),
      ball: (rad, d) => new T.IcosahedronGeometry(rad, d || 0),
      oct: rad => new T.OctahedronGeometry(rad, 0),
      sph: (rad, w, h, ps, pl, ts, tl) => new T.SphereGeometry(rad, w || 8, h || 6, ps, pl, ts, tl),
      cyl: (rt, rb, h, s, open, ts, tl) => new T.CylinderGeometry(rt, rb, h, s || 8, 1, !!open, ts, tl),
      cone: (rad, h, s) => new T.ConeGeometry(rad, h, s || 6, 1),
      tor: (R, rr, rs, ts, arc) => new T.TorusGeometry(R, rr, rs || 3, ts || 12, arc),
      disc: (rad, s, ts, tl) => new T.CircleGeometry(rad, s || 12, ts, tl),
      plane: (w, h, ws, hs) => new T.PlaneGeometry(w, h, ws, hs),
      curve: pts => new T.CatmullRomCurve3(pts.map(V)),
      tube: (pts, rad, seg, rs) => new T.TubeGeometry(pts.getPoint ? pts : new T.CatmullRomCurve3(pts.map(V)), seg || 8, rad, rs || 3, false),
      ext: (pts, depth) => new T.ExtrudeGeometry(new T.Shape(pts.map(p => new T.Vector2(p[0], p[1]))), { depth, bevelEnabled: false }),
      // a cylinder from a to b (radius rad, or [at a, at b]), open-ended unless caps
      rod(a, b, rad, s, caps) {
        const A = V(a), B = V(b), d = B.clone().sub(A), len = d.length(), rr = Array.isArray(rad) ? rad : [rad, rad];
        const g = new T.CylinderGeometry(rr[1], rr[0], len, s || 4, 1, !caps);
        g.applyMatrix4(new T.Matrix4().compose(A.add(B).multiplyScalar(0.5), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()), new T.Vector3(1, 1, 1)));
        return g;
      },
      mesh(xyz) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(xyz), 3)); g.computeVertexNormals(); return g; },
      tri: (a, b, c) => M.g.mesh([...a, ...b, ...c]),
      // a ribbon along points, w wide along the vector up
      strip(pts, up, w) {
        const out = [], h = up.map(v => v * w / 2);
        for (let i = 0; i < pts.length - 1; i++) {
          const a0 = add3(pts[i], h, -1), a1 = add3(pts[i], h), b0 = add3(pts[i + 1], h, -1), b1 = add3(pts[i + 1], h);
          out.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
        }
        return M.g.mesh(out);
      },
      // a gear lying flat (axis y), radius rad, n teeth
      gear(rad, n, depth) {
        const pts = [];
        for (let i = 0; i < n; i++) for (const [f, k] of [[0, 0.8], [0.18, 1], [0.5, 1], [0.68, 0.8]]) { const a = (i + f) / n * 2 * PI; pts.push([Math.cos(a) * rad * k, Math.sin(a) * rad * k]); }
        const g = new T.ExtrudeGeometry(new T.Shape(pts.map(p => new T.Vector2(p[0], p[1]))), { depth, bevelEnabled: false });
        g.rotateX(-PI / 2); return g;
      },
    };
    return M;
  }

  // ------------------------------------------------------------------ shared looks
  const NAVY = '#1b2436';   // plinths and bases: the app's dark navy
  const LET = { A: '#e69f00', C: '#56b4e9', G: '#f0e442', T: '#cc79a7' };   // the mutation story's letters
  const plinth = (M, rad, h, col) => M.add('gloss', M.g.cyl(rad, rad * 1.05, h, 12), col || NAVY, [0, h / 2, 0]);
  const ramp = (stops, x) => { x = Math.max(0, Math.min(1, x)) * (stops.length - 1); const i = Math.min(stops.length - 2, Math.floor(x)); return lerp(stops[i], stops[i + 1], x - i); };
  const hexes = a => a.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255));
  const RDBU = hexes(['#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7', '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67001f']);
  const DEG = [[0.12, 0.34, 1.0], [0.16, 0.86, 1.0], [1.0, 0.72, 0.18], [1.0, 0.42, 0.12]];   // the airports' degree ramp
  const degCol = x => x < 0.45 ? lerp(DEG[0], DEG[1], x / 0.45) : x < 0.78 ? lerp(DEG[1], DEG[2], (x - 0.45) / 0.33) : lerp(DEG[2], DEG[3], (x - 0.78) / 0.22);

  const def = (key, name, shows, tris, make) => {
    const [story, set] = key.split('.');
    let seed = 7; for (const ch of key) seed = seed * 31 + ch.charCodeAt(0) | 0;
    LOWPOLY_MODELS[key] = { story, set, name, shows, tris, build: T => { const M = Mini(T, rng(seed)); make(M, M.g, M.r); return M.done(); } };
  };

  // ================================================================== the aging ovary
  def('ovary.organ', 'Cut-away ovary', 'An ovary cut open on its hilum: cortex round the medulla, follicles, a golden corpus luteum, pale scars and coiled vessels.', 1070, (M, g) => {
    const ax = 0.95, ay = 0.55, az = 0.45, cy = 0.8, COR = '#b98ab0', MED = '#e2a3a6';
    M.add('mat', g.sph(1, 14, 8, PI, PI), M.jit('#d9adb2', 0.06), [0, cy, 0], 0, [ax, ay, az]);           // the back, intact
    M.add('mat', g.sph(1, 7, 8, 0, PI / 2), M.jit('#d9adb2', 0.06), [0, cy, 0], 0, [ax, ay, az]);         // the front left
    M.add('flat', g.disc(1, 12, -PI / 2, PI), COR, [0, cy, 0.002], 0, [ax, ay, 1]);                        // cut face: cortex
    M.add('flat', g.disc(1, 12, -PI / 2, PI), MED, [0.02, cy - 0.04, 0.005], 0, [ax * 0.68, ay * 0.6, 1]);  // and medulla
    M.add('flat', g.disc(1, 8, PI / 2, PI), COR, [0.002, cy, 0], [0, PI / 2, 0], [az, ay, 1]);             // the side wall
    M.add('flat', g.disc(1, 8, PI / 2, PI), MED, [0.005, cy - 0.04, 0], [0, PI / 2, 0], [az * 0.6, ay * 0.6, 1]);
    for (const [x, y, rr] of [[0.55, 0.2, 0.13], [0.8, 0.03, 0.085], [0.32, -0.3, 0.09], [0.22, 0.35, 0.07]]) {   // antral follicles
      M.add('gloss', g.disc(rr, 10), '#c4ccff', [x, cy + y, 0.008]);
      M.add('mat', g.tor(rr, 0.022, 3, 8), '#8e66b8', [x, cy + y, 0.01]);
      M.add('gloss', g.ball(rr * 0.3), '#f4b3cb', [x + rr * 0.45, cy + y - rr * 0.35, 0.03]);
    }
    for (const t of [-1.35, -0.6, 0.95, 1.4]) M.add('mat', g.ball(0.035), '#8e66b8', [0.86 * ax * Math.cos(t), cy + 0.86 * ay * Math.sin(t), 0.005]);
    M.add('gloss', g.ball(1, 1), M.jit('#f0b545', 0.14), [0.62, cy - 0.3, 0.02], 0, [0.13, 0.11, 0.06]);    // corpus luteum
    M.add('mat', g.ball(1), M.jit('#d8bccb', 0.06), [0.12, cy - 0.42, 0.01], 0, [0.08, 0.06, 0.03]);       // corpora albicantia
    M.add('mat', g.ball(1), M.jit('#d8bccb', 0.06), [0.42, cy + 0.4, 0.01], 0, [0.07, 0.05, 0.03]);
    const z = 0.022;
    M.add('gloss', g.tube([[0.12, cy - 0.64, z], [0.14, cy - 0.4, z], [0.08, cy - 0.15, z], [0.22, cy + 0.05, z], [0.42, cy + 0.03, z]], 0.018, 10), '#c0353f');
    M.add('gloss', g.tube([[0.13, cy - 0.33, z], [0.3, cy - 0.2, z], [0.48, cy - 0.12, z]], 0.014, 6), '#c0353f');
    M.add('gloss', g.tube([[0.04, cy - 0.64, z], [0.03, cy - 0.3, z], [0.06, cy, z], [0.12, cy + 0.22, z]], 0.016, 8), '#59649e');
    M.add('mat', g.cyl(0.09, 0.14, 0.3, 8), '#c46a6e', [0.08, 0.17, 0]);   // the hilum
    plinth(M, 0.34, 0.04);
  });

  def('ovary.section', 'Ovary section', 'A drawn H&E section in relief: eosin-pink stroma with follicles, vessels, macrophages, corpora albicantia and a cyst.', 1016, (M, g, r) => {
    const out = [], inn = [];
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * 2 * PI, k = 1 + 0.06 * Math.sin(3 * a + 0.4) + 0.04 * Math.cos(5 * a);
      out.push([0.95 * k * Math.cos(a), 0.75 * k * Math.sin(a)]); inn.push([0.05 + 0.55 * k * Math.cos(a), -0.05 + 0.42 * k * Math.sin(a)]);
    }
    M.frame([0, 0.8, 0], [-0.25, 0, 0]);   // leaning back on its stand
    M.add('mat', g.ext(out, 0.04), M.jit('#e88bb0', 0.07));                // cortex, denser at the rim
    M.add('mat', g.ext(inn, 0.046), M.jit('#f3b9cf', 0.05));               // medulla, paler
    const F = 0.05;
    for (const [x, y, rr] of [[-0.5, 0.3, 0.15], [0.4, 0.38, 0.11], [-0.1, -0.5, 0.09]]) {   // antral follicles
      M.add('gloss', g.disc(rr, 10), '#f7e6ef', [x, y, F]);
      M.add('mat', g.tor(rr, 0.028, 3, 10), M.jit('#8e66b8', 0.08), [x, y, F]);
      M.add('gloss', g.ball(rr * 0.28), '#f4b3cb', [x + rr * 0.42, y - rr * 0.3, F + 0.02]);
    }
    for (const [x, y] of [[0.68, -0.05], [-0.76, -0.2], [0.05, 0.52]]) {   // secondary follicles
      M.add('mat', g.ball(0.06), M.jit('#8e66b8', 0.08), [x, y, F], 0, [1, 1, 0.55]);
      M.add('gloss', g.ball(0.022), '#fbe8f1', [x, y, F + 0.035]);
    }
    for (const [x, y] of [[0, 0], [0.45, -0.42], [-0.42, -0.22], [0.25, -0.08]]) {   // blood vessels: a wall round a pale lumen
      M.add('mat', g.tor(0.045, 0.017, 3, 8), '#c0353f', [x, y, F], 0, [1.35, 1, 1]);
      M.add('gloss', g.disc(0.04, 6), '#fbf4f7', [x, y, F - 0.002], 0, [1.3, 0.95, 1]);
    }
    for (const [x, y, s] of [[0.15, 0.25, 0.13], [0.62, -0.25, 0.11]]) M.add('mat', g.ball(1), M.jit('#d6b3d6', 0.08), [x, y, F], [0, 0, r() * 3], [s, s * 0.75, 0.035]);
    M.add('gloss', g.disc(0.09, 10), '#fbf4f7', [-0.64, 0.02, F]);   // a cyst
    M.add('mat', g.tor(0.09, 0.01, 3, 10), '#f0d9a8', [-0.64, 0.02, F]);
    for (const [x, y] of [[-0.25, 0.1], [0.2, -0.28], [0.75, 0.3], [-0.35, -0.45], [-0.05, 0.36], [0.55, 0.12]]) M.add('gloss', g.ball(0.026), '#8a5a3e', [x, y, F]);
    M.frame();
    M.add('gloss', g.box(1.5, 0.08, 0.36), NAVY, [0, 0.04, 0]);
  });

  def('ovary.charts', 'Donors histogram', 'The donors\' glass slides stacked into the age histogram, 20 bars from 21 to 70, in front of its backdrop.', 1080, (M, g) => {
    const counts = [9, 6, 10, 5, 7, 6, 3, 5, 13, 10, 9, 25, 15, 25, 15, 14, 12, 21, 25, 20];   // OVARY_DATA.hist
    const slide = (w, nn) => nn.y > 0.5 ? '#efcfe0' : '#e3ebf7';   // the tissue shows from above, the glass from the side
    counts.forEach((c, i) => { for (let k = 0; k < Math.max(1, Math.round(c / 3)); k++) M.add('gloss', g.box(0.082, 0.045, 0.16), slide, [-0.95 + i * 0.1, 0.0925 + k * 0.062, 0]); });
    M.add('mat', g.box(2.08, 0.75, 0.03), '#141c2c', [0, 0.445, -0.14]);
    for (let k = 0; k < 4; k++) M.add('glow', g.box(2.0, 0.008, 0.01), '#34405a', [0, 0.22 + k * 0.15, -0.12]);
    M.add('gloss', g.box(2.12, 0.07, 0.38), NAVY, [0, 0.035, -0.02]);
  });

  // ================================================================== qubits
  def('qubits.pairs', 'City map and chip', 'The gene network as a city map with two amber valleys, two walkers settled in them as a pair, and the three-qubit chip.', 1052, (M, g, r) => {
    const V1 = [-0.5, -0.35], V2 = [0.55, 0.4], Y0 = 0.32;
    const h = (x, z) => Y0 - 0.2 * Math.exp(-((x - V1[0]) ** 2 + (z - V1[1]) ** 2) / 0.09) - 0.2 * Math.exp(-((x - V2[0]) ** 2 + (z - V2[1]) ** 2) / 0.09) + 0.012 * Math.sin(7 * x) * Math.cos(6 * z);
    const ground = g.plane(2, 2, 10, 10); ground.rotateX(-PI / 2);
    const gp = ground.attributes.position; for (let i = 0; i < gp.count; i++) gp.setY(i, h(gp.getX(i), gp.getZ(i))); ground.computeVertexNormals();
    M.add('glow', ground, w => lerp(M.rgb('#1a2238'), M.rgb('#e0b54e'), Math.min(1, Math.max(0, (Y0 - w.y) / 0.17)) ** 1.5));   // valleys glow amber
    for (const [x, z, sx, sz] of [[0, 1.01, 2.04, 0.02], [0, -1.01, 2.04, 0.02], [1.01, 0, 0.02, 2], [-1.01, 0, 0.02, 2]]) M.add('mat', g.box(sx, Y0, sz), '#2a3552', [x, Y0 / 2, z]);
    const N = [];
    for (let i = 0; i < 40; i++) {   // genes: some gathered round the valleys, the rest across the map
      const c = i < 10 ? V1 : i < 20 ? V2 : [(r() - 0.5) * 1.7, (r() - 0.5) * 1.7], s = i < 20 ? 0.3 : 0;
      const x = Math.max(-0.92, Math.min(0.92, c[0] + (r() - 0.5) * 2 * s)), z = Math.max(-0.92, Math.min(0.92, c[1] + (r() - 0.5) * 2 * s));
      N.push([x, h(x, z) + 0.03, z]);
      M.add('glow', g.oct(0.045), '#c9d2ff', N[i]);
    }
    const seen = new Set();
    N.forEach((p, i) => N.map((q, j) => [j, (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2]).filter(d => d[0] !== i).sort((a, b) => a[1] - b[1]).slice(0, 2).forEach(([j]) => {
      const k = Math.min(i, j) + ',' + Math.max(i, j); if (seen.has(k) || seen.size >= 32) return; seen.add(k);
      M.add('glow', g.rod(p, N[j], 0.008, 3), '#8a93e8');
    }));
    const W1 = [V1[0], h(V1[0], V1[1]) + 0.07, V1[1]], W2 = [V2[0], h(V2[0], V2[1]) + 0.07, V2[1]];
    M.add('glow', g.ball(0.07), '#ff5ad9', W1); M.add('glow', g.ball(0.07), '#46d9ff', W2);
    M.add('glow', g.tube([W1, [0.02, 0.85, 0.02], W2], 0.014, 14), '#ffb43b');   // the pair
    M.add('mat', g.box(0.5, 0.3, 0.5), '#1e2433', [1.4, 0.15, 0.55]);            // the chip on its block
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) M.add('gloss', g.box(0.05, 0.02, 0.07), '#d9b45a', [1.24 + k * 0.105, 0.31, 0.55 + s * 0.27]);
    for (let k = 0; k < 3; k++) M.add('glow', g.ball(0.06), '#9a90ff', [1.27 + k * 0.13, 0.37, 0.55]);
  });

  def('qubits.cube', 'Coarse operator cube', 'The coarse operator on a cube: eight neighbourhoods at the corners in their colours, a loop at each, and couplings as purple edges.', 824, (M, g, r) => {
    const CELL = ['#46d9ff', '#3ee08f', '#ffd166', '#ff8fd8', '#b9a6ff', '#7df0c8', '#ff9e6b', '#8fb8ff'];   // QMATH.CELL_COLORS
    const P = [];
    for (let c = 0; c < 8; c++) P.push([c & 4 ? 0.8 : -0.8, c & 1 ? 0.17 : 1.77, c & 2 ? -0.8 : 0.8]);   // left/right, front/back, top/bottom
    for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {   // an edge between every two corners, as wide as their coupling
      const d = [1, 2, 4].filter(k => (a ^ b) & k).length;
      M.add('glow', g.rod(P[a], P[b], [0.032, 0.017, 0.009][d - 1] * (0.6 + 0.7 * r()), 5), '#9a90ff');
    }
    P.forEach((p, c) => {
      const s = [Math.sign(p[0]), p[1] > 1 ? 1 : -1, Math.sign(p[2])];
      M.add('gloss', g.ball(0.14), CELL[c], p);
      M.add('glow', g.tor(0.11, 0.02, 3, 8), CELL[c], add3(p, s, 0.13), [0, Math.atan2(s[0], s[2]) + PI / 2, 0]);
    });
  });

  def('qubits.chart', 'Residual chart and circuit', 'The residual by depth, our cuts in cyan under the random ones in grey, beside the three-wire circuit of six gates.', 740, (M, g) => {
    const ours = [0, 0.44, 0.52, 0.56, 0.68, 0.74, 0.81, 0.88], rand = [0, 0.57, 0.75, 0.86, 0.92, 0.95, 0.97, 0.99];   // QUBITS_DATA.residual
    const X = b => -1.0 + b * 0.18, Y = v => 0.24 + v * 0.85;
    M.add('mat', g.box(1.62, 1.18, 0.03), '#121a2a', [-0.37, 0.7, -0.06]);
    for (let k = 0; k <= 4; k++) M.add('glow', g.box(1.45, 0.008, 0.01), '#34405a', [-0.37, Y(k / 4), -0.04]);
    const ser = (v, z, col, rad) => { const pts = v.map((y, b) => [X(b), Y(y), z]); M.add('glow', g.tube(pts, rad, 14), col); pts.forEach(p => M.add('glow', g.ball(0.028), col, p)); };
    ser(rand, -0.01, '#8e98ab', 0.01);
    ser(ours, 0.03, '#46d9ff', 0.014);
    M.add('mat', g.box(0.64, 1.18, 0.03), '#121a2a', [0.9, 0.7, -0.06]);
    const wx = [0.72, 0.9, 1.08];   // q2, q1, q0; time runs down
    wx.forEach(x => { M.add('glow', g.rod([x, 0.16, 0], [x, 1.22, 0], 0.008, 4), '#8e98ab'); M.add('glow', g.ball(0.022), '#46d9ff', [x, 0.42 + x * 0.3, 0.012]); });
    wx.forEach(x => M.add('gloss', g.box(0.12, 0.09, 0.05), '#ff5a4b', [x, 1.06, 0]));     // RX on each wire
    M.add('gloss', g.box(0.3, 0.09, 0.05), '#4d94ff', [0.81, 0.82, 0]);                     // RZZ q2 q1
    M.add('gloss', g.box(0.3, 0.09, 0.05), '#4d94ff', [0.99, 0.58, 0]);                     // RZZ q1 q0
    M.add('gloss', g.box(0.12, 0.09, 0.05), '#4d94ff', [0.72, 0.34, 0]);                    // RZ q2
    M.add('gloss', g.box(2.5, 0.08, 0.38), NAVY, [-0.07, 0.04, -0.02]);
  });

  // ================================================================== the mutation machine
  def('mutation.letters', 'DNA helix and letters', 'A double helix with rungs in the four letters\' colours, the ancestor\'s eight letter tiles, and a letter opened into its two qubits.', 1036, (M, g) => {
    const R = 0.28, cy = 0.62, turn = 2 * PI / 10.5, n = 16, off = 140 / 180 * PI;   // B-DNA: 10.5 pairs a turn, grooves
    const at = (x, a) => [x, cy + R * Math.cos(a), R * Math.sin(a)];
    const s1 = [], s2 = [];
    for (let i = 0; i <= 24; i++) { const u = i / 24, x = -1 + 2 * u, a = u * n * turn; s1.push(at(x, a)); s2.push(at(x, a + off)); }
    M.add('gloss', g.tube(s1, 0.035, 28, 4), '#9fb6d6'); M.add('gloss', g.tube(s2, 0.035, 28, 4), '#9fb6d6');
    const top = 'GTCAACGTTAGCATGC', pair = { A: 'T', T: 'A', C: 'G', G: 'C' };   // the ancestor ACGTTAGC in the middle
    for (let k = 0; k < n; k++) {
      const x = -1 + 2 * (k + 0.5) / n, a = (k + 0.5) / n * n * turn, p = at(x, a), q = at(x, a + off), m = lerp(p, q, 0.5);
      M.add('glow', g.rod(p, m, 0.022, 4), LET[top[k]]); M.add('glow', g.rod(m, q, 0.022, 4), LET[pair[top[k]]]);
    }
    'ACGTTAGC'.split('').forEach((c, i) => M.add('gloss', g.box(0.18, 0.18, 0.05), LET[c], [-0.77 + i * 0.22, 0.14, 0.66]));
    for (const [x, up] of [[-0.86, 1], [-0.62, -1]]) {   // the first letter's two qubits: arrow up for 0, down for 1
      M.add('glass', g.sph(0.1, 8, 6), '#8cc6ff', [x, 0.42, 0.66]);
      M.add('glow', g.rod([x, 0.42 - up * 0.06, 0.66], [x, 0.42 + up * 0.04, 0.66], 0.012, 4), '#46d9ff');
      M.add('glow', g.cone(0.028, 0.05, 4), '#46d9ff', [x, 0.42 + up * 0.065, 0.66], [up > 0 ? 0 : PI, 0, 0]);
    }
    M.add('gloss', g.box(2.3, 0.05, 1.0), NAVY, [0, 0.025, 0.28]);
    for (const x of [-1.08, 1.08]) M.add('gloss', g.rod([x, 0.05, 0], [x, cy, 0], 0.022, 6), NAVY);
  });

  def('mutation.tree', 'Family tree in 3D', 'The family tree grown up out of its root in all directions: glass branches with a machine gear on each first branch and the tips\' new sequences.', 1064, (M, g, r) => {
    const root = [0, 0.1, 0], nodes = [], pos = (az, rad, y) => [rad * Math.sin(az), y, rad * Math.cos(az)];
    const branch = (P, Q, rad, letter) => {
      const mid = [P[0] + (Q[0] - P[0]) * 0.3, P[1] + (Q[1] - P[1]) * 0.7, P[2] + (Q[2] - P[2]) * 0.3];   // up first, then out
      const c = g.curve([P, mid, Q]);
      M.add('glow', g.tube(c, rad, 5, 4), '#6cb4ee');
      if (letter) { const a = c.getPoint(0.5), b = c.getPoint(0.6); M.add('glow', g.rod([a.x, a.y, a.z], [b.x, b.y, b.z], rad + 0.012, 6), LET[letter]); }
      return c;
    };
    const L1 = [0.33, 0.33 + PI].map((az, i) => pos(az, 0.22, 0.48 + 0.1 * i));
    L1.forEach((q, i) => {
      const c = branch(root, q, 0.05, i ? 'G' : null), p = c.getPoint(0.55);
      M.add('glow', g.gear(0.1, 8, 0.03), '#0072b2', [p.x, p.y - 0.015, p.z]);   // one machine per branch
      [-0.78, 0.78].forEach((d, j) => {
        const az = [0.33, 0.33 + PI][i] + d, q2 = pos(az, 0.52, q[1] + 0.3 + 0.15 * r());
        branch(q, q2, 0.035, (i + j) % 3 === 1 ? 'T' : null);
        [-0.39, 0.39].forEach((d2, k) => {
          const a3 = az + d2, tip = pos(a3, 0.8, q2[1] + 0.25 + 0.32 * r());
          branch(q2, tip, 0.024, (i + j + k) % 4 === 0 ? 'C' : null);
          nodes.push([tip, a3]);
        });
      });
    });
    const seqs = ['ACGT', 'ACGC', 'GCGT', 'ACAT', 'TCGT', 'ACGG', 'ATGT', 'CCGT'];
    nodes.forEach(([p, az], i) => M.add('flat', g.plane(0.24, 0.065, 4, 1), w => { const u = (w.x - p[0]) * Math.cos(az) - (w.z - p[2]) * Math.sin(az); return LET[seqs[i][Math.max(0, Math.min(3, Math.floor((u + 0.12) / 0.06)))]]; }, [p[0], p[1] + 0.07, p[2]], [0, az, 0]));
    'ACGTTAGC'.split('').forEach((c, i) => { const a = -1.2 + i * 0.34; M.add('gloss', g.box(0.07, 0.07, 0.02), LET[c], [0.27 * Math.sin(a), 0.1, 0.27 * Math.cos(a)], [0, a, 0]); });
    plinth(M, 0.4, 0.05);
  });

  def('mutation.rule', 'Pyramid of mixes', 'The four letters at the corners of a glass pyramid, the mix gliding along its green path to the long-run mix, on the compiler drum.', 952, (M, g) => {
    const lift = 0.62, C = [[0, 0.98, 0], [-0.8, -0.327, 0.462], [0, -0.327, -0.924], [0.8, -0.327, 0.462]].map(p => [p[0], p[1] + lift, p[2]]);   // MMATH.CORNERS: A, C, G, T
    const L = 'ACGT', cen = lerp(lerp(C[0], C[1], 0.5), lerp(C[2], C[3], 0.5), 0.5);
    [0.17, 0.15, 0.16, 0.14].forEach((rad, i) => M.add('gloss', g.ball(rad, 1), LET[L[i]], C[i]));   // as big as each letter's long-run share
    for (const [a, b, c] of [[0, 1, 3], [0, 3, 2], [0, 2, 1], [1, 2, 3]]) M.add('glass', g.tri(C[a], C[b], C[c]), '#8cc6ff');
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) M.add('glow', g.rod(C[a], C[b], 0.018, 6), '#4fb0ff');
    const P = [lerp(C[1], cen, 0.15), lerp(lerp(C[1], C[0], 0.3), cen, 0.45), lerp(cen, C[0], 0.2), add3(cen, [0.06, -0.05, 0.04])];
    M.add('glow', g.tube(P, 0.016, 12), '#3fd6a6');   // the path, a bright green trail
    for (const p of [P[1], P[2]]) M.add('glow', g.tor(0.05, 0.008, 3, 8), '#f2f6ff', p);
    M.add('glow', g.tor(0.07, 0.008, 3, 10), '#46d9ff', P[3]);   // the long-run mix
    const mix = lerp(P[2], P[3], 0.4);
    M.add('glow', g.ball(0.04), '#f2f6ff', mix);
    for (let i = 0; i < 4; i++) { M.add('glow', g.tor(0.075, 0.012, 3, 3, PI / 2), LET[L[i]], mix, [0, 0, i * PI / 2]); M.add('glow', g.rod(mix, C[i], 0.004, 3), '#c6d4ea'); }
    M.add('gloss', g.cyl(0.85, 0.9, 0.2, 14), '#123563', [0, 0.1, 0]);   // the compiler's drum with its gear
    M.add('glow', g.gear(0.6, 10, 0.04), '#0072b2', [0, 0.2, 0]);
  });

  def('mutation.stem', 'RNA stem', 'An RNA strand folded back into a stem of six pairs and a loop, white rungs, and the coupling gear over the pair that changes together.', 748, (M, g) => {
    const R = 0.24, seq = 'GTTACTGAAAAGTAGT', tiles = [];
    const at = (k, side) => { const a = k * 2 * PI / 11 + side * PI; return [R * Math.cos(a), 0.22 + k * 0.2, R * Math.sin(a)]; };
    for (let k = 0; k < 6; k++) tiles.push(at(k, 0));
    const t5 = at(5, 0), b5 = at(5, 1), up = 1.38;
    tiles.push(lerp(t5, [0, up, 0], 0.55), [t5[0] * 0.5, up + 0.1, t5[2] * 0.5 + 0.12], [b5[0] * 0.5, up + 0.1, b5[2] * 0.5 + 0.12], lerp(b5, [0, up, 0], 0.55));   // the loop
    for (let k = 5; k >= 0; k--) tiles.push(at(k, 1));
    M.add('gloss', g.tube(tiles, 0.028, 40, 4), '#9fb6d6');
    tiles.forEach((p, i) => M.add('gloss', g.box(0.12, 0.12, 0.04), LET[seq[i]], [p[0] * 1.1, p[1], p[2] * 1.1], [0, Math.atan2(p[0], p[2]), 0]));
    for (let k = 0; k < 6; k++) M.add('glow', g.rod(at(k, 0), at(k, 1), 0.016, 4), '#f2f6ff');
    const c4 = lerp(at(4, 0), at(4, 1), 0.5);   // the pair that changes together: the coupling gear and its double band
    M.add('glow', g.gear(0.11, 8, 0.03), '#0072b2', [c4[0], c4[1] + 0.07, c4[2]]);
    for (const s of [-1, 1]) M.add('glow', g.rod(add3(at(4, 0), [0, s * 0.03, 0]), add3(at(4, 1), [0, s * 0.03, 0]), 0.008, 4), '#3fd6a6');
    plinth(M, 0.36, 0.05);
  });

  // ================================================================== the shape of tissue
  def('topo.slide', 'Liver on a glass slide', 'A piece of liver drawn in H&E from its cells, pink plates of hepatocytes round a white central vein, on a glass slide with its frosted label.', 622, (M, g, r) => {
    M.add('gloss', g.ext([[-0.68, 0], [0.7, 0], [0.7, 0.62], [-0.68, 0.06]], 2.5), NAVY, [-1.25, 0, 0], [0, PI / 2, 0]);   // a wedge stand that tilts it to you
    M.frame([0, 0.34, -0.04], [0.4, 0, 0]);
    M.add('glass', g.box(2.6, 0.04, 1.36), '#cfefff', [0, 0.02, 0]);
    M.add('mat', g.box(0.62, 0.044, 1.34), '#c9d3dd', [-0.98, 0.022, 0]);
    const vx = 0.55, vz = -0.05, Y = 0.044;
    const tis = g.plane(1.26, 1.26, 8, 8); tis.rotateX(-PI / 2);
    M.add('flat', tis, w => Math.hypot(w.x - vx, w.z - vz) < 0.1 ? '#fbf4f7' : lerp(M.rgb('#d4779f'), M.rgb('#e597ba'), r()), [0.6, Y, 0]);
    for (let k = 0; k < 12; k++) {   // cords of hepatocytes run out from the vein, their nuclei along them
      const a = k / 12 * 2 * PI + 0.2, d = [Math.cos(a), 0, Math.sin(a)], len = 0.42 + 0.14 * r();
      const p0 = [vx + d[0] * 0.12, Y + 0.003, vz + d[2] * 0.12], p1 = [vx + d[0] * len, Y + 0.003, vz + d[2] * len];
      M.add('flat', g.strip([p0, lerp(p0, p1, 0.5), p1], [-d[2], 0, d[0]], 0.07), '#cf7aa2');
      for (let j = 0; j < 5; j++) M.add('flat', g.disc(0.024, 6), '#3b2a7a', lerp(p0, p1, (j + 0.5) / 5).map((v, i) => i === 1 ? Y + 0.006 : v), [-PI / 2, 0, 0]);
    }
    for (let k = 0; k < 10; k++) M.add('flat', g.disc(0.018, 5), k < 6 ? '#2a1d5c' : '#d9455f', [0.02 + r() * 1.16, Y + 0.006, -0.6 + r() * 1.16], [-PI / 2, 0, 0]);   // lymphocytes and red cells
    M.frame();
  });

  def('topo.map', 'Scored cells relief', 'Every cell of the new slide scored and raised as a relief, red for cirrhosis-like and blue for healthy-like, with one cell\'s glass dome and bars.', 758, (M, g) => {
    const f = (x, z) => Math.max(-1, Math.min(1, 0.55 * Math.sin(3.1 * x + 0.7) * Math.cos(2.7 * z - 0.4) + 0.4 * Math.sin(5.3 * x + 4.1 * z) + 0.3));
    const Y0 = 0.14, H = 0.12, hy = (x, z) => Y0 + H * f(x, z), col = (x, z) => ramp(RDBU, (f(x, z) + 1) / 2);
    const rel = g.plane(1.6, 1.6, 14, 14); rel.rotateX(-PI / 2);
    const rp = rel.attributes.position; for (let i = 0; i < rp.count; i++) rp.setY(i, hy(rp.getX(i), rp.getZ(i))); rel.computeVertexNormals();
    M.add('mat', rel, w => col(w.x, w.z));
    for (const [ax, s] of [['x', -0.8], ['x', 0.8], ['z', -0.8], ['z', 0.8]]) {   // the relief's sides down to the slide
      const pts = [];
      for (let i = 0; i <= 14; i++) { const u = -0.8 + i * 1.6 / 14, x = ax === 'x' ? s : u, z = ax === 'x' ? u : s; pts.push([x, hy(x, z), z]); }
      const sk = [];
      for (let i = 0; i < 14; i++) { const a = pts[i], b = pts[i + 1], a0 = [a[0], 0.04, a[2]], b0 = [b[0], 0.04, b[2]]; sk.push(...a0, ...b0, ...a, ...a, ...b0, ...b); }
      M.add('flat', g.mesh(sk), w => lerp(col(w.x, w.z), [0.35, 0.3, 0.38], 0.45));
    }
    M.add('glass', g.box(2.1, 0.04, 1.9), '#cfefff', [0, 0.02, 0]);
    const cx = -0.2, cz = 0.3, cyy = hy(cx, cz);   // the poster's cell: its 50 um dome, its bars behind it
    M.add('glass', g.sph(0.26, 10, 4, 0, 2 * PI, 0, PI / 2), '#46d9ff', [cx, cyy, cz]);
    M.add('glow', g.tor(0.26, 0.012, 3, 14), '#46d9ff', [cx, cyy, cz], [PI / 2, 0, 0]);
    M.add('glow', g.ball(0.03), '#46d9ff', [cx, cyy + 0.02, cz]);
    [0.42, 0.3, 0.22, 0.16, 0.12].forEach((l, i) => M.add('glow', g.rod([cx - 0.12 + i * 0.05, cyy + 0.05, cz - 0.38], [cx - 0.12 + i * 0.05, cyy + 0.05 + l, cz - 0.38], 0.01, 4), '#ffb43b'));
    M.add('glow', g.cone(0.025, 0.05, 4), '#ffb43b', [cx - 0.12, cyy + 0.5, cz - 0.38]);
    [[0.12, 0.2], [0.18, 0.3]].forEach(([b, d], i) => M.add('glow', g.rod([cx + 0.17 + i * 0.05, cyy + 0.05 + b, cz - 0.38], [cx + 0.17 + i * 0.05, cyy + 0.05 + d, cz - 0.38], 0.01, 4), '#ff7a3c'));
  });

  def('topo.tower', 'Tower of scales', 'The patch\'s cells on a glass plate with their balls, and the tower above: threads joining piece by piece into one amber trunk, loops as orange rings.', 1064, (M, g, r) => {
    M.add('glass', g.box(1.5, 0.04, 1.5), '#8cc6ff', [0, 0.02, 0]);
    M.add('mat', g.box(1.5, 0.046, 0.2), '#5f7fa6', [0, 0.023, 0.68]);   // frosted label, tinted as the healthy slides
    const cells = [];
    while (cells.length < 16) { const p = [(r() - 0.5) * 1.2, (r() - 0.5) * 1.05 - 0.08]; if (cells.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.17)) cells.push(p); }
    const PAL = ['#7cc0ff', '#3ee08f', '#ff8fd8', '#b9a6ff', '#ffd166', '#7df0c8', '#ff9e6b', '#c9d2ff'];
    cells.forEach(([x, z]) => { M.add('glow', g.oct(0.032), '#ffe8b0', [x, 0.07, z]); M.add('glass', g.disc(0.1, 8), '#9fe8ff', [x, 0.045, z], [-PI / 2, 0, 0]); });
    // single linkage as gudhi joins the pieces: each piece a thread from its first cell, bridging into its elder at the join
    const E = [];
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) E.push([Math.hypot(cells[i][0] - cells[j][0], cells[i][1] - cells[j][1]), i, j]);
    E.sort((a, b) => a[0] - b[0]);
    const up = cells.map((_, i) => i), find = i => up[i] === i ? i : (up[i] = find(up[i])), size = cells.map(() => 1), joins = [];
    for (const [d, i, j] of E) { const a = find(i), b = find(j); if (a !== b) { joins.push([d, a, b]); if (size[a] < size[b] || (size[a] === size[b] && a > b)) { up[a] = b; size[b] += size[a]; joins[joins.length - 1].push(a, b); } else { up[b] = a; size[a] += size[b]; joins[joins.length - 1].push(b, a); } } }
    const d0 = joins[0][0], d1 = joins[joins.length - 1][0], hy = d => 0.12 + 1.2 * Math.log(d / d0) / Math.log(d1 / d0);
    const sz = cells.map(() => 1);
    joins.forEach(([d, , , young, elder]) => {
      const y = hy(d), A = cells[young], B = cells[elder], col = PAL[young % PAL.length];
      M.add('glow', g.rod([A[0], 0.07, A[1]], [A[0], y, A[1]], 0.006 + 0.003 * Math.sqrt(sz[young]), 3), col);
      M.add('glow', g.tube([[A[0], y, A[1]], [(A[0] + B[0]) / 2, y + 0.05, (A[1] + B[1]) / 2], [B[0], y, B[1]]], 0.007, 4, 3), col);
      sz[elder] += sz[young];
    });
    const last = find(0), T = cells[last], top = 1.55;
    M.add('glow', g.rod([T[0], 0.07, T[1]], [T[0], top, T[1]], 0.026, 6), '#ffb43b');   // the trunk: one piece left
    M.add('glow', g.cone(0.05, 0.1, 6), '#ffb43b', [T[0], top + 0.05, T[1]]);
    for (const [y, k, R] of [[0.48, 3, 0.2], [0.78, 7, 0.16], [1.02, 11, 0.24]]) {   // loops alive at their heights
      const c = cells[k], at = [c[0] * 0.5, y, c[1] * 0.5];
      M.add('glow', g.tor(R, 0.013, 3, 12), '#ff7a3c', at, [PI / 2, 0, 0]);
      if (k === 3) M.add('glass', g.cyl(R, R, 0.3, 10, true), '#ff7a3c', [at[0], y + 0.15, at[2]]);   // the big loop's chimney
    }
    M.add('glow', g.rod([-0.85, 0.04, -0.7], [-0.85, top, -0.7], 0.008, 4), '#e7eef8');   // the log ruler
    for (let k = 0; k < 5; k++) M.add('glow', g.box(0.08, 0.008, 0.008), '#e7eef8', [-0.81, 0.12 + k * 0.33, -0.7]);
  });

  def('topo.cohort', 'Slide rack', 'The cohort\'s glass slides standing in two stepped rows, healthy with blue labels and cirrhotic with red, each with its orange curve; the mean curves in front.', 920, (M, g, r) => {
    const curve = (u, peak, h) => h * Math.exp(-((u - peak) ** 2) / 0.05) + 0.12 * h * u;
    [[-0.5, '#4d9de0', '#7cc0ff', 0.3, 0.75], [0.5, '#e0504d', '#ff7a6b', 0.5, 1.0]].forEach(([gx, lab, mean, peak, hh]) => {
      const prof = [[0.56, 0]];
      for (let i = 0; i <= 8; i++) prof.push([0.56 - i * 0.12, 0.06 + i * 0.045], [0.44 - i * 0.12, 0.06 + i * 0.045]);   // the rack's steps, z against y
      prof.push([0.44 - 8 * 0.12, 0]);
      for (let i = 8; i >= 0; i--) {   // back rows first: their glass is drawn behind the front's
        const z = 0.5 - i * 0.12, y0 = 0.06 + i * 0.045;
        M.add('glass', g.box(0.85, 0.28, 0.012), '#cfefff', [gx, y0 + 0.14, z]);
        M.add('mat', g.box(0.16, 0.28, 0.016), lab, [gx - 0.345, y0 + 0.14, z]);
        const pts = [];
        for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push([gx - 0.25 + u * 0.62, y0 + 0.03 + curve(u, peak + (r() - 0.5) * 0.08, hh * (0.18 + 0.06 * r())), z + 0.009]); }
        M.add('glow', g.strip(pts, [0, 1, 0], 0.022), '#ff7a3c');
      }
      M.add('mat', g.ext(prof, 0.88), '#202a3e', [gx + 0.44, 0, 0], [0, -PI / 2, 0]);
      const mp = []; for (let k = 0; k <= 8; k++) { const u = k / 8; mp.push([gx - 0.3 + u * 0.66, 0.04 + curve(u, peak, hh * 0.24), 0.72]); }
      M.add('glow', g.tube(mp, 0.016, 10), mean);
    });
  });

  // ================================================================== pass it on
  // fish: a body (a stretched diamond) and a tail fin, counter-shaded as the set's: dark back, silver flanks, pale belly
  const fish = (M, g, p, head, bank, s, cols, fin) => {
    const rot = [bank, head, 0, 'YXZ'], c = cols || ['#3d6a86', '#cfdde6', '#eef4f6'];
    M.add('gloss', g.oct(1), (w, n) => n.y > 0.35 ? c[0] : n.y < -0.35 ? c[2] : c[1], p, rot, [0.075 * s, 0.028 * s, 0.02 * s]);
    M.add('flat', g.tri([-0.065 * s, 0, 0], [-0.11 * s, 0.032 * s, 0], [-0.11 * s, -0.032 * s, 0]), c[0], p, rot);
    if (fin) M.add('flat', g.tri([0.012 * s, 0.022 * s, 0], [-0.03 * s, 0.022 * s, 0], [-0.022 * s, 0.06 * s, 0]), c[0], p, rot);
  };
  def('pass.fish', 'School of fish', 'A school of fish swirling round under a dome of sea over sand, rocks and seagrass, a shark passing on the outside.', 802, (M, g, r) => {
    M.add('mat', g.cyl(1, 1.04, 0.1, 16), (w, n) => n.y > 0.5 ? M.jit('#4c564c', 0.06)() : NAVY, [0, 0.05, 0]);
    for (let k = 0; k < 4; k++) { const a = r() * 2 * PI, d = 0.3 + 0.5 * r(); M.add('mat', g.ball(1), M.jit('#3a4248', 0.08), [d * Math.cos(a), 0.12, d * Math.sin(a)], [r(), r(), r()], [0.14, 0.09, 0.12]); }
    for (let k = 0; k < 14; k++) { const a = r() * 2 * PI, d = 0.2 + 0.7 * r(), h = 0.2 + 0.18 * r(); M.add('mat', g.cone(0.025, h, 3), k % 2 ? '#3f6b4a' : '#4f7f52', [d * Math.cos(a), 0.1 + h / 2, d * Math.sin(a)], [(r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4]); }
    for (let i = 0; i < 44; i++) {   // the school circles: each fish heads along the ring
      const a = i / 44 * 2 * PI + r() * 0.2, rad = 0.42 + (r() - 0.5) * 0.28, y = 0.72 + (r() - 0.5) * 0.3 + 0.08 * Math.sin(3 * a);
      fish(M, g, [rad * Math.cos(a), y, rad * Math.sin(a)], -a - PI / 2, (r() - 0.5) * 0.6, 1.45);
    }
    fish(M, g, [0.84 * Math.cos(2.4), 0.5, 0.84 * Math.sin(2.4)], -2.4 - PI / 2, 0.3, 3.4, ['#4a5560', '#7d8994', '#c9d1d6'], true);   // the shark
    M.add('veil', g.sph(1, 14, 5, 0, 2 * PI, 0, PI / 2), '#2a8fb8', [0, 0.1, 0]);
  });

  // the airports' globe: land from a few large rough continents (per face, low-poly: small islands only made specks,
  // so both globes read as continents), lon0 facing you
  const LAND = [[52, -100, 21], [38, -97, 14], [64, -148, 10], [66, -85, 12], [30, -110, 8], [18, -100, 7], [13, -87, 5], [72, -42, 10],   // North America, Greenland
    [-5, -62, 16], [-20, -55, 12], [-35, -65, 8], [5, -70, 7], [-48, -70, 5],                                                             // South America
    [50, 12, 12], [60, 25, 10], [44, 25, 7], [41, -4, 7], [64, 14, 7],                                                                  // Europe
    [8, 18, 18], [20, 8, 13], [-6, 25, 14], [-22, 25, 11], [25, 30, 9], [8, 38, 8],                                                      // Africa
    [60, 90, 26], [62, 130, 19], [45, 80, 15], [35, 105, 14], [38, 60, 12], [25, 47, 10], [22, 79, 10], [15, 102, 7], [46, 135, 9],      // Asia
    [-2, 112, 7], [-4, 138, 6], [-25, 134, 15], [-32, 146, 7]];                                                                          // the islands, Australia
  const D2R = PI / 180;
  const ll = (lat, lon, lon0, rad) => { const c = Math.cos(lat * D2R); return [rad * c * Math.sin((lon - lon0) * D2R), rad * Math.sin(lat * D2R), rad * c * Math.cos((lon - lon0) * D2R)]; };
  const unit = (lat, lon) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R)];
  const LANDV = LAND.map(([a, b, rr]) => [unit(a, b), Math.cos(rr * D2R)]);
  const isLand = (lat, lon) => { if (lat < -72) return true; const v = unit(lat, lon); return LANDV.some(([u, c]) => v[0] * u[0] + v[1] * u[1] + v[2] * u[2] > c); };
  const AP = { ATL: [33.6, -84.4], ORD: [42, -87.9], LAX: [33.9, -118.4], JFK: [40.6, -73.8], DFW: [32.9, -97], YYZ: [43.7, -79.6], MEX: [19.4, -99.1], GRU: [-23.4, -46.5],
    MIA: [25.8, -80.3], SFO: [37.6, -122.4], SEA: [47.4, -122.3], BOG: [4.7, -74.1],
    LHR: [51.5, -0.5], CDG: [49, 2.5], FRA: [50, 8.6], AMS: [52.3, 4.8], MAD: [40.5, -3.6], MUC: [48.4, 11.8], ZRH: [47.5, 8.6], VIE: [48.1, 16.6], IST: [41.3, 28.8], DME: [55.4, 37.9],
    LIS: [38.8, -9.1], FCO: [41.8, 12.2], ARN: [59.7, 17.9], PRG: [50.1, 14.3], BUD: [47.4, 19.3], MXP: [45.6, 8.7], WAW: [52.2, 20.9],
    CAI: [30.1, 31.4], JNB: [-26.1, 28.2], NBO: [-1.3, 36.9], DXB: [25.3, 55.4], DEL: [28.6, 77.1], BOM: [19.1, 72.9], PEK: [40.1, 116.6], PVG: [31.1, 121.8], ICN: [37.5, 126.4],
    NRT: [35.8, 140.4], HKG: [22.3, 113.9], BKK: [13.7, 100.7], SIN: [1.4, 104], SYD: [-33.9, 151.2] };
  // the globe, tilted so the northern hubs face you; tint(lat, lon, land) may colour a face its own way. Routes are
  // great-circle arcs lifted as the original's are
  const globe = (M, g, lon0, routes, rcol, tint) => {
    const cy = 1.2;
    M.frame([0, cy, 0], [0.35, 0, 0]);
    const ico = g.ball(1, 4); ico.computeVertexNormals();   // a faceted planet: flat faces, coloured land or sea
    M.add('mat', ico, (w, n, lc) => {
      const lat = Math.asin(Math.max(-1, Math.min(1, lc.y / lc.length()))) / D2R, lon = lon0 + Math.atan2(lc.x, lc.z) / D2R, land = isLand(lat, lon);
      return (tint && tint(lat, lon, land)) || (land ? M.jit('#4a7696', 0.04)() : '#061328');
    });
    for (const [a, b, col] of routes) {
      const A = ll(...AP[a], lon0, 1), B = ll(...AP[b], lon0, 1), ang = Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])), pts = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6, s = Math.sin(ang), wa = Math.sin((1 - t) * ang) / s, wb = Math.sin(t * ang) / s, h = 1.005 + 0.22 * ang / PI * Math.sin(PI * t) * 2; pts.push([(A[0] * wa + B[0] * wb) * h, (A[1] * wa + B[1] * wb) * h, (A[2] * wa + B[2] * wb) * h]); }
      M.add('glow', g.tube(pts, 0.009, 5), col || rcol);
    }
    return cy;
  };
  const globeStand = (M, g, cy) => { M.frame(); plinth(M, 0.32, 0.08); M.add('gloss', g.rod([0, 0.08, 0], [0, cy - 0.95, 0], 0.03, 6), NAVY); };
  // a ring lying on the globe round the point p (on its surface), th radians out from it
  const ringOn = (M, g, p, th, rr, col) => M.add('glow', g.tor(Math.sin(th) * 1.012, rr, 3, 16), col, p.map(v => v * Math.cos(th) * 1.012), [-Math.asin(p[1]), Math.atan2(p[0], p[2]), 0, 'YXZ']);

  def('pass.globe', 'Globe with an outbreak', 'The airports\' globe with an outbreak spreading from Vienna: a red cluster of infectious cities round it and a ring of spread moving out, exposed cities amber along the routes, recovered grey.', 1156, (M, g) => {
    const lon0 = 25, R = '#ff3b2a', O = '#ff8a2a', A = '#ffb43b', vu = unit(...AP.VIE), V = ll(...AP.VIE, lon0, 1);
    const from = (lat, lon) => { const u = unit(lat, lon); return Math.acos(Math.min(1, u[0] * vu[0] + u[1] * vu[1] + u[2] * vu[2])) / D2R; };   // degrees from Vienna
    // the land round Vienna glows red, then orange, where the infection has reached
    const cy = globe(M, g, lon0, [['VIE', 'LHR', R], ['VIE', 'IST', R], ['VIE', 'CDG', O], ['IST', 'DXB', O], ['LHR', 'JFK', A], ['DXB', 'DEL', A], ['IST', 'CAI', A], ['VIE', 'PEK', A], ['SIN', 'SYD'], ['MAD', 'GRU']], '#bfe0ff',
      (lat, lon, land) => { const d = from(lat, lon); return !land ? null : d < 9 ? '#d8402a' : d < 16 ? '#c8763a' : null; });
    const city = (k, col, rad) => M.add('glow', g.oct(rad), col, ll(...AP[k], lon0, 1.012));
    city('VIE', R, 0.07); for (const k of ['MUC', 'ZRH', 'PRG', 'BUD', 'FRA', 'MXP']) city(k, R, 0.048);
    for (const k of ['LHR', 'IST', 'CDG']) city(k, A, 0.045);
    for (const k of ['WAW', 'AMS', 'MAD']) city(k, '#8a94a3', 0.034);
    ringOn(M, g, V, 0.2, 0.013, '#ff5a2a'); ringOn(M, g, V, 0.34, 0.008, '#ffa060');   // the spread, moving out
    globeStand(M, g, cy);
  });

  // the cell map's cell: an ellipsoid membrane (cut open at the front when cut is given), on a stand
  const PL = { pm: '#4dc7ff', nuc: '#a385ff', nucl: '#f59eff', er: '#43e08f', golgi: '#ff9e38', mito: '#ff5c54', lyso: '#ff5cc2', endo: '#29dbcc', perox: '#c2ed42', cyto: '#ffd14d', cytosk: '#b3c2db' };
  const CUT = [PI / 2 + 0.95, 2 * PI - 1.9];   // the membrane's sweep, leaving out a wedge at the front (+z)
  const cellStand = (M, g, cy) => { M.frame(); plinth(M, 0.3, 0.07); M.add('gloss', g.rod([0, 0.07, 0], [0, cy - 0.73, 0], 0.03, 6), NAVY); };
  def('pass.cell', 'The cell, a relay', 'The cell map\'s cell, its organelles dim, with the NF-kB relay lit: a signal caught at the membrane, passed hand to hand and carried into the nucleus; CFTR stuck on its way (red).', 1016, (M, g, r) => {
    const cy = 1.0;
    M.frame([0, cy, 0]);
    M.add('veil', g.sph(1, 12, 8), PL.pm, 0, 0, [1, 0.74, 1]);
    M.add('glass', g.sph(0.37, 10, 6), PL.nuc, [0.05, -0.04, -0.05]);
    M.add('glass', g.sph(0.52, 12, 5, 0.4, 1.4 * PI, 0.55, 2.0), PL.er, [0.05, -0.04, -0.05], [0.3, 0, 0], [1, 0.8, 1]);   // the organelles dim, as glass
    for (let k = 0; k < 3; k++) M.add('glass', g.tor(0.2 + 0.055 * k, 0.034, 3, 6, 1.3), PL.golgi, [-0.5, -0.1, 0.34], [0.2, -0.75, 0.6], [1, 1, 0.5]);
    for (let k = 0; k < 3; k++) { const a = 3.4 + k * 1.1, p = [0.66 * Math.cos(a), -0.25 + 0.2 * k, 0.66 * Math.sin(a)]; M.add('glass', g.sph(1, 6, 4), PL.mito, p, [r() * 3, r() * 3, r() * 3], [0.13, 0.05, 0.05]); }
    // the relay: TNF outside, its receptor in the membrane, hand to hand through the cytoplasm, NF-kB into the nucleus
    const relay = [[0.38, 0.82, 0.32], [0.36, 0.66, 0.3], [0.42, 0.46, 0.3], [0.34, 0.28, 0.22], [0.22, 0.16, 0.12], [0.1, 0.06, 0.04]];
    M.add('glow', g.ball(0.07), '#ffe08a', [0.42, 0.98, 0.36]);
    M.add('glow', g.tube(relay, 0.02, 12, 4), '#2fd2c0');
    relay.forEach((p, k) => M.add('glow', g.ball(k ? 0.045 : 0.06), k === relay.length - 1 ? '#b8fff4' : '#7df0e0', p));
    M.add('glow', g.tor(0.11, 0.012, 3, 12), '#7df0e0', [0.13, 0.08, 0.06], [-0.5, 0.6, 0, 'YXZ']);   // where it enters the nucleus
    M.add('glow', g.ball(0.06), '#ff3b30', [-0.55, -0.3, 0.5]);   // CFTR, failed a third of the way to the membrane
    for (let k = 1; k <= 3; k++) M.add('glow', g.oct(0.018), '#ff8a80', [-0.55 + 0.1 * k, -0.3 - 0.04 * k, 0.5 - 0.09 * k]);
    cellStand(M, g, cy);
  });

  // ================================================================== flock and robots
  def('flock.flock', 'Starlings at dusk', 'A murmuration of starlings over a dark field with reeds, a lake and a ring of trees, against a dusk sky glowing low where the sun sets.', 609, (M, g, r) => {
    M.add('mat', g.cyl(1, 1.03, 0.06, 16), (w, n) => n.y > 0.5 ? M.jit('#22201a', 0.03)() : NAVY, [0, 0.03, 0]);
    M.add('glow', g.disc(1, 12), '#8a4f3c', [0.15, 0.062, -0.45], [-PI / 2, 0, 0], [0.45, 0.25, 1]);   // the lake mirrors the sunset
    for (let k = 0; k < 9; k++) { const a = PI / 2 + 0.25 + k * (PI - 0.5) / 8, h = 0.16 + 0.08 * r(); M.add('mat', g.cone(0.06, h, 5), '#0f1410', [0.9 * Math.sin(a), 0.06 + h / 2, 0.9 * Math.cos(a)]); }
    for (let k = 0; k < 16; k++) { const x = (r() - 0.5) * 1.1, z = 0.45 + r() * 0.4, h = 0.1 + 0.1 * r(); M.add('mat', g.cone(0.012, h, 3), '#3a3020', [x, 0.06 + h / 2, z], [(r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5]); }
    const sky = [[0, '#ff9a58'], [0.14, '#e88a6a'], [0.3, '#9a7a9a'], [0.5, '#4a5888'], [0.75, '#26336a'], [1, '#121c42']].map(([t, c]) => [t, M.rgb(c)]);
    M.add('glow', g.cyl(0.98, 0.98, 1.1, 12, true, PI / 2 + 0.15, PI - 0.3), smooth((w, n, lc) => { const t = (lc.y + 0.55) / 1.1; let i = 0; while (i < sky.length - 2 && t > sky[i + 1][0]) i++; return lerp(sky[i][1], sky[i + 1][1], Math.min(1, (t - sky[i][0]) / (sky[i + 1][0] - sky[i][0]))); }), [0, 0.61, 0]);
    const sa = PI - 0.25;   // the sun sets towards -z, a little to the right
    M.add('glow', g.disc(0.08, 10), '#ffe0a8', [0.95 * Math.sin(sa), 0.2, 0.95 * Math.cos(sa)], [0, sa + PI, 0]);
    for (let i = 0; i < 110; i++) {   // the murmuration: a bent, swelling cloud of birds flying one way
      const u = r(), c = [-0.45 + 0.9 * u, 0.66 + 0.15 * Math.sin(3 * u), -0.1 + 0.2 * Math.cos(2.5 * u)], rr = (0.06 + 0.13 * Math.sin(PI * u)) * Math.cbrt(r());
      const a = r() * 2 * PI, b = Math.acos(2 * r() - 1), p = [c[0] + rr * Math.sin(b) * Math.cos(a), c[1] + rr * Math.cos(b) * 0.7, c[2] + rr * Math.sin(b) * Math.sin(a)];
      const rot = [(r() - 0.5) * 0.8, 0.4 + (r() - 0.5) * 0.6, 0, 'YXZ'];
      M.add('flat', g.tri([0.014, 0, 0], [-0.014, 0, 0], [-0.005, 0.01, -0.035]), '#0b0b12', p, rot);
      M.add('flat', g.tri([0.014, 0, 0], [-0.014, 0, 0], [-0.005, 0.01, 0.035]), '#0b0b12', p, rot);
    }
  });

  def('robots.robots', 'Robot vacuum gang', 'A model living room cut away like a doll\'s house, six robot vacuums with their coloured LED rings following each other in a conga line.', 864, (M, g) => {
    const F = 0.08;
    const floor = g.plane(2.4, 2.0, 8, 1); floor.rotateX(-PI / 2);
    M.add('mat', floor, w => Math.floor((w.x + 1.2) / 0.3) % 2 ? '#b98a5a' : '#a97c4f', [0, F + 0.001, 0]);
    M.add('mat', g.box(2.4, F, 2.0), '#6e5136', [0, F / 2, 0]);
    M.add('mat', g.box(2.4, 0.95, 0.06), '#efe6d8', [0, F + 0.475, -1.03]);
    M.add('mat', g.box(0.06, 0.95, 2.06), '#e6dccb', [-1.23, F + 0.475, 0]);
    M.add('glow', g.box(0.6, 0.4, 0.02), '#9fc8e8', [0.5, 0.62, -0.995]);   // the window
    M.add('mat', g.box(0.3, 0.22, 0.02), '#d9a441', [-0.5, 0.68, -0.995]);
    M.add('mat', g.box(1.1, 0.01, 0.8), '#3f5d7a', [0.15, F + 0.006, 0.12]);   // the painted rug
    M.add('mat', g.box(0.38, 0.14, 0.9), '#5d7d8a', [-1.0, F + 0.07, -0.05]);  // sofa
    M.add('mat', g.box(0.12, 0.32, 0.9), '#68899a', [-1.14, F + 0.16, -0.05]);
    for (const s of [-1, 1]) M.add('mat', g.box(0.38, 0.22, 0.08), '#5d7d8a', [-1.0, F + 0.11, -0.05 + s * 0.46]);
    M.add('mat', g.box(0.1, 0.12, 0.2), '#d9a441', [-1.05, F + 0.2, -0.25]); M.add('mat', g.box(0.1, 0.12, 0.2), '#c9694a', [-1.05, F + 0.2, 0.15]);
    M.add('mat', g.box(0.42, 0.14, 0.4), '#c98f3e', [0.75, F + 0.07, -0.68]);  // armchair
    M.add('mat', g.box(0.42, 0.32, 0.1), '#d49c4c', [0.75, F + 0.16, -0.88]);
    M.add('mat', g.box(0.52, 0.04, 0.32), '#b98a5a', [0.05, F + 0.24, 0.1]);   // coffee table: robots pass under it
    for (const s of [-1, 1]) M.add('mat', g.box(0.04, 0.22, 0.28), '#8a6440', [0.05 + s * 0.22, F + 0.11, 0.1]);
    M.add('mat', g.box(0.62, 0.42, 0.16), '#e8e2d6', [-0.5, F + 0.21, -0.92]);  // bookcase
    ['#3f5d7a', '#c9694a', '#6f8f6a'].forEach((c, k) => M.add('mat', g.box(0.08, 0.15, 0.1), c, [-0.68 + k * 0.1, F + 0.5, -0.92]));
    M.add('mat', g.cyl(0.07, 0.055, 0.14, 6), '#b8613e', [1.05, F + 0.07, -0.85]); M.add('mat', g.ball(0.13), '#4f8f4a', [1.05, F + 0.25, -0.85]);   // plant
    M.add('gloss', g.box(0.32, 0.06, 0.1), '#2b2f36', [0.05, F + 0.03, -0.95]); M.add('glow', g.box(0.2, 0.012, 0.02), '#46d9ff', [0.05, F + 0.06, -0.89]);   // dock
    const GANG = ['#46d9ff', '#ff5ad9', '#ffb43b', '#3ee08f', '#ff5a4b', '#9d7bff'];
    GANG.forEach((c, i) => {   // a conga line across the rug, each following the one ahead
      const a = 3.6 + i * 0.42, x = 0.2 + 0.62 * Math.cos(a), z = 0.15 - 0.55 * Math.sin(a);
      M.frame([x, F, z], [0, Math.atan2(-0.55 * Math.cos(a), 0.62 * Math.sin(a)), 0]);   // heading along the line
      M.add('gloss', g.cyl(0.12, 0.12, 0.05, 10), '#2b2f36', [0, 0.025, 0]);
      M.add('glow', g.cyl(0.123, 0.123, 0.012, 10, true), c, [0, 0.045, 0]);
      M.add('mat', g.cyl(0.126, 0.126, 0.03, 8, true, 0, PI), '#8a96a3', [0, 0.02, 0], [0, -PI / 2, 0]);   // bumper round the front
      M.add('glow', g.box(0.025, 0.018, 0.07), '#e7f6ff', [0.07, 0.055, 0]);   // the eyes' visor
      M.frame();
    });
  });

  // ================================================================== the three hand-written stories
  def('airports.globe', 'Globe of flights', 'The globe of airports as hubs and spokes: hubs as pillars coloured by their number of routes, blue through cyan to amber, and routes fanning out from the biggest.', 1190, (M, g) => {
    const lon0 = -20, deg = { FRA: 250, ATL: 245, DXB: 230, LHR: 220, CDG: 215, AMS: 210, IST: 205, ORD: 200, JFK: 175, MUC: 170, DFW: 165, MAD: 160, LAX: 150, PEK: 150,
      FCO: 140, MIA: 130, DEL: 120, SIN: 120, SFO: 120, GRU: 110, MEX: 110, YYZ: 105, LIS: 95, BOM: 95, SEA: 90, ARN: 90, BOG: 85, JNB: 85, CAI: 80, NBO: 70 };
    const spokes = { FRA: ['JFK', 'ORD', 'DXB', 'PEK', 'GRU'], ATL: ['LAX', 'MEX', 'LHR', 'BOG', 'SEA'], DXB: ['SIN', 'DEL', 'JNB', 'NBO', 'LHR'] }, routes = [];
    for (const h in spokes) for (const k of spokes[h]) routes.push([h, k]);
    const cy = globe(M, g, lon0, routes, '#cfe7ff');
    for (const k in deg) { const x = deg[k] / 250, p = ll(...AP[k], lon0, 1); M.add('glow', g.rod(p, p.map(v => v * (1.02 + 0.34 * x * x)), 0.02, 3), degCol(x)); }
    globeStand(M, g, cy);
  });

  def('proteins.cell', 'Cell of proteins', 'A see-through cell with a faint nucleus and a loose cloud of proteins through it, coloured by their community and linked where they interact.', 1058, (M, g, r) => {
    const COMM = [[1.00, 0.42, 0.22], [0.30, 0.58, 1.00], [1.00, 0.84, 0.18], [0.25, 0.90, 0.45], [0.80, 0.38, 1.00], [0.15, 0.92, 0.92], [1.00, 0.38, 0.68], [0.62, 1.00, 0.25], [1.00, 0.70, 0.52], [0.92, 0.94, 1.00]];
    const cy = 1.0;
    M.frame([0, cy, 0]);
    M.add('veil', g.sph(1, 12, 8), '#59bff2');
    M.add('glass', g.sph(0.3, 10, 6), '#bf8cff');
    // no organelles: the communities spread loosely through the whole cell, linked within and across
    const P = [];
    COMM.forEach((c, k) => {
      const y = 1 - (k + 0.5) / 10 * 2, a = k * 2.39996, s = Math.sqrt(1 - y * y), d = 0.42 + 0.3 * (k % 3) / 2;
      const ctr = [d * s * Math.cos(a), d * y * 0.7, d * s * Math.sin(a)], g0 = P.length;
      for (let i = 0; i < 5; i++) {
        const p = add3(ctr, [(r() - 0.5) * 0.3, (r() - 0.5) * 0.24, (r() - 0.5) * 0.3]);
        P.push(p); M.add('glow', g.oct(0.05), c, p);
        if (i) M.add('glow', g.rod(P[g0 + Math.floor(r() * i)], p, 0.008, 3), '#c4d3f0');
      }
    });
    for (let k = 0; k < 16; k++) { const a = P[(k * 7 + 3) % P.length], b = P[(k * 13 + 11) % P.length]; if (a !== b) M.add('glow', g.rod(a, b, 0.005, 3), '#7d8cad'); }
    cellStand(M, g, cy);
  });

  def('spatial.cell', 'Model cell', 'The model cell cut open to its compartments, each in its own colour: the nucleus and its nucleolus, the ER, the Golgi, mitochondria, vesicles, lysosomes and peroxisomes, a few proteins at their places.', 1148, (M, g, r) => {
    const cy = 1.0;
    M.frame([0, cy, 0]);
    // solid compartments in the cell map's colours, the membrane and the nucleus cut open at the front to show them
    M.add('glass', g.sph(1, 14, 8, CUT[0], CUT[1]), PL.pm, 0, 0, [1, 0.74, 1]);
    M.add('flat', g.sph(0.36, 12, 8, CUT[0], CUT[1]), PL.nuc, [0, -0.02, -0.06]);
    M.add('gloss', g.ball(0.14, 1), PL.nucl, [0.02, 0.02, 0.0]);
    for (let k = 0; k < 3; k++) M.add('flat', g.cyl(0.47 + 0.06 * k, 0.47 + 0.06 * k, 0.07, 10, true, 1.2 + 0.4 * k, 2.4), PL.er, [0, -0.02 + 0.13 * (k - 1), -0.06]);   // ER sheets round the nucleus
    for (let k = 0; k < 4; k++) M.add('gloss', g.tor(0.17 + 0.05 * k, 0.03, 3, 6, 1.3), PL.golgi, [0.54, -0.08, 0.3], [0.2, 0.75, -0.6], [1, 1, 0.5]);
    for (let k = 0; k < 3; k++) { const a = 2.5 + k * 1.2, p = [0.72 * Math.cos(a), (k - 1) * 0.2, 0.72 * Math.sin(a)]; M.add('gloss', g.sph(1, 6, 4), PL.mito, p, [0.4 * k, a, 0.3], [0.15, 0.06, 0.06]); }
    const blob = (n, col, rad, a0) => { for (let k = 0; k < n; k++) { const a = a0 + k * 0.7, b = (k - n / 2) * 0.35, d = 0.62 + 0.1 * (k % 2); M.add('gloss', g.ball(rad), col, [d * Math.cos(a) * Math.cos(b), d * 0.74 * Math.sin(b), d * Math.sin(a) * Math.cos(b)]); } };
    blob(3, PL.lyso, 0.06, 4.2); blob(4, PL.endo, 0.05, 0.2); blob(2, PL.perox, 0.045, 5.6);   // lysosomes, vesicles, peroxisomes
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3, b = (k % 3 - 1) * 0.5, d = [Math.cos(a) * Math.cos(b), 0.74 * Math.sin(b), Math.sin(a) * Math.cos(b)]; M.add('mat', g.rod(d.map(v => v * 0.38), d.map(v => v * 0.97), 0.008), PL.cytosk); }   // the cytoskeleton
    const prot = [[0.6, 0.62, 0.3, PL.pm], [-0.7, 0.4, 0.4, PL.pm], [0.3, 0.45, 0.1, PL.cyto], [-0.35, -0.4, 0.3, PL.cyto], [0.1, 0.38, -0.02, PL.nuc], [-0.2, -0.3, -0.1, PL.nuc],
      [0.45, -0.12, 0.22, PL.er], [0.55, 0.1, 0.42, PL.golgi], [-0.62, 0.05, -0.38, PL.mito], [0.15, -0.55, 0.45, PL.cyto]];
    prot.forEach(([x, y, z, c]) => M.add('glow', g.oct(0.04), c, [x, y, z]));
    for (const [i, j] of [[0, 2], [2, 4], [1, 3], [6, 7]]) M.add('glow', g.rod(prot[i].slice(0, 3), prot[j].slice(0, 3), 0.006, 3), '#e7eef8');
    cellStand(M, g, cy);
  });
})();
