// The path set: the shortest chain of friends between two people of the ring (HELLO.path, on the network the ring set
// shows: it reads ring_rw), as a glowing tube that runs hop by hop along the links, the two people ringed.
// params: path_from, path_to (the two people, by number; -1 none: they jump, never ease), path_show (0..1, the hops
// drawn one after the other). Drawn over the ring set, in the same frame.
SETS.path = function (K) {
  const { THREE, clamp, rgb } = K;
  const set = K.newSet('path');
  const H = HELLO, N = H.N, SEG = 12, MAXH = 24;
  // the hops: short cylinders along each hop's shape (a chord on the ring, an arch for a shortcut)
  const tube = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8, 1, true), K.fade(set, new THREE.MeshBasicMaterial({ color: '#ff5ad9' })), MAXH * SEG);
  set.group.add(tube);
  // the two people, ringed (A cyan, B amber), and a glow on everyone the chain passes
  const ringG = new THREE.TorusGeometry(0.075, 0.009, 8, 40);
  const ends = [rgb('#46d9ff'), rgb('#ffb43b')].map(c => {
    const m = new THREE.Mesh(ringG, K.fade(set, new THREE.MeshBasicMaterial({ color: new THREE.Color(...c) })));
    m.rotation.x = Math.PI / 2; set.group.add(m); return m;
  });
  const glow = K.pointsGeo(MAXH + 1);
  for (let i = 0; i <= MAXH; i++) { glow.attributes.aCol.array.set(rgb('#ff8ae6'), 3 * i); glow.attributes.aSize.array[i] = 0.2; }
  set.group.add(new THREE.Points(glow, K.points(set)));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), a = new THREE.Vector3(), b = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3();
  const hide = new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4);
  let cur = { path: null, from: -1, to: -1 };
  function update(S) {
    const p = H.pOf(clamp(S.ring_rw || 0, 0, 1)), from = Math.round(S.path_from), to = Math.round(S.path_to);
    const path = from >= 0 && to >= 0 && from !== to ? H.path(p, from, to) : null, hops = path ? Math.min(MAXH, path.length - 1) : 0;
    cur = { path, from, to };
    const shown = clamp(S.path_show, 0, 1) * hops;
    let n = 0;
    for (let h = 0; h < hops; h++) {
      const pts = H.arc(path[h], path[h + 1], SEG), f = clamp(shown - h, 0, 1);
      for (let s = 0; s < SEG; s++, n++) {
        const g = clamp(f * SEG - s, 0, 1);
        if (g <= 0) { tube.setMatrixAt(n, hide); continue; }
        a.fromArray(pts[s]); b.fromArray(pts[s + 1]); b.sub(a);
        const len = b.length() * g;
        q.setFromUnitVectors(up, b.normalize());
        a.addScaledVector(b, len / 2);
        tube.setMatrixAt(n, m4.compose(a, q, sc.set(1, len, 1)));
      }
    }
    for (; n < MAXH * SEG; n++) tube.setMatrixAt(n, hide);
    tube.instanceMatrix.needsUpdate = true;
    [from, to].forEach((i, k) => { ends[k].visible = i >= 0 && i < N; if (ends[k].visible) ends[k].position.fromArray(H.pos(i)); });
    for (let i = 0; i <= MAXH; i++) {
      const on = path && i <= hops && clamp(shown - i + 1, 0, 1) > 0;
      glow.attributes.aA.array[i] = on ? 0.55 : 0;
      if (on) glow.attributes.position.array.set(H.pos(path[i]), 3 * i);
    }
    glow.attributes.position.needsUpdate = true; glow.attributes.aA.needsUpdate = true;
  }
  const at = i => () => (i >= 0 && i < N ? H.pos(i).map((x, k) => (k === 1 ? x + 0.1 : x * 1.12)) : [0, 0, 0]);
  return Object.assign(set, {
    params: { path_a: 1, path_from: 0, path_to: 30, path_show: 1 },
    update,
    anchors: { a: () => at(cur.from)(), b: () => at(cur.to)() },
    labels: [
      { text: () => (cur.from >= 0 ? ['A', `person ${cur.from + 1}`] : ['', '']), at: 'a', cls: 'cyn', alpha: S => clamp(S.path_show * 4, 0, 1) },
      { text: () => (cur.to >= 0 ? ['B', cur.path ? `${cur.path.length - 1} handshakes from A` : `person ${cur.to + 1}`] : ['', '']), at: 'b', cls: 'amb', alpha: S => clamp(S.path_show * 4 - 3, 0, 1) },
    ],
    cam: { default: [0, 34, 5.2, 0, 0.12, 0] },
    api: () => ({ now: () => cur }),
  });
};
