// The stress test's one set: the cell map story's model cell (stories/spatial.js: the same membrane, nucleus, ER, Golgi,
// mitochondria, small organelles and cytoskeleton, drawn with the same shaders), filled with made-up proteins and a
// made-up database of links, to find a method for putting an interactome back into the cell: a link can happen only
// where its two proteins share a space (a body of water bounded by membranes), so each database link is judged
// possible, possible through a gate, or impossible. Nothing here is data: everything comes from seeded random draws.
// The frame rate can be read at each size (the shell's read-out: a double press of B or Y): one Points draw for the
// copies, one LineSegments draw for the links shown (about 2,000 at most), and the see-through organelle skins.
SETS.cell = function (K) {
  const { THREE, clamp, v3 } = K;
  const set = K.newSet('cell');
  const mul = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const perp = d => v3.norm(Math.abs(d[0]) < 0.9 ? v3.cross(d, [1, 0, 0]) : v3.cross(d, [0, 1, 0]));

  // ------------------------------------------------------------ the cell (the cell map's CELL, its numbers kept)
  const CELL = (() => {
    const rng = mul(17);
    const pm = [1.0, 0.8, 0.94], nuc = { c: [-0.12, 0.0, -0.05], r: 0.34 }, nucl = { c: [-0.035, 0.075, 0.025], r: 0.095 };
    const gdir = v3.norm([0.55, 0.3, 0.62]), er = { r: [0.41, 0.455, 0.5] };
    const golgi = { r: [0.575, 0.605, 0.635, 0.665, 0.695], ang: [0.36, 0.34, 0.31, 0.28, 0.24] };
    const centro = v3.add(nuc.c, v3.mul(gdir, 0.53));
    const eScale = p => Math.sqrt((p[0] / pm[0]) ** 2 + (p[1] / pm[1]) ** 2 + (p[2] / pm[2]) ** 2);
    const erMask = (d, k) => {
      const a = Math.sin(5.3 * d[0] + 1.7 * k + 0.3) * Math.sin(4.1 * d[1] - 0.9 * k + 1.1) * Math.sin(4.7 * d[2] + 2.3 * k + 0.5);
      const b = Math.sin(9.1 * d[0] - 6.3 * d[2] + 3.1 * k) * Math.sin(7.7 * d[1] + 5.2 * d[0] - 1.3 * k);
      return a + 0.45 * b + 0.18 - Math.max(0, v3.dot(d, gdir) - 0.72) * 6;
    };
    const spots = [];
    const okSpot = (p, r) => {
      if (eScale(p) > 0.9 - r * 1.2) return false;
      const dg = v3.sub(p, nuc.c), dn = v3.len(dg);
      if (dn < 0.56 + r) return false;
      if (Math.acos(clamp(v3.dot(v3.norm(dg), gdir), -1, 1)) < 0.5 && dn < 0.8) return false;
      return spots.every(s => v3.len(v3.sub(s.c, p)) > s.r + r + 0.05);
    };
    const place = (n, r, rmin, rmax) => {
      const out = [];
      for (let t = 0; t < 4000 && out.length < n; t++) {
        const z = rng() * 2 - 1, th = rng() * Math.PI * 2, s = Math.sqrt(1 - z * z), rr = rmin + (rmax - rmin) * rng();
        const p = [s * Math.cos(th) * rr * pm[0], z * rr * pm[1], s * Math.sin(th) * rr * pm[2]];
        if (okSpot(p, r)) { const o = { c: p, r }; spots.push(o); out.push(o); }
      }
      return out;
    };
    const mitos = place(7, 0.12, 0.55, 0.86).map(o => {
      const radial = v3.norm(o.c), t = perp(radial), b = v3.cross(radial, t), a = rng() * Math.PI;
      return { c: o.c, axis: v3.norm(v3.add(v3.mul(t, Math.cos(a)), v3.mul(b, Math.sin(a)))), a: 0.115 + 0.03 * rng(), b: 0.036 };
    });
    const lysos = place(7, 0.05, 0.5, 0.78).map(o => ({ c: o.c, r: 0.044 + 0.01 * rng() }));
    const endos = place(8, 0.045, 0.62, 0.92).map(o => ({ c: o.c, r: 0.038 + 0.01 * rng() }));
    const peroxs = place(5, 0.035, 0.5, 0.88).map(o => ({ c: o.c, r: 0.03 }));
    const mts = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 34; i++) {
      const z = 1 - 2 * (i + 0.5) / 34, s = Math.sqrt(1 - z * z), th = ga * i * 1.3 + 1.1;
      const d = v3.norm([Math.cos(th) * s, z * 0.8, Math.sin(th) * s]);
      if (v3.dot(d, v3.norm(v3.sub(nuc.c, centro))) > 0.55) continue;
      const pts = [centro.slice()];
      let p = centro.slice(), dir = d;
      for (let k = 0; k < 40; k++) {
        p = v3.add(p, v3.mul(dir, 0.045));
        const off = v3.sub(p, nuc.c), dn = v3.len(off);
        if (dn < 0.53) p = v3.add(nuc.c, v3.mul(off, 0.53 / dn));
        dir = v3.norm(v3.add(dir, v3.mul(v3.norm(v3.sub(p, nuc.c)), 0.12)));
        pts.push(p.slice());
        if (eScale(p) > 0.93) break;
      }
      if (pts.length > 4) mts.push(pts);
    }
    return { pm, nuc, nucl, gdir, er, golgi, centro, erMask, eScale, mitos, lysos, endos, peroxs, mts };
  })();

  // ------------------------------------------------------------ the organelle skins (the cell map's shellMaterial)
  const shellMats = [];
  function shellMaterial(rgb, a0, a1, kind) {
    const defs = kind === 'er' ? '#define ER\n' : kind === 'mito' ? '#define MITO\n' : '', own = !!kind;
    const m = new THREE.ShaderMaterial({
      uniforms: { uL: { value: new THREE.Vector3(0, 0, 1) }, uA: set.uA, uK: { value: 1 }, uG: { value: new THREE.Vector3(...CELL.gdir) } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: (own ? 'attribute vec3 aO; attribute float aP; varying float vP;\n' : '') + `varying vec3 vN, vW, vO;
void main() { vO = ${own ? 'aO' : 'position'};${own ? ' vP = aP;' : ''} vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: defs + (own ? 'varying float vP;\n' : '') + `uniform vec3 uL, uG; uniform float uA, uK; varying vec3 vN, vW, vO;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float rim = pow(1.0 - abs(dot(n, v)), 2.5);
  float lit = 0.75 + 0.25 * max(dot(n, uL), 0.0);
  float a = ${a0} + ${a1} * rim;
  vec3 col = vec3(${rgb}) * lit;
#ifdef ER
  vec3 d = normalize(vO);
  float k = vP;
  float m = sin(5.3 * d.x + 1.7 * k + 0.3) * sin(4.1 * d.y - 0.9 * k + 1.1) * sin(4.7 * d.z + 2.3 * k + 0.5)
    + 0.45 * sin(9.1 * d.x - 6.3 * d.z + 3.1 * k) * sin(7.7 * d.y + 5.2 * d.x - 1.3 * k) + 0.18 - max(0.0, dot(d, uG) - 0.72) * 6.0;
  float sheet = smoothstep(0.0, 0.06, m);
  if (sheet < 0.01) discard;
  float edge = 1.0 - smoothstep(0.06, 0.24, m);
  a = (a + 0.07 * edge) * sheet;
  col += vec3(0.2, 0.45, 0.3) * edge * 0.35;
#endif
#ifdef MITO
  float x = vO.x / vP;
  float crista = 1.0 - smoothstep(0.0, 0.16, abs(fract(x * 4.5 + 0.5) - 0.5) * 2.0);
  a += 0.16 * crista * (1.0 - abs(x));
  col += vec3(0.4, 0.15, 0.1) * crista;
#endif
  gl_FragColor = vec4(col, a * uA * uK);
}`,
    });
    set.mats.push(m); shellMats.push(m);
    return m;
  }
  // copies of geometries merged into one (each vertex keeps its own coordinates aO and its copy's number aP, as the cell's)
  function mergeCopies(list) {
    let nv = 0, ni = 0;
    for (const o of list) { nv += o.geo.attributes.position.count; ni += o.geo.index.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), O = new Float32Array(nv * 3), A = new Float32Array(nv), I = new Uint32Array(ni);
    const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
    let ov = 0, oi = 0;
    for (const o of list) {
      const g = o.geo, gp = g.attributes.position, gn = g.attributes.normal;
      m.compose(new THREE.Vector3(...(o.pos || [0, 0, 0])), o.quat || new THREE.Quaternion(), o.scale || new THREE.Vector3(1, 1, 1));
      nm.getNormalMatrix(m);
      for (let i = 0; i < gp.count; i++) {
        v.fromBufferAttribute(gp, i); O.set([v.x, v.y, v.z], 3 * (ov + i)); v.applyMatrix4(m); P.set([v.x, v.y, v.z], 3 * (ov + i));
        v.fromBufferAttribute(gn, i).applyMatrix3(nm).normalize(); N.set([v.x, v.y, v.z], 3 * (ov + i));
        A[ov + i] = o.k || 0;
      }
      for (let i = 0; i < g.index.count; i++) I[oi + i] = g.index.array[i] + ov;
      ov += gp.count; oi += g.index.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('aO', new THREE.BufferAttribute(O, 3)); g.setAttribute('aP', new THREE.BufferAttribute(A, 1));
    g.setIndex(new THREE.BufferAttribute(I, 1));
    return g;
  }
  const shells = new THREE.Group();
  set.group.add(shells);
  const addMesh = (g, mat, order) => { const o = new THREE.Mesh(g, mat); o.renderOrder = order; shells.add(o); return o; };
  {
    const pm = new THREE.SphereGeometry(1, 128, 80); pm.scale(...CELL.pm); pm.computeVertexNormals();
    addMesh(pm, shellMaterial('0.55, 0.78, 1.0', 0.03, 0.42), 1);
    const nucP = new THREE.Vector3(...CELL.nuc.c);
    addMesh(new THREE.SphereGeometry(CELL.nuc.r, 96, 64), shellMaterial('0.66, 0.54, 1.0', 0.045, 0.5), 1).position.copy(nucP);
    addMesh(new THREE.SphereGeometry(CELL.nucl.r, 48, 32), shellMaterial('0.95, 0.6, 1.0', 0.12, 0.45), 2).position.set(...CELL.nucl.c);
    addMesh(mergeCopies(CELL.er.r.map((r, k) => ({ geo: new THREE.SphereGeometry(r, 80, 56), pos: CELL.nuc.c, k }))), shellMaterial('0.35, 0.95, 0.6', 0.06, 0.3, 'er'), 3);
    const gq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...CELL.gdir));
    addMesh(mergeCopies(CELL.golgi.r.map((r, k) => ({ geo: new THREE.SphereGeometry(r, 64, 10, 0, Math.PI * 2, 0, CELL.golgi.ang[k]), pos: CELL.nuc.c, quat: gq }))),
      shellMaterial('1.0, 0.78, 0.3', 0.14, 0.45), 4);
    addMesh(mergeCopies(CELL.mitos.map(o => {
      const g = new THREE.SphereGeometry(1, 40, 20); g.scale(o.a, o.b, o.b); g.computeVertexNormals();
      return { geo: g, pos: o.c, quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(...o.axis)), k: o.a };
    })), shellMaterial('1.0, 0.45, 0.35', 0.08, 0.45, 'mito'), 5);
    const ball = new THREE.SphereGeometry(1, 28, 18);
    const balls = (list, rgb, a0, a1, order) => addMesh(mergeCopies(list.map(o => ({ geo: ball, pos: o.c, scale: new THREE.Vector3(o.r, o.r, o.r) }))), shellMaterial(rgb, a0, a1), order);
    balls(CELL.lysos, '1.0, 0.4, 0.78', 0.14, 0.5, 6);
    balls(CELL.endos, '0.2, 0.88, 0.82', 0.08, 0.5, 7);
    balls(CELL.peroxs, '0.78, 0.95, 0.3', 0.16, 0.5, 8);
    // the cytoskeleton: microtubules from the centrosome and an actin web under the membrane
    const seg = [], ar = mul(41);
    CELL.mts.forEach(m => { for (let k = 0; k < m.length - 1; k++) seg.push(...m[k], ...m[k + 1]); });
    for (let i = 0; i < 520; i++) {
      const z = ar() * 2 - 1, t = ar() * Math.PI * 2, s = Math.sqrt(1 - z * z), p = [s * Math.cos(t), z, s * Math.sin(t)];
      const q = v3.mul(p, (0.935 + 0.02 * ar()) / CELL.eScale(p)), dir = perp(v3.norm(q)), b2 = v3.cross(v3.norm(q), dir), a = ar() * Math.PI, L = 0.03 + 0.05 * ar();
      const w = v3.add(v3.mul(dir, Math.cos(a)), v3.mul(b2, Math.sin(a)));
      seg.push(...v3.sub(q, v3.mul(w, L / 2)), ...v3.add(q, v3.mul(w, L / 2)));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3));
    const mat = new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uK: { value: 1 } }, transparent: true, depthWrite: false,
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA, uK; void main() { gl_FragColor = vec4(0.75, 0.82, 0.9, 0.16 * uA * uK); }' });
    set.mats.push(mat); shellMats.push(mat);
    const ls = new THREE.LineSegments(g, mat); ls.renderOrder = 3; shells.add(ls);
  }

  // ------------------------------------------------------------ places, spaces and faces
  // The cell map's thirteen places and their colours. Two proteins can bind only where they share a space: a body of
  // water bounded by membranes (the cytosol, the nucleoplasm, each organelle's lumen, outside the cell). A soluble protein
  // is in its place's own space; a membrane protein sits in its place's membrane and faces its inner side, its outer side
  // or both (a receptor in the plasma membrane faces outside and the cytosol).
  const PLACE_COL = [[0.55, 0.78, 1.0], [0.66, 0.54, 1.0], [0.95, 0.6, 1.0], [0.35, 0.95, 0.6], [1.0, 0.78, 0.3], [1.0, 0.45, 0.35],
    [1.0, 0.4, 0.78], [0.2, 0.88, 0.82], [0.78, 0.95, 0.3], [0.6, 0.9, 1.0], [0.75, 0.6, 1.0], [0.9, 0.9, 0.95], [0.45, 0.7, 1.0]];
  const PLACE_NAME = ['Cytosol', 'Nucleoplasm', 'Nucleolus', 'ER', 'Golgi', 'Mitochondria', 'Lysosomes', 'Endosomes', 'Peroxisomes',
    'Plasma membrane', 'Nuclear envelope', 'Cytoskeleton', 'Vesicles'];
  // how many proteins each place gets, roughly as in the Human Protein Atlas (cytosol and nucleoplasm the largest)
  const SHARE = [0.2, 0.22, 0.04, 0.07, 0.06, 0.08, 0.02, 0.03, 0.01, 0.1, 0.04, 0.06, 0.07];
  const SPACE_NAME = ['the cytosol', 'the nucleoplasm', 'the ER lumen', 'the Golgi lumen', 'the mitochondrial matrix', 'the lysosome lumen',
    'the endosome lumen', 'the peroxisome lumen', 'outside the cell'];
  // each place's inner space (its soluble proteins' and its membrane's inner side) and outer space (its membrane's other
  // side; -1: no membrane), and the share of its proteins in its membrane (the vesicles' coats and the cytoskeleton count
  // as cytosolic)
  const INNER = [0, 1, 1, 2, 3, 4, 5, 6, 7, 0, 1, 0, 0];
  const OUTER = [-1, -1, -1, 0, 0, 0, 0, 0, 0, 8, 0, -1, -1];
  const MEMB = [0, 0, 0, 0.5, 0.5, 0.4, 0.5, 0.5, 0.5, 1, 1, 0, 0];
  // a membrane protein's face: 1 its inner side, 2 its outer side, 3 both; per place, the chances of 1 and 2 (3 the rest)
  const FACE_P = { 9: [0.35, 0.25], 10: [0.5, 0.5] }, FACE_DEF = [0.25, 0.4];
  const FACE_OF = (pl, r) => { const [a, b] = FACE_P[pl] || FACE_DEF, x = r(); return x < a ? 1 : x < a + b ? 2 : 3; };
  const spacesOf = (pl, f) => (f === 0 ? 1 << INNER[pl] : (f & 1 ? 1 << INNER[pl] : 0) | (f & 2 ? 1 << OUTER[pl] : 0));
  // gates: two spaces one known crossing apart (nuclear pores; import into the ER, mitochondria and peroxisomes; vesicles
  // along the secretory and endocytic ways)
  const GATES = [[0, 1, 'nuclear pores'], [0, 2, 'the ER\'s translocon'], [0, 4, 'mitochondrial import'], [0, 7, 'peroxisomal import'],
    [2, 3, 'vesicles'], [3, 8, 'secretion'], [3, 5, 'vesicles'], [6, 5, 'vesicles'], [8, 6, 'endocytosis']];
  // contact sites: the pairs of organelles whose membranes touch (ER with the plasma membrane, mitochondria, lysosomes,
  // endosomes, peroxisomes and the Golgi; the nuclear envelope's outer membrane is the ER's; mitochondria with lysosomes):
  // only there do two membrane proteins of different places meet across the cytosol
  const CONTACT = new Set([[3, 9], [3, 5], [3, 6], [3, 7], [3, 8], [3, 4], [3, 10], [5, 6]].flatMap(([a, b]) => [a * 13 + b, b * 13 + a]));
  const GATE = new Map();
  GATES.forEach(([a, b, w]) => { GATE.set(a * 9 + b, w); GATE.set(b * 9 + a, w); });
  const gateOf = (ma, mb) => { for (let a = 0; a < 9; a++) if (ma & (1 << a)) for (let b = 0; b < 9; b++) if (mb & (1 << b) && GATE.has(a * 9 + b)) return GATE.get(a * 9 + b); return null; };
  const inBall = (r, c, R) => v3.add(c, v3.mul(K.unit(r), R * Math.cbrt(r())));
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  // the organelles that come as many: each one its own space (no link joins two of them); a copy is in one of them
  const MANY = { 5: CELL.mitos, 6: CELL.lysos, 7: CELL.endos, 8: CELL.peroxs };
  // a copy's spot, and its container (a centre and radius a link through a gate passes over; radius 0: none); inst: which
  // of MANY's organelles
  const spot = (pl, f, r, inst) => {
    const N = CELL.nuc, sgn = r() < 0.5 ? -1 : 1, off = f === 1 ? -0.005 : f === 2 ? 0.005 : 0, sheet = f === 0 ? 0 : (f === 1 ? 0.002 : f === 2 ? 0.007 : 0.004) * sgn;
    switch (pl) {
      case 0: { for (;;) { const p = inBall(r, [0, 0, 0], 0.9), q = [p[0] * CELL.pm[0], p[1] * CELL.pm[1], p[2] * CELL.pm[2]]; if (v3.len(v3.sub(q, N.c)) > 0.56 && CELL.eScale(q) < 0.9) return [q, [0, 0, 0], 0]; } }
      case 1: return [inBall(r, N.c, N.r * 0.9), N.c, N.r];
      case 2: return [inBall(r, CELL.nucl.c, CELL.nucl.r * 0.9), N.c, N.r];
      case 3: { for (;;) { const k = Math.floor(r() * 3), d = K.unit(r); if (CELL.erMask(d, k) > 0.05) return [v3.add(N.c, v3.mul(d, CELL.er.r[k] + sheet)), N.c, CELL.er.r[k]]; } }
      case 4: { for (;;) { const k = Math.floor(r() * 5), d = K.unit(r); if (Math.acos(clamp(v3.dot(d, CELL.gdir), -1, 1)) < CELL.golgi.ang[k]) return [v3.add(N.c, v3.mul(d, CELL.golgi.r[k] + sheet)), N.c, CELL.golgi.r[k]]; } }
      case 5: {
        const m = CELL.mitos[inst], p1 = perp(m.axis), p2 = v3.cross(m.axis, p1);
        if (f === 0) { const x = (r() * 2 - 1) * m.a * 0.85, o = v3.mul(p1, m.b * 0.6 * r()); return [v3.add(v3.add(m.c, v3.mul(m.axis, x)), o), m.c, m.b * 1.4]; }
        const u = K.unit(r), q = v3.add(m.c, v3.add(v3.mul(m.axis, m.a * u[0]), v3.add(v3.mul(p1, m.b * u[1]), v3.mul(p2, m.b * u[2]))));
        const nrm = v3.norm(v3.add(v3.mul(m.axis, u[0] / m.a), v3.add(v3.mul(p1, u[1] / m.b), v3.mul(p2, u[2] / m.b))));
        return [v3.add(q, v3.mul(nrm, off)), m.c, m.b * 1.4];
      }
      case 6: case 7: case 8: {
        const o = MANY[pl][inst];
        return [f === 0 ? inBall(r, o.c, o.r * 0.85) : v3.add(o.c, v3.mul(K.unit(r), o.r + off)), o.c, o.r];
      }
      case 9: { const d = K.unit(r); return [v3.mul(d, (f === 1 ? 0.972 : f === 2 ? 0.998 : 0.985) / CELL.eScale(d)), [0, 0, 0], 0]; }
      case 10: { const d = K.unit(r); return [v3.add(N.c, v3.mul(d, N.r * (f === 1 ? 0.985 : 1.015))), N.c, N.r]; }
      case 11: { const m = pick(r, CELL.mts), k = Math.floor(r() * (m.length - 1)); return [v3.add(v3.lerp(m[k], m[k + 1], r()), v3.mul(K.unit(r), 0.01)), [0, 0, 0], 0]; }
      default: { const d = K.unit(r); return [v3.mul(d, (0.8 + 0.1 * r()) / CELL.eScale(d)), [0, 0, 0], 0]; }
    }
  };
  const cumShare = SHARE.map((s, i) => SHARE.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const drawPlace = r => { const x = r() * cumShare[12]; let i = 0; while (cumShare[i] < x) i++; return i; };

  // ------------------------------------------------------------ materials (the cell map's nodeMaterial and routeMaterial)
  const GLSL_COMMON = `
uniform float uScen[8];
float presence(float sc, float md) {
  if (sc < 0.5) return 1.0;
  float s = uScen[int(sc - 0.5)];
  return (md > 1.5 && md < 2.5) ? s : 1.0 - s;
}
vec3 degRamp(float x) {
  vec3 c0 = vec3(0.12, 0.34, 1.0), c1 = vec3(0.16, 0.86, 1.0), c2 = vec3(1.0, 0.72, 0.18), c3 = vec3(1.0, 0.42, 0.12);
  if (x < 0.45) return mix(c0, c1, x / 0.45);
  if (x < 0.78) return mix(c1, c2, (x - 0.45) / 0.33);
  return mix(c2, c3, (x - 0.78) / 0.22);
}
vec3 multiCol(float m) {
  return m < 1.5 ? vec3(0.42, 0.50, 0.62) : m < 2.5 ? vec3(1.0, 0.74, 0.22) : vec3(0.22, 0.90, 0.78);
}
`;
  const scen = new Array(8).fill(0);
  const NU = { uReveal: { value: 1 }, uWPlace: { value: 1 }, uWDeg: { value: 0 }, uWMulti: { value: 0 }, uFocus: { value: 0 }, uPathProg: { value: 0 },
    uIso: { value: -1 }, uSel: { value: -1 }, uAlpha: { value: 1 }, uScale: { value: 1 }, uPx: { value: 1 }, uProxOn: { value: 0 },
    uProx: { value: new THREE.Vector4(0, 0, 0, 0) }, uPal: { value: PLACE_COL.map(c => new THREE.Vector3(...c)) }, uScen: { value: scen } };
  const nodeMat = new THREE.ShaderMaterial({
    uniforms: NU, transparent: true, depthWrite: false,
    vertexShader: GLSL_COMMON + `
attribute float aIdx, aProt, aRand, aPlace, aDeg, aMulti, aScen, aMode, aFocus, aSize;
uniform float uReveal, uWPlace, uWDeg, uWMulti, uFocus, uPathProg, uIso, uSel, uAlpha, uScale, uPx, uProxOn;
uniform vec4 uProx;
uniform vec3 uPal[13];
varying vec3 vCol; varying float vA, vRing;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vec3 col = vec3(0.86, 0.92, 1.0);
  col = mix(col, uPal[int(aPlace + 0.5)], uWPlace);
  col = mix(col, degRamp(aDeg), uWDeg);
  col = mix(col, multiCol(aMulti), uWMulti);
  float pres = presence(aScen, aMode);
  float gone = step(2.5, aMode) * (1.0 - pres);
  col = mix(col, vec3(1.0, 0.25, 0.18), clamp(gone * 4.0, 0.0, 1.0));
  float onPath = step(0.5, aFocus);
  float reached = onPath * clamp((uPathProg - aFocus + 1.35) / 0.35, 0.0, 1.0);
  float bright = mix(1.0, 0.24 + reached * 1.4, uFocus);
  float inProx = 1.0 - smoothstep(uProx.w * 0.94, uProx.w, distance(position, uProx.xyz));
  bright *= mix(1.0, 0.22 + 1.3 * inProx, uProxOn);
  float iso = uIso < -0.5 ? 1.0 : (abs(aPlace - uIso) < 0.5 ? 1.0 : 0.12);
  float sel = 1.0 - step(0.5, abs(aProt - uSel));
  float reveal = clamp((uReveal * 1.12 - aRand) / 0.12, 0.0, 1.0);
  vCol = col * bright; vRing = sel;
  vA = reveal * iso * uAlpha * clamp(pres + gone, 0.0, 1.0) * smoothstep(0.0, 0.15, pres);
  float att = uPx > 0.0 ? uPx * projectionMatrix[1][1] / max(-mv.z, 0.05) : 1.0;
  gl_PointSize = max(aSize * uScale * att * (1.0 + sel * 1.2) * (1.0 + 0.6 * uFocus * reached) * (1.0 + 0.5 * uProxOn * inProx), uPx > 0.0 ? 1.6 : 0.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vCol; varying float vA, vRing;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.30, d);
  float ring = vRing * smoothstep(0.5, 0.44, d) * (1.0 - smoothstep(0.38, 0.30, d));
  gl_FragColor = vec4(vCol + vec3(0.5, 0.9, 1.0) * ring * 1.5, vA * max(core, ring) * uA);
}`,
  });
  nodeMat.uniforms.uA = set.uA;
  set.mats.push(nodeMat);
  const RU = { uReveal: { value: 1 }, uAlpha: { value: 0.55 },   // (0.55: the cell's links at full strength)
    uWPlace: { value: 1 }, uIso: { value: -1 }, uFocus: { value: 0 }, uProxOn: { value: 0 },
    uBase: { value: new THREE.Vector3(0.45, 0.7, 1.0) }, uScen: { value: scen }, uA: set.uA };
  const routeMat = new THREE.ShaderMaterial({
    uniforms: RU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL_COMMON + `
attribute float aT, aRv, aPlA, aPlB, aScA, aMdA, aScB, aMdB;
attribute vec3 aCol;
uniform float uReveal, uAlpha, uWPlace, uIso, uFocus, uProxOn;
uniform vec3 uBase;
varying vec3 vCol; varying float vA;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float g = clamp((uReveal - aRv * 0.75) / 0.25, 0.0, 1.0);
  float vis = step(0.0001, g) * step(aT, g + 0.0005);
  vec3 col = mix(uBase, aCol, uWPlace);
  float pa = presence(aScA, aMdA), pb = presence(aScB, aMdB);
  float restA = (aScA > 0.5 && (aMdA < 1.5 || aMdA > 2.5)) ? 1.0 - pa : 0.0;
  float restB = (aScB > 0.5 && (aMdB < 1.5 || aMdB > 2.5)) ? 1.0 - pb : 0.0;
  col = mix(col, vec3(1.0, 0.2, 0.14), clamp(max(restA, restB) * 3.0, 0.0, 1.0));
  float iso = uIso < -0.5 ? 1.0 : ((abs(aPlA - uIso) < 0.5 || abs(aPlB - uIso) < 0.5) ? 1.0 : 0.05);
  vCol = col;
  vA = vis * uAlpha * pa * pb * iso * (1.0 - 0.75 * uFocus) * (1.0 - 0.6 * uProxOn);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vCol; varying float vA;
void main() { gl_FragColor = vec4(vCol, vA * uA); }`,
  });
  set.mats.push(routeMat);


  // ------------------------------------------------------------ the network: the truth, and the database's view of it
  // The truth (made up here, so known): each protein has its locations (a place, and a face if in a membrane), and every
  // real link joins two locations that share a space. The database sees proteins and places, not cleanly: artefacts
  // (pairs that never meet, as a two-hybrid screen or a broken-open cell can give) and missing locations (a place left
  // out of a protein's list; one is always kept). Each database link is judged from the lists alone, by the membranes
  // between its two proteins: possible (a shared space), through a gate (one known crossing), impossible (more, or no
  // gate). The truth says what each judgement really was.
  // Where it is drawn: a dot stands for a protein where it meets others. Each listed location has its own dot (in one
  // of the many mitochondria, lysosomes, endosomes or peroxisomes); a possible link is drawn where it happens: inside one
  // of those organelles (the partner gets a dot there too: a protein of the mitochondria is in all of them), or, across
  // two places that share a space (a cytosolic protein and a membrane facing the cytosol), beside the fixed partner,
  // where the free one gets a dot of its own. So no link joins two mitochondria, and a link to a membrane is short.
  const CLS_COL = [null, [1.0, 0.7, 0.2], [1.0, 0.25, 0.2]];
  const flagMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 0.9 } }, transparent: true, depthWrite: false,
    vertexShader: 'attribute vec3 aCol; varying vec3 vC; void main() { vC = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA, uK; varying vec3 vC; void main() { gl_FragColor = vec4(vC, uK * uA); }',
  });
  set.mats.push(flagMat);
  const NET = { flags: null, extra: null, n: 0, e: 0, art: -1, miss: -1, show: -1, budget: 0, locs: 0, nDots: 0, nMain: 0, drawn: 0, pieces: 0, ms: 0, dots: null, routes: null, fk: '' };
  // the dots: one list, the background's first (NET.nMain of them, drawn as NET.dots), then any a pick adds (NET.extra)
  const D = { pos: [], loc: [], cC: [], cR: [], keys: [], key: new Map() };
  const dotAdd = (key, loc, p, C, R) => { const i = D.loc.length; D.pos.push(...p); D.loc.push(loc); D.cC.push(...C); D.cR.push(R); D.keys.push(key); D.key.set(key, i); return i; };
  const dotPos = i => D.pos.slice(3 * i, 3 * i + 3);
  // a location's dot in organelle inst (its own one when inst is its own)
  function dotIn(loc, inst) {
    const key = loc + '|' + inst, k = D.key.get(key);
    if (k !== undefined) return k;
    const [q, C, R] = spot(NET.lPlace[loc], NET.lFace[loc], mul(31 * loc + 7 * inst + 1), inst);
    return dotAdd(key, loc, q, C, R);
  }
  const dotOf = loc => dotIn(loc, NET.lInst[loc]);
  // a free location's dot beside a fixed dot: on the side of the fixed one's membrane where the free one's space is
  function dotBeside(loc, at) {
    const key = loc + '|b' + at, k = D.key.get(key);
    if (k !== undefined) return k;
    const r = mul(97 * loc + at + 3), p = dotPos(at), C = D.cC.slice(3 * at, 3 * at + 3), fl = D.loc[at], pl = NET.lPlace[fl];
    let out = D.cR[at] > 0 || pl === 9 ? v3.norm(v3.sub(p, C)) : K.unit(r);
    // (the free one in the fixed one's inner space: inwards; else outwards)
    if (OUTER[pl] >= 0 && !(NET.lSp[loc] & (1 << OUTER[pl]))) out = v3.mul(out, -1);
    const q = v3.add(v3.add(p, v3.mul(out, 0.014)), v3.mul(K.unit(r), 0.006));
    return dotAdd(key, loc, q, [0, 0, 0], 0);
  }
  // a membrane location's dot at the point of its own membrane nearest a dot (a contact site: the two as close as their
  // organelles let them be)
  function dotToward(loc, at) {
    const key = loc + '|t' + at, k = D.key.get(key);
    if (k !== undefined) return k;
    const own = dotOf(loc), C = D.cC.slice(3 * own, 3 * own + 3), R = D.cR[own], tp = dotPos(at), pl = NET.lPlace[loc], f = NET.lFace[loc];
    const s = f === 1 ? 0.985 : f === 2 ? 1.015 : 1, d = v3.norm(v3.sub(tp, C));
    const q = pl === 9 ? v3.mul(d, 0.985 * s / CELL.eScale(d)) : R > 0 ? v3.add(C, v3.mul(d, R * s)) : dotPos(own);
    return dotAdd(key, loc, q, C, R);
  }
  // where a link is drawn: its two dots
  function siteOf(k) {
    const L = NET.L, a = L.a[k], b = L.b[k];
    if (L.cls[k]) return [dotOf(a), dotOf(b)];
    const pa = NET.lPlace[a], pb = NET.lPlace[b];
    if (pa === pb) return MANY[pa] ? [dotOf(a), dotIn(b, NET.lInst[a])] : [dotOf(a), dotOf(b)];
    // across two places: the soluble one is free and goes beside the other (two in membranes, a contact site: as they are)
    const fa = NET.lFace[a] === 0, fb = NET.lFace[b] === 0;
    if (fa === fb && !fa) return [dotOf(a), dotToward(b, dotOf(a))];
    if (fa && fb) return [dotBeside(a, dotOf(b)), dotOf(b)];   // (two soluble ones sharing a space: the nucleolus and the nucleoplasm, the cytosol and its coats)
    return fa ? [dotBeside(a, dotOf(b)), dotOf(b)] : [dotOf(a), dotBeside(b, dotOf(a))];
  }
  // a link's points: two dots; a link through a gate passes over the inner dot's container, as near as it gets
  function linkPts(k, out) {
    const [da, db] = siteOf(k), pa = dotPos(da), pb = dotPos(db);
    if (NET.L.cls[k] !== 1) { out.push(pa, pb); return; }
    const inner = (D.cR[da] > 0 && !(NET.lSp[D.loc[da]] & 1)) || D.cR[db] === 0 ? da : db, other = inner === da ? pb : pa, C = D.cC.slice(3 * inner, 3 * inner + 3);
    const gp = D.cR[inner] > 0 ? v3.add(C, v3.mul(v3.norm(v3.sub(other, C)), D.cR[inner])) : v3.lerp(pa, pb, 0.5);
    const ctl = v3.sub(v3.mul(gp, 2), v3.lerp(pa, pb, 0.5)), S = 8;
    const q = t => { const u = 1 - t; return [0, 1, 2].map(j => u * u * pa[j] + 2 * u * t * ctl[j] + t * t * pb[j]); };
    for (let s = 0; s < S; s++) out.push(q(s / S), q((s + 1) / S));
  }
  const linkCol = k => (NET.L.cls[k] ? CLS_COL[NET.L.cls[k]] : v3.lerp(PLACE_COL[NET.lPlace[NET.L.a[k]]], PLACE_COL[NET.lPlace[NET.L.b[k]]], 0.5));
  // links as line segments with the cell's route attributes (the focus and flag materials read only position and aCol)
  function linesGeo(list, dashes) {
    const segs = [], col = [], plA = [], plB = [], dash = [];
    for (const k of list) {
      const n0 = segs.length, c = linkCol(k);
      linkPts(k, segs);
      for (let j = n0; j < segs.length; j++) { col.push(c); plA.push(NET.lPlace[NET.L.a[k]]); plB.push(NET.lPlace[NET.L.b[k]]); dash.push(0); }
    }
    for (const [da, db] of dashes || []) {
      const pa = dotPos(da), pb = dotPos(db), d = v3.len(v3.sub(pb, pa)) * 70;
      segs.push(pa, pb); col.push([1, 0.88, 0.62], [1, 0.88, 0.62]); plA.push(0, 0); plB.push(0, 0); dash.push(d, d);
    }
    const V = segs.length, g = new THREE.BufferGeometry(), P = new Float32Array(V * 3), C = new Float32Array(V * 3), T = new Float32Array(V);
    segs.forEach((p, i) => { P.set(p, 3 * i); C.set(col[i], 3 * i); T[i] = i % 2; });
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(C, 3));
    g.setAttribute('aT', new THREE.BufferAttribute(T, 1)); g.setAttribute('aRv', new THREE.BufferAttribute(new Float32Array(V), 1));
    g.setAttribute('aDash', new THREE.BufferAttribute(new Float32Array(dash), 1));
    g.setAttribute('aPlA', new THREE.BufferAttribute(new Float32Array(plA), 1)); g.setAttribute('aPlB', new THREE.BufferAttribute(new Float32Array(plB), 1));
    for (const k of ['aScA', 'aMdA', 'aScB', 'aMdB']) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(V), 1));
    return { g, pieces: V / 2 };
  }
  // dots i0 .. i1 as a Points geometry with the cell's ten attributes
  function dotsGeo(i0, i1) {
    const ND = i1 - i0, pg = new THREE.BufferGeometry(), f = () => new Float32Array(ND), lmax = Math.log1p(NET.maxDeg);
    const at = { aIdx: f(), aProt: f(), aRand: f(), aPlace: f(), aDeg: f(), aMulti: f(), aScen: f(), aMode: f(), aFocus: f(), aSize: f() };
    const r = mul(i0 + 11);
    for (let k = 0; k < ND; k++) {
      const loc = D.loc[i0 + k], p = NET.lProt[loc], dg = NET.degP[p];
      at.aIdx[k] = i0 + k; at.aProt[k] = p; at.aRand[k] = r(); at.aPlace[k] = NET.lPlace[loc];
      at.aDeg[k] = Math.log1p(dg) / lmax; at.aMulti[k] = NET.listed[p].length; at.aSize[k] = 3.0 + 5.0 * Math.sqrt(dg / NET.maxDeg);
    }
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(D.pos.slice(3 * i0, 3 * i1)), 3));
    for (const [k, a] of Object.entries(at)) pg.setAttribute(k, new THREE.BufferAttribute(a, 1));
    return pg;
  }
  // share n among groups by the square root of their sizes; a group smaller than its share gives the rest to the others
  function share(sizes, n) {
    const take = sizes.map(() => 0), open = new Set(sizes.map((s, k) => k).filter(k => sizes[k]));
    let left = n;
    for (let changed = true; changed && open.size;) {
      changed = false;
      const w = [...open].reduce((s, k) => s + Math.sqrt(sizes[k]), 0);
      for (const k of [...open]) if (sizes[k] <= left * Math.sqrt(sizes[k]) / w) { take[k] = sizes[k]; left -= take[k]; open.delete(k); changed = true; }
      if (!changed) for (const k of open) take[k] = Math.floor(left * Math.sqrt(sizes[k]) / w);
    }
    return take;
  }
  const drop = o => { if (o) { set.group.remove(o); o.geometry.dispose(); } return null; };
  function build(n, e, art, miss, show, budget) {
    const t0 = performance.now();
    NET.dots = drop(NET.dots); NET.routes = drop(NET.routes); NET.flags = drop(NET.flags); NET.extra = drop(NET.extra);
    if (FO.mesh) FO.mesh = drop(FO.mesh);
    D.pos = []; D.loc = []; D.cC = []; D.cR = []; D.keys = []; D.key = new Map();
    const r = mul(1000 + n);
    // proteins and their locations: places as in the cell map, a face for each in a membrane, one organelle of MANY's
    const lProt = [], lPlace = [], lFace = [], lSp = [], lInst = [], protLocs = [];
    for (let p = 0; p < n; p++) {
      const k = r() < 0.1 ? 3 : r() < 0.3 ? 2 : 1, own = [];
      protLocs.push([]);
      for (let j = 0; j < k; j++) {
        let pl = drawPlace(r);
        for (let tries = 0; own.includes(pl) && tries < 8; tries++) pl = drawPlace(r);
        if (own.includes(pl)) continue;
        own.push(pl);
        const f = r() < MEMB[pl] ? FACE_OF(pl, r) : 0, c = lProt.length;
        lProt.push(p); lPlace.push(pl); lFace.push(f); lSp.push(spacesOf(pl, f)); lInst.push(MANY[pl] ? Math.floor(r() * MANY[pl].length) : 0);
        protLocs[p].push(c);
      }
    }
    const NL = lProt.length;
    // the database's lists: each place of a protein left out with chance miss (one always kept)
    const rm = mul(77 + n), seen = new Uint8Array(NL);
    for (const cs of protLocs) {
      cs.forEach(c => { seen[c] = rm() >= miss ? 1 : 0; });
      if (!cs.some(c => seen[c])) seen[cs[Math.floor(rm() * cs.length)]] = 1;
    }
    const listed = protLocs.map(cs => cs.filter(c => seen[c]));
    // the true links: ends drawn with weights that fall off with rank (a few hubs), the second end in a space the first
    // one touches
    const wt = new Float64Array(NL);
    for (let c = 0; c < NL; c++) wt[c] = Math.pow(1 + Math.floor(r() * NL), -0.75);
    const cumOf = list => { const a = new Float64Array(list.length); let s = 0; list.forEach((c, i) => { s += wt[c]; a[i] = s; }); return a; };
    const all = [...Array(NL).keys()], cumAll = cumOf(all), bySp = Array.from({ length: 9 }, () => []);
    for (let c = 0; c < NL; c++) for (let s = 0; s < 9; s++) if (lSp[c] & (1 << s)) bySp[s].push(c);
    const cumSp = bySp.map(cumOf), re = mul(5000 + e), ra = mul(9000 + e);
    const draw = (cum, list) => { const x = re() * cum[cum.length - 1]; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; } return list ? list[lo] : lo; };
    const pu = new Int32Array(e), pv = new Int32Array(e), kind = new Uint8Array(e), degP = new Float32Array(n);
    for (let i = 0; i < e; i++) {
      const u = draw(cumAll), sps = [];
      for (let s = 0; s < 9; s++) if (lSp[u] & (1 << s)) sps.push(s);
      const s = sps[Math.floor(re() * sps.length)], from = () => (bySp[s].length > 1 ? draw(cumSp[s], bySp[s]) : draw(cumAll));
      let v = from();
      // (two membrane proteins of different places meet only at a contact site)
      const bad = v2 => lProt[v2] === lProt[u] || (lFace[u] && lFace[v2] && lPlace[u] !== lPlace[v2] && !CONTACT.has(lPlace[u] * 13 + lPlace[v2]));
      for (let tries = 0; bad(v) && tries < 12; tries++) v = from();
      const w = draw(cumAll);   // (an artefact's other end: anyone; whether it is one, its own stream)
      if (ra() < art && lProt[w] !== lProt[u]) { v = w; kind[i] = 1; }
      pu[i] = lProt[u]; pv[i] = lProt[v]; degP[pu[i]]++; degP[pv[i]]++;
    }
    // each database link judged from the lists: the closest pair of listed locations
    const L = { pu, pv, kind, a: new Int32Array(e), b: new Int32Array(e), cls: new Uint8Array(e), score: new Float32Array(e) };
    let maxDeg = 1;
    for (let p = 0; p < n; p++) maxDeg = Math.max(maxDeg, degP[p]);
    const rs = mul(7 + e), lmax2 = Math.log1p(maxDeg * maxDeg);
    for (let i = 0; i < e; i++) {
      let best = 3, ba = -1, bb = -1;
      for (const a of listed[pu[i]]) for (const b of listed[pv[i]]) {
        // (two membrane proteins of different places share the cytosol but meet only at a contact site)
        const fixed = lFace[a] && lFace[b] && lPlace[a] !== lPlace[b] && !CONTACT.has(lPlace[a] * 13 + lPlace[b]);
        const g = lSp[a] & lSp[b] && !fixed ? 0 : gateOf(lSp[a], lSp[b]) && !fixed ? 1 : 2;
        if (g < best) { best = g; ba = a; bb = b; }
      }
      L.a[i] = ba; L.b[i] = bb; L.cls[i] = best;
      L.score[i] = 0.6 * Math.log1p(degP[pu[i]] * degP[pv[i]]) / lmax2 + 0.4 * rs();
    }
    const tally = [0, 0, 0], arts = [0, 0, 0];
    for (let i = 0; i < e; i++) { tally[L.cls[i]]++; if (kind[i]) arts[L.cls[i]]++; }
    Object.assign(NET, { lProt, lPlace, lFace, lSp, lInst, protLocs, seen, listed, L, degP, maxDeg, tally, arts, fk: '' });
    // the dots: every listed location's own, then the ones the background's links add
    for (let c = 0; c < NL; c++) if (seen[c]) dotOf(c);
    const nOwn = D.loc.length;
    // the background: the most important links of the kinds on show, budget at most, shared between the kinds and the
    // possible ones between the places (both by the square root of their counts)
    const groups = [[], [], []];
    for (let i = 0; i < e; i++) if (L.cls[i] <= show) groups[L.cls[i]].push(i);
    groups.forEach(g => g.sort((x, y) => L.score[y] - L.score[x]));
    const tk = share(groups.map(g => g.length), budget), byPl = PLACE_COL.map(() => []);
    for (const i of groups[0]) byPl[lPlace[L.a[i]]].push(i);
    const tp = share(byPl.map(g => g.length), tk[0]), list = [];
    byPl.forEach((g, k) => list.push(...g.slice(0, tp[k])));
    const flagged = [...groups[1].slice(0, tk[1]), ...groups[2].slice(0, tk[2])];
    const rg = linesGeo(list), fg = flagged.length ? linesGeo(flagged) : null;   // (their dots are added here)
    NET.nMain = D.loc.length;
    NET.dots = new THREE.Points(dotsGeo(0, NET.nMain), nodeMat); NET.dots.renderOrder = 5; NET.dots.frustumCulled = false;
    NET.routes = new THREE.LineSegments(rg.g, routeMat); NET.routes.renderOrder = 4; NET.routes.frustumCulled = false;
    set.group.add(NET.dots, NET.routes);
    // (links through a gate and impossible ones in a draw of their own, at full strength: under the pale cytosol's they
    // would not show)
    if (fg) { NET.flags = new THREE.LineSegments(fg.g, flagMat); NET.flags.renderOrder = 6; NET.flags.frustumCulled = false; set.group.add(NET.flags); }
    Object.assign(NET, { n, e, art, miss, show, budget, locs: NL, nOwn, drawn: list.length + flagged.length, pieces: rg.pieces + (fg ? fg.pieces : 0), ms: Math.round(performance.now() - t0) });
    if (set.onBuild) set.onBuild();
  }

  // ------------------------------------------------------------ a pick: a protein or a place, and all its links
  // A protein: every database link of it, in its colour (possible in its places' colours, through a gate amber,
  // impossible red), and dotted ties between its listed locations' own dots; its partners stay bright, the rest dims (the
  // cell's aFocus and uSel), and the background fades. A place: its possible links inside it, the most important first,
  // up to FOCUS_MAX, every other place dimmed (the cell's uIso). Dots the pick needs beyond the background's: NET.extra.
  const FOCUS_MAX = 2000;
  const focusMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 0.85 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aCol; attribute float aDash, aT; varying vec3 vC; varying float vD; void main() { vC = aCol; vD = aDash * aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA, uK; varying vec3 vC; varying float vD; void main() { if (vD > 0.0 && fract(vD) > 0.55) discard; gl_FragColor = vec4(vC, uK * uA); }',
  });
  set.mats.push(focusMat);
  const FO = { mesh: null, info: null };
  const faceText = loc => {
    const pl = NET.lPlace[loc], f = NET.lFace[loc];
    if (!f) return `in ${SPACE_NAME[INNER[pl]]}`;
    return `in the membrane, facing ${f === 3 ? `${SPACE_NAME[INNER[pl]]} and ${SPACE_NAME[OUTER[pl]]}` : SPACE_NAME[f === 1 ? INNER[pl] : OUTER[pl]]}`;
  };
  function setFocus(pp, pc) {
    const key = `${NET.n}|${NET.e}|${NET.art}|${NET.miss}|${pp}|${pc}`;
    if (key === NET.fk) return;
    NET.fk = key;
    FO.mesh = drop(FO.mesh); NET.extra = drop(NET.extra);
    // (dots a previous pick added go: the list keeps only the background's)
    for (let i = NET.nMain; i < D.loc.length; i++) D.key.delete(D.keys[i]);
    D.keys.length = NET.nMain; D.loc.length = NET.nMain; D.pos.length = 3 * NET.nMain; D.cC.length = 3 * NET.nMain; D.cR.length = NET.nMain;
    const L = NET.L, links = [], ties = [];
    FO.info = null;
    if (pp >= 0 && pp < NET.n) {
      const t = [0, 0, 0], ar = [0, 0, 0], partners = new Set();
      for (let i = 0; i < NET.e; i++) {
        if (L.pu[i] !== pp && L.pv[i] !== pp) continue;
        links.push(i); t[L.cls[i]]++; if (L.kind[i]) ar[L.cls[i]]++;
        partners.add(L.pu[i] === pp ? L.pv[i] : L.pu[i]);
      }
      const own = NET.listed[pp].map(dotOf);
      for (let i = 0; i < own.length; i++) for (let j = i + 1; j < own.length; j++) ties.push([own[i], own[j]]);
      FO.info = { kind: 'protein', p: pp, copies: NET.listed[pp].map(c => `${PLACE_NAME[NET.lPlace[c]]} (${faceText(c)})`),
        hidden: NET.protLocs[pp].filter(c => !NET.seen[c]).map(c => PLACE_NAME[NET.lPlace[c]]), links: links.length, t, ar, partners: partners.size };
    } else if (pc >= 0 && pc < 13) {
      let here = 0;
      for (let c = 0; c < NET.locs; c++) if (NET.seen[c] && NET.lPlace[c] === pc) here++;
      const inner = [];
      for (let i = 0; i < NET.e; i++) if (!L.cls[i] && NET.lPlace[L.a[i]] === pc && NET.lPlace[L.b[i]] === pc) inner.push(i);
      inner.sort((x, y) => L.score[y] - L.score[x]);
      links.push(...inner.slice(0, FOCUS_MAX));
      FO.info = { kind: 'place', place: pc, name: PLACE_NAME[pc], here, inner: inner.length, shown: links.length };
    }
    const geo = links.length || ties.length ? linesGeo(links, ties) : null;   // (adds the dots it needs)
    // the cell's own lights: the pick's dots bright (aFocus, all reached), the protein ringed (uSel), a place alone (uIso)
    const lit = new Set();
    for (const k of links) siteOf(k).forEach(d => lit.add(d));
    for (const [a, b] of ties) { lit.add(a); lit.add(b); }
    const aF = NET.dots.geometry.attributes.aFocus;
    aF.array.fill(0);
    for (const d of lit) if (d < NET.nMain) aF.array[d] = 1;
    aF.needsUpdate = true;
    if (D.loc.length > NET.nMain) {
      const g = dotsGeo(NET.nMain, D.loc.length);
      g.attributes.aFocus.array.fill(1);
      NET.extra = new THREE.Points(g, nodeMat); NET.extra.renderOrder = 5; NET.extra.frustumCulled = false; set.group.add(NET.extra);
    }
    const prot = !!(FO.info && FO.info.kind === 'protein'), place = !!(FO.info && FO.info.kind === 'place');
    NU.uFocus.value = prot ? 1 : 0; NU.uPathProg.value = prot ? 10 : 0; NU.uSel.value = prot ? pp : -1; NU.uIso.value = place ? pc : -1;
    RU.uFocus.value = prot ? 1 : 0; RU.uIso.value = place ? pc : -1;
    flagMat.uniforms.uK.value = prot || place ? 0.15 : 0.9;
    if (geo) {
      // (fainter as there are more of them, so a busy place does not burn white: 0.85 up to 200 lines, about 0.27 at 2,000)
      focusMat.uniforms.uK.value = 0.85 * Math.min(1, Math.sqrt(200 / Math.max(1, links.length)));
      FO.mesh = new THREE.LineSegments(geo.g, focusMat); FO.mesh.renderOrder = 7; FO.mesh.frustumCulled = false;
      set.group.add(FO.mesh);
    }
    if (set.onFocus) set.onFocus();
  }
  // the background's dot a ray passes closest to (in the set's own frame), or -1
  const inv = new THREE.Matrix4(), ray = new THREE.Ray(), pq = new THREE.Vector3(), pd = new THREE.Vector3();
  function pickCopy(rc) {
    if (!NET.dots) return -1;
    inv.copy(set.group.matrixWorld).invert();
    ray.copy(rc.ray).applyMatrix4(inv);
    let best = -1, bs = Infinity;
    const P = D.pos;
    for (let c = 0; c < NET.nMain; c++) {
      pq.set(P[3 * c], P[3 * c + 1], P[3 * c + 2]);
      const t = pd.copy(pq).sub(ray.origin).dot(ray.direction);
      if (t <= 0) continue;
      const d = ray.distanceSqToPoint(pq), rr = 0.008 + 0.012 * t;   // (reach grows with distance, as a dot's size on screen)
      if (d < rr * rr) { const sc = d / (rr * rr) + t * 0.15; if (sc < bs) { bs = sc; best = c; } }
    }
    return best;
  }

  const N_OPT = [250, 1000, 2500, 5000, 10000, 20000], E_OPT = [375, 2000, 5000, 10000, 20000, 40000, 80000], B_OPT = [1000, 2000, 3000], R_OPT = [0, 0.1, 0.3];
  const near = (list, x) => list.reduce((b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b), list[0]);
  const fmtK = v => (v >= 1000 ? (v % 1000 ? (v / 1000).toFixed(1) : v / 1000) + 'k' : String(v));
  const rateOpts = [['0', 'None'], ['0.1', '10 %'], ['0.3', '30 %']];
  return Object.assign(set, {
    params: { cell_a: 1, cell_n: 10000, cell_e: 40000, cell_shell: 1, cell_art: 0.1, cell_miss: 0.1, cell_show: 0, cell_budget: 2000, cell_pp: -1, cell_pc: -1 },
    update(S) {
      const n = near(N_OPT, S.cell_n), e = near(E_OPT, S.cell_e), art = near(R_OPT, S.cell_art), miss = near(R_OPT, S.cell_miss), show = clamp(Math.round(S.cell_show), 0, 2), bu = near(B_OPT, S.cell_budget);
      if (n !== NET.n || e !== NET.e || art !== NET.art || miss !== NET.miss || show !== NET.show || bu !== NET.budget) build(n, e, art, miss, show, bu);
      setFocus(Math.round(S.cell_pp), Math.round(S.cell_pc));
      const sh = clamp(S.cell_shell, 0, 1);
      shells.visible = sh > 0.01;
      for (const m of shellMats) m.uniforms.uK.value = sh;
      // points sized as the cell's: in a headset by distance (XR.pointK 0.0028 of the drawn height, in the set's own units),
      // on a screen a fixed size in pixels that grows a little as the camera comes closer
      const xr = GL.renderer && GL.renderer.xr.isPresenting;
      NU.uPx.value = xr ? K.U.uPx.value * 0.0028 : 0;
      NU.uScale.value = xr ? 1 : GL.renderer.getPixelRatio() * clamp(3.6 / GL.camera.position.length(), 0.75, 2.4);
    },
    // what is drawn now, for the pane
    stats: () => NET,
    // picking (explore mode): the copy under a ray, what a copy is, and what the pick shows
    api: () => ({
      pick: pickCopy, places: PLACE_NAME, focus: () => FO.info,
      copy: c => { if (!NET.dots || !(c >= 0 && c < NET.nMain)) return null; const l = D.loc[c]; return { prot: NET.lProt[l], place: NET.lPlace[l], deg: NET.degP[NET.lProt[l]], face: faceText(l), pos: dotPos(c) }; },
    }),
    anchors: { centre: [0, 0, 0], nucleus: CELL.nuc.c, edge: [0.95, 0.35, 0] },
    labels: [],
    cam: { default: [20, 14, 3.6, 0, 0, 0], inside: [30, 6, 0.55, 0.15, 0, 0.1] },
    controls: [
      { key: 'np', label: 'Proteins', options: N_OPT.map(v => [String(v), fmtK(v)]) },
      { key: 'nl', label: 'Links in the database', options: E_OPT.map(v => [String(v), fmtK(v)]) },
      { key: 'art', label: 'Artefacts', options: rateOpts },
      { key: 'miss', label: 'Missing locations', options: rateOpts },
      { key: 'show', label: 'Show', options: [['0', 'Possible'], ['1', '+ through gates'], ['2', '+ impossible']] },
      { key: 'budget', label: 'Links at most', options: B_OPT.map(v => [String(v), fmtK(v)]) },
      { key: 'shells', label: 'Organelles', options: [['1', 'On'], ['0', 'Off']] },
      { key: 'view', label: 'View', options: [['default', 'Outside'], ['inside', 'Inside']] },
    ],
    explore(c) {
      return { cell_n: +c.np || 10000, cell_e: +c.nl || 40000, cell_shell: c.shells === '0' ? 0 : 1, cell_art: c.art === undefined ? 0.1 : +c.art,
        cell_miss: c.miss === undefined ? 0.1 : +c.miss, cell_show: +c.show || 0, cell_budget: +c.budget || 2000 };
    },
  });
};
