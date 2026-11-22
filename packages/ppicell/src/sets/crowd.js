// One dot opening into the crowd it stands for (chapter 2): a cube of cytoplasm about 100 nanometres across, a third full
// of protein molecules (a few simple shapes, illustrative: globules, rods, rings, pairs), each on a spot of a jittered
// grid so none overlap, jiggling in place. One kind is marked (crowd_mark): the copies one dot of the map stands for.
// Drawn in the cell's frame, at a spot in the cytosol; the cube grows out of a single dot (crowd_open). One instanced
// draw per shape (four), the cube's edges one more.
SETS.crowd = function (K) {
  const { THREE, clamp, lerp } = K;
  const set = K.newSet('crowd');
  const AT = [0.5, 0.22, 0.42], SIDE = 0.2, N = 12;   // (12 x 12 x 12 grid spots, nearly all filled: about 1,700 molecules)
  const holder = new THREE.Group(); holder.position.set(...AT);
  set.group.add(holder);
  const r = K.rng(23);
  // the shapes, each about the size of a grid spot's third (a third full)
  const shapes = [
    new THREE.IcosahedronGeometry(0.0062, 1),   // a globular protein
    (() => { const g = new THREE.CylinderGeometry(0.0034, 0.0034, 0.016, 6); return g; })(),   // a rod (a coiled coil, a filament's piece)
    new THREE.TorusGeometry(0.0056, 0.0022, 5, 10),   // a ring (a clamp, a pore's part)
    (() => { const a = new THREE.IcosahedronGeometry(0.0048, 0), b = new THREE.IcosahedronGeometry(0.0062, 0); a.translate(0.0055, 0, 0); b.translate(-0.0045, 0, 0); return K.merge([a, b]); })(),   // a pair (two domains)
  ];
  shapes.forEach(g => g.computeVertexNormals());
  const step = SIDE / N, items = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    if (r() < 0.04) continue;
    const s = r() < 0.5 ? 0 : r() < 0.4 ? 1 : r() < 0.5 ? 2 : 3;
    items.push({ s, p: [(x + 0.5) * step - SIDE / 2 + (r() - 0.5) * step * 0.3, (y + 0.5) * step - SIDE / 2 + (r() - 0.5) * step * 0.3, (z + 0.5) * step - SIDE / 2 + (r() - 0.5) * step * 0.3],
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.3, r() * 6.3, r() * 6.3)), k: 0.85 + 0.5 * r(), ph: r() * 6.3, mark: false });
  }
  // the marked kind: about one in fifty globules, the copies of one protein in this spot
  items.forEach(o => { if (o.s === 0 && r() < 0.05) o.mark = true; });
  const PAL = [[0.55, 0.62, 0.78], [0.62, 0.7, 0.6], [0.75, 0.62, 0.7], [0.7, 0.66, 0.55]], MARK = [0.27, 0.85, 1.0];
  const meshes = shapes.map((g, s) => {
    const list = items.filter(o => o.s === s);
    const mat = K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05, emissive: 0x000000 }));
    const m = new THREE.InstancedMesh(g, mat, list.length);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3 * list.length), 3);
    m.frustumCulled = false;
    holder.add(m);
    return { m, list };
  });
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
  const M4 = new THREE.Matrix4(), V = new THREE.Vector3(), Sc = new THREE.Vector3(), C = new THREE.Color();
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
      edges.visible = skin.visible = vis;
      if (!vis) return;
      // (jiggling in place: thermal motion, a fraction of a spot; depends only on the time)
      const key = (t * 30 | 0) + '|' + mk.toFixed(3);
      if (key === last) return;
      last = key;
      for (const { m, list } of meshes) {
        list.forEach((it, i) => {
          const j = 0.18 * step;
          V.set(it.p[0] + j * Math.sin(t * 1.7 + it.ph), it.p[1] + j * Math.sin(t * 1.3 + it.ph * 2.1), it.p[2] + j * Math.sin(t * 1.9 + it.ph * 0.7));
          Sc.setScalar(it.k * (it.mark ? 1 + 0.25 * mk : 1));
          M4.compose(V, it.q, Sc); m.setMatrixAt(i, M4);
          const c = it.mark ? MARK : PAL[it.s], d = it.mark ? 1 : 1 - 0.6 * mk;
          C.setRGB(c[0] * d, c[1] * d, c[2] * d); m.setColorAt(i, C);
        });
        m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
      }
    },
    anchors: { dot: AT, cube: [AT[0], AT[1] + SIDE * 0.62, AT[2]], corner: [AT[0] + SIDE * 0.5, AT[1] - SIDE * 0.5, AT[2] + SIDE * 0.5],
      mark: () => { const it = items.find(o => o.mark && o.p[1] > 0) || items[0]; return [AT[0] + it.p[0], AT[1] + it.p[1], AT[2] + it.p[2]]; } },
    labels: [],
    cam: { default: [30, 16, 0.75, AT[0], AT[1], AT[2]], close: [55, 12, 0.5, AT[0], AT[1], AT[2]] },
    stats: () => ({ n: items.length, marked: items.filter(o => o.mark).length }),
  });
};
