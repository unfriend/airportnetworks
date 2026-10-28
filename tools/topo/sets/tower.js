// The tower set of the topo story: the poster's patch (TOPO_DATA.patch: 110 real cells of a healthy liver slide, the
// alpha complex among them, its bars and snapshots, all topocyte's and gudhi's, read through TDATA) on a glass plate.
// Balls grow round the cells with the radius (tower_r, µm); an edge appears when the radius reaches its stored radius,
// a glass triangle likewise; the beads and balls take the colour of the piece they are in (pieces with one cell stay
// white-gold), and every loop's hole glows orange while it is alive. Then the tower of scales (tower_rise): the radius
// becomes height on the poster's log ruler (TDATA.height). Each piece is a thread rising from its first cell, thicker as
// it grows; where it joins another (TOPO_DATA.patch.joins) it bridges across its joining edge to that piece's thread, and
// the threads merge into one trunk that goes on to the top. Each loop is a chimney: its ring (loops[].ring) extruded from
// the height of its birth to its death and capped there, the poster's loop brightest. The radius plane rises with the
// radius and carries the complex at that radius; what lies above it is drawn faint. Beside the tower the barcode (one
// rod per bar, at the heights it spans, sorted) and the two Betti curves as lit ribbons on a glass wall (tower_bars),
// their counts looked up from the stored bars. Nothing here is computed but looked up: which simplices and bars are
// alive at a radius (their stored radii against it), which piece a cell is in (the stored joins replayed in order), and
// where things go (stored positions and radii). Everything follows the params and t.
SETS.tower = function (K) {
  const { THREE, clamp, lerp, prog, smooth } = K;
  const set = K.newSet('tower');
  const T = TDATA, D = T.D, P = D.patch, LK = TLOOK(K, set), PI = Math.PI, UP = [0, 1, 0];
  const N = T.patch.n, SIDE = P.side;
  const PW = 1.5, KU = PW / SIDE;           // the patch's width in units, and units per µm
  const TH = 1.6;                            // the tower's height: the ruler's top (60 µm)
  const LIFT = 0.006;                        // the complex over the plate or the plane
  const GHOST = 0.2;                         // what stands above the radius plane
  const TICKS = [2, 5, 10, 20, 50];
  const RULER = [-1.0, 0.98];                // the ruler's post (x, z): the plate's front left corner
  // the barcode's board to the right of the tower: its first rod's foot, its turn about y (degrees), the rods' pitch,
  // the loops' lanes' pitch and the gap between the two
  const BOARD = { x: 1.14, z: -0.1, yaw: 16, p: 0.0085, lane: 0.034, gap: 0.12 };
  const HS = TH / 1;                         // the height of a radius: HS x TDATA.height(r) (times tower_rise)

  // ---------------------------------------------------------------- the patch, in units (the poster's y up is -z)
  const X = new Float32Array(N), Z = new Float32Array(N);
  for (let i = 0; i < N; i++) { X[i] = (T.patch.x[i] - SIDE / 2) * KU; Z[i] = -(T.patch.y[i] - SIDE / 2) * KU; }
  const at = (x, y) => [(x - SIDE / 2) * KU, -(y - SIDE / 2) * KU];
  // the complex: edges [i, j, r] and triangles [i, j, k, r], as stored
  const NE = P.edges.length / 3, EI = new Uint16Array(NE), EJ = new Uint16Array(NE), ER = new Float32Array(NE), EU = new Float32Array(NE);
  for (let e = 0; e < NE; e++) { EI[e] = P.edges[3 * e]; EJ[e] = P.edges[3 * e + 1]; ER[e] = P.edges[3 * e + 2]; EU[e] = T.u(ER[e]); }
  const NT = P.tris.length / 4, TI = new Uint16Array(NT), TJ = new Uint16Array(NT), TK = new Uint16Array(NT), TRR = new Float32Array(NT);
  for (let k = 0; k < NT; k++) { TI[k] = P.tris[4 * k]; TJ[k] = P.tris[4 * k + 1]; TK[k] = P.tris[4 * k + 2]; TRR[k] = P.tris[4 * k + 3]; }
  // the joins, in the filtration's order: the piece that started at cell v joins the one that started at w across a-b
  const J = P.joins.slice().sort((p, q) => p[4] - q[4]), NJ = J.length;
  const JV = new Uint16Array(NJ), JW = new Uint16Array(NJ), JA = new Uint16Array(NJ), JB = new Uint16Array(NJ), JR = new Float32Array(NJ);
  J.forEach((j, k) => { JV[k] = j[0]; JW[k] = j[1]; JA[k] = j[2]; JB[k] = j[3]; JR[k] = j[4]; });
  const joinEdge = new Set(J.map(j => Math.min(j[2], j[3]) * 1000 + Math.max(j[2], j[3])));
  const EJOIN = new Uint8Array(NE);
  for (let e = 0; e < NE; e++) EJOIN[e] = joinEdge.has(Math.min(EI[e], EJ[e]) * 1000 + Math.max(EI[e], EJ[e])) ? 1 : 0;

  // each piece's thread: the segments between the joinings that change its size, and the radius it dies at
  // (bookkeeping of the stored joins for the drawing: sizes are counts of cells)
  const death = new Float32Array(N).fill(Infinity), grows = new Uint8Array(N), size = new Int32Array(N).fill(1), from = new Float32Array(N);
  const SEG = [];   // [rep, r0, r1, size]
  const BRIDGE = new Int32Array(NJ);   // the dying piece's size at its join
  for (let k = 0; k < NJ; k++) {
    const v = JV[k], w = JW[k], r = JR[k];
    SEG.push(v, from[v], r, size[v]); BRIDGE[k] = size[v]; death[v] = r;
    SEG.push(w, from[w], r, size[w]);
    size[w] += size[v]; from[w] = r; grows[w] = 1;
  }
  let TRUNK = 0;
  for (let i = 0; i < N; i++) if (death[i] === Infinity) TRUNK = i;
  SEG.push(TRUNK, from[TRUNK], Infinity, size[TRUNK]);
  const NS = SEG.length / 4;
  // colours of the pieces that ever hold more than one cell: the longer a piece lives, the earlier its colour (the last
  // piece amber, as the pieces' colour everywhere); a piece of one cell stays white-gold
  const PAL = ['#ffb43b', '#b98cff', '#5fe0a0', '#ff7ac8', '#ffe066', '#8fa8ff', '#c8f060', '#ffa98a', '#e6d2a6'].map(K.rgb);
  const COL = Array.from({ length: N }, () => LK.BEAD);
  Array.from({ length: N }, (_, i) => i).filter(i => grows[i]).sort((a, b) => death[b] - death[a]).forEach((i, k) => { COL[i] = PAL[k % PAL.length]; });

  // the loops (longest-lived first, as stored): born when an edge appears, filled when a triangle does; their rings
  const LOOPS = P.loops.map((L, k) => {
    const ring = L.ring || [], vs = [...new Set(ring.flat())];
    const h = at(L.hole[0], L.hole[1]);
    const rad = vs.length ? vs.reduce((s, v) => s + Math.hypot(X[v] - h[0], Z[v] - h[1]), 0) / vs.length : 0.03;
    return { k, b: L.b, d: L.d, ub: T.u(L.b), main: k === 0, ring, vs, hx: h[0], hz: h[1], rad };
  });
  const NL = LOOPS.length, MAIN = LOOPS[0];

  // the barcode on its board: the pieces' rods side by side, the longest-lived first (the last piece, which never joins,
  // at the left), so the rods alive at any height are the first ones and their tops make a staircase that is the count
  // of pieces; the loops' rods packed into lanes (each to the first lane free at its birth, as they are sorted by
  // birth: as many lanes as loops ever alive at once), so the busy lanes at a height are the count of loops. Drawing,
  // not science: the rods are the stored bars; the counts are looked up below
  const Br = [Math.cos(BOARD.yaw * PI / 180), 0, -Math.sin(BOARD.yaw * PI / 180)], Bn = [-Br[2], 0, Br[0]];   // along, out
  const BARS = [];
  for (let i = 0; i < N; i++) BARS.push({ dim: 0, i, b: 0, d: death[i], sx: X[i], sz: Z[i] });
  BARS.sort((p, q) => q.d - p.d || p.i - q.i);
  BARS.forEach((B, k) => { B.s = k * BOARD.p; });
  const NB0 = BARS.length, S1 = (NB0 - 1) * BOARD.p + BOARD.gap, laneEnd = [];
  LOOPS.slice().sort((p, q) => p.b - q.b || p.d - q.d).forEach(L => {
    let l = laneEnd.findIndex(e => e <= L.b);
    if (l < 0) { l = laneEnd.length; laneEnd.push(0); }
    laneEnd[l] = L.d;
    BARS.push({ dim: 1, i: L.k, b: L.b, d: L.d, main: L.main, sx: L.hx, sz: L.hz, s: S1 + l * BOARD.lane, lane: l });
  });
  const NB = BARS.length, LANES = laneEnd.length, SEND = S1 + (LANES - 1) * BOARD.lane;
  // a point on the board: s along it from the first rod, d out of it (towards you), height y
  const onBoard = (s, d, y, out) => { out[0] = BOARD.x + Br[0] * s + Bn[0] * d; out[1] = y; out[2] = BOARD.z + Br[2] * s + Bn[2] * d; return out; };
  BARS.forEach((B, k) => { B.k = k; const o = onBoard(B.s, 0.03, 0, [0, 0, 0]); B.x = o[0]; B.z = o[2]; });

  // the Betti curves as step envelopes [u, y, ...] on the ruler, counted from the stored bars at every radius where a
  // count changes (TDATA: pieces alive = deaths still to come + the one that lives on; loops alive = bars alive)
  const pieces = r => T.deaths(P.h0, r) + 1, loopsAt = r => T.betti(P.h1, r);
  function stepEnv(events, count) {
    const rs = [...new Set(events.filter(r => r > T.rOf(0) && r < T.rOf(1)))].sort((a, b) => a - b);
    const env = [];
    let y = count(T.rOf(0));
    env.push(0, y);
    for (const r of rs) { const u = T.u(r), y1 = count(r); if (y1 === y) continue; env.push(u, y, u, y1); y = y1; }
    env.push(1, y);
    let top = 0;
    for (let i = 1; i < env.length; i += 2) top = Math.max(top, env[i]);
    for (let i = 1; i < env.length; i += 2) env[i] /= top;
    return { env, top };
  }
  const B0 = stepEnv(P.h0, pieces), B1 = stepEnv(P.h1, loopsAt);
  const B0ENV = new Float32Array(B0.env), B1ENV = new Float32Array(B1.env);

  // the H&E look of the 110 cells (tower_he): each cell's type from the healthy tile it was cut from (the stored cell
  // at the same place; y flipped, as stored), drawn as the slide set draws it
  const KIND = new Uint8Array(N).fill(LK.CELL.PLAIN), ANG = new Float32Array(N);
  {
    const tl = T.tile, [px, py, ps] = D.tile.patch, rng = K.rng(41);
    for (let i = 0; i < N; i++) {
      const tx = px + T.patch.x[i], ty = py + ps - T.patch.y[i];
      let best = 1.5, bk = -1;
      for (let j = 0; j < tl.n; j++) { const d = Math.abs(tl.x[j] - tx) + Math.abs(tl.y[j] - ty); if (d < best) { best = d; bk = j; } }
      if (bk >= 0) KIND[i] = LK.kindOf(tl.types[tl.type[bk]]);
      ANG[i] = rng() * PI * 2;
    }
  }
  const HE_R = [10, 9, 8, 4.5, 6, 4, 3.8, 7, 2], STAIN = [PW + 0.06, 0.003, PW + 0.06];   // a cell's long half-axis by kind, µm (drawing)
  const BEAD_R = 2.1;                             // a bead's core, µm

  // ---------------------------------------------------------------- the pools
  const plate = LK.slides(1), stain = LK.boxes(1), tubes = LK.tubes(3200), rings = LK.rings(16), halos = LK.halos(260);
  const sheet = LK.sheet(2400), ribbons = LK.ribbons(2, Math.max(B0.env.length, B1.env.length) / 2 + 2), cells = LK.cells(240), discs = LK.discs(120);
  set.group.add(plate.mesh, stain.mesh, tubes.mesh, rings.mesh, halos.mesh, sheet.mesh, ribbons.mesh, cells.mesh, discs.mesh);
  // the plate: a glass slide's clear part under the patch, its frosted label towards you (tinted as the healthy slides)
  const PL = 0.12, CLEAR = PW + 2 * PL, PSX = CLEAR / (1 - plate.dims.label), PTH = 0.045;
  // (turned a quarter about y, so its label end, -x, points to +z; moved so the clear part is centred on the patch)
  const PLATE_Q = LK.quat([0, 0, 0, 1], UP, PI / 2), PLATE_P = [0, -PTH / 2, PSX * plate.dims.label / 2];
  plate.begin(); plate.add(PLATE_P, PLATE_Q, [PSX, PTH / plate.dims.thick, CLEAR / plate.dims.wid], LK.mix(LK.HEALTHY, LK.GREY, 0.55), 1, 0); plate.end();
  const LABEL_Z = CLEAR / 2 + PSX * plate.dims.label / 2;   // the label's middle

  // ---------------------------------------------------------------- what the frame shows now
  const now = { r: 1.5, u: 0, rise: 0, yp: 0, bars: 0, lit: 0, n0: N, n1: 0 };
  const par = new Int16Array(N), rep = new Int16Array(N), cnt = new Int16Array(N);
  // which piece each cell is in at radius r: the stored joins up to r replayed in order
  function replay(r) {
    par.fill(-1);
    for (let k = 0; k < NJ && JR[k] <= r; k++) par[JV[k]] = JW[k];
    cnt.fill(0);
    for (let i = 0; i < N; i++) { let c = i; while (par[c] >= 0) c = par[c]; rep[i] = c; cnt[c]++; }
  }
  const hOf = r => HS * T.height(r);
  const _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0], _d = [0, 0, 0], _e = [0, 0, 0], _col = [0, 0, 0], _col2 = [0, 0, 0];
  const WHITE = LK.WHITE, LOOPLIT = LK.mix(LK.LOOP, [1, 0.9, 0.7], 0.25);
  const thick = s => 0.0032 * Math.pow(s, 0.45);
  // a vertical piece of the tower from y0 to y1 at (x, z), bright below the plane and faint above it
  function column(x, z, y0, y1, r, col, a) {
    if (y1 - y0 < 1e-5 || a <= 0.003) return;
    const yp = now.yp;
    _a[0] = _b[0] = x; _a[2] = _b[2] = z;
    if (y0 < yp) { _a[1] = y0; _b[1] = Math.min(y1, yp); tubes.add(_a, _b, r, col, a, 0); }
    if (y1 > yp) { _a[1] = Math.max(y0, yp); _b[1] = y1; tubes.add(_a, _b, r * 0.8, col, a * GHOST, 0); }
  }
  // a glass wall of a chimney between two ring cells, split at the plane likewise
  function wall(i, j, y0, y1, col, a) {
    if (y1 - y0 < 1e-5) return;
    const yp = now.yp;
    for (let s = 0; s < 2; s++) {
      const lo = s ? Math.max(y0, yp) : y0, hi = s ? y1 : Math.min(y1, yp), al = s ? a * GHOST : a;
      if (hi - lo < 1e-5) continue;
      _a[0] = X[i]; _a[1] = lo; _a[2] = Z[i]; _b[0] = X[j]; _b[1] = lo; _b[2] = Z[j];
      _c[0] = X[j]; _c[1] = hi; _c[2] = Z[j]; _d[0] = X[i]; _d[1] = hi; _d[2] = Z[i];
      sheet.add(_a, _b, _c, col, al, 0); sheet.add(_a, _c, _d, col, al, 0);
    }
  }
  // a ring of a loop's edges at height y (tubes), or its cap: a fan of glass from the hole's middle
  function ringAt(L, y, rad, col, a) {
    for (const [i, j] of L.ring) { _a[0] = X[i]; _a[1] = y; _a[2] = Z[i]; _b[0] = X[j]; _b[1] = y; _b[2] = Z[j]; tubes.add(_a, _b, rad, col, a, 0); }
  }
  function fan(L, y, col, a, edge) {
    _c[0] = L.hx; _c[1] = y; _c[2] = L.hz;
    for (const [i, j] of L.ring) { _a[0] = X[i]; _a[1] = y; _a[2] = Z[i]; _b[0] = X[j]; _b[1] = y; _b[2] = Z[j]; sheet.add(_c, _a, _b, col, a, edge); }
  }
  // the bridge of join k at height y: a curve from the dying piece's thread across the middle of its joining edge to
  // the living piece's thread
  function bridge(k, y, col, rad, a) {
    const v = JV[k], w = JW[k], mx = (X[JA[k]] + X[JB[k]]) / 2, mz = (Z[JA[k]] + Z[JB[k]]) / 2;
    const cx = 2 * mx - (X[v] + X[w]) / 2, cz = 2 * mz - (Z[v] + Z[w]) / 2, S = 5;
    _a[0] = X[v]; _a[1] = y; _a[2] = Z[v];
    for (let s = 1; s <= S; s++) {
      const t = s / S, q = 1 - t;
      _b[0] = q * q * X[v] + 2 * q * t * cx + t * t * X[w]; _b[1] = y; _b[2] = q * q * Z[v] + 2 * q * t * cz + t * t * Z[w];
      // (each piece a little longer, so the joints close)
      const dx = _b[0] - _a[0], dz = _b[2] - _a[2], l = Math.hypot(dx, dz) || 1, ex = rad * 0.8 / l;
      _e[0] = _b[0] + dx * ex; _e[1] = y; _e[2] = _b[2] + dz * ex;
      tubes.add(_a, s < S ? _e : _b, rad, col, a, 0);
      _a[0] = _b[0]; _a[2] = _b[2];
    }
  }

  function update(S, t) {
    LK.depth();
    const r = Math.max(0.5, +S.tower_r || 1.5), u = T.u(r), rise = clamp(S.tower_rise, 0, 1), bars = clamp(S.tower_bars, 0, 1);
    const he = clamp(S.tower_he, 0, 1), lit = Math.round(S.tower_lit) || 0;
    const pA = lit === 2 ? 0.3 : 1, lA = lit === 1 ? 0.3 : 1;   // pieces or loops lit
    const yp = rise * hOf(r);
    Object.assign(now, { r, u, rise, yp, bars, lit, n0: pieces(r), n1: loopsAt(r) });
    replay(r);
    tubes.begin(); rings.begin(); halos.begin(); sheet.begin(); ribbons.begin(); cells.begin(); discs.begin(); stain.begin();

    // ---- the cells on the plate: in H&E (their types), turning into beads tinted by their piece
    const ball = 1 - he, cy = LIFT * 0.5;
    if (he > 0.003) {
      cells.bead(ball); cells.beadCol(LK.BEAD);
      _a[0] = 0; _a[1] = 0.0015; _a[2] = 0;
      stain.add(_a, STAIN, LK.EOSINPALE, 0.55 * he);
      for (let i = 0; i < N; i++) {
        _a[0] = X[i]; _a[1] = cy; _a[2] = Z[i];
        cells.add(_a, lerp(BEAD_R / 0.385, HE_R[KIND[i]], he) * KU, KIND[i], LK.CELLCOL[KIND[i]][0], 1, ANG[i], UP);
      }
    } else {
      cells.bead(0);
      for (let i = 0; i < N; i++) {
        const many = cnt[rep[i]] > 1, c = many ? COL[rep[i]] : LK.BEAD;
        _a[0] = X[i]; _a[1] = cy; _a[2] = Z[i];
        cells.add(_a, BEAD_R * KU, LK.CELL.BEAD, c, rise > 0.003 ? 1 - 0.35 * rise : 1, ANG[i], UP);
      }
    }

    // ---- the complex at radius r, on the plate or on the radius plane above it
    const y = yp + LIFT, cA = 1 - he;
    if (cA > 0.003) {
      // the radius plane, once it lifts off the plate: faint glass in a thin frame
      const pa = prog(rise, 0, 0.15);
      if (pa > 0.003) {
        const h = PW / 2 + 0.04;
        _a[0] = -h; _a[1] = yp; _a[2] = -h; _b[0] = h; _b[1] = yp; _b[2] = -h; _c[0] = h; _c[1] = yp; _c[2] = h; _d[0] = -h; _d[1] = yp; _d[2] = h;
        sheet.add(_a, _b, _c, LK.CYAN, 0.32 * pa, 0); sheet.add(_a, _c, _d, LK.CYAN, 0.32 * pa, 0);
        tubes.add(_a, _b, 0.004, LK.CYAN, 0.8 * pa, 0); tubes.add(_b, _c, 0.004, LK.CYAN, 0.8 * pa, 0);
        tubes.add(_c, _d, 0.004, LK.CYAN, 0.8 * pa, 0); tubes.add(_d, _a, 0.004, LK.CYAN, 0.8 * pa, 0);
        // where the threads cross it: beads in their piece's colour
        for (let i = 0; i < N; i++) {
          if (rep[i] !== i) continue;
          const c = cnt[i] > 1 ? COL[i] : LK.BEAD;
          _a[0] = X[i]; _a[1] = y; _a[2] = Z[i];
          cells.add(_a, BEAD_R * KU * 0.9, LK.CELL.BEAD, c, pa * pA, ANG[i], UP);
        }
      }
      // loops alive: their holes glow (a glass fan, a halo), their rings orange
      for (const L of LOOPS) {
        if (!(L.b <= r && r < L.d)) continue;
        const age = clamp((u - L.ub) / 0.03, 0, 1), fill = 1 - prog(r, L.d - 0.25 * (L.d - L.b), L.d);
        const a = cA * lA * (L.main ? 1 : 0.55) * (0.35 + 0.65 * fill);
        fan(L, y + 0.001, LK.LOOP, a * 0.7, 0);
        ringAt(L, y + 0.0005, L.main ? 0.0042 : 0.0034, LK.LOOP, a);
        _a[0] = L.hx; _a[1] = y + 0.004; _a[2] = L.hz;
        halos.add(_a, L.rad * 1.2, LK.LOOP, a * 0.35);
        if (age < 1) halos.add(_a, L.rad * (1.2 + 2.5 * age), WHITE, cA * lA * (1 - age) * 0.8);   // (just born)
      }
      // triangles and edges alive at r
      for (let k = 0; k < NT; k++) {
        if (TRR[k] > r) continue;
        _a[0] = X[TI[k]]; _a[1] = y; _a[2] = Z[TI[k]]; _b[0] = X[TJ[k]]; _b[1] = y; _b[2] = Z[TJ[k]]; _c[0] = X[TK[k]]; _c[1] = y; _c[2] = Z[TK[k]];
        sheet.add(_a, _b, _c, LK.CYAN, cA * 0.85, 0.15);
      }
      for (let e = 0; e < NE; e++) {
        if (ER[e] > r) continue;
        const fl = 1 - clamp((u - EU[e]) / 0.035, 0, 1);   // (an edge glows as it appears; a joining edge in amber)
        const c = EJOIN[e] && fl > 0 ? LK.mix(LK.EDGE, LK.PIECE, fl * pA, _col) : fl > 0 ? LK.mix(LK.EDGE, WHITE, fl, _col) : LK.EDGE;
        _a[0] = X[EI[e]]; _a[1] = y + 0.001; _a[2] = Z[EI[e]]; _b[0] = X[EJ[e]]; _b[1] = y + 0.001; _b[2] = Z[EJ[e]];
        tubes.add(_a, _b, 0.0026 * (1 + 0.6 * fl), c, cA * (0.85 + 0.15 * fl), 0);
      }
      // the balls: glass discs of radius r round every cell, tinted by their piece
      const R = r * KU, dA = cA * (1 - 0.45 * prog(u, 0.8, 1)) * (1 - 0.35 * rise);
      for (let i = 0; i < N; i++) {
        const c = cnt[rep[i]] > 1 ? LK.mix(LK.CYAN, COL[rep[i]], 0.75 * pA, _col) : LK.CYAN;
        _a[0] = X[i]; _a[1] = y + 0.002; _a[2] = Z[i];
        discs.add(_a, UP, R, c, dA, 1);
      }
    }

    // ---- the tower of scales
    const tw = prog(rise, 0.02, 0.3);
    if (tw > 0.003) {
      // the threads: one per piece from its first cell, thicker as it grows, coloured as its piece
      for (let s = 0; s < NS; s++) {
        const i = SEG[4 * s], n = SEG[4 * s + 3];
        const y0 = rise * hOf(SEG[4 * s + 1]), y1 = SEG[4 * s + 2] === Infinity ? rise * (TH + 0.08) : rise * hOf(SEG[4 * s + 2]);
        column(X[i], Z[i], y0, y1, n > 1 ? thick(n) : 0.0022, n > 1 ? COL[i] : LK.BEAD, tw * pA * (n > 1 ? 1 : 0.45));
      }
      // the bridges: across each joining edge to the piece it joins, at the height of the joining
      for (let k = 0; k < NJ; k++) {
        const yb = rise * hOf(JR[k]), n = BRIDGE[k], c = n > 1 ? COL[JV[k]] : LK.BEAD;
        bridge(k, yb, c, n > 1 ? thick(n) : 0.0024, tw * pA * (n > 1 ? 1 : 0.55) * (yb <= now.yp + 1e-4 ? 1 : GHOST));
        if (yb <= now.yp + 1e-4 && n > 1) { _a[0] = X[JW[k]]; _a[1] = yb; _a[2] = Z[JW[k]]; halos.add(_a, 0.045 + 0.01 * Math.sqrt(n), c, 0.5 * tw * pA); }
      }
      // the top of the trunk
      _a[0] = X[TRUNK]; _a[1] = rise * (TH + 0.08); _a[2] = Z[TRUNK];
      halos.add(_a, 0.16, LK.PIECE, 0.6 * tw * pA * (now.yp >= rise * TH - 1e-3 ? 1 : 0.4));
      // the chimneys: every loop's ring from its birth to its death, capped where it fills
      for (const L of LOOPS) {
        const y0 = rise * hOf(L.b), y1 = rise * hOf(L.d), a = tw * lA * (L.main ? 1 : 0.5);
        if (y1 - y0 < 1e-4 && !L.main) continue;
        // (the poster's loop with its edges and rings lit; the short-lived ones as walls and a cap only)
        for (const [i, j] of L.ring) wall(i, j, y0, y1, LOOPLIT, a * (L.main ? 1 : 0.7));
        const capA = a * (y1 <= now.yp ? 1 : GHOST);
        if (L.main) {
          for (const v of L.vs) column(X[v], Z[v], y0, y1, 0.0032, LOOPLIT, a);
          ringAt(L, y0, 0.0042, LOOPLIT, a * (y0 <= now.yp ? 1 : GHOST));
          ringAt(L, y1, 0.0055, LK.mix(LK.LOOP, WHITE, 0.45, _col2), capA);
        }
        fan(L, y1, LOOPLIT, capA * (L.main ? 1 : 0.55), L.main ? 0 : 0.4);
        if (L.main) { _a[0] = L.hx; _a[1] = (y0 + Math.min(y1, Math.max(y0, now.yp))) / 2; _a[2] = L.hz; halos.add(_a, 0.5, LK.LOOP, 0.3 * a * (L.b <= r && r < L.d ? 1 : 0.4)); }
      }
      // the ruler: a post on the plate's corner, a mark at 2, 5, 10, 20 and 50 µm, and where the plane is
      const ra = tw;
      _a[0] = RULER[0]; _a[1] = 0; _a[2] = RULER[1]; _b[0] = RULER[0]; _b[1] = rise * TH; _b[2] = RULER[1];
      tubes.add(_a, _b, 0.0045, LK.INK, 0.8 * ra, 0);
      for (const m of TICKS) { _a[1] = rise * hOf(m); rings.add(_a, UP, 0.022, 0.0035, LK.INK, 0.85 * ra, 0); }
      _a[1] = now.yp; rings.add(_a, UP, 0.034, 0.005, LK.CYAN, ra, 0);
      _b[0] = -PW / 2 - 0.04; _b[1] = now.yp; _b[2] = RULER[1];
      tubes.add(_a, _b, 0.003, LK.CYAN, 0.6 * ra, 14);
    }

    // ---- the barcode and the Betti curves: the threads and chimneys lift out of the tower as rods and fly to the board
    if (bars > 0.003) {
      for (const B of BARS) {
        const f = smooth((bars - 0.04 - 0.34 * B.k / NB) / 0.2);
        if (f <= 0.003) continue;
        const y0 = rise * hOf(B.b), y1 = B.d === Infinity ? rise * (TH + 0.08) : rise * hOf(B.d), alive = B.b <= r && r < B.d, hop = 0.1 * Math.sin(PI * f);
        const dimA = B.dim ? lA : pA, c = B.dim ? LK.LOOP : LK.PIECE;
        const x = lerp(B.sx, B.x, f), z = lerp(B.sz, B.z, f);
        _a[0] = _b[0] = x; _a[2] = _b[2] = z; _a[1] = y0 + hop; _b[1] = Math.max(y1, y0 + 0.004) + hop;
        const col = B.dim ? c : LK.mix(cnt[rep[B.i]] > 1 || B.d === Infinity ? COL[B.i] : LK.BEAD, c, f, _col);
        tubes.add(_a, _b, B.main || B.d === Infinity ? 0.0058 : 0.0034, alive ? LK.mix(col, WHITE, 0.3, _col) : col, prog(f, 0, 0.15) * dimA * (alive ? 1 : 0.5), 0);
      }
      // the glass board behind them, and the two curves on it, drawing upwards: the count of pieces at a height is the
      // width of the rods' staircase there (a rod's pitch per piece), the count of loops the busy lanes (a lane's pitch)
      const wa = prog(bars, 0.3, 0.6), wh = rise * TH + 0.12;
      if (wa > 0.003) {
        onBoard(-0.07, -0.02, 0, _a); onBoard(SEND + 0.07, -0.02, 0, _b); onBoard(SEND + 0.07, -0.02, wh, _c); onBoard(-0.07, -0.02, wh, _d);
        sheet.add(_a, _b, _c, LK.CYAN, 0.22 * wa, 0); sheet.add(_a, _c, _d, LK.CYAN, 0.22 * wa, 0);
        tubes.add(_a, _b, 0.004, LK.CYAN, 0.6 * wa, 0); tubes.add(_b, _c, 0.004, LK.CYAN, 0.6 * wa, 0);
        tubes.add(_c, _d, 0.004, LK.CYAN, 0.6 * wa, 0); tubes.add(_d, _a, 0.004, LK.CYAN, 0.6 * wa, 0);
        const ca = prog(bars, 0.5, 0.7);
        RIB0.to = RIB1.to = prog(bars, 0.55, 1) * 1.001;
        RU[1] = rise * TH;
        for (let q = 0; q < 2; q++) {
          const s0 = q ? S1 - BOARD.lane / 2 : -BOARD.p / 2, w = q ? B1.top * BOARD.lane : B0.top * BOARD.p, o = RO[q], Y = RY[q];
          onBoard(s0, -0.005, 0, o); Y[0] = Br[0] * w; Y[2] = Br[2] * w;
          ribbons.add(q ? B1ENV : B0ENV, o, RU, Y, 0.008, q ? LK.LOOP : LK.PIECE, ca * (q ? lA : pA), q ? RIB1 : RIB0);
          // the plane's line across, and where it meets the curve (the count at this radius)
          const n = q ? now.n1 : now.n0;
          onBoard(s0, 0.03, now.yp, _a); onBoard(s0 + (q ? LANES * BOARD.lane : NB0 * BOARD.p), 0.03, now.yp, _b);
          tubes.add(_a, _b, 0.0022, LK.CYAN, 0.75 * ca, 0);
          onBoard(s0 + w * n / (q ? B1.top : B0.top), 0.03, now.yp, _a);
          halos.add(_a, 0.07, q ? LK.LOOP : LK.PIECE, ca);
        }
      }
    }
    tubes.end(); rings.end(); halos.end(); sheet.end(); ribbons.end(); cells.end(); discs.end(); stain.end();
  }
  const RIB0 = { glow: 0.8, fill: 0.9, to: 1 }, RIB1 = { glow: 0.8, fill: 0.9, to: 1 };
  const RO = [[0, 0, 0], [0, 0, 0]], RY = [[0, 0, 0], [0, 0, 0]], RU = [0, 1, 0];
  const top0 = () => onBoard(NB0 * BOARD.p * 0.18, 0.03, now.rise * hOf(BARS[Math.round(NB0 * 0.18)].d) + 0.05, [0, 0, 0]);

  // ---------------------------------------------------------------- anchors, labels, views
  const fmtR = r => (r < 10 ? r.toFixed(2) : r.toFixed(1));
  const plural = (n, one, many) => `${n === 1 ? 'one' : n} ${n === 1 ? one : many}`;
  const big = r => (r < MAIN.b ? 'the big loop not yet closed' : r >= MAIN.d ? 'the big one has filled' : T.u(r) - MAIN.ub < 0.05 ? 'the big one just born' : 'the big one still open');
  // the four snapshots, as the poster shows them: its radii and its counts (stored)
  const SNAP = P.snaps.map((r, k) => {
    const [n0, n1] = P.betti[k], head = n0 === 1 ? 'One piece' : `${n0} pieces`;
    const rest = n1 ? ` · ${plural(n1, 'loop', 'loops')}: ${big(r)}` : k === 0 || r < MAIN.b ? ' · no loops yet' : ` · no loops: ${big(r)}`;
    return { r, u: T.u(r), text: [head, rest], tag: `${fmtR(r)} µm` };
  });
  const near = (S, k) => { const d = Math.abs(T.u(Math.max(0.5, +S.tower_r || 1.5)) - SNAP[k].u); return 1 - prog(d, 0.012, 0.03); };
  const flat = S => (1 - prog(S.tower_rise, 0.05, 0.3)) * (1 - clamp(S.tower_he, 0, 1));
  const anchors = {
    plate: [0, 0, 0], label: [0, 0.01, LABEL_Z], top: () => [0, now.rise * TH, 0],
    tag: [-PW / 2 + 0.02, 0.04, -PW / 2 - 0.04],
    cell: () => [X[MAIN.vs[0]], now.yp + 0.02, Z[MAIN.vs[0]]],
    hole: () => [MAIN.hx, now.yp + 0.03, MAIN.hz],
    plane: () => [RULER[0], now.yp + 0.03, RULER[1]],
    trunk: () => [X[TRUNK], now.rise * (TH + 0.08) + 0.04, Z[TRUNK]],
    chimney: () => [MAIN.hx + MAIN.rad, now.rise * (hOf(MAIN.b) + hOf(MAIN.d)) / 2, MAIN.hz],
    bars: top0, bars1: () => onBoard(S1 + BOARD.lane * LANES * 0.5, 0.03, now.rise * hOf(MAIN.d) + 0.06, [0, 0, 0]),
    board: () => onBoard(SEND / 2, 0, now.rise * TH * 0.5, [0, 0, 0]),
  };
  TICKS.forEach((m, k) => { anchors['tick' + k] = () => [RULER[0] + 0.03, now.rise * hOf(m), RULER[1]]; });
  const labels = [
    ...SNAP.map((s, k) => ({ text: s.text, at: 'tag', cls: '', alpha: S => near(S, k) * flat(S) })),
    { text: () => ['The big loop', ' · round an empty space'], at: 'hole', cls: 'amb',
      alpha: S => { const r = +S.tower_r || 1.5; return (MAIN.b <= r && r < MAIN.d ? 1 : 0) * flat(S) * (1 - clamp(S.tower_lit === 1 ? 1 : 0, 0, 1)) * prog(T.u(r) - MAIN.ub, 0.03, 0.06); } },
    { text: () => [`${fmtR(now.r)} µm`, ` · ${plural(now.n0, 'piece', 'pieces')} · ${plural(now.n1, 'loop', 'loops')}`], at: 'plane', cls: 'cyn',
      alpha: S => prog(S.tower_rise, 0.5, 0.9) },
    ...TICKS.map((m, k) => ({ text: [`${m} µm`, ''], at: 'tick' + k, cls: '',
      alpha: S => prog(S.tower_rise, 0.6, 1) * (1 - clamp(S.tower_bars, 0, 1)) * prog(Math.abs(T.u(Math.max(0.5, +S.tower_r || 1.5)) - T.u(m)), 0.03, 0.06) })),
    { text: ['The trunk', ' · one piece left'], at: 'trunk', cls: 'amb',
      alpha: S => prog(S.tower_rise, 0.8, 1) * (1 - prog(S.tower_bars, 0, 0.3)) * prog(+S.tower_r || 0, 17, 20) * (S.tower_lit === 2 ? 0 : 1) },
    { text: ['The big loop', ' · a chimney from birth to filling'], at: 'chimney', cls: 'amb',
      alpha: S => prog(S.tower_rise, 0.8, 1) * (1 - prog(S.tower_bars, 0, 0.3)) * prog(+S.tower_r || 0, 13, 15) * (S.tower_lit === 1 ? 0 : 1) },
    { text: ['Pieces', ` · ${N} rods: their staircase is the count`], at: 'bars', cls: 'amb', alpha: S => prog(S.tower_bars, 0.45, 0.65) * (Math.round(S.tower_lit) === 2 ? 0 : 1) },
    { text: ['Loops', ` · ${NL} rods, at most ${B1.top} at once`], at: 'bars1', cls: 'amb', alpha: S => prog(S.tower_bars, 0.6, 0.8) * (Math.round(S.tower_lit) === 1 ? 0 : 1) },
  ];
  const cam = {
    default: [22, 18, 6.2, 0.25, 0.8, 0.05],
    plate: [8, 52, 3.4, 0, 0, 0.05],
    snap: [0, 64, 3.0, 0, 0, 0.02],
    tower: [26, 12, 5.4, 0.05, 0.85, 0],
    up: [205, -58, 2.6, 0.05, 0.95, 0],
    bars: [-8, 14, 5.6, 0.45, 0.85, -0.2],
    stand: [16, 0, 1.17, 0, 1.06, 0],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['balls', 'Balls'], ['tower', 'Tower'], ['bars', 'Barcode']] },
    { key: 'r', label: 'Radius', options: SNAP.map(s => [String(s.r), s.tag]).concat([['60', '60 µm']]) },
    { key: 'lit', label: 'Lit', options: [['both', 'Both'], ['pieces', 'Pieces'], ['loops', 'Loops']] },
  ];
  function explore(c) {
    const v = c.view || 'tower', r = parseFloat(c.r);
    return {
      tower_he: 0, tower_rise: v === 'balls' ? 0 : 1, tower_bars: v === 'bars' ? 1 : 0,
      tower_r: r > 0 ? clamp(r, 1.5, 60) : v === 'balls' ? SNAP[1].r : 60, tower_lit: c.lit === 'pieces' ? 1 : c.lit === 'loops' ? 2 : 0,
    };
  }

  // ---------------------------------------------------------------- picking and what explore reads
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const near2 = (ray, x, y, z, rr, Mw, best) => {
    _v.set(x, y, z).applyMatrix4(Mw);
    const d = _w.copy(_v).sub(ray.origin).dot(ray.direction);
    return d > 0 && d < best && ray.distanceSqToPoint(_v) < rr * rr ? d : -1;
  };
  // what a ray (a THREE.Raycaster in world coordinates) points at: a cell (on the plate or on the plane), a loop (its
  // hole on the plane, or its chimney), or a rod of the barcode
  function pick(rc) {
    const ray = rc.ray;
    set.group.updateMatrixWorld();
    const Mw = set.group.matrixWorld, s0 = Mw.getMaxScaleOnAxis();
    let hit = null, bt = Infinity, d;
    for (let i = 0; i < N; i++) for (const y of now.rise > 0.05 ? [0, now.yp] : [0]) {
      if ((d = near2(ray, X[i], y, Z[i], 0.035 * s0, Mw, bt)) >= 0) { bt = d; hit = { kind: 'cell', i, piece: rep[i] }; }
    }
    for (const L of LOOPS) {
      const y0 = now.rise * hOf(L.b), y1 = now.rise * hOf(L.d), alive = L.b <= now.r && now.r < L.d;
      const ys = now.rise > 0.05 ? [y0, (y0 + y1) / 2, y1] : alive ? [now.yp] : [];
      for (const y of ys) if ((d = near2(ray, L.hx, y, L.hz, Math.max(0.03, L.rad * 0.8) * s0, Mw, bt)) >= 0) { bt = d; hit = { kind: 'loop', k: L.k }; }
    }
    if (now.bars > 0.5) for (const B of BARS) {
      const y0 = now.rise * hOf(B.b), y1 = B.d === Infinity ? now.rise * TH : now.rise * hOf(B.d);
      for (let q = 0; q <= 4; q++) if ((d = near2(ray, B.x, lerp(y0, y1, q / 4), B.z, 0.025 * s0, Mw, bt)) >= 0) { bt = d; hit = { kind: 'bar', dim: B.dim, i: B.i }; }
    }
    return hit;
  }
  const API = {
    range: [T.rOf(0), T.rOf(1)], ticks: TICKS, snaps: SNAP.map((s, k) => ({ r: s.r, pieces: P.betti[k][0], loops: P.betti[k][1] })),
    counts: r => ({ pieces: pieces(r), loops: loopsAt(r) }),
    // the cell's piece at radius r (the cell its piece started from) and how many cells it holds
    piece(i, r) { replay(r); const p = rep[i], n = cnt[p]; replay(now.r); return { start: p, cells: n }; },
    loop: k => { const L = LOOPS[k]; return L ? { k, b: L.b, d: L.d, main: L.main, edges: L.ring.length } : null; },
    bar: (dim, i) => (dim ? API.loop(i) : { i, b: 0, d: death[i] }),
    pick,
  };
  return Object.assign(set, {
    params: { tower_a: 1, tower_r: 1.5, tower_rise: 0, tower_bars: 0, tower_he: 0, tower_lit: 0 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};
