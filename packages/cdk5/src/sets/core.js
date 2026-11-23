// The core: the close-up at the map's centre (SPEC.md, "core"). Each scene's centre proteins (CDATA.scene(k).centre, at
// their places in CDATA.layout(k): the authors' spring layouts, scaled up about CDK5's middle place to CENTRE_R) as lit
// balls in their scene's colours with their names, and the scene's links among them as lit tubes in the links' colours
// (CDATA's, exactly the authors'), cross-fading as core_scene moves from one scene to the next (the engine keys it with
// net_scene; 1 to 4 have a centre, 0 and 5 none). A ball follows its protein's point in the net set when the engine
// hands the core the net's places (api().posFrom: the net's own stagger, so ball and point never part); alone (the
// harness) it moves straight between the two layouts. Ours: the balls, tubes and names are a clearer drawing of the
// centre's proteins, at the authors' relative places; the pulses that carry the signal and the cut's tags.
// Params: core_a (fade), core_scene (0..5, eased), core_names (1 every name, 0.5 the key ones only), core_hyper (CDK5
// green to red, pulsing faster), core_cut (the CDK5 - calpain link the authors drew appears and flashes once, with its
// tags), core_flow (pulses run along the pathway's links: NTRK2's from BDNF and NTF4 in cyan, the Alzheimer's from CDK5
// in orange; a function of t). Three draw calls (balls, tubes, halos).
SETS.core = function (K) {
  const { THREE, clamp, smooth } = K;
  const set = K.newSet('core'), LK = TLOOK(K, set), CD = CDATA, RGB = CLOOK.RGB;
  const SC = CD.SCENES, NS = SC.length, TAU = Math.PI * 2;
  const prog = (x, a, b) => smooth((x - a) / (b - a));
  // ------------------------------------------------------------- the data
  // every protein that is at the centre in some scene (U), and per scene: at its centre (IN), named there (NM: the
  // scene colours it, or it is one of the activators' scene's three), its colour (COL), its place (POS, the layout's)
  const U = [], UI = new Map();
  for (const k of SC) for (const i of CD.scene(k).centre) if (!UI.has(i)) { UI.set(i, U.length); U.push(i); }
  const NU = U.length, CDK5 = CD.cdk5, R1 = CD.r1, R2 = CD.r2, CAPN1 = CD.capn1;
  const jOf = i => (UI.has(i) ? UI.get(i) : -1), J5 = jOf(CDK5);
  // the scene's colour names (CDATA) as the story's colours; the activators light green wherever they are named
  const CNAME = { green: RGB.cdk5, cyan: RGB.pathway, yellow: RGB.calpain, orange: RGB.alz, red: RGB.hyper };
  const FAINT = [0.5, 0.58, 0.56];
  const IN = [], NM = [], COL = [], POS = [], LINKS = [];
  SC.forEach((k, s) => {
    const sc = CD.scene(k), L = CD.layout(k), cen = new Set(sc.centre);
    const inA = new Float32Array(NU), nmA = new Float32Array(NU), col = Array.from({ length: NU }, () => FAINT), pos = new Float32Array(3 * NU);
    for (let j = 0; j < NU; j++) { const i = U[j]; pos[3 * j] = L[3 * i]; pos[3 * j + 1] = L[3 * i + 1]; pos[3 * j + 2] = L[3 * i + 2]; if (cen.has(i)) inA[j] = 1; }
    for (const name in sc.colours) for (const i of sc.colours[name]) { const j = jOf(i); if (j >= 0 && cen.has(i)) { nmA[j] = 1; col[j] = CNAME[name] || FAINT; } }
    if (k === 'subunits') for (const i of sc.centre) nmA[jOf(i)] = 1;
    for (const i of [R1, R2]) { const j = jOf(i); if (j >= 0 && nmA[j]) col[j] = RGB.activator; }
    // its links among the centre (the map's own links, between proteins on the sphere, stay the net's)
    const lk = [];
    for (const c of sc.links) for (let n = 0; n < c.pairs.length; n += 2) {
      const a = c.pairs[n], b = c.pairs[n + 1];
      if (!cen.has(a) || !cen.has(b)) continue;
      const add = (a === CDK5 && b === CAPN1) || (a === CAPN1 && b === CDK5);
      lk.push({ a: jOf(a), b: jOf(b), col: c.rgba.slice(0, 3), al: c.rgba[3], five: a === CDK5 || b === CDK5, add, key: Math.min(a, b) + ',' + Math.max(a, b) });
    }
    IN.push(inA); NM.push(nmA); COL.push(col); POS.push(pos); LINKS.push(lk);
  });
  // the signal (core_flow): a breadth-first order from its sources over the scene's links; each link carries a pulse
  // from its nearer end to its further one as the wave passes that level (links within a level carry none)
  const FLOW = {};
  const flowOf = (s, src, col) => {
    const lv = new Int16Array(NU).fill(-1), q = [];
    for (const i of src) { const j = jOf(i); if (j >= 0 && IN[s][j]) { lv[j] = 0; q.push(j); } }
    const adj = Array.from({ length: NU }, () => []);
    for (const l of LINKS[s]) { adj[l.a].push(l.b); adj[l.b].push(l.a); }
    for (let h = 0; h < q.length; h++) for (const b of adj[q[h]]) if (lv[b] < 0) { lv[b] = lv[q[h]] + 1; q.push(b); }
    const edges = [];
    for (const l of LINKS[s]) {
      if (lv[l.a] < 0 || lv[l.b] < 0 || lv[l.a] === lv[l.b]) continue;
      edges.push(lv[l.a] < lv[l.b] ? [l.a, l.b, lv[l.a]] : [l.b, l.a, lv[l.b]]);
    }
    FLOW[s] = { lv, edges, L: Math.max(0, ...lv), col };
  };
  flowOf(SC.indexOf('ntrk2'), [CD.find('BDNF'), CD.find('NTF4')], RGB.pathway);
  flowOf(SC.indexOf('alzheimer'), [CDK5], RGB.alz);
  const HOP = 0.75, REST = 1.6;   // seconds a level, and the pause before the next wave
  // for each move from scene k to k + 1: each of k's links' twin in k + 1 (or null), and k + 1's links new to it
  const TWIN = [], NEW = [];
  for (let k = 0; k + 1 < NS; k++) {
    TWIN.push(LINKS[k].map(l => LINKS[k + 1].find(m => m.key === l.key) || null));
    NEW.push(LINKS[k + 1].filter(l => !LINKS[k].some(m => m.key === l.key)));
  }

  // ----------------------------------------------------------- the drawing
  const balls = LK.balls(NU + 2), tubes = LK.tubes(160), halos = LK.halos(220);
  set.group.add(tubes.mesh, balls.mesh, halos.mesh);
  // where each centre protein is now (P: also its anchor, PA[j]), how much it is there (A), named (NA), its colour (CL)
  const P = new Float32Array(3 * NU), PA = Array.from({ length: NU }, () => [0, 0, 0]), A = new Float32Array(NU), NA = new Float32Array(NU);
  const R = new Float32Array(NU), CL = Array.from({ length: NU }, () => [0, 0, 0]), LA = new Float32Array(NU);
  let posFrom = null;   // the net's places (api().posFrom)
  // the viewer (api().eye: in the set's frame) and how near nothing may be drawn (CLR, in the set's units: the engine's,
  // 0.35 m in a headset); a ball, tube or glow fades out as it comes within CLR to 1.6 CLR of the eye
  const EYE = [0, 0, 4.4], EF = new Float32Array(NU).fill(1);
  let CLR = 0.06;
  const eyeFade = p => { const d = Math.hypot(p[0] - EYE[0], p[1] - EYE[1], p[2] - EYE[2]); return smooth((d - CLR) / (0.6 * CLR)); };
  const _o = [0, 0, 0], _c = [0, 0, 0], _c2 = [0, 0, 0], c5 = [0, 0, 0], _w = [1, 1, 1];
  const cur = { s: 1, k0: 1, k1: 1, f: 0, cutW: 0, cut: 0, mid: [0, 0, 0], tag: [0, 0, 0] };
  const mix3 = (a, b, t, o) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
  function update(S, t) {
    const s = clamp(S.core_scene, 0, NS - 1), k0 = Math.min(Math.floor(s), NS - 2), f = s - k0, k1 = k0 + 1;
    cur.s = s; cur.k0 = k0; cur.k1 = k1; cur.f = f;
    const hy = clamp(S.core_hyper, 0, 1);
    mix3(RGB.cdk5, RGB.hyper, hy, c5);
    // the scene's flow, by the nearest scene with one (its weight falling as the scene moves on)
    const sn = Math.round(s), fl = FLOW[sn], flW = fl ? clamp(S.core_flow, 0, 1) * clamp(1 - 2 * Math.abs(s - sn), 0, 1) : 0;
    const T = fl ? (fl.L + 1) * HOP + REST : 1, ph = fl ? ((t % T) + T) % T : 0;
    for (let j = 0; j < NU; j++) {
      const w0 = IN[k0][j] * (1 - f), w1 = IN[k1][j] * f, w = w0 + w1;
      A[j] = w;
      if (w <= 0.004) { NA[j] = 0; LA[j] = 0; continue; }
      if (posFrom) { posFrom(U[j], _o); P[3 * j] = _o[0]; P[3 * j + 1] = _o[1]; P[3 * j + 2] = _o[2]; }
      else for (let a = 0; a < 3; a++) P[3 * j + a] = POS[k0][3 * j + a] + (POS[k1][3 * j + a] - POS[k0][3 * j + a]) * f;
      PA[j][0] = P[3 * j]; PA[j][1] = P[3 * j + 1]; PA[j][2] = P[3 * j + 2];
      EF[j] = eyeFade(PA[j]);
      const n0 = NM[k0][j], n1 = NM[k1][j], na = (n0 * w0 + n1 * w1) / w;
      NA[j] = na;
      LA[j] = clamp(((n0 * (1 - f) + n1 * f) - 0.55) / 0.35, 0, 1) * clamp((w - 0.6) / 0.3, 0, 1);
      if (j === J5) { CL[j][0] = c5[0]; CL[j][1] = c5[1]; CL[j][2] = c5[2]; }
      else {
        const a0 = n0 ? COL[k0][j] : FAINT, a1 = n1 ? COL[k1][j] : FAINT;
        mix3(a0, a1, w > 0 ? w1 / w : 0, CL[j]);
      }
      R[j] = (j === J5 ? 0.045 : 0.016 + 0.012 * na);
      // the wave reaching this protein brightens it
      if (flW > 0 && fl.lv[j] >= 0) { const g = flW * Math.max(0, 1 - Math.abs(ph - fl.lv[j] * HOP) / 0.4); if (g > 0) mix3(CL[j], _w, 0.55 * g, CL[j]); }
    }
    // CDK5's state: green to red, glowing brighter and pulsing faster as it turns
    const osc = (1 - hy) * (0.5 + 0.5 * Math.sin(TAU * 0.45 * t)) + hy * (0.5 + 0.5 * Math.sin(TAU * 1.7 * t));
    if (J5 >= 0) R[J5] = 0.045 * (1 + 0.1 * hy * osc);
    balls.begin();
    for (let j = 0; j < NU; j++) if (A[j] > 0.004) balls.add(PA[j], R[j], CL[j], A[j] * EF[j] * (0.35 + 0.65 * NA[j]));
    balls.end();
    // the links, the two scenes' cross-faded (one in both stays, its colour mixing); the link the authors drew between
    // CDK5 and calpain only as far as the cut has come, flashing once
    cur.cut = clamp(S.core_cut, 0, 1);
    const flash = Math.sin(Math.PI * clamp((cur.cut - 0.3) / 0.7, 0, 1));
    cur.cutW = 0;
    tubes.begin();
    const drawL = (l, a, col) => {
      if (A[l.a] <= 0.004 || A[l.b] <= 0.004) return;
      let al = a * Math.min(A[l.a] * EF[l.a], A[l.b] * EF[l.b]), r = l.five ? 0.0055 : 0.0042;
      if (l.add) {
        const cw = prog(cur.cut, 0.05, 0.4);
        cur.cutW = Math.max(cur.cutW, a * cw);
        al *= cw; r = 0.006 + 0.006 * flash;
        col = mix3(col, _w, 0.7 * flash, _c);
        mix3(PA[l.a], PA[l.b], 0.5, cur.mid);
      }
      tubes.add(PA[l.a], PA[l.b], r, col, al);
    };
    const L0 = LINKS[k0], TW = TWIN[k0], NW = NEW[k0];
    for (let n = 0; n < L0.length; n++) { const l = L0[n], o = TW[n]; drawL(l, (1 - f) * l.al + (o ? f * o.al : 0), o ? mix3(l.col, o.col, f, _c2) : l.col); }
    for (let n = 0; n < NW.length; n++) drawL(NW[n], f * NW[n].al, NW[n].col);
    tubes.end();
    // glows: CDK5's, the cut's flash, the signal's pulses
    halos.begin();
    if (J5 >= 0 && A[J5] > 0.004) halos.add(PA[J5], 0.15 * (1 + 0.25 * osc) + 0.05 * hy, c5, A[J5] * EF[J5] * (0.45 + 0.35 * hy) * (0.7 + 0.3 * osc));
    if (cur.cutW > 0.01 && flash > 0.01) halos.add(cur.mid, 0.07 + 0.12 * flash, RGB.calpain, 0.8 * cur.cutW * flash * eyeFade(cur.mid));
    if (flW > 0.004) {
      for (let n = 0; n < fl.edges.length; n++) {
        const e = fl.edges[n], a = e[0], b = e[1], u = (ph - e[2] * HOP) / HOP;
        if (u <= 0 || u >= 1 || A[a] <= 0.004 || A[b] <= 0.004) continue;
        mix3(PA[a], PA[b], u, _o);
        const ea = Math.min(A[a] * EF[a], A[b] * EF[b]);
        halos.add(_o, 0.045, fl.col, flW * Math.pow(Math.sin(Math.PI * u), 0.6) * ea);
        halos.add(_o, 0.016, _w, 0.8 * flW * Math.sin(Math.PI * u) * ea);
      }
    }
    halos.end();
    if (J5 >= 0) { cur.tag[0] = PA[J5][0]; cur.tag[1] = PA[J5][1] - 0.07; cur.tag[2] = PA[J5][2]; }
    LK.depth();
  }

  // ---------------------------------------------------------- the names
  // every centre protein its gene symbol (CDK5 is the net's own label); the key ones with a short role, and only those
  // on narrow screens (minor) or with core_names at 0.5
  const ROLE = { BDNF: ['BDNF', ' · growth factor'], NTRK2: ['NTRK2', ' · its receptor'], CDK5R1: ['p35', ' · CDK5R1'], CDK5R2: ['p39', ' · CDK5R2'],
    CAPN1: ['calpain', ' · CAPN1'], APP: ['APP', ''], LMNB1: ['LMNB1', ' · nuclear envelope'], FOXO3: ['FOXO3', ''], GOLGA2: ['GOLGA2', ' · Golgi'],
    PRDX1: ['PRDX1', ' · against oxidative stress'] };
  const inScene = (k, i) => CD.scene(k).centre.includes(i);
  const labels = [];
  U.forEach((i, j) => {
    if (i === CDK5) return;
    const sym = CD.sym[i], key = !!ROLE[sym];
    const cls = i === R1 || i === R2 ? 'grn' : inScene('ntrk2', i) && !inScene('alzheimer', i) ? 'cyn' : 'amb';
    labels.push({ text: ROLE[sym] || [sym, ''], at: () => PA[j], cls, minor: !key,
      alpha: S => LA[j] * clamp(key ? S.core_names * 2 : S.core_names * 2 - 1, 0, 1) });
  });
  // the cut's two tags, while the calpain scene shows (the link the authors drew is not an interaction)
  labels.push({ text: ['p35 cut into p25', ' · CDK5 stays on'], at: 'cutTag', cls: 'amb', alpha: S => prog(S.core_cut, 0.5, 0.9) * clamp(1 - 2 * Math.abs(cur.s - 3), 0, 1) });
  labels.push({ text: ['Drawn by the authors', ' · calpain acts on p35'], at: 'cutMid', cls: '', minor: true,
    alpha: S => 0.9 * prog(S.core_cut, 0.6, 1) * clamp(1 - 2 * Math.abs(cur.s - 3), 0, 1) });

  // -------------------------------------------------------------- picking
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray();
  // a ray (a THREE.Raycaster in world coordinates) to the nearest ball it passes through (a little generously): its
  // protein's index, or -1
  function pick(raycaster) {
    if (set.uA.value < 0.5) return -1;
    set.group.updateMatrixWorld();
    _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    const o = _ray.origin, d = _ray.direction;
    let best = -1, bs = 1;
    for (let j = 0; j < NU; j++) {
      if (A[j] < 0.3) continue;
      const x = P[3 * j] - o.x, y = P[3 * j + 1] - o.y, z = P[3 * j + 2] - o.z, along = x * d.x + y * d.y + z * d.z;
      if (along <= 0) continue;
      const off = Math.sqrt(Math.max(0, x * x + y * y + z * z - along * along)), sc = off / (R[j] * 1.5 + 0.004 * along);
      if (sc < bs) { bs = sc; best = U[j]; }
    }
    return best;
  }
  const ap = i => { const j = jOf(i); return j >= 0 ? PA[j] : [0, 0, 0]; };
  const API = {
    pick,
    // a protein's ball now (in the net's frame, as the core is drawn), or null when it is not at the centre
    pos(i, out) { const j = jOf(i); if (j < 0 || A[j] <= 0.004) return null; const o = out || [0, 0, 0]; o[0] = PA[j][0]; o[1] = PA[j][1]; o[2] = PA[j][2]; return o; },
    // the engine hands the net's places over (fn(i, out): a protein's current place)
    posFrom(fn) { posFrom = typeof fn === 'function' ? fn : null; },
    // where the viewer is, in the set's frame, and how near nothing may be drawn (in the set's units)
    eye(x, y, z, clr) { EYE[0] = x; EYE[1] = y; EYE[2] = z; if (clr > 0) CLR = clr; },
    // the centre proteins of every scene (indices), for the panes
    proteins: () => U.slice(),
  };
  return Object.assign(set, {
    params: { core_a: 1, core_scene: 1, core_names: 1, core_hyper: 0, core_cut: 0, core_flow: 0 },
    update,
    anchors: { centre: [0, 0, 0], cdk5: () => ap(CDK5), capn1: () => ap(CAPN1), bdnf: () => ap(CD.find('BDNF')), ntrk2: () => ap(CD.find('NTRK2')),
      app: () => ap(CD.find('APP')), top: [0, CD.CENTRE_R + 0.12, 0], cutTag: () => cur.tag, cutMid: () => cur.mid },
    labels,
    cam: { default: [20, 10, 1.9, 0, 0, 0], low: [32, -16, 1.9, 0, -0.04, 0] },
    controls: [], explore() { return {}; },
    api: () => API,
  });
};
