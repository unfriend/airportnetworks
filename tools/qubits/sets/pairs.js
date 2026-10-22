// The pairs set of the qubits story: why look at pairs (genes, and the grid of all their pairs growing until it fills
// the view), the network drawn as a city map with two walkers (one per gene of a pair) wandering its streets and
// settling in the valleys (illustrative: the valleys stand for the data term V, which this story does not model), a
// tiny chip with three qubits, and the map folding into eight neighborhoods with three-digit codes (the cells of the
// example network's cut: QMATH, sets/qmath.js).
// The map is the story's example network (QMATH.DEFAULT) laid out flat (force-directed, seeded; its eight groups
// start on a ring in Gray-code order, so neighborhoods next to each other differ in one digit). Everything follows the
// params and t: the walkers' routes are planned at load and read off by time.
SETS.pairs = function (K) {
  const { THREE, clamp, lerp, prog, smooth, rgb } = K;
  const set = K.newSet('pairs');
  const Q = QMATH, LK = QLOOK(K, set), PI = Math.PI;
  const NMAX = 240, Y0 = -0.3;   // the most genes in the grid of pairs; the map's ground level
  const spOf = nn => Math.min(0.16, 2.1 / nn);   // the grid's spacing: it keeps to about the view's size

  // ---------------------------------------------------------------- genes and the grid of their pairs
  // gene i sits on the diagonal at (x_i, y_i); the pair (i, j), i < j, at (x_i, y_j): a triangle that fills in as genes
  // are added (n from 6 to 240), its spacing shrinking so it keeps to the view
  const NP = NMAX * (NMAX - 1) / 2;
  const triU = { uN: { value: 6 }, uSp: { value: 0.16 }, uPairA: { value: 0 }, uGeneA: { value: 0 } };
  const triV = `
uniform float uN, uSp;
vec2 cellXY(float i, float j) { float w = (uN - 1.0) * uSp; return vec2(-0.5 * w + i * uSp, -0.5 * w + j * uSp); }`;
  const triMat = (geneRow) => {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, triU),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: K.GLSL + triV + `
attribute vec2 aIJ; attribute float aSeed;
uniform float uA, uPairA, uGeneA;
varying vec3 vC; varying float vA;
void main() {
  float i = aIJ.x, j = aIJ.y;
  vec2 xy = cellXY(i, j);
  vec4 mv = modelViewMatrix * vec4(xy, ${geneRow ? '0.01' : '0.0'}, 1.0);
  gl_Position = projectionMatrix * mv;
  float show = clamp(uN - j, 0.0, 1.0);
  ${geneRow
    ? 'vC = vec3(0.75, 0.95, 1.0); vA = uA * uGeneA * show; gl_PointSize = pointPx(max(uSp * 0.75, 0.014), mv);'
    : 'float tw = 0.7 + 0.3 * sin(uTime * 2.0 + aSeed * 60.0); vC = mix(vec3(0.55, 0.5, 1.0), vec3(0.35, 0.85, 1.0), aSeed); vA = uA * uPairA * show * tw * mix(1.0, 0.55, smoothstep(30.0, 200.0, uN)); gl_PointSize = pointPx(max(uSp * 0.5, 0.006), mv);'}
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `varying vec3 vC; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float a = max(smoothstep(0.5, 0.2, d) * 0.9, pow(1.0 - d * 2.0, 1.5) * 0.5); gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.2, 0.0, d) * 0.4), vA * a); }`,
    });
    set.mats.push(m);
    return m;
  };
  {
    const r = K.rng(5), ij = new Float32Array(NP * 2), sd = new Float32Array(NP);
    let o = 0;
    for (let j = 1; j < NMAX; j++) for (let i = 0; i < j; i++) { ij[2 * o] = i; ij[2 * o + 1] = j; sd[o++] = r(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
    g.setAttribute('aIJ', new THREE.BufferAttribute(ij, 2)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    const gg = new THREE.BufferGeometry(), gij = new Float32Array(NMAX * 2);
    for (let i = 0; i < NMAX; i++) { gij[2 * i] = i; gij[2 * i + 1] = i; }
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NMAX * 3), 3));
    gg.setAttribute('aIJ', new THREE.BufferAttribute(gij, 2)); gg.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(NMAX), 1));
    const pp = new THREE.Points(g, triMat(false)), gp = new THREE.Points(gg, triMat(true));
    pp.frustumCulled = gp.frustumCulled = false;
    set.group.add(pp, gp);
  }

  // ---------------------------------------------------------------- the map
  const net = Q.network(Q.DEFAULT), A3 = Q.analyze(Q.DEFAULT, { L: 3 }), code = A3.code, n = net.n;
  const GRAY = [0, 1, 3, 2, 6, 7, 5, 4], ringOf = c => GRAY.indexOf(c);
  const hood = c => { const a = ringOf(c) / 8 * 2 * PI + PI / 8; return [0.66 * Math.cos(a), 0.66 * Math.sin(a)]; };
  const P = Q.layout(net, { dim: 2, iters: 50, seed: 9, init: g => { const h = hood(code[g]); return [h[0] * 0.8, h[1] * 0.8, 0]; } });
  const MP = new Float32Array(n * 2), FP = new Float32Array(n * 2);   // the map's places, and folded into the hoods
  const cen = [...Array(8)].map(() => [0, 0, 0]);
  for (let g = 0; g < n; g++) { MP[2 * g] = P[3 * g] * 1.02; MP[2 * g + 1] = P[3 * g + 1] * 1.02; const c = cen[code[g]]; c[0] += MP[2 * g]; c[1] += MP[2 * g + 1]; c[2]++; }
  for (let g = 0; g < n; g++) { const c = cen[code[g]], h = hood(code[g]); FP[2 * g] = h[0] + (MP[2 * g] - c[0] / c[2]) * 0.3; FP[2 * g + 1] = h[1] + (MP[2 * g + 1] - c[1] / c[2]) * 0.3; }
  // two valleys, on opposite sides of the map: around the best-linked gene of two cells far apart on the ring
  const best = c => { let b = -1; for (let g = 0; g < n; g++) if (code[g] === c && (b < 0 || net.deg[g] > net.deg[b])) b = g; return b; };
  const VG = [best(GRAY[1]), best(GRAY[5])], SIG = 0.17;
  const VC = VG.map(g => [MP[2 * g], MP[2 * g + 1]]);
  const mapU = { uDepth: { value: 0 }, uSig: { value: SIG }, uV0: { value: new THREE.Vector2(...VC[0]) }, uV1: { value: new THREE.Vector2(...VC[1]) },
    uFold: { value: 0 }, uMapA: { value: 0 }, uHood: { value: -1 }, uCol: { value: LK.CELL.map(c => new THREE.Color(...c)) } };
  const GROUND = `
uniform float uDepth, uSig, uFold, uMapA, uHood; uniform vec2 uV0, uV1; uniform vec3 uCol[8];
float well(vec2 p) { return exp(-dot(p - uV0, p - uV0) / (uSig * uSig)) + exp(-dot(p - uV1, p - uV1) / (uSig * uSig)); }
float ground(vec2 p) { return -uDepth * well(p); }`;
  const ground = (x, z) => { const D = mapU.uDepth.value, s2 = SIG * SIG; let w = 0; for (const v of VC) w += Math.exp(-((x - v[0]) ** 2 + (z - v[1]) ** 2) / s2); return Y0 - D * w; };
  const mapG = new THREE.Group(); mapG.position.y = Y0; set.group.add(mapG);
  // the ground: a disc of city blocks; the valleys dip and glow
  {
    const geo = new THREE.PlaneGeometry(2.7, 2.7, 96, 96); geo.rotateX(-PI / 2);
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA }, mapU), transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: GROUND + `
varying vec2 vP; varying float vW;
void main() { vP = position.xz; vW = well(vP); vec3 p = vec3(position.x, ground(vP), position.z); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uA, uMapA, uDepth; varying vec2 vP; varying float vW;
void main() {
  float r = length(vP), edge = 1.0 - smoothstep(1.05, 1.3, r);
  vec2 g = abs(fract(vP * 9.0) - 0.5); float block = smoothstep(0.44, 0.5, max(g.x, g.y));
  vec3 col = mix(vec3(0.035, 0.05, 0.09), vec3(0.09, 0.12, 0.2), block * 0.6);
  float glow = clamp(vW, 0.0, 1.0) * clamp(uDepth * 9.0, 0.0, 1.0);
  col += vec3(1.0, 0.62, 0.18) * glow * 0.75;
  gl_FragColor = vec4(col, uA * uMapA * edge * (0.85 + 0.15 * glow));
}`,
    });
    set.mats.push(m);
    const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = -1;
    mapG.add(mesh);
  }
  // streets and street lights (the links and the genes), on the ground, folding into the neighborhoods
  const streetV = `
attribute vec2 aMap, aFoldP; attribute float aCode;
vec3 placeOf() { vec2 p = mix(aMap, aFoldP, smoothstep(0.0, 1.0, uFold)); return vec3(p.x, ground(p) + 0.006, p.y); }`;
  {
    const m = net.m, a = new Float32Array(m * 4), f = new Float32Array(m * 4), c = new Float32Array(m * 2), o = new Float32Array(m * 2);
    for (let e = 0; e < m; e++) {
      const i = net.edges[2 * e], j = net.edges[2 * e + 1];
      a.set([MP[2 * i], MP[2 * i + 1], MP[2 * j], MP[2 * j + 1]], 4 * e); f.set([FP[2 * i], FP[2 * i + 1], FP[2 * j], FP[2 * j + 1]], 4 * e);
      c[2 * e] = code[i]; c[2 * e + 1] = code[j]; o[2 * e] = code[j]; o[2 * e + 1] = code[i];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m * 6), 3));
    g.setAttribute('aMap', new THREE.BufferAttribute(a, 2)); g.setAttribute('aFoldP', new THREE.BufferAttribute(f, 2));
    g.setAttribute('aCode', new THREE.BufferAttribute(c, 1)); g.setAttribute('aOther', new THREE.BufferAttribute(o, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA }, mapU), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: GROUND + streetV + `
attribute float aOther; uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec3 p = placeOf(); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  float same = 1.0 - step(0.5, abs(aCode - aOther)), w = clamp(well(p.xz), 0.0, 1.0) * clamp(uDepth * 9.0, 0.0, 1.0);
  vec3 c = mix(vec3(0.45, 0.5, 0.75), uCol[int(aCode + 0.5)], uFold * same);
  float hi = uHood < 0.0 ? 1.0 : (abs(aCode - uHood) < 0.5 && same > 0.5 ? 1.6 : 0.35);
  vC = mix(c, vec3(1.0, 0.7, 0.3), w * 0.8);
  vA = uA * uMapA * (0.07 + 0.08 * w) * (1.0 - 0.6 * uFold * (1.0 - same)) * hi;
}`,
      fragmentShader: 'varying vec3 vC; varying float vA; void main() { if (vA < 0.003) discard; gl_FragColor = vec4(vC, vA); }',
    });
    set.mats.push(mat);
    const ls = new THREE.LineSegments(g, mat); ls.frustumCulled = false; mapG.add(ls);
  }
  {
    const g = new THREE.BufferGeometry(), a = new Float32Array(n * 2), f = new Float32Array(n * 2), c = new Float32Array(n), sd = new Float32Array(n), r = K.rng(8);
    for (let i = 0; i < n; i++) { a[2 * i] = MP[2 * i]; a[2 * i + 1] = MP[2 * i + 1]; f[2 * i] = FP[2 * i]; f[2 * i + 1] = FP[2 * i + 1]; c[i] = code[i]; sd[i] = r(); }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aMap', new THREE.BufferAttribute(a, 2)); g.setAttribute('aFoldP', new THREE.BufferAttribute(f, 2));
    g.setAttribute('aCode', new THREE.BufferAttribute(c, 1)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, mapU), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: K.GLSL + GROUND + streetV + `
attribute float aSeed; uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec3 p = placeOf() + vec3(0.0, 0.012, 0.0); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  float w = clamp(well(p.xz), 0.0, 1.0) * clamp(uDepth * 9.0, 0.0, 1.0), hi = uHood < 0.0 ? 1.0 : (abs(aCode - uHood) < 0.5 ? 1.5 : 0.3);
  vC = mix(mix(vec3(0.8, 0.85, 1.0), uCol[int(aCode + 0.5)], uFold), vec3(1.0, 0.75, 0.35), w);
  vA = uA * uMapA * (0.75 + 0.25 * sin(uTime * 1.7 + aSeed * 50.0)) * hi;
  gl_PointSize = pointPx(0.022 + 0.01 * w, mv);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `varying vec3 vC; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float a = max(smoothstep(0.5, 0.2, d) * 0.9, pow(1.0 - d * 2.0, 1.5) * 0.5); gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.2, 0.0, d) * 0.4), vA * a); }`,
    });
    set.mats.push(mat);
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; mapG.add(pts);
  }

  // ---------------------------------------------------------------- the walkers: routes planned at load, read off by t
  const nbrs = g => Array.from(net.adj.subarray(net.off[g], net.off[g + 1]));
  function route(start, len, seed, inside) {
    const r = K.rng(seed), path = [start];
    for (let s = 1; s < len; s++) {
      const cur = path[s - 1], opts = nbrs(cur).filter(j => !inside || inside(j));
      path.push(opts.length ? opts[Math.floor(r() * opts.length)] : cur);
    }
    return path;
  }
  const inValley = v => g => Math.hypot(MP[2 * g] - VC[v][0], MP[2 * g + 1] - VC[v][1]) < SIG * 0.9;
  const startOf = c => { let b = 0; for (let g = 0; g < n; g++) if (code[g] === c) { b = g; break; } return b; };
  const W = [0, 1].map(w => ({ wander: route(startOf(GRAY[w ? 3 : 7]), 500, 101 + w), settled: route(VG[w], 300, 201 + w, inValley(w)) }));
  const SPEED = 1.15;
  const placeG = (g, fold) => { const x = lerp(MP[2 * g], FP[2 * g], fold), z = lerp(MP[2 * g + 1], FP[2 * g + 1], fold); return [x, ground(x, z), z]; };
  function along(path, t, fold) {
    const s = Math.max(0, t) * SPEED, i = Math.floor(s) % (path.length - 1), f = smooth(clamp((s - Math.floor(s)) * 1.4, 0, 1));
    const a = placeG(path[i], fold), b = placeG(path[i + 1], fold);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
  }
  const walkerAt = (w, t, settle, fold) => {
    const a = along(W[w].wander, t + w * 7.3, fold), b = along(W[w].settled, t * 0.6 + w * 3.1, fold), e = smooth(settle);
    const p = [lerp(a[0], b[0], e), 0, lerp(a[2], b[2], e)];
    p[1] = ground(p[0], p[2]) + 0.04;
    return p;
  };

  // ---------------------------------------------------------------- the chip: three qubits
  const CHIP = [1.32, -0.08, 0.36];
  const chip = new THREE.Group(); chip.position.set(...CHIP); chip.rotation.set(0.55, -0.35, 0); chip.scale.setScalar(1.35); set.group.add(chip);
  {
    const mk = (geo, col, o = {}) => { const m = K.fade(set, new THREE.MeshStandardMaterial(Object.assign({ color: col, metalness: 0.3, roughness: 0.55 }, o))); return new THREE.Mesh(geo, m); };
    chip.add(mk(new THREE.BoxGeometry(0.46, 0.035, 0.46), '#161d2c'));
    const die = mk(new THREE.BoxGeometry(0.32, 0.014, 0.32), '#2a3552', { metalness: 0.5, roughness: 0.35 }); die.position.y = 0.024; chip.add(die);
    const pads = [];
    for (let s = 0; s < 4; s++) for (let k = 0; k < 6; k++) {
      const u = -0.16 + k * 0.064, p = [[u, 0.2], [u, -0.2], [0.2, u], [-0.2, u]][s];
      const b = new THREE.BoxGeometry(0.036, 0.008, 0.036); b.translate(p[0], 0.021, p[1]); pads.push(b);
    }
    chip.add(mk(K.merge(pads), '#d9b45a', { metalness: 0.85, roughness: 0.3 }));
    const crosses = [];
    for (let q = 0; q < 3; q++) {
      const x = 0.09 - q * 0.09;   // q2 left, q0 right, as a code's digits read
      const a = new THREE.BoxGeometry(0.075, 0.007, 0.02), b = new THREE.BoxGeometry(0.02, 0.007, 0.075);
      a.translate(x, 0.034, 0); b.translate(x, 0.034, 0); crosses.push(a, b);
      const c = new THREE.BoxGeometry(0.05, 0.004, 0.008); c.translate(x - 0.045, 0.033, 0); if (q < 2) crosses.push(c);
    }
    chip.add(mk(K.merge(crosses), '#c9d2ff', { metalness: 0.6, roughness: 0.25, emissive: '#3a3f8a' }));
  }
  const qubitAt = q => { const v = new THREE.Vector3(0.09 - q * 0.09, 0.05, 0).multiplyScalar(1.35); v.applyEuler(chip.rotation).add(chip.position); return [v.x, v.y, v.z]; };

  // ---------------------------------------------------------------- the frame's moving parts (instanced, refilled)
  const balls = LK.balls(16), halos = LK.halos(80), tubes = LK.tubes(80), rings = LK.rings(16);
  set.group.add(balls.mesh, halos.mesh, tubes.mesh, rings.mesh);
  const WCOL = [rgb('#ff5ad9'), rgb('#46d9ff')];
  const now = { walkers: [[0, 0, 0], [0, 0, 0]], n: 6, code: -1 };
  function update(S, t) {
    LK.depth();
    const genes = clamp(S.pairs_genes, 0, 1), grid = clamp(S.pairs_grid, 0, 1), map = clamp(S.pairs_map, 0, 1);
    const tri = genes * (1 - map);
    const nn = 6 * Math.pow(NMAX / 6, grid);
    now.n = nn;
    triU.uN.value = nn; triU.uSp.value = spOf(nn);
    triU.uGeneA.value = tri; triU.uPairA.value = tri * prog(grid, 0, 0.04);
    const fold = smooth(clamp(S.pairs_fold, 0, 1)), valley = clamp(S.pairs_valley, 0, 1), hoodK = Math.round(clamp(S.pairs_code, 0, 8)) - 1;
    now.code = hoodK;
    mapU.uMapA.value = map; mapU.uFold.value = fold; mapU.uDepth.value = 0.11 * valley; mapU.uHood.value = hoodK >= 0 ? hoodK : -1;
    mapG.visible = map > 0.003;
    balls.begin(); halos.begin(); tubes.begin(); rings.begin();
    // the walkers and their trails; the pair they settle on joined by an arc
    const walk = clamp(S.pairs_walk, 0, 1) * map, settle = clamp(S.pairs_settle, 0, 1);
    if (walk > 0.003) {
      for (let w = 0; w < 2; w++) {
        const p = walkerAt(w, t, settle, fold);
        now.walkers[w] = p;
        balls.add(p, 0.03, WCOL[w], walk);
        halos.add(p, 0.16, WCOL[w], 0.7 * walk);
        for (let j = 1; j <= 10; j++) halos.add(walkerAt(w, t - j * 0.07, settle, fold), 0.06 * (1 - j / 12), WCOL[w], 0.35 * walk * (1 - j / 11));
      }
      const arc = walk * prog(settle, 0.6, 1);
      if (arc > 0.01) {
        const a = now.walkers[0], b = now.walkers[1], pts = [];
        for (let j = 0; j <= 16; j++) { const u = j / 16; pts.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) + Math.sin(u * PI) * 0.45, lerp(a[2], b[2], u)]); }
        for (let j = 0; j < 16; j++) tubes.add(pts[j], pts[j + 1], 0.008, LK.AMBER, arc, 0);
        halos.add(pts[8], 0.22, LK.AMBER, 0.5 * arc);
      }
    }
    // the neighborhoods: a ring around each, in its cell's color; one picked lights up and its code shows on the chip
    const chipA = clamp(S.pairs_chip, 0, 1);
    if (fold > 0.01 && map > 0.01) for (let c = 0; c < 8; c++) {
      const h = hood(c), on = hoodK < 0 ? 1 : c === hoodK ? 1.4 : 0.35;
      rings.add([h[0], ground(h[0], h[1]) + 0.01, h[1]], [0, 1, 0], 0.16 * (c === hoodK ? 1.12 : 1), 0.006, LK.mix(LK.CELL[c], [1, 1, 1], c === hoodK ? 0.3 : 0), map * fold * Math.min(1, on), 0);
      if (c === hoodK) halos.add([h[0], ground(h[0], h[1]) + 0.03, h[1]], 0.5, LK.CELL[c], 0.35 * map * fold);
    }
    if (chipA > 0.01) {
      for (let q = 0; q < 3; q++) {
        const bit = hoodK >= 0 ? (hoodK >> q) & 1 : 0.5 + 0.5 * Math.sin(t * 2.2 + q * 2.1), p = qubitAt(q);
        halos.add(p, 0.09 + 0.06 * bit, LK.mix([0.5, 0.55, 1], [0.6, 1, 1], bit), chipA * (0.25 + 0.75 * bit));
        balls.add(p, 0.012, LK.mix([0.4, 0.45, 0.8], [0.85, 1, 1], bit), chipA);
      }
      if (hoodK >= 0 && fold > 0.5) {
        const a = qubitAt(1), h = hood(hoodK), b = [h[0], ground(h[0], h[1]) + 0.04, h[1]], pts = [];
        for (let j = 0; j <= 14; j++) { const u = j / 14; pts.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) + Math.sin(u * PI) * 0.3, lerp(a[2], b[2], u)]); }
        for (let j = 0; j < 14; j++) tubes.add(pts[j], pts[j + 1], 0.004, LK.CELL[hoodK], chipA * map * 0.8, 0);
      }
    }
    balls.end(); halos.end(); tubes.end(); rings.end();
    chip.visible = chipA > 0.003;
    chip.children.forEach(m => { if (m.material) m.material.opacity = m.material.userData.base * set.uA.value * chipA; });
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const codeStr = c => c.toString(2).padStart(3, '0');
  const anchors = {
    tri: [0, 0, 0], genes0: () => { const w = (now.n - 1) * spOf(now.n); return [-0.5 * w, -0.5 * w, 0]; },
    corner: () => { const w = (Math.min(now.n, 12) - 1) * spOf(now.n); return [-0.5 * w - 0.12, 0.5 * w + 0.16, 0]; },
    map: [0, Y0, 0], walker0: () => now.walkers[0], walker1: () => now.walkers[1],
    valley0: [VC[0][0], Y0 - 0.05, VC[0][1]], valley1: [VC[1][0], Y0 - 0.05, VC[1][1]],
    chip: CHIP, q2: () => qubitAt(2), q1: () => qubitAt(1), q0: () => qubitAt(0),
  };
  for (let c = 0; c < 8; c++) anchors['hood' + c] = (() => { const h = hood(c); return [h[0] + 0.12, Y0 + 0.06, h[1]]; })();
  const fmtN = v => Math.round(v).toLocaleString('en-US');
  const labels = [
    { text: () => { const g = Math.round(now.n); return [`${fmtN(g)} genes`, ` · ${fmtN(g * (g - 1) / 2)} pairs`]; }, at: 'corner', cls: 'cyn', alpha: S => clamp(S.pairs_genes, 0, 1) * (1 - clamp(S.pairs_map, 0, 1)) },
    { text: ['Walker 1', ''], at: 'walker0', cls: 'mag', minor: true, alpha: S => clamp(S.pairs_walk, 0, 1) * clamp(S.pairs_map, 0, 1) * (1 - prog(S.pairs_settle, 0.5, 1)) * (1 - clamp(S.pairs_fold, 0, 1)) },
    { text: ['Walker 2', ''], at: 'walker1', cls: 'cyn', minor: true, alpha: S => clamp(S.pairs_walk, 0, 1) * clamp(S.pairs_map, 0, 1) * (1 - prog(S.pairs_settle, 0.5, 1)) * (1 - clamp(S.pairs_fold, 0, 1)) },
    { text: ['Valley', ' · illustrative'], at: 'valley0', cls: 'amb', alpha: S => prog(S.pairs_valley, 0.5, 1) * clamp(S.pairs_map, 0, 1) * (1 - clamp(S.pairs_fold, 0, 1)) },
    // (with a neighborhood picked, the chip's label reads its code: the three qubits' states)
    { text: () => ['Three qubits', now.code >= 0 ? ' · ' + codeStr(now.code) : ''], at: 'chip', cls: '', alpha: S => prog(S.pairs_chip, 0.5, 1) },
  ];
  for (let c = 0; c < 8; c++) labels.push({ text: [codeStr(c), ''], at: 'hood' + c, cls: 'cyn', alpha: S => {
    const k = Math.round(clamp(S.pairs_code, 0, 8)) - 1;
    return prog(S.pairs_fold, 0.6, 1) * clamp(S.pairs_map, 0, 1) * (k < 0 || k === c ? 1 : 0.45);
  } });
  const cam = {
    default: [18, 46, 3.6, 0.15, -0.3, 0],
    grid: [0, 3, 3.5, 0, 0, 0],
    map: [18, 46, 3.4, 0, -0.3, 0],
    walkers: [24, 34, 2.6, 0, -0.3, 0],
    chip: [-12, 34, 3.7, 0.45, -0.25, 0.1],
    hoods: [6, 58, 3.9, 0.35, -0.3, 0.05],
  };
  const controls = [{ key: 'view', label: 'View', options: [['pairs', 'Pairs'], ['map', 'Map'], ['walkers', 'Walkers'], ['hoods', 'Neighborhoods']] }];
  function explore(c) {
    const v = c.view || 'pairs', m = v === 'pairs' ? 0 : 1;
    return {
      pairs_genes: 1, pairs_grid: v === 'pairs' ? 1 : 0, pairs_map: m, pairs_walk: v === 'walkers' ? 1 : 0, pairs_valley: v === 'walkers' ? 1 : 0,
      pairs_settle: v === 'walkers' ? clamp((c.t - 4) / 4, 0, 1) : 0, pairs_chip: v === 'hoods' ? 1 : 0, pairs_fold: v === 'hoods' ? 1 : 0,
      // (the neighborhoods take turns: each one's code on the chip's three qubits)
      pairs_code: v === 'hoods' ? 1 + Math.floor((c.t || 0) / 1.6) % 8 : 0,
    };
  }
  const API = { genes: n, links: net.m, codes: [...Array(8).keys()].map(codeStr), hood: c => hood(c), nmax: NMAX };
  return Object.assign(set, {
    params: { pairs_a: 1, pairs_genes: 1, pairs_grid: 0, pairs_map: 1, pairs_walk: 1, pairs_valley: 1, pairs_settle: 0, pairs_chip: 0, pairs_fold: 0, pairs_code: 0 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};
