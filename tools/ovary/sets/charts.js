// The donors in 3D (the aging ovary story): 255 glass slides (drawn) that gather into a fan and then stack up into the
// donors' age histogram (one slide per donor, the poster's 20 bars): twenty towers of slides lying flat on the floor, in
// a wide arc in front of you, age 20 on the left to 70 on the right, seen from a little above (the owner, 2 November
// 2026: the flat histogram, a wall of slides seen edge on, was "hard to see"). The story's one graph, and it goes by in passing:
// the trends, the comparisons and the scores are told on the ovary and the section instead (the owner's rule against 2D
// graphs). The donors' ages are OVARY_DATA.cohort.age (whole years filling the poster's bars).
SETS.charts = function (K) {
  const { THREE, clamp, prog } = K;
  const L = OVARY_LOOK, D = OVARY_DATA;
  L.init(K);
  const set = K.newSet('charts');

  // ------------------------------------------------------------- the slides and the histogram
  // the floor (HY0) and the arc: its centre on your side (ARC_Z), so the middle tower stands furthest away and the ends
  // come round towards you; a bar's angle from age 20 (left) to 70 (right); slides PITCH apart up a tower
  const H = D.hist, NBAR = H.counts.length, HY0 = -0.42, PITCH = 0.02, ARC_R = 1.5, ARC_Z = 1.1, ARC_TH = 46 * Math.PI / 180;
  const ageAng = a => (-1 + 2 * (a - 20) / 50) * ARC_TH;
  const onArc = (th, r, y) => [r * Math.sin(th), y, ARC_Z - r * Math.cos(th)];
  // each donor's slide: its bar (by its age) and its place in the bar's stack
  const AGES = D.cohort.age, N = AGES.length;
  const barOf = a => clamp(Math.floor((a - H.from) / H.width), 0, NBAR - 1);
  // (the poster's bars hold its counts: donors fill them in age order)
  const order = AGES.map((a, i) => i).sort((i, j) => AGES[i] - AGES[j] || i - j);
  const SLOT = new Array(N);
  { let k = 0, n = 0; for (const i of order) { while (n >= H.counts[k]) { k++; n = 0; } SLOT[i] = [k, n++]; } }
  const SL = 0.085, SWD = 0.028, STH = 0.008;
  const slideAttrs = (() => {
    const aF = new Float32Array(N * 4), aHh = new Float32Array(N * 4), R = K.rng(17);
    order.forEach((i, r) => {
      const ring = r % 3, k = Math.floor(r / 3), nk = Math.ceil(N / 3), th = (-75 + 150 * (k + 0.5) / nk) * Math.PI / 180;
      aF.set([th, 0.52 + 0.17 * ring, -0.06 * ring, R()], 4 * i);
      const [b, n] = SLOT[i];
      aHh.set([ageAng(H.from + H.width * (b + 0.5)), HY0 + (n + 0.5) * PITCH, R(), AGES[i]], 4 * i);
    });
    return { aF: new THREE.InstancedBufferAttribute(aF, 4), aH: new THREE.InstancedBufferAttribute(aHh, 4) };
  })();
  const SLIDE_GL = `
uniform float uIn, uHist; attribute vec4 aF, aH;
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
// the slide's pose: in the fan (standing, along its radius) or in the histogram (lying flat in its bar's tower on the
// arc, its long side along the arc; aH.x the bar's angle, aH.y its height in the tower)
vec3 slidePos(vec3 p, out mat3 R, out float al) {
  float sIn = smoothstep(0.0, 1.0, clamp((uIn * 1.6 - aF.w * 0.6), 0.0, 1.0));
  float sH = smoothstep(0.0, 1.0, clamp((uHist * 1.5 - (aH.w - 20.0) / 50.0 * 0.5), 0.0, 1.0));
  vec3 fan = vec3(0.0, -0.62, 0.0) + vec3(-sin(aF.x), cos(aF.x), 0.0) * aF.y + vec3(0.0, 0.0, aF.z);
  fan += vec3(0.0, -0.7, 0.5) * (1.0 - sIn);
  vec3 hist = vec3(${ARC_R.toFixed(3)} * sin(aH.x), aH.y, ${ARC_Z.toFixed(3)} - ${ARC_R.toFixed(3)} * cos(aH.x));
  R = rotY(-aH.x * sH) * rotZ(mix(aF.x + 1.5708, 0.0, sH)) * rotX(mix(0.0, -1.5708, sH));
  al = sIn;
  return mix(fan, hist, sH) + vec3(0.0, sin(sH * 3.14159) * 0.22, sin(sH * 3.14159) * 0.25) + R * p;
}`;
  function slidePart(geo, frag, opts) {
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex(geo.index); g.setAttribute('position', geo.attributes.position); g.setAttribute('normal', geo.attributes.normal);
    g.setAttribute('aF', slideAttrs.aF); g.setAttribute('aH', slideAttrs.aH);
    g.instanceCount = N;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uIn: { value: 0 }, uHist: { value: 0 } }, transparent: true, depthWrite: !!opts.depth, side: opts.side || THREE.FrontSide,
      vertexShader: SLIDE_GL + `
varying vec3 vN, vV, vL; varying float vAl, vR;
void main() {
  mat3 R; float al;
  vec3 p = slidePos(${opts.local}, R, al);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * (R * normal)); vV = -mv.xyz; vL = position; vAl = al; vR = aH.z;
  gl_Position = projectionMatrix * mv;
  if (al < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `uniform float uA; varying vec3 vN, vV, vL; varying float vAl, vR;
void main() { vec3 n = normalize(vN), v = normalize(vV); if (!gl_FrontFacing) n = -n; float df = max(dot(n, normalize(vec3(-0.5, 0.6, 1.0))), 0.0), fr = pow(1.0 - abs(dot(n, v)), 2.0);
${frag}
}`,
    });
    set.mats.push(m);
    const me = new THREE.Mesh(g, m); me.frustumCulled = false;
    return me;
  }
  // glass (see-through, bright at its edges), the tissue on it (pink and purple), the frosted label at one end
  const glass = slidePart(new THREE.BoxGeometry(1, 1, 1), `float e = max(max(abs(vL.x), abs(vL.y)), abs(vL.z)) * 2.0; float edge = smoothstep(0.86, 1.0, max(abs(vL.x) * 2.0 * step(0.45, abs(vL.y) * 2.0 + 0.5), abs(vL.y) * 2.0));
  gl_FragColor = vec4(vec3(0.72, 0.88, 1.0) * (0.45 + 0.5 * df) + fr * 0.3 + edge * 0.25, (0.22 + 0.35 * fr + 0.3 * edge) * vAl * uA);`, { local: `vec3(position.x * ${SL}, position.y * ${SWD}, position.z * ${STH})` });
  const tissueGeo = new THREE.CircleGeometry(1, 20);
  const tissue = slidePart(tissueGeo, `float w = 0.5 + 0.5 * sin(vL.x * 9.0 + vR * 20.0) * cos(vL.y * 7.0 - vR * 11.0);
  vec3 c = mix(vec3(0.91, 0.55, 0.69), vec3(0.6, 0.45, 0.78), 0.25 + 0.4 * w * vR);
  gl_FragColor = vec4(c * (0.55 + 0.55 * df), vAl * uA);`, { depth: true, side: THREE.DoubleSide, local: `vec3(-0.012 + position.x * (0.02 + 0.006 * aH.z), position.y * (0.0095 + 0.003 * aH.z), ${(STH / 2 + 0.0006).toFixed(4)})` });
  const label = slidePart(new THREE.BoxGeometry(1, 1, 1), `gl_FragColor = vec4(vec3(0.95, 0.96, 0.98) * (0.6 + 0.45 * df), 0.95 * vAl * uA);`, { depth: true, local: `vec3(0.0305 + position.x * 0.022, position.y * ${SWD * 0.98}, position.z * ${STH * 1.25})` });
  const slides = new THREE.Group();
  slides.add(glass, tissue, label);
  glass.renderOrder = 2;
  // the floor under the towers: a faint band along the arc, and a mark at every decade in front of it (the ages are the
  // set's labels, so they read in every labels mode)
  const HB = new THREE.Group(), DEC = [20, 30, 40, 50, 60, 70];
  const floorMat = () => new THREE.MeshBasicMaterial({ color: 0x9fc4e6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const band = new THREE.Mesh(new THREE.RingGeometry(ARC_R - 0.07, ARC_R + 0.07, 96, 1, Math.PI / 2 - ARC_TH - 0.04, 2 * ARC_TH + 0.08), floorMat());
  band.rotation.x = -Math.PI / 2; band.position.set(0, HY0 - 0.004, ARC_Z);   // (the ring's angles from +x, turned onto the floor about its centre)
  band.userData.op = 0.16;
  HB.add(band);
  for (const a of DEC) {
    const th = ageAng(a), tick = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.002, 0.07), floorMat());
    tick.position.set(...onArc(th, ARC_R - 0.12, HY0 - 0.002)); tick.rotation.y = -th; tick.userData.op = 0.55;
    HB.add(tick);
  }
  set.group.add(slides, HB);

  // ------------------------------------------------------------- anchors
  const tallest = Math.max(...H.counts);
  const anchors = {
    hist: [0, HY0 + 0.75, 0], histTop: onArc(0, ARC_R, HY0 + tallest * PITCH + 0.12), fan: [0, 0.38, 0.05], slides: [0, -0.1, 0.1],
  };
  for (const a of DEC) anchors['age' + a] = onArc(ageAng(a), ARC_R - 0.22, HY0 + 0.01);

  // ------------------------------------------------------------- update
  function update(S) {
    const sl = clamp(S.charts_slides, 0, 1), hs = clamp(S.charts_hist, 0, 1);
    for (const me of [glass, tissue, label]) { me.material.uniforms.uIn.value = sl; me.material.uniforms.uHist.value = hs; }
    slides.visible = sl > 0.001;
    for (const me of HB.children) { me.material.opacity = me.userData.op * prog(hs, 0.4, 1) * sl * set.uA.value; me.visible = me.material.opacity > 0.002; }
  }

  return Object.assign(set, {
    params: { charts_a: 1, charts_slides: 0, charts_hist: 0 },
    update,
    anchors,
    labels: [
      { text: [`${D.facts.donors} donors`, `GTEx, aged ${D.facts.ages[0]} to ${D.facts.ages[1]}`], at: 'histTop', cls: 'cyn', alpha: S => prog(S.charts_hist, 0.7, 1) * S.charts_slides },
      ...DEC.map(a => ({ text: [a === 20 ? 'Age 20' : String(a), ''], at: 'age' + a, cls: '', alpha: S => prog(S.charts_hist, 0.7, 1) * S.charts_slides })),
    ],
    cam: { default: [0, 6, 3.2, -0.05, -0.1, 0], hist: [0, 22, 3.9, 0, -0.18, 0.0], fan: [0, 14, 3.0, 0, -0.15, 0] },
    // (not a scene of explore mode: no controls)
    controls: [],
  });
};
