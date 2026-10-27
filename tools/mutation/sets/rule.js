// The rule set of the mutation story (chapters 4 and 5): a substitution model, and the machine a compiler makes of it.
// Four letter balls at the corners of a pyramid (MMATH.CORNERS: A at the top, C front left, G at the back, T front
// right), as big as each letter's long-run share, joined both ways by curved arrows as thick as the rate from one
// letter to the other (MMATH.Q; light runs along them, faster where the rate is higher). The pyramid forms (glass
// faces, glowing edges, a tile at each corner), the balls shrink into its corners, and the mix of the four letters
// becomes a glowing point with a ring in four colours (its shares) that starts at a corner and glides along its path
// (MMATH.path, t from 0 towards T_PATH), a green trail behind it, points 1 to 3 marked, the long-run mix a dashed ring
// it settles towards. Then the pyramid drops into the compiler (a squat drum with a gear on its top) and out comes the
// machine for one branch: the parent's tile and its two qubits on the left; the copy (a press lifts the parent's
// letter and stamps it onto the child, and the child's two qubits take the parent's arrows); the turn (the child's
// qubits sit in two gears driven by a green branch-length dial; the arrows tilt as MMATH.bloch of the child's mix, and
// a small pyramid beside them shows that mix moving along the same path); and below it the circuit itself, in 3D:
// four wires (the parent's p1, p0, the child's c1, c0), the two copy gates, the two turn blocks with their controls,
// pulses running along the wires, and on request the blocks opened into their simple steps (MMATH.decompose: turns
// of one qubit and links of two). Every number is computed live by MMATH from the example models.
// Everything follows the params and t; only a switch of model, start or parent letter (step params) eases in its own
// time (0.6 s; a seek or the first frame shows the new one at once), as the qubits story's cube does.
SETS.rule = function (K) {
  const { THREE, clamp, lerp, prog, smooth } = K;
  const set = K.newSet('rule');
  const M = MMATH, LK = MLOOK(K, set);
  const PI = Math.PI, TAU = PI * 2;
  const CN = M.CORNERS, NM = M.MODELS.length;
  const QS = M.MODELS.map((_, i) => M.Q(i)), PIS = M.MODELS.map((_, i) => M.pi(i));
  let QREF = 0;
  QS.forEach(q => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j) QREF = Math.max(QREF, q[i * 4 + j]); });
  const GEAR_K = 1.6;   // the gears turn 1.6 times the turn's mean angle (so a long branch turns them about 120 degrees)
  const VIEW_AX = [0, 0.35, 1];   // rings that face the usual view, a little from above
  const UP = [0, 1, 0], FRONT = [0, 0, 1];
  const METAL = [0.42, 0.52, 0.68], DIM = [0.1, 0.12, 0.17];

  // ---------------------------------------------------------------- the machine's layout
  const DRUM = [0, -0.6, 0], DR = 0.48, DH = 0.3;
  const XP = -1.05, XC = -0.15;   // the parent's column, the child's
  const PAR_T = [XP, 0.88, 0], CHD_T = [XC, 0.88, 0], MT = 0.17;
  const QR = 0.12, GR = 0.19, GAP = 2 * 0.9 * GR;   // qubits, gears (meshing gears' centres 1.8 R apart)
  const PQ = [[XP, 0.52, 0], [XP, 0.52 - GAP, 0]], CQ = [[XC, 0.52, 0.06], [XC, 0.52 - GAP, 0.06]];
  const GC = [[XC, 0.52, -0.05], [XC, 0.52 - GAP, -0.05]], GD = [XC + GAP, 0.52, -0.05];
  const MINI = [0.8, 0.45, 0], MS = 0.24, ZB = -0.22;   // the small pyramid; the machine's back frame
  const RAIL_Y = 1.12, HEAD_REST = [(XP + XC) / 2, 1.05], HEAD_DOWN = 0.985;
  // the circuit: wires p1, p0, c1, c0 top to bottom
  const WY = [-0.3, -0.47, -0.64, -0.81], XL = -1.1, XR = 1.12, WIRE = { p1: 0, p0: 1, c1: 2, c0: 3 };
  const XCOPY = [-0.85, -0.7], XB = [-0.24, 0.48], BW = [0.3, 0.42], BH = 0.14;
  // the turn blocks' simple steps (the structure is the same for every branch: MMATH.decompose of the circuit's two
  // turn blocks; only the RY angles change, computed below without allocating)
  const STEPS = M.circuit(M.DEFAULT, 0.5).gates.filter(g => g.type === 'MRY').map((g, b) => {
    const k = g.ctrls.length, N = 1 << k, gray = j => j ^ (j >> 1), list = M.decompose(g);
    const sign = new Float64Array(N * N);   // RY j's angle = sum_x sign[j N + x] theta_x / N
    for (let j = 0; j < N; j++) for (let x = 0; x < N; x++) sign[j * N + x] = M.pop(x & gray(j)) & 1 ? -1 : 1;
    let ry = 0;
    const items = list.map(s => (s.type === 'RY' ? { ry: ry++, w: WIRE[s.tgt] } : { ctrl: WIRE[s.ctrl], w: WIRE[s.tgt] }));
    const x0 = b ? 0.08 : -0.5, x1 = b ? 1.08 : 0.0;
    items.forEach((it, i) => { it.x = lerp(x0, x1, (i + 0.5) / items.length); });
    return { N, sign, items, tgt: WIRE[g.tgt], ctrls: g.ctrls.map(c => WIRE[c]) };
  });
  const NRY = STEPS.reduce((a, s) => a + s.N, 0), NCX = STEPS.reduce((a, s) => a + s.items.length - s.N, 0);

  // ---------------------------------------------------------------- pools and meshes
  const tubes = LK.tubes(780), cones = LK.cones(24), balls = LK.balls(80), halos = LK.halos(100), rings = LK.rings(48),
    tiles = LK.tiles(24), gears = LK.gears(8), glass = LK.glass(6), boxes = LK.boxes(32);
  set.group.add(tubes.mesh, cones.mesh, balls.mesh, halos.mesh, rings.mesh, tiles.mesh, gears.mesh, glass.mesh, boxes.mesh);
  const QPOOLS = { glass, rings, tubes, cones, balls, halos };
  // the pyramid's glass faces (the big one and the machine's small copy)
  const faceGeo = new THREE.BufferGeometry();
  {
    const F = [[0, 1, 3], [0, 3, 2], [0, 2, 1], [1, 2, 3]], pos = [];
    F.forEach(f => f.forEach(i => pos.push(...CN[i])));
    faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    faceGeo.computeVertexNormals();
  }
  const faces = [0, 1].map(() => {
    const m = new THREE.Mesh(faceGeo, K.rim(set, { color: '#7fbfff', a0: 0.05, a1: 0.3 }));
    m.visible = false; set.group.add(m);
    return m;
  });
  // the compiler: a squat drum, lit
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x123563, metalness: 0.45, roughness: 0.38, emissive: 0x071b38, transparent: true });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, false), drumMat);
  drum.visible = false; set.group.add(drum);

  // scratch (nothing is allocated per frame)
  const _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0], _d = [0, 0, 0], _e = [0, 0, 0], _col = [0, 0, 0];
  const pA = new Float64Array(4), pB = new Float64Array(4), pM = new Float64Array(4), bl = new Float64Array(6), ang = new Float64Array(12);
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), YV = new THREE.Vector3(0, 1, 0);
  const lerp3 = (out, a, b, s) => { out[0] = a[0] + (b[0] - a[0]) * s; out[1] = a[1] + (b[1] - a[1]) * s; out[2] = a[2] + (b[2] - a[2]) * s; return out; };
  const set3 = (out, x, y, z) => { out[0] = x; out[1] = y; out[2] = z; return out; };
  // a point of the pyramid placed at centre c with scale s
  const tr = (out, T, p) => set3(out, T.c[0] + T.s * p[0], T.c[1] + T.s * p[1], T.c[2] + T.s * p[2]);
  const BIG = { c: [0, 0, 0], s: 1 }, SMALL = { c: MINI.slice(), s: MS };

  // a ring of short tubes split into four arcs as long as the shares p (A from the top, then C, G, T clockwise)
  const RING_N = 48, _u = [0, 0, 0], _v = [0, 0, 0];
  function shareRing(c, axis, R, r, p, alpha) {
    if (alpha <= 0.004 || R <= 0) return;
    const al = Math.hypot(axis[0], axis[1], axis[2]) || 1, ax = axis[0] / al, ay = axis[1] / al, az = axis[2] / al;
    let ux = -ay * ax, uy = 1 - ay * ay, uz = -ay * az;
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = uy * az - uz * ay, vy = uz * ax - ux * az, vz = ux * ay - uy * ax;
    const tot = (p[0] + p[1] + p[2] + p[3]) || 1;
    let L = 0, edge = p[0] / tot;
    for (let s = 0; s < RING_N; s++) {
      const f = (s + 0.5) / RING_N;
      while (L < 3 && f > edge) { L++; edge += p[L] / tot; }
      const a0 = s / RING_N * TAU, a1 = (s + 1) / RING_N * TAU;
      set3(_u, c[0] + R * (Math.cos(a0) * ux + Math.sin(a0) * vx), c[1] + R * (Math.cos(a0) * uy + Math.sin(a0) * vy), c[2] + R * (Math.cos(a0) * uz + Math.sin(a0) * vz));
      set3(_v, c[0] + R * (Math.cos(a1) * ux + Math.sin(a1) * vx), c[1] + R * (Math.cos(a1) * uy + Math.sin(a1) * vy), c[2] + R * (Math.cos(a1) * uz + Math.sin(a1) * vz));
      tubes.add(_u, _v, r, LK.LCOL[L], alpha, 0);
    }
  }
  // a switch of step params eases in its own time: { from: [..], to: [..], k }
  const mkSwitch = n => ({ from: new Array(n).fill(0), to: new Array(n).fill(-1), k: 1 });
  function step(sw, v0, v1, snap, dt) {
    if (v0 !== sw.to[0] || v1 !== sw.to[1]) {
      const first = sw.to[0] < 0;
      if (first) { sw.from[0] = v0; sw.from[1] = v1; } else if (sw.k >= 0.5) { sw.from[0] = sw.to[0]; sw.from[1] = sw.to[1]; }
      sw.to[0] = v0; sw.to[1] = v1;
      sw.k = snap || first ? 1 : 0;
    } else sw.k = snap ? 1 : Math.min(1, sw.k + dt / 0.6);
    return smooth(sw.k);
  }
  const SWP = mkSwitch(2), SWM = mkSwitch(2);   // (model, start) for the pyramid; (model, parent) for the machine
  // the mix after t from the switch's letter, eased between the old and the new choice
  function mixAt(sw, ks, t, out) {
    M.path(sw.from[0], sw.from[1], t, pA); M.path(sw.to[0], sw.to[1], t, pB);
    for (let i = 0; i < 4; i++) out[i] = lerp(pA[i], pB[i], ks);
    return out;
  }
  const turnAt = (sw, ks, t) => lerp(M.turnAngle(sw.from[0], t), M.turnAngle(sw.to[0], t), ks);
  const piAt = (sw, ks, i) => lerp(PIS[sw.from[0]][i], PIS[sw.to[0]][i], ks);
  // a pure letter's two qubits, each arrow turned on its own while the letter changes (no mix of the two meanwhile)
  function letterBloch(a, b, k, out) {
    const t1 = PI * lerp(a >> 1, b >> 1, k), t2 = PI * lerp(a & 1, b & 1, k);
    out[0] = Math.sin(t1); out[1] = 0; out[2] = Math.cos(t1); out[3] = Math.sin(t2); out[4] = 0; out[5] = Math.cos(t2);
    return out;
  }

  // what the anchors and labels read (kept current by update)
  const now = { big: BIG, mix: [0, 0, 0], pts: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], longrun: [0, 0, 0], t: 1, tEff: 0, model: 2, start: 0, parent: 0,
    ang: new Float64Array(12), fast: [0, 0, 0], head: HEAD_REST.slice(), gearsA: 0 };

  // ---- the pyramid (the big one, or the machine's small copy): edges, faces, corner tiles, the path and the mix
  const ED = [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [3, 1]];
  function pyramid(T, a, form, mesh, sw, ks, tMix, pathA, small) {
    if (a <= 0.004) { mesh.visible = false; return; }
    const s = T.s, er = small ? 0.006 : 0.009;
    // the edges grow from the corners to their middles
    const eg = prog(form, 0, 0.6);
    if (eg > 0.004) for (let e = 0; e < 6; e++) {
      const i = ED[e][0], j = ED[e][1];
      tr(_a, T, CN[i]); tr(_b, T, CN[j]); lerp3(_c, _a, _b, 0.5 * eg); lerp3(_d, _b, _a, 0.5 * eg);
      tubes.add(_a, _c, er, LK.RIM, a * 0.9, 0); tubes.add(_b, _d, er, LK.RIM, a * 0.9, 0);
    }
    const fa = prog(form, 0.3, 1) * a;
    mesh.visible = fa > 0.004;
    mesh.position.set(T.c[0], T.c[1], T.c[2]); mesh.scale.setScalar(s);
    mesh.material.uniforms.uK.value = fa;
    // the corners: a tile with the letter (facing you), a glow
    const ta = prog(form, 0.5, 1) * a;
    for (let i = 0; i < 4; i++) {
      tr(_a, T, CN[i]);
      const l = Math.hypot(CN[i][0], CN[i][1], CN[i][2]);
      const k = small ? T.s / MS : T.s;   // (the corners shrink with the pyramid as it drops into the compiler)
      for (let d = 0; d < 3; d++) _b[d] = _a[d] + CN[i][d] / l * (small ? 0.06 : 0.13) * k;
      if (ta > 0.004) tiles.add(_b, null, (small ? 0.075 : 0.17) * k, i, ta, 0, 0.1);
      halos.add(_a, (small ? 0.12 : 0.22) * k, LK.LCOL[i], 0.35 * fa);
    }
    if (pathA <= 0.004) return;
    // the path: the whole of it faint and dashed, the part travelled bright green, points 1 to 3, the long-run mix
    const tEnd = Math.max(M.T_PATH, tMix), NT = small ? 36 : 64;
    mixAt(sw, ks, 0, pM); M.simplex(pM, _c); tr(_a, T, _c);
    for (let k = 1; k <= NT; k++) {
      const tk = tEnd * k / NT;
      mixAt(sw, ks, tk, pM); M.simplex(pM, _c); tr(_b, T, _c);
      if (tk <= tMix + 1e-9) tubes.add(_a, _b, small ? 0.006 : 0.009, LK.GREENLIT, pathA * (0.35 + 0.65 * tk / Math.max(tMix, 1e-3)), 0);
      else if (tEnd * (k - 1) / NT < tMix) {   // (the stretch the point is on: bright up to it)
        mixAt(sw, ks, tMix, pM); M.simplex(pM, _c); tr(_d, T, _c);
        tubes.add(_a, _d, small ? 0.006 : 0.009, LK.GREENLIT, pathA, 0);
      } else if (k % 2 === 0) tubes.add(_a, _b, small ? 0.003 : 0.004, LK.GREEN, pathA * 0.4, 0);   // (ahead: dashed)
      _a[0] = _b[0]; _a[1] = _b[1]; _a[2] = _b[2];
    }
    if (!small) for (let k = 0; k < 3; k++) {
      mixAt(sw, ks, M.POINTS[k], pM); M.simplex(pM, _c); tr(now.pts[k], T, _c);
      const passed = tMix >= M.POINTS[k] - 1e-6;
      rings.add(now.pts[k], VIEW_AX, 0.032, 0.006, LK.WHITE, pathA * (passed ? 1 : 0.4), 0);
    }
    // the long-run mix: a dashed ring the point settles towards
    for (let i = 0; i < 4; i++) pM[i] = piAt(sw, ks, i);
    M.simplex(pM, _c); tr(_d, T, _c);
    if (!small) set3(now.longrun, _d[0], _d[1], _d[2]);
    rings.add(_d, VIEW_AX, small ? 0.03 : 0.065, small ? 0.004 : 0.006, LK.CYAN, pathA * 0.9, small ? 10 : 16);
    balls.add(_d, small ? 0.008 : 0.014, LK.CYAN, pathA * 0.9);
    // the mix now: a glowing point, its ring of shares, and a thread to each corner as strong as its share
    mixAt(sw, ks, tMix, pM); M.simplex(pM, _c); tr(_e, T, _c);
    if (!small) set3(now.mix, _e[0], _e[1], _e[2]);
    balls.add(_e, small ? 0.016 : 0.034, LK.WHITE, pathA);
    halos.add(_e, small ? 0.14 : 0.3, LK.WHITE, 0.55 * pathA);
    shareRing(_e, VIEW_AX, small ? 0.04 : 0.08, small ? 0.006 : 0.011, pM, pathA);
    if (!small) for (let i = 0; i < 4; i++) {
      tr(_a, T, CN[i]);
      tubes.add(_e, _a, 0.0015 + 0.008 * pM[i], LK.LCOL[i], 0.4 * pathA * (0.3 + 0.7 * pM[i]), 0);
    }
  }

  // ---- the rule itself: balls at the corners as big as the long-run shares, arrows as thick as the rates
  // a point on the quadratic curve through _a, _b (control), _c
  function bez(u, out) {
    const v = 1 - u;
    return set3(out, v * v * _a[0] + 2 * u * v * _b[0] + u * u * _c[0], v * v * _a[1] + 2 * u * v * _b[1] + u * u * _c[1], v * v * _a[2] + 2 * u * v * _b[2] + u * u * _c[2]);
  }
  function rates(S, t, a, form, ks) {
    const grow = prog(clamp(S.rule_balls, 0, 1), 0.2, 1), arA = a * (1 - prog(form, 0, 0.5)), flow = clamp(S.rule_flow, 0, 1);
    const shrink = 1 - 0.85 * prog(form, 0.1, 0.8), qF = QS[SWP.from[0]], qT = QS[SWP.to[0]];
    let bi = 0, bj = 1, best = -1;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j && qT[i * 4 + j] > best) { best = qT[i * 4 + j]; bi = i; bj = j; }
    for (let i = 0; i < 4; i++) {
      const r = 0.34 * Math.sqrt(piAt(SWP, ks, i)) * smooth(prog(clamp(S.rule_balls, 0, 1), 0, 0.5)) * shrink;
      balls.add(CN[i], r, LK.LCOL[i], a);
      halos.add(CN[i], r * 3.5, LK.LCOL[i], 0.25 * a * shrink);
    }
    if (arA <= 0.004 || grow <= 0.004) return;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (i === j) continue;
      const q = lerp(qF[i * 4 + j], qT[i * 4 + j], ks), rad = 0.004 + 0.024 * q / QREF;
      const ri = 0.34 * Math.sqrt(piAt(SWP, ks, i)), rj = 0.34 * Math.sqrt(piAt(SWP, ks, j));
      // a quadratic curve bulging to its own side (i -> j and j -> i on opposite sides: a two-way street)
      const dx = CN[j][0] - CN[i][0], dy = CN[j][1] - CN[i][1], dz = CN[j][2] - CN[i][2], dl = Math.hypot(dx, dy, dz);
      const ux = dx / dl, uy = dy / dl, uz = dz / dl;
      const mx = (CN[i][0] + CN[j][0]) / 2, my = (CN[i][1] + CN[j][1]) / 2, mz = (CN[i][2] + CN[j][2]) / 2, ml = Math.hypot(mx, my, mz);
      const ox = mx / ml, oy = my / ml, oz = mz / ml;
      let sx = uy * oz - uz * oy, sy = uz * ox - ux * oz, sz = ux * oy - uy * ox;
      const sl = Math.hypot(sx, sy, sz); sx /= sl; sy /= sl; sz /= sl;
      set3(_a, CN[i][0] + ux * (ri + 0.04), CN[i][1] + uy * (ri + 0.04), CN[i][2] + uz * (ri + 0.04));
      set3(_c, CN[j][0] - ux * (rj + 0.1), CN[j][1] - uy * (rj + 0.1), CN[j][2] - uz * (rj + 0.1));
      set3(_b, mx + sx * 0.17 + ox * 0.05, my + sy * 0.17 + oy * 0.05, mz + sz * 0.17 + oz * 0.05);
      const NS = 12, uMax = grow;
      bez(0, _d);
      for (let s = 1; s <= NS; s++) {
        const u = Math.min(uMax, s / NS);
        bez(u, _e);
        tubes.add(_d, _e, rad, LK.mix(LK.LCOL[i], LK.LCOL[j], u, _col), arA, 0);
        _d[0] = _e[0]; _d[1] = _e[1]; _d[2] = _e[2];
        if (u >= uMax) break;
      }
      if (uMax > 0.98) {
        bez(1, _d); set3(_e, 2 * (_c[0] - _b[0]), 2 * (_c[1] - _b[1]), 2 * (_c[2] - _b[2]));
        cones.add(_d, _e, 0.075, rad * 1.6 + 0.014, LK.LCOL[j], arA);
        if (i === bi && j === bj) bez(0.5, now.fast);
      }
      // light running along it, quicker where the rate is higher
      if (flow > 0.004) for (let b = 0; b < 3; b++) {
        const u = ((t * (0.12 + 0.55 * q / QREF) + b / 3 + i * 0.13 + j * 0.07) % 1);
        if (u > uMax) continue;
        bez(u, _d);
        halos.add(_d, 0.05 + 0.1 * q / QREF, LK.mix(LK.LCOL[i], LK.LCOL[j], u, _col), 0.7 * arA * flow * Math.sin(PI * u));
      }
    }
  }

  // ---- the machine for one branch
  const PO = [{ at: 0, col: LK.INK }, { at: 3, col: LK.INK }], CO = [{ at: 0, col: LK.INK, glow: 0 }, { at: 3, col: LK.INK, glow: 0 }];
  const GOPT = { glow: 0 }, DOPT = { rim: null, glow: 0.2 }, TILE_Q = new THREE.Quaternion();
  // a part of the machine flies out of the drum: where it is, and how far out (0..1)
  function fly(m, d0, place, o) { const s = smooth(prog(m, d0, d0 + 0.5)); lerp3(o, DRUM, place, s); o[1] += 0.25 * Math.sin(PI * s); return s; }
  // a bump 0 -> 1 -> 0 while the copy runs from a to b
  const dip = (cp, a, b) => Math.sin(PI * clamp((cp - a) / (b - a), 0, 1));
  function machine(S, t, mA, ks) {
    const m = clamp(S.rule_machine, 0, 1), cp = clamp(S.rule_copy, 0, 1), tm = clamp(S.rule_time, 0, 3);
    const par = SWM.to[1], parF = SWM.from[1], tEff = tm * prog(cp, 0.85, 1);
    now.tEff = tEff;
    // the parent: its tile and its two qubits
    let s = fly(m, 0, PAR_T, _a);
    TILE_Q.setFromAxisAngle(YV, PI * (ks < 1 ? ks : 0));
    if (s > 0.01) tiles.add(_a, TILE_Q, MT * s, ks < 0.5 ? parF : par, mA, 0, 0.1);
    letterBloch(parF, par, ks, bl);
    for (let q = 0; q < 2; q++) { s = fly(m, 0.05 + 0.04 * q, PQ[q], _b); if (s > 0.01) LK.qubit(QPOOLS, _b, QR * s, bl, mA, PO[q]); }
    // the back frame: axles from the gears and posts from the parent's qubits into two rails behind (one machine)
    const fa = mA * prog(m, 0.45, 0.9);
    if (fa > 0.004) {
      for (let q = 0; q < 2; q++) {
        tubes.add(set3(_c, XP, PQ[q][1], -QR), set3(_d, XP, PQ[q][1], ZB), 0.012, METAL, fa, 0);
        tubes.add(set3(_c, XC, GC[q][1], GC[q][2]), set3(_d, XC, GC[q][1], ZB), 0.022, METAL, fa, 0);
        tubes.add(set3(_c, XP, PQ[q][1], ZB), set3(_d, q ? XC : GD[0], PQ[q][1], ZB), 0.014, METAL, 0.8 * fa, 0);
        balls.add(_c, 0.022, METAL, fa);
      }
      tubes.add(set3(_c, GD[0], GD[1], GD[2]), set3(_d, GD[0], GD[1], ZB), 0.022, METAL, fa, 0);
      tubes.add(set3(_c, XP, PQ[0][1], ZB), set3(_d, XP, PQ[1][1], ZB), 0.014, METAL, 0.8 * fa, 0);
      tubes.add(set3(_c, XC, GC[0][1], ZB), set3(_d, XC, GC[1][1], ZB), 0.014, METAL, 0.8 * fa, 0);
    }
    // the gears: the child's two, and the green dial that drives them (meshing: each turned the other way)
    const ga = GEAR_K * turnAt(SWM, ks, tEff);
    now.gearsA = ga;
    for (let g = 0; g < 2; g++) { s = fly(m, 0.15 + 0.05 * g, GC[g], _b); if (s > 0.01) gears.add(_b, FRONT, GR * s, g ? -ga : ga, LK.BLUE, mA, GOPT); }
    s = fly(m, 0.25, GD, _b);
    if (s > 0.01) {
      DOPT.rim = LK.GREENLIT;
      gears.add(_b, FRONT, GR * s, -ga, LK.GREEN, mA, DOPT);
      // its scale: ticks where the needle points after branches of 0, 0.25, 0.5, 1 and 2, the arc swept so far
      const R = (GR + 0.07) * s, z = _b[2] + 0.04, nd = PI / 2 - ga, dA = mA * prog(cp, 0.6, 1);
      for (let d = 0; d < DIAL.length; d++) {
        const a = PI / 2 - GEAR_K * turnAt(SWM, ks, DIAL[d]);
        set3(_c, _b[0] + R * Math.cos(a), _b[1] + R * Math.sin(a), z); set3(_d, _b[0] + (R + 0.04) * Math.cos(a), _b[1] + (R + 0.04) * Math.sin(a), z);
        tubes.add(_c, _d, 0.005, LK.GREENLIT, dA * 0.9, 0);
      }
      const amax = GEAR_K * turnAt(SWM, ks, 3), NSEG = 28;
      for (let k = 0; k < NSEG; k++) {
        const a0 = PI / 2 - amax * k / NSEG, a1 = PI / 2 - amax * (k + 1) / NSEG, lit = a1 >= nd - 1e-6;
        set3(_c, _b[0] + R * Math.cos(a0), _b[1] + R * Math.sin(a0), z); set3(_d, _b[0] + R * Math.cos(a1), _b[1] + R * Math.sin(a1), z);
        tubes.add(_c, _d, lit ? 0.009 : 0.004, lit ? LK.GREENLIT : LK.GREEN, dA * (lit ? 1 : 0.45), 0);
      }
      // the needle, fixed on the dial's gear
      set3(_c, _b[0] + (R - 0.02) * Math.cos(nd), _b[1] + (R - 0.02) * Math.sin(nd), z + 0.01);
      set3(_d, _b[0], _b[1], z + 0.01);
      tubes.add(_d, _c, 0.008, LK.GREENLIT, dA, 0);
      balls.add(_d, 0.02, LK.GREENLIT, dA);
      halos.add(_c, 0.12, LK.GREENLIT, 0.6 * dA);
    }
    // the press: a rail, a carriage, a head that lifts the parent's letter and stamps it onto the child
    const pa = mA * prog(m, 0.4, 0.8);
    const hx = cp < 0.12 ? lerp(HEAD_REST[0], PAR_T[0], smooth(cp / 0.12)) : cp < 0.28 ? PAR_T[0] : cp < 0.5 ? lerp(PAR_T[0], CHD_T[0], smooth((cp - 0.28) / 0.22))
      : cp < 0.66 ? CHD_T[0] : lerp(CHD_T[0], HEAD_REST[0], smooth((cp - 0.66) / 0.19));
    const hy = HEAD_REST[1] - (HEAD_REST[1] - HEAD_DOWN) * (dip(cp, 0.12, 0.28) + dip(cp, 0.5, 0.66));
    now.head[0] = hx; now.head[1] = hy;
    if (pa > 0.004) {
      tubes.add(set3(_c, PAR_T[0] - 0.12, RAIL_Y, 0), set3(_d, CHD_T[0] + 0.12, RAIL_Y, 0), 0.012, METAL, pa, 0);
      boxes.add(set3(_c, hx, RAIL_Y, 0), SZ_CAR, METAL, pa);
      tubes.add(set3(_c, hx, RAIL_Y, 0), set3(_d, hx, hy, 0), 0.011, METAL, pa, 0);
      boxes.add(set3(_c, hx, hy, 0), SZ_HEAD, LK.BLUE, pa);
      // the letter it carries
      if (cp > 0.17 && cp < 0.58) { set3(_c, hx, hy - 0.025 - MT * 0.5 - 0.005, 0); tiles.add(_c, null, MT, par, pa, 0, 0.2); }
    }
    // the child: a dim '?' until the stamp; then the parent's letter; '?' with its ring of shares once it turns
    s = fly(m, 0.1, CHD_T, _a);
    const stamped = prog(cp, 0.56, 0.6), tf = prog(tEff, 0, 0.12);
    M.path(SWM.to[0], par, tEff, pM);
    if (SWM.k < 1) { mixAt(SWM, ks, tEff, pM); }
    TILE_Q.setFromAxisAngle(YV, PI * tf);
    if (s > 0.01) {
      const L = stamped < 0.5 || tf >= 0.5 ? 4 : par;
      tiles.add(_a, TILE_Q, MT * s, L, mA * (0.35 + 0.65 * stamped), 0, 0.1 + 0.6 * dip(cp, 0.55, 0.7));
      shareRing(_a, FRONT, MT * 0.85, 0.008, pM, mA * prog(tEff, 0.04, 0.2));
      if (cp > 0.55 && cp < 0.75) halos.add(_a, 0.5, LK.LCOL[par], 0.8 * dip(cp, 0.55, 0.75) * mA);
    }
    // the copy reaches the child's qubits along the two lines from the parent's (one per qubit)
    const kc = prog(cp, 0.66, 0.82);
    for (let q = 0; q < 2; q++) {
      set3(_c, PQ[q][0] + QR, PQ[q][1], 0.06); set3(_d, CQ[q][0] - QR, CQ[q][1], 0.06);
      tubes.add(_c, _d, 0.004, LK.INK, 0.3 * mA * prog(m, 0.5, 1), 0);
      if (cp > 0.58 && cp < 0.84) { const u = prog(cp, 0.58, 0.8); lerp3(_e, _c, _d, u); halos.add(_e, 0.16, LK.CYAN, mA * Math.sin(PI * u)); }
    }
    // its qubits: up (|00>) before the copy, the parent's arrows after it, then turned to the child's mix
    if (tEff > 1e-4 || kc >= 1) M.bloch(pM, bl); else letterBloch(0, par, kc, bl);
    for (let q = 0; q < 2; q++) {
      s = fly(m, 0.2 + 0.04 * q, CQ[q], _b);
      CO[q].glow = 0.2 + 0.6 * dip(cp, 0.66, 0.84);
      if (s > 0.01) LK.qubit(QPOOLS, _b, QR * s, bl, mA, CO[q]);
    }
    // the small pyramid: the child's mix on the rule's path from the parent's corner
    s = fly(m, 0.3, MINI, SMALL.c); SMALL.s = MS * s;
    pyramid(SMALL, mA * (s > 0.01 ? 1 : 0), 1, faces[1], SWM, ks, tEff, mA * prog(cp, 0.8, 1), true);
  }
  const DIAL = [0, 0.25, 0.5, 1, 2];

  // ---- the circuit, under the machine
  const XPOS = [0, 0, 0, 0], SZ_CAR = [0.1, 0.05, 0.06], SZ_HEAD = [0.22, 0.05, 0.13], SZ_BLOCK = [0.3, BH, 0.08], SZ_CTRL = [0.045, 0.045, 0.045], SZ_RY = [0.05, 0.075, 0.05];
  let RUN = 1;
  // a gate glows as a pulse on its wire passes it
  const flash = (w, x) => RUN * Math.exp(-(((XPOS[w] - x) / 0.06) ** 2));
  function circuit(S, t, cA, ks) {
    const grow = prog(cA, 0, 0.6), xe = lerp(XL, XR, grow), simple = clamp(S.rule_simple, 0, 1), run = clamp(S.rule_run, 0, 1);
    const par = SWM.to[1];
    // the turn's angles now (the child's two blocks; the simple steps' angles from all of them)
    M.angles(SWM.to[0], now.tEff, ang);
    if (SWM.k < 1) { M.angles(SWM.from[0], now.tEff, now.ang); for (let i = 0; i < 12; i++) ang[i] = lerp(now.ang[i], ang[i], ks); }
    now.ang.set(ang);
    // pulses along the wires; a gate glows as one passes it
    for (let w = 0; w < 4; w++) XPOS[w] = XL + ((t * 0.26 + w * 0.17) % 1) * (XR - XL);
    RUN = run;
    for (let w = 0; w < 4; w++) {
      tubes.add(set3(_a, XL, WY[w], 0), set3(_b, xe, WY[w], 0), 0.006, LK.INK, 0.5 * cA, 0);
      if (run > 0.004 && XPOS[w] < xe) halos.add(set3(_a, XPOS[w], WY[w], 0.01), 0.1, [0.85, 0.95, 1], 0.8 * cA * run);
    }
    // the inputs: the parent's two bits, the child's two zeros
    const ia = cA * prog(grow, 0, 0.3);
    for (let w = 0; w < 4; w++) tiles.add(set3(_a, XL - 0.09, WY[w], 0), null, 0.1, w === 0 ? 5 + (par >> 1) : w === 1 ? 5 + (par & 1) : 5, ia, 0, 0, w < 2 ? LK.LCOL[par] : LK.GREY);
    // the copy: two CNOTs (a dot on the parent's wire, a target on the child's)
    const copyA = cA * prog(grow, 0.15, 0.35);
    for (let g = 0; g < 2; g++) {
      const x = XCOPY[g], wc = g, wt = g + 2, f = 1 + 1.5 * flash(wt, x);
      tubes.add(set3(_a, x, WY[wc], 0), set3(_b, x, WY[wt] - 0.038, 0), 0.006, LK.WHITE, copyA, 0);
      balls.add(set3(_a, x, WY[wc], 0), 0.022, LK.WHITE, copyA);
      rings.add(set3(_a, x, WY[wt], 0), FRONT, 0.038, 0.006, LK.WHITE, copyA, 0);
      tubes.add(set3(_a, x - 0.038, WY[wt], 0), set3(_b, x + 0.038, WY[wt], 0), 0.005, LK.WHITE, copyA, 0);
      halos.add(set3(_a, x, WY[wt], 0.02), 0.16, LK.CYAN, 0.25 * copyA * f);
    }
    // the turn: two blocks (c1's controlled by the parent, c0's by the parent and c1), each with a gear turning
    const blockA = cA * prog(grow, 0.35, 0.7) * (1 - smooth(simple));
    for (let b = 0; b < 2; b++) {
      const st = STEPS[b], x = XB[b], wt = st.tgt, f = flash(wt, x);
      if (blockA > 0.004) {
        SZ_BLOCK[0] = BW[b] * (1 - 0.6 * simple);
        boxes.add(set3(_a, x, WY[wt], 0), SZ_BLOCK, LK.mix(LK.BLUE, LK.RIM, 0.25 * f, _col), blockA);
        halos.add(set3(_a, x, WY[wt], 0.05), 0.35, LK.RIM, (0.15 + 0.3 * f) * blockA);
        gears.add(set3(_a, x, WY[wt], 0.05), FRONT, 0.055, (b ? -1 : 1) * now.gearsA, LK.BLUE, blockA, GOPT);
        let top = WY[wt];
        for (let c = 0; c < st.ctrls.length; c++) {
          const w = st.ctrls[c];
          boxes.add(set3(_a, x, WY[w], 0), SZ_CTRL, LK.RIM, blockA);
          top = Math.max(top, WY[w]);
        }
        tubes.add(set3(_a, x, top, 0), set3(_b, x, WY[wt] + BH / 2, 0), 0.007, LK.RIM, blockA, 0);
      }
      // the simple steps: turns of one qubit (shaded by how far they turn, a needle at the angle) and links of two
      const sa = cA * prog(grow, 0.35, 0.7) * smooth(simple);
      if (sa <= 0.004) continue;
      const th0 = b ? 4 : 0;
      let mx = 1e-6;
      for (let j = 0; j < st.N; j++) { let v = 0; for (let xx = 0; xx < st.N; xx++) v += st.sign[j * st.N + xx] * ang[th0 + xx]; mx = Math.max(mx, Math.abs(v / st.N)); }
      for (let n = 0; n < st.items.length; n++) {
        const it = st.items[n];
        const xi = lerp(x, it.x, smooth(simple)), fl = flash(it.w, xi);
        if (it.ry !== undefined) {
          let v = 0; for (let xx = 0; xx < st.N; xx++) v += st.sign[it.ry * st.N + xx] * ang[th0 + xx];
          v /= st.N;
          const sh = 0.25 + 0.75 * Math.abs(v) / Math.max(mx, 0.35);
          boxes.add(set3(_a, xi, WY[it.w], 0), SZ_RY, LK.mix(DIM, LK.mix(LK.BLUE, LK.RIM, 0.3 * fl, _e), sh, _col), sa);
          set3(_a, xi - 0.026 * Math.sin(v), WY[it.w] - 0.026 * Math.cos(v), 0.03); set3(_b, xi + 0.026 * Math.sin(v), WY[it.w] + 0.026 * Math.cos(v), 0.03);
          tubes.add(_a, _b, 0.004, LK.INK, sa, 0);
        } else {
          const dn = WY[it.w] < WY[it.ctrl] ? 1 : -1;
          tubes.add(set3(_a, xi, WY[it.ctrl], 0), set3(_b, xi, WY[it.w] + dn * 0.022, 0), 0.004, LK.WHITE, sa, 0);
          balls.add(set3(_a, xi, WY[it.ctrl], 0), 0.014, LK.WHITE, sa);
          rings.add(set3(_a, xi, WY[it.w], 0), FRONT, 0.022, 0.004, LK.WHITE, sa, 0);
          if (fl > 0.05) halos.add(_a, 0.1, LK.CYAN, 0.4 * fl * sa);
        }
      }
    }
  }

  function update(S, t, dt) {
    LK.depth();
    tubes.begin(); cones.begin(); balls.begin(); halos.begin(); rings.begin(); tiles.begin(); gears.begin(); glass.begin(); boxes.begin();
    const snap = !(dt > 0) || dt > 0.25;
    const mi = clamp(Math.round(S.rule_model), 0, NM - 1), st = clamp(Math.round(S.rule_start), 0, 3), pr = clamp(Math.round(S.rule_parent), 0, 3);
    const ksP = step(SWP, mi, st, snap, dt), ksM = step(SWM, mi, pr, snap, dt);
    now.model = mi; now.start = st; now.parent = pr;
    const comp = clamp(S.rule_compile, 0, 1), mach = clamp(S.rule_machine, 0, 1), form = clamp(S.rule_pyr, 0, 1);
    const tm = clamp(S.rule_time, 0, 3);
    now.t = tm;

    // ---- the rule and the pyramid (shrinking and dropping into the compiler as it runs)
    const bigA = 1 - prog(comp, 0.55, 0.8);
    if (bigA > 0.004) {
      const d1 = smooth(prog(comp, 0, 0.4)), d2 = smooth(prog(comp, 0.4, 0.8));
      set3(BIG.c, 0, lerp(lerp(0, 0.25, d1), DRUM[1] + DH / 2, d2), 0);
      BIG.s = lerp(lerp(1, 0.42, d1), 0.04, d2);
      if (comp <= 0.004) rates(S, t, bigA, form, ksP);
      pyramid(BIG, bigA, form, faces[0], SWP, ksP, tm, bigA * clamp(S.rule_path, 0, 1), false);
    } else faces[0].visible = false;

    // ---- the compiler: a drum whose gear spins faster as the rule goes in and the machine comes out
    const drA = prog(comp, 0, 0.3) * (1 - prog(mach, 0.45, 0.9)), dS = smooth(prog(comp, 0, 0.3)) * (1 - 0.3 * smooth(prog(mach, 0.45, 0.9)));
    drum.visible = drA > 0.004;
    if (drum.visible) {
      drum.position.set(DRUM[0], DRUM[1], DRUM[2]); drum.scale.set(DR * dS, DH * dS, DR * dS);
      drumMat.opacity = drA * set.uA.value; drumMat.depthWrite = drumMat.opacity > 0.97;
      const spin = t * 0.5 + 7 * smooth(prog(comp, 0.45, 1)) + 7 * smooth(prog(mach, 0, 0.6)), glow = prog(comp, 0.5, 0.8) * (1 - prog(mach, 0.3, 0.8));
      DOPT_DRUM.glow = 0.2 + 0.8 * glow;
      gears.add(set3(_a, DRUM[0], DRUM[1] + DH * dS / 2 + 0.035 * dS, DRUM[2]), UP, 0.36 * dS, spin, LK.BLUE, drA, DOPT_DRUM);
      rings.add(set3(_a, DRUM[0], DRUM[1] + DH * dS / 2, DRUM[2]), UP, DR * dS, 0.012, LK.RIM, drA, 0);
      rings.add(set3(_a, DRUM[0], DRUM[1] - DH * dS / 2, DRUM[2]), UP, DR * dS, 0.01, LK.RIM, 0.6 * drA, 0);
      halos.add(set3(_a, DRUM[0], DRUM[1] + DH * dS / 2 + 0.05, DRUM[2]), 1.1 * dS, LK.RIM, 0.35 * glow * drA);
    }

    // ---- the machine, and the circuit under it
    const mA = prog(mach, 0.05, 0.6);
    if (mach > 0.004) machine(S, t, mA, ksM);
    else { faces[1].visible = false; now.tEff = 0; }
    const cA = mA * clamp(S.rule_circuit, 0, 1);
    if (cA > 0.004) circuit(S, t, cA, ksM);

    tubes.end(); cones.end(); balls.end(); halos.end(); rings.end(); tiles.end(); gears.end(); glass.end(); boxes.end();
  }
  const DOPT_DRUM = { glow: 0.2 };

  // ---------------------------------------------------------------- anchors, labels, views
  const corner = i => () => { const l = Math.hypot(...CN[i]); return [BIG.c[0] + BIG.s * CN[i][0] * (1 + 0.24 / l) + 0.06, BIG.c[1] + BIG.s * CN[i][1] * (1 + 0.24 / l), BIG.c[2] + BIG.s * CN[i][2] * (1 + 0.24 / l)]; };
  const anchors = {
    pyramid: [0, 0.2, 0], ballA: () => [CN[0][0] + 0.2, CN[0][1] + 0.04, CN[0][2]], fast: () => now.fast.slice(),
    cA: corner(0), cC: corner(1), cG: corner(2), cT: corner(3),
    mix: () => [now.mix[0] + 0.1, now.mix[1] + 0.02, now.mix[2]], longrun: () => [now.longrun[0] + 0.08, now.longrun[1] - 0.06, now.longrun[2]],
    p1: () => [now.pts[0][0] + 0.04, now.pts[0][1] + 0.04, now.pts[0][2]], p2: () => [now.pts[1][0] + 0.04, now.pts[1][1] + 0.04, now.pts[1][2]],
    p3: () => [now.pts[2][0] + 0.04, now.pts[2][1] + 0.04, now.pts[2][2]],
    compiler: [DR + 0.05, DRUM[1], 0],
    parent: [PAR_T[0] + MT * 0.62, PAR_T[1] + 0.03, 0], child: [CHD_T[0] + MT * 0.62, CHD_T[1] + 0.03, 0], press: () => [now.head[0] + 0.13, now.head[1] + 0.05, 0],
    gears: [XC - 0.12, GC[1][1] - GR - 0.1, 0.06], dial: [GD[0] + 0.08, GD[1] - GR - 0.17, 0], mini: [MINI[0] - 0.22, MINI[1] - MS * 0.75, 0],
    machine: [0, 0.5, 0], circuit: [0, -0.55, 0],
    wireParent: [XL - 0.62, (WY[0] + WY[1]) / 2 + 0.02, 0], wireChild: [XL - 0.62, (WY[2] + WY[3]) / 2 + 0.02, 0],
    copyGates: [XCOPY[0] - 0.04, WY[0] + 0.1, 0], turn1: [XB[0] - BW[0] / 2, WY[3] - 0.11, 0], turn2: [XB[1] - BW[1] / 2 + 0.12, WY[3] - 0.11, 0],
    steps: [0.1, WY[0] + 0.12, 0],
  };
  const deg = v => `${Math.round(Math.abs(v) * 180 / PI)}°`;
  const pyrOn = S => 1 - prog(S.rule_compile, 0.3, 0.6);
  const mOn = S => prog(S.rule_machine, 0.6, 1), cOn = S => prog(S.rule_circuit, 0.5, 1) * mOn(S), simpleOn = S => prog(S.rule_simple, 0.4, 1);
  const labels = [
    { text: ['Thicker arrow', ' · swaps more readily'], at: 'fast', cls: '', alpha: S => prog(S.rule_balls, 0.85, 1) * (1 - prog(S.rule_pyr, 0, 0.3)) * pyrOn(S) },
    { text: ['Bigger ball', ' · more common in the long run'], at: 'ballA', cls: '', alpha: S => prog(S.rule_balls, 0.4, 0.8) * (1 - prog(S.rule_pyr, 0, 0.3)) * pyrOn(S) },
  ];
  ['cA', 'cC', 'cG', 'cT'].forEach((a, i) => labels.push({ text: [M.KETS[i], ''], at: a, cls: '', minor: true,
    alpha: S => prog(S.rule_pyr, 0.6, 1) * (1 - prog(S.rule_path, 0.1, 0.4)) * pyrOn(S) }));
  ['p1', 'p2', 'p3'].forEach((a, k) => labels.push({ text: [String(k + 1), ''], at: a, cls: 'grn', minor: true,
    alpha: S => prog(S.rule_path, 0.5, 1) * prog(S.rule_time, M.POINTS[k] - 0.05, M.POINTS[k]) * pyrOn(S) }));
  labels.push(
    { text: () => ['The mix', ` · after ${now.t.toFixed(2)} swaps per letter`], at: 'mix', cls: 'cyn', alpha: S => prog(S.rule_path, 0.5, 1) * pyrOn(S) },
    { text: ['Long-run mix', ''], at: 'longrun', cls: 'cyn', alpha: S => prog(S.rule_path, 0.5, 1) * pyrOn(S) * prog(S.rule_time, 0.3, 0.8) },
    { text: ['Compiler', ' · a rule in, a circuit out'], at: 'compiler', cls: '', alpha: S => prog(S.rule_compile, 0.2, 0.5) * (1 - prog(S.rule_machine, 0.3, 0.7)) },
    { text: ['Parent', ''], at: 'parent', cls: '', alpha: S => mOn(S) * (1 - cOn(S)) },
    { text: ['Child', ''], at: 'child', cls: '', alpha: S => mOn(S) * (1 - cOn(S)) },
    { text: ['Copy', ' · the parent’s letter onto the child'], at: 'press', cls: 'cyn', alpha: S => mOn(S) * prog(S.rule_copy, 0.03, 0.12) * (1 - prog(S.rule_copy, 0.85, 0.95)) * (1 - cOn(S)) },
    { text: ['Turn', ' · as far as the branch is long'], at: 'gears', cls: 'cyn', alpha: S => mOn(S) * prog(S.rule_copy, 0.9, 1) * prog(S.rule_time, 0.02, 0.12) * (1 - cOn(S)) },
    { text: () => ['Branch length', ` · ${now.t.toFixed(2)} swaps per letter`], at: 'dial', cls: 'grn', alpha: S => mOn(S) * prog(S.rule_copy, 0.85, 1) * (1 - simpleOn(S)) },
    { text: ['The child’s mix', ' · the same path'], at: 'mini', cls: '', alpha: S => mOn(S) * prog(S.rule_copy, 0.9, 1) * prog(S.rule_time, 0.02, 0.12) * (1 - cOn(S)) },
    { text: ['Parent', ' p1, p0'], at: 'wireParent', cls: '', minor: true, alpha: cOn },
    { text: ['Child', ' c1, c0'], at: 'wireChild', cls: '', minor: true, alpha: cOn },
    { text: ['Copy', ' · two CNOT gates'], at: 'copyGates', cls: 'cyn', alpha: S => cOn(S) * (1 - simpleOn(S)) },
    { text: () => ['c1 turns', ' ' + deg(now.ang[now.parent])], at: 'turn1', cls: 'cyn', alpha: S => cOn(S) * (1 - simpleOn(S)) },
    { text: () => ['c0 turns', ` ${deg(now.ang[4 + 2 * now.parent])} or ${deg(now.ang[5 + 2 * now.parent])}, as c1 is 0 or 1`], at: 'turn2', cls: 'cyn', alpha: S => cOn(S) * (1 - simpleOn(S)) },
    { text: ['Simple steps', ` · ${NRY} turns of one qubit, ${NCX} links`], at: 'steps', cls: 'cyn', alpha: S => cOn(S) * simpleOn(S) },
  );
  const cam = {
    default: [-26, 20, 4.0, 0, 0.3, 0],
    rates: [16, 12, 4.0, 0, 0.32, 0],
    pyramid: [-22, 16, 3.9, 0, 0.3, 0],
    path: [-32, 24, 3.6, 0, 0.32, 0],
    compiler: [0, 20, 3.9, 0, -0.12, 0],
    machine: [0, 8, 3.3, -0.1, 0.52, 0],
    copy: [0, 8, 2.5, (XP + XC) / 2, 0.68, 0],
    turn: [12, 6, 2.7, 0.25, 0.42, 0],
    circuit: [0, 6, 4.4, -0.15, 0.12, 0],
    steps: [0, 4, 3.1, 0.15, -0.5, 0],
  };
  const LETTER_OPTS = M.LETTERS.split('').map(l => [l, l]);
  const controls = [
    { key: 'view', label: 'View', options: [['rule', 'Rule'], ['path', 'Path'], ['machine', 'Machine'], ['circuit', 'Circuit'], ['steps', 'Simple steps']] },
    { key: 'model', label: 'Rule', options: M.MODELS.map(m => [m.key, m.name]) },
    { key: 'start', label: 'Start', options: LETTER_OPTS, when: v => v.view === 'path' },
    { key: 'parent', label: 'Parent', options: LETTER_OPTS, when: v => v.view === 'machine' || v.view === 'circuit' || v.view === 'steps' },
    { key: 'time', label: 'Branch length', options: [['0.15', '0.15'], ['0.45', '0.45'], ['1', '1'], ['1.6', '1.6'], ['2', '2']], when: v => v.view !== 'rule' },
  ];
  function explore(c) {
    const v = c.view || 'path', mk = M.MODELS.findIndex(m => m.key === c.model), mach = v === 'machine' || v === 'circuit' || v === 'steps';
    const tm = parseFloat(c.time), li = l => Math.max(0, M.LETTERS.indexOf(l || 'A'));
    return {
      rule_balls: 1, rule_flow: 1, rule_pyr: v === 'rule' ? 0 : 1, rule_path: v === 'rule' ? 0 : 1,
      rule_time: isFinite(tm) ? clamp(tm, 0, 2) : 1, rule_model: mk >= 0 ? mk : M.MODELS.findIndex(m => m.key === M.DEFAULT),
      rule_start: li(c.start), rule_parent: li(c.parent),
      rule_compile: mach ? 1 : 0, rule_machine: mach ? 1 : 0, rule_copy: 1,
      rule_circuit: v === 'circuit' || v === 'steps' ? 1 : 0, rule_simple: v === 'steps' ? 1 : 0, rule_run: 1,
    };
  }
  // what the engine's Rule tab reads: live numbers for the model, branch length and letters chosen
  const API = {
    models: M.MODELS.map((m, i) => ({ i, key: m.key, name: m.name, note: m.note })),
    // the mix after t from letter `start` under model mi
    mix: (mi, start, t) => Array.from(M.path(mi, start, t)),
    longRun: mi => Array.from(PIS[mi]),
    rates: mi => Array.from(QS[mi]),
    // the circuit for a branch: angles (radians) for parent letter `par`: c1's, and c0's for c1 = 0 and 1
    angles: (mi, t, par) => { const a = M.angles(mi, t); return { c1: a[par], c0: [a[4 + 2 * par], a[5 + 2 * par]] }; },
    turn: (mi, t) => M.turnAngle(mi, t),
    steps: () => ({ turns: NRY, links: NCX, copy: 2 }),
    shown: () => ({ model: now.model, start: now.start, parent: now.parent, t: now.t }),
  };
  return Object.assign(set, {
    params: { rule_a: 1, rule_balls: 1, rule_flow: 1, rule_pyr: 1, rule_path: 1, rule_time: 1, rule_model: M.MODELS.findIndex(m => m.key === M.DEFAULT),
      rule_start: 0, rule_compile: 0, rule_machine: 0, rule_parent: 0, rule_copy: 1, rule_circuit: 0, rule_simple: 0, rule_run: 1 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};
