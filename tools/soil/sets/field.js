// field: the trial's 24 plots under netting (2 wheat lines x 3 regimes x 4 replicates, the replicates drawn as four
// blocks), the wheat growing over the five sampling dates with each plot's leaves coloured by its measured chlorophyll,
// nitrate seeping down as blue light under each plot, jars of each date's soil breathing out N2O as the slides' curves
// say, soil cores lifting out of the plots and stacking into the design's 30 groups, and the plots lit by a module of
// the network. Real numbers from SOIL_DATA (SDATA); the plots' layout, the wheat's look (its height and stage by the
// Zadoks stages of design.times) and the plume's shape are illustrative; the day-70 chlorophyll and the jars' N2O are
// read off the slides. Manifest: field.md.
// Frame: the plots on the x-z plane at y = 0 (about 1.8 by 1.2), a soil slab under them to y = -0.25, the wheat up to
// about y = 0.3 when ripe, the netting at y = 0.42, the jars on a bench to the right (x about 1.3), the stack of cores
// behind (z about -0.95, up to y about 0.75). The net set (the cloud and the network) is drawn in this frame, over it.
SETS.field = function (K) {
  const { THREE, clamp, prog, smooth, rng, lerp } = K;
  const set = K.newSet('field');
  const LK = TLOOK(K, set), C = SLOOK.rgb, D = SOIL_DATA, TIMES = D.design.times;
  const TAU = Math.PI * 2;
  // the plots: 4 blocks (rows along z, the replicates) of 6 plots (along x); in each block the six treatments in an
  // order of their own (seeded: a randomised block design, as a field trial is laid out; the real map is not known)
  const PW = 0.24, PD = 0.2, GX = 0.06, GZ = 0.1, rnd = K.rng(16), order = [];
  for (let r = 0; r < 4; r++) {
    const o = [0, 1, 2, 3, 4, 5];
    for (let i = 5; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    order.push(o);
  }
  const plotXZ = p => {
    const { line, fert, rep } = SDATA.ofPlot(p), k = order[rep].indexOf(line * 3 + fert);
    return [(k - 2.5) * (PW + GX), 0, (rep - 1.5) * (PD + GZ)];
  };
  const PXZ = [];
  for (let p = 0; p < 24; p++) PXZ.push(plotXZ(p));
  // ------------------------------------------------------------------ the data per plot and date (looked up once)
  const KEYS = ['chl', 'nh4', 'no3', 'n2o', 'ph'], UNIT = { chl: ' SPAD', nh4: ' mg N/kg', no3: ' mg N/kg', n2o: '', ph: '' };
  const plotVal = (key, p, time) => { const { line, fert, rep } = SDATA.ofPlot(p), v = SDATA.value(key, SDATA.slot(line, fert, time, rep)); return v === null || v === undefined ? null : v; };
  const groupMean = (key, line, fert, time) => { const m = SDATA.meta(key, line, fert, time).mean; return m === null || m === undefined ? null : m; };
  // a plot's value at each date, its group's mean where the plot has none (the missing sample)
  const series = key => { const out = []; for (let p = 0; p < 24; p++) { const { line, fert } = SDATA.ofPlot(p); out.push(TIMES.map((T, ti) => { const v = plotVal(key, p, ti); return v !== null ? v : groupMean(key, line, fert, ti); })); } return out; };
  const NH4 = series('nh4'), NO3 = series('no3');
  // chlorophyll: the plots' own on days 1, 15 and 24; on day 70 the slides' reading for the group (the metadata's T4 is day
  // 70's, see SOIL_DATA.open); day 53 lies on the line from day 24 to day 70, as the slides draw it
  const CHL = [];
  for (let p = 0; p < 24; p++) {
    const { line, fert } = SDATA.ofPlot(p), v = [0, 1, 2].map(ti => { const x = plotVal('chl', p, ti); return x !== null ? x : groupMean('chl', line, fert, ti); });
    const v4 = SDATA.chl70(fert, line).v;
    v.push(v[2] + (v4 - v[2]) * (53 - 24) / (70 - 24), v4);
    CHL.push(v);
  }
  const at = (arr, d) => { const i = Math.min(3, Math.floor(clamp(d, 0, 4))), f = clamp(d, 0, 4) - i; return arr[i] + (arr[i + 1] - arr[i]) * f; };
  // a module's score in each plot's sample at each date (0 for the missing sample)
  const SCORE = {};
  const scores = m => SCORE[m] || (SCORE[m] = Array.from({ length: 24 }, (x, p) => { const { line, fert, rep } = SDATA.ofPlot(p); return TIMES.map((T, ti) => { const s = SDATA.net.score(m, SDATA.slot(line, fert, ti, rep)); return s === null || s === undefined ? 0 : s; }); }));
  // the jars' N2O: the slides' curve for a date, regime and line at incubation day tau (0 at the start; never below 0)
  const NT = D.figs.n2o.times;
  function ppm(time, fert, line, tau) {
    const c = SDATA.n2o(time, fert, line);
    if (tau <= NT[0]) return Math.max(0, c[0] * tau / NT[0]);
    for (let i = 1; i < NT.length; i++) if (tau <= NT[i]) return Math.max(0, c[i - 1] + (c[i] - c[i - 1]) * (tau - NT[i - 1]) / (NT[i] - NT[i - 1]));
    return Math.max(0, c[c.length - 1]);
  }
  // ------------------------------------------------------------------ shared shader parts
  const LIGHT = 'vec3 l = normalize(vec3(-0.45, 0.55, 0.7));';
  const NOISE = `
float hsh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hsh(i + vec3(0.0, 1.0, 0.0)), hsh(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hsh(i + vec3(0.0, 0.0, 1.0)), hsh(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hsh(i + vec3(0.0, 1.0, 1.0)), hsh(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }`;
  const LITCOL = `
  vec3 n = normalize(vN), v = normalize(vV); if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - abs(dot(n, v)), 2.2), spec = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);`;
  // per plot, refilled each frame: x ammonium glow, y the module's score (lit), z brightness (1, or dimmed when not
  // picked), w nitrate; and the leaves' colour
  const UP = { uPlot: { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, 0, 1, 0)) }, uLeaf: { value: Array.from({ length: 24 }, () => new THREE.Vector3(0.3, 0.6, 0.25)) },
    uMcol: { value: new THREE.Color(1, 1, 1) } };
  const PLOTGL = 'uniform vec4 uPlot[24]; uniform vec3 uLeaf[24]; uniform vec3 uMcol;';
  const shader = o => {
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, UP, o.uniforms || {}), vertexShader: o.vertex, fragmentShader: o.fragment,
      transparent: true, side: o.side === undefined ? THREE.DoubleSide : o.side, blending: o.blending || THREE.NormalBlending, depthWrite: o.depthWrite !== false });
    if (o.fixed) m.userData.fixed = true;
    set.mats.push(m);
    return m;
  };
  // ------------------------------------------------------------------ the slab: soil under the field (its near sides turn
  // to glass while the nitrate shows, as the soil story's block)
  const SX = 0.98, SZ = 0.66, SY = 0.25;
  const slabMat = shader({
    fixed: true, depthWrite: false,
    uniforms: { uCut: { value: 0 }, uEdge: { value: new THREE.Color(...C(SLOOK.SOIL.water)) } },
    vertex: `varying vec3 vN, vV, vP; void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragment: `uniform float uA, uCut; uniform vec3 uEdge; varying vec3 vN, vV, vP;
${NOISE}
void main() {
  ${LITCOL}
  float dx = ${SX} - abs(vP.x), dy = min(-vP.y, vP.y + ${SY}), dz = ${SZ} - abs(vP.z);
  float e = dx + dy + dz - min(dx, min(dy, dz)) - max(dx, max(dy, dz)), edge = smoothstep(0.006, 0.0, e), cut = gl_FrontFacing ? uCut : 0.0;
  float y = -vP.y + 0.01 * (vnoise(vP * 9.0) - 0.5), nn = vnoise(vP * 45.0) * 0.6 + vnoise(vP * 110.0) * 0.4;
  vec3 pc = mix(vec3(0.13, 0.09, 0.065), vec3(0.24, 0.17, 0.12), smoothstep(0.02, 0.07, y));
  pc = mix(pc, vec3(0.36, 0.26, 0.17), smoothstep(0.12, 0.2, y)) * (0.75 + 0.5 * nn);
  vec3 col = pc * (0.45 + 0.5 * dif + 0.18 * hemi);
  gl_FragColor = vec4(mix(col, pc * 0.9 + uEdge * edge * 0.7, cut), uA * mix(1.0, 0.08 + 0.6 * edge, cut));
}`,
  });
  {
    const fs = [], face = (w, h, rot, pos) => { const g = new THREE.PlaneGeometry(w, h); g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot))); g.translate(...pos); g.deleteAttribute('uv'); fs.push(g); };
    face(2 * SX, SY, [0, 0, 0], [0, -SY / 2, SZ]); face(2 * SX, SY, [0, Math.PI, 0], [0, -SY / 2, -SZ]);
    face(2 * SZ, SY, [0, Math.PI / 2, 0], [SX, -SY / 2, 0]); face(2 * SZ, SY, [0, -Math.PI / 2, 0], [-SX, -SY / 2, 0]);
    face(2 * SX, 2 * SZ, [Math.PI / 2, 0, 0], [0, -SY, 0]);
    const slab = new THREE.Mesh(K.merge(fs), slabMat); slab.renderOrder = 2; slab.frustumCulled = false;
    set.group.add(slab);
  }
  // ------------------------------------------------------------------ the ground and the plots (one mesh): mown paths
  // between the plots; each plot tilled soil in rows, edged in its regime's colour; it glows amber with its ammonium,
  // in a module's colour with the module's score, and darkens while not picked
  const ground = (() => {
    const P = [], N = [], A = [], I = [];   // A: plot index (-1 the ground), u, v, regime
    const quad = (x0, z0, x1, z1, y, plot, reg, nu, nv) => {
      const b = P.length / 3;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const u = i / nu, v = j / nv;
        P.push(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * v); N.push(0, 1, 0); A.push(plot, u, v, reg);
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = b + j * (nu + 1) + i; I.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2); }
    };
    quad(-SX, -SZ, SX, SZ, 0, -1, 0, 24, 16);
    for (let p = 0; p < 24; p++) { const [x, , z] = PXZ[p], { fert } = SDATA.ofPlot(p); quad(x - PW / 2, z - PD / 2, x + PW / 2, z + PD / 2, 0.006, p, fert, 6, 5); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('aI', new THREE.Float32BufferAttribute(A, 4)); g.setIndex(I);
    const regs = SLOOK.FERT.map(h => `vec3(${C(h).map(x => x.toFixed(3)).join(', ')})`);
    const m = shader({
      uniforms: { uNh4: { value: new THREE.Color(...C(SLOOK.N.nh4)) } },
      vertex: `attribute vec4 aI; ${PLOTGL}
varying vec3 vN, vV, vP, vR; varying vec4 vQ; varying vec2 vUV; varying float vPl;
void main() {
  vPl = aI.x; vUV = aI.yz; vQ = vec4(0.0, 0.0, 1.0, 0.0);
  if (aI.x > -0.5) vQ = uPlot[int(aI.x + 0.5)];
  vR = aI.w < 0.5 ? ${regs[0]} : aI.w < 1.5 ? ${regs[1]} : ${regs[2]};
  vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`,
      fragment: `uniform float uA, uMlit; uniform vec3 uMcol, uNh4; varying vec3 vN, vV, vP, vR; varying vec4 vQ; varying vec2 vUV; varying float vPl;
${NOISE}
void main() {
  ${LITCOL}
  float nn = vnoise(vP * 70.0) * 0.6 + vnoise(vP * 180.0) * 0.4;
  vec3 col;
  if (vPl < -0.5) {
    col = mix(vec3(0.1, 0.13, 0.07), vec3(0.17, 0.2, 0.1), nn);   // mown paths
    col = col * (0.5 + 0.5 * dif + 0.2 * hemi);
  } else {
    // tilled soil in drilled rows along x, edged in the regime's colour
    float row = 0.5 + 0.5 * cos(vUV.y * 6.2831853 * 5.0);
    col = mix(vec3(0.16, 0.11, 0.075), vec3(0.27, 0.19, 0.13), nn * 0.6 + row * 0.4);
    col = col * (0.45 + 0.55 * dif + 0.2 * hemi);
    float e = min(min(vUV.x, 1.0 - vUV.x) * ${(PW / PD).toFixed(3)}, min(vUV.y, 1.0 - vUV.y));
    col += uNh4 * vQ.x * (0.55 + 0.45 * nn) * 0.9;
    col = mix(col, uMcol * (0.55 + 0.45 * row), clamp(vQ.y, 0.0, 1.0) * 0.85);
    col *= 1.0 - 0.6 * clamp(-vQ.y, 0.0, 1.0);
    col *= vQ.z;
    col = mix(col, vR * (0.8 + 0.4 * vQ.z), smoothstep(0.045, 0.025, e));
  }
  gl_FragColor = vec4(col, uA);
}`,
    });
    m.uniforms.uMlit = { value: 0 };
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ the wheat: about fifty stems in rows on every plot
  // (the flock's swaying reeds, grown into wheat: a stalk, two leaves and an ear), height and stage by the date, the
  // leaves by the plot's chlorophyll
  const wheat = (() => {
    const P = [], N = [], B = [], W = [], I = [], r = rng(5);
    // one stem in unit height (y 0..1 the stem's height; offsets scale with it)
    const strip = (pts, wid, nrm, kind, base, w4) => {
      const b = P.length / 3;
      pts.forEach((q, i) => {
        const s = i / (pts.length - 1), hw = wid(s);
        P.push(q[0] - nrm[2] * hw, q[1], q[2] + nrm[0] * hw, q[0] + nrm[2] * hw, q[1], q[2] - nrm[0] * hw);
        N.push(nrm[0], 0.4, nrm[2], nrm[0], 0.4, nrm[2]);
        for (let k = 0; k < 2; k++) { B.push(...base); W.push(kind, s, w4[0], w4[1]); }
      });
      for (let i = 0; i < pts.length - 1; i++) { const a = b + 2 * i; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    };
    for (let p = 0; p < 24; p++) {
      const [px, , pz] = PXZ[p];
      for (let row = 0; row < 5; row++) for (let k = 0; k < 10; k++) {
        const x = px + (k + 0.5 + (r() - 0.5) * 0.6) / 10 * PW * 0.9 - PW * 0.45, z = pz + (row + 0.5) / 5 * PD * 0.8 - PD * 0.4 + (r() - 0.5) * 0.012;
        const base = [x, z, p, r()], ph = r() * TAU, lean = (r() - 0.5) * 0.12, az = r() * TAU, ca = Math.cos(az), sa = Math.sin(az);
        // the stalk (to 0.8: the ear above it), facing a random way
        const st = [0, 0.27, 0.54, 0.8].map(y => [lean * y * y, y, lean * 0.4 * y * y]);
        strip(st, s => 0.011 * (1 - 0.4 * s), [ca, 0, sa], 0, base, [ph, az]);
        // two leaves arching out
        for (const [h0, dir, len] of [[0.25, az + 1.2, 0.45], [0.5, az + 1.2 + Math.PI, 0.38]]) {
          const dx = Math.cos(dir), dz = Math.sin(dir), pts = [];
          for (let i = 0; i <= 4; i++) { const s = i / 4, e = 0.9 - 1.9 * s * s; pts.push([lean * h0 * h0 + dx * len * s * 0.75, h0 + Math.sin(0.9) * len * s - 0.5 * len * s * s * (1 + 0.5 * s), lean * 0.4 * h0 * h0 + dz * len * s * 0.75]); void e; }
          strip(pts, s => 0.03 * Math.sin(Math.PI * Math.min(1, s * 1.05 + 0.08)) + 0.003, [-dz, 0, dx], 1, base, [ph, az]);
        }
        // the ear: two crossed diamonds from 0.8 to 1.0
        for (const a2 of [az, az + Math.PI / 2]) {
          const pts = [0.8, 0.86, 0.94, 1.0].map(y => [lean * y * y, y, lean * 0.4 * y * y]);
          strip(pts, s => 0.026 * Math.sin(Math.PI * (0.15 + 0.85 * s)) * (1 - 0.3 * s), [Math.cos(a2), 0, Math.sin(a2)], 2, base, [ph, az]);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('aB', new THREE.Float32BufferAttribute(B, 4)); g.setAttribute('aW', new THREE.Float32BufferAttribute(W, 4)); g.setIndex(I);
    const green = C('#4e9a3c'), earG = C('#8fb04c'), gold = C(SLOOK.SOIL.ear), straw = C(SLOOK.SOIL.straw);
    const v3 = c => `vec3(${c.map(x => x.toFixed(3)).join(', ')})`;
    const m = shader({
      uniforms: { uH: { value: 0.1 }, uGrow: { value: 1 }, uEar: { value: 0 }, uRipe: { value: 0 }, uChl: { value: 1 } },
      vertex: `attribute vec4 aB, aW; ${PLOTGL}
uniform float uH, uGrow, uEar, uRipe, uChl, uTime;
varying vec3 vC, vN, vV;
void main() {
  int pi = int(aB.z + 0.5);
  vec4 Q = uPlot[pi];
  float g = clamp((uGrow - aB.w * 0.35) / 0.65, 0.0, 1.0);
  float h = uH * g * (0.85 + 0.3 * fract(aB.w * 7.31));
  vec3 q = position;
  float kind = aW.x;
  if (kind > 1.5) q.y = 0.8 + (q.y - 0.8) * uEar;   // (the ear comes out of the flag leaf's sheath)
  q *= h;
  // the ripe ears nod
  if (kind > 1.5) { float nod = uRipe * 0.35 * (q.y - 0.8 * h) / h; q.x += nod * h * cos(aW.w); q.z += nod * h * sin(aW.w); }
  float sw = pow(q.y / 0.3, 2.0);
  q.x += sw * (0.012 * sin(uTime * 1.3 + aB.x * 4.0 + aB.y * 2.0 + aW.z) + 0.006);
  q.z += sw * 0.008 * sin(uTime * 1.07 + aB.x * 3.0 + aW.z * 1.7);
  vec3 p = vec3(aB.x, 0.0, aB.y) + q;
  vec3 leaf = mix(${v3(green)}, uLeaf[pi], uChl) * (0.82 + 0.36 * fract(aB.w * 13.7));
  vec3 ear = mix(${v3(earG)}, ${v3(gold)}, uRipe);
  vC = kind > 1.5 ? ear : kind < 0.5 ? mix(leaf * 1.05, ${v3(straw)}, uRipe * 0.35) : leaf;
  vC *= Q.z;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (h < 0.002 || (kind > 1.5 && uEar < 0.01)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `uniform float uA; varying vec3 vC, vN, vV;
void main() {
  ${LITCOL}
  vec3 col = vC * (0.42 + 0.5 * dif + 0.2 * hemi) + vC * rim * 0.35 + vec3(spec * 0.08);
  gl_FragColor = vec4(col, uA);
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    set.group.add(mesh);
    return { mesh, m, tris: I.length / 3 };
  })();
  // ------------------------------------------------------------------ the netting: posts round the field and a net over
  // it on lines, sagging between the posts (drawn across as field_net grows)
  const NY = 0.42, POSTS = [];
  for (const x of [-SX, -SX / 3, SX / 3, SX]) for (const z of [-SZ, SZ]) POSTS.push([x, z]);
  POSTS.push([-SX, 0], [SX, 0]);
  const net = (() => {
    const segs = [], sag = (x, z) => NY - 0.035 * Math.sin(Math.PI * ((x + SX) / (2 * SX / 3) % 1)) * Math.sin(Math.PI * (z + SZ) / SZ % Math.PI);
    const L = (a, b) => segs.push([a, b]);
    const ST = 0.055, n = 26;
    for (let x = -SX; x <= SX + 1e-6; x += ST) for (let i = 0; i < n; i++) { const z0 = -SZ + 2 * SZ * i / n, z1 = -SZ + 2 * SZ * (i + 1) / n; L([x, sag(x, z0), z0], [x, sag(x, z1), z1]); }
    for (let z = -SZ; z <= SZ + 1e-6; z += ST) for (let i = 0; i < 36; i++) { const x0 = -SX + 2 * SX * i / 36, x1 = -SX + 2 * SX * (i + 1) / 36; L([x0, sag(x0, z), z], [x1, sag(x1, z), z]); }
    // the sides: vertical lines and a few rows
    for (const z of [-SZ, SZ]) { for (let x = -SX; x <= SX + 1e-6; x += ST * 2) L([x, 0, z], [x, sag(x, z), z]); for (const y of [0.1, 0.2, 0.3]) for (let i = 0; i < 18; i++) L([-SX + 2 * SX * i / 18, y, z], [-SX + 2 * SX * (i + 1) / 18, y, z]); }
    for (const x of [-SX, SX]) { for (let z = -SZ; z <= SZ + 1e-6; z += ST * 2) L([x, 0, z], [x, sag(x, z), z]); for (const y of [0.1, 0.2, 0.3]) for (let i = 0; i < 12; i++) L([x, y, -SZ + 2 * SZ * i / 12], [x, y, -SZ + 2 * SZ * (i + 1) / 12]); }
    const g = K.linesGeo(segs.length), Pp = g.attributes.position.array, Cc = g.attributes.aCol.array, A = g.attributes.aA.array, T = g.attributes.aT.array, nc = C(SLOOK.SOIL.net);
    segs.forEach(([a, b], i) => { Pp.set(a, 6 * i); Pp.set(b, 6 * i + 3); Cc.set(nc, 6 * i); Cc.set(nc, 6 * i + 3); A[2 * i] = A[2 * i + 1] = a[1] > NY - 0.06 && b[1] > NY - 0.06 ? 0.22 : 0.16; T[2 * i] = T[2 * i + 1] = ((a[0] + b[0]) / 2 + SX) / (2 * SX) * 0.9; });
    const m = K.lines(set);
    const mesh = new THREE.LineSegments(g, m); mesh.frustumCulled = false; mesh.renderOrder = 1;
    set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ lit things: posts, the bench, the jars' soil and
  // lids, the plots' signs (instanced built-in materials, coloured per instance)
  const cylP = (() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false); g.translate(0, 0.5, 0);
    const mt = K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05 }));
    const mesh = new THREE.InstancedMesh(g, mt, 120); mesh.frustumCulled = false; mesh.count = 0;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3), 3);   // (setColorAt would size it by count, 0 here)
    set.group.add(mesh);
    return mesh;
  })();
  const boxP = (() => {
    const mt = K.fade(set, new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.02 }));
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mt, 64); mesh.frustumCulled = false; mesh.count = 0;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3), 3);
    set.group.add(mesh);
    return mesh;
  })();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _t = new THREE.Vector3(), _col = new THREE.Color();
  const putI = (mesh, i, pos, scl, col) => { _m.compose(_t.set(pos[0], pos[1], pos[2]), _q.set(0, 0, 0, 1), _s.set(scl[0], scl[1], scl[2])); mesh.setMatrixAt(i, _m); mesh.setColorAt(i, _col.setRGB(col[0], col[1], col[2])); };
  // the jars: one per regime and line for a date (six), or all five dates in rows (thirty)
  const BX = 1.3, JR = 0.042, JH = 0.11;
  const _jx = [0, 0], jarXZ = (time, fert, line, all, out = _jx) => { out[0] = all ? BX + (time - 2) * 0.115 : BX; out[1] = (fert * 2 + line - 2.5) * 0.13; return out; };
  const jarGeo = (() => {
    const prof = [[0.001, 0], [0.9, 0], [1, 0.06], [1, 0.82], [0.88, 0.93], [0.72, 0.97], [0.72, 1.0]].map(([r, y]) => new THREE.Vector2(r * JR, y * JH));
    return new THREE.LatheGeometry(prof, 28);
  })();
  const jarMat = K.rim(set, { color: '#bfe6ff', a0: 0.05, a1: 0.75 });
  const jars = new THREE.InstancedMesh(jarGeo, jarMat, 30); jars.frustumCulled = false; jars.count = 0; jars.renderOrder = 3;
  set.group.add(jars);
  // the fixed pieces of the pools (posts, signs, bench): written once; the jars' pieces follow the date (layoutJars)
  const POSTC = C(SLOOK.SOIL.post), BENCH = C('#56657c'), LEG = C('#3e4859'), SOILJ = C('#4a3424'), LID = C('#9aa4b2');
  let nCylFixed = 0, nBoxFixed = 0;
  {
    POSTS.forEach(([x, z], i) => putI(cylP, i, [x, -0.002, z], [0.009, NY + 0.02, 0.009], POSTC));
    nCylFixed = POSTS.length;
    let b = 0;
    benchAt(1); b = 5;
    // a small sign at the front of each plot: a post and a plate in its wheat line's colour
    for (let p = 0; p < 24; p++) {
      const [x, , z] = PXZ[p], { line } = SDATA.ofPlot(p), lc = C(SLOOK.LINE[line]);
      putI(boxP, b++, [x - PW / 2 + 0.02, 0.025, z + PD / 2 + 0.012], [0.004, 0.05, 0.004], POSTC);
      putI(boxP, b++, [x - PW / 2 + 0.02, 0.05, z + PD / 2 + 0.014], [0.032, 0.02, 0.003], lc);
    }
    nBoxFixed = b;
    boxP.count = b; boxP.instanceMatrix.needsUpdate = true; boxP.instanceColor.needsUpdate = true;
  }
  // the bench (box instances 0 to 4), there only while the jars are
  function benchAt(k) {
    const kk = Math.max(1e-3, k);
    putI(boxP, 0, [BX, -0.012, 0], [0.62 * kk, 0.024, 0.88 * kk], BENCH);
    [[-0.28, -0.41], [0.28, -0.41], [-0.28, 0.41], [0.28, 0.41]].forEach(([dx, dz], i) => putI(boxP, 1 + i, [BX + dx * kk, -0.135 + 0.115 * (1 - kk), dz * kk], [0.03 * kk, 0.23 * kk, 0.03 * kk], LEG));
    boxP.instanceMatrix.needsUpdate = true;
  }
  let jarKey = '', benchK = -1;
  function layoutJars(jday, show) {
    const key = jday + '|' + (show > 0.004);
    if (key === jarKey) return;
    jarKey = key;
    let c = nCylFixed, j = 0;
    if (show > 0.004) for (let ti = 0; ti < 5; ti++) {
      if (jday >= 0 && ti !== jday) continue;
      for (let fert = 0; fert < 3; fert++) for (let line = 0; line < 2; line++) {
        const [x, z] = jarXZ(ti, fert, line, jday < 0);
        _m.compose(_t.set(x, 0, z), _q.set(0, 0, 0, 1), _s.set(1, 1, 1)); jars.setMatrixAt(j++, _m);
        putI(cylP, c++, [x, 0.003, z], [JR * 0.86, 0.035, JR * 0.86], SOILJ);
        putI(cylP, c++, [x, JH, z], [JR * 0.78, 0.012, JR * 0.78], C(SLOOK.LINE[line]));
        putI(cylP, c++, [x, 0.0, z], [JR * 1.18, 0.004, JR * 1.18], C(SLOOK.FERT[fert]));
      }
    }
    jars.count = j; jars.instanceMatrix.needsUpdate = true;
    cylP.count = c; cylP.instanceMatrix.needsUpdate = true; if (cylP.instanceColor) cylP.instanceColor.needsUpdate = true;
  }
  layoutJars(0, 0);
  // ------------------------------------------------------------------ light columns: nitrate seeping down under each plot,
  // and a module's light rising from the plots where it is strong (one additive mesh)
  const columns = (() => {
    const P = [], A = [], I = [];
    for (let p = 0; p < 24; p++) for (const dir of [-1, 1]) {
      const [x, , z] = PXZ[p], w = PW * (dir < 0 ? 0.46 : 0.4), d = PD * (dir < 0 ? 0.46 : 0.4), b = P.length / 3;
      const box = new THREE.BoxGeometry(2 * w, 1, 2 * d, 1, 6, 1); box.translate(0, 0.5, 0);
      const pa = box.attributes.position.array;
      for (let i = 0; i < pa.length; i += 3) { P.push(x + pa[i], pa[i + 1], z + pa[i + 2]); A.push(p, dir, pa[i + 1], 0); }
      for (const ix of box.index.array) I.push(b + ix);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aI', new THREE.Float32BufferAttribute(A, 4)); g.setIndex(I);
    const m = shader({
      depthWrite: false, blending: THREE.AdditiveBlending, fixed: true,
      uniforms: { uNo3: { value: new THREE.Color(...C(SLOOK.N.no3Glow)) } },
      vertex: `attribute vec4 aI; ${PLOTGL} uniform float uTime; uniform vec3 uNo3;
varying float vI, vH, vDir; varying vec3 vP; varying vec3 vC;
void main() {
  vec4 Q = uPlot[int(aI.x + 0.5)];
  vec3 p = position; float u = aI.z;
  if (aI.y < 0.0) { float dep = clamp(0.03 + 0.24 * Q.w, 0.0, ${(SY - 0.006).toFixed(3)}); p.y = -0.004 - u * dep; vI = Q.w; vC = uNo3; }
  else { float s = clamp(Q.y, 0.0, 1.2); p.y = 0.01 + u * (0.1 + 0.95 * s); vI = s; vC = uMcol; }
  vH = u; vDir = aI.y; vP = p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  if (vI < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `uniform float uA, uTime; varying float vI, vH, vDir; varying vec3 vP; varying vec3 vC;
${NOISE}
void main() {
  float streak = vnoise(vec3(vP.x * 60.0, vP.y * 14.0 + uTime * 0.5 * vDir * -1.0, vP.z * 60.0));
  float a = vDir < 0.0 ? pow(1.0 - vH, 1.4) * (0.5 + 0.5 * streak) * 0.5 : pow(1.0 - vH, 1.5) * (0.45 + 0.55 * streak) * 0.42;
  gl_FragColor = vec4(vC * a * min(1.0, vI * 1.3) * uA, 1.0);
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3;
    set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ the cores: one out of every plot at each date (119;
  // the missing sample never lifts), lifting out and flying into the design's stack (the aging ovary story's stacking
  // movement: two poses per instance, a staggered smoothstep from one to the other)
  const stackXYZ = (line, fert, time, rep) => [(fert - 1) * 0.42 + (rep - 1.5) * 0.065, 0.12 + time * 0.13, -0.95 + (line - 0.5) * 0.12];
  const CORES = [];
  for (let g = 0; g < 30; g++) for (let rep = 0; rep < 4; rep++) {
    const s = g * 4 + rep;
    if (s === SDATA.missing) continue;
    const { line, fert, time } = SDATA.ofSlot(s);
    CORES.push({ s, line, fert, time, rep, plot: SDATA.plot(line, fert, rep) });
  }
  const cores = (() => {
    const g0 = new THREE.CylinderGeometry(1, 1, 1, 12, 3, false);
    const n = CORES.length, g = new THREE.InstancedBufferGeometry();
    g.setIndex(g0.index); g.setAttribute('position', g0.attributes.position); g.setAttribute('normal', g0.attributes.normal);
    const aA = new Float32Array(n * 4), aB = new Float32Array(n * 4), aI = new Float32Array(n * 4);
    CORES.forEach((c, i) => {
      const [x, , z] = PXZ[c.plot];
      aA.set([x + (c.time - 2) * 0.04, z - 0.02, c.time, 0], 4 * i);
      aB.set([...stackXYZ(c.line, c.fert, c.time, c.rep), (c.time * 4 + c.rep) / 20 + c.fert * 0.04], 4 * i);
      aI.set([c.fert, c.line, c.time, c.rep], 4 * i);
    });
    g.setAttribute('aA', new THREE.InstancedBufferAttribute(aA, 4)); g.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4)); g.setAttribute('aI', new THREE.InstancedBufferAttribute(aI, 4));
    g.instanceCount = n;
    const regs = SLOOK.FERT.map(h => `vec3(${C(h).map(x => x.toFixed(3)).join(', ')})`), lns = SLOOK.LINE.map(h => `vec3(${C(h).map(x => x.toFixed(3)).join(', ')})`);
    const m = shader({
      uniforms: { uLift: { value: 0 }, uStack: { value: 0 } },
      vertex: `attribute vec4 aA, aB, aI;
uniform float uLift, uStack;
varying vec3 vN, vV, vL, vReg, vLin; varying float vS, vNy;
void main() {
  vNy = normal.y;
  float lift = smoothstep(0.0, 1.0, clamp(uLift * 5.0 - aI.z, 0.0, 1.0));
  float st = smoothstep(0.0, 1.0, clamp(uStack * 1.6 - aB.w * 0.6, 0.0, 1.0));
  float r = 0.022, h = 0.1 * max(lift, st);
  vec3 a = vec3(aA.x, mix(-0.1, 0.03, lift), aA.y), b = aB.xyz - vec3(0.0, 0.05, 0.0);
  vec3 c = mix(a, b, st) + vec3(0.0, sin(st * 3.14159) * 0.28, 0.0);
  vec3 p = c + vec3(position.x * r, (position.y + 0.5) * h, position.z * r);
  vL = position; vS = st;
  vReg = aI.x < 0.5 ? ${regs[0]} : aI.x < 1.5 ? ${regs[1]} : ${regs[2]};
  vLin = aI.y < 0.5 ? ${lns[0]} : ${lns[1]};
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (h < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `uniform float uA; varying vec3 vN, vV, vL, vReg, vLin; varying float vS, vNy;
void main() {
  ${LITCOL}
  float y = vL.y + 0.5;
  vec3 soil = mix(vec3(0.42, 0.3, 0.2), vec3(0.17, 0.12, 0.08), smoothstep(0.55, 0.95, y));
  vec3 col = soil * (0.4 + 0.55 * dif + 0.2 * hemi) + soil * rim * 0.4;
  // in the stack: a band in its regime's colour, a cap in its wheat line's
  float band = smoothstep(0.08, 0.0, abs(y - 0.72)) * vS;
  col = mix(col, vReg * (0.7 + 0.5 * dif), band);
  col = mix(col, vLin * (0.75 + 0.4 * dif), vS * step(0.9, vNy));
  col += vReg * rim * 0.5 * vS;
  gl_FragColor = vec4(col, uA);
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ glows: nitrate drips under the plots, ammonium
  // sparkles on them, the module's light rising, the jars' N2O plumes (one pool of soft points)
  const H = LK.halos(1100);
  H.mesh.renderOrder = 4;
  set.group.add(H.mesh);
  const cNH4 = C(SLOOK.N.nh4), cNO3 = C(SLOOK.N.no3Glow), cN2O = C(SLOOK.N.n2o), _p = [0, 0, 0], mcol = [1, 1, 1];
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  // ------------------------------------------------------------------ state for labels
  const now = { date: 0, pick: -1, show: 0, tags: 0, jday: 0, inc: 0, mod: -1, mlit: 0, line: -1, fert: -1, jar: [] };
  for (let i = 0; i < 6; i++) now.jar.push({ v: 0, top: [BX, 0.2, 0] });
  const lit = p => { const { line, fert } = SDATA.ofPlot(p); return (now.line < 0 || now.line === line) && (now.fert < 0 || now.fert === fert) && (now.pick < 0 || now.pick === line * 3 + fert); };
  // ------------------------------------------------------------------ update: everything from the params and t
  const Hd = [0.13, 0.205, 0.27, 0.285, 0.285];   // the wheat's height at each date (jointing to ripening; a drawing)
  function update(S, t) {
    LK.depth();
    const grow = clamp(S.field_grow, 0, 1), date = clamp(S.field_date, 0, 4), chl = clamp(S.field_chl, 0, 1), no3 = clamp(S.field_no3, 0, 1), nh4 = clamp(S.field_nh4, 0, 1);
    const jarsA = clamp(S.field_jars, 0, 1), jday = Math.round(S.field_jday === undefined ? 0 : S.field_jday), inc = clamp(S.field_inc, 0, 1);
    const coresA = clamp(S.field_cores, 0, 1), stack = clamp(S.field_stack, 0, 1), mod = Math.round(S.field_module === undefined ? -1 : S.field_module), mlit = clamp(S.field_mlit, 0, 1);
    const pick = Math.round(S.field_pick === undefined ? -1 : S.field_pick), netA = clamp(S.field_net, 0, 1);
    now.date = date; now.pick = pick; now.show = Math.round(S.field_show || 0); now.tags = clamp(S.field_tags, 0, 1); now.jday = jday; now.inc = inc; now.mod = mod; now.mlit = mlit;
    now.line = Math.round(S.field_line === undefined ? -1 : S.field_line); now.fert = Math.round(S.field_fert === undefined ? -1 : S.field_fert);
    // the wheat by date: its height (jointing, booting, heading, grain filling, ripening), its ears and their colour
    wheat.m.uniforms.uH.value = at(Hd, date); wheat.m.uniforms.uGrow.value = grow;
    wheat.m.uniforms.uEar.value = prog(date, 1.4, 2.05) * (0.85 + 0.15 * prog(date, 2.5, 3.2)); wheat.m.uniforms.uRipe.value = prog(date, 3.1, 4);
    wheat.m.uniforms.uChl.value = chl;
    // per plot: ammonium, the module's score, brightness, nitrate, leaf colour
    const sc = mod >= 0 && mod < D.net.mods.length ? scores(mod) : null;
    if (sc) { const c = C(SLOOK.module(mod)); UP.uMcol.value.setRGB(c[0], c[1], c[2]); mcol[0] = c[0]; mcol[1] = c[1]; mcol[2] = c[2]; }
    ground.m.uniforms.uMlit.value = mlit;
    for (let p = 0; p < 24; p++) {
      const Q = UP.uPlot.value[p], lv = Math.pow(clamp(at(NH4[p], date) / 220, 0, 1), 0.6) * nh4, nv = clamp(at(NO3[p], date) / 110, 0, 1.3) * no3;
      Q.set(lv, sc ? at(sc[p], date) / 0.8 * mlit : 0, lit(p) ? 1 : 0.32, nv);
      const lc = SLOOK.chl(at(CHL[p], date), _p);
      UP.uLeaf.value[p].set(lc[0], lc[1], lc[2]);
    }
    // the slab turns to glass while the nitrate shows
    slabMat.uniforms.uCut.value = no3;
    slabMat.depthWrite = no3 < 0.02 && set.uA.value > 0.97;
    // the netting, drawn across
    net.m.uniforms.uReveal.value = netA; net.mesh.visible = netA > 0.004;
    for (let i = 0; i < nCylFixed; i++) { _m.compose(_t.set(POSTS[i][0], -0.002, POSTS[i][1]), _q.set(0, 0, 0, 1), _s.set(0.009, (NY + 0.02) * Math.max(1e-3, prog(netA, 0, 0.3)), 0.009)); cylP.setMatrixAt(i, _m); }
    cylP.instanceMatrix.needsUpdate = true;
    // the jars
    layoutJars(jday, jarsA);
    const bk = smooth(prog(jarsA, 0, 0.5));
    if (Math.abs(bk - benchK) > 1e-4) { benchK = bk; benchAt(bk); }
    jars.visible = jarsA > 0.004; jarMat.uniforms.uK.value = jarsA;
    // the cores
    cores.m.uniforms.uLift.value = coresA; cores.m.uniforms.uStack.value = stack;
    cores.mesh.visible = coresA > 0.002 || stack > 0.002;
    // the glows
    H.begin();
    if (no3 > 0.01) for (let p = 0; p < 24; p++) {
      const v = UP.uPlot.value[p].w, n = Math.round(v * 10), [x, , z] = PXZ[p];
      for (let k = 0; k < n; k++) {
        const per = 3 + hash(p, k) * 2, a = (t / per + hash(k, p)) % 1, dep = 0.03 + 0.21 * clamp(v, 0, 1);
        _p[0] = x + (hash(p * 7, k) - 0.5) * PW * 0.8; _p[1] = -0.01 - a * dep; _p[2] = z + (hash(k * 3, p) - 0.5) * PD * 0.8;
        H.add(_p, 0.03, cNO3, 0.9 * (1 - a) * Math.min(1, a * 8) * UP.uPlot.value[p].z);
      }
    }
    if (nh4 > 0.01) for (let p = 0; p < 24; p++) {
      const v = UP.uPlot.value[p].x, n = Math.round(v * 6), [x, , z] = PXZ[p];
      for (let k = 0; k < n; k++) {
        _p[0] = x + (hash(p * 5, k) - 0.5) * PW * 0.85; _p[1] = 0.008; _p[2] = z + (hash(k * 9, p) - 0.5) * PD * 0.85;
        H.add(_p, 0.03, cNH4, 0.5 * (0.6 + 0.4 * Math.sin(t * 2 + k + p)) * UP.uPlot.value[p].z);
      }
    }
    if (sc && mlit > 0.01) for (let p = 0; p < 24; p++) {
      const s = clamp(UP.uPlot.value[p].y, 0, 1.2), n = Math.round(s * 6), [x, , z] = PXZ[p], top = 0.1 + 0.95 * s;
      for (let k = 0; k < n; k++) {
        const a = (t / (2.5 + hash(p, k)) + hash(k, p * 3)) % 1;
        _p[0] = x + (hash(p * 11, k) - 0.5) * PW * 0.7; _p[1] = 0.02 + a * top; _p[2] = z + (hash(k * 13, p) - 0.5) * PD * 0.7;
        H.add(_p, 0.025, mcol, 0.6 * (1 - a) * Math.min(1, a * 6));
      }
    }
    // the plumes: N2O rising from each jar, as high and dense as its curve says at this moment of the incubation
    if (jarsA > 0.01) {
      const tau = inc * 22;
      let k6 = 0;
      for (let ti = 0; ti < 5; ti++) {
        if (jday >= 0 && ti !== jday) continue;
        for (let fert = 0; fert < 3; fert++) for (let line = 0; line < 2; line++) {
          const v = ppm(ti, fert, line, tau), [x, z] = jarXZ(ti, fert, line, jday < 0), top = JH + 0.02 + 0.2 * v, n = Math.round(clamp(v, 0, 2.2) * 13) + (v > 0.02 ? 2 : 0);
          for (let k = 0; k < n; k++) {
            const a = (t / (2.2 + hash(k, ti * 6 + fert * 2 + line)) + hash(ti * 6 + fert * 2 + line, k)) % 1;
            _p[0] = x + 0.025 * Math.sin(t * 1.3 + k * 2.1) * a; _p[1] = JH + 0.01 + a * (top - JH); _p[2] = z + 0.02 * Math.cos(t * 1.1 + k * 1.7) * a;
            H.add(_p, 0.028 + 0.06 * a, cN2O, jarsA * 0.8 * (1 - a * a) * Math.min(1, a * 6));
          }
          if (jday >= 0 && k6 < 6) { const J = now.jar[k6++]; J.v = v; J.top[0] = x; J.top[1] = top + 0.02; J.top[2] = z; }
        }
      }
    }
    H.end();
  }
  // ------------------------------------------------------------------ picking: a ray to a plot
  const _r = new THREE.Ray(), _w = new THREE.Vector3(), _mi = new THREE.Matrix4();
  function pick(rc) {
    set.group.updateMatrixWorld();
    _mi.copy(set.group.matrixWorld).invert();
    _r.copy(rc.ray).applyMatrix4(_mi);
    if (Math.abs(_r.direction.y) < 1e-6) return null;
    const d = -_r.origin.y / _r.direction.y;
    if (d <= 0) return null;
    _r.at(d, _w);
    for (let p = 0; p < 24; p++) { const [x, , z] = PXZ[p]; if (Math.abs(_w.x - x) <= PW / 2 + GX / 2 && Math.abs(_w.z - z) <= PD / 2 + GZ / 2) { const { line, fert, rep } = SDATA.ofPlot(p); return { kind: 'plot', p, group: line * 3 + fert, line, fert, rep }; } }
    return null;
  }
  // ------------------------------------------------------------------ labels: the date, the regimes and lines, the plots'
  // values when a group is picked, the jars' ppm, the stack, a module
  const dateOf = () => TIMES[Math.round(clamp(now.date, 0, 4))];
  const fmt = (v, key) => (v === null || v === undefined ? '' : key === 'ph' ? v.toFixed(2) : key === 'n2o' ? v.toFixed(2) : v >= 100 ? Math.round(v).toString() : v.toFixed(1));
  const pickPlots = () => (now.pick < 0 ? [] : [0, 1, 2, 3].map(rep => SDATA.plot(Math.floor(now.pick / 3), now.pick % 3, rep)));
  function tagText(k) {
    const pl = pickPlots(), key = KEYS[clamp(now.show, 0, 4)], ti = Math.round(clamp(now.date, 0, 4));
    if (!pl.length) return ['', ''];
    const v = key === 'chl' && ti === 4 ? null : plotVal(key, pl[k], ti);
    return v === null ? ['', ''] : [fmt(v, key), UNIT[key]];
  }
  function sumText() {
    if (now.pick < 0) return ['', ''];
    const line = Math.floor(now.pick / 3), fert = now.pick % 3, key = KEYS[clamp(now.show, 0, 4)], ti = Math.round(clamp(now.date, 0, 4)), M = D.meta[key];
    const other = ['BNI', 'control'][1 - line], day = TIMES[ti].day;
    if (key === 'chl' && ti === 4) { const a = SDATA.chl70(fert, line).v, b = SDATA.chl70(fert, 1 - line).v; return [`${M.name}, day 70: about ${Math.round(a)}`, ` · ${other} about ${Math.round(b)}, read off the slides`]; }
    const tst = SDATA.lineTest(key, fert, ti), me = tst ? tst[line] : null, ot = tst ? tst[1 - line] : null;
    if (me === null || me === undefined) return [`${M.name}, day ${day}`, ' · not measured'];
    const p = tst[2] === null || tst[2] === undefined ? '' : `, p ${tst[2] < 0.001 ? '< 0.001' : tst[2].toFixed(2)}`;
    return [`${M.name}, day ${day}: ${fmt(me, key)}${UNIT[key]}`, ` · ${other} ${fmt(ot, key)}${p}${key === 'n2o' ? ' (unit not given)' : ''}`];
  }
  const plotTop = k => () => { const pl = pickPlots(), p = pl.length ? pl[k] : 0, [x, , z] = PXZ[p]; return [x, 0.3, z]; };
  const MODTXT = m => { const M = D.net.mods[m]; if (!M) return ['', '']; const r = M.r2, f = r.fert >= 0.5 ? 'follows the fertiliser' : r.plot >= 0.5 ? 'follows the plots' : r.time >= 0.5 ? 'follows the date' : 'mixed'; return [`Module ${m + 1}`, ` · ${M.n.toLocaleString('en-GB')} kinds, ${f}`]; };
  // (the net set names the module over the field; here only where it is strong)
  const MODPLOTS = m => (D.net.mods[m] ? [`Module ${m + 1} is strong here`, ' · its plots light up'] : ['', '']);
  const nothingElse = S => (1 - clamp(S.field_jars, 0, 1)) * (1 - prog(S.field_stack, 0, 0.3)) * (1 - prog(S.field_tags * (S.field_pick >= 0 ? 1 : 0), 0, 0.3)) * (1 - prog(S.field_mlit, 0, 0.3)) * (1 - prog(S.net_cloud || 0, 0, 0.3));
  // the regimes, pointed at in the front block (the BNI wheat's plot of each), and the two lines on the unfertilised pair
  const front = (line, fert) => () => { const [x, , z] = PXZ[SDATA.plot(line, fert, 3)]; return [x, 0.32, z + PD * 0.3]; };
  const labels = [
    { text: () => { const T = dateOf(); return [`Day ${T.day}`, ` · ${T.stage}`]; }, at: [-SX, NY + 0.06, -SZ], cls: '',
      alpha: S => prog(S.field_grow, 0.2, 0.5) * (1 - clamp(S.field_jars, 0, 1)) * (1 - prog(S.field_stack, 0, 0.3)) * (1 - prog(S.net_cloud || 0, 0, 0.3)) },
    { text: ['Not fertilised', ''], at: front(1, 0), cls: 'grn', minor: true, alpha: S => prog(S.field_grow, 0.1, 0.4) * nothingElse(S) * (1 - prog(S.field_chl, 0, 0.3)) },
    { text: ['Fertilised', ' · 250 kg N/ha'], at: front(1, 1), cls: 'mag', minor: true, alpha: S => prog(S.field_grow, 0.1, 0.4) * nothingElse(S) * (1 - prog(S.field_chl, 0, 0.3)) },
    { text: ['Fertilised + DCD', ' · an inhibitor'], at: front(1, 2), cls: 'amb', minor: true, alpha: S => prog(S.field_grow, 0.1, 0.4) * nothingElse(S) * (1 - prog(S.field_chl, 0, 0.3)) },
    { text: ['Munal-BNI', ''], at: 'bni', cls: 'cyn', alpha: S => prog(S.field_chl, 0.2, 0.6) * nothingElse(S) },
    { text: ['Munal-control', ''], at: 'ctrl', cls: 'amb', alpha: S => prog(S.field_chl, 0.2, 0.6) * nothingElse(S) },
    // a picked group: its four plots' values and the comparison
    ...[0, 1, 2, 3].map(k => ({ text: () => tagText(k), at: plotTop(k), cls: '', alpha: S => (S.field_pick >= 0 ? 1 : 0) * clamp(S.field_tags, 0, 1) * (1 - clamp(S.field_jars, 0, 1)) })),
    { text: sumText, at: 'pick', cls: 'cyn', alpha: S => (S.field_pick >= 0 ? 1 : 0) * clamp(S.field_tags, 0, 1) * (1 - clamp(S.field_jars, 0, 1)) },
    // the jars
    { text: () => { const ti = now.jday; return ti < 0 ? ['Soil from every date', ' · N2O read off the slides'] : [`Day ${TIMES[clamp(ti, 0, 4)].day} soil in jars`, ` · N2O on incubation day ${Math.round(now.inc * 22)} (read off the slides)`]; },
      at: [BX, 0.0, 0.52], cls: 'mag', alpha: S => prog(S.field_jars, 0.5, 1) },
    ...[0, 1, 2, 3, 4, 5].map(k => ({ text: () => [now.jar[k].v.toFixed(2), ' ppm'], at: () => now.jar[k].top.slice(), cls: '',
      alpha: S => prog(S.field_jars, 0.6, 1) * (Math.round(S.field_jday) >= 0 ? 1 : 0) * prog(S.field_inc, 0.02, 0.08) })),
    // the stack
    { text: ['119 samples', ' · 30 groups of 4, one missing'], at: 'stack', cls: 'cyn', alpha: S => prog(S.field_stack, 0.7, 1) },
    { text: ['Day 1', ' · bottom'], at: [-0.72, 0.12, -0.95], cls: '', minor: true, alpha: S => prog(S.field_stack, 0.8, 1) },
    { text: ['Day 70', ' · top'], at: [-0.72, 0.64, -0.95], cls: '', minor: true, alpha: S => prog(S.field_stack, 0.8, 1) },
    // a module on the field
    { text: () => (now.mod >= 0 ? MODPLOTS(now.mod) : ['', '']), at: 'lit', cls: 'cyn', alpha: S => prog(S.field_mlit, 0.4, 0.9) * (S.field_module >= 0 ? 1 : 0) },
  ];
  const anchors = {
    centre: [0, 0, 0], field: [0, 0.35, 0], net: [0, 0.42, 0], under: [0, -0.2, 0.45], jars: [BX, 0.12, 0], stack: [0, 0.75, -0.95],
    bni: () => { const [x, , z] = PXZ[SDATA.plot(0, 0, 3)]; return [x, 0.3, z]; }, ctrl: () => { const [x, , z] = PXZ[SDATA.plot(1, 0, 3)]; return [x, 0.3, z]; },
    cloud: [0, 1.3, 0],
    // the middle of the plots a module lights most (for its label)
    lit: () => { if (now.mod < 0) return [0, 0.3, 0.3]; const sc = scores(now.mod); let x = 0, z = 0, w = 0; for (let p = 0; p < 24; p++) { const v = Math.max(0, at(sc[p], now.date)); x += PXZ[p][0] * v; z += PXZ[p][2] * v; w += v; } return w > 0 ? [x / w, 0.36, z / w] : [0, 0.3, 0.3]; },
    pick: () => { const pl = pickPlots(); if (!pl.length) return [0, 0.45, 0]; let x = 0, z = 0; for (const p of pl) { x += PXZ[p][0] / 4; z += PXZ[p][2] / 4; } return [x, 0.45, z]; },
  };
  return Object.assign(set, {
    params: { field_a: 1, field_grow: 1, field_date: 0, field_net: 1, field_chl: 0, field_nh4: 0, field_no3: 0, field_jars: 0,
      field_jday: 0, field_inc: 0, field_cores: 0, field_stack: 0, field_module: -1, field_mlit: 0, field_pick: -1, field_tags: 0,
      field_show: 0, field_life: 0, field_line: -1, field_fert: -1 },
    log: [],
    update,
    anchors,
    labels,
    cam: {
      default: [-24, 30, 4.2, 0, 0.05, 0], low: [-18, 9, 2.6, 0, 0.12, 0.1], plots: [-30, 40, 2.4, 0, 0, 0],
      under: [-20, 4, 3.2, 0, -0.12, 0], jars: [52, 14, 1.75, 1.3, 0.17, 0], stack: [-15, 18, 3.4, 0, 0.45, -0.5],
      cloud: [-20, 12, 4.4, 0, 0.8, 0], stand: [0, 2, 0.6, 0, 0.15, 0.55],
    },
    controls: [
      { key: 'view', label: 'View', options: [['default', 'The field'], ['low', 'Among the wheat'], ['under', 'Under the field'], ['jars', 'The jars'], ['stack', 'The samples']] },
      { key: 'date', label: 'Date', options: [['0', 'Day 1'], ['1', 'Day 15'], ['2', 'Day 24'], ['3', 'Day 53'], ['4', 'Day 70']] },
      { key: 'show', label: 'Show', options: [['chl', 'Chlorophyll'], ['nh4', 'Ammonium'], ['no3', 'Nitrate'], ['n2o', 'N2O'], ['ph', 'pH']] },
      { key: 'line', label: 'Wheat', options: [['both', 'Both'], ['0', 'BNI wheat'], ['1', 'Control wheat']] },
      { key: 'fert', label: 'Regime', options: [['all', 'All'], ['0', 'Not fertilised'], ['1', 'Fertilised'], ['2', 'Fertilised + DCD']] },
    ],
    // the Field pane: the wheat at the date, coloured by its chlorophyll; ammonium or nitrate on the plots; the jars of
    // that date breathing from c.t (N2O); the cores stacking (The samples); a line and a regime picked light their plots
    // (both picked: that group's four plots get tags with the measure shown)
    explore(c) {
      const date = +c.date || 0, show = Math.max(0, ['chl', 'nh4', 'no3', 'n2o', 'ph'].indexOf(c.show)), line = c.line === 'both' || c.line === undefined ? -1 : +c.line;
      const fert = c.fert === 'all' || c.fert === undefined ? -1 : +c.fert, jars = c.view === 'jars' || c.show === 'n2o', stack = c.view === 'stack';
      return { field_grow: 1, field_date: date, field_net: c.view === 'low' || c.view === 'under' ? 0 : 1, field_chl: 1,
        field_no3: c.show === 'no3' || c.view === 'under' ? 1 : 0, field_nh4: c.show === 'nh4' ? 1 : 0,
        field_jars: jars ? 1 : 0, field_jday: date, field_inc: jars ? K.prog(c.t, 0.5, 6) : 0,
        field_cores: stack ? 1 : 0, field_stack: stack ? K.prog(c.t, 0.8, 3.5) : 0, field_tags: line >= 0 && fert >= 0 ? 1 : 0, field_show: show,
        field_line: line, field_fert: fert, field_pick: line >= 0 && fert >= 0 ? line * 3 + fert : -1 };
    },
    api() {
      return { plotXZ, order, pick, plotAt: p => PXZ[p].slice(), plot: p => PXZ[p].slice(), jar: i => { const J = now.jar[i]; return J ? J.top.slice() : null; },
        ppm, chlAt: (p, d) => at(CHL[p], d), value: (key, p, time) => plotVal(key, p, time), mod: m => MODTXT(m) };
    },
  });
};
