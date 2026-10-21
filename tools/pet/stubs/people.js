// STUB of the people set (tools/pet/SPEC.md), for engine work before the real set exists: the spec's params, anchors,
// labels, cam views, controls and api (with the same stand-in maths), drawn with plain meshes and points.
SETS.people = function (K) {
  const { THREE } = K, set = K.newSet('people'), S1 = PET_DATA.single, ON = S1.organs, N = ON.length, PK = ['healthy', 'cancer', 'both', 'dys'];
  const G = (PET_DATA.poster && PET_DATA.poster.mdi && PET_DATA.poster.mdi.groups) || [], GC = { cancer: '#d9dde6', both: '#9b5de5', dys: '#ff4fd8', healthy: '#38bdf8' };
  const col = id => (PET_DATA.organs.find(o => o.id === id) || { col: '#ffffff' }).col;
  function measure(u, theta) {
    const lt = Math.log(theta), e = u.map(() => new Array(N).fill(0)), s = new Array(N).fill(0);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) { e[i][j] = 1 / (1 + Math.exp(-(Math.log(u[i] / u[j]) - lt) / S1.soft)); s[i] += e[i][j]; s[j] += e[i][j]; }
    const k = ON.indexOf('kidneys'), C = e[k].reduce((a, v, j) => a + (j === k ? 0 : v), 0) / (N - 1), m = s.reduce((a, v) => a + v, 0) / N;
    let g = 0; for (const a of s) for (const b of s) g += Math.abs(a - b);
    const H = m > 0 ? g / (2 * N * N * m) : 0;
    return { e, s, C, H, mdi: Math.max(0, Math.min(10, S1.proj.m + S1.proj.a * C + S1.proj.b * H)) };
  }
  const ring = ON.map((o, i) => { const a = i / N * Math.PI * 2; return [Math.sin(a) * 0.55, 0.75 + Math.cos(a) * 0.3, Math.cos(a) * 0.2]; });
  const nodes = ON.map((o, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), K.fade(set, new THREE.MeshBasicMaterial({ color: col(o) }), 1)); m.position.set(...ring[i]); m.userData.organ = o; set.group.add(m); return m; });
  const bars = ON.map((o, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.03), K.fade(set, new THREE.MeshBasicMaterial({ color: col(o) }), 1)); set.group.add(m); return m; });
  const field = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 1, 0.08), K.fade(set, new THREE.MeshBasicMaterial({ color: 0xffb43b }), 0.9), N * N); set.group.add(field);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), K.fade(set, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, side: THREE.DoubleSide }), 0.25)); plane.rotation.x = -Math.PI / 2; set.group.add(plane);
  const lg = K.linesGeo(N * N), links = new THREE.LineSegments(lg, K.lines(set)); set.group.add(links);
  const gauge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06), K.fade(set, new THREE.MeshBasicMaterial({ color: 0xffb43b }), 1)); set.group.add(gauge);
  // the population: dots by group (stand-ins), and the group centres
  const NP = G.reduce((a, g) => a + g.n, 0), pg = K.pointsGeo(NP || 1), PP = pg.attributes.position.array, r = K.rng(5), grp = [], mx = [];
  G.forEach((g, gi) => { const c = K.rgb(GC[g.key] || '#ffffff'); for (let k = 0; k < g.n; k++) { const i = grp.length; grp.push(gi); mx.push(g.centre + K.gauss(r) * (g.err[1] - g.err[0]) * 0.6); pg.attributes.aCol.array.set(c, 3 * i); pg.attributes.aSize.array[i] = 0.018; } });
  const dots = new THREE.Points(pg, K.points(set)); set.group.add(dots);
  const cent = G.map((g, gi) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), K.fade(set, new THREE.MeshBasicMaterial({ color: GC[g.key] || '#fff' }), 1)); m.userData.group = gi + 1; set.group.add(m); return m; });
  const km = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.02), K.fade(set, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), 0.3)); km.position.set(0, -1.4, 0); set.group.add(km);
  const auc = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.02), K.fade(set, new THREE.MeshBasicMaterial({ color: 0xffb43b }), 0.3)); auc.position.set(1.8, -1.4, 0); set.group.add(auc);
  let S0 = {};
  const uOf = S => { if (S.people_custom > 0.5) return ON.map((o, i) => S['people_u' + i]); const p = S.people_profile, a = Math.floor(p), b = Math.min(3, a + 1), f = p - a; return S1.profiles[PK[a]].u.map((v, i) => K.lerp(v, S1.profiles[PK[b]].u[i], f)); };
  const strip = gi => [(G[gi] ? G[gi].centre : 5) * 0.2 - 1, -0.45 - gi * 0.12, 0];
  const A = { one: [0, 0.75, 0], bars: [-1.1, 0.4, 0], field: [0, 0, 0], plane: () => [0, 0.05 + Math.log(S0.people_theta || 1.5) * 0.5, 0], metrics: [0.9, 0.5, 0],
    map: [0, -0.6, 0], strip: [0, -0.6, 0], km: [0, -1.4, 0], auc: [1.8, -1.4, 0] };
  ON.forEach((o, i) => { A[o] = ring[i]; });
  G.forEach((g, gi) => { A['g' + (gi + 1)] = () => cent[gi].position.toArray(); });
  const params = { people_a: 1, people_bars: 0, people_ratio: 0, people_thresh: 0, people_one: 0, people_metrics: 0, people_profile: 0, people_custom: 0, people_theta: S1.theta,
    people_map: 0, people_mdi: 0, people_group: 0, people_km: 0, people_response: 0, people_follow: 0 };
  ON.forEach((o, i) => { params['people_u' + i] = S1.profiles.healthy.u[i]; });
  const _m = new THREE.Matrix4();
  return Object.assign(set, {
    params,
    update(S, t) {
      S0 = S;
      const u = uOf(S), th = S.people_theta, R = measure(u, th), lt = Math.log(th);
      bars.forEach((b, i) => { b.visible = S.people_bars > 0.02; b.scale.x = Math.max(1e-3, u[i] * 0.15 * S.people_bars); b.position.set(-1.4 + b.scale.x / 2, 0.75 - i * 0.08, 0); });
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = i === j ? 0 : Math.max(0, Math.log(u[i] / u[j])) * S.people_ratio; _m.makeScale(1, Math.max(1e-3, v * 0.5), 1).setPosition((j - 3) * 0.12, v * 0.25, (i - 3) * 0.12); field.setMatrixAt(i * N + j, _m); }
      field.instanceMatrix.needsUpdate = true; field.visible = S.people_ratio > 0.02;
      plane.visible = S.people_thresh > 0.02; plane.position.y = lt * 0.5 * S.people_thresh;
      const P = lg.attributes.position.array, Al = lg.attributes.aA.array, Cl = lg.attributes.aCol.array;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const k = i * N + j; P.set([...ring[i], ...ring[j]], 6 * k); Cl.set([1, 0.7, 0.3, 0.3, 0.6, 1], 6 * k); Al[2 * k] = Al[2 * k + 1] = R.e[i][j] * S.people_one; }
      lg.attributes.position.needsUpdate = lg.attributes.aA.needsUpdate = lg.attributes.aCol.needsUpdate = true; links.visible = S.people_one > 0.02;
      nodes.forEach((n, i) => { n.visible = S.people_one > 0.02 || S.people_bars > 0.5; n.scale.setScalar(0.6 + R.s[i] * 0.15 * (S.people_metrics > 0.5 ? 1 : 0.4)); });
      gauge.visible = S.people_metrics > 0.02; gauge.scale.y = Math.max(1e-3, R.mdi / 10); gauge.position.set(0.9, 0.3 + gauge.scale.y / 2, 0);
      dots.visible = S.people_map > 0.02;
      const g0 = Math.round(S.people_group);
      for (let i = 0; i < NP; i++) {
        const gi = grp[i], m = [(((i * 0.618) % 1) - 0.5) * 1.6, -0.6 + (((i * 0.377) % 1) - 0.5) * 0.6, 0], s = [mx[i] * 0.2 - 1, strip(gi)[1] + (((i * 0.21) % 1) - 0.5) * 0.06, 0];
        PP.set(K.v3.lerp(m, s, S.people_mdi), 3 * i); pg.attributes.aA.array[i] = S.people_map * (g0 && g0 !== gi + 1 ? 0.2 : 1);
      }
      pg.attributes.position.needsUpdate = pg.attributes.aA.needsUpdate = true;
      cent.forEach((c, gi) => { c.visible = S.people_mdi > 0.3; c.position.set(...strip(gi)); c.scale.setScalar(g0 === gi + 1 ? 1.6 : 1); });
      km.visible = S.people_km > 0.02; auc.visible = S.people_response > 0.02;
    },
    anchors: A,
    labels: ON.map((o, i) => ({ text: [PET_DATA.organs.find(x => x.id === o).short, ''], at: o, alpha: S => K.prog(S.people_one, 0.5, 1) * (1 - S.people_map) }))
      .concat([{ text: ['threshold', ''], at: 'plane', cls: 'cyn', alpha: S => K.prog(S.people_thresh, 0.5, 1) * (1 - S.people_one) },
        { text: ['displacement index', 'illustrative maths'], at: 'metrics', cls: 'amb', alpha: S => K.prog(S.people_metrics, 0.5, 1) * (1 - S.people_map) }],
      G.map((g, gi) => ({ text: [g.name, 'n = ' + g.n], at: 'g' + (gi + 1), alpha: S => K.prog(S.people_mdi, 0.6, 1) * (1 - S.people_km) }))),
    cam: { default: [0, 10, 3.6, 0, 0.4, 0], one: [-10, 12, 3.0, -0.3, 0.6, 0], field: [20, 35, 2.2, 0, 0.1, 0], metrics: [0, 8, 3.0, 0.2, 0.55, 0],
      map: [0, 4, 3.0, 0, -0.6, 0], strip: [0, 2, 2.8, 0, -0.65, 0], km: [0, 0, 2.4, 0, -1.4, 0], auc: [0, 0, 2.2, 1.8, -1.4, 0] },
    controls: [{ key: 'view', label: 'View', options: [['one', 'One scan'], ['ratios', 'Ratios'], ['people', 'People'], ['index', 'Index'], ['survival', 'Survival'], ['immunotherapy', 'Immunotherapy']] },
      { key: 'profile', label: 'Profile', options: [['healthy', 'Healthy'], ['cancer', 'Cancer'], ['both', 'Cancer + dyslipidaemia'], ['dys', 'Dyslipidaemia']] }],
    explore(c) {
      const v = c.view, one = v === 'one' || v === 'ratios';
      return { people_bars: v === 'one' ? 1 : 0, people_ratio: v === 'ratios' ? 1 : 0, people_thresh: one ? 1 : 0, people_one: v === 'one' ? 1 : 0, people_metrics: v === 'one' ? 1 : 0,
        people_profile: Math.max(0, PK.indexOf(c.profile)), people_map: one ? 0 : 1, people_mdi: v === 'index' ? 1 : 0, people_km: v === 'survival' ? 1 : 0, people_response: v === 'immunotherapy' ? 1 : 0 };
    },
    api() {
      return { measure, organs: ON,
        pick(rc) { const hit = rc.intersectObjects(nodes.concat(cent).filter(m => m.visible), false)[0]; return !hit ? null : hit.object.userData.organ ? { organ: hit.object.userData.organ } : { group: hit.object.userData.group }; } };
    },
  });
};
