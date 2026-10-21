// STUB of the organs set (tools/pet/SPEC.md), for engine work before the real set exists: the spec's params, anchors,
// labels, cam views, controls and api, drawn with plain spheres, boxes and lines in the body set's frame.
SETS.organs = function (K) {
  const { THREE } = K, set = K.newSet('organs'), D = PET_DATA, O = D.organs;
  const NETS = ['full', 'FDG_healthy', 'A_low', 'A_high', 'B_low', 'B_high', 'C_low', 'C_mid', 'C_high', 'HK2', 'GLUT'];
  const SHORT = ['All scans', 'Healthy', 'BMI low', 'BMI high', 'Tumour low', 'Tumour high', 'CRP low', 'CRP mid', 'CRP high', 'HK2', 'GLUT'];
  const netOf = i => D.nets.find(n => n.id === NETS[Math.max(0, Math.min(NETS.length - 1, Math.round(i)))]) || null;
  // each organ: a shell on the organ, a bar to the body's right, a node on a shallow dome in front of the torso
  const shells = [], bars = [], nodes = [], home = O.map(o => o.pos), node = O.map((o, i) => [o.pos[0] * 2.6 + (i % 2 ? 0.08 : -0.08), 0.1 + o.pos[1] * 0.75, 0.5 - Math.abs(o.pos[0])]);
  O.forEach((o, i) => {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(o.id === 'fat' ? 0.14 : 0.045, 16, 12), K.rim(set, { color: o.col, a0: 0.12, a1: 0.8 }));
    sh.position.set(...o.pos); sh.userData.id = o.id; set.group.add(sh); shells.push(sh);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 0.035, 0.03), K.fade(set, new THREE.MeshBasicMaterial({ color: o.col }), 1));
    b.position.set(0.45, 0.75 - i * 0.075, 0); b.userData.id = o.id; set.group.add(b); bars.push(b);
    const nd = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), K.fade(set, new THREE.MeshBasicMaterial({ color: o.col }), 1));
    nd.userData.id = o.id; set.group.add(nd); nodes.push(nd);
  });
  const lesion = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), K.fade(set, new THREE.MeshBasicMaterial({ color: 0xffffff }), 1));
  lesion.position.set(-0.09, 0.37, 0.03); set.group.add(lesion);
  const matrix = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.02), K.fade(set, new THREE.MeshBasicMaterial({ color: 0xff7a2a }), 0.8));
  matrix.position.set(0.95, 0.1, 0); set.group.add(matrix);
  // the scatter plot of a pair (synth.pairs): raw values gliding to residuals
  const NP = D.synth.n, sg = K.pointsGeo(NP), sp = sg.attributes.position.array;
  for (let i = 0; i < NP; i++) { sg.attributes.aCol.array.set([0.9, 0.95, 1], 3 * i); sg.attributes.aSize.array[i] = 0.012; }
  const scatter = new THREE.Points(sg, K.points(set)); scatter.position.set(1.0, 0.3, 0.2); set.group.add(scatter);
  // links of the current network
  const lg = K.linesGeo(80), links = new THREE.LineSegments(lg, K.lines(set)); set.group.add(links);
  let built = -1, S0 = {};
  const nodePos = i => K.v3.lerp(home[i], node[i], S0.organs_net || 0);
  function buildLinks(w) {
    const n = netOf(w), e = n ? n.edges : [], P = lg.attributes.position.array, C = lg.attributes.aCol.array, A = lg.attributes.aA.array;
    A.fill(0);
    e.slice(0, 80).forEach(([a, b, x], k) => {
      const ia = O.findIndex(o => o.id === a), ib = O.findIndex(o => o.id === b);
      if (ia < 0 || ib < 0) return;
      P.set([...node[ia], ...node[ib]], 6 * k);
      const c = x > 0 ? [0.3, 0.49, 1] : [1, 0.3, 0.3]; C.set([...c, ...c], 6 * k); A[2 * k] = A[2 * k + 1] = Math.min(1, Math.abs(x) * 2);
    });
    lg.attributes.position.needsUpdate = lg.attributes.aCol.needsUpdate = lg.attributes.aA.needsUpdate = true;
    built = w;
  }
  const strengthBars = O.map(o => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.02), K.fade(set, new THREE.MeshBasicMaterial({ color: o.col }), 1)); set.group.add(b); return b; });
  const hubOf = () => { const n = netOf(S0.organs_which || 0); const h = n ? (n.hubs && n.hubs.length ? n.hubs : (n.computed && n.computed.hubs) || []) : []; return h[0] || null; };
  const A = { bars: [0.6, 0.3, 0], matrix: [0.95, 0.1, 0], scatter: [1.0, 0.3, 0.2], net: [0, 0.25, 0.4], strength: [0, -0.5, 0.4], lesion: [-0.09, 0.37, 0.03],
    hub: () => { const h = hubOf(), i = O.findIndex(o => o.id === h); return i >= 0 ? nodePos(i) : A.net; } };
  O.forEach((o, i) => { A[o.id] = () => nodePos(i); });
  return Object.assign(set, {
    params: { organs_a: 1, organs_seg: 0, organs_suv: 0, organs_focus: 0, organs_lesion: 0, organs_rows: 0, organs_pair: 0, organs_partial: 0, organs_net: 0, organs_which: 0, organs_strength: 0 },
    update(S, t) {
      S0 = S;
      const f = Math.round(S.organs_focus), w = Math.round(S.organs_which);
      if (w !== built) buildLinks(w);
      const n = netOf(w), drawn = new Set(n ? n.organs : []);
      O.forEach((o, i) => {
        const dim = f && f !== i + 1 ? 0.3 : 1;
        shells[i].visible = S.organs_seg > (0.95 - o.pos[1]) / 1.9 && S.organs_net < 0.9;
        bars[i].scale.x = Math.max(1e-3, S.organs_suv * o.suv * 0.12); bars[i].position.x = 0.4 + bars[i].scale.x / 2; bars[i].visible = S.organs_suv > 0.01 && S.organs_rows < 0.5;
        nodes[i].position.set(...nodePos(i)); nodes[i].visible = S.organs_net > 0.05 && (drawn.has(o.id) || !n); nodes[i].scale.setScalar(dim * (f === i + 1 ? 1.6 : 1));
        const st = n && n.computed && n.computed.strength[o.id] || 0;
        strengthBars[i].visible = S.organs_strength > 0.05 && st > 0; strengthBars[i].scale.y = Math.max(1e-3, st * 0.12 * S.organs_strength);
        strengthBars[i].position.set(-0.45 + i * 0.07, -0.55 + strengthBars[i].scale.y / 2, 0.4);
      });
      links.visible = S.organs_net > 0.3; lesion.visible = S.organs_lesion > 0.02; lesion.scale.setScalar(0.5 + S.organs_lesion);
      matrix.visible = S.organs_rows > 0.02; matrix.scale.set(1, Math.max(0.02, S.organs_rows), 1);
      const pr = D.synth.pairs[Math.round(S.organs_pair) - 1];
      scatter.visible = !!pr;
      if (pr) { for (let i = 0; i < NP; i++) sp.set([K.lerp(pr.xy[4 * i], pr.xy[4 * i + 2], S.organs_partial) * 0.12, K.lerp(pr.xy[4 * i + 1], pr.xy[4 * i + 3], S.organs_partial) * 0.12, 0], 3 * i); sg.attributes.position.needsUpdate = true; }
    },
    anchors: A,
    labels: O.map((o, i) => ({ text: [o.name, ''], at: o.id, alpha: S => (Math.round(S.organs_focus) === i + 1 ? 1 : 0) }))
      .concat([{ text: ['658 scans × 11 organs', ''], at: 'matrix', cls: 'amb', alpha: S => K.prog(S.organs_rows, 0.8, 1) },
        { text: ['partial r', ''], at: 'scatter', cls: 'cyn', alpha: S => (S.organs_pair >= 0.5 ? 1 : 0) }]),
    cam: { default: [0, 4, 3.75, 0, 0, 0], seg: [10, 6, 3.2, 0, 0.2, 0], bars: [-25, 6, 3.3, 0.35, 0.2, 0], matrix: [-35, 22, 3.4, 0.95, 0, 0],
      scatter: [-15, 4, 2.4, 1.0, 0.25, 0.2], net: [12, 6, 3.0, 0, 0.2, 0.3], strength: [5, 2, 2.8, 0, -0.3, 0.3], lesion: [-15, 4, 1.4, -0.09, 0.36, 0.02] },
    controls: [{ key: 'view', label: 'View', options: [['organs', 'Organs'], ['uptake', 'Uptake'], ['matrix', 'Matrix'], ['partial', 'Partial'], ['network', 'Network'], ['strength', 'Strength']] },
      { key: 'net', label: 'Network', options: NETS.map((n, i) => [n, SHORT[i]]) }],
    explore(c) {
      const v = c.view;
      return { organs_seg: 1, organs_suv: v === 'uptake' || v === 'matrix' ? 1 : 0, organs_rows: v === 'matrix' ? 1 : 0, organs_pair: v === 'partial' ? 1 : 0,
        organs_partial: v === 'partial' ? K.smooth((c.t % 8) / 3) : 0, organs_net: v === 'network' || v === 'strength' ? 1 : 0, organs_strength: v === 'strength' ? 1 : 0,
        organs_which: Math.max(0, NETS.indexOf(c.net)) };
    },
    api() {
      return { netIds: NETS, setFocus() {},
        pick(rc) { const hit = rc.intersectObjects(nodes.concat(shells, bars).filter(m => m.visible), false)[0]; return hit ? hit.object.userData.id : null; } };
    },
  });
};
