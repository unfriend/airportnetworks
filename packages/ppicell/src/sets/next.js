// What it would take (chapter 8), over the cell (its frame and shapes): proximity maps (next_halo: baits in their places,
// each with a halo of tagged neighbours), a cryo-electron tomogram (next_slab: a thin slab through the cell, packed with
// molecules as the cytoplasm is, sharp), a whole-cell volume (next_vol: the cell filled with small cubes of what is where). Illustrative: what
// such data look like, not data. Then the cell's own honest picture takes over (the story fades these out).
// The tomogram's slab (chapter 8) packed with molecules: real proteins as balls, the crowd's kinds in the crowd's shares,
// the largest 0.045 across, packed as densely as the crowd's cube (chapter 2), none overlapping, up to about 42,000 balls
// (as many as the cube's); in the nucleus violet, else blue or amber. Each molecule's reach a sphere, kept apart on a
// grid; done a slice a load step (SETS.next.prep), so no step runs long.
const SLAB = (() => {
  const SW = [1.5, 1.1, 0.05], SZ = 0.18, BMAX = 42000, KS = CROWD.KINDS;
  const rnd = (s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(61);
  const pick = () => { let x = rnd(); for (const k of KS) { x -= k.share; if (x < 0) return k.key; } return KS[KS.length - 1].key; };
  const P = { done: false, mols: [], nb: 0, miss: 0, i: 0, grid: new Map(), SB: null };
  const gk = (x, y, z) => x + 4096 * (y + 4096 * z);
  function pack(ms) {
    const t0 = performance.now(), CELL = GL.sets.cell.api().CELL;
    if (!P.SB) {
      const PS = 0.045 / Math.max(...KS.map(k => 2 * BALLS.reach(BALLS.of(k.key, 1))));
      P.SB = {}; for (const k of KS) { const b = BALLS.of(k.key, PS); P.SB[k.key] = { b, rr: BALLS.reach(b) }; }
      P.GC = 2 * Math.max(...KS.map(k => P.SB[k.key].rr)) * 1.15;
    }
    const gi = v => Math.floor((v + 2) / P.GC), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    while (!P.done && performance.now() - t0 < ms) {
      for (let n = 0; n < 200; n++) {
        if (P.nb >= BMAX || P.miss > 3000 || P.i++ > 200000) { P.done = true; break; }
        const key = pick(), q = 0.85 + 0.3 * rnd(), rr = P.SB[key].rr * q, zr = Math.max(0, SW[2] / 2 - rr * 0.6);
        const p = [0.1 + (rnd() - 0.5) * SW[0], (rnd() - 0.5) * SW[1], SZ + (rnd() * 2 - 1) * zr];
        if (CELL.eScale(p) >= 0.92) { P.miss++; continue; }
        const cx = gi(p[0]), cy = gi(p[1]), cz = gi(p[2]);
        let ok = true;
        for (let dx = -1; dx <= 1 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) for (let dz = -1; dz <= 1 && ok; dz++) {
          for (const o of P.grid.get(gk(cx + dx, cy + dy, cz + dz)) || []) if (d(o.p, p) < 0.9 * (o.rr + rr)) { ok = false; break; }
        }
        if (!ok) { P.miss++; continue; }
        P.miss = 0;
        const balls = P.SB[key].b.map(b => b.map(x => x * q)), c = rnd();
        const m = { p, balls, rr, e: [rnd() * 6, rnd() * 6, rnd() * 6], c: d(p, CELL.nuc.c) < CELL.nuc.r ? [0.75, 0.62, 1.0] : c < 0.3 ? [1.0, 0.8, 0.4] : [0.6, 0.85, 1.0] };
        P.mols.push(m); P.nb += balls.length;
        const g = gk(cx, cy, cz); if (!P.grid.has(g)) P.grid.set(g, []); P.grid.get(g).push(m);
      }
    }
    if (P.done) P.grid = null;
    return P.done;
  }
  return { SW, SZ, P, pack };
})();

SETS.next = function (K) {
  const { THREE, clamp, v3 } = K;
  const set = K.newSet('next');
  const CELL = GL.sets.cell.api().CELL, r = K.rng(61);
  const inCyto = p => CELL.eScale(p) < 0.88 && v3.dist(p, CELL.nuc.c) > CELL.nuc.r + 0.08;
  const randIn = ok => { for (;;) { const p = [(r() * 2 - 1) * CELL.pm[0], (r() * 2 - 1) * CELL.pm[1], (r() * 2 - 1) * CELL.pm[2]]; if (ok(p)) return p; } };
  // ------------------------------------------------------------ halos: baits and their tagged neighbours
  const NH = 9, NT = 14, baits = [];
  for (let i = 0; i < NH; i++) baits.push(i < 3 ? v3.add(CELL.nuc.c, v3.mul(K.unit(r), CELL.nuc.r * 0.6 * Math.cbrt(r()))) : randIn(inCyto));
  const haloMat = K.rim(set, { color: [0.4, 1.0, 0.7], a0: 0.05, a1: 0.55 });
  const halos = baits.map(p => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), haloMat); m.position.set(...p); set.group.add(m); return m; });
  // (each bait a real protein, white, and round it its neighbours, real proteins tagged green: the crowd's kinds as balls,
  // BALLS, none overlapping; they grow out of the bait with its halo)
  const KS = CROWD.KINDS, pick = () => { let x = r(); for (const k of KS) { x -= k.share; if (x < 0) return k.key; } return KS[KS.length - 1].key; };
  const PH = 0.032 / Math.max(...KS.map(k => 2 * BALLS.reach(BALLS.of(k.key, 1))));   // (the largest 0.032 across)
  const hMols = [], hOff = [], hQ = [];
  baits.forEach(() => {
    const kinds = ['gapdh', ...Array.from({ length: NT }, pick)], B = kinds.map(k => BALLS.of(k, PH)), R = B.map(BALLS.reach);
    const off = BALLS.scatter(R.slice(1), () => v3.mul(K.unit(r), 0.028 + 0.034 * Math.cbrt(r())), 0.95, 80, [{ p: [0, 0, 0], r: R[0] }]);
    B.forEach((balls, j) => { hMols.push({ balls, c: j ? [0.4, 1.0, 0.7] : [0.95, 0.95, 0.95] }); hOff.push(j ? off[j - 1] : [0, 0, 0]); hQ.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.3, r() * 6.3, r() * 6.3))); });
  });
  const hc = BALLS.cloud(set, hMols); set.group.add(hc.points);
  // ------------------------------------------------------------ a slab: a tomogram's thin slice, its molecules sharp
  const { SW, SZ } = SLAB;
  const slabMat = K.fade(set, new THREE.MeshBasicMaterial({ color: 0x8fb8e8, depthWrite: false }), 0.12);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(...SW), slabMat); slab.position.set(0.1, 0, SZ); set.group.add(slab);
  const slabEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...SW)), K.fade(set, new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true }), 0.6));
  slabEdge.position.copy(slab.position); set.group.add(slabEdge);
  // (its molecules: SLAB's packing, done before the set is built)
  const sMols = SLAB.P.mols;
  const sc = BALLS.cloud(set, sMols, { own: true }); set.group.add(sc.points);
  sMols.forEach((o, i) => sc.place(i, o.p, new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.e))));
  // ------------------------------------------------------------ a volume: the whole cell in small cubes
  const VS = 0.07, cells = [];
  for (let x = -1; x <= 1; x += VS) for (let y = -1; y <= 1; y += VS) for (let z = -1; z <= 1; z += VS) {
    const p = [x, y, z];
    if (CELL.eScale(p) < 0.97) cells.push({ p, n: v3.dist(p, CELL.nuc.c) < CELL.nuc.r });
  }
  const vg = K.pointsGeo(cells.length);
  cells.forEach((o, i) => { vg.attributes.position.array.set(o.p, 3 * i); vg.attributes.aCol.array.set(o.n ? [0.6, 0.45, 1.0] : [0.3, 0.55, 0.9], 3 * i); vg.attributes.aSize.array[i] = 0.05; });
  const volMat = K.points(set, { hard: true, additive: true });
  const vol = new THREE.Points(vg, volMat); set.group.add(vol);
  const VA = vg.attributes.aA.array, vr = cells.map(() => r());
  return Object.assign(set, {
    params: { next_a: 1, next_halo: 0, next_slab: 0, next_vol: 0 },
    update(S, t) {
      const h = clamp(S.next_halo, 0, 1), s = clamp(S.next_slab, 0, 1), v = clamp(S.next_vol, 0, 1);
      halos.forEach((m, i) => { const g = K.smooth(clamp(h * 1.5 - i / NH * 0.5, 0, 1)); m.scale.setScalar(Math.max(0.01, g)); m.visible = g > 0.01; });
      hc.points.visible = h > 0.01;
      if (hc.points.visible) {
        baits.forEach((p, i) => { const g = K.smooth(clamp(h * 1.5 - i / NH * 0.5, 0, 1)); for (let j = 0; j <= NT; j++) { const k = i * (NT + 1) + j; hc.place(k, v3.add(p, v3.mul(hOff[k], g)), hQ[k], g); } });
        hc.tick(t);
      }
      slab.visible = slabEdge.visible = sc.points.visible = s > 0.01;
      slab.scale.set(1, Math.max(0.01, s), 1); slabEdge.scale.copy(slab.scale);
      sc.U.uA.value = set.uA.value * clamp(s * 1.5 - 0.3, 0, 1); sc.tick(t);
      slabMat.opacity *= s;
      vol.visible = v > 0.01;
      if (vol.visible) { for (let i = 0; i < VA.length; i++) VA[i] = 0.12 * clamp(v * 1.4 - vr[i] * 0.4, 0, 1); vg.attributes.aA.needsUpdate = true; }
    },
    anchors: { halo: () => v3.add(baits[3], [0, 0.1, 0]), slab: [0.1 + SW[0] * 0.5, SW[1] * 0.45, SZ], vol: [0, CELL.pm[1] * 1.02, 0], nucleus: CELL.nuc.c },
    labels: [],
    stats: () => ({ slab: sMols.length, balls: sc.balls }),
    cam: { default: [20, 14, 3.6, 0, 0, 0], slab: [8, 8, 2.6, 0.1, 0, SZ], high: [30, 32, 3.8, 0, 0, 0] },
  });
};
SETS.next.prep = ms => SLAB.pack(ms || 25);
