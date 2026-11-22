// The interactome as a hairball (chapter 1) and its way back into the cell (chapter 4): the cell's own background (its
// dots and the links drawn at show 2, strict: SETS.cell's api().net) and every protein without a place. In the hairball
// each protein is one dot on a ball, hubs near the middle and partners near each other (no places: the map alone); as
// ball_morph rises each dot flies to its place in the cell, place after place, and a protein in several places splits
// into its copies on the way; the proteins without a place go to a loose shell outside the cell, grey. All the motion is
// in the shaders (each vertex knows its start and its place): one Points draw and one LineSegments draw.
SETS.ball = function (K) {
  const { THREE, clamp } = K;
  const set = K.newSet('ball');
  const P = PDATA, cell = GL.sets.cell.api(), net = cell.net(2), col = cell.placeCol;
  const mul = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  // ------------------------------------------------------------ the hairball: one spot per protein
  // a direction at random and a depth by the number of links (hubs inside), then a few rounds of pulling each protein
  // towards its drawn partners (on the ball's surface layers), so linked proteins sit together
  const NP = P.N, R0 = 0.95, home = new Float32Array(3 * NP), rad = new Float32Array(NP);
  let maxDeg = 1;
  for (let p = 0; p < NP; p++) maxDeg = Math.max(maxDeg, cell.deg(p));
  const lmax = Math.log1p(maxDeg);
  for (let p = 0; p < NP; p++) {
    const r = mul(p * 7 + 3), u = K.unit(r), x = Math.log1p(cell.deg(p)) / lmax;
    rad[p] = R0 * (0.25 + 0.75 * Math.pow(1 - x, 0.8)) * (0.85 + 0.15 * r());
    home.set([u[0] * rad[p], u[1] * rad[p], u[2] * rad[p]], 3 * p);
  }
  const pairs = [];
  for (let j = 0; j < net.ab.length / 2; j++) { const a = net.prot[net.ab[2 * j]], b = net.prot[net.ab[2 * j + 1]]; if (a !== b) pairs.push(a, b); }
  const acc = new Float32Array(3 * NP), cnt = new Float32Array(NP);
  for (let it = 0; it < 4; it++) {
    acc.fill(0); cnt.fill(0);
    for (let j = 0; j < pairs.length; j += 2) {
      const a = pairs[j], b = pairs[j + 1];
      for (let k = 0; k < 3; k++) { acc[3 * a + k] += home[3 * b + k]; acc[3 * b + k] += home[3 * a + k]; }
      cnt[a]++; cnt[b]++;
    }
    for (let p = 0; p < NP; p++) {
      if (!cnt[p]) continue;
      const w = Math.min(0.3, 0.2 * cnt[p] / (cnt[p] + 3));
      let x = home[3 * p], y = home[3 * p + 1], z = home[3 * p + 2];
      x += (acc[3 * p] / cnt[p] - x) * w; y += (acc[3 * p + 1] / cnt[p] - y) * w; z += (acc[3 * p + 2] / cnt[p] - z) * w;
      const l = Math.hypot(x, y, z) || 1;
      home[3 * p] = x / l * rad[p]; home[3 * p + 1] = y / l * rad[p]; home[3 * p + 2] = z / l * rad[p];
    }
  }

  // ------------------------------------------------------------ the dots: the cell's, then the unplaced proteins
  // each dot: its place in the cell (position), its protein's spot on the ball (aStart), when it leaves (aWhen: place
  // after place, the nucleus first), whether it is its protein's first (the others are copies, hidden until they split)
  const unpl = [];
  for (let p = 0; p < NP; p++) if (!P.pl[p]) unpl.push(p);
  const ND = net.n + unpl.length, PLACE_T = [3, 1, 2, 5, 6, 7, 9, 10, 11, 4, 0, 8, 12, 13];   // (a place's turn: its order of leaving)
  const g = new THREE.BufferGeometry(), pos = new Float32Array(3 * ND), st = new Float32Array(3 * ND), when = new Float32Array(ND),
    first = new Float32Array(ND), cA = new Float32Array(3 * ND), size = new Float32Array(ND), out = new Float32Array(ND), dProt = new Uint32Array(ND);
  const seen = new Uint8Array(NP);
  for (let i = 0; i < ND; i++) {
    const own = i < net.n, p = own ? net.prot[i] : unpl[i - net.n], pl = own ? net.place[i] : 13, r = mul(i * 13 + 5);
    if (own) pos.set(net.pos.subarray(3 * i, 3 * i + 3), 3 * i); else pos.set(cell.outPos(p), 3 * i);
    st.set(home.subarray(3 * p, 3 * p + 3), 3 * i);
    when[i] = 0.04 * PLACE_T[pl] + 0.06 * r();
    first[i] = seen[p] ? 0 : 1; seen[p] = 1;
    cA.set(col[pl], 3 * i);
    size[i] = 0.007 + 0.024 * Math.sqrt(cell.deg(p) / maxDeg);
    out[i] = own ? 0 : 1; dProt[i] = p;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aStart', new THREE.BufferAttribute(st, 3));
  g.setAttribute('aWhen', new THREE.BufferAttribute(when, 1)); g.setAttribute('aFirst', new THREE.BufferAttribute(first, 1));
  g.setAttribute('aCol', new THREE.BufferAttribute(cA, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aOut', new THREE.BufferAttribute(out, 1)); g.setAttribute('aHi', new THREE.BufferAttribute(new Float32Array(ND), 1));
  // the way from the ball to the cell, shared by dots and links: the ball turns (uRot) and stands at uOff; a dot leaves at
  // aWhen and takes FLY of the morph to land, bowing outwards on the way
  const U = { uA: set.uA, uPx: K.U.uPx, uM: { value: 0 }, uRot: { value: 0 }, uOff: { value: new THREE.Vector3() }, uTint: { value: 0 },
    uIn: { value: 1 }, uOutA: { value: 1 }, uHl: { value: 0 } };
  const WAY = `
uniform float uM, uRot, uTint, uIn, uOutA, uHl; uniform vec3 uOff;
attribute vec3 aStart; attribute float aWhen;
float flyU() { return smoothstep(0.0, 1.0, clamp((uM - aWhen) / 0.42, 0.0, 1.0)); }
vec3 way(float u) {
  float c = cos(uRot), s = sin(uRot);
  vec3 b = vec3(c * aStart.x + s * aStart.z, aStart.y, -s * aStart.x + c * aStart.z) + uOff;
  vec3 p = mix(b, position, u);
  return p * (1.0 + 0.22 * sin(3.14159 * u));
}`;
  const dotMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + WAY + `
attribute vec3 aCol; attribute float aFirst, aSize, aOut, aHi;
varying vec3 vC; varying float vA;
void main() {
  float u = flyU();
  vec4 mv = modelViewMatrix * vec4(way(u), 1.0);
  gl_Position = projectionMatrix * mv;
  // (a highlight, ball_hi: the protein (aHi 2) and its partners (1) stand out, the rest dims)
  float hi = uHl * (1.0 - u), on = step(0.5, aHi);
  gl_PointSize = pointPx(aSize, mv) * (1.0 + hi * (0.5 * on + 0.8 * step(1.5, aHi)));
  vec3 pale = vec3(0.5, 0.68, 1.0);
  vC = mix(pale, aOut > 0.5 ? vec3(0.5, 0.53, 0.58) : aCol, u) * mix(1.0, 0.75, aOut * u);
  vC = mix(vC, step(1.5, aHi) > 0.5 ? vec3(1.0, 0.78, 0.4) : vec3(0.95, 0.72, 0.42), hi * on);
  vA = max(aFirst, u) * (aOut > 0.5 ? uOutA * mix(1.0, 0.55, u) : uIn) * mix(0.12, 0.8, u) * mix(1.0, mix(0.3, 4.0, on), hi);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `uniform float uA; varying vec3 vC; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float a = smoothstep(0.5, 0.25, d);
  gl_FragColor = vec4(vC, vA * a * uA); }`,
  });
  set.mats.push(dotMat);
  const dots = new THREE.Points(g, dotMat); dots.frustumCulled = false; dots.renderOrder = 5;
  set.group.add(dots);

  // ------------------------------------------------------------ the links: each end goes with its dot
  const NL = net.ab.length / 2, lg = new THREE.BufferGeometry(), lp = new Float32Array(6 * NL), ls = new Float32Array(6 * NL),
    lw = new Float32Array(2 * NL), lc = new Float32Array(6 * NL);
  for (let j = 0; j < NL; j++) for (let e = 0; e < 2; e++) {
    const d = net.ab[2 * j + e], v = 2 * j + e;
    lp.set(pos.subarray(3 * d, 3 * d + 3), 3 * v); ls.set(st.subarray(3 * d, 3 * d + 3), 3 * v); lw[v] = when[d];
    lc.set(net.col.subarray(3 * j, 3 * j + 3), 3 * v);
  }
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('aStart', new THREE.BufferAttribute(ls, 3));
  lg.setAttribute('aWhen', new THREE.BufferAttribute(lw, 1)); lg.setAttribute('aCol', new THREE.BufferAttribute(lc, 3));
  const linkMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: WAY + `
attribute vec3 aCol; varying vec3 vC; varying float vA;
void main() {
  float u = flyU();
  gl_Position = projectionMatrix * modelViewMatrix * vec4(way(u), 1.0);
  // (additive lines: dimmer still near the ball's centre, where thousands cross, so its middle stays coloured)
  float core = mix(0.35, 1.0, smoothstep(0.15, 0.75, length(aStart) / ${R0.toFixed(2)}));
  vC = mix(vec3(0.75, 0.88, 1.0) * 0.5, aCol * 0.8, uTint); vA = mix(0.16 * core, 0.3, u) * uIn * (1.0 - 0.7 * uHl * (1.0 - u));
}`,
    fragmentShader: 'uniform float uA; varying vec3 vC; varying float vA; void main() { gl_FragColor = vec4(vC, vA * uA); }',
  });
  set.mats.push(linkMat);
  const links = new THREE.LineSegments(lg, linkMat); links.frustumCulled = false; links.renderOrder = 4;
  set.group.add(links);

  // ------------------------------------------------------------ a highlight: one protein's links, every one of them
  // ball_hi (a protein's number, or -1; a step param) and ball_hl (its fade): the protein's links from its spot on the
  // ball to each partner's (all of them, not only the drawn background's), amber as its label, the rest dimmed; only in
  // the hairball (it fades as the dots fly)
  const hg = new THREE.BufferGeometry(), aHi = g.attributes.aHi;
  const hiMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    vertexShader: WAY + `
varying float vA;
void main() {
  float u = flyU();
  gl_Position = projectionMatrix * modelViewMatrix * vec4(way(u), 1.0);
  vA = uHl * (1.0 - u);
}`,
    fragmentShader: 'uniform float uA; varying float vA; void main() { gl_FragColor = vec4(1.0, 0.72, 0.32, 0.4 * vA * uA); }',
  });
  set.mats.push(hiMat);
  const hiLines = new THREE.LineSegments(hg, hiMat); hiLines.frustumCulled = false; hiLines.renderOrder = 6; hiLines.visible = false;
  set.group.add(hiLines);
  let HI = -1;
  function highlight(p) {
    HI = p;
    const part = new Set();
    if (p >= 0) for (let i = 0; i < P.E; i++) { const a = P.la[i], b = P.lb[i]; if (a !== b && (a === p || b === p)) part.add(a === p ? b : a); }
    for (let i = 0; i < ND; i++) aHi.array[i] = dProt[i] === p ? 2 : part.has(dProt[i]) ? 1 : 0;
    aHi.needsUpdate = true;
    // (both ends at their spots on the ball; position the same, so the shared way() leaves them on the ball)
    const L = new Float32Array(6 * part.size);
    let j = 0;
    for (const q of part) { L.set(home.subarray(3 * p, 3 * p + 3), 6 * j); L.set(home.subarray(3 * q, 3 * q + 3), 6 * j + 3); j++; }
    hg.setAttribute('position', new THREE.BufferAttribute(L, 3)); hg.setAttribute('aStart', new THREE.BufferAttribute(L.slice(), 3));
    hg.setAttribute('aWhen', new THREE.BufferAttribute(new Float32Array(2 * part.size), 1));
    hiLines.visible = part.size > 0;
  }

  // where the ball stands before it moves into the cell: to the cell's left, so the two show side by side
  const SIDE = [-2.0, 0, 0];
  let hub = 0;
  for (let p = 0; p < NP; p++) if (cell.deg(p) > cell.deg(hub)) hub = p;
  const at = (v, m) => [v[0] + SIDE[0] * (1 - m), v[1] + SIDE[1] * (1 - m), v[2] + SIDE[2] * (1 - m)];
  let M = 0;
  return Object.assign(set, {
    // ball_move: 0 beside the cell, 1 over it; ball_morph: 0 the hairball, 1 every dot in its place; ball_tint: the links
    // in their judgement's colours; ball_in: the dots and links in the cell (0 once the cell's own take over); ball_out:
    // the proteins without a place; ball_hi: a protein whose links stand out (-1 none; a step param) and ball_hl its fade
    params: { ball_a: 1, ball_move: 0, ball_morph: 0, ball_tint: 0, ball_in: 1, ball_out: 1, ball_hi: -1, ball_hl: 0 },
    update(S, t) {
      M = clamp(S.ball_move, 0, 1);
      U.uM.value = clamp(S.ball_morph, 0, 1) * 1.0;
      U.uRot.value = t * 0.08;
      U.uOff.value.set(SIDE[0] * (1 - M), SIDE[1] * (1 - M), SIDE[2] * (1 - M));
      U.uTint.value = clamp(S.ball_tint, 0, 1); U.uIn.value = clamp(S.ball_in, 0, 1); U.uOutA.value = clamp(S.ball_out, 0, 1);
      const h = Math.round(S.ball_hi);
      if (h !== HI) highlight(h >= 0 && h < NP ? h : -1);
      U.uHl.value = HI >= 0 ? clamp(S.ball_hl, 0, 1) : 0;
    },
    anchors: { ball: () => at([0, 0, 0], M), top: () => at([0, R0 * 1.05, 0], M), hub: () => at([0, 0, 0], M), side: () => at([0, -R0 * 1.05, 0], M),
      outside: [-0.2, -1.2, 0.2] },
    labels: [],
    // (the hairball and the empty cell side by side; the cell's own views once it has moved in)
    cam: { default: [12, 10, 6.0, -1.0, 0, 0], ball: [12, 8, 3.4, -2.0, 0, 0], cell: [20, 14, 3.6, 0, 0, 0] },
    stats: () => ({ dots: ND, links: NL, unplaced: unpl.length, hub }),
  });
};
