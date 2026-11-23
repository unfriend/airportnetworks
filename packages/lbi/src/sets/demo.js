// a tiny example set: glowing points on a sphere, lines to the centre, a lit box and a rim bubble
SETS.demo = function (K) {
  const { THREE } = K;
  const set = K.newSet('demo');
  const r = K.rng(1), n = 2000, g = K.pointsGeo(n);
  for (let i = 0; i < n; i++) {
    const u = K.unit(r);
    g.attributes.position.array.set(K.v3.mul(u, 0.8 + 0.2 * r()), 3 * i);
    g.attributes.aCol.array.set(K.ramp([[0, [1, 0.3, 0.1]], [1, [1, 0.9, 0.3]]], r()), 3 * i);
    g.attributes.aSize.array[i] = 0.02 + 0.03 * r();
  }
  set.group.add(new THREE.Points(g, K.points(set)));
  const lg = K.linesGeo(300);
  for (let i = 0; i < 300; i++) {
    lg.attributes.position.array.set([0, 0, 0, ...K.v3.mul(K.unit(r), 0.8)], 6 * i);
    lg.attributes.aCol.array.set([0.3, 0.6, 1, 0.3, 0.6, 1], 6 * i);
    lg.attributes.aA.array.set([0.5, 0.1], 2 * i);
    lg.attributes.aT.array.set([i / 300, i / 300], 2 * i);
  }
  const lm = K.lines(set);
  set.group.add(new THREE.LineSegments(lg, lm));
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), K.fade(set, new THREE.MeshStandardMaterial({ color: 0x46d9ff, roughness: 0.5 })));
  set.group.add(box);
  const bub = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), K.rim(set, { color: '#ff5ad9' }));
  bub.position.set(0.5, 0.3, 0);
  set.group.add(bub);
  return Object.assign(set, {
    params: { demo_a: 1, demo_reveal: 1 },
    update(S, t) { lm.uniforms.uReveal.value = S.demo_reveal; box.rotation.set(t * 0.5, t * 0.7, 0); },
    anchors: { box: [0, 0.25, 0] },
    labels: [{ text: ['Box', 'a lit box'], at: 'box', cls: 'cyn', alpha: S => S.demo_a }],
    cam: { default: [20, 15, 3.6, 0, 0, 0] },
  });
};
