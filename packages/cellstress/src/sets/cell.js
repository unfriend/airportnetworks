// The stress test's one set: the cell map story's model cell (stories/spatial.js: the same membrane, nucleus, ER, Golgi,
// mitochondria, small organelles and cytoskeleton, drawn with the same shaders), filled with as many made-up proteins and
// links as the controls ask, so a headset's frame rate can be read at each size (the shell's read-out: a double press of
// B or Y). Nothing here is data: places, copies and links are drawn from a seeded random number generator, shaped like
// the cell map's (about a third of the proteins in two or more places, most links inside one place, a few hubs).
// What it costs is what the cell costs: one Points draw for every copy, one LineSegments draw for every link (each a
// curve of `curve` pieces, every vertex carrying the cell's ten attributes), and the see-through organelle skins.
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

  // ------------------------------------------------------------ places: where a copy of a protein can sit
  // the cell map's thirteen places and their colours; each gives a random spot and the centre a link there bends round
  const PLACE_COL = [[0.55, 0.78, 1.0], [0.66, 0.54, 1.0], [0.95, 0.6, 1.0], [0.35, 0.95, 0.6], [1.0, 0.78, 0.3], [1.0, 0.45, 0.35],
    [1.0, 0.4, 0.78], [0.2, 0.88, 0.82], [0.78, 0.95, 0.3], [0.6, 0.9, 1.0], [0.75, 0.6, 1.0], [0.9, 0.9, 0.95], [0.45, 0.7, 1.0]];
  // how many proteins each place gets, roughly as in the Human Protein Atlas (cytosol and nucleoplasm the largest)
  const SHARE = [0.2, 0.22, 0.04, 0.07, 0.06, 0.08, 0.02, 0.03, 0.01, 0.1, 0.04, 0.06, 0.07];
  const sphere = (r, R) => { const u = K.unit(r); return v3.mul(u, R); };
  const inBall = (r, c, R) => v3.add(c, v3.mul(K.unit(r), R * Math.cbrt(r())));
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  const spot = (pl, r) => {
    const N = CELL.nuc;
    switch (pl) {
      case 0: { for (;;) { const p = inBall(r, [0, 0, 0], 0.9); const q = [p[0] * CELL.pm[0], p[1] * CELL.pm[1], p[2] * CELL.pm[2]]; if (v3.len(v3.sub(q, N.c)) > 0.56 && CELL.eScale(q) < 0.9) return [q, [0, 0, 0]]; } }
      case 1: return [inBall(r, N.c, N.r * 0.9), N.c];
      case 2: return [inBall(r, CELL.nucl.c, CELL.nucl.r * 0.9), CELL.nucl.c];
      case 3: { for (;;) { const k = Math.floor(r() * 3), d = K.unit(r); if (CELL.erMask(d, k) > 0.05) return [v3.add(N.c, v3.mul(d, CELL.er.r[k])), N.c]; } }
      case 4: { for (;;) { const k = Math.floor(r() * 5), d = K.unit(r); if (Math.acos(clamp(v3.dot(d, CELL.gdir), -1, 1)) < CELL.golgi.ang[k]) return [v3.add(N.c, v3.mul(d, CELL.golgi.r[k])), N.c]; } }
      case 5: { const m = pick(r, CELL.mitos), x = (r() * 2 - 1) * m.a * 0.85, o = v3.mul(perp(m.axis), m.b * 0.6 * r()); return [v3.add(v3.add(m.c, v3.mul(m.axis, x)), o), m.c]; }
      case 6: { const o = pick(r, CELL.lysos); return [inBall(r, o.c, o.r * 0.85), o.c]; }
      case 7: { const o = pick(r, CELL.endos); return [inBall(r, o.c, o.r * 0.85), o.c]; }
      case 8: { const o = pick(r, CELL.peroxs); return [inBall(r, o.c, o.r * 0.85), o.c]; }
      case 9: { const d = K.unit(r); return [v3.mul(d, 0.985 / CELL.eScale(d)), [0, 0, 0]]; }
      case 10: return [v3.add(N.c, sphere(r, N.r * 1.01)), N.c];
      case 11: { const m = pick(r, CELL.mts), k = Math.floor(r() * (m.length - 1)), f = r(); return [v3.add(v3.lerp(m[k], m[k + 1], f), v3.mul(K.unit(r), 0.01)), CELL.centro]; }
      default: { const d = K.unit(r); return [v3.mul(d, (0.8 + 0.1 * r()) / CELL.eScale(d)), [0, 0, 0]]; }
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

  // ------------------------------------------------------------ the network, built again whenever its size changes
  const NET = { n: 0, e: 0, seg: 0, copies: 0, pieces: 0, verts: 0, ms: 0, dots: null, routes: null };
  function build(n, e, seg) {
    const t0 = performance.now();
    if (NET.dots) { set.group.remove(NET.dots); NET.dots.geometry.dispose(); }
    if (NET.routes) { set.group.remove(NET.routes); NET.routes.geometry.dispose(); }
    const r = mul(1000 + n);
    // proteins: each in one place, about a third in a second, a few in a third (as in the cell map); a copy per place
    const cProt = [], cPlace = [], cCtr = [], pos = [], byPlace = PLACE_COL.map(() => []), copiesOf = [];
    for (let p = 0; p < n; p++) {
      const k = r() < 0.1 ? 3 : r() < 0.3 ? 2 : 1, own = [];
      for (let j = 0; j < k; j++) {
        let pl = drawPlace(r);
        for (let tries = 0; own.includes(pl) && tries < 8; tries++) pl = drawPlace(r);
        if (own.includes(pl)) continue;
        own.push(pl);
        const [q, ctr] = spot(pl, r), c = cProt.length;
        cProt.push(p); cPlace.push(pl); cCtr.push(ctr); pos.push(...q); byPlace[pl].push(c);
      }
      copiesOf.push(own.length);
    }
    const NC = cProt.length;
    // links: ends drawn with weights that fall off with a copy's rank, so a few become hubs; most inside one place
    const wt = new Float64Array(NC);
    for (let c = 0; c < NC; c++) wt[c] = Math.pow(1 + Math.floor(r() * NC), -0.75);
    const cumOf = list => { const a = new Float64Array(list.length); let s = 0; list.forEach((c, i) => { s += wt[c]; a[i] = s; }); return a; };
    const cumAll = cumOf([...Array(NC).keys()]), cumPl = byPlace.map(cumOf);
    const draw = (cum, list) => { const x = r() * cum[cum.length - 1]; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; } return list ? list[lo] : lo; };
    const eu = new Int32Array(e), ev = new Int32Array(e), deg = new Float32Array(NC);
    for (let i = 0; i < e; i++) {
      const u = draw(cumAll);
      let v = r() < 0.65 && byPlace[cPlace[u]].length > 1 ? draw(cumPl[cPlace[u]], byPlace[cPlace[u]]) : draw(cumAll);
      for (let tries = 0; (v === u || cProt[v] === cProt[u]) && tries < 6; tries++) v = draw(cumAll);
      eu[i] = u; ev[i] = v; deg[u]++; deg[v]++;
    }
    let maxDeg = 1;
    for (let c = 0; c < NC; c++) maxDeg = Math.max(maxDeg, deg[c]);
    // the copies: one Points draw, with the cell's ten attributes
    const pg = new THREE.BufferGeometry(), f = () => new Float32Array(NC);
    const at = { aIdx: f(), aProt: f(), aRand: f(), aPlace: f(), aDeg: f(), aMulti: f(), aScen: f(), aMode: f(), aFocus: f(), aSize: f() };
    const lmax = Math.log1p(maxDeg);
    for (let c = 0; c < NC; c++) {
      at.aIdx[c] = c; at.aProt[c] = cProt[c]; at.aRand[c] = r(); at.aPlace[c] = cPlace[c];
      at.aDeg[c] = Math.log1p(deg[c]) / lmax; at.aMulti[c] = copiesOf[cProt[c]];
      at.aSize[c] = 3.0 + 5.0 * Math.sqrt(deg[c] / maxDeg);
    }
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    for (const [k, a] of Object.entries(at)) pg.setAttribute(k, new THREE.BufferAttribute(a, 1));
    NET.dots = new THREE.Points(pg, nodeMat); NET.dots.renderOrder = 5; NET.dots.frustumCulled = false;
    // the links: one LineSegments draw, each link a quadratic curve of seg pieces bending away from its place's centre
    const m = seg + 1, tot = e * m;
    const rp = new Float32Array(tot * 3), aT = new Float32Array(tot), aRv = new Float32Array(tot), aCol = new Float32Array(tot * 3);
    const ea = { aPlA: new Float32Array(tot), aPlB: new Float32Array(tot), aScA: new Float32Array(tot), aMdA: new Float32Array(tot), aScB: new Float32Array(tot), aMdB: new Float32Array(tot) };
    const ri = new Uint32Array(e * seg * 2), P = (c, j) => pos[3 * c + j];
    let o = 0, oi = 0;
    for (let i = 0; i < e; i++) {
      const u = eu[i], v = ev[i], same = cPlace[u] === cPlace[v], col = same ? PLACE_COL[cPlace[u]] : [0.86, 0.9, 1.0], rv = r();
      const pa = [P(u, 0), P(u, 1), P(u, 2)], pb = [P(v, 0), P(v, 1), P(v, 2)], mid = v3.lerp(pa, pb, 0.5);
      let ctl = mid;
      if (same) {
        let off = v3.sub(mid, cCtr[u]);
        if (v3.len(off) < 1e-4) off = perp(v3.norm(v3.sub(pb, pa)));
        ctl = v3.add(mid, v3.mul(v3.norm(off), v3.len(v3.sub(pb, pa)) * 0.2));
      }
      for (let k = 0; k < m; k++) {
        const t = k / seg, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c2 = t * t, x = o + k;
        for (let j = 0; j < 3; j++) rp[3 * x + j] = a * pa[j] + b * ctl[j] + c2 * pb[j];
        aT[x] = t; aRv[x] = rv; aCol[3 * x] = col[0]; aCol[3 * x + 1] = col[1]; aCol[3 * x + 2] = col[2];
        ea.aPlA[x] = cPlace[u]; ea.aPlB[x] = cPlace[v];
        if (k < seg) { ri[oi++] = x; ri[oi++] = x + 1; }
      }
      o += m;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    rg.setAttribute('aT', new THREE.BufferAttribute(aT, 1)); rg.setAttribute('aRv', new THREE.BufferAttribute(aRv, 1));
    rg.setAttribute('aCol', new THREE.BufferAttribute(aCol, 3));
    for (const [k, a] of Object.entries(ea)) rg.setAttribute(k, new THREE.BufferAttribute(a, 1));
    rg.setIndex(new THREE.BufferAttribute(ri, 1));
    NET.routes = new THREE.LineSegments(rg, routeMat); NET.routes.renderOrder = 4; NET.routes.frustumCulled = false;
    set.group.add(NET.routes, NET.dots);
    Object.assign(NET, { n, e, seg, copies: NC, pieces: e * seg, verts: tot, ms: Math.round(performance.now() - t0) });
    if (set.onBuild) set.onBuild();
  }

  const N_OPT = [250, 1000, 2500, 5000, 10000, 20000], E_OPT = [375, 2000, 5000, 10000, 20000, 40000, 80000], SEG_OPT = [14, 6, 1];
  const near = (list, x) => list.reduce((b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b), list[0]);
  const fmtK = v => (v >= 1000 ? (v % 1000 ? (v / 1000).toFixed(1) : v / 1000) + 'k' : String(v));
  return Object.assign(set, {
    params: { cell_a: 1, cell_n: 250, cell_e: 375, cell_seg: 14, cell_shell: 1 },
    update(S) {
      const n = near(N_OPT, S.cell_n), e = near(E_OPT, S.cell_e), seg = near(SEG_OPT, S.cell_seg);
      if (n !== NET.n || e !== NET.e || seg !== NET.seg) build(n, e, seg);
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
    anchors: { centre: [0, 0, 0], nucleus: CELL.nuc.c, edge: [0.95, 0.35, 0] },
    labels: [],
    cam: { default: [20, 14, 3.6, 0, 0, 0], inside: [30, 6, 0.55, 0.15, 0, 0.1] },
    controls: [
      { key: 'np', label: 'Proteins', options: N_OPT.map(v => [String(v), fmtK(v)]) },
      { key: 'nl', label: 'Links', options: E_OPT.map(v => [String(v), fmtK(v)]) },
      { key: 'curve', label: 'Pieces per link', options: [['14', '14 (as the cell)'], ['6', '6'], ['1', 'Straight']] },
      { key: 'shells', label: 'Organelles', options: [['1', 'On'], ['0', 'Off']] },
      { key: 'view', label: 'View', options: [['default', 'Outside'], ['inside', 'Inside']] },
    ],
    explore(c) { return { cell_n: +c.np || 250, cell_e: +c.nl || 375, cell_seg: +c.curve || 14, cell_shell: c.shells === '0' ? 0 : 1 }; },
  });
};
