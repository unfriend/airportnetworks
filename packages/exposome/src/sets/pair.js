// STUB (builder A): builder B replaces this body, keeping the interface in src/SPEC.md ("pair").
// Two substances side by side, each with its genes as threads; the shared genes glow and become one thread between them.
SETS.pair = function (K) {
  const { THREE, clamp } = K;
  const set = K.newSet('pair');
  const g = K.pointsGeo(2), P = g.attributes.position.array;
  P.set([-0.6, 0, 0, 0.6, 0, 0]); g.attributes.aCol.array.set([...K.rgb(LOOK.substance), ...K.rgb(LOOK.substance)]); g.attributes.aSize.array.fill(0.08);
  set.group.add(new THREE.Points(g, K.points(set)));
  const lg = K.linesGeo(1); lg.attributes.position.array.set([-0.6, 0, 0, 0.6, 0, 0]); lg.attributes.aCol.array.fill(1);
  const lm = K.lines(set); set.group.add(new THREE.LineSegments(lg, lm));
  return Object.assign(set, {
    params: { pair_a: 1, pair_s1: XDATA.ex.bap, pair_s2: XDATA.ex.bap, pair_genes: 1, pair_share: 1, pair_tie: 1 },
    update(S) { lm.uniforms.uA.value = set.uA.value * clamp(S.pair_tie, 0, 1); },
    anchors: { left: [-0.6, 0, 0], right: [0.6, 0, 0], tie: [0, 0.1, 0] },
    labels: [],
    cam: { default: [0, 10, 2.4, 0, 0, 0] },
  });
};
