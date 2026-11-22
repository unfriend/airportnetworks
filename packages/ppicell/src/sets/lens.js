// The methods as lenses over the cell (chapter 6): three rings, each with a small scene of how a method finds a link
// (real shapes from the Protein Data Bank as molecular surfaces: models.js; not to scale against the yeast, the tube or the halo). Two-hybrid: in a yeast nucleus, two proteins each carry half of a switch; if they bind, the halves
// meet on the DNA and a reporter lights, wherever the two live in our own cells. Purification with mass spectrometry: the
// cell is broken open and a bait pulled out of the mix with what clings to it, proteins from different places meeting in
// the tube. Proximity labelling: a bait in a living cell marks what comes near it with tags, near, not necessarily bound.
// lens_open brings the rings in, lens_focus lights one (1, 2, 3; 0 all alike). Drawn in the cell's frame, above it.
// The bait and prey of the two-hybrid are H-Ras and the Raf kinase's Ras-binding domain (PDB 4G0N), each a surface (two
// models cut from the entry in its own coordinates), meeting at their crystal contact; the hook of the purification is
// an antibody (PDB 1IGT); the proximity labelling's bait carries the biotin ligase BirA (PDB 1BIA); the proteins in the
// tube and round the bait are the crowd's real proteins as balls, as the crowd draws them (BALLS), and so is the broken
// cell's membrane (torn pieces of a lipid bilayer).
SETS.lens = function (K) {
  const { THREE, clamp, v3 } = K;
  const set = K.newSet('lens');
  const AT = [[-1.3, 1.08, 0.25], [0, 1.36, 0.35], [1.3, 1.08, 0.25]], R = 0.42;
  const face = new THREE.Vector3(...v3.norm([Math.sin(20 * Math.PI / 180), 0.25, Math.cos(20 * Math.PI / 180)]));
  const solid = (c, e) => K.fade(set, new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: 0.5, metalness: 0.05, emissive: new THREE.Color(...c).multiplyScalar(e || 0.2) }));
  const blob = (r, c, e) => new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), solid(c, e));
  const lenses = AT.map(p => {
    const g = new THREE.Group(), inner = new THREE.Group();
    g.position.set(...p); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face);
    const ringMat = K.fade(set, new THREE.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.35, metalness: 0.6, emissive: 0x2a3a50 }));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.018, 10, 64), ringMat));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 48), K.rim(set, { color: [0.35, 0.6, 0.9], a0: 0.05, a1: 0.05 }));
    g.add(disc); g.add(inner); set.group.add(g);
    return { g, inner, ringMat, disc };
  });
  const pts = (n, f) => { const geo = K.pointsGeo(n); for (let i = 0; i < n; i++) f(i, geo.attributes); return geo; };
  const PLC = [[0.55, 0.78, 1.0], [0.66, 0.54, 1.0], [0.8, 0.32, 1.0], [0.35, 0.95, 0.6], [0.42, 0.44, 1.0]];   // (the cell's place colours: no orange or red)
  const r = K.rng(5);
  // 1. two-hybrid: a yeast nucleus, its DNA, the bait on it (with its half of the switch), the prey coming in
  const Y = lenses[0].inner;
  Y.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 20), K.rim(set, { color: [0.75, 0.6, 1.0], a0: 0.04, a1: 0.5 })));
  const dna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.44, 8), solid([0.6, 0.65, 0.8])); dna.rotation.z = Math.PI / 2; dna.position.y = -0.12; Y.add(dna);
  // (H-Ras the bait, on the DNA; Raf's RBD the prey: each part turned as in the crystal, so that when the prey arrives
  // their contact faces each other; the pair's line from the bait to the prey lies along JOIN)
  // (both drawn at one scale, the pair 0.17 long; each centred on its own middle, turned so the line between the two
  // middles lies along JOIN)
  const pr = molAxis([...molPts('ras'), ...molPts('raf')]), RS = 0.17 / (pr.span || 60);
  const mid = n => { const H = molHead(n); return H ? H.centre.map(x => x * RS) : [0, 0, 0]; };
  const ras = molMesh(set, 'ras', { scale: RS }), raf = molMesh(set, 'raf', { scale: RS }), JOIN = v3.norm([1, 0.25, 0]);
  const rrQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...v3.norm(v3.sub(mid('raf'), mid('ras')))), new THREE.Vector3(...JOIN));
  const BAIT = [-0.05, -0.04, 0], GAP = v3.len(v3.sub(mid('raf'), mid('ras'))), PREY = v3.add(BAIT, v3.mul(JOIN, GAP));
  const bait = ras.group, prey = raf.group;
  for (const pg of [bait, prey]) { pg.quaternion.copy(rrQ); Y.add(pg); }
  bait.position.set(...BAIT);
  const glowG = pts(1, (i, a) => { a.aCol.array.set([1.0, 0.95, 0.5]); a.aSize.array[0] = 0.12; });
  const glow = new THREE.Points(glowG, K.points(set)); glow.position.set(PREY[0] + 0.04, -0.12, 0.01); Y.add(glow);
  // 2. purification: a cell broken open, torn pieces of its membrane drifting apart, its proteins spilling out and falling
  // into a tube. The membrane is a lipid bilayer drawn as balls (a lipid's head on each face, the tails between them), torn
  // into ragged pieces; the proteins are the crowd's real ones (balls, BALLS), each in the colour of the place it came from
  // (the cell's place colours), sized to scale against each other (one factor: the largest, tubulin, 0.05 long). One draw.
  const A2 = lenses[1].inner, CC = [0, 0.12, 0], RC = 0.17;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.22, 20, 1, true), K.rim(set, { color: [0.8, 0.9, 1.0], a0: 0.05, a1: 0.6 })); tube.position.y = -0.2; A2.add(tube);
  // the hook: an antibody (light chains pale, heavy chains deeper amber) in the tube, holding the bait
  const AB = molMesh(set, 'igg', { width: 0.1 });
  AB.group.position.set(0, -0.2, 0); AB.group.rotation.z = Math.PI / 2; A2.add(AB.group);
  // (the pieces: the sphere's lipids shared out to the nearest of NF seeds; a ragged strip along each seam torn away, and a
  // few holes, so no two pieces meet; each piece's balls kept about its own middle, which drifts out and turns)
  const NF = 11, seeds = Array.from({ length: NF }, (_, i) => { const y = 1 - 2 * (i + 0.5) / NF, q = Math.sqrt(1 - y * y), a = i * 2.39996 + r() * 0.5; return v3.norm([q * Math.cos(a), y + 0.15 * (r() - 0.5), q * Math.sin(a)]); });
  const SP = 0.0105, NL = Math.round(4 * Math.PI * RC * RC / (SP * SP * 0.87)), HR = 0.0053, TR = 0.0046, TH = 0.0068;
  const wob = u => Math.sin(23 * u[0] + 3 * u[1]) * Math.sin(19 * u[1] - 5 * u[2]) + 0.6 * Math.sin(31 * u[2] + 11 * u[0]);
  const frag = seeds.map(() => []), LIP = [[RC + TH, HR], [RC - TH, HR], [RC, TR]];   // (two heads, the tails)
  for (let i = 0; i < NL; i++) {
    const y = 1 - 2 * (i + 0.5) / NL, q = Math.sqrt(1 - y * y), a = i * 2.39996, u = [q * Math.cos(a), y, q * Math.sin(a)];
    const d = seeds.map(s => 1 - v3.dot(s, u)), o = d.map((x, j) => j).sort((x, z) => d[x] - d[z]);
    if (o[0] === NF - 1 || d[o[1]] - d[o[0]] < 0.045 + 0.035 * wob(u) + 0.06 * r() * r() || wob(v3.mul(u, 1.7)) > 1.35) continue;   // (the tears, the holes; the bottom torn away, where the proteins pour out)
    const j = 0.0018 * (r() - 0.5);   // (each lipid a little in or out: a membrane is not a lattice)
    for (const [rr, br] of LIP) frag[o[0]].push([u[0] * (rr + j), u[1] * (rr + j), u[2] * (rr + j), br * (0.9 + 0.2 * r())]);
  }
  const HEAD = [0.7, 0.77, 0.9], TAIL = [0.92, 0.86, 0.64];
  const fragM = frag.map((F, j) => {
    const m = v3.mul(seeds[j], RC);
    return { balls: F.map(b => [b[0] - m[0], b[1] - m[1], b[2] - m[2], b[3]]), cols: F.map((b, i) => (i % 3 > 1 ? TAIL : HEAD)), m, out: v3.norm([seeds[j][0], seeds[j][1] > 0 ? seeds[j][1] : 0.2 * seeds[j][1], seeds[j][2]]), ax: new THREE.Vector3(...v3.norm(v3.cross(seeds[j], [0, 1, 0.01]))), q: new THREE.Quaternion() };
  });
  const CROWD = ['ubq', 'cam', 'gapdh', 'tub', 'actin'], PER_A2 = 0.05 / Math.max(...CROWD.map(k => 2 * BALLS.reach(BALLS.of(k, 1))));
  const NM = 36, mixK = Array.from({ length: NM }, (_, i) => i % CROWD.length), mixB = mixK.map(j => BALLS.of(CROWD[j], PER_A2)), mixR = mixB.map(BALLS.reach);
  const mix = BALLS.cloud(set, [...fragM, ...mixB.map((balls, i) => ({ balls, c: PLC[i % PLC.length] }))]); A2.add(mix.points);
  const mixQ = Array.from({ length: NM }, () => new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.3, r() * 6.3, r() * 6.3)));
  // (where each starts, inside the cell, and ends, in the tube above and round the antibody: none overlapping)
  const mixS = BALLS.scatter(mixR, () => v3.add(CC, v3.mul(K.unit(r), (RC - 0.05) * Math.cbrt(r()))), 0.9);
  const mixE = BALLS.scatter(mixR, () => [0.1 * (r() - 0.5), -0.27 + 0.17 * r(), 0.08 * (r() - 0.5)], 0.85, 80, [{ p: [0, -0.2, 0], r: 0.03 }]);
  const mixD = mixS.map(p => v3.norm(v3.sub(p, CC).map((x, j) => x + (j === 1 ? 0 : 0.001))));
  // 3. proximity labelling: a bait, its halo, the neighbours it tags as they come near
  const A3 = lenses[2].inner;
  const bait3 = blob(0.032, [0.3, 0.75, 1.0]); bait3.position.set(-0.03, 0, 0); A3.add(bait3);
  const BI = molMesh(set, 'bira', { width: 0.065 });   // (the biotin ligase, fused to the bait)
  BI.group.position.set(0.035, 0.005, 0.01); A3.add(BI.group);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 28, 18), K.rim(set, { color: [0.4, 1.0, 0.7], a0: 0.06, a1: 0.5 })); A3.add(halo);
  // the neighbours: real proteins as balls, grey; those inside the halo collect a tag (placed so that none overlaps another
  // as they drift)
  const NN = 30, nbK = Array.from({ length: NN }, (_, i) => i % CROWD.length), nbB = nbK.map(j => BALLS.of(CROWD[j], PER_A2 * 0.8));
  const nbQ = nbK.map(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.3, r() * 6.3, r() * 6.3))), nbR = nbB.map(b => BALLS.reach(b) * 0.7);
  const nbS = BALLS.scatter(nbB.map(b => BALLS.reach(b) + 0.015), () => { const u = K.unit(r), d = 0.09 + 0.2 * Math.sqrt(r()); return [u[0] * d, u[1] * d * 0.8, u[2] * d * 0.5]; }, 1, 80, [{ p: [0, 0, 0], r: 0.06 }]);
  const nbM = BALLS.cloud(set, nbB.map(balls => ({ balls, c: [0.65, 0.7, 0.8] }))); A3.add(nbM.points);
  const nb = { attributes: { position: { array: new Float32Array(3 * NN) } } };   // (the neighbours' places this frame)
  const tags = pts(NN, (i, a) => { a.aCol.array.set([0.4, 1.0, 0.7], 3 * i); a.aSize.array[i] = 0.022; a.aA.array[i] = 0; });
  const tagP = new THREE.Points(tags, K.points(set)); A3.add(tagP);
  const anchorOf = (i, y) => () => { const p = AT[i]; return [p[0], p[1] + y, p[2]]; };
  return Object.assign(set, {
    // lens_open: the rings come in (each a little after the one before); lens_focus: one lit (1 two-hybrid, 2
    // purification, 3 proximity labelling), the others dimmed; 0 all alike
    params: { lens_a: 1, lens_open: 0, lens_focus: 0 },
    update(S, t) {
      const o = clamp(S.lens_open, 0, 1), f = clamp(S.lens_focus, 0, 3);
      lenses.forEach((L, i) => {
        const s = K.smooth(clamp(o * 1.6 - i * 0.3, 0, 1)), lit = f < 0.5 ? 1 : Math.max(0.3, 1 - Math.abs(f - (i + 1)));
        L.g.scale.setScalar(Math.max(0.01, s) * (0.85 + 0.15 * lit));
        L.g.visible = s > 0.01;
        L.ringMat.emissive.setRGB(0.16 * lit + 0.05, 0.22 * lit + 0.06, 0.32 * lit + 0.08);
        L.inner.visible = lit > 0.35;
      });
      // two-hybrid: the prey comes, binds, the reporter lights, it leaves (a loop of 6 s)
      const a = (t / 6) % 1, near = a < 0.35 ? K.smooth(a / 0.35) : a < 0.8 ? 1 : 1 - K.smooth((a - 0.8) / 0.2);
      prey.position.set(...v3.add(PREY, [0.17 * (1 - near), 0.15 * (1 - near), 0]));
      glowG.attributes.aA.array[0] = clamp((near - 0.9) * 10, 0, 1) * (0.7 + 0.3 * Math.sin(t * 6)); glowG.attributes.aA.needsUpdate = true;
      // purification: the cell breaks open, its proteins fall into the tube (a loop of 8 s)
      const b = (t / 8) % 1, br = K.smooth(clamp(b / 0.3, 0, 1)), fall = K.smooth(clamp((b - 0.25) / 0.45, 0, 1)), back = clamp((b - 0.92) / 0.08, 0, 1);
      const gone = back < 0.5 ? 1 : 0;
      fragM.forEach((F, j) => {   // (the pieces drift out and turn a little, none down over the tube)
        F.q.setFromAxisAngle(F.ax, 0.9 * br);
        mix.place(j, v3.add(CC, v3.add(F.m, v3.mul(F.out, 0.13 * br))), F.q, gone);
      });
      for (let i = 0; i < NM; i++) {   // (the proteins spill out between the pieces and fall into the tube, one after another)
        const f = K.smooth(clamp((b - 0.24 - 0.22 * i / NM) / 0.42, 0, 1)), w = Math.sin(Math.PI * f) * 0.07;
        mix.place(NF + i, v3.add(v3.lerp(mixS[i], mixE[i], f), [mixD[i][0] * w, 0, mixD[i][2] * w]), mixQ[i], gone);
      }
      mix.tick(t);
      // proximity labelling: neighbours drift; those inside the halo collect a tag (a loop of 7 s)
      const c = (t / 7) % 1, P3 = nb.attributes.position.array, T3 = tags.attributes.position.array, TA = tags.attributes.aA.array;
      for (let i = 0; i < NN; i++) {
        const s = nbS[i], w = 0.02 * Math.sin(t * 0.9 + i);
        P3[3 * i] = s[0] + w; P3[3 * i + 1] = s[1] - w; P3[3 * i + 2] = s[2];
        const inside = Math.hypot(s[0], s[1], s[2]) < 0.17;
        TA[i] = inside ? clamp((c - i / NN * 0.6) * 5, 0, 1) * (c < 0.95 ? 1 : 0) : 0;
        T3[3 * i] = P3[3 * i] + nbR[i]; T3[3 * i + 1] = P3[3 * i + 1] + nbR[i]; T3[3 * i + 2] = P3[3 * i + 2] + nbR[i] * 0.6;
      }
      for (let i = 0; i < NN; i++) nbM.place(i, [P3[3 * i], P3[3 * i + 1], P3[3 * i + 2]], nbQ[i]);
      nbM.tick(t);
      tags.attributes.position.needsUpdate = true; tags.attributes.aA.needsUpdate = true;
    },
    anchors: { yeast: anchorOf(0, R + 0.08), apms: anchorOf(1, R + 0.08), prox: anchorOf(2, R + 0.08),
      yeastTag: anchorOf(0, -R - 0.06), apmsTag: anchorOf(1, -R - 0.06), proxTag: anchorOf(2, -R - 0.06) },
    labels: [],
    cam: { default: [20, 10, 5.4, 0, 0.5, 0], yeast: [14, 6, 2.7, AT[0][0], AT[0][1] - 0.1, AT[0][2]], apms: [20, 6, 2.7, AT[1][0], AT[1][1] - 0.1, AT[1][2]], prox: [26, 6, 2.7, AT[2][0], AT[2][1] - 0.1, AT[2][2]] },
  });
};
SETS.lens.prep = molPrep(['ras', 'raf', 'igg', 'bira']);
