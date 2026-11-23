// Networks across scales, and the institute (slides 30-33 and 42). A glowing tower of eight length scales, from DNA
// bases (1 nm) to the body (1 m), each floor a holographic disc with a small 3D emblem; a spiral time axis from a
// microsecond to a lifetime; small live networks at four scales; medicine feeding in at the top and the bottom; the four
// research groups as rings at their scales, joined by synergy arcs; and the team as a slowly turning constellation.
SETS.scale = function (K) {
  const { THREE, v3, smooth, clamp, lerp, prog } = K;
  const set = K.newSet('scale');
  const TAU = Math.PI * 2, D2R = Math.PI / 180, C = K.rgb;
  // a point at radius r to the right of the tower as seen from azimuth az (degrees), at height y
  const right = (az, r, y) => [r * Math.cos(az * D2R), y, -r * Math.sin(az * D2R)];

  // ------------------------------------------------------------------ layout
  const NF = 8, FY0 = -1.15, FDY = 0.3, FR = 0.4;          // floors: count, lowest height, spacing, disc radius
  const fy = k => FY0 + FDY * k;
  const FLOORS = [['DNA bases', '1 nm'], ['Proteins', '10 nm'], ['Complexes', '100 nm'], ['Organelles', '1 µm'],
    ['Cells', '10 µm'], ['Tissues', '1 mm'], ['Organs', '10 cm'], ['Body', '1 m']];
  const FCOL = Array.from({ length: NF }, (_, k) => v3.lerp(C('#19c6bd'), C('#4a86ff'), k / (NF - 1)));
  const FLAZ = 10;                                         // floor labels sit on the right as seen from the tower views
  // time: log10 seconds mapped up a spiral around the tower
  const TL0 = -6.6, TL1 = 9.9, TH = { r: 0.56, turns: 1.75, th0: -82 * D2R, y0: -1.2, y1: 1.16 };
  const tu = L => (L - TL0) / (TL1 - TL0);
  const helix = (u, h = TH, r = h.r) => { const a = h.th0 + TAU * h.turns * u; return [r * Math.sin(a), lerp(h.y0, h.y1, u), r * Math.cos(a)]; };
  const TIMES = [['Electron transfer', '1 µs, in cytochromes', -6], ['Neurons fire', '1 ms', -3], ['Enzyme turnover', '~10 ms', -2],
    ['Protein folding', '~1 s', 0], ['Protein translation', '~1 min', 1.78], ['Protein half-life', 'hours to days', 4.4],
    ['Circadian clock', '1 day', 4.94], ['Red blood cell', 'life span 4 months', 7.02], ['Human life span', '80 years', 9.4]];
  const TU = TIMES.map(m => tu(m[2]));
  // networks at four scales
  const NETS = [
    { f: 1, col: '#46d9ff', cls: 'cyn', text: ['Protein-protein', 'interactions'], n: 16 },
    { f: 4, col: '#3ee08f', cls: 'grn', text: ['Signalling', 'between cells'], n: 15 },
    { f: 6, col: '#ff5ad9', cls: 'mag', text: ['Inter-organ', 'communication'], n: 13 },
    { f: 7, col: '#ffb43b', cls: 'amb', text: ['Contagion', 'from person to person'], n: 18 },
  ];
  const NAZ = 50;
  NETS.forEach(N => { N.c = C(N.col); });
  // medicine: a column of three bubbles beside the tower, arrows into the top and bottom floors
  const MAZ = 50, MRHO = 0.9, MY = [0.42, 0, -0.42], MBR = 0.12;
  const MED = [['Diagnosis', ''], ['Treatment', ''], ['Prevention', 'nutrition and lifestyle']];
  const mp = (rho, y) => right(MAZ, rho, y);
  // the four research groups: bands at their scales (RG4 spans the whole tower)
  const RG = [
    { text: ['RG1', 'Molecular networks'], col: '#46d9ff', cls: 'cyn', y: [-0.93, -0.37], r: 0.5, floors: [1, 2] },
    { text: ['RG2', 'Cellular networks'], col: '#3ee08f', cls: 'grn', y: [-0.03, 0.56], r: 0.5, floors: [4, 5] },
    { text: ['RG3', 'Population health'], col: '#ffb43b', cls: 'amb', y: [0.88, 1.25], r: 0.5, floors: [7] },
    { text: ['RG4', 'DataDiVR'], col: '#ff5ad9', cls: 'mag', y: [-1.24, 1.27], r: 0.64, floors: [] },
  ];
  const RGAZ = 100;
  RG.forEach(R => { R.c = C(R.col); });
  // element groups: each has a visibility uV[g] and a reveal uR[g], set every frame in update()
  const G = { time: 8, net: 9, med: 13, rg: 14, syn: 18, link: 19, halo: 20, dust: 21, motes: 22, shell: 23, star: 24, spark: 25 };
  const NG = 26;
  const uV = { value: new Float32Array(NG) }, uR = { value: new Float32Array(NG) };

  // ---------------------------------------------------------------- helpers
  const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
  const _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  // a cylinder from a to b
  function rod(a, b, rad, seg, open, rad2) {
    const d = v3.sub(b, a), L = v3.len(d) || 1e-6;
    const g = new THREE.CylinderGeometry(rad2 === undefined ? rad : rad2, rad, L, seg || 6, 1, !!open);
    _q.setFromUnitVectors(_up, _d.set(d[0] / L, d[1] / L, d[2] / L));
    return g.applyMatrix4(_m.compose(_p.set(...v3.lerp(a, b, 0.5)), _q, _s));
  }
  const ball = (p, rad, w = 12) => new THREE.SphereGeometry(rad, w, Math.max(6, Math.round(w * 0.7))).translate(p[0], p[1], p[2]);
  const P = (geo, c) => K.paint(geo, c);
  const lathe = (pts, seg, p0, pl) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg, p0 || 0, pl || TAU);
  // a tube along a dense polyline (frames carried along the line; much cheaper than a curve-based TubeGeometry);
  // uv.x is the arc-length fraction
  function ptube(pts, rad, radial) {
    const n = pts.length, R = radial || 5, W = R + 1, pos = new Float32Array(n * W * 3), nor = new Float32Array(n * W * 3), uv = new Float32Array(n * W * 2);
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + v3.dist(pts[i - 1], pts[i]));
    const L = cum[n - 1] || 1;
    let N = null;
    for (let i = 0; i < n; i++) {
      const T = v3.norm(v3.sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
      if (!N) { const ax = Math.abs(T[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; N = v3.norm(v3.cross(T, ax)); } else N = v3.norm(v3.sub(N, v3.mul(T, v3.dot(N, T))));
      const B = v3.cross(T, N), p = pts[i];
      for (let j = 0; j <= R; j++) {
        const a = j / R * TAU, c = Math.cos(a), sn = Math.sin(a), k = i * W + j;
        const dx = N[0] * c + B[0] * sn, dy = N[1] * c + B[1] * sn, dz = N[2] * c + B[2] * sn;
        pos[3 * k] = p[0] + dx * rad; pos[3 * k + 1] = p[1] + dy * rad; pos[3 * k + 2] = p[2] + dz * rad;
        nor[3 * k] = dx; nor[3 * k + 1] = dy; nor[3 * k + 2] = dz; uv[2 * k] = cum[i] / L; uv[2 * k + 1] = j / R;
      }
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < R; j++) { const a = i * W + j, b = a + W; idx.push(a, a + 1, b, b, a + 1, b + 1); }   // counter-clockwise from outside
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  // m points on a smooth curve through a few points
  const smoothPts = (pts, m) => new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))).getPoints(m - 1).map(v => [v.x, v.y, v.z]);

  // one merged mesh for glowing tubes, rings and glassy shells, drawn by a single shader
  // tubes use front faces only (so near and far tubes match); glassy shells show both walls
  const glowMat = side => new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uV, uR },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side,
    vertexShader: `
uniform float uV[${NG}], uR[${NG}];
attribute vec3 aCol; attribute float aA, aF, aU, aK; attribute vec2 aD, aQ;
varying vec3 vC, vN, vW; varying float vA, vU, vK, vRev; varying vec2 vQ;
void main() {
  int g = int(aF + 0.5);
  float rev = clamp((uR[g] - aD.x) * aD.y, 0.0, 1.0);
  vRev = rev; vU = aU; vK = aK; vQ = aQ; vC = aCol;
  vA = aA * uV[g] * min(1.0, rev * 4.0);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
  if (vA < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA, uTime;
varying vec3 vC, vN, vW; varying float vA, vU, vK, vRev; varying vec2 vQ;
void main() {
  if (vU > vRev) discard;
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float ndv = abs(dot(n, v));
  // tubes glow at their core (vK 0), shells at their rim (vK 1)
  float f = mix(0.3 + 0.7 * pow(ndv, 0.8), 0.03 + 0.97 * pow(1.0 - ndv, 2.5), vK);
  // a bright front while drawing, and pulses running along
  float head = vRev < 0.999 ? smoothstep(0.05, 0.0, vRev - vU) : 0.0;
  float p = vQ.x > 0.0 ? pow(max(0.0, sin((vU * vQ.x - uTime * vQ.y) * 6.2832)), 16.0) : 0.0;
  float e = (head + p) * (1.0 - 0.7 * vK), soft = mix(1.0, smoothstep(0.0, 0.06, vRev - vU), vK);   // shells fade out at a rising edge
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.35 * e) * (f + e), vA * uA * soft);
}`,
  });
  // merge indexed or plain geometries into one indexed geometry (keeps shared vertices: far less work than toNonIndexed)
  function mergeIndexed(list, names) {
    let nv = 0, ni = 0;
    for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const out = new THREE.BufferGeometry(), idx = new Uint32Array(ni);
    for (const nm of names) {
      const sz = list[0].attributes[nm].itemSize, arr = new Float32Array(nv * sz);
      let o = 0;
      for (const g of list) { arr.set(g.attributes[nm].array, o); o += g.attributes.position.count * sz; }
      out.setAttribute(nm, new THREE.BufferAttribute(arr, sz));
    }
    let v = 0, i = 0;
    for (const g of list) {
      const n = g.attributes.position.count;
      if (g.index) { const ix = g.index.array; for (let j = 0; j < ix.length; j++) idx[i++] = ix[j] + v; } else for (let j = 0; j < n; j++) idx[i++] = v + j;
      v += n;
    }
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }
  // one merged mesh for glowing tubes, rings and glassy shells
  function glowBuilder(mat) {
    const parts = [];
    set.mats.push(mat);
    // o: g (group), col [r,g,b] (and col2: blend to it along u), a, u (fn(x,y,z,uvx) or number), d [delay, 1/width], k (rim), q [pulses, speed]
    const add = (geo, o) => parts.push([geo, o]);
    // a straight glowing rod from a to b that draws from a
    function seg(a, b, rad, o) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L2 = dx * dx + dy * dy + dz * dz || 1;
      add(rod(a, b, rad, 4, true), Object.assign({ u: (x, y, z) => clamp(((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / L2, 0, 1) }, o));
    }
    function mesh() {
      const geo = mergeIndexed(parts.map(p => p[0]), ['position', 'normal']), nv = geo.attributes.position.count;
      const P = geo.attributes.position.array, col = new Float32Array(nv * 3), aA = new Float32Array(nv), aF = new Float32Array(nv),
        aU = new Float32Array(nv), aK = new Float32Array(nv), aD = new Float32Array(nv * 2), aQ = new Float32Array(nv * 2);
      let v = 0;
      for (const [g, o] of parts) {
        const n = g.attributes.position.count, uv = g.attributes.uv ? g.attributes.uv.array : null, v0 = v;
        const d = o.d || [0, 1], q = o.q || [0, 0], c0 = o.col, c1 = o.col2 || o.col, fu = typeof o.u === 'function' ? o.u : null, cu = typeof o.u === 'number' ? o.u : -1;
        for (let j = 0; j < n; j++, v++) {
          const u = fu ? fu(P[3 * v], P[3 * v + 1], P[3 * v + 2]) : cu >= 0 ? cu : uv ? uv[2 * j] : 0;
          aU[v] = u;
          col[3 * v] = c0[0] + (c1[0] - c0[0]) * u; col[3 * v + 1] = c0[1] + (c1[1] - c0[1]) * u; col[3 * v + 2] = c0[2] + (c1[2] - c0[2]) * u;
          aD[2 * v] = d[0]; aD[2 * v + 1] = d[1]; aQ[2 * v] = q[0]; aQ[2 * v + 1] = q[1];
        }
        aA.fill(o.a === undefined ? 1 : o.a, v0, v); aF.fill(o.g, v0, v); aK.fill(o.k || 0, v0, v);
      }
      for (const [nm, arr, sz] of [['aCol', col, 3], ['aA', aA, 1], ['aF', aF, 1], ['aU', aU, 1], ['aK', aK, 1], ['aD', aD, 2], ['aQ', aQ, 2]]) geo.setAttribute(nm, new THREE.BufferAttribute(arr, sz));
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      return m;
    }
    return { add, seg, mesh };
  }

  // glowing points; position is computed in the shader for moving kinds (aM): 0 node, 1 pulse along a link,
  // 2 flow up a helix, 3 circling a ring, 4 dissolving dust, 5 contagion node, 6 rising mote, 7 head of a growing helix,
  // 8 pulse along a curved link (quadratic Bezier through the control point aC)
  const ptMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime, uV, uR, uDust: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + `
uniform float uA, uDust, uV[${NG}], uR[${NG}];
attribute vec3 aCol, aB, aC; attribute float aSize, aA, aF, aM; attribute vec2 aP, aD;
varying vec3 vC; varying float vA;
vec3 helix(float u, vec3 h, vec2 y) { float th = h.z + 6.2832 * h.y * u; return vec3(h.x * sin(th), mix(y.x, y.y, u), h.x * cos(th)); }
void main() {
  int g = int(aF + 0.5);
  float rv = uR[g], rev = clamp((rv - aD.x) * aD.y, 0.0, 1.0);
  vec3 pos = position, c = aCol; float a = aA * uV[g], s = aSize;
  if (aM < 0.5) {
    a *= rev * (0.8 + 0.2 * sin(uTime * aP.y + aP.x * 6.2832)); s *= 0.3 + 0.7 * rev + 1.2 * rev * (1.0 - rev);
  } else if (aM < 1.5) {
    float x = fract(aP.x + uTime * aP.y); pos = mix(position, aB, x); a *= rev * sin(3.1416 * x);
  } else if (aM < 2.5) {
    float u = fract(aP.x + uTime * aP.y); pos = helix(u, aB, position.xy); a *= smoothstep(0.0, 0.02, rv - u);
  } else if (aM < 3.5) {
    float th = aP.x * 6.2832 + uTime * aP.y; pos = vec3(aB.x * sin(th), position.y, aB.x * cos(th)); a *= rev;
  } else if (aM < 4.5) {
    float e = clamp((uDust - aP.x) / 0.6, 0.0, 1.0), se = e * e * (3.0 - 2.0 * e), w = se * aP.y;
    pos = position + aB * se; pos.xz = mat2(cos(w), -sin(w), sin(w), cos(w)) * pos.xz;
    a *= smoothstep(0.0, 0.08, e) * (1.0 - smoothstep(0.4, 1.0, e));
  } else if (aM < 5.5) {
    float ph = fract(uTime / aP.y) * 1.5, inf = smoothstep(aB.x - 0.08, aB.x, ph) * (1.0 - smoothstep(1.3, 1.5, ph));
    c = mix(c, vec3(1.0, 0.24, 0.16), inf); s *= (0.3 + 0.7 * rev) * (1.0 + 0.45 * inf); a *= rev;
  } else if (aM < 6.5) {
    pos.y = -1.2 + mod(position.y + 1.2 + uTime * aP.y, 2.44); a *= smoothstep(0.0, 0.1, rv - pos.y);
  } else if (aM < 7.5) {
    pos = helix(min(rv, 0.999), aB, position.xy); a *= step(0.002, rv) * (1.0 - smoothstep(0.96, 1.0, rv));
  } else {
    float x = fract(aP.x + uTime * aP.y); pos = mix(mix(position, aC, x), mix(aC, aB, x), x); a *= rev * sin(3.1416 * x);
  }
  vC = c; vA = a * uA;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(s, mv);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
varying vec3 vC; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.18, d), glow = pow(1.0 - d * 2.0, 1.6), a = max(core * 0.85, glow * 0.6);
  gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.22, 0.0, d) * 0.35), vA * a);
}`,
  });
  set.mats.push(ptMat);
  function pointBuilder() {
    const A = { position: [], aCol: [], aSize: [], aA: [], aF: [], aM: [], aB: [], aC: [], aP: [], aD: [] };
    // o: g, col, s (size), a, m (kind), b ([x,y,z]), c (control point), p ([phase, speed]), d ([delay, 1/width])
    const add = (p, o) => {
      const c = o.col, b = o.b || [0, 0, 0], cc = o.c || [0, 0, 0], q = o.p || [0, 0], d = o.d || [0, 1];
      A.position.push(p[0], p[1], p[2]); A.aCol.push(c[0], c[1], c[2]); A.aSize.push(o.s); A.aA.push(o.a === undefined ? 1 : o.a);
      A.aF.push(o.g); A.aM.push(o.m || 0); A.aB.push(b[0], b[1], b[2]); A.aC.push(cc[0], cc[1], cc[2]); A.aP.push(q[0], q[1]); A.aD.push(d[0], d[1]);
    };
    const points = () => {
      const g = new THREE.BufferGeometry(), sz = { position: 3, aCol: 3, aSize: 1, aA: 1, aF: 1, aM: 1, aB: 3, aC: 3, aP: 2, aD: 2 };
      for (const k in A) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(A[k]), sz[k]));
      const o = new THREE.Points(g, ptMat);
      o.frustumCulled = false;
      return o;
    };
    return { add, points };
  }
  const GB = glowBuilder(glowMat(THREE.FrontSide)), GS = glowBuilder(glowMat(THREE.DoubleSide)), PB = pointBuilder();

  // ----------------------------------------------------------------- floors
  // holographic discs: one merged mesh; each floor spreads out from its centre as it appears
  let discs;
  const uFR = { value: new Float32Array(NF) }, uFH = { value: new Float32Array(NF) }, uFC = { value: new Float32Array(NF * 3) }, uTF = { value: 1 };
  const discMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uFR, uFH, uFC, uTF },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `
uniform float uFR[${NF}], uFH[${NF}]; uniform vec3 uFC[${NF}];
attribute float aF;
varying vec2 vP; varying float vF, vRv, vHi; varying vec3 vC;
void main() {
  int k = int(aF + 0.5);
  vRv = uFR[k]; vHi = uFH[k]; vC = uFC[k]; vF = aF; vP = position.xz / ${FR.toFixed(3)};
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  if (vRv <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA, uTime, uTF;
varying vec2 vP; varying float vF, vRv, vHi; varying vec3 vC;
void main() {
  float r = length(vP), front = vRv * 1.05;
  if (r > min(front, 1.0)) discard;
  float ang = atan(vP.y, vP.x);
  float rings = pow(1.0 - abs(fract(r * 4.0 + 0.5) - 0.5) * 2.0, 28.0) * 0.45;
  float spokes = pow(abs(cos(ang * 6.0)), 80.0) * 0.12 * smoothstep(0.2, 0.6, r);
  float edge = smoothstep(0.86, 1.0, r) * 0.45;
  float sweep = pow(fract(ang / 6.2832 - uTime * 0.05 + vF * 0.37), 10.0) * 0.4 * smoothstep(0.15, 0.7, r);
  float fill = 0.06 + 0.16 * (1.0 - smoothstep(0.0, 0.45, r));
  float wave = smoothstep(0.12, 0.0, front - r) * (1.0 - vRv) * 2.0;
  float a = (fill + rings + spokes + edge + sweep) * (1.0 + 1.3 * vHi) + wave;
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.25 * wave), a * uA * uTF);
}`,
  });
  set.mats.push(discMat);
  {
    const pos = [], af = [], SEG = 72;
    for (let k = 0; k < NF; k++) for (let i = 0; i < SEG; i++) {
      const a0 = i / SEG * TAU, a1 = (i + 1) / SEG * TAU;
      pos.push(0, fy(k), 0, FR * Math.sin(a1), fy(k), FR * Math.cos(a1), FR * Math.sin(a0), fy(k), FR * Math.cos(a0));
      af.push(k, k, k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aF', new THREE.BufferAttribute(new Float32Array(af), 1));
    discs = new THREE.Mesh(g, discMat);
    discs.frustumCulled = false;
    set.group.add(discs);
  }
  // glowing rims (drawn around as the floor appears) and a glassy shell that rises with the floors
  for (let k = 0; k < NF; k++) {
    GB.add(new THREE.TorusGeometry(FR, 0.006, 4, 96).rotateX(Math.PI / 2).translate(0, fy(k), 0), { g: k, col: v3.lerp(FCOL[k], [1, 1, 1], 0.25), a: 0.9 });
  }
  {
    const y0 = -1.2, y1 = 1.24;
    GS.add(new THREE.CylinderGeometry(0.425, 0.425, y1 - y0, 48, 6, true).translate(0, (y0 + y1) / 2, 0),
      { g: G.shell, col: C('#3f8fe0'), a: 0.32, k: 1, u: (x, y) => (y - y0) / (y1 - y0) });
  }

  // ----------------------------------------------------------------- emblems
  const mergeLit = list => { const g = mergeIndexed(list, ['position', 'normal', 'color']); g.computeBoundingSphere(); return g; };
  // a bit of B-DNA: two backbones and coloured base pairs (A-T, G-C), as in the dna set.
  // Right-handed: seen from above, the strands turn anticlockwise as they rise ([cos a, y, -sin a] with a rising)
  function emDNA() {
    const parts = [], H = 0.2, R = 0.042, NB = 12, turns = NB / 10.5, OFF = 2.4;
    const at = (a, y) => [R * Math.cos(a), y, -R * Math.sin(a)];
    const strand = off => Array.from({ length: 61 }, (_, i) => { const u = i / 60; return at(off + TAU * turns * u, 0.012 + H * u); });
    for (const off of [0, OFF]) { const s = strand(off); parts.push(P(ptube(s, 0.0075, 8), '#d4e4ff'), P(ball(s[0], 0.0075, 10), '#d4e4ff'), P(ball(s[60], 0.0075, 10), '#d4e4ff')); }
    const q = K.rng(5), BASE = { A: '#3ee08f', T: '#ff5a4b', G: '#ffb43b', C: '#4f9dff' };
    const PAIRS = [['A', 'T'], ['T', 'A'], ['G', 'C'], ['C', 'G']];
    for (let i = 0; i < NB; i++) {
      const u = (i + 0.5) / NB, a = TAU * turns * u, y = 0.012 + H * u;
      const pa = at(a, y), pb = at(a + OFF, y), m = v3.lerp(pa, pb, 0.5), [ba, bb] = PAIRS[Math.floor(q() * 4)];
      parts.push(P(rod(pa, m, 0.0045, 6), BASE[ba]), P(rod(m, pb, 0.0045, 6), BASE[bb]));
    }
    return mergeLit(parts);
  }
  // a folded protein chain, AlphaFold style: four helices with loops and floppy ends, coloured by confidence
  function emProtein() {
    const q = K.rng(21), pts = [], conf = [];
    const push = (p, c) => { pts.push(p); conf.push(c); };
    const ax = [[-0.028, -0.016], [0.026, -0.026], [0.03, 0.022], [-0.02, 0.03]];
    // floppy N-terminal tail
    for (let i = 0; i < 6; i++) push([-0.05 + 0.006 * i + 0.006 * Math.sin(i * 1.7), 0.02 + 0.004 * i, -0.04 + 0.004 * i], i < 3 ? 3 : 2);
    for (let h = 0; h < 4; h++) {
      const up = h % 2 === 0, [cx, cz] = ax[h], n = 24, len = 0.085, y0 = 0.025;   // 3.6 residues per turn, pitch drawn a little open
      // alpha helices are right-handed whichever way the chain runs: the turn sense flips with the direction
      for (let i = 0; i <= n; i++) {
        const u = i / n, a = i * TAU / 3.6 + h, y = up ? y0 + len * u : y0 + len * (1 - u);
        push([cx + 0.0095 * Math.cos(a), y, cz + (up ? -1 : 1) * 0.0095 * Math.sin(a)], h === 1 || h === 2 ? 1 : 0);
      }
      if (h < 3) { // loop over to the next helix
        const a = pts[pts.length - 1], [nx, nz] = ax[h + 1], yb = up ? y0 + len + 0.016 : y0 - 0.014;
        push([(a[0] + nx) / 2 + (q() - 0.5) * 0.01, yb, (a[2] + nz) / 2 + (q() - 0.5) * 0.01], 1);
      }
    }
    // floppy C-terminal tail
    const e = pts[pts.length - 1];
    for (let i = 1; i <= 7; i++) push([e[0] + 0.007 * i, e[1] + 0.01 * Math.sin(i * 1.3) - 0.003 * i, e[2] + 0.006 * i + 0.006 * Math.cos(i * 1.9)], i > 4 ? 3 : 2);
    // a smooth chain, three samples per residue, each ring coloured by its residue's confidence
    const M = pts.length * 4, geo = ptube(smoothPts(pts, M), 0.0042, 6), W = 7;
    const CC = ['#0053d6', '#65cbf3', '#ffdb13', '#ff7d45'].map(C), cols = new Float32Array(M * W * 3);
    for (let i = 0; i < M; i++) for (let j = 0; j < W; j++) cols.set(CC[conf[Math.round(i / (M - 1) * (pts.length - 1))]], 3 * (i * W + j));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ends = [pts[0], pts[pts.length - 1]].map(p => P(ball(p, 0.0042, 8), CC[3]));   // round caps on the open tube ends
    return mergeLit([geo, ...ends].map(g => g.scale(1.3, 1.3, 1.3)));   // drawn a little larger than the others: a single chain is thin
  }
  // a complex (ATP synthase, met earlier in the story): c-ring, central stalk, alpha3beta3 head, peripheral stalk
  function emComplex() {
    const parts = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; parts.push(P(ball([0.032 * Math.cos(a), 0.03, 0.032 * Math.sin(a)], 0.015, 10), '#ff8fc8')); }
    parts.push(P(rod([0, 0.03, 0], [0, 0.13, 0], 0.009, 8), '#9fe6e0'));
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; parts.push(P(ball([0.04 * Math.cos(a), 0.155, 0.04 * Math.sin(a)], 0.029, 14), i % 2 ? '#3d7fe0' : '#1fc8c0')); }
    parts.push(P(ball([0.064, 0.028, 0], 0.018, 10), '#7a4a2c'));
    parts.push(P(ptube(smoothPts([[0.068, 0.045, 0], [0.074, 0.1, 0], [0.062, 0.175, 0], [0.028, 0.2, 0]], 20), 0.0055, 6), '#b07a4a'), P(ball([0.028, 0.2, 0], 0.0055, 8), '#b07a4a'));
    parts.push(P(ball([0, 0.198, 0], 0.017, 12), '#a77be0'));
    return mergeLit(parts);
  }
  // a mitochondrion: the outer membrane is a glassy capsule (a separate rim-lit mesh); inside it, the inner membrane is
  // shown cut open lengthwise, textbook style: a half shell whose folds (cristae) reach in from alternating sides
  const capProf = (L, R) => {
    const prof = [];
    for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; prof.push([R * Math.cos(a) + 1e-4, -(L / 2 - R) + R * Math.sin(a)]); }
    for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; prof.push([R * Math.cos(a) + 1e-4, (L / 2 - R) + R * Math.sin(a)]); }
    return prof;
  };
  const capsule = (L, R, seg) => lathe(capProf(L, R), seg || 24);
  // a shell seen from both sides: the geometry plus a copy with flipped faces and normals, coloured separately
  function twoSided(g, cOut, cIn) {
    const f = g.clone(), n = f.attributes.normal.array, ix = f.index.array;
    for (let i = 0; i < n.length; i++) n[i] = -n[i];
    for (let i = 0; i < ix.length; i += 3) { const s = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = s; }
    return [P(g, cOut), P(f, cIn)];
  }
  function emMito() {
    const parts = [], cy = 0.072, L = 0.2, RI = 0.045, N = 7, cyl = L / 2 - RI;
    // the inner membrane's lower half: lathe about y, turned to lie along x (lathe angle pi..2pi is the half below the axis)
    const shell = lathe(capProf(L, RI), 18, Math.PI, Math.PI).rotateZ(Math.PI / 2).translate(0, cy, 0);
    { // make sure the normals point outwards before pairing
      const p = shell.attributes.position, nn = shell.attributes.normal;
      let s = 0;
      for (let i = 0; i < p.count; i++) s += nn.getY(i) * (p.getY(i) - cy) + nn.getZ(i) * p.getZ(i);
      if (s < 0) { for (let i = 0; i < nn.array.length; i++) nn.array[i] = -nn.array[i]; const ix = shell.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
    }
    parts.push(...twoSided(shell, '#ff8a50', '#ffae7e'));
    // its cut edge, a thin rounded rim
    const rho = x => (Math.abs(x) <= cyl ? RI : Math.sqrt(Math.max(0, RI * RI - (Math.abs(x) - cyl) ** 2)));
    const edge = [];
    for (let i = 0; i <= 40; i++) { const x = -L / 2 + L * i / 40; edge.push([x, cy, rho(x)]); }
    for (let i = 39; i >= 0; i--) { const x = -L / 2 + L * i / 40; edge.push([x, cy, -rho(x)]); }
    parts.push(P(ptube(edge, 0.0028, 5), '#ffc9a3'));
    // cristae: folds of the inner membrane, joined to its wall on one side, reaching 70% of the way across
    for (let i = 0; i < N; i++) {
      const x = -0.074 + 0.148 * i / (N - 1), r = rho(x) - 0.0016, s = i % 2 ? 1 : -1, zr = -0.4 * s * r, a0 = Math.acos(clamp(zr / r, -1, 1));
      const sh = new THREE.Shape();
      sh.moveTo(s * r, -0.0015);
      if (s > 0) sh.absarc(0, 0, r, -0.0015 / r, -a0, true); else sh.absarc(0, 0, r, Math.PI + 0.0015 / r, Math.PI + (Math.PI - a0), false);
      sh.lineTo(zr, -0.0015);
      sh.lineTo(s * r, -0.0015);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0014, bevelSegments: 2, curveSegments: 10 });
      g.rotateY(Math.PI / 2).translate(x - 0.001, cy, 0);
      parts.push(P(g, '#ff7d45'));
    }
    // a few granules in the matrix
    const q = K.rng(31);
    for (let i = 0; i < N - 1; i++) parts.push(P(ball([-0.062 + 0.148 * i / (N - 1), cy - 0.018 - 0.01 * q(), (q() - 0.5) * 0.03], 0.0042, 8), '#ffd36a'));
    return mergeLit(parts);
  }
  // a cell: nucleus, mitochondria, Golgi and vesicles inside a glassy membrane (separate mesh)
  function emCell() {
    const q = K.rng(41), parts = [], cy = 0.09;
    parts.push(P(ball([0.006, cy, -0.004], 0.034, 20), '#7a62e8'), P(ball([0.016, cy + 0.012, 0.018], 0.011, 10), '#4b2fb0'));
    for (let i = 0; i < 7; i++) {
      const u = K.unit(q), p = v3.add([0, cy, 0], v3.mul([u[0], u[1] * 0.7, u[2]], 0.054 + 0.01 * q())), w = v3.mul(K.unit(q), 0.011);
      parts.push(P(rod(v3.add(p, w), v3.sub(p, w), 0.0065, 6), '#ff8a50'));
    }
    for (let i = 0; i < 3; i++) parts.push(P(new THREE.TorusGeometry(0.03 + i * 0.006, 0.0032, 6, 20, 1.6).rotateY(0.9).translate(-0.03, cy - 0.01 + i * 0.008, 0.02), '#ffd36a'));
    for (let i = 0; i < 10; i++) { const u = K.unit(q); parts.push(P(ball(v3.add([0, cy, 0], v3.mul([u[0], u[1] * 0.7, u[2]], 0.045 + 0.022 * q())), 0.0055, 8), '#3ee08f')); }
    return mergeLit(parts);
  }
  // a sheet of tissue: columnar cells (hexagonal prisms) with nuclei, gently curved
  function emTissue() {
    const q = K.rng(51), parts = [], rc = 0.0185, w = Math.sqrt(3) * rc;
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      const x = w * (i + j / 2), z = 1.5 * rc * j;
      if (x * x + z * z > 0.125 * 0.125) continue;
      const h = 0.036 + 0.008 * q(), yb = 0.045 - 1.4 * (x * x + z * z);
      const nrm = v3.norm([2.8 * x, 1, 2.8 * z]), top = v3.add([x, yb, z], v3.mul(nrm, h));
      const g = new THREE.CylinderGeometry(rc * 0.94, rc * 0.94, h, 6, 1);
      _q.setFromUnitVectors(_up, _d.set(...nrm));
      g.applyMatrix4(_m.compose(_p.set(...v3.lerp([x, yb, z], top, 0.5)), _q, _s));
      parts.push(P(g, v3.lerp(C('#f29fbf'), C('#e3779f'), q())));
      parts.push(P(ball(v3.add(top, v3.mul(nrm, -0.004)), 0.0085, 8), '#5b3b9a'));
    }
    return mergeLit(parts);
  }
  // a brain: two folded hemispheres, cerebellum and brainstem
  function emBrain() {
    const parts = [], pink = C('#f4a9b6'), groove = C('#a24f63');
    const fold = (g, amp, f) => {
      const A = g.attributes.position.array, n = A.length / 3, col = new Float32Array(n * 3);
      for (let i = 0; i < 3 * n; i += 3) {
        const d = f(A[i], A[i + 1], A[i + 2]), w = 1 - amp * d;
        A[i] *= w; A[i + 1] *= w; A[i + 2] *= w;
        for (let c = 0; c < 3; c++) col[i + c] = pink[c] + (groove[c] - pink[c]) * d;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    };
    // meandering grooves: a domain-warped stripe pattern
    const gyri = (x, y, z) => { const s = Math.sin(15 * (0.6 * x + z) + 3 * Math.sin(9 * y + 6 * x) + 2.2 * Math.sin(11 * z - 4 * y)); return Math.pow(1 - Math.abs(s), 3); };
    for (const side of [-1, 1]) {
      const g = fold(new THREE.SphereGeometry(1, 36, 24), 0.09, gyri), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { // flatten the inner face and the base
        let x = p.getX(i) * side, y = p.getY(i);
        if (x < -0.55) x = -0.55 - (x + 0.55) * 0.15;
        if (y < -0.5) y = -0.5 - (y + 0.5) * 0.3;
        p.setXY(i, x * side, y);
      }
      g.scale(0.046, 0.052, 0.084).translate(side * 0.0275, 0.098, 0.006);
      g.computeVertexNormals();
      parts.push(g);
    }
    const cb = fold(new THREE.SphereGeometry(1, 22, 14), 0.07, (x, y) => Math.pow(Math.abs(Math.sin(y * 14)), 0.5));
    cb.scale(0.056, 0.026, 0.032).translate(0, 0.06, -0.056);
    cb.computeVertexNormals();
    parts.push(cb, P(rod([0, 0.08, -0.022], [0, 0.03, -0.04], 0.012, 8, false, 0.008), '#e08a99'));
    return mergeLit(parts);
  }
  // a human figure, stylised
  function emBody() {
    const parts = [], c = '#e2eaf6';
    const limb = (pts, r) => { parts.push(P(ptube(smoothPts(pts, 12), r, 8), c), P(ball(pts[0], r, 8), c), P(ball(pts[pts.length - 1], r, 8), c)); };
    parts.push(P(ball([0, 0.228, 0], 0.02, 16), c), P(rod([0, 0.19, 0], [0, 0.212, 0], 0.008, 8), c));
    const torso = lathe([[0, 0.104], [0.024, 0.106], [0.027, 0.12], [0.023, 0.145], [0.027, 0.172], [0.031, 0.186], [0.022, 0.197], [0, 0.2]], 20);
    parts.push(P(torso.scale(1, 1, 0.62), c));
    for (const s of [-1, 1]) {
      limb([[s * 0.013, 0.11, 0], [s * 0.016, 0.062, 0.002], [s * 0.016, 0.014, -0.002]], 0.0105);
      limb([[s * 0.034, 0.184, 0], [s * 0.046, 0.142, -0.004], [s * 0.052, 0.104, 0.004]], 0.0078);
      parts.push(P(new THREE.SphereGeometry(1, 10, 8).scale(0.011, 0.006, 0.017).translate(s * 0.016, 0.005, 0.006), c));   // a foot
    }
    return mergeLit(parts);
  }
  const EMS = 1.2;   // emblems are modelled about 0.2 tall, shown a little larger
  const emMat = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.06, emissive: 0x0e1a2e }));
  const cellRim = K.rim(set, { color: '#7fe3ff', a0: 0.05, a1: 0.75 }), mitoRim = K.rim(set, { color: '#ffa36b', a0: 0.05, a1: 0.8 });
  // the lit meshes are 'transparent' only so that they can fade: draw them before every additive glow, so that the depth
  // they write hides the glow behind them and never the glow in front (three.js would otherwise sort them by distance)
  const EM = [emDNA(), emProtein(), emComplex(), emMito(), emCell(), emTissue(), emBrain(), emBody()].map((g, k) => {
    const m = new THREE.Mesh(g, emMat);
    m.position.set(0, fy(k), 0);
    m.renderOrder = -1;
    set.group.add(m);
    return m;
  });
  {
    const mito = new THREE.Mesh(capsule(0.22, 0.054, 28).rotateZ(Math.PI / 2).translate(0, 0.072, 0), mitoRim);
    EM[3].add(mito);
    const g = new THREE.SphereGeometry(0.085, 24, 16), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { // a slightly irregular, flattened membrane
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), w = 1 + 0.06 * Math.sin(40 * x + 10 * z) * Math.cos(30 * y);
      p.setXYZ(i, x * w, y * w * 0.82, z * w);
    }
    g.computeVertexNormals();
    EM[4].add(new THREE.Mesh(g.translate(0, 0.09, 0), cellRim));
  }

  // ----------------------------------------------------------------- time spiral
  {
    const N = 320, pts = Array.from({ length: N + 1 }, (_, i) => helix(i / N));
    GB.add(ptube(pts, 0.0055, 5), { g: G.time, col: C('#ffb43b'), a: 0.85, q: [14, 0.12] });
    for (let L = -6; L <= 9; L++) { // a tick per decade
      const u = tu(L);
      GB.seg(helix(u, TH, TH.r - 0.012), helix(u, TH, TH.r + 0.03), 0.0035, { g: G.time, col: C('#ffcf80'), a: 0.7, u, d: [0, 1] });
    }
    TU.forEach(u => { // the marked events: a bead and a flag
      GB.add(ball(helix(u), 0.014, 12), { g: G.time, col: C('#fff0d0'), a: 1, u });
      GB.add(rod(helix(u, TH, TH.r + 0.01), helix(u, TH, TH.r + 0.085), 0.004, 5, true), { g: G.time, col: C('#ffd38a'), a: 0.9, u });
      PB.add(helix(u), { g: G.time, col: C('#ffc060'), s: 0.075, a: 0.8, d: [u, 25], p: [u * 7, 2.2] });
    });
    const q = K.rng(61);
    for (let i = 0; i < 160; i++) PB.add([TH.y0, TH.y1, 0], { g: G.time, m: 2, col: C('#ffd890'), s: 0.016 + 0.01 * q(), a: 0.8, b: [TH.r, TH.turns, TH.th0], p: [q(), 0.012 + 0.012 * q()] });
    PB.add([TH.y0, TH.y1, 0], { g: G.time, m: 7, col: C('#fff1cf'), s: 0.11, a: 1, b: [TH.r, TH.turns, TH.th0] });
  }

  // ----------------------------------------------------------------- networks at four scales
  NETS.forEach((N, i) => {
    const q = K.rng(70 + i), P0 = [], y0 = fy(N.f), g = G.net + i, col = C(N.col);
    let tries = 0;
    while (P0.length < N.n && tries++ < 4000) {
      const a = q() * TAU, rr = Math.sqrt(lerp(0.2 * 0.2, 0.37 * 0.37, q())), p = [rr * Math.sin(a), y0 + 0.03 + q() * 0.13, rr * Math.cos(a)];
      if (P0.every(o => v3.dist(o, p) > 0.085)) P0.push(p);
    }
    const n = P0.length, E = new Map(), key = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
    const near = a => P0.map((p, b) => [v3.dist(P0[a], p), b]).filter(x => x[1] !== a).sort((x, y) => x[0] - y[0]);
    for (let a = 0; a < n; a++) near(a).slice(0, 2).forEach(([, b]) => E.set(key(a, b), [a, b]));
    for (let e = 0; e < 5; e++) { const a = Math.floor(q() * n), b = near(a)[2 + Math.floor(q() * 3)][1]; E.set(key(a, b), [a, b]); }
    // join components so every node can be reached
    const comp = Array.from({ length: n }, (_, a) => a), find = a => (comp[a] === a ? a : (comp[a] = find(comp[a])));
    for (const [a, b] of E.values()) comp[find(a)] = find(b);
    for (let a = 0; a < n; a++) for (const [, b] of near(a)) if (find(a) !== find(b)) { E.set(key(a, b), [a, b]); comp[find(a)] = find(b); break; }
    const adj = Array.from({ length: n }, () => []);
    for (const [a, b] of E.values()) { adj[a].push(b); adj[b].push(a); }
    // hop distances from the best-connected node: the network grows out from it
    const root = adj.reduce((best, l, a) => (l.length > adj[best].length ? a : best), 0), hop = new Array(n).fill(-1), Q = [root];
    hop[root] = 0;
    while (Q.length) { const a = Q.shift(); for (const b of adj[a]) if (hop[b] < 0) { hop[b] = hop[a] + 1; Q.push(b); } }
    const H = Math.max(...hop) || 1;
    N.hop = hop; N.H = H;
    for (const [a, b0] of E.values()) {
      const [s, e] = hop[a] <= hop[b0] ? [a, b0] : [b0, a], dl = hop[s] / (H + 1) * 0.6;
      GB.seg(P0[s], P0[e], 0.0032, { g, col: v3.lerp(col, [1, 1, 1], 0.2), a: 0.95, d: [dl, 2.6] });
      if (i === 1 || (i === 2 && q() < 0.8) || (i === 0 && q() < 0.25)) {
        const speed = i === 1 ? 0.55 + 0.4 * q() : 0.3 + 0.2 * q();
        PB.add(P0[s], { g, m: 1, col: v3.lerp(col, [1, 1, 1], 0.5), s: 0.03, b: P0[e], p: [q(), speed], d: [dl + 0.3, 2.6] });
        if (i === 2) PB.add(P0[e], { g, m: 1, col: v3.lerp(col, [1, 1, 1], 0.5), s: 0.026, b: P0[s], p: [q(), speed * 0.8], d: [dl + 0.3, 2.6] });
      }
    }
    P0.forEach((p, a) => PB.add(p, { g, m: i === 3 ? 5 : 0, col, s: a === root ? 0.06 : 0.04 + 0.01 * q(), a: 1,
      b: [hop[a] / (H + 1), 0, 0], p: [q(), i === 3 ? 7 : 1.5 + 2 * q()], d: [hop[a] / (H + 1) * 0.6, 2.6] }));
    N.anchor = right(NAZ, FR + 0.02, y0 + 0.1);
  });

  // ----------------------------------------------------------------- medicine
  const MEDCOL = C('#3ee08f');
  MY.forEach((y, i) => {
    GS.add(ball(mp(MRHO, y), MBR, 24), { g: G.med, col: MEDCOL, a: 0.75, k: 1, u: 0, d: [i * 0.12, 4] });
    GB.add(new THREE.TorusGeometry(MBR * 1.02, 0.004, 6, 64).rotateY(Math.PI / 2 - MAZ * D2R).translate(...mp(MRHO, y)), { g: G.med, col: MEDCOL, a: 0.6, d: [i * 0.12, 4] });
  });
  for (let i = 0; i < 2; i++) GB.seg(mp(MRHO, MY[i] - MBR - 0.005), mp(MRHO, MY[i + 1] + MBR + 0.005), 0.005, { g: G.med, col: MEDCOL, a: 0.8, d: [0.3, 5] });
  for (const [yb, yf] of [[MY[0] + MBR, fy(NF - 1)], [MY[2] - MBR, fy(0)]]) {
    const s = Math.sign(yf - yb), cr = 0.08, pts = [];
    for (let y = yb; s * (yf - s * cr - y) > 0; y += s * 0.03) pts.push(mp(MRHO, y));
    for (let j = 0; j <= 8; j++) { const a = j / 8 * Math.PI / 2; pts.push(mp(MRHO - cr + cr * Math.cos(a), yf - s * cr + s * cr * Math.sin(a))); }
    for (let r = MRHO - cr - 0.03; r > FR + 0.07; r -= 0.03) pts.push(mp(r, yf));
    pts.push(mp(FR + 0.07, yf));
    GB.add(ptube(pts, 0.006, 6), { g: G.med, col: MEDCOL, a: 0.9, d: [0.45, 2.6], q: [6, 0.5] });
    GB.add(new THREE.ConeGeometry(0.026, 0.06, 14).rotateZ(Math.PI / 2).translate(FR + 0.04, 0, 0).rotateY(MAZ * D2R).translate(0, yf, 0),
      { g: G.med, col: v3.lerp(MEDCOL, [1, 1, 1], 0.3), a: 1, u: 0, d: [0.86, 8] });
  }
  // the icons: a clipboard with a tick, a pill bottle and capsule, an apple
  function icClipboard() {
    const parts = [P(new THREE.BoxGeometry(0.09, 0.12, 0.008), '#2f6fd6'), P(new THREE.BoxGeometry(0.074, 0.096, 0.003).translate(0, -0.006, 0.0055), '#f4f7fb')];
    for (let i = 0; i < 3; i++) parts.push(P(new THREE.BoxGeometry(i === 2 ? 0.026 : 0.05, 0.005, 0.002).translate(i === 2 ? -0.018 : -0.006, 0.026 - i * 0.017, 0.0075), '#8aa0bf'));
    parts.push(P(new THREE.BoxGeometry(0.036, 0.016, 0.014).translate(0, 0.058, 0.002), '#c9d3df'));
    const t0 = [0.002, -0.026, 0.009], t1 = [0.012, -0.036, 0.009], t2 = [0.03, -0.012, 0.009];
    parts.push(P(rod(t0, t1, 0.0042, 8), '#2fbf6f'), P(rod(t1, t2, 0.0042, 8), '#2fbf6f'), P(ball(t1, 0.0042, 8), '#2fbf6f'));
    return mergeLit(parts);
  }
  function icPills() {
    const parts = [P(new THREE.CylinderGeometry(0.027, 0.027, 0.07, 24).translate(-0.014, 0, 0), '#14a3a3'),
      P(new THREE.CylinderGeometry(0.0278, 0.0278, 0.03, 24).translate(-0.014, -0.004, 0), '#f4f7fb'),
      P(new THREE.CylinderGeometry(0.03, 0.03, 0.018, 24).translate(-0.014, 0.044, 0), '#f4f7fb')];
    parts.push(P(new THREE.BoxGeometry(0.016, 0.005, 0.004).translate(-0.014, -0.004, 0.028), '#ff5a4b'), P(new THREE.BoxGeometry(0.005, 0.016, 0.004).translate(-0.014, -0.004, 0.028), '#ff5a4b'));
    const half = (c, s) => mergeLit([new THREE.CylinderGeometry(0.012, 0.012, 0.022, 16, 1, true).translate(0, s * 0.011, 0),
      new THREE.SphereGeometry(0.012, 16, 8, 0, TAU, s > 0 ? 0 : Math.PI / 2, Math.PI / 2).translate(0, s * 0.022, 0)].map(g => P(g, c)));
    for (const [c, s] of [['#ff5a4b', 1], ['#f4f7fb', -1]]) parts.push(half(c, s).rotateZ(-1.0).rotateY(0.4).translate(0.03, -0.022, 0.012));
    return mergeLit(parts);
  }
  function icApple() {
    const prof = [[0, -0.032], [0.012, -0.037], [0.027, -0.033], [0.039, -0.019], [0.043, 0], [0.041, 0.016], [0.034, 0.029], [0.022, 0.036], [0.011, 0.033], [0.004, 0.027], [0, 0.025]];
    return mergeLit([P(lathe(prof, 32), '#e0453a'), P(rod([0, 0.024, 0], [0.004, 0.05, 0], 0.0028, 6), '#6b4a2a'),
      P(new THREE.SphereGeometry(1, 12, 8).scale(0.017, 0.0035, 0.008).rotateZ(0.5).translate(0.016, 0.045, 0), '#3fae5a')]);
  }
  const icMat = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05, emissive: 0x0a1424 }));
  const IC = [icClipboard(), icPills(), icApple()].map((g, i) => {
    const m = new THREE.Mesh(g, icMat);
    m.position.set(...mp(MRHO, MY[i]));
    m.renderOrder = -1;
    set.group.add(m);
    return m;
  });

  // ----------------------------------------------------------------- research groups
  RG.forEach((R, i) => {
    const g = G.rg + i, col = C(R.col), [y0, y1] = R.y, au = (x, y, z) => Math.atan2(x, z) / TAU + 0.5;
    if (i < 3) {
      for (const y of [y0, y1]) GB.add(new THREE.TorusGeometry(R.r, 0.008, 4, 96).rotateX(Math.PI / 2).translate(0, y, 0), { g, col, a: 1, q: [3, 0.15] });
      GS.add(new THREE.CylinderGeometry(R.r, R.r, y1 - y0, 72, 1, true).translate(0, (y0 + y1) / 2, 0), { g, col, a: 0.4, k: 1, u: au });
      const q = K.rng(80 + i);
      for (const y of [y0, y1]) for (let j = 0; j < 7; j++) PB.add([0, y, 0], { g, m: 3, col: v3.lerp(col, [1, 1, 1], 0.4), s: 0.03, b: [R.r, 0, 0], p: [q(), 0.25 + 0.1 * q()], d: [0, 1] });
    } else {
      // DataDiVR spans every scale: a lattice of crossing helices around the whole tower, with data flowing up
      const S = 5, turns = 0.6, q = K.rng(90);
      for (let s = 0; s < S; s++) for (const dir of [1, -1]) {
        const h = { r: R.r, turns: dir * turns, th0: s / S * TAU, y0, y1 };
        GB.add(ptube(Array.from({ length: 81 }, (_, j) => helix(j / 80, h)), 0.0038, 4), { g, col, a: 0.55, q: [3, 0.15] });
        for (let j = 0; j < 8; j++) PB.add([y0, y1, 0], { g, m: 2, col: v3.lerp(col, [1, 1, 1], 0.45), s: 0.026, b: [R.r, dir * turns, s / S * TAU], p: [q(), 0.04 + 0.03 * q()] });
      }
      for (const y of [y0, y1]) GB.add(new THREE.TorusGeometry(R.r, 0.007, 4, 112).rotateX(Math.PI / 2).translate(0, y, 0), { g, col, a: 1 });
    }
    R.anchor = i < 3 ? right(RGAZ, R.r + 0.02, (y0 + y1) / 2) : right(RGAZ, R.r + 0.02, -0.2);
  });
  // synergy arcs between the groups: a fan of nested arcs on the side away from the group labels (as on slide 33)
  {
    const PAIRS = [[0, 1, 5], [1, 2, 4], [0, 2, 4], [3, 0, 3], [3, 1, 3], [3, 2, 3]], q = K.rng(95), arcs = [];
    for (const [A, B, n] of PAIRS) for (let j = 0; j < n; j++) arcs.push([A, B]);
    const end = (R, j) => { const y = lerp(R.y[0] + 0.04, R.y[1] - 0.04, q()); return [R.r, R === RG[3] ? lerp(-1.0, 1.0, q()) : y]; };
    arcs.forEach(([A, B], j) => {
      const phi = (RGAZ - 90 + lerp(-45, 40, ((j * 0.618) % 1)) + (q() - 0.5) * 8) * D2R, twist = (q() - 0.5) * 0.25;
      const [ra, ya] = end(RG[A], j), [rb, yb] = end(RG[B], j), bul = 0.18 + 0.28 * Math.abs(ya - yb);
      const at = (rho, y, f) => { const a = phi + twist * f; return [rho * Math.sin(a), y, rho * Math.cos(a)]; };
      const pts = [];
      for (let s = 0; s <= 40; s++) { // a cubic Bezier in the (radius, height) plane
        const u = s / 40, w = [(1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3];
        pts.push(at(w[0] * ra + w[1] * (ra + bul) + w[2] * (rb + bul) + w[3] * rb, w[0] * ya + w[1] * ya + w[2] * yb + w[3] * yb, u));
      }
      const ca = C(RG[A].col), cb = C(RG[B].col);
      GB.add(ptube(pts, 0.0045, 4), { g: G.syn, col: ca, col2: cb, a: 0.9, d: [j / arcs.length * 0.6, 2.5], q: [2, j % 2 ? 0.25 : -0.25] });
    });
  }

  // ----------------------------------------------------------------- motes and dust
  {
    const q = K.rng(99);
    for (let i = 0; i < 260; i++) { // motes drifting up inside the tower
      const a = q() * TAU, rr = 0.38 * Math.sqrt(q());
      PB.add([rr * Math.sin(a), q() * 2.44 - 1.2, rr * Math.cos(a)], { g: G.motes, m: 6, col: v3.lerp(C('#7fd8ff'), [1, 1, 1], q() * 0.5), s: 0.01 + 0.008 * q(), a: 0.5, p: [0, 0.015 + 0.02 * q()] });
    }
    for (let i = 0; i < 1500; i++) { // dust the tower dissolves into
      const k = Math.floor(q() * NF), onRim = q() < 0.5, a = q() * TAU, rr = onRim ? FR : FR * Math.sqrt(q()) * (q() < 0.4 ? 0.35 : 1);
      const p = [rr * Math.sin(a), fy(k) + (rr < 0.15 ? q() * 0.18 : 0.004), rr * Math.cos(a)];
      const out = v3.add(v3.mul([Math.sin(a), 0, Math.cos(a)], 0.25 + 0.6 * q()), [0, (q() - 0.4) * 0.5, 0]);
      PB.add(p, { g: G.dust, m: 4, col: v3.lerp(FCOL[k], [1, 1, 1], 0.3 * q()), s: 0.014 + 0.012 * q(), a: 0.8, b: out, p: [q() * 0.3, (q() - 0.5) * 1.6] });
    }
  }

  // ----------------------------------------------------------------- the team
  const TEAMN = [12, 11, 9, 10], TCOL = ['#3d7fe6', '#17c2b8', '#a8c8ff', '#5ad1ff'].map(C), WARM = C('#ffcf7a');
  const PEOPLE = [], LINKS = [], TCEN = [];
  {
    const q = K.rng(120), dirs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    TEAMN.forEach((n, gi) => {
      const c = v3.mul(v3.norm(dirs[gi]), 0.6);
      c[1] *= 0.7;
      TCEN.push(c);
      for (let j = 0; j < n; j++) {
        const p = j === 0 ? c.slice() : v3.add(c, [K.gauss(q) * 0.16, K.gauss(q) * 0.13, K.gauss(q) * 0.16]);
        // where this person starts: a floor of the group's scales (RG4: any floor)
        const fl = gi === 0 ? 1 + (j % 2) : gi === 1 ? 4 + (j % 2) : gi === 2 ? 7 : j % NF, a = q() * TAU, rr = 0.12 + 0.22 * q();
        PEOPLE.push({ g: gi, p, lead: j === 0, start: [rr * Math.sin(a), fy(fl) + 0.03, rr * Math.cos(a)], dl: 0.04 + 0.32 * q(), ph: q() * TAU });
      }
    });
    // relax: keep people apart, and near their group
    for (let it = 0; it < 50; it++) {
      for (let a = 0; a < PEOPLE.length; a++) for (let b = a + 1; b < PEOPLE.length; b++) {
        const A = PEOPLE[a].p, B = PEOPLE[b].p, dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz) || 1e-3;
        const want = PEOPLE[a].g === PEOPLE[b].g ? 0.13 : 0.2;
        if (L >= want) continue;
        const s = (want - L) / L * 0.5;
        if (!PEOPLE[a].lead) { A[0] -= dx * s; A[1] -= dy * s; A[2] -= dz * s; }
        if (!PEOPLE[b].lead) { B[0] += dx * s; B[1] += dy * s; B[2] += dz * s; }
      }
      for (const A of PEOPLE) if (!A.lead) { const d = v3.sub(A.p, TCEN[A.g]), L = v3.len(d); if (L > 0.3) A.p = v3.add(TCEN[A.g], v3.mul(d, 0.3 / L)); }
    }
    const has = new Set(), link = (a, b, inter) => { const k = a < b ? a + ',' + b : b + ',' + a; if (a !== b && !has.has(k)) { has.add(k); LINKS.push([a, b, inter]); } };
    PEOPLE.forEach((A, a) => {
      PEOPLE.map((B, b) => [B.g === A.g && b !== a ? v3.dist(A.p, B.p) : 9, b]).sort((x, y) => x[0] - y[0]).slice(0, 2).forEach(([, b]) => link(a, b, false));
    });
    let base = 0;
    TEAMN.forEach((n, gi) => { for (let j = 0; j < 3; j++) link(base, base + 1 + Math.floor(q() * (n - 1)), false); base += n; });
    for (let gA = 0; gA < 4; gA++) for (let gB = gA + 1; gB < 4; gB++) for (let j = 0; j < 2; j++) {
      const ia = PEOPLE.map((P, i) => i).filter(i => PEOPLE[i].g === gA), ib = PEOPLE.map((P, i) => i).filter(i => PEOPLE[i].g === gB);
      const a = ia[Math.floor(q() * ia.length)], b = ib.map(i => [v3.dist(PEOPLE[i].p, PEOPLE[a].p) + q() * 0.25, i]).sort((x, y) => x[0] - y[0])[0][1];
      link(a, b, true);
    }
  }
  const team = new THREE.Group();
  set.group.add(team);
  {
    const TB = glowBuilder(glowMat(THREE.FrontSide)), TP = pointBuilder(), q = K.rng(130);
    LINKS.forEach(([a, b, inter]) => {
      const A = PEOPLE[a].p, B = PEOPLE[b].p, ca = TCOL[PEOPLE[a].g], cb = TCOL[PEOPLE[b].g];
      // a link draws in (on scale_team) only once both its people have landed (person i lands at dl + 0.45)
      const l0 = Math.max(PEOPLE[a].dl, PEOPLE[b].dl) + 0.45 + 0.04 * q(), dur = Math.min(0.24, 0.985 - l0), s0 = l0 + 0.6 * dur;
      const dl = [l0, 1 / dur], ds = [s0, 1 / (1 - s0)];
      if (!inter) {
        TB.seg(A, B, 0.0026, { g: G.link, col: v3.lerp(v3.lerp(ca, cb, 0.5), [1, 1, 1], 0.2), a: 0.5, d: dl });
        TP.add(A, { g: G.spark, m: 1, col: v3.lerp(ca, [1, 0.95, 0.85], 0.6), s: 0.022, b: B, p: [q(), 0.12 + 0.2 * q()], d: ds });
        return;
      }
      // collaborations between groups: warm arcs, bowed away from the centre, with sparks running both ways
      const m = v3.lerp(A, B, 0.5), cp = v3.add(m, v3.mul(v3.norm(v3.add(m, [0, 0.05, 0])), 0.05 + 0.1 * v3.dist(A, B)));
      const pts = Array.from({ length: 13 }, (_, i) => { const x = i / 12; return v3.lerp(v3.lerp(A, cp, x), v3.lerp(cp, B, x), x); });
      TB.add(ptube(pts, 0.0032, 4), { g: G.link, col: v3.lerp(WARM, ca, 0.25), col2: v3.lerp(WARM, cb, 0.25), a: 0.75, d: dl });
      for (let s = 0; s < 2; s++) TP.add(s ? B : A, { g: G.spark, m: 8, col: WARM, s: 0.036, b: s ? A : B, c: cp, p: [q(), 0.1 + 0.12 * q()], d: ds });
    });
    TCEN.forEach((c, i) => TP.add(c, { g: G.star, col: v3.lerp(TCOL[i], WARM, 0.35), s: 0.75, a: 0.11, p: [q(), 0.5], d: [0, 1] }));
    TP.add([0, 0, 0], { g: G.star, col: WARM, s: 1.1, a: 0.06, p: [0, 0.3], d: [0, 1] });
    for (let i = 0; i < 420; i++) { // warm stardust around the team
      const u = K.unit(q), p = v3.mul(u, 0.25 + 0.95 * Math.cbrt(q()));
      p[1] *= 0.8;
      TP.add(p, { g: G.star, col: q() < 0.55 ? v3.lerp(WARM, [1, 1, 1], 0.4) : v3.lerp(TCOL[i % 4], [1, 1, 1], 0.3), s: 0.008 + 0.01 * q(), a: 0.35 + 0.3 * q(), p: [q(), 0.6 + 2 * q()], d: [q() * 0.5, 2] });
    }
    team.add(TB.mesh(), TP.points());
  }
  // people: a rounded body and a warm head, lit in the shader so each group keeps its colour
  const NP = PEOPLE.length;
  const personGeo = (() => {
    const body = lathe([[0, 0], [0.024, 0], [0.027, 0.008], [0.026, 0.03], [0.022, 0.045], [0.013, 0.053], [0, 0.055]], 18);
    const g = mergeIndexed([body, new THREE.SphereGeometry(0.0165, 18, 12).translate(0, 0.075, 0)], ['position', 'normal']);
    const p = g.attributes.position, part = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) part[i] = p.getY(i) > 0.0565 ? 1 : 0;
    g.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
    g.translate(0, -0.04, 0);
    const ic = new Float32Array(NP * 3);
    PEOPLE.forEach((P, i) => ic.set(TCOL[P.g], 3 * i));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(ic, 3));
    return g;
  })();
  const pplMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uK: { value: 1 } },
    transparent: true,
    vertexShader: `
attribute vec3 iCol; attribute float aPart;
varying vec3 vN, vV, vC; varying float vPart;
void main() {
  vec4 p = vec4(position, 1.0); vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
  vec4 mv = modelViewMatrix * p;
  vN = normalize(normalMatrix * n); vV = -mv.xyz; vC = iCol; vPart = aPart;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform float uA, uK;
varying vec3 vN, vV, vC; varying float vPart;
void main() {
  vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.45, 0.6, 0.65));
  float d = max(dot(n, L), 0.0), rim = pow(1.0 - max(dot(n, v), 0.0), 2.0);
  vec3 base = mix(vC, vec3(1.0, 0.88, 0.72), vPart);
  vec3 c = base * (0.28 + 0.8 * d) + mix(vC, vec3(1.0, 0.8, 0.55), 0.35) * rim * 0.9 + base * 0.12;
  gl_FragColor = vec4(c, uA * uK);
}`,
  });
  set.mats.push(pplMat);
  const ppl = new THREE.InstancedMesh(personGeo, pplMat, NP);
  ppl.frustumCulled = false; ppl.renderOrder = -1;
  set.group.add(ppl);
  // a soft halo behind each person (positions follow them every frame)
  const HB = pointBuilder();
  PEOPLE.forEach(P => HB.add([0, 0, 0], { g: G.halo, col: v3.lerp(TCOL[P.g], WARM, 0.25), s: P.lead ? 0.17 : 0.13, a: 0 }));
  const halos = HB.points();
  set.group.add(halos);

  const shells = GS.mesh(), glows = GB.mesh(), pts = PB.points();
  set.group.add(shells, glows, pts);

  // ----------------------------------------------------------------- update
  const hide = x => 1 - prog(x, 0, 0.1);   // a layer's labels give way as soon as the next layer starts
  const floorRev = (S, k) => prog(S.scale_len, k * 0.11, k * 0.11 + 0.23);
  const netRev = (S, i) => prog(S.scale_net, i * 0.17, i * 0.17 + 0.49);
  const rgRev = (S, i) => prog(S.scale_rg, i * 0.22, i * 0.22 + 0.34);
  const medRev = (S, i) => prog(S.scale_med, i * 0.12 + 0.05, i * 0.12 + 0.3);
  const towerOf = S => 1 - prog(S.scale_team, 0.05, 0.55);
  const fadeMat = (m, x) => { const o = m.userData.base * set.uA.value * x; m.opacity = o; m.depthWrite = o > 0.97; };
  const _o = new THREE.Object3D();
  let spin = 0;
  const rotY = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
  function update(S, t) {
    const tf = towerOf(S), len = S.scale_len, V = uV.value, R = uR.value;
    uTF.value = tf;
    // skip draw calls for whatever is gone
    const any = len + S.scale_time + S.scale_net + S.scale_med + S.scale_rg + S.scale_syn > 0;
    discs.visible = tf > 0.001 && len > 0;
    shells.visible = glows.visible = tf > 0.001 && any;
    pts.visible = any && S.scale_team < 1;
    // floors and their emblems
    let top = -1.3;
    const hiC = Array.from({ length: NF }, (_, k) => FCOL[k].slice()), hi = new Float32Array(NF);
    NETS.forEach((N, i) => { const x = netRev(S, i) * (1 - S.scale_rg); hi[N.f] = Math.max(hi[N.f], x); hiC[N.f] = v3.lerp(hiC[N.f], N.c, x * 0.7); });
    RG.forEach((G_, i) => { const x = rgRev(S, i); for (const f of G_.floors) { hi[f] = Math.max(hi[f], x * 0.8); hiC[f] = v3.lerp(hiC[f], G_.c, x * 0.7); } });
    for (let k = 0; k < NF; k++) {
      const rv = floorRev(S, k), e = EM[k];
      uFR.value[k] = rv; uFH.value[k] = hi[k]; uFC.value.set(hiC[k], 3 * k);
      V[k] = rv > 0 ? tf : 0; R[k] = rv;
      e.visible = rv > 0.001 && tf > 0.003;
      const sc = EMS * smooth(rv) * (1 + 0.2 * Math.sin(Math.PI * rv));
      e.scale.setScalar(Math.max(sc, 1e-4));
      e.position.y = fy(k) + 0.004 - 0.05 * (1 - rv);
      e.rotation.y = t * 0.22 + k * 0.9;
      if (rv > 0) top = Math.max(top, fy(k) + 0.27 * rv);
    }
    cellRim.uniforms.uK.value = floorRev(S, 4) * tf; mitoRim.uniforms.uK.value = floorRev(S, 3) * tf;
    fadeMat(emMat, tf);
    V[G.shell] = len > 0 ? tf : 0; R[G.shell] = clamp((top + 1.2) / 2.44, 0, 1);
    V[G.motes] = smooth(len) * tf; R[G.motes] = top;
    // time
    V[G.time] = prog(S.scale_time, 0, 0.04) * tf; R[G.time] = S.scale_time;
    // networks
    NETS.forEach((N, i) => { const x = netRev(S, i); V[G.net + i] = x > 0 ? tf : 0; R[G.net + i] = x; });
    // medicine
    V[G.med] = S.scale_med > 0 ? tf : 0; R[G.med] = S.scale_med;
    fadeMat(icMat, tf);
    IC.forEach((m, i) => {
      const x = medRev(S, i);
      m.visible = x > 0.001 && tf > 0.003;
      m.scale.setScalar(Math.max(1e-4, 1.45 * smooth(x) * (1 + 0.2 * Math.sin(Math.PI * x))));
      m.rotation.set(0.12 * Math.sin(t * 0.7 + i), t * 0.5 + i * 2.1, 0);
      m.position.y = MY[i] + 0.008 * Math.sin(t * 1.1 + i * 2);
    });
    // research groups and synergies
    RG.forEach((G_, i) => { const x = rgRev(S, i); V[G.rg + i] = x > 0 ? tf : 0; R[G.rg + i] = x; });
    V[G.syn] = S.scale_syn > 0 ? tf : 0; R[G.syn] = S.scale_syn;
    // the tower dissolves into dust; the team gathers into a slowly turning constellation
    ptMat.uniforms.uDust.value = S.scale_team;
    V[G.dust] = smooth(len); R[G.dust] = 1;
    const tm = S.scale_team;
    spin = t * 0.07;
    team.rotation.y = spin;
    team.visible = ppl.visible = halos.visible = tm > 0.001;
    pplMat.depthWrite = set.uA.value > 0.97;
    V[G.link] = 1; R[G.link] = tm; V[G.spark] = 1; R[G.spark] = tm; V[G.star] = prog(tm, 0.2, 0.9); R[G.star] = prog(tm, 0.2, 1);
    V[G.halo] = 1; R[G.halo] = 1;
    if (tm > 0.001) {
      const hp = halos.geometry.attributes.position, ha = halos.geometry.attributes.aA;
      PEOPLE.forEach((P, i) => {
        const s = prog(tm, P.dl, P.dl + 0.45), born = prog(tm, P.dl * 0.4, P.dl * 0.4 + 0.08);
        const end = rotY(P.p, spin), out = v3.norm([end[0], 0, end[2]]);
        let p = v3.lerp(v3.mul(P.start, lerp(0.35, 1, len)), end, smooth(s));   // without the tower they gather from near the centre
        p = v3.add(p, v3.add(v3.mul(out, 0.22 * Math.sin(Math.PI * s)), [0, 0.12 * Math.sin(Math.PI * s), 0]));
        p[1] += 0.005 * Math.sin(t * 1.3 + P.ph) * s;
        const sc = born * lerp(0.55, 1, s) * (P.lead ? 1.5 : 1.2);
        _o.position.set(p[0], p[1], p[2]);
        _o.rotation.set(0, Math.atan2(p[0], p[2]) + 0.3 * Math.sin(t * 0.4 + P.ph), 0);
        _o.scale.setScalar(Math.max(sc, 1e-4));
        _o.updateMatrix();
        ppl.setMatrixAt(i, _o.matrix);
        hp.setXYZ(i, p[0], p[1] + 0.008, p[2]);
        ha.setX(i, born * (0.55 + 0.25 * s) * (0.85 + 0.15 * Math.sin(t * 1.7 + P.ph)));
      });
      ppl.instanceMatrix.needsUpdate = true; hp.needsUpdate = true; ha.needsUpdate = true;
    }
  }

  // ----------------------------------------------------------------- labels, anchors, views
  const anchors = {
    top: [0, fy(NF - 1) + 0.27, 0], bottom: [0, fy(0) - 0.03, 0], team: [0, 0, 0],
  };
  for (let k = 0; k < NF; k++) anchors['floor' + k] = right(FLAZ, FR + 0.03, fy(k) + 0.01);
  TU.forEach((u, i) => { anchors['time' + i] = helix(u, TH, TH.r + 0.09); });
  NETS.forEach((N, i) => { anchors['net' + i] = N.anchor; });
  MY.forEach((y, i) => { anchors['med' + i] = mp(MRHO + MBR * 0.8, y + MBR * 0.4); });
  RG.forEach((R, i) => { anchors['rg' + (i + 1)] = R.anchor; });
  TCEN.forEach((c, i) => { anchors['team' + (i + 1)] = () => rotY(c, spin); });
  const tIn = (x, u) => prog(x, u, Math.min(u + 0.05, 1));   // a time label fades in as the head passes u (fully in at the top)
  const labels = [
    ...FLOORS.map((f, k) => ({ text: f, at: 'floor' + k, cls: 'cyn',
      alpha: S => prog(S.scale_len, k * 0.11 + 0.1, k * 0.11 + 0.23) * hide(Math.max(S.scale_time, S.scale_net, S.scale_med, S.scale_rg, S.scale_team)) })),
    ...TIMES.map((m, i) => ({ text: [m[0], m[1]], at: 'time' + i, cls: 'amb',
      alpha: S => tIn(S.scale_time, TU[i]) * (i + 6 < TU.length ? 1 - tIn(S.scale_time, TU[i + 6] - 0.02) : 1)   // six at most: the oldest gives way
        * hide(Math.max(S.scale_net, S.scale_med, S.scale_rg, S.scale_team)) })),
    ...NETS.map((N, i) => ({ text: N.text, at: 'net' + i, cls: N.cls,
      alpha: S => prog(netRev(S, i), 0.3, 0.8) * hide(Math.max(S.scale_med, S.scale_rg, S.scale_team)) })),
    ...MED.map((m, i) => ({ text: m, at: 'med' + i, cls: 'grn', alpha: S => medRev(S, i) * hide(Math.max(S.scale_rg, S.scale_team)) })),
    ...RG.map((R, i) => ({ text: R.text, at: 'rg' + (i + 1), cls: R.cls, alpha: S => prog(rgRev(S, i), 0.3, 0.8) * hide(S.scale_team) })),
  ];
  const tower = [15, 18, 5.4, 0, 0.02, 0];
  return Object.assign(set, {
    params: { scale_a: 1, scale_len: 1, scale_time: 0, scale_net: 0, scale_med: 0, scale_rg: 0, scale_syn: 0, scale_team: 0 },
    update, anchors, labels,
    cam: { default: tower, tower, low: [-8, 3, 2.7, 0, -0.6, 0], high: [12, 24, 3.0, 0, 0.42, 0], groups: [RGAZ, 18, 5.4, 0, 0.02, 0], time: [20, 16, 5.3, 0, 0, 0], team: [0, 12, 3.1, 0, 0, 0] },
    controls: [
      { key: 'view', label: 'View', options: [['tower', 'Scales'], ['groups', 'Groups'], ['team', 'Team']] },
      { key: 'time', label: 'Time', options: [['off', 'Off'], ['on', 'On']] },
      { key: 'nets', label: 'Networks', options: [['off', 'Off'], ['on', 'On']] },
      { key: 'med', label: 'Medicine', options: [['off', 'Off'], ['on', 'On']] },
    ],
    explore(c) {
      const tm = c.view === 'team', gr = c.view === 'groups', on = k => (c.view === 'tower' && c[k] === 'on' ? 1 : 0);
      return { scale_len: 1, scale_time: on('time'), scale_net: on('nets'), scale_med: on('med'), scale_rg: gr ? 1 : 0, scale_syn: gr ? 1 : 0, scale_team: tm ? 1 : 0 };
    },
  });
};
