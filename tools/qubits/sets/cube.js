// The cube set of the qubits story: an example network cut in two, in four and in eight (each cut one digit of a
// gene's code; the cells at the corners of a cube), the coarse operator A_c on the cube (a loop at each corner, purple
// edges as wide as the coupling), Pauli strings as small cubes in a gallery with their weights, added one by one into
// the big cube while the error left shrinks, and the toolbox: the strings inside an algebra stay bright, the rest go
// gray and are dropped (the residual). Everything is computed live by QMATH (sets/qmath.js) from the example networks;
// nothing here is the real network's.
// Axes as in the reference figure: the first cut (the top bit) is left (0) / right (1), the second front (0) / back
// (1), the third top (0) / bottom (1); so X on the top qubit hops left-right, Z on it is +1 on the left, -1 on the right.
// Signs: solid +, dashed -; corners red for +1, blue for -1 where a string puts a loop there.
// The gene-level network moves in its shaders (positions from the params); the cube, the strings and the gallery are
// refilled every frame from the params (a few hundred instances). Only the switch of network, cut, bits, algebra or
// focused string eases in its own time (0.35 s; a seek or the first frame shows the new one at once).
SETS.cube = function (K) {
  const { THREE, clamp, lerp, prog, smooth, rgb } = K;
  const set = K.newSet('cube');
  const Q = QMATH, LK = QLOOK(K, set);
  const NETS = Q.NETS, DEF = Math.max(0, NETS.findIndex(s => s.key === Q.DEFAULT));
  const H = 0.5, NB = 10, PI = Math.PI;
  const CUTS = ['found', 'random'], ALGS = ['tfim', 'odd'];
  // the corner of an L-bit code (h: half the cube's size)
  const corner = (c, L, h = H) => {
    const p = [0, 0, 0];
    for (let j = 0; j < L; j++) { const b = c >> (L - 1 - j) & 1; if (j === 0) p[0] = b ? h : -h; else if (j === 1) p[2] = b ? -h : h; else p[1] = b ? -h : h; }
    return p;
  };
  const codeStr = (c, L) => c.toString(2).padStart(L, '0');
  const cellCol = (c, L) => LK.CELL[c << (3 - L)];

  // ---------------------------------------------------------------- the gene-level network (one per example network,
  // built on first use or between frames)
  const GLSL = `
uniform float uBits, uGather, uH, uCut;
uniform vec3 uM0, uM1[2], uM2[4], uM3[8], uCol[8];
float bitOf(float c, float q) { return mod(floor(c / pow(2.0, q) + 0.001), 2.0); }
vec3 phases() { return vec3(smoothstep(0.0, 1.0, clamp(uBits, 0.0, 1.0)), smoothstep(0.0, 1.0, clamp(uBits - 1.0, 0.0, 1.0)), smoothstep(0.0, 1.0, clamp(uBits - 2.0, 0.0, 1.0))); }
vec3 movePos(vec3 p0, float c) {
  vec3 f = phases();
  float b2 = bitOf(c, 2.0), b1 = bitOf(c, 1.0), b0 = bitOf(c, 0.0);
  vec3 off = vec3((b2 > 0.5 ? 1.0 : -1.0) * f.x, (b0 > 0.5 ? -1.0 : 1.0) * f.z, (b1 > 0.5 ? -1.0 : 1.0) * f.y) * uH;
  vec3 m = mix(mix(mix(uM0, uM1[int(b2)], f.x), uM2[int(b2 * 2.0 + b1)], f.y), uM3[int(c + 0.5)], f.z);
  float s = mix(mix(mix(1.0, 0.55, f.x), 0.42, f.y), 0.32, f.z);
  return mix(off + (p0 - m) * s, off, uGather);
}
vec3 colOf(float c) {
  vec3 f = phases(), n = vec3(0.6, 0.58, 1.0);
  float b2 = bitOf(c, 2.0), b1 = bitOf(c, 1.0);
  return mix(mix(mix(n, uCol[int(b2 * 4.0)], f.x), uCol[int(b2 * 4.0 + b1 * 2.0)], f.y), uCol[int(c + 0.5)], f.z);
}`;
  const U = {
    uBits: { value: 0 }, uGather: { value: 0 }, uH: { value: H }, uCut: { value: 0 }, uLinkA: { value: 0.2 }, uGeneA: { value: 1 },
    uM0: { value: new THREE.Vector3() }, uM1: { value: [0, 1].map(() => new THREE.Vector3()) },
    uM2: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) }, uM3: { value: [...Array(8)].map(() => new THREE.Vector3()) },
    uCol: { value: LK.CELL.map(c => new THREE.Color(...c)) },
  };
  const geneMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + GLSL + `
attribute float aCode, aCodeR, aSeed;
uniform float uA, uGeneA;
varying vec3 vC; varying float vA;
void main() {
  float c = uCut > 0.5 ? aCodeR : aCode;
  vec4 mv = modelViewMatrix * vec4(movePos(position, c), 1.0);
  vC = colOf(c); vA = uA * uGeneA * (1.0 - smoothstep(0.6, 1.0, uGather)) * (0.75 + 0.25 * sin(uTime * 1.3 + aSeed * 40.0));
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(0.03 * (1.0 - 0.4 * uGather), mv);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
varying vec3 vC; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float a = max(smoothstep(0.5, 0.2, d) * 0.9, pow(1.0 - d * 2.0, 1.5) * 0.5);
  gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.2, 0.0, d) * 0.4), vA * a);
}`,
  });
  set.mats.push(geneMat);
  const linkMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, U),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL + `
attribute float aCode, aCodeR, aOther, aOtherR;
uniform float uA, uLinkA;
varying vec3 vC; varying float vA;
void main() {
  float c = uCut > 0.5 ? aCodeR : aCode, o = uCut > 0.5 ? aOtherR : aOther;
  vec4 mv = modelViewMatrix * vec4(movePos(position, c), 1.0);
  gl_Position = projectionMatrix * mv;
  // a link across the cut being made flashes amber; links between cells dim once cut, links inside a cell take its color
  float flash = 0.0, across = 0.0;
  for (int k = 0; k < 3; k++) {
    float q = 2.0 - float(k), ph = clamp(uBits - float(k), 0.0, 1.0), diff = abs(bitOf(c, q) - bitOf(o, q));
    flash = max(flash, diff * sin(ph * 3.14159));
    across = max(across, diff * smoothstep(0.0, 1.0, ph));
  }
  vec3 base = mix(colOf(c), vec3(0.55, 0.55, 0.85), across);
  vC = mix(base, vec3(1.0, 0.72, 0.25), flash);
  vA = uA * uLinkA * (1.0 - 0.7 * across + 2.5 * flash) * (1.0 - smoothstep(0.3, 0.8, uGather));
}`,
    fragmentShader: `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(vC, vA); }`,
  });
  set.mats.push(linkMat);
  const NET = [];   // per network index: { built, an (found, random: 3-bit analyses), M: centroids per cut, pts, lns }
  const geneGroup = new THREE.Group();
  set.group.add(geneGroup);
  function buildNet(i) {
    if (NET[i]) return NET[i];
    const s = NETS[i], net = Q.network(s.key), n = net.n;
    const an = { found: Q.analyze(s.key, { L: 3, cut: 'found' }), random: Q.analyze(s.key, { L: 3, cut: 'random' }) };
    // the layout: force-directed in 3D, started from a loose ball (seeded)
    const P = Q.layout(net, { dim: 3, iters: 45, seed: 7 + i });
    for (let j = 0; j < P.length; j++) P[j] *= 0.78;
    // the centroids of each group at each level, per cut
    const M = {};
    for (const how of CUTS) {
      const code = an[how].code, acc = [[0, 0, 0, 0]], lv = [2, 4, 8].map(k => [...Array(k)].map(() => [0, 0, 0, 0]));
      for (let g = 0; g < n; g++) {
        const c = code[g], p = [P[3 * g], P[3 * g + 1], P[3 * g + 2]];
        const add = a => { a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; };
        add(acc[0]); add(lv[0][c >> 2]); add(lv[1][c >> 1]); add(lv[2][c]);
      }
      const mean = a => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : [0, 0, 0]);
      M[how] = { m0: mean(acc[0]), m1: lv[0].map(mean), m2: lv[1].map(mean), m3: lv[2].map(mean) };
    }
    const r = K.rng(31 + i), cf = an.found.code, cr = an.random.code;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(P), 3));
    pg.setAttribute('aCode', new THREE.BufferAttribute(Float32Array.from(cf), 1));
    pg.setAttribute('aCodeR', new THREE.BufferAttribute(Float32Array.from(cr), 1));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(Float32Array.from({ length: n }, () => r()), 1));
    const pts = new THREE.Points(pg, geneMat);
    const m = net.m, lp = new Float32Array(m * 6), a1 = new Float32Array(m * 2), a2 = new Float32Array(m * 2), o1 = new Float32Array(m * 2), o2 = new Float32Array(m * 2);
    for (let e = 0; e < m; e++) {
      const a = net.edges[2 * e], b = net.edges[2 * e + 1];
      lp.set([P[3 * a], P[3 * a + 1], P[3 * a + 2], P[3 * b], P[3 * b + 1], P[3 * b + 2]], 6 * e);
      a1[2 * e] = cf[a]; a1[2 * e + 1] = cf[b]; o1[2 * e] = cf[b]; o1[2 * e + 1] = cf[a];
      a2[2 * e] = cr[a]; a2[2 * e + 1] = cr[b]; o2[2 * e] = cr[b]; o2[2 * e + 1] = cr[a];
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lg.setAttribute('aCode', new THREE.BufferAttribute(a1, 1)); lg.setAttribute('aCodeR', new THREE.BufferAttribute(a2, 1));
    lg.setAttribute('aOther', new THREE.BufferAttribute(o1, 1)); lg.setAttribute('aOtherR', new THREE.BufferAttribute(o2, 1));
    const lns = new THREE.LineSegments(lg, linkMat);
    pts.frustumCulled = lns.frustumCulled = false;
    pts.visible = lns.visible = false;
    geneGroup.add(lns, pts);
    return (NET[i] = { an, M, pts, lns, m, linkA: Math.min(0.09, 0.09 * 4000 / m) });
  }
  buildNet(DEF);

  // ---------------------------------------------------------------- the cut planes (a glowing sheet at each cut)
  const planeMat = () => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uK: { value: 0 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uA, uK; varying vec2 vUv;
void main() {
  vec2 e = min(vUv, 1.0 - vUv); float edge = smoothstep(0.03, 0.0, min(e.x, e.y));
  vec2 g = abs(fract(vUv * 10.0) - 0.5); float grid = smoothstep(0.47, 0.5, max(g.x, g.y));
  gl_FragColor = vec4(vec3(0.75, 0.7, 1.0), uA * uK * (0.025 + 0.5 * edge + 0.1 * grid));
}`,
    });
    set.mats.push(m);
    return m;
  };
  const planes = [0, 1, 2].map(k => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), planeMat());
    if (k === 0) m.rotation.y = PI / 2; else if (k === 2) m.rotation.x = PI / 2;
    set.group.add(m);
    return m;
  });

  // ---------------------------------------------------------------- the cube, the strings and the gallery
  const tubes = LK.tubes(460), rings = LK.rings(150), balls = LK.balls(150), halos = LK.halos(60);
  set.group.add(tubes.mesh, rings.mesh, balls.mesh, halos.mesh);
  const up = [0, 1, 0], fwd = [0, 0, 1];
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const add3 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  // a corner's loop: a ring just outside the corner, standing in the plane of the outward direction
  function loop(p, cen, scale, v, col, alpha) {
    if (Math.abs(v) < 0.015 || alpha < 0.01) return;
    const o = norm([p[0] - cen[0], p[1] - cen[1], p[2] - cen[2]]);
    let ax = cross(o, up); if (Math.hypot(...ax) < 0.3) ax = cross(o, fwd);
    const a = Math.min(1, Math.abs(v)), R = (0.03 + 0.06 * a) * scale, r = (0.004 + 0.007 * a) * scale;
    rings.add(add3(p, o, R + 0.02 * scale), norm(ax), R, r, col, alpha * clamp(Math.abs(v) * 6, 0, 1), v < 0 ? 12 : 0);
  }
  function edge(a, b, scale, v, col, alpha, ghost) {
    const w = Math.min(1, Math.abs(v));
    if (w < 0.012 || alpha < 0.01) return;
    const r = ghost ? (0.0035 + 0.006 * w) * scale : (0.004 + 0.022 * w) * scale, len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    tubes.add(a, b, r, col, alpha * clamp(w * 8, 0, 1), v < 0 ? len / (0.05 * scale) : 0);
  }
  // the cube's frame: thin gray edges and corner dots
  function frame(cen, h, L, alpha, dot) {
    const N = 1 << L, P = [];
    for (let c = 0; c < N; c++) P.push(add3(cen, corner(c, L, h)));
    for (let a = 0; a < N; a++) for (let q = 0; q < L; q++) { const b = a ^ (1 << q); if (b > a) tubes.add(P[a], P[b], 0.0028 * h / 0.12, LK.GRAY, alpha * 0.8, 0); }
    if (dot) for (let c = 0; c < N; c++) balls.add(P[c], dot, [0.75, 0.73, 0.95], alpha);
    return P;
  }
  // one Pauli string drawn on a cube centered at cen (half size h): hops as tubes, loops as rings, signs solid/dashed
  function drawString(k, L, cen, h, alpha, gray, bright) {
    const N = 1 << L, P = frame(cen, h, L, alpha * 0.8, 0.012 * h / 0.12), sc = h / H;
    const col = LK.mix(LK.PURPLE, LK.GRAY, gray), x = k >> L;
    for (let c = 0; c < N; c++) {
      if (x === 0) {
        const v = Q.entry(k, L, c, c)[0];
        loop(P[c], cen, sc * 1.25, v, col, alpha);
        balls.add(P[c], 0.022 * sc * 1.4, LK.mix(v > 0 ? LK.RED : LK.BLUE, LK.GRAY, gray), alpha);
      } else {
        const d = c ^ x;
        if (d > c) edge(P[c], P[d], sc * 1.1, Q.entry(k, L, d, c)[0], col, alpha);
      }
    }
    if (bright > 0.01) halos.add(cen, h * 3.2, LK.PURPLE, 0.35 * bright * alpha);
  }

  // ---------------------------------------------------------------- what to show: the analysis and its matrices
  const anOf = (ni, ci, L) => { buildNet(ni); return Q.analyze(NETS[ni].key, { L, cut: CUTS[ci] }); };
  // (kept matrices per analysis and algebra: the trace part and the strings inside)
  const keptCache = {};
  function kept(A, ai) {
    const id = `${A.net}:${A.cut}:${A.L}:${ai}`;
    if (!keptCache[id]) { const alg = Q.algebra(ALGS[ai], A.L); keptCache[id] = Q.fromPauli(A.c, A.L, [0, ...alg.basis.filter(k => k)]).re; }
    return keptCache[id];
  }
  const cur = { id: '', D: new Float64Array(64), G: new Float64Array(64), focus: -1, fa: 0, L: 3, first: true };
  function targets(S, A, L) {
    const N = 1 << L, D = new Float64Array(N * N), G = new Float64Array(N * N), ai = Math.round(clamp(S.cube_algebra, 0, 1));
    let vmax = 1e-9, dmax = 1e-9;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = A.Ac[i * N + j]; if (i === j) dmax = Math.max(dmax, Math.abs(v)); else vmax = Math.max(vmax, Math.abs(v)); }
    // the rebuilt sum: the first strings of the order, each as far as it has arrived
    const build = clamp(S.cube_build, 0, 1), sum = clamp(S.cube_sum, 0, NB), keep = clamp(S.cube_keep, 0, 1);
    const R = new Float64Array(N * N);
    if (build > 0) A.order.slice(0, NB).forEach((k, j) => {
      const w = smooth(clamp(sum - j, 0, 1));
      if (w <= 0) return;
      for (let c = 0; c < N; c++) { const x = k >> L, d = c ^ x; R[d * N + c] += w * A.c.re[k] * Q.entry(k, L, d, c)[0]; }
    });
    const Kp = keep > 0 ? kept(A, ai) : null;
    for (let i = 0; i < N * N; i++) {
      let v = lerp(A.Ac[i], R[i], build);
      if (Kp) v = lerp(v, Kp[i], keep);
      const diag = Math.floor(i / N) === i % N;
      D[i] = v / (diag ? dmax : vmax);
      G[i] = A.Ac[i] / (diag ? dmax : vmax);
    }
    return { D, G };
  }

  // ---------------------------------------------------------------- update
  const anchorsNow = { cube: [0, 0, 0], sc: 1, slots: [], gauge: [0, -0.8, 0] };
  const HB = 0.17;   // a brick's half size
  const slotPos = s => { const col = s % 5, row = s < 5 ? 0 : 1; return [col * 0.56, row ? -0.46 : 0.4, -0.2 * ((col - 2) / 2) ** 2]; };
  for (let s = 0; s < NB; s++) anchorsNow.slots.push(slotPos(s));
  let curA = null, curL = 3, curAlg = 1, curList = [], curLesson = false;
  // the lesson: the reference figure's top row, the strings' kinds one by one (no weights)
  const LESSON = ['I', 'X0', 'X1', 'X2', 'Z2', 'Z2X1', 'X2X1', 'Y2Y1'];
  const lessonOf = L => LESSON.filter(nm => !/\d/.test(nm) || Math.max(...nm.match(/\d/g).map(Number)) < L).map(nm => Q.parse(nm, L));
  function update(S, t, dt) {
    LK.depth();
    const ni = clamp(Math.round(S.cube_net), 0, NETS.length - 1), ci = clamp(Math.round(S.cube_cut), 0, 1);
    const bits = clamp(S.cube_bits, 0, 3), L = clamp(Math.round(bits), 1, 3), ai = Math.round(clamp(S.cube_algebra, 0, 1));
    const A = anOf(ni, ci, L);
    curA = A; curL = L; curAlg = ai;
    const NT = buildNet(ni), snap = cur.first || !(dt > 0) || dt > 0.25, ease = snap ? 1 : 1 - Math.exp(-dt * 8);
    cur.first = false;
    // the genes
    const genes = clamp(S.cube_genes, 0, 1), ac = clamp(S.cube_ac, 0, 1);
    NET.forEach((o, i) => { if (o) o.pts.visible = o.lns.visible = i === ni && genes > 0.003 && ac < 0.999; });
    const how = CUTS[ci], M = NT.M[how];
    U.uBits.value = bits; U.uGather.value = ac; U.uCut.value = ci;
    U.uGeneA.value = genes; U.uLinkA.value = NT.linkA * genes;
    U.uM0.value.set(...M.m0); M.m1.forEach((p, j) => U.uM1.value[j].set(...p)); M.m2.forEach((p, j) => U.uM2.value[j].set(...p)); M.m3.forEach((p, j) => U.uM3.value[j].set(...p));
    planes.forEach((m, k) => { const ph = clamp(bits - k, 0, 1); m.material.uniforms.uK.value = genes * Math.sin(ph * PI) * (1 - ac); m.visible = m.material.uniforms.uK.value > 0.003; });

    // the big cube: where, how big
    const br = smooth(clamp(S.cube_bricks, 0, 1)), cen = [lerp(0, -1.08, br), lerp(0, 0.02, br), 0], sc = lerp(1, 0.86, br);
    anchorsNow.cube = cen; anchorsNow.sc = sc;
    const N = 1 << L, h = H * sc;
    // the values shown, eased when the analysis, the algebra or the focus changes
    const id = `${ni}:${ci}:${L}`;
    if (id !== cur.id) { cur.id = id; if (cur.L !== L) { cur.D = new Float64Array(N * N); cur.G = new Float64Array(N * N); cur.L = L; } }
    const T = targets(S, A, L);
    const fk = Math.round(S.cube_focus), fon = fk >= 0 && fk < N * N ? 1 : 0;
    if (fon) cur.focus = fk;
    cur.fa = snap ? fon : cur.fa + (fon - cur.fa) * ease;
    for (let i = 0; i < N * N; i++) {
      let tv = T.D[i];
      if (cur.focus >= 0 && cur.focus < N * N && cur.fa > 0.001) {
        const r = Math.floor(i / N), c = i % N, sv = Q.entry(cur.focus, L, r, c)[0];
        tv = lerp(tv, sv, cur.fa);
      }
      cur.D[i] = snap ? tv : cur.D[i] + (tv - cur.D[i]) * ease;
      cur.G[i] = snap ? T.G[i] : cur.G[i] + (T.G[i] - cur.G[i]) * ease;
    }
    if (!fon && cur.fa < 0.002) cur.focus = -1;

    tubes.begin(); rings.begin(); balls.begin(); halos.begin();
    const cubeA = smooth(prog(ac, 0.35, 1));
    if (cubeA > 0.003) {
      const P = frame(cen, h, L, cubeA * 0.7, 0);
      const ghost = clamp(S.cube_build, 0, 1) * (1 - cur.fa) * 0.5;
      for (let a = 0; a < N; a++) {
        for (let b = a + 1; b < N; b++) {
          // (an edge grows from its middle as the cube comes in)
          const g = prog(ac, 0.55, 1), m = [(P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2, (P[a][2] + P[b][2]) / 2];
          const pa = add3(m, [P[a][0] - m[0], P[a][1] - m[1], P[a][2] - m[2]], g), pb = add3(m, [P[b][0] - m[0], P[b][1] - m[1], P[b][2] - m[2]], g);
          edge(pa, pb, sc, cur.D[a * N + b], LK.PURPLE, cubeA, false);
          if (ghost > 0.01) edge(P[a], P[b], sc, cur.G[a * N + b], LK.GRAY, ghost, true);
        }
        loop(P[a], cen, sc, cur.D[a * N + a] * prog(ac, 0.6, 1), LK.PURPLE, cubeA);
        if (ghost > 0.01) loop(P[a], cen, sc * 1.02, cur.G[a * N + a], LK.GRAY, ghost * 0.6);
        // corners: the cell's color; red or blue where a focused string puts a +1 or -1 loop there
        const sv = cur.focus >= 0 && cur.focus < N * N ? Q.entry(cur.focus, L, a, a)[0] : 0;
        const cc = LK.mix(cellCol(a, L), sv > 0 ? LK.RED : LK.BLUE, Math.abs(sv) * cur.fa);
        balls.add(P[a], 0.045 * sc * prog(ac, 0.3, 0.8), cc, cubeA);
        halos.add(P[a], 0.2 * sc, cc, 0.45 * cubeA);
      }
    }
    // the gallery: the strings of the largest weights, as small cubes; outside the algebra gray once the toolbox is on
    const alg = Q.algebra(ALGS[ai], L), alw = clamp(S.cube_alg, 0, 1), sum = clamp(S.cube_sum, 0, NB);
    // (the gallery shows the lesson or the weighted strings; a switch crossfades through nothing at cube_lesson 0.5)
    const les = clamp(S.cube_lesson, 0, 1), list = les > 0.5 ? lessonOf(L) : A.order.slice(0, NB), swap = Math.abs(les - 0.5) * 2;
    curList = list; curLesson = les > 0.5;
    if (br > 0.003) list.forEach((k, s) => {
      const a = prog(S.cube_bricks, 0.3 + 0.045 * s, 0.55 + 0.045 * s) * smooth(swap), out = k !== 0 && !alg.set.has(k);
      if (a <= 0.003) return;
      const hit = cur.focus === k ? cur.fa : 0;
      drawString(k, L, slotPos(s), HB, a, out ? alw * 0.85 : 0, Math.max(hit, prog(sum - s, 0.6, 1) * 0.6 * (1 - prog(sum - s, 1.5, 3))));
      // the copy that flies into the big cube as the string is added
      const f = curLesson ? 0 : clamp(sum - s, 0, 1);
      if (f > 0.001 && f < 0.999) {
        const e = smooth(f), p = slotPos(s), q = [lerp(p[0], cen[0], e), lerp(p[1], cen[1], e) + Math.sin(e * PI) * 0.25, lerp(p[2], cen[2], e) + Math.sin(e * PI) * 0.2];
        drawString(k, L, q, lerp(HB, h, e), a * (1 - prog(f, 0.7, 1)), 0, 0.6);
      }
    });
    // the gauge under the big cube: the error left (while adding strings) or the residual (the toolbox)
    const build = clamp(S.cube_build, 0, 1), keep = clamp(S.cube_keep, 0, 1), gA = Math.max(build, keep) * cubeA * (1 - cur.fa);
    if (gA > 0.01) {
      const j = Math.floor(sum), err = lerp(A.errors[Math.min(j, A.errors.length - 1)], A.errors[Math.min(j + 1, A.errors.length - 1)], smooth(sum - j));
      const val = lerp(err, A.fits[ALGS[ai]].residual, keep), y = cen[1] - h - 0.3, x0 = cen[0] - 0.45 * sc, x1 = cen[0] + 0.45 * sc;
      anchorsNow.gauge = [x1 + 0.04, y + 0.02, 0];
      tubes.add([x0, y, 0], [x1, y, 0], 0.014 * sc, LK.GRAY, gA * 0.7, 0);
      if (val > 0.004) tubes.add([x0, y, 0], [lerp(x0, x1, clamp(val, 0, 1)), y, 0], 0.03 * sc, keep > 0.5 ? LK.AMBER : LK.PURPLE, gA, 0);
      for (let q = 0; q <= 4; q++) balls.add([lerp(x0, x1, q / 4), y, 0], 0.008 * sc, LK.INK, gA * 0.8);
    }
    tubes.end(); rings.end(); balls.end(); halos.end();
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const anchors = {
    genes: [0, 0, 0],
    cube: () => anchorsNow.cube,
    top: () => [anchorsNow.cube[0], anchorsNow.cube[1] + H * anchorsNow.sc + 0.2, 0],
    gallery: [1.12, 0, 0],
    gauge: () => anchorsNow.gauge,
    cut1: [0, 0.75, 0], cut2: [0.75, 0.1, 0], cut3: [0.75, 0, 0.5],
  };
  const cornerAt = (c, L) => () => { const p = add3(anchorsNow.cube, corner(c, L, H * anchorsNow.sc)), o = norm(corner(c, L)); return add3(p, o, 0.09); };
  for (let c = 0; c < 8; c++) anchors['c' + codeStr(c, 3)] = cornerAt(c, 3);
  for (let s = 0; s < NB; s++) anchors['brick' + s] = slotPos(s);
  const labels = [];
  // the codes at the corners, at the bits shown (hidden while the gallery is up)
  for (const L of [1, 2, 3]) for (let c = 0; c < 1 << L; c++) {
    labels.push({ text: [codeStr(c, L), ''], at: cornerAt(c, L), cls: 'cyn', alpha: S => {
      const b = clamp(S.cube_bits, 0, 3), on = L === 3 ? prog(b, 2.7, 3) : prog(b, L - 0.3, L) * (1 - prog(b, L + 0.05, L + 0.35));
      return on * Math.max(clamp(S.cube_genes, 0, 1) * prog(b, 0, 0.5), prog(S.cube_ac, 0.5, 0.8)) * (1 - prog(S.cube_bricks, 0, 0.3)) * (1 - cur.fa);
    } });
  }
  // the cuts as they are made: which digit each one is
  [['First cut', ' · digit q2'], ['Second cut', ' · digit q1'], ['Third cut', ' · digit q0']].forEach((tx, k) => labels.push({
    text: tx, at: 'cut' + (k + 1), cls: 'amb', alpha: S => clamp(S.cube_genes, 0, 1) * Math.sin(clamp(S.cube_bits - k, 0, 1) * PI) * (1 - clamp(S.cube_ac, 0, 1)) }));
  // the gallery's names and weights (text as a function: it follows the network shown; see SPEC.md, labels). A slot
  // has two labels: cyan for a string inside the algebra (or any string before the toolbox), plain for I and for
  // strings outside it once the toolbox is on.
  const fmtW = w => (w < 0 ? '−' : '') + Math.abs(w).toFixed(2);
  const slotK = s => (curA && s < curList.length ? curList[s] : -1);
  const outside = k => k > 0 && !Q.algebra(ALGS[curAlg], curL).set.has(k);
  for (let s = 0; s < NB; s++) {
    const at = [slotPos(s)[0] - 0.1, slotPos(s)[1] + HB + 0.1, slotPos(s)[2]];
    const text = () => { const k = slotK(s); return k < 0 ? ['', ''] : [Q.name(k, curL, { sub: true }), curLesson ? '' : ' ' + fmtW(curA.c.re[k])]; };
    const vis = S => (slotK(s) < 0 ? 0 : prog(S.cube_bricks, 0.35 + 0.045 * s, 0.6 + 0.045 * s) * smooth(Math.abs(clamp(S.cube_lesson, 0, 1) - 0.5) * 2));
    labels.push({ text, at, cls: 'cyn', minor: s >= 4, alpha: S => { const k = slotK(s); return k > 0 && !(outside(k) && S.cube_alg > 0.5) ? vis(S) : 0; } });
    labels.push({ text, at, cls: '', minor: s >= 4, alpha: S => { const k = slotK(s); return k === 0 || (outside(k) && S.cube_alg > 0.5) ? vis(S) * (k === 0 ? 1 : 0.8) : 0; } });
  }
  // the focused string's name and what it does, above the big cube
  const what = (k, L) => {
    const p = Q.parts(k, L), x = k >> L, nx = Q.pop(x);
    if (!p.length) return 'the same loop on every corner';
    if (!x) return 'loops of +1 and −1';
    if (p.length === 1) return 'hops along the cube’s edges';
    if (nx === 1) return 'hops with signs';
    return nx === 2 ? 'hops across face diagonals' : 'hops across body diagonals';
  };
  labels.push({ text: () => (cur.focus >= 0 ? [Q.name(cur.focus, cur.L, { sub: true }), ' · ' + what(cur.focus, cur.L)] : ['', '']), at: 'top', cls: 'mag',
    alpha: S => (cur.focus >= 0 ? cur.fa * prog(S.cube_ac, 0.5, 0.9) : 0) });
  labels.push({ text: ['Error left', ''], at: 'gauge', cls: '', alpha: S => clamp(S.cube_build, 0, 1) * (1 - clamp(S.cube_keep, 0, 1)) * prog(S.cube_ac, 0.6, 1) * (1 - cur.fa) });
  labels.push({ text: ['Residual', ' · the share dropped'], at: 'gauge', cls: 'amb', alpha: S => clamp(S.cube_keep, 0, 1) * prog(S.cube_ac, 0.6, 1) * (1 - cur.fa) });

  const cam = {
    default: [24, 16, 3.3, 0, 0, 0],
    genes: [30, 14, 3.6, 0, 0, 0],
    cube: [24, 16, 2.7, 0, 0.02, 0],
    bricks: [4, 8, 5.6, 0.45, -0.02, 0],
    gallery: [2, 6, 3.9, 1.12, -0.02, 0],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['genes', 'Genes'], ['cut', 'Cut'], ['cube', 'Cube'], ['bricks', 'Bricks'], ['toolbox', 'Toolbox']] },
    { key: 'net', label: 'Network', options: NETS.map((s, i) => [String(i), s.name]) },
    { key: 'cut', label: 'Cut', options: [['0', 'Found'], ['1', 'Random']] },
    { key: 'bits', label: 'Bits', options: [['3', '3'], ['2', '2'], ['1', '1']], when: v => v.view !== 'genes' },
    { key: 'alg', label: 'Algebra', options: [['1', 'so(2L+1)'], ['0', 'so(2L)']], when: v => v.view === 'toolbox' },
  ];
  function explore(c) {
    const v = c.view || 'genes', bits = v === 'genes' ? 0 : clamp(parseInt(c.bits, 10) || 3, 1, 3);
    return {
      cube_net: clamp(parseInt(c.net, 10) || 0, 0, NETS.length - 1), cube_cut: c.cut === '1' ? 1 : 0, cube_bits: bits,
      cube_genes: v === 'genes' || v === 'cut' ? 1 : 0, cube_ac: v === 'genes' || v === 'cut' ? 0 : 1,
      cube_bricks: v === 'bricks' || v === 'toolbox' ? 1 : 0, cube_lesson: 0, cube_build: 0, cube_sum: 0,
      cube_alg: v === 'toolbox' ? 1 : 0, cube_keep: v === 'toolbox' ? 1 : 0, cube_algebra: c.alg === '0' ? 0 : 1, cube_focus: -1,
    };
  }
  // picking: a gallery brick (its slot) or a corner of the big cube
  const _p = new THREE.Vector3(), _d = new THREE.Vector3();
  function pick(rc) {
    const ray = rc.ray;
    set.group.updateMatrixWorld();
    const M = set.group.matrixWorld, s0 = M.getMaxScaleOnAxis();
    let best = null, bt = Infinity;
    const test = (p, r, hit) => {
      _p.set(p[0], p[1], p[2]).applyMatrix4(M);
      const tt = _d.copy(_p).sub(ray.origin).dot(ray.direction), rr = r * s0;
      if (tt > 0 && tt < bt && ray.distanceSqToPoint(_p) < rr * rr) { bt = tt; best = hit; }
    };
    if (curA) {
      curList.forEach((k, s) => test(slotPos(s), HB * 1.5, { kind: 'brick', slot: s, k, name: Q.name(k, curL) }));
      for (let c = 0; c < 1 << curL; c++) test(add3(anchorsNow.cube, corner(c, curL, H * anchorsNow.sc)), 0.09, { kind: 'corner', code: codeStr(c, curL) });
    }
    return best;
  }
  const API = {
    nets: NETS.map((s, i) => ({ i, key: s.key, name: s.name, note: s.note })),
    defaultNet: DEF,
    // the analysis shown now (QMATH.analyze: sizes, purity, Ac, c, order, errors, fits, cubeShare, cutShare, trotter)
    analysis: () => curA,
    // any analysis: network index, cut ('found' | 'random'), bits
    analyze: (ni, cut, L) => anOf(clamp(ni | 0, 0, NETS.length - 1), cut === 'random' ? 1 : 0, clamp(L | 0, 1, 3)),
    // the gallery now: [{ slot, k, name, weight, inside }]
    bricks: () => (curA ? curList.map((k, s) => ({ slot: s, k, name: Q.name(k, curL), weight: curA.c.re[k], inside: k === 0 ? null : Q.algebra(ALGS[curAlg], curL).set.has(k) })) : []),
    lesson: L => lessonOf(clamp(L | 0, 1, 3)).map(k => Q.name(k, clamp(L | 0, 1, 3))),
    algebra: () => Q.algebra(ALGS[curAlg], curL),
    corner: (c, L) => corner(c, L),
    pick,
    NB,
  };
  // build the other networks between frames (one per call), or all at once for screenshots
  let nextBuild = 0;
  return Object.assign(set, {
    params: { cube_a: 1, cube_net: DEF, cube_cut: 0, cube_genes: 0, cube_bits: 3, cube_ac: 1, cube_bricks: 0, cube_lesson: 0, cube_build: 0, cube_sum: 0,
      cube_alg: 0, cube_keep: 0, cube_algebra: 1, cube_focus: -1 },
    update, anchors, labels, cam, controls, explore,
    idle() { while (nextBuild < NETS.length && NET[nextBuild]) nextBuild++; if (nextBuild < NETS.length) buildNet(nextBuild); },
    finish() { NETS.forEach((_, i) => buildNet(i)); },
    api: () => API,
  });
};
