// A school of fish all around you, in deep blue water. A live simulation, after the flock's (tools/flock/sets/flock.js):
// each fish watches its nearest few neighbours (seven by default, one to twelve: fish_k) whatever the distance, swims
// the way they swim, keeps a little apart and stays with them, and wanders a little of its own accord; nothing else
// holds the school together, so with one neighbour each it falls apart and with seven it holds. A shark (sent by the
// story, now and then in explore mode, or steered from a point, and then kept round the school while you are the
// shark) frightens the fish nearest it, and the warning passes from neighbour to neighbour faster than the shark swims:
// each fish flashes silver as it reaches it.
// Life size: 1 unit is 1 m, the viewer floats at the origin with eyes at 1.6 m (the seabed is far below, the surface far
// above), the sun is up and a little towards -z. Without the water (passthrough AR) nothing opaque is drawn and the
// school swims in your room at a third of life size, shrunk round your eyes.
// The simulation is the one part of a set that is not a pure function of the params and the time: it runs on.
SETS.fish = function (K) {
  const { THREE, clamp, lerp, rng } = K;
  const set = K.newSet('fish');
  const TAU = Math.PI * 2;
  let LANG = 'en';
  const T = (en, de) => (LANG === 'de' ? de : en);

  // ---------------------------------------------------------------- the water, shared by the dome, the seabed and the fish
  const SUN = new THREE.Vector3(0.22, 1, -0.3).normalize();
  const WATER = `
uniform vec3 uSun; uniform float uTimeW;
float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vno(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y); }
// the water in the direction d: dark below, deep blue all round, lighter up towards the surface, where the sky shows
// through a bright window rippled by the waves (Snell's window), and the sun's glow
vec3 waterCol(vec3 d) {
  float y = d.y;
  vec3 c = y < 0.0 ? mix(vec3(0.012, 0.075, 0.15), vec3(0.002, 0.012, 0.035), pow(-y, 0.55))
                   : mix(vec3(0.012, 0.075, 0.15), vec3(0.05, 0.3, 0.42), pow(y, 1.3));
  float win = smoothstep(0.64, 0.74, y);
  if (win > 0.0) {
    vec2 q = d.xz / max(y, 0.2) * 3.0;
    float rip = vno(q * 2.0 + uTimeW * 0.35) * 0.6 + vno(q * 4.3 - uTimeW * 0.5) * 0.4;
    c = mix(c, vec3(0.32, 0.62, 0.7) + 0.18 * rip, win * 0.85);
  }
  c += vec3(0.55, 0.85, 0.8) * (pow(max(dot(d, uSun), 0.0), 60.0) * 0.9 + pow(max(dot(d, uSun), 0.0), 6.0) * 0.12);
  return c;
}
`;
  const U = { uSun: { value: SUN }, uWater: { value: 1 }, uLag: { value: 0 }, uTimeW: K.U.uTime };
  const mat = o => { const m = new THREE.ShaderMaterial(o); set.mats.push(m); return m; };
  const ENV = [];   // the water, the light, the seabed and the drifting specks: hidden in passthrough, where your room takes their place
  const FOG = 0.075;   // (how fast things fade into the blue with distance)
  let SNOWC = null;    // (the drifting specks stay round your head)

  // the water all round: a dome drawn at the far plane
  {
    const m = mat({
      uniforms: Object.assign({ uA: set.uA }, U), side: THREE.BackSide, depthWrite: false, transparent: true,
      vertexShader: `varying vec3 vD; void main() { vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = vec4(p.xy, p.w * 0.99999, p.w); }`,
      fragmentShader: WATER + `uniform float uA, uWater; varying vec3 vD;
void main() { gl_FragColor = vec4(waterCol(normalize(vD)), uA * uWater); }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), m);
    dome.renderOrder = -3; dome.frustumCulled = false; set.group.add(dome); ENV.push(dome);
  }
  // the surface far above, rippling (seen from below it shines; from above, as the camera rises, it is a dark sea)
  {
    const m = mat({
      uniforms: Object.assign({ uA: set.uA }, U), transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: WATER + `uniform float uA, uWater; varying vec3 vW;
void main() {
  vec3 v = vW - cameraPosition; float dist = length(v); vec3 d = v / dist;
  float rip = vno(vW.xz * 0.35 + uTimeW * 0.3) * 0.6 + vno(vW.xz * 0.9 - uTimeW * 0.45) * 0.4;
  vec3 c;
  if (d.y > 0.0) c = mix(vec3(0.3, 0.6, 0.66) + 0.25 * rip, waterCol(d), 1.0 - exp(-dist * 0.02));
  else c = mix(vec3(0.02, 0.09, 0.16) + 0.06 * rip, vec3(0.03, 0.08, 0.14), 1.0 - exp(-dist * 0.004));
  gl_FragColor = vec4(c, uA * uWater * (d.y > 0.0 ? 0.75 : 1.0));
}`,
    });
    const sfc = new THREE.Mesh(new THREE.CircleGeometry(420, 72).rotateX(Math.PI / 2), m);
    sfc.position.y = 15; sfc.renderOrder = -2; sfc.frustumCulled = false; set.group.add(sfc); ENV.push(sfc);
  }
  // the seabed far below: sand with the dancing light of the waves on it, fading into the blue; a few rocks and
  // tufts of seagrass under you (scale, and something below your feet)
  const BED = -6.5;
  {
    const m = mat({
      uniforms: Object.assign({ uA: set.uA }, U), transparent: true, depthWrite: false,
      vertexShader: `varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: WATER + `uniform float uA, uWater; varying vec3 vW;
void main() {
  vec3 v = vW - cameraPosition; float dist = length(v); vec3 d = v / dist;
  float n = vno(vW.xz * 0.15) * 0.5 + vno(vW.xz * 0.6) * 0.3 + vno(vW.xz * 2.7) * 0.2;
  vec2 q = vW.xz * 0.55;
  float ca = pow(abs(sin(q.x + vno(q + uTimeW * 0.25) * 4.0) * sin(q.y + vno(q * 1.3 - uTimeW * 0.2) * 4.0)), 6.0);   // caustics
  vec3 c = mix(vec3(0.16, 0.2, 0.2), vec3(0.3, 0.34, 0.3), n) * 0.55 + vec3(0.35, 0.6, 0.55) * ca * 0.35;
  c = mix(c, waterCol(d), 1.0 - exp(-dist * ${(FOG * 0.85).toFixed(4)}));
  gl_FragColor = vec4(c, uA * uWater);
}`,
    });
    const bed = new THREE.Mesh(new THREE.CircleGeometry(300, 72).rotateX(-Math.PI / 2), m);
    bed.position.y = BED; bed.renderOrder = -1; bed.frustumCulled = false; set.group.add(bed); ENV.push(bed);
  }
  // rocks and seagrass: lit by the water's own light (from above), fading into the blue
  const litMat = (colA, colB, sway) => mat({
    uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, U), transparent: true, side: THREE.DoubleSide,
    vertexShader: `attribute float aH; uniform float uTime; varying vec3 vW, vN; varying float vH;
void main() { vec3 p = position;
  ${sway ? 'float s = aH * aH; p.x += s * 0.18 * sin(uTime * 0.9 + position.x * 0.7 + position.z); p.z += s * 0.12 * sin(uTime * 0.7 + position.z * 0.9);' : ''}
  vW = (modelMatrix * vec4(p, 1.0)).xyz; vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz); vH = aH;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
    fragmentShader: WATER + `uniform float uA, uWater; varying vec3 vW, vN; varying float vH;
void main() { vec3 v = vW - cameraPosition; float dist = length(v);
  vec3 c = mix(vec3(${colA}), vec3(${colB}), vH) * (0.45 + 0.55 * max(dot(normalize(vN), uSun), 0.0));
  c = mix(c, waterCol(v / dist), 1.0 - exp(-dist * ${FOG.toFixed(4)}));
  gl_FragColor = vec4(c, uA * uWater); }`,
  });
  {
    const R = rng(11), geos = [];
    for (let i = 0; i < 26; i++) {
      const r = 2 + Math.pow(R(), 0.6) * 26, a = R() * TAU, s = 0.4 + R() * 1.6;
      const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const f = 0.75 + 0.5 * R(); p.setXYZ(k, p.getX(k) * s * f * 1.3, Math.max(-0.2, p.getY(k)) * s * f * 0.7, p.getZ(k) * s * f); }
      g.translate(Math.cos(a) * r, BED, Math.sin(a) * r);
      geos.push(g);
    }
    const g = K.merge(geos); g.computeVertexNormals();
    g.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(0.3), 1));
    const rocks = new THREE.Mesh(g, litMat('0.12, 0.13, 0.14', '0.2, 0.22, 0.2', false));
    rocks.frustumCulled = false; set.group.add(rocks); ENV.push(rocks);
  }
  {
    const R = rng(5), NB = 1400, P = [], A = [], Nn = [];
    for (let i = 0; i < NB; i++) {
      const r = 1 + Math.pow(R(), 0.8) * 24, a = R() * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = 0.3 + R() * 1.3, w = 0.025 + R() * 0.03, ry = R() * TAU, cx = Math.cos(ry) * w, cz = Math.sin(ry) * w, lean = (R() - 0.5) * 0.4;
      P.push(x - cx, BED, z - cz, x + cx, BED, z + cz, x + lean * h, BED + h, z + lean * h * 0.5);
      A.push(0, 0, 1);
      Nn.push(cz, 0.3, -cx, cz, 0.3, -cx, cz, 0.3, -cx);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(Nn), 3));
    g.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(A), 1));
    const grass = new THREE.Mesh(g, litMat('0.04, 0.12, 0.08', '0.18, 0.42, 0.24', true));
    grass.frustumCulled = false; set.group.add(grass); ENV.push(grass);
  }
  // light from the surface: slanted shafts along the sun's direction, soft at their edges, swaying and flickering
  {
    const R = rng(23), geos = [], rot = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), SUN));
    for (let i = 0; i < 18; i++) {
      const r = 3 + R() * 22, a = R() * TAU, rad = 0.5 + R() * 2.2, len = 34;
      const g = new THREE.CylinderGeometry(rad, rad * 1.35, len, 16, 1, true).translate(0, len / 2 - 14, 0);
      const s = new Float32Array(g.attributes.position.count).fill(R() * 10);
      g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
      g.applyMatrix4(rot).translate(Math.cos(a) * r, 0, Math.sin(a) * r);
      geos.push(g);
    }
    const g = K.merge(geos);
    const m = mat({
      uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, U), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aS; uniform float uTime; varying vec3 vW, vN; varying float vS;
void main() { vec3 p = position; p.x += 0.6 * sin(uTime * 0.21 + aS); p.z += 0.5 * sin(uTime * 0.17 + aS * 1.7);
  vW = (modelMatrix * vec4(p, 1.0)).xyz; vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz); vS = aS;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: `uniform float uA, uWater, uTime; varying vec3 vW, vN; varying float vS;
void main() { vec3 v = normalize(cameraPosition - vW);
  float face = pow(abs(dot(normalize(vN), v)), 2.0);                          // soft at the edges
  float h = smoothstep(-12.0, 14.0, vW.y);                                     // stronger towards the surface
  float fl = 0.65 + 0.35 * sin(uTime * 0.6 + vS * 3.0) * sin(uTime * 0.37 + vS);
  float near = smoothstep(0.6, 3.0, length(cameraPosition - vW));               // none right in your eyes
  gl_FragColor = vec4(vec3(0.45, 0.8, 0.8), uA * uWater * face * h * fl * near * 0.075); }`,
    });
    const shafts = new THREE.Mesh(g, m);
    shafts.renderOrder = 4; shafts.frustumCulled = false; set.group.add(shafts); ENV.push(shafts);
  }
  // drifting specks (marine snow) round where you are: motion and depth even when no fish is near
  {
    const NS = 1800, R = rng(41), g = new THREE.BufferGeometry(), p = new Float32Array(NS * 3), s = new Float32Array(NS);
    for (let i = 0; i < NS; i++) { p.set([R() * 24, R() * 16, R() * 24], 3 * i); s[i] = R(); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    const m = mat({
      uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime, uPx: K.U.uPx, uC: { value: new THREE.Vector3() } }, U), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: K.GLSL + `attribute float aS; uniform vec3 uC; varying float vA;
void main() {
  vec3 q = position + vec3(sin(uTime * 0.13 + aS * 9.0) * 0.4, -uTime * (0.05 + 0.06 * aS), cos(uTime * 0.11 + aS * 7.0) * 0.4);
  q = mod(q - uC + vec3(12.0, 8.0, 12.0), vec3(24.0, 16.0, 24.0)) + uC - vec3(12.0, 8.0, 12.0);   // always round you
  vec4 mv = modelViewMatrix * vec4(q, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(0.02 + 0.03 * aS, mv);
  vA = (1.0 - smoothstep(4.0, 11.0, length(q - uC))) * (0.25 + 0.4 * aS);
}`,
      fragmentShader: `uniform float uA, uWater; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  gl_FragColor = vec4(vec3(0.7, 0.9, 0.88), uA * uWater * vA * (1.0 - d * 2.0)); }`,
    });
    const snow = new THREE.Points(g, m);
    snow.frustumCulled = false; snow.renderOrder = 5; set.group.add(snow); ENV.push(snow);
    SNOWC = m.uniforms.uC.value;
  }

  // ---------------------------------------------------------------- the fish: a live simulation
  const MAXN = 600, KMAX = 12;                     // most fish; most neighbours a fish may watch
  const P = new Float32Array(MAXN * 3), V = new Float32Array(MAXN * 3), ACC = new Float32Array(MAXN * 3);
  const AL = new Float32Array(MAXN), AL2 = new Float32Array(MAXN), FL = new Float32Array(MAXN), BK = new Float32Array(MAXN), PH = new Float32Array(MAXN), GR = new Float32Array(MAXN);
  const NB = new Int32Array(MAXN * KMAX), NBC = new Uint8Array(MAXN);
  const R = rng(2207);
  let N = 300, KN = 7;
  const spawn = (i, c, r0) => {
    const u = K.unit(R), r = (r0 || 2.2) * Math.cbrt(R());
    P[i * 3] = c[0] + u[0] * r; P[i * 3 + 1] = c[1] + u[1] * r * 0.5; P[i * 3 + 2] = c[2] + u[2] * r;
    V[i * 3] = 1.4; V[i * 3 + 1] = 0; V[i * 3 + 2] = 0.2;
    AL[i] = 0; FL[i] = 0; BK[i] = 0; PH[i] = R() * TAU; GR[i] = R();
  };
  for (let i = 0; i < MAXN; i++) spawn(i, [0, 2, -6], 2.6);
  // the viewer (head and hands, in this set's frame; the engine updates them) and the shark (cruise: kept, swimming
  // loops round the school; dash and thru: a pass through it; ph, eff, bank: its swimming, see poseShark)
  const ME = { head: [0, 1.6, 0], hands: [], c: [0, 0] };
  const SH = { on: false, p: [0, 0, 0], v: [0, 0, 0], t: 0, pass: 0, next: 25, aim: null, steer: null, gone: 0,
    cruise: false, dir: 1, ct: 0, gap: 8, dash: false, thru: 0, ph: 0, eff: 0, bank: 0, hd: [0, 1] };
  let tOff = 0, FOL = null, HUSH = false;   // shared rooms: another device's school to follow (see follow), and no sharks of our own for now
  let HOLD = false;                         // explore's "be the shark" is on: a shark let go stays (cruises) until it is off
  const CEN = [0, 2, -6];                   // the middle of the school's main body (centre())

  // a grid of cells round the viewer for the neighbour search: the fish sorted by cell, then shells of cells searched
  // outwards from each fish until its nearest few are certain, however far (fish beyond the grid share its edge cells)
  const CS = 0.8, GX = 48, GY = 26, GZ = 48, Y0 = -9, NC = GX * GY * GZ;
  const cnt = new Int32Array(NC), start = new Int32Array(NC), mark = new Int32Array(NC), ids = new Int32Array(MAXN), key = new Float64Array(MAXN);
  let stamp = 0;
  const gx = x => clamp(Math.floor((x - ME.c[0]) / CS) + GX / 2, 0, GX - 1), gy = y => clamp(Math.floor((y - Y0) / CS), 0, GY - 1), gz = z => clamp(Math.floor((z - ME.c[1]) / CS) + GZ / 2, 0, GZ - 1);
  const bd = new Float32Array(KMAX), bj = new Int32Array(KMAX);
  function neighbours() {
    stamp++;
    for (let i = 0; i < N; i++) key[i] = ((gx(P[i * 3]) * GY + gy(P[i * 3 + 1])) * GZ + gz(P[i * 3 + 2])) * 4096 + i;
    const ks = key.subarray(0, N); ks.sort();
    for (let q = 0; q < N; q++) { const h = Math.floor(ks[q] / 4096); ids[q] = ks[q] - h * 4096; if (mark[h] !== stamp) { mark[h] = stamp; start[h] = q; cnt[h] = 0; } cnt[h]++; }
    const KK = Math.min(KN, N - 1);
    for (let i = 0; i < N; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], cx = gx(x), cy = gy(y), cz = gz(z);
      let nb = 0;
      for (let r = 0; r < 24; r++) {
        if (nb === KK && r > 1 && ((r - 1) * CS) ** 2 >= bd[KK - 1]) break;   // nothing in this shell can be nearer
        for (let dx = -r; dx <= r; dx++) {
          const ix = cx + dx; if (ix < 0 || ix >= GX) continue;
          for (let dy = -r; dy <= r; dy++) {
            const iy = cy + dy; if (iy < 0 || iy >= GY) continue;
            const edge = Math.abs(dx) === r || Math.abs(dy) === r;
            for (let dz = -r; dz <= r; dz += edge ? 1 : 2 * r || 1) {
              const iz = cz + dz; if (iz < 0 || iz >= GZ) continue;
              const h = (ix * GY + iy) * GZ + iz;
              if (mark[h] !== stamp) continue;
              for (let q = start[h], e = start[h] + cnt[h]; q < e; q++) {
                const j = ids[q]; if (j === i) continue;
                const ex = P[j * 3] - x, ey = P[j * 3 + 1] - y, ez = P[j * 3 + 2] - z, d2 = ex * ex + ey * ey + ez * ez;
                if (nb === KK && d2 >= bd[KK - 1]) continue;
                let k = nb < KK ? nb++ : KK - 1;
                while (k > 0 && bd[k - 1] > d2) { bd[k] = bd[k - 1]; bj[k] = bj[k - 1]; k--; }
                bd[k] = d2; bj[k] = j;
              }
            }
          }
        }
      }
      NBC[i] = nb; for (let k = 0; k < nb; k++) NB[i * KMAX + k] = bj[k];
    }
  }
  // one step of the school
  // cruising speed (m/s); how strongly a fish swims its neighbours' way, stays with them, wanders of its own accord;
  // where the school starts to turn back towards you, and how hard (m); and how hard a fish further than RG from the
  // middle of all is pulled back (so groups that parted find each other again once they watch enough neighbours);
  // and how strongly every fish leans towards a home in front of you that wanders slowly (the school's whereabouts)
  const V0 = 1.0, KA = 1.8, KC = 0.9, KW = 0.8, R0 = 7, KB = 1.5, KG = 0.05, RG = 4, KH = 0.03;
  const wander = (i, t, c) => Math.sin(t * (0.5 + 0.4 * GR[i]) + PH[i] * (c + 1) + c * 2.1) + 0.6 * Math.sin(t * (1.3 + 0.7 * GR[i]) + PH[i] * 3.7 + c);
  const HM = [0, 1.8, -4];
  function step(dt, t) {
    neighbours();
    // home: 3-6 m in front of you, wandering slowly from side to side, in and out, up and down
    { const a = -Math.PI / 2 + 0.9 * Math.sin(t * 0.043) + 0.5 * Math.sin(t * 0.071 + 1), r = 4.5 + 1.5 * Math.sin(t * 0.057 + 2);
      HM[0] = ME.c[0] + Math.cos(a) * r; HM[1] = 1.8 + 0.7 * Math.sin(t * 0.063); HM[2] = ME.c[1] + Math.sin(a) * r; }
    const hx = ME.head[0], hy = ME.head[1], hz = ME.head[2];
    let gcx = 0, gcy = 0, gcz = 0, gvx = 0, gvy = 0, gvz = 0;
    for (let i = 0; i < N; i++) { gcx += P[i * 3]; gcy += P[i * 3 + 1]; gcz += P[i * 3 + 2]; gvx += V[i * 3]; gvy += V[i * 3 + 1]; gvz += V[i * 3 + 2]; }
    gcx /= N; gcy /= N; gcz /= N; gvx /= N; gvy /= N; gvz /= N;
    // following another device's school (shared rooms): far off it moves there at once, else every fish gets the same
    // gentle pull towards where that school is
    let lx = 0, ly = 0, lz = 0;
    if (FOL) {
      const e = tSim - FOL.t0, ex = FOL.m[0] + FOL.v[0] * e - gcx, ey = FOL.m[1] + FOL.v[1] * e - gcy, ez = FOL.m[2] + FOL.v[2] * e - gcz;
      if (Math.hypot(ex, ey, ez) > 6) {
        for (let i = 0; i < MAXN; i++) { P[i * 3] += ex; P[i * 3 + 1] += ey; P[i * 3 + 2] += ez; }
        CEN[0] += ex; CEN[1] += ey; CEN[2] += ez;
      } else {
        lx = ex * 0.4 + (FOL.v[0] - gvx) * 0.6; ly = ey * 0.4 + (FOL.v[1] - gvy) * 0.6; lz = ez * 0.4 + (FOL.v[2] - gvz) * 0.6;
        const ll = Math.hypot(lx, ly, lz); if (ll > 3) { lx *= 3 / ll; ly *= 3 / ll; lz *= 3 / ll; }
      }
    }
    for (let i = 0; i < N; i++) {
      const i3 = i * 3, x = P[i3], y = P[i3 + 1], z = P[i3 + 2], vx = V[i3], vy = V[i3 + 1], vz = V[i3 + 2];
      let ax = 0, ay = 0, az = 0;
      // the few it watches: swim their way, keep a little apart, stay with them
      const nb = NBC[i];
      if (nb) {
        let mvx = 0, mvy = 0, mvz = 0, mx = 0, my = 0, mz = 0, amax = 0;
        for (let k = 0; k < nb; k++) {
          const j = NB[i * KMAX + k], j3 = j * 3, ex = x - P[j3], ey = y - P[j3 + 1], ez = z - P[j3 + 2], d2 = ex * ex + ey * ey + ez * ez + 1e-4;
          mvx += V[j3]; mvy += V[j3 + 1]; mvz += V[j3 + 2]; mx += P[j3]; my += P[j3 + 1]; mz += P[j3 + 2];
          if (d2 < 0.2) { const f = 1.6 * (0.2 - d2) / d2; ax += ex * f; ay += ey * f; az += ez * f; }
          if (AL[j] > amax) amax = AL[j];
        }
        const ia = 1 / nb, al = 1 + 2.5 * AL[i];
        ax += (mvx * ia - vx) * KA * al; ay += (mvy * ia - vy) * KA * al; az += (mvz * ia - vz) * KA * al;
        const cx = mx * ia - x, cy = my * ia - y, cz = mz * ia - z, cl = Math.hypot(cx, cy, cz), cf = KC * Math.min(cl, 3) / (cl + 1e-4);
        ax += cx * cf; ay += cy * cf; az += cz * cf;
        // the warning passes from neighbour to neighbour, a little weaker each time, quickly (faster than any shark)
        const tgt = Math.max(AL[i] * Math.exp(-dt * 0.55), amax * 0.94);
        AL2[i] = AL[i] + (tgt - AL[i]) * Math.min(1, dt * 22);
      } else AL2[i] = AL[i] * Math.exp(-dt * 0.55);
      // a little wandering of its own (what the others' example has to overcome)
      { const ex = gcx - x, ey = gcy - y, ez = gcz - z, el = Math.hypot(ex, ey, ez) + 1e-3; if (el > RG) { const f = KG * (el - RG) / el; ax += ex * f; ay += ey * f; az += ez * f; } }
      { const ex = HM[0] - x, ey = HM[1] - y, ez = HM[2] - z, el = Math.hypot(ex, ey, ez) + 1e-3, f = KH * Math.min(el, 6) / el; ax += ex * f; ay += ey * f; az += ez * f; }
      ax += wander(i, t, 0) * KW; ay += wander(i, t, 1) * KW * 0.3; az += wander(i, t, 2) * KW;
      // and following another device's school
      ax += lx; ay += ly; az += lz;
      // keep round the viewer: not too far, not too deep or high, never into your head or hands
      const ox = x - ME.c[0], oz = z - ME.c[1], od = Math.hypot(ox, oz) + 1e-3;
      if (od > R0) { const f = KB * Math.min(1, (od - R0) / 2.5); ax += (-ox / od * V0 - vx) * f; az += (-oz / od * V0 - vz) * f; }   // (turned back towards you, gently)
      if (y < BED + 2) ay += (BED + 2 - y) * 2.5; if (y > 6) ay -= (y - 6) * 1.5;
      ay += (1.8 - y) * 0.08;
      const qx = x - hx, qy = y - hy, qz = z - hz, qd = Math.hypot(qx, qy, qz) + 1e-3;
      if (qd < 1.3) { const f = 14 * (1.3 - qd) / (1.3 * qd); ax += qx * f; ay += qy * f; az += qz * f; }
      for (const hd of ME.hands) { const ux = x - hd[0], uy = y - hd[1], uz = z - hd[2], ud = Math.hypot(ux, uy, uz) + 1e-3; if (ud < 0.9) { const f = 12 * (0.9 - ud) / (0.9 * ud); ax += ux * f; ay += uy * f; az += uz * f; AL2[i] = Math.max(AL2[i], 0.5 * (1 - ud / 0.9)); } }
      // the shark: those it nears flee, and raise the warning
      if (SH.on) {
        const fx = x - SH.p[0], fy = y - SH.p[1], fz = z - SH.p[2], fd = Math.hypot(fx, fy, fz) + 1e-3;
        if (fd < 4.5) { const f = 16 * (4.5 - fd) / (4.5 * fd); ax += fx * f; ay += fy * f * 0.5; az += fz * f; AL2[i] = Math.max(AL2[i], 1 - fd / 4.5 * 0.4); }
      }
      // speed: back towards cruising, faster when warned
      const sp = Math.hypot(vx, vy, vz) + 1e-3, want = V0 * (1 + 1.4 * AL[i]);
      ax += vx / sp * (want - sp) * 1.4; ay += vy / sp * (want - sp) * 1.4 - vy * 0.5; az += vz / sp * (want - sp) * 1.4;
      ACC[i3] = ax; ACC[i3 + 1] = ay; ACC[i3 + 2] = az;
    }
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      let ax = ACC[i3], ay = ACC[i3 + 1], az = ACC[i3 + 2];
      const al = Math.hypot(ax, ay, az), lim = 9 + 30 * AL2[i];
      if (al > lim) { ax *= lim / al; ay *= lim / al; az *= lim / al; }
      const vx = V[i3] + ax * dt, vy = V[i3 + 1] + ay * dt, vz = V[i3 + 2] + az * dt, sp = Math.hypot(vx, vy, vz), s = sp > 4.5 ? 4.5 / sp : sp < 0.6 ? 0.6 / sp : 1;
      // roll a little into turns, and hard (showing the silver flank) when warned
      const fx = vx / sp, fz = vz / sp, side = (ax * -fz + az * fx) / 9.8;
      const roll = clamp(-side * 0.8, -0.6, 0.6) + AL2[i] * 0.7 * (GR[i] < 0.5 ? 1 : -1);
      BK[i] += (roll - BK[i]) * Math.min(1, dt * 5);
      V[i3] = vx * s; V[i3 + 1] = vy * s; V[i3 + 2] = vz * s;
      P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
      // a flash as the warning reaches a fish (rising through 0.3), then gone in half a second
      FL[i] = AL[i] < 0.3 && AL2[i] >= 0.3 ? 1 : FL[i] * Math.exp(-dt * 4);
      if (AL2[i] >= 0.3 && AL[i] < 0.3 && WATCH) WATCH(i, tSim);
      AL[i] = AL2[i];
    }
    centre();
    sharkStep(dt);
  }
  let WATCH = null;   // (tests: hear when the warning reaches each fish)
  // the shark: in from afar, straight through the thick of the school, then away (about 16 s); or after a point it is
  // steered to (explore mode: you are the shark), and let go while you still are, it stays: it cruises in wide loops
  // round the school and every so often bursts straight through it, so the fish keep fleeing, until you steer it again
  // or stop being the shark (then it swims off)
  const SV = 3.2;   // its cruising speed in (m/s); it bursts to 5 through the school, still slower than the warning
  const LOOP = 5, CRUISE = 2.4, DASH = 4.6, HEAD = 3;   // a kept shark's loops (m) and speeds (m/s), and how far it keeps from your head
  function sharkStep(dt) {
    if (!SH.on) return;
    SH.t += dt;
    const v0 = SH.v.slice();
    let tx, ty, tz, sp, turn = 1.4;
    if (SH.steer) {
      tx = SH.steer[0]; ty = SH.steer[1]; tz = SH.steer[2];
      sp = clamp(Math.hypot(tx - SH.p[0], ty - SH.p[1], tz - SH.p[2]) * 1.6, 0.8, 5.5);   // (never quite still: a shark swims to breathe)
    } else if (SH.cruise) {
      SH.ct += dt;
      const ex = SH.p[0] - CEN[0], ez = SH.p[2] - CEN[2];
      if (SH.dash) {
        // through the school: at its middle, then on past it for a moment, then back to the loops
        if (!SH.thru && Math.hypot(ex, SH.p[1] - CEN[1], ez) < 1.4) SH.thru = SH.ct;
        if (SH.thru) { tx = SH.p[0] + SH.v[0]; ty = SH.p[1]; tz = SH.p[2] + SH.v[2]; } else { tx = CEN[0]; ty = CEN[1]; tz = CEN[2]; }
        sp = DASH;
        if ((SH.thru && SH.ct > SH.thru + 1.1) || SH.ct > 9) { SH.dash = false; SH.thru = 0; SH.ct = 0; SH.gap = 9 + R() * 8; SH.dir = loopDir(); }
      } else {
        // a wide loop round the school's middle, the way it was going, rising and sinking a little; a burst through the
        // school once it is due and the shark is off to the school's side as you see it (so it crosses your view, never
        // comes at you)
        const a = Math.atan2(ez, ex) + SH.dir * 0.75;
        tx = CEN[0] + Math.cos(a) * LOOP; ty = CEN[1] + 0.5 * Math.sin(SH.t * 0.21); tz = CEN[2] + Math.sin(a) * LOOP;
        sp = CRUISE;
        const yx = ME.head[0] - CEN[0], yz = ME.head[2] - CEN[2], side = (ex * yx + ez * yz) / ((Math.hypot(ex, ez) * Math.hypot(yx, yz)) + 1e-3);
        if (SH.ct > SH.gap && Math.abs(side) < 0.5) { SH.dash = true; SH.ct = 0; SH.thru = 0; }
      }
      // never through your head: its way goes round you a few metres off, and where it would soon come nearer (where it
      // is in 0.8 s) it gives up a burst and turns away hard
      const hx = tx - ME.head[0], hz = tz - ME.head[2], hl = Math.hypot(hx, hz) + 1e-3;
      if (hl < HEAD + 1) { tx = ME.head[0] + hx / hl * (HEAD + 1); tz = ME.head[2] + hz / hl * (HEAD + 1); }
      const qx = SH.p[0] + SH.v[0] * 0.8 - ME.head[0], qz = SH.p[2] + SH.v[2] * 0.8 - ME.head[2], ql = Math.hypot(qx, qz) + 1e-3;
      if (ql < HEAD + 0.5) {
        if (SH.dash) { SH.dash = false; SH.thru = 0; SH.ct = 0; SH.gap = 4 + R() * 4; }
        tx = SH.p[0] + qx / ql * 4; ty = SH.p[1]; tz = SH.p[2] + qz / ql * 4; sp = CRUISE; turn = 3.5;
      }
    } else {
      const hunting = !SH.pass && SH.t < 9, through = SH.pass && SH.t < SH.pass + 1.6;
      if (hunting) {
        tx = CEN[0]; ty = CEN[1]; tz = CEN[2];
        if (SH.aim && SH.t < 2.5) { tx = SH.aim[0]; ty = SH.aim[1]; tz = SH.aim[2]; }
        if (Math.hypot(CEN[0] - SH.p[0], CEN[1] - SH.p[1], CEN[2] - SH.p[2]) < 1.5) SH.pass = SH.t;
      } else if (through) { tx = SH.p[0] + SH.v[0]; ty = SH.p[1]; tz = SH.p[2] + SH.v[2]; }
      else {
        // away: on its way and away from you, slowly sinking
        const ox = SH.p[0] - ME.c[0], oz = SH.p[2] - ME.c[1], ol = Math.hypot(ox, oz) + 1e-3, vl = Math.hypot(SH.v[0], SH.v[2]) + 1e-3;
        tx = SH.p[0] + (SH.v[0] / vl + ox / ol) * 3; ty = SH.p[1] - 0.5; tz = SH.p[2] + (SH.v[2] / vl + oz / ol) * 3;
      }
      sp = hunting && Math.hypot(CEN[0] - SH.p[0], CEN[2] - SH.p[2]) < 7 ? 5 : through ? 5 : hunting ? SV : 2.8;   // (it goes a little slower than it came: longer in view)
    }
    const dx = tx - SH.p[0], dy = ty - SH.p[1], dz = tz - SH.p[2], dl = Math.hypot(dx, dy, dz) + 1e-3, k = Math.min(1, dt * turn);
    for (let c = 0; c < 3; c++) { SH.v[c] += ([dx, dy, dz][c] / dl * sp - SH.v[c]) * k; SH.p[c] += SH.v[c] * dt; }
    SH.p[1] = clamp(SH.p[1], BED + 1, 8);
    // how hard it works (speeding up, turning: its tail beats faster and wider) and how it banks into a turn
    const vl = Math.hypot(SH.v[0], SH.v[1], SH.v[2]) + 1e-3, fx = SH.v[0] / vl, fz = SH.v[2] / vl;
    const ax = (SH.v[0] - v0[0]) / dt, ay = (SH.v[1] - v0[1]) / dt, az = (SH.v[2] - v0[2]) / dt;
    const fwd = ax * fx + ay * SH.v[1] / vl + az * fz, lat = -ax * fz + az * fx;   // (along its way; to its right, as cross(forward, up))
    SH.eff += (clamp(Math.max(0, fwd) / 3 + Math.abs(lat) / 7, 0, 1) - SH.eff) * Math.min(1, dt * 2.5);
    SH.bank += (clamp(lat * 0.07, -0.5, 0.5) - SH.bank) * Math.min(1, dt * 3);
    const far = Math.hypot(SH.p[0] - ME.c[0], SH.p[2] - ME.c[1]), mine = SH.steer || SH.cruise;
    if (!mine && SH.t > 8 && far > 24) { SH.on = false; SH.aim = null; }
    if (!mine && SH.t > 30) { SH.on = false; SH.aim = null; }
  }
  // which way round the school a shark is swimming (1: the way the angle grows)
  const loopDir = () => ((SH.p[0] - CEN[0]) * SH.v[2] - (SH.p[2] - CEN[2]) * SH.v[0] >= 0 ? 1 : -1);
  // a shark let go while you are the shark: it cruises (its first burst through the school comes soon)
  function cruise() { SH.cruise = true; SH.dash = false; SH.thru = 0; SH.ct = 0; SH.gap = 5 + R() * 5; SH.dir = loopDir(); }
  // off it goes, as a passing shark does after its pass; leave: yours, once you stop being the shark
  function away() { SH.steer = null; SH.cruise = false; SH.dash = false; SH.t = 8; SH.pass = 6; SH.aim = null; }
  function leave() { if (SH.on && (SH.cruise || SH.steer)) away(); }
  function launch(aim) {
    const from = aim ? Math.atan2(aim[2] - ME.c[1], aim[0] - ME.c[0]) + Math.PI * (0.7 + R() * 0.6) : R() * TAU;
    startShark({ p: [ME.c[0] + Math.cos(from) * 22, CEN[1] + (R() - 0.5) * 2, ME.c[1] + Math.sin(from) * 22], v: [-Math.cos(from) * SV, 0, -Math.sin(from) * SV], aim: aim || null });
    if (set.onLaunch) set.onLaunch({ p: SH.p.slice(), v: SH.v.slice(), aim: SH.aim });   // in a shared room: the others' shark too
  }
  function startShark(f) {
    SH.p = f.p.slice(); SH.v = f.v.slice(); SH.on = true; SH.t = 0; SH.pass = 0; SH.aim = f.aim ? f.aim.slice() : null;
    SH.cruise = false; SH.dash = false; SH.thru = 0; SH.eff = 0.5; SH.bank = 0;
  }

  // drawing: one instanced batch of fish, lit by the water's light from above: a dark back, silver flanks that glint
  // when they turn towards the surface, a pale belly; they swim with a wave down the body, faster when warned, and
  // flash as the warning reaches them
  function fishGeo(L) {
    // x right, y up, z forward (nose at +z); aS 0 at the nose, 1 at the tail's tip; aF 1 on fins
    const rings = [[0.5, 0, 0], [0.43, 0.05, 0.03], [0.3, 0.09, 0.047], [0.14, 0.105, 0.053], [-0.02, 0.098, 0.048], [-0.17, 0.07, 0.034], [-0.28, 0.038, 0.019], [-0.33, 0.02, 0.011]];
    const M = 10, pos = [], nrm = [], aS = [], aF = [], idx = [];
    const vtx = (x, y, z, nx, ny, nz, f) => { pos.push(x * L, y * L, z * L); nrm.push(nx, ny, nz); aS.push(clamp((0.5 - z) / 1.0, 0, 1)); aF.push(f); return pos.length / 3 - 1; };
    const ringIdx = rings.map(([z, h, w], r) => {
      if (!h) return [vtx(0, 0, z, 0, 0, 1, 0)];
      const out = [];
      for (let k = 0; k < M; k++) {
        const a = k / M * TAU, cx = Math.cos(a), cy = Math.sin(a);
        out.push(vtx(cx * w, cy * h, z, cx / w, cy / h, 0.15, 0));
      }
      return out;
    });
    for (let r = 1; r < rings.length; r++) {
      const A = ringIdx[r - 1], B = ringIdx[r];
      for (let k = 0; k < M; k++) {
        const k1 = (k + 1) % M;
        if (A.length === 1) idx.push(A[0], B[k1], B[k]);
        else idx.push(A[k], A[k1], B[k1], A[k], B[k1], B[k]);
      }
    }
    // close the body at the tail's root
    const last = ringIdx[ringIdx.length - 1], zc = rings[rings.length - 1][0], tc = vtx(0, 0, zc - 0.01, 0, 0, -1, 0);
    for (let k = 0; k < M; k++) idx.push(last[k], tc, last[(k + 1) % M]);
    // fins: flat, seen from both sides
    const fin = pts => { const b = pos.length / 3; for (const p of pts) vtx(p[0], p[1], p[2], 1, 0, 0, 1); for (let k = 1; k < pts.length - 1; k++) idx.push(b, b + k, b + k + 1); };
    fin([[0, 0.018, -0.32], [0, 0.15, -0.5], [0, 0, -0.41]]);         // a forked tail
    fin([[0, -0.018, -0.32], [0, 0, -0.41], [0, -0.15, -0.5]]);
    fin([[0, 0.018, -0.32], [0, 0, -0.41], [0, -0.018, -0.32]]);
    fin([[0, 0.1, 0.1], [0, 0.17, -0.0], [0, 0.092, -0.06]]);         // the dorsal fin
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
    g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(aS), 1));
    g.setAttribute('aF', new THREE.BufferAttribute(new Float32Array(aF), 1));
    g.setIndex(idx);
    return g;
  }
  const fishMat = (o) => mat({
    uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, U), transparent: true, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 iP, iV, iB; attribute float aS, aF;
uniform float uTime, uLag; varying vec3 vW, vN; varying float vF, vFl, vS, vBelly;
void main() {
  vec3 f = normalize(iV + vec3(0.0, 1e-4, 0.0));
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)) + vec3(1e-5, 0.0, 0.0)), u = cross(r, f);
  float b = iB.x; vec3 r2 = r * cos(b) + u * sin(b), u2 = cross(r2, f);
  // swimming: a wave runs down the body to the tail (each fish at its own pace), wider when warned
  float ph = uTime * ${o.hz.toFixed(2)} * (0.85 + 0.05 * iB.z) + iB.z;
  vec3 p = position;
  float amp = ${o.amp.toFixed(3)} * (0.25 + aS * aS * 1.6) * (1.0 + 1.5 * iB.y);
  float sw = sin(ph - aS * 5.5);
  p.x += amp * sw;
  vec3 n = normal; n.x -= amp * cos(ph - aS * 5.5) * 5.5 * n.z;
  vec3 w = iP + iV * uLag + r2 * p.x + u2 * p.y + f * p.z;
  vW = (modelMatrix * vec4(w, 1.0)).xyz;
  vN = normalize((modelMatrix * vec4(r2 * n.x + u2 * n.y + f * n.z, 0.0)).xyz);
  vBelly = normalize(normal).y; vF = aF; vS = aS; vFl = iB.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`,
    fragmentShader: WATER + `uniform float uA, uWater; varying vec3 vW, vN; varying float vF, vFl, vS, vBelly;
void main() {
  vec3 v = vW - cameraPosition; float dist = length(v); vec3 d = v / dist;
  vec3 n = normalize(vN); if (dot(n, d) > 0.0) n = -n;
  // counter-shading: a dark back, silver flanks, a pale belly
  vec3 c = mix(vec3(${o.back}), vec3(${o.flank}), smoothstep(0.55, -0.2, vBelly));
  c = mix(c, vec3(${o.belly}), smoothstep(-0.35, -0.8, vBelly));
  float lit = 0.35 + 0.65 * max(dot(n, uSun), 0.0);
  c *= lit;
  // silver: a flank turned towards the bright surface glints
  vec3 rf = reflect(d, n);
  c += vec3(0.6, 0.85, 0.9) * pow(max(rf.y, 0.0), 5.0) * ${o.glint.toFixed(2)} * (1.0 - vF * 0.6);
  // the warning: a bright flash as it arrives
  c += vec3(0.85, 1.0, 1.0) * vFl * ${o.flash.toFixed(2)};
  c *= mix(1.0, 0.75, vF);
  c = mix(c, waterCol(d), (1.0 - exp(-dist * ${FOG.toFixed(4)})) * uWater);   // further fish fade into the blue
  gl_FragColor = vec4(c, uA);
}`,
  });
  const FL_I = new Float32Array(MAXN * 3), aP = new THREE.InstancedBufferAttribute(P, 3), aV = new THREE.InstancedBufferAttribute(V, 3), aB = new THREE.InstancedBufferAttribute(FL_I, 3);
  for (const a of [aP, aV, aB]) a.setUsage(THREE.DynamicDrawUsage);
  const fg = fishGeo(0.27);
  fg.setAttribute('iP', aP); fg.setAttribute('iV', aV); fg.setAttribute('iB', aB);
  const fishM = fishMat({ hz: 11, amp: 0.022, back: '0.1, 0.2, 0.28', flank: '0.55, 0.64, 0.7', belly: '0.82, 0.86, 0.88', glint: 1.1, flash: 1.0 });
  // (iB here: bank, flash, phase; the flash is what the shader brightens by)
  const fishes = new THREE.Mesh(fg, fishM);
  fishes.frustumCulled = false; fishes.renderOrder = 2; set.group.add(fishes);
  // the shark: a body of its own, 2.3 m from the snout to the tip of the tail. A torpedo lofted from a profile (a
  // conical snout, widest a third of the way back, a slim tail stalk), a tall first dorsal fin and a small second one,
  // long pectoral fins swept back and down, small pelvic and anal fins, and a crescent tail whose upper lobe is the
  // longer; drawn in one batch. x to its left (the frame poseShark builds), y up, z forward (the snout at +z), metres;
  // aS 0 at the snout, 1 at the tail's root (more on the tail fin), for the swimming wave; aK 1 on fins
  const SNOUT = 1.0, BODY = 1.85, sOf = z => (SNOUT - z) / BODY;
  // the body's profile: s, half height, half width, the middle's height (a smooth curve through these)
  const PROF = [[0, 0, 0, -0.005], [0.02, 0.04, 0.05, -0.005], [0.06, 0.085, 0.1, -0.004], [0.12, 0.13, 0.143, 0], [0.2, 0.167, 0.172, 0.005],
    [0.3, 0.194, 0.186, 0.01], [0.4, 0.203, 0.184, 0.012], [0.5, 0.192, 0.17, 0.01], [0.6, 0.167, 0.145, 0.008], [0.7, 0.128, 0.106, 0.006],
    [0.8, 0.085, 0.068, 0.005], [0.9, 0.052, 0.04, 0.008], [1, 0.04, 0.03, 0.012]];
  function prof(s) {
    let i = 0; while (i < PROF.length - 2 && s > PROF[i + 1][0]) i++;
    const a = PROF[i], b = PROF[i + 1], p = PROF[Math.max(0, i - 1)], q = PROF[Math.min(PROF.length - 1, i + 2)], d = b[0] - a[0], t = clamp((s - a[0]) / d, 0, 1);
    const t2 = t * t, t3 = t2 * t;
    return [1, 2, 3].map(k => (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * (b[k] - p[k]) / (b[0] - p[0]) * d + (3 * t2 - 2 * t3) * b[k] + (t3 - t2) * (q[k] - a[k]) / (q[0] - a[0]) * d);
  }
  function sharkGeo() {
    const pos = [], aS = [], aK = [], idx = [], NR = 30, M = 18;
    const vtx = (x, y, z, k) => { pos.push(x, y, z); aS.push(sOf(z)); aK.push(k); return pos.length / 3 - 1; };
    // the body: rings from the snout back, closer together at the snout, a little flatter underneath
    const rings = [];
    for (let r = 0; r < NR; r++) {
      const s = Math.pow(r / (NR - 1), 1.4), z = SNOUT - s * BODY, [h, w, yc] = prof(s);
      if (!r) { rings.push([vtx(0, yc, z, 0)]); continue; }
      const ring = [];
      for (let k = 0; k < M; k++) { const a = k / M * TAU, c = Math.cos(a); ring.push(vtx(Math.sin(a) * w, yc + c * h * (c < 0 ? 0.88 : 1), z, 0)); }
      rings.push(ring);
    }
    for (let r = 1; r < NR; r++) {
      const A = rings[r - 1], B = rings[r];
      for (let k = 0; k < M; k++) { const k1 = (k + 1) % M; if (A.length === 1) idx.push(A[0], B[k1], B[k]); else idx.push(A[k], A[k1], B[k1], A[k], B[k1], B[k]); }
    }
    { const last = rings[NR - 1], z = SNOUT - BODY, cap = vtx(0, prof(1)[2], z - 0.01, 0); for (let k = 0; k < M; k++) idx.push(last[k], last[(k + 1) % M], cap); }
    // fins: flat, seen from both sides; a fan from their first point (or from c)
    const fin = (pts, c) => {
      const b = pos.length / 3; for (const p of c ? [c, ...pts] : pts) vtx(p[0], p[1], p[2], 1);
      const n = pts.length + (c ? 1 : 0);
      for (let k = 1; k < n - 1; k++) idx.push(b, b + k, b + k + 1);
      if (c) idx.push(b, b + n - 1, b + 1);
    };
    const pair = pts => { fin(pts); fin(pts.map(p => [-p[0], p[1], p[2]]).reverse()); };
    fin([[0, 0.19, 0.3], [0, 0.36, 0.15], [0, 0.53, -0.11], [0, 0.31, -0.05], [0, 0.16, -0.1]]);        // the first dorsal fin, tall and swept back
    fin([[0, 0.08, -0.46], [0, 0.155, -0.56], [0, 0.125, -0.565], [0, 0.07, -0.6]]);                 // the second, small
    fin([[0, -0.055, -0.5], [0, -0.125, -0.6], [0, -0.1, -0.605], [0, -0.05, -0.64]]);               // the anal fin
    pair([[0.13, -0.06, 0.5], [0.38, -0.14, 0.38], [0.62, -0.27, 0.07], [0.33, -0.15, 0.2], [0.13, -0.075, 0.3]]);   // pectoral fins: long, back and down
    pair([[0.05, -0.105, -0.15], [0.17, -0.18, -0.3], [0.035, -0.1, -0.31]]);                          // pelvic fins
    // the tail: a crescent, its upper lobe longer (round a point in its middle)
    fin([[0, 0.045, -0.8], [0, 0.28, -1.02], [0, 0.47, -1.3], [0, 0.22, -1.1], [0, 0.03, -1.0], [0, -0.1, -1.035], [0, -0.25, -1.13], [0, -0.15, -0.93], [0, -0.03, -0.8]], [0, 0.01, -0.9]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(aS), 1));
    g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(aK), 1));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // its eye (on each side, a little above the middle), for the shader
  const EYE = (() => { const s = 0.1, [h, w, yc] = prof(s); return new THREE.Vector3(Math.sin(1.05) * w * 0.98, yc + Math.cos(1.05) * h, SNOUT - s * BODY); })();
  const sharkMat = mat({
    uniforms: Object.assign({ uA: set.uA, uPh: { value: 0 }, uAmp: { value: 0.09 }, uEye: { value: EYE } }, U), transparent: true, side: THREE.DoubleSide,
    vertexShader: `attribute float aS, aK; uniform float uPh, uAmp; varying vec3 vW, vN, vNL, vL; varying float vK;
void main() {
  // swimming: a slow wave runs back along the body, wider towards the tail; the head stays nearly still
  vec3 p = position, n = normal;
  float A = uAmp * (0.05 + aS * aS), w = uPh - aS * 5.2;
  p.x += A * sin(w);
  float dx = (uAmp * 2.0 * aS * sin(w) - A * 5.2 * cos(w)) * ${(-1 / BODY).toFixed(4)};   // (the bend's slope along z turns the normals)
  n.z -= dx * n.x;
  vL = position; vNL = normal; vK = aK;
  vW = (modelMatrix * vec4(p, 1.0)).xyz; vN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`,
    fragmentShader: WATER + `uniform float uA, uWater; uniform vec3 uEye; varying vec3 vW, vN, vNL, vL; varying float vK;
void main() {
  vec3 v = vW - cameraPosition; float dist = length(v); vec3 d = v / dist;
  float fs = gl_FrontFacing ? 1.0 : -1.0;
  vec3 n = normalize(vN) * fs, nl = normalize(vNL) * fs;   // (the side you see: fins are seen from both)
  // counter-shading: a blue-grey back down to an uneven line along the flank, a pale belly (fins: dark, pale beneath)
  float wob = 0.07 * sin(vL.z * 13.0 + 0.7) + 0.04 * sin(vL.z * 29.0);
  float back = vK > 0.5 ? smoothstep(-0.75, -0.3, nl.y) : smoothstep(-0.4, -0.12, nl.y + wob);
  vec3 c = mix(vec3(0.86, 0.88, 0.88), vec3(0.25, 0.33, 0.4), back);
  c *= 1.0 - 0.2 * smoothstep(0.55, 0.95, nl.y) * (1.0 - vK);   // (darker along the spine)
  // five gill slits on each flank, just before the pectoral fins, leaning back towards the top
  if (vK < 0.5 && abs(nl.x) > 0.55 && nl.y > -0.5 && nl.y < 0.5) {
    float q = (vL.z - 0.47 + 0.22 * vL.y) / 0.042;
    if (q > 0.0 && q < 5.0) c *= 1.0 - 0.5 * (1.0 - smoothstep(0.1, 0.25, abs(fract(q) - 0.5)));
  }
  // the mouth: a faint dark line under the snout
  if (vK < 0.5 && nl.y < -0.45 && abs(vL.x) < 0.1) c *= 1.0 - 0.45 * (1.0 - smoothstep(0.004, 0.012, abs(vL.z - 0.77 + 3.0 * vL.x * vL.x)));
  // small dark eyes
  float e = length(vec3(abs(vL.x), vL.y, vL.z) - uEye);
  c = mix(c, vec3(0.02, 0.025, 0.03), (1.0 - smoothstep(0.014, 0.02, e)) * (1.0 - vK));
  // lit from the surface; the skin has a sheen; a faint rim keeps the shape against deep water
  c *= 0.42 + 0.58 * max(dot(n, uSun), 0.0) + 0.22 * max(-n.y, 0.0) + 0.12 * vK;   // (and a little from the water below)
  vec3 rf = reflect(d, n);
  c += vec3(0.55, 0.8, 0.85) * (pow(max(rf.y, 0.0), 6.0) * 0.2 + pow(max(dot(rf, uSun), 0.0), 28.0) * 0.4) * (1.0 - 0.5 * vK);
  c += vec3(0.3, 0.55, 0.6) * pow(1.0 - abs(dot(n, d)), 3.0) * 0.16 * uWater;
  c = mix(c, waterCol(d), (1.0 - exp(-dist * ${FOG.toFixed(4)})) * uWater);
  gl_FragColor = vec4(c, uA);
}`,
  });
  const shark = new THREE.Mesh(sharkGeo(), sharkMat);
  shark.frustumCulled = false; shark.renderOrder = 2; shark.visible = false; set.group.add(shark);
  // its pose, every frame: where it glides between steps, along its way (never standing on its nose), banked into
  // turns; its tail beats slowly at cruise and faster as it speeds up or turns hard
  const _sf = new THREE.Vector3(), _sx = new THREE.Vector3(), _sy = new THREE.Vector3(), _sZ = new THREE.Vector3(0, 0, 1), _sU = new THREE.Vector3(0, 1, 0), _sM = new THREE.Matrix4(), _sQ = new THREE.Quaternion();
  function poseShark(dt, lag) {
    shark.visible = SH.on;
    if (!SH.on) return;
    const sp = Math.hypot(SH.v[0], SH.v[1], SH.v[2]), hl = Math.hypot(SH.v[0], SH.v[2]);
    if (hl > 0.05) { SH.hd[0] = SH.v[0] / hl; SH.hd[1] = SH.v[2] / hl; }
    const pitch = clamp(Math.atan2(SH.v[1], hl), -0.5, 0.5), cp = Math.cos(pitch);
    _sf.set(SH.hd[0] * cp, Math.sin(pitch), SH.hd[1] * cp);
    _sx.crossVectors(_sU, _sf).normalize(); _sy.crossVectors(_sf, _sx);
    shark.quaternion.setFromRotationMatrix(_sM.makeBasis(_sx, _sy, _sf)).multiply(_sQ.setFromAxisAngle(_sZ, SH.bank));
    shark.position.set(SH.p[0] + SH.v[0] * lag, SH.p[1] + SH.v[1] * lag, SH.p[2] + SH.v[2] * lag);
    SH.ph += dt * TAU * (0.3 + 0.2 * sp + 0.8 * SH.eff);
    sharkMat.uniforms.uPh.value = SH.ph % (TAU * 1000);
    sharkMat.uniforms.uAmp.value = 0.085 * (1 + 0.5 * SH.eff);
  }
  // the network: each fish to the few it watches; cyan, warming to white where the warning is
  const lg = K.linesGeo(MAXN * KMAX), lm = K.lines(set, { additive: true }), net = new THREE.LineSegments(lg, lm);
  net.frustumCulled = false; net.renderOrder = 3; set.group.add(net);

  function draw(S) {
    for (let i = 0; i < N; i++) { FL_I[i * 3] = BK[i]; FL_I[i * 3 + 1] = Math.max(FL[i], AL[i] * 0.18); FL_I[i * 3 + 2] = PH[i]; }
    fg.instanceCount = N;
    aP.needsUpdate = aV.needsUpdate = aB.needsUpdate = true;
    const la = clamp(S.fish_links, 0, 1);
    net.visible = la > 0.01;
    if (net.visible) {
      const pa = lg.attributes.position.array, aa = lg.attributes.aA.array, ca = lg.attributes.aCol.array, hx = ME.head[0], hy = ME.head[1], hz = ME.head[2];
      let n = 0;
      for (let i = 0; i < N; i++) {
        const i3 = i * 3, dd = Math.hypot(P[i3] - hx, P[i3 + 1] - hy, P[i3 + 2] - hz), a = la * 0.6 * clamp(1.5 - dd / 14, 0.2, 1);
        for (let k = 0; k < NBC[i]; k++) {
          const j = NB[i * KMAX + k], j3 = j * 3, w = Math.max(FL[i], FL[j], AL[i] * 0.35);
          pa[n * 6] = P[i3]; pa[n * 6 + 1] = P[i3 + 1]; pa[n * 6 + 2] = P[i3 + 2];
          pa[n * 6 + 3] = P[j3]; pa[n * 6 + 4] = P[j3 + 1]; pa[n * 6 + 5] = P[j3 + 2];
          const r = 0.3 + 0.7 * w, g = 0.85 + 0.15 * w, b = 1.0 - 0.15 * w;
          ca[n * 6] = ca[n * 6 + 3] = r; ca[n * 6 + 1] = ca[n * 6 + 4] = g; ca[n * 6 + 2] = ca[n * 6 + 5] = b;
          aa[n * 2] = aa[n * 2 + 1] = Math.min(1, a * (1 + 1.5 * w)); n++;
        }
      }
      lg.setDrawRange(0, n * 2);
      lg.attributes.position.needsUpdate = true; lg.attributes.aA.needsUpdate = true; lg.attributes.aCol.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- params, update, exports
  // the middle of the school's main body: a few steps of mean shift (the fish within 4 m, from where the body was), so a
  // school split by the shark is not looked for in the empty water between its parts
  function middle() { let x = 0, y = 0, z = 0; for (let i = 0; i < N; i++) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; } return [x / N, y / N, z / N]; }
  function centre() {
    let c = CEN;
    for (let it = 0; it < 2; it++) {
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (let i = 0; i < N; i++) {
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        if ((x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2 < 16) { sx += x; sy += y; sz += z; n++; }
      }
      c = n < N * 0.15 ? middle() : [sx / n, sy / n, sz / n];
    }
    CEN[0] = c[0]; CEN[1] = c[1]; CEN[2] = c[2];
  }
  const EYE_H = 1.6;   // the viewer's eyes over this set's origin
  const params = { fish_a: 1, fish_n: 300, fish_k: 7, fish_links: 0, fish_water: 1, fish_shark: 0, fish_hunt: 0, fish_scale: 1 };
  let tLast = null, hunts = 0, tSim = 0, acc = 0, SCL = 1;
  const SIM = 1 / 30;   // the school moves in steps of a thirtieth of a second; between them the fish glide on (uLag)
  function update(S, t, dt) {
    const water = U.uWater.value = clamp(S.fish_water, 0, 1);
    for (const m of ENV) m.visible = water > 0.003;
    // without the water (passthrough) the school swims in your room, at a third of life size, shrunk round your eyes
    // (round the floor it swam at knee height)
    SCL = Math.max(1e-4, S.fish_scale === undefined ? 1 : S.fish_scale);
    const pt = water > 0.5 ? 1 : 0.34;
    set.group.scale.setScalar(pt * SCL); set.group.position.y = EYE_H * (1 - pt);
    // more or fewer fish: new ones join beside a fish already swimming
    const want = clamp(Math.round(S.fish_n), 30, MAXN);
    if (want > N) for (let i = N; i < want; i++) { const j = Math.floor(R() * N) * 3; spawn(i, [P[j], P[j + 1], P[j + 2]], 0.4); V[i * 3] = V[j]; V[i * 3 + 1] = V[j + 1]; V[i * 3 + 2] = V[j + 2]; }
    N = want;
    KN = clamp(Math.round(S.fish_k), 1, KMAX);
    // the story (or a button) sends a shark each time fish_hunt passes a whole number
    const h = Math.floor(S.fish_hunt + 1e-6);
    if (h > hunts && !SH.on && !FOL && !HUSH) launch(null);
    hunts = h;
    let d = dt === undefined ? (tLast === null ? 0 : t - tLast) : dt;
    tLast = t;
    d = clamp(d, 0, 0.1);
    if (S.fish_shark > 0.5 && !SH.on && !FOL && !HUSH) { SH.next -= d; if (SH.next < 0) { launch(null); SH.next = 30 + R() * 25; } }
    acc = Math.min(acc + d, 0.2);
    let stepped = false;
    while (acc >= SIM) { acc -= SIM; tSim += SIM; step(SIM, tSim + tOff); stepped = true; }
    if (stepped) draw(S);
    U.uLag.value = acc;
    poseShark(d, acc);
    SNOWC.set(ME.head[0], ME.head[1], ME.head[2]);
  }
  // warm up, so the school is already swimming when the scene first shows; then move it in front of you
  for (let k = 0; k < 150; k++) { tSim += SIM; step(SIM, tSim); }
  {
    const c = middle();
    for (let i = 0; i < MAXN; i++) { P[i * 3] += -c[0]; P[i * 3 + 1] += 1.8 - c[1]; P[i * 3 + 2] += -5 - c[2]; }
    CEN[0] = 0; CEN[1] = 1.8; CEN[2] = -5; centre();
  }
  draw(params);

  const anchors = { school: () => [CEN[0], CEN[1] + 0.6, CEN[2]],
    shark: () => (SH.on ? [SH.p[0], SH.p[1] + 0.75, SH.p[2]] : [0, -100, 0]) };   // (just over its dorsal fin)
  const labels = [
    { text: () => [T('Shark', 'Hai'), ''], at: 'shark', cls: 'amb', alpha: () => (SH.on && !SH.steer && !SH.cruise && SH.t < 7 ? 1 : 0) },
  ];
  // views: [az, el, dist, tx, ty, tz]: floating where you are, looking ahead (the target is just in front of your eyes,
  // so the camera stands where you do; the engine turns it to the school), looking up to the light, from outside the
  // school close enough to tell each fish and its links apart ('near') or the whole of it ('afar'); 'above' looks down
  // from above the surface (for the rise to the globe)
  const cam = {
    default: [0, -6, 0.25, 0, 1.6, 0],
    up: [20, -55, 0.25, 0, 1.6, 0],
    near: [25, 10, 8, 0, 1.6, -4],
    afar: [25, 10, 13, 0, 1.6, -4],
    above: [0, 80, 40, 0, 1.6, -4],
  };
  const CTL = {
    en: [
      { key: 'view', label: 'View', options: [['default', 'Follow the school'], ['free', 'Look around'], ['afar', 'From afar']] },
      { key: 'k', label: 'Neighbours watched', options: [['7', '7'], ['1', '1'], ['3', '3'], ['12', '12']] },
      { key: 'links', label: 'Network', options: [['off', 'Off'], ['on', 'Who watches whom']] },
      { key: 'shark', label: 'Shark', options: [['off', 'Off'], ['some', 'Now and then']] },
    ],
    de: [
      { key: 'view', label: 'Ansicht', options: [['default', 'Dem Schwarm folgen'], ['free', 'Umschauen'], ['afar', 'Von weit weg']] },
      { key: 'k', label: 'Beobachtete Nachbarn', options: [['7', '7'], ['1', '1'], ['3', '3'], ['12', '12']] },
      { key: 'links', label: 'Netzwerk', options: [['off', 'Aus'], ['on', 'Wer wen beobachtet']] },
      { key: 'shark', label: 'Hai', options: [['off', 'Aus'], ['some', 'Ab und zu']] },
    ],
  };
  function explore(c) {
    return { fish_k: +c.k || 7, fish_links: c.links === 'on' ? 1 : 0, fish_shark: c.shark === 'some' ? 1 : 0 };
  }
  // the engine tells the school where you are (head and hands, in this set's frame); spot: at a station in a shared
  // room the school stays round the station's spot (this frame's origin), the same for everyone there; or [x, z]: round
  // that point instead (in a headset, where you would be had you not moved the sea with the grip)
  function see(head, hands, spot) {
    ME.head = head; ME.hands = hands || [];
    if (SCL < 0.5) return;   // (the sea shrinking as the camera rises: the school stays where it is)
    const at = Array.isArray(spot), cx = at ? spot[0] : spot ? 0 : head[0], cz = at ? spot[1] : spot ? 0 : head[2];
    ME.c[0] += (cx - ME.c[0]) * 0.02; ME.c[1] += (cz - ME.c[1]) * 0.02;
  }
  // you are the shark: it swims after this point (in this set's frame) for as long as you steer it (none yet: it comes
  // in from beyond the point, away from you); null lets it go: while you are still the shark (hold) it stays and
  // cruises round the school, else it swims off
  function steer(p) {
    if (p) {
      if (!SH.on) {
        const ox = p[0] - ME.head[0], oz = p[2] - ME.head[2], ol = Math.hypot(ox, oz) + 1e-3;
        startShark({ p: [p[0] + ox / ol * 7, p[1], p[2] + oz / ol * 7], v: [-ox / ol * 2, 0, -oz / ol * 2], aim: null });
      }
      SH.steer = p.slice(); SH.cruise = false; SH.dash = false;
    } else if (SH.steer) {
      SH.steer = null;
      if (HOLD) cruise(); else away();
    }
  }
  // explore's "be the shark" on (the engine says so every frame): off, a shark of yours swims off
  function hold(on) { HOLD = !!on; if (!HOLD) leave(); }
  // a shark from another device at the station (or the story's, sent with shark): not while you are being the shark
  // with one of your own
  function arrive(f) { if (HOLD && SH.on && (SH.cruise || SH.steer)) return; startShark(f); }
  // shared rooms, as the flock's: this school's swim (its time, middle and velocity), and another's to follow
  function flight() {
    const m = middle(); let x = 0, y = 0, z = 0;
    for (let i = 0; i < N; i++) { x += V[i * 3]; y += V[i * 3 + 1]; z += V[i * 3 + 2]; }
    return { t: tSim + tOff, m, v: [x / N, y / N, z / N] };
  }
  function follow(o, dt) {
    FOL = o ? { m: o.m, v: o.v, t0: tSim } : null;
    if (!o) return;
    const d = o.t - (tSim + tOff);
    tOff += Math.abs(d) > 2 ? d : d * (1 - Math.exp(-(dt || 0) / 0.8));
  }
  function scatter(dir) {
    if (SH.on) return false;
    launch(dir ? [ME.head[0] + dir[0] * 8, ME.head[1] + dir[1] * 8, ME.head[2] + dir[2] * 8] : null);
    return true;
  }
  const out = Object.assign(set, { params, update, anchors, labels, cam, explore, see, steer, hold, scatter, shark: arrive, flight, follow,
    hush: on => { HUSH = !!on; }, hunted: h => { hunts = Math.floor(h + 1e-6); }, sharkOn: () => SH.on, following: () => !!FOL, fish: () => N, neighbours: () => KN,
    // (the flock engine's names, so its shared-room code ports as it is)
    falcon: arrive, falconOn: () => SH.on, kept: () => SH.on && SH.cruise,
    setLang: l => { LANG = l === 'de' ? 'de' : 'en'; },
    state: () => ({ P, V, AL, FL, N, NB, NBC, KN, KMAX, me: ME, shark: SH, centre: CEN, t: tSim }), watch: f => { WATCH = f; } });
  Object.defineProperty(out, 'controls', { get: () => CTL[LANG], enumerable: true });
  return out;
};
