// Not all at once (chapter 7): links are moments. GRB2 up close (sites_act 0): its three binding domains in a row, an
// SH3, an SH2 and another SH3 (illustrative shapes), its partners on a shell around it, one dot each (as many as it has
// links, from the data), and partners taking turns at the domains: the SH2 holds a receptor's phosphorylated tyrosine,
// the SH3s a partner's proline-rich stretch (well-known partners from its links: EGFR, ERBB2, MET, KIT and SHC1 at the
// SH2; SOS1, CBL, GAB1 and DNM1 at the SH3s). Then a shuttle (sites_act 1): a patch of the nuclear envelope with its
// pores, the cytosol below and the nucleus above; TP53 goes to and fro (sites_tp: it moves on the time), then STAT3 is
// switched on in the cytosol by a kinase at a receptor (JAK2), pairs up, goes through a pore and binds DNA and a partner
// (EP300) in the nucleus (sites_move: 0 the cytosol, 1 the nucleus). sites_cyc counts turns at the domains (keyed at an
// even pace by the story).
SETS.sites = function (K) {
  const { THREE, clamp, v3 } = K;
  const set = K.newSet('sites');
  const cellApi = GL.sets.cell.api(), find = s => cellApi.find(s), symOK = s => find(s) >= 0;
  const solid = (c, e) => K.fade(set, new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: 0.5, metalness: 0.05, emissive: new THREE.Color(...c).multiplyScalar(e || 0.18) }));
  const blob = (r, c, e) => new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), solid(c, e));
  // ------------------------------------------------------------ GRB2 and its partners
  const gA = new THREE.Group(); set.group.add(gA);
  const DOM = [{ name: 'SH3', p: [-0.2, 0, 0], r: 0.065 }, { name: 'SH2', p: [0, 0.02, 0], r: 0.085 }, { name: 'SH3', p: [0.2, 0, 0], r: 0.065 }];
  const domMat = [solid([0.45, 0.8, 1.0]), solid([1.0, 0.75, 0.35]), solid([0.45, 0.8, 1.0])];
  DOM.forEach((d, i) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(d.r, 2), domMat[i]); m.position.set(...d.p); gA.add(m); });
  gA.add(new THREE.Mesh(K.tube([DOM[0].p, [-0.1, -0.03, 0.02], DOM[1].p, [0.1, -0.03, 0.02], DOM[2].p], 0.012, 24, 6), solid([0.7, 0.75, 0.85])));
  const grb = find('GRB2'), nGrb = cellApi.deg(grb);
  const shell = K.pointsGeo(nGrb), rs = K.rng(3);
  for (let i = 0; i < nGrb; i++) {
    const u = K.unit(rs), d = 0.85 + 0.25 * rs();
    shell.attributes.position.array.set([u[0] * d * 1.3, u[1] * d * 0.9, u[2] * d], 3 * i);
    shell.attributes.aCol.array.set([0.55, 0.7, 1.0], 3 * i); shell.attributes.aSize.array[i] = 0.018; shell.attributes.aA.array[i] = 0.55;
  }
  gA.add(new THREE.Points(shell, K.points(set)));
  // the slots: where a partner docks at each domain; who comes to each, in turn (only partners in GRB2's links)
  const SLOT = [[-0.2, 0.13, 0.03], [0, -0.15, 0.04], [0.2, 0.13, 0.03]];
  const WHO = [['SOS1', 'CBL', 'DNM1'], ['EGFR', 'SHC1', 'ERBB2', 'MET', 'KIT'], ['GAB1', 'SOS1', 'CBL']].map(l => l.filter(symOK));
  const visitors = SLOT.map((p, k) => { const m = blob(k === 1 ? 0.06 : 0.05, k === 1 ? [0.3, 1.0, 0.6] : [1.0, 0.55, 0.85], 0.3); gA.add(m); return m; });
  const FROM = SLOT.map(p => v3.mul(v3.norm(p), 0.85));
  const now = ['', '', ''], nowA = [0, 0, 0];
  // ------------------------------------------------------------ the shuttle: a patch of the nuclear envelope
  const gB = new THREE.Group(); set.group.add(gB);
  const RW = 3, wallY = x => -RW + Math.sqrt(RW * RW - x * x);
  for (const dy of [0, -0.035]) {
    const g = new THREE.SphereGeometry(RW, 64, 10, 0, Math.PI * 2, 0, 0.3); g.translate(0, -RW + dy, 0);
    const m = new THREE.Mesh(g, K.fade(set, new THREE.MeshBasicMaterial({ color: 0xa48cff, side: THREE.DoubleSide, depthWrite: false }), 0.16));
    gB.add(m);
  }
  // (a faint dome of the nucleoplasm's colour over the envelope: the nucleus side at a glance)
  { const d = new THREE.Mesh(new THREE.SphereGeometry(0.72, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), K.rim(set, { color: cellApi.placeCol[1], a0: 0.035, a1: 0.2 }));
    d.scale.set(1, 0.75, 0.4); d.position.set(0.05, -0.02, -0.12); d.renderOrder = 2; gB.add(d); }
  const PORES = [-0.5, 0.05, 0.6].map((x, i) => [x, wallY(x) - 0.017, i === 1 ? 0.1 : -0.15]);
  PORES.forEach(p => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 24), solid([0.8, 0.65, 1.0])); t.rotation.x = Math.PI / 2; t.position.set(...p); gB.add(t); });
  const dnaB = new THREE.Mesh(K.tube([[-0.2, 0.42, -0.1], [0.1, 0.46, 0], [0.35, 0.44, 0.05], [0.6, 0.47, 0]], 0.012, 30, 6), solid([0.6, 0.65, 0.8])); gB.add(dnaB);
  const tp = blob(0.05, [1.0, 0.45, 0.85], 0.3); gB.add(tp);
  const st1 = blob(0.045, [0.3, 0.9, 1.0], 0.3), st2 = blob(0.045, [0.3, 0.9, 1.0], 0.3); gB.add(st1, st2);
  const jak = blob(0.04, [1.0, 0.8, 0.35]); jak.position.set(-0.45, -0.45, 0.05); gB.add(jak);
  const recB = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8), solid([0.9, 0.85, 0.5])); recB.position.set(-0.52, -0.52, 0.02); gB.add(recB);
  const ep = blob(0.05, [0.66, 0.54, 1.0]); ep.position.set(0.42, 0.56, 0.06); gB.add(ep);
  const P_CYT = [-0.38, -0.4, 0.08], P_IN = [0.35, 0.48, 0.05];
  const path = (u, pore) => {   // (from the cytosol through a pore into the nucleus)
    const a = P_CYT, b = PORES[pore], c = P_IN;
    return u < 0.5 ? v3.lerp(a, [b[0], b[1] - 0.1, b[2]], K.smooth(u * 2)) : v3.lerp([b[0], b[1] + 0.1, b[2]], c, K.smooth(u * 2 - 1));
  };
  let act = 0, mv = 0;
  return Object.assign(set, {
    // sites_act: 0 GRB2, 1 the shuttle (TP53, then STAT3); sites_cyc: turns at GRB2's domains; sites_tp: TP53 on show
    // (going to and fro); sites_move: STAT3's way, 0 resting in the cytosol to 1 bound in the nucleus
    params: { sites_a: 1, sites_act: 0, sites_cyc: 0, sites_tp: 0, sites_move: 0 },
    update(S, t) {
      act = clamp(S.sites_act, 0, 1);
      const aA = 1 - K.smooth(clamp(act * 2, 0, 1)), aB = K.smooth(clamp(act * 2 - 1, 0, 1));
      gA.visible = aA > 0.01; gB.visible = aB > 0.01;
      gA.scale.setScalar(Math.max(0.01, aA)); gB.scale.setScalar(Math.max(0.01, aB));
      // partners at the domains: each slot's turn is a third out of step with the next; in a turn a partner comes, stays, goes
      const cyc = Math.max(0, S.sites_cyc);
      SLOT.forEach((p, k) => {
        const c = cyc + k / 3, n = Math.floor(c), f = c - n, list = WHO[k];
        const s = f < 0.25 ? K.smooth(f / 0.25) : f < 0.75 ? 1 : 1 - K.smooth((f - 0.75) / 0.25);
        visitors[k].position.set(...v3.lerp(FROM[k], p, s));
        visitors[k].visible = cyc > 0 && list.length > 0;
        now[k] = list.length ? list[n % list.length] : ''; nowA[k] = cyc > 0 ? s : 0;
      });
      // TP53: to and fro through the middle pore, a loop of 8 s
      const ta = clamp(S.sites_tp, 0, 1), x = (t / 8) % 1, u = x < 0.5 ? x * 2 : 2 - x * 2;
      tp.visible = ta > 0.01; tp.scale.setScalar(Math.max(0.01, ta)); tp.position.set(...path(u, 1));
      // STAT3: switched on beside the kinase, the two copies pair up, through the left pore, onto the DNA
      mv = clamp(S.sites_move, 0, 1);
      const show3 = mv > 0.001, w = clamp((mv - 0.3) / 0.6, 0, 1), pair = K.smooth(clamp((mv - 0.15) / 0.15, 0, 1));
      st1.visible = st2.visible = jak.visible = recB.visible = ep.visible = show3;
      const base = mv < 0.3 ? v3.lerp([-0.15, -0.3, 0.1], [-0.4, -0.42, 0.08], K.smooth(mv / 0.15)) : path(w, 0);
      st1.position.set(base[0] - 0.045 * pair, base[1], base[2]);
      st2.position.set(base[0] + 0.045 * pair + 0.12 * (1 - pair), base[1] + 0.05 * (1 - pair), base[2]);
      st2.visible = show3 && pair > 0.02;
    },
    anchors: { grb2: [0, 0.22, 0], sh2: [0, 0.14, 0.05], sh3a: [-0.27, 0.08, 0], sh3b: [0.27, 0.08, 0], shell: [0.95, 0.7, 0.3],
      slot0: () => v3.add(visitors[0].position.toArray(), [0, 0.07, 0]), slot1: () => v3.add(visitors[1].position.toArray(), [0, -0.08, 0]), slot2: () => v3.add(visitors[2].position.toArray(), [0, 0.07, 0]),
      tp53: () => v3.add(tp.position.toArray(), [0, 0.08, 0]), stat3: () => v3.add(st1.position.toArray(), [0, 0.08, 0]), jak2: [-0.45, -0.52, 0.05], ep300: [0.42, 0.64, 0.06],
      pore: [PORES[0][0], PORES[0][1] + 0.05, PORES[0][2]], cytosol: [0.5, -0.25, 0], nucleus: [-0.4, 0.3, -0.1] },
    labels: [0, 1, 2].map(k => ({ text: () => [now[k], k === 1 ? 'at the SH2' : 'at an SH3'], at: 'slot' + k, cls: k === 1 ? 'grn' : 'mag', alpha: () => (act < 0.3 ? nowA[k] : 0) })),
    cam: { default: [12, 10, 2.2, 0, 0, 0], close: [16, 12, 1.1, 0, 0, 0], shuttle: [10, 16, 2.3, 0.05, 0.02, 0] },
    stats: () => ({ grb2: nGrb, who: WHO }),
  });
};
