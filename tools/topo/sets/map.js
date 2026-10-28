// The map set of the topo story: the signal back on the tissue, over the slide set's window (the same frame: the
// window's 6,716 real cells TW across, centred on the origin while it lies alone). One cell (the poster's cell v,
// TOPO_DATA.slide.e, or one picked in explore) gets a glass dome of 50 µm; the cells under it light, their part of the
// window's stored complex (edges and triangles whose stored radius is at most map_r, among those cells) grows, the cell's
// own stored bars rise beside it as a small tower (rods on the tower's log ruler, its two curves as ribbons counted from
// the stored bars), and its stored score stands as a needle. Then a dome sweeps the window row by row and behind it every
// cell rises or sinks by its own stored score (lo50, clamped at the colour map's limit) and takes the poster's colours: a
// relief of the window's stored triangles, the scars red and up, the healthy-like tissue blue and down. The cells then
// lift off in two groups by the sign of their score (healthy-like, cirrhosis-like: as many as comp50.sizes) and sort
// themselves by type into piles (comp50's five types and other), as columns whose heights follow each type's share; and
// the sketches of the workflow on other modalities (spots and a volcano of genes; a multiplex slide and protein columns:
// schematic, labelled so). Nothing is computed here but drawing: look-ups by stored radius, counts of stored bars,
// places by stored numbers. Everything follows the params; t only breathes the glow.
SETS.map = function (K) {
  const { THREE, clamp, lerp, prog } = K;
  const set = K.newSet('map');
  const LK = TLOOK(K, set), T = TDATA, D = T.D, SD = D.slide, W = T.slide, PI = Math.PI;
  const TW = 1.6, BOTHX = 0.42;               // as the slide set: the window TW across; its place side by side (slide_show 2)
  const N = W.n, side = SD.side, k = TW / side, DELTA = 50, DR = DELTA * k;
  const HM = 0.15, LIFT = 0.004;              // the relief: height at the colour map's limit; its base over the tissue
  const TH = 0.3, PITCH = 0.0062;             // the cell's own tower: its height (the log ruler 1.5 to 60 µm), rod spacing
  const UP = [0, 1, 0];
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- the cells
  const X = new Float32Array(N), Z = new Float32Array(N), H50 = new Float32Array(N), VIS = new Float32Array(N);
  const C50 = new Float32Array(3 * N), C100 = new Float32Array(3 * N), _c = [0, 0, 0], GREYC = [0.42, 0.45, 0.52];
  const rows = side / 100;
  // the order the sweeping dome visits the cells: rows of 100 µm, back and forth (the slide set dims its tissue so too)
  const visitOf = (x, y) => { const row = Math.min(Math.floor(y / 100), rows - 1); let f = x / side; if (row % 2) f = 1 - f; return (row + f) / rows * 0.92; };
  for (let i = 0; i < N; i++) {
    X[i] = (W.x[i] - side / 2) * k; Z[i] = (W.y[i] - side / 2) * k; VIS[i] = visitOf(W.x[i], W.y[i]);
    const a = W.lo50[i], b = W.lo100[i];
    H50[i] = isNaN(a) ? 0 : clamp(a / SD.limit50, -1, 1);   // (a cell with no local curve stays flat and grey)
    C50.set(isNaN(a) ? GREYC : T.colour(a, SD.limit50, _c), 3 * i); C100.set(isNaN(b) ? GREYC : T.colour(b, SD.limit100, _c), 3 * i);
  }
  // a grid for the cells near a point
  const GC = 25, GN = Math.ceil(side / GC) + 1, ghead = new Int32Array(GN * GN).fill(-1), gnext = new Int32Array(N);
  const gci = v => clamp(Math.floor(v / GC), 0, GN - 1);
  for (let i = 0; i < N; i++) { const q = gci(W.x[i]) + GN * gci(W.y[i]); gnext[i] = ghead[q]; ghead[q] = i; }
  function near(px, py, r, out) {
    out.length = 0;
    for (let b = gci(py - r); b <= gci(py + r); b++) for (let a = gci(px - r); a <= gci(px + r); a++) for (let i = ghead[a + GN * b]; i >= 0; i = gnext[i]) {
      if ((W.x[i] - px) ** 2 + (W.y[i] - py) ** 2 <= r * r) out.push(i);
    }
    return out;
  }
  // the stored complex by cell: the edges and triangles each cell is in
  const csr = (n, list) => {
    const off = new Uint32Array(N + 1);
    for (let e = 0; e < n; e++) for (const v of list(e)) off[v + 1]++;
    for (let i = 0; i < N; i++) off[i + 1] += off[i];
    const at = off.slice(0, N), ids = new Uint32Array(off[N]);
    for (let e = 0; e < n; e++) for (const v of list(e)) ids[at[v]++] = e;
    return { off, ids };
  };
  const E = W.edges, TR = W.tris, _l2 = [0, 0], _l3 = [0, 0, 0];
  const edgeOf = csr(E.n, e => { _l2[0] = E.i[e]; _l2[1] = E.j[e]; return _l2; });
  const triOf = csr(TR.n, t => { _l3[0] = TR.i[t]; _l3[1] = TR.j[t]; _l3[2] = TR.k[t]; return _l3; });

  // the two groups by the sign of the score (cells scored exactly 0, after rounding, fill each group up to its stored
  // size), for 50 and 100 µm; each cell's type among comp's six (five types and other)
  const COMP = [SD.comp50, SD.comp100], LOS = [W.lo50, W.lo100];
  const GROUP = [new Uint8Array(N), new Uint8Array(N)], SIZE = [[0, 0], [0, 0]];
  for (let d = 0; d < 2; d++) {
    const lo = LOS[d], want0 = COMP[d].sizes[0];
    let neg = 0;
    for (let i = 0; i < N; i++) if (lo[i] < 0) neg++;
    let spare = want0 - neg;
    for (let i = 0; i < N; i++) {
      const g = lo[i] < 0 ? 0 : lo[i] > 0 ? 1 : spare-- > 0 ? 0 : 1;
      GROUP[d][i] = g; SIZE[d][g]++;
    }
  }
  const CT = SD.comp50.types, ctIdx = W.types.map(nm => { const j = CT.indexOf(nm); return j < 0 ? CT.indexOf('other') : j; });
  const TYPE = new Uint8Array(N);
  for (let i = 0; i < N; i++) TYPE[i] = ctIdx[W.type[i]];
  const TCOL = CT.map(nm => K.rgb(T.typeColour(nm)));

  // the piles: per group a row of six columns (one per type), a column's cross-section set by its group's size so that
  // its height follows the type's share (LAYERS layers for a share of 1); each cell its slot, filled from the bottom
  const PITCHB = 0.019, LAYERS = 120, PBASE = 0.03, PZ = 0.0, GX = [-0.48, 0.48], PSP = 0.15;
  const PILE = [new Float32Array(3 * N), new Float32Array(3 * N)], DELAY = new Float32Array(N), TOPS = [[], []];
  const R0 = K.rng(50);
  for (let d = 0; d < 2; d++) {
    const per = [0, 1].map(g => Math.max(1, Math.round(SIZE[d][g] / LAYERS))), dims = per.map(c => { const nx = Math.ceil(Math.sqrt(c)); return [nx, Math.ceil(c / nx)]; });
    const fill = Array.from({ length: 2 }, () => new Int32Array(6));
    for (let i = 0; i < N; i++) {
      const g = GROUP[d][i], t = TYPE[i], s = fill[g][t]++, c = per[g], layer = Math.floor(s / c), q = s % c, [nx, nz] = dims[g];
      const cx = GX[g] + (t - 2.5) * PSP, ix = q % nx, iz = Math.floor(q / nx);
      PILE[d][3 * i] = cx + (ix - (nx - 1) / 2) * PITCHB; PILE[d][3 * i + 1] = PBASE + (layer + 0.5) * PITCHB; PILE[d][3 * i + 2] = PZ + (iz - (nz - 1) / 2) * PITCHB;
      if (d === 0) DELAY[i] = 0.45 * Math.min(1, layer / 40) + 0.06 * R0();
    }
    for (let g = 0; g < 2; g++) for (let t = 0; t < 6; t++) TOPS[d].push([GX[g] + (t - 2.5) * PSP, PBASE + Math.ceil(fill[g][t] / per[g]) * PITCHB, PZ, dims[g][0] * PITCHB]);
  }

  // ---------------------------------------------------------------- the relief (the stored triangles, lifted) and the beads
  const inner = new THREE.Group();
  set.group.add(inner);
  const RTRI = 30;   // µm: triangles up to this radius (larger ones span vessels and the window's edge)
  let nt = 0;
  for (let t = 0; t < TR.n; t++) if (TR.r[t] <= RTRI) nt++;
  const rel = { P: new Float32Array(nt * 6), H: new Float32Array(nt * 3), V: new Float32Array(nt * 3), C: new Float32Array(nt * 9), C2: new Float32Array(nt * 9), B: new Float32Array(nt * 9) };
  {
    let o = 0;
    for (let t = 0; t < TR.n; t++) {
      if (TR.r[t] > RTRI) continue;
      const vs = [TR.i[t], TR.j[t], TR.k[t]];
      for (let c = 0; c < 3; c++) {
        const i = vs[c], v = o * 3 + c;
        rel.P[2 * v] = X[i]; rel.P[2 * v + 1] = Z[i]; rel.H[v] = H50[i]; rel.V[v] = VIS[i];
        for (let j = 0; j < 3; j++) { rel.C[3 * v + j] = C50[3 * i + j]; rel.C2[3 * v + j] = C100[3 * i + j]; }
        rel.B[3 * v + c] = 1;
      }
      o++;
    }
  }
  const relU = { uA: { value: 0 }, uAll: { value: 0 }, uDelta: { value: 0 }, uHM: { value: HM }, uSplit: { value: 0 }, uLift: { value: LIFT } };
  const relGeo = new THREE.BufferGeometry();
  relGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nt * 9), 3));   // (unused: the shader places them)
  relGeo.setAttribute('aP', new THREE.BufferAttribute(rel.P, 2)); relGeo.setAttribute('aH', new THREE.BufferAttribute(rel.H, 1));
  relGeo.setAttribute('aV', new THREE.BufferAttribute(rel.V, 1)); relGeo.setAttribute('aC', new THREE.BufferAttribute(rel.C, 3));
  relGeo.setAttribute('aC2', new THREE.BufferAttribute(rel.C2, 3)); relGeo.setAttribute('aBar', new THREE.BufferAttribute(rel.B, 3));
  const relMat = new THREE.ShaderMaterial({
    uniforms: relU, transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true },
    vertexShader: `attribute vec2 aP; attribute float aH, aV; attribute vec3 aC, aC2, aBar;
uniform float uA, uAll, uDelta, uHM, uSplit, uLift;
varying vec3 vC, vB, vPos; varying float vA, vH;
void main() {
  float rise = smoothstep(aV, aV + 0.05, uAll), keep = 1.0 - smoothstep(0.0, 0.35, uSplit);
  float h = aH * uHM * rise * keep + uLift;
  vec4 mv = modelViewMatrix * vec4(aP.x, h, aP.y, 1.0);
  vC = mix(aC, aC2, uDelta); vB = aBar; vPos = mv.xyz; vH = aH * rise;
  vA = uA * smoothstep(0.0, 0.6, rise) * keep;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC, vB, vPos; varying float vA, vH;
void main() {
  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos))), v = normalize(-vPos);
  if (dot(n, v) < 0.0) n = -n;
  vec3 l = normalize(vec3(-0.45, 0.55, 0.7));
  float dif = max(dot(n, l), 0.0), rim = pow(1.0 - abs(dot(n, v)), 2.0), spec = pow(max(dot(reflect(-l, n), v), 0.0), 30.0);
  float m = min(vB.x, min(vB.y, vB.z)), w = fwidth(m), line = 1.0 - smoothstep(0.4 * w, 1.6 * w, m);
  vec3 col = vC * (0.42 + 0.55 * dif + 0.25 * rim) + vec3(spec * 0.35);
  col = mix(col, mix(vC, vec3(1.0), 0.5), line * 0.25);
  gl_FragColor = vec4(col, vA * (0.84 + 0.1 * line));
}`,
  });
  relMat.userData.fixed = true;   // (its depth writes are its own)
  set.mats.push(relMat);
  const relief = new THREE.Mesh(relGeo, relMat);
  relief.frustumCulled = false; relief.renderOrder = 1;
  inner.add(relief);

  // the beads: every cell, on the relief, flying to its pile, back to the slide for the sketches (one instanced quad
  // each, facing the camera; where it is follows the params in the shader, so nothing is refilled)
  const bg = new THREE.InstancedBufferGeometry(), bq = new THREE.PlaneGeometry(2, 2);
  bg.setAttribute('position', bq.attributes.position); bg.setIndex(bq.index);
  const BP = new Float32Array(4 * N), BC = new Float32Array(3 * N), BT = new Float32Array(3 * N), BG = new Float32Array(6 * N);
  for (let i = 0; i < N; i++) {
    BP[4 * i] = X[i]; BP[4 * i + 1] = Z[i]; BP[4 * i + 2] = H50[i]; BP[4 * i + 3] = VIS[i];
    BC.set(TCOL[TYPE[i]], 3 * i); BT[3 * i] = DELAY[i]; BT[3 * i + 1] = GROUP[0][i]; BT[3 * i + 2] = GROUP[1][i];
  }
  bg.setAttribute('aP', new THREE.InstancedBufferAttribute(BP, 4));
  bg.setAttribute('aC', new THREE.InstancedBufferAttribute(C50, 3)); bg.setAttribute('aC2', new THREE.InstancedBufferAttribute(C100, 3));
  bg.setAttribute('aT', new THREE.InstancedBufferAttribute(BC, 3)); bg.setAttribute('aD', new THREE.InstancedBufferAttribute(BT, 3));
  bg.setAttribute('aQ', new THREE.InstancedBufferAttribute(PILE[0], 3)); bg.setAttribute('aQ2', new THREE.InstancedBufferAttribute(PILE[1], 3));
  bg.instanceCount = N;
  const beadU = { uA: { value: 0 }, uAll: { value: 0 }, uDelta: { value: 0 }, uHM: { value: HM }, uSplit: { value: 0 }, uBack: { value: 0 }, uLift: { value: LIFT },
    uR: { value: 0.0042 }, uPx: K.U.uPx, uDome: { value: new THREE.Vector4(0, 0, 0, 0) }, uHid: { value: 0 }, uFluo: { value: 0 },
    uHC: { value: new THREE.Color(...LK.HEALTHYLIT) }, uCC: { value: new THREE.Color(...LK.CIRRLIT) } };
  const beadMat = new THREE.ShaderMaterial({
    uniforms: beadU, transparent: true, depthWrite: false,
    vertexShader: `attribute vec4 aP; attribute vec3 aC, aC2, aT, aD, aQ, aQ2;
uniform float uA, uAll, uDelta, uHM, uSplit, uBack, uLift, uR, uPx, uHid, uFluo; uniform vec4 uDome; uniform vec3 uHC, uCC;
varying vec3 vC; varying vec2 vQ; varying float vA, vG;
void main() {
  float rise = smoothstep(aP.w, aP.w + 0.05, uAll);
  vec3 p0 = vec3(aP.x, aP.z * uHM * rise + uLift + 0.002, aP.y);
  float s = smoothstep(aD.x, aD.x + 0.5, uSplit), e = s * s * (3.0 - 2.0 * s);
  vec3 q = mix(aQ, aQ2, uDelta), p = mix(p0, q, e) + vec3(0.0, 0.22 * sin(3.14159 * e), 0.0);
  float b = smoothstep(aD.x, aD.x + 0.5, uBack);
  p = mix(p, vec3(aP.x, uLift + 0.003, aP.y), b);
  // the map's colour on the relief, the type's in the piles, the group's back on the slide
  float g = mix(aD.y, aD.z, uDelta);
  vec3 c = mix(mix(aC, aC2, uDelta), aT, e);
  c = mix(c, mix(uHC, uCC, g), b);
  // under the sweeping dome the cells light
  float dd = length(vec2(aP.x, aP.y) - uDome.xy), lit = uDome.w * (1.0 - smoothstep(uDome.z * 0.85, uDome.z, dd));
  vG = lit;
  vC = mix(c, vec3(1.0), 0.25 * lit) * (1.0 + 0.5 * uFluo * b);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float sz = uR * length(modelViewMatrix[0].xyz) * (1.0 + 0.6 * lit);
  float px = uR * uPx * projectionMatrix[1][1] / max(-mv.z, 1e-4), gr = max(1.0, 1.4 / max(px, 1e-3));   // never under 1.4 pixels
  mv.xy += position.xy * sz * gr;
  vQ = position.xy;
  vA = uA * max(rise, e) * (1.0 - uHid * b) / (gr * gr);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec3 vC; varying vec2 vQ; varying float vA, vG;
void main() {
  float d = length(vQ);
  if (d > 1.0) discard;
  float core = 1.0 - smoothstep(0.62, 0.8, d), lit = 0.72 + 0.4 * clamp(dot(vQ / 0.8, vec2(-0.45, 0.55)), -1.0, 1.0);
  vec3 col = mix(vC * lit, vec3(1.0), 0.35 * (1.0 - smoothstep(0.0, 0.3, length(vQ - vec2(-0.2, 0.25)))));
  float a = max(core, 0.45 * pow(1.0 - d, 2.0) * (1.0 + vG));
  gl_FragColor = vec4(col, vA * a);
}`,
  });
  beadMat.userData.fixed = true;
  set.mats.push(beadMat);
  const beads = new THREE.Mesh(bg, beadMat);
  beads.frustumCulled = false; beads.renderOrder = 2;
  inner.add(beads);

  // ---------------------------------------------------------------- the dome, and the pools drawn every frame
  const domeGeo = new THREE.SphereGeometry(1, 40, 14, 0, PI * 2, 0, PI / 2);
  const domeMat = K.rim(set, { color: LK.CYAN, a0: 0.035, a1: 0.55 });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.renderOrder = 4; dome.visible = false;
  inner.add(dome);
  const tubes = LK.tubes(420), balls = LK.balls(140), rings = LK.rings(8), halos = LK.halos(40), cones = LK.cones(4), sheet = LK.sheet(240);
  const discs = LK.discs(110, 0.2), ribbons = LK.ribbons(2, 200), boxes = LK.boxes(40);
  inner.add(tubes.mesh, balls.mesh, rings.mesh, halos.mesh, cones.mesh, sheet.mesh, discs.mesh, ribbons.mesh, boxes.mesh);

  // ---------------------------------------------------------------- one cell: its neighbourhood, its complex, its bars
  const e = SD.e, local = { cell: -1, ready: false, nb: [], edges: [], tris: [], h0: [], h1: [], env0: null, env1: null, m0: 1, m1: 1 };
  const mark = new Uint8Array(N);
  // the step curves of its stored bars on the log ruler (u 0..1): pieces (deaths, one living on) and loops (births, deaths)
  function steps(bars, isH0, floor) {
    const ev = [];
    if (isH0) for (const d of bars) ev.push(d); else for (const v of bars) ev.push(v);
    ev.sort((a, b) => a - b);
    const count = r => (isH0 ? T.deaths(bars, r) + 1 : T.betti(bars, r));
    const env = [0, count(T.rOf(0))];
    let prev = env[1], mx = Math.max(1, prev);
    for (const r of ev) {
      const u = T.u(r);
      if (u <= 0 || u >= 1) continue;
      const c = count(r);
      if (c === prev) continue;
      env.push(u, prev, u, c); prev = c; mx = Math.max(mx, c);
    }
    env.push(1, count(T.rOf(1)));
    mx = Math.max(mx, floor);
    for (let j = 1; j < env.length; j += 2) env[j] /= mx;   // (its own top: the shape over the radii counts here)
    return { env, mx };
  }
  function setCell(c) {
    const ready = c === e.cell || T.localReady;
    if (c === local.cell && ready === local.ready) return;
    local.cell = c; local.ready = ready;
    near(W.x[c], W.y[c], DELTA, local.nb);
    for (const i of local.nb) mark[i] = 1;
    local.edges.length = 0; local.tris.length = 0;
    for (const i of local.nb) {
      // (each edge and triangle listed once, from its first corner; all its corners must be among the cells)
      for (let q = edgeOf.off[i]; q < edgeOf.off[i + 1]; q++) { const ed = edgeOf.ids[q]; if (E.i[ed] === i && mark[E.j[ed]]) local.edges.push(ed); }
      for (let q = triOf.off[i]; q < triOf.off[i + 1]; q++) { const t = triOf.ids[q]; if (TR.i[t] === i && mark[TR.j[t]] && mark[TR.k[t]]) local.tris.push(t); }
    }
    for (const i of local.nb) mark[i] = 0;
    local.edges.sort((a, b) => E.r[a] - E.r[b]); local.tris.sort((a, b) => TR.r[a] - TR.r[b]);
    // its own bars: the poster's cell v's always there; another cell's once the bars are inflated
    const h0 = c === e.cell ? SD.eBars.h0 : W.localH0(c), h1 = c === e.cell ? SD.eBars.h1 : W.localH1(c);
    local.h0 = h0 ? h0.slice().sort((a, b) => b - a) : [];
    const pairs = [];
    if (h1) for (let j = 0; j + 1 < h1.length; j += 2) pairs.push([h1[j], h1[j + 1]]);
    pairs.sort((a, b) => (T.u(b[1]) - T.u(b[0])) - (T.u(a[1]) - T.u(a[0])));
    local.h1 = pairs;
    local.bars1 = h1 || [];
    const s0 = steps(local.h0, true, 1), s1 = steps(local.bars1, false, 3);
    local.env0 = s0.env; local.m0 = s0.mx; local.env1 = s1.env; local.m1 = s1.mx;
  }

  // ---------------------------------------------------------------- the sketches (schematic: the workflow, not data)
  const RS = K.rng(77), GENES = [];
  for (let j = 0; j < 320; j++) {
    const fc = K.gauss(RS) * 0.85, sig = Math.min(1, Math.abs(fc) * (0.35 + 0.75 * RS()) * 0.55 + 0.04 * RS());
    GENES.push([fc * 0.3, 0.08 + 0.62 * sig, -0.18 + (RS() - 0.5) * 0.3, Math.abs(fc) > 0.75 && sig > 0.33 ? (fc > 0 ? 1 : -1) : 0, 0.5 * RS()]);
  }
  const PROT = Array.from({ length: 6 }, (_, j) => [0.12 + 0.3 * RS(), 0.12 + 0.3 * RS()].map((h, g) => h * (j === 1 || j === 4 ? (g ? 1.7 : 0.7) : 1)));
  // spots over the window: the share of cirrhosis-like cells under each, by δ
  const SPOTS = [], SPR = 17;
  {
    const tmp = [];
    for (let row = 0, y = 25; y < side; row++, y += 50 * 0.866) for (let x = row % 2 ? 50 : 25; x < side; x += 50) {
      near(x, y, SPR * 1.3, tmp);
      if (!tmp.length) continue;
      let a = 0, b = 0;
      for (const i of tmp) { a += GROUP[0][i]; b += GROUP[1][i]; }
      SPOTS.push([(x - side / 2) * k, (y - side / 2) * k, a / tmp.length, b / tmp.length]);
    }
  }
  const spotP = LK.cells(SPOTS.length), geneP = LK.cells(GENES.length);
  inner.add(spotP.mesh, geneP.mesh);
  geneP.lod(0.1, 0.3);
  spotP.lod(0.2, 0.6);
  const spotA = { value: 0 };
  spotP.mesh.material.uniforms.uA = spotA;   // (its own fade: filled again only when δ changes)
  let spotKey = -1;
  const plateU = { uA: { value: 0 } };
  const plateMat = new THREE.ShaderMaterial({ uniforms: plateU, transparent: true, depthWrite: false,
    vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA; void main() { gl_FragColor = vec4(0.006, 0.01, 0.022, 0.9 * uA); }' });
  plateMat.userData.fixed = true;
  set.mats.push(plateMat);
  const plateGeo = new THREE.PlaneGeometry(TW, TW);
  plateGeo.rotateX(-PI / 2);
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.y = 0.0025; plate.renderOrder = 1; plate.visible = false;
  inner.add(plate);

  // ---------------------------------------------------------------- the extremes of the relief (for its tags: drawing)
  const ext = (() => {
    const B = 10, bs = side / B, sum = new Float32Array(B * B), cnt = new Float32Array(B * B);
    for (let i = 0; i < N; i++) { if (isNaN(W.lo50[i])) continue; const q = clamp(Math.floor(W.x[i] / bs), 0, B - 1) + B * clamp(Math.floor(W.y[i] / bs), 0, B - 1); sum[q] += H50[i]; cnt[q]++; }
    let hi = 0, lo = -1;
    for (let q = 0; q < B * B; q++) if (cnt[q] >= 40 && (!cnt[hi] || sum[q] / cnt[q] > sum[hi] / cnt[hi])) hi = q;
    // (the lowest well away from the highest, so their two tags never meet)
    for (let q = 0; q < B * B; q++) if (cnt[q] >= 40 && Math.hypot(q % B - hi % B, Math.floor(q / B) - Math.floor(hi / B)) >= 4 && (lo < 0 || sum[q] / cnt[q] < sum[lo] / cnt[lo])) lo = q;
    if (lo < 0) lo = hi;
    const at = q => [((q % B) + 0.5) * bs, (Math.floor(q / B) + 0.5) * bs, sum[q] / cnt[q]];
    return { hi: at(hi), lo: at(lo) };
  })();

  // ---------------------------------------------------------------- update
  const now = { cell: e.cell, r: 50, wx: 0, rise: 0, delta: 0, split: 0, h: 0, dome: [0, 0, 0], pieces: 0, loops: 0, lo: e.logOdds };
  const _a = [0, 0, 0], _b = [0, 0, 0], _p = [0, 0, 0], _q = [0, 0, 0], _col = [0, 0, 0], _dir = [0, 1, 0], _sz = [0.05, 0, 0.05], BASE = [6 * PSP + 0.03, 0.006, 0.2];
  const RIB0 = { glow: 0.9, fill: 1, to: 1 }, RIB1 = { glow: 0.9, fill: 1, to: 1 }, RY1 = [0.06, 0, 0];
  const CYANL = [0.6, 0.93, 1.0], SPOTC = [0, 0, 0], GENEGREY = [0.62, 0.66, 0.74];
  // a cell's height on the relief now (the same as the shader's)
  const hOf = (i, all, split) => H50[i] * HM * sstep(VIS[i], VIS[i] + 0.05, all) * (1 - sstep(0, 0.35, split)) + LIFT;
  function update(S, t) {
    // (only over the window: with the slide set showing the tile alone, nothing of this shows)
    const show = S.slide_show === undefined ? 1 : clamp(S.slide_show, 0, 2), wa = Math.min(1, show), A = set.uA.value * wa;
    now.wx = BOTHX * Math.max(0, show - 1);
    inner.position.set(now.wx, 0, 0);
    const all = clamp(S.map_all, 0, 1), split = clamp(S.map_split, 0, 1), om = clamp(S.map_omics, 0, 2), o1 = clamp(om, 0, 1), o2 = clamp(om - 1, 0, 1);
    const dl = Math.round(clamp(S.map_delta, 0, 1)), back = o1;
    now.delta = dl; now.split = split;
    relU.uA.value = A; relU.uAll.value = all; relU.uDelta.value = dl; relU.uSplit.value = split;
    relief.visible = all > 0.003 && split < 0.35;
    relMat.depthWrite = A > 0.97 && split < 0.05;
    beadU.uA.value = A; beadU.uAll.value = Math.max(all, split > 0 ? 1 : 0); beadU.uDelta.value = dl; beadU.uSplit.value = split;
    beadU.uBack.value = back; beadU.uHid.value = o1 * (1 - o2); beadU.uFluo.value = o2;
    beads.visible = all > 0.003 || split > 0.003;
    beadU.uR.value = lerp(0.0042, 0.0074, split);
    // the sweeping dome (rows back and forth) lights the cells under it
    const da = prog(all, 0, 0.02) * (1 - prog(all, 0.92, 0.97)) * wa;
    {
      const a = clamp(all / 0.92, 0, 0.9999) * rows, row = Math.floor(a), f = a - row, x = row % 2 ? (1 - f) * side : f * side, y = (row + 0.5) * 100;
      now.dome[0] = (x - side / 2) * k; now.dome[2] = (y - side / 2) * k; now.dome[1] = LIFT;
      beadU.uDome.value.set(now.dome[0], now.dome[2], DR, da);
    }
    tubes.begin(); balls.begin(); rings.begin(); halos.begin(); cones.begin(); sheet.begin(); discs.begin(); ribbons.begin(); boxes.begin();
    if (da > 0.003) {
      rings.add(now.dome, UP, DR, 0.0018, LK.CYAN, da, 0);
      halos.add(now.dome, DR * 3, LK.CYAN, 0.25 * da);
    }
    // ---- one cell
    const c = S.map_pick >= 0 && S.map_pick < N ? Math.round(S.map_pick) : e.cell, ca = clamp(S.map_cell, 0, 1) * (1 - prog(split, 0, 0.2)) * (1 - prog(om, 0, 0.2)) * wa;
    setCell(c);
    now.cell = c;
    const r = clamp(S.map_r, 0.5, 120), hc = hOf(c, all, split), cx = X[c], cz = Z[c];
    now.r = r; now.h = hc;
    now.lo = c === e.cell ? e.logOdds : W.lo50[c];
    now.pieces = T.deaths(local.h0, r) + 1; now.loops = T.betti(local.bars1, r);
    dome.visible = ca > 0.003;
    if (ca > 0.003) {
      dome.position.set(cx, hc, cz); dome.scale.setScalar(DR * Math.min(1, 0.2 + 0.8 * ca / 0.6));
      domeMat.uniforms.uK.value = ca * (0.85 + 0.15 * Math.sin(t * 2));
      _q[0] = cx; _q[1] = hc + 0.0005; _q[2] = cz; rings.add(_q, UP, DR, 0.0012, LK.CYAN, ca, 0);
      const ba = clamp(S.map_balls, 0, 1) * ca;
      for (const i of local.nb) {
        _p[0] = X[i]; _p[1] = hOf(i, all, split) + 0.004; _p[2] = Z[i];
        balls.add(_p, i === c ? 0.0058 : 0.0042, i === c ? LK.CYAN : LK.BEAD, ca);
        if (ba > 0.003) { _q[0] = _p[0]; _q[1] = _p[1] - 0.0025; _q[2] = _p[2]; discs.add(_q, null, r * k, LK.CYAN, ba, 1); }
      }
      // its part of the complex at radius r: edges and triangles whose stored radius is at most r
      for (const ed of local.edges) {
        if (E.r[ed] > r) break;
        const i = E.i[ed], j = E.j[ed];
        _a[0] = X[i]; _a[1] = hOf(i, all, split) + 0.004; _a[2] = Z[i]; _b[0] = X[j]; _b[1] = hOf(j, all, split) + 0.004; _b[2] = Z[j];
        tubes.add(_a, _b, 0.0014, LK.EDGE, ca, 0);
      }
      for (const tr of local.tris) {
        if (TR.r[tr] > r) break;
        const i = TR.i[tr], j = TR.j[tr], kk = TR.k[tr];
        _a[0] = X[i]; _a[1] = hOf(i, all, split) + 0.0035; _a[2] = Z[i]; _b[0] = X[j]; _b[1] = hOf(j, all, split) + 0.0035; _b[2] = Z[j];
        _p[0] = X[kk]; _p[1] = hOf(kk, all, split) + 0.0035; _p[2] = Z[kk];
        sheet.add(_a, _b, _p, LK.CYAN, ca, 0.6);
      }
      _q[0] = cx; _q[1] = hc + 0.004; _q[2] = cz; halos.add(_q, 0.05, LK.CYAN, 0.35 * ca);
      // its own bars: rods on the log ruler behind it, pieces to the left, loops to the right, rising with map_bars
      const bars = clamp(S.map_bars, 0, 1) * ca;
      if (bars > 0.003) {
        const z = cz - DR - 0.035, y0 = hc, lvl = TH * clamp(S.map_bars, 0, 1), n0 = local.h0.length + 1;
        const rod = (x, ub, ud, col, inf) => {
          const a0 = y0 + TH * ub, a1 = Math.min(y0 + TH * ud, y0 + lvl);
          if (a1 <= a0 + 1e-4) return;
          _a[0] = x; _a[1] = a0; _a[2] = z; _b[0] = x; _b[1] = a1; _b[2] = z;
          tubes.add(_a, _b, 0.0019, col, bars, 0);
          if (inf && a1 >= y0 + TH - 1e-3) cones.add(_b, UP, 0.012, 0.004, col, bars);
        };
        for (let j = 0; j < n0; j++) rod(cx - PITCH * (j + 0.5), 0, j === 0 ? 1 : T.height(local.h0[j - 1]), LK.PIECE, j === 0);
        for (let j = 0; j < local.h1.length; j++) rod(cx + PITCH * (j + 0.5), T.height(local.h1[j][0]), T.height(local.h1[j][1]), LK.LOOP, false);
        // the two curves: counts of the bars alive at each height, as ribbons standing beside the rods
        const xl = cx - PITCH * (n0 + 0.8), xr = cx + PITCH * (local.h1.length + 0.8);
        RIB0.to = RIB1.to = clamp(S.map_bars, 0, 1);
        ribbons.add(local.env0, [xl, y0, z], [0, TH, 0], [-0.075, 0, 0], 0.003, LK.PIECE, bars, RIB0);
        ribbons.add(local.env1, [xr, y0, z], [0, TH, 0], RY1, 0.003, LK.LOOP, bars, RIB1);
        // the radius as a level across them
        const yl = y0 + TH * T.height(r);
        if (yl <= y0 + lvl + 1e-4) {
          _a[0] = xl - 0.08; _a[1] = yl; _a[2] = z; _b[0] = xr + 0.065; _b[1] = yl; _b[2] = z;
          tubes.add(_a, _b, 0.0011, CYANL, 0.8 * bars, 0);
          _q[0] = cx; _q[1] = yl; _q[2] = z; halos.add(_q, 0.03, LK.CYAN, 0.25 * bars);
        }
      }
      // its score: a needle up (towards cirrhosis) or down (towards healthy)
      const sc = clamp(S.map_score, 0, 1) * ca;
      if (sc > 0.003 && !isNaN(now.lo)) {
        const L = clamp(now.lo / SD.limit50, -1, 1) * 0.17 * sc, bright = LK.mix(T.colour(now.lo, SD.limit50, _col), now.lo >= 0 ? LK.CIRRLIT : LK.HEALTHYLIT, 0.5, _col);
        const x = cx + DR + 0.02;
        _a[0] = x; _a[1] = hc; _a[2] = cz; _b[0] = x; _b[1] = hc + L; _b[2] = cz;
        tubes.add(_a, _b, 0.0026, bright, sc, 0);
        _dir[1] = Math.sign(L) || 1; cones.add(_b, _dir, 0.014, 0.0065, bright, sc);
        balls.add(_a, 0.004, bright, sc);
        rings.add(_a, UP, 0.012, 0.0009, bright, 0.6 * sc, 0);
      }
    }
    // ---- the piles' bases and the sketches
    const pa = prog(split, 0.15, 0.5) * (1 - o1) * wa;
    if (pa > 0.003) {
      for (let g = 0; g < 2; g++) { _a[0] = GX[g]; _a[1] = PBASE - 0.006; _a[2] = PZ; boxes.add(_a, BASE, g ? LK.CIRR : LK.HEALTHY, 0.75 * pa); }
    }
    plate.visible = o2 > 0.003; plateU.uA.value = A * o2;
    spotA.value = A * o1 * (1 - o2);
    spotP.mesh.visible = spotA.value > 0.003;
    if (spotP.mesh.visible && spotKey !== dl) {
      spotKey = dl;
      spotP.begin();
      for (const s of SPOTS) {
        LK.mix(LK.HEALTHYLIT, LK.CIRRLIT, s[2 + dl], SPOTC);
        _a[0] = s[0]; _a[1] = 0.003; _a[2] = s[1];
        spotP.add(_a, SPR * k, LK.CELL.BEAD, SPOTC, 0.95, 0, UP);
      }
      spotP.end();
    }
    geneP.begin();
    if (o1 * (1 - o2) > 0.003) {
      const a = o1 * (1 - o2) * wa;
      for (const G of GENES) {
        const f = sstep(G[4], G[4] + 0.5, o1);
        _a[0] = G[0]; _a[1] = lerp(0.01, G[1], f); _a[2] = G[2];
        geneP.add(_a, 0.0062, LK.CELL.BEAD, G[3] > 0 ? LK.CIRRLIT : G[3] < 0 ? LK.HEALTHYLIT : GENEGREY, a * f, 0, null);
      }
    }
    geneP.end();
    if (o2 > 0.003) {
      for (let j = 0; j < PROT.length; j++) {
        const pr = PROT[j];
        for (let g = 0; g < 2; g++) {
          const h = pr[g] * sstep(j * 0.08, j * 0.08 + 0.5, o2);
          _a[0] = -0.5 + j * 0.2 + (g ? 0.035 : -0.035); _a[1] = 0.01 + h / 2; _a[2] = -0.2;
          _sz[1] = h; if (h > 0.002) boxes.add(_a, _sz, g ? LK.CIRRLIT : LK.HEALTHYLIT, o2 * wa);
        }
      }
    }
    tubes.end(); balls.end(); rings.end(); halos.end(); cones.end(); sheet.end(); discs.end(); ribbons.end(); boxes.end();
    LK.depth();
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const at = (x, y, z) => [now.wx + x, y, z];
  const fmt = v => v.toLocaleString('en-GB'), pct = v => `${Math.round(v * 100)} %`, sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
  const pileTop = (g, t) => () => { const P = TOPS[now.delta][g * 6 + t]; return at(P[0] + P[3] / 2, P[1] + 0.01, P[2]); };
  const anchors = {
    cell: () => at(X[now.cell], now.h, Z[now.cell]),
    dome: () => at(X[now.cell] + DR * 0.7, now.h + DR * 0.75, Z[now.cell]),
    net: () => at(X[now.cell] - DR * 0.9, now.h + 0.01, Z[now.cell] + DR * 0.6),
    bars: () => at(X[now.cell] + PITCH * (local.h1.length + 2), now.h + TH * 0.85, Z[now.cell] - DR - 0.035),
    score: () => at(X[now.cell] + DR + 0.035, now.h + clamp(now.lo / SD.limit50, -1, 1) * 0.17, Z[now.cell]),
    sweep: () => at(now.dome[0] + DR, 0.03, now.dome[2]),
    red: at((ext.hi[0] - side / 2) * k, ext.hi[2] * HM + 0.02, (ext.hi[1] - side / 2) * k),
    blue: at((ext.lo[0] - side / 2) * k, LIFT + 0.02, (ext.lo[1] - side / 2) * k),
    healthy: () => at(GX[0] - 3 * PSP - 0.01, PBASE - 0.02, PZ + 0.1), cirrhosis: () => at(GX[1] - 3 * PSP - 0.01, PBASE - 0.02, PZ + 0.1),
    genes: () => at(0.12, 0.74, -0.18), proteins: () => at(0.55, 0.42, -0.2), window: () => at(-TW / 2 + 0.04, 0.01, -TW / 2 + 0.02),
  };
  CT.forEach((nm, t) => { anchors['h_' + t] = pileTop(0, t); anchors['c_' + t] = pileTop(1, t); });
  const share = (g, t) => COMP[now.delta][g ? 'cirrhosis' : 'healthy'][t];
  const cellName = () => (now.cell === e.cell ? 'Cell v' : `Cell ${fmt(now.cell + 1)}`);
  const win = S => (S.slide_show === undefined ? 1 : clamp(S.slide_show, 0, 1));   // (the map shows only over the window)
  const one = S => win(S) * clamp(S.map_cell, 0, 1) * (1 - prog(S.map_split, 0, 0.2)) * (1 - prog(S.map_omics, 0, 0.2));
  const FIB = CT.indexOf('Fibroblasts'), LYM = CT.indexOf('Lymphocytes');
  const labels = [
    { text: () => [cellName(), ` · ${DELTA} µm round it`], at: 'dome', cls: 'cyn',
      alpha: S => one(S) * (1 - prog(S.map_bars, 0.05, 0.3)) * (1 - prog(S.map_all, 0, 0.05)) },
    { text: () => ['Its own network', ` · at ${now.r < 10 ? now.r.toFixed(1) : Math.round(now.r)} µm`], at: 'net', cls: 'cyn',
      alpha: S => one(S) * prog(S.map_cell, 0.6, 1) * (1 - prog(S.map_bars, 0.05, 0.3)) * (1 - prog(S.map_all, 0, 0.05)) },
    { text: () => ['Its own bars', ` · ${now.pieces} piece${now.pieces === 1 ? '' : 's'}, ${now.loops} loop${now.loops === 1 ? '' : 's'}`], at: 'bars', cls: 'amb',
      alpha: S => one(S) * prog(S.map_bars, 0.4, 0.8) * (1 - prog(S.map_all, 0, 0.05)) },
    { text: () => ['Its score', ` · ${sgn(now.lo)}`], at: 'score', cls: '', alpha: S => one(S) * prog(S.map_score, 0.5, 1) * (1 - prog(S.map_all, 0, 0.05)) },
    { text: ['Every cell a centre', ''], at: 'sweep', cls: 'cyn', alpha: S => win(S) * prog(S.map_all, 0.01, 0.04) * (1 - prog(S.map_all, 0.88, 0.94)) },
    { text: ['Red, raised', ' · cirrhosis-like'], at: 'red', cls: 'mag', alpha: S => win(S) * prog(S.map_all, 0.95, 1) * (1 - prog(S.map_split, 0, 0.1)) * (1 - one(S)) },
    { text: ['Blue, sunk', ' · healthy-like'], at: 'blue', cls: 'cyn', alpha: S => win(S) * prog(S.map_all, 0.95, 1) * (1 - prog(S.map_split, 0, 0.1)) * (1 - one(S)) },
    { text: () => ['Healthy-like', ` · ${fmt(SD[now.delta ? 'comp100' : 'comp50'].sizes[0])} cells`], at: 'healthy', cls: 'cyn',
      alpha: S => win(S) * prog(S.map_split, 0.6, 0.9) * (1 - prog(S.map_omics, 0, 0.3)) },
    { text: () => ['Cirrhosis-like', ` · ${fmt(SD[now.delta ? 'comp100' : 'comp50'].sizes[1])} cells`], at: 'cirrhosis', cls: 'mag',
      alpha: S => win(S) * prog(S.map_split, 0.6, 0.9) * (1 - prog(S.map_omics, 0, 0.3)) },
    { text: () => ['Fibroblasts', ` · ${pct(share(1, FIB))}`], at: 'c_' + FIB, cls: 'grn', alpha: S => win(S) * prog(S.map_split, 0.85, 1) * (1 - prog(S.map_omics, 0, 0.3)) },
    { text: () => ['Lymphocytes', ` · ${pct(share(1, LYM))}`], at: 'c_' + LYM, cls: '', alpha: S => win(S) * prog(S.map_split, 0.85, 1) * (1 - prog(S.map_omics, 0, 0.3)) },
    { text: () => ['Fibroblasts', ` · ${pct(share(0, FIB))}`], at: 'h_' + FIB, cls: 'grn', alpha: S => win(S) * prog(S.map_split, 0.85, 1) * (1 - prog(S.map_omics, 0, 0.3)) },
    { text: () => ['Lymphocytes', ` · ${pct(share(0, LYM))}`], at: 'h_' + LYM, cls: '', alpha: S => win(S) * prog(S.map_split, 0.85, 1) * (1 - prog(S.map_omics, 0, 0.3)) },
    { text: ['Genes', ' · sketch: the workflow, not data'], at: 'genes', cls: 'amb', alpha: S => win(S) * prog(S.map_omics, 0.5, 0.9) * (1 - prog(S.map_omics, 1.1, 1.4)) },
    { text: ['Proteins', ' · sketch: the workflow, not data'], at: 'proteins', cls: 'amb', alpha: S => win(S) * prog(S.map_omics, 1.5, 1.9) },
  ];
  const vx = Math.round(X[e.cell] * 1000) / 1000, vz = Math.round(Z[e.cell] * 1000) / 1000;
  const cam = {
    default: [22, 34, 3.6, 0, 0.02, 0.06],
    cell: [18, 40, 0.62, vx, 0.03, vz],
    net: [10, 58, 0.36, vx, 0.005, Math.round((vz + 0.01) * 1000) / 1000],
    bars: [12, 16, 0.95, vx, 0.13, Math.round((vz - 0.04) * 1000) / 1000],
    score: [24, 22, 0.75, Math.round((vx + 0.03) * 1000) / 1000, 0.06, Math.round((vz - 0.02) * 1000) / 1000],
    sweep: [6, 44, 3.4, 0, 0, 0.08],
    relief: [24, 30, 3.5, 0, 0.02, 0.06],
    low: [32, 12, 3.1, 0, 0.04, 0.12],
    split: [0, 14, 3.9, 0, 0.32, 0.05],
    omics: [0, 20, 3.8, 0, 0.3, 0.02],
  };
  const controls = [
    { key: 'show', label: 'Show', options: [['cell', 'One cell'], ['map', 'Every cell'], ['split', 'Two groups'], ['genes', 'Genes (sketch)'], ['proteins', 'Proteins (sketch)']] },
    { key: 'r', label: 'Radius', options: [['2', '2 µm'], ['5', '5 µm'], ['10', '10 µm'], ['20', '20 µm'], ['50', '50 µm']] },
    { key: 'delta', label: 'Map at', options: [['50', '50 µm'], ['100', '100 µm']] },
  ];
  function explore(c) {
    const s = c.show || 'cell';
    return {
      map_cell: s === 'cell' ? 1 : 0, map_r: clamp(parseFloat(c.r) || 50, 0.5, 120), map_balls: s === 'cell' && (parseFloat(c.r) || 50) < 20 ? 1 : 0,
      map_bars: s === 'cell' ? 1 : 0, map_score: s === 'cell' ? 1 : 0, map_all: s === 'cell' ? 0 : 1,
      map_split: s === 'split' || s === 'genes' || s === 'proteins' ? 1 : 0, map_omics: s === 'genes' ? 1 : s === 'proteins' ? 2 : 0,
      map_delta: c.delta === '100' ? 1 : 0,
      slide_show: 1, slide_over: 0, slide_mode: 0, slide_points: 0, slide_scale: 0, slide_patch: 0,
    };
  }

  // ---------------------------------------------------------------- picking and what explore reads
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _ray = new THREE.Ray(), _inv = new THREE.Matrix4(), _tmp = [];
  let lastS = null;
  // the cell a ray (a THREE.Raycaster in world coordinates) points at, as drawn now (on the relief or flat), or null
  function pick(rc) {
    if (!set.group.visible || !lastS || clamp(lastS.map_split, 0, 1) > 0.3 || clamp(lastS.map_omics, 0, 2) > 0.3) return null;
    set.group.updateMatrixWorld();
    const Mw = inner.matrixWorld, s0 = Mw.getMaxScaleOnAxis(), ray = rc.ray, all = clamp(lastS.map_all, 0, 1), tol = 0.009 * s0;
    let best = -1, bt = Infinity;
    for (let i = 0; i < N; i++) {
      _v.set(X[i], hOf(i, all, 0), Z[i]).applyMatrix4(Mw);
      const d = _w.copy(_v).sub(ray.origin).dot(ray.direction);
      if (d > 0 && d < bt && ray.distanceSqToPoint(_v) < tol * tol) { bt = d; best = i; }
    }
    if (best < 0) {
      // (no bead under the ray: the cell nearest to where it meets the slide, within 30 µm)
      _inv.copy(Mw).invert();
      _ray.copy(ray).applyMatrix4(_inv);
      if (Math.abs(_ray.direction.y) > 1e-6) {
        const tt = (LIFT - _ray.origin.y) / _ray.direction.y;
        if (tt > 0) {
          _ray.at(tt, _v);
          let bd = 900;
          for (const i of near(_v.x / k + side / 2, _v.z / k + side / 2, 30, _tmp)) {
            const q = (W.x[i] - _v.x / k - side / 2) ** 2 + (W.y[i] - _v.z / k - side / 2) ** 2;
            if (q < bd) { bd = q; best = i; }
          }
        }
      }
    }
    return best < 0 ? null : { kind: 'cell', cell: best };
  }
  const API = {
    n: N, e: e.cell, drawR: e.drawR, eLogOdds: e.logOdds, limit50: SD.limit50, limit100: SD.limit100, delta: DELTA,
    comp50: SD.comp50, comp100: SD.comp100, types: W.types,
    // what explore shows of a cell: its place (µm), type, scores, the cells within 50 µm, its stored bars (null until
    // they are inflated, except for cell v), its group at 50 and 100 µm
    cell(i) {
      const nb = near(W.x[i], W.y[i], DELTA, []);
      const h0 = i === e.cell ? SD.eBars.h0 : W.localH0(i), h1 = i === e.cell ? SD.eBars.h1 : W.localH1(i);
      return { i, x: W.x[i], y: W.y[i], type: W.types[W.type[i]], lo50: i === e.cell ? e.logOdds : W.lo50[i], lo100: W.lo100[i], near: nb.length,
        h0, h1, group50: GROUP[0][i] ? 'cirrhosis-like' : 'healthy-like', group100: GROUP[1][i] ? 'cirrhosis-like' : 'healthy-like' };
    },
    // the counts at radius r for a cell's own bars (pieces: its deaths still alive plus the one living on; loops alive)
    counts(i, r) { const c = API.cell(i); return c.h0 ? { pieces: T.deaths(c.h0, r) + 1, loops: T.betti(c.h1 || [], r) } : null; },
    pos(i, out) { out = out || [0, 0, 0]; out[0] = now.wx + X[i]; out[1] = lastS ? hOf(i, clamp(lastS.map_all, 0, 1), clamp(lastS.map_split, 0, 1)) : LIFT; out[2] = Z[i]; return out; },
    pick,
  };
  return Object.assign(set, {
    params: { map_a: 1, map_cell: 1, map_r: 50, map_balls: 0, map_bars: 1, map_score: 1, map_all: 0, map_split: 0, map_omics: 0, map_pick: -1, map_delta: 0 },
    update(S, t) { lastS = S; update(S, t); }, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};
