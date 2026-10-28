// The slide set of the topo story: the tissue on its glass slide, drawn in H&E from the real cells (TDATA: their
// positions and the cell classifier's types, nothing else). Two pieces of tissue: the healthy tile of 640 µm round the
// poster's patch, and the new slide's 1.5 mm window of 6,716 cells, each lying flat (x-z, y up) TW across, on a glass
// slide. Every cell is a splat by its type (hepatocyte-like polygons with a round nucleus, spindles along their
// neighbours, small dark lymphocytes, ...), over a stain map made at load from where the cells are (eosin where the
// hepatocytes press together, pale sinusoids between them, streaky collagen where fibroblasts gather, a haze of nuclei
// where lymphocytes do), lit as a gentle relief; far away a pre-averaged copy of the cells stands in for the splats.
// The modalities (sketched: spots whose colours mix the types under them; cells glowing by type on black) sweep across
// the tissue, and the cells collapse into glowing beads. Chapter 2's three fixed scales (a square patch, a ring of six
// links, a fixed circle) are drawn on the tile; the poster's patch can be marked. The overview of the new slide (its
// bins: the shape, purple where dense, pale streaks where the scars are) lies on a full glass slide with the window
// marked and zooms into it, so the camera need not move. Shares its frame with the map set (the window centred on the
// origin while it lies alone). Everything follows the params; t is not used.
SETS.slide = function (K) {
  const { THREE, clamp, lerp, prog } = K;
  const set = K.newSet('slide');
  const LK = TLOOK(K, set), T = TDATA, D = T.D, PI = Math.PI;
  const TW = 1.6;                             // the tile and the window lie TW across, centred on the origin
  const BOTH = { tx: -1.13, wx: 0.42 };       // side by side (slide_show 2): at the window's scale, the tile to its left
  const SLEN = 6.0, SEND = 1.25;              // the glass slide under them: its length, and how far its +x end reaches
  const OVL = 2.6, OVX = 0.27;                // the overview's glass slide: its length; the section's centre along it

  // ---------------------------------------------------------------- helpers
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // a uniform grid over a piece of tissue (µm), for the neighbours of a point
  function grid(x, y, n, side, cs) {
    const g = Math.ceil(side / cs) + 1, head = new Int32Array(g * g).fill(-1), next = new Int32Array(n);
    const ci = v => clamp(Math.floor(v / cs), 0, g - 1);
    for (let i = 0; i < n; i++) { const k = ci(x[i]) + g * ci(y[i]); next[i] = head[k]; head[k] = i; }
    return (px, py, r, fn) => {
      const a0 = ci(px - r), a1 = ci(px + r), b0 = ci(py - r), b1 = ci(py + r), r2 = r * r;
      for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) for (let i = head[a + g * b]; i >= 0; i = next[i]) {
        const dx = x[i] - px, dy = y[i] - py, d2 = dx * dx + dy * dy;
        if (d2 <= r2) fn(i, d2, dx, dy);
      }
    };
  }
  // seeded smooth noise over a plane, [-1, 1]
  function noise2(seed) {
    const r = K.rng(seed), v = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) v[i] = r() * 2 - 1;
    return (x, y) => {
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
      const a = v[(i & 63) | ((j & 63) << 6)], b = v[((i + 1) & 63) | ((j & 63) << 6)];
      const c = v[(i & 63) | (((j + 1) & 63) << 6)], e = v[((i + 1) & 63) | (((j + 1) & 63) << 6)];
      return a + (b - a) * u + (c - a) * w + (a - b - c + e) * u * w;
    };
  }
  // a pool's own fade: its material's uA becomes a uniform of its own (set every frame to the set's fade times f)
  const ownA = mesh => { const u = { value: 0 }; (mesh.isGroup ? mesh.children : [mesh]).forEach(m => { m.material.uniforms.uA = u; }); return u; };
  const dataTex = (arr, w, h, mip) => {
    const t = new THREE.DataTexture(arr, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter; t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.generateMipmaps = !!mip;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };

  // ---------------------------------------------------------------- how each type is drawn (drawing, not science)
  // [kind, radius in µm (a hepatocyte's comes from its neighbours), H and E of its cytoplasm, H and E of its nucleus]
  const CELL = LK.CELL;
  const LOOK = {
    [CELL.HEP]: [10.5, 0.08, 0.42, 1.0, 0.24], [CELL.LARGE]: [11.5, 0.13, 0.38, 1.35, 0.3], [CELL.SPINDLE]: [10, 0.05, 0.5, 1.25, 0.3],
    [CELL.SMALL]: [4.3, 0.25, 0.18, 1.75, 0.2], [CELL.LOBED]: [5.5, 0.06, 0.32, 1.3, 0.3], [CELL.BODY]: [6.4, 0.05, 0.8, 1.9, 0.4],
    [CELL.RBC]: [3.8, 0, 0, 0, 0], [CELL.PLAIN]: [8, 0.08, 0.36, 1.15, 0.25],
  };
  const RBC = K.rgb('#d9455f'), DAPI = [0.3, 0.45, 1.0];

  // ---------------------------------------------------------------- a piece of tissue
  // src: TDATA.tile or TDATA.slide (x, y in µm, y down; type), side in µm. Built into its own group, TW across.
  function tissue(src, side, seed) {
    const n = src.n, k = TW / side, R = K.rng(seed), near = grid(src.x, src.y, n, side, 25);
    const g = new THREE.Group();
    const X = new Float32Array(n), Z = new Float32Array(n), RAD = new Float32Array(n), KIND = new Uint8Array(n), ANG = new Float32Array(n);
    const CY = new Float32Array(3 * n), NU = new Float32Array(3 * n), FC = new Float32Array(3 * n), FN = new Float32Array(3 * n);
    const names = src.types, kindOf = names.map(LK.kindOf), tcol = names.map(nm => K.rgb(T.typeColour(nm)));
    const stainN = noise2(seed + 1);
    for (let i = 0; i < n; i++) {
      const kd = kindOf[src.type[i]], L = LOOK[kd], x = src.x[i], y = src.y[i];
      X[i] = (x - side / 2) * k; Z[i] = (y - side / 2) * k; KIND[i] = kd;
      // hepatocytes press together, so their size follows how close the cells round them sit (the spacing of a
      // hexagonal packing as dense as the cells within 30 µm)
      let cnt = 0, sxx = 0, sxy = 0, syy = 0, ns = 0;
      near(x, y, 36, (j, q, dx, dy) => {
        if (q <= 900) cnt++;
        if (j !== i && kd === CELL.SPINDLE && kindOf[src.type[j]] === CELL.SPINDLE) { sxx += dx * dx; sxy += dx * dy; syy += dy * dy; ns++; }
      });
      const sp = 1.0746 / Math.sqrt(cnt / (PI * 900));
      let r = L[0];
      if (kd === CELL.HEP || kd === CELL.LARGE) r = clamp(0.6 * sp, 9, kd === CELL.LARGE ? 16 : 15.5) * (0.94 + 0.12 * R());
      else if (kd === CELL.PLAIN) r = clamp(0.45 * sp, 5.5, 9);
      else r *= 0.9 + 0.2 * R();
      RAD[i] = r * k;
      // spindles lie along their spindle neighbours (the main axis of where they sit), else any way
      ANG[i] = kd === CELL.SPINDLE && ns >= 2 ? 0.5 * Math.atan2(2 * sxy, sxx - syy) + (R() - 0.5) * 0.3 : R() * PI * 2;
      // staining varies gently across the slide, and a little from cell to cell
      const m = 0.9 + 0.12 * stainN(x / 140, y / 140) + 0.08 * (R() - 0.5);
      if (kd === CELL.RBC) { CY.set(RBC, 3 * i); NU.set(RBC, 3 * i); } else {
        const c = LK.he(L[1], L[2] * m), u = LK.he(L[3] * (0.92 + 0.16 * R()), L[4]);
        CY[3 * i] = c[0]; CY[3 * i + 1] = c[1]; CY[3 * i + 2] = c[2]; NU[3 * i] = u[0]; NU[3 * i + 1] = u[1]; NU[3 * i + 2] = u[2];
      }
      // in fluorescence: the type's colour, the nucleus lit as by a DNA stain
      const t = tcol[src.type[i]];
      for (let j = 0; j < 3; j++) { FC[3 * i + j] = t[j] * 0.75; FN[3 * i + j] = lerp(t[j], DAPI[j], 0.55) * 1.05; }
    }

    // the stain map (S x S): R the hepatocytes' cytoplasm, G collagen (where spindle cells gather), B a haze of nuclei
    // (where lymphocytes and the like gather), A the tissue itself (a soft cover of every cell); and a direction field
    // for the collagen's fibres (the spindles' angles)
    // (each field: the cells' weights dropped into a grid, then blurred: much cheaper than a kernel per cell)
    const S = 256, ts = side / S, M = 32, DIR = new Float32Array(M * M * 3), P = 64, tp = side / P;
    const fCy = new Float32Array(S * S), fCo = new Float32Array(S * S), fHz = new Float32Array(S * S), fTi = new Float32Array(P * P);
    const drop = (f, N, t, x, y, w) => {
      const fx = x / t - 0.5, fy = y / t - 0.5, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
        const ii = i + a, jj = j + b;
        if (ii >= 0 && jj >= 0 && ii < N && jj < N) f[ii + N * jj] += w * (a ? u : 1 - u) * (b ? v : 1 - v);
      }
    };
    for (let i = 0; i < n; i++) {
      const kd = KIND[i], x = src.x[i], y = src.y[i], r = RAD[i] / k;
      if (kd === CELL.HEP || kd === CELL.LARGE || kd === CELL.PLAIN) drop(fCy, S, ts, x, y, r * r / 95);
      else if (kd === CELL.SPINDLE) {
        drop(fCo, S, ts, x, y, 1);
        const a = 2 * ANG[i], di = clamp(Math.floor(x / side * M), 0, M - 1) + M * clamp(Math.floor(y / side * M), 0, M - 1);
        DIR[3 * di] += Math.cos(a); DIR[3 * di + 1] += Math.sin(a); DIR[3 * di + 2]++;
      } else if (kd !== CELL.RBC) { drop(fHz, S, ts, x, y, 1); drop(fCo, S, ts, x, y, 0.25); }
      drop(fTi, P, tp, x, y, 1);
    }
    // a blur of about sigma µm (three box blurs each way, running sums: the cost does not grow with sigma), scaled so
    // that a lone cell of weight w becomes a bump w x scale high
    const tmp = new Float32Array(S * S);
    function blur(f, N, t, sig, scale) {
      const st = sig / t, r = Math.max(1, Math.round((Math.sqrt(4 * st * st + 1) - 1) / 2)), w = 2 * r + 1;
      // the middle of three boxes: (a lone 1, blurred) for the scale
      let c = new Float32Array(6 * r + 1);
      c[3 * r] = 1;
      for (let p = 0; p < 3; p++) { const d = new Float32Array(c.length); for (let i = 0; i < c.length; i++) for (let q = -r; q <= r; q++) if (i + q >= 0 && i + q < c.length) d[i] += c[i + q]; c = d; }
      const peak = scale / (c[3 * r] * c[3 * r]), g = tmp.length >= N * N ? tmp : new Float32Array(N * N);
      const pass = (src, dst, along) => {   // along 1: rows, N: columns
        const across = along === 1 ? N : 1;
        for (let line = 0; line < N; line++) {
          const o = line * across;
          let acc = 0;
          for (let q = 0; q <= r && q < N; q++) acc += src[o + q * along];
          for (let i = 0; i < N; i++) {
            dst[o + i * along] = acc;
            if (i + r + 1 < N) acc += src[o + (i + r + 1) * along];
            if (i - r >= 0) acc -= src[o + (i - r) * along];
          }
        }
      };
      pass(f, g, 1); pass(g, f, 1); pass(f, g, 1);
      pass(g, f, N); pass(f, g, N); pass(g, f, N);
      for (let q = 0; q < N * N; q++) f[q] *= peak;
      return w;
    }
    blur(fCy, S, ts, 12, 0.42); blur(fCo, S, ts, 13, 0.4); blur(fHz, S, ts, 9, 0.28); blur(fTi, P, tp, 24, 0.55);
    const SB = new Uint8Array(S * S * 4);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const o = i + S * j, px = (i + 0.5) * ts / tp - 0.5, py = (j + 0.5) * ts / tp - 0.5;
      const a = clamp(Math.floor(px), 0, P - 2), b = clamp(Math.floor(py), 0, P - 2), u = clamp(px - a, 0, 1), v = clamp(py - b, 0, 1);
      const ti = (fTi[a + P * b] * (1 - u) + fTi[a + 1 + P * b] * u) * (1 - v) + (fTi[a + P * (b + 1)] * (1 - u) + fTi[a + 1 + P * (b + 1)] * u) * v;
      SB[4 * o] = Math.min(255, fCy[o] * 255); SB[4 * o + 1] = Math.min(255, fCo[o] * 255); SB[4 * o + 2] = Math.min(255, fHz[o] * 255); SB[4 * o + 3] = Math.min(255, ti * 255);
    }
    const DB = new Uint8Array(M * M * 4);
    for (let d = 0; d < M * M; d++) {
      const c = DIR[3 * d], s = DIR[3 * d + 1], l = Math.hypot(c, s) || 1, w = Math.min(1, DIR[3 * d + 2] / 3);
      DB[4 * d] = 127.5 + 127 * c / l * w; DB[4 * d + 1] = 127.5 + 127 * s / l * w; DB[4 * d + 2] = 0; DB[4 * d + 3] = 255;
    }
    // the cells, pre-averaged for far views (premultiplied colour and cover): each cell's ellipse, its nucleus darker
    const C = 256, tc = side / C, CF = new Float32Array(C * C * 4);
    const ASP = [0.92, 0.84, 0.26, 0.95, 0.94, 0.64, 0.97, 0.9], NR = [0.34, 0.5, 0.45, 0.76, 0.5, 0.5, 0, 0.42];
    // (the hot loop in a small function of its own, so the engine optimises it at once)
    function rasterCell(i) {
      const kd = KIND[i], a = RAD[i] / k / tc * (kd === CELL.BODY ? 0.64 : 1), b = a * ASP[kd], ca = Math.cos(ANG[i]), sa = Math.sin(ANG[i]);
      const cx = src.x[i] / tc - 0.5, cy = src.y[i] / tc - 0.5, e = Math.ceil(a) + 1, nr2 = NR[kd] * NR[kd], ia = 1 / a, ib = 1 / Math.max(b, 0.35);
      const j0 = Math.max(0, Math.floor(cy - e)), j1 = Math.min(C - 1, Math.ceil(cy + e)), i0 = Math.max(0, Math.floor(cx - e)), i1 = Math.min(C - 1, Math.ceil(cx + e));
      for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
        const dx = ii - cx, dy = j - cy, u = (dx * ca + dy * sa) * ia, v = (dy * ca - dx * sa) * ib, r2 = u * u + v * v;
        if (r2 >= 1.3225) continue;
        const rho = Math.sqrt(r2), cov = Math.min(1, (1.15 - rho) / 0.3) * 0.92, o = 4 * (ii + C * j), src3 = r2 < nr2 ? NU : CY;
        CF[o] += cov * src3[3 * i]; CF[o + 1] += cov * src3[3 * i + 1]; CF[o + 2] += cov * src3[3 * i + 2]; CF[o + 3] += cov;
      }
    }
    for (let i = 0; i < n; i++) rasterCell(i);
    const CB = new Uint8Array(C * C * 4);
    for (let o = 0; o < CF.length; o += 4) {
      const w = CF[o + 3] > 1 ? 1 / CF[o + 3] : 1;
      CB[o] = Math.min(255, CF[o] * w * 255); CB[o + 1] = Math.min(255, CF[o + 1] * w * 255); CB[o + 2] = Math.min(255, CF[o + 2] * w * 255); CB[o + 3] = Math.min(255, CF[o + 3] * w * 255);
    }

    // the ground: one quad, the stain computed in its shader (Beer-Lambert, as the tour's tissue set), lit as a relief
    const U = { uA: { value: 0 }, tS: { value: dataTex(SB, S, S) }, tD: { value: dataTex(DB, M, M) }, tC: { value: dataTex(CB, C, C, true) },
      uSide: { value: side }, uTW: { value: TW }, uCell: { value: 20 * k }, uM1: { value: 0 }, uM2: { value: 0 }, uPts: { value: 0 }, uAll: { value: 0 }, uDim: { value: 0 }, uTexel: { value: 1 / S } };
    const mat = new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, extensions: { derivatives: true },
      vertexShader: `varying vec2 vUv; varying vec3 vN0, vT, vB;
void main() {
  vUv = vec2(uv.x, 1.0 - uv.y);   // (rows run down the slide, as its y)
  vN0 = normalMatrix * vec3(0.0, 1.0, 0.0); vT = normalMatrix * vec3(1.0, 0.0, 0.0); vB = normalMatrix * vec3(0.0, 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: `uniform sampler2D tS, tD, tC; uniform float uA, uSide, uTW, uCell, uM1, uM2, uPts, uAll, uDim, uTexel;
varying vec2 vUv; varying vec3 vN0, vT, vB;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
// the map set's sweep: where the dome has passed (rows of 100 µm, back and forth), as its cells' visit order
float visited(vec2 q) {
  float rows = uSide / 100.0, row = min(floor(q.y / 100.0), rows - 1.0), f = q.x / uSide;
  if (mod(row, 2.0) > 0.5) f = 1.0 - f;
  return smoothstep(0.0, 0.05, uAll - (row + f) / rows * 0.92);
}
void main() {
  vec2 p = vUv * uSide;                                   // µm
  float px = max(fwidth(vUv.x), fwidth(vUv.y)) * uTW;     // local units per pixel
  vec4 s = texture2D(tS, vUv), d = texture2D(tD, vUv);
  float cy = min(s.r * 1.25, 1.0), co = min(s.g, 1.0), hz = min(s.b, 1.0), ti = smoothstep(0.2, 0.42, s.a + 0.08 * (vn(p / 30.0) - 0.5));
  // eosin: the hepatocytes' cytoplasm pink, pale sinusoids between them, paler streaky collagen; haematoxylin: a haze
  float E = 0.2 + 0.24 * cy + 0.2 * co, H = 0.02 + 0.5 * hz + 0.04 * co;
  E *= 0.88 + 0.24 * vn(p / 9.0);                         // uneven staining
  vec2 fv = d.rg * 2.0 - 1.0; float fs = length(fv);
  float kf = smoothstep(0.004, 0.0015, px) * co * min(1.0, fs * 1.5);
  if (kf > 0.01) {                                        // collagen fibres along the spindles, once close
    float a = 0.5 * atan(fv.y, fv.x); vec2 dd = vec2(cos(a), sin(a)), q = vec2(dot(p, dd), dot(p, vec2(-dd.y, dd.x)));
    float b = vn(vec2(q.x * 0.09, q.y * 0.8 + 2.0 * vn(q * 0.05)));
    E *= 1.0 + kf * (b - 0.5) * 0.8;
  }
  // empty spaces (vessels) white; between the hepatocytes thin pale sinusoids, wandering slits
  float V = (1.0 - smoothstep(0.02, 0.16, cy + 0.55 * co + 0.6 * hz)) * (0.8 + 0.3 * vn(p / 4.0 + 7.0)) * smoothstep(0.35, 0.65, s.a);   // (not at the tissue's edge)
  float sn = vn(p / 14.0 + 1.5 * vec2(vn(p / 40.0), vn(p / 40.0 + 9.0))), sw = fwidth(sn) * 1.2 + 0.012;
  V = max(V, 0.7 * (1.0 - smoothstep(0.0, sw, abs(sn - 0.5))) * smoothstep(0.2, 0.6, cy) * (1.0 - co) * smoothstep(0.012, 0.004, px));
  vec3 he = exp(-E * vec3(0.16, 1.05, 0.60) - H * vec3(1.31, 1.37, 0.62));
  he = mix(he, vec3(0.97, 0.95, 0.97), clamp(V, 0.0, 1.0));
  // far away the cells come from their pre-averaged map; close up they are drawn one by one
  float lod = smoothstep(1.2, 3.0, uCell / px);
  vec4 c = texture2D(tC, vUv) * (1.0 - lod);
  he = he * (1.0 - c.a) + c.rgb;
  // relief: the cytoplasm and the collagen stand a little proud
  float hx = texture2D(tS, vUv + vec2(uTexel, 0.0)).r - texture2D(tS, vUv - vec2(uTexel, 0.0)).r + 0.5 * (texture2D(tS, vUv + vec2(uTexel, 0.0)).g - texture2D(tS, vUv - vec2(uTexel, 0.0)).g);
  float hy = texture2D(tS, vUv + vec2(0.0, uTexel)).r - texture2D(tS, vUv - vec2(0.0, uTexel)).r + 0.5 * (texture2D(tS, vUv + vec2(0.0, uTexel)).g - texture2D(tS, vUv - vec2(0.0, uTexel)).g);
  vec3 nl = normalize(vec3(-hx * 0.9, 1.0, -hy * 0.9));
  vec3 n = normalize(nl.x * vT + nl.y * vN0 + nl.z * vB), n0 = normalize(vN0), l = normalize(vec3(-0.45, 0.55, 0.7));
  he *= 1.0 + 0.6 * (max(dot(n, l), 0.0) - max(dot(n0, l), 0.0));
  // the modalities (sketched): under the spots the stain dims; fluorescence is dark with a faint autofluorescence
  float w1 = smoothstep(0.0, 0.18, uM1 * 1.18 - vUv.x), w2 = smoothstep(0.0, 0.18, uM2 * 1.18 - vUv.x);   // the sweeps, from the left
  float uSpots = w1 * (1.0 - w2), uDark = max(w2, 0.85 * uPts);
  vec3 col = mix(he, he * 0.55, uSpots);
  vec3 fl = vec3(0.006, 0.01, 0.022) + vec3(0.03, 0.05, 0.045) * (0.4 * cy + co) + vec3(0.04, 0.02, 0.06) * hz;
  col = mix(col, fl, uDark);
  // as points: dark glass with the tissue's ghost
  col = mix(col, vec3(0.02, 0.035, 0.06) + 0.05 * vec3(0.5, 0.6, 0.8) * cy, uPts);
  // where the map set's dome has passed, the tissue dims to a ghost so the relief reads
  float dm = uDim * visited(p);
  col = mix(col, col * 0.3 + vec3(0.01, 0.02, 0.04), dm);
  gl_FragColor = vec4(col, uA * ti * (1.0 - 0.55 * dm) * (1.0 - 0.15 * uPts));
}`,
    });
    mat.userData.fixed = true;   // (its depth writes are its own: LK.depth() leaves it alone)
    set.mats.push(mat);
    const quad = new THREE.PlaneGeometry(TW, TW);
    quad.rotateX(-PI / 2);
    const ground = new THREE.Mesh(quad, mat);
    ground.renderOrder = -1;   // (before every other see-through thing of the set: the glass below, the cells above)
    g.add(ground);

    // the cells: H&E splats, and the same cells glowing by type for the fluorescence sketch
    const he = LK.cells(n), fl = LK.cells(n, { additive: true });
    fl.lod(0.35, 0.9);
    g.add(he.mesh, fl.mesh);
    const heA = ownA(he.mesh), flA = ownA(fl.mesh);
    // the spots of the transcriptomics sketch (hexagonal, 50 µm apart, 28 µm across: their colours mix the types under them)
    const spots = [], SP = 50, SR = 14;
    for (let row = 0, y = SP / 2; y < side; row++, y += SP * 0.866) for (let x = row % 2 ? SP : SP / 2; x < side; x += SP) {
      let r = 0, gg = 0, b = 0, w = 0;
      near(x, y, SR * 1.25, j => { const c = tcol[src.type[j]]; r += c[0]; gg += c[1]; b += c[2]; w++; });
      // (the mix brightened to a clear colour: a spot reads all the types under it at once)
      const c = w ? [r / w, gg / w, b / w] : [0.32, 0.36, 0.44], mx = w ? 0.95 / Math.max(c[0], c[1], c[2], 1e-3) : 1;
      spots.push((x - side / 2) * k, (y - side / 2) * k, Math.min(1, c[0] * mx), Math.min(1, c[1] * mx), Math.min(1, c[2] * mx), w ? 1 : 0.35);
    }
    const sp = spotMesh(spots, SR * k);
    g.add(sp.mesh);
    return { n, side, k, g, X, Z, RAD, KIND, ANG, CY, NU, FC, FN, U, ground, he, fl, heA, flA, sp, key: '', near };
  }

  // spots: flat round wells on the tissue, each a soft lit dome of its colour (one instanced mesh, filled once)
  function spotMesh(list, r) {
    const m = list.length / 6, g = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(2, 2);
    g.setAttribute('position', q.attributes.position); g.setIndex(q.index);
    const P = new Float32Array(m * 3), C = new Float32Array(m * 4);
    for (let i = 0; i < m; i++) { P[3 * i] = list[6 * i]; P[3 * i + 1] = list[6 * i + 1]; P[3 * i + 2] = i; C.set(list.slice(6 * i + 2, 6 * i + 6), 4 * i); }
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(P, 3)); g.setAttribute('aC', new THREE.InstancedBufferAttribute(C, 4));
    g.instanceCount = m;
    const U = { uA: { value: 0 }, uR: { value: r }, uWipe: { value: 0 }, uWipe2: { value: 0 }, uTW: { value: TW } };
    const mat = new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false,
      vertexShader: `attribute vec3 aP; attribute vec4 aC; uniform float uA, uR, uWipe, uWipe2, uTW;
varying vec2 vQ; varying vec4 vC; varying float vA;
void main() {
  vQ = position.xy; vC = aC;
  // the sweep comes from the left
  float f = (aP.x / uTW + 0.5);
  vA = uA * smoothstep(0.0, 0.18, uWipe * 1.18 - f) * (1.0 - smoothstep(0.0, 0.18, uWipe2 * 1.18 - f)) * aC.a;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(aP.x + position.x * uR, 0.0015, aP.y - position.y * uR, 1.0);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `varying vec2 vQ; varying vec4 vC; varying float vA;
void main() {
  float d = length(vQ);
  if (d > 1.0) discard;
  float w = fwidth(d), e = 1.0 - smoothstep(1.0 - 1.5 * w, 1.0, d);
  float z = sqrt(max(0.0, 1.0 - d * d)), lit = 0.74 + 0.26 * clamp(dot(vec3(vQ.x, vQ.y, z), normalize(vec3(-0.45, 0.6, 0.65))), 0.0, 1.0);
  vec3 c = vC.rgb * lit + vec3(1.0) * pow(max(0.0, 1.0 - length(vQ - vec2(-0.35, 0.38)) * 1.6), 3.0) * 0.35;
  c = mix(c * 0.55, c, smoothstep(1.0, 0.85, d));   // a darker rim
  gl_FragColor = vec4(c, vA * e * 0.92);
}`,
      extensions: { derivatives: true },
    });
    mat.userData.fixed = true;
    set.mats.push(mat);
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;   // (over the cells)
    return { mesh, U };
  }

  const TILE = tissue(T.tile, D.tile.side, 640), WIN = tissue(T.slide, D.slide.side, 1500);
  const inner = new THREE.Group();
  inner.add(TILE.g, WIN.g);
  set.group.add(inner);

  // ---------------------------------------------------------------- the glass slides
  const glass = LK.slides(2);
  set.group.add(glass.mesh);
  const SL = glass.dims;

  // ---------------------------------------------------------------- the overview of the new slide (its bins)
  const O = D.slide.overview, ow = O.w, oh = O.h;
  const ocnt = T.b64(O.count, Uint8Array), oscar = T.b64(O.scar, Uint8Array), OB = new Uint8Array(ow * oh * 4);
  for (let i = 0; i < ow * oh; i++) { OB[4 * i] = ocnt[i]; OB[4 * i + 1] = oscar[i]; OB[4 * i + 2] = ocnt[i] > 0 ? 255 : 0; OB[4 * i + 3] = 255; }
  const OS = Math.min(1.62 / ow, (OVL * SL.wid - 0.14) / oh);          // units per bin, the section fitting on its glass
  const ovW = ow * OS, ovH = oh * OS;
  // where the window lies on it (centre and side, in the overview's frame: the section centred on [OVX, 0, 0])
  const owin = { x: OVX + (O.window[0] + O.window[2] / 2 - ow / 2) * OS, z: (O.window[1] + O.window[2] / 2 - oh / 2) * OS, side: O.window[2] * OS };
  const ovG = new THREE.Group();
  const ovU = { uA: { value: 0 }, tO: { value: dataTex(OB, ow, oh) }, uSz: { value: new THREE.Vector2(ow, oh) } };
  const ovMat = new THREE.ShaderMaterial({
    uniforms: ovU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = vec2(uv.x, 1.0 - uv.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tO; uniform float uA; uniform vec2 uSz; varying vec2 vUv;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  vec2 b = vUv * uSz;                                     // in bins
  vec4 o = texture2D(tO, vUv);
  float edge = vn(b * 1.7) - 0.5 + 0.5 * (vn(b * 5.0) - 0.5);
  float pres = smoothstep(0.42, 0.62, o.b + 0.28 * edge);
  float dens = o.r, scar = o.g;
  // purple where the cells are dense, the scars' collagen pale and streaky, a grain of nuclei
  float grain = vn(b * 9.0) - 0.5, streak = vn(b * 2.2 + 2.5 * vec2(vn(b * 0.5), vn(b * 0.5 + 5.0)));
  float E = 0.32 + 0.22 * dens * (1.0 - scar) + 0.12 * scar * streak + 0.06 * grain;
  float H = 0.08 + 0.55 * dens * (0.55 + 0.6 * scar) + 0.12 * grain * dens;
  vec3 he = exp(-E * vec3(0.16, 1.05, 0.60) - H * vec3(1.31, 1.37, 0.62));
  he = mix(he, vec3(0.96, 0.93, 0.95), 0.4 * scar * smoothstep(0.4, 0.8, streak));
  gl_FragColor = vec4(he, uA * pres);
}`,
  });
  ovMat.userData.fixed = true;
  set.mats.push(ovMat);
  const ovGeo = new THREE.PlaneGeometry(ovW, ovH);
  ovGeo.rotateX(-PI / 2);
  const ovMesh = new THREE.Mesh(ovGeo, ovMat);
  ovMesh.position.x = OVX; ovMesh.renderOrder = -1;
  ovG.add(ovMesh);
  set.group.add(ovG);

  // ---------------------------------------------------------------- chapter 2's fixed scales, on the tile (drawing)
  const tk = TILE.k, th = D.tile.side / 2, TP = D.tile.patch;
  const tpos = (x, y, out) => { out[0] = (x - th) * tk; out[1] = 0.003; out[2] = (y - th) * tk; return out; };
  // the cell nearest to a point (µm) of the given kinds
  function nearest(t, x, y, kinds) {
    let best = -1, bd = 1e18;
    for (let i = 0; i < t.n; i++) {
      if (kinds && !kinds.includes(t.KIND[i])) continue;
      const q = (T.tile.x[i] - x) ** 2 + (T.tile.y[i] - y) ** 2;
      if (q < bd) { bd = q; best = i; }
    }
    return best;
  }
  const GRID = 100, gq = [1, 4];                              // a 100 µm grid; the square lit (its column, row)
  const HUB = nearest(TILE, 520, 150, [CELL.HEP]), CIR = nearest(TILE, 150, 500, [CELL.HEP]), CIRR = 30;
  const six = [];
  {
    const d = [];
    for (let i = 0; i < TILE.n; i++) if (i !== HUB) d.push([(T.tile.x[i] - T.tile.x[HUB]) ** 2 + (T.tile.y[i] - T.tile.y[HUB]) ** 2, i]);
    d.sort((a, b) => a[0] - b[0]);
    for (let j = 0; j < 6; j++) six.push(d[j][1]);
  }
  const inCircle = [];
  for (let i = 0; i < TILE.n; i++) if ((T.tile.x[i] - T.tile.x[CIR]) ** 2 + (T.tile.y[i] - T.tile.y[CIR]) ** 2 <= CIRR * CIRR) inCircle.push(i);

  const tubes = LK.tubes(48), balls = LK.balls(32), rings = LK.rings(4), halos = LK.halos(24);
  TILE.g.add(tubes.mesh, balls.mesh, rings.mesh, halos.mesh);
  const mark = LK.tubes(8), markH = LK.halos(4);
  set.group.add(mark.mesh, markH.mesh);

  // ---------------------------------------------------------------- the layout (slide_show: 0 tile, 1 window, 2 both)
  // { ta, wa: the two pieces' presence; tx, ts: the tile's place and scale; wx: the window's place } (the map set
  // repeats wx so its things stay on the window)
  const layout = s => {
    s = clamp(s, 0, 2);
    const f = Math.max(0, s - 1);
    return { ta: s <= 1 ? 1 - s : f, wa: Math.min(1, s), tx: BOTH.tx * f, ts: lerp(1, D.tile.side / D.slide.side, f), wx: BOTH.wx * f };
  };

  // the overview's zoom: z 0 the whole section on its glass (centred on the origin), 1 into the window (TW across, at wx)
  const zoomOf = over => 1 - clamp(over, 0, 1);
  function ovPlace(z, wx) {
    const F = Math.exp(z * Math.log(TW / owin.side)), cx = lerp(owin.x, wx, z), cz = lerp(owin.z, 0, z);
    ovG.scale.setScalar(F);
    ovG.position.set(cx - owin.x * F, 0, cz - owin.z * F);
    return F;
  }
  const toOv = (p, out) => { out[0] = ovG.position.x + p[0] * ovG.scale.x; out[1] = p[1] * ovG.scale.x; out[2] = ovG.position.z + p[2] * ovG.scale.x; return out; };

  // ---------------------------------------------------------------- filling the cells (again only when their look changes)
  // mode 0 H&E, 1 spots, 2 fluorescence (in between, a sweep from the left); dim (0..1) where the map's dome has passed
  const visit = (t, i) => {
    const x = T.slide.x[i], y = T.slide.y[i], rows = t.side / 100, row = Math.min(Math.floor(y / 100), rows - 1);
    let f = x / t.side;
    if (row % 2) f = 1 - f;
    return (row + f) / rows * 0.92;
  };
  const VIS = new Float32Array(WIN.n);
  for (let i = 0; i < WIN.n; i++) VIS[i] = visit(WIN, i);
  const _p = [0, 0, 0], _c = [0, 0, 0], _n = [0, 0, 0], UP = [0, 1, 0];
  const wipe = (f, x) => sstep(0, 0.18, f * 1.18 - (x / TW + 0.5));   // the sweep's share at x for a step's progress f
  function fill(t, mode, all) {
    const key = `${Math.round(mode * 100)}|${Math.round(all * 100)}`;
    if (key === t.key) return;
    t.key = key;
    t.he.begin(); t.fl.begin();
    const m1 = clamp(mode, 0, 1), m2 = clamp(mode - 1, 0, 1);
    for (let i = 0; i < t.n; i++) {
      const w1 = wipe(m1, t.X[i]), w2 = wipe(m2, t.X[i]);
      // H&E fully until the spots sweep in (under them it stays, a little dimmed), gone where the fluorescence comes
      const dim = t === WIN && all > 0 ? sstep(0, 0.05, all - VIS[i]) : 0;
      const ha = (1 - 0.45 * w1 * (1 - w2)) * (1 - w2) * (1 - 0.8 * dim), fa = w2 * (1 - 0.8 * dim);
      _p[0] = t.X[i]; _p[1] = 0.0008; _p[2] = t.Z[i];
      _c[0] = t.CY[3 * i]; _c[1] = t.CY[3 * i + 1]; _c[2] = t.CY[3 * i + 2];
      _n[0] = t.NU[3 * i]; _n[1] = t.NU[3 * i + 1]; _n[2] = t.NU[3 * i + 2];
      if (ha > 0.004) t.he.add(_p, t.RAD[i], t.KIND[i], _c, ha, t.ANG[i], UP, _n);
      if (fa > 0.004) {
        _c[0] = t.FC[3 * i]; _c[1] = t.FC[3 * i + 1]; _c[2] = t.FC[3 * i + 2];
        _n[0] = t.FN[3 * i]; _n[1] = t.FN[3 * i + 1]; _n[2] = t.FN[3 * i + 2];
        t.fl.add(_p, t.RAD[i], t.KIND[i], _c, fa, t.ANG[i], UP, _n);
      }
    }
    t.he.end(); t.fl.end();
  }

  // ---------------------------------------------------------------- update
  const now = { lay: layout(0), F: 1, wx: 0 };
  const CYANG = [0.55, 0.92, 1.0], AMB = LK.PIECE, _a = [0, 0, 0], _b = [0, 0, 0], _q = [0, 0, 0, 1];
  function update(S) {
    const lay = layout(S.slide_show), all = clamp(S.map_all || 0, 0, 1) * clamp(S.map_a === undefined ? 0 : S.map_a, 0, 1);
    now.lay = lay;
    const over = clamp(S.slide_over, 0, 1), z = zoomOf(over), oa = prog(over, 0.02, 0.22), wd = 1 - prog(over, 0.08, 0.3);
    const mode = clamp(S.slide_mode, 0, 2), pts = clamp(S.slide_points, 0, 1), A = set.uA.value;
    TILE.g.position.set(lay.tx, 0, 0); TILE.g.scale.setScalar(lay.ts);
    WIN.g.position.set(lay.wx, 0, 0);
    now.wx = lay.wx;
    // each piece: its ground, its cells, its spots
    for (const [t, a0] of [[TILE, lay.ta], [WIN, lay.wa * wd]]) {
      const a = a0 * A, on = a > 0.003;
      t.g.visible = on;
      if (!on) continue;
      fill(t, mode, t === WIN ? all : 0);
      const m1 = clamp(mode, 0, 1), m2 = clamp(mode - 1, 0, 1);
      t.U.uA.value = a; t.U.uM1.value = m1; t.U.uM2.value = m2; t.U.uPts.value = pts; t.U.uAll.value = all; t.U.uDim.value = t === WIN ? Math.min(1, all * 4) : 0;
      t.heA.value = a; t.flA.value = a;
      t.he.bead(pts); t.fl.bead(pts);
      t.sp.U.uA.value = a * (1 - pts); t.sp.U.uWipe.value = m1; t.sp.U.uWipe2.value = m2;   // in with the first sweep, out with the second
      t.sp.mesh.visible = t.sp.U.uA.value > 0.003 && m1 > 0.003 && m2 < 0.999;
      // the ground writes depth only while it is fully there (so the glass below never shows through it)
      t.ground.material.depthWrite = a > 0.97 && pts < 0.05 && all < 0.01;
    }
    // the glass slide under them: its +x end just past the tissue, its label far off to the left; the overview's glass
    glass.begin();
    const ga = Math.max(lay.ta, lay.wa * wd);
    if (ga > 0.003) {
      const end = lay.wa >= 1 && lay.ta > 0 ? lerp(SEND, BOTH.wx + TW / 2 + 0.45, lay.ta) : SEND;
      _a[0] = end - SLEN / 2; _a[1] = -SL.thick * 0.5 * 0.5 - 0.0015; _a[2] = 0;
      glass.add(_a, null, [SLEN, 0.5, SLEN * 1.2], LK.SLIDE, ga * (1 - 0.6 * pts), 0);
    }
    now.F = ovPlace(z, lay.wx);
    ovU.uA.value = oa * A;
    ovG.visible = oa > 0.003;
    if (oa > 0.003) {
      _b[0] = 0; _b[1] = -SL.thick * 0.5 * 0.4 - 0.0015; _b[2] = 0;
      toOv(_b, _a);
      glass.add(_a, null, [OVL * now.F, 0.4 * now.F, OVL * now.F], LK.SLIDE, oa * (1 - prog(z, 0.6, 0.95)), 0);
    }
    glass.end();
    // the window marked on the overview (a glowing square, the same size on screen as it grows)
    mark.begin(); markH.begin();
    const ma = oa * (1 - prog(z, 0.75, 1)) * Math.max(0.35, 1 - prog(z, 0.4, 0.8));
    if (ma > 0.003) {
      const h = owin.side / 2, c = [[-h, -h], [h, -h], [h, h], [-h, h]], rad = 0.0045;
      for (let j = 0; j < 4; j++) {
        const p0 = c[j], p1 = c[(j + 1) % 4];
        toOv([owin.x + p0[0], 0.004 / now.F, owin.z + p0[1]], _a); toOv([owin.x + p1[0], 0.004 / now.F, owin.z + p1[1]], _b);
        mark.add(_a, _b, rad, CYANG, ma, 0);
      }
      toOv([owin.x, 0.01 / now.F, owin.z], _a);
      markH.add(_a, 0.06 + owin.side * now.F * 0.5, LK.CYAN, 0.35 * ma * (1 - z));
    }
    mark.end(); markH.end();
    // chapter 2's scales and the poster's patch, on the tile
    tubes.begin(); balls.begin(); rings.begin(); halos.begin();
    const sc = clamp(S.slide_scale, 0, 3), w = j => clamp(1 - Math.abs(sc - j), 0, 1), ta = lay.ta;
    const w1 = w(1) * ta, w2 = w(2) * ta, w3 = w(3) * ta, pa = clamp(S.slide_patch, 0, 1) * ta;
    if (w1 > 0.003) {
      // a grid of 100 µm squares, one lit
      for (let x = (D.tile.side % GRID) / 2; x <= D.tile.side; x += GRID) {
        tubes.add(tpos(x, 0, _a), tpos(x, D.tile.side, _b), 0.0011, CYANG, 0.35 * w1, 0);
        tubes.add(tpos(0, x, _a), tpos(D.tile.side, x, _b), 0.0011, CYANG, 0.35 * w1, 0);
      }
      const x0 = (D.tile.side % GRID) / 2 + gq[0] * GRID, y0 = (D.tile.side % GRID) / 2 + gq[1] * GRID;
      const c = [[x0, y0], [x0 + GRID, y0], [x0 + GRID, y0 + GRID], [x0, y0 + GRID]];
      for (let j = 0; j < 4; j++) tubes.add(tpos(c[j][0], c[j][1], _a), tpos(c[(j + 1) % 4][0], c[(j + 1) % 4][1], _b), 0.0032, LK.CYAN, w1, 0);
      halos.add(tpos(x0 + GRID / 2, y0 + GRID / 2, _a), GRID * tk * 1.3, LK.CYAN, 0.18 * w1);
    }
    if (w2 > 0.003) {
      // a cell and its six nearest
      const hp = tpos(T.tile.x[HUB], T.tile.y[HUB], [0, 0, 0]);
      hp[1] = 0.006;
      for (const j of six) {
        tpos(T.tile.x[j], T.tile.y[j], _b); _b[1] = 0.006;
        tubes.add(hp, _b, 0.0026, LK.EDGE, w2, 0);
        balls.add(_b, 0.0075, LK.BEAD, w2);
      }
      balls.add(hp, 0.01, LK.CYAN, w2);
      halos.add(hp, 0.09, LK.CYAN, 0.3 * w2);
    }
    if (w3 > 0.003) {
      // a fixed circle round one cell
      const cp = tpos(T.tile.x[CIR], T.tile.y[CIR], [0, 0, 0]);
      cp[1] = 0.005;
      rings.add(cp, UP, CIRR * tk, 0.0028, LK.CYAN, w3, 0);
      for (const j of inCircle) { tpos(T.tile.x[j], T.tile.y[j], _b); _b[1] = 0.006; balls.add(_b, j === CIR ? 0.01 : 0.0075, j === CIR ? LK.CYAN : LK.BEAD, w3); }
      halos.add(cp, CIRR * tk * 2.6, LK.CYAN, 0.2 * w3);
    }
    if (pa > 0.003) {
      // the poster's patch (its square in the tile)
      const x0 = TP[0], y0 = TP[1], s = TP[2], c = [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]];
      for (let j = 0; j < 4; j++) {
        tubes.add(tpos(c[j][0], c[j][1], _a), tpos(c[(j + 1) % 4][0], c[(j + 1) % 4][1], _b), 0.0036, AMB, pa, 0);
        balls.add(tpos(c[j][0], c[j][1], _a), 0.006, AMB, pa);
      }
      halos.add(tpos(x0 + s / 2, y0 + s / 2, _a), s * tk * 1.6, AMB, 0.12 * pa);
    }
    tubes.end(); balls.end(); rings.end(); halos.end();
    LK.depth();
  }

  // ---------------------------------------------------------------- anchors, labels, views
  // anchors follow the layout (functions read the last update's)
  const inTile = (x, y) => () => { const l = now.lay; return [l.tx + (x - th) * tk * l.ts, 0.01, (y - th) * tk * l.ts]; };
  const wk = WIN.k, wh = D.slide.side / 2;
  const inWin = (x, y) => () => [now.wx + (x - wh) * wk, 0.01, (y - wh) * wk];
  const anchors = {
    tile: () => { const l = now.lay; return [l.tx - TW / 2 * l.ts + 0.04, 0.01, -TW / 2 * l.ts + 0.02]; },
    window: () => [now.wx - TW / 2 + 0.04, 0.01, -TW / 2 + 0.02],
    centre: [0, 0, 0],
    patch: inTile(TP[0] + TP[2], TP[1]),
    square: inTile((D.tile.side % GRID) / 2 + (gq[0] + 1) * GRID, (D.tile.side % GRID) / 2 + gq[1] * GRID),
    hub: inTile(T.tile.x[HUB] + 12, T.tile.y[HUB] - 6),
    circle: inTile(T.tile.x[CIR] + CIRR, T.tile.y[CIR] - CIRR * 0.4),
    spots: inTile(470, 500), fluo: inTile(470, 590), points: inTile(470, 545),
    section: () => toOv([OVX - ovW / 2 + 0.05, 0.01, -ovH / 2 + 0.02], [0, 0, 0]),
    mark: () => toOv([owin.x + owin.side / 2, 0.01, owin.z - owin.side / 2], [0, 0, 0]),
    label: () => toOv([-OVL / 2 + SL.label * OVL / 2, 0.02, 0], [0, 0, 0]),
  };
  const fmt = v => v.toLocaleString('en-GB');
  const tileA = S => layout(S.slide_show).ta, winA = S => layout(S.slide_show).wa * (1 - prog(S.slide_over, 0.08, 0.3));
  const modeW = (S, j) => clamp(1 - Math.abs(clamp(S.slide_mode, 0, 2) - j), 0, 1);
  const quiet = S => (1 - clamp(S.slide_points, 0, 1)) * (1 - prog(Math.abs(S.slide_scale), 0.2, 0.6)) * (1 - prog(S.slide_patch, 0, 0.4));
  const labels = [
    { text: ['Healthy liver', ` · ${fmt(D.tile.side)} µm across, ${fmt(T.tile.n)} cells`], at: 'tile', cls: '',
      alpha: S => tileA(S) * modeW(S, 0) * quiet(S) * (1 - clamp(S.map_split || 0, 0, 1)) },
    { text: ['Spatial transcriptomics', ' · sketch: spots read the genes'], at: 'spots', cls: 'cyn', alpha: S => tileA(S) * modeW(S, 1) * (1 - clamp(S.slide_points, 0, 1)) },
    { text: ['Spatial proteomics', ' · sketch: proteins in colour'], at: 'fluo', cls: 'mag', alpha: S => tileA(S) * modeW(S, 2) * (1 - prog(S.slide_points, 0, 0.4)) },
    { text: ['Only positions', ' · every cell a point'], at: 'points', cls: 'amb', alpha: S => tileA(S) * prog(S.slide_points, 0.6, 1) * (1 - prog(Math.abs(S.slide_scale), 0.2, 0.6)) * (1 - prog(S.slide_patch, 0, 0.4)) },
    { text: ['One patch size', ''], at: 'square', cls: 'cyn', alpha: S => tileA(S) * prog(1 - Math.abs(S.slide_scale - 1), 0.5, 0.9) },
    { text: ['A neighbour count', ''], at: 'hub', cls: 'cyn', alpha: S => tileA(S) * prog(1 - Math.abs(S.slide_scale - 2), 0.5, 0.9) },
    { text: ['One radius', ''], at: 'circle', cls: 'cyn', alpha: S => tileA(S) * prog(1 - Math.abs(S.slide_scale - 3), 0.5, 0.9) },
    { text: ['The patch', ` · ${T.patch.n} cells`], at: 'patch', cls: 'amb', alpha: S => tileA(S) * prog(S.slide_patch, 0.5, 1) },
    { text: ['A new slide', ` · ${fmt(O.cells)} cells`], at: 'section', cls: '', alpha: S => prog(S.slide_over, 0.75, 0.95) },
    { text: ['A window', ` · ${fmt(D.slide.side / 1000)} mm, ${fmt(T.slide.n)} cells`], at: 'mark', cls: 'cyn', alpha: S => prog(S.slide_over, 0.75, 0.95) },
    { text: ['The new slide', ` · a window of ${fmt(T.slide.n)} cells`], at: 'window', cls: '',
      alpha: S => winA(S) * (1 - prog(S.slide_over, 0, 0.05)) * (1 - prog(S.map_cell || 0, 0, 0.3)) * (1 - prog(S.map_all || 0, 0, 0.1)) * (1 - prog(S.map_split || 0, 0, 0.1)) * (1 - tileA(S)) },
  ];
  const cell = (x, y) => [x - th, y - th].map(v => Math.round(v * tk * 1000) / 1000);
  const [hx, hz] = cell(T.tile.x[HUB], T.tile.y[HUB]), [cx, cz] = cell(T.tile.x[CIR], T.tile.y[CIR]), [sx, sz] = cell((D.tile.side % GRID) / 2 + (gq[0] + 0.5) * GRID, (D.tile.side % GRID) / 2 + (gq[1] + 0.5) * GRID);
  const cam = {
    default: [0, 56, 3.4, 0, 0, 0.06],
    tile: [8, 58, 3.3, 0, 0, 0.06],
    low: [14, 26, 3.0, 0, 0, 0.12],
    close: [16, 50, 1.1, 0.05, 0, 0.1],
    cells: [22, 46, 0.45, 0.12, 0, 0.18],
    square: [10, 56, 1.4, sx, 0, sz + 0.02],
    hub: [14, 50, 0.9, hx, 0, hz + 0.02],
    circle: [-10, 52, 0.9, cx, 0, cz + 0.02],
    patch: [0, 62, 2.1, 0, 0, 0.02],
    over: [0, 58, 3.4, 0, 0, 0.05],
    window: [0, 56, 3.4, 0, 0, 0.06],
    both: [0, 54, 4.0, -0.13, 0, 0.08],
  };
  const controls = [
    { key: 'piece', label: 'Tissue', options: [['tile', 'Healthy tile'], ['window', 'New slide'], ['both', 'Both'], ['whole', 'Whole slide']] },
    { key: 'look', label: 'Look', options: [['he', 'H&E'], ['spots', 'Spots (sketch)'], ['fluo', 'Proteins (sketch)'], ['points', 'Points']] },
    { key: 'scale', label: 'One scale', options: [['none', 'None'], ['patch', 'Patch'], ['six', 'Neighbours'], ['radius', 'Radius']] },
  ];
  function explore(c) {
    const p = c.piece || 'tile', l = c.look || 'he', s = { none: 0, patch: 1, six: 2, radius: 3 }[c.scale || 'none'] || 0;
    return {
      slide_show: p === 'tile' ? 0 : p === 'both' ? 2 : 1, slide_over: p === 'whole' ? 1 : 0,
      slide_mode: l === 'spots' ? 1 : l === 'fluo' ? 2 : 0, slide_points: l === 'points' ? 1 : 0,
      slide_scale: p === 'tile' || p === 'both' ? s : 0, slide_patch: 0,
    };
  }

  // ---------------------------------------------------------------- what the engine and the map set read
  const API = {
    TW, layout, tile: TILE, win: WIN, overview: { side: owin.side, w: ow, h: oh, bin: O.bin, cells: O.cells },
    // a cell's place in the set's frame (piece 'tile' or 'window', by index), as laid out now
    pos(piece, i, out) {
      out = out || [0, 0, 0];
      const l = now.lay;
      if (piece === 'tile') { out[0] = l.tx + TILE.X[i] * l.ts; out[1] = 0; out[2] = TILE.Z[i] * l.ts; } else { out[0] = l.wx + WIN.X[i]; out[1] = 0; out[2] = WIN.Z[i]; }
      return out;
    },
    hub: HUB, six, circle: CIR,
  };
  return Object.assign(set, {
    params: { slide_a: 1, slide_show: 0, slide_mode: 0, slide_points: 0, slide_scale: 0, slide_patch: 0, slide_over: 0 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};
