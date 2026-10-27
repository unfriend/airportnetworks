// The letters set of the mutation story (chapters 1 and 3): DNA as a text in four letters. A double helix of 24 base
// pairs turns slowly (rungs in the letters' colours, A-T and C-G); eight letters of its top strand peel away and
// straighten into a row of tiles, the ancestor of Figure 1 (MUT_DATA.fig1); two copies slide out of it and in each
// two letters swap with a flash (the tile turns over and comes back framed white: descendant 1's T->C at 5 and A->G at
// 6, then descendant 2's G->A at 3 and C->T at 8). Then the ancestor's first tile comes forward and opens into its two
// qubits (glass spheres, arrows up for 0 and down for 1); the four codes in turn (A |00>, C |01>, G |10>, T |11>); the
// arrows tilt into a mix (by default the rule's mix at point 2: MMATH.path(uneven, A, POINTS[1])), the tile turns
// into a '?' with a ring in four colours (the mix's shares); and the read-outs: the arrows spin like a coin, land on a
// letter, a small tile pops out and falls onto its pile (MMATH.sample by index, so seeking gives the same piles); four
// piles, one per letter, grow as tall as the chances.
// Everything follows the params and t; only the switch of code (a step param) eases in its own time (0.6 s; a seek or
// the first frame shows the new code at once), as the qubits story's cube does.
SETS.letters = function (K) {
  const { THREE, clamp, lerp, prog, smooth } = K;
  const set = K.newSet('letters');
  const M = MMATH, D = MUT_DATA, LK = MLOOK(K, set);
  const PI = Math.PI, TAU = PI * 2;
  const ANC = M.toIdx(D.fig1.ancestor), NL = ANC.length;
  // the two copies of Figure 1: their swaps (MUT_DATA gives 1-based positions)
  const COPIES = ['d1', 'd2'].map(k => ({ key: k, seq: M.toIdx(D.fig1[k]),
    swaps: D.fig1.swaps[k].map(([pos, a, b]) => ({ j: pos - 1, from: M.idx(a), to: M.idx(b) })) }));
  const RULE = M.model(M.DEFAULT), EVEN = new Float64Array([0.25, 0.25, 0.25, 0.25]);
  const READ_MAX = 400;   // the most read-outs the piles hold (explore: read out 1 or 100 more)

  // ---------------------------------------------------------------- the helix
  // B-DNA's proportions: 10.5 pairs a turn, the two strands 140 degrees apart round the axis (the grooves). The axis
  // runs along x; the top strand carries the ancestor's eight letters at bases AT .. AT + 7, the rest seeded.
  const NBP = 24, AT = 8, RISE = 0.096, HR = 0.27, TWIST = TAU / 10.5, GROOVE = PI * 0.78, SUB = 3, SPIN = 0.3;
  const X0 = -(NBP - 1) / 2 * RISE, SEQ = new Uint8Array(NBP), rr = K.rng(11);
  for (let k = 0; k < NBP; k++) SEQ[k] = k >= AT && k < AT + NL ? ANC[k - AT] : Math.floor(rr() * 4);
  // (A-T and C-G: the partner of letter i is 3 - i)
  const hp = (s, u, spin, out) => {
    const a = u * TWIST + spin + (s ? GROOVE : 0);
    out[0] = X0 + u * RISE; out[1] = HR * Math.cos(a); out[2] = HR * Math.sin(a);
    return out;
  };
  const BONE = [0.62, 0.72, 0.9];

  // ---------------------------------------------------------------- the rows: the ancestor and its two copies
  // fanned out a little in depth, each copy lower and further forward (a family in the making)
  const Y = new THREE.Vector3(0, 1, 0), SP = 0.2, TS = 0.17;
  const ROWS = [{ c: [0, 0.52, -0.12], yaw: 0 }, { c: [-0.26, 0.04, 0.16], yaw: 0.2 }, { c: [0.26, -0.44, 0.44], yaw: -0.2 }];
  ROWS.forEach(R => {
    R.q = new THREE.Quaternion().setFromAxisAngle(Y, R.yaw);
    R.pos = [...Array(NL)].map((_, j) => [R.c[0] + Math.cos(R.yaw) * (j - 3.5) * SP, R.c[1], R.c[2] - Math.sin(R.yaw) * (j - 3.5) * SP]);
    // the strand behind the tiles
    R.back = R.pos.map(p => [p[0] - Math.sin(R.yaw) * 0.05, p[1], p[2] - Math.cos(R.yaw) * 0.05]);
  });

  // ---------------------------------------------------------------- the qubits and the piles
  const HERO = [0, 0.64, 0.3], HS = 0.28, QP = [[-0.42, 0.04, 0.3], [0.42, 0.04, 0.3]], QR = 0.25;
  const PILE_X = [-0.63, -0.21, 0.21, 0.63], PILE_Y = -1.04, PILE_Z = 0.5, PT = 0.09, TH = PT * 0.24 + 0.004;
  const QFLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -PI / 2);

  const tubes = LK.tubes(340), balls = LK.balls(110), tiles = LK.tiles(440), glass = LK.glass(2), rings = LK.rings(16),
    cones = LK.cones(2), halos = LK.halos(40);
  set.group.add(tubes.mesh, balls.mesh, tiles.mesh, glass.mesh, rings.mesh, cones.mesh, halos.mesh);
  const QPOOLS = { glass, rings, tubes, cones, balls, halos };

  // scratch (nothing is allocated per frame)
  const _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0], _d = [0, 0, 0], _e = [0, 0, 0], _f = [0, 0, 0];
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
  const _vx = new THREE.Vector3(), _vy = new THREE.Vector3(), _vz = new THREE.Vector3();
  const lerp3 = (out, a, b, s) => { out[0] = a[0] + (b[0] - a[0]) * s; out[1] = a[1] + (b[1] - a[1]) * s; out[2] = a[2] + (b[2] - a[2]) * s; return out; };
  const copy3 = (out, a) => { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; };
  // a quaternion that turns a tile to face along n with its letter's top along u (u perpendicular to n)
  function faceQ(out, n, u) {
    _vz.set(n[0], n[1], n[2]).normalize(); _vy.set(u[0], u[1], u[2]).normalize(); _vx.crossVectors(_vy, _vz);
    _m4.makeBasis(_vx, _vy, _vz);
    return out.setFromRotationMatrix(_m4);
  }
  // a ring of 48 short tubes round c (across 'axis'), split into four arcs as long as the shares p (A at the top,
  // then C, G, T clockwise as seen from the axis' side)
  const RING_N = 48, _u = [0, 0, 0], _v = [0, 0, 0];
  function shareRing(c, axis, R, r, p, alpha) {
    if (alpha <= 0.004) return;
    const al = Math.hypot(axis[0], axis[1], axis[2]) || 1, ax = axis[0] / al, ay = axis[1] / al, az = axis[2] / al;
    // u: up, kept perpendicular to the axis; v = u x axis (clockwise seen from the axis' side)
    let ux = -ay * ax, uy = 1 - ay * ay, uz = -ay * az;
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = uy * az - uz * ay, vy = uz * ax - ux * az, vz = ux * ay - uy * ax;
    const tot = (p[0] + p[1] + p[2] + p[3]) || 1;
    let L = 0, edge = p[0] / tot;
    for (let s = 0; s < RING_N; s++) {
      const f = (s + 0.5) / RING_N;
      while (L < 3 && f > edge) { L++; edge += p[L] / tot; }
      const a0 = s / RING_N * TAU, a1 = (s + 1) / RING_N * TAU;
      _u[0] = c[0] + R * (Math.cos(a0) * ux + Math.sin(a0) * vx); _u[1] = c[1] + R * (Math.cos(a0) * uy + Math.sin(a0) * vy); _u[2] = c[2] + R * (Math.cos(a0) * uz + Math.sin(a0) * vz);
      _v[0] = c[0] + R * (Math.cos(a1) * ux + Math.sin(a1) * vx); _v[1] = c[1] + R * (Math.cos(a1) * uy + Math.sin(a1) * vy); _v[2] = c[2] + R * (Math.cos(a1) * uz + Math.sin(a1) * vz);
      tubes.add(_u, _v, r, LK.LCOL[L], alpha, 0);
    }
  }
  // the switch of code eases in its own time (see the header)
  const sw = { from: 0, to: 0, k: 1, first: true }, heroQ = new THREE.Quaternion(), RING_AX = [0, 0, 1];
  // what the anchors and labels read (kept current by update)
  const now = { code: 0, mixed: 0, heroS: HS, heroA: 1, p: new Float64Array(4), counts: new Uint16Array(4), n: 0, layers: new Float64Array(4), F: 1, hero: HERO.slice(),
    q: [QP[0].slice(), QP[1].slice()], qr: QR, open: 0 };
  const pMix = new Float64Array(4), pCode = new Float64Array(4), pShow = new Float64Array(4), bl = new Float64Array(6);
  const QO = [{ at: 0, col: LK.INK, glow: 0, spin: 0 }, { at: 3, col: LK.INK, glow: 0, spin: 0 }];
  // the mix being read: the rule's mix after a branch of length tm from letter c, or the even mix
  function targetMix(S, c, out) {
    if (Math.round(S.letters_target) === 1) { out.set(EVEN); return out; }
    return M.path(RULE, c, clamp(S.letters_time, 0, 3), out);
  }

  function update(S, t, dt) {
    LK.depth();
    tubes.begin(); balls.begin(); tiles.begin(); glass.begin(); rings.begin(); cones.begin(); halos.begin();
    const spin = t * SPIN, hA = clamp(S.letters_helix, 0, 1), peel = clamp(S.letters_peel, 0, 1), op = clamp(S.letters_open, 0, 1);
    const rowsA = 1 - prog(op, 0.05, 0.5);
    now.open = op;

    // ---- the helix: the partner strand, its rungs, and the top strand where it has not peeled away
    const peelJ = j => prog(peel, 0.25 + 0.05 * j, 0.65 + 0.05 * j), growJ = j => prog(peel, 0.02 * j, 0.25 + 0.02 * j);
    if (hA > 0.004 || peel > 0) {
      for (let k = 0; k < NBP; k++) {
        const pj = k - AT, isP = pj >= 0 && pj < NL, g = isP ? growJ(pj) : 0, m = isP ? peelJ(pj) : 0;
        hp(0, k, spin, _a); hp(1, k, spin, _b);
        // rungs: two halves in the letters' colours, a small gap between them
        if (hA > 0.004) {
          lerp3(_c, _a, _b, 0.47); lerp3(_d, _b, _a, 0.47);
          if (g < 0.999) { tubes.add(_a, _c, 0.024, LK.LCOL[SEQ[k]], hA * (1 - g), 0); balls.add(_c, 0.024, LK.LCOL[SEQ[k]], hA * (1 - g)); }
          tubes.add(_b, _d, 0.024, LK.LCOL[3 - SEQ[k]], hA, 0); balls.add(_d, 0.024, LK.LCOL[3 - SEQ[k]], hA);
          balls.add(_b, 0.034, BONE, hA);
          if (m < 0.999) balls.add(_a, 0.034, BONE, hA * (1 - m));
        }
        // the backbones: smooth helical tubes (the peeling part straightens towards its row)
        if (k < NBP - 1) for (let s = 0; s < SUB; s++) {
          const u0 = k + s / SUB, u1 = k + (s + 1) / SUB;
          if (hA > 0.004) tubes.add(hp(1, u0, spin, _c), hp(1, u1, spin, _d), 0.02, BONE, hA, 0);
          const q0 = k - AT + s / SUB, q1 = k - AT + (s + 1) / SUB, in0 = q0 >= 0 && q0 <= NL - 1, in1 = q1 >= 0 && q1 <= NL - 1;
          hp(0, u0, spin, _c); hp(0, u1, spin, _d);
          if (in0 && in1) {
            // the peeling stretch: each point eases from the helix to the line behind the row
            const ja = Math.floor(q0), fa = q0 - ja, jb = Math.min(NL - 1, ja + 1);
            const ma = lerp(peelJ(ja), peelJ(jb), fa), m1 = lerp(peelJ(Math.floor(q1)), peelJ(Math.min(NL - 1, Math.floor(q1) + 1)), q1 - Math.floor(q1));
            lerp3(_e, ROWS[0].back[ja], ROWS[0].back[jb], fa); lerp3(_c, _c, _e, smooth(ma));
            const jc = Math.floor(q1), jd = Math.min(NL - 1, jc + 1);
            lerp3(_f, ROWS[0].back[jc], ROWS[0].back[jd], q1 - jc); lerp3(_d, _d, _f, smooth(m1));
            const a = Math.max(hA, Math.min(ma, m1)) * lerp(1, rowsA, Math.min(ma, m1));
            tubes.add(_c, _d, 0.02, BONE, a, 0);
          } else if (in0 || in1) {
            tubes.add(_c, _d, 0.02, BONE, hA * (1 - peelJ(in0 ? NL - 1 : 0)), 0);   // (the break where the strand leaves)
          } else if (hA > 0.004) tubes.add(_c, _d, 0.02, BONE, hA, 0);
        }
      }
    }

    // ---- the ancestor's tiles: they grow out of their rungs, peel away and line up (the first may come forward)
    const heroK = prog(op, 0, 0.45);
    for (let j = 0; j < NL; j++) {
      const k = AT + j, g = growJ(j), m = smooth(peelJ(j));
      let al = g * Math.max(hA, m), size = lerp(0.1 * g, TS, m);
      hp(0, k, spin, _a); hp(1, k, spin, _b); lerp3(_c, _a, _b, 0.25);
      _d[0] = 0; _d[1] = _b[1] - _a[1]; _d[2] = _b[2] - _a[2];
      faceQ(_q, [1, 0, 0], _d);
      _q.slerp(ROWS[0].q, m);
      lerp3(_e, _c, ROWS[0].pos[j], m); _e[2] += 0.22 * Math.sin(PI * m);
      if (j === 0 && op > 0) {
        // the hero: forward, bigger, facing you (drawn with its qubits below)
        lerp3(now.hero, _e, HERO, smooth(heroK)); now.hero[2] += 0.25 * Math.sin(PI * heroK);
        now.heroS = lerp(size, HS, smooth(heroK)); now.heroA = lerp(al, 1, heroK);
        heroQ.copy(_q).slerp(_qr.set(0, 0, 0, 1), heroK);
        continue;
      }
      if (al * rowsA > 0.004) tiles.add(_e, _q, size, ANC[j], al * rowsA, 0, 0);
    }
    // the row's strand, once lined up, stays with it

    // ---- the copies: slide out of the ancestor's row, then two letters swap in each
    for (let c = 0; c < 2; c++) {
      const cp = clamp(S[c ? 'letters_copy2' : 'letters_copy1'], 0, 1), mu = clamp(S[c ? 'letters_mut2' : 'letters_mut1'], 0, 1), R = ROWS[c + 1];
      const ca = prog(cp, 0, 0.12) * rowsA;
      if (ca <= 0.004) continue;
      // the copy's way: a faint green trace from the ancestor (time passing)
      _a[0] = ROWS[0].c[0]; _a[1] = ROWS[0].c[1] - 0.11; _a[2] = ROWS[0].c[2];
      _b[0] = lerp(_a[0], R.c[0], prog(cp, 0, 0.8)); _b[1] = lerp(_a[1], R.c[1] + 0.11, prog(cp, 0, 0.8)); _b[2] = lerp(_a[2], R.c[2], prog(cp, 0, 0.8));
      tubes.add(_a, _b, 0.006, LK.GREENLIT, 0.5 * ca, 9);
      for (let j = 0; j < NL; j++) {
        const s = smooth(prog(cp, 0.03 * j, 0.75 + 0.03 * j));
        lerp3(_e, ROWS[0].pos[j], R.pos[j], s); _e[2] += 0.16 * Math.sin(PI * s);
        _q.copy(ROWS[0].q).slerp(R.q, s);
        let L = ANC[j], frame = 0, glow = 0;
        const si = c ? 1 : 0, w = COPIES[si].swaps.findIndex(x => x.j === j);
        if (w >= 0) {
          const f = prog(mu, w * 0.5 + 0.05, w * 0.5 + 0.42), sp = COPIES[si].swaps[w];
          L = f < 0.5 ? sp.from : sp.to; frame = prog(f, 0.55, 0.9); glow = 0.9 * Math.sin(PI * f);
          _q.multiply(_q2.setFromAxisAngle(Y, PI * f));   // the tile turns over and shows its new letter
          if (f > 0.02 && f < 0.98) {
            halos.add(_e, 0.35 + 0.4 * f, LK.LCOL[sp.to], 0.8 * Math.sin(PI * f) * ca);
            _b[0] = Math.sin(R.yaw); _b[1] = 0; _b[2] = Math.cos(R.yaw);
            rings.add(_e, _b, 0.1 + 0.22 * f, 0.008, LK.WHITE, (1 - f) * ca, 0);
          }
        }
        tiles.add(_e, _q, TS, L, ca, frame, glow);
        if (j < NL - 1) {
          const s2 = smooth(prog(cp, 0.03 * (j + 1), 0.75 + 0.03 * (j + 1)));
          tubes.add(lerp3(_a, ROWS[0].back[j], R.back[j], s), lerp3(_b, ROWS[0].back[j + 1], R.back[j + 1], s2), 0.014, BONE, ca * prog(cp, 0.7, 1), 0);
        }
      }
    }

    // ---- the hero tile and its two qubits
    const mixL = clamp(S.letters_mix, 0, 1), target = clamp(Math.round(S.letters_code), 0, 3);
    {
      const snap = sw.first || !(dt > 0) || dt > 0.25;
      sw.first = false;
      if (target !== sw.to) { if (sw.k >= 0.5) sw.from = sw.to; sw.to = target; sw.k = snap ? 1 : 0; }
      else sw.k = snap ? 1 : Math.min(1, sw.k + dt / 0.6);
    }
    const ks = smooth(sw.k);
    // the code shown, qubit by qubit (each arrow turns on its own: no mix of the two while the code changes)
    const th1 = PI * lerp(sw.from >> 1, sw.to >> 1, ks), th2 = PI * lerp(sw.from & 1, sw.to & 1, ks);
    const c1 = Math.cos(th1 / 2), s1 = Math.sin(th1 / 2), c2 = Math.cos(th2 / 2), s2 = Math.sin(th2 / 2);
    pCode[0] = c1 * c1 * c2 * c2; pCode[1] = c1 * c1 * s2 * s2; pCode[2] = s1 * s1 * c2 * c2; pCode[3] = s1 * s1 * s2 * s2;
    targetMix(S, sw.to, pMix);
    for (let i = 0; i < 4; i++) now.p[i] = pShow[i] = lerp(pCode[i], pMix[i], mixL);
    now.code = sw.to; now.mixed = mixL;

    // read-outs: read-out k (1-based) plays while letters_reads runs from k - 1 to k
    const reads = clamp(S.letters_reads, 0, READ_MAX), kNow = Math.ceil(reads - 1e-6), fNow = kNow >= 1 ? reads - (kNow - 1) : 1;
    const seed = Math.round(S.letters_seed) || 1, nDone = fNow >= 0.95 ? kNow : kNow - 1;
    const cnt = now.counts;
    cnt[0] = cnt[1] = cnt[2] = cnt[3] = 0;
    let flyL = -1, flySlot = 0;
    for (let k = 1; k <= kNow; k++) {
      const L = M.sample(pShow, seed, k);
      if (k === kNow && fNow < 0.95) { flyL = L; flySlot = cnt[L]; break; }
      cnt[L]++;
    }
    now.n = nDone;
    const F = kNow <= 30 ? 1 : kNow <= 120 ? 2 : kNow <= 270 ? 3 : 4;   // (tiles a layer, a side: the piles stay low)
    now.F = F;
    let spinA = 0, coll = 0;
    if (flyL >= 0) {
      spinA = 5 * PI * smooth(prog(fNow, 0, 0.36));
      coll = prog(fNow, 0.3, 0.46) * (1 - prog(fNow, 0.62, 0.95));
      // the arrows land on the letter read, then return to the mix (a fresh copy for the next read-out)
      for (let i = 0; i < 4; i++) pShow[i] = lerp(pShow[i], i === flyL ? 1 : 0, coll);
    }

    const qa = prog(op, 0.35, 1);
    if (op > 0.004) {
      // the tile: the code shown, or '?' once mixed (it turns over at each change)
      const mixFlip = prog(mixL, 0.25, 0.75), turn = PI * (ks < 1 ? ks : 0) + PI * mixFlip;
      const L = mixFlip >= 0.5 ? 4 : ks < 0.5 ? sw.from : sw.to;
      _q.copy(heroQ).multiply(_q2.setFromAxisAngle(Y, turn));
      const pop = flyL >= 0 ? Math.sin(PI * prog(fNow, 0.36, 0.56)) : 0;
      tiles.add(now.hero, _q, now.heroS, L, now.heroA, 0, 0.15 + 0.5 * pop);
      shareRing(now.hero, RING_AX, HS * 0.82, 0.011, now.p, now.heroA * prog(mixL, 0.4, 1));
      // the qubits open out of the tile
      for (let q = 0; q < 2; q++) {
        lerp3(now.q[q], now.hero, QP[q], smooth(qa));
        const R = QR * smooth(qa);
        now.qr = R;
        M.bloch(pShow, bl);
        QO[q].spin = spinA; QO[q].glow = 0.25 + 0.6 * coll;
        if (R > 0.01) LK.qubit(QPOOLS, now.q[q], R, bl, qa, QO[q]);
      }
    }

    // ---- the piles: one per letter, tiles lying flat, as many as were read
    const pileA = prog(reads, 0, 0.6) * qa, g = F, cell = PT * 1.08;
    const slotPos = (L, m, out) => {
      const per = g * g, layer = Math.floor(m / per), c = m % per;
      out[0] = PILE_X[L] + (c % g - (g - 1) / 2) * cell; out[1] = PILE_Y + (layer + 0.5) * TH; out[2] = PILE_Z + (Math.floor(c / g) - (g - 1) / 2) * cell;
      return out;
    };
    if (pileA > 0.004) {
      for (let L = 0; L < 4; L++) {
        _a[0] = PILE_X[L]; _a[1] = PILE_Y - 0.004; _a[2] = PILE_Z;
        rings.add(_a, [0, 1, 0], 0.08 + 0.05 * (g - 1), 0.006, LK.LCOL[L], 0.7 * pileA, 0);
        for (let m = 0; m < cnt[L]; m++) {
          slotPos(L, m, _b);
          _q.copy(QFLAT).premultiply(_q2.setFromAxisAngle(Y, (M.hash(L * 4096 + m, 3) - 0.5) * 0.4));
          tiles.add(_b, _q, PT, L, pileA, 0, 0);
        }
        now.layers[L] = Math.ceil(cnt[L] / (g * g));
      }
    }
    // the read-out in flight: it pops out of the tile and falls onto its pile
    if (flyL >= 0 && qa > 0.004) {
      const s = smooth(prog(fNow, 0.46, 0.95)), sz = lerp(0.14, PT, s);
      slotPos(flyL, flySlot, _b);
      lerp3(_a, now.hero, _b, s); _a[1] += 0.35 * Math.sin(PI * s); _a[2] += 0.25 * Math.sin(PI * s);
      _q.set(0, 0, 0, 1).slerp(QFLAT, s);
      const pa = prog(fNow, 0.4, 0.5) * qa;
      tiles.add(_a, _q, sz, flyL, pa, 0, 0.5 * (1 - s));
      halos.add(_a, 0.25, LK.LCOL[flyL], 0.5 * pa * (1 - s));
    }

    tubes.end(); balls.end(); tiles.end(); glass.end(); rings.end(); cones.end(); halos.end();
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const rowEnd = R => [R.pos[0][0] - 0.16 * Math.cos(R.yaw), R.pos[0][1] + 0.02, R.pos[0][2] + 0.16 * Math.sin(R.yaw)];
  const _t = [0, 0, 0];
  const anchors = {
    helix: [X0 + 3 * RISE, HR + 0.1, 0], centre: [0, 0, 0],
    ancestor: rowEnd(ROWS[0]), copy1: rowEnd(ROWS[1]), copy2: rowEnd(ROWS[2]),
    ancMid: ROWS[0].c.slice(), copy1Mid: ROWS[1].c.slice(), copy2Mid: ROWS[2].c.slice(),
    swap1: ROWS[1].pos[COPIES[0].swaps[0].j].slice(), swap2: ROWS[2].pos[COPIES[1].swaps[0].j].slice(),
    tile: () => [now.hero[0] + HS * 0.62, now.hero[1] + 0.04, now.hero[2]],
    qubit1: () => [now.q[0][0] - 0.06, now.q[0][1] - now.qr * 1.55, now.q[0][2]],
    qubit2: () => [now.q[1][0] - 0.06, now.q[1][1] - now.qr * 1.55, now.q[1][2]],
    piles: [0, PILE_Y + 0.02, PILE_Z + 0.3],
  };
  for (let L = 0; L < 4; L++) anchors['pile' + M.LETTERS[L]] = () => { _t[0] = PILE_X[L] - 0.03; _t[1] = PILE_Y + now.layers[L] * TH + 0.06; _t[2] = PILE_Z; return _t.slice(); };
  const swapsTxt = c => ' · ' + COPIES[c].swaps.map(s => `${M.LETTERS[s.from]}→${M.LETTERS[s.to]}`).join(', ');
  const rowsOn = S => 1 - prog(S.letters_open, 0.05, 0.4);
  const labels = [
    { text: ['DNA', ' · two strands of letter pairs'], at: 'helix', cls: 'cyn', alpha: S => clamp(S.letters_helix, 0, 1) * (1 - prog(S.letters_peel, 0, 0.3)) },
    { text: ['Ancestor', ''], at: 'ancestor', cls: '', alpha: S => prog(S.letters_peel, 0.85, 1) * rowsOn(S) },
    { text: ['Copy 1', swapsTxt(0)], at: 'copy1', cls: 'grn', alpha: S => prog(S.letters_copy1, 0.6, 1) * rowsOn(S) * prog(S.letters_mut1, 0, 0.05) },
    { text: ['Copy 2', swapsTxt(1)], at: 'copy2', cls: 'grn', alpha: S => prog(S.letters_copy2, 0.6, 1) * rowsOn(S) * prog(S.letters_mut2, 0, 0.05) },
    { text: () => (now.mixed > 0.5 ? ['A mix', ' of all four letters'] : [M.KETS[now.code], ' · ' + M.LETTERS[now.code]]), at: 'tile', cls: 'cyn', alpha: S => prog(S.letters_open, 0.6, 1) },
    { text: ['First qubit', ''], at: 'qubit1', cls: '', alpha: S => prog(S.letters_open, 0.7, 1) * (1 - prog(S.letters_reads, 0, 0.5)) },
    { text: ['Second qubit', ''], at: 'qubit2', cls: '', alpha: S => prog(S.letters_open, 0.7, 1) * (1 - prog(S.letters_reads, 0, 0.5)) },
  ];
  for (let L = 0; L < 4; L++) {
    labels.push({ text: () => [M.LETTERS[L], ' · ' + now.counts[L]], at: 'pile' + M.LETTERS[L], cls: '', minor: false,
      alpha: S => prog(S.letters_reads, 0.3, 1) * prog(S.letters_open, 0.8, 1) });
  }
  const cam = {
    default: [0, 9, 3.5, 0, 0.05, 0],
    helix: [-26, 14, 3.0, 0, 0, 0],
    peel: [8, 12, 3.4, 0, 0.18, 0.05],
    rows: [12, 10, 3.7, 0, 0.04, 0.12],
    qubits: [0, 6, 2.9, 0, 0.2, 0.3],
    reads: [0, 14, 3.6, 0, -0.22, 0.35],
  };
  const MIXES = [['A', 'A'], ['C', 'C'], ['G', 'G'], ['T', 'T'], ['even', 'Even'], ['rule', 'The rule\'s mix']];
  const controls = [
    { key: 'view', label: 'View', options: [['helix', 'Helix'], ['copies', 'Copies'], ['qubits', 'Qubits']] },
    { key: 'mix', label: 'Letter or mix', options: MIXES, when: v => v.view === 'qubits' },
    { key: 'time', label: 'Branch length', options: [['0.15', '0.15'], ['0.45', '0.45'], ['1', '1'], ['1.6', '1.6']], when: v => v.view === 'qubits' && v.mix === 'rule' },
  ];
  // c.reads (how many read-outs, from the engine's Letters tab) and c.seed (read again) are optional
  function explore(c) {
    const v = c.view || 'qubits', q = v === 'qubits', mix = c.mix || 'A', li = M.LETTERS.indexOf(mix);
    const tm = parseFloat(c.time);
    return {
      letters_helix: v === 'helix' ? 1 : 0, letters_peel: v === 'helix' ? 0 : 1,
      letters_copy1: v === 'copies' ? 1 : 0, letters_mut1: v === 'copies' ? 1 : 0, letters_copy2: v === 'copies' ? 1 : 0, letters_mut2: v === 'copies' ? 1 : 0,
      letters_open: q ? 1 : 0, letters_code: li >= 0 ? li : 0, letters_mix: li >= 0 ? 0 : 1, letters_target: mix === 'even' ? 1 : 0,
      letters_time: isFinite(tm) ? clamp(tm, 0, 3) : M.POINTS[1],
      letters_reads: q ? clamp(+c.reads || 0, 0, READ_MAX) : 0, letters_seed: Math.max(1, Math.round(+c.seed || 1)),
    };
  }
  // what the engine's Letters tab reads: the mix shown, the piles, and the chances of any choice
  const API = {
    READ_MAX,
    mix: () => Array.from(now.p),
    counts: () => Array.from(now.counts),
    reads: () => now.n,
    chances: (mix, time) => {
      const li = M.LETTERS.indexOf(mix);
      if (li >= 0) return [0, 1, 2, 3].map(i => (i === li ? 1 : 0));
      if (mix === 'even') return Array.from(EVEN);
      return Array.from(M.path(RULE, 0, isFinite(+time) ? +time : M.POINTS[1]));
    },
    bloch: mix => Array.from(M.bloch(API.chances(mix))),
  };
  return Object.assign(set, {
    params: { letters_a: 1, letters_helix: 1, letters_peel: 0, letters_copy1: 0, letters_mut1: 0, letters_copy2: 0, letters_mut2: 0,
      letters_open: 0, letters_code: 0, letters_mix: 0, letters_target: 0, letters_time: M.POINTS[1], letters_reads: 0, letters_seed: 1 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};
