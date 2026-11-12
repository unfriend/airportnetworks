// "Go touch the grass": patches of real-looking grass for the floor, its blades merged into a few clumps that sway in a
// breeze (clip Sway), on a thin round of turf. Unlit, each blade dark at its foot and bright at its tip.
(function () {
  const T = THREE;
  // blades over an ellipse (rx, rz), split into clumps by angle; each clump its own node, pivoting at its middle's foot
  const grass = (name, seed, rx, rz, n, clumps) => {
    const R = XP.rng(seed), root = XP.group(name), mat = XP.flat(null, { side: T.DoubleSide }), base = new T.Color('#24561a'), tipA = new T.Color('#b8e24c'), tipB = new T.Color('#7cc23a'), c = new T.Color();
    const sets = Array.from({ length: clumps }, () => ({ P: [], C: [], I: [], cx: 0, cz: 0, n: 0 }));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()), x = Math.cos(a) * r * rx, z = Math.sin(a) * r * rz;
      const k = Math.min(clumps - 1, Math.floor(((Math.atan2(z / rz, x / rx) + Math.PI) / (Math.PI * 2)) * clumps));
      pts.push([x, z, k, r]); sets[k].cx += x; sets[k].cz += z; sets[k].n++;
    }
    for (const S of sets) { S.cx /= Math.max(1, S.n); S.cz /= Math.max(1, S.n); }
    for (const [x, z, k, r] of pts) {
      const S = sets[k], h = (0.1 + R() * 0.22) * (1 - r * 0.45), wd = 0.012 + R() * 0.012, d = R() * Math.PI * 2, lean = (0.25 + R() * 0.45) * h;
      const ux = Math.cos(d), uz = Math.sin(d), lx = Math.cos(d + 1.3) * lean, lz = Math.sin(d + 1.3) * lean;
      const b = S.P.length / 3, X = x - S.cx, Z = z - S.cz;
      S.P.push(X - ux * wd / 2, 0, Z - uz * wd / 2, X + ux * wd / 2, 0, Z + uz * wd / 2, X + lx * 0.3, h * 0.55, Z + lz * 0.3, X + lx, h, Z + lz);
      const tip = c.copy(tipA).lerp(tipB, R()).multiplyScalar(0.85 + R() * 0.3).toArray(), foot = base.clone().multiplyScalar(0.8 + R() * 0.3).toArray(), mid = foot.map((v, j) => v * 0.45 + tip[j] * 0.55);
      S.C.push(...foot, ...foot, ...mid, ...tip);
      S.I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const tracks = [];
    sets.forEach((S, k) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(S.P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(S.C, 3)); g.setIndex(S.I);
      const m = XP.mesh(g, mat, 'clump' + k); m.position.set(S.cx, 0.004, S.cz); root.add(m);
      const ph = R() * Math.PI * 2, amp = 0.045 + R() * 0.03;
      const [ts, vs] = XP.sample(4, 16, t => [Math.sin(t / 4 * Math.PI * 2 + ph) * amp, 0, Math.sin(t / 4 * Math.PI * 4 + ph * 1.7) * amp * 0.6]);
      tracks.push(XP.qTrack('clump' + k, ts, vs));
    });
    // the turf under it: a thin round of dark earth and short grass
    const turf = new T.CircleGeometry(1, 40).rotateX(-Math.PI / 2); turf.scale(rx * 1.06, 1, rz * 1.06); turf.translate(0, 0.002, 0);
    turf.deleteAttribute('normal'); turf.deleteAttribute('uv');
    const tc = new Float32Array(turf.attributes.position.count * 3); for (let i = 0; i < tc.length; i += 3) { const k = 0.8 + R() * 0.3; tc[i] = 0.16 * k; tc[i + 1] = 0.3 * k; tc[i + 2] = 0.09 * k; }
    turf.setAttribute('color', new T.BufferAttribute(tc, 3));
    root.add(XP.mesh(turf, mat, 'turf'));
    return { root, clips: [new T.AnimationClip('Sway', 4, tracks)] };
  };
  XP.part('grass-patch', { file: 'models/grass-patch.glb', build: () => grass('grass', 1234, 0.55, 0.48, 1000, 4) });
  XP.part('grass-strip', { file: 'models/grass-strip.glb', build: () => grass('grass', 4321, 0.75, 0.28, 800, 4) });
})();
