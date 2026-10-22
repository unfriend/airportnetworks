// Small 3D organ models for the microanatomy story: one lit procedural mesh for each of MICRO_DATA's 29 organs (the
// heart, brain, lungs ... and the vagina), each a signed distance field (spheres, ellipsoids, round cones and tubes
// blended softly, as the muscle story's heart is) polygonised by surface nets on a small grid. They stand in for the
// PET story's flat line icons: as real meshes in the scenes (the network's organ ring), and as small pictures in the
// HTML chips and the headset's canvas panels (each model drawn once onto a 2D canvas, lazily, by a tiny painter's
// renderer, so no WebGL context or render target is needed, also inside a headset session).
// ORGAN3D: ids, idOf(name), geo(id) (the mesh, built on first use), lite(id) (a lighter copy, for small on screen),
// merged(ids, opts) (one BufferGeometry, aSlot per model; opts.lite: the lighter copies), shader(n) (a lit material's GLSL with per-model place and look), canvas(id, px), url(id), step(ms) (build
// models and pictures ahead between frames, one organ after another), want(id) (that one next), mesh(id), pic(id) and
// picUrl(id) (without waiting: null until built), version(), ready(). Manifest: organs.md. SETS.organs is the
// harness's gallery (not part of the story).
const ORGAN3D = (() => {
  const PI = Math.PI, hyp = (x, y, z = 0) => Math.sqrt(x * x + y * y + z * z), clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  // ------------------------------------------------------------ distance primitives (after Inigo Quilez)
  const sph = (cx, cy, cz, r) => (x, y, z) => hyp(x - cx, y - cy, z - cz) - r;
  // an ellipsoid (a close bound), turned by rz about z and then ry about y
  const ell = (cx, cy, cz, rx, ry, rz, rotZ = 0, rotY = 0) => {
    const cz0 = Math.cos(rotZ), sz0 = Math.sin(rotZ), cy0 = Math.cos(rotY), sy0 = Math.sin(rotY);
    return (x, y, z) => {
      let px = x - cx, py = y - cy, pz = z - cz;
      const qx = px * cy0 - pz * sy0, qz = px * sy0 + pz * cy0; px = qx; pz = qz;
      const ux = px * cz0 + py * sz0, uy = -px * sz0 + py * cz0;
      const a = ux / rx, b = uy / ry, c = pz / rz, k0 = Math.sqrt(a * a + b * b + c * c), k1 = Math.sqrt(a * a / (rx * rx) + b * b / (ry * ry) + c * c / (rz * rz));
      return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
    };
  };
  // a cone with round ends from a (radius r1) to b (radius r2)
  const cone = (a, b, r1, r2) => {
    const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2], rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
    return (x, y, z) => {
      const px = x - a[0], py = y - a[1], pz = z - a[2], yy = px * ba[0] + py * ba[1] + pz * ba[2], zz = yy - l2;
      const qx = px * l2 - ba[0] * yy, qy = py * l2 - ba[1] * yy, qz = pz * l2 - ba[2] * yy, x2 = qx * qx + qy * qy + qz * qz;
      const kk = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zz) * a2 * zz * zz > kk) return Math.sqrt(x2 + zz * zz * l2) * il2 - r2;
      if (Math.sign(yy) * a2 * yy * yy < kk) return Math.sqrt(x2 + yy * yy * l2) * il2 - r1;
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
    };
  };
  const cap = (a, b, r) => cone(a, b, r, r);
  // a tube through points [x, y, z, r] (smoothed: a Catmull-Rom curve sampled into round cones)
  const tube = (pts, sub = 3) => {
    const P = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < sub; s++) {
        const t = s / sub, t2 = t * t, t3 = t2 * t;
        P.push([0, 1, 2, 3].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
      }
    }
    P.push(pts[pts.length - 1]);
    // (each piece with a bounding sphere: a piece that cannot be nearer than the best so far is skipped)
    const C = [], B = [];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      C.push(cone(a, b, a[3], b[3]));
      B.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) / 2 + Math.max(a[3], b[3])]);
    }
    return (x, y, z) => {
      let d = 1e9;
      for (let i = 0; i < C.length; i++) {
        const q = B[i], dx = x - q[0], dy = y - q[1], dz = z - q[2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) - q[3] >= d) continue;
        const v = C[i](x, y, z); if (v < d) d = v;
      }
      return d;
    };
  };
  // a rounded box (half sizes)
  const box = (cx, cy, cz, hx, hy, hz, r) => (x, y, z) => {
    const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
    return hyp(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const mirror = f => (x, y, z) => f(Math.abs(x), y, z);
  const scaleZ = (f, k) => (x, y, z) => f(x, y, z * k) / Math.max(1, k);

  // ------------------------------------------------------------ the organs
  // Each: parts [distance, colour, blend], optional cut (subtracted, with its blend), disp (a small displacement:
  // gyri, lobules, folds) and paint (stripes, layers). Local frame: x to the viewer's right, y up, z towards the
  // viewer; about [-1, 1]. Colours are natural (fresh tissue), a little brightened to read on the dark scene.
  const C = {
    flesh: '#c23a44', red: '#d4474f', vein: '#5b6bd2', pale: '#efe2d2', ureter: '#e8d2ad', yellow: '#f2d47e',
  };
  const ORG = {
    brain: { parts: [[ell(0.04, 0.16, 0, 0.92, 0.6, 0.7), '#e8b2b7'], [ell(0.22, -0.2, 0.05, 0.56, 0.3, 0.6), '#e8b2b7', 0.12],
      [ell(-0.62, -0.42, 0, 0.36, 0.24, 0.52), '#d49ba3', 0.06], [cone([-0.24, -0.34, 0], [-0.32, -0.92, 0], 0.12, 0.08), '#e6c2b6', 0.06]],
      cut: [[box(0, 0.5, 0, 1.2, 0.5, 0.022, 0.01), 0.04]],
      disp: (x, y, z) => (x > -0.4 || y > -0.1 ? 0.034 * Math.sin(8 * x + 2.2 * Math.sin(7 * y)) * Math.sin(8.5 * y + 2 * Math.sin(7 * z)) * Math.sin(7 * z + 1.7 * Math.sin(6 * x)) : 0.012 * Math.sin(40 * y)),
      view: [-15, 8], res: 28 },
    thyroid: { parts: [[ell(-0.42, 0.05, 0.12, 0.27, 0.6, 0.24, -0.25), '#b8424f'], [ell(0.42, 0.05, 0.12, 0.27, 0.6, 0.24, 0.25), '#b8424f'],
      [cap([-0.35, -0.22, 0.2], [0.35, -0.22, 0.2], 0.13), '#b8424f', 0.1], [cap([0, -1.0, -0.22], [0, 1.0, -0.22], 0.27), '#eadccf', 0.02]],
      paint: (x, y, z, c, part) => (part === 3 && Math.sin(y * 26) > 0.55 ? c.map(v => v * 0.8) : c), view: [-20, 10] },
    lungs: { parts: [[cone([-0.46, -0.48, 0], [-0.36, 0.56, 0], 0.44, 0.2), '#f19aa7', 0.25], [cone([0.46, -0.5, 0], [0.36, 0.52, 0], 0.42, 0.19), '#f19aa7', 0.25],
      [cap([0, 0.98, 0], [0, 0.28, 0], 0.1), C.pale, 0.05], [cap([0, 0.3, 0], [-0.3, 0.02, 0], 0.08), C.pale, 0.05], [cap([0, 0.3, 0], [0.3, 0.02, 0], 0.08), C.pale, 0.05]],
      cut: [[sph(0.18, -0.38, 0.25, 0.3), 0.1], [box(0, -0.1, 0, 0.1, 0.6, 0.6, 0.05), 0.12]],
      disp: (x, y, z) => 0.008 * Math.sin(30 * x) * Math.sin(30 * y), view: [-12, 6] },
    heart: { parts: [[ell(0.04, -0.14, 0.05, 0.5, 0.7, 0.48, 0.6), C.flesh], [cone([-0.12, 0.12, 0.08], [0.42, -0.68, 0.12], 0.46, 0.1), C.flesh, 0.18],
      [sph(-0.4, 0.34, -0.06, 0.31), '#b33748', 0.12], [sph(0.26, 0.42, -0.2, 0.28), '#b33748', 0.12],
      [tube([[-0.02, 0.3, -0.05, 0.17], [-0.02, 0.74, 0, 0.16], [0.2, 0.93, -0.02, 0.15], [0.42, 0.82, -0.12, 0.14], [0.5, 0.42, -0.28, 0.13]]), '#dd5a61', 0.06],
      [tube([[0.16, 0.24, 0.26, 0.15], [0.22, 0.6, 0.2, 0.14], [0.36, 0.74, 0.05, 0.12]]), '#6d77d6', 0.06],
      [cap([-0.38, 0.5, -0.08], [-0.38, 0.98, -0.08], 0.12), C.vein, 0.05]],
      view: [-10, 6] },
    liver: { parts: [[ell(-0.22, 0.04, 0, 0.88, 0.5, 0.56, -0.1), '#8e3b2d'], [ell(0.52, 0.12, 0.08, 0.5, 0.26, 0.4, 0.15), '#8e3b2d', 0.25],
      [ell(-0.12, -0.36, 0.38, 0.12, 0.2, 0.12, 0.4), '#6c9a46', 0.04]],
      cut: [[(x, y, z) => y + 0.3 - 0.22 * x, 0.18]], view: [-20, 18] },
    spleen: { parts: [[scaleZ(tube([[-0.55, -0.55, 0, 0.16], [-0.62, 0, 0, 0.3], [-0.3, 0.5, 0, 0.32], [0.2, 0.62, 0, 0.26], [0.6, 0.38, 0, 0.15]]), 1.6), '#7d3559']],
      disp: (x, y, z) => 0.012 * Math.sin(12 * x + 4 * y), view: [-15, 8] },
    pancreas: { parts: [[tube([[-0.8, -0.2, 0.05, 0.27], [-0.4, -0.06, 0, 0.22], [0.08, 0.04, 0, 0.19], [0.5, 0.18, -0.04, 0.16], [0.86, 0.34, -0.06, 0.12]]), '#e9b47c'],
      [tube([[-0.6, 0.38, 0.1, 0.12], [-1.0, 0.1, 0.12, 0.13], [-0.98, -0.42, 0.12, 0.13], [-0.5, -0.56, 0.12, 0.12], [-0.1, -0.42, 0.1, 0.11]]), '#e39790', 0.04]],
      disp: (x, y, z) => 0.032 * Math.sin(24 * x) * Math.sin(21 * y + 1) * Math.sin(23 * z + 2), view: [-10, 14] },
    kidney: { parts: [[(e => (h => (x, y, z) => smax(e(x, y, z), -h(x, y, z), 0.16))(sph(0.42, 0, 0, 0.27)))(ell(-0.1, 0, 0, 0.44, 0.72, 0.32)), '#9d3b37'], [tube([[0.22, 0, 0, 0.11], [0.4, -0.22, 0, 0.08], [0.36, -0.98, 0.02, 0.055]]), C.ureter, 0.06],
      [cap([0.2, 0.14, 0.02], [0.8, 0.18, 0.02], 0.065), C.red, 0.04], [cap([0.2, 0.04, 0.09], [0.8, 0.02, 0.12], 0.075), C.vein, 0.04]],
      view: [-10, 6] },
    adrenal: { parts: [[ell(0, 0.32, 0, 0.52, 0.36, 0.15), '#e8a63b'], [ell(-0.34, 0.06, 0, 0.3, 0.3, 0.15), '#e8a63b', 0.12], [ell(0.34, 0.06, 0, 0.3, 0.3, 0.15), '#e8a63b', 0.12],
      [ell(0, -0.6, -0.08, 0.52, 0.48, 0.32), '#9d3b37', 0.03]],
      disp: (x, y, z) => (y > -0.15 ? 0.018 * Math.sin(20 * x + 3) * Math.sin(18 * y) : 0), view: [-22, 14] },
    smallint: { parts: [[tube([[-0.7, 0.62, -0.1, 0.12], [-0.2, 0.74, 0.1, 0.12], [0.3, 0.56, 0.22, 0.12], [0.66, 0.66, -0.05, 0.12], [0.74, 0.3, 0.12, 0.12], [0.36, 0.24, -0.22, 0.12],
      [-0.08, 0.38, -0.1, 0.12], [-0.5, 0.26, 0.24, 0.12], [-0.78, 0.0, -0.06, 0.12], [-0.42, -0.14, -0.26, 0.12], [0.0, 0.0, 0.2, 0.12], [0.46, -0.08, 0.24, 0.12],
      [0.78, -0.32, -0.08, 0.12], [0.36, -0.46, -0.24, 0.12], [-0.06, -0.36, 0.1, 0.12], [-0.5, -0.5, 0.22, 0.12], [-0.7, -0.76, -0.1, 0.12], [-0.2, -0.84, 0.06, 0.12],
      [0.3, -0.78, 0.18, 0.12], [0.62, -0.66, 0.0, 0.12]], 3), '#ea9fa1']],
      disp: (x, y, z) => 0.006 * Math.sin(40 * x + 30 * y), view: [-14, 16] },
    colon: { parts: [[tube([[-0.62, -0.62, 0.05, 0.2], [-0.66, -0.1, 0, 0.19], [-0.6, 0.5, 0, 0.19], [-0.3, 0.68, 0.06, 0.18], [0.1, 0.6, 0.12, 0.18], [0.5, 0.66, 0.02, 0.17],
      [0.68, 0.4, 0, 0.16], [0.68, -0.2, 0, 0.16], [0.56, -0.62, 0.08, 0.15], [0.2, -0.56, 0.16, 0.14], [0.02, -0.74, 0.08, 0.13], [0, -1.0, 0, 0.12]], 5), '#d88a83'],
      [sph(-0.6, -0.78, 0.08, 0.17), '#d88a83', 0.1]],
      disp: (x, y, z) => 0.03 * Math.pow(Math.max(0, Math.sin((Math.abs(x) * 1.5 + y) * 15)), 2) - 0.012, view: [-10, 8] },
    muscle: { parts: [[cone([0, 0, 0], [0.05, 0.72, 0], 0.37, 0.11), '#c03b42', 0.25], [cone([0, 0, 0], [-0.05, -0.72, 0], 0.37, 0.11), '#c03b42', 0.25],
      [cap([0.05, 0.66, 0], [0.08, 1.0, 0], 0.07), C.pale, 0.05], [cap([-0.05, -0.66, 0], [-0.08, -1.0, 0], 0.07), C.pale, 0.05]],
      disp: (x, y, z) => (Math.abs(y) < 0.75 ? 0.014 * Math.sin(16 * Math.atan2(z, x)) : 0),
      paint: (x, y, z, c, part) => (part < 2 && Math.sin(16 * Math.atan2(z, x)) > 0.7 ? c.map(v => v * 0.82) : c), view: [-10, 6] },
    adipose: { parts: [[sph(0, 0, 0, 0.32), '#f5d98a'], [sph(0.42, 0.18, 0.05, 0.27), '#f5d98a', 0.07], [sph(-0.4, 0.2, -0.05, 0.28), '#f5d98a', 0.07], [sph(0.1, 0.5, 0.05, 0.25), '#f5d98a', 0.07],
      [sph(-0.2, -0.42, 0.1, 0.27), '#f5d98a', 0.07], [sph(0.36, -0.36, -0.05, 0.26), '#f5d98a', 0.07], [sph(-0.62, -0.18, 0.08, 0.22), '#f5d98a', 0.07], [sph(0.68, -0.08, 0.1, 0.21), '#f5d98a', 0.07],
      [sph(-0.28, 0.6, 0.0, 0.2), '#f5d98a', 0.07], [sph(0.15, 0.05, 0.38, 0.22), '#f5d98a', 0.07], [sph(-0.1, -0.1, -0.38, 0.25), '#f5d98a', 0.07],
      [tube([[-0.9, 0.7, 0.3, 0.035], [-0.4, 0.42, 0.35, 0.035], [0.1, 0.36, 0.42, 0.03], [0.5, 0.3, 0.32, 0.03]]), C.red, 0.02]], view: [-15, 10] },
    artery: { parts: [[tube([[-0.46, -0.95, 0.1, 0.19], [-0.46, 0.1, 0.1, 0.19], [-0.22, 0.58, 0, 0.18], [0.22, 0.58, -0.06, 0.17], [0.46, 0.15, -0.1, 0.16], [0.46, -0.95, -0.1, 0.15]]), '#d84a52'],
      [cap([-0.2, 0.6, 0], [-0.26, 1.0, 0], 0.075), '#d84a52', 0.06], [cap([0.0, 0.66, -0.03], [0.0, 1.0, -0.03], 0.065), '#d84a52', 0.06], [cap([0.18, 0.62, -0.05], [0.26, 1.0, -0.05], 0.065), '#d84a52', 0.06]],
      cut: [[(x, y, z) => y + 0.9, 0.02], [(x, y, z) => Math.max(hyp(x + 0.46, z - 0.1) - 0.1, y + 0.75), 0.02], [(x, y, z) => Math.max(hyp(x - 0.46, z + 0.1) - 0.08, y + 0.75), 0.02]],
      paint: (x, y, z, c) => (y < -0.86 ? hex('#f3d08a') : c), view: [-10, 14] },
    bladder: { parts: [[ell(0, 0.05, 0, 0.62, 0.55, 0.55), '#e6ad9c'], [cone([0, -0.42, 0], [0, -0.92, 0], 0.18, 0.07), '#e6ad9c', 0.12],
      [tube([[-0.42, 0.22, -0.22, 0.06], [-0.7, 0.6, -0.26, 0.055], [-0.74, 1.0, -0.26, 0.05]]), C.ureter, 0.05], [tube([[0.42, 0.22, -0.22, 0.06], [0.7, 0.6, -0.26, 0.055], [0.74, 1.0, -0.26, 0.05]]), C.ureter, 0.05]],
      cut: [[sph(0, 0.85, 0.1, 0.42), 0.25]], view: [-12, 12] },
    breast: { parts: [[ell(0, 0, 0, 0.74, 0.68, 0.5), '#f0c2aa'], [sph(0, -0.06, 0.49, 0.075), '#b8775f', 0.05], [box(0, 0, -0.12, 0.92, 0.88, 0.09, 0.04), '#e6b49c', 0.06]],
      cut: [[(x, y, z) => z + 0.05, 0.08]], paint: (x, y, z, c) => (z > 0.2 && hyp(x, y + 0.06) < 0.2 ? hex('#c98a70') : c), view: [-55, 10] },
    cervix: { parts: [[cap([0, 0.02, -0.45], [0, 0, 0.45], 0.5), '#e5a2ad'], [cone([0, 0.2, -0.55], [0, 0.42, -0.7], 0.5, 0.36), '#df8f9e', 0.15]],
      cut: [[ell(0, 0, 0.94, 0.16, 0.07, 0.16), 0.05]], paint: (x, y, z, c) => (z > 0.8 && hyp(x, y) < 0.24 ? hex('#cf7f8f') : c), view: [-25, 18] },
    esophagus: { parts: [[tube([[0, 1.0, 0, 0.21], [0.06, 0.4, 0.05, 0.21], [-0.04, -0.3, 0.02, 0.2], [0.08, -0.85, 0.06, 0.22], [0.25, -1.0, 0.1, 0.28]]), '#dc8a8c']],
      cut: [[(x, y, z) => 0.95 - y, 0.02], [(x, y, z) => Math.max(hyp(x, z) - 0.09 - 0.03 * Math.cos(6 * Math.atan2(z, x)), 0.82 - y), 0.02]],
      disp: (x, y, z) => 0.01 * Math.sin(30 * y), paint: (x, y, z, c) => (y > 0.9 && hyp(x, z) < 0.18 ? hex('#f0b8b8') : c), view: [-10, 28] },
    fallopian: { parts: [[tube([[-0.95, -0.38, 0, 0.09], [-0.45, 0.12, 0.05, 0.09], [0.1, 0.38, 0.05, 0.1], [0.55, 0.28, 0, 0.13]]), '#e8a3b7'],
      [cone([0.55, 0.28, 0], [0.82, -0.04, 0.05], 0.13, 0.28), '#e8a3b7', 0.08],
      ...[0, 1, 2, 3, 4, 5].map(k => { const a = -1.9 + k * 0.55; return [cap([0.86 + 0.18 * Math.cos(a), -0.08 + 0.18 * Math.sin(a), 0.05], [0.86 + 0.42 * Math.cos(a), -0.08 + 0.42 * Math.sin(a), 0.05 + 0.04 * Math.sin(3 * k)], 0.045), '#eab0c2', 0.04]; }),
      [ell(0.32, -0.42, 0.12, 0.24, 0.15, 0.15, 0.3), '#f1cbc3', 0.02]],
      cut: [[sph(0.92, -0.12, 0.12, 0.16), 0.05]], view: [-12, 10] },
    salivary: { parts: [[tube([[0, 0.95, 0, 0.06], [0, 0.45, 0, 0.055], [-0.1, 0.1, 0, 0.045]]), C.pale],
      ...[[-0.35, 0.3, 0.05], [0.3, 0.32, 0], [-0.1, 0.05, 0.25], [0.18, 0.02, -0.2], [-0.45, -0.1, -0.1], [0.45, -0.08, 0.12], [-0.2, -0.38, 0.12], [0.2, -0.4, -0.05],
        [0, -0.68, 0.06], [-0.5, -0.5, 0.0], [0.52, -0.46, 0.0], [0.05, 0.38, 0.22], [-0.08, -0.12, -0.32]].map(p => [sph(p[0], p[1], p[2], 0.21), '#e6b08c', 0.05])],
      disp: (x, y, z) => 0.012 * Math.sin(28 * x) * Math.sin(26 * y) * Math.sin(27 * z), view: [-15, 10] },
    nerve: { parts: [[(c => (x, y, z) => smax(c(x, y, z), x - 0.5, 0.03))(cap([-0.8, 0, 0], [0.7, 0, 0], 0.34)), '#e9cf86'],
      ...[[0, 0], [0.17, 0.05], [-0.15, 0.1], [0.05, -0.17], [-0.12, -0.12], [0.16, -0.12], [0.02, 0.18]].map(([py, pz]) => [cap([0.2, py, pz], [0.84, py * 1.1, pz * 1.1], 0.085), '#f6ebbe', 0.01])],
      view: [-34, 12] },
    ovary: { parts: [[ell(0, 0, 0, 0.78, 0.48, 0.44, 0.15), '#f0c2bc'], ...[[0.35, 0.3, 0.2, 0.15], [-0.4, 0.26, 0.18, 0.12], [0.05, 0.36, 0.28, 0.1], [-0.15, -0.18, 0.4, 0.13], [0.5, -0.12, 0.3, 0.11], [-0.6, -0.02, 0.22, 0.09]]
      .map(p => [sph(p[0], p[1], p[2], p[3]), '#f8d9cf', 0.06])], paint: (x, y, z, c) => (hyp(x + 0.3, y + 0.25, z - 0.25) < 0.16 ? hex('#fbf0e4') : c), view: [-15, 12] },
    pituitary: { parts: [[sph(0, -0.3, 0.16, 0.42), '#d8858d'], [sph(0, -0.22, -0.26, 0.3), '#ead0b6', 0.1], [cone([0, 0.04, -0.18], [0, 0.98, -0.08], 0.13, 0.08), '#ead0b6', 0.1]],
      view: [-55, 12] },
    prostate: { parts: [[cone([0, 0.3, 0], [0, -0.55, 0.05], 0.62, 0.24), '#cf8e7e', 0.15], [cap([0, 1.0, 0], [0, -1.0, 0.06], 0.09), C.pale, 0.04],
      [ell(-0.46, 0.56, -0.32, 0.33, 0.14, 0.14, 0.5), '#e0b48f', 0.05], [ell(0.46, 0.56, -0.32, 0.33, 0.14, 0.14, -0.5), '#e0b48f', 0.05]],
      disp: (x, y, z) => 0.015 * Math.sin(12 * x) * Math.sin(14 * y), view: [-14, 12] },
    skin: { parts: [[box(0, -0.18, 0, 0.86, 0.52, 0.6, 0.06), '#f2aba2'],
      ...[[-0.5, 0.1], [-0.1, -0.25], [0.25, 0.2], [0.55, -0.2]].map(([px, pz]) => [cap([px, -0.05, pz], [px + 0.2, 0.7, pz + 0.12], 0.022), '#4a3a32', 0.005])],
      disp: (x, y, z) => (y > 0.2 ? 0.03 * Math.sin(9 * x) * Math.sin(7 * z) : 0),
      paint: (x, y, z, c, part) => (part > 0 ? c : y > 0.26 ? hex('#e9be97') : y < -0.32 ? (Math.sin(20 * x) * Math.sin(20 * z) > 0.2 ? hex('#f6dd8c') : hex('#efcf78')) : c), view: [-25, 22] },
    stomach: { parts: [[tube([[-0.18, 1.0, 0, 0.1], [-0.08, 0.72, 0, 0.17], [0.25, 0.64, 0, 0.42], [0.22, 0.12, 0, 0.46], [0.04, -0.36, 0, 0.38], [-0.36, -0.56, 0, 0.27], [-0.7, -0.42, 0, 0.14], [-0.92, -0.2, 0, 0.12]]), '#e39498']],
      disp: (x, y, z) => 0.006 * Math.sin(30 * x + 20 * y), view: [-10, 6] },
    testis: { parts: [[ell(0, 0, 0, 0.42, 0.62, 0.45, -0.15), '#f0d4c6'], [tube([[0.32, 0.62, -0.08, 0.14], [0.46, 0.2, -0.26, 0.11], [0.4, -0.36, -0.26, 0.1], [0.24, -0.66, -0.14, 0.08]]), '#d79a95', 0.06],
      [tube([[0.24, -0.66, -0.14, 0.05], [0.4, -0.5, -0.36, 0.05], [0.42, 0.2, -0.45, 0.05], [0.32, 1.0, -0.4, 0.05]]), '#e8cfae', 0.03]], view: [-40, 8] },
    uterus: { parts: [[scaleZ(cone([0, 0.32, 0], [0, -0.52, 0], 0.5, 0.22), 1.35), '#e38e9c', 0.2], [cap([0, -0.5, 0], [0, -0.86, 0], 0.18), '#e7a2ad', 0.08],
      [tube([[-0.4, 0.5, 0, 0.07], [-0.72, 0.6, 0, 0.06], [-0.95, 0.38, 0.02, 0.06], [-0.92, 0.14, 0.04, 0.1]]), '#ecaabd', 0.05],
      [tube([[0.4, 0.5, 0, 0.07], [0.72, 0.6, 0, 0.06], [0.95, 0.38, 0.02, 0.06], [0.92, 0.14, 0.04, 0.1]]), '#ecaabd', 0.05],
      [ell(-0.66, 0.16, 0.06, 0.18, 0.12, 0.12, 0.4), '#f2cdc4', 0.02], [ell(0.66, 0.16, 0.06, 0.18, 0.12, 0.12, -0.4), '#f2cdc4', 0.02]], view: [-12, 10] },
    vagina: { parts: [[scaleZ(cone([0, 0.62, 0], [0, -0.86, 0], 0.3, 0.36), 1.3), '#e39aa5', 0.1], [sph(0, 0.72, 0, 0.3), '#e5a2ad', 0.1]],
      cut: [[(x, y, z) => y + 0.95, 0.02], [(x, y, z) => Math.max(hyp(x, z * 1.8) - 0.16, y + 0.7), 0.04]],
      disp: (x, y, z) => 0.014 * Math.sin(34 * y), paint: (x, y, z, c, part) => (part === 1 && y > 0.85 && hyp(x, z) < 0.08 ? hex('#c9737f') : c), view: [-20, 22] },
  };
  // MICRO_DATA's organs by name -> model
  const BYNAME = { 'adipose': 'adipose', 'adrenal gland': 'adrenal', 'artery': 'artery', 'bladder': 'bladder', 'brain': 'brain', 'breast': 'breast', 'cervix': 'cervix',
    'colon': 'colon', 'esophagus': 'esophagus', 'fallopian tube': 'fallopian', 'heart': 'heart', 'kidney': 'kidney', 'liver': 'liver', 'lung': 'lungs',
    'minor salivary gland': 'salivary', 'muscle': 'muscle', 'nerve': 'nerve', 'ovary': 'ovary', 'pancreas': 'pancreas', 'pituitary': 'pituitary',
    'prostate': 'prostate', 'skin': 'skin', 'small intestine': 'smallint', 'spleen': 'spleen', 'stomach': 'stomach', 'testis': 'testis', 'thyroid': 'thyroid',
    'uterus': 'uterus', 'vagina': 'vagina' };
  const ids = Object.keys(ORG);
  const idOf = name => BYNAME[String(name || '').trim().toLowerCase()] || null;
  for (const id of ids) { const o = ORG[id]; o.parts = o.parts.map(p => ({ f: p[0], c: hex(p[1]), k: p[2] || 0.06 })); o.cut = (o.cut || []).map(c => ({ f: c[0], k: c[1] })); }

  // the field, and the colour where a point lies (the nearest part's, blended softly near seams)
  const dv = new Float64Array(24);
  function field(o, x, y, z) {
    const P = o.parts;
    let d = 1e9;
    for (let i = 0; i < P.length; i++) { const v = P[i].f(x, y, z); dv[i] = v; d = i ? smin(d, v, P[i].k) : v; }
    for (const c of o.cut) d = smax(d, -c.f(x, y, z), c.k);
    return o.disp ? d + o.disp(x, y, z) : d;
  }
  let fieldLast = 0;
  function colourAt(o, x, y, z) {
    fieldLast = field(o, x, y, z);
    const P = o.parts;
    let m = 1e9, mi = 0;
    for (let i = 0; i < P.length; i++) if (dv[i] < m) { m = dv[i]; mi = i; }
    const c = [0, 0, 0];
    let ws = 0;
    for (let i = 0; i < P.length; i++) { const w = Math.exp(-(dv[i] - m) / 0.025); ws += w; for (let q = 0; q < 3; q++) c[q] += P[i].c[q] * w; }
    let col = c.map(v => v / ws);
    if (o.paint) col = o.paint(x, y, z, col, mi);
    return col;
  }

  // ------------------------------------------------------------ surface nets
  // a coarse pass finds the box the organ fills; then a grid of about RES cells along its longest side is sampled,
  // each cell the surface crosses gets a vertex (the mean of the crossings, pulled onto the surface), and a quad joins
  // the four cells round every crossed grid edge. Normals from the field's gradient; colours darkened in creases (how
  // far the field stays below the distance a little way out along the normal)
  const MESH = {};
  function* polygonise(id, RES = ORG[id].res || 24) {
    const o = ORG[id], f = (x, y, z) => field(o, x, y, z);
    // (the coarse grid's values also spare the fine grid: a fine point in a coarse cell far from the surface takes its sign)
    const cg = 16, ch = 2.4 / cg, c1 = cg + 1, CF = new Float32Array(c1 * c1 * c1), lo = [9, 9, 9], hi = [-9, -9, -9];
    for (let i = 0; i <= cg; i++) for (let j = 0; j <= cg; j++) for (let k = 0; k <= cg; k++) {
      const x = -1.2 + i * ch, y = -1.2 + j * ch, z = -1.2 + k * ch, d = CF[(i * c1 + j) * c1 + k] = f(x, y, z);
      if (d < ch) { const p = [x, y, z]; for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], p[q] - ch); hi[q] = Math.max(hi[q], p[q] + ch); } }
    }
    const far = new Int8Array(cg * cg * cg), M = 1.9 * ch;
    for (let i = 0; i < cg; i++) for (let j = 0; j < cg; j++) for (let k = 0; k < cg; k++) {
      let s = 0;
      for (let c = 0; c < 8; c++) { const v = CF[((i + (c & 1)) * c1 + j + (c >> 1 & 1)) * c1 + k + (c >> 2 & 1)]; s += v > M ? 1 : v < -M ? -1 : 0; }
      far[(i * cg + j) * cg + k] = s === 8 ? 1 : s === -8 ? -1 : 0;
    }
    const h = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / RES;
    const nx = Math.ceil((hi[0] - lo[0]) / h) + 2, ny = Math.ceil((hi[1] - lo[1]) / h) + 2, nz = Math.ceil((hi[2] - lo[2]) / h) + 2;
    for (let q = 0; q < 3; q++) lo[q] -= h * 0.5;
    const F = new Float32Array(nx * ny * nz), id3 = (i, j, k) => (i * ny + j) * nz + k, cc = v => Math.min(cg - 1, Math.max(0, Math.floor((v + 1.2) / ch)));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
      const x = lo[0] + i * h, y = lo[1] + j * h, z = lo[2] + k * h, fr = far[(cc(x) * cg + cc(y)) * cg + cc(z)];
      F[id3(i, j, k)] = fr ? fr * M : f(x, y, z);
      if (k === nz - 1 && j === ny - 1) yield;
    }
    const VI = new Int32Array(nx * ny * nz).fill(-1), P = [], N = [], Cl = [];
    const EG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], cv = new Float64Array(8), e = 0.004;
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) for (let k = 0; k < nz - 1; k++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) { cv[c] = F[id3(i + (c & 1), j + (c >> 1 & 1), k + (c >> 2 & 1))]; if (cv[c] < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, ne = 0;
      for (const [a, b] of EG) {
        if ((cv[a] < 0) === (cv[b] < 0)) continue;
        const t = cv[a] / (cv[a] - cv[b]);
        sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; ne++;
      }
      let x = lo[0] + (i + sx / ne) * h, y = lo[1] + (j + sy / ne) * h, z = lo[2] + (k + sz / ne) * h;
      // (the gradient from four samples on a tetrahedron; the colour from the value's own evaluation; one look outwards
      // for the creases)
      const col = colourAt(o, x, y, z), d = fieldLast;
      const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), w = f(x + e, y + e, z + e);
      const gx = a - b - c + w, gy = -a - b + c + w, gz = -a + b - c + w, gl = hyp(gx, gy, gz) || 1;
      const nxv = gx / gl, nyv = gy / gl, nzv = gz / gl, pull = clamp(d, -h * 0.5, h * 0.5);
      x -= nxv * pull; y -= nyv * pull; z -= nzv * pull;
      const oc = Math.max(0, 0.14 - f(x + nxv * 0.14, y + nyv * 0.14, z + nzv * 0.14));
      const ko = clamp(1 - 4.6 * oc, 0.42, 1);
      VI[id3(i, j, k)] = P.length / 3; P.push(x, y, z); N.push(nxv, nyv, nzv); Cl.push(col[0] * ko, col[1] * ko, col[2] * ko);
      if (P.length % 240 === 0) yield;
    }
    const I = [];
    const quad = (a, b, c, d, dir, axis) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      // wound to face out: compare the quad's normal with the crossing's direction
      const ux = P[3 * c] - P[3 * a], uy = P[3 * c + 1] - P[3 * a + 1], uz = P[3 * c + 2] - P[3 * a + 2], vx = P[3 * d] - P[3 * b], vy = P[3 * d + 1] - P[3 * b + 1], vz = P[3 * d + 2] - P[3 * b + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx][axis];
      if (n * dir >= 0) I.push(a, b, c, a, c, d); else I.push(a, c, b, a, d, c);
    };
    for (let i = 1; i < nx - 1; i++) for (let j = 1; j < ny - 1; j++) for (let k = 1; k < nz - 1; k++) {
      const v0 = F[id3(i, j, k)];
      if (i < nx - 1 && (v0 < 0) !== (F[id3(i + 1, j, k)] < 0)) quad(VI[id3(i, j - 1, k - 1)], VI[id3(i, j, k - 1)], VI[id3(i, j, k)], VI[id3(i, j - 1, k)], v0 < 0 ? 1 : -1, 0);
      if (j < ny - 1 && (v0 < 0) !== (F[id3(i, j + 1, k)] < 0)) quad(VI[id3(i - 1, j, k - 1)], VI[id3(i - 1, j, k)], VI[id3(i, j, k)], VI[id3(i, j, k - 1)], v0 < 0 ? 1 : -1, 1);
      if (k < nz - 1 && (v0 < 0) !== (F[id3(i, j, k + 1)] < 0)) quad(VI[id3(i - 1, j - 1, k)], VI[id3(i, j - 1, k)], VI[id3(i, j, k)], VI[id3(i - 1, j, k)], v0 < 0 ? 1 : -1, 2);
    }
    // centred and scaled to fit a unit sphere
    let cx = 0, cy = 0, cz = 0, r = 0;
    const nv = P.length / 3;
    for (let v = 0; v < nv; v++) { cx += P[3 * v]; cy += P[3 * v + 1]; cz += P[3 * v + 2]; }
    cx /= nv || 1; cy /= nv || 1; cz /= nv || 1;
    for (let v = 0; v < nv; v++) r = Math.max(r, hyp(P[3 * v] - cx, P[3 * v + 1] - cy, P[3 * v + 2] - cz));
    const pos = new Float32Array(P.length);
    for (let v = 0; v < nv; v++) { pos[3 * v] = (P[3 * v] - cx) / r; pos[3 * v + 1] = (P[3 * v + 1] - cy) / r; pos[3 * v + 2] = (P[3 * v + 2] - cz) / r; }
    return { pos, nrm: new Float32Array(N), col: new Float32Array(Cl), idx: I.length > 65535 ? new Uint32Array(I) : new Uint16Array(I), view: o.view || [-15, 10] };
  }
  // a model now (finishing one under way), or built ahead between frames, in slices of at most ms milliseconds
  const JOB = {};
  const run = (id, until) => {
    const g = JOB[id] || (JOB[id] = polygonise(id));
    for (;;) { const r = g.next(); if (r.done) { MESH[id] = r.value; delete JOB[id]; return true; } if (performance.now() > until) return false; }
  };
  const geo = id => (!ORG[id] ? null : MESH[id] || (run(id, Infinity), MESH[id]));
  // the queue: each organ's model and then its picture, one organ after another, so pictures come one by one from the
  // start (not all at the end); want(id) puts an organ at the front (the one a pane or the body shows now)
  const QUEUE = ids.slice();
  let ver = 0;
  const want = id => { const i = QUEUE.indexOf(id); if (i > 0) { QUEUE.splice(i, 1); QUEUE.unshift(id); } };
  function step(ms) {
    const until = performance.now() + ms;
    while (QUEUE.length) {
      const id = QUEUE[0];
      if (!MESH[id]) { if (!run(id, until)) return false; ver++; }
      if (!drawPic(id, 64, until)) return false;
      QUEUE.shift(); ver++;
      if (performance.now() > until) break;
    }
    return !QUEUE.length;
  }
  const ready = () => ids.every(id => MESH[id]);
  const built = () => ids.filter(id => MESH[id]).length;

  // ------------------------------------------------------------ a lighter copy, for where a model is small on screen
  // (the atlas's 40 plates): its vertices merged on a grid twice as coarse as it was built on (vertex clustering: the
  // mean place, colour and normal of each cell's vertices; triangles that collapse are dropped), about a third of its
  // triangles. Made once, on first use, from the built model (no new field evaluations)
  const LITE = {};
  function lite(id) {
    if (LITE[id]) return LITE[id];
    const g = geo(id);
    if (!g) return null;
    const cs = 4 / ((ORG[id] && ORG[id].res) || 24), nv = g.pos.length / 3, to = new Int32Array(nv), cell = new Map(), P = [], N = [], C = [], W = [];
    const ix = v => Math.floor((v + 1.5) / cs);
    for (let v = 0; v < nv; v++) {
      const k = ix(g.pos[3 * v]) + 64 * (ix(g.pos[3 * v + 1]) + 64 * ix(g.pos[3 * v + 2]));
      let j = cell.get(k);
      if (j === undefined) { j = W.length; cell.set(k, j); P.push(0, 0, 0); N.push(0, 0, 0); C.push(0, 0, 0); W.push(0); }
      for (let q = 0; q < 3; q++) { P[3 * j + q] += g.pos[3 * v + q]; N[3 * j + q] += g.nrm[3 * v + q]; C[3 * j + q] += g.col[3 * v + q]; }
      W[j]++; to[v] = j;
    }
    for (let j = 0; j < W.length; j++) {
      const nl = hyp(N[3 * j], N[3 * j + 1], N[3 * j + 2]) || 1;
      for (let q = 0; q < 3; q++) { P[3 * j + q] /= W[j]; C[3 * j + q] /= W[j]; N[3 * j + q] /= nl; }
    }
    const I = [], seen = new Set();
    for (let i = 0; i < g.idx.length; i += 3) {
      const a = to[g.idx[i]], b = to[g.idx[i + 1]], c = to[g.idx[i + 2]];
      if (a === b || b === c || a === c) continue;
      const key = [a, b, c].sort((x, y) => x - y).join(',');
      if (seen.has(key)) continue;
      seen.add(key); I.push(a, b, c);
    }
    return (LITE[id] = { pos: new Float32Array(P), nrm: new Float32Array(N), col: new Float32Array(C), idx: W.length > 65535 ? new Uint32Array(I) : new Uint16Array(I), view: g.view });
  }

  // ------------------------------------------------------------ one geometry for several models
  // aSlot: which model (its index in the list); the material places, turns and lights each (shader(n)); opts.lite: the
  // lighter copies
  function merged(list, opts = {}) {
    const one = opts.lite ? lite : geo;
    const G = list.map(id => one(id) || one('stomach'));
    const nv = G.reduce((s, g) => s + g.pos.length / 3, 0), ni = G.reduce((s, g) => s + g.idx.length, 0);
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3), slot = new Float32Array(nv), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v0 = 0, i0 = 0;
    G.forEach((g, s) => {
      pos.set(g.pos, 3 * v0); nrm.set(g.nrm, 3 * v0); col.set(g.col, 3 * v0); slot.fill(s, v0, v0 + g.pos.length / 3);
      for (let i = 0; i < g.idx.length; i++) idx[i0 + i] = g.idx[i] + v0;
      v0 += g.pos.length / 3; i0 += g.idx.length;
    });
    return { pos, nrm, col, slot, idx, tris: ni / 3 };
  }
  // GLSL for a lit material over a merged geometry: uP[n] place (xyz) and size (w), uQ[n] alpha (x), glow (y), turn (z,
  // radians about y), and how far the model takes its level colour uTint (w). Light from over the viewer's left shoulder.
  function shader(n) {
    return {
      vertex: `
attribute vec3 aCol; attribute float aSlot;
uniform vec4 uP[${n}], uQ[${n}]; uniform vec3 uTint;
varying vec3 vC, vN, vV; varying float vA, vG;
void main() {
  int s = int(aSlot + 0.5);
  vec4 P = uP[s], Q = uQ[s];
  float c = cos(Q.z), sn = sin(Q.z);
  vec3 p = vec3(position.x * c + position.z * sn, position.y, -position.x * sn + position.z * c);
  vec3 nr = vec3(normal.x * c + normal.z * sn, normal.y, -normal.x * sn + normal.z * c);
  vec4 mv = modelViewMatrix * vec4(P.xyz + p * P.w, 1.0);
  vN = normalize(normalMatrix * nr); vV = -mv.xyz;
  vC = mix(aCol, uTint * (0.55 + 0.45 * dot(aCol, vec3(0.33))), Q.w); vA = Q.x; vG = Q.y;
  gl_Position = projectionMatrix * mv;
  if (Q.x < 0.004 || P.w < 1e-4) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `
uniform float uA;
varying vec3 vC, vN, vV; varying float vA, vG;
void main() {
  float a = vA * uA;
  if (a < 0.01) discard;
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(vec3(-0.45, 0.6, 0.65));
  if (dot(n, v) < 0.0) n = -n;
  float df = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y, fr = pow(1.0 - max(dot(n, v), 0.0), 2.4), sp = pow(max(dot(reflect(-l, n), v), 0.0), 28.0);
  vec3 col = vC * (0.26 + 0.24 * hemi + 0.72 * df) + mix(vC, vec3(1.0), 0.6) * fr * (0.35 + 0.6 * vG) + vec3(sp * 0.28) + vC * vG * 0.35;
  gl_FragColor = vec4(col, a);
}`,
    };
  }

  // ------------------------------------------------------------ pictures (a painter's renderer on a 2D canvas)
  // (a resumable job, so drawing ahead between frames stays within its slice: a few hundred triangles at a time)
  const PIC = {}, URL = {}, PJOB = {};
  function* picture(id, px) {
    const g = geo(id);
    if (!g || typeof document === 'undefined') return null;
    const S = 2, W = px * S, cv = document.createElement('canvas');
    cv.width = cv.height = W;
    const ctx = cv.getContext('2d');
    const [yaw, pitch] = g.view, cyw = Math.cos(yaw * PI / 180), syw = Math.sin(yaw * PI / 180), cp = Math.cos(pitch * PI / 180), sp = Math.sin(pitch * PI / 180);
    const nv = g.pos.length / 3, X = new Float32Array(nv), Y = new Float32Array(nv), Z = new Float32Array(nv), NX = new Float32Array(nv), NY = new Float32Array(nv), NZ = new Float32Array(nv);
    const rot = (x, y, z, o, k) => { const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw, y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; o[0][k] = x1; o[1][k] = y2; o[2][k] = z2; };
    for (let v = 0; v < nv; v++) { rot(g.pos[3 * v], g.pos[3 * v + 1], g.pos[3 * v + 2], [X, Y, Z], v); rot(g.nrm[3 * v], g.nrm[3 * v + 1], g.nrm[3 * v + 2], [NX, NY, NZ], v); }
    const sc = W * 0.46, ox = W / 2, oy = W / 2;
    const nt = g.idx.length / 3, ord = new Uint32Array(nt), dep = new Float32Array(nt);
    for (let t = 0; t < nt; t++) { ord[t] = t; dep[t] = Z[g.idx[3 * t]] + Z[g.idx[3 * t + 1]] + Z[g.idx[3 * t + 2]]; }
    ord.sort((a, b) => dep[a] - dep[b]);
    const L = [-0.45, 0.6, 0.65], ll = hyp(...L), Lx = L[0] / ll, Ly = L[1] / ll, Lz = L[2] / ll;
    for (let q = 0; q < nt; q++) {
      const t = ord[q], a = g.idx[3 * t], b = g.idx[3 * t + 1], c = g.idx[3 * t + 2];
      let nx = NX[a] + NX[b] + NX[c], ny = NY[a] + NY[b] + NY[c], nz = NZ[a] + NZ[b] + NZ[c];
      const nl = hyp(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      if (nz < -0.05) continue;   // facing away
      const df = Math.max(0, nx * Lx + ny * Ly + nz * Lz), hemi = 0.5 + 0.5 * ny, fr = Math.pow(1 - Math.max(0, nz), 2.4);
      const rz = 2 * (nx * Lx + ny * Ly + nz * Lz) * nz - Lz, spc = Math.pow(Math.max(0, rz), 28);
      const col = [0, 1, 2].map(k => { const v = (g.col[3 * a + k] + g.col[3 * b + k] + g.col[3 * c + k]) / 3; return clamp(v * (0.3 + 0.24 * hemi + 0.72 * df) + (v * 0.4 + 0.6) * fr * 0.3 + spc * 0.28, 0, 1); });
      const st = `rgb(${Math.round(col[0] * 255)},${Math.round(col[1] * 255)},${Math.round(col[2] * 255)})`;
      ctx.beginPath();
      ctx.moveTo(ox + X[a] * sc, oy - Y[a] * sc); ctx.lineTo(ox + X[b] * sc, oy - Y[b] * sc); ctx.lineTo(ox + X[c] * sc, oy - Y[c] * sc); ctx.closePath();
      ctx.fillStyle = st; ctx.strokeStyle = st; ctx.lineWidth = 0.7; ctx.fill(); ctx.stroke();
      if (q % 300 === 299) yield;
    }
    const out = document.createElement('canvas');
    out.width = out.height = px;
    const o2 = out.getContext('2d');
    o2.imageSmoothingEnabled = true; o2.imageSmoothingQuality = 'high';
    o2.drawImage(cv, 0, 0, px, px);
    return out;
  }
  // a picture now (finishing one under way), or drawn ahead until a time
  function drawPic(id, px, until) {
    const key = id + '@' + px;
    if (PIC[key] !== undefined) return true;
    const j = PJOB[key] || (PJOB[key] = picture(id, px));
    for (;;) { const r = j.next(); if (r.done) { PIC[key] = r.value; delete PJOB[key]; return true; } if (performance.now() > until) return false; }
  }
  function canvas(id, px = 64) { drawPic(id, px, Infinity); return PIC[id + '@' + px]; }
  function url(id, px = 64) {
    const key = id + '@' + px;
    if (URL[key] === undefined) { const c = canvas(id, px); try { URL[key] = c ? c.toDataURL() : ''; } catch (e) { URL[key] = ''; } }
    return URL[key];
  }
  // without waiting: the 64 px picture (a canvas, or its data URL) if it is drawn, else null ('') and the organ is
  // wanted next; a model (its mesh) likewise
  const pic = id => { const c = PIC[id + '@64']; if (c === undefined) { want(id); return null; } return c; };
  const picUrl = id => (pic(id) ? url(id, 64) : '');
  const mesh = id => (MESH[id] || (want(id), null));
  // version(): goes up as each model and picture is done (the panes redraw on it); driven: the engine steps the queue
  // itself every frame (the sets then leave it alone; in the harness they step it)
  return { ids, idOf, geo, lite, merged, shader, canvas, url, pic, picUrl, mesh, want, step, ready, built, has: id => !!MESH[id], version: () => ver,
    driven: false, names: BYNAME };
})();

// the harness's gallery of the models (harness.html?set=organs): not part of the story
SETS.organs = function (K) {
  const { THREE } = K;
  const set = K.newSet('organs');
  const ids = ORGAN3D.ids, n = ids.length, M = ORGAN3D.merged(ids), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(M.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(M.nrm, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(M.col, 3)); g.setAttribute('aSlot', new THREE.BufferAttribute(M.slot, 1)); g.setIndex(new THREE.BufferAttribute(M.idx, 1));
  const uP = ids.map((id, i) => new THREE.Vector4(((i % 6) - 2.5) * 0.36, (2 - Math.floor(i / 6)) * 0.36, 0, 0.15)), uQ = ids.map(() => new THREE.Vector4(1, 0, 0, 0));
  const sh = ORGAN3D.shader(n);
  const mat = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uP: { value: uP }, uQ: { value: uQ }, uTint: { value: new THREE.Color(0.1, 0.55, 0.3) } },
    vertexShader: sh.vertex, fragmentShader: sh.fragment, transparent: true });
  set.mats.push(mat);
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; set.group.add(mesh);
  // (organs_lite: the lighter copies the atlas's plates use, in the same places)
  const L = ORGAN3D.merged(ids, { lite: true }), gl = new THREE.BufferGeometry();
  gl.setAttribute('position', new THREE.BufferAttribute(L.pos, 3)); gl.setAttribute('normal', new THREE.BufferAttribute(L.nrm, 3));
  gl.setAttribute('aCol', new THREE.BufferAttribute(L.col, 3)); gl.setAttribute('aSlot', new THREE.BufferAttribute(L.slot, 1)); gl.setIndex(new THREE.BufferAttribute(L.idx, 1));
  const meshL = new THREE.Mesh(gl, mat); meshL.frustumCulled = false; meshL.visible = false; set.group.add(meshL);
  let pics = null;
  return Object.assign(set, {
    params: { organs_a: 1, organs_spin: 0, organs_tint: 0, organs_pics: 0, organs_lite: 0 },
    update(S, t) {
      meshL.visible = !!S.organs_lite; mesh.visible = !S.organs_lite;
      ids.forEach((id, i) => uQ[i].set(1, 0, (S.organs_spin || 0) * t * 0.6, S.organs_tint || 0));
      // organs_pics: the pictures the panels use, laid over the page (harness only)
      if (S.organs_pics && !pics && typeof document !== 'undefined') {
        pics = document.createElement('div');
        pics.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;background:#e9edf3;display:flex;flex-wrap:wrap;align-content:flex-start;gap:4px;padding:8px';
        for (const id of ids) {
          const d = document.createElement('div'), c = ORGAN3D.canvas(id, 64), c2 = ORGAN3D.canvas(id, 64);
          d.style.cssText = 'width:96px;text-align:center;font:11px sans-serif;color:#223';
          c.style.cssText = 'width:64px;height:64px;display:block;margin:0 auto';
          const dk = document.createElement('div'); dk.style.cssText = 'background:#0a1322;width:40px;height:40px;margin:2px auto;display:flex;align-items:center;justify-content:center';
          const im = document.createElement('img'); im.src = ORGAN3D.url(id, 64); im.width = im.height = 32; dk.appendChild(im);
          d.appendChild(c); d.appendChild(dk); d.appendChild(document.createTextNode(id)); pics.appendChild(d);
          void c2;
        }
        document.body.appendChild(pics);
      }
    },
    anchors: {}, labels: ids.map((id, i) => ({ text: [id, ''], at: [uP[i].x - 0.1, uP[i].y - 0.17, 0], cls: '' })),
    cam: { default: [0, 0, 3.4, 0, 0.0, 0] }, tris: M.tris, trisLite: L.tris,
  });
};
