// The poster's charts in 3D (the aging ovary story): 255 glass slides (drawn) that gather into a fan and then stack up
// into the donors' age histogram (one slide per donor, the poster's 20 bars); the four trends with age (count per
// section against age on the poster's compressed axis, 0 drawn as a row below 1; both fitted lines, as read off the
// poster; bands of the dots by decade; r and p as printed) and the four method comparisons (segmentation against random
// forest: the fitted line as read, the dashed diagonal); the scores (precision, recall and F1 of the random forest per
// object; SegFormer's IoU per object, with the cyst).
// THE DOTS ARE ILLUSTRATIVE: the poster plots one dot per donor; these are OVARY_DATA.cohort, drawn (seeded) to follow
// the poster's lines, bands and shares at zero and to give about its r, not the donors' values. The lines, r and p
// are the poster's.
SETS.charts = function (K) {
  const { THREE, smooth, clamp, prog, lerp } = K;
  const L = OVARY_LOOK, T = OVARY_TREND, D = OVARY_DATA, C = L.C, KI = L.KI;
  L.init(K);
  const set = K.newSet('charts');
  const kind = k => D.kinds[KI[k]];
  const ORDER = D.chartOrder;   // vessel, albicans, follicle, macrophage
  const RF = D.methods.rf, SG = D.methods.seg;
  const ink = '#e7eef8', muted = '#95a6bd', FONT = 'Inter, "Segoe UI", Arial, sans-serif';
  // the poster's method colors, a little lifted for the dark ground
  const DOT = { rf: L.hex('#5b92d4'), seg: L.hex('#e08670') }, LINE = { rf: L.hex('#3f86ff'), seg: L.hex('#ff6a4a') };
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

  // ------------------------------------------------------------- the trend and comparison panels
  const PW = 0.92, PH = 0.62, PX0 = -PW / 2 + 0.13 * PW, PX1 = PW / 2 - 0.04 * PW, PY0 = -PH / 2 + 0.15 * PH, PY1 = PH / 2 - 0.12 * PH;
  const GRID = [[-0.5, 0.36], [0.5, 0.36], [-0.5, -0.38], [0.5, -0.38]];
  const ZL = { rf: 0.035, seg: -0.005 };
  const panels = ORDER.map((key, pi) => {
    const kd = kind(key), A = D.axes[key], cmp = D.compare[key];
    const Ymin = A.min > 0 ? Math.log10(A.min) : Math.log10(0.5) - 0.14, Ymax = Math.log10(A.max);
    const tx = a => PX0 + (a - 20) / 50 * (PX1 - PX0), ty = c => PY0 + (T.Y(c) - Ymin) / (Ymax - Ymin) * (PY1 - PY0);
    const cx = v => PX0 + clamp(v / cmp.xMax, 0, 1.02) * (PX1 - PX0), cy = v => PY0 + clamp(v / cmp.yMax, 0, 1.02) * (PY1 - PY0);
    const g = new THREE.Group();
    g.position.set(GRID[pi][0], GRID[pi][1], 0);
    // the board (a slab of dark glass)
    const bb = L.builder(); bb.add(new THREE.BoxGeometry(PW, PH, 0.016), { m: new THREE.Matrix4().makeTranslation(0, 0, -0.03), col: [0.09, 0.12, 0.18] });
    const boardMat = L.objMat(set, { gloss: 0.3, alpha: 0.9 });
    const board = new THREE.Mesh(bb.geometry(), boardMat);
    // the trend chart's face: gridlines at the printed ticks, tick labels, r and p as the poster prints them
    const toPx = (w, h) => [x => (x / PW + 0.5) * w, y => (0.5 - y / PH) * h];
    const trendTex = canvasTex(768, 512, (c, w, h) => {
      const [X, Yp] = toPx(w, h);
      c.lineWidth = 2; c.font = `24px ${FONT}`; c.textBaseline = 'middle';
      for (const t of A.ticks) { const y = Yp(ty(t)); c.strokeStyle = 'rgba(149,166,189,0.25)'; c.beginPath(); c.moveTo(X(PX0), y); c.lineTo(X(PX1), y); c.stroke(); c.fillStyle = muted; c.textAlign = 'right'; c.fillText(t >= 1000 ? t.toLocaleString('en-US') : String(t), X(PX0) - 8, y); }
      c.strokeStyle = 'rgba(231,238,248,0.6)'; c.beginPath(); c.moveTo(X(PX0), Yp(PY1)); c.lineTo(X(PX0), Yp(PY0)); c.lineTo(X(PX1), Yp(PY0)); c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = muted;
      for (const a of [20, 30, 40, 50, 60, 70]) c.fillText(String(a), X(tx(a)), Yp(PY0) + 6);
      c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.font = `22px ${FONT}`;
      const rp = m => `${m.short} r = ${T.rText(kd.trend[m.key].r)}, p = ${T.pText(kd.trend[m.key].p)}`;
      c.fillStyle = 'rgba(4,9,18,0.55)'; c.fillRect(X(PX0) + 4, Yp(PY0) - 70, 330, 62);
      c.fillStyle = '#' + new THREE.Color(...LINE.rf).getHexString(); c.fillText(rp(RF), X(PX0) + 12, Yp(PY0) - 44);
      c.fillStyle = '#' + new THREE.Color(...LINE.seg).getHexString(); c.fillText(rp(SG), X(PX0) + 12, Yp(PY0) - 16);
    });
    const cmpTex = canvasTex(768, 512, (c, w, h) => {
      const [X, Yp] = toPx(w, h);
      c.lineWidth = 2; c.font = `24px ${FONT}`; c.textBaseline = 'middle';
      for (const t of A.cmpTicks) {
        const y = Yp(cy(t)), x = X(cx(t));
        c.strokeStyle = 'rgba(149,166,189,0.22)'; c.beginPath(); c.moveTo(X(PX0), y); c.lineTo(X(PX1), y); c.stroke(); c.beginPath(); c.moveTo(x, Yp(PY0)); c.lineTo(x, Yp(PY1)); c.stroke();
        c.fillStyle = muted; c.textAlign = 'right'; c.fillText(String(t), X(PX0) - 8, y); c.textAlign = 'center'; c.fillText(String(t), x, Yp(PY0) + 18);
      }
      c.strokeStyle = 'rgba(231,238,248,0.6)'; c.beginPath(); c.moveTo(X(PX0), Yp(PY1)); c.lineTo(X(PX0), Yp(PY0)); c.lineTo(X(PX1), Yp(PY0)); c.stroke();
      c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.font = `24px ${FONT}`; c.fillStyle = ink;
      c.fillText(`r = ${T.rText(kd.compare.r)}`, X(PX0) + 14, Yp(PY1) + 30); c.fillText(`p = ${T.pText(kd.compare.p)}`, X(PX0) + 14, Yp(PY1) + 60);
    });
    const trendFace = plate(trendTex, PW, PH), cmpFace = plate(cmpTex, PW, PH);
    trendFace.position.z = cmpFace.position.z = -0.02;
    g.add(board, trendFace, cmpFace);
    // the fitted lines (the poster's, as read), drawn on up to the age cursor; the bands of the dots (10th to 90th
    // percentile by decade, eased between decades)
    const lineB = L.builder();
    const lineGeos = [];
    for (const m of ['rf', 'seg']) {
      const pts = [];
      for (let a = 21; a <= 70.001; a += 0.5) { const c = T.line(key, m, a); if (c < 1) break; pts.push([tx(a), ty(c), ZL[m] + 0.004]); }
      if (pts.length > 2) {
        const gg = K.tube(pts, 0.0055, pts.length * 2, 6, false), n = gg.attributes.position.count, ag = new Float32Array(n), uv = gg.attributes.uv;
        const a0 = 21, a1 = 21 + (pts.length - 1) * 0.5;
        for (let i = 0; i < n; i++) ag[i] = a0 + uv.getX(i) * (a1 - a0);
        lineGeos.push({ gg, ag, col: LINE[m] });
      }
    }
    const lineGeo = (() => {
      const P = [], Cc = [], Ag = [], I = [];
      for (const { gg, ag, col } of lineGeos) {
        const b = P.length / 3, p = gg.attributes.position;
        for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); Cc.push(...col); Ag.push(ag[i]); }
        for (let i = 0; i < gg.index.count; i++) I.push(b + gg.index.getX(i));
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute('aCol', new THREE.Float32BufferAttribute(Cc, 3)); gg.setAttribute('aAge', new THREE.Float32BufferAttribute(Ag, 1)); gg.setIndex(I);
      return gg;
    })();
    const lineMat = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uSweep: { value: 70 }, uOp: { value: 1 }, uRF: { value: 1 }, uSeg: { value: 1 } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute vec3 aCol; attribute float aAge; varying vec3 vC; varying float vAge, vM; void main() { vC = aCol; vAge = aAge; vM = step(0.0, position.z - 0.02); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA, uSweep, uOp, uRF, uSeg; varying vec3 vC; varying float vAge, vM; void main() { if (vAge > uSweep + 0.25) discard; gl_FragColor = vec4(vC + 0.15, uA * uOp * mix(uSeg, uRF, vM)); }' });
    set.mats.push(lineMat);
    const lines = new THREE.Mesh(lineGeo, lineMat); lines.renderOrder = 3;
    // bands (a translucent ribbon per method)
    const bandGeo = (() => {
      const P = [], Cc = [], Ag = [], I = [];
      for (const m of ['rf', 'seg']) {
        const B = D.trends[key][m].band, at = a => { const x = clamp((a - 25) / 10, 0, 4), d = Math.min(3, Math.floor(x)), f = smooth(x - d); return [0, 2].map(j => T.Y(B[d][j]) * (1 - f) + T.Y(B[d + 1][j]) * f); };
        const b0 = P.length / 3;
        let n = 0;
        for (let a = 21; a <= 70.001; a += 1, n++) {
          const [lo, hi] = at(a), x = tx(a), y0 = PY0 + (lo - Ymin) / (Ymax - Ymin) * (PY1 - PY0), y1 = PY0 + (hi - Ymin) / (Ymax - Ymin) * (PY1 - PY0);
          P.push(x, Math.max(PY0, y0), ZL[m] - 0.006, x, Math.min(PY1, y1), ZL[m] - 0.006); Cc.push(...DOT[m], ...DOT[m]); Ag.push(a, a);
        }
        for (let i = 0; i < n - 1; i++) { const a = b0 + 2 * i; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute('aCol', new THREE.Float32BufferAttribute(Cc, 3)); gg.setAttribute('aAge', new THREE.Float32BufferAttribute(Ag, 1)); gg.setIndex(I);
      return gg;
    })();
    const bandMat = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uSweep: { value: 70 }, uOp: { value: 1 }, uRF: { value: 1 }, uSeg: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'attribute vec3 aCol; attribute float aAge; varying vec3 vC; varying float vAge, vM; void main() { vC = aCol; vAge = aAge; vM = step(0.0, position.z - 0.01); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA, uSweep, uOp, uRF, uSeg; varying vec3 vC; varying float vAge, vM; void main() { if (vAge > uSweep + 0.5) discard; gl_FragColor = vec4(vC, 0.16 * uA * uOp * mix(uSeg, uRF, vM)); }' });
    set.mats.push(bandMat);
    const bands = new THREE.Mesh(bandGeo, bandMat);
    // the comparison's fitted line (as read: segmentation = intercept + slope x random forest) and the dashed diagonal
    const cb = L.builder();
    {
      const x1 = Math.min(cmp.xMax, (cmp.yMax - cmp.intercept) / cmp.slope), p0 = [cx(0), cy(cmp.intercept)], p1 = [cx(x1), cy(cmp.intercept + cmp.slope * x1)];
      cb.add(K.tube([[...p0, 0.03], [...p1, 0.03]], 0.006, 2, 6, false), { col: [0.93, 0.95, 1] });
      const dmax = Math.min(cmp.xMax, cmp.yMax), nd = 18;
      for (let i = 0; i < nd; i++) { const a = dmax * i / nd, b = dmax * (i + 0.55) / nd; cb.add(K.tube([[cx(a), cy(a), 0.025], [cx(b), cy(b), 0.025]], 0.003, 1, 5, false), { col: [0.6, 0.66, 0.75] }); }
    }
    const cmpLineMat = L.objMat(set, { gloss: 0.2 });
    const cmpLines = new THREE.Mesh(cb.geometry(), cmpLineMat);
    // the age cursor: a thin glowing bar at the swept age
    const cursorMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const cursor = new THREE.Mesh(new THREE.PlaneGeometry(0.006, PY1 - PY0), cursorMat);
    cursor.position.set(0, (PY0 + PY1) / 2, 0.04);
    // the dots (illustrative: OVARY_DATA.cohort): per donor one for each method, in two layers (random forest in front)
    const dg = K.pointsGeo(2 * N), R = K.rng(300 + pi);
    const TP = new Float32Array(2 * N * 3), CP = new Float32Array(2 * N * 3), AG = new Float32Array(2 * N), DL = new Float32Array(2 * N);
    for (let i = 0; i < N; i++) for (let mi = 0; mi < 2; mi++) {
      const m = mi ? 'seg' : 'rf', j = mi * N + i, c = D.cohort[key][m][i], jit = (R() - 0.5) * 0.35;
      TP.set([tx(AGES[i] + jit), ty(c), ZL[m] + (R() - 0.5) * 0.006], 3 * j);
      CP.set([cx(D.cohort[key].rf[i]), cy(D.cohort[key].seg[i]), 0.02 + 0.004 * mi], 3 * j);
      AG[j] = AGES[i]; DL[j] = R();
      dg.attributes.aCol.array.set(DOT[m], 3 * j); dg.attributes.aSize.array[j] = 0.019;
    }
    const dotMat = K.points(set, { hard: true, additive: false });
    const dots = new THREE.Points(dg, dotMat);
    dots.renderOrder = 2;
    g.add(bands, lines, cmpLines, cursor, dots);
    set.group.add(g);
    return { key, kd, g, board, boardMat, trendFace, cmpFace, lines, lineMat, bands, bandMat, cmpLines, cmpLineMat, cursor, cursorMat, dots, dg, TP, CP, AG, DL, tx, ty, cx, cy, last: '' };
  });
  set.group.add(slides, HB);

  // ------------------------------------------------------------- the scores
  const SC = new THREE.Group();
  set.group.add(SC);
  const BH = 0.8;   // a score of 1 stands this tall
  const RFK = ['vessel', 'albicans', 'follicle', 'macrophage'], IOUK = ['vessel', 'albicans', 'cyst', 'follicle', 'macrophage'];   // (the poster's table orders)
  const short = { vessel: 'Blood vessel', albicans: 'Corpus albicans', follicle: 'Follicle', macrophage: 'Macrophage', cyst: 'Cyst' };
  const rfB = L.builder(), iouB = L.builder(), RX0 = -1.0, RXW = 0.92, IX0 = 0.12, IXW = 0.88, SY0 = -0.42;
  const shade = (c, w) => c.map(v => v + (1 - v) * w);
  RFK.forEach((k, i) => {
    const sc = kind(k).rf, c = L.GLOW[KI[k]];
    ['precision', 'recall', 'f1'].forEach((q, j) => {
      const x = RX0 + RXW * (i + 0.2 + 0.25 * j + 0.125) / 4 * 1, h = sc[q] * BH, w = RXW / 4 * 0.22;
      rfB.add(new THREE.BoxGeometry(w, h, w), { m: new THREE.Matrix4().makeTranslation(x, SY0 + h / 2, 0), col: shade(c, [0.45, 0.22, 0][j]), cen: [x, SY0, 0] });
    });
  });
  IOUK.forEach((k, i) => {
    const v = kind(k).iou, c = L.GLOW[KI[k]], x = IX0 + IXW * (i + 0.5) / 5, h = v * BH, w = IXW / 5 * 0.42;
    iouB.add(new THREE.BoxGeometry(w, h, w), { m: new THREE.Matrix4().makeTranslation(x, SY0 + h / 2, 0), col: c, cen: [x, SY0, 0] });
  });
  const rfMat = L.objMat(set, { gloss: 0.35, glow: 0.2 }), iouMat = L.objMat(set, { gloss: 0.35, glow: 0.2 });
  const rfBars = new THREE.Mesh(rfB.geometry(), rfMat), iouBars = new THREE.Mesh(iouB.geometry(), iouMat);
  const scoreTex = (title, keys, x0, xw, vals) => canvasTex(1024, 640, (c, w, h) => {
    const X = x => (x - (x0 - 0.04)) / (xw + 0.08) * w, Y = y => (0.5 - (y - (SY0 + 0.38)) / 1.08) * h;
    c.strokeStyle = 'rgba(149,166,189,0.25)'; c.lineWidth = 2; c.fillStyle = muted; c.font = `24px ${FONT}`; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const v of [0, 0.25, 0.5, 0.75, 1]) { const y = Y(SY0 + v * BH); c.beginPath(); c.moveTo(X(x0), y); c.lineTo(X(x0 + xw), y); c.stroke(); }
    c.textAlign = 'center'; c.textBaseline = 'top'; c.font = `600 30px ${FONT}`;
    keys.forEach((k, i) => { c.fillStyle = ink; c.fillText(short[k], X(x0 + xw * (i + 0.5) / keys.length), Y(SY0) + 52); });
    if (keys.length === 4) { c.font = `24px ${FONT}`; c.fillStyle = muted; c.textAlign = 'left'; c.fillText('bars: precision, recall, F1 (the poster\'s table)', X(x0), Y(SY0) + 96); }
    c.textAlign = 'center'; c.font = `600 26px ${FONT}`;
    vals.forEach(([x, v]) => { c.fillStyle = ink; c.fillText(v.toFixed(2), X(x), Y(SY0) + 10); });
  });
  const rfVals = [], iouVals = [];
  RFK.forEach((k, i) => ['precision', 'recall', 'f1'].forEach((q, j) => rfVals.push([RX0 + RXW * (i + 0.2 + 0.25 * j + 0.125) / 4, kind(k).rf[q]])));
  IOUK.forEach((k, i) => iouVals.push([IX0 + IXW * (i + 0.5) / 5, kind(k).iou]));
  const rfPlate = plate(scoreTex('Random forest', RFK, RX0, RXW, rfVals), RXW + 0.08, 1.08), iouPlate = plate(scoreTex('SegFormer', IOUK, IX0, IXW, iouVals), IXW + 0.08, 1.08);
  rfPlate.position.set(RX0 + RXW / 2, SY0 + 0.38, -0.05); iouPlate.position.set(IX0 + IXW / 2, SY0 + 0.38, -0.05);
  SC.add(rfBars, iouBars, rfPlate, iouPlate);

  // ------------------------------------------------------------- anchors
  const tmp = new THREE.Vector3();
  const inP = (pi, p) => { const P = panels[pi]; P.g.updateMatrix(); tmp.set(p[0], p[1], p[2]).applyMatrix4(P.g.matrix); return [tmp.x, tmp.y, tmp.z]; };
  const anchors = {
    hist: [0, HY0 + 0.75, 0], histTop: [ageX(H.from + H.width * 18.5), HY0 + 25 * DY + 0.05, 0], fan: [0, 0.38, 0.05], slides: [0, -0.1, 0.1],
    rfScores: [RX0 + RXW / 2, SY0 + BH + 0.12, 0], iouScores: [IX0 + IXW / 2, SY0 + BH + 0.12, 0],
    cyst: [IX0 + IXW * 2.5 / 5, SY0 + D.kinds[KI.cyst].iou * BH + 0.04, 0.03],
  };
  ORDER.forEach((k, pi) => {
    anchors['t' + pi] = () => inP(pi, [PX0, PH / 2 - 0.02, 0.04]);           // the panel's title (top left)
    anchors['p' + pi] = () => inP(pi, [PX0 + 0.02, PY0 + 0.12, 0.05]);      // r and p (lower left, as on the poster)
    anchors['end' + pi] = () => { const P = panels[pi], a = Math.min(70, sweepNow); return inP(pi, [P.tx(a), P.ty(T.line(k, 'seg', a)), 0.05]); };
    anchors[k] = anchors['t' + pi];
  });
  let sweepNow = 70, cmpNow = 0;

  // ------------------------------------------------------------- update
  function update(S, t, dt) {
    const sl = clamp(S.charts_slides, 0, 1), hs = clamp(S.charts_hist, 0, 1), tr = clamp(S.charts_trend, 0, 1), cm = clamp(S.charts_cmp, 0, 1);
    const sw = clamp(S.charts_sweep, 20, 70), foc = clamp(S.charts_focus, 0, 4), side = smooth(clamp(S.charts_side, 0, 1));
    const rfA = clamp(S.charts_rf, 0, 1), sgA = clamp(S.charts_seg, 0, 1), bandA = clamp(S.charts_band, 0, 1), scA = clamp(S.charts_score, 0, 1), ioA = clamp(S.charts_iou, 0, 1);
    sweepNow = sw; cmpNow = cm;
    // the slides and the histogram
    for (const me of [glass, tissue, label]) { me.material.uniforms.uIn.value = sl; me.material.uniforms.uHist.value = hs; }
    slides.visible = sl > 0.001;
    fadeTo(histPlate, prog(hs, 0.4, 1) * sl);
    // the panels: the charts show with trend (and comparison); one may be focused (big in the middle)
    const pa = Math.max(tr, cm);
    const fw = [1, 2, 3, 4].map(k => clamp(1 - Math.abs(foc - k), 0, 1)), fmax = Math.max(...fw);
    panels.forEach((P, pi) => {
      const w = fw[pi], a = pa * (1 - 0.85 * fmax + 0.85 * w);
      const gx = GRID[pi][0], gy = GRID[pi][1];
      P.g.position.set(lerp(gx, 0, w) * (1 - 0.38 * side) + 0.62 * side, lerp(gy, 0, w) * (1 - 0.38 * side), 0.25 * w);
      P.g.scale.setScalar(lerp(1, 1.9, w) * (1 - 0.38 * side) * (1 - 0.15 * fmax * (1 - w)));
      P.g.visible = a > 0.003;
      if (!P.g.visible) return;
      P.boardMat.uniforms.uFade.value = 0.9 * a;
      fadeTo(P.trendFace, a * (1 - prog(cm, 0, 0.5))); fadeTo(P.cmpFace, a * prog(cm, 0.5, 1));
      P.lineMat.uniforms.uSweep.value = P.bandMat.uniforms.uSweep.value = sw;
      P.lineMat.uniforms.uOp.value = a * (1 - prog(cm, 0, 0.4)); P.bandMat.uniforms.uOp.value = a * bandA * (1 - prog(cm, 0, 0.4));
      P.lineMat.uniforms.uRF.value = P.bandMat.uniforms.uRF.value = rfA; P.lineMat.uniforms.uSeg.value = P.bandMat.uniforms.uSeg.value = sgA;
      P.lines.visible = cm < 0.4; P.bands.visible = bandA > 0.003 && cm < 0.4;
      P.cmpLineMat.uniforms.uFade.value = a * prog(cm, 0.6, 1); P.cmpLines.visible = cm > 0.6;
      P.cursor.position.x = P.tx(sw); P.cursorMat.opacity = a * set.uA.value * 0.8 * (1 - prog(cm, 0, 0.3)) * (sw < 69.9 ? 1 : 0); P.cursor.visible = sw < 69.9 && cm < 0.3;
      // the dots: they drop in with the chart, show up to the age cursor, and for the comparison each donor's two dots
      // fly to one place (random forest across, segmentation up), where its random forest dot stays
      const key = [tr.toFixed(3), cm.toFixed(3), sw.toFixed(2), rfA.toFixed(2), sgA.toFixed(2)].join();
      if (key === P.last) return;
      P.last = key;
      const pos = P.dg.attributes.position.array, al = P.dg.attributes.aA.array;
      for (let j = 0; j < 2 * N; j++) {
        const seg = j >= N, dIn = smooth(clamp(tr * 1.6 - P.DL[j] * 0.6, 0, 1)), dC = smooth(clamp(cm * 1.5 - P.DL[j] * 0.5, 0, 1));
        const a0 = dIn * (seg ? sgA : rfA) * prog(sw - P.AG[j] + 1, 0, 1);
        const tz = P.TP[3 * j + 2], fall = (1 - dIn) * 0.25;
        pos[3 * j] = lerp(P.TP[3 * j], P.CP[3 * j], dC); pos[3 * j + 1] = lerp(P.TP[3 * j + 1] + fall, P.CP[3 * j + 1], dC) + Math.sin(dC * Math.PI) * 0.05; pos[3 * j + 2] = lerp(tz, P.CP[3 * j + 2], dC);
        al[j] = Math.max(cm > 0 ? (seg ? (1 - dC) * a0 : Math.max(a0, dC)) : a0, 0);
      }
      P.dg.attributes.position.needsUpdate = true; P.dg.attributes.aA.needsUpdate = true;
    });
    // the scores
    rfMat.uniforms.uGrow.value = smooth(scA); iouMat.uniforms.uGrow.value = smooth(ioA);
    rfBars.visible = scA > 0.003; iouBars.visible = ioA > 0.003;
    fadeTo(rfPlate, prog(scA, 0, 0.4)); fadeTo(iouPlate, prog(ioA, 0, 0.4));
  }

  const titleOf = k => kind(k).title;
  return Object.assign(set, {
    params: { charts_a: 1, charts_slides: 0, charts_hist: 0, charts_trend: 1, charts_sweep: 70, charts_focus: 0, charts_rf: 1, charts_seg: 1, charts_band: 0, charts_cmp: 0, charts_side: 0, charts_score: 0, charts_iou: 0 },
    update,
    anchors,
    labels: [
      { text: ['255 donors', 'GTEx, aged 20 to 70'], at: 'histTop', cls: 'cyn', alpha: S => prog(S.charts_hist, 0.7, 1) * S.charts_slides },
      ...ORDER.map((k, pi) => ({
        text: () => (cmpNow > 0.5 ? [titleOf(k), `r ${T.rText(kind(k).compare.r)}`] : [titleOf(k), `RF ${T.rText(kind(k).trend.rf.r)} · Seg ${T.rText(kind(k).trend.seg.r)}`]),
        at: 't' + pi, cls: ['', 'mag', 'cyn', 'grn'][pi],
        alpha: S => { const w = q => clamp(1 - Math.abs(S.charts_focus - q), 0, 1), fm = Math.max(w(1), w(2), w(3), w(4)); return Math.max(S.charts_trend, S.charts_cmp) * (1 - fm + w(pi + 1)) * (1 - S.charts_side * 0.6); },
      })),
      { text: ['Random forest', 'precision · recall · F1'], at: 'rfScores', cls: 'amb', alpha: S => prog(S.charts_score, 0.5, 1) },
      { text: ['SegFormer', 'IoU (overlap of masks)'], at: 'iouScores', cls: 'grn', alpha: S => prog(S.charts_iou, 0.5, 1) },
      { text: ['Cyst', 'hard: 0.15'], at: 'cyst', cls: 'amb', alpha: S => prog(S.charts_iou, 0.7, 1) },
    ],
    cam: {
      default: [0, 4, 3.05, 0, 0, 0], hist: [0, 6, 3.2, -0.05, -0.1, 0], fan: [0, 14, 3.0, 0, -0.15, 0], trends: [0, 4, 3.05, 0, 0, 0],
      focus: [0, 3, 2.6, 0, 0, 0.25], scores: [0, 8, 3.4, 0, 0, 0], rf: [-8, 10, 2.4, RX0 + RXW / 2, 0, 0], iou: [8, 10, 2.4, IX0 + IXW / 2, 0, 0],
      side: [0, 4, 3.5, 0, 0, 0],
    },
    controls: [
      { key: 'view', label: 'Chart', options: [['hist', 'Donors'], ['trends', 'Trends'], ['compare', 'Methods agree?'], ['scores', 'Scores']] },
      { key: 'focus', label: 'Object', options: [['0', 'All'], ['1', 'Vessels'], ['2', 'Scars'], ['3', 'Follicles'], ['4', 'Macrophages']] },
      { key: 'method', label: 'Method', options: [['both', 'Both'], ['rf', 'Random forest'], ['seg', 'Segmentation']] },
    ],
    explore(c) {
      const v = c.view || 'trends', m = c.method || 'both';
      return {
        charts_slides: v === 'hist' ? 1 : 0, charts_hist: v === 'hist' ? 1 : 0, charts_trend: v === 'trends' ? 1 : 0, charts_cmp: v === 'compare' ? 1 : 0,
        charts_focus: v === 'trends' || v === 'compare' ? +(c.focus || 0) : 0, charts_sweep: 70, charts_band: v === 'trends' ? 1 : 0,
        charts_rf: m === 'seg' ? 0.12 : 1, charts_seg: m === 'rf' ? 0.12 : 1, charts_score: v === 'scores' ? 1 : 0, charts_iou: v === 'scores' ? 1 : 0, charts_side: 0,
      };
    },
    api() {
      return {
        order: ORDER,
        // the poster's line at an age, and what the drawn dots give (illustrative)
        line: (k, m, a) => T.line(k, m, a), cohortR: D.cohort.r,
      };
    },
  });
};
