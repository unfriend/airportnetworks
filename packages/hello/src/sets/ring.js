// The ring set: the example's 60 people on a ring of radius 1 (HELLO), each with a link to the four nearest, and the
// shortcuts that rewiring makes, arching over the ring; in the middle a counter, a stack of discs as high as the
// average number of handshakes between two people (computed for the network on show).
// params: ring_people (0..1, the people appear round the ring), ring_links (0..1, their links drawn), ring_rw (the
// rewiring level 0..1: HELLO.pOf gives the probability; each link moves at its own level, its old line fading as the
// new arch grows), ring_count (0..1, the counter).
SETS.ring = function (K) {
  const { THREE, clamp, prog, rgb } = K;
  const set = K.newSet('ring');
  const H = HELLO, N = H.N, L = H.links, SEG = 16;
  const COL = { person: '#d8e6ff', ring: rgb('#5fa8ff'), short: rgb('#ffb43b'), disc: '#46d9ff' };
  // the people: lit balls, and a soft glow under each
  const ball = new THREE.SphereGeometry(0.034, 16, 12);
  const people = new THREE.InstancedMesh(ball, K.fade(set, new THREE.MeshStandardMaterial({ color: COL.person, roughness: 0.4, metalness: 0.05 })), N);
  set.group.add(people);
  const glow = K.pointsGeo(N);
  for (let i = 0; i < N; i++) { glow.attributes.position.array.set(H.pos(i), 3 * i); glow.attributes.aCol.array.set(rgb('#7fc4ff'), 3 * i); glow.attributes.aSize.array[i] = 0.16; }
  set.group.add(new THREE.Points(glow, K.points(set)));
  // the links: each one's ring line (one segment, a chord) and its shortcut (SEG segments, an arch), both drawn always,
  // their alpha set by how far the link has moved
  const lg = K.linesGeo(L.length * (1 + SEG)), LP = lg.attributes.position.array, LC = lg.attributes.aCol.array, LA = lg.attributes.aA.array, LT = lg.attributes.aT.array;
  L.forEach((l, k) => {
    const a = H.pos(l.i), b = H.pos(l.j0), o = k * (1 + SEG);
    LP.set([...a, ...b], 6 * o); LC.set([...COL.ring, ...COL.ring], 6 * o);
    const pts = H.arc(l.i, l.t, SEG);
    for (let s = 0; s < SEG; s++) { LP.set([...pts[s], ...pts[s + 1]], 6 * (o + 1 + s)); LC.set([...COL.short, ...COL.short], 6 * (o + 1 + s)); }
    // (the ring lines are revealed round the ring by ring_links: aT is the link's place)
    LT.fill(((l.i + (l.j0 === (l.i + 1) % N ? 0 : 0.5)) / N) * 0.98, 2 * o, 2 * o + 2);
  });
  const lm = K.lines(set);
  set.group.add(new THREE.LineSegments(lg, lm));
  // the counter: up to 16 discs, one per handshake (the last one a part), on a thin stem
  const DISC = 0.045, discs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.11, DISC * 0.7, 32), K.fade(set, new THREE.MeshStandardMaterial({ color: COL.disc, roughness: 0.35, metalness: 0.2, emissive: 0x0b3a4a })), 16);
  set.group.add(discs);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let cur = { p: 0, s: H.stats(0), count: 0 };
  function update(S) {
    const lv = clamp(S.ring_rw, 0, 1), p = H.pOf(lv), st = H.stats(p), show = clamp(S.ring_people, 0, 1);
    cur = { p, s: st, count: clamp(S.ring_count, 0, 1) };
    for (let i = 0; i < N; i++) {
      const a = prog(show, i / N * 0.85, i / N * 0.85 + 0.15);
      v.fromArray(H.pos(i)); sc.setScalar(Math.max(1e-4, a));
      people.setMatrixAt(i, m4.compose(v, q, sc));
      glow.attributes.aA.array[i] = 0.35 * a;
    }
    people.instanceMatrix.needsUpdate = true;
    K.upload(glow.attributes.aA, N);
    lm.uniforms.uReveal.value = clamp(S.ring_links, 0, 1);
    // each link: its ring line fades out and its arch grows from its own end as the level passes the link's own
    const reveal = clamp(S.ring_links, 0, 1);
    L.forEach((l, k) => {
      const f = clamp((lv - l.lv) / 0.04 + 0.5, 0, 1), o = k * (1 + SEG);
      LA[2 * o] = LA[2 * o + 1] = 0.75 * (1 - f);
      for (let s = 0; s < SEG; s++) { const g = clamp(f * SEG - s, 0, 1) * (reveal >= 0.999 ? 1 : 0); LA[2 * (o + 1 + s)] = LA[2 * (o + 1 + s) + 1] = 0.95 * g; }
    });
    K.upload(lg.attributes.aA, L.length * (1 + SEG) * 2);
    // the counter: as many discs as handshakes on average
    const h = st.avg * cur.count;
    for (let d = 0; d < 16; d++) {
      const part = clamp(h - d, 0, 1);
      v.set(0, DISC * (d + 0.5 * part), 0); sc.set(part > 0 ? 1 : 1e-4, Math.max(1e-4, part), part > 0 ? 1 : 1e-4);
      discs.setMatrixAt(d, m4.compose(v, q, sc));
    }
    discs.instanceMatrix.needsUpdate = true;
  }
  // picking: the person a ray (world coordinates) passes nearest, or -1
  const inv = new THREE.Matrix4(), ray = new THREE.Ray(), pp = new THREE.Vector3();
  function pick(rc) {
    inv.copy(set.group.matrixWorld).invert();
    ray.copy(rc.ray).applyMatrix4(inv);
    // (the one the ray passes closest: neighbours 0.1 apart can both be in reach seen from low down)
    let best = -1, bd = 0.07 * 0.07;
    for (let i = 0; i < N; i++) {
      const d = ray.distanceSqToPoint(pp.fromArray(H.pos(i)));
      if (d < bd && pp.sub(ray.origin).dot(ray.direction) > 0) { bd = d; best = i; }
    }
    return best;
  }
  const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
  return Object.assign(set, {
    params: { ring_a: 1, ring_people: 1, ring_links: 1, ring_rw: 0, ring_count: 1 },
    update,
    anchors: { centre: [0, 0, 0], front: H.pos(0), back: H.pos(30), top: () => [0, DISC * cur.s.avg * cur.count + 0.05, 0], side: [1.05, 0.05, 0.25] },
    labels: [{ text: () => [`${f1(cur.s.avg)} handshakes`, 'on average'], at: 'top', cls: 'cyn', alpha: S => prog(S.ring_count, 0.6, 1) }],
    cam: { default: [0, 34, 5.2, 0, 0.12, 0], top: [0, 78, 5.0, 0, 0, 0], low: [24, 9, 4.4, 0, 0.22, 0] },
    controls: [
      { key: 'rw', label: 'Rewired links', options: [['0', 'None'], ['0.01', '1%'], ['0.05', '5%'], ['0.1', '10%'], ['0.3', '30%'], ['1', 'All']] },
      { key: 'view', label: 'View', options: [['default', 'Tilted'], ['top', 'From above'], ['low', 'Low']] },
    ],
    explore(c) { return { ring_people: 1, ring_links: 1, ring_count: 1, ring_rw: H.levelOf(+c.rw || 0) }; },
    api: () => ({ pick, pos: i => H.pos(i), now: () => cur }),
  });
};
