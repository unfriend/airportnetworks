// The ovary in 3D (the aging ovary story): a large cut-away ovary, lit, built from signed distance fields polygonised
// by surface nets (as the microanatomy story's organs, larger and in more detail): under its pale surface (the tunica
// albuginea) the cortex with follicles at their stages (primordial specks, primary and secondary follicles, antral
// follicles cut open: a fluid-filled antrum lined with granulosa cells, an oocyte on its mound), a corpus luteum and
// pale scars (corpora albicantia), the medulla with coiled blood vessels running in from the hilum. The age (20 to 70)
// thins the follicles and adds scars along the poster's trend lines (OVARY_TREND.level: follicles near none by about
// 60), a cut follicle closing as its floor rises; the vessels thin a little and the ovary shrinks. It also sits small in
// the tour's body (the body set's frame, at the ovary's place, beside its partner and the uterus) and grows out of it,
// and the front wedge of the cut lifts away. The organ's two meshes build between frames (idle, finish).
SETS.organ = function (K) {
  const { THREE, smooth, clamp, prog, lerp } = K;
  const L = OVARY_LOOK, T = OVARY_TREND, C = L.C, KI = L.KI;
  L.init(K);
  const set = K.newSet('organ');
  const R = K.rng(51), rr = (a, b) => a + (b - a) * R();

  // ------------------------------------------------------------- the shape (local units: about 1.9 long)
  const A = 0.95, B = 0.56, CZ = 0.46, XC = -0.32;   // half axes; the cut removes z > 0 for x > XC
  const n1 = L.noise3(7), n2 = L.noise3(8), n3 = L.noise3(9), n4 = L.noise3(10);
  const bend = x => 0.07 * (x / A) * (x / A) + 0.02;
  function ell(x, y, z) {
    const a = x / A, b = (y - bend(x)) / B, c = z / CZ, k0 = Math.sqrt(a * a + b * b + c * c), k1 = Math.sqrt(a * a / (A * A) + b * b / (B * B) + c * c / (CZ * CZ));
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(A, B, CZ);
  }
  // (a cone with round ends, as the organs' models)
  function cone(a, b, r1, r2) {
    const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2], rd = r1 - r2, a2 = l2 - rd * rd, il2 = 1 / l2;
    return (x, y, z) => {
      const px = x - a[0], py = y - a[1], pz = z - a[2], yy = px * ba[0] + py * ba[1] + pz * ba[2], zz = yy - l2;
      const qx = px * l2 - ba[0] * yy, qy = py * l2 - ba[1] * yy, qz = pz * l2 - ba[2] * yy, x2 = qx * qx + qy * qy + qz * qz;
      const kk = Math.sign(rd) * rd * rd * x2;
      if (Math.sign(zz) * a2 * zz * zz > kk) return Math.sqrt(x2 + zz * zz * l2) * il2 - r2;
      if (Math.sign(yy) * a2 * yy * yy < kk) return Math.sqrt(x2 + yy * yy * l2) * il2 - r1;
      return (Math.sqrt(x2 * a2 * il2) + yy * rd) * il2 - r1;
    };
  }
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const surfN = (x, y, z) => 0.011 * n1(x * 4.2, y * 4.2, z * 4.2) + 0.005 * n2(x * 10, y * 10, z * 10);
  const HIL = [0.2, -0.44, -0.08], stub = cone(HIL, [0.27, -0.84, -0.16], 0.15, 0.085);
  const outer = (x, y, z) => ell(x, y, z) + surfN(x, y, z);
  const bodyF = (x, y, z) => smin(outer(x, y, z), stub(x, y, z), 0.14);
  // depth below the surface, on the cut face (z = 0)
  const depth = (x, y) => -outer(x, y, 0);
  const cortexD = (x, y) => 0.2 + 0.035 * n3(x * 3, y * 3, 0.5);

  // ------------------------------------------------------------- what is where (on the cut face, z = 0)
  const DISCS = [];   // [x, y, r] taken so far
  const free = (x, y, r, gap) => DISCS.every(([a, b, q]) => (x - a) * (x - a) + (y - b) * (y - b) > (r + q + gap) * (r + q + gap));
  const nearHilum = (x, y, r) => Math.hypot(x - HIL[0], y - HIL[1]) < r + 0.2;
  function place(n, rMin, rMax, dMin, dMax, gap, tries = 4000, opt = {}) {
    const out = [];
    for (let t = 0; t < tries && out.length < n; t++) {
      const r = rr(rMin, rMax), x = rr(XC + 0.04 + r, 0.93 - r), y = rr(-0.56, 0.62), d = depth(x, y);
      if (d < (opt.centre ? dMin : r + dMin) || d > (opt.centre ? dMax : r + dMax)) continue;
      if (!opt.hilum && nearHilum(x, y, r)) continue;
      if (!free(x, y, r, gap)) continue;
      DISCS.push([x, y, r]); out.push({ x, y, r, d });
    }
    return out;
  }
  // antral follicles (cut in half: holes in the face), the corpus luteum, scars, growing follicles, vessels cut across
  const ANT = place(8, 0.085, 0.15, 0.03, 0.075, 0.04);
  ANT.sort((a, b) => b.r - a.r);
  const LUT = place(1, 0.13, 0.15, 0.04, 0.09, 0.04)[0];
  const SCAR = place(16, 0.035, 0.1, 0.06, 0.32, 0.02);
  const SEC = place(14, 0.026, 0.04, 0.02, 0.09, 0.015);
  const PRI = place(30, 0.014, 0.02, 0.02, 0.07, 0.01);
  const VX = place(36, 0.012, 0.03, 0.17, 0.6, 0.012, 6000, { centre: true, hilum: true });
  // when each goes (or comes): along the poster's trend lines, the first ones early, so the count follows the line
  const order = n => { const o = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
  const falls = (list, kind) => { const o = order(list.length); list.forEach((s, i) => { s.until = T.crossing(kind, (o[i] + 0.5) / list.length, false); }); };
  falls(ANT, 'follicle'); falls(SEC, 'follicle'); falls(PRI, 'follicle'); falls(VX, 'vessel');
  { const o = order(SCAR.length); SCAR.forEach((s, i) => { s.from = T.crossing('albicans', (o[i] + 0.5) / SCAR.length, true); }); }
  // the largest antral follicle lasts longest (the one the story points at)
  { const last = ANT.reduce((a, s) => (s.until > a.until ? s : a), ANT[0]); [last.until, ANT[0].until] = [ANT[0].until, last.until]; }

  // ------------------------------------------------------------- the organ's field, with the antral holes
  const cutR = (x, z) => Math.min(z, x - XC);   // > 0 inside the removed wedge
  const holes = (x, y, z) => { let d = 9; for (let i = 0; i < ANT.length; i++) { const s = ANT[i], dx = x - s.x, dy = y - s.y, q = Math.sqrt(dx * dx + dy * dy + z * z) - s.r; if (q < d) d = q; } return d; };
  const mainF = (x, y, z) => Math.max(smax(bodyF(x, y, z), cutR(x, z), 0.012), -holes(x, y, z));
  const wedgeF = (x, y, z) => Math.max(smax(bodyF(x, y, z), -cutR(x, z), 0.012), -holes(x, y, z));
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const tint = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  // the face's colors: tunica (pale) at the rim, the cortex (dense, mauve, speckled) and the medulla (looser, redder,
  // mottled); round each antral follicle the theca; the holes lined with granulosa cells; the hilum red
  function faceCol(x, y, z, plain) {
    const d = -outer(x, y, z), cd = cortexD(x, y), sp = n2(x * 38, y * 38, z * 38), mo = n4(x * 7, y * 7, z * 7);
    let c;
    if (d < 0.03) c = mix(C.tunica, C.cortex, smooth((d - 0.012) / 0.02));
    else if (d < cd) c = tint(mix(C.cortex, [0.55, 0.38, 0.62], 0.2 + 0.3 * sp), 1 + 0.05 * mo);
    else c = tint(mix(C.medulla, [0.8, 0.42, 0.48], clamp(0.35 * mo + 0.25 * sp, 0, 1)), 1);
    if (d >= cd - 0.025 && d < cd + 0.025) c = mix(c, mix(C.cortex, C.medulla, 0.5), 0.6);
    return c;
  }
  function organCol(x, y, z) {
    const ds = stub(x, y, z), d0 = outer(x, y, z);
    if (ds < d0 && y < -0.32) return tint(mix(C.hilum, C.artery, 0.2 + 0.2 * n2(x * 20, y * 20, z * 20)), 1);
    if (z < -0.004 && Math.abs(holes(x, y, z)) < 0.012) return tint(mix(C.granulosa, C.nucleus2, 0.3 + 0.3 * n2(x * 50, y * 50, z * 50)), 0.95);
    if (d0 > -0.014) {
      // the outer surface: pale, with fine vessels showing through
      const st = Math.abs(n1(x * 9 + 3, y * 3, z * 9));
      return mix(C.tunica, [0.86, 0.6, 0.64], 0.35 * smooth(1 - st * 6) + 0.12 * n3(x * 13, y * 13, z * 13));
    }
    return faceCol(x, y, z);
  }

  // ------------------------------------------------------------- materials and meshes
  const ages = { value: 30 };   // (one age for all the ovary's materials)
  const solidMat = L.objMat(set, { gloss: 0.18, uniforms: { uAge: ages } });
  const organMat = L.objMat(set, { gloss: 0.1, uniforms: { uAge: ages } });
  const wedgeMat = L.objMat(set, { gloss: 0.1, uniforms: { uAge: ages } });
  const glassMat = L.objMat(set, { gloss: 0.9, alpha: 0.3, depthWrite: false, side: THREE.DoubleSide, uniforms: { uAge: ages } });
  const pairMat = L.objMat(set, { gloss: 0.12 }), pelvisMat = L.objMat(set, { gloss: 0.25 });
  for (const m of [solidMat, organMat, glassMat]) m.uniforms.uHiCol.value[5].set(...C.luteum.map(v => Math.min(1, v * 1.1)));
  // a geometry for the lit material from arrays (no objects in it: always shown)
  function objGeo(pos, nrm, col, idx) {
    const g = new THREE.BufferGeometry(), n = pos.length / 3;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aCen', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const o = new Float32Array(n * 4); for (let i = 0; i < n; i++) o.set([-99, 999, -1, 0], 4 * i);
    g.setAttribute('aObj', new THREE.BufferAttribute(o, 4));
    g.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(n), 1));
    if (idx) g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }
  // a stand-in until the organ is built (a smooth ellipsoid in the surface's color)
  function standIn(wedge) {
    const s = new THREE.SphereGeometry(1, 40, 24), p = s.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * A, p.getY(i) * B + bend(p.getX(i) * A), p.getZ(i) * CZ);
    s.computeVertexNormals();
    const g = s.toNonIndexed(), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set(C.tunica, 3 * i);
    return wedge ? new THREE.BufferGeometry() : objGeo(g.attributes.position.array, g.attributes.normal.array, col, null);
  }
  const ovary = new THREE.Group(), wedge = new THREE.Group(), partner = new THREE.Group();
  set.group.add(ovary, partner); ovary.add(wedge);
  const organMesh = new THREE.Mesh(standIn(false), organMat), wedgeMesh = new THREE.Mesh(standIn(true), wedgeMat);
  ovary.add(organMesh); wedge.add(wedgeMesh);
  wedgeMesh.visible = false;   // (until built)
  const pairA = new THREE.Mesh(organMesh.geometry, pairMat), pairB = new THREE.Mesh(wedgeMesh.geometry, pairMat);
  pairB.visible = false;
  partner.add(pairA, pairB);
  // the two meshes, built between frames (about 0.1 to 0.3 s of work each)
  const JOBS = [
    { gen: L.nets(mainF, organCol, [-1.0, -0.9, -0.52], [1.0, 0.66, 0.5], 80), done: r => { organMesh.geometry.dispose(); organMesh.geometry = pairA.geometry = objGeo(r.pos, r.nrm, r.col, r.idx); } },
    { gen: L.nets(wedgeF, organCol, [XC - 0.04, -0.62, -0.04], [1.0, 0.66, 0.5], 56), done: r => { wedgeMesh.geometry.dispose(); wedgeMesh.geometry = pairB.geometry = objGeo(r.pos, r.nrm, r.col, r.idx); wedgeMesh.visible = pairB.visible = true; } },
  ];
  let built = false;
  function step(ms) {
    if (built) return true;
    const until = performance.now() + ms;
    while (JOBS.length) {
      const j = JOBS[0], r = j.gen.next();
      if (r.done) { j.done(r.value); JOBS.shift(); continue; }
      if (performance.now() > until) return false;
    }
    built = true;
    return true;
  }

  // ------------------------------------------------------------- the follicles, scars, vessels (merged, by age)
  const S0 = L.builder(), G0 = L.builder(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3();
  const at = (x, y, z, s = [1, 1, 1], q = null) => M4.compose(V.set(x, y, z), q || Q.identity(), SC.set(s[0], s[1], s[2])).clone();
  const FOL = KI.follicle, ALB = KI.albicans, VES = KI.vessel, LUTK = 5;
  const SPH = [0, 1, 2].map(d => L.sphere(1, d));   // (unit spheres, placed and sized by matrix)
  // a tube along a smooth curve through pts, its radius tapering from r0 to r1 (frames about +z: the curves lie nearly
  // in the face)
  function ptube(pts, r0, r1, n, radial = 8) {
    const cu = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q))), P = cu.getPoints(n), up = new THREE.Vector3(0, 0, 1);
    const pos = [], nrm = [], idx = [], t = new THREE.Vector3(), b = new THREE.Vector3(), nn = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      t.subVectors(P[Math.min(n, i + 1)], P[Math.max(0, i - 1)]).normalize();
      b.crossVectors(t, up).normalize(); nn.crossVectors(b, t);
      const r = r0 + (r1 - r0) * i / n;
      for (let j = 0; j <= radial; j++) { const a = j / radial * 6.2832; d.copy(b).multiplyScalar(Math.cos(a)).addScaledVector(nn, Math.sin(a)); pos.push(P[i].x + d.x * r, P[i].y + d.y * r, P[i].z + d.z * r); nrm.push(d.x, d.y, d.z); }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, c = a + radial + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
    return g;
  }
  // antral follicles: the mound of granulosa cells (cumulus) on the cavity wall, the oocyte on it in its pale zona, the
  // antrum's fluid (a glassy lens filling the cavity)
  const OOC = [];
  for (const s of ANT) {
    const ph = rr(0, 6.283), dir = new THREE.Vector3(Math.cos(ph) * 0.62, Math.sin(ph) * 0.62, -0.5).normalize();
    const cu = [s.x + dir.x * s.r * 0.86, s.y + dir.y * s.r * 0.86, dir.z * s.r * 0.86], oc = [s.x + dir.x * s.r * 0.6, s.y + dir.y * s.r * 0.6, dir.z * s.r * 0.6];
    const obj = [-99, s.until, FOL, 0];
    const k3 = k => [s.r * k, s.r * k, s.r * k];
    S0.add(SPH[2], { m: at(...cu, k3(0.3)), col: C.granulosa, cen: [s.x, s.y, 0], obj });
    S0.add(SPH[2], { m: at(...oc, k3(0.12)), col: C.oocyte, cen: [s.x, s.y, 0], obj });
    S0.add(SPH[1], { m: at(oc[0] + 0.01 * s.r, oc[1] + 0.02 * s.r, oc[2] + s.r * 0.09, k3(0.045)), col: C.nucleus, cen: [s.x, s.y, 0], obj });
    G0.add(SPH[2], { m: at(...oc, k3(0.17)), col: C.zona, cen: [s.x, s.y, 0], obj });
    // (the fluid's surface, a little below the face: glossy, see-through)
    G0.add(new THREE.CircleGeometry(s.r * 0.985, 36), { m: at(s.x, s.y, -0.012), col: C.fluid, cen: [s.x, s.y, 0], obj });
    OOC.push(oc);
  }
  // growing follicles cut across: a dome of granulosa cells with the oocyte showing at its top
  for (const [list, kz] of [[SEC, 0.62], [PRI, 0.5]]) for (const s of list) {
    const obj = [-99, s.until, FOL, 0];
    S0.add(SPH[1], { m: at(s.x, s.y, 0, [s.r, s.r, s.r * kz]), col: tint(C.granulosa, 0.95 + 0.1 * R()), obj });
    S0.add(SPH[1], { m: at(s.x, s.y, s.r * kz * 0.62, [s.r * 0.42, s.r * 0.42, s.r * 0.3]), col: C.oocyte, cen: [s.x, s.y, 0], obj });
  }
  // the corpus luteum (golden, folded; gone by about 50) and the corpora albicantia (pale scars, more with age)
  if (LUT) S0.add(L.blob(LUT.r, 0.05, 0.05, { seed: 3, waves: 0.12, wrinkle: 0.28, rings: 9, segs: 56 }), { m: at(LUT.x, LUT.y, 0), col: (x, y, z) => mix(C.luteum, [0.86, 0.52, 0.2], clamp(0.3 + 0.7 * n2(x * 30, y * 30, z * 30), 0, 1)), cen: [LUT.x, LUT.y, 0], obj: [-99, 50, LUTK, 0] });
  for (const s of SCAR) S0.add(L.blob(s.r, Math.min(0.018, s.r * 0.25), 0.03, { seed: 20 + Math.floor(R() * 1000), waves: 0.3, wrinkle: 0.18, rings: 5, segs: 30 }), { m: at(s.x, s.y, 0, [1, 1, 1], Q.setFromAxisAngle(V.set(0, 0, 1), rr(0, 6.28)).clone()), col: (x, y, z) => mix(C.albicans, [0.86, 0.74, 0.86], clamp(0.5 + 0.8 * n2(x * 40, y * 40, z * 40), 0, 1)), cen: [s.x, s.y, 0], obj: [s.from, 999, ALB, 0] });
  // on the intact part: scars puckering the surface, follicles bulging it (blisters)
  const onSurface = (u, v) => {   // a point of the surface by two angles, and its outward normal
    const p = [A * Math.cos(v) * Math.cos(u), B * Math.sin(v) + bend(A * Math.cos(v) * Math.cos(u)), CZ * Math.cos(v) * Math.sin(u)];
    const n = new THREE.Vector3(p[0] / (A * A), (p[1] - bend(p[0])) / (B * B), p[2] / (CZ * CZ)).normalize();
    return { p, n };
  };
  const SURF = [], BLIS = [];
  for (let t = 0; t < 400 && (SURF.length < 6 || BLIS.length < 4); t++) {
    const u = rr(Math.PI * 0.55, Math.PI * 0.95), v = rr(-0.75, 0.85), { p, n } = onSurface(u, v);
    if (p[0] > XC - 0.08 || p[2] < 0.06) continue;
    const r = BLIS.length < 4 ? rr(0.08, 0.12) : rr(0.04, 0.07);
    if ([...SURF, ...BLIS].some(o => Math.hypot(o.p[0] - p[0], o.p[1] - p[1], o.p[2] - p[2]) < o.r + r + 0.03)) continue;
    (BLIS.length < 4 ? BLIS : SURF).push({ p, n, r });
  }
  falls(BLIS, 'follicle');
  { const o = order(SURF.length); SURF.forEach((s, i) => { s.from = T.crossing('albicans', (o[i] + 0.5) / SURF.length, true); }); }
  const up = new THREE.Vector3(0, 0, 1);
  for (const s of SURF) {
    const q = new THREE.Quaternion().setFromUnitVectors(up, s.n), c = [s.p[0] - s.n.x * 0.012, s.p[1] - s.n.y * 0.012, s.p[2] - s.n.z * 0.012];
    S0.add(L.blob(s.r, 0.02, 0.03, { seed: 300 + Math.floor(R() * 1000), waves: 0.3, wrinkle: 0.4, rings: 5, segs: 30 }), { m: at(...c, [1, 1, 1], q), col: C.albicans, cen: c, obj: [s.from, 999, ALB, 0] });
  }
  for (const s of BLIS) {
    const c = [s.p[0] - s.n.x * s.r * 0.55, s.p[1] - s.n.y * s.r * 0.55, s.p[2] - s.n.z * s.r * 0.55];
    S0.add(SPH[2], { m: at(...c, [s.r, s.r, s.r]), col: [0.96, 0.82, 0.86], cen: c, obj: [-99, s.until, FOL, 0] });
  }
  // the blood vessels: coiled arteries and veins in relief on the face, from the hilum up through the medulla (and out
  // through the hilum below), and vessels cut across (a wall round a dark lumen), some of them gone with age
  const VPATH = [];
  const inMed = (x, y) => depth(x, y) > cortexD(x, y) + 0.03;
  const medPick = () => { for (let t = 0; t < 400; t++) { const x = rr(XC + 0.08, 0.86), y = rr(-0.4, 0.55); if (inMed(x, y)) return [x, y]; } return [0.3, 0.1]; };
  // a coiled path from a to b (helicine arteries coil tightly, veins gently), bending a little to one side
  function vpath(a, b, art, bendK) {
    const pts = [], n = 18, dx = b[0] - a[0], dy = b[1] - a[1], ln = Math.hypot(dx, dy) || 1, px = -dy / ln, py = dx / ln;
    for (let k = 0; k <= n; k++) {
      const t = k / n, w = (art ? 0.009 : 0.005) * Math.sin(t * ln * (art ? 120 : 60) + bendK * 7), bo = bendK * ln * 0.25 * Math.sin(Math.PI * t);
      pts.push([a[0] + dx * t + px * (w + bo), a[1] + dy * t + py * (w + bo), -0.005]);
    }
    return pts;
  }
  for (let i = 0; i < 6; i++) {
    const art = i % 2 === 0, st = [HIL[0] - 0.1 + 0.2 * (i + 0.5) / 6, HIL[1] + 0.07];
    const tip = medPick(), bk = rr(-1, 1), trunk = vpath(st, tip, art, bk);
    // (and out through the hilum below)
    const out = [[st[0] + 0.03, st[1] - 0.16, -0.07], [st[0] + 0.06, st[1] - 0.36, -0.15]].reverse();
    const r0 = art ? 0.015 : 0.018;
    S0.add(ptube(out.concat(trunk), r0, r0 * 0.5, 80), { col: art ? C.artery : C.vein, obj: [-99, 999, VES, 0] });
    VPATH.push(trunk[Math.floor(trunk.length * 0.5)]);
    // two branches from along the trunk
    for (const f of [0.4, 0.7]) {
      const b0 = trunk[Math.floor(trunk.length * f)], to = medPick();
      if (Math.hypot(to[0] - b0[0], to[1] - b0[1]) > 0.5) continue;
      S0.add(ptube(vpath(b0, to, art, rr(-1, 1)), r0 * 0.6, r0 * 0.3, 40, 6), { col: art ? C.artery : C.vein, obj: [-99, 999, VES, 0] });
    }
  }
  for (const s of VX) {
    const q = Q.setFromAxisAngle(V.set(0, 0, 1), rr(0, 3.14)).clone(), e = rr(1, 1.5), obj = [-99, s.until, VES, 0];
    S0.add(L.ring(0.55, 1, 0.35, 0.3, 24), { m: at(s.x, s.y, 0.002, [s.r * e, s.r, s.r], q), col: R() < 0.5 ? C.artery : tint(C.vein, 1.25), cen: [s.x, s.y, 0], obj });
    S0.add(new THREE.CircleGeometry(0.56, 20), { m: at(s.x, s.y, 0.0035, [s.r * e, s.r, 1], q), col: [0.32, 0.08, 0.12], cen: [s.x, s.y, 0], obj });
  }
  // the theca round each cut antral follicle: a darker ring on the face that fades as its follicle goes
  const F0 = L.builder();
  for (const s of ANT) F0.add(new THREE.RingGeometry(s.r, s.r + 0.034, 48, 1), { m: at(s.x, s.y, 0.0007), col: C.theca, cen: [s.x, s.y, 0], obj: [-99, s.until, FOL, 1] });
  const thecaMat = L.objMat(set, { gloss: 0.05, alpha: 0.8, depthWrite: false, polygonOffset: -1, uniforms: { uAge: ages } });
  const thecaMesh = new THREE.Mesh(F0.geometry(), thecaMat);
  thecaMesh.renderOrder = 1;
  ovary.add(thecaMesh);
  const solidMesh = new THREE.Mesh(S0.geometry(), solidMat), glassMesh = new THREE.Mesh(G0.geometry(), glassMat);
  glassMesh.renderOrder = 2;
  ovary.add(solidMesh, glassMesh);

  // the floor of each cut antral follicle: as the follicle goes it rises (and widens to fit the cavity) until it is
  // flush with the face, in the cortex's color: the cavity closes into stroma
  const plugGeo = (() => {
    const P = [], Cl = [], Ce = [], O = [], segs = 32, rings = 4;
    for (const s of ANT) {
      const ring = [];
      for (let i = 0; i <= rings; i++) for (let j = 0; j < segs; j++) { const q = i / rings, a = j / segs * 6.2832; ring.push([q * Math.cos(a), q * Math.sin(a)]); }
      const id = (i, j) => i * segs + (j % segs), tri = [];
      for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) tri.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1));
      for (const k of tri) {
        const [u, v] = ring[k];
        P.push(u, v, 0); const c = faceCol(s.x + u * (s.r + 0.03), s.y + v * (s.r + 0.03), 0); Cl.push(...c); Ce.push(s.x, s.y, 0); O.push(-99, s.until, FOL, s.r);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(Cl, 3));
    g.setAttribute('aCen', new THREE.Float32BufferAttribute(Ce, 3)); g.setAttribute('aObj', new THREE.Float32BufferAttribute(O, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.3, 0, 0), 1.2);
    return g;
  })();
  const plugMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uAge: ages, uDim: organMat.uniforms.uDim },
    transparent: true,
    vertexShader: `
attribute vec3 aCol, aCen; attribute vec4 aObj;
uniform float uAge, uDim;
varying vec3 vN, vV, vC, vUp;
void main() {
  float vis = 1.0 - smoothstep(aObj.y - 1.5, aObj.y + 1.5, uAge), r = aObj.w;
  float d = r * vis, rp = sqrt(max(r * r - d * d, 0.0)) + 0.03;
  vec3 p = aCen + vec3(position.xy * rp, 0.0012 - d);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * vec3(0.0, 0.0, 1.0)); vV = -mv.xyz; vUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vC = aCol * (1.0 - uDim);
  gl_Position = projectionMatrix * mv;
  if (vis > 0.995) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: L.LIT + `
uniform float uA;
varying vec3 vN, vV, vC, vUp;
void main() { gl_FragColor = vec4(litC(vC, normalize(vN), normalize(vV), normalize(vUp), 0.1), uA); }`,
  });
  set.mats.push(plugMat);
  ovary.add(new THREE.Mesh(plugGeo, plugMat));
  // primordial follicles: specks in a band just under the surface, the resting reserve
  const SPK = [];   // (sizes exaggerated: real ones are about 0.04 mm)
  for (let t = 0; t < 20000 && SPK.length < 900; t++) {
    const x = rr(XC + 0.02, 0.94), y = rr(-0.56, 0.64), e = ell(x, y, 0);
    if (e > -0.02 || e < -0.11) continue;
    const d = depth(x, y);
    if (d < 0.03 || d > 0.08 + 0.02 * n3(x * 5, y * 5, 1) || nearHilum(x, y, 0) || !free(x, y, 0.008, 0)) continue;
    SPK.push([x, y]);
  }
  const spG = K.pointsGeo(SPK.length), spP = spG.attributes.position.array, spC = spG.attributes.aCol.array, spS = spG.attributes.aSize.array, spU = new Float32Array(SPK.length);
  { const o = order(SPK.length); SPK.forEach(([x, y], i) => { spP.set([x, y, 0.004], 3 * i); spC.set(mix(C.oocyte, [1, 0.9, 0.95], 0.4), 3 * i); spS[i] = rr(0.012, 0.018); spU[i] = T.crossing('follicle', (o[i] + 0.5) / SPK.length, false); }); }
  spG.setAttribute('aU', new THREE.BufferAttribute(spU, 1));
  const spMat = K.points(set, { hard: true, additive: false, uniforms: { uAge: ages, uS: { value: 1 }, uHiF: { value: 0 }, uHiC: { value: new THREE.Vector3(...L.GLOW[FOL]) } },
    head: 'attribute float aU; uniform float uAge, uS, uHiF; uniform vec3 uHiC;',
    vertex: 'gl_PointSize = pointPx(aSize * uS, mv); vA *= 1.0 - smoothstep(aU - 1.5, aU + 1.5, uAge); vC = mix(vC, uHiC, uHiF);' });
  const specks = new THREE.Points(spG, spMat);
  ovary.add(specks);

  // ------------------------------------------------------------- the pelvis (in the body: the uterus, the tubes)
  // in the body set's frame: the body faces +z, the person's left is +x; the ovaries at x = +-0.06, y = -0.06
  const BODY_AT = [-0.06, -0.06, 0.0], BODY_S = 0.028, BODY_ROT = 1.0;
  const P0 = L.builder();
  {
    const prof = [[0.001, -0.125], [0.008, -0.118], [0.011, -0.1], [0.016, -0.08], [0.024, -0.058], [0.026, -0.045], [0.022, -0.036], [0.012, -0.031], [0.001, -0.03]].map(([x, y]) => new THREE.Vector2(x, y));
    const ut = new THREE.LatheGeometry(prof, 24);
    ut.scale(1.2, 1, 0.7);
    P0.add(ut, { m: at(0, 0, 0.02), col: [0.84, 0.48, 0.54] });
    for (const sx of [-1, 1]) {
      const tube = K.tube([[sx * 0.02, -0.04, 0.02], [sx * 0.036, -0.036, 0.022], [sx * 0.052, -0.042, 0.016], [sx * 0.064, -0.05, 0.006], [sx * 0.07, -0.062, 0.0]], 0.0028, 30, 6, false);
      P0.add(tube, { col: [0.9, 0.6, 0.66] });
      // its fringed end (fimbriae) over the ovary
      for (let k = 0; k < 6; k++) P0.add(SPH[0], { m: at(sx * (0.068 + 0.004 * Math.cos(k)), -0.064 + 0.004 * Math.sin(k * 2), 0.002 * k, [0.003, 0.003, 0.003]), col: [0.92, 0.66, 0.7] });
    }
  }
  const pelvis = new THREE.Mesh(P0.geometry(), pelvisMat);
  set.group.add(pelvis);
  partner.position.set(-BODY_AT[0], BODY_AT[1], BODY_AT[2]); partner.scale.setScalar(BODY_S); partner.rotation.z = BODY_ROT;

  // ------------------------------------------------------------- anchors (in the set's frame, following the ovary)
  const tmp = new THREE.Vector3();
  const W = p => { tmp.set(p[0], p[1], p[2]); ovary.updateMatrix(); tmp.applyMatrix4(ovary.matrix); return [tmp.x, tmp.y, tmp.z]; };
  const big = ANT[0], scar0 = SCAR.reduce((a, s) => (s.from < a.from ? s : a), SCAR[0]);
  // (the cortex label towards the right-hand end, clear of the follicle's)
  const cortexPt = (() => { for (let x = 0.9; x > 0.4; x -= 0.01) for (const y of [0.05, -0.05, 0.12, -0.12, 0.2]) { const d = depth(x, y); if (d > 0.07 && d < 0.13 && free(x, y, 0.02, 0)) return [x, y, 0.01]; } return [0.75, 0.05, 0.01]; })();
  const medPt = (() => { let best = [0.3, -0.1, 0.01], bd = 0; for (let x = 0; x < 0.6; x += 0.03) for (let y = -0.3; y < 0.3; y += 0.03) { const d = depth(x, y); if (d > bd && free(x, y, 0.02, 0)) { bd = d; best = [x, y, 0.01]; } } return best; })();
  const spk0 = SPK.reduce((a, p) => (p[1] > a[1] ? p : a), SPK[0] || [0.4, 0.5]);
  const sec0 = SEC.reduce((a, s) => (s.until > a.until ? s : a), SEC[0]);
  const anchors = {
    cortex: () => W(cortexPt), medulla: () => W(medPt), follicle: () => W([big.x, big.y, 0]), oocyte: () => W(OOC[0]),
    primordial: () => W([spk0[0], spk0[1], 0.005]), secondary: () => W([sec0.x, sec0.y, sec0.r * 0.6]),
    luteum: () => W(LUT ? [LUT.x, LUT.y, 0.05] : [0.3, 0.3, 0]), albicans: () => W([scar0.x, scar0.y, 0.03]),
    vessel: () => W(VPATH[0] || medPt), hilum: () => W([HIL[0] + 0.04, HIL[1] - 0.3, -0.12]),
    surface: () => W(SURF[0] ? SURF[0].p : [-0.7, 0.2, 0.25]), blister: () => W(BLIS[0] ? BLIS[0].p : [-0.6, 0.3, 0.3]),
    top: () => W([0.1, 0.7, 0]), age: () => W([0.0, 0.78, 0.1]),
    small: () => { ovary.updateMatrix(); return [ovary.position.x, ovary.position.y, ovary.position.z]; },
    pelvis: [0, -0.07, 0.02],
  };
  let ageNow = 30, gNow = 1;
  const visOf = (from, until) => prog(ageNow, from - 1.5, from + 1.5) * (1 - prog(ageNow, until - 1.5, until + 1.5));

  // ------------------------------------------------------------- update
  const hi = [0, 0, 0, 0, 0, 0];
  function update(S, t, dt) {
    if (!built) step(4);
    const g = smooth(clamp(S.organ_grow, 0, 1)), age = clamp(S.organ_age, 20, 70), open = smooth(clamp(S.organ_open, 0, 1)), body = clamp(S.organ_body, 0, 1);
    ageNow = age; gNow = g; ages.value = age;
    // from small in the body (turned as it lies there) to large at the centre; the ovary shrinks with age
    const shrink = 1 - 0.16 * smooth((age - 45) / 23), side = smooth(clamp(S.organ_side, 0, 1));
    // (side: to the left, smaller, to make room for the charts beside it)
    ovary.position.set(lerp(BODY_AT[0], -0.66 * side, g), lerp(BODY_AT[1], 0.02 * side, g), lerp(BODY_AT[2], 0, g));
    ovary.scale.setScalar(Math.exp(lerp(Math.log(BODY_S), 0, g)) * shrink * (1 - 0.45 * side));
    ovary.rotation.set(0, 0, BODY_ROT * (1 - g));
    // the front wedge of the cut lifts away and fades
    wedge.position.set(0.5 * open, 0.4 * open, 0.5 * open);
    wedge.rotation.set(-0.45 * open, 0.55 * open, 0);
    wedgeMat.uniforms.uFade.value = 1 - prog(open, 0.45, 0.95);
    wedge.visible = open < 0.95;
    // the pelvis and the other ovary while it is small in the body
    const pa = body * (1 - prog(g, 0, 0.3));
    pelvisMat.uniforms.uFade.value = pairMat.uniforms.uFade.value = pa;
    pelvis.visible = partner.visible = pa > 0.01;
    // picked out: follicles, scars, vessels, the corpus luteum (the poster's colors), the rest dims
    hi[VES] = clamp(S.organ_vessel, 0, 1); hi[ALB] = clamp(S.organ_albicans, 0, 1); hi[FOL] = clamp(S.organ_follicle, 0, 1); hi[LUTK] = clamp(S.organ_luteum, 0, 1);
    const dim = 0.45 * Math.max(...hi);
    for (const m of [solidMat, glassMat, organMat, wedgeMat, thecaMat]) L.setHi(m, hi, dim);
    spMat.uniforms.uHiF.value = hi[FOL]; spMat.uniforms.uS.value = ovary.scale.x;
  }

  return Object.assign(set, {
    params: { organ_a: 1, organ_grow: 1, organ_body: 0, organ_open: 1, organ_age: 30, organ_side: 0, organ_follicle: 0, organ_albicans: 0, organ_vessel: 0, organ_luteum: 0, organ_parts: 0, organ_agelab: 0 },
    update,
    idle() { step(3); },
    finish() { step(Infinity); },
    built: () => built,
    anchors,
    labels: [
      { text: ['Cortex', 'where the follicles are'], at: 'cortex', cls: 'mag', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) },
      { text: ['Medulla', 'vessels, loose tissue'], at: 'medulla', cls: 'cyn', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) },
      { text: ['Follicle', 'fluid-filled'], at: 'follicle', cls: '', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) * visOf(-99, big.until) },
      { text: ['Primordial follicles', 'the reserve'], at: 'primordial', cls: 'amb', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) * (1 - prog(S.organ_age, 45, 55)) },
      { text: ['Corpus albicans', 'a pale scar'], at: 'albicans', cls: 'grn', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) * visOf(scar0.from, 999) },
      { text: ['Corpus luteum', ''], at: 'luteum', cls: 'amb', alpha: S => S.organ_parts * prog(S.organ_grow, 0.85, 1) * prog(S.organ_open, 0.7, 1) * visOf(-99, 50) },
      { text: () => ['Age', `${Math.round(ageNow)} years`], at: 'age', cls: 'cyn', alpha: S => S.organ_agelab * prog(S.organ_grow, 0.85, 1) },
    ],
    cam: {
      default: [24, 14, 3.5, 0.08, 0, 0], face: [4, 4, 2.6, 0.3, 0.02, 0], cortex: [10, 10, 1.15, big.x, big.y, 0],
      medulla: [6, 6, 1.25, medPt[0], medPt[1], 0], whole: [-58, 16, 3.3, -0.1, 0.02, 0], open: [38, 22, 3.6, 0.15, 0.05, 0.2],
      pelvis: [0, 6, 0.62, 0, -0.07, 0.02], body: [0, 4, 3.6, 0, 0, 0],
    },
    controls: [
      { key: 'view', label: 'View', options: [['cut', 'Cut open'], ['closed', 'Closed'], ['body', 'In the body']] },
      { key: 'age', label: 'Age', options: [['20', '20'], ['30', '30'], ['40', '40'], ['50', '50'], ['60', '60'], ['70', '70']] },
      { key: 'show', label: 'Show', options: [['none', 'All'], ['follicle', 'Follicles'], ['albicans', 'Scars'], ['vessel', 'Vessels']] },
    ],
    explore(c) {
      const v = c.view || 'cut', s = c.show || 'none';
      return {
        organ_grow: v === 'body' ? 0 : 1, organ_body: v === 'body' ? 1 : 0, organ_open: v === 'cut' ? 1 : 0, organ_age: +(c.age || 30),
        organ_follicle: s === 'follicle' ? 1 : 0, organ_albicans: s === 'albicans' ? 1 : 0, organ_vessel: s === 'vessel' ? 1 : 0, organ_luteum: 0,
        organ_parts: v === 'cut' && s === 'none' ? 1 : 0, organ_agelab: v === 'body' ? 0 : 1,
      };
    },
    // the counts on the ovary at an age (what the model shows; for the engine's readouts)
    shown(age) {
      const on = (from, until) => (age >= from && age < until ? 1 : 0);
      return {
        antral: ANT.reduce((s, a) => s + on(-99, a.until), 0), growing: SEC.concat(PRI).reduce((s, a) => s + on(-99, a.until), 0),
        primordial: SPK.length ? spU.reduce((s, u) => s + on(-99, u), 0) : 0, scars: SCAR.concat(SURF).reduce((s, a) => s + on(a.from, 999), 0),
        vessels: VX.reduce((s, a) => s + on(-99, a.until), 0), luteum: on(-99, 50),
      };
    },
  });
};
