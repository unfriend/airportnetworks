// One dot opening into the crowd it stands for (chapter 2): a cube of cytoplasm about 100 nanometres across, packed as a
// real cytoplasm is (proteins fill about a fifth of it here), with real proteins from the Protein Data Bank, each
// simplified to a few balls (its residues grouped: PPI_STRUCTS' `coarse`, src/data/gen_structs.py): ubiquitin,
// calmodulin, actin, GAPDH and tubulin, sized to scale against each other and the cube, none overlapping, jiggling in
// place. One kind is marked (crowd_mark: every calmodulin), the copies one dot of the map stands for. Drawn in the
// cell's frame, at a spot in the cytosol; the cube grows out of a single dot (crowd_open).
// Every ball is one point drawn as a lit sphere with its true depth (a sphere impostor: how molecular viewers draw big
// crowds), all in one draw; the jiggle is the shader's, so nothing is sent to the graphics card a frame. The packing is
// done before the set is built, a slice a load step (SETS.crowd.prep), so no step runs long.
const CROWD = (() => {
  const SIDE = 0.2, HALF = SIDE / 2, PER_A = SIDE / 1000;   // (scene units per angstrom: the side is 100 nm, 1,000 A)
  // the kinds, largest first (packed in that order, the small ones then fill the gaps); share: of the molecules, each
  // among a cell's most plentiful proteins (illustrative shares); a muted colour each
  const KINDS = [
    { key: 'tub', share: 0.11, c: [0.55, 0.72, 0.6] },
    { key: 'gapdh', share: 0.12, c: [0.76, 0.7, 0.55] },
    { key: 'actin', share: 0.2, c: [0.78, 0.62, 0.72] },
    { key: 'cam', share: 0.12, c: [0.55, 0.62, 0.8], mark: true },
    { key: 'ubq', share: 0.45, c: [0.66, 0.7, 0.76] },
  ];
  // how many: a real cube this size holds a few thousand; WANT keeps the balls near 40,000 (one draw of points)
  const WANT = 3600, TOL = 0.9, JIG = 0.0011;
  for (const k of KINDS) {
    const S = PPI_STRUCTS[k.key];
    k.balls = S.coarse.map(b => [b[0] / 10 * PER_A, b[1] / 10 * PER_A, b[2] / 10 * PER_A, b[3] / 10 * PER_A]);
    k.reach = Math.max(...k.balls.map(b => Math.hypot(b[0], b[1], b[2]) + b[3]));
    k.want = Math.round(WANT * k.share);
  }
  const maxR = Math.max(...KINDS.flatMap(k => k.balls.map(b => b[3]))), CW = 2 * maxR;
  const rnd = (s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(23);
  const P = { done: false, ki: 0, n: 0, tries: 0, mols: [], balls: [], grid: new Map() };
  const key = (a, b, c) => a + 2000 * b + 4e6 * c, cell = v => Math.floor((v + HALF) / CW);
  const Q = new THREE.Quaternion(), V = new THREE.Vector3();
  function fits(pts) {
    for (const [x, y, z, r] of pts) {
      const gx = cell(x), gy = cell(y), gz = cell(z);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const o of P.grid.get(key(gx + dx, gy + dy, gz + dz)) || []) if (Math.hypot(o[0] - x, o[1] - y, o[2] - z) < TOL * (o[3] + r)) return false;
      }
    }
    return true;
  }
  // a slice of the packing (ms milliseconds): each molecule a random spot and turn, kept where none of its balls overlaps
  // another's; a kind stops at its share or after many misses in a row
  function pack(ms) {
    const t0 = performance.now();
    while (!P.done && performance.now() - t0 < ms) {
      const k = KINDS[P.ki];
      if (!k || P.n >= k.want || P.tries > 400) { if (!k) { P.done = true; break; } P.ki++; P.n = 0; P.tries = 0; continue; }
      const room = HALF - k.reach, c = [0, 1, 2].map(() => (rnd() * 2 - 1) * room);
      Q.setFromEuler(new THREE.Euler(rnd() * 6.283, rnd() * 6.283, rnd() * 6.283));
      const pts = k.balls.map(b => { V.set(b[0], b[1], b[2]).applyQuaternion(Q); return [c[0] + V.x, c[1] + V.y, c[2] + V.z, b[3]]; });
      if (!fits(pts)) { P.tries++; continue; }
      P.tries = 0; P.n++;
      const m = { k: P.ki, c, ph: rnd() * 6.283, mark: !!k.mark };
      P.mols.push(m);
      for (const b of pts) {
        P.balls.push([...b, P.mols.length - 1]);
        const g = key(cell(b[0]), cell(b[1]), cell(b[2]));
        if (!P.grid.has(g)) P.grid.set(g, []);
        P.grid.get(g).push(b);
      }
    }
    if (P.done) P.grid = null;
    return P.done;
  }
  return { SIDE, HALF, PER_A, KINDS, JIG, P, pack };
})();

SETS.crowd = function (K) {
  const { THREE, clamp, lerp } = K;
  const set = K.newSet('crowd');
  const { SIDE, HALF, KINDS, JIG, P } = CROWD, AT = [0.5, 0.22, 0.42];
  const holder = new THREE.Group(); holder.position.set(...AT);
  set.group.add(holder);
  // every ball: its spot, radius, colour, its molecule's phase (the jiggle) and whether it is marked
  const NB = P.balls.length, pos = new Float32Array(3 * NB), rad = new Float32Array(NB), col = new Float32Array(3 * NB), ph = new Float32Array(NB), mk = new Float32Array(NB);
  P.balls.forEach((b, i) => {
    const m = P.mols[b[4]], k = KINDS[m.k];
    pos.set(b.slice(0, 3), 3 * i); rad[i] = b[3]; col.set(k.c, 3 * i); ph[i] = m.ph; mk[i] = m.mark ? 1 : 0;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRad', new THREE.BufferAttribute(rad, 1));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1)); g.setAttribute('aMark', new THREE.BufferAttribute(mk, 1));
  const U = { uA: set.uA, uT: { value: 0 }, uJig: { value: JIG }, uHalf: { value: 400 }, uMark: { value: 0 } };
  // (each ball a lit sphere: a point as big as the ball on screen, its round face shaded and its depth written where the
  // sphere's surface is, so neighbouring balls meet as spheres do)
  const mat = new THREE.ShaderMaterial({
    uniforms: U, depthWrite: true, extensions: { fragDepth: true },
    vertexShader: `
attribute float aRad, aPh, aMark; attribute vec3 aCol;
uniform float uT, uJig, uHalf, uMark;
varying vec3 vC, vP; varying float vR;
void main() {
  vec3 p = position + uJig * vec3(sin(uT * 1.7 + aPh), sin(uT * 1.3 + aPh * 2.1), sin(uT * 1.9 + aPh * 0.7));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float r = aRad * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(2.0 * r * projectionMatrix[1][1] * uHalf / max(-mv.z, 0.001), 1.0, 256.0);
  vec3 lit = mix(aCol, vec3(0.27, 0.85, 1.0), aMark * uMark);
  vC = lit * (aMark > 0.5 ? 1.0 : 1.0 - 0.6 * uMark); vP = mv.xyz; vR = r;
}`,
    fragmentShader: `
uniform float uA; uniform mat4 projectionMatrix;   // (three.js declares it only in the vertex shader)
varying vec3 vC, vP; varying float vR;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0; c.y = -c.y;
  float d2 = dot(c, c);
  if (d2 > 1.0) discard;
  vec3 n = vec3(c, sqrt(1.0 - d2));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
  float diff = max(dot(n, L), 0.0), spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  float rim = pow(1.0 - n.z, 2.0);
  vec3 col = vC * (0.42 + 0.62 * diff) * (0.78 + 0.22 * n.z) + 0.22 * spec + 0.18 * rim * vC;
  vec4 clip = projectionMatrix * vec4(vP + n * vR, 1.0);
  gl_FragDepthEXT = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(col, uA);
}`,
  });
  // (see-through only while the set fades, as the kit's materials are)
  Object.defineProperty(mat, 'transparent', { configurable: true, get: () => set.uA.value < 0.999, set() {} });
  set.mats.push(mat);
  const balls = new THREE.Points(g, mat); balls.frustumCulled = false;
  holder.add(balls);
  // the cube's edges and a faint skin
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(SIDE, SIDE, SIDE)), K.fade(set, new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true }), 0.7));
  holder.add(edges);
  const skin = new THREE.Mesh(new THREE.BoxGeometry(SIDE, SIDE, SIDE), K.rim(set, { color: [0.4, 0.7, 1.0], a0: 0.02, a1: 0.12 }));
  holder.add(skin);
  // the dot it opens from
  const MARK = [0.27, 0.85, 1.0], dg = K.pointsGeo(1);
  dg.attributes.aCol.array.set(MARK); dg.attributes.aSize.array[0] = 0.03;
  const dot = new THREE.Points(dg, K.points(set));
  holder.add(dot);
  const v2 = new THREE.Vector2();
  return Object.assign(set, {
    // crowd_open: 0 a single dot, 1 the cube full size; crowd_mark: the marked kind lit (the rest dimmed)
    params: { crowd_a: 1, crowd_open: 0, crowd_mark: 0 },
    update(S, t) {
      const o = clamp(S.crowd_open, 0, 1), sc = lerp(0.02, 1, o * o);
      holder.scale.setScalar(sc);
      dg.attributes.aA.array[0] = 1 - clamp(o * 3, 0, 1); dg.attributes.aA.needsUpdate = true;
      dot.scale.setScalar(1 / sc);
      balls.visible = edges.visible = skin.visible = o > 0.02;
      U.uT.value = t; U.uMark.value = clamp(S.crowd_mark, 0, 1);
      // (the points' size in pixels: half the drawn height, a headset's eye or the page's drawing buffer)
      const r = GL.renderer;
      U.uHalf.value = r.xr.isPresenting && typeof XR !== 'undefined' && XR.viewH ? XR.viewH / 2 : r.getDrawingBufferSize(v2).y / 2;
    },
    anchors: { dot: AT, cube: [AT[0], AT[1] + SIDE * 0.62, AT[2]], corner: [AT[0] + HALF, AT[1] - HALF, AT[2] + HALF],
      mark: () => { const m = P.mols.find(o => o.mark && o.c[1] > 0.04) || P.mols[0]; return [AT[0] + m.c[0], AT[1] + m.c[1], AT[2] + m.c[2]]; } },
    labels: [],
    cam: { default: [30, 16, 0.75, AT[0], AT[1], AT[2]], close: [55, 12, 0.5, AT[0], AT[1], AT[2]] },
    stats: () => ({ n: P.mols.length, balls: NB, marked: P.mols.filter(o => o.mark).length, kinds: KINDS.map((k, i) => [k.key, P.mols.filter(o => o.k === i).length]) }),
  });
};
SETS.crowd.prep = ms => CROWD.pack(ms || 25);
