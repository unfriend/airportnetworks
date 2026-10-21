// Organs, uptake and the network of the cohort (Geist et al., Med 2025). Drawn in the frame of the tour's PET body
// set (feet at y -0.95, faces +z, the person's left +x, its figure slimmed across by 0.9), so the two show together.
// A scan plane sweeps down and outlines 13 organs and the aorta as smooth shells (signed distance fields fitted to
// where the body set puts each organ, polygonised once by surface nets); each organ's uptake as a glowing bar; the
// bars collapse into one person's row and 658 rows stack into a slab; 658 stand-in people show what a partial
// correlation is; the organs' nodes rise onto a shallow dome in front of the body and the paper's networks draw on
// (blue positive, red negative, hubs orange-yellow), with the strength distribution and its exponential fit beside.
SETS.organs = function (K) {
  const { THREE, smooth, clamp, lerp, prog, v3 } = K;
  const set = K.newSet('organs');
  const D = PET_DATA, ORG = D.organs, NO = ORG.length, PI = Math.PI;
  const OI = {}; ORG.forEach((o, i) => { OI[o.id] = i; });
  const COL = ORG.map(o => K.rgb(o.col)), HUBC = K.rgb('#ffb020'), POSC = K.rgb('#4c7cff'), NEGC = K.rgb('#ff4d4d');
  const XS = 0.9;   // the body set models its figure a little broad, then slims x by 0.9: the shells do the same
  const AORTA = OI.aorta === undefined ? -1 : OI.aorta;
  const num = (x, d) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d === undefined ? 2 : d);
  const own = f => { const o = [0, 0, 0]; return () => f(o); };
  const set3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };

  // ================================================================ organ shells: signed distance fields
  // Everything here is in the body set's modelling coordinates (before x is slimmed); the vertices are slimmed after.
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  // an orthonormal frame whose first axis points along d (as the body set builds its organs' axes)
  function frame(d) {
    const u = v3.norm(d), ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const w = v3.norm(v3.cross(u, ref)), v = v3.cross(w, u);
    return [u, v, w];
  }
  const along = d => { const f = frame(d); return [f[1], f[0], f[2]]; };
  // an ellipsoid: centre c, radii r along axes ax (or x, y, z); a close bound of its distance (Quilez's)
  function ell(c, r, ax) {
    const r0 = r[0], r1 = r[1], r2 = r[2], mr = Math.min(r0, r1, r2);
    return (x, y, z) => {
      let a = x - c[0], b = y - c[1], d = z - c[2];
      if (ax) { const p = a, q = b, s = d; a = p * ax[0][0] + q * ax[0][1] + s * ax[0][2]; b = p * ax[1][0] + q * ax[1][1] + s * ax[1][2]; d = p * ax[2][0] + q * ax[2][1] + s * ax[2][2]; }
      const u = a / r0, v = b / r1, w = d / r2, k0 = Math.sqrt(u * u + v * v + w * w);
      const u1 = u / r0, v1 = v / r1, w1 = w / r2, k1 = Math.sqrt(u1 * u1 + v1 * v1 + w1 * w1);
      return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -mr;
    };
  }
  // a tapered capsule from a to b (radii ra, rb), as in the body set
  const mkCone = (a, b, ra, rb) => { const d = v3.sub(b, a); return [a[0], a[1], a[2], d[0], d[1], d[2], 1 / (v3.dot(d, d) || 1e-9), ra, rb]; };
  function cone(x, y, z, c) {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    let h = (px * c[3] + py * c[4] + pz * c[5]) * c[6];
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = px - c[3] * h, dy = py - c[4] * h, dz = pz - c[5] * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (c[7] + (c[8] - c[7]) * h);
  }
  // a smooth curve through points (centripetal, by arc length, as the body set's tubes), n + 1 samples
  const curvePts = (pts, n) => {
    const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal'), out = [];
    for (let i = 0; i <= n; i++) { const q = c.getPointAt(i / n); out.push([q.x, q.y, q.z]); }
    return out;
  };
  const chain = (pts, rad, out) => {
    for (let i = 0; i < pts.length - 1; i++) out.push(mkCone(pts[i], pts[i + 1], rad(i / (pts.length - 1)), rad((i + 1) / (pts.length - 1))));
    return out;
  };
  // many capsules joined smoothly; binned, so a point only meets the ones near it
  function capsules(list, k) {
    const B = 0.03, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], box = [];
    for (const c of list) {
      const m = Math.max(c[7], c[8]) + k + 0.02, a = [c[0], c[1], c[2]], b = [c[0] + c[3], c[1] + c[4], c[2] + c[5]];
      const l = [0, 1, 2].map(i => Math.min(a[i], b[i]) - m), h = [0, 1, 2].map(i => Math.max(a[i], b[i]) + m);
      box.push([l, h]);
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], l[i]); hi[i] = Math.max(hi[i], h[i]); }
    }
    const n = [0, 1, 2].map(i => Math.max(1, Math.ceil((hi[i] - lo[i]) / B))), bins = new Array(n[0] * n[1] * n[2]);
    box.forEach(([l, h], ci) => {
      const a = [0, 1, 2].map(i => Math.floor((l[i] - lo[i]) / B)), b = [0, 1, 2].map(i => Math.min(n[i] - 1, Math.floor((h[i] - lo[i]) / B)));
      for (let i = a[0]; i <= b[0]; i++) for (let j = a[1]; j <= b[1]; j++) for (let q = a[2]; q <= b[2]; q++) (bins[(i * n[1] + j) * n[2] + q] = bins[(i * n[1] + j) * n[2] + q] || []).push(ci);
    });
    return (x, y, z) => {
      const i = Math.floor((x - lo[0]) / B), j = Math.floor((y - lo[1]) / B), q = Math.floor((z - lo[2]) / B);
      if (i < 0 || j < 0 || q < 0 || i >= n[0] || j >= n[1] || q >= n[2]) return 0.03;
      const L = bins[(i * n[1] + j) * n[2] + q];
      if (!L) return 0.03;
      let d = 0.03;
      for (let s = 0; s < L.length; s++) d = smin(d, cone(x, y, z, list[L[s]]), k);
      return d;
    };
  }
  // the body set's trunk and thighs (to keep muscle and fat under the skin)
  const RINGS = [[-0.135, 0.145, 0.092, -0.012], [-0.08, 0.158, 0.104, -0.012], [-0.01, 0.160, 0.102, -0.002], [0.08, 0.142, 0.097, 0.008],
    [0.18, 0.140, 0.100, 0.010], [0.30, 0.153, 0.108, 0.006], [0.40, 0.160, 0.104, 0.0], [0.47, 0.150, 0.088, -0.010], [0.53, 0.090, 0.060, -0.016]];
  const fade3 = x => x * x * (3 - 2 * x);
  function ring(y) {   // the trunk's half width, half depth and middle at height y
    const T = RINGS, yy = clamp(y, T[0][0], T[T.length - 1][0]);
    let i = 0;
    while (i < T.length - 2 && yy > T[i + 1][0]) i++;
    const f = fade3((yy - T[i][0]) / (T[i + 1][0] - T[i][0]));
    return [T[i][1] + (T[i + 1][1] - T[i][1]) * f, T[i][2] + (T[i + 1][2] - T[i][2]) * f, T[i][3] + (T[i + 1][3] - T[i][3]) * f];
  }
  function torso(x, y, z) {
    const T = RINGS, y0 = T[0][0], y1 = T[T.length - 1][0], [w, d, zc] = ring(y);
    const q = Math.sqrt((x / w) * (x / w) + ((z - zc) / d) * ((z - zc) / d)), e = (q - 1) * Math.min(w, d);
    const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
    return dy > 0 ? Math.hypot(Math.max(e, 0), dy) : e;
  }
  const HIP = [0.086, -0.07, 0.0], KNEE = [0.094, -0.47, 0.012];
  const THIGH = [1, -1].map(s => mkCone([HIP[0] * s, HIP[1], HIP[2]], [KNEE[0] * s, KNEE[1], KNEE[2]], 0.084, 0.049));
  const lower = (x, y, z) => smin(smin(torso(x, y, z), cone(x, y, z, THIGH[0]), 0.06), cone(x, y, z, THIGH[1]), 0.06);
  // the spine as the body set draws it; L1 to L5 are its vertebrae 20 to 24 (of 24, C1 to L5)
  const SPINE = new THREE.CatmullRomCurve3([[0, 0.63, -0.026], [0, 0.55, -0.026], [0, 0.48, -0.046], [0, 0.38, -0.066], [0, 0.27, -0.066],
    [0, 0.18, -0.052], [0, 0.08, -0.034], [0, 0.0, -0.04]].map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const LUMBAR = [19, 20, 21, 22, 23].map(v => { const s = (v + 0.5) / 24, c = SPINE.getPointAt(s); return { c: [c.x, c.y, c.z], r: 0.011 + 0.012 * s, h: 0.0085 + 0.006 * s }; });
  const KID = s => ({ c: [0.072 * s, s > 0 ? 0.115 : 0.098, -0.066], ax: along([-0.24 * s, 1, 0.12]) });
  const IN = 0.004, inf = r => r.map(x => x + IN);   // shells sit a few millimetres outside each organ's glow
  const LV = { c: [0.042, 0.293, 0.052], r: [0.062, 0.041, 0.041], ax: frame([0.646, -0.57, 0.494]) };
  const RV = { c: [-0.004, 0.285, 0.074], r: [0.05, 0.036, 0.022], ax: frame([0.5, -0.6, 0.62]) };
  const LUNG = [[-0.088, 0.365, -0.01, 0.068, 0.135, 0.088], [0.09, 0.375, -0.016, 0.058, 0.125, 0.083]];
  const LIV = [{ c: [-0.082, 0.205, 0.012], r: [0.082, 0.088, 0.085], g: 0.5, o: -0.55 }, { c: [0.005, 0.232, 0.035], r: [0.075, 0.042, 0.055], g: -0.5, o: -0.3 }];
  const SPL = { c: [0.12, 0.2, -0.056], r: [0.03, 0.056, 0.03], ax: along([0.35, 1, -0.2]) };
  const PANC = [[-0.036, 0.116, 0.02], [0.02, 0.135, -0.006], [0.07, 0.15, -0.026], [0.106, 0.166, -0.04]];
  const GLUT = s => ({ c: [0.078 * s, -0.112, -0.066], r: [0.062, 0.084, 0.04], ax: along([-0.3 * s, 1, 0.15]) });
  // Each shape: a list of [field, box low, box high, grid step] (several boxes for paired organs)
  const SHAPES = {
    brain: () => {
      const a = ell([0, 0.738, -0.008], inf([0.066, 0.06, 0.084])), b = ell([0, 0.668, -0.058], inf([0.05, 0.027, 0.032]));
      // the cerebellum below, and the cleft between the hemispheres on top
      return [[(x, y, z) => smin(a(x, y, z), b(x, y, z), 0.02) + 0.008 * Math.exp(-x * x / 0.00005) * smooth((y - 0.69) / 0.07), [-0.085, 0.62, -0.105], [0.085, 0.815, 0.095], 0.0045]];
    },
    thyroid: () => {
      const L = ell([-0.017, 0.548, 0.042], [0.011, 0.021, 0.011]), R = ell([0.017, 0.548, 0.042], [0.011, 0.021, 0.011]);
      const I = mkCone([-0.014, 0.538, 0.05], [0.014, 0.538, 0.05], 0.006, 0.006);   // the isthmus in front of the windpipe
      return [[(x, y, z) => smin(Math.min(L(x, y, z), R(x, y, z)), cone(x, y, z, I), 0.008), [-0.037, 0.517, 0.022], [0.037, 0.578, 0.066], 0.0022]];
    },
    lungs: () => {
      const hrt = ell(LV.c, LV.r.map(x => x + 0.012), LV.ax), L = LUNG.map(l => ell([l[0], l[1], l[2]], inf([l[3], l[4], l[5]])));
      // the heart makes its notch in the left lung
      return [[(x, y, z) => smax(Math.min(L[0](x, y, z), L[1](x, y, z)), -hrt(x, y, z), 0.02), [-0.172, 0.215, -0.112], [0.162, 0.515, 0.09], 0.0055]];
    },
    heart: () => {
      const lv = ell(LV.c, inf(LV.r), LV.ax), rv = ell(RV.c, inf(RV.r), RV.ax);
      const ra = ell([-0.036, 0.315, 0.03], inf([0.026, 0.03, 0.024])), la = ell([0.018, 0.335, -0.002], inf([0.026, 0.022, 0.02]));
      return [[(x, y, z) => smin(smin(lv(x, y, z), rv(x, y, z), 0.015), smin(ra(x, y, z), la(x, y, z), 0.012), 0.016), [-0.078, 0.212, -0.035], [0.12, 0.372, 0.13], 0.0045]];
    },
    liver: () => {
      // the body set keeps a[1] >= o + g a[0] (a: the point in the ellipsoid's unit coordinates): a plane cut on each lobe
      const P = LIV.map(l => {
        const r = inf(l.r), E = ell(l.c, r), gx = l.g / l.r[0], gy = -1 / l.r[1], gl = Math.hypot(gx, gy);
        return (x, y, z) => smax(E(x, y, z), (l.o + gx * (x - l.c[0]) + gy * (y - l.c[1])) / gl - IN, 0.012);
      });
      return [[(x, y, z) => smin(P[0](x, y, z), P[1](x, y, z), 0.025), [-0.178, 0.104, -0.086], [0.092, 0.306, 0.108], 0.0055]];
    },
    spleen: () => [[ell(SPL.c, inf(SPL.r), SPL.ax), [0.058, 0.128, -0.122], [0.182, 0.272, 0.012], 0.004]],
    pancreas: () => {
      const f = capsules(chain(curvePts(PANC, 14), s => 0.016 - 0.006 * s + 0.003, []), 0.006);
      return [[f, [-0.065, 0.084, -0.07], [0.132, 0.196, 0.052], 0.004]];
    },
    kidneys: () => [1, -1].map(s => {
      const { c, ax } = KID(s), k = ell(c, inf([0.026, 0.052, 0.022]), ax), hc = [c[0] - 0.03 * s, c[1] - 0.004, c[2] + 0.004];
      // the hilum: the dent on the inner side where the vessels and the ureter leave
      return [(x, y, z) => smax(k(x, y, z), 0.013 - Math.sqrt((x - hc[0]) * (x - hc[0]) + (y - hc[1]) * (y - hc[1]) + (z - hc[2]) * (z - hc[2])), 0.008),
        [c[0] - 0.05, c[1] - 0.075, c[2] - 0.045], [c[0] + 0.05, c[1] + 0.075, c[2] + 0.045], 0.004];
    }),
    adrenal: () => [1, -1].map(s => {
      const { c, ax } = KID(s), k = ell(c, [0.028, 0.054, 0.024], ax), top = v3.add(c, v3.mul(ax[1], 0.054));
      const cc = v3.add(top, [-0.006 * s, 0.004, 0.002]), a = ell(cc, [0.016, 0.011, 0.012], ax);
      return [(x, y, z) => smax(a(x, y, z), -k(x, y, z), 0.004), v3.sub(cc, [0.03, 0.03, 0.03]), v3.add(cc, [0.03, 0.03, 0.03]), 0.0022];   // a cap on the kidney
    }),
    intestine: () => {
      // the small intestine coiled exactly as the body set draws it (the same seeded walk), the colon framing it
      const pts = [], r = K.rng(5);
      let p = [0, 0.03, 0.03], dir = [1, 0, 0];
      for (let k = 0; k < 46; k++) {
        dir = v3.norm(v3.add(v3.mul(dir, 0.55), v3.add(K.unit(r), v3.mul(v3.sub([0, 0.02, 0.035], p), 6))));
        p = v3.add(p, v3.mul(dir, 0.026));
        pts.push([clamp(p[0], -0.085, 0.085), clamp(p[1], -0.05, 0.1), clamp(p[2], -0.02, 0.08)]);
      }
      const colon = [[-0.104, -0.065, 0.024], [-0.11, 0.04, 0.004], [-0.098, 0.13, 0.02], [-0.03, 0.104, 0.074], [0.04, 0.104, 0.074],
        [0.11, 0.152, 0.004], [0.116, 0.05, -0.012], [0.104, -0.04, 0.004], [0.06, -0.085, 0.034], [0.0, -0.08, -0.03], [0.0, -0.13, -0.064]];
      const segs = chain(curvePts(pts, 150), () => 0.0128, []);
      chain(curvePts(colon, 56), () => 0.0215, segs);
      return [[capsules(segs, 0.008), [-0.146, -0.162, -0.096], [0.146, 0.186, 0.112], 0.005]];
    },
    muscle: () => {
      const g = [1, -1].map(s => { const q = GLUT(s); return ell(q.c, q.r, q.ax); });
      return [[(x, y, z) => smax(Math.min(g[0](x, y, z), g[1](x, y, z)), lower(x, y, z) + 0.007, 0.012), [-0.168, -0.232, -0.13], [0.168, 0.0, 0.0], 0.005]];
    },
    marrow: () => {
      // the vertebral bodies L1 to L5 as rounded drums, with the discs between them left as waists
      const f = (x, y, z) => {
        let d = 1;
        for (const v of LUMBAR) {
          const rx = v.r * 1.15 + 0.002, rz = v.r + 0.002, a = (x - v.c[0]) / rx, b = (z - v.c[2]) / rz;
          const dr = (Math.sqrt(a * a + b * b) - 1) * rz, dy = Math.abs(y - v.c[1]) - v.h - 0.001, rr = 0.003;
          d = Math.min(d, Math.min(Math.max(dr + rr, dy + rr), 0) + Math.hypot(Math.max(dr + rr, 0), Math.max(dy + rr, 0)) - rr);
        }
        return d;
      };
      const ys = LUMBAR.map(v => v.c[1]), zs = LUMBAR.map(v => v.c[2]);
      return [[f, [-0.04, Math.min(...ys) - 0.03, Math.min(...zs) - 0.035], [0.04, Math.max(...ys) + 0.03, Math.max(...zs) + 0.035], 0.0025]];
    },
    fat: () => {
      // a band just under the skin of the belly, flanks and back, between L1 and L5
      const ys = LUMBAR.map(v => v.c[1]), yc = (Math.min(...ys) + Math.max(...ys)) / 2, hy = (Math.max(...ys) - Math.min(...ys)) / 2 + 0.014;
      return [[(x, y, z) => smax(Math.abs(torso(x, y, z) + 0.0105) - 0.0055, Math.abs(y - yc) - hy, 0.008), [-0.182, yc - hy - 0.022, -0.125], [0.182, yc + hy + 0.022, 0.13], 0.0045]];
    },
    aorta: () => {
      // from the heart up over the arch and down the back to where it splits into the two iliac arteries
      const segs = chain(curvePts([[0.03, 0.31, 0.04], [0.015, 0.4, 0.035], [0.0, 0.43, 0.0], [0.016, 0.4, -0.04], [0.016, 0.25, -0.04],
        [0.01, 0.1, -0.022], [0.0, -0.01, -0.016]], 44), s => 0.0118 - 0.0025 * s, []);
      for (const s of [1, -1]) chain(curvePts([[0.0, -0.004, -0.016], [0.022 * s, -0.04, -0.004], [0.045 * s, -0.07, 0.01]], 6), () => 0.0072, segs);
      return [[capsules(segs, 0.006), [-0.066, -0.09, -0.068], [0.066, 0.456, 0.066], 0.004]];
    },
  };
  // picking: rough ellipsoids per organ [centre, radii, axes] (modelling coordinates)
  const PICKS = {
    brain: [[[0, 0.73, -0.01], [0.07, 0.07, 0.09]]], thyroid: [[[0, 0.548, 0.045], [0.034, 0.024, 0.016]]],
    lungs: LUNG.map(l => [[l[0], l[1], l[2]], [l[3], l[4], l[5]]]), heart: [[LV.c, LV.r, LV.ax], [RV.c, RV.r, RV.ax]],
    liver: LIV.map(l => [l.c, l.r]), spleen: [[SPL.c, SPL.r, SPL.ax]], pancreas: [[[0.035, 0.14, -0.01], [0.085, 0.02, 0.02], frame([0.142, 0.05, -0.06])]],
    kidneys: [1, -1].map(s => [KID(s).c, [0.028, 0.054, 0.024], KID(s).ax]), adrenal: [1, -1].map(s => [v3.add(KID(s).c, v3.mul(KID(s).ax[1], 0.058)), [0.018, 0.013, 0.014]]),
    intestine: [[[0, 0.01, 0.03], [0.12, 0.13, 0.07]]], muscle: [1, -1].map(s => [GLUT(s).c, GLUT(s).r, GLUT(s).ax]),
    marrow: [[[0, 0.055, -0.04], [0.03, 0.065, 0.03]]], fat: [[[0, 0.055, 0.003], [0.162, 0.07, 0.106]]], aorta: [[[0.01, 0.2, -0.03], [0.022, 0.22, 0.03]]],
  };

  // ---------------------------------------------------------------- surface nets
  // Sample the field on a grid (blocks of 4 cells far from the surface are filled from their centre alone), place one
  // vertex per cell the surface crosses, pull it onto the surface along the field's gradient, which is its normal.
  const SP = [], SN = [], SCL = [], SO = [], SI = [];
  const YR = ORG.map(() => [Infinity, -Infinity]);   // each shell's height range (for the sweep's labels)
  const EG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  function polygonise(f, lo, hi, h, oi) {
    const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
    const F = new Float32Array(nx * ny * nz), done = new Uint8Array(nx * ny * nz), id = (i, j, k) => (i * ny + j) * nz + k;
    const B = 4, far = 1.6 * 0.87 * B * h;
    for (let I = 0; I < nx - 1; I += B) for (let J = 0; J < ny - 1; J += B) for (let L = 0; L < nz - 1; L += B) {
      const i1 = Math.min(I + B, nx - 1), j1 = Math.min(J + B, ny - 1), k1 = Math.min(L + B, nz - 1);
      const fc = f(lo[0] + (I + i1) * 0.5 * h, lo[1] + (J + j1) * 0.5 * h, lo[2] + (L + k1) * 0.5 * h), out = Math.abs(fc) > far;
      for (let i = I; i <= i1; i++) for (let j = J; j <= j1; j++) for (let k = L; k <= k1; k++) {
        const q = id(i, j, k);
        if (done[q]) continue;
        if (out) F[q] = fc; else { F[q] = f(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h); done[q] = 1; }
      }
    }
    const ny1 = ny - 1, nz1 = nz - 1, VI = new Int32Array((nx - 1) * ny1 * nz1).fill(-1), cid = (i, j, k) => (i * ny1 + j) * nz1 + k;
    const cv = new Float32Array(8), col = COL[oi], e = h * 0.3, yr = YR[oi];
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny1; j++) for (let k = 0; k < nz1; k++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) { cv[c] = F[id(i + (c & 1), j + (c >> 1 & 1), k + (c >> 2 & 1))]; if (cv[c] < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, ne = 0;
      for (const [a, b] of EG) {
        if ((cv[a] < 0) === (cv[b] < 0)) continue;
        const t = cv[a] / (cv[a] - cv[b]);
        sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; ne++;
      }
      const x = lo[0] + (i + sx / ne) * h, y = lo[1] + (j + sy / ne) * h, z = lo[2] + (k + sz / ne) * h;
      const d = f(x, y, z), gx = (f(x + e, y, z) - d) / e, gy = (f(x, y + e, z) - d) / e, gz = (f(x, y, z + e) - d) / e;
      const g2 = gx * gx + gy * gy + gz * gz || 1, s = clamp(d / g2, -h, h);
      const px = x - gx * s, py = y - gy * s, pz = z - gz * s, nX = gx / XS, nl = Math.sqrt(nX * nX + gy * gy + gz * gz) || 1;
      VI[cid(i, j, k)] = SP.length / 3;
      SP.push(px * XS, py, pz); SN.push(nX / nl, gy / nl, gz / nl); SCL.push(col[0], col[1], col[2]); SO.push(oi);
      if (py < yr[0]) yr[0] = py;
      if (py > yr[1]) yr[1] = py;
    }
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) SI.push(a, c, b, a, d, c); else SI.push(a, b, c, a, c, d); };
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny1; j++) for (let k = 0; k < nz1; k++) {
      const v0 = F[id(i, j, k)] < 0;
      if (j > 0 && k > 0 && v0 !== F[id(i + 1, j, k)] < 0) quad(VI[cid(i, j - 1, k - 1)], VI[cid(i, j, k - 1)], VI[cid(i, j, k)], VI[cid(i, j - 1, k)], !v0);
      if (i > 0 && k > 0 && v0 !== F[id(i, j + 1, k)] < 0) quad(VI[cid(i - 1, j, k - 1)], VI[cid(i - 1, j, k)], VI[cid(i, j, k)], VI[cid(i, j, k - 1)], !v0);
      if (i > 0 && j > 0 && v0 !== F[id(i, j, k + 1)] < 0) quad(VI[cid(i - 1, j - 1, k)], VI[cid(i, j - 1, k)], VI[cid(i, j, k)], VI[cid(i - 1, j, k)], !v0);
    }
  }
  const T0 = performance.now();
  ORG.forEach((o, oi) => { if (SHAPES[o.id]) for (const [f, lo, hi, h] of SHAPES[o.id]()) polygonise(f, lo, hi, h, oi); });
  const shellMs = performance.now() - T0;

  // ---------------------------------------------------------------- the shells
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SP), 3));
  shellGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(SN), 3));
  shellGeo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(SCL), 3));
  shellGeo.setAttribute('aOrg', new THREE.BufferAttribute(new Float32Array(SO), 1));
  shellGeo.setIndex(SI);
  shellGeo.computeBoundingSphere();
  const shellMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPlane: { value: 10 }, uCut: { value: 0 }, uK: { value: 1 }, uFoc: { value: new Array(NO).fill(0) }, uDim: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aCol; attribute float aOrg;
uniform float uFoc[${NO}]; uniform float uDim;
varying vec3 vN, vW, vC; varying float vY, vK, vF;
void main() {
  float f = uFoc[int(aOrg + 0.5)];
  vF = f; vK = (1.0 + 1.6 * f) * (1.0 - 0.82 * uDim * (1.0 - f));
  vC = aCol; vY = position.y;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `
uniform float uA, uPlane, uCut, uK;
varying vec3 vN, vW, vC; varying float vY, vK, vF;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float ndv = dot(n, v); if (ndv < 0.0) { n = -n; ndv = -ndv; }
  float fr = pow(1.0 - ndv, 2.0);
  // scanned: everything above the plane (a focused organ always shows)
  float shown = max(smoothstep(uPlane - 0.002, uPlane + 0.012, vY), vF);
  float fresh = exp(-max(vY - uPlane, 0.0) / 0.05) * uCut * shown;
  float cut = (1.0 - smoothstep(0.0012, 0.0045, abs(vY - uPlane))) * uCut;
  float band = pow(abs(fract(vY * 70.0) * 2.0 - 1.0), 10.0);   // slices, as a segmentation mask is drawn
  float lit = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.4, 0.75, 0.55))), 0.0);
  vec3 col = vC * (0.3 + 1.3 * fr) * lit + vC * band * 0.35 + mix(vC, vec3(1.0), 0.4) * fresh * 0.5;
  float a = (0.07 + 0.5 * fr + 0.05 * band) * shown * vK * uK;
  gl_FragColor = vec4(col * a + mix(vC, vec3(1.0), 0.5) * cut * 1.4, uA);
}`,
  });
  set.mats.push(shellMat);
  const shells = new THREE.Mesh(shellGeo, shellMat);
  shells.renderOrder = 1;
  set.group.add(shells);

  // ---------------------------------------------------------------- the scan plane (segmentation)
  // a horizontal sheet that sweeps down from the head to the thighs; on it the body's outline at that height
  const PLW = 0.86, PLD = 0.54;
  const planeMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 0 }, uE: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) }, uC: { value: new THREE.Color(...K.rgb('#46d9ff')) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
uniform float uA, uK; uniform vec4 uE[6]; uniform vec3 uC;
varying vec2 vP;
void main() {
  vec2 g = abs(fract(vP / 0.03) - 0.5);
  float grid = 1.0 - smoothstep(0.03, 0.07, min(g.x, g.y));
  vec2 e = vec2(${(PLW / 2).toFixed(3)}, ${(PLD / 2).toFixed(3)}) - abs(vP);
  float m = min(e.x, e.y), edge = 1.0 - smoothstep(0.0, 0.006, m), fall = smoothstep(0.0, 0.12, m);
  float o = 0.0, inside = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 E = uE[i];
    if (E.z > 0.0) {
      vec2 q = (vP - E.xy) / E.zw; float r = length(q);
      o = max(o, 1.0 - smoothstep(0.0015, 0.0045, abs(r - 1.0) * min(E.z, E.w)));
      inside = max(inside, 1.0 - smoothstep(0.9, 1.0, r));
    }
  }
  float a = (0.03 + 0.1 * grid * (1.0 - 0.6 * inside)) * fall + 0.75 * edge + 0.9 * o + 0.08 * inside;
  vec3 col = mix(uC, vec3(1.0), 0.45 * o);
  gl_FragColor = vec4(col, a * uK * uA);
}`,
  });
  set.mats.push(planeMat);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(PLW, PLD).rotateX(-PI / 2), planeMat);
  plane.renderOrder = 2;
  set.group.add(plane);
  // the body's cross-section at height y (set frame): trunk or head, thighs, arms -> ellipses [x, z, rx, rz]
  const ARMS = [1, -1].map(s => [[[0.172 * s, 0.468, -0.012], [0.33 * s, 0.79, -0.002], 0.048, 0.037], [[0.33 * s, 0.79, -0.002], [0.108 * s, 0.902, 0.026], 0.035, 0.024]]);
  function section(y, out) {
    for (const v of out) v.set(0, 0, 0, 0);
    let n = 0;
    const put = (x, z, rx, rz) => { if (n < out.length) out[n++].set(x * XS, z, rx * XS, rz); };
    if (y >= -0.115 && y <= 0.53) { const [w, d, zc] = ring(y); put(0, zc, w, d); }
    else if (y > 0.53 && y < 0.62) put(0, -0.01, 0.05, 0.048);
    if (y >= 0.6 && y < 0.823) { const k = Math.sqrt(Math.max(0, 1 - ((y - 0.712) / 0.112) ** 2)); if (k > 0.05) put(0, 0.002, 0.077 * k, 0.097 * k); }
    if (y < -0.105 && y > -0.47) for (const s of [1, -1]) {
      const t = (y - HIP[1]) / (KNEE[1] - HIP[1]); put(lerp(HIP[0], KNEE[0], t) * s, lerp(HIP[2], KNEE[2], t), lerp(0.084, 0.049, t), lerp(0.084, 0.049, t));
    }
    for (const arm of ARMS) for (const [a, b, ra, rb] of arm) {
      if (y < Math.min(a[1], b[1]) || y > Math.max(a[1], b[1])) continue;
      const t = (y - a[1]) / (b[1] - a[1]), d = v3.norm(v3.sub(b, a)), r = lerp(ra, rb, t), cv = Math.max(Math.abs(d[1]), 0.35);
      put(lerp(a[0], b[0], t), lerp(a[2], b[2], t), r / cv, r);
    }
  }

  // ---------------------------------------------------------------- layout beside and in front of the body
  const BAR = { x0: 0.4, xb: 0.445, k: 0.15, top: 0.8, dy: 0.083, z: 0.06, r: 0.0165 };
  const F2 = D.synth.organs || (D.f2 && D.f2.organs) || [], NF = F2.length;
  const MAT = { x0: 0.47, cw: 0.06, y: 0.1, z0: 0.17, d0: 0.03, rd: 0.0016 };   // the slab: f2's columns, people going back
  const SCP = { x0: 0.46, y0: 0.24, s: 0.62, z: 0.2 };                          // the partial-correlation panel
  const CHT = { x0: 0.82, y0: -0.2, w: 0.6, h: 0.56, z: 0.3 };                   // the strength distribution
  const NETZ = 0.46, NETY = 0.27;
  const LAY = { brain: [0, 0.84], thyroid: [0.26, 0.66], lungs: [-0.3, 0.5], heart: [0.16, 0.42], liver: [-0.44, 0.25], spleen: [0.46, 0.27],
    adrenal: [-0.17, 0.2], pancreas: [0.22, 0.15], kidneys: [-0.34, 0.02], marrow: [0.04, 0.02], fat: [0.42, -0.06], intestine: [-0.12, -0.14],
    muscle: [0.18, -0.3] };
  const domeZ = (x, y) => NETZ - 0.3 * (x * x + (y - NETY) * (y - NETY));

  // organ points: the anchor (the data's home point), and for leaders the left one of a pair (nearer the bars)
  const HOME = ORG.map(o => o.pos.slice());
  const PAIRED = { lungs: 1, kidneys: 1, adrenal: 1, muscle: 1 };
  const LEAD = ORG.map((o, i) => (PAIRED[o.id] ? [Math.abs(HOME[i][0]), HOME[i][1], HOME[i][2]] : HOME[i]));
  // bars: the organs from head to toe, the aorta (the unit) last
  const BORD = ORG.map((o, i) => i).filter(i => i !== AORTA).sort((a, b) => HOME[b][1] - HOME[a][1]);
  if (AORTA >= 0) BORD.push(AORTA);
  const BRANK = new Array(NO); BORD.forEach((i, r) => { BRANK[i] = r; });
  const barY = r => (r < NO - 1 || AORTA < 0 ? BAR.top - r * BAR.dy : BAR.top - (NO - 2) * BAR.dy - 0.115);
  const F2COL = ORG.map(o => F2.indexOf(o.id));   // the organ's column in the slab, or -1
  const cellX = c => MAT.x0 + (c + 0.5) * MAT.cw;

  // ---------------------------------------------------------------- uptake bars (neon tubes)
  const barGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false).rotateZ(-PI / 2).translate(0.5, 0, 0);
  barGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(NO * 3), 3));
  barGeo.setAttribute('aK', new THREE.InstancedBufferAttribute(new Float32Array(NO), 1));
  const tubeFrag = `
uniform float uA;
varying vec3 vN, vW, vC; varying float vK, vX;
void main() {
  if (vK < 0.003) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float c = abs(dot(n, v));
  vec3 col = vC * (0.45 + 0.85 * c) + vec3(1.0) * 0.45 * pow(c, 6.0) * (0.5 + 0.5 * vX);
  gl_FragColor = vec4(col, (0.45 + 0.55 * c) * vK * uA);
}`;
  const barMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aCol; attribute float aK;
varying vec3 vN, vW, vC; varying float vK, vX;
void main() {
  vC = aCol; vK = aK; vX = position.x;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: tubeFrag,
  });
  set.mats.push(barMat);
  const bars = new THREE.InstancedMesh(barGeo, barMat, NO);
  bars.frustumCulled = false; bars.renderOrder = 3;
  set.group.add(bars);

  // ---------------------------------------------------------------- the cohort slab: 658 people x the organs of Figure 2A
  const ROWS = D.synth.rows || [], NR = ROWS.length;
  const cellGeo = new THREE.InstancedBufferGeometry();
  {
    const bx = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    cellGeo.setIndex(bx.index); cellGeo.setAttribute('position', bx.attributes.position); cellGeo.setAttribute('normal', bx.attributes.normal);
    const a = new Float32Array(NR * NF * 3);
    let n = 0;
    for (let r = 0; r < NR; r++) for (let c = 0; c < NF; c++) { a[n++] = r; a[n++] = c; a[n++] = ROWS[r][c]; }
    cellGeo.setAttribute('aI', new THREE.InstancedBufferAttribute(a, 3));
    cellGeo.instanceCount = NR * NF;
  }
  const cellMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uRow0: { value: 0 }, uRows: { value: 0 }, uK: { value: 1 } },
    transparent: true, depthWrite: true,
    vertexShader: `
attribute vec3 aI;
uniform float uRow0, uRows;
varying vec3 vC; varying float vL, vS;
vec3 hot(float x) { return clamp(vec3(x * 2.4 - 0.05, x * 2.2 - 0.85, x * 3.0 - 2.1), 0.0, 1.0); }
void main() {
  float r = aI.x, c = aI.y, val = aI.z;
  // the first row (one person) forms from the bars; the others stack behind it, front to back
  float app = r < 0.5 ? uRow0 : clamp((uRows - (0.36 + 0.56 * r / ${Math.max(1, NR - 1)}.0)) / 0.06, 0.0, 1.0);
  app = app * app * (3.0 - 2.0 * app);
  vS = app;
  float h = (0.005 + 0.042 * val / 2.8) * (r < 0.5 ? 1.25 : 1.0);
  float d = r < 0.5 ? ${MAT.d0.toFixed(4)} : ${(MAT.rd * 0.92).toFixed(5)};
  float z = r < 0.5 ? ${MAT.z0.toFixed(4)} : ${(MAT.z0 - MAT.d0 / 2 - 0.006).toFixed(4)} - (r - 0.5) * ${MAT.rd.toFixed(5)};
  vec3 p = vec3(${MAT.x0.toFixed(4)} + (c + 0.5) * ${MAT.cw.toFixed(4)}, ${MAT.y.toFixed(4)} + (1.0 - app) * 0.07, z) + position * vec3(${(MAT.cw * 0.84).toFixed(4)}, h * app, d);
  vC = max(hot(clamp(val / 2.6, 0.0, 1.0)), vec3(0.16, 0.02, 0.03)) * (r < 0.5 ? 1.15 : 1.0);
  vL = normal.y > 0.5 ? 1.0 : normal.z > 0.5 ? 0.62 : 0.42;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: `
uniform float uA, uK;
varying vec3 vC; varying float vL, vS;
void main() { if (vS < 0.01) discard; gl_FragColor = vec4(vC * vL, vS * uA * uK); }`,
  });
  set.mats.push(cellMat);
  const cells = new THREE.Mesh(cellGeo, cellMat);
  cells.frustumCulled = false;
  set.group.add(cells);

  // ---------------------------------------------------------------- the partial-correlation explainer
  const PAIRS = (D.synth.pairs || []).slice(0, 4), NPR = PAIRS.length;
  const dotGeo = K.pointsGeo(NR);
  {
    const P = dotGeo.attributes.position.array, Cc = dotGeo.attributes.aCol.array, Sz = dotGeo.attributes.aSize.array;
    const tint = K.rgb('#d6ecff');
    const pa = [0, 1, 2, 3].map(() => new Float32Array(NR * 4));
    PAIRS.forEach((p, k) => {
      // each axis in standard units, so the fitted line's slope is the correlation itself
      const st = [0, 1, 2, 3].map(j => { let m = 0, s = 0; for (let r = 0; r < NR; r++) m += p.xy[4 * r + j]; m /= NR; for (let r = 0; r < NR; r++) s += (p.xy[4 * r + j] - m) ** 2; return [m, Math.sqrt(s / NR) || 1]; });
      for (let r = 0; r < NR; r++) for (let j = 0; j < 4; j++) pa[k][4 * r + j] = (p.xy[4 * r + j] - st[j][0]) / st[j][1];
    });
    for (let r = 0; r < NR; r++) { P[3 * r + 2] = MAT.z0 - MAT.d0 / 2 - 0.006 - (r - 0.5) * MAT.rd; P[3 * r] = r; Cc.set(tint, 3 * r); Sz[r] = 0.0115; }
    pa.forEach((a, k) => dotGeo.setAttribute('aP' + k, new THREE.BufferAttribute(a, 4)));
  }
  const dotMat = K.points(set, {
    uniforms: { uW: { value: new THREE.Vector4() }, uPart: { value: 0 }, uRise: { value: 0 }, uSX: { value: 0.7 }, uK: { value: 0 } },
    head: 'attribute vec4 aP0, aP1, aP2, aP3; uniform vec4 uW; uniform float uPart, uRise, uSX, uK;',
    vertex: `
  vec4 P = aP0 * uW.x + aP1 * uW.y + aP2 * uW.z + aP3 * uW.w;
  vec2 q = mix(P.xy, P.zw, uPart);
  vec2 uv = clamp(0.5 + q / 6.4, 0.015, 0.985);
  vec3 e = vec3(${SCP.x0.toFixed(3)} + uv.x * ${SCP.s.toFixed(3)}, ${SCP.y0.toFixed(3)} + uv.y * ${SCP.s.toFixed(3)}, ${(SCP.z + 0.012).toFixed(3)});
  float k = clamp((uRise - position.x / ${Math.max(1, NR - 1)}.0 * 0.5) / 0.5, 0.0, 1.0); k = k * k * (3.0 - 2.0 * k);
  vec3 s = vec3(uSX, ${(MAT.y + 0.04).toFixed(3)}, position.z);
  vec3 p = mix(s, e, k) + vec3(0.0, 0.16, 0.1) * sin(3.14159 * k);
  mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);
  vA *= uK * (0.2 + 0.8 * k);`,
  });
  const dots = new THREE.Points(dotGeo, dotMat);
  dots.frustumCulled = false; dots.renderOrder = 4;
  set.group.add(dots);
  // backdrops of the panel and the chart (dark glass, so what is behind does not clutter them)
  const backMat = new THREE.MeshBasicMaterial({ color: 0x050b16, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const backMat2 = backMat.clone();
  const scBack = new THREE.Mesh(new THREE.PlaneGeometry(SCP.s + 0.05, SCP.s + 0.05).translate(SCP.x0 + SCP.s / 2, SCP.y0 + SCP.s / 2, SCP.z - 0.004), backMat);
  const chBack = new THREE.Mesh(new THREE.PlaneGeometry(CHT.w + 0.08, CHT.h + 0.16).translate(CHT.x0 + CHT.w / 2, CHT.y0 + CHT.h / 2 - 0.03, CHT.z - 0.012), backMat2);
  scBack.renderOrder = chBack.renderOrder = 2;
  set.group.add(scBack, chBack);
  // the fitted line (its slope is r, then the partial r): blue positive, red negative, as the network's links
  const fitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const fitLine = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 1, 8, 1).rotateZ(-PI / 2), fitMat);
  fitLine.renderOrder = 5;
  set.group.add(fitLine);

  // ---------------------------------------------------------------- the networks
  const NET_IDS = ['full', 'FDG_healthy', 'A_low', 'A_high', 'B_low', 'B_high', 'C_low', 'C_mid', 'C_high', 'HK2', 'GLUT', 'vena'];
  const NET_SHORT = ['All scans', 'Healthy', 'BMI low', 'BMI high', 'Tumour low', 'Tumour high', 'CRP low', 'CRP mid', 'CRP high', 'HK2', 'GLUT', 'Vena cava'];
  const NN = ORG.map((o, i) => i).filter(i => LAY[ORG[i].id]);   // the organs that can be nodes (not the aorta)
  const NPOS = ORG.map(o => { const l = LAY[o.id]; return l ? [l[0], l[1], domeZ(l[0], l[1])] : null; });
  const RORD = NN.slice().sort((a, b) => HOME[b][1] - HOME[a][1]), RRANK = new Array(NO).fill(0);
  RORD.forEach((i, r) => { RRANK[i] = r; });
  const LINKS = [], LIDX = new Map();
  for (let a = 0; a < NN.length; a++) for (let b = a + 1; b < NN.length; b++) { LIDX.set(NN[a] * NO + NN[b], LINKS.length); LIDX.set(NN[b] * NO + NN[a], LINKS.length); LINKS.push([NN[a], NN[b]]); }
  const NL = LINKS.length;
  // the paper's measures (as the data generator computes them), for networks the data gives without them
  function measures(ids, edges) {
    const s = {}; ids.forEach(i => { s[i] = 0; });
    for (const [a, b, w] of edges) { if (a in s) s[a] += Math.abs(w); if (b in s) s[b] += Math.abs(w); }
    const v = ids.map(i => s[i]).sort((x, y) => y - x), N = ids.length || 1;
    let best = [Infinity, 0, 0];
    for (let b = 0; b <= 2; b += 0.002) {
      let nu = 0, de = 0;
      v.forEach((y, x) => { const e = Math.exp(-b * x); nu += y * e; de += e * e; });
      const a = nu / (de || 1), err = v.reduce((q, y, x) => q + (y - a * Math.exp(-b * x)) ** 2, 0);
      if (err < best[0]) best = [err, b, a];
    }
    const m = v.reduce((x, y) => x + y, 0) / N, sd = Math.sqrt(v.reduce((q, y) => q + (y - m) ** 2, 0) / N) || 1;
    return { density: v.reduce((x, y) => x + y, 0) / (N * (N - 1) || 1), disorder: best[1], fitA: best[2], strength: s, hubs: ids.filter(i => (s[i] - m) / sd > 1.7) };
  }
  // the disorder of each group as printed in Table 2, for networks whose own record lacks it
  const T2 = { A_low: ['BMI', 'healthy', 0], A_high: ['BMI', 'healthy', 1], B_low: ['Tumour load', '', 0], B_high: ['Tumour load', '', 1],
    C_low: ['CRP', 'thirds', 0], C_mid: ['CRP', 'thirds', 1], C_high: ['CRP', 'thirds', 2] };
  const t2dis = id => { const q = T2[id]; if (!q) return null; const r = (D.table2 || []).find(x => x.what === q[0] && x.cohort.indexOf(q[1]) >= 0); const g = r && r.groups[q[2]]; return g && typeof g.disorder === 'number' ? g.disorder : null; };
  const NETS = NET_IDS.map((id, k) => {
    const n = (D.nets || []).find(x => x.id === id) || null;
    const ids = n && n.organs && n.organs.length ? n.organs.filter(o => OI[o] !== undefined && LAY[o]) : NN.map(i => ORG[i].id);
    const edges = n ? (n.edges || []).filter(e => OI[e[0]] !== undefined && OI[e[1]] !== undefined && LIDX.has(OI[e[0]] * NO + OI[e[1]])) : [];
    const cmp = n && n.computed && n.computed.strength ? n.computed : measures(ids, edges);
    const W = new Float32Array(NL), pres = new Float32Array(NO), str = new Float32Array(NO), hub = new Float32Array(NO);
    for (const [a, b, w] of edges) W[LIDX.get(OI[a] * NO + OI[b])] = w;
    for (const o of ids) { pres[OI[o]] = 1; str[OI[o]] = (cmp.strength && cmp.strength[o]) || 0; }
    const hubs = n && n.hubs && n.hubs.length ? n.hubs : edges.length ? (cmp.hubs || []) : [];
    for (const o of hubs) if (OI[o] !== undefined) hub[OI[o]] = 1;
    // sorted strengths (for the chart) and which nodes carry a label: hubs, then the strongest, eight at most
    const order = ids.map(o => OI[o]).sort((a, b) => str[b] - str[a] || RRANK[a] - RRANK[b]), rank = new Float32Array(NO).fill(-1);
    order.forEach((i, r) => { rank[i] = r; });
    const lab = new Float32Array(NO);
    let nl = 0;
    for (const i of order) if (hub[i] && nl < 8) { lab[i] = 1; nl++; }
    for (const i of order) if (!lab[i] && nl < 7 && (str[i] > 0 || !edges.length)) { lab[i] = 1; nl++; }
    const dis = n && typeof n.disorder === 'number' ? n.disorder : t2dis(id);
    return { id, n, has: !!(n && edges.length), W, pres, str, hub, order, rank, lab, N: ids.length, A: cmp.fitA || 0, b: cmp.disorder || 0,
      title: n && n.title ? n.title.split(' (')[0] : NET_SHORT[k], size: n && n.n ? n.n : null, density: n && n.density !== undefined ? n.density : null,
      disorder: dis !== null ? num(dis) : edges.length ? '≈ ' + num(cmp.disorder || 0) : null };
  });
  const NNET = NETS.length;
  let SMAX = 2;
  for (const q of NETS) for (const i of NN) SMAX = Math.max(SMAX, q.str[i]);
  SMAX = Math.ceil(SMAX * 2) / 2;

  // links: one tube per possible pair, drawn as an arc bowing out towards you; width and weight set per frame
  const TS = 22, TR = 6;
  const linkGeo = new THREE.BufferGeometry();
  {
    const nv = NL * (TS + 1) * (TR + 1), C = new Float32Array(nv * 3), Nr = new Float32Array(nv * 3), T = new Float32Array(nv), Li = new Float32Array(nv), idx = [];
    let v = 0;
    LINKS.forEach(([a, b], l) => {
      const A = NPOS[a], Bp = NPOS[b], len = v3.dist(A, Bp), M = v3.lerp(A, Bp, 0.5), side = v3.norm([-(Bp[1] - A[1]), Bp[0] - A[0], 0]);
      const Cp = v3.add(M, v3.add([0, 0, 0.05 + 0.1 * len], v3.mul(side, 0.025 * len)));
      const v0 = v;
      for (let s = 0; s <= TS; s++) {
        const u = s / TS, w = 1 - u, p = [0, 1, 2].map(i => w * w * A[i] + 2 * u * w * Cp[i] + u * u * Bp[i]);
        const t = v3.norm([0, 1, 2].map(i => 2 * w * (Cp[i] - A[i]) + 2 * u * (Bp[i] - Cp[i])));
        let n1 = v3.cross(t, [0, 0, 1]); if (v3.len(n1) < 1e-4) n1 = [1, 0, 0]; n1 = v3.norm(n1);
        const n2 = v3.norm(v3.cross(t, n1));
        for (let q = 0; q <= TR; q++) {
          const th = q / TR * 2 * PI, d = v3.add(v3.mul(n1, Math.cos(th)), v3.mul(n2, Math.sin(th)));
          C.set(p, 3 * v); Nr.set(d, 3 * v); T[v] = u; Li[v] = l; v++;
        }
      }
      for (let s = 0; s < TS; s++) for (let q = 0; q < TR; q++) {
        const a0 = v0 + s * (TR + 1) + q, b0 = a0 + TR + 1;
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
    });
    linkGeo.setAttribute('position', new THREE.BufferAttribute(C, 3));
    linkGeo.setAttribute('aNrm', new THREE.BufferAttribute(Nr, 3));
    linkGeo.setAttribute('aT', new THREE.BufferAttribute(T, 1));
    linkGeo.setAttribute('aL', new THREE.BufferAttribute(Li, 1));
    linkGeo.setIndex(idx);
  }
  const UL = Array.from({ length: NL }, () => new THREE.Vector4());
  const linkMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uL: { value: UL }, uPos: { value: new THREE.Color(...POSC) }, uNeg: { value: new THREE.Color(...NEGC) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aNrm; attribute float aT, aL;
uniform vec4 uL[${NL}];
varying vec3 vN, vW; varying float vS, vB;
void main() {
  vec4 L = uL[int(aL + 0.5)];
  float w = abs(L.x), t = L.w > 0.5 ? 1.0 - aT : aT;
  // drawn on from the organ that appears first; the growing end tapers
  float on = step(t, L.y + 0.0001), tip = L.y > 0.999 ? 1.0 : smoothstep(L.y, L.y - 0.15, t);
  float r = (0.0024 + 0.0115 * w) * smoothstep(0.0, 0.04, w) * on * mix(0.3, 1.0, tip);
  vS = L.x; vB = L.z * on;
  vN = normalize(mat3(modelMatrix) * aNrm);
  vec4 wp = modelMatrix * vec4(position + aNrm * r, 1.0); vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `
uniform float uA; uniform vec3 uPos, uNeg;
varying vec3 vN, vW; varying float vS, vB;
void main() {
  if (vB < 0.003) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float c = abs(dot(n, v)), w = abs(vS);
  vec3 col = (vS > 0.0 ? uPos : uNeg) * (0.4 + 0.9 * c) + vec3(1.0) * 0.35 * pow(c, 5.0);
  gl_FragColor = vec4(col, (0.35 + 0.65 * smoothstep(0.0, 0.45, w)) * (0.4 + 0.6 * c) * vB * uA);
}`,
  });
  set.mats.push(linkMat);
  const links = new THREE.Mesh(linkGeo, linkMat);
  links.frustumCulled = false; links.renderOrder = 3;
  set.group.add(links);
  // halos round hubs (orange-yellow, pulsing) and round a focused node (its colour)
  const haloGeo = K.pointsGeo(NO), halo = new THREE.Points(haloGeo, K.points(set, {}));
  halo.frustumCulled = false; halo.renderOrder = 5;
  set.group.add(halo);

  // ---------------------------------------------------------------- the strength distribution
  const sbGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  sbGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(NO * 3), 3));
  sbGeo.setAttribute('aK', new THREE.InstancedBufferAttribute(new Float32Array(NO), 1));
  sbGeo.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(NO * 3), 3));
  const sbMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aCol, aS; attribute float aK;
varying vec3 vC, vP, vS, vNl; varying float vK;
void main() {
  vC = aCol; vK = aK; vP = position - vec3(0.0, 0.5, 0.0); vS = aS; vNl = normal;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vC, vP, vS, vNl; varying float vK;
void main() {
  if (vK < 0.003) discard;
  // an outlined bar, as in the paper's figure: a bright rim on each face, a soft glow inside
  vec3 e = (0.5 - abs(vP)) * vS + step(0.5, abs(vNl)) * 9.0;
  float m = min(min(e.x, e.y), e.z), rim = 1.0 - smoothstep(0.0018, 0.0042, m);
  float face = vNl.z > 0.5 ? 1.0 : 0.55;
  vec3 col = vC * (0.22 + 1.1 * rim) * face + vec3(1.0) * rim * 0.18;
  gl_FragColor = vec4(col, (0.3 + 0.7 * rim) * vK * uA);
}`,
  });
  set.mats.push(sbMat);
  const sbars = new THREE.InstancedMesh(sbGeo, sbMat, NO);
  sbars.frustumCulled = false; sbars.renderOrder = 3;
  set.group.add(sbars);
  // the exponential fit: a glowing ribbon in the chart's plane
  const FS = 60, fitGeo = new THREE.BufferGeometry(), FPTS = new Float32Array(2 * (FS + 1));
  {
    fitGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((FS + 1) * 6), 3));
    const ix = []; for (let i = 0; i < FS; i++) ix.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 2, 2 * i + 1, 2 * i + 3);
    fitGeo.setIndex(ix);
  }
  const curveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...K.rgb('#ffd27a')), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const fitCurve = new THREE.Mesh(fitGeo, curveMat);
  fitCurve.frustumCulled = false; fitCurve.renderOrder = 4;
  set.group.add(fitCurve);

  // ---------------------------------------------------------------- the lesion: a tumour in the right lung
  const LES = [-0.11 * XS, 0.42, 0.03];
  const lesGeo = K.pointsGeo(61);
  {
    const r = K.rng(77), P = lesGeo.attributes.position.array, C = lesGeo.attributes.aCol.array, S = lesGeo.attributes.aSize.array;
    for (let i = 0; i < 60; i++) {
      const u = K.unit(r), q = 0.011 * Math.cbrt(r());
      P.set([LES[0] + u[0] * q, LES[1] + u[1] * q * 0.9, LES[2] + u[2] * q], 3 * i);
      C.set(K.ramp([[0, [1, 1, 1]], [0.6, [1, 0.92, 0.5]], [1, [1, 0.6, 0.15]]], q / 0.011), 3 * i);
      S[i] = 0.01 + 0.008 * r();
    }
    P.set(LES, 180); C.set(K.rgb('#ff9a3c'), 180); S[60] = 0.1;
  }
  const lesMat = K.points(set, { uniforms: { uK: { value: 0 } }, head: 'uniform float uK;',
    vertex: 'vA *= uK; if (aSize > 0.05) { vA *= 0.5; gl_PointSize *= 0.92 + 0.1 * sin(uTime * 3.0); }' });
  const lesion = new THREE.Points(lesGeo, lesMat);
  lesion.renderOrder = 5;
  set.group.add(lesion);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...K.rgb('#ffb43b')), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const marker = new THREE.Mesh(K.merge([new THREE.TorusGeometry(0.042, 0.0016, 6, 56), new THREE.TorusGeometry(0.042, 0.0016, 6, 56).rotateY(PI / 2)]), ringMat);
  marker.position.set(LES[0], LES[1], LES[2]); marker.renderOrder = 5;
  set.group.add(marker);

  // ---------------------------------------------------------------- icons: bars, column heads, nodes, chart, axes
  // one point sprite each: a dark disc, a ring in the organ's colour and its line icon (hubs: filled orange-yellow)
  const IB = 0, IN0 = NO, IC = 2 * NO, IX = 3 * NO, NI = 3 * NO + 2 * Math.max(1, NPR);
  const icoGeo = K.pointsGeo(NI);
  icoGeo.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(NI * 4), 4));
  icoGeo.setAttribute('aHub', new THREE.BufferAttribute(new Float32Array(NI), 1));
  icoGeo.setAttribute('aDisc', new THREE.BufferAttribute(new Float32Array(NI).fill(1), 1));
  const ATL = PET_ICONS.atlas(THREE, 128);
  {
    const uv = icoGeo.attributes.aUV.array, col = icoGeo.attributes.aCol.array;
    const put = (k, oi) => { uv.set(ATL.uv(ORG[oi].id), 4 * k); col.set(COL[oi], 3 * k); };
    for (let i = 0; i < NO; i++) { put(IB + i, i); put(IN0 + i, i); put(IC + i, i); }
    PAIRS.forEach((p, k) => { put(IX + 2 * k, OI[p.a] || 0); put(IX + 2 * k + 1, OI[p.b] || 0); });
  }
  const icoMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime, uMap: { value: ATL.texture }, uHub: { value: new THREE.Color(...HUBC) } },
    transparent: true, depthWrite: false,
    vertexShader: K.GLSL + `
attribute vec3 aCol; attribute float aSize, aA, aHub, aDisc; attribute vec4 aUV;
uniform float uA;
varying vec3 vC; varying float vA, vHub, vDisc; varying vec4 vUV;
void main() {
  vC = aCol; vA = aA * uA; vHub = aHub; vDisc = aDisc; vUV = aUV;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform sampler2D uMap; uniform vec3 uHub;
varying vec3 vC; varying float vA, vHub, vDisc; varying vec4 vUV;
void main() {
  vec2 pc = gl_PointCoord; float d = length(pc - 0.5) * 2.0;
  if (d > 1.0) discard;
  vec2 q = (pc - 0.5) / mix(0.92, 0.68, vDisc) + 0.5;
  float ic = 0.0;
  if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) ic = texture2D(uMap, vec2(mix(vUV.x, vUV.z, q.x), mix(vUV.w, vUV.y, q.y))).a;
  float ring = (smoothstep(0.74, 0.8, d) - smoothstep(0.93, 1.0, d)) * vDisc;
  float disc = (1.0 - smoothstep(0.94, 1.0, d)) * vDisc;
  vec3 fill = mix(vec3(0.025, 0.045, 0.085), uHub, vHub);
  vec3 ink = mix(mix(vec3(0.95, 0.97, 1.0), vC, 0.3 + 0.5 * (1.0 - vDisc)), vec3(0.16, 0.08, 0.0), vHub);
  vec3 col = mix(mix(fill, ink, ic), mix(vC, vec3(1.0, 0.86, 0.5), vHub * 0.7), ring);
  gl_FragColor = vec4(col, max(disc * 0.92, max(ic, ring)) * vA);
}`,
  });
  set.mats.push(icoMat);
  const icons = new THREE.Points(icoGeo, icoMat);
  icons.frustumCulled = false; icons.renderOrder = 7;
  set.group.add(icons);

  // ---------------------------------------------------------------- lines: static (unit, panel, chart) and moving (leaders, tethers)
  // static lines carry a group per vertex (aT) whose alpha is set per frame
  const SL = [];   // [a, b, colour, alpha, group]
  const GU = 0, GS = 1, GC = 2, GM = 3;
  {
    const ux = BAR.xb + BAR.k, y0 = barY(NO - 1) - 0.05, y1 = BAR.top + 0.06;
    for (let y = y1; y > y0; y -= 0.032) SL.push([[ux, y, BAR.z], [ux, Math.max(y0, y - 0.018), BAR.z], [0.85, 0.9, 1], 0.7, GU]);
    for (let v = 0; v <= 4; v++) SL.push([[BAR.xb + v * BAR.k, barY(NO - 1) - 0.055, BAR.z], [BAR.xb + v * BAR.k, barY(NO - 1) - 0.07, BAR.z], [0.6, 0.68, 0.8], 0.6, GU]);
    SL.push([[BAR.xb, barY(NO - 1) - 0.055, BAR.z], [BAR.xb + 4.6 * BAR.k, barY(NO - 1) - 0.055, BAR.z], [0.6, 0.68, 0.8], 0.45, GU]);
    const s = SCP, z = s.z + 0.002, ink = [0.75, 0.82, 0.92];
    SL.push([[s.x0, s.y0, z], [s.x0 + s.s, s.y0, z], ink, 0.9, GS], [[s.x0, s.y0, z], [s.x0, s.y0 + s.s, z], ink, 0.9, GS]);
    SL.push([[s.x0 + s.s, s.y0, z], [s.x0 + s.s, s.y0 + s.s, z], ink, 0.25, GS], [[s.x0, s.y0 + s.s, z], [s.x0 + s.s, s.y0 + s.s, z], ink, 0.25, GS]);
    for (const g of [-2, -1, 1, 2]) {
      const u = 0.5 + g / 6.4;
      SL.push([[s.x0 + u * s.s, s.y0, z], [s.x0 + u * s.s, s.y0 + s.s, z], ink, 0.08, GS], [[s.x0, s.y0 + u * s.s, z], [s.x0 + s.s, s.y0 + u * s.s, z], ink, 0.08, GS]);
    }
    SL.push([[s.x0 + s.s / 2, s.y0, z], [s.x0 + s.s / 2, s.y0 + s.s, z], ink, 0.16, GS], [[s.x0, s.y0 + s.s / 2, z], [s.x0 + s.s, s.y0 + s.s / 2, z], ink, 0.16, GS]);
    const c = CHT, cz = c.z;
    SL.push([[c.x0 - 0.02, c.y0, cz], [c.x0 + c.w + 0.02, c.y0, cz], ink, 0.85, GC], [[c.x0 - 0.02, c.y0, cz], [c.x0 - 0.02, c.y0 + c.h, cz], ink, 0.85, GC]);
    for (let v = 1; v <= SMAX; v++) {
      const y = c.y0 + v / SMAX * c.h;
      SL.push([[c.x0 - 0.035, y, cz], [c.x0 - 0.02, y, cz], ink, 0.8, GC], [[c.x0 - 0.02, y, cz], [c.x0 + c.w + 0.02, y, cz], ink, 0.08, GC]);
    }
    // the slab's frame: its front edge and sides on the table
    const mx0 = MAT.x0, mx1 = MAT.x0 + NF * MAT.cw, zf = MAT.z0 + MAT.d0 / 2 + 0.004, zb = MAT.z0 - MAT.d0 / 2 - 0.006 - NR * MAT.rd - 0.004, my = MAT.y - 0.002, mc = [0.95, 0.6, 0.3];
    SL.push([[mx0, my, zf], [mx1, my, zf], mc, 0.5, GM], [[mx0, my, zf], [mx0, my, zb], mc, 0.35, GM], [[mx1, my, zf], [mx1, my, zb], mc, 0.35, GM], [[mx0, my, zb], [mx1, my, zb], mc, 0.2, GM]);
  }
  const slGeo = K.linesGeo(SL.length), slBase = new Float32Array(SL.length * 2), slGrp = new Uint8Array(SL.length * 2);
  SL.forEach(([a, b, c, al, g], i) => {
    slGeo.attributes.position.array.set(a, 6 * i); slGeo.attributes.position.array.set(b, 6 * i + 3);
    slGeo.attributes.aCol.array.set(c, 6 * i); slGeo.attributes.aCol.array.set(c, 6 * i + 3);
    slBase[2 * i] = slBase[2 * i + 1] = al; slGrp[2 * i] = slGrp[2 * i + 1] = g;
  });
  const sLines = new THREE.LineSegments(slGeo, K.lines(set, {}));
  sLines.frustumCulled = false; sLines.renderOrder = 4;
  set.group.add(sLines);
  // moving lines: each organ's leader to its bar (two segments: out of the body, then to the bar) and its tether to its node
  const NML = 3 * NO, mlGeo = K.linesGeo(NML);
  for (let i = 0; i < NO; i++) for (let s = 0; s < 3; s++) { mlGeo.attributes.aCol.array.set(COL[i], 6 * (3 * i + s)); mlGeo.attributes.aCol.array.set(COL[i], 6 * (3 * i + s) + 3); }
  const mLines = new THREE.LineSegments(mlGeo, K.lines(set, {}));
  mLines.frustumCulled = false; mLines.renderOrder = 4;
  set.group.add(mLines);

  // ---------------------------------------------------------------- the ghost body (harness only: organs_ghost)
  let ghost = null;
  const GHOST_S = { body_a: 1, body_pet: 1, body_net: 0, body_state: 0, body_blank: 0 };

  // ---------------------------------------------------------------- update
  const cur = { net: 0, w: 0, lo: 0, hi: 0, f: 0, plane: 10, fw: new Float32Array(NO), apiW: new Float32Array(NO), dim: 0,
    node: ORG.map(() => [0, 0, 0]), nodeA: new Float32Array(NO), nodeS: new Float32Array(NO), hubW: new Float32Array(NO), labW: new Float32Array(NO),
    pres: new Float32Array(NO), barLen: new Float32Array(NO), barA: new Float32Array(NO), pairW: [0, 0, 0, 0], fitEnd: [0, 0, 0], hub: -1,
    chartX: new Float32Array(NO), segA: new Float32Array(NO) };
  let apiFocus = 0;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _x = new THREE.Vector3(1, 0, 0);
  const lift = (i, net) => smooth((net - 0.028 * RRANK[i]) / 0.13);
  function nodeAt(i, net, o) {
    if (!NPOS[i]) return set3(o, HOME[i][0], HOME[i][1], HOME[i][2]);
    const u = lift(i, net), a = HOME[i], b = NPOS[i];
    return set3(o, lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u) + 0.12 * Math.sin(PI * u));
  }
  function update(S, t, dt) {
    const seg = clamp(S.organs_seg, 0, 1), suv = clamp(S.organs_suv, 0, 1), rows = clamp(S.organs_rows, 0, 1), net = clamp(S.organs_net, 0, 1);
    const pairP = clamp(S.organs_pair, 0, NPR), part = clamp(S.organs_partial, 0, 1), strg = clamp(S.organs_strength, 0, 1), les = clamp(S.organs_lesion, 0, 1);
    const which = clamp(S.organs_which, 0, NNET - 1), lo = Math.floor(which), hi = Math.min(NNET - 1, lo + 1), f = which - lo;
    cur.net = net; cur.w = which; cur.lo = lo; cur.hi = hi; cur.f = f;
    const netOut = 1 - prog(net, 0, 0.35);   // bars, slab and panel make way for the network

    // focus: from the param (fractional values pass from one organ to the next), or from the explore API (eased)
    const fp = clamp(S.organs_focus || 0, 0, NO), ke = 1 - Math.exp(-6 * Math.min(0.1, dt || 0));
    let dim = Math.min(fp, 1);
    for (let i = 0; i < NO; i++) {
      cur.apiW[i] += ((apiFocus === i + 1 ? 1 : 0) - cur.apiW[i]) * (dt === undefined ? 1 : ke);
      cur.fw[i] = Math.max(clamp(1 - Math.abs(fp - (i + 1)), 0, 1) * Math.min(fp, 1), cur.apiW[i]);
      dim = Math.max(dim, cur.apiW[i]);
    }
    cur.dim = dim;
    shellMat.uniforms.uFoc.value = cur.fw; shellMat.uniforms.uDim.value = dim;

    // segmentation: the plane sweeps from above the head to the thighs; shells show above it
    const sw = prog(seg, 0, 0.94), py = lerp(0.86, -0.24, sw);
    cur.plane = seg <= 0.0005 ? 10 : seg >= 0.9995 ? -10 : py;
    shellMat.uniforms.uPlane.value = cur.plane;
    const pk = prog(seg, 0, 0.04) * (1 - prog(seg, 0.9, 1));
    shellMat.uniforms.uCut.value = pk;
    shellMat.uniforms.uK.value = 1 - 0.5 * prog(net, 0, 0.5);
    plane.visible = pk > 0.003;
    if (plane.visible) { plane.position.y = py; planeMat.uniforms.uK.value = pk; section(py, planeMat.uniforms.uE.value); }
    for (let i = 0; i < NO; i++) {
      const yr = YR[i];
      cur.segA[i] = yr[0] < yr[1] && pk > 0 ? prog(py, yr[1] + 0.05, yr[1] - 0.005) * (1 - prog(py, yr[0] + 0.01, yr[0] - 0.05)) * pk : 0;
    }

    // uptake bars, then their collapse into the slab's first row
    const coll = prog(rows, 0, 0.28), barsOut = prog(rows, 0.22, 0.32);
    const ac = bars.geometry.attributes.aCol.array, ak = bars.geometry.attributes.aK.array;
    for (let i = 0; i < NO; i++) {
      const r = BRANK[i], a = prog(suv, 0.03 * r, 0.03 * r + 0.36), L = (ORG[i].suv || 0) * BAR.k * a, c = F2COL[i];
      const fw = cur.fw[i], foc = (1 + 1.3 * fw) * (1 - 0.75 * dim * (1 - fw));
      let x = BAR.xb, y = barY(r), z = BAR.z, len = Math.max(L, 1e-4), rad = BAR.r, k = suv > 0 ? Math.min(1, a * 4) : 0;
      if (c >= 0) {
        const u = coll;
        x = lerp(x, cellX(c) - MAT.cw * 0.42, u); y = lerp(y, MAT.y + 0.02, u); z = lerp(z, MAT.z0, u); len = lerp(len, MAT.cw * 0.84, u); rad = lerp(rad, 0.013, u);
        k *= 1 - barsOut;
      } else k *= 1 - coll;
      k *= netOut;
      cur.barLen[i] = L; cur.barA[i] = k;
      _p.set(x, y, z); _s.set(len, rad, rad); _m.compose(_p, _q, _s); bars.setMatrixAt(i, _m);
      ac[3 * i] = COL[i][0]; ac[3 * i + 1] = COL[i][1]; ac[3 * i + 2] = COL[i][2]; ak[i] = k * foc;
    }
    bars.instanceMatrix.needsUpdate = true; bars.geometry.attributes.aCol.needsUpdate = true; bars.geometry.attributes.aK.needsUpdate = true;
    bars.visible = suv > 0.003 && netOut > 0.003 && barsOut < 0.999;

    // the slab
    const pairIn = clamp(pairP, 0, 1);
    cellMat.uniforms.uRow0.value = prog(rows, 0.2, 0.32);
    cellMat.uniforms.uRows.value = rows;
    cellMat.uniforms.uK.value = netOut * (1 - 0.35 * pairIn);
    cells.visible = rows > 0.2 && netOut > 0.003;

    // the partial-correlation panel
    const pw = cur.pairW;
    for (let k = 0; k < 4; k++) pw[k] = 0;
    if (NPR) { const pl = clamp(Math.floor(pairP - 1), 0, NPR - 1), ph = Math.min(NPR - 1, pl + 1), pf = clamp(pairP - 1 - pl, 0, 1); pw[pl] += 1 - pf; pw[ph] += pf; }
    const scA = pairIn * netOut;
    dotMat.uniforms.uW.value.set(pw[0], pw[1], pw[2], pw[3]);
    dotMat.uniforms.uPart.value = part; dotMat.uniforms.uRise.value = prog(pairIn, 0, 1); dotMat.uniforms.uK.value = scA;
    let sx = 0, slope = 0;
    PAIRS.forEach((p, k) => {
      const ca = F2.indexOf(p.a), cb = F2.indexOf(p.b);
      sx += pw[k] * (ca >= 0 && cb >= 0 ? (cellX(ca) + cellX(cb)) / 2 : MAT.x0 + 0.3);
      slope += pw[k] * lerp(p.r, p.pr, part);
    });
    dotMat.uniforms.uSX.value = sx;
    dots.visible = scA > 0.003 && NPR > 0;
    backMat.opacity = 0.62 * prog(pairIn, 0, 0.4) * netOut * set.uA.value;
    scBack.visible = backMat.opacity > 0.003;
    {
      const ang = Math.atan(slope), hl = 0.47 * SCP.s / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang))), fa = prog(pairIn, 0.55, 1) * netOut;
      fitLine.position.set(SCP.x0 + SCP.s / 2, SCP.y0 + SCP.s / 2, SCP.z + 0.016);
      fitLine.rotation.set(0, 0, ang); fitLine.scale.set(2 * hl * prog(pairIn, 0.55, 1), 1, 1);
      fitMat.color.setRGB(...v3.lerp(NEGC, POSC, smooth((slope + 0.06) / 0.12)));
      fitMat.opacity = fa * set.uA.value; fitLine.visible = fa > 0.003;
      set3(cur.fitEnd, SCP.x0 + SCP.s / 2 + Math.cos(ang) * hl, SCP.y0 + SCP.s / 2 + Math.sin(ang) * hl, SCP.z + 0.016);
    }

    // the network: weights, presence, strengths and hubs crossfade between two networks
    const A = NETS[lo], Bn = NETS[hi];
    for (let l = 0; l < NL; l++) {
      const [a, b] = LINKS[l], w = lerp(A.W[l], Bn.W[l], f), first = RRANK[a] <= RRANK[b] ? a : b;
      const st = 0.46 + 0.36 * RRANK[first] / Math.max(1, NN.length - 1), g = clamp((net - st) / 0.16, 0, 1);
      const fa = cur.fw[a], fb = cur.fw[b], fm = Math.max(fa, fb), pres = lerp(A.pres[a], Bn.pres[a], f) * lerp(A.pres[b], Bn.pres[b], f);
      UL[l].set(w, g, pres * (1 + 1.1 * fm) * (1 - 0.8 * dim * (1 - fm)) * (net > 0.003 ? 1 : 0), first === a ? 0 : 1);
    }
    links.visible = net > 0.4;
    const hp = haloGeo.attributes.position.array, hc = haloGeo.attributes.aCol.array, hs = haloGeo.attributes.aSize.array, ha = haloGeo.attributes.aA.array;
    let best = -1, bs = -1;
    for (let i = 0; i < NO; i++) {
      const pres = lerp(A.pres[i], Bn.pres[i], f), str = lerp(A.str[i], Bn.str[i], f), hub = lerp(A.hub[i], Bn.hub[i], f), fw = cur.fw[i];
      const u = NPOS[i] ? lift(i, net) : 0, p = nodeAt(i, net, cur.node[i]);
      cur.pres[i] = pres; cur.hubW[i] = hub; cur.labW[i] = lerp(A.lab[i], Bn.lab[i], f);
      cur.nodeA[i] = NPOS[i] ? pres * smooth(u * 3) * (1 - 0.7 * dim * (1 - fw)) : 0;
      cur.nodeS[i] = 0.07 + 0.055 * Math.sqrt(Math.min(1, str / 3));
      if (hub * pres > 0.5 && str > bs) { bs = str; best = i; }
      hp[3 * i] = p[0]; hp[3 * i + 1] = p[1]; hp[3 * i + 2] = p[2] - 0.004;
      const pul = 0.8 + 0.2 * Math.sin(t * 1.6 + i);
      hs[i] = cur.nodeS[i] * (1.9 + 0.35 * pul * hub);
      const hcol = v3.lerp(COL[i], HUBC, hub > fw ? 1 : 0);
      hc[3 * i] = hcol[0]; hc[3 * i + 1] = hcol[1]; hc[3 * i + 2] = hcol[2];
      ha[i] = cur.nodeA[i] * Math.max(hub * 0.75 * pul, fw * 0.6) * prog(net, 0.3, 0.6);
    }
    cur.hub = best;
    for (const k of ['position', 'aCol', 'aSize', 'aA']) haloGeo.attributes[k].needsUpdate = true;
    halo.visible = net > 0.3;

    // the strength distribution: bars sorted high to low (they slide to their new places), the exponential fit
    const chA = prog(strg, 0, 0.5), grow = prog(strg, 0.15, 0.75), bw = CHT.w / 13 * 0.62, hsc = CHT.h / SMAX;
    const sc = sbars.geometry.attributes.aCol.array, sk = sbars.geometry.attributes.aK.array, ss = sbars.geometry.attributes.aS.array;
    const slot = (q, i) => (q.rank[i] >= 0 ? CHT.x0 + (q.rank[i] + 0.5) * CHT.w / Math.max(1, q.N) : -1);
    for (let i = 0; i < NO; i++) {
      let xa = slot(A, i), xb = slot(Bn, i);
      if (xa < 0) xa = xb; if (xb < 0) xb = xa;
      const x = xa < 0 ? CHT.x0 : lerp(xa, xb, f), h = Math.max(1e-4, lerp(A.str[i], Bn.str[i], f) * hsc * grow), hub = cur.hubW[i], fw = cur.fw[i];
      cur.chartX[i] = x;
      _p.set(x, CHT.y0, CHT.z); _s.set(bw, h, 0.02); _m.compose(_p, _q, _s); sbars.setMatrixAt(i, _m);
      const c = v3.lerp(COL[i], HUBC, hub * 0.85);
      sc[3 * i] = c[0]; sc[3 * i + 1] = c[1]; sc[3 * i + 2] = c[2];
      sk[i] = cur.pres[i] * chA * (1 + 0.8 * fw) * (1 - 0.6 * dim * (1 - fw));
      ss[3 * i] = bw; ss[3 * i + 1] = h; ss[3 * i + 2] = 0.02;
    }
    sbars.instanceMatrix.needsUpdate = true; for (const k of ['aCol', 'aK', 'aS']) sbars.geometry.attributes[k].needsUpdate = true;
    sbars.visible = chA > 0.003;
    backMat2.opacity = 0.55 * chA * set.uA.value; chBack.visible = chA > 0.003;
    {
      const fp2 = fitGeo.attributes.position.array, draw = prog(strg, 0.5, 1), wd = 0.0042, P = FPTS;
      const fy = (q, u) => { const r = u * Math.max(0, q.N - 1); return [CHT.x0 + (r + 0.5) * CHT.w / Math.max(1, q.N), CHT.y0 + Math.min(SMAX, q.A * Math.exp(-q.b * r)) * hsc * grow]; };
      for (let s = 0; s <= FS; s++) { const u = s / FS * draw, a = fy(A, u), b = fy(Bn, u); P[2 * s] = lerp(a[0], b[0], f); P[2 * s + 1] = lerp(a[1], b[1], f); }
      for (let s = 0; s <= FS; s++) {
        const s0 = Math.max(0, s - 1), s1 = Math.min(FS, s + 1), dx = P[2 * s1] - P[2 * s0], dy = P[2 * s1 + 1] - P[2 * s0 + 1], l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l * wd, ny = dx / l * wd, x = P[2 * s], y = P[2 * s + 1];
        fp2[6 * s] = x + nx; fp2[6 * s + 1] = y + ny; fp2[6 * s + 2] = CHT.z + 0.016; fp2[6 * s + 3] = x - nx; fp2[6 * s + 4] = y - ny; fp2[6 * s + 5] = CHT.z + 0.016;
      }
      fitGeo.attributes.position.needsUpdate = true;
      const fitOn = (A.has ? 1 - f : 0) + (Bn.has ? f : 0);
      curveMat.opacity = draw * chA * fitOn * set.uA.value; fitCurve.visible = curveMat.opacity > 0.003;
    }

    // icons: bar icons (moving to head the slab's columns), node discs, chart icons, the panel's axes
    const ip = icoGeo.attributes.position.array, ia = icoGeo.attributes.aA.array, is = icoGeo.attributes.aSize.array, ih = icoGeo.attributes.aHub.array, id = icoGeo.attributes.aDisc.array;
    const headA = prog(rows, 0.2, 0.35) * netOut * (1 - 0.5 * pairIn);
    for (let i = 0; i < NO; i++) {
      const r = BRANK[i], c = F2COL[i], fw = cur.fw[i], foc = 1 - 0.6 * dim * (1 - fw);
      const ai = prog(suv, 0.03 * r, 0.03 * r + 0.12) * netOut * foc;
      let x = BAR.x0, y = barY(r), z = BAR.z + 0.002, a = ai * (c >= 0 ? 1 : 1 - coll), s = 0.056;
      if (c >= 0) { x = lerp(x, cellX(c), coll); y = lerp(y, MAT.y + 0.075, coll); z = lerp(z, MAT.z0 + 0.03, coll); s = lerp(s, 0.05, coll); a = lerp(a, headA * foc, coll); }
      ip[3 * i] = x; ip[3 * i + 1] = y; ip[3 * i + 2] = z; ia[i] = a; is[i] = s * (1 + 0.3 * fw); ih[i] = 0;
      const k = IN0 + i, p = cur.node[i];
      ip[3 * k] = p[0]; ip[3 * k + 1] = p[1]; ip[3 * k + 2] = p[2]; ia[k] = cur.nodeA[i]; is[k] = cur.nodeS[i] * (1 + 0.25 * fw); ih[k] = cur.hubW[i] * prog(net, 0.5, 0.8);
      const q = IC + i;
      ip[3 * q] = cur.chartX[i]; ip[3 * q + 1] = CHT.y0 - 0.036; ip[3 * q + 2] = CHT.z + 0.01; ia[q] = cur.pres[i] * chA * foc; is[q] = 0.044; ih[q] = 0; id[q] = 0;
    }
    PAIRS.forEach((p, k) => {
      const a = IX + 2 * k, b = a + 1, al = pw[k] * prog(pairIn, 0.4, 0.9) * netOut;
      ip.set([SCP.x0 + SCP.s + 0.045, SCP.y0, SCP.z + 0.01], 3 * a); ip.set([SCP.x0, SCP.y0 + SCP.s + 0.045, SCP.z + 0.01], 3 * b);
      ia[a] = ia[b] = al; is[a] = is[b] = 0.052;
    });
    for (const k of ['position', 'aA', 'aSize', 'aHub', 'aDisc']) icoGeo.attributes[k].needsUpdate = true;

    // lines
    const sa = slGeo.attributes.aA.array, ga = [suv * netOut * (1 - coll), prog(pairIn, 0, 0.5) * netOut, chA, prog(rows, 0.35, 0.6) * netOut];
    for (let v = 0; v < sa.length; v++) sa[v] = slBase[v] * ga[slGrp[v]];
    slGeo.attributes.aA.needsUpdate = true;
    const mp = mlGeo.attributes.position.array, ma = mlGeo.attributes.aA.array;
    for (let i = 0; i < NO; i++) {
      const r = BRANK[i], L = LEAD[i], ex = 0.27, yb = barY(r), fw = cur.fw[i], foc = (1 + fw) * (1 - 0.7 * dim * (1 - fw));
      const la = prog(suv, 0.03 * r + 0.05, 0.03 * r + 0.25) * netOut * (1 - coll) * 0.45 * foc;
      mp.set([L[0], L[1], L[2], ex, L[1], BAR.z, ex, L[1], BAR.z, BAR.x0 - 0.03, yb, BAR.z], 18 * i);
      ma[6 * i] = ma[6 * i + 1] = ma[6 * i + 2] = ma[6 * i + 3] = la;
      const p = cur.node[i], ta = NPOS[i] ? cur.nodeA[i] * 0.4 * (1 - 0.5 * prog(net, 0.6, 1)) : 0;
      mp.set([HOME[i][0], HOME[i][1], HOME[i][2], p[0], p[1], p[2]], 18 * i + 12);
      ma[6 * i + 4] = ma[6 * i + 5] = ta;
    }
    mlGeo.attributes.position.needsUpdate = true; mlGeo.attributes.aA.needsUpdate = true;

    // the lesion: a white-hot blob, its halo, two rings closing in on it
    lesMat.uniforms.uK.value = les;
    lesion.visible = les > 0.003;
    marker.visible = les > 0.003;
    if (marker.visible) {
      const k = prog(les, 0.2, 1);
      marker.scale.setScalar(1 + 1.4 * (1 - k)); marker.rotation.set(0.3, t * 0.7, 0);
      ringMat.opacity = k * (0.75 + 0.25 * Math.sin(t * 3)) * set.uA.value;
    }

    // the ghost body under the shells (only for checking the fit in the harness)
    const gh = clamp(S.organs_ghost || 0, 0, 1);
    if (gh > 0.003 && !ghost && typeof SETS !== 'undefined' && SETS.body) { ghost = SETS.body(K); set.group.add(ghost.group); }
    if (ghost) { ghost.setAlpha(gh * set.uA.value); if (gh > 0.003) ghost.update(GHOST_S, t, dt); }
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const anchors = {
    bars: [BAR.xb + 0.06, BAR.top + 0.07, BAR.z],
    unit: [BAR.xb + BAR.k, BAR.top + 0.075, BAR.z],
    matrix: [MAT.x0 + NF * MAT.cw + 0.01, MAT.y + 0.03, MAT.z0],
    scatter: [SCP.x0, SCP.y0 + SCP.s + 0.115, SCP.z],
    axisX: [SCP.x0 + SCP.s + 0.075, SCP.y0, SCP.z],
    axisY: [SCP.x0 + 0.03, SCP.y0 + SCP.s + 0.045, SCP.z],
    fit: own(o => set3(o, cur.fitEnd[0] + 0.01, cur.fitEnd[1] + 0.02, cur.fitEnd[2])),
    net: [0, NETY, NETZ],
    title: [-0.5, 1.0, NETZ - 0.1],
    strength: [CHT.x0 - 0.03, CHT.y0 + CHT.h + 0.075, CHT.z],
    lesion: LES.slice(),
    plane: own(o => set3(o, PLW / 2, cur.plane, 0)),
    hub: own(o => (cur.hub >= 0 ? set3(o, cur.node[cur.hub][0], cur.node[cur.hub][1], cur.node[cur.hub][2]) : set3(o, 0, NETY, NETZ))),
  };
  ORG.forEach((og, i) => {
    anchors[og.id] = own(o => nodeAt(i, cur.net, o));
    anchors['bar_' + og.id] = own(o => set3(o, BAR.xb + Math.max(cur.barLen[i], 0.01) + 0.012, barY(BRANK[i]) + 0.004, BAR.z));
  });
  // names at the bars: the longest, the shortest and a few between (and a focused organ)
  const BAR_LBL = { brain: 1, heart: 1, kidneys: 1, liver: 1, lungs: 1, muscle: 1, fat: 1 };
  const netOn = S => prog(clamp(S.organs_net, 0, 1), 0.5, 0.8);
  const quietRight = S => 1 - Math.max(prog(clamp(S.organs_net, 0, 1), 0, 0.3), 0);
  const near = (S, k) => { const w = clamp(S.organs_which, 0, NNET - 1); return clamp(1 - Math.abs(w - k) * 2.2, 0, 1); };
  const labels = [];
  ORG.forEach((og, i) => {
    const name = og.name, isNode = !!NPOS[i];
    // on the organ while the plane outlines it (or focused); on its node in the network
    labels.push({ text: [name, ''], at: og.id, cls: '', alpha: S => {
      const n = netOn(S), su = clamp(S.organs_suv, 0, 1);
      const onOrgan = Math.max(cur.segA[i], cur.fw[i] * (1 - su)) * (1 - n) * (1 - prog(clamp(S.organs_rows, 0, 1), 0, 0.2));
      const onNode = isNode ? n * cur.pres[i] * Math.max(cur.labW[i], cur.fw[i]) * (1 - cur.hubW[i]) : 0;
      return Math.max(onOrgan, onNode);
    } });
    if (isNode) labels.push({ text: [name, '· hub'], at: og.id, cls: 'amb', alpha: S => netOn(S) * cur.pres[i] * cur.hubW[i] });
    labels.push({ text: [og.short || name, ''], at: 'bar_' + og.id, cls: '', minor: !BAR_LBL[og.id], alpha: S => {
      const k = cur.barA[i] * prog(clamp(S.organs_suv, 0, 1), 0.3, 0.7) * (1 - prog(clamp(S.organs_rows, 0, 1), 0, 0.15));
      return k * Math.max(BAR_LBL[og.id] ? 1 - cur.dim * (1 - cur.fw[i]) : 0, cur.fw[i]);
    } });
  });
  labels.push({ text: ['÷ aorta', '· the blood pool = 1'], at: 'unit', cls: 'cyn', alpha: S => prog(clamp(S.organs_suv, 0, 1), 0.4, 0.8) * (1 - prog(clamp(S.organs_rows, 0, 1), 0, 0.15)) * quietRight(S) });
  labels.push({ text: ['AI segmentation', '· slice by slice'], at: 'plane', cls: 'cyn', alpha: S => { const s = clamp(S.organs_seg, 0, 1); return prog(s, 0.02, 0.08) * (1 - prog(s, 0.8, 0.9)); } });
  labels.push({ text: [`${NR} scans × ${NF} organs`, '· stand-in values'], at: 'matrix', cls: 'amb', alpha: S => prog(clamp(S.organs_rows, 0, 1), 0.7, 0.95) * (1 - prog(clamp(S.organs_pair, 0, 1), 0, 0.3)) * quietRight(S) });
  labels.push({ text: [`${NR} people`, '· stand-ins'], at: 'scatter', cls: '', alpha: S => prog(clamp(S.organs_pair, 0, 1), 0.5, 0.9) * quietRight(S) });
  labels.push({ text: ['Tumour', '· a hot spot'], at: 'lesion', cls: 'amb', alpha: S => prog(clamp(S.organs_lesion, 0, 1), 0.4, 0.8) * (1 - netOn(S)) });
  PAIRS.forEach((p, k) => {
    const w = S => { const q = clamp(S.organs_pair, 0, NPR); return clamp(1 - Math.abs(q - (k + 1)) * 2, 0, 1) * prog(clamp(S.organs_pair, 0, 1), 0.5, 0.9) * quietRight(S); };
    const na = ORG[OI[p.a]] ? ORG[OI[p.a]].name : p.a, nb = ORG[OI[p.b]] ? ORG[OI[p.b]].name : p.b, part = S => clamp(S.organs_partial, 0, 1);
    labels.push({ text: [na, '→'], at: 'axisX', cls: '', alpha: w });
    labels.push({ text: [nb, '↑'], at: 'axisY', cls: '', alpha: w });
    labels.push({ text: [`r = ${num(p.r)}`, ''], at: 'fit', cls: 'cyn', alpha: S => w(S) * (1 - prog(part(S), 0.1, 0.45)) });
    labels.push({ text: [`partial r = ${num(p.pr)}`, ` (paper: ${num(p.paper)})`], at: 'fit', cls: 'amb', alpha: S => w(S) * prog(part(S), 0.6, 0.95) });
  });
  NETS.forEach((q, k) => {
    labels.push({ text: [q.title, q.size ? ` · n = ${q.size}` : ''], at: 'title', cls: '', alpha: S => netOn(S) * near(S, k) });
    if (q.density !== null) labels.push({ text: [`density ${q.density} %`, q.disorder ? ` · disorder ${q.disorder}` : ''], at: 'strength', cls: 'amb', alpha: S => prog(clamp(S.organs_strength, 0, 1), 0.4, 0.8) * near(S, k) });
  });
  const cam = {
    default: [0, 4, 3.75, 0, 0, 0],
    seg: [16, 8, 2.3, 0, 0.3, 0],
    bars: [-6, 4, 3.0, 0.42, 0.24, 0],
    matrix: [32, 30, 2.5, 0.76, 0.1, -0.32],
    scatter: [8, 6, 2.1, 0.76, 0.52, 0.2],
    net: [10, 6, 3.2, 0.02, 0.27, 0.35],
    strength: [-4, 4, 3.3, 0.48, 0.25, 0.32],
    lesion: [-24, 8, 1.15, LES[0], LES[1], LES[2]],
  };
  const VIEWS = [['organs', 'Organs'], ['uptake', 'Uptake'], ['matrix', 'Matrix'], ['partial', 'Partial'], ['network', 'Network'], ['strength', 'Strength']];
  const controls = [
    { key: 'view', label: 'View', options: VIEWS },
    { key: 'network', label: 'Network', options: NET_IDS.slice(0, 11).map((id, k) => [id, NET_SHORT[k]]) },
  ];
  function explore(c) {
    const v = c.view || 'organs', w = Math.max(0, NET_IDS.indexOf(c.network || 'full')), tt = c.t || 0;
    const o = { organs_seg: 1, organs_suv: 0, organs_rows: 0, organs_pair: 0, organs_partial: 0, organs_net: 0, organs_strength: 0, organs_which: w, organs_lesion: 0 };
    if (v === 'uptake') o.organs_suv = 1;
    if (v === 'matrix') o.organs_rows = 1;
    // the explainer loops: each pair raw for 4 s, then its residuals for 6 s
    if (v === 'partial') { o.organs_rows = 1; o.organs_pair = 1 + Math.floor(tt / 10) % Math.max(1, NPR); o.organs_partial = tt % 10 < 4 ? 0 : 1; }
    if (v === 'network') o.organs_net = 1;
    if (v === 'strength') { o.organs_net = 1; o.organs_strength = 1; }
    return o;
  }

  // ---------------------------------------------------------------- explore API
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
  function hitEll(o, d, c, r, ax) {   // ray (modelling coordinates) against an ellipsoid -> distance or Infinity
    let ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2], dx = d[0], dy = d[1], dz = d[2];
    if (ax) {
      const P = [ox, oy, oz], Q = [dx, dy, dz];
      ox = v3.dot(P, ax[0]); oy = v3.dot(P, ax[1]); oz = v3.dot(P, ax[2]); dx = v3.dot(Q, ax[0]); dy = v3.dot(Q, ax[1]); dz = v3.dot(Q, ax[2]);
    }
    ox /= r[0]; oy /= r[1]; oz /= r[2]; dx /= r[0]; dy /= r[1]; dz /= r[2];
    const a = dx * dx + dy * dy + dz * dz, b = 2 * (ox * dx + oy * dy + oz * dz), cc = ox * ox + oy * oy + oz * oz - 1, disc = b * b - 4 * a * cc;
    if (disc < 0) return Infinity;
    const t0 = (-b - Math.sqrt(disc)) / (2 * a), t1 = (-b + Math.sqrt(disc)) / (2 * a);
    return t0 > 0 ? t0 : t1 > 0 ? 0 : Infinity;
  }
  function pick(raycaster) {
    set.group.updateMatrixWorld();
    _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    const o = _ray.origin, d = _ray.direction;
    // the network's nodes first, then the bars, then the shells (the fat band last: it wraps the others)
    if (cur.net > 0.4) {
      let best = null, bd = Infinity;
      for (const i of NN) {
        if (cur.nodeA[i] < 0.2) continue;
        const p = cur.node[i], x = p[0] - o.x, y = p[1] - o.y, z = p[2] - o.z, al = x * d.x + y * d.y + z * d.z;
        if (al <= 0) continue;
        const off = Math.sqrt(Math.max(0, x * x + y * y + z * z - al * al));
        if (off < cur.nodeS[i] * 0.65 && al < bd) { bd = al; best = ORG[i].id; }
      }
      if (best) return best;
    }
    for (let i = 0; i < NO; i++) {
      if (cur.barA[i] < 0.3) continue;
      const y = barY(BRANK[i]), x0 = BAR.x0 - 0.03, x1 = BAR.xb + cur.barLen[i] + 0.01;
      if (Math.abs(d.z) < 1e-6) continue;
      const tz = (BAR.z - o.z) / d.z, hx = o.x + d.x * tz, hy = o.y + d.y * tz;
      if (tz > 0 && hx >= x0 && hx <= x1 && Math.abs(hy - y) < BAR.dy * 0.45) return ORG[i].id;
    }
    if (shellMat.uniforms.uPlane.value < 9) {
      const om = [o.x / XS, o.y, o.z], dm = [d.x / XS, d.y, d.z];
      let best = null, bd = Infinity, fat = Infinity;
      for (const og of ORG) for (const [c, r, ax] of (PICKS[og.id] || [])) {
        const t = hitEll(om, dm, c, r, ax);
        if (og.id === 'fat') { fat = Math.min(fat, t); continue; }
        if (c[1] < cur.plane - 0.02 && cur.plane > -9) continue;   // not yet outlined
        if (t < bd) { bd = t; best = og.id; }
      }
      return best || (fat < Infinity ? 'fat' : null);
    }
    return null;
  }
  const API = {
    netIds: NET_IDS.slice(0, 11),
    pick,
    setFocus: id => { apiFocus = id && OI[id] !== undefined ? OI[id] + 1 : 0; },
    stats: { shellMs, verts: SP.length / 3, tris: SI.length / 3 },
  };
  return Object.assign(set, {
    params: { organs_a: 1, organs_seg: 1, organs_suv: 0, organs_focus: 0, organs_lesion: 0, organs_rows: 0, organs_pair: 0, organs_partial: 0,
      organs_net: 0, organs_which: 0, organs_strength: 0, organs_ghost: 0 },
    update, anchors, labels, cam, controls, explore, api: () => API,
  });
};
