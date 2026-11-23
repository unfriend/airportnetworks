// `liver`: an organ is a network too (the PET story). The authors' VR viewer also shows one organ as a network of
// small patches; this is an illustrative stand-in built from scratch (no patient data). A liver as one smooth surface
// (a signed distance field: the big right lobe, the smaller left lobe, the notches of the gallbladder and the round
// ligament, the gallbladder in its bed underneath, the falciform ligament on the front) is filled with about 3,000
// patches on a regular grid, each with a stand-in uptake (smooth noise, a cooler and a warmer patch, a little noise
// per patch as in any scan). Two patches a few grid steps apart are linked when one outshines the other by more than
// a threshold (a rule like the poster's for organs, applied here to patches of one organ, as an illustration): about 20,000 links. The best-connected 5 % stand out
// (each keeps its own colour, in an amber ring). Everything is built once at load; update only sets uniforms (and hides
// what is not drawn), so the picture follows the params and the time alone.
// Frame: x the patient's left (so the right lobe is on your left when you face it), y up, z forward; about 1.6 wide.
SETS.liver = function (K) {
  const { THREE, smooth, clamp, lerp, prog, v3 } = K;
  const set = K.newSet('liver');
  const R = K.rng(1606);
  const ORG = typeof PET_DATA !== 'undefined' && (PET_DATA.organs || []).find(o => o.id === 'liver');
  const COL = K.rgb(ORG ? ORG.col : '#f97316'), HUBC = K.rgb('#ffb020'), LINKC = K.rgb('#4c7cff'), FRONTC = K.rgb('#46d9ff');
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const sat = x => clamp(x, 0, 1);
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // ------------------------------------------------------------------ the shape
  // The outline seen from the front, as an anatomy atlas draws it: the dome over the right lobe, its rounded right
  // border, the sharp inferior border rising to the tip of the left lobe, with two notches in it: the gallbladder's
  // (its fundus shows below it) and the round ligament's, where the falciform ligament divides the lobes. A flag 1
  // marks the notches' points, left out of the smooth outline that sets each column's height.
  const OUT = [
    [0.785, 0.125], [0.72, 0.205], [0.49, 0.29], [0.31, 0.335], [0.15, 0.352], [0.03, 0.362],
    [-0.13, 0.41], [-0.33, 0.455], [-0.53, 0.458], [-0.70, 0.40], [-0.81, 0.28], [-0.865, 0.10],
    [-0.862, -0.10], [-0.805, -0.29], [-0.705, -0.425], [-0.575, -0.50], [-0.445, -0.508], [-0.34, -0.474],
    [-0.285, -0.448], [-0.238, -0.405, 1], [-0.19, -0.418], [-0.10, -0.372], [0.0, -0.315], [0.034, -0.294],
    [0.058, -0.24, 1], [0.083, -0.268], [0.18, -0.212], [0.33, -0.122], [0.50, -0.032], [0.64, 0.035], [0.74, 0.07],
  ];
  const loop = (pts, n) => new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], 0)), true, 'centripetal')
    .getSpacedPoints(n).slice(0, n).map(p => [p.x, p.y]);
  const POLY = loop(OUT, 200), SMOOTH = loop(OUT.filter(p => !p[2]), 200);
  // signed distance to a closed polygon, negative inside (after Inigo Quilez)
  function sdPoly(V, x, y) {
    let d = Infinity, s = 1;
    for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
      const ex = V[j][0] - V[i][0], ey = V[j][1] - V[i][1], wx = x - V[i][0], wy = y - V[i][1];
      const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1), bx = wx - ex * t, by = wy - ey * t;
      d = Math.min(d, bx * bx + by * by);
      const c1 = y >= V[i][1], c2 = y < V[j][1], c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  }
  // Depth: the front (diaphragmatic) surface bulges forward; the back sits deep behind the right lobe and shallow
  // behind the left. Over the lower part of each column the back (visceral) surface slopes forward to meet the front,
  // so the inferior border is a thin, sharp edge at the front; the top is a broad dome. Both surfaces round off
  // towards the outline (an ellipse's quarter over a width W: tight at the inferior border, wide at the dome).
  const zF0 = x => 0.30 - 0.17 * smooth((x + 0.1) / 0.9);
  const zB0 = x => -0.44 + 0.30 * smooth((x + 0.3) / 0.9);
  const G = 0.012, X0 = -0.96, Y0 = -0.62, NX = 156, NY = 99;
  const D2 = new Float32Array(NX * NY), FR = new Float32Array(NX * NY), BK = new Float32Array(NX * NY);
  // each column's extent in the smooth outline (held constant beyond the right border's middle and the left lobe's
  // tip, where a column's extent shrinks to nothing), lightly smoothed along x
  const ext = x => { let yb = Infinity, yt = -Infinity;
    for (let a = 0, b = SMOOTH.length - 1; a < SMOOTH.length; b = a++) {
      const p = SMOOTH[a], q = SMOOTH[b];
      if ((p[0] <= x) !== (q[0] <= x)) { const y = p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]); yb = Math.min(yb, y); yt = Math.max(yt, y); }
    }
    return [yb, yt]; };
  const EXT = [];
  for (let i = 0; i < NX; i++) { const e = [0, 0]; for (let w = -3; w <= 3; w++) { const r = ext(clamp(X0 + (i + w) * G, -0.74, 0.7)); e[0] += r[0] / 7; e[1] += r[1] / 7; } EXT.push(e); }
  for (let i = 0; i < NX; i++) {
    const x = X0 + i * G, yb = EXT[i][0], yt = EXT[i][1];
    const zf0 = zF0(x), zb0 = zB0(x), vs = lerp(0.4, 0.62, smooth((x + 0.55) / 0.6));
    for (let j = 0; j < NY; j++) {
      const y = Y0 + j * G, q = j * NX + i, d = sdPoly(POLY, x, y);
      const v = sat((y - yb) / (yt - yb));
      const zf = zf0 + 0.035 * (1 - (2 * v - 1) * (2 * v - 1)) * (1 - 0.6 * smooth((x + 0.1) / 0.8));
      const zb = lerp(zf - 0.085, zb0, smooth(v / vs)), zc = 0.5 * (zf + zb);
      const wf = lerp(0.045, 0.26, smooth(v / 0.55)), wb = lerp(0.09, 0.26, smooth(v / 0.55));
      const sf = sat(-d / wf), sb = sat(-d / wb), ef = Math.sqrt(sf * (2 - sf)), eb = Math.sqrt(sb * (2 - sb));
      D2[q] = d; FR[q] = zc + (zf - zc) * ef; BK[q] = zc - (zc - zb) * eb;
    }
  }
  // round cones (after Inigo Quilez's capsule) for the cuts and the gallbladder
  const capsule = (a, b, r1, r2) => ({ a, b, r1, r2, ba: v3.sub(b, a), l2: v3.dot(v3.sub(b, a), v3.sub(b, a)),
    lo: a.map((v, i) => Math.min(v, b[i])), hi: a.map((v, i) => Math.max(v, b[i])), rm: Math.max(r1, r2) });
  function capD(c, x, y, z) {
    const px = x - c.a[0], py = y - c.a[1], pz = z - c.a[2], t = clamp((px * c.ba[0] + py * c.ba[1] + pz * c.ba[2]) / c.l2, 0, 1);
    const dx = px - c.ba[0] * t, dy = py - c.ba[1] * t, dz = pz - c.ba[2] * t;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - lerp(c.r1, c.r2, t);
  }
  // the gallbladder lies in its bed under the right lobe, its fundus at the notch; the round ligament's fissure runs
  // back from its notch; the vena cava lies in a groove at the back
  const GB_F = [-0.238, -0.398, 0.165], GB_N = [-0.075, -0.2, -0.14];
  const GB = capsule(GB_F, GB_N, 0.072, 0.04);
  const TERES = capsule([0.058, -0.25, 0.3], [0.045, -0.1, -0.2], 0.02, 0.026);
  const IVC = capsule([-0.03, -0.7, -0.43], [-0.02, 0.7, -0.4], 0.075, 0.075);
  // the field: the outline and the two surfaces (bilinear in the table), then the cuts, which only add to the outside
  let cD = 0, cF = 0, cB = 0;
  function column(x, y) {
    const u = (x - X0) / G, w = (y - Y0) / G;
    if (u < 0 || w < 0 || u >= NX - 1 || w >= NY - 1) { cD = 1; cF = cB = 0; return; }
    const i = Math.floor(u), j = Math.floor(w), a = u - i, b = w - j, q = j * NX + i, a1 = 1 - a, b1 = 1 - b;
    cD = (D2[q] * a1 + D2[q + 1] * a) * b1 + (D2[q + NX] * a1 + D2[q + NX + 1] * a) * b;
    cF = (FR[q] * a1 + FR[q + 1] * a) * b1 + (FR[q + NX] * a1 + FR[q + NX + 1] * a) * b;
    cB = (BK[q] * a1 + BK[q + 1] * a) * b1 + (BK[q + NX] * a1 + BK[q + NX + 1] * a) * b;
  }
  // smax(f, s - capD, k) is exactly f where capD >= s + k - f; the distance to the segment's box less the largest
  // radius never exceeds capD, so far from a cut (most of the organ) it is skipped
  function carve(f, c, s, k, x, y, z) {
    const m = s + k - f + c.rm;
    if (m <= 0) return f;
    const dx = Math.max(c.lo[0] - x, 0, x - c.hi[0]), dy = Math.max(c.lo[1] - y, 0, y - c.hi[1]), dz = Math.max(c.lo[2] - z, 0, z - c.hi[2]);
    return dx * dx + dy * dy + dz * dz >= m * m ? f : smax(f, s - capD(c, x, y, z), k);
  }
  function cut(f, x, y, z) {
    if (f > 0.06) return f;
    f = carve(f, GB, 0.008, 0.035, x, y, z);
    f = carve(f, TERES, 0, 0.02, x, y, z);
    return carve(f, IVC, 0, 0.04, x, y, z);
  }
  function field(x, y, z) { column(x, y); return cut(Math.max(cD, z - cF, cB - z), x, y, z); }
  const grad = (p, e = 0.004) => [field(p[0] + e, p[1], p[2]) - field(p[0] - e, p[1], p[2]),
    field(p[0], p[1] + e, p[2]) - field(p[0], p[1] - e, p[2]), field(p[0], p[1], p[2] + e) - field(p[0], p[1], p[2] - e)].map(g => g / (2 * e));

  // the surface: surface nets on a grid, each vertex pulled onto the surface; smooth normals from the faces
  const surf = (function () {
    const h = 0.018, lo = [-0.93, -0.6, -0.52], n = [101, 64, 52], F = new Float32Array(n[0] * n[1] * n[2]);
    const id = (i, j, k) => (i * n[1] + j) * n[2] + k, OC = new Uint8Array(n[0] * n[1]);   // OC: columns all outside
    for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) {
      const x = lo[0] + i * h, y = lo[1] + j * h, o = id(i, j, 0);
      column(x, y);
      if (cD > 0.06) { F.fill(cD, o, o + n[2]); OC[i * n[1] + j] = 1; continue; }
      for (let k = 0; k < n[2]; k++) { const z = lo[2] + k * h; F[o + k] = cut(Math.max(cD, z - cF, cB - z), x, y, z); }
    }
    const VI = new Int32Array(n[0] * n[1] * n[2]).fill(-1), P = [], cv = new Float64Array(8);
    const EG = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7], si = n[1] * n[2], sj = n[2];
    const CO = [0, si, sj, si + sj, 1, si + 1, sj + 1, si + sj + 1];   // the corners' offsets (bit 0 i, bit 1 j, bit 2 k)
    const oc = (i, j) => OC[i * n[1] + j];
    for (let i = 0; i < n[0] - 1; i++) for (let j = 0; j < n[1] - 1; j++) {
      if (oc(i, j) & oc(i + 1, j) & oc(i, j + 1) & oc(i + 1, j + 1)) continue;
      for (let k = 0; k < n[2] - 1; k++) {
        const o = id(i, j, k);
        let neg = 0;
        for (let c = 0; c < 8; c++) { const v = cv[c] = F[o + CO[c]]; if (v < 0) neg++; }
        if (neg === 0 || neg === 8) continue;
        let sx = 0, sy = 0, sz = 0, ne = 0;
        for (let e = 0; e < 24; e += 2) {
          const a = EG[e], b = EG[e + 1];
          if ((cv[a] < 0) === (cv[b] < 0)) continue;
          const t = cv[a] / (cv[a] - cv[b]);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; ne++;
        }
        // one Newton step onto the surface, along the cell's own gradient
        const gx = (cv[1] - cv[0] + cv[3] - cv[2] + cv[5] - cv[4] + cv[7] - cv[6]) / (4 * h);
        const gy = (cv[2] - cv[0] + cv[3] - cv[1] + cv[6] - cv[4] + cv[7] - cv[5]) / (4 * h);
        const gz = (cv[4] - cv[0] + cv[5] - cv[1] + cv[6] - cv[2] + cv[7] - cv[3]) / (4 * h);
        const x = lo[0] + (i + sx / ne) * h, y = lo[1] + (j + sy / ne) * h, z = lo[2] + (k + sz / ne) * h;
        const st = clamp(field(x, y, z) / (gx * gx + gy * gy + gz * gz || 1), -0.5 * h, 0.5 * h);
        VI[o] = P.length / 3; P.push(x - gx * st, y - gy * st, z - gz * st);
      }
    }
    const I3 = [], quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I3.push(a, c, b, a, d, c); else I3.push(a, b, c, a, c, d); };
    for (let i = 0; i < n[0] - 1; i++) for (let j = 0; j < n[1] - 1; j++) {
      if (oc(i, j) & oc(i + 1, j) & oc(i, j + 1)) continue;
      for (let k = 0; k < n[2] - 1; k++) {
        const in0 = F[id(i, j, k)] < 0;
        if (j > 0 && k > 0 && in0 !== F[id(i + 1, j, k)] < 0) quad(VI[id(i, j - 1, k - 1)], VI[id(i, j, k - 1)], VI[id(i, j, k)], VI[id(i, j - 1, k)], !in0);
        if (i > 0 && k > 0 && in0 !== F[id(i, j + 1, k)] < 0) quad(VI[id(i - 1, j, k - 1)], VI[id(i - 1, j, k)], VI[id(i, j, k)], VI[id(i, j, k - 1)], !in0);
        if (i > 0 && j > 0 && in0 !== F[id(i, j, k + 1)] < 0) quad(VI[id(i - 1, j - 1, k)], VI[id(i, j - 1, k)], VI[id(i, j, k)], VI[id(i - 1, j, k)], !in0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    g.setIndex(I3);   // three.js picks 16-bit indices when they fit
    g.computeVertexNormals();
    g.computeBoundingBox();
    let vin = 0; for (let q = 0; q < F.length; q++) if (F[q] < 0) vin++;
    g.userData.vol = vin * h * h * h;   // the organ's volume, for the patches' first step
    return g;
  })();
  const BB = surf.boundingBox, C0 = [(BB.min.x + BB.max.x) / 2, (BB.min.y + BB.max.y) / 2, (BB.min.z + BB.max.z) / 2];
  const spin = new THREE.Group(), body = new THREE.Group();
  set.group.add(spin); spin.add(body);
  body.position.set(-C0[0], -C0[1], -C0[2]);   // centred on the origin; the spin turns it about its own middle

  // ------------------------------------------------------------------ the patches
  // a regular grid (the scan's voxels, coarsened) with its step chosen so that about 3,000 patches lie inside. The
  // organ lies obliquely in the body, so the grid is turned against the liver's own axes (and no row of patches
  // lines up with the usual views)
  const TARGET = 3000;
  const MR = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.27, 0.417, 1.374, 'YXZ')).elements;   // columns: the grid's axes
  const gp = (i, j, k, hp) => [(MR[0] * i + MR[4] * j + MR[8] * k) * hp, (MR[1] * i + MR[5] * j + MR[9] * k) * hp, (MR[2] * i + MR[6] * j + MR[10] * k) * hp];
  const lattice = hp => {
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let c = 0; c < 8; c++) {
      const p = [c & 1 ? BB.max.x : BB.min.x, c & 2 ? BB.max.y : BB.min.y, c & 4 ? BB.max.z : BB.min.z];
      for (let a = 0; a < 3; a++) { const q = (MR[4 * a] * p[0] + MR[4 * a + 1] * p[1] + MR[4 * a + 2] * p[2]) / hp; lo[a] = Math.min(lo[a], Math.floor(q) - 1); hi[a] = Math.max(hi[a], Math.ceil(q) + 1); }
    }
    const out = [], fv = [];
    for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
      const p = gp(i, j, k, hp), f = field(p[0], p[1], p[2]);
      if (f < -0.3 * hp) { out.push(i, j, k); fv.push(f); }
    }
    return { hp, lo, hi, cells: out, fv };
  };
  // the coarsest step that still leaves at least 3,000 inside (from the volume, then corrected by the count's cube
  // root; within 0.5 % above is enough); then the few nearest the surface go, so exactly 3,000 stay
  let LAT = null;
  { let hp = Math.cbrt(surf.userData.vol / TARGET);
    for (let it = 0; it < 12 && !(LAT && LAT.cells.length / 3 <= TARGET * 1.005); it++) {
      const L = lattice(hp), n = L.cells.length / 3;
      if (n >= TARGET && (!LAT || n < LAT.cells.length / 3)) LAT = L;
      hp *= n >= TARGET ? Math.cbrt(n / TARGET) * 0.9995 : Math.min(Math.cbrt(n / TARGET), 0.998);
    }
    while (!LAT) { hp *= 0.98; const L = lattice(hp); if (L.cells.length / 3 >= TARGET) LAT = L; }
    const keep = [...LAT.fv.keys()].sort((p, q) => LAT.fv[p] - LAT.fv[q]).slice(0, TARGET).sort((p, q) => p - q);
    LAT.cells = keep.flatMap(c => LAT.cells.slice(3 * c, 3 * c + 3)); }
  const HP = LAT.hp, N = LAT.cells.length / 3, PP = new Float32Array(3 * N);
  const DIMS = LAT.hi.map((v, c) => v - LAT.lo[c] + 1), IDX = new Int32Array(DIMS[0] * DIMS[1] * DIMS[2]).fill(-1);
  const lid = (i, j, k) => ((i - LAT.lo[0]) * DIMS[1] + (j - LAT.lo[1])) * DIMS[2] + (k - LAT.lo[2]);
  // each node is drawn somewhere inside its own grid cell, not at the grid point: one per cell keeps them evenly
  // spread, and no rows of nodes line up from any side. Near the surface the shift is halved (up to three times,
  // then none) until the node is as far inside as its grid point had to be
  for (let n = 0; n < N; n++) {
    const i = LAT.cells[3 * n], j = LAT.cells[3 * n + 1], k = LAT.cells[3 * n + 2];
    const di = 0.7 * (R() - 0.5), dj = 0.7 * (R() - 0.5), dk = 0.7 * (R() - 0.5);
    let p = null;
    for (let s = 1; s >= 0.1 && !p; s *= 0.5) { const q = gp(i + s * di, j + s * dj, k + s * dk, HP); if (field(q[0], q[1], q[2]) < -0.3 * HP) p = q; }
    PP.set(p || gp(i, j, k, HP), 3 * n); IDX[lid(i, j, k)] = n;
  }
  // stand-in uptake (log scale, 0 the liver's usual): smooth noise in three octaves, a warmer patch high in the right
  // lobe, a cooler one where the lobes meet, and a little noise per patch
  const WARM = [-0.47, 0.13, 0.02], COOL = [0.2, 0.08, 0.0];
  const WAVES = [];
  const RU = K.rng(2025);
  [[0.95, 0.07], [0.5, 0.045], [0.27, 0.024]].forEach(([lam, amp]) => { for (let w = 0; w < 5; w++) WAVES.push([K.unit(RU), 2 * Math.PI / lam, amp, RU() * 6.2832]); });
  const LU = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const p = [PP[3 * n], PP[3 * n + 1], PP[3 * n + 2]];
    let L = 0;
    for (const [d, k, a, ph] of WAVES) L += a * Math.sin(k * v3.dot(d, p) + ph);
    const dw = v3.dist(p, WARM), dc = v3.dist(p, COOL);
    L += 0.36 * Math.exp(-dw * dw / (2 * 0.15 * 0.15)) - 0.28 * Math.exp(-dc * dc / (2 * 0.13 * 0.13)) + 0.038 * K.gauss(RU);
    LU[n] = L;
  }
  // links: every pair within 2.45 grid steps whose uptake ratio exceeds the threshold, from the brighter to the
  // dimmer; the threshold is the round ratio (two decimals) that leaves about 20,000 links
  const OFF = [];
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) {
    const r2 = a * a + b * b + c * c;
    if (r2 > 0 && r2 <= 6 && (a > 0 || (a === 0 && (b > 0 || (b === 0 && c > 0))))) OFF.push([a, b, c]);
  }
  const PA = new Int32Array(N * OFF.length), PB = new Int32Array(N * OFF.length), PD = new Float32Array(N * OFF.length);
  let NP = 0;
  for (let n = 0; n < N; n++) {
    const i = LAT.cells[3 * n], j = LAT.cells[3 * n + 1], k = LAT.cells[3 * n + 2];
    for (let q = 0; q < OFF.length; q++) {
      const o = OFF[q], ii = i + o[0], jj = j + o[1], kk = k + o[2];
      if (ii > LAT.hi[0] || jj < LAT.lo[1] || jj > LAT.hi[1] || kk < LAT.lo[2] || kk > LAT.hi[2]) continue;
      const m = IDX[lid(ii, jj, kk)];
      if (m >= 0) { PA[NP] = n; PB[NP] = m; PD[NP++] = LU[n] - LU[m]; }
    }
  }
  const LINKS_WANTED = 20000, SD = new Float32Array(NP);
  for (let e = 0; e < NP; e++) SD[e] = Math.abs(PD[e]);
  SD.sort();
  const above = th => { const l = Math.log(th); let a = 0, b = NP; while (a < b) { const m = (a + b) >> 1; if (SD[m] <= l) a = m + 1; else b = m; } return NP - a; };
  const q0 = Math.exp(SD[Math.max(0, NP - LINKS_WANTED)]) * 100;
  const THETA = [Math.floor(q0) / 100, Math.ceil(q0) / 100].sort((a, b) => Math.abs(above(a) - LINKS_WANTED) - Math.abs(above(b) - LINKS_WANTED))[0], LT = Math.log(THETA);
  const EA = [], EB = [], EW = [];
  for (let e = 0; e < NP; e++) {
    const d = PD[e] < 0 ? -PD[e] : PD[e];
    if (d <= LT) continue;
    const hot = PD[e] > 0;
    EA.push(hot ? PA[e] : PB[e]); EB.push(hot ? PB[e] : PA[e]); EW.push(d - LT);
  }
  const NL = EA.length, DEG = new Int32Array(N);
  for (let e = 0; e < NL; e++) { DEG[EA[e]]++; DEG[EB[e]]++; }
  // the best connected: the top 5 % by number of links
  const NH = Math.round(0.05 * N), ORDER = [...Array(N).keys()].sort((a, b) => DEG[b] - DEG[a] || a - b), HUB = new Uint8Array(N);
  for (let r = 0; r < NH; r++) HUB[ORDER[r]] = 1;
  const wMax = EW.reduce((m, w) => Math.max(m, w), 0) || 1;
  // where the hubs crowd most (the anchor 'top'): the hub with the most hubs within 0.15
  let TOP = [0, 0, 0];
  { let best = -1;
    for (let r = 0; r < NH; r++) {
      const a = ORDER[r]; let c = 0;
      for (let s = 0; s < NH; s++) { const b = ORDER[s], dx = PP[3 * a] - PP[3 * b], dy = PP[3 * a + 1] - PP[3 * b + 1], dz = PP[3 * a + 2] - PP[3 * b + 2]; if (dx * dx + dy * dy + dz * dz < 0.0225) c++; }
      if (c > best) { best = c; TOP = [PP[3 * a], PP[3 * a + 1], PP[3 * a + 2]]; }
    } }
  // patches appear from the middle out (by distance from their centroid)
  const CEN = [0, 0, 0];
  for (let n = 0; n < N; n++) for (let c = 0; c < 3; c++) CEN[c] += PP[3 * n + c] / N;
  const RV = new Float32Array(N);
  { let m = 0; for (let n = 0; n < N; n++) { RV[n] = Math.hypot(PP[3 * n] - CEN[0], PP[3 * n + 1] - CEN[1], PP[3 * n + 2] - CEN[2]); m = Math.max(m, RV[n]); }
    for (let n = 0; n < N; n++) RV[n] /= m; }

  // ------------------------------------------------------------------ materials
  const U = { uGrow: { value: 1 }, uLinks: { value: 1 }, uTop: { value: 0 }, uHubC: { value: new THREE.Color(...HUBC) },
    uLinkC: { value: new THREE.Color(...LINKC) }, uFrontC: { value: new THREE.Color(...FRONTC) } };
  const LOOK = `
uniform float uA, uGrow, uLinks, uTop; uniform vec3 uHubC, uLinkC, uFrontC;
// hot iron, as the body set draws the scan: black, dark red, red, orange, yellow, white
vec3 hot(float x) { return vec3(pow(clamp(x * 2.0, 0.0, 1.0), 0.9), pow(clamp((x - 0.15) / 0.8, 0.0, 1.0), 1.5), clamp((x - 0.76) * 4.2, 0.0, 1.0) * 0.95); }
// brighter in front of the set's middle, darker behind
float depthCue(vec4 mv) { vec4 o = modelViewMatrix * vec4(${C0.map(v => v.toFixed(4)).join(', ')}, 1.0); float s = length(modelViewMatrix[0].xyz); return clamp(1.0 - (o.z - mv.z) / s * 0.75, 0.45, 1.3); }
`;
  const mat = (vs, fs, extra) => {
    const m = new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U),
      vertexShader: K.GLSL + LOOK + vs, fragmentShader: fs,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }, extra || {}));
    set.mats.push(m);
    return m;
  };
  // a glassy surface lit like an organ in a dark room: a glowing rim, a soft key light, faint contour bands
  const glass = (col, o) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uC: { value: new THREE.Color(...col) }, uK: { value: 1 }, uF: { value: o.face }, uR: { value: o.rim },
        uD: { value: o.dif }, uB: { value: o.band || 0 }, uY: { value: new THREE.Vector3(...(o.fade || [-9, -8, 1])) } },
      transparent: true, depthWrite: false, side: o.side || THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN, vV; varying float vY;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vY = position.y; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uA, uK, uF, uR, uD, uB; uniform vec3 uC, uY; varying vec3 vN, vV; varying float vY;
void main() {
  vec3 n = normalize(vN), v = normalize(vV); float nv = dot(n, v); n *= sign(nv);
  float r = pow(1.0 - abs(nv), 2.4);
  vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
  float dif = max(dot(n, L), 0.0), sp = pow(max(dot(reflect(-L, n), v), 0.0), 18.0);
  float bw = fwidth(vY * 18.0), band = uB * (1.0 - smoothstep(0.0, 1.5 * bw, abs(fract(vY * 18.0) - 0.5) - 0.5 + 1.5 * bw)) * (1.0 - r);
  float a = (uF + uR * r + uD * dif + band) * uA * uK * mix(1.0, uY.z, smoothstep(uY.x, uY.y, vY));   // uY: fades along local y
  gl_FragColor = vec4(uC * (0.6 + 0.6 * r) + vec3(1.0, 0.92, 0.85) * sp * 0.5, a + sp * 0.1 * uA * uK);
}`,
      extensions: { derivatives: true },
    });
    set.mats.push(m);
    return m;
  };

  // ------------------------------------------------------------------ the organ
  // its near side, and its far side fainter (drawn double sided at one strength, from below it looked hollow)
  const SHELL = { face: 0.025, rim: 0.5, dif: 0.12, band: 0.05 };
  const shellMat = glass(COL, Object.assign({ side: THREE.FrontSide }, SHELL)), backMat = glass(COL, Object.assign({ side: THREE.BackSide }, SHELL));
  const shell = new THREE.Mesh(surf, shellMat), back = new THREE.Mesh(surf, backMat);
  shell.renderOrder = back.renderOrder = 1;
  body.add(back, shell);
  // the gallbladder in its bed (bile green, faint): a pear from the fundus to the neck, and the cystic duct
  const gbMat = glass(K.rgb('#9ad66a'), { face: 0.03, rim: 0.45, dif: 0.08, fade: [0.02, 0.16, 0.3] });   // its body and neck, up under the liver, stay faint
  {
    const prof = [];
    for (let s = 0; s <= 24; s++) {
      const u = s / 24, r = u < 0.25 ? 0.074 * Math.sin(Math.acos(1 - u / 0.25)) : lerp(0.074, 0.036, smooth((u - 0.25) / 0.75));
      prof.push(new THREE.Vector2(Math.max(r, 0.0001), -0.074 + u * (v3.dist(GB_F, GB_N) + 0.074)));
    }
    prof.push(new THREE.Vector2(0.012, v3.dist(GB_F, GB_N) + 0.03), new THREE.Vector2(0.011, v3.dist(GB_F, GB_N) + 0.09), new THREE.Vector2(0.0001, v3.dist(GB_F, GB_N) + 0.092));
    const g = new THREE.LatheGeometry(prof, 20);
    const m = new THREE.Mesh(g, gbMat);
    m.position.set(...GB_F);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...v3.norm(v3.sub(GB_N, GB_F))));
    body.add(m);
  }
  // the falciform ligament: up the front from the round ligament's notch and over the dome, where it fades; traced on
  // the surface in a plane that leans a little to the right (the patient's right)
  const LIG = [];
  {
    const cx = y => 0.055 - 0.07 * sat((y + 0.24) / 0.6), C = [0, -0.02, -0.08];
    const onSurf = (dy, dz) => { let a = 0, b = 1.2;
      for (let it = 0; it < 30; it++) { const m = 0.5 * (a + b), y = C[1] + m * dy, z = C[2] + m * dz; if (field(cx(y), y, z) < 0) a = m; else b = m; }
      const y = C[1] + a * dy, z = C[2] + a * dz, p = [cx(y), y, z], g = v3.norm(grad(p)); return v3.add(p, v3.mul(g, 0.004)); };
    const t0 = Math.atan2(-0.24 - C[1], 0.26 - C[2]);
    for (let s = 0; s <= 36; s++) { const t = lerp(t0, 1.95, s / 36); LIG.push(onSurf(Math.sin(t), Math.cos(t))); }
  }
  const ligMat = glass(K.rgb('#ffd2a8'), { face: 0.07, rim: 0.4, dif: 0.12, fade: [0.28, 0.4, 0.1] });   // it fades over the dome
  body.add(new THREE.Mesh(K.tube(LIG, 0.0055, 120, 6), ligMat));

  // ------------------------------------------------------------------ the patches, drawn
  const ptGeo = new THREE.BufferGeometry();
  {
    const A = new Float32Array(4 * N);
    for (let n = 0; n < N; n++) { A[4 * n] = clamp(0.5 + 0.95 * LU[n], 0.16, 1); A[4 * n + 1] = RV[n]; A[4 * n + 2] = HUB[n]; A[4 * n + 3] = R(); }
    ptGeo.setAttribute('position', new THREE.BufferAttribute(PP, 3));
    ptGeo.setAttribute('aI', new THREE.BufferAttribute(A, 4));
    ptGeo.computeBoundingSphere();
  }
  const ptMat = mat(`
attribute vec4 aI;
uniform float uSz;
varying vec3 vC; varying float vA, vHub, vRing;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float g = uGrow * 1.1, ap = smoothstep(aI.y, aI.y + 0.05, g), fl = uGrow < 0.999 ? exp(-pow((g - aI.y - 0.035) / 0.045, 2.0)) : 0.0;
  float hub = aI.z * uTop, rest = uTop * (1.0 - aI.z), pulse = 0.75 + 0.25 * sin(uTime * 1.6 + aI.w * 6.2832);
  vec3 c = hot(aI.x) * (1.0 - 0.3 * uLinks) * (0.9 + 0.1 * sin(uTime * 1.1 + aI.w * 40.0));
  // with the hubs shown the rest turn grey and dim; a hub keeps its own colour (its uptake) and gets an amber ring
  c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), 0.7 * rest);
  c = mix(c, uFrontC * 0.7, fl * 0.85);   // the growing front: cyan (not white), so it never reads as the hottest tissue
  float br = mix(1.0, 0.28, rest) * (1.0 + 0.3 * hub) * (1.0 + 0.25 * fl);
  float sz = uSz * (1.0 + 0.6 * hub) * (1.0 - 0.3 * rest) * (1.0 + 0.5 * fl) * ap;
  // up close (as in a headset) points shrink with distance and never grow beyond about two degrees
  float sc = length(modelViewMatrix[0].xyz), dl = -mv.z / sc;
  gl_PointSize = min(pointPx(sz * clamp(dl / 1.4, 0.5, 1.0), mv), 0.035 * (1.0 + 0.6 * hub) * uPx * projectionMatrix[1][1] / sc);
  vC = c * br * depthCue(mv); vHub = hub; vRing = hub * pulse; vA = uA * ap;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform vec3 uHubC;
varying vec3 vC; varying float vA, vHub, vRing;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  // a hub's disc is larger: its own colour fills the inner part (as large as any patch), the ring the outer part
  float e = d * (1.0 + 0.6 * vHub), core = smoothstep(0.65, 0.1, e), halo = pow(max(1.0 - e, 0.0), 2.0);
  float ring = vRing * smoothstep(0.58, 0.72, d) * smoothstep(1.0, 0.86, d);
  gl_FragColor = vec4(vC * (0.65 + 0.5 * core) * (1.0 - ring) + uHubC * 1.2 * ring, vA * (core * 0.6 + halo * 0.35 + ring * 0.85));
}`);
  ptMat.uniforms.uSz = { value: HP * 0.62 };
  const pts = new THREE.Points(ptGeo, ptMat);
  pts.renderOrder = 3;
  body.add(pts);

  // ------------------------------------------------------------------ the links, drawn
  const lnGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(6 * NL), A = new Float32Array(8 * NL), B = new Float32Array(4 * NL);
    for (let e = 0; e < NL; e++) {
      const a = EA[e], b = EB[e], w = Math.sqrt(EW[e] / wMax), hub = HUB[a] | HUB[b], rv = Math.max(RV[a], RV[b]);
      const ord = 0.72 * rv + 0.28 * R(), ph = R();
      for (let s = 0; s < 2; s++) {
        const n = s ? b : a, v = 2 * e + s;
        pos[3 * v] = PP[3 * n]; pos[3 * v + 1] = PP[3 * n + 1]; pos[3 * v + 2] = PP[3 * n + 2];
        A[4 * v] = s; A[4 * v + 1] = w; A[4 * v + 2] = ord; A[4 * v + 3] = ph; B[2 * v] = rv; B[2 * v + 1] = hub;
      }
    }
    lnGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lnGeo.setAttribute('aL', new THREE.BufferAttribute(A, 4));
    lnGeo.setAttribute('aR', new THREE.BufferAttribute(B, 2));
    lnGeo.computeBoundingSphere();
  }
  const lnMat = mat(`
attribute vec4 aL; attribute vec2 aR;
varying vec3 vC; varying float vA, vS, vPh;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float hub = aR.y, ord = aL.z, ph = aL.w;
  float on = smoothstep(ord, ord + 0.06, uLinks * 1.06) * smoothstep(aR.x, aR.x + 0.05, uGrow * 1.1);
  float hl = hub * uTop;
  vec3 c = mix(uLinkC, vec3(0.5, 0.72, 1.0), aL.y * 0.4);
  c = mix(c, uHubC, hl * 0.9);
  float br = (0.35 + 0.65 * aL.y) * mix(1.0, 0.16, uTop * (1.0 - hub)) * (1.0 + 0.7 * hl);
  vC = c * br * depthCue(mv); vS = aL.x; vPh = ph; vA = uA * on;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // hidden: both ends share 'on', so the whole line goes
  // up close each line covers fewer others: the strong ones grow brighter, the weak ones step back
  float near = clamp((2.6 * length(modelViewMatrix[0].xyz) / -mv.z - 1.0) / 1.5, 0.0, 1.0);
  vA *= mix(1.0, mix(0.7, 1.6, aL.y), near);
}`, `
uniform float uTime;
varying vec3 vC; varying float vA, vS, vPh;
void main() {
  if (vA < 0.004) discard;
  float w = fract(vPh + uTime * 0.3) * 1.5 - 0.25, g = exp(-pow((vS - w) / 0.13, 2.0));
  gl_FragColor = vec4(vC * (1.0 + 1.6 * g), vA * (0.024 + 0.07 * g));
}`);
  const lns = new THREE.LineSegments(lnGeo, lnMat);
  lns.renderOrder = 2;
  body.add(lns);

  // ------------------------------------------------------------------ anchors, labels
  let ang = 0;
  // an anchor turns with the spin; it returns the same array each time (the engine copies it)
  const at = p => { const x = p[0] - C0[0], z = p[2] - C0[2], o = [x, p[1] - C0[1], z];
    return () => { const c = Math.cos(ang), s = Math.sin(ang); o[0] = x * c + z * s; o[2] = -x * s + z * c; return o; }; };
  // a point on the surface: from the inside point p outwards along d
  const surfAt = (p, d) => { let a = 0, b = 1; d = v3.norm(d);
    for (let it = 0; it < 30; it++) { const m = 0.5 * (a + b), q = v3.add(p, v3.mul(d, m)); if (field(q[0], q[1], q[2]) < 0) a = m; else b = m; }
    return v3.add(p, v3.mul(d, a)); };
  const anchors = {
    centre: [0, 0, 0],                                               // the middle of the organ (of its box)
    core: at(CEN),                                                   // the middle of its patches, where they start to grow
    top: at(TOP),
    right: at(surfAt([-0.45, 0.05, -0.05], [-0.55, 0.6, 0.6])),   // the right lobe, its upper outer front
    left: at(surfAt([0.5, 0.1, 0.0], [0.3, 0.25, 1])),            // the left lobe
    dome: at(surfAt([-0.4, 0.1, -0.08], [0, 1, 0.15])),           // the top of the dome
    notch: at(v3.add(GB_F, [0, -0.08, 0.02])),                     // the gallbladder's notch, its fundus below the edge
    teres: at(LIG[0]),                                               // the round ligament's notch
    warm: at(WARM), cool: at(COOL),
    web: at(surfAt(WARM, [0.1, -0.2, 1])),                          // where the links crowd, on the front
  };
  const labels = [
    { text: [fmt(N) + ' patches', ''], at: 'right', alpha: S => prog(S.liver_grow, 0.55, 0.85) * (1 - prog(S.liver_links, 0.1, 0.35)) },
    { text: ['Links:', 'uptake ratio above the threshold'], at: 'web', cls: 'cyn', alpha: S => prog(S.liver_links, 0.35, 0.65) * prog(S.liver_grow, 0.7, 0.95) * (1 - prog(S.liver_top, 0.1, 0.4)) },
    { text: ['Best connected', 'the top 5 % of patches'], at: 'top', cls: 'amb', alpha: S => prog(S.liver_top, 0.45, 0.8) * prog(S.liver_grow, 0.7, 0.95) },
  ];
  const API = Object.freeze({ patches: N, links: NL, theta: THETA, hubs: NH, step: Math.round(HP * 1e5) / 1e5, pairs: NP,
    meanLinks: Math.round(20 * NL / N) / 10, maxLinks: DEG[ORDER[0]] });
  const num = (v, d) => (v === undefined ? d : v);
  return Object.assign(set, {
    params: { liver_a: 1, liver_grow: 1, liver_links: 1, liver_top: 0, liver_spin: 0 },
    update(S) {
      ang = num(S.liver_spin, 0) * Math.PI * 2;
      spin.rotation.y = ang;
      const g = sat(num(S.liver_grow, 1)), l = sat(num(S.liver_links, 1)), tp = sat(num(S.liver_top, 0));
      U.uGrow.value = g; U.uLinks.value = l; U.uTop.value = tp;
      // the organ steps back for the links and the hubs, and stands out a little while it is empty
      const k = (1 - 0.35 * l - 0.25 * tp) * (1 + 0.4 * (1 - g));
      shellMat.uniforms.uK.value = k; backMat.uniforms.uK.value = 0.45 * k;
      gbMat.uniforms.uK.value = ligMat.uniforms.uK.value = 1 - 0.5 * l - 0.3 * tp;
      pts.visible = g > 0.001; lns.visible = g > 0.001 && l > 0.001;   // nothing to draw: no draw call
    },
    anchors,
    labels,
    cam: {
      default: [-16, 9, 3.4, 0, -0.02, 0],   // (back a little: the right lobe reached the screen's edge)
      front: [0, 3, 3.1, 0, 0, 0],
      close: [-34, 12, 1.7, ...at(WARM)()],   // for liver_spin 0
      below: [-12, -52, 3.1, 0, -0.05, 0],
      side: [-90, 6, 3.0, 0, 0, 0],
    },
    controls: [{ key: 'view', label: 'View', options: [['patches', 'Patches'], ['links', 'Links'], ['hubs', 'Hubs']] }],
    explore(c) { return { liver_grow: 1, liver_links: c.view === 'patches' ? 0 : 1, liver_top: c.view === 'hubs' ? 1 : 0, liver_spin: 0 }; },
    api() { return API; },
  });
};
