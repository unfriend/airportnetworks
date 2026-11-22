// Spaces and walls (chapter 3), over the cell (its frame and its shapes: SETS.cell's api().CELL). The spaces light up one
// after another (walls_lit: the cytosol, the nucleoplasm, the ER's and the Golgi's lumens, the mitochondria's insides, the
// small organelles' insides, each its own, and outside the cell); the membranes then glow as walls (walls_wall). Three close-ups, not to scale: a receptor
// across the plasma membrane with a part on each side (a signal outside, a partner inside), a nuclear pore with cargo
// going through, and an import site on a mitochondrion with a chain threading in (walls_parts). Motion depends only on
// the time.
SETS.walls = function (K) {
  const { THREE, clamp, v3 } = K;
  const set = K.newSet('walls');
  const CELL = GL.sets.cell.api().CELL, col = GL.sets.cell.api().placeCol;
  const camAt = (p, d, dist) => { const n = v3.norm(d); return [Math.atan2(n[0], n[2]) / Math.PI * 180, Math.asin(n[1]) / Math.PI * 180, dist, p[0], p[1], p[2]]; };
  // ------------------------------------------------------------ the spaces: a glow filling each, a rim for its wall
  // (one draw a space: its organelles' spheres merged)
  const space = (geo, c, list) => {
    const m = K.rim(set, { color: c, a0: 0, a1: 0 }), M = new THREE.Matrix4();
    const geos = list.map(o => geo.clone().applyMatrix4(M.compose(new THREE.Vector3(...o.c), o.q || new THREE.Quaternion(), new THREE.Vector3(...(o.s || [1, 1, 1])))));
    const mesh = new THREE.Mesh(geos.length > 1 ? K.merge(geos) : geos[0], m);
    mesh.renderOrder = 9; set.group.add(mesh);
    return m;
  };
  const sph = new THREE.SphereGeometry(1, 48, 32);
  const X1 = new THREE.Vector3(1, 0, 0);
  // the ER's and the Golgi's lumens: the ER's sheets (its spheres where the cell's mask has them, as its skin) and the
  // Golgi's stacked caps, in one draw
  const lumens = (() => {
    const out = [], q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...CELL.gdir)), M = new THREE.Matrix4();
    CELL.er.r.forEach((r, k) => {
      const g = new THREE.SphereGeometry(r, 72, 48).toNonIndexed(), P = g.attributes.position.array, N = g.attributes.normal.array, keep = [], keepN = [];
      for (let i = 0; i < P.length; i += 9) {
        const d = v3.norm([P[i] + P[i + 3] + P[i + 6], P[i + 1] + P[i + 4] + P[i + 7], P[i + 2] + P[i + 5] + P[i + 8]]);
        if (CELL.erMask(d, k) > 0.06) for (let j = 0; j < 9; j++) { keep.push(P[i + j] + CELL.nuc.c[j % 3]); keepN.push(N[i + j]); }
      }
      const h = new THREE.BufferGeometry(); h.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); h.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3));
      out.push(h);
    });
    CELL.golgi.r.forEach((r, k) => out.push(new THREE.SphereGeometry(r, 48, 8, 0, Math.PI * 2, 0, CELL.golgi.ang[k]).toNonIndexed().applyMatrix4(M.compose(new THREE.Vector3(...CELL.nuc.c), q, new THREE.Vector3(1, 1, 1)))));
    out.forEach(g => { if (g.attributes.uv) g.deleteAttribute('uv'); });
    const mesh = new THREE.Mesh(K.merge(out), K.rim(set, { color: col[3], a0: 0, a1: 0 }));
    mesh.renderOrder = 9; set.group.add(mesh);
    return mesh.material;
  })();
  const SP = [
    { name: 'Cytosol', m: space(sph, col[0], [{ c: [0, 0, 0], s: CELL.pm.map(x => x * 0.985) }]), at: [0.62, -0.35, 0.3], fill: 0.05 },
    { name: 'Nucleoplasm', m: space(sph, col[1], [{ c: CELL.nuc.c, s: [CELL.nuc.r, CELL.nuc.r, CELL.nuc.r] }]), at: v3.add(CELL.nuc.c, [0, CELL.nuc.r * 0.6, 0]), fill: 0.16 },
    { name: 'ER and Golgi', m: lumens, at: v3.add(CELL.nuc.c, v3.mul(CELL.gdir, CELL.golgi.r[2])), fill: 0.1 },
    { name: 'Mitochondria', m: space(sph, col[5], CELL.mitos.map(o => ({ c: o.c, s: [o.a, o.b, o.b], q: new THREE.Quaternion().setFromUnitVectors(X1, new THREE.Vector3(...o.axis)) }))), at: CELL.mitos[0].c, fill: 0.3 },
    { name: 'Small organelles', m: space(sph, col[6], [...CELL.lysos, ...CELL.endos, ...CELL.peroxs].map(o => ({ c: o.c, s: [o.r, o.r, o.r] }))), at: CELL.lysos[0].c, fill: 0.3 },
    { name: 'Outside', m: space(sph, [0.5, 0.75, 0.9], [{ c: [0, 0, 0], s: CELL.pm.map(x => x * 1.12) }]), at: [0, CELL.pm[1] * 1.16, 0], fill: 0.035 },
  ];
  // ------------------------------------------------------------ the close-ups (illustrative shapes, much enlarged)
  const solid = (c, e) => K.fade(set, new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: 0.5, metalness: 0.05, emissive: new THREE.Color(...c).multiplyScalar(e || 0.15) }));
  const patch = (R, hole) => new THREE.Mesh(new THREE.RingGeometry(hole || 0.0005, R, 40, 1), K.fade(set, new THREE.MeshBasicMaterial({ color: 0x9fd0ff, side: THREE.DoubleSide, depthWrite: false }), 0.18));
  const orient = (g, p, n) => { g.position.set(...p); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...v3.norm(n))); set.group.add(g); return g; };
  const flat = g => { g.rotation.x = -Math.PI / 2; return g; };   // (a ring lies across the y axis: the membrane's plane)
  // a receptor across the plasma membrane: one part outside, a helix through, one part inside; a signal comes from
  // outside, a partner binds inside
  const rd = v3.norm([0.62, 0.42, 0.66]), RP = v3.mul(rd, 1 / CELL.eScale(rd)), RN = v3.norm([rd[0] / CELL.pm[0] ** 2, rd[1] / CELL.pm[1] ** 2, rd[2] / CELL.pm[2] ** 2]);
  const rec = new THREE.Group();
  rec.add(flat(patch(0.07)));
  { const b = flat(patch(0.07)); b.position.y = -0.008; rec.add(b); }
  const helix = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 10), solid([0.9, 0.85, 0.5])); helix.position.y = -0.004; rec.add(helix);
  const outer = new THREE.Mesh(new THREE.IcosahedronGeometry(0.014, 2), solid([0.45, 0.85, 1.0])); outer.position.y = 0.024; rec.add(outer);
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.011, 2), solid([0.55, 0.78, 1.0])); inner.position.y = -0.03; rec.add(inner);
  const signal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.006, 1), solid([1.0, 0.75, 0.3], 0.5)); rec.add(signal);
  const partner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.009, 1), solid([0.4, 1.0, 0.6], 0.3)); rec.add(partner);
  orient(rec, RP, RN);
  // a nuclear pore in the nuclear envelope (two membranes), cargo going through
  const nd = v3.norm([-0.3, 0.6, 0.75]), NPp = v3.add(CELL.nuc.c, v3.mul(nd, CELL.nuc.r));
  const pore = new THREE.Group();
  pore.add(flat(patch(0.065, 0.016)));
  { const b = flat(patch(0.065, 0.016)); b.position.y = -0.009; pore.add(b); }
  const ring = flat(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.006, 8, 24), solid([0.8, 0.65, 1.0]))); ring.position.y = -0.0045; pore.add(ring);
  const cargo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.007, 1), solid([1.0, 0.75, 0.3], 0.5)); pore.add(cargo);
  orient(pore, NPp, nd);
  // an import site on a mitochondrion: a small gate, a chain threading in
  const mi = CELL.mitos[0], md = v3.norm(v3.cross(mi.axis, [0, 1, 0])), MP = v3.add(mi.c, v3.mul(md, mi.b));
  const imp = new THREE.Group();
  const gate = flat(new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.003, 6, 16), solid([1.0, 0.55, 0.45]))); imp.add(gate);
  const chain = [];
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0035, 0), solid([1.0, 0.8, 0.4], 0.4)); imp.add(b); chain.push(b); }
  orient(imp, MP, md);
  const parts = [rec, pore, imp];
  return Object.assign(set, {
    // walls_lit: which space glows (1 the cytosol, 2 the nucleoplasm, 3 the ER and Golgi ... 6 outside; between two, both
    // a little; 0 none, 7 all faintly);
    // walls_wall: the membranes glow as walls; walls_parts: the three close-ups (receptor, pore, import site)
    params: { walls_a: 1, walls_lit: 0, walls_wall: 0, walls_parts: 0 },
    update(S, t) {
      const lit = clamp(S.walls_lit, 0, 7), w = clamp(S.walls_wall, 0, 1);
      SP.forEach((s, i) => {
        const on = lit >= 6.5 ? 0.4 * (lit - 6.5) * 2 : Math.max(0, 1 - Math.abs(lit - (i + 1)));
        s.m.uniforms.uA0.value = s.fill * on;
        s.m.uniforms.uA1.value = 0.25 * on + (i < 5 ? 0.55 * w : 0);
      });
      const pv = clamp(S.walls_parts, 0, 1);
      for (const g of parts) { g.visible = pv > 0.01; g.scale.setScalar(Math.max(0.01, pv) * (g === imp ? 2.4 : 1)); }   // (the import site drawn larger still: a mitochondrion is small)
      if (pv <= 0.01) return;
      // (each motion a loop of a few seconds: the signal docks and leaves, the partner binds, the cargo crosses, the chain threads in)
      const a = (t * 0.2) % 1, b = (t * 0.17 + 0.3) % 1, c = (t * 0.15) % 1;
      const dock = x => (x < 0.4 ? x / 0.4 : x < 0.7 ? 1 : 1 - (x - 0.7) / 0.3);
      signal.position.set(0.03 * (1 - dock(a)), 0.045 + 0.03 * (1 - dock(a)), 0);
      partner.position.set(-0.035 * (1 - dock(b)), -0.048 - 0.02 * (1 - dock(b)), 0.01);
      cargo.position.set(0, 0.05 - 0.11 * K.smooth(b), 0);
      chain.forEach((o, i) => o.position.set(0, 0.03 - 0.006 * i - 0.05 * c, 0));
    },
    anchors: { cytosol: SP[0].at, nucleus: SP[1].at, lumen: SP[2].at, mito: SP[3].at, small: SP[4].at, outside: SP[5].at,
      receptor: v3.add(RP, v3.mul(RN, 0.04)), recIn: v3.add(RP, v3.mul(RN, -0.045)), recOut: v3.add(RP, v3.mul(RN, 0.07)), pore: v3.add(NPp, v3.mul(nd, 0.04)), import: v3.add(MP, v3.mul(md, 0.07)) },
    labels: [],
    cam: { default: [20, 14, 3.6, 0, 0, 0], receptor: camAt(RP, v3.add(RN, [0.35, -0.25, 0.3]), 0.38), pore: camAt(NPp, v3.add(nd, [-0.3, 0.25, 0.1]), 0.32), import: camAt(MP, v3.add(md, [0.2, 0.5, 0.3]), 0.26) },
  });
};
