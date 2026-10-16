// The stress test (slides 9-10 of the talk): an aisle of supercomputer racks, and the sea of tiny towers they
// compute, each a stack of thin glowing discs (the multiplex in miniature) with a bright core thread (the disease
// module). hpc_remove sweeps a wave across the field: discs vanish, the core thread stays. No data is read here;
// every look is decided in the shaders from three shared uniforms, so no buffer changes after the build.
SETS.hpc = function (K) {
  const { THREE, smooth, clamp, prog, rng, rgb } = K;
  const set = K.newSet('hpc');
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- dimensions (1 unit is about 4 m)
  const FLOOR = -0.3, RH = 0.5, TOP = FLOOR + RH;      // racks are 2 m tall, 60 cm wide, 1.1 m deep
  const RW = 0.12, RD = 0.22, NR = 14, Z0 = -NR * RW / 2;
  const ROWS = [[-0.25, 1], [0.25, -1], [-0.73, -1], [0.73, 1]];   // [x of the row, the side its fronts face]
  const CELL = 0.12, FC = 0.24;                        // floor tiles; the field's grid (two tiles)
  const HALL = 0.96;                                   // no towers inside |x|, |z| < HALL
  const DMIN = 1.0, RFAR = 22, NEAR_R = 8.8;           // field: towers up to about NEAR_R, points to the horizon
  const DISCS = 20, KEEP = 5, TR = 0.05, TH = 0.2;    // a tower: 20 discs, 5 survive, radius, height
  const BF = 0.22, BR = 0.3;                           // widths of the field and removal waves (in wave units)
  // the near tower, and the wave exponent that puts it halfway through the waves at 0.5
  const NX = (Math.floor(1.75 / FC) + 0.5) * FC, NZ = (Math.floor(3.03 / FC) + 0.5) * FC;
  const ND = Math.hypot(NX, NZ), WP = Math.log(0.5) / Math.log((ND - DMIN) / (RFAR - DMIN));
  const wave = d => Math.pow(clamp((d - DMIN) / (RFAR - DMIN), 0, 1), WP);

  const U = { uRacks: { value: 1 }, uField: { value: 0 }, uRemove: { value: 0 } };
  const uni = extra => Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U, extra || {});
  const HASH = 'float h1(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }\n';
  const WAVES = `uniform float uRacks, uField, uRemove;
float fieldAt(float w) { return clamp((uField * ${(1 + BF).toFixed(3)} - w) / ${BF.toFixed(3)}, 0.0, 1.0); }
float removeAt(float w) { return clamp((uRemove * ${(1 + BR).toFixed(3)} - w) / ${BR.toFixed(3)}, 0.0, 1.0); }
`;
  const mat = (o, order) => { const m = new THREE.ShaderMaterial(o); set.mats.push(m); m.userData.order = order; return m; };

  // ---------------------------------------------------------------- the floor: tiles, cold aisle, the field's grid
  {
    const g = new THREE.PlaneGeometry(2 * RFAR, 2 * RFAR); g.rotateX(-Math.PI / 2);
    const m = mat({
      uniforms: uni({ uP: { value: WP } }), transparent: true, depthWrite: false, extensions: { derivatives: true },
      vertexShader: 'varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uA, uTime, uP; varying vec2 vP;
${WAVES}
float grid(vec2 p, float s, float wd) {
  vec2 fw = max(fwidth(p), vec2(1e-5)), g = abs(fract(p / s + 0.5) - 0.5) * s;
  vec2 l = 1.0 - smoothstep(fw * 0.5, fw * (0.5 + wd), g);
  return max(l.x, l.y) * (1.0 - smoothstep(0.06, 0.3, max(fw.x, fw.y) / s));
}
void main() {
  float d = length(vP), w = pow(clamp((d - ${DMIN.toFixed(2)}) / ${(RFAR - DMIN).toFixed(2)}, 0.0, 1.0), uP);
  vec2 ah = abs(vP);
  float hall = 1.0 - smoothstep(0.86, 0.92, max(ah.x, ah.y)), fl = fieldAt(w), rm = removeAt(w);
  float out_ = 1.0 - smoothstep(${(RFAR * 0.5).toFixed(1)}, ${RFAR.toFixed(1)}, d);
  vec3 c = vec3(0.0);
  float gr = grid(vP, ${CELL.toFixed(2)}, 0.8), gf = grid(vP, ${FC.toFixed(2)}, 0.8);
  c += vec3(0.22, 0.5, 0.78) * (gr * 0.16 * hall * uRacks + gf * (0.035 + 0.2 * fl) * (1.0 - hall));
  // the cold aisle: perforated tiles breathing cool air, glowing
  float cold = step(ah.x, 0.135) * step(ah.y, 0.84), aisle = exp(-vP.x * vP.x / 0.004) * (1.0 - smoothstep(0.8, 1.1, ah.y));
  vec2 pf = fract(vP / 0.012) - 0.5; vec2 fw = fwidth(vP / 0.012);
  float dots = smoothstep(0.32, 0.18, length(pf)) * (1.0 - smoothstep(0.25, 0.6, max(fw.x, fw.y)));
  c += uRacks * (vec3(0.1, 0.42, 0.68) * aisle * 0.55 + vec3(0.25, 0.7, 1.0) * dots * cold * 0.12);
  c += uRacks * vec3(0.03, 0.12, 0.22) * exp(-max(max(ah.x, ah.y) - 0.84, 0.0) * 2.2) * 0.5;
  // the field glows faintly under its towers; the two wave fronts run across it as rings
  c += vec3(0.02, 0.06, 0.1) * fl * (1.0 - hall) * (1.0 - 0.4 * rm);
  float wf = uField * ${(1 + BF).toFixed(3)} - 0.5 * ${BF.toFixed(3)};
  c += vec3(0.3, 0.8, 1.0) * exp(-pow((w - wf) / 0.01, 2.0)) * sin(3.14159 * clamp(uField, 0.0, 1.0)) * 0.6 * (1.0 - hall);
  float wr = uRemove * ${(1 + BR).toFixed(3)} - 0.12 * ${BR.toFixed(3)};
  c += vec3(1.0, 0.62, 0.18) * exp(-pow((w - wr) / 0.012, 2.0)) * sin(3.14159 * clamp(uRemove, 0.0, 1.0)) * 0.55 * fl;
  float a = clamp(0.9 * out_ + dot(c, vec3(0.5)), 0.0, 1.0);
  gl_FragColor = vec4(vec3(0.007, 0.014, 0.028) * out_ + c * out_, a * uA);
}`,
    }, -2);
    const mesh = new THREE.Mesh(g, m); mesh.position.y = FLOOR; mesh.renderOrder = -2; mesh.frustumCulled = false;
    set.group.add(mesh);
  }

  // ---------------------------------------------------------------- racks: dark cabinets with lit fronts and backs
  const racks = [];   // { x, z, face, ord }
  for (const [x, face] of ROWS) for (let k = 0; k < NR; k++) {
    const z = Z0 + (k + 0.5) * RW;
    racks.push({ x, z, face, ord: (-Z0 - z) / (-2 * Z0) * 0.8 + Math.abs(x) * 0.25 });
  }
  const bodyMat = K.fade(set, new THREE.MeshStandardMaterial({ color: 0x0b111b, metalness: 0.6, roughness: 0.55 }), 1);
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(RD, RH, RW - 0.003), bodyMat, racks.length);
  body.renderOrder = 0; set.group.add(body);
  // fronts (lights, vents) and backs (cable side, sparse lights) as one instanced plane
  const PW = RW - 0.014, PH = RH - 0.03;
  const pGeo = new THREE.PlaneGeometry(PW, PH);
  const pn = racks.length * 2, aId = new Float32Array(pn), aBack = new Float32Array(pn), aOrd = new Float32Array(pn);
  const pr = rng(901);
  for (let i = 0; i < pn; i++) { aId[i] = Math.floor(pr() * 997); aBack[i] = i % 2; aOrd[i] = racks[i >> 1].ord; }
  pGeo.setAttribute('aId', new THREE.InstancedBufferAttribute(aId, 1));
  pGeo.setAttribute('aBack', new THREE.InstancedBufferAttribute(aBack, 1));
  pGeo.setAttribute('aOrd', new THREE.InstancedBufferAttribute(aOrd, 1));
  const panelMat = mat({
    uniforms: uni(), transparent: true,
    vertexShader: `attribute float aId, aBack, aOrd; varying vec2 vUv; varying float vId, vBack, vPw;
uniform float uRacks;
void main() {
  vUv = uv; vId = aId; vBack = aBack;
  vPw = clamp((uRacks * 1.6 - aOrd * 0.6 - 0.75) / 0.25, 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `uniform float uA, uTime; varying vec2 vUv; varying float vId, vBack, vPw;
${HASH}
vec3 led(vec2 q, vec2 c, float r, vec3 col) { float d = length(q - c); return col * (smoothstep(r, r * 0.4, d) * 1.6 + exp(-d / (r * 1.6)) * 0.35); }
void main() {
  vec2 q = vUv, m = q * vec2(${PW.toFixed(3)}, ${PH.toFixed(3)});   // metres-ish, for round LEDs
  vec3 c = vec3(0.016, 0.022, 0.034);
  float door = step(0.035, q.x) * step(q.x, 0.965) * step(0.015, q.y) * step(q.y, 0.95);
  float rows = 18.0, ry = (q.y - 0.015) / 0.935 * rows, row = floor(ry), fy = fract(ry);
  float face = door * step(0.12, fy) * step(fy, 0.88);
  float kind = h1(vec3(vId, row, 1.0)), rh = ${PH.toFixed(3)} * 0.935 / rows;
  vec2 lq = vec2(m.x, (row + 0.5) * rh + 0.015 * ${PH.toFixed(3)});
  vec3 L = vec3(0.0);
  if (vBack < 0.5) {
    c += vec3(0.022, 0.03, 0.044) * face;
    // vents: fine slots on the right of each unit
    float vent = face * step(0.42, q.x) * step(q.x, 0.93) * step(0.5, fract(fy * 6.0));
    c -= vec3(0.012, 0.015, 0.02) * vent;
    if (kind < 0.55) {
      // a server: power light, health light, two activity lights
      L += led(m, vec2(0.08 * ${PW.toFixed(3)}, lq.y), 0.0017, vec3(0.2, 1.0, 0.45) * 0.7);
      for (int i = 0; i < 3; i++) {
        float fi = float(i), rate = 2.0 + 5.0 * h1(vec3(vId, row, fi + 7.0));
        float on = step(0.45, h1(vec3(vId + fi * 13.0, row, floor(uTime * rate + h1(vec3(row, fi, vId)) * 9.0))));
        vec3 lc = i == 0 ? vec3(0.25, 1.0, 0.5) : vec3(0.3, 0.6, 1.0);
        L += led(m, vec2((0.15 + 0.065 * fi) * ${PW.toFixed(3)}, lq.y), 0.0016, lc * on);
      }
    } else if (kind < 0.85) {
      // a blade chassis: a row of node lights
      for (int i = 0; i < 9; i++) {
        float fi = float(i), rate = 1.5 + 6.0 * h1(vec3(vId, row, fi));
        float on = step(0.35, h1(vec3(vId + fi * 3.0, row + 50.0, floor(uTime * rate + fi * 0.37))));
        vec3 lc = mod(fi, 3.0) < 1.0 ? vec3(0.25, 1.0, 0.55) : vec3(0.28, 0.55, 1.0);
        L += led(m, vec2((0.1 + 0.095 * fi) * ${PW.toFixed(3)}, lq.y), 0.0013, lc * (0.25 + 0.75 * on));
      }
    } else {
      // a switch: dense blinking port lights
      for (int i = 0; i < 12; i++) {
        float fi = float(i), on = step(0.5, h1(vec3(vId + fi, row + 90.0, floor(uTime * 9.0 + fi * 1.7))));
        L += led(m, vec2((0.08 + 0.077 * fi) * ${PW.toFixed(3)}, lq.y + rh * 0.18), 0.0009, vec3(0.3, 0.95, 0.6) * on);
      }
    }
    // the status strip at the top of the door
    float strip = smoothstep(0.958, 0.962, q.y) * (1.0 - smoothstep(0.978, 0.982, q.y)) * step(0.08, q.x) * step(q.x, 0.92);
    L += vec3(0.15, 0.7, 1.0) * strip * (0.85 + 0.15 * sin(uTime * 1.3 + vId));
    // a faint sheen on the glass door
    c += vec3(0.02, 0.035, 0.06) * smoothstep(0.25, 0.0, abs(q.x - q.y * 0.35 - 0.2)) * door;
  } else {
    // the back: cable bundles in shadow, a few link lights
    float cab = step(0.5, fract(q.x * 14.0 + h1(vec3(vId, 2.0, 3.0)))) * door;
    c += vec3(0.012, 0.016, 0.024) * cab;
    for (int i = 0; i < 2; i++) {
      float fi = float(i), on = step(0.6, h1(vec3(vId, row + fi * 40.0, floor(uTime * 3.0 + fi))));
      L += led(m, vec2((0.2 + 0.6 * fi) * ${PW.toFixed(3)}, lq.y), 0.0012, vec3(0.3, 0.9, 0.5) * on * 0.6);
    }
  }
  gl_FragColor = vec4(c + L * vPw, uA);
}`,
  }, 1);
  const panels = new THREE.InstancedMesh(pGeo, panelMat, pn);
  panels.renderOrder = 1; set.group.add(panels);
  // cable trays, cables, drops, door frames: one merged lit mesh
  const hallMats = [];
  {
    const parts = [];
    const box = (w, h, d, x, y, z, c) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); parts.push(K.paint(b, c)); };
    const metal = '#3a4658', dark = '#1a2230';
    const TY = TOP + 0.07, L = -2 * Z0 + 0.08;
    for (const [x] of ROWS) {
      box(0.1, 0.004, L, x, TY, 0, metal);
      box(0.004, 0.022, L, x - 0.05, TY + 0.009, 0, metal); box(0.004, 0.022, L, x + 0.05, TY + 0.009, 0, metal);
      for (let k = 0; k <= NR; k++) box(0.1, 0.005, 0.006, x, TY + 0.002, Z0 + k * RW, metal);
      for (let k = 1; k < NR; k += 4) box(0.004, 0.25, 0.004, x, TY + 0.13, Z0 + k * RW, dark);   // hangers to the ceiling
      // cables in the tray and drops into every other rack
      const cr = rng(Math.round(x * 100) + 50);
      [['#e8c23a', -0.025], ['#2a7fe0', 0.0], ['#20283a', 0.025]].forEach(([col, dx], j) => {
        const pts = [];
        for (let k = 0; k <= 12; k++) pts.push([x + dx + (cr() - 0.5) * 0.012, TY + 0.009 + j * 0.002, Z0 - 0.04 + k * L / 12]);
        parts.push(K.paint(K.tube(pts, 0.006, 40, 5), col));
      });
      for (let k = 0; k < NR; k += 2) {
        const z = Z0 + (k + 0.5) * RW, col = k % 4 ? '#2a7fe0' : '#e8c23a';
        parts.push(K.paint(K.tube([[x + 0.02, TY + 0.01, z], [x + 0.03, TY - 0.03, z + 0.01], [x + 0.035, TOP + 0.002, z + 0.012]], 0.004, 6, 5), col));
      }
    }
    // bridges over the aisles, and the frames of the aisle doors
    for (let k = 1; k < NR; k += 4) { box(0.42, 0.004, 0.08, 0, TY, Z0 + k * RW, metal); box(0.42, 0.004, 0.08, 0.49, TY, Z0 + k * RW, metal); box(0.42, 0.004, 0.08, -0.49, TY, Z0 + k * RW, metal); }
    for (const z of [Z0 - 0.004, -Z0 + 0.004]) {
      box(0.012, RH, 0.012, -0.138, FLOOR + RH / 2, z, metal); box(0.012, RH, 0.012, 0.138, FLOOR + RH / 2, z, metal);
      box(0.288, 0.014, 0.012, 0, TOP - 0.007, z, metal);
    }
    const tm = K.fade(set, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.5 }), 1);
    hallMats.push(tm);
    const trays = new THREE.Mesh(K.merge(parts), tm); trays.renderOrder = 0; set.group.add(trays);
    // light bars over the cold aisle, and the glass door at its far end
    const lp = [];
    for (let k = 0; k < 5; k++) { const b = new THREE.BoxGeometry(0.018, 0.006, 0.26); b.translate(0, TOP + 0.2, Z0 + 0.17 + k * 0.335); lp.push(b); }
    const lm = K.fade(set, new THREE.MeshBasicMaterial({ color: 0xd8ecff }), 0.95);
    hallMats.push(lm);
    const lights = new THREE.Mesh(K.merge(lp), lm); lights.renderOrder = 0; set.group.add(lights);
    const gm = K.fade(set, new THREE.MeshBasicMaterial({ color: 0x3aa6ff, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0.09);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.264, RH - 0.014), gm);
    hallMats.push(gm);
    glass.position.set(0, FLOOR + (RH - 0.014) / 2, Z0 - 0.004); glass.renderOrder = 1; set.group.add(glass);
  }
  let racksDone = -1;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
  function placeRacks(v) {
    racks.forEach((r, i) => {
      const s = Math.max(smooth(clamp(v * 1.6 - r.ord * 0.6, 0, 1)), 1e-4), h = RH * s;
      _m.compose(_p.set(r.x, FLOOR + h / 2, r.z), _q.set(0, 0, 0, 1), _s.set(1, s, 1)); body.setMatrixAt(i, _m);
      for (let b = 0; b < 2; b++) {
        const dir = b ? -r.face : r.face;
        _q.setFromAxisAngle(_y, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        _m.compose(_p.set(r.x + dir * (RD / 2 + 0.0012), FLOOR + h / 2, r.z), _q, _s.set(1, s, 1));
        panels.setMatrixAt(2 * i + b, _m);
      }
    });
    body.instanceMatrix.needsUpdate = true; panels.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the field: towers near, points to the horizon
  const fr = rng(2207), near = [], far = [];
  const G = Math.ceil(RFAR / FC);
  let nearIdx = -1;
  for (let i = -G; i < G; i++) for (let j = -G; j < G; j++) {
    const x = (i + 0.5) * FC, z = (j + 0.5) * FC, d = Math.hypot(x, z), jit = fr();
    if ((Math.abs(x) < HALL && Math.abs(z) < HALL) || d > RFAR) continue;
    if (Math.abs(x - NX) < 1e-6 && Math.abs(z - NZ) < 1e-6) nearIdx = near.length;
    if (d < NEAR_R + (jit - 0.5) * 1.6) near.push([x, z, wave(d), fr()]); else far.push([x, z, wave(d), fr()]);
  }
  // one tower: 20 horizontal quads (a disc each, drawn in the fragment shader), instanced over the near cells
  const NT = near.length;
  const tg = new THREE.InstancedBufferGeometry();
  {
    const P = new Float32Array(DISCS * 12), DI = new Float32Array(DISCS * 4), I = [];
    for (let k = 0; k < DISCS; k++) {
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], c) => { P.set([u, 0, v], (4 * k + c) * 3); DI[4 * k + c] = k; });
      I.push(4 * k, 4 * k + 2, 4 * k + 1, 4 * k, 4 * k + 3, 4 * k + 2);
    }
    tg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    tg.setAttribute('aDisc', new THREE.BufferAttribute(DI, 1));
    tg.setIndex(I);
    // per tower: base position, and (step, offset) of its own removal order (a permutation of the 20 discs), wave, jitter
    const OFF = new Float32Array(NT * 3), SEED = new Float32Array(NT * 4), STEPS = [1, 3, 7, 9, 11, 13, 17, 19];
    near.forEach(([x, z, w, r], n) => {
      OFF.set([x, FLOOR, z], 3 * n);
      SEED.set([STEPS[Math.floor(r * 8)], Math.floor(fr() * DISCS), w, fr()], 4 * n);
    });
    tg.setAttribute('aOff', new THREE.InstancedBufferAttribute(OFF, 3));
    tg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(SEED, 4));
    tg.instanceCount = NT;
  }
  const towerMat = mat({
    uniforms: uni(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aDisc; attribute vec3 aOff; attribute vec4 aSeed;
uniform float uA, uTime; ${WAVES}
varying vec2 vC; varying vec3 vCol; varying float vAl, vFlash;
vec3 discCol(float i) {   // the tower's categories in miniature: proteins at the bottom, co-expression, then the rest
  if (i < 7.5) return vec3(0.27, 0.85, 1.0);
  if (i < 16.5) return vec3(0.24, 0.88, 0.56);
  if (i < 17.5) return vec3(0.69, 0.48, 1.0);
  if (i < 18.5) return vec3(1.0, 0.7, 0.23);
  return vec3(1.0, 0.35, 0.85);
}
void main() {
  float w = aSeed.z, fl = fieldAt(w), rm = removeAt(w);
  float da = clamp((fl * ${DISCS + 5}.0 - aDisc) / 5.0, 0.0, 1.0);
  float rank = mod(aDisc * aSeed.x + aSeed.y, ${DISCS}.0);
  float f = clamp(rm * ${DISCS - KEEP}.0 - rank, 0.0, 1.0);
  float sc = ${TR.toFixed(3)} * (0.55 + 0.45 * da) * (1.0 + 0.9 * f);
  vec3 p = aOff + vec3(position.x * sc, 0.006 + aDisc * ${(TH / (DISCS - 1)).toFixed(5)} * (0.94 + 0.12 * aSeed.w) - 0.03 * f * f - 0.02 * (1.0 - da), position.z * sc);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vAl = da * (1.0 - smoothstep(0.25, 1.0, f)) * uA * mix(0.85, 0.3, smoothstep(0.8, 8.0, -mv.z)) * smoothstep(0.3, 0.55, -mv.z);
  vFlash = smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.06, 0.45, f));
  vCol = discCol(aDisc); vC = position.xz;
  gl_Position = projectionMatrix * mv;
  if (vAl < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `varying vec2 vC; varying vec3 vCol; varying float vAl, vFlash;
void main() {
  float r = length(vC); if (r > 1.0) discard;
  float rim = smoothstep(1.0, 0.84, r) * smoothstep(0.55, 0.9, r), fill = 0.12 * smoothstep(1.0, 0.7, r), core = smoothstep(0.3, 0.0, r);
  vec3 col = vCol * (rim + fill) + vec3(1.0, 0.85, 0.5) * core * 1.3 + vec3(1.0, 0.9, 0.75) * vFlash * (rim + 0.2) * 0.6;
  gl_FragColor = vec4(col, (rim * 0.7 + fill * 0.7 + core * 0.9 + vFlash * 0.6) * vAl);
}`,
  }, 2);
  const towers = new THREE.Mesh(tg, towerMat); towers.frustumCulled = false; towers.renderOrder = 2; set.group.add(towers);
  // core threads: one vertical line per tower, gold-white, growing with the field and staying bright to the end
  {
    const g = new THREE.BufferGeometry(), P = new Float32Array(NT * 6), W2 = new Float32Array(NT * 2), T2 = new Float32Array(NT * 2);
    near.forEach(([x, z, w], n) => { P.set([x, FLOOR + 0.002, z, x, FLOOR + 0.002, z], 6 * n); W2[2 * n] = W2[2 * n + 1] = w; T2[2 * n + 1] = 1; });
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('aW', new THREE.BufferAttribute(W2, 1));
    g.setAttribute('aTop', new THREE.BufferAttribute(T2, 1));
    const m = mat({
      uniforms: uni(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aW, aTop; uniform float uA; ${WAVES}
varying float vAl, vY;
void main() {
  float fl = fieldAt(aW), rm = removeAt(aW), g = clamp(fl * 1.25, 0.0, 1.0);
  vec3 p = position; p.y += aTop * ${(TH + 0.012).toFixed(3)} * g; vY = aTop * g;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vAl = smoothstep(0.0, 0.25, fl) * (0.75 + 0.25 * rm) * uA * mix(1.0, 0.55, smoothstep(2.0, 8.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `uniform float uTime; varying float vAl, vY;
void main() { if (vAl < 0.004) discard; float pulse = 0.8 + 0.2 * sin(vY * 18.0 - uTime * 3.0); gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * pulse, vAl); }`,
    }, 3);
    const th = new THREE.LineSegments(g, m); th.frustumCulled = false; th.renderOrder = 3; set.group.add(th);
  }
  // far towers: one point each, cyan-green while full, shrinking to their gold core as the wave passes
  {
    const n = far.length, g = K.pointsGeo(n), P = g.attributes.position.array, C = g.attributes.aCol.array, S = g.attributes.aSize.array, A = g.attributes.aA.array;
    const W1 = new Float32Array(n);
    far.forEach(([x, z, w, r], k) => {
      P.set([x, FLOOR + 0.07, z], 3 * k); C.set(r < 0.4 ? [0.27, 0.85, 1.0] : [0.3, 0.9, 0.62], 3 * k);
      const d = Math.hypot(x, z); S[k] = 0.07; A[k] = 0.5 * (1 - smooth((d - RFAR * 0.55) / (RFAR * 0.45))) * (0.85 + 0.3 * r); W1[k] = w;
    });
    g.setAttribute('aW', new THREE.BufferAttribute(W1, 1));
    const m = K.points(set, {
      uniforms: U, head: 'attribute float aW;\n' + WAVES,
      vertex: `float fl = fieldAt(aW), rm = removeAt(aW);
  vC = mix(vC, vec3(1.0, 0.8, 0.45), rm * 0.85);
  vA *= smoothstep(0.0, 0.6, fl) * (1.0 - 0.35 * rm);
  vec4 mv2 = modelViewMatrix * vec4(pos + vec3(0.0, -0.05 * (1.0 - fl) - 0.03 * rm, 0.0), 1.0);
  vA *= mix(1.0, 0.3, smoothstep(2.0, 11.0, -mv2.z));
  gl_Position = projectionMatrix * mv2;
  gl_PointSize = pointPx(aSize * (0.5 + 0.5 * fl) * (1.0 - 0.45 * rm), mv2);`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3; set.group.add(pts);
  }
  // the stream: sparks flowing out of the hall to the field's front while it spreads
  {
    const n = 2600, g = K.pointsGeo(n), P = g.attributes.position.array, C = g.attributes.aCol.array, S = g.attributes.aSize.array;
    const PS = new Float32Array(n * 2), sr = rng(77);
    for (let k = 0; k < n; k++) {
      const a = sr() * TAU, sp = 0.15 + sr() * 0.35;
      P.set([Math.sin(a), sr(), Math.cos(a)], 3 * k);   // direction, start height
      C.set(sr() < 0.7 ? [0.5, 0.9, 1.0] : [1.0, 0.85, 0.55], 3 * k); S[k] = 0.012 + sr() * 0.014;
      PS[2 * k] = sp; PS[2 * k + 1] = sr();
    }
    g.setAttribute('aPh', new THREE.BufferAttribute(PS, 2));
    const m = K.points(set, {
      uniforms: Object.assign({ uFront: { value: 1 } }, U), head: 'attribute vec2 aPh; uniform float uFront, uField;',
      vertex: `float u = fract(uTime * aPh.x * 0.35 + aPh.y), r = mix(0.95, max(uFront, 1.0), u);
  vec3 q = vec3(position.x * r, ${FLOOR.toFixed(2)} + 0.015 + (0.04 + 0.3 * position.y) * exp(-(r - 0.95) * 2.0), position.z * r);
  vA *= smoothstep(0.0, 0.08, uField) * (1.0 - smoothstep(0.85, 1.0, uField) * 0.85) * smoothstep(0.0, 0.1, u) * (1.0 - smoothstep(0.75, 1.0, u));
  vec4 mv2 = modelViewMatrix * vec4(q, 1.0);
  gl_Position = projectionMatrix * mv2;
  gl_PointSize = pointPx(aSize, mv2);`,
    });
    set.streamMat = m;
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3; set.group.add(pts);
  }
  // dust in the cold aisle, catching the light
  {
    const n = 420, g = K.pointsGeo(n), P = g.attributes.position.array, C = g.attributes.aCol.array, S = g.attributes.aSize.array, A = g.attributes.aA.array, dr = rng(31);
    for (let k = 0; k < n; k++) {
      P.set([(dr() - 0.5) * 0.26, FLOOR + 0.02 + dr() * (RH + 0.15), Z0 + dr() * (-2 * Z0)], 3 * k);
      C.set([0.6, 0.85, 1.0], 3 * k); S[k] = 0.0025 + dr() * 0.003; A[k] = 0.25 + dr() * 0.35;
    }
    const m = K.points(set, {
      uniforms: U, head: 'uniform float uRacks;',
      vertex: `vec3 q = pos + vec3(sin(uTime * 0.21 + pos.z * 9.0) * 0.012, sin(uTime * 0.13 + pos.x * 31.0) * 0.02, cos(uTime * 0.17 + pos.y * 13.0) * 0.015);
  vec4 mv2 = modelViewMatrix * vec4(q, 1.0);
  vA *= uRacks * (0.6 + 0.4 * sin(uTime * 0.7 + pos.x * 80.0)) * smoothstep(0.15, 0.45, -mv2.z);
  gl_Position = projectionMatrix * mv2;
  gl_PointSize = pointPx(aSize, mv2);`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3; set.group.add(pts);
  }

  // ---------------------------------------------------------------- params, update, exports
  const params = { hpc_a: 1, hpc_racks: 1, hpc_field: 0, hpc_remove: 0 };
  function update(S) {
    const r = clamp(S.hpc_racks, 0, 1), f = clamp(S.hpc_field, 0, 1), m = clamp(S.hpc_remove, 0, 1);
    U.uRacks.value = r; U.uField.value = f; U.uRemove.value = m;
    if (r !== racksDone) { placeRacks(r); racksDone = r; }
    // trays, lights and glass come in once the racks stand (after setAlpha, which set their opacity)
    const hk = prog(r, 0.55, 1);
    for (const m of hallMats) { m.opacity *= hk; m.depthWrite = m.depthWrite && hk > 0.97; m.visible = m.opacity > 0.003; }
    // the stream reaches the field's front (the distance where its wave is halfway)
    const wf = clamp(f * (1 + BF) - 0.5 * BF, 0, 1);
    set.streamMat.uniforms.uFront.value = DMIN + (RFAR - DMIN) * Math.pow(wf, 1 / WP);
  }
  const NEARP = [NX, FLOOR + TH * 0.55, NZ];
  const anchors = { racks: [0, TOP + 0.04, 0], field: [NX * 0.7, FLOOR + 0.3, NZ * 0.7], near: NEARP };
  const labels = [
    { text: ['MareNostrum 5', 'Barcelona Supercomputing Center'], at: 'racks', cls: 'cyn', alpha: S => prog(S.hpc_racks, 0.6, 1) * (1 - prog(S.hpc_field, 0.35, 0.7)) },
    { text: ['680,000 networks', ''], at: 'field', cls: 'amb', alpha: S => prog(S.hpc_field, 0.55, 0.9) },
  ];
  const naz = Math.atan2(NX, NZ) * 180 / Math.PI;
  const cam = {
    default: [38, 24, 3.6, 0, -0.12, 0],
    racks: [4, 3, 1.4, 0, -0.03, -0.62],
    field: [24, 19, 7.5, 0, -0.3, -1.0],
    near: [Math.round(naz + 22), 18, 1.0, NEARP[0], NEARP[1], NEARP[2]],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['racks', 'Racks'], ['field', 'Field']] },
    { key: 'removed', label: 'Removed', options: [['none', 'None'], ['half', 'Half'], ['most', 'Most']] },
  ];
  function explore(c) {
    const rm = { none: 0, half: 0.5, most: 1 }[c.removed] || 0;
    return { hpc_racks: 1, hpc_field: c.view === 'field' || rm > 0 ? 1 : 0, hpc_remove: rm };
  }
  return Object.assign(set, { params, update, anchors, labels, cam, controls, explore,
    towerCount: NT, pointCount: far.length, nearTower: nearIdx });
};
