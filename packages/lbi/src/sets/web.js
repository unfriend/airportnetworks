// web: networks are everywhere (slides 6-7). Two looks in one set:
// 1. the internet: a glowing, tree-like network grown from a few giant hubs (after the Opte Project maps),
// 2. a dark globe of city lights joined by friendship ties (after Paul Butler's Facebook map, December 2010);
//    the bright lights sit at the 3,214 airports of the airports story; the faint lights and the ties are illustrative.
SETS.web = function (K) {
  const { THREE } = K, V = K.v3, TAU = Math.PI * 2, D2R = Math.PI / 180;
  const set = K.newSet('web');
  const live = { spin: 0, scale: 1 };   // the globe's turn and size as last drawn, for the anchors and labels
  // GLSL: 0 where a sphere of radius r (model units) round the model's origin hides p from the camera, else 1.
  // The globe hides its far side with this rather than with depth alone, so it stays hidden at any fade.
  // Soft at the horizon; nothing is hidden while the camera is inside the sphere.
  const HORIZON = `
float horizon(vec3 p, float r) {
  vec3 w = (modelMatrix * vec4(p, 1.0)).xyz, c = modelMatrix[3].xyz, d = w - cameraPosition;
  float R = r * length(modelMatrix[0].xyz), s = clamp(dot(c - cameraPosition, d) / max(dot(d, d), 1e-8), 0.0, 1.0);
  return max(smoothstep(R * 0.985, R, length(cameraPosition + d * s - c)), step(length(cameraPosition - c), R));
}`;

  // ================================================================ the internet
  // A seeded branching process in which every branch carries a share of the nodes still to place (its mass).
  // Hubs split their mass over many spokes, heavy-tailed: most spokes end in a few leaves close by (the starburst),
  // a few carry hundreds of nodes far out. Each branch hops out (further the more it carries; big ones sometimes as
  // a long, gently curving filament bent by a smooth flow field, so neighbours curve together) and splits again into
  // forks, stars, dandelion tufts and brushes of leaves. Colour follows how much of the tree hangs below a node.
  const NET = (() => {
    const r = K.rng(1969), MAX = 17000;
    const P = new Float32Array(MAX * 3), par = new Int32Array(MAX).fill(-1);
    const hue = new Float32Array(MAX), boost = new Float32Array(MAX);
    const E = [];   // node pairs; tree edges [parent, child], then backbone ends and cross links
    let n = 0, cross0 = 0;
    const at = i => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
    function add3(x, y, z, from, h) {
      if (n >= MAX) return -1;
      P[3 * n] = x; P[3 * n + 1] = y; P[3 * n + 2] = z;
      par[n] = from; hue[n] = h;
      if (from >= 0) E.push(from, n);
      return n++;
    }
    const add = (p, from, h) => add3(p[0], p[1], p[2], from, h);
    const norm = (x, y, z) => { const l = Math.sqrt(x * x + y * y + z * z) || 1; return [x / l, y / l, z / l]; };
    // an irregular, lobed envelope keeps it inside radius ~1.1 without a hard spherical crust
    const lobes = new Float32Array(36);   // 9 x [direction, strength]
    for (let i = 0; i < 9; i++) { lobes.set(K.unit(r), 4 * i); lobes[4 * i + 3] = 0.08 + 0.24 * r(); }
    function inside(x, y, z) {
      const l = Math.sqrt(x * x + y * y + z * z) || 1e-6;
      let R = 0.74;
      for (let i = 0; i < 36; i += 4) {
        const c = (x * lobes[i] + y * lobes[i + 1] + z * lobes[i + 2]) / l;
        if (c > 0) R += lobes[i + 3] * c * c * c;
      }
      return Math.sqrt(x * x + y * y / 0.6724 + z * z / 0.81) < Math.min(R, 1.06);
    }
    const flow = p => [Math.sin(3.1 * p[1] + 2.3 * p[2] + 1.3), Math.sin(2.7 * p[2] + 1.7 * p[0] + 2.1),
      Math.sin(2.9 * p[0] + 2.2 * p[1] + 0.7)];
    const steer = (d, p, k, j) => {
      const f = flow(p);
      return norm(d[0] + k * f[0] + j * K.gauss(r), d[1] + k * f[1] + j * K.gauss(r), d[2] + k * f[2] + j * K.gauss(r));
    };
    // a direction at angle a from the unit vector d (random azimuth)
    function turn(d, a) {
      // u, w: two unit vectors at right angles to d
      const up = Math.abs(d[1]) < 0.9, ux0 = up ? -d[2] : 0, uy0 = up ? 0 : d[2], uz0 = up ? d[0] : -d[1];
      const ul = Math.sqrt(ux0 * ux0 + uy0 * uy0 + uz0 * uz0) || 1, ux = ux0 / ul, uy = uy0 / ul, uz = uz0 / ul;
      const wx = d[1] * uz - d[2] * uy, wy = d[2] * ux - d[0] * uz, wz = d[0] * uy - d[1] * ux;
      const f = r() * TAU, c = Math.cos(a), s = Math.sin(a), cf = Math.cos(f) * s, sf = Math.sin(f) * s;
      return norm(d[0] * c + ux * cf + wx * sf, d[1] * c + uy * cf + wy * sf, d[2] * c + uz * cf + wz * sf);
    }
    // a point len along d from p, shortened at the edge of the envelope (null if even a short hop leaves it)
    function reach(p, d, len) {
      for (let s = len; s > 0.12 * len; s *= 0.72) {
        const x = p[0] + d[0] * s, y = p[1] + d[1] * s, z = p[2] + d[2] * s;
        if (inside(x, y, z)) return [x, y, z];
      }
      return null;
    }
    // split m over k children, heavy-tailed (a few take most)
    function share(m, k, ex) {
      const w = [];
      let sum = 0;
      for (let i = 0; i < k; i++) { const x = Math.pow(r(), ex) + 0.002; w.push(x); sum += x; }
      const out = w.map(x => Math.floor(m * x / sum));
      let left = m - out.reduce((a, b) => a + b, 0);
      for (let i = 0; left > 0; i = (i + 1) % k, left--) out[i]++;
      return out.filter(x => x > 0);
    }
    // the hop length for a branch carrying m nodes
    const hop = m => (0.012 + 0.034 * Math.pow(m, 0.42)) * (0.6 + 0.8 * r());
    const Q = [];
    const grow = (from, d, m, h) => Q.push([from, d, m, h]);
    // m leaves round node 'from', within 'spread' radians of d, l0..l1 long
    function fan(from, d, h, m, spread, l0, l1) {
      const p = at(from);
      for (let k = 0; k < m; k++) {
        const u = turn(d, spread * Math.sqrt(r())), l = l0 + (l1 - l0) * r();
        const x = p[0] + u[0] * l, y = p[1] + u[1] * l, z = p[2] + u[2] * l;
        if (inside(x, y, z)) add3(x, y, z, from, h);
      }
    }
    // the hubs: two giants, four big ones and four smaller ones [x, y, z, mass, spokes]
    const HUBS = [
      [0.36, -0.02, 0.1, 5000, 270], [-0.46, 0.16, -0.08, 3600, 200], [-0.1, -0.44, 0.4, 1400, 74],
      [0.12, 0.46, -0.4, 1300, 66], [-0.34, -0.3, -0.48, 1000, 52], [0.66, 0.32, -0.26, 900, 46],
      [0.04, 0.3, 0.6, 800, 42], [0.5, -0.4, -0.42, 750, 38], [-0.8, -0.06, 0.3, 700, 36], [-0.14, 0.58, 0.12, 650, 32]];
    const hub = HUBS.map(([x, y, z]) => add3(x, y, z, -1, 0));
    hub.forEach(i => { boost[i] = 1; });
    // backbone between hubs: bundles of gently bowed strands [hub, hub, strands]
    const BACK = [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 3, 1], [1, 4, 1], [0, 5, 1], [6, 0, 1], [7, 0, 1], [8, 1, 1], [9, 1, 1]];
    for (const [a, b, m] of BACK) {
      const A = at(hub[a]), B = at(hub[b]), dir = V.norm(V.sub(B, A)), L = V.dist(A, B), steps = Math.max(3, Math.round(L / 0.09));
      for (let s = 0; s < m; s++) {
        const bow = V.mul(turn(dir, Math.PI / 2), (0.03 + 0.12 * r()) * L), h = (r() - 0.5) * 0.2;
        let last = hub[a];
        for (let k = 1; k < steps; k++) {
          const f = k / steps, q = V.add(V.lerp(A, B, f), V.mul(bow, Math.sin(Math.PI * f)));
          last = add3(q[0] + 0.008 * K.gauss(r), q[1] + 0.008 * K.gauss(r), q[2] + 0.008 * K.gauss(r), last, h);
          boost[last] = 0.5;
          if (r() < 0.3) grow(last, turn(dir, 1.1 + 0.5 * r()), 4 + Math.floor(Math.pow(r(), 3) * 60), h);
        }
        E.push(last, hub[b]);
      }
    }
    // spokes from every hub, mostly outwards; each hub's region has its own tint (the first giant burns yellow-white)
    const TINT = [0.12, 0.03, -0.05, -0.08, -0.1, -0.03, -0.1, -0.06, -0.12, -0.07];
    HUBS.forEach(([x, y, z, mass, k], hi) => {
      const out = V.norm([x, y, z]), o = 0.25 + 0.1 * hi;
      for (const m of share(mass, k, 3.2)) {
        const u = K.unit(r);
        grow(hub[hi], norm(u[0] + out[0] * o, u[1] + out[1] * o, u[2] + out[2] * o), m, TINT[hi] + (r() - 0.5) * 0.26);
      }
    });
    let tuftAt = -1, tuftN = 0;
    for (let qi = 0; qi < Q.length && n < MAX; qi++) {
      const [from, d0, m0, h] = Q[qi];
      let p = at(from), d = d0, last = from, m = m0;
      // the hop: one straight link, or for big branches now and then a long curving filament of several nodes
      const fil = m > 14 && r() < 0.4 ? 2 + Math.floor(r() * 5) : 1, sl = hop(m) * (fil > 1 ? 1.8 : 1) / fil;
      for (let s = 0; s < fil && m > 0; s++) {
        if (fil > 1) d = steer(d, p, 0.3, 0.08);
        let q = reach(p, d, sl);
        if (!q) {   // bend back in at the edge
          const o = norm(p[0], p[1], p[2]);
          d = norm(d[0] - 1.3 * o[0], d[1] - 1.3 * o[1], d[2] - 1.3 * o[2]);
          q = reach(p, d, sl);
        }
        if (!q) break;
        const j = add(q, last, h);
        if (j < 0) break;
        last = j; p = q; m--;
        // side branches along a filament (feathers)
        if (s < fil - 1 && m > 8 && r() < 0.6) {
          const k = Math.min(m - 4, 1 + Math.floor(r() * r() * m * 0.3));
          grow(last, turn(d, 0.9 + 0.5 * r()), k, h + (r() - 0.5) * 0.05);
          m -= k;
        }
      }
      if (last === from || m <= 0) continue;
      if (m <= 8) fan(last, d, h, m, 1.25, 0.008, 0.026);   // a brush of leaves
      else if (m < 110 && r() < 0.15) {
        // a dandelion: a tight ball of short spokes
        const c = at(last);
        for (let k = 0; k < m; k++) {
          const u = K.unit(r), v = norm(u[0] + 0.3 * d[0], u[1] + 0.3 * d[1], u[2] + 0.3 * d[2]), l = 0.012 + 0.03 * Math.sqrt(r());
          const x = c[0] + v[0] * l, y = c[1] + v[1] * l, z = c[2] + v[2] * l;
          if (inside(x, y, z)) add3(x, y, z, last, h + 0.04);
        }
        if (m > tuftN) { tuftN = m; tuftAt = last; }
      } else {
        // a fork or, now and then, a star
        const k = Math.min(m, 2 + Math.floor(Math.pow(r(), 3) * 18)), spread = 0.22 + 0.035 * k;
        for (const mi of share(m, k, 2.2)) grow(last, turn(d, spread * Math.sqrt(r())), mi, h + (r() - 0.5) * 0.05);
        if (k > 9) boost[last] = 0.6;
      }
    }
    // a few long cross links between routers in different branches (the internet is not quite a tree)
    cross0 = E.length / 2;
    for (let k = 0, tries = 0; k < 420 && tries < 20000; tries++) {
      const a = Math.floor(r() * n), b = Math.floor(r() * n);
      if (a === b || par[a] < 0 || par[b] < 0) continue;
      const L = V.dist(at(a), at(b));
      if (L < 0.18 || L > 0.95) continue;
      E.push(a, b); k++;
    }
    // how much hangs below each node (children are always created after their parent)
    const w = new Float32Array(n).fill(1);
    for (let i = n - 1; i >= 0; i--) if (par[i] >= 0) w[par[i]] += w[i];
    // growth time: distance from the node's hub along the tree (parents always come first; the giant starts first)
    const tau = new Float32Array(n);
    let tmax = 0;
    hub.forEach((i, k) => { tau[i] = k * 0.05; });
    for (let i = 0; i < n; i++) {
      const j = par[i];
      if (j >= 0) {
        const dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2];
        tau[i] = tau[j] + Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      if (tau[i] > tmax) tmax = tau[i];
    }
    return { n, P, E, cross0, par, hue, boost, w, tau, tmax, hub, tuftAt, at };
  })();

  // --------------------------------------------------------- internet: drawing
  const HOT = [[0, K.rgb('#6e0d06')], [0.14, K.rgb('#b8170a')], [0.32, K.rgb('#ff3812')], [0.52, K.rgb('#ff7a18')],
    [0.72, K.rgb('#ffbf35')], [0.88, K.rgb('#fff09a')], [1, [1, 1, 0.94]]];
  const LUT = new Float32Array(256 * 3);   // the colour ramp, tabulated
  for (let k = 0; k < 256; k++) LUT.set(K.ramp(HOT, k / 255), 3 * k);
  const hot = (out, o, x) => {
    const k = 3 * Math.round(K.clamp(x, 0, 1) * 255);
    out[o] = LUT[k]; out[o + 1] = LUT[k + 1]; out[o + 2] = LUT[k + 2];
  };
  const N = NET.n, NP = NET.P, netX = new Float32Array(N), netW = new Float32Array(N);   // 0 leaf .. 1 hub
  for (let i = 0; i < N; i++) {
    netW[i] = K.clamp(Math.log(NET.w[i]) / Math.log(1800), 0, 1);
    netX[i] = Math.max(NET.boost[i], K.clamp(netW[i] + NET.hue[i], 0, 1));
  }
  // growth time 0..1: part distance, part rank (so the amount on show grows evenly with web_net); rank by counting sort
  const netT = new Float32Array(N), bins = new Int32Array(4097), tq = 4095 / NET.tmax;
  for (let i = 0; i < N; i++) bins[1 + Math.floor(NET.tau[i] * tq)]++;
  for (let k = 1; k <= 4096; k++) bins[k] += bins[k - 1];
  for (let i = 0; i < N; i++) netT[i] = 0.4 * NET.tau[i] / NET.tmax + 0.6 * bins[Math.floor(NET.tau[i] * tq)] / N;
  // growth front; fade as the globe comes in; the globe's radius and how much of the network it hides
  const netU = { uF: { value: 1.06 }, uN: { value: 1 }, uR: { value: 0.1 }, uH: { value: 0 } };
  const ng = K.pointsGeo(N);
  {
    const rr = K.rng(5), col = ng.attributes.aCol.array, sz = ng.attributes.aSize.array, al = ng.attributes.aA.array;
    ng.attributes.position.array.set(NP.subarray(0, 3 * N));
    for (let i = 0; i < N; i++) {
      hot(col, 3 * i, netX[i] + (rr() - 0.5) * 0.06);
      sz[i] = 0.011 + 0.02 * Math.pow(netW[i], 2.6);
      al[i] = 0.6 + 0.35 * netX[i];
    }
    const HS = [0.13, 0.11, 0.05, 0.045, 0.04, 0.04, 0.035, 0.035, 0.03, 0.03];
    NET.hub.forEach((i, k) => { sz[i] = HS[k]; if (k < 2) col.set([1, 0.98, 0.9], 3 * i); else hot(col, 3 * i, 0.84); });
    ng.setAttribute('aT', new THREE.BufferAttribute(netT, 1));
  }
  const netPts = new THREE.Points(ng, K.points(set, {
    uniforms: netU, head: 'attribute float aT; uniform float uF, uN, uR, uH;' + HORIZON,
    vertex: `float on = step(aT, uF), fl = (1.0 - smoothstep(0.0, 0.06, uF - aT)) * on;
  vA *= on * uN; gl_PointSize *= 1.0 + 1.6 * fl; vC = mix(vC, vec3(1.0, 0.96, 0.85), fl * 0.8);
  if (uH > 0.001) vA *= 1.0 - uH * (1.0 - horizon(pos, uR));`,
  }));
  // links grow out from the end that is reached first; trunks carry slow pulses of traffic.
  // A cross link has the same time at both ends: it fades in whole once both of its routers are there.
  const NE = NET.E.length / 2, lg = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(NE * 6), oth = new Float32Array(NE * 6), col = new Float32Array(NE * 6);
    const al = new Float32Array(NE * 2), tt = new Float32Array(NE * 2), to = new Float32Array(NE * 2);
    const dd = new Float32Array(NE * 2), pu = new Float32Array(NE * 2);
    for (let k = 0; k < NE; k++) {
      const a = NET.E[2 * k], b = NET.E[2 * k + 1], cross = k >= NET.cross0, x = cross ? 0.4 * (netX[a] + netX[b]) : netX[b];
      for (let j = 0; j < 3; j++) { pos[6 * k + j] = oth[6 * k + 3 + j] = NP[3 * a + j]; pos[6 * k + 3 + j] = oth[6 * k + j] = NP[3 * b + j]; }
      hot(col, 6 * k, x); hot(col, 6 * k + 3, x);
      al[2 * k] = al[2 * k + 1] = cross ? 0.14 : 0.45 + 0.45 * x;
      if (cross) tt[2 * k] = tt[2 * k + 1] = to[2 * k] = to[2 * k + 1] = Math.max(netT[a], netT[b]);
      else { tt[2 * k] = netT[a]; tt[2 * k + 1] = netT[b]; to[2 * k] = netT[b]; to[2 * k + 1] = netT[a]; }
      dd[2 * k] = NET.tau[a]; dd[2 * k + 1] = NET.tau[b];
      pu[2 * k] = pu[2 * k + 1] = cross ? 0 : K.clamp((x - 0.42) / 0.4, 0, 1);
    }
    lg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); lg.setAttribute('aO', new THREE.BufferAttribute(oth, 3));
    lg.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); lg.setAttribute('aA', new THREE.BufferAttribute(al, 1));
    lg.setAttribute('aT', new THREE.BufferAttribute(tt, 1)); lg.setAttribute('aTO', new THREE.BufferAttribute(to, 1));
    lg.setAttribute('aD', new THREE.BufferAttribute(dd, 1)); lg.setAttribute('aP', new THREE.BufferAttribute(pu, 1));
  }
  const netLineMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, netU),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute vec3 aCol, aO; attribute float aA, aT, aTO, aD, aP;
uniform float uA, uF, uN, uR, uH;
varying vec3 vC; varying float vA, vD, vP;
${HORIZON}
void main() {
  float t0 = min(aT, aTO), t1 = max(aT, aTO), far = step(aTO, aT - 1e-6), whole = 1.0 - step(1e-6, t1 - t0);
  float f = clamp((uF - t0) / max(t1 - t0, 1e-4), 0.0, 1.0), tip = far * (1.0 - smoothstep(0.0, 0.05, uF - t1));
  vec3 pos = mix(position, mix(aO, position, f), far);
  vC = mix(aCol, vec3(1.0, 0.95, 0.8), tip * 0.7);
  vA = aA * uA * uN * step(t0, uF) * (1.0 + tip) * mix(1.0, smoothstep(t0, t0 + 0.03, uF), whole);
  if (uH > 0.001) vA *= 1.0 - uH * (1.0 - horizon(pos, uR));
  vD = aD; vP = aP;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`,
    fragmentShader: `
uniform float uTime;
varying vec3 vC; varying float vA, vD, vP;
void main() {
  if (vA < 0.004) discard;
  float pu = smoothstep(0.93, 1.0, fract(vD * 3.0 - uTime * 0.22)) * vP;
  gl_FragColor = vec4(vC + vec3(0.9, 0.75, 0.45) * pu, vA * (1.0 + 1.5 * pu));
}`,
  });
  set.mats.push(netLineMat);
  const netLines = new THREE.LineSegments(lg, netLineMat);
  const netGroup = new THREE.Group();
  netGroup.add(netLines, netPts);
  set.group.add(netGroup);

  // ================================================================ the globe
  const L0 = -12;   // the longitude that faces +z (the default camera) at spin 0
  const AIR = (s => {
    const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', v = k => AL.indexOf(s[k]) * 64 + AL.indexOf(s[k + 1]);
    const n = s.length / 4, lat = new Float32Array(n), lon = new Float32Array(n);
    for (let i = 0; i < n; i++) { lat[i] = (v(4 * i) - 900) / 10; lon[i] = (v(4 * i + 2) - 1800) / 10; }
    return { n, lat, lon };
  })(airports());
  const ll = (lat, lon) => {
    const a = lat * D2R, b = (lon - L0) * D2R;
    return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
  };
  const NC = AIR.n, U3 = new Float32Array(NC * 3);
  for (let i = 0; i < NC; i++) U3.set(ll(AIR.lat[i], AIR.lon[i]), 3 * i);
  // airports are sorted by number of routes: rank -> routes, by interpolating a few quantiles of the data
  const QR = [[0, 248], [3, 233], [10, 185], [20, 153], [40, 127], [70, 94], [100, 79], [150, 58], [200, 47], [300, 33], [450, 20],
    [600, 13], [800, 9], [1000, 6], [1300, 4], [1600, 3], [2000, 2], [2800, 1], [3213, 1]];
  const size = new Float32Array(NC);
  for (let i = 0, q = 1; i < NC; i++) {
    while (QR[q][0] < i) q++;
    const [r0, d0] = QR[q - 1], [r1, d1] = QR[q];
    size[i] = d0 + (d1 - d0) * (i - r0) / (r1 - r0);
  }
  // ties: everyone knows their nearest neighbours; bigger cities have more and longer ties; a few big pairs far apart
  // (kept in flat arrays: ends ta, tb, kind tk 0 local / 1 regional / 2 long, angle th in radians)
  const TIES = (() => {
    const r = K.rng(2010), CAP = 16000, ta = new Int32Array(CAP), tb = new Int32Array(CAP), tk = new Uint8Array(CAP), th = new Float32Array(CAP);
    let n = 0;
    const dot = (a, b) => U3[3 * a] * U3[3 * b] + U3[3 * a + 1] * U3[3 * b + 1] + U3[3 * a + 2] * U3[3 * b + 2];
    // the pairs already tied, in an open-addressing hash (key a * 4096 + b + 1 with a < b; 0 is empty)
    const HS = 1 << 15, hk = new Int32Array(HS);
    const tie = (a, b, kind) => {
      if (a === b || n >= CAP) return false;
      const key = (a < b ? a * 4096 + b : b * 4096 + a) + 1;
      let h = Math.imul(key, 0x9E3779B1) >>> 17;
      while (hk[h] !== 0) { if (hk[h] === key) return false; h = (h + 1) & (HS - 1); }
      hk[h] = key; ta[n] = a; tb[n] = b; tk[n] = kind; th[n] = Math.acos(K.clamp(dot(a, b), -1, 1)); n++;
      return true;
    };
    // nearest neighbours, found through a grid of cells over the unit sphere's bounding cube
    const G = 0.07, GN = 30, cx = v => Math.min(GN - 1, Math.floor((v + 1.05) / G));
    const head = new Int32Array(GN * GN * GN).fill(-1), next = new Int32Array(NC);
    for (let i = 0; i < NC; i++) {
      const c = (cx(U3[3 * i]) * GN + cx(U3[3 * i + 1])) * GN + cx(U3[3 * i + 2]);
      next[i] = head[c]; head[c] = i;
    }
    // the k best so far (largest dot products first)
    const bd = new Float32Array(8), bi = new Int32Array(8);
    const offer = (j, d, k) => {
      if (d <= bd[k - 1]) return;
      let m = k - 1;
      while (m > 0 && bd[m - 1] < d) { bd[m] = bd[m - 1]; bi[m] = bi[m - 1]; m--; }
      bd[m] = d; bi[m] = j;
    };
    const cos = x => Math.cos(x * D2R), c12 = cos(12), c25 = cos(25);
    for (let i = 0; i < NC; i++) {
      const k = i < 300 ? 7 : i < 1200 ? 5 : 4, x = U3[3 * i], y = U3[3 * i + 1], z = U3[3 * i + 2];
      const X = cx(x), Y = cx(y), Z = cx(z);
      // widen the search box until it holds the k nearest (a box of R cells holds everything within R * G)
      for (let R = 1; R <= 3; R++) {
        bd.fill(-2); bi.fill(-1);
        const a1 = Math.min(GN - 1, X + R), b1 = Math.min(GN - 1, Y + R), c1 = Math.min(GN - 1, Z + R);
        for (let a = Math.max(0, X - R); a <= a1; a++) {
          for (let b = Math.max(0, Y - R); b <= b1; b++) {
            for (let c = Math.max(0, Z - R); c <= c1; c++) {
              for (let j = head[(a * GN + b) * GN + c]; j >= 0; j = next[j]) {
                const d = x * U3[3 * j] + y * U3[3 * j + 1] + z * U3[3 * j + 2];
                if (d > bd[k - 1] && j !== i) offer(j, d, k);
              }
            }
          }
        }
        if (bd[k - 1] >= 1 - (R * G) * (R * G) / 2) break;
      }
      // a lonely city still gets a tie to its nearest neighbour, up to 25 degrees away
      if (bi[0] < 0) for (let j = 0; j < NC; j++) if (j !== i) offer(j, x * U3[3 * j] + y * U3[3 * j + 1] + z * U3[3 * j + 2], 1);
      for (let m = 0; m < k; m++) if (bi[m] >= 0 && bd[m] > (m === 0 ? c25 : c12)) tie(i, bi[m], 0);
    }
    // regional ties: bigger cities to others a few hundred to a few thousand kilometres away
    const c4 = cos(4), c26 = cos(26);
    for (let i = 0; i < 1400; i++) {
      const m = i < 150 ? 4 : i < 500 ? 2 : 1;
      for (let c = 0, tries = 0; c < m && tries < 40; tries++) {
        const j = Math.floor(Math.pow(r(), 1.6) * 2200), d = dot(i, j);
        if (d < c4 && d > c26 && tie(i, j, 1)) c++;
      }
    }
    // long ties between big cities, across oceans
    for (let c = 0, tries = 0; c < 650 && tries < 30000; tries++) {
      const a = Math.floor(Math.pow(r(), 2.2) * 700), b = Math.floor(Math.pow(r(), 2.2) * 700);
      if (dot(a, b) < c26 && tie(a, b, 2)) c++;
    }
    return { n, ta, tb, tk, th };
  })();
  // vertices of every tie: arcs above the surface, higher the longer they are; one shared vertex between segments
  const GT = (() => {
    const r = K.rng(77), NT = TIES.n, { ta, tb, tk, th } = TIES, plan = new Uint8Array(NT);
    let segs = 0;
    for (let k = 0; k < NT; k++) { plan[k] = K.clamp(Math.ceil(th[k] / (3.5 * D2R)), 1, 20); segs += plan[k]; }
    const nv = segs + NT, pos = new Float32Array(nv * 3), tt = new Float32Array(nv), ff = new Float32Array(nv), kk = new Float32Array(nv);
    const idx = new Uint32Array(segs * 2);
    let v = 0, o = 0, tmax = 0;
    for (let k = 0; k < NT; k++) {
      const m = plan[k], a = 3 * ta[k], b = 3 * tb[k], T = th[k], sn = Math.sin(T) || 1e-6, h = 0.004 + 0.2 * Math.pow(T / Math.PI, 1.1);
      // when it starts (regional ties after all the local ones, long ties last), how long it takes to draw out,
      // the glint's phase, which end it starts from
      const s0 = 0.72 * Math.pow(T / Math.PI, 0.55) + 0.1 * r() + (tk[k] === 1 ? 0.18 : 0);
      const dur = 0.05 + 0.3 * T / Math.PI, ph = r() * 10, rev = r() < 0.5;
      for (let s = 0; s <= m; s++, v++) {
        // along the great circle (slerp), lifted into an arc
        const f = s / m, R = 1.003 + h * Math.sin(Math.PI * f), g = rev ? 1 - f : f;
        const u = T < 1e-4 ? 1 - f : Math.sin((1 - f) * T) / sn * R, w = T < 1e-4 ? f : Math.sin(f * T) / sn * R;
        pos[3 * v] = U3[a] * u + U3[b] * w; pos[3 * v + 1] = U3[a + 1] * u + U3[b + 1] * w; pos[3 * v + 2] = U3[a + 2] * u + U3[b + 2] * w;
        tt[v] = s0 + dur * g; ff[v] = g * T * 2 + ph; kk[v] = tk[k];
        if (tt[v] > tmax) tmax = tt[v];
        if (s < m) { idx[o++] = v; idx[o++] = v + 1; }
      }
    }
    for (let i = 0; i < nv; i++) tt[i] /= tmax;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
    g.setAttribute('aF', new THREE.BufferAttribute(ff, 1)); g.setAttribute('aK', new THREE.BufferAttribute(kk, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return { g, segs };
  })();
  // city lights: the airports (bright, real positions), and faint illustrative lights round them:
  // suburbs round the big cities and towns along the shortest ties
  const LIGHTS = (() => {
    const r = K.rng(31), MAXL = 26000, g = K.pointsGeo(MAXL), T = new Float32Array(MAXL), H = new Float32Array(MAXL);
    const P = g.attributes.position.array, C = g.attributes.aCol.array, Sz = g.attributes.aSize.array, A = g.attributes.aA.array;
    let n = 0;
    // a light at (x, y, z) pushed out to radius R: colour c0..c2, size s, alpha a, switch-on time t, h 1 for the glow
    const put = (x, y, z, R, c0, c1, c2, s, a, t, h) => {
      if (n >= MAXL) return;
      const l = R / Math.sqrt(x * x + y * y + z * z);
      P[3 * n] = x * l; P[3 * n + 1] = y * l; P[3 * n + 2] = z * l;
      C[3 * n] = c0; C[3 * n + 1] = c1; C[3 * n + 2] = c2;
      Sz[n] = s; A[n] = a; T[n] = t; H[n] = h; n++;
    };
    for (let i = 0; i < NC; i++) {
      const s = size[i], x = Math.min(1, Math.log(1 + s) / Math.log(250)), ux = U3[3 * i], uy = U3[3 * i + 1], uz = U3[3 * i + 2];
      // the city: bigger, brighter and earlier the more routes it has
      const t0 = 0.25 + 0.45 * (1 - x) * r() + 0.15 * (1 - x);
      put(ux, uy, uz, 1.004, 0.55 + 0.45 * x, 0.7 + 0.3 * x, 1, 0.007 + 0.015 * x * x, 0.55 + 0.45 * x, t0, 0);
      // a faint blue glow that comes up with the ties: where friendships are dense, the map glows
      put(ux, uy, uz, 1.006, 0.14, 0.3, 1, 0.04 + 0.045 * x, 0.11 + 0.15 * x, 0.3 * r(), 1);
      // suburbs, within some tens of kilometres
      const m = Math.round(Math.pow(s, 0.75) * 0.65);
      for (let k = 0; k < m; k++) {
        const sd = (0.0022 + 0.00045 * Math.sqrt(s)) * (0.4 + r());
        const px = ux + sd * K.gauss(r), py = uy + sd * K.gauss(r), pz = uz + sd * K.gauss(r);
        put(px, py, pz, 1.004, 0.62, 0.75, 1, 0.005 + 0.004 * r(), 0.35 + 0.3 * r(), 0.35 + 0.55 * r(), 0);
      }
    }
    // towns along the shortest ties (up to 3 degrees), close to the line between the two cities
    for (let t = 0; t < TIES.n; t++) {
      const a = 3 * TIES.ta[t], b = 3 * TIES.tb[t], th = TIES.th[t];
      if (TIES.tk[t] !== 0 || th > 3 * D2R) continue;
      const m = Math.floor(th / (0.5 * D2R) * r()), sd = th * 0.04;
      for (let k = 0; k < m; k++) {
        const f = r(), e = 1 - f;
        const px = U3[a] * e + U3[b] * f + sd * K.gauss(r), py = U3[a + 1] * e + U3[b + 1] * f + sd * K.gauss(r);
        const pz = U3[a + 2] * e + U3[b + 2] * f + sd * K.gauss(r);
        put(px, py, pz, 1.004, 0.5, 0.65, 1, 0.0045 + 0.003 * r(), 0.3 + 0.3 * r(), 0.45 + 0.5 * r(), 0);
      }
    }
    g.setAttribute('aT', new THREE.BufferAttribute(T, 1)); g.setAttribute('aH', new THREE.BufferAttribute(H, 1));
    g.setDrawRange(0, n);
    return g;
  })();
  const globeU = { uG: { value: 1 }, uL: { value: 1 }, uF: { value: 1 } };
  const globe = new THREE.Group();
  set.group.add(globe);
  // the dark sea: drawn first; it writes depth only when nearly opaque, to hide other sets behind the globe
  // (its own far side and the network inside are hidden by horizon() in their shaders)
  const seaMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uG: globeU.uG },
    transparent: true, depthWrite: true,
    vertexShader: `varying vec3 vN, vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float uA, uG; varying vec3 vN, vW;
void main() {
  float f = 1.0 - max(dot(normalize(vN), normalize(cameraPosition - vW)), 0.0);
  gl_FragColor = vec4(mix(vec3(0.008, 0.016, 0.04), vec3(0.035, 0.075, 0.22), pow(f, 3.0)), uA * uG);
}`,
  });
  set.mats.push(seaMat);
  const sea = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), seaMat);
  sea.renderOrder = -2;
  // the atmosphere: front faces only, so nothing changes when the sea starts or stops writing depth
  const haloMat = K.rim(set, { color: '#3d6dff', a0: 0, a1: 0.34 });
  haloMat.side = THREE.FrontSide;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.03, 72, 48), haloMat);
  halo.renderOrder = -1;
  // the lights skip the depth test: horizon() hides the far side, and glow sprites are not cut by the curved sea
  const lightMat = K.points(set, {
    uniforms: globeU, head: 'attribute float aT, aH; uniform float uL, uF;' + HORIZON,
    vertex: `float on = mix(smoothstep(aT, aT + 0.08, uL), smoothstep(aT, aT + 0.3, uF) * smoothstep(0.25, 0.4, uL), aH);
  vA *= on * (0.85 + 0.15 * sin(uTime * 1.7 + aT * 517.0) * (1.0 - aH)) * horizon(pos, 1.0); gl_PointSize *= 0.5 + 0.5 * on;`,
  });
  lightMat.depthTest = false;
  const lights = new THREE.Points(LIGHTS, lightMat);
  const tieMat = new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uTime: K.U.uTime, uF: globeU.uF, uG: globeU.uG },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
attribute float aT, aF, aK;
uniform float uA, uF, uG;
varying vec3 vC; varying float vA, vF, vP;
${HORIZON}
void main() {
  // kinds: 0 local, 1 regional, 2 long (these carry travelling glints)
  vC = aK < 0.5 ? vec3(0.3, 0.5, 1.0) : aK < 1.5 ? vec3(0.26, 0.45, 1.0) : vec3(0.24, 0.42, 1.0);
  vF = aF; vP = step(1.5, aK);
  vA = (aK < 0.5 ? 0.42 : aK < 1.5 ? 0.26 : 0.17) * uA * uG * smoothstep(aT - 0.03, aT, uF) * horizon(position, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
uniform float uTime;
varying vec3 vC; varying float vA, vF, vP;
void main() {
  if (vA < 0.004) discard;
  float pu = smoothstep(0.96, 1.0, fract(vF - uTime * 0.12)) * vP;
  gl_FragColor = vec4(vC + vec3(0.6, 0.7, 0.8) * pu, vA * (1.0 + 2.0 * pu));
}`,
  });
  set.mats.push(tieMat);
  const ties = new THREE.LineSegments(GT.g, tieMat);
  globe.add(sea, halo, ties, lights);
  // where the camera is, in the set's own coordinates (for labels on the far side of the globe)
  const camL = new THREE.Vector3(0, 0, 10);
  sea.onBeforeRender = (rd, sc, cam) => { camL.setFromMatrixPosition(cam.matrixWorld); set.group.worldToLocal(camL); };

  // ================================================================ anchors, views, controls
  // a point on the full-size globe, turned with it (the anchors ignore the brief growth, so camera targets stay put)
  const spun = p => { const a = live.spin * TAU, c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
  const onGlobe = (lat, lon, h = 0.01) => () => spun(V.mul(ll(lat, lon), 1 + h));
  // 0 behind the globe's horizon as seen from the camera, 1 well in front of it
  const facing = p => {
    const l = camL.length() || 1, pl = Math.hypot(p[0], p[1], p[2]) || 1;
    return K.prog((p[0] * camL.x + p[1] * camL.y + p[2] * camL.z) / (l * pl) - live.scale / l, 0.02, 0.2);
  };
  const PLACES = { europe: [50, 10], americas: [39, -90], asia: [33, 108] };
  const anchors = {
    hub: NET.at(NET.hub[0]), hub2: NET.at(NET.hub[1]), tuft: NET.at(Math.max(0, NET.tuftAt)),   // the giants and the biggest dandelion
    globe: [0, 0, 0], europe: onGlobe(...PLACES.europe), americas: onGlobe(...PLACES.americas), asia: onGlobe(...PLACES.asia),
    // the top of a tie across the North Atlantic (London to New York)
    atlantic: () => spun(V.mul(V.norm(V.add(ll(51.5, -0.1), ll(40.7, -74))), 1.06)),
  };
  const place = (k, cls) => ({ text: [k[0].toUpperCase() + k.slice(1), ''], at: k, cls,
    alpha: S => K.prog(S.web_globe, 0.6, 1) * K.prog(S.web_ties, 0.1, 0.22) * facing(anchors[k]()) });
  let local = 0;
  for (let t = 0; t < TIES.n; t++) if (TIES.th[t] < 1000 / 6371) local++;
  // explore: c.t restarts whenever a control changes. A change of Ties alone keeps the view up and only moves the
  // ties (Local only: back to the local ones; All: on from there); a change of View, or reopening, replays the growth.
  let xView = '', xTies = '', xT = 0, xKeep = false;

  return Object.assign(set, {
    params: { web_a: 1, web_net: 1, web_globe: 0, web_ties: 0, web_spin: 0 },
    update(S, t) {
      // the dark globe grows out of the internet's core and swallows what is left of it, turns opaque early,
      // lights up city by city, then the ties spread from the local ones to the long arcs
      const g = S.web_globe, ga = K.prog(g, 0, 0.2), gs = 0.1 + 0.9 * K.prog(g, 0, 0.6);
      netU.uF.value = S.web_net * 1.08 - 0.02;
      netU.uN.value = 1 - K.smooth(Math.min(1, g * 1.4));
      netU.uR.value = gs; netU.uH.value = g > 0.002 ? ga : 0;
      netGroup.visible = S.web_net > 0.001 && netU.uN.value > 0.003;
      globe.visible = g > 0.002;
      globeU.uG.value = ga; globeU.uL.value = g * 1.1 - 0.02; globeU.uF.value = S.web_ties * 1.06 - 0.03;
      seaMat.depthWrite = ga * set.uA.value > 0.97;
      haloMat.uniforms.uK.value = ga;
      live.spin = S.web_spin; live.scale = gs;
      globe.rotation.y = S.web_spin * TAU;
      globe.scale.setScalar(live.scale);
    },
    anchors,
    labels: [place('europe', 'cyn'), place('americas', 'cyn'), place('asia', 'cyn')],
    cam: {
      default: [-18, 12, 3.4, 0, 0, 0], net: [-18, 12, 3.4, 0, 0, 0],
      hub: [-30, 14, 1.5, ...NET.at(NET.hub[0]).map(x => Math.round(x * 1000) / 1000)],
      globe: [0, 24, 4.1, 0, 0, 0],
      europe: [(10 - L0) + 4, 38, 1.9, ...V.mul(ll(46, 10), 0.7)],
    },
    controls: [
      { key: 'view', label: 'View', options: [['net', 'Internet'], ['globe', 'Friendships']] },
      { key: 'ties', label: 'Ties', options: [['all', 'All'], ['local', 'Local only']] },
    ],
    explore(c) {
      if (c.view !== xView) xKeep = false;
      else if (c.t < xT) xKeep = c.ties !== xTies;
      xView = c.view; xTies = c.ties; xT = c.t;
      if (c.view !== 'globe') return { web_net: xKeep ? 1 : K.prog(c.t, 0, 6), web_globe: 0, web_ties: 0, web_spin: 0 };
      // local ties are drawn first: stopping at 0.24 shows them alone (and that most ties are local)
      const ties = c.ties === 'local' ? (xKeep ? 0.24 : Math.min(0.24, K.prog(c.t, 1, 7)))
        : xKeep ? 0.24 + 0.76 * K.prog(c.t, 0, 4) : K.prog(c.t, 1, 7);
      return { web_net: 0, web_globe: xKeep ? 1 : K.prog(c.t, 0, 1.5), web_ties: ties, web_spin: 0 };
    },
    // numbers for the story text
    netNodes: NET.n, netLinks: NET.E.length / 2, cities: NC, tieCount: TIES.n, localShare: local / TIES.n,
  });

  // lat/lon of the 3,214 airports, 4 characters each (see airports_decoder.js), in the airports story's order
  function airports() {
    return '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';
  }
};
