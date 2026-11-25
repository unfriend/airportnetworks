// STUB (builder A): builder C replaces this body, keeping the interface in src/SPEC.md ("ppi").
// The interactome taken out of the cell and sorted (the best connected in the middle, loners at the rim: XDATA.ppi.sorted,
// ours), its drawn contacts; a substance's targets by pattern; hazard flares; a disease's neighbourhood and its distance
// to a substance; many pairs flashing.
SETS.ppi = function (K) {
  const { THREE, clamp, lerp } = K;
  const set = K.newSet('ppi');
  const Q = XDATA.ppi, n = Q.N, g = K.pointsGeo(Math.max(1, n)), P = g.attributes.position.array;
  for (let i = 0; i < n; i++) { g.attributes.aCol.array.set(K.rgb(LOOK.protein), 3 * i); g.attributes.aSize.array[i] = 0.01; }
  set.group.add(new THREE.Points(g, K.points(set)));
  let last = -1;
  return Object.assign(set, {
    params: { ppi_a: 1, ppi_links: 0, ppi_sort: 1, ppi_pat: -1, ppi_sub: -1, ppi_haz: 0, ppi_dis: -1, ppi_paths: 0, ppi_pairs: 0 },
    update(S) {
      const s = clamp(S.ppi_sort, 0, 1);
      if (s !== last && n) { last = s; for (let j = 0; j < 3 * n; j++) P[j] = lerp(Q.cell[j], Q.sorted[j], s); g.attributes.position.needsUpdate = true; }
    },
    anchors: { centre: [0, 0, 0], rim: [1, 0, 0] },
    labels: [],
    cam: { default: [20, 14, 3.4, 0, 0, 0] },
  });
};
SETS.ppi.prep = () => XDATA.need(['ppi', 'targets', 'diseases'], pkgUrl);
