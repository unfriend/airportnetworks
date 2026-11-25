// Spaces and walls (chapter 3), over the cell (its frame and its shapes: SETS.cell's api().CELL). The spaces light up one
// after another (walls_lit: the cytosol, the nucleoplasm, the ER's and the Golgi's lumens, the mitochondria's insides, the
// small organelles' insides, each its own, and outside the cell); the membranes then glow as walls (walls_wall). Three close-ups, not to scale: a receptor
// across the plasma membrane (the beta-2 adrenergic receptor's real fold as a cartoon: molMesh) with a real part on each side (an
// agonist outside coming into its pocket, the G protein Gs inside: PDB 3SN6), a nuclear pore (schematic) with a protein going through (TP53's core, its surface),
// and an import site on a mitochondrion (two schematic gates) where a folded protein (frataxin's surface) threads in
// unfolded, a chain of amino acids (walls_parts). Motion depends only on
// the time.
SETS.walls = function (K) {
  const { THREE, clamp, v3 } = K;
  const set = K.newSet('walls');
  const CELL = GL.sets.cell.api().CELL, col = GL.sets.cell.api().placeCol;
  const camAt = (p, d, dist) => { const n = v3.norm(d); return [Math.atan2(n[0], n[2]) / Math.PI * 180, Math.asin(n[1]) / Math.PI * 180, dist, p[0], p[1], p[2]]; };
  // ------------------------------------------------------------ the spaces: a glow filling each, a rim for its wall
  // (one draw a space: its organelles' spheres merged)
  const space = (geo, c, list) => {
    const m = K.rim(set, { color: c, a0: 0, a1: 0 }), M = new THREE.Matrix4();
    const geos = list.map(o => geo.clone().applyMatrix4(M.compose(new THREE.Vector3(...o.c), o.q || new THREE.Quaternion(), new THREE.Vector3(...(o.s || [1, 1, 1])))));
    const mesh = new THREE.Mesh(geos.length > 1 ? K.merge(geos) : geos[0], m);
    mesh.renderOrder = 9; set.group.add(mesh);
    return m;
  };
  const sph = new THREE.SphereGeometry(1, 48, 32);
  const X1 = new THREE.Vector3(1, 0, 0);
  // the ER's and the Golgi's lumens: the ER's sheets (its spheres where the cell's mask has them, as its skin) and the
  // Golgi's stacked caps, in one draw
  const lumens = (() => {
    const out = [], q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...CELL.gdir)), M = new THREE.Matrix4();
    CELL.er.r.forEach((r, k) => {
      const g = new THREE.SphereGeometry(r, 72, 48).toNonIndexed(), P = g.attributes.position.array, N = g.attributes.normal.array, keep = [], keepN = [];
      for (let i = 0; i < P.length; i += 9) {
        const d = v3.norm([P[i] + P[i + 3] + P[i + 6], P[i + 1] + P[i + 4] + P[i + 7], P[i + 2] + P[i + 5] + P[i + 8]]);
        if (CELL.erMask(d, k) > 0.06) for (let j = 0; j < 9; j++) { keep.push(P[i + j] + CELL.nuc.c[j % 3]); keepN.push(N[i + j]); }
      }
      const h = new THREE.BufferGeometry(); h.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); h.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3));
      out.push(h);
    });
    CELL.golgi.r.forEach((r, k) => out.push(new THREE.SphereGeometry(r, 48, 8, 0, Math.PI * 2, 0, CELL.golgi.ang[k]).toNonIndexed().applyMatrix4(M.compose(new THREE.Vector3(...CELL.nuc.c), q, new THREE.Vector3(1, 1, 1)))));
    out.forEach(g => { if (g.attributes.uv) g.deleteAttribute('uv'); });
    const mesh = new THREE.Mesh(K.merge(out), K.rim(set, { color: col[3], a0: 0, a1: 0 }));
    mesh.renderOrder = 9; set.group.add(mesh);
    return mesh.material;
  })();
  const SP = [
    { name: 'Cytosol', m: space(sph, col[0], [{ c: [0, 0, 0], s: CELL.pm.map(x => x * 0.985) }]), at: [0.62, -0.35, 0.3], fill: 0.05 },
    { name: 'Nucleoplasm', m: space(sph, col[1], [{ c: CELL.nuc.c, s: [CELL.nuc.r, CELL.nuc.r, CELL.nuc.r] }]), at: v3.add(CELL.nuc.c, [0, CELL.nuc.r * 0.6, 0]), fill: 0.16 },
    { name: 'ER and Golgi', m: lumens, at: v3.add(CELL.nuc.c, v3.mul(CELL.gdir, CELL.golgi.r[2])), fill: 0.1 },
    { name: 'Mitochondria', m: space(sph, col[5], CELL.mitos.map(o => ({ c: o.c, s: [o.a, o.b, o.b], q: new THREE.Quaternion().setFromUnitVectors(X1, new THREE.Vector3(...o.axis)) }))), at: CELL.mitos[0].c, fill: 0.3 },
    { name: 'Small organelles', m: space(sph, col[6], [...CELL.lysos, ...CELL.endos, ...CELL.peroxs].map(o => ({ c: o.c, s: [o.r, o.r, o.r] }))), at: CELL.lysos[0].c, fill: 0.3 },
    { name: 'Outside', m: space(sph, [0.5, 0.75, 0.9], [{ c: [0, 0, 0], s: CELL.pm.map(x => x * 1.12) }]), at: [0, CELL.pm[1] * 1.16, 0], fill: 0.035 },
  ];
  // ------------------------------------------------------------ the close-ups (much enlarged; the pore and the import site schematic)
  const solid = (c, e) => K.fade(set, new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: 0.5, metalness: 0.05, emissive: new THREE.Color(...c).multiplyScalar(e || 0.15) }));
  const patch = (R, hole) => new THREE.Mesh(new THREE.RingGeometry(hole || 0.0005, R, 40, 1), K.fade(set, new THREE.MeshBasicMaterial({ color: 0x9fd0ff, side: THREE.DoubleSide, depthWrite: false }), 0.18));
  const orient = (g, p, n) => { g.position.set(...p); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...v3.norm(n))); set.group.add(g); return g; };
  const flat = g => { g.rotation.x = -Math.PI / 2; return g; };   // (a ring lies across the y axis: the membrane's plane)
  // a receptor across the plasma membrane: the beta-2 adrenergic receptor (PDB 3SN6, its backbone as a cartoon: helices
  // as ribbons), its seven helices through the membrane, its loops outside and inside, coloured by UniProt P07550's
  // membrane spans (models.json: outside cyan, in the membrane yellow, inside pale blue); the signal outside, an agonist
  // (BI-167107, adrenaline's stand-in in the entry: its surface), comes into its pocket among the helices, and the partner
  // inside, the G protein Gs (its three chains' surface), docks below; all three cut from the one entry (orient: false),
  // so each comes to the very place it holds there
  const rd = v3.norm([0.62, 0.42, 0.66]), RP = v3.mul(rd, 1 / CELL.eScale(rd)), RN = v3.norm([rd[0] / CELL.pm[0] ** 2, rd[1] / CELL.pm[1] ** 2, rd[2] / CELL.pm[2] ** 2]);
  const rec = new THREE.Group(), RS = 0.07 / 68;   // (scene units an angstrom: the receptor about 0.07 long, as it was)
  const b2 = molMesh(set, 'b2ar', { look: 'cartoon', scale: RS });
  const lig = molMesh(set, 'b2lig', { scale: RS, centred: false }), gs = molMesh(set, 'gs', { scale: RS, centred: false, lod: 0 });   // (the partner inside at its finest always: a headset's close view, the owner's note of 23 November 2026)
  // (the agonist and the G protein in the receptor's own frame: beside its inner group, which is shifted to its middle)
  const own = new THREE.Group(); own.position.copy(b2.group.children[0].position); own.add(lig.group, gs.group); b2.group.add(own);
  // (the bundle's axis: from the helices' inner ends to their outer ends, the membrane spans; the membrane's middle
  // halfway between)
  const at = n => b2.anchor('R', n).toArray();
  const meanOf = l => v3.mul(l.map(at).reduce((c, p) => v3.add(c, p), [0, 0, 0]), 1 / l.length);
  const OUTER = b2.ok ? meanOf([35, 95, 107, 173, 197, 298, 306]) : [0, 0.01, 0], INNER = b2.ok ? meanOf([58, 72, 129, 151, 220, 275, 329]) : [0, -0.01, 0];
  const UP = v3.norm(v3.sub(OUTER, INNER)), SIDE = v3.norm(v3.cross(UP, [0, 0, 1]));   // (out of the cell, in the receptor's frame; a way across)
  const rcp = new THREE.Group(); rcp.add(b2.group); b2.group.position.set(...v3.mul(v3.add(OUTER, INNER), -0.5));
  rcp.quaternion.setFromUnitVectors(new THREE.Vector3(...UP), new THREE.Vector3(0, 1, 0));
  const half = v3.len(v3.sub(OUTER, INNER)) / 2, MEM = -0.004;   // (the membrane's middle, between its two faces)
  rcp.position.y = MEM; rec.add(rcp);
  // how far a model reaches up and down (its residues' anchors along the membrane's normal; [lo, hi])
  const span = name => {
    const V = new THREE.Vector3(), P = molPts(name);
    let lo = Infinity, hi = -Infinity;
    for (const q of P) {
      V.fromArray(q).multiplyScalar(RS).add(b2.group.children[0].position).add(b2.group.position).applyQuaternion(rcp.quaternion);
      lo = Math.min(lo, V.y); hi = Math.max(hi, V.y);
    }
    return P.length ? [lo + MEM, hi + MEM] : [-half + MEM, half + MEM];
  };
  const [bot, top] = span('b2ar'), gsLo = gs.ok ? span('gs')[0] : bot - 0.02;
  // the membrane's two faces, as far apart as the helices' ends (wide enough for the G protein below)
  rec.add(flat(patch(0.09)));
  { const a = rec.children[rec.children.length - 1]; a.position.y = MEM + half * 0.8; const b = flat(patch(0.09)); b.position.y = MEM - half * 0.8; rec.add(b); }
  // the sides a protein can take on this stretch of membrane, beside the receptor (through it several times): inside
  // the space (calmodulin, PDB 1CLL, soluble in the cytosol), on the cytosol's side (H-Ras, PDB 4G0N, held by its lipid
  // tail), on the far side (a simple ball on a stalk, as a GPI-anchored protein), through it once (a rod with a part on
  // each side), secreted (a ball drifting off outside); the simple ones are shapes, not models (walls_sides)
  const FO = MEM + half * 0.8, FI = MEM - half * 0.8, sides = new THREE.Group();
  const ball = (r, c, p) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), solid(c, 0.25)); m.position.set(...p); sides.add(m); return m; };
  const rod = (r, a, b, c) => { const d = v3.sub(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v3.len(d), 10), solid(c, 0.2)); m.position.set(...v3.lerp(a, b, 0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...v3.norm(d))); sides.add(m); return m; };
  const SD = { cyto: [-0.058, FI - 0.016, 0.012], far: [0.058, FO + 0.014, -0.012], once: [0.032, MEM, 0.055], inside: [-0.03, FI - 0.042, -0.045], sec: [0.0, FO + 0.03, -0.062] };
  const ras = molMesh(set, 'ras', { width: 0.022 }); ras.group.position.set(...SD.cyto); sides.add(ras.group);
  rod(0.0012, v3.add(SD.cyto, [0, 0.008, 0]), [SD.cyto[0], FI, SD.cyto[2]], [1.0, 0.85, 0.4]);   // (its lipid tail into the inner leaflet)
  ball(0.008, [0.45, 0.9, 1.0], SD.far); rod(0.0012, v3.add(SD.far, [0, -0.007, 0]), [SD.far[0], FO, SD.far[2]], [1.0, 0.85, 0.4]);   // (a GPI anchor)
  rod(0.0028, [SD.once[0], FI - 0.002, SD.once[2]], [SD.once[0], FO + 0.002, SD.once[2]], [1.0, 0.85, 0.35]);   // (one span, as the receptor's in yellow)
  ball(0.008, [0.45, 0.9, 1.0], [SD.once[0], FO + 0.009, SD.once[2]]); ball(0.006, [0.7, 0.8, 1.0], [SD.once[0], FI - 0.007, SD.once[2]]);
  const camM = molMesh(set, 'cam', { width: 0.018 }), calm = new THREE.Group(); calm.add(camM.group); calm.position.set(...SD.inside); sides.add(calm);
  const sec = ball(0.007, [0.45, 0.9, 1.0], SD.sec);
  rec.add(sides);
  orient(rec, RP, RN);
  rec.updateMatrix();
  const recAt = p => new THREE.Vector3(...p).applyMatrix4(rec.matrix).toArray();
  // the mitochondrion's four layers at the import site, lit one after another (walls_lay 1 to 4): the outer membrane
  // (at the outer gate), the gap, the inner membrane (at the inner gate), the matrix (glows: walls_lay)
  const layer = (geo, c, y) => { const m = new THREE.Mesh(geo, K.rim(set, { color: c, a0: 0, a1: 0 })); m.position.y = y; m.renderOrder = 10; return m; };
  const disk = (r0, r1) => new THREE.RingGeometry(r0, r1, 40).rotateX(-Math.PI / 2);
  const LAY = [layer(disk(0.0105, 0.032), [1.0, 0.55, 0.9], 0), layer(disk(0.0105, 0.03), [0.95, 0.85, 1.0], -0.004), layer(disk(0.0105, 0.03), [0.85, 0.4, 1.0], -0.008),
    layer(new THREE.SphereGeometry(1, 32, 16).scale(0.026, 0.008, 0.026), [0.8, 0.32, 1.0], -0.019)];
  // a nuclear pore in the nuclear envelope (two membranes), cargo going through: TP53's core domain (PDB 1TSR, a protein
  // the nucleus imports), its surface, small enough to pass the pore's opening with room to spare (a real pore's channel
  // is about 40 nm across, the protein about 5)
  const nd = v3.norm([-0.3, 0.6, 0.75]), NPp = v3.add(CELL.nuc.c, v3.mul(nd, CELL.nuc.r));
  const pore = new THREE.Group(), PR = 0.022, PT = 0.006;   // (the ring's radius and thickness: the same shape as chapter 7's pores)
  pore.add(flat(patch(0.065, PR)));
  { const b = flat(patch(0.065, PR)); b.position.y = -0.009; pore.add(b); }
  const ring = flat(new THREE.Mesh(new THREE.TorusGeometry(PR, PT, 8, 32), solid([0.8, 0.65, 1.0]))); ring.position.y = -0.0045; pore.add(ring);
  const cargoM = molMesh(set, 'tp53', { width: 0.017 }), cargo = new THREE.Group(); cargo.add(cargoM.group); pore.add(cargo);
  orient(pore, NPp, nd);
  // an import site on a mitochondrion: two gates (the outer membrane's TOM and the inner one's TIM), a protein made in the
  // cytosol (frataxin, PDB 1EKG, its surface) comes folded, then threads in unfolded, a chain of amino acids, its
  // targeting stretch (pale) first; inside, in the matrix, the chain folds up again (it never leaves the far side)
  const mi = CELL.mitos[0], md = v3.norm(v3.cross(mi.axis, [0, 1, 0])), MP = v3.add(mi.c, v3.mul(md, mi.b));
  const imp = new THREE.Group(), IG = [0, -0.008];   // (the two gates' heights)
  IG.forEach(y => { const g = flat(new THREE.Mesh(new THREE.TorusGeometry(0.0075, 0.0025, 6, 20), solid([1.0, 0.55, 0.45]))); g.position.y = y; imp.add(g); });
  const fx = molMesh(set, 'fxn', { width: 0.017 }), fold = new THREE.Group(); fold.add(fx.group); imp.add(fold);
  const CN = 24, CS = 0.0034, CB = 0.0016, F0 = 0.016;   // (beads in the chain, their spacing and size; the folded protein's middle)
  const chain = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05, emissive: new THREE.Color(1.0, 0.7, 0.4).multiplyScalar(0.25) })), CN);
  { const c = new THREE.Color(); for (let i = 0; i < CN; i++) chain.setColorAt(i, i < 5 ? c.setRGB(0.75, 0.9, 1.0) : c.setRGB(1.0, 0.7, 0.4)); }
  chain.frustumCulled = false; imp.add(chain);
  orient(imp, MP, md);
  // a point on the chain's way, s along it from the folded protein's middle: straight down through both gates into the
  // matrix, then coiling along the mitochondrion's long axis (AX, in the site's frame), its middle a third of the way
  // across (YC: the mitochondrion about 0.03 deep here, the site drawn 2.4 times larger); it stays inside
  const AX = new THREE.Vector3(...mi.axis).applyQuaternion(imp.quaternion.clone().invert()).toArray(), AW = v3.norm(v3.cross(AX, [0, 1, 0]));
  const S1 = F0 + 0.012, YC = -0.016, CR = 0.005, CA = 0.4, CW = Math.sqrt(1 - CA * CA) / CR;   // (coil: radius, advance an arc length, turn rate)
  const LT = S1 + 0.004 + (CN - 1) * CS;   // (how far the lead bead goes: the last bead then past the inner gate)
  const way = s => {
    if (s <= S1) return [0, F0 - s, 0];
    const u = s - S1, k = K.smooth(clamp(u / 0.008, 0, 1)), th = u * CW;   // (the coil starts at the gate's way out)
    const c = v3.add(v3.add(v3.mul(AX, u * CA), [0, YC, 0]), v3.add(v3.mul([0, 1, 0], CR * Math.cos(th)), v3.mul(AW, CR * Math.sin(th))));
    return v3.lerp([0, F0 - s, 0], c, k);
  };
  const FOLD_IN = v3.add(v3.mul(AX, (LT - S1) * CA * 0.5), [0, YC, 0]);   // (where it folds again: the coil's middle)
  const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _P = new THREE.Vector3(), _S = new THREE.Vector3();
  LAY.forEach(m => imp.add(m));
  const impAt = p => new THREE.Vector3(...p).multiplyScalar(2.4).applyQuaternion(imp.quaternion).add(imp.position).toArray();   // (the site drawn 2.4 times larger)
  const parts = [rec, pore, imp];
  return Object.assign(set, {
    // walls_lit: which space glows (1 the cytosol, 2 the nucleoplasm, 3 the ER and Golgi ... 6 outside; between two, both
    // a little; 0 none, 7 all faintly);
    // walls_wall: the membranes glow as walls; walls_parts: the three close-ups (receptor, pore, import site)
    // walls_sides: the sides beside the receptor; walls_lay: which of the mitochondrion's layers is lit (1 outer membrane
    // ... 4 matrix; between two, both a little; 0 none)
    params: { walls_a: 1, walls_lit: 0, walls_wall: 0, walls_parts: 0, walls_sides: 0, walls_lay: 0 },
    update(S, t) {
      const lit = clamp(S.walls_lit, 0, 7), w = clamp(S.walls_wall, 0, 1);
      SP.forEach((s, i) => {
        const on = lit >= 6.5 ? 0.4 * (lit - 6.5) * 2 : Math.max(0, 1 - Math.abs(lit - (i + 1)));
        s.m.uniforms.uA0.value = s.fill * on;
        s.m.uniforms.uA1.value = 0.25 * on + (i < 5 ? 0.55 * w : 0);
      });
      const pv = clamp(S.walls_parts, 0, 1);
      for (const g of parts) { g.visible = pv > 0.01; g.scale.setScalar(Math.max(0.01, pv) * (g === imp ? 2.4 : 1)); }   // (the import site drawn larger still: a mitochondrion is small)
      if (pv <= 0.01) return;
      const sv = clamp(S.walls_sides, 0, 1), ly = clamp(S.walls_lay, 0, 4);
      sides.visible = sv > 0.01; sides.scale.setScalar(Math.max(0.01, sv));
      LAY.forEach((m, i) => { const on = Math.max(0, 1 - Math.abs(ly - (i + 1))); m.material.uniforms.uA0.value = (i === 1 ? 0.35 : 0.5) * on; m.material.uniforms.uA1.value = 0.5 * on; });
      calm.position.set(SD.inside[0] + 0.004 * Math.sin(t * 0.9), SD.inside[1] + 0.004 * Math.sin(t * 0.7 + 1), SD.inside[2]); calm.rotation.set(t * 0.3, t * 0.2, 0);
      const sl = (t * 0.12) % 1; sec.position.set(SD.sec[0], SD.sec[1] + 0.03 * sl, SD.sec[2] - 0.01 * sl); sec.scale.setScalar(Math.max(0.01, K.smooth(sl / 0.15) * K.smooth((1 - sl) / 0.15)));
      // (each motion a loop of a few seconds: the signal docks and leaves, the partner binds, the cargo crosses, the chain threads in)
      const a = (t * 0.2) % 1, b = (t * 0.17 + 0.3) % 1, c = (t * 0.15 + 0.5) % 1;   // (c: at about 0.1 as the story comes to the import site, 204 s)
      const dock = x => (x < 0.4 ? x / 0.4 : x < 0.7 ? 1 : 1 - (x - 0.7) / 0.3);
      // (the agonist from outside into its pocket among the helices' outer ends; the G protein up from inside to the
      // receptor's inner face, where it sits in the entry; each grows in on its way and shrinks away)
      const ga = 1 - dock(a), gb = 1 - dock(b);
      lig.group.position.set(...v3.add(v3.mul(UP, 0.045 * ga), v3.mul(SIDE, 0.02 * ga)));
      lig.group.scale.setScalar(Math.max(0.01, 1 - K.smooth(clamp((ga - 0.7) / 0.3, 0, 1))));
      gs.group.position.set(...v3.mul(UP, -0.04 * gb));
      gs.group.scale.setScalar(Math.max(0.01, 1 - K.smooth(clamp((gb - 0.6) / 0.4, 0, 1))));
      // (the cargo: in from the cytosol side, through the ring, out into the nucleus at an even pace, growing in and
      // shrinking away at the loop's ends)
      const cs = K.smooth(b / 0.12) * K.smooth((1 - b) / 0.12);
      cargo.position.set(0, 0.05 - 0.11 * b, 0); cargo.scale.setScalar(Math.max(0.01, cs)); cargo.rotation.set(t * 0.4, t * 0.25, 0);
      // (the import: the folded protein comes to the outer gate (c 0 to 0.15), its chain is pulled through both gates
      // into the matrix (0.15 to 0.62, the protein shrinking as it unfolds), then the chain folds up again inside
      // (0.64 to 0.8: the beads gather, the same protein grows where they meet; done before the chapter ends) and fades
      // at the loop's end)
      const L = LT * K.smooth(clamp((c - 0.15) / 0.47, 0, 1)), left = 1 - Math.min(1, L / (CN * CS));
      const g = K.smooth(clamp((c - 0.64) / 0.16, 0, 1)), fin = 1 - K.smooth(clamp((c - 0.93) / 0.07, 0, 1));
      if (c < 0.64) {
        fold.position.set(0, F0 + 0.03 * (1 - K.smooth(c / 0.15)), 0); fold.rotation.set(0, t * 0.3 * (1 - K.smooth(c / 0.15)), 0);
        fold.scale.setScalar(Math.max(0.01, Math.cbrt(left) * K.smooth(c / 0.06))); fold.visible = left > 0.02;
      } else {
        fold.position.set(...FOLD_IN); fold.rotation.set(0, t * 0.3, 0);
        fold.scale.setScalar(Math.max(0.01, g * fin)); fold.visible = g * fin > 0.02;
      }
      for (let i = 0; i < CN; i++) {   // (bead i, the targeting stretch's first, is i beads behind the lead)
        const s = L - i * CS, r = s > 0.005 ? CB * (1 - g) : 0;
        chain.setMatrixAt(i, _M.compose(_P.set(...v3.lerp(way(Math.max(0, s)), FOLD_IN, g)), _Q, _S.setScalar(Math.max(r, 1e-5))));
      }
      chain.instanceMatrix.needsUpdate = true;
    },
    anchors: { sIn: recAt(v3.add(SD.inside, [0, -0.012, 0])), sCyto: recAt(v3.add(SD.cyto, [0, -0.014, 0])), sFar: recAt(v3.add(SD.far, [0, 0.012, 0])), sOnce: recAt([SD.once[0], FO + 0.02, SD.once[2]]),
      sSec: recAt(v3.add(SD.sec, [0, 0.025, 0])), sMany: recAt([0, top + 0.01, 0]), lOuter: impAt([0.036, 0.003, 0]), lGap: impAt([0.036, -0.004, 0.006]), lInner: impAt([0.034, -0.009, 0.012]), lMatrix: impAt([0.02, -0.024, 0.01]),
      cytosol: SP[0].at, nucleus: SP[1].at, lumen: SP[2].at, mito: SP[3].at, small: SP[4].at, outside: SP[5].at,
      receptor: v3.add(RP, v3.mul(RN, top + 0.015)), recIn: v3.add(RP, v3.mul(RN, gsLo - 0.01)), recOut: v3.add(RP, v3.mul(RN, top + 0.035)), pore: v3.add(NPp, v3.mul(nd, 0.04)), import: v3.add(MP, v3.mul(md, 0.07)) },
    labels: [],
    cam: { default: [20, 14, 3.6, 0, 0, 0], receptor: camAt(v3.add(RP, v3.mul(RN, (gsLo + top) / 2)), v3.add(RN, [0.35, -0.25, 0.3]), 0.42), sides: camAt(v3.add(RP, v3.mul(RN, MEM)), v3.add(RN, [0.5, -0.1, 0.45]), 0.5), pore: camAt(NPp, v3.add(nd, [-0.3, 0.25, 0.1]), 0.32), import: camAt(MP, v3.add(v3.mul(md, 0.6), v3.mul(v3.norm(mi.axis), 0.8)), 0.26) },
  });
};
SETS.walls.prep = molPrep(['b2ar', 'b2lig', 'gs', 'tp53', 'fxn', 'ras', 'cam']);
