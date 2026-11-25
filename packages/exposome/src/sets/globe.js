// STUB (builder A): builder C replaces this body, keeping the interface in src/SPEC.md ("globe").
// The airports story's globe (C cuts it from packages/airports/main.js at build time, as packages/pass does) turned to
// Europe; the countries with data; each one's elevated substances rising above it; Italy and endrin's threads to its
// close diseases; the risk score as columns.
SETS.globe = function (K) {
  const { THREE, clamp } = K;
  const set = K.newSet('globe');
  const sph = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), K.fade(set, new THREE.MeshBasicMaterial({ color: 0x2a3a52, wireframe: true, transparent: true })));
  set.group.add(sph);
  const C = XDATA.countries, g = K.pointsGeo(C.length), P = g.attributes.position.array;
  const at = (lat, lon, r) => { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return [r * Math.cos(a) * Math.cos(b), r * Math.sin(a), -r * Math.cos(a) * Math.sin(b)]; };
  C.forEach((c, i) => { P.set(at(c.lat, c.lon, 1.01), 3 * i); g.attributes.aCol.array.set(K.rgb(LOOK.thread), 3 * i); g.attributes.aSize.array[i] = 0.03; });
  set.group.add(new THREE.Points(g, K.points(set)));
  return Object.assign(set, {
    params: { globe_a: 1, globe_turn: 1, globe_marks: 1, globe_subs: 0, globe_country: -1, globe_sub: -1, globe_threads: 0, globe_cols: 0 },
    update(S) {
      // turned so that Europe (about 50 N, 10 E) faces the camera's default view
      const tr = clamp(S.globe_turn, 0, 1);
      set.group.rotation.set(tr * 50 * Math.PI / 180 * 0, -tr * (10 + 90) * Math.PI / 180, 0);
    },
    anchors: { centre: [0, 0, 0], europe: at(50, 10, 1.05) },
    labels: [],
    cam: { default: [20, 14, 3.4, 0, 0, 0] },
  });
};
