// net: the human interactome in the authors' six arrangements (the CDK5_analytics VR project, CDK5_DATA through CDATA):
// 16,376 proteins as glowing points that flow from one arrangement to the next as net_scene eases between integers
// (each protein on its own small delay; the sphere of processes opening into the disease landscape is the big move),
// each scene's links cross-fading with their ends following the moving points, and the story's highlights: CDK5's halo
// in its state's colour, its 205 partners' lines (and any picked protein's), the CDK family, the activators' homes with
// great-circle arcs, a pathway, a disease term, CDK5's 30 nearest in the landscape, the veil that clears the view to the
// map's centre for the core set, dimming and growing in. Every place, colour and link is the authors' (CDATA); every
// number in a tag comes from CDATA. Adapted from the soil story's net set (packages/soil/src/sets/net.js: its point shader,
// glow, twinkle, depth cue, picking, labels and links with per-vertex colour), rebuilt round CDATA.
// The moves are worked out on the graphics card from each protein's places in the two neighbouring scenes (refilled only
// when the pair of scenes changes, a pick or a term changes); the same function runs on the CPU (placeAt) for anchors,
// halos and picking, so they always sit on the points.
SETS.net = function (K) {
  const { THREE, smooth, clamp, prog } = K;
  const set = K.newSet('net');
  const CD = CDATA, n = CD.n, SC = CD.SCENES, NP = SC.length - 1, FA = CD.facts, DZ = CD.diseases;
  const C = CLOOK.C, RGB = CLOOK.RGB;
  const LK = TLOOK(K, set);
  const R = K.rng(16376);
  const fmt = v => Math.round(v).toLocaleString('en-GB');
  const D = 1 / 3, INVD = 1 / (1 - D);        // the longest delay (a third of the move) and the move's speed after it
  const C5 = CD.cdk5, R1 = CD.r1, R2 = CD.r2, CAPN1 = CD.capn1, APP = CD.find(FA.hub.sym);
  const LAY = SC.map(k => CD.layout(k)), COL = SC.map(k => CD.colours(k));
  const CEN = SC.map(k => { const u = new Uint8Array(n); for (const i of CD.scene(k).centre) u[i] = 1; return u; });

  // CDK5's direction on the sphere and the front (the default view's direction: the story faces +z, CDK5's side)
  const deg = r => r * 180 / Math.PI, rad = d => d * Math.PI / 180;
  const c0 = [LAY[0][3 * C5], LAY[0][3 * C5 + 1], LAY[0][3 * C5 + 2]], cl0 = Math.hypot(...c0), w5 = c0.map(v => v / cl0);
  const AZ = deg(Math.atan2(w5[0], w5[2])), EL = deg(Math.asin(w5[1]));
  const FRONT = [Math.cos(rad(14)) * Math.sin(rad(AZ + 8)), Math.sin(rad(14)), Math.cos(rad(14)) * Math.cos(rad(AZ + 8))];

  // ---------------------------------------------------------------- each protein's delay, per move
  // the moves within the sphere: seeded at random; calpain -> Alzheimer's (the map recoloured by disease): a wave spreading over the
  // sphere from CDK5's side; Alzheimer's -> the landscape (the sphere opening into the landscape): from the front backwards, so the sphere
  // peels open towards the viewer and the landscape gathers inside
  const RND = new Float32Array(n); for (let i = 0; i < n; i++) RND[i] = R();
  const ST_R = new Float32Array(n), ST_C = new Float32Array(n), ST_W = new Float32Array(n);
  {
    const S0 = LAY[0], S4 = LAY[SC.indexOf('alzheimer')], c = 3 * C5, cl = Math.hypot(S0[c], S0[c + 1], S0[c + 2]) || 1;
    const wx = S0[c] / cl, wy = S0[c + 1] / cl, wz = S0[c + 2] / cl;
    for (let i = 0; i < n; i++) {
      const x = S0[3 * i], y = S0[3 * i + 1], z = S0[3 * i + 2], r = Math.hypot(x, y, z) || 1;
      ST_R[i] = D * RND[i];
      ST_C[i] = D * (0.85 * Math.acos(clamp((x * wx + y * wy + z * wz) / r, -1, 1)) / Math.PI + 0.15 * RND[i]);
      const r4 = Math.hypot(S4[3 * i], S4[3 * i + 1], S4[3 * i + 2]) || 1;
      ST_W[i] = D * (0.85 * (1 - (S4[3 * i] * FRONT[0] + S4[3 * i + 1] * FRONT[1] + S4[3 * i + 2] * FRONT[2]) / r4) / 2 + 0.15 * RND[i]);
    }
  }
  // (by the pair's second scene: into the Alzheimer's scene the wave, into the landscape the peel, else at random)
  const STAG = SC.slice(1).map(k => (k === 'alzheimer' ? ST_C : k === 'disease' ? ST_W : ST_R));

  // ---------------------------------------------------------------- who is who (fixed bits)
  // 1 CDK5's partner, 2 the CDK family, 4 CDK5's 30 nearest in the landscape, 8 Signalling by NTRK2, 16 the Alzheimer's
  // pathway, 32 an activator (p35, p39), 64 has a GO process, 128 CDK5, 256 the hub (APP); 1024 Semaphorin interactions,
  // 2048 Transcriptional regulation by NPAS4 (512: below)
  const FL = new Uint16Array(n);
  const NB5 = CD.nb(C5);
  for (const j of NB5) FL[j] |= 1;
  const FAM = FA.family.filter(f => f.i !== C5);
  for (const f of FAM) FL[f.i] |= 2;
  for (const i of DZ.near) FL[i] |= 4;
  for (const i of CD.pathways.ntrk2.members) FL[i] |= 8;
  for (const i of CD.pathways.alzheimer.members) FL[i] |= 16;
  for (const i of CD.pathways.sema.members) FL[i] |= 1024;
  for (const i of CD.pathways.npas4.members) FL[i] |= 2048;
  FL[R1] |= 32; FL[R2] |= 32;
  for (let i = 0; i < n; i++) if (CD.bp(i)) FL[i] |= 64;
  FL[C5] |= 128;
  if (APP >= 0) FL[APP] |= 256;
  // 512 a protein of a knot of the map of processes (CDATA.clouds: where one GO process gathers, named from a current
  // GO release, not the authors' matrix)
  const KN = CD.clouds || [];
  for (const c of KN) for (const i of c.knot) FL[i] |= 512;
  const LDEG = Math.log(1 + CD.deg(APP >= 0 ? APP : 0));

  // ---------------------------------------------------------------- the links of each move (a pair of scenes)
  // a link in both scenes in the same colour stays (w 2); one only in the first fades as its ends leave (w 0); one only
  // in the second appears as both its ends arrive (w 1)
  const PAIRS = [];
  for (let a = 0; a < NP; a++) {
    const LA = CD.scene(SC[a]).links, LB = CD.scene(SC[a + 1]).links, key = (i, j) => (i < j ? i * 65536 + j : j * 65536 + i);
    const mA = new Map(), both = new Set(), ij = [], w = [], cl = [];
    LA.forEach((c, ci) => { for (let k = 0; k < c.pairs.length; k += 2) mA.set(key(c.pairs[k], c.pairs[k + 1]), ci); });
    const same = (x, y) => x[0] === y[0] && x[1] === y[1] && x[2] === y[2] && x[3] === y[3];
    LB.forEach(c => {
      for (let k = 0; k < c.pairs.length; k += 2) {
        const i = c.pairs[k], j = c.pairs[k + 1], kk = key(i, j), ci = mA.get(kk), keep = ci !== undefined && same(LA[ci].rgba, c.rgba);
        if (keep) both.add(kk);
        ij.push(i, j); w.push(keep ? 2 : 1); cl.push(...c.rgba);
      }
    });
    LA.forEach(c => { for (let k = 0; k < c.pairs.length; k += 2) { const i = c.pairs[k], j = c.pairs[k + 1]; if (both.has(key(i, j))) continue; ij.push(i, j); w.push(0); cl.push(...c.rgba); } });
    PAIRS.push({ m: w.length, ij: Uint16Array.from(ij), w: Uint8Array.from(w), rgba: Float32Array.from(cl) });
  }
  const LCAP = Math.max(...PAIRS.map(p => p.m));

  // ---------------------------------------------------------------- shared GLSL: the move, the view
  const MOVE = `
uniform float uF, uInvD, uLand, uGrow, uVeil;
uniform vec3 uFront;
// a protein on its way from its place in the first scene (a) to the second (b): eased after its own delay (st), with a
// sideways bow about the vertical (all bows turn the same way: a swirl); on the big move the front of the sphere peels
// away from the line of sight as it goes, opening a window onto the landscape gathering inside; growing in from the
// centre (g)
vec3 place(vec3 a, vec3 b, float st, out float e, out float g) {
  e = clamp((uF - st) * uInvD, 0.0, 1.0); e = e * e * (3.0 - 2.0 * e);
  vec3 d = b - a, p = a + d * e;
  float s = sin(3.14159265 * e);
  vec3 lat = a - uFront * dot(a, uFront);
  float fw = smoothstep(-0.1, 0.9, dot(a, uFront) / max(length(a), 1e-4));
  p += vec3(-d.z, 0.0, d.x) * ((0.16 + 0.1 * uLand) * s) + lat / max(length(lat), 1e-4) * (0.5 * uLand * s * fw);
  // (growing in: each protein leaves the centre by its radius and a seeded part of its own, read off its delay)
  float r = min(length(p) / 1.3, 1.0);
  g = clamp((uGrow - 0.25 * r - 0.2 * fract(st * 9.73)) / 0.55, 0.0, 1.0); g = g * g * (3.0 - 2.0 * g);
  return p * g;
}
float ease(float st) { float e = clamp((uF - st) * uInvD, 0.0, 1.0); return e * e * (3.0 - 2.0 * e); }
// what the view does to a point (mv: in view space): x the depth cue (brighter in front of the map's centre, darker
// behind); y the veil (points between the eye and the centre fade, within a cone round the line of sight to it a little
// wider than the core: each view's own eye, so it follows a headset's head too); z the fade near the eye
vec3 viewFx(vec4 mv) {
  float sc = length(modelViewMatrix[0].xyz);
  vec3 o = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float ol = max(length(o), 1e-6), cd = ol / sc, far = smoothstep(0.4, 1.2, cd);
  float cue = mix(1.0, clamp(1.0 - (o.z - mv.z) / sc * 0.5, 0.45, 1.35), far);
  vec3 ax = o / ol;
  float dep = dot(mv.xyz, ax), lat = length(mv.xyz - ax * dep), tc = 0.62 / max(cd, 0.5);
  float veil = uVeil * far * smoothstep(0.0, 0.3, cd - dep / sc) * (1.0 - smoothstep(tc, tc * 1.7, lat / max(dep, 1e-4)));
  return vec3(cue, veil, smoothstep(0.06, 0.17, length(mv.xyz) / sc));
}
float bit(float x, float b) { return mod(floor(x / exp2(b)), 2.0); }
`;
  const Ucol = c => ({ value: new THREE.Color(c) });
  const U = {
    uFront: { value: new THREE.Vector3(...FRONT) }, uF: { value: 0 }, uInvD: { value: INVD }, uLand: { value: 0 }, uGrow: { value: 1 }, uVeil: { value: 0 },
    uShell: { value: 1 }, uCdk5: { value: 0 }, uPart: { value: 0 }, uFam: { value: 0 }, uHomes: { value: 0 }, uPathB: { value: -1 },
    uTermA: { value: 0 }, uNear: { value: 0 }, uCore: { value: 0 }, uDim: { value: 0 }, uPickOn: { value: 0 }, uHub: { value: 0 }, uClouds: { value: 0 },
    uLinks: { value: 1 }, uPartA: { value: 0.32 }, uPickA: { value: 0.3 },
    uCdkCol: Ucol(C.cdk5), uPartCol: Ucol(C.partner), uFamCol: Ucol('#e9ffbf'), uActCol: Ucol(C.activator), uPathCol: Ucol(C.pathway),
    uTermCol: Ucol(C.term), uNearCol: Ucol('#ffe08a'), uPickCol: Ucol(C.pick), uPickPCol: Ucol(C.partner), uHubCol: Ucol('#fff4d6'),
    uPLineCol: Ucol(C.partner),
  };
  const mat = (vs, fs) => {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U),
      vertexShader: K.GLSL + MOVE + vs, fragmentShader: fs,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    set.mats.push(m);
    return m;
  };
  const attr = (g, name, arr, k) => { const b = new THREE.BufferAttribute(arr, k); g.setAttribute(name, b); return b; };
  const BS = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.7);

  // ---------------------------------------------------------------- the proteins
  const PA = new Float32Array(3 * n), PB = new Float32Array(3 * n), CA = new Float32Array(4 * n), CB = new Float32Array(4 * n);
  const PS = new Float32Array(4 * n), PI = new Float32Array(4 * n), PH = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) {
    PI[4 * i] = i; PI[4 * i + 1] = FL[i]; PI[4 * i + 2] = 0.007 * Math.log(1 + CD.deg(i)) / LDEG; PI[4 * i + 3] = RND[(i * 7919) % n] * 6.2832;
  }
  const pg = new THREE.BufferGeometry();
  const aPA = attr(pg, 'position', PA, 3), aPB = attr(pg, 'aPb', PB, 3), aCA = attr(pg, 'aCa', CA, 4), aCB = attr(pg, 'aCb', CB, 4);
  const aPS = attr(pg, 'aS', PS, 4); attr(pg, 'aI', PI, 4); const aPH = attr(pg, 'aH', PH, 2);
  pg.boundingSphere = BS;
  const ptMat = mat(`
attribute vec3 aPb; attribute vec4 aCa, aCb, aS, aI; attribute vec2 aH;
uniform float uA, uShell, uCdk5, uPart, uFam, uHomes, uPathB, uTermA, uNear, uCore, uDim, uPickOn, uHub, uClouds;
uniform vec3 uCdkCol, uPartCol, uFamCol, uActCol, uPathCol, uTermCol, uNearCol, uPickCol, uPickPCol, uHubCol;
varying vec3 vC; varying float vA, vHot;
void light(float w, vec3 c, float k, float s, inout vec3 col, inout float br, inout float sz, inout float hi) {
  col = mix(col, c, k * w); br = mix(br, max(br, 1.3), w); sz *= 1.0 + s * w; hi = max(hi, w);
}
void main() {
  float e, g;
  vec3 p = place(position, aPb, aS.x, e, g);
  vec4 c = mix(aCa, aCb, e);
  float fl = aI.y, bp = bit(fl, 6.0);
  vec3 col = c.rgb;
  // the authors' alpha (100, 90, 80, 50 of 255; their highlights 200 to 240) as brightness and a little size
  float br = 0.36 + 1.25 * c.a, sz = (0.011 + 0.016 * c.a + aI.z) * (1.0 + 0.35 * step(0.7, c.a)), hi = 0.0, hot = 0.0;
  // the outer shell (no known process), on the sphere only; a slow twinkle for those with a process
  br *= mix(1.0, mix(0.18, 1.0, uShell), (1.0 - bp) * (1.0 - uLand * e));
  br *= 1.0 - bp * 0.2 * (0.5 + 0.5 * sin(uTime * 1.3 + aI.w));
  // the landscape's bulk is dense: smaller points there
  sz *= 1.0 - 0.42 * uLand * e;
  light(bit(fl, 0.0) * uPart, uPartCol, 0.55, 0.5, col, br, sz, hi);
  light(bit(fl, 1.0) * uFam, uFamCol, 0.75, 1.0, col, br, sz, hi);
  light(bit(fl, 5.0) * uHomes, uActCol, 0.85, 1.4, col, br, sz, hi);
  light(uPathB > 0.0 ? bit(fl, uPathB) : 0.0, uPathCol, 0.85, 0.8, col, br, sz, hi);
  light(bit(fl, 2.0) * uNear, uNearCol, 0.6, 0.7, col, br, sz, hi);
  light(bit(fl, 8.0) * uHub, uHubCol, 0.6, 1.6, col, br, sz, hi);
  // a knot of the map: brighter and a little larger in the scene's own colours (no new hue)
  light(bit(fl, 9.0) * uClouds, col, 0.0, 0.6, col, br, sz, hi);
  // a disease term's proteins (the rest steps back a little by itself)
  light(aH.y * uTermA, uTermCol, 0.85, 0.6, col, br, sz, hi);
  br *= 1.0 - 0.5 * uTermA * (1.0 - aH.y);
  // the picked protein and its partners
  float pk = step(1.5, aH.x) * uPickOn, pn = step(0.5, aH.x) * (1.0 - step(1.5, aH.x)) * uPickOn;
  light(pn, uPickPCol, 0.6, 0.5, col, br, sz, hi);
  light(pk, uPickCol, 0.9, 1.6, col, br, sz, hi); hot = max(hot, pk);
  br *= 1.0 - 0.5 * uPickOn * (1.0 - max(pk, pn));
  // CDK5 itself, in its state's colour
  float cc = bit(fl, 7.0) * uCdk5;
  col = mix(col, uCdkCol, cc); sz = mix(sz, 0.03 * (1.0 - 0.42 * uLand * e), cc); br = mix(br, 1.7, cc); hi = max(hi, cc); hot = max(hot, cc);
  br *= mix(1.0, 0.12 + 0.88 * hi, uDim);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 fx = viewFx(mv);
  gl_Position = projectionMatrix * mv;
  // never a blob close up: at most about 1.1 degrees across
  sz = min(sz, 0.02 * length(mv.xyz) / length(modelViewMatrix[0].xyz));
  gl_PointSize = pointPx(sz * mix(0.3, 1.0, g), mv);
  vC = col * br * fx.x; vHot = hot;
  // the current scene's centre proteins step aside for the core set
  vA = uA * g * fx.z * (1.0 - 0.94 * fx.y) * (1.0 - uCore * mix(aS.y, aS.z, e));
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA, vHot;
void main() {
  vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.62, 0.12, d), halo = pow(1.0 - d, 2.0);
  gl_FragColor = vec4(vC * (0.6 + 0.55 * core) + vec3(0.95) * vHot * smoothstep(0.45, 0.0, d), vA * (core * 0.75 + halo * (0.45 + 0.35 * vHot)));
}`);
  const points = new THREE.Points(pg, ptMat);
  points.renderOrder = 3; set.group.add(points);

  // ---------------------------------------------------------------- the scenes' links (the pair's two sets)
  const LPOS = new Float32Array(6 * LCAP), LPB = new Float32Array(6 * LCAP), LCOL = new Float32Array(8 * LCAP), LAUX = new Float32Array(8 * LCAP);
  const lg = new THREE.BufferGeometry();
  const aLP = attr(lg, 'position', LPOS, 3), aLB = attr(lg, 'aPb', LPB, 3), aLC = attr(lg, 'aCol', LCOL, 4), aLX = attr(lg, 'aL', LAUX, 4);
  lg.boundingSphere = BS;
  const lnMat = mat(`
attribute vec3 aPb; attribute vec4 aCol, aL;
uniform float uA, uLinks, uCore, uDim, uTermA, uPickOn, uPart;
varying vec3 vC; varying float vA;
void main() {
  float e, g;
  vec3 p = place(position, aPb, aL.x, e, g);
  // both ends' progress (the same on both vertices of a link): a link of the first scene goes as an end leaves, one of
  // the second comes once both have arrived, one of both stays
  float e2 = ease(aL.y), lo = min(e, e2), up = max(e, e2);
  float k = aL.z < 0.5 ? 1.0 - smoothstep(0.0, 0.35, up) : aL.z < 1.5 ? smoothstep(0.65, 1.0, lo) : 1.0;
  // links among the centre proteins step aside for the core set's tubes
  float cen = mix(bit(aL.w, 0.0), bit(aL.w, 1.0), uF);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 fx = viewFx(mv);
  gl_Position = projectionMatrix * mv;
  vC = aCol.rgb * fx.x;
  vA = uA * uLinks * aCol.a * 0.32 * k * fx.z * (1.0 - 0.94 * fx.y) * (1.0 - uCore * cen) * smoothstep(0.7, 1.0, uGrow)
     * (1.0 - 0.85 * uDim) * (1.0 - 0.6 * max(uTermA, max(uPickOn, uPart * 0.5)));
}`, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.003) discard; gl_FragColor = vec4(vC, vA); }`);
  const links = new THREE.LineSegments(lg, lnMat);
  links.renderOrder = 0; set.group.add(links);

  // ---------------------------------------------------------------- partners' lines (CDK5's, and a picked protein's)
  const PCAP = NB5.length + CD.deg(APP >= 0 ? APP : C5) + 8;
  const QPOS = new Float32Array(6 * PCAP), QPB = new Float32Array(6 * PCAP), QHA = new Float32Array(6 * PCAP), QHB = new Float32Array(6 * PCAP), QK = new Float32Array(8 * PCAP), QE = new Float32Array(2 * PCAP);
  const qg = new THREE.BufferGeometry();
  const aQP = attr(qg, 'position', QPOS, 3), aQB = attr(qg, 'aPb', QPB, 3), aQHA = attr(qg, 'aHa', QHA, 3), aQHB = attr(qg, 'aHb', QHB, 3), aQK = attr(qg, 'aK', QK, 4), aQE = attr(qg, 'aE', QE, 1);
  qg.boundingSphere = BS;
  const pqMat = mat(`
attribute vec3 aPb, aHa, aHb; attribute vec4 aK; attribute float aE;
uniform float uA, uPart, uPickOn, uPartA, uPickA;
uniform vec3 uPLineCol, uPickCol;
varying vec3 vC; varying float vA;
void main() {
  float e, g, eh, gh;
  vec3 p = place(position, aPb, aK.x, e, g), h = place(aHa, aHb, aK.y, eh, gh);
  float on = aK.z < 0.5 ? uPart : uPickOn;
  // each line shoots out from its hub at its own moment
  float rv = smoothstep(aK.w * 0.55, aK.w * 0.55 + 0.45, on);
  p = mix(h, p, rv * aE);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 fx = viewFx(mv);
  gl_Position = projectionMatrix * mv;
  vC = (aK.z < 0.5 ? uPLineCol : uPickCol) * fx.x;
  vA = uA * (aK.z < 0.5 ? uPartA : uPickA) * step(0.001, on) * min(1.0, on * 3.0) * g * gh * fx.z * (1.0 - 0.9 * fx.y) * (0.55 + 0.45 * aE);
}`, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.003) discard; gl_FragColor = vec4(vC, vA); }`);
  const plines = new THREE.LineSegments(qg, pqMat);
  plines.renderOrder = 1; set.group.add(plines);

  // ---------------------------------------------------------------- the activators' arcs (great circles over the sphere)
  const ARC = 48, ag = K.linesGeo(2 * ARC), arcMat = K.lines(set);
  ag.boundingSphere = BS;
  {
    const col = ag.attributes.aCol.array, at = ag.attributes.aT.array, c = RGB.activator;
    for (let v = 0; v < 4 * ARC; v++) { col.set(c, 3 * v); at[v] = (Math.floor((v % (2 * ARC)) / 2) + 0.5) / ARC; }
  }
  const arcs = new THREE.LineSegments(ag, arcMat);
  arcs.renderOrder = 4; arcs.visible = false; set.group.add(arcs);

  // ---------------------------------------------------------------- halos and rings (TLOOK)
  const halos = LK.halos(112); halos.mesh.renderOrder = 5; set.group.add(halos.mesh);
  const rings = LK.rings(2); rings.mesh.renderOrder = 2; set.group.add(rings.mesh);

  // ---------------------------------------------------------------- the knots of the map of processes (CDATA.clouds)
  // each at its centre on the sphere (scene 0), its glow in the mean of its proteins' own scene-0 colours; at most six
  // tags at once, the knots most squarely facing the eye
  const KNC = KN.map(c => c.centre.slice()), KCOL = KN.map(c => {
    const o = [0, 0, 0]; for (const i of c.knot) for (let a = 0; a < 3; a++) o[a] += COL[0][4 * i + a] / c.knot.length;
    const m = Math.max(o[0], o[1], o[2]) || 1; return o.map(v => 0.35 + 0.65 * v / m);
  });
  const KVIS = new Float32Array(KN.length), KSC = new Float32Array(KN.length), KMAX = 6, KDOT = new Float32Array(KN.length * KN.length);
  KNC.forEach((p, k) => KNC.forEach((q, j) => { KDOT[k * KN.length + j] = (p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / ((Math.hypot(...p) * Math.hypot(...q)) || 1); }));
  function knotsShown() {
    for (let k = 0; k < KN.length; k++) {
      const p = KNC[k], ex = EYE[0] - p[0], ey = EYE[1] - p[1], ez = EYE[2] - p[2], el = Math.hypot(ex, ey, ez) || 1, pl = Math.hypot(p[0], p[1], p[2]) || 1;
      KSC[k] = (p[0] * ex + p[1] * ey + p[2] * ez) / (el * pl);   // the cosine between its outward normal and the eye
    }
    // the best facing first, skipping one within 24 degrees of a tag already shown (tags run to the right and collide)
    KVIS.fill(0);
    for (let m = 0; m < KMAX; m++) {
      let best = -1;
      for (let k = 0; k < KN.length; k++) {
        if (KVIS[k] || KSC[k] <= 0.15 || (best >= 0 && KSC[k] <= KSC[best])) continue;
        let clear = true;
        for (let j = 0; j < KN.length && clear; j++) if (KVIS[j] && KDOT[k * KN.length + j] > 0.914) clear = false;
        if (clear) best = k;
      }
      if (best < 0) break;
      KVIS[best] = 1;
    }
  }
  // the long GO names, shortened for the tags (the GO name stays in the tag's rest)
  const SHORT = {
    'carbohydrate import across plasma membrane': 'Sugar import',
    'synaptic vesicle lumen acidification': 'Synaptic vesicles',
    'intermediate filament organization': 'Intermediate filaments',
    'regulation of natural killer cell proliferation': 'Natural killer cells',
    'G protein-coupled glutamate receptor signaling pathway': 'Glutamate receptor signalling',
    'vascular endothelial cell response to laminar fluid shear stress': 'Blood flow on vessel walls',
    'collagen catabolic process': 'Collagen breakdown',
    'regulation of membrane protein ectodomain proteolysis': 'Shedding of surface proteins',
    'cellular response to type I interferon': 'Interferon response',
    'calcium ion import across plasma membrane': 'Calcium import',
    'neutral lipid catabolic process': 'Fat breakdown',
    'anterior/posterior pattern specification': 'Head-to-tail patterning',
    'embryonic skeletal system development': 'Skeleton development',
    'regulation of synaptic transmission, glutamatergic': 'Glutamate synapses',
  };
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const knotName = t => SHORT[t] || (t.length <= 30 ? cap(t) : cap(t.slice(0, t.lastIndexOf(' ', 29))) + '…');

  // ---------------------------------------------------------------- state, and the move on the CPU (the shader's place)
  const cur = { s: 0, a: -1, f: 0, grow: 1, land: 0, cdk5: 0, hyper: 0, part: 0, fam: 0, homes: 0, path: -1, term: -1, termA: 0,
    near: 0, veil: 0, core: 0, dim: 0, pick: -2, hub: 0, shell: 1, clouds: 0 };
  let LA = LAY[0], LB = LAY[1], ST = STAG[0], CNA = CEN[0], CNB = CEN[1];
  let _e = 0, _g = 1;   // the last placed protein's progress and growth
  function placeAt(i, out) {
    const i3 = 3 * i, ax = LA[i3], ay = LA[i3 + 1], az = LA[i3 + 2];
    let e = clamp((cur.f - ST[i]) * INVD, 0, 1); e = e * e * (3 - 2 * e);
    const dx = LB[i3] - ax, dy = LB[i3 + 1] - ay, dz = LB[i3 + 2] - az, s = Math.sin(Math.PI * e);
    const bow = (0.16 + 0.1 * cur.land) * s;
    let x = ax + dx * e - dz * bow, y = ay + dy * e, z = az + dz * e + dx * bow;
    if (cur.land) {   // the peel (see the shader)
      const ad = ax * FRONT[0] + ay * FRONT[1] + az * FRONT[2], lx = ax - FRONT[0] * ad, ly = ay - FRONT[1] * ad, lz = az - FRONT[2] * ad;
      const t0 = clamp((ad / (Math.hypot(ax, ay, az) || 1e-4) + 0.1) / 1.0, 0, 1), fw = t0 * t0 * (3 - 2 * t0), k = 0.5 * s * fw / Math.max(Math.hypot(lx, ly, lz), 1e-4);
      x += lx * k; y += ly * k; z += lz * k;
    }
    const r = Math.min(Math.hypot(x, y, z) / 1.3, 1);
    const sf = ST[i] * 9.73;
    let g = clamp((cur.grow - 0.25 * r - 0.2 * (sf - Math.floor(sf))) / 0.55, 0, 1); g = g * g * (3 - 2 * g);
    out[0] = x * g; out[1] = y * g; out[2] = z * g; _e = e; _g = g;
    return out;
  }
  const cenNow = i => CNA[i] + (CNB[i] - CNA[i]) * _e;   // after placeAt(i)

  // a new pair of scenes: refill what the move reads (places, colours, delays, the centres, the links, the partners)
  function setPair(a) {
    cur.a = a; LA = LAY[a]; LB = LAY[a + 1]; ST = STAG[a]; CNA = CEN[a]; CNB = CEN[a + 1];
    PA.set(LA); PB.set(LB); CA.set(COL[a]); CB.set(COL[a + 1]);
    for (let i = 0; i < n; i++) { PS[4 * i] = ST[i]; PS[4 * i + 1] = CNA[i]; PS[4 * i + 2] = CNB[i]; }
    for (const b of [aPA, aPB, aCA, aCB, aPS]) b.needsUpdate = true;
    const P = PAIRS[a];
    for (let e = 0; e < P.m; e++) {
      const i = P.ij[2 * e], j = P.ij[2 * e + 1], cb = (CNA[i] && CNA[j] ? 1 : 0) + (CNB[i] && CNB[j] ? 2 : 0);
      for (let s = 0; s < 2; s++) {
        const v = 2 * e + s, me = s ? j : i, ot = s ? i : j, m3 = 3 * me;
        LPOS[3 * v] = LA[m3]; LPOS[3 * v + 1] = LA[m3 + 1]; LPOS[3 * v + 2] = LA[m3 + 2];
        LPB[3 * v] = LB[m3]; LPB[3 * v + 1] = LB[m3 + 1]; LPB[3 * v + 2] = LB[m3 + 2];
        for (let c = 0; c < 4; c++) LCOL[4 * v + c] = P.rgba[4 * e + c];
        LAUX[4 * v] = ST[me]; LAUX[4 * v + 1] = ST[ot]; LAUX[4 * v + 2] = P.w[e]; LAUX[4 * v + 3] = cb;
      }
    }
    lg.setDrawRange(0, 2 * P.m);
    for (const b of [aLP, aLB, aLC, aLX]) { b.needsUpdate = true; b.updateRange.offset = 0; b.updateRange.count = 2 * P.m * b.itemSize; }
    fillPartners();
  }
  // the partners' lines: CDK5's (set 0), then the picked protein's (set 1)
  function fillPartners() {
    let v = 0;
    const put = (hub, j, which) => {
      const h3 = 3 * hub;
      for (let s = 0; s < 2; s++) {
        const me = s ? j : hub, m3 = 3 * me;
        QPOS[3 * v] = LA[m3]; QPOS[3 * v + 1] = LA[m3 + 1]; QPOS[3 * v + 2] = LA[m3 + 2];
        QPB[3 * v] = LB[m3]; QPB[3 * v + 1] = LB[m3 + 1]; QPB[3 * v + 2] = LB[m3 + 2];
        QHA[3 * v] = LA[h3]; QHA[3 * v + 1] = LA[h3 + 1]; QHA[3 * v + 2] = LA[h3 + 2];
        QHB[3 * v] = LB[h3]; QHB[3 * v + 1] = LB[h3 + 1]; QHB[3 * v + 2] = LB[h3 + 2];
        QK[4 * v] = ST[me]; QK[4 * v + 1] = ST[hub]; QK[4 * v + 2] = which; QK[4 * v + 3] = RND[j];
        QE[v] = s; v++;
      }
    };
    for (const j of NB5) put(C5, j, 0);
    if (cur.pick >= 0) { const nb = CD.nb(cur.pick); for (let k = 0; k < nb.length && v < 2 * PCAP - 2; k++) put(cur.pick, nb[k], 1); }
    qg.setDrawRange(0, v);
    for (const b of [aQP, aQB, aQHA, aQHB, aQK, aQE]) { b.needsUpdate = true; b.updateRange.offset = 0; b.updateRange.count = v * b.itemSize; }
  }
  // the picked protein (2) and its partners (1)
  function setPick(p) {
    cur.pick = p;
    for (let i = 0; i < n; i++) PH[2 * i] = 0;
    if (p >= 0) { for (const j of CD.nb(p)) PH[2 * j] = 1; PH[2 * p] = 2; }
    aPH.needsUpdate = true;
    U.uPickA.value = p >= 0 ? clamp(0.55 * Math.sqrt(30 / Math.max(1, CD.deg(p))), 0.07, 0.5) : 0.3;
    if (cur.a >= 0) fillPartners();
  }
  // a disease term's proteins
  function setTerm(t) {
    cur.term = t;
    for (let i = 0; i < n; i++) PH[2 * i + 1] = 0;
    if (t >= 0) for (const g of CD.terms[t].genes) PH[2 * g + 1] = 1;
    aPH.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the eye (the engine's camera or head, set's frame)
  // (the engine gives it through api().eye; each render also takes it from the camera drawing the points, so it is right
  // in the harness and for each eye of a headset too)
  const EYE = [0, 0, 4.4], _mi = new THREE.Matrix4(), _cp = new THREE.Vector3();
  points.onBeforeRender = (r, sc, camera) => {
    _mi.copy(set.group.matrixWorld).invert();
    _cp.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(_mi);
    EYE[0] = _cp.x; EYE[1] = _cp.y; EYE[2] = _cp.z;
  };
  const _p = [0, 0, 0], _q = [0, 0, 0], _ax = [0, 0, 0];
  const distEye = p => Math.hypot(p[0] - EYE[0], p[1] - EYE[1], p[2] - EYE[2]);
  // the veil, as the shader works it out (for picking: a veiled point is not picked)
  function veilAt(p) {
    const cd = Math.hypot(EYE[0], EYE[1], EYE[2]);
    if (cur.veil <= 0 || cd < 0.4) return 0;
    const far = smooth((cd - 0.4) / 0.8);
    _ax[0] = -EYE[0] / cd; _ax[1] = -EYE[1] / cd; _ax[2] = -EYE[2] / cd;
    const vx = p[0] - EYE[0], vy = p[1] - EYE[1], vz = p[2] - EYE[2], dep = vx * _ax[0] + vy * _ax[1] + vz * _ax[2];
    if (dep <= 1e-4) return 0;
    const lat = Math.hypot(vx - _ax[0] * dep, vy - _ax[1] * dep, vz - _ax[2] * dep), tc = 0.62 / Math.max(cd, 0.5);
    return cur.veil * far * smooth((cd - dep) / 0.3) * (1 - smooth((lat / dep - tc) / (0.7 * tc)));
  }

  // ---------------------------------------------------------------- update
  const ARCEND = [[0, 0, 0], [0, 0, 0]], BEHIND = [false, false], ARCPTS = [new Float32Array(3 * ARC + 3), new Float32Array(3 * ARC + 3)];
  const stateCol = [0, 0, 0], lineCol = [0, 0, 0], ACT = [R1, R2], hubCol = K.rgb('#fff4d6'), famCol = K.rgb('#e9ffbf'), nearCol = K.rgb('#ffe08a');
  // (0 NTRK2, 1 the Alzheimer's, 2 Semaphorin interactions, 3 NPAS4: their bits in FL, and colours)
  const PATHS = [CD.pathways.ntrk2.members, CD.pathways.alzheimer.members, CD.pathways.sema.members, CD.pathways.npas4.members];
  const PATHCOL = [RGB.pathway, RGB.alz, RGB.pathway, RGB.pathway], PATHBIT = [3, 4, 10, 11];
  const _ringAx = [0, 0, 1];
  // how much of a protein the core set has taken over (after placeAt(i))
  const coreOf = i => 1 - 0.75 * cur.core * cenNow(i);
  // a ring round protein i, facing the eye, steady on screen
  function ring(i, col, al, k) {
    placeAt(i, _p);
    const d = distEye(_p), Rr = clamp(0.03 * d, 0.012, 0.11) * k;
    _ringAx[0] = EYE[0] - _p[0]; _ringAx[1] = EYE[1] - _p[1]; _ringAx[2] = EYE[2] - _p[2];
    rings.add(_p, _ringAx, Rr, Rr * 0.07, col, al * _g * coreOf(i));
  }
  function update(S, t) {
    PK.now++;   // (the pick's cache is a frame's)
    const s = clamp(S.net_scene, 0, NP), a = Math.min(NP - 1, Math.floor(s));
    cur.s = s; cur.f = s - a; cur.land = a === NP - 1 ? 1 : 0;
    if (a !== cur.a) setPair(a);
    cur.grow = clamp(S.net_grow, 0, 1); cur.shell = clamp(S.net_shell, 0, 1);
    cur.cdk5 = clamp(S.net_cdk5, 0, 1); cur.hyper = clamp(S.net_hyper, 0, 1); cur.part = clamp(S.net_partners, 0, 1);
    cur.fam = clamp(S.net_family, 0, 1); cur.homes = clamp(S.net_homes, 0, 1); cur.near = clamp(S.net_near, 0, 1);
    cur.veil = clamp(S.net_veil, 0, 1); cur.core = clamp(S.net_core, 0, 1); cur.dim = clamp(S.net_dim, 0, 1); cur.hub = clamp(S.net_hub || 0, 0, 1);
    cur.termA = clamp(S.net_termA, 0, 1);
    const pa = Math.round(S.net_path), path = pa >= 0 && pa < PATHS.length ? pa : -1;
    cur.path = path;
    const pk = S.net_pick >= -0.5 ? Math.round(S.net_pick) : -1;
    if ((pk >= 0 && pk < n ? pk : -1) !== cur.pick) setPick(pk >= 0 && pk < n ? pk : -1);
    const tm = S.net_term >= -0.5 ? Math.round(S.net_term) : -1, tv = tm >= 0 && tm < CD.terms.length ? tm : -1;
    if (tv !== cur.term) setTerm(tv);
    CLOOK.mix(RGB.cdk5, RGB.hyper, cur.hyper, stateCol);
    U.uF.value = cur.f; U.uLand.value = cur.land; U.uGrow.value = cur.grow; U.uVeil.value = cur.veil; U.uShell.value = cur.shell;
    U.uCdk5.value = cur.cdk5; U.uPart.value = cur.part; U.uFam.value = cur.fam; U.uHomes.value = cur.homes; U.uPathB.value = path < 0 ? -1 : PATHBIT[path];
    U.uTermA.value = tv >= 0 ? cur.termA : 0; U.uNear.value = cur.near; U.uCore.value = cur.core; U.uDim.value = cur.dim;
    // the knots' tags and glow: on the map of processes only (they fade as net_scene leaves 0)
    cur.clouds = clamp(S.net_clouds || 0, 0, 1) * (1 - prog(s, 0, 0.35)); U.uClouds.value = cur.clouds;
    if (cur.clouds > 0.003) knotsShown();
    U.uPickOn.value = cur.pick >= 0 ? 1 : 0; U.uHub.value = cur.hub; U.uLinks.value = clamp(S.net_links, 0, 1);
    U.uCdkCol.value.setRGB(stateCol[0], stateCol[1], stateCol[2]);
    CLOOK.mix(RGB.partner, stateCol, 0.45, lineCol);
    U.uPLineCol.value.setRGB(lineCol[0], lineCol[1], lineCol[2]);
    if (path >= 0) U.uPathCol.value.setRGB(PATHCOL[path][0], PATHCOL[path][1], PATHCOL[path][2]);

    // halos: CDK5 (its size steady on screen), the activators, the family, a pathway, the near ones, the hub, the pick
    halos.begin();
    if (cur.cdk5 > 0.003) {
      placeAt(C5, _p);
      const pulse = 1 + (0.08 + 0.1 * cur.hyper) * Math.sin(t * (1.6 + 3.2 * cur.hyper));
      halos.add(_p, clamp(0.045 * distEye(_p), 0.02, 0.2) * pulse * (0.5 + 0.5 * cur.cdk5), stateCol, 0.85 * cur.cdk5 * _g * coreOf(C5));
    }
    if (cur.homes > 0.003) for (const i of ACT) { placeAt(i, _p); halos.add(_p, 0.07, RGB.activator, 0.85 * cur.homes * _g * coreOf(i)); }
    if (cur.fam > 0.003) for (const f of FAM) { placeAt(f.i, _p); halos.add(_p, 0.032, famCol, 0.45 * cur.fam * _g * coreOf(f.i)); }
    if (path >= 0) for (const i of PATHS[path]) { if (i === C5) continue; placeAt(i, _p); halos.add(_p, 0.045, PATHCOL[path], 0.45 * _g * coreOf(i)); }
    if (cur.near > 0.003) for (const i of DZ.near) { placeAt(i, _p); halos.add(_p, clamp(0.022 * distEye(_p), 0.006, 0.03), nearCol, 0.2 * cur.near * _g); }
    if (cur.hub > 0.003 && APP >= 0) { placeAt(APP, _p); halos.add(_p, 0.13, hubCol, 0.7 * cur.hub * _g * coreOf(APP)); }
    if (cur.pick >= 0) { placeAt(cur.pick, _p); halos.add(_p, 0.08, RGB.pick, 0.75 * _g * coreOf(cur.pick)); }
    if (cur.clouds > 0.003) for (let k = 0; k < KN.length; k++) halos.add(KNC[k], 0.16, KCOL[k], 0.22 * cur.clouds * KVIS[k] * cur.grow);
    halos.end();
    // rings: CDK5's (always findable) and the picked protein's, facing the eye, steady on screen
    rings.begin();
    if (cur.cdk5 > 0.003) ring(C5, stateCol, 0.9 * cur.cdk5, 1 + 0.06 * Math.sin(t * (2 + 4 * cur.hyper)));
    if (cur.pick >= 0) ring(cur.pick, RGB.pick, 0.9, 0.8);
    rings.end();
    // the activators' arcs: from CDK5 over the sphere to p35 and p39, drawn out with net_homes
    arcs.visible = cur.homes > 0.003;
    if (arcs.visible) {
      placeAt(C5, _q);
      const pa3 = ag.attributes.position.array;
      for (let k = 0; k < 2; k++) {
        placeAt(ACT[k], _p);
        const la = Math.hypot(_q[0], _q[1], _q[2]), lb = Math.hypot(_p[0], _p[1], _p[2]);
        const ok = la > 0.3 && lb > 0.3, ux = _q[0] / la, uy = _q[1] / la, uz = _q[2] / la, vx = _p[0] / lb, vy = _p[1] / lb, vz = _p[2] / lb;
        const om = Math.acos(clamp(ux * vx + uy * vy + uz * vz, -1, 1)), so = Math.sin(om) || 1;
        let px = 0, py = 0, pz = 0;
        let vis = true, jv = 0;
        for (let j = 0; j <= ARC; j++) {
          const f = j / ARC, wa = om > 1e-4 ? Math.sin((1 - f) * om) / so : 1 - f, wb = om > 1e-4 ? Math.sin(f * om) / so : f;
          const rr = ok ? (la + (lb - la) * f) * (1.03 + 0.05 * Math.sin(Math.PI * f)) : 0;
          const x = (ux * wa + vx * wb) * rr, y = (uy * wa + vy * wb) * rr, z = (uz * wa + vz * wb) * rr;
          if (j) { const v = 6 * (k * ARC + j - 1); pa3[v] = px; pa3[v + 1] = py; pa3[v + 2] = pz; pa3[v + 3] = x; pa3[v + 4] = y; pa3[v + 5] = z; }
          px = x; py = y; pz = z;
          // the tag goes where the arc goes round the back of the sphere, if its protein is out of sight there
          if (vis && j && x * (EYE[0] - x) + y * (EYE[1] - y) + z * (EYE[2] - z) < 0) vis = false;
          if (vis) jv = j;
          ARCPTS[k][3 * j] = x; ARCPTS[k][3 * j + 1] = y; ARCPTS[k][3 * j + 2] = z;
        }
        // (only a protein on the sphere's far side counts as round the back: one on its way in is tagged where it is)
        BEHIND[k] = !vis && lb > 0.75 && _p[0] * (EYE[0] - _p[0]) + _p[1] * (EYE[1] - _p[1]) + _p[2] * (EYE[2] - _p[2]) < 0;
        // round the back: the tag on the arc, 40 % of the way along its part in sight (clear of the other's tag)
        if (BEHIND[k]) { const m = 3 * Math.round(0.4 * jv); ARCEND[k][0] = ARCPTS[k][m]; ARCEND[k][1] = ARCPTS[k][m + 1]; ARCEND[k][2] = ARCPTS[k][m + 2]; }
        else { ARCEND[k][0] = _p[0]; ARCEND[k][1] = _p[1]; ARCEND[k][2] = _p[2]; }
      }
      ag.attributes.position.needsUpdate = true;
      arcMat.uniforms.uReveal.value = prog(cur.homes, 0.05, 0.9);
      const aa = ag.attributes.aA.array, al = 0.5 * Math.min(1, cur.homes * 2);
      if (aa[0] !== Math.fround(al)) { aa.fill(al); ag.attributes.aA.needsUpdate = true; }
    }
    plines.visible = cur.part > 0.003 || cur.pick >= 0;
    LK.depth();
  }

  // ---------------------------------------------------------------- anchors (functions: they follow the moving points)
  const own = f => { const o = [0, 0, 0]; return () => f(o); };
  const at = i => own(o => placeAt(i, o));
  const mid = (list, o) => {
    let x = 0, y = 0, z = 0;
    for (const i of list) { placeAt(i, _q); x += _q[0]; y += _q[1]; z += _q[2]; }
    const k = list.length || 1; o[0] = x / k; o[1] = y / k; o[2] = z / k; return o;
  };
  // the protein of a set nearest a point in a scene's layout (for tags that sit on a protein)
  const nearestIn = (L, pt, ok) => {
    let best = 0, bd = 1e9;
    for (let i = 0; i < n; i++) if (ok(i)) { const d = (L[3 * i] - pt[0]) ** 2 + (L[3 * i + 1] - pt[1]) ** 2 + (L[3 * i + 2] - pt[2]) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const S0 = LAY[0], L5 = LAY[NP];
  const SH_IN = nearestIn(S0, [0.62, 0.48, 0.62], i => CD.bp(i)), SH_OUT = nearestIn(S0, [0.95, -0.45, 0.62], i => !CD.bp(i));
  // the landscape's bulk: the middle of the proteins with a disease (most within 0.4 of it; the ones without lie on a
  // sphere of radius 1.2 round it, the authors' walls)
  const BULK = [0, 0, 0];
  { let k = 0; for (let i = 0; i < n; i++) if (CD.dis(i)) { k++; for (let a = 0; a < 3; a++) BULK[a] += L5[3 * i + a]; } for (let a = 0; a < 3; a++) BULK[a] /= k || 1; }
  const LD_DIS = nearestIn(L5, [BULK[0] - 0.08, BULK[1] + 0.3, BULK[2]], i => CD.dis(i));
  const LD_WALL = nearestIn(L5, [BULK[0] + 0.66, BULK[1] + 0.72, BULK[2] + 0.69], i => !CD.dis(i));
  const FAR = FAM.filter(f => f.deg >= 10), CLOSE = FAM.filter(f => f.deg < 10), CLOSE_I = CLOSE.map(f => f.i);
  // a few names among the 30 near ones (they crowd within 0.06 of CDK5: one tag under them): the three best linked
  const NEARN = DZ.near.slice().sort((a, b) => CD.deg(b) - CD.deg(a) || a - b).slice(0, 3);
  // a disease term's middle in the current layout: the member nearest its proteins' mean (so the tag sits on one)
  const TM = { ti: -1, s: NaN, g: NaN, o: [0, 0, 0] };
  function termMid(ti, out) {
    const T = CD.terms[ti];
    if (!T) { out[0] = out[1] = out[2] = 0; return out; }
    if (ti !== TM.ti || Math.abs(cur.s - TM.s) > 5e-5 || Math.abs(cur.grow - TM.g) > 5e-4) {
      TM.ti = ti; TM.s = cur.s; TM.g = cur.grow;
      let x = 0, y = 0, z = 0;
      for (const g of T.genes) { placeAt(g, _q); x += _q[0]; y += _q[1]; z += _q[2]; }
      x /= T.genes.length; y /= T.genes.length; z /= T.genes.length;
      let bd = 1e9;
      for (const g of T.genes) { placeAt(g, _q); const d = (_q[0] - x) ** 2 + (_q[1] - y) ** 2 + (_q[2] - z) ** 2; if (d < bd) { bd = d; TM.o[0] = _q[0]; TM.o[1] = _q[1]; TM.o[2] = _q[2]; } }
    }
    out[0] = TM.o[0]; out[1] = TM.o[1]; out[2] = TM.o[2];
    return out;
  }
  const anchors = {
    centre: [0, 0, 0], top: [0, 1.32, 0],
    cdk5: at(C5), p35: at(R1), p39: at(R2), capn1: at(CAPN1), app: at(APP >= 0 ? APP : C5),
    near: own(o => mid(DZ.near, o)),
    // the near ones' tag, above their middle (steady on screen)
    nearTag: own(o => { mid(DZ.near, o); o[1] += 0.06 * distEye(o); return o; }),
    nearNames: own(o => { mid(DZ.near, o); o[1] -= 0.07 * distEye(o); return o; }),
    pick: own(o => placeAt(cur.pick >= 0 ? cur.pick : C5, o)),
    term: own(o => termMid(cur.term, o)),
    // just above CDK5, steady on screen (for the partners' tag over its own)
    partners: own(o => { placeAt(C5, o); o[1] += 0.034 * distEye(o); return o; }),
    // the cousins' tags above and below their crowd round CDK5 (steady on screen: CDK5's own tag sits between them)
    famNear: own(o => { mid(CLOSE_I, o); o[1] += 0.075 * distEye(o); return o; }),
    famList: own(o => { mid(CLOSE_I, o); o[1] -= 0.075 * distEye(o); return o; }),
    p35tag: () => ARCEND[0], p39tag: () => ARCEND[1],
    // the middle of the knots facing the default view; cloud(i) knot i's centre
    clouds: (() => { const o = [0, 0, 0]; let k = 0; KNC.forEach(p => { if (p[0] * FRONT[0] + p[1] * FRONT[1] + p[2] * FRONT[2] > 0.2) { k++; for (let a = 0; a < 3; a++) o[a] += p[a]; } }); return o.map(v => v / (k || 1)); })(),
    cloud: i => (KNC[i] || [0, 0, 0]).slice(),
    shellIn: at(SH_IN), shellOut: at(SH_OUT), landDis: at(LD_DIS), landWall: at(LD_WALL),
  };
  for (const f of FAM) anchors['fam_' + f.sym] = at(f.i);
  KN.forEach((c, k) => { anchors['cloud' + k] = () => KNC[k]; });


  // ---------------------------------------------------------------- labels (the set's own, by its params)
  const deg5 = FA.cdk5.deg, act = FA.activators, nearK = DZ.nearTop[0].k, nearN = DZ.near.length;
  // what the near ones share with CDK5 (the layout places proteins with the same diseases together, by construction):
  // the two rare brain disorders the story names, where the data counts those very proteins, else the top term's name
  const NT = ['lissencephaly', 'pontocerebellar hypoplasia'].map(nm => CD.terms.find(t => t.name === nm)).filter(t => t && t.near === nearK);
  const nearWhat = ' · tied to ' + (NT.length === 2 ? NT.map(t => t.name).join(', ') : DZ.nearTop[0].name);
  const closeMax = Math.ceil(Math.max(...CLOSE.map(f => f.deg)));   // (the story's text rounds it up too)
  // CLOSE as "CDK2, 3, 4, 6, 7, 8, 9"
  const closeNames = (() => { const nums = CLOSE.map(f => f.sym.replace(/^CDK/, '')).sort((a, b) => a - b); return 'CDK' + nums.join(', '); })();
  const facing = i => { placeAt(i, _q); return _q[0] * EYE[0] + _q[1] * EYE[1] + _q[2] * EYE[2] > 0 ? 1 : 0; };
  const pickTxt = { i: -2, t: ['', ''] };
  const pickText = () => {
    if (pickTxt.i !== cur.pick) { pickTxt.i = cur.pick; pickTxt.t = cur.pick >= 0 ? [CD.sym[cur.pick], ` · ${fmt(CD.deg(cur.pick))} partners`] : ['', '']; }
    return pickTxt.t;
  };
  const termTxt = { i: -2, t: ['', ''] };
  const termText = () => {
    if (termTxt.i !== cur.term) { termTxt.i = cur.term; const T = CD.terms[cur.term]; termTxt.t = T ? [T.name, ` · ${fmt(T.n)} proteins`] : ['', '']; }
    return termTxt.t;
  };
  const hyp = S => prog(S.net_hyper, 0.4, 0.6);
  const labels = [
    { text: ['CDK5', ''], at: 'cdk5', cls: CLOOK.CLS.cdk5, alpha: S => prog(S.net_cdk5, 0.2, 0.7) * (1 - hyp(S)) },
    { text: ['CDK5', ' · hyperactive'], at: 'cdk5', cls: CLOOK.CLS.hyper, alpha: S => prog(S.net_cdk5, 0.2, 0.7) * hyp(S) },
    { text: [`${fmt(deg5)} partners`, ''], at: 'partners', cls: CLOOK.CLS.cdk5, alpha: S => prog(S.net_partners, 0.5, 0.9) * (S.net_pick >= 0 ? 0 : 1) },
    { text: [FA.hub.sym, ` · ${fmt(FA.hub.deg)} partners`], at: 'app', cls: '', alpha: S => prog(S.net_hub || 0, 0.3, 0.8) },
    { text: ['Its cousins', ' · cell-cycle and transcription kinases'], at: 'famNear', cls: '', alpha: S => prog(S.net_family, 0.4, 0.8) },
    { text: [closeNames, ` · within ${closeMax}° of it`], at: 'famList', cls: '', minor: true, alpha: S => prog(S.net_family, 0.55, 0.95) },
    ...FAR.map(f => ({ text: [f.sym, f.sym === 'CDK1' ? ` · ${Math.round(f.deg)}° away` : ''], at: 'fam_' + f.sym, cls: '', minor: f.sym !== 'CDK1',
      alpha: S => prog(S.net_family, 0.5, 0.9) * (f.sym === 'CDK1' ? 1 : facing(f.i)) })),
    ...['p35', 'p39'].map((nm, k) => {
      const t = [nm, ` · ${Math.round(act[nm])} degrees away`], tb = [nm, ` · ${Math.round(act[nm])} degrees away, round the back`];
      return { text: () => (BEHIND[k] ? tb : t), at: nm + 'tag', cls: CLOOK.CLS.activator, alpha: S => prog(S.net_homes, 0.3, 0.7) };
    }),
    { text: [fmt(FA.withProcess), ' with a known process'], at: 'shellIn', cls: '', alpha: S => prog(S.net_shells, 0.3, 0.8) },
    { text: [fmt(n - FA.withProcess), ' without'], at: 'shellOut', cls: '', alpha: S => prog(S.net_shells, 0.4, 0.9) },
    { text: ['Proteins with a disease', ` · ${fmt(FA.withDisease)}`], at: 'landDis', cls: 'amb', alpha: S => prog(S.net_landTags, 0.3, 0.8) },
    { text: ['None known', ' · pushed to the walls'], at: 'landWall', cls: '', alpha: S => prog(S.net_landTags, 0.4, 0.9) },
    { text: termText, at: 'term', cls: CLOOK.CLS.term, alpha: S => (S.net_term >= -0.5 ? prog(S.net_termA, 0.3, 0.8) : 0) },
    { text: [`${nearK} of its ${nearN} nearest`, nearWhat], at: 'nearTag', cls: 'amb', alpha: S => prog(S.net_near, 0.4, 0.85) },
    { text: [NEARN.map(i => CD.sym[i]).join(', '), ' · among them'], at: 'nearNames', cls: '', minor: true, alpha: S => prog(S.net_near, 0.6, 1) },
    // (CDK5 picked while its own tag shows: that one is enough)
    ...KN.map((c, k) => ({ text: [knotName(c.name), ` · ${c.n} of ${c.size} here`], at: 'cloud' + k, cls: '',
      alpha: S => prog(S.net_clouds || 0, 0.3, 0.8) * (1 - prog(S.net_scene, 0, 0.3)) * KVIS[k] })),
    { text: pickText, at: 'pick', cls: CLOOK.CLS.pick, alpha: S => (S.net_pick >= -0.5 && !(cur.pick === C5 && S.net_cdk5 > 0.5) ? 1 : 0) },
  ];

  // ---------------------------------------------------------------- views
  // views from CDK5's direction on the sphere (az, el as the engine's views take them) and its place in the landscape
  const r1 = v => Math.round(v * 1000) / 1000;
  const c5 = [L5[3 * C5], L5[3 * C5 + 1], L5[3 * C5 + 2]];
  const nm = [0, 0, 0];   // the middle of the near ones in the landscape
  {
    let x = 0, y = 0, z = 0; for (const i of DZ.near) { x += L5[3 * i]; y += L5[3 * i + 1]; z += L5[3 * i + 2]; }
    nm[0] = x / nearN; nm[1] = y / nearN; nm[2] = z / nearN;
  }
  const LAZ = deg(Math.atan2(c5[0] - BULK[0], c5[2] - BULK[2]));
  const cam = {
    default: [r1(AZ + 8), 14, 4.4, 0, 0, 0],
    side: [r1(AZ + 95), 8, 4.4, 0, 0, 0],
    cdk5: [r1(AZ + 10), r1(EL + 6), 1.3, r1(c0[0] * 0.97), r1(c0[1] * 0.97), r1(c0[2] * 0.97)],
    centre: [r1(AZ + 8), 10, 1.85, 0, 0, 0],
    // from the map's middle (the camera at the origin), looking out at CDK5's side
    inside: [r1(AZ + 180), r1(-EL), 0.35, r1(0.35 * w5[0]), r1(0.35 * w5[1]), r1(0.35 * w5[2])],
    land: [r1(AZ + 8), 14, 4.6, r1(BULK[0]), r1(BULK[1]), r1(BULK[2])],
    landCore: [r1(AZ + 8), 16, 1.9, r1(BULK[0]), r1(BULK[1]), r1(BULK[2])],
    // CDK5 lies on the far side of the bulk from the front: seen from its own side, the bulk behind it
    landCdk5: [r1(LAZ), 8, 0.55, r1((c5[0] + nm[0]) / 2), r1((c5[1] + nm[1]) / 2), r1((c5[2] + nm[2]) / 2)],
  };
  for (let a = 0; a < 3; a++) EYE[a] = 4.4 * FRONT[a];   // until the engine says where the eye is: the default view's

  // ---------------------------------------------------------------- explore
  const controls = [
    // (the knots: offered on the map of processes, scene 0, only)
    { key: 'clouds', label: 'Processes', options: [['shown', 'Shown'], ['hidden', 'Hidden']], scenes: [0] },
    { key: 'links', label: 'Links', options: [['on', 'On'], ['off', 'Off']] },
    { key: 'shell', label: 'Outer shell', options: [['shown', 'Shown'], ['faint', 'Faint']] },
  ];
  const explore = c => ({ net_links: c.links === 'off' ? 0 : 1, net_shell: c.shell === 'faint' ? 0 : 1, net_clouds: c.clouds === 'hidden' ? 0 : 1 });

  // ---------------------------------------------------------------- picking and api()
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray();
  // a ray in world coordinates (a THREE.Raycaster, a THREE.Ray, or { origin, direction } as vectors or arrays) to the
  // protein nearest it within a small angle that is shown (grown in, not veiled, not handed to the core); -1 none
  const PK = { frame: -1, now: 0, p: new Float32Array(3 * n), g: new Float32Array(n) };
  function pick(rc) {
    if (!rc || set.uA.value < 0.3 || !set.group.visible) return -1;
    const r = rc.ray || rc, o = r.origin, d = r.direction;
    if (!o || !d) return -1;
    const v3 = v => (Array.isArray(v) ? v : [v.x, v.y, v.z]);
    _ray.origin.fromArray(v3(o)); _ray.direction.fromArray(v3(d)).normalize();
    set.group.updateMatrixWorld();
    _ray.applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    const ox = _ray.origin.x, oy = _ray.origin.y, oz = _ray.origin.z, dx = _ray.direction.x, dy = _ray.direction.y, dz = _ray.direction.z;
    let best = -1, bs = 1;
    // (every protein's place and growth once a frame, however many rays ask: a headset points two every frame)
    if (PK.frame !== PK.now) { PK.frame = PK.now; for (let i = 0; i < n; i++) { placeAt(i, _q); PK.p[3 * i] = _q[0]; PK.p[3 * i + 1] = _q[1]; PK.p[3 * i + 2] = _q[2]; PK.g[i] = _g; } }
    for (let i = 0; i < n; i++) {
      _q[0] = PK.p[3 * i]; _q[1] = PK.p[3 * i + 1]; _q[2] = PK.p[3 * i + 2];
      const x = _q[0] - ox, y = _q[1] - oy, z = _q[2] - oz, along = x * dx + y * dy + z * dz;
      if (along <= 0.02) continue;
      const off = Math.sqrt(Math.max(0, x * x + y * y + z * z - along * along)), tol = 0.006 + 0.012 * along;
      if (off > tol) continue;
      if (PK.g[i] < 0.5 || cur.core * cenNow(i) > 0.5 || veilAt(_q) > 0.5) continue;
      const s = off / tol + along * 0.02;
      if (s < bs) { bs = s; best = i; }
    }
    return best;
  }
  const API = {
    n, pick,
    pos: (i, out) => placeAt(i >= 0 && i < n ? i : C5, out || [0, 0, 0]),
    eye: (x, y, z) => { EYE[0] = x; EYE[1] = y; EYE[2] = z; },
    scene: () => cur.s,
    term: (i, out) => termMid(i === undefined ? cur.term : i, out || [0, 0, 0]),
    knotName,   // a knot's short name, as its tag (the story's text names them so)
  };

  setPair(0);
  return Object.assign(set, {
    params: { net_a: 1, net_scene: 0, net_grow: 1, net_shell: 1, net_links: 1, net_cdk5: 0, net_hyper: 0, net_partners: 0,
      net_pick: -1, net_family: 0, net_homes: 0, net_path: -1, net_term: -1, net_termA: 0, net_near: 0, net_veil: 0,
      net_core: 0, net_dim: 0, net_hub: 0, net_shells: 0, net_landTags: 0, net_clouds: 0 },
    update, anchors, labels, cam, controls, explore, api: () => API,
  });
};
