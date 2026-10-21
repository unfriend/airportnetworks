// The protein network of the endotype story, from ENDO_DATA: the authors' network of 18,306 proteins as a deep,
// glowing cloud (the 2,000 genes the walk from the seeds visits most in the middle, with 15,000 of their links; the
// rest in a thick shell), the 35 CMS seed genes, their neighbourhoods growing and merging with k, walkers doing a
// random walk with restart, the module of 393 genes pulling out of the cloud, endotype colours, and one gene's
// 184-gene neighbourhood. Positions, colours and highlights follow the params alone; the walkers follow planned,
// seeded paths, so they too are a function of the time.
SETS.net = function (K) {
  const { THREE, smooth, clamp, lerp, prog } = K;
  const set = K.newSet('net');
  const D = ENDO_DATA, FA = D.facts;

  // ---------------------------------------------------------------- data, decoded once
  const bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const u16 = s => new Uint16Array(bytes(s).buffer), i16 = s => new Int16Array(bytes(s).buffer);
  const N = D.nodes, NC = D.core, NM = D.mod, NL = D.nLinks, ML = D.modLinks, HS = FA.hood, NS = D.seeds.length;
  const KV = D.groups.k, NK = KV.length, ENDO = D.endo, NE = ENDO.length;
  const P = new Float32Array(3 * N);
  { const q = i16(D.pos); for (let i = 0; i < 3 * N; i++) P[i] = q[i] / 10000; }
  const HEAT = bytes(D.heat), LK = u16(D.links), GENE = bytes(D.gene), SEEDOF = bytes(D.seedOf), GRP = bytes(D.groups.g), HOOD = u16(D.hood);
  const NAMES = D.names.split('|'), MNAMES = NAMES.slice(0, NM);
  const SEED = new Int32Array(NS);   // module index of each seed, in the Gene Table's order (the groups' order)
  for (let i = 0; i < NM; i++) if (SEEDOF[i]) SEED[SEEDOF[i] - 1] = i;
  const KIND = new Uint8Array(N);    // 0 shell, 1 core, 2 found by the walk (in the module), 3 seed
  for (let i = 0; i < NC; i++) KIND[i] = i < NM ? (SEEDOF[i] ? 3 : 2) : 1;
  // the core's links as adjacency lists (the walkers hop along them)
  const DEG = new Int32Array(NC), OFF = new Int32Array(NC + 1), NB = new Uint16Array(2 * NL);
  for (let e = 0; e < NL; e++) { DEG[LK[2 * e]]++; DEG[LK[2 * e + 1]]++; }
  for (let i = 0; i < NC; i++) OFF[i + 1] = OFF[i] + DEG[i];
  { const f = OFF.slice(0, NC); for (let e = 0; e < NL; e++) { const a = LK[2 * e], b = LK[2 * e + 1]; NB[f[a]++] = b; NB[f[b]++] = a; } }
  const R = K.rng(18306);

  // ---------------------------------------------------------------- seed groups
  // A gene joins a seed's neighbourhood at k = its rank in that seed's walk: hood lists are in rank order, and the
  // seeds whose top-k sets overlap are exactly the groups in ENDO_DATA.groups (checked at every k).
  const JR = new Float32Array(N).fill(999), JS = new Float32Array(N);
  for (let s = 0; s < NS; s++) { const b = SEED[s] * HS; for (let r = 1; r < HS; r++) { const n = HOOD[b + r]; if (r < JR[n]) { JR[n] = r; JS[n] = s; } } }
  for (let s = 0; s < NS; s++) { JR[SEED[s]] = 0; JS[SEED[s]] = s; }
  const gOf = (L, s) => GRP[L * NS + s];
  // Colours follow lineages: the groups only ever merge as k grows, so going from one group (amber) down to the
  // smallest k, the biggest part of a group keeps its colour and the others take new ones. Amber is thus group 0
  // from k = 20 on, and the growing neighbourhood at every k (the biggest group switches lineage below that).
  const PAL = ['#ffb43b', '#46d9ff', '#3ee08f', '#ff5ad9', '#a98bea', '#5d86f0', '#34d1a8', '#ff7aa8', '#c7e05a', '#7fc8ff', '#e070d0', '#58d06a'].map(K.rgb);
  const GC = new Float32Array(NK * NS * 3);
  {
    const ci = new Int16Array(NK * NS);
    let next = 0;
    const fresh = () => 1 + (next++ % (PAL.length - 1));
    const tops = new Map();
    for (let s = 0; s < NS; s++) { const g = gOf(NK - 1, s); if (!tops.has(g)) tops.set(g, g === 0 ? 0 : fresh()); ci[(NK - 1) * NS + s] = tops.get(g); }
    for (let L = NK - 2; L >= 0; L--) {
      const kids = new Map();   // parent group -> [child, size, first seed]
      for (let s = 0; s < NS; s++) {
        const p = gOf(L + 1, s), c = gOf(L, s);
        if (!kids.has(p)) kids.set(p, new Map());
        const m = kids.get(p);
        if (!m.has(c)) m.set(c, [c, 0, s]);
        m.get(c)[1]++;
      }
      const colOf = new Map();
      for (const m of kids.values()) {
        const pc = ci[(L + 1) * NS + [...m.values()][0][2]];
        [...m.values()].sort((a, b) => b[1] - a[1] || (a[0] === 0 ? -1 : b[0] === 0 ? 1 : a[2] - b[2]))
          .forEach((k, j) => colOf.set(k[0], j === 0 ? pc : fresh()));
      }
      for (let s = 0; s < NS; s++) ci[L * NS + s] = colOf.get(gOf(L, s));
    }
    for (let i = 0; i < NK * NS; i++) GC.set(PAL[ci[i]], 3 * i);
  }
  const groupCount = KV.map((_, L) => new Set(Array.from(GRP.subarray(L * NS, L * NS + NS))).size);

  // ---------------------------------------------------------------- the module's own layout
  // a quick force layout of the 393 genes on their 710 links, started from their places in the cloud (so they keep
  // their bearings as they move), with a weak pull to their endotype's middle so the endotypes read as regions
  const MODP = new Float32Array(3 * NM);
  {
    const X = new Float64Array(3 * NM), F = new Float64Array(3 * NM), cen = new Float64Array(3 * NE), cnt = new Float64Array(NE);
    for (let i = 0; i < 3 * NM; i++) X[i] = P[i] * 0.5;
    for (let i = 0; i < NM; i++) cnt[GENE[i]]++;
    const IT = 60, KR = 0.00004, KSP = 0.4, L0 = 0.08, KC = 0.03, KE = 0.06;
    for (let it = 0; it < IT; it++) {
      const T = 0.05 * Math.pow(1 - it / IT, 1.5) + 0.002;
      F.fill(0); cen.fill(0);
      for (let i = 0; i < NM; i++) {
        const i3 = 3 * i, xi = X[i3], yi = X[i3 + 1], zi = X[i3 + 2];
        let ax = 0, ay = 0, az = 0;
        for (let j = i + 1; j < NM; j++) {
          const j3 = 3 * j, dx = xi - X[j3], dy = yi - X[j3 + 1], dz = zi - X[j3 + 2], d2 = dx * dx + dy * dy + dz * dz + 0.0004, f = KR / (d2 * Math.sqrt(d2));
          ax += dx * f; ay += dy * f; az += dz * f; F[j3] -= dx * f; F[j3 + 1] -= dy * f; F[j3 + 2] -= dz * f;
        }
        F[i3] += ax; F[i3 + 1] += ay; F[i3 + 2] += az;
      }
      for (let e = 0; e < ML; e++) {
        const a = 3 * LK[2 * e], b = 3 * LK[2 * e + 1], dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2];
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6, f = KSP * (L - L0) / L;
        F[a] += dx * f; F[a + 1] += dy * f; F[a + 2] += dz * f; F[b] -= dx * f; F[b + 1] -= dy * f; F[b + 2] -= dz * f;
      }
      for (let i = 0; i < NM; i++) { const e = 3 * GENE[i], w = 1 / cnt[GENE[i]]; cen[e] += X[3 * i] * w; cen[e + 1] += X[3 * i + 1] * w; cen[e + 2] += X[3 * i + 2] * w; }
      for (let i = 0; i < NM; i++) {
        const i3 = 3 * i, e = 3 * GENE[i];
        for (let a = 0; a < 3; a++) F[i3 + a] += -X[i3 + a] * KC + (cen[e + a] - X[i3 + a]) * KE;
        const fl = Math.hypot(F[i3], F[i3 + 1], F[i3 + 2]) + 1e-9, s = Math.min(1, T / fl);
        X[i3] += F[i3] * s; X[i3 + 1] += F[i3 + 1] * s; X[i3 + 2] += F[i3 + 2] * s;
      }
    }
    // centred, about 1.3 across (RMS radius 0.4)
    const c = [0, 0, 0]; for (let i = 0; i < NM; i++) for (let a = 0; a < 3; a++) c[a] += X[3 * i + a] / NM;
    let rr = 0; for (let i = 0; i < NM; i++) rr += (X[3 * i] - c[0]) ** 2 + (X[3 * i + 1] - c[1]) ** 2 + (X[3 * i + 2] - c[2]) ** 2;
    const k = 0.4 / Math.sqrt(rr / NM);
    for (let i = 0; i < NM; i++) for (let a = 0; a < 3; a++) MODP[3 * i + a] = (X[3 * i + a] - c[a]) * k;
  }
  // where each node goes as the module pulls out: module genes to their layout, the rest of the cloud a little
  // outwards (it recedes); each gene leaves at its own moment (ST), the far travellers last
  const MT = new Float32Array(3 * N), ST = new Float32Array(N);
  {
    let far = 0;
    const dd = new Float32Array(NM);
    for (let i = 0; i < NM; i++) { dd[i] = Math.hypot(MODP[3 * i] - P[3 * i], MODP[3 * i + 1] - P[3 * i + 1], MODP[3 * i + 2] - P[3 * i + 2]); far = Math.max(far, dd[i]); }
    for (let i = 0; i < N; i++) {
      if (i < NM) { MT.set(MODP.subarray(3 * i, 3 * i + 3), 3 * i); ST[i] = 0.3 * dd[i] / far + 0.1 * R(); }
      else { MT[3 * i] = P[3 * i] * 1.14; MT[3 * i + 1] = P[3 * i + 1] * 1.14; MT[3 * i + 2] = P[3 * i + 2] * 1.14; ST[i] = 0.12 * R(); }
    }
  }
  // the same morph as the shaders' morph(): eased, with a sideways bow about the vertical
  function mpos(i, m, out, o) {
    const i3 = 3 * i;
    let x = P[i3], y = P[i3 + 1], z = P[i3 + 2];
    if (m > 0) {
      const e = smooth((m - ST[i]) / 0.6);
      if (e > 0) {
        const dx = MT[i3] - x, dy = MT[i3 + 1] - y, dz = MT[i3 + 2] - z, b = 0.3 * Math.sin(Math.PI * e);
        x += dx * e - dz * b; y += dy * e; z += dz * e + dx * b;
      }
    }
    out[o] = x; out[o + 1] = y; out[o + 2] = z;
    return out;
  }

  // how crowded each gene's surroundings are (genes in a 0.3-unit box): the middle of the core is so dense that
  // additive points and links would burn out to white, so brightness falls with the crowd (in the cloud and in the
  // module's layout)
  function crowd(pos, n) {
    const C = 0.1, G = 44, H = G / 2, cnt = new Uint16Array(G * G * G), out = new Float32Array(n);
    const c = x => clamp(Math.floor(x / C) + H, 0, G - 1), cell = new Int32Array(3 * n);
    for (let i = 0; i < n; i++) { for (let a = 0; a < 3; a++) cell[3 * i + a] = c(pos[3 * i + a]); cnt[(cell[3 * i] * G + cell[3 * i + 1]) * G + cell[3 * i + 2]]++; }
    for (let i = 0; i < n; i++) {
      const x = cell[3 * i], y = cell[3 * i + 1], z = cell[3 * i + 2];
      let s = 0;
      for (let a = Math.max(0, x - 1); a <= Math.min(G - 1, x + 1); a++) for (let b = Math.max(0, y - 1); b <= Math.min(G - 1, y + 1); b++)
        for (let d = Math.max(0, z - 1); d <= Math.min(G - 1, z + 1); d++) s += cnt[(a * G + b) * G + d];
      out[i] = s;
    }
    return out;
  }
  const CRC = crowd(P, NC), CRM = crowd(MODP, NM);
  const dimP = d => Math.pow(6 / Math.max(6, d), 0.6), dimL = d => Math.pow(6 / Math.max(6, d), 0.8);

  // ---------------------------------------------------------------- shared uniforms and GLSL
  const U = {
    uCloud: { value: 1 }, uSeeds: { value: 0 }, uKv: { value: 1 }, uGk: { value: 0 }, uHeat: { value: 0 }, uMod: { value: 0 },
    uEndo: { value: 0 }, uFocus: { value: 0 }, uHoodP: { value: 0 }, uHoodOn: { value: 0 }, uMark: { value: 0 }, uHot: { value: 0 },
    uLo: { value: 0 }, uHi: { value: 0 }, uKf: { value: 0 },
    uSeedCol: { value: new Float32Array(3 * NS) }, uEndoCol: { value: new Float32Array(3 * NE) },
  };
  ENDO.forEach((e, i) => U.uEndoCol.value.set(K.rgb(e.col), 3 * i));
  const LOOK = `
uniform float uCloud, uSeeds, uKv, uGk, uHeat, uMod, uEndo, uFocus, uHoodP, uHoodOn, uMark, uHot, uLo, uHi, uKf;
uniform vec3 uSeedCol[${NS}], uEndoCol[${NE}];
// the module pulls out: eased per gene (st: its start), with a sideways bow about the vertical (mpos() in JS)
vec3 morph(vec3 p, vec3 q, float st) {
  float e = clamp((uMod - st) / 0.6, 0.0, 1.0); e = e * e * (3.0 - 2.0 * e);
  vec3 d = q - p;
  return p + d * e + vec3(-d.z, 0.0, d.x) * (0.3 * sin(3.14159265 * e));
}
vec3 seedCol(float s) { return uSeedCol[int(s + 0.5)]; }
vec3 endoCol(float e) { return uEndoCol[int(clamp(e, 0.0, ${NE - 1}.0) + 0.5)]; }
// the walk's heat: deep blue (rarely visited), teal, amber, orange, white-hot (the seeds)
vec3 heatRamp(float h) {
  vec3 c = mix(vec3(0.13, 0.2, 0.52), vec3(0.18, 0.46, 0.88), smoothstep(0.0, 0.3, h));
  c = mix(c, vec3(0.22, 0.8, 0.74), smoothstep(0.3, 0.44, h));
  c = mix(c, vec3(1.0, 0.74, 0.28), smoothstep(0.44, 0.6, h));
  c = mix(c, vec3(1.0, 0.4, 0.2), smoothstep(0.62, 0.82, h));
  return mix(c, vec3(1.0, 0.93, 0.82), smoothstep(0.86, 1.0, h));
}
float bitAt(float m, float l) { return mod(floor(m / exp2(l) + 0.001), 2.0); }
// brighter in front of the set's middle, darker behind (depth)
float depthCue(vec4 mv) { vec4 o = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); float s = length(modelViewMatrix[0].xyz); return clamp(1.0 - (o.z - mv.z) / s * 0.22, 0.42, 1.35); }
`;
  const mat = (vs, fs, opts = {}) => {
    const m = new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U, opts.uniforms || {}),
      vertexShader: K.GLSL + LOOK + vs, fragmentShader: fs,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }, opts.extra || {}));
    set.mats.push(m);
    return m;
  };
  const attr = (g, name, arr, n) => g.setAttribute(name, new THREE.BufferAttribute(arr, n));
  const BS = new THREE.Sphere(new THREE.Vector3(), 2.8);
  const GLOW_FS = `
varying vec3 vC; varying float vA;
void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0; if (d > 1.0) discard;
  float core = smoothstep(0.6, 0.1, d), halo = pow(1.0 - d, 2.0);
  gl_FragColor = vec4(vC * (0.7 + 0.5 * core), vA * (core * 0.8 + halo * 0.5)); }`;

  // ---------------------------------------------------------------- the nodes: one cloud of 18,306 points
  const HA = new Float32Array(N).fill(-1);   // rank in the current gene's neighbourhood, or -1
  const nodeGeo = new THREE.BufferGeometry();
  {
    const I = new Float32Array(4 * N), Q = new Float32Array(4 * N), B = new Float32Array(2 * N).fill(1);
    for (let i = 0; i < N; i++) {
      const k = KIND[i], h = HEAT[i] / 255;
      I[4 * i] = h; I[4 * i + 1] = k; I[4 * i + 2] = i < NM ? GENE[i] : -1; I[4 * i + 3] = ST[i];
      const sz = k === 3 ? 0.026 : k === 2 ? 0.02 : k === 1 ? 0.0135 + 0.005 * Math.min(1, DEG[i] / 40) : 0.0085 + 0.004 * clamp(h / 0.4, 0, 1);
      Q[4 * i] = JR[i]; Q[4 * i + 1] = JS[i]; Q[4 * i + 2] = sz; Q[4 * i + 3] = R();
      if (i < NC) B[2 * i] = dimP(CRC[i]);
      if (i < NM) B[2 * i + 1] = dimP(CRM[i]);
    }
    attr(nodeGeo, 'position', P, 3); attr(nodeGeo, 'aMod', MT, 3); attr(nodeGeo, 'aI', I, 4); attr(nodeGeo, 'aK', Q, 4); attr(nodeGeo, 'aHood', HA, 1); attr(nodeGeo, 'aB', B, 2);
    nodeGeo.boundingSphere = BS;
  }
  const nodeMat = mat(`
attribute vec3 aMod; attribute vec4 aI, aK; attribute float aHood; attribute vec2 aB;
uniform float uA; varying vec3 vC; varying float vA, vHot;
void main() {
  float heat = aI.x, kind = aI.y, endo = aI.z;
  float isCore = step(0.5, kind), isMod = step(1.5, kind), isSeed = step(2.5, kind);
  vec3 pos = morph(position, aMod, aI.w);
  float r = length(position);
  vec3 c = mix(vec3(0.27, 0.38, 0.64), vec3(0.47, 0.6, 0.9), isCore);
  c = mix(c, vec3(0.62, 0.74, 1.0), isMod);
  float sz = aK.z, hi = 0.0;
  float br = mix(0.5 + 0.5 * smoothstep(2.45, 1.75, r), 1.0, isCore);
  // seed groups: the genes within k of a seed take its group's colour
  float lit = (1.0 - isSeed) * smoothstep(aK.x - 1.0, aK.x, uKv) * uGk;
  c = mix(c, seedCol(aK.y), lit * 0.9); sz *= 1.0 + 0.4 * lit; hi = max(hi, lit);
  // the walk's heat
  float hh = uHeat * smoothstep(0.4, 0.75, heat);
  c = mix(c, heatRamp(heat) * 1.15, uHeat); sz *= mix(1.0, 0.55 + 1.6 * heat * heat, uHeat); hi = max(hi, uHeat * smoothstep(0.55, 0.85, heat));
  // the module: found genes warm, the rest of the cloud a faint haze
  float mo = uMod * isMod;
  c = mix(c, vec3(1.0, 0.64, 0.24) * 1.15, mo * (1.0 - isSeed)); hi = max(hi, mo);
  br *= mix(1.0, 0.22, uMod * (1.0 - isMod)); sz *= mix(1.0, 0.8, uMod * (1.0 - isMod)); sz *= 1.0 + 0.55 * mo;
  // endotypes, and one of them in focus
  c = mix(c, endoCol(endo) * 1.35, uEndo * isMod); hi = max(hi, uEndo * isMod);
  sz *= 1.0 + 0.5 * uEndo * isMod * (1.0 - uMod); br *= 1.0 - 0.5 * uEndo * (1.0 - isMod);
  float fw = isMod * clamp(1.0 - abs(uFocus - endo - 1.0), 0.0, 1.0), fon = clamp(uFocus, 0.0, 1.0);
  float fd = mix(1.0, 0.14 + 0.86 * fw, fon);
  br *= fd; sz *= 1.0 + 0.7 * fw; hi = max(hi, fw);
  // the seeds: white-hot (their endotype's colour round a white heart in endotype colours)
  float hot = isSeed * uHot;
  c = mix(c, mix(vec3(1.0, 0.95, 0.86), endoCol(endo) * 1.3, 0.6 * uEndo), hot); sz *= 1.0 + (1.2 - 0.5 * max(uMod, uHeat)) * hot; br *= 1.0 + 0.5 * hot; hi = max(hi, hot);
  // one gene's neighbourhood lights up in order of rank, the gene itself white
  float hl = aHood < -0.5 ? 0.0 : smoothstep(aHood / ${HS}.0, aHood / ${HS}.0 + 0.05, uHoodP);
  float me = aHood > -0.5 && aHood < 0.5 ? uMark : 0.0;
  c = mix(c, vec3(0.42, 0.9, 1.0) * 1.3, hl * 0.9 * (1.0 - me)); sz *= 1.0 + 0.6 * hl * (1.0 - isSeed); hi = max(hi, max(hl, me));
  c = mix(c, vec3(1.0), me * 0.6); sz *= 1.0 + 0.5 * me * (1.0 - hot);
  // whatever is not lit steps back a little behind the seeds, more behind a neighbourhood; crowds dim
  br *= (1.0 - 0.42 * uSeeds * (1.0 - hi)) * (1.0 - 0.72 * uHoodOn * (1.0 - max(hl, me)));
  br *= mix(mix(aB.x, aB.y, uMod * isMod), 1.0, max(max(hot, me) * 0.7, max(max(hl * 0.3, hh * 0.65), max(uEndo * isMod, fw) * 0.5 + lit * 0.2)));
  // the cloud appears from the centre outwards, with a bright front
  float rv = r / 2.45, u = uCloud * 1.05, ap = smoothstep(rv, rv + 0.035, u), fl = uCloud < 0.999 ? exp(-pow((u - rv - 0.025) / 0.03, 2.0)) : 0.0;
  br *= (0.86 + 0.14 * sin(uTime * 1.3 + aK.w * 6.2832)) * (1.0 + 1.6 * fl);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(sz * ap * (1.0 + 0.8 * fl), mv);
  vC = c * br * depthCue(mv);
  vHot = min(hot + me, 1.0) * fd * (1.0 - 0.75 * uHoodOn * (1.0 - max(hl, me)));
  vA = uA * ap;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA, vHot;
void main() {
  vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.62, 0.12, d), halo = pow(1.0 - d, 2.0);
  vec3 col = vC * (0.6 + 0.55 * core) + vec3(0.9, 0.88, 0.82) * vHot * smoothstep(0.42, 0.0, d);
  gl_FragColor = vec4(col, vA * (core * 0.75 + halo * (0.45 + 0.35 * vHot)));
}`);
  const nodes = new THREE.Points(nodeGeo, nodeMat);
  nodes.renderOrder = 2;
  set.group.add(nodes);

  // ---------------------------------------------------------------- the 15,000 core links
  {
    const g = new THREE.BufferGeometry(), n = 2 * NL;
    const pos = new Float32Array(3 * n), mod = new Float32Array(3 * n), dA = new Float32Array(4 * n), eA = new Float32Array(4 * n), jA = new Float32Array(3 * n);
    for (let e = 0; e < NL; e++) {
      const a = LK[2 * e], b = LK[2 * e + 1], a3 = 3 * a, b3 = 3 * b;
      const len = Math.hypot(P[a3] - P[b3], P[a3 + 1] - P[b3 + 1], P[a3 + 2] - P[b3 + 2]);
      const type = e < ML ? 0 : (a < NM || b < NM) ? 1 : 2;
      const al = (0.2 / (1 + (len / 0.2) * (len / 0.2)) + 0.02) * (type === 0 ? 1.4 : type === 1 ? 1 : 0.8);
      const ac = al * dimL(0.5 * (CRC[a] + CRC[b])), am = type === 0 ? 0.6 * dimL(0.5 * (CRM[a] + CRM[b])) : 0;
      const rv = Math.max(Math.hypot(P[a3], P[a3 + 1], P[a3 + 2]), Math.hypot(P[b3], P[b3 + 1], P[b3 + 2])) / 2.45;
      for (let j = 0; j < 2; j++) {
        const s = j ? b : a, o = j ? a : b, v = 2 * e + j, s3 = 3 * s;
        pos[3 * v] = P[s3]; pos[3 * v + 1] = P[s3 + 1]; pos[3 * v + 2] = P[s3 + 2];
        mod[3 * v] = MT[s3]; mod[3 * v + 1] = MT[s3 + 1]; mod[3 * v + 2] = MT[s3 + 2];
        dA[4 * v] = ST[s]; dA[4 * v + 1] = HEAT[s] / 255; dA[4 * v + 2] = s < NM ? GENE[s] : -1; dA[4 * v + 3] = KIND[s];
        eA[4 * v] = type; eA[4 * v + 1] = ac; eA[4 * v + 2] = rv; eA[4 * v + 3] = JR[o];
        jA[3 * v] = JR[s]; jA[3 * v + 1] = JS[s]; jA[3 * v + 2] = am;
      }
    }
    attr(g, 'position', pos, 3); attr(g, 'aMod', mod, 3); attr(g, 'aD', dA, 4); attr(g, 'aE', eA, 4); attr(g, 'aJ', jA, 3);
    g.boundingSphere = BS;
    const m = mat(`
attribute vec3 aMod, aJ; attribute vec4 aD, aE;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec3 pos = morph(position, aMod, aD.x);
  float isM = 1.0 - step(0.5, aE.x);
  vec3 c = vec3(0.38, 0.52, 0.86);
  // crowded links are fainter (aE.y in the cloud, aJ.z in the module's layout)
  float a = mix(aE.y, aJ.z, uMod * isM), hi = 0.0;
  // a link inside a lit neighbourhood glows with it
  float kr = max(aJ.x, aE.w), lit = smoothstep(kr - 1.0, kr, uKv) * uGk;
  c = mix(c, seedCol(aJ.y), lit); a *= 1.0 + 1.3 * lit; hi = max(hi, lit);
  c = mix(c, heatRamp(aD.y), uHeat); a *= mix(1.0, 0.45 + 1.0 * aD.y, uHeat);
  c = mix(c, vec3(1.0, 0.8, 0.52), uMod * isM); a *= mix(1.0, isM + (1.0 - isM) * 0.06, uMod); hi = max(hi, uMod * isM);
  c = mix(c, endoCol(aD.z) * 1.1, uEndo * isM); a *= 1.0 - 0.5 * uEndo * (1.0 - isM);
  float fw = isM * clamp(1.0 - abs(uFocus - aD.z - 1.0), 0.0, 1.0);
  a *= mix(1.0, 0.12 + 1.3 * fw, clamp(uFocus, 0.0, 1.0)); hi = max(hi, fw);
  a *= 1.0 - max(0.45 * uSeeds, 0.78 * uHoodOn) * (1.0 - hi);
  float ap = smoothstep(aE.z, aE.z + 0.04, uCloud * 1.05);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vC = c * depthCue(mv); vA = uA * a * ap;
}`, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.002) discard; gl_FragColor = vec4(vC, vA); }`);
    const L = new THREE.LineSegments(g, m);
    L.renderOrder = 1;
    set.group.add(L);
  }

  // ---------------------------------------------------------------- depth: a haze of big faint sprites and a glowing core
  {
    const n = 300, g = new THREE.BufferGeometry(), pos = new Float32Array(3 * n), mod = new Float32Array(3 * n), h = new Float32Array(4 * n);
    for (let k = 0; k < n; k++) {
      const i = k < 70 ? Math.floor(R() * NM) : k < 190 ? Math.floor(R() * NC) : NC + Math.floor(R() * (N - NC));
      const j = [K.gauss(R) * 0.05, K.gauss(R) * 0.05, K.gauss(R) * 0.05];
      for (let a = 0; a < 3; a++) { pos[3 * k + a] = P[3 * i + a] + j[a]; mod[3 * k + a] = MT[3 * i + a] + j[a] * 0.6; }
      h[4 * k] = ST[i]; h[4 * k + 1] = (i < NC ? 0.22 : 0.4) + 0.2 * R(); h[4 * k + 2] = i < NM ? 1 : 0; h[4 * k + 3] = i < NM ? 0.05 : i < NC ? 0.04 : 0.032;
    }
    attr(g, 'position', pos, 3); attr(g, 'aMod', mod, 3); attr(g, 'aH', h, 4);
    g.boundingSphere = BS;
    const m = mat(`
attribute vec3 aMod; attribute vec4 aH;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec3 pos = morph(position, aMod, aH.x);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aH.y * (1.0 - 0.35 * uMod * aH.z), mv);
  float r = length(position);
  vC = mix(vec3(0.3, 0.44, 0.9), vec3(1.0, 0.6, 0.28), max(uMod * aH.z, uHeat * (r < 1.75 ? 0.75 : 0.0)));
  vA = uA * aH.w * smoothstep(r / 2.45, r / 2.45 + 0.12, uCloud * 1.05) * mix(1.0, 0.35 + aH.z * 1.05, uMod) * (1.0 - 0.6 * uHoodOn) * (1.0 - 0.3 * uSeeds) * (1.0 - 0.6 * clamp(uFocus, 0.0, 1.0));
  if (vA < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
varying vec3 vC; varying float vA;
void main() { vec2 q = gl_PointCoord - 0.5; float d2 = dot(q, q) * 4.0; if (d2 > 1.0) discard; gl_FragColor = vec4(vC, vA * exp(-d2 * 3.5) * (1.0 - d2)); }`);
    const pts = new THREE.Points(g, m); pts.renderOrder = 0; set.group.add(pts);
  }
  const glowMat = mat(`
uniform float uA; varying vec3 vN, vW;
void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, `
uniform float uA, uCloud, uMod, uHoodOn, uFocus; varying vec3 vN, vW;
void main() {
  float f = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  float a = pow(f, 3.0) * uA * smoothstep(0.0, 0.45, uCloud) * (1.0 - 0.75 * max(uMod, uHoodOn)) * (1.0 - 0.6 * clamp(uFocus, 0.0, 1.0));
  gl_FragColor = vec4(mix(vec3(0.36, 0.52, 1.0), vec3(0.8, 0.9, 1.0), f * f), a * 0.05);
}`);
  {
    const sg = new THREE.SphereGeometry(1, 32, 20);
    for (const r of [0.55, 1.05, 1.9]) { const m = new THREE.Mesh(sg, glowMat); m.scale.setScalar(r); m.renderOrder = 0; set.group.add(m); }
  }

  // ---------------------------------------------------------------- seed halos (instanced soft spheres) and arcs
  const SCTR = new Float32Array(3 * NS);
  const halo = (() => {
    const sg = new THREE.SphereGeometry(1, 20, 14), g = new THREE.InstancedBufferGeometry();
    g.setIndex(sg.index); g.setAttribute('position', sg.attributes.position); g.setAttribute('normal', sg.attributes.normal);
    g.setAttribute('aCtr', new THREE.InstancedBufferAttribute(SCTR, 3));
    g.setAttribute('aSlot', new THREE.InstancedBufferAttribute(new Float32Array(NS).map((_, s) => s), 1));
    g.instanceCount = NS;
    const m = mat(`
attribute vec3 aCtr; attribute float aSlot;
uniform float uA, uHaloR; varying vec3 vN, vW, vC;
void main() {
  vec4 w = modelMatrix * vec4(aCtr + position * uHaloR, 1.0);
  vN = normalize(mat3(modelMatrix) * normal); vW = w.xyz; vC = seedCol(aSlot);
  gl_Position = projectionMatrix * viewMatrix * w;
}`, `
uniform float uA, uHaloA; varying vec3 vN, vW, vC;
void main() {
  float f = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
  gl_FragColor = vec4(vC, pow(f, 1.8) * uHaloA * uA);
}`, { uniforms: { uHaloR: { value: 0.05 }, uHaloA: { value: 0 } } });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3;
    set.group.add(mesh);
    return { mesh, m, g };
  })();
  // arcs join the seeds of one group: at every k, the shortest tree through each group's seeds (Kruskal on their
  // places in the cloud); each arc knows at which k it shows (a bit mask over the 13 values)
  const arcs = (() => {
    const pairs = [];
    for (let a = 0; a < NS; a++) for (let b = a + 1; b < NS; b++) {
      const i = 3 * SEED[a], j = 3 * SEED[b];
      pairs.push([Math.hypot(P[i] - P[j], P[i + 1] - P[j + 1], P[i + 2] - P[j + 2]), a, b]);
    }
    pairs.sort((x, y) => x[0] - y[0]);
    const mask = new Map();
    for (let L = 0; L < NK; L++) {
      const par = Array.from({ length: NS }, (_, i) => i), find = x => (par[x] === x ? x : (par[x] = find(par[x])));
      for (const [, a, b] of pairs) {
        if (gOf(L, a) !== gOf(L, b)) continue;
        const ra = find(a), rb = find(b);
        if (ra === rb) continue;
        par[ra] = rb;
        const key = a * NS + b;
        mask.set(key, (mask.get(key) || 0) | (1 << L));
      }
    }
    const SEG = 24, n = mask.size, nv = n * SEG * 4, g = new THREE.BufferGeometry();
    const A = new Float32Array(3 * nv), Am = new Float32Array(3 * nv), B = new Float32Array(3 * nv), Bm = new Float32Array(3 * nv), Rr = new Float32Array(4 * nv), Sa = new Float32Array(2 * nv);
    const idx = new Uint16Array(n * SEG * 6);
    let v = 0, q = 0;
    for (const [key, m] of mask) {
      const a = Math.floor(key / NS), b = key % NS, ia = SEED[a], ib = SEED[b];
      for (let s = 0; s < SEG; s++) {
        idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], 6 * q++);
        for (let c = 0; c < 4; c++, v++) {
          A.set(P.subarray(3 * ia, 3 * ia + 3), 3 * v); Am.set(MT.subarray(3 * ia, 3 * ia + 3), 3 * v);
          B.set(P.subarray(3 * ib, 3 * ib + 3), 3 * v); Bm.set(MT.subarray(3 * ib, 3 * ib + 3), 3 * v);
          Rr[4 * v] = ST[ia]; Rr[4 * v + 1] = ST[ib]; Rr[4 * v + 2] = (s + (c >> 1)) / SEG; Rr[4 * v + 3] = c & 1 ? 1 : -1;
          Sa[2 * v] = a; Sa[2 * v + 1] = m;
        }
      }
    }
    attr(g, 'position', A, 3); attr(g, 'aAm', Am, 3); attr(g, 'aBc', B, 3); attr(g, 'aBm', Bm, 3); attr(g, 'aR', Rr, 4); attr(g, 'aS', Sa, 2);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = BS;
    const m = mat(`
attribute vec3 aAm, aBc, aBm; attribute vec4 aR; attribute vec2 aS;
uniform float uA; varying vec3 vC; varying float vA, vS, vSide, vLen;
void main() {
  vec3 A = morph(position, aAm, aR.x), B = morph(aBc, aBm, aR.y);
  vec3 ab = B - A, mid = 0.5 * (A + B); float L = length(ab);
  vec3 o = mid - ab * dot(mid, ab) / max(L * L, 1e-6);
  vec3 C = mid + (length(o) > 0.02 ? normalize(o) : vec3(0.0, 1.0, 0.0)) * 0.24 * L;   // bowed away from the middle
  float s = aR.z, u = 1.0 - s;
  vec3 p = u * u * A + 2.0 * u * s * C + s * s * B, tg = 2.0 * u * (C - A) + 2.0 * s * (B - C);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 side = normalize(cross((modelViewMatrix * vec4(tg, 0.0)).xyz, mv.xyz) + vec3(1e-6));
  mv.xyz += side * aR.w * 0.012 * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
  float w = (1.0 - uKf) * bitAt(aS.y, uLo) + uKf * bitAt(aS.y, uHi);
  vC = seedCol(aS.x) * min(depthCue(mv), 1.15); vA = uA * uGk * w; vS = s; vSide = aR.w; vLen = L * 1.2;
  if (vA < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform float uTime; varying vec3 vC; varying float vA, vS, vSide, vLen;
void main() {
  float prof = 1.0 - vSide * vSide;
  float f = fract(vS * vLen / 0.09 - uTime * 0.45), pulse = exp(-pow((f - 0.5) / 0.16, 2.0));
  float ends = smoothstep(0.0, 0.07, vS) * smoothstep(1.0, 0.93, vS);
  gl_FragColor = vec4(vC * (1.0 + 1.2 * pulse), vA * prof * ends * (0.6 + 0.4 * pulse));
}`, { extra: { side: THREE.DoubleSide } });
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 3; set.group.add(mesh);
    return { mesh };
  })();

  // ---------------------------------------------------------------- walkers: a random walk with restart, planned
  // Each walker lives at one seed (spread evenly over the 35, which averages to the walk from all seeds). At every
  // step it jumps back home with probability r = 0.8, else hops to a random neighbour along a stored link (a gene
  // with none sends it home). Restarts at home change nothing, so they show as a short rest. Plans are seeded and
  // loop seamlessly (each starts and ends at home), so a walker's place is a function of the time.
  const NW = 300, TS = 7, LAG = 0.024, RS = FA.r;
  const W0 = new Int32Array(NW), WN = new Int32Array(NW), WT = new Float32Array(NW), WPH = new Float32Array(NW);
  let EA, EB, EK, E0, ED;
  {
    const a = [], b = [], k = [], t0 = [], du = [];
    for (let w = 0; w < NW; w++) {
      const home = SEED[w % NS], want = 14 + 8 * R();
      let t = 0, cur = home;
      const push = (x, y, kind, d) => { a.push(x); b.push(y); k.push(kind); t0.push(t); du.push(d); t += d; };
      const hop = x => NB[OFF[x] + Math.floor(R() * DEG[x])];
      W0[w] = a.length;
      for (let guard = 0; guard < 400; guard++) {
        if (cur === home) {
          if (t >= want) break;
          let n = 1; while (R() < RS && n < 12) n++;
          push(home, home, 2, n * 0.09);
          const y = hop(home); push(home, y, 0, 0.25 * (0.85 + 0.3 * R())); cur = y;
        } else if (DEG[cur] === 0 || R() < RS) { push(cur, home, 1, 0.13); cur = home; }
        else { const y = hop(cur); push(cur, y, 0, 0.25 * (0.85 + 0.3 * R())); cur = y; }
      }
      if (cur !== home) push(cur, home, 1, 0.13);
      WN[w] = a.length - W0[w]; WT[w] = t; WPH[w] = R() * t;
    }
    EA = Uint16Array.from(a); EB = Uint16Array.from(b); EK = Uint8Array.from(k); E0 = Float32Array.from(t0); ED = Float32Array.from(du);
  }
  const WP = new Float32Array(3 * NW * TS), WW = new Float32Array(2 * NW * TS), VP = new Float32Array(6 * NW), VA = new Float32Array(2 * NW);
  const wPos = new THREE.BufferAttribute(WP, 3), wW = new THREE.BufferAttribute(WW, 2);
  wPos.setUsage(THREE.DynamicDrawUsage); wW.setUsage(THREE.DynamicDrawUsage);
  const walkers = (() => {
    const hg = new THREE.BufferGeometry(), tg = new THREE.BufferGeometry();
    hg.setAttribute('position', wPos); hg.setAttribute('aW', wW); tg.setAttribute('position', wPos); tg.setAttribute('aW', wW);
    const hi = new Uint16Array(NW), ti = new Uint16Array(NW * (TS - 1) * 2);
    for (let w = 0; w < NW; w++) { hi[w] = w * TS; for (let j = 0; j < TS - 1; j++) { ti[2 * (w * (TS - 1) + j)] = w * TS + j; ti[2 * (w * (TS - 1) + j) + 1] = w * TS + j + 1; } }
    hg.setIndex(new THREE.BufferAttribute(hi, 1)); tg.setIndex(new THREE.BufferAttribute(ti, 1));
    const VS = `
attribute vec2 aW;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(0.028 * (1.0 + 0.4 * aW.y), mv);
  vC = mix(vec3(1.0, 0.78, 0.4), vec3(0.45, 0.85, 1.0), aW.y);
  vA = uA * aW.x;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
    const heads = new THREE.Points(hg, mat(VS, `
varying vec3 vC; varying float vA;
void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0; if (d > 1.0) discard;
  float core = smoothstep(0.5, 0.0, d), halo = pow(1.0 - d, 2.2);
  gl_FragColor = vec4(mix(vC, vec3(1.0), core * 0.7), vA * (core + halo * 0.6)); }`));
    const trails = new THREE.LineSegments(tg, mat(VS, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.003) discard; gl_FragColor = vec4(vC, vA * 0.85); }`));
    // the genes a walker has just reached glow warm for a moment
    const vg = new THREE.BufferGeometry();
    const vp = new THREE.BufferAttribute(VP, 3), va = new THREE.BufferAttribute(VA, 1);
    vp.setUsage(THREE.DynamicDrawUsage); va.setUsage(THREE.DynamicDrawUsage);
    vg.setAttribute('position', vp); vg.setAttribute('aA', va);
    const visits = new THREE.Points(vg, mat(`
attribute float aA;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(0.022 + 0.03 * aA, mv);
  vC = vec3(1.0, 0.58, 0.22); vA = uA * aA * 0.75;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`, GLOW_FS));
    for (const o of [heads, trails, visits]) { o.frustumCulled = false; o.renderOrder = 5; o.visible = false; set.group.add(o); }
    return { heads, trails, visits, vp, va };
  })();
  // the core's places at the module's current morph (the walkers only visit the core), made again only when it moves
  const CP = new Float32Array(3 * NC);
  let cpM = -1;
  function corePlaces(m) {
    if (m === cpM) return;
    cpM = m;
    if (m <= 0) CP.set(P.subarray(0, 3 * NC)); else for (let i = 0; i < NC; i++) mpos(i, m, CP, 3 * i);
  }
  // where walker w is at time tt (into out at o); sets wk.k (event kind: 0 hop, 1 restart, 2 rest), wk.f, wk.e, wk.tt
  const wk = { k: 0, f: 0, e: 0, tt: 0 };
  function walkerAt(w, tt, out, o) {
    const T = WT[w];
    tt = (tt + WPH[w]) % T; if (tt < 0) tt += T;
    let lo = W0[w], hi = lo + WN[w] - 1;
    while (lo < hi) { const mi = (lo + hi + 1) >> 1; if (E0[mi] <= tt) lo = mi; else hi = mi - 1; }
    const k = EK[lo], f = clamp((tt - E0[lo]) / ED[lo], 0, 1);
    wk.k = k; wk.f = f; wk.e = lo; wk.tt = tt;
    const a = 3 * EA[lo];
    if (k === 2) { out[o] = CP[a]; out[o + 1] = CP[a + 1]; out[o + 2] = CP[a + 2]; return; }
    const e = k === 0 ? smooth(f) : 1 - Math.pow(1 - f, 2.4), b = 3 * EB[lo];   // a hop glides, a restart streaks home
    out[o] = CP[a] + (CP[b] - CP[a]) * e; out[o + 1] = CP[a + 1] + (CP[b + 1] - CP[a + 1]) * e; out[o + 2] = CP[a + 2] + (CP[b + 2] - CP[a + 2]) * e;
  }
  let walkersOn = false;
  function updateWalkers(wv, t, m) {
    const on = wv > 0.003;
    walkers.heads.visible = walkers.trails.visible = walkers.visits.visible = on;
    if (!on) { if (walkersOn) { WW.fill(0); VA.fill(0); } walkersOn = false; return; }
    walkersOn = true;
    corePlaces(m);
    const live = wv * NW;
    for (let w = 0; w < NW; w++) {
      const aw = clamp(live - w, 0, 1), b = w * TS;
      if (aw <= 0) { for (let j = 0; j < TS; j++) WW[2 * (b + j)] = 0; VA[2 * w] = VA[2 * w + 1] = 0; continue; }
      // a home-coming walker fades into its seed, and shows again as it leaves
      walkerAt(w, t, WP, 3 * b);
      const k = wk.k, ev = wk.e, tt = wk.tt;
      let ah = 1;
      if (k === 2) { const s = tt - E0[ev], r = E0[ev] + ED[ev] - tt; ah = Math.max(0, 1 - s / 0.14, 1 - r / 0.1); }
      for (let j = 0; j < TS; j++) {
        if (j) walkerAt(w, t - j * LAG, WP, 3 * (b + j));
        WW[2 * (b + j)] = aw * (j ? 0.9 * Math.pow(1 - j / TS, 1.2) : ah) * (j && wk.k === 1 ? 0.6 : 1);
        WW[2 * (b + j) + 1] = (j ? wk.k : k) === 1 ? 1 : 0;
      }
      // the last two genes reached (not home), glowing for about a second
      let found = 0, e = ev, back = 0;
      const first = W0[w], last = first + WN[w] - 1;
      for (let n = 0; n < 8 && found < 2; n++) {
        if (EK[e] === 0) {
          const ta = E0[e] + ED[e] - back, age = tt - ta;
          if (age >= 0) {
            if (age > 2.5) break;
            if (EB[e] !== EA[first]) { const q = 3 * EB[e], v = 3 * (2 * w + found); VP[v] = CP[q]; VP[v + 1] = CP[q + 1]; VP[v + 2] = CP[q + 2]; VA[2 * w + found] = aw * Math.exp(-age / 0.7); found++; }
          }
        }
        if (e === first) { e = last; back += WT[w]; } else e--;
      }
      for (; found < 2; found++) VA[2 * w + found] = 0;
    }
    wPos.needsUpdate = wW.needsUpdate = true;
    walkers.vp.needsUpdate = walkers.va.needsUpdate = true;
  }

  // ---------------------------------------------------------------- one gene's neighbourhood: lines and a bubble
  const hoodGeo = new THREE.BufferGeometry();
  const HP = new Float32Array(6 * HS), HM = new Float32Array(6 * HS), HG = new Float32Array(6 * HS), HGM = new Float32Array(6 * HS), HH = new Float32Array(8 * HS);
  attr(hoodGeo, 'position', HP, 3); attr(hoodGeo, 'aMod', HM, 3); attr(hoodGeo, 'aG', HG, 3); attr(hoodGeo, 'aGm', HGM, 3); attr(hoodGeo, 'aH', HH, 4);
  hoodGeo.boundingSphere = BS; hoodGeo.setDrawRange(0, 0);
  const hoodLines = new THREE.LineSegments(hoodGeo, mat(`
attribute vec3 aMod, aG, aGm; attribute vec4 aH;
uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec3 me = morph(position, aMod, aH.x), g = morph(aG, aGm, aH.y);
  float grow = clamp((uHoodP - aH.z) / 0.06, 0.0, 1.0), L = length(me - g);
  vec4 mv = modelViewMatrix * vec4(mix(g, me, aH.w * grow), 1.0);
  gl_Position = projectionMatrix * mv;
  vC = mix(vec3(0.85, 0.97, 1.0), vec3(0.3, 0.82, 1.0), aH.w) * depthCue(mv);
  vA = uA * uHoodOn * step(0.001, grow) * (0.12 + 0.4 / (1.0 + L * L * 6.0)) * (1.0 - 0.4 * uMod);
}`, `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.002) discard; gl_FragColor = vec4(vC, vA); }`));
  hoodLines.renderOrder = 4; set.group.add(hoodLines);
  const bubMat = K.rim(set, { color: '#46d9ff', a0: 0.04, a1: 0.65 });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), bubMat);
  bubble.renderOrder = 6; bubble.visible = false; set.group.add(bubble);
  let hoodGene = -2;
  const hoodCtr = [new Float32Array(3), new Float32Array(3)];   // the neighbourhood's core members' middle, in the cloud and in the module view
  function setHood(g) {
    hoodGene = g;
    HA.fill(-1);
    let n = 0;
    hoodCtr[0].fill(0); hoodCtr[1].fill(0);
    if (g >= 0) {
      for (let r = HS - 1; r >= 0; r--) HA[HOOD[g * HS + r]] = r;
      const g3 = 3 * g;
      for (let r = 1; r < HS; r++) {
        const h = HOOD[g * HS + r];
        if (h >= NC) continue;
        for (let j = 0; j < 2; j++) {
          const v = 2 * n + j;
          for (let a = 0; a < 3; a++) { HP[3 * v + a] = P[3 * h + a]; HM[3 * v + a] = MT[3 * h + a]; HG[3 * v + a] = P[g3 + a]; HGM[3 * v + a] = MT[g3 + a]; }
          HH[4 * v] = ST[h]; HH[4 * v + 1] = ST[g]; HH[4 * v + 2] = r / HS; HH[4 * v + 3] = j;
        }
        for (let a = 0; a < 3; a++) { hoodCtr[0][a] += P[3 * h + a]; hoodCtr[1][a] += MT[3 * h + a]; }
        n++;
      }
      if (n) for (let a = 0; a < 3; a++) { hoodCtr[0][a] /= n; hoodCtr[1][a] /= n; }
    }
    hoodGeo.setDrawRange(0, 2 * n);
    for (const k in hoodGeo.attributes) hoodGeo.attributes[k].needsUpdate = true;
    nodeGeo.attributes.aHood.needsUpdate = true;
  }

  // ---------------------------------------------------------------- update
  let apiGene = -1;
  const cur = { m: 0, gene: -1, hoodOn: 0 };
  const _g = new Float32Array(3);
  function update(S, t) {
    const cl = clamp(S.net_cloud, 0, 1), sd = clamp(S.net_seeds, 0, 1), kk = clamp(S.net_k, 0, NK - 1), wv = clamp(S.net_walk, 0, 1) * cl;
    const ht = clamp(S.net_heat, 0, 1), md = clamp(S.net_module, 0, 1), en = clamp(S.net_endo, 0, 1), hd = clamp(S.net_hood, 0, 1), fc = clamp(S.net_focus || 0, 0, NE);
    const pg = S.net_gene >= -0.5 ? Math.round(S.net_gene) : -1, g = pg >= 0 && pg < NM ? pg : apiGene;
    cur.m = md; cur.gene = g;
    if (g !== hoodGene) setHood(g);
    const hoodOn = g >= 0 ? prog(hd, 0, 0.3) : 0, mark = g >= 0 ? Math.max(hoodOn, pg < 0 ? 1 : 0) : 0;
    // the seed groups give way to the walk, its heat, the module and a neighbourhood
    // (below net_seeds 0.5 only the seeds glow: the story dims them to 0.4 for the neighbourhood chapter)
    const gk = prog(sd, 0.5, 1) * cl * (1 - Math.max(ht, md, hoodOn, en)) * (1 - 0.8 * wv);
    const lo = Math.floor(kk), hi = Math.min(NK - 1, lo + 1), f = kk - lo, kv = lerp(KV[lo], KV[hi], f);
    cur.hoodOn = hoodOn;
    U.uCloud.value = cl; U.uSeeds.value = sd; U.uKv.value = kv; U.uGk.value = gk; U.uHeat.value = ht; U.uMod.value = md; U.uEndo.value = en;
    U.uFocus.value = fc; U.uHoodP.value = g >= 0 ? prog(hd, 0.2, 1) * 1.06 : 0; U.uHoodOn.value = hoodOn; U.uMark.value = mark;
    // seeds stay white in the module, softer when one endotype is in focus
    U.uHot.value = Math.max(sd, ht, md * (1 - 0.7 * Math.min(fc, 1))) * cl;
    U.uLo.value = lo; U.uHi.value = hi; U.uKf.value = f;
    const sc = U.uSeedCol.value;
    for (let i = 0; i < 3 * NS; i++) sc[i] = lerp(GC[lo * 3 * NS + i], GC[hi * 3 * NS + i], f);
    // halos round the seeds grow with k (softer as they grow, so 35 of them merge into one glow)
    halo.mesh.visible = arcs.mesh.visible = gk > 0.003;
    if (gk > 0.003) {
      for (let s = 0; s < NS; s++) mpos(SEED[s], md, SCTR, 3 * s);
      halo.g.attributes.aCtr.needsUpdate = true;
      halo.m.uniforms.uHaloR.value = 0.04 + 0.021 * Math.sqrt(kv);
      halo.m.uniforms.uHaloA.value = 0.5 * gk / (1 + kv / 25);
    }
    // the gene's bubble
    bubble.visible = g >= 0 && mark > 0.003;
    if (bubble.visible) { mpos(g, md, _g, 0); bubble.position.set(_g[0], _g[1], _g[2]); bubble.scale.setScalar(0.055 + 0.03 * hoodOn); bubMat.uniforms.uK.value = mark * cl; }
    updateWalkers(wv, t, md);
  }

  // ---------------------------------------------------------------- anchors, labels, views
  // anchor functions write into their own arrays (no garbage per frame): copy one to keep it
  const _c = [0, 0, 0];
  const at = (i, out) => mpos(i, cur.m, out, 0);
  const centroid = (a, b, out) => { out[0] = out[1] = out[2] = 0; for (let i = a; i < b; i++) { at(i, _c); out[0] += _c[0]; out[1] += _c[1]; out[2] += _c[2]; } const n = Math.max(1, b - a); out[0] /= n; out[1] /= n; out[2] /= n; return out; };
  const seedMid = out => { out[0] = out[1] = out[2] = 0; for (let s = 0; s < NS; s++) { at(SEED[s], _c); for (let a = 0; a < 3; a++) out[a] += _c[a] / NS; } return out; };
  const own = f => { const o = [0, 0, 0]; return () => f(o); };
  // the topmost seed carries the "35 seed genes" label
  let topSeed = SEED[0]; for (let s = 0; s < NS; s++) if (P[3 * SEED[s] + 1] > P[3 * topSeed + 1]) topSeed = SEED[s];
  const runs = ENDO.map((_, e) => { let a = -1, b = -1; for (let i = 0; i < NM; i++) if (GENE[i] === e) { if (a < 0) a = i; b = i + 1; } return [a, b]; });
  let modTop = 0; for (let i = 0; i < NM; i++) modTop = Math.max(modTop, MODP[3 * i + 1]);
  const anchors = {
    centre: [0, 0, 0],
    cloud: [1.25, 1.55, 0.7],
    module: own(o => centroid(0, NM, o)),
    moduleTop: own(o => { o[0] = o[2] = 0; o[1] = lerp(1.15, modTop + 0.1, smooth(cur.m)); return o; }),
    seeds: own(seedMid),
    seedTop: own(o => at(topSeed, o)),
    k: [0.35, 0.95, 0.2],
    gene: own(o => (cur.gene >= 0 ? at(cur.gene, o) : centroid(0, NM, o))),
    hood: own(o => { const n = smooth(cur.m); for (let a = 0; a < 3; a++) o[a] = cur.gene >= 0 ? lerp(hoodCtr[0][a], hoodCtr[1][a], n) : 0; return o; }),
  };
  runs.forEach(([a, b], e) => { anchors['e' + e] = own(o => centroid(a, b, o)); });
  const SYM = D.seeds.map(s => s[0]), seedNamed = sym => SEED[SYM.indexOf(sym)];
  const quiet = S => 1 - Math.max(clamp(S.net_walk, 0, 1), clamp(S.net_heat, 0, 1), clamp(S.net_module, 0, 1), clamp(S.net_endo, 0, 1), cur.hoodOn || 0);
  const kOf = S => clamp(S.net_k, 0, NK - 1);
  const fmt = n => n.toLocaleString('en-GB');
  const labels = [
    { text: [fmt(FA.genes), 'proteins'], cls: 'cyn', at: 'cloud', alpha: S => prog(S.net_cloud, 0.5, 1) * (1 - prog(S.net_seeds, 0, 0.4)) * (1 - clamp(S.net_module, 0, 1)) * (1 - (cur.hoodOn || 0)) },
    { text: [`${NS} seed genes`, ''], cls: '', at: 'seedTop', alpha: S => prog(S.net_seeds, 0.3, 0.8) * (1 - prog(kOf(S), 0.02, 0.25)) * quiet(S) },
    ...['CHRNA1', 'MUSK', 'AGRN', 'DOK7'].map(sym => ({ text: [sym, ''], cls: '', at: own(o => at(seedNamed(sym), o)), minor: true,
      alpha: S => prog(S.net_seeds, 0.5, 1) * (1 - prog(kOf(S), 0.02, 0.25)) * quiet(S) })),
    ...KV.map((k, i) => ({ text: [`k = ${k}`, `· ${groupCount[i] === 1 ? 'one group' : groupCount[i] + ' groups'}`], cls: 'amb', at: 'k',
      alpha: S => prog(S.net_seeds, 0.5, 1) * clamp((0.5 - Math.abs(kOf(S) - i)) * 4.5, 0, 1) * (i ? 1 : prog(kOf(S), 0.04, 0.2)) * quiet(S) * (1 - clamp(S.net_endo, 0, 1)) })),
    { text: ['The module', `· ${fmt(FA.module)} genes`], cls: 'amb', at: 'moduleTop', alpha: S => prog(S.net_module, 0.6, 1) * (1 - (cur.hoodOn || 0)) * (1 - clamp(S.net_focus || 0, 0, 1)) },
    // the current gene's name: the story's genes are seeds; explore mode labels any other gene at the 'gene' anchor
    ...Array.from(SEED).map((i, s) => ({ text: [SYM[s], `· ${HS}-gene neighbourhood`], cls: 'cyn', at: own(o => at(i, o)),
      alpha: S => (cur.gene === i ? 1 : 0) * prog(clamp(S.net_hood, 0, 1), 0.05, 0.35) })),
  ];
  // a view of gene i from outside the cloud, the gene in front
  function geneView(i) {
    if (!(i >= 0 && i < NM)) return [20, 10, 2.9, 0, 0, 0];
    const p = at(i, [0, 0, 0]), az = Math.atan2(p[0], p[2]) * 180 / Math.PI;
    return [Math.round(az + 12), 12, cur.m > 0.5 ? 1.8 : 2.4, +p[0].toFixed(3), +p[1].toFixed(3), +p[2].toFixed(3)];
  }
  const cam = { default: [18, 12, 6.8, 0, 0, 0], core: [24, 10, 4.4, 0, 0, 0], module: [20, 8, 2.9, 0, 0, 0], seeds: [-28, 14, 3.6, 0, 0, 0] };
  Object.defineProperty(cam, 'gene', { enumerable: true, get: () => geneView(cur.gene) });
  const controls = [
    { key: 'view', label: 'View', options: [['network', 'Network'], ['module', 'Module']] },
    { key: 'walkers', label: 'Walkers', options: [['off', 'Off'], ['on', 'On']] },
    { key: 'colour', label: 'Colour', options: [['walk', 'Walk'], ['endo', 'Endotypes']] },
  ];
  function explore(c) {
    return { net_cloud: 1, net_seeds: 1, net_module: c.view === 'module' ? 1 : 0, net_walk: c.walkers === 'on' ? 1 : 0,
      net_heat: c.colour === 'walk' ? 1 : 0, net_endo: c.colour === 'endo' ? 1 : 0 };
  }

  // ---------------------------------------------------------------- explore API
  const BYNAME = new Map(MNAMES.map((s, i) => [s.toUpperCase(), i]));
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray(), _q = new Float32Array(3);
  function pick(raycaster) {
    set.group.updateMatrixWorld();
    _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(set.group.matrixWorld).invert());
    const o = _ray.origin, d = _ray.direction;
    let best = -1, bs = 1;
    for (let i = 0; i < NM; i++) {
      mpos(i, cur.m, _q, 0);
      const x = _q[0] - o.x, y = _q[1] - o.y, z = _q[2] - o.z, along = x * d.x + y * d.y + z * d.z;
      if (along <= 0) continue;
      const off = Math.sqrt(Math.max(0, x * x + y * y + z * z - along * along)), tol = 0.02 + 0.014 * along, s = off / tol;
      if (s < bs) { bs = s; best = i; }
    }
    return best;
  }
  const API = {
    names: MNAMES,
    setGene: i => { apiGene = i >= 0 && i < NM ? i | 0 : -1; },
    geneIndex: name => { const i = BYNAME.get(String(name || '').trim().toUpperCase()); return i === undefined ? -1 : i; },
    pick,
    seeds: Array.from(SEED),                 // module indices of the 35 seeds, in the Gene Table's order
    kValues: KV.slice(), groupCount,         // the 13 neighbourhood sizes and the number of seed groups at each
    endoOf: i => (i >= 0 && i < NM ? GENE[i] : -1),
    geneView,                                // [az, el, dist, tx, ty, tz] near module gene i
    hoodCore: i => { const o = []; if (i >= 0 && i < NM) for (let r = 1; r < HS; r++) if (HOOD[i * HS + r] < NC) o.push(HOOD[i * HS + r]); return o; },
  };
  return Object.assign(set, {
    params: { net_a: 1, net_cloud: 1, net_seeds: 0, net_k: 0, net_walk: 0, net_heat: 0, net_module: 0, net_endo: 0, net_gene: -1, net_hood: 0, net_focus: 0 },
    update, anchors, labels, cam, controls, explore, api: () => API,
  });
};
