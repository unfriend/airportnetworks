// What it would take (chapter 8), over the cell (its frame and shapes): proximity maps (next_halo: baits in their places,
// each with a halo of tagged neighbours), a cryo-electron tomogram (next_slab: a thin slab through the cell, packed with
// molecules as the cytoplasm is, sharp), a whole-cell volume (next_vol: the cell filled with small cubes of what is where). Illustrative: what
// such data look like, not data. Then the cell's own honest picture takes over (the story fades these out).
// The tomogram's slab (chapter 8) packed with molecules: real proteins as balls, the crowd's kinds in the crowd's shares,
// the largest 0.045 across, packed as densely as the crowd's cube (chapter 2), none overlapping, up to about 42,000 balls
// (as many as the cube's). The slab is a thin lamella through the cytosol beside the nucleus (the owner, 23 November
// 2026: it should clearly cut through the cytosol, a mitochondrion and a piece of the nuclear envelope in it, as a
// tomogram would): its plane through the middle of a mitochondrion (SLAB.pick: the one whose cut lies inside the slab and
// nearest the nucleus), reaching just past the nuclear envelope. The membranes it cuts (the envelope's two, the
// mitochondrion's two, any vesicle's one) are kept clear of molecules (SETS.next draws them); in the nucleus the
// molecules are violet, in the mitochondrion's matrix pink, in small vesicles none, else blue or amber. Each molecule's
// reach a sphere, kept apart on a grid; done a slice a load step (SETS.next.prep), so no step runs long.
const SLAB = (() => {
  const BMAX = 42000, KS = CROWD.KINDS, TH = 0.05;   // (TH: the slab's thickness)
  const rnd = (s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(61);
  const pick = () => { let x = rnd(); for (const k of KS) { x -= k.share; if (x < 0) return k.key; } return KS[KS.length - 1].key; };
  const P = { done: false, mols: [], nb: 0, miss: 0, i: 0, grid: new Map(), SB: null };
  const gk = (x, y, z) => x + 4096 * (y + 4096 * z);
  // the slab's place (SLAB.at: { c, w, h, z }) and the membranes in it (SLAB.shells: { c, q (a THREE.Quaternion), s
  // [a, b, b], inner }, a membrane each; double membranes as two), worked out once from the cell's shapes
  const at = {}, shells = [];
  function place() {
    if (at.c) return;
    const { v3, clamp } = K;
    const CELL = GL.sets.cell.api().CELL, N = CELL.nuc, X1 = new THREE.Vector3(1, 0, 0);
    // (the mitochondrion nearest the nucleus that is clear of it and level with it; the slab's plane through its middle)
    // (one lying across the slab, so it is cut along its length; on the near side of the nucleus first, z above its
    // middle, where the story's views look from)
    const gap = m => Math.hypot(m.c[0] - N.c[0], m.c[1] - N.c[1]) - N.r, fits = (m, near) => Math.abs(m.c[2] - N.c[2]) < N.r * 0.8 && (!near || m.c[2] > N.c[2]) && gap(m) > 0.08 && Math.abs(m.axis[2]) < 0.5;
    const nearest = near => CELL.mitos.filter(m => fits(m, near)).sort((x, y) => gap(x) - gap(y))[0];
    const best = { m: nearest(true) || nearest(false) };
    const m = best ? best.m : CELL.mitos[0], z = m.c[2];
    // (the slab round the nucleus's cut edge on the mitochondrion's side, just inside and outside it, and the whole
    // mitochondrion, with a margin; between 0.6 and 0.85 across)
    const rn = Math.sqrt(Math.max(0, N.r * N.r - (z - N.c[2]) ** 2)), ux = v3.norm([m.c[0] - N.c[0], m.c[1] - N.c[1], 0]);
    const pts = [v3.add(N.c, v3.mul(ux, rn - 0.1)), v3.add(N.c, v3.mul(ux, rn + 0.05)), v3.add(m.c, v3.mul(m.axis, m.a)), v3.sub(m.c, v3.mul(m.axis, m.a))];
    const lo = [0, 1].map(j => Math.min(...pts.map(p => p[j])) - 0.1), hi = [0, 1].map(j => Math.max(...pts.map(p => p[j])) + 0.1);
    const mid = [0, 1].map(j => (lo[j] + hi[j]) / 2), size = [0, 1].map(j => clamp(hi[j] - lo[j], 0.6, 0.85));
    const w = size[0], h = size[1];
    Object.assign(at, { c: [mid[0], mid[1], z], w, h, z, mito: m });
    const inSlab = (c, r) => Math.abs(c[2] - z) < r + TH / 2 && Math.abs(c[0] - at.c[0]) < w / 2 + r && Math.abs(c[1] - at.c[1]) < h / 2 + r;
    const MW = 0.008;   // (the gap between a double membrane's two)
    shells.push({ c: N.c, q: new THREE.Quaternion(), s: [N.r, N.r, N.r], kind: 'nuc' }, { c: N.c, q: new THREE.Quaternion(), s: [N.r - MW, N.r - MW, N.r - MW], kind: 'nuc' });
    for (const o of CELL.mitos) if (inSlab(o.c, o.a)) {
      const q = new THREE.Quaternion().setFromUnitVectors(X1, new THREE.Vector3(...o.axis));
      shells.push({ c: o.c, q, s: [o.a, o.b, o.b], kind: 'mito', o }, { c: o.c, q, s: [o.a - MW, o.b - MW, o.b - MW], kind: 'mito', o });
    }
    for (const o of [...CELL.lysos, ...CELL.endos, ...CELL.peroxs]) if (inSlab(o.c, o.r)) shells.push({ c: o.c, q: new THREE.Quaternion(), s: [o.r, o.r, o.r], kind: 'ves', o });
    shells.push({ c: [0, 0, 0], q: new THREE.Quaternion(), s: CELL.pm.slice(), kind: 'pm' });   // (the cell's own membrane, where the slab reaches it)
  }
  // where a point is against a shell: its scaled radius (1 on the membrane) and roughly how far from the membrane
  const _v = new THREE.Vector3(), _qi = new THREE.Quaternion();
  const rel = (sh, p) => { _v.set(p[0] - sh.c[0], p[1] - sh.c[1], p[2] - sh.c[2]).applyQuaternion(_qi.copy(sh.q).invert()); const q = Math.hypot(_v.x / sh.s[0], _v.y / sh.s[1], _v.z / sh.s[2]); return { q, d: Math.abs(q - 1) * Math.min(...sh.s) }; };
  function pack(ms) {
    const t0 = performance.now(), CELL = GL.sets.cell.api().CELL;
    place();
    if (!P.SB) {
      const PS = 0.045 / Math.max(...KS.map(k => 2 * BALLS.reach(BALLS.of(k.key, 1))));
      P.SB = {}; for (const k of KS) { const b = BALLS.of(k.key, PS); P.SB[k.key] = { b, rr: BALLS.reach(b) }; }
      P.GC = 2 * Math.max(...KS.map(k => P.SB[k.key].rr)) * 1.15;
    }
    const gi = v => Math.floor((v + 2) / P.GC), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    while (!P.done && performance.now() - t0 < ms) {
      for (let n = 0; n < 200; n++) {
        if (P.nb >= BMAX || P.miss > 3000 || P.i++ > 200000) { P.done = true; break; }
        const key = pick(), q = 0.85 + 0.3 * rnd(), rr = P.SB[key].rr * q, zr = Math.max(0, TH / 2 - rr * 0.6);
        const p = [at.c[0] + (rnd() - 0.5) * at.w, at.c[1] + (rnd() - 0.5) * at.h, at.z + (rnd() * 2 - 1) * zr];
        // (clear of every membrane; none inside a vesicle; which space it is in)
        let ok = true, inMito = false;
        for (const sh of shells) { const r = rel(sh, p); if (r.d < rr + 0.004 || (sh.kind === 'ves' && r.q < 1) || (sh.kind === 'pm' && r.q > 1)) { ok = false; break; } if (sh.kind === 'mito' && r.q < 1) inMito = true; }
        if (!ok) { P.miss++; continue; }
        const cx = gi(p[0]), cy = gi(p[1]), cz = gi(p[2]);
        for (let dx = -1; dx <= 1 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) for (let dz = -1; dz <= 1 && ok; dz++) {
          for (const o of P.grid.get(gk(cx + dx, cy + dy, cz + dz)) || []) if (d(o.p, p) < 0.9 * (o.rr + rr)) { ok = false; break; }
        }
        if (!ok) { P.miss++; continue; }
        P.miss = 0;
        const balls = P.SB[key].b.map(b => b.map(x => x * q)), c = rnd();
        const m = { p, balls, rr, e: [rnd() * 6, rnd() * 6, rnd() * 6], c: d(p, CELL.nuc.c) < CELL.nuc.r ? [0.75, 0.62, 1.0] : inMito ? [1.0, 0.6, 0.82] : c < 0.3 ? [1.0, 0.8, 0.4] : [0.6, 0.85, 1.0] };
        P.mols.push(m); P.nb += balls.length;
        const g = gk(cx, cy, cz); if (!P.grid.has(g)) P.grid.set(g, []); P.grid.get(g).push(m);
      }
    }
    if (P.done) P.grid = null;
    return P.done;
  }
  return { TH, at, shells, rel, P, pack };
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
  const { at: SA, TH } = SLAB, SW = [SA.w, SA.h, TH];
  const slabMat = K.fade(set, new THREE.MeshBasicMaterial({ color: 0x8fb8e8, depthWrite: false }), 0.12);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(...SW), slabMat); slab.position.set(...SA.c); set.group.add(slab);
  const slabEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...SW)), K.fade(set, new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true }), 0.6));
  slabEdge.position.copy(slab.position); set.group.add(slabEdge);
  // (the membranes the slab cuts, as a tomogram shows them: thin lines where each meets the slab's front face and its
  // back face (where it reaches only one, the cut in the middle), kept inside the slab's sides; pale, in one draw; the
  // envelope's and the mitochondrion's double)
  const memGeo = (() => {
    const out = [], NR = 200, LW = 0.0028, inRect = p => Math.abs(p[0] - SA.c[0]) < SW[0] / 2 && Math.abs(p[1] - SA.c[1]) < SW[1] / 2;
    // (a ring: the membrane's cut by the plane z, found along rays out from the shell's middle seen in that plane)
    const ring = (sh, z) => {
      if (SLAB.rel(sh, [sh.c[0], sh.c[1], z]).q >= 1) return null;
      const R = 2.2 * Math.max(...sh.s);
      return Array.from({ length: NR }, (_, i) => {
        const f = i / NR * Math.PI * 2, d = [Math.cos(f), Math.sin(f)];
        let lo = 0, hi = R;
        for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (SLAB.rel(sh, [sh.c[0] + d[0] * m, sh.c[1] + d[1] * m, z]).q < 1) lo = m; else hi = m; }
        return [sh.c[0] + d[0] * lo, sh.c[1] + d[1] * lo, z];
      });
    };
    // (a ribbon LW wide along a ring, lying in the face at z)
    const line = (r, z) => {
      const side = r.map((p, i) => { const a = r[(i + NR - 1) % NR], b = r[(i + 1) % NR], t = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...t) || 1; return [-t[1] / l * LW / 2, t[0] / l * LW / 2]; });
      for (let i = 0; i < NR; i++) {
        const j = (i + 1) % NR, q = [[r[i][0] - side[i][0], r[i][1] - side[i][1], z], [r[j][0] - side[j][0], r[j][1] - side[j][1], z], [r[j][0] + side[j][0], r[j][1] + side[j][1], z], [r[i][0] + side[i][0], r[i][1] + side[i][1], z]];
        if (q.every(inRect)) out.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
      }
    };
    for (const sh of SLAB.shells) {
      const mid = ring(sh, SA.z); if (!mid) continue;
      line(ring(sh, SA.z - TH / 2) || mid, SA.z - TH / 2 - 0.001); line(ring(sh, SA.z + TH / 2) || mid, SA.z + TH / 2 + 0.001);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    return g;
  })();
  const memMat = K.fade(set, new THREE.MeshBasicMaterial({ color: 0xe6eeff, side: THREE.DoubleSide, depthWrite: false }), 0.85);
  const mem = new THREE.Mesh(memGeo, memMat); set.group.add(mem);
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
      slab.visible = slabEdge.visible = mem.visible = sc.points.visible = s > 0.01;
      slab.scale.set(1, Math.max(0.01, s), 1); slabEdge.scale.copy(slab.scale);
      sc.U.uA.value = set.uA.value * clamp(s * 1.5 - 0.3, 0, 1); sc.tick(t);
      slabMat.opacity *= s; memMat.opacity *= clamp(s * 1.5 - 0.2, 0, 1);
      vol.visible = v > 0.01;
      if (vol.visible) { for (let i = 0; i < VA.length; i++) VA[i] = 0.12 * clamp(v * 1.4 - vr[i] * 0.4, 0, 1); vg.attributes.aA.needsUpdate = true; }
    },
    anchors: { halo: () => v3.add(baits[3], [0, 0.1, 0]), slab: [SA.c[0] + SW[0] * 0.5, SA.c[1] + SW[1] * 0.45, SA.z], vol: [0, CELL.pm[1] * 1.02, 0], nucleus: CELL.nuc.c },
    labels: [],
    stats: () => ({ slab: sMols.length, balls: sc.balls, at: [SA.c, SA.w, SA.h], shells: SLAB.shells.map(o => o.kind), memTris: memGeo.attributes.position.count / 3 }),
    cam: { default: [20, 14, 3.6, 0, 0, 0], slab: [8, 8, 1.9, SA.c[0], SA.c[1], SA.z], high: [30, 32, 3.8, 0, 0, 0] },
  });
};
SETS.next.prep = ms => SLAB.pack(ms || 25);
