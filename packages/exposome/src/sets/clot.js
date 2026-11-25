// STUB (builder A): builder B replaces this body, keeping the interface in src/SPEC.md ("clot").
// The fine community 11_2_1 up close: its 21 substances; four come forward with their names and their shared gene
// SERPINC1 (antithrombin); the group's label, blood clotting.
SETS.clot = function (K) {
  const { THREE, clamp } = K;
  const set = K.newSet('clot');
  const M = XDATA.ex.clot.members, n = M.length, g = K.pointsGeo(n), P = g.attributes.position.array;
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; P.set([0.6 * Math.cos(a), 0, 0.6 * Math.sin(a)], 3 * i); g.attributes.aCol.array.set(K.rgb(XDATA.comm.col[XDATA.commOf(M[i], 0)]), 3 * i); g.attributes.aSize.array[i] = 0.05; }
  set.group.add(new THREE.Points(g, K.points(set)));
  return Object.assign(set, {
    params: { clot_a: 1, clot_in: 1, clot_four: 0, clot_gene: 0, clot_label: 0 },
    update(S, t) { set.group.rotation.y = 0.05 * t; },
    anchors: { centre: [0, 0, 0], gene: [0, 0.4, 0] },
    labels: [],
    cam: { default: [20, 12, 2.2, 0, 0, 0] },
  });
};
