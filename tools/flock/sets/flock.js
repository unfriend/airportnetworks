// A murmuration: starlings at dusk, flying all around you. A live simulation: each bird matches the heading of its
// seven nearest neighbours (as starlings do, whatever the distance), keeps its distance, follows the flock's
// wandering roosts round the viewer, steers clear of the viewer's head and hands, and flees a falcon. Alarm passes
// from bird to neighbour, so a wave runs through the flock (the birds bank, and their wings show as dark bands).
// Life size: 1 unit is 1 m, the viewer stands at the origin, the ground is y = 0, the sun sets towards -z.
// The simulation is the one part of a set that is not a pure function of the params and the time: it runs on.
SETS.flock = function (K) {
  const { THREE, clamp, lerp, rng } = K;
  const set = K.newSet('flock');
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- the sky, shared by the sky, the land and the birds
  const SUN = new THREE.Vector3(0.18, 0.045, -1).normalize();
  const SKY = `
uniform vec3 uSun;
float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vno(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y); }
// dusk: deep blue overhead, a warm band low down (strongest towards the sun), the sun's glow, streaks of cloud
vec3 skyCol(vec3 d) {
  float y = max(d.y, 0.0), s = max(dot(d, uSun), 0.0);
  vec3 c = mix(vec3(0.33, 0.39, 0.6), vec3(0.07, 0.11, 0.26), pow(y, 0.55));
  float low = pow(1.0 - y, 6.0);
  c = mix(c, mix(vec3(0.82, 0.5, 0.48), vec3(1.0, 0.62, 0.36), s * s), low * (0.45 + 0.55 * s));
  c += vec3(1.0, 0.72, 0.45) * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.4 + pow(s, 5.0) * 0.12);
  float band = smoothstep(0.015, 0.06, y) * (1.0 - smoothstep(0.12, 0.3, y));
  if (band > 0.0) {
    vec2 q = vec2(atan(d.z, d.x) * 5.0, y * 38.0);
    float n = vno(q * vec2(1.0, 0.5)) * 0.6 + vno(q * vec2(2.3, 1.1) + 7.0) * 0.4;
    float cl = smoothstep(0.55, 0.8, n) * band;
    c = mix(c, mix(vec3(0.42, 0.33, 0.45), vec3(1.0, 0.6, 0.45), pow(s, 3.0)), cl * 0.75);
  }
  return c;
}
// the haze where the land meets the sky, in the direction d
vec3 hazeCol(vec3 d) { return skyCol(normalize(vec3(d.x, 0.004, d.z))); }
`;
  const U = { uSun: { value: SUN }, uSky: { value: 1 }, uLag: { value: 0 } };
  const mat = o => { const m = new THREE.ShaderMaterial(o); set.mats.push(m); return m; };
  const ENV = [];   // the sky, the land, the trees and the reeds: hidden in passthrough, where your room takes their place

  // sky dome
  {
    const m = mat({
      uniforms: Object.assign({ uA: set.uA }, U), side: THREE.BackSide, depthWrite: false, transparent: true,
      vertexShader: `varying vec3 vD; void main() { vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = vec4(p.xy, p.w * 0.99999, p.w); }`,
      fragmentShader: SKY + `uniform float uA, uSky; varying vec3 vD;
void main() { vec3 d = normalize(vD); gl_FragColor = vec4(skyCol(d), uA * uSky); }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), m);
    sky.renderOrder = -2; sky.frustumCulled = false; set.group.add(sky); ENV.push(sky);
  }
  // the land: a dark field running into the haze, a lake towards the sunset that mirrors the sky, a line of trees
  {
    const m = mat({
      uniforms: Object.assign({ uA: set.uA }, U), transparent: true, depthWrite: false,
      vertexShader: `varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: SKY + `uniform float uA, uSky, uTimeW; varying vec3 vW;
void main() {
  vec3 e = cameraPosition, v = vW - e; float dist = length(v.xz); vec3 d = normalize(v);
  float n = vno(vW.xz * 0.02) * 0.6 + vno(vW.xz * 0.11) * 0.3 + vno(vW.xz * 0.9) * 0.1;
  vec3 c = mix(vec3(0.035, 0.045, 0.04), vec3(0.075, 0.07, 0.055), n);
  // the lake: beyond 45 m towards the sun, its shore wandering
  float lk = smoothstep(0.0, 18.0, -vW.z - 45.0 - (vno(vW.xz * 0.012) - 0.5) * 70.0) * smoothstep(-260.0, -140.0, -abs(vW.x));
  if (lk > 0.0) {
    vec3 r = reflect(d, vec3(0.0, 1.0, 0.0)); r.xz += (vno(vW.xz * 0.6 + uTimeW * 0.4) - 0.5) * 0.02;
    vec3 w = skyCol(normalize(r)) * 0.72 + vec3(0.02, 0.025, 0.04);
    c = mix(c, w, lk);
  }
  c = mix(c, hazeCol(d), 1.0 - exp(-dist * 0.0035));
  gl_FragColor = vec4(c, uA * uSky);
}`,
    });
    m.uniforms.uTimeW = K.U.uTime;
    const g = new THREE.CircleGeometry(880, 96).rotateX(-Math.PI / 2);
    const land = new THREE.Mesh(g, m); land.renderOrder = -1; land.frustumCulled = false; set.group.add(land); ENV.push(land);
    // the tree line: a ring of dark crowns of varying height, hazy with distance
    const R = rng(77), NS = 720, P = [], idx = [];
    for (let i = 0; i <= NS; i++) {
      const a = i / NS * TAU, r = 620 + 40 * Math.sin(a * 3 + 1);
      const hgt = Math.max(0, 6 + 10 * Math.sin(a * 7) * Math.sin(a * 13 + 2) + (R() - 0.5) * 8 + (Math.abs(Math.sin(a * 2.5)) < 0.15 ? -14 : 0));
      P.push(Math.cos(a) * r, -1, Math.sin(a) * r, Math.cos(a) * r, hgt, Math.sin(a) * r);
      if (i < NS) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); tg.setIndex(idx);
    const tm = mat({
      uniforms: Object.assign({ uA: set.uA }, U), transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: SKY + `uniform float uA, uSky; varying vec3 vW;
void main() { vec3 d = normalize(vW - cameraPosition); gl_FragColor = vec4(mix(vec3(0.03, 0.035, 0.05), hazeCol(d), 0.62), uA * uSky); }`,
    });
    const trees = new THREE.Mesh(tg, tm); trees.renderOrder = -1; trees.frustumCulled = false; set.group.add(trees); ENV.push(trees);
  }
  // reeds and grass round where you stand, swaying (a sense of scale, and ground under your feet)
  {
    const R = rng(5), NB = 2600, P = [], A = [];
    for (let i = 0; i < NB; i++) {
      const r = 2.2 + Math.pow(R(), 0.7) * 30, a = R() * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = (0.35 + R() * 0.9) * (r > 10 ? 1.4 : 1), w = 0.012 + R() * 0.02, lean = (R() - 0.5) * 0.5, ry = R() * TAU;
      const cx = Math.cos(ry) * w, cz = Math.sin(ry) * w, ph = R() * TAU;
      P.push(x - cx, 0, z - cz, x + cx, 0, z + cz, x + lean * h * 0.3, h, z + lean * h * 0.2);
      A.push(0, ph, 0, ph, 1, ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(A), 2));
    const m = mat({
      uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, U), transparent: true, side: THREE.DoubleSide,
      vertexShader: `attribute vec2 aS; uniform float uTime; varying vec3 vW; varying float vH;
void main() { vec3 p = position; float s = aS.x * aS.x;
  p.x += s * (0.06 * sin(uTime * 1.3 + aS.y + p.z * 0.2) + 0.05); p.z += s * 0.03 * sin(uTime * 1.1 + aS.y * 1.7);
  vW = (modelMatrix * vec4(p, 1.0)).xyz; vH = aS.x; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: SKY + `uniform float uA, uSky; varying vec3 vW; varying float vH;
void main() { vec3 d = normalize(vW - cameraPosition);
  vec3 c = mix(vec3(0.03, 0.035, 0.025), vec3(0.16, 0.12, 0.08), vH) + hazeCol(d) * 0.18 * vH;
  c = mix(c, hazeCol(d), 1.0 - exp(-length(vW.xz - cameraPosition.xz) * 0.0035));
  gl_FragColor = vec4(c, uA * uSky); }`,
    });
    const reeds = new THREE.Mesh(g, m); reeds.frustumCulled = false; set.group.add(reeds); ENV.push(reeds);
  }

  // ---------------------------------------------------------------- the birds: a live simulation
  const MAXN = 400, KN = 7;                        // most birds; neighbours each bird follows
  const P = new Float32Array(MAXN * 3), V = new Float32Array(MAXN * 3), ACC = new Float32Array(MAXN * 3);
  const AL = new Float32Array(MAXN), AL2 = new Float32Array(MAXN), BK = new Float32Array(MAXN), PH = new Float32Array(MAXN), GR = new Float32Array(MAXN);
  const NB = new Int32Array(MAXN * KN), NBC = new Uint8Array(MAXN);
  const R = rng(1903);
  let N = 200;
  const spawn = (i, c) => {
    const a = R() * TAU, r = 3 + R() * 6, e = (R() - 0.5) * 4;
    P[i * 3] = c[0] + Math.cos(a) * r; P[i * 3 + 1] = Math.max(4, c[1] + e); P[i * 3 + 2] = c[2] + Math.sin(a) * r;
    V[i * 3] = -Math.sin(a) * 9; V[i * 3 + 1] = 0; V[i * 3 + 2] = Math.cos(a) * 9;
    AL[i] = 0; BK[i] = 0; PH[i] = R() * TAU; GR[i] = R();
  };
  for (let i = 0; i < MAXN; i++) spawn(i, [0, 9, -14]);
  // the viewer (head and hands, in this set's frame; the engine updates them) and the falcon
  const ME = { head: [0, 1.6, 0], hands: [], c: [0, 0] };
  const FAL = { on: false, p: [0, 0, 0], v: [0, 0, 0], t: 0, pass: 0, next: 30, aim: null };

  // where the flock likes to be: a roost point in front of the viewer (towards the sunset) that wanders slowly
  // left and right, in and out, up and down, and every 88 s comes in low and close for about ten seconds, so the
  // flock flies round the viewer (first at 72 s of flight: the story's last chapter, as the flock warms up for
  // 6 s); two more points near it pull parts of the flock aside, so it stretches and folds
  const roost = (k, t, out) => {
    const th = -Math.PI / 2 + 1.1 * Math.sin(t * 0.037) + 0.7 * Math.sin(t * 0.059 - 0.3) + t * 0.012, sw = Math.pow(Math.max(0, Math.sin(t * 0.071 - 3.54)), 10);
    const r = lerp(16 + 3 * Math.sin(t * 0.061), 2, sw), h = lerp(9 + 3 * Math.sin(t * 0.083 + 2), 5, sw);
    if (!k) SW = sw;
    out[0] = ME.c[0] + Math.cos(th) * r; out[1] = h; out[2] = ME.c[1] + Math.sin(th) * r;
    if (k) {   // the satellites: 3-9 m off the main point, turning round it
      const a = t * (0.23 + 0.07 * k) * (k === 1 ? 1 : -1) + k * 2.4, o = 6 + 3 * Math.sin(t * 0.05 * k + k);
      out[0] += Math.cos(a) * o; out[1] += Math.sin(a * 0.7 + k) * o * 0.4; out[2] += Math.sin(a) * o;
    }
    return out;
  };
  // and the flock's whim: a heading that turns now left, now right (slow waves of turning), climbing and diving a
  // little, which the whole flock leans towards; so it wheels and doubles back instead of circling
  const whim = t => {
    const a = -Math.PI / 2 - 2.9 * Math.cos(t * 0.31) - 1.13 * Math.cos(t * 0.53 + 2) + 0.9 * Math.sin(t * 0.13);
    return [Math.cos(a), 0.18 * Math.sin(t * 0.27) + 0.1 * Math.sin(t * 0.71 + 1), Math.sin(a)];
  };
  const RT = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let SW = 0;   // how far into a swoop
  // in a shared room another device's flock may lead this one (follow): its flight time is taken (tOff, so the roost
  // and the whim are the same) and the flock as a whole is steered to where that one is
  let tOff = 0, FOL = null;
  const CEN = [0, 9, -14];   // the middle of the flock's main body (centre())

  // a grid of cells round the viewer for the neighbour search (birds beyond its edge share the edge cells)
  const CS = 1.1, GX = 72, GY = 34, GZ = 72, NC = GX * GY * GZ, cnt = new Int32Array(NC), start = new Int32Array(NC), mark = new Int32Array(NC), ids = new Int32Array(MAXN), key = new Float64Array(MAXN);
  let stamp = 0;
  const gx = x => clamp(Math.floor((x - ME.c[0]) / CS) + GX / 2, 0, GX - 1), gy = y => clamp(Math.floor(y / CS), 0, GY - 1), gz = z => clamp(Math.floor((z - ME.c[1]) / CS) + GZ / 2, 0, GZ - 1);
  const bd = new Float32Array(KN), bj = new Int32Array(KN);
  // the 27 cells round a bird, nearest first, so most far ones can be skipped once seven close birds are found
  const ORD = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) ORD.push([dx, dy, dz, Math.abs(dx) + Math.abs(dy) + Math.abs(dz)]);
  ORD.sort((a, b) => a[3] - b[3]);
  function neighbours() {
    // the birds sorted by cell; only the cells in use are written (marked with this step's stamp)
    stamp++;
    for (let i = 0; i < N; i++) key[i] = ((gx(P[i * 3]) * GY + gy(P[i * 3 + 1])) * GZ + gz(P[i * 3 + 2])) * 4096 + i;
    const ks = key.subarray(0, N); ks.sort();
    for (let q = 0; q < N; q++) { const h = Math.floor(ks[q] / 4096); ids[q] = ks[q] - h * 4096; if (mark[h] !== stamp) { mark[h] = stamp; start[h] = q; cnt[h] = 0; } cnt[h]++; }
    for (let i = 0; i < N; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], cx = gx(x), cy = gy(y), cz = gz(z);
      // where the bird sits in its cell (for the distance to the cells round it)
      const fx = x - (ME.c[0] + (cx - GX / 2) * CS), fy = y - cy * CS, fz = z - (ME.c[1] + (cz - GZ / 2) * CS);
      let nb = 0;
      for (let o = 0; o < 27; o++) {
        const dx = ORD[o][0], dy = ORD[o][1], dz = ORD[o][2], ix = cx + dx, iy = cy + dy, iz = cz + dz;
        if (ix < 0 || iy < 0 || iz < 0 || ix >= GX || iy >= GY || iz >= GZ) continue;
        if (nb === KN) {
          const ex = dx < 0 ? fx : dx > 0 ? CS - fx : 0, ey = dy < 0 ? fy : dy > 0 ? CS - fy : 0, ez = dz < 0 ? fz : dz > 0 ? CS - fz : 0;
          if (Math.max(ex, 0) ** 2 + Math.max(ey, 0) ** 2 + Math.max(ez, 0) ** 2 >= bd[KN - 1]) continue;
        }
        const h = (ix * GY + iy) * GZ + iz;
        if (mark[h] !== stamp) continue;
        for (let q = start[h], e = start[h] + cnt[h]; q < e; q++) {
          const j = ids[q]; if (j === i) continue;
          const ex = P[j * 3] - x, ey = P[j * 3 + 1] - y, ez = P[j * 3 + 2] - z, d2 = ex * ex + ey * ey + ez * ez;
          if (nb === KN && d2 >= bd[KN - 1]) continue;
          let k = nb < KN ? nb++ : KN - 1;
          while (k > 0 && bd[k - 1] > d2) { bd[k] = bd[k - 1]; bj[k] = bj[k - 1]; k--; }
          bd[k] = d2; bj[k] = j;
        }
      }
      NBC[i] = nb; for (let k = 0; k < nb; k++) NB[i * KN + k] = bj[k];
    }
  }
  // one step of the flock
  const V0 = 8.5, KR = 0.16, KH = 0.6, EDGE = 24;   // cruising speed; the pulls of the roost and the whim; how far the flock may roam
  function step(dt, t, S) {
    neighbours();
    for (let k = 0; k < 3; k++) roost(k, t, RT[k]);
    const hx = ME.head[0], hy = ME.head[1], hz = ME.head[2];
    let gcx = 0, gcy = 0, gcz = 0, gvx = 0, gvy = 0, gvz = 0;
    for (let i = 0; i < N; i++) { gcx += P[i * 3]; gcy += P[i * 3 + 1]; gcz += P[i * 3 + 2]; gvx += V[i * 3]; gvy += V[i * 3 + 1]; gvz += V[i * 3 + 2]; }
    gcx /= N; gcy /= N; gcz /= N; gvx /= N; gvy /= N; gvz /= N;
    // following: where the leading flock is now (sent with its velocity); far off (just joined) the flock moves
    // there at once, else every bird gets the same pull (a spring on the middle, damped by the velocity)
    let lx = 0, ly = 0, lz = 0;
    if (FOL) {
      const e = tSim - FOL.t0, ex = FOL.m[0] + FOL.v[0] * e - gcx, ey = FOL.m[1] + FOL.v[1] * e - gcy, ez = FOL.m[2] + FOL.v[2] * e - gcz;
      if (Math.hypot(ex, ey, ez) > 12) {
        for (let i = 0; i < MAXN; i++) { P[i * 3] += ex; P[i * 3 + 1] += ey; P[i * 3 + 2] += ez; V[i * 3] += FOL.v[0] - gvx; V[i * 3 + 1] += FOL.v[1] - gvy; V[i * 3 + 2] += FOL.v[2] - gvz; }
        gcx += ex; gcy += ey; gcz += ez; CEN[0] += ex; CEN[1] += ey; CEN[2] += ez;
      } else {
        lx = ex * 0.5 + (FOL.v[0] - gvx) * 0.8; ly = ey * 0.5 + (FOL.v[1] - gvy) * 0.8; lz = ez * 0.5 + (FOL.v[2] - gvz) * 0.8;
        const ll = Math.hypot(lx, ly, lz); if (ll > 10) { lx *= 10 / ll; ly *= 10 / ll; lz *= 10 / ll; }
      }
    }
    // the pull to the roost acts on the flock as a whole (on its middle), so the flock moves as one body
    const rpx = RT[0][0] - gcx, rpy = RT[0][1] - gcy, rpz = RT[0][2] - gcz, rpl = Math.hypot(rpx, rpy, rpz) + 1e-3, rpf = KR * (1 + 3 * SW) * Math.min(rpl, 30) / rpl, kh = KH * (1 - 0.8 * SW);   // in a swoop the roost wins
    const H = whim(t), hvx = H[0] * V0, hvy = H[1] * V0, hvz = H[2] * V0;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3, x = P[i3], y = P[i3 + 1], z = P[i3 + 2], vx = V[i3], vy = V[i3 + 1], vz = V[i3 + 2];
      let ax = 0, ay = 0, az = 0;
      // the seven nearest: match their heading, keep a little apart, stay with them
      const nb = NBC[i];
      if (nb) {
        let mvx = 0, mvy = 0, mvz = 0, mx = 0, my = 0, mz = 0, amax = 0;
        for (let k = 0; k < nb; k++) {
          const j = NB[i * KN + k], j3 = j * 3, ex = x - P[j3], ey = y - P[j3 + 1], ez = z - P[j3 + 2], d2 = ex * ex + ey * ey + ez * ez + 1e-4;
          mvx += V[j3]; mvy += V[j3 + 1]; mvz += V[j3 + 2]; mx += P[j3]; my += P[j3 + 1]; mz += P[j3 + 2];
          if (d2 < 1.8) { const f = 2.6 * (1.8 - d2) / d2; ax += ex * f; ay += ey * f; az += ez * f; }
          if (AL[j] > amax) amax = AL[j];
        }
        const ia = 1 / nb, al = 1 + 2 * AL[i];
        ax += (mvx * ia - vx) * 2.2 * al; ay += (mvy * ia - vy) * 2.2 * al; az += (mvz * ia - vz) * 2.2 * al;
        ax += (mx * ia - x) * 1.0; ay += (my * ia - y) * 1.0; az += (mz * ia - z) * 1.0;
        // alarm passes from neighbour to neighbour, a little weaker each time, at the pace of a turn
        const tgt = Math.max(AL[i] * Math.exp(-dt * 0.9), amax * 0.93);
        AL2[i] = AL[i] + (tgt - AL[i]) * Math.min(1, dt * 14);
      } else AL2[i] = AL[i] * Math.exp(-dt * 0.9);
      // the roost and the whim; and a few birds lean towards a satellite instead (the lean changing slowly)
      const w = (GR[i] + t * 0.013) % 1, k = w < 0.8 ? 0 : w < 0.9 ? 1 : 2, rk = RT[k];
      ax += rpx * rpf + (rk[0] - RT[0][0]) * 0.3 + (hvx - vx) * kh; ay += rpy * rpf + (rk[1] - RT[0][1]) * 0.3 + (hvy - vy) * kh; az += rpz * rpf + (rk[2] - RT[0][2]) * 0.3 + (hvz - vz) * kh;
      // and the flock as a whole holds together (and goes where the leading one is)
      ax += (gcx - x) * 0.28 + lx; ay += (gcy - y) * 0.28 + ly; az += (gcz - z) * 0.28 + lz;
      // keep round the viewer: not too far, not too close, not too low
      const ox = x - ME.c[0], oz = z - ME.c[1], od = Math.hypot(ox, oz) + 1e-3;
      if (od > EDGE) { const f = (od - EDGE) * 1.2 / od; ax -= ox * f; az -= oz * f; }
      if (y < 3.5) ay += (3.5 - y) * 6; if (y > 34) ay -= (y - 34) * 2;
      // the viewer's head and hands: give them a wide berth
      const qx = x - hx, qy = y - hy, qz = z - hz, qd = Math.hypot(qx, qy, qz) + 1e-3;
      if (qd < 2.6) { const f = 40 * (2.6 - qd) / (2.6 * qd); ax += qx * f; ay += qy * f + (2.6 - qd) * 5; az += qz * f; }
      for (const hd of ME.hands) { const ux = x - hd[0], uy = y - hd[1], uz = z - hd[2], ud = Math.hypot(ux, uy, uz) + 1e-3; if (ud < 2.2) { const f = 30 * (2.2 - ud) / (2.2 * ud); ax += ux * f; ay += uy * f; az += uz * f; } }
      // the falcon: those it nears flee, and raise the alarm
      if (FAL.on) {
        const fx = x - FAL.p[0], fy = y - FAL.p[1], fz = z - FAL.p[2], fd = Math.hypot(fx, fy, fz) + 1e-3;
        if (fd < 8) { const f = 40 * (8 - fd) / (8 * fd); ax += fx * f; ay += fy * f; az += fz * f; AL2[i] = Math.max(AL2[i], 1 - fd / 8 * 0.5); }
      }
      // speed: back towards cruising, faster when alarmed
      const sp = Math.hypot(vx, vy, vz) + 1e-3, want = V0 * (1 + 0.35 * AL[i]);
      ax += vx / sp * (want - sp) * 1.5; ay += vy / sp * (want - sp) * 1.5 - vy * 0.6; az += vz / sp * (want - sp) * 1.5;
      ACC[i3] = ax; ACC[i3 + 1] = ay; ACC[i3 + 2] = az;
    }
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      let ax = ACC[i3], ay = ACC[i3 + 1], az = ACC[i3 + 2];
      const al = Math.hypot(ax, ay, az), lim = 60 + 80 * AL2[i];
      if (al > lim) { ax *= lim / al; ay *= lim / al; az *= lim / al; }
      const vx = V[i3] + ax * dt, vy = V[i3 + 1] + ay * dt, vz = V[i3 + 2] + az * dt, sp = Math.hypot(vx, vy, vz), s = sp > 16 ? 16 / sp : sp < 5 ? 5 / sp : 1;
      // bank into turns (the sideways part of the acceleration), and roll hard when alarmed
      const fx = vx / sp, fz = vz / sp, side = (ax * -fz + az * fx) / 9.8;
      const roll = clamp(-side * 0.7, -1.2, 1.2) + AL2[i] * 0.95;   // alarmed birds all roll the same way: a dark band
      BK[i] += (roll - BK[i]) * Math.min(1, dt * 6);
      V[i3] = vx * s; V[i3 + 1] = vy * s; V[i3 + 2] = vz * s;
      P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
      AL[i] = AL2[i];
    }
    centre();
    // the falcon: in fast from afar, one stoop straight through the thick of the flock, then up and away
    if (FAL.on) {
      FAL.t += dt;
      let tx, ty, tz;
      const hunting = !FAL.pass && FAL.t < 6, through = FAL.pass && FAL.t < FAL.pass + 1.2;
      if (hunting) {   // home on the flock's main body (or where it was sent)
        tx = CEN[0]; ty = CEN[1]; tz = CEN[2];
        if (FAL.aim && FAL.t < 1.5) { tx = FAL.aim[0]; ty = FAL.aim[1]; tz = FAL.aim[2]; }
        if (Math.hypot(CEN[0] - FAL.p[0], CEN[1] - FAL.p[1], CEN[2] - FAL.p[2]) < 4) FAL.pass = FAL.t;
      } else if (through) { tx = FAL.p[0] + FAL.v[0]; ty = Math.max(FAL.p[1] + FAL.v[1], 6); tz = FAL.p[2] + FAL.v[2]; }
      else { tx = FAL.p[0] + FAL.v[0] * 3; ty = FAL.p[1] + 30; tz = FAL.p[2] + FAL.v[2] * 3; }
      const dx = tx - FAL.p[0], dy = ty - FAL.p[1], dz = tz - FAL.p[2], dl = Math.hypot(dx, dy, dz) + 1e-3, sp = hunting || through ? 26 : 18;
      for (let c = 0; c < 3; c++) { FAL.v[c] += ([dx, dy, dz][c] / dl * sp - FAL.v[c]) * Math.min(1, dt * 2.2); FAL.p[c] += FAL.v[c] * dt; }
      if (FAL.p[1] < 2) { FAL.p[1] = 2; FAL.v[1] = Math.max(FAL.v[1], 0); }   // never into the ground
      if (FAL.t > 10) { FAL.on = false; FAL.aim = null; }
    }
  }
  function launch(aim) {
    const a = R() * TAU, from = aim ? Math.atan2(aim[2] - ME.c[1], aim[0] - ME.c[0]) + Math.PI * (0.7 + R() * 0.6) : a;
    startFalcon({ p: [ME.c[0] + Math.cos(from) * 70, 30 + R() * 15, ME.c[1] + Math.sin(from) * 70], v: [-Math.cos(from) * 20, -4, -Math.sin(from) * 20], aim: aim || null });
    if (set.onLaunch) set.onLaunch({ p: FAL.p.slice(), v: FAL.v.slice(), aim: FAL.aim });   // in a shared room: the others' falcon too
  }
  // a falcon from where it starts (p, v) and where it was sent (aim, or null: the flock): launched here, or by another
  // device in a shared room (then exactly the same falcon)
  function startFalcon(f) {
    FAL.p = f.p.slice(); FAL.v = f.v.slice(); FAL.on = true; FAL.t = 0; FAL.pass = 0; FAL.aim = f.aim ? f.aim.slice() : null;
  }

  // drawing: one instanced batch of birds; a body and two pointed wings that flap and glide, banking with the bird
  function birdGeo(span, len) {
    // x right, y up, z forward; aW: 0 body, else the wing (sign the side, size how far out)
    const w = span / 2, L = len;
    const V3 = [
      [0, 0, 0.55 * L, 0], [0.07 * L, 0, 0.05 * L, 0], [-0.07 * L, 0, 0.05 * L, 0], [0, 0.06 * L, 0.1 * L, 0], [0, -0.05 * L, 0.05 * L, 0], [0, 0, -0.35 * L, 0],   // body
      [-0.13 * L, 0.0, -0.5 * L, 0], [0.13 * L, 0.0, -0.5 * L, 0],                                                                                         // a short, square tail
      [0.05 * L, 0, 0.24 * L, 0.25], [0.05 * L, 0, -0.2 * L, 0.25], [w * 0.5, 0, 0.1 * L, 0.6], [w, 0, -0.28 * L, 1],                                // right wing: broad, triangular
      [-0.05 * L, 0, 0.24 * L, -0.25], [-0.05 * L, 0, -0.2 * L, -0.25], [-w * 0.5, 0, 0.1 * L, -0.6], [-w, 0, -0.28 * L, -1],                         // left wing
    ];
    const T = [0, 1, 3, 0, 3, 2, 0, 4, 1, 0, 2, 4, 1, 5, 3, 3, 5, 2, 1, 4, 5, 2, 5, 4, 5, 6, 7,
      8, 9, 10, 9, 11, 10, 12, 14, 13, 13, 14, 15];
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V3.flatMap(v => v.slice(0, 3))), 3));
    g.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(V3.map(v => v[3])), 1));
    g.setIndex(T);
    return g;
  }
  const birdMat = (flapHz, sheen) => mat({
    uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, U), transparent: true, side: THREE.DoubleSide,
    vertexShader: `attribute float aW; attribute vec3 iP, iV; attribute vec3 iB;
uniform float uTime, uLag; varying vec3 vW; varying float vSh, vRim;
void main() {
  vec3 f = normalize(iV + vec3(0.0, 1e-4, 0.0));
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)) + vec3(1e-5, 0.0, 0.0)), u = cross(r, f);
  float b = iB.x; vec3 r2 = r * cos(b) + u * sin(b), u2 = cross(r2, f);
  // flap and glide: fast beats, now and then a glide with the wings held out; faster when alarmed
  float glide = smoothstep(0.25, 0.75, sin(uTime * 0.9 + iB.z * 3.1));
  float ph = uTime * ${flapHz.toFixed(2)} * (1.0 + 0.5 * iB.y) + iB.z;
  float flap = sin(ph) * (1.0 - 0.85 * glide) - 0.12 * glide;
  vec3 p = position; float s = abs(aW);
  p.y += flap * 0.5 * s * abs(p.x) / max(s, 1e-3) * step(0.01, s);
  p.x *= 1.0 - 0.18 * flap * flap * step(0.5, s);
  vec3 w = iP + iV * uLag + r2 * p.x + u2 * p.y + f * p.z;
  vW = (modelMatrix * vec4(w, 1.0)).xyz;
  vec3 toE = normalize(cameraPosition - vW);
  vSh = abs(dot(u2, toE));          // how much of its wing area faces you (banking shows the dark side)
  vRim = 1.0 - vSh;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`,
    fragmentShader: SKY + `uniform float uA; varying vec3 vW; varying float vSh, vRim;
void main() {
  vec3 d = normalize(vW - cameraPosition); float dist = length(vW - cameraPosition);
  vec3 c = mix(vec3(0.045, 0.04, 0.05), vec3(0.015, 0.012, 0.02), vSh);
  c += ${sheen} * vRim * 0.35 + skyCol(reflect(d, vec3(0.0, 1.0, 0.0))) * 0.05;
  c = mix(c, skyCol(d) * 0.9, 1.0 - exp(-dist * 0.004));   // further birds pale into the sky
  gl_FragColor = vec4(c, uA);
}`,
  });
  const bg = birdGeo(0.4, 0.22), iB = new Float32Array(MAXN * 3);
  const aP = new THREE.InstancedBufferAttribute(P, 3), aV = new THREE.InstancedBufferAttribute(V, 3), aB = new THREE.InstancedBufferAttribute(iB, 3);
  for (const a of [aP, aV, aB]) a.setUsage(THREE.DynamicDrawUsage);
  bg.setAttribute('iP', aP); bg.setAttribute('iV', aV); bg.setAttribute('iB', aB);
  const birds = new THREE.Mesh(bg, birdMat(7.5, 'vec3(0.16, 0.12, 0.22)'));
  birds.frustumCulled = false; birds.renderOrder = 2; set.group.add(birds);
  // the falcon: one larger bird, longer pointed wings, slower deeper beats
  const fg = birdGeo(1.0, 0.42), fP = new THREE.InstancedBufferAttribute(new Float32Array(3), 3), fV = new THREE.InstancedBufferAttribute(new Float32Array(3), 3), fB = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
  fg.setAttribute('iP', fP); fg.setAttribute('iV', fV); fg.setAttribute('iB', fB); fg.instanceCount = 1;
  const falcon = new THREE.Mesh(fg, birdMat(4.2, 'vec3(0.2, 0.17, 0.14)'));
  falcon.frustumCulled = false; falcon.renderOrder = 2; set.group.add(falcon);
  // the network: each bird to the seven it follows
  const lg = K.linesGeo(MAXN * KN), lm = K.lines(set, { additive: true }), net = new THREE.LineSegments(lg, lm);
  net.frustumCulled = false; net.renderOrder = 3; set.group.add(net);
  for (let i = 0; i < MAXN * KN * 2; i++) lg.attributes.aCol.array.set([0.35, 0.85, 1.0], i * 3);

  function draw(S) {
    for (let i = 0; i < N; i++) { iB[i * 3] = BK[i]; iB[i * 3 + 1] = AL[i]; iB[i * 3 + 2] = PH[i]; }
    bg.instanceCount = N;
    aP.needsUpdate = aV.needsUpdate = aB.needsUpdate = true;
    falcon.visible = FAL.on;
    if (FAL.on) { fP.array.set(FAL.p); fV.array.set(FAL.v); fB.array.set([0, 0, 1.3]); fP.needsUpdate = fV.needsUpdate = fB.needsUpdate = true; }
    const la = clamp(S.flock_links, 0, 1);
    net.visible = la > 0.01;
    if (net.visible) {
      const pa = lg.attributes.position.array, aa = lg.attributes.aA.array, hx = ME.head[0], hy = ME.head[1], hz = ME.head[2];
      let n = 0;
      for (let i = 0; i < N; i++) {
        const i3 = i * 3, dd = Math.hypot(P[i3] - hx, P[i3 + 1] - hy, P[i3 + 2] - hz), a = la * 0.55 * clamp(1.4 - dd / 40, 0.15, 1);
        for (let k = 0; k < NBC[i]; k++) {
          const j3 = NB[i * KN + k] * 3;
          pa[n * 6] = P[i3]; pa[n * 6 + 1] = P[i3 + 1]; pa[n * 6 + 2] = P[i3 + 2];
          pa[n * 6 + 3] = P[j3]; pa[n * 6 + 4] = P[j3 + 1]; pa[n * 6 + 5] = P[j3 + 2];
          aa[n * 2] = aa[n * 2 + 1] = a; n++;
        }
      }
      lg.setDrawRange(0, n * 2);
      lg.attributes.position.needsUpdate = true; lg.attributes.aA.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- params, update, exports
  // the middle of the flock's main body: a few steps of mean shift (the birds within 9 m, from where the body was
  // last), so a flock split by the falcon is not looked for in the empty sky between its parts
  function middle() { let x = 0, y = 0, z = 0; for (let i = 0; i < N; i++) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; } return [x / N, y / N, z / N]; }
  function centre() {
    let c = CEN;
    for (let it = 0; it < 2; it++) {
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (let i = 0; i < N; i++) {
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        if ((x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2 < 81) { sx += x; sy += y; sz += z; n++; }
      }
      c = n < N * 0.15 ? middle() : [sx / n, sy / n, sz / n];   // lost: start again from the middle of all
    }
    CEN[0] = c[0]; CEN[1] = c[1]; CEN[2] = c[2];
  }
  const params = { flock_a: 1, flock_birds: 200, flock_links: 0, flock_sky: 1, flock_falcon: 1, flock_hunt: 0 };
  let tLast = null, hunts = 0, tSim = 0, acc = 0;
  const SIM = 1 / 30;   // the flock moves in steps of a thirtieth of a second; between them the birds glide on (uLag)
  function update(S, t, dt) {
    const sky = U.uSky.value = clamp(S.flock_sky, 0, 1);
    for (const m of ENV) m.visible = sky > 0.003;
    // without the sky (passthrough) the flock flies in your room, at a third of life size
    set.group.scale.setScalar(sky > 0.5 ? 1 : 0.3);
    // more or fewer birds: new ones join beside a bird already flying
    const want = clamp(Math.round(S.flock_birds), 50, MAXN);
    if (want > N) for (let i = N; i < want; i++) { const j = Math.floor(R() * N) * 3; spawn(i, [P[j], P[j + 1], P[j + 2]]); }
    N = want;
    // the story (or a button) sends a falcon each time flock_hunt passes a whole number
    const h = Math.floor(S.flock_hunt + 1e-6);
    if (h > hunts && !FAL.on && !FOL) launch(null);   // following: the leading device sends its falcons
    hunts = h;
    let d = dt === undefined ? (tLast === null ? 0 : t - tLast) : dt;
    tLast = t;
    d = clamp(d, 0, 0.1);
    // now and then a falcon comes on its own
    if (S.flock_falcon > 0.5 && !FAL.on && !FOL) { FAL.next -= d; if (FAL.next < 0) { launch(null); FAL.next = 40 + R() * 40; } }
    acc = Math.min(acc + d, 0.2);
    let stepped = false;
    while (acc >= SIM) { acc -= SIM; tSim += SIM; step(SIM, tSim + tOff, S); stepped = true; }
    if (stepped) draw(S);
    U.uLag.value = acc;
  }
  // warm up, so the flock is already in the air when the scene first shows; then move it to its roost, in front
  for (let k = 0; k < 180; k++) { tSim += SIM; step(SIM, tSim, params); }
  {
    const c = middle();
    roost(0, tSim, RT[0]);
    for (let i = 0; i < MAXN; i++) { P[i * 3] += RT[0][0] - c[0]; P[i * 3 + 1] += RT[0][1] - c[1]; P[i * 3 + 2] += RT[0][2] - c[2]; }
    CEN[0] = RT[0][0]; CEN[1] = RT[0][1]; CEN[2] = RT[0][2]; centre();
  }
  draw(params);

  const anchors = { flock: () => [CEN[0], CEN[1] + 3, CEN[2]],   // 3 m above the body: where the camera aims
    falcon: () => (FAL.on ? [FAL.p[0], FAL.p[1] + 1.5, FAL.p[2]] : [0, -100, 0]) };
  const labels = [
    { text: ['Falcon', ''], at: 'falcon', cls: 'amb', alpha: () => (FAL.on && FAL.t < 6 ? 1 : 0) },
  ];
  // views: [az, el, dist, tx, ty, tz]. Among them: standing in the field, looking a little up (the target is just in
  // front of your eyes, so the camera stands where you do); from afar: the whole flock round the spot you stood on
  const cam = {
    default: [0, -26, 0.25, 0, 1.6, 0],
    up: [30, -48, 0.25, 0, 1.6, 0],
    afar: [20, 6, 17, 0, 9, -4],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['default', 'Follow the flock'], ['free', 'Look around'], ['afar', 'From afar']] },
    { key: 'birds', label: 'Birds', options: [['200', '200'], ['100', '100'], ['400', '400']] },
    { key: 'links', label: 'Network', options: [['off', 'Off'], ['on', 'Who follows whom']] },
    { key: 'falcon', label: 'Falcon', options: [['some', 'Now and then'], ['off', 'Off']] },
  ];
  function explore(c) {
    return { flock_birds: +c.birds || 200, flock_links: c.links === 'on' ? 1 : 0, flock_falcon: c.falcon === 'off' ? 0 : 1 };
  }
  // the engine tells the flock where you are (head and hands, in this set's frame), and sends a falcon where you point.
  // spot: at a station in a shared room the flock roosts round the station's spot (this frame's origin), the same
  // for everyone there, not round each viewer
  function see(head, hands, spot) {
    ME.head = head; ME.hands = hands || [];
    const cx = spot ? 0 : head[0], cz = spot ? 0 : head[2];
    ME.c[0] += (cx - ME.c[0]) * 0.02; ME.c[1] += (cz - ME.c[1]) * 0.02;
  }
  // shared rooms: this flock's flight (its time, middle and velocity), and another's to follow ({ t, m, v } as of
  // now, or null: this one leads)
  function flight() {
    const m = middle(); let x = 0, y = 0, z = 0;
    for (let i = 0; i < N; i++) { x += V[i * 3]; y += V[i * 3 + 1]; z += V[i * 3 + 2]; }
    return { t: tSim + tOff, m, v: [x / N, y / N, z / N] };
  }
  function follow(o) {
    FOL = o ? { m: o.m, v: o.v, t0: tSim } : null;
    if (!o) return;
    const d = o.t - (tSim + tOff);
    tOff += Math.abs(d) > 2 ? d : d * 0.05;   // another leader's time at once, a small drift eased away
  }
  function scatter(dir) {
    if (FAL.on) return false;
    launch(dir ? [ME.head[0] + dir[0] * 20, Math.max(6, ME.head[1] + dir[1] * 20), ME.head[2] + dir[2] * 20] : null);
    return true;
  }
  return Object.assign(set, { params, update, anchors, labels, cam, controls, explore, see, scatter, falcon: startFalcon, flight, follow,
    birds: () => N, falconOn: () => FAL.on, following: () => !!FOL, state: () => ({ P, V, AL, N, NB, NBC, me: ME, falcon: FAL }) });
};
