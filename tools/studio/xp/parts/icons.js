// The desktop icons as little 3D things with their labels (My Computer, My Documents, Internet, Media Player) and the
// Recycle Bin, a real wire bin with crumpled paper for the floor. Lit (one material each, the colours in the corners),
// the label a small unlit plate with its words, as a selected icon's: white on blue.
(function () {
  const T = THREE;
  const S = XP.solid, A = (geo, x, y, z, rx, ry, rz) => XP.at(geo, x, y, z, rx, ry, rz).m;
  // the label under an icon: white words on a rounded blue plate
  XP.label = (words, w, o = {}) => XP.panel({ w, h: o.h || 0.06, W: 512, d: 0.012, r: 0.012, back: '#1f3f8a', name: 'label', draw(F) {
    const { g, W, fh } = F;
    g.fillStyle = o.bg || '#316ac5'; g.fillRect(0, 0, W, fh);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.setLineDash([4, 4]); g.lineWidth = 2; g.strokeRect(4, 4, W - 8, fh - 8); g.setLineDash([]);
    XP.text(g, words, W / 2, fh * 0.68, { size: Math.round(fh * 0.52), align: 'center', color: '#fff', shadow: 'rgba(0,0,0,0.5)', sd: 2, max: W * 0.92 });
    return [];
  } });
  // a screen as seen from across the room: sky blue above, a green hill below (its colours in its corners)
  const screen = (w, h, nx, ny) => {
    const g = new T.PlaneGeometry(w, h, nx, ny), P = g.attributes.position, col = new Float32Array(P.count * 3), c = new T.Color();
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) / w + 0.5, y = P.getY(i) / h + 0.5, hill = 0.42 + 0.12 * Math.sin(x * 2.4 + 0.3);
      c.set(y > hill ? '#3d84e6' : '#5fae2e').lerp(new T.Color(y > hill ? '#a9d2f6' : '#2f6e18'), y > hill ? 1 - (y - hill) / (1 - hill) : 1 - y / hill);
      if (y > 0.7 && Math.abs(x - 0.3) < 0.12) c.lerp(new T.Color('#ffffff'), 0.6);
      c.toArray(col, i * 3);
      P.setZ(i, (1 - (2 * x - 1) ** 2) * (1 - (2 * y - 1) ** 2) * 0.006);   // (the old glass bulges a little)
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals();
    return g;
  };
  const icon = (name, parts, words, o = {}) => {
    const geo = XP.merge(parts, { noUV: true }), root = XP.group(name, XP.mesh(geo, XP.lit({ roughness: o.rough || 0.55, metalness: o.metal || 0 }), 'thing'));
    const lab = XP.label(words, o.lw || 0.3); lab.position.set(0, o.ly || -0.17, o.lz || 0.12); root.add(lab);
    return { root };
  };

  XP.part('icon-computer', { file: 'models/icon-my-computer.glb', build() {
    const beige = '#ddd4ba', dark = '#9c9480';
    return icon('my-computer', [
      S(XP.rbox(0.22, 0.18, 0.15, 0.02), beige, A(null, -0.03, 0.03, 0.08)),
      S(XP.rbox(0.18, 0.15, 0.03, 0.01), '#2c2c2c', A(null, -0.03, 0.035, 0.15)),
      S(screen(0.16, 0.12, 8, 6), '#ffffff', A(null, -0.03, 0.035, 0.168)),
      S(XP.box(0.08, 0.02, 0.08), dark, A(null, -0.03, -0.065, 0.08)),
      S(XP.rbox(0.07, 0.21, 0.17, 0.01), beige, A(null, 0.12, -0.0, 0.085)),
      S(XP.box(0.05, 0.012, 0.004), '#5a564c', A(null, 0.12, 0.06, 0.171)), S(XP.box(0.05, 0.012, 0.004), '#5a564c', A(null, 0.12, 0.035, 0.171)),
      S(XP.cyl(0.007, 0.007, 0.004, 12), '#36c24a', A(null, 0.12, -0.06, 0.171, Math.PI / 2)),
    ].map(p => (p.m = p.m || new T.Matrix4(), p)), 'My Computer', { lz: 0.19, ly: -0.17 });
  } });

  XP.part('icon-documents', { file: 'models/icon-my-documents.glb', build() {
    const y1 = '#f2c443', y2 = '#e3a92a', R = XP.rng(5), parts = [
      S(XP.rbox(0.24, 0.17, 0.016, 0.008), y2, A(null, 0, 0.035, 0.04, -0.12)),
      S(XP.rbox(0.09, 0.03, 0.016, 0.006), y2, A(null, -0.07, 0.125, 0.032, -0.12)),
    ];
    for (let i = 0; i < 4; i++) parts.push(S(XP.box(0.19, 0.15, 0.003), i % 2 ? '#ffffff' : '#eef3fb', A(null, (R() - 0.5) * 0.03, 0.05 + i * 0.008, 0.06 + i * 0.008, -0.08 + (R() - 0.5) * 0.08, 0, (R() - 0.5) * 0.15)));
    for (let i = 0; i < 4; i++) parts.push(S(XP.box(0.12, 0.004, 0.001), '#7aa0d6', A(null, 0, 0.08 + i * 0.02, 0.087, -0.08)));
    parts.push(S(XP.rbox(0.25, 0.14, 0.016, 0.008), y1, A(null, 0, 0.0, 0.1, 0.18)));
    return icon('my-documents', parts, 'My Documents');
  } });

  XP.part('icon-internet', { file: 'models/icon-internet.glb', build() {
    // a globe of our own: blue seas and green land made from smooth noise, and a gold ring round it
    const g = new T.SphereGeometry(0.085, 32, 20), P = g.attributes.position, col = new Float32Array(P.count * 3), c = new T.Color();
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) / 0.085, y = P.getY(i) / 0.085, z = P.getZ(i) / 0.085;
      const land = Math.sin(x * 3.1 + 1) * Math.sin(y * 2.7 + z * 1.9) + Math.sin(z * 4.3 - x * 2) * 0.6 + Math.cos(y * 5.1 + x) * 0.3;
      c.set(land > 0.45 ? (Math.abs(y) > 0.8 ? '#f2f6f8' : '#4cae3a') : '#2a72d8').multiplyScalar(0.9 + 0.1 * z).toArray(col, i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    const ring = new T.TorusGeometry(0.115, 0.008, 8, 48);
    return icon('internet', [{ geo: g, m: A(null, 0, 0.02, 0.1) }, S(ring, '#ffc23a', A(null, 0, 0.02, 0.1, 1.25, 0.3, 0.2)), S(XP.cyl(0.004, 0.004, 0.06, 8), '#9aa4b0', A(null, 0, -0.085, 0.1)), S(XP.cyl(0.04, 0.045, 0.01, 20), '#6a7686', A(null, 0, -0.115, 0.1))], 'Internet', { rough: 0.4, ly: -0.185 });
  } });

  XP.part('icon-media', { file: 'models/icon-media-player.glb', build() {
    // a disc that catches the light in rings, and a big orange play button in front of it
    const disc = new T.CylinderGeometry(0.1, 0.1, 0.006, 48, 1).rotateX(Math.PI / 2), P = disc.attributes.position, col = new Float32Array(P.count * 3), c = new T.Color();
    for (let i = 0; i < P.count; i++) { const r = Math.hypot(P.getX(i), P.getY(i)), a = Math.atan2(P.getY(i), P.getX(i)); c.setHSL(((a / Math.PI + 1) * 0.5 + r * 3) % 1, 0.35, r < 0.02 ? 0.95 : 0.78).toArray(col, i * 3); }
    disc.setAttribute('color', new T.BufferAttribute(col, 3));
    const tri = new T.Shape(); tri.moveTo(-0.022, -0.03); tri.lineTo(0.035, 0); tri.lineTo(-0.022, 0.03); tri.closePath();
    const play = new T.ExtrudeGeometry(tri, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 });
    return icon('media-player', [{ geo: disc, m: A(null, 0, 0.02, 0.05) }, S(XP.cyl(0.055, 0.055, 0.03, 36), '#f08a1a', A(null, 0.035, -0.005, 0.085, Math.PI / 2)), S(play, '#ffffff', A(null, 0.04, -0.005, 0.1))], 'Media Player', { rough: 0.3, metal: 0.2 });
  } });

  XP.part('recycle-bin', { file: 'models/recycle-bin.glb', build() {
    // a wire bin: slats round a tapering basket, two rims and a foot, crumpled paper inside; it stands on the floor
    const R = XP.rng(9), parts = [], H = 0.4, r0 = 0.13, r1 = 0.17, N = 22, metal = '#b9c8dc';
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, rm = (r0 + r1) / 2, tilt = Math.atan2(r1 - r0, H);
      const m = new T.Matrix4().compose(new T.Vector3(Math.sin(a) * rm, H / 2, Math.cos(a) * rm), new T.Quaternion().setFromEuler(new T.Euler(tilt, a, 0, 'YXZ')), new T.Vector3(1, 1, 1));
      parts.push(S(XP.box(0.012, H, 0.004), metal, m));
    }
    parts.push(S(new T.TorusGeometry(r1, 0.008, 6, 40).rotateX(Math.PI / 2), '#d8e2ee', A(null, 0, H, 0)));
    parts.push(S(new T.TorusGeometry(r0 + 0.002, 0.007, 6, 36).rotateX(Math.PI / 2), '#d8e2ee', A(null, 0, 0.012, 0)));
    parts.push(S(new T.TorusGeometry((r0 + r1) / 2, 0.004, 5, 40).rotateX(Math.PI / 2), metal, A(null, 0, H * 0.55, 0)));
    parts.push(S(XP.cyl(r0, r0, 0.012, 32), '#8d9bb0', A(null, 0, 0.006, 0)));
    for (const [x, y, z, s] of [[0.03, H - 0.01, 0.02, 0.07], [-0.05, H - 0.03, -0.03, 0.06], [0.06, H - 0.04, -0.06, 0.055], [-0.02, H + 0.01, 0.07, 0.05]]) {
      const g = new T.IcosahedronGeometry(s, 1), P = g.attributes.position;
      for (let i = 0; i < P.count; i++) { const k = 0.75 + R() * 0.45; P.setXYZ(i, P.getX(i) * k, P.getY(i) * k, P.getZ(i) * k); }
      g.computeVertexNormals();
      parts.push(S(g, '#f4f4ee', A(null, x, y, z, R(), R(), R())));
    }
    const geo = XP.merge(parts, { noUV: true });
    const root = XP.group('recycle-bin', XP.mesh(geo, XP.lit({ roughness: 0.35, metalness: 0.35 }), 'bin'));
    const lab = XP.label('Recycle Bin', 0.3); lab.position.set(0, 0.07, (r0 + r1) / 2 + 0.03); lab.rotation.x = -0.2; root.add(lab);
    return { root };
  } });
})();
