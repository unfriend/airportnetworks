// mac: a classic beige all-in-one computer (no brand marks), taken apart into neat rows like
// Todd McLellan's teardown photo, its circuit wired up like a schematic, then only a network left.
SETS.mac = function (K) {
  const { THREE } = K;
  const set = K.newSet('mac');
  const R = K.rng(1984), PI = Math.PI;
  const FLOOR = -0.3;                 // table top; the computer stands on it
  const CW = 0.35, CH = 0.48, CD = 0.42, CZ = 0.12;   // case width, height, depth, front face z
  const CY0 = FLOOR + 0.006, CY1 = CY0 + CH;          // case bottom (on its feet) and top
  const SEAM = CZ - 0.1;              // where the front bezel meets the rear case
  const TW = 1.76, TD = 1.48, TABLE = 0x82807c;   // teardown table

  // ------------------------------------------------------------ helpers --
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const col = c => new THREE.Color(...K.rgb(c));
  const E = new THREE.Euler(), Q = new THREE.Quaternion(), M4 = new THREE.Matrix4(), S1 = new THREE.Vector3(1, 1, 1);
  // a transform: position, Euler rotation (radians), scale
  const mat = (p, r, s) => {
    E.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0);
    return new THREE.Matrix4().compose(V(p[0], p[1], p[2]), Q.clone().setFromEuler(E), s ? (typeof s === 'number' ? V(s, s, s) : V(s[0], s[1], s[2])) : S1);
  };
  const quat = r => new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2]));
  // points around a rounded rectangle w x h (corner radius r), counter-clockwise seen from +z
  const rrect = (w, h, r, k = 5, ox = 0, oy = 0) => {
    const out = [], cx = w / 2 - r, cy = h / 2 - r;
    [[cx, cy], [-cx, cy], [-cx, -cy], [cx, -cy]].forEach(([x, y], q) => {
      for (let i = 0; i <= k; i++) { const a = (q + i / k) * PI / 2; out.push([ox + x + r * Math.cos(a), oy + y + r * Math.sin(a)]); }
    });
    return out;
  };
  // a surface through rings of 3D points (same count each); out: winding so normals face away from the axis
  function loft(rings, closed = true, out = true) {
    const n = rings[0].length, pos = [], idx = [];
    for (const r of rings) for (const p of r) pos.push(p[0], p[1], p[2]);
    const m = closed ? n : n - 1;
    // orient the first face against the centre of its ring, so 'out' always means away from the axis
    const r0 = rings[0], ctr = r0.reduce((s, p) => K.v3.add(s, K.v3.mul(p, 1 / n)), [0, 0, 0]);
    const nrm = K.v3.cross(K.v3.sub(rings[1][1], r0[0]), K.v3.sub(r0[1], r0[0]));
    const flip = (K.v3.dot(nrm, K.v3.sub(r0[0], ctr)) > 0) !== out;
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < m; j++) {
      const a = i * n + j, b = i * n + (j + 1) % n, c = (i + 1) * n + (j + 1) % n, d = (i + 1) * n + j;
      if (!flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // a flat fan closing a ring of 2D points at depth z (facing +z or -z)
  function cap(pts, z, front) {
    const pos = [];
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p[0] / pts.length; cy += p[1] / pts.length; }
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j], b = pts[(j + 1) % pts.length];
      if (front) pos.push(cx, cy, z, a[0], a[1], z, b[0], b[1], z); else pos.push(cx, cy, z, b[0], b[1], z, a[0], a[1], z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }
  const ring3 = (pts, z) => pts.map(p => [p[0], p[1], z]);
  // a fan closing a ring of 3D points around a centre, flipped if needed so it faces up (+y)
  function fanUp(ring, c) {
    const pos = [];
    for (let j = 0; j < ring.length; j++) { const a = ring[j], b = ring[(j + 1) % ring.length]; pos.push(...c, ...b, ...a); }
    const n = K.v3.cross(K.v3.sub(ring[1], c), K.v3.sub(ring[0], c));
    if (n[1] < 0) for (let k = 0; k < pos.length; k += 9) for (let m = 0; m < 3; m++) { const t = pos[k + 3 + m]; pos[k + 3 + m] = pos[k + 6 + m]; pos[k + 6 + m] = t; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  }
  // merged geometry with vertex colours (and uvs, for the textured boards); filled into typed arrays at the end
  function Bld() {
    const list = [];
    return {
      add(g, m, c, uv) {
        g = g.index ? g.toNonIndexed() : m ? g.clone() : g;
        if (m) g.applyMatrix4(m);
        list.push([g, K.rgb(c), uv]);
        return this;
      },
      geo() {
        let n = 0;
        for (const it of list) n += it[0].attributes.position.count;
        const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), T = new Float32Array(n * 2).fill(0.004);
        let o = 0;
        for (const [g, cc, uv] of list) {
          const p = g.attributes.position.array, k = g.attributes.position.count;
          P.set(p, 3 * o); N.set(g.attributes.normal.array, 3 * o);
          for (let i = 0; i < k; i++) {
            const j = 3 * (o + i); C[j] = cc[0]; C[j + 1] = cc[1]; C[j + 2] = cc[2];
            if (uv) { const t = uv(i, p[3 * i], p[3 * i + 1], p[3 * i + 2]); T[2 * (o + i)] = t[0]; T[2 * (o + i) + 1] = t[1]; }
          }
          o += k;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
        g.setAttribute('color', new THREE.BufferAttribute(C, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(T, 2));
        g.computeBoundingSphere();
        return g;
      },
    };
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, s = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);

  // ---------------------------------------------------------- materials --
  const mPlastic = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 }));
  const mGloss = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 }));
  const mMetal = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.45 }));
  const LIT = [mPlastic, mGloss, mMetal];

  // ------------------------------------------------------------- parts --
  // A part moves as one piece from its place in the computer (home) to its place on the table (lay).
  // d: when it starts to fly (0..1 of mac_explode), w: how long it flies, arc: height of its hop,
  // spin: extra turns about a local axis on the way (screws unscrew), inner: hidden while the case is shut,
  // node: index of its network node (wired parts) or -1.
  const parts = [];
  function part(o) {
    const p = Object.assign({ d: 0.3, w: 0.4, arc: 0.12, spin: 0, axis: [0, 1, 0], inner: true, node: -1, fade: 0.1, grp: '' }, o);
    p.hq = quat(p.hr || [0, 0, 0]); p.lq = quat(p.lr || [0, 0, 0]);
    p.m = new THREE.Matrix4();
    parts.push(p);
    return parts.length - 1;
  }
  // instanced pieces: kind -> list of { part, local matrix, colour }
  const KINDS = {}, kindList = [];
  function kind(name, geo, material) { KINDS[name] = { geo, material, list: [] }; kindList.push(name); }
  const piece = (k, pi, m, c) => KINDS[k].list.push({ pi, m, c: col(c) });
  // unique meshes that follow one part
  const solos = [];
  function solo(pi, geo, material, local) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.matrixAutoUpdate = false;
    set.group.add(mesh);
    solos.push({ pi, mesh, local: local || null });
    return mesh;
  }
  // ------------------------------------------------- instanced base shapes --
  const white = g => K.paint(g, [1, 1, 1]);
  // a key cap: rounded, tapering, gently dished top (1 x 1 x 1 before scaling)
  function keycap() {
    const b = rrect(1, 1, 0.16, 3), t = rrect(0.78, 0.76, 0.18, 3, 0, 0.05), dish = rrect(0.5, 0.48, 0.18, 3, 0, 0.05);
    const g = loft([ring3(b, 0), ring3(b, 0.25), ring3(t, 1)]);
    const top = loft([ring3(t, 1), ring3(dish, 0.96)], true, false);
    const out = Bld().add(g, null, '#ffffff').add(top, null, '#ffffff').add(cap(dish, 0.96, true), null, '#ffffff').add(cap(b, 0, false), null, '#ffffff').geo();
    out.rotateX(-PI / 2);
    return out;
  }
  // a pan-head screw with a threaded shank, 1 unit head diameter, len shank length (head on top, at y 0)
  function screwGeo(len) {
    const p = [V(0, 0.42, 0), V(0.32, 0.4, 0), V(0.47, 0.3, 0), V(0.5, 0.12, 0), V(0.5, 0, 0), V(0.19, 0, 0)];
    const n = Math.round(len / 0.13);
    for (let i = 0; i < n; i++) { const y = -i * 0.13; p.push(V(0.2, y - 0.03, 0), V(0.26, y - 0.065, 0), V(0.2, y - 0.1, 0)); }
    p.push(V(0.16, -len, 0), V(0.02, -len - 0.12, 0));
    const pts = p.reverse().map(v => new THREE.Vector2(v.x, v.y));
    const g = new THREE.LatheGeometry(pts, 10);
    // a dark cross recess in the head
    const b = Bld().add(g, null, '#ffffff');
    b.add(box(0.5, 0.1, 0.1), mat([0, 0.39, 0]), '#3a3d42').add(box(0.1, 0.1, 0.5), mat([0, 0.39, 0]), '#3a3d42');
    return b.geo();
  }
  function springGeo() {
    const pts = [];
    for (let i = 0; i <= 120; i++) { const a = i / 120 * 9 * 2 * PI, y = i / 120 * 4 - 2; pts.push([Math.cos(a), y, Math.sin(a)]); }
    pts.unshift([1, -2.2, 0.0]); pts.push([1, 2.2, 0]);
    return white(K.tube(pts, 0.13, 180, 4));
  }
  kind('box', white(box(1, 1, 1)), mPlastic);
  kind('boxm', white(box(1, 1, 1)), mMetal);
  kind('cyl', white(cyl(0.5, 0.5, 1, 14)), mPlastic);
  kind('cylm', white(cyl(0.5, 0.5, 1, 12)), mMetal);
  kind('key', keycap(), mPlastic);
  kind('screw', screwGeo(1.1), mMetal);
  kind('screwL', screwGeo(4.2), mMetal);
  kind('spring', springGeo(), mMetal);
  kind('ring', white(new THREE.TorusGeometry(0.36, 0.14, 6, 16)), mMetal);
  kind('sph', white(new THREE.SphereGeometry(0.5, 16, 12)), mGloss);

  // --------------------------------------------------------- colours --
  const BEIGE = '#a69d88', BEIGE2 = '#9a927e', BEIGE3 = '#857e6d', INNER = '#3c3a36', DARK = '#1a1b1d', STEEL = '#c3c8ce';
  const GOLD = '#d8b35a', COPPER = '#b8743c', PCB = '#2a7a46';

  // ------------------------------------------------------------- shell --
  const midY = (CY0 + CY1) / 2, CR = 0.024, T = 0.004, BACK = CZ - CD;
  const outline = (w, h, r) => rrect(w, h, r, 5, 0, midY);
  // the rear case tapers a little towards the back
  const taper = (pts, f, inset) => pts.map(p => [p[0] * (1 - 0.04 * f), CY0 + inset + (p[1] - CY0 - inset) * (1 - 0.055 * f)]);
  function annulus(a, b, z, front) {
    const pos = [];
    for (let j = 0; j < a.length; j++) {
      const k = (j + 1) % a.length, A = [a[j][0], a[j][1], z], B = [a[k][0], a[k][1], z], C = [b[k][0], b[k][1], z], D = [b[j][0], b[j][1], z];
      if (front) pos.push(...A, ...B, ...C, ...A, ...C, ...D); else pos.push(...A, ...C, ...B, ...A, ...D, ...C);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }
  // rear case, built in place, then centred on its part
  const rearC = [0, midY, (SEAM + BACK) / 2];
  const rearGeo = (() => {
    const o = outline(CW, CH, CR), inn = outline(CW - 2 * T, CH - 2 * T, CR - T), b = Bld();
    const rings = [], irings = [], L = SEAM - BACK;
    for (let i = 0; i <= 3; i++) { const z = SEAM - i / 3 * (L - 0.016); rings.push(taper(o, (SEAM - z) / L, 0).map(p => [p[0], p[1], z])); }
    // a rounded back edge
    for (let i = 1; i <= 4; i++) {
      const a = i / 4 * PI / 2, z = BACK + 0.016 * (1 - Math.sin(a)), ins = 0.016 * (1 - Math.cos(a));
      const pts = taper(outline(CW - 2 * ins, CH - 2 * ins, Math.max(0.004, CR - ins)), (SEAM - z) / L, 0);
      rings.push(pts.map(p => [p[0], p[1], z]));
    }
    b.add(loft(rings), null, BEIGE);
    const last = rings[rings.length - 1];
    b.add(cap(last.map(p => [p[0], p[1]]), BACK, false), null, BEIGE);
    for (let i = 0; i <= 1; i++) { const z = SEAM - i * (L - T); irings.push(taper(inn, (SEAM - z) / L, 0).map(p => [p[0], p[1], z])); }
    b.add(loft(irings, true, false), null, INNER);
    b.add(cap(irings[1].map(p => [p[0], p[1]]), BACK + T, true), null, INNER);
    b.add(annulus(o, inn, SEAM, true), null, BEIGE2);
    return b.geo().translate(-rearC[0], -rearC[1], -rearC[2]);
  })();
  // front bezel: a plate with the screen opening and the floppy slot, short side walls and a sloping screen surround
  const SCR_Y = CY1 - 0.033 - 0.1175, OPW = 0.29, OPH = 0.235, SLOT = [0.082, CY0 + 0.1];
  const bezC = [0, midY, (CZ + SEAM) / 2];
  const bezGeo = (() => {
    const b = Bld(), th = 0.006, bs = 0.002;
    const shape = new THREE.Shape(outline(CW - 2 * bs, CH - 2 * bs, CR - bs).map(p => new THREE.Vector2(p[0], p[1])));
    shape.holes.push(new THREE.Path(rrect(OPW, OPH, 0.014, 4, 0, SCR_Y).map(p => new THREE.Vector2(p[0], p[1]))));
    shape.holes.push(new THREE.Path(rrect(0.115, 0.009, 0.0035, 2, SLOT[0], SLOT[1]).map(p => new THREE.Vector2(p[0], p[1]))));
    const plate = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: true, bevelThickness: bs, bevelSize: bs, bevelSegments: 2, curveSegments: 4 });
    plate.translate(0, 0, CZ - th - bs);
    b.add(plate, null, BEIGE);
    const o = outline(CW, CH, CR), inn = outline(CW - 2 * T, CH - 2 * T, CR - T);
    b.add(loft([ring3(o, CZ - th - bs), ring3(o, SEAM)]), null, BEIGE);
    b.add(loft([ring3(inn, CZ - th - bs), ring3(inn, SEAM)], true, false), null, BEIGE2);
    b.add(annulus(o, inn, SEAM, false), null, BEIGE2);
    // screen surround slopes in towards the glass
    const op = rrect(OPW, OPH, 0.014, 4, 0, SCR_Y), ip = rrect(0.262, 0.198, 0.012, 4, 0, SCR_Y);
    b.add(loft([ring3(op, CZ - 0.002), ring3(ip, CZ - 0.026)], true, false), null, BEIGE2);
    // the slot's dark mouth
    b.add(box(0.112, 0.007, 0.004), mat([SLOT[0], SLOT[1], CZ - th - 0.002]), '#141414');
    return b.geo().translate(-bezC[0], -bezC[1], -bezC[2]);
  })();
  // ------------------------------------------------------- CRT and screen --
  const FACE_Z = CZ - 0.03, FW = 0.3, FH = 0.245, IMW = 0.245, IMH = 0.165;
  const crtC = [0, SCR_Y, FACE_Z - 0.17];
  const crtGeo = (() => {
    const b = Bld(), face = rrect(FW, FH, 0.03, 5, 0, SCR_Y);
    // glass skirt behind the face, with a steel implosion band round it
    b.add(loft([ring3(face, FACE_Z), ring3(face, FACE_Z - 0.045)]), null, '#1d211f');
    const band = rrect(FW + 0.006, FH + 0.006, 0.032, 5, 0, SCR_Y);
    b.add(loft([ring3(band, FACE_Z - 0.008), ring3(band, FACE_Z - 0.034)]), null, STEEL);
    // mounting ears at the corners, screwed to the bezel from behind
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.add(box(0.032, 0.018, 0.003), mat([sx * (FW / 2 - 0.002), SCR_Y + sy * (FH / 2 - 0.002), FACE_Z - 0.03], [0, 0, Math.atan2(sy, sx)]), STEEL);
    // the funnel morphs from the rounded face to the round neck
    const rings = [], N = face.length;
    for (let i = 0; i <= 8; i++) {
      const f = i / 8, z = FACE_Z - 0.045 - f * 0.19, s = Math.pow(1 - f, 1.6), rn = 0.03;
      rings.push(face.map(p => {
        const x = p[0], y = p[1] - SCR_Y, a = Math.atan2(y, x);
        return [K.lerp(rn * Math.cos(a), x, s), SCR_Y + K.lerp(rn * Math.sin(a), y, s), z];
      }));
    }
    b.add(loft(rings), null, '#2b2e2c');
    const zr = FACE_Z - 0.235;
    const toZ = new THREE.Matrix4().makeRotationX(PI / 2);
    const along = (g, z, c) => { g.applyMatrix4(toZ); b.add(g, mat([0, SCR_Y, z]), c); };
    along(cyl(0.03, 0.017, 0.03, 18, true), zr - 0.012, '#2b2e2c');
    along(cyl(0.017, 0.017, 0.1, 14), zr - 0.075, '#59605b');
    along(cyl(0.02, 0.02, 0.016, 14), zr - 0.13, DARK);
    // deflection yoke: copper windings in a black collar
    along(cyl(0.052, 0.034, 0.046, 20), zr + 0.005, COPPER);
    along(new THREE.TorusGeometry(0.047, 0.007, 6, 20), zr + 0.026, DARK);
    along(cyl(0.036, 0.036, 0.012, 16), zr - 0.024, DARK);
    // neck board
    b.add(box(0.062, 0.05, 0.003), mat([0, SCR_Y, zr - 0.142]), PCB);
    b.add(box(0.012, 0.01, 0.008), mat([0.018, SCR_Y + 0.012, zr - 0.147]), '#e7d9a8');
    b.add(box(0.01, 0.014, 0.006), mat([-0.02, SCR_Y - 0.01, zr - 0.146]), DARK);
    // anode cap on the funnel
    b.add(new THREE.SphereGeometry(0.014, 12, 8, 0, 2 * PI, 0, PI / 2), mat([0, SCR_Y + 0.084, FACE_Z - 0.11], [-0.5, 0, 0], [1, 0.6, 1]), '#222222');
    return b.geo().translate(-crtC[0], -crtC[1], -crtC[2]);
  })();
  // what the screen shows: a light grey desktop, a menu bar, a window with a little network, two icons
  function screenTexture() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.scale(1, 512 / 342);
    g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, 512, 342);
    const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const text = (s, x, y, size, c, align) => { g.font = `bold ${size}px sans-serif`; g.fillStyle = c || '#000'; g.textAlign = align || 'left'; g.fillText(s, x, y); };
    // menu bar
    rect(0, 0, 512, 19, '#fff'); rect(0, 19, 512, 1, '#000');
    let x = 16;
    for (const m of ['File', 'Edit', 'View', 'Special']) { text(m, x, 14, 12); x += g.measureText(m).width + 18; }
    // window
    const wx = 64, wy = 46, ww = 330, wh = 240;
    rect(wx + 2, wy + 2, ww, wh, '#000'); rect(wx, wy, ww, wh, '#000'); rect(wx + 1, wy + 1, ww - 2, wh - 2, '#fff');
    for (let i = 0; i < 6; i++) rect(wx + 3, wy + 4 + 2 * i, ww - 6, 1, '#000');
    rect(wx + 120, wy + 2, 90, 15, '#fff'); text('Network', wx + 165, wy + 14, 12, '#000', 'center');
    rect(wx + 8, wy + 3, 13, 13, '#fff'); g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(wx + 10.5, wy + 4.5, 9, 9);
    rect(wx, wy + 18, ww, 1, '#000');
    // scroll bars
    rect(wx + ww - 16, wy + 18, 1, wh - 18, '#000'); rect(wx, wy + wh - 16, ww, 1, '#000');
    g.fillStyle = '#a0a0a0'; g.fillRect(wx + ww - 15, wy + 35, 14, wh - 68); g.fillRect(wx + 17, wy + wh - 15, ww - 50, 14);
    rect(wx + ww - 15, wy + 90, 14, 14, '#fff'); g.strokeRect(wx + ww - 15.5, wy + 89.5, 15, 15);
    // a little network in the window
    const r = K.rng(5), nodes = [];
    for (let i = 0; i < 16; i++) nodes.push([wx + 30 + r() * (ww - 76), wy + 40 + r() * (wh - 80)]);
    g.lineWidth = 1.2;
    nodes.forEach((a, i) => nodes.forEach((b2, j) => { if (j > i && Math.hypot(a[0] - b2[0], a[1] - b2[1]) < 95) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b2[0], b2[1]); g.stroke(); } }));
    nodes.forEach((a, i) => { g.beginPath(); g.arc(a[0], a[1], i % 4 ? 4 : 6, 0, 2 * PI); g.fillStyle = i % 3 ? '#000' : '#fff'; g.fill(); g.stroke(); });
    // icons: a disk and a bin
    const ix = 452;
    rect(ix, 34, 34, 22, '#fff'); g.strokeRect(ix + 0.5, 34.5, 33, 21); rect(ix + 4, 48, 8, 2, '#000');
    rect(ix - 14, 60, 62, 12, '#fff'); text('Hard Disk', ix + 17, 70, 10, '#000', 'center');
    g.strokeRect(ix + 7.5, 284.5, 19, 24); rect(ix + 5, 280, 24, 4, '#000');
    for (let i = 0; i < 3; i++) rect(ix + 12 + 5 * i, 288, 1, 18, '#000');
    rect(ix + 4, 314, 26, 12, '#fff'); text('Bin', ix + 17, 324, 10, '#000', 'center');
    // pointer
    g.save(); g.translate(300, 214); g.beginPath();
    [[0, 0], [0, 16], [4, 12], [7, 19], [9, 18], [6, 11], [11, 11]].forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath(); g.fillStyle = '#000'; g.fill(); g.strokeStyle = '#fff'; g.stroke(); g.restore();
    // the screen's own rounded corners
    g.fillStyle = '#000';
    for (const [cx, cy, a] of [[0, 0, 0], [512, 0, 1], [512, 342, 2], [0, 342, 3]]) {
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx + (a === 1 || a === 2 ? -6 : 6), cy + (a >= 2 ? -6 : 6), 6, (a + 2) * PI / 2, (a + 3) * PI / 2); g.closePath(); g.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }
  const screenMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uMap: { value: screenTexture() }, uOff: { value: 0 }, uImg: { value: new THREE.Vector2(IMW / FW, IMH / FH) } },
    transparent: true, extensions: { derivatives: true },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D uMap; uniform float uA, uOff; uniform vec2 uImg; varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5, q = abs(p) - vec2(0.4, 0.38);
  if (length(max(q, 0.0)) > 0.1) discard;
  vec3 glass = vec3(0.03, 0.04, 0.036);
  vec2 ip = p / uImg;
  // switching off: the picture squeezes to a bright line, then to a dot, then fades
  float sy = mix(1.0, 0.006, smoothstep(0.0, 0.45, uOff)), sx = mix(1.0, 0.01, smoothstep(0.42, 0.8, uOff));
  vec2 jp = ip / vec2(sx, sy);
  vec3 c = glass;
  if (abs(jp.x) < 0.5 && abs(jp.y) < 0.5) {
    // the squeezed picture burns to an even white line
    vec3 img = mix(texture2D(uMap, jp + 0.5).rgb, vec3(1.0), smoothstep(0.15, 0.4, uOff));
    // scan lines only where they are big enough on screen not to shimmer
    float ln = (jp.y + 0.5) * 342.0, scan = 1.0 - 0.06 * (0.5 + 0.5 * sin(ln * 6.28318)) * (1.0 - smoothstep(0.25, 0.5, fwidth(ln)));
    float edge = 1.0 - 0.22 * smoothstep(0.3, 0.75, length(ip));
    float boost = 1.0 + 2.0 * smoothstep(0.0, 0.45, uOff);
    c = mix(glass, min(img * scan * edge * boost, vec3(1.6)) * vec3(0.84, 0.93, 1.0), 1.0 - smoothstep(0.8, 1.0, uOff));
  }
  // halation: light scattered in the glass makes a soft glow round the picture (and round the line and dot)
  float dd = length(max(abs(p) - 0.5 * uImg * vec2(sx, sy), 0.0) * vec2(${FW.toFixed(3)}, ${FH.toFixed(3)}));
  c += vec3(0.6, 0.68, 0.76) * 0.4 * exp(-dd / 0.009) * step(1e-5, dd) * (1.0 - smoothstep(0.8, 1.0, uOff)) * (1.0 + smoothstep(0.0, 0.45, uOff));
  c += vec3(0.06, 0.07, 0.08) * smoothstep(0.7, -0.5, p.y * 1.4 - p.x) * 0.6;
  gl_FragColor = vec4(c, uA);
}`,
  });
  set.mats.push(screenMat);
  const screenGeo = new THREE.PlaneGeometry(FW, FH, 20, 16);
  {
    const p = screenGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (FW / 2), y = p.getY(i) / (FH / 2); p.setZ(i, 0.011 * (1 - x * x * 0.8) * (1 - y * y * 0.8)); }
    screenGeo.computeVertexNormals();
  }
  // light spill: the glowing screen lights the sloping surround and the bezel just round it (additive, on the bezel)
  const spillMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uOff: screenMat.uniforms.uOff },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    vertexShader: 'attribute float aG; varying float vG; void main() { vG = aG; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA, uOff; varying float vG;
void main() { gl_FragColor = vec4(vec3(0.66, 0.74, 0.84), pow(vG, 1.7) * 0.3 * uA * (1.0 - smoothstep(0.0, 0.5, uOff))); }`,
  });
  set.mats.push(spillMat);
  const spillGeo = (() => {
    // rings just in front of the surround (0.6 mm towards the opening) and of the face, with the glow at each
    const R4 = (w, h, r, z, g) => ({ pts: ring3(rrect(w, h, r, 4, 0, SCR_Y), z), g });
    const rs = [R4(0.262 - 0.0012, 0.198 - 0.0012, 0.012, CZ - 0.0256, 1), R4(OPW - 0.0012, OPH - 0.0012, 0.014, CZ - 0.0017, 0.62),
      R4(OPW - 0.001, OPH - 0.001, 0.014, CZ + 0.0007, 0.62), R4(OPW + 0.042, OPH + 0.042, 0.03, CZ + 0.0007, 0)];
    const g = loft(rs.map(r => r.pts)), aG = [];
    for (const r of rs) for (let i = 0; i < r.pts.length; i++) aG.push(r.g);
    g.setAttribute('aG', new THREE.Float32BufferAttribute(aG, 1));
    return g.translate(-bezC[0], -bezC[1], -bezC[2]);
  })();
  // --------------------------------------------------- big parts (home) --
  const P = {};   // named part indices
  P.rear = part({ grp: 'case', hp: rearC, inner: false, d: 0.05, w: 0.42, arc: 0.32, lr: [-PI / 2, 0, 0] });
  // as in a real teardown: the rear case slides off, the tube lifts out backwards, the front bezel goes last
  P.bezel = part({ grp: 'case', hp: bezC, inner: false, d: 0.38, w: 0.42, arc: 0.28, lr: [-PI / 2, 0, 0] });
  P.crt = part({ grp: 'crt', hp: crtC, inner: false, d: 0.25, w: 0.4, arc: 0.24, lr: [PI / 2, 0, 0] });
  const shell = [solo(P.rear, rearGeo, mPlastic), solo(P.bezel, bezGeo, mPlastic)];
  const crtMesh = solo(P.crt, crtGeo, mGloss);
  const spill = solo(P.bezel, spillGeo, spillMat);
  spill.renderOrder = 2;
  {
    // rear case details: a carrying handle, vents on the top and the sides, the port panel
    const L = SEAM - BACK, yTop = z => CY0 + (CY1 - CY0) * (1 - 0.055 * (SEAM - z) / L), loc = (x, y, z) => [x - rearC[0], y - rearC[1], z - rearC[2]];
    const tilt = -Math.atan(0.055 * (CY1 - CY0) / L);
    piece('box', P.rear, mat(loc(0, yTop(BACK + 0.038) + 0.0003, BACK + 0.038), [tilt, 0, 0], [0.15, 0.002, 0.026]), '#5a564d');
    for (let i = 0; i < 13; i++) piece('box', P.rear, mat(loc(-0.108 + i * 0.018, yTop(BACK + 0.125) + 0.0003, BACK + 0.125), [tilt, 0, 0], [0.0055, 0.002, 0.1]), '#3d3a34');
    for (const s of [-1, 1]) for (let i = 0; i < 9; i++) {
      const z = BACK + 0.05 + i * 0.013, f = (SEAM - z) / L;
      piece('box', P.rear, mat(loc(s * (CW / 2 * (1 - 0.04 * f) + 0.0002), midY + 0.04, z), null, [0.002, 0.11, 0.0055]), '#3d3a34');
    }
    piece('box', P.rear, mat(loc(0, CY0 + 0.05, BACK - 0.0008), null, [0.25, 0.045, 0.002]), '#4a4740');
    [[-0.095, 0.016, '#a9b0b7'], [-0.06, 0.012, '#a9b0b7'], [-0.025, 0.012, '#a9b0b7'], [0.02, 0.03, '#a9b0b7']].forEach(([x, w, c]) => piece('boxm', P.rear, mat(loc(x, CY0 + 0.05, BACK - 0.002), null, [w, 0.008, 0.003]), c));
    piece('box', P.rear, mat(loc(0.085, CY0 + 0.05, BACK - 0.003), null, [0.026, 0.02, 0.005]), '#161618');
    piece('box', P.rear, mat(loc(-0.13, CY0 + 0.1, BACK + 0.001), null, [0.012, 0.02, 0.006]), '#161618');
  }
  const LB = { w: 0.29, d: 0.29, t: 0.003 }, AB = { w: 0.27, d: 0.3, t: 0.003 };
  P.logic = part({ grp: 'board', hp: [-0.005, CY0 + 0.012, BACK + 0.165], d: 0.42, w: 0.4, arc: 0.2 });
  P.analog = part({ grp: 'board', hp: [-0.152, CY0 + 0.17, -0.13], hr: [0, 0, -PI / 2], d: 0.34, w: 0.42, arc: 0.24 });
  const homeM = pi => new THREE.Matrix4().compose(V(...parts[pi].hp), parts[pi].hq, S1);
  // place a part on a board: board-local x, z on its top side, turned ry about the board's normal
  const tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();
  function onBoard(o, board, B, lx, lz, ry, hy) {
    const m = homeM(board).multiply(mat([lx, B.t / 2 + hy, lz], [0, ry || 0, 0]));
    const q = new THREE.Quaternion();
    m.decompose(tmpP, q, tmpS);
    o.hp = [tmpP.x, tmpP.y, tmpP.z];
    const i = part(o); parts[i].hq = q;
    return i;
  }

  // ------------------------------------------------------ components --
  // sizes are a little larger than life so they read on the table
  const PITCH = 0.0045, SO = 0.0025, HB = 0.006, CHIP_HY = (SO + HB) / 2;
  const nodes = [];   // network nodes: { pi, kind, pins: [[x, z, side]], tw, td }
  function chipPieces(pi, n, wide) {
    const L = n / 2 * PITCH + 0.006, W = wide ? 0.026 : 0.0115, y0 = -CHIP_HY;
    piece('box', pi, mat([0, y0 + SO + HB / 2, 0], null, [L, HB, W]), '#17181a');
    piece('cyl', pi, mat([-L / 2 + 0.0035, y0 + SO + HB + 0.0001, 0], null, [0.004, 0.0004, 0.004]), '#2f3034');
    piece('cyl', pi, mat([-L / 2 + 0.0035, y0 + SO + HB + 0.0001, W / 2 - 0.003], null, [0.0016, 0.0005, 0.0016]), '#45474c');
    const pins = [];
    for (let k = 0; k < n / 2; k++) for (const s of [-1, 1]) {
      const x = -L / 2 + 0.003 + PITCH * (k + 0.5);
      piece('boxm', pi, mat([x, y0 + 0.0036, s * (W / 2 + 0.0011)], [s * 0.22, 0, 0], [0.0017, 0.0068, 0.0011]), '#d4d8dd');
      pins.push({ p: [x, y0 + 0.0008, s * (W / 2 + 0.0022)], d: [0, 0, s] });
    }
    return { L, W, pins };
  }
  function plccPieces(pi, n) {
    const m = n / 4, Sd = m * 0.0032 + 0.006, y0 = -CHIP_HY, pins = [];
    piece('box', pi, mat([0, y0 + SO + HB / 2, 0], null, [Sd, HB, Sd]), '#17181a');
    piece('cyl', pi, mat([-Sd / 2 + 0.004, y0 + SO + HB + 0.0001, -Sd / 2 + 0.004], null, [0.0025, 0.0004, 0.0025]), '#2f3034');
    for (let k = 0; k < m; k++) {
      const u = -Sd / 2 + 0.003 + 0.0032 * (k + 0.5);
      for (const s of [-1, 1]) {
        piece('boxm', pi, mat([u, y0 + SO + 0.002, s * (Sd / 2 + 0.0006)], null, [0.0015, 0.004, 0.0012]), '#d4d8dd');
        piece('boxm', pi, mat([s * (Sd / 2 + 0.0006), y0 + SO + 0.002, u], null, [0.0012, 0.004, 0.0015]), '#d4d8dd');
        pins.push({ p: [u, y0 + SO, s * (Sd / 2 + 0.0012)], d: [0, 0, s] });
      }
    }
    return { L: Sd, W: Sd, pins };
  }
  const RCOL = ['#1b1b1b', '#7a4a26', '#d23a2a', '#ec7a25', '#f0d33a', '#3a9a48', '#2f62c8', '#8a4fc0', '#8d8d8d', '#f2f2f2'];
  function resistorPieces(pi, v) {
    const body = v.film ? '#86b4e0' : '#d9c49a';
    piece('cyl', pi, mat([0, 0, 0], [0, 0, PI / 2], [0.0074, 0.017, 0.0074]), body);
    for (const s of [-1, 1]) {
      piece('cyl', pi, mat([s * 0.0075, 0, 0], [0, 0, PI / 2], [0.0082, 0.0026, 0.0082]), body);
      piece('cylm', pi, mat([s * 0.0155, 0, 0], [0, 0, PI / 2], [0.0012, 0.014, 0.0012]), '#c9ced4');
    }
    [v.a, v.b, v.m, -1].forEach((c, k) => piece('cyl', pi, mat([-0.0052 + k * 0.0031 + (k === 3 ? 0.0014 : 0), 0, 0], [0, 0, PI / 2], [0.0078, 0.0015, 0.0078]), c < 0 ? '#c9a23d' : RCOL[c]));
  }
  function elcoPieces(pi, r, h, sleeve) {
    piece('cyl', pi, mat([0, 0, 0], null, [2 * r, h, 2 * r]), sleeve);
    piece('cylm', pi, mat([0, h / 2 + 0.0002, 0], null, [1.86 * r, 0.0008, 1.86 * r]), '#cfd3d8');
    piece('box', pi, mat([r * 0.93, 0, 0], null, [0.0012, h * 0.94, r * 0.5]), '#cfd5dc');
    for (const s of [-1, 1]) piece('cylm', pi, mat([0, -h / 2 - 0.004, s * r * 0.4], null, [0.0011, 0.008, 0.0011]), '#c9ced4');
  }
  function discPieces(pi, c) {
    piece('cyl', pi, mat([0, 0.004, 0], [PI / 2, 0, 0], [0.011, 0.003, 0.011]), c);
    for (const s of [-1, 1]) piece('cylm', pi, mat([s * 0.0025, -0.0045, 0], null, [0.001, 0.01, 0.001]), '#c9ced4');
  }
  function crystalPieces(pi) {
    piece('boxm', pi, mat([0, 0.002, 0], null, [0.011, 0.012, 0.0048]), '#d7dce2');
    for (const s of [-1, 1]) piece('cylm', pi, mat([s * 0.0055, 0.002, 0], null, [0.0048, 0.012, 0.0048]), '#d7dce2');
    for (const s of [-1, 1]) piece('cylm', pi, mat([s * 0.0024, -0.0075, 0], null, [0.001, 0.008, 0.001]), '#c9ced4');
  }
  // the logic board: chips, resistors, decoupling capacitors, a crystal, memory modules, a battery
  const CHIPS = [[64, 1, 'cpu'], [40, 1], [40, 1], [28, 1], [28, 1], [28, 1], [44, 0, 'plcc'], [44, 0, 'plcc'],
    [20, 0], [20, 0], [20, 0], [20, 0], [16, 0], [16, 0], [16, 0], [16, 0], [16, 0], [14, 0], [14, 0], [14, 0], [14, 0], [14, 0]];
  const onLB = [], onAB = [];
  CHIPS.forEach((c, k) => {
    const pi = part({ grp: 'chip', d: 0.3 + 0.012 * k, w: 0.36, arc: 0.16 + 0.002 * k, spin: 1, axis: [0, 1, 0] });
    const g = c[2] === 'plcc' ? plccPieces(pi, c[0]) : chipPieces(pi, c[0], c[1]);
    nodes.push({ pi, kind: 'chip', pins: g.pins, L: g.L, W: g.W, n: c[0], big: c[0] >= 28 });
    onLB.push({ pi, w: g.L, d: g.W + 0.006, hy: CHIP_HY, chip: g });
  });
  const res = [];
  for (let k = 0; k < 40; k++) {
    const mm = [1, 2, 2, 3, 3, 3, 4, 4, 5][Math.floor(R() * 9)], dg = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82][Math.floor(R() * 12)];
    res.push({ a: Math.floor(dg / 10), b: dg % 10, m: mm, film: R() < 0.3, val: dg * Math.pow(10, mm) });
  }
  res.sort((a, b) => a.val - b.val);
  res.forEach((v, k) => {
    const pi = part({ grp: 'res', d: 0.24 + 0.006 * (k % 30), w: 0.36, arc: 0.14, spin: 1, axis: [1, 0, 0], ord: k });
    resistorPieces(pi, v);
    nodes.push({ pi, kind: 'res', pins: [{ p: [-0.0225, 0, 0], d: [-1, 0, 0] }, { p: [0.0225, 0, 0], d: [1, 0, 0] }] });
    (k % 3 === 2 ? onAB : onLB).push({ pi, w: 0.046, d: 0.01, hy: 0.0041 });
  });
  const elcos = [];
  for (let k = 0; k < 12; k++) elcos.push({ r: 0.0042 + 0.0035 * R(), h: 0.011 + 0.01 * R(), c: R() < 0.6 ? '#23407a' : '#202124' });
  elcos.sort((a, b) => b.r * b.h - a.r * a.h);
  elcos.forEach((e, k) => {
    const pi = part({ grp: 'elco', d: 0.26 + 0.01 * k, w: 0.36, arc: 0.16, lr: [0, 0, PI / 2], ord: k });
    elcoPieces(pi, e.r, e.h, e.c);
    nodes.push({ pi, kind: 'cap', pins: [-1, 1].map(s => ({ p: [0, -e.h / 2 - 0.008, s * e.r * 0.4], d: [0, -1, 0] })) });
    (k % 2 ? onAB : onLB).push({ pi, w: 2 * e.r, d: 2 * e.r, hy: e.h / 2 + 0.004 });
  });
  const DCOL = ['#e39a3a', '#e8c84a', '#3a74c4'];
  for (let k = 0; k < 14; k++) {
    const pi = part({ grp: 'disc', d: 0.28 + 0.008 * k, w: 0.34, arc: 0.12, lr: [PI / 2, 0, 0], ord: k });
    discPieces(pi, DCOL[Math.floor(k / 5) % 3]);
    nodes.push({ pi, kind: 'cap', pins: [-1, 1].map(s => ({ p: [s * 0.0025, -0.0095, 0], d: [0, -1, 0] })) });
    onLB.push({ pi, w: 0.012, d: 0.004, hy: 0.0095 });
  }
  for (let k = 0; k < 2; k++) {
    const pi = part({ grp: 'xtal', d: 0.33 + 0.02 * k, w: 0.34, arc: 0.14, lr: [PI / 2, 0, 0] });
    crystalPieces(pi);
    nodes.push({ pi, kind: 'xtal', pins: [-1, 1].map(s => ({ p: [s * 0.0024, -0.0115, 0], d: [0, -1, 0] })) });
    onLB.push({ pi, w: 0.017, d: 0.006, hy: 0.0115 });
  }
  // memory modules stand in their sockets at a slant
  const simms = [];
  for (let k = 0; k < 4; k++) {
    const pi = part({ grp: 'simm', d: 0.36 + 0.015 * k, w: 0.36, arc: 0.18 });
    piece('box', pi, mat([0, 0, 0], null, [0.13, 0.0022, 0.03]), '#2f8a4e');
    piece('boxm', pi, mat([0, 0, -0.0125], null, [0.124, 0.0024, 0.0045]), GOLD);
    for (let j = 0; j < 8; j++) piece('box', pi, mat([-0.0525 + j * 0.015, 0.0025, 0.004], null, [0.011, 0.003, 0.012]), '#17181a');
    simms.push(pi);
  }
  P.battery = part({ grp: 'misc', d: 0.4, w: 0.34, arc: 0.12, lr: [0, 0, PI / 2] });
  piece('cylm', P.battery, mat([0, 0, 0], null, [0.0145, 0.025, 0.0145]), '#9aa4ae');
  piece('cyl', P.battery, mat([0, 0.0005, 0], null, [0.0152, 0.018, 0.0152]), '#2a4a8c');
  // analogue board parts that are not wired: flyback transformer, heat sinks, a mains transformer, trimmers, a fuse
  P.flyback = part({ grp: 'ana', d: 0.3, w: 0.4, arc: 0.2 });
  piece('box', P.flyback, mat([0, -0.006, 0], null, [0.042, 0.03, 0.036]), '#1d1e20');
  piece('cyl', P.flyback, mat([0, 0.016, 0], null, [0.032, 0.016, 0.032]), '#26272a');
  for (let j = 0; j < 4; j++) piece('cyl', P.flyback, mat([0, 0.01 + j * 0.004, 0], null, [0.035, 0.0015, 0.035]), '#2c2d30');
  const heat = [];
  for (let k = 0; k < 2; k++) {
    const pi = part({ grp: 'ana', d: 0.32 + 0.02 * k, w: 0.38, arc: 0.18 });
    for (let j = 0; j < 6; j++) piece('boxm', pi, mat([-0.0175 + j * 0.007, 0.003, 0], null, [0.0016, 0.028, 0.03]), '#aeb6bf');
    piece('boxm', pi, mat([0, -0.012, 0], null, [0.04, 0.004, 0.03]), '#aeb6bf');
    piece('box', pi, mat([0, -0.008, 0.017], null, [0.012, 0.012, 0.004]), '#17181a');
    heat.push(pi);
  }
  P.xfmr = part({ grp: 'ana', d: 0.35, w: 0.38, arc: 0.18 });
  piece('boxm', P.xfmr, mat([0, 0, 0], null, [0.034, 0.028, 0.03]), '#6f7378');
  piece('box', P.xfmr, mat([0, 0.002, 0], null, [0.02, 0.03, 0.033]), '#e2c24a');
  piece('boxm', P.xfmr, mat([0, -0.0135, 0], null, [0.054, 0.002, 0.016]), '#8a9097');
  const trims = [];
  for (let k = 0; k < 3; k++) {
    const pi = part({ grp: 'misc', d: 0.3 + 0.01 * k, w: 0.32, arc: 0.1 });
    piece('box', pi, mat([0, 0, 0], null, [0.01, 0.006, 0.01]), '#2f62c8');
    piece('cyl', pi, mat([0, 0.0035, 0], null, [0.006, 0.0012, 0.006]), '#f2f2f2');
    trims.push(pi);
  }
  P.fuse = part({ grp: 'misc', d: 0.33, w: 0.32, arc: 0.1 });
  piece('cyl', P.fuse, mat([0, 0, 0], [0, 0, PI / 2], [0.0058, 0.016, 0.0058]), '#e9f0f2');
  for (const s of [-1, 1]) piece('cylm', P.fuse, mat([s * 0.0095, 0, 0], [0, 0, PI / 2], [0.0064, 0.005, 0.0064]), '#cfd3d8');
  [[P.flyback, 0.025, 0.07, 0.042, 0.036, 0.021], [heat[0], -0.07, 0.08, 0.04, 0.03, 0.016], [heat[1], -0.07, -0.03, 0.04, 0.03, 0.016],
    [P.xfmr, 0.06, -0.08, 0.034, 0.03, 0.014], [trims[0], 0.1, 0.1, 0.01, 0.01, 0.003], [trims[1], 0.1, 0.12, 0.01, 0.01, 0.003],
    [trims[2], 0.1, 0.08, 0.01, 0.01, 0.003], [P.fuse, -0.1, -0.12, 0.026, 0.006, 0.003]].forEach(([pi, x, z, w, d, hy]) => onAB.push({ pi, w, d, hy, at: [x, z] }));
  // mount: pack each board's parts in rows; the board texture gets their footprints
  const foot = [];
  function mount(list, board, B, v0, seed) {
    const r = K.rng(seed);
    let x = -B.w / 2 + 0.012, z = -B.d / 2 + 0.014, rowD = 0;
    for (const it of list) {
      let cx, cz;
      if (it.at) { cx = it.at[0]; cz = it.at[1]; } else {
        if (x + it.w > B.w / 2 - 0.01) { x = -B.w / 2 + 0.012; z += rowD + 0.012; rowD = 0; }
        if (z + it.d > B.d / 2 - 0.01) z = -B.d / 2 + 0.014 + r() * 0.01;
        cx = x + it.w / 2; cz = z + it.d / 2; x += it.w + 0.009 + r() * 0.004; rowD = Math.max(rowD, it.d);
      }
      const m = homeM(board).multiply(mat([cx, B.t / 2 + it.hy, cz]));
      const q = new THREE.Quaternion();
      m.decompose(tmpP, q, tmpS);
      parts[it.pi].hp = [tmpP.x, tmpP.y, tmpP.z]; parts[it.pi].hq = q;
      foot.push({ x: (cx / B.w + 0.5) * 512, y: v0 + (cz / B.d + 0.5) * 256, w: it.w / B.w * 512, h: it.d / B.d * 256, chip: it.chip });
    }
  }
  // the CPU and ROMs go first, near the back; memory modules near the front
  mount(onLB, P.logic, LB, 0, 3);
  mount(onAB, P.analog, AB, 256, 4);
  simms.forEach((pi, k) => {
    const m = homeM(P.logic).multiply(mat([0.06, 0.03, 0.09 + k * 0.012], [-1.0, 0, 0]));
    const q = new THREE.Quaternion(); m.decompose(tmpP, q, tmpS);
    parts[pi].hp = [tmpP.x, tmpP.y, tmpP.z]; parts[pi].hq = q;
  });
  {
    const m = homeM(P.logic).multiply(mat([-0.11, 0.01, 0.12], [0, 0, PI / 2])), q = new THREE.Quaternion();
    m.decompose(tmpP, q, tmpS); parts[P.battery].hp = [tmpP.x, tmpP.y, tmpP.z]; parts[P.battery].hq = q;
  }
  function pcbTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const g = cv.getContext('2d'), r = K.rng(77);
    g.fillStyle = '#1f6a3b'; g.fillRect(0, 0, 512, 512);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const half of [0, 1]) {
      const y0 = half * 256;
      for (let k = 0; k < 240; k++) {
        let x = 10 + r() * 492, y = y0 + 10 + r() * 236;
        g.strokeStyle = half ? '#3a8b55' : '#37945a'; g.lineWidth = r() < 0.12 ? 3.2 : 1.3;
        g.beginPath(); g.moveTo(x, y);
        let dir = Math.floor(r() * 4) * PI / 2;
        for (let s = 0; s < 3; s++) {
          const len = 8 + r() * 55;
          x = K.clamp(x + Math.cos(dir) * len, 8, 504); y = K.clamp(y + Math.sin(dir) * len, y0 + 8, y0 + 248);
          g.lineTo(x, y);
          dir += (r() < 0.5 ? 1 : -1) * PI / (r() < 0.5 ? 2 : 4);
        }
        g.stroke();
        g.fillStyle = '#caa54c'; g.beginPath(); g.arc(x, y, 1.9, 0, 2 * PI); g.fill();
      }
    }
    for (const f of foot) {
      g.strokeStyle = '#e4ece4'; g.lineWidth = 1;
      g.strokeRect(f.x - f.w / 2 - 1.5, f.y - f.h / 2 - 1.5, f.w + 3, f.h + 3);
      g.fillStyle = '#d0ab52';
      if (f.chip) {
        const n = f.chip.pins.length / 2;
        for (let k = 0; k < n; k++) for (const s of [-1, 1]) { const px = f.x - f.w / 2 + (k + 0.5) / n * f.w; g.fillRect(px - 1.2, f.y + s * f.h / 2 - 1.2, 2.4, 2.4); }
      } else for (const s of [-1, 1]) { g.beginPath(); g.arc(f.x + s * f.w * 0.42, f.y, 1.8, 0, 2 * PI); g.fill(); }
    }
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    return tex;
  }
  const mBoard = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, map: pcbTexture() }));
  LIT.push(mBoard);
  // the bare boards carry the texture; sockets and ports are plain plastic and metal
  const boardGeo = (B, v0) => Bld().add(box(B.w, B.t, B.d), null, '#ffffff', (i, x, y, z) => (i >= 12 && i < 24 ? [x / B.w + 0.5, v0 + (0.5 - z / B.d) * 0.5] : [0.004, 0.004])).geo();
  solo(P.logic, boardGeo(LB, 0.5), mBoard);
  solo(P.analog, boardGeo(AB, 0), mBoard);
  {
    // ports along the back edge, the memory sockets, the drive connector
    const b = Bld(), e = -LB.d / 2 + 0.006;
    b.add(box(0.034, 0.012, 0.008), mat([-0.08, 0.008, e]), '#9aa1a8').add(box(0.05, 0.012, 0.008), mat([-0.02, 0.008, e]), '#9aa1a8');
    for (let k = 0; k < 3; k++) b.add(cyl(0.006, 0.006, 0.012, 12), mat([0.04 + k * 0.024, 0.008, e], [PI / 2, 0, 0]), '#2a2b2e');
    for (let k = 0; k < 4; k++) b.add(box(0.135, 0.008, 0.006), mat([0.06, 0.0055, 0.078 + k * 0.012]), '#f0eee6');
    b.add(box(0.04, 0.006, 0.01), mat([-0.06, 0.0045, LB.d / 2 - 0.012]), '#f0eee6');
    solo(P.logic, b.geo(), mPlastic);
    const c = Bld();
    c.add(box(0.03, 0.012, 0.012), mat([0.11, 0.0075, -0.13]), '#f0eee6').add(box(0.02, 0.01, 0.01), mat([-0.1, 0.0065, 0.13]), '#f0eee6');
    solo(P.analog, c.geo(), mPlastic);
  }
  // ---------------------------------------------------------- keyboard --
  const KB = { x: 0, z: 0.36, w: 0.56, d: 0.19, h0: 0.016, h1: 0.03 }, U = 0.0268;
  const kbTop = z => KB.h0 + (KB.h1 - KB.h0) * (0.5 - z / KB.d);   // local z: + towards the front
  const KSLOPE = Math.atan((KB.h1 - KB.h0) / KB.d);
  P.kb = part({ grp: 'kb', hp: [KB.x, FLOOR, KB.z], inner: false, d: 0.36, w: 0.4, arc: 0.12 });
  {
    const b = Bld(), o = rrect(KB.w, KB.d, 0.014, 4), oi = rrect(KB.w - 0.008, KB.d - 0.008, 0.01, 4);
    const ring = (pts, yf) => pts.map(p => [p[0], yf(-p[1]), -p[1]]);
    b.add(loft([ring(o, () => 0.001), ring(o, z => kbTop(z) - 0.003), ring(oi, z => kbTop(z))]), null, BEIGE);
    b.add(fanUp(ring(oi, z => kbTop(z)), [0, kbTop(0), 0]), null, BEIGE);
    // the key well, a little darker
    b.add(box(0.535, 0.0016, 0.139), mat([0, kbTop(0.012) + 0.0004, 0.012], [KSLOPE, 0, 0]), BEIGE3);
    b.add(box(KB.w - 0.02, 0.003, KB.d - 0.03), mat([0, 0.0005, 0]), '#8f8a7e');
    solo(P.kb, b.geo(), mPlastic);
  }
  // Apple-style extended layout without function keys: 5 rows of the main block plus a numeric keypad
  const ROWS = [
    [[1, 1], ...Array(12).fill([1, 0]), [2, 1]],
    [[1.5, 1], ...Array(12).fill([1, 0]), [1.5, 0]],
    [[1.75, 1], ...Array(11).fill([1, 0]), [2.25, 1]],
    [[2.25, 1], ...Array(10).fill([1, 0]), [2.75, 1]],
    [[1.25, 1], [1.25, 1], [1.5, 1], [1, 0], [6, 0], [1, 1], [1, 1], [1, 1], [1, 1]],
  ];
  const PAD = [[[1, 1], [1, 1], [1, 1], [1, 1]], [[1, 0], [1, 0], [1, 0], [1, 1]], [[1, 0], [1, 0], [1, 0], [1, 1]], [[1, 0], [1, 0], [1, 0], [1, 1, 2]], [[2, 0], [1, 0]]];
  const keys = [];
  const kx0 = -19.5 * U / 2, kz0 = -2.5 * U + 0.012;
  ROWS.forEach((row, r) => { let x = kx0; row.forEach(([w, mod]) => { keys.push({ x: x + w * U / 2, z: kz0 + (r + 0.5) * U, w, h: 1, mod, r }); x += w * U; }); });
  PAD.forEach((row, r) => { let x = kx0 + 15.5 * U; row.forEach(([w, mod, h]) => { if (r === 4 && x > kx0 + 18 * U) return; keys.push({ x: x + w * U / 2, z: kz0 + (r + 0.5 + ((h || 1) - 1) / 2) * U, w, h: h || 1, mod, r }); x += w * U; }); });
  keys.push({ x: 0, z: kz0 - 0.55 * U, w: 1.4, h: 0.7, mod: 1, r: -1, power: true });
  keys.forEach((k, i) => {
    const y = kbTop(k.z) + 0.0012;
    k.pi = part({ grp: 'key', hp: [KB.x + k.x, FLOOR + y, KB.z + k.z], hr: [KSLOPE, 0, 0], inner: false, d: 0.08 + 0.035 * (k.r + 1) + 0.004 * (k.x / U + 10), w: 0.26, arc: 0.07 });
    piece('key', k.pi, mat([0, 0, 0], null, [k.w * U - 0.0035, 0.0105, k.h * U - 0.0035]), k.power ? '#99927f' : k.mod ? '#938c7b' : '#aca593');
  });

  // ------------------------------------------------------------- mouse --
  const MS = { x: 0.43, z: 0.35, yaw: -0.12 };
  const msAt = (lx, ly, lz) => [MS.x + lx * Math.cos(MS.yaw) + lz * Math.sin(MS.yaw), FLOOR + ly, MS.z - lx * Math.sin(MS.yaw) + lz * Math.cos(MS.yaw)];
  P.mouse = part({ grp: 'mouse', hp: msAt(0, 0, 0), hr: [0, MS.yaw, 0], inner: false, d: 0.16, w: 0.36, arc: 0.12 });
  {
    const b = Bld(), base = rrect(0.084, 0.148, 0.012, 4), mid = rrect(0.084, 0.148, 0.014, 4), top = rrect(0.076, 0.138, 0.016, 4);
    const hy = z => 0.026 + 0.006 * (0.5 + z / 0.148);   // a little higher at the back
    const ring = (pts, yf) => pts.map(p => [p[0], yf(-p[1]), -p[1]]);
    b.add(loft([ring(base, () => 0.002), ring(mid, z => hy(z) - 0.004), ring(top, z => hy(z))]), null, BEIGE);
    b.add(fanUp(ring(top, z => hy(z)), [0, hy(0), 0]), null, BEIGE);
    solo(P.mouse, b.geo(), mPlastic);
  }
  P.mbutton = part({ grp: 'mouse', hp: msAt(0, 0.0262, -0.052), hr: [-0.04, MS.yaw, 0], inner: false, d: 0.14, w: 0.34, arc: 0.1 });
  piece('box', P.mbutton, mat([0, 0, 0], null, [0.068, 0.004, 0.036]), BEIGE2);
  P.mball = part({ grp: 'mouse', hp: msAt(0, 0.012, 0.01), d: 0.22, w: 0.36, arc: 0.1, spin: 2, axis: [1, 0, 0] });
  piece('sph', P.mball, mat([0, 0, 0], null, 0.024), '#47474c');
  P.mplate = part({ grp: 'mouse', hp: msAt(0, 0.0015, 0.0), hr: [0, MS.yaw, 0], d: 0.2, w: 0.36, arc: 0.1 });
  piece('box', P.mplate, mat([0, 0, 0], null, [0.078, 0.002, 0.14]), BEIGE2);
  piece('ring', P.mplate, mat([0, 0.001, 0.01], [PI / 2, 0, 0], 0.034), '#6f6a60');
  for (let k = 0; k < 2; k++) {
    const pi = part({ grp: 'mouse', hp: msAt(k ? 0.014 : -0.014, 0.012, k ? 0.0 : 0.02), hr: [0, k ? 0 : PI / 2, 0], d: 0.23 + 0.01 * k, w: 0.32, arc: 0.08, lr: [0, 0, 0] });
    piece('cylm', pi, mat([0, 0, 0], [0, 0, PI / 2], [0.004, 0.03, 0.004]), '#b9bec4');
    piece('cyl', pi, mat([0.012, 0, 0], [0, 0, PI / 2], [0.014, 0.0012, 0.014]), '#2a2b2e');
    P['roller' + k] = pi;
  }
  // ---------------------------------------------- drive, power, speaker, fan --
  P.floppy = part({ grp: 'drive', hp: [SLOT[0], SLOT[1] - 0.006, CZ - 0.114], d: 0.26, w: 0.4, arc: 0.2 });
  {
    const b = Bld(), W = 0.15, H = 0.03, D = 0.2;
    b.add(box(W, 0.002, D), mat([0, H / 2 - 0.001, 0]), '#b9c0c7');
    b.add(box(W - 0.006, H - 0.004, D - 0.004), mat([0, -0.001, -0.002]), '#6d737a');
    b.add(box(W, 0.002, D), mat([0, -H / 2 + 0.001, 0]), '#8e959c');
    b.add(box(W + 0.002, H + 0.002, 0.008), mat([0, 0, D / 2 - 0.003]), '#232427');
    b.add(box(0.112, 0.0055, 0.002), mat([0, 0.006, D / 2 + 0.0012]), '#070708');
    b.add(cyl(0.022, 0.022, 0.004, 24), mat([0, H / 2 + 0.002, 0.01]), '#a9b0b8');
    b.add(box(0.05, 0.003, 0.03), mat([0.04, H / 2 + 0.0015, -0.06]), PCB);
    b.add(box(0.012, 0.004, 0.06), mat([-0.045, H / 2 + 0.002, -0.03]), '#2c2d30');
    solo(P.floppy, b.geo(), mMetal);
  }
  P.psu = part({ grp: 'drive', hp: [0.105, CY0 + 0.045, -0.21], d: 0.3, w: 0.4, arc: 0.22 });
  {
    const b = Bld(), W = 0.1, H = 0.06, D = 0.11;
    b.add(box(W, H, D), null, '#b3bac2');
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) b.add(box(0.008, 0.002, 0.012), mat([-0.03 + j * 0.02, H / 2 + 0.0004, -0.04 + i * 0.016]), '#3a3e44');
    b.add(box(0.028, 0.014, 0.02), mat([0.0, -0.008, D / 2 + 0.008]), DARK);
    b.add(box(0.016, 0.012, 0.004), mat([0.03, 0.01, D / 2 + 0.002]), '#c43c2e');
    solo(P.psu, b.geo(), mMetal);
  }
  P.speaker = part({ grp: 'drive', hp: [-0.105, CY0 + 0.07, CZ - 0.035], hr: [PI / 2, 0, 0], d: 0.24, w: 0.38, arc: 0.18 });
  {
    const prof = [[0.012, 0.0], [0.03, 0.002], [0.034, 0.006], [0.036, 0.0075], [0.033, 0.007], [0.012, -0.004], [0.008, -0.004], [0.0, -0.002]];
    const cone = new THREE.LatheGeometry([[0, 0.0005], [0.009, 0.0008], [0.01, -0.003], [0.031, 0.004], [0.034, 0.0045]].map(p => new THREE.Vector2(p[0], p[1])), 20);
    const b = Bld();
    b.add(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 20), null, '#9aa1a8');
    b.add(cone, null, '#2e2c2a');
    b.add(cyl(0.017, 0.017, 0.012, 18), mat([0, -0.011, 0]), '#45484d');
    b.add(cyl(0.009, 0.009, 0.0016, 14), mat([0, -0.0028, 0]), '#3a3835');
    for (const sx of [-1, 1]) b.add(box(0.012, 0.0015, 0.01), mat([sx * 0.038, 0.0066, 0]), '#9aa1a8');
    solo(P.speaker, b.geo(), mMetal);
  }
  P.fan = part({ grp: 'drive', hp: [-0.13, CY0 + 0.3, -0.24], hr: [0, 0, PI / 2], d: 0.28, w: 0.38, arc: 0.2 });
  {
    const b = Bld(), S = 0.07, Tk = 0.02;
    const sh = new THREE.Shape(rrect(S, S, 0.006, 3).map(p => new THREE.Vector2(p[0], p[1])));
    sh.holes.push(new THREE.Path(rrect(0.064, 0.064, 0.031, 5).map(p => new THREE.Vector2(p[0], p[1]))));
    const fr = new THREE.ExtrudeGeometry(sh, { depth: Tk, bevelEnabled: false, curveSegments: 4 });
    fr.translate(0, 0, -Tk / 2); fr.rotateX(PI / 2);
    b.add(fr, null, '#2b2c2f');
    b.add(cyl(0.012, 0.012, Tk * 0.8, 18), null, '#36373b');
    for (let k = 0; k < 7; k++) b.add(box(0.022, 0.0014, 0.012), mat([Math.cos(k / 7 * 2 * PI) * 0.022, 0, Math.sin(k / 7 * 2 * PI) * 0.022], [0.5, -k / 7 * 2 * PI, 0]), '#36373b');
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.add(cyl(0.0024, 0.0024, Tk + 0.0006, 8), mat([sx * 0.029, 0, sz * 0.029]), '#16171a');
    solo(P.fan, b.geo(), mPlastic);
  }
  // rubber feet, nylon standoffs, plastic clips, steel brackets, washers, springs
  const feet = [], small = [];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], k) => {
    const pi = part({ grp: 'feet', hp: [sx * 0.13, CY0 - 0.003, sz < 0 ? BACK + 0.04 : CZ - 0.04], inner: false, d: 0.07 + 0.01 * k, w: 0.3, arc: 0.1 });
    piece('cyl', pi, mat([0, 0, 0], null, [0.018, 0.006, 0.018]), '#3b3b3d');
    feet.push(pi);
  });
  const inside = () => [(R() - 0.5) * 0.28, CY0 + 0.03 + R() * 0.38, BACK + 0.03 + R() * 0.32];
  for (let k = 0; k < 6; k++) { const pi = part({ grp: 'standoff', hp: inside(), d: 0.4 + 0.01 * k, w: 0.32, arc: 0.1 }); piece('cyl', pi, mat([0, 0, 0], null, [0.006, 0.012, 0.006]), '#efece2'); small.push(pi); }
  for (let k = 0; k < 6; k++) {
    const pi = part({ grp: 'clip', hp: inside(), d: 0.38 + 0.01 * k, w: 0.32, arc: 0.1 });
    piece('box', pi, mat([0, 0, 0], null, [0.016, 0.004, 0.008]), '#e8e3d6'); piece('box', pi, mat([0.0065, 0.004, 0], null, [0.003, 0.008, 0.008]), '#e8e3d6');
    small.push(pi);
  }
  for (let k = 0; k < 5; k++) {
    const pi = part({ grp: 'bracket', hp: inside(), d: 0.42 + 0.01 * k, w: 0.34, arc: 0.12 }), L = 0.03 + 0.012 * k;
    piece('boxm', pi, mat([0, 0, 0], null, [L, 0.0015, 0.014]), '#aeb6bf'); piece('boxm', pi, mat([L / 2 - 0.0008, 0.006, 0], null, [0.0015, 0.012, 0.014]), '#aeb6bf');
    small.push(pi);
  }
  for (let k = 0; k < 10; k++) { const pi = part({ grp: 'washer', hp: inside(), d: 0.3 + 0.015 * k, w: 0.3, arc: 0.1, lr: [PI / 2, 0, 0] }); piece('ring', pi, mat([0, 0, 0], null, 0.012 + 0.002 * (k % 3)), '#c8cdd3'); small.push(pi); }
  for (let k = 0; k < 4; k++) {
    const pi = part({ grp: 'spring', hp: inside(), d: 0.33 + 0.02 * k, w: 0.32, arc: 0.12, lr: [0, 0, PI / 2] }), r = 0.0026 + 0.0008 * k;
    piece('spring', pi, mat([0, 0, 0], null, [r, 0.004 + 0.0012 * k, r]), '#c9ced4');
    small.push(pi);
  }

  // ------------------------------------------------------------ screws --
  // long case screws at the back first, then the rest of each part's screws
  const screws = [];
  function screw(hp, hr, d, long) {
    const pi = part({ grp: long ? 'screwL' : 'screw', hp, hr, d, w: 0.3, arc: 0.1, spin: long ? 4 : 3, axis: [0, 1, 0], inner: !long, lr: [-PI / 2, 0, 0] });
    const sc = long ? 0.012 : 0.0095 + 0.002 * R();
    piece(long ? 'screwL' : 'screw', pi, mat([0, 0, 0], null, sc), long ? '#cfd4da' : '#b9bfc6');
    parts[pi].len = sc * (long ? 4.7 : 1.6);
    screws.push(pi);
    return pi;
  }
  [[-0.05, CY1 - 0.065], [0.05, CY1 - 0.065], [-0.12, CY0 + 0.03], [0.12, CY0 + 0.03], [0, CY0 + 0.1]].forEach(([x, y], k) => screw([x, y, BACK - 0.002], [-PI / 2, 0, 0], 0.005 * k, true));
  // every other screw sits where it holds something, in the frame of its part: [x, y, z, head direction]
  function screwsOn(pi, list, d0) {
    list.forEach(([x, y, z, r], k) => {
      const m = homeM(pi).multiply(mat([x, y, z], r)), q = new THREE.Quaternion();
      m.decompose(tmpP, q, tmpS);
      parts[screw([tmpP.x, tmpP.y, tmpP.z], null, d0 - 0.03 + 0.006 * k)].hq = q;
    });
  }
  const UP = [0, 0, 0], DOWN = [PI, 0, 0], BACKW = [-PI / 2, 0, 0];
  const corners = (w, d, y, r, mid) => [[-1, -1], [1, -1], [1, 1], [-1, 1], ...(mid ? [[-1, 0], [1, 0]] : [])].map(([sx, sz]) => [sx * w, y, sz * d, r]);
  screwsOn(P.crt, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [sx * (FW / 2 + 0.0037), sy * (FH / 2 + 0.0037), FACE_Z - 0.0316 - crtC[2], BACKW]), 0.25);
  screwsOn(P.logic, corners(LB.w / 2 - 0.007, LB.d / 2 - 0.007, LB.t / 2, UP, true), 0.42);
  screwsOn(P.analog, corners(AB.w / 2 - 0.007, AB.d / 2 - 0.007, AB.t / 2, UP, true), 0.34);
  screwsOn(P.floppy, corners(0.06, 0.07, -0.016, DOWN), 0.26);
  screwsOn(P.psu, corners(0.042, 0.047, 0.03, UP), 0.3);
  screwsOn(P.fan, corners(0.029, 0.029, 0.0103, UP), 0.28);
  screwsOn(P.speaker, [[-0.04, 0.0074, 0, UP], [0.04, 0.0074, 0, UP]], 0.24);
  heat.forEach((pi, k) => screwsOn(pi, [[0, -0.008, 0.019, [PI / 2, 0, 0]]], 0.33 + 0.02 * k));
  screwsOn(P.xfmr, [[-0.022, -0.012, 0, UP], [0.022, -0.012, 0, UP]], 0.36);
  for (let k = 0; k < 7; k++) screw([KB.x + (k / 6 - 0.5) * 0.48, FLOOR + 0.006, KB.z + (k % 2 ? 0.05 : -0.05)], DOWN, 0.3 + 0.005 * k);
  screw(msAt(0, 0.006, 0.04), DOWN, 0.18);
  // spares for the chassis
  for (let k = 0; k < 6; k++) screw(inside(), UP, 0.32 + 0.015 * k);
  // ------------------------------------------------------------ cables --
  // each cable is one piece, built where it runs in the computer and centred on its own part;
  // the long ones also get a second shape (a neat flat coil) that they morph into as they land
  const mCable = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, morphTargets: true, morphNormals: true }));
  LIT.push(mCable);
  const coils = [];
  function cable(o, pts, r, c, extra, coil) {
    const ctr = pts.reduce((s, p) => K.v3.add(s, K.v3.mul(p, 1 / pts.length)), [0, 0, 0]);
    const loc = pts.map(p => K.v3.sub(p, ctr)), n = coil ? 110 : loc.length * 12;
    const build = l => {
      const b = Bld();
      b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(l.map(p => V(p[0], p[1], p[2]))), n, r, 6, false), null, c);
      if (extra) extra(b, l);
      return b.geo();
    };
    const g = build(loc), pi = part(Object.assign({ grp: 'cable', hp: ctr }, o));
    if (!coil) { solo(pi, g, mPlastic); return pi; }
    const gl = build(coil);
    g.morphAttributes.position = [gl.attributes.position]; g.morphAttributes.normal = [gl.attributes.normal];
    gl.computeBoundingBox(); parts[pi].layBox = gl.boundingBox;
    coils.push({ pi, mesh: solo(pi, g, mCable) });
    return pi;
  }
  // a flat spiral of the given length, lying on the table (y is the height of the plugs' centres)
  function spiral(len, r0, turns, y) {
    const k = len / (2 * PI * turns), r1 = 2 * k - r0, out = [];
    for (let i = 0; i <= 64; i++) { const f = i / 64, a = f * turns * 2 * PI, rr = r0 + (r1 - r0) * f; out.push([rr * Math.cos(a), y, rr * Math.sin(a)]); }
    const l = out[64], q = out[63], d = K.v3.norm(K.v3.sub(l, q));
    out.push(K.v3.add(l, K.v3.mul(d, 0.02)));
    return out;
  }
  const plen = pts => pts.reduce((s, p, i) => s + (i ? K.v3.dist(p, pts[i - 1]) : 0), 0);
  const plug = (b, p, q, c) => { const d = K.v3.norm(K.v3.sub(p, q)); b.add(box(0.011, 0.009, 0.016), mat(K.v3.add(p, K.v3.mul(d, 0.006)), [0, Math.atan2(d[0], d[2]), 0]), c); };
  const F = FLOOR;
  {
    const kp = [[-0.215, F + 0.012, 0.27], [-0.232, F + 0.004, 0.24], [-0.255, F + 0.003, 0.16], [-0.25, F + 0.003, 0.0],
      [-0.235, F + 0.003, -0.2], [-0.2, F + 0.003, -0.33], [-0.125, F + 0.004, -0.345], [-0.092, F + 0.022, -0.318], [-0.09, F + 0.04, -0.304]];
    P.kbCable = cable({ inner: false, d: 0.1, w: 0.36, arc: 0.12 }, kp, 0.0028, '#c4bdac',
      (b, l) => { plug(b, l[0], l[1], '#8f897c'); plug(b, l[l.length - 1], l[l.length - 2], '#8f897c'); }, spiral(plen(kp) - 0.02, 0.03, 2.25, 0.0045));
    const mp = [msAt(0, 0.009, -0.074), msAt(0, 0.003, -0.1), [0.385, F + 0.003, 0.228], [0.33, F + 0.003, 0.218], [0.296, F + 0.004, 0.25], [0.284, F + 0.012, 0.285]];
    P.msCable = cable({ inner: false, d: 0.12, w: 0.34, arc: 0.1 }, mp, 0.0024, '#c4bdac',
      (b, l) => plug(b, l[l.length - 1], l[l.length - 2], '#8f897c'), spiral(plen(mp) - 0.02, 0.022, 1.6, 0.0045));
  }
  // the floppy's flat ribbon cable, grey with a red edge
  P.ribbon = part({ grp: 'cable', hp: [0.03, CY0 + 0.03, -0.06], d: 0.3, w: 0.38, arc: 0.16 });
  {
    const curve = new THREE.CatmullRomCurve3([V(-0.1, 0, -0.04), V(-0.02, 0, -0.07), V(0.05, 0, -0.03), V(0.1, 0, 0.05)]);
    const b = Bld(), W = 0.03, pos = [], cols = [], N = 40, lanes = [[-0.5, -0.4, '#b8443a'], [-0.4, 0.5, '#9a9ea4']];
    for (let i = 0; i < N; i++) {
      const p0 = curve.getPoint(i / N), p1 = curve.getPoint((i + 1) / N), t0 = curve.getTangent(i / N), t1 = curve.getTangent((i + 1) / N);
      const s0 = V(-t0.z, 0, t0.x).normalize(), s1 = V(-t1.z, 0, t1.x).normalize();
      for (const [a, c2, cl] of lanes) for (const y of [0.0007, -0.0007]) {
        const A = p0.clone().addScaledVector(s0, a * W), B = p0.clone().addScaledVector(s0, c2 * W), C = p1.clone().addScaledVector(s1, c2 * W), D = p1.clone().addScaledVector(s1, a * W);
        const q = y > 0 ? [A, B, C, A, C, D] : [A, C, B, A, D, C];
        for (const v of q) { pos.push(v.x, v.y + y, v.z); cols.push(...K.rgb(cl)); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    if (g.attributes.normal.array[1] < 0) { const a = g.attributes.position.array; for (let k = 0; k < a.length; k += 9) for (let m = 0; m < 3; m++) { const t = a[k + 3 + m]; a[k + 3 + m] = a[k + 6 + m]; a[k + 6 + m] = t; } g.computeVertexNormals(); }
    b.add(g, null, '#ffffff');
    const gg = b.geo(); gg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    for (const u of [0, 1]) { const p = curve.getPoint(u), t = curve.getTangent(u); gg.userData.ends = gg.userData.ends || []; gg.userData.ends.push([p, t]); }
    const eb = Bld();
    for (const [p, t] of gg.userData.ends) eb.add(box(0.034, 0.007, 0.01), mat([p.x, p.y + 0.002, p.z], [0, Math.atan2(t.x, t.z) + PI / 2, 0]), '#232427');
    solo(P.ribbon, K.merge([gg, eb.geo()]), mPlastic);
  }
  P.anode = cable({ d: 0.29, w: 0.38, arc: 0.18 }, [[-0.14, SCR_Y + 0.07, -0.08], [-0.09, SCR_Y + 0.1, -0.05], [-0.03, SCR_Y + 0.1, -0.08], [0.0, SCR_Y + 0.1, -0.12]], 0.0035, '#b8322a',
    (b, l) => b.add(cyl(0.003, 0.014, 0.008, 16), mat(l[l.length - 1]), '#1c1c1e'));
  P.harness = part({ grp: 'cable', hp: [-0.06, SCR_Y - 0.04, -0.2], d: 0.31, w: 0.38, arc: 0.16 });
  {
    const b = Bld();
    ['#c8473c', '#1c1c1e', '#2f62c8', '#e0c23e'].forEach((c, k) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const x = -0.09 + i * 0.0225; pts.push([x, 0.0016 * Math.sin(i * 1.7 + k * 1.6), (k - 1.5) * 0.0032 + 0.012 * Math.sin(i * 0.8)]); }
      b.add(K.tube(pts, 0.0016, 60, 5), null, c);
    });
    b.add(box(0.016, 0.008, 0.018), mat([0.095, 0, 0.012 * Math.sin(6.4)]), '#f0eee6');
    b.add(box(0.012, 0.006, 0.016), mat([-0.093, 0, 0]), '#f0eee6');
    solo(P.harness, b.geo(), mPlastic);
  }
  // ------------------------------------------------------ the teardown --
  // every part's footprint in its lying pose, from the boxes of its pieces
  const pieceBoxes = parts.map(() => []);
  for (const k of kindList) { const g = KINDS[k].geo; g.computeBoundingBox(); for (const it of KINDS[k].list) pieceBoxes[it.pi].push([g.boundingBox, it.m]); }
  for (const s of solos) { s.mesh.geometry.computeBoundingBox(); pieceBoxes[s.pi].push([s.mesh.geometry.boundingBox, s.local || new THREE.Matrix4()]); }
  function aabb(pi, q) {
    const rm = new THREE.Matrix4().makeRotationFromQuaternion(q), bb = new THREE.Box3(), tb = new THREE.Box3();
    for (const [b, m] of pieceBoxes[pi]) bb.union(tb.copy(b).applyMatrix4(m).applyMatrix4(rm));
    return bb;
  }
  const layQ = (pi, yaw) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw || 0, 0)).multiply(quat(parts[pi].lr || [0, 0, 0]));
  // the box of a part lying with rotation q (coiled cables have their own laid shape)
  const layBox = (pi, q) => (parts[pi].layBox ? parts[pi].layBox.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)) : aabb(pi, q));
  function size(pi, yaw) { const b = layBox(pi, layQ(pi, yaw)); return [b.max.x - b.min.x, b.max.z - b.min.z]; }
  // lay a part down with its footprint centred on (x, z)
  function place(pi, x, z, yaw) {
    const p = parts[pi], q = layQ(pi, yaw), b = layBox(pi, q);
    p.lq = q; p.lp = [x - (b.min.x + b.max.x) / 2, FLOOR - b.min.y + 0.0004, z - (b.min.z + b.max.z) / 2];
    p.at = [x, z];
  }
  // neat rows: parts left to right from x0 to x1, wrapping; each row centred on its own line,
  // spread out evenly when just is set; returns the z below the last row
  function rows(list, x0, x1, z, gap, rgap, yaw, just) {
    const items = list.map(pi => ({ pi, s: size(pi, yaw) }));
    let i = 0;
    while (i < items.length) {
      const row = []; let w = 0;
      while (i < items.length && (row.length === 0 || w + gap + items[i].s[0] <= x1 - x0)) { w += (row.length ? gap : 0) + items[i].s[0]; row.push(items[i++]); }
      // justified rows spread to fill the width (a short last row keeps its gaps)
      const h = Math.max(...row.map(it => it.s[1])), g = just && row.length > 1 && (i < items.length || w > 0.6 * (x1 - x0)) ? gap + (x1 - x0 - w) / (row.length - 1) : gap;
      let x = x0;
      for (const it of row) { place(it.pi, x + it.s[0] / 2, z + h / 2, yaw); x += it.s[0] + g; }
      z += h + rgap;
    }
    return z;
  }
  const grp = g => parts.map((p, i) => (p.grp === g ? i : -1)).filter(i => i >= 0);
  // top row: the boards, the two halves of the case, the tube face down, the drive; under the tube the
  // analogue board's big parts, under the drive the power supply, the fan and the speaker
  place(P.logic, -0.695, -0.555);
  place(P.analog, -0.695, -0.24);
  place(P.rear, -0.345, -0.46);
  place(P.bezel, 0.035, -0.46);
  place(P.crt, 0.405, -0.562);
  place(P.floppy, 0.725, -0.599);
  place(P.psu, 0.66, -0.41);
  place(P.fan, 0.79, -0.44);
  place(P.speaker, 0.79, -0.335);
  rows([P.flyback, P.xfmr, ...heat], 0.255, 0.57, -0.39, 0.03, 0.02, 0, true);
  // electronics in the middle: chips by size, a long line of resistors by value, capacitors, crystals
  const chipsBy = nodes.filter(n => n.kind === 'chip').sort((a, b) => b.n - a.n || b.W - a.W).map(n => n.pi);
  // the gaps between these rows are the channels the wiring runs in (power, address, data and ground buses)
  const BUS = [-0.205], RG = 0.068;
  const MX0 = -0.5, MX1 = 0.84;
  let z = rows(chipsBy.slice(0, 8), MX0, MX1, -0.18, 0.035, RG, 0, true);
  BUS.push(z - RG / 2);
  z = rows(chipsBy.slice(8), MX0, MX1, z, 0.03, RG, 0, true);
  BUS.push(z - RG / 2);
  z = rows(grp('res').sort((a, b) => parts[a].ord - parts[b].ord), MX0, MX1, z, 0.014, RG, PI / 2, true);
  BUS.push(z - RG / 2);
  rows([...grp('elco').sort((a, b) => parts[a].ord - parts[b].ord), ...grp('xtal'), ...grp('disc'), P.fuse, P.battery, ...grp('misc').filter(i => i !== P.fuse && i !== P.battery)], MX0, MX1, z, 0.02, 0.025, 0, true);
  // left: memory modules and cables, the keyboard's coiled up
  rows(simms, -0.845, -0.545, -0.045, 0.03, 0.022, 0, true);
  place(P.ribbon, -0.695, 0.165);
  place(P.kbCable, -0.765, 0.37); place(P.anode, -0.6, 0.37, PI / 2);
  place(P.harness, -0.695, 0.555);
  // bottom: keyboard case, its key caps spread out in their own pattern, a line of screws
  place(P.kb, 0, 0.3);
  for (const k of keys) place(k.pi, k.x * 1.32, 0.565 + (k.z - 0.012) * 1.32);
  // the screws in one line across the front, longest first
  const scr = screws.slice().sort((a, b) => parts[b].len - parts[a].len);
  {
    let x = -0.66;
    for (const pi of scr) { const long = parts[pi].grp === 'screwL', w = size(pi, long ? -PI / 2 : 0)[0]; place(pi, x + w / 2, 0.705, long ? -PI / 2 : 0); x += w + (long ? 0.016 : 0.0085); }
  }
  // right: the mouse in pieces, feet, springs, washers, standoffs, clips, brackets
  place(P.mouse, 0.5, 0.29); place(P.mplate, 0.6, 0.29); place(P.mbutton, 0.7, 0.25); place(P.mball, 0.7, 0.31);
  place(P.roller0, 0.76, 0.25, PI / 2); place(P.roller1, 0.76, 0.31, PI / 2); place(P.msCable, 0.82, 0.28);
  z = rows(feet, 0.45, 0.86, 0.43, 0.02, 0.02);
  z = rows(grp('spring'), 0.45, 0.86, z, 0.02, 0.02);
  z = rows(grp('washer'), 0.45, 0.86, z, 0.012, 0.02);
  z = rows([...grp('standoff'), ...grp('clip')], 0.45, 0.86, z, 0.016, 0.02);
  rows(grp('bracket'), 0.45, 0.86, z, 0.02, 0.02);
  // parts from inside that land in front of the computer wait until the front bezel has lifted (no flying through it)
  for (const p of parts) if (p.inner && p.at[1] > CZ - 0.02) p.d = Math.max(p.d, 0.5);
  // the pale table of the teardown photo
  const table = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.02, TD), K.fade(set, new THREE.MeshStandardMaterial({ color: TABLE, roughness: 0.92 })));
  table.position.y = FLOOR - 0.0102;
  table.renderOrder = -1;
  set.group.add(table);

  // ------------------------------------------------------------ wiring --
  // A netlist over the laid-out electronics, drawn like a schematic: buses run along the gaps between
  // the rows, every chip taps some of them, resistors and capacitors hang between chips and the buses.
  const WY = FLOOR + 0.0125, BX0 = MX0 - 0.02, BX1 = MX1 + 0.02, NETY = -0.14, rw = K.rng(42);
  // each bus (power, address, data, ground) is a chain of four hub nodes in the network
  const SEG = 4, segX = s => BX0 + (s + 0.5) * (BX1 - BX0) / SEG, HUB = [];
  BUS.forEach(z => { for (let s = 0; s < SEG; s++) HUB.push({ x: segX(s), z }); });
  const hubAt = (k, x) => k * SEG + K.clamp(Math.floor((x - BX0) / (BX1 - BX0) * SEG), 0, SEG - 1);
  const pinAt = (n, k) => {
    const p = parts[n.pi], pin = n.pins[k], v = V(...pin.p).applyQuaternion(p.lq).add(p.lpV || V(...p.lp)), d = V(...pin.d).applyQuaternion(p.lq);
    const l = Math.hypot(d.x, d.z) || 1;
    return { x: v.x, z: v.z, dx: d.x / l, dz: d.z / l };
  };
  nodes.forEach(n => { n.used = new Set(); const e = parts[n.pi]; n.x = e.at[0]; n.z = e.at[1]; });
  // a free pin of node n, on the side facing dz (0: any), nearest to x
  function freePin(n, dz, x) {
    let best = -1, bd = 1e9;
    n.pins.forEach((p, k) => {
      if (n.used.has(k)) return;
      const q = pinAt(n, k);
      if (dz && Math.sign(q.dz) !== dz && n.kind === 'chip') return;
      const d = x === undefined ? rw() : Math.abs(q.x - x) + rw() * 0.004;
      if (d < bd) { bd = d; best = k; }
    });
    if (best < 0) best = Math.floor(rw() * n.pins.length);
    n.used.add(best);
    return pinAt(n, best);
  }
  const wires = [];   // { pts: [[x, z]], a: node index or hub, b: ..., order }
  const NH = nodes.length;   // hub k is network node NH + k
  const busOf = z => BUS.reduce((b, bz, k) => (Math.abs(bz - z) < Math.abs(BUS[b] - z) ? k : b), 0);
  const lane = () => (rw() < 0.5 ? -1 : 1) * (0.007 + 0.0065 * Math.floor(rw() * 4));
  function addWire(pts, a, b) {
    const out = [];
    for (const p of pts) { const l = out[out.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 1e-4) out.push(p); }
    // drop points in the middle of straight runs
    for (let i = out.length - 2; i > 0; i--) { const a0 = out[i - 1], a1 = out[i], a2 = out[i + 1]; if (Math.abs((a1[0] - a0[0]) * (a2[1] - a1[1]) - (a1[1] - a0[1]) * (a2[0] - a1[0])) < 1e-9) out.splice(i, 1); }
    if (out.length > 1) wires.push({ pts: out, a, b });
  }
  // a tap from a pin straight onto a bus, with a junction dot where it lands
  const junctions = [];
  function tap(ni, hub, dz) {
    const n = nodes[ni], p = freePin(n, dz), s = 0.004 + rw() * 0.004;
    const x1 = Math.abs(p.dx) > 0.5 ? p.x + p.dx * s : p.x;
    addWire([[p.x, p.z], [x1, p.z + (Math.abs(p.dz) > 0.5 ? p.dz * s : 0)], [x1, BUS[hub]]], ni, NH + hubAt(hub, x1));
    junctions.push({ x: x1, z: BUS[hub], w: wires.length - 1 });
  }
  // a point-to-point wire through the channel next to the first pin
  function link(ai, bi, adz, bdz) {
    const A = nodes[ai], B = nodes[bi], p = freePin(A, adz, B.x), q = freePin(B, bdz, A.x), s = 0.005 + rw() * 0.004;
    const pz = Math.abs(p.dz) > 0.5 ? p.dz : -1, ch = BUS.filter(z => (z - p.z) * pz > 0).sort((u, v) => Math.abs(u - p.z) - Math.abs(v - p.z))[0];
    const cz = (ch === undefined ? p.z + pz * 0.02 : ch) + lane();
    const p1 = [p.x + p.dx * s, p.z + p.dz * s], q1 = [q.x + q.dx * s, q.z + q.dz * s];
    addWire([[p.x, p.z], p1, [p1[0], cz], [q1[0], cz], q1, [q.x, q.z]], ai, bi);
  }
  const idx = pi => nodes.findIndex(n => n.pi === pi);
  const rowA = chipsBy.slice(0, 8).map(idx), rowB = chipsBy.slice(8).map(idx);
  const resN = grp('res').sort((a, b) => parts[a].ord - parts[b].ord).map(idx);
  const capN = nodes.map((n, k) => (n.kind === 'cap' ? k : -1)).filter(k => k >= 0), xtN = nodes.map((n, k) => (n.kind === 'xtal' ? k : -1)).filter(k => k >= 0);
  // the bus lines themselves, then the chips' taps
  BUS.forEach((z, k) => {
    const h = NH + k * SEG;
    addWire([[BX0, z], [segX(0), z]], h, h); addWire([[segX(SEG - 1), z], [BX1, z]], h + SEG - 1, h + SEG - 1);
    for (let s = 0; s < SEG - 1; s++) addWire([[segX(s), z], [segX(s + 1), z]], h + s, h + s + 1);
  });
  wires.forEach(w => { w.bus = true; });
  rowA.forEach(ni => { tap(ni, 0, -1); tap(ni, 1, 1); tap(ni, 1, 1); if (nodes[ni].n >= 40) tap(ni, 1, 1); tap(ni, 2, 1); });
  rowB.forEach((ni, k) => { tap(ni, 1, -1); if (k < 9) tap(ni, 2, 1); });
  // chips talk to their neighbours and to a few far away
  rowA.forEach((ni, k) => { if (k < rowA.length - 1) link(ni, rowA[k + 1], 1, 1); link(ni, rowB[Math.floor(rw() * rowB.length)], 1, -1); });
  rowB.forEach((ni, k) => { if (k % 2 === 0 && k < rowB.length - 1) link(ni, rowB[k + 1], 1, 1); if (k % 3 === 0) link(ni, rowA[Math.floor(rw() * rowA.length)], -1, 1); });
  // resistors: pull-ups to the data bus or a chip above, the other end to ground or to a capacitor
  resN.forEach((ni, k) => {
    if (k % 3 === 0) tap(ni, 2, 0); else link(ni, rowB[Math.min(rowB.length - 1, Math.floor((nodes[ni].x - BX0) / (BX1 - BX0) * rowB.length))], 0, 1);
    if (k % 2 === 0) tap(ni, 3, 0); else link(ni, capN[Math.floor(rw() * capN.length)], 0, 0);
  });
  capN.forEach(ni => tap(ni, 3, 0));
  // the clock crystals feed the processor and the video chip: two long lines each
  xtN.forEach((ni, k) => { link(ni, rowA[k ? 6 : 0], 0, -1); link(ni, rowA[k ? 6 : 0], 0, -1); });
  // reveal order: the buses first, then outwards from the processor
  const cpu = nodes[rowA[0]];
  wires.forEach((w, k) => { w.order = w.a >= NH ? -1 + k * 0.01 : Math.hypot(w.pts[0][0] - cpu.x, w.pts[0][1] - cpu.z) + rw() * 0.15; });
  const ord = wires.slice().sort((a, b) => a.order - b.order);
  const nb = wires.filter(w => w.a >= NH).length;
  ord.forEach((w, k) => { w.w0 = w.a >= NH ? 0.005 * k : 0.1 + 0.74 * (k - nb) / (ord.length - nb); });
  // network layout: nodes start where the parts lie and relax in 3D (springs along the wires, all nodes repel)
  const NN = NH + HUB.length, EDGES = [];
  for (const w of wires) if (w.a !== w.b) EDGES.push([w.a, w.b]);
  const P0 = [], P1 = [];
  for (let k = 0; k < NN; k++) P0.push(k < NH ? [nodes[k].x, WY, nodes[k].z] : [HUB[k - NH].x, WY, HUB[k - NH].z]);
  // a small force layout in 3D: springs along the wires, every pair repels, a weak pull to the centre
  // (its own function, so the engine optimises the hot loops)
  function relax(p, n, E, IT) {
    const f = new Float64Array(n * 3);
    for (let it = 0; it < IT; it++) {
      f.fill(0);
      for (let i = 0; i < n; i++) {
        const xi = p[3 * i], yi = p[3 * i + 1], zi = p[3 * i + 2];
        let fx = 0, fy = 0, fz = 0;
        for (let j = i + 1; j < n; j++) {
          const dx = xi - p[3 * j], dy = yi - p[3 * j + 1], dz = zi - p[3 * j + 2], d2 = dx * dx + dy * dy + dz * dz, s = 0.0011 / (d2 > 1e-4 ? d2 : 1e-4);
          fx += dx * s; fy += dy * s; fz += dz * s; f[3 * j] -= dx * s; f[3 * j + 1] -= dy * s; f[3 * j + 2] -= dz * s;
        }
        f[3 * i] += fx; f[3 * i + 1] += fy; f[3 * i + 2] += fz;
      }
      for (let k = 0; k < E.length; k += 2) {
        const a = 3 * E[k], b = 3 * E[k + 1], dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4, s = (l - 0.1) * 0.06 / l;
        f[a] += dx * s; f[a + 1] += dy * s; f[a + 2] += dz * s; f[b] -= dx * s; f[b + 1] -= dy * s; f[b + 2] -= dz * s;
      }
      const T = 0.03 * (1 - it / IT) + 0.002;
      for (let i = 0; i < 3 * n; i += 3) {
        const fx = f[i] - p[i] * 0.012, fy = f[i + 1] - p[i + 1] * 0.012, fz = f[i + 2] - p[i + 2] * 0.012, l = Math.sqrt(fx * fx + fy * fy + fz * fz), s = l > T ? T / l : 1;
        p[i] += fx * s; p[i + 1] += fy * s; p[i + 2] += fz * s;
      }
    }
  }
  {
    // start from the table positions puffed up into a ball, so neighbours on the table stay near
    const p = new Float64Array(NN * 3);
    P0.forEach((q, i) => { p[3 * i] = q[0] * 0.5 + (rw() - 0.5) * 0.1; p[3 * i + 1] = (rw() - 0.5) * 0.5; p[3 * i + 2] = (q[2] + 0.06) * 1.6 + (rw() - 0.5) * 0.1; });
    relax(p, NN, Int32Array.from(EDGES.flat()), 120);
    const c = [0, 1, 2].map(k => { let m = 0; for (let i = 0; i < NN; i++) m += p[3 * i + k]; return m / NN; });
    const rad = Array.from({ length: NN }, (_, i) => Math.hypot(p[3 * i] - c[0], p[3 * i + 1] - c[1], p[3 * i + 2] - c[2])).sort((a, b) => a - b)[Math.floor(NN * 0.9)];
    for (let i = 0; i < NN; i++) P1.push([(p[3 * i] - c[0]) * 0.6 / rad, NETY + (p[3 * i + 1] - c[1]) * 0.6 / rad, (p[3 * i + 2] - c[2]) * 0.6 / rad]);
  }
  const deg = new Array(NN).fill(0);
  for (const [a, b] of EDGES) { deg[a]++; deg[b]++; }

  // wires as glowing ribbons that face the camera; they grow along their length, then straighten and lift;
  // the lifted network sways gently about its centre (ROT is the shared angle)
  const ROT = { value: 0 }, ROTY = `uniform float uRot;
vec3 rotY(vec3 p, float y0) { float c = cos(uRot), s = sin(uRot); p.y -= y0; return vec3(c * p.x + s * p.z, p.y + y0, c * p.z - s * p.x); }`;
  let nseg = 0;
  for (const w of wires) nseg += w.pts.length - 1;
  const wg = new THREE.BufferGeometry(), NV = nseg * 4;
  const A = { position: 3, aDir: 3, aS0: 3, aS1: 3, aD0: 3, aD1: 3, aM: 3, aUL: 3 }, arr = {};
  for (const k in A) arr[k] = new Float32Array(NV * A[k]);
  const index = [];
  let vi = 0;
  for (const w of wires) {
    const L = [0];
    for (let i = 1; i < w.pts.length; i++) L.push(L[i - 1] + Math.hypot(w.pts[i][0] - w.pts[i - 1][0], w.pts[i][1] - w.pts[i - 1][1]));
    const len = L[L.length - 1] || 1e-4, a0 = P0[w.a], b0 = P0[w.b], a1 = P1[w.a], b1 = P1[w.b];
    for (let i = 0; i < w.pts.length - 1; i++) {
      const p = w.pts[i], q = w.pts[i + 1], sl = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const dir = [(q[0] - p[0]) / sl, 0, (q[1] - p[1]) / sl];
      for (const [pt, u, end] of [[p, L[i] / len, -1], [q, L[i + 1] / len, 1]]) for (const side of [-1, 1]) {
        arr.position.set([pt[0], WY, pt[1]], 3 * vi); arr.aDir.set(dir, 3 * vi);
        arr.aS0.set(K.v3.lerp(a0, b0, u), 3 * vi); arr.aS1.set(K.v3.lerp(a1, b1, u), 3 * vi);
        arr.aD0.set(K.v3.sub(b0, a0), 3 * vi); arr.aD1.set(K.v3.sub(b1, a1), 3 * vi);
        arr.aM.set([w.w0, side, end], 3 * vi); arr.aUL.set([u, len, w.bus ? 2 : 1], 3 * vi);
        vi++;
      }
      const v0 = vi - 4;
      index.push(v0, v0 + 1, v0 + 3, v0, v0 + 3, v0 + 2);
    }
  }
  for (const k in A) wg.setAttribute(k, new THREE.BufferAttribute(arr[k], A[k]));
  wg.setIndex(index);
  const wireMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uWire: { value: 0 }, uStr: { value: 0 }, uLift: { value: 0 }, uW: { value: 0.0026 }, uC: { value: new THREE.Color(...K.rgb('#46d9ff')) }, uRot: ROT },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 aDir, aS0, aS1, aD0, aD1, aM, aUL;
uniform float uA, uWire, uStr, uLift, uW;
varying float vU, vSide, vGrow, vL, vA, vE0, vE1;
${ROTY}
void main() {
  vec3 D = rotY(mix(aD0, aD1, uLift), 0.0);
  vec3 pos = rotY(mix(position, mix(aS0, aS1, uLift), uStr), ${NETY.toFixed(4)});
  float dl = length(D);
  vec3 dir = normalize(mix(rotY(aDir, 0.0), dl > 1e-5 ? D / dl : aDir, uStr) + vec3(0.0, 1e-5, 0.0));
  vGrow = clamp((uWire - aM.x) / 0.14, 0.0, 1.0);
  // distance along the wire (or along the straight edge once straightened), plus a phase of its own,
  // so the pulses keep travelling and never flash on every wire at once
  vU = aUL.x; vSide = aM.y;
  // distance to either node along the straight edge, so an edge fades softly into its nodes
  vE0 = aUL.x * dl; vE1 = (1.0 - aUL.x) * dl;
  vL = aUL.x * mix(aUL.y, dl, uStr) + fract(sin(aM.x * 91.7) * 4375.85) * 0.25;
  vA = uA * step(0.0001, vGrow) * mix(1.0, 0.75, uStr);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec3 dv = normalize((modelViewMatrix * vec4(dir, 0.0)).xyz);
  vec3 sd = cross(dv, normalize(mv.xyz));
  float sl = length(sd);
  sd = sl > 1e-4 ? sd / sl : vec3(0.0, 1.0, 0.0);
  // end caps close the corners of the schematic; a straight edge needs none (they would overlap into beads)
  // width in local units (ws: the set's world scale), a little wider when seen from further than the wiring
  // cam so the schematic still reads from above the whole table; bus lines are wider on the table, but as
  // network edges only a little wider than the rest
  float ws = length(modelViewMatrix[0].xyz), far = clamp(-mv.z / (2.6 * ws), 1.0, 1.6);
  mv.xyz += (sd * aM.y + dv * aM.z * 0.5 * (1.0 - uStr)) * uW * ws * far * mix(aUL.z, min(aUL.z, 1.3), uStr) * (1.0 + 0.4 * uLift);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform float uTime, uStr; uniform vec3 uC;
varying float vU, vSide, vGrow, vL, vA, vE0, vE1;
void main() {
  if (vA < 0.004 || vU > vGrow + 0.0001) discard;
  float x = abs(vSide), a = exp(-x * x * 2.6);
  float tip = vGrow < 1.0 ? smoothstep(vGrow - 0.05, vGrow, vU) : 0.0;
  // a comet: a soft tail and a soft head
  float f = fract(vL * 4.0 - uTime * 0.5), pulse = smoothstep(0.84, 0.98, f) * (1.0 - smoothstep(0.98, 1.0, f));
  vec3 c = uC * (0.75 + 0.9 * pulse) + vec3(1.0) * (smoothstep(0.45, 0.0, x) * 0.45 + tip * 1.5);
  a *= mix(1.0, smoothstep(0.004, 0.02, min(vE0, vE1)), uStr);
  gl_FragColor = vec4(c, a * vA);
}`,
  });
  set.mats.push(wireMat);
  const wireMesh = new THREE.Mesh(wg, wireMat);
  wireMesh.frustumCulled = false; wireMesh.renderOrder = 4;
  set.group.add(wireMesh);
  // glowing dots: the network's nodes (hubs bigger) and junctions where taps land on a bus
  const KC = { chip: '#ffb43b', res: '#46d9ff', cap: '#ff5ad9', xtal: '#3ee08f' };
  const NP = NN + junctions.length, pg = K.pointsGeo(NP), pPos = pg.attributes.position.array, pA = pg.attributes.aA.array, pSize = pg.attributes.aSize.array, pCol = pg.attributes.aCol.array;
  for (let k = 0; k < NN; k++) { pCol.set(K.rgb(k < NH ? KC[nodes[k].kind] : '#e7eef8'), 3 * k); pSize[k] = k < NH ? 0.024 + 0.0012 * Math.min(deg[k], 10) : 0.042; }
  junctions.forEach((j, k) => { pPos.set([j.x, WY, j.z], 3 * (NN + k)); pCol.set(K.rgb('#bff2ff'), 3 * (NN + k)); pSize[NN + k] = 0.011; });
  const dots = new THREE.Points(pg, K.points(set, { uniforms: { uRot: ROT, uBig: { value: 0 } }, head: ROTY.replace('uniform float uRot;', 'uniform float uRot, uBig;'), vertex: `
  mv = modelViewMatrix * vec4(rotY(pos, ${NETY.toFixed(4)}), 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize * (1.0 + 0.45 * uBig), mv);
  vA *= 0.82 + 0.18 * sin(uTime * 2.3 + position.x * 37.0 + position.z * 23.0);` }));
  dots.frustumCulled = false; dots.renderOrder = 5;
  set.group.add(dots);
  let lastW = -1, lastN = -1, wLift = 0;
  function wireUpdate(wi, nn, t) {
    const str = K.prog(nn, 0.28, 0.6), lift = K.prog(nn, 0.45, 1);
    wLift = lift;
    ROT.value = lift * 0.45 * Math.sin(t * 0.2); dots.material.uniforms.uBig.value = lift;
    wireMat.uniforms.uWire.value = wi; wireMat.uniforms.uStr.value = str; wireMat.uniforms.uLift.value = lift;
    wireMesh.visible = wi > 0.001;
    if (Math.abs(wi - lastW) < 1e-6 && Math.abs(nn - lastN) < 1e-6) return;
    lastW = wi; lastN = nn;
    const grow = K.prog(nn, 0.08, 0.36);
    for (let k = 0; k < NN; k++) {
      pPos.set(K.v3.lerp(P0[k], P1[k], lift), 3 * k);
      pA[k] = k < NH ? grow : K.prog(nn, 0.3, 0.6) * K.prog(wi, 0.2, 0.5);
    }
    // junction dots go out before the wires start to straighten, so none is left floating on its own
    const jOut = 1 - K.prog(nn, 0.12, 0.28);
    junctions.forEach((j, k) => { pA[NN + k] = K.clamp((wi - wires[j.w].w0) / 0.14 - 0.9, 0, 0.1) * 10 * jOut; });
    pg.attributes.position.needsUpdate = true; pg.attributes.aA.needsUpdate = true;
  }
  // the middle of the bus lines on the table, gliding with the lift to the network's centre
  const wiresAt = () => K.v3.lerp([(BX0 + BX1) / 2, WY, (BUS[0] + BUS[3]) / 2], [0, NETY, 0], wLift);
  // ------------------------------------------------------- meshes, update --
  const insts = kindList.filter(k => KINDS[k].list.length).map(k => {
    const { geo, material, list } = KINDS[k], m = new THREE.InstancedMesh(geo, material, list.length);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    list.forEach((it, i) => m.setColorAt(i, it.c));
    set.group.add(m);
    return { m, list };
  });
  for (const s of solos) s.mesh.frustumCulled = false;
  const screenMesh = solo(P.crt, screenGeo, screenMat, mat([0, 0, FACE_Z - crtC[2]]));
  // depth prepass for fading the computer, shut or taken apart: opaque, so it draws before every transparent
  // part; it shares the matrices of the case halves, the tube and the screen, and sits a hair behind them so
  // their own faces pass
  const preMat = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  const prepass = [[P.rear, shell[0]], [P.bezel, shell[1]], [P.crt, crtMesh], [P.crt, screenMesh]].map(([pi, s]) => {
    const m = new THREE.Mesh(s.geometry, preMat);
    m.matrixAutoUpdate = false; m.matrix = s.matrix; m.frustumCulled = false; m.visible = false;
    set.group.add(m);
    return { pi, m };
  });
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _ax = new THREE.Vector3(), _m = new THREE.Matrix4();
  parts.forEach((p, i) => { p.r = K.rng(500 + i)(); p.lpV = V(...p.lp); p.hpV = V(...p.hp); p.e = p.s = NaN; });
  const nodeOf = new Map(nodes.map((n, k) => [n.pi, k]));
  // soft contact shadows, one per part: a blurred rounded rectangle on the table under its footprint
  // (lerped from where the part stands in the computer to where it lies), fainter while it flies
  const NS = parts.length, shGeo = new THREE.PlaneGeometry(2, 2).rotateX(-PI / 2);
  const shH = new Float32Array(NS * 4);
  shGeo.setAttribute('aH', new THREE.InstancedBufferAttribute(shH, 4).setUsage(THREE.DynamicDrawUsage));
  const shMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 1 } },
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    vertexShader: `attribute vec4 aH; varying vec2 vL; varying vec4 vH;
void main() {
  vH = aH; vL = position.xz * (aH.xy + abs(aH.z));
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  if (aH.w < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `uniform float uA, uK; varying vec2 vL; varying vec4 vH;
void main() {
  // a negative blur marks a round part
  float b = abs(vH.z), r = vH.z < 0.0 ? min(vH.x, vH.y) : min(min(vH.x, vH.y) * 0.6, 0.012);
  vec2 q = abs(vL) - vH.xy + r;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  float a = vH.w * (1.0 - smoothstep(-b * 0.6, b, d));
  if (a < 0.003) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * uA * uK);
}`,
  });
  set.mats.push(shMat);
  const shadows = new THREE.InstancedMesh(shGeo, shMat, NS);
  shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shadows.frustumCulled = false; shadows.renderOrder = -1;
  set.group.add(shadows);
  const ROUND = new Set(['washer', 'feet', 'disc']);
  parts.forEach((p, i) => {
    const bh = aabb(i, p.hq), bl = layBox(i, p.lq), h = bl.max.y - bl.min.y;
    p.sh = {
      hx: p.hp[0] + (bh.min.x + bh.max.x) / 2, hz: p.hp[2] + (bh.min.z + bh.max.z) / 2, hw: (bh.max.x - bh.min.x) / 2, hd: (bh.max.z - bh.min.z) / 2,
      lw: (bl.max.x - bl.min.x) / 2, ld: (bl.max.z - bl.min.z) / 2,
      ground: !p.inner && p.hp[1] + bh.min.y < FLOOR + 0.03, blur: Math.min(0.035, 0.004 + 0.3 * h),
      // cables are too thin and open for a box of shadow
      a: p.grp === 'cable' ? 0 : 0.3 + 0.32 * Math.min(1, h / 0.04), round: ROUND.has(p.grp) || i === P.speaker || i === P.mball,
    };
  });
  const _sm = new THREE.Matrix4();
  function shadowAt(p, i, s) {
    // high in the air a shadow is faint and soft
    const S = p.sh, e = p.e, up = 4 * e * (1 - e), hw = K.lerp(S.hw, S.lw, e) * s, hd = K.lerp(S.hd, S.ld, e) * s, bl = S.blur + 0.03 * up;
    const a = K.lerp(S.ground ? S.a : 0, S.a, e) * (1 - 0.85 * up) * Math.min(1, s * 1.5);
    shH[4 * i] = hw; shH[4 * i + 1] = hd; shH[4 * i + 2] = S.round ? -bl : bl; shH[4 * i + 3] = a;
    _sm.makeScale(hw + bl, 1, hd + bl).setPosition(K.lerp(S.hx, p.at[0], e), FLOOR + 0.0002, K.lerp(S.hz, p.at[1], e));
    shadows.setMatrixAt(i, _sm);
  }
  // a part's pose for explode ex and network nn; it depends only on (e, s), so a part whose pair has not
  // changed keeps its matrix (p.moved false) and its instances are not uploaded again
  function pose(p, i, ex, nn) {
    const e = K.smooth(K.clamp((ex - p.d) / p.w, 0, 1));
    let s = p.inner && ex < 0.012 ? 0 : 1;
    // in the network look, wired parts shrink into their nodes; the rest shrink away, from the edges inwards
    if (nodeOf.has(i)) s *= 1 - K.prog(nn, 0.06, 0.36);
    else s *= 1 - K.prog(nn, 0.02 + 0.14 * p.r, 0.2 + 0.14 * p.r);
    p.moved = e !== p.e || s !== p.s;
    if (!p.moved) return;
    _p.lerpVectors(p.hpV, p.lpV, e); _p.y += p.arc * 4 * e * (1 - e);
    _q.copy(p.hq).slerp(p.lq, e);
    if (p.spin) _q.multiply(_q2.setFromAxisAngle(_ax.set(p.axis[0], p.axis[1], p.axis[2]), e * p.spin * 2 * PI));
    p.m.compose(_p, _q, _s.set(s, s, s));
    p.e = e; p.s = s;
    shadowAt(p, i, s);
  }
  let lastEx = -1, lastNn = -1;
  function layout(ex, nn) {
    if (Math.abs(ex - lastEx) < 1e-6 && Math.abs(nn - lastNn) < 1e-6) return;
    lastEx = ex; lastNn = nn;
    let any = false;
    parts.forEach((p, i) => { pose(p, i, ex, nn); any = any || p.moved; });
    if (!any) return;
    for (const { m, list } of insts) {
      let dirty = false;
      for (let i = 0; i < list.length; i++) if (parts[list[i].pi].moved) { m.setMatrixAt(i, _m.multiplyMatrices(parts[list[i].pi].m, list[i].m)); dirty = true; }
      if (dirty) m.instanceMatrix.needsUpdate = true;
    }
    for (const s of solos) {
      if (!parts[s.pi].moved) continue;
      if (s.local) s.mesh.matrix.multiplyMatrices(parts[s.pi].m, s.local); else s.mesh.matrix.copy(parts[s.pi].m);
      s.mesh.matrixWorldNeedsUpdate = true;
    }
    for (const c of coils) c.mesh.morphTargetInfluences[0] = K.smooth(K.clamp(parts[c.pi].e * 1.3 - 0.15, 0, 1));
    shadows.instanceMatrix.needsUpdate = true; shGeo.attributes.aH.needsUpdate = true;
    // parts shrunk to nothing (inside the shut case, or gone into the network) cost no draw calls
    let shown = false;
    for (const { m, list } of insts) { m.visible = list.some(it => parts[it.pi].s > 0); shown = shown || m.visible; }
    for (const s of solos) { s.mesh.visible = parts[s.pi].s > 0; shown = shown || s.mesh.visible; }
    shadows.visible = shown;
  }
  layout(0, 0);
  const tableCol = new THREE.Color(TABLE);
  function update(S, t) {
    // the wiring is drawn over the parts lying on the table (once lifted into a network it needs no table)
    // the parts are back on the table before the network lets go of them (in the story mac_net rises only
    // once mac_explode is 1, so this matters only for jumps in explore, e.g. from Network to Computer)
    const nn = K.clamp(S.mac_net, 0, 1), ex = Math.max(K.clamp(S.mac_explode, 0, 1), K.prog(nn, 0, 0.3));
    const wi = K.clamp(S.mac_wire, 0, 1) * Math.max(K.prog(ex, 0.75, 1), K.prog(nn, 0.28, 0.6));
    layout(ex, nn);
    // while the set fades (computer shut or taken apart), a depth-only copy of the case, the tube and the
    // screen is drawn first, so they fade evenly instead of showing inner walls, rims and screws through them
    const pre = nn < 0.06 && set.uA.value < 0.97;
    for (const { pi, m } of prepass) { m.visible = pre && parts[pi].s > 0; m.matrixWorldNeedsUpdate = true; }
    screenMat.uniforms.uOff.value = K.prog(ex, 0.005, 0.11);
    spill.visible = ex < 0.06 && parts[P.bezel].s > 0;
    // seen from above the lay is lit full on, so it is toned down a little; the lights go down while the wiring glows
    const dim = (1 - 0.14 * K.prog(ex, 0.3, 1)) * (1 - 0.55 * K.prog(wi, 0, 0.35));
    for (const m of LIT) m.color.setScalar(dim);
    const tm = table.material;
    tm.color.copy(tableCol).multiplyScalar(1 - 0.72 * K.prog(wi, 0, 0.35));
    tm.opacity = tm.userData.base * set.uA.value * K.prog(ex, 0, 0.3) * (1 - K.prog(nn, 0.25, 0.55));
    tm.depthWrite = tm.opacity > 0.97;
    table.visible = tm.opacity > 0.003;
    wireUpdate(wi, nn, t);
  }
  // ----------------------------------------------------------- exports --
  const meanOf = list => () => {
    let x = 0, y = 0, z = 0;
    for (const pi of list) { const e = parts[pi].m.elements; x += e[12]; y += e[13]; z += e[14]; }
    return [x / list.length, y / list.length + 0.008, z / list.length];
  };
  const resList = grp('res'), keyList = keys.map(k => k.pi);
  // in front of the glass; as the tube flies and lies face down, it moves up to the middle of the tube
  const screenAt = () => {
    const p = parts[P.crt], v = V(0, 0, FACE_Z - crtC[2] + 0.012).applyMatrix4(p.m), c = V().setFromMatrixPosition(p.m);
    c.y += 0.1; v.lerp(c, p.e || 0);
    return [v.x, v.y, v.z];
  };
  const VIEWS = { computer: [0, 0, 0], apart: [1, 0, 0], wiring: [1, 1, 0], network: [1, 1, 1] };
  const fadeLabel = S => K.prog(S.mac_explode, 0.82, 1) * (1 - K.prog(S.mac_wire, 0.05, 0.3));
  return Object.assign(set, {
    params: { mac_a: 1, mac_explode: 0, mac_wire: 0, mac_net: 0 },
    update,
    anchors: {
      screen: screenAt, board: meanOf([P.logic]), chips: meanOf(chipsBy.slice(0, 8)), resistors: meanOf(resList),
      screws: meanOf(scr.slice(5)), keys: meanOf(keyList), wires: () => wiresAt(),
      computer: [0, midY, (CZ + BACK) / 2], crt: meanOf([P.crt]), keyboard: meanOf([P.kb]), mouse: meanOf([P.mouse]),
      table: [0, FLOOR, 0], network: [0, NETY, 0],
    },
    // for the story text: what the computer is made of in this model
    counts: { parts: parts.length, screws: screws.length, resistors: resList.length, chips: chipsBy.length, keys: keys.length, wires: wires.length, nodes: NN, links: EDGES.length },
    labels: [
      { text: ['Screws', `${screws.length} of them`], at: 'screws', cls: '', alpha: fadeLabel },
      { text: ['Resistors', `${resList.length}, by value`], at: 'resistors', cls: 'cyn', alpha: fadeLabel },
      { text: ['Chips', 'transistors inside'], at: 'chips', cls: 'amb', alpha: S => K.prog(S.mac_explode, 0.82, 1) * (1 - K.prog(S.mac_net, 0, 0.25)) },
      { text: ['Keys', `${keys.length} caps`], at: 'keys', cls: 'grn', alpha: fadeLabel },
    ],
    cam: {
      default: [32, 13, 2.25, 0.06, -0.09, 0.06], computer: [32, 13, 2.25, 0.06, -0.09, 0.06],
      table: [8, 55, 3.45, 0, -0.32, 0.02], apart: [8, 55, 3.45, 0, -0.32, 0.02],
      wiring: [2, 60, 2.6, 0.17, -0.3, -0.06], network: [18, 20, 2.4, 0, NETY, 0], screen: [12, 6, 1.0, 0, SCR_Y, CZ],
    },
    controls: [{ key: 'view', label: 'View', options: [['computer', 'Computer'], ['apart', 'Taken apart'], ['wiring', 'Wiring'], ['network', 'Network']] }],
    explore(c) { const v = VIEWS[c.view] || VIEWS.computer; return { mac_explode: v[0], mac_wire: v[1], mac_net: v[2] }; },
  });
};
