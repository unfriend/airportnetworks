// STUB for engine tests only (MICRO_STUBS=1 node tools/micro/build.mjs), until tools/micro/sets/hier.js exists:
// the four-level network of organ architecture as rings, and one organ's domain contacts, with the spec's params,
// anchors, labels, cam views, controls, explore(c) and api().
SETS.hier = function (K) {
  const { THREE, prog } = K, set = K.newSet('hier');
  const G = MICRO_DATA.graph, N = G.nodes, LC = ['#1f8a4c', '#7ccf7e', '#ef8f7a', '#5aa9ff'], Y = [0.75, 0.25, -0.25, -0.75], RD = [0.9, 1.0, 0.55, 1.1];
  const cnt = [0, 0, 0, 0], at = [0, 0, 0, 0];
  N.forEach(n => cnt[n[1]]++);
  const P = N.map(n => { const l = n[1], a = (at[l]++ + 0.5) / cnt[l] * 6.283; return [RD[l] * Math.sin(a), Y[l], RD[l] * Math.cos(a)]; });
  const adj = N.map(() => []);
  for (const [a, b] of G.edges) if (a !== b) { adj[a].push(b); adj[b].push(a); }
  const pg = K.pointsGeo(N.length), pp = pg.attributes.position.array, pc = pg.attributes.aCol.array, ps = pg.attributes.aSize.array, pa = pg.attributes.aA.array;
  N.forEach((n, i) => { pp.set(P[i], 3 * i); pc.set(K.rgb(LC[n[1]]), 3 * i); ps[i] = n[1] === 3 ? 0.04 : 0.07; });
  const pts = new THREE.Points(pg, K.points(set)); set.group.add(pts);
  const E = G.edges.filter(([a, b]) => a !== b), lg = K.linesGeo(E.length), lp = lg.attributes.position.array, lc = lg.attributes.aCol.array, lt = lg.attributes.aT.array, la = lg.attributes.aA.array;
  E.forEach(([a, b], k) => { lp.set(P[a].concat(P[b]), 6 * k); lc.set([0.5, 0.6, 0.7, 0.5, 0.6, 0.7], 6 * k); lt[2 * k] = lt[2 * k + 1] = Math.max(N[a][1], N[b][1]) / 3; la[2 * k] = la[2 * k + 1] = 0.4; });
  const lines = new THREE.LineSegments(lg, K.lines(set)); set.group.add(lines);
  // contacts: a ring of domains with bands
  const CO = ['Colon', 'Skin', 'Ovary', 'Fallopian Tube', 'Uterus', 'Coronary artery'];
  const cg = K.pointsGeo(8), cpp = cg.attributes.position.array, ccc = cg.attributes.aCol.array, css = cg.attributes.aSize.array;
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; cpp.set([0.6 * Math.sin(a), 0.6 * Math.cos(a), 0], 3 * i); ccc.set(K.rgb(LC[3]), 3 * i); css[i] = 0.1; }
  const cpts = new THREE.Points(cg, K.points(set)); set.group.add(cpts);
  let focus = -1, lastF = -2;
  const lit = new Set();
  const anchors = { top: [0, 0.85, 0], bottom: [0, -0.85, 0], focus: () => (focus >= 0 ? P[focus] : [0, 0, 0]), contacts: [0, 0.7, 0], change: [0.42, 0.42, 0] };
  return Object.assign(set, {
    params: { hier_a: 1, hier_grow: 0, hier_focus: -1, hier_contacts: 0, hier_organ: 0, hier_age: 0 },
    update(S) {
      const net = 1 - S.hier_contacts;
      pts.visible = lines.visible = net > 0.01;
      pts.material.uniforms.uA.value = lines.material.uniforms.uA.value = net * S.hier_a;
      lines.material.uniforms.uReveal.value = S.hier_grow * 1.02;
      focus = Math.round(S.hier_focus);
      if (focus !== lastF) {
        lastF = focus; lit.clear();
        if (focus >= 0 && focus < N.length) { lit.add(focus); const up = (i, d) => { for (const j of adj[i]) if (!lit.has(j) && Math.sign(N[j][1] - N[i][1]) === d) { lit.add(j); up(j, d); } }; up(focus, 1); up(focus, -1); }
        N.forEach((n, i) => { pa[i] = focus < 0 || lit.has(i) ? 1 : 0.15; });
        pg.attributes.aA.needsUpdate = true;
      }
      for (let i = 0; i < N.length; i++) pp[3 * i + 1] = Y[N[i][1]] + (S.hier_grow * 4 > N[i][1] ? 0 : 5);
      pg.attributes.position.needsUpdate = true;
      cpts.visible = S.hier_contacts > 0.01; cpts.material.uniforms.uA.value = S.hier_contacts * S.hier_a;
    },
    anchors,
    labels: [
      { text: ['Organs', ''], at: 'top', cls: 'grn', alpha: S => prog(S.hier_grow, 0.1, 0.3) * (1 - S.hier_contacts) },
      { text: ['Domains', ''], at: 'bottom', cls: 'cyn', alpha: S => prog(S.hier_grow, 0.8, 1) * (1 - S.hier_contacts) },
      { text: ['The core stays', ''], at: 'contacts', alpha: S => prog(S.hier_contacts, 0.6, 1) },
      { text: ['Muscularis – submucosa', 'fewer contacts'], at: 'change', cls: 'cyn', alpha: S => prog(S.hier_age, 0.2, 0.6) * prog(S.hier_contacts, 0.6, 1) },
    ],
    cam: { default: [0, 14, 4.2, 0, 0, 0], net: [0, 14, 4.2, 0, 0, 0], contacts: [0, 6, 2.4, 0, 0, 0] },
    controls: [
      { key: 'view', label: 'View', options: [['net', 'Network'], ['contacts', 'Contacts']] },
      { key: 'organ', label: 'Organ', options: CO.map((o, i) => [String(i), o]), when: v => v.view === 'contacts' },
      { key: 'age', label: 'Age', options: [['20', '20'], ['70', '70']], when: v => v.view === 'contacts' },
    ],
    explore(c) { const ct = c.view === 'contacts'; return { hier_grow: 1, hier_contacts: ct ? 1 : 0, hier_organ: +c.organ || 0, hier_age: c.age === '70' ? 1 : 0 }; },
    api: () => ({
      nodes: N.map(n => ({ name: n[0], level: n[1] })), contactOrgans: CO.slice(),
      pick(rc) {
        let best = -1, bd = 0.05;
        const v = new THREE.Vector3();
        N.forEach((n, i) => { v.set(...P[i]).applyMatrix4(pts.matrixWorld); const d = rc.ray.distanceToPoint(v); if (d < bd) { bd = d; best = i; } });
        return best;
      },
    }),
  });
};
