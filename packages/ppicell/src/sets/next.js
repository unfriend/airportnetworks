// What it would take (chapter 8), over the cell (its frame and shapes): proximity maps (next_halo: baits in their places,
// each with a halo of tagged neighbours), a cryo-electron tomogram (next_slab: a thin slab through the cell, its few
// molecules sharp), a whole-cell volume (next_vol: the cell filled with small cubes of what is where). Illustrative: what
// such data look like, not data. Then the cell's own honest picture takes over (the story fades these out).
SETS.next = function (K) {
  const { THREE, clamp, v3 } = K;
  const set = K.newSet('next');
  const CELL = GL.sets.cell.api().CELL, r = K.rng(61);
  const inCyto = p => CELL.eScale(p) < 0.88 && v3.dist(p, CELL.nuc.c) > CELL.nuc.r + 0.08;
  const randIn = ok => { for (;;) { const p = [(r() * 2 - 1) * CELL.pm[0], (r() * 2 - 1) * CELL.pm[1], (r() * 2 - 1) * CELL.pm[2]]; if (ok(p)) return p; } };
  // ------------------------------------------------------------ halos: baits and their tagged neighbours
  const NH = 9, NT = 14, baits = [];
  for (let i = 0; i < NH; i++) baits.push(i < 3 ? v3.add(CELL.nuc.c, v3.mul(K.unit(r), CELL.nuc.r * 0.6 * Math.cbrt(r()))) : randIn(inCyto));
  const haloMat = K.rim(set, { color: [0.4, 1.0, 0.7], a0: 0.05, a1: 0.55 });
  const halos = baits.map(p => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), haloMat); m.position.set(...p); set.group.add(m); return m; });
  const tg = K.pointsGeo(NH * (NT + 1));
  baits.forEach((p, i) => {
    for (let j = 0; j <= NT; j++) {
      const q = j ? v3.add(p, v3.mul(K.unit(r), 0.07 * Math.cbrt(r()))) : p, k = i * (NT + 1) + j;
      tg.attributes.position.array.set(q, 3 * k); tg.attributes.aCol.array.set(j ? [0.4, 1.0, 0.7] : [1, 1, 1], 3 * k); tg.attributes.aSize.array[k] = j ? 0.012 : 0.022;
    }
  });
  const tagP = new THREE.Points(tg, K.points(set)); set.group.add(tagP);
  // ------------------------------------------------------------ a slab: a tomogram's thin slice, its molecules sharp
  const SW = [1.5, 1.1, 0.05], SZ = 0.18;
  const slabMat = K.fade(set, new THREE.MeshBasicMaterial({ color: 0x8fb8e8, depthWrite: false }), 0.12);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(...SW), slabMat); slab.position.set(0.1, 0, SZ); set.group.add(slab);
  const slabEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...SW)), K.fade(set, new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true }), 0.6));
  slabEdge.position.copy(slab.position); set.group.add(slabEdge);
  const mols = [];
  for (let i = 0; i < 400 && mols.length < 220; i++) {
    const p = [0.1 + (r() - 0.5) * SW[0], (r() - 0.5) * SW[1], SZ + (r() - 0.5) * SW[2] * 0.6];
    if (CELL.eScale(p) < 0.92) mols.push({ p, k: 0.6 + 0.8 * r(), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)), c: r() });
  }
  const molMat = K.fade(set, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }));
  const molMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.011, 0), molMat, mols.length);
  molMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3 * mols.length), 3);
  const M4 = new THREE.Matrix4(), C = new THREE.Color();
  mols.forEach((o, i) => {
    M4.compose(new THREE.Vector3(...o.p), o.q, new THREE.Vector3(o.k, o.k, o.k)); molMesh.setMatrixAt(i, M4);
    const inN = v3.dist(o.p, CELL.nuc.c) < CELL.nuc.r;
    C.setRGB(...(inN ? [0.75, 0.62, 1.0] : o.c < 0.3 ? [1.0, 0.8, 0.4] : [0.6, 0.85, 1.0])); molMesh.setColorAt(i, C);
  });
  molMesh.frustumCulled = false; set.group.add(molMesh);
  // ------------------------------------------------------------ a volume: the whole cell in small cubes
  const VS = 0.07, cells = [];
  for (let x = -1; x <= 1; x += VS) for (let y = -1; y <= 1; y += VS) for (let z = -1; z <= 1; z += VS) {
    const p = [x, y, z];
    if (CELL.eScale(p) < 0.97) cells.push({ p, n: v3.dist(p, CELL.nuc.c) < CELL.nuc.r });
  }
  const vg = K.pointsGeo(cells.length);
  cells.forEach((o, i) => { vg.attributes.position.array.set(o.p, 3 * i); vg.attributes.aCol.array.set(o.n ? [0.6, 0.45, 1.0] : [0.3, 0.55, 0.9], 3 * i); vg.attributes.aSize.array[i] = 0.05; });
  const volMat = K.points(set, { hard: true, additive: true });
  const vol = new THREE.Points(vg, volMat); set.group.add(vol);
  const VA = vg.attributes.aA.array, vr = cells.map(() => r());
  return Object.assign(set, {
    params: { next_a: 1, next_halo: 0, next_slab: 0, next_vol: 0 },
    update(S) {
      const h = clamp(S.next_halo, 0, 1), s = clamp(S.next_slab, 0, 1), v = clamp(S.next_vol, 0, 1);
      halos.forEach((m, i) => { const g = K.smooth(clamp(h * 1.5 - i / NH * 0.5, 0, 1)); m.scale.setScalar(Math.max(0.01, g)); m.visible = g > 0.01; });
      tagP.visible = h > 0.01; tg.attributes.aA.array.fill(h); tg.attributes.aA.needsUpdate = true;
      slab.visible = slabEdge.visible = molMesh.visible = s > 0.01;
      slab.scale.set(1, Math.max(0.01, s), 1); slabEdge.scale.copy(slab.scale);
      molMat.opacity *= clamp(s * 1.5 - 0.3, 0, 1);
      slabMat.opacity *= s;
      vol.visible = v > 0.01;
      if (vol.visible) { for (let i = 0; i < VA.length; i++) VA[i] = 0.12 * clamp(v * 1.4 - vr[i] * 0.4, 0, 1); vg.attributes.aA.needsUpdate = true; }
    },
    anchors: { halo: () => v3.add(baits[3], [0, 0.1, 0]), slab: [0.1 + SW[0] * 0.5, SW[1] * 0.45, SZ], vol: [0, CELL.pm[1] * 1.02, 0], nucleus: CELL.nuc.c },
    labels: [],
    cam: { default: [20, 14, 3.6, 0, 0, 0], slab: [8, 8, 2.6, 0.1, 0, SZ], high: [30, 32, 3.8, 0, 0, 0] },
  });
};
