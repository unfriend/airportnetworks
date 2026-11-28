// The substances (builder B): every substance of the network as a soft glowing point (XDATA.NN, 9,764), in one of
// three arrangements, morphed on the graphics card: a slow cloud round you (ours: seeded, a hollow shell 0.45 to 1.45
// round the middle, so a camera or a head at the middle stands inside it), the chemist's shelves (XDATA.shelf: one ring
// per chemical family, the generator's) and the authors' own 3D layout of the network (XDATA.pos, never laid out again
// here). The 45,000 drawn links (XDATA.links, the strongest) are one LineSegments that shares the points' buffers (an
// index into them), so every thread follows its two ends through every move. Coloured by chemical family (our
// colours, LOOK.family) or by community (the authors' colours, XDATA.comm.col; a community below the top level gets
// a lighter or darker shade of its top group's, so the smaller groups show). Three draw calls: points, threads, halos.
//
// Params (the engine eases them; steps marked *step*, never eased):
//   cloud_a        the fade
//   cloud_come     0..1 the points come in from far away (each after its own delay)
//   cloud_shelf    0..1 drift cloud -> shelves;  cloud_net 0..1 -> the authors' layout (each point after its own delay,
//                  with a sideways bow: the cloud flows rather than jumps)
//   cloud_turn     the shelves turned about the vertical (radians)
//   cloud_drift    0..1 how much the points drift (a slow wobble, a function of the time: seeking works)
//   cloud_links    0..1 the drawn threads;  cloud_alive 0..1 slow pulses running along them
//   cloud_mono     0..1 every point in one soft warm colour (chapter 1, before the families)
//   cloud_col      0..1 chemical family -> community;  cloud_level *step* 0 top, 1 middle, 2 fine
//   cloud_small    0..1 at the top level, the 105 small groups (under 50 substances) grey and dim
//   cloud_split    0..1 the large groups pulled apart a little (each by its top group's middle)
//   cloud_names    0..1 the large groups' names: SORT_EXAMPLES one by one over 0..0.75 (a quarter each), the three
//                  largest others from 0.75 (minor): six at most
//   cloud_famTags  0..1 the five largest chemical families named on their shelves, with their counts
//   cloud_focus    *step* -1, or a community (XDATA.comm index): it lit, its name tagged
//   cloud_pick     *step* -1, or a substance: it lit (white, a halo), its drawn threads and neighbours lit, its tag
//   cloud_dim      0..1 how far everything not lit (focus, pick and its neighbours) steps back (to 10 %)
//   cloud_pair     0..1 the pair set's two substances (pair_s1, pair_s2) lit, with their tags and their thread
//   cloud_hideClot 0..1 the clotting group's own points hidden (the clot set draws them where it gathers them)
// Anchors: centre, top, pick (the picked substance now), focus (the focused community's middle), pairA, pairB.
// Views: default (the whole network from outside), inside (the camera at the middle), rings (the shelves from outside,
// a little above), g11 (top group 11, folate and other vitamins), g1121 (the clotting group, close: as the clot set's
// default view), near (the network close, from outside).
SETS.cloud = function (K) {
  const { THREE, clamp, smooth } = K;
  const set = K.newSet('cloud');
  const X = XDATA, n = X.NN, CM = X.comm, r = K.rng(11);
  const famCol = X.classes.names.map((nm, c) => K.rgb(LOOK.family[c] || LOOK.none));
  const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

  // ---------------------------------------------------------------- the communities' middles (in the authors' layout)
  const CEN = new Float32Array(3 * CM.n), CNT = new Uint32Array(CM.n);
  for (let i = 0; i < n; i++) for (let lv = 0; lv < 3; lv++) {
    const k = X.commOf(i, lv);
    if (k < 0) continue;
    CNT[k]++; for (let j = 0; j < 3; j++) CEN[3 * k + j] += X.pos[3 * i + j];
  }
  for (let k = 0; k < CM.n; k++) if (CNT[k]) for (let j = 0; j < 3; j++) CEN[3 * k + j] /= CNT[k];
  const BIG = 50, isBig = k => k >= 0 && CM.size[k] >= BIG;
  // the large top groups, largest first (the authors number them by size)
  const bigTops = CM.byLevel[0].filter(isBig).sort((a, b) => CM.size[b] - CM.size[a]);
  // a top group's pull when the groups move apart: out from the middle, by its own middle and a little more
  const SPLIT = new Float32Array(3 * CM.n);
  for (const k of CM.byLevel[0]) {
    const c = [CEN[3 * k], CEN[3 * k + 1], CEN[3 * k + 2]], l = Math.hypot(c[0], c[1], c[2]) || 1, s = isBig(k) ? 1 : 0.6;
    for (let j = 0; j < 3; j++) SPLIT[3 * k + j] = s * (0.32 * c[j] + 0.12 * c[j] / l);
  }

  // ---------------------------------------------------------------- per point
  const g = new THREE.BufferGeometry();
  const DR = new Float32Array(3 * n), SH = X.shelf.slice(0, 3 * n), NT = X.pos.slice(0, 3 * n), SP = new Float32Array(3 * n);
  const AI = new Float32Array(4 * n), FC = new Float32Array(3 * n), KC = new Float32Array(3 * n), FL = new Float32Array(n);
  const lmax = Math.log(1 + Math.max(...X.ngenes.subarray(0, n)));
  for (let i = 0; i < n; i++) {
    // the drift cloud: a seeded direction, at 0.45 to 1.45 from the middle (denser further in), so nothing sits on you
    const u = K.unit(r), d = 0.45 + 1.0 * Math.pow(r(), 0.8);
    DR[3 * i] = u[0] * d; DR[3 * i + 1] = u[1] * d * 0.8; DR[3 * i + 2] = u[2] * d;
    const k = X.commOf(i, 0);
    if (k >= 0) for (let j = 0; j < 3; j++) SP[3 * i + j] = SPLIT[3 * k + j];
    // x its delay (0..1), y its phase, z its size (a little larger for the better studied), w 1 in a large top group
    AI[4 * i] = hash(i); AI[4 * i + 1] = hash(i + 7777) * 6.2832;
    AI[4 * i + 2] = 0.0075 + 0.006 * Math.log(1 + X.ngenes[i]) / lmax; AI[4 * i + 3] = isBig(k) ? 1 : 0;
    FC.set(famCol[X.prim[i]], 3 * i);
  }
  const attr = (geo, name, a, k) => { const b = new THREE.BufferAttribute(a, k); geo.setAttribute(name, b); return b; };
  attr(g, 'position', DR, 3); attr(g, 'aShelf', SH, 3); attr(g, 'aNet', NT, 3); attr(g, 'aSplit', SP, 3); attr(g, 'aI', AI, 4);
  attr(g, 'aFam', FC, 3); const aKC = attr(g, 'aKc', KC, 3), aFL = attr(g, 'aF', FL, 1);
  const BS = new THREE.Sphere(new THREE.Vector3(), 12);
  g.boundingSphere = BS;
  // the threads: the same buffers, two indices a thread
  const lg = new THREE.BufferGeometry();
  for (const nm of ['position', 'aShelf', 'aNet', 'aSplit', 'aI', 'aFam', 'aKc', 'aF']) lg.setAttribute(nm, g.attributes[nm]);
  lg.setIndex(new THREE.BufferAttribute(Uint16Array.from(X.links), 1));
  lg.boundingSphere = BS;

  // ---------------------------------------------------------------- shaders
  const U = {
    uShelf: { value: 0 }, uNet: { value: 1 }, uTurn: { value: 0 }, uCome: { value: 1 }, uDrift: { value: 0 }, uSplit: { value: 0 },
    uCol: { value: 0 }, uMono: { value: 0 }, uSmall: { value: 0 }, uDim: { value: 0 }, uPair: { value: 0 }, uHideClot: { value: 0 },
    uLinks: { value: 0 }, uAlive: { value: 0 }, uNearU: { value: 0.1 }, uNearM: { value: 0 },
    uMonoCol: { value: new THREE.Color('#ffc890') }, uGrey: { value: new THREE.Color('#7d8796') },
  };
  const MOVE = `
uniform float uShelf, uNet, uTurn, uCome, uDrift, uSplit, uNearU, uNearM;
attribute vec3 aShelf, aNet, aSplit; attribute vec4 aI;
float stg(float u, float d) { float e = clamp((u - 0.35 * d) / 0.65, 0.0, 1.0); return e * e * (3.0 - 2.0 * e); }
// a point's place now: from far away into the drift cloud (come), onto its shelf, into the authors' layout (and apart)
vec3 place(vec3 dr) {
  float ph = aI.y, come = stg(uCome, aI.x);
  vec3 w = vec3(sin(uTime * 0.13 + ph), sin(uTime * 0.1 + ph * 1.7), cos(uTime * 0.11 + ph * 2.3)) * (0.03 * uDrift);
  vec3 a = dr * (1.0 + 5.0 * (1.0 - come)) + w;
  float c = cos(uTurn), s = sin(uTurn);
  vec3 b = vec3(c * aShelf.x + s * aShelf.z, aShelf.y, -s * aShelf.x + c * aShelf.z);
  float e1 = stg(uShelf, aI.x), e2 = stg(uNet, fract(aI.x * 7.31));
  vec3 d1 = b - a, p = a + d1 * e1 + vec3(-d1.z, 0.0, d1.x) * (0.22 * sin(3.14159 * e1));
  vec3 q = aNet + aSplit * uSplit + w * 0.3, d2 = q - p;
  return p + d2 * e2 + vec3(-d2.z, 0.0, d2.x) * (0.18 * sin(3.14159 * e2));
}
float bit(float x, float b) { return mod(floor(x / exp2(b)), 2.0); }
// x the depth cue (from outside: brighter in front of the middle, darker behind), y the fade near the eye (keep clear:
// uNearU in the set's units on a screen, uNearM metres in a headset), z the set's scale in view space
vec3 viewFx(vec4 mv) {
  float sc = length(modelViewMatrix[0].xyz);
  vec3 o = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float cd = length(o) / sc, far = smoothstep(0.5, 1.6, cd);
  float cue = mix(1.0, clamp(1.0 - (o.z - mv.z) / sc * 0.45, 0.42, 1.3), far);
  float l = length(mv.xyz);
  float near = smoothstep(uNearU, uNearU * 1.8, l / sc) * smoothstep(uNearM, uNearM * 1.45 + 0.001, l);
  return vec3(cue, near, sc);
}
`;
  const mat = (vs, fs) => {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U),
      vertexShader: K.GLSL + MOVE + vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    set.mats.push(m);
    return m;
  };
  // (what lights a point: bit 0 in the focus, 1 the pick, 2 the pick's neighbour, 3 the pair, 4 the clotting group)
  const COLOUR = `
attribute vec3 aFam, aKc; attribute float aF;
uniform float uA, uCol, uMono, uSmall, uDim, uPair, uHideClot;
uniform vec3 uMonoCol, uGrey;
varying vec3 vC; varying float vA;
vec3 colour(out float br, out float lit, out float pk) {
  vec3 col = mix(aFam, aKc, uCol);
  // (the authors' colours are pale: a little more saturated, so families and groups tell apart when added up)
  col = clamp(mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 1.5), 0.0, 1.0);
  float sm = uCol * uSmall * (1.0 - aI.w);
  col = mix(col, uGrey, 0.8 * sm); br = 1.0 - 0.5 * sm;
  col = mix(col, uMonoCol, uMono);
  pk = bit(aF, 1.0);
  lit = max(max(bit(aF, 0.0), pk), bit(aF, 2.0));
  br *= mix(1.0, mix(0.16, 1.25, lit), uDim);
  return col;
}`;
  const ptMat = mat(COLOUR + `
varying float vHot;
void main() {
  vec3 p = place(position);
  float br, lit, pk;
  vec3 col = colour(br, lit, pk);
  float pr = bit(aF, 3.0) * uPair;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 fx = viewFx(mv);
  float dist = length(mv.xyz) / fx.z;
  // (from inside, the far side of the cloud a little dimmer: depth)
  br *= mix(1.0, mix(0.45, 1.0, smoothstep(2.4, 0.5, dist)), 1.0 - smoothstep(0.5, 1.6, length((modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz) / fx.z));
  float sz = aI.z * mix(1.0, 1.7, smoothstep(1.4, 4.0, dist));
  sz *= 1.0 + 0.35 * uDim * lit + 1.6 * uDim * pk + 2.2 * pr;
  col = mix(col, vec3(1.0, 0.97, 0.9), 0.55 * max(pk * uDim, pr));
  // (the authors' layout is dense in its middle: a little dimmer there, so the colours survive adding up)
  br *= 1.0 - 0.42 * uNet * (1.0 - uDim * lit);
  br = max(br, 1.6 * pr);
  // never a blob close up: at most about 1.1 degrees across
  sz = min(sz, 0.02 * dist);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(sz, mv);
  vC = col * br * fx.x; vHot = max(pk * uDim, pr);
  vA = uA * fx.y * (1.0 - bit(aF, 4.0) * uHideClot);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA, vHot;
void main() {
  vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.62, 0.1, d), halo = pow(1.0 - d, 2.0);
  gl_FragColor = vec4(vC * (0.62 + 0.5 * core) + vec3(0.9) * vHot * smoothstep(0.4, 0.0, d), vA * (core * 0.78 + halo * 0.42));
}`);
  const points = new THREE.Points(g, ptMat);
  points.renderOrder = 3; set.group.add(points);
  const lnMat = mat(COLOUR + `
uniform float uLinks, uAlive;
varying float vPh, vPr, vPa;
// the most any fragment of any thread can get now (the fragment shader's a: lit ends, the alive pulse, the pair's
// thread), from the uniforms alone, so both ends of a thread agree; under the discard there, no thread is rasterised
float linkTop() {
  return uA * (uLinks * 0.024 * mix(0.4, 1.0, uNet) * (1.0 + 5.0 * uDim) * (1.0 + 0.25 * uDim) * (1.0 + 1.35 * uAlive) + 0.85 * uPair);
}
void main() {
  if (linkTop() < 0.0029) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; vPa = 0.0; vPr = 0.0; vPh = 0.0; vC = vec3(0.0); return; }
  vec3 p = place(position);
  float br, lit, pk;
  vec3 col = colour(br, lit, pk);
  float pr = bit(aF, 3.0) * uPair;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 fx = viewFx(mv);
  gl_Position = projectionMatrix * mv;
  vC = col * fx.x;
  // (lit ends: both lit, the whole thread; one, it fades along the thread: the varying does it)
  vA = uA * fx.y * (1.0 - bit(aF, 4.0) * uHideClot) * uLinks * 0.024 * mix(0.4, 1.0, uNet) * mix(1.0, mix(0.1, 6.0, lit), uDim) * br;
  vPh = aI.y * 1.6; vPr = pr; vPa = uA * fx.y * uPair;
}`, `
uniform float uAlive, uTime;
varying vec3 vC; varying float vA, vPh, vPr, vPa;
void main() {
  // slow pulses running along the threads (the phases of a thread's two ends, interpolated along it)
  float k = 0.5 + 0.5 * sin(vPh * 2.0 - uTime * 1.1);
  float a = vA * (1.0 + uAlive * (1.6 * pow(k, 12.0) - 0.25));
  // the pair's own thread: both ends the pair's (the varying stays 1 along it only then)
  float pa = step(0.985, vPr) * vPa;
  a += 0.85 * pa;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(vC, vec3(1.0, 0.86, 0.55), pa), a);
}`);
  const links = new THREE.LineSegments(lg, lnMat);
  links.renderOrder = 2; set.group.add(links);

  // ---------------------------------------------------------------- halos: the pick and the pair (one draw)
  const hg = K.pointsGeo(3), HP = hg.attributes.position.array, HC = hg.attributes.aCol.array, HS = hg.attributes.aSize.array, HA = hg.attributes.aA.array;
  hg.boundingSphere = BS;
  const halos = new THREE.Points(hg, K.points(set));
  halos.renderOrder = 4; set.group.add(halos);

  // ---------------------------------------------------------------- the same placing on the CPU (anchors, picking)
  const cur = { shelf: 0, net: 1, turn: 0, come: 1, drift: 0, split: 0, t: 0 };
  const stg = (u, d) => smooth(clamp((u - 0.35 * d) / 0.65, 0, 1));
  const fract = x => x - Math.floor(x);
  // (still: without the slow drift wobble, for the pick's cache; the wobble (w0, w1, w2), each at most dw, moves the
  // place linearly, by at most 1.3 * |w|: WOB below)
  function placeAt(i, out, still) {
    const ph = AI[4 * i + 1], d = AI[4 * i], t = cur.t, dw = still ? 0 : 0.03 * cur.drift, come = stg(cur.come, d);
    const w0 = dw && Math.sin(t * 0.13 + ph) * dw, w1 = dw && Math.sin(t * 0.1 + ph * 1.7) * dw, w2 = dw && Math.cos(t * 0.11 + ph * 2.3) * dw;
    const f = 1 + 5 * (1 - come), c = Math.cos(cur.turn), s = Math.sin(cur.turn);
    const ax = DR[3 * i] * f + w0, ay = DR[3 * i + 1] * f + w1, az = DR[3 * i + 2] * f + w2;
    const bx = c * SH[3 * i] + s * SH[3 * i + 2], by = SH[3 * i + 1], bz = -s * SH[3 * i] + c * SH[3 * i + 2];
    const e1 = stg(cur.shelf, d), e2 = stg(cur.net, fract(d * 7.31)), b1 = 0.22 * Math.sin(Math.PI * e1), b2 = 0.18 * Math.sin(Math.PI * e2);
    let dx = bx - ax, dy = by - ay, dz = bz - az;
    let px = ax + dx * e1 - dz * b1, py = ay + dy * e1, pz = az + dz * e1 + dx * b1;
    const qx = NT[3 * i] + SP[3 * i] * cur.split + w0 * 0.3, qy = NT[3 * i + 1] + SP[3 * i + 1] * cur.split + w1 * 0.3, qz = NT[3 * i + 2] + SP[3 * i + 2] * cur.split + w2 * 0.3;
    dx = qx - px; dy = qy - py; dz = qz - pz;
    px += dx * e2 - dz * b2; py += dy * e2; pz += dz * e2 + dx * b2;
    out[0] = px; out[1] = py; out[2] = pz;
    return out;
  }
  // a community's middle now (in the authors' layout, pulled apart as its top group is)
  function cenAt(k, out) {
    const top = k >= 0 ? topOf(k) : -1;
    for (let j = 0; j < 3; j++) out[j] = k < 0 ? 0 : CEN[3 * k + j] + SPLIT[3 * top + j] * cur.split;
    return out;
  }
  const topOf = k => { while (k >= 0 && CM.lv[k] > 0) k = CM.parent[k]; return k; };

  // ---------------------------------------------------------------- the eye (each render: the camera drawing the points)
  const EYE = [0, 0, 4], FWD = [0, 0, -1], _mi = new THREE.Matrix4(), _cp = new THREE.Vector3(), _cd = new THREE.Vector3();
  // (read from the camera's matrixWorld only, never camera.getWorldDirection: in a headset this camera is three.js r128's
  // eye camera, its pose only in its matrix, and updateWorldMatrix would put that eye at the space's origin for all that
  // is drawn after the points, the scene, the rays and the shell's read-outs stuck to the head: v212 to v226)
  points.onBeforeRender = (rd, sc, camera) => {
    _mi.copy(set.group.matrixWorld).invert();
    _cp.setFromMatrixPosition(camera.matrixWorld);
    _cd.set(0, 0, -1).transformDirection(camera.matrixWorld).add(_cp).applyMatrix4(_mi);
    _cp.applyMatrix4(_mi);
    EYE[0] = _cp.x; EYE[1] = _cp.y; EYE[2] = _cp.z;
    FWD[0] = _cd.x - _cp.x; FWD[1] = _cd.y - _cp.y; FWD[2] = _cd.z - _cp.z;
  };

  // ---------------------------------------------------------------- the chemical families' shelves (rings)
  // each ring's height and radius (the mean of its points), for the five largest families' tags
  const RING = famCol.map(() => [0, 0, 0]);
  for (let i = 0; i < n; i++) { const R = RING[X.prim[i]]; R[0] += SH[3 * i + 1]; R[1] += Math.hypot(SH[3 * i], SH[3 * i + 2]); R[2]++; }
  for (const R of RING) if (R[2]) { R[0] /= R[2]; R[1] /= R[2]; }
  const FAMS = X.meta.shelves.slice(0, 5);
  const famName = c => { const s = X.classes.names[c]; return s.charAt(0) + s.slice(1).toLowerCase(); };
  // a family's tag stands on its ring where you look: on the side nearest you from outside, straight ahead from inside
  function ringAt(c, out) {
    const R = RING[c], ex = Math.hypot(EYE[0], EYE[2]);
    // (from outside: at the ring's left or right edge as you see it, alternately, where the rings stand apart; from
    // inside: a little left or right of straight ahead)
    const sd = FAMS.indexOf(c) % 2 ? 1 : -1;
    const a = ex > 0.7 ? Math.atan2(EYE[0], EYE[2]) + sd * 1.25 : Math.atan2(FWD[0], FWD[2]) + sd * 0.3;
    out[0] = R[1] * Math.sin(a); out[1] = R[0]; out[2] = R[1] * Math.cos(a);
    return out;
  }

  // ---------------------------------------------------------------- what is lit (refilled when a step changes)
  const CLOT = new Set(X.ex.clot.members);
  const NB = new Map();   // a substance's drawn threads' other ends
  for (let e = 0; e < X.links.length; e += 2) {
    const a = X.links[e], b = X.links[e + 1];
    (NB.get(a) || NB.set(a, []).get(a)).push(b); (NB.get(b) || NB.set(b, []).get(b)).push(a);
  }
  let lastFlags = '', lastLevel = -1;
  function refillFlags(focus, pick, s1, s2) {
    const sig = [focus, pick, s1, s2].join();
    if (sig === lastFlags) return;
    lastFlags = sig;
    const lv = focus >= 0 ? CM.lv[focus] : 0;
    for (let i = 0; i < n; i++) FL[i] = (focus >= 0 && X.commOf(i, lv) === focus ? 1 : 0) + (CLOT.has(i) ? 16 : 0) + (i === s1 || i === s2 ? 8 : 0);
    if (pick >= 0 && pick < n) { FL[pick] += 2; for (const j of NB.get(pick) || []) if (!(FL[j] & 4)) FL[j] += 4; }
    aFL.needsUpdate = true;
  }
  // a community's colour at a level: its top group's (the authors'), a little lighter or darker for each group below
  function refillColours(lv) {
    if (lv === lastLevel) return;
    lastLevel = lv;
    const cache = new Map();
    for (let i = 0; i < n; i++) {
      const k = X.commOf(i, lv);
      let c = cache.get(k);
      if (!c) {
        const top = topOf(k);
        c = K.rgb(CM.col[top >= 0 ? top : k]);
        if (lv > 0 && k >= 0) {
          const sib = CM.byLevel[lv].filter(q => CM.parent[q] === CM.parent[k]), j = sib.indexOf(k), m = sib.length;
          const f = m > 1 ? -0.42 + 0.84 * j / (m - 1) : 0;   // (siblings from lighter to darker, largest first)
          c = c.map(v => (f < 0 ? v + (1 - v) * -f : v * (1 - f * 0.75)));
        }
        cache.set(k, c);
      }
      KC.set(c, 3 * i);
    }
    aKC.needsUpdate = true;
  }
  refillColours(0); refillFlags(-1, -1, -1, -1);

  // ---------------------------------------------------------------- labels (at most about six at once)
  const S0 = { cloud_names: 0, cloud_famTags: 0, cloud_focus: -1, cloud_pick: -1, cloud_pair: 0, pair_s1: -1, pair_s2: -1 };
  let S = S0;
  const EXAMPLES = (typeof SORT_EXAMPLES !== 'undefined' ? SORT_EXAMPLES : []).map(id => CM.find(0, id)).filter(k => k >= 0);
  const OTHERS = bigTops.filter(k => !EXAMPLES.includes(k)).slice(0, 3);
  const words = k => { const w = CM.words(k); return w.charAt(0).toUpperCase() + w.slice(1); };
  const lvName = ['', ' · a smaller group', ' · a fine group'];
  const _a = [0, 0, 0];
  const labels = [];
  FAMS.forEach(c => labels.push({ at: () => ringAt(c, [0, 0, 0]), text: [famName(c), ' · ' + fmt(X.classes.count[c])], alpha: s => s.cloud_famTags * (1 - s.cloud_net) }));
  EXAMPLES.forEach((k, j) => labels.push({ at: () => cenAt(k, [0, 0, 0]), text: [words(k), ' · ' + fmt(CM.size[k])],
    alpha: s => (s.cloud_focus >= 0 ? 0 : clamp((s.cloud_names - j / 4) * 8, 0, 1)) * clamp(s.cloud_col * 2 - 1, 0, 1) }));
  OTHERS.forEach(k => labels.push({ at: () => cenAt(k, [0, 0, 0]), minor: true, text: [words(k), ' · ' + fmt(CM.size[k])],
    alpha: s => (s.cloud_focus >= 0 ? 0 : clamp((s.cloud_names - 0.75) * 8, 0, 1)) * clamp(s.cloud_col * 2 - 1, 0, 1) }));
  // (in the story's dive the levels above the clotting group are not named: their words would speak of something else
  // while the voice heads for blood clotting; explore names every group)
  const story = () => typeof APP !== 'undefined' && APP.mode === 'story';
  labels.push({ at: 'focus', text: () => { const k = S.cloud_focus; return k >= 0 && k < CM.n ? (story() && CM.lv[k] < 2 ? [CM.lv[k] ? 'A smaller group' : 'A larger group', ` · ${fmt(CM.size[k])} substances`] : [words(k), ` · ${fmt(CM.size[k])} substances${lvName[CM.lv[k]]}`]) : ['', '']; },
    alpha: s => (s.cloud_focus >= 0 && s.cloud_pick < 0 ? clamp(s.cloud_dim * 2 - 0.6, 0, 1) : 0) * (1 - clamp(((s.clot_a || 0) - 0.2) * 3, 0, 1)) });
  labels.push({ at: 'pick', text: () => { const i = S.cloud_pick; return i >= 0 && i < n ? [X.label[i], ` · ${fmt(X.ngenes[i])} genes`] : ['', '']; },
    alpha: s => (s.cloud_pick >= 0 ? clamp(s.cloud_dim * 2 - 0.5, 0, 1) : 0) });
  labels.push({ at: 'pairA', text: () => [X.label[S.pair_s1] || '', ''], alpha: s => clamp(s.cloud_pair * 2 - 1, 0, 1) });
  labels.push({ at: 'pairB', text: () => [X.label[S.pair_s2] || '', ''], alpha: s => clamp(s.cloud_pair * 2 - 1, 0, 1) });
  const valid = i => i >= 0 && i < n;

  // ---------------------------------------------------------------- picking (explore): the point nearest a ray
  // (every point's place without the wobble, refilled only when what placeAt reads besides the time changes: in explore
  // the time is the clock, so a cache keyed on it was refilled every frame. A point within the tolerance widened by the
  // wobble's bound is placed exactly and tested as before, so the pick is the same point as with every place exact.)
  const PK = { shelf: NaN, net: NaN, come: NaN, turn: NaN, split: NaN, p: new Float32Array(3 * n) };
  const WOB = 1.3 * Math.sqrt(3) * 0.03, _f = new Float32Array(3);
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray(), _q = [0, 0, 0];
  function pick(rc) {
    if (!rc || set.uA.value < 0.3 || !set.group.visible) return -1;
    const ry = rc.ray || rc;
    set.group.updateMatrixWorld();
    _ray.copy(ry).applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    if (PK.shelf !== cur.shelf || PK.net !== cur.net || PK.come !== cur.come || PK.turn !== cur.turn || PK.split !== cur.split) {
      PK.shelf = cur.shelf; PK.net = cur.net; PK.come = cur.come; PK.turn = cur.turn; PK.split = cur.split;
      for (let i = 0; i < n; i++) { placeAt(i, _q, true); PK.p[3 * i] = _q[0]; PK.p[3 * i + 1] = _q[1]; PK.p[3 * i + 2] = _q[2]; }
    }
    const o = _ray.origin, d = _ray.direction.normalize(), M = WOB * cur.drift + 1e-5;
    let best = -1, bs = 1;
    for (let i = 0; i < n; i++) {
      let x = PK.p[3 * i] - o.x, y = PK.p[3 * i + 1] - o.y, z = PK.p[3 * i + 2] - o.z, al = x * d.x + y * d.y + z * d.z;
      if (al + M <= 0.03 || Math.sqrt(Math.max(0, x * x + y * y + z * z - al * al)) - M > 0.004 + 0.011 * (al + M)) continue;
      if (M > 1e-5) {   // (a candidate: its exact place, as a float as the cache keeps it)
        placeAt(i, _q); _f[0] = _q[0]; _f[1] = _q[1]; _f[2] = _q[2];
        x = _f[0] - o.x; y = _f[1] - o.y; z = _f[2] - o.z; al = x * d.x + y * d.y + z * d.z;
      }
      if (al <= 0.03) continue;
      const off = Math.sqrt(Math.max(0, x * x + y * y + z * z - al * al)), tol = 0.004 + 0.011 * al;
      if (off > tol) continue;
      // (a lit point first, when something is lit)
      const sc = off / tol + al * 0.03 - (S.cloud_dim > 0.5 && (FL[i] & 7) ? 0.5 : 0);
      if (sc < bs) { bs = sc; best = i; }
    }
    return best;
  }

  const API = { n, pick, pos: (i, out) => placeAt(valid(i) ? i : 0, out || [0, 0, 0]), cen: (k, out) => cenAt(k, out || [0, 0, 0]),
    neighbours: i => NB.get(i) || [], eye: () => EYE };

  return Object.assign(set, {
    params: { cloud_a: 1, cloud_come: 1, cloud_shelf: 1, cloud_net: 1, cloud_turn: 0, cloud_drift: 0.25, cloud_links: 1, cloud_alive: 0.5,
      cloud_mono: 0, cloud_col: 0, cloud_level: 0, cloud_small: 1, cloud_split: 0, cloud_names: 0, cloud_famTags: 0,
      cloud_focus: -1, cloud_pick: -1, cloud_dim: 0, cloud_pair: 0, cloud_hideClot: 0 },
    update(s, t) {
      S = s;
      cur.shelf = clamp(s.cloud_shelf, 0, 1); cur.net = clamp(s.cloud_net, 0, 1); cur.turn = s.cloud_turn; cur.come = clamp(s.cloud_come, 0, 1);
      cur.drift = clamp(s.cloud_drift, 0, 1); cur.split = clamp(s.cloud_split, 0, 1); cur.t = t;
      U.uShelf.value = cur.shelf; U.uNet.value = cur.net; U.uTurn.value = cur.turn; U.uCome.value = cur.come; U.uDrift.value = cur.drift; U.uSplit.value = cur.split;
      U.uCol.value = clamp(s.cloud_col, 0, 1); U.uMono.value = clamp(s.cloud_mono, 0, 1); U.uSmall.value = clamp(s.cloud_small, 0, 1) * (Math.round(s.cloud_level) === 0 ? 1 : 0);
      U.uDim.value = clamp(s.cloud_dim, 0, 1); U.uPair.value = clamp(s.cloud_pair, 0, 1); U.uHideClot.value = clamp(s.cloud_hideClot, 0, 1);
      U.uLinks.value = clamp(s.cloud_links, 0, 1); U.uAlive.value = clamp(s.cloud_alive, 0, 1);
      // the threads are not drawn while none can show (the shader's linkTop, a little under its cull): 45,000 long
      // chords at alpha 0 in the drift cloud cost a headset most of its frame (from the params only, so seeking works)
      links.visible = set.uA.value * (U.uLinks.value * 0.024 * (0.4 + 0.6 * U.uNet.value) * (1 + 5 * U.uDim.value) * (1 + 0.25 * U.uDim.value) * (1 + 1.35 * U.uAlive.value) + 0.85 * U.uPair.value) >= 0.0028;
      // keep clear: in a headset nothing nearer than 0.35 m to the head; on a screen a little room round the camera
      const xr = !!(GL.renderer && GL.renderer.xr && GL.renderer.xr.isPresenting);
      U.uNearM.value = xr ? 0.35 : 0; U.uNearU.value = xr ? 0.001 : 0.09;
      const lv = clamp(Math.round(s.cloud_level), 0, 2), f = Math.round(s.cloud_focus), p = Math.round(s.cloud_pick);
      refillColours(lv);
      refillFlags(f >= 0 && f < CM.n ? f : -1, valid(p) ? p : -1, s.cloud_pair > 0.001 ? Math.round(s.pair_s1) : -1, s.cloud_pair > 0.001 ? Math.round(s.pair_s2) : -1);
      // halos: the pick (white), the pair (warm)
      const hp = [[valid(p) ? p : -1, clamp(s.cloud_dim, 0, 1), '#ffffff'], [Math.round(s.pair_s1), s.cloud_pair, '#ffd27a'], [Math.round(s.pair_s2), s.cloud_pair, '#ffd27a']];
      hp.forEach(([i, a, c], j) => {
        HA[j] = valid(i) && a > 0.01 ? a * (0.55 + 0.15 * Math.sin(t * 2.4)) : 0;
        if (HA[j]) { placeAt(i, _a); HP.set(_a, 3 * j); HC.set(K.rgb(c), 3 * j); HS[j] = 0.055; }
      });
      hg.attributes.position.needsUpdate = hg.attributes.aCol.needsUpdate = hg.attributes.aSize.needsUpdate = hg.attributes.aA.needsUpdate = true;
    },
    anchors: {
      centre: [0, 0, 0], top: [0, 1.05, 0],
      pick: () => (valid(Math.round(S.cloud_pick)) ? placeAt(Math.round(S.cloud_pick), [0, 0, 0]) : [0, 0, 0]),
      focus: () => cenAt(Math.round(S.cloud_focus), [0, 0, 0]),
      pairA: () => (valid(Math.round(S.pair_s1)) ? placeAt(Math.round(S.pair_s1), [0, 0, 0]) : [0, 0, 0]),
      pairB: () => (valid(Math.round(S.pair_s2)) ? placeAt(Math.round(S.pair_s2), [0, 0, 0]) : [0, 0, 0]),
    },
    labels,
    cam: (() => {
      const r3 = v => Math.round(v * 1000) / 1000, c11 = [0, 1, 2].map(j => r3(CEN[3 * CM.find(0, '11') + j])), kf = CM.find(2, X.ex.clot.id), cf = [0, 1, 2].map(j => r3(CEN[3 * kf + j] || 0));
      return { default: [20, 14, 4.4, 0, 0, 0], inside: [0, 4, 0.05, 0, 0, 0], rings: [20, 17, 4.7, 0, -0.05, 0],
        g11: [190, 12, 1.6, ...c11], g1121: [196, 10, 0.85, cf[0], r3(cf[1] + 0.035), cf[2]], near: [0, 8, 2.3, 0, 0, 0] };
    })(),
    controls: [
      { key: 'view', label: 'View', options: [['default', 'From outside'], ['inside', 'From inside']] },
      { key: 'shape', label: 'Arrange', options: [['net', 'By the genes they share'], ['shelf', 'By chemistry']] },
      { key: 'col', label: 'Colour', options: [['fam', 'Chemical family'], ['0', 'Large groups'], ['1', 'Smaller groups'], ['2', 'Fine groups']] },
      { key: 'links', label: 'Threads', options: [['1', 'On'], ['0', 'Off']] },
      { key: 'names', label: 'Group names', options: [['1', 'On'], ['0', 'Off']] },
    ],
    explore(c) {
      const fam = c.col === 'fam' || c.col === undefined, shelf = c.shape === 'shelf';
      const xb = typeof XB !== 'undefined' ? XB : { sub: -1, comm: -1 };
      const p = valid(xb.sub) ? xb.sub : -1, f = xb.comm >= 0 && xb.comm < CM.n ? xb.comm : -1;
      return { cloud_come: 1, cloud_shelf: 1, cloud_net: shelf ? 0 : 1, cloud_turn: 0, cloud_drift: 0.25, cloud_mono: 0,
        cloud_col: fam ? 0 : 1, cloud_level: fam ? 0 : +c.col, cloud_small: 1, cloud_split: !fam && !shelf ? 0.5 : 0,
        cloud_links: c.links === '0' ? 0 : 1, cloud_alive: 0.5, cloud_names: c.names === '0' || shelf ? 0 : 1, cloud_famTags: shelf ? 1 : 0,
        cloud_focus: f, cloud_pick: p, cloud_dim: f >= 0 || p >= 0 ? 0.8 : 0, cloud_pair: 0, cloud_hideClot: 0 };
    },
    api: () => API,
  });
};
