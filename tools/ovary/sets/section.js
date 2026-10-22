// A drawn H&E section of an ovary in 3D relief (the aging ovary story): pink stroma with purple nuclei (the tour's
// tissue look; never a GTEx image), and on it the poster's four kinds of object, each a small lit body standing out of
// the section: blood vessels (a wall round a lumen), macrophages (small brown cells), corpora albicantia (large pale
// wavy scars) and follicles (a ring of granulosa cells round an oocyte; antral ones round a fluid-filled antrum), and a
// few cysts. Each kind can be picked out in the poster's color. Their counts follow the poster's trend lines for the
// section's age (OVARY_TREND.level), and a younger and an older section stand side by side. The two methods: (1) the
// section cut into tiles, every tile's features (UNI2) as a mosaic of glowing blocks, a small grove of decision trees
// (the random forest) voting, the tiles colored by their predicted label; (2) SegFormer's masks painting the objects
// (honestly imperfect where its IoU is low: the cyst's 0.15). And the illustrative spatial neighbor network of the
// objects, which changes as they do with age.
SETS.section = function (K) {
  const { THREE, smooth, clamp, prog, lerp } = K;
  const L = OVARY_LOOK, T = OVARY_TREND, C = L.C, KI = L.KI;
  L.init(K);
  const set = K.newSet('section');
  const VES = KI.vessel, MAC = KI.macrophage, ALB = KI.albicans, FOL = KI.follicle, CYS = KI.cyst;
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), ZA = new THREE.Vector3(0, 0, 1);
  const at = (x, y, z, s = [1, 1, 1], rot = 0) => M4.compose(V.set(x, y, z), Q.setFromAxisAngle(ZA, rot), SC.set(s[0], s[1], s[2])).clone();
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const tint = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  // shapes made once, placed and sized by matrix
  const SPH0 = L.sphere(1, 0), SPH1 = L.sphere(1, 1), SPH2 = L.sphere(1, 2);
  const RING = L.ring(0.62, 1, 0.5, 0.2, 22), THIN = L.ring(0.9, 1, 0.35, 0.2, 40), ZONA = L.ring(0.8, 1, 0.6, 0.1, 20);
  const THECA = new THREE.RingGeometry(0.98, 1.22, 40, 1), DISC = new THREE.CircleGeometry(1, 28), CYL = new THREE.CylinderGeometry(1, 1, 1, 6), CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
  const discEdge = (x, y) => Math.min(1, Math.hypot(x, y));

  // the stains are made between frames (idle, and in update while shown) or at once (finish)
  const JOBS = [];
  let built = false;
  function step(ms) {
    if (built) return true;
    const until = performance.now() + ms;
    while (JOBS.length) { const r = JOBS[0].next(); if (r.done) { JOBS.shift(); continue; } if (performance.now() > until) return false; }
    return (built = true);
  }

  // ------------------------------------------------------------- one section
  // o: { seed, sx, sy, waves [[k, amp, phase]], notch [angle, depth, width], counts per kind, albicans size, age (the
  // age it is drawn at when fixed), tex (stain texture size) }
  function makeSection(o) {
    const R = K.rng(o.seed), rr = (a, b) => a + (b - a) * R();
    const nz = L.noise3(o.seed + 5), nz2 = L.noise3(o.seed + 6);
    const rad = th => 0.8 * (1 + o.waves.reduce((s, [k, a, p]) => s + a * Math.sin(k * th + p), 0) - (o.notch ? o.notch[1] * Math.exp(-((((th - o.notch[0] + 3 * Math.PI) % (2 * Math.PI) - Math.PI) / o.notch[2]) ** 2)) : 0));
    // how far inside the outline (in units; negative outside)
    const inside = (x, y) => { const u = x / o.sx, v = y / o.sy, th = Math.atan2(v, u); return (rad(th) - Math.hypot(u, v)) * Math.min(o.sx, o.sy); };
    const g = new THREE.Group();
    // --- the slab: its top (the stained face), its rim and its back
    const NO = 160, OUT = [];
    for (let i = 0; i < NO; i++) { const th = i / NO * 2 * Math.PI, r = rad(th); OUT.push([r * Math.cos(th) * o.sx, r * Math.sin(th) * o.sy]); }
    const shape = new THREE.Shape(OUT.map(([x, y]) => new THREE.Vector2(x, y)));
    const top = new THREE.ShapeGeometry(shape, 1);
    const TH = 0.03, ext = 1.05;
    {
      const p = top.attributes.position, uv = top.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) / ext + 1) / 2, (p.getY(i) / ext + 1) / 2);
    }
    const side = (() => {
      const P = [], N = [], I = [];
      for (let i = 0; i <= NO; i++) {
        const [x, y] = OUT[i % NO], [x0, y0] = OUT[(i + NO - 1) % NO], [x1, y1] = OUT[(i + 1) % NO], tx = x1 - x0, ty = y1 - y0, l = Math.hypot(tx, ty) || 1;
        P.push(x, y, 0, x, y, -TH); N.push(ty / l, -tx / l, 0, ty / l, -tx / l, 0);
      }
      for (let i = 0; i < NO; i++) { const a = 2 * i; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); gg.setIndex(I);
      return gg;
    })();
    const back = top.clone(); back.translate(0, 0, -TH); back.rotateY(0); { const n = back.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0, -1); }
    // --- the stain (eosin-pink stroma in whorls, denser and more purple in the cortex under the rim, looser and paler
    // in the medulla; spindle-shaped purple nuclei, dense in the cortex): made between frames (a flat eosin until then)
    const TX = o.tex, D = new Uint8Array(TX * TX * 4);
    new Uint32Array(D.buffer).fill(0xffb496e8);   // (little-endian RGBA: e8 96 b4 ff)
    const tex = new THREE.DataTexture(D, TX, TX, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
    function* stain() {
      const RS = K.rng(o.seed + 9);
      for (let j = 0; j < TX; j++) {
        for (let i = 0; i < TX; i++) {
          const x = ((i + 0.5) / TX * 2 - 1) * ext, y = ((j + 0.5) / TX * 2 - 1) * ext, e = inside(x, y);
          if (e < -0.02) continue;
          const k = 4 * (j * TX + i);
          const cx = clamp(1 - e / (0.2 + 0.04 * nz(x * 3, y * 3, 0)), 0, 1), w = nz(x * 2.2, y * 2.2, 3);
          const fib = 0.5 + 0.5 * Math.sin((x * Math.cos(w * 2.5) + y * Math.sin(w * 2.5)) * 95 + 5 * nz2(x * 4, y * 4, 1));
          let c = mix(C.eosin2, C.eosin, 0.35 + 0.35 * fib + 0.2 * nz2(x * 9, y * 9, 2));
          c = mix(c, mix(C.eosin, C.nucleus2, 0.45), 0.55 * cx);
          if (e < 0.012) c = mix(c, C.eosin, 0.6);
          D[k] = c[0] * 255; D[k + 1] = c[1] * 255; D[k + 2] = c[2] * 255;
        }
        if ((j & 7) === 7) yield;
      }
      const NN = Math.round(TX * TX * 0.03);
      for (let n = 0; n < NN; n++) {
        const x = (RS() * 2 - 1) * ext, y = (RS() * 2 - 1) * ext, e = inside(x, y);
        if (e < 0.004) continue;
        const cx = clamp(1 - e / 0.22, 0, 1);
        if (RS() > 0.28 + 0.72 * cx) continue;
        const i0 = Math.floor((x / ext + 1) / 2 * TX), j0 = Math.floor((y / ext + 1) / 2 * TX), ang = nz(x * 1.3, y * 1.3, 7) * 4 + nz2(x * 6, y * 6, 3), len = 1 + Math.round(RS() * 2 * (0.4 + cx) * TX / 1024);
        const col = RS() < 0.7 ? C.nucleus : C.nucleus2;
        for (let st = -len; st <= len; st++) {
          const ii = i0 + Math.round(Math.cos(ang) * st), jj = j0 + Math.round(Math.sin(ang) * st);
          if (ii < 0 || jj < 0 || ii >= TX || jj >= TX) continue;
          const k = 4 * (jj * TX + ii), a = 0.75;
          D[k] = D[k] * (1 - a) + col[0] * 255 * a; D[k + 1] = D[k + 1] * (1 - a) + col[1] * 255 * a; D[k + 2] = D[k + 2] * (1 - a) + col[2] * 255 * a;
        }
        if ((n & 4095) === 4095) yield;
      }
      tex.needsUpdate = true;
    }
    JOBS.push(stain());
    const slabMat = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uMap: { value: tex }, uDim: { value: 0 }, uDark: { value: 0 }, uFade: { value: 1 } },
      transparent: true,
      vertexShader: `varying vec2 vUv; varying vec3 vN, vV, vUp;
void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: L.LIT + `
uniform sampler2D uMap; uniform float uA, uDim, uDark, uFade; varying vec2 vUv; varying vec3 vN, vV, vUp;
void main() {
  vec3 n = normalize(vN), c = texture2D(uMap, vUv).rgb;
  if (!gl_FrontFacing) n = -n;
  // (the face is lit softly: a stained section, not a shiny one)
  vec3 col = mix(litC(c, n, normalize(vV), normalize(vUp), 0.04), c, 0.45) * (1.0 - 0.45 * uDim) * (1.0 - 0.7 * uDark);
  gl_FragColor = vec4(col, uA * uFade);
}`,
    });
    const rimMat = L.objMat(set, { gloss: 0.05 });
    set.mats.push(slabMat);
    const slab = new THREE.Mesh(top, slabMat);
    // (rim and back: the eosin color, lit)
    const rimB = L.builder(); rimB.add(side, { col: tint(C.eosin, 0.85) }); rimB.add(back, { col: tint(C.eosin, 0.7) });
    const rim = new THREE.Mesh(rimB.geometry(), rimMat);
    g.add(slab, rim);

    // --- the objects (placed in slots; each kind's slots go or come with age along the poster's lines)
    const OCC = [];   // [x, y, r]
    const free = (x, y, r, gap) => OCC.every(([a, b, q]) => (x - a) * (x - a) + (y - b) * (y - b) > (r + q + gap) * (r + q + gap));
    function slots(n, rMin, rMax, eMin, eMax, gap, tries = 5000) {
      const out = [];
      for (let t = 0; t < tries && out.length < n; t++) {
        const r = rr(rMin, rMax), x = rr(-1, 1) * o.sx * 0.95, y = rr(-1, 1) * o.sy * 0.95, e = inside(x, y);
        if (e < r + eMin || e > r + eMax || !free(x, y, r, gap)) continue;
        OCC.push([x, y, r]); out.push({ x, y, r, e });
      }
      return out;
    }
    const shuffle = n => { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const falls = (list, kind) => { const ord = shuffle(list.length); list.forEach((s, i) => { s.from = -99; s.until = T.crossing(kind, (ord[i] + 0.5) / list.length, false); }); };
    const rises = (list, kind) => { const ord = shuffle(list.length); list.forEach((s, i) => { s.from = T.crossing(kind, (ord[i] + 0.5) / list.length, true); s.until = 999; }); };
    const c = o.counts;
    const CY = slots(c.cyst, 0.07, 0.11, 0.08, 0.5, 0.04); CY.forEach(s => { s.from = -99; s.until = 999; });
    const AN = slots(c.antral, 0.085, 0.12, 0.03, 0.12, 0.04); falls(AN, 'follicle');
    const AL = slots(c.albicans, o.alb[0], o.alb[1], 0.02, 0.6, 0.025); rises(AL, 'albicans');
    const SE = slots(c.secondary, 0.034, 0.046, 0.015, 0.12, 0.02); falls(SE, 'follicle');
    const PR = slots(c.primary, 0.018, 0.024, 0.01, 0.1, 0.012); falls(PR, 'follicle');
    const VE = slots(c.vessel, 0.014, 0.048, 0.06, 0.9, 0.012); falls(VE, 'vessel');
    const MA = slots(c.macrophage, 0.011, 0.016, 0.01, 0.9, 0.01, 8000); falls(MA, 'macrophage');
    // the largest antral follicle lasts longest (the one the story points at)
    if (AN.length) { AN.sort((a, b) => b.r - a.r); const last = AN.reduce((a, s) => (s.until > a.until ? s : a), AN[0]); [last.until, AN[0].until] = [AN[0].until, last.until]; }
    // where each object is and when it shows (placed now, cheap); their meshes are made between frames (objects())
    const OBJ = [];
    for (const s of VE) { const e = rr(1, 1.7); OBJ.push({ k: VES, x: s.x, y: s.y, r: s.r * e, s, e, rot: rr(0, 3.14), from: s.from, until: s.until }); }
    for (const s of MA) OBJ.push({ k: MAC, x: s.x, y: s.y, r: s.r, s, rot: rr(0, 6.283), from: s.from, until: s.until });
    for (const s of AL) OBJ.push({ k: ALB, x: s.x, y: s.y, r: s.r, s, rot: rr(0, 6.283), seed: 40 + Math.floor(R() * 5000), from: s.from, until: s.until });
    for (const [list, stage] of [[AN, 'antral'], [SE, 'secondary'], [PR, 'primary']]) for (const s of list) OBJ.push({ k: FOL, x: s.x, y: s.y, r: s.r, s, rot: rr(0, 6.283), stage, from: s.from, until: s.until });
    for (const s of CY) OBJ.push({ k: CYS, x: s.x, y: s.y, r: s.r, s, from: s.from, until: s.until });
    const age = { value: o.age || 30 };
    const objMat = L.objMat(set, { gloss: 0.2, uniforms: { uAge: age } });
    const fadeMat = L.objMat(set, { gloss: 0.05, alpha: 0.75, depthWrite: false, polygonOffset: -1, uniforms: { uAge: age } });
    const maskMat = L.maskMat(set, { fill: 0.55, uniforms: { uAge: age } });
    const ob = (q, mode = 0) => [q.from, q.until, q.k, mode];
    function* objects() {
      const RG = K.rng(o.seed + 3), B1 = L.builder(), B2 = L.builder(), F = L.builder(), MK = L.builder();
      // a ring of granulosa cells (beads), in layers from r0 to r1
      const beadRing = (B, s, r0, r1, layers, sz, obj, cen, det) => {
        for (let l = 0; l < layers; l++) {
          const rl = r0 + (r1 - r0) * (layers === 1 ? 0.5 : l / (layers - 1)), n = Math.max(6, Math.round(2 * Math.PI * rl / (sz * 2.1)));
          for (let k = 0; k < n; k++) { const a = (k + 0.5 * (l & 1)) / n * 6.283; B.add(det, { m: at(s.x + Math.cos(a) * rl, s.y + Math.sin(a) * rl, 0.004, [sz, sz * 0.85, sz * 0.7], a), col: mix(C.nucleus, C.nucleus2, RG() * 0.6), cen, obj }); }
        }
      };
      let n = 0;
      for (const q of OBJ) {
        const s = q.s, obj = ob(q), cen = [s.x, s.y, 0];
        if (q.k === VES) {
          // vessels: a wall (pink-red, with a few flat nuclei) round a pale lumen, some with red cells; cut at a slant,
          // so oval
          const sx = s.r * q.e, sy = s.r, rot = q.rot;
          B1.add(RING, { m: at(s.x, s.y, 0, [sx, sy, 0.03], rot), col: mix([0.86, 0.43, 0.52], C.eosin, RG() * 0.4), cen, obj });
          B1.add(DISC, { m: at(s.x, s.y, 0.002, [sx * 0.64, sy * 0.64, 1], rot), col: [0.93, 0.85, 0.89], cen, obj });
          const nb = 3 + Math.floor(RG() * 4), cr = Math.cos(rot), sr = Math.sin(rot);
          for (let k = 0; k < nb; k++) { const a = k / nb * 6.283 + RG(), px = Math.cos(a) * 0.8, py = Math.sin(a) * 0.8; B1.add(SPH0, { m: at(s.x + (px * sx * cr - py * sy * sr), s.y + (px * sx * sr + py * sy * cr), 0.012, [0.007, 0.004, 0.004], a + rot), col: C.nucleus, cen, obj }); }
          if (RG() < 0.45) for (let k = 0; k < 4; k++) { const a = RG() * 6.283, d = RG() * 0.4; B1.add(DISC, { m: at(s.x + Math.cos(a) * d * sx, s.y + Math.sin(a) * d * sy, 0.004, [0.006, 0.006, 1]), col: C.blood, cen, obj }); }
          MK.add(DISC, { m: at(s.x, s.y, 0.02, [sx * 1.04, sy * 1.04, 1], rot), edge: discEdge, cen, obj });
        } else if (q.k === MAC) {
          // macrophages: small rounded cells, foamy and brown with iron pigment, a dark nucleus to one side
          const a = q.rot;
          B1.add(SPH1, { m: at(s.x, s.y, 0, [s.r, s.r * (0.8 + 0.2 * RG()), s.r * 0.55], a), col: mix(C.macrophage, [0.62, 0.42, 0.3], RG() * 0.5), cen, obj });
          B1.add(SPH0, { m: at(s.x + Math.cos(a) * s.r * 0.4, s.y + Math.sin(a) * s.r * 0.4, s.r * 0.4, [s.r * 0.42, s.r * 0.36, s.r * 0.3]), col: C.nucleus, cen, obj });
          MK.add(DISC, { m: at(s.x, s.y, 0.016, [s.r * 1.25, s.r * 1.25, 1]), edge: discEdge, cen, obj });
        } else if (q.k === ALB) {
          // corpora albicantia: large pale wavy bodies of collagen, a little raised, with folds
          const bg = L.blob(s.r, 0.009, 0.006, { seed: q.seed, waves: 0.3, wrinkle: 0.14, rings: 6, segs: 40 }), nz3 = L.noise3(q.seed);
          B2.add(bg, { m: at(s.x, s.y, 0, [1, 1, 1], q.rot), col: (x, y) => mix([0.9, 0.74, 0.86], [0.8, 0.56, 0.76], clamp(0.45 + 0.7 * nz3(x * 30, y * 30, 0), 0, 1)), cen, obj });
          const mg = L.blob(s.r * 1.04, 0.0001, 0.0001, { seed: q.seed, waves: 0.32, wrinkle: 0, rings: 6, segs: 40 });
          MK.add(mg, { m: at(s.x, s.y, 0.02, [1, 1, 1], q.rot), cen, obj });
        } else if (q.k === FOL) {
          // follicles: a ring of granulosa cells round an oocyte (in its pale zona); an antral one round a
          // fluid-filled antrum, its oocyte on a mound of cells; outside, a darker theca (fading with its follicle)
          if (q.stage === 'antral') {
            B2.add(DISC, { m: at(s.x, s.y, 0.001, [s.r * 0.74, s.r * 0.74, 1]), col: C.fluid, cen, obj });
            beadRing(B2, s, s.r * 0.76, s.r * 0.97, 3, 0.0062, obj, cen, SPH1);
            const a = q.rot, mx = s.x + Math.cos(a) * s.r * 0.55, my = s.y + Math.sin(a) * s.r * 0.55;
            for (let k = 0; k < 22; k++) { const b = RG() * 6.283, d = Math.sqrt(RG()) * s.r * 0.24; B2.add(SPH0, { m: at(mx + Math.cos(b) * d, my + Math.sin(b) * d, 0.005, [0.0058, 0.005, 0.004]), col: C.nucleus, cen, obj }); }
            B2.add(SPH2, { m: at(mx, my, 0.01, [s.r * 0.16, s.r * 0.16, s.r * 0.1]), col: C.oocyte, cen, obj });
            B2.add(ZONA, { m: at(mx, my, 0.004, [s.r * 0.21, s.r * 0.21, 0.02]), col: C.zona, cen, obj });
            B2.add(SPH1, { m: at(mx + s.r * 0.03, my + s.r * 0.02, 0.014, [s.r * 0.05, s.r * 0.05, s.r * 0.03]), col: C.nucleus2, cen, obj });
          } else {
            const sec = q.stage === 'secondary', lay = sec ? 3 : 1, sz = sec ? 0.0055 : 0.0048, ro = sec ? 0.42 : 0.6;
            beadRing(B2, s, s.r * (ro + 0.08), s.r * 0.95, lay, sz, obj, cen, SPH0);
            B2.add(SPH1, { m: at(s.x, s.y, 0.004, [s.r * ro * 0.82, s.r * ro * 0.82, s.r * 0.3]), col: C.oocyte, cen, obj });
            B2.add(ZONA, { m: at(s.x, s.y, 0.002, [s.r * ro, s.r * ro, 0.02]), col: C.zona, cen, obj });
          }
          F.add(THECA, { m: at(s.x, s.y, 0.0008, [s.r, s.r, 1]), col: [0.62, 0.32, 0.5], cen, obj: [s.from, s.until, FOL, 1] });
          // (the masks of a method with IoU 0.70: a little off for the smallest)
          const off = q.stage === 'primary' ? 0.35 : 0.08;
          MK.add(DISC, { m: at(s.x + s.r * off, s.y - s.r * off * 0.5, 0.02, [s.r * 1.12, s.r * 1.12, 1]), edge: discEdge, cen, obj });
        } else {
          // cysts: thin-walled pale cavities (their masks are the method's weak point: IoU 0.15)
          B1.add(THIN, { m: at(s.x, s.y, 0, [s.r, s.r * 0.92, 0.012]), col: tint(C.eosin, 0.95), cen, obj });
          B1.add(DISC, { m: at(s.x, s.y, 0.0015, [s.r * 0.92, s.r * 0.85, 1]), col: [0.95, 0.92, 0.96], cen, obj });
          MK.add(DISC, { m: at(s.x + s.r * 0.75, s.y + s.r * 0.35, 0.02, [s.r * 0.6, s.r * 0.45, 1]), edge: discEdge, cen, obj });
        }
        if (++n % 10 === 0) yield;
      }
      const m1 = new THREE.Mesh(B1.geometry(), objMat);
      yield;
      const m2 = new THREE.Mesh(B2.geometry(), objMat);
      yield;
      const fades = new THREE.Mesh(F.geometry(), fadeMat), masks = new THREE.Mesh(MK.geometry(), maskMat);
      fades.renderOrder = 1; masks.renderOrder = 3;
      g.add(m1, m2, fades, masks);
    }
    JOBS.push(objects());
    const visAt = (s, a) => smooth((a - s.from + 1.5) / 3) * (1 - smooth((a - s.until + 1.5) / 3));
    return { g, inside, rad, OUT, OBJ, AN, AL, VE, MA, CY, SE, PR, age, slabMat, rimMat, objMat, fadeMat, maskMat, visAt, TH };
  }

  // ------------------------------------------------------------- the two sections
  // A: the section of the story (younger by default; its age is a param); B: an older ovary (66), smaller in life (its
  // scale bar is 791 µm against A's 1.58 mm), with large scars and no follicles, shown beside A
  const SA = makeSection({ seed: 811, sx: 1.12, sy: 0.9, waves: [[2, 0.07, 0.4], [3, 0.06, 1.3], [5, 0.035, 2.1], [8, 0.015, 0.2], [13, 0.008, 1]], notch: [-0.95, 0.13, 0.2], tex: 1024,
    counts: { vessel: 64, macrophage: 56, albicans: 14, antral: 3, secondary: 6, primary: 10, cyst: 2 }, alb: [0.07, 0.16] });
  const SB = makeSection({ seed: 977, sx: 1.18, sy: 0.72, waves: [[2, 0.1, 1.1], [3, 0.09, 0.2], [4, 0.05, 2.0], [7, 0.035, 1.0], [11, 0.02, 0.5], [17, 0.012, 2]], notch: [1.9, 0.1, 0.25], tex: 512, age: 66,
    counts: { vessel: 50, macrophage: 50, albicans: 24, antral: 1, secondary: 3, primary: 6, cyst: 2 }, alb: [0.12, 0.27] });
  const gA = new THREE.Group(), gB = new THREE.Group();
  gA.add(SA.g); gB.add(SB.g);
  set.group.add(gA, gB);
  // scale bars (white, at each section's upper left): 1.58 mm and 791 µm on the poster's sections, drawn to the same
  // proportion of each section's width as there (about an eighth)
  const barMat = L.objMat(set, { gloss: 0.3 });
  const bar = w => { const bb = L.builder(); bb.add(new THREE.BoxGeometry(w, 0.018, 0.012), { m: at(-0.78, 0.8, 0.02), col: [0.97, 0.97, 1] }); return new THREE.Mesh(bb.geometry(), barMat); };
  const barA = bar(0.24), barB = bar(0.22);
  barA.position.set(-0.05, -0.02, 0); barB.position.set(0.02, -0.14, 0);
  SA.g.add(barA); SB.g.add(barB);

  // ------------------------------------------------------------- method 1: tiles, features, the forest, predictions
  const TS = 0.075, TILES = [];
  for (let j = -14; j <= 14; j++) for (let i = -16; i <= 16; i++) {
    const x = (i + 0.5) * TS, y = (j + 0.5) * TS;
    if (SA.inside(x, y) < TS * 0.2) continue;
    // its label: the object under its middle (the largest it overlaps), else none (stroma)
    let lab = -1, best = 0;
    for (const ob of SA.OBJ) { const d = Math.hypot(ob.x - x, ob.y - y), ov = ob.r + TS * 0.35 - d; if (ov > 0 && ob.k !== CYS && ob.r > best && ob.until > 30) { lab = ob.k; best = ob.r; } }
    TILES.push({ x, y, lab });
  }
  // the predictions: right mostly; now and then a near miss (illustrative)
  const RT = K.rng(77);
  for (const t of TILES) { t.pred = t.lab; const u = RT(); if (t.lab >= 0 && u < 0.1) t.pred = -1; else if (t.lab < 0 && u < 0.025) t.pred = [VES, MAC][Math.floor(RT() * 2)]; }
  // the tile the story follows: a follicle's, near the section's upper left
  const tile0 = TILES.filter(t => t.lab === FOL).sort((a, b) => (a.x - a.y) - (b.x - b.y))[0] || TILES[Math.floor(TILES.length / 2)];
  const NF = 16;
  // features: 16 numbers per tile, from a prototype per label plus noise (what a foundation model's numbers might look
  // like, illustrative)
  const PROTO = [-1, VES, MAC, ALB, FOL].map((k, i) => Array.from({ length: NF }, (_, f) => clamp(0.5 + 0.45 * Math.sin(f * (1.7 + i * 0.9) + i * 2.1), 0.05, 1)));
  const protoOf = lab => PROTO[[-1, VES, MAC, ALB, FOL].indexOf(lab)];
  for (const t of TILES) { const p = protoOf(t.lab); t.f = p.map(v => clamp(v + 0.16 * K.gauss(RT), 0, 1)); t.wave = Math.hypot(t.x - tile0.x, t.y - tile0.y); }
  const maxWave = Math.max(...TILES.map(t => t.wave));
  // tile outlines, drawn on one by one from the upper left
  const tl = K.linesGeo(TILES.length * 4), tlP = tl.attributes.position.array, tlC = tl.attributes.aCol.array, tlT = tl.attributes.aT.array;
  TILES.forEach((t, k) => {
    const h = TS * 0.47, cs = [[-h, -h], [h, -h], [h, h], [-h, h]], ord = ((t.x + 1.3) - (t.y - 1.1)) / 4.6;
    for (let e = 0; e < 4; e++) { const a = cs[e], b = cs[(e + 1) % 4], q = 6 * (4 * k + e); tlP.set([t.x + a[0], t.y + a[1], 0.03, t.x + b[0], t.y + b[1], 0.03], q); tlC.set([0.55, 0.9, 1, 0.55, 0.9, 1], q); tlT[2 * (4 * k + e)] = tlT[2 * (4 * k + e) + 1] = ord; }
  });
  const tileMat = K.lines(set, { uniforms: { uGlow: { value: 0.7 } } });
  const tileLines = new THREE.LineSegments(tl, tileMat);
  SA.g.add(tileLines);
  // features: a mosaic of 4 x 4 glowing blocks on each tile, each as tall and bright as one of its numbers (the even
  // scale for numbers: indigo low, teal, green, yellow high), lighting up in a wave from the followed tile
  const NB = TILES.length * NF;
  const boxGeo = new THREE.InstancedBufferGeometry();
  {
    const P = [], N = [], I = [];
    const face = (o, u, v, n) => { const b = P.length / 3; for (const [a, c] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { P.push(o[0] + u[0] * a + v[0] * c, o[1] + u[1] * a + v[1] * c, o[2] + u[2] * a + v[2] * c); N.push(...n); } I.push(b, b + 1, b + 2, b, b + 2, b + 3); };
    face([-0.5, -0.5, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    face([-0.5, -0.5, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0]); face([0.5, 0.5, 0], [-1, 0, 0], [0, 0, 1], [0, 1, 0]);
    face([0.5, -0.5, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]); face([-0.5, 0.5, 0], [0, -1, 0], [0, 0, 1], [-1, 0, 0]);
    boxGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); boxGeo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); boxGeo.setIndex(I);
    const aB = new Float32Array(NB * 4);
    TILES.forEach((t, k) => { for (let b = 0; b < NF; b++) aB.set([t.x + ((b % 4) + 0.5 - 2) * TS * 0.22, t.y + (Math.floor(b / 4) + 0.5 - 2) * TS * 0.22, t.f[b], t.wave / maxWave + 0.02 * b], 4 * (k * NF + b)); });
    boxGeo.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4));
    boxGeo.instanceCount = NB;
    boxGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.5);
  }
  const ICE = `
vec3 ice(float v) {
  vec3 c = mix(vec3(0.3, 0.2, 0.72), vec3(0.12, 0.62, 0.78), smoothstep(0.05, 0.5, v));
  c = mix(c, vec3(0.35, 0.86, 0.45), smoothstep(0.45, 0.75, v));
  return mix(c, vec3(1.0, 0.9, 0.28), smoothstep(0.7, 1.0, v));
}`;
  const blockMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uFeat: { value: 0 }, uOut: { value: 1 } }, transparent: true,
    vertexShader: ICE + `
uniform float uFeat, uOut; attribute vec4 aB;
varying vec3 vN, vV, vC; varying float vTop;
void main() {
  float g = smoothstep(0.0, 1.0, clamp((uFeat * 1.5 - aB.w) / 0.45, 0.0, 1.0)) * uOut;
  float h = (0.002 + 0.03 * pow(aB.z, 1.5)) * g, w = ${(TS * 0.22 * 0.72).toFixed(4)};
  vec3 p = vec3(aB.x + position.x * w, aB.y + position.y * w, 0.004 + position.z * h);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = ice(aB.z) * (0.75 + 0.5 * aB.z); vTop = position.z;
  gl_Position = projectionMatrix * mv;
  if (g < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA; varying vec3 vN, vV, vC; varying float vTop;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.5, 0.6, 1.0));
  float df = max(dot(n, l), 0.0), fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  gl_FragColor = vec4(vC * (0.55 + 0.6 * df) * mix(0.55, 1.15, vTop) + mix(vC, vec3(1.0), 0.5) * fr * 0.25, uA);
}`,
  });
  set.mats.push(blockMat);
  const blocks = new THREE.Mesh(boxGeo, blockMat);
  blocks.frustumCulled = false;
  SA.g.add(blocks);
  // the predictions: each tile washed in its predicted label's color (stroma tiles stay clear), sweeping left to right
  const PB = L.builder(), SQ = new THREE.PlaneGeometry(1, 1);
  for (const t of TILES) if (t.pred >= 0) PB.add(SQ, { m: at(t.x, t.y, 0.034, [TS * 0.94, TS * 0.94, 1]), edge: (x, y) => Math.max(Math.abs(x), Math.abs(y)) * 2, cen: [t.x, t.y, 0], obj: [-99, 999, t.pred, 0] });
  const predMat = L.maskMat(set, { fill: 0.5, hiFill: 0 });
  const predMesh = new THREE.Mesh(PB.geometry(), predMat);
  predMesh.renderOrder = 4;
  SA.g.add(predMesh);

  // the random forest: a small grove of decision trees beside the section (5 trees, 4 questions deep), standing on a
  // dark disc; as they vote, each lights the path its questions take from the root to a leaf, the leaves in the
  // colors of the labels they stand for; most of them say "follicle", and the tile takes that label
  const GROVE = [1.58, -0.1, 0.12], NT = 5, DEPTH = 4, CLS = [-1, VES, MAC, ALB, FOL];
  const FB = L.builder(), PATH = L.builder(), RF = K.rng(5);
  const trees = [];
  for (let ti = 0; ti < NT; ti++) {
    const row = ti < 3 ? 0 : 1, col = row === 0 ? ti - 1 : ti - 3.5, base = [GROVE[0] + col * 0.3, GROVE[1] - 0.4, GROVE[2] + (row === 0 ? 0.18 : -0.14)];
    const nodes = [];
    for (let l = 0; l <= DEPTH; l++) for (let k = 0; k < 2 ** l; k++) {
      const w = 0.27, x = base[0] + ((k + 0.5) / 2 ** l - 0.5) * w * (l === 0 ? 0 : 1), y = base[1] + 0.13 + l * 0.12, z = base[2] + (l ? (RF() - 0.5) * 0.05 : 0);
      nodes.push({ l, k, p: [x, y, z] });
    }
    const idx = (l, k) => 2 ** l - 1 + k;
    // the trunk
    FB.add(new THREE.CylinderGeometry(0.008, 0.012, 0.13, 8), { m: at(base[0], base[1] + 0.065, base[2]), col: [0.55, 0.45, 0.4] });
    // its path: the questions this tile's features answer (a vote for its label, but one tree errs)
    let k = 0; const path = [0];
    for (let l = 1; l <= DEPTH; l++) { k = 2 * k + (RF() < 0.5 ? 0 : 1); path.push(idx(l, k)); }
    const vote = ti === 3 ? ALB : FOL;
    nodes.forEach((n, i) => {
      const leaf = n.l === DEPTH, cls = leaf ? (path.includes(i) ? vote : CLS[(i * 7 + ti) % 5]) : -1;
      const colr = leaf ? (cls < 0 ? [0.7, 0.72, 0.78] : L.GLOW[cls]) : [0.86, 0.84, 0.8];
      FB.add(SPH1, { m: at(...n.p, leaf ? [0.022, 0.022, 0.022] : [0.015, 0.015, 0.015]), col: colr });
      if (n.l > 0) {
        const pa = nodes[idx(n.l - 1, n.k >> 1)].p, a = new THREE.Vector3(...pa), b = new THREE.Vector3(...n.p), d = b.clone().sub(a), ln = d.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), mid = a.clone().add(b).multiplyScalar(0.5);
        FB.add(CYL, { m: new THREE.Matrix4().compose(mid, q, new THREE.Vector3(0.005, ln, 0.005)), col: [0.75, 0.72, 0.68] });
        if (path.includes(i)) PATH.add(CYL8, { m: new THREE.Matrix4().compose(mid, q, new THREE.Vector3(0.011, ln, 0.011)), col: colr, cen: n.p, obj: [-99, 999, -1, (ti * 0.12 + n.l * 0.11)] });
      }
      if (path.includes(i)) PATH.add(SPH1, { m: at(...n.p, [0.032, 0.032, 0.032]), col: leaf ? colr : [1, 0.95, 0.75], cen: n.p, obj: [-99, 999, -1, (ti * 0.12 + n.l * 0.11)] });
    });
    trees.push({ base, top: nodes[path[DEPTH]].p, vote });
  }
  FB.add(new THREE.CylinderGeometry(0.5, 0.5, 0.012, 48), { m: at(GROVE[0], GROVE[1] - 0.406, GROVE[2]), col: [0.16, 0.2, 0.28] });
  const groveMat = L.objMat(set, { gloss: 0.25 });
  const grove = new THREE.Mesh(FB.geometry(), groveMat);
  // the lit paths: a glow that runs up each tree in turn (aObj.w: when, in the vote's time)
  const pathMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uVote: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aCol; attribute vec4 aObj; uniform float uVote; varying vec3 vC; varying float vAl;
void main() { vAl = smoothstep(aObj.w, aObj.w + 0.06, uVote); vC = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); if (vAl < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`,
    fragmentShader: `uniform float uA; varying vec3 vC; varying float vAl; void main() { gl_FragColor = vec4(vC * 0.9, vAl * uA * 0.85); }`,
  });
  set.mats.push(pathMat);
  const paths = new THREE.Mesh(PATH.geometry(), pathMat);
  const groveG = new THREE.Group();
  groveG.add(grove, paths);
  set.group.add(groveG);
  // the features flowing from the followed tile into the trees (points along arcs), and the verdict flowing back
  const NFP = 90, fpG = K.pointsGeo(NFP), fpP = fpG.attributes.position.array, fpC = fpG.attributes.aCol.array, fpS = fpG.attributes.aSize.array;
  const fpU = new Float32Array(NFP * 4);
  for (let i = 0; i < NFP; i++) { const tr = trees[i % NT], v = tile0.f[i % NF]; fpU.set([tr.base[0], tr.base[1] + 0.12, tr.base[2], i / NFP], 4 * i); fpC.set(i % 2 ? [0.45, 0.85, 1] : [1, 0.9, 0.4], 3 * i); fpS[i] = 0.014 + 0.012 * v; fpP.set([tile0.x, tile0.y, 0.05], 3 * i); }
  fpG.setAttribute('aU', new THREE.BufferAttribute(fpU, 4));
  fpG.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.6, 0, 0), 2);
  const flowMat = K.points(set, { uniforms: { uFlow: { value: 0 } }, head: 'attribute vec4 aU; uniform float uFlow;',
    vertex: `float ph = fract(uTime * 0.35 + aU.w), on = smoothstep(0.0, 0.08, uFlow) * (1.0 - smoothstep(0.92, 1.0, uFlow));
    vec3 a = position, b = aU.xyz; vec3 q = mix(a, b, ph); q.z += sin(ph * 3.14159) * 0.35; q.y += sin(ph * 3.14159) * 0.12;
    mv = modelViewMatrix * vec4(q, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = pointPx(aSize, mv); vA *= on * smoothstep(0.0, 0.1, ph) * (1.0 - smoothstep(0.85, 1.0, ph));
    if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);` });
  const flow = new THREE.Points(fpG, flowMat);
  flow.frustumCulled = false;
  set.group.add(flow);
  // the verdict: a glowing arc from the grove back to the tile, in the voted label's color
  const verdict = (() => {
    const a = [GROVE[0], GROVE[1] + 0.28, GROVE[2] + 0.1], b = [tile0.x, tile0.y, 0.05], pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) + Math.sin(t * Math.PI) * 0.25, lerp(a[2], b[2], t) + Math.sin(t * Math.PI) * 0.3]); }
    const gg = K.tube(pts, 0.006, 60, 6, false), n = gg.attributes.position.count, aT = new Float32Array(n), uvA = gg.attributes.uv;
    for (let i = 0; i < n; i++) aT[i] = uvA.getX(i);
    gg.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
    const m = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uT: { value: 0 }, uC: { value: new THREE.Vector3(...L.GLOW[FOL]) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aT; varying float vT; void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA, uT; uniform vec3 uC; varying float vT; void main() { float a = step(vT, uT) * (0.4 + 0.6 * smoothstep(uT - 0.15, uT, vT)); if (a < 0.01) discard; gl_FragColor = vec4(uC + 0.25, a * uA); }' });
    set.mats.push(m);
    return new THREE.Mesh(gg, m);
  })();
  set.group.add(verdict);
  // the followed tile itself, ringed and then lit in its label's color as the verdict lands
  const tileHi = (() => {
    const gg = new THREE.RingGeometry(TS * 0.5, TS * 0.62, 4, 1, Math.PI / 4);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    K.fade(set, m, 1);
    const me = new THREE.Mesh(gg, m); me.position.set(tile0.x, tile0.y, 0.036);
    return me;
  })();
  SA.g.add(tileHi);

  // ------------------------------------------------------------- method 2: SegFormer's masks, swept across
  const sweepBar = (() => {
    const m = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    K.fade(set, m, 0.5);
    const me = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 1.9), m);
    return me;
  })();
  SA.g.add(sweepBar);

  // ------------------------------------------------------------- the spatial neighbor network (illustrative)
  // every object a node floating over it, objects near each other linked (each to its nearest few within reach); a
  // node shows while its object does (with the age), a link while both ends do
  const NOD = SA.OBJ.filter(o => o.k !== FOL || o.stage !== 'primary');
  const ng = K.pointsGeo(NOD.length), ngP = ng.attributes.position.array, ngC = ng.attributes.aCol.array, ngS = ng.attributes.aSize.array, ngW = new Float32Array(NOD.length * 3);
  const HN = 0.09;
  NOD.forEach((o, i) => { ngP.set([o.x, o.y, HN], 3 * i); ngC.set(L.GLOW[o.k], 3 * i); ngS[i] = o.k === ALB ? 0.065 : o.k === FOL ? 0.055 : o.k === CYS ? 0.05 : o.k === VES ? 0.04 : 0.032; ngW.set([o.from, o.until, Math.hypot(o.x, o.y)], 3 * i); });
  ng.setAttribute('aW', new THREE.BufferAttribute(ngW, 3));
  const VIS = 'float visW(float a, float b) { return smoothstep(a - 1.5, a + 1.5, uAge) * (1.0 - smoothstep(b - 1.5, b + 1.5, uAge)); }';
  const nodeMat = K.points(set, { uniforms: { uAge: SA.age, uNet: { value: 0 } }, head: 'attribute vec3 aW; uniform float uAge, uNet; ' + VIS,
    vertex: 'vA *= visW(aW.x, aW.y) * smoothstep(aW.z * 0.9, aW.z * 0.9 + 0.15, uNet * 1.35 - 0.05);' });
  const nodes = new THREE.Points(ng, nodeMat);
  const LK = [];
  NOD.forEach((a, i) => {
    const near = NOD.map((b, j) => [Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r, j]).filter(([d, j]) => j !== i && d < 0.14).sort((p, q) => p[0] - q[0]).slice(0, 4);
    for (const [, j] of near) if (!LK.some(([p, q]) => (p === j && q === i) || (p === i && q === j))) LK.push([i, j]);
  });
  const lg = K.linesGeo(LK.length), lgP = lg.attributes.position.array, lgC = lg.attributes.aCol.array, lgW = new Float32Array(LK.length * 2 * 4);
  LK.forEach(([i, j], k) => {
    const a = NOD[i], b = NOD[j];
    lgP.set([a.x, a.y, HN, b.x, b.y, HN], 6 * k);
    const ca = L.GLOW[a.k], cb = L.GLOW[b.k];
    lgC.set([...ca, ...cb], 6 * k);
    const w = [Math.max(a.from, b.from), Math.min(a.until, b.until), Math.max(Math.hypot(a.x, a.y), Math.hypot(b.x, b.y)), 0];
    lgW.set(w, 8 * k); lgW.set(w, 8 * k + 4);
  });
  lg.setAttribute('aW', new THREE.BufferAttribute(lgW, 4));
  const linkMat = K.lines(set, { uniforms: { uAge: SA.age, uNet: { value: 0 } }, head: 'attribute vec4 aW; uniform float uAge, uNet; ' + VIS,
    vertex: 'vA *= 0.65 * visW(aW.x, aW.y) * smoothstep(aW.z * 0.9 + 0.05, aW.z * 0.9 + 0.2, uNet * 1.35 - 0.05);' });
  const links = new THREE.LineSegments(lg, linkMat);
  // stems from each node down to its object
  const sg = K.linesGeo(NOD.length), sgP = sg.attributes.position.array, sgC = sg.attributes.aCol.array, sgW = new Float32Array(NOD.length * 2 * 3);
  NOD.forEach((o, i) => { sgP.set([o.x, o.y, 0.02, o.x, o.y, HN], 6 * i); sgC.set([...L.GLOW[o.k], ...L.GLOW[o.k]], 6 * i); sgW.set([o.from, o.until, Math.hypot(o.x, o.y), o.from, o.until, Math.hypot(o.x, o.y)], 6 * i); });
  sg.setAttribute('aW', new THREE.BufferAttribute(sgW, 3));
  const stemMat = K.lines(set, { uniforms: { uAge: SA.age, uNet: { value: 0 } }, head: 'attribute vec3 aW; uniform float uAge, uNet; ' + VIS,
    vertex: 'vA *= 0.3 * visW(aW.x, aW.y) * smoothstep(aW.z * 0.9, aW.z * 0.9 + 0.15, uNet * 1.35 - 0.05);' });
  const stems = new THREE.LineSegments(sg, stemMat);
  SA.g.add(nodes, links, stems);

  // ------------------------------------------------------------- anchors
  const tmp = new THREE.Vector3();
  const inA = p => { tmp.set(p[0], p[1], p[2]); gA.updateMatrix(); tmp.applyMatrix4(gA.matrix); return [tmp.x, tmp.y, tmp.z]; };
  const inB = p => { tmp.set(p[0], p[1], p[2]); gB.updateMatrix(); tmp.applyMatrix4(gB.matrix); return [tmp.x, tmp.y, tmp.z]; };
  // a representative of each kind: one shown from 20 to 45 at least (the largest, near the middle)
  const rep = k => { const L0 = SA.OBJ.filter(o => o.k === k && o.from < 25 && o.until > 45); const pool = L0.length ? L0 : SA.OBJ.filter(o => o.k === k); return pool.sort((a, b) => (b.r - 0.2 * Math.hypot(b.x, b.y)) - (a.r - 0.2 * Math.hypot(a.x, a.y)))[0]; };
  const REP = { vessel: rep(VES), macrophage: rep(MAC), albicans: SA.AL.reduce((a, s) => (s.from < a.from ? s : a), SA.AL[0]), follicle: SA.AN[0], cyst: rep(CYS) };
  const topOf = (S, gfn) => { let y = -9, x = 0; for (const [px, py] of S.OUT) if (py > y) { y = py; x = px; } return () => gfn([x, y + 0.04, 0.02]); };
  let sweepX = -2, ageNow = 30;
  const anchors = {
    vessel: () => inA([REP.vessel.x, REP.vessel.y, 0.02]), macrophage: () => inA([REP.macrophage.x, REP.macrophage.y, 0.02]),
    albicans: () => inA([REP.albicans.x, REP.albicans.y, 0.02]), follicle: () => inA([REP.follicle.x, REP.follicle.y, 0.02]),
    cyst: () => inA([REP.cyst.x, REP.cyst.y, 0.02]), center: () => inA([0, 0, 0.02]),
    young: topOf(SA, inA), old: topOf(SB, inB),
    barYoung: () => inA([-0.83 + 0.0, 0.8 - 0.02 + 0.03, 0.03]), barOld: () => inB([-0.76 + 0.0, 0.8 - 0.14 + 0.03, 0.03]),
    tiles: () => inA([-0.55, 0.62, 0.04]), tile: () => inA([tile0.x, tile0.y, 0.05]), feat: () => inA([tile0.x, tile0.y + TS * 0.6, 0.05]),
    forest: [GROVE[0], GROVE[1] + 0.32, GROVE[2]], uni: () => { const a = inA([tile0.x, tile0.y, 0.05]); return [lerp(a[0], GROVE[0], 0.5), lerp(a[1], GROVE[1], 0.5) + 0.22, 0.3]; },
    pred: () => inA([0.3, -0.35, 0.05]), mask: () => inA([clamp(sweepX, -1, 1), 0.72, 0.05]),
    net: () => inA([0.0, 0.62, HN + 0.02]),
  };

  // ------------------------------------------------------------- update
  const hi = [0, 0, 0, 0, 0, 0];
  function update(S, t, dt) {
    if (!built) step(4);
    const age = clamp(S.section_age, 20, 70), pair = smooth(clamp(S.section_pair, 0, 1));
    ageNow = age; SA.age.value = age;
    // the pair: A shrinks to the left, B comes in on the right (both at 0.58 of A's size)
    const sc = 1 - 0.42 * pair;
    gA.position.set(-0.6 * pair, 0, 0); gA.scale.setScalar(sc);
    gB.position.set(0.62 * pair + 0.5 * (1 - pair), 0, 0); gB.scale.setScalar(0.58);
    gB.visible = pair > 0.01;
    for (const m of [SB.slabMat, SB.objMat, SB.fadeMat, SB.rimMat]) m.uniforms.uFade.value = (m === SB.fadeMat ? 0.75 : 1) * prog(pair, 0, 0.6);
    SB.maskMat.uniforms.uGrow.value = prog(pair, 0.5, 1);
    barA.visible = barB.visible = pair > 0.3;
    // picked out
    hi[VES] = clamp(S.section_vessel, 0, 1); hi[MAC] = clamp(S.section_macrophage, 0, 1); hi[ALB] = clamp(S.section_albicans, 0, 1); hi[FOL] = clamp(S.section_follicle, 0, 1); hi[CYS] = clamp(S.section_cyst, 0, 1);
    const pick = Math.max(...hi);
    // method 1
    const tiles = clamp(S.section_tiles, 0, 1), feat = clamp(S.section_feat, 0, 1), forest = clamp(S.section_forest, 0, 1), pred = clamp(S.section_pred, 0, 1);
    const mask = clamp(S.section_mask, 0, 1), net = clamp(S.section_net, 0, 1);
    const dark = 0.65 * prog(feat, 0, 0.3) * (1 - prog(pred, 0, 0.4)) + 0.35 * prog(net, 0, 0.4);
    for (const Sx of [SA, SB]) {
      L.setHi(Sx.objMat, hi, 0.5 * pick + 0.6 * dark); L.setHi(Sx.fadeMat, hi, 0.5 * pick + 0.6 * dark); L.setHi(Sx.maskMat, hi);
      Sx.slabMat.uniforms.uDim.value = pick; Sx.slabMat.uniforms.uDark.value = Sx === SA ? dark : 0;
      Sx.maskMat.uniforms.uMask.value = Sx === SA ? (mask > 0 ? 1 : 0) : 0;
    }
    sweepX = lerp(-1.25, 1.3, mask);
    SA.maskMat.uniforms.uSweep.value = sweepX;
    sweepBar.position.set(sweepX, 0, 0.05); sweepBar.visible = mask > 0.001 && mask < 0.999;
    tileMat.uniforms.uReveal.value = tiles * 1.05; tileLines.visible = tiles > 0.001;
    tileMat.uniforms.uGlow.value = 1;
    blockMat.uniforms.uFeat.value = feat; blockMat.uniforms.uOut.value = 1 - prog(pred, 0.3, 0.9); blocks.visible = feat > 0.001 && pred < 0.95;
    // the forest: in, then the features flow to it (0.1 to 0.45), the trees answer in turn (0.35 to 0.85), the verdict
    // flies back (0.8 to 0.95)
    groveG.visible = forest > 0.001;
    groveMat.uniforms.uFade.value = prog(forest, 0, 0.12);
    groveG.position.set(0, 0, 0); groveG.scale.setScalar(0.85 + 0.15 * smooth(forest / 0.12));
    flowMat.uniforms.uFlow.value = clamp((forest - 0.08) / 0.4, 0, 1); flow.visible = forest > 0.08 && forest < 0.5;
    pathMat.uniforms.uVote.value = (forest - 0.35) / 0.5 * 0.94;
    verdict.material.uniforms.uT.value = clamp((forest - 0.8) / 0.15, 0, 1); verdict.visible = forest > 0.8;
    tileHi.visible = (forest > 0.05 || feat > 0.05) && pred < 0.6;
    tileHi.material.color.setRGB(...(forest > 0.95 ? L.GLOW[FOL] : [1, 1, 1]));
    predMat.uniforms.uMask.value = pred > 0 ? 1 : 0; predMat.uniforms.uSweep.value = lerp(-1.25, 1.3, pred);
    // the network
    nodeMat.uniforms.uNet.value = linkMat.uniforms.uNet.value = stemMat.uniforms.uNet.value = net;
    nodes.visible = links.visible = stems.visible = net > 0.001;
  }

  // ------------------------------------------------------------- picking (explore): the object under a ray
  const plane = new THREE.Plane(), hit = new THREE.Vector3(), inv = new THREE.Matrix4();
  function pick(raycaster) {
    SA.g.updateMatrixWorld(true);
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1).transformDirection(SA.g.matrixWorld), new THREE.Vector3().setFromMatrixPosition(SA.g.matrixWorld));
    if (!raycaster.ray.intersectPlane(plane, hit)) return -1;
    hit.applyMatrix4(inv.copy(SA.g.matrixWorld).invert());
    let best = -1, bd = 1e9;
    for (const o of SA.OBJ) { if (SA.visAt(o, ageNow) < 0.5) continue; const d = Math.hypot(o.x - hit.x, o.y - hit.y) - o.r; if (d < 0.015 && d < bd) { bd = d; best = o.k; } }
    return best;
  }
  const count = (S, a) => { const n = [0, 0, 0, 0, 0]; for (const o of S.OBJ) if (S.visAt(o, a) > 0.5) n[o.k]++; return n; };

  const VIEWS = ['section', 'pair', 'tiles', 'features', 'forest', 'predicted', 'masks', 'network'];
  return Object.assign(set, {
    params: { section_a: 1, section_age: 30, section_pair: 0, section_vessel: 0, section_macrophage: 0, section_albicans: 0, section_follicle: 0, section_cyst: 0,
      section_tiles: 0, section_feat: 0, section_forest: 0, section_pred: 0, section_mask: 0, section_net: 0 },
    update,
    idle() { step(3); },
    finish() { step(Infinity); },
    built: () => built,
    anchors,
    labels: [
      { text: ['Younger ovary', ''], at: 'young', cls: 'cyn', alpha: S => prog(S.section_pair, 0.6, 1) },
      { text: ['Older ovary', ''], at: 'old', cls: 'mag', alpha: S => prog(S.section_pair, 0.6, 1) },
      { text: ['1.58 mm', ''], at: 'barYoung', cls: '', alpha: S => prog(S.section_pair, 0.7, 1) },
      { text: ['791 µm', ''], at: 'barOld', cls: '', alpha: S => prog(S.section_pair, 0.7, 1) },
      { text: ['Tiles', ''], at: 'tiles', cls: 'cyn', alpha: S => prog(S.section_tiles, 0.2, 0.5) * (1 - prog(S.section_feat, 0.05, 0.3)) },
      { text: ['Features', 'UNI2: numbers per tile'], at: 'feat', cls: 'cyn', alpha: S => prog(S.section_feat, 0.4, 0.7) * (1 - prog(S.section_forest, 0.05, 0.2)) },
      { text: ['Random forest', 'trees vote on each tile'], at: 'forest', cls: 'amb', alpha: S => prog(S.section_forest, 0.1, 0.3) * (1 - prog(S.section_pred, 0.5, 0.9)) },
      { text: ['SegFormer', 'paints a mask'], at: 'mask', cls: 'grn', alpha: S => prog(S.section_mask, 0.02, 0.1) * (1 - prog(S.section_mask, 0.9, 1)) },
      { text: ['Spatial neighbor network', 'illustrative'], at: 'net', cls: 'mag', alpha: S => prog(S.section_net, 0.5, 0.9) },
    ],
    cam: {
      default: [0, 8, 3.5, 0, 0, 0], close: [10, 16, 0.85, REP.follicle.x, REP.follicle.y, 0], pair: [0, 6, 3.4, 0, 0, 0],
      tiles: [0, 22, 3.0, 0, 0, 0], feat: [16, 38, 1.0, tile0.x, tile0.y, 0], forest: [-16, 10, 4.6, 0.5, 0, 0],
      mask: [0, 10, 3.3, 0, 0, 0], net: [8, 32, 3.1, 0, 0.02, 0],
    },
    controls: [
      { key: 'view', label: 'View', options: [['section', 'Section'], ['pair', 'Young and old'], ['tiles', 'Tiles'], ['forest', 'Forest'], ['masks', 'Masks'], ['network', 'Network']] },
      { key: 'age', label: 'Age', options: [['20', '20'], ['30', '30'], ['40', '40'], ['50', '50'], ['60', '60'], ['70', '70']] },
      { key: 'show', label: 'Pick out', options: [['none', 'None'], ['vessel', 'Vessels'], ['macrophage', 'Macrophages'], ['albicans', 'Scars'], ['follicle', 'Follicles'], ['cyst', 'Cysts']] },
    ],
    explore(c) {
      const v = c.view || 'section', s = c.show || 'none', tt = c.t || 0;
      const out = { section_age: +(c.age || 30), section_pair: v === 'pair' ? 1 : 0, section_tiles: 0, section_feat: 0, section_forest: 0, section_pred: 0, section_mask: 0, section_net: 0 };
      for (const k of ['vessel', 'macrophage', 'albicans', 'follicle', 'cyst']) out['section_' + k] = s === k ? 1 : 0;
      if (v === 'tiles') { out.section_tiles = 1; out.section_feat = 1; }
      if (v === 'forest') { out.section_tiles = 1; out.section_feat = 1; out.section_forest = clamp(tt / 8, 0, 1); out.section_pred = clamp((tt - 8) / 4, 0, 1); }
      if (v === 'masks') out.section_mask = clamp(tt / 5, 0, 1);
      if (v === 'network') out.section_net = 1;
      return out;
    },
    api() {
      return {
        kinds: OVARY_DATA.kinds.map(k => k.key), pick, views: VIEWS,
        // what the section shows at an age (objects per kind, by OVARY_DATA.kinds' index), A or B
        count: (a, which) => count(which === 'B' ? SB : SA, a),
        objects: SA.OBJ.map(o => ({ kind: o.k, x: o.x, y: o.y, r: o.r, from: o.from, until: o.until })),
        tiles: TILES.length, links: LK.length,
      };
    },
  });
};
