// soil: a cut-away block of soil with a wheat plant, its roots and root hairs; fertiliser dissolving into ammonium, part
// of it climbing the roots, the rest turned by the microbes' relay into nitrate that sinks out of the block or into
// nitrous oxide that rises from it; the relay itself in a soil pore, magnified; the BNI halo round the roots that slows
// the relay; the chromosome segment from the wild grass; one marked nitrogen atom's path. All illustrative: the shares
// of the flows are a drawing (only "less than half reaches the plant" is the slides'), and so are the pore, the halo
// and the chromosomes. Manifest: soil.md.
// Frame: the block centred on the origin, its surface at y = 0 (1.2 wide in x, 0.8 deep in z, 0.7 down); the wheat at
// the origin, its ear's top near y = 0.85, its roots down to about y = -0.6. The story faces +z: the side of the block
// nearer the viewer turns to glass as soil_cut goes to 1 (whichever side that is, so it works from any angle in a
// headset), and the soil grains in front of the plant thin out.
SETS.soil = function (K) {
  const { THREE, clamp, prog, smooth, rng } = K;
  const set = K.newSet('soil');
  const LK = TLOOK(K, set), C = SLOOK.rgb;
  const TAU = Math.PI * 2;
  const R0 = rng(31);
  // ------------------------------------------------------------------ shared shader parts
  const LIGHT = 'vec3 l = normalize(vec3(-0.45, 0.55, 0.7));';
  const NOISE = `
float hsh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hsh(i + vec3(0.0, 1.0, 0.0)), hsh(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hsh(i + vec3(0.0, 0.0, 1.0)), hsh(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hsh(i + vec3(0.0, 1.0, 1.0)), hsh(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
// the soil's profile by depth: dark humus on top, loam, a lighter subsoil below; mottled, with specks of sand
vec3 profile(vec3 p) {
  float n = vnoise(p * 38.0) * 0.6 + vnoise(p * 95.0) * 0.4;
  float y = -p.y + 0.03 * (vnoise(p * 7.0) - 0.5);
  vec3 c = mix(vec3(0.12, 0.085, 0.06), vec3(0.23, 0.165, 0.118), smoothstep(0.03, 0.12, y));
  c = mix(c, vec3(0.33, 0.235, 0.16), smoothstep(0.24, 0.38, y));
  c = mix(c, vec3(0.43, 0.32, 0.21), smoothstep(0.5, 0.62, y));
  c *= 0.72 + 0.56 * n;
  c = mix(c, vec3(0.68, 0.56, 0.4), step(0.9, vnoise(p * 170.0)) * 0.65);
  return c;
}`;
  const LITCOL = `
  vec3 n = normalize(vN), v = normalize(vV); if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - abs(dot(n, v)), 2.2), spec = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);`;
  // the magnified pore (all the block's things hide inside its bubble while it shows)
  const PORE = { uPc: { value: new THREE.Vector3(0.18, -0.28, 0.25) }, uRad: { value: 0 }, uPore: { value: 0 }, uDim: { value: 0 } };
  const shader = (o) => {
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, PORE, o.uniforms || {}), vertexShader: o.vertex, fragmentShader: o.fragment,
      transparent: true, side: o.side === undefined ? THREE.DoubleSide : o.side, blending: o.blending || THREE.NormalBlending, depthWrite: o.depthWrite !== false });
    if (o.fixed) m.userData.fixed = true;
    set.mats.push(m);
    return m;
  };
  // a geometry builder: position, normal, aCol, aBase (the point a vertex shrinks to while it grows), aG (x: the growth
  // at which it is fully out, y: how long it takes to grow, z: sway weight, w: which plant: 0 wheat, 1 wild grass)
  function GB() {
    const P = [], N = [], Cc = [], B = [], G = [], I = [];
    const b = {
      P, I,
      v(p, n, c, base, g) { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); Cc.push(c[0], c[1], c[2]); B.push(base[0], base[1], base[2]); G.push(g[0], g[1], g[2], g[3]); return P.length / 3 - 1; },
      tri(a, c, d) { I.push(a, c, d); },
      geo() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('aCol', new THREE.Float32BufferAttribute(Cc, 3));
        g.setAttribute('aBase', new THREE.Float32BufferAttribute(B, 3));
        g.setAttribute('aG', new THREE.Float32BufferAttribute(G, 4));
        g.setIndex(I);
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
        return g;
      },
    };
    return b;
  }
  // a tube along pts with radius R[i], grown at G[i] (span sp), coloured col[i], swaying W[i]; rad sides
  function tube(b, pts, R, G, col, W, which, sp, rad) {
    const n = pts.length, base = b.P.length / 3;
    let nx = 1, ny = 0, nz = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)];
      let tx = c[0] - a[0], ty = c[1] - a[1], tz = c[2] - a[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let d = nx * tx + ny * ty + nz * tz; nx -= d * tx; ny -= d * ty; nz -= d * tz;
      let nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-3) { nx = Math.abs(tx) < 0.9 ? 1 : 0; ny = Math.abs(tx) < 0.9 ? 0 : 1; nz = 0; d = nx * tx + ny * ty; nx -= d * tx; ny -= d * ty; nz -= d * tz; nl = Math.hypot(nx, ny, nz); }
      nx /= nl; ny /= nl; nz /= nl;
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      for (let j = 0; j < rad; j++) {
        const an = j / rad * TAU, cs = Math.cos(an), sn = Math.sin(an), ox = nx * cs + bx * sn, oy = ny * cs + by * sn, oz = nz * cs + bz * sn;
        b.v([p[0] + ox * R[i], p[1] + oy * R[i], p[2] + oz * R[i]], [ox, oy, oz], col[i], p, [G[i], sp, W[i], which]);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < rad; j++) {
      const a = base + i * rad + j, c = base + i * rad + (j + 1) % rad;
      b.tri(a, a + rad, c); b.tri(c, a + rad, c + rad);
    }
  }
  // a small ellipsoid (a spikelet, a grain of the ear): centre c, half-axes along u (long), s (side), and their cross
  function ellipsoid(b, c, u, s, ru, rs, rt, col, base, g, segs = 6, rings = 4) {
    const t = K.v3.norm(K.v3.cross(u, s)), first = b.P.length / 3;
    for (let i = 0; i <= rings; i++) {
      const th = i / rings * Math.PI, ct = Math.cos(th), st = Math.sin(th);
      for (let j = 0; j < segs; j++) {
        const ph = j / segs * TAU, x = st * Math.cos(ph), y = st * Math.sin(ph);
        const p = [c[0] + u[0] * ct * ru + s[0] * x * rs + t[0] * y * rt, c[1] + u[1] * ct * ru + s[1] * x * rs + t[1] * y * rt, c[2] + u[2] * ct * ru + s[2] * x * rs + t[2] * y * rt];
        const nn = K.v3.norm([u[0] * ct / ru + s[0] * x / rs + t[0] * y / rt, u[1] * ct / ru + s[1] * x / rs + t[1] * y / rt, u[2] * ct / ru + s[2] * x / rs + t[2] * y / rt]);
        b.v(p, nn, col, base, g);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
      const a = first + i * segs + j, c2 = first + i * segs + (j + 1) % segs;
      b.tri(a, a + segs, c2); b.tri(c2, a + segs, c2 + segs);
    }
  }
  // a leaf: a strip along a drooping curve from 'at', heading azimuth az, rising at e0, length len, width w; folded
  // along its midrib
  function leaf(b, at, az, e0, len, w, colBase, colTip, g, which, droop = 1.25, segs = 12) {
    const hx = Math.cos(az), hz = Math.sin(az), sx = -hz, sz = hx;
    let p = at.slice();
    const pts = [p.slice()];
    for (let k = 1; k <= segs; k++) {
      const s = k / segs, e = e0 - (e0 + 0.7) * Math.pow(s, droop), d = len / segs;
      p = [p[0] + hx * Math.cos(e) * d, p[1] + Math.sin(e) * d, p[2] + hz * Math.cos(e) * d];
      pts.push(p.slice());
    }
    const first = b.P.length / 3;
    for (let k = 0; k <= segs; k++) {
      const s = k / segs, q = pts[k], a = pts[Math.max(0, k - 1)], c = pts[Math.min(segs, k + 1)];
      const t = K.v3.norm([c[0] - a[0], c[1] - a[1], c[2] - a[2]]), side = [sx, 0, sz], nrm = K.v3.norm(K.v3.cross(side, t));
      const ww = w * Math.pow(Math.max(0, 1 - Math.pow(s, 1.5)), 0.8) * (0.35 + 0.65 * smooth(s * 5)), fold = ww * 0.3;
      const col = K.v3.lerp(colBase, colTip, s), sw = (q[1] / 0.85) * (q[1] / 0.85) + s * 0.35;
      for (const [o, f] of [[-1, 1], [0, 0], [1, 1]]) {
        b.v([q[0] + sx * ww * o - nrm[0] * fold * f, q[1] - nrm[1] * fold * f, q[2] + sz * ww * o - nrm[2] * fold * f], nrm, col, at, [g, 0.08, sw, which]);
      }
    }
    for (let k = 0; k < segs; k++) for (let j = 0; j < 2; j++) {
      const a = first + k * 3 + j;
      b.tri(a, a + 3, a + 1); b.tri(a + 1, a + 3, a + 4);
    }
  }
  // ------------------------------------------------------------------ the roots (illustrative: a fibrous wheat root
  // system, seminal and crown roots with laterals, kept inside the block)
  const ROOTS = [];   // { pts, R, G, parent, at } (main roots first)
  {
    const r = rng(7), NM = 8, inside = p => [clamp(p[0], -0.56, 0.56), Math.max(-0.66, Math.min(-0.012, p[1])), clamp(p[2], -0.36, 0.36)];
    for (let k = 0; k < NM; k++) {
      const az = k / NM * TAU + (r() - 0.5) * 0.5, out = 0.35 + r() * 0.55, len = 0.5 + r() * 0.16, n = 17;
      let d = K.v3.norm([Math.cos(az) * out, -1, Math.sin(az) * out * 0.8]), p = [Math.cos(az) * 0.01, -0.015, Math.sin(az) * 0.01];
      const pts = [p.slice()];
      for (let i = 1; i < n; i++) {
        const w = [(r() - 0.5) * 0.5, -0.25 - 0.1 * i / n, (r() - 0.5) * 0.5];
        d = K.v3.norm(K.v3.add(d, K.v3.mul(w, 0.35)));
        p = inside(K.v3.add(p, K.v3.mul(d, len / (n - 1))));
        pts.push(p);
      }
      const R = pts.map((q, i) => 0.011 * (1 - 0.55 * i / (n - 1))), G = pts.map((q, i) => 0.03 + 0.62 * i / (n - 1));
      ROOTS.push({ pts, R, G, parent: -1, at: 0 });
    }
    for (let k = 0; k < NM; k++) {
      const M = ROOTS[k], nl = 7 + Math.floor(r() * 3);
      for (let j = 0; j < nl; j++) {
        const at = 2 + Math.floor((j + r() * 0.8) / nl * (M.pts.length - 4)), p0 = M.pts[at], len = 0.07 + r() * 0.13 * (1 - at / M.pts.length * 0.5), n = 7;
        const t = K.v3.norm(K.v3.sub(M.pts[at + 1], M.pts[at - 1])), side = K.v3.norm(K.v3.cross(t, K.unit(r)));
        let d = K.v3.norm(K.v3.add(side, [0, -0.35, 0])), p = p0.slice();
        const pts = [p.slice()];
        for (let i = 1; i < n; i++) { d = K.v3.norm(K.v3.add(d, [(r() - 0.5) * 0.3, -0.12, (r() - 0.5) * 0.3])); p = inside(K.v3.add(p, K.v3.mul(d, len / (n - 1)))); pts.push(p); }
        const g0 = M.G[at] + 0.02, R = pts.map((q, i) => 0.0046 * (1 - 0.5 * i / (n - 1))), G = pts.map((q, i) => g0 + 0.22 * i / (n - 1));
        ROOTS.push({ pts, R, G, parent: k, at });
        // a few second-order laterals
        if (r() < 0.55) {
          const a2 = 2 + Math.floor(r() * 3), q0 = pts[a2], d2 = K.v3.norm(K.v3.add(K.unit(r), [0, -0.6, 0])), n2 = 4, l2 = 0.03 + r() * 0.04;
          const p2 = [q0.slice()];
          for (let i = 1; i < n2; i++) p2.push(inside(K.v3.add(p2[i - 1], K.v3.mul(d2, l2 / (n2 - 1)))));
          ROOTS.push({ pts: p2, R: p2.map((q, i) => 0.0026 * (1 - 0.4 * i / (n2 - 1))), G: p2.map((q, i) => Math.min(0.94, G[a2] + 0.03 + 0.12 * i / (n2 - 1))), parent: ROOTS.length - 1, at: a2 });
        }
      }
    }
  }
  // points along the roots, for the halo and the hairs (with the growth at which each is there)
  const RPTS = [];
  for (const Rt of ROOTS) for (let i = 1; i < Rt.pts.length; i++) {
    const a = Rt.pts[i - 1], b = Rt.pts[i], L = K.v3.dist(a, b), m = Math.max(1, Math.round(L / 0.01));
    for (let k = 0; k < m; k++) { const f = (k + 0.5) / m; RPTS.push({ p: K.v3.lerp(a, b, f), t: K.v3.norm(K.v3.sub(b, a)), g: Rt.G[i - 1] + (Rt.G[i] - Rt.G[i - 1]) * f, r: Rt.R[i] }); }
  }
  // ------------------------------------------------------------------ the plant: wheat (and the wild grass beside the block)
  const LEAF0 = SLOOK.chl(56), LEAF1 = SLOOK.chl(63), STEM = SLOOK.chl(58), EAR = SLOOK.mix(SLOOK.chl(54), C(SLOOK.SOIL.ear), 0.35), AWN = SLOOK.mix(EAR, [1, 1, 0.85], 0.25);
  const ROOTC = C(SLOOK.SOIL.root), ROOTT = SLOOK.mix(ROOTC, [1, 1, 1], 0.4), ROOTB = SLOOK.mix(ROOTC, C(SLOOK.SOIL.grain), 0.35);
  const GRASS0 = C('#5f8f8a'), GRASS1 = C('#a9cfc8'), GSPIKE = C('#b9c9a0');
  const EARTOP = [0, 0, 0];
  const plantB = GB();
  // the roots
  for (const Rt of ROOTS) {
    const n = Rt.pts.length, col = Rt.pts.map((q, i) => SLOOK.mix(Rt.parent < 0 ? ROOTB : ROOTC, ROOTT, Math.pow(i / (n - 1), 2)));
    tube(plantB, Rt.pts, Rt.R, Rt.G, col, Rt.pts.map(() => 0), 0, 0.05, Rt.parent < 0 ? 6 : 4);
  }
  // a tiller: its stem, four leaves and its ear
  function tiller(b, foot, lean, lAz, h, earLen, g0, which, cols) {
    const n = 14, pts = [];
    for (let i = 0; i < n; i++) { const s = i / (n - 1); pts.push([foot[0] + Math.cos(lAz) * lean * s * s * h, foot[1] + s * h, foot[2] + Math.sin(lAz) * lean * s * s * h]); }
    const R = pts.map((q, i) => (which ? 0.0045 : 0.0062) * (1 - 0.3 * i / (n - 1))), G = pts.map((q, i) => g0 + 0.5 * i / (n - 1));
    tube(b, pts, R, G, pts.map(() => cols.stem), pts.map(q => (q[1] / 0.85) * (q[1] / 0.85)), which, 0.08, 6);
    const top = pts[n - 1], dir = K.v3.norm(K.v3.sub(top, pts[n - 3]));
    // leaves at the nodes (the flag leaf highest)
    const nl = cols.leaves;
    for (let k = 0; k < nl; k++) {
      const s = 0.05 + k / nl * 0.62, at = pts[Math.round(s * (n - 1))], az = lAz + (k % 2 ? Math.PI : 0) + (k * 0.9) % 1 - 0.5;
      leaf(b, at, az, cols.e0 + 0.15 * k / nl, cols.len * (1 - 0.18 * k / nl), cols.w, cols.leaf0, cols.leaf1, g0 + 0.12 + 0.5 * s, which, cols.droop);
    }
    // the ear: spikelets in two rows along the rachis, each with an awn
    const ns = which ? 22 : 15, g = g0 + 0.62, side = K.v3.norm(K.v3.cross(dir, [Math.cos(lAz + 1.2), 0, Math.sin(lAz + 1.2)]));
    for (let k = 0; k < ns; k++) {
      const s = k / (ns - 1), c = K.v3.add(top, K.v3.mul(dir, s * earLen)), o = k % 2 ? 1 : -1, taper = 1 - 0.35 * Math.pow(Math.abs(s - 0.4) / 0.6, 2);
      const u = K.v3.norm(K.v3.add(dir, K.v3.mul(side, o * 0.55))), cc = K.v3.add(c, K.v3.mul(side, o * (which ? 0.004 : 0.0065) * taper));
      ellipsoid(b, cc, u, side, (which ? 0.009 : 0.012) * taper, (which ? 0.0045 : 0.0065) * taper, (which ? 0.004 : 0.0055) * taper, cols.ear, c, [g, 0.1, (c[1] / 0.85) * (c[1] / 0.85), which], 5, 3);
      if (!which) {
        const a0 = K.v3.add(cc, K.v3.mul(u, 0.011)), a1 = K.v3.add(a0, K.v3.mul(K.v3.norm(K.v3.add(u, K.v3.mul(dir, 1.6))), 0.05 + 0.02 * s));
        tube(b, [a0, a1], [0.0011, 0.0003], [g, g], [cols.awn, cols.awn], [(a0[1] / 0.85) ** 2, (a1[1] / 0.85) ** 2], which, 0.1, 3);
        if (a1[1] > EARTOP[1]) EARTOP.splice(0, 3, ...a1);
      }
    }
    return top;
  }
  const WHEAT = { stem: STEM, leaves: 4, e0: 1.05, len: 0.3, w: 0.016, leaf0: LEAF0, leaf1: LEAF1, droop: 1.25, ear: EAR, awn: AWN };
  const EARS = [tiller(plantB, [0, 0, 0], 0.02, 0.4, 0.64, 0.12, 0.0, 0, WHEAT), tiller(plantB, [0.008, 0, 0.006], 0.16, 0.6, 0.57, 0.105, 0.03, 0, WHEAT),
    tiller(plantB, [-0.008, 0, -0.004], 0.18, 3.6, 0.54, 0.1, 0.05, 0, WHEAT)];
  // the wild grass: a clump of tall glaucous blades and three dense spikes (Leymus racemosus, drawn)
  const GRASS = [-0.86, 0, -0.1];
  {
    const r = rng(12);
    for (let k = 0; k < 18; k++) {
      const a = r() * TAU, foot = [GRASS[0] + Math.cos(a) * 0.02 * r(), 0, GRASS[2] + Math.sin(a) * 0.02 * r()];
      leaf(plantB, foot, a, 1.35 - r() * 0.2, 0.5 + r() * 0.45, 0.011 + r() * 0.006, GRASS0, GRASS1, 0.05 + r() * 0.3, 1, 1.9);
    }
    const GR = { stem: C('#7fa89c'), leaves: 2, e0: 1.2, len: 0.35, w: 0.01, leaf0: GRASS0, leaf1: GRASS1, droop: 1.8, ear: GSPIKE, awn: GSPIKE };
    tiller(plantB, [GRASS[0], 0, GRASS[2]], 0.05, 1.0, 0.86, 0.17, 0.1, 1, GR);
    tiller(plantB, [GRASS[0] + 0.01, 0, GRASS[2] + 0.01], 0.12, 5.5, 0.78, 0.15, 0.15, 1, GR);
    tiller(plantB, [GRASS[0] - 0.01, 0, GRASS[2] - 0.01], 0.15, 2.6, 0.72, 0.14, 0.2, 1, GR);
  }
  const plantMat = shader({
    uniforms: { uGrow: { value: 1 }, uGrass: { value: 0 }, uRootA: { value: 1 } },
    vertex: `attribute vec3 aCol, aBase; attribute vec4 aG;
uniform float uGrow, uGrass, uTime;
varying vec3 vC, vN, vV, vP; varying float vRoot;
void main() {
  float g = aG.w > 0.5 ? uGrass : uGrow;
  float k = clamp((g - aG.x) / aG.y, 0.0, 1.0);
  vec3 p = aBase + (position - aBase) * k;
  float ph = aG.w * 2.3;
  p.x += aG.z * (0.02 * sin(uTime * 1.2 + ph) + 0.006 * sin(uTime * 2.9 + p.y * 9.0 + ph));
  p.z += aG.z * 0.013 * sin(uTime * 0.93 + 1.3 + ph);
  vP = p; vRoot = step(p.y, -0.004) * (1.0 - aG.w);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = aCol;
  gl_Position = projectionMatrix * mv;
}`,
    fragment: `uniform float uA, uDim, uPore, uRad, uRootA; uniform vec3 uPc;
varying vec3 vC, vN, vV, vP; varying float vRoot;
void main() {
  if (uPore > 0.01 && distance(vP, uPc) < uRad * 1.03) discard;
  ${LITCOL}
  vec3 col = vC * (0.34 + 0.55 * dif + 0.2 * hemi) + vC * rim * 0.55 + vec3(spec * 0.16);
  col *= 1.0 - 0.75 * uDim;
  gl_FragColor = vec4(col, uA * mix(1.0, uRootA, vRoot));
}`,
  });
  const plant = new THREE.Mesh(plantB.geo(), plantMat);
  plant.frustumCulled = false;
  set.group.add(plant);
  // root hairs: fine, pale, along the younger parts of the roots
  const hairs = (() => {
    const r = rng(9), list = [];
    for (const q of RPTS) {
      if (q.p[1] > -0.06 || r() > 0.85) continue;
      for (let k = 0; k < 2; k++) {
        const o = K.v3.norm(K.v3.cross(q.t, K.unit(r))), L = 0.008 + r() * 0.014, a = K.v3.add(q.p, K.v3.mul(o, q.r));
        list.push([a, K.v3.add(a, K.v3.add(K.v3.mul(o, L), [0, -L * 0.2, 0])), q.g + 0.04]);
      }
    }
    const g = K.linesGeo(list.length), P = g.attributes.position.array, Cl = g.attributes.aCol.array, A = g.attributes.aA.array, T = g.attributes.aT.array, hc = C(SLOOK.SOIL.rootHair);
    list.forEach(([a, b, t], i) => { P.set(a, 6 * i); P.set(b, 6 * i + 3); Cl.set(hc, 6 * i); Cl.set(hc, 6 * i + 3); A[2 * i] = 0.55; A[2 * i + 1] = 0.12; T[2 * i] = T[2 * i + 1] = t; });
    const m = K.lines(set, { uniforms: PORE, head: 'uniform vec3 uPc; uniform float uRad, uPore, uDim;', vertex: 'if (uPore > 0.01 && distance(position, uPc) < uRad) vA = 0.0; vA *= 1.0 - 0.85 * uDim;' });
    const L = new THREE.LineSegments(g, m); L.frustumCulled = false; L.renderOrder = 1;
    set.group.add(L);
    return { mesh: L, m };
  })();
  // ------------------------------------------------------------------ the block: its faces (the near ones turn to glass)
  const faceMat = shader({
    fixed: true, depthWrite: false,
    uniforms: { uCut: { value: 1 }, uEdge: { value: new THREE.Color(...C(SLOOK.SOIL.water)) } },
    vertex: `varying vec3 vN, vV, vP; void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragment: `uniform float uA, uCut, uDim; uniform vec3 uEdge; varying vec3 vN, vV, vP;
${NOISE}
void main() {
  ${LITCOL}
  float dx = 0.6 - abs(vP.x), dy = min(-vP.y, vP.y + 0.7), dz = 0.4 - abs(vP.z);
  float e = dx + dy + dz - min(dx, min(dy, dz)) - max(dx, max(dy, dz));   // (the distance to the nearest edge)
  float edge = smoothstep(0.006, 0.0, e), cut = gl_FrontFacing ? uCut : 0.0;
  vec3 pc = profile(vP), col = pc * (0.45 + 0.5 * dif + 0.18 * hemi);
  col *= 1.0 - 0.75 * uDim;
  vec3 glass = pc * 0.9 + uEdge * edge * 0.7;
  gl_FragColor = vec4(mix(col, glass, cut), uA * mix(1.0, 0.1 + 0.6 * edge, cut));
}`,
  });
  {
    const fs = [];
    const face = (w, h, rot, pos) => { const g = new THREE.PlaneGeometry(w, h); g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot))); g.translate(...pos); fs.push(g); };
    face(1.2, 0.7, [0, 0, 0], [0, -0.35, 0.4]); face(1.2, 0.7, [0, Math.PI, 0], [0, -0.35, -0.4]);
    face(0.8, 0.7, [0, Math.PI / 2, 0], [0.6, -0.35, 0]); face(0.8, 0.7, [0, -Math.PI / 2, 0], [-0.6, -0.35, 0]);
    face(1.2, 0.8, [Math.PI / 2, 0, 0], [0, -0.7, 0]);
    const g = K.merge(fs.map(x => { x.deleteAttribute('uv'); return x; }));
    const faces = new THREE.Mesh(g, faceMat); faces.renderOrder = 2; faces.frustumCulled = false;
    set.group.add(faces);
  }
  // the surface: crumbly topsoil, a little uneven (from below, the profile's humus)
  const surfMat = shader({
    vertex: `varying vec3 vN, vV, vP; void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragment: `uniform float uA, uDim; varying vec3 vN, vV, vP;
${NOISE}
void main() {
  ${LITCOL}
  float c1 = vnoise(vP * 60.0), c2 = vnoise(vP * 160.0);
  vec3 top = mix(vec3(0.16, 0.11, 0.075), vec3(0.3, 0.215, 0.15), c1 * 0.7 + c2 * 0.3) * (0.8 + 0.4 * step(0.8, c2));
  vec3 col = gl_FrontFacing ? top : profile(vP) * 0.8;
  col = col * (0.45 + 0.55 * dif + 0.2 * hemi) + col * rim * 0.3;
  gl_FragColor = vec4(col * (1.0 - 0.75 * uDim), uA);
}`,
  });
  {
    const g = new THREE.PlaneGeometry(1.2, 0.8, 48, 32);
    g.rotateX(-Math.PI / 2);
    const P = g.attributes.position.array;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], z = P[i + 2], edge = Math.min(0.6 - Math.abs(x), 0.4 - Math.abs(z));
      P[i + 1] = edge < 0.012 ? 0 : 0.004 * Math.sin(x * 41 + 1.3) * Math.sin(z * 37) + 0.003 * Math.sin(x * 97 + z * 71) + 0.008 * Math.exp(-(x * x + z * z) / 0.004);
    }
    g.computeVertexNormals();
    const surf = new THREE.Mesh(g, surfMat); surf.frustumCulled = false;
    set.group.add(surf);
  }
  // ------------------------------------------------------------------ grains, stones, fertiliser and DCD: one instanced pool
  // (instances fixed at build; what moves, the fertiliser's fall and the cut, is the shader's)
  const BL = [];   // [x, y, z, size, kind, seed, r, g, b, delay]   kind 0 soil grain, 1 stone, 2 fertiliser, 3 DCD, 4 the grass's mound
  {
    const r = rng(21);
    for (let i = 0; i < 620; i++) {
      const x = (r() - 0.5) * 1.14, y = -0.02 - r() * 0.66, z = (r() - 0.5) * 0.74, d = Math.hypot(x, z);
      if (d < 0.05 && y > -0.2) continue;
      const tone = r(), col = tone < 0.55 ? SLOOK.mix(C(SLOOK.SOIL.grain), C(SLOOK.SOIL.loamLight), r()) : tone < 0.85 ? SLOOK.mix(C(SLOOK.SOIL.sand), C(SLOOK.SOIL.grain), r() * 0.5) : C('#2e2118');
      BL.push([x, y, z, 0.01 + Math.pow(r(), 2) * 0.026, 0, r(), ...col, 0]);
    }
    for (let i = 0; i < 26; i++) BL.push([(r() - 0.5) * 1.1, 0.004, (r() - 0.5) * 0.74, 0.008 + r() * 0.014, 1, r(), ...SLOOK.mix(C('#6d6258'), C('#9a8c7a'), r()), 0]);
    for (let i = 0; i < 54; i++) BL.push([(r() - 0.5) * 1.0, 0.006, -0.3 + r() * 0.66, 0.0075 + r() * 0.004, 2, r(), ...C(SLOOK.N.grain), r() * 0.32]);
    for (let i = 0; i < 40; i++) BL.push([(r() - 0.5) * 1.05, -0.005 - r() * 0.05, -0.32 + r() * 0.68, 0.005 + r() * 0.004, 3, r(), ...C(SLOOK.DCD), r() * 0.5]);
    BL.push([GRASS[0], -0.012, GRASS[2], 0.07, 4, 0.5, ...C('#2a1d14'), 0]);
  }
  const FERT = BL.filter(b => b[4] === 2);
  const blobs = (() => {
    // a lumpy little stone: a sphere pushed in and out
    const g0 = new THREE.SphereGeometry(1, 9, 6), P = g0.attributes.position.array;
    for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2], f = 1 + 0.16 * Math.sin(x * 3.1 + 1) * Math.sin(y * 2.7 + 2) + 0.1 * Math.sin(z * 4.3 + x * 2.1); P[i] *= f; P[i + 1] *= f * 0.8; P[i + 2] *= f; }
    g0.computeVertexNormals();
    const n = BL.length, g = new THREE.InstancedBufferGeometry();
    g.setIndex(g0.index); g.setAttribute('position', g0.attributes.position); g.setAttribute('normal', g0.attributes.normal);
    const a0 = new Float32Array(n * 4), a1 = new Float32Array(n * 4), a2 = new Float32Array(n * 3), r = rng(3);
    BL.forEach((b, i) => { a0.set([b[0], b[1], b[2], b[3]], 4 * i); a1.set([b[4], b[5], b[9], r() * TAU], 4 * i); a2.set([b[6], b[7], b[8]], 3 * i); });
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(a0, 4)); g.setAttribute('aK', new THREE.InstancedBufferAttribute(a1, 4)); g.setAttribute('aCol', new THREE.InstancedBufferAttribute(a2, 3));
    g.instanceCount = n;
    const m = shader({
      uniforms: { uCut: { value: 1 }, uFert: { value: 0 }, uDcd: { value: 0 }, uGrass: { value: 0 } },
      vertex: `attribute vec4 aP, aK; attribute vec3 aCol;
uniform float uCut, uFert, uDcd, uGrass, uPore, uRad; uniform vec3 uPc;
varying vec3 vC, vN, vV; varying float vF;
void main() {
  float kind = aK.x, s = aP.w; vec3 c = aP.xyz; vF = 0.0;
  if (kind < 0.5) {
    // the cut: the grains in front of the plant thin out (seven in ten go)
    float zc = mix(0.5, 0.0, uCut);
    s *= 1.0 - smoothstep(zc - 0.04, zc + 0.04, c.z) * step(0.3, aK.y);
  } else if (kind < 2.5 && kind > 1.5) {
    // fertiliser: falls, lands, sinks a little and dissolves (each grain from its own moment)
    float f = clamp((uFert - aK.z) / 0.22, 0.0, 1.0), lnd = clamp((uFert - aK.z - 0.22) / 0.2, 0.0, 1.0), dis = clamp((uFert - aK.z - 0.36) / 0.3, 0.0, 1.0);
    c.y = mix(0.42 + 0.2 * aK.y, 0.006, f * f) - 0.012 * lnd;
    s *= smoothstep(0.0, 0.08, uFert - aK.z) * (1.0 - dis);
    vF = 1.0;
  } else if (kind > 2.5 && kind < 3.5) s *= clamp((uDcd - aK.z * 0.5) * 3.0, 0.0, 1.0);
  else if (kind > 3.5) s *= uGrass;
  if (uPore > 0.01 && distance(c, uPc) < uRad * 1.05) s = 0.0;
  float ca = cos(aK.w), sa = sin(aK.w);
  vec3 q = vec3(ca * position.x + sa * position.z, position.y, -sa * position.x + ca * position.z) * s;
  vec3 nq = vec3(ca * normal.x + sa * normal.z, normal.y, -sa * normal.x + ca * normal.z);
  vec4 mv = modelViewMatrix * vec4(c + q, 1.0);
  vN = normalize(normalMatrix * nq); vV = -mv.xyz; vC = aCol;
  gl_Position = projectionMatrix * mv;
  if (s < 0.0005) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `uniform float uA, uDim; varying vec3 vC, vN, vV; varying float vF;
void main() {
  ${LITCOL}
  vec3 col = vC * (0.35 + 0.6 * dif + 0.2 * hemi) + vC * rim * 0.35 + vec3(spec * 0.2) + vC * vF * 0.25;
  gl_FragColor = vec4(col * (1.0 - 0.75 * uDim), uA);
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ the pore, magnified: a bubble with soil grains, water
  // films and the relay's microbes (bubble-local units: the bubble's radius is 1)
  const bubble = new THREE.Group();
  set.group.add(bubble);
  const shellMat = K.rim(set, { color: SLOOK.SOIL.water, a0: 0.025, a1: 0.55 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), shellMat); shell.renderOrder = 4; bubble.add(shell);
  // big grains round the pore (behind and at the sides), clipped by the bubble
  const PGR = [[-0.62, 0.55, -0.35, 0.5], [0.66, 0.48, -0.4, 0.52], [-0.05, 0.05, -0.85, 0.55], [0.6, -0.58, -0.25, 0.48], [-0.66, -0.52, -0.3, 0.5],
    [0.02, 0.95, 0.05, 0.36], [0.05, -0.98, 0.1, 0.38], [-1.0, 0.0, 0.25, 0.32], [1.0, 0.0, 0.2, 0.3]];
  const poreGrains = (() => {
    const r = rng(41), list = [];
    PGR.forEach(([x, y, z, rad], k) => {
      const g = new THREE.SphereGeometry(rad, 22, 16), P = g.attributes.position.array, ph = [r() * 6, r() * 6, r() * 6];
      for (let i = 0; i < P.length; i += 3) {
        const u = P[i] / rad, v = P[i + 1] / rad, w = P[i + 2] / rad;
        const f = 1 + 0.13 * Math.sin(u * 3.3 + ph[0]) * Math.sin(v * 2.9 + ph[1]) + 0.08 * Math.sin(w * 4.1 + u * 2.3 + ph[2]) + 0.04 * Math.sin(v * 9 + w * 7);
        P[i] = x + P[i] * f; P[i + 1] = y + P[i + 1] * f * 0.92; P[i + 2] = z + P[i + 2] * f;
      }
      g.computeVertexNormals();
      const col = [C(SLOOK.SOIL.sand), C(SLOOK.SOIL.grain), C('#4a3526'), C('#8a5a3a'), C('#6b5a48')][k % 5];
      list.push(K.paint(g, col));
    });
    const g = K.merge(list.map(x => { x.deleteAttribute('uv'); return x; }));
    const m = shader({
      uniforms: { uWater: { value: new THREE.Color(...C(SLOOK.SOIL.water)) }, uBA: { value: 0 } },
      vertex: `attribute vec3 color; varying vec3 vC, vN, vV, vL; void main() { vL = position; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragment: `uniform float uA, uBA; uniform vec3 uWater; varying vec3 vC, vN, vV, vL;
${NOISE}
void main() {
  if (length(vL) > 1.0) discard;
  ${LITCOL}
  float gr = vnoise(vL * 14.0) * 0.6 + vnoise(vL * 40.0) * 0.4, sp = step(0.86, vnoise(vL * 90.0));
  vec3 col = vC * (0.45 + 0.75 * gr) * (1.0 - 0.35 * smoothstep(0.55, 0.3, gr)) + vec3(0.55, 0.5, 0.42) * sp * 0.4;
  col = gl_FrontFacing ? col * (0.3 + 0.62 * dif + 0.18 * hemi) + vec3(spec * 0.3) + uWater * pow(rim, 1.5) * 0.9 : col * 0.22;
  gl_FragColor = vec4(col, uA * uBA);
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    bubble.add(mesh);
    return { mesh, m };
  })();
  // the microbes (bubble-local): archaea (round), ammonia-oxidising bacteria (rods), nitrite oxidisers (Nitrospira,
  // curved), comammox (curved, cyan with an amber core); each guild comes in with soil_relay
  const SITE = [[-0.3, 0.3, 0.22], [0.32, 0.27, 0.18], [0.3, -0.3, 0.2], [-0.3, -0.28, 0.22]];   // archaea, bacteria, nitrite oxidisers, comammox
  const MIC = [];   // { g, c }  (guild, centre)
  const microbes = (() => {
    const b = GB(), r = rng(55);
    const gcol = [C(SLOOK.GUILD.aoa), C(SLOOK.GUILD.nsp), C(SLOOK.GUILD.nit), C(SLOOK.GUILD.nit)];
    const add = (g, c, axis, L, rad, bend, p, col) => {
      // a body along a (bent) axis: round ends (a superellipse's profile), 'p' the squareness
      const n = 11, pts = [], R = [], side = K.v3.norm(K.v3.cross(axis, [0, 0, 1]));
      for (let i = 0; i < n; i++) {
        const s = i / (n - 1), x = (s - 0.5) * L, off = bend * (1 - 4 * (s - 0.5) * (s - 0.5)) * L * 0.25;
        pts.push(K.v3.add(c, K.v3.add(K.v3.mul(axis, x), K.v3.mul(side, off))));
        R.push(rad * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), p)), 1 / p) + 1e-4);
      }
      tube(b, pts, R, pts.map(() => g), pts.map(() => col), pts.map(() => r() * TAU), g === 3 ? 1 : 0, 1, 10);
      MIC.push({ g, c });
    };
    for (let k = 0; k < 5; k++) { const c = K.v3.add(SITE[0], [(r() - 0.5) * 0.24, (r() - 0.5) * 0.2, (r() - 0.5) * 0.1]); add(0, c, K.unit(r), 0.11, 0.05, 0, 2.2, gcol[0]); }
    for (let k = 0; k < 4; k++) { const c = K.v3.add(SITE[1], [(r() - 0.5) * 0.26, (r() - 0.5) * 0.2, (r() - 0.5) * 0.1]); add(1, c, K.v3.norm([r() - 0.5, r() - 0.5, (r() - 0.5) * 0.3]), 0.22, 0.045, 0, 4, k === 3 ? C(SLOOK.GUILD.nsm) : gcol[1]); }
    for (let k = 0; k < 4; k++) { const c = K.v3.add(SITE[2], [(r() - 0.5) * 0.26, (r() - 0.5) * 0.2, (r() - 0.5) * 0.1]); add(2, c, K.v3.norm([r() - 0.5, r() - 0.5, (r() - 0.5) * 0.3]), 0.26, 0.04, 0.9, 4, gcol[2]); }
    for (let k = 0; k < 2; k++) { const c = K.v3.add(SITE[3], [(r() - 0.5) * 0.22, (r() - 0.5) * 0.16, (r() - 0.5) * 0.1]); add(3, c, K.v3.norm([r() - 0.5, r() - 0.5, 0.1]), 0.27, 0.048, 1.0, 4, gcol[3]); }
    const m = shader({
      uniforms: { uShow: { value: new THREE.Vector4() }, uLit: { value: new THREE.Vector4(1, 1, 1, 1) }, uAmb: { value: new THREE.Color(...C(SLOOK.N.nh4)) } },
      vertex: `attribute vec3 aCol, aBase; attribute vec4 aG;
uniform vec4 uShow, uLit; uniform float uTime;
varying vec3 vC, vN, vV; varying float vS, vL, vCo;
void main() {
  int g = int(aG.x + 0.5);
  float sh = g == 0 ? uShow.x : g == 1 ? uShow.y : g == 2 ? uShow.z : uShow.w;
  vL = g == 0 ? uLit.x : g == 1 ? uLit.y : g == 2 ? uLit.z : uLit.w;
  float pop = sh * (1.0 + 0.25 * sin(sh * 3.14159));   // (a little overshoot as it comes in)
  float a = 0.18 * sin(uTime * 1.1 + aG.z), ca = cos(a), sa = sin(a);
  vec3 q = position - aBase; q = vec3(ca * q.x - sa * q.y, sa * q.x + ca * q.y, q.z);
  vec3 nq = vec3(ca * normal.x - sa * normal.y, sa * normal.x + ca * normal.y, normal.z);
  vec3 p = aBase + q * pop + vec3(0.0, 0.012 * sin(uTime * 0.8 + aG.z * 3.0), 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * nq); vV = -mv.xyz; vC = aCol; vS = sh; vCo = aG.w;
  gl_Position = projectionMatrix * mv;
  if (pop < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragment: `uniform float uA; uniform vec3 uAmb; varying vec3 vC, vN, vV; varying float vS, vL, vCo;
void main() {
  ${LITCOL}
  float face = abs(dot(n, v));
  vec3 body = mix(vC, uAmb, vCo * smoothstep(0.55, 0.95, face));
  float glow = (1.0 - smoothstep(0.6, 1.0, vS)) * step(0.02, vS) * 0.8;
  vec3 col = body * (0.35 + 0.6 * dif + 0.25 * hemi) + body * rim * (0.9 + glow) + vec3(spec * 0.35);
  col *= 0.35 + 0.65 * vL;
  gl_FragColor = vec4(col, uA * mix(0.5, 1.0, vL));
}`,
    });
    const mesh = new THREE.Mesh(b.geo(), m); mesh.frustumCulled = false;
    bubble.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ the chromosomes: the wild grass's (blue) and the
  // wheat's (orange), each two sister chromatids with bands; a segment of the blue one moves into the orange one
  const CHG = [-0.55, 0.7, 0.2], CHW = [0.38, 0.7, 0.2], CH_LEN = 0.44, SEG = [0.6, 0.8];   // (where along it the segment lies)
  const BLUE = C('#4f86e8'), ORANGE = C(SLOOK.LINE[1]);
  const chromMat = shader({
    uniforms: { uGap: { value: new THREE.Vector2(1, 0) }, uSegLit: { value: 0 }, uWheatGlow: { value: 0 }, uIn: { value: 0 } },
    vertex: `attribute vec3 aCol, aBase; attribute vec4 aG;
uniform float uIn; uniform vec2 uGap;
varying vec3 vC, vN, vV; varying float vU, vW, vSeg, vGone;
void main() {
  vec3 cc = aG.w < 0.5 ? vec3(${CHG.join(', ')}) : vec3(${CHW.join(', ')});
  // where the segment left (the grass's) or is replaced (the wheat's), the chromatids thin to a thread
  float inSeg = step(${SEG[0].toFixed(2)}, aG.x) * step(aG.x, ${SEG[1].toFixed(2)});
  vGone = inSeg * (aG.w < 0.5 ? uGap.x : uGap.y);
  vec3 q = aBase + (position - aBase) * (1.0 - 0.8 * vGone);
  vec4 mv = modelViewMatrix * vec4(cc + (q - cc) * uIn, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = aCol; vU = aG.x; vW = aG.w; vSeg = aG.z;
  gl_Position = projectionMatrix * mv;
}`,
    fragment: `uniform float uA; uniform vec2 uGap; uniform float uSegLit, uWheatGlow; varying vec3 vC, vN, vV; varying float vU, vW, vSeg, vGone;
void main() {
  ${LITCOL}
  // bands (Giemsa-like, drawn): dark and light stripes along the chromatid
  float band = smoothstep(0.35, 0.6, abs(sin(vU * 37.0 + sin(vU * 11.0) * 2.0)));
  vec3 base = vC * mix(0.55, 1.1, band);
  float inSeg = step(${SEG[0].toFixed(2)}, vU) * step(vU, ${SEG[1].toFixed(2)});
  // the grass's segment glows while it is marked; the place it leaves fades; the wheat's piece it replaces fades
  float gone = vGone;
  base += inSeg * (1.0 - vW) * vec3(0.5, 0.7, 1.0) * uSegLit * 0.5;
  vec3 col = base * (0.35 + 0.6 * dif + 0.2 * hemi) + base * rim * (0.6 + uWheatGlow * vW * 1.4) + vec3(spec * 0.3);
  col += vW * uWheatGlow * vec3(1.0, 0.65, 0.3) * rim * 0.6;
  gl_FragColor = vec4(col * (1.0 - 0.5 * gone), uA);
}`,
  });
  function chromatids(b, c, col, which, from, to) {
    // two sister chromatids side by side, joined at the centromere (u 0.42), each a rounded tube
    for (const sx of [-1, 1]) {
      const n = 26, pts = [], R = [], U = [];
      for (let i = 0; i < n; i++) {
        const u = from + (to - from) * i / (n - 1), y = (u - 0.5) * CH_LEN, cen = Math.exp(-Math.pow((u - 0.42) / 0.06, 2));
        const x = sx * (0.025 - 0.016 * cen + 0.008 * Math.pow(Math.abs(u - 0.42) * 2, 2));
        pts.push([c[0] + x, c[1] + y, c[2]]);
        const edge = Math.min(1, Math.min(u - from, to - u) / ((to - from) * (from > 0 || to < 1 ? 0.25 : 0.06)));
        R.push(0.022 * (1 - 0.35 * cen) * Math.sqrt(Math.max(0, 1 - (1 - edge) * (1 - edge))) + 1e-4);
        U.push(u);
      }
      tube(b, pts, R, U, pts.map(() => col), U.map(u => +(u >= SEG[0] && u <= SEG[1])), which, 1, 12);
    }
  }
  const chromB = GB();
  chromatids(chromB, CHG, BLUE, 0, 0, 1); chromatids(chromB, CHW, ORANGE, 1, 0, 1);
  const chroms = new THREE.Mesh(chromB.geo(), chromMat); chroms.frustumCulled = false; set.group.add(chroms);
  // the moving segment (its own copy of the blue chromatids' piece, centred on its middle)
  const segB = GB(), SEGMID = (SEG[0] + SEG[1]) / 2, SEG_Y = (SEGMID - 0.5) * CH_LEN;
  chromatids(segB, [0, -SEG_Y, 0], SLOOK.mix(BLUE, [0.75, 0.85, 1], 0.25), 0, SEG[0] - 0.005, SEG[1] + 0.005);
  const segMat = shader({
    uniforms: { uLit: { value: 0 } },
    vertex: `attribute vec3 aCol; varying vec3 vC, vN, vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = aCol; gl_Position = projectionMatrix * mv; }`,
    fragment: `uniform float uA, uLit; varying vec3 vC, vN, vV;
void main() { ${LITCOL}
  vec3 col = vC * (0.4 + 0.6 * dif + 0.2 * hemi) + vC * rim * (0.8 + uLit) + vec3(spec * 0.3) + vec3(0.25, 0.4, 0.7) * uLit * 0.35;
  gl_FragColor = vec4(col, uA); }`,
  });
  const segment = new THREE.Mesh(segB.geo(), segMat); segment.frustumCulled = false; set.group.add(segment);
  const SEG_A = [CHG[0], CHG[1] + SEG_Y, CHG[2]], SEG_B = [CHW[0], CHW[1] + SEG_Y, CHW[2]];
  const segPos = [0, 0, 0];
  // ------------------------------------------------------------------ the tracer's microbe (one small rod in the soil)
  const TRM = [-0.08, -0.2, 0.27];
  const tracerBug = (() => {
    const b = GB(), n = 9, pts = [], R = [];
    for (let i = 0; i < n; i++) { const s = i / (n - 1); pts.push([TRM[0] + (s - 0.5) * 0.075, TRM[1] + (s - 0.5) * 0.02, TRM[2]]); R.push(0.014 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), 4)), 0.25) + 1e-4); }
    tube(b, pts, R, pts.map(() => 0), pts.map(() => C(SLOOK.GUILD.nsp)), pts.map(() => 0), 0, 1, 10);
    const m = shader({
      uniforms: { uS: { value: 0 }, uF: { value: 0 } },
      vertex: `attribute vec3 aCol, aBase; uniform float uS; varying vec3 vC, vN, vV;
void main() { vec3 p = ${'vec3(' + TRM.join(', ') + ')'} + (position - ${'vec3(' + TRM.join(', ') + ')'}) * uS; vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vC = aCol; gl_Position = projectionMatrix * mv; if (uS < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`,
      fragment: `uniform float uA, uF; varying vec3 vC, vN, vV;
void main() { ${LITCOL} vec3 col = vC * (0.4 + 0.6 * dif) + vC * rim * (0.9 + uF * 2.0) + vec3(uF * 0.5); gl_FragColor = vec4(col, uA); }`,
    });
    const mesh = new THREE.Mesh(b.geo(), m); mesh.frustumCulled = false; set.group.add(mesh);
    return { mesh, m };
  })();
  // ------------------------------------------------------------------ glows: ammonium, the flows, the relay's particles,
  // the halo, N2O, the tracer (one pool of soft additive points, refilled each frame)
  const H = LK.halos(2200);
  H.mesh.renderOrder = 3; H.mesh.material.depthTest = false;   // (glows read through the grains: the block is a cut-away)
  set.group.add(H.mesh);
  const NSPC = C(SLOOK.GUILD.nsp), NH4 = C(SLOOK.N.nh4), NO2 = C(SLOOK.N.no2), NO3 = C(SLOOK.N.no3Glow), N2O = C(SLOOK.N.n2o), UP = C(SLOOK.N.plant), WHITE = [1, 1, 1], HALO = C(SLOOK.HALO);
  // the ammonium in the topsoil: two glows round each fertiliser grain's landing spot
  const AMM = [];
  { const r = rng(17); for (const f of FERT) for (let k = 0; k < 2; k++) AMM.push([f[0] + (r() - 0.5) * 0.08, -0.015 - r() * 0.08, f[2] + (r() - 0.5) * 0.07, f[9], 0.05 + r() * 0.05, r() * TAU]); }
  // the flows: each particle's cycle, start, its route's points (main roots for the plant's share)
  const MAINS = ROOTS.filter(R => R.parent < 0);
  const NF = 330, FL = [];
  {
    const r = rng(23);
    for (let i = 0; i < NF; i++) {
      const x = (r() - 0.5) * 1.0, z = -0.3 + r() * 0.66, y = -0.02 - r() * 0.1;
      const root = Math.floor(r() * MAINS.length), M = MAINS[root];
      let j = 1; const yc = -0.12 - r() * 0.3; while (j < M.pts.length - 1 && M.pts[j][1] > yc) j++;
      FL.push({ s: [x, y, z], per: 7 + r() * 3, ph: r(), root, j, ex: [x + (r() - 0.5) * 0.12, z + (r() - 0.5) * 0.08], w: [x + (r() - 0.5) * 0.1, z + (r() - 0.5) * 0.08], sd: r() * 100, leaf: 0.2 + r() * 0.3, lx: (r() - 0.5) * 0.3, lz: (r() - 0.5) * 0.2, gate: (i + 0.5) / NF });
    }
  }
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  // where flow particle i is at phase a of its cycle (route by u): its place into p, its colour, size and alpha into o
  const FLOW = { plant: 0.45, n2o: 0.12, amber: 0.25 }, FO = { col: null, size: 0, al: 0 }, _q2 = [0, 0, 0], _mc = [0, 0, 0];
  const mixC = (a, b, f) => SLOOK.mix(a, b, clamp(f, 0, 1), _mc);
  function flowAt(i, F, a, u, t, inh, p, o) {
    let col = NH4, size = 0.03, al = 0.78, x = F.s[0], y = F.s[1], z = F.s[2];
    const jx = 0.014 * Math.sin(t * 0.9 + F.sd), jz = 0.012 * Math.cos(t * 0.7 + F.sd * 1.3), ae = FLOW.amber;
    if (u < FLOW.plant) {
      // to a root, up the root (now the plant's), up the stem into the leaves
      const M = MAINS[F.root], rp = M.pts[F.j], e0 = 0.35 + 0.1 * inh;
      if (a < e0) { const f = smooth(a / e0); x = F.s[0] + (rp[0] - F.s[0]) * f + jx * (1 - f); y = F.s[1] + (rp[1] - F.s[1]) * f; z = F.s[2] + (rp[2] - F.s[2]) * f + jz * (1 - f) + 0.012 * f; }
      else if (a < 0.8) { rootClimb(M, F.j, (a - e0) / (0.8 - e0), _q2); x = _q2[0]; y = _q2[1]; z = _q2[2] + 0.012; col = UP; size = 0.026; al *= 1 - 0.85 * smooth((y + 0.15) / 0.15); }
      else { const f = (a - 0.8) / 0.2; x = 0.004 * Math.sin(F.sd) + f * F.lx; y = f * F.leaf; z = 0.012 + f * F.lz; col = UP; size = 0.022; al *= 0.22 * (1 - f * f); }
      if (a > e0 - 0.05 && a < e0 + 0.05) col = mixC(NH4, UP, (a - e0 + 0.05) / 0.1);
    } else if (u < FLOW.plant + FLOW.n2o) {
      // the relay, then up and out of the surface as N2O
      if (a < ae) { x += jx; z += jz; y -= 0.01 * a; }
      else if (a < ae + 0.15) { const f = (a - ae) / 0.15; col = mixC(NH4, NO2, f); x += jx; z += jz; y -= 0.01 * ae + 0.02 * f; }
      else { const f = (a - ae - 0.15) / (0.85 - ae); col = mixC(NO2, N2O, f * 4); y = F.s[1] - 0.02 + f * (0.52 - F.s[1]); x = F.s[0] + (F.w[0] - F.s[0]) * f + 0.04 * Math.sin(t * 1.3 + F.sd + f * 4) * f; z = F.s[2] + (F.w[1] - F.s[2]) * f; size = 0.03 + 0.08 * f * f; al = 0.7 * (1 - f * f); }
    } else {
      // the relay, then down and out of the block's bottom as nitrate
      if (a < ae) { x += jx; z += jz; y -= 0.015 * a; }
      else if (a < ae + 0.12) { const f = (a - ae) / 0.12; col = mixC(NH4, NO2, f); x += jx; z += jz; y -= 0.015 * ae + 0.03 * f; }
      else if (a < ae + 0.22) { const f = (a - ae - 0.12) / 0.1; col = mixC(NO2, NO3, f); x += jx; z += jz; y -= 0.015 * ae + 0.03 + 0.03 * f; }
      else { const f = (a - ae - 0.22) / (0.78 - ae); col = NO3; y = F.s[1] - 0.015 * ae - 0.06 - f * (0.84 + F.s[1]); x = F.s[0] + (F.ex[0] - F.s[0]) * f + 0.015 * Math.sin(f * 9 + F.sd); z = F.s[2] + (F.ex[1] - F.s[2]) * f; al *= 1 - smooth((y + 0.68) / -0.18); }
    }
    al *= clamp(a / 0.05, 0, 1) * clamp((1 - a) / 0.06, 0, 1);
    if (al <= 0.004) return false;
    p[0] = x; p[1] = y; p[2] = z; o.col = col; o.size = size; o.al = al;
    return true;
  }
  // the BNI halo: soft teal glows along the roots, seeping outwards
  const HAL = [];
  { const r = rng(29); for (let i = 0; i < RPTS.length; i += 4) { const q = RPTS[i]; if (q.p[1] > -0.03) continue; HAL.push([...q.p, ...K.unit(r), q.g, 0.04 + r() * 0.04, r() * TAU]); } }
  // the tracer's path: a fertiliser grain, the soil, a microbe (it waits there), a root, up into a leaf
  const TR = (() => {
    const M = MAINS[0], pts = [];
    pts.push([-0.22, 0.012, 0.24], [-0.2, -0.05, 0.25], [-0.15, -0.13, 0.27], TRM.slice());
    const k0 = M.pts.findIndex(q => q[1] < -0.22), k = k0 > 0 ? k0 : 4, rp = M.pts[k];
    pts.push(K.v3.lerp(TRM, rp, 0.5), rp);
    for (let i = k - 1; i >= 0; i--) pts.push(M.pts[i]);
    pts.push([0, 0.1, 0], [0, 0.25, 0], [0.04, 0.33, 0.02], [0.12, 0.38, 0.06], [0.2, 0.4, 0.1]);
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + K.v3.dist(pts[i - 1], pts[i]));
    return { pts, L, wait: 3 };   // (the microbe is point 3)
  })();
  const trOut = [0, 0, 0];
  // the relay's particles: where each enters the pore and leaves it (bubble-local)
  const RL = [];
  for (let i = 0; i < 40; i++) RL.push({ E: [(hash(i, 1) - 0.5) * 0.4, 0.95, 0.35], X: [(hash(i, 2) - 0.5) * 0.4, -0.95, 0.35] });
  const _l = [0, 0, 0], lerp3 = (a, b, f, out) => { out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = a[2] + (b[2] - a[2]) * f; return out; };
  const orbit = (s, ph, t, out) => { out[0] = s[0] + 0.1 * Math.cos(t * 2.1 + ph); out[1] = s[1] + 0.08 * Math.sin(t * 2.1 + ph); out[2] = s[2] + 0.1; return out; };
  // where along the path the atom is at tracer progress s (it waits in the microbe from 0.32 to 0.5)
  function tracerAt(s, out) {
    const lw = TR.L[TR.wait], tot = TR.L[TR.L.length - 1];
    let d = s < 0.32 ? s / 0.32 * lw : s < 0.5 ? lw : lw + (s - 0.5) / 0.5 * (tot - lw);
    d = clamp(d, 0, tot);
    let i = 1; while (i < TR.L.length - 1 && TR.L[i] < d) i++;
    const f = (d - TR.L[i - 1]) / Math.max(1e-6, TR.L[i] - TR.L[i - 1]), a = TR.pts[i - 1], b = TR.pts[i];
    out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = a[2] + (b[2] - a[2]) * f;
    return out;
  }
  // ------------------------------------------------------------------ state for labels and anchors
  const now = { pore: 0, R: 0, relay: 0, tracer: 0, chrom: 0 };
  const _p = [0, 0, 0], _q = [0, 0, 0], _c = [0, 0, 0];
  const bubbleP = (l, out) => { const R = now.R, c = PORE.uPc.value; out[0] = c.x + l[0] * R; out[1] = c.y + l[1] * R; out[2] = c.z + l[2] * R; return out; };
  // a point along a main root, from index j (fraction f of the way back up to its crown)
  function rootClimb(M, j, f, out) {
    const s = (1 - f) * j, i = Math.floor(s), u = s - i, a = M.pts[i], b = M.pts[Math.min(i + 1, M.pts.length - 1)];
    out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = a[2] + (b[2] - a[2]) * u;
    return out;
  }
  // ------------------------------------------------------------------ update: everything from the params and t
  function update(S, t) {
    LK.depth();
    const grow = clamp(S.soil_grow, 0, 1), cut = clamp(S.soil_cut, 0, 1), fert = clamp(S.soil_fert, 0, 1), flow = clamp(S.soil_flow, 0, 1);
    const inh = clamp(S.soil_inhibit, 0, 1), halo = clamp(S.soil_halo, 0, 1), dcd = clamp(S.soil_dcd, 0, 1), pore = clamp(S.soil_pore, 0, 1);
    const relay = clamp(S.soil_relay, 0, 4), grass = clamp(S.soil_grass, 0, 1), chrom = clamp(S.soil_chrom, 0, 1), tracer = clamp(S.soil_tracer, 0, 1);
    const pick = Math.round(S.soil_pick === undefined ? -1 : S.soil_pick);
    // the pore's bubble
    const pg = smooth(pore), R = 0.3 * pg;
    now.pore = pore; now.R = R; now.relay = relay; now.tracer = tracer; now.chrom = chrom;
    PORE.uRad.value = R; PORE.uPore.value = pore; PORE.uDim.value = smooth(clamp(pore * 1.3, 0, 1));
    bubble.visible = pore > 0.004;
    bubble.position.copy(PORE.uPc.value); bubble.scale.setScalar(Math.max(1e-4, R));
    shellMat.uniforms.uK.value = pg;
    poreGrains.m.uniforms.uBA.value = prog(pore, 0.2, 0.7);
    const sh = microbes.m.uniforms.uShow.value, lit = microbes.m.uniforms.uLit.value, pv = prog(pore, 0.4, 0.9);
    sh.set(clamp(relay, 0, 1) * pv, clamp(relay - 1, 0, 1) * pv, clamp(relay - 2, 0, 1) * pv, clamp(relay - 3, 0, 1) * pv);
    lit.set(pick < 0 || pick === 0 ? 1 : 0.25, pick < 0 || pick === 1 ? 1 : 0.25, pick < 0 || pick === 2 ? 1 : 0.25, pick < 0 || pick === 3 ? 1 : 0.25);
    // the plant, the grass, the roots, the block
    plantMat.uniforms.uGrow.value = grow; plantMat.uniforms.uGrass.value = grass;
    hairs.m.uniforms.uReveal.value = grow;
    faceMat.uniforms.uCut.value = cut;
    faceMat.depthWrite = cut < 0.02 && set.uA.value > 0.97;
    blobs.m.uniforms.uCut.value = cut; blobs.m.uniforms.uFert.value = fert; blobs.m.uniforms.uDcd.value = dcd; blobs.m.uniforms.uGrass.value = grass;
    // the chromosomes: in with soil_chrom; the segment lifts out (to 0.5) and glides into the wheat's (to 1)
    const cin = prog(chrom, 0, 0.12), lift = prog(chrom, 0.12, 0.5), glide = prog(chrom, 0.5, 0.92);
    chroms.visible = segment.visible = chrom > 0.004;
    chromMat.uniforms.uGap.value.set(lift > 0.02 ? 1 : 0, prog(chrom, 0.8, 0.95));
    chromMat.uniforms.uSegLit.value = prog(chrom, 0.04, 0.14) * (1 - glide);
    chromMat.uniforms.uWheatGlow.value = prog(chrom, 0.9, 1) * (0.75 + 0.25 * Math.sin(t * 3));
    {
      const h = 0.16 * lift * (1 - glide) + 0.22 * Math.sin(glide * Math.PI);
      segPos[0] = SEG_A[0] + (SEG_B[0] - SEG_A[0]) * glide; segPos[1] = SEG_A[1] + h; segPos[2] = SEG_A[2] + (SEG_B[2] - SEG_A[2]) * glide + 0.08 * Math.sin(glide * Math.PI);
      segment.position.set(segPos[0], segPos[1], segPos[2]);
      segment.rotation.set(0, glide * TAU, 0.25 * Math.sin(glide * Math.PI));
      segment.scale.setScalar(cin * (1 + 0.15 * Math.sin(glide * Math.PI)));
      segMat.uniforms.uLit.value = lift * (1 - prog(chrom, 0.92, 1));
    }
    chromMat.uniforms.uIn.value = cin;
    chroms.visible = cin > 0.004;
    // the glows
    H.begin();
    const dimB = 1 - 0.85 * PORE.uDim.value;
    // ammonium round the dissolving grains
    for (const a of AMM) {
      const d = clamp((fert - a[3] - 0.36) / 0.3, 0, 1);
      if (d <= 0) continue;
      _p[0] = a[0]; _p[1] = a[1]; _p[2] = a[2];
      if (pore > 0.01 && PORE.uPc.value.distanceTo(_v.set(_p[0], _p[1], _p[2])) < R) continue;
      H.add(_p, a[4] * (0.6 + 0.4 * d) * (1 + 0.08 * Math.sin(t * 1.7 + a[5])), NH4, 0.2 * d * dimB * (1 - 0.35 * flow * (1 - inh)));
    }
    // the flows (each particle with a short trail behind it)
    if (flow > 0.003) {
      const ps = clamp(S.soil_plant, 0, 1);
      FLOW.plant = ps + (1 - ps) * 0.55 * inh; FLOW.n2o = 0.12 * (1 - 0.75 * inh); FLOW.amber = 0.25 + 0.3 * inh;   // (the relay's first step slows: the nitrogen stays ammonium longer)
      const pc = PORE.uPc.value;
      for (let i = 0; i < NF; i++) {
        const F = FL[i], gate = clamp((flow - F.gate) * 12 + 1, 0, 1);
        if (gate <= 0) continue;
        for (let k = 0; k < 3; k++) {
          const c = (t - k * 0.09) / F.per + F.ph, cyc = Math.floor(c), a = c - cyc;
          if (!flowAt(i, F, a, hash(i, cyc), t - k * 0.09, inh, _p, FO)) continue;
          if (pore > 0.01 && (_p[0] - pc.x) ** 2 + (_p[1] - pc.y) ** 2 + (_p[2] - pc.z) ** 2 < R * R) continue;
          H.add(_p, FO.size * (1 - 0.22 * k), FO.col, FO.al * gate * dimB * (k ? 0.3 / k : 1));
        }
      }
    }
    // the halo: teal round the roots, seeping into the soil
    if (halo > 0.003) {
      const pc = PORE.uPc.value;
      for (const h of HAL) {
        if (h[6] > grow + 0.05) continue;
        const o = 0.012 + 0.035 * halo;
        _p[0] = h[0] + h[3] * o; _p[1] = h[1] + h[4] * o; _p[2] = h[2] + h[5] * o;
        if (pore > 0.01 && (_p[0] - pc.x) ** 2 + (_p[1] - pc.y) ** 2 + (_p[2] - pc.z) ** 2 < R * R) continue;
        H.add(_p, h[7] * (0.6 + 0.6 * halo), HALO, 0.085 * halo * (0.75 + 0.25 * Math.sin(t * 1.3 + h[8])) * dimB);
      }
    }
    // the relay in the pore: particles handed on, changing colour (bubble-local paths)
    if (pore > 0.05 && relay > 0.02) {
      const pv2 = prog(pore, 0.5, 1);
      for (let i = 0; i < 40; i++) {
        const per = 8 + hash(i, 7) * 3, c = t / per + hash(i, 3), cyc = Math.floor(c), a = c - cyc, u = hash(i, cyc + 11);
        // the route: archaea or bacteria, then the nitrite oxidisers; or comammox straight to nitrate
        const useB = relay > 1.5 && u < 0.45, comm = relay > 3.5 && u > 0.78, toNob = relay > 2.5, bounce = hash(i, cyc + 5) < inh * 0.7;
        const s1 = comm ? SITE[3] : useB ? SITE[1] : SITE[0], E = RL[i].E, X = RL[i].X;
        let col = NH4, l = _l;
        if (a < 0.22) lerp3(E, orbit(s1, i, t, _c), smooth(a / 0.22), _l);
        else if (a < 0.38) { l = orbit(s1, i, t, _c); if (!bounce) col = mixC(NH4, comm ? NO3 : NO2, smooth((a - 0.22) / 0.16)); }
        else if (bounce) { col = NH4; lerp3(orbit(s1, i, t, _q), E, smooth((a - 0.38) / 0.4), _l); }
        else if (comm || !toNob) { col = comm ? NO3 : NO2; lerp3(orbit(s1, i, t, _q), X, smooth((a - 0.38) / 0.5), _l); }
        else if (a < 0.6) { col = NO2; lerp3(orbit(s1, i, t, _q), orbit(SITE[2], i * 2, t, _c), smooth((a - 0.38) / 0.22), _l); }
        else if (a < 0.74) { l = orbit(SITE[2], i * 2, t, _c); col = mixC(NO2, NO3, smooth((a - 0.6) / 0.14)); }
        else { col = NO3; lerp3(orbit(SITE[2], i * 2, t, _q), X, smooth((a - 0.74) / 0.26), _l); }
        const al = 0.95 * pv2 * clamp(a / 0.06, 0, 1) * clamp((1 - a) / 0.08, 0, 1) * clamp(relay * 2, 0, 1);
        bubbleP(l, _p);
        H.add(_p, 0.09 * R, col, al);
      }
    }
    // the marked atom and its trail
    const trBug = prog(tracer, 0.05, 0.2) * (1 - prog(tracer, 0.93, 1));
    tracerBug.m.uniforms.uS.value = trBug;
    tracerBug.m.uniforms.uF.value = tracer > 0.32 && tracer < 0.5 ? 0.6 + 0.4 * Math.sin(t * 14) : 0;
    tracerBug.mesh.visible = trBug > 0.004;
    if (tracer > 0.003 && tracer < 0.999) {
      tracerAt(tracer, trOut);
      for (let k = 22; k >= 1; k--) { tracerAt(Math.max(0, tracer - k * 0.006), _p); H.add(_p, 0.012 + 0.01 * (1 - k / 22), WHITE, 0.4 * (1 - k / 22) * prog(tracer, 0, 0.04)); }
      const fl = tracer > 0.32 && tracer < 0.5 ? 0.7 + 0.3 * Math.sin(t * 14) : 1;
      if (trBug > 0.01) H.add(TRM, 0.09, NSPC, 0.35 * trBug * (tracer > 0.32 && tracer < 0.5 ? 1.6 : 1));
      H.add(trOut, 0.085, WHITE, 0.95 * fl * prog(tracer, 0, 0.03) * (1 - prog(tracer, 0.96, 0.999)));
    } else { trOut[0] = TR.pts[0][0]; trOut[1] = TR.pts[0][1]; trOut[2] = TR.pts[0][2]; }
    H.end();
    // the roots dim a little while the flows show (so the particles read)
    plantMat.uniforms.uRootA.value = 1;
  }
  // ------------------------------------------------------------------ picking: a microbe in the pore
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  function pick(rc) {
    if (now.pore < 0.5 || now.relay < 0.5) return null;
    set.group.updateMatrixWorld();
    const Mw = set.group.matrixWorld, s0 = Mw.getMaxScaleOnAxis(), ray = rc.ray;
    let best = Infinity, hit = -1;
    for (const m of MIC) {
      if (now.relay < m.g + 0.5) continue;
      bubbleP(m.c, _p);
      _v.set(_p[0], _p[1], _p[2]).applyMatrix4(Mw);
      const d = _w.copy(_v).sub(ray.origin).dot(ray.direction), rr = 0.12 * now.R * s0;
      if (d > 0 && d < best && ray.distanceSqToPoint(_v) < rr * rr) { best = d; hit = m.g; }
    }
    return hit >= 0 ? { kind: 'guild', g: hit } : null;
  }
  // a guild's microbes' middle (set coordinates, where it is now)
  const LOFF = [[0, 0.12], [0, 0.12], [0, -0.16], [-0.05, -0.3]];   // (where each guild's label points, off its cluster, so the four never overlap)
  const guildAt = g => { const c = SITE[g], out = [0, 0, 0]; return now.R > 0.01 ? bubbleP([c[0] + LOFF[g][0], c[1] + LOFF[g][1], c[2] + 0.1], out) : [PORE.uPc.value.x, PORE.uPc.value.y, PORE.uPc.value.z]; };
  const anchors = {
    surface: [0, 0, 0], ear: () => EARTOP.slice(), stem: [0, 0.4, 0], roots: [0.06, -0.2, 0.14], fert: [-0.25, 0.02, 0.15],
    nh4: [-0.22, -0.06, 0.24], no3: [0.28, -0.7, 0.22], n2o: [-0.28, 0.32, 0.12], halo: [0.12, -0.32, 0.16],
    pore: [0.18, -0.28, 0.25], aoa: () => guildAt(0), aob: () => guildAt(1), nob: () => guildAt(2), comammox: () => guildAt(3),
    grass: [GRASS[0], 0.55, GRASS[2]], chromGrass: [CHG[0], CHG[1] + CH_LEN * 0.55, CHG[2]], chromWheat: [CHW[0], CHW[1] - CH_LEN * 0.5, CHW[2]],
    segment: () => [segPos[0], segPos[1] + 0.05, segPos[2]], tracer: () => trOut.slice(), corner: [-0.6, -0.7, 0.4], uptake: [0.03, 0.18, 0.02],
  };
  const blockOn = S => 1 - prog(S.soil_pore, 0.15, 0.45);
  const labels = [
    { text: ['Ammonium', ' · from the fertiliser'], at: 'nh4', cls: 'amb', alpha: S => prog(S.soil_fert, 0.6, 0.85) * blockOn(S) * (1 - prog(S.soil_tracer, 0, 0.05)) * (1 - prog(S.soil_halo, 0, 0.3)) },
    { text: ['Nitrate', ' · washes away'], at: 'no3', cls: 'cyn', alpha: S => prog(S.soil_flow, 0.35, 0.6) * blockOn(S) * (1 - prog(S.soil_tracer, 0, 0.05)) },
    { text: ['N2O', ' · a greenhouse gas'], at: 'n2o', cls: 'mag', alpha: S => prog(S.soil_flow, 0.45, 0.7) * blockOn(S) * (1 - prog(S.soil_tracer, 0, 0.05)) * (1 - prog(S.soil_grass, 0, 0.3)) },
    { text: ['Taken up', ' by the plant'], at: 'uptake', cls: 'grn', alpha: S => prog(S.soil_flow, 0.55, 0.8) * blockOn(S) * (1 - prog(S.soil_tracer, 0, 0.05)) * (1 - prog(S.soil_chrom, 0, 0.1)) },
    { text: ['Archaea', ''], at: 'aoa', cls: 'mag', alpha: S => prog(S.soil_pore, 0.7, 0.9) * prog(S.soil_relay, 0.6, 1) * pickOk(S, 0) },
    { text: ['Bacteria', ''], at: 'aob', cls: 'amb', alpha: S => prog(S.soil_pore, 0.7, 0.9) * prog(S.soil_relay, 1.6, 2) * pickOk(S, 1) },
    { text: ['Nitrite oxidisers', ''], at: 'nob', cls: 'cyn', alpha: S => prog(S.soil_pore, 0.7, 0.9) * prog(S.soil_relay, 2.6, 3) * pickOk(S, 2) },
    { text: ['Comammox', ' · both steps'], at: 'comammox', cls: 'cyn', alpha: S => prog(S.soil_pore, 0.7, 0.9) * prog(S.soil_relay, 3.6, 4) * pickOk(S, 3) },
    { text: ['BNI', ' · from the roots'], at: 'halo', cls: 'cyn', alpha: S => prog(S.soil_halo, 0.4, 0.8) * blockOn(S) * (1 - prog(S.soil_tracer, 0, 0.05)) },
    { text: ['Wild grass', ' · Leymus racemosus'], at: 'grass', cls: 'grn', alpha: S => prog(S.soil_grass, 0.6, 0.9) },
    { text: ['Wheat', ' · Munal'], at: 'chromWheat', cls: 'amb', alpha: S => prog(S.soil_chrom, 0.05, 0.15) },
    { text: ['BNI trait', ' · a piece of chromosome'], at: 'segment', cls: 'cyn', alpha: S => prog(S.soil_chrom, 0.12, 0.25) * (1 - prog(S.soil_chrom, 0.9, 1)) },
    { text: ['One marked atom', ' · followed'], at: 'tracer', cls: '', alpha: S => prog(S.soil_tracer, 0.02, 0.08) * (1 - prog(S.soil_tracer, 0.92, 0.99)) },
    { text: ['Illustration', ''], at: 'corner', cls: '', minor: true, alpha: S => blockOn(S) * prog(S.soil_cut, 0.3, 0.8) },
  ];
  function pickOk(S, g) { const p = Math.round(S.soil_pick === undefined ? -1 : S.soil_pick); return p < 0 || p === g ? 1 : 0.35; }
  return Object.assign(set, {
    params: { soil_a: 1, soil_grow: 1, soil_cut: 1, soil_fert: 0, soil_flow: 0, soil_plant: 0.45, soil_inhibit: 0, soil_halo: 0,
      soil_dcd: 0, soil_pore: 0, soil_relay: 0, soil_grass: 0, soil_chrom: 0, soil_tracer: 0, soil_pick: -1 },
    log: [],
    update,
    anchors,
    labels,
    cam: {
      default: [-28, 18, 3.2, 0, 0.05, 0], plant: [-20, 10, 2.4, 0, 0.45, 0], roots: [-15, 4, 1.9, 0, -0.3, 0.15],
      surface: [-30, 22, 2.2, -0.1, 0.05, 0.1], pore: [-10, 6, 1.5, 0.18, -0.28, 0.25], relay: [0, 4, 1.2, 0.18, -0.28, 0.25],
      chrom: [-5, 8, 2.4, -0.1, 0.7, 0.2], tracer: [-25, 12, 2.8, 0, 0, 0],
    },
    controls: [
      { key: 'view', label: 'View', options: [['default', 'The block'], ['roots', 'The roots'], ['pore', 'A soil pore'], ['chrom', 'The chromosome']] },
      { key: 'fert', label: 'Fertiliser', options: [['on', 'Spread'], ['off', 'None']] },
      { key: 'wheat', label: 'Wheat', options: [['bni', 'BNI wheat'], ['ctrl', 'Control wheat']] },
      { key: 'dcd', label: 'Inhibitor', options: [['off', 'None'], ['on', 'DCD']] },
    ],
    // the Nitrogen sketch (a sketch, not data): the fertiliser falls and the flows build up again from c.t; the BNI wheat
    // brings its halo, DCD its granules, and both slow the relay
    explore(c) {
      const bni = c.wheat === 'bni', dcd = c.dcd === 'on', fert = c.fert !== 'off', pore = c.view === 'pore', chrom = c.view === 'chrom';
      return { soil_grow: 1, soil_cut: 1, soil_fert: fert ? K.prog(c.t, 0, 2.5) : 0, soil_flow: fert ? 0.3 + 0.7 * K.prog(c.t, 1.5, 3.5) : 0.2,
        soil_plant: 0.45, soil_halo: bni ? K.prog(c.t, 0.5, 2.5) : 0, soil_dcd: dcd ? 1 : 0, soil_inhibit: Math.min(1, (bni ? 0.6 : 0) + (dcd ? 0.8 : 0)),
        soil_pore: pore ? 1 : 0, soil_relay: pore ? 4 : 0, soil_grass: chrom ? 1 : 0, soil_chrom: chrom ? K.prog(c.t, 0.8, 5) : 0, soil_tracer: 0 };
    },
    api() { return { pick, guildAt, tracer: () => trOut.slice(), roots: ROOTS.length }; },
  });
};
