// The cohort set of the topo story (chapters 5 and 6): the 123 slides of the cohort and what topocyte learns from them,
// all read from TOPO_DATA (h0 for pieces, h1 for loops: cohort_dim) through TDATA. A rack of 123 glass slides standing
// in two rows, the healthy and the cirrhotic, each with its own curve (its unit Betti curve, the figure scripts' exact
// envelope) standing on it as a lit ribbon; the ribbons light one after another, then the classes' mean curves. The two
// main shapes (phi) hover above with their shares of the variation (fve). The slides fly into the space of their scores
// (shape 1, 2 and 3 across, up and towards you, in a cube); the classifier's wall (intercept + coef . scores = 0 with
// the fourth score at its mean, 0) sweeps in between the clouds; each slide glides to its log-odds (logOdds) along an
// axis through the wall, then drops into one of four stacks by its held-out prediction against its class (held, y).
// Beside them the weight per radius: a glass column on the tower's log ruler, gamma swinging red (cirrhosis) and blue
// (healthy) at each height, the classes' means beside it, the windows' shares (TDATA.share, the poster's windows) as
// glowing rings round the column at their heights, sized by the share, that then drop into one stack: the gap. Nothing
// here is computed but looked up and placed: scores, curves, the wall's plane and the log-odds are stored; the shares
// are sums of stored fine shares; the odds factor e^gap is the one number formed from them. Everything follows the
// params and t.
SETS.cohort = function (K) {
  const { THREE, clamp, lerp, prog, smooth } = K;
  const set = K.newSet('cohort');
  const T = TDATA, D = T.D, LK = TLOOK(K, set), PI = Math.PI, UP = [0, 1, 0];
  const N = D.labels.length, CLS = D.labels;
  const fve = dim => D[dim ? 'h1' : 'h0'].fve;

  // ---------------------------------------------------------------- pools (draw calls: one each)
  const slides = LK.slides(N), DIMS = slides.dims;
  const ribbons = LK.ribbons(N, 168);    // the slides' own curves (at most 165 points)
  const big = LK.ribbons(8, 700);        // the means, the shapes, gamma (up to 685 points)
  const tubes = LK.tubes(240), rings = LK.rings(24), halos = LK.halos(N + 16), boxes = LK.boxes(N + 4), sheet = LK.sheet(24), cones = LK.cones(6);
  // glass and guides never write depth (the axes, the column, the drums: things seen through)
  tubes.mesh.material.userData.fixed = true; tubes.mesh.material.depthWrite = false;
  for (const p of [boxes, rings, cones, tubes, slides, ribbons, big, halos, sheet]) set.group.add(p.mesh);

  // ---------------------------------------------------------------- colours
  const WHITE = LK.WHITE, CYAN = LK.CYAN, GREEN = K.rgb('#3ee08f'), BASE = K.rgb('#1b2638'), WALL = K.rgb('#d6ecff');
  const CL = [LK.HEALTHY, LK.CIRR], CLIT = [LK.HEALTHYLIT, LK.CIRRLIT];
  const curveCol = dim => (dim ? LK.LOOP : LK.PIECE);

  // ---------------------------------------------------------------- the rack: two rows standing in slots, face to you
  // (the healthy row left, the cirrhotic right, each in slide order; the slots step up towards the back, so every curve
  // shows over the one in front of it)
  const RACK = { L: 0.62, x: [-0.36, 0.36], zf: 0.95, pz: 0.03, step: 0.004, foot: 0.012, rh: 0.3 };
  const RW = RACK.L * DIMS.wid;                       // a standing slide's height
  const ROWS = [[], []];
  for (let i = 0; i < N; i++) ROWS[CLS[i] ? 1 : 0].push(i);
  const SLOT = new Int16Array(N), ROWN = Math.max(ROWS[0].length, ROWS[1].length);
  ROWS.forEach(r => r.forEach((i, k) => { SLOT[i] = k; }));
  const RP = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) {
    const base = RACK.foot + RACK.step * SLOT[i];
    RP[3 * i] = RACK.x[CLS[i] ? 1 : 0]; RP[3 * i + 1] = base + RW / 2; RP[3 * i + 2] = RACK.zf - SLOT[i] * RACK.pz;
  }
  const RIB_X0 = DIMS.label + 0.025, RIB_W = 1 - RIB_X0 - 0.025;   // where a slide's ribbon runs, in slide lengths
  const MEAN_Z = RACK.zf + 0.17;                                     // the means stand in front of their rows

  // ---------------------------------------------------------------- the space of the scores, and what lies in it
  const C = [0, 0.95, 0], HS = 0.8, FILL = 0.9;   // the cube: its centre, half its side, the share of it the cloud spans
  const SC = 0.11;                                 // a slide's length in the cloud
  const CORN = [], EDGE = [];
  for (let k = 0; k < 8; k++) CORN.push([k & 1 ? HS : -HS, k & 2 ? HS : -HS, k & 4 ? HS : -HS]);
  for (let a = 0; a < 8; a++) for (const b of [1, 2, 4]) if (!(a & b)) EDGE.push([a, a | b]);
  // the four stacks by the held-out result (healthy right, healthy wrong, cirrhosis wrong, cirrhosis right): slides
  // lying flat, turned so their labels face you, a column of labels in the class's colour
  const STK = { x: [-0.96, -0.36, 0.36, 0.96], z: 0.08, size: 0.34, pitch: 0.0135 };
  // the weight per radius: the column (the tower's ruler: 1.5 µm at its foot, 60 µm at TH), gamma swinging WG to the
  // sides, the means beside it, and the gap's stack in front and to the left
  const G = { x: 2.05, z: 0, TH: 1.6, WG: 0.42, xm: 2.05 + 0.42 + 0.2, WM: 0.3, xs: 1.3, zs: 0.36, rs: 0.1, k: 0.11 };
  const COL_TICKS = [2, 5, 10, 20, 50];
  const qStand = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), PI / 2);   // on its long edge, face to +z
  const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI / 2);    // flat, its label towards you

  // a model's placements (pieces 0, loops 1): the cloud, the wall, the log-odds axis, the stacks, the windows
  function model(dim) {
    const H = D[dim ? 'h1' : 'h0'], sc = H.scores;
    const mid = [0, 0, 0], half = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < N; i++) { lo = Math.min(lo, sc[i][k]); hi = Math.max(hi, sc[i][k]); }
      mid[k] = (lo + hi) / 2; half[k] = (hi - lo) / 2 || 1;
    }
    const s2u = HS * FILL;   // a half-range of a score in units
    const CP = new Float32Array(3 * N);
    for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) CP[3 * i + k] = (sc[i][k] - mid[k]) / half[k] * s2u;
    // the wall: intercept + sum of coef_k x score_k = 0 with the fourth score at its mean (0); in the cube's units a.x + b0
    // = 0 (x from the cube's centre), so it rises by |a| per unit along its normal n
    const a = [0, 1, 2].map(k => H.coef[k] * half[k] / s2u), na = Math.hypot(a[0], a[1], a[2]), n = a.map(v => v / na);
    const b0 = H.intercept + H.coef[0] * mid[0] + H.coef[1] * mid[1] + H.coef[2] * mid[2];
    // the log-odds axis through the wall along n: a slide at log-odds L sits (L - b0) / |a| along it from the centre,
    // its offset across the axis shrunk (where the wall reads its value, with the fourth score now in)
    const AP = new Float32Array(3 * N);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < N; i++) {
      const L = H.logOdds[i], c = [CP[3 * i], CP[3 * i + 1], CP[3 * i + 2]], dn = c[0] * n[0] + c[1] * n[1] + c[2] * n[2], al = (L - b0) / na;
      for (let k = 0; k < 3; k++) AP[3 * i + k] = n[k] * al + (c[k] - n[k] * dn) * 0.22;
      lo = Math.min(lo, L); hi = Math.max(hi, L);
    }
    // the stacks: each slide's held-out prediction against its class (the counts are the stored confusion's)
    const ST = new Uint8Array(N), SJ = new Int16Array(N), cnt = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) { const g = H.y[i] ? (H.held[i] ? 3 : 2) : (H.held[i] ? 1 : 0); ST[i] = g; SJ[i] = cnt[g]++; }
    // the clouds' middles (for their tags)
    const mids = [[0, 0, 0], [0, 0, 0]], nc = [0, 0];
    for (let i = 0; i < N; i++) { const c = CLS[i] ? 1 : 0; nc[c]++; for (let k = 0; k < 3; k++) mids[c][k] += CP[3 * i + k]; }
    mids.forEach((m, c) => { for (let k = 0; k < 3; k++) m[k] /= nc[c]; });
    // the windows of radii: the poster's, and the rest of the radii on either side, each with its share (a sum of stored
    // fine shares); in the gap's stack the positive ones stand on the floor and the negative ones hang from their top
    const cuts = [...new Set(D.poster.windows.flatMap(w => [w[0], w[1]]))].sort((p, q) => p - q);
    const ends = [0, ...cuts, Infinity], WIN = [];
    for (let k = 0; k + 1 < ends.length; k++) {
      const r0 = ends[k], r1 = ends[k + 1];
      WIN.push({ r0, r1, s: T.share(dim, r0, r1), poster: D.poster.windows.some(w => w[0] === r0 && w[1] === r1) });
    }
    let pos = 0, neg = 0;
    for (const w of WIN) if (w.s >= 0) { w.y0 = pos * G.k; pos += w.s; w.y1 = pos * G.k; }
    for (const w of WIN) if (w.s < 0) { w.y1 = (pos - neg) * G.k; neg -= w.s; w.y0 = (pos - neg) * G.k; }
    for (const w of WIN) {
      w.h0 = G.TH * T.height(Math.max(w.r0, T.rOf(0))); w.h1 = G.TH * T.height(Math.min(w.r1, T.rOf(1)));
      w.R = 0.06 + 0.055 * Math.abs(w.s);
    }
    const rest = WIN.filter(w => !w.poster), restS = rest.reduce((s, w) => s + w.s, 0);
    // where gamma peaks (its tag) and the means' top (theirs), read off the stored envelopes
    let gu = 0, gy = 0;
    for (let j = 0; j < H.gamma.length; j += 2) if (Math.abs(H.gamma[j + 1]) > Math.abs(gy)) { gy = H.gamma[j + 1]; gu = H.gamma[j]; }
    return { dim, H, mid, half, CP, a, na, n, b0, AP, lo, hi, ST, SJ, cnt, mids, WIN, rest, restS, gu, gy,
      dmax: HS * (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2])), D0: -b0 / na };
  }
  const M = [model(0), model(1)];

  // ---------------------------------------------------------------- the frame of the moment
  const now = { dim: 1, m: M[1], pick: -1, ps: 0, space: 0, odds: 0, stacks: 0, gamma: 0, gap: 0,
    win: [5, 15], wy: [0, 0], drum: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], wallTop: [0, 0, 0] };
  const POS = new Float32Array(3 * N), SIZE = new Float32Array(N), VIS = new Float32Array(N), RIB = new Float32Array(N);
  const _p = [0, 0, 0], _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0], _o = [0, 0, 0], _u = [0, 0, 0], _y = [0, 0, 0], _col = [0, 0, 0], _col2 = [0, 0, 0];
  const _q = new THREE.Quaternion(), _qs = new THREE.Quaternion(), _ax = new THREE.Vector3(0, 1, 0);
  const OPT = Array.from({ length: N }, () => ({ glow: 0.5, fill: 0.5 }));
  const OPT_MEAN = { glow: 1, fill: 0.75 }, OPT_PHI = [{ glow: 0.9, fill: 0.7 }, { glow: 0.9, fill: 0.7 }];
  const OPT_G = { glow: 0.9, fill: 0.8, neg: LK.HEALTHYLIT, to: 1 }, OPT_M = { glow: 0.8, fill: 0.55, to: 1 };
  const PH = [{ o: [0, 0, 0], U: [0, 0, 0], Y: [0, 0, 0] }, { o: [0, 0, 0], U: [0, 0, 0], Y: [0, 0, 0] }];
  // the wall's outline at the moment (up to six points where the plane cuts the cube's edges, in order round it)
  const WP = Array.from({ length: 12 }, () => [0, 0, 0]), WANG = new Float32Array(12), WORD = new Int8Array(12);
  function clipWall(m, Dd) {
    const n = m.n;
    let k = 0;
    for (const [i, j] of EDGE) {
      const p = CORN[i], q = CORN[j];
      const va = p[0] * n[0] + p[1] * n[1] + p[2] * n[2] - Dd, vb = q[0] * n[0] + q[1] * n[1] + q[2] * n[2] - Dd;
      if ((va < 0) === (vb < 0) || va === vb) continue;
      const f = va / (va - vb), w = WP[k++];
      for (let c = 0; c < 3; c++) w[c] = p[c] + (q[c] - p[c]) * f;
    }
    if (k < 3) return 0;
    // in order round the middle (a basis in the plane)
    let mx = 0, my = 0, mz = 0;
    for (let i = 0; i < k; i++) { mx += WP[i][0] / k; my += WP[i][1] / k; mz += WP[i][2] / k; }
    const ex = Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [0, -n[2], n[1]], el = Math.hypot(ex[0], ex[1], ex[2]);
    ex[0] /= el; ex[1] /= el; ex[2] /= el;
    const ey = [n[1] * ex[2] - n[2] * ex[1], n[2] * ex[0] - n[0] * ex[2], n[0] * ex[1] - n[1] * ex[0]];
    for (let i = 0; i < k; i++) {
      const dx = WP[i][0] - mx, dy = WP[i][1] - my, dz = WP[i][2] - mz;
      WANG[i] = Math.atan2(dx * ey[0] + dy * ey[1] + dz * ey[2], dx * ex[0] + dy * ex[1] + dz * ex[2]); WORD[i] = i;
    }
    for (let i = 1; i < k; i++) { const v = WORD[i]; let j = i - 1; while (j >= 0 && WANG[WORD[j]] > WANG[v]) { WORD[j + 1] = WORD[j]; j--; } WORD[j + 1] = v; }
    return k;
  }
  const add3 = (out, p, x, y, z) => { out[0] = p[0] + x; out[1] = p[1] + y; out[2] = p[2] + z; return out; };
  const addv = (out, p, v) => add3(out, p, v[0], v[1], v[2]);
  // the shapes' arrows along the cube's edges: shape 1 across its top back edge, shape 2 up its left back edge, shape 3
  // along its left bottom edge towards you
  const AXES = [[[-HS, HS, -HS], [1, 0, 0], CYAN], [[-HS, -HS, -HS], [0, 1, 0], GREEN], [[-HS, -HS, -HS], [0, 0, 1], LK.INK]];
  const POOLS = [slides, ribbons, big, tubes, rings, halos, boxes, sheet, cones];

  function update(S, t) {
    LK.depth();
    const dim = Math.round(S.cohort_dim) === 0 ? 0 : 1, m = M[dim], H = m.H;
    const rack = clamp(S.cohort_rack, 0, 1), means = clamp(S.cohort_means, 0, 1), shapes = clamp(S.cohort_shapes, 0, 1);
    const space = clamp(S.cohort_space, 0, 1), wall = clamp(S.cohort_wall, 0, 1), odds = clamp(S.cohort_odds, 0, 1);
    const stacks = clamp(S.cohort_stacks, 0, 1), gamma = clamp(S.cohort_gamma, 0, 1), gap = clamp(S.cohort_gap, 0, 1), win = clamp(S.cohort_win, 0, 1);
    const pk = Math.round(S.cohort_pick), pick = pk >= 0 && pk < N ? pk : -1;
    Object.assign(now, { dim, m, pick, space, odds, stacks, gamma, gap });
    for (let k = 0; k < POOLS.length; k++) POOLS[k].begin();
    const cc = curveCol(dim), cubeA = prog(space, 0.35, 0.8) * (1 - prog(stacks, 0, 0.45));

    // ---- the rack's floor: a step under every slot (it fades as the slides fly out)
    const ba = prog(rack, 0, 0.08) * (1 - prog(space, 0.15, 0.5));
    if (ba > 0.003) for (let i = 0; i < N; i++) {
      const h = RACK.foot + RACK.step * SLOT[i];
      _a[0] = RP[3 * i]; _a[1] = h / 2; _a[2] = RP[3 * i + 2]; _b[0] = RACK.L + 0.04; _b[1] = h; _b[2] = RACK.pz * 0.98;
      boxes.add(_a, _b, BASE, ba);
    }

    // ---- the slides: in the rack, flying into the cloud, gliding to the log-odds, dropping into the stacks
    for (let i = 0; i < N; i++) {
      const c = CLS[i] ? 1 : 0, picked = i === pick, others = pick >= 0 && !picked ? 0.55 : 1;
      const ta = 0.1 * SLOT[i] / ROWN, fa = prog(rack, ta, ta + 0.04);                       // into its slot
      const tf = 0.45 * i / (N - 1), f1 = prog(space, 0.03 + tf, 0.03 + tf + 0.5);         // out to the cloud
      const f2 = prog(odds, 0.25 * SLOT[i] / ROWN, 0.25 * SLOT[i] / ROWN + 0.75);            // to its log-odds
      const g = m.ST[i], j = m.SJ[i], tg = 0.55 * j / 62, f3 = prog(stacks, tg, tg + 0.4);   // into its stack
      // the rack's place (dropping into the slot as it appears)
      let x = RP[3 * i], y = RP[3 * i + 1] + 0.3 * (1 - fa), z = RP[3 * i + 2], s = RACK.L;
      // the cloud, over an arc (a slow sway there, so the glass catches the light)
      const cx = C[0] + m.CP[3 * i], cy = C[1] + m.CP[3 * i + 1], cz = C[2] + m.CP[3 * i + 2];
      x = lerp(x, cx, f1); y = lerp(y, cy, f1) + 0.35 * Math.sin(PI * f1); z = lerp(z, cz, f1); s = lerp(s, SC, f1);
      x = lerp(x, C[0] + m.AP[3 * i], f2); y = lerp(y, C[1] + m.AP[3 * i + 1], f2); z = lerp(z, C[2] + m.AP[3 * i + 2], f2);
      // the stack, over a hop (a picked slide pulled out a little towards you)
      const sx = STK.x[g], sy = STK.size * DIMS.thick / 2 + j * STK.pitch, sz = STK.z + (picked ? 0.14 : 0);
      x = lerp(x, sx, f3); y = lerp(y, sy, f3) + 0.22 * Math.sin(PI * f3); z = lerp(z, sz, f3); s = lerp(s, STK.size, f3);
      const sway = prog(f1, 0.8, 1) * (1 - f3);
      _q.copy(qStand);
      if (sway > 0.001) _q.premultiply(_qs.setFromAxisAngle(_ax, 0.35 * sway * Math.sin(0.4 * t + 1.7 * i)));
      if (f3 > 0) _q.slerp(qFlat, f3);
      const vis = Math.max(fa, f1);
      _p[0] = x; _p[1] = y; _p[2] = z;
      POS[3 * i] = x; POS[3 * i + 1] = y; POS[3 * i + 2] = z; SIZE[i] = s; VIS[i] = vis;
      slides.add(_p, _q, s, CL[c], vis * others, picked ? 1 : 0.35 + 0.3 * f1 * (1 - f3) + 0.45 * f3);
      // its glow in the cloud (the clouds read from afar)
      const ha = 0.16 * prog(f1, 0.6, 1) * (1 - f3) * others * cubeA;
      if (ha > 0.003 || picked) halos.add(_p, picked ? 0.2 : 0.07, CLIT[c], picked ? 0.9 * prog(f1, 0.6, 1) : ha);
      // a faint line down to the cube's floor (where it is in depth)
      const da = 0.2 * prog(f1, 0.85, 1) * (1 - f2) * cubeA * others;
      if (da > 0.003) { _b[0] = x; _b[1] = C[1] - HS; _b[2] = z; tubes.add(_p, _b, 0.0018, CLIT[c], da, 0); }
      // its curve standing on it: lit one after another as the rack fills, gone as it flies
      const tk = 0.14 + 0.78 * i / (N - 1), lit = prog(rack, tk, tk + 0.02), flash = lit * (1 - prog(rack, tk + 0.02, tk + 0.1));
      const ra = lit * (1 - prog(f1, 0.15, 0.6)) * (1 - 0.4 * means) * (pick >= 0 ? (picked ? 1 : 0.4) : 1);
      RIB[i] = ra;
      if (ra > 0.003) {
        const top = y + s * DIMS.wid / 2 + 0.003 * s / RACK.L;
        _o[0] = x - s / 2 + RIB_X0 * s; _o[1] = top; _o[2] = z;
        _u[0] = RIB_W * s; _u[1] = 0; _u[2] = 0; _y[0] = 0; _y[1] = RACK.rh * s / RACK.L; _y[2] = 0;
        const O = OPT[i];
        O.glow = picked ? 1 : 0.45 + 0.55 * flash; O.fill = picked ? 0.9 : 0.42 + 0.4 * flash;
        const col = picked ? LK.mix(CYAN, WHITE, 0.35, _col) : LK.mix(cc, WHITE, 0.55 * flash, _col);
        ribbons.add(H.curves[i], _o, _u, _y, 0.005 * s / RACK.L, col, ra, O);
      }
    }

    // ---- the classes' means, standing in front of their rows
    const mA = means * (1 - prog(space, 0, 0.3));
    if (mA > 0.003) for (let c = 0; c < 2; c++) {
      _o[0] = RACK.x[c] - RACK.L / 2 + RIB_X0 * RACK.L; _o[1] = RACK.foot + RW + 0.004; _o[2] = MEAN_Z;
      _u[0] = RIB_W * RACK.L; _u[1] = 0; _u[2] = 0; _y[0] = 0; _y[1] = RACK.rh * 1.08; _y[2] = 0;
      big.add(c ? H.means.cirrhosis : H.means.healthy, _o, _u, _y, 0.008, CLIT[c], mA, OPT_MEAN);
      // a thin glass plinth under each, so it stands in the rack's line
      add3(_a, _o, 0, -0.004, 0); add3(_b, _o, _u[0], -0.004, 0);
      tubes.add(_a, _b, 0.003, CLIT[c], 0.7 * mA, 0);
    }

    // ---- the two main shapes: hovering over the rack, then on the cube's back edges (shape 1 across the top, shape 2
    // up the left), as the axes they are
    const ps = now.ps = prog(space, 0.1, 0.6), shA = shapes * (1 - prog(stacks, 0, 0.4)) * (1 - 0.3 * ps);
    if (shA > 0.003) for (let k = 0; k < 2; k++) {
      const Pk = PH[k], th = k ? PI / 2 * ps : 0, lu = lerp(1.3, 2 * HS, ps), ly = lerp(0.32, 0.24, ps);
      const hover = k ? [-0.65, 1.38, -0.3] : [-0.65, 1.06, 0.22];
      const axis = k ? [C[0] - HS - 0.03, C[1] - HS, C[2] - HS] : [C[0] - HS, C[1] + HS + 0.03, C[2] - HS];
      for (let q = 0; q < 3; q++) Pk.o[q] = lerp(hover[q], axis[q], ps);
      Pk.U[0] = lu * Math.cos(th); Pk.U[1] = lu * Math.sin(th); Pk.U[2] = 0;
      Pk.Y[0] = -ly * Math.sin(th); Pk.Y[1] = ly * Math.cos(th); Pk.Y[2] = 0;
      big.add(H.phi[k], Pk.o, Pk.U, Pk.Y, 0.008, k ? GREEN : CYAN, shA, OPT_PHI[k]);
      // its base line (the score's zero along the shape)
      add3(_b, Pk.o, Pk.U[0], Pk.U[1], Pk.U[2]);
      tubes.add(Pk.o, _b, 0.0025, k ? GREEN : CYAN, 0.55 * shA * (1 - ps), 0);
    }

    // ---- the cube of the scores: its edges, and an arrow along each shape's edge
    if (cubeA > 0.003) {
      for (let e = 0; e < 12; e++) { addv(_a, C, CORN[EDGE[e][0]]); addv(_b, C, CORN[EDGE[e][1]]); tubes.add(_a, _b, 0.0028, CYAN, 0.32 * cubeA, 0); }
      for (let k = 0; k < 3; k++) {
        const p = AXES[k][0], d = AXES[k][1], col = AXES[k][2];
        add3(_a, C, p[0] + d[0] * 2 * HS, p[1] + d[1] * 2 * HS, p[2] + d[2] * 2 * HS);
        add3(_b, C, p[0], p[1], p[2]);
        tubes.add(_b, _a, 0.005, col, 0.8 * cubeA, 0);
        cones.add(_a, d, 0.07, 0.022, col, cubeA);
      }
    }

    // ---- the classifier's wall: it sweeps in from the cirrhosis side to where the log-odds is 0
    const wa = prog(wall, 0, 0.35) * (1 - prog(stacks, 0, 0.4)) * prog(space, 0.5, 0.9);
    if (wa > 0.003) {
      const e = smooth(clamp(wall / 0.8, 0, 1)), Dd = lerp(m.dmax + 0.02, m.D0, e), k = clipWall(m, Dd);
      if (k >= 3) {
        addv(_a, C, WP[WORD[0]]);
        for (let q = 1; q + 1 < k; q++) { addv(_b, C, WP[WORD[q]]); addv(_c, C, WP[WORD[q + 1]]); sheet.add(_a, _b, _c, WALL, 0.42 * wa, 0); }
        let top = -1e9;
        for (let q = 0; q < k; q++) {
          addv(_a, C, WP[WORD[q]]); addv(_b, C, WP[WORD[(q + 1) % k]]);
          tubes.add(_a, _b, 0.0045, WALL, 0.9 * wa, 0);
          if (_a[1] > top) { top = _a[1]; now.wallTop[0] = _a[0]; now.wallTop[1] = _a[1]; now.wallTop[2] = _a[2]; }
        }
      }
    }

    // ---- the log-odds axis through the wall, along its normal: a tick every 5, the wall's 0 brightest
    const oa = prog(odds, 0, 0.4) * (1 - prog(stacks, 0, 0.4));
    if (oa > 0.003) {
      const n = m.n, at = (L, out) => add3(out, C, n[0] * (L - m.b0) / m.na, n[1] * (L - m.b0) / m.na, n[2] * (L - m.b0) / m.na);
      at(m.lo - 1.5, _a); at(m.hi + 1.5, _b);
      tubes.add(_a, _b, 0.004, CYAN, 0.75 * oa, 0);
      cones.add(_b, n, 0.08, 0.024, LK.CIRRLIT, oa);
      for (let L = Math.ceil(m.lo / 5) * 5; L <= m.hi; L += 5) rings.add(at(L, _c), n, L ? 0.035 : 0.07, L ? 0.003 : 0.006, L ? CYAN : WHITE, oa * (L ? 0.7 : 1), 0);
    }

    // ---- the weight per radius: the column, gamma, the means beside it, the windows' rings (then the gap's stack)
    if (gamma > 0.003) {
      const rise = prog(gamma, 0, 0.3), top = G.TH * rise;
      _a[0] = G.x; _a[1] = 0; _a[2] = G.z; _b[0] = G.x; _b[1] = top; _b[2] = G.z;
      tubes.add(_a, _b, 0.034, LK.GLASS, 0.16 * rise, 0);
      tubes.add(_a, _b, 0.006, CYAN, 0.85 * rise, 0);
      for (const r of COL_TICKS) {
        const h = G.TH * T.height(r);
        if (h <= top) { _c[0] = G.x; _c[1] = h; _c[2] = G.z; rings.add(_c, UP, 0.05, 0.0035, CYAN, 0.7 * rise, 0); }
      }
      // gamma (over its largest |value|): red out to +x where more features alive at that radius speak for cirrhosis
      OPT_G.to = prog(gamma, 0.2, 0.55) * 1.001;
      _o[0] = G.x; _o[1] = 0; _o[2] = G.z; _u[0] = 0; _u[1] = G.TH; _u[2] = 0; _y[0] = G.WG; _y[1] = 0; _y[2] = 0;
      big.add(H.gamma, _o, _u, _y, 0.012, LK.CIRRLIT, prog(gamma, 0.2, 0.3), OPT_G);
      // the classes' means beside it (on one wall, the cirrhotic just behind: where red shows past blue, the cirrhotic
      // slides have more features alive at that radius)
      const ma = prog(gamma, 0.4, 0.6) * (1 - 0.4 * prog(gap, 0, 0.5));
      OPT_M.to = prog(gamma, 0.4, 0.7) * 1.001;
      for (let c = 0; c < 2; c++) {
        _o[0] = G.xm; _o[1] = 0; _o[2] = G.z + (c ? -0.012 : 0.012); _y[0] = G.WM;
        big.add(c ? H.means.cirrhosis : H.means.healthy, _o, _u, _y, 0.006, CLIT[c], ma, OPT_M);
      }
      _a[0] = G.xm; _a[1] = 0; _a[2] = G.z; _b[0] = G.xm; _b[1] = top; _b[2] = G.z;
      tubes.add(_a, _b, 0.003, LK.INK, 0.5 * ma, 0);
      // the windows: a ring at either end of their heights, a glass band between, sized by the share; they drop into the
      // gap's stack (positive ones from the floor, negative ones hanging from the top)
      const wA = prog(gamma, 0.65, 0.95) * (1 - 0.75 * win);
      for (let k = 0; k < m.WIN.length; k++) {
        const w = m.WIN[k], f = prog(gap, 0.08 * k, 0.08 * k + 0.5), col = w.s >= 0 ? LK.CIRRLIT : LK.HEALTHYLIT, a = wA * (w.poster ? 1 : 0.8);
        const cx = lerp(G.x, G.xs, f), cz = lerp(G.z, G.zs, f), cy = lerp((w.h0 + w.h1) / 2, (w.y0 + w.y1) / 2, f) + 0.25 * Math.sin(PI * f);
        const hh = lerp((w.h1 - w.h0) / 2, (w.y1 - w.y0) / 2, f), r = lerp(w.R, G.rs + (w.s < 0 ? 0.016 : 0), f);
        const d = now.drum[k]; d[0] = cx + r + 0.02; d[1] = cy; d[2] = cz;
        if (a <= 0.003) continue;
        _a[0] = _b[0] = cx; _a[2] = _b[2] = cz; _a[1] = cy - hh; _b[1] = cy + hh;
        tubes.add(_a, _b, r, col, (0.13 + 0.12 * f) * a, 0);
        rings.add(_a, UP, r, 0.0045, col, 0.9 * a, 0); rings.add(_b, UP, r, 0.0045, col, 0.9 * a, 0);
      }
      // the gap: where the stack ends, a bright ring, a post from the floor
      const gA = prog(gap, 0.6, 0.9) * wA;
      if (gA > 0.003) {
        const gy = H.shares.gap * G.k;
        _c[0] = G.xs; _c[1] = gy; _c[2] = G.zs; rings.add(_c, UP, G.rs + 0.045, 0.006, WHITE, gA, 0);
        halos.add(_c, 0.3, LK.CIRRLIT, 0.5 * gA);
        _a[0] = _b[0] = G.xs - G.rs - 0.09; _a[2] = _b[2] = G.zs; _a[1] = 0; _b[1] = gy;
        tubes.add(_a, _b, 0.004, WHITE, 0.8 * gA, 0);
      }
      // a window chosen in explore: its band round the column, cyan
      if (win > 0.003) {
        const r0 = Math.round(Math.max(0, +S.cohort_from || 0) * 2) / 2, r1 = +S.cohort_to >= 100.25 ? Infinity : Math.round(Math.max(0, +S.cohort_to || 0) * 2) / 2;
        now.win[0] = r0; now.win[1] = r1;
        const h0 = G.TH * T.height(Math.max(r0, T.rOf(0))), h1 = G.TH * T.height(Math.min(r1, T.rOf(1)));
        now.wy[0] = h0; now.wy[1] = h1;
        if (h1 > h0) {
          const a = win * rise;
          _a[0] = _b[0] = G.x; _a[2] = _b[2] = G.z; _a[1] = h0; _b[1] = h1;
          tubes.add(_a, _b, 0.2, CYAN, 0.16 * a, 0);
          rings.add(_a, UP, 0.2, 0.005, CYAN, a, 0); rings.add(_b, UP, 0.2, 0.005, CYAN, a, 0);
        }
      }
    }
    for (let k = 0; k < POOLS.length; k++) POOLS[k].end();
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const f2s = v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2);
  const commas = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const oddsTxt = s => { const o = Math.exp(s); return o >= 10 ? commas(Math.round(o)) : o.toFixed(2); };
  const pct = v => `${Math.round(v * 100)} %`;
  const rTxt = r => (r === Infinity ? 'and above' : `${r % 1 ? r.toFixed(1) : r}`);
  const winTxt = (r0, r1) => (r1 === Infinity ? `${rTxt(r0)} µm and above` : `${rTxt(r0)}–${rTxt(r1)} µm`);
  const cube = (x, y, z) => () => [C[0] + x, C[1] + y, C[2] + z];
  const cloudMid = c => () => { const p = now.m.mids[c]; return [C[0] + p[0], C[1] + p[1] + 0.12, C[2] + p[2]]; };
  const logAt = L => () => { const m = now.m, s = (L() - m.b0) / m.na; return [C[0] + m.n[0] * s + 0.06, C[1] + m.n[1] * s, C[2] + m.n[2] * s]; };
  const stackTop = g => () => [STK.x[g] - 0.05, STK.size * DIMS.thick + now.m.cnt[g] * STK.pitch + 0.06, STK.z + 0.1];
  const STACK = [['healthy', 'right'], ['healthy', 'wrong'], ['cirrhosis', 'wrong'], ['cirrhosis', 'right']];
  const anchors = {
    rack: [0, 0.4, 0], rowH: [RACK.x[0] + RACK.L * 0.1, RACK.foot + RW + RACK.rh + 0.08, RACK.zf], rowC: [RACK.x[1] + RACK.L * 0.1, RACK.foot + RW + RACK.rh + 0.08, RACK.zf],
    ruler: [RACK.x[0] - RACK.L / 2 + RIB_X0 * RACK.L, RACK.foot + 0.02, MEAN_Z + 0.05],
    meanH: [RACK.x[0] + RACK.L * 0.05, RACK.foot + RW + RACK.rh * 1.08 + 0.06, MEAN_Z], meanC: [RACK.x[1] + RACK.L * 0.05, RACK.foot + RW + RACK.rh * 1.08 + 0.06, MEAN_Z],
    phi1: () => { const P = PH[0], u = lerp(0.98, 0.62, now.ps); return [P.o[0] + P.U[0] * u, P.o[1] + P.U[1] * u + 0.12, P.o[2]]; },
    phi2: () => { const P = PH[1]; return [P.o[0] + P.U[0] * 0.98 - P.Y[0] * 0.2, P.o[1] + P.U[1] * 0.98 + 0.1, P.o[2]]; },
    axis3: cube(-HS, -HS, HS + 0.08), cube: cube(0, 0, 0),
    healthy: cloudMid(0), cirrhosis: cloudMid(1),
    wall: () => [now.wallTop[0], now.wallTop[1] + 0.05, now.wallTop[2]],
    zero: logAt(() => 0), oddsHi: logAt(() => now.m.hi + 1.5), oddsLo: logAt(() => now.m.lo - 1.5),
    stack0: stackTop(0), stack1: stackTop(1), stack2: stackTop(2), stack3: stackTop(3),
    stacks: [0, 1.02, STK.z], column: [G.x, G.TH * 0.5, G.z], colTop: [G.x + 0.04, G.TH + 0.06, G.z],
    gPeak: () => { const m = now.m; return [G.x + G.WG * m.gy + 0.03 * Math.sign(m.gy), G.TH * m.gu, G.z]; },
    means: [G.xm + G.WM * 0.3, G.TH * 0.9, G.z], gap: () => [G.xs - G.rs - 0.09, now.m.H.shares.gap * G.k + 0.2, G.zs],
    win: () => [G.x + 0.22, (now.wy[0] + now.wy[1]) / 2, G.z],
    pick: () => { const i = Math.max(0, now.pick); return [POS[3 * i] + SIZE[i] * 0.3, POS[3 * i + 1] + SIZE[i] * (RIB[i] > 0.1 ? 0.75 : 0.2) + 0.03, POS[3 * i + 2]]; },
  };
  for (let k = 0; k < 4; k++) anchors['drum' + k] = () => now.drum[k];
  const noPick = S => (Math.round(S.cohort_pick) >= 0 ? 0 : 1);
  const rackOn = S => clamp(S.cohort_rack, 0, 1) * (1 - prog(S.cohort_space, 0, 0.2));
  const winIdx = (m, r0) => m.WIN.findIndex(w => w.r0 === r0);
  const labels = [
    { text: () => [`${D.src.healthy} healthy`, ' · blue labels'], at: 'rowH', cls: 'cyn', alpha: S => prog(S.cohort_rack, 0.05, 0.15) * rackOn(S) * (1 - prog(S.cohort_means, 0, 0.4)) * noPick(S) },
    { text: () => [`${D.src.cirrhosis} with cirrhosis`, ' · red labels'], at: 'rowC', cls: 'mag', alpha: S => prog(S.cohort_rack, 0.05, 0.15) * rackOn(S) * (1 - prog(S.cohort_means, 0, 0.4)) * noPick(S) },
    { text: () => ['Radius', ` · ${T.rOf(0)} to ${T.rOf(1)} µm, left to right`], at: 'ruler', cls: '', alpha: S => prog(S.cohort_rack, 0.2, 0.3) * rackOn(S) * (1 - clamp(S.cohort_shapes, 0, 1)) * noPick(S) },
    { text: ['Healthy', ' · their mean curve'], at: 'meanH', cls: 'cyn', alpha: S => prog(S.cohort_means, 0.4, 0.8) * rackOn(S) * (1 - clamp(S.cohort_shapes, 0, 1)) * noPick(S) },
    { text: ['Cirrhosis', ' · their mean curve'], at: 'meanC', cls: 'mag', alpha: S => prog(S.cohort_means, 0.4, 0.8) * rackOn(S) * (1 - clamp(S.cohort_shapes, 0, 1)) * noPick(S) },
    { text: () => ['Shape 1', ` · ${pct(fve(now.dim)[0])} of the variation`], at: 'phi1', cls: 'cyn',
      alpha: S => prog(S.cohort_shapes, 0.4, 0.8) * (1 - prog(S.cohort_odds, 0, 0.4)) * (1 - clamp(S.cohort_gamma, 0, 1)) * noPick(S) },
    { text: () => ['Shape 2', ` · ${pct(fve(now.dim)[1])}`], at: 'phi2', cls: 'grn',
      alpha: S => prog(S.cohort_shapes, 0.5, 0.9) * (1 - prog(S.cohort_odds, 0, 0.4)) * (1 - clamp(S.cohort_gamma, 0, 1)) * noPick(S) },
    { text: () => ['Shape 3', ` · ${pct(fve(now.dim)[2])}`], at: 'axis3', cls: '',
      alpha: S => prog(S.cohort_space, 0.6, 0.9) * (1 - prog(S.cohort_odds, 0, 0.4)) * (1 - clamp(S.cohort_gamma, 0, 1)) * noPick(S) },
    { text: ['Healthy', ''], at: 'healthy', cls: 'cyn', alpha: S => prog(S.cohort_space, 0.75, 1) * (1 - prog(S.cohort_wall, 0.3, 0.6)) * (1 - clamp(S.cohort_gamma, 0, 1)) * noPick(S) },
    { text: ['Cirrhosis', ''], at: 'cirrhosis', cls: 'mag', alpha: S => prog(S.cohort_space, 0.75, 1) * (1 - prog(S.cohort_wall, 0.3, 0.6)) * (1 - clamp(S.cohort_gamma, 0, 1)) * noPick(S) },
    { text: ['The wall', ' · where the classifier cannot tell'], at: 'wall', cls: '',
      alpha: S => prog(S.cohort_wall, 0.6, 0.9) * (1 - prog(S.cohort_odds, 0, 0.3)) * (1 - clamp(S.cohort_gamma, 0, 1)) * noPick(S) },
    { text: ['Log-odds 0', ' · on the wall'], at: 'zero', cls: '', alpha: S => prog(S.cohort_odds, 0.5, 0.9) * (1 - prog(S.cohort_stacks, 0, 0.3)) * (1 - clamp(S.cohort_gamma, 0, 1)) * noPick(S) },
    { text: () => [`+${Math.floor(now.m.hi + 1.5)}`, ' · cirrhosis more likely'], at: 'oddsHi', cls: 'mag',
      alpha: S => prog(S.cohort_odds, 0.6, 1) * (1 - prog(S.cohort_stacks, 0, 0.3)) * (1 - clamp(S.cohort_gamma, 0, 1)) * noPick(S) },
    { text: () => [`−${Math.floor(-(now.m.lo - 1.5))}`, ' · healthy more likely'], at: 'oddsLo', cls: 'cyn',
      alpha: S => prog(S.cohort_odds, 0.6, 1) * (1 - prog(S.cohort_stacks, 0, 0.3)) * (1 - clamp(S.cohort_gamma, 0, 1)) * noPick(S) },
    ...STACK.map(([cl, what], g) => ({ text: () => [`${now.m.H.confusion[g]}`, ` · ${cl}, ${what}`], at: 'stack' + g, cls: g < 2 ? 'cyn' : 'mag',
      alpha: S => prog(S.cohort_stacks, 0.75, 1) * (1 - prog(S.cohort_gamma, 0, 0.3)) * noPick(S) })),
    { text: () => { const c = now.m.H.confusion; return [`${c[0] + c[3]} of ${N} right`, ` · held out, accuracy ${now.m.H.accuracy.toFixed(3)}`]; }, at: 'stacks', cls: '',
      alpha: S => prog(S.cohort_stacks, 0.85, 1) * (1 - prog(S.cohort_gamma, 0, 0.3)) * noPick(S) },
    { text: () => ['Radius', ` · up the column, ${T.rOf(0)} to ${T.rOf(1)} µm`], at: 'colTop', cls: '', alpha: S => prog(S.cohort_gamma, 0.15, 0.3) * (1 - prog(S.cohort_gamma, 0.6, 0.75)) * (1 - clamp(S.cohort_win, 0, 1)) },
    { text: ['Weight per radius', ' · red speaks for cirrhosis'], at: 'gPeak', cls: 'mag', alpha: S => prog(S.cohort_gamma, 0.4, 0.55) * (1 - prog(S.cohort_gamma, 0.65, 0.8)) * (1 - clamp(S.cohort_win, 0, 1)) },
    { text: ['The means', ' · cirrhosis red, healthy blue'], at: 'means', cls: '', alpha: S => prog(S.cohort_gamma, 0.55, 0.75) * (1 - prog(S.cohort_gap, 0, 0.3)) * (1 - clamp(S.cohort_win, 0, 1)) },
    // the windows' tags (the poster's two, and the rest of the radii together, at its larger part)
    ...[0, 1, 2, 3].map(k => ({
      text: () => {
        const m = now.m, w = m.WIN[k];
        return w.poster ? [winTxt(w.r0, w.r1), ` · ${f2s(w.s)}`] : ['The other radii', ` · ${f2s(m.restS)} together`];
      },
      at: 'drum' + k, cls: '',
      alpha: S => {
        const m = M[Math.round(S.cohort_dim) === 0 ? 0 : 1], w = m.WIN[k];
        const big = w.poster || w === m.rest.reduce((b, v) => (Math.abs(v.s) > Math.abs(b.s) ? v : b), m.rest[0]);
        return big ? prog(S.cohort_gamma, 0.8, 1) * (1 - clamp(S.cohort_win, 0, 1)) : 0;
      },
    })),
    { text: () => { const g = now.m.H.shares.gap; return ['The gap', ` · ${f2s(g)}: odds × ${oddsTxt(g)}`]; }, at: 'gap', cls: 'amb',
      alpha: S => prog(S.cohort_gap, 0.7, 1) * clamp(S.cohort_gamma, 0, 1) * (1 - clamp(S.cohort_win, 0, 1)) },
    { text: () => { const [r0, r1] = now.win, s = T.share(now.dim, r0, r1); return [winTxt(r0, r1), ` · ${f2s(s)}: odds × ${oddsTxt(s)}`]; }, at: 'win', cls: 'cyn',
      alpha: S => clamp(S.cohort_win, 0, 1) * prog(S.cohort_gamma, 0.2, 0.4) },
    { text: () => {
      const i = Math.max(0, now.pick), H = now.m.H, c = CLS[i] ? 'cirrhosis' : 'healthy';
      const res = now.stacks > 0.5 ? (H.held[i] === H.y[i] ? ' · held out: right' : ` · held out: called ${H.held[i] ? 'cirrhosis' : 'healthy'}`)
        : now.odds > 0.5 ? ` · log-odds ${f2s(H.logOdds[i])}` : now.space > 0.5 ? ` · scores ${H.scores[i].slice(0, 3).map(v => v.toFixed(2)).join(', ')}` : '';
      return [`Slide ${i + 1}`, ` · ${c}${res}`];
    }, at: 'pick', cls: 'cyn', alpha: S => (Math.round(S.cohort_pick) >= 0 ? 1 : 0) },
  ];
  // views (for the loops' model, the story's): the wall seen edge-on (along the plane, across its normal's tilt)
  const n1 = M[1].n, wallAz = Math.atan2(-n1[2], n1[0]) * 180 / PI, W1 = n1.map((v, k) => +(C[k] + v * M[1].D0).toFixed(2));
  const cam = {
    default: [18, 26, 4.0, 0, 0.4, 0.05],          // the rack whole, from the front and above
    rack: [10, 16, 2.9, 0, 0.42, 0.55],            // close on the rack's front: the curves standing on their slides
    means: [0, 10, 2.3, 0, 0.42, 0.85],            // the two means in front of their rows
    shapes: [14, 18, 4.4, 0, 0.82, 0.05],          // the shapes hovering over the rack
    space: [28, 16, 4.7, 0, C[1], 0],              // the cube of the scores
    wall: [Math.round(wallAz), 8, 4.6, W1[0], W1[1], W1[2]],   // the wall nearly edge-on between the clouds (aimed at it)
    odds: [Math.round(wallAz) - 25, 10, 4.6, 0, C[1], 0],   // the slides on the log-odds axis
    stacks: [22, 26, 3.7, 0, 0.36, 0.1],           // the four stacks
    gamma: [10, 8, 4.3, G.x + 0.35, 0.8, 0],       // the column, gamma and the means
    gap: [-14, 10, 4.2, G.x - 0.2, 0.7, 0.1],      // the column and the gap's stack
    all: [16, 18, 6.6, 0.75, 0.75, 0],             // everything
  };

  const controls = [
    { key: 'view', label: 'View', options: [['rack', 'Rack'], ['space', 'Scores'], ['held', 'Held out'], ['scales', 'Scales']] },
    { key: 'dim', label: 'Curves of', options: [['1', 'Loops'], ['0', 'Pieces']] },
  ];
  function explore(c) {
    const v = c.view || 'rack', at = (...vs) => (vs.includes(v) ? 1 : 0);
    return {
      cohort_dim: c.dim === '0' ? 0 : 1, cohort_rack: 1, cohort_means: at('rack'), cohort_shapes: at('space'),
      cohort_space: at('space', 'held', 'scales'), cohort_wall: at('space', 'held', 'scales'), cohort_odds: at('held', 'scales'),
      cohort_stacks: at('held', 'scales'), cohort_gamma: at('scales'), cohort_gap: at('scales'),
    };
  }

  // ---------------------------------------------------------------- picking and what explore reads
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const near2 = (ray, x, y, z, rr, Mw, best) => {
    _v.set(x, y, z).applyMatrix4(Mw);
    const d = _w.copy(_v).sub(ray.origin).dot(ray.direction);
    return d > 0 && d < best && ray.distanceSqToPoint(_v) < rr * rr ? d : -1;
  };
  // the slide a ray (a THREE.Raycaster in world coordinates) points at, where it is now (its curve too, in the rack)
  function pick(rc) {
    const ray = rc.ray;
    set.group.updateMatrixWorld();
    const Mw = set.group.matrixWorld, s0 = Mw.getMaxScaleOnAxis();
    let bt = Infinity, hit = -1, d;
    for (let i = 0; i < N; i++) {
      if (VIS[i] < 0.3) continue;
      const s = SIZE[i], x = POS[3 * i], y = POS[3 * i + 1], z = POS[3 * i + 2], r = Math.max(0.035, s * 0.22) * s0;
      for (const dx of [-0.25, 0.1, 0.4]) if ((d = near2(ray, x + dx * s, y, z, r, Mw, bt)) >= 0) { bt = d; hit = i; }
      if (RIB[i] > 0.1) for (const dx of [-0.05, 0.2, 0.42]) if ((d = near2(ray, x + dx * s, y + s * (DIMS.wid / 2 + 0.2), z, r, Mw, bt)) >= 0) { bt = d; hit = i; }
    }
    return hit >= 0 ? { kind: 'slide', i: hit } : null;
  }
  const API = {
    n: N, healthy: D.src.healthy, cirrhosis: D.src.cirrhosis,
    // a slide's numbers in a model (pieces 0, loops 1): its number (1-based), class, scores, log-odds and held-out result
    slide(i, dim = 1) {
      const H = D[dim ? 'h1' : 'h0'];
      return i >= 0 && i < N ? { i, number: i + 1, cls: CLS[i] ? 'cirrhosis' : 'healthy', y: H.y[i], scores: H.scores[i].slice(), logOdds: H.logOdds[i],
        held: H.held[i], right: H.held[i] === H.y[i] } : null;
    },
    fve: dim => fve(dim).slice(), accuracy: dim => D[dim ? 'h1' : 'h0'].accuracy, confusion: dim => D[dim ? 'h1' : 'h0'].confusion.slice(),
    // a window of radii (r0, r1 on the 0.5 µm grid; r1 Infinity for "and above"): its share and odds factor, looked up
    window(r0, r1, dim = 1) { const s = T.share(dim, r0, r1); return { r0, r1, share: s, odds: Math.exp(s) }; },
    windows: (dim = 1) => M[dim ? 1 : 0].WIN.map(w => ({ r0: w.r0, r1: w.r1, share: w.s, poster: w.poster })),
    gap: (dim = 1) => { const g = D[dim ? 'h1' : 'h0'].shares.gap; return { gap: g, odds: Math.exp(g) }; },
    grid: D.h1.shares.edges.filter(e => e !== null),   // the windows' edges, µm (0 to 100 in steps of 0.5; and above)
    pick, mid: i => (i >= 0 && i < N ? [POS[3 * i], POS[3 * i + 1], POS[3 * i + 2]] : null),
  };
  return Object.assign(set, {
    params: { cohort_a: 1, cohort_dim: 1, cohort_rack: 1, cohort_means: 0, cohort_shapes: 0, cohort_space: 0, cohort_wall: 0, cohort_odds: 0,
      cohort_stacks: 0, cohort_gamma: 0, cohort_gap: 0, cohort_win: 0, cohort_from: 5, cohort_to: 15, cohort_pick: -1 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};
