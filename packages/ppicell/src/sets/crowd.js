// One dot opening into the crowd it stands for (chapter 2): a cube of cytoplasm about 100 nanometres across, crowded
// with protein molecules, each a real protein from the Protein Data Bank as a simplified molecular surface (src/models.json,
// its lowest level of detail, a few hundred triangles): ubiquitin, calmodulin, actin, GAPDH and tubulin, sized to scale
// against each other and the cube (one factor from angstroms to the scene), packed without overlaps, jiggling in place.
// One kind is marked (crowd_mark: every calmodulin), the copies one dot of the map stands for. Drawn in the cell's
// frame, at a spot in the cytosol; the cube grows out of a single dot (crowd_open). One instanced draw per kind
// (molInstanced: five), the cube's edges one more.
SETS.crowd = function (K) {
  const { THREE, clamp, lerp } = K;
  const set = K.newSet('crowd');
  const AT = [0.5, 0.22, 0.42], SIDE = 0.2, HALF = SIDE / 2;
  const PER_A = SIDE / 1000;   // (scene units per angstrom: the cube's side is 100 nanometres, 1,000 angstroms)
  const holder = new THREE.Group(); holder.position.set(...AT);
  set.group.add(holder);
  const r = K.rng(23);
  // the kinds, largest first (packed in that order, the small ones then fill the gaps); share: of the molecules drawn,
  // illustrative (each is among a cell's most plentiful proteins); a muted colour each
  const KINDS = [
    { key: 'tub', share: 0.11, c: [0.55, 0.7, 0.6] },
    { key: 'gapdh', share: 0.12, c: [0.7, 0.66, 0.55] },
    { key: 'actin', share: 0.2, c: [0.75, 0.62, 0.7] },
    { key: 'cam', share: 0.12, c: [0.55, 0.62, 0.78], mark: true },
    { key: 'ubq', share: 0.45, c: [0.62, 0.66, 0.72] },
  ];
  // (each kind's reach from its middle, for packing: its bounding sphere; its triangles at the level drawn)
  KINDS.forEach(k => { const H = molHead(k.key); k.rad = H ? H.radius * PER_A : 0.003; k.tris = H ? H.looks.surface[2].t : 300; });
  // how many: as many as about 170,000 triangles allow (a headset's budget), in the shares above. A real cube this size
  // holds a few thousand; to look as crowded as it is, they are packed into a shell about two large molecules deep under the
  // cube's faces (all that shows from outside), round a dim core (the later, smaller kinds may fall short of their share
  // where the shell is full: the count shown is what is drawn)
  const TRI = 170000, avg = KINDS.reduce((t, k) => t + k.share * k.tris, 0), DEEP = 0.022, JIG = 0.0011;
  const items = [], grid = new Map(), CELLW = 0.024, gk = (a, b, c) => a + 1000 * b + 1e6 * c;
  const cellOf = p => p.map(x => Math.floor((x + HALF) / CELLW));
  const free = (p, rad) => {
    const g = cellOf(p);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const o of grid.get(gk(g[0] + dx, g[1] + dy, g[2] + dz)) || []) if (Math.hypot(o.p[0] - p[0], o.p[1] - p[1], o.p[2] - p[2]) < o.rad + rad + 2 * JIG) return false;
    }
    return true;
  };
  KINDS.forEach((k, s) => {
    const want = Math.round(TRI / avg * k.share);
    for (let n = 0, tries = 0; n < want && tries < want * 80; tries++) {
      const room = HALF - k.rad - JIG, p = [0, 1, 2].map(() => (r() * 2 - 1) * room);
      if (Math.max(...p.map(Math.abs)) < HALF - DEEP || !free(p, k.rad)) continue;
      const it = { s, p, rad: k.rad, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.3, r() * 6.3, r() * 6.3)), ph: r() * 6.3, mark: !!k.mark };
      items.push(it); n++;
      const c = gk(...cellOf(p)); if (!grid.has(c)) grid.set(c, []); grid.get(c).push(it);
    }
  });
  const MARK = [0.27, 0.85, 1.0];
  // (each kind one instanced draw of its model's lowest level, white, tinted per copy)
  const meshes = KINDS.map((k, s) => {
    const list = items.filter(o => o.s === s), mi = molInstanced(set, k.key, { lod: 2, count: Math.max(1, list.length), scale: PER_A });
    const m = mi.mesh;
    if (m.isInstancedMesh) { m.count = list.length; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3 * m.instanceMatrix.count), 3); }
    holder.add(m);
    return { m, mi, list };
  });
  // the core: dim, so the far side of the shell does not show through its gaps
  { const c = SIDE - 2 * DEEP + 0.004, core = new THREE.Mesh(new THREE.BoxGeometry(c, c, c), K.fade(set, new THREE.MeshStandardMaterial({ color: 0x2a3a4c, roughness: 0.9, metalness: 0 })));
    holder.add(core); meshes.core = core; }
  // the cube's edges and a faint skin
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(SIDE, SIDE, SIDE)), K.fade(set, new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true }), 0.7));
  holder.add(edges);
  const skin = new THREE.Mesh(new THREE.BoxGeometry(SIDE, SIDE, SIDE), K.rim(set, { color: [0.4, 0.7, 1.0], a0: 0.02, a1: 0.12 }));
  holder.add(skin);
  // the dot it opens from
  const dg = K.pointsGeo(1);
  dg.attributes.aCol.array.set(MARK); dg.attributes.aSize.array[0] = 0.03;
  const dot = new THREE.Points(dg, K.points(set));
  holder.add(dot);
  const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const V = new THREE.Vector3(), C = new THREE.Color();
  let last = '';
  return Object.assign(set, {
    // crowd_open: 0 a single dot, 1 the cube full size; crowd_mark: the marked kind lit (the rest dimmed)
    params: { crowd_a: 1, crowd_open: 0, crowd_mark: 0 },
    update(S, t) {
      const o = clamp(S.crowd_open, 0, 1), mk = clamp(S.crowd_mark, 0, 1), sc = lerp(0.02, 1, o * o);
      holder.scale.setScalar(sc);
      dg.attributes.aA.array[0] = 1 - clamp(o * 3, 0, 1); dg.attributes.aA.needsUpdate = true;
      dot.scale.setScalar(1 / sc);
      const vis = o > 0.02;
      for (const { m } of meshes) m.visible = vis;
      meshes.core.visible = vis;
      edges.visible = skin.visible = vis;
      if (!vis) return;
      // (jiggling in place: thermal motion, a fraction of a spot; depends only on the time)
      const key = (t * 30 | 0) + '|' + mk.toFixed(3);
      if (key === last) return;
      last = key;
      for (const { m, mi, list } of meshes) {
        if (!m.isInstancedMesh) continue;
        list.forEach((it, i) => {
          const j = JIG;
          V.set(it.p[0] + j * Math.sin(t * 1.7 + it.ph), it.p[1] + j * Math.sin(t * 1.3 + it.ph * 2.1), it.p[2] + j * Math.sin(t * 1.9 + it.ph * 0.7));
          mi.setAt(i, V, it.q, it.mark ? 1 + 0.2 * mk : 1);
          const c = it.mark ? lerp3(KINDS[it.s].c, MARK, mk) : KINDS[it.s].c, d = it.mark ? 1 : 1 - 0.6 * mk;
          C.setRGB(c[0] * d, c[1] * d, c[2] * d); m.setColorAt(i, C);
        });
        m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
      }
    },
    anchors: { dot: AT, cube: [AT[0], AT[1] + SIDE * 0.62, AT[2]], corner: [AT[0] + SIDE * 0.5, AT[1] - SIDE * 0.5, AT[2] + SIDE * 0.5],
      mark: () => { const it = items.find(o => o.mark && o.p[1] > 0) || items[0]; return [AT[0] + it.p[0], AT[1] + it.p[1], AT[2] + it.p[2]]; } },
    labels: [],
    cam: { default: [30, 16, 0.75, AT[0], AT[1], AT[2]], close: [55, 12, 0.5, AT[0], AT[1], AT[2]] },
    stats: () => ({ n: items.length, marked: items.filter(o => o.mark).length, kinds: KINDS.map(k => [k.key, items.filter(o => KINDS[o.s] === k).length]) }),
  });
};
SETS.crowd.prep = molPrep(['ubq', 'cam', 'actin', 'gapdh', 'tub']);
