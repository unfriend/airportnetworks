// Real proteins as balls, the crowd's way (chapter 2) shared with the lenses (chapter 6) and what it would take
// (chapter 8): each molecule its few coarse balls from the Protein Data Bank (PPI_STRUCTS' `coarse`: its residues
// grouped), every ball one point drawn as a lit sphere with its true depth (a sphere impostor), a whole crowd in one draw.
// BALLS.of(key, per): a molecule's balls in scene units (per: scene units per angstrom); BALLS.reach(balls): how far its
// balls reach from its middle; BALLS.mat(set, U): the material (U: uT, uJig, uHalf, uMark and, if the crowd fades on its
// own, its own uA); BALLS.half(): the points' scale, half the drawn height in pixels (a headset's eye or the page's);
// BALLS.cloud(set, mols, opts): a crowd whose molecules each move as one ({ balls, c } each), placed with place(i, ...).
const BALLS = (() => {
  const v2 = new THREE.Vector2();
  const of = (key, per) => PPI_STRUCTS[key].coarse.map(b => [b[0] / 10 * per, b[1] / 10 * per, b[2] / 10 * per, b[3] / 10 * per]);
  const reach = balls => Math.max(...balls.map(b => Math.hypot(b[0], b[1], b[2]) + b[3]));
  const half = () => {
    const r = GL.renderer;
    return r.xr.isPresenting && typeof XR !== 'undefined' && XR.viewH ? XR.viewH / 2 : r.getDrawingBufferSize(v2).y / 2;
  };
  // (each ball a lit sphere: a point as big as the ball on screen, its round face shaded and its depth written where the
  // sphere's surface is, so neighbouring balls meet as spheres do; a ball of radius 0 is not drawn)
  function mat(set, U) {
    const D = { uA: set.uA, uT: { value: 0 }, uJig: { value: 0 }, uHalf: { value: 400 }, uMark: { value: 0 } };
    for (const k in D) if (!U[k]) U[k] = D[k];   // (filled in place: the caller keeps its uniforms)
    const m = new THREE.ShaderMaterial({
      uniforms: U, depthWrite: true, extensions: { fragDepth: true },
      vertexShader: `
attribute float aRad, aPh, aMark; attribute vec3 aCol;
uniform float uT, uJig, uHalf, uMark;
varying vec3 vC, vP; varying float vR;
void main() {
  if (aRad <= 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  vec3 p = position + uJig * vec3(sin(uT * 1.7 + aPh), sin(uT * 1.3 + aPh * 2.1), sin(uT * 1.9 + aPh * 0.7));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float r = aRad * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(2.0 * r * projectionMatrix[1][1] * uHalf / max(-mv.z, 0.001), 1.0, 256.0);
  vec3 lit = mix(aCol, vec3(0.27, 0.85, 1.0), aMark * uMark);
  vC = lit * (aMark > 0.5 ? 1.0 : 1.0 - 0.6 * uMark); vP = mv.xyz; vR = r;
}`,
      fragmentShader: `
uniform float uA; uniform mat4 projectionMatrix;   // (three.js declares it only in the vertex shader)
varying vec3 vC, vP; varying float vR;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0; c.y = -c.y;
  float d2 = dot(c, c);
  if (d2 > 1.0) discard;
  vec3 n = vec3(c, sqrt(1.0 - d2));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
  float diff = max(dot(n, L), 0.0), spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  float rim = pow(1.0 - n.z, 2.0);
  vec3 col = vC * (0.42 + 0.62 * diff) * (0.78 + 0.22 * n.z) + 0.22 * spec + 0.18 * rim * vC;
  vec4 clip = projectionMatrix * vec4(vP + n * vR, 1.0);
  gl_FragDepthEXT = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(col, uA);
}`,
    });
    // (see-through only while it fades, as the kit's materials are)
    Object.defineProperty(m, 'transparent', { configurable: true, get: () => U.uA.value < 0.999, set() {} });
    set.mats.push(m);
    return m;
  }
  // a crowd of molecules that move: mols [{ balls, c: [r, g, b] } (or cols, a colour a ball)]; place(i, pos, quat, k) puts molecule i at pos, turned by
  // quat (a THREE.Quaternion or null), k times its size (0 hides it); tint(i, c); tick(t) once a frame, after the places
  function cloud(set, mols, opts = {}) {
    const NB = mols.reduce((s, m) => s + m.balls.length, 0), first = [];
    const pos = new Float32Array(3 * NB), rad = new Float32Array(NB), col = new Float32Array(3 * NB), ph = new Float32Array(NB), mk = new Float32Array(NB), loc = new Float32Array(4 * NB);
    let n = 0;
    mols.forEach((m, i) => {
      first.push(n);
      const p = m.ph === undefined ? i * 2.39996 : m.ph;
      m.balls.forEach((b, k) => { loc.set(b, 4 * n); rad[n] = b[3]; col.set(m.cols ? m.cols[k] : m.c, 3 * n); ph[n] = p; pos.set(b.slice(0, 3), 3 * n); n++; });
    });
    first.push(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRad', new THREE.BufferAttribute(rad, 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1)); g.setAttribute('aMark', new THREE.BufferAttribute(mk, 1));
    const U = { uT: { value: 0 }, uJig: { value: opts.jig || 0 }, uHalf: { value: 400 }, uMark: { value: 0 } };
    if (opts.own) U.uA = { value: 1 };
    const points = new THREE.Points(g, mat(set, U)); points.frustumCulled = false;
    const V = new THREE.Vector3();
    let moved = false, tinted = false;
    return { points, U, n: mols.length, balls: NB,
      place(i, p, q, k = 1) {
        for (let j = first[i]; j < first[i + 1]; j++) {
          V.set(loc[4 * j] * k, loc[4 * j + 1] * k, loc[4 * j + 2] * k); if (q) V.applyQuaternion(q);
          pos[3 * j] = p[0] + V.x; pos[3 * j + 1] = p[1] + V.y; pos[3 * j + 2] = p[2] + V.z; rad[j] = loc[4 * j + 3] * k;
        }
        moved = true;
      },
      tint(i, c) { for (let j = first[i]; j < first[i + 1]; j++) col.set(c, 3 * j); tinted = true; },
      tick(t) {
        U.uT.value = t; U.uHalf.value = half();
        if (moved) { g.attributes.position.needsUpdate = true; g.attributes.aRad.needsUpdate = true; moved = false; }
        if (tinted) { g.attributes.aCol.needsUpdate = true; tinted = false; }
      } };
  }
  // drop each molecule (its reach) where it overlaps none placed before, nor the obstacles ([{ p, r }]): spot() a candidate
  // middle, tries of them, then it takes the last
  function scatter(reaches, spot, tol = 0.95, tries = 60, obst = []) {
    const out = obst.slice();
    reaches.forEach(rr => {
      let p;
      for (let k = 0; k < tries; k++) { p = spot(); if (out.every(o => Math.hypot(o.p[0] - p[0], o.p[1] - p[1], o.p[2] - p[2]) > tol * (o.r + rr))) break; }
      out.push({ p, r: rr });
    });
    return out.slice(obst.length).map(o => o.p);
  }
  return { of, reach, half, mat, cloud, scatter };
})();
