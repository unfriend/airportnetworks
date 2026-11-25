// STUB (builder A): builder C replaces this body, keeping the interface in src/SPEC.md ("cell").
// Back into the cell's model cell (its skins: C cuts them from packages/ppicell/src/sets/cell.js at build time) with
// the interactome's proteins where that story puts them (XDATA.ppi.cell); one substance's threads into it; then one
// gene (CASP3) with threads back out to its substances.
SETS.cell = function (K) {
  const { THREE, clamp } = K;
  const set = K.newSet('cell');
  const Q = XDATA.ppi, n = Q.N, g = K.pointsGeo(Math.max(1, n)), P = g.attributes.position.array, Cc = g.attributes.aCol.array;
  if (n) { P.set(Q.cell); for (let i = 0; i < n; i++) { Cc.set(K.rgb(Q.place[i] < 13 ? LOOK.protein : LOOK.none), 3 * i); g.attributes.aSize.array[i] = 0.01; } }
  set.group.add(new THREE.Points(g, K.points(set)));
  // threads from the substance (outside, left) to its targets
  const MAXT = 20000, lg = K.linesGeo(MAXT), LP = lg.attributes.position.array, lm = K.lines(set);
  lg.attributes.aCol.array.fill(1); set.group.add(new THREE.LineSegments(lg, lm));
  const SRC = [-1.6, 0.4, 0];
  let shown = -2;
  return Object.assign(set, {
    params: { cell_a: 1, cell_shell: 1, cell_sub: XDATA.ex.bap, cell_thr: 0, cell_gene: -1, cell_rev: 0 },
    update(S) {
      const s = Math.round(S.cell_sub);
      if (s !== shown && n) {
        shown = s;
        const T = s >= 0 ? XDATA.targetsPPI(s) || [] : [], m = Math.min(T.length, MAXT);
        for (let j = 0; j < m; j++) { LP.set(SRC, 6 * j); LP.set(Q.cell.subarray(3 * T[j], 3 * T[j] + 3), 6 * j + 3); }
        lg.setDrawRange(0, 2 * m); lg.attributes.position.needsUpdate = true;
      }
      lm.uniforms.uA.value = set.uA.value * clamp(S.cell_thr, 0, 1) * 0.08;
    },
    anchors: { centre: [0, 0, 0], substance: SRC },
    labels: [],
    cam: { default: [20, 14, 3.8, 0, 0, 0] },
  });
};
SETS.cell.prep = () => XDATA.need(['ppi', 'targets'], pkgUrl);
