// The stem set of the mutation story, in the tree set's frame. Chapter 6, at the origin while the tree is hidden: an RNA
// strand (the coupled example's fully paired stem: its top half, four loop letters GAAA, its bottom half read back)
// folds back on itself into a stem, a ladder of six pairs twisted as RNA stems are (about 11 pairs a turn) with the loop
// on top and white rungs; one letter changes alone and its rung snaps (a red cross, the stem bulging there); the
// coupling comes (a coupling gear on the pair: its two letters change together) and the pair changes both letters at
// once and holds; beside it the count: a pair's 16 combinations as a 4 x 4 square of tile pairs (the matching ones
// lit), three letters' 64 as a cube, ten letters' 1,048,576 as a vast cloud of points, against 20 qubits, two per letter.
// Chapter 7, with the species tree: the three species' stems at its tips (Figure 5, broken pairs as red crosses),
// three fields of 2,000 rebuilt ancestors in front of the root (one per method, each a tiny stem: lit in the letters'
// colours when all six pairs hold, dim with its broken rungs red otherwise; the poster's shares in the story, MMATH's
// rebuild live in explore), and the true ancestor big at the root beside the three rebuilt examples (letters that
// differ from it framed white). Everything follows the params and t; the small stems turn round the vertical to face
// the viewer (the camera seen at the last frame), the tiny ones in their shader.
SETS.stem = function (K) {
  const { THREE, clamp, lerp, prog, smooth } = K;
  const set = K.newSet('stem');
  const M = MMATH, D = MUT_DATA.test, LK = MLOOK(K, set), PI = Math.PI, UP = [0, 1, 0];
  const idx = M.toIdx, LC = LK.LCOL;
  const METHODS = M.METHODS, ORDER = ['indep', 'exact', 'coupled'];   // the fields left to right: the poster's 10, 20, 43 %
  const NAME = { indep: 'Letter by letter', exact: 'Exact pair model', coupled: 'Coupled circuit' };
  const NAME_LIVE = { indep: 'Letter by letter', exact: 'Exact pair model', coupled: 'Coupling, our stand-in' };

  // ---------------------------------------------------------------- the close-up: a strand folding into a stem
  const EX = D.rebuilt.coupled, LOOP = 'GAAA';                         // GTTACT / TGATGA: all six pairs hold
  const STRAND = idx(EX.top + LOOP + [...EX.bottom].reverse().join(''));
  const NL = STRAND.length, BI = 4;                                    // pair 5 (index 4) breaks and is coupled
  const SPC = 0.15, TSC = 0.108, HEND = 0.5, RR = 0.235, TW = 2 * PI / 11, LL = 4 * SPC, RHO = LL / PI;
  const pairOf = k => (k < 6 ? k : k >= NL - 6 ? NL - 1 - k : -1), sideOf = k => (k < 6 ? -1 : k >= NL - 6 ? 1 : 0);
  const CP = Array.from({ length: NL }, () => [0, 0, 0]), CDIR = Array.from({ length: 6 }, () => [0, 0, 0]);
  // where each letter is at fold f: a straight row (0), a hairpin folding round its loop (to 0.55), twisting into the
  // stem (to 1: 11 pairs a turn, pair BI square to the story's view and the loop in line with the top pair, so the
  // pair that breaks and the loop read; the lowest pairs turn away, as in any helix); bulge pushes pair BI's letters
  // apart
  function layout(f, bulge) {
    const fA = smooth(clamp(f / 0.55, 0, 1)), fB = smooth(clamp((f - 0.5) / 0.5, 0, 1)), al = PI * fA, H = HEND * fA;
    const g = lerp(1, RR / RHO, fB);
    for (let k = 0; k < NL; k++) {
      const s = (k - (NL - 1) / 2) * SPC;
      let x, y;
      if (al < 1e-4) { x = s; y = H; } else {
        const rho = LL / al;
        if (Math.abs(s) <= LL / 2) { const th = s / rho; x = rho * Math.sin(th); y = H - rho * (1 - Math.cos(th)); }
        else {
          const sg = s > 0 ? 1 : -1, te = sg * al / 2, d = Math.abs(s) - LL / 2;
          x = rho * Math.sin(te) + sg * d * Math.cos(al / 2); y = H - rho * (1 - Math.cos(te)) - d * Math.sin(al / 2);
        }
      }
      const i = pairOf(k), ph = fB * ((i >= 0 ? i : 5) - BI) * TW, c = Math.cos(ph), sn = Math.sin(ph);
      let xx = x * g;
      if (i === BI) xx += sideOf(k) * bulge;
      CP[k][0] = xx * c; CP[k][1] = y; CP[k][2] = -xx * sn;
      if (i >= 0) { CDIR[i][0] = c; CDIR[i][1] = 0; CDIR[i][2] = -sn; }
    }
  }

  // ---------------------------------------------------------------- the count: 16, 64, about a million, 20 qubits
  const CS = [1.18, 0.1, 0], PQ = 0.2, CC = [1.2, 0.2, -2.7], QY = -0.88, QZ = 0.3;
  const CUBE = [], CUBEC = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
    CUBE.push([i, j, k]);
    CUBEC.push([0, 1, 2].map(d => (LC[i][d] + LC[j][d] + LC[k][d]) / 3));
  }
  const DIMC = LC.map(c => LK.mix(c, LK.GREY, 0.6));
  const NCLOUD = 60000;
  let cloud, cloudU;
  {
    const g = K.pointsGeo(NCLOUD), pa = g.attributes.position.array, ca = g.attributes.aCol.array, sa = g.attributes.aSize.array, aa = g.attributes.aA.array;
    const dl = new Float32Array(NCLOUD), r = K.rng(61);
    for (let n = 0; n < NCLOUD; n++) {
      // a vast soft cloud, densest at its middle, flattened a little
      const u = K.unit(r), rad = 0.2 + 2.4 * Math.pow(r(), 0.6);
      pa[3 * n] = CC[0] + u[0] * rad * 1.15; pa[3 * n + 1] = CC[1] + u[1] * rad * 0.62; pa[3 * n + 2] = CC[2] + u[2] * rad;
      const c = LC[Math.floor(r() * 4)];
      ca[3 * n] = c[0]; ca[3 * n + 1] = c[1]; ca[3 * n + 2] = c[2];
      sa[n] = 0.012 + 0.016 * r(); aa[n] = 0.1 + 0.22 * r(); dl[n] = r();
    }
    g.setAttribute('aDelay', new THREE.BufferAttribute(dl, 1));
    cloudU = { uExp: { value: 0 }, uCloudA: { value: 0 }, uC0: { value: new THREE.Vector3(CS[0], CS[1], CS[2] - 1.5 * PQ) } };
    const m = K.points(set, { uniforms: cloudU, head: 'attribute float aDelay; uniform float uExp, uCloudA; uniform vec3 uC0;',
      vertex: `float e = smoothstep(aDelay * 0.55, aDelay * 0.55 + 0.45, uExp);
  mv = modelViewMatrix * vec4(mix(uC0, position, e), 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize * (0.6 + 0.4 * e), mv); vA *= uCloudA * (0.35 + 0.65 * e);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);` });
    cloud = new THREE.Points(g, m);
    cloud.frustumCulled = false; cloud.visible = false;
    set.group.add(cloud);
  }
  // the qubits: two per letter for ten letters, each pair holding a letter's mix (the rule's, from that letter, at
  // point 2 of its path: MMATH.path and bloch), so they lean as qubits that hold a mix do
  const QB = [];
  for (let l = 0; l < 10; l++) {
    const p = M.path(M.DEFAULT, l % 4, M.POINTS[(l >> 2) % 3]), b = M.bloch(p);
    for (let q = 0; q < 2; q++) QB.push({ c: [1.0 + (l - 4.5) * 0.275 + (q - 0.5) * 0.125, QY, QZ], b, at: 3 * q });
  }

  // ---------------------------------------------------------------- chapter 7: where things stand
  const SPT = M.speciesTree();
  const SPECIES = ['s1', 's2', 's3'].map((k, j) => {
    const n = SPT.nodes[SPT.tipIds[j]], st = D.species[k];
    return { key: k, base: [n.pos[0], n.pos[1] + 0.05, n.pos[2]], top: idx(st.top), bottom: idx(st.bottom), broken: M.brokenPairs(st.top, st.bottom).length };
  });
  const TRUTH = { top: idx(D.truth.top), bottom: idx(D.truth.bottom), broken: M.brokenPairs(D.truth.top, D.truth.bottom).length };
  const TBASE = [0, -0.99, 0.2], FX = [-1.22, 0, 1.22], FZ = 1.2, FW = 1.02, FD = 0.7, COLS = 50, ROWS = 40, N = 2000, EZ = 1.8;
  const EXB = FX.map(x => [x, -0.99, EZ]);   // where the rebuilt examples stand: before their fields

  // ---------------------------------------------------------------- the fields: 3 x 2,000 tiny stems, one instanced quad each
  // each a tiny upright ladder drawn in its shader (rails, six rungs in its two letters' colours, a loop), turned
  // round the vertical to face the viewer (the camera in the set's frame, set per eye just before it is drawn); it
  // sprouts at its own moment (aInfo.y) as the fields grow, and moves to its sorted slot (all six holding first, from
  // the front) as uSort goes to 1
  const NF = 3 * N;
  const fieldU = { uCam: { value: new THREE.Vector3(0, 0, 40) }, uGrow: { value: 0 }, uSort: { value: 0 }, uK: { value: new THREE.Vector3(1, 1, 1) },
    uW: { value: 0.03 }, uH: { value: 0.088 }, uL0: { value: new THREE.Color(...LC[0]) }, uL1: { value: new THREE.Color(...LC[1]) },
    uL2: { value: new THREE.Color(...LC[2]) }, uL3: { value: new THREE.Color(...LC[3]) }, uRed: { value: new THREE.Color(...LK.RED) }, uRail: { value: new THREE.Color(0.78, 0.86, 1.0) } };
  const fieldGeo = new THREE.InstancedBufferGeometry();
  const FA = {};
  {
    const q = new THREE.PlaneGeometry(1, 1); q.translate(0, 0.5, 0);
    fieldGeo.setAttribute('position', q.attributes.position); fieldGeo.setIndex(q.index);
    for (const [k, n] of [['aPos', 3], ['aSort', 3], ['aPA', 3], ['aPB', 3], ['aInfo', 4]]) {
      FA[k] = new THREE.InstancedBufferAttribute(new Float32Array(NF * n), n);
      fieldGeo.setAttribute(k, FA[k]);
    }
    fieldGeo.instanceCount = NF;
    // the slots: a 50 x 40 grid per field (slot 0 at the front left), a little jitter; who sprouts when
    const r = K.rng(29), SLOT = new Float32Array(N * 3);
    for (let s = 0; s < N; s++) {
      const c = s % COLS, w = Math.floor(s / COLS);
      SLOT[3 * s] = (c - (COLS - 1) / 2 + (r() - 0.5) * 0.5) * FW / COLS;
      SLOT[3 * s + 1] = -1;
      SLOT[3 * s + 2] = FZ + FD / 2 - (w + 0.5 + (r() - 0.5) * 0.5) * FD / ROWS;
    }
    FA.SLOT = SLOT;
    const info = FA.aInfo.array;
    for (let f = 0; f < 3; f++) for (let a = 0; a < N; a++) { const i = f * N + a; info[4 * i + 1] = r(); info[4 * i + 2] = f; info[4 * i + 3] = r(); }
  }
  const fieldMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, fieldU), transparent: true, side: THREE.DoubleSide,
    vertexShader: `
attribute vec3 aPos, aSort, aPA, aPB; attribute vec4 aInfo;
uniform vec3 uCam, uK; uniform float uA, uGrow, uSort, uW, uH;
varying vec2 vUv; varying vec3 vPA, vPB; varying float vGood, vK, vPh;
void main() {
  vec3 c = mix(aPos, aSort, smoothstep(0.0, 1.0, clamp(uSort * 1.3 - aInfo.w * 0.3, 0.0, 1.0)));
  float s = clamp((uGrow * 1.18 - aInfo.y) / 0.18, 0.0, 1.0);
  vec3 d = uCam - c; d.y = 0.0;
  d = dot(d, d) > 1e-8 ? normalize(d) : vec3(0.0, 0.0, 1.0);
  vec3 r = vec3(d.z, 0.0, -d.x);
  vec3 p = c + r * position.x * uW + vec3(0.0, position.y * uH * s, 0.0);
  vUv = vec2(position.x * 2.0, position.y); vPA = aPA; vPB = aPB; vGood = aInfo.x;
  vK = aInfo.z < 0.5 ? uK.x : aInfo.z < 1.5 ? uK.y : uK.z;
  vPh = aInfo.w * 6.2831853 + atan(d.x, d.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  if (s <= 0.0 || uA * vK < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA; uniform vec3 uL0, uL1, uL2, uL3, uRed, uRail;
varying vec2 vUv; varying vec3 vPA, vPB; varying float vGood, vK, vPh;
vec3 lc(float k) { return k < 0.5 ? uL0 : k < 1.5 ? uL1 : k < 2.5 ? uL2 : uL3; }
float pairAt(float j) { return j < 0.5 ? vPA.x : j < 1.5 ? vPA.y : j < 2.5 ? vPA.z : j < 3.5 ? vPB.x : j < 4.5 ? vPB.y : vPB.z; }
// A-T, T-A, C-G, G-C, G-T, T-G (pair states 4x + y)
float holds(float s) { return (abs(s - 3.0) < 0.5 || abs(s - 12.0) < 0.5 || abs(s - 6.0) < 0.5 || abs(s - 9.0) < 0.5 || abs(s - 11.0) < 0.5 || abs(s - 14.0) < 0.5) ? 1.0 : 0.0; }
void main() {
  float y = vUv.y * 7.2, x = vUv.x;                 // across -1..1; six rungs between y 0.35 and 6.35, the loop above
  float hw = 0.32 + 0.68 * abs(cos(vPh + y * 0.57)); // the ladder's half width as seen: it twists, 11 pairs a turn
  vec3 col = vec3(0.0); float on = 0.0;
  if (y > 0.2 && y < 6.35 && abs(abs(x) - hw) < 0.15) { col = uRail; on = 1.0; }
  if (y >= 6.35) { float r = length(vec2(x / hw, (y - 6.35) / 0.8)); if (abs(r - 1.0) < 0.26) { col = uRail; on = 1.0; } }
  float j = floor(y - 0.35), fy = y - 0.35 - j;
  if (j >= 0.0 && j < 6.0 && abs(fy - 0.5) < 0.3 && abs(x) < hw) {
    float s = pairAt(j);
    if (holds(s) > 0.5) { col = x < 0.0 ? lc(floor(s / 4.0 + 0.01)) : lc(mod(s + 0.01, 4.0)); on = 2.0; } else { col = uRed; on = 3.0; }
  }
  if (on < 0.5) discard;
  float b = on > 2.5 ? 0.8 : vGood > 0.5 ? (on > 1.5 ? 1.45 : 0.8) : 0.24;   // all six hold: bright; else dim, its broken rungs red
  gl_FragColor = vec4(col * b * vK, uA);
}`,
  });
  set.mats.push(fieldMat);
  const fields = new THREE.Mesh(fieldGeo, fieldMat);
  fields.frustumCulled = false; fields.visible = false;
  fields.onBeforeRender = (r, s, cam) => {
    // the camera in the set's frame, per eye
    fieldU.uCam.value.setFromMatrixPosition(cam.matrixWorld);
    fields.worldToLocal(fieldU.uCam.value);
  };
  set.group.add(fields);

  // the rebuilt ancestors shown: the poster's shares (src 0: MMATH.crowd, exactly round(share x 2,000) with all six
  // pairs, the rest from that method's posterior with at least one broken), or the example computed live (src 1:
  // MMATH.rebuild with this w and seed); filled into the fields when the source, w or seed changes
  const dataCache = new Map();
  function dataOf(src, w, seed) {
    const key = `${src}|${w}|${seed}`;
    let R = dataCache.get(key);
    if (R) return R;
    R = {};
    for (const m of METHODS) {
      if (src === 1) { const r = M.rebuild(m, { w, seed, n: N }); R[m] = { samples: r.samples, good: r.good, intact: r.intact, share: r.share, expected: r.expected, best: r.best }; }
      else { const r = M.crowd(m, D.intact[m], N, seed); R[m] = { samples: r.samples, good: r.good, intact: r.intact, share: r.share, expected: null, best: D.rebuilt[m] }; }
      R[m].bestIdx = { top: idx(R[m].best.top), bottom: idx(R[m].best.bottom) };
      R[m].broken = M.brokenPairs(R[m].best.top, R[m].best.bottom).length;
    }
    if (dataCache.size > 12) dataCache.delete(dataCache.keys().next().value);
    dataCache.set(key, R);
    return R;
  }
  let fieldKey = null;   // the data the fields hold now
  function fillFields(R) {
    const ps = FA.aPos.array, so = FA.aSort.array, pa = FA.aPA.array, pb = FA.aPB.array, info = FA.aInfo.array, SL = FA.SLOT;
    ORDER.forEach((m, f) => {
      const d = R[m], r = K.rng(101 + f), perm = [...Array(N).keys()];
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const v = perm[i]; perm[i] = perm[j]; perm[j] = v; }
      // sorted: the ones with all six pairs holding take the front slots, in their random order
      const bySlot = perm.map((s, a) => [s, a]).sort((x, y) => x[0] - y[0]);
      let k = 0;
      const rank = new Int32Array(N);
      for (const [, a] of bySlot) if (d.good[a]) rank[a] = k++;
      for (const [, a] of bySlot) if (!d.good[a]) rank[a] = k++;
      for (let a = 0; a < N; a++) {
        const i = f * N + a, s0 = perm[a], s1 = rank[a];
        ps[3 * i] = FX[f] + SL[3 * s0]; ps[3 * i + 1] = SL[3 * s0 + 1]; ps[3 * i + 2] = SL[3 * s0 + 2];
        so[3 * i] = FX[f] + SL[3 * s1]; so[3 * i + 1] = SL[3 * s1 + 1]; so[3 * i + 2] = SL[3 * s1 + 2];
        for (let p = 0; p < 3; p++) { pa[3 * i + p] = d.samples[a * 6 + p]; pb[3 * i + p] = d.samples[a * 6 + 3 + p]; }
        info[4 * i] = d.good[a];
      }
    });
    for (const k of ['aPos', 'aSort', 'aPA', 'aPB', 'aInfo']) FA[k].needsUpdate = true;
  }

  // ---------------------------------------------------------------- the pieces drawn every frame
  const tiles = LK.tiles(170), tubes = LK.tubes(330), balls = LK.balls(40), halos = LK.halos(90), rings = LK.rings(30), boxes = LK.boxes(72),
    glass = LK.glass(24), cones = LK.cones(24), gears = LK.gears(2);
  set.group.add(tiles.mesh, tubes.mesh, balls.mesh, halos.mesh, rings.mesh, boxes.mesh, glass.mesh, cones.mesh, gears.mesh);
  const QPOOLS = { glass, rings, tubes, cones, balls, halos };
  const camW = new THREE.Vector3(0, 0, 40), camL = new THREE.Vector3();
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    const probe = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    probe.frustumCulled = false;
    probe.onBeforeRender = (r, s, cam) => { camW.setFromMatrixPosition(cam.matrixWorld); };   // (no vertices: never drawn)
    set.group.add(probe);
  }
  const yawTo = p => Math.atan2(camL.x - p[0], camL.z - p[2]);
  const _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0], _d = [0, 0, 0], _e = [0, 0, 0], _q = [0, 0, 0, 1], _col = [0, 0, 0];
  const L6 = Array.from({ length: 6 }, () => [0, 0, 0]), R6 = Array.from({ length: 6 }, () => [0, 0, 0]);
  const RAIL = [0.5, 0.64, 0.9], WHITE = LK.WHITE, OPT_PAIR = { pair: true, glow: 0.35 };
  const add3 = (o, a, b, s) => { o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; };
  // a red cross where a rung would be (a broken pair): two strokes across the rung's middle m, in the plane of the
  // rung's direction e and up, half size h
  function cross(m, e, h, a) {
    for (let sg = -1; sg <= 1; sg += 2) {
      _d[0] = m[0] + e[0] * h * sg; _d[1] = m[1] + h; _d[2] = m[2] + e[2] * h * sg;
      _e[0] = m[0] - e[0] * h * sg; _e[1] = m[1] - h; _e[2] = m[2] - e[2] * h * sg;
      tubes.add(_d, _e, h * 0.16, LK.RED, a, 0);
    }
  }
  // a small stem standing at base: six pairs s apart (top[i] left, bottom[i] right as you look), a backbone and an
  // empty loop on top; it faces the viewer, twisted gently; ref (top and bottom of another stem): letters that differ
  // from it framed white (by refA)
  function smallStem(base, s, top, bottom, a, ref, refA) {
    if (a <= 0.003) return;
    const yaw = yawTo(base), ts = s * 0.8, hw = s * 1.35;
    for (let i = 0; i < 6; i++) {
      const ph = yaw + (i - 2.5) * 0.16, ex = Math.cos(ph), ez = -Math.sin(ph), y = base[1] + s * (i + 0.6);
      L6[i][0] = base[0] - ex * hw; L6[i][1] = y; L6[i][2] = base[2] - ez * hw;
      R6[i][0] = base[0] + ex * hw; R6[i][1] = y; R6[i][2] = base[2] + ez * hw;
      LK.quat(_q, UP, ph);
      const ft = ref && top[i] !== ref.top[i] ? refA : 0, fb = ref && bottom[i] !== ref.bottom[i] ? refA : 0;
      tiles.add(L6[i], _q, ts, top[i], a, ft, 0);
      tiles.add(R6[i], _q, ts, bottom[i], a, fb, 0);
      _b[0] = ex; _b[1] = 0; _b[2] = ez;
      if (M.ok(top[i], bottom[i])) tubes.add(add3(_c, L6[i], _b, ts * 0.55), add3(_d, R6[i], _b, -ts * 0.55), s * 0.075, WHITE, a, 0);
      else { _a[0] = base[0]; _a[1] = y; _a[2] = base[2]; cross(_a, _b, s * 0.32, a); }
      if (i > 0) { tubes.add(L6[i - 1], L6[i], s * 0.06, RAIL, 0.8 * a, 0); tubes.add(R6[i - 1], R6[i], s * 0.06, RAIL, 0.8 * a, 0); }
    }
    // the loop: an arc over the top pair
    const c0 = base[0], cy = L6[5][1] + s * 0.25, c2 = base[2], ph = yaw + 2.5 * 0.16, ex = Math.cos(ph), ez = -Math.sin(ph);
    _c[0] = L6[5][0]; _c[1] = L6[5][1]; _c[2] = L6[5][2];
    for (let k = 1; k <= 7; k++) {
      const th = PI * (1 - k / 7), cs = Math.cos(th) * hw;
      _d[0] = c0 + ex * cs; _d[1] = cy + Math.sin(th) * hw * 0.9; _d[2] = c2 + ez * cs;
      if (k === 7) { _d[0] = R6[5][0]; _d[1] = R6[5][1]; _d[2] = R6[5][2]; }
      tubes.add(_c, _d, s * 0.06, RAIL, 0.8 * a, 0);
      _c[0] = _d[0]; _c[1] = _d[1]; _c[2] = _d[2];
    }
  }

  // what the frame shows now (anchors, labels, the api)
  const now = { R: null, src: 0, w: 8, seed: 1, method: -1, top: STRAND.slice(), gear: [0, 0, 0], brk: [0, 0, 0] };
  const ORIG = STRAND.slice(), cur = new Uint8Array(NL);

  function update(S, t) {
    LK.depth();
    set.group.updateMatrixWorld();
    camL.copy(camW); set.group.worldToLocal(camL);
    tiles.begin(); tubes.begin(); balls.begin(); halos.begin(); rings.begin(); boxes.begin(); glass.begin(); cones.begin(); gears.begin();

    // ---- the close-up
    const strand = clamp(S.stem_strand, 0, 1), fold = clamp(S.stem_fold, 0, 1), brk = clamp(S.stem_break, 0, 1);
    const coup = clamp(S.stem_couple, 0, 1), both = clamp(S.stem_both, 0, 1);
    if (strand > 0.003) {
      layout(fold, 0.075 * prog(brk, 0.5, 0.9) * (both >= 0.5 ? 0 : 1));
      cur.set(ORIG);
      const kt = BI, kb = NL - 1 - BI;   // pair BI's two letters in the strand
      if (both >= 0.5) { cur[kt] = 3; cur[kb] = 0; } else if (brk >= 0.5) cur[kt] = 0;   // C-G to T-A together; C to A alone
      const flipA = Math.max(1 - Math.abs(brk - 0.5) / 0.12, 1 - Math.abs(both - 0.5) / 0.12, 0);
      const rungA = strand * prog(fold, 0.75, 1);
      for (let k = 0; k < NL; k++) {
        const a = strand * prog(strand, k / NL * 0.8, k / NL * 0.8 + 0.2);
        const hot = (k === kt && (Math.abs(brk - 0.5) < 0.12 || Math.abs(both - 0.5) < 0.12)) || (k === kb && Math.abs(both - 0.5) < 0.12) ? flipA : 0;
        tiles.add(CP[k], null, TSC, cur[k], a, cur[k] !== ORIG[k] ? 1 : 0, hot);
        if (hot > 0.01) halos.add(CP[k], 0.5, LC[cur[k]], 0.8 * hot * a);
        if (k > 0) tubes.add(CP[k - 1], CP[k], 0.016, RAIL, 0.85 * Math.min(a, strand), 0);
      }
      // the rungs: white where the pair holds; pair BI snaps when it breaks (two stubs pull back, a red cross)
      for (let i = 0; i < 6 && rungA > 0.003; i++) {
        const A = CP[i], B = CP[NL - 1 - i], e = CDIR[i], holds = M.ok(cur[i], cur[NL - 1 - i]);
        add3(_c, A, e, TSC * 0.55); add3(_d, B, e, -TSC * 0.55);
        if (i === BI) { _a[0] = (A[0] + B[0]) / 2; _a[1] = (A[1] + B[1]) / 2; _a[2] = (A[2] + B[2]) / 2; now.brk[0] = B[0] + 0.08; now.brk[1] = B[1]; now.brk[2] = B[2]; now.gear[0] = _a[0]; now.gear[1] = _a[1]; now.gear[2] = _a[2]; }
        if (holds) {
          const lit = i === BI ? prog(both, 0.5, 0.8) : 0;
          tubes.add(_c, _d, 0.014, LK.mix(WHITE, LK.CYAN, lit, _col), rungA, 0);
          if (lit > 0.01) halos.add(_a, 0.3, LK.CYAN, 0.5 * lit * rungA);
        } else {
          const snap = prog(brk, 0.5, 0.75), stub = 0.5 * (1 - snap);
          _e[0] = lerp(_c[0], _d[0], stub); _e[1] = lerp(_c[1], _d[1], stub); _e[2] = lerp(_c[2], _d[2], stub);
          if (stub > 0.01) tubes.add(_c, _e, 0.014, WHITE, rungA, 0);
          _e[0] = lerp(_d[0], _c[0], stub); _e[1] = lerp(_d[1], _c[1], stub); _e[2] = lerp(_d[2], _c[2], stub);
          if (stub > 0.01) tubes.add(_d, _e, 0.014, WHITE, rungA, 0);
          cross(_a, e, 0.05, rungA * prog(brk, 0.55, 0.85));
        }
      }
      // the coupling: a coupling gear over pair BI's rung, its double band along the rung (the poster's sign for a
      // pair's two letters), winding in as it comes and turning half round as both letters change
      if (coup > 0.003) {
        const e = CDIR[BI];
        _b[0] = -e[2]; _b[1] = 0; _b[2] = e[0];   // across the rung, level: the gear's axis
        add3(_a, now.gear, _b, 0.045);
        gears.add(_a, _b, 0.11, PI * smooth(both) - 1.4 * (1 - coup), LK.BLUE, strand * coup * rungA, OPT_PAIR);
      }
    }

    // ---- the count
    const cnt = clamp(S.stem_count, 0, 3), qa = clamp(S.stem_qubits, 0, 1);
    const sqA = prog(cnt, 0, 0.7), ext = smooth(clamp(cnt - 1, 0, 1)), cl = clamp(cnt - 2, 0, 1);
    if (sqA > 0.003) {
      LK.quat(_q, UP, 0);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const ok = M.OKS[4 * i + j] === 1, a = sqA * prog(sqA, (4 * i + j) / 16 * 0.6, (4 * i + j) / 16 * 0.6 + 0.4) * (1 - ext) * (1 - cl);
        if (a <= 0.003) continue;
        _a[0] = CS[0] + (j - 1.5) * PQ - 0.039; _a[1] = CS[1] + (1.5 - i) * PQ; _a[2] = CS[2];
        tiles.add(_a, _q, 0.072, i, a, 0, ok ? 0.45 : 0, ok ? null : DIMC[i]);
        _a[0] += 0.078;
        tiles.add(_a, _q, 0.072, j, a, 0, ok ? 0.45 : 0, ok ? null : DIMC[j]);
        if (ok) { _a[0] -= 0.039; halos.add(_a, 0.2, WHITE, 0.25 * a); }
      }
      // the cube: the square grows back into four layers (the third letter); then it bursts into the cloud
      const ca = sqA * prog(ext, 0, 0.3) * (1 - prog(cl, 0, 0.6));
      if (ca > 0.003) for (let n = 0; n < 64; n++) {
        const [i, j, k] = CUBE[n];
        _a[0] = CS[0] + (j - 1.5) * PQ; _a[1] = CS[1] + (1.5 - i) * PQ; _a[2] = CS[2] - k * PQ * ext;
        boxes.add(_a, CELL, CUBEC[n], ca * (k === 0 ? 1 : prog(ext, 0.2 * k, 0.2 * k + 0.4)));
      }
    }
    cloudU.uExp.value = smooth(cl); cloudU.uCloudA.value = prog(cl, 0, 0.25); cloud.visible = cl > 0.003;
    if (qa > 0.003) for (let n = 0; n < QB.length; n++) {
      const Q = QB[n], a = qa * prog(qa, n / QB.length * 0.6, n / QB.length * 0.6 + 0.4);
      LK.qubit(QPOOLS, Q.c, 0.054, Q.b, a, Q.at ? QOPT1 : QOPT0);
    }

    // ---- chapter 7: the species' stems, the fields, the true ancestor and the rebuilt examples
    const spA = clamp(S.stem_species, 0, 1), fl = clamp(S.stem_fields, 0, 1), tr = clamp(S.stem_truth, 0, 1), exA = clamp(S.stem_examples, 0, 1);
    const src = Math.round(S.stem_src) === 1 ? 1 : 0, w = clamp(Math.round(S.stem_w), 1, 30), seed = Math.max(1, Math.round(S.stem_seed));
    const meth = Math.round(S.stem_method);
    now.src = src; now.w = w; now.seed = seed; now.method = meth >= 0 && meth < 3 ? meth : -1;
    const same = now.R && now.Rsrc === src && now.Rw === w && now.Rseed === seed;
    const R = same ? now.R : (fl > 0.003 || exA > 0.003) ? dataOf(src, w, seed) : now.R;
    if (R && !same && (fl > 0.003 || exA > 0.003)) { now.R = R; now.Rsrc = src; now.Rw = w; now.Rseed = seed; }
    for (let j = 0; j < 3; j++) {
      const P = SPECIES[j];
      smallStem(P.base, 0.07, P.top, P.bottom, spA * prog(spA, j * 0.2, j * 0.2 + 0.6), TRUTH, tr);
    }
    if (fl > 0.003) {
      if (fieldKey !== R) { fillFields(R); fieldKey = R; }
      fieldU.uGrow.value = fl; fieldU.uSort.value = clamp(S.stem_sort, 0, 1);
      fieldU.uK.value.set(fieldK(ORDER[0], exA), fieldK(ORDER[1], exA), fieldK(ORDER[2], exA));
      // a dark bed under each field
      for (let f = 0; f < 3; f++) { _a[0] = FX[f]; _a[1] = -1.006; _a[2] = FZ; boxes.add(_a, BED, BEDC, 0.75 * prog(fl, 0, 0.15)); }
    }
    fields.visible = fl > 0.003;
    if (tr > 0.003) {
      smallStem(TBASE, 0.12, TRUTH.top, TRUTH.bottom, tr, null, 0);
      halos.add(TBASE, 0.6, LK.AMBER, 0.25 * tr);
    }
    if (exA > 0.003 && R) for (let f = 0; f < 3; f++) {
      const m = ORDER[f];
      smallStem(EXB[f], 0.085, R[m].bestIdx.top, R[m].bestIdx.bottom, exA * prog(exA, f * 0.2, f * 0.2 + 0.6), TRUTH, 1);
    }
    tiles.end(); tubes.end(); balls.end(); halos.end(); rings.end(); boxes.end(); glass.end(); cones.end(); gears.end();
  }
  const QOPT0 = { col: LK.INK, glow: 0.3, marks: false }, QOPT1 = { at: 3, col: LK.INK, glow: 0.3, marks: false };
  const BED = [FW + 0.08, 0.008, FD + 0.08], BEDC = [0.05, 0.08, 0.14], CELL = [PQ * 0.52, PQ * 0.52, PQ * 0.52];
  // a field's brightness: dimmer when another method is picked, and while the examples stand in front
  const fieldK = (m, exA) => (now.method < 0 || METHODS[now.method] === m ? 1 : 0.32) * (1 - 0.55 * exA);

  // ---------------------------------------------------------------- anchors, labels, views
  const pct = v => `${Math.round(v * 100)} %`;
  const nb = n => `${n} broken pair${n === 1 ? '' : 's'}`;
  const anchors = {
    stem: [0, 0, 0], loop: [0.12, 0.62, 0], top: [0.3, 0.45, 0], brk: () => now.brk, gear: () => [now.gear[0] + 0.1, now.gear[1] + 0.06, now.gear[2]],
    square: [CS[0] - 0.42, CS[1] + 0.48, 0], cube: [CS[0] - 0.42, CS[1] + 0.52, -0.3], cloud: [CC[0] - 0.5, CC[1] + 1.25, CC[2] + 0.4], qubits: [QB[0].c[0] - 0.06, QY - 0.13, QZ],
    truth: [TBASE[0] + 0.2, TBASE[1] + 0.92, TBASE[2]], root: [0, -1, 0],
  };
  SPECIES.forEach((P, j) => { anchors['sp' + (j + 1)] = [P.base[0] + 0.1, P.base[1] + 0.62, P.base[2]]; });
  ORDER.forEach((m, f) => {
    // (behind the outer fields, before the middle one: three tags side by side would touch on a narrow screen)
    anchors['field_' + m] = f === 1 ? [FX[f] - FW / 2 + 0.02, -0.97, FZ + FD / 2 + 0.06] : [FX[f] - FW / 2 + 0.02, -0.93, FZ - FD / 2 - 0.02];
    anchors['ex_' + m] = [FX[f] - (f === 2 ? 0.55 : 0.4), -0.22, EZ];
  });
  const share = m => {
    const R = now.R;
    if (!R) return '';
    return now.src === 1 ? ` · ${pct(R[m].share)} here` : ` · ${pct(D.intact[m])} intact`;
  };
  const brk0 = MMATH.LETTERS[ORIG[BI]];
  const labels = [
    { text: ['A stem', ' · six pairs and a loop'], at: 'top', cls: '',
      alpha: S => clamp(S.stem_strand, 0, 1) * prog(S.stem_fold, 0.85, 1) * (1 - prog(S.stem_break, 0, 0.3)) * (1 - prog(S.stem_couple, 0, 0.3)) * (1 - prog(S.stem_count, 0, 0.4)) },
    { text: ['Pair broken', ` · ${brk0} became A alone`], at: 'brk', cls: 'amb',
      alpha: S => clamp(S.stem_strand, 0, 1) * prog(S.stem_break, 0.6, 0.9) * (S.stem_both >= 0.5 ? 0 : 1) * (1 - prog(S.stem_count, 0, 0.4)) },
    { text: ['Coupled', ' · both letters change together'], at: 'gear', cls: 'cyn',
      alpha: S => clamp(S.stem_strand, 0, 1) * prog(S.stem_couple, 0.5, 1) * (1 - prog(S.stem_both, 0.35, 0.6)) * (1 - prog(S.stem_break, 0.3, 0.6)) * (1 - prog(S.stem_count, 0, 0.4)) },
    { text: [`${brk0}–${MMATH.LETTERS[ORIG[NL - 1 - BI]]} became T–A`, ' · the pair holds'], at: 'gear', cls: 'cyn',
      alpha: S => clamp(S.stem_strand, 0, 1) * prog(S.stem_both, 0.6, 0.9) * (1 - prog(S.stem_count, 0, 0.4)) },
    { text: [`${M.combos(2)} combinations`, ' · a pair of letters'], at: 'square', cls: 'cyn', alpha: S => prog(S.stem_count, 0.3, 0.8) * (1 - prog(S.stem_count, 1.15, 1.5)) },
    { text: [`${M.combos(3)} combinations`, ' · three letters'], at: 'cube', cls: 'cyn', alpha: S => prog(S.stem_count, 1.5, 1.9) * (1 - prog(S.stem_count, 2.15, 2.5)) },
    { text: ['About a million', ` · ten letters: ${M.combos(10).toLocaleString('en-GB')}`], at: 'cloud', cls: 'amb', alpha: S => prog(S.stem_count, 2.5, 2.9) },
    { text: [`${M.qubits(10)} qubits`, ' · two per letter, for all ten'], at: 'qubits', cls: 'grn', alpha: S => prog(S.stem_qubits, 0.5, 1) },
  ];
  SPECIES.forEach((P, j) => labels.push({ text: [`Species ${j + 1}`, ` · ${nb(P.broken)}`], at: 'sp' + (j + 1), cls: '',
    alpha: S => prog(S.stem_species, 0.4 + 0.15 * j, 0.7 + 0.15 * j) * (1 - prog(S.stem_fields, 0.1, 0.3)) }));
  ORDER.forEach(m => labels.push({ text: () => [now.src === 1 ? NAME_LIVE[m] : NAME[m], share(m)], at: 'field_' + m, cls: m === 'coupled' ? 'cyn' : m === 'exact' ? 'grn' : '',
    alpha: S => prog(S.stem_fields, 0.3, 0.7) * (1 - prog(S.stem_examples, 0.1, 0.5)) * (Math.round(S.stem_method) < 0 || METHODS[Math.round(S.stem_method)] === m ? 1 : 0.5) }));
  labels.push({ text: ['True ancestor', ` · ${nb(TRUTH.broken)}`], at: 'truth', cls: 'amb', alpha: S => prog(S.stem_truth, 0.5, 1) });
  ORDER.forEach(m => labels.push({ text: () => [now.src === 1 ? NAME_LIVE[m] : NAME[m], now.R ? ` · ${now.R[m].broken || 'none'} broken` : ''], at: 'ex_' + m, cls: m === 'coupled' ? 'cyn' : m === 'exact' ? 'grn' : '',
    alpha: S => prog(S.stem_examples, 0.5, 1) }));
  const cam = {
    default: [16, 6, 3.4, 0, 0, 0],
    strand: [0, 4, 4.4, 0, 0.1, 0],
    fold: [14, 8, 3.2, 0, 0.02, 0],
    break: [24, 6, 2.3, 0.12, 0.12, 0],
    count: [-12, 10, 5.4, 0.85, -0.1, -0.15],
    cloud: [-10, 12, 8.4, 1.0, 0.0, -1.4],
    species: [18, 16, 3.9, 0, -0.38, 0.1],
    fields: [0, 30, 4.6, 0, -0.95, 1.15],
    compare: [0, 27, 4.7, 0.14, -0.5, 0.9],
    what: [8, 14, 4.3, 0.16, -0.36, 0],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['stem', 'Stem'], ['count', 'Count'], ['rebuild', 'Rebuild'], ['compare', 'Compare']] },
    { key: 'src', label: 'Numbers', options: [['test', 'The authors\' test'], ['live', 'This example']] },
    { key: 'w', label: 'Pair favour', options: [['1', '1'], ['4', '4'], ['8', '8'], ['16', '16'], ['30', '30']] },
    { key: 'method', label: 'Method', options: [['all', 'All three'], ['indep', 'Letter by letter'], ['exact', 'Exact'], ['coupled', 'Coupling']] },
  ];
  function explore(c) {
    const v = c.view || 'stem', rb = v === 'rebuild' || v === 'compare', close = v === 'stem' || v === 'count';
    return {
      stem_strand: close ? 1 : 0, stem_fold: 1, stem_break: 0, stem_couple: v === 'stem' ? 1 : 0, stem_both: v === 'stem' ? 1 : 0,
      stem_count: v === 'count' ? 3 : 0, stem_qubits: v === 'count' ? 1 : 0,
      stem_species: rb ? 1 : 0, stem_fields: rb ? 1 : 0, stem_sort: v === 'compare' ? 1 : 0, stem_truth: v === 'compare' ? 1 : 0, stem_examples: v === 'compare' ? 1 : 0,
      stem_src: c.src === 'live' ? 1 : 0, stem_w: clamp(parseInt(c.w, 10) || 8, 1, 30), stem_seed: 1,
      stem_method: c.method && c.method !== 'all' ? METHODS.indexOf(c.method) : -1,
    };
  }

  // ---------------------------------------------------------------- picking and what explore reads
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _ray = new THREE.Ray(), _inv = new THREE.Matrix4();
  // what a ray (a THREE.Raycaster in world coordinates) points at: a field ({ kind: 'field', method }) or a stem
  // ({ kind: 'stem', which: 'truth' | 'indep' | 'exact' | 'coupled' | 's1' | 's2' | 's3' }), or null
  function pick(rc) {
    set.group.updateMatrixWorld();
    const Mw = set.group.matrixWorld, s0 = Mw.getMaxScaleOnAxis(), ray = rc.ray;
    let best = null, bt = Infinity;
    const test = (p, r, hit) => {
      _v.set(p[0], p[1], p[2]).applyMatrix4(Mw);
      const d = _w.copy(_v).sub(ray.origin).dot(ray.direction), rr = r * s0;
      if (d > 0 && d < bt && ray.distanceSqToPoint(_v) < rr * rr) { bt = d; best = hit; }
    };
    const vis = set.group.visible;
    if (!vis) return null;
    if (fields.visible) {
      // the fields lie on the floor of the frame (y -1): where the ray meets it
      _ray.copy(ray).applyMatrix4(_inv.copy(Mw).invert());
      const t = (-0.97 - _ray.origin.y) / _ray.direction.y;
      if (t > 0) {
        _ray.at(t, _v);
        ORDER.forEach((m, f) => {
          if (Math.abs(_v.x - FX[f]) < FW / 2 + 0.03 && Math.abs(_v.z - FZ) < FD / 2 + 0.03) {
            _w.copy(_v).applyMatrix4(Mw);
            const d = _w.sub(ray.origin).dot(ray.direction);
            if (d < bt) { bt = d; best = { kind: 'field', method: m }; }
          }
        });
      }
    }
    if (now.R && fields.visible) ORDER.forEach((m, f) => test([FX[f], -0.68, EZ], 0.2, { kind: 'stem', which: m }));
    test([TBASE[0], TBASE[1] + 0.4, TBASE[2]], 0.28, { kind: 'stem', which: 'truth' });
    SPECIES.forEach(P => test([P.base[0], P.base[1] + 0.25, P.base[2]], 0.2, { kind: 'stem', which: P.key }));
    return best;
  }
  const API = {
    methods: ORDER, names: NAME, namesLive: NAME_LIVE, strand: M.toStr(STRAND), loop: LOOP, pair: BI,
    truth: D.truth, species: D.species, count: { pair: M.combos(2), three: M.combos(3), ten: M.combos(10), qubits: M.qubits(10) },
    // the rebuild for a source (0 the authors' test, 1 this example live), pair favour w and seed: per method
    // { share, intact, expected (live only), best: { top, bottom }, broken }
    results: (src = now.src, w = now.w, seed = now.seed) => {
      const R = dataOf(src ? 1 : 0, w, seed), o = {};
      for (const m of METHODS) o[m] = { share: R[m].share, intact: R[m].intact, n: N, expected: R[m].expected, best: R[m].best, broken: R[m].broken };
      return o;
    },
    pick,
  };
  return Object.assign(set, {
    params: { stem_a: 1, stem_strand: 1, stem_fold: 1, stem_break: 0, stem_couple: 0, stem_both: 0, stem_count: 0, stem_qubits: 0,
      stem_species: 0, stem_fields: 0, stem_sort: 0, stem_truth: 0, stem_examples: 0, stem_src: 0, stem_w: 8, stem_seed: 1, stem_method: -1 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};
