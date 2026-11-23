// Not all at once (chapter 7): links are moments. GRB2 up close (sites_act 0): its real shape (PDB 1GRI, its molecular
// surface: models.js), its three binding domains coloured (the one a partner docks at lit while it is there), an SH3, an SH2 and another SH3, its partners on a shell around it, one dot each (as many as it has
// links, from the data), and partners taking turns at the domains, each shown by the part that binds: its docking
// stretch, a short chain of amino acids lying on the lit domain (the owner, 23 November 2026: the stretches are the real
// binders, so no surfaces of the partners' other parts): the SH2 holds a receptor's phosphorylated tyrosine,
// the SH3s a partner's proline-rich stretch (well-known partners from its links: EGFR, ERBB2, MET, KIT and SHC1 at the
// SH2; SOS1, CBL and DNM1 at the SH3s). Then a shuttle (sites_act 1): the nucleus, a ball with three pores in its
// envelope, the cytosol outside and below; TP53 goes to and fro (sites_tp: it moves on the time), then STAT3 is
// switched on in the cytosol by a kinase at a receptor (JAK2's kinase, PDB 2B7A), pairs up, goes through a pore and binds
// DNA and a partner (EP300's acetyltransferase domain, PDB 3BIY) in the nucleus, all as surfaces (sites_move: 0 the cytosol, 1 the nucleus). sites_cyc counts turns at the domains (keyed at an
// even pace by the story).
SETS.sites = function (K) {
  const { THREE, clamp, v3 } = K;
  const set = K.newSet('sites');
  const cellApi = GL.sets.cell.api(), find = s => cellApi.find(s), symOK = s => find(s) >= 0;
  const solid = (c, e) => K.fade(set, new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: 0.5, metalness: 0.05, emissive: new THREE.Color(...c).multiplyScalar(e || 0.18) }));
  // ------------------------------------------------------------ GRB2 and its partners
  const gA = new THREE.Group(); set.group.add(gA);
  // (its domains coloured in models.json: SH3 cyan, SH2 amber, the linkers grey; the first SH3 on the left)
  const G2 = molMesh(set, 'grb2', { width: 0.42, lod: 0 }), RANGES = [[1, 58], [60, 152], [156, 217]];
  // (each domain's centre and reach from its residues' anchors, in the model's frame; turned half round about y if the
  // first SH3 is on the right)
  const domPts = RANGES.map(([a, b]) => { const R = G2.res, out = []; if (R) for (let i = 0; i < R.n; i++) if (R.num[i] >= a && R.num[i] <= b) out.push(G2.anchor('A', R.num[i]).toArray()); return out; });
  const domC = domPts.map((ps, d) => (ps.length ? ps.reduce((c, p) => v3.add(c, v3.mul(p, 1 / ps.length)), [0, 0, 0]) : [(d - 1) * 0.13, 0, 0]));
  const domR = domPts.map((ps, d) => (ps.length ? Math.max(...ps.map(p => v3.len(v3.sub(p, domC[d])))) : 0.06));
  const flip = domC[0][0] > domC[2][0], turn = p => (flip ? [-p[0], p[1], -p[2]] : p);
  if (flip) G2.group.rotation.y = Math.PI;
  gA.add(G2.group);
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
  // (each slot on its domain's outer face, along OUT, the three apart: the first SH3 up, the SH2 down and left, the
  // second SH3 right; as far out as the domain's residues reach that way and a residue more)
  const OUT = [[-0.2, 1, 0.3], [-0.7, -0.8, 0.3], [1, -0.25, 0.3]].map(v3.norm);
  const SLOT = DOM.map((d, k) => { const ps = domPts[k].map(turn), far = ps.length ? Math.max(...ps.map(p => v3.dot(v3.sub(p, d.p), OUT[k]))) : d.r * 0.8; return v3.add(d.p, v3.mul(OUT[k], far + 4 * (G2.ok ? G2.s : 0.0064))); });
  // (only partners in GRB2's links in this map)
  const WHO = [['SOS1', 'CBL', 'DNM1'], ['EGFR', 'SHC1', 'ERBB2', 'MET', 'KIT'], ['DNM1', 'SOS1', 'CBL']].map(l => l.filter(symOK));
  // a partner is drawn as its docking stretch, where it touches the domain: a short chain of amino acids (smooth beads a
  // little larger than a residue's reach, 3.8 angstroms apart, so they run together) in a gentle curve across the domain,
  // bowed to follow its face; at the SH2 a stretch round a phosphotyrosine (that one bright), at an SH3 a proline-rich
  // stretch (its prolines darker)
  const CH_N = 9, aa = G2.ok ? G2.s : 0.42 / 66, chainGeo = new THREE.SphereGeometry(1, 14, 10);
  const visitors = SLOT.map((p, k) => {
    const c = k === 1 ? [0.3, 1.0, 0.6] : [1.0, 0.55, 0.85], dir = v3.norm(v3.cross(OUT[k], [0.3, 0.2, 1]));   // (across the face)
    const im = new THREE.InstancedMesh(chainGeo, K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05, emissive: new THREE.Color(...c).multiplyScalar(0.25) })), CH_N);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), col = new THREE.Color(), rr = 2.5 * aa;
    for (let i = 0; i < CH_N; i++) {
      const u = i - (CH_N - 1) / 2, bow = -0.06 * u * u * 3.8 * aa;   // (bowed toward the domain at its ends)
      M.compose(new THREE.Vector3(...v3.add(v3.mul(dir, u * 3.8 * aa), v3.mul(OUT[k], bow))), Q, new THREE.Vector3(rr, rr, rr)); im.setMatrixAt(i, M);
      const hi = k === 1 ? i === 3 : i % 3 !== 1;   // (the phosphotyrosine; the prolines, P-x-x-P)
      im.setColorAt(i, col.setRGB(...(k === 1 ? (hi ? [1.0, 1.0, 0.7] : c) : hi ? c.map(x => x * 0.7) : c)));
    }
    const g = new THREE.Group(); g.add(im); gA.add(g);
    return g;
  });
  const FROM = SLOT.map((p, k) => v3.add(p, v3.mul(OUT[k], 0.6)));   // (where a partner comes from, and goes back to)
  const now = ['', '', ''], nowA = [0, 0, 0], HIC = ['#ff8cd9', '#4dff99', '#ff8cd9'];   // (the domain lit in its partners' colour)
  // ------------------------------------------------------------ the shuttle: the nucleus, a ball with three pores
  // (the owner, 23 November 2026: the nucleus round, the pores set into its envelope): the envelope's two membranes as
  // glassy spheres (their rims glow), each with a round hole at every pore (cut in the shader: no triangles spent), the
  // pore's ring lying in the envelope round the hole, facing out; the cytosol outside and below, DNA and EP300 inside
  const gB = new THREE.Group(); set.group.add(gB);
  const NC = [0.12, 0.62, -0.1], RN = 0.75, HOLE = 0.205;
  // (the pores on the lower front, where the view looks: 28 degrees under the equator, 55 degrees apart round it (the middle one facing the view), so their
  // rings, each 0.22 across its middle, stay well apart)
  const PDIR = [-45, 10, 65].map(az => { const a = az * Math.PI / 180, e = -28 * Math.PI / 180; return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]; });
  for (const [r, a0, a1] of [[RN, 0.025, 0.34], [RN - 0.035, 0.015, 0.2]]) {
    const m = K.rim(set, { color: [0.64, 0.55, 1.0], a0, a1 });
    m.uniforms.uPd = { value: PDIR.map(d => new THREE.Vector3(...d)) }; m.uniforms.uCos = { value: Math.cos(Math.asin(HOLE / r)) };
    m.vertexShader = m.vertexShader.replace('varying vec3 vN, vW;', 'varying vec3 vN, vW, vO;').replace('vN = ', 'vO = position; vN = ');
    m.fragmentShader = m.fragmentShader.replace('uniform vec3 uC;', 'uniform vec3 uC; uniform vec3 uPd[3]; uniform float uCos; varying vec3 vO;')
      .replace('void main() {', 'void main() {\n  vec3 o = normalize(vO);\n  for (int i = 0; i < 3; i++) if (dot(o, uPd[i]) > uCos) discard;');
    const g = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), m); g.position.set(...NC); g.renderOrder = 2; gB.add(g);
  }
  // (the pores wide enough for the STAT3 pair and TP53 to pass clear of the ring: an opening 0.39 across, the pair at
  // most about 0.28 across its way; a real pore's channel is about 40 nm, a protein 5 to 15)
  const PORES = PDIR.map(d => v3.add(NC, v3.mul(d, RN - 0.0175)));
  PORES.forEach((p, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 10, 48), solid([0.8, 0.65, 1.0])); t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...PDIR[i])); t.position.set(...p); gB.add(t); });
  const dnaB = new THREE.Mesh(K.tube([[-0.2, 0.42, -0.1], [0.1, 0.46, 0], [0.35, 0.44, 0.05], [0.6, 0.47, 0]], 0.012, 30, 6), solid([0.6, 0.65, 0.8])); gB.add(dnaB);
  // TP53's core domain (PDB 1TSR, the protein: its DNA does not travel) and the STAT3 pair with its DNA (PDB 1BG1: three
  // models cut from the entry's assembly in its own coordinates, so they line up), as surfaces at their finest level
  // (only a few models on show), not to scale against the pores
  const T5 = molMesh(set, 'tp53', { width: 0.12, lod: 0 });
  const tp = new THREE.Group(); tp.add(T5.group); gB.add(tp);
  // (one scale for the three: the whole 0.15 long along the DNA's axis (the pair then about 0.37 tall, 0.14 by 0.28 across); turned so that axis lies along x; the pair's
  // middle at st's origin)
  const dAx = molAxis(molPts('stat3dna')), all3 = [...molPts('stat3a'), ...molPts('stat3b'), ...molPts('stat3dna')];
  const along = p => p[0] * dAx.dir[0] + p[1] * dAx.dir[1] + p[2] * dAx.dir[2];
  const span3 = all3.length ? Math.max(...all3.map(along)) - Math.min(...all3.map(along)) : 160, SS = 0.15 / span3;
  const cen = n => (molHead(n) ? molHead(n).centre.map(x => x * SS) : [0, 0, 0]);
  const sA = molMesh(set, 'stat3a', { scale: SS, centred: false, lod: 0 }), sB = molMesh(set, 'stat3b', { scale: SS, centred: false, lod: 0 });
  const sD = molMesh(set, 'stat3dna', { scale: SS, lod: 0 }), dnaW = new THREE.Group();   // (the DNA centred, so it grows from its middle)
  dnaW.position.set(...cen('stat3dna')); dnaW.add(sD.group);
  const st1 = sA.group, st2 = sB.group, pairMid = v3.mul(v3.add(cen('stat3a'), cen('stat3b')), 0.5);
  const S3 = new THREE.Group(), S3i = new THREE.Group();
  S3.quaternion.setFromUnitVectors(new THREE.Vector3(...dAx.dir), new THREE.Vector3(1, 0, 0));
  S3i.position.set(...v3.mul(pairMid, -1)); S3i.add(st1, st2, dnaW); S3.add(S3i);
  const slide = new THREE.Vector3(0.16, 0.07, 0).applyQuaternion(S3.quaternion.clone().invert());   // (the second's way in, seen turned)
  const st = new THREE.Group(); st.add(S3); gB.add(st);
  // JAK2's kinase domain (PDB 2B7A) and p300's acetyltransferase domain (PDB 3BIY), surfaces, small and not to scale
  // against the pores
  // (each way starts out in the cytosol on its pore's axis, so it comes straight in, clear of the ring; STAT3's rests
  // beside its start, by the kinase)
  const OUTS = PORES.map((b, i) => v3.add(b, v3.mul(PDIR[i], 0.5))), REST = v3.add(OUTS[1], [-0.26, -0.04, -0.05]), JAK = v3.add(OUTS[1], [-0.5, -0.1, -0.08]);
  const jak = molMesh(set, 'jak2', { width: 0.09, lod: 0 }).group; jak.position.set(...JAK); gB.add(jak);
  const recB = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8), solid([0.9, 0.85, 0.5])); recB.position.set(...v3.add(JAK, [-0.07, -0.07, -0.03])); gB.add(recB);
  const ep = molMesh(set, 'p300', { width: 0.1, lod: 0 }).group; ep.position.set(0.42, 0.56, 0.06); gB.add(ep);
  const P_CYT = OUTS[1], P_IN = [0.35, 0.48, 0.05];
  // the way from the cytosol through a pore into the nucleus: one smooth curve, straight along the pore's axis for the
  // pair's height either side (so nothing clips the ring), walked at an even pace (u 0 to 1: along it by length)
  const WAY = PORES.map((b, i) => { const d = PDIR[i], at = s => v3.add(b, v3.mul(d, s)); return new THREE.CatmullRomCurve3([OUTS[i], at(0.22), at(0.1), b, at(-0.1), at(-0.22), P_IN].map(p => new THREE.Vector3(...p)), false, 'centripetal'); });
  // (the STAT3 pair stands upright; through its tilted pore it leans with the pore's axis, so its narrow way goes first)
  const Y = new THREE.Vector3(0, 1, 0), lean = new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(...PDIR[1]).negate()), Q0 = new THREE.Quaternion();
  const _w = new THREE.Vector3(), path = (u, pore) => WAY[pore].getPointAt(clamp(u, 0, 1), _w).toArray();
  let act = 0, mv = 0;
  // (a partner's label just outside its stretch)
  const slotAt = k => v3.add(visitors[k].position.toArray(), v3.mul(OUT[k], 0.05));
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
        now[k] = list.length ? list[n % list.length] : ''; nowA[k] = cyc > 0 && list.length ? s : 0;
      });
      // the domain where a partner is docked lights up (the strongest of the three, if two overlap)
      const hk = nowA.indexOf(Math.max(...nowA));
      if (nowA[hk] > 0.01) G2.setHighlight('A:' + RANGES[hk][0], 'A:' + RANGES[hk][1], HIC[hk], 0.85 * nowA[hk]); else G2.setHighlight(null);
      // TP53: to and fro through the left pore, a loop of 8 s
      // (eased only at the two ends, in the cytosol and in the nucleus: through the pore it keeps going)
      const ta = clamp(S.sites_tp, 0, 1), x = (t / 8) % 1, u = K.smooth(x < 0.5 ? x * 2 : 2 - x * 2);
      tp.visible = ta > 0.01; tp.scale.setScalar(Math.max(0.01, ta)); tp.position.set(...path(u, 0));
      // STAT3: switched on beside the kinase, the two copies pair up, through the middle pore (facing you), onto the DNA
      mv = clamp(S.sites_move, 0, 1);
      const show3 = mv > 0.001, w = K.smooth(clamp((mv - 0.3) / 0.6, 0, 1)), pair = K.smooth(clamp((mv - 0.15) / 0.15, 0, 1));
      st.visible = jak.visible = recB.visible = ep.visible = show3;
      const base = mv < 0.3 ? v3.lerp(REST, P_CYT, K.smooth(mv / 0.15)) : path(w, 1);
      st.position.set(...base);
      const ln = 1 - K.smooth(clamp((v3.dist(base, PORES[1]) - 0.16) / 0.2, 0, 1));
      st.quaternion.copy(Q0).slerp(lean, ln);
      // (the two apart until they pair: the second comes in from the side; the DNA shows once they are in the nucleus)
      st2.position.copy(slide).multiplyScalar(1 - pair);
      st2.visible = show3 && pair > 0.02;
      const dn = K.smooth(clamp((mv - 0.88) / 0.1, 0, 1));
      dnaW.visible = dn > 0.01; dnaW.scale.setScalar(Math.max(0.01, dn));
    },
    anchors: { grb2: [0, 0.26, 0], sh2: v3.add(DOM[1].p, [0, DOM[1].r + 0.03, 0.05]), sh3a: v3.add(DOM[0].p, [-0.05, DOM[0].r + 0.02, 0]), sh3b: v3.add(DOM[2].p, [0.05, DOM[2].r + 0.02, 0]), shell: [0.95, 0.7, 0.3],
      slot0: () => slotAt(0), slot1: () => slotAt(1), slot2: () => slotAt(2),
      tp53: () => v3.add(tp.position.toArray(), [0, 0.1, 0]), stat3: () => v3.add(st.position.toArray(), [0, 0.12, 0]), jak2: v3.add(JAK, [0, -0.07, 0]), ep300: [0.42, 0.64, 0.06],
      pore: v3.add(PORES[1], v3.mul(PDIR[1], 0.05)), cytosol: [0.62, -0.3, 0.2], nucleus: [NC[0] - 0.62, NC[1] + 0.48, NC[2]] },
    // (whose stretch it is and what it is: the owner, 23 November 2026)
    labels: [0, 1, 2].map(k => ({ text: () => [now[k], k === 1 ? 'a phosphorylated tyrosine' : 'its proline-rich stretch'], at: 'slot' + k, cls: k === 1 ? 'grn' : 'mag', alpha: () => (act < 0.3 ? nowA[k] : 0) })),
    cam: { default: [12, 10, 2.2, 0, 0, 0], close: [16, 12, 1.1, 0, 0, 0], shuttle: [10, 16, 3.2, 0.05, 0.3, 0.1] },
    stats: () => ({ grb2: nGrb, who: WHO, models: [G2, T5, sA, sB, sD].map(o => o.ok) }),
  });
};
SETS.sites.prep = molPrep(['grb2', 'tp53', 'stat3a', 'stat3b', 'stat3dna', 'jak2', 'p300']);
