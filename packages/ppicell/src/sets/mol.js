// Real structures (PPI_STRUCTS, from the Protein Data Bank) as the sets draw them, shared by the crowd, the walls, the
// lenses and the sites. molStructure: one ball per amino acid (or DNA nucleotide), each part its own instanced draw.
// molCoarse: a structure simplified to its few coarse balls (gen_structs.py's COARSE), merged into one geometry for
// instancing. molSpan: a structure's length in angstroms along its longest axis (sizes relative to each other).
// the principal axis of points [x, y, z, ...] (by power iteration on the covariance)
function molAxis(v3, P) {
  const n = P.length / 3, m = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) m[j] += P[3 * i + j] / n;
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[3 * a + b] += (P[3 * i + a] - m[a]) * (P[3 * i + b] - m[b]);
  let v = [1, 0.3, 0.2];
  for (let k = 0; k < 40; k++) v = v3.norm([0, 1, 2].map(a => C[3 * a] * v[0] + C[3 * a + 1] * v[1] + C[3 * a + 2] * v[2]));
  return v;
}
// all of a structure's points, angstroms (the parts named only, if given)
const molPts = (key, only) => Float32Array.from(PPI_STRUCTS[key].parts.filter(p => !only || only.includes(p.name + '/' + p.chain)).flatMap(p => p.xyz.map(x => x / 10)));
// its length along its own longest axis, angstroms
function molSpan(K, key, only) {
  const P = molPts(key, only), ax = molAxis(K.v3, P);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < P.length; i += 3) { const d = P[i] * ax[0] + P[i + 1] * ax[1] + P[i + 2] * ax[2]; lo = Math.min(lo, d); hi = Math.max(hi, d); }
  return hi - lo;
}
let molBall = null;
// a structure's points turned so its longest axis (or that of the part named) lies along x, then scaled so it spans
// width; one ball per amino acid or nucleotide, each part its own instanced draw (each ball its colour), so a part can be
// placed or shown apart (the two STAT3s, the DNA); detail: the balls' (1 by default; 0 for a large structure drawn small,
// a quarter of the triangles). Returns { g, parts: { 'NAME/CHAIN': { g, home, n, pts, dom } }, cite, s }
function molStructure(K, set, key, width, colOf, only, along, detail) {
  const { THREE, v3 } = K;
  molBall = molBall || [0, 1].map(d => new THREE.IcosahedronGeometry(1, d));
  const S = PPI_STRUCTS[key], parts = S.parts.filter(p => !only || only.includes(p.name + '/' + p.chain));
  const ax = molAxis(v3, Float32Array.from(parts.filter(p => !along || p.name === along).flatMap(p => p.xyz)));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...ax), new THREE.Vector3(1, 0, 0)), V = new THREE.Vector3();
  let lo = Infinity, hi = -Infinity;
  const all = [];
  for (const p of parts) for (let i = 0; i < p.res.length; i++) {
    V.set(p.xyz[3 * i] / 10, p.xyz[3 * i + 1] / 10, p.xyz[3 * i + 2] / 10).applyQuaternion(q);
    lo = Math.min(lo, V.x); hi = Math.max(hi, V.x); all.push({ p, i, v: V.toArray() });
  }
  const s = width / (hi - lo), g = new THREE.Group();
  const out = {}, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), col = new THREE.Color();
  for (const p of parts) {
    const mine = all.filter(o => o.p === p), r = (p.kind === 'dna' ? 3.0 : 2.4) * s;
    const cen = mine.reduce((c, o) => v3.add(c, v3.mul(o.v, s / mine.length)), [0, 0, 0]);
    const im = new THREE.InstancedMesh(molBall[detail === 0 ? 0 : 1], K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 })), mine.length);
    mine.forEach((o, k) => {
      M.compose(new THREE.Vector3(...v3.sub(v3.mul(o.v, s), cen)), Q, new THREE.Vector3(r, r, r)); im.setMatrixAt(k, M);
      im.setColorAt(k, col.setRGB(...colOf(p, p.dom[o.i], o.i)));
    });
    const pg = new THREE.Group(); pg.add(im); pg.position.set(...cen); g.add(pg);
    out[p.name + '/' + p.chain] = { g: pg, home: cen, n: mine.length, pts: mine.map(o => v3.sub(v3.mul(o.v, s), cen)), dom: mine.map(o => p.dom[o.i]), res: mine.map(o => p.res[o.i]) };
  }
  return { g, parts: out, cite: S.cite, s };
}
// a structure simplified: its coarse balls (each an icosahedron of the given detail, 0 by default) merged into one
// geometry, centred, scaled so the structure spans width along its longest axis (molSpan); userData.r is the reach of
// its farthest ball from the centre (for packing without overlaps), userData.balls their count
function molCoarse(K, key, width, detail) {
  const { THREE } = K, B = PPI_STRUCTS[key].coarse, s = width / molSpan(K, key);
  const geos = B.map(b => {
    const g = new THREE.IcosahedronGeometry(b[3] / 10 * s, detail || 0), P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i += 3) { const l = Math.hypot(P[i], P[i + 1], P[i + 2]) || 1; N[i] = P[i] / l; N[i + 1] = P[i + 1] / l; N[i + 2] = P[i + 2] / l; }   // (smooth: a ball, not facets)
    return g.translate(b[0] / 10 * s, b[1] / 10 * s, b[2] / 10 * s);
  });
  const geo = K.merge(geos);
  geo.userData = { r: Math.max(...B.map(b => (Math.hypot(b[0], b[1], b[2]) + b[3]) / 10 * s)), balls: B.length };
  return geo;
}
