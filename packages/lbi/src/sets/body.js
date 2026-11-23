// Whole-body networks (slides 34-35): a standing figure, arms raised, as a total-body PET scan (a dense point
// cloud drawn as a maximum-intensity projection in the 'hot iron' colour map), the tracer sugar arriving through
// the blood and settling in the organs, then a network of 12 organs whose links rewire in disease.
SETS.body = function (K) {
  const { THREE, clamp, rng, v3 } = K;
  const set = K.newSet('body');
  const R = rng(34);
  const PI = Math.PI;

  // ------------------------------------------------------------ helpers --
  // smooth value noise (deterministic) for tissue texture
  const hash = (i, j, k) => {
    let h = (i * 374761393 + j * 668265263 + k * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fade3 = x => x * x * (3 - 2 * x);
  function noise(x, y, z) {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    const u = fade3(x - i), v = fade3(y - j), w = fade3(z - k);
    const a = (di, dj) => hash(i + di, j + dj, k) * (1 - w) + hash(i + di, j + dj, k + 1) * w;
    return (a(0, 0) * (1 - v) + a(0, 1) * v) * (1 - u) + (a(1, 0) * (1 - v) + a(1, 1) * v) * u;
  }
  // organ edges fall off smoothly (white core, yellow and orange rim), as the scanner's blur does
  const soft = (fn, k) => (p, q, a) => fn(p, q, a) * (1 - k * K.smooth((q - 0.78) / 0.22));
  // smooth union of two distances
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  // distance to a tapered capsule from a to b (radii ra, rb)
  function cone(x, y, z, c) {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    let h = (px * c[3] + py * c[4] + pz * c[5]) * c[6];
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = px - c[3] * h, dy = py - c[4] * h, dz = pz - c[5] * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (c[7] + (c[8] - c[7]) * h);
  }
  const mkCone = (a, b, ra, rb) => { const d = v3.sub(b, a); return [a[0], a[1], a[2], d[0], d[1], d[2], 1 / v3.dot(d, d), ra, rb]; };
  // approximate distance to an ellipsoid
  function ell(x, y, z, c, r) {
    const a = (x - c[0]) / r[0], b = (y - c[1]) / r[1], d = (z - c[2]) / r[2];
    return (Math.sqrt(a * a + b * b + d * d) - 1) * Math.min(r[0], r[1], r[2]);
  }

  // ------------------------------------------------------ the body shape --
  // y up, the figure faces +z, the person's left is +x; feet at y -0.95, hands at about +0.95
  const SIDES = [1, -1];
  const torsoRings = [   // y, half width, half depth, z centre
    [-0.135, 0.145, 0.092, -0.012], [-0.08, 0.158, 0.104, -0.012], [-0.01, 0.160, 0.102, -0.002], [0.08, 0.142, 0.097, 0.008],
    [0.18, 0.140, 0.100, 0.010], [0.30, 0.153, 0.108, 0.006], [0.40, 0.160, 0.104, 0.0], [0.47, 0.150, 0.088, -0.010],
    [0.53, 0.090, 0.060, -0.016],
  ];
  function torso(x, y, z) {
    const T = torsoRings, y0 = T[0][0], y1 = T[T.length - 1][0], yy = clamp(y, y0, y1);
    let i = 0;
    while (i < T.length - 2 && yy > T[i + 1][0]) i++;
    const f = fade3((yy - T[i][0]) / (T[i + 1][0] - T[i][0]));
    const at = c => T[i][c] + (T[i + 1][c] - T[i][c]) * f, w = at(1), d = at(2), zc = at(3);
    const q = Math.hypot(x / w, (z - zc) / d), e = (q - 1) * Math.min(w, d);
    const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
    return dy > 0 ? Math.hypot(Math.max(e, 0), dy) : e;
  }
  // joints of the pose (left side; the right side mirrors x)
  const J = {
    shoulder: [0.172, 0.468, -0.012], elbow: [0.33, 0.79, -0.002],
    hip: [0.086, -0.07, 0.0], knee: [0.094, -0.47, 0.012], ankle: [0.100, -0.872, -0.014],
    heel: [0.100, -0.918, -0.036], toe: [0.126, -0.93, 0.165],
  };
  const mir = (p, s) => [p[0] * s, p[1], p[2]];
  // hands rest crossed above the head: the left hand a little in front of the right
  const tips = { 1: [-0.045, 0.93, 0.038], [-1]: [0.045, 0.925, 0.004] };
  const wrists = { 1: [0.108, 0.902, 0.026], [-1]: [-0.108, 0.898, 0.006] };
  // limbs: [cone, blend radius, bounding sphere x, y, z, r]
  const limbs = [];
  const limb = (a, b, ra, rb, k) => {
    const m = v3.lerp(a, b, 0.5);
    limbs.push([mkCone(a, b, ra, rb), k, m[0], m[1], m[2], v3.dist(a, b) / 2 + Math.max(ra, rb)]);
  };
  for (const s of SIDES) {
    limb(mir(J.shoulder, s), mir(J.elbow, s), 0.048, 0.037, 0.05);
    limb(mir(J.elbow, s), wrists[s], 0.035, 0.024, 0.025);
    limb(wrists[s], v3.lerp(wrists[s], tips[s], 0.82), 0.024, 0.02, 0.012);
    limb(mir(J.hip, s), mir(J.knee, s), 0.084, 0.049, 0.06);
    limb(mir(J.knee, s), mir(J.ankle, s), 0.047, 0.027, 0.025);
    limb(mir(J.heel, s), mir(J.toe, s), 0.032, 0.022, 0.025);
  }
  const neck = mkCone([0, 0.49, -0.014], [0, 0.645, -0.004], 0.05, 0.046);
  function bodySDF(x, y, z) {
    let d = torso(x, y, z);
    if (y > 0.4) {
      d = smin(d, cone(x, y, z, neck), 0.04);
      d = smin(d, ell(x, y, z, [0, 0.712, 0.002], [0.077, 0.112, 0.097]), 0.03);
      d = smin(d, ell(x, y, z, [0, 0.632, 0.03], [0.058, 0.045, 0.066]), 0.02);
    }
    for (let i = 0; i < limbs.length; i++) {
      // skip a limb when even its bounding sphere is too far to change the blend
      const L = limbs[i], dx = x - L[2], dy = y - L[3], dz = z - L[4], m = Math.max(0, d + L[1] + L[5]);
      if (dx * dx + dy * dy + dz * dz > m * m) continue;
      d = smin(d, cone(x, y, z, L[0]), L[1]);
    }
    if (y < -0.4) d = smin(d, ell(Math.abs(x), y, z, [0.097, -0.59, -0.022], [0.046, 0.11, 0.05]), 0.03);   // calves
    return d;
  }

  // ------------------------------------------------------ point storage --
  // every point: position, steady intensity aI, uptake window aU (tracer progress), blood transient aB
  // (amplitude, arrival), size, and its response aK (see RESP)
  const MAX = 60000, XS = 0.9;   // XS: the figure is modelled a little broad, then slimmed across
  const P = new Float32Array(MAX * 3), AI = new Float32Array(MAX), AU = new Float32Array(MAX * 2);
  const AB = new Float32Array(MAX * 2), AS = new Float32Array(MAX), AK = new Float32Array(MAX * 3);
  let N = 0, resp = [0, 0, 0];
  function put(p, I, up, size, bAmp, bArr) {
    if (N >= MAX) return;
    P[3 * N] = p[0] * XS; P[3 * N + 1] = p[1]; P[3 * N + 2] = p[2];
    AI[N] = I; AU[2 * N] = up[0]; AU[2 * N + 1] = up[1];
    AB[2 * N] = bAmp || 0; AB[2 * N + 1] = bArr || 0; AS[N] = size;
    AK.set(resp, 3 * N);
    N++;
  }
  // how a kind of tissue responds: [early floor (soft tissue shows faintly from the first seconds, while the
  // blood spreads the tracer), relative change in disease, extra uptake in disease]. The disease scan (slide 35)
  // has more diffuse uptake in tissue and muscle and less in the heart and the urinary tract.
  const RESP = { none: [0, 0, 0], heart: [0, -0.45, 0], urine: [0, -0.18, 0] };
  const tissueResp = m => [0.25, 0, 0.02 + 0.08 * m];
  // when the tracer reaches each kind of tissue: [start, end] of uptake in body_pet units (0 injection, 1 steady scan)
  const UP = {
    tissue: [0.14, 0.6], bone: [0.2, 0.7], brain: [0.16, 0.72], heart: [0.12, 0.5], liver: [0.08, 0.32], spleen: [0.1, 0.38],
    kidney: [0.1, 0.3], pelvis: [0.26, 0.55], ureter: [0.42, 0.8], bladder: [0.5, 0.96], gut: [0.24, 0.78], gland: [0.18, 0.66],
  };
  const jit = a => 1 + (R() * 2 - 1) * a;
  // n points uniformly inside an ellipsoid (optionally on rotated axes); fn(p, q, a) gives the intensity (q radius 0..1)
  function ellFill(c, r, n, fn, up, size, axes, bA, bT) {
    for (let k = 0, guard = 0; k < n && guard < n * 4; guard++) {
      const a = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1], q = Math.hypot(a[0], a[1], a[2]);
      if (q > 1) continue;
      let o = [a[0] * r[0], a[1] * r[1], a[2] * r[2]];
      if (axes) o = v3.add(v3.add(v3.mul(axes[0], o[0]), v3.mul(axes[1], o[1])), v3.mul(axes[2], o[2]));
      const p = v3.add(c, o), I = fn(p, q, a);
      if (I <= 0) continue;
      put(p, I, up, size, bA, bT);
      k++;
    }
  }
  // an orthonormal frame whose first axis points along d
  function frame(d) {
    const u = v3.norm(d), ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const w = v3.norm(v3.cross(u, ref)), v = v3.cross(w, u);
    return [u, v, w];
  }
  // axes for an ellipsoid whose second (y) radius lies along d
  const along = d => { const f = frame(d); return [f[1], f[0], f[2]]; };
  // a smooth curve through points; returns { at(s), len }
  function curve(pts) {
    const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
    const len = c.getLength(), tmp = new THREE.Vector3();
    return { len, at: s => { c.getPointAt(clamp(s, 0, 1), tmp); return [tmp.x, tmp.y, tmp.z]; } };
  }
  // n points inside a tube of radius rad(s) along a curve; fn(s, p) gives the intensity
  function tubeFill(pts, rad, n, fn, up, size) {
    const c = curve(pts);
    for (let k = 0; k < n; k++) {
      const s = R(), u = K.unit(R), rr = (typeof rad === 'function' ? rad(s) : rad) * Math.cbrt(R());
      const p = v3.add(c.at(s), v3.mul(u, rr)), I = fn(s, p);
      if (I > 0) put(p, I, up, size);
    }
  }

  // ------------------------------------------------------ soft tissue --
  // uniform fill of the body: sample cells of a coarse grid that touch the body, keep points inside
  const lungs = [[-0.088, 0.365, -0.01, 0.068, 0.135, 0.088], [0.09, 0.375, -0.016, 0.058, 0.125, 0.083]];
  const inLung = p => lungs.some(L => ell(p[0], p[1], p[2], L, [L[3], L[4], L[5]]) < 0);
  // the body part a point belongs to: [muscle pattern 0..1, thickness of the part]. The pattern is low-frequency
  // and drawn out along the limb (or the trunk), so muscles show as long faint bundles.
  function part(p) {
    let best = torso(p[0], p[1], p[2]), ax = [0, 1, 0], th = 0.2;
    if (p[1] > 0.5 && Math.abs(p[0]) < 0.1) th = 0.17;   // neck and head
    for (const L of limbs) {
      const d = cone(p[0], p[1], p[2], L[0]);
      if (d < best) { best = d; ax = [L[0][3], L[0][4], L[0][5]]; th = L[0][7] + L[0][8]; }
    }
    const u = v3.norm(ax), a = v3.dot(p, u), q = v3.sub(p, v3.mul(u, a));
    return [noise(a * 5 + 11, (q[0] + 0.6 * q[2]) * 22, (q[1] - 0.6 * q[2] + 0.3 * q[0]) * 22 + 5), th];
  }
  {
    const G = 0.05, X0 = -0.425, Y0 = -0.975, Z0 = -0.175, NX = 17, NY = 39, NZ = 8, cells = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) {
      const dc = bodySDF(X0 + (i + 0.5) * G, Y0 + (j + 0.5) * G, Z0 + (k + 0.5) * G);
      // cells wholly inside need no test per point (their centre's depth stands in for the depth term)
      if (dc < G * 0.9) cells.push([X0 + i * G, Y0 + j * G, Z0 + k * G, dc < -G * 0.88 ? dc : 0]);
    }
    const NT = 24000;
    for (let k = 0, guard = 0; k < NT && guard < NT * 8; guard++) {
      const c = cells[Math.floor(R() * cells.length)], p = [c[0] + R() * G, c[1] + R() * G, c[2] + R() * G];
      const d = c[3] || bodySDF(p[0], p[1], p[2]);
      if (d > 0) continue;
      // Under max blending, tissue deeper than 0.045 adds little that shallower tissue does not (it is no brighter):
      // keep a third of it. That thins the thick trunk, so the limbs get relatively more points and every part
      // ends up with a similar number of points along a ray (smooth projection at a low fill cost).
      if (d < -0.045 && R() < 0.67) continue;
      k++;
      // deeper tissue (muscle) takes up a little more than skin and fat; the chest is darker (air in the lungs)
      const [m, th] = part(p);
      let I = 0.13 + 0.045 * K.smooth(-d / 0.03) + 0.04 * (noise(p[0] * 14, p[1] * 14, p[2] * 14) - 0.5) + 0.06 * (m - 0.5);
      if (inLung(p)) I *= 0.6;
      else if (p[1] > -0.12 && p[1] < 0.2 && Math.abs(p[0]) < 0.12) I += 0.015;
      resp = tissueResp(m);
      // thin parts (forearms, hands, feet) have fewer points along each ray: larger sprites keep them as smooth as the trunk
      put(p, I, UP.tissue, 0.021 * clamp(Math.sqrt(0.09 / th), 0.9, 1.4));
      // a soft glow just under the skin, so the outline fades like a real scan rather than ending in dots
      if (d > -0.008 && R() < 0.5) put(p, 0.05 * jit(0.05), UP.tissue, 0.03);
    }
    resp = RESP.none;
  }

  // ------------------------------------------------------------ skeleton --
  const BONE = 0.22, LONG = 0.26, MARROW = 0.26, bs = 0.013;   // LONG: the long bones of the limbs read as faint lines
  const bone = (I, j) => () => I * jit(j || 0.08);
  // spine: vertebral bodies with discs between them (marrow lights them up), and spinous processes behind
  const spine = curve([[0, 0.63, -0.026], [0, 0.55, -0.026], [0, 0.48, -0.046], [0, 0.38, -0.066], [0, 0.27, -0.066],
    [0, 0.18, -0.052], [0, 0.08, -0.034], [0, 0.0, -0.04]]);
  for (let v = 0; v < 24; v++) {
    const s = (v + 0.5) / 24, c = spine.at(s), r = 0.011 + 0.012 * s;
    ellFill(c, [r * 1.15, 0.0085 + 0.006 * s, r], 34 + Math.round(30 * s), bone(MARROW), UP.bone, bs);
    ellFill(v3.add(c, [0, -0.004, -0.03 - 0.008 * s]), [0.005, 0.006, 0.014], 8, bone(BONE), UP.bone, bs);
  }
  // sacrum and pelvis (iliac wings as curved plates, pubic and ischial rami)
  tubeFill([[0, -0.01, -0.05], [0, -0.06, -0.072], [0, -0.11, -0.082], [0, -0.135, -0.07]], s => 0.03 * (1 - s) + 0.008, 260,
    bone(MARROW), UP.bone, bs);
  for (const s of SIDES) {
    const c = [0.072 * s, -0.012, -0.02];
    for (let k = 0, g = 0; k < 420 && g < 4000; g++) {
      const u = K.unit(R);
      if (u[1] < -0.15 || u[0] * s < -0.25 || u[2] > 0.75) continue;
      const p = v3.add(c, [u[0] * 0.07, u[1] * 0.07, u[2] * 0.055]);
      put(p, (p[1] > 0.035 ? MARROW + 0.03 : MARROW) * jit(0.15), UP.bone, bs);
      k++;
    }
    tubeFill([[0.02 * s, -0.095, 0.055], [0.06 * s, -0.09, 0.035], [0.088 * s, -0.068, 0.006]], 0.008, 70, bone(BONE), UP.bone, bs);
    tubeFill([[0.025 * s, -0.11, 0.045], [0.06 * s, -0.13, 0.0], [0.09 * s, -0.08, -0.01]], 0.009, 70, bone(BONE), UP.bone, bs);
  }
  // ribs: 12 pairs curving forward and down from the spine; the upper seven reach the sternum
  for (let i = 0; i < 12; i++) {
    const yb = 0.488 - i * 0.0245, f = Math.min(1, (i + 1) / 8);
    const W = 0.07 + 0.075 * Math.sin(f * PI / 2) - (i > 8 ? 0.012 * (i - 8) : 0);
    const D = 0.07 + 0.03 * f, tmax = i < 7 ? 0.9 : i < 10 ? 0.82 - 0.04 * (i - 7) : 0.5 - 0.1 * (i - 10);
    for (const s of SIDES) {
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const th = 0.12 + (tmax * PI - 0.12) * k / 8;
        pts.push([s * (0.018 + W * Math.sin(th)), yb - 0.085 * (th / PI) - 0.02 * Math.sin(th), 0.004 - D * Math.cos(th)]);
      }
      tubeFill(pts, 0.0045, 140, bone(BONE + 0.02, 0.08), UP.bone, bs);
    }
  }
  tubeFill([[0, 0.475, 0.092], [0, 0.4, 0.103], [0, 0.31, 0.104]], 0.011, 160, bone(MARROW), UP.bone, bs);   // sternum
  for (const s of SIDES) {
    // clavicle
    tubeFill([[0.016 * s, 0.488, 0.075], [0.09 * s, 0.505, 0.058], [0.16 * s, 0.52, -0.002]], 0.0065, 80, bone(BONE), UP.bone, bs);
    // scapula: a thin triangle on the back, turned up with the raised arm
    const A = [0.055 * s, 0.45, -0.095], B = [0.155 * s, 0.505, -0.06], C = [0.125 * s, 0.32, -0.088];
    for (let k = 0; k < 200; k++) {
      let a = R(), b = R();
      if (a + b > 1) { a = 1 - a; b = 1 - b; }
      put(v3.add(A, v3.add(v3.mul(v3.sub(B, A), a), v3.mul(v3.sub(C, A), b))), BONE * 0.9 * jit(0.15), UP.bone, bs);
    }
    // arm: humerus, radius and ulna, and the bones of the hand fanning out to the fingers
    const sh = mir(J.shoulder, s), el = mir(J.elbow, s), wr = wrists[s], tp = tips[s];
    ellFill(sh, [0.02, 0.02, 0.02], 40, bone(MARROW), UP.bone, bs);
    tubeFill([sh, el], 0.0095, 210, bone(LONG), UP.bone, bs);
    const fw = frame(v3.sub(wr, el));
    for (const o of [-0.008, 0.008]) {
      tubeFill([v3.add(el, v3.mul(fw[2], o)), v3.add(wr, v3.mul(fw[2], o * 1.4))], 0.0055, 90, bone(BONE), UP.bone, bs);
    }
    const fh = frame(v3.sub(tp, wr));
    for (let f = 0; f < 5; f++) {
      const o = (f - 2) * 0.016, a = v3.add(wr, v3.mul(fh[2], o * 0.4));
      const b = v3.add(tp, v3.add(v3.mul(fh[2], o), v3.mul(fh[0], f === 2 ? 0.012 : -Math.abs(f - 2) * 0.01)));
      tubeFill([a, b], 0.0035, 28, bone(BONE), UP.bone, 0.012);
    }
    // leg: femoral head and neck, femur, knee, patella, tibia, fibula, foot
    const hp = mir(J.hip, s), kn = mir(J.knee, s), an = mir(J.ankle, s);
    ellFill(v3.add(hp, [0.002 * s, 0.002, 0]), [0.022, 0.022, 0.022], 50, bone(MARROW), UP.bone, bs);
    tubeFill([hp, [0.135 * s, -0.09, -0.004], [0.13 * s, -0.12, 0.0]], 0.012, 70, bone(MARROW), UP.bone, bs);
    tubeFill([[0.13 * s, -0.11, 0.0], [0.115 * s, -0.3, 0.008], kn], 0.011, 360, bone(LONG), UP.bone, bs);
    // the knee joint: a soft glow (the joint takes up a little more than the shafts), not a cluster of beads
    ellFill(v3.add(kn, [0, 0.002, -0.004]), [0.038, 0.024, 0.032], 110, soft(() => 0.27 * jit(0.06), 0.4), UP.bone, 0.018);
    ellFill(v3.add(kn, [0, 0.008, 0.045]), [0.016, 0.02, 0.008], 30, bone(BONE + 0.04), UP.bone, bs);
    tubeFill([v3.add(kn, [0, -0.02, 0.0]), v3.add(an, [0, 0.01, 0.004])], s2 => 0.013 - 0.004 * s2, 320, bone(LONG), UP.bone, bs);
    tubeFill([v3.add(kn, [0.032 * s, -0.03, -0.018]), v3.add(an, [0.024 * s, 0.0, -0.01])], 0.0055, 110, bone(BONE * 0.95), UP.bone,
      bs);
    ellFill(v3.add(an, [0, -0.02, -0.004]), [0.022, 0.016, 0.026], 50, bone(BONE + 0.04), UP.bone, bs);
    const hl = mir(J.heel, s), to = mir(J.toe, s);
    for (let f = 0; f < 5; f++) {
      const a = v3.add(hl, [0.004 * s * (f - 2), 0.012, 0.03]), b = v3.add(to, [0.011 * s * (f - 2), 0.002, -0.004 * Math.abs(f - 2)]);
      tubeFill([a, b], 0.004, 30, bone(BONE), UP.bone, 0.012);
    }
  }
  // skull (faint behind the bright brain) and jaw
  ellFill([0, 0.722, -0.004], [0.074, 0.105, 0.094], 450, (p, q) => (q > 0.88 ? 0.24 * jit(0.15) : 0), UP.bone, bs);
  tubeFill([[-0.055, 0.66, -0.01], [-0.045, 0.6, 0.04], [0, 0.585, 0.075], [0.045, 0.6, 0.04], [0.055, 0.66, -0.01]], 0.006, 140,
    bone(0.26), UP.bone, bs);

  // -------------------------------------------------------------- organs --
  const os = 0.021;
  // brain: grey matter (cortex, deep nuclei) brightest of all; cerebellum just below
  ellFill([0, 0.738, -0.008], [0.066, 0.06, 0.084], 1500, soft((p, q) => {
    const folds = noise(p[0] * 70, p[1] * 70, p[2] * 70);
    if (q > 0.72) return 1.0 + 0.12 * folds;
    return Math.hypot(Math.abs(p[0]) - 0.02, p[1] - 0.728, p[2] + 0.004) < 0.02 ? 0.95 : 0.62 + 0.1 * folds;
  }, 0.4), UP.brain, 0.02);
  ellFill([0, 0.668, -0.058], [0.05, 0.027, 0.032], 260, soft(() => 0.8, 0.3), UP.brain, 0.02);
  // glands and muscles of the head and neck: eyes' muscles, tonsils, salivary glands, larynx, thyroid
  for (const s of SIDES) {
    ellFill([0.03 * s, 0.705, 0.072], [0.011, 0.009, 0.012], 24, soft(() => 0.42, 0.5), UP.gland, 0.014);
    ellFill([0.017 * s, 0.618, 0.02], [0.01, 0.012, 0.01], 30, soft(() => 0.62, 0.5), UP.gland, 0.014);
    ellFill([0.06 * s, 0.645, -0.002], [0.012, 0.024, 0.018], 40, soft(() => 0.38, 0.5), UP.gland, 0.014);
    ellFill([0.035 * s, 0.6, 0.03], [0.011, 0.01, 0.011], 24, soft(() => 0.45, 0.5), UP.gland, 0.014);
    ellFill([0.017 * s, 0.548, 0.042], [0.009, 0.019, 0.009], 40, soft(() => 0.42, 0.5), UP.gland, 0.014);
  }
  ellFill([0, 0.57, 0.04], [0.012, 0.012, 0.01], 24, soft(() => 0.48, 0.5), UP.gland, 0.014);
  // heart: the left ventricle's thick wall burns white-hot, the right ventricle less; blood in the chambers flashes early
  const lvAxes = frame([0.646, -0.57, 0.494]), rvAxes = frame([0.5, -0.6, 0.62]);
  resp = RESP.heart;
  ellFill([0.042, 0.293, 0.052], [0.062, 0.041, 0.041], 750, soft((p, q) => (q > 0.6 ? 1.05 : 0.3), 0.4), UP.heart, os, lvAxes);
  ellFill([-0.004, 0.285, 0.074], [0.05, 0.036, 0.022], 260, (p, q) => (q > 0.72 ? 0.55 : 0), UP.heart, os, rvAxes);
  resp = RESP.none;
  ellFill([0.042, 0.293, 0.052], [0.04, 0.024, 0.024], 220, () => 0.26, [0.08, 0.14], os, lvAxes, 0.85, 0.08);
  ellFill([-0.004, 0.285, 0.074], [0.04, 0.028, 0.016], 160, () => 0.24, [0.05, 0.1], os, rvAxes, 0.95, 0.04);
  ellFill([-0.036, 0.315, 0.03], [0.026, 0.03, 0.024], 140, () => 0.22, [0.04, 0.1], os, null, 0.95, 0.03);   // right atrium
  ellFill([0.018, 0.335, -0.002], [0.026, 0.022, 0.02], 120, () => 0.22, [0.08, 0.14], os, null, 0.8, 0.075);   // left atrium
  // lungs: little uptake, but the blood passes through them early
  for (const L of lungs) ellFill(L, [L[3], L[4], L[5]], 480, () => 0.05, [0.06, 0.12], 0.022, null, 0.36, 0.055);
  // liver: a big wedge under the right diaphragm, medium (orange); spleen beside the stomach
  const liverI = p => 0.44 + 0.08 * (noise(p[0] * 30, p[1] * 30, p[2] * 30) - 0.5);
  ellFill([-0.082, 0.205, 0.012], [0.082, 0.088, 0.085], 1050, (p, q, a) => (a[1] < -0.55 + 0.5 * a[0] ? 0 : liverI(p)), UP.liver,
    0.022, null, 0.22, 0.12);
  ellFill([0.005, 0.232, 0.035], [0.075, 0.042, 0.055], 430, (p, q, a) => (a[1] < -0.3 - 0.5 * a[0] ? 0 : liverI(p)), UP.liver,
    0.022, null, 0.22, 0.12);
  const n40 = p => noise(p[0] * 40, p[1] * 40, p[2] * 40);
  ellFill([0.12, 0.2, -0.056], [0.03, 0.056, 0.03], 300, soft(p => 0.46 + 0.04 * n40(p), 0.15), UP.spleen, os, along([0.35, 1, -0.2]));
  // stomach (with the gullet) and pancreas
  tubeFill([[0.004, 0.56, 0.0], [0.006, 0.42, -0.035], [0.02, 0.33, -0.03], [0.055, 0.29, -0.005]], 0.006, 140, () => 0.3 * jit(0.1),
    UP.gut, 0.016);
  tubeFill([[0.06, 0.29, -0.004], [0.104, 0.24, 0.02], [0.1, 0.17, 0.05], [0.05, 0.13, 0.07], [0.0, 0.142, 0.062],
    [-0.026, 0.162, 0.046]], s => 0.034 - 0.018 * s, 460, (s, p) => 0.27 + 0.06 * n40(p), UP.gut, os);
  tubeFill([[-0.036, 0.116, 0.02], [0.02, 0.135, -0.006], [0.07, 0.15, -0.026], [0.106, 0.166, -0.04]], s => 0.016 - 0.006 * s, 240,
    (s, p) => 0.3 + 0.06 * n40(p), UP.liver, os);
  // kidneys (bright cortex, white-hot collecting system as the tracer is cleared into the urine), ureters, bladder
  resp = RESP.urine;
  for (const s of SIDES) {
    const c = [0.072 * s, s > 0 ? 0.115 : 0.098, -0.066], ax = along([-0.24 * s, 1, 0.12]);
    ellFill(c, [0.026, 0.052, 0.022], 400, soft(p => 0.72 + 0.18 * noise(p[0] * 110, p[1] * 110, p[2] * 110), 0.3), UP.kidney, os, ax,
      0.3, 0.12);
    // calyces collecting the urine, and the renal pelvis
    for (let k = 0; k < 5; k++) {
      const u = (k - 2) / 2.2, cc = v3.add(c, [(-0.004 - 0.006 * (1 - u * u)) * s, u * 0.034, 0.003]);
      ellFill(cc, [0.007, 0.007, 0.006], 26, () => 0.98, UP.pelvis, 0.014);
    }
    ellFill(v3.add(c, [-0.016 * s, -0.004, 0.003]), [0.007, 0.012, 0.006], 40, () => 1.0, UP.pelvis, 0.015);
    const ureter = [[0.06 * s, c[1] - 0.008, -0.058], [0.05 * s, 0.03, -0.046], [0.056 * s, -0.04, -0.03], [0.046 * s, -0.094, 0.0],
      [0.024 * s, -0.11, 0.03]];
    // urine moves down the ureters in waves (peristalsis), so they show in segments
    tubeFill(ureter, 0.0045, 170, u => 0.82 * (0.45 + 0.55 * Math.pow(Math.sin(u * 9 + s), 2)), UP.ureter, 0.015);
  }
  ellFill([0, -0.112, 0.045], [0.048, 0.036, 0.04], 400, soft(() => 1.0, 0.4), UP.bladder, 0.022);
  resp = RESP.none;
  // bowel: small intestine coiled in the middle, the colon framing it; uptake patchy
  {
    const pts = [], r = rng(5);
    let p = [0, 0.03, 0.03], dir = [1, 0, 0];
    for (let k = 0; k < 46; k++) {
      dir = v3.norm(v3.add(v3.mul(dir, 0.55), v3.add(K.unit(r), v3.mul(v3.sub([0, 0.02, 0.035], p), 6))));
      p = v3.add(p, v3.mul(dir, 0.026));
      pts.push([clamp(p[0], -0.085, 0.085), clamp(p[1], -0.05, 0.1), clamp(p[2], -0.02, 0.08)]);
    }
    tubeFill(pts, 0.011, 1050, (s, q) => 0.22 + 0.14 * Math.pow(noise(q[0] * 30, q[1] * 30, q[2] * 30), 2), UP.gut, 0.018);
    const colon = [[-0.104, -0.065, 0.024], [-0.11, 0.04, 0.004], [-0.098, 0.13, 0.02], [-0.03, 0.104, 0.074],
      [0.04, 0.104, 0.074], [0.11, 0.152, 0.004], [0.116, 0.05, -0.012], [0.104, -0.04, 0.004], [0.06, -0.085, 0.034],
      [0.0, -0.08, -0.03], [0.0, -0.13, -0.064]];
    tubeFill(colon, 0.019, 820, (s, q) => 0.24 + 0.5 * Math.pow(noise(q[0] * 18 + 3, q[1] * 18, q[2] * 18), 3), UP.gut, 0.02);
  }

  // ------------------------------------------------------- blood vessels --
  // the tracer is injected into a vein of the right arm, passes the right heart and the lungs, then the arteries
  const BLOOD = 0.23, vs = 0.014;
  // the tracer shows in a vessel once the bolus arrives (a bright flash), then settles to the blood level
  const flow = (pts, rad, n, arrive, amp) => {
    const c = curve(pts);
    for (let k = 0; k < n; k++) {
      const s = R(), p = v3.add(c.at(s), v3.mul(K.unit(R), rad * Math.cbrt(R()))), arr = Math.min(0.62, arrive(s, c.len));
      put(p, BLOOD * jit(0.1), [arr, arr + 0.06], vs, amp, arr);
    }
    return c.len;
  };
  const vessel = (pts, rad, n, a0, amp, speed) => flow(pts, rad, n, (s, len) => a0 + s * len * speed, amp);
  const vein = (pts, rad, n, a0, a1) => flow(pts, rad, n, s => a0 + (a1 - a0) * s, 1.0);
  const INJ = [-0.21, 0.83, 0.03];   // the injection site, in a vein of the right forearm
  vein([INJ, mir(J.elbow, -1), [-0.24, 0.62, 0.01], [-0.17, 0.48, 0.0], [-0.08, 0.465, 0.03], [-0.026, 0.42, 0.024],
    [-0.034, 0.33, 0.03]], 0.006, 600, 0.0, 0.045);
  vein([[-0.026, -0.02, -0.02], [-0.024, 0.15, -0.02], [-0.03, 0.29, 0.02]], 0.008, 160, 0.28, 0.32);
  const sp = 0.22;
  const aorta = [[0.03, 0.31, 0.04], [0.015, 0.4, 0.035], [0.0, 0.43, 0.0], [0.016, 0.4, -0.04], [0.016, 0.25, -0.04],
    [0.01, 0.1, -0.022], [0.0, -0.01, -0.016]];
  const aLen = vessel(aorta, 0.009, 420, 0.09, 0.9, sp);
  for (const s of SIDES) {
    const kn = mir(J.knee, s), an = mir(J.ankle, s), el = mir(J.elbow, s), sh = mir(J.shoulder, s);
    // leg, neck and arm arteries
    vessel([[0.004 * s, -0.01, -0.016], [0.045 * s, -0.07, 0.01], [0.08 * s, -0.12, 0.04], [0.088 * s, -0.3, 0.02],
      v3.add(kn, [0, 0, -0.03]), v3.add(an, [0, 0.03, -0.005]), mir(J.toe, s)], 0.005, 520, 0.09 + aLen * sp, 0.75, sp);
    vessel([[0.008 * s, 0.43, 0.0], [0.025 * s, 0.55, 0.022], [0.03 * s, 0.66, 0.0], [0.03 * s, 0.72, -0.02]], 0.0042, 120,
      0.11, 0.8, sp);
    vessel([[0.01 * s, 0.43, 0.0], [0.09 * s, 0.48, 0.0], v3.add(sh, [0, 0.01, 0.01]), v3.add(el, [-0.012 * s, -0.01, 0.012]),
      v3.add(wrists[s], [0, -0.006, 0])], 0.0042, 380, 0.11, 0.75, sp);
    vessel([[0.01 * s, 0.11, -0.022], [0.06 * s, 0.1, -0.05]], 0.004, 40, 0.13, 0.7, sp);   // renal arteries
  }
  const NB = N;

  // ----------------------------------------------- the scan, as a MIP --
  // Each point glows in the hot-iron map; blending keeps the maximum (not the sum) of what lies along each ray,
  // which is exactly how PET scans are shown as maximum-intensity projections.
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P.slice(0, 3 * NB), 3));
  geo.setAttribute('aI', new THREE.BufferAttribute(AI.slice(0, NB), 1));
  geo.setAttribute('aU', new THREE.BufferAttribute(AU.slice(0, 2 * NB), 2));
  geo.setAttribute('aB', new THREE.BufferAttribute(AB.slice(0, 2 * NB), 2));
  geo.setAttribute('aSz', new THREE.BufferAttribute(AS.slice(0, NB), 1));
  geo.setAttribute('aK', new THREE.BufferAttribute(AK.slice(0, 3 * NB), 3));
  const scanMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime, uP: { value: 1 }, uS: { value: 0 }, uK: { value: 1 },
      uDim: { value: 1 } },
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    vertexShader: K.GLSL + `
attribute float aI, aSz; attribute vec2 aU, aB; attribute vec3 aK;
uniform float uA, uP, uS;
varying float vI, vSoft;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // steady uptake rises over the tissue's window (soft tissue shows faintly from the start); in disease some
  // organs take up less and tissue more; blood glows as the bolus passes, then settles
  float up = max(smoothstep(aU.x, aU.y, uP), aK.x * smoothstep(0.0, 0.05, uP));
  float I = (aI * (1.0 + aK.y * uS) + aK.z * uS) * up
    + aB.x * smoothstep(aB.y, aB.y + 0.04, uP) * (1.0 - smoothstep(aB.y + 0.06, aB.y + 0.38, uP));
  vI = I;
  // Fill rate: sprites are sized in local units, so up close (as in a headset) they would grow into huge
  // overlapping discs. Below 1.6 units they shrink with distance (down to half their size), and never
  // exceed about 1.4 degrees on screen.
  float sc = length(modelViewMatrix[0].xyz), dl = -mv.z / sc;
  gl_PointSize = min(pointPx(aSz * clamp(dl / 1.6, 0.5, 1.0), mv), 0.025 * uPx * projectionMatrix[1][1] / sc);
  // big sprites (seen up close) get a soft, peaked footprint, so they merge into a mottled glow, not discs
  vSoft = smoothstep(7.0, 15.0, gl_PointSize);
  if (I < 0.01 || uA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA, uK, uDim;
varying float vI, vSoft;
// hot iron: black, dark red, red, orange, yellow, white
// (each channel rises with intensity, so the max blend stays on the map)
vec3 hot(float x) {
  return vec3(pow(clamp(x * 2.0, 0.0, 1.0), 0.9), pow(clamp((x - 0.15) / 0.8, 0.0, 1.0), 1.5),
    clamp((x - 0.76) * 4.2, 0.0, 1.0) * 0.95);
}
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  // small sprites: a flat top and a soft edge, so overlapping points of similar intensity merge into smooth
  // regions; big ones (up close) fade from the middle, so they read as soft grains rather than flat discs
  float f = 1.0 - smoothstep(mix(0.45, 0.15, vSoft), 1.0, d);
  vec3 c = hot(vI * f * uK) * uA * uDim;
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
}`,
  });
  set.mats.push(scanMat);
  const scan = new THREE.Points(geo, scanMat);
  scan.frustumCulled = false;
  set.group.add(scan);

  // ------------------------------------------------------ organ network --
  // Each organ's node rises out of the organ (a thin tether stays) onto a cage around the body near the organ's
  // side and height, so all 12 stay apart and readable from any side; bands wind around the body between them.
  // Angles, heights and radii come from a search (tools/body_cage.cjs) that projects the label boxes from the
  // story's usual views (front half, both sides, back) so no label covers another or another node.
  // [key, label, organ position, angle around the body (degrees, 0 = front, +90 = the person's left),
  //  cage height, cage radius]
  const ORG = [
    ['brain', 'Brain', [0, 0.745, 0.0], 0, 0.8, 0.3], ['thyroid', 'Thyroid', [0, 0.548, 0.045], -36, 0.68, 0.42],
    ['lungs', 'Lungs', [-0.09, 0.375, -0.005], -60, 0.43, 0.42], ['heart', 'Heart', [0.045, 0.29, 0.06], 38, 0.55, 0.34],
    ['liver', 'Liver', [-0.085, 0.215, 0.025], -60, 0.34, 0.46], ['stomach', 'Stomach', [0.085, 0.2, 0.05], 110, 0.26, 0.4],
    ['spleen', 'Spleen', [0.12, 0.2, -0.056], 120, -0.08, 0.46], ['pancreas', 'Pancreas', [0.03, 0.14, -0.008], -10, 0.2, 0.46],
    ['kidneys', 'Kidneys', [-0.072, 0.098, -0.066], -129, -0.07, 0.46],
    ['intestine', 'Intestine', [-0.01, 0.02, 0.05], -39, -0.09, 0.46],
    ['marrow', 'Bone marrow', [0.09, -0.005, -0.045], 99, -0.42, 0.45], ['bladder', 'Bladder', [0, -0.112, 0.045], 2, -0.38, 0.46],
  ];
  const NO = ORG.length, oi = {};
  const cageAt = (th, y, r) => [r * Math.sin(th), y, r * Math.cos(th)];
  const CAGE = ORG.map(o => cageAt(o[3] * PI / 180, o[4], o[5]));
  ORG.forEach((o, i) => { oi[o[0]] = i; o[2][0] *= XS; });
  // links: [a, b, healthy strength, disease strength]
  // (illustrative, after slide 35: the disease network is sparser and rewired)
  const LINKS = [
    ['thyroid', 'heart', 0.85, 0], ['heart', 'lungs', 0.6, 0.25], ['thyroid', 'brain', 0.4, 0], ['brain', 'heart', 0.45, 0],
    ['liver', 'pancreas', 0.95, 0], ['stomach', 'pancreas', 0.55, 0], ['kidneys', 'intestine', 0.8, 0], ['kidneys', 'liver', 0.55, 0],
    ['thyroid', 'pancreas', 0.5, 0], ['heart', 'liver', 0.5, 0], ['marrow', 'spleen', 0.4, 0.75], ['kidneys', 'bladder', 0.7, 0.35],
    ['stomach', 'intestine', 0.5, 0], ['pancreas', 'marrow', 0.3, 0],
    ['pancreas', 'intestine', 0, 1.0], ['brain', 'marrow', 0, 0.5], ['spleen', 'kidneys', 0, 0.3], ['kidneys', 'marrow', 0, 0.65],
    ['liver', 'lungs', 0, 0.4],
  ].map(([a, b, h, d]) => [oi[a], oi[b], h, d]);
  // bands: glowing tubes that wind around the body (angle, height and radius interpolated, bulging outwards),
  // built with unit radius; the shader scales them by the link's strength in the current state
  const SEG = 40, RAD = 8, vpb = (SEG + 1) * (RAD + 1), NL = LINKS.length;
  const bp = new Float32Array(NL * vpb * 3), bc = new Float32Array(NL * vpb * 3), bn = new Float32Array(NL * vpb * 3);
  const bS = new Float32Array(NL * vpb), bE = new Float32Array(NL * vpb * 4), bIdx = [];
  LINKS.forEach(([a, b, h, d], e) => {
    const A = ORG[a], B = ORG[b], ta = A[3] * PI / 180;
    let dt = (B[3] - A[3]) * PI / 180;
    if (dt > PI) dt -= 2 * PI;
    if (dt < -PI) dt += 2 * PI;
    const bulge = 0.03 + 0.06 * Math.abs(dt) / PI + 0.08 * Math.abs(B[4] - A[4]);
    const at = u => cageAt(ta + dt * u, K.lerp(A[4], B[4], u), K.lerp(A[5], B[5], u) + bulge * Math.sin(PI * u));
    const seed = R();
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG, c = at(u), F = frame(v3.sub(at(Math.min(1, u + 0.01)), at(Math.max(0, u - 0.01))));
      for (let j = 0; j <= RAD; j++) {
        const th = j / RAD * 2 * PI, k = e * vpb + i * (RAD + 1) + j;
        const n = v3.add(v3.mul(F[1], Math.cos(th)), v3.mul(F[2], Math.sin(th)));
        bp.set(v3.add(c, n), 3 * k); bc.set(c, 3 * k); bn.set(n, 3 * k);
        bS[k] = u; bE.set([h, d, e / NL, seed], 4 * k);
      }
    }
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) {
      const k = e * vpb + i * (RAD + 1) + j;
      bIdx.push(k, k + RAD + 1, k + 1, k + 1, k + RAD + 1, k + RAD + 2);
    }
  });
  const bgeo = new THREE.BufferGeometry();
  bgeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  bgeo.setAttribute('aC', new THREE.BufferAttribute(bc, 3));
  bgeo.setAttribute('normal', new THREE.BufferAttribute(bn, 3));
  bgeo.setAttribute('aS', new THREE.BufferAttribute(bS, 1));
  bgeo.setAttribute('aE', new THREE.BufferAttribute(bE, 4));
  bgeo.setIndex(bIdx);
  const bandMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uNet: { value: 0 }, uState: { value: 0 } },
    // premultiplied additive (One, One): the fragment's brightness is exactly its alpha times its colour
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    vertexShader: `
attribute vec3 aC; attribute float aS; attribute vec4 aE;
uniform float uNet, uState, uTime;
varying float vS, vG, vW, vK, w; varying vec3 vN, vV, vCol;
void main() {
  w = mix(aE.x, aE.y, uState);
  // links that exist in only one state draw on (or retract) along their length as the state changes
  float ext = aE.x > 0.0 && aE.y > 0.0 ? 1.0
    : aE.x > 0.0 ? 1.0 - smoothstep(0.0, 0.85, uState) : smoothstep(0.15, 1.0, uState);
  vG = min(clamp((uNet - 0.42) * 2.7 - aE.z * 0.55, 0.0, 1.0), ext);
  vW = smoothstep(0.0, 0.12, w);
  float r = (0.0014 + 0.0105 * w * w) * vW;
  vec3 p = aC + (position - aC) * r;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz;
  vS = aS;
  // bright pulses travel along each band
  vK = pow(0.5 + 0.5 * cos(6.2832 * (aS * 2.0 - uTime * 0.3 + aE.w)), 12.0);
  vCol = mix(vec3(1.0, 0.95, 0.88), vec3(1.0, 0.7, 0.36), aE.x == 0.0 ? 0.75 * uState : 0.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `
uniform float uA;
varying float vS, vG, vW, vK, w; varying vec3 vN, vV, vCol;
void main() {
  if (vS > vG || vW < 0.01) discard;
  float f = abs(dot(normalize(vN), normalize(vV)));
  // bright along the axis, faint at the silhouette (a glowing tube); pulses, strength and the drawing front scale it
  float a = (0.06 + 0.42 * pow(f, 1.5)) * (0.75 + 0.9 * vK) * (0.5 + 0.5 * w) * vW * smoothstep(vG, vG - 0.03, vS) * uA;
  gl_FragColor = vec4(vCol * a, a);
}`,
  });
  set.mats.push(bandMat);
  const bands = new THREE.Mesh(bgeo, bandMat);
  bands.renderOrder = 2; bands.frustumCulled = false;
  set.group.add(bands);
  // nodes: a warm halo and a white-hot core per organ; tethers back to the organ
  const ng = K.pointsGeo(NO * 2);
  for (let i = 0; i < NO; i++) {
    ng.attributes.aCol.array.set([1, 0.5, 0.16], 6 * i);
    ng.attributes.aCol.array.set([1, 0.97, 0.9], 6 * i + 3);
  }
  const nodes = new THREE.Points(ng, K.points(set));
  nodes.renderOrder = 3; nodes.frustumCulled = false;
  set.group.add(nodes);
  const tg = K.linesGeo(NO);
  for (let i = 0; i < NO; i++) {
    tg.attributes.aCol.array.set([1, 0.62, 0.3, 1, 0.85, 0.65], 6 * i);
    tg.attributes.aA.array.set([0.25, 0.5], 2 * i);
  }
  const tethers = new THREE.LineSegments(tg, K.lines(set));
  tethers.renderOrder = 2; tethers.frustumCulled = false;
  set.group.add(tethers);
  // weighted degree of each organ in each state (node size)
  const deg = ORG.map(() => [0, 0]);
  for (const [a, b, h, d] of LINKS) { deg[a][0] += h; deg[b][0] += h; deg[a][1] += d; deg[b][1] += d; }
  // where node i is when the network is at net (the anchors follow it)
  const lift = (i, net) => K.prog(net, 0.02 * i, 0.2 + 0.02 * i);
  const nodePos = (i, net) => v3.lerp(ORG[i][2], CAGE[i], lift(i, net));
  let netNow = 0;

  // ------------------------------------------------------------- update --
  const sizeA = ng.attributes.aSize, alphaA = ng.attributes.aA, posA = ng.attributes.position;
  const tpos = tg.attributes.position, ta = tg.attributes.aA;
  function update(S, t) {
    const net = clamp(S.body_net, 0, 1), st = clamp(S.body_state, 0, 1), sn = K.smooth(net);
    netNow = net;
    scanMat.uniforms.uP.value = clamp(S.body_pet, 0, 1);
    scanMat.uniforms.uS.value = K.smooth(st);
    // the scan cools and dims to a ghost while the network is up
    scanMat.uniforms.uK.value = 1 - 0.42 * sn;
    scanMat.uniforms.uDim.value = (1 - 0.25 * sn) * (1 - clamp(S.body_blank || 0, 0, 1));
    bandMat.uniforms.uNet.value = net; bandMat.uniforms.uState.value = st;
    const on = net > 0.001;
    bands.visible = on; nodes.visible = on; tethers.visible = on;
    if (!on) return;
    for (let i = 0; i < NO; i++) {
      const pop = K.prog(net, 0.02 * i, 0.08 + 0.02 * i), w = K.lerp(deg[i][0], deg[i][1], st), p = nodePos(i, net);
      const beat = 1 + 0.07 * Math.sin(t * 2.2 + i * 1.7);
      posA.array.set(p, 6 * i); posA.array.set(p, 6 * i + 3);
      sizeA.array[2 * i] = (0.06 + 0.035 * Math.sqrt(w)) * pop * beat;
      sizeA.array[2 * i + 1] = (0.02 + 0.01 * Math.sqrt(w)) * pop;
      alphaA.array[2 * i] = 0.4 * (0.45 + 0.55 * Math.min(1, w)) * pop;
      alphaA.array[2 * i + 1] = (0.6 + 0.4 * Math.min(1, w)) * pop;
      tpos.array.set(ORG[i][2], 6 * i); tpos.array.set(p, 6 * i + 3);
      ta.array[2 * i] = 0.3 * pop; ta.array[2 * i + 1] = 0.55 * pop;
    }
    posA.needsUpdate = true; sizeA.needsUpdate = true; alphaA.needsUpdate = true; tpos.needsUpdate = true; ta.needsUpdate = true;
  }

  // ------------------------------------------------------------ exports --
  // organ anchors sit on the organ during the scan and follow the node once the network is up
  // injection: where the tracer goes in (right forearm); aorta: its arch above the heart (arteries light up from here)
  const anchors = { head: [0, 0.745, 0.04], feet: [0, -0.93, 0.05], injection: [INJ[0] * XS, INJ[1], INJ[2]], aorta: [0, 0.43, 0] };
  ORG.forEach((o, i) => { anchors[o[0]] = () => nodePos(i, netNow); });
  const labels = ORG.map(o => ({ text: [o[1], ''], at: o[0], cls: '', alpha: S => K.prog(S.body_net, 0.5, 0.8) }));
  return Object.assign(set, {
    params: { body_a: 1, body_pet: 1, body_net: 0, body_state: 0, body_blank: 0 },
    update,
    anchors,
    labels,
    organs: ORG.map(o => ({ key: o[0], name: o[1] })),
    // the cage with its labels is about 1.3 units wide: netTall frames it on a portrait screen (phone)
    cam: { default: [0, 4, 3.75, 0, 0, 0], front: [0, 4, 3.75, 0, 0, 0], side: [90, 4, 3.75, 0, 0, 0],
      net: [14, 6, 3.0, 0, 0.17, 0], netTall: [14, 6, 5.8, 0.1, 0.17, 0] },
    controls: [
      { key: 'view', label: 'View', options: [['scan', 'Scan'], ['net', 'Network']] },
      { key: 'state', label: 'State', options: [['healthy', 'Healthy'], ['disease', 'Disease']] },
      { key: 'tracer', label: 'Tracer', options: [['up', 'Taken up'], ['live', 'Arriving']] },
    ],
    // Arriving loops every 12 s: 7 s of arrival, a hold on the steady scan, then the scan blanks out while the
    // tracer clock rewinds (the engine eases the jump back, which would otherwise play the arrival backwards)
    explore(c) {
      const u = (c.t || 0) % 12, live = c.tracer === 'live';
      return {
        body_pet: live ? clamp((u - 1) / 7, 0, 1) : 1, body_blank: live && (u < 1 || u > 11.2) ? 1 : 0,
        body_net: c.view === 'net' ? 1 : 0, body_state: c.state === 'disease' ? 1 : 0,
      };
    },
  });
};
