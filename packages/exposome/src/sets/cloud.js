// STUB (builder A): builder B replaces this body, keeping the interface in src/SPEC.md ("cloud").
// Every substance as a point: a slow cloud round you, shelves by chemical family (the generator's, XDATA.shelf), the
// authors' own 3D layout of the network (XDATA.pos), its drawn links, coloured by family or by community.
SETS.cloud = function (K) {
  const { THREE, clamp, lerp } = K;
  const set = K.newSet('cloud');
  const X = XDATA, n = X.NN, r = K.rng(11);
  const g = K.pointsGeo(n), P = g.attributes.position.array, Cc = g.attributes.aCol.array, A = g.attributes.aA.array;
  const drift = new Float32Array(3 * n), famCol = X.classes.col.map(c => K.rgb(c)).concat([K.rgb(LOOK.none)]);
  for (let i = 0; i < n; i++) { const u = K.unit(r), d = 0.4 + 0.6 * Math.cbrt(r()); drift.set([u[0] * d, u[1] * d, u[2] * d], 3 * i); g.attributes.aSize.array[i] = 0.012; }
  set.group.add(new THREE.Points(g, K.points(set)));
  const nl = X.links.length / 2, lg = K.linesGeo(nl), LP = lg.attributes.position.array, LA = lg.attributes.aA.array;
  lg.attributes.aCol.array.fill(0.55);
  const lm = K.lines(set), lines = new THREE.LineSegments(lg, lm);
  set.group.add(lines);
  let last = '';
  return Object.assign(set, {
    params: { cloud_a: 1, cloud_shelf: 0, cloud_net: 1, cloud_links: 0, cloud_col: 0, cloud_level: 0, cloud_split: 0, cloud_focus: -1, cloud_pick: -1, cloud_names: 0, cloud_drift: 0 },
    update(S, t) {
      const s = clamp(S.cloud_shelf, 0, 1), m = clamp(S.cloud_net, 0, 1), cc = clamp(S.cloud_col, 0, 1), lv = Math.round(S.cloud_level), f = Math.round(S.cloud_focus);
      const sig = [s, m, cc, lv, f].map(v => v.toFixed(3)).join();
      if (sig !== last) {
        last = sig;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < 3; j++) P[3 * i + j] = lerp(lerp(drift[3 * i + j], X.shelf[3 * i + j], s), X.pos[3 * i + j], m);
          const k = X.commOf(i, lv), fc = famCol[X.prim[i]], kc = K.rgb(X.comm.col[k]);
          for (let j = 0; j < 3; j++) Cc[3 * i + j] = lerp(fc[j], kc[j], cc);
          A[i] = f < 0 || X.commOf(i, X.comm.lv[f]) === f ? 1 : 0.12;
        }
        for (let e = 0; e < nl; e++) { const a = X.links[2 * e], b = X.links[2 * e + 1]; LP.set(P.subarray(3 * a, 3 * a + 3), 6 * e); LP.set(P.subarray(3 * b, 3 * b + 3), 6 * e + 3); }
        g.attributes.position.needsUpdate = g.attributes.aCol.needsUpdate = g.attributes.aA.needsUpdate = true;
        lg.attributes.position.needsUpdate = true;
      }
      lm.uniforms.uA.value = set.uA.value * clamp(S.cloud_links, 0, 1) * 0.25;
      set.group.rotation.y = 0.02 * t * clamp(S.cloud_drift, 0, 1);
    },
    anchors: { centre: [0, 0, 0], top: [0, 1.05, 0] },
    labels: [],
    cam: { default: [20, 14, 3.4, 0, 0, 0], inside: [0, 4, 0.05, 0, 0, 0] },
    controls: [
      { key: 'shape', label: 'Arrange', options: [['net', 'By the genes they share'], ['shelf', 'By chemistry']] },
      { key: 'col', label: 'Colour', options: [['fam', 'Chemical family'], ['0', 'Large groups'], ['1', 'Middle groups'], ['2', 'Fine groups']] },
      { key: 'links', label: 'Threads', options: [['1', 'On'], ['0', 'Off']] },
    ],
    explore(c) {
      return { cloud_shelf: 1, cloud_net: c.shape === 'shelf' ? 0 : 1, cloud_col: c.col === 'fam' || c.col === undefined ? 0 : 1, cloud_level: c.col === 'fam' || c.col === undefined ? 0 : +c.col, cloud_links: c.links === '0' ? 0 : 1 };
    },
  });
};
