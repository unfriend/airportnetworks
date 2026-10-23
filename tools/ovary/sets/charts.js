// The donors in 3D (the aging ovary story): 255 glass slides (drawn) that gather into a fan and then stack up into the
// donors' age histogram (one slide per donor, the poster's 20 bars). The story's one graph, and it goes by in passing:
// the trends, the comparisons and the scores are told on the ovary and the section instead (the owner's rule against 2D
// graphs). The donors' ages are OVARY_DATA.cohort.age (whole years filling the poster's bars).
SETS.charts = function (K) {
  const { THREE, clamp, prog } = K;
  const L = OVARY_LOOK, D = OVARY_DATA;
  L.init(K);
  const set = K.newSet('charts');
  const ink = '#e7eef8', muted = '#95a6bd', FONT = 'Inter, "Segoe UI", Arial, sans-serif';
  // a canvas texture drawn once (text and gridlines that belong to a chart)
  function canvasTex(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); draw(ctx, w, h);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  // a plane showing a texture; its opacity is the set's fade times its own (set in update)
  function plate(tex, w, h) {
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    me.renderOrder = 1;
    return me;
  }
  const fadeTo = (me, a) => { me.material.opacity = a * set.uA.value; me.visible = a > 0.003; };

  // ------------------------------------------------------------- the slides and the histogram
  const H = D.hist, NBAR = H.counts.length, HX0 = -0.95, HW = 1.9, HY0 = -0.42, DY = 0.026;
  const ageX = a => HX0 + (a - 20) / 50 * HW;
  // each donor's slide: its bar (by its age) and its place in the bar's stack
  const AGES = D.cohort.age, N = AGES.length;
  const barOf = a => clamp(Math.floor((a - H.from) / H.width), 0, NBAR - 1);
  // (the poster's bars hold its counts: donors fill them in age order)
  const order = AGES.map((a, i) => i).sort((i, j) => AGES[i] - AGES[j] || i - j);
  const SLOT = new Array(N);
  { let k = 0, n = 0; for (const i of order) { while (n >= H.counts[k]) { k++; n = 0; } SLOT[i] = [k, n++]; } }
  const SL = 0.085, SWD = 0.028, STH = 0.0042;
  const slideAttrs = (() => {
    const aF = new Float32Array(N * 4), aHh = new Float32Array(N * 4), R = K.rng(17);
    order.forEach((i, r) => {
      const ring = r % 3, k = Math.floor(r / 3), nk = Math.ceil(N / 3), th = (-75 + 150 * (k + 0.5) / nk) * Math.PI / 180;
      aF.set([th, 0.52 + 0.17 * ring, -0.06 * ring, R()], 4 * i);
      const [b, n] = SLOT[i];
      aHh.set([HX0 + (H.from + H.width * (b + 0.5) - 20) / 50 * HW, HY0 + (n + 0.5) * DY, R(), AGES[i]], 4 * i);
    });
    return { aF: new THREE.InstancedBufferAttribute(aF, 4), aH: new THREE.InstancedBufferAttribute(aHh, 4) };
  })();
  const SLIDE_GL = `
uniform float uIn, uHist; attribute vec4 aF, aH;
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
// the slide's pose: in the fan (standing, along its radius) or in the histogram (lying in its bar's stack)
vec3 slidePos(vec3 p, out mat3 R, out float al) {
  float sIn = smoothstep(0.0, 1.0, clamp((uIn * 1.6 - aF.w * 0.6), 0.0, 1.0));
  float sH = smoothstep(0.0, 1.0, clamp((uHist * 1.5 - (aH.w - 20.0) / 50.0 * 0.5), 0.0, 1.0));
  vec3 fan = vec3(0.0, -0.62, 0.0) + vec3(-sin(aF.x), cos(aF.x), 0.0) * aF.y + vec3(0.0, 0.0, aF.z);
  fan += vec3(0.0, -0.7, 0.5) * (1.0 - sIn);
  vec3 hist = vec3(aH.x, aH.y, 0.0);
  R = rotZ(mix(aF.x + 1.5708, 0.0, sH)) * rotX(mix(0.0, -1.5708, sH));
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
  // the histogram's backdrop: gridlines and ticks (age along the bottom, donors up the side)
  const HB = new THREE.Group();
  // (the plate reaches 0.22 left of the bars for the counts, 0.06 right of them)
  const HPW = HW + 0.28, HPX = HX0 - 0.22;
  const histTex = canvasTex(1024, 512, (c, w, h) => {
    const x = a => (ageX(a) - HPX) / HPW * w, y = n => h - ((HY0 + n * DY) - (HY0 - 0.08)) / 0.8 * h;
    c.strokeStyle = 'rgba(149,166,189,0.28)'; c.lineWidth = 2; c.fillStyle = muted; c.font = `28px ${FONT}`; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const n of [0, 5, 10, 15, 20, 25]) { c.beginPath(); c.moveTo(x(20), y(n)); c.lineTo(x(70), y(n)); c.stroke(); c.fillText(String(n), x(20) - 10, y(n)); }
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (const a of [20, 30, 40, 50, 60, 70]) { c.fillText(String(a), x(a), y(0) + 10); }
    c.fillStyle = ink; c.font = `600 26px ${FONT}`; c.fillText('Age (years)', x(45), y(0) + 46);
    c.save(); c.translate(x(20) - 70, y(12.5)); c.rotate(-Math.PI / 2); c.fillText('Donors', 0, 0); c.restore();
  });
  const histPlate = plate(histTex, HPW, 0.8);
  histPlate.position.set(HPX + HPW / 2, HY0 - 0.08 + 0.4, -0.06);
  HB.add(histPlate);

  set.group.add(slides, HB);

  // ------------------------------------------------------------- anchors
  const anchors = {
    hist: [0, HY0 + 0.75, 0], histTop: [ageX(H.from + H.width * 18.5), HY0 + 25 * DY + 0.05, 0], fan: [0, 0.38, 0.05], slides: [0, -0.1, 0.1],
  };

  // ------------------------------------------------------------- update
  function update(S) {
    const sl = clamp(S.charts_slides, 0, 1), hs = clamp(S.charts_hist, 0, 1);
    for (const me of [glass, tissue, label]) { me.material.uniforms.uIn.value = sl; me.material.uniforms.uHist.value = hs; }
    slides.visible = sl > 0.001;
    fadeTo(histPlate, prog(hs, 0.4, 1) * sl);
  }

  return Object.assign(set, {
    params: { charts_a: 1, charts_slides: 0, charts_hist: 0 },
    update,
    anchors,
    labels: [
      { text: [`${D.facts.donors} donors`, `GTEx, aged ${D.facts.ages[0]} to ${D.facts.ages[1]}`], at: 'histTop', cls: 'cyn', alpha: S => prog(S.charts_hist, 0.7, 1) * S.charts_slides },
    ],
    cam: { default: [0, 6, 3.2, -0.05, -0.1, 0], hist: [0, 6, 3.2, -0.05, -0.1, 0], fan: [0, 14, 3.0, 0, -0.15, 0] },
    // (not a scene of explore mode: no controls)
    controls: [],
  });
};
