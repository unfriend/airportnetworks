// Not all at once (chapter 7): links are moments. GRB2 up close (sites_act 0): its real shape (PDB 1GRI, one ball per
// amino acid, PPI_STRUCTS), its three binding domains coloured, an SH3, an SH2 and another SH3, its partners on a shell around it, one dot each (as many as it has
// links, from the data), and partners taking turns at the domains, each drawn as its docking stretch (a short chain of
// amino acids): the SH2 holds a receptor's phosphorylated tyrosine,
// the SH3s a partner's proline-rich stretch (well-known partners from its links: EGFR, ERBB2, MET, KIT and SHC1 at the
// SH2; SOS1, CBL, GAB1 and DNM1 at the SH3s). Then a shuttle (sites_act 1): a patch of the nuclear envelope with its
// pores, the cytosol below and the nucleus above; TP53 goes to and fro (sites_tp: it moves on the time), then STAT3 is
// switched on in the cytosol by a kinase at a receptor (JAK2's kinase, PDB 2B7A), pairs up, goes through a pore and binds
// DNA and a partner (EP300's acetyltransferase domain, PDB 3BIY) in the nucleus (sites_move: 0 the cytosol, 1 the nucleus). sites_cyc counts turns at the domains (keyed at an
// even pace by the story).
SETS.sites = function (K) {
  const { THREE, clamp, v3 } = K;
  const set = K.newSet('sites');
  const cellApi = GL.sets.cell.api(), find = s => cellApi.find(s), symOK = s => find(s) >= 0;
  const solid = (c, e) => K.fade(set, new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: 0.5, metalness: 0.05, emissive: new THREE.Color(...c).multiplyScalar(e || 0.18) }));
  // real structures (PPI_STRUCTS, the Protein Data Bank: molStructure in mol.js), one ball per amino acid or nucleotide
  const structure = (key, width, colOf, only, along) => molStructure(K, set, key, width, colOf, only, along);
  // ------------------------------------------------------------ GRB2 and its partners
  const gA = new THREE.Group(); set.group.add(gA);
  // (its domains: SH3 cyan, SH2 amber, the linkers grey; the first SH3 on the left)
  const DCOL = [[0.45, 0.8, 1.0], [1.0, 0.75, 0.35], [0.45, 0.8, 1.0]];
  const G2 = structure('grb2', 0.42, (p, d) => (d >= 0 ? DCOL[d] : [0.7, 0.75, 0.85]));
  const g2 = G2.parts['GRB2/A'];
  // (each domain's centre and reach, in the structure's frame; turned half round about y if the first SH3 is on the right)
  const domPts = [0, 1, 2].map(d => g2.pts.filter((p, i) => g2.dom[i] === d));
  const domC = domPts.map(ps => v3.add(g2.home, ps.reduce((c, p) => v3.add(c, v3.mul(p, 1 / ps.length)), [0, 0, 0])));
  const domR = domPts.map((ps, d) => Math.max(...ps.map(p => v3.len(v3.sub(v3.add(g2.home, p), domC[d])))));
  const flip = domC[0][0] > domC[2][0], turn = p => (flip ? [-p[0], p[1], -p[2]] : p);
  if (flip) G2.g.rotation.y = Math.PI;
  gA.add(G2.g);
  const DOM = [0, 1, 2].map(d => ({ name: d === 1 ? 'SH2' : 'SH3', p: turn(domC[d]), r: domR[d] }));
  const grb = find('GRB2'), nGrb = cellApi.deg(grb);
  const shell = K.pointsGeo(nGrb), rs = K.rng(3);
  for (let i = 0; i < nGrb; i++) {
    const u = K.unit(rs), d = 0.85 + 0.25 * rs();
    shell.attributes.position.array.set([u[0] * d * 1.3, u[1] * d * 0.9, u[2] * d], 3 * i);
    shell.attributes.aCol.array.set([0.55, 0.7, 1.0], 3 * i); shell.attributes.aSize.array[i] = 0.018; shell.attributes.aA.array[i] = 0.55;
  }
  gA.add(new THREE.Points(shell, K.points(set)));
  // the slots: where a partner docks at each domain; who comes to each, in turn (only partners in GRB2's links)
  const SLOT = DOM.map((d, k) => v3.add(d.p, [0, (k === 1 ? -1 : 1) * (d.r * 0.8 + 0.05), 0.03]));
  const WHO = [['SOS1', 'CBL', 'DNM1'], ['EGFR', 'SHC1', 'ERBB2', 'MET', 'KIT'], ['GAB1', 'SOS1', 'CBL']].map(l => l.filter(symOK));
  // a partner is drawn as its docking stretch only: a short chain of amino acids (as big as GRB2's own balls, 3.8
  // angstroms apart) in a gentle curve across the domain; at the SH2 a stretch round a phosphotyrosine (that one bright),
  // at an SH3 a proline-rich stretch (its prolines darker)
  const CH_N = 9, aa = G2.s, chainGeo = new THREE.IcosahedronGeometry(1, 1);
  const visitors = SLOT.map((p, k) => {
    const c = k === 1 ? [0.3, 1.0, 0.6] : [1.0, 0.55, 0.85], dir = v3.norm(k === 1 ? [1, 0, 0.35] : [k === 0 ? 0.55 : -0.55, 0.1, 0.8]);
    const im = new THREE.InstancedMesh(chainGeo, K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05, emissive: new THREE.Color(...c).multiplyScalar(0.25) })), CH_N);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), col = new THREE.Color(), rr = 2.4 * aa;
    for (let i = 0; i < CH_N; i++) {
      const u = i - (CH_N - 1) / 2, bow = (k === 1 ? 1 : -1) * 0.06 * u * u * 3.8 * aa;   // (bowed toward the domain at its ends)
      M.compose(new THREE.Vector3(...v3.add(v3.mul(dir, u * 3.8 * aa), [0, bow, 0])), Q, new THREE.Vector3(rr, rr, rr)); im.setMatrixAt(i, M);
      const hi = k === 1 ? i === 3 : i % 3 !== 1;   // (the phosphotyrosine; the prolines, P-x-x-P)
      im.setColorAt(i, col.setRGB(...(k === 1 ? (hi ? [1.0, 1.0, 0.7] : c) : hi ? c.map(x => x * 0.7) : c)));
    }
    const g = new THREE.Group(); g.add(im); gA.add(g); return g;
  });
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
  // TP53's core domain (PDB 1TSR, the protein: its DNA does not travel) and the STAT3 pair with its DNA (PDB 1BG1), as
  // balls per amino acid, not to scale against the pores
  const T5 = structure('tp53', 0.12, () => [1.0, 0.45, 0.85], ['TP53/B']);
  const tp = new THREE.Group(); tp.add(T5.g); T5.g.position.set(...v3.mul(T5.parts['TP53/B'].home, -1)); gB.add(tp);
  const S3 = structure('stat3', 0.19, (p, d) => (p.kind === 'dna' ? [0.75, 0.78, 0.88] : d === 0 ? [1.0, 0.85, 0.4] : p.chain === 'A' ? [0.3, 0.9, 1.0] : [0.5, 0.75, 1.0]), null, 'DNA');
  const sA = S3.parts['STAT3/A'], sB = S3.parts['STAT3/A-2'], sD = [S3.parts['DNA/B'], S3.parts['DNA/B-2']];
  const st1 = sA.g, st2 = sB.g, pairMid = v3.mul(v3.add(sA.home, sB.home), 0.5);
  S3.g.position.set(...v3.mul(pairMid, -1));
  const st = new THREE.Group(); st.add(S3.g); gB.add(st);
  // JAK2's kinase domain (PDB 2B7A) and p300's acetyltransferase domain (PDB 3BIY), one ball per amino acid, small and not
  // to scale against the pores
  const jak = molStructure(K, set, 'jak2', 0.09, () => [1.0, 0.8, 0.35], null, null, 0).g; jak.position.set(-0.45, -0.45, 0.05); gB.add(jak);
  const recB = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8), solid([0.9, 0.85, 0.5])); recB.position.set(-0.52, -0.52, 0.02); gB.add(recB);
  const ep = molStructure(K, set, 'p300', 0.1, () => [0.66, 0.54, 1.0], null, null, 0).g; ep.position.set(0.42, 0.56, 0.06); gB.add(ep);
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
      st.visible = jak.visible = recB.visible = ep.visible = show3;
      const base = mv < 0.3 ? v3.lerp([-0.15, -0.3, 0.1], [-0.4, -0.42, 0.08], K.smooth(mv / 0.15)) : path(w, 0);
      st.position.set(...base);
      // (the two apart until they pair: the second comes in from the side; the DNA shows once they are in the nucleus)
      st1.position.set(...v3.add(sA.home, [0, 0, 0]));
      st2.position.set(...v3.add(sB.home, [0.16 * (1 - pair), 0.07 * (1 - pair), 0]));
      st2.visible = show3 && pair > 0.02;
      const dn = K.smooth(clamp((mv - 0.88) / 0.1, 0, 1));
      for (const d of sD) { d.g.visible = dn > 0.01; d.g.scale.setScalar(Math.max(0.01, dn)); }
    },
    anchors: { grb2: [0, 0.26, 0], sh2: v3.add(DOM[1].p, [0, DOM[1].r + 0.03, 0.05]), sh3a: v3.add(DOM[0].p, [-0.05, DOM[0].r + 0.02, 0]), sh3b: v3.add(DOM[2].p, [0.05, DOM[2].r + 0.02, 0]), shell: [0.95, 0.7, 0.3],
      slot0: () => v3.add(visitors[0].position.toArray(), [0, 0.07, 0]), slot1: () => v3.add(visitors[1].position.toArray(), [0, -0.08, 0]), slot2: () => v3.add(visitors[2].position.toArray(), [0, 0.07, 0]),
      tp53: () => v3.add(tp.position.toArray(), [0, 0.1, 0]), stat3: () => v3.add(st.position.toArray(), [0, 0.12, 0]), jak2: [-0.45, -0.52, 0.05], ep300: [0.42, 0.64, 0.06],
      pore: [PORES[0][0], PORES[0][1] + 0.05, PORES[0][2]], cytosol: [0.5, -0.25, 0], nucleus: [-0.4, 0.3, -0.1] },
    labels: [0, 1, 2].map(k => ({ text: () => [now[k], k === 1 ? 'at the SH2' : 'at an SH3'], at: 'slot' + k, cls: k === 1 ? 'grn' : 'mag', alpha: () => (act < 0.3 ? nowA[k] : 0) })),
    cam: { default: [12, 10, 2.2, 0, 0, 0], close: [16, 12, 1.1, 0, 0, 0], shuttle: [10, 16, 2.3, 0.05, 0.02, 0] },
    stats: () => ({ grb2: nGrb, who: WHO, balls: [G2, T5, S3].map(o => Object.values(o.parts).reduce((t, p) => t + p.n, 0)) }),
  });
};
