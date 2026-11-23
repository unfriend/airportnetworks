// The template's set (replace it with your own): points that gather into a ball and spread out, and a lit core.
// The contract is packages/lbi/src/SPEC.md, "What a set exports": a group, params (names start with the set's key; <key>_a is
// its fade, the engine's), update(S, t) depending only on the params and the time, anchors, labels, cam views,
// controls and explore(c).
SETS.orb = function (K) {
  const { THREE, clamp, lerp, prog } = K;
  const set = K.newSet('orb');
  const r = K.rng(7), n = 1500, g = K.pointsGeo(n), P = g.attributes.position.array, home = new Float32Array(n * 3), far = new Float32Array(n * 3), when = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = K.unit(r), d = 0.55 + 0.15 * r(), f = 1 + 0.5 * r();
    home.set([u[0] * d, u[1] * d, u[2] * d], 3 * i); far.set([u[0] * d * f, u[1] * d * f, u[2] * d * f], 3 * i);
    g.attributes.aCol.array.set(K.ramp([[0, K.rgb('#46d9ff')], [1, K.rgb('#ff5ad9')]], r()), 3 * i);
    g.attributes.aSize.array[i] = 0.02 + 0.025 * r();
    when[i] = r();
  }
  set.group.add(new THREE.Points(g, K.points(set)));
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 2), K.fade(set, new THREE.MeshStandardMaterial({ color: 0xffb43b, roughness: 0.45, metalness: 0.1 })));
  set.group.add(core);
  const A = g.attributes.aA.array;
  return Object.assign(set, {
    params: { orb_a: 1, orb_grow: 1, orb_spread: 0 },
    update(S, t) {
      const s = clamp(S.orb_spread, 0, 1);
      for (let i = 0; i < n; i++) {
        A[i] = prog(S.orb_grow, when[i] * 0.8, when[i] * 0.8 + 0.2);
        for (let j = 0; j < 3; j++) P[3 * i + j] = lerp(home[3 * i + j], far[3 * i + j], s) * (0.9 + 0.1 * A[i]);
      }
      g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true;
      core.rotation.set(t * 0.3, t * 0.4, 0);
      core.scale.setScalar(0.6 + 0.4 * clamp(S.orb_grow, 0, 1));
    },
    anchors: { core: [0, 0.25, 0], edge: () => [0.8, 0.3, 0] },
    labels: [{ text: ['Core', 'a lit mesh'], at: 'edge', cls: 'amb', alpha: S => prog(S.orb_grow, 0.6, 1) }],
    cam: { default: [20, 14, 3.6, 0, 0, 0], close: [35, 8, 2.6, 0, 0, 0] },
    controls: [
      { key: 'view', label: 'View', options: [['default', 'Whole'], ['close', 'Close']] },
      { key: 'spread', label: 'Points', options: [['0', 'Gathered'], ['1', 'Spread out']] },
    ],
    explore(c) { return { orb_grow: 1, orb_spread: c.spread === '1' ? 1 : 0 }; },
  });
};
