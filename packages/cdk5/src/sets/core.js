// The core: the close-up at the map's centre (SPEC.md, "core"; manifest core.md). Each scene's centre proteins
// (CDATA.scene(k).centre, at their places in CDATA.layout(k): the authors' spring layouts, scaled up about CDK5's middle
// place to CENTRE_R) as lit balls in their scene's colours, and the scene's links among them as lit tubes in the links'
// colours (CDATA's, exactly the authors'), cross-fading as core_scene moves from one scene to the next (the engine keys
// it with net_scene; the map of processes, the partners' star and the landscape have no centre of balls but CDK5's). A
// ball follows its protein's point in the net set when the engine hands the core the net's places (api().posFrom: the
// net's own stagger, so ball and point never part); alone (the harness) it moves straight between the two layouts.
// Real structures from the Protein Data Bank (src/models.json, built by tools/mol/build.py into packages/cdk5/models/,
// fetched once the core first shows; a ball stands in until one arrives) take the place of their protein's ball, each
// shown by its own param: CDK5, p35 (its activating part, the piece calpain leaves as p25, with a small ball for the rest
// of p35, which has no structure) docking onto CDK5 or letting go (core_dock), calpain, BDNF and NTRK2's binding domain,
// SEMA4D and PLXNB1, NPAS4, and Tau's filament as a close-up beside the centre (Tau is not in the Alzheimer's pathway's
// list: it is a partner of CDK5 in the interactome, and its thread to CDK5 is that link). Close-ups not to scale. Ours:
// the balls, tubes, names, structures and their placing at the balls, the pulses, the cut and the phosphate tags.
// Params: core_a (fade), core_scene (0..8, eased), core_names (1 every name, 0 only those the structure params show),
// core_hyper (CDK5 green to red, pulsing faster), core_cut (the CDK5 - calpain link the authors drew appears and
// flashes once; p35's rest breaks off, p35 becomes p25), core_flow (pulses run along the pathway's links: NTRK2's from
// BDNF and NTF4, the semaphorins' from the semaphorins, NPAS4's from NPAS4, the Alzheimer's from CDK5; a function of t),
// core_dock (p35 at its own place 0, docked on CDK5 1), core_mCdk5, core_mP35, core_p39, core_mCapn, core_mBdnf,
// core_mTrkb, core_mSema, core_mNpas4 (a structure or a name each), core_tau (Tau's ball, name and thread), core_mTau
// (its filament), core_phos (phosphate tags gathering on Tau). Four draw calls and one per structure on show.
SETS.core = function (K) {
  const { THREE, clamp, smooth } = K;
  const set = K.newSet('core'), LK = TLOOK(K, set), CD = CDATA, RGB = CLOOK.RGB;
  const SC = CD.SCENES, NS = SC.length, TAU = Math.PI * 2;
  const prog = (x, a, b) => smooth((x - a) / (b - a));
  const sOf = k => SC.indexOf(k), S_CAL = sOf('calpain'), S_NP = sOf('npas4');
  // ------------------------------------------------------------- the data
  // every protein that is at the centre in some scene (U), and per scene: at its centre (IN), named there (NM: the
  // scene colours it, or it is one of the activators' scene's three), its colour (COL), its place (POS, the layout's)
  const U = [], UI = new Map();
  for (const k of SC) for (const i of CD.scene(k).centre) if (!UI.has(i)) { UI.set(i, U.length); U.push(i); }
  const NU = U.length, CDK5 = CD.cdk5, R1 = CD.r1, R2 = CD.r2, CAPN1 = CD.capn1, NPAS4 = CD.npas4;
  const jOf = i => (UI.has(i) ? UI.get(i) : -1), J5 = jOf(CDK5), J1 = jOf(R1);
  // the scene's colour names (CDATA) as the story's colours; the activators light green wherever they are named
  const CNAME = { green: RGB.cdk5, mint: RGB.cdk5, cyan: RGB.pathway, teal: RGB.pathway, yellow: RGB.calpain, orange: RGB.alz, red: RGB.hyper, olive: RGB.activator };
  const FAINT = [0.5, 0.58, 0.56];
  const IN = [], NM = [], COL = [], POS = [], LINKS = [];
  SC.forEach((k, s) => {
    const sc = CD.scene(k), L = CD.layout(k), cen = new Set(sc.centre);
    const inA = new Float32Array(NU), nmA = new Float32Array(NU), col = Array.from({ length: NU }, () => FAINT), pos = new Float32Array(3 * NU);
    for (let j = 0; j < NU; j++) { const i = U[j]; pos[3 * j] = L[3 * i]; pos[3 * j + 1] = L[3 * i + 1]; pos[3 * j + 2] = L[3 * i + 2]; if (cen.has(i)) inA[j] = 1; }
    for (const name in sc.colours) for (const i of sc.colours[name]) { const j = jOf(i); if (j >= 0 && cen.has(i)) { nmA[j] = 1; col[j] = CNAME[name] || FAINT; } }
    if (k === 'subunits') for (const i of sc.centre) nmA[jOf(i)] = 1;
    for (const i of [R1, R2]) { const j = jOf(i); if (j >= 0 && nmA[j]) col[j] = RGB.activator; }
    // its links among the centre (the map's own links, between proteins on the sphere, stay the net's); the two the
    // authors added (CDK5 - calpain, CDK5 - NPAS4) marked
    const lk = [];
    for (const c of sc.links) for (let n = 0; n < c.pairs.length; n += 2) {
      const a = c.pairs[n], b = c.pairs[n + 1];
      if (!cen.has(a) || !cen.has(b)) continue;
      const add = (a === CDK5 && b === CAPN1) || (a === CAPN1 && b === CDK5), addN = (a === CDK5 && b === NPAS4) || (a === NPAS4 && b === CDK5);
      lk.push({ a: jOf(a), b: jOf(b), col: c.rgba.slice(0, 3), al: Math.max(c.rgba[3], 0.45), five: a === CDK5 || b === CDK5, add, addN, key: Math.min(a, b) + ',' + Math.max(a, b) });
    }
    IN.push(inA); NM.push(nmA); COL.push(col); POS.push(pos); LINKS.push(lk);
  });
  // the signal (core_flow): a breadth-first order from its sources over the scene's links; each link carries a pulse
  // from its nearer end to its further one as the wave passes that level (links within a level carry none)
  const FLOW = {};
  const flowOf = (s, src, col) => {
    if (s < 0) return;
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
  flowOf(sOf('ntrk2'), [CD.find('BDNF'), CD.find('NTF4')], RGB.pathway);
  flowOf(sOf('sema'), CD.scene('sema').centre.filter(i => /^SEMA/.test(CD.sym[i])), RGB.pathway);
  flowOf(S_NP, [NPAS4], RGB.pathway);
  flowOf(sOf('alzheimer'), [CDK5], RGB.alz);
  const HOP = 0.75, REST = 1.6;   // seconds a level, and the pause before the next wave
  // for each move from scene k to k + 1: each of k's links' twin in k + 1 (or null), and k + 1's links new to it
  const TWIN = [], NEW = [];
  for (let k = 0; k + 1 < NS; k++) {
    TWIN.push(LINKS[k].map(l => LINKS[k + 1].find(m => m.key === l.key) || null));
    NEW.push(LINKS[k + 1].filter(l => !LINKS[k].some(m => m.key === l.key)));
  }

  // ----------------------------------------------------------- the drawing
  const balls = LK.balls(NU + 8), tubes = LK.tubes(360), halos = LK.halos(340);
  set.group.add(tubes.mesh, balls.mesh, halos.mesh);
  // where each centre protein is now (P: also its anchor, PA[j]), how much it is there (A), named (NA), its colour (CL)
  const P = new Float32Array(3 * NU), PA = Array.from({ length: NU }, () => [0, 0, 0]), A = new Float32Array(NU), NA = new Float32Array(NU);
  const R = new Float32Array(NU), CL = Array.from({ length: NU }, () => [0, 0, 0]), LA = new Float32Array(NU), HIDE = new Float32Array(NU);
  let posFrom = null;   // the net's places (api().posFrom)
  // the viewer (api().eye: in the set's frame) and how near nothing may be drawn (CLR, in the set's units: the engine's,
  // 0.35 m in a headset); a ball, tube or glow fades out as it comes within CLR to 1.6 CLR of the eye
  const EYE = [0, 0, 4.4], EF = new Float32Array(NU).fill(1);
  let CLR = 0.06;
  const eyeFade = p => { const d = Math.hypot(p[0] - EYE[0], p[1] - EYE[1], p[2] - EYE[2]); return smooth((d - CLR) / (0.6 * CLR)); };
  const _o = [0, 0, 0], _c = [0, 0, 0], _c2 = [0, 0, 0], c5 = [0, 0, 0], _w = [1, 1, 1];
  const cur = { s: 1, k0: 1, k1: 1, f: 0, cutW: 0, cut: 0, mid: [0, 0, 0], midN: [0, 0, 0], midNW: 0, tag: [0, 0, 0], p35: [0, 0, 0], p35A: 0, tail: [0, 0, 0], tau: [0, 0, 0] };
  const mix3 = (a, b, t, o) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };

  // ------------------------------------------------------------ structures
  // each structure takes the place of its protein's ball (i), at its own size (r: its bounding sphere, scene units; not
  // to scale with the map or with each other, but CDK5 and p35's part share one scale, so they dock as in the crystal),
  // shown by its param (p). Tau's sits beside the centre (TAUP), on the side the close-ups face (the core's default view
  // looks from 20 degrees round, so its right is (cos 20, 0, -sin 20)), its thread to CDK5 the interactome's link
  const MURL = f => HOST.pkgUrl('cdk5', 'models/' + f);
  const fnd = s => CD.find(s);
  const TAUP = [0.5 * Math.cos(20 * Math.PI / 180), 0.1, -0.5 * Math.sin(20 * Math.PI / 180)];
  const SLOTS = [
    { m: 'cdk5', i: CDK5, r: 0.075, p: 'core_mCdk5' },
    { m: 'p25', i: R1, p: 'core_mP35' },
    { m: 'capn1', i: CAPN1, r: 0.07, p: 'core_mCapn' },
    { m: 'bdnf', i: fnd('BDNF'), r: 0.05, p: 'core_mBdnf' },
    { m: 'trkb', i: fnd('NTRK2'), r: 0.05, p: 'core_mTrkb' },
    { m: 'sema4d', i: fnd('SEMA4D'), r: 0.12, p: 'core_mSema' },
    { m: 'plxnb1', i: fnd('PLXNB1'), r: 0.1, p: 'core_mSema' },
    { m: 'npas4', i: NPAS4, r: 0.09, p: 'core_mNpas4' },
    { m: 'tau', i: -1, r: 0.12, p: 'core_mTau' },
  ];
  for (const s of SLOTS) { s.j = s.i >= 0 ? jOf(s.i) : -1; s.mesh = null; s.a = 0; s.u = { value: 0 }; }
  const SL = Object.fromEntries(SLOTS.map(s => [s.m, s]));
  let fetched = false, sCdk = 0;
  const _v = new THREE.Vector3();
  // a structure's mesh once its file has come (its material's fade its own: the set's times its param)
  function meshOf(s) {
    if (s.mesh) return s.mesh;
    const m = MOLS.m[s.m];
    if (!m || m.pend || !m.head) return null;
    if (s.m === 'cdk5' || s.m === 'p25') {   // (one scale, the entry's own frame: they dock as in the crystal)
      if (!sCdk) { const h = MOLS.m.cdk5 && MOLS.m.cdk5.head; if (!h) return null; sCdk = SL.cdk5.r / h.radius; }
      s.mesh = molMesh(set, s.m, { look: 'surface', scale: sCdk, centred: false });
    } else s.mesh = molMesh(set, s.m, { look: 'surface', radius: s.r });
    if (!s.mesh.ok) return null;
    s.mesh.mat.uniforms.uA = s.u;
    s.C = m.head.centre;
    s.mesh.group.visible = false;
    set.group.add(s.mesh.group);
    return s.mesh;
  }
  // p35's rest (residues 1 to 146: no structure) as a small ball beside its part's first residue, 147, pushed outward
  const tailAt = [0, 0, 0];
  function placeStructures(S) {
    const sa = set.uA.value, dock = clamp(S.core_dock || 0, 0, 1), cut = clamp(S.core_cut || 0, 0, 1);
    const c5p = J5 >= 0 ? PA[J5] : [0, 0, 0];
    for (const s of SLOTS) {
      const want = clamp(S[s.p] || 0, 0, 1);
      if (want > 0.004 && !fetched) { fetched = true; molLoad(MURL, SLOTS.map(x => x.m)); }
      const ms = want > 0.004 ? meshOf(s) : s.mesh;
      // its ball must be there (or, for Tau, the close-up's place)
      let at = s.j >= 0 ? A[s.j] * EF[s.j] : 1;
      if (s.m === 'p25') at = Math.max(J1 >= 0 ? A[J1] : 0, J5 >= 0 ? A[J5] : 0);   // (docked, it needs only CDK5)
      s.a = want * at;
      if (s.j >= 0) HIDE[s.j] = Math.max(HIDE[s.j], ms ? s.a : 0);
      if (!ms) continue;
      const vis = s.a * sa > 0.004;
      ms.group.visible = vis;
      if (!vis) continue;
      s.u.value = s.a * sa;
      const g = ms.group, sc = ms.s;
      if (s.m === 'cdk5') g.position.set(c5p[0] - s.C[0] * sc, c5p[1] - s.C[1] * sc, c5p[2] - s.C[2] * sc);
      else if (s.m === 'p25') {
        // docked: the crystal's pose on CDK5; else its own middle at p35's ball (or docked when p35 has none here)
        const d = J1 >= 0 && A[J1] > 0.3 ? dock : 1, own = J1 >= 0 ? PA[J1] : c5p, C5 = SL.cdk5.C || s.C;
        _v.set(own[0] - s.C[0] * sc, own[1] - s.C[1] * sc, own[2] - s.C[2] * sc);
        g.position.set(c5p[0] - C5[0] * sc, c5p[1] - C5[1] * sc, c5p[2] - C5[2] * sc).lerp(_v, 1 - d);
        cur.p35[0] = g.position.x + s.C[0] * sc; cur.p35[1] = g.position.y + s.C[1] * sc + 0.02; cur.p35[2] = g.position.z + s.C[2] * sc;
        ms.anchor('D', 147, _v).add(g.position);
        const ox = _v.x - cur.p35[0], oy = _v.y - cur.p35[1] + 0.02, oz = _v.z - cur.p35[2], ol = Math.hypot(ox, oy, oz) || 1, sep = prog(cut, 0.45, 0.95);
        tailAt[0] = _v.x + ox / ol * (0.022 + 0.3 * sep); tailAt[1] = _v.y + oy / ol * (0.022 + 0.3 * sep) - 0.12 * sep; tailAt[2] = _v.z + oz / ol * (0.022 + 0.3 * sep);
      } else if (s.m === 'tau') g.position.set(TAUP[0], TAUP[1], TAUP[2]);
      else { const p = PA[s.j]; g.position.set(p[0], p[1], p[2]); }
      if (s.m === 'cdk5') ms.setHighlight('A:0', 'A:999', CLOOK.C.hyper, 0.9 * clamp(S.core_hyper || 0, 0, 1));
    }
    cur.p35A = SL.p25.a;
  }

  function update(S, t) {
    const s = clamp(S.core_scene, 0, NS - 1), k0 = Math.min(Math.floor(s), NS - 2), f = s - k0, k1 = k0 + 1;
    cur.s = s; cur.k0 = k0; cur.k1 = k1; cur.f = f;
    const hy = clamp(S.core_hyper, 0, 1);
    mix3(RGB.cdk5, RGB.hyper, hy, c5);
    // the scene's flow, by the nearest scene with one (its weight falling as the scene moves on)
    const sn = Math.round(s), fl = FLOW[sn], flW = fl ? clamp(S.core_flow, 0, 1) * clamp(1 - 2 * Math.abs(s - sn), 0, 1) : 0;
    const T = fl ? (fl.L + 1) * HOP + REST : 1, ph = fl ? ((t % T) + T) % T : 0;
    for (let j = 0; j < NU; j++) {
      HIDE[j] = 0;
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
    placeStructures(S);
    // CDK5's state: green to red, glowing brighter and pulsing faster as it turns (and brighter while p35 is docked)
    const osc = (1 - hy) * (0.5 + 0.5 * Math.sin(TAU * 0.45 * t)) + hy * (0.5 + 0.5 * Math.sin(TAU * 1.7 * t));
    if (J5 >= 0) R[J5] = 0.045 * (1 + 0.1 * hy * osc);
    balls.begin();
    for (let j = 0; j < NU; j++) if (A[j] > 0.004 && HIDE[j] < 0.995) balls.add(PA[j], R[j], CL[j], A[j] * EF[j] * (0.35 + 0.65 * NA[j]) * (1 - HIDE[j]));
    // p35's rest, beside its structure, until the cut takes it away
    const tailA = cur.p35A * (SL.p25.mesh ? 1 : 0) * (1 - prog(clamp(S.core_cut, 0, 1), 0.55, 1));
    if (tailA > 0.004) { cur.tail[0] = tailAt[0]; cur.tail[1] = tailAt[1]; cur.tail[2] = tailAt[2]; balls.add(tailAt, 0.02, RGB.activator, tailA); }
    // Tau's ball until its filament has come, at the close-up's place
    const tauA = clamp(S.core_tau || 0, 0, 1), tauM = SL.tau.mesh ? SL.tau.a : 0;
    if (tauA * (1 - tauM) > 0.004) balls.add(TAUP, 0.035, RGB.alz, tauA * (1 - tauM));
    balls.end();
    // the links, the two scenes' cross-faded (one in both stays, its colour mixing); the link the authors drew between
    // CDK5 and calpain only as far as the cut has come, flashing once
    cur.cut = clamp(S.core_cut, 0, 1);
    const flash = Math.sin(Math.PI * clamp((cur.cut - 0.3) / 0.7, 0, 1));
    cur.cutW = 0; cur.midNW = 0;
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
      if (l.addN) { cur.midNW = Math.max(cur.midNW, al); mix3(PA[l.a], PA[l.b], 0.5, cur.midN); }
      tubes.add(PA[l.a], PA[l.b], r, col, al);
    };
    const L0 = LINKS[k0], TW = TWIN[k0], NW = NEW[k0];
    for (let n = 0; n < L0.length; n++) { const l = L0[n], o = TW[n]; drawL(l, (1 - f) * l.al + (o ? f * o.al : 0), o ? mix3(l.col, o.col, f, _c2) : l.col); }
    for (let n = 0; n < NW.length; n++) drawL(NW[n], f * NW[n].al, NW[n].col);
    // Tau's thread: the interactome's link from CDK5 to Tau (MAPT), in CDK5's colour
    if (tauA > 0.004 && J5 >= 0 && A[J5] > 0.004) tubes.add(PA[J5], TAUP, 0.005, c5, 0.7 * tauA * A[J5]);
    tubes.end();
    // glows: CDK5's, the cut's flash, the signal's pulses, the phosphate tags on Tau
    halos.begin();
    const dockGlow = SL.p25.a * clamp(S.core_dock || 0, 0, 1);
    if (J5 >= 0 && A[J5] > 0.004) halos.add(PA[J5], 0.15 * (1 + 0.25 * osc) + 0.05 * hy + 0.06 * dockGlow, c5, A[J5] * EF[J5] * (0.45 + 0.35 * hy + 0.25 * dockGlow) * (0.7 + 0.3 * osc));
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
    // phosphate tags: pulses run down the thread from CDK5 and stay on Tau, more and more of them (core_phos)
    const ph2 = clamp(S.core_phos || 0, 0, 1);
    if (ph2 > 0.004 && tauA > 0.004 && J5 >= 0) {
      const nT = Math.round(ph2 * PH_N);
      for (let k = 0; k < nT; k++) { const o = PH_OFF[k]; _o[0] = TAUP[0] + o[0]; _o[1] = TAUP[1] + o[1]; _o[2] = TAUP[2] + o[2]; halos.add(_o, 0.028, RGB.hyper, 0.75 * tauA); }
      for (let k = 0; k < 3; k++) {
        const u = ((t * 0.7 + k / 3) % 1);
        mix3(PA[J5], TAUP, u, _o);
        halos.add(_o, 0.035, RGB.hyper, tauA * Math.sin(Math.PI * u) * Math.min(1, ph2 * 4));
      }
    }
    halos.end();
    if (J5 >= 0) { cur.tag[0] = PA[J5][0]; cur.tag[1] = PA[J5][1] - 0.07; cur.tag[2] = PA[J5][2]; }
    cur.tau[0] = TAUP[0]; cur.tau[1] = TAUP[1] + 0.1; cur.tau[2] = TAUP[2];
    LK.depth();
  }
  // the phosphate tags' places on Tau (fixed, seeded): within its close-up's sphere
  const PH_N = 26, PH_OFF = [];
  { const rr = K.rng(5); for (let k = 0; k < PH_N; k++) { const u = rr() * 2 - 1, a = rr() * TAU, q = Math.sqrt(1 - u * u), d = 0.05 + 0.06 * rr(); PH_OFF.push([q * Math.cos(a) * d, u * d * 1.4, q * Math.sin(a) * d]); } }

  // ---------------------------------------------------------- the names
  // every centre protein its gene symbol (CDK5 is the net's own label), only with core_names (explore); the ones with a
  // structure or a part in the story by their own params, with a short role
  const ROLE = { BDNF: ['BDNF', ' · growth factor', 'core_mBdnf'], NTRK2: ['NTRK2', ' · its receptor', 'core_mTrkb'], CDK5R2: ['p39', ' · CDK5R2', 'core_p39'],
    CAPN1: ['calpain', ' · CAPN1', 'core_mCapn'], SEMA4D: ['SEMA4D', ' · a semaphorin', 'core_mSema'], PLXNB1: ['PLXNB1', ' · its receptor', 'core_mSema'],
    NPAS4: ['NPAS4', '', 'core_mNpas4'] };
  const labels = [];
  U.forEach((i, j) => {
    if (i === CDK5) return;
    const sym = CD.sym[i], role = ROLE[sym];
    if (i === R1) {   // (p35's name sits on its ball while it has no structure there; on the structure: below)
      labels.push({ text: ['p35', ' · CDK5R1'], at: () => PA[j], cls: 'grn', alpha: S => LA[j] * (1 - HIDE[j]) * clamp(Math.max(S.core_mP35 || 0, S.core_names * 2 - 1), 0, 1) * (1 - cur.p35A) });
      return;
    }
    const cls = i === R2 ? 'grn' : i === CAPN1 ? 'amb' : CD.scene('alzheimer').centre.includes(i) && !CD.scene('ntrk2').centre.includes(i) ? 'amb' : 'cyn';
    labels.push({ text: role ? [role[0], role[1]] : [sym, ''], at: () => PA[j], cls, minor: !role,
      alpha: S => LA[j] * clamp(Math.max(role ? S[role[2]] || 0 : 0, S.core_names * 2 - 1), 0, 1) });
  });
  // p35 on its structure, p25 once the cut has taken its rest away; Tau beside the centre; the links the authors drew
  // (not interactions of the interactome)
  labels.push({ text: ['p35', ' · CDK5R1'], at: 'p35', cls: 'grn', alpha: S => cur.p35A * (SL.p25.mesh ? 1 : 0) * (1 - prog(S.core_cut, 0.5, 0.7)) });
  labels.push({ text: ['p25', ' · what is left of p35'], at: 'p35', cls: 'amb', alpha: S => cur.p35A * (SL.p25.mesh ? 1 : 0) * prog(S.core_cut, 0.6, 0.85) });
  labels.push({ text: ['Tau', ' · MAPT, a partner of CDK5'], at: 'tau', cls: 'amb', alpha: S => clamp(S.core_tau || 0, 0, 1) });
  labels.push({ text: ['Drawn by the authors', ' · calpain cuts p35'], at: 'cutMid', cls: '', minor: true,
    alpha: S => 0.9 * prog(S.core_cut, 0.6, 1) * clamp(1 - 2 * Math.abs(cur.s - S_CAL), 0, 1) * (S.core_names >= 0.99 ? 1 : 0) });
  labels.push({ text: ['Drawn by the authors', ''], at: 'npasMid', cls: '', minor: true,
    alpha: S => 0.9 * cur.midNW * clamp(1 - 2 * Math.abs(cur.s - S_NP), 0, 1) * (S.core_names >= 0.99 ? 1 : 0) });

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
      const off = Math.sqrt(Math.max(0, x * x + y * y + z * z - along * along)), sc = off / (Math.max(R[j], HIDE[j] * 0.06) * 1.5 + 0.004 * along);
      if (sc < bs) { bs = sc; best = U[j]; }
    }
    return best;
  }
  const ap = i => { const j = jOf(i); return j >= 0 ? PA[j] : [0, 0, 0]; };
  // the close-ups' views (the net's frame, as the core is drawn): p35 docking, NTRK2's pair, the semaphorin and its
  // receptor, NPAS4, the cut, Tau; each from the data's places (the default view's angle, nearer)
  const lay = (k, i) => { const L = CD.layout(k); return [L[3 * i], L[3 * i + 1], L[3 * i + 2]]; };
  const midOf = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const near = (az, el, d, p) => [az, el, d, p[0], p[1], p[2]];
  const cams = {
    default: [20, 10, 1.9, 0, 0, 0], low: [32, -16, 1.9, 0, -0.04, 0],
    dock: near(20, 12, 1.45, midOf([0, 0, 0], lay('subunits', R1))),
    trk: near(24, 8, 1.15, midOf(lay('ntrk2', fnd('BDNF')), lay('ntrk2', fnd('NTRK2')))),
    sema: near(18, 10, 1.5, midOf(lay('sema', fnd('SEMA4D')), lay('sema', fnd('PLXNB1')))),
    npas: near(20, 10, 1.7, midOf(lay('npas4', NPAS4), [0, 0, 0])),
    cut: near(20, 12, 1.3, midOf([0, 0, 0], lay('calpain', CAPN1))),
    tau: near(20, 8, 1.7, [TAUP[0] * 0.75, TAUP[1] * 0.75, TAUP[2] * 0.75]),
  };
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
    // the structures (for the About pane's credits): [{ name, protein, title, credit }] of the models that have come
    structures: () => SLOTS.map(s => ({ name: s.m, sym: s.i >= 0 ? CD.sym[s.i] : 'MAPT', head: MOLS.m[s.m] && MOLS.m[s.m].head })),
  };
  return Object.assign(set, {
    params: { core_a: 1, core_scene: 1, core_names: 1, core_hyper: 0, core_cut: 0, core_flow: 0, core_dock: 0, core_mCdk5: 0, core_mP35: 0, core_p39: 0,
      core_mCapn: 0, core_mBdnf: 0, core_mTrkb: 0, core_mSema: 0, core_mNpas4: 0, core_tau: 0, core_mTau: 0, core_phos: 0 },
    update,
    anchors: { centre: [0, 0, 0], cdk5: () => ap(CDK5), capn1: () => ap(CAPN1), bdnf: () => ap(fnd('BDNF')), ntrk2: () => ap(fnd('NTRK2')),
      sema: () => ap(fnd('SEMA4D')), npas4: () => ap(NPAS4), p35: () => cur.p35, tail: () => cur.tail, tau: () => cur.tau, tauAt: TAUP,
      app: () => ap(fnd('APP')), top: [0, CD.CENTRE_R + 0.12, 0], cutTag: () => cur.tag, cutMid: () => cur.mid, npasMid: () => cur.midN },
    labels,
    cam: cams,
    controls: [], explore() { return {}; },
    api: () => API,
  });
};
