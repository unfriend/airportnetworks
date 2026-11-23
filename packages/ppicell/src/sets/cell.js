// The story's cell: the cell map story's model cell (stories/spatial.js: the same membrane, nucleus, ER, Golgi,
// mitochondria, small organelles and cytoskeleton, drawn with the same shaders, as packages/cellstress), filled with the
// interactome of Menche et al. (2015) placed where the Human Protein Atlas finds each protein (PDATA). A dot is a protein
// where it meets others: every listed location has its own, plus the copies the drawn links need. Each link is judged
// by the method cellstress tried out: possible (its two proteins share a space), through a gate (one known crossing),
// impossible; links that are not contacts (regulatory or metabolic only) and links with an end without a place are
// counted apart and drawn grey when asked. One Points draw for the dots, one LineSegments draw for the possible (and
// grey) links, one for the amber and red ones, one more for a pick.
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
  col += vec3(0.3, 0.12, 0.4) * crista;
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
      shellMaterial('0.42, 0.44, 1.0', 0.14, 0.45), 4);
    addMesh(mergeCopies(CELL.mitos.map(o => {
      const g = new THREE.SphereGeometry(1, 40, 20); g.scale(o.a, o.b, o.b); g.computeVertexNormals();
      return { geo: g, pos: o.c, quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(...o.axis)), k: o.a };
    })), shellMaterial('0.8, 0.32, 1.0', 0.08, 0.45, 'mito'), 5);
    const ball = new THREE.SphereGeometry(1, 28, 18);
    const balls = (list, rgb, a0, a1, order) => addMesh(mergeCopies(list.map(o => ({ geo: ball, pos: o.c, scale: new THREE.Vector3(o.r, o.r, o.r) }))), shellMaterial(rgb, a0, a1), order);
    balls(CELL.lysos, '1.0, 0.45, 0.9', 0.14, 0.5, 6);
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
  // The cell map's thirteen places and their colours (a fourteenth, grey, for proteins without a place). Two proteins
  // can bind only where they share a space: a body of water bounded by membranes (PDATA: INNER, OUTER, spaces, judge).
  const P = PDATA;
  // (no orange or red among them: those are the verdicts' alone, amber through a gate and red impossible)
  const PLACE_COL = [[0.55, 0.78, 1.0], [0.66, 0.54, 1.0], [0.95, 0.6, 1.0], [0.35, 0.95, 0.6], [0.42, 0.44, 1.0], [0.8, 0.32, 1.0],
    [1.0, 0.45, 0.9], [0.2, 0.88, 0.82], [0.78, 0.95, 0.3], [0.6, 0.9, 1.0], [0.75, 0.6, 1.0], [0.9, 0.9, 0.95], [0.45, 0.7, 1.0], [0.5, 0.53, 0.58]];
  const PLACE_NAME = P.places.slice();
  const SPACE_NAME = ['the cytosol', 'the nucleoplasm', 'the ER lumen', 'the Golgi lumen', 'the mitochondrial matrix', 'the lysosome lumen',
    'the endosome lumen', 'the peroxisome lumen', 'outside the cell'];
  const { INNER, OUTER } = P;
  // The Atlas does not say which side of a membrane a protein is on, so the drawing follows the reading (faces): the
  // plasma membrane's and the nuclear envelope's proteins sit in their membrane, facing its inner side (strict) or both
  // sides (generous); an organelle's are inside it (strict) or on its membrane, facing both its inside and the cytosol
  // (generous); the rest are soluble. 0 soluble, 1 in the membrane facing its inner side, 3 facing both.
  const faceOf = (pl, g) => (pl === 9 || pl === 10 ? (g ? 3 : 1) : pl >= 3 && pl <= 8 && g ? 3 : 0);
  const inBall = (r, c, R) => v3.add(c, v3.mul(K.unit(r), R * Math.cbrt(r())));
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  // the organelles that come as many: each one its own space (no link joins two of them); a location is in one of them
  const MANY = { 5: CELL.mitos, 6: CELL.lysos, 7: CELL.endos, 8: CELL.peroxs };
  // a location's spot, and its container (a centre and radius a link through a gate passes over; radius 0: none); inst:
  // which of MANY's organelles
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
        // (a soluble one anywhere in the matrix, evenly through the whole organelle as in the nucleus: the owner)
        if (f === 0) { const u = inBall(r, [0, 0, 0], 1); return [v3.add(m.c, v3.add(v3.mul(m.axis, m.a * 0.85 * u[0]), v3.add(v3.mul(p1, m.b * 0.8 * u[1]), v3.mul(p2, m.b * 0.8 * u[2])))), m.c, m.b * 1.4]; }
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
      case 13: { const d = K.unit(r); return [v3.mul(d, (1.12 + 0.25 * Math.cbrt(r())) / CELL.eScale(d)), [0, 0, 0], 0]; }   // (no place: a loose shell outside the cell)
      default: { const d = K.unit(r); return [v3.mul(d, (0.8 + 0.1 * r()) / CELL.eScale(d)), [0, 0, 0], 0]; }
    }
  };

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
uniform vec3 uPal[14];
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
  // (a pick: its dots in their own colours, a little brighter, the rest dim; not white: the owner, 22 November 2026)
  float bright = mix(1.0, 0.24 + reached * 0.91, uFocus);
  float inProx = 1.0 - smoothstep(uProx.w * 0.94, uProx.w, distance(position, uProx.xyz));
  bright *= mix(1.0, 0.22 + 1.3 * inProx, uProxOn);
  float iso = uIso < -0.5 ? 1.0 : (abs(aPlace - uIso) < 0.5 ? 1.0 : 0.12);
  float sel = (1.0 - step(0.5, abs(aProt - uSel))) * step(1.5, aFocus);   // (the picked protein's own dots, not its copies by partners)
  float reveal = clamp((uReveal * 1.12 - aRand) / 0.12, 0.0, 1.0);
  vCol = col * bright; vRing = sel;
  vA = reveal * iso * uAlpha * clamp(pres + gone, 0.0, 1.0) * smoothstep(0.0, 0.15, pres);
  float att = uPx > 0.0 ? uPx * projectionMatrix[1][1] / max(-mv.z, 0.05) : 1.0;
  gl_PointSize = max(aSize * uScale * att * (1.0 + sel * 0.8) * (1.0 + 0.3 * uFocus * reached) * (1.0 + 0.5 * uProxOn * inProx), uPx > 0.0 ? 1.6 : 0.0);
}`,
    fragmentShader: `
uniform float uA;
varying vec3 vCol; varying float vA, vRing;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.30, d);
  float ring = vRing * smoothstep(0.5, 0.44, d) * (1.0 - smoothstep(0.38, 0.30, d));
  gl_FragColor = vec4(mix(vCol, vCol * 1.25 + 0.2, ring), vA * max(core, ring) * uA);
}`,
  });
  nodeMat.uniforms.uA = set.uA;
  set.mats.push(nodeMat);
  // the dots' depth alone, drawn first: each dot's core (not its soft rim) hides what is behind it, so a link passing
  // behind a dot is hidden there, and the links drawn after the dots no longer cover dots in front of them (the owner,
  // 22 November 2026: the red links drew over everything)
  const nodeZMat = new THREE.ShaderMaterial({
    uniforms: NU, transparent: true, depthWrite: true, colorWrite: false,
    vertexShader: nodeMat.vertexShader,
    fragmentShader: `uniform float uA; varying vec3 vCol; varying float vA, vRing;
void main() { if (length(gl_PointCoord - 0.5) > 0.26 || vA * uA < 0.3) discard; gl_FragColor = vec4(0.0); }`,
  });
  set.mats.push(nodeZMat);
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



  // ------------------------------------------------------------ the data: locations, links, importance
  // A location is a protein in one of its places (PDATA's 17,935, with their communities); a protein without a place
  // gets one more, outside the cell (place 13), drawn only with the grey links.
  const NP = P.N, NLOC = P.L, E = P.E, unplaced = [];
  for (let p = 0; p < NP; p++) if (!P.pl[p]) unplaced.push(p);
  const NALL = NLOC + unplaced.length, lProt = new Uint16Array(NALL), lPlace = new Uint8Array(NALL), lCom = new Uint16Array(NALL), lInst = new Uint8Array(NALL);
  const uLoc = new Int32Array(NP).fill(-1);
  lProt.set(P.lProt); lPlace.set(P.lPlace); lCom.set(P.com);
  unplaced.forEach((p, u) => { lProt[NLOC + u] = p; lPlace[NLOC + u] = 13; uLoc[p] = NLOC + u; });
  // (in one of MANY's organelles a community shares one: chosen from its number, so a complex stays together)
  for (let l = 0; l < NLOC; l++) if (MANY[lPlace[l]]) lInst[l] = mul(lCom[l] * 13 + lPlace[l] + 1)() * MANY[lPlace[l]].length | 0;
  const l0 = p => (P.pl[p] ? P.lOf[p] : uLoc[p]), l1 = p => (P.pl[p] ? P.lOf[p + 1] : uLoc[p] + 1);
  // each protein's links (all of them, the regulatory and metabolic ones too), and its number of them (a link of a
  // protein with itself, as a pair of the same protein, counts once: GRB2 has 871, TP53 449)
  const degP = new Uint16Array(NP), aOff = new Uint32Array(NP + 1), adj = new Uint32Array(2 * E);
  for (let i = 0; i < E; i++) { degP[P.la[i]]++; if (P.lb[i] !== P.la[i]) degP[P.lb[i]]++; }
  for (let p = 0; p < NP; p++) aOff[p + 1] = aOff[p] + degP[p];
  { const fill = aOff.slice(0, NP); for (let i = 0; i < E; i++) { adj[fill[P.la[i]]++] = i; if (P.lb[i] !== P.la[i]) adj[fill[P.lb[i]]++] = i; } }
  let maxDeg = 1;
  for (let p = 0; p < NP; p++) maxDeg = Math.max(maxDeg, degP[p]);
  // a link's importance: how many kinds of evidence it has (no made-up scores); ties by its place in the paper's list.
  // ORDER: every link, the most important first
  const nEv = new Uint8Array(E), ORDER = new Uint32Array(E);
  for (let i = 0; i < E; i++) { let k = P.kind[i], c = 0; for (; k; k &= k - 1) c++; nEv[i] = c; }
  { let o = 0; for (let c = 7; c >= 0; c--) for (let i = 0; i < E; i++) if (nEv[i] === c) ORDER[o++] = i; }
  const BYSYM = new Map();
  P.sym.forEach((s, p) => { const u = s.toUpperCase(); if (!BYSYM.has(u)) BYSYM.set(u, p); });
  // a pair of places' judgement in each reading (PDATA.judge on one place each): a link's is the best of its proteins'
  // pairs of places, the same as PDATA.judge on their whole lists, and that pair is where it is drawn
  const PAIR = [false, true].map(g => { const t = new Int8Array(169); for (let a = 0; a < 13; a++) for (let b = 0; b < 13; b++) t[a * 13 + b] = P.judge(1 << a, 1 << b, g); return t; });

  // ------------------------------------------------------------ where a link is drawn (cellstress's method)
  const CLS_COL = [null, [1.0, 0.7, 0.2], [1.0, 0.25, 0.2], PLACE_COL[13]];
  const flagMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 0.9 }, uAmb: { value: 1 }, uRed: { value: 1 } }, transparent: true, depthWrite: false,
    // (the amber ones and the red ones each faded on their own, without a new build: cell_amb, cell_red)
    vertexShader: 'uniform float uAmb, uRed; attribute vec3 aCol; varying vec3 vC; varying float vK; void main() { vC = aCol; vK = aCol.g > 0.5 ? uAmb : uRed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA, uK; varying vec3 vC; varying float vK; void main() { gl_FragColor = vec4(vC, uK * uA * vK); }',
  });
  set.mats.push(flagMat);
  // (and a faint copy of them not hidden by the dots, a little under half as strong, so the flagged links still read through a
  // dense place without drawing over the dots in front at full strength. Depth-tested all the same, but drawn before the
  // dots' depth (renderOrder 4.8, the dots' depth pass 4.9): so the real world (occlusion's depth, drawn first), the panel
  // and solid things still hide it, as they hide the rest of the cell; with depthTest off it showed through them in AR)
  const flagGhost = new THREE.ShaderMaterial({ uniforms: flagMat.uniforms, transparent: true, depthWrite: false,
    vertexShader: flagMat.vertexShader, fragmentShader: flagMat.fragmentShader.replace('uK * uA * vK', '0.45 * uK * uA * vK') });
  set.mats.push(flagGhost);
  // g: the reading (0 strict, 1 generous); L: each link's two locations, its class (0 possible, 1 through a gate, 2
  // impossible, 3 grey) and why grey (1 not a contact, 2 an end without a place)
  const NET = { g: -1, show: -1, kind: -9, flags: null, extra: null, dots: null, routes: null, fk: '', L: null, lFace: new Uint8Array(NALL), lSp: new Uint16Array(NALL),
    flagK: 0.6, nMain: 0, nOwn: 0, nOut: 0, drawn: 0, ms: 0, tally: [0, 0, 0], notC: 0, unpl: 0, maxDeg, degP };
  function judgeAll(g) {
    const T = PAIR[g], a = new Int32Array(E), b = new Int32Array(E), cls = new Uint8Array(E), why = new Uint8Array(E);
    for (let l = 0; l < NALL; l++) { NET.lFace[l] = faceOf(lPlace[l], g); NET.lSp[l] = lPlace[l] < 13 ? P.spaces(1 << lPlace[l], g) : 0; }
    for (let i = 0; i < E; i++) {
      const u = P.la[i], v = P.lb[i];
      why[i] = !P.contact(i) ? 1 : !P.pl[u] || !P.pl[v] ? 2 : 0;
      if (!P.pl[u] || !P.pl[v]) { a[i] = l0(u); b[i] = l0(v); cls[i] = 3; continue; }
      // (the best pair; among equals one in a single place, the shortest to draw)
      let best = 9, ba = 0, bb = 0;
      for (let x = l0(u); x < l1(u); x++) for (let y = l0(v); y < l1(v); y++) {
        const c = T[lPlace[x] * 13 + lPlace[y]] * 2 + (lPlace[x] === lPlace[y] ? 0 : 1);
        if (c < best) { best = c; ba = x; bb = y; }
      }
      a[i] = ba; b[i] = bb; cls[i] = why[i] ? 3 : best >> 1;
    }
    NET.L = { a, b, cls, why };
    NET.g = g;
  }
  // the dots: one list, the background's first (NET.nMain of them, drawn as NET.dots), then any a pick adds (NET.extra)
  const D = { pos: [], loc: [], cC: [], cR: [], keys: [], key: new Map() };
  const dotAdd = (key, loc, p, C, R) => { const i = D.loc.length; D.pos.push(...p); D.loc.push(loc); D.cC.push(...C); D.cR.push(R); D.keys.push(key); D.key.set(key, i); return i; };
  const dotPos = i => D.pos.slice(3 * i, 3 * i + 3);
  // a location's dot in organelle inst (its own one when inst is its own)
  function dotIn(loc, inst) {
    const key = loc + '|' + inst, k = D.key.get(key);
    if (k !== undefined) return k;
    const pl = lPlace[loc], f = NET.lFace[loc];
    let [q, C, R] = spot(pl, f, mul(31 * loc + 7 * inst + 1), inst);
    // in a large place a community gathers round its own spot (a twelfth of the way from it to a random one), kept on
    // its membrane or at its distance from the nucleus (the many small organelles are small enough already)
    if (!MANY[pl] && pl < 13) {
      const c0 = spot(pl, f, mul(lCom[loc] * 13 + pl + 5), inst)[0], m = v3.lerp(c0, q, 1 / 12);
      const hub = pl === 2 ? CELL.nucl.c : CELL.nuc.c;
      if (pl === 9) q = v3.mul(m, CELL.eScale(q) / CELL.eScale(m));
      else if ([1, 2, 3, 4, 10].includes(pl)) q = v3.add(hub, v3.mul(v3.norm(v3.sub(m, hub)), v3.len(v3.sub(q, hub))));
      else q = m;
    }
    return dotAdd(key, loc, q, C, R);
  }
  const dotOf = loc => dotIn(loc, lInst[loc]);
  // a free location's dot beside a fixed dot: on the side of the fixed one's membrane where the free one's space is
  function dotBeside(loc, at) {
    const key = loc + '|b' + at, k = D.key.get(key);
    if (k !== undefined) return k;
    const r = mul(97 * loc + at + 3), p = dotPos(at), C = D.cC.slice(3 * at, 3 * at + 3), fl = D.loc[at], pl = lPlace[fl];
    let out = D.cR[at] > 0 || pl === 9 ? v3.norm(v3.sub(p, C)) : K.unit(r);
    // (the free one in the fixed one's inner space: inwards; else outwards)
    if (OUTER[pl] >= 0 && !(NET.lSp[loc] & (1 << OUTER[pl]))) out = v3.mul(out, -1);
    const q = v3.add(v3.add(p, v3.mul(out, 0.014)), v3.mul(K.unit(r), 0.006));
    return dotAdd(key, loc, q, [0, 0, 0], 0);
  }
  // a membrane location's dot at the point of its own membrane nearest a dot (the two as close as their organelles let
  // them be)
  function dotToward(loc, at) {
    const key = loc + '|t' + at, k = D.key.get(key);
    if (k !== undefined) return k;
    const tp = dotPos(at), pl = lPlace[loc], f = NET.lFace[loc];
    // (one of MANY's organelles: the one nearest the partner)
    let inst = lInst[loc];
    if (MANY[pl]) inst = MANY[pl].reduce((b, o, i) => (v3.len(v3.sub(o.c, tp)) < v3.len(v3.sub(MANY[pl][b].c, tp)) ? i : b), 0);
    const own = dotIn(loc, inst), C = D.cC.slice(3 * own, 3 * own + 3), R = D.cR[own];
    const s = f === 1 ? 0.985 : f === 2 ? 1.015 : 1, d = v3.norm(v3.sub(tp, C));
    const j = v3.mul(K.unit(mul(53 * loc + at)), 0.012), d2 = v3.norm(v3.add(d, j));
    const q = pl === 9 ? v3.mul(d2, 0.985 * s / CELL.eScale(d2)) : R > 0 ? v3.add(C, v3.mul(d2, R * s)) : dotPos(own);
    return dotAdd(key, loc, q, C, R);
  }
  // where a link is drawn: its two dots
  function siteOf(k) {
    const L = NET.L, a = L.a[k], b = L.b[k];
    if (L.cls[k] === 1) return gateSite(k, a, b);
    if (L.cls[k]) return [dotOf(a), dotOf(b)];
    const pa = lPlace[a], pb = lPlace[b];
    if (pa === pb) {
      if (MANY[pa]) return [dotOf(a), dotIn(b, lInst[a])];
      const da = dotOf(a), db = dotOf(b);
      if (v3.len(v3.sub(dotPos(da), dotPos(db))) < 0.12) return [da, db];
      // (still far apart: the less connected one gets a dot beside the other, so hubs stay put and partners gather)
      const [hub, free] = degP[lProt[a]] >= degP[lProt[b]] ? [a, b] : [b, a], dh = dotOf(hub);
      const df = NET.lFace[free] ? dotToward(free, dh) : dotBeside(free, dh);
      return hub === a ? [dh, df] : [df, dh];
    }
    // across two places: the soluble one is free and goes beside the other
    const fa = NET.lFace[a] === 0, fb = NET.lFace[b] === 0;
    if (fa === fb && !fa) {
      // (two in membranes: the ER reaches every other organelle and the plasma membrane, but this model's ER only
      // wraps the nucleus, so its protein is drawn beside the partner; so is a lysosome's beside a mitochondrion's)
      const mover = pa === 3 ? a : pb === 3 ? b : pa === 6 ? a : pb === 6 ? b : -1;
      if (mover === a) return [dotBeside(a, dotOf(b)), dotOf(b)];
      if (mover === b) return [dotOf(a), dotBeside(b, dotOf(a))];
      return [dotOf(a), dotToward(b, dotOf(a))];
    }
    if (fa && fb) return [dotBeside(a, dotOf(b)), dotOf(b)];   // (two soluble ones sharing a space: the nucleolus and the nucleoplasm, the cytosol and its coats)
    return fa ? [dotBeside(a, dotOf(b)), dotOf(b)] : [dotOf(a), dotBeside(b, dotOf(a))];
  }
  // a link through a gate, drawn at the gate (the owner, 22 November 2026: the long amber arcs too long): where the inner
  // one's organelle (the one not in the cytosol) faces the other, each protein gets a dot of its own, one just inside the
  // membrane and one just outside, joined by a short stitch through it
  function gateSite(k, a, b) {
    const ki = D.key.get(a + '|g' + k), ko = D.key.get(b + '|g' + k);
    if (ki !== undefined && ko !== undefined) return [ki, ko];   // (made already: each link's two once)
    const da = dotOf(a), db = dotOf(b), pa = dotPos(da), pb = dotPos(db);
    const inA = (D.cR[da] > 0 && !(NET.lSp[a] & 1)) || D.cR[db] === 0, inner = inA ? da : db, other = inA ? pb : pa, C = D.cC.slice(3 * inner, 3 * inner + 3);
    const r = mul(131 * k + 7), jit = v3.mul(K.unit(r), 0.008);
    let gp, n;
    // (halfway between the point facing the other and the one over the inner one's own dot, so a hub's many gates
    // spread over the membrane as many hops, not one knot)
    if (D.cR[inner] > 0) {
      const ti = v3.sub(dotPos(inner), C), li = v3.len(ti);
      n = v3.norm(v3.add(v3.add(v3.norm(v3.sub(other, C)), li > 1e-6 ? v3.mul(ti, 1 / li) : [0, 0, 0]), v3.mul(jit, 4)));
      gp = v3.add(C, v3.mul(n, D.cR[inner]));
    }
    else { gp = v3.add(v3.lerp(pa, pb, 0.5), jit); n = v3.norm(v3.sub(other, pa)); }   // (no organelle to cross: halfway, along the link)
    const qi = v3.sub(gp, v3.mul(n, 0.03)), qo = v3.add(gp, v3.mul(n, 0.03));   // (a stitch about 0.06 long: short, yet seen)
    const di = dotAdd((inA ? a : b) + '|g' + k, inA ? a : b, qi, C, D.cR[inner]), dout = dotAdd((inA ? b : a) + '|g' + k, inA ? b : a, qo, [0, 0, 0], 0);
    return inA ? [di, dout] : [dout, di];
  }
  // a link's points: its two dots (a link through a gate: a short stitch through the membrane, gateSite); with arc, a
  // pick's link through a gate hops through the membrane in a short arc (the owner, 22 November 2026: "keep em short but
  // arcs where they make sense"), bowed sideways about a third as far as it is long
  function linkPts(k, out, arc) {
    const [da, db] = siteOf(k), pa = dotPos(da), pb = dotPos(db);
    if (!arc || NET.L.cls[k] !== 1) { out.push(pa, pb); return; }
    const d = v3.sub(pb, pa), n = v3.norm(d), t0 = perp(n), t1 = v3.cross(n, t0), w = mul(131 * k + 11)() * Math.PI * 2;
    const ctl = v3.add(v3.lerp(pa, pb, 0.5), v3.mul(v3.add(v3.mul(t0, Math.cos(w)), v3.mul(t1, Math.sin(w))), v3.len(d) * 0.7)), S = 6;
    const q = u => { const o = 1 - u; return [0, 1, 2].map(j => o * o * pa[j] + 2 * o * u * ctl[j] + u * u * pb[j]); };
    for (let i = 0; i < S; i++) out.push(q(i / S), q((i + 1) / S));
  }
  const linkCol = k => (NET.L.cls[k] ? CLS_COL[NET.L.cls[k]] : v3.lerp(PLACE_COL[lPlace[NET.L.a[k]]], PLACE_COL[lPlace[NET.L.b[k]]], 0.5));
  // links as line segments with the cell's route attributes (the focus and flag materials read only position and aCol);
  // dashed (a pick's links: dashes DASH_L to a unit, in their colours) and the ties between a protein's copies (fine
  // dots, DASH_T to a unit, a neutral light grey): the two styles told apart at a glance
  const DASH_L = 34, DASH_T = 120, TIE_COL = [0.86, 0.89, 0.93];
  function linesGeo(list, dashes, arc, dashed) {
    const segs = [], col = [], plA = [], plB = [], dash = [];
    for (const k of list) {
      const n0 = segs.length, c = linkCol(k);
      linkPts(k, segs, arc);
      // (aDash: the distance along the link, in dashes, so an arc's pieces carry the dashes on)
      let run = 0;
      for (let j = n0; j < segs.length; j++) {
        col.push(c); plA.push(lPlace[NET.L.a[k]]); plB.push(lPlace[NET.L.b[k]]);
        if (dashed && (j & 1)) run += v3.len(v3.sub(segs[j], segs[j - 1])) * DASH_L;
        dash.push(dashed ? run : 0);
      }
    }
    for (const [da, db] of dashes || []) {
      const pa = dotPos(da), pb = dotPos(db), d = -v3.len(v3.sub(pb, pa)) * DASH_T;   // (negative: fine dots)
      segs.push(pa, pb); col.push(TIE_COL, TIE_COL); plA.push(0, 0); plB.push(0, 0); dash.push(0, d);
    }
    const V = segs.length, g = new THREE.BufferGeometry(), Pp = new Float32Array(V * 3), C = new Float32Array(V * 3), T = new Float32Array(V);
    segs.forEach((p, i) => { Pp.set(p, 3 * i); C.set(col[i], 3 * i); T[i] = i % 2; });
    g.setAttribute('position', new THREE.BufferAttribute(Pp, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(C, 3));
    g.setAttribute('aT', new THREE.BufferAttribute(T, 1)); g.setAttribute('aRv', new THREE.BufferAttribute(new Float32Array(V), 1));
    g.setAttribute('aDash', new THREE.BufferAttribute(new Float32Array(dash), 1));
    g.setAttribute('aPlA', new THREE.BufferAttribute(new Float32Array(plA), 1)); g.setAttribute('aPlB', new THREE.BufferAttribute(new Float32Array(plB), 1));
    for (const k of ['aScA', 'aMdA', 'aScB', 'aMdB']) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(V), 1));
    return { g, pieces: V / 2 };
  }
  // dots i0 .. i1 as a Points geometry with the cell's ten attributes
  function dotsGeo(i0, i1) {
    const ND = i1 - i0, pg = new THREE.BufferGeometry(), f = () => new Float32Array(ND), lmax = Math.log1p(maxDeg);
    const at = { aIdx: f(), aProt: f(), aRand: f(), aPlace: f(), aDeg: f(), aMulti: f(), aScen: f(), aMode: f(), aFocus: f(), aSize: f() };
    const r = mul(i0 + 11);
    for (let k = 0; k < ND; k++) {
      const loc = D.loc[i0 + k], p = lProt[loc], dg = degP[p];
      at.aIdx[k] = i0 + k; at.aProt[k] = p; at.aRand[k] = r(); at.aPlace[k] = lPlace[loc];
      at.aDeg[k] = Math.log1p(dg) / lmax; at.aMulti[k] = l1(p) - l0(p); at.aSize[k] = 3.0 + 5.0 * Math.sqrt(dg / maxDeg);
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
  // share n between the kinds of judgement in proportion to their counts, each kind that has any taking at least
  // KIND_MIN (so the rare red ones still show), the rest to the possible ones (0); what a kind cannot use goes to the others
  const KIND_MIN = 100;
  function shareKinds(sizes, n) {
    const tot = sizes.reduce((s, x) => s + x, 0), take = sizes.map(() => 0);
    if (!tot) return take;
    for (let k = 1; k < sizes.length; k++) take[k] = Math.min(sizes[k], Math.max(KIND_MIN, Math.floor(n * sizes[k] / tot)));
    take[0] = Math.min(sizes[0], Math.max(0, n - take.reduce((s, x) => s + x, 0)));
    for (let left = n - take.reduce((s, x) => s + x, 0), k = 1; left > 0 && k < sizes.length; k++) { const d = Math.min(left, sizes[k] - take[k]); take[k] += d; left -= d; }
    return take;
  }
  const drop = o => { if (o) { set.group.remove(o); o.geometry.dispose(); } return null; };
  // with kind k of evidence (-1: any)
  const hasKind = (i, k) => k < 0 || (P.kind[i] >> k & 1) === 1;
  const BUDGET = 2000;
  function build(show, g, kind) {
    const t0 = performance.now();
    NET.dots = drop(NET.dots); NET.dotsZ = drop(NET.dotsZ); NET.flagsG = drop(NET.flagsG); NET.routes = drop(NET.routes); NET.flags = drop(NET.flags); NET.extra = drop(NET.extra);
    if (FO.mesh) FO.mesh = drop(FO.mesh);
    D.pos = []; D.loc = []; D.cC = []; D.cR = []; D.keys = []; D.key = new Map();
    if (g !== NET.g) judgeAll(g);
    const L = NET.L, tally = [0, 0, 0], groups = [[], [], [], []];
    let notC = 0, unpl = 0;
    for (let o = 0; o < E; o++) {
      const i = ORDER[o];
      if (!hasKind(i, kind)) continue;
      if (L.why[i] === 1) notC++; else if (L.why[i] === 2) unpl++; else tally[L.cls[i]]++;
      if (L.cls[i] <= show) groups[L.cls[i]].push(i);
    }
    // the dots: every listed location's own (and with the grey links, every protein without a place outside the
    // cell), then the ones the background's links add
    for (let l = 0; l < NLOC; l++) dotOf(l);
    const nOwn = D.loc.length;
    if (show >= 3) for (let l = NLOC; l < NALL; l++) dotOf(l);
    const nOut = D.loc.length - nOwn;
    // the background: the most important links of the kinds on show, BUDGET at most, shared between the kinds in
    // proportion to their counts (shareKinds) and the possible ones between the places (by the square root of theirs)
    const tk = shareKinds(groups.map(x => x.length), BUDGET), byPl = PLACE_COL.map(() => []);
    for (const i of groups[0]) byPl[lPlace[L.a[i]]].push(i);
    const tp = share(byPl.map(x => x.length), tk[0]), list = [];
    byPl.forEach((x, k) => list.push(...x.slice(0, tp[k])));
    list.push(...groups[3].slice(0, tk[3]));   // (the grey ones in the same pale draw)
    const flagged = [...groups[1].slice(0, tk[1]), ...groups[2].slice(0, tk[2])];
    const rg = linesGeo(list), fg = flagged.length ? linesGeo(flagged) : null;   // (their dots are added here)
    NET.nMain = D.loc.length;
    NET.dots = new THREE.Points(dotsGeo(0, NET.nMain), nodeMat); NET.dots.renderOrder = 5; NET.dots.frustumCulled = false;
    NET.routes = new THREE.LineSegments(rg.g, routeMat); NET.routes.renderOrder = 5.5; NET.routes.frustumCulled = false;
    NET.dotsZ = new THREE.Points(NET.dots.geometry, nodeZMat); NET.dotsZ.renderOrder = 4.9; NET.dotsZ.frustumCulled = false;
    set.group.add(NET.dotsZ, NET.dots, NET.routes);
    // (links through a gate and impossible ones in a draw of their own, at full strength: under the pale cytosol's they
    // would not show)
    if (fg) { NET.flags = new THREE.LineSegments(fg.g, flagMat); NET.flags.renderOrder = 6; NET.flags.frustumCulled = false; set.group.add(NET.flags);
      NET.flagsG = new THREE.LineSegments(fg.g, flagGhost); NET.flagsG.renderOrder = 4.8; NET.flagsG.frustumCulled = false; set.group.add(NET.flagsG); }
    Object.assign(NET, { show, kind, nOwn, nOut, tally, notC, unpl, fk: '', bg: list.concat(flagged), drawn: list.length + flagged.length, drawnBy: [tp.reduce((s, x) => s + x, 0), tk[1], tk[2], tk[3]],
      pieces: rg.pieces + (fg ? fg.pieces : 0), ms: Math.round(performance.now() - t0) });
    if (set.onBuild) set.onBuild();
  }

  // ------------------------------------------------------------ a pick: a protein or a place, and its links
  // A protein: its links of the kind on show, in their colours (possible in its places' colours, through a gate amber,
  // impossible red; grey ones when the grey links are on show, or always for a protein without a place), and dotted
  // ties between its locations' own dots; its partners stay bright, the rest dims (the cell's aFocus and uSel), and the
  // background fades. A place: its possible links inside it, the most important first, up to FOCUS_MAX, every other
  // place dimmed (the cell's uIso). Dots the pick needs beyond the background's: NET.extra.
  const FOCUS_MAX = 2000;
  const focusMat = new THREE.ShaderMaterial({
    // (normal blending: where many meet, at a hub, they keep their colours instead of adding up to white)
    uniforms: { uA: set.uA, uK: { value: 0.85 } }, transparent: true, depthWrite: false,
    vertexShader: 'attribute vec3 aCol; attribute float aDash; varying vec3 vC; varying float vD; void main() { vC = aCol; vD = aDash; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // (vD above 0: a link's dashes, long; below 0: a copy tie's fine dots)
    fragmentShader: 'uniform float uA, uK; varying vec3 vC; varying float vD; void main() { if (vD > 0.0 && fract(vD) > 0.6) discard; if (vD < 0.0 && fract(-vD) > 0.3) discard; gl_FragColor = vec4(vC, uK * uA); }',
  });
  set.mats.push(focusMat);
  const FO = { mesh: null, info: null };
  const faceText = loc => {
    const pl = lPlace[loc], f = NET.lFace[loc];
    if (pl === 13) return 'no place in the Atlas';
    if (!f) return `in ${SPACE_NAME[INNER[pl]]}`;
    return `in the membrane, facing ${f === 3 ? `${SPACE_NAME[INNER[pl]]} and ${SPACE_NAME[OUTER[pl]]}` : SPACE_NAME[f === 1 ? INNER[pl] : OUTER[pl]]}`;
  };
  function setFocus(pp, pc, tie) {
    const key = `${NET.g}|${NET.show}|${NET.kind}|${pp}|${pc}|${tie}`;
    if (key === NET.fk) return;
    NET.fk = key;
    FO.mesh = drop(FO.mesh); NET.extra = drop(NET.extra);
    // (dots a previous pick added go: the list keeps only the background's)
    for (let i = NET.nMain; i < D.loc.length; i++) D.key.delete(D.keys[i]);
    D.keys.length = NET.nMain; D.loc.length = NET.nMain; D.pos.length = 3 * NET.nMain; D.cC.length = 3 * NET.nMain; D.cR.length = NET.nMain;
    const L = NET.L, links = [], ties = [];
    FO.info = null;
    if (pp >= 0 && pp < NP) {
      const t = [0, 0, 0, 0], ev = new Array(7).fill(0), partners = new Set(), none = !P.pl[pp];
      let all = 0;
      for (let j = aOff[pp]; j < aOff[pp + 1]; j++) {
        const i = adj[j];
        all++;
        for (let k = 0; k < 7; k++) if (P.kind[i] >> k & 1) ev[k]++;
        if (!hasKind(i, NET.kind)) continue;
        t[L.cls[i]]++;
        if (P.la[i] !== P.lb[i]) partners.add(P.la[i] === pp ? P.lb[i] : P.la[i]);
        if (L.cls[i] < 3 || NET.show >= 3 || none) links.push(i);
      }
      links.splice(FOCUS_MAX);
      // its copies (cell_ties): every dot of the protein drawn, its own at its places, in each of MANY's organelles a
      // link needs, beside partners and at gates, joined by the shortest tree (Prim's), so each copy is tied to a near
      // one and none to all (the owner, 22 November 2026: "do we also show all of its copies with dotted lines?")
      for (let l = l0(pp); l < l1(pp); l++) dotOf(l);
      for (const k of links) siteOf(k);
      const cp = [];
      for (let d = 0; d < D.loc.length; d++) if (lProt[D.loc[d]] === pp) cp.push(d);
      if (tie && cp.length > 1) {
        const n = cp.length, best = new Float64Array(n).fill(Infinity), from = new Int32Array(n), done = new Uint8Array(n), X0 = cp.map(dotPos);
        const d2 = (a, b) => (X0[a][0] - X0[b][0]) ** 2 + (X0[a][1] - X0[b][1]) ** 2 + (X0[a][2] - X0[b][2]) ** 2;
        for (let it = 0, cur = 0; it < n - 1; it++) {
          done[cur] = 1;
          let nx = -1;
          for (let j = 0; j < n; j++) if (!done[j]) { const q = d2(cur, j); if (q < best[j]) { best[j] = q; from[j] = cur; } if (nx < 0 || best[j] < best[nx]) nx = j; }
          ties.push([cp[from[nx]], cp[nx]]); cur = nx;
        }
      }
      const places = [];
      for (let l = l0(pp); l < l1(pp); l++) places.push({ name: lPlace[l] < 13 ? PLACE_NAME[lPlace[l]] : '', face: faceText(l), main: !!(P.main[pp] >> lPlace[l] & 1) });
      FO.info = { kind: 'protein', p: pp, sym: P.sym[pp], none, places, copies: cp.length, ties: !!tie, rel: P.rel[pp], all, links: t[0] + t[1] + t[2] + t[3], drawn: links.length, t, ev, partners: partners.size, why: [0, 0] };
      for (let j = aOff[pp]; j < aOff[pp + 1]; j++) { const i = adj[j]; if (hasKind(i, NET.kind) && L.why[i]) FO.info.why[L.why[i] - 1]++; }
    } else if (pc >= 0 && pc < 13) {
      let here = 0;
      for (let l = 0; l < NLOC; l++) if (lPlace[l] === pc) here++;
      let inner = 0;
      for (let o = 0; o < E; o++) {
        const i = ORDER[o];
        if (L.cls[i] || lPlace[L.a[i]] !== pc || lPlace[L.b[i]] !== pc || !hasKind(i, NET.kind)) continue;
        inner++;
        if (links.length < FOCUS_MAX) links.push(i);
      }
      FO.info = { kind: 'place', place: pc, name: PLACE_NAME[pc], here, inner, shown: links.length };
    }
    const geo = links.length || ties.length ? linesGeo(links, ties, true, !!(FO.info && FO.info.kind === 'protein')) : null;   // (adds the dots it needs)
    // the cell's own lights: the pick's dots bright (aFocus, all reached), the protein ringed (uSel), a place alone (uIso)
    const lit = new Set();
    for (const k of links) siteOf(k).forEach(d => lit.add(d));
    for (const [a, b] of ties) { lit.add(a); lit.add(b); }
    if (pp >= 0 && pp < NP) for (let l = l0(pp); l < l1(pp); l++) lit.add(dotOf(l));
    const aF = NET.dots.geometry.attributes.aFocus;
    aF.array.fill(0);
    for (const d of lit) if (d < NET.nMain) aF.array[d] = 1;
    // (the picked protein's own dots, at its places: 2, ringed; its copies beside partners stay plain dots)
    const own = new Set();
    if (pp >= 0 && pp < NP) for (let l = l0(pp); l < l1(pp); l++) own.add(dotOf(l));
    for (const d of own) if (d < NET.nMain) aF.array[d] = 2;
    aF.needsUpdate = true;
    if (D.loc.length > NET.nMain) {
      const g = dotsGeo(NET.nMain, D.loc.length);
      g.attributes.aFocus.array.fill(1);
      for (const d of own) if (d >= NET.nMain) g.attributes.aFocus.array[d - NET.nMain] = 2;
      NET.extra = new THREE.Points(g, nodeMat); NET.extra.renderOrder = 5; NET.extra.frustumCulled = false; set.group.add(NET.extra);
    }
    const prot = !!(FO.info && FO.info.kind === 'protein'), place = !!(FO.info && FO.info.kind === 'place');
    NU.uFocus.value = prot ? 1 : 0; NU.uPathProg.value = prot ? 10 : 0; NU.uSel.value = prot ? pp : -1; NU.uIso.value = place ? pc : -1;
    RU.uFocus.value = prot ? 1 : 0; RU.uIso.value = place ? pc : -1;
    NET.flagK = prot || place ? 0.15 : 0.6;   // (0.6: dense amber through the nucleus reads without burning)
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
    const Pd = D.pos;
    for (let c = 0; c < NET.nMain; c++) {
      pq.set(Pd[3 * c], Pd[3 * c + 1], Pd[3 * c + 2]);
      const t = pd.copy(pq).sub(ray.origin).dot(ray.direction);
      if (t <= 0) continue;
      const d = ray.distanceSqToPoint(pq), rr = 0.008 + 0.012 * t;   // (reach grows with distance, as a dot's size on screen)
      if (d < rr * rr) { const sc = d / (rr * rr) + t * 0.15; if (sc < bs) { bs = sc; best = c; } }
    }
    return best;
  }

  // the kinds of evidence, as the panes name them (PDATA.kinds, in its order)
  const KIND_NAME = ['Regulatory', 'Binary', 'Literature', 'Metabolic', 'Complexes', 'Kinase', 'Signalling'];
  return Object.assign(set, {
    // cell_ties: a picked protein's copies joined by fine dots (1) or not (0)
    params: { cell_a: 1, cell_shell: 1, cell_net: 1, cell_amb: 1, cell_red: 1, cell_show: 0, cell_faces: 0, cell_kind: -1, cell_pp: -1, cell_pc: -1, cell_ties: 1 },
    update(S) {
      const show = clamp(Math.round(S.cell_show), 0, 3), g = S.cell_faces > 0.5 ? 1 : 0, kind = clamp(Math.round(S.cell_kind), -1, 6);
      if (show !== NET.show || g !== NET.g || kind !== NET.kind) build(show, g, kind);
      setFocus(Math.round(S.cell_pp), Math.round(S.cell_pc), S.cell_ties > 0.5 ? 1 : 0);
      const sh = clamp(S.cell_shell, 0, 1);
      shells.visible = sh > 0.01;
      for (const m of shellMats) m.uniforms.uK.value = sh;
      // (cell_net: the dots and links, all or none; the story keeps the cell empty until the interactome comes in)
      const net = clamp(S.cell_net, 0, 1);
      NU.uAlpha.value = net; RU.uAlpha.value = 0.55 * net; flagMat.uniforms.uK.value = NET.flagK * net;
      flagMat.uniforms.uAmb.value = clamp(S.cell_amb, 0, 1); flagMat.uniforms.uRed.value = clamp(S.cell_red, 0, 1);
      for (const o of [NET.dots, NET.dotsZ, NET.routes, NET.flags, NET.flagsG, NET.extra, FO.mesh]) if (o) o.visible = net > 0.003;
      // points sized as the cell's: in a headset by distance (XR.pointK 0.0028 of the drawn height, in the set's own units),
      // on a screen a fixed size in pixels that grows a little as the camera comes closer
      const xr = GL.renderer && GL.renderer.xr.isPresenting;
      NU.uPx.value = xr ? K.U.uPx.value * 0.0028 : 0;
      NU.uScale.value = xr ? 1 : GL.renderer.getPixelRatio() * clamp(3.6 / GL.camera.position.length(), 0.75, 2.4);
    },
    // what is drawn now, for the pane
    stats: () => NET,
    // picking (explore mode): the dot under a ray, what a dot is, a protein by its symbol, and what the pick shows
    api: () => ({
      pick: pickCopy, places: PLACE_NAME, kinds: KIND_NAME, focus: () => FO.info,
      find: s => { const p = BYSYM.get(String(s || '').trim().toUpperCase()); return p === undefined ? -1 : p; },
      sym: p => P.sym[p] || '',
      // the story's: the cell's shapes and the places' colours (the other sets draw over it), a protein's number of links,
      // where a protein without a place would stand outside, and the background as drawn for show (strict, every kind):
      // its dots (positions, protein, place) and its links (two dots each, a class and a colour)
      CELL, placeCol: PLACE_COL, deg: p => degP[p] || 0, outPos: p => spot(13, 0, mul(31 * uLoc[p] + 1), 0)[0],
      net(show) {
        if (NET.show !== show || NET.g !== 0 || NET.kind !== -1) build(show, 0, -1);
        const n = NET.nMain, prot = new Uint16Array(n), place = new Uint8Array(n), bg = NET.bg, ab = new Int32Array(2 * bg.length), cls = new Uint8Array(bg.length), col = new Float32Array(3 * bg.length);
        for (let i = 0; i < n; i++) { prot[i] = lProt[D.loc[i]]; place[i] = lPlace[D.loc[i]]; }
        bg.forEach((k, j) => { const [a, b] = siteOf(k); ab[2 * j] = a; ab[2 * j + 1] = b; cls[j] = NET.L.cls[k]; col.set(linkCol(k), 3 * j); });
        return { n, pos: Float32Array.from(D.pos.slice(0, 3 * n)), prot, place, ab, cls, col, tally: NET.tally.slice(), drawnBy: NET.drawnBy.slice() };
      },
      copy: c => { if (!NET.dots || !(c >= 0 && c < NET.nMain)) return null; const l = D.loc[c]; return { prot: lProt[l], sym: P.sym[lProt[l]], place: lPlace[l], deg: degP[lProt[l]], face: faceText(l), pos: dotPos(c) }; },
    }),
    anchors: { centre: [0, 0, 0], nucleus: CELL.nuc.c, edge: [0.95, 0.35, 0] },
    labels: [],
    cam: { default: [20, 14, 3.6, 0, 0, 0], inside: [30, 6, 0.55, 0.15, 0, 0.1] },
    controls: [
      { key: 'show', label: 'Show', options: [['0', 'Possible'], ['1', '+ through gates'], ['2', '+ impossible'], ['3', '+ not judged']] },
      { key: 'faces', label: 'Reading', options: [['0', 'Strict'], ['1', 'Generous']] },
      { key: 'kind', label: 'Evidence', options: [['-1', 'All'], ...KIND_NAME.map((n, k) => [String(k), n])] },
      { key: 'shells', label: 'Organelles', options: [['1', 'On'], ['0', 'Off']] },
      { key: 'view', label: 'View', options: [['default', 'Outside'], ['inside', 'Inside']] },
    ],
    explore(c) {
      return { cell_shell: c.shells === '0' ? 0 : 1, cell_show: +c.show || 0, cell_faces: +c.faces || 0, cell_kind: c.kind === undefined ? -1 : +c.kind };
    },
  });
};
